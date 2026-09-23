import type {
  FindingsInfographicContentMode,
  FindingsInfographicData,
  FindingsInfographicLayout,
  FindingsInfographicNode,
  FindingsInfographicPolarity,
} from "../types";

export const INFOGRAPHIC_DIAGNOSIS_PRESETS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (del informe)" },
  { id: "colecistitis", label: "Colecistitis aguda" },
  { id: "apendicitis", label: "Apendicitis aguda" },
  { id: "pielonefritis", label: "Pielonefritis" },
  { id: "tvp", label: "Trombosis venosa profunda" },
  { id: "tendinopatia", label: "Tendinopatía / rotura" },
  { id: "hernia", label: "Hernia de pared" },
  { id: "birads", label: "Mama / BI-RADS" },
  { id: "tirads", label: "Tiroides / TI-RADS" },
  { id: "custom", label: "Otro (escribir abajo)" },
];

export const INFOGRAPHIC_CONTENT_MODES: {
  id: FindingsInfographicContentMode;
  label: string;
  desc: string;
  defaultTitle: string;
  headerLabel: string;
  suggestedLayouts: FindingsInfographicLayout[];
}[] = [
  {
    id: "justify_diagnosis",
    label: "Justifican el diagnóstico",
    desc: "Hallazgos que sostienen el diagnóstico ancla",
    defaultTitle: "Justificación diagnóstica",
    headerLabel: "JUSTIFICACIÓN DIAGNÓSTICA",
    suggestedLayouts: ["convergence", "constellation", "funnel", "tree"],
  },
  {
    id: "present_findings",
    label: "Hallazgos presentes",
    desc: "Lo afirmado / positivo en el informe",
    defaultTitle: "Hallazgos presentes",
    headerLabel: "HALLAZGOS PRESENTES",
    suggestedLayouts: ["pillars", "stack", "constellation", "radial"],
  },
  {
    id: "ruled_out",
    label: "Hallazgos descartados",
    desc: "Negaciones explícitas del informe (sin X, se descarta…)",
    defaultTitle: "Hallazgos descartados",
    headerLabel: "HALLAZGOS DESCARTADOS",
    suggestedLayouts: ["cascade", "stack", "pillars", "timeline"],
  },
  {
    id: "classification_criteria",
    label: "Criterios de clasificación",
    desc: "Criterios de escala presentes (BI-RADS, TI-RADS, Bosniak…)",
    defaultTitle: "Criterios de clasificación",
    headerLabel: "CRITERIOS DE CLASIFICACIÓN",
    suggestedLayouts: ["pillars", "tree", "funnel", "stack"],
  },
  {
    id: "key_signs",
    label: "Signos clave",
    desc: "Semiología mayor / signos guía del caso",
    defaultTitle: "Signos clave",
    headerLabel: "SIGNOS CLAVE",
    suggestedLayouts: ["convergence", "radial", "constellation", "tree"],
  },
  {
    id: "present_vs_ruled",
    label: "Presentes vs descartados",
    desc: "Dos columnas: afirmados frente a negados explícitos",
    defaultTitle: "Presentes y descartados",
    headerLabel: "PRESENTES  ·  DESCARTADOS",
    suggestedLayouts: ["split_compare", "pillars"],
  },
  {
    id: "by_structure",
    label: "Por estructura / órgano",
    desc: "Agrupa hallazgos por anatomía citada en el informe",
    defaultTitle: "Hallazgos por estructura",
    headerLabel: "POR ESTRUCTURA",
    suggestedLayouts: ["tree", "pillars", "stack", "timeline"],
  },
  {
    id: "severity_ladder",
    label: "Escalera de severidad",
    desc: "Ordena hallazgos de menor a mayor relevancia",
    defaultTitle: "Gradación de hallazgos",
    headerLabel: "GRADACIÓN DE HALLAZGOS",
    suggestedLayouts: ["funnel", "cascade", "timeline", "stack"],
  },
];

