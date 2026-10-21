import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { jsPDF } from "jspdf";
import { mskPosterSource, mskPosterGlossary, mskPosterOrientation, renderMskInfographicPoster, shareMskAnatomy, withMskPosterRenderLimit } from "../src/lib/mskInfographicPoster.ts";
import { acceptsMskVisualCheck } from "../src/lib/mskImageLaterality.ts";

const report = "Hombro izquierdo: tendinosis del supraespinoso con rotura parcial bursal de 6 × 3 mm. Hombro derecho sin hallazgos.";
const contract = { organ: "shoulder", side: "left", view: "AP", format: "anatomy", clinicalSite: report };

test("the exact synthetic source never acquires bursa or biceps findings", () => {
  assert.equal(mskPosterSource(report, contract), report);
  assert.doesNotMatch(mskPosterSource(report), /reactiv|b[ií]ceps|derrame|Dibujar/);
  const definitions = mskPosterGlossary(report);
  assert.match(definitions, /Rotura parcial: desgarro/);
  assert.doesNotMatch(definitions, /inflamaci[oó]n|reactiv|sin hallazgos|tratamiento/);
  assert.throws(() => mskPosterSource("Hombro derecho: hallazgo ficticio", contract), /lado del informe/);
});

test("identity header lines are excluded before typesetting and layout limits never silently truncate", () => {
  const source = mskPosterSource("Paciente: FICTICIO\nEdad: 99\nFecha de nacimiento: FICTICIA\nTeléfono: FICTICIO\nCorreo: prueba@example.invalid\n" + report);
  assert.equal(source, report);
  assert.equal(mskPosterSource(report + "\nRecomendaciones:\nControl ecográfico en seis meses."), report);
  assert.equal(mskPosterSource(report + " Se recomienda control ecográfico."), report);
  assert.throws(() => mskPosterSource("x".repeat(6001)), /demasiado extenso/);
});

test("the app's orientation icon uses the correct patient side for both views and joints", () => {
  for (const organ of ["shoulder", "knee"]) for (const view of ["AP", "PA"]) for (const side of ["left", "right", "bilateral"]) {
    const map = mskPosterOrientation({ ...contract, organ, view, side });
    const right = side === "bilateral" || (side === "left") === (view === "AP");
    assert.equal(map.right, right);
    assert.equal(map.left, side === "bilateral" || !right);
    assert.equal(map.y, organ === "shoulder" ? 64 : 161);
  }
});

test("anatomy containing AI-painted text is not accepted for composition", () => {
  const observation = { anatomicalSide: "left", view: "AP", lateralLandmarkPosition: "right", medialLandmarkPosition: "left", landmarksVisible: true, clinicalSiteMatches: true, allPanelsConsistent: true, noUnsupportedFindings: true, observations: ["Synthetic visible landmarks only"] };
  assert.equal(acceptsMskVisualCheck(observation, contract), false);
  assert.equal(acceptsMskVisualCheck({ ...observation, visibleTextAbsent: false }, contract), false);
  assert.equal(acceptsMskVisualCheck({ ...observation, visibleTextAbsent: true }, contract), true);
  assert.equal(acceptsMskVisualCheck({ ...observation, visibleTextAbsent: true, noUnsupportedFindings: false }, contract), false);
});

test("patient and clinician share only concurrent anatomy; failures and completed work are released", async () => {
  let release; let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const generate = async () => { calls++; await gate; return "synthetic-anatomy"; };
  const first = shareMskAnatomy("synthetic-owner", contract, generate);
  const second = shareMskAnatomy("synthetic-owner", contract, generate);
  assert.equal(first, second);
  await Promise.resolve(); assert.equal(calls, 1);
  release(); assert.deepEqual(await Promise.all([first, second]), ["synthetic-anatomy", "synthetic-anatomy"]);
  await shareMskAnatomy("synthetic-owner", contract, async () => { calls++; return "new-image"; });
  assert.equal(calls, 2);
  const owners = await Promise.all([
    shareMskAnatomy("owner-a", contract, async () => "image-a"),
    shareMskAnatomy("owner-b", contract, async () => "image-b"),
  ]);
  assert.deepEqual(owners, ["image-a", "image-b"]);
  await assert.rejects(shareMskAnatomy("synthetic-owner", contract, async () => { throw new Error("synthetic failure"); }), /synthetic failure/);
  assert.equal(await shareMskAnatomy("synthetic-owner", contract, async () => "recovered"), "recovered");
});

test("real fonts render both posters as valid PNG and existing PDF image embedding accepts them", async () => {
  // Neutral image fixture, intentionally not an anatomical or clinical illustration.
  const neutral = await sharp({ create: { width: 500, height: 700, channels: 3, background: "#e6eef5" } }).png().toBuffer();
  for (const audience of ["patient", "clinician"]) {
    const imageUrl = await renderMskInfographicPoster({ anatomyImageUrl: `data:image/png;base64,${neutral.toString("base64")}`, report, contract, audience });
    assert.match(imageUrl, /^data:image\/png;base64,/);
    const bytes = Buffer.from(imageUrl.split(",")[1], "base64");
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 1600); assert.ok(meta.height >= 1660 && meta.height <= 5400);
    const doc = new jsPDF();
    doc.addImage(imageUrl, "PNG", 10, 10, 190, 190 * meta.height / meta.width);
    assert.ok(doc.output("arraybuffer").byteLength > 1000);
    await writeFile(`/private/tmp/rad-msk-typeset-${audience}.png`, bytes);
  }
  await assert.rejects(renderMskInfographicPoster({ anatomyImageUrl: "https://invalid.example/image", report, contract, audience: "patient" }), /formato válido/);
});


test("poster rendering bounds concurrent memory work and recovers after a queued failure", async () => {
  let release; let active = 0; let peak = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const jobs = Array.from({ length: 8 }, (_, i) => withMskPosterRenderLimit(async () => {
    active++; peak = Math.max(peak, active);
    try { await gate; if (i === 2) throw new Error("synthetic render failure"); return i; }
    finally { active--; }
  }));
  assert.equal(active, 2);
  await assert.rejects(withMskPosterRenderLimit(async () => 9), /varias infografías/);
  release(); const results = await Promise.allSettled(jobs);
  assert.equal(peak, 2); assert.equal(active, 0);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.equal(await withMskPosterRenderLimit(async () => "recovered"), "recovered");
});
