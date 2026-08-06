"use client";

import type { CSSProperties } from "react";
import type { EvidenceUpload, ManifestItem } from "@/lib/db";
import { formatDecimal } from "@/lib/currency";
import { buildLinkedInventoryRows } from "@/lib/linked-inventory";
import { RegionCrops } from "./PhotoRegionVerifier";

function expectedBoxCount(item: ManifestItem): number {
  if (item.quantityKnown === false) return Math.max(1, item.regions?.length ?? 0);
  return item.quantity;
}

function conciseReviewWarning(item: ManifestItem): string {
  if ((item.regions?.length ?? 0) !== expectedBoxCount(item) || /invalid photo|missing source photo/i.test(item.reviewReason ?? "")) {
    return "Fix photo boxes.";
  }
  if (item.itemType === "currency") return "Verify currency, value and count.";
  if (/quantity|count/i.test(item.reviewReason ?? "")) return "Verify quantity.";
  return "Staff review required.";
}

function sourceLabel(item: ManifestItem, uploads: EvidenceUpload[]): string {
  if (item.evidenceId === "staff-added" || item.evidenceId === "staff-command") return "Staff added";
  if (item.evidenceId === "manual-creation") return "Case record";
  return uploads.find((upload) => upload.id === item.evidenceId)?.originalName ?? "Source needs review";
}

interface LinkedInventoryProps {
  items: ManifestItem[];
  uploads: EvidenceUpload[];
  selectedItemId: string | null;
  readOnly: boolean;
  onSelectItem: (itemId: string) => void;
  onConfirmItem: (itemId: string) => void;
  onEditItem: (item: ManifestItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: () => void;
}

export default function LinkedInventory({
  items,
  uploads,
  selectedItemId,
  readOnly,
  onSelectItem,
  onConfirmItem,
  onEditItem,
  onDeleteItem,
  onAddItem,
}: LinkedInventoryProps) {
  const rows = buildLinkedInventoryRows(items);
  const reviews = items.filter((item) => item.status === "review").length;
  const expectedBoxes = items.reduce((total, item) => total + expectedBoxCount(item), 0);
  const actualBoxes = items.reduce((total, item) => total + (item.regions?.length ?? 0), 0);
  const currencyGroups = new Set(items.filter((item) => item.itemType === "currency" && item.currencyCode).map((item) => item.currencyCode)).size;

  return (
    <section className="linked-inventory" aria-labelledby="linked-inventory-title">
      <header className="linked-inventory-header">
        <div>
          <p className="eyebrow">Linked Inventory</p>
          <h2 id="linked-inventory-title">Item List</h2>
        </div>
        {!readOnly && (
          <button type="button" className="text-link" onClick={onAddItem}>+ Add Item</button>
        )}
      </header>

      <div className="inventory-summary" aria-label="Inventory summary">
        <span><strong>{items.length}</strong> records</span>
        <span className={reviews ? "needs-review" : "is-ready"}><strong>{reviews}</strong> to review</span>
        <span><strong>{actualBoxes}/{expectedBoxes}</strong> listed objects boxed</span>
        {currencyGroups > 0 && <span><strong>{currencyGroups}</strong> currency groups</span>}
      </div>

      {rows.length === 0 ? (
        <div className="inventory-empty">No items yet. Add photos and scan, or add items manually.</div>
      ) : (
        <ol className="inventory-tree" aria-label="Photo-linked item hierarchy">
          {rows.map(({ item, depth, parentLabel }) => {
            const selected = selectedItemId === item.id;
            const rowStyle = { "--inventory-depth": Math.min(depth, 3) } as CSSProperties;
            return (
              <li key={item.id} className="inventory-tree-item" style={rowStyle}>
                <article
                  className={selected ? "review-item inventory-row selected" : "review-item inventory-row"}
                  aria-label={parentLabel ? `${item.label}, inside ${parentLabel}` : item.label}
                  onClick={() => onSelectItem(item.id)}
                >
                  <div className="inventory-row-main">
                    <div className="inventory-row-title">
                      {depth > 0 && <span className="inventory-branch" aria-hidden="true">↳</span>}
                      <strong>{item.label}</strong>
                      {item.quantity > 1 && <span className="inventory-quantity">×{item.quantity}</span>}
                      {item.itemType === "currency" && item.currencyCode && (
                        <span className="inventory-currency">{item.currencyCode} {item.currencyTotal != null ? formatDecimal(item.currencyTotal) : "-"}</span>
                      )}
                    </div>
                    <div className="inventory-row-meta">
                      <button
                        type="button"
                        className="inventory-source"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectItem(item.id);
                        }}
                        aria-label={`Select ${item.label} in linked inventory`}
                      >
                        Photo · {sourceLabel(item, uploads)}
                      </button>
                      {item.status === "review" ? (
                        <span className="inventory-state needs-review">Needs review</span>
                      ) : (
                        <span className="inventory-state is-ready">Confirmed</span>
                      )}
                    </div>
                    {item.reviewReason && (
                      <div className="inventory-warning" title={item.reviewReason}>⚠ {conciseReviewWarning(item)}</div>
                    )}
                    <RegionCrops item={item} selected={selected} onSelect={() => onSelectItem(item.id)} />
                  </div>

                  <div className="inventory-actions">
                    {!readOnly && item.status === "review" && (
                      <button className="review-button" onClick={(event) => { event.stopPropagation(); onConfirmItem(item.id); }} type="button">Confirm</button>
                    )}
                    {!readOnly && (
                      <>
                        <button type="button" aria-label={`Edit ${item.label}`} onClick={(event) => { event.stopPropagation(); onEditItem(item); }} title="Edit">Edit</button>
                        {item.id !== "outer-item-root" && (
                          <button type="button" aria-label={`Delete ${item.label}`} onClick={(event) => { event.stopPropagation(); onDeleteItem(item.id); }} title="Delete">Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
