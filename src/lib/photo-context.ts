export const PHOTO_CONTEXT_VALUES = ["loose-item", "outer-item", "bag-contents", "inner-container"] as const;

export type PhotoContext = typeof PHOTO_CONTEXT_VALUES[number];

export const PHOTO_CONTEXT_OPTIONS: ReadonlyArray<{ value: PhotoContext; label: string }> = [
  { value: "loose-item", label: "Loose / standalone item (no container)" },
  { value: "outer-item", label: "Outer item or container" },
  { value: "bag-contents", label: "Contents inside outer container" },
  { value: "inner-container", label: "Contents inside inner container" },
];

export function formatPhotoContext(value?: string | null): string {
  if (!value) return "Not specified";
  return PHOTO_CONTEXT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
