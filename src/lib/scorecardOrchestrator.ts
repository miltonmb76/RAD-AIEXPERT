import type { ClinicalScorecardData } from "../types";
import { getScorecardGovernance } from "./clinicalIntelligence";
import { seedAnchorFromScorecard } from "./diagnosisAnchor";
import { getSpecificSuiteShortcut, type SpecificSuiteShortcut } from "./suiteShortcuts";
import { suggestLesionTarget } from "./usPlaneBridge";

export type ScorecardOrchestratorAction =
  | "seed_anchor"
  | "open_suite"
  | "open_bridge"
  | "open_pack"
  | "open_infographic"
  | "apply_all";

export interface ScorecardOrchestrationPlan {
  diagnosisAnchor: string | null;
  suite: (SpecificSuiteShortcut & { reason: string }) | null;
  bridge: { recommend: boolean; lesionTarget: string; reason: string } | null;
  pack: {
    recommend: boolean;
    preferredSuiteId: string | null;
    reason: string;
  } | null;
  infographic: { recommend: boolean; reason: string } | null;
}

const SUITE_HINTS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: "vascular3d", label: "Suite Vascular 3D", re: /vascular|doppler|carotid|tvp|tromb|venos|arter/i },
  { id: "breast3d", label: "Suite Mama 3D", re: /mama|mamari|birads|breast|axil/i },
  { id: "thyroid3d", label: "Suite Tiroides 3D", re: /tiroid|tirads|cuello|nodulo tiroid/i },
  { id: "shoulder3d", label: "Suite Hombro 3D", re: /hombro|manguito|supraespin|biceps|supraesp/i },
  { id: "knee3d", label: "Suite Rodilla 3D", re: /rodilla|menisc|lca|lcp|patel|rotul|saltador/i },
  { id: "ankle3d", label: "Suite Tobillo 3D", re: /tobillo|aquiles|atfl|lpaa|deltoid/i },
  {
    id: "muscleTendon3d",
    label: "Suite Músculo-Tendón 3D",
    re: /musculo|tendon|pantorrilla|muslo|gemelo/i,
  },
  { id: "wrist3d", label: "Suite Muñeca 3D", re: /muneca|muñeca|carpo|tunel|mediano/i },
  { id: "kidney3d", label: "Suite Riñón 3D", re: /rinon|riñón|renal|vias urin|hidronef/i },
  {
    id: "abdominalWall3d",
    label: "Suite Pared Abdominal 3D",
    re: /pared abdominal|hernia|diastasis|linea alba/i,
  },
  { id: "scrotum3d", label: "Suite Escroto 3D", re: /escrot|testicul|epididim|varicocele/i },
  {
    id: "abdomen3d",
    label: "Suite Abdomen 3D",
    re: /abdomen|higado|vesicula|colecist|pancreas|bazo|apendic/i,
  },
];

/** Infer suite from free clinical text (protocol / region / category). */
export function suggestSuiteFromClinicalText(blob: string): SpecificSuiteShortcut | null {
  const t = String(blob || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t.trim()) return null;
  for (const h of SUITE_HINTS) {
    if (h.re.test(t)) return { id: h.id, label: h.label };
  }
  return null;
}

export function suiteDomId(suiteId: string): string {
  const map: Record<string, string> = {
    thyroid3d: "thyroid-3d-suite-module",
    breast3d: "breast-3d-suite-module",
    shoulder3d: "shoulder-3d-suite-module",
    knee3d: "knee-3d-suite-module",
    ankle3d: "ankle-3d-suite-module",
    kidney3d: "kidney-3d-suite-module",
    abdomen3d: "abdomen-3d-suite-module",
    abdominalWall3d: "abdominal-wall-3d-suite-module",
    scrotum3d: "scrotum-3d-suite-module",
    muscleTendon3d: "muscle-tendon-3d-suite-module",
    wrist3d: "wrist-3d-suite-module",
    vascular3d: "vascular-3d-module",
  };
  return map[suiteId] || "";
}

/**
 * Build a case orchestration plan from a finished scorecard + session context.
 * Pure: does not open modules; App applies actions.
 */
