/** Shared PDF text/drawing helpers extracted from App.tsx */

export function stripEmojisForPdf(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
}

export function fitLogoHeight(
  dims: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
  fallback: number
): number {
  if (dims.width && dims.height) {
    const aspect = dims.width / dims.height;
    return aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
  }
  return fallback;
}
