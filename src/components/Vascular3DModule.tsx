import React, { useState, useEffect } from "react";
import {
  Activity,
  Sparkles,
  Layers,
  FileCheck2,
  Download,
  Maximize2,
  X,
  RotateCcw,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sliders,
  Eye,
  MessageSquarePlus,
  Wand2,
  FlipHorizontal,
  Edit3,
  Compass,
  ArrowLeftRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Table,
  Cpu,
  Scissors,
  Trash2
} from "lucide-react";
import { Vascular3DData, VascularPanel, VascularStudyType, VascularHemodynamicTableItem } from "../types";

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
  const [generationStep, setGenerationStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<VascularPanel | null>(null);
  const [isEditingAllTexts, setIsEditingAllTexts] = useState(false);
  const [customDirectives, setCustomDirectives] = useState<string>("");

  // Study type and laterality selection
  const [selectedStudyType, setSelectedStudyType] = useState<VascularStudyType>(() => {
    const p = (activeProtocol || "").toLowerCase();
    const r = (reportText || "").toLowerCase();
    if (p.includes("venoso") || p.includes("safena") || p.includes("tvp") || /venoso|venosa|safena|tvp|flebop|reflujo|varic/i.test(r)) return "venous_mmii";
    if (p.includes("carot") || p.includes("vertebral") || (/carot|vertebral|tsa/i.test(r) && !/arterial.*(mmii|inferior)|venoso/i.test(r))) return "carotid";
    if (p.includes("renal") || p.includes("riñón") || /arteria.*renal|riñ[oó]n|rar|resistiv.*renal/i.test(r)) return "renal";
    if (p.includes("aorto") || p.includes("iliac") || /aortoil[ií]ac|aorta abdominal|il[ií]aca/i.test(r)) return "aortoiliac";
    if (p.includes("arterial") || p.includes("mmii") || /arterial|femoral|popl[ií]tea|tibial|peronea|pedia|claudicac/i.test(`${p} ${r}`)) return "arterial_mmii";
    return "venous_mmii";
  });

  const [selectedLaterality, setSelectedLaterality] = useState<string>(() => {
    if (laterality && laterality.trim()) return laterality.trim();
    return "Bilateral";
  });

  // Single panel modification/regeneration state
  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<{ [letter: string]: string }>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);

  // Sync protocol and reportText changes
  useEffect(() => {
    const p = (activeProtocol || "").toLowerCase();
    const r = (reportText || "").toLowerCase();
    const combined = `${p} ${r}`;

    if (p.includes("venoso") || p.includes("safena") || p.includes("tvp") || /venoso|venosa|safena|tvp|flebop|reflujo|varic/i.test(combined)) {
      setSelectedStudyType("venous_mmii");
    } else if (p.includes("carot") || p.includes("vertebral") || (/carot|vertebral|tsa/i.test(r) && !/arterial.*(mmii|inferior)|venoso/i.test(r))) {
      setSelectedStudyType("carotid");
    } else if (p.includes("renal") || p.includes("riñón") || /arteria.*renal|riñ[oó]n|rar|resistiv.*renal/i.test(r)) {
      setSelectedStudyType("renal");
    } else if (p.includes("aorto") || p.includes("iliac") || /aortoil[ií]ac|aorta abdominal|il[ií]aca/i.test(r)) {
      setSelectedStudyType("aortoiliac");
    } else if (p.includes("arterial") || p.includes("mmii") || /arterial|femoral|popl[ií]tea|tibial|peronea|pedia|claudicac/i.test(combined)) {
      setSelectedStudyType("arterial_mmii");
    }

    if (laterality && laterality.trim()) {
      setSelectedLaterality(laterality.trim());
    } else if (r) {
      const hasLeft = /izquierd|left|mmi|mii\b/i.test(r);
      const hasRight = /derech|right|mmd|mid\b/i.test(r);
      const hasBilateral = /bilateral/i.test(r) || (hasLeft && hasRight);

      if (hasBilateral) setSelectedLaterality("Bilateral");
      else if (hasLeft) setSelectedLaterality("Izquierda");
      else if (hasRight) setSelectedLaterality("Derecha");
    }
  }, [activeProtocol, reportText, laterality]);

  // Spatial compass helper for vascular orientation
  const getVascularCompassInfo = (panel: VascularPanel) => {
    const lat = (panel.laterality || selectedLaterality || "").toLowerCase();
    const isLeft = lat.includes("izq") || lat.includes("left");
    const isRight = lat.includes("der") || lat.includes("right");

    if (selectedStudyType === "carotid") {
      if (lat.includes("bilateral")) {
        return {
          title: "SISTEMA CAROTÍDEO BILATERAL (AP)",
          leftTag: "EJE DERECHO (ACC, Bulbo, ACI, ACE, Vert)",
          rightTag: "EJE IZQUIERDO (ACC, Bulbo, ACI, ACE, Vert)",
          color: "text-amber-400"
        };
      }
      return isLeft
        ? { title: "EJE CAROTÍDEO IZQUIERDO (Oblicua)", leftTag: "Medial (ACE c/ ramas)", rightTag: "Posterolateral (ACI profunda)", color: "text-indigo-400" }
        : { title: "EJE CAROTÍDEO DERECHO (Oblicua)", leftTag: "Posterolateral (ACI profunda)", rightTag: "Medial (ACE c/ ramas)", color: "text-cyan-400" };
    }

    if (selectedStudyType === "arterial_mmii") {
      if (lat.includes("bilateral")) {
        return {
          title: "ÁRBOL ARTERIAL MMII BILATERAL (AP)",
          leftTag: "MIEMBRO DERECHO (CFA, SFA, Pop, Tib)",
          rightTag: "MIEMBRO IZQUIERDO (CFA, SFA, Pop, Tib)",
          color: "text-rose-400"
        };
      }
      return isLeft
        ? { title: "EJE ARTERIAL IZQUIERDO", leftTag: "Lado Medial (Tibial Post / Poplítea)", rightTag: "Lado Lateral (Peroneo / SFA)", color: "text-indigo-400" }
        : { title: "EJE ARTERIAL DERECHO", leftTag: "Lado Lateral (Peroneo / SFA)", rightTag: "Lado Medial (Tibial Post / Poplítea)", color: "text-cyan-400" };
    }

    if (selectedStudyType === "venous_mmii") {
      if (lat.includes("bilateral")) {
        return {
          title: "SISTEMA VENOSO MMII BILATERAL",
          leftTag: "LADO DERECHO (VFC, VF, V. Poplítea, Safenas)",
          rightTag: "LADO IZQUIERDO (VFC, VF, V. Poplítea, Safenas)",
          color: "text-sky-400"
        };
      }
      return isLeft
        ? { title: "SISTEMA VENOSO IZQUIERDO", leftTag: "Medial (Safena Magna / USF)", rightTag: "Lateral / Safena Parva", color: "text-indigo-400" }
        : { title: "SISTEMA VENOSO DERECHO", leftTag: "Lateral / Safena Parva", rightTag: "Medial (Safena Magna / USF)", color: "text-cyan-400" };
    }

    if (selectedStudyType === "renal") {
      return {
        title: "AORTA Y ARTERIAS RENALES (Coronal)",
        leftTag: "RIÑÓN DERECHO / VCI / ARD (Retro-cava)",
        rightTag: "RIÑÓN IZQUIERDO / ARI (Hilio)",
        color: "text-emerald-400"
      };
    }

    return {
      title: "EJE AORTOILÍACO (Coronal)",
      leftTag: "EJE ILÍACO DERECHO (AIC, AIE, AII)",
      rightTag: "EJE ILÍACO IZQUIERDO (AIC, AIE, AII)",
      color: "text-violet-400"
    };
  };

  // Full Suite Generation
  const handleGenerateVascularSuite = async () => {
    if (!reportText || !reportText.trim()) {
      setErrorMessage("Por favor, redacta o genera primero el informe vascular Doppler.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Analizando árbol vascular, hemodinámica y placas/trombos...");

    try {
      setTimeout(() => {
        setGenerationStep("Trazando Roadmap 3D y fijando anclajes espaciales vasculares...");
      }, 1200);

      setTimeout(() => {
        setGenerationStep("Renderizando luz intraluminal, morfología de placa y vectores de flujo...");
      }, 2800);

      const response = await fetch("/api/generate-vascular-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          vascularStudyType: selectedStudyType,
          laterality: selectedLaterality,
          requestedModel: selectedModel || "gemini-3.7-flash",
          customDirectives: customDirectives.trim() || undefined
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudo generar la suite vascular 3D.");
      }

      setVascularData(result.data);
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generating vascular 3D:", err);
      setErrorMessage(err.message || "Ocurrió un error en la reconstrucción vascular.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Single panel modification with explicit directive or preset
  const handleRegenerateVascularPanel = async (panel: VascularPanel, explicitDirectiveOverride?: string) => {
    if (!vascularData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);
    const userDirective = explicitDirectiveOverride || panelDirectives[panel.panelLetter] || "";

    try {
      const response = await fetch("/api/regenerate-vascular-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          vascularTerritory: vascularData.vascularTerritory,
          vascularStudyType: vascularData.vascularStudyType,
          panel: panel,
          laterality: selectedLaterality,
          userDirective: userDirective.trim() || undefined,
          requestedModel: selectedModel || "gemini-3.7-flash"
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudo regenerar este panel vascular.");
      }

      const updatedPanel = result.panel;

      if (panel.panelCategory === "roadmap") {
        setVascularData({
          ...vascularData,
          roadmapPanel: updatedPanel
        });
      } else {
        const updatedFocals = vascularData.focalPanels.map((p) =>
          p.panelLetter === panel.panelLetter ? updatedPanel : p
        );
        setVascularData({
          ...vascularData,
          focalPanels: updatedFocals
        });
      }

      if (zoomPanel && zoomPanel.panelLetter === panel.panelLetter) {
        setZoomPanel(updatedPanel);
      }

      setEditingPanelLetter(null);
      setPanelDirectives({ ...panelDirectives, [panel.panelLetter]: "" });
    } catch (err: any) {
      console.error("Error regenerating vascular panel:", err);
      setErrorMessage(err.message || "Error al regenerar el panel vascular.");
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  // Instant Horizontal Flip
  const handleFlipVascularPanel = (panel: VascularPanel) => {
    if (!vascularData || !panel.imageUrl) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const flippedDataUrl = canvas.toDataURL("image/png");

        if (panel.panelCategory === "roadmap") {
          setVascularData({
            ...vascularData,
            roadmapPanel: {
              ...vascularData.roadmapPanel,
              imageUrl: flippedDataUrl,
              isCustomFlipped: !vascularData.roadmapPanel.isCustomFlipped
            }
          });
        } else {
          const updatedFocals = vascularData.focalPanels.map((p) => {
            if (p.panelLetter === panel.panelLetter) {
              return {
                ...p,
                imageUrl: flippedDataUrl,
                isCustomFlipped: !p.isCustomFlipped
              };
            }
            return p;
          });
          setVascularData({
            ...vascularData,
            focalPanels: updatedFocals
          });
        }

        if (zoomPanel && zoomPanel.panelLetter === panel.panelLetter) {
          setZoomPanel({
            ...zoomPanel,
            imageUrl: flippedDataUrl,
            isCustomFlipped: !zoomPanel.isCustomFlipped
          });
        }
      };
      img.src = panel.imageUrl;
    } catch (e) {
      console.error("Error flipping vascular image:", e);
    }
  };

  // Download panel
  const handleDownloadPanelImage = (panel: VascularPanel) => {
    if (!panel.imageUrl) return;
    const a = document.createElement("a");
    a.href = panel.imageUrl;
    a.download = `Vascular_3D_Panel_${panel.panelLetter}_${panel.vesselSegment.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Delete Roadmap Panel
  const handleDeleteRoadmap = () => {
    if (!vascularData) return;
    setVascularData({
      ...vascularData,
      roadmapPanel: null
    });
    if (zoomPanel && zoomPanel.panelCategory === "roadmap") {
      setZoomPanel(null);
    }
  };

  // Delete Focal Panel
  const handleDeleteFocalPanel = (panelLetter: string) => {
    if (!vascularData) return;
    const updatedFocals = vascularData.focalPanels
      .filter((p) => p.panelLetter !== panelLetter)
      .map((p, idx) => {
        const startCode = vascularData.roadmapPanel ? 66 : 65; // 'B' or 'A'
        return {
          ...p,
          panelLetter: String.fromCharCode(startCode + idx)
        };
      });

    setVascularData({
      ...vascularData,
      focalPanels: updatedFocals
    });

    if (zoomPanel && zoomPanel.panelLetter === panelLetter) {
      setZoomPanel(null);
    }
  };

  return (
    <div id="vascular-3d-suite-card" className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 shadow-2xl space-y-5 text-slate-100 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500/20 via-indigo-500/20 to-sky-500/20 border border-rose-500/40 rounded-2xl">
            <Activity className="h-5 w-5 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-wide flex items-center gap-1.5 font-sans">
                Suite Vascular 3D & Roadmap Quirúrgico
              </h3>
              <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold rounded-full">
                Hemodinámica 3D
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Reconstrucción de alta resolución para Doppler Carotídeo, Arterial, Venoso, Renal y Aortoilíaco con Roadmap y Foco Lesional.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vascularData && (
            <button
              type="button"
              onClick={() => setIsEditingAllTexts(!isEditingAllTexts)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isEditingAllTexts
                  ? "bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950/50"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300 hover:text-amber-200"
              }`}
              title="Activar edición directa de títulos, textos, tabla hemodinámica y síntesis quirúrgica"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isEditingAllTexts ? "Terminar Edición" : "Editar Textos"}</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Cerrar módulo"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Territorio Vascular & Selector de Lateralidad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800">
        {/* Territory Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1">
            <Layers className="h-3 w-3 text-rose-400" />
            <span>Territorio Vascular a Explorar:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "carotid", label: "🫀 Carotídeo & Vertebral" },
              { id: "arterial_mmii", label: "🦵 Arterial MMII" },
              { id: "venous_mmii", label: "🩸 Venoso MMII" },
              { id: "renal", label: "🫘 Renal & Aorta" },
              { id: "aortoiliac", label: "🏛️ Aortoilíaco" }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedStudyType(t.id as VascularStudyType)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                  selectedStudyType === t.id
                    ? "bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-950/60"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Laterality Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1">
            <Compass className="h-3 w-3 text-amber-400" />
            <span>Lateralidad Vascular:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "Bilateral", label: "🔄 Bilateral (Completo)" },
              { id: "Izquierda", label: "📍 Izquierda (Left)" },
              { id: "Derecha", label: "📍 Derecha (Right)" },
              { id: "Central", label: "⚖️ Central / Línea Media" }
            ].map((lat) => (
              <button
                key={lat.id}
                type="button"
                onClick={() => setSelectedLaterality(lat.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                  selectedLaterality.toLowerCase() === lat.id.toLowerCase()
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-950/60"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                {lat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directivas Quirúrgicas y Matices Hemodinámicos */}
      <div className="p-3.5 bg-slate-950/90 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl space-y-2 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-300">
              Directivas Especiales de Hemodinámica / Placa / Trombo (Opcional):
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Inyección de alta prioridad</span>
        </div>

        <textarea
          value={customDirectives}
          onChange={(e) => setCustomDirectives(e.target.value)}
          placeholder="Ej: En carótida interna izquierda destacar placa fibrolipídica de 3.2 mm con luz excéntrica residual y turbulencia post-estenótica..."
          rows={2}
          className="w-full bg-slate-900/90 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none leading-relaxed resize-y font-sans transition-all"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[10px] text-slate-500 font-mono">
            💡 Sugerencias rápidas para inyectar al prompt 3D:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              "Placa calcificada con sombra",
              "Placa fibrolipídica blanda",
              "Estenosis >70% NASCET",
              "Trombo oclusivo agudo",
              "Reflujo en cayado de safena magna",
              "Flujo monofásico Parvus-Tardus",
              "Jet estenótico en ostium renal"
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCustomDirectives((prev) => prev ? `${prev}, ${chip}` : chip)}
                className="text-[9.5px] bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                +{chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="leading-snug">
            {vascularData
              ? `Reconstrucción Vascular Activa: ${vascularData.vascularTerritory} [${vascularData.laterality}].`
              : `Generará Roadmap Panorámico (Panel A) + Renders de Foco Lesional y Tabla Hemodinámica.`}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={isGenerating || !reportText.trim()}
            onClick={handleGenerateVascularSuite}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 disabled:opacity-50 text-white text-xs font-mono font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer border border-rose-400/40"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Generando Reconstrucción Vascular 3D...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                <span>{vascularData ? "Regenerar Suite Vascular 3D" : "Generar Suite Vascular 3D"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl flex items-start gap-2.5 text-rose-200 text-xs animate-shake">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Aviso del Sistema Vascular: </span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Generation Progress Bar */}
      {isGenerating && (
        <div className="p-4 bg-slate-950/90 border border-rose-500/30 rounded-2xl text-center space-y-2 animate-pulse">
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-4 w-4 text-rose-400 animate-spin" />
            <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider">
              Renderizando Modelo Vascular 3D Fotorrealista
            </span>
          </div>
          <p className="text-xs font-bold text-slate-200">{generationStep}</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Modelando paredes translúcidas, columnas de flujo intravascular y cálculo de estenosis volumétrica...
          </p>
        </div>
      )}

      {/* Rendered Vascular Suite Content */}
      {vascularData && (
        <div className="space-y-6 pt-2">
          {/* Editable Figure Title Header */}
          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 block">
                Encabezado de la Figura Vascular:
              </span>
              {isEditingAllTexts ? (
                <input
                  type="text"
                  value={vascularData.figureTitle}
                  onChange={(e) =>
                    setVascularData({
                      ...vascularData,
                      figureTitle: e.target.value
                    })
                  }
                  className="w-full mt-1 bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-mono outline-none"
                />
              ) : (
                <h4 className="text-sm font-black text-white font-mono tracking-tight mt-0.5">
                  {vascularData.figureTitle}
                </h4>
              )}
            </div>

            {/* Checkbox to include in PDF report */}
            <label className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={includeInReport}
                onChange={(e) => setIncludeInReport(e.target.checked)}
                className="rounded border-slate-700 text-rose-600 focus:ring-rose-500 h-4 w-4 bg-slate-950"
              />
              <span className="text-xs font-mono font-bold text-slate-300">
                Incluir en Reporte e Informe PDF
              </span>
            </label>
          </div>

          {/* Section 1: ROADMAP VASCULAR PANORÁMICO (Panel A) - Opcional según tipo de estudio */}
          {vascularData.roadmapPanel && (
            <div className="bg-slate-950/90 border-2 border-rose-500/40 rounded-3xl overflow-hidden shadow-2xl space-y-0">
              <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 px-4 py-2.5 border-b border-rose-500/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-black text-xs rounded-lg shadow">
                    PANEL A • ROADMAP GENERAL
                  </span>
                  {isEditingAllTexts ? (
                    <input
                      type="text"
                      value={vascularData.roadmapPanel.panelTitle}
                      onChange={(e) =>
                        setVascularData({
                          ...vascularData,
                          roadmapPanel: {
                            ...vascularData.roadmapPanel,
                            panelTitle: e.target.value
                          }
                        })
                      }
                      className="bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-0.5 text-xs text-amber-200 font-mono outline-none"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-200">
                      {vascularData.roadmapPanel.panelTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFlipVascularPanel(vascularData.roadmapPanel)}
                    className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                      vascularData.roadmapPanel.isCustomFlipped
                        ? "bg-amber-600 text-white border border-amber-400"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700"
                    }`}
                    title="Invertir orientación / Voltear horizontalmente"
                  >
                    <FlipHorizontal className="h-3 w-3" />
                    <span>Espejo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomPanel(vascularData.roadmapPanel)}
                    className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                    title="Ampliar a pantalla completa"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPanelImage(vascularData.roadmapPanel!)}
                    className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                    title="Descargar imagen PNG"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteRoadmap}
                    className="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-950/80 rounded bg-slate-800 border border-slate-700 hover:border-rose-500/50 transition-colors cursor-pointer"
                    title="Eliminar esta imagen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingPanelLetter(
                        editingPanelLetter === "A" ? null : "A"
                      )
                    }
                    className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                      editingPanelLetter === "A"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 hover:bg-rose-950 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50"
                    }`}
                  >
                    <RefreshCw className={`h-3 w-3 ${regeneratingPanelLetter === "A" ? "animate-spin" : ""}`} />
                    <span>Ajustar</span>
                  </button>
                </div>
              </div>

              {/* Spatial compass bar for Roadmap */}
              {(() => {
                const compass = getVascularCompassInfo(vascularData.roadmapPanel);
                return (
                  <div className="px-3 py-1 bg-slate-950 border-b border-slate-800 text-[8.5px] font-mono flex items-center justify-between text-slate-400">
                    <span className="text-rose-400 font-bold truncate max-w-[48%] flex items-center gap-1">
                      👈 {compass.leftTag}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 px-1 bg-slate-900 rounded font-black shrink-0">
                      {compass.title}
                    </span>
                    <span className="text-sky-400 font-bold truncate max-w-[48%] text-right flex items-center justify-end gap-1">
                      {compass.rightTag} 👉
                    </span>
                  </div>
                );
              })()}

              {/* Roadmap image display - Respetando Proporciones Naturales */}
              <div className="relative min-h-[220px] max-h-[480px] bg-slate-950 flex items-center justify-center p-2 overflow-hidden rounded-b-2xl">
                {vascularData.roadmapPanel.imageUrl ? (
                  <img
                    src={vascularData.roadmapPanel.imageUrl}
                    alt={vascularData.roadmapPanel.panelTitle}
                    className="max-h-[440px] w-auto max-w-full object-contain rounded-lg shadow-md cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                    onClick={() => setZoomPanel(vascularData.roadmapPanel)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 space-y-2">
                    <Activity className="h-8 w-8 text-slate-300 animate-pulse" />
                    <span className="text-xs font-mono">Renderizando Roadmap General...</span>
                  </div>
                )}

                {regeneratingPanelLetter === "A" && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-4">
                    <RefreshCw className="h-6 w-6 text-rose-400 animate-spin" />
                    <span className="text-xs font-mono font-bold text-rose-300">
                      Regenerando Roadmap Vascular...
                    </span>
                  </div>
                )}
              </div>

              {/* Inline drawer for Roadmap modification */}
              {editingPanelLetter === "A" && (
                <div className="p-3 bg-slate-900 border-t border-rose-500/40 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-rose-400" />
                      <span className="text-xs font-mono font-bold text-rose-300">
                        Instrucción de Cambio para Roadmap Panorámico:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPanelLetter(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <textarea
                    value={panelDirectives["A"] || ""}
                    onChange={(e) =>
                      setPanelDirectives({ ...panelDirectives, A: e.target.value })
                    }
                    placeholder="Ej: Enfatizar oclusión completa en arteria femoral superficial derecha y mostrar circulación colateral por ramas de la profunda..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl p-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none font-sans"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={regeneratingPanelLetter === "A"}
                      onClick={() => handleRegenerateVascularPanel(vascularData.roadmapPanel!)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-[11px] font-mono font-bold rounded-lg shadow flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {regeneratingPanelLetter === "A" ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>Regenerando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
                          <span>Aplicar y Regenerar Roadmap</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 2: PANELES DE HALLAZGOS ESPECÍFICOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-indigo-400" />
                <span>Paneles de Hallazgos Específicos:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vascularData.focalPanels.length} {vascularData.focalPanels.length === 1 ? "panel focal" : "paneles focales"}
              </span>
            </div>

            <div className={`grid gap-4 ${
              vascularData.focalPanels.length === 1
                ? "grid-cols-1 max-w-2xl mx-auto"
                : vascularData.focalPanels.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-3"
            }`}>
              {vascularData.focalPanels.map((focal) => {
                const isEditingThis = editingPanelLetter === focal.panelLetter;
                const isRegeneratingThis = regeneratingPanelLetter === focal.panelLetter;
                const compass = getVascularCompassInfo(focal);

                return (
                  <div
                    key={focal.panelLetter}
                    className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col justify-between"
                  >
                    {/* Panel Header */}
                    <div>
                      <div className="bg-slate-900/90 px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="px-1.5 py-0.5 bg-indigo-600 text-white font-mono font-black text-[11px] rounded shadow shrink-0">
                            PANEL {focal.panelLetter}
                          </span>
                          {isEditingAllTexts ? (
                            <input
                              type="text"
                              value={focal.panelTitle}
                              onChange={(e) => {
                                const updated = vascularData.focalPanels.map((p) =>
                                  p.panelLetter === focal.panelLetter
                                    ? { ...p, panelTitle: e.target.value }
                                    : p
                                );
                                setVascularData({ ...vascularData, focalPanels: updated });
                              }}
                              className="bg-slate-950 border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-200 font-mono outline-none w-full"
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-200 truncate" title={focal.panelTitle}>
                              {focal.panelTitle}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleFlipVascularPanel(focal)}
                            className={`p-1 text-[9px] font-mono font-bold rounded flex items-center gap-0.5 transition-all cursor-pointer ${
                              focal.isCustomFlipped
                                ? "bg-amber-600 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300"
                            }`}
                            title="Voltear horizontalmente (Espejo)"
                          >
                            <FlipHorizontal className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomPanel(focal)}
                            className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700"
                            title="Ampliar"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFocalPanel(focal.panelLetter)}
                            className="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-950/80 rounded bg-slate-800 border border-slate-700 hover:border-rose-500/50 transition-colors cursor-pointer"
                            title="Eliminar esta imagen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingPanelLetter(
                                isEditingThis ? null : focal.panelLetter
                              )
                            }
                            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                              isEditingThis
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-800 hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200"
                            }`}
                          >
                            <RefreshCw className={`h-2.5 w-2.5 ${isRegeneratingThis ? "animate-spin" : ""}`} />
                            <span>Ajustar</span>
                          </button>
                        </div>
                      </div>

                      {/* Compass mini bar */}
                      <div className="px-2.5 py-0.5 bg-slate-950 border-b border-slate-800 text-[8px] font-mono flex items-center justify-between text-slate-500">
                        <span className="text-indigo-400 truncate">👈 {compass.leftTag}</span>
                        <span className="text-cyan-400 truncate text-right">{compass.rightTag} 👉</span>
                      </div>

                      {/* Image Frame - Tamaño Ampliado para Alta Claridad Visual */}
                      <div className="relative min-h-[280px] max-h-[460px] bg-slate-950 flex items-center justify-center p-2 overflow-hidden">
                        {focal.imageUrl ? (
                          <img
                            src={focal.imageUrl}
                            alt={focal.panelTitle}
                            className="max-h-[440px] w-auto max-w-full object-contain rounded shadow cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => setZoomPanel(focal)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 text-slate-400">
                            <Activity className="h-6 w-6 text-slate-300 animate-pulse mb-1" />
                            <span className="text-[11px] font-mono">Renderizando Panel...</span>
                          </div>
                        )}

                        {isRegeneratingThis && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 p-3">
                            <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin" />
                            <span className="text-[11px] font-mono font-bold text-indigo-300">
                              Regenerando Panel {focal.panelLetter}...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Inline modification drawer */}
                      {isEditingThis && (
                        <div className="p-2.5 bg-slate-900 border-t border-indigo-500/40 space-y-2 animate-fadeIn">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono font-bold text-indigo-300">
                              Cambios para Panel {focal.panelLetter}:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingPanelLetter(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>

                          <textarea
                            value={panelDirectives[focal.panelLetter] || ""}
                            onChange={(e) =>
                              setPanelDirectives({
                                ...panelDirectives,
                                [focal.panelLetter]: e.target.value
                              })
                            }
                            placeholder="Ej: Cambiar a vista transversal de la luz residual con área de 3.5 mm2 y placa hipoecoica concéntrica..."
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg p-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none font-sans"
                          />

                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              disabled={isRegeneratingThis}
                              onClick={() => handleRegenerateVascularPanel(focal)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-mono font-bold rounded shadow flex items-center gap-1 cursor-pointer"
                            >
                              {isRegeneratingThis ? (
                                <>
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  <span>Regenerando...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-2.5 w-2.5" />
                                  <span>Aplicar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Semiologic Focus Footer */}
                    <div className="p-2.5 bg-slate-900/60 border-t border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] font-mono">
                        <span className="text-indigo-400 font-bold">{focal.vesselSegment}</span>
                        {focal.stenosisDegree && (
                          <span className="text-amber-400 font-black">{focal.stenosisDegree}</span>
                        )}
                      </div>
                      {isEditingAllTexts ? (
                        <textarea
                          value={focal.anatomicalFocus}
                          onChange={(e) => {
                            const updated = vascularData.focalPanels.map((p) =>
                              p.panelLetter === focal.panelLetter
                                ? { ...p, anatomicalFocus: e.target.value }
                                : p
                            );
                            setVascularData({ ...vascularData, focalPanels: updated });
                          }}
                          rows={2}
                          className="w-full bg-slate-950 border border-amber-500/50 rounded p-1 text-[11px] text-amber-200 font-mono outline-none"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-300 leading-snug">
                          {focal.anatomicalFocus}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: TABLA HEMODINÁMICA TOTALMENTE ADAPTADA POR PROTOCOLO */}
          {(() => {
            const rawStudyType = vascularData.vascularStudyType || selectedStudyType || "";
            const textContext = `${vascularData.vascularTerritory || ""} ${activeProtocol || ""} ${vascularData.figureTitle || ""} ${selectedStudyType || ""}`;

            const isVenous = rawStudyType === "venous_mmii" ||
              /venoso|venas|safena|trombosis|tvp|flebopatia|reflujo venoso/i.test(textContext);

            const isArterialMMII = !isVenous && (rawStudyType === "arterial_mmii" ||
              /arterial.*mmii|arteria.*inferior|arterial.*pierna|femoral|popl[ií]tea|tibial|peronea|pedia|itb|claudicac/i.test(textContext));

            const isAortoiliac = !isVenous && !isArterialMMII && (rawStudyType === "aortoiliac" ||
              /aortoil[ií]ac|aorta abdominal|aneurisma.*aort|il[ií]aca com[uú]n|il[ií]aca externa|bifurcac.*a[oó]rt/i.test(textContext));

            const isRenal = !isVenous && !isArterialMMII && !isAortoiliac && (rawStudyType === "renal" ||
              /renal|renales|estenosis.*renal|riñ[oó]n|rar|resistiv.*renal|par[eé]nquima renal/i.test(textContext));

            // Table Title and Subtitle
            const tableTitle = isVenous
              ? "Tabla de Exploración Venosa & Mapeo de Insuficiencia / Permeabilidad"
              : isArterialMMII
              ? "Tabla Hemodinámica Arterial MMII & Mapeo de Estenosis / Oclusión"
              : isAortoiliac
              ? "Tabla de Exploración Aortoilíaca & Mapeo Morfométrico / Hemodinámico"
              : isRenal
              ? "Tabla de Exploración Renovascular & Hemodinamia Intraparenquimatosa"
              : "Tabla Hemodinámica & Mapeo de Lesiones Carotídeas";

            const tableSubtitle = isEditingAllTexts
              ? "Modo de edición activo (puedes modificar todos los valores directamente)"
              : isVenous
              ? "Compresibilidad, trombosis intraluminal, reflujo valvular, calibre y fasismo"
              : isArterialMMII
              ? "Morfología de onda, PSV (cm/s), Vr (Ratio sistólico), % estenosis, morfología de placa e impacto"
              : isAortoiliac
              ? "Diámetros AP/transverso, placa/trombo mural, PSV, Vr, onda y permeabilidad"
              : isRenal
              ? "Velocidades ostiales (PSV), Relación RAR, tiempos de aceleración (AT), índice de resistividad (IR) y eje renal"
              : "Morfología de placa, % estenosis NASCET, perfiles espectrales PSV/EDV y ratio ACI/ACC";

            const tableThemeColor = isVenous
              ? "text-cyan-400"
              : isArterialMMII
              ? "text-rose-400"
              : isAortoiliac
              ? "text-amber-400"
              : isRenal
              ? "text-purple-400"
              : "text-emerald-400";

            return (
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Table className={`h-4 w-4 ${tableThemeColor}`} />
                    <h4 className="text-xs font-mono font-black text-slate-200 uppercase tracking-wider">
                      {tableTitle}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {tableSubtitle}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {isVenous ? (
                        <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-cyan-400/90 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[160px]">Sistema / Vena & Segmento</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Compresibilidad</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Trombosis / Luz</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Reflujo / Competencia</th>
                          <th className="py-2.5 px-3 min-w-[100px]">Calibre (mm)</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Patrón / Fasismo</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Impacto / Estado</th>
                        </tr>
                      ) : isArterialMMII ? (
                        <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-rose-400/90 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[130px]">Arteria & Segmento</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Morfología de Onda</th>
                          <th className="py-2.5 px-3 min-w-[120px]">PSV (cm/s)</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Ratio Vr (V2/V1)</th>
                          <th className="py-2.5 px-3 min-w-[120px]">% Estenosis / Oclusión</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Placa & Calidad Parietal</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Impacto Hemodinámico</th>
                        </tr>
                      ) : isAortoiliac ? (
                        <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-amber-400/90 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[130px]">Segmento Aorto-Ilíaco</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Diámetro AP (mm)</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Placa / Trombo Mural</th>
                          <th className="py-2.5 px-3 min-w-[110px]">PSV (cm/s)</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Ratio Vr / % Estenosis</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Patrón de Onda</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Impacto Morfológico</th>
                        </tr>
                      ) : isRenal ? (
                        <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-purple-400/90 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[130px]">Estructura / Arteria</th>
                          <th className="py-2.5 px-3 min-w-[110px]">PSV (cm/s)</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Relación RAR</th>
                          <th className="py-2.5 px-3 min-w-[120px]">T. Aceleración (AT ms)</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Índice Resistividad (IR)</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Longitud Renal / Eje</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Diagnóstico Hemodinámico</th>
                        </tr>
                      ) : (
                        <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3 min-w-[130px]">Vaso & Segmento</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Morfología de Placa / Trombo</th>
                          <th className="py-2.5 px-3 min-w-[110px]">% Estenosis (NASCET)</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Patrón (PSV/EDV)</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Relación ACC/ACI</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Impacto Hemodinámico</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-sans text-slate-300">
                      {vascularData.hemodynamicTable.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/50 transition-colors">
                          {/* Columna común: Vaso / Segmento */}
                          <td className="py-2.5 px-3 font-mono leading-relaxed break-words">
                            {isVenous && (
                              <div className="mb-1">
                                {isEditingAllTexts ? (
                                  <select
                                    value={row.systemCategory || (
                                      /perforan|cockett|boyd|dodd|hunter/i.test(`${row.vessel} ${row.segment}`) ? "Perforante Insuficiente" :
                                      /cayado|uni[oó]n|usf|usp|safenofemoral|safenopopl/i.test(`${row.vessel} ${row.segment}`) ? "Cayados / Uniones" :
                                      /safena|vsm|vsp|epig[aá]strica|accesoria/i.test(`${row.vessel} ${row.segment}`) ? "Sistema Superficial" :
                                      "Sistema Profundo"
                                    )}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].systemCategory = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    className="bg-slate-900 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[10px] text-cyan-200 font-mono w-full"
                                  >
                                    <option value="Sistema Profundo">SVP (Sistema Profundo)</option>
                                    <option value="Cayados / Uniones">CAYADO (Unión Safenofemoral / Safenopoplítea)</option>
                                    <option value="Sistema Superficial">SVS (Sistema Superficial - Safenas)</option>
                                    <option value="Perforante Insuficiente">PERFORANTE (Vena Perforante)</option>
                                  </select>
                                ) : (
                                  (() => {
                                    const cat = row.systemCategory || "";
                                    const combined = `${row.vessel} ${row.segment} ${cat}`.toLowerCase();
                                    const isPerf = cat.includes("Perforan") || /perforan|cockett|boyd|dodd|hunter/i.test(combined);
                                    const isArch = cat.includes("Cayado") || cat.includes("Unión") || /cayado|uni[oó]n|usf|usp|safenofemoral|safenopopl/i.test(combined);
                                    const isSuperficial = cat.includes("Superficial") || /safena|vsm|vsp|epig[aá]strica|accesoria/i.test(combined);
                                    
                                    if (isPerf) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-600/40">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                          PERFORANTE
                                        </span>
                                      );
                                    }
                                    if (isArch) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-950/80 text-teal-300 border border-teal-600/40">
                                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                                          CAYADO / UNIÓN
                                        </span>
                                      );
                                    }
                                    if (isSuperficial) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-950/80 text-sky-300 border border-sky-600/40">
                                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                          SIST. SUPERFICIAL
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-600/40">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                        SIST. PROFUNDO
                                      </span>
                                    );
                                  })()
                                )}
                              </div>
                            )}

                            {isEditingAllTexts ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={row.vessel}
                                  placeholder="Nombre de vena"
                                  onChange={(e) => {
                                    const updated = [...vascularData.hemodynamicTable];
                                    updated[rIdx].vessel = e.target.value;
                                    setVascularData({ ...vascularData, hemodynamicTable: updated });
                                  }}
                                  className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                />
                                <input
                                  type="text"
                                  value={row.segment || ""}
                                  placeholder="Segmento / Localización"
                                  onChange={(e) => {
                                    const updated = [...vascularData.hemodynamicTable];
                                    updated[rIdx].segment = e.target.value;
                                    setVascularData({ ...vascularData, hemodynamicTable: updated });
                                  }}
                                  className="bg-slate-900 border border-amber-500/30 rounded px-1.5 py-0.5 text-[10px] text-amber-100 font-mono w-full"
                                />
                              </div>
                            ) : (
                              <div className="font-bold text-indigo-300">
                                {row.vessel} {row.segment ? <span className="text-slate-400 font-normal">({row.segment})</span> : ""}
                              </div>
                            )}
                          </td>

                          {/* CASO 1: VENOSO MMII */}
                          {isVenous ? (
                            <>
                              <td className="py-2.5 px-3 text-[11px] leading-relaxed text-slate-300 break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.compressibility || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].compressibility = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. 100% Compresible / Luz anecoica"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  <span className={row.compressibility && /no compresible|parcial/i.test(row.compressibility) ? "text-rose-400 font-bold" : "font-medium text-emerald-300"}>
                                    {row.compressibility || "100% Compresible"}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-[11px] leading-relaxed text-slate-300 break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.thrombusPresence || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].thrombusPresence = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Ausente / Sin ecos endoluminales"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  <span className={row.thrombusPresence && /trombo|agudo|oclus/i.test(row.thrombusPresence) ? "text-rose-400 font-bold" : "text-slate-300"}>
                                    {row.thrombusPresence || "Ausente"}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-[11px] leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.valvularReflux || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].valvularReflux = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Competente (<500 ms) / Reflujo >500 ms"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.valvularReflux && /refluj|patol|incompet|>500|>1000|>350/i.test(row.valvularReflux) ? "text-amber-400 font-bold" : "text-cyan-300 font-semibold"}>
                                    {row.valvularReflux || "Competente (<500 ms)"}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-[11px] text-teal-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.veinCaliber || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].veinCaliber = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 3.8 mm / 7.2 mm"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.veinCaliber || "-"}</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words font-mono">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.flowPhasicity || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].flowPhasicity = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Espontáneo y fásico respiratorio"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  row.flowPhasicity || "Espontáneo y fásico respiratorio"
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <div className="space-y-1">
                                    <textarea
                                      value={row.hemodynamicImpact || row.clinicalSignificance || ""}
                                      onChange={(e) => {
                                        const updated = [...vascularData.hemodynamicTable];
                                        updated[rIdx].hemodynamicImpact = e.target.value;
                                        updated[rIdx].clinicalSignificance = e.target.value;
                                        setVascularData({ ...vascularData, hemodynamicTable: updated });
                                      }}
                                      rows={2}
                                      placeholder="ej. Insuficiencia troncular / Permeable"
                                      className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = vascularData.hemodynamicTable.filter((_, idx) => idx !== rIdx);
                                        setVascularData({ ...vascularData, hemodynamicTable: updated });
                                      }}
                                      className="text-[10px] text-rose-400 hover:text-rose-300 font-mono underline"
                                    >
                                      🗑️ Eliminar fila
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[11px]">
                                    {row.hemodynamicImpact || row.clinicalSignificance || "Permeabilidad conservada"}
                                  </span>
                                )}
                              </td>
                            </>
                          ) : isArterialMMII ? (
                            /* CASO 2: ARTERIAL MMII */
                            <>
                              {/* 1. Morfología de Onda */}
                              <td className="py-2.5 px-3 text-[11px] font-mono leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.waveMorphology || row.flowPhasicity || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].waveMorphology = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Trifásico de alta resistencia / Monofásico"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={
                                    /monof|parvus|tardus|oclus/i.test(row.waveMorphology || row.flowPhasicity || "")
                                      ? "text-rose-400 font-bold"
                                      : /bif[aá]s/i.test(row.waveMorphology || row.flowPhasicity || "")
                                      ? "text-amber-400 font-semibold"
                                      : "text-emerald-300 font-medium"
                                  }>
                                    {row.waveMorphology || row.flowPhasicity || "Trifásico"}
                                  </span>
                                )}
                              </td>

                              {/* 2. PSV (cm/s) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.psv || row.hemodynamicPattern || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].psv = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 85 cm/s / 260 cm/s"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.psv || row.hemodynamicPattern || "-"}</span>
                                )}
                              </td>

                              {/* 3. Ratio Vr (V2/V1) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-teal-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.vrRatio || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].vrRatio = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. Vr: 2.8 / Vr: 1.1"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.vrRatio && />[2-9]|2\.[0-9]|3\.|4\./.test(row.vrRatio) ? "text-amber-400 font-bold" : "text-teal-300"}>
                                    {row.vrRatio || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 4. % Estenosis / Oclusión */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.stenosisPercent || row.stenosisPercentOrReflux || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].stenosisPercent = e.target.value;
                                      updated[rIdx].stenosisPercentOrReflux = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 70-75% / Oclusión"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.stenosisPercent || row.stenosisPercentOrReflux || "-"}</span>
                                )}
                              </td>

                              {/* 5. Placa & Calidad Parietal */}
                              <td className="py-2.5 px-3 text-[11px] leading-relaxed text-slate-300 break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.plaqueMorphology || row.plaqueOrThrombusMorphology || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].plaqueMorphology = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Placa fibrocalcificada difusa"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.plaqueMorphology || row.plaqueOrThrombusMorphology || "-"
                                )}
                              </td>

                              {/* 6. Impacto Hemodinámico */}
                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.hemodynamicImpact || row.clinicalSignificance || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].hemodynamicImpact = e.target.value;
                                      updated[rIdx].clinicalSignificance = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.hemodynamicImpact || row.clinicalSignificance || "-"
                                )}
                              </td>
                            </>
                          ) : isAortoiliac ? (
                            /* CASO 3: AORTOILÍACO */
                            <>
                              {/* 1. Diámetro AP (mm) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.diameterMm || row.veinCaliber || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].diameterMm = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 19 mm (Normal) / 44 mm (Aneurisma)"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.diameterMm && /aneur|ectas|>30|>40/i.test(row.diameterMm) ? "text-rose-400 font-bold" : "text-amber-300"}>
                                    {row.diameterMm || row.veinCaliber || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 2. Placa / Trombo Mural */}
                              <td className="py-2.5 px-3 text-[11px] leading-relaxed text-slate-300 break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.plaqueMorphology || row.plaqueOrThrombusMorphology || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].plaqueMorphology = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Trombo mural semilunar / Calcificación"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.plaqueMorphology || row.plaqueOrThrombusMorphology || "-"
                                )}
                              </td>

                              {/* 3. PSV (cm/s) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.psv || row.hemodynamicPattern || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].psv = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 95 cm/s / 280 cm/s"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.psv || row.hemodynamicPattern || "-"}</span>
                                )}
                              </td>

                              {/* 4. Ratio Vr / % Estenosis */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-teal-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.vrRatio || row.stenosisPercentOrReflux || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].vrRatio = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. Vr: 3.2 / 60%"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.vrRatio || row.stenosisPercentOrReflux || "-"}</span>
                                )}
                              </td>

                              {/* 5. Patrón de Onda */}
                              <td className="py-2.5 px-3 text-[11px] font-mono leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.waveMorphology || row.flowPhasicity || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].waveMorphology = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    placeholder="ej. Trifásico de alta resistencia"
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className="text-slate-300 font-medium">
                                    {row.waveMorphology || row.flowPhasicity || "Trifásico"}
                                  </span>
                                )}
                              </td>

                              {/* 6. Impacto Morfológico */}
                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.hemodynamicImpact || row.clinicalSignificance || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].hemodynamicImpact = e.target.value;
                                      updated[rIdx].clinicalSignificance = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.hemodynamicImpact || row.clinicalSignificance || "-"
                                )}
                              </td>
                            </>
                          ) : isRenal ? (
                            /* CASO 4: RENAL */
                            <>
                              {/* 1. PSV (cm/s) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.psv || row.hemodynamicPattern || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].psv = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 255 cm/s (>180) / 88 cm/s"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.psv && />180|2[0-9]{2}|3[0-9]{2}/.test(row.psv) ? "text-rose-400 font-bold" : "text-cyan-300"}>
                                    {row.psv || row.hemodynamicPattern || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 2. Relación RAR (Renal / Aorta) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-purple-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.rarRatio || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].rarRatio = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. RAR: 3.6 (>3.5) / 1.2"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.rarRatio && />3\.5|3\.[6-9]|[4-9]\./.test(row.rarRatio) ? "text-amber-400 font-bold" : "text-purple-300"}>
                                    {row.rarRatio || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 3. T. Aceleración (AT ms) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-teal-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.accelerationTime || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].accelerationTime = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. AT: 110 ms (>70) / 42 ms"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.accelerationTime && />70|8[0-9]|9[0-9]|1[0-9]{2}/.test(row.accelerationTime) ? "text-rose-400 font-bold" : "text-teal-300"}>
                                    {row.accelerationTime || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 4. Índice de Resistividad (IR / RI) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.resistiveIndex || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].resistiveIndex = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. IR: 0.63 / 0.82"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span className={row.resistiveIndex && />0\.70|0\.[7-9]|>0\.8/.test(row.resistiveIndex) ? "text-amber-400 font-bold" : "text-emerald-300"}>
                                    {row.resistiveIndex || "-"}
                                  </span>
                                )}
                              </td>

                              {/* 5. Longitud Renal / Eje */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300 font-semibold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.renalLength || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].renalLength = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. Eje: 108 mm / 82 mm (Atrofia)"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.renalLength || "-"}</span>
                                )}
                              </td>

                              {/* 6. Diagnóstico Hemodinámico */}
                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.hemodynamicImpact || row.clinicalSignificance || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].hemodynamicImpact = e.target.value;
                                      updated[rIdx].clinicalSignificance = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.hemodynamicImpact || row.clinicalSignificance || "-"
                                )}
                              </td>
                            </>
                          ) : (
                            /* CASO 5: CAROTÍDEO / GENERAL */
                            <>
                              {/* 1. Morfología Placa / Trombo */}
                              <td className="py-2.5 px-3 text-[11px] leading-relaxed text-slate-300 break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.plaqueOrThrombusMorphology}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].plaqueOrThrombusMorphology = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.plaqueOrThrombusMorphology || "-"
                                )}
                              </td>

                              {/* 2. % Estenosis NASCET */}
                              <td className="py-2.5 px-3 font-mono text-amber-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.stenosisPercentOrReflux}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].stenosisPercentOrReflux = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  row.stenosisPercentOrReflux || "-"
                                )}
                              </td>

                              {/* 3. Patrón Hemodinámico (PSV/EDV) */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.hemodynamicPattern}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].hemodynamicPattern = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  row.hemodynamicPattern || "-"
                                )}
                              </td>

                              {/* 4. Relación ACC/ACI */}
                              <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-300 font-bold leading-relaxed whitespace-nowrap">
                                {isEditingAllTexts ? (
                                  <input
                                    type="text"
                                    value={row.icaCcaRatio || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].icaCcaRatio = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    placeholder="ej. 3.4 / <2.0"
                                    className="bg-slate-900 border border-amber-500/40 rounded px-1.5 py-1 text-xs text-amber-200 font-mono w-full"
                                  />
                                ) : (
                                  <span>{row.icaCcaRatio || "-"}</span>
                                )}
                              </td>

                              {/* 5. Impacto Hemodinámico / Anatómico */}
                              <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-relaxed break-words">
                                {isEditingAllTexts ? (
                                  <textarea
                                    value={row.hemodynamicImpact || row.clinicalSignificance || ""}
                                    onChange={(e) => {
                                      const updated = [...vascularData.hemodynamicTable];
                                      updated[rIdx].hemodynamicImpact = e.target.value;
                                      updated[rIdx].clinicalSignificance = e.target.value;
                                      setVascularData({ ...vascularData, hemodynamicTable: updated });
                                    }}
                                    rows={2}
                                    className="bg-slate-900 border border-amber-500/40 rounded p-1.5 text-xs text-amber-200 font-sans w-full"
                                  />
                                ) : (
                                  row.hemodynamicImpact || row.clinicalSignificance || "-"
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isEditingAllTexts && (
                  <div className="pt-2 flex flex-wrap gap-2 justify-end border-t border-slate-850">
                    <button
                      type="button"
                      onClick={() => {
                        const newRow: any = isVenous ? {
                          systemCategory: "Perforante Insuficiente",
                          vessel: "Vena Perforante de Cockett / Paratibial",
                          segment: "Tercio Inferior Medial de Pierna",
                          compressibility: "100% Compresible",
                          thrombusPresence: "Ausente",
                          valvularReflux: "Reflujo patológico >350 ms",
                          veinCaliber: "4.2 mm",
                          flowPhasicity: "Flujo bidireccional al descomprimir",
                          hemodynamicImpact: "Perforante incompetente con reflujo hacia várices"
                        } : isArterialMMII ? {
                          vessel: "Arteria Tibial Anterior",
                          segment: "Tercio Medio",
                          waveMorphology: "Trifásico de alta resistencia",
                          psv: "75 cm/s",
                          vrRatio: "1.0",
                          stenosisPercent: "<50%",
                          plaqueMorphology: "Paredes lisas sin placa significativa",
                          hemodynamicImpact: "Flujo arterial conservado"
                        } : {
                          vessel: "Vaso / Segmento adicional",
                          segment: "Segmento",
                          plaqueOrThrombusMorphology: "Sin placa",
                          stenosisDegree: "<50%",
                          hemodynamicPattern: "Normal",
                          icaCcaRatio: "1.0",
                          hemodynamicImpact: "Conservado"
                        };
                        setVascularData({
                          ...vascularData,
                          hemodynamicTable: [...vascularData.hemodynamicTable, newRow]
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 rounded-lg text-xs font-mono text-indigo-200 transition-colors shadow-sm"
                    >
                      <span>➕ Añadir Fila {isVenous ? "Venosa (Profundo / Superficial / Cayado / Perforante)" : "a la Tabla"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 4: SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA EDITABLE */}
          <div className="p-4 sm:p-5 bg-slate-950/90 border border-indigo-500/30 rounded-2xl space-y-3 overflow-hidden shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Síntesis Morfológica y Hemodinámica:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isEditingAllTexts ? "✏️ Editando texto de síntesis" : "Caracterización descriptiva integral"}
              </span>
            </div>

            {isEditingAllTexts ? (
              <textarea
                value={vascularData.hemodynamicSynthesis || vascularData.surgicalHemodynamicSynthesis || ""}
                onChange={(e) =>
                  setVascularData({
                    ...vascularData,
                    hemodynamicSynthesis: e.target.value,
                    surgicalHemodynamicSynthesis: e.target.value
                  })
                }
                rows={4}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-xl p-3.5 text-xs text-amber-200 font-sans outline-none leading-relaxed break-words resize-y min-h-[90px]"
              />
            ) : (
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 overflow-hidden">
                <p className="text-xs text-slate-200 font-sans leading-relaxed break-words whitespace-pre-wrap">
                  {vascularData.hemodynamicSynthesis || vascularData.surgicalHemodynamicSynthesis || "Sin hallazgos morfológicos ni hemodinámicos significativos descritos."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal with Compass and Flip */}
      {zoomPanel && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col animate-fadeIn">
          <div className="bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-bold text-xs rounded">
                PANEL {zoomPanel.panelLetter}
              </span>
              <span className="text-sm font-bold text-white truncate font-mono">
                {zoomPanel.panelTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleFlipVascularPanel(zoomPanel)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                  zoomPanel.isCustomFlipped
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300"
                }`}
                title="Invertir orientación / Voltear horizontalmente"
              >
                <FlipHorizontal className="h-4 w-4" />
                <span>Voltear Espejo</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPanelImage(zoomPanel)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Descargar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (zoomPanel.panelCategory === "roadmap") {
                    handleDeleteRoadmap();
                  } else {
                    handleDeleteFocalPanel(zoomPanel.panelLetter);
                  }
                }}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/50 hover:text-rose-100 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Eliminar esta imagen"
              >
                <Trash2 className="h-4 w-4" />
                <span>Eliminar</span>
              </button>

              <button
                type="button"
                onClick={() => setZoomPanel(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Compass banner in modal */}
          {(() => {
            const compass = getVascularCompassInfo(zoomPanel);
            return (
              <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-400">
                <span className="text-rose-400 font-bold">👈 {compass.leftTag}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-black">
                  {compass.title}
                </span>
                <span className="text-sky-400 font-bold">{compass.rightTag} 👉</span>
              </div>
            );
          })()}

          <div className="flex-1 bg-white p-4 flex items-center justify-center overflow-auto">
            <img
              src={zoomPanel.imageUrl}
              alt={zoomPanel.panelTitle}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 font-mono flex items-center justify-between">
            <span>{zoomPanel.vesselSegment}: {zoomPanel.anatomicalFocus}</span>
            <span className="text-slate-500">Esc para cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
};
