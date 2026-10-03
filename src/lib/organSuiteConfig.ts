import { ClinicalScorecardData, SuiteImageAnnotation } from "../types";
import {
  suggestAbdomenImageAnnotations,
  suggestFromTableRows,
  withSuggestedImageAnnotations,
} from "./suiteImageAnnotations";
import {
  ABDOMEN_TOPOGRAPHY_DIRECTIVE,
  KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
  buildAbdomenDirectivesFromScorecard,
  buildKneeDirectivesFromScorecard,
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
  tableHeaders?: Partial<Record<`col${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, string>>;
  panels: OrganSuitePanel[];
  findingTable?: Array<Record<string, string>>;
  imageAnnotations?: SuiteImageAnnotation[];
  morphologyNotes?: string;
  keyPoints?: string[];
  synthesisTitle?: string;
  morphologicalSynthesis?: string;
  [key: string]: unknown;
}

export type OrganSuiteAccent = "amber" | "sky";

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
    btnGrad:
      "from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 shadow-amber-200",
    panelBadge: "bg-amber-600",
    regenBtn: "bg-amber-600 hover:bg-amber-700",
    regenIdle: "text-amber-800 bg-amber-50 hover:bg-amber-100",
    editLink: "text-amber-700 hover:text-amber-900",
    suggestBtn:
      "text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200",
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
    btnGrad:
      "from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 shadow-sky-200",
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
  /** JSON body key for study type on generate/regenerate */
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
  domainStatusLabel: string;
  domainStatusField: string;
  domainStatusAccent: string;
  keyPointsAccent: string;
  defaultTerritory: string;
  defaultFigureTitle: string;
  defaultTableTitle: string;
  defaultSynthesisTitle: string;
  defaultTableHeaders: Record<`col${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, string>;
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
  /** Attach suggestions after generate (preserves existing annotations when present). */
  attachSuggestions: (data: OrganSuiteData) => OrganSuiteData;
  /** Manual “Sugerir anotaciones…” append. */
  suggestMore: (data: OrganSuiteData) => SuiteImageAnnotation[];
}

function detectAbdomenStudyType(reportText: string, protocol?: string): string {
  const text = `${reportText || ""} ${protocol || ""}`.toLowerCase();
  if (
    text.includes("apendic") ||
    text.includes("diverticul") ||
    text.includes("fosa iliaca") ||
    text.includes("fosa ilíaca") ||
    text.includes("abdomen agudo") ||
    text.includes("fid")
  ) {
    return "abdomen_agudo";
  }
  if (
    text.includes("abdomen superior") ||
    text.includes("higado") ||
    text.includes("hígado") ||
    text.includes("vesicula") ||
    text.includes("vesícula") ||
    text.includes("pancreas") ||
    text.includes("páncreas")
  ) {
    return "abdomen_superior";
  }
  if (
    text.includes("abdomen completo") ||
    text.includes("abdomen") ||
    text.includes("abdominal")
  ) {
    return "abdomen_completo";
  }
  return "general_abdomen";
}

function detectKneeStudyType(reportText: string, protocol?: string): string {
  const text = `${reportText || ""} ${protocol || ""}`.toLowerCase();
  if (text.includes("doppler")) return "rodilla_doppler";
  if (
    text.includes("menisc") ||
    text.includes("ligamento") ||
    text.includes("lca") ||
    text.includes("lcm") ||
    text.includes("lcl") ||
    text.includes("baker")
  ) {
    return "rodilla_ligamentos";
  }
  if (text.includes("rodilla") || text.includes("knee")) return "rodilla_b_mode";
  return "general_knee";
}

export const abdomenSuiteConfig: OrganSuiteConfig = {
  id: "abdomen",
  accent: "amber",
  title: "Suite Abdomen 3D & Ficha Multi-órgano",
  badge: "Abdomen Pro",
  subtitle:
    "Reconstrucción 3D multi-órgano: hígado, vías biliares, páncreas, bazo, riñones y FID",
  studyTypeLabel: "Tipo de estudio abdominal",
  studyTypes: [
    { value: "abdomen_completo", label: "Abdomen completo" },
    { value: "abdomen_superior", label: "Abdomen superior" },
    { value: "abdomen_agudo", label: "Abdomen agudo / FID" },
    { value: "general_abdomen", label: "General / detectar del informe" },
  ],
  detectStudyType: detectAbdomenStudyType,
  studyTypeBodyKey: "abdomenType",
  generateUrl: "/api/generate-3d-abdomen",
  regenerateUrl: "/api/regenerate-3d-abdomen-panel",
  taskId: "abdomen-3d",
  taskTitle: "Generando Suite Abdomen 3D",
  scorecardMarker: "DIRECTIVA OBLIGATORIA DEL SCORECARD ABDOMINAL",
  scorecardBadge: "Scorecard abdominal obligatorio",
  scorecardHint:
    "Los criterios activos del Scorecard (y radar abdominal / visceral si aplica) se inyectan como directiva obligatoria.",
  topographyDirective: ABDOMEN_TOPOGRAPHY_DIRECTIVE,
  buildScorecardDirectives: buildAbdomenDirectivesFromScorecard,
  directivesPlaceholder:
    "Ej: Hígado esteatósico grado II + litiasis vesicular — no inventar apendicitis ni colecciones...",
  emptyHint: "Presiona Generar para construir los modelos 3D y la tabla multi-órgano",
  loadingDetail:
    "Renderizando anatomía abdominal, hígado/vesícula/páncreas y correlato multi-órgano.",
  panelsHeading: (n) => `Reconstrucción Volumétrica 3D Abdomen (${n} Paneles)`,
  fichaTitle: "Ficha clínica abdomen completo",
  summaryLabel: "Resumen abdominal",
  summaryField: "abdomenSummary",
  morphologyLabel: "Morfología / ecoestructura",
  domainStatusLabel: "Estado hepato-biliar-pancreático",
  domainStatusField: "hepatobiliaryStatus",
  domainStatusAccent: "text-yellow-300",
  keyPointsAccent: "text-orange-300",
  defaultTerritory: "ECOGRAFÍA DE ABDOMEN COMPLETO",
  defaultFigureTitle: "FIGURA 1. ATLAS 3D ABDOMEN Y CORRELACIÓN MULTI-ÓRGANO",
  defaultTableTitle: "TABLA ECOGRÁFICA DE ABDOMEN COMPLETO:",
  defaultSynthesisTitle: "SÍNTESIS MORFOLÓGICA DE ABDOMEN COMPLETO:",
  defaultTableHeaders: {
    col1: "LOCALIZACIÓN",
    col2: "ESTRUCTURA",
    col3: "TAMAÑO / GROSOR",
    col4: "PATRÓN ECO",
    col5: "LITIASIS / LOE",
    col6: "FLUIDO / DOPPLER",
    col7: "SEVERIDAD",
    col8: "IMPACTO",
  },
  tableFields: [
    "location",
    "structure",
    "sizeOrThickness",
    "echoPattern",
    "stoneOrLesion",
    "fluidOrDoppler",
    "severity",
    "clinicalImpact",
  ],
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
  regenPlaceholder:
    "Ej: Vesícula / FID / líquido libre — topografía exacta según informe...",
  noReportError: "No hay informe disponible para procesar la suite abdomen.",
  analyzingStep: "Analizando órganos abdominales y estructuras periarticulares...",
  buildingStep: "Construyendo paneles 3D y ficha multi-órgano...",
  syncedLabel: (n) =>
    `Suite Abdomen 3D sincronizada (${n} paneles generados)`,
  generateLabel: "Generar Suite Abdomen 3D con IA",
  regenerateLabel: "Re-generar Suite Abdomen Completa",
  processingLabel: "Procesando Suite Abdomen...",
  suggestTitle: "Propone etiquetas (nombre/tamaño) desde la ficha multi-órgano",
  attachSuggestions: (data) => {
    const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);
    const suggested =
      data.imageAnnotations?.length
        ? data.imageAnnotations
        : suggestAbdomenImageAnnotations(data.findingTable as any, letters, 3);
    return { ...data, imageAnnotations: suggested };
  },
  suggestMore: (data) => {
    const letters = (data.panels || []).map((p) => p.panelLetter);
    return suggestAbdomenImageAnnotations(data.findingTable as any, letters, 3);
  },
};

