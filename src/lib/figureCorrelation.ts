/**
 * Helpers to order attached diagnostic images by first mention in the report
 * and to apply AI/local correlation results.
 */

export type CorrelatableImage = {
  id: string;
  caption?: string;
  name?: string;
  modality?: string;
  projection?: string;
  side?: string;
};

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type NeedleSet = { specific: string[]; generic: string[] };

function earliestIndex(haystack: string, needles: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const n of needles) {
    const q = n.trim();
    if (!q) continue;
    const i = haystack.indexOf(q);
    if (i >= 0 && i < best) best = i;
  }
  return best;
}

/** Prefer specific needles (CC/MLO/side) over generic "mamograf"/"ultrason". */
function bestMentionIndex(haystack: string, needles: NeedleSet): number {
  const specificAt = earliestIndex(haystack, needles.specific);
  if (Number.isFinite(specificAt)) return specificAt;
  return earliestIndex(haystack, needles.generic);
}

/** Build search needles that help locate an image's first mention in the report. */
export function mentionNeedlesForImage(img: CorrelatableImage): NeedleSet {
  const caption = normalize(img.caption || img.name || "");
  const modality = String(img.modality || "").toUpperCase();
  const projection = String(img.projection || "").toUpperCase();
  const side = normalize(img.side || "");
  const specific: string[] = [];
  const generic: string[] = [];

  if (modality === "MMG" || /mamograf|proyecciones? cran|proyecciones? medio lateral|\bcc\b|\bmlo\b/.test(caption)) {
    generic.push("mamograf", "mamograma");
    if (projection === "CC" || /\bcc\b|crane?o\s*caudal/.test(caption)) {
      specific.push("craneocaudal", "craneo caudal", "proyecciones crane");
    }
    if (projection === "MLO" || /\bmlo\b|medio\s*lateral/.test(caption)) {
      specific.push("mediolateral", "medio lateral", "oblicuas");
    }
  }

  if (modality === "US" || /ultrason|ecograf/.test(caption)) {
    generic.push("ultrason", "ecograf");
    if (/mama|mamari|cuadrante|reloj|axila/.test(caption)) {
      specific.push("ultrasonido de mama", "ecografia de mama", "ultrasonido mamario");
      if (side.includes("derech") || /derecha|derecho/.test(caption)) {
        specific.push("mama derecha", "cuadrante");
      }
      if (side.includes("izquier") || /izquierda|izquierdo/.test(caption)) {
        specific.push("mama izquierda");
      }
    }
  }

  // Distinctive caption tokens (skip stopwords) — treat as specific
  const stop = new Set([
    "de", "del", "la", "el", "los", "las", "y", "en", "con", "sin", "por", "para",
    "un", "una", "al", "se", "que", "no", "es", "mm", "cm", "ver", "figura", "imagen",
    "proyecciones", "proyeccion", "evidencia", "mostrando", "adecuada", "tejido",
  ]);
  for (const token of caption.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token.length < 5 || stop.has(token)) continue;
    specific.push(token);
  }

  if (side.includes("bilateral")) generic.push("bilateral");

  return { specific, generic };
}

/**
 * Sort images by first mention position in the report (top → bottom).
 * Unmatched images keep relative order at the end.
 */
export function sortImagesByReportMentionOrder<T extends CorrelatableImage>(
  images: T[],
  reportText: string
): T[] {
  const report = normalize(reportText);
  if (!report || images.length <= 1) return [...images];

  const scored = images.map((img, originalIndex) => {
    const needles = mentionNeedlesForImage(img);
    const mentionAt = bestMentionIndex(report, needles);
    return { img, originalIndex, mentionAt };
  });

  scored.sort((a, b) => {
    const aMiss = !Number.isFinite(a.mentionAt);
    const bMiss = !Number.isFinite(b.mentionAt);
    if (aMiss && bMiss) return a.originalIndex - b.originalIndex;
    if (aMiss) return 1;
    if (bMiss) return -1;
    if (a.mentionAt !== b.mentionAt) return a.mentionAt - b.mentionAt;
    return a.originalIndex - b.originalIndex;
  });

  return scored.map((s) => s.img);
}

/** Apply AI reorder ids; append any missing; fall back to mention-order sort. */
export function applyReorderedImageIds<T extends CorrelatableImage>(
  images: T[],
  reorderedImageIds: string[] | undefined | null,
  reportText: string
): T[] {
  if (!images.length) return images;

  if (Array.isArray(reorderedImageIds) && reorderedImageIds.length > 0) {
    const map = new Map(images.map((img) => [img.id, img]));
    const reordered: T[] = [];
    for (const id of reorderedImageIds) {
      const found = map.get(id);
      if (found) {
        reordered.push(found);
        map.delete(id);
      }
    }
    map.forEach((img) => reordered.push(img));
    if (reordered.length === images.length) return reordered;
  }

  return sortImagesByReportMentionOrder(images, reportText);
}
