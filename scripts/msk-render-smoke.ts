import assert from "node:assert/strict";
import sharp from "sharp";
import { jsPDF } from "jspdf";
import { renderMskInfographicPoster } from "../src/lib/mskInfographicPoster";
import type { MskImageContract } from "../src/lib/mskImageLaterality";

// Runs without a server, network, API keys or patient data. The Docker runtime
// must render these fixtures successfully before its image can be published.
const shoulder = "Hombro izquierdo: tendinosis del supraespinoso con rotura parcial bursal de 6 × 3 mm. Hombro derecho sin hallazgos.";
const knee = "Rodilla derecha: lesión focal ficticia de 6 mm en el cuerno posterior del menisco externo, adyacente al peroné. Menisco interno sin alteraciones descritas.";
const neutral = await sharp({ create: { width: 500, height: 700, channels: 3, background: "#e6eef5" } }).png().toBuffer();
const anatomyImageUrl = `data:image/png;base64,${neutral.toString("base64")}`;

for (const [organ, side, view, report] of [
  ["shoulder", "left", "AP", shoulder],
  ["knee", "right", "PA", knee],
] as const) {
  const contract: MskImageContract = { organ, side, view, format: "anatomy", clinicalSite: report };
  // Exercise the simultaneous patient/clinician path used by the application.
  await Promise.all((["patient", "clinician"] as const).map(async audience => {
    const imageUrl = await renderMskInfographicPoster({ anatomyImageUrl, report, contract, audience });
    const png = Buffer.from(imageUrl.split(",")[1], "base64");
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 1660, "A brief synthetic report must fit the normal poster height");
    // Verify real pixels in the report column, not just a valid blank PNG.
    const textPixels = await sharp(png).extract({ left: 856, top: 324, width: 640, height: 500 }).removeAlpha().raw().toBuffer();
    let ink = 0;
    for (let pixel = 0; pixel < textPixels.length; pixel += 3) {
      if (textPixels[pixel] < 150 && textPixels[pixel + 1] < 170 && textPixels[pixel + 2] < 190) ink++;
    }
    assert.ok(ink > 3000, "The report column must contain visible text");
    const pdf = new jsPDF();
    pdf.addImage(imageUrl, "PNG", 10, 10, 190, 190 * metadata.height! / metadata.width!);
    assert.ok(pdf.output("arraybuffer").byteLength > 1000);
    console.log(`MSK_RENDER_OK ${organ} ${view} ${audience} ${metadata.width}x${metadata.height}`);
  }));
}
