import assert from "node:assert/strict";
import { test } from "node:test";
import { createInfographicExecution, InfographicExecutionError } from "../src/lib/infographicExecution.ts";
import { requestInfographic } from "../src/lib/infographicRequest.ts";
import { GoogleGenAI } from "@google/genai";

test("a provider that ignores abort still cannot hold the request or start another stage", { timeout: 1000 }, async () => {
  const execution = createInfographicExecution({ image: 10 });
  let config;
  await assert.rejects(execution.run("image", c => { config = c; return new Promise(() => {}); }), error =>
    error instanceof InfographicExecutionError && error.reason === "stage_timeout");
  assert.equal(config.abortSignal.aborted, true);
  let started = false;
  await assert.rejects(execution.run("review", async () => { started = true; }));
  assert.equal(started, false);
  assert.deepEqual(execution.diagnostics().calls, { plan: 0, image: 1, review: 0 });
});

test("all stages share one request deadline instead of receiving a fresh total budget", { timeout: 1000 }, async () => {
  let clock = 0;
  const execution = createInfographicExecution({ total: 10_000 }, () => clock);
  await execution.run("plan", async () => { clock += 4_000; });
  await execution.run("image", async c => {
    assert.equal(c.httpOptions.timeout, 6_000);
    clock += 5_000;
  });
  clock += 2_000;
  let started = false;
  await assert.rejects(execution.run("review", async () => { started = true; }), error => error.reason === "deadline");
  assert.equal(started, false);
  assert.equal(execution.diagnostics().stopReason, "deadline");
});

test("a disconnected request ends without persisting sensitive provider content in diagnostics", async () => {
  const execution = createInfographicExecution();
  const running = execution.run("image", async () => new Promise(() => {}));
  execution.cancel();
  await assert.rejects(running, error => error.reason === "disconnected");
  const other = createInfographicExecution();
  const providerError = Object.assign(new Error("PRIVATE report or key in a provider error"), { status: 403 });
  await assert.rejects(other.run("plan", async () => { throw providerError; }));
  let started = false;
  await assert.rejects(other.run("image", async () => { started = true; }));
  assert.equal(started, false);
  assert.doesNotMatch(JSON.stringify(other.diagnostics()), /PRIVATE|report|key/);
});

test("browser wait expires and aborts only the affected audience", { timeout: 1000 }, async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let patientSignal;
  globalThis.fetch = async (_url, opts) => {
    if (JSON.parse(opts.body).audience === "clinician") return { ok: true, json: async () => ({ success: true, imageUrl: "synthetic-clinician" }) };
    patientSignal = opts.signal;
    return new Promise((_resolve, reject) => opts.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  };
  const patient = requestInfographic({ audience: "patient" }, undefined, 10);
  const clinician = requestInfographic({ audience: "clinician" }, undefined, 100);
  assert.equal((await clinician).imageUrl, "synthetic-clinician");
  await assert.rejects(patient, /agotó el tiempo/);
  assert.equal(patientSignal.aborted, true);
});

test("the installed Gemini SDK makes one HTTP request on outage and forwards cancellation, offline", { timeout: 2000 }, async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  // Match the app's actual client: no client-level retryOptions. Stub fetch
  // before creating the SDK client; nothing can contact Google or use real keys.
  const ai = new GoogleGenAI({ apiKey: "synthetic-not-a-real-key", httpOptions: { headers: { "User-Agent": "synthetic-test" } } });
  let requests = 0, signal;
  globalThis.fetch = async (_url, options) => {
    requests++; signal = options.signal;
    return new Response(JSON.stringify({ error: { code: 503, message: "Synthetic outage", status: "UNAVAILABLE" } }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  };
  const outage = createInfographicExecution();
  await assert.rejects(outage.run("image", config => ai.models.generateContent({
    model: "synthetic-model", contents: "Synthetic test", config,
  })), error => error.status === 503);
  assert.equal(requests, 1);
  assert.equal(outage.diagnostics().stopReason, "provider_error");
  globalThis.fetch = async (_url, options) => {
    requests++; signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Synthetic abort")), { once: true }));
  };
  const cancellation = createInfographicExecution({ image: 30 });
  await assert.rejects(cancellation.run("image", config => ai.models.generateContent({
    model: "synthetic-model", contents: "Synthetic test", config,
  })), error => error.reason === "stage_timeout");
  assert.equal(requests, 2);
  assert.equal(signal.aborted, true);
});
