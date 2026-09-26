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
      ? `Este panel es una vista complementaria del ÚNICO hallazgo activo para Atlas. Variá el ángulo/corte, pero NO cambies de lesión.`
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
    "MAMA / RELOJ (manecillas idénticas en ambas): 12 arriba; 3 = siempre derecha del pezón (vista de frente); 9 = siempre izquierda del pezón. Mama izquierda eje 3 = LATERAL/axila (NUNCA medial/esternón). Mama derecha eje 3 = MEDIAL/esternón. NUNCA espejar horas: mama derecha eje 10 = CSE/superior externo (izquierda del pezón) ≠ eje 2 (CSI/medial). Si el scorecard dice eje 3 izquierda, ancla la lesión al lado axilar. NO vuelques en textos clínicos explicaciones de método/pantalla (p. ej. «a la derecha de la imagen respecto al pezón»).",
    "Highlight cromático / corte SOLO en el hallazgo asignado a este panel.",
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
      ? "MODO 1 HALLAZGO: usa 2–3 paneles como vistas complementarias del MISMO hallazgo (distinto ángulo/corte)."
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


/**
 * Build mandatory Thyroid 3D directives from a TI-RADS / thyroid scorecard.
 * Mirrors vascular: scorecard governs nodules, category and laterality.
 */
