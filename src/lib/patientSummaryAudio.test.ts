import { describe, expect, it } from "vitest";
import {
  buildPatientSummarySpokenScript,
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
});
