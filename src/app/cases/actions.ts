"use server";

import { createCase, deleteCaseRecord, getCaseById, updateCaseWithAudit, Case, EvidenceUpload, ManifestItem } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";

import { verifyImageSignature } from "@/lib/image-utils";
import { isCurrencyItem, isValidImageRegion, requiresSensitiveReview, validateManifestStructure } from "@/lib/validation";
import { isValidCurrencyCode, multiplyDecimal, normalizeDecimal } from "@/lib/currency";
import { deleteEvidence, writeEvidence } from "@/lib/evidence-storage";
import { PHOTO_CONTEXT_VALUES } from "@/lib/photo-context";
import { INTAKE_ACKNOWLEDGEMENT_COOKIE } from "@/lib/intake";
import { publicScanError, runAiScan } from "@/lib/ai-scan";

const imageRegionSchema = z.object({
  id: z.string().min(1).max(100),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine(isValidImageRegion, "Photo region must stay inside the source image");

// Schema for manual add/edit validations
const manualItemInputSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  parentId: z.string().max(128).nullable(),
  quantity: z.number().int().positive(),
  quantityKnown: z.boolean().optional(),
  itemType: z.enum(["property", "currency"]).optional(),
  status: z.enum(["confirmed", "review"]),
  confidence: z.number().min(0).max(1),
  reviewReason: z.string().max(500).nullable(),
  evidenceId: z.string().max(128).nullable(),
  ocrText: z.string().max(2000).optional(),
  visibleAttributes: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  currencyCode: z.string().trim().toUpperCase().refine(isValidCurrencyCode, "Valid ISO 4217 currency code required").nullable().optional(),
  denomination: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).nullable().optional(),
  currencyTotal: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).nullable().optional(),
  regions: z.array(imageRegionSchema).max(100).optional(),
});

const createCaseInputSchema = z.object({
  terminal: z.string().trim().min(1).max(50),
  area: z.string().trim().min(1).max(50),
  specificLocation: z.string().trim().max(300).optional().default(""),
  foundTime: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Found time is invalid"),
  foundBy: z.string().max(200),
  outerItemDescription: z.string().trim().min(1).max(200),
  notes: z.string().max(2000),
  storageLocation: z.string().trim().max(200).optional().default(""),
});

const containerContextSchema = z.enum(PHOTO_CONTEXT_VALUES);

function markStaffLineage(caseFile: Case, itemId: string): void {
  const visited = new Set<string>();
  let currentId: string | null = itemId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const item = caseFile.manifest.find((candidate) => candidate.id === currentId);
    if (!item) break;
    item.source = item.id === "outer-item-root" ? "system" : "staff";
    currentId = item.parentId;
  }
}

export async function handleCreateCase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated");
  }

  const cookieStore = await cookies();
  if (cookieStore.get(INTAKE_ACKNOWLEDGEMENT_COOKIE)?.value !== user.username) {
    redirect("/cases/new");
  }

  const parsed = createCaseInputSchema.parse({
    terminal: formData.get("terminal"),
    area: formData.get("area"),
    specificLocation: formData.get("specificLocation") ?? "",
    foundTime: formData.get("foundTime"),
    foundBy: formData.get("foundBy") ?? "",
    outerItemDescription: formData.get("outerItemDescription"),
    notes: formData.get("notes") ?? "",
    storageLocation: formData.get("storageLocation") ?? "",
  });

  const location = `${parsed.terminal} ${parsed.area}${parsed.specificLocation ? ` – ${parsed.specificLocation}` : ""}`;

  const newCase = await createCase({
    location,
    terminal: parsed.terminal,
    area: parsed.area,
    specificLocation: parsed.specificLocation || null,
    foundTime: parsed.foundTime,
    foundBy: parsed.foundBy,
    outerItemDescription: parsed.outerItemDescription,
    notes: parsed.notes,
    storageLocation: parsed.storageLocation || null,
    finalisedBy: user.username,
  });

  await updateCaseWithAudit(
    newCase.id,
    newCase,
    user.username,
    "intake_instructions_acknowledged",
    "Staff acknowledged the guided photo and review order before creating the case.",
  );
  cookieStore.delete(INTAKE_ACKNOWLEDGEMENT_COOKIE);

  redirect(`/cases/${newCase.id}`);
}

