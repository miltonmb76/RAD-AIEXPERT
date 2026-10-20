/**
 * Optional OpenAI text helper for "Explicación para el paciente".
 * Only used when OPENAI_API_KEY is present; otherwise the app stays on Gemini.
 */

import OpenAI from "openai";
import {
  listMustKeepPathologySentences,
  listPathologyAnchorsFromText,
} from "./patientSummaryAudio";

export function cleanOpenAiKey(key: string): string {
  if (!key) return "";
  let clean = key.trim();
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, "");
  clean = clean.replace(/\\"/g, '"').replace(/\\'/g, "'");

  if (clean.includes("=")) {
    const parts = clean.split("=");
    const prefix = parts[0].toLowerCase();
    if (
      prefix.includes("openai") ||
      prefix.includes("secret") ||
      prefix.includes("key") ||
      prefix.includes("export") ||
      prefix.includes("env")
    ) {
      clean = parts.slice(1).join("=").trim();
    }
  }

  const quoteChars = ['"', "'", "\u201c", "\u201d", "\u2018", "\u2019", "`", "\\"];
  let changed = true;
  while (changed) {
    changed = false;
    for (const char of quoteChars) {
      if (clean.startsWith(char)) {
        clean = clean.slice(1);
        changed = true;
      }
      if (clean.endsWith(char)) {
        clean = clean.slice(0, -1);
        changed = true;
      }
    }
    const beforeTrim = clean;
    clean = clean.trim();
    if (clean !== beforeTrim) changed = true;
  }
  return clean;
}

export function hasOpenAiApiKey(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv");
    dotenv.config({ override: true });
  } catch (_) {}
  return Boolean(cleanOpenAiKey(process.env.OPENAI_API_KEY || ""));
}

export type PatientSummaryPayload = {
  studyOverview: string;
  summary: string;
  keyFindings: Array<{
    title: string;
    originalTerm: string;
    simplifiedExplanation: string;
    analogy: string;
    clinicalContext: string;
    reassurance: string;
  }>;
  glossary: Array<{ term: string; plainDefinition: string }>;
};

function normalizePatientSummary(parsed: any): PatientSummaryPayload {
  const findings = Array.isArray(parsed?.keyFindings)
    ? parsed.keyFindings.map((f: any) => ({
        title: f?.title || "",
        originalTerm: f?.originalTerm || "",
        simplifiedExplanation: f?.simplifiedExplanation || "",
        analogy: f?.analogy || "",
        clinicalContext: f?.clinicalContext || f?.reassurance || "",
        reassurance: f?.clinicalContext || f?.reassurance || "",
      }))
    : [];
  const glossary = Array.isArray(parsed?.glossary)
    ? parsed.glossary
        .map((g: any) => ({
          term: String(g?.term || "").trim(),
          plainDefinition: String(g?.plainDefinition || g?.definition || "").trim(),
        }))
        .filter((g: any) => g.term && g.plainDefinition)
    : [];
  return {
    studyOverview: parsed?.studyOverview || "",
    summary: parsed?.summary || "",
    keyFindings: findings,
    glossary,
  };
}

export function normalizePatientSummaryPayload(parsed: any): PatientSummaryPayload {
  return normalizePatientSummary(parsed);
}

/**
 * Generate patient explanation JSON via OpenAI Chat Completions.
 * Throws on missing key / API / parse errors (caller falls back to Gemini).
 */
