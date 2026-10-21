import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  extractBreastClockHours, extractBreastClockTargets, detectBreastClockSide,
  buildInfographicBreastClockBrief, getBreastClockGeometry,
} from "../src/lib/infographicBreastClock.ts";
import { buildBreastPlanPrompt } from "../src/lib/breastPlanPrompt.ts";

test("clinical hours are distinct from measurements and preserve multiple lesions", () => {
  assert.deepEqual(extractBreastClockHours("Mama derecha eje 10, nódulo 8 mm; mama izquierda eje 2, 5 mm."), [10, 2]);
  assert.deepEqual(extractBreastClockHours("eje de las siete, 12 mm, a 3 cm del pezón"), [7]);
  assert.deepEqual(extractBreastClockHours("masa de 10 mm x 5 mm"), []);
  assert.deepEqual(extractBreastClockHours("right breast 10 o’clock, left breast 2h"), [10, 2]);
  assert.deepEqual(extractBreastClockTargets("Mama derecha:\nNódulo eje 10, 8 mm.\nMama izquierda: lesión eje 2, 5 mm"), [
    { side: "right", hour: 10 }, { side: "left", hour: 2 },
  ]);
});

test("explicit target side is not erased by a normal contralateral breast", () => {
  assert.equal(detectBreastClockSide("Izquierda", "Mama derecha normal; mama izquierda con lesión eje 7"), "left");
  assert.equal(detectBreastClockSide("Bilateral", "Mama derecha eje 10"), "right");
  assert.equal(detectBreastClockSide("Mama derecha eje 10 y mama izquierda eje 2"), "unknown");
});

test("infographic does not impose the first hour on multiple lesions", () => {
  const brief = buildInfographicBreastClockBrief({ studyType: "Ecografía mamaria bilateral",
    report: "Mama derecha eje 10, lesión A; mama izquierda eje 2, lesión B." });
  assert.ok(brief.includes("HAY VARIOS EJES"));
  assert.ok(!brief.includes("OBJETIVO BLOQUEADO:"));
});

test("clock geometry retains the same dial for both breasts, without mirroring hours", () => {
  for (let hour = 1; hour <= 12; hour++) {
    const g = getBreastClockGeometry(hour);
    assert.equal(g.degreesFrom12, (hour % 12) * 30);
    assert.equal(g.hour, hour);
  }
  assert.match(getBreastClockGeometry(3).anatomyLeftBreast, /LATERAL/);
  assert.match(getBreastClockGeometry(3).anatomyRightBreast, /MEDIAL/);
  assert.equal(getBreastClockGeometry(7).viewerHalf, "left");
  assert.equal(getBreastClockGeometry(5).viewerHalf, "right");
});

test("mammary planner has no thyroid or vascular template instructions", () => {
  const prompt = buildBreastPlanPrompt({ reportText: "SYNTHETIC MAMA IZQUIERDA EJE 7", laterality: "Izquierda", clockRules: "SYNTHETIC CLOCK RULES" });
  assert.ok(prompt.includes("SYNTHETIC MAMA IZQUIERDA EJE 7"));
  assert.ok(prompt.includes("SYNTHETIC CLOCK RULES"));
  assert.doesNotMatch(prompt, /tiroide|carot[ií]d|istmo|cervical|NASCET|endotel|TR3|Mama derecha, 3h/i);
});

test("mammary planner includes the clinical card in its JSON contract", () => {
  const prompt = buildBreastPlanPrompt({ reportText: "SYNTHETIC REPORT", clockRules: "CLOCK RULES" });
  const schema = prompt.slice(prompt.indexOf("RESPONDE ESTRICTAMENTE"));
  for (const field of ["breastSummary", "morphologyNotes", "axillaryStatus", "keyPoints"]) {
    assert.ok(schema.includes(`"${field}":`), `JSON contract must include ${field}`);
  }
  assert.match(prompt, /nunca deduzcas normalidad/);
});

