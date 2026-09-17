import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SecondReaderAddition, SecondReaderData } from "../types";
import {
  normalizeSecondReaderData,
  secondReaderSeverityLabel,
  secondReaderTargetLabel,
} from "../lib/secondReader";

interface SecondReaderModuleProps {
  selectedModel: string;
  modifyModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  readerData: SecondReaderData | null;
  setReaderData: (data: SecondReaderData | null) => void;
  onReportUpdated: (nextReportText: string) => void;
}

const severityStyles = (severity: string) => {
  switch (severity) {
    case "alta":
      return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    case "baja":
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
    default:
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  }
};

export const SecondReaderModule: React.FC<SecondReaderModuleProps> = ({
  selectedModel,
  modifyModel,
  reportText,
  studyType,
  clinicalHistory,
  readerData,
  setReaderData,
  onReportUpdated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incorporatingId, setIncorporatingId] = useState<string | null>(null);
  const [draftAdds, setDraftAdds] = useState<Record<string, string>>({});

  const pendingAdds = useMemo(
    () => (readerData?.additions || []).filter((a) => !a.incorporated).length,
    [readerData]
  );

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setError("No hay informe disponible para el segundo lector.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/generate-second-reader", {
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
            ? "El endpoint del segundo lector no está disponible en este despliegue. Redeploya la última versión."
            : `Respuesta no JSON del servidor (HTTP ${resp.status}).`
        );
      }
      const json = await resp.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la revisión del segundo lector.");
      }
      setReaderData(normalizeSecondReaderData(json.data));
      setDraftAdds({});
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al generar el segundo lector.");
    } finally {
      setIsLoading(false);
    }
  };

  const markIncorporated = (id: string) => {
    if (!readerData) return;
    setReaderData({
      ...readerData,
      additions: readerData.additions.map((a) =>
        a.id === id ? { ...a, incorporated: true } : a
      ),
    });
  };

  const handleAddToReport = async (item: SecondReaderAddition) => {
    const snippet = (draftAdds[item.id] ?? item.suggestedText ?? "").trim();
    if (!snippet) {
      setError("Escribe o confirma el texto a integrar en el informe.");
      return;
    }
    if (!reportText?.trim()) {
      setError("No hay informe activo para integrar la sugerencia.");
      return;
    }
    setIncorporatingId(item.id);
    setError(null);
    const targetLabel =
      item.insertTarget === "impression"
        ? "IMPRESIÓN DIAGNÓSTICA / CONCLUSIÓN"
        : "HALLAZGOS / DESCRIPCIÓN";
    try {
      const response = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modifyModel,
          currentReport: reportText,
          instruction: `Integra de forma totalmente fluida, nativa y natural, actuando en todo momento como el radiólogo principal que redacta el informe desde el principio, el siguiente contenido clínico en la sección adecuada (${targetLabel}): "${snippet}". REQUISITO CRÍTICO: NO justifiques la incorporación, ni metas introducciones, ni meta-comentarios del tipo "se agrega", "según revisión", "segundo lector" o "auditoría". Escribe solo la prosa clínica en el lugar anatómico/semiológico correcto del cuerpo del informe. Conserva intacto todo el resto del reporte.`,
        }),
      });
      const data = await response.json();
      if (!data.success || !data.report) {
        throw new Error(data.error || "No se pudo integrar la sugerencia en el informe.");
      }
      onReportUpdated(data.report);
      markIncorporated(item.id);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al integrar la sugerencia.");
    } finally {
      setIncorporatingId(null);
    }
  };

  return (
    <div
      id="second-reader-module"
      className="rounded-2xl border border-indigo-800/50 bg-slate-950/80 overflow-hidden shadow-xl"
    >
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-slate-950 to-slate-900 border-b border-indigo-800/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-700/40 border border-indigo-500/30 flex items-center justify-center">
            <Scale className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-indigo-100">
              Segundo lector simulado
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Peer review del informe: objeciones, qué sostener y qué agregar al cuerpo con un clic.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !reportText?.trim()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wide flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {readerData ? "Re-generar revisión" : "Ejecutar segundo lector"}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!readerData && !isLoading && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            El segundo lector impugna o respalda tu informe y propone prosa lista para integrar en la
            descripción o la impresión.
          </div>
        )}

        {readerData && (
          <>
            <div className="rounded-xl border border-indigo-700/40 bg-indigo-950/30 px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Postura del revisor
              </p>
              <p className="text-[13px] text-slate-200 leading-relaxed">
                {readerData.overallStance || readerData.reviewSummary || "Revisión generada."}
              </p>
              {readerData.reviewSummary && readerData.overallStance && (
                <p className="text-[12px] text-slate-400 leading-relaxed">{readerData.reviewSummary}</p>
              )}
              <p className="text-[10px] font-mono text-slate-500 uppercase pt-1">
                Pendientes de agregar: {pendingAdds}
              </p>
            </div>

            {/* Additions — primary CTA */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <FilePlus2 className="h-3.5 w-3.5" />
                Qué agregar al informe
              </h4>
              {(readerData.additions || []).length === 0 && (
                <p className="text-xs text-slate-500">Sin agregados sugeridos en esta revisión.</p>
              )}
              {readerData.additions.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 space-y-2 ${
                    item.incorporated
                      ? "border-emerald-800/40 bg-emerald-950/20"
                      : "border-slate-800 bg-slate-900/70"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Destino: {secondReaderTargetLabel(item.insertTarget)}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                    </div>
                    {item.incorporated ? (
                      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border bg-emerald-500/15 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Integrado
                      </span>
                    ) : null}
                  </div>

                  {!item.incorporated && (
                    <>
                      <textarea
                        rows={2}
                        className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 outline-none focus:border-indigo-500"
                        value={draftAdds[item.id] ?? item.suggestedText}
                        onChange={(e) =>
                          setDraftAdds((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => handleAddToReport(item)}
                        disabled={incorporatingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5"
                      >
                        {incorporatingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FilePlus2 className="h-3.5 w-3.5" />
                        )}
                        Agregar al informe
                      </button>
                    </>
                  )}

                  {item.incorporated && (
                    <p className="text-[12px] text-slate-300 bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800">
                      {item.suggestedText}
                    </p>
                  )}
                </div>
              ))}
            </section>

            {/* Objections */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Objeciones
              </h4>
              {(readerData.objections || []).length === 0 && (
                <p className="text-xs text-slate-500">Sin objeciones relevantes.</p>
              )}
              {readerData.objections.map((obj) => (
                <div
                  key={obj.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">{obj.claim}</p>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border ${severityStyles(
                        obj.severity
                      )}`}
                    >
                      {secondReaderSeverityLabel(obj.severity)}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{obj.objection}</p>
                  {obj.evidenceGap && (
                    <p className="text-[11px] text-amber-200/80">Brecha: {obj.evidenceGap}</p>
                  )}
                </div>
              ))}
            </section>

            {/* Sustain */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Qué sostener
              </h4>
              {(readerData.sustain || []).length === 0 && (
                <p className="text-xs text-slate-500">Sin puntos a sostener listados.</p>
              )}
              {readerData.sustain.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-3 space-y-1"
                >
                  <p className="text-sm font-semibold text-slate-100">{s.statement}</p>
                  {s.why && <p className="text-[12px] text-slate-400 leading-relaxed">{s.why}</p>}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default SecondReaderModule;
