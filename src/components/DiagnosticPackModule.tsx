import React, { useEffect, useMemo, useState } from "react";
import {
  FileStack,
  RefreshCw,
  ImageOff,
  AlertTriangle,
  Loader2,
  Sparkles,
  Box,
  Pencil,
  Trash2,
  Plus,
  Check,
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
  factorsAreNearDuplicate,
  listPackImageCandidates,
  MAX_DIAGNOSTIC_PACKS,
  newDiagnosticPackId,
  type DiagnosticPackData,
  type DiagnosticPackFactor,
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
  /** Inserted packs (PDF annexes). Independent of draft. */
  packs: DiagnosticPackData[];
  setPacks: (packs: DiagnosticPackData[]) => void;
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
  packs,
  setPacks,
}) => {
  const scorecardDx = resolveScorecardFinalDiagnosis(scorecardData);
  const defaultDx =
    String(diagnosisAnchor || "").trim() ||
    scorecardDx ||
    String(dominantLesionCard?.lesionLabel || "").trim();

  const [diagnosisBase, setDiagnosisBase] = useState<string>(defaultDx);
  const [dxTouched, setDxTouched] = useState(false);
  const [draftPack, setDraftPack] = useState<DiagnosticPackData | null>(null);
  const [draftId, setDraftId] = useState(() => newDiagnosticPackId());
  const [slotAId, setSlotAId] = useState<string>("");
  const [slotBId, setSlotBId] = useState<string>("");
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pendingAutoBuild, setPendingAutoBuild] = useState(false);
  const [expandedInsertedId, setExpandedInsertedId] = useState<string | null>(null);

  // Follow ancla/scorecard until the user edits the diagnosis field.
  useEffect(() => {
    if (dxTouched) return;
    if (defaultDx) setDiagnosisBase(defaultDx);
  }, [defaultDx, dxTouched]);

  const candidates = useMemo(
    () =>
      listPackImageCandidates({
        focalLesion3dData,
        atlas3dData,
        suiteSources,
      }),
    [focalLesion3dData, atlas3dData, suiteSources]
  );

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
    diagnosisBase,
    diagnosisAnchor,
    reportText,
    findingsInfographic,
    preferInfographicFactors: false,
    scorecardData,
    atlas3dData,
    focalLesion3dData,
    dominantLesionCard,
    suiteSources,
    preferredSuiteId,
    imageSlotAId: slotAId || null,
    imageSlotBId: slotBId,
    packId: draftId,
  };

  const preview = useMemo(
    () => buildDiagnosticPack(packOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      diagnosisBase,
      diagnosisAnchor,
      reportText,
      findingsInfographic,
      scorecardData,
      atlas3dData,
      focalLesion3dData,
      dominantLesionCard,
      suiteSources,
      preferredSuiteId,
      slotAId,
      slotBId,
      draftId,
    ]
  );

  const display =
    draftPack && String(draftPack.diagnosis || "").trim() ? draftPack : preview;
  const canBuild = diagnosticPackIsRenderable(preview);
  const missing = diagnosticPackMissingRequirements(display);
  const canGenerateImages =
    !!setFocalLesion3dData &&
    !!String(reportText || "").trim() &&
    !!String(diagnosisBase || "").trim();
  const atPackLimit = packs.length >= MAX_DIAGNOSTIC_PACKS;

  const handleBuild = (optsOverride?: Partial<typeof packOpts>) => {
    const next = buildDiagnosticPack({ ...packOpts, ...optsOverride });
    setDraftPack(next);
    return diagnosticPackIsRenderable(next);
  };

  const ensureDraft = (): DiagnosticPackData | null => {
    if (draftPack && String(draftPack.diagnosis || "").trim()) return draftPack;
    if (String(preview.diagnosis || "").trim()) {
      setDraftPack(preview);
      return preview;
    }
    return null;
  };

  const withFactorTarget = (factors: DiagnosticPackFactor[]): DiagnosticPackData["factorTarget"] =>
    factors.length >= 6 ? 6 : 4;

  const updateFactor = (id: string, patch: Partial<DiagnosticPackFactor>) => {
    const base = ensureDraft();
    if (!base) return;
    const factors = base.factors.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setDraftPack({
      ...base,
      diagnosis: diagnosisBase || base.diagnosis,
      factors,
      factorTarget: withFactorTarget(factors),
    });
  };

  const removeFactor = (id: string) => {
    const base = ensureDraft();
    if (!base || base.factors.length <= 1) return;
    const factors = base.factors.filter((f) => f.id !== id);
    setDraftPack({
      ...base,
      factors,
      factorTarget: withFactorTarget(factors),
    });
  };

  const removeNearDuplicateFactors = () => {
    const base = ensureDraft();
    if (!base) return;
    const kept: DiagnosticPackFactor[] = [];
    for (const f of base.factors) {
      const label = String(f.label || "").trim();
      if (!label) continue;
      const blob = `${label} ${String(f.detail || "").trim()}`;
      const dup = kept.some(
        (k) =>
          factorsAreNearDuplicate(label, k.label) ||
          factorsAreNearDuplicate(blob, `${k.label} ${String(k.detail || "").trim()}`)
      );
      if (dup) continue;
      kept.push(f);
    }
    if (kept.length === base.factors.length) return;
    const factors = kept.length ? kept : base.factors.slice(0, 1);
    setDraftPack({
      ...base,
      factors,
      factorTarget: withFactorTarget(factors),
    });
  };

  const resetDraft = (keepDx = true) => {
    setDraftPack(null);
    setDraftId(newDiagnosticPackId());
    setPendingAutoBuild(false);
    setGenError(null);
    if (!keepDx) {
      setDxTouched(false);
      setDiagnosisBase(defaultDx);
    }
  };

  const handleInsertPack = () => {
    if (atPackLimit) {
      setGenError(`Maximo ${MAX_DIAGNOSTIC_PACKS} packs por estudio.`);
      return;
    }
    const built =
      draftPack && String(draftPack.diagnosis || "").trim()
        ? {
            ...draftPack,
            diagnosis: String(diagnosisBase || draftPack.diagnosis).trim(),
            id: draftPack.id || draftId,
            includeInReport: true,
          }
        : buildDiagnosticPack(packOpts);
    if (!diagnosticPackIsRenderable(built)) {
      setGenError("Completa diagnostico, ≥4 factores e imagen A antes de insertar.");
      setDraftPack(built);
      return;
    }
    setPacks([
      ...packs,
      {
        ...built,
        id: built.id || newDiagnosticPackId(),
        includeInReport: true,
      },
    ]);
    resetDraft(false);
    setGenError(null);
  };

  const removeInsertedPack = (id: string) => {
    setPacks(packs.filter((p) => (p.id || "") !== id));
    if (expandedInsertedId === id) setExpandedInsertedId(null);
  };

  const toggleInsertedInclude = (id: string, include: boolean) => {
    setPacks(
      packs.map((p) => ((p.id || "") === id ? { ...p, includeInReport: include } : p))
    );
  };

  const updateInsertedFactor = (
    packId: string,
    factorId: string,
    patch: Partial<DiagnosticPackFactor>
  ) => {
    setPacks(
      packs.map((p) => {
        if ((p.id || "") !== packId) return p;
        const factors = p.factors.map((f) =>
          f.id === factorId ? { ...f, ...patch } : f
        );
        return { ...p, factors, factorTarget: withFactorTarget(factors) };
      })
    );
  };

  const removeInsertedFactor = (packId: string, factorId: string) => {
    setPacks(
      packs.map((p) => {
        if ((p.id || "") !== packId || p.factors.length <= 1) return p;
        const factors = p.factors.filter((f) => f.id !== factorId);
        return { ...p, factors, factorTarget: withFactorTarget(factors) };
      })
    );
  };

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
        "Imagenes listas. Revisa factores (≥4) y pulsa «Armar borrador» o «Insertar pack»."
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
      setGenError("Necesitas un informe para generar las imagenes del pack.");
      return;
    }
    const focus = String(diagnosisBase || "").trim();
    if (!focus) {
      setGenError("Escribe el diagnostico base antes de pedir las imagenes.");
      return;
    }

    setIsGeneratingImages(true);
    setGenError(null);
    try {
      const scorecardDirectives = buildAtlasDirectivesFromScorecard(scorecardData);
      const packDirective = [
        "PACK DIAGNOSTICO (lamina de justificacion):",
        `Diagnostico base obligatorio: «${focus}».`,
        "Genera cortes 3D focales centrados en esa lesion/diagnostico (misma metodologia que Corte Focal).",
        "Panel A = contexto anatomico util; Panel B = macro de la lesion dominante.",
        "Sin texto ni numeros en la imagen.",
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
        throw new Error(resData.error || "Error al generar imagenes focales para el pack.");
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
      console.error("Error generando imagenes del pack:", err);
      setGenError(err?.message || "Error al generar las imagenes del pack.");
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
                Pack diagnostico (multi)
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-amber-950/50 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded">
                Solo medico
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                {packs.length}/{MAX_DIAGNOSTIC_PACKS} insertados
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Independiente de la infografia de justificacion. Diagnostico editable · factores desde
              informe + scorecard + suites · varios packs insertables
              {preferredSuiteLabel ? ` · suite: ${preferredSuiteLabel}` : ""}.
            </p>
          </div>
        </div>
      </div>

      {/* Inserted packs list */}
      {packs.length > 0 && (
        <div className="rounded-xl border border-emerald-700/35 bg-emerald-950/20 px-3.5 py-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
            Packs insertados en el informe
          </p>
          <ul className="space-y-2">
            {packs.map((p, idx) => {
              const pid = p.id || `idx-${idx}`;
              const ok = diagnosticPackIsRenderable(p);
              const expanded = expandedInsertedId === pid;
              return (
                <li
                  key={pid}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/90 font-mono">
                      Pack {idx + 1}
                    </span>
                    <span className="text-[12px] text-slate-200 font-semibold min-w-0 flex-1 truncate">
                      {p.diagnosis}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {p.factors?.length || 0} fact.
                      {!ok ? " · incompleto" : ""}
                    </span>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.includeInReport !== false && ok}
                        disabled={!ok}
                        onChange={(e) => toggleInsertedInclude(pid, e.target.checked)}
                        className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 disabled:opacity-40"
                      />
                      PDF
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedInsertedId(expanded ? null : pid)
                      }
                      className="px-2 py-1 rounded-lg border border-slate-700 text-[9px] font-bold uppercase text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {expanded ? "Cerrar" : "Editar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeInsertedPack(pid)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-900/40 text-[9px] font-bold uppercase text-rose-300/90 hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Quitar
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-slate-800/80 pt-2">
                      {p.factors.map((f, fi) => (
                        <div
                          key={f.id}
                          className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1.5"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="text-[9px] font-mono text-slate-500">
                              Factor {fi + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeInsertedFactor(pid, f.id)}
                              disabled={p.factors.length <= 1}
                              className="text-[9px] uppercase font-bold text-slate-500 hover:text-rose-300 disabled:opacity-30 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                          <input
                            type="text"
                            value={f.label}
                            onChange={(e) =>
                              updateInsertedFactor(pid, f.id, { label: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 outline-none focus:border-emerald-500"
                          />
                          <textarea
                            value={f.detail || ""}
                            onChange={(e) =>
                              updateInsertedFactor(pid, f.id, { detail: e.target.value })
                            }
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-emerald-500 resize-y"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Draft builder */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-3.5 py-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">
          Borrador del siguiente pack
        </p>
        <label className="block space-y-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Diagnostico base
          </span>
          <input
            type="text"
            value={diagnosisBase}
            onChange={(e) => {
              setDxTouched(true);
              setDiagnosisBase(e.target.value);
              setDraftPack((prev) =>
                prev ? { ...prev, diagnosis: e.target.value } : prev
              );
            }}
            placeholder="Por defecto toma el ancla; puedes cambiarlo"
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none font-semibold"
          />
          <span className="text-[10px] text-slate-500 leading-relaxed block">
            Factores y imagenes focales usan este diagnostico (no la infografia de justificacion).
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-3.5 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5" />
              Imagenes focales on-demand
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-xl">
              Genera contexto + macro con el diagnostico base del borrador. Al insertar, las URLs
              quedan guardadas en ese pack (el siguiente no borra el anterior).
            </p>
            {diagnosisBase && (
              <p className="text-[11px] text-amber-100/90 mt-1.5">
                Foco: <span className="font-semibold">{diagnosisBase}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerateFocalImages}
            disabled={!canGenerateImages || isGeneratingImages}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-45 text-slate-950 text-[11px] font-black uppercase tracking-wider cursor-pointer shrink-0"
          >
            {isGeneratingImages ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGeneratingImages
              ? "Generando 3D…"
              : candidates.some((c) => c.sourceId === "focal")
                ? "Regenerar imagenes focales"
                : "Generar imagenes focales"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slotSelect("Imagen A (obligatoria)", slotAId, setSlotAId, slotBId)}
        {slotSelect("Imagen B (recomendada)", slotBId, setSlotBId, slotAId)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleBuild()}
          disabled={!String(diagnosisBase || "").trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
          title="Extrae factores del informe, scorecard y suites disponibles"
        >
          <RefreshCw className="h-4 w-4" />
          {draftPack ? "Re-extraer factores" : "Extraer factores / Armar borrador"}
        </button>
        <button
          type="button"
          onClick={handleInsertPack}
          disabled={atPackLimit || !diagnosticPackIsRenderable(display)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
          title="Guarda este pack en la lista sin borrar los anteriores"
        >
          <Check className="h-4 w-4" />
          Insertar pack
        </button>
        <button
          type="button"
          onClick={() => resetDraft(false)}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold uppercase cursor-pointer"
          title="Limpia el borrador para armar otro diagnostico (los insertados se conservan)"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo borrador
        </button>
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
            Requisitos del borrador
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-100/85">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {(display.factors?.length || 0) > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/25 via-slate-950/80 to-slate-950 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-200/90">
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Editar factores (borrador)
              </span>
              <span className="text-[10px] text-slate-500 font-mono normal-case tracking-normal">
                {display.factors.length} · PDF requiere ≥4
              </span>
            </div>
            <button
              type="button"
              onClick={removeNearDuplicateFactors}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-700/40 text-[10px] font-black uppercase tracking-wider text-amber-200/90 hover:bg-amber-950/50 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Quitar duplicados
            </button>
          </div>
          <div className="space-y-2.5">
            {display.factors.map((f, idx) => (
              <div
                key={f.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90 font-mono">
                    Factor {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFactor(f.id)}
                    disabled={display.factors.length <= 1}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-300 disabled:opacity-30 font-bold uppercase cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Etiqueta
                    </span>
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => updateFactor(f.id, { label: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-amber-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Peso
                    </span>
                    <select
                      value={f.weight || "secondary"}
                      onChange={(e) =>
                        updateFactor(f.id, {
                          weight: e.target.value as DiagnosticPackFactor["weight"],
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="primary">Primario</option>
                      <option value="secondary">Secundario</option>
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-3">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Detalle
                    </span>
                    <textarea
                      value={f.detail || ""}
                      onChange={(e) => updateFactor(f.id, { detail: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-amber-500 resize-y"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {display.diagnosis && (
        <div className="rounded-2xl overflow-hidden border border-stone-600/40 bg-[#fafaf9] text-stone-900 shadow-inner">
          <div className="mx-4 mt-4 rounded-lg bg-stone-900 px-4 py-2.5 flex justify-between gap-3 items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-50 shrink-0 max-w-[55%]">
              Vista previa · borrador
            </span>
            <span className="text-[10px] text-amber-200/90 font-medium text-right min-w-0 flex-1 line-clamp-2 break-words">
              {[display.categoryLabel, display.studyRegion].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="mx-4 h-1 bg-amber-500 rounded-b" />
          <div className="p-5 md:p-6 space-y-4">
            <div className="space-y-2 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">
                Diagnostico base
              </p>
              <h4 className="text-xl md:text-2xl font-black text-stone-900 leading-snug tracking-tight break-words hyphens-auto">
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
                    Factores que definen el diagnostico
                    <span className="text-stone-400 font-semibold normal-case tracking-normal ml-2">
                      {display.factors.length}
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
                      Genera imagenes focales o elige A/B desde Focal / suite / Atlas.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
          {!candidates.length && <option value="">Sin imagenes disponibles</option>}
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
