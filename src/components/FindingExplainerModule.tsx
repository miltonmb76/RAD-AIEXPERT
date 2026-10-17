import React, { useMemo, useState } from "react";
import {
  Layers,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Box,
  X,
} from "lucide-react";
import {
  FINDING_EXPLAINER_MAX_CARDS,
  assignEcoToExplainerCard,
  buildFindingExplainerSlotHints,
  emptyFindingExplainerSlots,
  findingExplainerIsRenderable,
  normalizeFindingExplainerData,
  type FindingExplainerData,
} from "../lib/findingExplainer";

type GalleryImage = {
  id?: string;
  url?: string;
  preview?: string;
  caption?: string;
  name?: string;
  label?: string;
};

interface Props {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  laterality?: string;
  diagnosisAnchor?: string;
  explainerData: FindingExplainerData | null;
  setExplainerData: (data: FindingExplainerData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (v: boolean) => void;
  attachedImages?: GalleryImage[];
}

export const FindingExplainerModule: React.FC<Props> = ({
  selectedModel,
  reportText,
  studyType,
  laterality,
  diagnosisAnchor,
  explainerData,
  setExplainerData,
  includeInReport,
  setIncludeInReport,
  attachedImages = [],
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findingSlots, setFindingSlots] = useState<string[]>(() =>
    emptyFindingExplainerSlots()
  );
  /** Card id whose eco gallery picker is open */
  const [pickingEcoFor, setPickingEcoFor] = useState<string | null>(null);

  const filledSlotCount = useMemo(
    () => findingSlots.filter((s) => String(s || "").trim()).length,
    [findingSlots]
  );

  const gallery = useMemo(
    () =>
      (attachedImages || [])
        .filter((g) => g?.url)
        .map((g, i) => ({
          id: g.id || `gal-${i}`,
          url: g.url!,
          caption: g.caption || g.name || g.label || "",
          label: g.label || g.name || "",
        })),
    [attachedImages]
  );

  const setSlot = (index: number, value: string) => {
    setFindingSlots((prev) => {
      const next = [...prev];
      while (next.length < FINDING_EXPLAINER_MAX_CARDS) next.push("");
      next[index] = value;
      return next.slice(0, FINDING_EXPLAINER_MAX_CARDS);
    });
  };

  const assignEco = (
    cardId: string,
    img: { id: string; url: string; caption: string; label: string } | null
  ) => {
    if (!explainerData) return;
    setExplainerData(
      assignEcoToExplainerCard(
        explainerData,
        cardId,
        img
          ? {
              id: img.id,
              url: img.url,
              caption: img.caption || img.label,
              label: img.label,
            }
          : null
      )
    );
    setPickingEcoFor(null);
  };

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setError("Necesitas un informe para generar el explainer.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { findingHints, maxFindings } = buildFindingExplainerSlotHints(
        findingSlots,
        { diagnosisAnchor }
      );

      const response = await fetch("/api/generate-finding-explainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          organOrStudy: studyType || "",
          laterality: laterality && laterality !== "auto" ? laterality : undefined,
          requestedModel: selectedModel,
          maxFindings,
          findingHints: findingHints || undefined,
          galleryImages: gallery.map((g) => ({
            id: g.id,
            url: g.url,
            caption: g.caption,
            label: g.label,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || "No se pudo generar el explainer.");
      }
      setExplainerData(
        normalizeFindingExplainerData(json.data, { maxCards: maxFindings })
      );
      setIncludeInReport(true);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  const cards = explainerData?.cards || [];
  const canInclude = findingExplainerIsRenderable(explainerData);

  return (
    <div
      id="finding-explainer-module"
      className="bg-slate-900/95 border-2 border-amber-500/30 rounded-3xl p-5 md:p-7 shadow-2xl space-y-5 text-slate-100 animate-fadeIn"
    >
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-2xl text-amber-300 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-amber-50 tracking-tight">
              Explainer de hallazgos
            </h3>
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
              Hasta {FINDING_EXPLAINER_MAX_CARDS} hallazgos (2 por página en el PDF): eco + CGI
              3D + 3 bullets (qué es / dónde / qué implica — sin manejo). Anota cada hallazgo en
              su casilla.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={includeInReport && canInclude}
            disabled={!canInclude}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="rounded border-slate-600"
          />
          Incluir en PDF
        </label>
      </header>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <label className="block text-[10px] uppercase tracking-widest text-amber-200/80 font-semibold">
            Hallazgos a representar
          </label>
          <span className="text-[10px] text-slate-500 font-mono">
            {filledSlotCount
              ? `${filledSlotCount} de ${FINDING_EXPLAINER_MAX_CARDS} rellenos · PDF: 2/página`
              : `Vacío → elige los más relevantes (máx. ${FINDING_EXPLAINER_MAX_CARDS})`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: FINDING_EXPLAINER_MAX_CARDS }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <label
                htmlFor={`explainer-slot-${i + 1}`}
                className="text-[10px] font-bold uppercase tracking-wider text-amber-100/90"
              >
                Hallazgo {i + 1}
              </label>
              <input
                id={`explainer-slot-${i + 1}`}
                type="text"
                value={findingSlots[i] || ""}
                onChange={(e) => setSlot(i, e.target.value)}
                placeholder={
                  i === 0
                    ? 'Ej. "Ruptura parcial supraespinoso"'
                    : i === 1
                      ? 'Ej. "Tendinosis bicipital"'
                      : "Opcional — deja vacío si no aplica"
                }
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-[12px] text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isLoading || filledSlotCount === 0}
            onClick={() => setFindingSlots(emptyFindingExplainerSlots())}
            className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40 px-2 py-1"
          >
            Limpiar casillas
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold text-sm px-4 py-2.5 min-w-[180px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar explainer
                {filledSlotCount > 0 ? ` (${filledSlotCount})` : ""}
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        {gallery.length > 0 ? (
          <>
            {gallery.length} captura{gallery.length === 1 ? "" : "s"} en galería.
            Tras generar, elige la eco de cada ficha con{" "}
            <span className="text-amber-200/90">Elegir eco</span>.
          </>
        ) : (
          <>Sube capturas a la galería del estudio para poder elegir la eco de cada ficha.</>
        )}
      </p>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-6 text-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-300 mx-auto" />
          <p className="text-[12px] text-amber-100/90">
            Planificando hallazgos y renderizando CGI en paralelo…
          </p>
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-5">
          {cards.map((card, idx) => (
            <article
              key={card.id}
              className="rounded-2xl overflow-hidden border border-stone-600/40 bg-[#fafaf9] text-stone-900 shadow-inner"
            >
              <div className="mx-4 mt-4 rounded-lg bg-stone-900 px-4 py-2.5 flex justify-between gap-3 items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-50">
                  {idx + 1}. {card.label}
                </span>
                {card.site && (
                  <span className="text-[10px] text-amber-200/90 text-right line-clamp-2">
                    {card.site}
                  </span>
                )}
              </div>
              <div className="mx-4 h-1 bg-amber-500 rounded-b" />
              <div className="p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <figure className="m-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700 flex items-center gap-1 m-0">
                        <ImageIcon className="w-3 h-3" /> Eco real
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setPickingEcoFor(
                            pickingEcoFor === card.id ? null : card.id
                          )
                        }
                        disabled={gallery.length === 0}
                        className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 disabled:text-stone-400 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                      >
                        {pickingEcoFor === card.id
                          ? "Cerrar"
                          : card.ecoImageUrl
                            ? "Cambiar eco"
                            : "Elegir eco"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-black aspect-[4/3] overflow-hidden flex items-center justify-center">
                      {card.ecoImageUrl ? (
                        <img
                          src={card.ecoImageUrl}
                          alt="Eco"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] text-stone-500 px-3 text-center">
                          {gallery.length
                            ? "Elige una captura de la galería"
                            : "Sin capturas en galería"}
                        </span>
                      )}
                    </div>
                    {card.ecoCaption && (
                      <figcaption className="text-[10px] text-stone-500 italic pt-1.5 leading-snug">
                        {card.ecoCaption}
                      </figcaption>
                    )}
                    {pickingEcoFor === card.id && (
                      <div className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50/80 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-amber-900 m-0">
                            Galería del estudio
                          </p>
                          {card.ecoImageUrl && (
                            <button
                              type="button"
                              onClick={() => assignEco(card.id, null)}
                              className="inline-flex items-center gap-1 text-[10px] text-stone-600 hover:text-rose-700"
                            >
                              <X className="w-3 h-3" />
                              Quitar
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {gallery.map((img) => {
                            const selected =
                              card.ecoImageId === img.id ||
                              card.ecoImageUrl === img.url;
                            return (
                              <button
                                key={img.id}
                                type="button"
                                title={img.caption || img.label || "Captura"}
                                onClick={() => assignEco(card.id, img)}
                                className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                                  selected
                                    ? "border-amber-500 ring-2 ring-amber-300"
                                    : "border-stone-300 hover:border-amber-400"
                                }`}
                              >
                                <img
                                  src={img.url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </figure>
                  <figure className="m-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700 mb-1.5 flex items-center gap-1">
                      <Box className="w-3 h-3" /> CGI 3D
                    </p>
                    <div className="rounded-lg border border-stone-200 bg-black aspect-[4/3] overflow-hidden flex items-center justify-center">
                      {card.cgiImageUrl ? (
                        <img
                          src={card.cgiImageUrl}
                          alt="CGI"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] text-stone-500 px-3 text-center">
                          CGI no disponible
                        </span>
                      )}
                    </div>
                    {(card.cgiCaption || card.label) && (
                      <figcaption className="text-[10px] text-stone-500 italic pt-1.5 leading-snug">
                        {card.cgiCaption || card.label}
                      </figcaption>
                    )}
                  </figure>
                </div>
                <dl className="space-y-2.5">
                  {[
                    { k: "Que es", v: card.whatIs },
                    { k: "Donde", v: card.whereIs },
                    { k: "Que implica (explicacion)", v: card.implies },
                  ]
                    .filter((b) => b.v)
                    .map((b) => (
                      <div key={b.k}>
                        <dt className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                          {b.k}
                        </dt>
                        <dd className="text-[13px] text-stone-700 leading-snug mt-0.5">
                          {b.v}
                        </dd>
                      </div>
                    ))}
                </dl>
                <label className="inline-flex items-center gap-2 text-[11px] text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={card.includeInReport !== false}
                    onChange={(e) => {
                      if (!explainerData) return;
                      const next = {
                        ...explainerData,
                        cards: explainerData.cards.map((c) =>
                          c.id === card.id
                            ? { ...c, includeInReport: e.target.checked }
                            : c
                        ),
                      };
                      setExplainerData(next);
                    }}
                    className="rounded border-stone-400"
                  />
                  Incluir esta ficha en el PDF
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      {!cards.length && !isLoading && (
        <div className="rounded-xl border border-dashed border-amber-800/40 bg-slate-950/40 px-6 py-10 text-center">
          <Layers className="w-8 h-8 mx-auto mb-3 text-amber-500/80" />
          <p className="text-sm text-slate-300">
            Anota hasta {FINDING_EXPLAINER_MAX_CARDS} hallazgos (casillas 1–4) y genera las
            fichas. En el PDF van 2 por página.
          </p>
        </div>
      )}
    </div>
  );
};
