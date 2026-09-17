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

const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "y",
  "o",
  "a",
  "al",
  "un",
  "una",
  "uno",
  "con",
  "sin",
  "por",
  "para",
  "que",
  "se",
  "su",
  "sus",
  "no",
  "ni",
  "the",
  "of",
  "and",
]);

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
      return "cuerpo del informe";
    case "impression":
      return "impresión";
    case "negativity_block":
      return "cuerpo del informe";
    default:
      return "cuerpo del informe";
  }
}

function asStatus(raw: any): NegativityItemStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    s.includes("pending") ||
    s.includes("pendiente") ||
    s.includes("not_mention") ||
    s.includes("no_mencion") ||
    s.includes("not_evaluated") ||
    s.includes("no_evaluad")
  ) {
    return "pending_closure";
  }
  if (
    s.includes("limited") ||
    s.includes("tecnic") ||
    s.includes("technical") ||
    s.includes("limitad")
  ) {
    return "limited_technical";
  }
  if (
    s.includes("positive") ||
    s.includes("positiv") ||
    s.includes("present") ||
    s === "hallazgo"
  ) {
    return "positive";
  }
  if (
    s.includes("negative") ||
    s.includes("negativ") ||
    s.includes("absent") ||
    s.includes("ausente")
  ) {
    return "negative";
  }
  return "pending_closure";
}

function asTarget(raw: any): NegativityInsertTarget {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s.includes("impression") || s.includes("impres")) return "impression";
  // negativity_block is legacy; always treat as findings body integration
  return "findings";
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
      closureSummary: `Checklist incompleto: ${open} ítem(s) pendiente(s) de mención en la descripción. Negativos ${negative}, positivos ${positive}, limitados técnicos ${limited}.`,
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

function normalizeKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function signKeywords(sign?: string): string[] {
  const parts = normalizeKey(sign || "")
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  // Prefer longer tokens first for matching
  return [...new Set(parts)].sort((a, b) => b.length - a.length);
}

