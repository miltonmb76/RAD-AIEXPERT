import React, { useState } from "react";
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Check,
  AlertTriangle,
  Layers,
  FileText,
  Sparkles,
} from "lucide-react";
import { ClinicalScorecardData, Atlas3DData } from "../types";
import {
  SCORECARD_PROTOCOL_OPTIONS,
  buildAtlasDirectivesFromScorecard,
  criterionStatusLabel,
  mergeOverlaysOntoAtlas,
  scorecardTrafficLabel,
} from "../lib/clinicalIntelligence";

interface ClinicalScorecardModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  scorecardData: ClinicalScorecardData | null;
  setScorecardData: (data: ClinicalScorecardData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  /** Existing Atlas — enables one-click intelligent overlay sync */
  atlasData?: Atlas3DData | null;
  setAtlasData?: (data: Atlas3DData | null) => void;
  /** Prefills Atlas custom directives when regenerating */
  onAtlasDirectivesSuggested?: (directives: string) => void;
}

const statusStyle = (status: string) => {
  switch (status) {
    case "met":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "equivocal":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "not_met":
      return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
  }
};

const lightStyle = (light: string) => {
  switch (light) {
    case "critical":
      return "text-rose-300 bg-rose-500/20 border-rose-500/40";
    case "high":
      return "text-orange-300 bg-orange-500/20 border-orange-500/40";
    case "moderate":
      return "text-amber-300 bg-amber-500/20 border-amber-500/40";
    default:
      return "text-emerald-300 bg-emerald-500/20 border-emerald-500/40";
  }
};

export const ClinicalScorecardModule: React.FC<ClinicalScorecardModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  scorecardData,
  setScorecardData,
  includeInReport,
  setIncludeInReport,
  atlasData,
  setAtlasData,
  onAtlasDirectivesSuggested,
}) => {
  const [protocolId, setProtocolId] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El reporte clínico está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSynced(false);
    try {
      const response = await fetch("/api/generate-clinical-scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          protocolId,
          atlasPanels: (atlasData?.panels || []).map((p) => ({
            panelLetter: p.panelLetter,
            panelTitle: p.panelTitle,
            anatomicalFocus: p.anatomicalFocus,
          })),
        }),
      });
      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar el Scorecard.");
      }
      const data = json.data as ClinicalScorecardData;
      setScorecardData(data);
      setIncludeInReport(true);

      const directives = buildAtlasDirectivesFromScorecard(data);
      if (directives && onAtlasDirectivesSuggested) {
        onAtlasDirectivesSuggested(directives);
      }

      // Intelligent auto-sync: if Atlas already exists, merge overlays immediately
      if (atlasData && setAtlasData && data.atlasOverlays?.length) {
        const merged = mergeOverlaysOntoAtlas(atlasData, data.atlasOverlays, "shared");
        if (merged) {
          setAtlasData(merged);
          setSynced(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error de comunicación con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAtlas = () => {
    if (!scorecardData || !atlasData || !setAtlasData) return;
    const merged = mergeOverlaysOntoAtlas(
      atlasData,
      scorecardData.atlasOverlays,
      "scorecard"
    );
    if (merged) {
      setAtlasData(merged);
      setSynced(true);
    }
    const directives = buildAtlasDirectivesFromScorecard(scorecardData);
    if (directives && onAtlasDirectivesSuggested) {
      onAtlasDirectivesSuggested(directives);
    }
  };

  return (
    <div className="rounded-2xl border border-teal-900/50 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/40 p-4 md:p-5 shadow-xl shadow-teal-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30">
            <ClipboardCheck className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-teal-100 uppercase">
              Scorecard de Criterios Clínicos
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Checklist auditable anclado al informe. Se sincroniza automáticamente con el Atlas 3D
              (overlays de patología activa).
            </p>
          </div>
        </div>
        {scorecardData && (
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
              className="rounded border-slate-600"
            />
            {includeInReport ? "✓ Incluido en PDF" : "No incluir en PDF"}
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Protocolo</label>
          <select
            value={protocolId}
            onChange={(e) => setProtocolId(e.target.value)}
            className="bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
          >
            {SCORECARD_PROTOCOL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !reportText.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isLoading ? "Analizando criterios…" : "Generar Scorecard"}
        </button>
        {scorecardData && atlasData && setAtlasData && (
          <button
            type="button"
            onClick={handleSyncAtlas}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 text-xs font-medium"
          >
            <Layers className="w-3.5 h-3.5" />
            {synced ? "Overlay Atlas actualizado" : "Aplicar overlay al Atlas"}
          </button>
        )}
        {scorecardData && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-300 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Regenerar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {scorecardData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
              <div className="text-[10px] uppercase text-slate-500">Protocolo</div>
              <div className="text-sm text-slate-100 font-medium mt-1">{scorecardData.protocolName}</div>
              <div className="text-xs text-teal-300/90 mt-1">{scorecardData.categoryAssigned}</div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
              <div className="text-[10px] uppercase text-slate-500">Criterios positivos</div>
              <div className="text-2xl font-semibold text-slate-50 mt-1">
                {scorecardData.scoreMet}
                <span className="text-sm text-slate-400 font-normal"> / {scorecardData.scoreTotal}</span>
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${lightStyle(scorecardData.trafficLight)}`}>
              <div className="text-[10px] uppercase opacity-80">Semáforo clínico</div>
              <div className="text-lg font-semibold mt-1">
                {scorecardTrafficLabel(scorecardData.trafficLight)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 font-medium">Criterio</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Evidencia del informe</th>
                  <th className="px-3 py-2 font-medium">Peso</th>
                </tr>
              </thead>
              <tbody>
                {(scorecardData.criteria || []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-800/80 align-top">
                    <td className="px-3 py-2 text-slate-200 font-medium max-w-[160px]">
                      {row.criterion}
                      {row.atlasStructure && (
                        <div className="text-[10px] text-indigo-300/80 mt-0.5">→ {row.atlasStructure}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] ${statusStyle(row.status)}`}>
                        {criterionStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{row.value || "—"}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-md">{row.evidence}</td>
                    <td className="px-3 py-2 text-slate-400 capitalize">{row.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                <FileText className="w-3 h-3" /> Síntesis
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{scorecardData.clinicalSummary}</p>
            </div>
            <div className="rounded-xl border border-teal-800/40 bg-teal-950/20 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-teal-500/80 mb-1">
                <Check className="w-3 h-3" /> Conducta sugerida
              </div>
              <p className="text-xs text-teal-100/90 leading-relaxed">{scorecardData.recommendation}</p>
            </div>
          </div>

          {synced && (
            <div className="text-[11px] text-indigo-300/90 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Overlays de patología activa sincronizados con el Atlas 3D ({scorecardData.atlasOverlays?.length || 0} marcadores).
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClinicalScorecardModule;
