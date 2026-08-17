import React, { useState, useEffect } from "react";
import { Sparkles, Search, Table, LayoutGrid, Check, FileText, Copy, Download, Plus, AlertCircle, RefreshCw, ChevronRight, ShieldCheck, HelpCircle } from "lucide-react";

interface DetectedClassification {
  name: string;
  assignedCategory: string;
  detectedInText: boolean;
  whyApplicable: string;
}

interface CriterionItem {
  criterion: string;
  findingInReport: string;
  weightOrGrade: string;
  justification: string;
}

interface DecisionStep {
  stepNumber: number;
  title: string;
  description: string;
  isMet: boolean;
}

interface BreakdownData {
  classificationName: string;
  categoryAssigned: string;
  definitionAndRisk: string;
  clinicalSummary: string;
  criteriaMatrix: CriterionItem[];
  decisionSteps: DecisionStep[];
  recommendations: string;
  formattedAnnexMarkdown: string;
  formattedAnnexHtml: string;
}

interface ClassificationBreakdownModuleProps {
  reportText: string;
  studyType?: string;
  selectedModel?: string;
  onAppendToReport?: (annexText: string) => void;
}

export const formatClassificationTitle = (sysName: string, catName: string): string => {
  const sys = (sysName || "").trim();
  const cat = (catName || "").trim();

  // Strip leading "Clasificación de " or "Clasificación " (case insensitive)
  let cleanSys = sys.replace(/^clasificaci[oó]n\s+(de\s+)?/i, "").trim();
  if (!cleanSys) cleanSys = sys;

  let sysTitle = `CLASIFICACIÓN DE ${cleanSys.toUpperCase()}`;

  if (!cat) {
    return sysTitle;
  }

  let cleanCat = cat.trim().toUpperCase();
  cleanCat = cleanCat.replace(/^CLASIFICACI[OÓ]N\s+(DE\s+)?/i, "").trim();

  if (cleanCat.startsWith(cleanSys.toUpperCase())) {
    return `CLASIFICACIÓN DE ${cleanCat}`;
  }

  return `${sysTitle} - ${cleanCat}`;
};