export function buildThyroidDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard) return "";
  const base = buildAtlasDirectivesFromScorecard(scorecard);
  const summary = (scorecard.clinicalSummary || "").trim();
  const reco = (scorecard.recommendation || "").trim();
  const protocol = (scorecard.protocolName || scorecard.protocolId || "").toLowerCase();
  const isThyroid =
    protocol.includes("tirads") ||
    protocol.includes("ti-rads") ||
    protocol.includes("tiroid") ||
    protocol.includes("thyroid");

  let body = base;
  if (!body) {
    const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
    const evidenced = allCriteria
      .filter((c) => (c.evidence || c.value || "").trim())
      .slice(0, 10)
      .map((c, i) => {
        const val = c.value ? ` (${c.value})` : "";
        return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
      });
    if (evidenced.length || summary) {
      body = [
        `SCORECARD TIROIDES (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
        `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
        summary ? `Síntesis: ${summary}` : "",
        reco ? `Recomendación: ${reco}` : "",
        evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla TI-RADS:" : "",
        ...evidenced,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
  if (!body) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD TIROIDES (debe gobernar paneles 3D, ficha y tabla de nódulos):",
    body,
    isThyroid
      ? "Prioriza categoría TI-RADS, localización por lóbulo/istmo, tamaño en 3 ejes, composición y focos ecogénicos."
      : "Si el scorecard no es TI-RADS, extrae solo hallazgos cervicales/tiroideos aplicables; no inventes nódulos.",
    "No inventes nódulos, ganglios ni categorías TI-RADS ausentes en el scorecard/informe.",
  ].join("\n");
}


/**
 * Build mandatory Breast 3D directives from a BI-RADS / breast scorecard.
 * Mirrors thyroid/shoulder: scorecard governs lesions, category and laterality/clock site.
 * Also accepts generic/auto scorecards when criteria/summary clearly describe breast findings.
 */
export function buildBreastDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard) return "";
  const base = buildAtlasDirectivesFromScorecard(scorecard);
  const summary = (scorecard.clinicalSummary || "").trim();
  const reco = (scorecard.recommendation || "").trim();
  const protocol = (scorecard.protocolName || scorecard.protocolId || "").toLowerCase();
  const region = (scorecard.studyRegion || "").toLowerCase();
  const criteriaText = (Array.isArray(scorecard.criteria) ? scorecard.criteria : [])
    .map((c) => `${c.criterion || ""} ${c.atlasStructure || ""} ${c.evidence || ""} ${c.value || ""}`)
    .join(" ")
    .toLowerCase();
  const haystack = `${protocol} ${region} ${summary} ${criteriaText}`;
  const isBreast =
    /birads|bi-?rads|mama|mamaria|breast|axil|cuadrante|pez[oó]n|reloj|qu[ií]stic|n[oó]dulo mam/.test(
      haystack
    );

  let body = base;
  if (!body) {
    const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
    const evidenced = allCriteria
      .filter((c) => (c.evidence || c.value || "").trim())
      .slice(0, 12)
      .map((c, i) => {
        const val = c.value ? ` (${c.value})` : "";
        return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
      });
    if (evidenced.length || summary) {
      body = [
        `SCORECARD MAMA (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
        `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
        summary ? `Síntesis: ${summary}` : "",
        reco ? `Recomendación: ${reco}` : "",
        evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla BI-RADS:" : "",
        ...evidenced,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
  if (!body) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD MAMA (debe gobernar paneles 3D, ficha y tabla de lesiones):",
    body,
    isBreast
      ? "Prioriza BI-RADS, lado, posición en reloj, distancia al pezón, composición, márgenes, orientación, vascularidad y estado axilar. Reloj: 3 = derecha del pezón en la imagen (manos de reloj idénticas en ambas mamas). NUNCA intercambies composición y tamaño."
      : "Si el scorecard no es BI-RADS, extrae solo hallazgos mamarios/axilares aplicables; no inventes lesiones.",
    "No inventes nódulos, calcificaciones ni categorías BI-RADS ausentes en el scorecard/informe.",
  ].join("\n");
}

/**
 * Optional biomechanical radar payload (rotator_cuff) to harden Shoulder 3D fidelity.
 */
export type ShoulderRadarDirectiveInput = {
  radarMode?: string;
  dominantVector?: string;
  clinicalSummary?: string;
  globalScore?: number | string;
  axes?: Array<{
    name?: string;
    id?: string;
    score?: number | string;
    interpretation?: string;
    label?: string;
  }>;
} | null | undefined;

/**
 * Build mandatory Shoulder 3D directives from rotator-cuff / MSK scorecard,
 * optionally enriched with biomechanical radar axes for higher anatomic fidelity.
 */
export function buildShoulderDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: ShoulderRadarDirectiveInput
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isShoulder =
    protocol.includes("rotator") ||
    protocol.includes("manguito") ||
    protocol.includes("hombro") ||
    protocol.includes("shoulder") ||
    protocol.includes("supraespin") ||
    protocol.includes("infraespin") ||
    protocol.includes("subescap") ||
    protocol.includes("tclb") ||
    protocol.includes("biceps");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD HOMBRO / MANGUITO (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla del manguito:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeRotatorRadar =
    radarMode.includes("rotator") ||
    /ruptura_supraespinoso|bursitis|pinzamiento|otros_tendones|tendinosis_supraespinoso|\btclb\b/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeRotatorRadar) {
    radarBits.push(
      `RADAR BIOMECÁNICO MANGUITO (${radarData?.radarMode || "rotator_cuff"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD HOMBRO (debe gobernar paneles 3D, ficha y tabla del manguito rotador):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isShoulder
      ? "Prioriza laterality, tendones (supraespinoso, infraespinoso, subescapular, TCLB), grosor/gap en mm, rotura parcial vs completa (bursal/articular/intrasustancia), bursitis subacromiodeltoidea, pinzamiento dinámico y articulación AC. No inventes roturas ni grados ausentes."
      : "Si el scorecard/radar no es de manguito, extrae solo hallazgos glenohumerales/tendinosos aplicables; no inventes patología del manguito.",
    "No inventes roturas, calcificaciones, bursitis ni grados de severidad ausentes en el scorecard/radar/informe.",
  ]
    .filter(Boolean)
    .join("\n");
}


export type KneeRadarDirectiveInput = {
  radarMode?: string;
  dominantVector?: string;
  clinicalSummary?: string;
  globalScore?: number | string;
  axes?: Array<{
    name?: string;
    id?: string;
    score?: number | string;
    interpretation?: string;
    label?: string;
  }>;
} | null | undefined;

/**
 * Build mandatory Knee 3D directives from knee-cuff / MSK scorecard,
 * optionally enriched with biomechanical radar axes for higher anatomic fidelity.
 */

/** Hard topography rules for knee menisci (shared with suite prompts). */
export const KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA MENISCAL OBLIGATORIA (nunca intercambiar):",
  "- Menisco INTERNO = MEDIAL = lado TIBIAL (contrario al peroné).",
  "- Menisco EXTERNO = LATERAL = lado del PERONÉ / fibular.",
  "- Cuerno ANTERIOR ≠ CUERPO ≠ cuerno POSTERIOR.",
  "- Lateralidad de la RODILLA (derecha/izquierda del paciente) es independiente del compartimento medial/lateral.",
  "- Rodilla derecha AP: compartimento lateral/peroné a la IZQUIERDA del cuadro; medial a la DERECHA.",
  "- Rodilla izquierda AP: compartimento lateral/peroné a la DERECHA del cuadro; medial a la IZQUIERDA.",
  "- En paneles, ficha y tabla nombra siempre: menisco medial|lateral + cuerno anterior|cuerpo|posterior + lado de rodilla.",
  "- LCL y menisco externo viven del lado del peroné; LCM y menisco interno del lado tibial.",
].join("\n");

export function buildKneeDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: KneeRadarDirectiveInput
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isKnee =
    protocol.includes("knee") ||
    protocol.includes("rodilla") ||
    protocol.includes("rodilla") ||
    protocol.includes("knee") ||
    protocol.includes("menisc") ||
    protocol.includes("ligamento") ||
    protocol.includes("colateral") ||
    protocol.includes("patelar") ||
    protocol.includes("cuadriceps");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD RODILLA MSK (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla de rodilla:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeKneeRadar =
    radarMode.includes("knee") || radarMode.includes("rodilla") || radarMode.includes("knee_trauma") || radarMode.includes("knee_oa") ||
    /menisc|ligamento_colateral|lcm|lcl|baker|derrame|cartilago|gonartrosis|patelar|cuadriceps|knee_trauma|knee_oa/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeKneeRadar) {
    radarBits.push(
      `RADAR BIOMECÁNICO RODILLA (${radarData?.radarMode || "knee_msk"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA (debe gobernar paneles 3D, ficha y tabla de ligamentos-meniscos):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isKnee
      ? "Prioriza: (1) lado de rodilla del paciente, (2) menisco medial=interno/tibial vs lateral=externo/peroné, (3) cuerno anterior vs cuerpo vs posterior, (4) LCM/LCL, mecanismo extensor, derrame/Baker y cartílago. NUNCA intercambiar medial↔lateral ni anterior↔posterior. No inventes roturas ni grados ausentes."
      : "Si el scorecard/radar no es de rodilla, extrae solo hallazgos femorotibiales/meniscales/ligamentosos aplicables; no inventes patología de rodilla.",
    "No inventes desgarros meniscales, esguinces, roturas de LCA/LCP, quistes ni grados de severidad ausentes en el scorecard/radar/informe.",
    KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}


export type AnkleRadarDirectiveInput = KneeRadarDirectiveInput;

/** Hard topography rules for ankle ligaments & Achilles (shared with suite prompts). */
export const ANKLE_LIGAMENT_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA DE TOBILLO / AQUILES OBLIGATORIA (nunca intercambiar):",
  "- Complejo LATERAL = lado FIBULAR / peroné: LPAA/ATFL, LPC/CFL, LPTP/PTFL. NUNCA intercambiar con deltoides.",
  "- Complejo MEDIAL = DELTOIDES = lado TIBIAL.",
  "- Tendón de Aquiles = línea media POSTERIOR; distinguir midportion vs insercional.",
  "- Lateralidad del TOBILLO del paciente (derecha/izquierda) es independiente de medial/lateral ligamentoso.",
  "- Vista AP: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- Sindesmosis, tendones peroneos y bursa retrocalcánea son territorios DISTINTOS — no fusionar hallazgos.",
  "- En paneles, ficha y tabla nombra siempre: complejo lateral|medial|Aquiles + estructura exacta + lado de tobillo.",
  "- No inventes roturas ni grados (I–III) ausentes en el informe/scorecard.",
].join("\n");

export function buildAnkleDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: AnkleRadarDirectiveInput
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isAnkle =
    protocol.includes("ankle") ||
    protocol.includes("tobillo") ||
    protocol.includes("achilles") ||
    protocol.includes("aquiles") ||
    protocol.includes("atfl") ||
    protocol.includes("lpaa") ||
    protocol.includes("cfl") ||
    protocol.includes("lpc") ||
    protocol.includes("deltoid") ||
    protocol.includes("deltoides") ||
    protocol.includes("sindesmosis") ||
    protocol.includes("peroneo") ||
    protocol.includes("ankle_trauma");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD TOBILLO MSK (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla de tobillo:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeAnkleRadar =
    radarMode.includes("ankle") ||
    radarMode.includes("tobillo") ||
    radarMode.includes("achilles") ||
    radarMode.includes("aquiles") ||
    radarMode.includes("ankle_trauma") ||
    /tobillo|ankle|aquiles|achilles|atfl|lpaa|cfl|lpc|deltoid|deltoides|sindesmosis|peroneo|ankle_trauma/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeAnkleRadar) {
    radarBits.push(
      `RADAR BIOMECÁNICO TOBILLO / AQUILES (${radarData?.radarMode || "ankle_trauma"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD TOBILLO (debe gobernar paneles 3D, ficha y tabla de ligamentos-Aquiles):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isAnkle
      ? "Prioriza: (1) lado de tobillo del paciente, (2) complejo lateral=fibular (LPAA/ATFL, LPC/CFL, PTFL) vs medial=deltoides/tibial, (3) Aquiles midportion vs insercional, (4) sindesmosis/peroneos/bursa como territorios distintos, derrame. NUNCA intercambiar lateral↔deltoides. No inventes roturas ni grados ausentes."
      : "Si el scorecard/radar no es de tobillo/Aquiles, extrae solo hallazgos tibiotalares/ligamentosos/aquíleos aplicables; no inventes patología de tobillo.",
    "No inventes desgarros ligamentosos, roturas de Aquiles, bursitis ni grados de severidad ausentes en el scorecard/radar/informe.",
    ANKLE_LIGAMENT_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}


/** Hard topography rules for kidneys & urinary tract (shared with suite prompts). */
export const KIDNEY_URINARY_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA RENAL Y VÍAS URINARIAS OBLIGATORIA (nunca intercambiar):",
  "- Riñón DERECHO ≠ Riñón IZQUIERDO del paciente. Lateralidad anatómica del paciente manda.",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- Polo SUPERIOR ≠ polo INFERIOR; corteza ≠ médula ≠ seno ≠ pelvis ≠ cálices.",
  "- Uréter proximal / medio / distal y vejiga son estructuras distintas — no fusionar hallazgos.",
  "- Hidronefrosis/ectasia: grado 0–IV según informe; no inventar obstrucción ni litiasis ausentes.",
  "- Quistes: si hay Bosniak, respetar categoría exacta (I / II / IIF / III / IV); no subir ni bajar grado.",
  "- En paneles, ficha y tabla nombra siempre: riñón derecho|izquierdo + estructura (corteza/seno/pelvis/uréter/vejiga).",
  "- Doppler renal (si aplica): RI / estenosis / perfusión solo si el informe/scorecard lo respaldan.",
].join("\n");

export function buildKidneyDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isKidney =
    protocol.includes("renal") ||
    protocol.includes("riñon") ||
    protocol.includes("rinon") ||
    protocol.includes("kidney") ||
    protocol.includes("bosniak") ||
    protocol.includes("urin") ||
    protocol.includes("vejiga") ||
    protocol.includes("ureter") ||
    protocol.includes("uréter") ||
    protocol.includes("hidronef") ||
    protocol.includes("litiasis");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD RENAL / VÍAS URINARIAS (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla renal:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeKidneyRadar =
    radarMode.includes("renal") ||
    radarMode.includes("urin") ||
    radarMode.includes("prostate") ||
    /riñon|rinon|kidney|bosniak|hidronef|ectasia|litiasis|vejiga|ureter|pielocalic|cortical|resistiv/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeKidneyRadar) {
    radarBits.push(
      `RADAR RENAL / VÍAS URINARIAS (${radarData?.radarMode || "renal"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD RENAL (debe gobernar paneles 3D, ficha y tabla de riñones-vías):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isKidney
      ? "Prioriza: (1) lado renal del paciente (D/I), (2) corteza/médula/seno/pelvis/cálices, (3) grado de hidronefrosis, (4) litiasis/quiste-Bosniak, (5) uréteres y vejiga si están en el informe. NUNCA intercambiar riñón derecho↔izquierdo ni inventar obstrucción."
      : "Si el scorecard/radar no es renal, extrae solo hallazgos renales/urinarios aplicables; no inventes patología renal.",
    "No inventes hidronefrosis, litiasis, quistes Bosniak, estenosis ni grados de severidad ausentes en el scorecard/radar/informe.",
    KIDNEY_URINARY_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}




/** Hard topography rules for complete abdominal US (shared with suite prompts). */
export const ABDOMEN_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA ABDOMINAL OBLIGATORIA (nunca intercambiar):",
  "- Hígado (derecha) ≠ bazo (izquierda). Lateralidad anatómica del paciente manda.",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- Vesícula ≠ vías biliares (intra/extrahepáticas / colédoco); no fusionar hallazgos.",
  "- Páncreas (cabeza/cuerpo/cola), bazo, ambos riñones y asas/apéndice son territorios distintos.",
  "- No inventar colecistitis, apendicitis, diverticulitis, líquido libre ni LOE ausentes en el informe.",
  "- Esteatosis / litiasis / ectasia renal / engrosamiento parietal: grados solo si el informe/scorecard los respaldan.",
  "- En paneles, ficha y tabla nombra siempre: órgano + lado (si aplica) + estructura concreta.",
  "- Si el hallazgo dominante es renal, biliares o FID, priorízalo en el panel B sin omitir el overview.",
].join("\n");

export function buildAbdomenDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isAbdomen =
    protocol.includes("abdomen") ||
    protocol.includes("abdominal") ||
    protocol.includes("hepatic") ||
    protocol.includes("higado") ||
    protocol.includes("hígado") ||
    protocol.includes("cholecyst") ||
    protocol.includes("colecist") ||
    protocol.includes("vesicula") ||
    protocol.includes("vesícula") ||
    protocol.includes("appendic") ||
    protocol.includes("apendic") ||
    protocol.includes("diverticul") ||
    protocol.includes("pancrea") ||
    protocol.includes("visceral") ||
    protocol.includes("biliar");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD ABDOMEN COMPLETO (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla abdominal:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeAbdomenRadar =
    radarMode.includes("abdomen") ||
    radarMode.includes("hepatic") ||
    radarMode.includes("cholecyst") ||
    radarMode.includes("appendic") ||
    radarMode.includes("diverticul") ||
    radarMode.includes("visceral") ||
    radarMode.includes("renal") ||
    /higado|hígado|vesicula|vesícula|pancrea|bazo|apendic|diverticul|biliar|coledoco|colédoco|esteatos|parenquim/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeAbdomenRadar) {
    radarBits.push(
      `RADAR ABDOMINAL / VISCERAL (${radarData?.radarMode || "visceral"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD ABDOMINAL (debe gobernar paneles 3D, ficha y tabla multi-órgano):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isAbdomen
      ? "Prioriza: (1) overview abdominal, (2) hallazgo dominante hepato-biliar / pancreático / esplénico / renal / FID, (3) líquido libre, (4) no inventar apendicitis/colecistitis/colecciones ausentes. NUNCA intercambiar hígado↔bazo ni lados renales."
      : "Si el scorecard/radar no es abdominal, extrae solo hallazgos abdominales aplicables; no inventes patología abdominal.",
    "No inventes esteatosis, litiasis, ectasia, apendicitis, diverticulitis, líquido libre ni grados ausentes en el scorecard/radar/informe.",
    ABDOMEN_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}


/** Hard topography rules for abdominal wall US (hernia, diastasis, eventration). */
export const ABDOMINAL_WALL_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA DE PARED ABDOMINAL OBLIGATORIA (nunca intercambiar):",
  "- Capas: piel → tejido subcutáneo → fascia / aponeurosis → músculo (recto / oblicuos) → peritoneo.",
  "- Orificio herniario ≠ saco ≠ contenido (grasa / omento / asa). No fusionar hallazgos.",
  "- Diástasis de rectos (separación de vientres en línea alba) ≠ hernia (defecto fascial con protrusión).",
  "- Eventración / hernia incisional: relacionar con cicatriz/malla si el informe lo indica.",
  "- Lateralidad: ingle derecha ≠ izquierda; epigastrio ≠ umbilical ≠ supraumbilical ≠ infraumbilical.",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- Dinámica: reposo vs Valsalva / bipedestación; reducible vs incarcerada solo si el informe lo respalda.",
  "- No inventar incarceración, estrangulación, diástasis ni orificios ausentes en el informe.",
  "- En paneles, ficha y tabla nombra siempre: sitio + capa/orificio + contenido + dinámica.",
].join("\n");

export function buildAbdominalWallDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isWall =
    protocol.includes("pared") ||
    protocol.includes("hernia") ||
    protocol.includes("diastasis") ||
    protocol.includes("diástasis") ||
    protocol.includes("eventrac") ||
    protocol.includes("inguinal") ||
    protocol.includes("crural") ||
    protocol.includes("femoral") ||
    protocol.includes("umbilical") ||
    protocol.includes("epigastr") ||
    protocol.includes("linea alba") ||
    protocol.includes("línea alba") ||
    protocol.includes("abdominal wall");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD PARED ABDOMINAL (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla de pared:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeWallRadar =
    radarMode.includes("pared") ||
    radarMode.includes("hernia") ||
    radarMode.includes("diastasis") ||
    radarMode.includes("wall") ||
    /hernia|diastasis|diástasis|eventrac|inguinal|crural|umbilical|epigastr|fascia|orificio|valsalva|recto/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeWallRadar) {
    radarBits.push(
      `RADAR PARED ABDOMINAL (${radarData?.radarMode || "pared"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD DE PARED ABDOMINAL (debe gobernar paneles 3D, ficha y tabla):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isWall
      ? "Prioriza: (1) overview de pared, (2) orificio/defecto dominante, (3) contenido y dinámica (Valsalva/reducibilidad), (4) capas/fascia o diástasis. NUNCA inventar incarceración ni intercambiar ingle D↔I."
      : "Si el scorecard/radar no es de pared, extrae solo hallazgos de pared/hernia aplicables; no inventes defectos.",
    "No inventes orificios, diástasis, contenido visceral, incarceración ni grados ausentes en el scorecard/radar/informe.",
    ABDOMINAL_WALL_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}


/** Hard topography rules for scrotal US (testis, epididymis, cord, Doppler). */
export const SCROTUM_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA ESCROTAL OBLIGATORIA (nunca intercambiar):",
  "- Testículo DERECHO ≠ testículo IZQUIERDO. Nunca intercambiar lados.",
  "- Testículo ≠ epidídimo ≠ cordón espermático ≠ pared/bolsa escrotal.",
  "- Landmarks: mediastino testicular / rete testis; cabeza/cuerpo/cola de epidídimo.",
  "- Doppler: arteria hiliar testicular + plexo pampiniforme venoso (varicocele).",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- No inventar torsión, isquemia, tumor, varicocele ni hidrocele ausentes en el informe.",
  "- En paneles, ficha y tabla nombra siempre: lado/sitio + estructura + ecopatrón/Doppler + líquido/masa.",
].join("\n");

export function buildScrotumDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isScrotum =
    protocol.includes("escroto") ||
    protocol.includes("escrotal") ||
    protocol.includes("scrotum") ||
    protocol.includes("scrotal") ||
    protocol.includes("testiculo") ||
    protocol.includes("testículo") ||
    protocol.includes("testicular") ||
    protocol.includes("epididimo") ||
    protocol.includes("epidídimo") ||
    protocol.includes("varicocele") ||
    protocol.includes("hidrocele") ||
    protocol.includes("torsion") ||
    protocol.includes("torsión") ||
    protocol.includes("orquitis");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD ESCROTO (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla escrotal:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeScrotumRadar =
    radarMode.includes("escroto") ||
    radarMode.includes("escrotal") ||
    radarMode.includes("scrotum") ||
    radarMode.includes("testic") ||
    /escroto|testic|epididim|varicocele|hidrocele|torsion|torsión|orquitis|doppler hiliar|pampiniforme/.test(
      axisKeyBlob
    );
  if (axes.length && looksLikeScrotumRadar) {
    radarBits.push(
      `RADAR ESCROTO (${radarData?.radarMode || "escroto"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD DE ESCROTO (debe gobernar paneles 3D, ficha y tabla):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isScrotum
      ? "Prioriza: (1) overview escrotal bilateral, (2) parénquima testicular dominante, (3) epidídimo/cordón, (4) Doppler hiliar + plexo pampiniforme. NUNCA inventar torsión/isquemia/tumor ni intercambiar testículo D↔I."
      : "Si el scorecard/radar no es escrotal, extrae solo hallazgos escrotales aplicables; no inventes patología.",
    "No inventes torsión, isquemia, tumor, grados de varicocele ni hidrocele ausentes en el scorecard/radar/informe.",
    SCROTUM_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}




/** Hard topography rules for muscle / tendon US (belly, MTJ, Achilles). */
export const MUSCLE_TENDON_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA MÚSCULO-TENDINOSA OBLIGATORIA (nunca intercambiar):",
  "- Lado DERECHO ≠ IZQUIERDO. Nunca intercambiar hemicuerpos.",
  "- Vientre muscular ≠ unión miotendinosa (MTJ) ≠ tendón (midportion ≠ insercional).",
  "- Landmarks LE: isquiotibiales, cuádriceps/recto femoral, aductores, gastrocnemio/sóleo, Aquiles, plantares.",
  "- Desgarro: grado Peetrons / gap / retracción / hematoma; no inventar rotura completa si el informe dice parcial.",
  "- Aquiles: midportion ≠ insercional ≠ bursa; no inventar tendinopatía ni rotura ausentes.",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- En paneles, ficha y tabla nombra siempre: localización/lado + estructura + grosor/gap + ecopatrón + hematoma + dinámica.",
].join("\n");

export function buildMuscleTendonDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isMuscleTendon =
    protocol.includes("muscle") ||
    protocol.includes("muscul") ||
    protocol.includes("tendon") ||
    protocol.includes("tendón") ||
    protocol.includes("tendin") ||
    protocol.includes("miotendin") ||
    protocol.includes("myotendin") ||
    protocol.includes("aquiles") ||
    protocol.includes("achilles") ||
    protocol.includes("desgarro") ||
    protocol.includes("isquiotibial") ||
    protocol.includes("gemelo") ||
    protocol.includes("gastrocnemio") ||
    protocol.includes("peetrons") ||
    protocol.includes("muscle_injury");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD MÚSCULO-TENDÓN (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla músculo-tendón:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeMuscleRadar =
    radarMode.includes("muscle") ||
    radarMode.includes("muscul") ||
    radarMode.includes("tendon") ||
    radarMode.includes("tendón") ||
    radarMode.includes("aquiles") ||
    radarMode.includes("desgarro") ||
    /muscle_injury|desgarro|miotendin|aquiles|isquiotibial|gemelo|gastrocnemio|peetrons|tendinopat/.test(
      axisKeyBlob + " " + radarMode
    );
  if (axes.length && looksLikeMuscleRadar) {
    radarBits.push(
      `RADAR LESIÓN MUSCULAR (${radarData?.radarMode || "muscle_injury"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD MÚSCULO-TENDÓN (debe gobernar paneles 3D, ficha y tabla):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isMuscleTendon
      ? "Prioriza: (1) overview regional del compartimento, (2) corte del desgarro/MTJ dominante, (3) Aquiles u otro tendón si aplica. NUNCA inventar rotura completa ni intercambiar lado D↔I."
      : "Si el scorecard/radar no es músculo-tendón, extrae solo hallazgos musculares/tendinosos aplicables; no inventes patología.",
    "No inventes desgarros, gaps, retracciones, hematomas ni tendinopatías ausentes en el scorecard/radar/informe.",
    MUSCLE_TENDON_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
}




/** Hard topography rules for wrist US (extensors, carpal tunnel, TFCC). */
export const WRIST_TOPOGRAPHY_DIRECTIVE = [
  "TOPOGRAFÍA DE MUÑECA OBLIGATORIA (nunca intercambiar):",
  "- Lado DERECHO ≠ IZQUIERDO. Nunca intercambiar hemicuerpos.",
  "- Tendones dorsales (compartimentos 1–6) ≠ flexores / túnel del carpo ≠ TFCC ≠ ligamentos carpianos.",
  "- Landmarks: radio-cubital distal, escafoides, semilunar, piramidal, pisiforme, gancho del ganchoso, retináculos.",
  "- De Quervain = 1er compartimento (APL/EPB); ECU = 6º; mediano en túnel del carpo (área seccional).",
  "- TFCC: disco + ligamentos ulnocarpianos / radio-cubital distal; no inventar rotura ausente.",
  "- Vista AP/frontal: lado DERECHO del paciente a la IZQUIERDA del cuadro; IZQUIERDO a la DERECHA.",
  "- En paneles, ficha y tabla nombra siempre: lado/sitio + estructura + grosor/área + ecopatrón + líquido + dinámica.",
].join("\n");

export function buildWristDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined,
  radarData?: { radarMode?: string; globalScore?: number | string; dominantVector?: string; clinicalSummary?: string; axes?: Array<{ id?: string; name?: string; label?: string; score?: number; interpretation?: string }> }
): string {
  const protocol = (
    scorecard?.protocolName ||
    scorecard?.protocolId ||
    radarData?.radarMode ||
    ""
  ).toLowerCase();
  const isWrist =
    protocol.includes("wrist") ||
    protocol.includes("muñeca") ||
    protocol.includes("muneca") ||
    protocol.includes("carpal") ||
    protocol.includes("carpo") ||
    protocol.includes("tfcc") ||
    protocol.includes("quervain") ||
    protocol.includes("túnel del carpo") ||
    protocol.includes("tunel del carpo") ||
    protocol.includes("mediano") ||
    protocol.includes("extensor") ||
    protocol.includes("flexor digitorum");

  let body = "";
  if (scorecard) {
    const base = buildAtlasDirectivesFromScorecard(scorecard);
    const summary = (scorecard.clinicalSummary || "").trim();
    const reco = (scorecard.recommendation || "").trim();
    body = base;
    if (!body) {
      const allCriteria = Array.isArray(scorecard.criteria) ? scorecard.criteria : [];
      const evidenced = allCriteria
        .filter((c) => (c.evidence || c.value || "").trim())
        .slice(0, 12)
        .map((c, i) => {
          const val = c.value ? ` (${c.value})` : "";
          return `${i + 1}. «${c.atlasStructure || c.criterion}»${val}: ${c.evidence || c.status}`;
        });
      if (evidenced.length || summary) {
        body = [
          `SCORECARD DE MUÑECA (${scorecard.protocolName || "protocolo"} — ${scorecard.categoryAssigned || ""}):`,
          `Semáforo: ${scorecard.trafficLight}. Criterios: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
          summary ? `Síntesis: ${summary}` : "",
          reco ? `Recomendación: ${reco}` : "",
          evidenced.length ? "Hallazgos del scorecard a respetar en 3D/tabla de muñeca:" : "",
          ...evidenced,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const radarBits: string[] = [];
  const axes = Array.isArray(radarData?.axes) ? radarData!.axes! : [];
  const radarMode = String(radarData?.radarMode || "").toLowerCase();
  const axisKeyBlob = axes
    .map((a) => `${a.id || ""} ${a.name || ""} ${a.label || ""}`.toLowerCase())
    .join(" ");
  const looksLikeWristRadar =
    radarMode.includes("wrist") ||
    radarMode.includes("muñeca") ||
    radarMode.includes("muneca") ||
    radarMode.includes("carpal") ||
    radarMode.includes("tfcc") ||
    /wrist|muñeca|muneca|carpo|carpal|tfcc|quervain|túnel|tunel|mediano|extensor|flexor/.test(
      axisKeyBlob + " " + radarMode
    );
  if (axes.length && looksLikeWristRadar) {
    radarBits.push(
      `RADAR MUÑECA (${radarData?.radarMode || "wrist"} — score global ${radarData?.globalScore ?? "n/d"}):`
    );
    if (radarData?.dominantVector) {
      radarBits.push(`Vector dominante: ${radarData.dominantVector}`);
    }
    if (radarData?.clinicalSummary) {
      radarBits.push(`Síntesis radar: ${radarData.clinicalSummary}`);
    }
    radarBits.push("Ejes a respetar en ficha/tabla 3D:");
    axes.slice(0, 8).forEach((axis, i) => {
      const label = axis.label || axis.name || axis.id || `Eje ${i + 1}`;
      const score = axis.score != null ? ` score=${axis.score}` : "";
      const interp = axis.interpretation ? ` — ${axis.interpretation}` : "";
      radarBits.push(`${i + 1}. ${label}${score}${interp}`);
    });
  }

  if (!body && !radarBits.length) return "";

  return [
    "DIRECTIVA OBLIGATORIA DEL SCORECARD DE MUÑECA (debe gobernar paneles 3D, ficha y tabla):",
    body,
    radarBits.length ? radarBits.join("\n") : "",
    isWrist
      ? "Prioriza: (1) overview regional de muñeca, (2) corte del hallazgo dominante (tenosinovitis/túnel/TFCC), (3) detalle tendinoso o ligamentario si aplica. NUNCA inventar rotura completa ni intercambiar lado D↔I."
      : "Si el scorecard/radar no es de muñeca, extrae solo hallazgos carpianos/tendinosos aplicables; no inventes patología.",
    "No inventes tenosinovitis, neuropatía del mediano, roturas de TFCC ni engatillamientos ausentes en el scorecard/radar/informe.",
    WRIST_TOPOGRAPHY_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");
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
  { id: "breast_birads", label: "BI-RADS / Mama" },
  { id: "bosniak", label: "Bosniak / Quiste renal" },
  { id: "rotator_cuff", label: "Manguito rotador" },
  { id: "knee_msk", label: "Rodilla MSK" },
  { id: "achilles", label: "Tendón de Aquiles" },
  { id: "muscle_injury", label: "Lesión muscular / miotendinosa" },
  { id: "tobillo_msk", label: "Tobillo MSK" },
  { id: "hepatic", label: "Hígado / Esteatosis-Fibrosis" },
  { id: "renal", label: "Riñón integral" },
  { id: "kidney_urinary", label: "Riñón y vías urinarias" },
  { id: "abdomen_completo", label: "Abdomen completo" },
  { id: "pared_abdominal", label: "Pared abdominal" },
  { id: "scrotal", label: "Escrotal / Testicular" },
  { id: "diverticulitis", label: "Diverticulitis" },
  { id: "generic", label: "Criterios genéricos del informe" },
];