export async function generatePatientSummaryOpenAI(args: {
  report: string;
  studyType?: string;
  clinicalHistory?: string;
  systemInstruction: string;
  userPrompt: string;
}): Promise<{ data: PatientSummaryPayload; model: string }> {
  const apiKey = cleanOpenAiKey(process.env.OPENAI_API_KEY || "");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const model = (process.env.OPENAI_TEXT_MODEL || "gpt-4o").trim() || "gpt-4o";
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.systemInstruction },
      {
        role: "user",
        content: `${args.userPrompt}

Responde SOLO con un objeto JSON válido con las claves:
studyOverview (string), summary (string),
keyFindings (array de objetos con title, originalTerm, simplifiedExplanation, analogy, clinicalContext),
glossary (array de objetos con term, plainDefinition).`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";
  let jsonText = String(raw).trim();
  if (jsonText.startsWith("```")) {
    const firstLineEnd = jsonText.indexOf("\n");
    if (firstLineEnd !== -1) jsonText = jsonText.substring(firstLineEnd).trim();
    if (jsonText.endsWith("```")) jsonText = jsonText.substring(0, jsonText.length - 3).trim();
  }

  const parsed = JSON.parse(jsonText);
  const data = normalizePatientSummary(parsed);
  if (!data.summary && !data.studyOverview && data.keyFindings.length === 0) {
    throw new Error("OpenAI devolvió un JSON vacío para la explicación del paciente.");
  }
  return { data, model };
}

/**
 * AI spoken script from the first 2 patient-PDF sections:
 * studyOverview («Qué estudio se le realizó») + summary («En pocas palabras»).
 * Returns plain text only. Caller expands Romans / runs TTS.
 */
export async function generatePatientSummaryAudioScriptOpenAI(args: {
  patientSummary: PatientSummaryPayload | Record<string, unknown>;
  includeFollowUp?: boolean;
  followUpText?: string;
  studyType?: string;
  patientFirstName?: string;
}): Promise<{ script: string; model: string }> {
  const apiKey = cleanOpenAiKey(process.env.OPENAI_API_KEY || "");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }
  const model = (process.env.OPENAI_TEXT_MODEL || "gpt-4o").trim() || "gpt-4o";
  const openai = new OpenAI({ apiKey });
  const includeFollowUp = args.includeFollowUp === true;
  const ps = args.patientSummary as any;
  const studyOverview = String(ps?.studyOverview || "").trim();
  const summary = String(ps?.summary || "").trim();
  if (!studyOverview && !summary) {
    throw new Error("Faltan las secciones studyOverview / summary para el guion de audio.");
  }

  const pathologyAnchors = listPathologyAnchorsFromText(summary);
  const mustSentences = listMustKeepPathologySentences(
    { studyOverview, summary },
    includeFollowUp
  );

  const system = includeFollowUp
    ? "Eres redactor de guiones hablados para pacientes de radiología. PRIORIDAD: no omitir ningún hallazgo patológico de «En pocas palabras». Puedes mencionar seguimiento solo si se te da texto de seguimiento."
    : "Eres redactor de guiones hablados para pacientes de radiología. PRIORIDAD: no omitir ningún hallazgo patológico de «En pocas palabras» (riñones, nefropatía, hígado, lesiones, etc.). PROHIBIDO recomendaciones, tratamiento, controles, biopsias o 'qué hacer'.";

  const user = `Redacta un GUION HABLADO en español (para audio WhatsApp) usando SOLO estas dos secciones del PDF de explicación al paciente.

Nombre (opcional): ${args.patientFirstName || "(sin nombre)"}
Estudio: ${args.studyType || "(no especificado)"}
Incluir seguimiento: ${includeFollowUp ? "SÍ" : "NO"}
Texto de seguimiento (solo si aplica): ${includeFollowUp ? args.followUpText || "" : "(no usar)"}

SECCIÓN 1 — Qué estudio se le realizó:
${studyOverview || "(vacía)"}

SECCIÓN 2 — En pocas palabras:
${summary || "(vacía)"}

Hallazgos patológicos que DEBEN aparecer en el audio (si la lista no está vacía): ${
    pathologyAnchors.length ? pathologyAnchors.join(" · ") : "(derivar de la sección 2)"
  }
Frases patológicas a conservar (sentido clínico, no hace falta citar literal):
${mustSentences.length ? mustSentences.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(ninguna marcada)"}

REGLAS OBLIGATORIAS:
1. Fuente de verdad: únicamente las dos secciones anteriores. No inventes hallazgos.
2. PRIORIDAD MÁXIMA: todo hallazgo patológico de la sección 2 debe mencionarse. Si habla de nefropatía, riñones, hígado, ovario, nódulos, etc., NO los omitas aunque el texto sea largo.
3. Puedes alisar el texto para que suene hablado, pero sin eliminar órganos ni patologías.
4. Estructura: saludo breve → narrar sección 1 → narrar sección 2 completa en sentido clínico → cierre breve.
5. Frases claras, tono profesional y cálido. Sin markdown, sin viñetas, sin comillas decorativas.
6. ${
    includeFollowUp
      ? "Puedes añadir al final el seguimiento indicado."
      : "NO menciones recomendaciones, tratamiento ni plan de seguimiento."
  }
7. Longitud: la necesaria para cubrir los hallazgos patológicos (aprox. 45 a 180 segundos). Mejor un poco más largo que omitir un riñón o una nefropatía.
8. Responde SOLO con el texto del guion.`;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.25,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  let script = String(completion.choices?.[0]?.message?.content || "")
    .replace(/^```[\s\S]*?\n/, "")
    .replace(/```$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!script || script.length < 40) {
    throw new Error("OpenAI devolvió un guion de audio vacío.");
  }
  // Soft cap for TTS API (~4096 chars)
  if (script.length > 3900) {
    script = script.slice(0, 3900);
    const cut = Math.max(script.lastIndexOf("."), script.lastIndexOf("!"), script.lastIndexOf("?"));
    if (cut > 2000) script = script.slice(0, cut + 1);
  }
  return { script, model };
}

