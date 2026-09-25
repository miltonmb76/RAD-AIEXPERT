import type {
  ClinicalScorecardData,
  FindingsInfographicData,
  FindingsInfographicContentMode,
  FindingsInfographicLayout,
  FindingsInfographicNode,
  NegativityChecklistData,
} from "../types";
import { normalizeFindingsInfographicData } from "./findingsInfographic";

function clip(text: string | undefined, max = 160): string | undefined {
  const t = String(text || "").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Scorecard → infografía de criterios (met / equivocal → nodos).
 */
export function infographicFromScorecard(
  scorecard: ClinicalScorecardData
): FindingsInfographicData {
  const criteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
  let source = criteria.filter(
    (c) => c.status === "met" || c.status === "equivocal"
  );
  if (!source.length) {
    source = criteria.filter((c) => c.criterion?.trim());
  }

  const nodes: FindingsInfographicNode[] = source.slice(0, 8).map((c, i) => ({
    id: String(c.id || `sc-crit-${i + 1}`),
    label: String(c.criterion || "").trim() || `Criterio ${i + 1}`,
    detail: clip(
      [c.value, c.evidence].filter((x) => String(x || "").trim()).join(" · ")
    ),
    weight:
      c.weight === "critical" || c.weight === "major" ? "primary" : "secondary",
    polarity:
      c.status === "met"
        ? "criterion"
        : c.status === "not_met"
          ? "ruled_out"
          : "present",
    group: c.atlasStructure ? String(c.atlasStructure).trim() : undefined,
  }));

  // If still empty, use atlas findings as last resort
  if (!nodes.length && Array.isArray(scorecard.atlasFindings)) {
    scorecard.atlasFindings.slice(0, 8).forEach((f, i) => {
      nodes.push({
        id: String(f.id || `sc-af-${i + 1}`),
        label: String(f.label || "").trim(),
        detail: clip(f.evidence),
        weight: f.weight === "critical" || f.weight === "major" ? "primary" : "secondary",
        polarity: "present",
        group: f.structure,
      });
    });
  }

  const diagnosis =
    String(scorecard.categoryAssigned || scorecard.protocolName || "").trim() ||
    "Clasificación del protocolo";

  const layout: FindingsInfographicLayout =
    nodes.length >= 5 ? "funnel" : "pillars";
  const contentMode: FindingsInfographicContentMode = "classification_criteria";

  return normalizeFindingsInfographicData(
    {
      title: "Criterios de clasificación",
      diagnosis,
      studyRegion: scorecard.studyRegion,
      contentMode,
      layout,
      nodes,
      synthesis: clip(
        [
          scorecard.clinicalSummary,
          scorecard.scoreTotal
            ? `Criterios cumplidos: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        320
      ),
    },
    diagnosis,
    layout,
    contentMode
  );
}

/**
 * Checklist de negatividad → descartados / presentes vs descartados.
 */
export function infographicFromNegativity(
  checklist: NegativityChecklistData
): FindingsInfographicData {
  const items = Array.isArray(checklist.items) ? checklist.items : [];
  const negatives = items.filter((i) => i.status === "negative" && i.sign?.trim());
  const positives = items.filter((i) => i.status === "positive" && i.sign?.trim());

  let contentMode: FindingsInfographicContentMode;
  let layout: FindingsInfographicLayout;
  let nodes: FindingsInfographicNode[] = [];

  if (positives.length > 0 && negatives.length > 0) {
    contentMode = "present_vs_ruled";
    layout = "split_compare";
    nodes = [
      ...positives.slice(0, 5).map((i, idx) => ({
        id: String(i.id || `neg-pos-${idx + 1}`),
        label: String(i.sign || "").trim(),
        detail: clip(
          [i.laterality, i.evidence || i.whyItMatters].filter(Boolean).join(" · ")
        ),
        weight: "primary" as const,
        polarity: "present" as const,
      })),
      ...negatives.slice(0, 5).map((i, idx) => ({
        id: String(i.id || `neg-neg-${idx + 1}`),
        label: String(i.sign || "").trim(),
        detail: clip(
          [i.laterality, i.evidence || i.whyItMatters].filter(Boolean).join(" · ")
        ),
        weight: "secondary" as const,
        polarity: "ruled_out" as const,
      })),
    ].slice(0, 10);
  } else if (negatives.length > 0) {
    contentMode = "ruled_out";
    layout = "cascade";
    nodes = negatives.slice(0, 8).map((i, idx) => ({
      id: String(i.id || `neg-${idx + 1}`),
      label: String(i.sign || "").trim(),
      detail: clip(
        [i.laterality, i.evidence || i.whyItMatters].filter(Boolean).join(" · ")
      ),
      weight: idx < 2 ? ("primary" as const) : ("secondary" as const),
      polarity: "ruled_out" as const,
    }));
  } else {
    contentMode = "present_findings";
    layout = "pillars";
    const fallback = positives.length
      ? positives
      : items.filter((i) => i.sign?.trim());
    nodes = fallback.slice(0, 8).map((i, idx) => ({
      id: String(i.id || `neg-f-${idx + 1}`),
      label: String(i.sign || "").trim(),
      detail: clip(
        [i.laterality, i.evidence || i.whyItMatters].filter(Boolean).join(" · ")
      ),
      weight: idx < 2 ? ("primary" as const) : ("secondary" as const),
      polarity: "present" as const,
    }));
  }

  const diagnosis =
    String(
      checklist.requestedFocus ||
        checklist.protocolName ||
        checklist.title ||
        ""
    ).trim() || "Checklist de negatividad";

  const synthBits = [
    checklist.discardedSynopsis || checklist.recommendation,
    checklist.closureSummary,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  return normalizeFindingsInfographicData(
    {
      title:
        contentMode === "ruled_out"
          ? "Hallazgos descartados"
          : contentMode === "present_vs_ruled"
            ? "Presentes y descartados"
            : "Hallazgos presentes",
      diagnosis,
      studyRegion: checklist.studyRegion,
      contentMode,
      layout,
      nodes,
      synthesis: clip(synthBits.join(" "), 320),
    },
    diagnosis,
    layout,
    contentMode
  );
}
