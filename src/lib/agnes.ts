import { createOpenAI } from "@ai-sdk/openai";

/**
 * Agnes AI provider — OpenAI-compatible endpoint for vision and text.
 * Uses the Agnes API Hub gateway (https://apihub.agnes-ai.com/v1).
 * Model: agnes-2.0-flash (512K context, image understanding via image_url).
 *
 * Agnes is a Singapore-based AI model company and Launchpad 2026 sponsor.
 */
export function getAgnesProvider() {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) return null;

  return createOpenAI({
    apiKey,
    baseURL: "https://apihub.agnes-ai.com/v1",
    name: "agnes",
  });
}

export function getAgnesModelName(): string {
  return process.env.AGNES_MODEL || "agnes-2.0-flash";
}

export function isAgnesAvailable(): boolean {
  return Boolean(process.env.AGNES_API_KEY);
}
