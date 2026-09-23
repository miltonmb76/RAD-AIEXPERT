import React, { useState } from "react";
import {
  Table2,
  Loader2,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import type { SemioticsConductMatrixData, SemioticsConductRow } from "../types";
import {
  SEMIOTICS_FOCUS_PRESETS,
  emptySemioticsRow,
  normalizeSemioticsConductMatrixData,
  resolveFocusLabel,
} from "../lib/semioticsConductMatrix";

interface SemioticsConductMatrixModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  matrixData: SemioticsConductMatrixData | null;
  setMatrixData: (data: SemioticsConductMatrixData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
}

export const SemioticsConductMatrixModule: React.FC<SemioticsConductMatrixModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  matrixData,
  setMatrixData,
  includeInReport,
  setIncludeInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState("auto");
  const [customFocus, setCustomFocus] = useState("");

  const focusLabel = resolveFocusLabel(presetId, customFocus);

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-semiotics-conduct-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          focusTopic: focusLabel,
          focusPreset: presetId,
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la matriz.");
      }
      setMatrixData(normalizeSemioticsConductMatrixData(json.data, focusLabel));
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando matriz semiología→conducta:", err);
      setError(err?.message || "Error al generar la matriz.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateRow = (id: string, patch: Partial<SemioticsConductRow>) => {
    if (!matrixData) return;
    setMatrixData({
      ...matrixData,
      rows: matrixData.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRow = (id: string) => {
    if (!matrixData) return;
    const next = matrixData.rows.filter((r) => r.id !== id);
    setMatrixData({
      ...matrixData,
      rows: next.length ? next : [emptySemioticsRow()],
    });
  };

  const addRow = () => {
    if (!matrixData) {
      setMatrixData(
        normalizeSemioticsConductMatrixData(
          { title: "Matriz semiología → conducta", focusTopic: focusLabel, rows: [] },
          focusLabel
        )
      );
      return;
    }
    setMatrixData({ ...matrixData, rows: [...matrixData.rows, emptySemioticsRow()] });
  };

  return (
    <div
      id="semiotics-conduct-matrix-module"
      className="bg-slate-900/95 border-2 border-fuchsia-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/40 rounded-2xl text-fuchsia-300 shadow-md shrink-0">
            <Table2 className="h-6 w-6 text-fuchsia-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Matriz semiología → conducta
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-fuchsia-950/50 text-fuchsia-300 border border-fuchsia-700/40 px-2 py-0.5 rounded">
                Decisión
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Hallazgo → signos/criterios → categoría de escala → conducta recomendada. Editable y opcional en el PDF.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-fuchsia-500 focus:ring-fuchsia-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Patología / tema de enfoque
          </label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-fuchsia-500 cursor-pointer"
          >
            {SEMIOTICS_FOCUS_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {presetId === "custom" || presetId === "auto"
              ? "Detalle de enfoque (opcional)"
              : "Matiz adicional (opcional)"}
          </label>
          <input
            type="text"
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            placeholder={
              presetId === "custom"
                ? "Ej. hernia inguinal izquierda…"
                : "Ej. lateralidad, grado, duda concreta…"
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-fuchsia-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {matrixData ? "Regenerar matriz" : "Generar matriz"}
        </button>
        {matrixData && (
          <>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-fuchsia-700/50 text-fuchsia-300 hover:bg-fuchsia-950/40 text-[10px] font-bold uppercase cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Fila
            </button>
            <button
              type="button"
              onClick={() => {
                setMatrixData(null);
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

      {isLoading && !matrixData && (
        <div className="flex items-center gap-3 text-fuchsia-300 text-xs font-mono py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Extrayendo semiología y conductas según el enfoque…
        </div>
      )}

      {matrixData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/30 via-slate-950/80 to-violet-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fuchsia-300/90">
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Editable</span>
            </div>
            <input
              type="text"
              value={matrixData.title}
              onChange={(e) => setMatrixData({ ...matrixData, title: e.target.value })}
              className="w-full bg-transparent border-b border-fuchsia-800/40 pb-1 text-sm font-black text-slate-100 outline-none focus:border-fuchsia-400"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={matrixData.focusTopic}
                onChange={(e) => setMatrixData({ ...matrixData, focusTopic: e.target.value })}
                placeholder="Enfoque"
                className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-fuchsia-500"
              />
              <input
                type="text"
                value={matrixData.priorityConduct || ""}
                onChange={(e) =>
                  setMatrixData({ ...matrixData, priorityConduct: e.target.value })
                }
                placeholder="Conducta prioritaria (1 frase accionable)"
                className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {matrixData.rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400/90 font-mono">
                    Fila {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-300 font-bold uppercase cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3.5">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Hallazgo
                    </span>
                    <textarea
                      value={row.finding}
                      onChange={(e) => updateRow(row.id, { finding: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-fuchsia-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Signos / criterios
                    </span>
                    <textarea
                      value={row.signs}
                      onChange={(e) => updateRow(row.id, { signs: e.target.value })}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-fuchsia-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Categoría / escala
                    </span>
                    <textarea
                      value={row.category}
                      onChange={(e) => updateRow(row.id, { category: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-violet-200 outline-none focus:border-violet-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Conducta
                    </span>
                    <textarea
                      value={row.conduct}
                      onChange={(e) => updateRow(row.id, { conduct: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-emerald-900/40 rounded-xl px-3 py-2 text-[11px] text-emerald-200 outline-none focus:border-emerald-500 resize-y"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Ancla (panel / sección)
                    </span>
                    <input
                      type="text"
                      value={row.anchor || ""}
                      onChange={(e) => updateRow(row.id, { anchor: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-fuchsia-500"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {!includeInReport && (
            <p className="text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
              La matriz está generada pero <strong>no se incluirá en el PDF</strong> hasta que actives «Incluir en PDF».
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SemioticsConductMatrixModule;
