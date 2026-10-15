import type {
  Atlas3DData,
  ClinicalScorecardData,
  DominantLesionCardData,
  FindingsInfographicData,
  FocalLesion3DData,
} from "../types";
import { getScorecardGovernance } from "./clinicalIntelligence";
import { resolveDiagnosisAnchor } from "./diagnosisAnchor";

export interface DiagnosticPackFactor {
  id: string;
  label: string;
  detail?: string;
  weight?: "primary" | "secondary";
}

export interface DiagnosticPackFactSheetRow {
  label: string;
  value: string;
}

export interface DiagnosticPackFactSheet {
  title: string;
  rows: DiagnosticPackFactSheetRow[];
}

export interface PackImageCandidate {
  /** Unique slot id, e.g. "focal:A", "abdomen3d:B". */
  id: string;
  sourceId: string;
  sourceLabel: string;
  panelLetter: string;
  url: string;
  caption: string;
}

export interface DiagnosticPackImageSlot {
  candidateId: string;
  url: string;
  caption: string;
  sourceLabel: string;
}

export interface DiagnosticPackData {
  /** Stable id so multiple packs can coexist in one study. */
  id?: string;
  title: string;
  diagnosis: string;
  studyRegion?: string;
  protocolLabel?: string;
  synthesis?: string;
  factors: DiagnosticPackFactor[];
  factSheet?: DiagnosticPackFactSheet;
  /** Primary image (required). */
  imageA?: DiagnosticPackImageSlot | null;
  /** Secondary image (optional but preferred). */
  imageB?: DiagnosticPackImageSlot | null;
  /** @deprecated alias of imageA.url for older checks */
  imageDataUrl?: string | null;
  imageCaption?: string | null;
  imageSourceLabel?: string | null;
  categoryLabel?: string;
  factorTarget: 4 | 6;
  /**
   * Legacy flag: true when factors were seeded from findings-infographic nodes.
   * New packs prefer report/scorecard/suite and leave this false.
   */
  factorsFromJustification: boolean;
  /** Per-pack PDF inclusion (default true when omitted). */
  includeInReport?: boolean;
  generatedAt?: string;
}

export const MAX_DIAGNOSTIC_PACKS = 4;

export function newDiagnosticPackId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalize legacy single pack + new array into a stable list. */
export function normalizeDiagnosticPackList(opts: {
  packs?: DiagnosticPackData[] | null;
  legacyPack?: DiagnosticPackData | null;
  legacyInclude?: boolean;
}): DiagnosticPackData[] {
  const fromArray = Array.isArray(opts.packs)
    ? opts.packs.filter((p) => p && String(p.diagnosis || "").trim())
    : [];
  if (fromArray.length) {
    return fromArray.slice(0, MAX_DIAGNOSTIC_PACKS).map((p) => ({
      ...p,
      id: p.id || newDiagnosticPackId(),
      includeInReport: p.includeInReport !== false,
    }));
  }
  const legacy = opts.legacyPack;
  if (legacy && String(legacy.diagnosis || "").trim()) {
    return [
      {
        ...legacy,
        id: legacy.id || newDiagnosticPackId(),
        includeInReport:
          legacy.includeInReport !== false && opts.legacyInclude !== false,
      },
    ];
  }
  return [];
}

export type PackImagePanel = {
  imageUrl?: string;
  panelLetter?: string;
  panelTitle?: string;
  anatomicalFocus?: string;
} | null;

export type PackImageSource = {
  id: string;
  label: string;
  panels?: PackImagePanel[] | null;
  findingTable?: unknown[] | null;
};

function normKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "sin", "con", "para", "del", "las", "los", "una", "uno", "por", "que", "the",
  "and", "de", "la", "el", "en", "al", "se", "su", "sus", "multiple", "multiples",
  "aguda", "agudo", "cronica", "cronico", "grado", "tipo", "hallazgo", "diagnostico",
  "presencia", "ausencia", "signos", "signo", "leve", "moderada", "moderado",
  "severa", "severo", "marcado", "marcada", "compatible", "sugestivo", "sugestiva",
  "evidencia", "aspecto", "caracteristicas", "caracteristica", "asociado", "asociada",
]);

