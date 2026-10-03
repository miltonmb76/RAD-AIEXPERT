import { ClinicalScorecardData, SuiteImageAnnotation } from "../types";
import {
  suggestAbdomenImageAnnotations,
  suggestFromTableRows,
  withSuggestedImageAnnotations,
} from "./suiteImageAnnotations";
import {
  ABDOMEN_TOPOGRAPHY_DIRECTIVE,
  KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
  ANKLE_LIGAMENT_TOPOGRAPHY_DIRECTIVE,
  KIDNEY_URINARY_TOPOGRAPHY_DIRECTIVE,
  ABDOMINAL_WALL_TOPOGRAPHY_DIRECTIVE,
  SCROTUM_TOPOGRAPHY_DIRECTIVE,
  MUSCLE_TENDON_TOPOGRAPHY_DIRECTIVE,
  WRIST_TOPOGRAPHY_DIRECTIVE,
  buildAbdomenDirectivesFromScorecard,
  buildKneeDirectivesFromScorecard,
  buildShoulderDirectivesFromScorecard,
  buildAnkleDirectivesFromScorecard,
  buildKidneyDirectivesFromScorecard,
  buildThyroidDirectivesFromScorecard,
  buildBreastDirectivesFromScorecard,
  buildAbdominalWallDirectivesFromScorecard,
  buildScrotumDirectivesFromScorecard,
  buildMuscleTendonDirectivesFromScorecard,
  buildWristDirectivesFromScorecard,
  buildVascularDirectivesFromScorecard,
} from "./clinicalIntelligence";

/** Minimal panel shape shared by organ suites. */
export interface OrganSuitePanel {
  id?: string;
  panelLetter: string;
  panelTitle: string;
  anatomicalFocus: string;
  laterality?: string;
  imageUrl?: string;
  isCustomFlipped?: boolean;
  [key: string]: unknown;
}

/** Flexible suite payload — organ-specific summary fields live as string keys. */
export interface OrganSuiteData {
  territoryLabel?: string;
  laterality?: string;
  figureTitle?: string;
  tableTitle?: string;
  tableHeaders?: Record<string, string | undefined>;
  panels: OrganSuitePanel[];
  imageAnnotations?: SuiteImageAnnotation[];
  morphologyNotes?: string;
  keyPoints?: string[];
  synthesisTitle?: string;
  morphologicalSynthesis?: string;
  [key: string]: unknown;
}

export type OrganSuiteAccent =
  | "amber"
  | "sky"
  | "teal"
  | "pink"
  | "lime"
  | "indigo"
  | "rose"
  | "violet"
  | "cyan"
  | "orange";

export interface OrganSuiteStudyTypeOption {
  value: string;
  label: string;
}

export interface OrganSuiteRegenPreset {
  label: string;
  directive: string;
  className: string;
}

export interface OrganSuiteTheme {
  border: string;
  headerGrad: string;
  iconBox: string;
  icon: string;
  badge: string;
  subtitle: string;
  accentIcon: string;
  focusRing: string;
  scoreBadge: string;
  scoreHint: string;
  btnGrad: string;
  panelBadge: string;
  regenBtn: string;
  regenIdle: string;
  editLink: string;
  suggestBtn: string;
  fichaBorder: string;
  fichaGrad: string;
  fichaEyebrow: string;
  summaryBorder: string;
  summaryLabel: string;
  synthesisBg: string;
  synthesisBorder: string;
  synthesisTitle: string;
  loadingRing: string;
  loadingSpin: string;
  loadingIcon: string;
  zoomAccent: string;
}

