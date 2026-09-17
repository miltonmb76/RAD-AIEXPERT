import type {
  SecondReaderAddition,
  SecondReaderData,
  SecondReaderInsertTarget,
  SecondReaderObjection,
  SecondReaderSeverity,
  SecondReaderSustain,
} from "../types";

function asSeverity(raw: any): SecondReaderSeverity {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("alta") || s.includes("high") || s.includes("crit")) return "alta";
  if (s.includes("baja") || s.includes("low") || s.includes("menor")) return "baja";
  return "media";
}

function asTarget(raw: any): SecondReaderInsertTarget {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s.includes("impression") || s.includes("impres") || s.includes("conclu")) return "impression";
  return "findings";
}

export function secondReaderSeverityLabel(severity?: string): string {
  switch (severity) {
    case "alta":
      return "Alta";
    case "baja":
      return "Baja";
    default:
      return "Media";
  }
}

export function secondReaderTargetLabel(target?: string): string {
  return target === "impression" ? "Impresión" : "Hallazgos / descripción";
}

export function normalizeSecondReaderData(raw: any): SecondReaderData {
  const root = raw?.data && typeof raw.data === "object" ? raw.data : raw || {};

  const objectionsRaw = Array.isArray(root.objections)
    ? root.objections
    : Array.isArray(root.challenges)
      ? root.challenges
      : [];
  const sustainRaw = Array.isArray(root.sustain)
    ? root.sustain
    : Array.isArray(root.keep)
      ? root.keep
      : Array.isArray(root.toSustain)
        ? root.toSustain
        : [];
  const additionsRaw = Array.isArray(root.additions)
    ? root.additions
    : Array.isArray(root.suggestions)
      ? root.suggestions
      : Array.isArray(root.toAdd)
        ? root.toAdd
        : [];

  const objections: SecondReaderObjection[] = objectionsRaw.slice(0, 10).map((it: any, idx: number) => ({
    id: String(it?.id || `obj-${idx + 1}`),
    severity: asSeverity(it?.severity),
    claim: String(it?.claim || it?.topic || it?.target || "").trim() || `Punto ${idx + 1}`,
    objection: String(it?.objection || it?.challenge || it?.reason || "").trim(),
    evidenceGap: String(it?.evidenceGap || it?.gap || "").trim() || undefined,
  }));

  const sustain: SecondReaderSustain[] = sustainRaw.slice(0, 10).map((it: any, idx: number) => ({
    id: String(it?.id || `sus-${idx + 1}`),
    statement: String(it?.statement || it?.claim || it?.text || "").trim() || `Afirmación ${idx + 1}`,
    why: String(it?.why || it?.rationale || it?.reason || "").trim(),
  }));

  const additions: SecondReaderAddition[] = additionsRaw.slice(0, 12).map((it: any, idx: number) => {
    const suggestedText = String(
      it?.suggestedText || it?.insertText || it?.text || it?.prose || ""
    ).trim();
    return {
      id: String(it?.id || `add-${idx + 1}`),
      title: String(it?.title || it?.label || it?.sign || `Sugerencia ${idx + 1}`).trim(),
      reason: String(it?.reason || it?.why || it?.rationale || "").trim(),
      suggestedText:
        suggestedText ||
        `Incluir mención dirigida de ${String(it?.title || "el hallazgo pendiente").toLowerCase()}.`,
      insertTarget: asTarget(it?.insertTarget || it?.target),
      incorporated: it?.incorporated === true,
    };
  });

  return {
    title: String(root.title || "Segundo lector simulado").trim(),
    overallStance: String(root.overallStance || root.stance || "").trim(),
    objections,
    sustain,
    additions,
    reviewSummary: String(root.reviewSummary || root.summary || "").trim(),
    generatedAt: String(root.generatedAt || new Date().toISOString()),
  };
}
