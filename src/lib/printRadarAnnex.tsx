import React from "react";
import { getRadarTitle, getShortRadarAxisLabel, sanitizeRadarPdfText } from "./radarPdfHelpers";

export function renderPrintBiomechanicalRadarAnnex(data: any) {
if (!data || !data.axes || data.axes.length === 0) return null;

const numAxes = data.axes.length;
const size = 360;
const center = size / 2;
const maxR = 76;

const getPt = (index: number, score: number) => {
  const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
  const r = (score / 10) * maxR;
  return {
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
    angle
  };
};

const scales = [0.2, 0.4, 0.6, 0.8, 1.0];
const gridPolygons = scales.map(scale => {
  return data.axes.map((_: any, i: number) => {
    const pt = getPt(i, scale * 10);
    return `${pt.x},${pt.y}`;
  }).join(" ");
});

const dataPolygon = data.axes.map((a: any, i: number) => {
  const pt = getPt(i, a.score);
  return `${pt.x},${pt.y}`;
}).join(" ");

return (
  <div className="mt-8 pt-6 border-t-2 border-slate-300 print:break-before-page font-sans select-text text-left space-y-6">
    <div className="w-full text-left pb-2.5 border-b border-slate-200">
      <h3 className="text-lg font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
        <span className="text-indigo-600">🎯</span> {getRadarTitle(data)}
      </h3>
      <p className="text-xs text-slate-500 font-mono mt-0.5">
        Modelado vectorial cuantitativo e índice de carga tisular sistémico-funcional
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {/* Left Column: Spider Graphic (6 cols) */}
      <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center overflow-hidden">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[370px]">
          {/* Concentric Hexagons */}
          {gridPolygons.map((pts, idx) => (
            <polygon key={idx} points={pts} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray={idx === 4 ? "none" : "2 2"} />
          ))}
          {/* Radial Lines */}
          {data.axes.map((_: any, i: number) => {
            const end = getPt(i, 10);
            return <line key={i} x1={center} y1={center} x2={end.x} y2={end.y} stroke="#94a3b8" strokeWidth="1.2" />;
          })}
          {/* Data Polygon Fill */}
          <polygon points={dataPolygon} fill="rgba(79, 70, 229, 0.20)" stroke="#4f46e5" strokeWidth="3" />
          {/* Vertex Dots */}
          {data.axes.map((a: any, i: number) => {
            const pt = getPt(i, a.score);
            return <circle key={i} cx={pt.x} cy={pt.y} r="5.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />;
          })}
          {/* Axis Labels */}
          {data.axes.map((a: any, i: number) => {
            const lbl = getPt(i, 11.0);
            const cleanLabel = getShortRadarAxisLabel(sanitizeRadarPdfText(a.label), 18);
            let anchor = "middle";
            const cosVal = Math.cos(lbl.angle);
            const sinVal = Math.sin(lbl.angle);

            let lx = lbl.x;
            let ly = lbl.y;

            if (cosVal > 0.25) {
              anchor = "start";
              lx += 4;
            } else if (cosVal < -0.25) {
              anchor = "end";
              lx -= 4;
            }

            if (sinVal < -0.8) ly -= 4;
            else if (sinVal > 0.8) ly += 5;

            const isRightSide = cosVal > 0.25;

            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="central"
                className="text-[9.5px] font-bold fill-slate-900 font-mono"
              >
                {isRightSide ? (
                  <>
                    <tspan x={lx} dy="-0.6em">{cleanLabel}</tspan>
                    <tspan x={lx} dy="1.3em" className="fill-indigo-600 font-black">({a.score}/10)</tspan>
                  </>
                ) : (
                  `${cleanLabel} (${a.score}/10)`
                )}
              </text>
            );
          })}
        </svg>
        <p className="text-[10.5px] font-mono font-medium text-slate-400 mt-2.5 text-center uppercase tracking-wide">
          Representación vectorial en araña (Escala 0-10)
        </p>
      </div>

      {/* Right Column: Global Load Index & Vector Breakdown Matrix (6 cols) */}
      <div className="md:col-span-6 space-y-4">
        {/* Global Load Index Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-indigo-600 block">
              Puntaje Global de Carga Tisular
            </span>
            <div className="text-3xl font-mono font-black text-slate-900 mt-1">
              {data.globalScore} <span className="text-sm text-slate-400 font-normal">/ 10.0</span>
            </div>
            <span className="text-[10.5px] font-sans font-bold text-slate-600 block mt-1.5">
              Vector Dominante: <span className="text-slate-900">{data.dominantVector}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="px-3.5 py-1.5 rounded-full text-[10.5px] font-mono font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200 inline-block shadow-2xs">
              Carga: {data.globalLoadIndex || "Moderada"}
            </span>
          </div>
        </div>

        {/* 6-Axis Matrix */}
        <div className="space-y-2">
          <h4 className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-700">
            Desglose Multivectorial (6D)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.axes.map((axis: any, idx: number) => {
              let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
              if (axis.score >= 8) badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
              else if (axis.score >= 6) badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
              else if (axis.score >= 3) badgeClass = "bg-cyan-50 text-cyan-700 border-cyan-200";

              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-800 font-sans truncate" title={axis.label}>
                    {getShortRadarAxisLabel(sanitizeRadarPdfText(axis.label), 18)}
                  </span>
                  <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                    {axis.score}/10
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    {/* Vector Details & Justification Section */}
    <div className="space-y-2.5 text-left">
      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
        Detalle y Justificación de los Vectores (Hallazgos y Sobrecarga)
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {data.axes.map((axis: any, idx: number) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-1.5">
              <span className="text-[11px] font-bold text-slate-900 font-sans leading-tight min-w-0 flex-1">
                {idx + 1}. {axis.label}
              </span>
              <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                ({axis.level})
              </span>
            </div>
            {axis.finding && (
              <p className="text-[10.5px] text-slate-800 leading-relaxed font-sans">
                <strong className="text-slate-900">Hallazgo:</strong> {axis.finding}
              </p>
            )}
            {axis.justification && axis.justification !== axis.finding && (
              <p className="text-[10px] text-slate-600 italic leading-relaxed font-sans">
                <strong className="text-slate-700 not-italic">Justificación:</strong> {axis.justification}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Synthesis Box (Without recommendations) */}
    {data.clinicalSummary && (
      <div className="mt-5 bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 text-left w-full max-w-full box-border min-w-0 overflow-hidden">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5 mb-2">
          <span className="text-indigo-600">⚡</span> Síntesis Biomecánico-Inflamatoria Final
        </h4>
        <p className="text-xs text-slate-800 leading-relaxed font-sans w-full max-w-full box-border break-words whitespace-normal overflow-wrap-anywhere m-0">
          {data.clinicalSummary}
        </p>
      </div>
    )}
  </div>
);
};

