import React from "react";
import { 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Check, 
  Layers, 
  HelpCircle, 
  CheckCircle,
  FileText,
  AlertTriangle,
  RotateCcw,
  Copy
} from "lucide-react";

interface VascularAnatomyViewerProps {
  studyType: string;
  states: Record<string, string>;
  descriptions: Record<string, string>;
  subLocations?: Record<string, string>;
  onToggleSegment: (id: string) => void;
  activeHover: string | null;
  setActiveHover: (id: string | null) => void;
  table: string;
  isAnalyzing: boolean;
  error: string | null;
  onAnalyze: () => void;
  onExportTable: () => void;
  onExportBlocks?: (blocksText: string) => void;
  includeInReport: boolean;
  setIncludeInReport: (val: boolean) => void;
  generatedReport: string;
  laterality?: string;
}

const carotidMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
  vert_der: { x: 125, y: 300, textX: 60, textY: 280, align: "end" },
  acc_der:  { x: 160, y: 320, textX: 70, textY: 340, align: "end" },
  aci_der:  { x: 142, y: 110, textX: 55, textY: 100, align: "end" },
  ace_der:  { x: 173, y: 125, textX: 200, textY: 115, align: "start" },
  
  vert_izq: { x: 275, y: 300, textX: 340, textY: 280, align: "start" },
  acc_izq:  { x: 240, y: 320, textX: 330, textY: 340, align: "start" },
  aci_izq:  { x: 258, y: 110, textX: 345, textY: 100, align: "start" },
  ace_izq:  { x: 227, y: 125, textX: 200, textY: 145, align: "end" },
};

const venousMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
  vfc_der: { x: 140, y: 95, textX: 60, textY: 85, align: "end" },
  sfj_der: { x: 153, y: 92, textX: 195, textY: 70, align: "start" },
  vfs_der: { x: 135, y: 200, textX: 52, textY: 180, align: "end" },
  vp_der:  { x: 125, y: 300, textX: 45, textY: 300, align: "end" },
  vsm_der: { x: 170, y: 240, textX: 195, textY: 210, align: "start" },
  vsp_der: { x: 108, y: 340, textX: 30, textY: 340, align: "end" },

  vfc_izq: { x: 260, y: 95, textX: 340, textY: 85, align: "start" },
  sfj_izq: { x: 247, y: 92, textX: 205, textY: 70, align: "end" },
  vfs_izq: { x: 265, y: 200, textX: 348, textY: 180, align: "start" },
  vp_izq:  { x: 275, y: 300, textX: 355, textY: 300, align: "start" },
  vsm_izq: { x: 230, y: 240, textX: 205, textY: 210, align: "end" },
  vsp_izq: { x: 292, y: 340, textX: 370, textY: 340, align: "start" },
};

const arterialMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
  aic_der:  { x: 155, y: 78, textX: 70, textY: 70, align: "end" },
  afc_der:  { x: 140, y: 130, textX: 60, textY: 125, align: "end" },
  afs_der:  { x: 135, y: 210, textX: 50, textY: 195, align: "end" },
  ap_der:   { x: 127, y: 290, textX: 45, textY: 290, align: "end" },
  ata_der:  { x: 118, y: 365, textX: 52, textY: 365, align: "end" },
  atp_der:  { x: 123, y: 375, textX: 145, textY: 385, align: "start" },
  aper_der: { x: 132, y: 370, textX: 180, textY: 395, align: "start" },

  aic_izq:  { x: 245, y: 78, textX: 335, textY: 70, align: "start" },
  afc_izq:  { x: 260, y: 130, textX: 340, textY: 125, align: "start" },
  afs_izq:  { x: 265, y: 210, textX: 350, textY: 195, align: "start" },
  ap_izq:   { x: 273, y: 290, textX: 355, textY: 290, align: "start" },
  ata_izq:  { x: 282, y: 365, textX: 345, textY: 365, align: "start" },
  atp_izq:  { x: 277, y: 375, textX: 255, textY: 385, align: "end" },
  aper_izq: { x: 268, y: 370, textX: 220, textY: 395, align: "end" },
};