/** Explicit theme objects so Tailwind picks up every class. */
export const ORGAN_SUITE_THEMES: Record<OrganSuiteAccent, OrganSuiteTheme> = {
  amber: {
    border: "border-amber-100",
    headerGrad: "from-amber-900 via-orange-800 to-slate-900",
    iconBox: "bg-amber-700/60 border-amber-400/30",
    icon: "text-amber-200",
    badge: "bg-amber-500/30 text-amber-100 border-amber-400/40",
    subtitle: "text-amber-100/80",
    accentIcon: "text-amber-600",
    focusRing: "focus:ring-amber-500",
    scoreBadge: "bg-amber-50 text-amber-800 border-amber-200",
    scoreHint: "text-amber-800/90",
    btnGrad: "from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 shadow-amber-200",
    panelBadge: "bg-amber-600",
    regenBtn: "bg-amber-600 hover:bg-amber-700",
    regenIdle: "text-amber-800 bg-amber-50 hover:bg-amber-100",
    editLink: "text-amber-700 hover:text-amber-900",
    suggestBtn: "text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200",
    fichaBorder: "border-amber-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-amber-950/40",
    fichaEyebrow: "text-amber-300",
    summaryBorder: "border-amber-800/40",
    summaryLabel: "text-amber-300",
    synthesisBg: "bg-cyan-50/70",
    synthesisBorder: "border-amber-600",
    synthesisTitle: "text-amber-800",
    loadingRing: "border-amber-200",
    loadingSpin: "border-amber-600",
    loadingIcon: "text-amber-600",
    zoomAccent: "text-amber-400",
  },
  sky: {
    border: "border-sky-100",
    headerGrad: "from-sky-900 via-cyan-800 to-slate-900",
    iconBox: "bg-sky-700/60 border-sky-400/30",
    icon: "text-sky-200",
    badge: "bg-sky-500/30 text-sky-100 border-sky-400/40",
    subtitle: "text-sky-100/80",
    accentIcon: "text-sky-600",
    focusRing: "focus:ring-sky-500",
    scoreBadge: "bg-sky-50 text-sky-800 border-sky-200",
    scoreHint: "text-sky-800/90",
    btnGrad: "from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 shadow-sky-200",
    panelBadge: "bg-sky-600",
    regenBtn: "bg-sky-600 hover:bg-sky-700",
    regenIdle: "text-sky-800 bg-sky-50 hover:bg-sky-100",
    editLink: "text-sky-700 hover:text-sky-900",
    suggestBtn: "text-sky-800 bg-sky-50 hover:bg-sky-100 border-sky-200",
    fichaBorder: "border-sky-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-sky-950/40",
    fichaEyebrow: "text-sky-300",
    summaryBorder: "border-sky-800/40",
    summaryLabel: "text-sky-300",
    synthesisBg: "bg-cyan-50/70",
    synthesisBorder: "border-sky-600",
    synthesisTitle: "text-sky-800",
    loadingRing: "border-sky-200",
    loadingSpin: "border-sky-600",
    loadingIcon: "text-sky-600",
    zoomAccent: "text-sky-400",
  },
  teal: {
    border: "border-teal-100",
    headerGrad: "from-teal-900 via-cyan-800 to-slate-900",
    iconBox: "bg-teal-700/60 border-teal-400/30",
    icon: "text-teal-200",
    badge: "bg-teal-500/30 text-teal-100 border-teal-400/40",
    subtitle: "text-teal-100/80",
    accentIcon: "text-teal-600",
    focusRing: "focus:ring-teal-500",
    scoreBadge: "bg-teal-50 text-teal-800 border-teal-200",
    scoreHint: "text-teal-800/90",
    btnGrad: "from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 shadow-teal-200",
    panelBadge: "bg-teal-600",
    regenBtn: "bg-teal-600 hover:bg-teal-700",
    regenIdle: "text-teal-800 bg-teal-50 hover:bg-teal-100",
    editLink: "text-teal-700 hover:text-teal-900",
    suggestBtn: "text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-200",
    fichaBorder: "border-teal-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-teal-950/40",
    fichaEyebrow: "text-teal-300",
    summaryBorder: "border-teal-800/40",
    summaryLabel: "text-teal-300",
    synthesisBg: "bg-cyan-50/70",
    synthesisBorder: "border-teal-600",
    synthesisTitle: "text-teal-800",
    loadingRing: "border-teal-200",
    loadingSpin: "border-teal-600",
    loadingIcon: "text-teal-600",
    zoomAccent: "text-teal-400",
  },
  pink: {
    border: "border-pink-100",
    headerGrad: "from-pink-900 via-rose-800 to-slate-900",
    iconBox: "bg-pink-700/60 border-pink-400/30",
    icon: "text-pink-200",
    badge: "bg-pink-500/30 text-pink-100 border-pink-400/40",
    subtitle: "text-pink-100/80",
    accentIcon: "text-pink-600",
    focusRing: "focus:ring-pink-500",
    scoreBadge: "bg-pink-50 text-pink-800 border-pink-200",
    scoreHint: "text-pink-800/90",
    btnGrad: "from-pink-600 to-rose-700 hover:from-pink-700 hover:to-rose-800 shadow-pink-200",
    panelBadge: "bg-pink-600",
    regenBtn: "bg-pink-600 hover:bg-pink-700",
    regenIdle: "text-pink-800 bg-pink-50 hover:bg-pink-100",
    editLink: "text-pink-700 hover:text-pink-900",
    suggestBtn: "text-pink-800 bg-pink-50 hover:bg-pink-100 border-pink-200",
    fichaBorder: "border-pink-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-pink-950/40",
    fichaEyebrow: "text-pink-300",
    summaryBorder: "border-pink-800/40",
    summaryLabel: "text-pink-300",
    synthesisBg: "bg-rose-50/70",
    synthesisBorder: "border-pink-600",
    synthesisTitle: "text-pink-800",
    loadingRing: "border-pink-200",
    loadingSpin: "border-pink-600",
    loadingIcon: "text-pink-600",
    zoomAccent: "text-pink-400",
  },
  lime: {
    border: "border-lime-100",
    headerGrad: "from-lime-900 via-emerald-800 to-slate-900",
    iconBox: "bg-lime-700/60 border-lime-400/30",
    icon: "text-lime-200",
    badge: "bg-lime-500/30 text-lime-100 border-lime-400/40",
    subtitle: "text-lime-100/80",
    accentIcon: "text-lime-600",
    focusRing: "focus:ring-lime-500",
    scoreBadge: "bg-lime-50 text-lime-800 border-lime-200",
    scoreHint: "text-lime-800/90",
    btnGrad: "from-lime-600 to-emerald-700 hover:from-lime-700 hover:to-emerald-800 shadow-lime-200",
    panelBadge: "bg-lime-600",
    regenBtn: "bg-lime-600 hover:bg-lime-700",
    regenIdle: "text-lime-800 bg-lime-50 hover:bg-lime-100",
    editLink: "text-lime-700 hover:text-lime-900",
    suggestBtn: "text-lime-800 bg-lime-50 hover:bg-lime-100 border-lime-200",
    fichaBorder: "border-lime-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-lime-950/40",
    fichaEyebrow: "text-lime-300",
    summaryBorder: "border-lime-800/40",
    summaryLabel: "text-lime-300",
    synthesisBg: "bg-emerald-50/70",
    synthesisBorder: "border-lime-600",
    synthesisTitle: "text-lime-800",
    loadingRing: "border-lime-200",
    loadingSpin: "border-lime-600",
    loadingIcon: "text-lime-600",
    zoomAccent: "text-lime-400",
  },
  indigo: {
    border: "border-indigo-100",
    headerGrad: "from-indigo-900 via-violet-800 to-slate-900",
    iconBox: "bg-indigo-700/60 border-indigo-400/30",
    icon: "text-indigo-200",
    badge: "bg-indigo-500/30 text-indigo-100 border-indigo-400/40",
    subtitle: "text-indigo-100/80",
    accentIcon: "text-indigo-600",
    focusRing: "focus:ring-indigo-500",
    scoreBadge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    scoreHint: "text-indigo-800/90",
    btnGrad: "from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 shadow-indigo-200",
    panelBadge: "bg-indigo-600",
    regenBtn: "bg-indigo-600 hover:bg-indigo-700",
    regenIdle: "text-indigo-800 bg-indigo-50 hover:bg-indigo-100",
    editLink: "text-indigo-700 hover:text-indigo-900",
    suggestBtn: "text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
    fichaBorder: "border-indigo-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-indigo-950/40",
    fichaEyebrow: "text-indigo-300",
    summaryBorder: "border-indigo-800/40",
    summaryLabel: "text-indigo-300",
    synthesisBg: "bg-violet-50/70",
    synthesisBorder: "border-indigo-600",
    synthesisTitle: "text-indigo-800",
    loadingRing: "border-indigo-200",
    loadingSpin: "border-indigo-600",
    loadingIcon: "text-indigo-600",
    zoomAccent: "text-indigo-400",
  },
  rose: {
    border: "border-rose-100",
    headerGrad: "from-rose-900 via-pink-800 to-slate-900",
    iconBox: "bg-rose-700/60 border-rose-400/30",
    icon: "text-rose-200",
    badge: "bg-rose-500/30 text-rose-100 border-rose-400/40",
    subtitle: "text-rose-100/80",
    accentIcon: "text-rose-600",
    focusRing: "focus:ring-rose-500",
    scoreBadge: "bg-rose-50 text-rose-800 border-rose-200",
    scoreHint: "text-rose-800/90",
    btnGrad: "from-rose-600 to-pink-700 hover:from-rose-700 hover:to-pink-800 shadow-rose-200",
    panelBadge: "bg-rose-600",
    regenBtn: "bg-rose-600 hover:bg-rose-700",
    regenIdle: "text-rose-800 bg-rose-50 hover:bg-rose-100",
    editLink: "text-rose-700 hover:text-rose-900",
    suggestBtn: "text-rose-800 bg-rose-50 hover:bg-rose-100 border-rose-200",
    fichaBorder: "border-rose-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-rose-950/40",
    fichaEyebrow: "text-rose-300",
    summaryBorder: "border-rose-800/40",
    summaryLabel: "text-rose-300",
    synthesisBg: "bg-pink-50/70",
    synthesisBorder: "border-rose-600",
    synthesisTitle: "text-rose-800",
    loadingRing: "border-rose-200",
    loadingSpin: "border-rose-600",
    loadingIcon: "text-rose-600",
    zoomAccent: "text-rose-400",
  },
  violet: {
    border: "border-violet-100",
    headerGrad: "from-violet-900 via-purple-800 to-slate-900",
    iconBox: "bg-violet-700/60 border-violet-400/30",
    icon: "text-violet-200",
    badge: "bg-violet-500/30 text-violet-100 border-violet-400/40",
    subtitle: "text-violet-100/80",
    accentIcon: "text-violet-600",
    focusRing: "focus:ring-violet-500",
    scoreBadge: "bg-violet-50 text-violet-800 border-violet-200",
    scoreHint: "text-violet-800/90",
    btnGrad: "from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 shadow-violet-200",
    panelBadge: "bg-violet-600",
    regenBtn: "bg-violet-600 hover:bg-violet-700",
    regenIdle: "text-violet-800 bg-violet-50 hover:bg-violet-100",
    editLink: "text-violet-700 hover:text-violet-900",
    suggestBtn: "text-violet-800 bg-violet-50 hover:bg-violet-100 border-violet-200",
    fichaBorder: "border-violet-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-violet-950/40",
    fichaEyebrow: "text-violet-300",
    summaryBorder: "border-violet-800/40",
    summaryLabel: "text-violet-300",
    synthesisBg: "bg-purple-50/70",
    synthesisBorder: "border-violet-600",
    synthesisTitle: "text-violet-800",
    loadingRing: "border-violet-200",
    loadingSpin: "border-violet-600",
    loadingIcon: "text-violet-600",
    zoomAccent: "text-violet-400",
  },
  cyan: {
    border: "border-cyan-100",
    headerGrad: "from-cyan-900 via-sky-800 to-slate-900",
    iconBox: "bg-cyan-700/60 border-cyan-400/30",
    icon: "text-cyan-200",
    badge: "bg-cyan-500/30 text-cyan-100 border-cyan-400/40",
    subtitle: "text-cyan-100/80",
    accentIcon: "text-cyan-600",
    focusRing: "focus:ring-cyan-500",
    scoreBadge: "bg-cyan-50 text-cyan-800 border-cyan-200",
    scoreHint: "text-cyan-800/90",
    btnGrad: "from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 shadow-cyan-200",
    panelBadge: "bg-cyan-600",
    regenBtn: "bg-cyan-600 hover:bg-cyan-700",
    regenIdle: "text-cyan-800 bg-cyan-50 hover:bg-cyan-100",
    editLink: "text-cyan-700 hover:text-cyan-900",
    suggestBtn: "text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border-cyan-200",
    fichaBorder: "border-cyan-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-cyan-950/40",
    fichaEyebrow: "text-cyan-300",
    summaryBorder: "border-cyan-800/40",
    summaryLabel: "text-cyan-300",
    synthesisBg: "bg-sky-50/70",
    synthesisBorder: "border-cyan-600",
    synthesisTitle: "text-cyan-800",
    loadingRing: "border-cyan-200",
    loadingSpin: "border-cyan-600",
    loadingIcon: "text-cyan-600",
    zoomAccent: "text-cyan-400",
  },
  orange: {
    border: "border-orange-100",
    headerGrad: "from-orange-900 via-amber-800 to-slate-900",
    iconBox: "bg-orange-700/60 border-orange-400/30",
    icon: "text-orange-200",
    badge: "bg-orange-500/30 text-orange-100 border-orange-400/40",
    subtitle: "text-orange-100/80",
    accentIcon: "text-orange-600",
    focusRing: "focus:ring-orange-500",
    scoreBadge: "bg-orange-50 text-orange-800 border-orange-200",
    scoreHint: "text-orange-800/90",
    btnGrad: "from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 shadow-orange-200",
    panelBadge: "bg-orange-600",
    regenBtn: "bg-orange-600 hover:bg-orange-700",
    regenIdle: "text-orange-800 bg-orange-50 hover:bg-orange-100",
    editLink: "text-orange-700 hover:text-orange-900",
    suggestBtn: "text-orange-800 bg-orange-50 hover:bg-orange-100 border-orange-200",
    fichaBorder: "border-orange-500/30",
    fichaGrad: "from-slate-950 via-slate-950 to-orange-950/40",
    fichaEyebrow: "text-orange-300",
    summaryBorder: "border-orange-800/40",
    summaryLabel: "text-orange-300",
    synthesisBg: "bg-amber-50/70",
    synthesisBorder: "border-orange-600",
    synthesisTitle: "text-orange-800",
    loadingRing: "border-orange-200",
    loadingSpin: "border-orange-600",
    loadingIcon: "text-orange-600",
    zoomAccent: "text-orange-400",
  },
};

