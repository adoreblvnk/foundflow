import { codexExec } from "ai-sdk-provider-codex-cli";
import { z } from "zod";
import fs from "fs";
import { generateObject } from "ai";

async function runSmokeTest() {
  console.log("Starting live AI vision smoke test...");

  // 1. Create a harmless staged PNG (1x1 pixel)
  const stagedImgPath = "./tests/staged_evidence.png";
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  fs.writeFileSync(stagedImgPath, pngBytes);
  console.log("Harmless staged image written to disk:", stagedImgPath);

  // 2. Define schema matching app expectations
  const schema = z.object({
    items: z.array(
      z.object({
        tempId: z.string().describe("temporary item id"),
        label: z.string().describe("item label"),
        parentId: z.string().nullable().describe("parent tempId or null"),
        quantity: z.number().int().positive().describe("quantity"),
        confidence: z.number().min(0).max(1).describe("confidence score"),
        status: z.enum(["confirmed", "review"]).describe("status"),
        reviewReason: z.string().nullable().describe("reason if review is needed"),
        evidenceId: z.string().describe("linked evidence ID"),
        ocrText: z.string().describe("extracted text or empty string"),
        visibleAttributes: z.string().describe("visible attributes or empty string"),
      })
    ),
  });

  try {
    // 3. Invoke Codex CLI provider
    const model = codexExec("gpt-5.5", {
      allowNpx: false,
      skipGitRepoCheck: true,
      sandboxMode: "read-only",
      approvalMode: "never",
      cwd: process.cwd()
    });
    console.log("Invoking Codex CLI model (gpt-5.5)...");

    const result = await generateObject({
      model,
      schema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Please catalog the items in this image of found-property evidence. Return a nested manifest structure." },
            {
              type: "file",
              mediaType: "image/png",
              data: pngBytes
            }
          ]
        }
      ]
    });

    console.log("Live AI vision call returned successfully!");
    console.log("Output Object:", JSON.stringify(result.object, null, 2));

    if (result.object && Array.isArray(result.object.items)) {
      console.log("SMOKE TEST PASSED: Structure is schema-valid.");
    } else {
      console.error("SMOKE TEST FAILED: Schema is invalid or empty.");
      process.exit(1);
    }
  } catch (error) {
    console.error("SMOKE TEST FAILED with error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (fs.existsSync(stagedImgPath)) {
      fs.unlinkSync(stagedImgPath);
    }
  }
}

void runSmokeTest();
