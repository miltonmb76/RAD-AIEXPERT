/**
 * Guideline Binder — bind ACR / Fleischner (and related) citations to the report
 * as footnotes (pie) + tooltip metadata for the clinical polish panel.
 */
import type { ClassificationRecommendation, ReportEnrichmentChange } from "../types";
import { updateFootnotesInReport } from "./reportFootnotes";

export const MAX_AUTO_GUIDELINES = 3;

export interface PracticeGuidelineRef {
  id: string;
  /** Short label shown in UI / enrichment panel. */
  title: string;
  /** One-line clinical description (tooltip body). */
  description: string;
  /** Footnote line injected under --- in the report body. */
  footnote: string;
  /** Society / source for tooltip. */
  source: string;
  /** Match against classification names and report text (normalized). */
  matchAny: string[];
  /** Optional anatomy anchors that strengthen a match when present. */
  anatomyAny?: string[];
  /** Hard exclusions to avoid false positives. */
  excludeAny?: string[];
}

/** Core catalog focused on ACR + Fleischner (plus close cousins already used in Notas de Pie). */
export const GUIDELINE_BINDER_CATALOG: PracticeGuidelineRef[] = [
  {
    id: "gpc-bi-rads",
    title: "ACR BI-RADS",
    description: "Categorización y manejo de lesiones mamarias (mamografía, US, RM).",
    footnote:
      "Categorización y pautas de manejo según el sistema BI-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["bi-rads", "birads", "bi rads"],
    anatomyAny: ["mama", "mamario", "mamaria", "mamas", "axila", "axilar"],
    excludeAny: ["tiroides", "ti-rads", "tirads"],
  },
  {
    id: "gpc-ti-rads",
    title: "ACR TI-RADS 2017",
    description: "Estratificación de riesgo de nódulos tiroideos.",
    footnote:
      "Estratificación de riesgo estimada mediante criterios ACR TI-RADS 2017.",
    source: "American College of Radiology (ACR)",
    matchAny: ["ti-rads", "tirads", "ti rads", "acr ti-rads"],
    anatomyAny: ["tiroides", "tiroideo", "tiroidea", "istmo"],
  },
  {
    id: "gpc-fleischner",
    title: "Fleischner 2017",
    description:
      "Seguimiento de nódulos pulmonares incidentales en adultos (≥35 años), no oncológicos.",
    footnote:
      "Conducta de seguimiento de nódulo(s) pulmonar(es) incidental(es) según las guías de la Fleischner Society 2017.",
    source: "Fleischner Society",
    matchAny: ["fleischner", "nodulo pulmonar", "nódulo pulmonar", "nodulos pulmonares", "nódulos pulmonares"],
    anatomyAny: ["pulmon", "pulmón", "torax", "tórax", "lobar", "segmentario"],
    excludeAny: ["mama", "tiroides", "renal"],
  },
  {
    id: "gpc-bosniak",
    title: "Bosniak (ACR)",
    description: "Estratificación de quistes / lesiones quísticas renales.",
    footnote:
      "Estratificación de lesiones quísticas renales según la clasificación de Bosniak (versión ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["bosniak"],
    anatomyAny: ["renal", "riñon", "riñón", "quiste"],
  },
  {
    id: "gpc-li-rads",
    title: "ACR LI-RADS",
    description: "Categorización de hallazgos hepáticos en pacientes de riesgo para CHC.",
    footnote:
      "Categorización de hallazgos hepáticos según LI-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["li-rads", "lirads", "li rads"],
    anatomyAny: ["higado", "hígado", "hepatic", "hepático", "hepatico"],
  },
  {
    id: "gpc-pi-rads",
    title: "ACR PI-RADS",
    description: "Sospecha de cáncer de próstata en RM multiparamétrica.",
    footnote:
      "Estratificación de sospecha prostática según PI-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["pi-rads", "pirads", "pi rads"],
    anatomyAny: ["prostata", "próstata", "prostatic"],
  },
  {
    id: "gpc-or-ads",
    title: "ACR O-RADS",
    description: "Riesgo de malignidad en masas anexiales / ováricas.",
    footnote:
      "Estratificación de riesgo anexial según O-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["o-rads", "orads", "o rads", "or-ads"],
    anatomyAny: ["ovario", "anexo", "anexial", "uter"],
  },
  {
    id: "gpc-lung-rads",
    title: "ACR Lung-RADS",
    description: "Categorización de nódulos en programas de screening de cáncer de pulmón.",
    footnote:
      "Categorización de nódulos pulmonares de screening según Lung-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    matchAny: ["lung-rads", "lungrads", "lung rads"],
    anatomyAny: ["pulmon", "pulmón", "torax", "tórax"],
  },
];

function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textHasAny(haystackNorm: string, needles: string[] | undefined): boolean {
  if (!needles?.length) return false;
  return needles.some((n) => {
    const nn = normalizeForMatch(n);
    return nn.length >= 2 && haystackNorm.includes(nn);
  });
}

