import React, { useMemo } from "react";
import { FileStack, Loader2, RefreshCw } from "lucide-react";
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
  type DiagnosticPackData,
  type PackImageSource,
} from "../lib/diagnosticPack";

interface DiagnosticPackModuleProps {
  diagnosisAnchor: string;
  findingsInfographic: FindingsInfographicData | null;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  dominantLesionCard?: DominantLesionCardData | null;
  /** Organ suites (abdomen, mama, tiroides, …) with panels. */
  suiteSources?: PackImageSource[];
  /** Suite id matching the study (e.g. abdomen3d) — preferred image source. */
  preferredSuiteId?: string | null;
  preferredSuiteLabel?: string | null;
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
  dominantLesionCard = null,
  suiteSources = [],
  preferredSuiteId = null,
  preferredSuiteLabel = null,
  packData,
  setPackData,
  includeInReport,
  setIncludeInReport,
}) => {
  const packOpts = {
    diagnosisAnchor,
    findingsInfographic,
    scorecardData,
    atlas3dData,
    focalLesion3dData,
    dominantLesionCard,
    suiteSources,
    preferredSuiteId,
  };

  const preview = useMemo(
    () => buildDiagnosticPack(packOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- packOpts fields listed below
    [
      diagnosisAnchor,
      findingsInfographic,
      scorecardData,
      atlas3dData,
      focalLesion3dData,
      dominantLesionCard,
      suiteSources,
      preferredSuiteId,
    ]
  );

  const display = packData || preview;
  const canBuild = diagnosticPackIsRenderable(preview);

  const handleBuild = () => {
    const next = buildDiagnosticPack(packOpts);
    setPackData(next);
    setIncludeInReport(true);
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
                Compuesto
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              Ancla + factores de justificación + imagen (Corte Focal → suite 3D del estudio
              {preferredSuiteLabel ? ` «${preferredSuiteLabel}»` : ""} → Atlas) en una lámina PDF.
              Reutiliza lo ya generado; no llama a la IA.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleBuild}
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

      {!canBuild && (
        <p className="text-[11px] text-amber-200/90 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
          Define un <strong>ancla</strong> y genera la infografía de justificación (y/o scorecard /
          suite 3D / Atlas / corte focal) para armar el pack.
        </p>
      )}

      {display && canBuild && (
        <div className="rounded-2xl overflow-hidden border border-amber-500/25 bg-slate-950">
          <div className="bg-amber-800/90 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white flex justify-between gap-2">
            <span>{display.title}</span>
            {display.categoryLabel && (
              <span className="opacity-90 normal-case tracking-normal font-semibold truncate">
                {display.categoryLabel}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="p-4 md:p-5 space-y-3 border-b md:border-b-0 md:border-r border-slate-800">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/90">
                Diagnóstico ancla
              </p>
              <h4 className="text-lg md:text-xl font-black text-slate-50 leading-snug">
                {display.diagnosis}
              </h4>
              {display.studyRegion && (
                <p className="text-[11px] text-slate-500">{display.studyRegion}</p>
              )}
              {display.synthesis && (
                <p className="text-[12px] text-slate-300 leading-relaxed border-t border-slate-800 pt-3">
                  {display.synthesis}
                </p>
              )}
              <ol className="space-y-2 pt-1">
                {display.factors.map((f, i) => (
                  <li key={f.id} className="flex gap-2.5 text-[12px]">
                    <span className="font-mono text-amber-500/80 shrink-0 w-5 text-right">
                      {i + 1}.
                    </span>
                    <div className="min-w-0">
                      <span
                        className={
                          f.weight === "primary"
                            ? "font-semibold text-slate-100"
                            : "font-medium text-slate-300"
                        }
                      >
                        {f.label}
                      </span>
                      {f.detail && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{f.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-slate-900/80 min-h-[200px] flex flex-col">
              {display.imageDataUrl ? (
                <>
                  <img
                    src={display.imageDataUrl}
                    alt={display.imageCaption || "Imagen del pack"}
                    className="w-full h-auto object-contain max-h-[320px]"
                  />
                  {display.imageCaption && (
                    <p className="text-[10px] text-slate-400 px-3 py-2 border-t border-slate-800">
                      {display.imageCaption}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500 p-6 text-center">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 opacity-40" />
                    Sin imagen aún (focal / suite 3D / Atlas) — el pack irá solo con factores.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticPackModule;
