import fs from "fs";
import { renderPatientInfographicPng } from "../src/lib/patientInfographicSvgRender.ts";

const brief = {
  title: "Tu ultrasonido de tejidos blandos",
  subtitle: "Resultado explicado de forma sencilla",
  layout: "hero_metric",
  hero: {
    title: "Hallazgo principal",
    metric: "Lipoma",
    status: "Benigno",
    statusTone: "reassuring",
    body: "Es un tumor de grasa benigno, muy frecuente y no canceroso.",
    detail: "Ubicación: tejido subcutáneo",
  },
  cards: [],
  callout: "No requiere cirugía de urgencia.",
  restNormal: ["Sin signos de infección", "Sin compromiso vascular"],
  keyMessage: "Puedes llevar una vida normal; control según tu médico.",
  disclaimer: "Esta lámina es educativa y no sustituye la consulta médica.",
};

const { pngBase64, layout } = await renderPatientInfographicPng(brief);
fs.mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
const out = "/opt/cursor/artifacts/screenshots/infographic-font-fix.png";
fs.writeFileSync(out, Buffer.from(pngBase64, "base64"));
console.log("layout", layout, "bytes", Buffer.from(pngBase64, "base64").length, "->", out);
