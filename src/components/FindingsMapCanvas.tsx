import React from "react";
import {
  getFindingsMapTemplate,
  positionedItems,
  type FindingsMapData,
} from "../lib/findingsMap";

export const FindingsMapCanvas: React.FC<{ data: FindingsMapData }> = ({ data }) => {
  const template = getFindingsMapTemplate(data.templateId);
  const pins = positionedItems(data);

  return (
    <div className="w-full rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300/90 font-mono">
            {data.title}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {data.studyRegion} · plantilla {template.label} · vista {data.viewOrientation}
          </p>
        </div>
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
          {pins.length} hallazgo{pins.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-0">
        <div className="p-4 flex items-center justify-center min-h-[320px]">
          <svg viewBox="0 0 100 120" className="w-full max-w-[340px] h-auto">
            <defs>
              <radialGradient id="fm-glow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100" height="120" fill="url(#fm-glow)" />
            <g dangerouslySetInnerHTML={{ __html: template.silhouette }} />
            {pins.map((pin) => (
              <g key={`${pin.n}-${pin.regionKey}`}>
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={pin.severity === "primary" ? 5.2 : 4.4}
                  fill={pin.severity === "primary" ? "#f59e0b" : "#0ea5e9"}
                  stroke="#0f172a"
                  strokeWidth="1.1"
                />
                <text
                  x={pin.x}
                  y={(pin.y || 0) + 1.6}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="4.2"
                  fontWeight="800"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {pin.n}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-2 max-h-[420px] overflow-y-auto">
          {pins.map((pin) => (
            <div
              key={`legend-${pin.n}`}
              className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5"
            >
              <div
                className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                  pin.severity === "primary"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-sky-500 text-slate-950"
                }`}
              >
                {pin.n}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 leading-snug">{pin.label}</p>
                {pin.detail && (
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{pin.detail}</p>
                )}
                <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase tracking-wide">
                  {pin.slotLabel}
                  {pin.side ? ` · ${pin.side}` : ""}
                  {pin.figureRef ? ` · Fig. ${pin.figureRef}` : ""}
                </p>
              </div>
            </div>
          ))}
          {!pins.length && (
            <p className="text-xs text-slate-500">Sin hallazgos mapeados aún.</p>
          )}
        </div>
      </div>
    </div>
  );
};
