import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInfographicCopyPlanPrompt, normalizeInfographicCopyPlan } from "../src/lib/infographicCopyPlan.ts";

const plan = { title: "Hombro izquierdo", callouts: [{ label: "Supraespinoso", detail: "Rotura parcial bursal de 6 × 3 mm." }], mustSpellExactly: ["6 × 3 mm"] };

test("MSK scripts stay brief without cutting off a measurement or qualifier", () => {
  assert.deepEqual(normalizeInfographicCopyPlan(plan, { strict: true }), plan);
  for (const bad of [
    { ...plan, callouts: [{ label: "Lesión", detail: "x".repeat(121) + " sin rotura completa" }] },
    { ...plan, callouts: Array.from({ length: 7 }, () => plan.callouts[0]) },
    { ...plan, callouts: [] }, { ...plan, callouts: [null] },
    { ...plan, title: "x".repeat(91) },
  ]) assert.equal(normalizeInfographicCopyPlan(bad, { strict: true }), null);
});

test("both audiences receive a schematic visual summary, with distinct vocabulary and no advice", () => {
  for (const audience of ["patient", "clinician"]) {
    const prompt = buildInfographicCopyPlanPrompt({ audience, studyType: "Hombro", report: "Caso ficticio", isDirected: false, allowRecommendations: false });
    assert.match(prompt, /RESUMEN VISUAL ESQUEMÁTICO/);
    assert.match(prompt, /dibujo debe ser protagonista/);
    assert.match(prompt, /1 a 6 callouts/);
    assert.match(prompt, /NO incluyas recomendaciones/);
    assert.match(prompt, audience === "patient" ? /lenguaje sencillo para el paciente/ : /lenguaje técnico conciso para el médico/);
    assert.match(prompt, /No deduzcas bursitis reactiva/);
  }
});
