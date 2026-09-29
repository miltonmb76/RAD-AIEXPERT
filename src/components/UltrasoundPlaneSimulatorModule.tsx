import React, { useMemo, useState } from "react";
import {
  Scan,
  Sparkles,
  Loader2,
  RefreshCw,
  Maximize2,
  X,
  FlipHorizontal,
  Crosshair,
  Layers,
} from "lucide-react";
import {
  UsAcquisitionPlane,
  UsPlaneSimulatorData,
  UsPlaneSimulatorPanel,
  ClinicalScorecardData,
} from "../types";
import { buildAtlasDirectivesFromScorecard } from "../lib/clinicalIntelligence";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";

interface Props {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  planeData: UsPlaneSimulatorData | null;
  setPlaneData: (data: UsPlaneSimulatorData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (v: boolean) => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

const PLANE_CHIPS: { id: UsAcquisitionPlane; label: string; directive: string }[] = [
  {
    id: "longitudinal",
    label: "Longitudinal",
    directive: "CORRECCIÓN: forzar plano LONGITUDINAL / eje largo del transductor.",
  },
  {
    id: "transverse",
    label: "Transversal",
    directive: "CORRECCIÓN: forzar plano TRANSVERSAL / eje corto del transductor.",
  },
  {
    id: "oblique",
    label: "Oblicuo",
    directive: "CORRECCIÓN: forzar plano OBLICUO de adquisición.",
  },
];

const SIDE_CHIPS = [
  { label: "Derecha", directive: "CORRECCIÓN LATERALIDAD: lado anatómico DERECHO del paciente (AP)." },
  { label: "Izquierda", directive: "CORRECCIÓN LATERALIDAD: lado anatómico IZQUIERDO del paciente (AP)." },
];

const FINE_CHIPS = [
  { label: "Girar +15°", directive: "Rotate acquisition plane +15° around the target structure; keep laterality." },
  { label: "Girar −15°", directive: "Rotate acquisition plane -15° around the target structure; keep laterality." },
  { label: "Acercar hallazgo", directive: "Tighten framing on the reported finding; keep the same acquisition plane." },
  { label: "Plano del informe", directive: "FORCE plane exactly as stated in the report; discard aesthetic alternatives." },
];

export const UltrasoundPlaneSimulatorModule: React.FC<Props> = ({
  reportText,
  activeProtocol,
  laterality,
  selectedModel,
  planeData,
  setPlaneData,
  includeInReport,
  setIncludeInReport,
  scorecardData,
  externalDirectives,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<UsPlaneSimulatorPanel | null>(null);
  const [regeneratingLetter, setRegeneratingLetter] = useState<string | null>(null);
  const [forcedPlane, setForcedPlane] = useState<UsAcquisitionPlane | "auto">("auto");

  const mergedDirectives = useMemo(() => {
    const fromScore = buildAtlasDirectivesFromScorecard(scorecardData || null);
    return [fromScore, externalDirectives].filter(Boolean).join("\n").trim();
  }, [scorecardData, externalDirectives]);

  const handleGenerate = async (planeOverride?: UsAcquisitionPlane | "auto") => {
    if (!reportText?.trim()) {
      setErrorMessage("Necesitas un informe para anclar el plano de adquisición.");
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Detectando órgano, lado y plano del informe...");

    const plane =
      planeOverride && planeOverride !== "auto"
        ? planeOverride
        : forcedPlane !== "auto"
          ? forcedPlane
          : undefined;

    const timers: ReturnType<typeof setTimeout>[] = [];
    try {
      timers.push(
        setTimeout(() => setGenerationStep("Renderizando anatomía 3D + plano del transductor..."), 1800)
      );
      timers.push(
        setTimeout(() => setGenerationStep("Verificando plano y lateralidad..."), 7000)
      );

      await runBackgroundTask("us-plane-sim", "Simulador de plano ecográfico", async () => {
        const response = await fetch("/api/generate-us-plane-simulator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportText,
            organOrStudy: activeProtocol || "",
            laterality: laterality && laterality !== "auto" ? laterality : undefined,
            requestedModel: selectedModel,
            customDirectives: mergedDirectives || undefined,
            forcedPlane: plane,
          }),
        });
        const resData = await response.json();
        if (!resData.success) throw new Error(resData.error || "No se pudo generar el simulador.");
        setPlaneData(resData.data);
        setIncludeInReport(true);
        if (resData.data?.acquisitionPlane) {
          setForcedPlane(resData.data.acquisitionPlane);
        }
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Error al generar el simulador de plano.");
    } finally {
      timers.forEach(clearTimeout);
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleRegeneratePanel = async (
    panel: UsPlaneSimulatorPanel,
    directive: string,
    nextPlane?: UsAcquisitionPlane
  ) => {
    if (!planeData) return;
    setRegeneratingLetter(panel.panelLetter);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/regenerate-us-plane-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          panel,
          laterality: panel.laterality || planeData.detectedLaterality,
          acquisitionPlane: nextPlane || planeData.acquisitionPlane,
          targetStructure: planeData.targetStructure,
          userDirective: directive,
          customDirectives: mergedDirectives || undefined,
          requestedModel: selectedModel,
        }),
      });
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Error al regenerar panel.");
      const updated = planeData.panels.map((p) =>
        p.panelLetter === panel.panelLetter ? resData.panel : p
      );
      setPlaneData({
        ...planeData,
        panels: updated,
        acquisitionPlane: resData.acquisitionPlane || nextPlane || planeData.acquisitionPlane,
        planeLabelEs: resData.planeLabelEs || planeData.planeLabelEs,
      });
      if (nextPlane) setForcedPlane(nextPlane);
      if (zoomPanel?.panelLetter === panel.panelLetter) setZoomPanel(resData.panel);
    } catch (err: any) {
      setErrorMessage(err?.message || "No se pudo regenerar el panel.");
    } finally {
      setRegeneratingLetter(null);
    }
  };

