import assert from "node:assert/strict";
import sharp from "sharp";
import { jsPDF } from "jspdf";

// Runtime-only format check. A neutral fixture is not a clinical illustration.
// No network, AI client, credentials or real patient data are used.
for (const format of ["png", "jpeg"]) {
  const image = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#e6eef5" } })[format]().toBuffer();
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 800);
  const pdf = new jsPDF();
  const height = 190 * metadata.height / metadata.width;
  assert.ok(height < 277, "The synthetic poster must fit inside an A4 page");
  pdf.addImage(image, format === "png" ? "PNG" : "JPEG", 10, 10, 190, height);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.ok(pdf.output("arraybuffer").byteLength > 1000);
  console.log(`MSK_PDF_OK ${format} 600x800`);
}