export async function handleAcknowledgeIntakeInstructions(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");
  z.literal("yes").parse(formData.get("acknowledged"));

  const cookieStore = await cookies();
  cookieStore.set(INTAKE_ACKNOWLEDGEMENT_COOKIE, user.username, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60,
    path: "/cases/new",
  });
  redirect("/cases/new/intake");
}

export async function handleUploadEvidence(caseId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthenticated" };
  }

  const caseFile = await getCaseById(caseId);
  if (!caseFile) {
    return { error: "Case not found" };
  }

  if (caseFile.status === "finalised") {
    return { error: "Cannot add photos to a completed case" };
  }

  const file = formData.get("file") as File;
  const contextResult = containerContextSchema.safeParse(formData.get("containerContext") || "outer-item");
  if (!contextResult.success) {
    return { error: "Invalid container or nesting level" };
  }
  const containerContext = contextResult.data;

  if (!file || file.size === 0) {
    return { error: "No file was uploaded" };
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    return { error: "File exceeds the 5MB limit" };
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.type)) {
    return { error: "Only JPG, PNG, and WebP images are allowed" };
  }

  let extension = "";
  if (file.type === "image/jpeg") extension = "jpg";
  else if (file.type === "image/png") extension = "png";
  else if (file.type === "image/webp") extension = "webp";

  const fileId = `ev-${crypto.randomUUID()}`;
  const filename = `${fileId}.${extension}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify cryptographic/magic number signatures of files
    if (!verifyImageSignature(buffer, file.type)) {
      return { error: "Security validation failed: File contents do not match the expected image signature." };
    }

    await writeEvidence(filename, buffer, file.type);

    const safeOriginalName = file.name.slice(0, 255);
    const uploadRecord: EvidenceUpload = {
      id: fileId,
      filename,
      originalName: safeOriginalName,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      containerContext,
    };

    caseFile.uploads.push(uploadRecord);
    await updateCaseWithAudit(
      caseId,
      caseFile,
      user.username,
      "evidence_uploaded",
      `Uploaded image "${safeOriginalName}" linked to container level: "${containerContext}"`,
    );

    return { success: true, upload: uploadRecord };
  } catch (error: unknown) {
    try {
      await deleteEvidence(filename);
    } catch (cleanupErr) {
      console.error("Failed to clean up orphaned evidence file:", cleanupErr);
    }
    console.error("Evidence upload failed:", error);
    const message = error instanceof Error ? error.message : "Failed to process uploaded file";
    return { error: message };
  }
}

export async function handleAiAnalysis(caseId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  try {
    return await runAiScan({ caseId, username: user.username });
  } catch (error) {
    return { error: publicScanError(error) };
  }
}

export async function handleConfirmItem(caseId: string, itemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Cannot modify a finalised case" };

  const itemIndex = caseFile.manifest.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return { error: "Item not found" };

  const item = caseFile.manifest[itemIndex];
  if (item.status === "confirmed") return { success: true, manifest: caseFile.manifest };


  item.status = "confirmed";
  item.reviewReason = null;
  item.confidence = 1.0;
  markStaffLineage(caseFile, item.id);

  // Verify structure is still valid
  const validationError = validateManifestStructure(caseFile);
  if (validationError) {
    return { error: `Validation failed: ${validationError}` };
  }

  await updateCaseWithAudit(caseId, caseFile, user.username, "item_confirmed", `Confirmed item "${item.label}"`);
  return { success: true, manifest: caseFile.manifest };
}

export async function handleUpdateItem(caseId: string, updatedItem: ManifestItem) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Cannot modify a finalised case" };

  const itemIndex = caseFile.manifest.findIndex((i) => i.id === updatedItem.id);
  if (itemIndex === -1) return { error: "Item not found" };

  try {
    // Validate schema of updated values
    const parsed = manualItemInputSchema.parse({
      label: updatedItem.label,
      parentId: updatedItem.parentId,
      quantity: updatedItem.quantity,
      quantityKnown: updatedItem.quantityKnown ?? true,
      itemType: updatedItem.itemType ?? "property",
      status: updatedItem.status,
      confidence: updatedItem.confidence ?? 1.0,
      reviewReason: updatedItem.reviewReason ?? null,
      evidenceId: updatedItem.evidenceId ?? null,
      ocrText: updatedItem.ocrText ?? "",
      visibleAttributes: updatedItem.visibleAttributes ?? "",
      category: updatedItem.category ?? "other",
      currencyCode: updatedItem.currencyCode ?? null,
      denomination: updatedItem.denomination ?? null,
      currencyTotal: updatedItem.currencyTotal ?? null,
      regions: updatedItem.regions ?? [],
    });
    parsed.denomination = normalizeDecimal(parsed.denomination);
    parsed.currencyTotal = parsed.itemType === "currency" && parsed.currencyCode && parsed.denomination && parsed.quantityKnown !== false
      ? multiplyDecimal(parsed.denomination, parsed.quantity)
      : null;

    const originalItem = caseFile.manifest[itemIndex];
    const sourcePhotoChanged = originalItem.evidenceId !== parsed.evidenceId;
    if (sourcePhotoChanged) {
      parsed.regions = [];
      parsed.status = "review";
      parsed.reviewReason = "Source photo changed; redraw and confirm photo regions";
    }
    const parsedItem: ManifestItem = { ...originalItem, ...parsed, id: updatedItem.id, source: "staff" };
    if (isCurrencyItem(parsedItem)) {
      parsed.itemType = "currency";
      parsed.currencyTotal = parsed.currencyCode && parsed.denomination && parsed.quantityKnown !== false
        ? multiplyDecimal(parsed.denomination, parsed.quantity)
        : null;
    }
    const becameCurrency = !isCurrencyItem(originalItem) && isCurrencyItem(parsedItem);
    const currencyAmountChanged = isCurrencyItem(originalItem) && isCurrencyItem(parsedItem) && (
      originalItem.currencyCode !== parsed.currencyCode
      || normalizeDecimal(originalItem.denomination) !== parsed.denomination
      || originalItem.quantity !== parsed.quantity
      || (originalItem.quantityKnown ?? true) !== (parsed.quantityKnown ?? true)
    );
    if (becameCurrency || currencyAmountChanged) {
      parsed.status = "review";
      parsed.reviewReason = "Currency amount changed and requires staff confirmation";
    }
    const becameSensitive =
      !requiresSensitiveReview(originalItem.label, originalItem.ocrText, originalItem.visibleAttributes) &&
      requiresSensitiveReview(parsed.label, parsed.ocrText, parsed.visibleAttributes);
    if (becameSensitive) {
      parsed.status = "review";
      parsed.reviewReason = parsed.reviewReason || "Sensitive item details require staff confirmation";
    }


    // Enforce root protections
    if (updatedItem.id === "outer-item-root") {
      caseFile.manifest[itemIndex] = {
        id: "outer-item-root",
        label: caseFile.outerItemDescription, // Locked to original description
        parentId: null,
        quantity: 1,
        quantityKnown: true,
        itemType: "property",
        status: "confirmed",
        confidence: 1.0,
        reviewReason: null,
        evidenceId: "manual-creation",
        ocrText: parsed.ocrText,
        visibleAttributes: parsed.visibleAttributes,
        source: "system",
      };
    } else {
      // For non-root, ensure parentId is not null
      if (parsed.parentId === null) {
        return { error: "Only the root item can be at the top level (parent: null)." };
      }

      // Ensure parent exists
      if (!caseFile.manifest.some((p) => p.id === parsed.parentId)) {
        return { error: `Parent container ID "${parsed.parentId}" does not exist.` };
      }

      // Ensure no self-referencing parent
      if (parsed.parentId === updatedItem.id) {
        return { error: "An item cannot reference itself as parent." };
      }

      caseFile.manifest[itemIndex] = {
        id: updatedItem.id,
        label: parsed.label,
        parentId: parsed.parentId,
        quantity: parsed.quantity,
        quantityKnown: parsed.quantityKnown ?? true,
        itemType: parsed.itemType ?? "property",
        status: parsed.status,
        confidence: parsed.confidence,
        reviewReason: parsed.reviewReason,
        evidenceId: parsed.evidenceId,
        ocrText: parsed.ocrText,
        visibleAttributes: parsed.visibleAttributes,
        category: parsed.category ?? originalItem.category ?? "other",
        currencyCode: parsed.currencyCode ?? null,
        denomination: parsed.denomination ?? null,
        currencyTotal: parsed.currencyTotal ?? null,
        regions: parsed.regions ?? [],
        source: "staff",
      };
      markStaffLineage(caseFile, updatedItem.id);
    }

    // Run structural integrity and cycle validation
    const validationError = validateManifestStructure(caseFile);
    if (validationError) {
      return { error: `Validation failed: ${validationError}` };
    }

    await updateCaseWithAudit(
      caseId,
      caseFile,
      user.username,
      "item_updated",
      `Updated item "${originalItem.label}" to "${parsed.label}" (Qty: ${parsed.quantity}, Parent: ${parsed.parentId || "None"})`,
    );
    return { success: true, manifest: caseFile.manifest };
  } catch (error: unknown) {
    console.error("Manual item update validation failed:", error);
    const message = error instanceof Error ? error.message : "Validation constraints violated.";
    return { error: `Update rejected: ${message}` };
  }
}

export async function handleAddItem(caseId: string, itemData: Omit<ManifestItem, "id">) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Cannot modify a finalised case" };

  try {
    // Validate schema
    const parsed = manualItemInputSchema.parse({
      label: itemData.label,
      parentId: itemData.parentId,
      quantity: itemData.quantity,
      quantityKnown: itemData.quantityKnown ?? true,
      itemType: itemData.itemType ?? "property",
      status: itemData.status,
      confidence: itemData.confidence ?? 1.0,
      reviewReason: itemData.reviewReason ?? null,
      evidenceId: itemData.evidenceId ?? null,
      ocrText: itemData.ocrText ?? "",
      visibleAttributes: itemData.visibleAttributes ?? "",
      category: itemData.category ?? "other",
      currencyCode: itemData.currencyCode ?? null,
      denomination: itemData.denomination ?? null,
      currencyTotal: itemData.currencyTotal ?? null,
      regions: itemData.regions ?? [],
    });
    parsed.denomination = normalizeDecimal(parsed.denomination);
    parsed.currencyTotal = parsed.itemType === "currency" && parsed.currencyCode && parsed.denomination && parsed.quantityKnown !== false
      ? multiplyDecimal(parsed.denomination, parsed.quantity)
      : null;

    if (parsed.parentId === null) {
      // Force non-root manual items under the root item
      parsed.parentId = "outer-item-root";
    }

    // Ensure parent container exists in DB
    if (!caseFile.manifest.some((p) => p.id === parsed.parentId)) {
      return { error: `Parent container ID "${parsed.parentId}" does not exist.` };
    }

    if (requiresSensitiveReview(parsed.label, parsed.ocrText, parsed.visibleAttributes)) {
      parsed.status = "review";
      parsed.reviewReason = parsed.reviewReason || "Sensitive item details require staff confirmation";
    }

    // Cryptographically secure item ID generation
    const newItem: ManifestItem = {
      id: `item-${crypto.randomUUID()}`,
      label: parsed.label,
      parentId: parsed.parentId,
      quantity: parsed.quantity,
      quantityKnown: parsed.quantityKnown ?? true,
      itemType: parsed.itemType ?? "property",
      status: parsed.status,
      confidence: parsed.confidence,
      reviewReason: parsed.reviewReason,
      evidenceId: parsed.evidenceId,
      ocrText: parsed.ocrText,
      visibleAttributes: parsed.visibleAttributes,
      category: parsed.category ?? "other",
      currencyCode: parsed.currencyCode ?? null,
      denomination: parsed.denomination ?? null,
      currencyTotal: parsed.currencyTotal ?? null,
      regions: parsed.regions ?? [],
      source: "staff",
    };
    if (isCurrencyItem(newItem)) {
      newItem.itemType = "currency";
      newItem.currencyTotal = newItem.currencyCode && newItem.denomination && newItem.quantityKnown !== false
        ? multiplyDecimal(newItem.denomination, newItem.quantity)
        : null;
      newItem.status = "review";
      newItem.reviewReason = newItem.reviewReason || "Currency amount requires staff confirmation";
    }

    caseFile.manifest.push(newItem);
    markStaffLineage(caseFile, newItem.id);

    // Validate structural integrity
    const validationError = validateManifestStructure(caseFile);
    if (validationError) {
      return { error: `Validation failed: ${validationError}` };
    }

    await updateCaseWithAudit(caseId, caseFile, user.username, "item_added", `Manually added new item "${newItem.label}" (Qty: ${newItem.quantity})`);
    return { success: true, manifest: caseFile.manifest };
  } catch (error: unknown) {
    console.error("Manual item insertion validation failed:", error);
    const message = error instanceof Error ? error.message : "Validation constraints violated.";
    return { error: `Insertion rejected: ${message}` };
  }
}

export async function handleReassignPhotoRegion(caseId: string, regionId: string, targetItemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };
  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Cannot modify a finalised case" };

  const sourceItem = caseFile.manifest.find((item) => item.regions?.some((region) => region.id === regionId));
  const targetItem = caseFile.manifest.find((item) => item.id === targetItemId);
  if (!sourceItem || !targetItem) return { error: "Photo region or destination item not found" };
  if (sourceItem.id === targetItem.id) return { success: true, manifest: caseFile.manifest };
  if (!sourceItem.evidenceId || targetItem.evidenceId !== sourceItem.evidenceId) {
    return { error: "Regions can only be reassigned between records linked to the same source photo" };
  }

  const region = sourceItem.regions!.find((candidate) => candidate.id === regionId)!;
  sourceItem.regions = sourceItem.regions!.filter((candidate) => candidate.id !== regionId);
  targetItem.regions = [...(targetItem.regions || []), region];
  for (const item of [sourceItem, targetItem]) {
    item.status = "review";
    item.reviewReason = "Photo region assignment changed and requires staff confirmation";
    item.source = "staff";
    markStaffLineage(caseFile, item.id);
  }

  const validationError = validateManifestStructure(caseFile);
  if (validationError) return { error: `Validation failed: ${validationError}` };
  await updateCaseWithAudit(caseId, caseFile, user.username, "photo_region_reassigned", `Reassigned a photo region from "${sourceItem.label}" to "${targetItem.label}"`);
  return { success: true, manifest: caseFile.manifest };
}

export async function handleDeleteItem(caseId: string, itemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Cannot modify a finalised case" };

  if (itemId === "outer-item-root") {
    return { error: "Domain validation failed: Cannot delete the outer container root item." };
  }

  const itemIndex = caseFile.manifest.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return { error: "Item not found" };

  const itemToDelete = caseFile.manifest[itemIndex];

  // Secure reparenting of child nodes to parent container or root container
  const parentId = itemToDelete.parentId || "outer-item-root";
  caseFile.manifest = caseFile.manifest.map((item) => {
    if (item.parentId === itemId) {
      return { ...item, parentId };
    }
    return item;
  });

  // Remove item
  caseFile.manifest.splice(itemIndex, 1);

  // Validate structural integrity of updated tree
  const validationError = validateManifestStructure(caseFile);
  if (validationError) {
    return { error: `Validation failed: ${validationError}` };
  }

  await updateCaseWithAudit(caseId, caseFile, user.username, "item_deleted", `Deleted item "${itemToDelete.label}". Any child items were re-parented to protect nesting.`);
  return { success: true, manifest: caseFile.manifest };
}

export async function handleDeletePhoto(caseId: string, uploadId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Completed cases and their photos are retained." };

  const upload = caseFile.uploads.find((candidate) => candidate.id === uploadId);
  if (!upload) return { error: "Photo not found" };

  caseFile.uploads = caseFile.uploads.filter((candidate) => candidate.id !== uploadId);
  caseFile.manifest = caseFile.manifest.map((item) => {
    if (item.evidenceId !== uploadId) return item;
    if (item.id === "outer-item-root") {
      return { ...item, evidenceId: "manual-creation", regions: [], status: "review" as const, reviewReason: "Source photo deleted. Verify item." };
    }
    return {
      ...item,
      evidenceId: "staff-added",
      regions: [],
      source: "staff" as const,
      status: "review" as const,
      reviewReason: "Source photo deleted. Verify item.",
    };
  });

  const validationError = validateManifestStructure(caseFile);
  if (validationError) return { error: `Could not delete photo: ${validationError}` };

  const updated = await updateCaseWithAudit(caseId, caseFile, user.username, "evidence_deleted", `Deleted photo "${upload.originalName}".`);
  try {
    await deleteEvidence(upload.filename);
  } catch (error) {
    console.error("Photo record deleted but storage cleanup failed:", error);
    return { success: true, case: updated, warning: "Photo removed. Storage cleanup requires attention." };
  }
  return { success: true, case: updated };
}

export async function handleSetCaseArchived(caseId: string, archived: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (Boolean(caseFile.archivedAt) === archived) return { success: true, case: caseFile };

  caseFile.archivedAt = archived ? new Date().toISOString() : null;
  caseFile.archivedBy = archived ? user.username : null;
  const updated = await updateCaseWithAudit(
    caseId,
    caseFile,
    user.username,
    archived ? "case_archived" : "case_restored",
    archived ? "Archived case." : "Restored case to the active list.",
  );
  revalidatePath("/cases");
  return { success: true, case: updated };
}

export async function handleDeleteCase(caseId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Completed cases are retained and cannot be deleted." };

  const deleted = await deleteCaseRecord(caseId);
  if (!deleted) return { error: "Case not found" };

  const cleanupResults = await Promise.allSettled(caseFile.uploads.map((upload) => deleteEvidence(upload.filename)));
  const cleanupFailed = cleanupResults.some((result) => result.status === "rejected");
  if (cleanupFailed) console.error(`Case ${caseId} deleted but one or more photo files could not be cleaned up.`);
  revalidatePath("/cases");
  return { success: true, warning: cleanupFailed ? "Case deleted. Photo cleanup requires attention." : undefined };
}

export async function handleFinaliseCase(caseId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const caseFile = await getCaseById(caseId);
  if (!caseFile) return { error: "Case not found" };
  if (caseFile.status === "finalised") return { error: "Case is already finalised" };

  // 1. Validate required case details
  if (!caseFile.location || !caseFile.foundTime || !caseFile.outerItemDescription) {
    return { error: "Cannot finalise case: Location, found time, and outer item description are required." };
  }

  if (caseFile.uploads.length === 0) {
    return { error: "Cannot complete case: Add at least one valid item photo." };
  }

  // 2. Validate structural integrity of manifest
  const validationError = validateManifestStructure(caseFile);
  if (validationError) {
    return { error: `Cannot complete case: Item-list validation failed: ${validationError}` };
  }

  // 3. Ensure no unresolved review flags remain
  const unresolved = caseFile.manifest.filter((i) => i.status === "review");
  if (unresolved.length > 0) {
    return { error: `Cannot finalise case. There are ${unresolved.length} unresolved review items.` };
  }

  caseFile.status = "finalised";
  caseFile.finalisedAt = new Date().toISOString();
  caseFile.finalisedBy = user.username;

  await updateCaseWithAudit(caseId, caseFile, user.username, "case_finalised", `Case finalised and locked by ${user.username}`);
  return { success: true, case: caseFile };
}
