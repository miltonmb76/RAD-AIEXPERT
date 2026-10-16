import React, { useMemo, useState } from "react";
import {
  Layers,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Box,
} from "lucide-react";
import {
  FINDING_EXPLAINER_MAX_CARDS,
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
  const [extraFindings, setExtraFindings] = useState("");
  const [maxCards, setMaxCards] = useState(2);

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

  const handleGenerate = async () => {
    if (!reportText?.trim()) {
      setError("Necesitas un informe para generar el explainer.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const hints = [
        diagnosisAnchor?.trim() ? `Ancla diagnostica: ${diagnosisAnchor.trim()}` : "",
        extraFindings.trim()
          ? `Hallazgos a priorizar (separados por ; o salto de linea):\n${extraFindings.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await fetch("/api/generate-finding-explainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          organOrStudy: studyType || "",
          laterality: laterality && laterality !== "auto" ? laterality : undefined,
          requestedModel: selectedModel,
          maxFindings: maxCards,
          findingHints: hints || undefined,
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
      setExplainerData(normalizeFindingExplainerData(json.data, { maxCards }));
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
              Hasta {FINDING_EXPLAINER_MAX_CARDS} hallazgos apilados: eco + CGI 3D + 3 bullets
              (que es / donde / que implica — explicación del hallazgo, sin manejo). Se generan
              en paralelo.
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-widest text-amber-200/80 font-semibold">
            Hallazgos a priorizar (opcional)
          </label>
          <textarea
            value={extraFindings}
            onChange={(e) => setExtraFindings(e.target.value)}
            rows={2}
            placeholder={"Ej.\nHemangioma hepatico\nPolipo vesicular"}
            className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-[12px] text-slate-200 outline-none resize-none"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-[160px]">
          <label className="text-[10px] uppercase tracking-widest text-amber-200/80 font-semibold">
            Max. fichas
          </label>
          <select
            value={maxCards}
            onChange={(e) => setMaxCards(Number(e.target.value))}
            className="bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
          >
            <option value={1}>1 hallazgo</option>
            <option value={2}>2 hallazgos</option>
            <option value={3}>3 hallazgos</option>
          </select>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold text-sm px-4 py-2.5"
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
              </>
            )}
          </button>
        </div>
      </div>

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
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700 mb-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Eco real
                    </p>
                    <div className="rounded-lg border border-stone-200 bg-black aspect-[4/3] overflow-hidden flex items-center justify-center">
                      {card.ecoImageUrl ? (
                        <img
                          src={card.ecoImageUrl}
                          alt="Eco"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] text-stone-500 px-3 text-center">
                          Sin captura emparejada
                        </span>
                      )}
                    </div>
                    {card.ecoCaption && (
                      <figcaption className="text-[10px] text-stone-500 italic pt-1.5 truncate">
                        {card.ecoCaption}
                      </figcaption>
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
                    {card.cgiCaption && (
                      <figcaption className="text-[10px] text-stone-500 italic pt-1.5 truncate">
                        {card.cgiCaption}
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
            Genera 1–3 fichas apiladas (eco + CGI + bullets) a partir del informe.
          </p>
        </div>
      )}
    </div>
  );
};
