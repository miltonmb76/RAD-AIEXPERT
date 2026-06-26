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

interface AbdominalWallAnatomyViewerProps {
  selectedModel?: string;
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
  externalStates?: Record<string, string>;
  externalDescriptions?: Record<string, string>;
  additionalFindings?: Array<{ id: string; structureName: string; state: string; description: string }>;
}

export interface AbdominalWallStructure {
  id: string;
  name: string;
  description: string;
}

const ABDOMINAL_WALL_STRUCTURES = [
  { id: "rectus_abdominis_right", name: "Músculo Recto Anterior Derecho" },
  { id: "rectus_abdominis_left", name: "Músculo Recto Anterior Izquierdo" },
  { id: "oblique_muscles_right", name: "Músculos Oblicuos / Anchos Derechos" },
  { id: "oblique_muscles_left", name: "Músculos Oblicuos / Anchos Izquierdos" },
  { id: "linea_alba", name: "Línea Alba" },
  { id: "umbilical_region", name: "Región Umbilical" },
  { id: "epigastric_region", name: "Región Epigástrica" },
  { id: "inguinal_region_right", name: "Región Inguinal Derecha" },
  { id: "inguinal_region_left", name: "Región Inguinal Izquierda" },
  { id: "crural_region_right", name: "Región Crural Derecha (Femoral)" },
  { id: "crural_region_left", name: "Región Crural Izquierda (Femoral)" }
];

