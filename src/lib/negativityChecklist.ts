import type {
  NegativityChecklistData,
  NegativityChecklistItem,
  NegativityInsertTarget,
  NegativityItemStatus,
} from "../types";

const STATUSES: NegativityItemStatus[] = [
  "negative",
  "positive",
  "limited_technical",
  "pending_closure",
];

const TARGETS: NegativityInsertTarget[] = [
  "findings",
  "negativity_block",
  "impression",
];

export function negativityStatusLabel(status?: string): string {
  switch (status) {
    case "negative":
      return "Negativo dirigido";
    case "positive":
      return "Positivo";
    case "limited_technical":
      return "Limitado técnico";
    case "pending_closure":
      return "Pendiente de cierre";
    default:
      return status || "";
  }
}

export function negativityInsertTargetLabel(target?: string): string {
  switch (target) {
    case "findings":
      return "Hallazgos";
    case "impression":
      return "Impresión";
    case "negativity_block":
      return "Bloque de negatividades";
    default:
      return "Reporte";
  }
}

function asStatus(raw: any): NegativityItemStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("pending") || s.includes("pendiente") || s.includes("not_mention") || s.includes("no_mencion") || s.includes("not_evaluated") || s.includes("no_evaluad")) {
    return "pending_closure";
  }
  if (s.includes("limited") || s.includes("tecnic") || s.includes("technical") || s.includes("limitad")) {
    return "limited_technical";
  }
  if (s.includes("positive") || s.includes("positiv") || s.includes("present") || s === "hallazgo") {
    return "positive";
  }
  if (s.includes("negative") || s.includes("negativ") || s.includes("absent") || s.includes("ausente")) {
    return "negative";
  }
  return "pending_closure";
}

function asTarget(raw: any): NegativityInsertTarget {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s.includes("impression") || s.includes("impres")) return "impression";
  if (s.includes("finding") || s.includes("hallaz")) return "findings";
  return "negativity_block";
}

function recomputeClosure(items: NegativityChecklistItem[]): {
  openGapsCount: number;
  closureSummary: string;
} {
  const open = items.filter((i) => i.status === "pending_closure").length;
  const limited = items.filter((i) => i.status === "limited_technical").length;
  const negative = items.filter((i) => i.status === "negative").length;
  const positive = items.filter((i) => i.status === "positive").length;
  if (open > 0) {
    return {
      openGapsCount: open,
      closureSummary: `Checklist incompleto: ${open} ítem(s) pendiente(s) de cierre (deben insertarse al reporte o documentarse como limitación técnica). Negativos ${negative}, positivos ${positive}, limitados técnicos ${limited}.`,
    };
  }
  if (limited > 0) {
    return {
      openGapsCount: 0,
      closureSummary: `Checklist cerrado con limitaciones técnicas (${limited}). Negativos dirigidos ${negative}; positivos ${positive}.`,
    };
  }
  return {
    openGapsCount: 0,
    closureSummary: `Checklist cerrado: ${items.length}/${items.length} ítems sin pendientes. Negativos dirigidos ${negative}; positivos ${positive}.`,
  };
}

