import { describe, expect, it } from "vitest";
import {
  buildPatientAudioFilename,
  buildPatientSummarySpokenScript,
  ensureSpokenScriptKeepsPathology,
  expandRomanNumeralsForSpeech,
  filterSpokenSentences,
  isFollowUpLikeSentence,
  isPathologyHeavySentence,
  listPathologyAnchorsFromText,
  reconcileSpokenScriptWithFindings,
  scriptMentionsFindingLabel,
} from "./patientSummaryAudio";

describe("patientSummaryAudio", () => {
  it("names the MP3 with patient name + audio", () => {
    expect(buildPatientAudioFilename("María López")).toBe("Maria_Lopez_audio.mp3");
    expect(buildPatientAudioFilename("  Juan  ")).toBe("Juan_audio.mp3");
    expect(buildPatientAudioFilename("")).toBe("paciente_audio.mp3");
    expect(buildPatientAudioFilename(null)).toBe("paciente_audio.mp3");
  });

  it("flags follow-up / treatment sentences", () => {
    expect(isFollowUpLikeSentence("Se recomienda control en 6 meses.")).toBe(true);
    expect(isFollowUpLikeSentence("Se recomienda control.")).toBe(true);
    expect(isFollowUpLikeSentence("Se sugiere control.")).toBe(true);
    // Diagnostic "sugiere" must NOT be treated as advice
    expect(
      isFollowUpLikeSentence(
        "También se observó bursitis, lo que sugiere un pinzamiento subacromial."
      )
    ).toBe(false);
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

  it("shortens Qué estudio and keeps bursitis from En pocas palabras", () => {
    const summary = {
      studyOverview:
        "Se realizó un ultrasonido del hombro derecho para evaluar la articulación y los tejidos circundantes después de un trauma. Este estudio utiliza ondas sonoras para crear imágenes detalladas de los músculos, tendones y otras estructuras del hombro. Permite identificar cambios en los tejidos blandos.",
      summary:
        "El ultrasonido del hombro derecho mostró que el tendón del bíceps y otros tendones del manguito rotador están en condiciones normales. Sin embargo, el tendón supraespinoso presenta calcificaciones, lo que indica una tendinopatía calcificante. También se observó bursitis en la bursa subacromiodeltoidea, lo que sugiere un pinzamiento subacromial. Además, se identificó una fractura de Hill-Sachs en la cabeza del húmero.",
    };
    const script = buildPatientSummarySpokenScript(summary, { includeFollowUp: false });
    expect(script.toLowerCase()).toContain("bursitis");
    expect(script.toLowerCase()).toMatch(/tendinopat|calcific/);
    expect(script.toLowerCase()).toMatch(/hill|fractura/);
    expect(script.toLowerCase()).toMatch(/pinzamiento/);
    // Must not spend the audio explaining ultrasound physics
    expect(script.toLowerCase()).not.toContain("ondas sonoras");
    expect(script.toLowerCase()).not.toContain("permite identificar cambios");

    const incompleteAi =
      "Hola. Se realizó un ultrasonido del hombro derecho para evaluar la articulación tras un trauma. El manguito rotador está en condiciones normales y hay calcificaciones en el supraespinoso. El informe queda con su médico.";
    const { script: fixed } = ensureSpokenScriptKeepsPathology(incompleteAi, summary, {
      includeFollowUp: false,
    });
    expect(fixed.toLowerCase()).toContain("bursitis");
  });

  it("keeps nefropatía / riñones when AI omits them from En pocas palabras", () => {
    const summary = {
      studyOverview: "Se realizó ecografía de abdomen.",
      summary:
        "El hígado muestra esteatosis leve. Hay signos de nefropatía crónica en ambos riñones, con disminución del tamaño y aumento de la ecogenicidad. Se recomienda control nefrológico.",
      keyFindings: [],
    };
    const incompleteAi =
      "Hola. Se realizó ecografía de abdomen. El hígado muestra esteatosis leve. El informe queda con su médico tratante.";
    expect(listPathologyAnchorsFromText(summary.summary)).toEqual(
      expect.arrayContaining(["nefropatia", "rinones"])
    );
    expect(isPathologyHeavySentence("Hay signos de nefropatía crónica en ambos riñones.")).toBe(
      true
    );
    const { script, usedLocalFallback, appendedSentences } = ensureSpokenScriptKeepsPathology(
      incompleteAi,
      summary,
      { includeFollowUp: false }
    );
    expect(usedLocalFallback || appendedSentences > 0).toBe(true);
    expect(script.toLowerCase()).toMatch(/nefropat|ri[nñ]on/);
    expect(script.toLowerCase()).not.toMatch(/recomend|control nefrol/);
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
    expect(script.toLowerCase()).toContain("ovario");
    expect(script.toLowerCase()).toContain("quística");
    expect(script.toLowerCase()).not.toMatch(/recomend|control en 6/);
    expect(script.toLowerCase()).not.toContain("detalle de ficha");
    expect(script.toLowerCase()).toMatch(/prioriza los hallazgos|explicación escrita/);
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
