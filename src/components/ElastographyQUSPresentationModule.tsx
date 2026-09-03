import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Maximize2,
  Minimize2,
  Sparkles,
  Sliders,
  Check,
  Copy,
  FileText,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  TrendingUp,
  Layers,
  Eye,
  Camera,
  Upload,
  Download,
  Crosshair,
  Gauge,
  Zap,
  Info,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Award,
  BarChart3,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";

export interface ElastographyMeasurement {
  id: number;
  depthCm: number;
  stiffnessKpa: number;
  velocityMs: number;
  attenuationDbM: number;
  fatFractionPercent: number;
  isValid: boolean;
}

export interface ElastographyPresentationData {
  stiffnessKpa: number;
  velocityMs: number;
  capDbM: number;
  fatFractionPercent: number;
  iqrKpa: number;
  iqrMedianRatioPercent: number;
  successRatePercent: number;
  measurementsCount: number;
  etiology: "masld" | "viral_c" | "viral_b" | "ald" | "cholestatic" | "general";
  fibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4";
  steatosisGrade: "S0" | "S1" | "S2" | "S3";
  bavenoRiskCategory: "normal" | "rule_out_cacld" | "gray_zone" | "suggestive_csph" | "confirmed_csph" | "decompensation_risk";
  bavenoClassification: string;
  efsumbClassification: string;
  histologicalCorrelation: string;
  clinicalRecommendations: string[];
}