export interface OrganSuiteConfig {
  id: string;
  accent: OrganSuiteAccent;
  title: string;
  badge: string;
  subtitle: string;
  studyTypeLabel: string;
  studyTypes: OrganSuiteStudyTypeOption[];
  detectStudyType: (reportText: string, protocol?: string) => string;
  studyTypeBodyKey: string;
  generateUrl: string;
  regenerateUrl: string;
  taskId: string;
  taskTitle: string;
  scorecardMarker: string;
  scorecardBadge: string;
  scorecardHint: string;
  topographyDirective: string;
  buildScorecardDirectives: (scorecard: ClinicalScorecardData | null) => string;
  directivesPlaceholder: string;
  emptyHint: string;
  loadingDetail: string;
  panelsHeading: (count: number) => string;
  fichaTitle: string;
  summaryLabel: string;
  summaryField: string;
  morphologyLabel: string;
  morphologyField: string;
  domainStatusLabel: string;
  domainStatusField: string;
  domainStatusAccent: string;
  keyPointsAccent: string;
  hasKeyPoints?: boolean;
  defaultTerritory: string;
  defaultFigureTitle: string;
  defaultTableTitle: string;
  defaultSynthesisTitle: string;
  /** Property holding the editable clinical table rows. */
  tableProperty: string;
  defaultColumnHeaders: string[];
  tableFields: string[];
  newRowDefaults: Record<string, string>;
  annotationTextKeys: string[];
  annotationSizeKeys: string[];
  regenPlaceholder: string;
  regenPresets?: OrganSuiteRegenPreset[];
  noReportError: string;
  analyzingStep: string;
  buildingStep: string;
  syncedLabel: (count: number) => string;
  generateLabel: string;
  regenerateLabel: string;
  processingLabel: string;
  suggestTitle: string;
  attachSuggestions: (data: OrganSuiteData) => OrganSuiteData;
  suggestMore: (data: OrganSuiteData) => SuiteImageAnnotation[];
}