  const applyChipToAll = async (directive: string, nextPlane?: UsAcquisitionPlane) => {
    if (!planeData?.panels?.length) {
      await handleGenerate(nextPlane || "auto");
      return;
    }
    if (nextPlane) setForcedPlane(nextPlane);
    for (const panel of planeData.panels) {
      await handleRegeneratePanel(panel, directive, nextPlane);
    }
  };

  const handleFlip = async (letter: string) => {
    if (!planeData) return;
    const panel = planeData.panels.find((p) => p.panelLetter === letter);
    if (!panel?.imageUrl) return;
    try {
      const flipped = await flipImageDataUrl(panel.imageUrl);
      const panels = planeData.panels.map((p) =>
        p.panelLetter !== letter
          ? p
          : {
              ...p,
              imageUrl: flipped,
              isCustomFlipped: !p.isCustomFlipped,
              laterality: swapLateralityLabel(p.laterality) || p.laterality,
            }
      );
      setPlaneData({ ...planeData, panels });
    } catch {
      setErrorMessage("No se pudo voltear la imagen.");
    }
  };

  return (
    <div
      id="us-plane-simulator-module"
      className="relative overflow-hidden rounded-2xl border border-cyan-800/40 bg-slate-950 text-slate-100 shadow-[0_0_0_1px_rgba(8,145,178,0.12)]"
    >
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(1200px 480px at 10% -10%, rgba(8,145,178,0.28), transparent 55%), radial-gradient(900px 420px at 90% 0%, rgba(14,116,144,0.18), transparent 50%), linear-gradient(165deg, #020617 0%, #0b1220 48%, #082f3a 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(165,243,252,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(165,243,252,0.35) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />

      <div className="relative p-5 md:p-6 space-y-5">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-[family-name:ui-serif] text-[11px] tracking-[0.22em] uppercase text-cyan-300/90 mb-2">
              Simulador de plano
            </p>
            <h3
              className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
              style={{ fontFamily: '"Fraunces", "Iowan Old Style", Georgia, serif' }}
            >
              Plano de adquisición ecográfica
            </h3>
            <p className="mt-2 text-sm text-slate-300/90 leading-relaxed max-w-xl">
              Detecta solo el plano del informe, lo dibuja en 3D y deja chips para corregir
              sin pelear con el modelo.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-widest text-cyan-200/80 font-semibold">
              Plano preferido
            </label>
            <select
              value={forcedPlane}
              onChange={(e) => setForcedPlane(e.target.value as UsAcquisitionPlane | "auto")}
              className="bg-slate-900/80 border border-cyan-700/50 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="auto">Auto (del informe)</option>
              <option value="longitudinal">Longitudinal</option>
              <option value="transverse">Transversal</option>
              <option value="oblique">Oblicuo</option>
            </select>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 font-bold text-sm px-4 py-2.5 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {planeData ? "Re-generar automático" : "Generar plano 3D"}
                </>
              )}
            </button>
          </div>
        </header>

