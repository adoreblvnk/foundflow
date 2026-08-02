"use client";

import { useState, useRef, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import LayoutGuide from "@/components/LayoutGuide";
import { handleUploadEvidence, handleAiAnalysis, handleFinaliseCase, handleConfirmItem } from "@/app/cases/actions";
import type { Case } from "@/lib/db";
import { formatDecimal } from "@/lib/currency";
import { hasFirstStaffCheck } from "@/lib/validation";

export default function KioskPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [caseFile, setCaseFile] = useState<Case | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [photoCount, setPhotoCount] = useState(0);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setShowGuide(false);
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  // Create a case if none exists
  async function ensureCase(): Promise<string | null> {
    if (caseFile) return caseFile.id;
    try {
      const formData = new FormData();
      formData.set("location", "Kiosk Station");
      formData.set("foundTime", new Date().toISOString().slice(0, 16));
      formData.set("outerItemDescription", "Found property (Kiosk scan)");
      formData.set("notes", "Created via kiosk scanning mode");
      // handleCreateCase redirects, so we use a fetch to the API instead
      const res = await fetch("/api/cases", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const caseRes = await fetch(`/api/cases/${data.id}`, { cache: "no-store" });
        if (caseRes.ok) {
          const c = await caseRes.json();
          setCaseFile(c);
          return c.id;
        }
      }
    } catch { /* fallback below */ }
    setError("Failed to create case. Please try again.");
    return null;
  }

  // Capture frame from video
  async function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) { setIsCapturing(false); return; }

    const id = await ensureCase();
    if (!id) { setIsCapturing(false); return; }

    // Upload
    const formData = new FormData();
    formData.append("file", blob, `kiosk-capture-${Date.now()}.jpg`);
    formData.append("containerContext", "bag-contents");

    const result = await handleUploadEvidence(id, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setPhotoCount((n) => n + 1);
    }
    setIsCapturing(false);
  }

  // Run AI scan
  async function runScan() {
    if (!caseFile) return;
    setIsScanning(true);
    setError(null);
    const result = await handleAiAnalysis(caseFile.id);
    if (result.error) {
      setError(result.error);
    } else if (result.manifest) {
      setCaseFile((prev) => prev ? { ...prev, manifest: result.manifest! } : prev);
    }
    setIsScanning(false);
  }

  // Confirm all items
  async function confirmAll() {
    if (!caseFile) return;
    for (const item of caseFile.manifest) {
      if (item.status === "review") {
        await handleConfirmItem(caseFile.id, item.id);
      }
    }
    // Reload
    const res = await fetch(`/api/cases/${caseFile.id}`, { cache: "no-store" });
    if (res.ok) setCaseFile(await res.json());
  }

  // Finalise
  async function finalise() {
    if (!caseFile) return;
    const result = await handleFinaliseCase(caseFile.id);
    if (result.error) setError(result.error);
    else {
      const res = await fetch(`/api/cases/${caseFile.id}`, { cache: "no-store" });
      if (res.ok) setCaseFile(await res.json());
    }
  }

  const manifest = caseFile?.manifest || [];
  const unresolved = manifest.filter((i) => i.status === "review").length;
  const isFinalised = caseFile?.status === "finalised";

  return (
    <main style={{ minHeight: "100vh", background: "#1a1a1a", color: "white" }}>
      <AppHeader />
      <div style={{ display: "grid", gridTemplateColumns: cameraActive ? "1.2fr 0.8fr" : "1fr", minHeight: "calc(100vh - 65px)" }}>
        {/* Camera / Guide panel */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", background: "#111" }}>
          {showGuide && !cameraActive && (
            <div style={{ maxWidth: "500px", width: "100%" }}>
              <h1 style={{ fontSize: "1.8rem", margin: "0 0 16px", textAlign: "center" }}>Kiosk Intake</h1>
              <p style={{ textAlign: "center", color: "#999", marginBottom: "24px", fontSize: "0.9rem" }}>
                Point the camera at items laid out on the scanning surface.
              </p>
              <div style={{ background: "#222", borderRadius: "12px", padding: "4px" }}>
                <LayoutGuide defaultOpen={true} />
              </div>
              <button
                type="button"
                className="button"
                onClick={startCamera}
                style={{ width: "100%", marginTop: "20px", minHeight: "56px", fontSize: "1rem" }}
              >
                Start Camera
              </button>
            </div>
          )}

          {cameraActive && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "8px" }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Capture button */}
              <div style={{ position: "absolute", bottom: "24px", display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={captureFrame}
                  disabled={isCapturing}
                  style={{
                    minWidth: "96px",
                    height: "72px",
                    borderRadius: "10px",
                    border: "1px solid white",
                    background: isCapturing ? "#666" : "rgba(255,255,255,0.2)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                  }}
                >
                  Capture
                </button>
                {photoCount > 0 && (
                  <button
                    type="button"
                    onClick={runScan}
                    disabled={isScanning}
                    className="button"
                    style={{ minHeight: "44px" }}
                  >
                    {isScanning ? "Scanning..." : `Scan ${photoCount} photo${photoCount === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>

              {/* Guide toggle */}
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.6)", border: "none", color: "white", padding: "6px 10px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
              >
                Layout Guide
              </button>

              {showGuide && (
                <div style={{ position: "absolute", top: "44px", right: "12px", width: "300px", background: "#222", borderRadius: "8px", overflow: "hidden" }}>
                  <LayoutGuide defaultOpen={true} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Items panel (right side when camera is active) */}
        {cameraActive && (
          <div style={{ background: "#1e1e1e", borderLeft: "1px solid #333", padding: "20px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Items Found</h2>
              {unresolved > 0 && (
                <span style={{ fontSize: "0.72rem", background: "#fff3cd", color: "#856404", padding: "3px 8px", borderRadius: "4px" }}>
                  {unresolved} need review
                </span>
              )}
            </div>

            {manifest.length === 0 && (
              <p style={{ color: "#888", fontSize: "0.85rem" }}>Capture photos and scan to see items here.</p>
            )}

            <div style={{ display: "grid", gap: "0" }}>
              {manifest.map((item) => (
                <div key={item.id} style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #333",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{item.label}</div>
                    {item.itemType === "currency" && item.currencyCode && (
                      <div style={{ fontSize: "0.75rem", color: "#4caf50", fontFamily: "monospace" }}>
                        {item.currencyCode} {item.currencyTotal ? formatDecimal(item.currencyTotal) : "-"}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: item.status === "confirmed" ? "#4caf50" : "#ffc107" }}>
                    {item.status === "confirmed" ? "Confirmed" : hasFirstStaffCheck(item) ? "First Check Complete" : "Review"}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            {manifest.length > 0 && !isFinalised && (
              <div style={{ marginTop: "20px", display: "grid", gap: "8px" }}>
                {unresolved > 0 && (
                  <button type="button" className="button" onClick={confirmAll} style={{ width: "100%", minHeight: "40px", fontSize: "0.82rem" }}>
                    Run Staff Checks ({unresolved})
                  </button>
                )}
                {unresolved === 0 && (
                  <button type="button" className="button" onClick={finalise} style={{ width: "100%", minHeight: "40px", fontSize: "0.82rem", background: "var(--green-dark)" }}>
                    Complete Case
                  </button>
                )}
              </div>
            )}

            {isFinalised && (
              <div style={{ marginTop: "20px", padding: "14px", background: "#1b5e20", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "1rem", marginBottom: "4px" }}>Case Completed</div>
                <div style={{ fontSize: "0.75rem", color: "#a5d6a7" }}>{caseFile?.id}</div>
              </div>
            )}

            {error && (
              <div style={{ marginTop: "12px", padding: "10px", background: "#4a1010", borderRadius: "8px", fontSize: "0.8rem", color: "#fca5a5" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
