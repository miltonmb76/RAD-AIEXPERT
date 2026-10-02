import React, { useRef, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { SuiteImageAnnotation } from "../types";
import {
  buildAnnotation,
  clampPct,
  resolveAnnotationGeometry,
} from "../lib/suiteImageAnnotations";

const COLOR_STYLES: Record<
  NonNullable<SuiteImageAnnotation["color"]>,
  { pill: string; tip: string; ring: string; stroke: string }
> = {
  amber: {
    pill: "bg-amber-950/88 border-amber-400/70 text-amber-50",
    tip: "bg-amber-400 border-amber-100",
    ring: "ring-amber-300/60",
    stroke: "#fbbf24",
  },
  cyan: {
    pill: "bg-cyan-950/88 border-cyan-400/70 text-cyan-50",
    tip: "bg-cyan-400 border-cyan-100",
    ring: "ring-cyan-300/60",
    stroke: "#22d3ee",
  },
  rose: {
    pill: "bg-rose-950/88 border-rose-400/70 text-rose-50",
    tip: "bg-rose-400 border-rose-100",
    ring: "ring-rose-300/60",
    stroke: "#fb7185",
  },
  emerald: {
    pill: "bg-emerald-950/88 border-emerald-400/70 text-emerald-50",
    tip: "bg-emerald-400 border-emerald-100",
    ring: "ring-emerald-300/60",
    stroke: "#34d399",
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

type DragHandle = "tip" | "label";

/**
 * Absolute layer of callouts with a thin leader line:
 * tip on the structure + label parked aside (each independently draggable).
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
    handle: DragHandle;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const mine = annotations.filter((a) => a.panelLetter === panelLetter);

  const updateOne = (id: string, patch: Partial<SuiteImageAnnotation>) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeOne = (id: string) => {
    onChange(annotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addBlank = () => {
    const created = buildAnnotation({
      panelLetter,
      text: "Nueva anotación",
      sizeLabel: "",
      tipX: 48,
      tipY: 52,
      color: "amber",
      offsetIndex: mine.length,
    });
    onChange([...annotations, created]);
    setSelectedId(created.id);
  };

  const onPointerDown = (
    e: React.PointerEvent,
    ann: SuiteImageAnnotation,
    handle: DragHandle
  ) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const el = layerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const geo = resolveAnnotationGeometry(ann);
    const ax = handle === "tip" ? geo.tipX : geo.labelX;
    const ay = handle === "tip" ? geo.tipY : geo.labelY;
    dragRef.current = {
      id: ann.id,
      handle,
      offsetX: x - ax,
      offsetY: y - ay,
    };
    setSelectedId(ann.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !layerRef.current) return;
    const rect = layerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const nextX = clampPct(x - dragRef.current.offsetX);
    const nextY = clampPct(y - dragRef.current.offsetY);
    if (dragRef.current.handle === "tip") {
      updateOne(dragRef.current.id, { xPct: nextX, yPct: nextY });
    } else {
      updateOne(dragRef.current.id, { labelXPct: nextX, labelYPct: nextY });
    }
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
          {/* Leader lines behind interactive handles (0–100 viewBox = % of panel) */}
          <svg
            className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {mine.map((ann) => {
              const geo = resolveAnnotationGeometry(ann);
              const style = COLOR_STYLES[ann.color || "amber"];
              const selected = selectedId === ann.id;
              const dx = geo.labelX - geo.tipX;
              const dy = geo.labelY - geo.tipY;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const tipPad = 1.1;
              const labelPad = 3.0;
              const x1 = geo.tipX + ux * tipPad;
              const y1 = geo.tipY + uy * tipPad;
              const x2 = geo.labelX - ux * labelPad;
              const y2 = geo.labelY - uy * labelPad;
              const ah = arrowHeadCoords(geo.tipX, geo.tipY, ux, uy);
              return (
                <g key={`line-${ann.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={style.stroke}
                    strokeWidth={selected ? 0.55 : 0.4}
                    vectorEffect="non-scaling-stroke"
                    strokeOpacity={selected ? 0.95 : 0.82}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${ah.noseX},${ah.noseY} ${ah.leftX},${ah.leftY} ${ah.rightX},${ah.rightY}`}
                    fill={style.stroke}
                    opacity={selected ? 0.95 : 0.88}
                  />
                </g>
              );
            })}
          </svg>

          {mine.map((ann) => {
            const geo = resolveAnnotationGeometry(ann);
            const style = COLOR_STYLES[ann.color || "amber"];
            const selected = selectedId === ann.id;
            return (
              <React.Fragment key={ann.id}>
                {/* Tip handle — place on the structure */}
                <button
                  type="button"
                  className={`absolute pointer-events-auto select-none z-[6] -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border shadow ${
                    style.tip
                  } ${selected ? `ring-2 ${style.ring}` : ""} ${
                    editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  }`}
                  style={{ left: `${geo.tipX}%`, top: `${geo.tipY}%` }}
                  title={editable ? "Arrastra la punta sobre la estructura" : undefined}
                  onPointerDown={(e) => onPointerDown(e, ann, "tip")}
                  onPointerUp={onPointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(ann.id);
                  }}
                />

                {/* Label pill — park away from anatomy */}
                <div
                  className={`absolute pointer-events-auto select-none z-[6] -translate-x-1/2 -translate-y-1/2 ${
                    editable ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                  style={{ left: `${geo.labelX}%`, top: `${geo.labelY}%` }}
                  onPointerDown={(e) => onPointerDown(e, ann, "label")}
                  onPointerUp={onPointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(ann.id);
                  }}
                  title={editable ? "Arrastra el rótulo a zona libre" : undefined}
                >
                  <div
                    className={`max-w-[148px] rounded-md border px-1.5 py-0.5 shadow-lg backdrop-blur-sm ${
                      style.pill
                    } ${selected ? `ring-2 ${style.ring}` : ""}`}
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
              </React.Fragment>
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
                  <p className="text-[8px] text-slate-400 leading-snug">
                    Arrastra la <span className="font-semibold text-slate-500">punta</span> sobre la
                    estructura y el <span className="font-semibold text-slate-500">rótulo</span> a
                    zona libre. La línea se actualiza sola.
                  </p>
                </div>
              ))}
          {!selectedId && mine.length > 0 && (
            <p className="text-[9px] text-slate-400">
              Pulsa la punta o el rótulo para editarlos; cada uno se arrastra por separado.
            </p>
          )}
        </div>
      )}
    </>
  );
};

/** Tiny arrowhead in viewBox % coords; nose at tip, base back toward the label. */
function arrowHeadCoords(tipX: number, tipY: number, ux: number, uy: number) {
  const len = 2.0;
  const half = 0.95;
  const baseX = tipX + ux * len;
  const baseY = tipY + uy * len;
  const px = -uy;
  const py = ux;
  return {
    noseX: tipX,
    noseY: tipY,
    leftX: baseX + px * half,
    leftY: baseY + py * half,
    rightX: baseX - px * half,
    rightY: baseY - py * half,
  };
}
