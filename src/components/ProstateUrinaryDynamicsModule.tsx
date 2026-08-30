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
  X,
  Droplets,
  Scale
} from "lucide-react";

export interface ProstateUrinaryData {
  prostateLengthCm: number;
  prostateApCm: number;
  prostateTransverseCm: number;
  prostateVolumeCc: number;
  prostateGrade: string;
  ippMm: number;
  ippGrade: string;
  medianLobe: string;
  echoStructure: string;
  preVoidVolumeMl: number;
  postVoidVolumeMl: number;
  postVoidResidualPercent: number;
  retentionGrade: string;
  bladderWallMm: number;
  bladderTrabeculation: string;
  kidneysUpperTract: string;
  booRisk: "Bajo" | "Intermedio" | "Alto";
  customImageBase64: string | null;
  generated3dImageBase64: string | null;
  clinicalConclusion: string;
  urologicalRecommendations: string[];
}

interface ProstateUrinaryDynamicsModuleProps {
  selectedModel?: string;
  reportText: string;
  onReportUpdated?: (newReport: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
  onProstateDataUpdated?: (data: ProstateUrinaryData | null) => void;
  includeInReport?: boolean;
  onToggleIncludeInReport?: (include: boolean) => void;
}

export const ProstateUrinaryDynamicsModule: React.FC<ProstateUrinaryDynamicsModuleProps> = ({
  selectedModel = "models/gemini-2.5-flash",
  reportText,
  onReportUpdated,
  onClose,
  isOpen = true,
  onProstateDataUpdated,
  includeInReport = true,
  onToggleIncludeInReport
}) => {
  // Module inclusion tracking
  const [isModuleIncluded, setIsModuleIncluded] = useState<boolean>(includeInReport);

  useEffect(() => {
    setIsModuleIncluded(includeInReport);
  }, [includeInReport]);

  // Dimensions & Volumetrics
  const [prostateLengthCm, setProstateLengthCm] = useState<number>(4.2);
  const [prostateApCm, setProstateApCm] = useState<number>(3.6);
  const [prostateTransverseCm, setProstateTransverseCm] = useState<number>(4.8);
  const [customProstateVolume, setCustomProstateVolume] = useState<number | null>(null);
  
  // Intravesical Prostatic Protrusion & Morphology
  const [ippMm, setIppMm] = useState<number>(5.5);
  const [medianLobe, setMedianLobe] = useState<string>("Presente con impronta intravesical");
  const [echoStructure, setEchoStructure] = useState<string>("Heterogénea con nódulos de hiperplasia adenomatosa");
  
  // Dynamic Bladder Voiding
  const [preVoidVolumeMl, setPreVoidVolumeMl] = useState<number>(380);
  const [postVoidVolumeMl, setPostVoidVolumeMl] = useState<number>(45);
  const [bladderWallMm, setBladderWallMm] = useState<number>(2.8);
  const [bladderTrabeculation, setBladderTrabeculation] = useState<string>("Paredes lisas de grosor conservado");
  const [kidneysUpperTract, setKidneysUpperTract] = useState<string>("Sin ectasia pielocalicial retrógrada");
  const [customProstateGrade, setCustomProstateGrade] = useState<string | null>(null);
  const [customRetentionGrade, setCustomRetentionGrade] = useState<string | null>(null);
  const [customIppGrade, setCustomIppGrade] = useState<string | null>(null);
  const [customBooRisk, setCustomBooRisk] = useState<"Bajo" | "Intermedio" | "Alto" | null>(null);
  const [customClinicalConclusion, setCustomClinicalConclusion] = useState<string | null>(null);
  const [customUrologicalRecommendations, setCustomUrologicalRecommendations] = useState<string[] | null>(null);
  
  // View states & 3D
  const [activeTab, setActiveTab] = useState<"3d_render" | "biometry" | "guidelines">("3d_render");
  const [isSyncingWithReport, setIsSyncingWithReport] = useState<boolean>(false);
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);
  const [generated3dImageBase64, setGenerated3dImageBase64] = useState<string | null>(null);
  const [isGenerating3d, setIsGenerating3d] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [injectedSuccess, setInjectedSuccess] = useState<boolean>(false);
  const [isExpandedModal, setIsExpandedModal] = useState<boolean>(false);
  const [viewAngle, setViewAngle] = useState<number>(0);
  const [simulationMode, setSimulationMode] = useState<"pre" | "post" | "compare">("compare");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Derived calculations
  const calculatedProstateVolume = useMemo(() => {
    if (customProstateVolume !== null && customProstateVolume > 0) {
      return customProstateVolume;
    }
    // Ellipsoid formula: L * AP * T * 0.523 (or pi/6)
    const vol = prostateLengthCm * prostateApCm * prostateTransverseCm * 0.523;
    return parseFloat(vol.toFixed(1));
  }, [prostateLengthCm, prostateApCm, prostateTransverseCm, customProstateVolume]);

  const prostateGrade = useMemo(() => {
    if (customProstateGrade) return customProstateGrade;
    const vol = calculatedProstateVolume;
    if (vol < 25) return "Normal (<25 cc)";
    if (vol <= 40) return "Grado I - Leve (25 - 40 cc)";
    if (vol <= 60) return "Grado II - Moderada (41 - 60 cc)";
    if (vol <= 80) return "Grado III - Severa (61 - 80 cc)";
    return "Grado IV - Gigante (>80 cc)";
  }, [calculatedProstateVolume, customProstateGrade]);

  const ippGrade = useMemo(() => {
    if (customIppGrade) return customIppGrade;
    if (ippMm <= 0) return "Grado 0 (Sin protrusión)";
    if (ippMm < 5) return "Grado 1 - Leve (< 5 mm)";
    if (ippMm <= 10) return "Grado 2 - Moderada (5 - 10 mm)";
    return "Grado 3 - Severa (> 10 mm / Obstructiva)";
  }, [ippMm, customIppGrade]);

