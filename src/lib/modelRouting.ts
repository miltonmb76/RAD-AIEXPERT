/**
 * Model preference + automatic per-task routing for RAD-AI Expert.
 *
 * Auto mode never uses Pro (avoids surprise cost/latency).
 * Manual mode forces the same model on every task.
 */

export type ModelPreference =
  | "auto"
  | "gemini-3.7-flash"
  | "gemini-3.8-flash"
  | "gemini-3.1-pro-preview";

export type ResolvedModelId =
  | "gemini-3.7-flash"
  | "gemini-3.8-flash"
  | "gemini-3.1-pro-preview";

export type ModelTask =
  | "report"
  | "report_modify"
  | "atlas3d"
  | "vascular3d"
  | "patient_summary"
  | "case_analysis"
  | "pathology"
  | "classifications"
  | "organ_synoptic"
  | "fractures"
  | "bibliography"
  | "quality_eval"
  | "operational_summary"
  | "labeling"
  | "glossary"
  | "schematic"
  | "measurements"
  | "footnotes"
  | "radar"
  | "clinical_scorecard"
  | "chat"
  | "default";

/** Quality-first tasks in auto mode → 3.8 Flash */
const QUALITY_TASKS: ReadonlySet<ModelTask> = new Set([
  "report",
  "report_modify",
  "atlas3d",
  "vascular3d",
  "patient_summary",
  "case_analysis",
  "pathology",
  "classifications",
  "organ_synoptic",
  "fractures",
  "radar",
  "clinical_scorecard",
  "default",
]);

/** Volume / short tasks in auto mode → 3.7 Flash */
const EFFICIENCY_TASKS: ReadonlySet<ModelTask> = new Set([
  "bibliography",
  "quality_eval",
  "operational_summary",
  "labeling",
  "glossary",
  "schematic",
  "measurements",
  "footnotes",
  "chat",
]);

export const MODEL_OPTIONS: Array<{
  id: ModelPreference;
  shortLabel: string;
  label: string;
  description: string;
}> = [
  {
    id: "auto",
    shortLabel: "Auto",
    label: "Automático (recomendado)",
    description: "Asigna 3.8 a tareas clínicas clave y 3.7 a volumen (rotulado, resúmenes cortos). Pro solo si lo eliges manualmente.",
  },
  {
    id: "gemini-3.8-flash",
    shortLabel: "Flash 3.8",
    label: "Gemini 3.8 Flash",
    description: "Mejor razonamiento Flash. Ideal si quieres máxima calidad Flash en todo.",
  },
  {
    id: "gemini-3.7-flash",
    shortLabel: "Flash 3.7",
    label: "Gemini 3.7 Flash",
    description: "Más rápido y eficiente. Ideal para agenda cargada y rotulado masivo.",
  },
  {
    id: "gemini-3.1-pro-preview",
    shortLabel: "Pro 3.1",
    label: "Gemini 3.1 Pro",
    description: "Máximo rigor en casos difíciles. Más lento y costoso; úsalo a demanda.",
  },
];

export function normalizeModelPreference(raw?: string | null): ModelPreference {
  if (!raw) return "auto";
  if (raw === "auto") return "auto";
  if (raw === "gemini-3.8-flash") return "gemini-3.8-flash";
  if (raw === "gemini-3.1-pro-preview" || raw === "gemini-3.1-pro") {
    return "gemini-3.1-pro-preview";
  }
  // Migrate legacy flash defaults to auto (smart routing)
  if (
    raw === "gemini-3.7-flash" ||
    raw === "gemini-3.6-flash" ||
    raw === "gemini-2.5-flash" ||
    raw === "gemini-1.5-flash"
  ) {
    // Keep explicit 3.7 if user had it saved as intentional choice after we introduce auto.
    // First-time / legacy flash → auto.
    if (raw === "gemini-3.7-flash") return "gemini-3.7-flash";
    return "auto";
  }
  return "auto";
}

export function resolveModelForTask(
  preference: string | null | undefined,
  task: ModelTask = "default"
): ResolvedModelId {
  const pref = normalizeModelPreference(preference);

  if (pref !== "auto") {
    return pref;
  }

  if (EFFICIENCY_TASKS.has(task)) {
    return "gemini-3.7-flash";
  }
  if (QUALITY_TASKS.has(task)) {
    return "gemini-3.8-flash";
  }
  return "gemini-3.8-flash";
}

export function describeActiveRouting(preference: string | null | undefined): string {
  const pref = normalizeModelPreference(preference);
  if (pref === "auto") return "Auto: 3.8 calidad · 3.7 volumen";
  if (pref === "gemini-3.8-flash") return "Flash 3.8 fijo";
  if (pref === "gemini-3.7-flash") return "Flash 3.7 fijo";
  return "Pro 3.1 fijo";
}
