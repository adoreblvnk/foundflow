export const SCAN_EVENT_DETAILS = {
  started: { progress: 5, label: "Starting photo scan" },
  photos_loaded: { progress: 20, label: "Item photos loaded" },
  primary_complete: { progress: 55, label: "Initial item scan complete" },
  verification_complete: { progress: 75, label: "Independent verification complete" },
  saving: { progress: 90, label: "Saving the linked item draft" },
  complete: { progress: 100, label: "Photo scan complete" },
  error: { progress: 100, label: "Photo scan could not be completed" },
} as const;

export type ScanEventType = keyof typeof SCAN_EVENT_DETAILS;

export type ScanEvent = {
  type: ScanEventType;
  progress: number;
  label: string;
  photoCount: number;
  itemCount?: number;
  error?: string;
};

export function createScanEvent(
  type: ScanEventType,
  details: Pick<ScanEvent, "photoCount"> & Partial<Pick<ScanEvent, "itemCount" | "error" | "label">>,
): ScanEvent {
  const definition = SCAN_EVENT_DETAILS[type];
  return {
    type,
    progress: definition.progress,
    label: details.label ?? definition.label,
    photoCount: details.photoCount,
    ...(details.itemCount === undefined ? {} : { itemCount: details.itemCount }),
    ...(details.error === undefined ? {} : { error: details.error }),
  };
}

export function parseScanEvent(value: unknown): ScanEvent {
  if (!value || typeof value !== "object") throw new Error("The scan returned an invalid progress event.");
  const event = value as Partial<ScanEvent>;
  if (
    typeof event.type !== "string"
    || !(event.type in SCAN_EVENT_DETAILS)
    || typeof event.progress !== "number"
    || typeof event.label !== "string"
    || typeof event.photoCount !== "number"
  ) {
    throw new Error("The scan returned an invalid progress event.");
  }
  return event as ScanEvent;
}

export async function consumeScanStream(
  caseId: string,
  onEvent: (event: ScanEvent) => void,
  signal?: AbortSignal,
): Promise<ScanEvent> {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/scan`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "Photo scan could not be started.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastProgress = -1;
  let terminalEvent: ScanEvent | null = null;

  const acceptLine = (line: string) => {
    if (!line.trim()) return;
    const event = parseScanEvent(JSON.parse(line));
    if (event.progress < lastProgress) throw new Error("The scan returned progress out of order.");
    lastProgress = event.progress;
    terminalEvent = event;
    onEvent(event);
    if (event.type === "error") throw new Error(event.error || event.label);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) acceptLine(line);
    if (done) break;
  }
  if (buffer.trim()) acceptLine(buffer);

  const completedEvent = terminalEvent as ScanEvent | null;
  if (completedEvent?.type !== "complete") {
    throw new Error("The photo scan connection ended before completion. Refresh the case to check whether the final draft was saved.");
  }
  return completedEvent;
}
