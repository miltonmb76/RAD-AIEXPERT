import { describe, expect, it } from "vitest";
import {
  buildPatientSummarySpokenScript,
  expandRomanNumeralsForSpeech,
  filterSpokenSentences,
  isFollowUpLikeSentence,
  reconcileSpokenScriptWithFindings,
  scriptMentionsFindingLabel,
} from "./patientSummaryAudio";

describe("patientSummaryAudio", () => {
  it("flags follow-up / treatment sentences", () => {
    expect(isFollowUpLikeSentence("Se recomienda control en 6 meses.")).toBe(true);
    expect(isFollowUpLikeSentence("Se recomienda control.")).toBe(true);
    expect(isFollowUpLikeSentence("Se sugiere control.")).toBe(true);
    expect(isFollowUpLikeSentence("Hay un nódulo sólido de 8 mm en mama derecha.")).toBe(
      false
    );
  });

  it("strips recommendations by default but keeps finding text", () => {
    const out = filterSpokenSentences(
      "Hay un nódulo de 8 mm. Se sugiere biopsia. Categoría BI-RADS 4.",
      false
    );
    expect(out.toLowerCase()).toContain("nódulo");
    expect(out.toLowerCase()).not.toContain("biopsia");
    expect(out.toLowerCase()).toContain("bi-rads");
    const sugiere = filterSpokenSentences(
      "Lesión quística de 3 cm. Se sugiere control.",
      false
    );
    expect(sugiere.toLowerCase()).toContain("quística");
    expect(sugiere.toLowerCase()).not.toMatch(/sugiere|control/);
  });

  it("builds a script without follow-up unless opted in", () => {
    const script = buildPatientSummarySpokenScript(
      {
        studyOverview: "Se realizó ecografía de mama.",
        summary: "Se identificó un nódulo. Se recomienda control en 6 meses.",
        keyFindings: [
          {
            title: "Nódulo mamario",
            simplifiedExplanation: "Es una pequeña lesión sólida.",
          },
        ],
      },
      { includeFollowUp: false }
    );
    expect(script.toLowerCase()).toContain("ecografía");
    expect(script.toLowerCase()).toContain("nódulo");
    expect(script.toLowerCase()).not.toMatch(/recomiend|control en 6/);
    expect(script.toLowerCase()).toContain("médico tratante");
    // Uses overview + summary, not the finding cards
    expect(script.toLowerCase()).not.toContain("sobre nódulo mamario");

    const withFollow = buildPatientSummarySpokenScript(
      {
        studyOverview: "Se realizó ecografía de mama.",
        summary: "Se identificó un nódulo.",
        keyFindings: [],
      },
      {
        includeFollowUp: true,
        followUpText: "BI-RADS 3: control ecográfico en 6 meses.",
      }
    );
    expect(withFollow.toLowerCase()).toContain("seguimiento");
    expect(withFollow.toLowerCase()).toContain("bi-rads");
  });

  it("narrates the first 2 PDF sections (studyOverview + summary)", () => {
    const script = buildPatientSummarySpokenScript(
      {
        studyOverview:
          "Se le realizó una ecografía de abdomen y pelvis para evaluar órganos abdominales y anexos.",
        summary:
          "El hígado y los riñones se ven sin alteraciones relevantes. En el ovario izquierdo hay una lesión quística de 3 cm. Se recomienda control en 6 meses.",
        keyFindings: [
          {
            title: "Hígado",
            simplifiedExplanation: "Parénquima homogéneo — detalle de ficha que el audio no debe priorizar.",
          },
          {
            title: "Ovario izquierdo",
            simplifiedExplanation: "Detalle de ficha omitible si ya está en En pocas palabras.",
          },
        ],
      },
      { includeFollowUp: false, maxWords: 300 }
    );
    expect(script.toLowerCase()).toContain("abdomen");
    expect(script.toLowerCase()).toContain("hígado");
    expect(script.toLowerCase()).toContain("riñones");
    expect(script.toLowerCase()).toContain("ovario");
    expect(script.toLowerCase()).toContain("quística");
    expect(script.toLowerCase()).not.toMatch(/recomend|control en 6/);
    expect(script.toLowerCase()).not.toContain("detalle de ficha");
    expect(script.toLowerCase()).toContain("dos primeras secciones");
  });

  it("falls back to keyFindings only when En pocas palabras is empty", () => {
    const script = buildPatientSummarySpokenScript(
      {
        studyOverview: "Ecografía de abdomen y pelvis.",
        summary: "",
        keyFindings: [
          { title: "Ovario izquierdo", simplifiedExplanation: "Lesión quística de 3 cm." },
        ],
      },
      { includeFollowUp: false }
    );
    expect(script.toLowerCase()).toContain("ovario");
    expect(script.toLowerCase()).toContain("quística");
  });

  it("can optionally append missing finding cards", () => {
    const summary = {
      studyOverview: "Ecografía de abdomen y pelvis.",
      summary: "Hallazgos abdominales.",
      keyFindings: [
        { title: "Riñón derecho", simplifiedExplanation: "Sin litiasis." },
        { title: "Ovario izquierdo", simplifiedExplanation: "Lesión quística de 3 cm." },
      ],
    };
    const incomplete =
      "Hola. Se evaluó el abdomen. Sobre Riñón derecho: Sin litiasis. El informe queda con su médico.";
    expect(scriptMentionsFindingLabel(incomplete, "Ovario izquierdo")).toBe(false);
    const { script, appended } = reconcileSpokenScriptWithFindings(incomplete, summary, {
      includeFollowUp: false,
      appendMissingFindings: true,
    });
    expect(appended).toBeGreaterThan(0);
    expect(script.toLowerCase()).toContain("ovario");
  });

  it("expands Roman numerals so TTS does not say letter i", () => {
    expect(expandRomanNumeralsForSpeech("Fibrosis Grado I.")).toBe(
      "Fibrosis Grado uno."
    );
    expect(expandRomanNumeralsForSpeech("estadio II a III")).toMatch(
      /estadio dos a tres/i
    );
    expect(expandRomanNumeralsForSpeech("tipo IV")).toMatch(/tipo cuatro/i);
    expect(expandRomanNumeralsForSpeech("Grado I-II")).toMatch(
      /Grado uno a dos/i
    );

    const script = buildPatientSummarySpokenScript(
      {
        studyOverview: "Ecografía hepática.",
        summary: "Cambios compatibles con fibrosis Grado I y patrón de fibrosis grado II.",
        keyFindings: [],
      },
      { includeFollowUp: false, maxWords: 140 }
    );
    expect(script).toMatch(/grado uno/i);
    expect(script).toMatch(/grado dos/i);
    expect(script).not.toMatch(/\bGrado I\b/);
    expect(script).not.toMatch(/\bgrado II\b/);
  });
});
