/**
 * PDF annexes must never show the English word "cutaway".
 * Map every casing to the Spanish label "corte".
 */
export function pdfCutawayToCorte(text: string): string {
  return String(text || "")
    .replace(/\bCUTAWAY\b/g, "CORTE")
    .replace(/\bCutaway\b/g, "Corte")
    .replace(/\bcutaway\b/g, "corte");
}
