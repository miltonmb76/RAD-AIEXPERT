/**
 * Make dynamic clinical text safe for jsPDF Helvetica (WinAnsi).
 * Characters like ≥ / ≤ break glyph widths and produce letter-spaced garbage
 * (e.g. "leve (≥ 2.5 mm)" → "leve ("e 2.5 mm)" with huge kerning).
 * Preserves Spanish Latin-1 accents (áéíóúñ…).
 */
export function sanitizePdfText(input: string): string {
  if (input == null) return "";
  let s = String(input);

  s = s
    .replace(/\u2264|\u2A7D|\u2266/g, "<=") // ≤ ⩽ ≦
    .replace(/\u2265|\u2A7E|\u2267/g, ">=") // ≥ ⩾ ≧
    .replace(/\u2260/g, "!=") // ≠
    .replace(/\u00B1|\u2213/g, "+/-") // ± ∓
    .replace(/\u2248|\u223C/g, "~") // ≈ ∼
    .replace(/\u2192|\u21D2/g, "->") // → ⇒
    .replace(/\u2190|\u21D0/g, "<-") // ← ⇐
    .replace(/\u2194/g, "<->") // ↔
    .replace(/\u2013|\u2014|\u2212/g, "-") // – — −
    .replace(/\u00D7|\u2715|\u2716/g, "x") // × ✕ ✖
    .replace(/\u00F7/g, "/") // ÷
    .replace(/\u03BC/g, "u") // Greek mu (Latin-1 µ U+00B5 is OK)
    .replace(/\u2026/g, "...")
    .replace(/\u2022|\u25CF|\u25E6|\u2219/g, "-") // • ● ◦ ∙ (outside Latin-1)
    .replace(/[\u201C\u201D]/g, '"') // “ ”
    .replace(/[\u2018\u2019]/g, "'") // ‘ ’
    .replace(/\u00A0/g, " ") // nbsp
    // Mojibake of UTF-8 ≤ / ≥ / ± when decoded as Latin-1/Windows-1252
    .replace(/\u00E2\u2030\u00A4/g, "<=")
    .replace(/\u00E2\u2030\u00A5/g, ">=")
    .replace(/\u00C2\u00B1/g, "+/-")
    .replace(/Ã¢â€°Â¤/g, "<=")
    .replace(/Ã¢â€°Â¥/g, ">=")
    .replace(/â‰¤/g, "<=")
    .replace(/â‰¥/g, ">=");

  // Drop remaining non-Latin-1 codepoints (outside Helvetica WinAnsi), keeping accents.
  s = s.replace(/[^\u0000-\u00FF]/g, (ch) => {
    try {
      const n = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (n && /^[\u0000-\u00FF]+$/.test(n)) return n;
    } catch {
      /* ignore */
    }
    return "";
  });

  return s.replace(/[ \t]{2,}/g, " ").trim();
}
