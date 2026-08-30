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
  panelLetter: string; // "A", "B", "C"
  panelTitle: string;
  imagePrompt?: string;
  anatomicalFocus?: string;
  imageUrl: string; // data:image/png;base64,...
  laterality?: string; // "Izquierda" | "Derecha" | "Bilateral" | "Línea media"
  isCustomFlipped?: boolean;
}

export interface Atlas3DSynopticItem {
  structure: string;
  panelRef: string;
  findingDetail: string;
}

export interface Atlas3DData {
  studyRegion: string;
  figureTitle: string;
  detectedLaterality?: string;
  panels: Atlas3DPanel[];
  synopticExplanation: Atlas3DSynopticItem[];
  biomechanicalSynthesis: string;
}

export type VascularStudyType = 
  | "carotid" // Doppler Carotídeo y Vertebral
  | "arterial_mmii" // Doppler Arterial de Miembros Inferiores
  | "venous_mmii" // Doppler Venoso de Miembros Inferiores
  | "renal" // Doppler Renal y Aorta / Arterias Renales
  | "aortoiliac"; // Doppler Aortoilíaco

export interface VascularPanel {
  panelId: string; // "PANEL_MAP_GENERAL", "PANEL_LESION_1", "PANEL_LESION_2", "PANEL_LUMEN_TRANSVERSE"
  panelLetter: string; // "A", "B", "C", "D"
  panelTitle: string;
  panelCategory: "roadmap" | "focal_plaque" | "stenosis_lumen" | "flow_hemodynamics" | "thrombus" | "reflux_valve";
  vesselSegment: string;
  anatomicalFocus: string;
  imagePrompt: string;
  imageUrl: string;
  laterality?: string;
  isCustomFlipped?: boolean;
  stenosisDegree?: string;
  flowPattern?: string;
}

export interface VascularHemodynamicTableItem {
  // Comunes
  vessel: string;
  segment: string;
  systemCategory?: string; // "Sistema Profundo" | "Sistema Superficial" | "Cayado / Unión" | "Vena Perforante" | "Arterial" | etc.
  
  // Específicos Doppler Carotídeo y General
  plaqueOrThrombusMorphology?: string;
  stenosisPercentOrReflux?: string;
  hemodynamicPattern?: string; // PSV, EDV, Flujo trifásico/monofásico
  icaCcaRatio?: string; // Relación ACI/ACC o ACC/ACI (ej. "3.4", "<2.0", ">4.0", "1.2", "-")
  hemodynamicImpact?: string; // Impacto hemodinámico y anatómico descriptivo
  clinicalSignificance?: string;

  // Específicos Doppler Venoso (TVP / Insuficiencia / Safenas)
  compressibility?: string; // Compresibilidad (ej. "100% Compresible / Luz anecoica", "No compresible", "Parcialmente compresible")
  thrombusPresence?: string; // Trombo / Ecos intraluminales (ej. "Ausente", "Trombo hipoecoico oclusivo", "Trombo mural subagudo")
  valvularReflux?: string; // Reflujo / Competencia valvular (ej. "Competente (<500 ms)", "Reflujo patológico >500 ms con Valsalva", "Reflujo severo >1000 ms")
  veinCaliber?: string; // Calibre vascular (ej. "Normal (3.8 mm)", "Ectasia (7.5 mm)", "4.0 mm")
  flowPhasicity?: string; // Patrón de flujo / Fasismo (ej. "Espontáneo, fásico respiratorio y aumento distal", "Flujo continuo / Pérdida de fasismo")

  // Específicos Doppler Arterial MMII (Miembros Inferiores)
  waveMorphology?: string; // Morfología de Onda (ej. "Trifásico de alta resistencia", "Bifásico", "Monofásico amortiguado", "Parvus-Tardus distal")
  psv?: string; // Velocidad Pico Sistólica PSV (ej. "85 cm/s (Normal)", "250 cm/s (Aceleración focal)")
  edv?: string; // Velocidad de Fin de Diástole EDV (ej. "0 cm/s", "35 cm/s")
  vrRatio?: string; // Ratio de Velocidad Sistólica Vr = V2/V1 (ej. "Vr: 2.8 (>2.0 = Estenosis >50%)", "Vr: 1.1 (Normal)")
  stenosisPercent?: string; // % Estenosis / Reducción luminal (ej. "70-75%", "<50%", "Oclusión 100%")
  plaqueMorphology?: string; // Morfología de Placa / Calidad parietal (ej. "Placa fibrocalcificada difusa", "Placa lipídica excéntrica")

  // Específicos Doppler Aortoilíaco
  diameterMm?: string; // Diámetro AP / Transverso en mm (ej. "19 mm (Normal)", "45 mm (Aneurisma fusiforme)", "24 mm (Ectasia)")

  // Específicos Doppler Renal (Arterias Renales & Parénquima)
  rarRatio?: string; // Relación Aorto-Renal RAR = PSV Renal / PSV Aorta (ej. "RAR: 3.6 (>3.5 = Estenosis >60%)", "RAR: 1.2 (Normal)")
  accelerationTime?: string; // Tiempo de Aceleración AT en ms (ej. "AT: 110 ms (>70 ms = Patrón tardus)", "AT: 40 ms (Normal)")
  resistiveIndex?: string; // Índice de Resistividad IR / RI intraparenquimatoso (ej. "IR: 0.62 (Normal 0.58-0.70)", "IR: 0.82 (Elevado)")
  renalLength?: string; // Longitud / Eje bipolar renal (ej. "108 mm (Conservado, parénquima 16 mm)", "82 mm (Atrofia isquémica)")
}

export interface Vascular3DData {
  vascularTerritory: string; // "Doppler Carotídeo y Vertebral", "Doppler Arterial MMII", etc.
  vascularStudyType: VascularStudyType;
  laterality: string; // "Izquierda" | "Derecha" | "Bilateral" | "Aortoilíaco central"
  figureTitle: string;
  roadmapPanel: VascularPanel;
  focalPanels: VascularPanel[];
  hemodynamicTable: VascularHemodynamicTableItem[];
  hemodynamicSynthesis?: string;
  surgicalHemodynamicSynthesis?: string;
}

export type UltrasoundPhotoLayout = "auto" | "grid2x2" | "grid1x2" | "grid2x3" | "grid3x3";


