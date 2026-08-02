import { readFile } from "node:fs/promises";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({
    tempId: z.string().min(1),
    label: z.string().min(1),
    brand: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    quantity: z.number().int().positive().nullable(),
    evidenceId: z.literal("smoke-evidence"),
    regions: z.array(z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })).min(1),
  })).min(1),
});

async function runSmokeTest() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const image = await readFile("./public/demo/found-property-evidence.webp");
  const result = await generateObject({
    model: openai(process.env.OPENAI_MODEL || "gpt-4.1-mini"),
    schema,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Catalog every distinct visible physical object, including uncertain objects. Use tempId outer-item-root for the visible outer black backpack and unique tempIds for everything else. Return brand and model only when visibly verifiable; otherwise use null. Keep label as the generic item type. Use evidenceId smoke-evidence. Return one tight normalized x/y/width/height bounding box per visible physical instance; coordinates are fractions of the full image and region count must equal every known quantity. Do not omit uncertain objects and do not guess an unreadable quantity." },
        { type: "file", mediaType: "image/webp", data: image },
      ],
    }],
  });
  if (!result.object.items.length) throw new Error("OpenAI returned no schema-valid items");
  if (!result.object.items.some((item) => item.tempId === "outer-item-root")) {
    throw new Error("OpenAI did not mark the visible outer item");
  }
  if (result.object.items.some((item) => item.quantity != null && item.regions.length !== item.quantity)) {
    throw new Error("OpenAI region count did not match a visible item quantity");
  }
  const markedInstances = result.object.items.reduce((count, item) => count + item.regions.length, 0);
  if (markedInstances !== 15) {
    console.error(JSON.stringify(result.object.items.map((item) => ({ tempId: item.tempId, label: item.label, quantity: item.quantity, regions: item.regions.length })), null, 2));
    throw new Error(`OpenAI marked ${markedInstances} of 15 staged visible instances`);
  }
  console.log(`OpenAI vision smoke test passed (${result.object.items.length} records, ${markedInstances} marked instances).`);
}

await runSmokeTest();
