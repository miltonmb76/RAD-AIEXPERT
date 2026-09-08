import type {
  DifferentialBranch,
  DifferentialBranchStatus,
  DifferentialCriterion,
  DifferentialTreeData,
} from "../types";
import { extractJsonObject } from "./reasoningChain";

const STATUSES: DifferentialBranchStatus[] = ["leading", "active", "pruned"];

export function differentialStatusLabel(status?: string): string {
  switch (status) {
    case "leading":
      return "Más probable";
    case "active":
      return "En consideración";
    case "pruned":
      return "Podado / descartado";
    default:
      return status || "";
  }
}

function asStatus(raw: any, fallback: DifferentialBranchStatus = "active"): DifferentialBranchStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("lead") || s.includes("principal") || s.includes("probable") || s.includes("winner")) {
    return "leading";
  }
  if (s.includes("prun") || s.includes("descart") || s.includes("podad") || s.includes("exclu")) {
    return "pruned";
  }
  if (s.includes("active") || s.includes("activo") || s.includes("consider")) {
    return "active";
  }
  return (STATUSES.includes(s as DifferentialBranchStatus) ? s : fallback) as DifferentialBranchStatus;
}

function normalizeCriteria(raw: any, polarity: "for" | "against"): DifferentialCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => {
      if (typeof c === "string") {
        return { label: c.trim(), polarity, evidence: undefined as string | undefined };
      }
      const label = String(c?.label || c?.criterion || c?.texto || c?.name || "").trim();
      return {
        label,
        polarity,
        evidence: c?.evidence || c?.evidencia ? String(c.evidence || c.evidencia).trim() : undefined,
      };
    })
    .filter((c: DifferentialCriterion) => c.label);
}

function pickBranches(raw: any): any[] {
  if (!raw || typeof raw !== "object") return [];
  const candidates = [
    raw.branches,
    raw.ramas,
    raw.diferenciales,
    raw.differentials,
    raw.hypotheses,
    raw.hipotesis,
    raw.nodes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  if (raw.data && typeof raw.data === "object") return pickBranches(raw.data);
  return [];
}

export function normalizeDifferentialTreeData(raw: any): DifferentialTreeData {
  const root = raw?.data && !raw?.branches && !raw?.ramas ? raw.data : raw;
  let branches: DifferentialBranch[] = pickBranches(root).map((b: any, idx: number) => {
    const status = asStatus(b?.status || b?.estado || b?.fate, idx === 0 ? "leading" : "active");
    const criteriaFor = normalizeCriteria(
      b?.criteriaFor || b?.aFavor || b?.supporting || b?.favor,
      "for"
    );
    const criteriaAgainst = normalizeCriteria(
      b?.criteriaAgainst || b?.enContra || b?.refuting || b?.contra,
      "against"
    );
    return {
      id: String(b?.id || `dx-${idx + 1}`),
      name: String(b?.name || b?.nombre || b?.diagnosis || b?.hipotesis || `Hipótesis ${idx + 1}`).trim(),
      status,
      certaintyLabel: b?.certaintyLabel || b?.certeza
        ? String(b.certaintyLabel || b.certeza).trim()
        : undefined,
      summary: String(b?.summary || b?.resumen || b?.rationale || "").trim(),
      criteriaFor,
      criteriaAgainst,
      pruneReason: b?.pruneReason || b?.motivoPoda || b?.motivo
        ? String(b.pruneReason || b.motivoPoda || b.motivo).trim()
        : undefined,
      confirmatoryTest: b?.confirmatoryTest || b?.pruebaConfirmatoria
        ? String(b.confirmatoryTest || b.pruebaConfirmatoria).trim()
        : undefined,
    };
  }).filter((b: DifferentialBranch) => b.name);

  // Ensure exactly one leading if any non-pruned exist
  const leadingCount = branches.filter((b) => b.status === "leading").length;
  if (leadingCount === 0 && branches.length) {
    const firstAlive = branches.find((b) => b.status !== "pruned") || branches[0];
    branches = branches.map((b) =>
      b.id === firstAlive.id ? { ...b, status: "leading" as const } : b
    );
  } else if (leadingCount > 1) {
    let kept = false;
    branches = branches.map((b) => {
      if (b.status !== "leading") return b;
      if (!kept) {
        kept = true;
        return b;
      }
      return { ...b, status: "active" as const };
    });
  }

  // Pruned branches should have a reason
  branches = branches.map((b) => {
    if (b.status === "pruned" && !b.pruneReason) {
      const against = b.criteriaAgainst.map((c) => c.label).filter(Boolean).slice(0, 2).join("; ");
      return {
        ...b,
        pruneReason: against || "Incompatible con los hallazgos del informe.",
      };
    }
    return b;
  });

  const leading = branches.find((b) => b.status === "leading");

  return {
    title: String(root?.title || root?.titulo || "Árbol de diferenciales con poda").trim(),
    studyRegion: root?.studyRegion || root?.region
      ? String(root.studyRegion || root.region).trim()
      : undefined,
    clinicalQuestion: String(
      root?.clinicalQuestion || root?.preguntaClinica || root?.question || ""
    ).trim(),
    leadingDiagnosis: String(
      root?.leadingDiagnosis || root?.diagnosticoPrincipal || leading?.name || ""
    ).trim(),
    certaintyLabel: root?.certaintyLabel || root?.certeza
      ? String(root.certaintyLabel || root.certeza).trim()
      : leading?.certaintyLabel,
    branches,
    pruningNarrative: String(
      root?.pruningNarrative || root?.narrativaPoda || root?.pruning || ""
    ).trim(),
    synthesis: String(root?.synthesis || root?.sintesis || "").trim(),
    managementSuggestion: root?.managementSuggestion || root?.conducta || root?.manejo
      ? String(root.managementSuggestion || root.conducta || root.manejo).trim()
      : undefined,
    generatedAt: root?.generatedAt ? String(root.generatedAt) : new Date().toISOString(),
  };
}

export { extractJsonObject };