        {isGenerating && (
          <div className="flex items-center gap-3 rounded-xl border border-cyan-700/40 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            <span>{generationStep || "Procesando…"}</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        {/* Correction chips — always visible for effective fixes */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            Corrección quirúrgica
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLANE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={isGenerating || !!regeneratingLetter}
                onClick={() => applyChipToAll(chip.directive, chip.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  (planeData?.acquisitionPlane || forcedPlane) === chip.id
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-100"
                    : "bg-slate-900/70 border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-100"
                }`}
              >
                {chip.label}
              </button>
            ))}
            {SIDE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isGenerating || !!regeneratingLetter}
                onClick={() => applyChipToAll(chip.directive)}
                className="text-[11px] px-2.5 py-1 rounded-lg border bg-slate-900/70 border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-100 font-medium"
              >
                {chip.label}
              </button>
            ))}
            {FINE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isGenerating || !!regeneratingLetter || !planeData}
                onClick={() => applyChipToAll(chip.directive)}
                className="text-[11px] px-2.5 py-1 rounded-lg border bg-slate-900/70 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-100"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {planeData && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-600/40 bg-cyan-950/50 px-3 py-1 text-cyan-100">
                <Scan className="w-3.5 h-3.5" />
                {planeData.planeLabelEs || planeData.acquisitionPlane}
              </span>
              {planeData.detectedLaterality && (
                <span className="rounded-full border border-slate-600/60 px-3 py-1">
                  {planeData.detectedLaterality}
                </span>
              )}
              {planeData.targetStructure && (
                <span className="rounded-full border border-slate-600/60 px-3 py-1 max-w-[280px] truncate">
                  {planeData.targetStructure}
                </span>
              )}
              <label className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInReport}
                  onChange={(e) => setIncludeInReport(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Incluir en PDF
              </label>
            </div>

            {/* Full-bleed visual plane */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {planeData.panels.map((panel) => (
                <div
                  key={panel.id || panel.panelLetter}
                  className="group relative overflow-hidden rounded-xl border border-cyan-800/30 bg-black/40"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.panelTitle}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                        Sin imagen
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                      PANEL {panel.panelLetter}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleFlip(panel.panelLetter)}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                        title="Flip horizontal"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomPanel(panel)}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {regeneratingLetter === panel.panelLetter && (
                      <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                        <span className="text-xs text-cyan-100">Re-renderizando plano…</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1 border-t border-cyan-900/30">
                    <p className="text-xs font-semibold text-slate-100 line-clamp-2">
                      {panel.panelTitle}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {panel.anatomicalFocus}
                    </p>
                    <button
                      type="button"
                      disabled={!!regeneratingLetter}
                      onClick={() =>
                        handleRegeneratePanel(
                          panel,
                          "Refine this panel only; keep locked acquisition plane and laterality."
                        )
                      }
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerar solo este panel
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {(planeData.planeSummary || (planeData.structuresCrossed || []).length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {planeData.planeSummary && (
                  <div className="rounded-xl border border-cyan-900/40 bg-slate-950/50 p-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Síntesis del plano
                    </p>
                    <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {planeData.planeSummary}
                    </p>
                  </div>
                )}
                {(planeData.structuresCrossed || []).length > 0 && (
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-4 min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
                      Estructuras cruzadas
                    </p>
                    <ul className="space-y-1 min-w-0">
                      {planeData.structuresCrossed!.map((s, i) => (
                        <li key={i} className="text-[13px] text-slate-200 flex gap-2 min-w-0">
                          <span className="text-cyan-400 shrink-0">▹</span>
                          <span className="break-words whitespace-normal min-w-0">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!planeData && !isGenerating && (
          <div className="rounded-xl border border-dashed border-cyan-800/50 bg-slate-950/40 px-6 py-10 text-center">
            <Scan className="w-8 h-8 mx-auto mb-3 text-cyan-500/80" />
            <p className="text-sm text-slate-300">
              Genera para anclar automáticamente el plano del informe en anatomía 3D.
            </p>
          </div>
        )}
      </div>

      {zoomPanel && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomPanel(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomPanel(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            {zoomPanel.imageUrl && (
              <img
                src={zoomPanel.imageUrl}
                alt={zoomPanel.panelTitle}
                className="w-full rounded-xl border border-cyan-700/40"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
