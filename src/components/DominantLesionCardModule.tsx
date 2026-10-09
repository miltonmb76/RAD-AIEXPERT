import React, { useMemo, useState } from "react";
import { FileSpreadsheet, ImageIcon, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  listSelectableDominantImages,
  normalizeDominantLesionCardData,
  pickDominantLesionImage,
  type DominantLesionCardData,
  type DominantLesionPickedImage,
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

  const selectableImages = useMemo(
    () => listSelectableDominantImages(attachedImages),
    [attachedImages]
  );

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

  const selectImage = (img: DominantLesionPickedImage) => {
    if (!cardData) {
      // Seed a minimal card shell so the picker sticks before generate
      setCardData(
        normalizeDominantLesionCardData(
          {
            lesionLabel: "Lesión dominante",
            site: studyType || "Sitio pendiente",
            clinicianPhrase: "Genera la ficha para completar el resumen clínico.",
            selectedImageId: img.id,
          },
          priorInstructions.trim()
        )
      );
      return;
    }
    setCardData({ ...cardData, selectedImageId: img.id || null });
  };

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
          imageCaptions: selectableImages.map((i, n) => ({
            n: n + 1,
            id: i.id,
            caption: i.caption,
            modality: i.modality || "",
          })),
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
      const next = normalizeDominantLesionCardData(json.data, priorInstructions.trim(), {
        selectedImageId: cardData?.selectedImageId ?? null,
      });
      // If no manual pick yet, lock auto-picked image so PDF stays stable
      if (!next.selectedImageId) {
        const auto = pickDominantLesionImage(attachedImages, next);
        if (auto?.id) next.selectedImageId = auto.id;
      }
      setCardData(next);
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
              Una página elegante: imagen clínica, medidas, categoría y frase para el tratante.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-[9px] font-black uppercase tracking-widest text-rose-300/80 font-mono">
            Instrucciones previas
          </label>
          <textarea
            value={priorInstructions}
            onChange={(e) => setPriorInstructions(e.target.value)}
            rows={2}
            placeholder="Ej.: dominante = nódulo CSE derecha; frase corta para mastólogo."
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-rose-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">
            Foco manual
          </label>
          <input
            type="text"
            value={focusText}
            onChange={(e) => setFocusText(e.target.value)}
            placeholder="Ej.: nódulo sólido CSE mama derecha 14 mm"
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-rose-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {selectableImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5 text-rose-300" />
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-300/80 font-mono">
              Imagen asociada
            </p>
            <span className="text-[10px] text-slate-500">
              {linkedImage
                ? `Fig. ${linkedImage.index + 1}${linkedImage.modality ? ` · ${linkedImage.modality}` : ""}`
                : "Elige una captura"}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectableImages.map((img) => {
              const active = linkedImage?.id === img.id;
              return (
                <button
                  key={img.id || img.index}
                  type="button"
                  onClick={() => selectImage(img)}
                  className={`shrink-0 w-24 rounded-xl overflow-hidden border transition-all ${
                    active
                      ? "border-rose-400 ring-2 ring-rose-500/40"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                  title={img.caption}
                >
                  <div className="aspect-square bg-black">
                    <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                  </div>
                  <p className="px-1.5 py-1 text-[9px] text-slate-300 truncate bg-slate-900">
                    {img.index + 1}. {img.modality || "IMG"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectableImages.length === 0 && (
        <p className="text-[10px] text-amber-200/80 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
          Sin capturas adjuntas. Adjunta una imagen US/MMG (y correlaciona figuras) para que la ficha
          lleve foto clínica.
        </p>
      )}

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
          ) : cardData?.lesionLabel && cardData.lesionLabel !== "Lesión dominante" ? (
            <>
              <RefreshCw className="h-4 w-4" /> Regenerar ficha
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generar ficha
            </>
          )}
        </button>
        {focalThumb && (
          <span className="self-center text-[10px] text-teal-300/80">Corte 3D disponible</span>
        )}
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
  linkedImage?: DominantLesionPickedImage | null;
  focalThumb?: { url: string; title: string } | null;
}> = ({ data, linkedImage = null, focalThumb = null }) => {
  const categoryBadge =
    data.categorySystem || data.categoryValue
      ? [data.categorySystem, data.categoryValue].filter(Boolean).join(" ")
      : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/50 bg-[#f8fafc] text-slate-900 shadow-2xl shadow-black/40">
      {/* Masthead */}
      <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950 text-white">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/40 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              Lesión dominante
            </p>
            <h4 className="mt-1.5 text-xl md:text-2xl font-semibold tracking-tight leading-snug">
              {data.lesionLabel}
            </h4>
            <p className="mt-1.5 text-sm text-slate-300">
              {[data.site, data.laterality, data.studyRegion].filter(Boolean).join(" · ")}
            </p>
          </div>
          {categoryBadge && (
            <div className="shrink-0 rounded-2xl bg-white text-rose-900 px-4 py-2.5 text-center shadow-lg shadow-rose-950/30">
              <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/80">
                Categoría
              </p>
              <p className="text-lg font-black tracking-tight leading-none mt-0.5">{categoryBadge}</p>
            </div>
          )}
        </div>
      </div>

      {/* Body: image + clinical facts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative bg-slate-950 min-h-[280px] lg:min-h-[340px]">
          {linkedImage ? (
            <>
              <img
                src={linkedImage.url}
                alt={linkedImage.caption}
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-3">
                <p className="text-[11px] text-white/95 font-medium">
                  {data.figureRef ? `Figura ${data.figureRef}` : `Figura ${linkedImage.index + 1}`}
                  {linkedImage.modality ? ` · ${linkedImage.modality}` : ""}
                </p>
                {linkedImage.caption && (
                  <p className="text-[10px] text-white/70 truncate mt-0.5">{linkedImage.caption}</p>
                )}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 px-6 text-center">
              <ImageIcon className="h-8 w-8 opacity-50" />
              <p className="text-xs">Sin imagen asociada</p>
              <p className="text-[10px] text-slate-600">Adjunta una captura y selecciónala arriba</p>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5 bg-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Tamaño
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {data.sizeSummary || "—"}
            </p>
            {data.measurements.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {data.measurements.map((m) => (
                  <div
                    key={`${m.label}-${m.value}`}
                    className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2"
                  >
                    <p className="text-[9px] uppercase tracking-wide text-slate-400">{m.label}</p>
                    <p className="text-sm font-semibold text-slate-800 tabular-nums mt-0.5">
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.categoryRationale && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Fundamento
              </p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{data.categoryRationale}</p>
            </div>
          )}

          {data.keyDescriptors && data.keyDescriptors.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
                Descriptores
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.keyDescriptors.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] px-2.5 py-1 border border-slate-200/80"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {focalThumb && (
            <div className="flex gap-3 items-center rounded-xl border border-teal-100 bg-teal-50/70 p-2">
              <img
                src={focalThumb.url}
                alt={focalThumb.title}
                className="h-16 w-24 object-cover rounded-lg border border-teal-200"
              />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-700">
                  Corte 3D
                </p>
                <p className="text-[11px] text-teal-900/80 mt-0.5 leading-snug">{focalThumb.title}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinician phrase — full bleed footer */}
      <div className="border-t border-rose-100 bg-gradient-to-r from-rose-50 via-white to-rose-50 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-500">
          Para el clínico
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-800 font-medium">
          {data.clinicianPhrase}
        </p>
      </div>
    </div>
  );
};

export default DominantLesionCardModule;
