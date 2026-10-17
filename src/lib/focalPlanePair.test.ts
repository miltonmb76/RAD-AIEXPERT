import { describe, expect, it } from "vitest";
import { focalPlaneBadge, resolveFocalPlanePair } from "./focalPlanePair";

describe("resolveFocalPlanePair", () => {
  it("picks coronal + sagittal for shoulder cuff / tendon", () => {
    const pair = resolveFocalPlanePair({
      organOrStudy: "Hombro derecho",
      focusText: "ruptura parcial del supraespinoso",
    });
    expect(pair.family).toBe("shoulder_tendon");
    expect(pair.a.labelEs).toBe("Coronal");
    expect(pair.b.labelEs).toBe("Sagital");
  });

  it("picks AP + LAT for visceral abdomen", () => {
    const pair = resolveFocalPlanePair({
      organOrStudy: "Abdomen",
      reportText: "Hígado con nódulo en segmento VI",
    });
    expect(pair.family).toBe("visceral");
    expect(pair.a.labelEs).toBe("AP");
    expect(pair.b.labelEs).toBe("LAT");
  });

  it("badges plane titles", () => {
    expect(
      focalPlaneBadge({
        panelTitle: "Plano coronal",
        spatialContract: { view: "coronal clinical cutaway" },
      })
    ).toBe("Coronal");
    expect(
      focalPlaneBadge({
        panelTitle: "Plano sagital",
        panelRole: "plane_b",
        spatialContract: { view: "sagittal clinical cutaway" },
      })
    ).toBe("Sagital");
  });
});
