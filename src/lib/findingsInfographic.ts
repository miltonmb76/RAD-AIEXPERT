import type {
  FindingsInfographicData,
  FindingsInfographicLayout,
  FindingsInfographicNode,
} from "../types";

export const INFOGRAPHIC_DIAGNOSIS_PRESETS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (del informe)" },
  { id: "colecistitis", label: "Colecistitis aguda" },
  { id: "apendicitis", label: "Apendicitis aguda" },
  { id: "pielonefritis", label: "Pielonefritis" },
  { id: "tvp", label: "Trombosis venosa profunda" },
  { id: "tendinopatia", label: "Tendinopatía / rotura" },
  { id: "hernia", label: "Hernia de pared" },
  { id: "custom", label: "Otro (escribir abajo)" },
];

export const INFOGRAPHIC_LAYOUT_OPTIONS: {
  id: FindingsInfographicLayout | "auto";
  label: string;
  desc: string;
}[] = [
  {
    id: "convergence",
    label: "Convergencia",
    desc: "Hallazgos → diagnóstico (mejor estética, menos correcciones)",
  },
  {
    id: "constellation",
    label: "Constelación",
    desc: "Diagnóstico al centro, hallazgos en órbita",
  },
  {
    id: "cascade",
    label: "Cascada",
    desc: "Flujo vertical de signos hacia el diagnóstico",
  },
  { id: "auto", label: "Auto", desc: "Elige el layout según el número de hallazgos" },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyInfographicNode(): FindingsInfographicNode {
  return {
    id: newId("fig-node"),
    label: "",
    detail: "",
    weight: "secondary",
  };
}

export function resolveInfographicDiagnosis(
  presetId: string,
  customText: string
): string {
  if (presetId === "custom" || presetId === "auto") {
    return customText.trim() || (presetId === "auto" ? "Diagnóstico del informe" : "");
  }
  const hit = INFOGRAPHIC_DIAGNOSIS_PRESETS.find((p) => p.id === presetId);
  return customText.trim() || hit?.label || presetId;
}

export function pickLayout(
  requested: FindingsInfographicLayout | "auto" | string,
  nodeCount: number
): FindingsInfographicLayout {
  if (requested === "convergence" || requested === "constellation" || requested === "cascade") {
    return requested;
  }
  // Auto: convergence is the default aesthetic winner; constellation only for 5–7 nodes.
  if (nodeCount >= 5 && nodeCount <= 7) return "constellation";
  if (nodeCount >= 8) return "cascade";
  return "convergence";
}

export function normalizeFindingsInfographicData(
  raw: any,
  diagnosisFallback = "",
  layoutHint: FindingsInfographicLayout | "auto" = "convergence"
): FindingsInfographicData {
  const nodesIn = Array.isArray(raw?.nodes)
    ? raw.nodes
    : Array.isArray(raw?.findings)
      ? raw.findings
      : Array.isArray(raw?.hallazgos)
        ? raw.hallazgos
        : [];

  const nodes: FindingsInfographicNode[] = nodesIn
    .map((n: any, idx: number) => ({
      id: String(n?.id || `fig-${idx + 1}`),
      label: String(n?.label || n?.finding || n?.hallazgo || n?.title || "").trim(),
      detail: String(n?.detail || n?.detalle || n?.description || "").trim() || undefined,
      weight:
        n?.weight === "primary" || n?.peso === "primary" || idx === 0
          ? ("primary" as const)
          : ("secondary" as const),
    }))
    .filter((n: FindingsInfographicNode) => n.label)
    .slice(0, 8);

  const layout = pickLayout(
    String(raw?.layout || layoutHint || "convergence"),
    nodes.length
  );

  return {
    title: String(raw?.title || "Justificación diagnóstica").trim(),
    diagnosis: String(
      raw?.diagnosis || raw?.diagnostico || diagnosisFallback || ""
    ).trim(),
    studyRegion: String(raw?.studyRegion || raw?.region || "").trim() || undefined,
    layout,
    nodes: nodes.length ? nodes : [emptyInfographicNode()],
    generatedAt: String(raw?.generatedAt || new Date().toISOString()),
  };
}

/** Shared layout geometry for SVG preview and PDF. Units are abstract (0–1000 viewBox). */
export interface InfographicBox {
  id: string;
  kind: "finding" | "diagnosis";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  detail?: string;
  weight?: "primary" | "secondary";
}

export interface InfographicEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Quadratic control point for curved arrows. */
  cx: number;
  cy: number;
}

export interface InfographicScene {
  width: number;
  height: number;
  boxes: InfographicBox[];
  edges: InfographicEdge[];
  layout: FindingsInfographicLayout;
  title: string;
  diagnosis: string;
  studyRegion?: string;
}

function wrapEstimate(text: string, charsPerLine: number, maxLines: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let cur = 0;
  for (const w of words) {
    if (cur + w.length + (cur ? 1 : 0) > charsPerLine) {
      lines++;
      cur = w.length;
      if (lines >= maxLines) break;
    } else {
      cur += (cur ? 1 : 0) + w.length;
    }
  }
  return Math.min(maxLines, Math.max(1, lines));
}

function findingBoxSize(label: string, detail: string | undefined, baseW: number) {
  const labelLines = wrapEstimate(label, Math.floor(baseW / 11), 3);
  const detailLines = detail ? wrapEstimate(detail, Math.floor(baseW / 10), 2) : 0;
  const h = 36 + labelLines * 18 + detailLines * 15 + 16;
  return { w: baseW, h };
}