export function tableOf(data: OrganSuiteData, prop: string): Array<Record<string, unknown>> {
  const rows = data?.[prop];
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export function genericAttach(
  data: OrganSuiteData,
  tableProperty: string,
  textKeys: string[],
  sizeKeys: string[]
): OrganSuiteData {
  const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);
  const suggested = suggestFromTableRows(
    tableOf(data, tableProperty) as any,
    letters,
    textKeys,
    sizeKeys,
    3
  );
  return withSuggestedImageAnnotations(data, suggested);
}

export function genericSuggestMore(
  data: OrganSuiteData,
  tableProperty: string,
  textKeys: string[],
  sizeKeys: string[]
): SuiteImageAnnotation[] {
  const letters = (data.panels || []).map((p) => p.panelLetter);
  return suggestFromTableRows(
    tableOf(data, tableProperty) as any,
    letters,
    textKeys,
    sizeKeys,
    3
  );
}

export function detectByKeywords(
  reportText: string,
  protocol: string | undefined,
  rules: Array<{ value: string; keys: string[] }>,
  fallback: string
): string {
  const text = `${reportText || ""} ${protocol || ""}`.toLowerCase();
  for (const rule of rules) {
    if (rule.keys.some((k) => text.includes(k))) return rule.value;
  }
  return fallback;
}

