import React, { useRef, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { SuiteImageAnnotation } from "../types";
import { newAnnotationId } from "../lib/suiteImageAnnotations";

const COLOR_STYLES: Record<
  NonNullable<SuiteImageAnnotation["color"]>,
  { pill: string; dot: string; ring: string }
> = {
  amber: {
    pill: "bg-amber-950/85 border-amber-400/70 text-amber-50",
    dot: "bg-amber-400",
    ring: "ring-amber-300/50",
  },
  cyan: {
    pill: "bg-cyan-950/85 border-cyan-400/70 text-cyan-50",
    dot: "bg-cyan-400",
    ring: "ring-cyan-300/50",
  },
  rose: {
    pill: "bg-rose-950/85 border-rose-400/70 text-rose-50",
    dot: "bg-rose-400",
    ring: "ring-rose-300/50",
  },
  emerald: {
    pill: "bg-emerald-950/85 border-emerald-400/70 text-emerald-50",
    dot: "bg-emerald-400",
    ring: "ring-emerald-300/50",
  },
};

interface Props {
  panelLetter: string;
  annotations: SuiteImageAnnotation[];
  onChange: (next: SuiteImageAnnotation[]) => void;
  /** `layer` = absolute callouts on image; `toolbar` = editors under image */
  mode?: "layer" | "toolbar" | "both";
  editable?: boolean;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
}

/**
 * Absolute layer of draggable callouts over a 3D panel image.
 * Layer mode requires a `position: relative` parent.
 */
export const SuiteImageAnnotationLayer: React.FC<Props> = ({
  panelLetter,
  annotations,
  onChange,
  mode = "both",
  editable = true,
  selectedId: controlledSelectedId,
  onSelectId,
}) => {
  const showLayer = mode === "layer" || mode === "both";
  const showToolbar = mode === "toolbar" || mode === "both";
  const layerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledSelectedId;
  const setSelectedId = (id: string | null) => {
    onSelectId?.(id);
    if (controlledSelectedId === undefined) setUncontrolledSelectedId(id);
  };
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const mine = annotations.filter((a) => a.panelLetter === panelLetter);

  const updateOne = (id: string, patch: Partial<SuiteImageAnnotation>) => {
    onChange(
      annotations.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  };

  const removeOne = (id: string) => {
    onChange(annotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addBlank = () => {
    const created: SuiteImageAnnotation = {
      id: newAnnotationId(),
      panelLetter,
      text: "Nueva anotación",
      sizeLabel: "",
      xPct: 50,
      yPct: 45,
      color: "amber",
    };
    onChange([...annotations, created]);
    setSelectedId(created.id);
  };

  const onPointerDown = (e: React.PointerEvent, ann: SuiteImageAnnotation) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const el = layerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    dragRef.current = {
      id: ann.id,
      offsetX: x - ann.xPct,
      offsetY: y - ann.yPct,
    };
    setSelectedId(ann.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !layerRef.current) return;
    const rect = layerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const nextX = Math.min(92, Math.max(8, x - dragRef.current.offsetX));
    const nextY = Math.min(92, Math.max(8, y - dragRef.current.offsetY));
    updateOne(dragRef.current.id, { xPct: nextX, yPct: nextY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  };

  return (
    <>
      {showLayer && (
        <div
          ref={layerRef}
          className="absolute inset-0 z-[5] pointer-events-none"
          onPointerMove={onPointerMove}
        >
          {mine.map((ann) => {
            const style = COLOR_STYLES[ann.color || "amber"];
            const selected = selectedId === ann.id;
            return (
              <div
                key={ann.id}
                className={`absolute pointer-events-auto select-none ${
                  editable ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={{
                  left: `${ann.xPct}%`,
                  top: `${ann.yPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={(e) => onPointerDown(e, ann)}
                onPointerUp={onPointerUp}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(ann.id);
                }}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={`w-2 h-2 rounded-full shadow ${style.dot} ${
                      selected ? `ring-2 ${style.ring}` : ""
                    }`}
                  />
                  <div
                    className={`max-w-[140px] rounded-md border px-1.5 py-0.5 shadow-lg backdrop-blur-sm ${style.pill}`}
                  >
                    <p className="text-[9px] font-bold leading-tight break-words">
                      {ann.text || "—"}
                    </p>
                    {ann.sizeLabel ? (
                      <p className="text-[8px] font-semibold opacity-90 leading-tight mt-0.5">
                        {ann.sizeLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showToolbar && editable && (
        <div className="mt-2 space-y-1.5 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-600" />
              Anotaciones ({mine.length})
            </p>
            <button
              type="button"
              onClick={addBlank}
              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5"
            >
              <Plus className="w-3 h-3" />
              Añadir
            </button>
          </div>
          {selectedId &&
            mine
              .filter((a) => a.id === selectedId)
              .map((ann) => (
                <div
                  key={ann.id}
                  className="rounded border border-slate-200 bg-slate-50 p-2 space-y-1.5"
                >
                  <input
                    type="text"
                    value={ann.text}
                    onChange={(e) => updateOne(ann.id, { text: e.target.value })}
                    placeholder="Nombre / estructura"
                    className="w-full text-[11px] border border-slate-300 rounded px-1.5 py-1 text-slate-800"
                  />
                  <input
                    type="text"
                    value={ann.sizeLabel || ""}
                    onChange={(e) => updateOne(ann.id, { sizeLabel: e.target.value })}
                    placeholder="Tamaño (ej. 12 mm)"
                    className="w-full text-[11px] border border-slate-300 rounded px-1.5 py-1 text-slate-800"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={ann.color || "amber"}
                      onChange={(e) =>
                        updateOne(ann.id, {
                          color: e.target.value as SuiteImageAnnotation["color"],
                        })
                      }
                      className="text-[10px] border border-slate-300 rounded px-1 py-0.5"
                    >
                      <option value="amber">Ámbar</option>
                      <option value="cyan">Cian</option>
                      <option value="rose">Rosa</option>
                      <option value="emerald">Esmeralda</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeOne(ann.id)}
                      className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 hover:text-rose-900"
                    >
                      <Trash2 className="w-3 h-3" />
                      Borrar
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-400">
                    Arrastra la etiqueta sobre la imagen para reposicionarla.
                  </p>
                </div>
              ))}
          {!selectedId && mine.length > 0 && (
            <p className="text-[9px] text-slate-400">
              Pulsa una etiqueta para editarla o arrástrala.
            </p>
          )}
        </div>
      )}
    </>
  );
};
