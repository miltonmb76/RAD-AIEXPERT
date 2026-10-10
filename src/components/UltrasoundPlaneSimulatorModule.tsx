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
  Focus,
} from "lucide-react";
import {
  UsAcquisitionPlane,
  UsPlaneSimulatorData,
  UsPlaneSimulatorPanel,
  ClinicalScorecardData,
  SuiteImageAnnotation,
} from "../types";
import { buildAtlasDirectivesFromScorecard } from "../lib/clinicalIntelligence";
import { runBackgroundTask } from "../lib/backgroundTasks";
import { flipImageDataUrl, swapLateralityLabel } from "../lib/imageFlip";
import {
  bridgeLabelsToAnnotations,
  buildBridgeClinicalContext,
  galleryToRealUs,
  keepFocalPanelsOnly,
  pickBridgeFocalPanel,
  seedBridgeArrowAnnotations,
  suggestLesionTarget,
  suggestRealUsFromGallery,
  type GalleryImage,
} from "../lib/usPlaneBridge";
import { SuiteImageAnnotationLayer } from "./SuiteImageAnnotationLayer";

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
  galleryImages?: GalleryImage[];
}

const PLANE_CHIPS: { id: UsAcquisitionPlane; label: string; directive: string }[] = [
  {
    id: "longitudinal",
    label: "Longitudinal",
    directive: "CORRECCIÓN: forzar plano LONGITUDINAL / eje largo del transductor. El corte 3D debe coincidir con ese eje.",
  },
  {
    id: "transverse",
    label: "Transversal",
    directive: "CORRECCIÓN: forzar plano TRANSVERSAL / eje corto del transductor. El corte 3D debe coincidir con ese eje.",
  },
  {
    id: "oblique",
    label: "Oblicuo",
    directive: "CORRECCIÓN: forzar plano OBLICUO de adquisición. El corte 3D debe coincidir con ese eje.",
  },
];

const SIDE_CHIPS = [
  { label: "Derecha", directive: "CORRECCIÓN LATERALIDAD: lado anatómico DERECHO del paciente (AP)." },
  { label: "Izquierda", directive: "CORRECCIÓN LATERALIDAD: lado anatómico IZQUIERDO del paciente (AP)." },
];