export const abdomenSuiteConfig: OrganSuiteConfig = {
  id: "abdomen",
  accent: "amber",
  title: "Suite Abdomen 3D & Ficha Multi-órgano",
  badge: "Abdomen Pro",
  subtitle: "Reconstrucción 3D multi-órgano: hígado, vías biliares, páncreas, bazo, riñones y FID",
  studyTypeLabel: "Tipo de estudio abdominal",
  studyTypes: [
    { value: "abdomen_completo", label: "Abdomen completo" },
    { value: "abdomen_superior", label: "Abdomen superior" },
    { value: "abdomen_agudo", label: "Abdomen agudo / FID" },
    { value: "general_abdomen", label: "General / detectar del informe" },
  ],
  detectStudyType: (r, p) =>
    detectByKeywords(
      r,
      p,
      [
        { value: "abdomen_agudo", keys: ["apendic", "diverticul", "fosa iliaca", "fosa ilíaca", "abdomen agudo", "fid"] },
        { value: "abdomen_superior", keys: ["abdomen superior", "higado", "hígado", "vesicula", "vesícula", "pancreas", "páncreas"] },
        { value: "abdomen_completo", keys: ["abdomen completo", "abdomen", "abdominal"] },
      ],
      "general_abdomen"
    ),
  studyTypeBodyKey: "abdomenType",
  generateUrl: "/api/generate-3d-abdomen",
  regenerateUrl: "/api/regenerate-3d-abdomen-panel",
  taskId: "abdomen-3d",
  taskTitle: "Generando Suite Abdomen 3D",
  scorecardMarker: "DIRECTIVA OBLIGATORIA DEL SCORECARD ABDOMINAL",
  scorecardBadge: "Scorecard abdominal obligatorio",
  scorecardHint: "Los criterios activos del Scorecard se inyectan como directiva obligatoria.",
  topographyDirective: ABDOMEN_TOPOGRAPHY_DIRECTIVE,
  buildScorecardDirectives: buildAbdomenDirectivesFromScorecard,
  directivesPlaceholder: "Ej: Hígado esteatósico grado II + litiasis vesicular...",
  emptyHint: "Presiona Generar para construir los modelos 3D y la tabla multi-órgano",
  loadingDetail: "Renderizando anatomía abdominal y correlato multi-órgano.",
  panelsHeading: (n) => `Reconstrucción Volumétrica 3D Abdomen (${n} Paneles)`,
  fichaTitle: "Ficha clínica abdomen completo",
  summaryLabel: "Resumen abdominal",
  summaryField: "abdomenSummary",
  morphologyLabel: "Morfología / ecoestructura",
  morphologyField: "morphologyNotes",
  domainStatusLabel: "Estado hepato-biliar-pancreático",
  domainStatusField: "hepatobiliaryStatus",
  domainStatusAccent: "text-yellow-300",
  keyPointsAccent: "text-orange-300",
  defaultTerritory: "ECOGRAFÍA DE ABDOMEN COMPLETO",
  defaultFigureTitle: "FIGURA 1. ATLAS 3D ABDOMEN Y CORRELACIÓN MULTI-ÓRGANO",
  defaultTableTitle: "TABLA ECOGRÁFICA DE ABDOMEN COMPLETO:",
  defaultSynthesisTitle: "SÍNTESIS MORFOLÓGICA DE ABDOMEN COMPLETO:",
  tableProperty: "findingTable",
  defaultColumnHeaders: ["LOCALIZACIÓN", "ESTRUCTURA", "TAMAÑO / GROSOR", "PATRÓN ECO", "LITIASIS / LOE", "FLUIDO / DOPPLER", "SEVERIDAD", "IMPACTO"],
  tableFields: ["location", "structure", "sizeOrThickness", "echoPattern", "stoneOrLesion", "fluidOrDoppler", "severity", "clinicalImpact"],
  newRowDefaults: {
    location: "Hígado",
    structure: "Parénquima hepático",
    sizeOrThickness: "—",
    echoPattern: "Ecoestructura conservada",
    stoneOrLesion: "Sin litiasis ni LOE",
    fluidOrDoppler: "Sin líquido libre",
    severity: "Leve",
    clinicalImpact: "Seguimiento clínico",
  },
  annotationTextKeys: ["structure", "location"],
  annotationSizeKeys: ["sizeOrThickness", "size"],
  regenPlaceholder: "Ej: Vesícula / FID / líquido libre — topografía exacta según informe...",
  noReportError: "No hay informe disponible para procesar la suite abdomen.",
  analyzingStep: "Analizando órganos abdominales...",
  buildingStep: "Construyendo paneles 3D y ficha multi-órgano...",
  syncedLabel: (n) => `Suite Abdomen 3D sincronizada (${n} paneles generados)`,
  generateLabel: "Generar Suite Abdomen 3D con IA",
  regenerateLabel: "Re-generar Suite Abdomen Completa",
  processingLabel: "Procesando Suite Abdomen...",
  suggestTitle: "Propone etiquetas desde la ficha multi-órgano",
  attachSuggestions: (data) => {
    const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);
    const suggested = data.imageAnnotations?.length
      ? data.imageAnnotations
      : suggestAbdomenImageAnnotations(tableOf(data, "findingTable") as any, letters, 3);
    return { ...data, imageAnnotations: suggested };
  },
  suggestMore: (data) =>
    suggestAbdomenImageAnnotations(
      tableOf(data, "findingTable") as any,
      (data.panels || []).map((p) => p.panelLetter),
      3
    ),
};


