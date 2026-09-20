import type {
  ClassificationRecommendation,
  NegativityChecklistData,
  ReportEnrichmentChange,
  ReportEnrichmentSession,
  SecondReaderData,
} from "../types";
import {
  normalizeNegativityChecklistData,
  refreshNegativityChecklistClosure,
} from "./negativityChecklist";
import { normalizeSecondReaderData } from "./secondReader";

export const MAX_AUTO_ENRICHMENT_CHANGES = 6;
export const MAX_AUTO_CLASSIFICATIONS = 2;

const CONFIDENCE_RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function previewText(raw: string, max = 220): string {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
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
        c.source === "negativity_checklist" ? "Checklist de negatividad" : "Segundo lector";
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
3) PROHIBIDO: encabezados nuevos, bloques "NEGATIVIDADES DIRIGIDAS", viñetas de "agregado", "checklist", "segundo lector", "pulido", "auditoría" o cualquier meta-comentario.
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
 * Generate checklist + second reader + classification recommendations in parallel.
 * Weave safe gaps, then incorporate up to MAX_AUTO_CLASSIFICATIONS scales into impression.
 */
export async function runReportEnrichmentPipeline(opts: {
  report: string;
  studyType?: string;
  clinicalHistory?: string;
  checklistModel: string;
  readerModel: string;
  modifyModel: string;
  classificationsModel?: string;
  includeManagementRecommendations?: boolean;
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
    };
  }

  let checklist: NegativityChecklistData | null = null;
  let reader: SecondReaderData | null = null;
  let classifications: ClassificationRecommendation[] = [];

  try {
    const classModel = opts.classificationsModel || opts.modifyModel;
    const [negResp, srResp, classResp] = await Promise.all([
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
    ]);

    const negJson = await negResp.json().catch(() => ({}));
    const srJson = await srResp.json().catch(() => ({}));
    const classJson = await classResp.json().catch(() => ({}));

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

    if (!checklist && !reader && !classifications.length) {
      const detail =
        negJson?.error ||
        srJson?.error ||
        classJson?.error ||
        "No se pudo generar checklist, segundo lector ni clasificaciones.";
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
      };
    }

    const proseChanges = selectEnrichmentChanges(checklist, reader);
    const classChanges = selectClassificationChanges(classifications);
    let changes = [...proseChanges, ...classChanges];
    let workingReport = beforeReport;

    // Pass A: weave checklist + second-reader prose
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
        // Downgrade failed auto prose items to pending
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

    // Sync recommendations list with applied state
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
