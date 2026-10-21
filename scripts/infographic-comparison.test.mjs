import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { requestOpenAiInfographic } from "../src/lib/infographicComparison.ts";

const input = { report: "CASO FICTICIO: mama izquierda, eje 7, nódulo 8 mm.", studyType: "Ecografía mamaria",
  reportDate: "", projections: [], viewOrientation: "AP", studyLaterality: "Izquierda", diagnosisAnchor: "", correctionNotes: "" };
const image = "data:image/png;base64,aGVsbG8=";
const response = (audience, extra = {}) => new Response(JSON.stringify({ success: true, provider: "openai", audience,
  imageUrl: image, model: "synthetic-image-model", elapsedMs: 1200, ...extra }), { status: 200 });

test("both audiences request OpenAI explicitly, without recommendations or PDF mutations", async () => {
  for (const audience of ["patient", "clinician"]) {
    const candidate = await requestOpenAiInfographic(input, audience, new AbortController().signal, async (url, options) => {
      assert.equal(url, "/api/generate-infographic");
      const body = JSON.parse(options.body);
      assert.equal(body.provider, "openai"); assert.equal(body.audience, audience);
      assert.equal(body.includeRecommendations, "none"); assert.equal(body.mode, "general");
      assert.equal(body.studyLaterality, "Izquierda"); assert.equal(body.report, input.report);
      return response(audience);
    });
    assert.deepEqual(candidate, { imageUrl: image, model: "synthetic-image-model", elapsedMs: 1200 });
  }
});

test("wrong provider, audience and arbitrary image URLs are rejected", async () => {
  for (const overrides of [{ provider: "gemini" }, { audience: "clinician" }, { imageUrl: "https://example.invalid/image" }]) {
    await assert.rejects(requestOpenAiInfographic(input, "patient", new AbortController().signal,
      async () => response("patient", overrides)), /no corresponde/);
  }
});

test("upstream failure is reported without discarding the caller's original", async () => {
  const original = { patient: image, clinician: image };
  await assert.rejects(requestOpenAiInfographic(input, "patient", new AbortController().signal, async () =>
    new Response(JSON.stringify({ success: false, error: "Saldo no disponible" }), { status: 429 })), /Saldo no disponible/);
  assert.deepEqual(original, { patient: image, clinician: image });
});

test("cancellation propagates to the network request", async () => {
  const controller = new AbortController();
  const pending = requestOpenAiInfographic(input, "patient", controller.signal, async (_url, options) =>
    new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")))));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("real OpenAI helper: isolated credentials, quality, bounded concurrency and safe errors", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rad-openai-test-"));
  const savedKey = process.env.OPENAI_API_KEY;
  const savedModel = process.env.OPENAI_INFOGRAPHIC_MODEL;
  // An invented marker only: no dotenv reads, external requests, or real credentials.
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  delete process.env.OPENAI_INFOGRAPHIC_MODEL;
  globalThis.__radImageCalls = [];
  globalThis.__radImageBehavior = async () => ({ data: [{ b64_json: "aGVsbG8=" }] });
  try {
    const result = await build({ entryPoints: [resolve("src/lib/openaiInfographic.ts")], bundle: true, write: false,
      platform: "node", format: "esm", plugins: [{ name: "no-real-providers", setup(builder) {
        builder.onResolve({ filter: /^(openai|dotenv)$/ }, args => ({ path: args.path, namespace: "synthetic" }));
        builder.onLoad({ filter: /./, namespace: "synthetic" }, args => ({ contents: args.path === "openai"
          ? `export default class OpenAI { constructor(options) { globalThis.__radClientOptions = options; }
             images = { generate: async (body, options) => { globalThis.__radImageCalls.push({body,options}); return globalThis.__radImageBehavior(); } }; }`
          : "export default { config() { throw new Error('dotenv must not run'); } };", loader: "js" }));
      } }] });
    const file = join(folder, "helper.mjs"); await writeFile(file, result.outputFiles[0].contents);
    const helper = await import(pathToFileURL(file).href);
    const resultImage = await helper.generateOpenAiInfographic("Paciente: IDENTIDAD FICTICIA\nMama izquierda, eje 7, nódulo 8 mm.");
    assert.equal(resultImage.imageUrl, image);
    const call = globalThis.__radImageCalls[0].body;
    assert.equal(call.model, helper.DEFAULT_INFOGRAPHIC_IMAGE_MODEL);
    assert.equal(call.quality, "high"); assert.equal(call.n, 1); assert.equal(call.size, "1024x1536");
    assert.equal(call.output_format, "png"); assert.doesNotMatch(call.prompt, /IDENTIDAD FICTICIA/);
    assert.match(call.prompt, /izquierda, eje 7/);
    assert.equal(globalThis.__radClientOptions.maxRetries, 0);
    assert.equal(globalThis.__radClientOptions.timeout, 180000);
    const releases = [];
    globalThis.__radImageBehavior = () => new Promise(resolve => releases.push(resolve));
    const first = helper.generateOpenAiInfographic("FICTICIO 1");
    const second = helper.generateOpenAiInfographic("FICTICIO 2");
    await assert.rejects(helper.generateOpenAiInfographic("FICTICIO 3"), error => error.status === 429);
    releases.forEach(resolve => resolve({ data: [{ b64_json: "aGVsbG8=" }] }));
    await Promise.all([first, second]);
    globalThis.__radImageBehavior = async () => { throw { status: 401, message: "SENSITIVE UPSTREAM PAYLOAD" }; };
    await assert.rejects(helper.generateOpenAiInfographic("FICTICIO"));
    const safe = helper.infographicProviderError({ status: 401, message: "SENSITIVE UPSTREAM PAYLOAD" });
    assert.equal(safe.status, 502); assert.doesNotMatch(safe.message, /SENSITIVE/);
    globalThis.__radImageBehavior = async () => ({ data: [{ url: "https://example.invalid/never-fetch" }] });
    await assert.rejects(helper.generateOpenAiInfographic("FICTICIO"), /imagen válida/);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(helper.generateOpenAiInfographic("FICTICIO"), error => error.status === 503);
  } finally {
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
    if (savedModel === undefined) delete process.env.OPENAI_INFOGRAPHIC_MODEL; else process.env.OPENAI_INFOGRAPHIC_MODEL = savedModel;
    delete globalThis.__radImageCalls; delete globalThis.__radImageBehavior; delete globalThis.__radClientOptions;
    await rm(folder, { recursive: true, force: true });
  }
});