  const postVoidResidualPercent = useMemo(() => {
    if (preVoidVolumeMl <= 0) return 0;
    const pct = (postVoidVolumeMl / preVoidVolumeMl) * 100;
    return parseFloat(pct.toFixed(1));
  }, [preVoidVolumeMl, postVoidVolumeMl]);

  const retentionGrade = useMemo(() => {
    if (customRetentionGrade) return customRetentionGrade;
    const pct = postVoidResidualPercent;
    const vol = postVoidVolumeMl;
    if (pct <= 10 && vol <= 25) return "Fisiológico / Excelente vaciamiento (≤ 10%)";
    if (pct <= 20 && vol <= 50) return "Fisiológico aceptable (10 - 20%)";
    if (pct <= 30 || (vol > 50 && vol <= 100)) return "Retención Leve a Moderada (20 - 30%)";
    return "Retención Significativa / Severa (> 30% o > 100 mL)";
  }, [postVoidResidualPercent, postVoidVolumeMl, customRetentionGrade]);

  const booRisk = useMemo<"Bajo" | "Intermedio" | "Alto">(() => {
    if (customBooRisk) return customBooRisk;
    if (ippMm >= 10 || postVoidResidualPercent > 35 || calculatedProstateVolume > 65) {
      return "Alto";
    }
    if (ippMm >= 5 || postVoidResidualPercent > 20 || calculatedProstateVolume > 40) {
      return "Intermedio";
    }
    return "Bajo";
  }, [ippMm, postVoidResidualPercent, calculatedProstateVolume, customBooRisk]);

  const clinicalConclusion = useMemo(() => {
    if (customClinicalConclusion) return customClinicalConclusion;
    const volText = `Próstata con volumen aproximado de ${calculatedProstateVolume.toFixed(1)} cc (${prostateGrade}), ecoestructura ${echoStructure.toLowerCase()}.`;
    const ippText = ippMm > 0 ? ` Protrusión prostática intravesical (IPP) de ${ippMm.toFixed(1)} mm (${ippGrade}).` : " Sin protrusión intravesical significativa.";
    const voidText = ` Dinámica miccional: Volumen premiccional de ${preVoidVolumeMl} mL y residuo postmiccional de ${postVoidVolumeMl} mL (${postVoidResidualPercent}% del volumen inicial, clasificado como ${retentionGrade}).`;
    const wallText = ` Vejiga con pared de ${bladderWallMm} mm (${bladderTrabeculation}). ${kidneysUpperTract}.`;
    const riskText = ` Riesgo estimado de Obstrucción del Tracto de Salida Vesical (BOO): ${booRisk}.`;
    return volText + ippText + voidText + wallText + riskText;
  }, [calculatedProstateVolume, prostateGrade, echoStructure, ippMm, ippGrade, preVoidVolumeMl, postVoidVolumeMl, postVoidResidualPercent, retentionGrade, bladderWallMm, bladderTrabeculation, kidneysUpperTract, booRisk, customClinicalConclusion]);

  const urologicalRecommendations = useMemo(() => {
    if (customUrologicalRecommendations && customUrologicalRecommendations.length > 0) {
      return customUrologicalRecommendations;
    }
    const recs: string[] = [];
    if (booRisk === "Alto") {
      recs.push("Correlación con sintomatología urinaria baja (cuestionario IPSS) y evaluación urológica especializada.");
      recs.push("Considerar flujometría / estudio urodinámico para confirmación de patrón obstructivo.");
    } else if (booRisk === "Intermedio") {
      recs.push("Seguimiento sonográfico periódico del residuo postmiccional y correlación clínica con antígeno prostático específico (PSA).");
    } else {
      recs.push("Control sonográfico rutinario según pauta clínica de detección urológica preventiva.");
    }
    if (postVoidVolumeMl > 100) {
      recs.push("Vigilancia estrecha por elevado volumen de residuo postmiccional (riesgo de uropatía obstructiva e infecciones urinarias de repetición).");
    }
    return recs;
  }, [booRisk, postVoidVolumeMl, customUrologicalRecommendations]);

  // Sync state data to parent if requested
  useEffect(() => {
    if (!onProstateDataUpdated) return;
    if (isModuleIncluded) {
      onProstateDataUpdated({
        prostateLengthCm,
        prostateApCm,
        prostateTransverseCm,
        prostateVolumeCc: calculatedProstateVolume,
        prostateGrade,
        ippMm,
        ippGrade,
        medianLobe,
        echoStructure,
        preVoidVolumeMl,
        postVoidVolumeMl,
        postVoidResidualPercent,
        retentionGrade,
        bladderWallMm,
        bladderTrabeculation,
        kidneysUpperTract,
        booRisk,
        customImageBase64,
        generated3dImageBase64,
        clinicalConclusion,
        urologicalRecommendations
      });
    } else {
      onProstateDataUpdated(null);
    }
  }, [
    isModuleIncluded,
    prostateLengthCm,
    prostateApCm,
    prostateTransverseCm,
    calculatedProstateVolume,
    prostateGrade,
    ippMm,
    ippGrade,
    medianLobe,
    echoStructure,
    preVoidVolumeMl,
    postVoidVolumeMl,
    postVoidResidualPercent,
    retentionGrade,
    bladderWallMm,
    bladderTrabeculation,
    kidneysUpperTract,
    booRisk,
    customImageBase64,
    generated3dImageBase64,
    clinicalConclusion,
    urologicalRecommendations
  ]);

  // Initial automatic AI extraction if reportText is available and hasn't been scanned
  const initialAiScanRef = useRef<boolean>(false);
  useEffect(() => {
    if (!initialAiScanRef.current && reportText && reportText.length > 25) {
      initialAiScanRef.current = true;
      handleAutoScanFromReport();
    }
  }, [reportText]);

