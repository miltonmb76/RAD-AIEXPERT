import React, { useEffect, useMemo, useState } from "react";
import {
  FileStack,
  RefreshCw,
  ImageOff,
  AlertTriangle,
  Loader2,
  Sparkles,
  Box,
} from "lucide-react";
import type {
  Atlas3DData,
  ClinicalScorecardData,
  DominantLesionCardData,
  FindingsInfographicData,
  FocalLesion3DData,
} from "../types";
import {
  buildDiagnosticPack,
  diagnosticPackIsRenderable,
  diagnosticPackMissingRequirements,
  listPackImageCandidates,
  type DiagnosticPackData,
  type PackImageSource,
} from "../lib/diagnosticPack";
import {
  applyScorecardGovernanceToFigurePack,
  buildAtlasDirectivesFromScorecard,
} from "../lib/clinicalIntelligence";
import {
  mergeAnchorIntoDirectives,
  resolveScorecardFinalDiagnosis,
} from "../lib/diagnosisAnchor";
import {
  suggestFocalImageAnnotations,
  withSuggestedImageAnnotations,
} from "../lib/suiteImageAnnotations";

interface DiagnosticPackModuleProps {
  diagnosisAnchor: string;
  findingsInfographic: FindingsInfographicData | null;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  setFocalLesion3dData?: (data: FocalLesion3DData | null) => void;
  setIncludeFocalLesion3dInReport?: (v: boolean) => void;
  dominantLesionCard?: DominantLesionCardData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
  preferredSuiteLabel?: string | null;
  reportText?: string;
  studyType?: string;
  selectedModel?: string;
  packData: DiagnosticPackData | null;
  setPackData: (data: DiagnosticPackData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (v: boolean) => void;
}

export const DiagnosticPackModule: React.FC<DiagnosticPackModuleProps> = ({
  diagnosisAnchor,
  findingsInfographic,
  scorecardData = null,
  atlas3dData = null,
  focalLesion3dData = null,
  setFocalLesion3dData,
  setIncludeFocalLesion3dInReport,
  dominantLesionCard = null,
  suiteSources = [],
  preferredSuiteId = null,
  preferredSuiteLabel = null,
  reportText = "",
  studyType = "",
  selectedModel = "",
  packData,
  setPackData,
  includeInReport,
  setIncludeInReport,
}) => {
  const candidates = useMemo(
    () =>
      listPackImageCandidates({
        focalLesion3dData,
        atlas3dData,
        suiteSources,
      }),
    [focalLesion3dData, atlas3dData, suiteSources]
  );

  const [slotAId, setSlotAId] = useState<string>("");
  const [slotBId, setSlotBId] = useState<string>("");
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pendingAutoBuild, setPendingAutoBuild] = useState(false);

  // Seed defaults when candidates / preferred suite change
  useEffect(() => {
    if (!candidates.length) {
      setSlotAId("");
      setSlotBId("");
      return;
    }
    const preferred = String(preferredSuiteId || "").trim();
    const focalPool = candidates.filter((c) => c.sourceId === "focal");
    const pool = preferred
      ? candidates.filter((c) => c.sourceId === preferred)
      : focalPool.length
        ? focalPool
        : candidates;
    const use = pool.length ? pool : candidates;
    setSlotAId((prev) =>
      prev && candidates.some((c) => c.id === prev) ? prev : use[0]?.id || ""
    );
    setSlotBId((prev) => {
      if (prev && candidates.some((c) => c.id === prev) && prev !== use[0]?.id) {
        return prev;
      }
      return use[1]?.id || candidates.find((c) => c.id !== use[0]?.id)?.id || "";
    });
  }, [candidates, preferredSuiteId]);

  const packOpts = {
    diagnosisAnchor,
    findingsInfographic,
    scorecardData,
    atlas3dData,
    focalLesion3dData,
    dominantLesionCard,
    suiteSources,
    preferredSuiteId,
    imageSlotAId: slotAId || null,
    // "" = Ninguna (explicit); do not coerce to null or defaults kick in.
    imageSlotBId: slotBId,
  };

