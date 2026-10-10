import React, { useEffect, useMemo, useState } from "react";
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
  Image as ImageIcon,
  Link2,
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
import {
  buildUsPlaneBridgeLabels,
  galleryToRealUs,
  pickBridgeAnatomyPanel,
  suggestRealUsFromGallery,
  type GalleryImage,
} from "../lib/usPlaneBridge";

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
  /** Capturas del estudio (galería) para el bridge eco ↔ 3D. */
  galleryImages?: GalleryImage[];
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
  galleryImages = [],
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomPanel, setZoomPanel] = useState<UsPlaneSimulatorPanel | null>(null);
  const [zoomUsUrl, setZoomUsUrl] = useState<string | null>(null);
  const [regeneratingLetter, setRegeneratingLetter] = useState<string | null>(null);
  const [forcedPlane, setForcedPlane] = useState<UsAcquisitionPlane | "auto">("auto");
  const [panelDirectives, setPanelDirectives] = useState<Record<string, string>>({});
  const [pendingRealUsId, setPendingRealUsId] = useState<string>("");

  const gallery = useMemo(
    () => (galleryImages || []).filter((g) => g?.id && g?.url),
    [galleryImages]
  );

  // Seed eco real when gallery arrives / plane has none
  useEffect(() => {
    if (!gallery.length) {
      setPendingRealUsId("");
      return;
    }
    setPendingRealUsId((prev) => {
      if (prev && gallery.some((g) => g.id === prev)) return prev;
      if (planeData?.realUsImage?.id && gallery.some((g) => g.id === planeData.realUsImage!.id)) {
        return planeData.realUsImage.id;
      }
      return suggestRealUsFromGallery(gallery)?.id || gallery[0].id;
    });
  }, [gallery, planeData?.realUsImage?.id]);

  const selectedGallery = gallery.find((g) => g.id === pendingRealUsId) || null;

  const applyRealUsToPlane = (img: GalleryImage | null) => {
    if (!planeData) return;
    const real = img ? galleryToRealUs(img) : null;
    const bridgeLabels = buildUsPlaneBridgeLabels(planeData, real);
    setPlaneData({ ...planeData, realUsImage: real, bridgeLabels });
  };

  const mergedDirectives = useMemo(() => {
    const fromScore = buildAtlasDirectivesFromScorecard(scorecardData || null);
    const usHint = selectedGallery
      ? [
          "BRIDGE ECO↔ANATOMÍA: el plano 3D debe corresponder a la eco real seleccionada de la galería.",
          selectedGallery.caption
            ? `Caption de la eco: ${selectedGallery.caption}`
            : selectedGallery.label
              ? `Label de la eco: ${selectedGallery.label}`
              : "",
          "Mantén la misma orientación / lateralidad que implica el informe y la captura.",
        ]
          .filter(Boolean)
          .join("\n")
      : "";
    return [fromScore, externalDirectives, usHint].filter(Boolean).join("\n").trim();
  }, [scorecardData, externalDirectives, selectedGallery]);

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
        const raw = resData.data as UsPlaneSimulatorData;
        const real =
          (selectedGallery && galleryToRealUs(selectedGallery)) ||
          suggestRealUsFromGallery(gallery) ||
          raw.realUsImage ||
          null;
        const bridgeLabels = buildUsPlaneBridgeLabels(raw, real);
        setPlaneData({ ...raw, realUsImage: real, bridgeLabels });
        setIncludeInReport(true);
        if (raw?.acquisitionPlane) {
          setForcedPlane(raw.acquisitionPlane);
        }
        if (real?.id) setPendingRealUsId(real.id);
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
    const freeText = (panelDirectives[panel.panelLetter] || "").trim();
    const combinedDirective = [directive, freeText ? `MODIFICACIÓN DEL USUARIO: ${freeText}` : ""]
      .filter(Boolean)
      .join("\n");
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
          userDirective: combinedDirective,
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
              Corte eco ↔ anatomía
            </p>
            <h3
              className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
              style={{ fontFamily: '"Fraunces", "Iowan Old Style", Georgia, serif' }}
            >
              Bridge US–3D
            </h3>
            <p className="mt-2 text-sm text-slate-300/90 leading-relaxed max-w-xl">
              Eco real de la galería + plano 3D del mismo corte, con labels automáticos para
              mostrar dónde está el hallazgo.
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

        {/* Gallery: pick real US for the bridge */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            Eco real (galería del estudio)
          </p>
          {gallery.length === 0 ? (
            <p className="text-[12px] text-slate-500 rounded-xl border border-dashed border-slate-700 px-3 py-3">
              No hay capturas en la galería. Sube imágenes del estudio para emparejar eco ↔ 3D.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, idx) => {
                const active = img.id === pendingRealUsId;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setPendingRealUsId(img.id);
                      if (planeData) applyRealUsToPlane(img);
                    }}
                    className={`relative shrink-0 w-[88px] rounded-lg overflow-hidden border-2 transition-all ${
                      active
                        ? "border-cyan-400 ring-2 ring-cyan-500/30"
                        : "border-slate-700 hover:border-cyan-600/60"
                    }`}
                    title={img.caption || img.label || `Captura ${idx + 1}`}
                  >
                    <div className="aspect-[4/3] bg-slate-900">
                      <img
                        src={img.preview || img.url}
                        alt={img.label || `US ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-cyan-100 px-1 py-0.5 truncate">
                      {img.caption || img.label || `US ${idx + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

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

            {/* Bridge: eco real | anatomía 3D */}
            {(() => {
              const real = planeData.realUsImage;
              const anatomy = pickBridgeAnatomyPanel(planeData);
              const labels =
                planeData.bridgeLabels?.length
                  ? planeData.bridgeLabels
                  : buildUsPlaneBridgeLabels(planeData, real);
              if (!real?.url && !anatomy?.imageUrl) return null;
              return (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/90 font-semibold flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Bridge eco ↔ anatomía
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="relative overflow-hidden rounded-xl border border-cyan-700/40 bg-black/50">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {real?.url ? (
                          <img
                            src={real.url}
                            alt={real.caption || real.label || "Eco real"}
                            className="h-full w-full object-contain bg-black"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500 text-sm px-4 text-center">
                            <ImageIcon className="w-6 h-6 opacity-50" />
                            Elige una captura de la galería
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          ECO REAL
                        </div>
                        {real?.url && (
                          <button
                            type="button"
                            onClick={() => setZoomUsUrl(real.url)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {labels.filter((l) => l.side !== "anatomy").length > 0 && (
                          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                            {labels
                              .filter((l) => l.side !== "anatomy")
                              .slice(0, 5)
                              .map((l) => (
                                <span
                                  key={l.id}
                                  className="text-[9px] font-semibold bg-black/75 text-emerald-100 border border-emerald-500/40 px-1.5 py-0.5 rounded"
                                >
                                  {l.text}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 px-3 py-2 border-t border-cyan-900/30 italic truncate">
                        {real?.caption || real?.label || "Captura del estudio"}
                      </p>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-cyan-700/40 bg-black/50">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {anatomy?.imageUrl ? (
                          <img
                            src={anatomy.imageUrl}
                            alt={anatomy.panelTitle}
                            className="h-full w-full object-contain bg-black"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                            Genera el plano 3D
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          ANATOMÍA 3D
                          {anatomy?.panelLetter ? ` · ${anatomy.panelLetter}` : ""}
                        </div>
                        {anatomy && (
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleFlip(anatomy.panelLetter)}
                              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                              title="Flip horizontal"
                            >
                              <FlipHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setZoomPanel(anatomy)}
                              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {labels.filter((l) => l.side !== "us").length > 0 && (
                          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                            {labels
                              .filter((l) => l.side !== "us")
                              .slice(0, 5)
                              .map((l) => (
                                <span
                                  key={l.id}
                                  className="text-[9px] font-semibold bg-black/75 text-cyan-100 border border-cyan-500/40 px-1.5 py-0.5 rounded"
                                >
                                  {l.text}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 px-3 py-2 border-t border-cyan-900/30 italic truncate">
                        {anatomy?.panelTitle || anatomy?.anatomicalFocus || "Plano 3D"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Remaining / detail 3D panels */}
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
                  <div className="p-3 space-y-2 border-t border-cyan-900/30">
                    <p className="text-xs font-semibold text-slate-100 line-clamp-2">
                      {panel.panelTitle}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {panel.anatomicalFocus}
                    </p>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                      Modificación al regenerar
                    </label>
                    <textarea
                      value={panelDirectives[panel.panelLetter] || ""}
                      onChange={(e) =>
                        setPanelDirectives((prev) => ({
                          ...prev,
                          [panel.panelLetter]: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Ej. Lesión en menisco interno/medial (tibial), no en el externo/peroné…"
                      className="w-full min-w-0 bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 placeholder:text-slate-500 outline-none resize-none"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        "Menisco interno/medial (tibial), no externo",
                        "Menisco externo/lateral (peroné), no interno",
                        "Mantener mismo plano y lado",
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          disabled={!!regeneratingLetter}
                          onClick={() =>
                            setPanelDirectives((prev) => {
                              const cur = (prev[panel.panelLetter] || "").trim();
                              return {
                                ...prev,
                                [panel.panelLetter]: cur ? `${cur}; ${chip}` : chip,
                              };
                            })
                          }
                          className="text-[9px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-100"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!!regeneratingLetter}
                      onClick={() =>
                        handleRegeneratePanel(
                          panel,
                          "Refine this panel only; keep locked acquisition plane, patient laterality, and meniscus compartment (internal/medial ≠ external/lateral)."
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
              Elige una eco de la galería y genera el plano 3D para ver el bridge lado a lado.
            </p>
          </div>
        )}
      </div>

      {(zoomPanel || zoomUsUrl) && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setZoomPanel(null);
            setZoomUsUrl(null);
          }}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setZoomPanel(null);
                setZoomUsUrl(null);
              }}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            {(zoomUsUrl || zoomPanel?.imageUrl) && (
              <img
                src={zoomUsUrl || zoomPanel!.imageUrl}
                alt={zoomPanel?.panelTitle || "Eco real"}
                className="w-full rounded-xl border border-cyan-700/40"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