  // 3D Canvas Visualizer render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark background with technical grid
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerX = width / 2;
    const bladderBaseY = height * 0.58;

    // Scale factors based on volumes
    const bladderVol = simulationMode === "post" ? postVoidVolumeMl : preVoidVolumeMl;
    const bladderScale = Math.min(1.4, Math.max(0.65, Math.sqrt(bladderVol / 350)));
    const prostateScale = Math.min(1.5, Math.max(0.7, Math.cbrt(calculatedProstateVolume / 25)));
    const protrusionPx = (ippMm / 15) * 45;

    // 1. Draw Bladder Dome & Outline (Translucent 3D Sphere/Oval)
    const bladderRadiusX = 85 * bladderScale;
    const bladderRadiusY = 70 * bladderScale;
    const bladderCenterY = bladderBaseY - bladderRadiusY * 0.75;

    // Bladder Outer Wall Glow
    const wallThick = Math.max(2, bladderWallMm * 1.2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, bladderCenterY, bladderRadiusX + wallThick, bladderRadiusY + wallThick, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
    ctx.fill();
    ctx.strokeStyle = bladderWallMm > 4.0 ? "#f97316" : "#38bdf8";
    ctx.lineWidth = wallThick;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Bladder Fluid Fill (Pre/Post void level)
    const fillPercent = Math.min(1, Math.max(0.05, bladderVol / 450));
    const fluidHeight = bladderRadiusY * 2 * fillPercent;
    const fluidTopY = bladderBaseY - fluidHeight;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, bladderCenterY, bladderRadiusX, bladderRadiusY, 0, 0, Math.PI * 2);
    ctx.clip(); // Clip within bladder cavity

    // Fluid Gradient
    const fluidGrad = ctx.createLinearGradient(0, fluidTopY, 0, bladderBaseY + 20);
    fluidGrad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
    fluidGrad.addColorStop(0.6, "rgba(14, 165, 233, 0.45)");
    fluidGrad.addColorStop(1, "rgba(2, 132, 199, 0.65)");

    ctx.fillStyle = fluidGrad;
    ctx.fillRect(centerX - bladderRadiusX - 10, fluidTopY, (bladderRadiusX + 10) * 2, bladderBaseY - fluidTopY + 50);