export const kneeSuiteConfig: OrganSuiteConfig = {
  id: "knee",
  accent: "sky",
  title: "Suite Rodilla 3D & Ficha Ligamentos-Meniscos",
  badge: "MSK Pro",
  subtitle:
    "Reconstrucción 3D de meniscos, LCM/LCL, mecanismo extensor y derrame",
  studyTypeLabel: "Tipo de estudio de rodilla",
  studyTypes: [
    { value: "rodilla_b_mode", label: "Rodilla B-mode" },
    { value: "rodilla_doppler", label: "Rodilla + Doppler" },
    { value: "rodilla_ligamentos", label: "Ligamentos y meniscos / ligamento patelar" },
    { value: "general_knee", label: "General / detectar del informe" },
  ],
  detectStudyType: detectKneeStudyType,
  studyTypeBodyKey: "kneeType",
  generateUrl: "/api/generate-3d-knee",
  regenerateUrl: "/api/regenerate-3d-knee-panel",
  taskId: "knee-3d",
  taskTitle: "Generando Suite Rodilla 3D",
  scorecardMarker: "DIRECTIVA OBLIGATORIA DEL SCORECARD RODILLA",
  scorecardBadge: "Scorecard rodilla obligatorio",
  scorecardHint:
    "Los criterios activos del Scorecard de rodilla se inyectan como directiva obligatoria.",
  topographyDirective: KNEE_MENISCUS_TOPOGRAPHY_DIRECTIVE,
  buildScorecardDirectives: buildKneeDirectivesFromScorecard,
  directivesPlaceholder:
    "Ej: Menisco externo/lateral cuerno posterior — no confundir con medial/tibial...",
  emptyHint:
    "Presiona Generar para construir los modelos 3D y la tabla de ligamentos y meniscos",
  loadingDetail:
    "Renderizando anatomía de rodilla, meniscos/ligamentos y correlato MSK.",
  panelsHeading: (n) => `Reconstrucción Volumétrica 3D Rodilla (${n} Paneles)`,
  fichaTitle: "Ficha clínica rodilla / ligamentos-meniscos",
  summaryLabel: "Resumen de rodilla",
  summaryField: "kneeSummary",
  morphologyLabel: "Morfología / tendón dominante",
  domainStatusLabel: "Estado de los ligamentos/meniscos",
  domainStatusField: "ligamentMeniscusStatus",
  domainStatusAccent: "text-yellow-300",
  keyPointsAccent: "text-emerald-300",
  defaultTerritory: "ECOGRAFÍA DE RODILLA",
  defaultFigureTitle: "FIGURA 1. ATLAS 3D RODILLA Y CORRELACIÓN LIGAMENTOS Y MENISCOS",
  defaultTableTitle: "TABLA ECOGRÁFICA DEL LIGAMENTOS Y MENISCOS Y ESTRUCTURAS PERIARTICULARES:",
  defaultSynthesisTitle: "SÍNTESIS MORFOLÓGICA Y FUNCIONAL DEL RODILLA:",
  defaultTableHeaders: {
    col1: "LOCALIZACIÓN",
    col2: "ESTRUCTURA",
    col3: "GROSOR / GAP",
    col4: "PATRÓN ECO",
    col5: "DERRAME",
    col6: "DINÁMICA",
    col7: "SEVERIDAD",
    col8: "IMPACTO",
  },
  tableFields: [
    "location",
    "structure",
    "thicknessOrGap",
    "echoPattern",
    "effusionStatus",
    "dynamicFinding",
    "severity",
    "clinicalImpact",
  ],
  newRowDefaults: {
    location: "Rodilla",
    structure: "Menisco medial",
    thicknessOrGap: "—",
    echoPattern: "Ecoestructura conservada",
    effusionStatus: "Sin distensión",
    dynamicFinding: "Sin estrés en valgo/varo",
    severity: "Leve",
    clinicalImpact: "Seguimiento clínico",
  },
  annotationTextKeys: ["structure", "location"],
  annotationSizeKeys: ["thicknessOrGap", "sizeOrThickness", "size"],
  regenPlaceholder:
    "Ej: Menisco EXTERNO (peroné) — no confundir con interno/tibial...",
  regenPresets: [
    {
      label: "Der · Interno (tibial)",
      directive:
        "CORRECCIÓN ESTRICTA: Rodilla Derecha AP. MENISCO INTERNO/MEDIAL (tibial) = lado DERECHO de la imagen. Peroné a la IZQUIERDA (solo landmark). PROHIBIDO poner la lesión junto al peroné.",
      className:
        "text-[9px] bg-sky-900/10 hover:bg-sky-100 border border-sky-300 text-sky-900 p-1.5 rounded text-left font-mono",
    },
    {
      label: "Der · Externo (peroné)",
      directive:
        "CORRECCIÓN ESTRICTA: Rodilla Derecha AP. MENISCO EXTERNO/LATERAL (peroné) = lado IZQUIERDO de la imagen JUNTO a la cabeza del peroné (debe verse). PROHIBIDO dibujarlo en el lado tibial/medial.",
      className:
        "text-[9px] bg-sky-900/10 hover:bg-sky-100 border border-sky-300 text-sky-900 p-1.5 rounded text-left font-mono",
    },
    {
      label: "Izq · Interno (tibial)",
      directive:
        "CORRECCIÓN ESTRICTA: Rodilla Izquierda AP. MENISCO INTERNO/MEDIAL (tibial) = lado IZQUIERDO de la imagen. Peroné a la DERECHA (solo landmark). PROHIBIDO poner la lesión junto al peroné.",
      className:
        "text-[9px] bg-indigo-900/10 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 p-1.5 rounded text-left font-mono",
    },
    {
      label: "Izq · Externo (peroné)",
      directive:
        "CORRECCIÓN ESTRICTA: Rodilla Izquierda AP. MENISCO EXTERNO/LATERAL (peroné) = lado DERECHO de la imagen JUNTO a la cabeza del peroné (debe verse). PROHIBIDO dibujarlo en el lado tibial/medial.",
      className:
        "text-[9px] bg-indigo-900/10 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 p-1.5 rounded text-left font-mono",
    },
  ],
  noReportError: "No hay informe disponible para procesar la suite rodilla.",
  analyzingStep: "Analizando rodilla, meniscos y ligamentos...",
  buildingStep: "Construyendo paneles 3D y ficha ligamentos-meniscos...",
  syncedLabel: (n) =>
    `Suite Rodilla 3D sincronizada (${n} paneles generados)`,
  generateLabel: "Generar Suite Rodilla 3D con IA",
  regenerateLabel: "Re-generar Suite Rodilla Completa",
  processingLabel: "Procesando Suite Rodilla...",
  suggestTitle: "Propone etiquetas (nombre/tamaño) desde la ficha ligamentos-meniscos",
  attachSuggestions: (data) => {
    const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);
    const suggested = suggestFromTableRows(
      (data.findingTable as any) || [],
      letters,
      ["structure", "location"],
      ["thicknessOrGap", "sizeOrThickness", "size"],
      3
    );
    return withSuggestedImageAnnotations(data, suggested);
  },
  suggestMore: (data) => {
    const letters = (data.panels || []).map((p) => p.panelLetter);
    return suggestFromTableRows(
      (data.findingTable as any) || [],
      letters,
      ["structure", "location"],
      ["thicknessOrGap", "sizeOrThickness", "size"],
      3
    );
  },
};
