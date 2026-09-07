import type {
  ReasoningChainData,
  ReasoningNodeKind,
  ReasoningNodeStatus,
  ReasoningSignItem,
} from "../types";

const NODE_KINDS: ReasoningNodeKind[] = [
  "clinical_context",
  "sought_signs",
  "key_finding",
  "associated_signs",
  "absent_signs",
  "lab_correlation",
  "synthesis",
  "management",
];

const STATUSES: ReasoningNodeStatus[] = [
  "present",
  "absent",
  "equivocal",
  "not_evaluated",
  "discarded",
  "context",
];

export function reasoningStatusLabel(status?: string): string {
  switch (status) {
    case "present":
      return "Presente";
    case "absent":
      return "Ausente";
    case "equivocal":
      return "Equívoco";
    case "not_evaluated":
      return "No evaluado";
    case "discarded":
      return "Descartado";
    case "context":
      return "Contexto";
    default:
      return status || "";
  }
}

export function reasoningKindLabel(kind?: string): string {
  switch (kind) {
    case "clinical_context":
      return "Contexto clínico";
    case "sought_signs":
      return "Signos buscados";
    case "key_finding":
      return "Hallazgo clave";
    case "associated_signs":
      return "Signos asociados";
    case "absent_signs":
      return "Signos ausentes";
    case "lab_correlation":
      return "Clínica / laboratorio";
    case "synthesis":
      return "Síntesis";
    case "management":
      return "Conducta";
    default:
      return kind || "Paso";
  }
}

function asStatus(raw: any, fallback: ReasoningNodeStatus = "context"): ReasoningNodeStatus {
  const s = String(raw || "").trim().toLowerCase();
  return (STATUSES.includes(s as ReasoningNodeStatus) ? s : fallback) as ReasoningNodeStatus;
}

function asKind(raw: any, fallback: ReasoningNodeKind = "sought_signs"): ReasoningNodeKind {
  const s = String(raw || "").trim().toLowerCase();
  return (NODE_KINDS.includes(s as ReasoningNodeKind) ? s : fallback) as ReasoningNodeKind;
}

function normalizeItems(raw: any): ReasoningSignItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any, idx: number) => ({
      label: String(it?.label || it?.name || `Signo ${idx + 1}`).trim(),
      status: asStatus(it?.status, "present"),
      significance: String(it?.significance || it?.why || "").trim(),
      evidence: it?.evidence ? String(it.evidence).trim() : undefined,
    }))
    .filter((it: ReasoningSignItem) => it.label);
}

/** Normalize model JSON into a stable ReasoningChainData payload. */
export function normalizeReasoningChainData(raw: any): ReasoningChainData {
  const nodesIn = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const nodes = nodesIn
    .map((n: any, idx: number) => ({
      id: String(n?.id || `node-${idx + 1}`),
      kind: asKind(n?.kind, NODE_KINDS[Math.min(idx, NODE_KINDS.length - 1)]),
      title: String(n?.title || reasoningKindLabel(n?.kind) || `Paso ${idx + 1}`).trim(),
      summary: String(n?.summary || "").trim(),
      status: asStatus(n?.status, "context"),
      items: normalizeItems(n?.items),
      clinicalLink: n?.clinicalLink ? String(n.clinicalLink).trim() : undefined,
      labLink: n?.labLink ? String(n.labLink).trim() : undefined,
    }))
    .filter((n: any) => n.title || n.summary);

  const discarded = Array.isArray(raw?.discardedDifferentials)
    ? raw.discardedDifferentials
        .map((d: any) => ({
          name: String(d?.name || "").trim(),
          reason: String(d?.reason || "").trim(),
        }))
        .filter((d: { name: string; reason: string }) => d.name)
    : [];

  return {
    title: String(raw?.title || "Cadena de razonamiento radiológico").trim(),
    studyRegion: raw?.studyRegion ? String(raw.studyRegion).trim() : undefined,
    workingDiagnosis: String(raw?.workingDiagnosis || "").trim(),
    certaintyLabel: raw?.certaintyLabel ? String(raw.certaintyLabel).trim() : undefined,
    clinicalContext: String(raw?.clinicalContext || "").trim(),
    nodes,
    discardedDifferentials: discarded,
    synthesis: String(raw?.synthesis || "").trim(),
    managementSuggestion: raw?.managementSuggestion
      ? String(raw.managementSuggestion).trim()
      : undefined,
    generatedAt: raw?.generatedAt ? String(raw.generatedAt) : new Date().toISOString(),
  };
}