export function buildInfographicScene(data: FindingsInfographicData): InfographicScene {
  const width = 1000;
  const height = 720;
  const nodes = (data.nodes || []).filter((n) => n.label.trim()).slice(0, 8);
  const layout = data.layout || "convergence";
  const diagnosis = data.diagnosis || "Diagnóstico";

  const boxes: InfographicBox[] = [];
  const edges: InfographicEdge[] = [];

  if (layout === "constellation") {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const dxW = 280;
    const dxH = 88;
    boxes.push({
      id: "diagnosis",
      kind: "diagnosis",
      x: cx - dxW / 2,
      y: cy - dxH / 2,
      w: dxW,
      h: dxH,
      label: diagnosis,
    });

    const n = Math.max(nodes.length, 1);
    const radiusX = 340;
    const radiusY = 240;
    nodes.forEach((node, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const { w, h } = findingBoxSize(node.label, node.detail, 200);
      const bx = cx + Math.cos(angle) * radiusX - w / 2;
      const by = cy + Math.sin(angle) * radiusY - h / 2;
      boxes.push({
        id: node.id,
        kind: "finding",
        x: Math.max(20, Math.min(width - w - 20, bx)),
        y: Math.max(70, Math.min(height - h - 20, by)),
        w,
        h,
        label: node.label,
        detail: node.detail,
        weight: node.weight,
      });
      const fx = bx + w / 2;
      const fy = by + h / 2;
      edges.push({
        x1: fx,
        y1: fy,
        x2: cx,
        y2: cy,
        cx: (fx + cx) / 2,
        cy: (fy + cy) / 2,
      });
    });
  } else if (layout === "cascade") {
    const marginX = 80;
    const contentW = width - marginX * 2;
    let y = 90;
    nodes.forEach((node, i) => {
      const { w, h } = findingBoxSize(node.label, node.detail, Math.min(520, contentW));
      const x = (width - w) / 2;
      boxes.push({
        id: node.id,
        kind: "finding",
        x,
        y,
        w,
        h,
        label: node.label,
        detail: node.detail,
        weight: node.weight,
      });
      if (i > 0) {
        const prev = boxes[boxes.length - 2];
        edges.push({
          x1: prev.x + prev.w / 2,
          y1: prev.y + prev.h,
          x2: x + w / 2,
          y2: y,
          cx: prev.x + prev.w / 2,
          cy: (prev.y + prev.h + y) / 2,
        });
      }
      y += h + 36;
    });
    const dxW = Math.min(420, contentW);
    const dxH = 92;
    const dx = (width - dxW) / 2;
    boxes.push({
      id: "diagnosis",
      kind: "diagnosis",
      x: dx,
      y,
      w: dxW,
      h: dxH,
      label: diagnosis,
    });
    if (nodes.length) {
      const lastFinding = boxes[boxes.length - 2];
      edges.push({
        x1: lastFinding.x + lastFinding.w / 2,
        y1: lastFinding.y + lastFinding.h,
        x2: dx + dxW / 2,
        y2: y,
        cx: dx + dxW / 2,
        cy: (lastFinding.y + lastFinding.h + y) / 2,
      });
    }
  } else {
    // convergence — findings across the top arc, diagnosis bottom-center
    const dxW = 320;
    const dxH = 96;
    const dxX = (width - dxW) / 2;
    const dxY = height - dxH - 40;
    boxes.push({
      id: "diagnosis",
      kind: "diagnosis",
      x: dxX,
      y: dxY,
      w: dxW,
      h: dxH,
      label: diagnosis,
    });

    const n = Math.max(nodes.length, 1);
    const usableW = width - 48;
    const gap = 16;
    const boxW = Math.min(210, (usableW - gap * (n - 1)) / n);
    const totalW = n * boxW + (n - 1) * gap;
    const startX = (width - totalW) / 2;
    const topY = 88;

    nodes.forEach((node, i) => {
      const { w, h } = findingBoxSize(node.label, node.detail, boxW);
      const x = startX + i * (boxW + gap) + (boxW - w) / 2;
      // Fan: outer nodes sit slightly higher for arc feel
      const arcLift = Math.abs(i - (n - 1) / 2) * 10;
      const y = topY + (28 - arcLift);
      boxes.push({
        id: node.id,
        kind: "finding",
        x,
        y,
        w,
        h,
        label: node.label,
        detail: node.detail,
        weight: node.weight,
      });
      const fx = x + w / 2;
      const fy = y + h;
      const tx = dxX + dxW / 2;
      const ty = dxY;
      edges.push({
        x1: fx,
        y1: fy,
        x2: tx,
        y2: ty,
        cx: (fx + tx) / 2,
        cy: (fy + ty) / 2 + 40,
      });
    });
  }

  // Dynamic height for cascade
  let sceneH = height;
  if (layout === "cascade" && boxes.length) {
    const bottom = Math.max(...boxes.map((b) => b.y + b.h));
    sceneH = Math.max(height, bottom + 40);
  }

  return {
    width,
    height: sceneH,
    boxes,
    edges,
    layout,
    title: data.title || "Justificación diagnóstica",
    diagnosis,
    studyRegion: data.studyRegion,
  };
}