export default function VascularAnatomyViewer({
  studyType,
  states,
  descriptions,
  subLocations = {},
  onToggleSegment,
  activeHover,
  setActiveHover,
  table,
  isAnalyzing,
  error,
  onAnalyze,
  onExportTable,
  onExportBlocks,
  includeInReport,
  setIncludeInReport,
  generatedReport,
  laterality = ""
}: VascularAnatomyViewerProps) {
  
  const isCarotidas = studyType === "Doppler de carótidas" || generatedReport.toLowerCase().includes("carot");
  const isVenoso = studyType === "Doppler venoso de miembro inferior" || generatedReport.toLowerCase().includes("venoso");
  const isArterial = !isCarotidas && !isVenoso;

  // Check if a limb was evaluated
  const isLimbEvaluated = (side: "der" | "izq") => {
    if (isCarotidas) return true;

    const latLower = (laterality || "").toLowerCase();
    if (latLower === "derecha" || latLower === "derecho") {
      return side === "der";
    }
    if (latLower === "izquierda" || latLower === "izquierdo") {
      return side === "izq";
    }
    if (latLower === "bilateral") {
      return true;
    }

    const studyLower = (studyType || "").toLowerCase();
    const reportLower = (generatedReport || "").toLowerCase();

    const hasDerechoInStudy = studyLower.includes("derech") || studyLower.includes(" unilateral d") || studyLower.includes("der.");
    const hasIzquierdoInStudy = studyLower.includes("izquierd") || studyLower.includes(" unilateral i") || studyLower.includes("izq.");

    const hasDerechoInReport = reportLower.includes("miembro inferior derecho") || reportLower.includes("m.i. derecho") || reportLower.includes("unilateral derecho");
    const hasIzquierdoInReport = reportLower.includes("miembro inferior izquierdo") || reportLower.includes("m.i. izquierdo") || reportLower.includes("unilateral izquierdo");

    if (hasDerechoInStudy && !hasIzquierdoInStudy) {
      return side === "der";
    }
    if (hasIzquierdoInStudy && !hasDerechoInStudy) {
      return side === "izq";
    }

    if (hasDerechoInReport && !hasIzquierdoInReport) {
      return side === "der";
    }
    if (hasIzquierdoInReport && !hasDerechoInReport) {
      return side === "izq";
    }

    return true; // default to bilateral
  };

  // Segment colors based on state
  const getSegmentColor = (id: string, isVein: boolean = false) => {
    const isRightSegment = id.endsWith("_der");
    const isLeftSegment = id.endsWith("_izq");

    if (isRightSegment && !isLimbEvaluated("der")) {
      return "#64748b"; // soft slate gray for non-evaluated Right
    }
    if (isLeftSegment && !isLimbEvaluated("izq")) {
      return "#64748b"; // soft slate gray for non-evaluated Left
    }

    const s = states[id] || "normal";
    if (s === "normal") return "#10b981"; // Emerald Green (Normal)
    if (s === "mild" || s === "reflux") return "#f59e0b"; // Amber (Mild Plaque / Reflux)
    return "#ef4444"; // Red (Critical Stenosis / Thrombosis)
  };

  const getSegmentLabel = (id: string) => {
    const isRightSegment = id.endsWith("_der");
    const isLeftSegment = id.endsWith("_izq");

    if (isRightSegment && !isLimbEvaluated("der")) {
      return "No evaluado";
    }
    if (isLeftSegment && !isLimbEvaluated("izq")) {
      return "No evaluado";
    }

    const s = states[id] || "normal";
    if (s === "normal") return isVenoso ? "Permeable" : "Normal";

    const descText = (descriptions[id] || "").toLowerCase().trim();

    // 1. flujo no detectable
    if (
      descText.includes("flujo no detectable") || 
      descText.includes("no detectable") || 
      descText.includes("flujo ausente") || 
      descText.includes("ausencia de flujo") || 
      descText.includes("onda no detectable") || 
      descText.includes("señal no detectable")
    ) {
      return "Flujo no detectable";
    }

    // 2. oclusión
    if (
      descText.includes("oclusión") || 
      descText.includes("oclusion") || 
      descText.includes("ocluido") || 
      descText.includes("ocluida") || 
      descText.includes("obstrucción completa") || 
      descText.includes("obstruccion completa") || 
      descText.includes("obstrucción total") || 
      descText.includes("obstruccion total") || 
      descText.includes("obturado") ||
      descText.includes("oclusión completa") ||
      descText.includes("oclusion completa")
    ) {
      return "Oclusión";
    }

    // 2.5 aterosclerosis (prioritized check to prevent fallback to estenosis difusa)
    if (
      descText.includes("enfermedad aterosclerótica") ||
      descText.includes("enfermedad aterosclerotica") ||
      descText.includes("aterosclerosis") ||
      descText.includes("aterosclerótica") ||
      descText.includes("aterosclerotica")
    ) {
      return "Aterosclerosis";
    }

    // 3. estenosis focal
    if (
      descText.includes("estenosis focal") || 
      descText.includes("focal") || 
      descText.includes("zona específica de estenosis") ||
      descText.includes("zona especifica de estenosis") ||
      descText.includes("lesión de estenosis") ||
      descText.includes("lesion de estenosis")
    ) {
      return "Estenosis focal";
    }

    // 4. estenosis difusa
    if (
      descText.includes("estenosis difusa") || 
      descText.includes("estenosis difuso") ||
      descText.includes("estenosis difusas")
    ) {
      return "Estenosis difusa";
    }

    // 5. ateromatosis
    if (
      descText.includes("ateromatosis") || 
      descText.includes("placa") || 
      descText.includes("placas") || 
      descText.includes("ateroma") || 
      descText.includes("ateromatosa") || 
      descText.includes("ateromatosas") || 
      descText.includes("engrosamiento miointimal") ||
      descText.includes("gim") || 
      descText.includes("miointimal") ||
      s === "mild"
    ) {
      return "Ateromatosis";
    }

    // Fallbacks
    if (s === "severe") {
      return "Estenosis focal";
    }
    if (s === "reflux") {
      return "Reflujo";
    }
    if (s === "thrombosis") {
      return "Trombosis";
    }

    return "Normal";
  };

  const getShortExplanationText = (id: string) => {
    const isRightSegment = id.endsWith("_der");
    const isLeftSegment = id.endsWith("_izq");

    if (isRightSegment && !isLimbEvaluated("der")) {
      return "no evaluado";
    }
    if (isLeftSegment && !isLimbEvaluated("izq")) {
      return "no evaluado";
    }

    const s = states[id] || "normal";
    if (s === "normal") return "";

    const label = getSegmentLabel(id);
    if (label === "Normal" || label === "Permeable") return "";
    return label.toLowerCase();
  };

  const renderRotulo = (id: string, defaultLabel: string, x: string | number, y: string | number, textAnchor: string = "middle", className: string = "") => {
    const shortExp = getShortExplanationText(id);
    const state = states[id] || "normal";
    
    let fill = "#9ca3af"; 
    if (shortExp === "no evaluado") {
      fill = "#64748b"; 
    } else if (state === "mild" || state === "reflux") {
      fill = "#f59e0b"; 
    } else if (state === "severe" || state === "thrombosis") {
      fill = "#f87171"; 
    }

    return (
      <text 
        x={x} 
        y={y} 
        fill={fill} 
        fontSize="9" 
        textAnchor={textAnchor} 
        className={`pointer-events-none font-sans font-bold transition-all duration-300 ${className}`}
      >
        {defaultLabel}
        {shortExp && (
          <tspan fill={fill} fontWeight="normal" className="italic font-normal">
            {` - ${shortExp}`}
          </tspan>
        )}
      </text>
    );
  };

  const renderClinicalBentoDashboard = () => {
    // Determine the focused segment ID (the hovered, or first pathology matched, or fallback)
    const getFocusedSegment = () => {
      if (activeHover && states[activeHover]) {
        return activeHover;
      }
      // Find first critical
      const criticalSeg = Object.keys(states).find(k => states[k] === "critical");
      if (criticalSeg) return criticalSeg;
      
      // Find first mild
      const mildSeg = Object.keys(states).find(k => states[k] === "mild" || states[k] === "reflux");
      if (mildSeg) return mildSeg;
      
      // Fallback to first available in states
      const firstSeg = Object.keys(states)[0];
      if (firstSeg) return firstSeg;
      
      // Hard fallback
      return isCarotidas ? "aci_der" : (isVenoso ? "vfc_der" : "afs_der");
    };

    const focusedId = getFocusedSegment();
    const state = states[focusedId] || "normal";
    const desc = descriptions[focusedId] || "Segmento con hemodinámica e integridad parietal conservadas.";
    
    // Parse percentage of obstruction/stenosis from description or state
    let percentage = 0;
    if (state === "normal") {
      percentage = 12; // normal visual baseline (10-15% intimal thickening)
    } else if (state === "mild" || state === "reflux") {
      percentage = 40; // mild plaque (30-49%)
    } else {
      percentage = 85; // critical stenosis (70-99%)
    }

    // Try parsing actual number from description
    const percentMatches = desc.match(/(\d{1,3})\s*%/);
    if (percentMatches) {
      const parsedVal = parseInt(percentMatches[1], 10);
      if (!isNaN(parsedVal) && parsedVal <= 100) {
        percentage = parsedVal;
      }
    }

    const friendlyName = focusedId
      .replace("_der", " Derecho")
      .replace("_izq", " Izquierdo")
      .replace("acc", "Carótida Común (ACC)")
      .replace("aci", "Carótida Interna (ACI)")
      .replace("ace", "Carótida Externa (ACE)")
      .replace("vert", "Arteria Vertebral")
      .replace("vfc", "Femoral Común (VFC)")
      .replace("vfs", "Femoral Superficial (VFS)")
      .replace("vp", "Vena Poplítea (VP)")
      .replace("vsm", "Safena Magna (VSM)")
      .replace("vsp", "Safena Parva (VSP)")
      .replace("sfj", "Unión SFJ")
      .replace("aic", "Ilíaca Común (AIC)")
      .replace("afc", "Femoral Común (AFC)")
      .replace("afs", "Femoral Superficial (AFS)")
      .replace("ap", "Arteria Poplítea (AP)")
      .replace("ata", "Arteria Tibial Anterior")
      .replace("atp", "Arteria Tibial Posterior")
      .replace("aper", "Arteria Peronea");

    const needleRotation = -90 + (percentage * 1.8);

    // Color theme according to severity
    let statusBadgeColor = "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
    let statusText = isVenoso ? "Completamente Permeable" : "Flujo Fisiológico Normal";
    if (state === "mild" || state === "reflux") {
      statusBadgeColor = "bg-amber-950/40 text-amber-400 border-amber-900/30";
      statusText = isVenoso ? "Insuficiencia Valvular / Reflujo" : "Ateromatosis / Estenosis Leve";
    } else if (state === "critical") {
      statusBadgeColor = "bg-red-950/40 text-red-400 border-red-900/30";
      statusText = isVenoso ? "Trombosis Venosa Profunda (TVP)" : "Estenosis Crítica o Flujo Ausente";
    }

    // Clinical Guidelines & Medical Recommendations depending on state + study type
    let consensusTitle = "Criterios de Consenso SRU (Society of Radiologists in Ultrasound)";
    let recommendation = "Control ecográfico periódico anual. Mantener estilo de vida cardiosaludable.";
    
    if (isCarotidas) {
      consensusTitle = "Criterios SRU para Estenosis de Carótida Interna (ACI)";
      if (percentage < 50) {
        recommendation = "Estenosis insignificante (<50%). PSV <125 cm/s. Sin necesidad de intervención quirúrgica. Manejo conservador según AHA/ASA.";
      } else if (percentage >= 50 && percentage < 70) {
        recommendation = "Estenosis Moderada (50-69%). Vel. PSV 125-230 cm/s. Optimizar terapia de estatinas y antiplaquetarios. Seguimiento en 6 meses.";
      } else if (percentage >= 70 && percentage < 100) {
        recommendation = "Estenosis Severa/Crítica (70-99%). Vel. PSV >230 cm/s con pérdida de ventana espectral. Considerar Endarterectomía o Angioplastia con stent.";
      } else {
        recommendation = "Oclusión Completa (100%). Flujo no detectable distal. La endarterectomía no suele estar indicada para oclusiones crónicas.";
      }
    } else if (isVenoso) {
      consensusTitle = "Clasificación Clínica CEAP para Insuficiencia Venosa Crónica";
      if (state === "normal") {
        recommendation = "Permeabilidad normal. Válvulas competentes. Compresibilidad venosa al 100% sin signos de trombosis aguda ni crónica.";
      } else if (state === "reflux") {
        recommendation = "Reflujo detectado (>0.5s en vena femoral/poplítea o >1s en uniones safenas). Considerar uso de medias de compresión graduada clase II. Evitar bipedestación prolongada.";
      } else {
        recommendation = "SOSPECHA DE TVP AGUDA. Ausencia de compresibilidad con transductor, trombo focal/difuso. Anticoagulación terapéutica inmediata o derivación a urgencias hemodinámicas.";
      }
    } else {
      // Arterial
      consensusTitle = "Directrices TASC II para Enfermedad Arterial de Miembros Inferiores";
      if (percentage < 50) {
        recommendation = "Flujo trifásico normal o atenuación leve. Sin claudicación intermitente relevante. Fomentar caminatas guiadas de 30 minutos diarios.";
      } else if (percentage >= 50 && percentage < 70) {
        recommendation = "Estenosis hemodinámicamente significativa. Pérdida del componente diastólico (onda bifásica). Indice Tobillo-Brazo (ITB) esperable entre 0.6 y 0.9.";
      } else {
        recommendation = "Estenosis crítica (>70%) con onda monofásica amortiguada (Tardus-Parvus). Riesgo de claudicación severa o isquemia crítica de miembro. Valorar revascularización.";
      }
    }

    // Dynamic wave path SVG data based on hemodynamic alteration
    let pulseWavePath = "";
    let waveLabel = "";
    let waveDescription = "";

    if (state === "normal") {
      // Triphasic regular clean system wave
      pulseWavePath = "M 5,50 C 15,50 18,10 22,10 C 26,10 28,75 32,75 C 34,75 37,42 41,42 C 45,42 48,50 55,50 L 70,50 C 80,50 83,10 87,10 C 91,10 93,75 97,75 C 99,75 102,42 106,42 C 110,42 113,50 120,50 L 135,50 C 145,50 148,10 152,10 C 156,10 158,75 162,75 C 164,75 167,42 171,42 C 175,42 178,50 185,50 L 200,50 C 210,50 213,10 217,10 C 221,10 223,75 227,75 C 229,75 232,42 236,42 C 240,42 243,50 250,50 L 270,50";
      waveLabel = isVenoso ? "Onda Venosa Fásica con la Respiración" : "Onda Arterial Trifásica de Alta Resistencia";
      waveDescription = isVenoso ? "Flujo modulado por respiración sin reflujo." : "Flujo rápida velocidad sistólica, inversión diastólica rápida por resistencia normal periférica y deflexión elástica tardía.";
    } else if (state === "mild" || state === "reflux") {
      if (isVenoso) {
        // Continuous retrograde broad spectral wave representing incompetence
        pulseWavePath = "M 5,55 C 15,55 25,68 35,68 C 45,68 55,42 65,42 C 75,42 85,68 95,68 C 105,68 115,42 125,42 C 135,42 145,68 155,68 C 165,68 175,42 185,42 C 195,42 205,68 215,68 L 270,55";
        waveLabel = "Onda Espectral de Reflujo Patológico";
        waveDescription = "Inversión prolongada de flujo valvular (>1.5 segundos) gatillado tras maniobra de Valsalva o compresión distal.";
      } else {
        // Biphasic moderate flow wave (loss of third component)
        pulseWavePath = "M 5,50 C 15,50 18,18 22,18 C 26,18 30,68 34,68 C 38,68 45,50 50,50 L 70,50 C 80,50 83,18 87,18 C 91,18 95,68 99,68 C 103,68 110,50 115,50 L 135,50 C 145,50 148,18 152,18 C 156,18 160,68 164,68 C 168,68 175,50 180,50 L 200,50 C 210,50 213,18 217,18 C 221,18 225,68 229,68 C 233,68 240,50 245,50 L 270,50";
        waveLabel = "Onda Espectral Bifásica de Resistencia Moderada";
        waveDescription = "Pérdida del componente elástico terciario por atenuación de rebote arterial elástico. Indica placas iniciales.";
      }
    } else {
      // Critical Stenosis or Thrombosis
      if (isVenoso) {
        // Flatline (no compression, no flow)
        pulseWavePath = "M 5,50 L 25,50 Q 30,51 35,49 T 45,50 Q 55,49 65,51 T 75,50 L 270,50";
        waveLabel = "Ausencia Total de Señal Espectral Venosa (Aplanada)";
        waveDescription = "Flujo nulo o restrictivo compatible con proceso trombótico luminal oclusivo agudo.";
      } else {
        // Monophasic rounded Tardus-Parvus wave (severe downstream stenosis)
        pulseWavePath = "M 5,50 C 18,50 25,32 30,32 C 35,32 45,50 55,50 L 70,50 C 83,50 90,32 95,32 C 100,32 110,50 120,50 C 135,50 148,50 155,32 160,32 C 165,32 175,50 185,50 L 200,50 C 213,50 220,32 225,32 C 230,32 240,50 250,50 L 270,50";
        waveLabel = "Onda Monofásica Amortiguada (Tipo Tardus-Parvus)";
        waveDescription = "Tiempo de aceleración sistólica sumamente prolongado con velocidades extremadamente bajas por estenosis severa proximal.";
      }
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 mb-5 select-none font-sans">
        
        {/* BENTO CARD 1: VELOCÍMETRO CLÍNICO / GAUGE DE ESTENOSIS */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-950/70 shadow-lg flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-indigo-500/30">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-indigo-950/40">
            <span className="text-[9px] font-black font-mono text-indigo-400 uppercase tracking-widest">
              Velocímetro Clínico
            </span>
            <span className={`text-[8px] font-black font-mono uppercase px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
              {state === "normal" ? "Normal" : state === "mild" || state === "reflux" ? "Moderado" : "Severo / Crítico"}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center my-1.5">
            <div className="relative w-full max-w-[170px] aspect-[17/10]">
              <svg viewBox="0 0 200 120" className="w-full h-full">
                {/* Gray empty background track */}
                <path 
                  d="M 30,100 A 70,70 0 0,1 170,100" 
                  fill="none" 
                  stroke="#121a2e" 
                  strokeWidth="11" 
                  strokeLinecap="round" 
                />
                
                {/* Colored visual reference sectors */}
                <path 
                  d="M 30,100 A 70,70 0 0,1 100,30" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="11" 
                  strokeDasharray="40 100"
                  opacity="0.2"
                />
                <path 
                  d="M 100,30 A 70,70 0 0,1 170,100" 
                  fill="none" 
                  stroke="#ef4444" 
                  strokeWidth="11" 
                  strokeDasharray="60 100"
                  opacity="0.2"
                />

                {/* Active Colored Level Track (smooth neon stroke) */}
                <path 
                  d="M 30,100 A 70,70 0 0,1 170,100" 
                  fill="none" 
                  stroke={state === "normal" ? "#10b981" : state === "mild" || state === "reflux" ? "#f59e0b" : "#ef4444"} 
                  strokeWidth="11" 
                  strokeLinecap="round"
                  strokeDasharray={`${(percentage / 100) * 220} 220`}
                  className="transition-all duration-500 ease-out"
                />

                {/* Needle base pivot pin */}
                <circle cx="100" cy="100" r="14" fill="#0c111d" />
                
                {/* Gauge Needle Hand */}
                <path
                  d="M 97,100 L 99,35 A 2,2 0 0,1 101,35 L 103,100 Z"
                  fill="#818cf8"
                  transform={`rotate(${needleRotation} 100 100)`}
                  className="transition-all duration-500 ease-out origin-[100px_100px]"
                />
                <circle cx="100" cy="100" r="5" fill="#818cf8" />
              </svg>

              {/* Central Text HUD label overlaying the gauge */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-center">
                <span className="text-[21px] font-black text-slate-100 font-mono tracking-tighter block leading-none">
                  {percentage}%
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  {isVenoso ? "Afectación" : "Estenosis"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-center mt-1 space-y-0.5">
            <span className="text-[9.5px] font-extrabold text-slate-200 uppercase block truncate max-w-full font-mono">
              {friendlyName}
            </span>
            <p className="text-[8.5px] text-slate-500 leading-relaxed font-semibold uppercase tracking-wider">
              {statusText}
            </p>
          </div>
        </div>

        {/* BENTO CARD 2: HEMODYNAMIC SPECTRAL PULSE WAVE */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-950/70 shadow-lg flex flex-col justify-between overflow-hidden relative group transition-all duration-300 hover:border-indigo-500/30">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-indigo-950/40">
            <span className="text-[9px] font-black font-mono text-indigo-400 uppercase tracking-widest">
              Hemodinámica Doppler Estructural
            </span>
            <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          </div>

          {/* WAVELENGTH CANVAS */}
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-indigo-950/50 my-1 relative">
            <svg viewBox="0 0 280 90" className="w-full h-[70px] overflow-hidden">
              <line x1="5" y1="50" x2="275" y2="50" stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="5" y1="20" x2="275" y2="20" stroke="#111827" strokeWidth="0.8" />
              <line x1="5" y1="75" x2="275" y2="75" stroke="#111827" strokeWidth="0.8" />

              {/* Dynamic waveform outline path */}
              <path 
                d={pulseWavePath} 
                fill="none" 
                stroke={state === "normal" ? "#10b981" : state === "mild" || state === "reflux" ? "#f59e0b" : "#ef4444"} 
                strokeWidth="2.2" 
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />

              {/* Shaded area for hemodynamics */}
              <path 
                d={`${pulseWavePath} L 270,85 L 5,85 Z`} 
                fill={state === "normal" ? "url(#grad-normal)" : state === "mild" || state === "reflux" ? "url(#grad-reflux)" : "url(#grad-critical)"} 
                opacity="0.1"
                className="transition-all duration-500 ease-out"
              />

              <defs>
                <linearGradient id="grad-normal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="grad-reflux" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="grad-critical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            
            <span className="absolute bottom-1 right-2 text-[6.5px] font-mono text-slate-500 font-bold uppercase">
              SEÑAL DE FLUJO ESPECTRAL ACTIVA
            </span>
          </div>

          <div className="space-y-0.5 mt-1.5">
            <span className="text-[9.5px] font-extrabold text-slate-200 uppercase block truncate font-mono">
              {waveLabel}
            </span>
            <p className="text-[8.5px] text-slate-500 leading-relaxed font-semibold italic truncate">
              {waveDescription}
            </p>
          </div>
        </div>

        {/* BENTO CARD 3: MEDICINE CONSENSUS DIRECTIVES */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-950/70 shadow-lg flex flex-col justify-between overflow-hidden relative group transition-all duration-300 hover:border-indigo-500/30">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-indigo-950/40">
            <span className="text-[9px] font-black font-mono text-indigo-400 uppercase tracking-widest">
              Directrices de Consenso Clínico
            </span>
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          </div>

          <div className="flex-1 flex flex-col justify-center py-1">
            <span className="text-[9px] font-black text-indigo-350 uppercase tracking-wide font-mono block leading-snug mb-1">
              {consensusTitle}:
            </span>
            <p className="text-[9.5px] text-slate-300 font-medium leading-relaxed font-sans border-l-2 border-indigo-600 pl-2">
              {recommendation}
            </p>
          </div>

          <div className="mt-2.5 pt-1.5 border-t border-slate-900 flex justify-between items-center text-[7.5px] font-bold text-slate-500 uppercase font-mono">
            <span>SOCIEDAD DE ECOGRAFÍA</span>
            <span>AHA / TASC II / CEAP</span>
          </div>
        </div>

      </div>
    );
  };

  const [displayFormat, setDisplayFormat] = React.useState<"table" | "blocks">("table");
  const [copiedBlocksFeedback, setCopiedBlocksFeedback] = React.useState(false);

  const getBlocksText = () => {
    let result = "";
    result += `=====================================================================\n`;
    result += `                 SÍNTESIS DE ANATOMÍA VASCULAR                       \n`;
    result += `=====================================================================\n`;
    if (isCarotidas) {
      result += ` VALORACIÓN: DOPPLER DE CARÓTIDAS Y VASOS DEL CUELLO\n`;
    } else if (isVenoso) {
      result += ` VALORACIÓN: DOPPLER VENOSO DE MIEMBROS INFERIORES\n`;
    } else {
      result += ` VALORACIÓN: DOPPLER ARTERIAL DE MIEMBROS INFERIORES\n`;
    }
    result += `---------------------------------------------------------------------\n\n`;

    const segmentsList = isCarotidas 
      ? [
          { id: "acc_der", name: "ACC Derecho (Carot. Común R)" },
          { id: "aci_der", name: "ACI Derecho (Carot. Interna R)" },
          { id: "ace_der", name: "ACE Derecho (Carot. Externa R)" },
          { id: "vert_der", name: "Arteria Vertebral Derecha" },
          { id: "acc_izq", name: "ACC Izquierdo (Carot. Común L)" },
          { id: "aci_izq", name: "ACI Izquierda (Carot. Interna L)" },
          { id: "ace_izq", name: "ACE Izquierda (Carot. Externa L)" },
          { id: "vert_izq", name: "Arteria Vertebral Izquierda" }
        ]
      : isVenoso 
      ? [
          { id: "vfc_der", name: "VFC Derecho (Vena Femoral Común)" },
          { id: "vfs_der", name: "VFS Derecha (Vena Femoral Superf.)" },
          { id: "vp_der", name: "VP Derecha (Vena Poplítea)" },
          { id: "vsm_der", name: "VSM Derecha (Vena Safena Magna)" },
          { id: "vsp_der", name: "VSP Derecha (Vena Safena Parva)" },
          { id: "sfj_der", name: "SFJ Derecha (Unión Safenofemoral)" },
          { id: "vfc_izq", name: "VFC Izquierdo (Vena Femoral Común)" },
          { id: "vfs_izq", name: "VFS Izquierda (Vena Femoral Superf.)" },
          { id: "vp_izq", name: "VP Izquierda (Vena Poplítea)" },
          { id: "vsm_izq", name: "VSM Izquierda (Vena Safena Magna)" },
          { id: "vsp_izq", name: "VSP Izquierda (Vena Safena Parva)" },
          { id: "sfj_izq", name: "SFJ Izquierda (Unión Safenofemoral)" }
        ]
      : [
          { id: "aic_der", name: "AIC Derecha (Art. Ilíaca Común)" },
          { id: "afc_der", name: "AFC Derecha (Art. Femoral Común)" },
          { id: "afs_der", name: "AFS Derecha (Art. Femoral Superf.)" },
          { id: "ap_der", name: "AP Derecha (Arteria Poplítea)" },
          { id: "ata_der", name: "ATA Derecha (Arteria Tibial Ant.)" },
          { id: "atp_der", name: "ATP Derecha (Arteria Tibial Post.)" },
          { id: "aper_der", name: "APer Derecha (Arteria Peronea)" },
          { id: "aic_izq", name: "AIC Izquierda (Art. Ilíaca Común)" },
          { id: "afc_izq", name: "AFC Izquierda (Art. Femoral Común)" },
          { id: "afs_izq", name: "AFS Izquierda (Art. Femoral Superf.)" },
          { id: "ap_izq", name: "AP Izquierda (Arteria Poplítea)" },
          { id: "ata_izq", name: "ATA Izquierda (Arteria Tibial Ant.)" },
          { id: "atp_izq", name: "ATP Izquierda (Arteria Tibial Post.)" },
          { id: "aper_izq", name: "APer Izquierda (Arteria Peronea)" }
        ];

    const anomalies = segmentsList.filter(s => (states[s.id] || "normal") !== "normal");
    const normals = segmentsList.filter(s => (states[s.id] || "normal") === "normal");

    if (anomalies.length > 0) {
      result += `◆ HALLAZGOS CON ALTERACIONES O PLACAS DETECTADAS:\n`;
      anomalies.forEach(s => {
        const stateLabel = getSegmentLabel(s.id);
        const subLoc = subLocations[s.id] || "general";
        const subLocText = subLoc !== "general" ? ` [Segmento ${subLoc.toUpperCase()}]` : "";
        const descText = descriptions[s.id] || "Se observa compromiso hemodinámico o alteración de pared mútua.";
        result += `  • ${s.name}${subLocText}: ${stateLabel.toUpperCase()}\n`;
        result += `    Detalle: ${descText}\n`;
      });
      result += `\n`;
    }

    result += `◆ SEGMENTOS CON FLUJOS Y PAREDES DENTRO DE LÍMITES NORMALES:\n`;
    if (normals.length > 0) {
      normals.forEach(s => {
        const label = isVenoso ? "Permeable, sin reflujo" : "Dentro de límites normales";
        result += `  • ${s.name}: ${label}\n`;
      });
    } else {
      result += `  • Ninguno (Todos los segmentos explorados muestran compromiso vascular patente)\n`;
    }

    result += `\n=====================================================================\n`;
    return result;
  };

  const handleCopyBlocks = () => {
    const text = getBlocksText();
    navigator.clipboard.writeText(text);
    setCopiedBlocksFeedback(true);
    setTimeout(() => setCopiedBlocksFeedback(false), 2000);
  };

  const getCoordinateWithOffset = (id: string, pt: { x: number, y: number }) => {
    const subLoc = subLocations[id] || "general";
    if (subLoc === "general" || subLoc === "medio") {
      return pt;
    }

    let offsetX = 0;
    let offsetY = 0;

    if (isCarotidas) {
      if (id.startsWith("acc_")) {
        // ACC (Y: ~320, runs upwards to bifurcation Y: ~200)
        if (subLoc === "proximal" || subLoc === "origen") offsetY = 40;
        if (subLoc === "distal" || subLoc === "bifurcacion") offsetY = -40;
      } else if (id.startsWith("aci_") || id.startsWith("ace_")) {
        // ACI & ACE run from bifurcation upwards (Y: ~200 -> 110)
        if (subLoc === "proximal" || subLoc === "origen" || subLoc === "bifurcacion") {
          offsetY = 30;
          offsetX = id.startsWith("aci_") ? 5 : -5;
        }
        if (subLoc === "distal") offsetY = -30;
      } else if (id.startsWith("vert_")) {
        if (subLoc === "proximal") offsetY = 40;
        if (subLoc === "distal") offsetY = -40;
      }
    } else if (isVenoso) {
      // Venas del miembro inferior
      // vfc (Y: 95) - vfs (Y: 200) - vp (Y: 300)
      if (id.startsWith("vfc_")) {
        if (subLoc === "proximal") offsetY = -15;
        if (subLoc === "distal") offsetY = 15;
      } else if (id.startsWith("vfs_")) {
        if (subLoc === "proximal") offsetY = -40;
        if (subLoc === "distal") offsetY = 40;
      } else if (id.startsWith("vp_")) {
        if (subLoc === "proximal") offsetY = -30;
        if (subLoc === "distal") offsetY = 30;
      } else if (id.startsWith("vsm_") || id.startsWith("vsp_")) {
        if (subLoc === "proximal") offsetY = -45;
        if (subLoc === "distal") offsetY = 45;
      }
    } else {
      // Arterial (aic, afc, afs, ap, etc.)
      // aic (Y: 78) - afc (Y: 130) - afs (Y: 210) - ap (Y: 290)
      if (id.startsWith("aic_")) {
        if (subLoc === "proximal" || subLoc === "origen") offsetY = -15;
        if (subLoc === "distal") offsetY = 15;
      } else if (id.startsWith("afc_")) {
        if (subLoc === "proximal") offsetY = -15;
        if (subLoc === "distal" || subLoc === "bifurcacion") offsetY = 15;
      } else if (id.startsWith("afs_")) {
        if (subLoc === "proximal") offsetY = -45;
        if (subLoc === "distal") offsetY = 45;
      } else if (id.startsWith("ap_")) {
        if (subLoc === "proximal") offsetY = -30;
        if (subLoc === "distal") offsetY = 30;
      } else if (id.startsWith("at") || id.startsWith("aper_")) {
        if (subLoc === "proximal") offsetY = -15;
        if (subLoc === "distal") offsetY = 15;
      }
    }

    return { x: pt.x + offsetX, y: pt.y + offsetY };
  };

  const renderOverlayAnomalies = (midpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }>) => {
    return Object.entries(states).map(([id, state]) => {
      if (state === "normal") return null;
      const basePt = midpoints[id];
      if (!basePt) return null;

      // Calculate localized exact coordinate with offset
      const pt = getCoordinateWithOffset(id, basePt);

      const color = state === "severe" || state === "thrombosis" ? "#ef4444" : "#f59e0b";
      
      let indicator = null;
      if (state === "mild") {
        indicator = (
          <g>
            <circle cx={pt.x} cy={pt.y} r="8" fill="#f59e0b" opacity="0.35" className="animate-pulse" />
            <circle cx={pt.x} cy={pt.y} r="5.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
            {/* Draw a tiny stylized crescent representing a lipid plaque on screen */}
            <path d={`M ${pt.x - 3} ${pt.y - 3} Q ${pt.x + 3} ${pt.y} ${pt.x - 3} ${pt.y + 3}`} fill="none" stroke="#d97706" strokeWidth="1.5" />
          </g>
        );
      } else if (state === "severe") {
        indicator = (
          <g>
            <circle cx={pt.x} cy={pt.y} r="10" fill="#dc2626" opacity="0.35" className="animate-pulse" />
            <circle cx={pt.x} cy={pt.y} r="6.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1" />
            {/* Draw a hard blocking plaque shape */}
            <path d={`M ${pt.x - 4} ${pt.y - 4} Q ${pt.x + 5} ${pt.y} ${pt.x - 4} ${pt.y + 4}`} fill="none" stroke="#7f1d1d" strokeWidth="2" />
          </g>
        );
      } else if (state === "reflux") {
        indicator = (
          <g transform={`translate(${pt.x}, ${pt.y})`}>
            <circle cx="0" cy="0" r="7.5" fill="#f59e0b" opacity="0.3" />
            <path d="M-4.5,-2 A4.5,4.5 0 0,0 4.5,2" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <path d="M4.5,2 L1.5,2 M4.5,2 L4.5,-1" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );
      } else if (state === "thrombosis") {
        indicator = (
          <g transform={`translate(${pt.x}, ${pt.y})`}>
            <rect x="-8.5" y="-5" width="17" height="10" rx="1.5" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1" />
            <line x1="-5" y1="-3" x2="5" y2="3" stroke="#f87171" strokeWidth="1.5" />
            <line x1="5" y1="-3" x2="-5" y2="3" stroke="#f87171" strokeWidth="1.5" />
          </g>
        );
      }

      const desc = descriptions[id] || getSegmentLabel(id);
      let cleanDesc = desc
        .replace(/Placas ateromatosas con estenosis/, "Placa")
        .replace(/Estenosis hemodinámicamente significativa \//, "Estenosis")
        .replace(/Insuficiencia valvular con reflujo retrógrado/, "Reflujo val.")
        .replace(/Obstrucción trombótica patente/, "Trombo")
        .replace(/Normal \/ Conservado/, "Normal")
        .trim();

      if (id.startsWith("acc_") && (cleanDesc.toLowerCase().includes("grosor") || cleanDesc.toLowerCase().includes("miointimal") || cleanDesc.toLowerCase().includes("intimal") || cleanDesc.toLowerCase().includes("gim") || cleanDesc.toLowerCase().includes("engrosamiento"))) {
        cleanDesc = "GIM";
      }

      const subLoc = subLocations[id] || "general";
      const subLocLabel = subLoc !== "general" ? ` (${subLoc.toUpperCase()})` : "";
      const baseLabel = id.replace("_der", " R").replace("_izq", " L").toUpperCase();
      const croppedDesc = `${baseLabel}${subLocLabel}: ${cleanDesc.length > 28 ? cleanDesc.slice(0, 26) + ".." : cleanDesc}`;

      return (
        <g key={`anon-${id}`} className="transition-all duration-300">
          <line x1={pt.x} y1={pt.y} x2={basePt.textX} y2={basePt.textY} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.75" />
          {indicator}
          <g transform={`translate(${basePt.textX}, ${basePt.textY})`}>
            <rect 
              x={basePt.align === "end" ? -164 : basePt.align === "middle" ? -83 : -2} 
              y="-10" 
              width="166" 
              height="20" 
              rx="4" 
              fill="#090d16" 
              stroke={color} 
              strokeWidth="1.2" 
              opacity="0.95"
            />
            <text 
              x={basePt.align === "end" ? -83 : basePt.align === "middle" ? 0 : 83} 
              y="2.5" 
              fill="#e2e8f0" 
              fontSize="7" 
              fontWeight="bold" 
              textAnchor="middle"
              className="font-sans text-[7px]"
            >
              {croppedDesc}
            </text>
          </g>
        </g>
      );
    });
  };

  const renderCarotidSVG = () => {
    return (
      <svg viewBox="-120 0 640 450" className="w-full max-w-[420px] h-auto mx-auto select-none font-mono">
        {/* Background Grids or guidelines */}
        <rect x="-120" y="0" width="640" height="450" fill="transparent" />
        
        {/* Anatomical Line dividers / L/R Labels */}
        <line x1="200" y1="20" x2="200" y2="430" stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
        <text x="70" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Derecho (R)</text>
        <text x="330" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Izquierdo (L)</text>
        
        {/* === RIGHT SIDE CAROTID ARTERY === */}
        {/* Spine path for Vertebral Artery Right */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vert_der")}
          onMouseEnter={() => setActiveHover("vert_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 125 430 L 125 150 Q 125 100 135 70" 
            fill="none" 
            stroke={getSegmentColor("vert_der")} 
            strokeWidth={activeHover === "vert_der" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vert_der", "A. Vertebral R", "110", "360", "end")}
        </g>

        {/* ACC Derecho -> Common Carotid Right */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("acc_der")}
          onMouseEnter={() => setActiveHover("acc_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 160 430 L 160 220" 
            fill="none" 
            stroke={getSegmentColor("acc_der")} 
            strokeWidth={activeHover === "acc_der" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {/* Bifurcation Bulb */}
          <path 
            d="M 160 220 C 160 200, 145 190, 145 170" 
            fill="none" 
            stroke={getSegmentColor("aci_der")} 
            strokeWidth={activeHover === "aci_der" ? "11" : "8"} 
            className="transition-all duration-300"
          />
          {renderRotulo("acc_der", "ACC Derecho", "190", "320", "start")}
        </g>

        {/* ACI Derecha -> Internal Carotid Right (Main deeper branch) */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("aci_der")}
          onMouseEnter={() => setActiveHover("aci_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 145 175 L 140 60" 
            fill="none" 
            stroke={getSegmentColor("aci_der")} 
            strokeWidth={activeHover === "aci_der" ? "11" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aci_der", "ACI Derecha", "125", "110", "end")}
        </g>

        {/* ACE Derecha -> External Carotid Right (Braching forward) */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("ace_der")}
          onMouseEnter={() => setActiveHover("ace_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          {/* Base branch */}
          <path 
            d="M 160 220 C 160 200, 175 190, 175 170 L 180 80" 
            fill="none" 
            stroke={getSegmentColor("ace_der")} 
            strokeWidth={activeHover === "ace_der" ? "9" : "6"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {/* Small branches */}
          <path d="M 175 160 L 185 155" fill="none" stroke={getSegmentColor("ace_der")} strokeWidth="2" />
          <path d="M 178 130 L 190 120" fill="none" stroke={getSegmentColor("ace_der")} strokeWidth="2" />
          {renderRotulo("ace_der", "ACE Derecha", "190", "150", "start")}
        </g>


        {/* === LEFT SIDE CAROTID ARTERY === */}
        {/* Spine path for Vertebral Artery Left */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vert_izq")}
          onMouseEnter={() => setActiveHover("vert_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 275 430 L 275 150 Q 275 100 265 70" 
            fill="none" 
            stroke={getSegmentColor("vert_izq")} 
            strokeWidth={activeHover === "vert_izq" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vert_izq", "A. Vertebral L", "290", "360", "start")}
        </g>

        {/* ACC Izquierdo -> Common Carotid Left */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("acc_izq")}
          onMouseEnter={() => setActiveHover("acc_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 240 430 L 240 220" 
            fill="none" 
            stroke={getSegmentColor("acc_izq")} 
            strokeWidth={activeHover === "acc_izq" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {/* Bulb Left */}
          <path 
            d="M 240 220 C 240 200, 255 190, 255 170" 
            fill="none" 
            stroke={getSegmentColor("aci_izq")} 
            strokeWidth={activeHover === "aci_izq" ? "11" : "8"} 
            className="transition-all duration-300"
          />
          {renderRotulo("acc_izq", "ACC Izquierdo", "210", "320", "end")}
        </g>

        {/* ACI Izquierda -> Internal Carotid Left */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("aci_izq")}
          onMouseEnter={() => setActiveHover("aci_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 255 175 L 260 60" 
            fill="none" 
            stroke={getSegmentColor("aci_izq")} 
            strokeWidth={activeHover === "aci_izq" ? "11" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aci_izq", "ACI Izquierda", "275", "110", "start")}
        </g>

        {/* ACE Izquierda -> External Carotid Left */}
        <g 
          className="cursor-pointer group"
          onClick={() => onToggleSegment("ace_izq")}
          onMouseEnter={() => setActiveHover("ace_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 240 220 C 240 200, 225 190, 225 170 L 220 80" 
            fill="none" 
            stroke={getSegmentColor("ace_izq")} 
            strokeWidth={activeHover === "ace_izq" ? "9" : "6"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {/* Small branches */}
          <path d="M 225 160 L 215 155" fill="none" stroke={getSegmentColor("ace_izq")} strokeWidth="2" />
          <path d="M 222 130 L 210 120" fill="none" stroke={getSegmentColor("ace_izq")} strokeWidth="2" />
          {renderRotulo("ace_izq", "ACE Izquierda", "210", "150", "end")}
        </g>

        {/* Draw refined explicit plaque/reflux overlays with leader lines */}
        {renderOverlayAnomalies(carotidMidpoints)}

        {/* Overlay hover details or legends */}
        {activeHover && (
          <g>
            <rect x="20" y="390" width="360" height="45" rx="8" fill="#111827" stroke="#374151" strokeWidth="2" opacity="0.95" />
            <text x="40" y="408" fill="#e5e7eb" fontSize="10" fontWeight="bold">Segmento: <tspan fill="#6366f1" fontWeight="bold" className="uppercase">{activeHover.replace("_der", " Der").replace("_izq", " Izq")}</tspan></text>
            <text x="40" y="423" fill="#9ca3af" fontSize="9">Estado: <tspan fill={getSegmentColor(activeHover)} fontWeight="bold">{getSegmentLabel(activeHover)}</tspan> • {descriptions[activeHover] || "Sin anomalías notables detectadas."}</text>
          </g>
        )}
      </svg>
    );
  };

  const renderVenousSVG = () => {
    return (
      <svg viewBox="-120 0 640 450" className="w-full max-w-[420px] h-auto mx-auto select-none font-mono">
        {/* Background legs outline */}
        <path d="M 80 430 L 110 50 L 195 50 L 170 430 Z" fill="#1e293b" opacity="0.15" stroke="#334155" strokeWidth="1" />
        <path d="M 320 430 L 290 50 L 205 50 L 230 430 Z" fill="#1e293b" opacity="0.15" stroke="#334155" strokeWidth="1" />
        
        {/* Anatomical Line dividers / L/R Labels */}
        <line x1="200" y1="20" x2="200" y2="430" stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
        <text x="70" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Derecho (R)</text>
        <text x="330" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Izquierdo (L)</text>
        
        {/* === VENOUS TREE - RIGHT LEG === */}
        {/* VFC - Vena Femoral Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vfc_der")}
          onMouseEnter={() => setActiveHover("vfc_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 140 50 L 140 140" 
            fill="none" 
            stroke={getSegmentColor("vfc_der", true)} 
            strokeWidth={activeHover === "vfc_der" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vfc_der", "VFC Der", "130", "90", "end")}
        </g>

        {/* SFJ - Unión Safenofemoral */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("sfj_der")}
          onMouseEnter={() => setActiveHover("sfj_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 140 80 Q 155 80, 160 110" 
            fill="none" 
            stroke={getSegmentColor("sfj_der", true)} 
            strokeWidth={activeHover === "sfj_der" ? "10" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("sfj_der", "Unión SFJ", "165", "130", "start")}
        </g>

        {/* VFS - Vena Femoral Superficial */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vfs_der")}
          onMouseEnter={() => setActiveHover("vfs_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 140 140 L 130 260" 
            fill="none" 
            stroke={getSegmentColor("vfs_der", true)} 
            strokeWidth={activeHover === "vfs_der" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vfs_der", "VFS Der", "120", "190", "end")}
        </g>

        {/* VP - Vena Poplítea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vp_der")}
          onMouseEnter={() => setActiveHover("vp_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 130 260 L 120 340" 
            fill="none" 
            stroke={getSegmentColor("vp_der", true)} 
            strokeWidth={activeHover === "vp_der" ? "11" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vp_der", "V. Poplítea Der", "110", "290", "end")}
        </g>

        {/* VSM - Vena Safena Magna (Superficial long medial branch) */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vsm_der")}
          onMouseEnter={() => setActiveHover("vsm_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 160 110 L 175 220 Q 185 310, 160 410" 
            fill="none" 
            stroke={getSegmentColor("vsm_der", true)} 
            strokeWidth={activeHover === "vsm_der" ? "10" : "6"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vsm_der", "VSM (S. Magna)", "180", "340", "start")}
        </g>

        {/* VSP - Vena Safena Parva (Short superficial lateral branch) */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vsp_der")}
          onMouseEnter={() => setActiveHover("vsp_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 120 280 Q 95 300, 105 400" 
            fill="none" 
            stroke={getSegmentColor("vsp_der", true)} 
            strokeWidth={activeHover === "vsp_der" ? "9" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vsp_der", "VSP (S. Parva)", "95", "320", "end")}
        </g>


        {/* === VENOUS TREE - LEFT LEG === */}
        {/* VFC - Vena Femoral Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vfc_izq")}
          onMouseEnter={() => setActiveHover("vfc_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 260 50 L 260 140" 
            fill="none" 
            stroke={getSegmentColor("vfc_izq", true)} 
            strokeWidth={activeHover === "vfc_izq" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vfc_izq", "VFC Izq", "270", "90", "start")}
        </g>

        {/* SFJ - Unión Safenofemoral */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("sfj_izq")}
          onMouseEnter={() => setActiveHover("sfj_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 260 80 Q 245 80, 240 110" 
            fill="none" 
            stroke={getSegmentColor("sfj_izq", true)} 
            strokeWidth={activeHover === "sfj_izq" ? "10" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("sfj_izq", "Unión SFJ", "235", "130", "end")}
        </g>

        {/* VFS - Vena Femoral Superficial */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vfs_izq")}
          onMouseEnter={() => setActiveHover("vfs_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 260 140 L 270 260" 
            fill="none" 
            stroke={getSegmentColor("vfs_izq", true)} 
            strokeWidth={activeHover === "vfs_izq" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vfs_izq", "VFS Izq", "280", "190", "start")}
        </g>

        {/* VP - Vena Poplítea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vp_izq")}
          onMouseEnter={() => setActiveHover("vp_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 270 260 L 280 340" 
            fill="none" 
            stroke={getSegmentColor("vp_izq", true)} 
            strokeWidth={activeHover === "vp_izq" ? "11" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vp_izq", "V. Poplítea Izq", "290", "290", "start")}
        </g>

        {/* VSM - Vena Safena Magna */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vsm_izq")}
          onMouseEnter={() => setActiveHover("vsm_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 240 110 L 225 220 Q 215 310, 240 410" 
            fill="none" 
            stroke={getSegmentColor("vsm_izq", true)} 
            strokeWidth={activeHover === "vsm_izq" ? "10" : "6"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vsm_izq", "VSM (S. Magna)", "220", "340", "end")}
        </g>

        {/* VSP - Vena Safena Parva */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("vsp_izq")}
          onMouseEnter={() => setActiveHover("vsp_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 280 280 Q 305 300, 295 400" 
            fill="none" 
            stroke={getSegmentColor("vsp_izq", true)} 
            strokeWidth={activeHover === "vsp_izq" ? "9" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("vsp_izq", "VSP (S. Parva)", "305", "320", "start")}
        </g>

        {/* Draw refined explicit plaque/reflux overlays with leader lines */}
        {renderOverlayAnomalies(venousMidpoints)}

        {/* Overlay hover details or legends */}
        {activeHover && (
          <g>
            <rect x="20" y="390" width="360" height="45" rx="8" fill="#111827" stroke="#374151" strokeWidth="2" opacity="0.95" />
            <text x="40" y="408" fill="#e5e7eb" fontSize="10" fontWeight="bold">Segmento: <tspan fill="#6366f1" fontWeight="bold" className="uppercase">{activeHover.replace("_der", " Der").replace("_izq", " Izq")}</tspan></text>
            <text x="40" y="423" fill="#9ca3af" fontSize="9">Estado: <tspan fill={getSegmentColor(activeHover)} fontWeight="bold">{getSegmentLabel(activeHover)}</tspan> • {descriptions[activeHover] || "Sin anomalías notables detectadas."}</text>
          </g>
        )}
      </svg>
    );
  };

  const renderArterialSVG = () => {
    return (
      <svg viewBox="-120 0 640 450" className="w-full max-w-[420px] h-auto mx-auto select-none font-mono">
        {/* Background legs outline */}
        <path d="M 80 430 L 110 50 L 195 50 L 170 430 Z" fill="#1a1111" opacity="0.15" stroke="#371818" strokeWidth="1" />
        <path d="M 320 430 L 290 50 L 205 50 L 230 430 Z" fill="#1a1111" opacity="0.15" stroke="#371818" strokeWidth="1" />
        
        {/* Anatomical Line dividers / L/R Labels */}
        <line x1="200" y1="20" x2="200" y2="430" stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
        <text x="70" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Derecho (R)</text>
        <text x="330" y="30" fill="#6b7280" fontSize="11" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest">Izquierdo (L)</text>
        
        {/* === ARTERIAL TREE - RIGHT LEG === */}
        {/* AIC - Arteria Ilíaca Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("aic_der")}
          onMouseEnter={() => setActiveHover("aic_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 180 50 Q 150 70, 140 100" 
            fill="none" 
            stroke={getSegmentColor("aic_der")} 
            strokeWidth={activeHover === "aic_der" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aic_der", "A. Ilíaca R", "180", "80", "start")}
        </g>

        {/* AFC - Arteria Femoral Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("afc_der")}
          onMouseEnter={() => setActiveHover("afc_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 140 100 L 140 160" 
            fill="none" 
            stroke={getSegmentColor("afc_der")} 
            strokeWidth={activeHover === "afc_der" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("afc_der", "AFC R", "130", "130", "end")}
        </g>

        {/* AFS - Arteria Femoral Superficial */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("afs_der")}
          onMouseEnter={() => setActiveHover("afs_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 140 160 L 130 260" 
            fill="none" 
            stroke={getSegmentColor("afs_der")} 
            strokeWidth={activeHover === "afs_der" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("afs_der", "AFS R", "120", "210", "end")}
        </g>

        {/* AP - Arteria Poplítea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("ap_der")}
          onMouseEnter={() => setActiveHover("ap_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 130 260 L 125 320" 
            fill="none" 
            stroke={getSegmentColor("ap_der")} 
            strokeWidth={activeHover === "ap_der" ? "11" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("ap_der", "A. Poplítea R", "115", "290", "end")}
        </g>

        {/* ATA - Arteria Tibial Anterior */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("ata_der")}
          onMouseEnter={() => setActiveHover("ata_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 125 320 L 110 410" 
            fill="none" 
            stroke={getSegmentColor("ata_der")} 
            strokeWidth={activeHover === "ata_der" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("ata_der", "ATA R", "100", "375", "end")}
        </g>

        {/* ATP - Arteria Tibial Posterior */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("atp_der")}
          onMouseEnter={() => setActiveHover("atp_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 125 320 L 122 410" 
            fill="none" 
            stroke={getSegmentColor("atp_der")} 
            strokeWidth={activeHover === "atp_der" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("atp_der", "ATP R", "135", "380", "start")}
        </g>

        {/* APer - Arteria Peronea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("aper_der")}
          onMouseEnter={() => setActiveHover("aper_der")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 125 335 L 140 405" 
            fill="none" 
            stroke={getSegmentColor("aper_der")} 
            strokeWidth={activeHover === "aper_der" ? "8" : "4.5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aper_der", "A. Peronea R", "145", "415", "start")}
        </g>


        {/* === ARTERIAL TREE - LEFT LEG === */}
        {/* AIC - Arteria Ilíaca Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("aic_izq")}
          onMouseEnter={() => setActiveHover("aic_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 220 50 Q 250 70, 260 100" 
            fill="none" 
            stroke={getSegmentColor("aic_izq")} 
            strokeWidth={activeHover === "aic_izq" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aic_izq", "A. Ilíaca L", "220", "80", "end")}
        </g>

        {/* AFC - Arteria Femoral Común */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("afc_izq")}
          onMouseEnter={() => setActiveHover("afc_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 260 100 L 260 160" 
            fill="none" 
            stroke={getSegmentColor("afc_izq")} 
            strokeWidth={activeHover === "afc_izq" ? "14" : "10"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("afc_izq", "AFC L", "270", "130", "start")}
        </g>

        {/* AFS - Arteria Femoral Superficial */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("afs_izq")}
          onMouseEnter={() => setActiveHover("afs_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 260 160 L 270 260" 
            fill="none" 
            stroke={getSegmentColor("afs_izq")} 
            strokeWidth={activeHover === "afs_izq" ? "12" : "8"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("afs_izq", "AFS L", "280", "210", "start")}
        </g>

        {/* AP - Arteria Poplítea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("ap_izq")}
          onMouseEnter={() => setActiveHover("ap_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 270 260 L 275 320" 
            fill="none" 
            stroke={getSegmentColor("ap_izq")} 
            strokeWidth={activeHover === "ap_izq" ? "11" : "7"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("ap_izq", "A. Poplítea L", "285", "290", "start")}
        </g>

        {/* ATA - Arteria Tibial Anterior */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("ata_izq")}
          onMouseEnter={() => setActiveHover("ata_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 275 320 L 290 410" 
            fill="none" 
            stroke={getSegmentColor("ata_izq")} 
            strokeWidth={activeHover === "ata_izq" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("ata_izq", "ATA L", "300", "375", "start")}
        </g>

        {/* ATP - Arteria Tibial Posterior */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("atp_izq")}
          onMouseEnter={() => setActiveHover("atp_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 275 320 L 278 410" 
            fill="none" 
            stroke={getSegmentColor("atp_izq")} 
            strokeWidth={activeHover === "atp_izq" ? "8" : "5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("atp_izq", "ATP L", "265", "380", "end")}
        </g>

        {/* APer - Arteria Peronea */}
        <g 
          className="cursor-pointer group" 
          onClick={() => onToggleSegment("aper_izq")}
          onMouseEnter={() => setActiveHover("aper_izq")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path 
            d="M 275 335 L 260 405" 
            fill="none" 
            stroke={getSegmentColor("aper_izq")} 
            strokeWidth={activeHover === "aper_izq" ? "8" : "4.5"} 
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          {renderRotulo("aper_izq", "A. Peronea L", "250", "415", "end")}
        </g>

        {/* Draw refined explicit plaque/reflux overlays with leader lines */}
        {renderOverlayAnomalies(arterialMidpoints)}

        {/* Overlay hover details or legends */}
        {activeHover && (
          <g>
            <rect x="20" y="390" width="360" height="45" rx="8" fill="#111827" stroke="#374151" strokeWidth="2" opacity="0.95" />
            <text x="40" y="408" fill="#e5e7eb" fontSize="10" fontWeight="bold">Segmento: <tspan fill="#6366f1" fontWeight="bold" className="uppercase">{activeHover.replace("_der", " Der").replace("_izq", " Izq")}</tspan></text>
            <text x="40" y="423" fill="#9ca3af" fontSize="9">Estado: <tspan fill={getSegmentColor(activeHover)} fontWeight="bold">{getSegmentLabel(activeHover)}</tspan> • {descriptions[activeHover] || "Sin anomalías notables detectadas."}</text>
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="bg-slate-900 border-2 border-indigo-950/65 hover:border-indigo-800/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {/* Visual glowing effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-indigo-950/80 pb-4 mb-5 gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1 px-2.5 bg-indigo-950/80 border border-indigo-500/35 rounded-lg">
              <Activity className="h-4 w-4 text-indigo-400" />
            </div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest font-mono">
              Sección Vascular Doppler & Mapeo Esquemático
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 font-medium uppercase font-mono tracking-wider">
            Sintetiza hallazgos en cuadros, personaliza el mapa interactivo y adjúntalo directo al PDF clínico.
          </p>
        </div>
        
        {/* Toggle to include visual inside final printed PDF */}
        <div className="flex items-center gap-2.5 bg-slate-950/70 p-2.5 px-4 rounded-xl border border-slate-850 self-stretch md:self-auto justify-between select-none">
          <label className="text-[9px] font-black text-slate-400 uppercase font-mono tracking-wider cursor-pointer" htmlFor="include-vascular-toggle">
            Adjuntar Esquema a PDF / Impresión
          </label>
          <input 
            type="checkbox"
            id="include-vascular-toggle"
            checked={includeInReport}
            onChange={(e) => setIncludeInReport(e.target.checked)}
            className="w-4.5 h-4.5 accent-indigo-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Drawing and Interactive Mapping */}
        <div className="lg:col-span-5 bg-slate-950/65 rounded-2xl p-4 border border-indigo-950/50 flex flex-col items-center justify-center relative">
          <span className="absolute top-3 left-4 text-[8px] font-black font-mono tracking-widest bg-indigo-950 text-indigo-300 border border-indigo-900/30 px-2 py-0.5 rounded uppercase">
            {isCarotidas ? "Sistema Carotídeo" : isVenoso ? "Retorno Venoso" : "Arbol Arterial de Miembros"}
          </span>
          <span className="absolute top-3 right-4 text-[8.5px] text-slate-500 font-bold uppercase tracking-wider font-mono">
            Haz clic en vasos para cambiar estado
          </span>

          <div className="relative pt-6">
            {isCarotidas && renderCarotidSVG()}
            {isVenoso && renderVenousSVG()}
            {isArterial && renderArterialSVG()}
          </div>

          {/* Color coding legend */}
          <div className={`w-full grid ${(!isLimbEvaluated("der") || !isLimbEvaluated("izq")) ? "grid-cols-4" : "grid-cols-3"} gap-2 mt-4 pt-4 border-t border-slate-850 text-center font-mono`}>
            <div className="space-y-1">
              <div className="h-1.5 w-8 mx-auto bg-emerald-500 rounded" />
              <div className="text-[8px] font-bold text-slate-400 uppercase">Verde: Normal</div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-8 mx-auto bg-amber-500 rounded" />
              <div className="text-[8px] font-bold text-slate-400 uppercase">{isVenoso ? "Amarillo: Reflujo" : "Amarillo: Leve"}</div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-8 mx-auto bg-red-500 rounded" />
              <div className="text-[8px] font-bold text-slate-400 uppercase">{isVenoso ? "Rojo: Trombosis" : "Rojo: Obstruido / Oclusión"}</div>
            </div>
            {(!isLimbEvaluated("der") || !isLimbEvaluated("izq")) && (
              <div className="space-y-1">
                <div className="h-1.5 w-8 mx-auto bg-slate-500 rounded" />
                <div className="text-[8px] font-bold text-slate-400 uppercase">Gris: No eval.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Extraction HUD & Table representation */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex-1 py-3 bg-indigo-950/80 hover:bg-indigo-900 border-2 border-indigo-900 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-455" />
                  Analizando Reporte con IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  Sintetizar Hallazgos & Generar Cuadro
                </>
              )}
            </button>

            {table && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={onExportTable}
                  className={`py-3 px-5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer ${
                    displayFormat === "table"
                      ? "bg-slate-950 hover:bg-slate-900 border-2 border-indigo-650 text-indigo-300"
                      : "bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 text-slate-400"
                  }`}
                  title="Incrustar el cuadro en formato Markdown en el informe"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-450" />
                  Incrustar Tabla en PDF
                </button>
                {onExportBlocks && (
                  <button
                    onClick={() => onExportBlocks(getBlocksText())}
                    className={`py-3 px-5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer ${
                      displayFormat === "blocks"
                        ? "bg-slate-950 hover:bg-slate-900 border-2 border-indigo-650 text-indigo-300"
                        : "bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 text-slate-400"
                    }`}
                    title="Incrustar el formato bloques compatible con software de reportes"
                  >
                    <CheckCircle className="h-4 w-4 text-sky-400" />
                    Incrustar Bloques en Reporte
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-rose-950/30 border border-rose-500/25 rounded-2xl p-4 flex gap-3 text-rose-350">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider leading-relaxed">{error}</p>
            </div>
          )}

          {/* Table display & editable list */}
          {table ? (
            <div className="space-y-4">
              {renderClinicalBentoDashboard()}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-950/60 shadow-inner">
                <div className="flex items-center justify-between border-b border-indigo-950/70 pb-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDisplayFormat("table")}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                        displayFormat === "table" 
                          ? "bg-indigo-950/80 border-indigo-600/50 text-indigo-300" 
                          : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Formato Tabla (PDF)
                    </button>
                    <button
                      onClick={() => setDisplayFormat("blocks")}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                        displayFormat === "blocks" 
                          ? "bg-indigo-950/80 border-indigo-600/50 text-indigo-300" 
                          : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Síntesis Estructurada (EMR)
                    </button>
                  </div>
                  
                  {displayFormat === "table" ? (
                    <span className="text-[8px] font-mono text-slate-500 uppercase font-bold">
                      Markdown Generado listo para el PDF
                    </span>
                  ) : (
                    <button
                      onClick={handleCopyBlocks}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-emerald-600/40 text-slate-350 hover:text-emerald-400 text-[8.5px] font-black uppercase rounded tracking-wider transition-all flex items-center gap-1.5 font-mono cursor-pointer"
                    >
                      {copiedBlocksFeedback ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-450" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar Bloques
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Parse & Display table inside the component so doctors see exactly what was extracted */}
                <div className="prose prose-invert prose-xs font-sans max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-indigo">
                  <pre className="text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono font-semibold bg-slate-950 border border-slate-900 rounded p-3 select-all">
                    {displayFormat === "table" ? table : getBlocksText()}
                  </pre>
                </div>
              </div>

              {/* Segment detailed list for explicit editing */}
              <div className="bg-slate-950/40 rounded-2xl p-4 border border-slate-850 max-h-56 overflow-y-auto scrollbar-thin">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2.5">
                  Detalles Quirúrgicos Clave por Segmento Analizado
                </h4>
                <div className="divide-y divide-slate-900 font-mono">
                  {Object.keys(states).length === 0 ? (
                    <div className="text-[9px] py-4 text-slate-500 uppercase tracking-widest text-center font-bold">
                      No se han catalogado segmentos de momento. Haz clic en "Sintetizar Hallazgos".
                    </div>
                  ) : (
                    Object.entries(states).map(([id, st]) => (
                      <div key={id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-slate-900/10 rounded px-1 group">
                        <div className="space-y-0.5">
                          <span className="text-[9.5px] font-black text-slate-300 uppercase tracking-wide">
                            {id.replace("_der", " Derecho (R)").replace("_izq", " Izquierdo (L)").replace("acc", "Carótida Común (ACC)").replace("aci", "Carótida Interna (ACI)").replace("ace", "Carótida Externa (ACE)").replace("vert", "Vert. Artery").replace("vfc", "Femoral Común (VFC)").replace("vfs", "Femoral Superficial (VFS)").replace("vp", "Vena Poplítea (VP)").replace("vsm", "Safena Magna (VSM)").replace("vsp", "Safena Parva (VSP)").replace("sfj", "Unión SFJ").replace("aic", "Ilíaca Común (AIC)").replace("afc", "Femoral Común (AFC)").replace("afs", "Femoral Superficial (AFS)").replace("ap", "Arteria Poplítea (AP)").replace("ata", "Arteria Tibial Ant. (ATA)").replace("atp", "Arteria Tibial Post. (ATP)").replace("aper", "Arteria Peronea (APer)")}
                          </span>
                          <p className="text-[9px] text-slate-500 font-medium">
                            {descriptions[id] || "Flujo conservado sin alteraciones notables mapeadas."}
                          </p>
                        </div>
                        <button
                          onClick={() => onToggleSegment(id)}
                          style={{ borderColor: getSegmentColor(id) + "33", color: getSegmentColor(id) }}
                          className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border text-[8.5px] font-black uppercase rounded-lg transition-all text-right font-mono self-start sm:self-auto cursor-pointer"
                        >
                          {getSegmentLabel(id)}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-950/70 border-2 border-dashed border-slate-850 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3.5 mt-5">
              <div className="p-3 bg-indigo-950/30 border border-indigo-900/30 rounded-2xl text-indigo-400">
                <Layers className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-[10px] font-black text-slate-200 uppercase tracking-widest font-mono">
                  Sintetizador Vascular Desactivado
                </h4>
                <p className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                  Haz clic en el botón de arriba para que la IA extraiga los hallazgos descritos, rellene el mapa y arme el cuadro resumen para el reporte.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