test("actual route preserves patient/clinician prompts and Gemini default, without silent fallback", async () => {
  const text = await readFile("server.ts", "utf8");
  const start = text.indexOf('app.post("/api/generate-infographic",');
  const end = text.indexOf('\n/**', start);
  assert.ok(start > 0 && end > start);
  const folder = await mkdtemp(join(tmpdir(), "rad-infographic-route-"));
  const { outputFiles } = await build({ stdin: { loader: "ts", resolveDir: resolve("."), contents: `
    import { redactPatientIdentifiersForInfographic, INFOGRAPHIC_PRIVACY_PROMPT_BLOCK } from './src/lib/infographicPrivacy';
    import { buildInfographicBreastClockBrief } from './src/lib/infographicBreastClock';
    let handler; const app={post(path,fn){handler=fn}};
    const getGeminiClient=()=>({models:{generateContent:async(args)=>{
      if(args.config?.responseMimeType)throw new Error('Synthetic planner unavailable');
      globalThis.__radGeminiCalls++;return {candidates:[{content:{parts:[{inlineData:{data:'aGVsbG8='}}]}}]};
    }}});
    const getModelName=()=> 'synthetic-text';
    const requireOpenAiInfographicKey=()=>{};
    const generateOpenAiInfographic=async(prompt)=>{
      globalThis.__radRoutePrompts.push(prompt);
      if(globalThis.__radRouteFail)throw new Error('SENSITIVE PAYLOAD');
      return {imageUrl:'${image}',model:'synthetic-image',elapsedMs:1};
    };
    const infographicProviderError=()=>({status:502,message:'Fallo seguro de OpenAI'});
    const handleGeminiError=()=> 'Fallo de Gemini';
    const detectInfographicViewOrientation=()=> 'AP';
    const extractInfographicLaterality=()=>({side:'left',summary:'Mama izquierda'});
    const buildInfographicLateralityPromptBlock=()=> 'LADO FIJO: IZQUIERDA';
    const buildInfographicCopyPlanPrompt=()=> 'synthetic plan';
    const extractJsonObject=()=>null;
    const normalizeInfographicCopyPlan=()=>null;
    const mergeLateralityIntoCopyPlan=(plan)=>plan;
    const buildLockedCopyPromptBlock=()=> '';
    const INFOGRAPHIC_TEXT_ACCURACY_PROMPT_BLOCK='CONSERVAR MEDIDAS';
    const INFOGRAPHIC_NO_REAL_US_PROMPT_BLOCK='SIN ECO REAL';
    ${text.slice(start,end)}
    export {handler};
  ` }, bundle: true, write: false, platform: "node", format: "esm" });
  const file = join(folder, "route.mjs"); await writeFile(file, outputFiles[0].contents);
  globalThis.__radRoutePrompts = []; globalThis.__radGeminiCalls = 0; globalThis.__radRouteFail = false;
  try {
    const { handler } = await import(pathToFileURL(file).href);
    const run = async (body, destroyed = false) => {
      const res = { destroyed, writableEnded: false, statusCode: 200, on() {}, off() {},
        status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; this.writableEnded = true; return this; } };
      await handler({ body: { ...input, ...body } }, res); return res;
    };
    for (const audience of ["patient", "clinician"]) {
      const res = await run({ provider: "openai", audience, includeRecommendations: "none", report: "Paciente: IDENTIDAD FICTICIA\nMama izquierda eje 7, 8 mm" });
      assert.equal(res.payload.provider, "openai"); assert.equal(res.payload.audience, audience);
      const prompt = globalThis.__radRoutePrompts.at(-1);
      assert.match(prompt, audience === "patient" ? /Español para paciente/ : /Léxico médico preciso/);
      assert.match(prompt, /NO incluyas recomendaciones/);
      assert.doesNotMatch(prompt, /IDENTIDAD FICTICIA/);
      assert.match(prompt, /izquierda eje 7, 8 mm/);
    }
    assert.equal(globalThis.__radGeminiCalls, 0);
    globalThis.__radRouteFail = true;
    const failure = await run({ provider: "openai", audience: "patient" });
    assert.equal(failure.statusCode, 502); assert.equal(failure.payload.error, "Fallo seguro de OpenAI");
    assert.equal(globalThis.__radGeminiCalls, 0);
    globalThis.__radRouteFail = false;
    const calls = globalThis.__radRoutePrompts.length;
    await run({ provider: "openai", audience: "patient" }, true);
    assert.equal(globalThis.__radRoutePrompts.length, calls);
    const original = await run({ audience: "patient" });
    assert.equal(original.payload.provider, "gemini"); assert.equal(globalThis.__radGeminiCalls, 1);
    assert.equal((await run({ provider: "unknown" })).statusCode, 400);
  } finally {
    delete globalThis.__radRoutePrompts; delete globalThis.__radGeminiCalls; delete globalThis.__radRouteFail;
    await rm(folder, { recursive: true, force: true });
  }
});
