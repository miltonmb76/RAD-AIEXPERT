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

const KIND_ALIASES: Record<string, ReasoningNodeKind> = {
  clinical_context: "clinical_context",
  contexto_clinico: "clinical_context",
  contexto: "clinical_context",
  clinica: "clinical_context",
  sought_signs: "sought_signs",
  signos_buscados: "sought_signs",
  buscados: "sought_signs",
  key_finding: "key_finding",
  hallazgo_clave: "key_finding",
  hallazgo_principal: "key_finding",
  associated_signs: "associated_signs",
  signos_asociados: "associated_signs",
  asociados: "associated_signs",
  absent_signs: "absent_signs",
  signos_ausentes: "absent_signs",
  ausentes: "absent_signs",
  negativos: "absent_signs",
  lab_correlation: "lab_correlation",
  correlacion: "lab_correlation",
  correlacion_clinica: "lab_correlation",
  laboratorio: "lab_correlation",
  synthesis: "synthesis",
  sintesis: "synthesis",
  management: "management",
  conducta: "management",
  manejo: "management",
};

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
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("present") || s === "si" || s === "positivo") return "present";
  if (s.includes("absent") || s === "ausente" || s === "negativo") return "absent";
  if (s.includes("equivoc") || s.includes("dudoso")) return "equivocal";
  if (s.includes("no_eval") || s.includes("no evalu") || s.includes("sin dato")) return "not_evaluated";
  if (s.includes("discard") || s.includes("descart")) return "discarded";
  if (s.includes("context") || s.includes("contexto")) return "context";
  return (STATUSES.includes(s as ReasoningNodeStatus) ? s : fallback) as ReasoningNodeStatus;
}

function asKind(raw: any, fallback: ReasoningNodeKind = "sought_signs"): ReasoningNodeKind {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
  if (KIND_ALIASES[s]) return KIND_ALIASES[s];
  for (const [alias, kind] of Object.entries(KIND_ALIASES)) {
    if (s.includes(alias)) return kind;
  }
  return (NODE_KINDS.includes(s as ReasoningNodeKind) ? s : fallback) as ReasoningNodeKind;
}

function normalizeItems(raw: any): ReasoningSignItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any, idx: number) => ({
      label: String(it?.label || it?.name || it?.signo || it?.hallazgo || `Signo ${idx + 1}`).trim(),
      status: asStatus(it?.status || it?.estado, "present"),
      significance: String(
        it?.significance || it?.why || it?.importancia || it?.relevancia || ""
      ).trim(),
      evidence: it?.evidence || it?.evidencia
        ? String(it.evidence || it.evidencia).trim()
        : undefined,
    }))
    .filter((it: ReasoningSignItem) => it.label);
}

function pickNodesArray(raw: any): any[] {
  if (!raw || typeof raw !== "object") return [];
  const candidates = [
    raw.nodes,
    raw.nodos,
    raw.pasos,
    raw.steps,
    raw.chain,
    raw.cadena,
    raw.reasoningNodes,
    raw.reasoning_chain,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  if (raw.data && typeof raw.data === "object") {
    return pickNodesArray(raw.data);
  }
  return Array.isArray(raw.nodes) ? raw.nodes : [];
}

/** Normalize model JSON into a stable ReasoningChainData payload. */
export function normalizeReasoningChainData(raw: any): ReasoningChainData {
  const root = raw?.data && !raw?.nodes && !raw?.nodos ? raw.data : raw;
  const nodesIn = pickNodesArray(root);
  const nodes = nodesIn
    .map((n: any, idx: number) => {
      const kind = asKind(
        n?.kind || n?.tipo || n?.etapa,
        NODE_KINDS[Math.min(idx, NODE_KINDS.length - 1)]
      );
      const title = String(
        n?.title || n?.titulo || n?.name || reasoningKindLabel(kind) || `Paso ${idx + 1}`
      ).trim();
      const summary = String(
        n?.summary || n?.resumen || n?.description || n?.descripcion || ""
      ).trim();
      const items = normalizeItems(n?.items || n?.signos || n?.hallazgos || n?.details);
      return {
        id: String(n?.id || `node-${idx + 1}`),
        kind,
        title,
        summary,
        status: asStatus(
          n?.status || n?.estado,
          kind === "clinical_context" ? "context" : "present"
        ),
        items,
        clinicalLink: n?.clinicalLink || n?.clinica
          ? String(n.clinicalLink || n.clinica).trim()
          : undefined,
        labLink: n?.labLink || n?.laboratorio
          ? String(n.labLink || n.laboratorio).trim()
          : undefined,
      };
    })
    .filter((n: any) => n.title || n.summary || (n.items && n.items.length));

  const discardedRaw =
    root?.discardedDifferentials ||
    root?.diferencialesDescartados ||
    root?.discarded ||
    root?.descartes ||
    [];
  const discarded = Array.isArray(discardedRaw)
    ? discardedRaw
        .map((d: any) => ({
          name: String(d?.name || d?.nombre || d?.diagnosis || "").trim(),
          reason: String(d?.reason || d?.motivo || d?.why || "").trim(),
        }))
        .filter((d: { name: string; reason: string }) => d.name)
    : [];

  return {
    title: String(root?.title || root?.titulo || "Cadena de razonamiento radiológico").trim(),
    studyRegion: root?.studyRegion || root?.region
      ? String(root.studyRegion || root.region).trim()
      : undefined,
    workingDiagnosis: String(
      root?.workingDiagnosis || root?.diagnostico || root?.diagnosis || ""
    ).trim(),
    certaintyLabel: root?.certaintyLabel || root?.certeza
      ? String(root.certaintyLabel || root.certeza).trim()
      : undefined,
    clinicalContext: String(
      root?.clinicalContext || root?.contextoClinico || root?.contexto || ""
    ).trim(),
    nodes,
    discardedDifferentials: discarded,
    synthesis: String(root?.synthesis || root?.sintesis || "").trim(),
    managementSuggestion: root?.managementSuggestion || root?.conducta || root?.manejo
      ? String(root.managementSuggestion || root.conducta || root.manejo).trim()
      : undefined,
    generatedAt: root?.generatedAt ? String(root.generatedAt) : new Date().toISOString(),
  };
}

/** Extract JSON object from model text (fences / trailing prose). */
export function extractJsonObject(text: string): any | null {
  if (!text || typeof text !== "string") return null;
  let raw = text.trim();
  if (!raw) return null;

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) raw = fence[1].trim();

  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      try {
        const sanitized = slice.replace(/[\u0000-\u0019]+/g, " ");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  }
  return null;
}