export const INFOGRAPHIC_LAYOUT_OPTIONS: {
  id: FindingsInfographicLayout | "auto";
  label: string;
  desc: string;
}[] = [
  { id: "convergence", label: "Convergencia", desc: "Hallazgos → ancla (estética estable)" },
  { id: "constellation", label: "Constelación", desc: "Ancla al centro, nodos en órbita" },
  { id: "radial", label: "Radial", desc: "Anillo amplio alrededor del ancla" },
  { id: "cascade", label: "Cascada", desc: "Flujo vertical hacia el ancla" },
  { id: "funnel", label: "Embudo", desc: "Se estrecha hacia el diagnóstico" },
  { id: "pillars", label: "Pilares", desc: "Columnas/tarjetas en fila" },
  { id: "stack", label: "Apilado", desc: "Tarjetas apiladas sin flechas forzadas" },
  { id: "timeline", label: "Línea de tiempo", desc: "Secuencia horizontal de hallazgos" },
  { id: "split_compare", label: "Comparativa", desc: "Dos columnas (presentes / descartados)" },
  { id: "tree", label: "Árbol", desc: "Ancla arriba, ramas de hallazgos abajo" },
  { id: "auto", label: "Auto", desc: "Elige layout según contenido y nº de nodos" },
];

const ALL_LAYOUTS = new Set<FindingsInfographicLayout>([
  "convergence",
  "constellation",
  "cascade",
  "split_compare",
  "timeline",
  "funnel",
  "pillars",
  "stack",
  "radial",
  "tree",
]);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyInfographicNode(): FindingsInfographicNode {
  return {
    id: newId("fig-node"),
    label: "",
    detail: "",
    weight: "secondary",
    polarity: "neutral",
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

export function contentModeMeta(mode: FindingsInfographicContentMode | string | undefined) {
  return (
    INFOGRAPHIC_CONTENT_MODES.find((m) => m.id === mode) ||
    INFOGRAPHIC_CONTENT_MODES[0]
  );
}

export function layoutDisplayLabel(layout: FindingsInfographicLayout | string): string {
  return INFOGRAPHIC_LAYOUT_OPTIONS.find((o) => o.id === layout)?.label || String(layout);
}

export function pickLayout(
  requested: FindingsInfographicLayout | "auto" | string,
  nodeCount: number,
  contentMode: FindingsInfographicContentMode = "justify_diagnosis"
): FindingsInfographicLayout {
  if (ALL_LAYOUTS.has(requested as FindingsInfographicLayout)) {
    return requested as FindingsInfographicLayout;
  }
  const suggested = contentModeMeta(contentMode).suggestedLayouts;
  if (contentMode === "present_vs_ruled") return "split_compare";
  if (contentMode === "severity_ladder") return nodeCount >= 5 ? "funnel" : "cascade";
  if (contentMode === "by_structure") return "tree";
  if (nodeCount >= 6) return suggested[1] || "constellation";
  return suggested[0] || "convergence";
}

function normalizePolarity(
  raw: any,
  contentMode: FindingsInfographicContentMode
): FindingsInfographicPolarity {
  const p = String(raw?.polarity || raw?.tipo || raw?.role || "").toLowerCase();
  if (["ruled_out", "descartado", "negativo", "absent", "ruled-out"].includes(p)) {
    return "ruled_out";
  }
  if (["criterion", "criterio", "scale", "clasificacion"].includes(p)) return "criterion";
  if (["present", "presente", "positivo", "for", "afirmado"].includes(p)) return "present";
  if (["neutral", "neutro"].includes(p)) return "neutral";
  // Defaults by content mode when the model omits polarity
  if (contentMode === "ruled_out") return "ruled_out";
  if (contentMode === "classification_criteria") return "criterion";
  if (
    contentMode === "justify_diagnosis" ||
    contentMode === "present_findings" ||
    contentMode === "key_signs" ||
    contentMode === "severity_ladder"
  ) {
    return "present";
  }
  return "neutral";
}

export function normalizeFindingsInfographicData(
  raw: any,
  diagnosisFallback = "",
  layoutHint: FindingsInfographicLayout | "auto" = "convergence",
  contentModeHint: FindingsInfographicContentMode = "justify_diagnosis"
): FindingsInfographicData {
  const nodesIn = Array.isArray(raw?.nodes)
    ? raw.nodes
    : Array.isArray(raw?.findings)
      ? raw.findings
      : Array.isArray(raw?.hallazgos)
        ? raw.hallazgos
        : [];

  const contentMode = (INFOGRAPHIC_CONTENT_MODES.find(
    (m) => m.id === (raw?.contentMode || contentModeHint)
  )?.id || contentModeHint) as FindingsInfographicContentMode;

  const nodes: FindingsInfographicNode[] = nodesIn
    .map((n: any, idx: number) => ({
      id: String(n?.id || `fig-${idx + 1}`),
      label: String(n?.label || n?.finding || n?.hallazgo || n?.title || "").trim(),
      detail: String(n?.detail || n?.detalle || n?.description || "").trim() || undefined,
      weight:
        n?.weight === "primary" || n?.peso === "primary" || idx === 0
          ? ("primary" as const)
          : ("secondary" as const),
      polarity: normalizePolarity(n, contentMode),
      group: String(n?.group || n?.grupo || n?.structure || "").trim() || undefined,
    }))
    .filter((n: FindingsInfographicNode) => n.label)
    .slice(0, 10);

  const layout = pickLayout(
    String(raw?.layout || layoutHint || "convergence"),
    nodes.length,
    contentMode
  );

  const meta = contentModeMeta(contentMode);

  return {
    title: String(raw?.title || meta.defaultTitle).trim(),
    diagnosis: String(
      raw?.diagnosis || raw?.diagnostico || diagnosisFallback || ""
    ).trim(),
    studyRegion: String(raw?.studyRegion || raw?.region || "").trim() || undefined,
    contentMode,
    layout,
    nodes: nodes.length ? nodes : [emptyInfographicNode()],
    generatedAt: String(raw?.generatedAt || new Date().toISOString()),
  };
}

/** Shared layout geometry for SVG preview and PDF. Units are abstract (0–1000 viewBox). */
export interface InfographicBox {
  id: string;
  kind: "finding" | "diagnosis" | "section";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  detail?: string;
  weight?: "primary" | "secondary";
  polarity?: FindingsInfographicPolarity;
}

export interface InfographicEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

export interface InfographicScene {
  width: number;
  height: number;
  boxes: InfographicBox[];
  edges: InfographicEdge[];
  layout: FindingsInfographicLayout;
  contentMode: FindingsInfographicContentMode;
  title: string;
  headerLabel: string;
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

function pushFinding(
  boxes: InfographicBox[],
  node: FindingsInfographicNode,
  x: number,
  y: number,
  w: number,
  h: number
) {
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
    polarity: node.polarity,
  });
}

function edgeTo(
  edges: InfographicEdge[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend = 0
) {
  edges.push({
    x1,
    y1,
    x2,
    y2,
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2 + bend,
  });
}

export function buildInfographicScene(data: FindingsInfographicData): InfographicScene {
  const width = 1000;
  let height = 720;
  const nodes = (data.nodes || []).filter((n) => n.label.trim()).slice(0, 10);
  const layout = data.layout || "convergence";
  const contentMode = data.contentMode || "justify_diagnosis";
  const meta = contentModeMeta(contentMode);
  const diagnosis = data.diagnosis || meta.defaultTitle;

  const boxes: InfographicBox[] = [];
  const edges: InfographicEdge[] = [];

  const addAnchor = (x: number, y: number, w: number, h: number) => {
    boxes.push({
      id: "diagnosis",
      kind: "diagnosis",
      x,
      y,
      w,
      h,
      label: diagnosis,
    });
  };

  if (layout === "split_compare") {
    const present = nodes.filter((n) => n.polarity !== "ruled_out");
    const ruled = nodes.filter((n) => n.polarity === "ruled_out");
    const left = present.length ? present : nodes.slice(0, Math.ceil(nodes.length / 2));
    const right = ruled.length
      ? ruled
      : nodes.slice(Math.ceil(nodes.length / 2));

    boxes.push({
      id: "sec-present",
      kind: "section",
      x: 60,
      y: 78,
      w: 400,
      h: 36,
      label: "PRESENTES",
      polarity: "present",
    });
    boxes.push({
      id: "sec-ruled",
      kind: "section",
      x: 540,
      y: 78,
      w: 400,
      h: 36,
      label: "DESCARTADOS",
      polarity: "ruled_out",
    });

    let yL = 130;
    left.forEach((node) => {
      const { w, h } = findingBoxSize(node.label, node.detail, 380);
      pushFinding(boxes, { ...node, polarity: node.polarity || "present" }, 70, yL, w, h);
      yL += h + 18;
    });
    let yR = 130;
    right.forEach((node) => {
      const { w, h } = findingBoxSize(node.label, node.detail, 380);
      pushFinding(boxes, { ...node, polarity: "ruled_out" }, 550, yR, w, h);
      yR += h + 18;
    });

    const dxW = 360;
    const dxH = 88;
    const dxY = Math.max(yL, yR) + 24;
    addAnchor((width - dxW) / 2, dxY, dxW, dxH);
    height = Math.max(height, dxY + dxH + 40);
  } else if (layout === "timeline") {
    addAnchor((width - 320) / 2, 90, 320, 80);
    const n = Math.max(nodes.length, 1);
    const usableW = width - 80;
    const boxW = Math.min(180, (usableW - 12 * (n - 1)) / n);
    const totalW = n * boxW + (n - 1) * 12;
    const startX = (width - totalW) / 2;
    const lineY = 280;
    nodes.forEach((node, i) => {
      const { w, h } = findingBoxSize(node.label, node.detail, boxW);
      const x = startX + i * (boxW + 12);
      const y = lineY;
      pushFinding(boxes, node, x, y, w, h);
      edgeTo(edges, x + w / 2, 170, x + w / 2, y, 0);
      if (i > 0) {
        const prevX = startX + (i - 1) * (boxW + 12) + boxW;
        edgeTo(edges, prevX, lineY + h / 2, x, lineY + h / 2, 0);
      }
    });
    height = Math.max(height, lineY + 200);
  } else if (layout === "funnel") {
    let y = 90;
    nodes.forEach((node, i) => {
      const shrink = Math.max(280, 620 - i * 40);
      const { w, h } = findingBoxSize(node.label, node.detail, shrink);
      const x = (width - w) / 2;
      pushFinding(boxes, node, x, y, w, h);
      if (i > 0) {
        const prev = boxes[boxes.length - 2];
        edgeTo(edges, prev.x + prev.w / 2, prev.y + prev.h, x + w / 2, y, 10);
      }
      y += h + 28;
    });
    const dxW = 300;
    const dxH = 92;
    const dx = (width - dxW) / 2;
    addAnchor(dx, y, dxW, dxH);
    if (nodes.length) {
      const last = boxes[boxes.length - 2];
      edgeTo(edges, last.x + last.w / 2, last.y + last.h, dx + dxW / 2, y, 12);
    }
    height = Math.max(height, y + dxH + 40);
  } else if (layout === "pillars" || layout === "stack") {
    const n = Math.max(nodes.length, 1);
    if (layout === "stack") {
      let y = 90;
      nodes.forEach((node) => {
        const { w, h } = findingBoxSize(node.label, node.detail, 560);
        const x = (width - w) / 2;
        pushFinding(boxes, node, x, y, w, h);
        y += h + 16;
      });
      const dxW = 340;
      const dxH = 88;
      addAnchor((width - dxW) / 2, y + 12, dxW, dxH);
      height = Math.max(height, y + dxH + 60);
    } else {
      const gap = 14;
      const boxW = Math.min(200, (width - 60 - gap * (n - 1)) / n);
      const totalW = n * boxW + (n - 1) * gap;
      const startX = (width - totalW) / 2;
      let maxH = 0;
      nodes.forEach((node, i) => {
        const { w, h } = findingBoxSize(node.label, node.detail, boxW);
        pushFinding(boxes, node, startX + i * (boxW + gap), 100, w, h);
        maxH = Math.max(maxH, h);
      });
      const dxW = 320;
      const dxH = 90;
      const dxY = 100 + maxH + 50;
      addAnchor((width - dxW) / 2, dxY, dxW, dxH);
      boxes
        .filter((b) => b.kind === "finding")
        .forEach((b) => {
          edgeTo(edges, b.x + b.w / 2, b.y + b.h, width / 2, dxY, 30);
        });
      height = Math.max(height, dxY + dxH + 40);
    }
  } else if (layout === "tree") {
    const dxW = 340;
    const dxH = 88;
    addAnchor((width - dxW) / 2, 90, dxW, dxH);

    const groups = new Map<string, FindingsInfographicNode[]>();
    let hasGroups = false;
    nodes.forEach((node) => {
      const g = (node.group || "").trim();
      if (g) hasGroups = true;
      const key = g || "Hallazgos";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    });

    if (hasGroups && groups.size >= 2) {
      const entries = Array.from(groups.entries()).slice(0, 4);
      const gap = 20;
      const colW = Math.min(220, (width - 60 - gap * (entries.length - 1)) / entries.length);
      const totalW = entries.length * colW + (entries.length - 1) * gap;
      const startX = (width - totalW) / 2;
      let maxBottom = 260;
      entries.forEach(([gLabel, gNodes], gi) => {
        const x0 = startX + gi * (colW + gap);
        boxes.push({
          id: `sec-g-${gi}`,
          kind: "section",
          x: x0,
          y: 210,
          w: colW,
          h: 32,
          label: gLabel.toUpperCase().slice(0, 22),
          polarity: "present",
        });
        edgeTo(edges, width / 2, 178, x0 + colW / 2, 210, 10);
        let y = 256;
        gNodes.slice(0, 3).forEach((node) => {
          const { w, h } = findingBoxSize(node.label, node.detail, colW);
          pushFinding(boxes, node, x0, y, w, h);
          y += h + 12;
        });
        maxBottom = Math.max(maxBottom, y);
      });
      height = Math.max(height, maxBottom + 40);
    } else {
      const n = Math.max(nodes.length, 1);
      const gap = 14;
      const boxW = Math.min(210, (width - 60 - gap * (n - 1)) / n);
      const totalW = n * boxW + (n - 1) * gap;
      const startX = (width - totalW) / 2;
      const y = 260;
      nodes.forEach((node, i) => {
        const { w, h } = findingBoxSize(node.label, node.detail, boxW);
        const x = startX + i * (boxW + gap);
        pushFinding(boxes, node, x, y, w, h);
        edgeTo(edges, width / 2, 178, x + w / 2, y, 20);
      });
      height = Math.max(height, y + 220);
    }
  } else if (layout === "radial" || layout === "constellation") {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const dxW = 280;
    const dxH = 88;
    addAnchor(cx - dxW / 2, cy - dxH / 2, dxW, dxH);
    const n = Math.max(nodes.length, 1);
    const radiusX = layout === "radial" ? 360 : 340;
    const radiusY = layout === "radial" ? 250 : 240;
    nodes.forEach((node, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const { w, h } = findingBoxSize(node.label, node.detail, layout === "radial" ? 190 : 200);
      const bx = cx + Math.cos(angle) * radiusX - w / 2;
      const by = cy + Math.sin(angle) * radiusY - h / 2;
      const x = Math.max(20, Math.min(width - w - 20, bx));
      const y = Math.max(70, Math.min(height - h - 20, by));
      pushFinding(boxes, node, x, y, w, h);
      edgeTo(edges, x + w / 2, y + h / 2, cx, cy, 0);
    });
  } else if (layout === "cascade") {
    let y = 90;
    nodes.forEach((node, i) => {
      const { w, h } = findingBoxSize(node.label, node.detail, 520);
      const x = (width - w) / 2;
      pushFinding(boxes, node, x, y, w, h);
      if (i > 0) {
        const prev = boxes[boxes.length - 2];
        edgeTo(edges, prev.x + prev.w / 2, prev.y + prev.h, x + w / 2, y, 0);
      }
      y += h + 36;
    });
    const dxW = 420;
    const dxH = 92;
    const dx = (width - dxW) / 2;
    addAnchor(dx, y, dxW, dxH);
    if (nodes.length) {
      const last = boxes[boxes.length - 2];
      edgeTo(edges, last.x + last.w / 2, last.y + last.h, dx + dxW / 2, y, 0);
    }
    height = Math.max(height, y + dxH + 40);
  } else {
    // convergence
    const dxW = 320;
    const dxH = 96;
    const dxX = (width - dxW) / 2;
    const dxY = height - dxH - 40;
    addAnchor(dxX, dxY, dxW, dxH);
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
      const arcLift = Math.abs(i - (n - 1) / 2) * 10;
      const y = topY + (28 - arcLift);
      pushFinding(boxes, node, x, y, w, h);
      edgeTo(edges, x + w / 2, y + h, dxX + dxW / 2, dxY, 40);
    });
  }

  if (boxes.length) {
    const bottom = Math.max(...boxes.map((b) => b.y + b.h));
    height = Math.max(height, bottom + 40);
  }

  return {
    width,
    height,
    boxes,
    edges,
    layout,
    contentMode,
    title: data.title || meta.defaultTitle,
    headerLabel: meta.headerLabel,
    diagnosis,
    studyRegion: data.studyRegion,
  };
}