  const preview = useMemo(
    () => buildDiagnosticPack(packOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      diagnosisAnchor,
      findingsInfographic,
      scorecardData,
      atlas3dData,
      focalLesion3dData,
      dominantLesionCard,
      suiteSources,
      preferredSuiteId,
      slotAId,
      slotBId,
    ]
  );

  const display = packData && diagnosticPackIsRenderable(packData) ? packData : preview;
  const hasJustification = (findingsInfographic?.nodes || []).some((n) =>
    String(n.label || "").trim()
  );
  const canBuild = diagnosticPackIsRenderable(preview);
  const missing = diagnosticPackMissingRequirements(preview, { hasJustification });
  const scorecardDx = resolveScorecardFinalDiagnosis(scorecardData);
  const canGenerateImages =
    !!setFocalLesion3dData &&
    !!String(reportText || "").trim() &&
    !!(String(diagnosisAnchor || "").trim() || scorecardDx);

  const handleBuild = (optsOverride?: Partial<typeof packOpts>) => {
    const next = buildDiagnosticPack({ ...packOpts, ...optsOverride });
    if (!diagnosticPackIsRenderable(next)) {
      setPackData(null);
      setIncludeInReport(false);
      return false;
    }
    setPackData(next);
    setIncludeInReport(true);
    return true;
  };

