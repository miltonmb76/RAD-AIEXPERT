import type {
  ClassificationRecommendation,
  ClinicalScorecardData,
  NegativityChecklistData,
  ReportEnrichmentChange,
  ReportEnrichmentSession,
  ScorecardCriterion,
  SecondReaderData,
} from "../types";
import {
  normalizeNegativityChecklistData,
  refreshNegativityChecklistClosure,
} from "./negativityChecklist";
import { normalizeSecondReaderData } from "./secondReader";

export const MAX_AUTO_ENRICHMENT_CHANGES = 6;
export const MAX_AUTO_CLASSIFICATIONS = 2;
export const MAX_AUTO_SCORECARD_PROSE = 4;

const CONFIDENCE_RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };
const WEIGHT_RANK: Record<string, number> = { critical: 0, major: 1, minor: 2 };

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function previewText(raw: string, max = 220): string {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonical Spanish clinical sentence from a met/equivocal scorecard criterion. */
export function buildCanonicalScorecardPhrase(c: ScorecardCriterion): string {
  const structure = String(c.atlasStructure || c.criterion || "").trim();
  const value = String(c.value || "").trim();
  const evidence = String(c.evidence || "").trim();

  if (evidence.length >= 25) {
    const base = /[.!?…]$/.test(evidence) ? evidence : `${evidence}.`;
    if (c.status === "equivocal" && !/equ[ií]voc|dudoso|indeterminad/i.test(base)) {
      return `Hallazgo equívoco — ${structure}${value ? ` (${value})` : ""}: ${base}`;
    }
    return base;
  }

  if (c.status === "equivocal") {
    if (value && structure) {
      return evidence
        ? `Hallazgo equívoco en relación con ${structure} (${value}): ${evidence.replace(/[.!?]$/, "")}.`
        : `Hallazgo equívoco en relación con ${structure} (${value}).`;
    }
    return evidence
      ? `Hallazgo equívoco en relación con ${structure}: ${evidence.replace(/[.!?]$/, "")}.`
      : `Hallazgo equívoco en relación con ${structure}.`;
  }

  if (value && structure) {
    return evidence
      ? `Se documenta ${structure} (${value}): ${evidence.replace(/[.!?]$/, "")}.`
      : `Se documenta ${structure} (${value}).`;
  }
  if (structure) {
    return evidence
      ? `Se documenta ${structure}: ${evidence.replace(/[.!?]$/, "")}.`
      : `Se documenta ${structure}.`;
  }
  return evidence || "Hallazgo positivo del protocolo clínico.";
}

export function reportAlreadyCoversScorecardCriterion(
  report: string,
  c: ScorecardCriterion,
  phrase: string
): boolean {
  const r = normalizeForMatch(report);
  if (!r) return false;

  const phraseN = normalizeForMatch(phrase);
  if (phraseN.length >= 28 && r.includes(phraseN.slice(0, Math.min(48, phraseN.length)))) {
    return true;
  }

  const evidenceN = normalizeForMatch(c.evidence || "");
  if (evidenceN.length >= 24 && r.includes(evidenceN.slice(0, 40))) {
    return true;
  }

  const structureTokens = normalizeForMatch(c.atlasStructure || c.criterion)
    .split(" ")
    .filter((w) => w.length > 3);
  const valueN = normalizeForMatch(c.value || "");
  if (structureTokens.length >= 2) {
    const hits = structureTokens.filter((t) => r.includes(t)).length;
    if (hits >= Math.ceil(structureTokens.length * 0.65)) {
      if (!valueN || valueN.length < 2 || r.includes(valueN)) return true;
    }
  }
  return false;
}

/**
 * Turn met/equivocal scorecard criteria into weaveable report prose.
 * Skips criteria already covered by the draft report.
 */
export function selectScorecardProseChanges(
  scorecard: ClinicalScorecardData | null | undefined,
  report: string,
  maxAuto: number = MAX_AUTO_SCORECARD_PROSE
): ReportEnrichmentChange[] {
  if (!scorecard?.criteria?.length) return [];

  const ranked = scorecard.criteria
    .filter((c) => c.status === "met" || c.status === "equivocal")
    .slice()
    .sort((a, b) => {
      const wa = WEIGHT_RANK[a.weight] ?? 1;
      const wb = WEIGHT_RANK[b.weight] ?? 1;
      if (wa !== wb) return wa - wb;
      return (b.severity || 0) - (a.severity || 0);
    });

  const changes: ReportEnrichmentChange[] = [];
  let autoCount = 0;

  for (const c of ranked) {
    const phrase = buildCanonicalScorecardPhrase(c).trim();
    if (!phrase) continue;
    const already = reportAlreadyCoversScorecardCriterion(report, c, phrase);
    const autoSafe = !already && autoCount < maxAuto;
    if (autoSafe) autoCount += 1;

    const structure = String(c.atlasStructure || c.criterion || "").trim();
    changes.push({
      id: newId("enr-sc"),
      source: "scorecard",
      sourceItemId: c.id,
      title: structure || c.criterion,
      reason:
        c.status === "equivocal"
          ? `Criterio equívoco del scorecard (${c.weight})`
          : `Criterio cumplido del scorecard (${c.weight})`,
      suggestedText: phrase,
      insertTarget: "findings",
      placementHint: structure || c.suggestedPanelFocus || c.criterion,
      status: already ? "skipped" : autoSafe ? "applied" : "pending",
      autoSafe,
    });
  }

  // Optional: weave category into impression if missing
  const category = String(scorecard.categoryAssigned || "").trim();
  if (category && category.length >= 3) {
    const catPhrase = `Categoría / impresión protocolar: ${category}.`;
    const alreadyCat = normalizeForMatch(report).includes(normalizeForMatch(category).slice(0, 40));
    if (!alreadyCat) {
      const autoSafe = autoCount < maxAuto;
      if (autoSafe) autoCount += 1;
      changes.push({
        id: newId("enr-sc-cat"),
        source: "scorecard",
        sourceItemId: "categoryAssigned",
        title: "Categoría del protocolo",
        reason: `${scorecard.protocolName || "Scorecard"} → impresión`,
        suggestedText: catPhrase,
        insertTarget: "impression",
        placementHint: "Impresión diagnóstica",
        status: autoSafe ? "applied" : "pending",
        autoSafe,
      });
    }
  }

  return changes;
}

/** Pick safe auto-weave items + review-only pending notes from checklist + second reader. */
export function selectEnrichmentChanges(
  checklist: NegativityChecklistData | null | undefined,
  reader: SecondReaderData | null | undefined,
  maxAuto: number = MAX_AUTO_ENRICHMENT_CHANGES
): ReportEnrichmentChange[] {
  const changes: ReportEnrichmentChange[] = [];

  const pendingItems = (checklist?.items || [])
    .filter(
      (it) =>
        it.status === "pending_closure" &&
        !it.inserted &&
        String(it.suggestedInsert || "").trim()
    )
    .slice()
    .sort((a, b) => {
      const ca = CONFIDENCE_RANK[String(a.confidence || "media")] ?? 1;
      const cb = CONFIDENCE_RANK[String(b.confidence || "media")] ?? 1;
      return ca - cb;
    });

  for (const it of pendingItems) {
    const autoSafe = changes.filter((c) => c.autoSafe).length < maxAuto;
    changes.push({
      id: newId("enr-neg"),
      source: "negativity_checklist",
      sourceItemId: it.id,
      title: [it.sign, it.laterality].filter(Boolean).join(" — ") || "Negatividad dirigida",
      reason: String(it.whyItMatters || "Cierre de negatividad del protocolo").trim(),
      suggestedText: String(it.suggestedInsert || "").trim(),
      insertTarget: it.insertTarget === "impression" ? "impression" : "findings",
      placementHint: it.placementHint,
      status: autoSafe ? "applied" : "pending",
      autoSafe,
    });
  }

  const additions = (reader?.additions || []).filter(
    (a) => !a.incorporated && String(a.suggestedText || "").trim()
  );
  for (const a of additions) {
    const autoSafe = changes.filter((c) => c.autoSafe).length < maxAuto;
    changes.push({
      id: newId("enr-sr"),
      source: "second_reader",
      sourceItemId: a.id,
      title: String(a.title || "Sugerencia del segundo lector").trim(),
      reason: String(a.reason || "Contenido ausente detectado por segundo lector").trim(),
      suggestedText: String(a.suggestedText || "").trim(),
      insertTarget: a.insertTarget === "impression" ? "impression" : "findings",
      placementHint: a.placementHint,
      status: autoSafe ? "applied" : "pending",
      autoSafe,
    });
  }

  // High-severity objections: review only (no automatic prose rewrite).
  for (const obj of reader?.objections || []) {
    if (obj.severity !== "alta") continue;
    changes.push({
      id: newId("enr-obj"),
      source: "second_reader",
      sourceItemId: obj.id,
      title: String(obj.claim || "Objeción de alta severidad").trim(),
      reason: String(obj.objection || obj.evidenceGap || "Requiere revisión del radiólogo").trim(),
      suggestedText: "",
      insertTarget: "findings",
      status: "pending",
      autoSafe: false,
      reviewOnly: true,
    });
  }

  return changes;
}

/** Convert classification recommendations into enrichment changes (auto up to maxAuto). */
export function selectClassificationChanges(
  recommendations: ClassificationRecommendation[] | null | undefined,
  maxAuto: number = MAX_AUTO_CLASSIFICATIONS
): ReportEnrichmentChange[] {
  const changes: ReportEnrichmentChange[] = [];
  const list = Array.isArray(recommendations) ? recommendations : [];
  let autoCount = 0;

  list.forEach((rec, idx) => {
    const name = String(rec?.name || "").trim();
    if (!name) return;
    const already = !!rec.alreadyIncorporated;
    const content = String(rec.contentToAppend || "").trim();
    const why = String(rec.whyRecommended || "").trim();
    const autoSafe = !already && !!content && autoCount < maxAuto;
    if (autoSafe) autoCount += 1;

    changes.push({
      id: newId("enr-cls"),
      source: "classification",
      sourceItemId: `cls-${idx + 1}`,
      title: name,
      reason: why || (already ? "Ya figura en el informe." : "Escala aplicable al caso."),
      suggestedText: already
        ? "Ya incorporada en el informe."
        : previewText(content || why || name),
      insertTarget: "impression",
      placementHint: "Impresión diagnóstica / clasificación aplicada",
      status: already ? "skipped" : autoSafe ? "applied" : "pending",
      autoSafe,
      reviewOnly: false,
      classificationMeta: {
        name,
        whyRecommended: why,
        contentToAppend: content,
        alreadyIncorporated: already,
      },
    });
  });

  return changes;
}

export function buildEnrichmentMergeInstruction(changes: ReportEnrichmentChange[]): string {
  const blocks = changes
    .filter(
      (c) =>
        c.autoSafe &&
        c.suggestedText.trim() &&
        c.source !== "classification"
    )
    .map((c, idx) => {
      const origen =
        c.source === "negativity_checklist"
          ? "Checklist de negatividad"
          : c.source === "scorecard"
            ? "Scorecard clínico"
            : "Segundo lector";
      const sectionHint =
        c.insertTarget === "impression"
          ? "Destino preferente: IMPRESIÓN/CONCLUSIÓN (línea diagnóstica natural)."
          : "Destino preferente: CUERPO NARRATIVO (párrafo anatómico/semiológico correcto).";
      return `CAMBIO ${idx + 1} [${origen}] — ${c.title}
Motivo: ${c.reason}
Anclaje: ${c.placementHint || c.title}
${sectionHint}
TEXTO A INTEGRAR:
"${c.suggestedText}"`;
    });

  return `Eres el radiólogo que redactó este informe. Debes REESCRIBIR el informe incorporando de forma nativa TODOS los contenidos clínicos listados abajo, cada uno en su párrafo/sección anatómica adecuada.

${blocks.join("\n\n")}

REGLAS OBLIGATORIAS:
1) Integra CADA cambio DENTRO del flujo narrativo (junto a la anatomía relacionada), no al final genérico de "HALLAZGOS:".
2) Si hace falta, reordena o fusiona 1-2 oraciones vecinas para que el texto fluya como si siempre hubiera estado ahí.
3) PROHIBIDO: encabezados nuevos, bloques "NEGATIVIDADES DIRIGIDAS", viñetas de "agregado", "checklist", "segundo lector", "scorecard", "pulido", "auditoría" o cualquier meta-comentario.
4) PROHIBIDO: duplicar si el concepto ya está dicho; en ese caso solo refuerza o aclara en el mismo sitio.
5) Conserva el resto del informe intacto en sentido clínico (mismas conclusiones salvo los ajustes locales).
6) Devuelve el informe completo ya reescrito.`;
}

export function markSourcesAfterAutoEnrichment(
  checklist: NegativityChecklistData | null,
  reader: SecondReaderData | null,
  changes: ReportEnrichmentChange[]
): { checklist: NegativityChecklistData | null; reader: SecondReaderData | null } {
  const applied = changes.filter((c) => c.status === "applied" && c.autoSafe);

  let nextChecklist = checklist;
  if (nextChecklist) {
    const byId = new Set(
      applied.filter((c) => c.source === "negativity_checklist").map((c) => c.sourceItemId)
    );
    if (byId.size) {
      const items = nextChecklist.items.map((it) => {
        if (!byId.has(it.id)) return it;
        const change = applied.find(
          (c) => c.source === "negativity_checklist" && c.sourceItemId === it.id
        );
        const snippet = change?.suggestedText || it.suggestedInsert || "";
        return {
          ...it,
          status: "negative" as const,
          evidence: snippet || it.evidence,
          suggestedInsert: snippet || it.suggestedInsert,
          inserted: true,
          insertedAt: new Date().toISOString(),
        };
      });
      nextChecklist = refreshNegativityChecklistClosure({ ...nextChecklist, items });
    }
  }

  let nextReader = reader;
  if (nextReader) {
    const byId = new Set(
      applied.filter((c) => c.source === "second_reader" && !c.reviewOnly).map((c) => c.sourceItemId)
    );
    if (byId.size) {
      nextReader = {
        ...nextReader,
        additions: nextReader.additions.map((a) =>
          byId.has(a.id) ? { ...a, incorporated: true } : a
        ),
      };
    }
  }

  return { checklist: nextChecklist, reader: nextReader };
}

export function enrichmentSourceLabel(source: ReportEnrichmentChange["source"]): string {
  switch (source) {
    case "negativity_checklist":
      return "Checklist";
    case "classification":
      return "Clasificación";
    case "scorecard":
      return "Scorecard";
    default:
      return "Segundo lector";
  }
}

export function createRunningEnrichmentSession(beforeReport: string): ReportEnrichmentSession {
  return {
    id: newId("polish"),
    status: "running",
    beforeReport,
    afterReport: beforeReport,
    changes: [],
    startedAt: new Date().toISOString(),
  };
}

export interface EnrichmentPipelineResult {
  session: ReportEnrichmentSession;
  checklist: NegativityChecklistData | null;
  reader: SecondReaderData | null;
  report: string;
  classifications?: ClassificationRecommendation[];
  scorecard?: ClinicalScorecardData | null;
}

async function incorporateOneClassification(opts: {
  report: string;
  model: string;
  studyType?: string;
  includeManagement?: boolean;
  change: ReportEnrichmentChange;
}): Promise<string | null> {
  const meta = opts.change.classificationMeta;
  if (!meta?.name) return null;
  const resp = await fetch("/api/incorporate-classification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      report: opts.report,
      classificationName: meta.name,
      whyRecommended: meta.whyRecommended,
      contentToAppend: meta.contentToAppend,
      studyType: opts.studyType || "",
      includeManagementRecommendation: !!opts.includeManagement,
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!json?.success || !json.modifiedReport) return null;
  return String(json.modifiedReport).trim() || null;
}

/**
 * Generate checklist + second reader + classification recommendations + scorecard in parallel.
 * Weave safe gaps (incl. scorecard prose), then incorporate up to MAX_AUTO_CLASSIFICATIONS scales.
 */
export async function runReportEnrichmentPipeline(opts: {
  report: string;
  studyType?: string;
  clinicalHistory?: string;
  checklistModel: string;
  readerModel: string;
  modifyModel: string;
  classificationsModel?: string;
  scorecardModel?: string;
  includeManagementRecommendations?: boolean;
  /** Optional precomputed scorecard (avoids a second generation if batch already has one). */
  existingScorecard?: ClinicalScorecardData | null;
}): Promise<EnrichmentPipelineResult> {
  const beforeReport = String(opts.report || "").trim();
  const baseSession = createRunningEnrichmentSession(beforeReport);

  if (!beforeReport) {
    return {
      session: {
        ...baseSession,
        status: "error",
        error: "No hay informe para pulir.",
        finishedAt: new Date().toISOString(),
      },
      checklist: null,
      reader: null,
      report: beforeReport,
      classifications: [],
      scorecard: null,
    };
  }

  let checklist: NegativityChecklistData | null = null;
  let reader: SecondReaderData | null = null;
  let classifications: ClassificationRecommendation[] = [];
  let scorecard: ClinicalScorecardData | null = opts.existingScorecard || null;

  try {
    const classModel = opts.classificationsModel || opts.modifyModel;
    const scoreModel = opts.scorecardModel || opts.modifyModel;

    const fetchTasks: Promise<Response>[] = [
      fetch("/api/generate-negativity-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.checklistModel,
          report: beforeReport,
          studyType: opts.studyType || "",
          clinicalHistory: opts.clinicalHistory || "",
        }),
      }),
      fetch("/api/generate-second-reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.readerModel,
          report: beforeReport,
          studyType: opts.studyType || "",
          clinicalHistory: opts.clinicalHistory || "",
        }),
      }),
      fetch("/api/recommend-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: classModel,
          report: beforeReport,
        }),
      }),
    ];

    if (!scorecard) {
      fetchTasks.push(
        fetch("/api/generate-clinical-scorecard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: scoreModel,
            report: beforeReport,
            studyType: opts.studyType || "",
            protocolId: "auto",
            includeRecommendations: false,
          }),
        })
      );
    }

    const responses = await Promise.all(fetchTasks);
    const negResp = responses[0];
    const srResp = responses[1];
    const classResp = responses[2];
    const scResp = scorecard ? null : responses[3];

    const negJson = await negResp.json().catch(() => ({}));
    const srJson = await srResp.json().catch(() => ({}));
    const classJson = await classResp.json().catch(() => ({}));
    const scJson = scResp ? await scResp.json().catch(() => ({})) : null;

    if (negJson?.success && negJson.data) {
      checklist = normalizeNegativityChecklistData(negJson.data);
    }
    if (srJson?.success && srJson.data) {
      reader = normalizeSecondReaderData(srJson.data);
    }
    if (classJson?.success && Array.isArray(classJson.recommendations)) {
      classifications = classJson.recommendations.map((r: any) => ({
        name: String(r?.name || "").trim(),
        whyRecommended: String(r?.whyRecommended || "").trim(),
        contentToAppend: String(r?.contentToAppend || "").trim(),
        alreadyIncorporated: !!r?.alreadyIncorporated,
      }));
    }
    if (!scorecard && scJson?.success && scJson.data) {
      scorecard = scJson.data as ClinicalScorecardData;
    }

    if (!checklist && !reader && !classifications.length && !scorecard) {
      const detail =
        negJson?.error ||
        srJson?.error ||
        classJson?.error ||
        scJson?.error ||
        "No se pudo generar checklist, segundo lector, clasificaciones ni scorecard.";
      return {
        session: {
          ...baseSession,
          status: "error",
          error: detail,
          finishedAt: new Date().toISOString(),
        },
        checklist: null,
        reader: null,
        report: beforeReport,
        classifications: [],
        scorecard: null,
      };
    }

    const proseChanges = [
      ...selectEnrichmentChanges(checklist, reader),
      ...selectScorecardProseChanges(scorecard, beforeReport),
    ];
    const classChanges = selectClassificationChanges(classifications);
    let changes = [...proseChanges, ...classChanges];
    let workingReport = beforeReport;

    // Pass A: weave checklist + second-reader + scorecard prose
    const proseToApply = proseChanges.filter((c) => c.autoSafe && c.suggestedText.trim());
    if (proseToApply.length) {
      const instruction = buildEnrichmentMergeInstruction(proseToApply);
      const modResp = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.modifyModel,
          currentReport: workingReport,
          instruction,
        }),
      });
      const modJson = await modResp.json().catch(() => ({}));
      if (modJson?.success && modJson.report) {
        workingReport = String(modJson.report).trim() || workingReport;
      } else {
        changes = changes.map((c) =>
          c.source !== "classification" && c.autoSafe
            ? { ...c, status: "pending" as const, autoSafe: false }
            : c
        );
      }
    }

    // Pass B: incorporate auto-safe classifications into impression/follow-up
    for (const change of changes) {
      if (change.source !== "classification" || !change.autoSafe || change.status !== "applied") {
        continue;
      }
      const next = await incorporateOneClassification({
        report: workingReport,
        model: classModel,
        studyType: opts.studyType,
        includeManagement: opts.includeManagementRecommendations !== false,
        change,
      });
      if (next) {
        workingReport = next;
        if (change.classificationMeta) {
          change.classificationMeta.alreadyIncorporated = true;
        }
      } else {
        change.status = "pending";
        change.autoSafe = false;
      }
    }

    classifications = classifications.map((rec) => {
      const hit = changes.find(
        (c) =>
          c.source === "classification" &&
          c.classificationMeta?.name === rec.name &&
          c.status === "applied"
      );
      return hit ? { ...rec, alreadyIncorporated: true } : rec;
    });

    const marked = markSourcesAfterAutoEnrichment(checklist, reader, changes);

    return {
      session: {
        ...baseSession,
        status: "done",
        changes,
        afterReport: workingReport,
        finishedAt: new Date().toISOString(),
      },
      checklist: marked.checklist,
      reader: marked.reader,
      report: workingReport,
      classifications,
      scorecard,
    };
  } catch (e: any) {
    return {
      session: {
        ...baseSession,
        status: "error",
        error: e?.message || String(e),
        finishedAt: new Date().toISOString(),
      },
      checklist,
      reader,
      report: beforeReport,
      classifications,
      scorecard,
    };
  }
}