/** Map near-synonyms so “pared engrosada” ≈ “engrosamiento parietal”. */
const TOKEN_CANON: Record<string, string> = {
  engrosada: "engros",
  engrosado: "engros",
  engrosamiento: "engros",
  espesor: "engros",
  grosor: "engros",
  parietal: "pared",
  vesicular: "vesicula",
  colecistico: "vesicula",
  colecistica: "vesicula",
  litiasis: "calculo",
  calculos: "calculo",
  litos: "calculo",
  lito: "calculo",
  colelitiasis: "calculo",
  sombra: "sombra",
  acustica: "sombra",
  acustico: "sombra",
  murphy: "murphy",
  hidrops: "hidrops",
  hidropre: "hidrops",
  edema: "edema",
  liquido: "liquido",
  fluido: "liquido",
  nodulo: "nodulo",
  nodular: "nodulo",
  lesion: "lesion",
  masa: "lesion",
  trombo: "trombo",
  trombosis: "trombo",
  oclusion: "trombo",
  estenosis: "estenosis",
  estenosante: "estenosis",
  ectasia: "ectasia",
  dilatacion: "ectasia",
  hidronefrosis: "ectasia",
  quiste: "quiste",
  quistica: "quiste",
  quistico: "quiste",
  ganglio: "ganglio",
  ganglios: "ganglio",
  adenopatia: "ganglio",
  adenopatias: "ganglio",
  adenopatico: "ganglio",
  adenitis: "ganglio",
  mesentericos: "mesenter",
  mesentericas: "mesenter",
  mesenterico: "mesenter",
  mesenterica: "mesenter",
  mesenterio: "mesenter",
  aumentado: "aument",
  aumentada: "aument",
  aumentados: "aument",
  aumentadas: "aument",
  aumento: "aument",
  tamano: "tamano",
  diametro: "tamano",
};

function lightStem(token: string): string {
  const t = TOKEN_CANON[token] || token;
  if (t.length <= 5) return t;
  return t
    .replace(/(amientos|amiento|aciones|acion|idades|idad|mente)$/i, "")
    .replace(/(adas|ados|idas|idos|ada|ado|ida|ido|ores|oras)$/i, "")
    .replace(/(ares|eres|ires|ar|er|ir)$/i, "");
}