    // Fluid surface meniscus
    ctx.beginPath();
    ctx.ellipse(centerX, fluidTopY, bladderRadiusX * Math.sin(Math.acos(Math.max(-0.99, Math.min(0.99, (bladderCenterY - fluidTopY) / bladderRadiusY)))), 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(186, 230, 253, 0.5)";
    ctx.fill();
    ctx.restore();

    // 3. Draw Prostate Base (Chestnut shape with lateral lobes and intravesical protrusion)
    const prostateCenterY = bladderBaseY + 38 * prostateScale;
    const pRadiusX = 55 * prostateScale;
    const pRadiusY = 40 * prostateScale;

    // Prostate shadow & 3D body
    ctx.save();
    const pGrad = ctx.createRadialGradient(
      centerX - pRadiusX * 0.2,
      prostateCenterY - pRadiusY * 0.2,
      5,
      centerX,
      prostateCenterY,
      pRadiusX * 1.1
    );

    if (calculatedProstateVolume > 60) {
      pGrad.addColorStop(0, "#fb923c");
      pGrad.addColorStop(0.5, "#ea580c");
      pGrad.addColorStop(1, "#7c2d12");
    } else if (calculatedProstateVolume > 35) {
      pGrad.addColorStop(0, "#38bdf8");
      pGrad.addColorStop(0.5, "#0284c7");
      pGrad.addColorStop(1, "#0f172a");
    } else {
      pGrad.addColorStop(0, "#34d399");
      pGrad.addColorStop(0.5, "#059669");
      pGrad.addColorStop(1, "#064e3b");
    }

    // Draw Anatomical Prostate with lobes & Intravesical Median Protrusion (IPP)
    ctx.beginPath();
    // Left lobe
    ctx.moveTo(centerX, prostateCenterY - pRadiusY - protrusionPx);
    // Intravesical median lobe protrusion bump into bladder
    if (protrusionPx > 2) {
      ctx.bezierCurveTo(
        centerX - 18,
        prostateCenterY - pRadiusY - protrusionPx,
        centerX - 25,
        bladderBaseY - protrusionPx * 0.8,
        centerX - pRadiusX * 0.7,
        bladderBaseY
      );
    } else {
      ctx.quadraticCurveTo(centerX - pRadiusX * 0.5, bladderBaseY, centerX - pRadiusX, prostateCenterY - pRadiusY * 0.4);
    }

    // Outer left contour
    ctx.bezierCurveTo(
      centerX - pRadiusX * 1.1,
      prostateCenterY,
      centerX - pRadiusX * 0.9,
      prostateCenterY + pRadiusY * 0.8,
      centerX - pRadiusX * 0.3,
      prostateCenterY + pRadiusY
    );

    // Apex at bottom
    ctx.quadraticCurveTo(centerX, prostateCenterY + pRadiusY * 1.05, centerX + pRadiusX * 0.3, prostateCenterY + pRadiusY);

    // Outer right contour
    ctx.bezierCurveTo(
      centerX + pRadiusX * 0.9,
      prostateCenterY + pRadiusY * 0.8,
      centerX + pRadiusX * 1.1,
      prostateCenterY,
      centerX + pRadiusX * 0.7,
      bladderBaseY
    );

    // Right protrusion curve back to top
    if (protrusionPx > 2) {
      ctx.bezierCurveTo(
        centerX + 25,
        bladderBaseY - protrusionPx * 0.8,
        centerX + 18,
        prostateCenterY - pRadiusY - protrusionPx,
        centerX,
        prostateCenterY - pRadiusY - protrusionPx
      );
    } else {
      ctx.quadraticCurveTo(centerX + pRadiusX * 0.5, bladderBaseY, centerX, prostateCenterY - pRadiusY);
    }

    ctx.closePath();
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 4. Prostatic Urethra Lumen (passing through center)
    ctx.beginPath();
    ctx.moveTo(centerX, bladderBaseY - protrusionPx);
    ctx.lineTo(centerX, prostateCenterY + pRadiusY * 1.05);
    ctx.strokeStyle = "rgba(254, 240, 138, 0.9)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 5. IPP Height Measurement Callout
    if (protrusionPx > 3) {
      const calloutX = centerX + pRadiusX * 0.8 + 15;
      const calloutTopY = prostateCenterY - pRadiusY - protrusionPx;
      const calloutBaseY = bladderBaseY;

      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);
      // Top line
      ctx.beginPath(); ctx.moveTo(centerX, calloutTopY); ctx.lineTo(calloutX + 25, calloutTopY); ctx.stroke();
      // Base line
      ctx.beginPath(); ctx.moveTo(centerX + pRadiusX * 0.6, calloutBaseY); ctx.lineTo(calloutX + 25, calloutBaseY); ctx.stroke();
      // Vertical measurement bracket
      ctx.beginPath(); ctx.moveTo(calloutX + 20, calloutTopY); ctx.lineTo(calloutX + 20, calloutBaseY); ctx.stroke();
      ctx.setLineDash([]);

      // Label text
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`IPP: ${ippMm} mm`, calloutX + 25, (calloutTopY + calloutBaseY) / 2 + 3);
    }

    // 6. Overlay Diagnostics Badges
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(12, 12, 160, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 9px monospace";
    ctx.fillText("DINÁMICA VESICAL", 20, 26);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${bladderVol} mL`, 20, 42);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText(simulationMode === "post" ? `Residuo: ${postVoidResidualPercent}%` : `Pared: ${bladderWallMm} mm`, 20, 56);

    ctx.beginPath();
    ctx.roundRect(width - 172, 12, 160, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 9px monospace";
    ctx.fillText("VOLUMETRÍA PROSTÁTICA", width - 162, 26);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${calculatedProstateVolume.toFixed(1)} cc`, width - 162, 42);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText(prostateGrade.split("-")[0], width - 162, 56);

    ctx.restore();
  }, [
    prostateLengthCm,
    prostateApCm,
    prostateTransverseCm,
    calculatedProstateVolume,
    ippMm,
    preVoidVolumeMl,
    postVoidVolumeMl,
    postVoidResidualPercent,
    bladderWallMm,
    simulationMode,
    prostateGrade
  ]);

  // Auto-scan from report text with server-side AI extraction
  const handleAutoScanFromReport = async () => {
    if (!reportText || !reportText.trim()) return;
    setIsSyncingWithReport(true);

    try {
      const resp = await fetch("/api/extract-prostate-urinary-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          model: selectedModel || "gemini-2.5-flash"
        })
      });

      if (!resp.ok) {
        throw new Error("Error en respuesta de extracción IA");
      }

      const result = await resp.json();
      if (result.success && result.data) {
        const d = result.data;
        if (typeof d.prostateVolumeCc === "number" && d.prostateVolumeCc > 0) {
          setCustomProstateVolume(d.prostateVolumeCc);
        }
        if (typeof d.prostateLengthCm === "number" && d.prostateLengthCm > 0) {
          setProstateLengthCm(parseFloat(d.prostateLengthCm.toFixed(1)));
        }
        if (typeof d.prostateApCm === "number" && d.prostateApCm > 0) {
          setProstateApCm(parseFloat(d.prostateApCm.toFixed(1)));
        }
        if (typeof d.prostateTransverseCm === "number" && d.prostateTransverseCm > 0) {
          setProstateTransverseCm(parseFloat(d.prostateTransverseCm.toFixed(1)));
        }
        if (d.prostateGrade) setCustomProstateGrade(d.prostateGrade);
        if (typeof d.preVoidVolumeMl === "number" && d.preVoidVolumeMl > 0) {
          setPreVoidVolumeMl(d.preVoidVolumeMl);
        }
        if (typeof d.postVoidVolumeMl === "number" && d.postVoidVolumeMl >= 0) {
          setPostVoidVolumeMl(d.postVoidVolumeMl);
        }
        if (d.retentionGrade) setCustomRetentionGrade(d.retentionGrade);
        if (typeof d.ippMm === "number" && d.ippMm >= 0) {
          setIppMm(parseFloat(d.ippMm.toFixed(1)));
        }
        if (d.ippGrade) setCustomIppGrade(d.ippGrade);
        if (typeof d.bladderWallMm === "number" && d.bladderWallMm > 0) {
          setBladderWallMm(parseFloat(d.bladderWallMm.toFixed(1)));
        }
        if (d.bladderTrabeculation) setBladderTrabeculation(d.bladderTrabeculation);
        if (d.kidneysUpperTract) setKidneysUpperTract(d.kidneysUpperTract);
        if (d.booRisk) setCustomBooRisk(d.booRisk);
        if (d.prostateMorphology) setEchoStructure(d.prostateMorphology);
        if (d.clinicalConclusion) setCustomClinicalConclusion(d.clinicalConclusion);
        if (Array.isArray(d.urologicalRecommendations) && d.urologicalRecommendations.length > 0) {
          setCustomUrologicalRecommendations(d.urologicalRecommendations);
        }
      }
    } catch (e) {
      console.error("Error auto-scanning prostate urinary data with AI:", e);
    } finally {
      setIsSyncingWithReport(false);
    }
  };

  // Generate structured Annex markdown
  const generateProstateAnnexText = () => {
    return `### ANEXO: EVALUACIÓN INTEGRAL DE VÍAS URINARIAS Y DINÁMICA PROSTÁTICA

**1. VOLUMETRÍA Y MORFOLOGÍA PROSTÁTICA:**
• Dimensiones: Longitudinal: ${prostateLengthCm.toFixed(1)} cm × Anteroposterior: ${prostateApCm.toFixed(1)} cm × Transverso: ${prostateTransverseCm.toFixed(1)} cm.
• Volumen Prostático Estimado: ${calculatedProstateVolume.toFixed(1)} cc / gramos (${prostateGrade}).
• Protrusión Prostática Intravesical (IPP): ${ippMm.toFixed(1)} mm (${ippGrade}).
• Lóbulo Medio: ${medianLobe}.
• Ecoestructura Parenquimatosa: ${echoStructure}.

**2. DINÁMICA MICCIONAL Y RESIDUO POSTMICCIONAL (RPM):**
• Volumen Premiccional (Repleción Vesical): ${preVoidVolumeMl} mL.
• Volumen Postmiccional (Residuo): ${postVoidVolumeMl} mL.
• Porcentaje de Retención Postmiccional: ${postVoidResidualPercent}% (${retentionGrade}).
• Pared Vesical: ${bladderWallMm.toFixed(1)} mm (${bladderTrabeculation}).
• Tracto Urinario Superior / Riñones: ${kidneysUpperTract}.

**3. CORRELACIÓN CLÍNICO-UROLÓGICA Y ESTRATIFICACIÓN (BOO):**
• Riesgo de Obstrucción del Tracto de Salida Vesical (BOO): ${booRisk}.
• Conclusión Dinámica: ${clinicalConclusion || `Próstata de ${calculatedProstateVolume.toFixed(1)} cc (${prostateGrade}), residuo postmiccional de ${postVoidVolumeMl} mL (${postVoidResidualPercent}%).`}`;
  };

  const handleInjectIntoReport = () => {
    setIsModuleIncluded(true);
    if (onToggleIncludeInReport) {
      onToggleIncludeInReport(true);
    }
    if (onProstateDataUpdated) {
      onProstateDataUpdated({
        prostateLengthCm,
        prostateApCm,
        prostateTransverseCm,
        prostateVolumeCc: calculatedProstateVolume,
        prostateGrade,
        ippMm,
        ippGrade,
        medianLobe,
        echoStructure,
        preVoidVolumeMl,
        postVoidVolumeMl,
        postVoidResidualPercent,
        retentionGrade,
        bladderWallMm,
        bladderTrabeculation,
        kidneysUpperTract,
        booRisk,
        customImageBase64,
        generated3dImageBase64,
        clinicalConclusion,
        urologicalRecommendations
      });
    }

    if (onReportUpdated) {
      const annexText = generateProstateAnnexText();
      let clean = reportText || "";

      // Clean existing prostate annex safely without truncating rest of the report
      const annexPattern = /(?:\n\s*---\s*\n+)?(?:\n\s*###?\s*(?:ANEXO:[^\n]*?(?:V[IÍ]AS\s+URINARIAS|PR[OÓ]STATA|DIN[AÁ]MICA\s+PROST[AÁ]TICA|DIN[AÁ]MICA\s+VESICAL)|ESTUDIO\s+VOLUM[EÉ]TRICO\s+DE\s+PR[OÓ]STATA[^\n]*?))[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/i;
      if (annexPattern.test(clean)) {
        clean = clean.replace(annexPattern, "");
      }

      clean = clean.replace(/[━═─]{3,}/g, "").trim();
      const updated = clean + "\n\n---\n\n" + annexText;
      onReportUpdated(updated);
      setInjectedSuccess(true);
      setTimeout(() => setInjectedSuccess(false), 3000);
    }
  };

  const handleRemoveFromReport = () => {
    setIsModuleIncluded(false);
    if (onToggleIncludeInReport) {
      onToggleIncludeInReport(false);
    }
    if (onProstateDataUpdated) {
      onProstateDataUpdated(null);
    }

    if (onReportUpdated) {
      let clean = reportText || "";
      const patterns = [
        /(?:\n\s*---\s*\n+)?(?:\n\s*###?\s*(?:ANEXO:[^\n]*?(?:V[IÍ]AS\s+URINARIAS|PR[OÓ]STATA|DIN[AÁ]MICA\s+PROST[AÁ]TICA|DIN[AÁ]MICA\s+VESICAL)|ESTUDIO\s+VOLUM[EÉ]TRICO\s+DE\s+PR[OÓ]STATA[^\n]*?))[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*)|$))/gi,
        /\n*\*\*1\.\s*VOLUMETR[IÍ]A\s+Y\s+MORFOLOG[IÍ]A\s+PROST[AÁ]TICA[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*4\.)|(?:\n\s*\*\*IMPRESI[OÓ]N)|$))/gi,
        /\n*\*\*2\.\s*DIN[AÁ]MICA\s+MICCIONAL\s+Y\s+RESIDUO[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*4\.)|(?:\n\s*\*\*IMPRESI[OÓ]N)|$))/gi,
        /\n*\*\*3\.\s*CORRELACI[OÓ]N\s+CL[IÍ]NICO-UROL[OÓ]GICA[\s\S]*?(?=(?:\n\s*###|\n\s*---|(?:\n\s*\*\*4\.)|(?:\n\s*\*\*IMPRESI[OÓ]N)|$))/gi
      ];

      patterns.forEach(p => {
        clean = clean.replace(p, "");
      });

      clean = clean.replace(/[━═─]{3,}/g, "").trim();
      onReportUpdated(clean);
    }
  };

  const handleCopyAnnex = () => {
    const txt = generateProstateAnnexText();
    navigator.clipboard.writeText(txt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setCustomImageBase64(ev.target.result);
        setGenerated3dImageBase64(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate3dRender = async () => {
    setIsGenerating3d(true);
    try {
      const description = `Estudio ecográfico y volumétrico de próstata y vías urinarias. Volumen prostático: ${calculatedProstateVolume.toFixed(1)} cc (${prostateGrade}), Protrusión prostática intravesical (IPP): ${ippMm.toFixed(1)} mm (${ippGrade}). Dinámica miccional: Volumen premiccional ${preVoidVolumeMl} mL, residuo postmiccional ${postVoidVolumeMl} mL (${postVoidResidualPercent}% de residuo). Morfología prostática: ${echoStructure}. Muestra una reconstrucción 3D anatómica médica fotorrealista de la vejiga y la próstata con lóbulo medio y corte coronal urológico.`;

      const bodyPayload: any = {
        findingDescription: description,
        studyType: "Ultrasonido Prostático y Vías Urinarias",
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
        throw new Error(errData.error || "Error al sintetizar render 3D");
      }

      const data = await resp.json();
      const img3d = data.render3dBase64 || data.image || data.render3dMacroBase64;
      if (img3d) {
        setGenerated3dImageBase64(img3d);
      } else if (data.error) {
        alert("No se pudo generar el modelo 3D: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error al generar render 3D: " + (err.message || String(err)));
    } finally {
      setIsGenerating3d(false);
    }
  };

  const isIncludedInReport = Boolean(
    isModuleIncluded && (
      (reportText && (
        reportText.includes("ANEXO: EVALUACIÓN INTEGRAL DE VÍAS URINARIAS") ||
        reportText.includes("VOLUMETRÍA Y MORFOLOGÍA PROSTÁTICA") ||
        /ANEXO:[^\n]*?(?:V[IÍ]AS\s+URINARIAS|PR[OÓ]STATA|DIN[AÁ]MICA\s+PROST[AÁ]TICA)/i.test(reportText)
      )) || isModuleIncluded
    )
  );

  return (
    <div
      id="prostate-urinary-module-container"
      className={`relative bg-slate-950/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl transition-all duration-300 font-sans text-slate-200 ${
        isExpandedModal ? "fixed inset-2 z-50 overflow-y-auto bg-slate-950/98 backdrop-blur-xl border-cyan-500/40 p-6 shadow-[0_0_50px_rgba(6,182,212,0.2)]" : "my-6"
      }`}
    >
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black text-slate-100 uppercase tracking-wider font-mono">
                Valoración Integral: Vías Urinarias & Próstata
              </h2>
              <span className="text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                VOLUMETRÍA 3D • DINÁMICA MICCIONAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cálculo de residuo postmiccional (RPM %), volumetría prostática elipsoide, cuantificación de IPP y reconstrucción fotorrealista.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
          <button
            type="button"
            onClick={handleAutoScanFromReport}
            disabled={isSyncingWithReport}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Escanear medidas desde el reporte actual"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingWithReport ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
            <span>{isSyncingWithReport ? "Sincronizando..." : "Escanear del Reporte"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAnnex}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-400 transition-all cursor-pointer shadow-sm"
            title="Copiar texto del anexo"
          >
            {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsExpandedModal(!isExpandedModal)}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-400 transition-all cursor-pointer shadow-sm"
            title={isExpandedModal ? "Minimizar" : "Pantalla completa"}
          >
            {isExpandedModal ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-900 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer shadow-sm"
              title="Cerrar módulo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-800/80 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("3d_render")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === "3d_render"
              ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Workstation 2D / 3D & Simulación</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("biometry")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === "biometry"
              ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Volumetría & Dinámica Miccional</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("guidelines")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === "guidelines"
              ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Guías Clínicas & Conclusión</span>
        </button>
      </div>

      {/* MAIN TAB CONTENT */}
      <div className="mt-5 space-y-6">
        {/* TAB 1: WORKSTATION 2D/3D & CANVAS */}
        {activeTab === "3d_render" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Original Ultrasound Image Slot */}
            <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Fotografía Ecográfica
                  </span>
                  {customImageBase64 && (
                    <button
                      type="button"
                      onClick={() => setCustomImageBase64(null)}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Quitar
                    </button>
                  )}
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-full h-[240px] bg-slate-950 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden group shadow-inner"
                >
                  {customImageBase64 ? (
                    <>
                      <img
                        id="prostate-ultrasound-img"
                        src={customImageBase64}
                        alt="Ecografía de Próstata"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
                        <Upload className="h-4 w-4" /> Cambiar Imagen
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500 transition-colors">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">
                        Sube o arrastra la foto de la próstata
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Corte transversal o sagital con medidas o lóbulo medio
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[10px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 uppercase font-mono block">Criterio de Evaluación:</span>
                Identificación de plano transverso (diámetro T) y longitudinal (L × AP), impronta vesical y homogeneidad capsular.
              </div>
            </div>

            {/* Middle: Canvas 3D Interactive Diagram */}
            <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Modelo Dinámico de Simulación
                  </span>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSimulationMode("pre")}
                      className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded cursor-pointer ${
                        simulationMode === "pre" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400"
                      }`}
                    >
                      Pre
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulationMode("post")}
                      className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded cursor-pointer ${
                        simulationMode === "post" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400"
                      }`}
                    >
                      Post
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulationMode("compare")}
                      className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded cursor-pointer ${
                        simulationMode === "compare" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400"
                      }`}
                    >
                      Dúplex
                    </button>
                  </div>
                </div>

                <div className="relative w-full h-[240px] bg-[#030712] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={240}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span>IPP: <strong className="text-amber-400">{ippMm} mm</strong></span>
                <span>Residuo: <strong className={postVoidResidualPercent > 20 ? "text-rose-400" : "text-emerald-400"}>{postVoidResidualPercent}%</strong></span>
                <span>Vol: <strong className="text-cyan-400">{calculatedProstateVolume.toFixed(1)} cc</strong></span>
              </div>
            </div>

            {/* Right: Realistic 3D Medical Render Generation */}
            <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Reconstrucción 3D IA
                  </span>
                  {generated3dImageBase64 && (
                    <button
                      type="button"
                      onClick={() => setGenerated3dImageBase64(null)}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Quitar
                    </button>
                  )}
                </div>

                <div className="relative w-full h-[240px] bg-[#020617] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                  {isGenerating3d ? (
                    <div className="flex flex-col items-center p-4 text-center">
                      <div className="relative w-12 h-12 flex items-center justify-center mb-3">
                        <div className="absolute inset-0 border-2 border-t-indigo-500 border-indigo-500/20 rounded-full animate-spin"></div>
                        <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                      </div>
                      <span className="text-xs font-mono text-indigo-300 animate-pulse font-bold">Generando Render 3D...</span>
                      <span className="text-[9px] text-slate-500 mt-1">Modelando volumen de {calculatedProstateVolume.toFixed(1)} cc e IPP de {ippMm} mm</span>
                    </div>
                  ) : generated3dImageBase64 ? (
                    <>
                      <img
                        id="prostate-3d-img"
                        src={generated3dImageBase64}
                        alt="Modelo 3D Próstata y Vejiga"
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
                    <div className="p-4 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">Reconstrucción 3D Computarizada</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Genera la vista fotorrealista basada en la foto y los parámetros clínicos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerate3dRender}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Sintetizar Render 3D</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[10px] text-slate-400 flex items-center justify-between">
                <span>Riesgo BOO: <strong className={booRisk === "Alto" ? "text-rose-400" : booRisk === "Intermedio" ? "text-amber-400" : "text-emerald-400"}>{booRisk}</strong></span>
                <span className="text-[9px] font-mono text-slate-500">Mapeo Vías Bajas</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BIOMETRY & VOIDING DYNAMICS CONTROLS */}
        {activeTab === "biometry" && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Volumen Prostático */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Volumen Prostático</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                    {calculatedProstateVolume < 25 ? "Normal" : "Hiperplasia"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-cyan-400 font-mono">{calculatedProstateVolume.toFixed(1)}</span>
                  <span className="text-xs text-slate-400 font-mono">cc / g</span>
                </div>
                <p className="text-[10px] text-slate-400">{prostateGrade}</p>
              </div>

              {/* Card 2: Residuo Postmiccional */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Residuo (RPM)</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                    postVoidResidualPercent > 30 ? "bg-rose-950 text-rose-300 border border-rose-800" :
                    postVoidResidualPercent > 20 ? "bg-amber-950 text-amber-300 border border-amber-800" :
                    "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  }`}>
                    {postVoidResidualPercent}% retención
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black font-mono ${
                    postVoidResidualPercent > 30 ? "text-rose-400" : postVoidResidualPercent > 20 ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {postVoidVolumeMl}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">mL de {preVoidVolumeMl} mL</span>
                </div>
                <p className="text-[10px] text-slate-400">{retentionGrade}</p>
              </div>

              {/* Card 3: Protrusión Intravesical (IPP) */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Protrusión (IPP)</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                    ippMm >= 10 ? "bg-rose-950 text-rose-300 border border-rose-800" :
                    ippMm >= 5 ? "bg-amber-950 text-amber-300 border border-amber-800" :
                    "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  }`}>
                    {ippGrade.split("-")[0]}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-400 font-mono">{ippMm.toFixed(1)}</span>
                  <span className="text-xs text-slate-400 font-mono">mm</span>
                </div>
                <p className="text-[10px] text-slate-400">Riesgo BOO: <strong className="text-slate-200">{booRisk}</strong></p>
              </div>

              {/* Card 4: Pared Vesical */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Pared Vesical</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                    bladderWallMm > 4.0 ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  }`}>
                    {bladderWallMm > 4.0 ? "Engrosada" : "Normal"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-200 font-mono">{bladderWallMm.toFixed(1)}</span>
                  <span className="text-xs text-slate-400 font-mono">mm</span>
                </div>
                <p className="text-[10px] text-slate-400">{bladderTrabeculation}</p>
              </div>
            </div>

            {/* Detailed Sliders & Parameter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
              {/* Left Column: Prostatic Biometry */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Sliders className="h-4 w-4" /> Dimensiones Prostáticas (cm)
                </h4>

                {/* Length */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Diámetro Longitudinal (L):</span>
                    <span className="text-cyan-300 font-bold">{prostateLengthCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="8.0"
                    step="0.1"
                    value={prostateLengthCm}
                    onChange={(e) => {
                      setProstateLengthCm(parseFloat(e.target.value));
                      setCustomProstateVolume(null);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* AP */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Diámetro Anteroposterior (AP):</span>
                    <span className="text-cyan-300 font-bold">{prostateApCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="7.5"
                    step="0.1"
                    value={prostateApCm}
                    onChange={(e) => {
                      setProstateApCm(parseFloat(e.target.value));
                      setCustomProstateVolume(null);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Transverse */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Diámetro Transversal (T):</span>
                    <span className="text-cyan-300 font-bold">{prostateTransverseCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="2.5"
                    max="9.0"
                    step="0.1"
                    value={prostateTransverseCm}
                    onChange={(e) => {
                      setProstateTransverseCm(parseFloat(e.target.value));
                      setCustomProstateVolume(null);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Intravesical Protrusion (IPP) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Protrusión Intravesical (IPP en mm):</span>
                    <span className="text-amber-400 font-bold">{ippMm} mm ({ippGrade.split("-")[0]})</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    value={ippMm}
                    onChange={(e) => setIppMm(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Morphology Selection */}
                <div className="pt-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Ecoestructura Parenquimatosa:</label>
                  <select
                    value={echoStructure}
                    onChange={(e) => setEchoStructure(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-sans focus:border-cyan-500 outline-none"
                  >
                    <option value="Homogénea de límites netos">Homogénea de límites netos y cápsula íntegra</option>
                    <option value="Heterogénea con nódulos de hiperplasia adenomatosa">Heterogénea por hiperplasia adenomatosa de zona transicional</option>
                    <option value="Calcificaciones periuretrales y corpora amylacea">Calcificaciones periuretrales / corpora amylacea</option>
                    <option value="Heterogénea con quistes de retención glandulares">Heterogénea con microquistes de retención</option>
                    <option value="Nódulo hipoecoico en zona periférica (sugerente PIRADS)">Nódulo focal hipoecoico periférico (sospecha focal)</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Bladder & Dynamic Voiding */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Droplets className="h-4 w-4" /> Dinámica Vesicomiccional (mL)
                </h4>

                {/* Pre-void */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Volumen Premiccional:</span>
                    <span className="text-cyan-300 font-bold">{preVoidVolumeMl} mL</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="800"
                    step="10"
                    value={preVoidVolumeMl}
                    onChange={(e) => setPreVoidVolumeMl(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Post-void */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Volumen Postmiccional (Residuo):</span>
                    <span className={`font-bold ${postVoidResidualPercent > 20 ? "text-rose-400" : "text-emerald-400"}`}>
                      {postVoidVolumeMl} mL ({postVoidResidualPercent}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="400"
                    step="5"
                    value={postVoidVolumeMl}
                    onChange={(e) => setPostVoidVolumeMl(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Bladder Wall */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Grosor de Pared Vesical:</span>
                    <span className="text-slate-200 font-bold">{bladderWallMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.2"
                    value={bladderWallMm}
                    onChange={(e) => setBladderWallMm(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Trabeculation */}
                <div className="pt-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Trabeculación y Esfuerzo Vesical:</label>
                  <select
                    value={bladderTrabeculation}
                    onChange={(e) => setBladderTrabeculation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-sans focus:border-cyan-500 outline-none"
                  >
                    <option value="Paredes lisas de grosor conservado">Paredes lisas y finas sin signos de esfuerzo</option>
                    <option value="Trabeculación parietal leve">Trabeculación parietal leve sin divertículos</option>
                    <option value="Trabeculación moderada por vejiga de esfuerzo">Trabeculación moderada por esfuerzo miccional</option>
                    <option value="Paredes severamente engrosadas con pseudodivertículos">Paredes engrosadas con pseudodivertículos por uropatía obstructiva</option>
                  </select>
                </div>

                {/* Upper Tract */}
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Tracto Urinario Superior / Riñones:</label>
                  <select
                    value={kidneysUpperTract}
                    onChange={(e) => setKidneysUpperTract(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-sans focus:border-cyan-500 outline-none"
                  >
                    <option value="Sin ectasia pielocalicial retrógrada">Sin ectasia pielocalicial ni repercusión retrógrada</option>
                    <option value="Discreta ectasia pieloureteral unilateral derecha">Discreta ectasia pieloureteral unilateral derecha</option>
                    <option value="Discreta ectasia pieloureteral unilateral izquierda">Discreta ectasia pieloureteral unilateral izquierda</option>
                    <option value="Ectasia pielocalicial bilateral moderada retrógrada">Ectasia pielocalicial bilateral moderada retrógrada</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GUIDELINES & CLINICAL SYNTHESIS */}
        {activeTab === "guidelines" && (
          <div className="space-y-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
            {/* Visual Staging Reference Bar */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase block">
                Escalas Diagnósticas y Criterios Urológicos de Consenso:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 block mb-1">CLASIFICACIÓN HPB POR VOLUMEN:</span>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <li>• Grado I: 25 - 40 cc</li>
                    <li>• Grado II: 41 - 60 cc</li>
                    <li>• Grado III: 61 - 80 cc</li>
                    <li>• Grado IV: &gt; 80 cc (Gigante)</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-amber-400 block mb-1">PROTRUSIÓN INTRAVESICAL (IPP):</span>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <li>• Grado 1: &lt; 5 mm (Baja obstrucción)</li>
                    <li>• Grado 2: 5 - 10 mm (Intermedia)</li>
                    <li>• Grado 3: &gt; 10 mm (Alta probabilidad BOO)</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 block mb-1">RESIDUO POSTMICCIONAL (RPM):</span>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <li>• Normal: ≤ 10-15% o &lt; 30 mL</li>
                    <li>• Retención Leve: 15 - 25%</li>
                    <li>• Retención Significativa: &gt; 30% o &gt; 100 mL</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Generated Conclusion Box */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-mono font-black text-cyan-400 uppercase tracking-wider block">
                Síntesis Diagnóstica Integrada:
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
                {clinicalConclusion}
              </p>
            </div>

            {/* Recommendations */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-mono font-black text-indigo-400 uppercase tracking-wider block">
                Recomendaciones Clínicas Urológicas:
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {urologicalRecommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTION BAR: INJECT TO REPORT */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-6 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>
            {isIncludedInReport ? "Anexo prostático vinculado al informe." : "El anexo aún no está insertado en el informe."}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isIncludedInReport && (
            <button
              type="button"
              onClick={handleRemoveFromReport}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-mono font-bold text-rose-300 transition-all cursor-pointer shadow-sm"
            >
              Remover Anexo del Reporte
            </button>
          )}

          <button
            type="button"
            onClick={handleInjectIntoReport}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              injectedSuccess
                ? "bg-emerald-600 text-white shadow-emerald-600/30"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30"
            }`}
          >
            {injectedSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>¡Anexo Inyectado con Éxito!</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>Inyectar Anexo de Próstata & Vías Urinarias</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
