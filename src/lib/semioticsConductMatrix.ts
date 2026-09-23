import type { SemioticsConductMatrixData, SemioticsConductRow } from "../types";

export const SEMIOTICS_FOCUS_PRESETS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (del informe)" },
  { id: "apendicitis", label: "Apendicitis / abdomen agudo" },
  { id: "colecistitis", label: "Colecistitis / vías biliares" },
  { id: "nodulo_pulmonar", label: "Nódulo pulmonar (Fleischner)" },
  { id: "mama_birads", label: "Mama (BI-RADS)" },
  { id: "tiroides_tirads", label: "Tiroides (TI-RADS)" },
  { id: "bosniak", label: "Quiste renal (Bosniak)" },
  { id: "vascular", label: "Vascular / estenosis / TVP" },
  { id: "msk", label: "MSK / fascitis / tendón" },
  { id: "custom", label: "Otro (escribir abajo)" },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptySemioticsRow(): SemioticsConductRow {
  return {
    id: newId("scm-row"),
    finding: "",
    signs: "",
    category: "",
    conduct: "",
    anchor: "",
  };
}

export function normalizeSemioticsConductMatrixData(
  raw: any,
  focusFallback = ""
): SemioticsConductMatrixData {
  const rowsIn = Array.isArray(raw?.rows)
    ? raw.rows
    : Array.isArray(raw?.filas)
      ? raw.filas
      : [];
  const rows: SemioticsConductRow[] = rowsIn
    .map((r: any, idx: number) => ({
      id: String(r?.id || `scm-${idx + 1}`),
      finding: String(r?.finding || "").trim(),
      signs: String(r?.signs || r?.criteria || "").trim(),
      category: String(r?.category || r?.scaleCategory || "").trim(),
      conduct: String(r?.conduct || r?.recommendation || "").trim(),
      anchor: String(r?.anchor || "").trim(),
    }))
    .filter((r: SemioticsConductRow) => r.finding || r.signs || r.category || r.conduct);

  return {
    title: String(raw?.title || "Matriz semiología → conducta").trim(),
    focusTopic: String(raw?.focusTopic || focusFallback || "").trim(),
    studyRegion: String(raw?.studyRegion || "").trim() || undefined,
    clinicalQuestion: String(raw?.clinicalQuestion || "").trim() || undefined,
    rows: rows.length ? rows : [emptySemioticsRow()],
    footnote: undefined,
    generatedAt: String(raw?.generatedAt || new Date().toISOString()),
  };
}

export function resolveFocusLabel(
  presetId: string,
  customText: string
): string {
  if (presetId === "custom" || presetId === "auto") {
    return customText.trim() || (presetId === "auto" ? "Auto (del informe)" : "");
  }
  const hit = SEMIOTICS_FOCUS_PRESETS.find((p) => p.id === presetId);
  return customText.trim() || hit?.label || presetId;
}
