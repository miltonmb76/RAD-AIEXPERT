import React, { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  normalizeDominantLesionCardData,
  pickDominantLesionImage,
  type DominantLesionCardData,
} from "../lib/dominantLesionCard";
import type { FocalLesion3DData } from "../types";

type AttachedImage = {
  id?: string;
  url?: string;
  preview?: string;
  caption?: string;
  name?: string;
  modality?: string;
};

interface DominantLesionCardModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  cardData: DominantLesionCardData | null;
  setCardData: (data: DominantLesionCardData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  attachedImages?: AttachedImage[];
  /** Reuse existing focal 3D cut if available */
  focalLesion3dData?: FocalLesion3DData | null;
}

export const DominantLesionCardModule: React.FC<DominantLesionCardModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  clinicalHistory,
  cardData,
  setCardData,
  includeInReport,
  setIncludeInReport,
  attachedImages = [],
  focalLesion3dData = null,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorInstructions, setPriorInstructions] = useState("");
  const [focusText, setFocusText] = useState("");

  const linkedImage = useMemo(
    () => pickDominantLesionImage(attachedImages, cardData),
    [attachedImages, cardData]
  );

  const focalThumb = useMemo(() => {
    const panels = focalLesion3dData?.panels || [];
    const withUrl = panels.find((p) => p?.imageUrl);
    if (!withUrl?.imageUrl) return null;
    return {
      url: withUrl.imageUrl,
      title: withUrl.panelTitle || focalLesion3dData?.lesionLabel || "Corte 3D",
    };
  }, [focalLesion3dData]);

  const handleGenerate = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o redacta un informe primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-dominant-lesion-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
          clinicalHistory: clinicalHistory || "",
          priorInstructions: priorInstructions.trim() || undefined,
          focusText: focusText.trim() || undefined,
          hasAttachedImages: attachedImages.length > 0,
          hasFocal3d: Boolean(focalThumb),
        }),
      });
      const raw = await response.text();
      let json: any = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          response.ok
            ? "Respuesta inválida del servidor."
            : `Error ${response.status} al generar la ficha.`
        );
      }
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar la ficha de lesión dominante.");
      }
      setCardData(normalizeDominantLesionCardData(json.data, priorInstructions.trim()));
      setIncludeInReport(true);
    } catch (err: any) {
      console.error("Error generando ficha de lesión dominante:", err);
      setError(err?.message || "Error al generar la ficha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-slate-950/80 p-4 md:p-5 space-y-4 shadow-xl shadow-rose-950/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-rose-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-rose-200 font-mono">
              Ficha de lesión dominante
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-xl">
              Una página: medidas, categoría, imagen US/MMG, corte 3D (si existe) y frase para el
              clínico. Sirve para cualquier estudio con un hallazgo principal.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900 text-rose-500 focus:ring-rose-500"
          />
          Incluir en PDF
        </label>
      </div>

      <div className="space-y-2">
        <label className="block text-[9px] font-black uppercase tracking-widest text-rose-300/80 font-mono">
          Instrucciones previas (opcional)
        </label>
        <textarea
          value={priorInstructions}
          onChange={(e) => setPriorInstructions(e.target.value)}
          rows={2}
          placeholder="Ej.: La dominante es el nódulo CSE derecha; ignora quistes simples; usa BI-RADS del informe; frase corta para el mastólogo."
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-rose-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">
          Foco manual (si hay varias lesiones)
        </label>
        <input
          type="text"
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          placeholder="Ej.: nódulo sólido CSE mama derecha 14 mm"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-rose-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
        {attachedImages.length > 0 && (
          <span>{attachedImages.length} imagen(es) adjunta(s) · se intentará vincular Figura N</span>
        )}
        {focalThumb && <span>· Corte 3D disponible para miniatura</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !reportText.trim()}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generando ficha...
            </>
          ) : cardData ? (
            <>
              <RefreshCw className="h-4 w-4" /> Regenerar ficha
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generar ficha
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {cardData && (
        <DominantLesionCardPreview
          data={cardData}
          linkedImage={linkedImage}
          focalThumb={focalThumb}
        />
      )}
    </div>
  );
};

export const DominantLesionCardPreview: React.FC<{
  data: DominantLesionCardData;
  linkedImage?: { url: string; caption: string; modality?: string } | null;
  focalThumb?: { url: string; title: string } | null;
}> = ({ data, linkedImage = null, focalThumb = null }) => {
  const categoryBadge =
    data.categorySystem || data.categoryValue
      ? [data.categorySystem, data.categoryValue].filter(Boolean).join(" ")
      : null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-300/90 font-mono">
            {data.title}
          </p>
          <p className="text-sm font-semibold text-slate-100 mt-1">{data.lesionLabel}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {[data.site, data.laterality, data.studyRegion].filter(Boolean).join(" · ")}
          </p>
        </div>
        {categoryBadge && (
          <span className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs font-black uppercase tracking-wide">
            {categoryBadge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-0">
        <div className="p-4 space-y-3 border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden aspect-[4/3] flex items-center justify-center">
            {linkedImage ? (
              <img
                src={linkedImage.url}
                alt={linkedImage.caption}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <p className="text-[11px] text-slate-500 px-4 text-center">
                Sin imagen US/MMG vinculada. Adjunta capturas o correlaciona figuras.
              </p>
            )}
          </div>
          {linkedImage && (
            <p className="text-[10px] text-slate-500 font-mono">
              {data.figureRef ? `Fig. ${data.figureRef} · ` : ""}
              {linkedImage.caption}
              {linkedImage.modality ? ` · ${linkedImage.modality}` : ""}
            </p>
          )}

          {focalThumb && (
            <div className="rounded-xl border border-teal-900/50 bg-teal-950/20 p-2 flex gap-3 items-center">
              <img
                src={focalThumb.url}
                alt={focalThumb.title}
                className="h-20 w-28 object-cover rounded-lg border border-teal-800/60"
              />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-teal-300/90 font-mono">
                  Corte 3D
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{focalThumb.title}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {(data.sizeSummary || data.measurements.length > 0) && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono mb-2">
                Medidas
              </p>
              {data.sizeSummary && (
                <p className="text-lg font-semibold text-slate-100 tabular-nums mb-2">
                  {data.sizeSummary}
                </p>
              )}
              {data.measurements.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {data.measurements.map((m) => (
                    <div
                      key={`${m.label}-${m.value}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2"
                    >
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">{m.label}</p>
                      <p className="text-sm font-semibold text-slate-100 tabular-nums">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {data.categoryRationale && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono mb-1">
                Categoría
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">{data.categoryRationale}</p>
            </div>
          )}

          {data.keyDescriptors && data.keyDescriptors.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono mb-1.5">
                Descriptores
              </p>
              <ul className="space-y-1">
                {data.keyDescriptors.map((d) => (
                  <li key={d} className="text-[11px] text-slate-300 flex gap-2">
                    <span className="text-rose-400 shrink-0">·</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-rose-500/30 bg-rose-950/25 px-3 py-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-300/90 font-mono mb-1.5">
              Frase para el clínico
            </p>
            <p className="text-sm text-rose-50 leading-relaxed">{data.clinicianPhrase}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DominantLesionCardModule;
