import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  resolveMskLaterality, detectMskView, detectMskOrgan, buildMskLandmarkBrief,
  acceptsMskVisualCheck, generateCheckedMskImage, generateMskPlan,
} from "../src/lib/mskImageLaterality.ts";

const image = "data:image/jpeg;base64,U1lOVEhFVElD";
const observation = (contract, patch = {}) => {
  const lateral = (contract.side === "right") === (contract.view === "AP") ? "left" : "right";
  return { anatomicalSide: contract.side, view: contract.view,
    lateralLandmarkPosition: lateral, medialLandmarkPosition: lateral === "left" ? "right" : "left",
    landmarksVisible: true, clinicalSiteMatches: true, allPanelsConsistent: true, textMatchesClinicalSource: true, productionInstructionsAbsent: true,
    observations: ["Synthetic visible landmark evidence, no patient data"], ...patch };
};

test("clinical side survives automatic selection, English values and layout-only corrections", () => {
  assert.equal(resolveMskLaterality("auto", "Hombro izquierdo"), "left");
  assert.equal(resolveMskLaterality("left", "Hombro derecho"), "left");
  assert.equal(resolveMskLaterality("mover texto a la derecha", "Izquierda"), "left");
  assert.equal(resolveMskLaterality("mover texto al lado derecho", "Izquierda"), "left");
  assert.equal(resolveMskLaterality("corregir lateralidad a izquierda", "Derecha"), "left");
  assert.equal(resolveMskLaterality("Rodilla derecha y rodilla izquierda"), "bilateral");
  assert.equal(resolveMskLaterality("auto", "Tendinosis sin lado documentado"), "unspecified");
  assert.equal(detectMskOrgan("Ecografía de ambas rodillas"), "knee");
  assert.equal(detectMskOrgan("Ecografía de ambos hombros"), "shoulder");
});

test("posterior horn location does not become a posterior camera view", () => {
  assert.equal(detectMskView("Anterior view, posterior horn lesion"), "AP");
  assert.equal(detectMskView("posterior view of shoulder"), "PA");
  assert.equal(detectMskView("vista posterior"), "PA");
});

for (const organ of ["knee", "shoulder"]) for (const side of ["right", "left"]) for (const view of ["AP", "PA"]) {
  test(`${organ} ${side} ${view}: checks anatomy within the panel, independent of layout`, () => {
    const contract = { organ, side, view, clinicalSite: "Synthetic documented site" };
    assert.equal(acceptsMskVisualCheck(observation(contract), contract), true);
    assert.equal(acceptsMskVisualCheck(observation(contract, { anatomicalSide: side === "left" ? "right" : "left" }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { lateralLandmarkPosition: "unknown" }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { clinicalSiteMatches: false }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { landmarksVisible: "true" }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { allPanelsConsistent: false }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { allPanelsConsistent: undefined }), contract), false);
    const brief = buildMskLandmarkBrief(contract);
    assert.match(brief, /independent of where the panel is placed/);
    if (organ === "knee") assert.match(brief, /EXTERNAL.*adjacent to the fibula.*INTERNAL.*opposite the fibula/);
    else assert.match(brief, /subscapularis \(anterior\).*infraspinatus \(posterior\)/);
  });
}

test("wrong internal/external site gets one correction and is accepted only after visual pass", async () => {
  const contract = { organ: "knee", side: "left", view: "AP", clinicalSite: "Menisco externo, cuerno posterior" };
  const feedback = []; let checked = 0;
  const result = await generateCheckedMskImage({ contract,
    generate: async (text) => { feedback.push(text); return image; },
    inspect: async () => observation(contract, { clinicalSiteMatches: ++checked > 1 }),
  });
  assert.equal(result.imageUrl, image);
  assert.equal(result.lateralityQa.attempts, 2);
  assert.match(feedback[1], /CORRECTION/);
});

test("bilateral images require independent valid anatomy for both sides", () => {
  const contract = { organ: "knee", side: "bilateral", view: "AP", clinicalSite: "Synthetic bilateral report" };
  const right = observation({ ...contract, side: "right" });
  const left = observation({ ...contract, side: "left" });
  assert.equal(acceptsMskVisualCheck({ panels: [right, left] }, contract), true);
  assert.equal(acceptsMskVisualCheck({ panels: [right, right] }, contract), false);
  assert.equal(acceptsMskVisualCheck({ panels: [right, { ...left, clinicalSiteMatches: false }] }, contract), false);
  assert.equal(acceptsMskVisualCheck({ panels: [right, left, { anatomicalSide: "unknown" }] }, contract), false);
});

