/**
 * Structured brief for patient infographics.
 * Text model invents content/layout; renderer draws real Spanish text.
 */

export type InfographicTone = "calm" | "attention" | "reassuring";
export type InfographicLayout =
  | "hero_metric"
  | "two_cards"
  | "findings_stack"
  | "split_focus";

export type InfographicCard = {
  title: string;
  metric?: string;
  status?: string;
  statusTone?: InfographicTone;
  body: string;
  detail?: string;
};

export type PatientInfographicBrief = {
  title: string;
  subtitle: string;
  layout: InfographicLayout;
  hero?: InfographicCard | null;
  cards: InfographicCard[];
  callout?: string;
  restNormal?: string[];
  keyMessage?: string;
  disclaimer: string;
};

const DEFAULT_DISCLAIMER =
  "Resumen informativo basado en el reporte radiológico. Los hallazgos deben interpretarse junto con los síntomas y la valoración médica.";

function cleanText(v: any, max = 220): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>&]/g, "")
    .trim()
    .slice(0, max);
}

function normalizeCard(raw: any): InfographicCard | null {
  if (!raw || typeof raw !== "object") return null;
  const title = cleanText(raw.title, 80);
  const body = cleanText(raw.body || raw.explanation || raw.text, 260);
  if (!title && !body) return null;
  const toneRaw = String(raw.statusTone || raw.tone || "calm").toLowerCase();
  const statusTone: InfographicTone =
    toneRaw.includes("atten") || toneRaw.includes("alert") || toneRaw.includes("warn")
      ? "attention"
      : toneRaw.includes("reassur") || toneRaw.includes("ok") || toneRaw.includes("normal")
        ? "reassuring"
        : "calm";
  return {
    title: title || "Hallazgo",
    metric: cleanText(raw.metric || raw.value, 40) || undefined,
    status: cleanText(raw.status || raw.badge || raw.label, 60) || undefined,
    statusTone,
    body: body || "",
    detail: cleanText(raw.detail || raw.note || raw.quality, 120) || undefined,
  };
}

export function normalizePatientInfographicBrief(raw: any): PatientInfographicBrief {
  const layoutRaw = String(raw?.layout || "findings_stack").toLowerCase();
  const layout: InfographicLayout =
    layoutRaw.includes("hero")
      ? "hero_metric"
      : layoutRaw.includes("two")
        ? "two_cards"
        : layoutRaw.includes("split")
          ? "split_focus"
          : "findings_stack";

  const cardsIn = Array.isArray(raw?.cards)
    ? raw.cards
    : Array.isArray(raw?.findings)
      ? raw.findings
      : [];
  const cards = cardsIn.map(normalizeCard).filter(Boolean).slice(0, 4) as InfographicCard[];
  const hero = normalizeCard(raw?.hero) || (layout === "hero_metric" ? cards[0] || null : null);

  const restNormal = Array.isArray(raw?.restNormal)
    ? raw.restNormal.map((x: any) => cleanText(typeof x === "string" ? x : x?.text, 120)).filter(Boolean).slice(0, 6)
    : Array.isArray(raw?.normalFindings)
      ? raw.normalFindings.map((x: any) => cleanText(typeof x === "string" ? x : x?.text, 120)).filter(Boolean).slice(0, 6)
      : [];

  return {
    title: cleanText(raw?.title, 70) || "Tu estudio de imagen",
    subtitle: cleanText(raw?.subtitle, 90) || "Hallazgos principales",
    layout,
    hero,
    cards: cards.length ? cards : hero ? [hero] : [],
    callout: cleanText(raw?.callout || raw?.highlight, 220) || undefined,
    restNormal,
    keyMessage: cleanText(raw?.keyMessage || raw?.mensaje, 220) || undefined,
    disclaimer: cleanText(raw?.disclaimer, 260) || DEFAULT_DISCLAIMER,
  };
}

export function buildPatientInfographicBriefPrompt(input: {
  report: string;
  studyType: string;
  reportDate?: string;
  correctionNotes?: string;
}): string {
  const dateHint = String(input.reportDate || "").trim();
  const corrections = String(input.correctionNotes || "").trim();
  return `Eres un diseñador de comunicación médica para pacientes.
A partir del reporte, produce SOLO un JSON (sin markdown) para una infografía educativa limpia y moderna.

Estudio: ${input.studyType}${dateHint ? ` | Fecha: ${dateHint}` : ""}

REPORTE:
"""
${input.report}
"""
${corrections ? `\nCORRECCIONES DEL MÉDICO (prioridad):\n"""\n${corrections}\n"""\n` : ""}

Reglas de contenido:
- Español correcto, claro, sin tecnicismos innecesarios.
- NO inventes hallazgos ni mediciones ausentes del reporte.
- NO recomendaciones, tratamientos ni "qué hacer después".
- NO datos identificables del paciente (nombre, cédula).
- Incluye números exactos del reporte cuando ayuden (%, kPa, mm, mL, cm).
- Título amable tipo "Tu ultrasonido de hombro derecho".
- Elige el layout que MEJOR encaje con ESTE reporte:
  - hero_metric: un hallazgo/número dominante
  - two_cards: dos hallazgos o métricas clave
  - findings_stack: 2–4 hallazgos en tarjetas
  - split_focus: un hallazgo principal + lista de resto normal
- statusTone: "attention" | "calm" | "reassuring"
- Máximo 4 cards. Textos cortos.
- disclaimer informativo breve.

Esquema JSON exacto:
{
  "title": "string",
  "subtitle": "string",
  "layout": "hero_metric|two_cards|findings_stack|split_focus",
  "hero": {"title":"","metric":"","status":"","statusTone":"attention|calm|reassuring","body":"","detail":""},
  "cards": [{"title":"","metric":"","status":"","statusTone":"attention|calm|reassuring","body":"","detail":""}],
  "callout": "string opcional",
  "restNormal": ["string", "..."],
  "keyMessage": "string opcional",
  "disclaimer": "string"
}`;
}
