import { readFile } from "node:fs/promises";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({
    label: z.string(),
    quantity: z.number().int().positive().nullable(),
    evidenceId: z.literal("smoke-evidence"),
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
        { type: "text", text: "Catalog at least one clearly visible property item. Use evidenceId smoke-evidence and do not guess an unreadable quantity." },
        { type: "file", mediaType: "image/webp", data: image },
      ],
    }],
  });
  if (!result.object.items.length) throw new Error("OpenAI returned no schema-valid items");
  console.log(`OpenAI vision smoke test passed (${result.object.items.length} items).`);
}

await runSmokeTest();