test("infographics reject leaked production instructions and unsupported clinical text", async () => {
  const contract = { organ: "shoulder", side: "left", view: "AP", format: "infographic", clinicalSite: "Hombro izquierdo: rotura parcial bursal 6 x 3 mm." };
  for (const field of ["textMatchesClinicalSource", "productionInstructionsAbsent"]) {
    assert.equal(acceptsMskVisualCheck(observation(contract, { [field]: false }), contract), false);
    assert.equal(acceptsMskVisualCheck(observation(contract, { [field]: undefined }), contract), false);
    let audits = 0; const prompts = [];
    const result = await generateCheckedMskImage({ contract,
      generate: async (prompt) => { prompts.push(prompt); return image; },
      inspect: async (_url, instruction) => {
        assert.match(instruction, /EVERY visible text line/);
        assert.match(instruction, /Dibujar a la derecha del cuadro/);
        return observation(contract, { [field]: ++audits > 1, observations: ["Synthetic sensitive observation must never enter regeneration"] });
      },
    });
    assert.equal(result.lateralityQa.attempts, 2);
    assert.match(prompts[1], new RegExp(field));
    assert.doesNotMatch(prompts[1], /Synthetic sensitive observation/);
  }
});

test("macro panels retain orientation context without automatically rejecting a clear cutaway", async () => {
  const contract = { organ: "shoulder", side: "left", view: "AP", clinicalSite: "Synthetic partial bursal tear" };
  let checked = 0;
  const result = await generateCheckedMskImage({ contract,
    generate: async (prompt) => {
      assert.match(prompt, /COMPOSITION OVERRIDE/);
      assert.match(prompt, /medial AND lateral bony landmarks/);
      assert.match(prompt, /transparent window or enlarged cutaway/);
      return image;
    },
    inspect: async (_url, instruction) => {
      checked++;
      assert.match(instruction, /Small obliquity or a cutaway is not itself a failure/);
      return observation(contract);
    },
  });
  assert.equal(checked, 1);
  assert.equal(result.imageUrl, image);
  assert.equal(acceptsMskVisualCheck(observation(contract, { lateralLandmarkPosition: "unknown" }), contract), false);
});

test("repeated visual failures and missing anatomy never leak an image", async () => {
  const contract = { organ: "shoulder", side: "right", view: "AP", clinicalSite: "Synthetic" };
  let generated = 0;
  await assert.rejects(generateCheckedMskImage({ contract,
    generate: async () => { generated++; return image; },
    inspect: async () => observation(contract, { landmarksVisible: false }),
  }), /No se pudo confirmar/);
  assert.equal(generated, 2);
});

test("validator outage does not approve the image or launch extra regeneration", async () => {
  const contract = { organ: "knee", side: "right", view: "PA", clinicalSite: "Synthetic" };
  let generated = 0;
  await assert.rejects(generateCheckedMskImage({ contract,
    generate: async () => { generated++; return image; },
    inspect: async () => { throw new Error("Synthetic provider outage"); },
  }), /No se pudo confirmar/);
  assert.equal(generated, 1);
});

test("wrong-sided planner text is retried, not relabeled as if correct", async () => {
  const inputs = [];
  const plan = await generateMskPlan("left", async (feedback) => {
    inputs.push(feedback);
    return JSON.stringify({ panels: [{ panelTitle: inputs.length === 1 ? "Hombro derecho" : "Hombro izquierdo" }] });
  });
  assert.equal(inputs.length, 2);
  assert.equal(plan.panels[0].panelTitle, "Hombro izquierdo");
  assert.match(inputs[1], /CORRECCIÓN/);
  await assert.rejects(generateMskPlan("left", async () => "{invalid"), /No se pudo obtener/);
});

