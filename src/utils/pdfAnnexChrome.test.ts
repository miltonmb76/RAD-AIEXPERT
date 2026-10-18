import { describe, expect, it } from "vitest";
import { fitPdfTextToWidth } from "./pdfAnnexChrome";

describe("fitPdfTextToWidth", () => {
  const fakeDoc = {
    getTextWidth: (s: string) => String(s || "").length * 2,
  };

  it("returns short text unchanged", () => {
    expect(fitPdfTextToWidth(fakeDoc, "ANEXO: PACK", 100)).toBe("ANEXO: PACK");
  });

  it("ellipsizes when wider than maxWidth", () => {
    const out = fitPdfTextToWidth(
      fakeDoc,
      "ANEXO: PACK DE JUSTIFICACION DIAGNOSTICA MUY LARGO",
      20
    );
    expect(out.endsWith("…")).toBe(true);
    expect(fakeDoc.getTextWidth(out)).toBeLessThanOrEqual(20);
  });

  it("handles empty", () => {
    expect(fitPdfTextToWidth(fakeDoc, "", 40)).toBe("");
  });
});
