import { describe, expect, it } from "vitest";
import {
  buildPatientSummarySpokenScript,
  expandRomanNumeralsForSpeech,
  filterSpokenSentences,
  isFollowUpLikeSentence,
} from "./patientSummaryAudio";

describe("patientSummaryAudio", () => {
  it("flags follow-up / treatment sentences", () => {
    expect(isFollowUpLikeSentence("Se recomienda control en 6 meses.")).toBe(true);
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
  });

  it("builds a short script without follow-up unless opted in", () => {
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
      { includeFollowUp: false, maxWords: 120 }
    );
    expect(script.toLowerCase()).toContain("ecografía");
    expect(script.toLowerCase()).not.toMatch(/recomiend|control en 6/);
    expect(script.toLowerCase()).toContain("médico tratante");

    const withFollow = buildPatientSummarySpokenScript(
      {
        studyOverview: "Se realizó ecografía de mama.",
        summary: "Se identificó un nódulo.",
        keyFindings: [],
      },
      {
        includeFollowUp: true,
        followUpText: "BI-RADS 3: control ecográfico en 6 meses.",
        maxWords: 140,
      }
    );
    expect(withFollow.toLowerCase()).toContain("seguimiento");
    expect(withFollow.toLowerCase()).toContain("bi-rads");
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
        summary: "Cambios compatibles con fibrosis Grado I.",
        keyFindings: [
          {
            title: "Hígado",
            simplifiedExplanation: "Patrón de fibrosis grado II.",
          },
        ],
      },
      { includeFollowUp: false, maxWords: 140 }
    );
    expect(script).toMatch(/grado uno/i);
    expect(script).toMatch(/grado dos/i);
    expect(script).not.toMatch(/\bGrado I\b/);
    expect(script).not.toMatch(/\bgrado II\b/);
  });
});