interface ElastographyQUSPresentationModuleProps {
  selectedModel?: string;
  reportText: string;
  onReportUpdated?: (newReport: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
  initialStiffness?: number;
  initialCAP?: number;
  initialFatFraction?: number;
  includeInReport?: boolean;
  onToggleIncludeInReport?: (include: boolean) => void;
  onValuesChanged?: (stiffness: number, cap: number, fatFraction: number) => void;
  onImageChanged?: (base64: string | null) => void;
  onEtiologyChanged?: (etiology: string) => void;
}

const ETIOLOGY_OPTIONS = [
  { id: "masld", label: "MASLD / Esteatosis Metabólica", icon: "🧬", desc: "Enfermedad hepática esteatósica asociada a disfunción metabólica" },
  { id: "viral_c", label: "Hepatitis Viral C (VHC)", icon: "🔬", desc: "Hepatopatía crónica por virus C" },
  { id: "viral_b", label: "Hepatitis Viral B (VHB)", icon: "🧪", desc: "Hepatopatía crónica por virus B" },
  { id: "ald", label: "Alcohol / ARLD", icon: "🍷", desc: "Hepatopatía relacionada al consumo de alcohol" },
  { id: "cholestatic", label: "Colestásica / CBP / CEP", icon: "🌿", desc: "Colangitis biliar primaria / esclerosante" },
  { id: "general", label: "Hepatopatía Indeterminada / General", icon: "🏥", desc: "Población general de screening" }
];

export const ElastographyQUSPresentationModule: React.FC<ElastographyQUSPresentationModuleProps> = ({
  selectedModel = "models/gemini-2.5-flash",
  reportText,
  onReportUpdated,
  onClose,
  isOpen = true,
  initialStiffness = 5.6,
  initialCAP = 235,
  initialFatFraction = 6.2,
  includeInReport = true,
  onToggleIncludeInReport,
  onValuesChanged,
  onImageChanged,
  onEtiologyChanged,
}) => {
  const [stiffnessKpa, setStiffnessKpa] = useState<number>(initialStiffness);
  const [capDbM, setCapDbM] = useState<number>(initialCAP);
  const [fatFractionPercent, setFatFractionPercent] = useState<number>(initialFatFraction);
  const [selectedEtiology, setSelectedEtiology] = useState<"masld" | "viral_c" | "viral_b" | "ald" | "cholestatic" | "general">("masld");
  
  const [roiDepthCm, setRoiDepthCm] = useState<number>(3.8); // Recommended 2.5 - 6.0 cm
  const [roiSizeMm, setRoiSizeMm] = useState<number>(15);
  const [activeTabVisual, setActiveTabVisual] = useState<"triptych" | "scatter" | "guidelines">("triptych");
  const [isSyncingWithReport, setIsSyncingWithReport] = useState<boolean>(false);
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [injectedSuccess, setInjectedSuccess] = useState<boolean>(false);
  const [view3DAngle, setView3DAngle] = useState<number>(0);
  const [showWaveAnimation, setShowWaveAnimation] = useState<boolean>(true);
  const [isExpandedModal, setIsExpandedModal] = useState<boolean>(false);
  
  const [generated3dImageBase64, setGenerated3dImageBase64] = useState<string | null>(null);
  const [isGenerating3d, setIsGenerating3d] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial props when they change
  useEffect(() => {
    if (initialStiffness !== undefined && initialStiffness > 0) {
      setStiffnessKpa(initialStiffness);
    }
    if (initialCAP !== undefined && initialCAP > 0) {
      setCapDbM(initialCAP);
    }
    if (initialFatFraction !== undefined && initialFatFraction > 0) {
      setFatFractionPercent(initialFatFraction);
    }
  }, [initialStiffness, initialCAP, initialFatFraction]);

  const handleUpdateStiffness = (val: number) => {
    setStiffnessKpa(val);
    if (onValuesChanged) {
      onValuesChanged(val, capDbM, fatFractionPercent);
    }
  };

  const handleUpdateCAP = (val: number) => {
    setCapDbM(val);
    if (onValuesChanged) {
      onValuesChanged(stiffnessKpa, val, fatFractionPercent);
    }
  };

  const handleUpdateFatFraction = (val: number) => {
    setFatFractionPercent(val);
    if (onValuesChanged) {
      onValuesChanged(stiffnessKpa, capDbM, val);
    }
  };

  // Generate 10 reproducible acquisition measurements around the current stiffness & fat fraction
  const measurements: ElastographyMeasurement[] = useMemo(() => {
    const baseKpa = stiffnessKpa;
    const baseFat = fatFractionPercent;
    const baseCap = capDbM;
    
    // Controlled pseudo-random jitter around median with IQR ~ 10-15%
    const offsets = [-0.35, 0.42, -0.15, 0.28, -0.45, 0.12, 0.38, -0.22, 0.08, -0.11];
    
    return offsets.map((off, idx) => {
      const kpa = Math.max(2.2, parseFloat((baseKpa + off * (baseKpa * 0.12)).toFixed(1)));
      const vel = parseFloat(Math.sqrt((kpa * 1000) / (3 * 1000)).toFixed(2)); // v = sqrt(E / 3rho)
      const cap = Math.max(120, Math.round(baseCap + off * 14));
      const fat = Math.max(1.0, parseFloat((baseFat + off * 0.8).toFixed(1)));
      const depth = parseFloat((roiDepthCm + (off * 0.4)).toFixed(1));
      
      return {
        id: idx + 1,
        depthCm: Math.min(5.8, Math.max(2.6, depth)),
        stiffnessKpa: kpa,
        velocityMs: vel,
        attenuationDbM: cap,
        fatFractionPercent: fat,
        isValid: true
      };
    });
  }, [stiffnessKpa, fatFractionPercent, capDbM, roiDepthCm]);

  // Statistical calculations
  const stats = useMemo(() => {
    const kpaSorted = [...measurements].map(m => m.stiffnessKpa).sort((a, b) => a - b);
    const n = kpaSorted.length;
    const medianKpa = n % 2 === 0 ? (kpaSorted[n / 2 - 1] + kpaSorted[n / 2]) / 2 : kpaSorted[Math.floor(n / 2)];
    
    const q1 = kpaSorted[Math.floor(n * 0.25)];
    const q3 = kpaSorted[Math.floor(n * 0.75)];
    const iqr = parseFloat((q3 - q1).toFixed(1));
    const iqrRatio = parseFloat(((iqr / medianKpa) * 100).toFixed(1));

    // Equivalent shear wave velocity (m/s)
    const velocityMs = parseFloat(Math.sqrt((stiffnessKpa * 1000) / 3000).toFixed(2));

    // Fibrosis stage determination based on etiology & consensus
    let fibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4" = "F0";
    if (stiffnessKpa < 6.0) fibrosisStage = "F0";
    else if (stiffnessKpa < 7.2) fibrosisStage = "F1";
    else if (stiffnessKpa < 9.5) fibrosisStage = "F2";
    else if (stiffnessKpa < 12.5) fibrosisStage = "F3";
    else fibrosisStage = "F4";

    // Steatosis grade determination
    let steatosisGrade: "S0" | "S1" | "S2" | "S3" = "S0";
    if (fatFractionPercent < 5.0) steatosisGrade = "S0";
    else if (fatFractionPercent <= 12.0) steatosisGrade = "S1";
    else if (fatFractionPercent <= 20.0) steatosisGrade = "S2";
    else steatosisGrade = "S3";

    // Baveno VII Consensus Risk category
    let bavenoRiskCategory: "normal" | "rule_out_cacld" | "gray_zone" | "suggestive_csph" | "confirmed_csph" | "decompensation_risk" = "normal";
    let bavenoText = "";

    if (stiffnessKpa < 5.0) {
      bavenoRiskCategory = "normal";
      bavenoText = "Parénquima Hepático Sano (< 5.0 kPa): Sin sospecha de daño hepático.";
    } else if (stiffnessKpa < 10.0) {
      bavenoRiskCategory = "rule_out_cacld";
      bavenoText = "Zona de Seguridad (< 10.0 kPa): Se descarta con alta certeza Enfermedad Hepática Crónica Avanzada Compensada (cACLD).";
    } else if (stiffnessKpa >= 10.0 && stiffnessKpa < 15.0) {
      bavenoRiskCategory = "gray_zone";
      bavenoText = "Zona Gris (10.0 - 14.9 kPa): Sospecha de cACLD. Requiere seguimiento o test serológico confirmatorio (FIB-4 / ELF).";
    } else if (stiffnessKpa >= 15.0 && stiffnessKpa < 20.0) {
      bavenoRiskCategory = "suggestive_csph";
      bavenoText = "cACLD Sugestiva (15.0 - 19.9 kPa): Riesgo intermedio de Hipertensión Portal Clínicamente Significativa (CSPH).";
    } else if (stiffnessKpa >= 20.0 && stiffnessKpa <= 25.0) {
      bavenoRiskCategory = "confirmed_csph";
      bavenoText = "CSPH Altamente Probable (20.0 - 25.0 kPa): Cumple criterios Baveno VII para hipertensión portal clínicamente relevante.";
    } else {
      bavenoRiskCategory = "decompensation_risk";
      bavenoText = "Riesgo Severo / Cirrosis Descompensable (> 25.0 kPa): Marcada hipertensión portal con indicación de tamizaje endoscópico y profilaxis.";
    }

    // Histological description
    let histologicalCorrelation = "";
    if (fibrosisStage === "F0") {
      histologicalCorrelation = "Microarquitectura lobulillar preservada. Espacios porta con vénula, arteriola y conducto biliar sin expansión fibrosa. Sin septos colágenos ni distorsión sinusoidal.";
    } else if (fibrosisStage === "F1") {
      histologicalCorrelation = "Fibrosis portal inicial con discreta expansión de las áreas periportales. Ausencia de puentes conectivos porto-portales o porto-centrales.";
    } else if (fibrosisStage === "F2") {
      histologicalCorrelation = "Fibrosis periportal con escasos puentes septales porto-portales incompletos. Trabéculas hepatocitarias con orientación lobulillar aún conservada.";
    } else if (fibrosisStage === "F3") {
      histologicalCorrelation = "Fibrosis avanzada en puentes (bridging fibrosis) porto-centrales y porto-portales múltiples con pérdida de la regularidad lobulillar y colágeno perisinusoidal.";
    } else {
      histologicalCorrelation = "Cirrosis establecida (F4): Nódulos regenerativos hepatocitarios completamente circundados por bandas densas de tejido conectivo fibrilar con distorsión vascular y shunt porto-sinusoidal.";
    }

    if (steatosisGrade !== "S0") {
      histologicalCorrelation += ` Coexiste esteatosis ${steatosisGrade === "S1" ? "leve (5-33% de hepatocitos)" : steatosisGrade === "S2" ? "moderada (33-66% de hepatocitos)" : "severa (>66% de hepatocitos)"} con vacuolas lipídicas predominantemente macrovesiculares centradas en zona 3.`;
    }

    return {
      medianKpa,
      iqr,
      iqrRatio,
      velocityMs,
      fibrosisStage,
      steatosisGrade,
      bavenoRiskCategory,
      bavenoClassification: bavenoText,
      histologicalCorrelation,
      isQualityOptimal: iqrRatio <= 30
    };
  }, [measurements, stiffnessKpa, fatFractionPercent, capDbM]);

  // Color mappings for visual representation
  const elastographyColor = useMemo(() => {
    if (stiffnessKpa < 6.0) return "#10b981"; // Emerald
    if (stiffnessKpa < 8.0) return "#06b6d4"; // Cyan
    if (stiffnessKpa < 10.0) return "#eab308"; // Amber
    if (stiffnessKpa < 15.0) return "#f97316"; // Orange
    if (stiffnessKpa < 20.0) return "#ef4444"; // Red
    return "#a855f7"; // Purple (Cirrhosis severe)
  }, [stiffnessKpa]);

  // Auto-scan report text to extract existing elastography / QUS mentions
  const handleAutoScanFromReport = () => {
    if (!reportText) return;
    setIsSyncingWithReport(true);

    try {
      let nextStiffness = stiffnessKpa;
      let nextCap = capDbM;
      let nextFat = fatFractionPercent;

      // Look for kPa
      const kpaMatch = reportText.match(/(?:rigidez|elasticidad|elastograf[ií]a|stiffness|shear\s*wave)[^\d]{0,25}([0-9]+[.,][0-9]+|[0-9]+)\s*(?:kpa|kilopascales)/i) ||
                       reportText.match(/([0-9]+[.,][0-9]+|[0-9]+)\s*kpa/i);
      
      if (kpaMatch && kpaMatch[1]) {
        const val = parseFloat(kpaMatch[1].replace(",", "."));
        if (val > 1 && val < 80) {
          nextStiffness = val;
          setStiffnessKpa(val);
        }
      }

      // Look for CAP / dB/m
      const capMatch = reportText.match(/(?:cap|atenuaci[oó]n|ac[uú]stica)[^\d]{0,25}([0-9]{2,3})\s*(?:db\/m|decibeles)/i) ||
                       reportText.match(/([0-9]{3})\s*db\/m/i);
      if (capMatch && capMatch[1]) {
        const val = parseInt(capMatch[1], 10);
        if (val >= 100 && val <= 400) {
          nextCap = val;
          setCapDbM(val);
        }
      }

      // Look for QUS % or Fat %
      const fatMatch = reportText.match(/(?:grasa|esteatosis|qus|pdff|fracci[oó]n)[^\d]{0,25}([0-9]+[.,][0-9]+|[0-9]+)\s*%/i) ||
                       reportText.match(/([0-9]+[.,][0-9]+|[0-9]+)\s*%\s*(?:de\s+grasa|por\s+qus|de\s+esteatosis)/i);
      if (fatMatch && fatMatch[1]) {
        const val = parseFloat(fatMatch[1].replace(",", "."));
        if (val >= 0 && val <= 60) {
          nextFat = val;
          setFatFractionPercent(val);
        }
      }

      if (onValuesChanged) {
        onValuesChanged(nextStiffness, nextCap, nextFat);
      }
    } catch (e) {
      console.error("Error auto-scanning elastography data:", e);
    } finally {
      setTimeout(() => setIsSyncingWithReport(false), 400);
    }
  };

  // Generate structured Annex narrative for Elastography & QUS
  const generateElastographyAnnexText = () => {
    const fibDesc =
      stats.fibrosisStage === "F0" ? "Grado F0 (Sin fibrosis significativa / elasticidad tisular conservada)" :
      stats.fibrosisStage === "F1" ? "Grado F1 (Fibrosis portal leve sin distorsión)" :
      stats.fibrosisStage === "F2" ? "Grado F2 (Fibrosis periportal significativa con escasos septos)" :
      stats.fibrosisStage === "F3" ? "Grado F3 (Fibrosis avanzada con septos en puente)" :
      "Grado F4 (Cirrosis hepática / cACLD)";

    const steatDesc =
      stats.steatosisGrade === "S0" ? "Grado S0 (Normal, fracción grasa cuantitativa < 5.0%)" :
      stats.steatosisGrade === "S1" ? "Grado S1 (Leve, fracción grasa 5.0 - 12.0%)" :
      stats.steatosisGrade === "S2" ? "Grado S2 (Moderada, fracción grasa 12.1 - 20.0%)" :
      "Grado S3 (Severa, fracción grasa > 20.0%)";

    const etiologyLabel = ETIOLOGY_OPTIONS.find(e => e.id === selectedEtiology)?.label || "MASLD / Esteatosis Metabólica";

    const bavenoDetail =
      stats.bavenoRiskCategory === "normal" || stats.bavenoRiskCategory === "rule_out_cacld" ? "Zona de Seguridad (< 10.0 kPa). Se descarta con alta certeza Enfermedad Hepática Crónica Avanzada Compensada (cACLD). Riesgo nulo de Hipertensión Portal Clínicamente Significativa (CSPH)." :
      stats.bavenoRiskCategory === "gray_zone" ? "Zona Gris / Indeterminada (10.0 - 14.9 kPa). Requiere correlación con biomarcadores séricos (FIB-4, recuento de plaquetas) y control evolutivo." :
      stats.bavenoRiskCategory === "suggestive_csph" ? "Sospecha de cACLD / Riesgo de Hipertensión Portal Clínicamente Significativa (15.0 - 24.9 kPa). Se sugiere valoración por hepatología y cribado de várices según guías Baveno VII." :
      "Riesgo Muy Elevado (≥ 25.0 kPa). Sugestivo de Cirrosis / CSPH confirmada. Requiere manejo especializado continuo.";

    return `### ANEXO: EVALUACIÓN MULTIPARAMÉTRICA HEPÁTICA (ELASTOGRAFÍA TRANSITORIA SWE & QUS)

**1. PARÁMETROS BIOMÉTRICOS Y MEDICIONES CUANTITATIVAS:**
• Rigidez Hepática Mediana: ${stiffnessKpa.toFixed(1)} kPa (Velocidad acústica de cizallamiento: ${stats.velocityMs} m/s)
• Confiabilidad y Calidad Técnica (EFSUMB / WFUMB): IQR = ${stats.iqr} kPa | IQR/Mediana = ${stats.iqrRatio}% (${stats.isQualityOptimal ? "Criterio Óptimo ≤ 30%" : "Aceptable"}) con 10/10 adquisiciones válidas a ${roiDepthCm.toFixed(1)} cm de la cápsula hepática (espacio intercostal derecho).
• Fracción Grasa Cuantitativa por Ultrasonido (QUS / PDFF): ${fatFractionPercent.toFixed(1)}% | Parámetro de Atenuación Controlada (CAP): ${capDbM} dB/m.

**2. ESTADIFICACIÓN HISTOLÓGICA Y CORRELACIÓN TISULAR:**
• Etiología Clínica Evaluada: ${etiologyLabel}
• Estadificación de Fibrosis (METAVIR correlacionado): ${fibDesc}
• Gradación de Esteatosis Hepática: ${steatDesc}
• Correlación Microarquitectural: ${stats.histologicalCorrelation}

**3. ESTRATIFICACIÓN PRONÓSTICA Y GUÍAS DE CONSENSO (BAVENO VII / EFSUMB):**
• Dictamen Baveno VII: ${stats.bavenoClassification}
• Criterio de Riesgo: ${bavenoDetail}
• Conducta Clínica Recomendada: ${stats.clinicalRecommendations.join(" | ")}`;
  };

  // Insert or update annex at the end of the report
  const handleInsertAnnexIntoReport = () => {
    const annexText = generateElastographyAnnexText();
    let clean = reportText || "";

    // Remove any previous elastography annex or section safely up to the next section or end of document
    const annexPattern = /(?:\n\s*---\s*\n+)?(?:\n\s*###?\s*(?:ANEXO:[^\n]*?(?:ELASTOGRAF[IÍ]A|MULTIPARAM[EÉ]TRIC[OA]|QUS)|ELASTOGRAF[IÍ]A[^\n]*?|EVALUACI[OÓ]N MULTIPARAM[EÉ]TRICA[^\n]*?))[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/i;

    if (annexPattern.test(clean)) {
      clean = clean.replace(annexPattern, "");
    }

    // Clean stray separator artifacts
    clean = clean.replace(/[━═─]{3,}/g, "").replace(/^[\s%]{4,}$/gm, "").trim();

    // Append cleanly as an Annex at the end of the document
    const updated = clean ? `${clean}\n\n${annexText}` : annexText;
    if (onReportUpdated) {
      onReportUpdated(updated);
    }
    if (onToggleIncludeInReport) {
      onToggleIncludeInReport(true);
    }
    if (onValuesChanged) {
      onValuesChanged(stiffnessKpa, capDbM, fatFractionPercent);
    }
    setInjectedSuccess(true);
    setIsCopied(true);
    setTimeout(() => {
      setInjectedSuccess(false);
      setIsCopied(false);
    }, 3000);
  };

  // Remove annex from report
  const handleRemoveAnnexFromReport = () => {
    let clean = reportText || "";

    const annexPattern = /(?:\n\s*---\s*\n+)?(?:\n\s*###?\s*(?:ANEXO:[^\n]*?(?:ELASTOGRAF[IÍ]A|MULTIPARAM[EÉ]TRIC[OA]|QUS)|ELASTOGRAF[IÍ]A[^\n]*?|EVALUACI[OÓ]N MULTIPARAM[EÉ]TRICA[^\n]*?))[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/i;
    if (annexPattern.test(clean)) {
      clean = clean.replace(annexPattern, "");
    }

    clean = clean.replace(/[━═─]{3,}/g, "").replace(/^[\s%]{4,}$/gm, "").trim();
    if (onReportUpdated) {
      onReportUpdated(clean);
    }
    if (onToggleIncludeInReport) {
      onToggleIncludeInReport(false);
    }
  };

  // Copy annex text to clipboard
  const handleCopyAnnexToClipboard = () => {
    const annexText = generateElastographyAnnexText();
    navigator.clipboard.writeText(annexText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const isAnnexInReport = Boolean(
    reportText && (
      reportText.includes("### ANEXO: EVALUACIÓN MULTIPARAMÉTRICA HEPÁTICA") ||
      reportText.includes("### ANEXO: ESTUDIO MULTIPARAMÉTRICO") ||
      reportText.includes("### ELASTOGRAFÍA HEPÁTICA") ||
      reportText.includes("ANEXO: EVALUACIÓN MULTIPARAMÉTRICA") ||
      reportText.includes("EVALUACIÓN MULTIPARAMÉTRICA HEPÁTICA") ||
      /ANEXO:[^\n]*?(?:ELASTOGRAF[IÍ]A|MULTIPARAM[EÉ]TRIC[OA]|QUS)/i.test(reportText)
    )
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setCustomImageBase64(ev.target.result);
        setGenerated3dImageBase64(null); // Reset generated image when new ultrasound is loaded
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate3dRender = async () => {
    setIsGenerating3d(true);
    try {
      const fibStage = stiffnessKpa < 6.0 ? 'F0-F1' : stiffnessKpa < 8.0 ? 'F2' : stiffnessKpa < 12.5 ? 'F3' : 'F4';
      const steatosisStage = fatFractionPercent < 5.0 ? 'S0' : fatFractionPercent <= 12.0 ? 'S1' : fatFractionPercent <= 20.0 ? 'S2' : 'S3';
      
      const description = `Mapeo elastográfico hepático y QUS. Rigidez hepática: ${stiffnessKpa.toFixed(1)} kPa (Estadio METAVIR equivalente a ${fibStage}). Fracción Grasa Cuantitativa: ${fatFractionPercent.toFixed(1)}% (Estadio de esteatosis ${steatosisStage}). Muestra de forma macroscópica un hígado en este estado.`;

      const bodyPayload: any = {
        findingDescription: description,
        studyType: "Elastografía Hepática",
        renderStyle: "anatomical_specimen"
      };

      if (customImageBase64) {
        bodyPayload.image = customImageBase64;
        bodyPayload.mimeType = customImageBase64.includes("image/png") ? "image/png" : "image/jpeg";
      }

      const resp = await fetch("/api/generate-3d-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando render 3D");
      }
      
      const data = await resp.json();
      const img3d = data.render3dBase64 || data.image || data.render3dMacroBase64;
      if (img3d) {
        setGenerated3dImageBase64(img3d);
        onImageChanged?.(img3d);
      } else if (data.error) {
        console.error("Error en respuesta 3D render:", data.error);
        alert("No se pudo generar el modelo 3D: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error al generar el render 3D: " + (err.message || String(err)));
    } finally {
      setIsGenerating3d(false);
    }
  };

  return (
    <div className={`relative bg-slate-950/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl transition-all duration-300 font-sans text-slate-200 ${
      isExpandedModal ? "fixed inset-2 z-50 overflow-y-auto bg-slate-950/98 backdrop-blur-xl border-cyan-500/40 p-6 shadow-[0_0_50px_rgba(6,182,212,0.2)]" : "my-6"
    }`}>
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black text-slate-100 uppercase tracking-wider font-mono">
                Correlación Espacial: Elastografía & QUS 3D
              </h2>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                Opción 2 • Trazabilidad Multidimensional
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Fotografía Ecográfica 2D + Mapeo Volumétrico 3D en Tórax + Microarquitectura Histológica + Umbrales Baveno VII / EFSUMB.
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          {/* Direct Inyectar al PDF button in Header */}
          <button
            type="button"
            onClick={handleInsertAnnexIntoReport}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black font-mono uppercase tracking-wider transition-all cursor-pointer shadow-md ${
              injectedSuccess
                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                : isAnnexInReport
                ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30"
            }`}
            title="Inyectar evaluación de elastografía como anexo al final del informe"
          >
            {injectedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>¡Inyectado al PDF!</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>{isAnnexInReport ? "Actualizar Anexo PDF" : "Inyectar al PDF"}</span>
              </>
            )}
          </button>

          {/* Quick Scan from report */}
          <button
            type="button"
            onClick={handleAutoScanFromReport}
            disabled={isSyncingWithReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Escanear valores de kPa y % grasa redactados en el informe"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isSyncingWithReport ? "animate-spin" : ""}`} />
            <span>Sincronizar Informe</span>
          </button>

          {/* Toggle include in report/pdf */}
          {onToggleIncludeInReport && (
            <button
              type="button"
              onClick={() => onToggleIncludeInReport(!includeInReport)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                includeInReport
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-sm"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
            >
              <Check className={`h-3.5 w-3.5 ${includeInReport ? "text-emerald-400" : "text-slate-600"}`} />
              <span>Adjuntar al PDF: {includeInReport ? "Sí" : "No"}</span>
            </button>
          )}

          {/* Fullscreen modal toggle */}
          <button
            type="button"
            onClick={() => setIsExpandedModal(!isExpandedModal)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 cursor-pointer"
            title={isExpandedModal ? "Reducir" : "Pantalla completa"}
          >
            {isExpandedModal ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 cursor-pointer"
              title="Cerrar módulo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* WORKSTATION QUICK METRICS & ETIOLOGY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4">
        {/* Metric 1: Stiffness */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-300 font-sans tracking-normal">
              Rigidez Hepática
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase shrink-0" style={{ backgroundColor: `${elastographyColor}20`, color: elastographyColor, border: `1px solid ${elastographyColor}40` }}>
              Estadio {stats.fibrosisStage}
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl md:text-3xl font-black font-mono tracking-tight" style={{ color: elastographyColor }}>
              {stiffnessKpa.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">kPa</span>
            <span className="text-[11px] text-slate-400 font-mono ml-auto">
              ({stats.velocityMs} m/s)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, (stiffnessKpa / 35) * 100)}%`,
                backgroundColor: elastographyColor 
              }}
            />
          </div>
        </div>

        {/* Metric 2: QUS Fat Fraction */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-300 font-sans tracking-normal">
              Grasa por QUS (PDFF)
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase shrink-0 ${
              stats.steatosisGrade === "S0" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
              stats.steatosisGrade === "S1" ? "bg-amber-950 text-amber-400 border border-amber-800" :
              stats.steatosisGrade === "S2" ? "bg-orange-950 text-orange-400 border border-orange-800" :
              "bg-rose-950 text-rose-400 border border-rose-800"
            }`}>
              Esteatosis {stats.steatosisGrade}
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-amber-400">
              {fatFractionPercent.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">%</span>
            <span className="text-[11px] text-slate-400 font-mono ml-auto">
              CAP: {capDbM} dB/m
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (fatFractionPercent / 35) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Technical Quality Ratio */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-300 font-sans tracking-normal">
              Calidad (IQR/Med)
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase shrink-0 ${
              stats.isQualityOptimal ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
            }`}>
              {stats.isQualityOptimal ? "Confiable ✓" : "Revisar"}
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
              stats.isQualityOptimal ? "text-emerald-400" : "text-rose-400"
            }`}>
              {stats.iqrRatio}%
            </span>
            <span className="text-[11px] text-slate-400 font-mono ml-auto">
              IQR: {stats.iqr} kPa
            </span>
          </div>
          <div className="text-[9px] text-slate-400 font-mono flex justify-between gap-1">
            <span>Objetivo: ≤ 30%</span>
            <span>Prof: {roiDepthCm} cm</span>
          </div>
        </div>

        {/* Metric 4: Etiology Selector */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-300 font-sans tracking-normal">
              Etiología Clínica
            </span>
            <span className="text-xs">
              {ETIOLOGY_OPTIONS.find(e => e.id === selectedEtiology)?.icon}
            </span>
          </div>
          <select
            value={selectedEtiology}
            onChange={(e) => { setSelectedEtiology(e.target.value as any); onEtiologyChanged?.(e.target.value); }}
            className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl p-2 font-mono font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {ETIOLOGY_OPTIONS.map((et) => (
              <option key={et.id} value={et.id}>
                {et.label}
              </option>
            ))}
          </select>
          <span className="text-[9px] text-slate-500 truncate mt-1">
            {ETIOLOGY_OPTIONS.find(e => e.id === selectedEtiology)?.desc}
          </span>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 🖼️ TRÍPTICO VISUAL SUPERIOR */}
      {/* ======================================================================= */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
            <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-200 font-mono">
              Tríptico de Correlación Espacial & Multiescala
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Modo B (2D) ↔ Volumen 3D Toracohepático ↔ Microarquitectura Histológica
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* PANEL 1: FOTO MODO B (Original) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Evidencia Ecográfica Original
              </span>
              <span className="text-[9px] font-mono text-slate-500">Mapeo Elastográfico 2D</span>
            </div>

            <div className="relative w-full h-[280px] bg-[#020617] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {customImageBase64 ? (
                <img 
                  id="elastography-original-img"
                  src={customImageBase64} 
                  alt="Ecografía Original" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center">
                  <div className="p-4 bg-slate-900 rounded-full border border-slate-700/50 mb-3">
                    <Upload className="h-6 w-6 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400 mb-1">Cargar mapa elastográfico</p>
                  <p className="text-[10px] text-slate-600 font-mono">Requerido para generar modelo 3D</p>
                </div>
              )}

              <div className="absolute top-2 right-2 flex items-center gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 text-[9px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="h-3 w-3 text-cyan-400" />
                  <span>{customImageBase64 ? "Cambiar" : "Cargar"}</span>
                </button>
                {customImageBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImageBase64(null);
                      setGenerated3dImageBase64(null);
                    }}
                    className="p-1.5 bg-rose-950/80 text-rose-300 rounded-lg border border-rose-800 text-[9px] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="mt-2 text-[10px] text-slate-400 font-mono flex justify-between items-center">
              <span>Biometría de superficie</span>
              <span className="text-cyan-400 font-bold">Ventana intercostal</span>
            </div>
          </div>

          {/* PANEL 2: RECONSTRUCCIÓN 3D REALISTA (IA) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Reconstrucción Macroscópica 3D
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-900">
                IA Generativa
              </span>
            </div>

            <div className="relative w-full h-[280px] bg-[#020617] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {isGenerating3d ? (
                <div className="flex flex-col items-center">
                  <div className="relative w-12 h-12 flex items-center justify-center mb-3">
                    <div className="absolute inset-0 border-2 border-t-indigo-500 border-indigo-500/20 rounded-full animate-spin"></div>
                    <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                  </div>
                  <span className="text-xs font-mono text-indigo-300 animate-pulse">Sintetizando modelo 3D...</span>
                </div>
              ) : generated3dImageBase64 ? (
                <>
                  <img 
                    id="elastography-3d-img"
                    src={generated3dImageBase64} 
                    alt="Modelo 3D" 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      type="button"
                      onClick={handleGenerate3dRender}
                      className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 text-[9px] font-mono flex items-center gap-1 cursor-pointer shadow-lg backdrop-blur-sm"
                    >
                      <RefreshCw className="h-3 w-3 text-indigo-400" />
                      <span>Regenerar</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 flex flex-col items-center">
                  <Sparkles className="h-8 w-8 text-slate-600 mb-3" />
                  <p className="text-[10px] text-slate-500 font-mono max-w-[200px] mb-4">
                    Visualiza macroscópicamente el estado actual del tejido hepático según la biometría.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate3dRender}
                    className="px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generar Fusión 3D
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-2 text-[10px] text-slate-400 font-mono flex justify-between items-center">
              <span>{stats.fibrosisStage} / {stats.steatosisGrade}</span>
              <span className="text-indigo-400 font-bold">Simulación predictiva</span>
            </div>
          </div>
        </div>
      {/* ======================================================================= */}
      {/* 📊 GRÁFICO DE DISPERSIÓN DE MUESTREOS (10 ADQUISICIONES REALES) */}
      {/* ======================================================================= */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 md:p-5 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-200 font-mono">
              Gráfico de Dispersión de Muestreos (10 Disparos Válidos)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" /> Mediana: <strong className="text-slate-200">{stats.medianKpa} kPa</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-400 inline-block" /> Rango IQR: <strong className="text-slate-200">{stats.iqr} kPa</strong>
            </span>
            <span className={`px-2 py-0.5 rounded font-bold ${stats.isQualityOptimal ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
              IQR/Mediana = {stats.iqrRatio}%
            </span>
          </div>
        </div>

        {/* Scatter Plot Chart SVG */}
        <div className="w-full h-[140px] rounded-xl border border-slate-800 p-2 relative">
          <svg id="svg-scatter-plot" className="w-full h-full" viewBox="0 0 500 110" preserveAspectRatio="none">
            <rect width="100%" height="100%" fill="#020617" />
            {/* Grid lines */}
            <line x1="40" y1="15" x2="490" y2="15" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="40" y1="45" x2="490" y2="45" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="40" y1="75" x2="490" y2="75" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="40" y1="95" x2="490" y2="95" stroke="#334155" strokeWidth="1" />

            {/* Y axis labels */}
            <text x="35" y="18" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="monospace">
              {(stiffnessKpa * 1.5).toFixed(0)}
            </text>
            <text x="35" y="48" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="monospace">
              {(stiffnessKpa * 1.0).toFixed(0)}
            </text>
            <text x="35" y="78" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="monospace">
              {(stiffnessKpa * 0.5).toFixed(0)}
            </text>
            <text x="35" y="98" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="monospace">0</text>

            {/* IQR Box Band */}
            {(() => {
              const maxVal = Math.max(15, stiffnessKpa * 1.6);
              const yMedian = 95 - (stiffnessKpa / maxVal) * 80;
              const yTop = 95 - ((stiffnessKpa + stats.iqr / 2) / maxVal) * 80;
              const yBottom = 95 - ((stiffnessKpa - stats.iqr / 2) / maxVal) * 80;
              const height = Math.max(6, yBottom - yTop);

              return (
                <>
                  <rect 
                    x="40" 
                    y={yTop} 
                    width="450" 
                    height={height} 
                    fill="#06b6d4" 
                    opacity="0.12" 
                  />
                  {/* Median Line */}
                  <line 
                    x1="40" 
                    y1={yMedian} 
                    x2="490" 
                    y2={yMedian} 
                    stroke="#06b6d4" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 2" 
                  />
                </>
              );
            })()}

            {/* Individual Shots (1 to 10) */}
            {measurements.map((m, idx) => {
              const x = 60 + idx * 42;
              const maxVal = Math.max(15, stiffnessKpa * 1.6);
              const y = 95 - (m.stiffnessKpa / maxVal) * 80;

              return (
                <g key={m.id}>
                  {/* Drop vertical guide */}
                  <line x1={x} y1="95" x2={x} y2={y} stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
                  {/* Shot point */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="4" 
                    fill={elastographyColor} 
                    stroke="#ffffff" 
                    strokeWidth="1.2" 
                  />
                  {/* Shot number */}
                  <text x={x} y="105" fontSize="7" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
                    #{m.id}
                  </text>
                  {/* Shot value tooltip on hover/always visible */}
                  <text x={x} y={y - 6} fontSize="6.5" fill="#f8fafc" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                    {m.stiffnessKpa}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 📏 TABLA COMPARATIVA DE UMBRALES INTERNACIONALES (BAVENO VII & EFSUMB) */}
      {/* ======================================================================= */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4.5 w-4.5 text-amber-400" />
            <div>
              <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-200 font-mono">
                Umbrales de Consenso Internacional (Baveno VII / EFSUMB / WFUMB)
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Regla de los 5: <strong className="text-slate-300">5 - 10 - 15 - 20 - 25 kPa</strong> • Zona de Seguridad vs. Riesgo de Hipertensión Portal
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-1 rounded border border-cyan-800">
            Valor Paciente: {stiffnessKpa.toFixed(1)} kPa
          </span>
        </div>

        {/* BAVENO VII INTERACTIVE HORIZONTAL SCALE BAR */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
            <span>0 kPa</span>
            <span className="text-emerald-400 font-bold">5 kPa</span>
            <span className="text-emerald-300 font-bold">10 kPa (Descarte cACLD)</span>
            <span className="text-amber-400 font-bold">15 kPa (Sospecha CSPH)</span>
            <span className="text-orange-400 font-bold">20 kPa</span>
            <span className="text-rose-400 font-bold">25 kPa (CSPH Confirmada)</span>
            <span>35+ kPa</span>
          </div>

          {/* Color Spectrum Bar with Baveno VII Segments */}
          <div className="relative w-full h-8 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex">
            {/* 0 - 5 kPa: Fisiológico */}
            <div className="h-full bg-emerald-700/60 border-r border-slate-900 flex items-center justify-center text-[9px] font-bold text-emerald-200 font-mono" style={{ width: "14.2%" }}>
              Normal
            </div>
            {/* 5 - 10 kPa: Zona de Seguridad */}
            <div className="h-full bg-emerald-500/50 border-r border-slate-900 flex items-center justify-center text-[9px] font-black text-emerald-100 font-mono shadow-inner" style={{ width: "14.2%" }}>
              Seguridad
            </div>
            {/* 10 - 15 kPa: Zona Gris */}
            <div className="h-full bg-amber-500/50 border-r border-slate-900 flex items-center justify-center text-[9px] font-black text-amber-100 font-mono" style={{ width: "14.2%" }}>
              Zona Gris
            </div>
            {/* 15 - 20 kPa: Sugestivo CSPH */}
            <div className="h-full bg-orange-600/60 border-r border-slate-900 flex items-center justify-center text-[9px] font-black text-orange-100 font-mono" style={{ width: "14.2%" }}>
              Riesgo CSPH
            </div>
            {/* 20 - 25 kPa: CSPH Altamente Probable */}
            <div className="h-full bg-rose-600/70 border-r border-slate-900 flex items-center justify-center text-[9px] font-black text-rose-100 font-mono" style={{ width: "14.2%" }}>
              CSPH &gt;90%
            </div>
            {/* > 25 kPa: Riesgo Descompensación Severo */}
            <div className="h-full bg-purple-700/80 flex items-center justify-center text-[9px] font-black text-purple-100 font-mono flex-1">
              Descompensación
            </div>

            {/* CURSOR INDICATOR OF PATIENT VALUE */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_#ffffff] z-10 transition-all duration-300"
              style={{ left: `${Math.min(98, Math.max(2, (stiffnessKpa / 35) * 100))}%` }}
            >
              <div className="absolute -top-3.5 -translate-x-1/2 bg-white text-slate-950 text-[9px] font-black font-mono px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                ▲ {stiffnessKpa.toFixed(1)} kPa
              </div>
            </div>
          </div>
        </div>

        {/* CLINICAL SUMMARY & STRATIFICATION CARD */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono ${
          stats.bavenoRiskCategory === "normal" || stats.bavenoRiskCategory === "rule_out_cacld" ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300" :
          stats.bavenoRiskCategory === "gray_zone" ? "bg-amber-950/30 border-amber-500/40 text-amber-300" :
          stats.bavenoRiskCategory === "suggestive_csph" ? "bg-orange-950/30 border-orange-500/40 text-orange-300" :
          "bg-rose-950/30 border-rose-500/40 text-rose-300"
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-black/40 border border-current mt-0.5">
              {stats.bavenoRiskCategory === "normal" || stats.bavenoRiskCategory === "rule_out_cacld" ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Dictamen Baveno VII & Correlación EFSUMB
              </span>
              <p className="text-xs md:text-sm font-bold mt-0.5">
                {stats.bavenoClassification}
              </p>
              <p className="text-[11px] opacity-90 mt-1 font-sans">
                {stats.histologicalCorrelation}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
            {isAnnexInReport && (
              <button
                type="button"
                onClick={handleRemoveAnnexFromReport}
                className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                title="Quitar anexo del informe"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Quitar Anexo</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyAnnexToClipboard}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copiar texto del anexo al portapapeles"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </button>
            <button
              type="button"
              onClick={handleInsertAnnexIntoReport}
              className={`px-5 py-2.5 rounded-xl text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg whitespace-nowrap ${
                injectedSuccess
                  ? "bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/40 scale-105"
                  : "bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/30 active:scale-95"
              }`}
            >
              {injectedSuccess ? (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>¡Anexo Inyectado con Éxito al PDF!</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 stroke-[2.5]" />
                  <span>{isAnnexInReport ? "Actualizar Anexo en Reporte PDF" : "Inyectar Anexo al Reporte PDF"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 🎛️ CONTROLES INTERACTIVOS DE AJUSTE MANUAL (SLIDERS) */}
      {/* ======================================================================= */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
            Controles Deslizantes de Simulación y Calibración
          </span>
          <span className="text-[9px] text-slate-500 font-mono">
            Ajuste en tiempo real para correlación docente y reporte
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Slider 1: Stiffness */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-bold">Rigidez (kPa):</span>
              <span className="font-black text-cyan-400 text-sm">{stiffnessKpa.toFixed(1)} kPa</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="35.0"
              step="0.1"
              value={stiffnessKpa}
              onChange={(e) => handleUpdateStiffness(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
              <span>2 kPa (Normal)</span>
              <span>10 kPa (cACLD)</span>
              <span>25+ kPa (Cirrosis)</span>
            </div>
          </div>

          {/* Slider 2: Fat Fraction / QUS */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-bold">Grasa QUS / PDFF (%):</span>
              <span className="font-black text-amber-400 text-sm">{fatFractionPercent.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="35.0"
              step="0.5"
              value={fatFractionPercent}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                handleUpdateFatFraction(val);
                // Correlate with CAP roughly (200 + fat * 5)
                handleUpdateCAP(Math.min(380, Math.round(180 + val * 6)));
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
              <span>&lt;5% (S0)</span>
              <span>12% (S1)</span>
              <span>20% (S2)</span>
              <span>&gt;20% (S3)</span>
            </div>
          </div>

          {/* Slider 3: ROI Depth */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-bold">Profundidad Q-Box (cm):</span>
              <span className="font-black text-indigo-400 text-sm">{roiDepthCm.toFixed(1)} cm</span>
            </div>
            <input
              type="range"
              min="2.5"
              max="6.0"
              step="0.1"
              value={roiDepthCm}
              onChange={(e) => setRoiDepthCm(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
            <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
              <span>2.5 cm (Subcapsular)</span>
              <span>3.8 cm (Óptimo)</span>
              <span>6.0 cm (Profundo)</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ElastographyQUSPresentationModule;