/** Significant stemmed tokens for near-duplicate comparison. */
export function aspectTokens(text: string): Set<string> {
  const n = normKey(text);
  const out = new Set<string>();
  for (const raw of n.split(/[^a-z0-9]+/)) {
    if (raw.length < 4 || STOP.has(raw)) continue;
    // Drop pure numbers / measures (4mm, 12cm) — keep clinical words
    if (/^\d/.test(raw)) continue;
    out.add(lightStem(raw));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * True when two factor texts describe the same clinical aspect
 * (same idea with slightly different wording).
 */
export function factorsAreNearDuplicate(a: string, b: string): boolean {
  const na = normKey(a);
  const nb = normKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  const ta = aspectTokens(a);
  const tb = aspectTokens(b);
  if (ta.size < 2 || tb.size < 2) {
    // Short labels: require strong overlap of the few tokens
    if (!ta.size || !tb.size) return false;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    return inter >= 1 && inter === Math.min(ta.size, tb.size);
  }
  const jac = jaccard(ta, tb);
  if (jac >= 0.5) return true;
  // Subset: e.g. {pared,vesicula,engros} ⊂ {pared,vesicula,engros,mm}
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const smaller = Math.min(ta.size, tb.size);
  if (smaller >= 2 && inter / smaller >= 0.8) return true;
  return false;
}

/** Tokens from ancla used to keep only reinforcing factors. */
export function anchorRelevanceTokens(diagnosis: string): string[] {
  const n = normKey(diagnosis);
  const raw = n.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  const extras: string[] = [];
  // Pathology synonyms / related anatomy
  if (/colelit|litias|calculo/.test(n)) {
    extras.push(
      "vesicula", "lito", "litos", "calculo", "calculos", "colelit", "sombra",
      "pared", "murphy", "pericolec", "coledoco", "biliar", "barro"
    );
  }
  if (/colecistit/.test(n)) {
    extras.push("vesicula", "pared", "murphy", "pericolec", "hidropre", "edema");
  }
  if (/apendicit|apendice/.test(n)) {
    extras.push("apendice", "fid", "cecal", "periappend", "liquido", "diametro");
  }
  if (/adenitis|mesenter/.test(n)) {
    extras.push("ganglio", "ganglios", "mesenter", "adenop", "ileon", "grasa");
  }
  if (/tiroid|tirads/.test(n)) {
    extras.push("tiroides", "nodulo", "lobulo", "istmo", "tirads");
  }
  if (/birads|mama|mamari/.test(n)) {
    extras.push("mama", "nodulo", "axila", "birads", "pezon");
  }
  if (/tvp|trombosis|venos/.test(n)) {
    extras.push("vena", "trombo", "femoral", "poplite", "compresib");
  }
  return Array.from(new Set([...raw, ...extras]));
}

function textMatchesAnchor(text: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const n = normKey(text);
  return tokens.some((t) => t.length >= 4 && n.includes(t));
}

function factorBlob(factor: Pick<DiagnosticPackFactor, "label" | "detail">): string {
  return `${factor.label || ""} ${factor.detail || ""}`.trim();
}

function pushFactor(
  factors: DiagnosticPackFactor[],
  seen: Set<string>,
  factor: DiagnosticPackFactor
) {
  const label = String(factor.label || "").trim();
  if (!label || factors.length >= 8) return;
  const key = normKey(label);
  if (!key || seen.has(key)) return;
  const blob = factorBlob({ label, detail: factor.detail });
  for (const existing of factors) {
    if (factorsAreNearDuplicate(blob, factorBlob(existing))) return;
    if (factorsAreNearDuplicate(label, existing.label)) return;
  }
  for (const s of seen) {
    if (key.length >= 8 && (s.includes(key) || key.includes(s))) return;
  }
  seen.add(key);
  factors.push({
    ...factor,
    label,
    detail: factor.detail?.trim() || undefined,
  });
}

function field(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(row?.[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function panelsOf(source: PackImageSource | { panels?: PackImagePanel[] | null; label?: string; id?: string }) {
  return (source.panels || []).filter((p) => p?.imageUrl);
}

/** Flat list of selectable images from focal / suites / atlas. */
export function listPackImageCandidates(opts: {
  focalLesion3dData?: FocalLesion3DData | null;
  atlas3dData?: Atlas3DData | null;
  suiteSources?: PackImageSource[];
}): PackImageCandidate[] {
  const out: PackImageCandidate[] = [];

  const pushSource = (
    sourceId: string,
    sourceLabel: string,
    panels: PackImagePanel[] | null | undefined
  ) => {
    (panels || []).forEach((p, i) => {
      if (!p?.imageUrl) return;
      const letter = String(p.panelLetter || String.fromCharCode(65 + i)).toUpperCase();
      out.push({
        id: `${sourceId}:${letter}`,
        sourceId,
        sourceLabel,
        panelLetter: letter,
        url: p.imageUrl,
        caption: p.panelTitle || p.anatomicalFocus || `Panel ${letter}`,
      });
    });
  };

  if (opts.focalLesion3dData?.panels?.length) {
    pushSource("focal", "Corte Focal 3D", opts.focalLesion3dData.panels);
  }
  for (const suite of opts.suiteSources || []) {
    pushSource(suite.id, suite.label || suite.id, suite.panels);
  }
  if (opts.atlas3dData?.panels?.length) {
    pushSource("atlas3d", "Atlas 3D", opts.atlas3dData.panels);
  }
  return out;
}

function defaultSlotIds(
  candidates: PackImageCandidate[],
  preferredSuiteId?: string | null
): { a?: string; b?: string } {
  if (!candidates.length) return {};
  const preferred = String(preferredSuiteId || "").trim();
  const preferredOnes = preferred
    ? candidates.filter((c) => c.sourceId === preferred)
    : [];
  const focalOnes = candidates.filter((c) => c.sourceId === "focal");
  // Prefer Corte Focal panels for pack imagery when available.
  const pool = preferredOnes.length
    ? preferredOnes
    : focalOnes.length
      ? focalOnes
      : candidates;
  const a = pool[0]?.id || candidates[0]?.id;
  const b =
    pool[1]?.id ||
    candidates.find((c) => c.id !== a)?.id ||
    undefined;
  return { a, b };
}

/**
 * Re-bind image A/B on an existing draft from current candidate slots
 * without regenerating factors / diagnosis.
 */
export function applyPackImageSlots(
  pack: DiagnosticPackData,
  candidates: PackImageCandidate[],
  slotAId: string | null | undefined,
  slotBId: string | null | undefined,
  preferredSuiteId?: string | null
): DiagnosticPackData {
  const defaults = defaultSlotIds(candidates, preferredSuiteId);
  const imageA = resolveSlot(candidates, slotAId, defaults.a);
  let imageB = resolveSlot(candidates, slotBId, defaults.b, {
    allowEmpty: slotBId === "",
  });
  if (imageA && imageB && imageA.candidateId === imageB.candidateId) {
    const other = candidates.find((c) => c.id !== imageA.candidateId);
    imageB = other
      ? {
          candidateId: other.id,
          url: other.url,
          caption: other.caption,
          sourceLabel: other.sourceLabel,
        }
      : null;
  }
  return {
    ...pack,
    imageA,
    imageB,
    imageDataUrl: imageA?.url || null,
    imageCaption: imageA?.caption || null,
    imageSourceLabel: imageA?.sourceLabel || null,
  };
}

function resolveSlot(
  candidates: PackImageCandidate[],
  slotId: string | null | undefined,
  fallbackId?: string,
  opts?: { allowEmpty?: boolean }
): DiagnosticPackImageSlot | null {
  // Explicit empty (e.g. Imagen B = Ninguna) must not fall back.
  if (opts?.allowEmpty && (slotId === "" || slotId === null)) return null;
  const id = String(slotId || fallbackId || "").trim();
  if (!id) return null;
  const hit = candidates.find((c) => c.id === id);
  if (!hit) {
    const fb = String(fallbackId || "").trim();
    const fallback = fb ? candidates.find((c) => c.id === fb) : undefined;
    if (!fallback) return null;
    return {
      candidateId: fallback.id,
      url: fallback.url,
      caption: fallback.caption,
      sourceLabel: fallback.sourceLabel,
    };
  }
  return {
    candidateId: hit.id,
    url: hit.url,
    caption: hit.caption,
    sourceLabel: hit.sourceLabel,
  };
}

function buildFactSheet(opts: {
  diagnosis: string;
  tokens: string[];
  dominantLesionCard?: DominantLesionCardData | null;
  scorecardData?: ClinicalScorecardData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
}): DiagnosticPackFactSheet | undefined {
  const rows: DiagnosticPackFactSheetRow[] = [];
  const card = opts.dominantLesionCard;
  if (card) {
    if (card.site) rows.push({ label: "Sitio", value: card.site });
    if (card.laterality) rows.push({ label: "Lado", value: card.laterality });
    if (card.sizeSummary) rows.push({ label: "Tamaño", value: card.sizeSummary });
    (card.measurements || []).slice(0, 3).forEach((m) => {
      const label = String(m?.label || "Medida").trim();
      const value = String(m?.value || "").trim();
      if (label && value) rows.push({ label, value });
    });
    if (card.categoryValue || card.categorySystem) {
      rows.push({
        label: "Categoría",
        value: [card.categorySystem, card.categoryValue].filter(Boolean).join(" "),
      });
    }
  }

  // Relevant suite row matching ancla
  const preferredId = String(opts.preferredSuiteId || "").trim();
  const suites = [
    ...(opts.suiteSources || []).filter((s) => s.id === preferredId),
    ...(opts.suiteSources || []).filter((s) => s.id !== preferredId),
  ];
  for (const suite of suites) {
    for (const row of suite.findingTable || []) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const blob = Object.values(r).map((v) => String(v || "")).join(" ");
      if (!textMatchesAnchor(blob, opts.tokens) && opts.tokens.length) continue;
      const structure = field(r, ["structure", "location", "vessel", "site", "lesionLabel"]);
      const size = field(r, ["sizeOrThickness", "thicknessOrGap", "size", "stenosisPercent"]);
      const pattern = field(r, ["echoPattern", "composition", "plaqueOrThrombus", "finding"]);
      const impact = field(r, ["clinicalImpact", "biradsCategory", "tiradsCategory"]);
      if (structure) rows.push({ label: "Estructura", value: structure });
      if (size) rows.push({ label: "Medida", value: size });
      if (pattern) rows.push({ label: "Patrón", value: pattern });
      if (impact) rows.push({ label: "Impacto", value: impact });
      break;
    }
    if (rows.length >= 4) break;
  }

  const gov = getScorecardGovernance(opts.scorecardData);
  if (gov?.shortLabel && !rows.some((r) => r.label === "Categoría")) {
    rows.push({ label: "Categoría", value: gov.shortLabel });
  }

  const uniq: DiagnosticPackFactSheetRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${normKey(r.label)}|${normKey(r.value)}`;
    if (seen.has(k) || !r.value.trim()) continue;
    seen.add(k);
    uniq.push(r);
    if (uniq.length >= 6) break;
  }
  if (!uniq.length) return undefined;

  // Title from first structure / site / organish token
  const title =
    card?.site ||
    uniq.find((r) => r.label === "Estructura" || r.label === "Sitio")?.value ||
    "Ficha del hallazgo";

  // Keep full values — PDF wraps them; do not mid-cut category/measure strings.
  return {
    title: stripHangingTail(String(title).slice(0, 80)) || "Ficha del hallazgo",
    rows: uniq.map((r) => ({
      label: r.label,
      value: stripHangingTail(r.value) || r.value,
    })),
  };
}

/** Trailing glue words that mean a label/detail was cut mid-phrase. */
const HANGING_TAIL =
  /(?:\s+(?:y|e|o|u|de|del|la|el|los|las|un|una|unos|unas|en|con|por|para|al|a|se|su|sus|que|como|durante|entre|sobre|bajo|sin|tras|hacia|hace|hacen|evidencia|evidente|observa|observan|muestra|muestran|permite|permiten|asocia|asocian))\s*$/i;

function stripHangingTail(text: string): string {
  let t = String(text || "").trim();
  while (HANGING_TAIL.test(t)) {
    t = t.replace(HANGING_TAIL, "").trim();
  }
  return t.replace(/[,:;–—.-]+$/g, "").trim();
}

/** Build a short label + full detail without mid-sentence chopping. */
export function shortFactorLabel(chunk: string): { label: string; detail?: string } {
  const text = String(chunk || "").replace(/\s+/g, " ").trim();
  if (!text) return { label: "" };
  const colon = text.match(/^(.{8,80}?):\s+(.+)$/);
  if (colon) {
    return { label: stripHangingTail(colon[1]), detail: text };
  }
  const dash = text.split(/\s+[—–]\s+/);
  if (dash.length >= 2 && dash[0].length >= 8 && dash[0].length <= 80) {
    return { label: stripHangingTail(dash[0]), detail: text };
  }
  if (text.length <= 80 && !HANGING_TAIL.test(text)) {
    return { label: text };
  }
  const clause = text.split(/[;.]/)[0]?.trim() || text;
  if (clause.length >= 12 && clause.length <= 80 && clause.length < text.length) {
    return { label: stripHangingTail(clause), detail: text };
  }
  const words = text.split(/\s+/);
  let n = Math.min(12, words.length);
  let label = words.slice(0, n).join(" ");
  while (n > 4 && (HANGING_TAIL.test(label) || label.length > 80)) {
    n -= 1;
    label = words.slice(0, n).join(" ");
  }
  label = stripHangingTail(label);
  return { label: label || text.slice(0, 80), detail: text };
}

/** Clean factors whose label/detail were truncated mid-phrase. */
export function polishDiagnosticPackFactors(
  factors: DiagnosticPackFactor[]
): DiagnosticPackFactor[] {
  return factors.map((f) => {
    let label = String(f.label || "").trim();
    let detail = String(f.detail || "").trim() || undefined;
    if (!label) return f;

    if (detail && (HANGING_TAIL.test(label) || label.length > 90)) {
      const rebuilt = shortFactorLabel(detail.startsWith(label.slice(0, 24)) ? detail : `${label} ${detail}`);
      label = rebuilt.label;
      detail = rebuilt.detail || detail;
    } else if (HANGING_TAIL.test(label)) {
      label = stripHangingTail(label);
    }

    if (detail) {
      detail = detail.replace(/\s+/g, " ").trim();
      if (HANGING_TAIL.test(detail)) {
        // Prefer dropping a hanging incomplete detail over showing "… y"
        const cleaned = stripHangingTail(detail);
        detail = cleaned.length >= 12 ? cleaned : undefined;
      }
      if (detail && factorsAreNearDuplicate(label, detail) && detail.length <= label.length + 12) {
        detail = undefined;
      }
    }
    return { ...f, label, detail };
  });
}

/**
 * Pull short finding-like lines from the report that reinforce the diagnosis.
 * Deterministic (no LLM) so the pack does not wait on the findings infographic.
 */
export function extractFactorsFromReportText(
  reportText: string | null | undefined,
  diagnosis: string,
  max = 6
): DiagnosticPackFactor[] {
  const report = String(reportText || "").replace(/\r/g, "\n").trim();
  if (!report || max <= 0) return [];
  const tokens = anchorRelevanceTokens(diagnosis);
  const dxKey = normKey(diagnosis);
  // Split on newlines / sentence ends — NOT on ":" (keeps "Estructura: valor" intact).
  const chunks = report
    .split(/\n+|(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ]|durante|espacio|distensi|en\s+la|se\s+)/i)
    .map((s) => s.replace(/^[\s•\-*–—\d.)]+/, "").trim())
    .filter((s) => s.length >= 12 && s.length <= 420);

  const scored: Array<{ label: string; detail?: string; score: number }> = [];
  for (const chunk of chunks) {
    const key = normKey(chunk);
    if (!key || (dxKey && key === dxKey)) continue;
    if (/^(tecnica|técnica|indicacion|indicación|paciente|nombre|fecha)\b/i.test(chunk)) {
      continue;
    }
    let score = 0;
    if (tokens.length) {
      for (const t of tokens) {
        if (t.length >= 4 && key.includes(t)) score += 2;
      }
      if (score < 2) continue;
    } else {
      score = 1;
    }
    if (/\d+\s*(mm|cm|kpa|%|hz)/i.test(chunk)) score += 1;
    if (/^hallazgo|^impres|^conclusion|^conclusión/i.test(chunk)) score += 1;
    const { label, detail } = shortFactorLabel(chunk);
    if (!label || HANGING_TAIL.test(label)) continue;
    scored.push({ label, detail, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: DiagnosticPackFactor[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    pushFactor(out, seen, {
      id: `pack-rep-${out.length + 1}`,
      label: s.label,
      detail: s.detail,
      weight: out.length < 2 ? "primary" : "secondary",
    });
    if (out.length >= max) break;
  }
  return polishDiagnosticPackFactors(out);
}

/**
 * Compose clinician pack from diagnosis base + report/scorecard/suite sources.
 * Findings-infographic is optional reinforcement only (never required).
 */
export function buildDiagnosticPack(opts: {
  /** Editable base diagnosis for THIS pack (preferred). */
  diagnosisBase?: string | null;
  diagnosisAnchor?: string | null;
  reportText?: string | null;
  findingsInfographic?: FindingsInfographicData | null;
  /** When true, seed factors from infographic nodes first (legacy). Default false. */
  preferInfographicFactors?: boolean;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  dominantLesionCard?: DominantLesionCardData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
  /** Explicit image picks (candidate ids). */
  imageSlotAId?: string | null;
  imageSlotBId?: string | null;
  packId?: string | null;
}): DiagnosticPackData {
  const gov = getScorecardGovernance(opts.scorecardData);
  const diagnosis =
    String(opts.diagnosisBase || "").trim() ||
    resolveDiagnosisAnchor({
      manualAnchor: opts.diagnosisAnchor,
      scorecardData: opts.scorecardData,
      findingsInfographic: opts.findingsInfographic,
    }) ||
    String(opts.dominantLesionCard?.lesionLabel || "").trim() ||
    "Diagnóstico del informe";

  const tokens = anchorRelevanceTokens(diagnosis);
  const fig = opts.findingsInfographic;
  const justNodes = (fig?.nodes || []).filter((n) => String(n.label || "").trim());
  const preferFig = opts.preferInfographicFactors === true && justNodes.length > 0;

  const factors: DiagnosticPackFactor[] = [];
  const seen = new Set<string>();
  const dxKey = normKey(diagnosis);

  // Optional legacy: infographic nodes first
  if (preferFig) {
    justNodes.forEach((n, i) => {
      const label = String(n.label || "").trim();
      if (!label || (dxKey && normKey(label) === dxKey)) return;
      pushFactor(factors, seen, {
        id: n.id || `pack-f-${i + 1}`,
        label,
        detail: n.detail?.trim() || undefined,
        weight: n.weight || (i < 2 ? "primary" : "secondary"),
      });
    });
  }

  // 1) Scorecard overlays + met/equivocal criteria (filtered by diagnosis tokens when available)
  const maybePush = (
    label: string,
    detail: string | undefined,
    id: string,
    primary: boolean,
    requireTokenMatch: boolean
  ) => {
    const blob = `${label} ${detail || ""}`;
    if (requireTokenMatch && tokens.length && !textMatchesAnchor(blob, tokens)) return;
    pushFactor(factors, seen, {
      id,
      label,
      detail,
      weight: primary ? "primary" : "secondary",
    });
  };

  (opts.scorecardData?.atlasOverlays || []).forEach((o, i) => {
    maybePush(
      String(o.finding || o.structure || "").trim(),
      o.evidence || undefined,
      o.id || `pack-ov-${i + 1}`,
      i < 2,
      tokens.length > 0
    );
  });
  (opts.scorecardData?.criteria || []).forEach((c, i) => {
    const status = String(c.status || "").toLowerCase();
    if (status !== "met" && status !== "equivocal") return;
    maybePush(
      String(c.criterion || "").trim(),
      String(c.evidence || c.value || "").trim() || undefined,
      c.id || `pack-crit-${i + 1}`,
      c.weight === "critical" || c.weight === "major",
      // Soft filter: if thin factor list, accept more scorecard rows
      factors.length >= 4 && tokens.length > 0
    );
  });

  // 2) Synoptic / suite / dominant — always available (no longer gated on infographic)
  const synoptic =
    opts.atlas3dData?.synopticExplanation || opts.atlas3dData?.synopticTable || [];
  synoptic.forEach((s, i) => {
    const label = String(s.structure || "").trim();
    const detail = String(s.findingDetail || "").trim() || undefined;
    if (tokens.length && !textMatchesAnchor(`${label} ${detail || ""}`, tokens)) return;
    pushFactor(factors, seen, {
      id: `pack-syn-${i + 1}`,
      label,
      detail,
      weight: i < 2 ? "primary" : "secondary",
    });
  });

  const preferredId = String(opts.preferredSuiteId || "").trim();
  const suites = [
    ...(opts.suiteSources || []).filter((s) => s.id === preferredId),
    ...(opts.suiteSources || []).filter((s) => s.id !== preferredId),
  ];
  for (const suite of suites) {
    (suite.findingTable || []).forEach((row, i) => {
      if (!row || typeof row !== "object") return;
      const r = row as Record<string, unknown>;
      const structure = field(r, ["structure", "location", "vessel", "site", "lesionLabel"]);
      const pattern = field(r, ["echoPattern", "finding", "composition", "plaqueOrThrombus"]);
      const measure = field(r, ["sizeOrThickness", "thicknessOrGap", "size"]);
      const label = structure || pattern;
      if (!label) return;
      const detail = [pattern && pattern !== label ? pattern : "", measure]
        .filter(Boolean)
        .join(" · ");
      if (tokens.length && !textMatchesAnchor(`${label} ${detail}`, tokens)) return;
      pushFactor(factors, seen, {
        id: `pack-suite-${suite.id}-${i + 1}`,
        label,
        detail: detail || undefined,
        weight: i < 2 ? "primary" : "secondary",
      });
    });
  }

  (opts.dominantLesionCard?.keyDescriptors || []).forEach((d, i) => {
    const label = String(d || "").trim();
    if (tokens.length && !textMatchesAnchor(label, tokens)) return;
    pushFactor(factors, seen, {
      id: `pack-dom-${i + 1}`,
      label,
      weight: "secondary",
    });
  });

  // 3) Report text extraction to fill remaining slots
  if (factors.length < 6) {
    for (const f of extractFactorsFromReportText(opts.reportText, diagnosis, 6 - factors.length)) {
      pushFactor(factors, seen, f);
    }
  }

  // 4) Optional infographic reinforcement (only if not already preferred first)
  if (!preferFig && justNodes.length) {
    justNodes.forEach((n, i) => {
      const label = String(n.label || "").trim();
      if (!label || (dxKey && normKey(label) === dxKey)) return;
      pushFactor(factors, seen, {
        id: n.id || `pack-fig-${i + 1}`,
        label,
        detail: n.detail?.trim() || undefined,
        weight: "secondary",
      });
    });
  }

  const finalFactors = polishDiagnosticPackFactors(factors.slice(0, 6));

  const candidates = listPackImageCandidates({
    focalLesion3dData: opts.focalLesion3dData,
    atlas3dData: opts.atlas3dData,
    suiteSources: opts.suiteSources,
  });
  const defaults = defaultSlotIds(candidates, opts.preferredSuiteId);
  const imageA = resolveSlot(candidates, opts.imageSlotAId, defaults.a);
  let imageB = resolveSlot(candidates, opts.imageSlotBId, defaults.b, {
    allowEmpty: opts.imageSlotBId === "",
  });
  if (imageA && imageB && imageA.candidateId === imageB.candidateId) {
    const other = candidates.find((c) => c.id !== imageA.candidateId);
    imageB = other
      ? {
          candidateId: other.id,
          url: other.url,
          caption: other.caption,
          sourceLabel: other.sourceLabel,
        }
      : null;
  }

  const factSheet = buildFactSheet({
    diagnosis,
    tokens,
    dominantLesionCard: opts.dominantLesionCard,
    scorecardData: opts.scorecardData,
    suiteSources: opts.suiteSources,
    preferredSuiteId: opts.preferredSuiteId,
  });

  const synthesis =
    String(gov?.clinicalSummary || "").trim() ||
    String(opts.dominantLesionCard?.clinicianPhrase || "").trim() ||
    String(fig?.synthesis || "").trim() ||
    (finalFactors.length
      ? `Los factores listados sustentan el diagnóstico de ${diagnosis}.`
      : undefined);

  const preferredSuite = (opts.suiteSources || []).find(
    (s) => s.id === String(opts.preferredSuiteId || "").trim()
  );

  return {
    id: String(opts.packId || "").trim() || newDiagnosticPackId(),
    title: "Pack de justificación diagnóstica",
    diagnosis,
    studyRegion:
      opts.atlas3dData?.studyRegion ||
      opts.focalLesion3dData?.studyRegion ||
      opts.dominantLesionCard?.studyRegion ||
      fig?.studyRegion ||
      undefined,
    protocolLabel: gov?.protocolName || preferredSuite?.label || undefined,
    synthesis,
    factors: finalFactors,
    factSheet,
    imageA,
    imageB,
    imageDataUrl: imageA?.url || null,
    imageCaption: imageA?.caption || null,
    imageSourceLabel: imageA?.sourceLabel || null,
    categoryLabel: gov?.shortLabel || undefined,
    factorTarget: finalFactors.length >= 6 ? 6 : 4,
    factorsFromJustification: preferFig,
    includeInReport: true,
    generatedAt: new Date().toISOString(),
  };
}

export function diagnosticPackIsRenderable(pack: DiagnosticPackData | null | undefined): boolean {
  if (!pack) return false;
  const dx = String(pack.diagnosis || "").trim();
  const n = pack.factors?.length || 0;
  const img = pack.imageA?.url || pack.imageDataUrl;
  return Boolean(dx && img && n >= 4);
}

export function diagnosticPackMissingRequirements(
  pack: DiagnosticPackData | null | undefined,
  _opts?: { hasJustification?: boolean }
): string[] {
  const missing: string[] = [];
  if (!pack || !String(pack.diagnosis || "").trim()) {
    missing.push("Escribe el diagnóstico base del pack.");
  }
  if (!(pack?.imageA?.url || pack?.imageDataUrl)) {
    missing.push("Elige imagen A (Focal / suite 3D / Atlas).");
  }
  const n = pack?.factors?.length || 0;
  if (n < 4) {
    missing.push(
      `Hacen falta ≥4 factores de justificación (ahora ${n}). Pulsa «Extraer factores» (informe + scorecard + suites) o edítalos a mano.`
    );
  }
  return missing;
}
