import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runConcurrent, singleFlight } from "../src/lib/concurrentTasks.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.ok(predicate(), "expected operation started");
}

// Bundle real controllers, substituting all storage/network/image integrations.
async function controller(path, mocks = {}) {
  const output = await build({
    entryPoints: [path], bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "synthetic-integrations", setup(builder) {
      builder.onResolve({ filter: /./ }, (args) => {
        const name = Object.keys(mocks).find((key) => args.path.endsWith(key));
        if (name) return { path: name, namespace: "synthetic" };
      });
      builder.onLoad({ filter: /./, namespace: "synthetic" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
    } }],
  });
  const folder = await mkdtemp(join(tmpdir(), "rad-synthetic-controller-"));
  const file = join(folder, "controller.mjs");
  try {
    await writeFile(file, output.outputFiles[0].text);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

test("pool preserves results, bounds overlap, and continues after one failure", { timeout: 3000 }, async () => {
  let active = 0, peak = 0, completed = 0;
  const results = await runConcurrent(Array.from({ length: 12 }, (_, i) => async () => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--; completed++;
    if (i === 4) throw new Error("Synthetic failure");
    return i;
  }), 3);
  assert.equal(peak, 3);
  assert.equal(completed, 12);
  assert.equal(results[4].status, "rejected");
  assert.equal(results[11].value, 11);
  assert.deepEqual(await runConcurrent([], 2), []);
  await assert.rejects(runConcurrent([], 0));
});

test("overlapping history reads share work only within the same user", async () => {
  let calls = 0;
  const gate = deferred();
  const read = singleFlight(async (user) => { calls++; await gate.promise; return user; });
  const first = read("synthetic-user-a");
  assert.equal(first, read("synthetic-user-a"));
  const other = read("synthetic-user-b");
  await Promise.resolve();
  assert.equal(calls, 2);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, other]), ["synthetic-user-a", "synthetic-user-b"]);
  await read("synthetic-user-a");
  assert.equal(calls, 3, "later refresh must not reuse stale history");
});

test("failed history reads can be retried", async () => {
  let calls = 0;
  const read = singleFlight(async () => { if (++calls === 1) throw new Error("Synthetic offline"); return []; });
  await assert.rejects(read("synthetic-user"));
  assert.deepEqual(await read("synthetic-user"), []);
});

test("batch waits for scorecard, overlaps two suites, and continues after a failed suite", { timeout: 3000 }, async (t) => {
  const { createBatchModuleActivator } = await controller("src/lib/batchModuleActivator.ts");
  const calls = [], updates = [];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (url, options) => {
    const gate = deferred();
    calls.push({ url, body: JSON.parse(options.body), ...gate });
    return gate.promise;
  };
  const deps = new Proxy({
    generatedReport: "SYNTHETIC REPORT", clinicalHistory: "", specificStudy: "synthetic", studyType: "synthetic",
    diagnosisAnchor: "", patientGender: "", clinicalScorecardData: null,
    modelFor: () => "synthetic-model", isEditingReportManual: false,
  }, { get(target, key) { return key in target ? target[key] : (...args) => updates.push([key, ...args]); } });
  const running = createBatchModuleActivator(deps)(undefined, {
    clinical_scorecard: true, kidney3d: true, abdomen3d: true, wrist3d: true,
  });
  assert.deepEqual(calls.map((x) => x.url), ["/api/generate-clinical-scorecard"]);
  calls[0].resolve({ json: async () => ({ success: true, data: { criteria: [], atlasOverlays: [] } }) });
  await until(() => calls.length === 3);
  assert.deepEqual(calls.slice(1).map((x) => x.url), ["/api/generate-3d-kidney", "/api/generate-3d-abdomen"]);
  calls[1].reject(new Error("Synthetic provider failure"));
  await until(() => calls.length === 4);
  assert.equal(calls[3].url, "/api/generate-3d-wrist");
  for (const call of calls.slice(2)) {
    assert.equal(call.body.reportText, "SYNTHETIC REPORT");
    assert.equal(call.body.requestedModel, "synthetic-model");
    call.resolve({ json: async () => ({ success: true, data: { panels: [] } }) });
  }
  await running;
  assert.ok(updates.some(([key]) => key === "setAbdomen3dData"));
  assert.ok(updates.some(([key]) => key === "setWrist3dData"));
  assert.deepEqual(updates.filter(([key]) => key === "setIsActivatingBatch").map(([, value]) => value), [true, false]);
});

