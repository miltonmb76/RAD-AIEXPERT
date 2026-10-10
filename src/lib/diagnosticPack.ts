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
  /** True when factors came only from justification (+ filtered scorecard). */
  factorsFromJustification: boolean;
  generatedAt?: string;
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
]);

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

function pushFactor(
  factors: DiagnosticPackFactor[],
  seen: Set<string>,
  factor: DiagnosticPackFactor
) {
  const label = String(factor.label || "").trim();
  if (!label || factors.length >= 8) return;
  const key = normKey(label);
  if (!key || seen.has(key)) return;
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
  const pool = preferredOnes.length ? preferredOnes : candidates;
  const a = pool[0]?.id || candidates[0]?.id;
  const b =
    pool[1]?.id ||
    candidates.find((c) => c.id !== a)?.id ||
    undefined;
  return { a, b };
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

  return { title: String(title).slice(0, 60), rows: uniq };
}

/**
 * Compose clinician pack: justification-first factors, dual selectable images, mini-ficha.
 */
export function buildDiagnosticPack(opts: {
  diagnosisAnchor?: string | null;
  findingsInfographic?: FindingsInfographicData | null;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  dominantLesionCard?: DominantLesionCardData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
  /** Explicit image picks (candidate ids). */
  imageSlotAId?: string | null;
  imageSlotBId?: string | null;
}): DiagnosticPackData {
  const gov = getScorecardGovernance(opts.scorecardData);
  const diagnosis =
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
  const hasJustification = justNodes.length > 0;

  const factors: DiagnosticPackFactor[] = [];
  const seen = new Set<string>();

  // 1) Justification nodes — when present, these ARE the factor source of truth
  justNodes.forEach((n, i) => {
    pushFactor(factors, seen, {
      id: n.id || `pack-f-${i + 1}`,
      label: String(n.label || "").trim(),
      detail: n.detail?.trim() || undefined,
      weight: n.weight || (i < 2 ? "primary" : "secondary"),
    });
  });

  // 2) Scorecard only if relevant to ancla (always filtered; never dumps unrelated organs)
  const maybeScorecard = (label: string, detail: string | undefined, id: string, primary: boolean) => {
    const blob = `${label} ${detail || ""}`;
    if (hasJustification || tokens.length) {
      if (!textMatchesAnchor(blob, tokens)) return;
    }
    pushFactor(factors, seen, {
      id,
      label,
      detail,
      weight: primary ? "primary" : "secondary",
    });
  };

  (opts.scorecardData?.atlasOverlays || []).forEach((o, i) => {
    maybeScorecard(
      String(o.finding || o.structure || "").trim(),
      o.evidence || undefined,
      o.id || `pack-ov-${i + 1}`,
      i < 2
    );
  });
  (opts.scorecardData?.criteria || []).forEach((c, i) => {
    const status = String(c.status || "").toLowerCase();
    if (status !== "met" && status !== "equivocal") return;
    maybeScorecard(
      String(c.criterion || "").trim(),
      String(c.evidence || c.value || "").trim() || undefined,
      c.id || `pack-crit-${i + 1}`,
      c.weight === "critical" || c.weight === "major"
    );
  });

  // 3) Only if NO justification: allow filtered suite / synoptic / dominant (still ancla-matched)
  if (!hasJustification) {
    const synoptic =
      opts.atlas3dData?.synopticExplanation || opts.atlas3dData?.synopticTable || [];
    synoptic.forEach((s, i) => {
      const label = String(s.structure || "").trim();
      const detail = String(s.findingDetail || "").trim() || undefined;
      if (!textMatchesAnchor(`${label} ${detail || ""}`, tokens)) return;
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
        if (!textMatchesAnchor(`${label} ${detail}`, tokens)) return;
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
      if (!textMatchesAnchor(label, tokens)) return;
      pushFactor(factors, seen, {
        id: `pack-dom-${i + 1}`,
        label,
        weight: "secondary",
      });
    });
  }

  const finalFactors = factors.slice(0, 6);

  const candidates = listPackImageCandidates({
    focalLesion3dData: opts.focalLesion3dData,
    atlas3dData: opts.atlas3dData,
    suiteSources: opts.suiteSources,
  });
  const defaults = defaultSlotIds(candidates, opts.preferredSuiteId);
  const imageA = resolveSlot(candidates, opts.imageSlotAId, defaults.a);
  // B: "" means Ninguna; undefined/null → default second panel when available.
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
    String(fig?.synthesis || "").trim() ||
    String(gov?.clinicalSummary || "").trim() ||
    String(opts.dominantLesionCard?.clinicianPhrase || "").trim() ||
    (finalFactors.length
      ? `Los factores listados sustentan el diagnóstico de ${diagnosis}.`
      : undefined);

  const preferredSuite = (opts.suiteSources || []).find(
    (s) => s.id === String(opts.preferredSuiteId || "").trim()
  );

  return {
    title: "Pack de justificación diagnóstica",
    diagnosis,
    studyRegion:
      fig?.studyRegion ||
      opts.atlas3dData?.studyRegion ||
      opts.focalLesion3dData?.studyRegion ||
      opts.dominantLesionCard?.studyRegion ||
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
    factorsFromJustification: hasJustification,
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
  opts?: { hasJustification?: boolean }
): string[] {
  const missing: string[] = [];
  if (!pack || !String(pack.diagnosis || "").trim()) {
    missing.push("Define el ancla diagnóstica.");
  }
  if (!(pack?.imageA?.url || pack?.imageDataUrl)) {
    missing.push("Elige imagen A (Focal / suite 3D / Atlas).");
  }
  const n = pack?.factors?.length || 0;
  if (n < 4) {
    if (opts?.hasJustification === false || !pack?.factorsFromJustification) {
      missing.push(
        `Hacen falta ≥4 factores del ancla (ahora ${n}). Genera la infografía de justificación con este diagnóstico.`
      );
    } else {
      missing.push(
        `La justificación solo aportó ${n} factor(es). Regenera la infografía de justificación (ideal 6).`
      );
    }
  }
  return missing;
}
