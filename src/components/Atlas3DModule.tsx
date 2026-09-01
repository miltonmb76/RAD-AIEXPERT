import React, { useState } from "react";
import { 
  Box, 
  Sparkles, 
  Loader2, 
  Check, 
  RefreshCw, 
  X, 
  ZoomIn, 
  Eye, 
  Layers, 
  FileText, 
  Sliders, 
  Trash2, 
  Maximize2,
  Info,
  MessageSquarePlus,
  Wand2,
  FlipHorizontal,
  Edit3,
  Compass,
  ArrowLeftRight,
  ShieldAlert,
  Plus
} from "lucide-react";
import { Atlas3DData, Atlas3DPanel, Atlas3DSynopticItem } from "../types";
import { runBackgroundTask } from "../lib/backgroundTasks";

// Helper to extract uppercase panel letters referenced in a string (e.g. "(Panel A)" -> ["A"], "Paneles A y B" -> ["A", "B"])
const extractReferencedLetters = (panelRef?: string): string[] => {
  if (!panelRef) return [];
  const text = panelRef.toUpperCase();
  const letters: string[] = [];
  const regex = /\b([A-E])\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!letters.includes(match[1])) {
      letters.push(match[1]);
    }
  }
  return letters;
};

// Helper to format panel letters back into a standardized reference string
const formatPanelRef = (letters: string[]): string => {
  if (letters.length === 0) return "";
  if (letters.length === 1) return `(Panel ${letters[0]})`;
  if (letters.length === 2) return `(Paneles ${letters[0]} y ${letters[1]})`;
  return `(Paneles ${letters.slice(0, -1).join(", ")} y ${letters[letters.length - 1]})`;
};

interface Atlas3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  atlasData: Atlas3DData | null;
  setAtlasData: (data: Atlas3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
}