test("all thirteen selected suites still execute exactly once with bounded overlap", { timeout: 3000 }, async (t) => {
  const { createBatchModuleActivator } = await controller("src/lib/batchModuleActivator.ts");
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let active = 0, peak = 0;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return { json: async () => ({ success: true, data: { panels: [] } }) };
  };
  const suites = ["atlas3d", "vascular3d", "thyroid3d", "breast3d", "shoulder3d", "knee3d", "ankle3d",
    "kidney3d", "abdomen3d", "abdominalWall3d", "scrotum3d", "muscleTendon3d", "wrist3d"];
  const deps = new Proxy({
    generatedReport: "SYNTHETIC REPORT", clinicalHistory: "", specificStudy: "synthetic", studyType: "synthetic",
    diagnosisAnchor: "", patientGender: "", clinicalScorecardData: null, biomechanicalRadarData: null,
    modelFor: () => "synthetic-model", isEditingReportManual: false,
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  await createBatchModuleActivator(deps)(undefined, Object.fromEntries(suites.map((name) => [name, true])));
  assert.equal(calls.length, 13);
  assert.equal(new Set(calls).size, 13);
  assert.equal(peak, 2);
});

test("local archive appears before the cloud request finishes", { timeout: 3000 }, async () => {
  const remote = deferred();
  const local = { id: "synthetic-local", createdAt: "2026-01-01", reportText: "Synthetic local report" };
  const published = [];
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.__historyMocks = { local, remote };
  try {
    const { createCloudStudyActions } = await controller("src/lib/cloudStudyActions.ts", {
      firebaseDb: `export const getStudiesFromCloud = () => globalThis.__historyMocks.remote.promise;
        export const saveStudyToCloud = async () => {}; export const deleteStudyFromCloud = async () => {};`,
      localDb: `export const idbGetAllStudies = async () => [globalThis.__historyMocks.local];
        export const idbSaveStudy = async () => {}; export const idbSaveHistory = async () => {}; export const idbDeleteStudy = async () => {};`,
    });
    const deps = new Proxy({ setCloudStudies: (items) => published.push(items), setSavedReports: () => {} }, {
      get: (target, key) => key in target ? target[key] : () => {},
    });
    const running = createCloudStudyActions(deps).fetchCloudStudies("synthetic-user");
    await until(() => published.length > 0);
    assert.equal(published[0][0].id, local.id);
    remote.resolve([{ id: "synthetic-cloud", createdAt: "2026-01-02", reportText: "Synthetic cloud report" }]);
    await running;
    assert.deepEqual(published.at(-1).map((x) => x.id), ["synthetic-cloud", "synthetic-local"]);
  } finally {
    globalThis.localStorage = originalStorage;
    delete globalThis.__historyMocks;
  }
});

test("attachment import bounds decoding and keeps good images after a read failure", { timeout: 3000 }, async (t) => {
  const originalReader = globalThis.FileReader;
  let active = 0, peak = 0, images = [];
  globalThis.FileReader = class {
    readAsDataURL(file) {
      peak = Math.max(peak, ++active);
      setTimeout(() => {
        active--;
        if (file.name === "broken.png") this.onerror();
        else this.onload({ target: { result: `data:image/png;base64,${file.name}` } });
      }, 2);
    }
  };
  t.after(() => { globalThis.FileReader = originalReader; });
  const { createAttachedFilesHandler } = await controller("src/lib/attachedFilesHandler.ts", {
    dicomHelpers: `export const decodeDicomForDisplay = async () => { throw new Error('Unused synthetic decoder'); };
      export const compressImageForAttachment = async (dataUrl) => ({dataUrl, width: 100, height: 100});`,
    jszip: "export default class SyntheticZip {}",
  });
  const files = ["a.png", "broken.png", "b.png", "c.png", "d.png"].map((name) => ({ name, size: 100, type: "image/png" }));
  await createAttachedFilesHandler({
    detectImageMetaFromFilename: () => ({}), modality: "US",
    setAttachedImages: (update) => { images = update(images); },
  })(files);
  assert.equal(peak, 2);
  assert.deepEqual(images.map((x) => x.name).sort(), ["a.png", "b.png", "c.png", "d.png"]);
  assert.ok(images.every((x) => x.width === 100 && x.height === 100));
});

test("two ZIP imports bound decompression to four entries and retain all images", { timeout: 3000 }, async (t) => {
  const originalReader = globalThis.FileReader;
  globalThis.FileReader = class {};
  let active = 0, peak = 0, images = [];
  globalThis.__syntheticZip = {
    async loadAsync(file) {
      return { files: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [
        `${file.name}-${i}.png`, {
          async async() {
            peak = Math.max(peak, ++active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            active--;
            return new Uint8Array([1, 2, 3]);
          },
        },
      ])) };
    },
  };
  t.after(() => { globalThis.FileReader = originalReader; delete globalThis.__syntheticZip; });
  const { createAttachedFilesHandler } = await controller("src/lib/attachedFilesHandler.ts", {
    dicomHelpers: `export const decodeDicomForDisplay = async () => {};
      export const compressImageForAttachment = async (dataUrl) => ({dataUrl, width: 100, height: 100});`,
    jszip: "export default class SyntheticZip { loadAsync(file) { return globalThis.__syntheticZip.loadAsync(file); } }",
  });
  await createAttachedFilesHandler({
    detectImageMetaFromFilename: () => ({}), modality: "US",
    setAttachedImages: (update) => { images = update(images); },
  })(["first.zip", "second.zip"].map((name) => ({ name, size: 100, type: "application/zip" })));
  assert.equal(peak, 4);
  assert.equal(images.length, 10);
  assert.equal(new Set(images.map((x) => x.name)).size, 10);
});