/** Default delivery style for patient WhatsApp audio (gpt-4o-mini-tts only). */
export const PATIENT_TTS_INSTRUCTIONS =
  "Habla en español latinoamericano con voz cálida, clara y profesional. " +
  "Ritmo calmado de explicación clínica breve (como un radiólogo que resume hallazgos al paciente). " +
  "Sin dramatismo ni tono publicitario. Pronuncia bien términos médicos en español. " +
  "Pausas naturales entre oraciones.";

/**
 * OpenAI TTS for patient WhatsApp audio (mp3).
 * Defaults to gpt-4o-mini-tts + marin (more natural than browser / tts-1).
 * Caller must already have built a short spoken script (no treatment unless opted in).
 */
export async function synthesizePatientSummarySpeech(args: {
  text: string;
  voice?: string;
  /** Style instructions — ignored by tts-1 / tts-1-hd. */
  instructions?: string;
}): Promise<{ buffer: Buffer; model: string; voice: string }> {
  const apiKey = cleanOpenAiKey(process.env.OPENAI_API_KEY || "");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }
  const text = String(args.text || "").replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("Texto vacío para TTS");
  }
  // OpenAI TTS hard limit ~4096 chars (full-finding scripts usually fit).
  if (text.length > 4000) {
    throw new Error("El guion de audio supera el límite permitido.");
  }
  const model =
    (process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim() || "gpt-4o-mini-tts";
  const voice = (args.voice || process.env.OPENAI_TTS_VOICE || "marin").trim() || "marin";
  const instructions = String(
    args.instructions || process.env.OPENAI_TTS_INSTRUCTIONS || PATIENT_TTS_INSTRUCTIONS
  ).trim();
  const openai = new OpenAI({ apiKey });

  const request: Record<string, unknown> = {
    model,
    voice: voice as any,
    input: text,
    response_format: "mp3",
  };
  // Steerability (accent/tone) only on gpt-4o-mini-tts family — not tts-1 / tts-1-hd.
  if (instructions && !/^tts-1/i.test(model)) {
    request.instructions = instructions;
  }

  const speech = await openai.audio.speech.create(request as any);
  const arrayBuffer = await speech.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), model, voice };
}
