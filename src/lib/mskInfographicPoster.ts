import sharp from "sharp";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveMskLaterality, type MskImageContract } from "./mskImageLaterality";
import { redactPatientIdentifiersForInfographic } from "./infographicPrivacy";

const inFlight = new Map<string, Promise<string>>();

/** Share only simultaneous work for the same authenticated owner and source.
 * No completed image or clinical source is retained in this map. */
export function shareMskAnatomy(scope: string, contract: MskImageContract, generate: () => Promise<string>): Promise<string> {
  const key = createHash("sha256").update(JSON.stringify([scope, contract])).digest("hex");
  const existing = inFlight.get(key);
  if (existing) return existing;
  if (inFlight.size >= 8) return generate();
  const pending = Promise.resolve().then(generate).finally(() => {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  });
  inFlight.set(key, pending);
  return pending;
}

/** This text is typeset by the application, never painted or rewritten by AI. */
export function mskPosterSource(report: string, contract?: MskImageContract): string {
  const text = redactPatientIdentifiersForInfographic(report)
    .split(/\r?\n/)
    .filter(line => !/^\s*(?:fecha(?:\s+de\s+nacimiento)?|nacimiento|edad|sexo|g[eé]nero|tel[eé]fono|correo|email|direcci[oó]n|m[eé]dico|doctor|profesional|registro|expediente|documento|identificaci[oó]n)\s*[:：]/i.test(line))
    .filter(line => !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\//i.test(line))
    .map(line => line.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean).join("\n").trim();
  // Recommendations are not clinical findings. Keep this poster explanatory,
  // including when the source report also has a separate management section.
  let adviceSection = false;
  const clinicalText = text.split("\n").filter(line => {
    if (/^(?:recomendaciones?|conducta|tratamiento|seguimiento|plan)\s*(?:[:：]|$)/i.test(line)) { adviceSection = true; return false; }
    if (/^(?:hallazgos|conclusi[oó]n|impresi[oó]n|diagn[oó]stico)\s*[:：]/i.test(line)) adviceSection = false;
    return !adviceSection;
  }).map(line => line.split(/(?<=[.!?;])\s+/).map(sentence => {
    const advice = /\b(?:se\s+(?:recomienda|sugiere|aconseja)|recomendamos|recomiendo|sugerimos|sugiero|correlacionar\s+con|acudir\s+a|consultar\s+con)\b/i.exec(sentence);
    return advice ? sentence.slice(0, advice.index).replace(/[,;:\s]+$/, "") : sentence;
  }).filter(Boolean).join(" ")).filter(Boolean).join("\n").trim();
  const sourceSide = resolveMskLaterality(clinicalText);
  if (contract && contract.side !== "bilateral" && (sourceSide === "right" || sourceSide === "left") && sourceSide !== contract.side) {
    throw new Error("El lado del informe no coincide con el lado seleccionado. Corrige el informe final antes de generar la infografía.");
  }
  if (!clinicalText) throw new Error("Se requiere un informe clínico sin identificadores para la infografía.");
  if (clinicalText.length > 6000) throw new Error("El informe es demasiado extenso para esta lámina. Selecciona un fragmento clínico más breve antes de generar.");
  return clinicalText;
}

export function mskPosterGlossary(source: string): string {
  const definitions: Array<[RegExp, string]> = [
    [/\btendinosis\b/i, "Tendinosis: término que describe una alteración del tendón."],
    [/\bsupraespinoso\b/i, "Supraespinoso: uno de los tendones del hombro."],
    [/\brotura parcial\b/i, "Rotura parcial: desgarro que afecta solo a una parte de la estructura descrita."],
    [/\bbursal\b/i, "Bursal: superficie del tendón próxima a la bolsa que facilita su deslizamiento."],
    [/\b(?:menisco (?:interno|medial)|medial|interno)\b/i, "Interno o medial: hacia el centro del cuerpo."],
    [/\b(?:menisco (?:externo|lateral)|externo)\b/i, "Externo o lateral: hacia el lado externo del cuerpo."],
  ];
  return definitions.filter(([pattern]) => pattern.test(source)).map(([, definition]) => definition).join("\n\n");
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function mskPosterOrientation(contract: MskImageContract): { left: boolean; right: boolean; y: number } {
  const patientLeftAtViewerRight = contract.view === "AP";
  return {
    left: contract.side === "bilateral" || (contract.side === "left" ? !patientLeftAtViewerRight : patientLeftAtViewerRight),
    right: contract.side === "bilateral" || (contract.side === "left" ? patientLeftAtViewerRight : !patientLeftAtViewerRight),
    y: contract.organ === "shoulder" ? 64 : 161,
  };
}

let renders = 0;
const waiting: Array<() => void> = [];
export async function withMskPosterRenderLimit<T>(run: () => Promise<T>): Promise<T> {
  if (renders >= 2) {
    if (waiting.length >= 6) throw new Error("Hay varias infografías procesándose. Vuelve a intentar en unos instantes.");
    await new Promise<void>(resolve => waiting.push(resolve));
  } else renders++;
  try { return await run(); }
  finally {
    const next = waiting.shift();
    if (next) next(); else renders--;
  }
}

/** Compose an approved, text-free anatomy image with source text in real fonts.
 * Returns PNG for the existing viewer and PDF annex paths; never a remote URL. */
export async function renderMskInfographicPoster(args: {
  anatomyImageUrl: string;
  report: string;
  contract: MskImageContract;
  audience: "patient" | "clinician";
}): Promise<string> {
  const source = mskPosterSource(args.report, args.contract);
  const image = args.anatomyImageUrl.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!image || image[1].length > 16_000_000) throw new Error("La ilustración anatómica no tiene un formato válido.");
  return withMskPosterRenderLimit(async () => {
    const patient = args.audience === "patient";
    const accent = patient ? "#087e8b" : "#315a85";
    const organ = args.contract.organ === "shoulder" ? "Hombro" : "Rodilla";
    const side = args.contract.side === "left" ? "izquierdo" : args.contract.side === "right" ? "derecho" : "bilateral";
    const title = `${organ} ${side}`;
    const layers: sharp.OverlayOptions[] = [];
    const addText = async (text: string, left: number, top: number, width: number, size: number, color: string, bold = false) => {
      const rendered = await sharp({ text: {
        text: `<span foreground="${color}">${escape(text)}</span>`,
        font: `Inter ${bold ? "Semi-Bold " : ""}${size}`,
        fontfile: path.resolve("assets/fonts", bold ? "Inter-SemiBold.ttf" : "Inter-Regular.ttf"),
        width, dpi: 72, rgba: true, wrap: "word-char", spacing: Math.round(size * .3),
      } }).png().toBuffer({ resolveWithObject: true });
      layers.push({ input: rendered.data, left, top });
      return top + rendered.info.height;
    };
    await addText(patient ? "EXPLICACIÓN PARA EL PACIENTE" : "ANEXO CLÍNICO · HALLAZGOS DOCUMENTADOS", 72, 58, 1456, 24, accent, true);
    await addText(title, 72, 108, 1456, 62, "#142d45", true);
    await addText(patient ? "Tu resultado, acompañado de una ilustración anatómica" : "Ilustración anatómica y texto del informe", 72, 200, 1456, 28, "#536579");
    let textBottom = await addText(patient ? "LO QUE DICE TU INFORME" : "INFORME", 856, 324, 640, 24, accent, true);
    textBottom = await addText(source, 856, textBottom + 34, 640, 33, "#20374c");
    const glossary = patient ? mskPosterGlossary(source) : "";
    if (glossary) {
      textBottom = await addText("PALABRAS DEL INFORME", 856, textBottom + 64, 640, 23, accent, true);
      textBottom = await addText(glossary, 856, textBottom + 28, 640, 27, "#526578");
    }
    const height = Math.max(1660, textBottom + 220);
    if (height > 5400) throw new Error("El texto no cabe con un tamaño legible. Usa un fragmento más breve del informe.");
    const artwork = await sharp(Buffer.from(image[1], "base64"), { limitInputPixels: 16_000_000 })
      .rotate().resize(680, 1000, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    layers.push({ input: artwork, left: 88, top: 304 });
    const orientation = mskPosterOrientation(args.contract);
    const markers = [orientation.left ? `<circle cx="76" cy="${orientation.y}" r="13" fill="${accent}"/>` : "",
      orientation.right ? `<circle cx="144" cy="${orientation.y}" r="13" fill="${accent}"/>` : ""].join("");
    const silhouette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="230"><circle cx="110" cy="27" r="20" fill="#cbd5df"/><path d="M80 56 Q110 45 140 56 L150 112 L135 122 L134 211 L115 211 L110 139 L105 211 L86 211 L85 122 L70 112 Z" fill="#dce4ec"/><path d="M79 62 L55 113 M141 62 L165 113" stroke="#cbd5df" stroke-width="18" stroke-linecap="round"/>${markers}</svg>`);
    layers.push({ input: silhouette, left: 108, top: 1340 });
    await addText("Lado del paciente", 340, 1370, 420, 25, "#526578", true);
    await addText(`${organ} ${side}\n${args.contract.view === "AP" ? "Referencia de frente" : "Referencia de espalda"}`, 340, 1418, 420, 26, accent);
    await addText("Ilustración orientativa · no sustituye el informe ni la revisión del médico.", 72, height - 90, 1456, 24, "#64748b");
    const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}"><rect width="1600" height="${height}" fill="#f5f8fb"/><rect x="32" y="32" width="1536" height="${height - 64}" rx="28" fill="#ffffff"/><rect x="32" y="32" width="1536" height="8" fill="${accent}"/><rect x="64" y="280" width="728" height="1030" rx="24" fill="#ffffff" stroke="#e2e8ef" stroke-width="2"/><path d="M824 300V${height - 144}" stroke="#e2e8ef" stroke-width="2"/></svg>`);
    const output = await sharp(background).composite(layers).png().toBuffer();
    return `data:image/png;base64,${output.toString("base64")}`;
  });
}