export function buildScorecardOrchestrationPlan(opts: {
  scorecard: ClinicalScorecardData | null | undefined;
  diagnosisAnchor?: string | null;
  specificStudy?: string | null;
  modality?: string | null;
  studyType?: string | null;
  reportText?: string | null;
  hasGalleryUs?: boolean;
  hasUsPlaneData?: boolean;
  hasInfographic?: boolean;
  hasPack?: boolean;
  hasSuitePanels?: boolean;
}): ScorecardOrchestrationPlan | null {
  const sc = opts.scorecard;
  const gov = getScorecardGovernance(sc);
  if (!sc || !gov) return null;

  const seededAnchor =
    seedAnchorFromScorecard(String(opts.diagnosisAnchor || ""), sc) ||
    gov.finalDiagnosis ||
    gov.shortLabel ||
    gov.categoryAssigned;

  if (!seededAnchor && !gov.categoryAssigned) return null;

  const fromStudy =
    getSpecificSuiteShortcut(
      String(opts.specificStudy || opts.studyType || ""),
      String(opts.modality || "")
    ) || getSpecificSuiteShortcut(String(opts.studyType || ""), "");

  const fromScorecardText = suggestSuiteFromClinicalText(
    [
      sc.finalDiagnosis,
      sc.protocolName,
      sc.protocolId,
      sc.studyRegion,
      sc.categoryAssigned,
      gov.categorySystem,
      (sc.atlasFindings || []).map((f) => f.label || f.structure).join(" "),
      (sc.atlasOverlays || []).map((o) => o.structure || o.finding).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );

  const suiteBase = fromStudy || fromScorecardText;
  const suite = suiteBase
    ? {
        ...suiteBase,
        reason: fromStudy
          ? `Estudio seleccionado → ${suiteBase.label}`
          : `Inferido del scorecard (${gov.finalDiagnosis || gov.categoryAssigned})`,
      }
    : null;

  const lesionTarget = suggestLesionTarget({
    diagnosisAnchor: seededAnchor || opts.diagnosisAnchor,
    reportText: opts.reportText,
    scorecardData: sc,
  });

  const bridgeRecommend =
    !!opts.hasGalleryUs ||
    /eco|ultra|us\b|doppler/i.test(
      `${opts.modality || ""} ${opts.specificStudy || ""} ${opts.studyType || ""} ${sc.protocolName || ""}`
    );

  const bridge = bridgeRecommend
    ? {
        recommend: true,
        lesionTarget,
        reason: opts.hasUsPlaneData
          ? "Bridge ya tiene datos — revisar / regenerar con el ancla"
          : lesionTarget
            ? `Correlacionar eco ↔ 3D en «${lesionTarget}»`
            : "Correlacionar eco real con corte 3D focal",
      }
    : null;

  const hasCriteria = (sc.criteria || []).some((c) => {
    const st = String(c.status || "").toLowerCase();
    return st === "met" || st === "equivocal";
  });

  const pack = {
    recommend: true,
    preferredSuiteId: suite?.id || null,
    reason: opts.hasPack
      ? "Pack existente — actualizar con ancla del scorecard"
      : hasCriteria
        ? "Lámina 1 página: ancla + criterios + imagen de suite/bridge"
        : "Lámina 1 página anclada a la categoría del scorecard",
  };

  const infographic = {
    recommend: hasCriteria || !!(sc.atlasFindings || []).length,
    reason: opts.hasInfographic
      ? "Infografía existente — refrescar con criterios del scorecard"
      : "Mapear criterios cumplidos / equívocos a justificación visual",
  };

  return {
    diagnosisAnchor: seededAnchor || null,
    suite,
    bridge,
    pack,
    infographic: infographic.recommend ? infographic : null,
  };
}

export function orchestrationActionCount(plan: ScorecardOrchestrationPlan | null): number {
  if (!plan) return 0;
  let n = 0;
  if (plan.diagnosisAnchor) n++;
  if (plan.suite) n++;
  if (plan.bridge?.recommend) n++;
  if (plan.pack?.recommend) n++;
  if (plan.infographic?.recommend) n++;
  return n;
}
