import React, { useState } from "react";
import {
  GitFork,
  Loader2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  CircleDot,
  Scissors,
} from "lucide-react";
import { DifferentialTreeData, DifferentialBranchStatus } from "../types";
import { differentialStatusLabel } from "../lib/differentialTree";

interface DifferentialTreeModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  treeData: DifferentialTreeData | null;
  setTreeData: (data: DifferentialTreeData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
}

const statusStyles = (status: DifferentialBranchStatus) => {
  switch (status) {
    case "leading":
      return {
        card: "border-emerald-500/50 bg-emerald-950/30 opacity-100",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        icon: "text-emerald-400",
      };
    case "active":
      return {
        card: "border-amber-500/40 bg-amber-950/20 opacity-100",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        icon: "text-amber-400",
      };
    case "pruned":
      return {
        card: "border-slate-700/60 bg-slate-950/40 opacity-70",
        badge: "bg-slate-700/40 text-slate-400 border-slate-600/40",
        icon: "text-slate-500",
      };
  }
};

const StatusIcon: React.FC<{ status: DifferentialBranchStatus }> = ({ status }) => {
  if (status === "leading") return <CheckCircle2 className="h-5 w-5" />;
  if (status === "pruned") return <XCircle className="h-5 w-5" />;
  return <CircleDot className="h-5 w-5" />;
};

export const DifferentialTreeModule: React.FC<DifferentialTreeModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  treeData,
  setTreeData,
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
      const response = await fetch("/api/generate-differential-tree", {
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
        throw new Error(json.error || "No se pudo generar el árbol de diferenciales.");
      }
      setTreeData(json.data as DifferentialTreeData);
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando árbol de diferenciales:", err);
      setError(err?.message || "Error al generar el árbol de diferenciales.");
    } finally {
      setIsLoading(false);
    }
  };

  const leading = treeData?.branches.find((b) => b.status === "leading");
  const active = treeData?.branches.filter((b) => b.status === "active") || [];
  const pruned = treeData?.branches.filter((b) => b.status === "pruned") || [];
  const ordered = [
    ...(leading ? [leading] : []),
    ...active,
    ...pruned,
  ];

  return (
    <div
      id="differential-tree-module"
      className="bg-slate-900/95 border-2 border-orange-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/40 rounded-2xl text-orange-300 shadow-md">
            <GitFork className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Árbol de diferenciales con poda
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-orange-950/50 text-orange-300 border border-orange-700/40 px-2 py-0.5 rounded">
                Diagnóstico
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">
              Hipótesis → criterios a favor/en contra → poda de ramas incompatibles → diagnóstico más probable.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
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
                if (!next && treeData) {
                  setTreeData({ ...treeData, managementSuggestion: undefined });
                }
              }}
              className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
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
          placeholder="Enfoque opcional (ej. nódulo tiroideo, dolor HD)…"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {treeData ? "Regenerar árbol" : "Generar árbol"}
        </button>
        {treeData && (
          <button
            type="button"
            onClick={() => setTreeData(null)}
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

      {isLoading && !treeData && (
        <div className="flex items-center gap-3 text-orange-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Construyendo hipótesis y podando ramas incompatibles…
        </div>
      )}

      {treeData && (
        <div className="space-y-5">
          {/* Root */}
          <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-4 text-center relative">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-300/80 font-mono">
              {treeData.title}
              {treeData.studyRegion ? ` · ${treeData.studyRegion}` : ""}
            </p>
            <p className="text-sm font-bold text-slate-100 mt-1">
              {treeData.clinicalQuestion || "¿Cuál es el diagnóstico más probable?"}
            </p>
            <p className="text-[11px] text-emerald-300 mt-2 font-semibold">
              → {treeData.leadingDiagnosis || leading?.name || "Pendiente"}
              {treeData.certaintyLabel ? ` · Certeza ${treeData.certaintyLabel}` : ""}
            </p>
            <div className="flex justify-center mt-3">
              <div className="w-px h-6 bg-slate-600" />
            </div>
          </div>

          {/* Branches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ordered.map((branch) => {
              const st = statusStyles(branch.status);
              return (
                <div
                  key={branch.id}
                  className={`rounded-2xl border overflow-hidden ${st.card} ${
                    branch.status === "pruned" ? "line-through-none" : ""
                  }`}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={st.icon}>
                          <StatusIcon status={branch.status} />
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${
                              branch.status === "pruned" ? "text-slate-400 line-through" : "text-slate-100"
                            }`}
                          >
                            {branch.name}
                          </p>
                          {branch.certaintyLabel && branch.status !== "pruned" && (
                            <p className="text-[10px] text-slate-500">Certeza: {branch.certaintyLabel}</p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded border ${st.badge}`}>
                        {differentialStatusLabel(branch.status)}
                      </span>
                    </div>

                    {branch.summary && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">{branch.summary}</p>
                    )}

                    {branch.criteriaFor.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400/90">A favor</p>
                        <ul className="space-y-1">
                          {branch.criteriaFor.map((c, i) => (
                            <li key={i} className="text-[10px] text-slate-300 flex gap-1.5">
                              <span className="text-emerald-400 shrink-0">+</span>
                              <span>
                                {c.label}
                                {c.evidence ? <span className="text-slate-500 italic"> — “{c.evidence}”</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {branch.criteriaAgainst.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-rose-400/90">En contra</p>
                        <ul className="space-y-1">
                          {branch.criteriaAgainst.map((c, i) => (
                            <li key={i} className="text-[10px] text-slate-300 flex gap-1.5">
                              <span className="text-rose-400 shrink-0">−</span>
                              <span>
                                {c.label}
                                {c.evidence ? <span className="text-slate-500 italic"> — “{c.evidence}”</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {branch.status === "pruned" && branch.pruneReason && (
                      <div className="flex gap-1.5 items-start rounded-lg bg-slate-900/70 border border-slate-700/60 px-2 py-1.5">
                        <Scissors className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-400 leading-snug">
                          <span className="font-semibold text-slate-300">Motivo de poda: </span>
                          {branch.pruneReason}
                        </p>
                      </div>
                    )}

                    {branch.status !== "pruned" && branch.confirmatoryTest && (
                      <p className="text-[10px] text-sky-300/90">
                        <span className="font-semibold">Confirmar con: </span>
                        {branch.confirmatoryTest}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {treeData.pruningNarrative && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5" />
                Narrativa de poda
              </p>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">{treeData.pruningNarrative}</p>
            </div>
          )}

          {(treeData.synthesis || (includeManagement && treeData.managementSuggestion)) && (
            <div className="rounded-2xl border border-teal-800/40 bg-teal-950/20 p-4 space-y-2">
              {treeData.synthesis && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-300 font-mono">Síntesis</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{treeData.synthesis}</p>
                </div>
              )}
              {includeManagement && treeData.managementSuggestion && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 font-mono">
                    Conducta sugerida
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {treeData.managementSuggestion}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
