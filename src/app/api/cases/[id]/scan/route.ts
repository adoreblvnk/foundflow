import { getCurrentUser } from "@/lib/auth";
import { publicScanError, runAiScan, runDeterministicScanFixture } from "@/lib/ai-scan";
import { createScanEvent, type ScanEvent } from "@/lib/scan-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const runScan = process.env.PLAYWRIGHT_TEST_MODE === "1" && process.env.PLAYWRIGHT_SCAN_FIXTURE === "1"
    ? runDeterministicScanFixture
    : runAiScan;
  let connected = true;
  let lastProgress = 0;
  let lastPhotoCount = 0;
  const disconnect = () => {
    connected = false;
    abortController.abort();
  };
  request.signal.addEventListener("abort", disconnect, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        if (!connected) throw new Error("Scan stream disconnected");
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void runScan({
        caseId: id,
        username: user.username,
        signal: abortController.signal,
        onProgress: (event: ScanEvent) => {
          lastProgress = event.progress;
          lastPhotoCount = event.photoCount;
          send(event);
        },
      }).catch((error) => {
        if (connected) {
          send(createScanEvent("error", {
            photoCount: lastPhotoCount,
            progress: lastProgress,
            error: publicScanError(error),
          }));
        }
      }).finally(() => {
        request.signal.removeEventListener("abort", disconnect);
        if (connected) controller.close();
      });
    },
    cancel() {
      disconnect();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
