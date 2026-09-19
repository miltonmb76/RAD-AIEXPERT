import React, { useState } from "react";
import { 
  Activity, 
  Sparkles, 
  Loader2, 
  Check, 
  RefreshCw, 
  X, 
  Layers, 
  Trash2, 
  Maximize2,
  Wand2,
  FlipHorizontal,
  Edit3,
  Compass,
  Plus,
  Heart,
  Gauge,
  ShieldCheck
} from "lucide-react";
import {
  Knee3DData,
  Knee3DPanel,
  KneeFindingRow,
  KneeStudyType,
  ClinicalScorecardData
} from "../types";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { buildKneeDirectivesFromScorecard, KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE } from "../lib/clinicalIntelligence";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";

interface Knee3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  kneeData: Knee3DData | null;
  setKneeData: (data: Knee3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

export const Knee3DModule: React.FC<Knee3DModuleProps> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  kneeData,
  setKneeData,
  includeInReport,
  setIncludeInReport,
  onClose,
  scorecardData,
  externalDirectives
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<Knee3DPanel | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [customDirectives, setCustomDirectives] = useState<string>("");

  React.useEffect(() => {
    if (externalDirectives && externalDirectives.trim()) {
      setCustomDirectives((prev) => {
        if (
          prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
          prev.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA")
        ) {
          return externalDirectives.trim();
        }
        if (!prev.trim()) return externalDirectives.trim();
        return prev;
      });
    }
  }, [externalDirectives]);

  React.useEffect(() => {
    const fromScorecard = buildKneeDirectivesFromScorecard(scorecardData || null);
    if (!fromScorecard) return;
    setCustomDirectives((prev) => {
      if (
        !prev.trim() ||
        prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD") ||
        prev.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA")
      ) {
        return fromScorecard;
      }
      return prev;
    });
  }, [scorecardData]);

  const mergeMandatoryDirectives = (extraPanelDirective?: string) => {
    const scorecardDirectives = buildKneeDirectivesFromScorecard(scorecardData || null);
    const userExtra = customDirectives.trim();
    const extraIsScorecardEcho =
      !!scorecardDirectives &&
      !!userExtra &&
      (userExtra === scorecardDirectives ||
        userExtra.includes("DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA") ||
        userExtra.includes("PATOLOGÍA ACTIVA DEL SCORECARD"));
    return [
      KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
      scorecardDirectives,
      extraIsScorecardEcho ? "" : userExtra,
      (extraPanelDirective || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  };
  
  const [selectedKneeType, setSelectedKneeType] = useState<KneeStudyType>(() => {
    const text = ((reportText || "") + " " + (activeProtocol || "")).toLowerCase();
    if (text.includes("menisc") || text.includes("ligamento") || text.includes("lca") || text.includes("lcm") || text.includes("lcl") || text.includes("baker")) return "rodilla_ligamentos";
    if (text.includes("doppler")) return "rodilla_doppler";
    if (text.includes("rodilla") || text.includes("knee")) return "rodilla_b_mode";
    return "general_knee";
  });

  const [selectedLaterality, setSelectedLaterality] = useState<string>(() => {
    if (laterality && laterality.trim()) return laterality.trim();
    return "auto";
  });

  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<{ [letter: string]: string }>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!reportText || !reportText.trim()) {
      setErrorMessage("No hay informe disponible para procesar la suite de rodilla.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Analizando ligamentos y meniscos y estructuras periarticulares...");

    try {
      setGenerationStep("Construyendo paneles 3D y ficha de los ligamentos/meniscos...");

      const mergedDirectives = mergeMandatoryDirectives();

      await runBackgroundTask("knee-3d", "Generando Suite Rodilla 3D", async () => {
        const response = await fetch("/api/generate-3d-knee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            kneeType: selectedKneeType,
            laterality: selectedLaterality !== "auto" ? selectedLaterality : undefined,
            customDirectives: mergedDirectives || undefined,
            requestedModel: selectedModel
          })
        });

        const resData = await response.json();
        if (!resData.success) {
          throw new Error(resData.error || "Error al generar la Suite Rodilla 3D.");
        }

        setKneeData(resData.data);
        setIncludeInReport(true);
      });
      setGenerationStep("");
    } catch (err: any) {
      console.error("Error generando Suite Rodilla 3D:", err);
      setErrorMessage(err.message || "Error al procesar la Suite Rodilla.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleFlipHorizontal = async (panelLetter: string) => {
    if (!kneeData) return;
    const panel = kneeData.panels.find((p) => p.panelLetter === panelLetter);
    if (!panel?.imageUrl) return;
    try {
      const flippedDataUrl = await flipImageDataUrl(panel.imageUrl);
      const updatedPanels = kneeData.panels.map((p) => {
        if (p.panelLetter !== panelLetter) return p;
        return {
          ...p,
          imageUrl: flippedDataUrl,
          isCustomFlipped: !p.isCustomFlipped,
          laterality: swapLateralityLabel(p.laterality) || p.laterality,
        };
      });
      setKneeData({
        ...kneeData,
        panels: updatedPanels,
      });
      if (zoomPanel?.panelLetter === panelLetter) {
        const updated = updatedPanels.find((p) => p.panelLetter === panelLetter);
        if (updated) setZoomPanel(updated);
      }
    } catch (flipErr) {
      console.error("Error al voltear panel rodilla:", flipErr);
      setErrorMessage("No se pudo voltear la imagen en espejo.");
    }
  };


  const handleDeleteSinglePanel = (panelLetter: string) => {
    if (!kneeData || kneeData.panels.length <= 1) return;

    const remainingPanels = kneeData.panels.filter((p) => p.panelLetter !== panelLetter);
    const alphabet = ["A", "B", "C", "D", "E", "F"];
    const letterMap: Record<string, string> = {};

    const updatedPanels = remainingPanels.map((p, idx) => {
      const newLetter = alphabet[idx] || String.fromCharCode(65 + idx);
      letterMap[p.panelLetter] = newLetter;
      return {
        ...p,
        panelLetter: newLetter
      };
    });

    let updatedTitle = kneeData.figureTitle;
    if (updatedTitle) {
      if (updatedPanels.length === 1) {
        updatedTitle = updatedTitle
          .replace(/Paneles\s+A\s*(?:y|,)\s*B/gi, "Panel A")
          .replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Panel A")
          .replace(/\bPaneles\b/gi, "Panel");
      } else if (updatedPanels.length === 2) {
        updatedTitle = updatedTitle.replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Paneles A y B");
      }
    }

    setPanelDirectives((prev) => {
      const next: Record<string, string> = {};
      for (const letter of Object.keys(prev)) {
        if (letter === panelLetter) continue;
        const mapped = letterMap[letter] || letter;
        next[mapped] = prev[letter];
      }
      return next;
    });
    if (editingPanelLetter === panelLetter) {
      setEditingPanelLetter(null);
    } else if (editingPanelLetter && letterMap[editingPanelLetter]) {
      setEditingPanelLetter(letterMap[editingPanelLetter]);
    }
    if (regeneratingPanelLetter === panelLetter) {
      setRegeneratingPanelLetter(null);
    } else if (regeneratingPanelLetter && letterMap[regeneratingPanelLetter]) {
      setRegeneratingPanelLetter(letterMap[regeneratingPanelLetter]);
    }
    if (zoomPanel?.panelLetter === panelLetter) {
      setZoomPanel(null);
    } else if (zoomPanel && letterMap[zoomPanel.panelLetter]) {
      const remapped = updatedPanels.find((p) => p.panelLetter === letterMap[zoomPanel.panelLetter]);
      if (remapped) setZoomPanel(remapped);
    }

    setKneeData({
      ...kneeData,
      figureTitle: updatedTitle,
      panels: updatedPanels
    });
  };

  const handleRegenerateSinglePanel = async (panel: Knee3DPanel) => {
    if (!kneeData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);

    const directive = panelDirectives[panel.panelLetter] || "";
    const mergedDirectives = mergeMandatoryDirectives(directive);

    try {
      const response = await fetch("/api/regenerate-3d-knee-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          kneeType: selectedKneeType,
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

      const updatedPanels = kneeData.panels.map((p) =>
        p.panelLetter === panel.panelLetter ? resData.panel : p
      );

      setKneeData({
        ...kneeData,
        panels: updatedPanels
      });

      setEditingPanelLetter(null);
      setPanelDirectives((prev) => ({ ...prev, [panel.panelLetter]: "" }));
    } catch (err: any) {
      console.error("Error regenerando panel rodilla:", err);
      setErrorMessage(err.message || "Error al regenerar panel.");
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  const handleAddTableRow = () => {
    if (!kneeData) return;
    const newRow: KneeFindingRow = {
      location: "Rodilla",
      structure: "Menisco medial",
      thicknessOrGap: "—",
      echoPattern: "Patrón fibrilar",
      effusionStatus: "Sin distensión",
      dynamicFinding: "Sin estrés en valgo/varo",
      severity: "Leve",
      clinicalImpact: "Seguimiento clínico"
    };
    setKneeData({
      ...kneeData,
      findingTable: [...(kneeData.findingTable || []), newRow]
    });
  };

  const handleDeleteTableRow = (idx: number) => {
    if (!kneeData) return;
    const updated = [...(kneeData.findingTable || [])];
    updated.splice(idx, 1);
    setKneeData({
      ...kneeData,
      findingTable: updated
    });
  };

  const handleUpdateTableRow = (idx: number, field: keyof KneeFindingRow, value: string) => {
    if (!kneeData) return;
    const updated = [...(kneeData.findingTable || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setKneeData({
      ...kneeData,
      findingTable: updated
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-sky-100 overflow-hidden transition-all duration-300">
      <div className="bg-gradient-to-r from-sky-900 via-cyan-800 to-slate-900 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-700/60 border border-sky-400/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-sky-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg tracking-wide text-white">
                Suite Rodilla 3D & Ficha Ligamentos-Meniscos
              </h3>
              <span className="bg-sky-500/30 text-sky-100 border border-sky-400/40 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                MSK Pro
              </span>
            </div>
            <p className="text-xs text-sky-100/80">
              Reconstrucción 3D de los ligamentos/meniscos, ligamento patelar, derrame y correlación dinámico-funcional
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

      <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-sky-600" />
              Tipo de estudio de rodilla
            </label>
            <select
              value={selectedKneeType}
              onChange={(e) => setSelectedKneeType(e.target.value as KneeStudyType)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none"
            >
              <option value="rodilla_b_mode">Rodilla B-mode</option>
              <option value="rodilla_doppler">Rodilla + Doppler</option>
              <option value="rodilla_ligamentos">Ligamentos y meniscos / ligamento patelar</option>
              <option value="general_knee">General / detectar del informe</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              Lateralidad del Estudio
            </label>
            <select
              value={selectedLaterality}
              onChange={(e) => setSelectedLaterality(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none"
            >
              <option value="auto">Detección Automática</option>
              <option value="Bilateral">Bilateral</option>
              <option value="Derecha">Unilateral Derecha</option>
              <option value="Izquierda">Unilateral Izquierda</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Wand2 className="w-3.5 h-3.5 text-sky-600" />
              Directivas clínicas
              {scorecardData?.criteria?.length ? (
                <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black uppercase tracking-wide">
                  <ShieldCheck className="w-3 h-3" />
                  Scorecard rodilla obligatorio
                </span>
              ) : (
                <span className="text-slate-400 font-medium normal-case">(adicionales opcionales)</span>
              )}
            </label>
            <textarea
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="Ej: Menisco EXTERNO (peroné) cuerno POSTERIOR derecho — no confundir con medial/anterior..."
              rows={scorecardData?.criteria?.length ? 5 : 2}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-sky-500 focus:outline-none font-mono leading-relaxed"
            />
            {scorecardData?.criteria?.length ? (
              <p className="mt-1 text-[10px] text-sky-800/90">
                Los criterios activos del Scorecard (y radar ligamentos-meniscos si aplica) se inyectan como directiva obligatoria.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            {kneeData ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Suite Rodilla 3D sincronizada ({kneeData.panels?.length || 0} paneles generados)
              </span>
            ) : (
              "Presiona Generar para construir los modelos 3D y la tabla de los ligamentos/meniscos"
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 text-white rounded-lg text-xs font-bold shadow-md shadow-sky-200 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{generationStep || "Procesando Suite Rodilla..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-sky-100" />
                <span>{kneeData ? "Re-generar Suite Rodilla Completa" : "Generar Suite Rodilla 3D con IA"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="p-12 text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-sky-200 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin"></div>
            <Activity className="absolute inset-0 m-auto w-6 h-6 text-sky-600 animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">{generationStep || "Generando reconstrucción 3D de rodilla..."}</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Renderizando anatomía de los ligamentos/meniscos, derrame y correlación dinámico-funcional.
            </p>
          </div>
        </div>
      )}

      {!isGenerating && kneeData && (
        <div className="p-5 space-y-6">
          <div className="border border-sky-100 bg-sky-50/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-sky-600 rounded-full"></div>
              <div>
                <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider block">
                  {kneeData.territoryLabel || "ECOGRAFÍA DE RODILLA"} • {kneeData.laterality || "—"}
                </span>
                <h4 className="text-xs font-bold text-slate-800">
                  {kneeData.figureTitle || "FIGURA 1. ATLAS 3D RODILLA Y CORRELACIÓN LIGAMENTOS Y MENISCOS"}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setIsEditingText(!isEditingText)}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingText ? "Guardar edición" : "Editar textos"}
            </button>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              Reconstrucción Volumétrica 3D del Rodilla ({kneeData.panels?.length || 0} Paneles)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(kneeData.panels || []).map((panel, idx) => (
                <div
                  key={panel.id || idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
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

                    <div className="absolute top-2 left-2 bg-sky-600 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow">
                      PANEL {panel.panelLetter}
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm p-1 rounded-lg">
                      <button
                        onClick={() => handleFlipHorizontal(panel.panelLetter)}
                        className={`p-1 rounded text-white hover:bg-white/20 transition-colors ${
                          panel.isCustomFlipped ? "text-sky-300" : ""
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
                      {kneeData.panels.length > 1 && (
                        <button
                          onClick={() => handleDeleteSinglePanel(panel.panelLetter)}
                          className="p-1 rounded text-white hover:bg-rose-500/40 transition-colors"
                          title="Eliminar este panel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {regeneratingPanelLetter === panel.panelLetter && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400 mb-2" />
                        <span className="text-xs font-semibold">Regenerando modelo 3D...</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div>
                      {isEditingText ? (
                        <input
                          type="text"
                          value={panel.panelTitle}
                          onChange={(e) => {
                            const updated = kneeData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, panelTitle: e.target.value } : p
                            );
                            setKneeData({ ...kneeData, panels: updated });
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
                            const updated = kneeData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, anatomicalFocus: e.target.value } : p
                            );
                            setKneeData({ ...kneeData, panels: updated });
                          }}
                          className="w-full text-[11px] text-slate-600 border border-slate-300 rounded px-1.5 py-1"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-3">
                          {panel.anatomicalFocus}
                        </p>
                      )}
                    </div>

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
                            placeholder="Ej: Menisco LATERAL/peroné, cuerno POSTERIOR — mantener lado y A/P exactos..."
                            className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded px-2 py-1"
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
                              className="px-2.5 py-1 text-[10px] bg-sky-600 hover:bg-sky-700 text-white font-bold rounded flex items-center gap-1"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Re-renderizar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPanelLetter(panel.panelLetter)}
                          className="w-full py-1 text-[10px] text-sky-800 bg-sky-50 hover:bg-sky-100 font-semibold rounded flex items-center justify-center gap-1 transition-colors"
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

          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-slate-950 via-slate-950 to-sky-950/40 p-4 space-y-5 text-slate-100">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-sky-300">Ficha clínica rodilla / ligamentos-meniscos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 rounded-xl border border-sky-800/40 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-sky-300 mb-2">Resumen del rodilla</p>
                {isEditingText ? (
                  <textarea rows={3} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={kneeData.kneeSummary || ""}
                    onChange={(e) => setKneeData({ ...kneeData, kneeSummary: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{kneeData.kneeSummary || "Sin resumen del rodilla."}</p>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 mb-2">Morfología / tendón dominante</p>
                {isEditingText ? (
                  <textarea rows={5} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={kneeData.morphologyNotes || ""}
                    onChange={(e) => setKneeData({ ...kneeData, morphologyNotes: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{kneeData.morphologyNotes || "Sin notas morfológicas."}</p>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-yellow-300 mb-2">Estado de los ligamentos/meniscos</p>
                {isEditingText ? (
                  <textarea rows={5} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={kneeData.ligamentMeniscusStatus || ""}
                    onChange={(e) => setKneeData({ ...kneeData, ligamentMeniscusStatus: e.target.value })} />
                ) : (
                  <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{kneeData.ligamentMeniscusStatus || "Sin descripción de los ligamentos/meniscos."}</p>
                )}
              </div>
              <div className="md:col-span-2 rounded-xl border border-emerald-800/40 bg-slate-950/70 p-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-300 mb-2">Puntos clave</p>
                {isEditingText ? (
                  <textarea rows={4} className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                    value={(kneeData.keyPoints || []).join("\n")}
                    onChange={(e) => setKneeData({ ...kneeData, keyPoints: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                    placeholder="Un punto por línea" />
                ) : (
                  <ul className="space-y-1.5">
                    {(kneeData.keyPoints || []).length ? kneeData.keyPoints!.map((kp, i) => (
                      <li key={i} className="text-[13px] text-slate-200 flex gap-2"><span className="text-emerald-400">•</span><span>{kp}</span></li>
                    )) : <li className="text-[13px] text-slate-400">Sin puntos clave.</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-600" />
                {kneeData.tableTitle || "TABLA ECOGRÁFICA DEL LIGAMENTOS Y MENISCOS:"}
              </h4>
              <button
                onClick={handleAddTableRow}
                className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Fila
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col1 || "LOCALIZACIÓN"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col2 || "ESTRUCTURA"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col3 || "GROSOR / GAP"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col4 || "PATRÓN ECO"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col5 || "DERRAME"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col6 || "DINÁMICA"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col7 || "SEVERIDAD"}</th>
                    <th className="py-2.5 px-3">{kneeData.tableHeaders?.col8 || "IMPACTO"}</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(kneeData.findingTable || []).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      {([
                        ["location", row.location],
                        ["structure", row.structure],
                        ["thicknessOrGap", row.thicknessOrGap],
                        ["echoPattern", row.echoPattern],
                        ["effusionStatus", row.effusionStatus],
                        ["dynamicFinding", row.dynamicFinding],
                        ["severity", row.severity],
                        ["clinicalImpact", row.clinicalImpact],
                      ] as Array<[keyof KneeFindingRow, string]>).map(([field, val]) => (
                        <td key={field} className={`py-2 px-3 ${field === "location" || field === "structure" ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                          {isEditingText ? (
                            <input
                              type="text"
                              value={val || ""}
                              onChange={(e) => handleUpdateTableRow(idx, field, e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                            />
                          ) : (
                            val || "—"
                          )}
                        </td>
                      ))}
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

          <div className="bg-cyan-50/70 border-l-4 border-sky-600 rounded-r-lg p-4 space-y-1.5">
            <h4 className="text-xs font-bold text-sky-800 uppercase tracking-wider">
              {kneeData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y FUNCIONAL DEL RODILLA:"}
            </h4>
            {isEditingText ? (
              <textarea
                rows={3}
                value={kneeData.morphologicalSynthesis || ""}
                onChange={(e) =>
                  setKneeData({ ...kneeData, morphologicalSynthesis: e.target.value })
                }
                className="w-full text-xs text-slate-800 border border-sky-300 rounded p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                {kneeData.morphologicalSynthesis}
              </p>
            )}
          </div>
        </div>
      )}

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
                <span className="text-xs font-bold text-sky-400 uppercase">
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
