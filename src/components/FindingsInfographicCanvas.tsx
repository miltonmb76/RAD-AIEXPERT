import React from "react";
import type { InfographicScene } from "../lib/findingsInfographic";
import { layoutDisplayLabel } from "../lib/findingsInfographic";

function SvgWrappedText({
  text,
  x,
  y,
  width,
  fontSize,
  fill,
  fontWeight,
  lineHeight = 1.25,
  maxLines = 4,
  anchor = "middle",
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  fontWeight?: string | number;
  lineHeight?: number;
  maxLines?: number;
  anchor?: "start" | "middle" | "end";
}) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.55)));
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, -1)}…` : last;
  }

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
      className={className || "w-full h-auto"}
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
      <circle cx="120" cy="100" r="90" fill="#14b8a6" opacity="0.07" />
      <circle cx="880" cy="560" r="120" fill="#2dd4bf" opacity="0.06" />

      <text
        x={40}
        y={42}
        fill="#99f6e4"
        fontSize={12}
        fontWeight={700}
        letterSpacing="2"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {headerLabel}
      </text>
      <text
        x={width - 40}
        y={42}
        fill="#64748b"
        fontSize={12}
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
          strokeWidth={2.2}
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
                y={b.y + 24}
                fill="#ecfeff"
                fontSize={13}
                fontWeight={700}
                letterSpacing="2"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {b.label}
              </text>
            </g>
          );
        }
        if (b.kind === "diagnosis") {
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
                y={b.y + 28}
                fill="#ccfbf1"
                fontSize={11}
                fontWeight={700}
                letterSpacing="2"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                ANCLA
              </text>
              <SvgWrappedText
                text={b.label}
                x={b.x + b.w / 2}
                y={b.y + 52}
                width={b.w - 28}
                fontSize={20}
                fill="#f0fdfa"
                fontWeight={700}
                maxLines={2}
              />
            </g>
          );
        }

        const accent = accentFor(b.polarity, b.weight);
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
            <SvgWrappedText
              text={b.label}
              x={b.x + b.w / 2}
              y={b.y + 28}
              width={b.w - 24}
              fontSize={14}
              fill="#f1f5f9"
              fontWeight={700}
              maxLines={3}
            />
            {b.detail && (
              <SvgWrappedText
                text={b.detail}
                x={b.x + b.w / 2}
                y={b.y + b.h - 28}
                width={b.w - 24}
                fontSize={11}
                fill="#94a3b8"
                maxLines={2}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default FindingsInfographicCanvas;