const FINE_CHIPS = [
  { label: "Girar +15°", directive: "Rotate acquisition plane +15°; keep same axis family and laterality." },
  { label: "Girar −15°", directive: "Rotate acquisition plane -15°; keep same axis family and laterality." },
  { label: "Acercar hallazgo", directive: "Tighten framing on the reported finding; keep the same acquisition plane." },
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
  const [forcedPlane, setForcedPlane] = useState<UsAcquisitionPlane | "auto">("longitudinal");
  const [panelDirectives, setPanelDirectives] = useState<Record<string, string>>({});
  const [pendingRealUsId, setPendingRealUsId] = useState<string>("");
  const [lesionTarget, setLesionTarget] = useState<string>("");
  const [annSelectedId, setAnnSelectedId] = useState<string | null>(null);

  const gallery = useMemo(
    () => (galleryImages || []).filter((g) => g?.id && g?.url),
    [galleryImages]
  );

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
  const focalPanel = pickBridgeFocalPanel(planeData);

  // Suggest lesion target from US caption / report / scorecard when empty
  useEffect(() => {
    if (planeData?.lesionTarget) {
      setLesionTarget((prev) => prev || planeData.lesionTarget || "");
      return;
    }
    setLesionTarget((prev) => {
      if (prev.trim()) return prev;
      return suggestLesionTarget({
        galleryCaption: selectedGallery?.caption,
        galleryLabel: selectedGallery?.label,
        reportText,
        scorecardData,
        planeTarget: planeData?.targetStructure,
      });
    });
  }, [
    selectedGallery?.caption,
    selectedGallery?.label,
    reportText,
    scorecardData,
    planeData?.lesionTarget,
    planeData?.targetStructure,
  ]);

  const annotations: SuiteImageAnnotation[] = planeData?.imageAnnotations?.length
    ? planeData.imageAnnotations
    : bridgeLabelsToAnnotations(planeData?.bridgeLabels);

  const setAnnotations = (next: SuiteImageAnnotation[]) => {
    if (!planeData) return;
    setPlaneData({ ...planeData, imageAnnotations: next, bridgeLabels: undefined });
  };

  const applyRealUsToPlane = (img: GalleryImage | null) => {
    if (!planeData) return;
    const real = img ? galleryToRealUs(img) : null;
    const suggested = suggestLesionTarget({
      galleryCaption: real?.caption,
      galleryLabel: real?.label,
      reportText,
      scorecardData,
      planeTarget: planeData.targetStructure || lesionTarget,
    });
    if (suggested && !lesionTarget.trim()) setLesionTarget(suggested);
    setPlaneData({
      ...planeData,
      realUsImage: real,
      lesionTarget: lesionTarget.trim() || suggested || planeData.lesionTarget,
    });
  };

  const mergedDirectives = useMemo(() => {
    const fromScore = buildAtlasDirectivesFromScorecard(scorecardData || null);
    const target = lesionTarget.trim();
    const usHint = [
      "BRIDGE ECO-ANATOMIA: genera SOLO el corte 3D focal (cara del plano), mismo eje que la eco real.",
      "PROHIBIDO panel overview con plano flotante / anatomy_with_plane.",
      target
        ? `ESTRUCTURA LESIONADA OBJETIVO: ${target}. Centrar el corte 3D en esa estructura.`
        : "",
      selectedGallery?.caption ? `Rotulacion / caption eco: ${selectedGallery.caption}` : "",
      selectedGallery?.label ? `Label eco: ${selectedGallery.label}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return [fromScore, externalDirectives, usHint].filter(Boolean).join("\n").trim();
  }, [scorecardData, externalDirectives, selectedGallery, lesionTarget]);

  const handleGenerate = async (planeOverride?: UsAcquisitionPlane | "auto") => {
    if (!reportText?.trim()) {
      setErrorMessage("Necesitas un informe para anclar el plano de adquisición.");
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Detectando órgano, lado y plano...");

    const plane =
      planeOverride && planeOverride !== "auto"
        ? planeOverride
        : forcedPlane !== "auto"
          ? forcedPlane
          : undefined;

    const timers: ReturnType<typeof setTimeout>[] = [];
    try {
      timers.push(
        setTimeout(() => setGenerationStep("Renderizando corte 3D focal (mismo eje que la eco)..."), 1600)
      );
      timers.push(setTimeout(() => setGenerationStep("Verificando plano y lateralidad..."), 6500));

      await runBackgroundTask("us-plane-sim", "Bridge eco-anatomia", async () => {
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
            bridgeOnlyFocal: true,
            lesionTarget: lesionTarget.trim() || undefined,
          }),
        });
        const resData = await response.json();
        if (!resData.success) throw new Error(resData.error || "No se pudo generar el bridge.");
        const raw = keepFocalPanelsOnly(resData.data as UsPlaneSimulatorData);
        const real =
          (selectedGallery && galleryToRealUs(selectedGallery)) ||
          suggestRealUsFromGallery(gallery) ||
          raw.realUsImage ||
          null;
        const target =
          lesionTarget.trim() ||
          suggestLesionTarget({
            galleryCaption: real?.caption,
            galleryLabel: real?.label,
            reportText,
            scorecardData,
            planeTarget: raw.targetStructure,
          });
        const imageAnnotations =
          planeData?.imageAnnotations?.length
            ? planeData.imageAnnotations
            : seedBridgeArrowAnnotations({
                lesionTarget: target,
                realUs: real,
                structuresCrossed: raw.structuresCrossed,
              });
        const clinicalContextLines = buildBridgeClinicalContext({
          scorecardData,
          plane: raw,
          lesionTarget: target,
        });
        setPlaneData({
          ...raw,
          realUsImage: real,
          lesionTarget: target,
          targetStructure: target || raw.targetStructure,
          imageAnnotations,
          clinicalContextLines,
          bridgeLabels: undefined,
        });
        if (target) setLesionTarget(target);
        setIncludeInReport(true);
        if (raw?.acquisitionPlane) setForcedPlane(raw.acquisitionPlane);
        if (real?.id) setPendingRealUsId(real.id);
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Error al generar el bridge.");
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
    const combinedDirective = [
      directive,
      "SOLO corte focal in_plane_cut; mismo eje que la eco real; sin overview.",
      freeText ? `MODIFICACIÓN DEL USUARIO: ${freeText}` : "",
    ]
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
          panel: { ...panel, panelRole: "in_plane_cut" },
          laterality: panel.laterality || planeData.detectedLaterality,
          acquisitionPlane: nextPlane || planeData.acquisitionPlane,
          targetStructure: planeData.targetStructure,
          userDirective: [
            combinedDirective,
            lesionTarget.trim()
              ? `ESTRUCTURA LESIONADA OBJETIVO: ${lesionTarget.trim()}. Centrar el corte ahí.`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          customDirectives: mergedDirectives || undefined,
          requestedModel: selectedModel,
        }),
      });
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Error al regenerar.");
      const updatedPanel = {
        ...resData.panel,
        panelRole: "in_plane_cut" as const,
        anatomicalFocus: lesionTarget.trim() || resData.panel?.anatomicalFocus,
      };
      const updated = keepFocalPanelsOnly({
        ...planeData,
        panels: [updatedPanel],
        acquisitionPlane: resData.acquisitionPlane || nextPlane || planeData.acquisitionPlane,
        planeLabelEs: resData.planeLabelEs || planeData.planeLabelEs,
        lesionTarget: lesionTarget.trim() || planeData.lesionTarget,
        targetStructure: lesionTarget.trim() || planeData.targetStructure,
      });
      setPlaneData(updated);
      if (nextPlane) setForcedPlane(nextPlane);
      if (zoomPanel?.panelLetter === panel.panelLetter) setZoomPanel(updatedPanel);
    } catch (err: any) {
      setErrorMessage(err?.message || "No se pudo regenerar el corte 3D.");
    } finally {
      setRegeneratingLetter(null);
    }
  };

  const applyChip = async (directive: string, nextPlane?: UsAcquisitionPlane) => {
    if (nextPlane) setForcedPlane(nextPlane);
    if (!planeData?.panels?.length) {
      await handleGenerate(nextPlane || forcedPlane);
      return;
    }
    const panel = pickBridgeFocalPanel(planeData);
    if (panel) await handleRegeneratePanel(panel, directive, nextPlane);
  };

  const handleFlip = async () => {
    if (!planeData || !focalPanel?.imageUrl) return;
    try {
      const flipped = await flipImageDataUrl(focalPanel.imageUrl);
      const panels = planeData.panels.map((p) =>
        p.panelLetter !== focalPanel.panelLetter
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
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(1200px 480px at 10% -10%, rgba(8,145,178,0.28), transparent 55%), linear-gradient(165deg, #020617 0%, #0b1220 48%, #082f3a 100%)",
        }}
      />

      <div className="relative p-5 md:p-6 space-y-5">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] tracking-[0.22em] uppercase text-cyan-300/90 mb-2">
              Bridge US-3D
            </p>
            <h3
              className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
              style={{ fontFamily: '"Fraunces", "Iowan Old Style", Georgia, serif' }}
            >
              Corte eco - anatomia
            </h3>
            <p className="mt-2 text-sm text-slate-300/90 leading-relaxed max-w-xl">
              Eco real + corte 3D centrado en la estructura lesionada. Rótulos con flecha (como
              en las suites).
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-widest text-cyan-200/80 font-semibold">
              Tipo de corte 3D
            </label>
            <select
              value={forcedPlane}
              onChange={(e) => setForcedPlane(e.target.value as UsAcquisitionPlane | "auto")}
              className="bg-slate-900/80 border border-cyan-700/50 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="auto">Auto (del informe)</option>
              <option value="longitudinal">Longitudinal / eje largo</option>
              <option value="transverse">Transversal / eje corto</option>
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
                  {planeData ? "Re-generar corte 3D" : "Generar corte 3D focal"}
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

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            Eco real (galería)
          </p>
          {gallery.length === 0 ? (
            <p className="text-[12px] text-slate-500 rounded-xl border border-dashed border-slate-700 px-3 py-3">
              Sube capturas del estudio para emparejar eco y corte 3D.
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

        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/90 font-semibold flex items-center gap-1.5">
            <Focus className="w-3.5 h-3.5" />
            Estructura lesionada (objetivo del corte 3D)
          </p>
          <textarea
            value={lesionTarget}
            onChange={(e) => {
              setLesionTarget(e.target.value);
              if (planeData) {
                setPlaneData({ ...planeData, lesionTarget: e.target.value.trim() });
              }
            }}
            rows={2}
            placeholder="Ej. Tendón rotuliano proximal / menisco medial… (se sugiere desde rotulación US, informe y scorecard)"
            className="w-full bg-slate-950/80 border border-amber-700/40 focus:border-amber-400 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 outline-none resize-none"
          />
          <button
            type="button"
            className="text-[10px] font-semibold text-amber-300 hover:text-amber-200"
            onClick={() => {
              const s = suggestLesionTarget({
                galleryCaption: selectedGallery?.caption,
                galleryLabel: selectedGallery?.label,
                reportText,
                scorecardData,
                planeTarget: planeData?.targetStructure,
              });
              if (s) {
                setLesionTarget(s);
                if (planeData) setPlaneData({ ...planeData, lesionTarget: s });
              }
            }}
          >
            Autocompletar desde US / informe / scorecard
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            Tipo de corte / correcciones
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLANE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={isGenerating || !!regeneratingLetter}
                onClick={() => applyChip(chip.directive, chip.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  (planeData?.acquisitionPlane || forcedPlane) === chip.id
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-100"
                    : "bg-slate-900/70 border-slate-700 text-slate-300 hover:border-cyan-500/60"
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
                onClick={() => applyChip(chip.directive)}
                className="text-[11px] px-2.5 py-1 rounded-lg border bg-slate-900/70 border-slate-700 text-slate-300 hover:border-cyan-500/60 font-medium"
              >
                {chip.label}
              </button>
            ))}
            {FINE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isGenerating || !!regeneratingLetter || !planeData}
                onClick={() => applyChip(chip.directive)}
                className="text-[11px] px-2.5 py-1 rounded-lg border bg-slate-900/70 border-slate-700 text-slate-400 hover:border-cyan-500/50"
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

            {/* Bridge: only US | focal 3D */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/90 font-semibold flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Eco real | Corte 3D focal (mismo eje)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="relative overflow-hidden rounded-xl border border-cyan-700/40 bg-black/50">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {planeData.realUsImage?.url ? (
                      <img
                        src={planeData.realUsImage.url}
                        alt="Eco real"
                        className="h-full w-full object-contain bg-black"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                        <ImageIcon className="w-6 h-6 opacity-50" />
                        Elige una captura
                      </div>
                    )}
                    <div className="absolute top-2 left-2 z-20 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                      ECO REAL
                    </div>
                    {planeData.realUsImage?.url && (
                      <button
                        type="button"
                        onClick={() => setZoomUsUrl(planeData.realUsImage!.url)}
                        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/60 text-white"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <SuiteImageAnnotationLayer
                      panelLetter="US"
                      annotations={annotations}
                      onChange={setAnnotations}
                      mode="layer"
                      editable
                      selectedId={annSelectedId}
                      onSelectId={setAnnSelectedId}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 px-3 py-2 border-t border-cyan-900/30 italic truncate">
                    {planeData.realUsImage?.caption ||
                      planeData.realUsImage?.label ||
                      "Captura del estudio"}
                  </p>
                  <div className="px-3 pb-3">
                    <SuiteImageAnnotationLayer
                      panelLetter="US"
                      annotations={annotations}
                      onChange={setAnnotations}
                      mode="toolbar"
                      editable
                      selectedId={annSelectedId}
                      onSelectId={setAnnSelectedId}
                    />
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-cyan-700/40 bg-black/50">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {focalPanel?.imageUrl ? (
                      <img
                        src={focalPanel.imageUrl}
                        alt="Corte 3D focal"
                        className="h-full w-full object-contain bg-black"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                        Genera el corte 3D
                      </div>
                    )}
                    <div className="absolute top-2 left-2 z-20 bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                      CORTE 3D FOCAL
                    </div>
                    {focalPanel && (
                      <div className="absolute top-2 right-2 z-20 flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleFlip()}
                          className="p-1.5 rounded-lg bg-black/60 text-white"
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomPanel(focalPanel)}
                          className="p-1.5 rounded-lg bg-black/60 text-white"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {regeneratingLetter && (
                      <div className="absolute inset-0 z-30 bg-slate-950/75 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                        <span className="text-xs text-cyan-100">Re-renderizando…</span>
                      </div>
                    )}
                    <SuiteImageAnnotationLayer
                      panelLetter="A"
                      annotations={annotations}
                      onChange={setAnnotations}
                      mode="layer"
                      editable
                      selectedId={annSelectedId}
                      onSelectId={setAnnSelectedId}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 px-3 py-2 border-t border-cyan-900/30 italic truncate">
                    {lesionTarget || focalPanel?.panelTitle || "Corte 3D de la estructura lesionada"}
                  </p>
                  <div className="px-3 pb-3">
                    <SuiteImageAnnotationLayer
                      panelLetter="A"
                      annotations={annotations}
                      onChange={setAnnotations}
                      mode="toolbar"
                      editable
                      selectedId={annSelectedId}
                      onSelectId={setAnnSelectedId}
                    />
                  </div>
                </div>
              </div>
            </div>

            {focalPanel && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 space-y-2">
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  Modificación al regenerar el corte 3D
                </label>
                <textarea
                  value={panelDirectives[focalPanel.panelLetter] || ""}
                  onChange={(e) =>
                    setPanelDirectives((prev) => ({
                      ...prev,
                      [focalPanel.panelLetter]: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Ej. Enfocar tendón rotuliano proximal, mismo eje longitudinal…"
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 outline-none resize-none"
                />
                <button
                  type="button"
                  disabled={!!regeneratingLetter}
                  onClick={() =>
                    handleRegeneratePanel(
                      focalPanel,
                      "Refine focal in-plane cut only; match US axis; no overview panel."
                    )
                  }
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerar solo corte 3D
                </button>
              </div>
            )}

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
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
                      Estructuras cruzadas
                    </p>
                    <ul className="space-y-1">
                      {planeData.structuresCrossed!.map((s, i) => (
                        <li key={i} className="text-[13px] text-slate-200 flex gap-2">
                          <span className="text-cyan-400">▹</span>
                          <span>{s}</span>
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
              Elige eco + tipo de corte 3D y genera el par lado a lado.
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
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setZoomPanel(null);
                setZoomUsUrl(null);
              }}
              className="absolute -top-10 right-0 text-white/80"
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
