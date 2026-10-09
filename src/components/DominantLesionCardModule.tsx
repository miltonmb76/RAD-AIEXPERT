import React, { useMemo, useState } from "react";
import {
  Box,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  DOMINANT_LESION_LAYOUT_OPTIONS,
  buildFocalFocusFromCard,
  listSelectableDominantImages,
  normalizeDominantLesionCardData,
  pickDominantLesionImage,
  pickDominantLesionImageB,
  type DominantLesionCardData,
  type DominantLesionImageLayout,
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
  /** Model for focal 3D generation (usually modelFor("focal_lesion3d")) */
  focalSelectedModel?: string;
  reportText: string;
  studyType?: string;
  clinicalHistory?: string;
  cardData: DominantLesionCardData | null;
  setCardData: (data: DominantLesionCardData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  attachedImages?: AttachedImage[];
  focalLesion3dData?: FocalLesion3DData | null;
  setFocalLesion3dData?: (data: FocalLesion3DData | null) => void;
  setIncludeFocalLesion3dInReport?: (include: boolean) => void;
}

export const DominantLesionCardModule: React.FC<DominantLesionCardModuleProps> = ({
  selectedModel,
  focalSelectedModel,
  reportText,
  studyType,
  clinicalHistory,
  cardData,
  setCardData,
  includeInReport,
  setIncludeInReport,
  attachedImages = [],
  focalLesion3dData = null,
  setFocalLesion3dData,
  setIncludeFocalLesion3dInReport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating3d, setIsGenerating3d] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorInstructions, setPriorInstructions] = useState("");
  const [focusText, setFocusText] = useState("");

  const layout: DominantLesionImageLayout = cardData?.imageLayout || "single";

  const selectableImages = useMemo(
    () => listSelectableDominantImages(attachedImages),
    [attachedImages]
  );

  const imageA = useMemo(
    () => pickDominantLesionImage(attachedImages, cardData),
    [attachedImages, cardData]
  );
  const imageB = useMemo(
    () => pickDominantLesionImageB(attachedImages, cardData),
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

  const patchCard = (patch: Partial<DominantLesionCardData>) => {
    if (!cardData) {
      setCardData(
        normalizeDominantLesionCardData(
          {
            lesionLabel: "Lesión dominante",
            site: studyType || "Sitio pendiente",
            clinicianPhrase: "Genera la ficha para completar el resumen clínico.",
            ...patch,
          },
          priorInstructions.trim()
        )
      );
      return;
    }
    setCardData({ ...cardData, ...patch });
  };

  const setLayout = (next: DominantLesionImageLayout) => {
    patchCard({ imageLayout: next });
  };

  const selectSlotA = (img: DominantLesionPickedImage) => {
    patchCard({ selectedImageId: img.id || null });
  };
  const selectSlotB = (img: DominantLesionPickedImage) => {
    patchCard({ selectedImageIdB: img.id || null });
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
        selectedImageIdB: cardData?.selectedImageIdB ?? null,
        imageLayout: cardData?.imageLayout || "single",
      });
      if (!next.selectedImageId) {
        const auto = pickDominantLesionImage(attachedImages, next);
        if (auto?.id) next.selectedImageId = auto.id;
      }
      if (next.imageLayout === "mmg_us" && !next.selectedImageIdB) {
        const autoB = pickDominantLesionImageB(attachedImages, next);
        if (autoB?.id) next.selectedImageIdB = autoB.id;
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

  const handleGenerate3d = async () => {
    if (!setFocalLesion3dData) {
      setError("No se puede generar 3D desde aquí (falta cableado).");
      return;
    }
    if (!reportText.trim()) {
      setError("Necesitas un informe para generar el corte 3D.");
      return;
    }
    const focus =
      focusText.trim() ||
      buildFocalFocusFromCard(cardData) ||
      "Lesión dominante del informe";
    setIsGenerating3d(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-focal-lesion-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          organOrStudy: studyType || "",
          requestedModel: focalSelectedModel || selectedModel,
          focusMode: "manual",
          focusText: focus,
          includeMacroPanel: false,
          laterality: cardData?.laterality || undefined,
        }),
      });
      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || "Error al generar el corte focal 3D.");
      }
      setFocalLesion3dData(resData.data as FocalLesion3DData);
      setIncludeFocalLesion3dInReport?.(true);
      // Switch layout to clinical + 3D so the new cut appears on the card
      patchCard({ imageLayout: "clinical_3d" });
    } catch (err: any) {
      console.error("Error generando 3D desde ficha:", err);
      setError(err?.message || "Error al generar el corte 3D.");
    } finally {
      setIsGenerating3d(false);
    }
  };

  const hasGeneratedCard =
    Boolean(cardData?.lesionLabel) && cardData!.lesionLabel !== "Lesión dominante";

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
              Una página: elige US, MMG+US o clínica+3D; puedes generar el corte 3D de esta lesión.
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
            Foco (ficha y/o 3D)
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

      {/* Layout mode */}
      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-rose-300/80 font-mono">
          Composición de imágenes
        </p>
        <div className="flex flex-wrap gap-2">
          {DOMINANT_LESION_LAYOUT_OPTIONS.map((opt) => {
            const active = layout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLayout(opt.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-colors ${
                  active
                    ? "bg-rose-600 border-rose-400 text-white"
                    : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
                title={opt.hint}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Image pickers */}
      {selectableImages.length > 0 ? (
        <div className="space-y-3">
          <ImageSlotPicker
            label={layout === "mmg_us" ? "Imagen A · MMG (preferida)" : "Imagen clínica"}
            images={selectableImages}
            activeId={imageA?.id}
            onSelect={selectSlotA}
          />
          {layout === "mmg_us" && (
            <ImageSlotPicker
              label="Imagen B · US (preferida)"
              images={selectableImages}
              activeId={imageB?.id}
              onSelect={selectSlotB}
            />
          )}
          {layout === "clinical_3d" && (
            <p className="text-[10px] text-teal-300/80">
              Panel derecho / inferior: corte 3D{" "}
              {focalThumb ? `(listo: ${focalThumb.title})` : "(aún no generado)"}.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-amber-200/80 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2">
          Sin capturas adjuntas. Adjunta US/MMG para asociar imagen clínica a la ficha.
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
          ) : hasGeneratedCard ? (
            <>
              <RefreshCw className="h-4 w-4" /> Regenerar ficha
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generar ficha
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleGenerate3d}
          disabled={isGenerating3d || !reportText.trim() || !setFocalLesion3dData}
          className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          title="Genera el Corte Focal 3D anclado a esta lesión"
        >
          {isGenerating3d ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generando 3D...
            </>
          ) : (
            <>
              <Box className="h-4 w-4" />{" "}
              {focalThumb ? "Regenerar 3D de esta lesión" : "Generar 3D de esta lesión"}
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
          imageA={imageA}
          imageB={imageB}
          focalThumb={focalThumb}
        />
      )}
    </div>
  );
};

const ImageSlotPicker: React.FC<{
  label: string;
  images: DominantLesionPickedImage[];
  activeId?: string;
  onSelect: (img: DominantLesionPickedImage) => void;
}> = ({ label, images, activeId, onSelect }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <ImageIcon className="h-3.5 w-3.5 text-rose-300" />
      <p className="text-[9px] font-black uppercase tracking-widest text-rose-300/80 font-mono">
        {label}
      </p>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {images.map((img) => {
        const active = activeId === img.id;
        return (
          <button
            key={`${label}-${img.id || img.index}`}
            type="button"
            onClick={() => onSelect(img)}
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
);

export const DominantLesionCardPreview: React.FC<{
  data: DominantLesionCardData;
  imageA?: DominantLesionPickedImage | null;
  imageB?: DominantLesionPickedImage | null;
  focalThumb?: { url: string; title: string } | null;
}> = ({ data, imageA = null, imageB = null, focalThumb = null }) => {
  const layout = data.imageLayout || "single";
  const categoryBadge =
    data.categorySystem || data.categoryValue
      ? [data.categorySystem, data.categoryValue].filter(Boolean).join(" ")
      : null;

  const showDualClinical = layout === "mmg_us";
  const showClinical3d = layout === "clinical_3d";

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/50 bg-[#f8fafc] text-slate-900 shadow-2xl shadow-black/40">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Media column */}
        <div className="bg-slate-950 min-h-[280px]">
          {showDualClinical ? (
            <div className="grid grid-cols-2 h-full min-h-[280px] lg:min-h-[340px]">
              <MediaCell
                image={imageA}
                empty="MMG"
                badge={imageA?.modality || "MMG"}
                figureHint={data.figureRef ? `Fig. ${data.figureRef}` : undefined}
              />
              <MediaCell image={imageB} empty="US" badge={imageB?.modality || "US"} />
            </div>
          ) : showClinical3d ? (
            <div className="grid grid-rows-2 h-full min-h-[320px] lg:min-h-[380px]">
              <MediaCell
                image={imageA}
                empty="US / MMG"
                badge={imageA?.modality || "Clínica"}
                figureHint={data.figureRef ? `Fig. ${data.figureRef}` : undefined}
              />
              <div className="relative border-t border-slate-800 bg-slate-950">
                {focalThumb ? (
                  <>
                    <img
                      src={focalThumb.url}
                      alt={focalThumb.title}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                      <p className="text-[10px] text-teal-200 font-semibold uppercase tracking-wider">
                        Corte 3D
                      </p>
                      <p className="text-[10px] text-white/70 truncate">{focalThumb.title}</p>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 px-4 text-center">
                    <Box className="h-7 w-7 opacity-50" />
                    <p className="text-xs">Sin corte 3D aún</p>
                    <p className="text-[10px] text-slate-600">Usa “Generar 3D de esta lesión”</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="relative min-h-[280px] lg:min-h-[340px] h-full">
              <MediaCell
                image={imageA}
                empty="Imagen clínica"
                badge={imageA?.modality || "IMG"}
                figureHint={data.figureRef ? `Fig. ${data.figureRef}` : undefined}
                fill
              />
            </div>
          )}
        </div>

        {/* Facts */}
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
        </div>
      </div>

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

const MediaCell: React.FC<{
  image: DominantLesionPickedImage | null;
  empty: string;
  badge: string;
  figureHint?: string;
  fill?: boolean;
}> = ({ image, empty, badge, figureHint, fill }) => (
  <div className={`relative bg-slate-950 ${fill ? "absolute inset-0" : "min-h-[160px] h-full"}`}>
    {image ? (
      <>
        <img
          src={image.url}
          alt={image.caption}
          className="absolute inset-0 w-full h-full object-contain"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 py-2">
          <p className="text-[10px] text-white/95 font-medium">
            {figureHint || `Fig. ${image.index + 1}`} · {badge}
          </p>
          {image.caption && (
            <p className="text-[9px] text-white/65 truncate mt-0.5">{image.caption}</p>
          )}
        </div>
      </>
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 px-3 text-center">
        <ImageIcon className="h-6 w-6 opacity-40" />
        <p className="text-[11px]">Sin {empty}</p>
      </div>
    )}
  </div>
);

export default DominantLesionCardModule;
