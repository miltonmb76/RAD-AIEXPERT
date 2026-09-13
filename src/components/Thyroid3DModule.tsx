import React, { useState } from "react";
import { 
  Activity, 
  Sparkles, 
  Loader2, 
  Check, 
  RefreshCw, 
  X, 
  ZoomIn, 
  Eye, 
  Layers, 
  FileText, 
  Trash2, 
  Maximize2,
  Wand2,
  FlipHorizontal,
  Edit3,
  Compass,
  Plus,
  Heart,
  GitBranch,
  Gauge,
  ShieldCheck
} from "lucide-react";
import {
  Thyroid3DData,
  Thyroid3DPanel,
  ThyroidNoduleRow,
  ThyroidStudyType,
  ClinicalScorecardData
} from "../types";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { buildThyroidDirectivesFromScorecard } from "../lib/clinicalIntelligence";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";

interface Thyroid3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  thyroidData: Thyroid3DData | null;
  setThyroidData: (data: Thyroid3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  /** Vascular scorecard feeds mandatory generation directives (same pattern as Atlas/Focal). */
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

export const Thyroid3DModule: React.FC<Thyroid3DModuleProps> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  thyroidData,
  setThyroidData,
  includeInReport,
  setIncludeInReport,
  onClose,
  scorecardData,
  externalDirectives
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<Thyroid3DPanel | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [customDirectives, setCustomDirectives] = useState<string>("");

  // Pull Scorecard directives when parent pushes them (Atlas/Focal pattern)
  React.useEffect(() => {
    if (externalDirectives && externalDirectives.trim()) {
      setCustomDirectives((prev) => {
        if (
          prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
          prev.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD TIROIDES")
        ) {
          return externalDirectives.trim();
        }
        if (!prev.trim()) return externalDirectives.trim();
        return prev;
      });
    }
  }, [externalDirectives]);

  // If Scorecard data arrives/changes, keep vascular mandatory directives in the box
  React.useEffect(() => {
    const fromScorecard = buildThyroidDirectivesFromScorecard(scorecardData || null);
    if (!fromScorecard) return;
    setCustomDirectives((prev) => {
      if (
        !prev.trim() ||
        prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
        prev.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD TIROIDES")
      ) {
        return fromScorecard;
      }
      return prev;
    });
  }, [scorecardData]);

  const mergeMandatoryDirectives = (extraPanelDirective?: string) => {
    const scorecardDirectives = buildThyroidDirectivesFromScorecard(scorecardData || null);
    const userExtra = customDirectives.trim();
    // Avoid duplicating scorecard text when the textarea already holds the mandatory block
    const extraIsScorecardEcho =
      !!scorecardDirectives &&
      !!userExtra &&
      (userExtra === scorecardDirectives ||
        userExtra.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD TIROIDES") ||
        userExtra.includes("PATOLOGÍA ACTIVA DEL SCORECARD"));
    return [
      scorecardDirectives,
      extraIsScorecardEcho ? "" : userExtra,
      (extraPanelDirective || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  };
  
  // Selected vascular territory
  const [selectedThyroidType, setSelectedThyroidType] = useState<ThyroidStudyType>(() => {
    const text = ((reportText || "") + " " + (activeProtocol || "")).toLowerCase();
    if (text.includes("ganglio") || text.includes("cervical")) return "tiroides_nodos";
    if (text.includes("doppler")) return "tiroides_doppler";
    if (text.includes("tiroid") || text.includes("tirads") || text.includes("ti-rads")) return "tiroides_b_mode";
    return "general_thyroid";
  });

  const [selectedLaterality, setSelectedLaterality] = useState<string>(() => {
    if (laterality && laterality.trim()) return laterality.trim();
    return "auto";
  });

  // Single panel regeneration state
  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<{ [letter: string]: string }>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);
  const [editingFocusLetter, setEditingFocusLetter] = useState<string | null>(null);

  // Generate Vascular Suite with AI
  const handleGenerate = async () => {
    if (!reportText || !reportText.trim()) {
      setErrorMessage("No hay informe disponible para procesar el mapa tiroideo.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Analizando parámetros velocimétricos y estudio tiroideo...");

    try {
      setGenerationStep("Construyendo matriz hemodinámica y prompts macro-vasculares 3D...");

      const mergedDirectives = mergeMandatoryDirectives();

      await runBackgroundTask("thyroid-3d", "Generando Suite Tiroides 3D", async () => {
        const response = await fetch("/api/generate-3d-thyroid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            thyroidType: selectedThyroidType,
            laterality: selectedLaterality !== "auto" ? selectedLaterality : undefined,
            customDirectives: mergedDirectives || undefined,
            requestedModel: selectedModel
          })
        });

        const resData = await response.json();
        if (!resData.success) {
          throw new Error(resData.error || "Error al generar la Suite Tiroides 3D.");
        }

        setThyroidData(resData.data);
        setIncludeInReport(true);
      });
      setGenerationStep("");
    } catch (err: any) {
      console.error("Error generando Suite Tiroides 3D:", err);
      setErrorMessage(err.message || "Error al procesar la Suite Tiroides.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Flip horizontal — bake into imageUrl so PDF/export see the same laterality fix as the UI
  const handleFlipHorizontal = async (panelLetter: string) => {
    if (!thyroidData) return;
    const panel = thyroidData.panels.find((p) => p.panelLetter === panelLetter);
    if (!panel?.imageUrl) return;
    try {
      const flippedDataUrl = await flipImageDataUrl(panel.imageUrl);
      const updatedPanels = thyroidData.panels.map((p) => {
        if (p.panelLetter !== panelLetter) return p;
        return {
          ...p,
          imageUrl: flippedDataUrl,
          isCustomFlipped: !p.isCustomFlipped,
          laterality: swapLateralityLabel(p.laterality) || p.laterality,
        };
      });
      setThyroidData({
        ...thyroidData,
        panels: updatedPanels,
      });
      if (zoomPanel?.panelLetter === panelLetter) {
        const updated = updatedPanels.find((p) => p.panelLetter === panelLetter);
        if (updated) setZoomPanel(updated);
      }
    } catch (flipErr) {
      console.error("Error al voltear panel vascular:", flipErr);
      setErrorMessage("No se pudo voltear la imagen en espejo.");
    }
  };

  // Single panel regeneration
  const handleRegenerateSinglePanel = async (panel: Thyroid3DPanel) => {
    if (!thyroidData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);

    const directive = panelDirectives[panel.panelLetter] || "";
    const mergedDirectives = mergeMandatoryDirectives(directive);

    try {
      const response = await fetch("/api/regenerate-3d-thyroid-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          thyroidType: selectedThyroidType,
          panel,
          laterality: panel.laterality,
          userDirective: directive,
          customDirectives: mergedDirectives || undefined,
          requestedModel: selectedModel
        })
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || `Error al regenerar panel ${panel.panelLetter}`);
      }

      const updatedPanels = thyroidData.panels.map((p) =>
        p.panelLetter === panel.panelLetter ? resData.panel : p
      );

      setThyroidData({
        ...thyroidData,
        panels: updatedPanels
      });

      setEditingPanelLetter(null);
      setPanelDirectives((prev) => ({ ...prev, [panel.panelLetter]: "" }));
    } catch (err: any) {
      console.error("Error regenerando panel vascular:", err);
      setErrorMessage(err.message || "Error al regenerar panel.");
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  // Add row to hemodynamic table
  const handleAddTableRow = () => {
    if (!thyroidData) return;
    const newRow: ThyroidNoduleRow = {
      location: "Lóbulo / istmo",
      size: "—",
      composition: "Sólido",
      echogenicity: "Isoecoico",
      margins: "Bien definidos",
      echogenicFoci: "Ninguno",
      tiradsCategory: "TR2",
      clinicalImpact: "Seguimiento"
    };
    setThyroidData({
      ...thyroidData,
      noduleTable: [...thyroidData.noduleTable, newRow]
    });
  };

  // Delete row from hemodynamic table
  const handleDeleteTableRow = (idx: number) => {
    if (!thyroidData) return;
    const updated = [...thyroidData.noduleTable];
    updated.splice(idx, 1);
    setThyroidData({
      ...thyroidData,
      noduleTable: updated
    });
  };

  // Update row
  const handleUpdateTableRow = (idx: number, field: keyof ThyroidNoduleRow, value: string) => {
    if (!thyroidData) return;
    const updated = [...thyroidData.noduleTable];
    updated[idx] = { ...updated[idx], [field]: value };
    setThyroidData({
      ...thyroidData,
      noduleTable: updated
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-teal-100 overflow-hidden transition-all duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-700/60 border border-teal-400/30 flex items-center justify-center text-indigo-200">
            <Activity className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg tracking-wide text-white">
                Suite Tiroides 3D & Ficha TI-RADS
              </h3>
              <span className="bg-teal-500/30 text-indigo-200 border border-teal-400/40 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                Cervical Pro
              </span>
            </div>
            <p className="text-xs text-indigo-200/80">
              Reconstrucción macrotiroides 3D de alta fidelidad, cálculo de estenosis y tabulación de velocidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeInReport(!includeInReport)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              includeInReport
                ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600"
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${includeInReport ? "opacity-100" : "opacity-40"}`} />
            {includeInReport ? "Incluido en PDF" : "Excluido de PDF"}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Territory & Laterality Selection */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Territory Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-teal-600" />
              Tipo de estudio tiroideo
            </label>
            <select
              value={selectedThyroidType}
              onChange={(e) => setSelectedThyroidType(e.target.value as ThyroidStudyType)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="tiroides_b_mode">Tiroides B-mode / nódulos</option>
              <option value="tiroides_doppler">Tiroides + Doppler</option>
              <option value="tiroides_nodos">Tiroides + ganglios cervicales</option>
              <option value="general_thyroid">General / detectar del informe</option>
            </select>
          </div>

          {/* Laterality */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-teal-600" />
              Lateralidad del Estudio
            </label>
            <select
              value={selectedLaterality}
              onChange={(e) => setSelectedLaterality(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="auto">Detección Automática</option>
              <option value="Bilateral">Bilateral (Ambos ejes)</option>
              <option value="Derecha">Unilateral Derecha</option>
              <option value="Izquierda">Unilateral Izquierda</option>
              <option value="Línea media">Línea media / Central</option>
            </select>
          </div>

          {/* Custom Directive Input (+ mandatory Scorecard when available) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Wand2 className="w-3.5 h-3.5 text-teal-600" />
              Directivas clínicas
              {scorecardData?.criteria?.length ? (
                <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-black uppercase tracking-wide">
                  <ShieldCheck className="w-3 h-3" />
                  Scorecard vascular obligatorio
                </span>
              ) : (
                <span className="text-slate-400 font-medium normal-case">(adicionales opcionales)</span>
              )}
            </label>
            <textarea
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="Ej: Destacar placa ulcerada en bulbo derecho..."
              rows={scorecardData?.criteria?.length ? 5 : 2}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none font-mono leading-relaxed"
            />
            {scorecardData?.criteria?.length ? (
              <p className="mt-1 text-[10px] text-teal-700/90">
                Los criterios activos del Scorecard se inyectan siempre como directiva obligatoria (igual que Atlas / Focal 3D).
              </p>
            ) : null}
          </div>
        </div>

        {/* Generate / Regenerate Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            {thyroidData ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Suite Tiroides 3D sincronizada ({thyroidData.panels?.length || 0} paneles generados)
              </span>
            ) : (
              "Presiona Generar para construir los modelos 3D y la tabla velocimétrica"
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{generationStep || "Procesando Suite Tiroides..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{thyroidData ? "Re-generar Suite Tiroides Completa" : "Generar Suite Tiroides 3D con IA"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {isGenerating && (
        <div className="p-12 text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-t-transparent animate-spin"></div>
            <Activity className="absolute inset-0 m-auto w-6 h-6 text-teal-600 animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">{generationStep || "Generando reconstrucción 3D vascular..."}</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Renderizando modelos anatómicos fotorrealistas de los vasos, caracterizando placas y sintetizando índices hemodinámicos.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!isGenerating && thyroidData && (
        <div className="p-5 space-y-6">
          {/* Section: Figure Title */}
          <div className="border border-teal-100 bg-teal-50/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-teal-600 rounded-full"></div>
              <div>
                <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider block">
                  {thyroidData.territoryLabel || "DOPPLER VASCULAR"} • {thyroidData.laterality || "Bilateral"}
                </span>
                <h4 className="text-xs font-bold text-slate-800">
                  {thyroidData.figureTitle || "FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA"}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setIsEditingText(!isEditingText)}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingText ? "Guardar edición" : "Editar textos"}
            </button>
          </div>

          {/* Section: 3D Vascular Panels */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              Reconstrucción Volumétrica 3D de Vasos ({thyroidData.panels?.length || 0} Paneles)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {thyroidData.panels.map((panel, idx) => (
                <div
                  key={panel.id || idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Panel Image Container */}
                  <div className="relative bg-slate-900 aspect-[4/3] group overflow-hidden flex items-center justify-center">
                    {panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.panelTitle}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <Activity className="w-8 h-8 mx-auto mb-1 text-slate-500 opacity-50" />
                        <span className="text-xs">Render no disponible</span>
                      </div>
                    )}

                    {/* Badge */}
                    <div className="absolute top-2 left-2 bg-teal-600 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow">
                      PANEL {panel.panelLetter}
                    </div>

                    {/* Quick Tools Overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm p-1 rounded-lg">
                      <button
                        onClick={() => handleFlipHorizontal(panel.panelLetter)}
                        className={`p-1 rounded text-white hover:bg-white/20 transition-colors ${
                          panel.isCustomFlipped ? "text-amber-400" : ""
                        }`}
                        title="Invertir en espejo (Flip horizontal)"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setZoomPanel(panel)}
                        className="p-1 rounded text-white hover:bg-white/20 transition-colors"
                        title="Ver en pantalla completa"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Regenerating overlay */}
                    {regeneratingPanelLetter === panel.panelLetter && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-teal-400 mb-2" />
                        <span className="text-xs font-semibold">Regenerando modelo 3D...</span>
                      </div>
                    )}
                  </div>

                  {/* Panel Details */}
                  <div className="p-3 space-y-2">
                    <div>
                      {isEditingText ? (
                        <input
                          type="text"
                          value={panel.panelTitle}
                          onChange={(e) => {
                            const updated = thyroidData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, panelTitle: e.target.value } : p
                            );
                            setThyroidData({ ...thyroidData, panels: updated });
                          }}
                          className="w-full text-xs font-bold text-slate-800 border border-slate-300 rounded px-1.5 py-1 mb-1"
                        />
                      ) : (
                        <h5 className="font-bold text-xs text-slate-900 line-clamp-2">
                          {panel.panelTitle}
                        </h5>
                      )}

                      {isEditingText ? (
                        <textarea
                          rows={3}
                          value={panel.anatomicalFocus}
                          onChange={(e) => {
                            const updated = thyroidData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, anatomicalFocus: e.target.value } : p
                            );
                            setThyroidData({ ...thyroidData, panels: updated });
                          }}
                          className="w-full text-[11px] text-slate-600 border border-slate-300 rounded px-1.5 py-1"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-3">
                          {panel.anatomicalFocus}
                        </p>
                      )}
                    </div>

                    {/* Action: Single Panel Regenerate Button */}
                    <div className="pt-2 border-t border-slate-100">
                      {editingPanelLetter === panel.panelLetter ? (
                        <div className="space-y-2 bg-slate-50 p-2 rounded border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-700">
                            Directiva de regeneración quirúrgica:
                          </label>
                          <input
                            type="text"
                            value={panelDirectives[panel.panelLetter] || ""}
                            onChange={(e) =>
                              setPanelDirectives((prev) => ({
                                ...prev,
                                [panel.panelLetter]: e.target.value
                              }))
                            }
                            placeholder="Ej: Mostrar trombo oclusivo más oscuro..."
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingPanelLetter(null)}
                              className="px-2 py-1 text-[10px] text-slate-600 hover:text-slate-800"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleRegenerateSinglePanel(panel)}
                              disabled={regeneratingPanelLetter === panel.panelLetter}
                              className="px-2.5 py-1 text-[10px] bg-teal-600 hover:bg-teal-700 text-white font-bold rounded flex items-center gap-1"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Re-renderizar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPanelLetter(panel.panelLetter)}
                          className="w-full py-1 text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Re-generar este panel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          
          {/* Ficha clínica rica DEBAJO de las imágenes */}
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-slate-950 via-slate-950 to-teal-950/40 p-4 space-y-3 text-slate-100">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-teal-300">Ficha clínica tiroidea</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 rounded-xl border border-teal-800/40 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-teal-300 mb-1">Resumen glandular</p>
                {isEditingText ? (
                  <textarea rows={3} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={thyroidData.glandSummary || ""}
                    onChange={(e) => setThyroidData({ ...thyroidData, glandSummary: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{thyroidData.glandSummary || "Sin resumen glandular."}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 mb-1">Morfología / nódulo dominante</p>
                {isEditingText ? (
                  <textarea rows={5} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={thyroidData.morphologyNotes || ""}
                    onChange={(e) => setThyroidData({ ...thyroidData, morphologyNotes: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{thyroidData.morphologyNotes || "Sin notas morfológicas."}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 mb-1">Ganglios cervicales</p>
                {isEditingText ? (
                  <textarea rows={5} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={thyroidData.nodalStatus || ""}
                    onChange={(e) => setThyroidData({ ...thyroidData, nodalStatus: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{thyroidData.nodalStatus || "Sin descripción ganglionar."}</p>
                )}
              </div>
              <div className="md:col-span-2 rounded-xl border border-emerald-800/40 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-300 mb-1">Puntos clave</p>
                {isEditingText ? (
                  <textarea rows={4} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={(thyroidData.keyPoints || []).join("\n")}
                    onChange={(e) => setThyroidData({ ...thyroidData, keyPoints: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                    placeholder="Un punto por línea" />
                ) : (
                  <ul className="space-y-1.5">
                    {(thyroidData.keyPoints || []).length ? thyroidData.keyPoints!.map((kp, i) => (
                      <li key={i} className="text-[13px] text-slate-200 flex gap-2"><span className="text-emerald-400">•</span><span>{kp}</span></li>
                    )) : <li className="text-[13px] text-slate-400">Sin puntos clave.</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Section: Tailored Hemodynamic Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-teal-600" />
                {thyroidData.tableTitle || "TABLA TI-RADS Y CARACTERIZACIÓN DE LESIONES:"}
              </h4>
              <button
                onClick={handleAddTableRow}
                className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Fila
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col1 || "LOCALIZACIÓN"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col2 || "COMPOSICIÓN"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col3 || "TAMAÑO"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col4 || "ECOGENICIDAD"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col5 || "MÁRGENES"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col6 || "FOCOS"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col7 || "TI-RADS"}</th>
                    <th className="py-2.5 px-3">{thyroidData.tableHeaders?.col8 || "IMPACTO"}</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {thyroidData.noduleTable.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.location}
                            onChange={(e) => handleUpdateTableRow(idx, "location", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.location
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.composition}
                            onChange={(e) => handleUpdateTableRow(idx, "composition", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.composition
                        )}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.size}
                            onChange={(e) => handleUpdateTableRow(idx, "size", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          <span
                            className={
                              row.size.includes(">") || row.size.includes("70")
                                ? "text-red-600 font-bold"
                                : row.size.includes("50") || row.size.includes("< 50")
                                ? "text-amber-600 font-bold"
                                : "text-emerald-700 font-semibold"
                            }
                          >
                            {row.size}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.echogenicity}
                            onChange={(e) => handleUpdateTableRow(idx, "echogenicity", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.echogenicity
                        )}
                      </td>
                      <td className="py-2 px-3 text-cyan-700 font-semibold">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.margins}
                            onChange={(e) => handleUpdateTableRow(idx, "margins", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.margins
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {isEditingText ? (
                          <input type="text" value={row.echogenicFoci || ""} onChange={(e) => handleUpdateTableRow(idx, "echogenicFoci", e.target.value)} className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5" />
                        ) : (row.echogenicFoci || "—")}
                      </td>
                      <td className="py-2 px-3 font-bold text-teal-800">
                        {isEditingText ? (
                          <input type="text" value={row.tiradsCategory || ""} onChange={(e) => handleUpdateTableRow(idx, "tiradsCategory", e.target.value)} className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5" />
                        ) : (row.tiradsCategory || "—")}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.clinicalImpact}
                            onChange={(e) => handleUpdateTableRow(idx, "clinicalImpact", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.clinicalImpact
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDeleteTableRow(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Morphological & Hemodynamic Synthesis */}
          <div className="bg-rose-50/70 border-l-4 border-rose-600 rounded-r-lg p-4 space-y-1.5">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              {thyroidData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y TI-RADS:"}
            </h4>
            {isEditingText ? (
              <textarea
                rows={3}
                value={thyroidData.morphologicalSynthesis || ""}
                onChange={(e) =>
                  setThyroidData({ ...thyroidData, morphologicalSynthesis: e.target.value })
                }
                className="w-full text-xs text-slate-800 border border-rose-300 rounded p-2 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                {thyroidData.morphologicalSynthesis}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal Zoom for 3D Panel */}
      {zoomPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomPanel(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] bg-black">
              <img
                src={zoomPanel.imageUrl}
                alt={zoomPanel.panelTitle}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setZoomPanel(null)}
                className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-teal-400 uppercase">
                  PANEL {zoomPanel.panelLetter}
                </span>
                <h3 className="text-sm font-bold text-white">{zoomPanel.panelTitle}</h3>
                <p className="text-xs text-slate-300 mt-1">{zoomPanel.anatomicalFocus}</p>
              </div>
              <button
                onClick={() => handleFlipHorizontal(zoomPanel.panelLetter)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                <FlipHorizontal className="w-4 h-4" />
                {zoomPanel.isCustomFlipped ? "Restaurar vista original" : "Invertir en espejo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
