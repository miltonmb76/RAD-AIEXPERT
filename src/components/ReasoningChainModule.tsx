import React, { useState } from "react";
import {
  GitBranch,
  Loader2,
  RefreshCw,
  Stethoscope,
  Search,
  Crosshair,
  Layers,
  Ban,
  FlaskConical,
  CheckCircle2,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { ReasoningChainData, ReasoningNodeKind, ReasoningNodeStatus } from "../types";
import { reasoningKindLabel, reasoningStatusLabel } from "../lib/reasoningChain";

interface ReasoningChainModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  chainData: ReasoningChainData | null;
  setChainData: (data: ReasoningChainData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
}

const kindIcon = (kind: ReasoningNodeKind) => {
  switch (kind) {
    case "clinical_context":
      return <Stethoscope className="h-4 w-4" />;
    case "sought_signs":
      return <Search className="h-4 w-4" />;
    case "key_finding":
      return <Crosshair className="h-4 w-4" />;
    case "associated_signs":
      return <Layers className="h-4 w-4" />;
    case "absent_signs":
      return <Ban className="h-4 w-4" />;
    case "lab_correlation":
      return <FlaskConical className="h-4 w-4" />;
    case "synthesis":
      return <CheckCircle2 className="h-4 w-4" />;
    case "management":
      return <ClipboardList className="h-4 w-4" />;
    default:
      return <GitBranch className="h-4 w-4" />;
  }
};

const kindAccent = (kind: ReasoningNodeKind) => {
  switch (kind) {
    case "clinical_context":
      return {
        ring: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
        bar: "bg-emerald-500",
        badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      };
    case "sought_signs":
      return {
        ring: "border-sky-500/50 bg-sky-500/15 text-sky-300",
        bar: "bg-sky-500",
        badge: "bg-sky-500/15 text-sky-300 border-sky-500/40",
      };
    case "key_finding":
      return {
        ring: "border-violet-500/50 bg-violet-500/15 text-violet-300",
        bar: "bg-violet-500",
        badge: "bg-violet-500/15 text-violet-300 border-violet-500/40",
      };
    case "associated_signs":
      return {
        ring: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300",
        bar: "bg-cyan-500",
        badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
      };
    case "absent_signs":
      return {
        ring: "border-rose-500/50 bg-rose-500/15 text-rose-300",
        bar: "bg-rose-500",
        badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",
      };
    case "lab_correlation":
      return {
        ring: "border-amber-500/50 bg-amber-500/15 text-amber-300",
        bar: "bg-amber-500",
        badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      };
    case "synthesis":
      return {
        ring: "border-teal-500/50 bg-teal-500/15 text-teal-300",
        bar: "bg-teal-500",
        badge: "bg-teal-500/15 text-teal-300 border-teal-500/40",
      };
    case "management":
      return {
        ring: "border-indigo-500/50 bg-indigo-500/15 text-indigo-300",
        bar: "bg-indigo-500",
        badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
      };
    default:
      return {
        ring: "border-slate-500/50 bg-slate-500/15 text-slate-300",
        bar: "bg-slate-500",
        badge: "bg-slate-500/15 text-slate-300 border-slate-500/40",
      };
  }
};

const statusChip = (status: ReasoningNodeStatus) => {
  switch (status) {
    case "present":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "absent":
    case "discarded":
      return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    case "equivocal":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "not_evaluated":
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
    default:
      return "bg-sky-500/15 text-sky-300 border-sky-500/40";
  }
};

export const ReasoningChainModule: React.FC<ReasoningChainModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  chainData,
  setChainData,
  includeInReport,
  setIncludeInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusText, setFocusText] = useState("");
  const [includeManagement, setIncludeManagement] = useState(false);

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-reasoning-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          focusText: focusText.trim() || undefined,
          includeManagement,
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la cadena de razonamiento.");
      }
      setChainData(json.data as ReasoningChainData);
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando cadena de razonamiento:", err);
      setError(err?.message || "Error al generar la cadena de razonamiento.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="reasoning-chain-module"
      className="bg-slate-900/95 border-2 border-violet-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/40 rounded-2xl text-violet-300 shadow-md">
            <GitBranch className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Cadena de razonamiento radiológico
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-violet-950/50 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded">
                Semiología
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">
              Flujograma del pensamiento diagnóstico: clínica → signos buscados → hallazgo clave → asociados → ausentes → correlación → síntesis.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500"
            />
            Incluir en PDF
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeManagement}
              onChange={(e) => {
                const next = e.target.checked;
                setIncludeManagement(next);
                if (!next && chainData) {
                  setChainData({
                    ...chainData,
                    nodes: chainData.nodes.filter((n) => n.kind !== "management"),
                    managementSuggestion: undefined,
                  });
                }
              }}
              className="rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500"
            />
            Incluir propuesta terapéutica / conducta
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          placeholder="Enfoque opcional (ej. colecistitis, nódulo tiroideo derecho)…"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {chainData ? "Regenerar cadena" : "Generar cadena"}
        </button>
        {chainData && (
          <button
            type="button"
            onClick={() => setChainData(null)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {isLoading && !chainData && (
        <div className="flex items-center gap-3 text-violet-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Reconstruyendo el razonamiento semiológico del caso…
        </div>
      )}

      {chainData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-300/80 font-mono">
              {chainData.title}
              {chainData.studyRegion ? ` · ${chainData.studyRegion}` : ""}
            </p>
            <p className="text-sm font-bold text-slate-100 mt-1">{chainData.workingDiagnosis || "Diagnóstico en elaboración"}</p>
            {chainData.certaintyLabel && (
              <p className="text-[11px] text-violet-200/80 mt-1">Certeza: {chainData.certaintyLabel}</p>
            )}
            {chainData.clinicalContext && (
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{chainData.clinicalContext}</p>
            )}
          </div>

          <div className="relative pl-1">
            <div className="absolute left-[22px] top-3 bottom-3 w-px border-l border-dashed border-slate-700 z-0" />
            <div className="space-y-3 relative z-10">
              {chainData.nodes
                .filter((node) => includeManagement || node.kind !== "management")
                .map((node, idx) => {
                const accent = kindAccent(node.kind);
                return (
                  <div key={node.id || idx} className="flex gap-3 items-start">
                    <div
                      className={`shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center ${accent.ring}`}
                      title={reasoningKindLabel(node.kind)}
                    >
                      {kindIcon(node.kind)}
                    </div>
                    <div className="flex-1 min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
                      <div className={`h-1 w-full ${accent.bar}`} />
                      <div className="p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${accent.badge}`}>
                            {idx + 1}. {reasoningKindLabel(node.kind)}
                          </span>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${statusChip(node.status)}`}>
                            {reasoningStatusLabel(node.status)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-100">{node.title}</p>
                        {node.summary && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">{node.summary}</p>
                        )}
                        {(node.clinicalLink || node.labLink) && (
                          <div className="flex flex-col gap-1 text-[10px] text-slate-500">
                            {node.clinicalLink && (
                              <span>
                                <strong className="text-emerald-400/90">Clínica:</strong> {node.clinicalLink}
                              </span>
                            )}
                            {node.labLink && (
                              <span>
                                <strong className="text-amber-400/90">Lab:</strong> {node.labLink}
                              </span>
                            )}
                          </div>
                        )}
                        {node.items && node.items.length > 0 && (
                          <ul className="space-y-1.5 pt-1">
                            {node.items.map((item, i) => (
                              <li
                                key={`${node.id}-item-${i}`}
                                className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-semibold text-slate-200">{item.label}</span>
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${statusChip(item.status)}`}>
                                    {reasoningStatusLabel(item.status)}
                                  </span>
                                </div>
                                {item.significance && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                                    <span className="text-violet-300/90 font-semibold">Importancia: </span>
                                    {item.significance}
                                  </p>
                                )}
                                {item.evidence && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 italic">“{item.evidence}”</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {chainData.discardedDifferentials?.length > 0 && (
            <div className="rounded-2xl border border-rose-800/40 bg-rose-950/20 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-300 font-mono">
                Diferenciales descartados
              </p>
              <ul className="space-y-1.5">
                {chainData.discardedDifferentials.map((d, i) => (
                  <li key={i} className="text-[11px] text-slate-300 leading-snug">
                    <span className="text-rose-400 font-bold">✗ {d.name}</span>
                    {d.reason ? <span className="text-slate-400"> — {d.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(chainData.synthesis || (includeManagement && chainData.managementSuggestion)) && (
            <div className="rounded-2xl border border-teal-800/40 bg-teal-950/20 p-4 space-y-2">
              {chainData.synthesis && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-300 font-mono">Síntesis</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{chainData.synthesis}</p>
                </div>
              )}
              {includeManagement && chainData.managementSuggestion && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 font-mono">Conducta sugerida</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{chainData.managementSuggestion}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
