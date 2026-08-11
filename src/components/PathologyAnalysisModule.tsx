import React, { useState } from "react";
import { 
  Stethoscope, 
  Sparkles, 
  Loader2, 
  Check, 
  Activity, 
  Layers, 
  GitCommit, 
  Scale, 
  Search, 
  FileText, 
  Maximize2, 
  Minimize2,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { CaseAnalysisData, CaseAnalysisFormatOption, CaseAnalysisElementsConfig } from "../types";
import CaseAnalysisRenderer from "./CaseAnalysisRenderer";

interface PathologyAnalysisModuleProps {
  generatedReport: string;
  studyType?: string;
  clinicalHistory?: string;
  selectedModel?: string;
  onInsertToReport: (jsonBlock: string, textSummary: string, selectedFormat: string, pathologyName: string) => void;
}

const COMMON_PATHOLOGIES = [
  { name: "Colecistitis Aguda", category: "Abdomen", icon: "🟡" },
  { name: "Apendicitis Aguda", category: "Abdomen", icon: "🔴" },
  { name: "Esteatosis Hepática", category: "Hígado", icon: "🟢" },
  { name: "Litiasis Renal / Nefrolitiasis", category: "Renal", icon: "🔵" },
  { name: "Síndrome de Ovario Poliquístico", category: "Ginecología", icon: "🟣" },
  { name: "Pancreatitis Aguda", category: "Abdomen", icon: "🟧" },
  { name: "Trombosis Venosa Profunda (TVP)", category: "Vascular", icon: "🔴" },
  { name: "Hidronefrosis", category: "Renal", icon: "🟦" },
  { name: "Torsión / Isquemia Ovárica", category: "Pelvis", icon: "🟣" },
  { name: "Miomatosis Uterina", category: "Ginecología", icon: "🌸" },
  { name: "Diverticulitis Aguda", category: "Abdomen", icon: "🟠" },
  { name: "Nódulo Tiroideo (TIRADS)", category: "Cuello", icon: "🟤" },
];

export default function PathologyAnalysisModule({
  generatedReport,
  studyType,
  clinicalHistory,
  selectedModel,
  onInsertToReport,
}: PathologyAnalysisModuleProps) {
  const [selectedPathology, setSelectedPathology] = useState<string>("Colecistitis Aguda");
  const [customPathology, setCustomPathology] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result states
  const [analysisData, setAnalysisData] = useState<CaseAnalysisData | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<CaseAnalysisFormatOption>("esquema_pilares");
  const [isInserted, setIsInserted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Interactive visibility toggles
  const [elementsConfig, setElementsConfig] = useState<{
    includeSonographic: boolean;
    includeSonographicDetails: boolean;
    includeClinicalCorr: boolean;
    includeFinalDiscussion: boolean;
    includeDifferentials: boolean;
  }>({
    includeSonographic: true,
    includeSonographicDetails: true,
    includeClinicalCorr: true,
    includeFinalDiscussion: true,
    includeDifferentials: true,
  });

  const activePathologyName = isCustom ? (customPathology.trim() || "Patología Personalizada") : selectedPathology;

  const handleRunAnalysis = async () => {
    if (!generatedReport || !generatedReport.trim()) {
      setError("Redacta o genera primero un reporte radiológico para poder analizar la correlación con la patología.");
      return;
    }
    if (!activePathologyName) {
      setError("Especifica o selecciona una patología a analizar.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsInserted(false);

    try {
      const response = await fetch("/api/analyze-pathology-correlation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          pathology: activePathologyName,
          studyType: studyType || "Estudio Ultrasonográfico",
          clinicalHistory: clinicalHistory || "",
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        // Ensure default format and enforce NO certainty / NO management config
        const data: CaseAnalysisData = {
          ...resData.data,
          format: selectedFormat,
          elementsConfig: {
            includeSonographic: true,
            includeSonographicDetails: true,
            includeClinicalCorr: true,
            includeCertainty: false,       // STRICT: NO probability percentages
            includeDifferentials: true,
            includeDiscardedDifferentials: false,
            includeManagement: false,       // STRICT: NO treatment recommendations
          }
        };
        setAnalysisData(data);
      } else {
        setError(resData.error || "No se pudo realizar el análisis de la patología.");
      }
    } catch (err: any) {
      console.error("Error al correlacionar patología:", err);
      setError(err?.message || "Error de conexión al servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncorporateToPDFReport = () => {
    if (!analysisData) return;

    // Filter data based on interactive toggles
    const filteredData: CaseAnalysisData = JSON.parse(JSON.stringify(analysisData));
    filteredData.format = selectedFormat;
    filteredData.title = `CORRELACIÓN ECOGRÁFICA: ${activePathologyName.toUpperCase()}`;
    filteredData.elementsConfig = {
      includeSonographic: elementsConfig.includeSonographic,
      includeSonographicDetails: elementsConfig.includeSonographicDetails,
      includeClinicalCorr: elementsConfig.includeClinicalCorr,
      includeCertainty: false, // EXCLUDED
      includeDifferentials: elementsConfig.includeDifferentials,
      includeDiscardedDifferentials: false,
      includeManagement: false, // EXCLUDED
    };

    if (!elementsConfig.includeSonographicDetails && filteredData.sonographicPillar) {
      filteredData.sonographicPillar.details = [];
    }

    // Wrap in standard CASE_ANALYSIS_JSON tag for report renderer
    const jsonStr = JSON.stringify(filteredData, null, 2);
    const jsonBlock = `[CASE_ANALYSIS_JSON]\n${jsonStr}\n[/CASE_ANALYSIS_JSON]\n\n`;
    const textSummary = filteredData.clinicalCorrelation 
      ? `**CORRELACIÓN ECOGRÁFICA Y SÍNTESIS DIAGNÓSTICA (${activePathologyName.toUpperCase()})**\n${filteredData.clinicalCorrelation}\n\n` 
      : "";

    onInsertToReport(jsonBlock, textSummary, selectedFormat, activePathologyName);
    setIsInserted(true);
  };

  return (
    <div className="bg-[#080d11] border-2 border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl p-5 md:p-6 space-y-5 shadow-2xl transition-all relative overflow-hidden font-sans">
      {/* Top Header Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-900/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-indigo-400 shadow-inner">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                Módulo de Análisis Específico por Patología
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded font-mono">
                IA CORRELACIÓN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-0.5">
              Evalúa los hallazgos descritos en el informe enfocados en una sospecha o patología objetivo. Resalta signos de soporte y sintesis clínica sin porcentajes probabilísticos ni tratamientos.
            </p>
          </div>
        </div>
      </div>

      {/* Pathology Selector Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            1. Selecciona o escribe la Patología Objetivo:
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            Actual: <strong className="text-emerald-400">{activePathologyName}</strong>
          </span>
        </div>

        {/* Preset Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {COMMON_PATHOLOGIES.map((p) => {
            const isSelected = !isCustom && selectedPathology === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedPathology(p.name);
                  setIsCustom(false);
                }}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-indigo-950/90 border-indigo-400 text-indigo-100 ring-1 ring-indigo-500/50 shadow-md"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs">{p.icon}</span>
                  <span className="text-[10px] font-bold font-sans truncate">{p.name}</span>
                </div>
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tight">{p.category}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Input Option */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustom(!isCustom)}
            className={`px-3 py-2 rounded-xl border font-mono text-[10px] font-bold uppercase transition-all cursor-pointer ${
              isCustom
                ? "bg-indigo-950 border-indigo-400 text-indigo-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {isCustom ? "✓ Escribiendo otra patología:" : "+ Otra Patología..."}
          </button>

          {isCustom && (
            <input
              type="text"
              value={customPathology}
              onChange={(e) => setCustomPathology(e.target.value)}
              placeholder="Escribe el nombre de la patología (ej. Colelitiasis, Quiste de Baker, Torsión de quiste...)"
              className="flex-1 bg-slate-950 border border-indigo-500/40 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none font-sans"
            />
          )}
        </div>
      </div>

      {/* Action Trigger Button */}
      <button
        type="button"
        onClick={handleRunAnalysis}
        disabled={isLoading || !generatedReport}
        className={`w-full py-3.5 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg ${
          isLoading
            ? "bg-indigo-950 border-indigo-500/40 text-indigo-300 animate-pulse cursor-wait"
            : !generatedReport
            ? "bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 hover:shadow-indigo-500/25 active:scale-[0.99]"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
            <span>Correlacionando hallazgos con {activePathologyName}...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4.5 w-4.5 text-indigo-300" />
            <span>Analizar y Correlacionar Hallazgos para "{activePathologyName}"</span>
          </>
        )}
      </button>

      {/* Error Notice */}
      {error && (
        <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-sans flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Analysis Output & Customization Panel */}
      {analysisData && (
        <div className={isExpanded 
          ? "fixed inset-4 md:inset-8 z-50 bg-[#070b0e]/95 backdrop-blur-2xl border-2 border-indigo-500/50 rounded-3xl p-6 flex flex-col space-y-4 shadow-2xl overflow-y-auto" 
          : "space-y-4 pt-2 border-t border-slate-800 animate-fade-in"
        }>
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider font-mono">
                RESULTADO: CORRELACIÓN DE HALLAZGOS ({activePathologyName.toUpperCase()})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
              title={isExpanded ? "Restaurar vista" : "Modo Pantalla Completa"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Format Options Selector */}
          <div className="space-y-2 bg-slate-950/80 p-4 rounded-xl border border-indigo-500/20">
            <label className="text-[11px] font-mono font-bold uppercase text-indigo-300 block">
              2. Elige el Formato Visual de Inserción para el PDF:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { id: "esquema_pilares", name: "Formato 1: Pilares Confirmatorios", desc: "Estructurado por secciones de evidencia" },
                { id: "flujograma_semiologico", name: "Formato 2: Flujograma Semiológico", desc: "Ruta desde el hallazgo a la síntesis" },
                { id: "matriz_semiotica", name: "Formato 3: Matriz de Correlación", desc: "Signos a favor y criterios cumplidos" },
                { id: "flujograma_algoritmico", name: "Formato 4: Tarjeta de Discusión", desc: "Pasos de síntesis diagnóstica" },
              ].map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id as CaseAnalysisFormatOption)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedFormat === fmt.id
                      ? "bg-indigo-950 border-indigo-400 text-indigo-200 ring-1 ring-indigo-500/40"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold uppercase">{fmt.name}</div>
                  <div className="text-[8.5px] text-slate-400 leading-tight">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Visibility Toggles (Elegir qué sale y qué no sale) */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/20 space-y-2">
            <label className="text-[11px] font-mono font-bold uppercase text-indigo-300 block">
              3. Selecciona qué elementos incluir o excluir antes de insertar:
            </label>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={elementsConfig.includeSonographic}
                  onChange={(e) => setElementsConfig(prev => ({ ...prev, includeSonographic: e.target.checked }))}
                  className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 accent-indigo-500"
                />
                <span>Pilar Ecográfico Principal</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={elementsConfig.includeSonographicDetails}
                  onChange={(e) => setElementsConfig(prev => ({ ...prev, includeSonographicDetails: e.target.checked }))}
                  className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 accent-indigo-500"
                />
                <span>Signos Confirmatorios Encontrados</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={elementsConfig.includeClinicalCorr}
                  onChange={(e) => setElementsConfig(prev => ({ ...prev, includeClinicalCorr: e.target.checked }))}
                  className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 accent-indigo-500"
                />
                <span>Correlación Fisiopatológica</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={elementsConfig.includeDifferentials}
                  onChange={(e) => setElementsConfig(prev => ({ ...prev, includeDifferentials: e.target.checked }))}
                  className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 accent-indigo-500"
                />
                <span>Resumen de Criterios Positivos</span>
              </label>
            </div>
          </div>

          {/* Live Preview Renderer */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
              Previsualización en Vivo del Anexo PDF:
            </span>
            <div className="bg-[#0b1015] p-4 rounded-xl border border-slate-800 shadow-inner">
              <CaseAnalysisRenderer
                data={{
                  ...analysisData,
                  format: selectedFormat,
                  elementsConfig: {
                    includeSonographic: elementsConfig.includeSonographic,
                    includeSonographicDetails: elementsConfig.includeSonographicDetails,
                    includeClinicalCorr: elementsConfig.includeClinicalCorr,
                    includeCertainty: false, // EXCLUDED
                    includeDifferentials: elementsConfig.includeDifferentials,
                    includeDiscardedDifferentials: false,
                    includeManagement: false, // EXCLUDED
                  }
                }}
                isDarkTheme={true}
              />
            </div>
          </div>

          {/* Insertion Action */}
          <button
            type="button"
            onClick={handleIncorporateToPDFReport}
            className={`w-full py-3.5 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
              isInserted
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                : "bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold"
            }`}
          >
            {isInserted ? (
              <>
                <Check className="h-4.5 w-4.5 text-emerald-400" />
                <span>Análisis de "{activePathologyName}" Insertado en el PDF / Anexo</span>
              </>
            ) : (
              <>
                <FileText className="h-4.5 w-4.5 text-slate-950" />
                <span>Insertar Cuadro de "{activePathologyName}" al PDF (Reporte Activo)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
