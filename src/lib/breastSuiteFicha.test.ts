import { describe, expect, it } from "vitest";
import {
  ensureBreastSuiteFichaFields,
  remapPanelLetterLabels,
} from "./breastSuiteFicha";

describe("ensureBreastSuiteFichaFields", () => {
  it("fills empty ficha from lesion table, panels and synthesis", () => {
    const out = ensureBreastSuiteFichaFields({
      breastSummary: "",
      morphologyNotes: "",
      axillaryStatus: "",
      keyPoints: [],
      morphologicalSynthesis:
        "Galactocele dominante en mama izquierda. Axila sin adenopatías sospechosas.",
      panels: [
        {
          panelLetter: "A",
          panelTitle: "Panel A: Corte macro del galactocele",
          anatomicalFocus:
            "Formación quística complicada por contenido espeso (galactocele) en mama izquierda.",
          panelRole: "lesion",
        },
        {
          panelLetter: "B",
          panelTitle: "Panel B: Región axilar izquierda",
          anatomicalFocus:
            "Ganglios axilares ipsilateral de morfología oval normal.",
          panelRole: "axilla",
        },
      ],
      lesionTable: [
        {
          location: "Mama izquierda, 3h",
          size: "18 x 10 mm",
          composition: "Quística complicada",
          biradsCategory: "BI-RADS 3",
          clinicalImpact: "Seguimiento",
        },
      ],
    } as any);

    expect(out.breastSummary).toMatch(/Galactocele|mama izquierda/i);
    expect(out.morphologyNotes).toMatch(/quística|galactocele/i);
    expect(out.axillaryStatus).toMatch(/Ganglios|axil/i);
    expect(out.keyPoints.length).toBeGreaterThan(0);
    expect(out.keyPoints[0]).toMatch(/Mama izquierda|BI-RADS/i);
  });

  it("keeps non-empty ficha fields untouched", () => {
    const out = ensureBreastSuiteFichaFields({
      breastSummary: "Resumen real",
      morphologyNotes: "Morfología real",
      axillaryStatus: "Axila real",
      keyPoints: ["Punto 1"],
      morphologicalSynthesis: "Otro texto",
    });
    expect(out.breastSummary).toBe("Resumen real");
    expect(out.morphologyNotes).toBe("Morfología real");
    expect(out.axillaryStatus).toBe("Axila real");
    expect(out.keyPoints).toEqual(["Punto 1"]);
  });
});

describe("remapPanelLetterLabels", () => {
  it("renumbers Panel B/C labels when A was deleted (B→A, C→B)", () => {
    const map = { B: "A", C: "B" };
    expect(remapPanelLetterLabels("Panel B: Corte macro", map)).toBe(
      "Panel A: Corte macro"
    );
    expect(remapPanelLetterLabels("Panel C: Región axilar", map)).toBe(
      "Panel B: Región axilar"
    );
  });
});