test("real shoulder/knee generate and regenerate routes use clinical side and visual checks", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rad-msk-test-"));
  const key = process.env.GEMINI_API_KEY;
  try {
    const source = await readFile("server_atlas3d.ts", "utf8");
    const output = await build({ stdin: { contents: source + '\nexport { resolveKneeMeniscusTarget, buildScreenLateralityConstraint };', resolveDir: resolve("."), loader: "ts" },
      bundle: true, write: false, platform: "node", format: "esm",
      plugins: [{ name: "synthetic-providers", setup(builder) {
        builder.onResolve({ filter: /^(express|dotenv|@google\/genai)$/ }, (args) => ({ path: args.path, namespace: "synthetic" }));
        builder.onLoad({ filter: /./, namespace: "synthetic" }, (args) => ({ contents:
          args.path === "@google/genai" ? `export class GoogleGenAI { models = { generateContent: async (request) => {
            const s = globalThis.__mskFixture;
            (s.requests ??= []).push(request);
            if (request.config?.imageConfig) { s.images++; return { candidates: [{ content: { parts: [{ inlineData: { data: 'U1lOVEhFVElD' } }] } }] }; }
            if (request.contents?.parts?.some(p => p.inlineData)) { s.audits++; return { text: JSON.stringify(s.audit) }; }
            s.plans++; return { text: JSON.stringify(s.plan) };
          } }; }` : "export default { config() {} };", loader: "js" }));
      } }],
    });
    const file = join(folder, "server.mjs"); await writeFile(file, output.outputFiles[0].text);
    const module = await import(pathToFileURL(file).href);
    const reportText = "Rodilla izquierda. Menisco interno, cuerno anterior: hallazgo sintético A. Menisco externo, cuerno posterior: hallazgo sintético B.";
    const internal = module.resolveKneeMeniscusTarget({ reportText, laterality: "Izquierda", structureOrSite: "Menisco interno, cuerno anterior" });
    const external = module.resolveKneeMeniscusTarget({ reportText, laterality: "Izquierda", structureOrSite: "Menisco externo, cuerno posterior", view: "PA" });
    assert.equal(internal.compartment, "medial");
    assert.equal(internal.horn, "anterior");
    assert.equal(external.compartment, "lateral");
    assert.equal(external.horn, "posterior");
    assert.match(external.pin, /LEFT knee PA map: lateral\/fibula = VIEWER LEFT/);
    assert.match(module.buildScreenLateralityConstraint("Izquierda", "PA"), /VIEWER'S LEFT/);
    const routes = new Map(); module.registerAtlas3DRoutes({ post: (path, handler) => routes.set(path, handler) });
    process.env.GEMINI_API_KEY = "synthetic-not-a-real-key";
    const run = async (path, body) => {
      let code = 200, result;
      await routes.get(path)({ body }, { status(value) { code = value; return this; }, json(value) { result = value; return this; } });
      return { code, result };
    };
    for (const organ of ["shoulder", "knee"]) {
      const title = organ === "knee" ? "Rodilla izquierda" : "Hombro izquierdo";
      const panel = { panelLetter: "A", panelTitle: title, laterality: "Izquierda", imagePrompt: "Anterior view of synthetic anatomy", anatomicalFocus: "Synthetic findings" };
      const contract = { organ, side: "left", view: "AP", clinicalSite: "Synthetic" };
      globalThis.__mskFixture = { images: 0, audits: 0, plans: 0, plan: { panels: [panel] }, audit: observation(contract) };
      const body = { reportText: title + ": hallazgos sintéticos", laterality: "auto" };
      const generated = await run(`/api/generate-3d-${organ}`, body);
      assert.equal(generated.code, 200);
      assert.equal(generated.result.data.panels[0].laterality, "Izquierda");
      assert.equal(generated.result.data.panels[0].imageUrl, image);
      assert.equal(globalThis.__mskFixture.audits, 1);
      const planningText = globalThis.__mskFixture.requests.find(r => !r.config?.imageConfig && !r.contents?.parts?.some(p => p.inlineData)).contents[0].text;
      assert.match(planningText, /SOLO si/);
      assert.doesNotMatch(planningText, /rehabilitación dirigida|Pinzamiento leve en arco medio/);
      if (organ === "knee") assert.doesNotMatch(planningText, /surco bicipital|Rodilla derecho/);
      // With "auto", regeneration must keep the panel's side even without a sided report.
      globalThis.__mskFixture.plan = { panelTitle: title, imagePrompt: "Anterior view of synthetic anatomy" };
      const regenerated = await run(`/api/regenerate-3d-${organ}-panel`, { panel, laterality: "auto", reportText: "Hallazgos sintéticos" });
      assert.equal(regenerated.result.panel.laterality, "Izquierda");
      globalThis.__mskFixture.audit = observation(contract, { anatomicalSide: "right" });
      const rejected = await run(`/api/regenerate-3d-${organ}-panel`, { panel, laterality: "Izquierda", reportText: title });
      assert.equal(rejected.result.success, false);
      assert.equal(rejected.result.panel, undefined);
      globalThis.__mskFixture.plan = { panels: [{ ...panel, laterality: "Derecha" }] };
      const badPlan = await run(`/api/generate-3d-${organ}`, body);
      assert.equal(badPlan.code, 502);
      assert.equal(badPlan.result.data, undefined);
    }
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
    delete globalThis.__mskFixture;
    await rm(folder, { recursive: true, force: true });
  }
});

