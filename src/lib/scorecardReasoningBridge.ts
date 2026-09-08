import type {
  ClinicalScorecardData,
  ProtocolDecisionGraphData,
  ProtocolGraphEdge,
  ProtocolGraphNode,
  ProtocolGraphNodeKind,
  ScorecardCriterionStatus,
} from "../types";
import { extractJsonObject } from "./reasoningChain";

const NODE_KINDS: ProtocolGraphNodeKind[] = ["start", "criterion", "gate", "category", "action"];
const CRIT_STATUS: ScorecardCriterionStatus[] = ["met", "not_met", "not_mentioned", "equivocal"];

export function protocolGraphStatusLabel(status?: string): string {
  switch (status) {
    case "met":
      return "Cumplido";
    case "not_met":
      return "No cumplido";
    case "not_mentioned":
      return "No mencionado";
    case "equivocal":
      return "Equívoco";
    case "path":
      return "En ruta";
    case "outcome":
      return "Resultado";
    case "neutral":
      return "Nodo";
    default:
      return status || "";
  }
}

export function protocolGraphKindLabel(kind?: string): string {
  switch (kind) {
    case "start":
      return "Inicio";
    case "criterion":
      return "Criterio";
    case "gate":
      return "Bifurcación";
    case "category":
      return "Categoría";
    case "action":
      return "Conducta / siguiente paso";
    default:
      return kind || "Nodo";
  }
}

function asKind(raw: any, fallback: ProtocolGraphNodeKind = "criterion"): ProtocolGraphNodeKind {
  const s = String(raw || "").trim().toLowerCase();
  return (NODE_KINDS.includes(s as ProtocolGraphNodeKind) ? s : fallback) as ProtocolGraphNodeKind;
}

function asCritStatus(raw: any): ScorecardCriterionStatus | "path" | "outcome" | "neutral" | undefined {
  const s = String(raw || "").trim().toLowerCase();
  if (CRIT_STATUS.includes(s as ScorecardCriterionStatus)) return s as ScorecardCriterionStatus;
  if (s === "path" || s === "outcome" || s === "neutral") return s;
  return undefined;
}

/** Paint criterion nodes from live scorecard statuses/evidence. */
export function paintGraphFromScorecard(
  graph: ProtocolDecisionGraphData,
  scorecard: ClinicalScorecardData | null | undefined
): ProtocolDecisionGraphData {
  if (!scorecard?.criteria?.length) return graph;
  const byId = new Map(scorecard.criteria.map((c) => [String(c.id), c]));
  const byLabel = new Map(
    scorecard.criteria.map((c) => [c.criterion.trim().toLowerCase(), c])
  );

  const nodes = graph.nodes.map((n) => {
    if (n.kind !== "criterion") return n;
    const linked =
      (n.linkedCriterionId && byId.get(String(n.linkedCriterionId))) ||
      byLabel.get(n.label.trim().toLowerCase());
    if (!linked) return n;
    return {
      ...n,
      linkedCriterionId: linked.id,
      status: linked.status,
      value: linked.value || n.value,
      evidence: linked.evidence || n.evidence,
      weight: linked.weight || n.weight,
    };
  });

  return {
    ...graph,
    protocolId: graph.protocolId || scorecard.protocolId,
    protocolName: graph.protocolName || scorecard.protocolName,
    categoryAssigned: graph.categoryAssigned || scorecard.categoryAssigned,
    trafficLight: graph.trafficLight || scorecard.trafficLight,
    scoreMet: typeof graph.scoreMet === "number" ? graph.scoreMet : scorecard.scoreMet,
    scoreTotal: typeof graph.scoreTotal === "number" ? graph.scoreTotal : scorecard.scoreTotal,
    studyRegion: graph.studyRegion || scorecard.studyRegion,
    clinicalSummary: graph.clinicalSummary || scorecard.clinicalSummary,
    nodes,
  };
}

