import type { ManifestItem } from "./db.ts";

export interface LinkedInventoryRow {
  item: ManifestItem;
  depth: number;
  parentLabel: string | null;
}

export function buildLinkedInventoryRows(items: ManifestItem[]): LinkedInventoryRow[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string | null, ManifestItem[]>();

  for (const item of items) {
    const parentId = item.parentId && byId.has(item.parentId) ? item.parentId : null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(item);
    children.set(parentId, siblings);
  }

  const rows: LinkedInventoryRow[] = [];
  const visited = new Set<string>();

  function visit(item: ManifestItem, depth: number) {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    rows.push({
      item,
      depth,
      parentLabel: item.parentId ? byId.get(item.parentId)?.label ?? null : null,
    });
    for (const child of children.get(item.id) ?? []) visit(child, depth + 1);
  }

  const explicitRoot = items.find((item) => item.id === "outer-item-root");
  if (explicitRoot) visit(explicitRoot, 0);
  for (const root of children.get(null) ?? []) visit(root, 0);
  for (const item of items) visit(item, item.parentId ? 1 : 0);

  return rows;
}
