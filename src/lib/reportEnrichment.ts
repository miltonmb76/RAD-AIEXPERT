import type {
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

const CONFIDENCE_RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

export function buildEnrichmentMergeInstruction(changes: ReportEnrichmentChange[]): string {
  const blocks = changes
    .filter((c) => c.autoSafe && c.suggestedText.trim())
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
  return source === "negativity_checklist" ? "Checklist" : "Segundo lector";
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
}

/**
 * Generate checklist + second reader in parallel, auto-weave safe gaps in one modify-report call.
 */
export async function runReportEnrichmentPipeline(opts: {
  report: string;
  studyType?: string;
  clinicalHistory?: string;
  checklistModel: string;
  readerModel: string;
  modifyModel: string;
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
    };
  }

  let checklist: NegativityChecklistData | null = null;
  let reader: SecondReaderData | null = null;

  try {
    const [negResp, srResp] = await Promise.all([
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
    ]);

    const negJson = await negResp.json().catch(() => ({}));
    const srJson = await srResp.json().catch(() => ({}));

    if (negJson?.success && negJson.data) {
      checklist = normalizeNegativityChecklistData(negJson.data);
    }
    if (srJson?.success && srJson.data) {
      reader = normalizeSecondReaderData(srJson.data);
    }

    if (!checklist && !reader) {
      const detail =
        negJson?.error || srJson?.error || "No se pudo generar checklist ni segundo lector.";
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
      };
    }

    const changes = selectEnrichmentChanges(checklist, reader);
    const toApply = changes.filter((c) => c.autoSafe && c.suggestedText.trim());

    if (!toApply.length) {
      return {
        session: {
          ...baseSession,
          status: "done",
          changes,
          afterReport: beforeReport,
          finishedAt: new Date().toISOString(),
        },
        checklist,
        reader,
        report: beforeReport,
      };
    }

    const instruction = buildEnrichmentMergeInstruction(toApply);
    const modResp = await fetch("/api/modify-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.modifyModel,
        currentReport: beforeReport,
        instruction,
      }),
    });
    const modJson = await modResp.json().catch(() => ({}));

    if (!modJson?.success || !modJson.report) {
      return {
        session: {
          ...baseSession,
          status: "error",
          changes: changes.map((c) =>
            c.autoSafe ? { ...c, status: "pending" as const, autoSafe: false } : c
          ),
          error: modJson?.error || "No se pudo integrar el pulido en el informe.",
          finishedAt: new Date().toISOString(),
        },
        checklist,
        reader,
        report: beforeReport,
      };
    }

    const afterReport = String(modJson.report).trim() || beforeReport;
    const marked = markSourcesAfterAutoEnrichment(checklist, reader, changes);

    return {
      session: {
        ...baseSession,
        status: "done",
        changes,
        afterReport,
        finishedAt: new Date().toISOString(),
      },
      checklist: marked.checklist,
      reader: marked.reader,
      report: afterReport,
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
    };
  }
}

/** Apply a single pending change (or several) onto the current report via modify-report. */
export async function applyPendingEnrichmentChanges(opts: {
  report: string;
  modifyModel: string;
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
      c.suggestedText.trim()
  );

  if (!selected.length) {
    return {
      session: opts.session,
      checklist: opts.checklist,
      reader: opts.reader,
      report: opts.report,
    };
  }

  const toApply = selected.map((c) => ({ ...c, autoSafe: true, status: "applied" as const }));
  const instruction = buildEnrichmentMergeInstruction(toApply);
  const modResp = await fetch("/api/modify-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.modifyModel,
      currentReport: opts.report,
      instruction,
    }),
  });
  const modJson = await modResp.json().catch(() => ({}));
  if (!modJson?.success || !modJson.report) {
    throw new Error(modJson?.error || "No se pudieron aplicar los cambios pendientes.");
  }

  const afterReport = String(modJson.report).trim() || opts.report;
  const nextChanges = opts.session.changes.map((c) => {
    const hit = toApply.find((t) => t.id === c.id);
    return hit ? { ...c, autoSafe: true, status: "applied" as const } : c;
  });
  const marked = markSourcesAfterAutoEnrichment(opts.checklist, opts.reader, nextChanges);

  return {
    session: {
      ...opts.session,
      changes: nextChanges,
      afterReport,
      status: "done",
    },
    checklist: marked.checklist,
    reader: marked.reader,
    report: afterReport,
  };
}
