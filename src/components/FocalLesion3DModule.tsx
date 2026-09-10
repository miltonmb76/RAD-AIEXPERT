import React, { useState } from "react";
import {
  Crosshair,
  Sparkles,
  Loader2,
  Trash2,
  ZoomIn,
  FlipHorizontal,
  RefreshCw,
  X,
  Compass,
  Target,
  Wand2,
  Info
} from "lucide-react";
import { FocalLesion3DData, FocalLesion3DPanel, ClinicalScorecardData } from "../types";
import { buildAtlasDirectivesFromScorecard } from "../lib/clinicalIntelligence";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";

interface FocalLesion3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  focalData: FocalLesion3DData | null;
  setFocalData: (data: FocalLesion3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
  onClose?: () => void;
}

export const FocalLesion3DModule: React.FC<FocalLesion3DModuleProps> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  focalData,
  setFocalData,
  includeInReport,
  setIncludeInReport,
  scorecardData,
  externalDirectives,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<FocalLesion3DPanel | null>(null);
  const [customDirectives, setCustomDirectives] = useState("");
  const [focusMode, setFocusMode] = useState<"auto" | "manual">("auto");
  const [focusText, setFocusText] = useState("");
  const [includeMacroPanel, setIncludeMacroPanel] = useState(true);
  const [selectedLaterality, setSelectedLaterality] = useState(() =>
    laterality && laterality.trim() ? laterality.trim() : "auto"
  );
  const [editingPanelLetter, setEditingPanelLetter] = useState<string | null>(null);
  const [panelDirectives, setPanelDirectives] = useState<Record<string, string>>({});
  const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);

  React.useEffect(() => {
    if (externalDirectives && externalDirectives.trim()) {
      setCustomDirectives((prev) => {
        if (prev.includes("PATOLOGÍA ACTIVA DEL SCORECARD")) return externalDirectives.trim();
        if (!prev.trim()) return externalDirectives.trim();
        return prev;
      });
    }
  }, [externalDirectives]);

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setErrorMessage("Redacta o genera primero el informe para anclar el corte focal.");
      return;
    }
    if (focusMode === "manual" && !focusText.trim()) {
      setErrorMessage("En modo manual indica la lesión o foco a reconstruir.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep(
      focusMode === "manual"
        ? "Anclando foco manual y contrato espacial..."
        : "Identificando la lesión dominante del informe..."
    );

    const scorecardDirectives = buildAtlasDirectivesFromScorecard(scorecardData || null);
    const mergedDirectives = [scorecardDirectives, customDirectives.trim()]
      .filter(Boolean)
      .join("\n");

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    try {
      stepTimers.push(
        setTimeout(() => setGenerationStep("Renderizando cutaway 3D con fidelidad Atlas..."), 2000)
      );
      stepTimers.push(
        setTimeout(
          () => setGenerationStep("Verificando lateralidad, sitio y morfología (auto-corrección)..."),
          8000
        )
      );

      await runBackgroundTask("focal-lesion-3d", "Generando Corte Focal 3D", async () => {
        const response = await fetch("/api/generate-focal-lesion-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            organOrStudy: activeProtocol || "",
            laterality: selectedLaterality !== "auto" ? selectedLaterality : undefined,
            requestedModel: selectedModel,
            customDirectives: mergedDirectives || undefined,
            focusMode,
            focusText: focusMode === "manual" ? focusText.trim() : undefined,
            includeMacroPanel
          })
        });
        const resData = await response.json();
        if (!resData.success) {
          throw new Error(resData.error || "Error al generar el corte focal 3D.");
        }
        setFocalData(resData.data);
        setIncludeInReport(true);
      });
    } catch (err: any) {
      console.error("Error generando corte focal:", err);
      setErrorMessage(err?.message || "Error al procesar el corte focal.");
    } finally {
      stepTimers.forEach(clearTimeout);
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleFlipPanel = async (panelLetter: string) => {
    if (!focalData) return;
    const panel = focalData.panels.find((p) => p.panelLetter === panelLetter);
    if (!panel?.imageUrl) return;
    try {
      const flippedDataUrl = await flipImageDataUrl(panel.imageUrl);
      const nextPanels = focalData.panels.map((p) => {
        if (p.panelLetter !== panelLetter) return p;
        const sc = p.spatialContract
          ? {
              ...p.spatialContract,
              imageLeftStructure: p.spatialContract.imageRightStructure,
              imageRightStructure: p.spatialContract.imageLeftStructure,
              laterality: swapLateralityLabel(p.spatialContract.laterality || p.laterality),
            }
          : p.spatialContract;
        return {
          ...p,
          imageUrl: flippedDataUrl,
          isCustomFlipped: !p.isCustomFlipped,
          laterality: swapLateralityLabel(p.laterality) || p.laterality,
          spatialContract: sc,
        };
      });
      setFocalData({ ...focalData, panels: nextPanels });
      if (zoomPanel?.panelLetter === panelLetter) {
        const updated = nextPanels.find((p) => p.panelLetter === panelLetter);
        if (updated) setZoomPanel(updated);
      }
    } catch (flipErr) {
      console.error("Error al voltear panel focal:", flipErr);
      setErrorMessage("No se pudo voltear la imagen en espejo.");
    }
  };

  const handleRegeneratePanel = async (panel: FocalLesion3DPanel) => {
    if (!focalData) return;
    setRegeneratingPanelLetter(panel.panelLetter);
    setErrorMessage(null);
    try {
      const scorecardDirectives = buildAtlasDirectivesFromScorecard(scorecardData || null);
      const response = await fetch("/api/regenerate-focal-lesion-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          studyRegion: focalData.studyRegion || activeProtocol || "",
          panel,
          laterality: panel.laterality || selectedLaterality,
          userDirective: panelDirectives[panel.panelLetter] || "",
          requestedModel: selectedModel,
          customDirectives: [scorecardDirectives, customDirectives].filter(Boolean).join("\n"),
          lesionLabel: focalData.lesionLabel,
          lesionSite: focalData.lesionSite,
          lesionMorphology: focalData.lesionMorphology
        })
      });
      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || `Error al regenerar panel ${panel.panelLetter}`);
      }
      setFocalData({
        ...focalData,
        panels: focalData.panels.map((p) =>
          p.panelLetter === panel.panelLetter ? resData.panel : p
        )
      });
      setEditingPanelLetter(null);
      setPanelDirectives((prev) => ({ ...prev, [panel.panelLetter]: "" }));
    } catch (err: any) {
      setErrorMessage(err?.message || "Error al regenerar panel.");
    } finally {
      setRegeneratingPanelLetter(null);
    }
  };

  return (
    <div className="bg-slate-900/95 border-2 border-teal-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/40 rounded-2xl text-teal-300 shadow-md">
            <Crosshair className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Corte Focal 3D de la Lesión
              </h3>
              <span className="text-[9px] font-black uppercase font-mono tracking-widest bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                On Demand · Atlas Fidelity
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Cutaway 3D de una sola lesión (auto o manual). No se ejecuta en lote; solo bajo demanda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {focalData && (
            <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-teal-500/30 hover:border-teal-500/60 rounded-xl cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={includeInReport}
                onChange={(e) => setIncludeInReport(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 font-mono">
                {includeInReport ? "✓ Incluido en PDF" : "No incluir en PDF"}
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

      <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-400 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 font-mono">
            Foco de la lesión
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "auto" as const, label: "Auto (lesión dominante)" },
              { id: "manual" as const, label: "Manual (indicar foco)" }
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFocusMode(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                focusMode === opt.id
                  ? "bg-teal-600 border-teal-400 text-white shadow-md"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeMacroPanel}
              onChange={(e) => setIncludeMacroPanel(e.target.checked)}
              className="rounded border-slate-700 text-teal-600 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-300 font-mono uppercase">
              Incluir panel macro
            </span>
          </label>
        </div>
        {focusMode === "manual" && (
          <input
            type="text"
            value={focusText}
            onChange={(e) => setFocusText(e.target.value)}
            placeholder='Ej: "nódulo sólido BI-RADS 4A en CSE mama izquierda 12 mm" o "ruptura parcial supraespinoso"'
            className="w-full bg-slate-900/90 border border-teal-500/30 focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none font-sans"
          />
        )}
      </div>

      <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 font-mono block">
              Lateralidad
            </span>
            <span className="text-[10px] text-slate-400">
              Convención AP: Derecha = lado derecho del paciente de frente (izquierda de la imagen).
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "auto", label: "Auto" },
            { id: "Izquierda", label: "Izquierda" },
            { id: "Derecha", label: "Derecha" },
            { id: "Bilateral", label: "Bilateral" }
          ].map((opt) => {
            const selected = selectedLaterality.toLowerCase() === opt.id.toLowerCase();
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedLaterality(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                  selected
                    ? "bg-teal-600 border-teal-400 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      <div className="p-4 bg-slate-950/90 border border-teal-500/25 rounded-2xl space-y-2">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-teal-400" />
          <label className="text-xs font-black uppercase tracking-wider text-teal-200 font-mono">
            Directiva clínica (opcional)
          </label>
        </div>
        <textarea
          value={customDirectives}
          onChange={(e) => setCustomDirectives(e.target.value)}
          placeholder="Ej: enfatizar márgenes espiculados; no inventar satélites; corte coronal..."
          rows={2}
          className="w-full bg-slate-900/90 border border-slate-800 focus:border-teal-500 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 outline-none resize-y"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Info className="h-4 w-4 text-teal-400 shrink-0" />
          <span>
            {focalData
              ? `Activo: ${focalData.lesionLabel}${focalData.lesionSite ? ` @ ${focalData.lesionSite}` : ""} (${focalData.panels.length} panel${focalData.panels.length > 1 ? "es" : ""}).`
              : "Genera solo cuando lo necesites — no forma parte del lote automático."}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg border border-teal-400/20 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando corte...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>{focalData ? "Regenerar corte focal" : "Generar corte focal 3D"}</span>
              </>
            )}
          </button>
          {focalData && (
            <button
              type="button"
              onClick={() => setFocalData(null)}
              className="p-2.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-xl text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="p-6 bg-slate-950 border border-teal-500/30 rounded-2xl space-y-2 text-center animate-pulse">
          <div className="flex justify-center items-center gap-2">
            <Loader2 className="h-5 w-5 text-teal-400 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-teal-300 font-mono">
              Motor de cutaway focal
            </span>
          </div>
          <p className="text-xs font-bold text-slate-300">{generationStep}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs font-mono">
          {errorMessage}
        </div>
      )}

      {focalData && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-gradient-to-br from-slate-950 via-slate-950 to-teal-950/40 p-5 space-y-4">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-teal-400/90">
                  Hallazgo focal
                </p>
                <h4 className="mt-1 text-lg md:text-xl font-semibold text-teal-50 tracking-tight">
                  {focalData.lesionLabel}
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {focalData.lesionSite && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[12px] text-slate-300">
                    {focalData.lesionSite}
                  </span>
                )}
                {focalData.lesionSize && (
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-700/40 text-[12px] font-mono text-cyan-200">
                    {focalData.lesionSize}
                  </span>
                )}
                {focalData.detectedLaterality && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[12px] text-slate-300">
                    {focalData.detectedLaterality}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {focalData.lesionSummary && (
                <div className="md:col-span-2 rounded-xl border border-teal-800/40 bg-slate-950/70 p-4">
                  <p className="text-[10px] font-mono font-black uppercase tracking-widest text-teal-300 mb-2">
                    Síntesis del hallazgo
                  </p>
                  <p className="text-[13px] md:text-sm text-slate-200 leading-relaxed">
                    {focalData.lesionSummary}
                  </p>
                </div>
              )}
              {focalData.lesionMorphology && (
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                  <p className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 mb-2">
                    Morfología
                  </p>
                  <p className="text-[13px] text-slate-200 leading-relaxed">
                    {focalData.lesionMorphology}
                  </p>
                </div>
              )}
              {focalData.lesionRelations && (
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                  <p className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 mb-2">
                    Relaciones anatómicas
                  </p>
                  <p className="text-[13px] text-slate-200 leading-relaxed">
                    {focalData.lesionRelations}
                  </p>
                </div>
              )}
              {focalData.keyPoints && focalData.keyPoints.length > 0 && (
                <div className="md:col-span-2 rounded-xl border border-emerald-800/40 bg-slate-950/70 p-4">
                  <p className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-300 mb-2">
                    Puntos clave
                  </p>
                  <ul className="space-y-1.5">
                    {focalData.keyPoints.map((kp, i) => (
                      <li key={i} className="text-[13px] text-slate-200 leading-relaxed flex gap-2">
                        <span className="text-emerald-400/90 shrink-0">•</span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              focalData.panels.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-xl mx-auto"
            }`}
          >
            {focalData.panels.map((panel) => (
              <div
                key={panel.id || panel.panelLetter}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-slate-900 group">
                  {panel.imageUrl ? (
                    <img
                      src={panel.imageUrl}
                      alt={panel.panelTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                      Sin imagen
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="text-[9px] font-black uppercase bg-teal-700/90 text-white px-2 py-0.5 rounded-md font-mono">
                      Panel {panel.panelLetter}
                    </span>
                    <span className="text-[9px] font-black uppercase bg-slate-900/80 text-teal-200 px-2 py-0.5 rounded-md font-mono border border-teal-500/30">
                      {panel.panelRole === "macro" ? "Macro" : "Contexto"}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setZoomPanel(panel)}
                      className="p-1.5 bg-slate-950/90 border border-slate-700 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                      title="Ampliar"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFlipPanel(panel.panelLetter)}
                      className="p-1.5 bg-slate-950/90 border border-slate-700 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                      title="Voltear horizontal"
                    >
                      <FlipHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {regeneratingPanelLetter === panel.panelLetter && (
                    <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-teal-400 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2 border-t border-slate-800">
                  <p className="text-xs font-bold text-slate-100">{panel.panelTitle}</p>
                  <p className="text-[11px] text-slate-400 leading-snug">{panel.anatomicalFocus}</p>
                  {editingPanelLetter === panel.panelLetter ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={panelDirectives[panel.panelLetter] || ""}
                        onChange={(e) =>
                          setPanelDirectives((prev) => ({
                            ...prev,
                            [panel.panelLetter]: e.target.value
                          }))
                        }
                        placeholder="Corrección (sitio, morfología, lateralidad)..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-teal-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRegeneratePanel(panel)}
                          className="flex-1 px-2 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Regenerar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPanelLetter(null)}
                          className="px-2 py-1.5 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingPanelLetter(panel.panelLetter)}
                      className="text-[10px] font-black uppercase tracking-wider text-teal-400 hover:text-teal-300 cursor-pointer"
                    >
                      Corregir / regenerar panel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {zoomPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomPanel(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomPanel(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            {zoomPanel.imageUrl && (
              <img
                src={zoomPanel.imageUrl}
                alt={zoomPanel.panelTitle}
                className="w-full rounded-xl"
              />
            )}
            <p className="mt-3 text-center text-sm text-slate-200 font-mono">
              Panel {zoomPanel.panelLetter} — {zoomPanel.panelTitle}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
