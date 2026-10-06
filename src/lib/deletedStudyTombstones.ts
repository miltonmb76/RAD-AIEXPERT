/** Persisted IDs of studies the user deleted, so sync/boot cannot resurrect them. */

const STORAGE_KEY = "rad_deleted_study_ids";
const MAX_TOMBSTONES = 500;

function readRaw(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [];
  } catch {
    return [];
  }
}

function writeRaw(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_TOMBSTONES)));
  } catch (e) {
    console.warn("[tombstones] No se pudo guardar IDs eliminados:", e);
  }
}

export function getDeletedStudyIds(): Set<string> {
  return new Set(readRaw());
}

export function isStudyDeleted(id: string): boolean {
  if (!id) return false;
  return getDeletedStudyIds().has(id);
}

/** Mark one or many study IDs as intentionally deleted. */
export function markStudiesDeleted(ids: Iterable<string>): void {
  const next = getDeletedStudyIds();
  let changed = false;
  for (const id of ids) {
    if (!id || next.has(id)) continue;
    next.add(id);
    changed = true;
  }
  if (changed) {
    // Newest deletions first so oldest drop when capping
    writeRaw([...next].reverse());
  }
}

/** If the user saves/reopens the same id, allow it again. */
export function unmarkStudyDeleted(id: string): void {
  if (!id) return;
  const next = getDeletedStudyIds();
  if (!next.delete(id)) return;
  writeRaw([...next]);
}

export function clearDeletedStudyIds(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop tombstoned studies from any list. */
export function filterOutDeletedStudies<T extends { id: string }>(items: T[]): T[] {
  const deleted = getDeletedStudyIds();
  if (deleted.size === 0) return items;
  return items.filter((item) => !deleted.has(item.id));
}