/** Apply pending prose and/or classification changes onto the current report. */
export async function applyPendingEnrichmentChanges(opts: {
  report: string;
  modifyModel: string;
  classificationsModel?: string;
  studyType?: string;
  includeManagementRecommendations?: boolean;
  session: ReportEnrichmentSession;
  changeIds: string[];
  checklist: NegativityChecklistData | null;
  reader: SecondReaderData | null;
}): Promise<EnrichmentPipelineResult> {
  const selected = opts.session.changes.filter(
    (c) =>
      opts.changeIds.includes(c.id) &&
      c.status === "pending" &&
      !c.reviewOnly &&
      (c.source === "classification"
        ? !!c.classificationMeta?.name
        : !!c.suggestedText.trim())
  );

  if (!selected.length) {
    return {
      session: opts.session,
      checklist: opts.checklist,
      reader: opts.reader,
      report: opts.report,
    };
  }

  let workingReport = opts.report;
  let nextChanges = [...opts.session.changes];
  const classModel = opts.classificationsModel || opts.modifyModel;

  const proseSelected = selected.filter((c) => c.source !== "classification");
  if (proseSelected.length) {
    const toApply = proseSelected.map((c) => ({
      ...c,
      autoSafe: true,
      status: "applied" as const,
    }));
    const instruction = buildEnrichmentMergeInstruction(toApply);
    const modResp = await fetch("/api/modify-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.modifyModel,
        currentReport: workingReport,
        instruction,
      }),
    });
    const modJson = await modResp.json().catch(() => ({}));
    if (!modJson?.success || !modJson.report) {
      throw new Error(modJson?.error || "No se pudieron aplicar los cambios de prosa pendientes.");
    }
    workingReport = String(modJson.report).trim() || workingReport;
    nextChanges = nextChanges.map((c) => {
      const hit = toApply.find((t) => t.id === c.id);
      return hit ? { ...c, autoSafe: true, status: "applied" as const } : c;
    });
  }

  const classSelected = selected.filter((c) => c.source === "classification");
  for (const change of classSelected) {
    const next = await incorporateOneClassification({
      report: workingReport,
      model: classModel,
      studyType: opts.studyType,
      includeManagement: opts.includeManagementRecommendations !== false,
      change,
    });
    if (!next) {
      throw new Error(
        `No se pudo incorporar la clasificación «${change.classificationMeta?.name || change.title}».`
      );
    }
    workingReport = next;
    nextChanges = nextChanges.map((c) =>
      c.id === change.id
        ? {
            ...c,
            autoSafe: true,
            status: "applied" as const,
            classificationMeta: c.classificationMeta
              ? { ...c.classificationMeta, alreadyIncorporated: true }
              : c.classificationMeta,
          }
        : c
    );
  }

  const marked = markSourcesAfterAutoEnrichment(opts.checklist, opts.reader, nextChanges);

  return {
    session: {
      ...opts.session,
      changes: nextChanges,
      afterReport: workingReport,
      status: "done",
    },
    checklist: marked.checklist,
    reader: marked.reader,
    report: workingReport,
  };
}
