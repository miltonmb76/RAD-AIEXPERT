import { sanitizePdfText } from "./sanitizePdfText";

/**
 * PDF annexes must never show the English word "cutaway".
 * Map every casing to the Spanish label "corte", then scrub Helvetica-unsafe glyphs.
 */
export function pdfCutawayToCorte(text: string): string {
  return sanitizePdfText(
    String(text || "")
      .replace(/\bCUTAWAY\b/g, "CORTE")
      .replace(/\bCutaway\b/g, "Corte")
      .replace(/\bcutaway\b/g, "corte")
  );
}

/** Dynamic annex copy: Unicode-safe for jsPDF Helvetica (preserves Spanish accents). */
export function prepareAnnexPdfText(text: string): string {
  return sanitizePdfText(String(text || ""));
}
