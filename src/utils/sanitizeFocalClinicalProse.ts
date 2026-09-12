/**
 * Strip AI/screen-method leakage from Focal cutaway clinical text boxes.
 * Keeps anatomy (eje, cuadrante, lateral/medial) but removes viewer/image placement notes.
 */
export function sanitizeFocalClinicalProse(text: string): string {
  let s = String(text || "").trim();
  if (!s) return "";

  s = s.replace(
    /\s*[\(\[\{][^)\]\}]{0,240}?(?:derecha|izquierda|mitad)?[^)\]\}]{0,100}?(?:de\s+la\s+imagen|del\s+cuadro|del\s+frame|viewer|observador|respecto\s+al\s+pez[oó]n|proyecci[oó]n\s+anterior|manecillas|clock[- ]?hands|VIEWER'?S?\s+(?:LEFT|RIGHT)|mitad\s+(?:derecha|izquierda)\s+de\s+la\s+mama\s+en)[^)\]\}]{0,140}?[\)\]\}]/giu,
    ""
  );

  const inlinePatterns = [
    /\s*[,:;–—-]?\s*a\s+la\s+(?:derecha|izquierda)\s+de\s+la\s+imagen(?:\s+respecto\s+al\s+pez[oó]n)?(?:\s+en\s+proyecci[oó]n\s+anterior)?/giu,
    /\s*[,:;–—-]?\s*(?:en\s+)?(?:la\s+)?mitad\s+(?:derecha|izquierda)\s+de\s+la\s+(?:mama|lesi[oó]n)\s+en\s+(?:la\s+)?imagen/giu,
    /\s*[,:;–—-]?\s*(?:viewer'?s?\s+)?(?:left|right)\s+of\s+(?:the\s+)?(?:nipple|frame|image)/giu,
    /\s*[,:;–—-]?\s*seg[uú]n\s+(?:el\s+)?(?:mapa\s+de\s+)?manecillas(?:\s+(?:id[eé]nticas|del\s+reloj))?/giu,
    /\s*[,:;–—-]?\s*(?:con\s+)?reloj\s+con\s+manecillas\s+id[eé]nticas/giu,
    /\s*[,:;–—-]?\s*como\s+se\s+ve\s+en\s+la\s+(?:reconstrucci[oó]n|imagen)\s*3?D?/giu,
  ];
  for (const re of inlinePatterns) {
    s = s.replace(re, "");
  }

  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\.\s*\./g, ".")
    .trim();
}