function reportAlreadyHasFootnote(report: string, footnote: string): boolean {
  const r = normalizeForMatch(report);
  const f = normalizeForMatch(footnote);
  if (!f) return false;
  // Enough of the citation to detect prior insert
  const slice = f.slice(0, Math.min(48, f.length));
  return slice.length >= 20 && r.includes(slice);
}

export function guidelineTooltip(g: PracticeGuidelineRef): string {
  return `${g.title} — ${g.description} Fuente: ${g.source}.`;
}

export function formatGuidelineFootnote(g: PracticeGuidelineRef): string {
  return `* ${g.footnote} (${g.source}).`;
}

export interface GuidelineMatch {
  guideline: PracticeGuidelineRef;
  /** Why it matched (classification name or report cue). */
  reason: string;
  /** Classification name that triggered the bind, if any. */
  viaClassification?: string;
  alreadyInReport: boolean;
}

/**
 * Match guidelines from applied/recommended classifications and report body cues.
 * Prefer classification-driven hits; fall back to strong report keyword hits.
 */
export function matchGuidelinesForReport(
  report: string,
  classifications?: ClassificationRecommendation[] | null
): GuidelineMatch[] {
  const reportNorm = normalizeForMatch(report);
  const classList = Array.isArray(classifications) ? classifications : [];
  const matches: GuidelineMatch[] = [];
  const seen = new Set<string>();

  const tryPush = (g: PracticeGuidelineRef, reason: string, via?: string) => {
    if (seen.has(g.id)) return;
    if (textHasAny(reportNorm, g.excludeAny)) return;
    seen.add(g.id);
    matches.push({
      guideline: g,
      reason,
      viaClassification: via,
      alreadyInReport: reportAlreadyHasFootnote(report, g.footnote),
    });
  };

  // 1) Classification names (strongest signal)
  for (const rec of classList) {
    const name = String(rec?.name || "").trim();
    if (!name) continue;
    const nameNorm = normalizeForMatch(name);
    for (const g of GUIDELINE_BINDER_CATALOG) {
      if (textHasAny(nameNorm, g.matchAny)) {
        tryPush(
          g,
          `Clasificación «${name}» → cita ${g.title} en pie de página.`,
          name
        );
      }
    }
  }

  // 2) Report body mentions (only if anatomy also present when required)
  for (const g of GUIDELINE_BINDER_CATALOG) {
    if (seen.has(g.id)) continue;
    if (textHasAny(reportNorm, g.excludeAny)) continue;
    const keywordHit = textHasAny(reportNorm, g.matchAny);
    if (!keywordHit) continue;
    // For Fleischner keyword "nodulo pulmonar" etc., anatomy helps; for *-RADS name hits, OK alone
    const isRads = /rads/i.test(g.title) || /rads/.test(g.id);
    const anatomyOk =
      !g.anatomyAny?.length || textHasAny(reportNorm, g.anatomyAny) || isRads;
    if (!anatomyOk) continue;
    tryPush(g, `El informe menciona criterios compatibles con ${g.title}.`);
  }

  return matches;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Turn guideline matches into enrichment changes (auto up to maxAuto). */
export function selectGuidelineBinderChanges(
  matches: GuidelineMatch[],
  maxAuto: number = MAX_AUTO_GUIDELINES
): ReportEnrichmentChange[] {
  const changes: ReportEnrichmentChange[] = [];
  let autoCount = 0;

  for (const m of matches) {
    const g = m.guideline;
    const footnote = formatGuidelineFootnote(g);
    const already = m.alreadyInReport;
    const autoSafe = !already && autoCount < maxAuto;
    if (autoSafe) autoCount += 1;

    changes.push({
      id: newId("enr-gpc"),
      source: "guideline",
      sourceItemId: g.id,
      title: g.title,
      reason: m.reason,
      suggestedText: already ? "Ya citada en el pie del informe." : footnote,
      insertTarget: "impression",
      placementHint: "Pie de página (footnotes) del informe",
      status: already ? "skipped" : autoSafe ? "applied" : "pending",
      autoSafe,
      reviewOnly: false,
      guidelineMeta: {
        id: g.id,
        title: g.title,
        footnote,
        source: g.source,
        tooltip: guidelineTooltip(g),
        viaClassification: m.viaClassification,
        alreadyBound: already,
      },
    });
  }

  return changes;
}

/** Inject selected guideline footnotes into the report body (before annexes). */
export function bindGuidelinesToReport(
  report: string,
  changes: ReportEnrichmentChange[]
): string {
  const lines = changes
    .filter(
      (c) =>
        c.source === "guideline" &&
        c.status === "applied" &&
        (c.guidelineMeta?.footnote || c.suggestedText)?.trim()
    )
    .map((c) => (c.guidelineMeta?.footnote || c.suggestedText).trim());

  if (!lines.length) return report;
  return updateFootnotesInReport(report, lines, []);
}

/** Lookup tooltip for a classification name (panel hover). */
export function tooltipForClassificationName(name: string): string | null {
  const nameNorm = normalizeForMatch(name);
  if (!nameNorm) return null;
  for (const g of GUIDELINE_BINDER_CATALOG) {
    if (textHasAny(nameNorm, g.matchAny)) return guidelineTooltip(g);
  }
  return null;
}
