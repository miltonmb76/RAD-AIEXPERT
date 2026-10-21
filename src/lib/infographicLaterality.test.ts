import { describe, expect, it } from "vitest";
import { buildLockedCopyPromptBlock } from "./infographicCopyPlan";
import {
  buildExtremityLateralityLandmarkBrief,
  buildInfographicLateralityPromptBlock,
  canvasSideForPatientSide,
  extractInfographicLaterality,
  mergeLateralityIntoCopyPlan,
  type InfographicLateralityExtract,
} from "./infographicLaterality";

describe("canvasSideForPatientSide", () => {
  it("AP: patient right → left of frame; patient left → right of frame", () => {
    expect(canvasSideForPatientSide("AP", "right")).toBe("left_of_frame");
    expect(canvasSideForPatientSide("AP", "left")).toBe("right_of_frame");
  });

  it("PA: patient side matches frame side (no mirror)", () => {
    expect(canvasSideForPatientSide("PA", "right")).toBe("right_of_frame");
    expect(canvasSideForPatientSide("PA", "left")).toBe("left_of_frame");
  });
});

describe("extractInfographicLaterality", () => {
  it("reads hombro izquierdo from report/title text", () => {
    const extracted = extractInfographicLaterality({
      studyType: "Ultrasonido de hombro",
      report:
        "Bursitis subacromiosubdeltoidea en hombro izquierdo con engrosamiento de 2.3 mm.",
    });
    expect(extracted.side).toBe("left");
    expect(extracted.mentions.some((m) => /hombro/i.test(m.structure))).toBe(true);
  });
});

describe("buildExtremityLateralityLandmarkBrief", () => {
  const leftShoulder: InfographicLateralityExtract = {
    side: "left",
    mentions: [{ structure: "hombro", side: "left", snippet: "hombro izquierdo" }],
    summary: "Lateralidad dominante: IZQUIERDO del paciente (hombro izquierdo).",
    source: "report",
  };

  it("left shoulder AP: arm/troquíter on RIGHT of frame; forbids right-silhouette + left title", () => {
    const brief = buildExtremityLateralityLandmarkBrief("AP", leftShoulder, "ultrasonido de hombro");
    expect(brief).toMatch(/HOMBRO IZQUIERDO/i);
    expect(brief).toMatch(/troquíter.*DERECHA del cuadro/i);
    expect(brief).toMatch(/Clavícula.*IZQUIERDA del cuadro/i);
    expect(brief).toMatch(/ESPEJA HORIZONTALMENTE/i);
    expect(brief).toMatch(/FALLO CRÍTICO.*hombro izquierdo/i);
  });

  it("uses contextText when extract only has study-field laterality", () => {
    const fieldOnly: InfographicLateralityExtract = {
      side: "left",
      mentions: [
        { structure: "estudio", side: "left", snippet: "Campo de lateralidad: Izquierdo" },
      ],
      summary: "Lateralidad dominante: IZQUIERDO del paciente (estudio izquierdo).",
      source: "study_field",
    };
    const brief = buildExtremityLateralityLandmarkBrief(
      "AP",
      fieldOnly,
      "Ecografía de hombro — bursitis subacromial"
    );
    expect(brief).toMatch(/HOMBRO IZQUIERDO/i);
    expect(brief).toMatch(/DERECHA del cuadro/i);
  });

  it("right shoulder AP: arm/troquíter on LEFT of frame", () => {
    const rightShoulder: InfographicLateralityExtract = {
      side: "right",
      mentions: [{ structure: "hombro", side: "right", snippet: "hombro derecho" }],
      summary: "Lateralidad dominante: DERECHO del paciente (hombro derecho).",
      source: "report",
    };
    const brief = buildExtremityLateralityLandmarkBrief("AP", rightShoulder);
    expect(brief).toMatch(/HOMBRO DERECHO/i);
    expect(brief).toMatch(/troquíter.*IZQUIERDA del cuadro/i);
  });
});

describe("buildInfographicLateralityPromptBlock", () => {
  it("AP block states patient-right = screen-left and includes shoulder landmarks", () => {
    const extracted = extractInfographicLaterality({
      studyLaterality: "Izquierdo",
      studyType: "US hombro",
      report: "Bursitis en hombro izquierdo.",
    });
    const block = buildInfographicLateralityPromptBlock(
      "AP",
      extracted,
      "Ultrasonido de Hombro Izquierdo: bursitis y pinzamiento"
    );
    expect(block).toMatch(/DERECHA DEL PACIENTE = IZQUIERDA DE LA PANTALLA/i);
    expect(block).toMatch(/hombro IZQUIERDO.*troquíter a la DERECHA/i);
    expect(block).toMatch(/silueta de un hombro derecho.*hombro izquierdo/i);
    expect(block).toMatch(/CHECKLIST DE SILUETA/i);
    expect(block).toMatch(/troquíter.*DERECHA del cuadro/i);
  });
});


describe("laterality labels stay separate from printable clinical copy", () => {
  for (const orientation of ["AP", "PA"] as const) for (const side of ["Derecha", "Izquierda"] as const) {
    it(`${side} ${orientation}: never locks a drawing instruction into visible text`, () => {
      const extracted = extractInfographicLaterality({ studyType: "Ecografía de hombro", studyLaterality: side, report: `Hombro ${side}: tendinosis del supraespinoso.` });
      const merged = mergeLateralityIntoCopyPlan({ title: "Hallazgos del hombro", callouts: [{ label: "Supraespinoso", detail: "Tendinosis documentada" }], mustSpellExactly: [] }, orientation, extracted)!;
      const locked = buildLockedCopyPromptBlock(merged);
      expect(locked).not.toMatch(/Dibujar|del cuadro|pantalla/i);
      expect(locked).toContain("Tendinosis documentada");
      expect(merged.callouts.find(c => /hombro/i.test(c.label))?.detail).toBeUndefined();
      expect(merged.title.toLowerCase()).toContain(side === "Derecha" ? "derecho" : "izquierdo");
    });
  }
});
