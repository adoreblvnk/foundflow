"use client";

import { useMemo, useState } from "react";
import type { EvidenceUpload, ImageRegion, ManifestItem } from "@/lib/db";

interface Props {
  uploads: EvidenceUpload[];
  items: ManifestItem[];
  selectedItemId: string | null;
  readOnly: boolean;
  onSelectItem: (itemId: string) => void;
  onUpdateItem: (item: ManifestItem) => Promise<void>;
  onReassignRegion: (regionId: string, targetItemId: string) => Promise<void>;
}

interface Point { x: number; y: number }

function regionPosition(region: ImageRegion): React.CSSProperties {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

export function RegionCrops({ item, selected, onSelect }: { item: ManifestItem; selected: boolean; onSelect: () => void }) {
  if (!item.evidenceId || !item.regions?.length) return null;
  return (
    <button type="button" className={selected ? "region-crops selected" : "region-crops"} onClick={onSelect} aria-label={`Show ${item.label} on source photo`}>
      {item.regions.slice(0, 6).map((region) => {
        const horizontal = region.width >= 1 ? 0 : (region.x / (1 - region.width)) * 100;
        const vertical = region.height >= 1 ? 0 : (region.y / (1 - region.height)) * 100;
        return (
          <span
            key={region.id}
            className="region-crop"
            style={{
              backgroundImage: `url(/api/uploads/${item.evidenceId})`,
              backgroundSize: `${100 / region.width}% ${100 / region.height}%`,
              backgroundPosition: `${horizontal}% ${vertical}%`,
            }}
          />
        );
      })}
      <small>{item.regions.length} region{item.regions.length === 1 ? "" : "s"}</small>
    </button>
  );
}

export default function PhotoRegionVerifier({ uploads, items, selectedItemId, readOnly, onSelectItem, onUpdateItem, onReassignRegion }: Props) {
  const [manualUploadId, setManualUploadId] = useState(uploads[0]?.id ?? null);
  const [drawMode, setDrawMode] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<ImageRegion | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedUploadId = selectedItem?.evidenceId && uploads.some((upload) => upload.id === selectedItem.evidenceId)
    ? selectedItem.evidenceId
    : null;
  const activeUploadId = selectedUploadId
    ?? (uploads.some((upload) => upload.id === manualUploadId) ? manualUploadId : uploads[0]?.id)
    ?? null;

  const visibleRegions = useMemo(() => items.flatMap((item) =>
    item.evidenceId === activeUploadId
      ? (item.regions || []).map((region, index) => ({ item, region, index }))
      : []
  ), [activeUploadId, items]);
  const expectedInstances = items
    .filter((item) => item.evidenceId === activeUploadId)
    .reduce((total, item) => total + (item.quantityKnown === false ? Math.max(1, item.regions?.length ?? 0) : item.quantity), 0);
  const selectedRegionOwner = items.find((item) => item.regions?.some((region) => region.id === selectedRegionId)) ?? null;
  const compatibleItems = selectedRegionOwner
    ? items.filter((item) => item.evidenceId === selectedRegionOwner.evidenceId)
    : [];

  function pointFromEvent(event: React.PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function beginDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawMode || !selectedItem || readOnly || !activeUploadId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setStart(point);
    setDraft({ id: "draft", x: point.x, y: point.y, width: 0.001, height: 0.001 });
  }

  function moveDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!start || !drawMode) return;
    const point = pointFromEvent(event);
    setDraft({
      id: "draft",
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  async function finishDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!start || !draft || !selectedItem || !activeUploadId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setStart(null);
    setDraft(null);
    setDrawMode(false);
    if (draft.width < 0.01 || draft.height < 0.01) return;
    await onUpdateItem({
      ...selectedItem,
      evidenceId: activeUploadId,
      regions: [...(selectedItem.regions || []), { ...draft, id: `region-${crypto.randomUUID()}` }],
      status: "review",
      reviewReason: "Photo regions changed and require staff confirmation",
    });
  }

  async function removeSelectedRegion() {
    if (!selectedRegionOwner || !selectedRegionId) return;
    await onUpdateItem({
      ...selectedRegionOwner,
      regions: (selectedRegionOwner.regions || []).filter((region) => region.id !== selectedRegionId),
      status: "review",
      reviewReason: "Photo regions changed and require staff confirmation",
    });
    setSelectedRegionId(null);
  }

  if (uploads.length === 0) return null;

  return (
    <section className="region-verifier" aria-labelledby="region-verifier-title">
      <div className="region-verifier-heading">
        <div>
          <p className="eyebrow">Visual verification</p>
          <strong id="region-verifier-title">Match records to the photo</strong>
        </div>
        {!readOnly && (
          <button
            type="button"
            className={drawMode ? "button region-draw active" : "button button-secondary region-draw"}
            disabled={!selectedItem}
            onClick={() => setDrawMode((value) => !value)}
          >
            {drawMode ? "Cancel drawing" : "+ Draw region"}
          </button>
        )}
      </div>
      <p className="muted region-help">
        {readOnly ? "Reviewed source boxes." : "Select a row. Draw one box per object."}
      </p>
      <div className={visibleRegions.length === expectedInstances ? "region-coverage complete" : "region-coverage incomplete"} role="status">
        <strong>{visibleRegions.length}/{expectedInstances} listed objects boxed</strong>
        <span>{visibleRegions.length === expectedInstances ? "Check for missed objects." : `${Math.max(0, expectedInstances - visibleRegions.length)} box${expectedInstances - visibleRegions.length === 1 ? "" : "es"} missing.`}</span>
      </div>

      {uploads.length > 1 && (
        <div className="region-photo-tabs" aria-label="Source photos">
          {uploads.map((upload, index) => (
            <button key={upload.id} type="button" className={activeUploadId === upload.id ? "active" : ""} onClick={() => { setManualUploadId(upload.id); onSelectItem(""); }}>
              Photo {index + 1}
            </button>
          ))}
        </div>
      )}

      <div
        className={drawMode ? "region-photo drawing" : "region-photo"}
        onPointerDown={beginDraw}
        onPointerMove={moveDraw}
        onPointerUp={(event) => { void finishDraw(event); }}
      >
        {/* Authenticated evidence is intentionally served directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/uploads/${activeUploadId}`} alt="Source evidence with detected item regions" draggable={false} />
        {visibleRegions.map(({ item, region, index }, visibleIndex) => {
          const selected = item.id === selectedItemId || region.id === selectedRegionId;
          return (
            <button
              type="button"
              key={region.id}
              className={`photo-region ${selected ? "selected" : ""} ${item.status === "review" ? "uncertain" : ""} ${item.id === "outer-item-root" ? "outer" : ""}`}
              style={regionPosition(region)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => { onSelectItem(item.id); setSelectedRegionId(region.id); }}
              aria-label={`${item.label}, region ${index + 1}`}
              title={`${item.label} · region ${index + 1}`}
            >
              <span>{visibleIndex + 1}</span>
            </button>
          );
        })}
        {draft && <span className="photo-region draft" style={regionPosition(draft)} />}
      </div>

      {selectedRegionOwner && selectedRegionId && !readOnly && (
        <div className="region-tools">
          <strong>{selectedRegionOwner.label}</strong>
          <label>
            Assign box to
            <select value={selectedRegionOwner.id} onChange={(event) => { void onReassignRegion(selectedRegionId, event.target.value); setSelectedRegionId(null); }}>
              {compatibleItems.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" className="text-link" onClick={() => { void removeSelectedRegion(); }}>Remove box</button>
        </div>
      )}
    </section>
  );
}