/** Build a patient-facing synopsis of discarded (negative) findings. */
export function buildDiscardedFindingsSynopsis(
  items: NegativityChecklistItem[],
  existing?: string
): string {
  const fromApi = String(existing || "").trim();
  if (fromApi && !/insert|acci[oó]n|automat/i.test(fromApi)) {
    return fromApi;
  }
  const discarded = (items || []).filter((i) => i.status === "negative");
  if (!discarded.length) {
    const limited = (items || []).filter((i) => i.status === "limited_technical");
    if (limited.length) {
      return `No se documentaron negatividades dirigidas adicionales; ${limited.length} ítem(s) con limitación técnica.`;
    }
    return "Sin hallazgos descartados documentados en este checklist.";
  }
  const names = discarded.map((i) => {
    const side = i.laterality ? ` (${i.laterality})` : "";
    return `${i.sign}${side}`;
  });
  if (names.length === 1) {
    return `Se descartó de forma dirigida: ${names[0]}.`;
  }
  if (names.length <= 6) {
    const last = names[names.length - 1];
    const head = names.slice(0, -1).join("; ");
    return `Hallazgos descartados de forma dirigida: ${head}; y ${last}.`;
  }
  return `Hallazgos descartados de forma dirigida (${names.length}): ${names.slice(0, 5).join("; ")}; entre otros.`;
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

  const withInserts = items.map((it) => {
    if (it.status === "pending_closure" && !it.suggestedInsert) {
      const side = it.laterality ? ` (${it.laterality})` : "";
      return {
        ...it,
        suggestedInsert: `No se identifican hallazgos de ${it.sign.toLowerCase()}${side}.`,
        insertTarget: "findings" as NegativityInsertTarget,
      };
    }
    return { ...it, insertTarget: it.insertTarget || ("findings" as NegativityInsertTarget) };
  });

  const { openGapsCount, closureSummary } = recomputeClosure(withInserts);
  const technicalGaps = Array.isArray(root.technicalGaps)
    ? root.technicalGaps.map((g: any) => String(g || "").trim()).filter(Boolean)
    : withInserts
        .filter((i) => i.status === "limited_technical" && i.technicalReason)
        .map((i) => `${i.sign}: ${i.technicalReason}`);

  const discardedSynopsis = buildDiscardedFindingsSynopsis(
    withInserts,
    root.discardedSynopsis || root.recommendation
  );

  return {
    title: String(root.title || "Checklist de negatividad dirigida").trim(),
    protocolName: String(root.protocolName || root.protocol || "").trim() || undefined,
    studyRegion: String(root.studyRegion || root.territory || "").trim() || undefined,
    laterality: String(root.laterality || "").trim() || undefined,
    closureSummary: String(root.closureSummary || "").trim() || closureSummary,
    openGapsCount: typeof root.openGapsCount === "number" ? root.openGapsCount : openGapsCount,
    items: withInserts,
    technicalGaps,
    discardedSynopsis,
    recommendation: discardedSynopsis,
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
  const discardedSynopsis = buildDiscardedFindingsSynopsis(data.items || [], data.discardedSynopsis);
  return {
    ...data,
    openGapsCount,
    closureSummary,
    technicalGaps,
    discardedSynopsis,
    recommendation: discardedSynopsis,
  };
}

function findSectionBounds(text: string): { findingsStart: number; findingsEnd: number } {
  const impress = text.search(/\n\s*(IMPRESI[OÓ]N|CONCLUSI[OÓ]N|OPINI[OÓ]N)\s*:/i);
  const findingsHeader = text.search(
    /\n\s*(HALLAZGOS|DESCRIPCI[OÓ]N|EXPLORACI[OÓ]N|T[EÉ]CNICA\s+Y\s+HALLAZGOS)\s*:/i
  );
  let findingsStart = 0;
  if (findingsHeader >= 0) {
    const nl = text.indexOf("\n", findingsHeader + 1);
    findingsStart = nl >= 0 ? nl + 1 : findingsHeader;
  }
  const findingsEnd = impress >= 0 ? impress : text.length;
  if (findingsStart >= findingsEnd) {
    return { findingsStart: 0, findingsEnd: impress >= 0 ? impress : text.length };
  }
  return { findingsStart, findingsEnd };
}

/**
 * Insert a directed-negativity sentence into the descriptive body of the report,
 * near related anatomy when possible. Never creates a separate "NEGATIVIDADES" block
 * and never leaves patient-visible markers of automated insertion.
 */
export function insertNegativityIntoReport(
  reportText: string,
  snippet: string,
  target: NegativityInsertTarget = "findings",
  sign?: string
): string {
  const text = String(reportText || "");
  let piece = String(snippet || "").trim();
  if (!piece) return text;
  // Strip leading list bullets — body prose should read naturally
  piece = piece.replace(/^[-•*]\s+/, "").trim();
  if (!/[.!?…]$/.test(piece)) piece = `${piece}.`;

  const norm = (s: string) => normalizeKey(s);
  const nPiece = norm(piece);
  if (nPiece && norm(text).includes(nPiece.slice(0, Math.min(80, nPiece.length)))) {
    return text;
  }

  if (target === "impression") {
    const impress = text.search(/\n\s*(IMPRESI[OÓ]N|CONCLUSI[OÓ]N|OPINI[OÓ]N)\s*:/i);
    if (impress >= 0) {
      const after = text.indexOf("\n", impress + 1);
      const at = after >= 0 ? after + 1 : impress;
      const before = text.slice(0, at).replace(/\s*$/, "");
      const rest = text.slice(at).replace(/^\s*/, "");
      return `${before}\n${piece}\n${rest}`;
    }
    const spacing = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : text ? "\n\n" : "";
    return `${text}${spacing}${piece}`;
  }

  // Default: weave into findings/description body
  const { findingsStart, findingsEnd } = findSectionBounds(text);
  const body = text.slice(findingsStart, findingsEnd);
  const keywords = signKeywords(sign);

  let bestIdx = -1;
  let bestScore = 0;
  if (keywords.length && body) {
    const lowerBody = normalizeKey(body);
    // Score by sentence / paragraph chunks
    const chunks: { start: number; end: number; text: string }[] = [];
    const re = /[^.!?\n]+[.!?]?|\n+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const chunk = m[0];
      if (!chunk.trim() || /^\n+$/.test(chunk)) continue;
      chunks.push({ start: m.index, end: m.index + chunk.length, text: chunk });
    }
    for (const chunk of chunks) {
      const nChunk = normalizeKey(chunk.text);
      let score = 0;
      for (const kw of keywords) {
        if (nChunk.includes(kw)) score += kw.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = chunk.end;
      }
    }
    // Also try whole-body keyword hit if no sentence scored
    if (bestScore === 0) {
      for (const kw of keywords) {
        const at = lowerBody.indexOf(kw);
        if (at >= 0) {
          // insert after end of that line/sentence
          const abs = at;
          const afterSentence = body.slice(abs).search(/[.!?\n]/);
          bestIdx = afterSentence >= 0 ? abs + afterSentence + 1 : body.length;
          bestScore = kw.length;
          break;
        }
      }
    }
  }

  if (bestIdx >= 0 && bestScore > 0) {
    const abs = findingsStart + bestIdx;
    const before = text.slice(0, abs).replace(/[ \t]*$/, "");
    const after = text.slice(abs).replace(/^[ \t]*/, "");
    const needsSpaceBefore = before.length > 0 && !/[\n]$/.test(before);
    const glue = needsSpaceBefore ? (/\n$/.test(before) ? "" : " ") : "";
    // Prefer new sentence on same paragraph when mid-body; newline if at paragraph end
    const atParaEnd = /\n\s*$/.test(before) || /^\n/.test(after);
    if (atParaEnd) {
      const b = before.replace(/\s*$/, "");
      const a = after.replace(/^\s*/, "");
      return `${b}\n${piece}${a ? `\n${a}` : ""}`;
    }
    return `${before}${glue}${piece}${/^\s/.test(after) || !after ? "" : " "}${after}`;
  }

  // Fallback: append inside findings section (before impression), as prose — no special header
  if (findingsEnd < text.length) {
    const before = text.slice(0, findingsEnd).replace(/\s*$/, "");
    const after = text.slice(findingsEnd);
    return `${before}\n${piece}\n\n${after.replace(/^\s+/, "")}`;
  }
  const spacing = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : text ? "\n\n" : "";
  return `${text}${spacing}${piece}`;
}

export { STATUSES as NEGATIVITY_STATUSES, TARGETS as NEGATIVITY_TARGETS };
