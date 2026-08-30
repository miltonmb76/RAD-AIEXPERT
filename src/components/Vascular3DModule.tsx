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
  Gauge
} from "lucide-react";
import { Vascular3DData, Vascular3DPanel, VascularHemodynamicRow, VascularStudyType } from "../types";

interface Vascular3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  vascularData: Vascular3DData | null;
  setVascularData: (data: Vascular3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
}

export const Vascular3DModule: React.FC<Vascular3DModuleProps> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  vascularData,
  setVascularData,
  includeInReport,
  setIncludeInReport,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<Vascular3DPanel | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [customDirectives, setCustomDirectives] = useState<string>("");
  
  // Selected vascular territory
  const [selectedVascularType, setSelectedVascularType] = useState<VascularStudyType>(() => {
    const text = (reportText || "").toLowerCase() + " " + (activeProtocol || "").toLowerCase();
    if (text.includes("carot") || text.includes("vertebr")) return "carotideo_vertebral";
    if (text.includes("venos") || text.includes("trombosis") || text.includes("safena") || text.includes("tvp")) return "venoso_mmii";
    if (text.includes("arterial") || text.includes("femoral") || text.includes("poplit") || text.includes("tibial")) return "arterial_mmii";
    if (text.includes("renal") || text.includes("renales")) return "arterias_renales";
    if (text.includes("aort") || text.includes("iliac")) return "aorto_iliaco";
    return "carotideo_vertebral";
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
      setErrorMessage("No hay informe disponible para procesar el mapa vascular.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Analizando parámetros velocimétricos y territorio vascular...");

    try {
      setGenerationStep("Construyendo matriz hemodinámica y prompts macro-vasculares 3D...");

      const response = await fetch("/api/generate-3d-vascular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          vascularType: selectedVascularType,
          laterality: selectedLaterality !== "auto" ? selectedLaterality : undefined,
          customDirectives: customDirectives.trim() ? customDirectives.trim() : undefined,
          requestedModel: selectedModel
        })
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || "Error al generar la Suite Vascular 3D.");
      }

      setVascularData(resData.data);
      setIncludeInReport(true);
      setGenerationStep("");
    } catch (err: any) {
      console.error("Error generando Suite Vascular 3D:", err);
      setErrorMessage(err.message || "Error al procesar la Suite Vascular.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Flip horizontal (Mirror image)
  const handleFlipHorizontal = (panelLetter: string) => {
    if (!vascularData) return;
    const updatedPanels = vascularData.panels.map((p) => {
      if (p.panelLetter === panelLetter) {
        const currentFlipped = p.isCustomFlipped || false;
        return {
          ...p,
          isCustomFlipped: !currentFlipped
        };
      }
      return p;
    });
    setVascularData({
      ...vascularData,
      panels: updatedPanels
    });
  };

  // Single panel regeneration
  const handleRegenerateSinglePanel = async (panel: Vascular3DPanel) => {
    if (!vascularData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);

    const directive = panelDirectives[panel.panelLetter] || "";

    try {
      const response = await fetch("/api/regenerate-3d-vascular-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          vascularType: selectedVascularType,
          panel,
          laterality: panel.laterality,
          userDirective: directive,
          requestedModel: selectedModel
        })
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || `Error al regenerar panel ${panel.panelLetter}`);
      }

      const updatedPanels = vascularData.panels.map((p) =>
        p.panelLetter === panel.panelLetter ? resData.panel : p
      );

      setVascularData({
        ...vascularData,
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
    if (!vascularData) return;
    const newRow: VascularHemodynamicRow = {
      vessel: "Nuevo Segmento Vascular",
      plaqueOrThrombus: "Morfología evaluada",
      stenosisPercent: "0%",
      patternOrVelocity: "Laminar normal",
      hemodynamicIndex: "Normal",
      clinicalImpact: "Sin repercusión"
    };
    setVascularData({
      ...vascularData,
      hemodynamicTable: [...vascularData.hemodynamicTable, newRow]
    });
  };

  // Delete row from hemodynamic table
  const handleDeleteTableRow = (idx: number) => {
    if (!vascularData) return;
    const updated = [...vascularData.hemodynamicTable];
    updated.splice(idx, 1);
    setVascularData({
      ...vascularData,
      hemodynamicTable: updated
    });
  };

  // Update row
  const handleUpdateTableRow = (idx: number, field: keyof VascularHemodynamicRow, value: string) => {
    if (!vascularData) return;
    const updated = [...vascularData.hemodynamicTable];
    updated[idx] = { ...updated[idx], [field]: value };
    setVascularData({
      ...vascularData,
      hemodynamicTable: updated
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden transition-all duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-700/60 border border-indigo-400/30 flex items-center justify-center text-indigo-200">
            <Activity className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg tracking-wide text-white">
                Suite Vascular 3D & Mapa Ánatomo-Hemodinámico
              </h3>
              <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                Doppler Pro
              </span>
            </div>
            <p className="text-xs text-indigo-200/80">
              Reconstrucción macrovascular 3D de alta fidelidad, cálculo de estenosis y tabulación de velocidades
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
              <Heart className="w-3.5 h-3.5 text-indigo-600" />
              Territorio Vascular
            </label>
            <select
              value={selectedVascularType}
              onChange={(e) => setSelectedVascularType(e.target.value as VascularStudyType)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="carotideo_vertebral">Doppler Carotídeo y Vertebral</option>
              <option value="arterial_mmii">Doppler Arterial Miembro Inferior</option>
              <option value="venoso_mmii">Doppler Venoso Miembro Inferior</option>
              <option value="arterias_renales">Doppler de Arterias Renales</option>
              <option value="aorto_iliaco">Doppler Aorto-Ilíaco</option>
              <option value="general_vascular">General / Detectar del Informe</option>
            </select>
          </div>

          {/* Laterality */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              Lateralidad del Estudio
            </label>
            <select
              value={selectedLaterality}
              onChange={(e) => setSelectedLaterality(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="auto">Detección Automática</option>
              <option value="Bilateral">Bilateral (Ambos ejes)</option>
              <option value="Derecha">Unilateral Derecha</option>
              <option value="Izquierda">Unilateral Izquierda</option>
              <option value="Línea media">Línea media / Central</option>
            </select>
          </div>

          {/* Custom Directive Input */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
              Directivas Clínicas Adicionales (Opcional)
            </label>
            <input
              type="text"
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="Ej: Destacar placa ulcerada en bulbo derecho..."
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Generate / Regenerate Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            {vascularData ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Suite Vascular 3D sincronizada ({vascularData.panels?.length || 0} paneles generados)
              </span>
            ) : (
              "Presiona Generar para construir los modelos 3D y la tabla velocimétrica"
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{generationStep || "Procesando Suite Vascular..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{vascularData ? "Re-generar Suite Vascular Completa" : "Generar Suite Vascular 3D con IA"}</span>
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
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
            <Activity className="absolute inset-0 m-auto w-6 h-6 text-indigo-600 animate-bounce" />
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
      {!isGenerating && vascularData && (
        <div className="p-5 space-y-6">
          {/* Section: Figure Title */}
          <div className="border border-indigo-100 bg-indigo-50/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
              <div>
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                  {vascularData.territoryLabel || "DOPPLER VASCULAR"} • {vascularData.laterality || "Bilateral"}
                </span>
                <h4 className="text-xs font-bold text-slate-800">
                  {vascularData.figureTitle || "FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA"}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setIsEditingText(!isEditingText)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingText ? "Guardar edición" : "Editar textos"}
            </button>
          </div>

          {/* Section: 3D Vascular Panels */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Reconstrucción Volumétrica 3D de Vasos ({vascularData.panels?.length || 0} Paneles)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vascularData.panels.map((panel, idx) => (
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
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                          panel.isCustomFlipped ? "scale-x-[-1]" : ""
                        }`}
                      />
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <Activity className="w-8 h-8 mx-auto mb-1 text-slate-500 opacity-50" />
                        <span className="text-xs">Render no disponible</span>
                      </div>
                    )}

                    {/* Badge */}
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow">
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
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                        <span className="text-xs font-semibold">Regenerando modelo 3D...</span>
                      </div>
                    )}
                  </div>

                  {/* Panel Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      {isEditingText ? (
                        <input
                          type="text"
                          value={panel.panelTitle}
                          onChange={(e) => {
                            const updated = vascularData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, panelTitle: e.target.value } : p
                            );
                            setVascularData({ ...vascularData, panels: updated });
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
                            const updated = vascularData.panels.map((p) =>
                              p.panelLetter === panel.panelLetter ? { ...p, anatomicalFocus: e.target.value } : p
                            );
                            setVascularData({ ...vascularData, panels: updated });
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
                              className="px-2.5 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded flex items-center gap-1"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Re-renderizar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPanelLetter(panel.panelLetter)}
                          className="w-full py-1 text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold rounded flex items-center justify-center gap-1 transition-colors"
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

          {/* Section: Tailored Hemodynamic Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                {vascularData.tableTitle || "TABLA HEMODINÁMICA Y CARACTERIZACIÓN DE LESIONES:"}
              </h4>
              <button
                onClick={handleAddTableRow}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Fila
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col1 || "VASO / SEGMENTO"}</th>
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col2 || "PLACA / TROMBO"}</th>
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col3 || "% ESTENOSIS"}</th>
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col4 || "PATRÓN (PSV/EDV)"}</th>
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col5 || "REL. / ÍNDICE"}</th>
                    <th className="py-2.5 px-3">{vascularData.tableHeaders?.col6 || "IMPACTO HEMODIN."}</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vascularData.hemodynamicTable.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.vessel}
                            onChange={(e) => handleUpdateTableRow(idx, "vessel", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.vessel
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.plaqueOrThrombus}
                            onChange={(e) => handleUpdateTableRow(idx, "plaqueOrThrombus", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.plaqueOrThrombus
                        )}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.stenosisPercent}
                            onChange={(e) => handleUpdateTableRow(idx, "stenosisPercent", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          <span
                            className={
                              row.stenosisPercent.includes(">") || row.stenosisPercent.includes("70")
                                ? "text-red-600 font-bold"
                                : row.stenosisPercent.includes("50") || row.stenosisPercent.includes("< 50")
                                ? "text-amber-600 font-bold"
                                : "text-emerald-700 font-semibold"
                            }
                          >
                            {row.stenosisPercent}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.patternOrVelocity}
                            onChange={(e) => handleUpdateTableRow(idx, "patternOrVelocity", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.patternOrVelocity
                        )}
                      </td>
                      <td className="py-2 px-3 text-cyan-700 font-semibold">
                        {isEditingText ? (
                          <input
                            type="text"
                            value={row.hemodynamicIndex}
                            onChange={(e) => handleUpdateTableRow(idx, "hemodynamicIndex", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5"
                          />
                        ) : (
                          row.hemodynamicIndex
                        )}
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
              {vascularData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:"}
            </h4>
            {isEditingText ? (
              <textarea
                rows={3}
                value={vascularData.morphologicalSynthesis || ""}
                onChange={(e) =>
                  setVascularData({ ...vascularData, morphologicalSynthesis: e.target.value })
                }
                className="w-full text-xs text-slate-800 border border-rose-300 rounded p-2 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                {vascularData.morphologicalSynthesis}
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
                className={`w-full h-full object-contain ${
                  zoomPanel.isCustomFlipped ? "scale-x-[-1]" : ""
                }`}
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
                <span className="text-xs font-bold text-indigo-400 uppercase">
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
