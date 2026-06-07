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
      descText.includes("difusa") || 
      descText.includes("difuso")
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

    result += `◆ SEGMENTOS CON FLUJOS Y PAREDES DENTRO DE LÍMITES CONSERVADOS:\n`;
    if (normals.length > 0) {
      normals.forEach(s => {
        const label = isVenoso ? "Permeable, sin reflujo" : "Normal, flujo conservado";
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
