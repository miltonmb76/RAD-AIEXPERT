import {
  Atlas3DData,
  AtlasLesionFinding,
  AtlasPanelFindingAssignment,
  AtlasPathologyOverlay,
  ClinicalScorecardData,
  ScorecardCriterion,
} from "../types";

const WEIGHT_SCORE: Record<string, number> = { critical: 30, major: 15, minor: 5 };
const ROLE_SCORE: Record<string, number> = { primary: 8, secondary: 4, incidental: 1 };

function normalizeStructureKey(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lesionRankScore(f: AtlasLesionFinding): number {
  return (WEIGHT_SCORE[f.weight] || 0) + (f.severity || 0) + (ROLE_SCORE[f.role] || 0);
}

/** Active localizable findings from scorecard criteria, ranked by clinical weight. */
export function rankActiveScorecardFindings(
  scorecard: ClinicalScorecardData | null | undefined
): ScorecardCriterion[] {
  if (!scorecard?.criteria?.length) return [];
  return scorecard.criteria
    .filter((c) => c.status === "met" || c.status === "equivocal")
    .slice()
    .sort((a, b) => {
      const wa = (WEIGHT_SCORE[a.weight] || 0) + (a.severity || 0);
      const wb = (WEIGHT_SCORE[b.weight] || 0) + (b.severity || 0);
      return wb - wa;
    });
}

/**
 * Distinct lesions for Atlas: prefer scorecard.atlasFindings (full-report inventory);
 * fallback groups met/equivocal criteria by atlasStructure so checklist facets ≠ separate lesions.
 */
export function collectAtlasLesionFindings(
  scorecard: ClinicalScorecardData | null | undefined
): AtlasLesionFinding[] {
  if (!scorecard) return [];

  if (scorecard.atlasFindings?.length) {
    const byKey = new Map<string, AtlasLesionFinding>();
    for (const raw of scorecard.atlasFindings) {
      const structure = (raw.structure || raw.label || "").trim();
      if (!structure) continue;
      const key = normalizeStructureKey(structure);
      const next: AtlasLesionFinding = {
        id: raw.id || `lesion-${byKey.size + 1}`,
        label: (raw.label || structure).trim(),
        structure,
        evidence: (raw.evidence || "").trim(),
        value: raw.value,
        weight: raw.weight || "major",
        severity: typeof raw.severity === "number" ? raw.severity : 0,
        role: raw.role || "secondary",
        linkedCriterionId: raw.linkedCriterionId,
        suggestedPanelFocus: raw.suggestedPanelFocus,
      };
      const prev = byKey.get(key);
      if (!prev || lesionRankScore(next) > lesionRankScore(prev)) {
        byKey.set(key, next);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => lesionRankScore(b) - lesionRankScore(a));
  }

  // Fallback: collapse protocol criteria into distinct structures
  const ranked = rankActiveScorecardFindings(scorecard);
  const byKey = new Map<string, AtlasLesionFinding>();
  for (const c of ranked) {
    const structure = (c.atlasStructure || c.criterion || "").trim();
    if (!structure) continue;
    const key = normalizeStructureKey(structure);
    const next: AtlasLesionFinding = {
      id: c.id,
      label: c.criterion,
      structure,
      evidence: c.evidence || "",
      value: c.value,
      weight: c.weight,
      severity: c.severity,
      role: "primary",
      linkedCriterionId: c.id,
      suggestedPanelFocus: c.suggestedPanelFocus,
    };
    const prev = byKey.get(key);
    if (!prev || lesionRankScore(next) > lesionRankScore(prev)) {
      byKey.set(key, next);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => lesionRankScore(b) - lesionRankScore(a));
}

function formatFindingLine(c: ScorecardCriterion, idx: number): string {
  const val = c.value ? ` (${c.value})` : "";
  return `${idx + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.criterion}`;
}

function formatLesionLine(f: AtlasLesionFinding, idx: number): string {
  const val = f.value ? ` (${f.value})` : "";
  const role =
    f.role === "primary" ? "principal" : f.role === "incidental" ? "incidental" : "secundario";
  return `${idx + 1}. [${role}] «${f.structure}»${val}: ${f.evidence || f.label}`;
}

/** Build a rich, panel-scoped Scorecard directive for ONE lesion (keeps accuracy, avoids dominant bias). */
export function buildPanelScopedFindingDirective(
  scorecard: ClinicalScorecardData,
  finding: AtlasLesionFinding | ScorecardCriterion,
  opts: { mode: "shared_single" | "dedicated"; panelLetter: string; siblingHints?: string }
): string {
  const isLesion = "structure" in finding && "role" in finding;
  const structure = isLesion
    ? (finding as AtlasLesionFinding).structure || (finding as AtlasLesionFinding).label
    : (finding as ScorecardCriterion).atlasStructure || (finding as ScorecardCriterion).criterion;
  const evidence = finding.evidence || "según informe";
  const label = isLesion
    ? (finding as AtlasLesionFinding).label
    : (finding as ScorecardCriterion).criterion;
  const role = isLesion ? (finding as AtlasLesionFinding).role : "primary";
  const val = finding.value ? ` Valor/medida: ${finding.value}.` : "";
  const sharedNote =
    opts.mode === "shared_single"
      ? `Este panel es una vista complementaria del ÚNICO hallazgo activo para Atlas. Variá el ángulo/cutaway, pero NO cambies de lesión.`
      : `Este panel está DEDICADO en exclusiva a ESTE hallazgo (${role}). NO redibujes ni priorices otras lesiones. Otras lesiones solo como contexto anatómico mínimo si ayudan a orientar.`;

  return [
    `DIRECTIVA SCORECARD ACOTADA AL PANEL ${opts.panelLetter} (${scorecard.protocolName} — ${scorecard.categoryAssigned}):`,
    `Hallazgo asignado: «${structure}» (${label}).`,
    `Rol en el estudio: ${role}.`,
    `Evidencia del scorecard/informe:${val} ${evidence}.`,
    `Peso: ${finding.weight || "major"}; severidad: ${finding.severity ?? "n/d"}.`,
    sharedNote,
    "Mantén exactitud morfométrica/morfológica (medidas, lado, aspecto).",
    "LATERALIDAD AP: «Derecha/Izquierda» = lado anatómico del paciente de frente (como radiografía AP). En vista AP/coronal, lado derecho del paciente = izquierda del cuadro; lado izquierdo del paciente = derecha del cuadro.",
    "MAMA / RELOJ (manecillas idénticas en ambas): 12 arriba; 3 = siempre derecha del pezón (vista de frente); 9 = siempre izquierda del pezón. Mama izquierda eje 3 = LATERAL/axila (NUNCA medial/esternón). Mama derecha eje 3 = MEDIAL/esternón. Si el scorecard dice eje 3 izquierda, el panel DEBE anclar la lesión al lado axilar (derecha de la imagen respecto al pezón).",
    "Highlight cromático / cutaway SOLO en el hallazgo asignado a este panel.",
    "No inventes hallazgos fuera de esta directiva acotada.",
    opts.siblingHints ? `Contexto de otros hallazgos del estudio (NO dibujar como foco): ${opts.siblingHints}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Assign distinct Scorecard lesions to Atlas panels:
 * - 1 lesion  → 2–3 panels all on that finding (shared_single)
 * - 2 lesions → 2 panels, one each (dedicated)
 * - 3+ lesions → 3 panels, top 3 by weight/severity (dedicated)
 */
export function buildAtlasPanelFindingAssignments(
  scorecard: ClinicalScorecardData | null | undefined
): AtlasPanelFindingAssignment[] {
  const ranked = collectAtlasLesionFindings(scorecard);
  if (!scorecard || !ranked.length) return [];

  const top = ranked.slice(0, 3);
  const findingCount = top.length;
  const panelCount = findingCount === 1 ? 3 : findingCount; // 1→3 vistas; 2→2; 3→3
  const letters = ["A", "B", "C"].slice(0, panelCount);
  const mode: "shared_single" | "dedicated" = findingCount === 1 ? "shared_single" : "dedicated";

  return letters.map((panelLetter, idx) => {
    const finding = mode === "shared_single" ? top[0] : top[idx];
    const siblings = top
      .filter((f) => f.id !== finding.id)
      .map((f) => f.structure || f.label)
      .join("; ");
    return {
      panelLetter,
      findingId: finding.id,
      label: finding.label,
      structure: finding.structure,
      evidence: finding.evidence || "",
      value: finding.value,
      weight: finding.weight,
      severity: finding.severity,
      mode,
      directive: buildPanelScopedFindingDirective(scorecard, finding, {
        mode,
        panelLetter,
        siblingHints: siblings || undefined,
      }),
    };
  });
}

/** Human-readable planning block injected into Atlas plan prompt. */
export function formatAtlasFindingAssignmentPlan(
  assignments: AtlasPanelFindingAssignment[],
  scorecard?: ClinicalScorecardData | null
): string {
  if (!assignments.length) return "";
  const mode = assignments[0].mode;
  const header =
    mode === "shared_single"
      ? "MODO 1 HALLAZGO: usa 2–3 paneles como vistas complementarias del MISMO hallazgo (distinto ángulo/cutaway)."
      : `MODO ${assignments.length} HALLAZGOS: exactamente 1 panel por hallazgo asignado. Cada panel DEDICADO a su hallazgo (scorecard completo de ese hallazgo).`;

  const lines = assignments.map((a) => {
    return [
      `PANEL ${a.panelLetter} [${a.mode}] → «${a.structure}»`,
      `  Criterio: ${a.label}`,
      a.value ? `  Valor: ${a.value}` : null,
      `  Evidencia: ${a.evidence || "n/d"}`,
      `  pathologySite DEBE ser: ${a.structure}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `ASIGNACIÓN OBLIGATORIA SCORECARD → PANELES (${scorecard?.protocolName || "protocolo"}):`,
    header,
    ...lines,
    "Respeta esta asignación al definir panelTitle, anatomicalFocus y spatialContract.pathologySite/pathologyAppearance.",
  ].join("\n");
}

/** Build Atlas customDirectives from scorecard so 3D generation focuses on active pathology. */
export function buildAtlasDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard) return "";
  const lesions = collectAtlasLesionFindings(scorecard);
  const active = rankActiveScorecardFindings(scorecard);
  if (!lesions.length && !active.length) return "";

  const lesionLines = lesions.slice(0, 5).map((f, i) => formatLesionLine(f, i));
  const criterionLines = active.slice(0, 8).map((c, i) => formatFindingLine(c, i));

  return [
    `PATOLOGÍA ACTIVA DEL SCORECARD (${scorecard.protocolName} — ${scorecard.categoryAssigned}):`,
    `Semáforo: ${scorecard.trafficLight}. Criterios positivos: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
    lesionLines.length
      ? "Lesiones localizables del informe (inventario Atlas — principales y secundarias):"
      : "",
    ...lesionLines,
    criterionLines.length && !lesionLines.length
      ? "Hallazgos activos del protocolo (ordenados por peso/severidad):"
      : "",
    ...(!lesionLines.length ? criterionLines : []),
    "Si hay asignación por panel, cada panel debe respetar SU hallazgo acotado (no diluir con el dominante ajeno).",
    "No inventes hallazgos fuera de esta lista.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build mandatory Vascular 3D directives from a (typically vascular) scorecard.
 * Same clinical source as Atlas/Focal, with hemodynamics-first wording.
 * Falls back to clinical summary when no criterion is marked met/equivocal.
 */
export function buildVascularDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard) return "";
  const base = buildAtlasDirectivesFromScorecard(scorecard);
  const summary = (scorecard.clinicalSummary || "").trim();
  const reco = (scorecard.recommendation || "").trim();
  const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];

  // If no "active" criteria lines, still inject summary / any criterion with evidence
  let body = base;
  if (!body) {
    const evidenced = allCriteria
      .filter((c) => (c.evidence || c.value || "").trim())
      .slice(0, 8)
      .map((c, i) => {
        const val = c.value ? ` (${c.value})` : "";
        return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
      });
    if (evidenced.length || summary) {
      body = [
        `SCORECARD VASCULAR (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
        `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
        summary ? `Síntesis: ${summary}` : "",
        reco ? `Recomendación: ${reco}` : "",
        evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla:" : "",
        ...evidenced,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
  if (!body) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD VASCULAR (debe gobernar paneles 3D y tabla hemodinámica):",
    body,
    "Representa fielmente estenosis, placa/trombo, patrón de flujo, índices y lateralidad del scorecard.",
    "No inventes lesiones vasculares ni grados de estenosis ausentes en el scorecard/informe.",
  ].join("\n");
}

/** Merge scorecard-derived overlays onto existing atlas data (panel letters remapped if needed). */
export function alignOverlaysToPanelAssignments(
  overlays: AtlasPathologyOverlay[] | undefined,
  assignments: AtlasPanelFindingAssignment[] | undefined
): AtlasPathologyOverlay[] {
  if (!overlays?.length) return [];
  if (!assignments?.length) return overlays;

  return overlays.map((o, idx) => {
    const key = normalizeStructureKey(o.structure || o.finding || "");
    const match =
      assignments.find((a) => {
        const ak = normalizeStructureKey(a.structure || a.label);
        return (
          !!key &&
          !!ak &&
          (ak.includes(key.slice(0, 14)) || key.includes(ak.slice(0, 14)))
        );
      }) || assignments[Math.min(idx, assignments.length - 1)];
    return {
      ...o,
      panelLetter: match?.panelLetter || o.panelLetter,
      status:
        match && assignments[0]?.mode === "dedicated" && idx > 0
          ? o.status || "secondary"
          : o.status,
    };
  });
}

export function mergeOverlaysOntoAtlas(
  atlas: Atlas3DData | null,
  overlays: AtlasPathologyOverlay[] | undefined,
  source: Atlas3DData["overlaySource"] = "scorecard"
): Atlas3DData | null {
  if (!atlas || !overlays?.length) return atlas;

  const aligned = alignOverlaysToPanelAssignments(
    overlays,
    atlas.panelFindingAssignments
  );

  const panelLetters = (atlas.panels || [])
    .map((p) => (p.panelLetter || "").toUpperCase())
    .filter(Boolean);
  const fallbackLetter = panelLetters[0] || "A";

  const normalized = aligned.map((o, idx) => {
    const letter = (o.panelLetter || "").toUpperCase();
    const panelLetter = panelLetters.includes(letter) ? letter : fallbackLetter;
    return {
      ...o,
      id: o.id || `ov-${idx + 1}`,
      panelLetter,
      marker: o.marker || String.fromCharCode(65 + idx),
      severity: Math.min(10, Math.max(0, Math.round(o.severity || 0))),
      status: o.status || "active",
    } as AtlasPathologyOverlay;
  });

  // Enrich synoptic rows when structure matches and finding is richer
  const synoptic = [...(atlas.synopticExplanation || atlas.synopticTable || [])];
  for (const ov of normalized) {
    if (ov.severity < 2) continue;
    const idx = synoptic.findIndex(
      (s) =>
        (s.structure || "").toLowerCase().includes((ov.structure || "").toLowerCase().slice(0, 18)) ||
        (ov.structure || "").toLowerCase().includes((s.structure || "").toLowerCase().slice(0, 18))
    );
    const detail = `${ov.finding}${ov.evidence ? ` — ${ov.evidence}` : ""}`;
    if (idx >= 0) {
      synoptic[idx] = {
        ...synoptic[idx],
        findingDetail: detail,
        panelRef: synoptic[idx].panelRef || `(Panel ${ov.panelLetter})`,
      };
    } else {
      synoptic.push({
        structure: ov.structure,
        findingDetail: detail,
        panelRef: `(Panel ${ov.panelLetter})`,
      });
    }
  }

  return {
    ...atlas,
    pathologyOverlays: normalized,
    overlaySource: source,
    synopticExplanation: synoptic,
    synopticTable: synoptic,
  };
}

export function scorecardTrafficLabel(light: ClinicalScorecardData["trafficLight"]): string {
  switch (light) {
    case "critical":
      return "Crítico";
    case "high":
      return "Alto";
    case "moderate":
      return "Moderado";
    default:
      return "Bajo";
  }
}

export function criterionStatusLabel(status: ScorecardCriterion["status"]): string {
  switch (status) {
    case "met":
      return "Cumple";
    case "not_met":
      return "No cumple";
    case "equivocal":
      return "Dudoso";
    default:
      return "No mencionado";
  }
}

export function criterionWeightLabel(weight: ScorecardCriterion["weight"] | string): string {
  switch (weight) {
    case "critical":
      return "Crítico";
    case "major":
      return "Mayor";
    case "minor":
      return "Menor";
    default:
      return String(weight || "");
  }
}

export const SCORECARD_PROTOCOL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "auto", label: "Detección automática" },
  { id: "custom", label: "Personalizado (usar cuadro de texto)" },
  { id: "cholecystitis", label: "Colecistitis aguda" },
  { id: "appendicitis", label: "Apendicitis" },
  { id: "thyroid_tirads", label: "TI-RADS / Tiroides" },
  { id: "bosniak", label: "Bosniak / Quiste renal" },
  { id: "rotator_cuff", label: "Manguito rotador" },
  { id: "achilles", label: "Tendón de Aquiles" },
  { id: "hepatic", label: "Hígado / Esteatosis-Fibrosis" },
  { id: "renal", label: "Riñón integral" },
  { id: "scrotal", label: "Escrotal / Testicular" },
  { id: "diverticulitis", label: "Diverticulitis" },
  { id: "generic", label: "Criterios genéricos del informe" },
];