test("real server resolver preserves multifocal hours and rejects invented fallback plans", async () => {
  // Stub every provider: no network, dotenv reads, or real credentials.
  const source = await readFile("server_atlas3d.ts", "utf8");
  const result = await build({
    stdin: { contents: source + "\nexport { resolveBreastLockedHour };", resolveDir: resolve("."), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "synthetic-providers", setup(builder) {
      builder.onResolve({ filter: /^(express|dotenv|@google\/genai)$/ }, (args) => ({ path: args.path, namespace: "synthetic" }));
      builder.onLoad({ filter: /./, namespace: "synthetic" }, (args) => ({ contents:
        args.path === "@google/genai"
          ? "export class GoogleGenAI { models = { generateContent: async () => ({text: globalThis.__syntheticPlan, candidates: [{content: {parts: [{inlineData: {data: 'U1lOVEhFVElD'}}]}}]}) }; }"
          : "export default { config() {} };", loader: "js" }));
    } }],
  });
  const folder = await mkdtemp(join(tmpdir(), "rad-breast-test-"));
  const file = join(folder, "server.mjs");
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    await writeFile(file, result.outputFiles[0].text);
    const module = await import(pathToFileURL(file).href);
    const reportText = "Mama derecha eje 10, lesión A; mama izquierda eje 2, lesión B.";
    assert.equal(module.resolveBreastLockedHour({ reportText }), null);
    assert.equal(module.resolveBreastLockedHour({ reportText, clockPositionOrSite: "Mama izquierda 2h" }), 2);
    assert.equal(module.resolveBreastLockedHour({ reportText, clockPositionOrSite: "Mama derecha 10h" }), 10);
    assert.equal(module.resolveBreastLockedHour({ reportText, clockPositionOrSite: "Mama derecha 2h" }), 10);
    assert.equal(module.resolveBreastLockedHour({ reportText, clockPositionOrSite: "Mama izquierda 10h" }), 2);
    assert.equal(module.resolveBreastLockedHour({ reportText: "Mama derecha eje 10", clockPositionOrSite: "Mama derecha 2h" }), 10);
    assert.equal(module.resolveBreastLockedHour({ reportText, userDirective: "corregir a eje 7" }), 7);
    const routes = new Map();
    module.registerAtlas3DRoutes({ post: (path, handler) => routes.set(path, handler) });
    process.env.GEMINI_API_KEY = "synthetic-not-a-real-key";
    for (const response of ["{invalid", "{}", "null"]) {
      globalThis.__syntheticPlan = response;
      let code = 200, body;
      await routes.get("/api/generate-3d-breast")({ body: { reportText: "SYNTHETIC REPORT" } }, {
        status(value) { code = value; return this; }, json(value) { body = value; return this; },
      });
      assert.equal(code, 502);
      assert.equal(body.success, false);
      assert.equal(body.data, undefined);
    }

    // Exercise Cursor's missing-card fix through the actual route, alongside our
    // multifocal clock correction. Every provider response and image is synthetic.
    globalThis.__syntheticPlan = "```json\n" + JSON.stringify({
      panels: [{ panelLetter: "A", panelTitle: "Panel A: Ambas mamas", panelRole: "both_breasts", anatomicalFocus: " " }],
      lesionTable: [
        { location: "Mama derecha eje 2", size: "8 mm", composition: "Quística" },
        { location: "Mama izquierda eje 10", size: "5 mm", composition: "Quística" },
      ],
      morphologicalSynthesis: "Hallazgos mamarios bilaterales descritos en el informe sintético.",
    }) + "\n```";
    let code = 200, body;
    await routes.get("/api/generate-3d-breast")({ body: { reportText } }, {
      status(value) { code = value; return this; }, json(value) { body = value; return this; },
    });
    assert.equal(code, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.breastSummary.trim());
    assert.ok(body.data.morphologyNotes.trim());
    assert.match(body.data.axillaryStatus, /no detalladas/);
    assert.equal(body.data.keyPoints.length, 2);
    assert.ok(body.data.panels[0].anatomicalFocus.trim());
    assert.match(body.data.lesionTable[0].location, /10h/);
    assert.match(body.data.lesionTable[1].location, /2h/);
    assert.equal(body.data.panels[0].imageUrl, "data:image/jpeg;base64,U1lOVEhFVElD");
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    delete globalThis.__syntheticPlan;
    await rm(folder, { recursive: true, force: true });
  }
});
