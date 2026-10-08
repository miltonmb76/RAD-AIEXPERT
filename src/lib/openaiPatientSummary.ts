/**
 * Optional OpenAI text helper for "Explicación para el paciente".
 * Only used when OPENAI_API_KEY is present; otherwise the app stays on Gemini.
 */

import OpenAI from "openai";

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