  // After focal images land and slots settle, auto-armar pack if possible
  useEffect(() => {
    if (!pendingAutoBuild) return;
    if (!candidates.some((c) => c.sourceId === "focal" && c.imageUrl)) return;
    const focalIds = candidates.filter((c) => c.sourceId === "focal").map((c) => c.id);
    const a = focalIds[0] || slotAId || null;
    const b = focalIds[1] || (slotBId === "" ? "" : slotBId || null);
    if (!a) return;
    setSlotAId(a);
    if (b) setSlotBId(b);
    const ok = handleBuild({
      imageSlotAId: a,
      imageSlotBId: b === "" ? "" : b,
    });
    setPendingAutoBuild(false);
    if (!ok) {
      setGenError(
        "Imágenes listas. Completa ancla/justificación y pulsa «Armar pack»."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoBuild, candidates, slotAId, slotBId]);

  const handleGenerateFocalImages = async () => {
    if (!setFocalLesion3dData) {
      setGenError("Falta cableado para guardar el Corte Focal.");
      return;
    }
    if (!String(reportText || "").trim()) {
      setGenError("Necesitas un informe para generar las imágenes del pack.");
      return;
    }
    const focus =
      String(diagnosisAnchor || "").trim() || scorecardDx;
    if (!focus) {
      setGenError("Define el ancla o genera el Scorecard antes de pedir las imágenes.");
      return;
    }

    setIsGeneratingImages(true);
    setGenError(null);
    try {
      const scorecardDirectives = buildAtlasDirectivesFromScorecard(scorecardData);
      const packDirective = [
        "PACK DIAGNÓSTICO (lámina de justificación):",
        `Ancla obligatoria: «${focus}».`,
        "Genera cortes 3D focales centrados en esa lesión/diagnóstico (misma metodología que Corte Focal).",
        "Panel A = contexto anatómico útil; Panel B = macro de la lesión dominante.",
        "Sin texto ni números en la imagen.",
      ].join("\n");
      const mergedDirectives = mergeAnchorIntoDirectives(
        [scorecardDirectives, packDirective].filter(Boolean).join("\n\n"),
        focus
      );

      const response = await fetch("/api/generate-focal-lesion-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          organOrStudy: studyType || "",
          requestedModel: selectedModel || undefined,
          customDirectives: mergedDirectives || undefined,
          focusMode: "manual",
          focusText: focus,
          includeMacroPanel: true,
        }),
      });
      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || "Error al generar imágenes focales para el pack.");
      }

      const data = resData.data as FocalLesion3DData;
      const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);
      const suggested = suggestFocalImageAnnotations({
        panelLetters: letters,
        lesionLabel: data.lesionLabel || focus,
        lesionSite: data.lesionSite,
        lesionSize: data.lesionSize,
      });
      const withAnns = withSuggestedImageAnnotations(data, suggested);
      const governed = applyScorecardGovernanceToFigurePack(
        withAnns,
        scorecardData
      ) as FocalLesion3DData;

      setFocalLesion3dData(governed);
      setIncludeFocalLesion3dInReport?.(true);
      setPendingAutoBuild(true);
    } catch (err: any) {
      console.error("Error generando imágenes del pack:", err);
      setGenError(err?.message || "Error al generar las imágenes del pack.");
    } finally {
      setIsGeneratingImages(false);
    }
  };

  return (
    <div
      id="diagnostic-pack-module"
      className="bg-slate-900/95 border-2 border-amber-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-2xl text-amber-300 shadow-md shrink-0">
            <FileStack className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                Pack diagnóstico (1 página)
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-amber-950/50 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded">
                Solo médico
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Factores desde la justificación del ancla · mini-ficha · imágenes desde Corte Focal
              (generables aquí) o suite/Atlas
              {preferredSuiteLabel ? ` (suite preferida: ${preferredSuiteLabel})` : ""}.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={includeInReport && canBuild && !!packData}
            onChange={(e) => {
              if (!canBuild || !packData) return;
              setIncludeInReport(e.target.checked);
            }}
            disabled={!canBuild || !packData}
            className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-3.5 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5" />
              Imágenes focales on-demand
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-xl">
              Usa el ancla + directrices del scorecard y el motor del Corte Focal para generar
              contexto + macro sin abrir ese módulo antes.
            </p>
            {(diagnosisAnchor || scorecardDx) && (
              <p className="text-[11px] text-amber-100/90 mt-1.5">
                Foco:{" "}
                <span className="font-semibold">
                  {diagnosisAnchor || scorecardDx}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerateFocalImages}
            disabled={!canGenerateImages || isGeneratingImages}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-45 text-slate-950 text-[11px] font-black uppercase tracking-wider cursor-pointer shrink-0"
            title={
              !canGenerateImages
                ? "Necesitas informe + ancla (o scorecard)"
                : "Generar 2 paneles con metodología Corte Focal"
            }
          >
            {isGeneratingImages ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGeneratingImages
              ? "Generando 3D…"
              : candidates.some((c) => c.sourceId === "focal")
                ? "Regenerar imágenes focales"
                : "Generar imágenes focales"}
          </button>
        </div>
        {isGeneratingImages && (
          <p className="text-[10px] text-amber-200/80 font-mono uppercase tracking-wider animate-pulse">
            Anclando lesión → render focal → auto-selección A/B…
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slotSelect("Imagen A (obligatoria)", slotAId, setSlotAId, slotBId)}
        {slotSelect("Imagen B (recomendada)", slotBId, setSlotBId, slotAId)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleBuild()}
          disabled={!canBuild}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          {packData ? "Actualizar pack" : "Armar pack"}
        </button>
        {packData && (
          <button
            type="button"
            onClick={() => {
              setPackData(null);
              setIncludeInReport(false);
            }}
            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
          >
            Quitar
          </button>
        )}
      </div>

      {genError && (
        <div className="text-[11px] text-rose-200 bg-rose-950/35 border border-rose-800/40 rounded-xl px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{genError}</span>
        </div>
      )}

      {missing.length > 0 && (
        <div className="text-[11px] text-amber-100/95 bg-amber-950/35 border border-amber-700/40 rounded-xl px-3 py-2.5 space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Requisitos
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-100/85">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {display.diagnosis && (
        <div className="rounded-2xl overflow-hidden border border-stone-600/40 bg-[#fafaf9] text-stone-900 shadow-inner">
          <div className="mx-4 mt-4 rounded-lg bg-stone-900 px-4 py-2.5 flex justify-between gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-50">
              Anexo · Justificación diagnóstica
            </span>
            <span className="text-[10px] text-amber-200/90 truncate font-medium">
              {[display.categoryLabel, display.studyRegion].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="mx-4 h-1 bg-amber-500 rounded-b" />

          <div className="p-5 md:p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">
                Diagnóstico ancla
              </p>
              <h4 className="text-xl md:text-2xl font-black text-stone-900 leading-snug tracking-tight">
                {display.diagnosis}
              </h4>
              <div className="w-16 h-0.5 bg-amber-400 rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-8 items-start">
              <div className="space-y-5 min-w-0">
                {display.synthesis && (
                  <p className="text-[13px] text-stone-600 leading-relaxed">{display.synthesis}</p>
                )}

                {display.factSheet && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-800">
                      Mini-ficha · {display.factSheet.title}
                    </p>
                    <dl className="grid grid-cols-1 gap-1.5">
                      {display.factSheet.rows.map((r) => (
                        <div key={`${r.label}-${r.value}`} className="flex gap-2 text-[12px]">
                          <dt className="font-semibold text-stone-500 w-20 shrink-0">{r.label}</dt>
                          <dd className="text-stone-800 min-w-0">{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700 mb-3">
                    Factores que definen el diagnóstico
                    <span className="text-stone-400 font-semibold normal-case tracking-normal ml-2">
                      {display.factors.length}
                      {display.factorsFromJustification ? " · justificación" : ""}
                    </span>
                  </p>
                  <ol className="space-y-4">
                    {display.factors.map((f, i) => (
                      <li key={f.id} className="flex gap-3 text-[13px]">
                        <span
                          className={`w-1 shrink-0 rounded-full self-stretch min-h-[1.25rem] ${
                            f.weight === "primary" ? "bg-amber-500" : "bg-stone-300"
                          }`}
                        />
                        <div className="min-w-0">
                          <span
                            className={
                              f.weight === "primary"
                                ? "font-semibold text-stone-900"
                                : "font-medium text-stone-700"
                            }
                          >
                            {i + 1}. {f.label}
                          </span>
                          {f.detail && (
                            <p className="text-[11.5px] text-stone-500 mt-0.5 leading-snug">
                              {f.detail}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Images RIGHT — snug to aspect, no letterbox */}
              <div className="min-w-0 space-y-4">
                {[display.imageA, display.imageB].filter(Boolean).length ? (
                  [display.imageA, display.imageB].filter(Boolean).map((slot) => (
                    <figure key={slot!.candidateId} className="m-0">
                      <div className="rounded-lg border border-stone-200 bg-stone-50 overflow-hidden leading-none">
                        <img
                          src={slot!.url}
                          alt={slot!.caption}
                          className="w-full h-auto block"
                        />
                      </div>
                      <figcaption className="text-[10px] text-stone-500 px-0.5 pt-1.5 italic">
                        {[slot!.caption, slot!.sourceLabel].filter(Boolean).join(" · ")}
                      </figcaption>
                    </figure>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 aspect-[4/3] flex flex-col items-center justify-center gap-2 text-stone-400 px-4 text-center">
                    <ImageOff className="h-7 w-7 opacity-50" />
                    <p className="text-[11px] leading-snug">
                      Genera imágenes focales o elige A/B desde Focal / suite / Atlas.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-stone-500 border-t border-stone-200 pt-3 leading-relaxed">
              En conjunto, estos hallazgos permiten sostener el diagnóstico de «{display.diagnosis}
              »{display.categoryLabel ? ` (${display.categoryLabel})` : ""}. Esta lámina resume la
              justificación clínica del ancla para revisión del informe.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  function slotSelect(
    label: string,
    value: string,
    onChange: (v: string) => void,
    excludeId?: string
  ) {
    return (
      <label className="flex flex-col gap-1 min-w-[200px] flex-1">
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!candidates.length}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40"
        >
          {!candidates.length && <option value="">Sin imágenes disponibles</option>}
          {label.startsWith("Imagen B") && candidates.length > 0 && (
            <option value="">Ninguna</option>
          )}
          {candidates.map((c) => (
            <option key={c.id} value={c.id} disabled={c.id === excludeId}>
              {c.sourceLabel} · Panel {c.panelLetter}
              {c.caption ? ` — ${c.caption.slice(0, 40)}` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }
};

export default DiagnosticPackModule;
