import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Hexagon,
} from "lucide-react";
import type {
  FindingsInfographicData,
  FindingsInfographicLayout,
  FindingsInfographicNode,
} from "../types";
import {
  INFOGRAPHIC_DIAGNOSIS_PRESETS,
  INFOGRAPHIC_LAYOUT_OPTIONS,
  buildInfographicScene,
  emptyInfographicNode,
  normalizeFindingsInfographicData,
  resolveInfographicDiagnosis,
} from "../lib/findingsInfographic";
import { FindingsInfographicCanvas } from "./FindingsInfographicCanvas";

interface FindingsInfographicModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  infographicData: FindingsInfographicData | null;
  setInfographicData: (data: FindingsInfographicData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
}

export const FindingsInfographicModule: React.FC<FindingsInfographicModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  infographicData,
  setInfographicData,
  includeInReport,
  setIncludeInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState("auto");
  const [customDiagnosis, setCustomDiagnosis] = useState("");
  const [layoutChoice, setLayoutChoice] = useState<FindingsInfographicLayout | "auto">(
    "convergence"
  );

  const diagnosisLabel = resolveInfographicDiagnosis(presetId, customDiagnosis);

  const scene = useMemo(
    () => (infographicData ? buildInfographicScene(infographicData) : null),
    [infographicData]
  );

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-findings-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          diagnosis: diagnosisLabel,
          diagnosisPreset: presetId,
          layout: layoutChoice,
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la infografía.");
      }
      setInfographicData(
        normalizeFindingsInfographicData(json.data, diagnosisLabel, layoutChoice)
      );
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando infografía de hallazgos:", err);
      setError(err?.message || "Error al generar la infografía.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateNode = (id: string, patch: Partial<FindingsInfographicNode>) => {
    if (!infographicData) return;
    setInfographicData({
      ...infographicData,
      nodes: infographicData.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNode = (id: string) => {
    if (!infographicData) return;
    const next = infographicData.nodes.filter((n) => n.id !== id);
    setInfographicData({
      ...infographicData,
      nodes: next.length ? next : [emptyInfographicNode()],
    });
  };

  const addNode = () => {
    if (!infographicData) {
      setInfographicData(
        normalizeFindingsInfographicData(
          {
            title: "Justificación diagnóstica",
            diagnosis: diagnosisLabel,
            layout: layoutChoice === "auto" ? "convergence" : layoutChoice,
            nodes: [],
          },
          diagnosisLabel,
          layoutChoice
        )
      );
      return;
    }
    if (infographicData.nodes.length >= 8) return;
    setInfographicData({
      ...infographicData,
      nodes: [...infographicData.nodes, emptyInfographicNode()],
    });
  };

  const changeLayout = (next: FindingsInfographicLayout) => {
    setLayoutChoice(next);
    if (infographicData) {
      setInfographicData({ ...infographicData, layout: next });
    }
  };

  return (
    <div
      id="findings-infographic-module"
      className="bg-slate-900/95 border-2 border-teal-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/40 rounded-2xl text-teal-300 shadow-md shrink-0">
            <Hexagon className="h-6 w-6 text-teal-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Infografía de justificación diagnóstica
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-teal-950/50 text-teal-300 border border-teal-700/40 px-2 py-0.5 rounded">
                Hallazgos
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Lámina visual de los hallazgos que sostienen el diagnóstico. Sin manejo ni recomendaciones.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Diagnóstico ancla
          </label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
          >
            {INFOGRAPHIC_DIAGNOSIS_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {presetId === "custom" || presetId === "auto"
              ? "Detalle del diagnóstico"
              : "Matiz (opcional)"}
          </label>
          <input
            type="text"
            value={customDiagnosis}
            onChange={(e) => setCustomDiagnosis(e.target.value)}
            placeholder="Ej. colecistitis aguda litiásica…"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Modo visual
          </label>
          <select
            value={layoutChoice}
            onChange={(e) => {
              const v = e.target.value as FindingsInfographicLayout | "auto";
              setLayoutChoice(v);
              if (v !== "auto" && infographicData) {
                setInfographicData({ ...infographicData, layout: v });
              }
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
          >
            {INFOGRAPHIC_LAYOUT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {infographicData ? "Regenerar infografía" : "Generar infografía"}
        </button>
        {infographicData && (
          <>
            <button
              type="button"
              onClick={addNode}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-teal-700/50 text-teal-300 hover:bg-teal-950/40 text-[10px] font-bold uppercase cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Hallazgo
            </button>
            {(["convergence", "constellation", "cascade"] as FindingsInfographicLayout[]).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeLayout(m)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase cursor-pointer border ${
                    infographicData.layout === m
                      ? "bg-teal-700/40 border-teal-500 text-teal-100"
                      : "border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m === "convergence"
                    ? "Convergencia"
                    : m === "constellation"
                      ? "Constelación"
                      : "Cascada"}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setInfographicData(null);
                setIncludeInReport(false);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Quitar del informe
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {isLoading && !infographicData && (
        <div className="flex items-center gap-3 text-teal-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Componiendo la justificación visual…
        </div>
      )}

      {infographicData && scene && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-teal-500/25 overflow-hidden bg-slate-950">
            <FindingsInfographicCanvas scene={scene} />
          </div>

          <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/20 via-slate-950/80 to-slate-950 p-4 space-y-2">
            <div className="flex items-center gap-2 text-teal-300/90">
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Editable</span>
            </div>
            <input
              type="text"
              value={infographicData.diagnosis}
              onChange={(e) =>
                setInfographicData({ ...infographicData, diagnosis: e.target.value })
              }
              placeholder="Diagnóstico"
              className="w-full bg-transparent border-b border-teal-800/40 pb-1 text-sm font-black text-slate-100 outline-none focus:border-teal-400"
            />
            <input
              type="text"
              value={infographicData.studyRegion || ""}
              onChange={(e) =>
                setInfographicData({ ...infographicData, studyRegion: e.target.value })
              }
              placeholder="Región (opcional)"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-teal-500"
            />
          </div>

          <div className="space-y-3">
            {infographicData.nodes.map((node, idx) => (
              <div
                key={node.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-400/90 font-mono">
                    Hallazgo {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNode(node.id)}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-300 font-bold uppercase cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3.5">
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Etiqueta
                    </span>
                    <input
                      type="text"
                      value={node.label}
                      onChange={(e) => updateNode(node.id, { label: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-teal-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Peso visual
                    </span>
                    <select
                      value={node.weight || "secondary"}
                      onChange={(e) =>
                        updateNode(node.id, {
                          weight: e.target.value as "primary" | "secondary",
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="primary">Primario</option>
                      <option value="secondary">Secundario</option>
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Detalle (opcional)
                    </span>
                    <textarea
                      value={node.detail || ""}
                      onChange={(e) => updateNode(node.id, { detail: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-teal-500 resize-y"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {!includeInReport && (
            <p className="text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
              La infografía está generada pero <strong>no se incluirá en el PDF</strong> hasta que
              actives «Incluir en PDF».
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FindingsInfographicModule;
