import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  fetchSuggestedLabel,
  type AttachedImageForLabeling,
  type LabelQueueItem,
  type LabelQueueStatus,
} from "../lib/labelingQueue";

export interface LabelingQueuePanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: number;
  reportText: string;
  studyType: string;
  clinicalHistory: string;
  selectedModel: string;
  attachedImages: AttachedImageForLabeling[];
  onUpdateImageCaption: (id: string, caption: string) => void;
  onStatsChange?: (confirmed: number, total: number) => void;
}

const statusLabel: Record<LabelQueueStatus, string> = {
  waiting: "En espera",
  analyzing: "Analizando...",
  suggested: "Pendiente de confirmar",
  reorienting: "Reorientando...",
  confirmed: "Confirmada",
  skipped: "Omitida",
  error: "Error",
};

export const LabelingQueuePanel: React.FC<LabelingQueuePanelProps> = ({
  isOpen,
  onOpenChange,
  trigger,
  reportText,
  studyType,
  clinicalHistory,
  selectedModel,
  attachedImages,
  onUpdateImageCaption,
  onStatsChange,
}) => {
  const [items, setItems] = useState<LabelQueueItem[]>([]);
  const [expanded, setExpanded] = useState(true);
  const processingRef = useRef(false);
  const confirmedIdsRef = useRef<Set<string>>(new Set());

  const buildQueueItems = useCallback((): LabelQueueItem[] => {
    return attachedImages
      .filter((img) => img.url || img.base64)
      .filter((img) => !confirmedIdsRef.current.has(img.id))
      .map((img) => ({
        imageId: img.id,
        name: img.name || img.id,
        previewUrl: img.url,
        status: "waiting" as const,
        suggestedLabel: "",
        editedLabel: "",
        keyword: "",
      }));
  }, [attachedImages]);

  const updateItem = useCallback((imageId: string, patch: Partial<LabelQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.imageId === imageId ? { ...item, ...patch } : item)));
  }, []);

  const analyzeItem = useCallback(
    async (imageId: string, keyword?: string) => {
      const image = attachedImages.find((img) => img.id === imageId);
      if (!image || !reportText.trim()) return;

      updateItem(imageId, {
        status: keyword ? "reorienting" : "analyzing",
        error: undefined,
      });

      try {
        const label = await fetchSuggestedLabel({
          image,
          reportText,
          studyType,
          clinicalHistory,
          keyword,
          model: selectedModel,
        });
        updateItem(imageId, {
          status: "suggested",
          suggestedLabel: label,
          editedLabel: label,
          keyword: keyword || "",
        });
      } catch (err) {
        updateItem(imageId, {
          status: "error",
          error: err instanceof Error ? err.message : "Error al analizar la imagen",
        });
      }
    },
    [attachedImages, reportText, studyType, clinicalHistory, selectedModel, updateItem]
  );

  useEffect(() => {
    if (trigger <= 0 || !reportText.trim()) return;

    confirmedIdsRef.current = new Set(
      attachedImages.filter((img) => img.caption?.trim()).map((img) => img.id)
    );

    const nextItems = buildQueueItems();
    setItems(nextItems);
    onOpenChange(true);
    setExpanded(true);

    if (nextItems.length === 0) {
      const total = attachedImages.filter((img) => img.url || img.base64).length;
      onStatsChange?.(confirmedIdsRef.current.size, total);
      return;
    }

    void (async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      for (const item of nextItems) {
        await analyzeItem(item.imageId);
      }
      processingRef.current = false;
    })();
  }, [trigger, reportText, attachedImages, buildQueueItems, onOpenChange, onStatsChange, analyzeItem]);

  useEffect(() => {
    const total = attachedImages.filter((img) => img.url || img.base64).length;
    const confirmed = items.filter((item) => item.status === "confirmed").length + 
      attachedImages.filter((img) => img.caption?.trim() && !items.some(i => i.imageId === img.id)).length;
    onStatsChange?.(Math.min(confirmed, total), total);
  }, [items, attachedImages, onStatsChange]);

  const confirmItem = (item: LabelQueueItem) => {
    const finalLabel = item.editedLabel.trim() || item.suggestedLabel.trim();
    if (!finalLabel) return;
    onUpdateImageCaption(item.imageId, finalLabel);
    confirmedIdsRef.current.add(item.imageId);
    updateItem(item.imageId, { status: "confirmed", editedLabel: finalLabel, suggestedLabel: finalLabel });
    const confirmed = confirmedIdsRef.current.size;
    const total = attachedImages.filter((img) => img.url || img.base64).length;
    onStatsChange?.(confirmed, total);
  };

  const confirmAllSuggested = () => {
    items
      .filter((item) => item.status === "suggested" && (item.editedLabel.trim() || item.suggestedLabel.trim()))
      .forEach((item) => confirmItem(item));
  };

  const skipItem = (imageId: string) => {
    updateItem(imageId, { status: "skipped" });
  };

  const stats = useMemo(() => {
    const total = items.length;
    const confirmed = items.filter((item) => item.status === "confirmed").length;
    const pending = items.filter((item) => item.status === "suggested").length;
    const working = items.filter((item) => item.status === "analyzing" || item.status === "reorienting").length;
    return { total, confirmed, pending, working };
  }, [items]);

  if (!reportText.trim()) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[115] w-[min(100vw-2rem,26rem)] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-violet-500/30 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-violet-950/40 overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className="w-full px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 hover:bg-slate-900/50 transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 font-mono truncate">
              Cola de rotulado
            </span>
            {stats.working > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              {stats.confirmed}/{stats.total || attachedImages.length}
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
          </div>
        </button>

        {isOpen && expanded && (
          <>
            <div className="px-3.5 py-2 border-b border-slate-800/60 text-[10px] text-slate-400 leading-snug">
              Rotulacion sugerida desde el reporte generado. Confirma o reorienta con palabra clave antes del PDF.
            </div>

            <div className="max-h-[min(50vh,22rem)] overflow-y-auto px-3.5 py-2.5 space-y-3">
              {items.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-4">
                  No hay imagenes adjuntas para rotular.
                </p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.imageId}
                    className={`rounded-xl border p-2.5 space-y-2 ${
                      item.status === "confirmed"
                        ? "border-emerald-500/25 bg-emerald-950/20"
                        : item.status === "error"
                          ? "border-rose-500/25 bg-rose-950/15"
                          : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex gap-2">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-800 bg-black shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-slate-300 truncate">{item.name}</p>
                        <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300/80 mt-0.5">
                          {statusLabel[item.status]}
                        </p>
                        {item.error && <p className="text-[9px] text-rose-300 mt-1">{item.error}</p>}
                      </div>
                    </div>

                    {(item.status === "suggested" || item.status === "confirmed" || item.status === "error") && (
                      <>
                        <textarea
                          value={item.editedLabel}
                          onChange={(e) => updateItem(item.imageId, { editedLabel: e.target.value })}
                          disabled={item.status === "confirmed"}
                          rows={2}
                          placeholder="Rotulo clinico..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-[11px] text-slate-200 resize-none focus:outline-none focus:border-violet-500/40 disabled:opacity-60"
                        />

                        {item.status !== "confirmed" && (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={item.keyword}
                              onChange={(e) => updateItem(item.imageId, { keyword: e.target.value })}
                              placeholder="Palabra clave (ej. vesicula, quiste)"
                              className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-violet-500/40"
                            />
                            <button
                              type="button"
                              onClick={() => void analyzeItem(item.imageId, item.keyword)}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-950/40 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-200 hover:bg-violet-900/40 transition cursor-pointer shrink-0"
                              title="Reorientar con palabra clave"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Reorientar
                            </button>
                          </div>
                        )}

                        {item.status !== "confirmed" && (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => confirmItem(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/40 transition cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => skipItem(item.imageId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-800 transition cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                              Omitir
                            </button>
                            {item.status === "error" && (
                              <button
                                type="button"
                                onClick={() => void analyzeItem(item.imageId)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Sparkles className="h-3 w-3" />
                                Reintentar
                              </button>
                            )}
                          </div>
                        )}

                        {item.status === "confirmed" && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Lista para el PDF
                          </div>
                        )}
                      </>
                    )}

                    {(item.status === "analyzing" || item.status === "reorienting" || item.status === "waiting") && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                        {item.status === "waiting" ? "En cola..." : "Analizando con IA..."}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {stats.pending > 1 && (
              <div className="px-3.5 py-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={confirmAllSuggested}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/30 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar todas ({stats.pending})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LabelingQueuePanel;
