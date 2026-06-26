import React, { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  Download
} from "lucide-react";

interface CalfAchillesAnatomyViewerProps {
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
  selectedModel?: string;
  externalStates?: Record<string, string>;
  externalDescriptions?: Record<string, string>;
  additionalFindings?: Array<{ id: string; structureName: string; state: string; description: string }>;
}

export default function CalfAchillesAnatomyViewer({
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions,
  selectedModel,
  externalStates,
  externalDescriptions,
  additionalFindings = []
}: CalfAchillesAnatomyViewerProps) {
  
  // Structures states:
  // - gastrocnemius_medial: no_descrito | normal | desgarro | miofascial | hematoma
  // - gastrocnemius_lateral: no_descrito | normal | desgarro | miofascial | hematoma
  // - soleus_muscle: no_descrito | normal | desgarro | miofascial
  // - achilles_tendon: no_descrito | normal | tendinosis | rotura_parcial | rotura_completa | entesopatia
  // - plantaris_tendon: no_descrito | normal | desgarro | engrosamiento
  // - retrocalcaneal_bursa: no_descrito | normal | bursitis
  const [states, setStates] = useState<Record<string, string>>({
    gastrocnemius_medial: "normal",
    gastrocnemius_lateral: "normal",
    soleus_muscle: "normal",
    achilles_tendon: "normal",
    plantaris_tendon: "normal",
    retrocalcaneal_bursa: "normal"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    gastrocnemius_medial: "Dentro de límites normales.",
    gastrocnemius_lateral: "Dentro de límites normales.",
    soleus_muscle: "Dentro de límites normales.",
    achilles_tendon: "Dentro de límites normales.",
    plantaris_tendon: "Dentro de límites normales.",
    retrocalcaneal_bursa: "Dentro de límites normales."
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("achilles_tendon");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);

  useEffect(() => {
    if (externalStates && Object.keys(externalStates).length > 0) {
      setStates(prev => {
        const changed = Object.keys(externalStates).some(key => externalStates[key] !== prev[key]);
        return changed ? { ...prev, ...externalStates } : prev;
      });
    }
  }, [externalStates]);

  useEffect(() => {
    if (externalDescriptions && Object.keys(externalDescriptions).length > 0) {
      setCustomDescriptions(prev => {
        const changed = Object.keys(externalDescriptions).some(key => externalDescriptions[key] !== prev[key]);
        return changed ? { ...prev, ...externalDescriptions } : prev;
      });
    }
  }, [externalDescriptions]);

  // Sync to parent
  useEffect(() => {
    if (onChangeStates) {
      onChangeStates(states);
    }
  }, [states, onChangeStates]);

  useEffect(() => {
    if (onChangeDescriptions) {
      onChangeDescriptions(customDescriptions);
    }
  }, [customDescriptions, onChangeDescriptions]);

  // Dictionary of keywords to match report text automatically
  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "gastrocnemius_medial":
        return [
          "gastrocnemio medial", "gastrocnemius medial", 
          "gemelo interno", "gemelo medial", "gastrocnemio interno"
        ];
      case "gastrocnemius_lateral":
        return [
          "gastrocnemio lateral", "gastrocnemius lateral", 
          "gemelo externo", "gemelo lateral", "gastrocnemio externo"
        ];
      case "soleus_muscle":
        return [
          "soleo", "sóleo", "músculo sóleo", "musculo soleo"
        ];
      case "achilles_tendon":
        return [
          "aquiles", "achilles", "tendon de aquiles", "tendón de aquiles",
          "tendon aquileo", "tendón aquileo"
        ];
      case "plantaris_tendon":
        return [
          "plantar delgado", "plantar largo", "tendon plantar", "tendón plantar", "músculo plantar"
        ];
      case "retrocalcaneal_bursa":
        return [
          "bursa retrocalcanea", "bolsa retrocalcanea", "retrocalcánea", "retrocalcanea",
          "bursitis retrocalcanea", "bursitis posterior"
        ];
      default:
        return [];
    }
  };

  const parseStateFromText = (id: string, text: string): string => {
    if (!text) return "no_descrito";
    const lower = text.toLowerCase().trim();

    const hasWord = (words: string[]): boolean => words.some(w => lower.includes(w));

    // Negations list for "normal"
    const isNormal = hasWord([
      "normal", "conservado", "sin alteraciones", "integro", "íntegro", 
      "sin desgarro", "sin rotura", "no muestra desgarros", "sin signos de rotura",
      "no se observa rotura", "adecuado", "homoge", "espesor conservado", "sin particularidades"
    ]) && !hasWord(["desgarro de", "rotura de", "ruptura de", "con desgarro", "con rotura", "foco de"]);

    if (isNormal) return "normal";

    const lowercaseText = text.toLowerCase();
    
    // Search for matching diagnostic keywords to get a clear, concise dynamic synthesis:
    if (lowercaseText.includes("ruptura completa") || lowercaseText.includes("rotura completa") || lowercaseText.includes("ruptura total") || lowercaseText.includes("rotura total")) {
      return "Ruptura Completa";
    }
    if (lowercaseText.includes("ruptura parcial") || lowercaseText.includes("rotura parcial") || lowercaseText.includes("microdesgarros") || lowercaseText.includes("microdesgarro") || lowercaseText.includes("rotura de espesor parcial")) {
      return "Ruptura Parcial";
    }
    if (lowercaseText.includes("ruptura de tend") || lowercaseText.includes("ruptura del tend") || lowercaseText.includes("rotura de tend") || lowercaseText.includes("rotura del tend") || lowercaseText.includes("rotura") || lowercaseText.includes("ruptura")) {
      return "Ruptura";
    }
    if (lowercaseText.includes("desgarro miofascial") || lowercaseText.includes("lesion miofascial") || lowercaseText.includes("lesión miofascial") || lowercaseText.includes("union miotendinosa") || lowercaseText.includes("unión miotendinosa")) {
      return "Desgarro Miofascial";
    }
    if (lowercaseText.includes("desgarro") || lowercaseText.includes("rotura fibrilar") || lowercaseText.includes("ruptura fibrilar") || lowercaseText.includes("lesion fibrilar") || lowercaseText.includes("lesión fibrilar")) {
      return "Desgarro Fibrilar";
    }
    if (lowercaseText.includes("bursitis")) {
      return "Bursitis";
    }
    if (lowercaseText.includes("tendinosis") || lowercaseText.includes("tendinitis") || lowercaseText.includes("tendinopatia") || lowercaseText.includes("tendinopatía")) {
      return "Tendinosis";
    }
    if (lowercaseText.includes("entesopatia") || lowercaseText.includes("entesopatía") || lowercaseText.includes("espolon") || lowercaseText.includes("espolón")) {
      return "Entesopatía";
    }
    if (lowercaseText.includes("hematoma") || lowercaseText.includes("colección") || lowercaseText.includes("coleccion")) {
      return "Hematoma";
    }
    if (lowercaseText.includes("engrosado") || lowercaseText.includes("engrosamiento")) {
      return "Engrosamiento";
    }

    // Default dynamic synthesis: strip bullet, make first letter uppercase
    let clean = text.replace(/^\s*[-*•\d.+/#\t]+\s*/, "").trim();
    if (clean.endsWith(".")) clean = clean.slice(0, -1);
    
    // If there is a colon, take the part after the colon
    const colonIdx = clean.indexOf(":");
    if (colonIdx !== -1) {
      clean = clean.substring(colonIdx + 1).trim();
    }

    // Capitalize
    if (clean.length > 0) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    
    return "Alteración";
  };

  const extractDescriptionFromReportText = (id: string, reportText: string): string => {
    if (!reportText) return "";
    const lines = reportText.split("\n");
    const keywords = getStructureKeywords(id);
    const candidates: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const lowerLine = line.toLowerCase();
      
      const matches = keywords.some(kw => lowerLine.includes(kw));
      if (matches) {
        let clean = line.replace(/^\s*[-*•\d.+/#\t]+\s*/, "");
        const colonIdx = clean.indexOf(":");
        if (colonIdx !== -1) {
          clean = clean.substring(colonIdx + 1).trim();
        }
        candidates.push(clean);
      }
    }

    if (candidates.length === 0) return "";
    return candidates.sort((a, b) => b.length - a.length)[0];
  };

  const translateStructureLabelInBrief = (id: string): string => {
    switch (id) {
      case "gastrocnemius_medial": return "Gastrocnemio Medial";
      case "gastrocnemius_lateral": return "Gastrocnemio Lateral";
      case "soleus_muscle": return "Músculo Sóleo";
      case "achilles_tendon": return "Tendón de Aquiles";
      case "plantaris_tendon": return "Plantar Delgado";
      case "retrocalcaneal_bursa": return "Bolsa Retrocalcánea";
      default: return id;
    }
  };

  const getSimplifiedDescriptionByState = (id: string, state: string): string => {
    if (state === "no_descrito") return "No mencionado / No descrito.";
    if (state === "normal") return "Dentro de límites normales.";

    const standardStates = [
      "normal", "no_descrito", "desgarro", "miofascial", "hematoma",
      "tendinosis", "rotura_parcial", "rotura_completa", "entesopatia", "engrosamiento", "bursitis"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "gastrocnemius_medial":
        if (state === "desgarro") return "Desgarro de la unión miotendinosa distal (Tennis Leg) con retracción moderada.";
        if (state === "miofascial") return "Microdesgarro miofascial medial leve con edema laminar adyacente.";
        if (state === "hematoma") return "Hematoma intramuscular circunscrito con colección de ecogenicidad mixta.";
        break;
      case "gastrocnemius_lateral":
        if (state === "desgarro") return "Foco de desgarro fibrilar agudo en tercio distal del vientre muscular sin retracción.";
        if (state === "miofascial") return "Edema miofascial periférico agudo compatible con distensión de la aponeurosis.";
        if (state === "hematoma") return "Hematoma intrafascial laminar laxo sin repercusión compresiva local.";
        break;
      case "soleus_muscle":
        if (state === "desgarro") return "Foco de desgarro intramuscular grado II (espesor parcial) en la porción anterior.";
        if (state === "miofascial") return "Edema interfascicular laxo y discreto despegamiento miofascial posterior.";
        break;
      case "achilles_tendon":
        if (state === "tendinosis") return "Tendinosis difusa sin rotura, con engrosamiento y pérdida del patrón fibrilar normal.";
        if (state === "rotura_parcial") return "Rotura parcial aguda de fibras del tercio medio con brecha anecoica de espesor parcial.";
        if (state === "rotura_completa") return "Ruptura completa en tercio medio con brecha líquida de 15mm y cabos retraídos.";
        if (state === "entesopatia") return "Entesopatía insercional calcificante con microespolón calcáneo y edema óseo reactivo.";
        break;
      case "plantaris_tendon":
        if (state === "desgarro") return "Disrupción completa del trayecto fibrilar del plantar con retracción proximal.";
        if (state === "engrosamiento") return "Engrosamiento reactivo y pérdida focal de la ecogenicidad habitual.";
        break;
      case "retrocalcaneal_bursa":
        if (state === "bursitis") return "Bursitis retrocalcánea moderada con distensión líquida anecoica e hipertrofia sinovial.";
        break;
    }
    return "Estructura alterada.";
  };

  const getSimplifiedDescription = (id: string): string => {
    return getSimplifiedDescriptionByState(id, states[id]);
  };

  const runLocalHeuristics = (logs: string[]) => {
    const updatedStates: Record<string, string> = { ...states };
    const updatedDescriptions: Record<string, string> = { ...customDescriptions };

    const structureKeys = ["gastrocnemius_medial", "gastrocnemius_lateral", "soleus_muscle", "achilles_tendon", "plantaris_tendon", "retrocalcaneal_bursa"];
    let parsedCount = 0;
    let foundPathologies = 0;

    // We prioritize scanning the "IMPRESIÓN DIAGNÓSTICA" or "Conclusiones" section to extract findings as requested
    let targetText = generatedReport;
    const diagnosticsIndex = generatedReport.toLowerCase().search(/(impresi[oó]n diagn[oó]stica|conclusi(o|ó)n|diagn[oó]stico)/);
    if (diagnosticsIndex !== -1) {
      targetText = generatedReport.substring(diagnosticsIndex);
      logs.push(`🔍 Se detectó sección de Impresión Diagnóstica en el reporte. Analizando este segmento prioritario...`);
    } else {
      logs.push(`⚠️ No se detectó sección de Conclusiones/Impresión por separado. Analizando texto completo fallback...`);
    }

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => targetText.toLowerCase().includes(kw));

      if (isMentioned) {
        // First try to extract description from targeted section, if empty fallback to full text
        let extractedFindings = extractDescriptionFromReportText(id, targetText);
        if (!extractedFindings && targetText !== generatedReport) {
          extractedFindings = extractDescriptionFromReportText(id, generatedReport);
        }
        
        let parsedState = parseStateFromText(id, extractedFindings || "");
        if (parsedState === "no_descrito") {
          parsedState = "normal";
        }
        
        updatedStates[id] = parsedState;
        updatedDescriptions[id] = extractedFindings || getSimplifiedDescriptionByState(id, parsedState);
        
        parsedCount++;
        if (parsedState !== "normal") foundPathologies++;
        logs.push(`[Análisis] ${translateStructureLabelInBrief(id)}: ${parsedState.toUpperCase()}`);
      } else {
        updatedStates[id] = "normal";
        updatedDescriptions[id] = "Dentro de límites normales.";
      }
    });

    setStates(updatedStates);
    setCustomDescriptions(updatedDescriptions);
    setLastSyncedReport(generatedReport);
  };

  const handleScanReportText = async (showFeedBack: boolean = false) => {
    if (!generatedReport) {
      if (showFeedBack) {
        setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: No hay reporte clínico disponible para analizar.`]);
      }
      return;
    }

    setIsSyncing(true);
    const logs: string[] = [];
    logs.push(`Iniciando extracción de hallazgos desde Impresión Diagnóstica (${generatedReport.length} caracteres)...`);
    
    try {
      // Execute local parser heuristics as requested
      runLocalHeuristics(logs);
      logs.push(`✨ Sincronización exitosa. Extracción completada.`);
    } catch (err) {
      console.error(err);
      logs.push(`❌ Error durante el procesamiento: ${(err as Error).message}`);
    } finally {
      setIsSyncing(false);
      setSyncLogs(logs);
    }
  };

  // Run automatically when the generated report changes to keep illustration in sync in real-time
  useEffect(() => {
    // Automatic sync is disabled to enforce strict manual synchronization as requested.
  }, [generatedReport, lastSyncedReport]);

  const syncStateColor = (id: string, s: string) => {
    if (s === "no_descrito") return "bg-slate-800 text-slate-400 border-slate-700";
    if (s === "normal") return "bg-emerald-950/40 text-emerald-400 border-emerald-900/60";
    return "bg-amber-950/40 text-amber-400 border-amber-900/60";
  };

  const getColorForSVG = (id: string) => {
    const s = states[id] || "no_descrito";
    const isHovered = activeHover === id || selectedStructure === id;

    if (s === "no_descrito") {
      return {
        fill: isHovered ? "#334155" : "#1e293b",
        stroke: isHovered ? "#64748b" : "#475569"
      };
    }
    if (s === "normal" || s === "Normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.22)",
        stroke: "#10b981"
      };
    }
    // Pathologies
    return {
      fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
      stroke: "#f59e0b"
    };
  };

  const generateTableMarkdown = () => {
    let md = `| Estructura Anatómica | Detalle / Descripción de Hallazgos Clínicos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "gastrocnemius_medial", label: "Gastrocnemio Medial (Gemelo Interno)" },
      { id: "gastrocnemius_lateral", label: "Gastrocnemio Lateral (Gemelo Externo)" },
      { id: "soleus_muscle", label: "Músculo Sóleo" },
      { id: "achilles_tendon", label: "Tendón de Aquiles" },
      { id: "plantaris_tendon", label: "Tendón Plantar Delgado" },
      { id: "retrocalcaneal_bursa", label: "Bolsa Retrocalcánea" }
    ];

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito" && states[item.id] !== "normal") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras de la pantorrilla y tendón de Aquiles se reportan normales.* |\n`;
    }

    return md;
  };

  const generateNarrativeText = () => {
    const list = [
      { id: "gastrocnemius_medial", label: "Gastrocnemio Medial" },
      { id: "gastrocnemius_lateral", label: "Gastrocnemio Lateral" },
      { id: "soleus_muscle", label: "Músculo Sóleo" },
      { id: "achilles_tendon", label: "Tendón de Aquiles" },
      { id: "plantaris_tendon", label: "Plantar Delgado" },
      { id: "retrocalcaneal_bursa", label: "Bolsa Retrocalcánea" }
    ];

    let md = "";
    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const isNorm = states[item.id] === "normal";
        const statusText = isNorm ? "Normal" : "Lesión / Hallazgo";
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `* **${item.label}** [${statusText.toUpperCase()}]: ${desc}\n`;
      }
    });

    return md;
  };

  const resetAllStructures = () => {
    setStates({
      gastrocnemius_medial: "normal",
      gastrocnemius_lateral: "normal",
      soleus_muscle: "normal",
      achilles_tendon: "normal",
      plantaris_tendon: "normal",
      retrocalcaneal_bursa: "normal"
    });
    setCustomDescriptions({
      gastrocnemius_medial: "Dentro de límites normales.",
      gastrocnemius_lateral: "Dentro de límites normales.",
      soleus_muscle: "Dentro de límites normales.",
      achilles_tendon: "Dentro de límites normales.",
      plantaris_tendon: "Dentro de límites normales.",
      retrocalcaneal_bursa: "Dentro de límites normales."
    });
    setSyncLogs([]);
  };

  return (
    <div id="calf-achilles-anatomy-viewer" className="bg-slate-900/90 border-2 border-indigo-500/20 backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative overflow-hidden font-sans">
      
      {/* Decorative ambient light */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                Mapa Anatómico e Infografía Interactiva desglosada
              </h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
                Protocolo: Pantorrilla y Tendón de Aquiles
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 py-1.5 px-3 rounded-xl text-[11px] font-bold text-slate-300 cursor-pointer hover:bg-slate-950 transition">
            <input 
              type="checkbox" 
              checked={includeInReport}
              onChange={(e) => setIncludeInReport && setIncludeInReport(e.target.checked)}
              className="accent-indigo-500 w-3.5 h-3.5 rounded"
            />
            <span>Incluir Anexo en PDF</span>
          </label>

          <button
            type="button"
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black text-[10px] tracking-wider uppercase px-4 py-2 rounded-xl flex items-center gap-1.5 transition duration-200 shadow-md shadow-indigo-600/15 cursor-pointer active:scale-97 select-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
          </button>

          <button
            type="button"
            onClick={resetAllStructures}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-[10px] tracking-wider uppercase px-3 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer select-none"
            title="Reestablecer todas las capas musculares y tendinosas"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* SYNC NOTICE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* INTERACTIVE SVG GRID COL: 5/12 */}
        <div className="lg:col-span-5 bg-slate-950/40 rounded-2.5xl border border-slate-850/60 p-4 flex flex-col items-center justify-center min-h-[380px] shadow-inner relative">
          
          <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-800/80 text-[9px] text-slate-400 font-mono py-1 px-2.5 rounded-lg select-none">
            Visión Posterior Pantorrilla (Gastrosoleo-Achilles)
          </div>

          {/* THE SVG DIAGRAM */}
          <svg id="calf-achilles-anatomy-svg" viewBox="0 0 400 420" className="w-full max-w-[280px] h-auto drop-shadow-2xl select-none mt-6">
            <defs>
              <linearGradient id="gradient_muscles_calf" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3d4e66" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>

            {/* Posterior body shape contour (silhouette) of the calf / Achilles / heel */}
            <path 
              d="M110,35 C150,30 250,30 290,35 Q305,110 280,240 T215,360 L212,385 C212,392 205,398 190,398 C173,398 165,392 165,385 L162,360 T120,240 Q95,110 110,35 Z" 
              fill="#060913" 
              stroke="#1e293b" 
              strokeWidth="2.5" 
              className="transition-colors duration-300"
            />
            
            {/* Fine grids or guidelines represent muscle fibers visually */}
            <path d="M 170,40 Q 180,100 190,190" fill="none" stroke="#253545" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
            <path d="M 230,40 Q 220,100 210,190" fill="none" stroke="#253545" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />

            {/* 1. MÚSCULO SÓLEO (Located deeper, beneath gastroc, visible on outer segments and down the calf) */}
            <g 
              id="soleus_muscle"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("soleus_muscle")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("soleus_muscle")}
            >
              <path 
                d="M 145,110 C 130,160 135,210 170,255 L 230,255 C 265,210 270,160 255,110 C 235,160 165,160 145,110 Z"
                fill={getColorForSVG("soleus_muscle").fill}
                stroke={getColorForSVG("soleus_muscle").stroke}
                strokeWidth={selectedStructure === "soleus_muscle" ? "3.5" : "1.5"}
              />
              <text x="200" y="240" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold" opacity="0.65" pointerEvents="none">M. SÓLEO</text>
            </g>

            {/* 2. GASTROCNEMIO MEDIAL (Gemelo Interno - Left side on visual posterior view) */}
            <g 
              id="gastrocnemius_medial"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("gastrocnemius_medial")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("gastrocnemius_medial")}
            >
              <path 
                d="M 130,45 C 120,95 135,175 185,190 C 195,145 190,95 180,45 Z"
                fill={getColorForSVG("gastrocnemius_medial").fill}
                stroke={getColorForSVG("gastrocnemius_medial").stroke}
                strokeWidth={selectedStructure === "gastrocnemius_medial" ? "3.5" : "1.5"}
              />
              <text x="156" y="115" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="black" opacity="0.8" pointerEvents="none">GEMELO</text>
              <text x="156" y="125" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="black" opacity="0.8" pointerEvents="none">INTERNO</text>
            </g>

            {/* 3. GASTROCNEMIO LATERAL (Gemelo Externo - Right side on visual posterior view) */}
            <g 
              id="gastrocnemius_lateral"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("gastrocnemius_lateral")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("gastrocnemius_lateral")}
            >
              <path 
                d="M 220,45 C 210,95 205,145 215,190 C 265,175 280,95 270,45 Z"
                fill={getColorForSVG("gastrocnemius_lateral").fill}
                stroke={getColorForSVG("gastrocnemius_lateral").stroke}
                strokeWidth={selectedStructure === "gastrocnemius_lateral" ? "3.5" : "1.5"}
              />
              <text x="244" y="115" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="black" opacity="0.8" pointerEvents="none">GEMELO</text>
              <text x="244" y="125" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="black" opacity="0.8" pointerEvents="none">EXTERNO</text>
            </g>

            {/* 4. PLANTAR DELGADO (Plantaris tendon running medially alongside soleus/gastroc edge) */}
            <g 
              id="plantaris_tendon"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("plantaris_tendon")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("plantaris_tendon")}
            >
              <path 
                d="M 197,60 L 195,190 L 178,255 L 176,330"
                fill="none"
                stroke={getColorForSVG("plantaris_tendon").stroke}
                strokeWidth={selectedStructure === "plantaris_tendon" ? "4.5" : "2"}
                strokeDasharray="2 1"
              />
              <text x="168" y="295" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="semibold" opacity="0.65" pointerEvents="none" transform="rotate(-70 168 295)">M. PLANTAR</text>
            </g>

            {/* Calcaneus outline guide for references */}
            <path d="M 172,365 C 172,365 168,382 195,392 L 205,392 C 212,382 208,365 208,365 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" opacity="0.5" />

            {/* 5. TENDÓN DE AQUILES (Lower region, thick band convening to calcaneus) */}
            <g 
              id="achilles_tendon"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("achilles_tendon")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("achilles_tendon")}
            >
              <path 
                d="M 188,258 C 190,290 191,325 191,365 L 209,365 C 209,325 210,290 212,258 Z"
                fill={getColorForSVG("achilles_tendon").fill}
                stroke={getColorForSVG("achilles_tendon").stroke}
                strokeWidth={selectedStructure === "achilles_tendon" ? "3.5" : "1.5"}
              />
              {/* Highlight cross-lines to denote thick fibrous Achilles tendon */}
              <line x1="192" y1="285" x2="208" y2="285" stroke="#ffffff" opacity="0.3" strokeWidth="1" />
              <line x1="192" y1="312" x2="208" y2="312" stroke="#ffffff" opacity="0.3" strokeWidth="1" />
              <line x1="192" y1="340" x2="208" y2="340" stroke="#ffffff" opacity="0.3" strokeWidth="1" />
              <text x="200" y="325" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="black" opacity="0.9" pointerEvents="none">T. DE AQUILES</text>
            </g>

            {/* 6. BOLSA RETROCALCÁNEA (At insertion of the achilles tendon deep on calcaneus corner) */}
            <g 
              id="retrocalcaneal_bursa"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("retrocalcaneal_bursa")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("retrocalcaneal_bursa")}
            >
              <ellipse 
                cx="183" 
                cy="358" 
                rx="7.5" 
                ry="10.5"
                fill={getColorForSVG("retrocalcaneal_bursa").fill}
                stroke={getColorForSVG("retrocalcaneal_bursa").stroke}
                strokeWidth={selectedStructure === "retrocalcaneal_bursa" ? "3" : "1.2"}
              />
              <text x="183" y="361" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="black" opacity="0.9" pointerEvents="none">BURSA</text>
            </g>

          </svg>

          {/* Quick labels guide footer */}
          <div className="w-full mt-4 border-t border-slate-900 pt-3 flex flex-wrap justify-between items-center text-[10px] text-slate-400 font-mono gap-1 select-none">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-emerald-500 bg-emerald-500/20" /> Sano
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-amber-500 bg-amber-500/20" /> Con Hallazgo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-600 bg-slate-800" /> No descrito
            </span>
          </div>
        </div>

        {/* DETAILED CONTROLLER PANE: 7/12 */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-900 p-5 space-y-5">
          <div className="border-b border-slate-900 pb-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5 p-1 rounded-lg">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Diagnóstico Detallado del Compartimento</span>
            </h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
              Seleccione una estructura del dibujo o use la lista inferior para evaluar su estado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* QUICK STRUCTURE LIST */}
            <div className="space-y-1.5 max-h-[175px] overflow-y-auto pr-1 select-none scrollbar-thin">
              {[
                { id: "gastrocnemius_medial", label: "Gemelo Interno (G. Medial)" },
                { id: "gastrocnemius_lateral", label: "Gemelo Externo (G. Lateral)" },
                { id: "soleus_muscle", label: "Músculo Sóleo" },
                { id: "achilles_tendon", label: "Tendón de Aquiles" },
                { id: "plantaris_tendon", label: "Plantar Delgado" },
                { id: "retrocalcaneal_bursa", label: "Bolsa Retrocalcánea" }
              ].map(item => {
                const s = states[item.id] || "no_descrito";
                const isSelected = selectedStructure === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedStructure(item.id)}
                    className={`w-full text-left p-2 rounded-xl border flex items-center justify-between text-[11px] font-bold tracking-wide transition-all ${
                      isSelected 
                        ? "bg-slate-900/100 border-indigo-600 text-white" 
                        : "bg-slate-950 border-slate-900 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] uppercase border ${syncStateColor(item.id, s)}`}>
                      {s === "normal" ? "Sano" : s.replace("_", " ")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* EDITING STATE FORM FOR SELECTED STRUCTURE */}
            {selectedStructure && (
              <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl flex flex-col justify-between space-y-3">
                <div>
                  <label className="text-[9.5px] font-black uppercase text-indigo-400 font-mono tracking-widest block mb-1">
                    Hallazgo / Estado: {translateStructureLabelInBrief(selectedStructure)}
                  </label>
                  
                  {/* Select for states based on selected structure */}
                  {(() => {
                    const currentState = states[selectedStructure] || "no_descrito";
                    const isCustomState = currentState !== "no_descrito" && currentState !== "normal" &&
                      !["desgarro", "miofascial", "hematoma", "tendinosis", "rotura_parcial", "rotura_completa", "entesopatia", "engrosamiento", "bursitis"].includes(currentState);
                    return (
                      <select
                        value={currentState}
                        onChange={(e) => {
                          const nextState = e.target.value;
                          setStates(prev => ({ ...prev, [selectedStructure]: nextState }));
                          setCustomDescriptions(prev => ({
                            ...prev,
                            [selectedStructure]: getSimplifiedDescriptionByState(selectedStructure, nextState)
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="no_descrito">No descrito / No especificado</option>
                        <option value="normal">Normal / Sano</option>
                        {isCustomState && (
                          <option value={currentState}>{currentState.replace(/_/g, " ")} (Detectado)</option>
                        )}
                        
                        {/* Muscle options */}
                        {(selectedStructure.includes("gastrocnemius") || selectedStructure === "soleus_muscle") && (
                          <>
                            <option value="desgarro">Desgarro muscular (Fibrilar)</option>
                            <option value="miofascial">Distensión / Lesión Miofascial</option>
                            <option value="hematoma">Colección líquida / Hematoma</option>
                          </>
                        )}

                        {/* Achilles option */}
                        {selectedStructure === "achilles_tendon" && (
                          <>
                            <option value="tendinosis">Tendinosis difusa / Engrosamiento</option>
                            <option value="rotura_parcial">Rotura Espesor Parcial</option>
                            <option value="rotura_completa">Ruptura Transversal Completa</option>
                            <option value="entesopatia">Entesopatía insercional calcificada</option>
                          </>
                        )}

                        {/* Plantaris option */}
                        {selectedStructure === "plantaris_tendon" && (
                          <>
                            <option value="desgarro">Ruptura / Disrupción fibrosa</option>
                            <option value="engrosamiento">Engrosamiento reactivo</option>
                          </>
                        )}

                        {/* Bursa option */}
                        {selectedStructure === "retrocalcaneal_bursa" && (
                          <>
                            <option value="bursitis">Bursitis (Distended fluid/Synovitis)</option>
                          </>
                        )}
                      </select>
                    );
                  })()}
                </div>

                <div className="text-[9.5px] text-slate-400 leading-normal bg-slate-950 p-2 rounded-lg border border-slate-900/60 font-medium">
                  💡 Elija "Normal / Sano" para colocar la descripción estándar. Al elegir un hallazgo patológico, se sugiere un redactado clínico prototípico automáticamente.
                </div>
              </div>
            )}
          </div>

          {/* CUSTOM COMMENT DESCRIPTION EDITOR */}
          {selectedStructure && (
            <div className="space-y-2 pt-2 border-t border-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Descripción clínica en el reporte de: {translateStructureLabelInBrief(selectedStructure)}
                </span>
                
                {/* Reset description to default proposed */}
                <button
                  type="button"
                  onClick={() => {
                    const currentSt = states[selectedStructure] || "no_descrito";
                    setCustomDescriptions(prev => ({
                      ...prev,
                      [selectedStructure]: getSimplifiedDescriptionByState(selectedStructure, currentSt)
                    }));
                  }}
                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                  title="Restaurar descripción clínica típica del hallazgo"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Sugerida</span>
                </button>
              </div>

              <textarea
                value={customDescriptions[selectedStructure] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: val }));
                }}
                rows={3}
                className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-600/60 rounded-xl p-3 text-xs text-slate-200 outline-none placeholder-slate-600 resize-none leading-relaxed"
                placeholder="Introduzca descripción clínica personalizada..."
              />
            </div>
          )}

          {/* ACTIONS AND EXPORTS BAR */}
          <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 pt-3 border-t border-slate-900">
            <div>
              <p className="text-[10.5px] text-slate-400 font-semibold leading-relaxed">
                Usa el botón <strong>Insertar Tabla</strong> para colocar el desglose ordenadamente en tu reporte escrito abajo. Sincronizar actualizará los hallazgos en el PDF descargado de manera paralela.
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onExportTable(generateTableMarkdown())}
                className="bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 font-extrabold text-[9.5px] uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer active:scale-97 select-none"
              >
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Insertar Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => onExportNarrative && onExportNarrative(generateNarrativeText())}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-bold text-[9.5px] uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer select-none"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Insertar Puntos</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SYNC ACTIONS LOG DIALOG IF NOT EMPTY */}
      {syncLogs.length > 0 && (
        <div className="mt-4 bg-slate-950/80 border border-slate-850/60 p-3 rounded-2xl select-none">
          <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Consola de Extracción Diagnóstica Inteligente</span>
            </span>
            <button 
              type="button" 
              onClick={() => setSyncLogs([])}
              className="text-[9px] font-extrabold uppercase text-slate-500 hover:text-slate-350 cursor-pointer"
            >
              Cerrar Consola
            </button>
          </div>
          <div className="font-mono text-[9px] text-slate-300 max-h-[100px] overflow-auto leading-relaxed space-y-0.5">
            {syncLogs.map((log, idx) => (
              <div key={idx} className={log.startsWith("❌") ? "text-rose-400 font-semibold" : log.includes("[Análisis]") ? "text-emerald-400 font-medium" : "text-slate-400"}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