/** Build a simple vertical fallback graph directly from scorecard criteria. */
export function buildFallbackGraphFromScorecard(
  scorecard: ClinicalScorecardData
): ProtocolDecisionGraphData {
  const startId = "start";
  const catId = "category";
  const nodes: ProtocolGraphNode[] = [
    {
      id: startId,
      kind: "start",
      label: `Protocolo: ${scorecard.protocolName}`,
      status: "path",
      detail: scorecard.clinicalSummary || undefined,
    },
  ];
  const edges: ProtocolGraphEdge[] = [];

  scorecard.criteria.forEach((c, idx) => {
    const id = `crit-${c.id || idx + 1}`;
    nodes.push({
      id,
      kind: "criterion",
      label: c.criterion,
      linkedCriterionId: c.id,
      status: c.status,
      value: c.value,
      evidence: c.evidence,
      weight: c.weight,
    });
    const from = idx === 0 ? startId : `crit-${scorecard.criteria[idx - 1].id || idx}`;
    edges.push({
      id: `e-${idx}`,
      from,
      to: id,
      active: c.status === "met" || c.status === "equivocal",
    });
  });

  const lastCrit =
    scorecard.criteria.length > 0
      ? `crit-${scorecard.criteria[scorecard.criteria.length - 1].id || scorecard.criteria.length}`
      : startId;

  nodes.push({
    id: catId,
    kind: "category",
    label: scorecard.categoryAssigned || "Categoría del protocolo",
    status: "outcome",
    detail: `Criterios positivos: ${scorecard.scoreMet}/${scorecard.scoreTotal}`,
  });
  edges.push({ id: "e-cat", from: lastCrit, to: catId, active: true, label: "Resultado" });

  return {
    title: `Grafo de decisión — ${scorecard.protocolName}`,
    protocolId: scorecard.protocolId,
    protocolName: scorecard.protocolName,
    categoryAssigned: scorecard.categoryAssigned,
    trafficLight: scorecard.trafficLight,
    scoreMet: scorecard.scoreMet,
    scoreTotal: scorecard.scoreTotal,
    studyRegion: scorecard.studyRegion,
    nodes,
    edges,
    pathNarrative:
      "Recorrido lineal de los criterios del Scorecard hasta la categoría asignada.",
    outcomeLabel: scorecard.categoryAssigned,
    clinicalSummary: scorecard.clinicalSummary,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeProtocolDecisionGraph(
  raw: any,
  scorecard?: ClinicalScorecardData | null
): ProtocolDecisionGraphData {
  const root = raw?.data && !raw?.nodes ? raw.data : raw;
  const nodesIn = Array.isArray(root?.nodes)
    ? root.nodes
    : Array.isArray(root?.nodos)
      ? root.nodos
      : [];
  const edgesIn = Array.isArray(root?.edges)
    ? root.edges
    : Array.isArray(root?.aristas)
      ? root.aristas
      : [];

  let nodes: ProtocolGraphNode[] = nodesIn
    .map((n: any, idx: number) => ({
      id: String(n?.id || `n-${idx + 1}`),
      kind: asKind(n?.kind || n?.tipo, idx === 0 ? "start" : "criterion"),
      label: String(n?.label || n?.titulo || n?.name || `Nodo ${idx + 1}`).trim(),
      linkedCriterionId: n?.linkedCriterionId || n?.criterionId
        ? String(n.linkedCriterionId || n.criterionId)
        : undefined,
      status: asCritStatus(n?.status || n?.estado) || "neutral",
      value: n?.value ? String(n.value) : undefined,
      evidence: n?.evidence || n?.evidencia ? String(n.evidence || n.evidencia) : undefined,
      weight: ["critical", "major", "minor"].includes(String(n?.weight || ""))
        ? (n.weight as "critical" | "major" | "minor")
        : undefined,
      detail: n?.detail || n?.detalle ? String(n.detail || n.detalle) : undefined,
    }))
    .filter((n: ProtocolGraphNode) => n.label);

  let edges: ProtocolGraphEdge[] = edgesIn
    .map((e: any, idx: number) => ({
      id: String(e?.id || `e-${idx + 1}`),
      from: String(e?.from || e?.desde || ""),
      to: String(e?.to || e?.hacia || ""),
      label: e?.label || e?.etiqueta ? String(e.label || e.etiqueta) : undefined,
      active: e?.active === true || e?.activo === true,
    }))
    .filter((e: ProtocolGraphEdge) => e.from && e.to);

  // Auto-chain edges if model omitted them
  if (nodes.length > 1 && edges.length === 0) {
    edges = nodes.slice(0, -1).map((n, i) => ({
      id: `auto-e-${i}`,
      from: n.id,
      to: nodes[i + 1].id,
      active: n.status === "met" || n.status === "equivocal" || n.status === "path",
    }));
  }

  let graph: ProtocolDecisionGraphData = {
    title: String(root?.title || root?.titulo || "Grafo de decisión del protocolo").trim(),
    protocolId: String(root?.protocolId || scorecard?.protocolId || "generic"),
    protocolName: String(
      root?.protocolName || scorecard?.protocolName || "Protocolo clínico"
    ).trim(),
    categoryAssigned: String(
      root?.categoryAssigned || scorecard?.categoryAssigned || ""
    ).trim(),
    trafficLight: (["low", "moderate", "high", "critical"].includes(
      String(root?.trafficLight || scorecard?.trafficLight || "")
    )
      ? (root?.trafficLight || scorecard?.trafficLight)
      : "low") as ProtocolDecisionGraphData["trafficLight"],
    scoreMet: Number(root?.scoreMet ?? scorecard?.scoreMet ?? 0) || 0,
    scoreTotal: Number(root?.scoreTotal ?? scorecard?.scoreTotal ?? nodes.length) || 0,
    studyRegion: root?.studyRegion || scorecard?.studyRegion
      ? String(root?.studyRegion || scorecard?.studyRegion)
      : undefined,
    nodes,
    edges,
    pathNarrative: String(
      root?.pathNarrative || root?.narrativa || root?.path || ""
    ).trim(),
    outcomeLabel: String(
      root?.outcomeLabel || root?.resultado || root?.categoryAssigned || scorecard?.categoryAssigned || ""
    ).trim(),
    clinicalSummary: root?.clinicalSummary || scorecard?.clinicalSummary
      ? String(root?.clinicalSummary || scorecard?.clinicalSummary)
      : undefined,
    generatedAt: new Date().toISOString(),
  };

  if (scorecard) {
    graph = paintGraphFromScorecard(graph, scorecard);
  }

  if (!graph.nodes.length && scorecard?.criteria?.length) {
    return buildFallbackGraphFromScorecard(scorecard);
  }

  return graph;
}

export { extractJsonObject };