export const kneeSuiteConfig: OrganSuiteConfig = {
  id: "knee",
  accent: "sky",
  title: "Suite Rodilla 3D & Ficha Ligamentos-Meniscos",
  badge: "MSK Pro",
  subtitle: "Reconstrucción 3D de meniscos, LCM/LCL, mecanismo extensor y derrame",
  studyTypeLabel: "Tipo de estudio de rodilla",
  studyTypes: [{"value": "rodilla_b_mode", "label": "Rodilla B-mode"}, {"value": "rodilla_doppler", "label": "Rodilla + Doppler"}, {"value": "rodilla_ligamentos", "label": "Ligamentos y meniscos / ligamento patelar"}, {"value": "general_knee", "label": "General / detectar del informe"}],
  detectStudyType: (r, p) => detectByKeywords(r, p, [{"value": "rodilla_doppler", "keys": ["doppler"]}, {"value": "rodilla_ligamentos", "keys": ["menisc", "ligamento", "lca", "lcm", "lcl", "baker"]}, {"value": "rodilla_b_mode", "keys": ["rodilla", "knee"]}], "general_knee"),
  studyTypeBodyKey: "kneeType",
  generateUrl: "/api/generate-3d-knee",
  regenerateUrl: "/api/regenerate-3d-knee-panel",
  taskId: "knee-3d",
  taskTitle: "Generando Suite Rodilla 3D",
  scorecardMarker: "DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA",
  scorecardBadge: "Scorecard rodilla obligatorio",
  scorecardHint: "Los criterios del Scorecard de rodilla se inyectan como directiva obligatoria.",
  topographyDirective: KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
  buildScorecardDirectives: buildKneeDirectivesFromScorecard,
  directivesPlaceholder: "Ej: Menisco externo/lateral cuerno posterior...",
  emptyHint: "Presiona Generar para construir los modelos 3D y la tabla de ligamentos y meniscos",
  loadingDetail: "Renderizando anatomía de rodilla, meniscos/ligamentos y correlato MSK.",
  panelsHeading: (n) => `Reconstrucción Volumétrica 3D Rodilla (${n} Paneles)`,
  fichaTitle: "Ficha clínica rodilla / ligamentos-meniscos",
  summaryLabel: "Resumen de rodilla",
  summaryField: "kneeSummary",
  morphologyLabel: "Morfología / tendón dominante",
  morphologyField: "morphologyNotes",
  domainStatusLabel: "Estado de los ligamentos/meniscos",
  domainStatusField: "ligamentMeniscusStatus",
  domainStatusAccent: "text-yellow-300",
  keyPointsAccent: "text-emerald-300",
  hasKeyPoints: true,
  defaultTerritory: "ECOGRAFÍA DE RODILLA",
  defaultFigureTitle: "FIGURA 1. ATLAS 3D RODILLA Y CORRELACIÓN LIGAMENTOS Y MENISCOS",
  defaultTableTitle: "TABLA ECOGRÁFICA DEL LIGAMENTOS Y MENISCOS Y ESTRUCTURAS PERIARTICULARES:",
  defaultSynthesisTitle: "SÍNTESIS MORFOLÓGICA Y FUNCIONAL DEL RODILLA:",
  tableProperty: "findingTable",
  defaultColumnHeaders: ["LOCALIZACIÓN", "ESTRUCTURA", "GROSOR / GAP", "PATRÓN ECO", "DERRAME", "DINÁMICA", "SEVERIDAD", "IMPACTO"],
  tableFields: ["location", "structure", "thicknessOrGap", "echoPattern", "effusionStatus", "dynamicFinding", "severity", "clinicalImpact"],
  newRowDefaults: {"location": "Rodilla", "structure": "Menisco medial", "thicknessOrGap": "—", "echoPattern": "Ecoestructura conservada", "effusionStatus": "Sin distensión", "dynamicFinding": "Sin estrés en valgo/varo", "severity": "Leve", "clinicalImpact": "Seguimiento clínico"},
  annotationTextKeys: ["structure", "location"],
  annotationSizeKeys: ["thicknessOrGap", "sizeOrThickness", "size"],

  regenPresets: [
    { label: "Der · Interno (tibial)", directive: "CORRECCIÓN ESTRICTA: Rodilla Derecha AP. MENISCO INTERNO/MEDIAL (tibial) = lado DERECHO de la imagen. Peroné a la IZQUIERDA (solo landmark). PROHIBIDO poner la lesión junto al peroné.", className: "text-[9px] bg-sky-900/10 hover:bg-sky-100 border border-sky-300 text-sky-900 p-1.5 rounded text-left font-mono" },
    { label: "Der · Externo (peroné)", directive: "CORRECCIÓN ESTRICTA: Rodilla Derecha AP. MENISCO EXTERNO/LATERAL (peroné) = lado IZQUIERDO de la imagen JUNTO a la cabeza del peroné (debe verse). PROHIBIDO dibujarlo en el lado tibial/medial.", className: "text-[9px] bg-sky-900/10 hover:bg-sky-100 border border-sky-300 text-sky-900 p-1.5 rounded text-left font-mono" },
    { label: "Izq · Interno (tibial)", directive: "CORRECCIÓN ESTRICTA: Rodilla Izquierda AP. MENISCO INTERNO/MEDIAL (tibial) = lado IZQUIERDO de la imagen. Peroné a la DERECHA (solo landmark). PROHIBIDO poner la lesión junto al peroné.", className: "text-[9px] bg-indigo-900/10 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 p-1.5 rounded text-left font-mono" },
    { label: "Izq · Externo (peroné)", directive: "CORRECCIÓN ESTRICTA: Rodilla Izquierda AP. MENISCO EXTERNO/LATERAL (peroné) = lado DERECHO de la imagen JUNTO a la cabeza del peroné (debe verse). PROHIBIDO dibujarlo en el lado tibial/medial.", className: "text-[9px] bg-indigo-900/10 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 p-1.5 rounded text-left font-mono" },
  ],
  regenPlaceholder: "Ej: Menisco EXTERNO (peroné) — no confundir con interno/tibial...",
  noReportError: "No hay informe disponible para procesar la suite rodilla.",
  analyzingStep: "Analizando rodilla, meniscos y ligamentos...",
  buildingStep: "Construyendo paneles 3D y ficha ligamentos-meniscos...",
  syncedLabel: (n) => `Suite Rodilla 3D sincronizada (${n} paneles generados)`,
  generateLabel: "Generar Suite Rodilla 3D con IA",
  regenerateLabel: "Re-generar Suite Rodilla Completa",
  processingLabel: "Procesando Suite Rodilla...",
  suggestTitle: "Propone etiquetas desde la ficha ligamentos-meniscos",
  attachSuggestions: (d) => genericAttach(d, "findingTable", ["structure", "location"], ["thicknessOrGap", "sizeOrThickness", "size"]),
  suggestMore: (d) => genericSuggestMore(d, "findingTable", ["structure", "location"], ["thicknessOrGap", "sizeOrThickness", "size"]),
};

export {
  shoulderSuiteConfig,
  ankleSuiteConfig,
  kidneySuiteConfig,
  thyroidSuiteConfig,
  breastSuiteConfig,
  abdominalWallSuiteConfig,
  scrotumSuiteConfig,
  muscleTendonSuiteConfig,
  wristSuiteConfig,
  vascularSuiteConfig,
} from "./organSuiteConfigsRemaining";