export const ClassificationBreakdownModule: React.FC<ClassificationBreakdownModuleProps> = ({
  reportText,
  studyType = "Estudio Radiológico",
  selectedModel = "gemini-3.7-flash",
  onAppendToReport
}) => {
  // Detection state
  const [isSearching, setIsSearching] = useState(false);
  const [detectedList, setDetectedList] = useState<DetectedClassification[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected classification
  const [selectedClassification, setSelectedClassification] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customClassification, setCustomClassification] = useState<string>("");

  // Configuration options
  const [selectedFormat, setSelectedFormat] = useState<"option_a" | "option_b">("option_a");
  const [includeRecommendations, setIncludeRecommendations] = useState<boolean>(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [breakdownData, setBreakdownData] = useState<BreakdownData | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [appendedSuccess, setAppendedSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Auto search on mount if reportText is available and hasn't searched yet
  useEffect(() => {
    if (reportText && !detectedList && !isSearching) {
      handleSearchClassifications();
    }
  }, [reportText]);

  const handleSearchClassifications = async () => {
    if (!reportText) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await fetch("/api/detect-report-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText
        })
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.classifications)) {
        setDetectedList(data.classifications);
        if (data.classifications.length > 0) {
          setSelectedClassification(data.classifications[0].name);
          setSelectedCategory(data.classifications[0].assignedCategory);
        }
      } else {
        setSearchError(data.error || "No se pudieron identificar clasificaciones en el reporte.");
      }
    } catch (err: any) {
      setSearchError("Error de conexión al detectar clasificaciones.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateBreakdown = async () => {
    const finalName = customClassification.trim() || selectedClassification;
    if (!finalName) {
      setGenError("Por favor selecciona o escribe el nombre de la clasificación a desglosar.");
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setAppendedSuccess(false);
    try {
      const response = await fetch("/api/generate-classification-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          classificationName: finalName,
          assignedCategory: selectedCategory,
          format: selectedFormat,
          includeRecommendations: includeRecommendations,
          studyType: studyType
        })
      });
      const data = await response.json();
      if (data.success && data.breakdown) {
        let bd = data.breakdown;
        if (bd.formattedAnnexMarkdown) {
          bd.formattedAnnexMarkdown = bd.formattedAnnexMarkdown
            .replace(/^#*\s*ANEXO\s+DIAGN[OÓ]STICO\s*:\s*/gi, "### ")
            .replace(/ANEXO\s+DIAGN[OÓ]STICO\s*:\s*/gi, "");
        }
        if (bd.formattedAnnexHtml) {
          bd.formattedAnnexHtml = bd.formattedAnnexHtml.replace(/ANEXO\s+DIAGN[OÓ]STICO\s*:\s*/gi, "");
        }
        setBreakdownData(bd);
      } else {
        setGenError(data.error || "Error al generar el desglose de la clasificación.");
      }
    } catch (err: any) {
      setGenError("Error de comunicación al generar el desglose.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAppendToReport = () => {
    if (!breakdownData || !onAppendToReport) return;

    const cleanFieldText = (txt?: string) => {
      if (!txt) return "";
      return txt
        .replace(/^(?:interpretaci[oó]n\s*(?:e|y)?\s*hallazgos|interpretaci[oó]n|hallazgos)\s*:\s*/i, "")
        .replace(/^(?:interpretaci[oó]n\s*(?:e|y)?\s*hallazgos|interpretaci[oó]n|hallazgos)\s+/i, "")
        .trim();
    };

    const sysName = (breakdownData.classificationName || "").trim();
    const catName = (breakdownData.categoryAssigned || "").trim();
    const titleHeader = formatClassificationTitle(sysName, catName);

    let annexText = `\n\n---\n\n### ${titleHeader}\n`;
    annexText += `**Sistema:** ${sysName} • **Categoría / Estadio:** ${catName}\n\n`;
    annexText += `**Definición & Significado Clínico:** ${cleanFieldText(breakdownData.definitionAndRisk)}\n\n`;
    annexText += `**Sustento Diagnóstico Integrador:** ${cleanFieldText(breakdownData.clinicalSummary)}\n\n`;

    if (selectedFormat === "option_a") {
      annexText += `#### TABLA DE JUSTIFICACIÓN CRITERIO POR CRITERIO:\n\n`;
      annexText += `| Criterio Evaluado | Hallazgo en el Reporte | Ponderación / Score | Justificación Diagnóstica |\n`;
      annexText += `| :--- | :--- | :--- | :--- |\n`;
      breakdownData.criteriaMatrix.forEach((item) => {
        const c = cleanFieldText(item.criterion || "").replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
        const f = cleanFieldText(item.findingInReport || "").replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
        const w = cleanFieldText(item.weightOrGrade || "").replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
        const j = cleanFieldText(item.justification || "").replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
        annexText += `| ${c} | ${f} | ${w} | ${j} |\n`;
      });
      annexText += `\n`;
    } else {
      annexText += `#### FICHA EXPLICATIVA Y ALGORITMO DECISIONAL:\n`;
      breakdownData.decisionSteps.forEach((step) => {
        annexText += `* **Paso ${step.stepNumber}: ${cleanFieldText(step.title)}**: ${cleanFieldText(step.description)} (${step.isMet ? "✓ Criterio Cumplido" : "No determinante"})\n`;
      });
      annexText += `\n`;
      annexText += `##### CRITERIOS CLAVE:\n`;
      breakdownData.criteriaMatrix.forEach((item) => {
        annexText += `* **${cleanFieldText(item.criterion)}**: ${cleanFieldText(item.findingInReport)} → *${cleanFieldText(item.justification)}*\n`;
      });
      annexText += `\n`;
    }

    if (includeRecommendations && breakdownData.recommendations && breakdownData.recommendations.trim()) {
      const rec = cleanFieldText(breakdownData.recommendations);
      if (rec && !/^(?:nota|anexo\s+de\s+car[aá]cter|sin\s+recomendaciones)/i.test(rec)) {
        annexText += `**Conducta y Recomendación de Seguimiento:**\n${rec}\n`;
      }
    }

    onAppendToReport(annexText);
    setAppendedSuccess(true);
    setTimeout(() => setAppendedSuccess(false), 4000);
  };

  const handleCopyText = () => {
    if (!breakdownData) return;
    const textToCopy = breakdownData.formattedAnnexMarkdown || breakdownData.clinicalSummary;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  const handleDownloadAnnex = () => {
    if (!breakdownData) return;
    const text = breakdownData.formattedAnnexMarkdown;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Anexo_Clasificacion_${breakdownData.classificationName.replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-950 border-2 border-indigo-900/40 rounded-2xl p-5 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Visual Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full"></div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-800/40 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-black text-indigo-300 uppercase tracking-widest font-mono">
              Desglose y Justificación de Clasificaciones Radiológicas
            </h3>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
            Modulo inteligente de anexo explicativo: detecta, desglose criterio por criterio y justifica las escalas usadas.
          </p>
        </div>

        <button
          onClick={handleSearchClassifications}
          disabled={isSearching}
          className="px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow flex items-center gap-2 font-mono shrink-0"
        >
          {isSearching ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" /> Analizando Informe...
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" /> Re-esccanear Clasificaciones
            </>
          )}
        </button>
      </div>

      {/* Step 1: Clasificaciones Detectadas / Disponibles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
            1. Selecciona la Clasificación a Desglosar:
          </label>
          {detectedList && (
            <span className="text-[9px] font-bold text-indigo-400 uppercase font-mono bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
              {detectedList.length} detectadas en el informe
            </span>
          )}
        </div>

        {isSearching && (
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-center animate-pulse space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Examinando semánticamente el informe en busca de clasificaciones...
            </p>
          </div>
        )}

        {searchError && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-[10px] font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {detectedList && detectedList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {detectedList.map((item, idx) => {
              const isSelected = selectedClassification === item.name;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedClassification(item.name);
                    setSelectedCategory(item.assignedCategory);
                    setCustomClassification("");
                  }}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none space-y-2 ${
                    isSelected
                      ? "bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-950/50"
                      : "bg-[#090D1A] border-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-indigo-400 animate-ping" : "bg-slate-600"}`}></span>
                      {item.name}
                    </h4>
                    {item.assignedCategory && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 font-mono shrink-0">
                        {item.assignedCategory}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    {item.whyApplicable}
                  </p>
                  <div className="flex items-center gap-2 text-[8px] font-mono font-bold uppercase tracking-widest text-slate-500 pt-1">
                    {item.detectedInText ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Mencionada en el reporte
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Sugerida según hallazgos
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Custom Input fallback */}
        <div className="pt-1">
          <input
            type="text"
            placeholder="O escribe otra clasificación personalizada (ej. 'Clasificación de Neer para húmero proximal')"
            value={customClassification}
            onChange={(e) => {
              setCustomClassification(e.target.value);
              if (e.target.value) {
                setSelectedClassification("");
              }
            }}
            className="w-full bg-[#060a17] border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Step 2: Formato Visual (Opción A vs Opción B) y Configuración de Recomendaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-850">
        {/* Formato Visual */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
            2. Formato de Ilustración y Presentación:
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Opción A */}
            <div
              onClick={() => setSelectedFormat("option_a")}
              className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                selectedFormat === "option_a"
                  ? "bg-indigo-950/60 border-indigo-500"
                  : "bg-[#090D1A] border-slate-850 hover:border-slate-800"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedFormat === "option_a" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}`}>
                <Table className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-black text-slate-200 uppercase tracking-wider">Opción A: Tabla Estructurada</h5>
                  {selectedFormat === "option_a" && <span className="text-[9px] font-black text-indigo-400 font-mono">SELECCIONADO</span>}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Matriz de justificación: Criterio | Hallazgo en Reporte | Ponderación | Sustento Diagnóstico.
                </p>
              </div>
            </div>

            {/* Opción B */}
            <div
              onClick={() => setSelectedFormat("option_b")}
              className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                selectedFormat === "option_b"
                  ? "bg-indigo-950/60 border-indigo-500"
                  : "bg-[#090D1A] border-slate-850 hover:border-slate-800"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedFormat === "option_b" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}`}>
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-black text-slate-200 uppercase tracking-wider">Opción B: Ficha Explicativa / Tarjetas</h5>
                  {selectedFormat === "option_b" && <span className="text-[9px] font-black text-indigo-400 font-mono">SELECCIONADO</span>}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Árbol decisional con pasos secuenciales, tarjetas conceptuales e infografía de síntesis.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuración de Recomendaciones */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
            3. Conducta y Recomendaciones Clínicas:
          </label>

          <div className="bg-[#090D1A] border-2 border-slate-850 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeRecommendations}
                onChange={(e) => setIncludeRecommendations(e.target.checked)}
                className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
                Incluir Recomendaciones de Manejo / Seguimiento Clínico
              </span>
            </label>

            <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
              {includeRecommendations ? (
                <span className="text-emerald-400">
                  ✓ El anexo incluirá las pautas oficiales de conducta, control periódico o recomendación histopatológica.
                </span>
              ) : (
                <span className="text-amber-400">
                  ⚠ El anexo será 100% de carácter estricto a la justificación diagnóstica (sin sugerir pautas de tratamiento).
                </span>
              )}
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerateBreakdown}
              disabled={isGenerating || (!selectedClassification && !customClassification)}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-550 hover:to-indigo-650 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 font-mono"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Procesando Desglose Inteligente...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-indigo-300" /> Generar Desglose y Justificación
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {genError && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-900/50 rounded-xl text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{genError}</span>
        </div>
      )}

      {/* Step 3: Result Display */}
      {breakdownData && (
        <div className="pt-4 border-t-2 border-indigo-900/40 space-y-5 animate-fade-in">
          {/* Top Result Banner */}
          <div className="bg-[#070b19] border border-indigo-500/30 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-950 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded border border-indigo-800 font-mono">
                  {breakdownData.classificationName}
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded border border-emerald-800 font-mono">
                  {breakdownData.categoryAssigned}
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-100 uppercase tracking-wide">
                {breakdownData.definitionAndRisk}
              </h4>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {onAppendToReport && (
                <button
                  onClick={handleAppendToReport}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 font-mono ${
                    appendedSuccess
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : "bg-emerald-600 hover:bg-emerald-550 text-white border-emerald-500 shadow-lg"
                  }`}
                >
                  {appendedSuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> ¡Anexado al Reporte!
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Anexar al Reporte PDF/Impresión
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleCopyText}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono"
              >
                {copiedSuccess ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSuccess ? "Copiado" : "Copiar"}
              </button>

              <button
                onClick={handleDownloadAnnex}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono"
              >
                <Download className="h-3.5 w-3.5" /> Descargar
              </button>
            </div>
          </div>

          {/* Clinical Summary */}
          <div className="bg-[#060a17] p-4 rounded-xl border border-indigo-950 text-slate-300 text-xs leading-relaxed font-sans space-y-1">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono block">
              Sustento Radiológico Integrador:
            </span>
            <p className="font-medium text-slate-200">{breakdownData.clinicalSummary}</p>
          </div>

          {/* Format Preview Toggle (Option A vs Option B) */}
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
              Vista Previa del Anexo Esquemático:
            </span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedFormat("option_a")}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md font-mono transition-all ${
                  selectedFormat === "option_a" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tabla (Opción A)
              </button>
              <button
                onClick={() => setSelectedFormat("option_b")}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md font-mono transition-all ${
                  selectedFormat === "option_b" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Ficha (Opción B)
              </button>
            </div>
          </div>

          {/* Render Format A: Tabla Estructurada */}
          {selectedFormat === "option_a" && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#060a17]">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-indigo-950/80 text-indigo-300 uppercase tracking-wider text-[10px] font-mono border-b border-indigo-900/50">
                      <th className="p-3.5 font-black">Criterio Evaluado</th>
                      <th className="p-3.5 font-black">Hallazgo en el Reporte</th>
                      <th className="p-3.5 font-black">Ponderación / Score</th>
                      <th className="p-3.5 font-black">Justificación Diagnóstica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {breakdownData.criteriaMatrix.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3.5 font-bold text-slate-100 font-mono text-[11px] uppercase tracking-wide">
                          {item.criterion}
                        </td>
                        <td className="p-3.5 text-slate-200 font-medium">{item.findingInReport}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900/50 text-[10px] font-black font-mono">
                            {item.weightOrGrade}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 leading-relaxed text-[11px]">{item.justification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Render Format B: Ficha Explicativa / Tarjetas */}
          {selectedFormat === "option_b" && (
            <div className="space-y-4">
              {/* Decision Steps */}
              <div className="space-y-2.5">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 font-mono">
                  Pasos del Algoritmo Diagnóstico:
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {breakdownData.decisionSteps.map((step, idx) => (
                    <div key={idx} className="bg-[#060a17] border border-slate-800 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900 font-mono">
                          Paso {step.stepNumber}
                        </span>
                        {step.isMet ? (
                          <span className="text-emerald-400 text-[10px] font-black font-mono flex items-center gap-1">
                            <Check className="h-3 w-3" /> Cumplido
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-mono">No aplica</span>
                        )}
                      </div>
                      <h6 className="text-xs font-black text-slate-200 uppercase tracking-wide">{step.title}</h6>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Criteria Cards Grid */}
              <div className="space-y-2.5 pt-2">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 font-mono">
                  Matriz de Criterios Clave:
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {breakdownData.criteriaMatrix.map((item, idx) => (
                    <div key={idx} className="bg-[#090D1A] border border-slate-850 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-indigo-300 font-mono tracking-wider">
                          {item.criterion}
                        </span>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900 font-mono">
                          {item.weightOrGrade}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-200">{item.findingInReport}</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed italic">{item.justification}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations Block */}
          {includeRecommendations && breakdownData.recommendations && breakdownData.recommendations.trim() !== "" && (
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed font-sans space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest font-mono text-emerald-400 block">
                Conducta y Recomendación de Seguimiento:
              </span>
              <p className="text-slate-300 font-medium whitespace-pre-line">{breakdownData.recommendations}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