test("actual infographic route checks patient/clinician images and blocks failed anatomy", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rad-msk-infographic-"));
  try {
    // Isolate the actual HTTP handler; no app startup, Firebase, credentials or network.
    const server = await readFile("server.ts", "utf8");
    const start = server.indexOf('app.post("/api/generate-infographic",');
    const end = server.indexOf('\n});', start) + 5;
    assert.ok(start > 0 && end > start);
    const setup = `
      import { detectMskOrgan, resolveMskLaterality, mskSideLabel, generateCheckedMskImage } from './src/lib/mskImageLaterality';
      import { buildInfographicLateralityPromptBlock, detectInfographicViewOrientation, extractInfographicLaterality, mergeLateralityIntoCopyPlan } from './src/lib/infographicLaterality';
      import { buildInfographicBreastClockBrief } from './src/lib/infographicBreastClock';
      import { INFOGRAPHIC_PRIVACY_PROMPT_BLOCK, redactPatientIdentifiersForInfographic } from './src/lib/infographicPrivacy';
      import { INFOGRAPHIC_NO_REAL_US_PROMPT_BLOCK } from './src/lib/infographicNoRealUs';
      import { INFOGRAPHIC_TEXT_ACCURACY_PROMPT_BLOCK, buildInfographicCopyPlanPrompt, buildLockedCopyPromptBlock, normalizeInfographicCopyPlan } from './src/lib/infographicCopyPlan';
      import { extractJsonObject } from './src/lib/reasoningChain';
      let handler;
      const app = { post: (_path, fn) => { handler = fn; } };
      const getGeminiClient = () => globalThis.__infographicFixture.ai;
      const getModelName = () => 'synthetic-model';
      const handleGeminiError = (error) => error.message;
    `;
    const output = await build({ stdin: { contents: setup + server.slice(start, end) + '\nexport { handler };', loader: "ts", resolveDir: resolve(".") },
      bundle: true, platform: "node", format: "esm", write: false });
    const file = join(folder, "route.mjs"); await writeFile(file, output.outputFiles[0].text);
    const { handler } = await import(pathToFileURL(file).href);
    const fixture = { images: 0, audits: 0, check: null, ai: { models: { generateContent: async (request) => {
      if (request.config?.imageConfig) {
        fixture.images++;
        return { candidates: [{ content: { parts: [{ inlineData: { data: 'U1lOVEhFVElD' } }] } }] };
      }
      if (request.contents?.parts?.some((part) => part.inlineData)) {
        fixture.audits++; return { text: JSON.stringify(fixture.check) };
      }
      return { text: JSON.stringify({ title: "Synthetic clinical title", callouts: [{ label: "Hallazgo", detail: "Informe sintético del estudio izquierdo" }], mustSpellExactly: [] }) };
    } } } };
    globalThis.__infographicFixture = fixture;
    const run = async (body) => {
      let code = 200, result;
      await handler({ body }, { status(value) { code = value; return this; }, json(value) { result = value; return this; } });
      return { code, result };
    };
    for (const organ of ["knee", "shoulder"]) for (const audience of ["patient", "clinician"]) {
      fixture.images = fixture.audits = 0;
      const body = { studyType: organ === "knee" ? "Rodilla" : "Hombro", report: "Informe sintético del estudio izquierdo.", studyLaterality: "Izquierda", audience };
      fixture.check = observation({ organ, side: "left", view: "AP" });
      const passed = await run(body);
      assert.equal(passed.code, 200);
      assert.equal(passed.result.imageUrl, image);
      assert.equal(passed.result.lateralitySide, "left");
      assert.equal(fixture.audits, 1);
      fixture.images = fixture.audits = 0;
      fixture.check = { ...fixture.check, clinicalSiteMatches: false };
      const rejected = await run(body);
      assert.equal(rejected.result.success, false);
      assert.equal(rejected.result.imageUrl, undefined);
      assert.equal(fixture.images, 2);
      assert.equal(fixture.audits, 2);
      for (const field of ["textMatchesClinicalSource", "productionInstructionsAbsent"]) {
        fixture.images = fixture.audits = 0;
        fixture.check = observation({ organ, side: "left", view: "AP" }, { [field]: false });
        const badCopy = await run(body);
        assert.equal(badCopy.result.success, false);
        assert.equal(badCopy.result.imageUrl, undefined);
        assert.equal(fixture.images, 2);
      }
    }
    fixture.check = { panels: [observation({ side: "right", view: "AP" }), observation({ side: "left", view: "AP" })] };
    const bilateral = await run({ studyType: "Rodilla", report: "Rodilla derecha y rodilla izquierda: estudio sintético.", studyLaterality: "Bilateral" });
    assert.equal(bilateral.result.success, true);
    const missing = await run({ studyType: "Hombro", report: "Tendinosis sintética, lado sin documentar." });
    assert.equal(missing.code, 400);
    fixture.audits = 0;
    const other = await run({ studyType: "Ecografía renal", report: "Informe renal sintético." });
    assert.equal(other.result.success, true);
    assert.equal(fixture.audits, 0, "unrelated organs keep their existing image flow");
  } finally {
    delete globalThis.__infographicFixture;
    await rm(folder, { recursive: true, force: true });
  }
});
