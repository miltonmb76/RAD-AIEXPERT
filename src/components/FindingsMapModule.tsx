import React, { useMemo, useState } from "react";
import { Loader2, MapPinned, RefreshCw, Sparkles } from "lucide-react";
import {
  listFindingsMapTemplates,
  type FindingsMapData,
  type FindingsMapTemplateId,
  type FindingsMapViewOrientation,
} from "../lib/findingsMap";
import { FindingsMapCanvas } from "./FindingsMapCanvas";

interface FindingsMapModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  mapData: FindingsMapData | null;
  setMapData: (data: FindingsMapData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  /** Optional linked attached images count hint */
  attachedImageCount?: number;
}

export const FindingsMapModule: React.FC<FindingsMapModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  mapData,
  setMapData,
  includeInReport,
  setIncludeInReport,
  attachedImageCount = 0,
}) => {
  const templates = useMemo(() => listFindingsMapTemplates(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorInstructions, setPriorInstructions] = useState("");
  const [templateHint, setTemplateHint] = useState<FindingsMapTemplateId | "auto">("auto");
  const [viewOrientation, setViewOrientation] = useState<FindingsMapViewOrientation | "auto">(
    "auto"
  );

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-findings-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          priorInstructions: priorInstructions.trim() || undefined,
          templateHint: templateHint === "auto" ? undefined : templateHint,
          viewOrientation: viewOrientation === "auto" ? undefined : viewOrientation,
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar el mapa de hallazgos.");
      }
      setMapData(json.data as FindingsMapData);
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando mapa de hallazgos:", err);
      setError(err?.message || "Error al generar el mapa de hallazgos.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-950/80 p-4 md:p-5 space-y-4 shadow-xl shadow-amber-950/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <MapPinned className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-200 font-mono">
              Mapa de hallazgos numerados
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-xl">
              Esquema genérico con pins ①②③ alineados al orden del informe. Sirve para cualquier estudio;
              puedes dar instrucciones previas (enfoque, plantilla, lateralidad).
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="space-y-2">
        <label className="block text-[9px] font-black uppercase tracking-widest text-amber-300/80 font-mono">
          Instrucciones previas (opcional)
        </label>
        <textarea
          value={priorInstructions}
          onChange={(e) => setPriorInstructions(e.target.value)}
          rows={3}
          placeholder="Ej.: Enfatiza solo hallazgos anormales; usa plantilla de mamas; pin 1 = lesión dominante CSE derecha; respeta PA si el tórax es de espaldas; ignora hallazgos normales del resto del estudio."
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">
            Plantilla
          </label>
          <select
            value={templateHint}
            onChange={(e) => setTemplateHint(e.target.value as FindingsMapTemplateId | "auto")}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
          >
            <option value="auto">Auto (según estudio)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">
            Vista lateralidad
          </label>
          <select
            value={viewOrientation}
            onChange={(e) =>
              setViewOrientation(e.target.value as FindingsMapViewOrientation | "auto")
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
          >
            <option value="auto">Auto</option>
            <option value="AP">AP · de frente (espejo)</option>
            <option value="PA">PA · de espaldas</option>
          </select>
        </div>
      </div>

      {attachedImageCount > 0 && (
        <p className="text-[10px] text-slate-500">
          Hay {attachedImageCount} imagen{attachedImageCount === 1 ? "" : "es"} adjunta
          {attachedImageCount === 1 ? "" : "s"}. Si ya vinculaste figuras, el mapa intentará alinear
          los números con “(ver Figura N)”.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !reportText.trim()}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generando mapa...
            </>
          ) : mapData ? (
            <>
              <RefreshCw className="h-4 w-4" /> Regenerar mapa
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generar mapa de hallazgos
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {mapData && <FindingsMapCanvas data={mapData} />}
    </div>
  );
};

export default FindingsMapModule;
