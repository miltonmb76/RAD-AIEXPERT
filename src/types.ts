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
}

