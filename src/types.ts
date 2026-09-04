export type CaseAnalysisFormatOption = 
  | "flujograma_semiologico" // Opción 1: Flujograma Semiológico (Ciclo de Pensamiento Radiológico)
  | "flujograma_algoritmico" // Opción 2: Flujograma Algorítmico / Árbol de Decisión
  | "esquema_pilares"        // Opción 3: Esquema Integrador por Pilares
  | "mapa_diferenciales"     // Opción 4: Mapa de Diagnósticos Diferenciales
  | "matriz_semiotica";      // Opción 5: Matriz Semiótica Comparativa (Signos Peticionantes vs. Exclusivos / Descarte)

export interface CaseAnalysisElementsConfig {
  includeSonographic: boolean;     // Hallazgos Sonográficos Clave (Pilar Fundamental)
  includeSonographicDetails?: boolean; // Características y Hallazgos Secundarios
  includeClinicalCorr: boolean;    // Correlación Clínico-Laboratorial
  includeCertainty: boolean;       // Certeza / Probabilidad Diagnóstica (%)
  includeDifferentials: boolean;   // Diagnósticos Diferenciales (a favor / en contra)
  includeDiscardedDifferentials?: boolean; // Criterios Descartados y Exclusiones
  includeManagement: boolean;      // Conducta y Pruebas Confirmativas Sugeridas
}

export interface DifferentialDiagnosticItem {
  name: string;
  probability: number | string;
  supportingCriteria: string;
  refutingCriteria?: string;
  confirmatoryTest?: string;
}

export interface DecisionFlowStep {
  step: number;
  title: string;
  desc: string;
  type?: "hallazgo" | "signos" | "contexto" | "conclusion" | "manejo";
}

export interface SemioticMatrixData {
  requestingSigns?: string[];
  exclusiveSigns?: string[];
  discardCriteria?: string[];
}

export interface CaseAnalysisData {
  format: CaseAnalysisFormatOption;
  elementsConfig: CaseAnalysisElementsConfig;
  title?: string;
  sonographicPillar: {
    primaryFinding: string;
    details: string[];
    severity?: "normal" | "altered" | "critical";
  };
  clinicalCorrelation?: string;
  certaintyPercent?: number | string;
  diagnostics?: DifferentialDiagnosticItem[];
  decisionFlow?: DecisionFlowStep[];
  semioticMatrix?: SemioticMatrixData;
  managementRecommendation?: string;
}

export interface Atlas3DPanel {
  id?: string;
  panelLetter: string;
  panelTitle: string;
  anatomicalFocus: string;
  laterality?: string;
  imageUrl?: string;
  isCustomFlipped?: boolean;
  promptUsed?: string;
}

export interface Atlas3DSynopticItem {
  structure: string;
  findingDetail: string;
  panelRef?: string;
}

/** Pathology callout linked to an Atlas 3D panel (from Scorecard sync or overlay AI). */
export interface AtlasPathologyOverlay {
  id: string;
  panelLetter: string;
  marker: string;
  structure: string;
  finding: string;
  severity: number;
  status: "active" | "secondary" | "resolved";
  linkedCriterionId?: string;
  evidence?: string;
}

export interface Atlas3DData {
  title?: string;
  figureTitle?: string;
  studyRegion?: string;
  detectedLaterality?: string;
  panels: Atlas3DPanel[];
  synopticTable?: Atlas3DSynopticItem[];
  synopticExplanation?: Atlas3DSynopticItem[];
  synthesis?: string;
  biomechanicalSynthesis?: string;
  /** Intelligent pathology overlays synced from Scorecard / clinical engine */
  pathologyOverlays?: AtlasPathologyOverlay[];
  overlaySource?: "scorecard" | "atlas" | "shared";
}

export type ScorecardCriterionStatus =
  | "met"
  | "not_met"
  | "not_mentioned"
  | "equivocal";

export interface ScorecardCriterion {
  id: string;
  criterion: string;
  status: ScorecardCriterionStatus;
  value?: string;
  evidence: string;
  weight: "critical" | "major" | "minor";
  severity: number;
  /** Anatomical structure hint for Atlas overlay sync */
  atlasStructure?: string;
  suggestedPanelFocus?: string;
}

export interface ClinicalScorecardData {
  protocolId: string;
  protocolName: string;
  categoryAssigned: string;
  scoreMet: number;
  scoreTotal: number;
  trafficLight: "low" | "moderate" | "high" | "critical";
  clinicalSummary: string;
  recommendation: string;
  criteria: ScorecardCriterion[];
  /** Ready-to-merge Atlas overlays derived from met/partial criteria */
  atlasOverlays: AtlasPathologyOverlay[];
  studyRegion?: string;
  generatedAt?: string;
}

export type VascularStudyType = 
  | "carotideo_vertebral"
  | "arterial_mmii"
  | "venoso_mmii"
  | "arterias_renales"
  | "aorto_iliaco"
  | "general_vascular";

export interface Vascular3DPanel {
  id?: string;
  panelLetter: string;
  panelTitle: string;
  anatomicalFocus: string;
  laterality?: string;
  vesselName?: string;
  imageUrl?: string;
  isCustomFlipped?: boolean;
  promptUsed?: string;
}

export interface VascularHemodynamicRow {
  vessel: string;             // ej: "Bulbo Carotídeo Derecho", "Arteria Femoral Común"
  plaqueOrThrombus: string;   // ej: "Gray-Weale Tipo II (Blanda/Hipoecoica)", "Sin placas", "Comprensible sin trombo"
  stenosisPercent: string;    // ej: "< 50%", "70-99%", "0%", "N/A"
  patternOrVelocity: string;  // ej: "Laminar sin aceleración focal (PSV 75 cm/s)", "Onda Trifásica normal"
  hemodynamicIndex: string;   // ej: "< 2.0 (1.15)", "RAR 1.4", "VR 1.1", "N/A"
  clinicalImpact: string;     // ej: "Estenosis no significativa", "Permeabilidad normal", "Reflujo patológico"
}

export interface Vascular3DData {
  studyTypeCategory?: VascularStudyType;
  territoryLabel?: string;     // ej: "DOPPLER CAROTÍDEO Y VERTEBRAL"
  laterality?: string;         // ej: "Bilateral", "Derecha", "Izquierda"
  figureTitle?: string;        // ej: "FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA CAROTÍDEA..."
  tableTitle?: string;         // ej: "TABLA HEMODINÁMICA Y CARACTERIZACIÓN DE LESIONES CAROTÍDEAS:"
  tableHeaders?: {
    col1: string;
    col2: string;
    col3: string;
    col4: string;
    col5: string;
    col6: string;
  };
  panels: Vascular3DPanel[];
  hemodynamicTable: VascularHemodynamicRow[];
  synthesisTitle?: string;
  morphologicalSynthesis?: string;
}

export type UsImagesGridMode = "auto" | "1x1" | "1x2" | "2x1" | "2x2" | "3x2" | "4x2";

