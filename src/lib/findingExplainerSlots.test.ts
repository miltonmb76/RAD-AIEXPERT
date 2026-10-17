import { describe, expect, it } from "vitest";
import {
  FINDING_EXPLAINER_MAX_CARDS,
  buildFindingExplainerSlotHints,
  emptyFindingExplainerSlots,
  normalizeFindingExplainerData,
} from "./findingExplainer";

describe("finding explainer slots", () => {
  it("caps at 4 cards", () => {
    expect(FINDING_EXPLAINER_MAX_CARDS).toBe(4);
    expect(emptyFindingExplainerSlots()).toHaveLength(4);
  });

  it("builds ordered slot hints and maxFindings from filled slots", () => {
    const { findingHints, maxFindings, filledSlots } = buildFindingExplainerSlotHints(
      ["Ruptura supraespinoso", "", "Bursitis", "  "],
      { diagnosisAnchor: "Hombro derecho" }
    );
    expect(filledSlots).toEqual(["Ruptura supraespinoso", "Bursitis"]);
    expect(maxFindings).toBe(2);
    expect(findingHints).toContain("Hallazgo 1: Ruptura supraespinoso");
    expect(findingHints).toContain("Hallazgo 2: Bursitis");
    expect(findingHints).toContain("Ancla diagnostica: Hombro derecho");
    expect(findingHints).toContain("SLOTS OBLIGATORIOS");
  });

  it("defaults maxFindings to 2 when all slots empty", () => {
    const { maxFindings, findingHints } = buildFindingExplainerSlotHints(["", "", "", ""]);
    expect(maxFindings).toBe(2);
    expect(findingHints).toBe("");
  });

  it("normalizes up to 4 cards", () => {
    const data = normalizeFindingExplainerData({
      cards: [
        { label: "A" },
        { label: "B" },
        { label: "C" },
        { label: "D" },
        { label: "E" },
      ],
    });
    expect(data.cards).toHaveLength(4);
  });
});
