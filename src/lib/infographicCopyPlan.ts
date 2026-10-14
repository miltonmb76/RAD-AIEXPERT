/**
 * Classic infographics are image models that paint letters into pixels.
 * Pre-planning exact Spanish copy (text LLM) and locking those strings in the
 * image prompt cuts spelling / garbled-word errors substantially.
 */

export type InfographicCopyCallout = {
  label: string;
  detail?: string;
};

export type InfographicCopyPlan = {
  title: string;
  subtitle?: string;
  callouts: InfographicCopyCallout[];
  footer?: string;
  /** Exact medical tokens that must appear letter-perfect if used. */
  mustSpellExactly: string[];
};

const MAX_CALLOUTS = 6;
const MAX_MUST = 16;

function cleanLine(s: unknown, maxLen: number): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function normalizeInfographicCopyPlan(raw: unknown): InfographicCopyPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = cleanLine(o.title, 90);
  if (title.length < 3) return null;

  const calloutsRaw = Array.isArray(o.callouts) ? o.callouts : [];
  const callouts: InfographicCopyCallout[] = [];
  for (const c of calloutsRaw) {
    if (!c || typeof c !== "object") continue;
    const label = cleanLine((c as any).label, 72);
    if (!label) continue;
    const detail = cleanLine((c as any).detail, 120);
    callouts.push(detail ? { label, detail } : { label });
    if (callouts.length >= MAX_CALLOUTS) break;
  }
  if (!callouts.length) return null;

  const mustRaw = Array.isArray(o.mustSpellExactly) ? o.mustSpellExactly : [];
  const mustSpellExactly: string[] = [];
  const seen = new Set<string>();
  for (const m of mustRaw) {
    const t = cleanLine(m, 48);
    if (!t || t.length < 2) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mustSpellExactly.push(t);
    if (mustSpellExactly.length >= MAX_MUST) break;
  }

  const subtitle = cleanLine(o.subtitle, 100) || undefined;
  const footer = cleanLine(o.footer, 140) || undefined;

  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    callouts,
    ...(footer ? { footer } : {}),
    mustSpellExactly,
  };
}

/** Hard rules for the image model — fewer words, exact spelling. */
export const INFOGRAPHIC_TEXT_ACCURACY_PROMPT_BLOCK = `
TEXTO EN LA IMAGEN — PRECISIÓN ORTOGRÁFICA (prioridad máxima):
- El texto visible DEBE estar en español correcto (tildes, ñ, mayúsculas solo donde correspondan).
- PREFIERE POCAS PALABRAS: título corto + 3–6 etiquetas/callouts breves. Nada de párrafos largos.
- Copia términos médicos, medidas y siglas EXACTAMENTE como en el reporte o en el GUION BLOQUEADO (si existe): no inventes grafías (p. ej. no “colecistitis” si el informe dice “colelitiasis”).
- PROHIBIDO: palabras a medias, letras mezcladas, inglés accidental, “lorem”, filigranas ilegibles o texto decorativo sin sentido.
- Si dudases de una palabra, omítela o usa la forma del GUION BLOQUEADO / reporte; nunca improvises ortografía.
- Números y unidades (mm, cm, kPa, %, BI-RADS, TI-RADS) idénticos al reporte.
`.trim();

/** Inject locked strings the image model must paint character-for-character. */
export function buildLockedCopyPromptBlock(plan: InfographicCopyPlan): string {
  const lines: string[] = [
    "GUION DE TEXTO BLOQUEADO (obligatorio — pinta ESTAS cadenas tal cual, carácter por carácter):",
    `- TÍTULO: «${plan.title}»`,
  ];
  if (plan.subtitle) lines.push(`- SUBTÍTULO: «${plan.subtitle}»`);
  lines.push("- CALLOUTS / ETIQUETAS (usa solo estas; no añadas otras frases largas):");
  plan.callouts.forEach((c, i) => {
    lines.push(
      c.detail
        ? `  ${i + 1}. «${c.label}» — «${c.detail}»`
        : `  ${i + 1}. «${c.label}»`
    );
  });
  if (plan.footer) lines.push(`- PIE: «${plan.footer}»`);
  if (plan.mustSpellExactly.length) {
    lines.push(
      `- TÉRMINOS QUE DEBEN APARECER SIN ERRATA (si los usas): ${plan.mustSpellExactly
        .map((t) => `«${t}»`)
        .join(", ")}`
    );
  }
  lines.push(
    "- No sustituyas, no traduzcas, no acortes a formas incorrectas. Si no cabe un callout, omítelo entero; no lo mutile."
  );
  return lines.join("\n");
}

export function buildInfographicCopyPlanPrompt(opts: {
  audience: "patient" | "clinician";
  studyType: string;
  report: string;
  isDirected: boolean;
  topicText?: string;
  correctionNotes?: string;
  allowRecommendations: boolean;
}): string {
  const audienceLabel =
    opts.audience === "clinician" ? "MÉDICO (léxico técnico)" : "PACIENTE (lenguaje claro)";
  const focus = opts.isDirected && opts.topicText
    ? `\nFOCO DIRIGIDO: «${opts.topicText}». Solo textos sobre este tema.`
    : "";
  const corrections = opts.correctionNotes?.trim()
    ? `\nCORRECCIONES DEL MÉDICO (respétalas en el guion):\n"""\n${opts.correctionNotes.trim()}\n"""`
    : "";
  const reco = opts.allowRecommendations
    ? "- Puedes incluir 1 callout breve de seguimiento SOLO si consta en el informe."
    : "- NO incluyas recomendaciones ni consejos de tratamiento.";

  return `
Eres redactor médico en español (Latinoamérica/España). Preparas el GUION DE TEXTO exacto para una infografía ${audienceLabel} de ${opts.studyType}.${focus}
${corrections}

REPORTE (fuente de verdad; no inventes hallazgos):
"""
${opts.report}
"""

Devuelve SOLO un JSON válido con esta forma:
{
  "title": "string corto (máx ~12 palabras)",
  "subtitle": "opcional, una línea",
  "callouts": [
    { "label": "etiqueta corta", "detail": "opcional, una frase breve" }
  ],
  "footer": "disclaimer breve opcional",
  "mustSpellExactly": ["términos médicos/medidas/siglas del informe a respetar al pie de la letra"]
}

REGLAS:
- Español impecable: tildes (diagnóstico, médico, vesícula…), ñ, plurales correctos.
- 3 a 6 callouts. Frases cortas. Sin párrafos.
- Copia medidas y nombres diagnósticos del informe sin cambiar letras.
- ${reco}
- Sin nombre del paciente ni identificadores.
- Sin "paciente anónimo" ni sellos de anonimato.
`.trim();
}
