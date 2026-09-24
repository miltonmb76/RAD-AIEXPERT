import React from "react";
import type { InfographicScene } from "../lib/findingsInfographic";
import {
  anchorBoxMetrics,
  findingBoxMetrics,
  layoutDisplayLabel,
} from "../lib/findingsInfographic";

function SvgLines({
  lines,
  x,
  y,
  fontSize,
  fill,
  fontWeight,
  lineHeight = 1.28,
  anchor = "middle",
}: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight?: string | number;
  lineHeight?: number;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor={anchor}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize * lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function accentFor(polarity?: string, weight?: string): string {
  if (polarity === "ruled_out") return "#fb7185";
  if (polarity === "criterion") return "#a78bfa";
  if (weight === "primary") return "#2dd4bf";
  return "#334155";
}

function barFor(polarity?: string): string {
  if (polarity === "ruled_out") return "#e11d48";
  if (polarity === "criterion") return "#8b5cf6";
  return "#14b8a6";
}

interface FindingsInfographicCanvasProps {
  scene: InfographicScene;
  className?: string;
}

export const FindingsInfographicCanvas: React.FC<FindingsInfographicCanvasProps> = ({
  scene,
  className,
}) => {
  const { width, height, boxes, edges, headerLabel, studyRegion, layout } = scene;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className || "w-full h-auto block"}
      role="img"
      aria-label={headerLabel}
    >
      <defs>
        <linearGradient id="fig-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="55%" stopColor="#134e4a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="fig-diag" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="fig-find" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <filter id="fig-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <marker
          id="fig-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#5eead4" />
        </marker>
      </defs>

      <rect width={width} height={height} fill="url(#fig-bg)" rx="18" />
      <circle cx="140" cy="120" r="110" fill="#14b8a6" opacity="0.07" />
      <circle cx={width - 140} cy={height - 140} r="140" fill="#2dd4bf" opacity="0.06" />

      <text
        x={48}
        y={48}
        fill="#99f6e4"
        fontSize={14}
        fontWeight={700}
        letterSpacing="2"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {headerLabel}
      </text>
      <text
        x={width - 48}
        y={48}
        fill="#64748b"
        fontSize={13}
        textAnchor="end"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {layoutDisplayLabel(layout)}
        {studyRegion ? `  ·  ${studyRegion}` : ""}
      </text>

      {edges.map((e, i) => (
        <path
          key={`e-${i}`}
          d={`M ${e.x1} ${e.y1} Q ${e.cx} ${e.cy} ${e.x2} ${e.y2}`}
          fill="none"
          stroke="#5eead4"
          strokeWidth={2.4}
          opacity={0.75}
          markerEnd="url(#fig-arrow)"
        />
      ))}

      {boxes.map((b) => {
        if (b.kind === "section") {
          const fill = b.polarity === "ruled_out" ? "#881337" : "#115e59";
          return (
            <g key={b.id}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={fill} opacity={0.9} />
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 5}
                fill="#ecfeff"
                fontSize={13}
                fontWeight={700}
                letterSpacing="1.5"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {b.label}
              </text>
            </g>
          );
        }
        if (b.kind === "diagnosis") {
          const am = anchorBoxMetrics(b.label, b.w);
          const textY = b.y + am.headerH + am.font * 0.85;
          return (
            <g key={b.id} filter="url(#fig-shadow)">
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={16}
                fill="url(#fig-diag)"
                stroke="#5eead4"
                strokeWidth={1.5}
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + 24}
                fill="#ccfbf1"
                fontSize={12}
                fontWeight={700}
                letterSpacing="2"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                ANCLA
              </text>
              <SvgLines
                lines={am.lines}
                x={b.x + b.w / 2}
                y={textY}
                fontSize={am.font}
                fill="#f0fdfa"
                fontWeight={700}
                lineHeight={am.lh}
              />
            </g>
          );
        }

        const metrics = findingBoxMetrics(b.label, b.detail, b.w);
        const accent = accentFor(b.polarity, b.weight);
        const labelY = b.y + metrics.padTop + metrics.labelFont * 0.85;
        const detailY =
          labelY +
          Math.max(0, metrics.labelLines.length - 1) * metrics.labelFont * metrics.labelLh +
          (metrics.detailLines.length ? metrics.gap + metrics.detailFont * 0.85 : 0);

        return (
          <g key={b.id} filter="url(#fig-shadow)">
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={12}
              fill="url(#fig-find)"
              stroke={accent}
              strokeWidth={b.weight === "primary" ? 2 : 1.2}
            />
            <rect x={b.x} y={b.y} width={5} height={b.h} rx={2} fill={barFor(b.polarity)} />
            <SvgLines
              lines={metrics.labelLines}
              x={b.x + b.w / 2}
              y={labelY}
              fontSize={metrics.labelFont}
              fill="#f1f5f9"
              fontWeight={700}
              lineHeight={metrics.labelLh}
            />
            {metrics.detailLines.length > 0 && (
              <SvgLines
                lines={metrics.detailLines}
                x={b.x + b.w / 2}
                y={detailY}
                fontSize={metrics.detailFont}
                fill="#94a3b8"
                fontWeight={400}
                lineHeight={metrics.detailLh}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default FindingsInfographicCanvas;