export const Atlas3DModule: React.FC<Atlas3DModuleProps> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  atlasData,
  setAtlasData,
  includeInReport,
  setIncludeInReport,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<Atlas3DPanel | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [customDirectives, setCustomDirectives] = useState<string>("");
  const [selectedLaterality, setSelectedLaterality] = useState<string>(() => {
    if (laterality && laterality.trim()) return laterality.trim();
    return "auto";
  });

  // Single panel regeneration state
  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<{ [letter: string]: string }>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);
  const [editingFocusLetter, setEditingFocusLetter] = useState<string | null>(null);

  // Helper to determine anatomical canvas orientation guide (compass)
  const getCompassInfo = (panel: Atlas3DPanel) => {
    const fullText = `${atlasData?.studyRegion || ""} ${activeProtocol || ""} ${panel.panelTitle || ""} ${panel.anatomicalFocus || ""} ${panel.laterality || selectedLaterality || ""}`.toLowerCase();
    
    const isLeft = (panel.laterality || selectedLaterality).toLowerCase().includes("izq") ||
                   (panel.laterality || selectedLaterality).toLowerCase().includes("left") ||
                   fullText.includes("izquierda") || fullText.includes("izquierdo") || fullText.includes("left");

    if (fullText.includes("rodilla") || fullText.includes("knee") || fullText.includes("menisc")) {
      if (isLeft) {
        return {
          side: "RODILLA IZQUIERDA (AP)",
          leftSideTag: "MEDIAL (Menisco Interno / LCM)",
          rightSideTag: "LATERAL (Menisco Externo / Peroné)",
          color: "border-indigo-500/40 text-indigo-300"
        };
      } else {
        return {
          side: "RODILLA DERECHA (AP)",
          leftSideTag: "LATERAL (Menisco Externo / Peroné)",
          rightSideTag: "MEDIAL (Menisco Interno / LCM)",
          color: "border-cyan-500/40 text-cyan-300"
        };
      }
    }

    if (fullText.includes("hombro") || fullText.includes("shoulder") || fullText.includes("manguito") || fullText.includes("supraespinoso")) {
      if (isLeft) {
        return {
          side: "HOMBRO IZQUIERDO (AP)",
          leftSideTag: "MEDIAL (Clavícula / Esternón)",
          rightSideTag: "LATERAL (Cabeza Humeral / Deltoides)",
          color: "border-indigo-500/40 text-indigo-300"
        };
      } else {
        return {
          side: "HOMBRO DERECHO (AP)",
          leftSideTag: "LATERAL (Cabeza Humeral / Deltoides)",
          rightSideTag: "MEDIAL (Clavícula / Esternón)",
          color: "border-cyan-500/40 text-cyan-300"
        };
      }
    }

    if (fullText.includes("mama") || fullText.includes("breast") || fullText.includes("mamari")) {
      if (isLeft) {
        return {
          side: "MAMA IZQUIERDA (Frontal)",
          leftSideTag: "MEDIAL (CSI / CII / Esternón)",
          rightSideTag: "LATERAL (CSE / CIE / Axila)",
          color: "border-pink-500/40 text-pink-300"
        };
      } else {
        return {
          side: "MAMA DERECHA (Frontal)",
          leftSideTag: "LATERAL (CSE / CIE / Axila)",
          rightSideTag: "MEDIAL (CSI / CII / Esternón)",
          color: "border-pink-500/40 text-pink-300"
        };
      }
    }

    if (fullText.includes("tobillo") || fullText.includes("ankle") || fullText.includes("pie")) {
      if (isLeft) {
        return {
          side: "TOBILLO IZQUIERDO (AP)",
          leftSideTag: "MEDIAL (Maleolo Interno)",
          rightSideTag: "LATERAL (Maleolo Peroneo)",
          color: "border-indigo-500/40 text-indigo-300"
        };
      } else {
        return {
          side: "TOBILLO DERECHO (AP)",
          leftSideTag: "LATERAL (Maleolo Peroneo)",
          rightSideTag: "MEDIAL (Maleolo Interno)",
          color: "border-cyan-500/40 text-cyan-300"
        };
      }
    }

    return isLeft 
      ? { side: "LADO IZQUIERDO", leftSideTag: "Lado Medial", rightSideTag: "Lado Lateral", color: "border-indigo-500/30 text-indigo-300" }
      : { side: "LADO DERECHO", leftSideTag: "Lado Lateral", rightSideTag: "Lado Medial", color: "border-cyan-500/30 text-cyan-300" };
  };

  const handleGenerateAtlas = async () => {
    if (!reportText || !reportText.trim()) {
      setErrorMessage("Por favor, redacta o genera primero el informe radiológico para extraer la anatomía y los hallazgos patológicos.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Analizando hallazgos y lateralidad quirúrgica...");

    try {
      setTimeout(() => {
        setGenerationStep("Fijando anclajes espaciales (Spatial Canvas Anchors) y reparos anatómicos...");
      }, 1200);

      setTimeout(() => {
        setGenerationStep("Generando reconstrucciones fotolumínicas 3D hiperrealistas de alta fidelidad...");
      }, 2500);

      const effectiveLaterality = selectedLaterality === "auto" ? (laterality || "") : selectedLaterality;

      await runBackgroundTask("atlas-3d", "Generando Atlas 3D", async () => {
        const response = await fetch("/api/generate-3d-atlas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            organOrStudy: activeProtocol || "",
            laterality: effectiveLaterality,
            requestedModel: selectedModel || "gemini-3.7-flash",
            customDirectives: customDirectives.trim() || undefined
          })
        });

        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error || "No se pudo generar la reconstrucción 3D.");
        }

        setAtlasData(json.data);
        setIncludeInReport(true);
      });
    } catch (err: any) {
      console.error("Error al generar Atlas 3D:", err);
      setErrorMessage(err.message || "Error al generar Atlas 3D.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleRegenerateSinglePanel = async (panel: Atlas3DPanel, explicitDirectiveOverride?: string) => {
    if (!atlasData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);

    const userDirective = explicitDirectiveOverride || panelDirectives[panel.panelLetter] || "";
    const effectiveLaterality = selectedLaterality === "auto" ? (panel.laterality || laterality || "") : selectedLaterality;

    try {
      const response = await fetch("/api/regenerate-3d-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          studyRegion: atlasData.studyRegion,
          panel: panel,
          laterality: effectiveLaterality,
          userDirective: userDirective.trim() || undefined,
          requestedModel: selectedModel || "gemini-3.7-flash"
        })
      });

      const json = await response.json();
      if (!response.ok || !json.success || !json.panel) {
        throw new Error(json.error || `No se pudo regenerar el Panel ${panel.panelLetter}.`);
      }

      const updatedPanels = atlasData.panels.map((p) => 
        p.panelLetter === panel.panelLetter ? json.panel : p
      );

      // Sincronizar automáticamente la estructura en la tabla de correlación si correspondía a este panel
      const updatedSynoptic = (atlasData.synopticExplanation || []).map((item) => {
        const refs = extractReferencedLetters(item.panelRef);
        if (refs.length === 1 && refs[0] === panel.panelLetter && json.panel.anatomicalFocus) {
          return {
            ...item,
            structure: json.panel.anatomicalFocus
          };
        }
        return item;
      });

      setAtlasData({
        ...atlasData,
        panels: updatedPanels,
        synopticExplanation: updatedSynoptic
      });

      // Close edit drawer for this panel
      setEditingPanelLetter(null);
    } catch (err: any) {
      console.error(`Error al regenerar panel ${panel.panelLetter}:`, err);
      setErrorMessage(err.message || `Error al regenerar el Panel ${panel.panelLetter}.`);
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  const handleFlipPanelHorizontal = (panel: Atlas3DPanel) => {
    if (!panel.imageUrl || !atlasData) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const flippedDataUrl = canvas.toDataURL("image/png");

        const updatedPanels = atlasData.panels.map((p) => {
          if (p.panelLetter === panel.panelLetter) {
            return { 
              ...p, 
              imageUrl: flippedDataUrl,
              isCustomFlipped: !p.isCustomFlipped
            };
          }
          return p;
        });

        setAtlasData({
          ...atlasData,
          panels: updatedPanels
        });

        if (zoomPanel && zoomPanel.panelLetter === panel.panelLetter) {
          setZoomPanel({ 
            ...zoomPanel, 
            imageUrl: flippedDataUrl,
            isCustomFlipped: !zoomPanel.isCustomFlipped
          });
        }
      };
      img.src = panel.imageUrl;
    } catch (flipErr) {
      console.error("Error al voltear imagen horizontalmente:", flipErr);
    }
  };

  const handleDeleteSinglePanel = (panelLetter: string) => {
    if (!atlasData || atlasData.panels.length <= 1) return;

    // 1. Filtrar el panel eliminado
    const remainingPanels = atlasData.panels.filter((p) => p.panelLetter !== panelLetter);

    // 2. Re-indexar los paneles restantes de forma secuencial (A, B, C...)
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

    // 3. Sincronizar de inmediato el cuadro de correlación semiológica:
    // - Si un hallazgo describía exclusivamente el panel eliminado, se remueve de inmediato.
    // - Si describía paneles restantes, se actualiza su referencia (panelRef) a la nueva letra consecutiva.
    let updatedSynoptic = (atlasData.synopticExplanation || [])
      .map((item, originalIndex) => {
        let refs = extractReferencedLetters(item.panelRef);

        // Fallback si no tiene letras explícitas: asociar al índice original
        if (refs.length === 0 && atlasData.panels[originalIndex]) {
          refs = [atlasData.panels[originalIndex].panelLetter];
        }

        const referencesDeleted = refs.includes(panelLetter);
        const remainingRefs = refs.filter((l) => l !== panelLetter);

        // Si el hallazgo correspondía únicamente al dibujo que se eliminó, se descarta del cuadro
        if (referencesDeleted && remainingRefs.length === 0) {
          return null;
        }

        // Mapear las referencias restantes a las nuevas letras secuenciales
        const mappedLetters = remainingRefs
          .map((l) => letterMap[l])
          .filter(Boolean);

        let newPanelRef = item.panelRef;
        if (mappedLetters.length > 0) {
          newPanelRef = formatPanelRef(mappedLetters);
        } else if (updatedPanels.length === 1) {
          newPanelRef = "(Panel A)";
        }

        return {
          ...item,
          panelRef: newPanelRef
        };
      })
      .filter((item): item is Atlas3DSynopticItem => item !== null);

    // Si todos los hallazgos correspondían al panel eliminado, generar filas descriptivas para los paneles restantes
    if (updatedSynoptic.length === 0) {
      updatedSynoptic = updatedPanels.map((p) => ({
        structure: p.anatomicalFocus || p.panelTitle || `Estructura (Panel ${p.panelLetter})`,
        panelRef: `(Panel ${p.panelLetter})`,
        findingDetail: `Reconstrucción anatómica tridimensional y correlación semiológica de ${p.panelTitle || p.anatomicalFocus || "la región evaluada"}.`
      }));
    }

    // 4. Actualizar título de la figura si contenía referencias a paneles eliminados
    let updatedTitle = atlasData.figureTitle;
    if (updatedTitle) {
      if (updatedPanels.length === 1) {
        updatedTitle = updatedTitle.replace(/Paneles\s+A\s*(?:y|,)\s*B/gi, "Panel A")
                                   .replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Panel A")
                                   .replace(/\bPaneles\b/gi, "Panel");
      } else if (updatedPanels.length === 2) {
        updatedTitle = updatedTitle.replace(/Paneles\s+A,\s*B\s*y\s*C/gi, "Paneles A y B");
      }
    }

    setAtlasData({
      ...atlasData,
      figureTitle: updatedTitle,
      panels: updatedPanels,
      synopticExplanation: updatedSynoptic
    });
  };

  const handleUpdateFigureTitle = (title: string) => {
    if (!atlasData) return;
    setAtlasData({ ...atlasData, figureTitle: title });
  };

  const handleUpdatePanelFocus = (panelLetter: string, focusText: string) => {
    if (!atlasData) return;
    const updatedPanels = atlasData.panels.map((p) =>
      p.panelLetter === panelLetter ? { ...p, anatomicalFocus: focusText } : p
    );
    // Sincronizar reactivamente el nombre de la estructura en el cuadro de correlación
    const updatedSynoptic = (atlasData.synopticExplanation || []).map((item) => {
      const refs = extractReferencedLetters(item.panelRef);
      if (refs.length === 1 && refs[0] === panelLetter && focusText.trim()) {
        return { ...item, structure: focusText.trim() };
      }
      return item;
    });

    setAtlasData({
      ...atlasData,
      panels: updatedPanels,
      synopticExplanation: updatedSynoptic
    });
    if (zoomPanel && zoomPanel.panelLetter === panelLetter) {
      setZoomPanel({ ...zoomPanel, anatomicalFocus: focusText });
    }
  };

  const handleUpdatePanelTitle = (panelLetter: string, titleText: string) => {
    if (!atlasData) return;
    const updatedPanels = atlasData.panels.map((p) =>
      p.panelLetter === panelLetter ? { ...p, panelTitle: titleText } : p
    );
    setAtlasData({
      ...atlasData,
      panels: updatedPanels
    });
    if (zoomPanel && zoomPanel.panelLetter === panelLetter) {
      setZoomPanel({ ...zoomPanel, panelTitle: titleText });
    }
  };

  const handleUpdateSynopticItem = (index: number, updated: Partial<Atlas3DSynopticItem>) => {
    if (!atlasData) return;
    const newItems = [...atlasData.synopticExplanation];
    newItems[index] = { ...newItems[index], ...updated };
    setAtlasData({ ...atlasData, synopticExplanation: newItems });
  };

  const handleAddSynopticItem = () => {
    if (!atlasData) return;
    const defaultLetter = atlasData.panels[0]?.panelLetter || "A";
    const newItem: Atlas3DSynopticItem = {
      structure: "Estructura Anatómica",
      panelRef: `(Panel ${defaultLetter})`,
      findingDetail: "Descripción del hallazgo correlacionado con la reconstrucción tridimensional."
    };
    setAtlasData({
      ...atlasData,
      synopticExplanation: [...(atlasData.synopticExplanation || []), newItem]
    });
  };

  const handleDeleteSynopticItem = (index: number) => {
    if (!atlasData) return;
    const updated = (atlasData.synopticExplanation || []).filter((_, i) => i !== index);
    setAtlasData({
      ...atlasData,
      synopticExplanation: updated
    });
  };

  const handleUpdateSynthesis = (synthesis: string) => {
    if (!atlasData) return;
    setAtlasData({ ...atlasData, biomechanicalSynthesis: synthesis });
  };

  return (
    <div className="bg-slate-900/95 border-2 border-indigo-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-6 text-slate-100 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-pink-500/20 border border-indigo-500/40 rounded-2xl text-indigo-300 shadow-md">
            <Box className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Atlas 3D Fotorrealista y Correlación Anatómica
              </h3>
              <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-gradient-to-r from-indigo-600 to-pink-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                3D Journal Quality
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Genera reconstrucciones 3D con anclaje espacial de lateralidad estricta y correlación semiológica al pie.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {atlasData && (
            <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-indigo-500/30 hover:border-indigo-500/60 rounded-xl cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={includeInReport}
                onChange={(e) => setIncludeInReport(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 font-mono">
                {includeInReport ? "✓ Incluido en PDF (Pág. 3)" : "No incluir en PDF"}
              </span>
            </label>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar módulo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Anatomical Laterality Lock Selector */}
      <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 font-mono block">
              Control de Lateralidad Anatómica Estricta:
            </span>
            <span className="text-[10px] text-slate-400">
              Fija de forma determinante el lado para evitar inversiones en el render 3D:
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "auto", label: "🤖 Auto (Detectar del Informe)" },
            { id: "Izquierda", label: "📍 Izquierda (Left)" },
            { id: "Derecha", label: "📍 Derecha (Right)" },
            { id: "Bilateral", label: "📍 Bilateral" }
          ].map((opt) => {
            const isSelected = selectedLaterality.toLowerCase() === opt.id.toLowerCase();
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedLaterality(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-950/60"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Prompt Directives & Nuances Input Box */}
      <div className="p-4 bg-slate-950/90 border border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl space-y-2.5 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-indigo-400" />
            <label className="text-xs font-black uppercase tracking-wider text-indigo-200 font-mono">
              Detalle o matiz anatómico personalizado para el dibujo 3D (Opcional):
            </label>
          </div>
          {customDirectives.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setCustomDirectives("")}
              className="text-[10px] text-slate-400 hover:text-rose-400 font-mono font-bold transition-colors cursor-pointer"
            >
              Limpiar detalle
            </button>
          )}
        </div>

        <textarea
          value={customDirectives}
          onChange={(e) => setCustomDirectives(e.target.value)}
          placeholder="Ejemplo: En una ruptura de menisco interno de rodilla izquierda, ubicar la lesión estrictamente en el compartimento medial (lado izquierdo de la imagen) y mostrar el peroné a la derecha..."
          rows={2}
          className="w-full bg-slate-900/90 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 outline-none leading-relaxed resize-y font-sans transition-all"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[10px] text-slate-500 font-mono">
            💡 Este detalle se inyecta con máxima prioridad en el prompt volumétrico y en la selección del ángulo 3D.
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] text-slate-500 font-mono">Sugerencias rápidas:</span>
            {[
              "Menisco Interno (Medial)",
              "Menisco Externo (Lateral)",
              "Preservar fibras anteriores",
              "Enfatizar edema perilesional",
              "Corte coronal AP",
              "Corte sagital"
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const prefix = customDirectives.trim() ? `${customDirectives.trim()}, ` : "";
                  setCustomDirectives(`${prefix}${chip}`);
                }}
                className="text-[9px] bg-slate-900 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-300 px-2 py-0.5 rounded-lg transition-colors font-mono cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action / Trigger Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <Info className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="leading-snug">
            {atlasData 
              ? `Reconstrucción activa para: ${atlasData.studyRegion || activeProtocol || "Estudio Actual"} (${atlasData.panels.length} panel${atlasData.panels.length > 1 ? "es" : ""})${atlasData.detectedLaterality ? ` • [${atlasData.detectedLaterality}]` : ""}.`
              : `Detectará la región (${activeProtocol || "Hombro / Rodilla / Mama / Órgano"}) respetando estrictamente la lateralidad seleccionada.`}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleGenerateAtlas}
            disabled={isGenerating}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 border border-indigo-400/20 active:scale-97 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Generando Renders 3D...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                <span>{atlasData ? "Regenerar Atlas 3D Completo" : "Generar Atlas 3D del Caso"}</span>
              </>
            )}
          </button>

          {atlasData && (
            <button
              type="button"
              onClick={() => setAtlasData(null)}
              className="p-2.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-xl text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Eliminar datos generados"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress / Step indicator */}
      {isGenerating && (
        <div className="p-6 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-3 text-center animate-pulse">
          <div className="flex justify-center items-center gap-2">
            <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-300 font-mono">
              Motor de Ilustración Médica Tridimensional
            </span>
          </div>
          <p className="text-xs font-bold text-slate-300">{generationStep}</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Modelando shaders volumétricos, dispersión de luz subsuperficial (*subsurface scattering*) y fijando coordenadas anatómicas exactas...
          </p>
        </div>
      )}

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 bg-rose-955/20 border border-rose-900/50 rounded-2xl text-rose-300 text-xs font-bold space-y-1">
          <div className="flex items-center gap-2 text-rose-400 font-black uppercase tracking-wider">
            <span>⚠️ Error al procesar:</span>
          </div>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Generated Atlas 3D Content Preview */}
      {atlasData && !isGenerating && (
        <div className="space-y-6 animate-fadeIn">
          {/* Editable Figure Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block">
              Título Editorial de la Lámina (PDF):
            </label>
            <input
              type="text"
              value={atlasData.figureTitle}
              onChange={(e) => handleUpdateFigureTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-black text-slate-200 tracking-wide font-mono outline-none"
            />
          </div>

          {/* 3D Panels Grid */}
          <div className={`grid gap-5 ${
            atlasData.panels.length === 1 
              ? "grid-cols-1 max-w-xl mx-auto" 
              : atlasData.panels.length === 2 
                ? "grid-cols-1 md:grid-cols-2" 
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}>
            {atlasData.panels.map((panel, idx) => {
              const isEditingThisPanel = editingPanelLetter === panel.panelLetter;
              const isRegeneratingThis = regeneratingPanelLetter === panel.panelLetter;
              const currentDirective = panelDirectives[panel.panelLetter] || "";
              const compass = getCompassInfo(panel);

              return (
                <div 
                  key={idx} 
                  className={`bg-slate-950 border rounded-2xl overflow-hidden shadow-lg flex flex-col group transition-all ${
                    isEditingThisPanel ? "border-indigo-500 ring-1 ring-indigo-500/50" : "border-slate-800 hover:border-indigo-500/50"
                  }`}
                >
                  {/* Panel Label Header */}
                  <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-mono text-[9px] font-black shrink-0">
                        PANEL {panel.panelLetter}
                      </span>
                      {isEditingText ? (
                        <input
                          type="text"
                          value={panel.panelTitle}
                          onChange={(e) => handleUpdatePanelTitle(panel.panelLetter, e.target.value)}
                          className="bg-slate-950 border border-indigo-500/60 rounded px-2 py-0.5 text-xs text-slate-100 font-bold outline-none flex-1"
                          placeholder="Título del panel..."
                        />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-200 truncate" title={panel.panelTitle}>
                          {panel.panelTitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {panel.imageUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFlipPanelHorizontal(panel)}
                            className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                              panel.isCustomFlipped 
                                ? "bg-amber-600 text-white border border-amber-400" 
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700"
                            }`}
                            title="Invertir orientación / Voltear horizontalmente (Espejo para corregir lateralidad al instante)"
                          >
                            <FlipHorizontal className="h-3 w-3" />
                            <span className="hidden sm:inline">Espejo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomPanel(panel)}
                            className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-indigo-600 transition-colors cursor-pointer"
                            title="Ver imagen en alta resolución"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingPanelLetter(isEditingThisPanel ? null : panel.panelLetter)}
                        className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                          isEditingThisPanel 
                            ? "bg-indigo-600 text-white" 
                            : "bg-slate-800 hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-slate-700 hover:border-indigo-500/50"
                        }`}
                        title="Modificar, forzar lateralidad o regenerar solo este panel"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRegeneratingThis ? "animate-spin" : ""}`} />
                        <span>Ajustar</span>
                      </button>

                      {atlasData.panels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSinglePanel(panel.panelLetter)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded bg-slate-800/60 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Eliminar este panel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Anatomical Compass / Spatial Canvas Guide Banner */}
                  <div className="px-2.5 py-1 bg-slate-950/90 border-b border-slate-800 text-[8.5px] font-mono flex items-center justify-between text-slate-400">
                    <span className="text-indigo-400 font-bold truncate max-w-[48%] flex items-center gap-1" title="Izquierda del marco visual">
                      👈 {compass.leftSideTag}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 px-1 bg-slate-900 rounded font-black shrink-0">
                      {compass.side}
                    </span>
                    <span className="text-cyan-400 font-bold truncate max-w-[48%] text-right flex items-center justify-end gap-1" title="Derecha del marco visual">
                      {compass.rightSideTag} 👉
                    </span>
                  </div>

                  {/* Panel Image Container */}
                  <div className="relative aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                    {panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.panelTitle}
                        className={`w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.02] ${
                          isRegeneratingThis ? "opacity-30 blur-xs" : ""
                        }`}
                        onClick={() => setZoomPanel(panel)}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-xs space-y-2">
                        <Box className="h-8 w-8 mx-auto opacity-40 text-slate-600" />
                        <span className="block text-slate-400 font-bold">Reconstrucción 3D no generada</span>
                        <button
                          type="button"
                          disabled={isRegeneratingThis}
                          onClick={() => handleRegenerateSinglePanel(panel)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          {isRegeneratingThis ? "Generando..." : "Reintentar render de este panel"}
                        </button>
                      </div>
                    )}

                    {/* Regeneration Overlay for this panel */}
                    {isRegeneratingThis && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center gap-2">
                        <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                        <span className="text-xs font-black uppercase text-indigo-200 font-mono tracking-wider">
                          Regenerando Panel {panel.panelLetter}...
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Aplicando anclajes espaciales y corrección de lateralidad
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Inline Single-Panel Adjustment Drawer */}
                  {isEditingThisPanel && (
                    <div className="p-3 bg-slate-900 border-t border-indigo-500/40 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Wand2 className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200 font-mono">
                            Modificar Panel {panel.panelLetter} (Instrucción de cambio):
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingPanelLetter(null)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>

                      {/* 1-Click Fast Laterality & Compartment Presets */}
                      <div className="space-y-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 text-[9.5px] font-black text-amber-300 uppercase tracking-wider font-mono">
                          <ArrowLeftRight className="h-3 w-3 text-amber-400" />
                          <span>Corrección Rápida de Lateralidad y Compartimento:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRegenerateSinglePanel(panel, "CORRECCIÓN ESTRICTA: Rodilla Izquierda vista AP. El foco patológico DEBE estar estrictamente en el MENISCO INTERNO (Compartimento Medial, lado IZQUIERDO de la imagen). El peroné está a la DERECHA.")}
                            className="text-[9px] bg-slate-900 hover:bg-indigo-900/60 border border-slate-700 hover:border-indigo-400 text-indigo-200 p-1.5 rounded-lg text-left font-mono transition-colors cursor-pointer"
                          >
                            🎯 Rodilla Izq: Menisco Interno
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateSinglePanel(panel, "CORRECCIÓN ESTRICTA: Rodilla Izquierda vista AP. El foco patológico DEBE estar estrictamente en el MENISCO EXTERNO (Compartimento Lateral, lado DERECHO de la imagen junto al peroné).")}
                            className="text-[9px] bg-slate-900 hover:bg-indigo-900/60 border border-slate-700 hover:border-indigo-400 text-indigo-200 p-1.5 rounded-lg text-left font-mono transition-colors cursor-pointer"
                          >
                            🎯 Rodilla Izq: Menisco Externo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateSinglePanel(panel, "CORRECCIÓN ESTRICTA: Rodilla Derecha vista AP. El foco patológico DEBE estar estrictamente en el MENISCO INTERNO (Compartimento Medial, lado DERECHO de la imagen). El peroné está a la IZQUIERDA.")}
                            className="text-[9px] bg-slate-900 hover:bg-cyan-900/60 border border-slate-700 hover:border-cyan-400 text-cyan-200 p-1.5 rounded-lg text-left font-mono transition-colors cursor-pointer"
                          >
                            🎯 Rodilla Der: Menisco Interno
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateSinglePanel(panel, "CORRECCIÓN ESTRICTA: Rodilla Derecha vista AP. El foco patológico DEBE estar estrictamente en el MENISCO EXTERNO (Compartimento Lateral, lado IZQUIERDO de la imagen junto al peroné).")}
                            className="text-[9px] bg-slate-900 hover:bg-cyan-900/60 border border-slate-700 hover:border-cyan-400 text-cyan-200 p-1.5 rounded-lg text-left font-mono transition-colors cursor-pointer"
                          >
                            🎯 Rodilla Der: Menisco Externo
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={currentDirective}
                        onChange={(e) => setPanelDirectives({ ...panelDirectives, [panel.panelLetter]: e.target.value })}
                        placeholder={`Escribe instrucción detallada de cambio para este panel (ej. Cambiar orientación a rodilla izquierda con desgarro en cuerno posterior del menisco medial)...`}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none font-sans"
                      />

                      {/* Quick anatomy suggestion chips */}
                      <div className="flex flex-wrap gap-1">
                        {[
                          "Rodilla Izquierda AP (Peroné a la derecha)",
                          "Rodilla Derecha AP (Peroné a la izquierda)",
                          "Mama Derecha CSE radio 10",
                          "Mama Izquierda CSI",
                          "Hombro Derecho coronal",
                          "Hombro Izquierdo coronal",
                          "Corte coronal AP",
                          "Corte sagital",
                          "Corte axial transversal",
                          "Enfatizar foco patológico"
                        ].map((chip, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => {
                              const prev = currentDirective.trim() ? `${currentDirective.trim()}, ` : "";
                              setPanelDirectives({ ...panelDirectives, [panel.panelLetter]: `${prev}${chip}` });
                            }}
                            className="text-[9px] bg-slate-950 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 px-1.5 py-0.5 rounded transition-colors font-mono cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>

                      {/* Edit caption/focus directly in adjustment drawer */}
                      <div className="space-y-1 pt-2 border-t border-slate-800">
                        <label className="text-[10px] font-bold text-indigo-300 font-mono flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          Editar Pie de Imagen (Foco):
                        </label>
                        <input
                          type="text"
                          value={panel.anatomicalFocus || ""}
                          onChange={(e) => handleUpdatePanelFocus(panel.panelLetter, e.target.value)}
                          placeholder="Texto del pie de imagen..."
                          className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingPanelLetter(null)}
                          className="px-2.5 py-1 text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isRegeneratingThis}
                          onClick={() => handleRegenerateSinglePanel(panel)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[11px] font-mono font-bold rounded-lg shadow flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {isRegeneratingThis ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Regenerando...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              <span>Regenerar solo Panel {panel.panelLetter}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Anatomical focus subtitle & editable caption */}
                  <div className="p-2.5 bg-slate-900/80 text-[10px] text-slate-300 font-mono border-t border-slate-850 leading-relaxed group/focus relative">
                    {isEditingText || editingFocusLetter === panel.panelLetter ? (
                      <div className="space-y-1.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                            <Edit3 className="h-3 w-3" /> Editar Pie de Imagen (Foco):
                          </span>
                          {!isEditingText && (
                            <button
                              type="button"
                              onClick={() => setEditingFocusLetter(null)}
                              className="text-[9px] text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              Listo
                            </button>
                          )}
                        </div>
                        <textarea
                          value={panel.anatomicalFocus || ""}
                          onChange={(e) => handleUpdatePanelFocus(panel.panelLetter, e.target.value)}
                          rows={2}
                          className="w-full bg-slate-950 border border-indigo-500/70 focus:border-indigo-400 rounded-lg p-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none resize-none font-sans shadow-inner"
                          placeholder="Escribe o modifica el pie de imagen (Foco)..."
                          autoFocus={editingFocusLetter === panel.panelLetter}
                        />
                        {!isEditingText && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingFocusLetter(null)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                            >
                              <Check className="h-3 w-3" />
                              <span>Guardar Pie</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => setEditingFocusLetter(panel.panelLetter)}
                          className="cursor-pointer flex-1 hover:text-slate-100 transition-colors group-hover/focus:text-indigo-200"
                          title="Haz clic para editar este pie de imagen (Foco:)"
                        >
                          <strong className="text-indigo-300 font-bold">Foco:</strong>{" "}
                          <span>{panel.anatomicalFocus || "Clic para agregar pie de imagen..."}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingFocusLetter(panel.panelLetter)}
                          className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                          title="Editar pie de imagen (Foco)"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structured Synoptic Correlation Panel (Editorial Table) */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 font-mono">
                  ■ Correlación Semiológica de Hallazgos en Reconstrucción
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {isEditingText && (
                  <button
                    type="button"
                    onClick={handleAddSynopticItem}
                    className="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Agregar Hallazgo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingText(!isEditingText)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                    isEditingText
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "text-indigo-400 hover:text-indigo-300 bg-slate-900 border border-slate-800 hover:border-indigo-500/50"
                  }`}
                >
                  {isEditingText ? "Guardar Edición" : "Editar Textos"}
                </button>
              </div>
            </div>

            {/* List of findings */}
            <div className="space-y-3">
              {(!atlasData.synopticExplanation || atlasData.synopticExplanation.length === 0) ? (
                <div className="p-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400">No hay filas de correlación actualmente.</p>
                  <button
                    type="button"
                    onClick={handleAddSynopticItem}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-mono font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar primera correlación
                  </button>
                </div>
              ) : (
                atlasData.synopticExplanation.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-2 group/item transition-all hover:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      {isEditingText ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={item.structure}
                            onChange={(e) => handleUpdateSynopticItem(idx, { structure: e.target.value })}
                            className="bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded px-2 py-1 text-xs text-indigo-300 font-mono font-black outline-none flex-1"
                            placeholder="Nombre de la estructura anatómica..."
                          />
                          <select
                            value={item.panelRef}
                            onChange={(e) => handleUpdateSynopticItem(idx, { panelRef: e.target.value })}
                            className="bg-slate-950 border border-slate-700 focus:border-pink-500 rounded px-2 py-1 text-xs text-pink-400 font-mono font-bold outline-none cursor-pointer"
                          >
                            {atlasData.panels.map((p) => (
                              <option key={p.panelLetter} value={`(Panel ${p.panelLetter})`}>
                                (Panel {p.panelLetter})
                              </option>
                            ))}
                            {atlasData.panels.length > 1 && (
                              <option value={`(Paneles ${atlasData.panels.map((p) => p.panelLetter).join(" y ")})`}>
                                (Paneles {atlasData.panels.map((p) => p.panelLetter).join(" y ")})
                              </option>
                            )}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-800 text-indigo-300 text-[10px] font-mono font-black rounded border border-indigo-500/20">
                            {item.structure}
                          </span>
                          <span className="text-[10px] font-mono text-pink-400 font-bold bg-pink-950/40 px-2 py-0.5 rounded border border-pink-500/20">
                            {item.panelRef}
                          </span>
                        </div>
                      )}

                      {isEditingText && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSynopticItem(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded bg-slate-800/60 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                          title="Eliminar este hallazgo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingText ? (
                      <textarea
                        value={item.findingDetail}
                        onChange={(e) => handleUpdateSynopticItem(idx, { findingDetail: e.target.value })}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 rounded-lg p-2 text-xs text-slate-200 outline-none leading-relaxed"
                        placeholder="Descripción semiológica del hallazgo correlacionado..."
                      />
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed pl-1">
                        {item.findingDetail}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Biomechanical Synthesis */}
            <div className="pt-3 border-t border-slate-850 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 font-mono">
                  ■ Síntesis Biomecánica / Diagnóstica
                </span>
              </div>
              {isEditingText ? (
                <textarea
                  value={atlasData.biomechanicalSynthesis}
                  onChange={(e) => handleUpdateSynthesis(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/80 rounded-lg p-2 text-xs font-bold text-amber-200 outline-none leading-relaxed"
                  placeholder="Síntesis funcional o diagnóstica integradora..."
                />
              ) : (
                <p className="text-xs font-bold text-amber-300/90 leading-relaxed bg-amber-955/20 border border-amber-900/30 p-3 rounded-xl">
                  {atlasData.biomechanicalSynthesis}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomPanel && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-950 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-mono text-[10px] font-black">
                  PANEL {zoomPanel.panelLetter}
                </span>
                <span className="text-sm font-bold text-white">
                  {zoomPanel.panelTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFlipPanelHorizontal(zoomPanel)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    zoomPanel.isCustomFlipped
                      ? "bg-amber-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300"
                  }`}
                  title="Invertir orientación / Voltear horizontalmente (Espejo)"
                >
                  <FlipHorizontal className="h-4 w-4" />
                  <span>Invertir Lateralidad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPanel(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Compass Bar */}
            {(() => {
              const compass = getCompassInfo(zoomPanel);
              return (
                <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-400">
                  <span className="text-indigo-400 font-bold">👈 MARCO IZQ: {compass.leftSideTag}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-black">
                    {compass.side}
                  </span>
                  <span className="text-cyan-400 font-bold">MARCO DER: {compass.rightSideTag} 👉</span>
                </div>
              );
            })()}

            <div className="flex-1 bg-white p-4 flex items-center justify-center overflow-auto">
              <img
                src={zoomPanel.imageUrl}
                alt={zoomPanel.panelTitle}
                className="max-h-[70vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-3 bg-slate-900 border-t border-slate-800 font-mono text-xs text-slate-300">
              {editingFocusLetter === zoomPanel.panelLetter ? (
                <div className="flex items-center gap-2">
                  <strong className="text-indigo-300 shrink-0">Foco:</strong>
                  <input
                    type="text"
                    value={zoomPanel.anatomicalFocus || ""}
                    onChange={(e) => handleUpdatePanelFocus(zoomPanel.panelLetter, e.target.value)}
                    className="flex-1 bg-slate-950 border border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none"
                    placeholder="Editar pie de imagen..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setEditingFocusLetter(null)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div 
                    onClick={() => setEditingFocusLetter(zoomPanel.panelLetter)}
                    className="cursor-pointer hover:text-white flex-1"
                    title="Haz clic para editar el pie de imagen"
                  >
                    <strong className="text-indigo-300">Foco / Pie de imagen:</strong> {zoomPanel.anatomicalFocus || "Sin pie de imagen especificado"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingFocusLetter(zoomPanel.panelLetter)}
                    className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Editar pie de imagen"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Atlas3DModule;