/** Normalize model JSON into a stable NegativityChecklistData payload. */
export function normalizeNegativityChecklistData(raw: any): NegativityChecklistData {
  const root = raw?.data && typeof raw.data === "object" ? raw.data : raw || {};
  const itemsRaw = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.checklist)
      ? root.checklist
      : Array.isArray(root.signs)
        ? root.signs
        : [];

  const items: NegativityChecklistItem[] = itemsRaw.slice(0, 16).map((it: any, idx: number) => {
    const status = asStatus(it?.status);
    const technicalReason = String(it?.technicalReason || it?.limitation || "").trim();
    const suggestedInsert = String(it?.suggestedInsert || it?.insertText || "").trim();
    return {
      id: String(it?.id || `neg-${idx + 1}`),
      sign: String(it?.sign || it?.structureOrSign || it?.label || `Signo ${idx + 1}`).trim(),
      laterality: String(it?.laterality || it?.side || "").trim() || undefined,
      status:
        status === "limited_technical" && !technicalReason ? "pending_closure" : status,
      whyItMatters: String(it?.whyItMatters || it?.significance || it?.relevance || "").trim(),
      evidence: String(it?.evidence || "").trim() || undefined,
      technicalReason: technicalReason || undefined,
      suggestedInsert: suggestedInsert || undefined,
      insertTarget: asTarget(it?.insertTarget),
      inserted: it?.inserted === true,
      insertedAt: it?.insertedAt ? String(it.insertedAt) : undefined,
      confidence: (["alta", "media", "baja"].includes(String(it?.confidence || "").toLowerCase())
        ? String(it.confidence).toLowerCase()
        : "media") as "alta" | "media" | "baja",
    };
  });

  // Promote pending with empty suggestedInsert to still pending but ensure insert text scaffold
  const withInserts = items.map((it) => {
    if (it.status === "pending_closure" && !it.suggestedInsert) {
      const side = it.laterality ? ` (${it.laterality})` : "";
      return {
        ...it,
        suggestedInsert: `No se identifican alteraciones relativas a ${it.sign}${side} en la exploración realizada.`,
        insertTarget: it.insertTarget || "negativity_block",
      };
    }
    return it;
  });

  const { openGapsCount, closureSummary } = recomputeClosure(withInserts);
  const technicalGaps = Array.isArray(root.technicalGaps)
    ? root.technicalGaps.map((g: any) => String(g || "").trim()).filter(Boolean)
    : withInserts
        .filter((i) => i.status === "limited_technical" && i.technicalReason)
        .map((i) => `${i.sign}: ${i.technicalReason}`);

  return {
    title: String(root.title || "Checklist de negatividad dirigida").trim(),
    protocolName: String(root.protocolName || root.protocol || "").trim() || undefined,
    studyRegion: String(root.studyRegion || root.territory || "").trim() || undefined,
    laterality: String(root.laterality || "").trim() || undefined,
    closureSummary: String(root.closureSummary || "").trim() || closureSummary,
    openGapsCount: typeof root.openGapsCount === "number" ? root.openGapsCount : openGapsCount,
    items: withInserts,
    technicalGaps,
    recommendation: String(root.recommendation || "").trim() || undefined,
    generatedAt: String(root.generatedAt || new Date().toISOString()),
  };
}

/** Recompute closure fields after local status edits. */
export function refreshNegativityChecklistClosure(
  data: NegativityChecklistData
): NegativityChecklistData {
  const { openGapsCount, closureSummary } = recomputeClosure(data.items || []);
  const technicalGaps = (data.items || [])
    .filter((i) => i.status === "limited_technical" && i.technicalReason)
    .map((i) => `${i.sign}: ${i.technicalReason}`);
  return {
    ...data,
    openGapsCount,
    closureSummary,
    technicalGaps,
  };
}

/**
 * Intelligently merge a negativity sentence into the report text.
 * Prefers a dedicated "NEGATIVIDADES DIRIGIDAS" block; avoids duplicates.
 */
export function insertNegativityIntoReport(
  reportText: string,
  snippet: string,
  target: NegativityInsertTarget = "negativity_block"
): string {
  const text = String(reportText || "");
  const piece = String(snippet || "").trim();
  if (!piece) return text;

  // Duplicate guard (normalize accents lightly)
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  if (norm(text).includes(norm(piece).slice(0, Math.min(80, norm(piece).length)))) {
    return text;
  }

  const HEADER = "NEGATIVIDADES DIRIGIDAS:";
  if (target === "negativity_block" || target === "findings") {
    const idx = text.toUpperCase().indexOf("NEGATIVIDADES DIRIGIDAS");
    if (idx >= 0) {
      // Append after existing block header section (before next ALL-CAPS header if any)
      const afterHeader = text.indexOf("\n", idx);
      const start = afterHeader >= 0 ? afterHeader + 1 : idx + HEADER.length;
      const rest = text.slice(start);
      const nextHeaderMatch = rest.search(/\n[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9 /-]{6,}:\s*\n/);
      if (nextHeaderMatch >= 0) {
        const insertAt = start + nextHeaderMatch;
        const before = text.slice(0, insertAt).replace(/\s*$/, "");
        const after = text.slice(insertAt);
        return `${before}\n- ${piece}\n${after}`;
      }
      const spacing = text.endsWith("\n") ? "" : "\n";
      return `${text}${spacing}- ${piece}`;
    }
    const spacing = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : text ? "\n\n" : "";
    return `${text}${spacing}${HEADER}\n- ${piece}`;
  }

  // impression: append near end under IMPRESIÓN / CONCLUSIÓN if present
  const impress = text.search(/\n\s*(IMPRESI[OÓ]N|CONCLUSI[OÓ]N|OPINI[OÓ]N)\s*:/i);
  if (impress >= 0) {
    const after = text.indexOf("\n", impress + 1);
    const at = after >= 0 ? after + 1 : impress;
    const before = text.slice(0, at);
    const rest = text.slice(at);
    return `${before}${piece}\n${rest}`;
  }
  const spacing = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : text ? "\n\n" : "";
  return `${text}${spacing}${piece}`;
}

export { STATUSES as NEGATIVITY_STATUSES, TARGETS as NEGATIVITY_TARGETS };