export default function AbdominalWallAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions,
  externalStates,
  externalDescriptions,
  additionalFindings = []
}: AbdominalWallAnatomyViewerProps) {
  
  // States of each structure taken directly from the "Impresión diagnóstica" of the report or custom-edited.
  const [states, setStates] = useState<Record<string, string>>({
    rectus_abdominis_right: "no_descrito",
    rectus_abdominis_left: "no_descrito",
    oblique_muscles_right: "no_descrito",
    oblique_muscles_left: "no_descrito",
    linea_alba: "no_descrito",
    umbilical_region: "no_descrito",
    epigastric_region: "no_descrito",
    inguinal_region_right: "no_descrito",
    inguinal_region_left: "no_descrito",
    crural_region_right: "no_descrito",
    crural_region_left: "no_descrito"
  });

  // Manual or custom descriptive text override
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    rectus_abdominis_right: "",
    rectus_abdominis_left: "",
    oblique_muscles_right: "",
    oblique_muscles_left: "",
    linea_alba: "",
    umbilical_region: "",
    epigastric_region: "",
    inguinal_region_right: "",
    inguinal_region_left: "",
    crural_region_right: "",
    crural_region_left: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("umbilical_region");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

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

  // Synchronize states to parent if callback is provided
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

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Analizando texto con reglas locales del lenguaje para pared abdominal...");
    const textLower = (generatedReport || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Extract Impression section
    let impressionText = textLower;
    const markers = ["impresion diagnostica", "conclusion", "conclusiones", "sintesis"];
    let bestIdx = -1;
    markers.forEach(m => {
      const idx = textLower.indexOf(m);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
      }
    });
    if (bestIdx !== -1) {
      impressionText = textLower.substring(bestIdx);
      logs.push("✓ Sección de Impresión Diagnóstica identificada localmente para el análisis modular.");
    }

    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    ABDOMINAL_WALL_STRUCTURES.forEach(struc => {
      let detectedState = "no_descrito";
      let desc = "No mencionado / No descrito.";

      // Heuristic rules for structures based solely on Impression text
      if (struc.id === "rectus_abdominis_right" || struc.id === "rectus_abdominis_left") {
        const sideWord = struc.id === "rectus_abdominis_right" ? "derecho" : "izquierdo";
        const isMentioned = impressionText.includes("recto") || impressionText.includes("rectos");
        if (isMentioned) {
          if (impressionText.includes("diastasis")) {
            detectedState = "Diástasis de rectos";
            desc = "Diástasis de los músculos rectos anterior.";
          } else if (impressionText.includes("desgarro") || impressionText.includes("ruptura")) {
            detectedState = "Desgarro muscular";
            desc = `Desgarro muscular en músculo recto anterior ${sideWord}.`;
          } else if (impressionText.includes("hematoma")) {
            detectedState = "Hematoma";
            desc = `Hematoma intramuscular recto anterior ${sideWord}.`;
          } else {
            detectedState = "Normal";
            desc = "Dentro de límites normales.";
          }
        }
      } else if (struc.id === "oblique_muscles_right" || struc.id === "oblique_muscles_left") {
        const sideWord = struc.id === "oblique_muscles_right" ? "derecho" : "izquierdo";
        const isMentioned = impressionText.includes("oblicuo") || impressionText.includes("anchos") || impressionText.includes("transverso") || impressionText.includes("lateral");
        if (isMentioned) {
          if (impressionText.includes("desgarro") || impressionText.includes("rotura")) {
            detectedState = "Desgarro muscular";
            desc = `Pared muscular lateral / oblicua con signos de desgarro fibrilar ${sideWord}.`;
          } else {
            detectedState = "Normal";
            desc = "Dentro de límites normales.";
          }
        }
      } else if (struc.id === "linea_alba") {
        if (impressionText.includes("linea alba") || impressionText.includes("alba")) {
          if (impressionText.includes("diastasis")) {
            detectedState = "Diástasis";
            desc = "Defecto / distensión de la línea alba compatible con diástasis.";
          } else if (impressionText.includes("hernia")) {
            detectedState = "Hernia de línea alba";
            desc = "Hernia ventral / epigástrica de la línea alba.";
          } else {
            detectedState = "Normal";
            desc = "Dentro de límites normales.";
          }
        }
      } else if (struc.id === "umbilical_region") {
        if (impressionText.includes("umbilical") || impressionText.includes("ombligo")) {
          if (impressionText.includes("hernia")) {
            detectedState = "Hernia umbilical";
            desc = "Presencia de saco herniario en la región umbilical.";
          } else {
            detectedState = "Normal";
            desc = "Dentro de límites normales.";
          }
        }
      } else if (struc.id === "epigastric_region") {
        if (impressionText.includes("epigastr")) {
          if (impressionText.includes("hernia")) {
            detectedState = "Hernia epigástrica";
            desc = "Defecto herniario clínicamente visible en la región epigástrica.";
          } else if (impressionText.includes("lipoma")) {
            detectedState = "Lipoma epigástrico";
            desc = "Presencia de imagen compatible con lipoma subcutáneo.";
          } else {
            detectedState = "Normal";
            desc = "Dentro de límites normales.";
          }
        }
      } else if (struc.id === "inguinal_region_right" || struc.id === "inguinal_region_left") {
        const sideKey = struc.id === "inguinal_region_right" ? "derech" : "izquierd";
        if (impressionText.includes("inguinal")) {
          if (impressionText.includes(`inguinal ${sideKey}`) || impressionText.includes(`inguinal bilateral`) || impressionText.includes(`inguinales`)) {
            if (impressionText.includes("hernia")) {
              detectedState = "Hernia inguinal";
              desc = `Presencia de defecto herniario inguinal ${sideKey === "derech" ? "derecho" : "izquierdo"}.`;
            } else if (impressionText.includes("adenopatia") || impressionText.includes("ganglio")) {
              detectedState = "Adenopatía inguinal";
              desc = `Presencia de ganglios linfáticos prominentes.`;
            } else {
              detectedState = "Normal";
              desc = "Dentro de límites normales.";
            }
          }
        }
      } else if (struc.id === "crural_region_right" || struc.id === "crural_region_left") {
        const sideKey = struc.id === "crural_region_right" ? "derech" : "izquierd";
        if (impressionText.includes("crural") || impressionText.includes("femoral")) {
          if (impressionText.includes(`crural ${sideKey}`) || impressionText.includes(`femoral ${sideKey}`) || impressionText.includes(`crurales`) || impressionText.includes("bilateral")) {
            if (impressionText.includes("hernia")) {
              detectedState = "Hernia crural / femoral";
              desc = `Presencia de hernia en la región crural / femoral ${sideKey === "derech" ? "derecha" : "izquierda"}.`;
            } else {
              detectedState = "Normal";
              desc = "Dentro de límites normales.";
            }
          }
        }
      }

      nextStates[struc.id] = detectedState;
      nextDescriptions[struc.id] = desc;
    });

    setStates(nextStates);
    setCustomDescriptions(nextDescriptions);
    return { nextStates, nextDescriptions };
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
    logs.push(`🔍 IA analizando exclusivamente la sección de Impresión Diagnóstica para Pared Abdominal...`);

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Pared Abdominal",
          structures: ABDOMINAL_WALL_STRUCTURES.map(s => ({ ...s, label: s.name }))
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;
        
        const finalStates = { ...states };
        const finalDescriptions = { ...customDescriptions };

        ABDOMINAL_WALL_STRUCTURES.forEach(struc => {
          const apiState = data.states[struc.id] || "no_descrito";
          const apiDesc = data.descriptions[struc.id] || "No mencionado / No descrito.";

          finalStates[struc.id] = apiState;
          finalDescriptions[struc.id] = apiDesc;
          parsedCount++;

          if (apiState !== "normal" && apiState !== "no_descrito") {
            foundPathologies++;
          }
          logs.push(`[Inteligente] ${struc.name}: ${apiState.toUpperCase()} - "${apiDesc}"`);
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setSyncLogs(prev => [...prev, ...logs, `✔ Sincronización finalizada con éxito. Se analizaron ${parsedCount} estructuras de la pared abdominal, identificando ${foundPathologies} hallazgos patológicos desde la Conclusión.`]);
        setLastSyncedReport(generatedReport);
      } else {
        logs.push("No se pudo parsear correctamente el resultado de la API. Aplicando reglas de respaldo...");
        runLocalHeuristics(logs);
        setSyncLogs(prev => [...prev, ...logs]);
      }
    } catch (error) {
      console.error("Error en extracción inteligente:", error);
      logs.push("Fallo de red al conectar con el servidor. Saliendo con heurísticas locales de respaldo...");
      runLocalHeuristics(logs);
      setSyncLogs(prev => [...prev, ...logs]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => ({ ...prev, [id]: s }));
    
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No mencionado / No descrito." }));
    } else if (s === "normal" || s === "Normal") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "Dentro de límites normales." }));
    } else {
      // Default placeholder based on name
      const struct = ABDOMINAL_WALL_STRUCTURES.find(item => item.id === id);
      setCustomDescriptions(prev => ({ ...prev, [id]: `${s} identificado en la región correspondiente.` }));
    }
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  // Manual trigger to export table so it is NEVER injected automatically
  const handleInsertTableManually = () => {
    let md = `\n### ANEXO: ESQUEMA DE HALLAZGOS - ULTRASONIDO DE PARED ABDOMINAL\n\n`;
    md += `| Estructura anatómica | Hallazgo |\n`;
    md += `| :--- | :--- |\n`;

    let hasRows = false;
    ABDOMINAL_WALL_STRUCTURES.forEach(item => {
      const s = states[item.id];
      if (s !== "no_descrito" && s !== "normal" && s !== "Normal") {
        const desc = customDescriptions[item.id]?.trim() || "Presencia de alteración estructural descrita.";
        md += `| **${item.name}** | **${s}**: ${desc} |\n`;
        hasRows = true;
      } else if (s === "normal" || s === "Normal") {
        md += `| **${item.name}** | **Normal**: Sin alteraciones de espesor o ecogenicidad. |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Pared Abdominal* | *Normal*: Sin defectos aponeuróticos, hernias, diástasis o colecciones musculares identificables en el examen esquemático. |\n`;
    }

    onExportTable(md);
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
    // Highlighting pathological findings
    return {
      fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
      stroke: "#f59e0b"
    };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let notInReport = 0;

    ABDOMINAL_WALL_STRUCTURES.forEach(struc => {
      const st = states[struc.id];
      if (st === "no_descrito") notInReport++;
      else if (st === "normal" || st === "Normal") normalCount++;
      else pathological++;
    });

    return { pathological, normalCount, notInReport };
  };

  const currentDetails = ABDOMINAL_WALL_STRUCTURES.find(s => s.id === selectedStructure);
  const { pathological, normalCount, notInReport } = getBadgesCount();

  return (
    <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl space-y-6">
      
      {/* HEADER CONTROLLER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-md bg-rose-900/40 text-rose-400 font-mono text-[9px] font-black uppercase tracking-wider">
              Protocolo Manual
            </span>
            <h3 className="text-sm font-black text-white hover:text-rose-400 transition-colors uppercase tracking-widest font-mono">
              Esquema de Pared Abdominal (US)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1 max-w-xl">
            Herramienta interactiva para mapear defectos fasciales, diástasis y hernias. Los hallazgos se cargan de la <strong>impresión diagnóstica</strong> de forma enteramente manual.
          </p>
        </div>

        {/* INDICADORES CLÍNICOS RÁPIDOS */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950/80 border border-slate-850 px-3 py-1.5 rounded-xl text-center select-none">
            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">PATOLOGÍAS</span>
            <span className="text-xs font-black text-amber-500 font-mono">{pathological}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-850 px-3 py-1.5 rounded-xl text-center select-none">
            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">SANO</span>
            <span className="text-xs font-black text-emerald-400 font-mono">{normalCount}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-850 px-3 py-1.5 rounded-xl text-center select-none">
            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">NO DSC</span>
            <span className="text-xs font-black text-slate-400 font-mono">{notInReport}</span>
          </div>
        </div>
      </div>

      {/* NO AUTO-INJECTION WARNING AND MANUAL COMPILE BUTTON */}
      <div className="bg-slate-950/90 border border-slate-900 p-4 rounded-2xl flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="space-y-1.5">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" /> Sincronización Estructural
          </h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-xl">
            Sincroniza el mapa anatómico con los diagnósticos de tu sección de conclusiones o <strong>Impresión Diagnóstica</strong>.
            <span className="text-[10px] text-rose-400 block font-bold mt-1">⚠️ Sincronizar actualizará los hallazgos gráficos para el PDF descargado. Puedes usar "Insertar Tabla" para colocar el desglose escrito en tu reporte en pantalla.</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing || !generatedReport}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-97 border ${
              syncAvailable 
                ? "bg-rose-600/20 text-rose-300 border-rose-600 hover:bg-rose-600/35" 
                : "bg-slate-900 text-slate-350 border-slate-800 hover:bg-slate-850 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                <span>Sincronizar de Conclusión</span>
              </>
            )}
          </button>

          <button
            onClick={handleInsertTableManually}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border border-indigo-500 active:scale-97 cursor-pointer transition-all shadow-[0_2px_8px_rgba(99,102,241,0.2)]"
          >
            <CheckCircle className="w-3 h-3" />
            <span>Insertar Tabla</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* INTERACTIVE RADIOLOGY DRAWING */}
        <div className="lg:col-span-5 bg-slate-950 rounded-2xl border border-slate-900 p-4 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-900/95 border border-slate-850 px-2.5 py-1 rounded-lg text-[9px] font-mono text-slate-400 font-bold uppercase select-none">
            <Layers className="w-3 h-3 text-indigo-400" />
            <span>Mapa Musculoaponeurótico (Pared Anterior)</span>
          </div>

          {/* SVG Map of Abdominal Wall */}
          <svg id="abdominal-wall-anatomy-svg" viewBox="0 0 400 420" className="w-full max-w-[280px] h-auto drop-shadow-2xl select-none mt-6">
            <defs>
              <linearGradient id="gradient_muscles" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b4f6e" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>

            {/* Base body shape contour (silhuette) */}
            <path 
              d="M100,50 Q200,45 300,50 Q310,180 290,290 Q270,370 200,390 Q130,370 110,290 Q90,180 100,50 Z" 
              fill="#060913" 
              stroke="#1e293b" 
              strokeWidth="2" 
            />

            {/* Ribcage arcs (top borders) */}
            <path d="M 120 55 Q 160 85 200 85 Q 240 85 280 55" fill="none" stroke="#2a3547" strokeWidth="3" opacity="0.6" strokeDasharray="3,3" />

            {/* 1. Músculos Oblicuos / Anchos Derechos (viewer left) */}
            <g 
              id="oblique_muscles_right"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("oblique_muscles_right")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("oblique_muscles_right")}
            >
              <path 
                d="M110,75 C105,140 105,210 120,270 L145,260 C135,210 135,140 150,75 Z"
                fill={getColorForSVG("oblique_muscles_right").fill}
                stroke={getColorForSVG("oblique_muscles_right").stroke}
                strokeWidth={selectedStructure === "oblique_muscles_right" ? "3.5" : "1.5"}
              />
              {/* Muscle fibers pattern */}
              <path d="M115,100 L145,90 M113,140 L143,130 M111,180 L141,170 M113,220 L143,210" fill="none" stroke="#ffffff" opacity="0.25" strokeWidth="1.5" />
            </g>

            {/* 2. Músculos Oblicuos / Anchos Izquierdos (viewer right) */}
            <g 
              id="oblique_muscles_left"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("oblique_muscles_left")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("oblique_muscles_left")}
            >
              <path 
                d="M290,75 C295,140 295,210 280,270 L255,260 C265,210 265,140 250,75 Z"
                fill={getColorForSVG("oblique_muscles_left").fill}
                stroke={getColorForSVG("oblique_muscles_left").stroke}
                strokeWidth={selectedStructure === "oblique_muscles_left" ? "3.5" : "1.5"}
              />
              {/* Muscle fibers pattern */}
              <path d="M285,100 L255,90 M287,140 L257,130 M289,180 L259,170 M287,220 L257,210" fill="none" stroke="#ffffff" opacity="0.25" strokeWidth="1.5" />
            </g>

            {/* 3. Músculo Recto Anterior Derecho (viewer left) */}
            <g 
              id="rectus_abdominis_right"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("rectus_abdominis_right")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("rectus_abdominis_right")}
            >
              {/* Upper segments */}
              <path 
                d="M152,75 Q172,75 192,75 L192,120 Q172,120 152,120 Z" 
                fill={getColorForSVG("rectus_abdominis_right").fill} 
                stroke={getColorForSVG("rectus_abdominis_right").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_right" ? "2.5" : "1.2"} 
              />
              <path 
                d="M152,123 Q172,123 192,123 L192,175 Q172,175 152,175 Z" 
                fill={getColorForSVG("rectus_abdominis_right").fill} 
                stroke={getColorForSVG("rectus_abdominis_right").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_right" ? "2.5" : "1.2"} 
              />
              <path 
                d="M152,178 Q172,178 192,178 L192,230 Q172,230 152,230 Z" 
                fill={getColorForSVG("rectus_abdominis_right").fill} 
                stroke={getColorForSVG("rectus_abdominis_right").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_right" ? "2.5" : "1.2"} 
              />
              <path 
                d="M152,233 Q172,233 192,233 L190,285 Q170,285 152,285 Z" 
                fill={getColorForSVG("rectus_abdominis_right").fill} 
                stroke={getColorForSVG("rectus_abdominis_right").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_right" ? "2.5" : "1.2"} 
              />
            </g>

            {/* 4. Músculo Recto Anterior Izquierdo (viewer right) */}
            <g 
              id="rectus_abdominis_left"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("rectus_abdominis_left")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("rectus_abdominis_left")}
            >
              {/* Upper segments */}
              <path 
                d="M208,75 Q228,75 248,75 L248,120 Q228,120 208,120 Z" 
                fill={getColorForSVG("rectus_abdominis_left").fill} 
                stroke={getColorForSVG("rectus_abdominis_left").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_left" ? "2.5" : "1.2"} 
              />
              <path 
                d="M208,123 Q228,123 248,123 L248,175 Q228,175 208,175 Z" 
                fill={getColorForSVG("rectus_abdominis_left").fill} 
                stroke={getColorForSVG("rectus_abdominis_left").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_left" ? "2.5" : "1.2"} 
              />
              <path 
                d="M208,178 Q228,178 248,178 L248,230 Q228,230 208,230 Z" 
                fill={getColorForSVG("rectus_abdominis_left").fill} 
                stroke={getColorForSVG("rectus_abdominis_left").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_left" ? "2.5" : "1.2"} 
              />
              <path 
                d="M208,233 Q228,233 248,233 L248,285 Q228,285 208,285 Z" 
                fill={getColorForSVG("rectus_abdominis_left").fill} 
                stroke={getColorForSVG("rectus_abdominis_left").stroke} 
                strokeWidth={selectedStructure === "rectus_abdominis_left" ? "2.5" : "1.2"} 
              />
            </g>

            {/* 5. Línea Alba */}
            <g 
              id="linea_alba"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("linea_alba")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("linea_alba")}
            >
              <rect 
                x="194" 
                y="65" 
                width="12" 
                height="225" 
                rx="6"
                fill={getColorForSVG("linea_alba").fill}
                stroke={getColorForSVG("linea_alba").stroke}
                strokeWidth={selectedStructure === "linea_alba" ? "3" : "1.5"}
              />
              {/* Fibrous structure lines */}
              <path d="M 200 70 L 200 280" fill="none" stroke="#ffffff" strokeDasharray="2,3" opacity="0.6" strokeWidth="2" />
            </g>

            {/* 6. Región Umbilical (central) */}
            <g 
              id="umbilical_region"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("umbilical_region")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("umbilical_region")}
            >
              <circle 
                cx="200" 
                cy="180" 
                r="18" 
                fill={getColorForSVG("umbilical_region").fill}
                stroke={getColorForSVG("umbilical_region").stroke}
                strokeWidth={selectedStructure === "umbilical_region" ? "3.5" : "1.5"}
              />
              <circle cx="200" cy="180" r="8" fill="none" stroke="#ffffff" opacity="0.45" strokeWidth="2" />
              <circle cx="200" cy="180" r="3" fill="#ffffff" opacity="0.75" />
            </g>

            {/* 7. Región Epigástrica (above umbilical) */}
            <g 
              id="epigastric_region"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("epigastric_region")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("epigastric_region")}
            >
              <ellipse 
                cx="200" 
                cy="110" 
                rx="24" 
                ry="14" 
                fill={getColorForSVG("epigastric_region").fill}
                stroke={getColorForSVG("epigastric_region").stroke}
                strokeWidth={selectedStructure === "epigastric_region" ? "3.5" : "1.5"}
              />
              <text x="200" y="113" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold" opacity="0.65" pointerEvents="none">EPI</text>
            </g>

            {/* Pelvic base visual skeleton */}
            <path d="M 120 285 L 150 295 L 200 300 L 250 295 L 280 285" fill="none" stroke="#253545" strokeWidth="3" opacity="0.4" />

            {/* 8. Región Inguinal Derecha (lower, viewer's left) */}
            <g 
              id="inguinal_region_right"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("inguinal_region_right")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("inguinal_region_right")}
            >
              <path 
                d="M 120,290 L 175,320 L 165,335 L 110,305 Z"
                fill={getColorForSVG("inguinal_region_right").fill}
                stroke={getColorForSVG("inguinal_region_right").stroke}
                strokeWidth={selectedStructure === "inguinal_region_right" ? "3.5" : "1.5"}
              />
              <text x="145" y="315" fill="#ffffff" fontSize="7" fontWeight="bold" opacity="0.65" transform="rotate(22, 145, 315)" pointerEvents="none">ING_D</text>
            </g>

            {/* 9. Región Inguinal Izquierda (lower, viewer's right) */}
            <g 
              id="inguinal_region_left"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("inguinal_region_left")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("inguinal_region_left")}
            >
              <path 
                d="M 280,290 L 225,320 L 235,335 L 290,305 Z"
                fill={getColorForSVG("inguinal_region_left").fill}
                stroke={getColorForSVG("inguinal_region_left").stroke}
                strokeWidth={selectedStructure === "inguinal_region_left" ? "3.5" : "1.5"}
              />
              <text x="255" y="315" fill="#ffffff" fontSize="7" fontWeight="bold" opacity="0.65" transform="rotate(-22, 255, 315)" pointerEvents="none">ING_I</text>
            </g>

            {/* 10. Región Crural Derecha (viewer's left side lower) */}
            <g 
              id="crural_region_right"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("crural_region_right")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("crural_region_right")}
            >
              <ellipse 
                cx="150" 
                cy="355" 
                rx="20" 
                ry="10"
                fill={getColorForSVG("crural_region_right").fill}
                stroke={getColorForSVG("crural_region_right").stroke}
                strokeWidth={selectedStructure === "crural_region_right" ? "3" : "1.2"}
              />
              <text x="150" y="358" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="black" opacity="0.65" pointerEvents="none">CRU_D</text>
            </g>

            {/* 11. Región Crural Izquierda (viewer's right side lower) */}
            <g 
              id="crural_region_left"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveHover("crural_region_left")}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => setSelectedStructure("crural_region_left")}
            >
              <ellipse 
                cx="250" 
                cy="355" 
                rx="20" 
                ry="10"
                fill={getColorForSVG("crural_region_left").fill}
                stroke={getColorForSVG("crural_region_left").stroke}
                strokeWidth={selectedStructure === "crural_region_left" ? "3" : "1.2"}
              />
              <text x="250" y="358" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="black" opacity="0.65" pointerEvents="none">CRU_I</text>
            </g>
          </svg>

          {/* Quick labels guide footer */}
          <div className="w-full mt-4 border-t border-slate-900 pt-3 flex flex-wrap justify-between items-center text-[10px] text-slate-400 font-mono gap-1 select-none">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-emerald-500 bg-emerald-500/20" /> Normal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-amber-500 bg-amber-500/20" /> Con Hallazgo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-600 bg-slate-800" /> No descrito
            </span>
          </div>
        </div>

        {/* DETAILED CONTROLLER PANE */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-900 p-5 space-y-5">
          <div className="border-b border-slate-900 pb-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5 p-1 rounded-lg">
              <Check className="w-4 h-4 text-rose-500" />
              <span>Diagnóstico Detallado por Estructura</span>
            </h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
              Seleccione una estructura del dibujo o de la lista para editar su estado conclusiones
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* QUICK STRUCTURE LIST */}
            <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
              {ABDOMINAL_WALL_STRUCTURES.map(item => {
                const s = states[item.id] || "no_descrito";
                const isSelected = selectedStructure === item.id;
                
                let stateLabel = s;
                let badgeClass = "bg-slate-900 text-slate-400 border-slate-850";
                
                if (s === "no_descrito") {
                  stateLabel = "No Descrito";
                } else if (s === "normal" || s === "Normal") {
                  stateLabel = "Normal";
                  badgeClass = "bg-emerald-950/70 text-emerald-400 border-emerald-500/30";
                } else {
                  badgeClass = "bg-amber-950/70 text-amber-300 border-amber-500/30 font-black";
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedStructure(item.id)}
                    onMouseEnter={() => setActiveHover(item.id)}
                    onMouseLeave={() => setActiveHover(null)}
                    className={`w-full text-left p-2.5 rounded-xl border flex justify-between items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-slate-750 shadow-inner translate-x-1"
                        : "bg-slate-950 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-850"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-200 truncate">{item.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md border uppercase truncate max-w-[120px] font-mono ${badgeClass}`}>
                      {stateLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SELECTION DETAIL MODULE */}
            <div className="bg-slate-900/60 border border-slate-900 p-4 rounded-xl space-y-4">
              {currentDetails ? (
                <>
                  <div>
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest font-mono">
                      ESTRUCTURA SELECCIONADA
                    </span>
                    <h5 className="text-xs font-black text-white uppercase tracking-wide mt-0.5">
                      {currentDetails.name}
                    </h5>
                  </div>

                  {/* CUSTOM DIAGNOSTIC STATE INTAKE */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">
                      Diagnóstico de Conclusión (Estado)
                    </label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text"
                        value={states[selectedStructure] === "no_descrito" ? "" : states[selectedStructure]}
                        onChange={(e) => handleStateChange(selectedStructure, e.target.value || "no_descrito")}
                        placeholder="Ej: Hernia umbilical, Diástasis, Normal, etc."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                      
                      {/* FAST TOGGLES */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleStateChange(selectedStructure, "Normal")}
                          className={`px-2 py-1 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                            states[selectedStructure] === "Normal" || states[selectedStructure] === "normal"
                              ? "bg-emerald-900/60 text-emerald-400 border border-emerald-500/40"
                              : "bg-slate-950 text-slate-450 hover:text-white border border-slate-850"
                          }`}
                        >
                          ✓ Marcar Sano (Normal)
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                          className={`px-2 py-1 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                            states[selectedStructure] === "no_descrito"
                              ? "bg-slate-800 text-slate-300 border border-slate-700"
                              : "bg-slate-950 text-slate-450 hover:text-white border border-slate-850"
                          }`}
                        >
                          👁️ Omitir (No Descrito)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CUSTOM DESCRIPTION FIELD */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">
                      Descripción de Sinopsis (Línea del cuadro)
                    </label>
                    <textarea
                      value={customDescriptions[selectedStructure] || ""}
                      onChange={(e) => handleDescriptionChange(selectedStructure, e.target.value)}
                      placeholder="Micro-resumen del hallazgo para el paciente y reporte..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium leading-relaxed resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
                  <Activity className="w-8 h-8 text-slate-700 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Ninguna estructura activa
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* SYNC CONTEXT LOGS */}
      {syncLogs.length > 0 && (
        <div className="no-print bg-slate-950 border border-slate-900 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Bitácora de Sincronización Ecográfica de Pared Abdominal
            </span>
            <button
              onClick={() => setSyncLogs([])}
              className="text-[9px] text-slate-500 hover:text-slate-300 uppercase underline cursor-pointer"
            >
              Limpiar Logs
            </button>
          </div>
          <div className="max-h-[100px] overflow-y-auto space-y-1 font-mono text-[9px] text-slate-400 pr-1 leading-relaxed">
            {syncLogs.map((log, i) => (
              <div key={i} className="border-b border-slate-950/50 pb-1 last:border-0">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
