import React, { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Wrench,
  FilePlus2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { NegativityChecklistData, NegativityChecklistItem } from "../types";
import {
  insertNegativityIntoReport,
  negativityInsertTargetLabel,
  negativityStatusLabel,
  normalizeNegativityChecklistData,
  refreshNegativityChecklistClosure,
} from "../lib/negativityChecklist";

interface NegativityChecklistModuleProps {
  selectedModel: string;
  modifyModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  checklistData: NegativityChecklistData | null;
  setChecklistData: (data: NegativityChecklistData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  /** Apply rewritten report text after narrative weave. */
  onInsertIntoReport: (nextReportText: string) => void;
}

const statusStyles = (status: NegativityChecklistItem["status"]) => {
  switch (status) {
    case "negative":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "positive":
      return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    case "limited_technical":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "pending_closure":
      return "bg-orange-500/15 text-orange-300 border-orange-500/40";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
  }
};

export const NegativityChecklistModule: React.FC<NegativityChecklistModuleProps> = ({
  selectedModel,
  modifyModel,
  reportText,
  studyType,
  clinicalHistory,
  checklistData,
  setChecklistData,
  includeInReport,
  setIncludeInReport,
  onInsertIntoReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftInserts, setDraftInserts] = useState<Record<string, string>>({});
  const [techDrafts, setTechDrafts] = useState<Record<string, string>>({});
  const [incorporatingId, setIncorporatingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => (checklistData?.items || []).filter((i) => i.status === "pending_closure").length,
    [checklistData]
  );

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setError("No hay informe disponible para generar el checklist.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/generate-negativity-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
        }),
      });
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          resp.status === 404
            ? "El endpoint del checklist no está disponible en este despliegue. Redeploya la última versión del servidor."
            : `Respuesta no JSON del servidor (HTTP ${resp.status}). Revisa el despliegue o reintenta.`
        );
      }
      const json = await resp.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar el checklist.");
      }
      const data = normalizeNegativityChecklistData(json.data);
      setChecklistData(data);
      setIncludeInReport(true);
      setDraftInserts({});
      setTechDrafts({});
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al generar el checklist.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = (id: string, patch: Partial<NegativityChecklistItem>) => {
    if (!checklistData) return;
    const items = checklistData.items.map((it) =>
      it.id === id ? { ...it, ...patch } : it
    );
    setChecklistData(refreshNegativityChecklistClosure({ ...checklistData, items }));
  };

  const removeItem = (id: string) => {
    if (!checklistData) return;
    const items = checklistData.items.filter((it) => it.id !== id);
    setDraftInserts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTechDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!items.length) {
      setChecklistData(null);
      return;
    }
    setChecklistData(refreshNegativityChecklistClosure({ ...checklistData, items }));
  };

  const handleInsert = async (item: NegativityChecklistItem) => {
    const snippet = (draftInserts[item.id] ?? item.suggestedInsert ?? "").trim();
    if (!snippet) {
      setError("Escribe o confirma el texto a integrar en la descripción.");
      return;
    }
    if (!reportText?.trim()) {
      setError("No hay informe activo para integrar la negatividad.");
      return;
    }

    const placement =
      item.placementHint?.trim() ||
      [item.sign, item.laterality].filter(Boolean).join(" — ") ||
      "la anatomía o párrafo semiológico correspondiente";
    const sectionHint =
      item.insertTarget === "impression"
        ? "Si corresponde a la conclusión, intégralo en la IMPRESIÓN de forma natural (una línea diagnóstica, no un apéndice)."
        : "Intégralo en el CUERPO NARRATIVO del informe (descripción por órganos/estructuras), NO como lista al final de HALLAZGOS ni como bloque 'NEGATIVIDADES DIRIGIDAS'.";

    setIncorporatingId(item.id);
    setError(null);
    try {
      const response = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modifyModel,
          currentReport: reportText,
          instruction: `Eres el radiólogo que redactó este informe. Debes REESCRIBIR el informe incorporando de forma nativa la siguiente negatividad dirigida dentro de la redacción, en el párrafo/sección anatómica adecuada.

CONTENIDO A INTEGRAR:
"${snippet}"

ANCLAJE DE UBICACIÓN (prioridad): ${placement}
SIGNO/ESTRUCTURA: ${item.sign}${item.laterality ? ` (${item.laterality})` : ""}
${sectionHint}

REGLAS OBLIGATORIAS:
1) Colócalo DENTRO del flujo narrativo junto a la anatomía relacionada (p. ej. tiroides, vaso, articulación), no al final genérico de "HALLAZGOS:".
2) Si hace falta, reordena o fusiona 1-2 oraciones vecinas para que el texto fluya como si siempre hubiera estado ahí.
3) PROHIBIDO: encabezados nuevos, bloque "NEGATIVIDADES DIRIGIDAS", viñetas de "agregado", "checklist", "inserción", "auditoría" o cualquier meta-comentario.
4) PROHIBIDO: duplicar si el concepto ya está dicho; en ese caso solo refuerza o aclara en el mismo sitio.
5) Conserva el resto del informe intacto en sentido clínico.
6) Devuelve el informe completo ya reescrito.`,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        onInsertIntoReport(data.report);
      } else {
        // Fallback: local contextual splice if modify-report fails
        console.warn("modify-report fallo; usando inserción local contextual:", data.error);
        const next = insertNegativityIntoReport(
          reportText,
          snippet,
          item.insertTarget || "findings",
          item.sign
        );
        onInsertIntoReport(next);
      }
      updateItem(item.id, {
        status: "negative",
        evidence: snippet,
        suggestedInsert: snippet,
        inserted: true,
        insertedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error(e);
      try {
        const next = insertNegativityIntoReport(
          reportText,
          snippet,
          item.insertTarget || "findings",
          item.sign
        );
        onInsertIntoReport(next);
        updateItem(item.id, {
          status: "negative",
          evidence: snippet,
          suggestedInsert: snippet,
          inserted: true,
          insertedAt: new Date().toISOString(),
        });
      } catch (e2: any) {
        setError(e.message || e2?.message || "Error al integrar la negatividad.");
      }
    } finally {
      setIncorporatingId(null);
    }
  };

  const handleMarkLimited = (item: NegativityChecklistItem) => {
    const reason = (techDrafts[item.id] || item.technicalReason || "").trim();
    if (!reason) {
      setError("La limitación técnica requiere un motivo (única excepción a 'sin evaluar').");
      return;
    }
    updateItem(item.id, {
      status: "limited_technical",
      technicalReason: reason,
      inserted: false,
    });
    setError(null);
  };

  return (
    <div
      id="negativity-checklist-module"
      className="rounded-2xl border border-teal-800/50 bg-slate-950/80 overflow-hidden shadow-xl"
    >
      <div className="px-5 py-4 bg-gradient-to-r from-teal-950 via-slate-950 to-slate-900 border-b border-teal-800/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700/40 border border-teal-500/30 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-teal-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-teal-100">
              Checklist de negatividad dirigida
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Nada queda sin evaluar salvo limitación técnica. Los pendientes se tejen en la sección adecuada del cuerpo del informe.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold uppercase text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
              className="accent-teal-500"
            />
            {includeInReport ? "Incluido en PDF" : "Excluido de PDF"}
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !reportText?.trim()}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wide flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {checklistData ? "Re-generar" : "Generar checklist"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!checklistData && !isLoading && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            Genera el checklist a partir del informe. Los signos no mencionados aparecerán como{" "}
            <span className="text-orange-300 font-semibold">pendientes de cierre</span> para integrarlos
            en la descripción del informe.
          </div>
        )}

        {checklistData && (
          <>
            <div
              className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                pendingCount > 0
                  ? "border-orange-600/40 bg-orange-950/30"
                  : "border-emerald-600/40 bg-emerald-950/30"
              }`}
            >
              <div className="flex items-start gap-2">
                {pendingCount > 0 ? (
                  <ShieldAlert className="h-5 w-5 text-orange-300 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-100">
                    {pendingCount > 0
                      ? `Pendientes de cierre: ${pendingCount}`
                      : "Checklist cerrado"}
                  </p>
                  <p className="text-[12px] text-slate-300 mt-1 leading-relaxed">
                    {checklistData.closureSummary}
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                {checklistData.protocolName || studyType || "Protocolo"}
                {checklistData.laterality ? ` · ${checklistData.laterality}` : ""}
              </div>
            </div>

            <div className="space-y-3">
              {checklistData.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100">{item.sign}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.laterality ? `${item.laterality} · ` : ""}
                        {item.whyItMatters || "Signo crítico del protocolo"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border ${statusStyles(
                          item.status
                        )}`}
                      >
                        {negativityStatusLabel(item.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        title="Eliminar ítem del checklist (no aparecerá en el PDF)"
                        className="p-1.5 rounded-lg border border-slate-700 bg-slate-950/80 text-slate-400 hover:text-rose-300 hover:border-rose-600/50 hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.evidence && item.status !== "pending_closure" && (
                    <p className="text-[12px] text-slate-300 bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800">
                      <span className="text-teal-400 font-semibold">Evidencia: </span>
                      {item.evidence}
                    </p>
                  )}

                  {item.status === "limited_technical" && item.technicalReason && (
                    <p className="text-[12px] text-amber-200/90 flex gap-1.5">
                      <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {item.technicalReason}
                    </p>
                  )}

                  {item.status === "pending_closure" && (
                    <div className="space-y-2 rounded-lg border border-orange-700/40 bg-orange-950/20 p-2.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-orange-300">
                        Frase a tejer en el cuerpo del informe (
                        {item.placementHint || negativityInsertTargetLabel(item.insertTarget)})
                      </label>
                      <textarea
                        rows={2}
                        className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 outline-none focus:border-teal-500"
                        value={draftInserts[item.id] ?? item.suggestedInsert ?? ""}
                        onChange={(e) =>
                          setDraftInserts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleInsert(item)}
                          disabled={incorporatingId === item.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5"
                        >
                          {incorporatingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FilePlus2 className="h-3.5 w-3.5" />
                          )}
                          Integrar en el informe
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { status: "positive", evidence: item.evidence || "Hallazgo presente en revisión" })}
                          className="px-3 py-1.5 rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Marcar positivo
                        </button>
                      </div>
                      <div className="pt-1 border-t border-orange-900/40 space-y-1.5">
                        <label className="block text-[10px] font-bold text-amber-300/90">
                          O documentar limitación técnica (única excepción)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Ventana acústica insuficiente / no tolerancia a Valsalva..."
                          className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 outline-none focus:border-amber-500"
                          value={techDrafts[item.id] ?? ""}
                          onChange={(e) =>
                            setTechDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleMarkLimited(item)}
                          className="px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Marcar limitado técnico
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NegativityChecklistModule;