/** Prompt block for the API according to content mode. */
export function buildContentModePromptInstructions(
  mode: FindingsInfographicContentMode,
  diagnosis: string
): string {
  const dx = diagnosis || "el diagnóstico del informe";
  switch (mode) {
    case "present_findings":
      return `CONTENIDO: HALLAZGOS PRESENTES. Extrae 4-8 hallazgos afirmados/positivos del informe relacionados con "${dx}". polarity="present".`;
    case "ruled_out":
      return `CONTENIDO: HALLAZGOS DESCARTADOS. Extrae 4-8 negaciones EXPLÍCITAS del informe (ej. "sin líquido libre", "se descarta trombosis") relacionadas con "${dx}". polarity="ruled_out". PROHIBIDO inventar ausencias o decir "no mencionado".`;
    case "classification_criteria":
      return `CONTENIDO: CRITERIOS DE CLASIFICACIÓN. Extrae 4-8 criterios de escala (BI-RADS/TI-RADS/Bosniak/Fleischner u otra del informe) que estén presentes y justifiquen la categoría de "${dx}". polarity="criterion". Incluye la categoría en diagnosis.`;
    case "key_signs":
      return `CONTENIDO: SIGNOS CLAVE. Extrae 4-7 signos semiológicos mayores del caso "${dx}". polarity="present".`;
    case "present_vs_ruled":
      return `CONTENIDO: PRESENTES VS DESCARTADOS. Genera 3-5 nodes polarity="present" y 3-5 polarity="ruled_out", todos explícitos en el informe sobre "${dx}". Nunca "no mencionado".`;
    case "by_structure":
      return `CONTENIDO: POR ESTRUCTURA. Extrae 4-8 hallazgos y asigna group=estructura anatómica citada. polarity según sea presente o descartado explícito.`;
    case "severity_ladder":
      return `CONTENIDO: ESCALERA DE SEVERIDAD. Ordena 4-7 hallazgos de "${dx}" de menor a mayor relevancia clínica (el último/más grave con weight=primary).`;
    case "justify_diagnosis":
    default:
      return `CONTENIDO: JUSTIFICACIÓN DIAGNÓSTICA. Extrae 4-7 hallazgos que sostienen "${dx}". polarity="present".`;
  }
}
