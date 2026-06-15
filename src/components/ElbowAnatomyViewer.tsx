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

interface ElbowAnatomyViewerProps {
  selectedModel?: string;
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
}

// Structure identifier of the elbow
interface ElbowStructure {
  id: string;
  name: string;
  aspect: "lateral" | "medial";
  description: string;
}

const ELBOW_STRUCTURES: ElbowStructure[] = [
  { id: "common_extensor", name: "Tendón Extensor Común", aspect: "lateral", description: "Inserción en el epicóndilo lateral. Sitio de epicondilitis (codo de tenista)." },
  { id: "radial_collateral", name: "Ligamento Colateral Radial", aspect: "lateral", description: "Estabilizador primario de la articulación lateral del codo." },
  { id: "humeroradial_joint", name: "Articulación Humerorradial", aspect: "lateral", description: "Derrame articular lateral o cambios artrósicos en interlínea." },
  { id: "common_flexor", name: "Tendón Flexor Común", aspect: "medial", description: "Inserción en el epicóndilo medial (epitróclea). Sitio de epitrocleitis (codo de golfista)." },
  { id: "ulnar_collateral", name: "Ligamento Colateral Cubital", aspect: "medial", description: "Estabilizador primario medial (frecuente en lanzadores)." },
  { id: "ulnar_nerve", name: "Nervio Cubital", aspect: "medial", description: "Canal epitrócleo-olecraniano. Neuritis o subluxaciones dinámicas." }
];

export default function ElbowAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions
}: ElbowAnatomyViewerProps) {
  
  // States of each structure:
  // - common_extensor: no_descrito | normal | epicondilitis | desgarro_parcial | desgarro_completo
  // - radial_collateral: no_descrito | normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - humeroradial_joint: no_descrito | normal | derrame_leve | derrame_moderado
  // - common_flexor: no_descrito | normal | epitrocleitis | desgarro_parcial | desgarro_completo
  // - ulnar_collateral: no_descrito | normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - ulnar_nerve: no_descrito | normal | neuritis | subluxacion
  const [states, setStates] = useState<Record<string, string>>({
    common_extensor: "no_descrito",
    radial_collateral: "no_descrito",
    humeroradial_joint: "no_descrito",
    common_flexor: "no_descrito",
    ulnar_collateral: "no_descrito",
    ulnar_nerve: "no_descrito"
  });

  // Custom text translations/synopses
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    common_extensor: "",
    radial_collateral: "",
    humeroradial_joint: "",
    common_flexor: "",
    ulnar_collateral: "",
    ulnar_nerve: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("common_extensor");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);
  const [subViewMode, setSubViewMode] = useState<"lateral" | "medial" | "dual">("dual");

  // Synchronize states to parent if callbacks are provided
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

  // Unified keywords to scan report text
  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "common_extensor":
        return [
          "extensor comun", "extensor común", "tendón extensor común", 
          "tendon extensor comun", "epicondilo lateral", "epicóndilo lateral", 
          "epicondilitis lateral", "epicondilitis", "codo de tenista"
        ];
      case "radial_collateral":
        return [
          "colateral radial", "ligamento colateral radial", "lcr", 
          "ligamento lateral externo"
        ];
      case "humeroradial_joint":
        return [
          "humerorradial", "húmerorradial", "articulacion humerorradial", 
          "articulación humerorradial", "derrame lateral", "sinovitis lateral", 
          "receso humerorradial", "derrame humerorradial"
        ];
      case "common_flexor":
        return [
          "flexor comun", "flexor común", "tendón flexor común", 
          "tendon flexor comun", "epicondilo medial", "epicóndilo medial", 
          "epitroclea", "epitróclea", "epitrocleitis", "epicondilitis medial", 
          "codo de golfista"
        ];
      case "ulnar_collateral":
        return [
          "colateral cubital", "ligamento colateral cubital", "lcc", 
          "colateral ulnar", "ligamento colateral ulnar", "lcu"
        ];
      case "ulnar_nerve":
        return [
          "nervio cubital", "nervio ulnar", "tunel cubital", "túnel cubital", 
          "canal epitrocleo-olecraniano", "canal epitrócleo-olecraniano", 
          "atrapamiento cubital", "neuritis cubital"
        ];
      default:
        return [];
    }
  };

  // State scanner
  const parseStateFromText = (id: string, text: string): string => {
    if (!text) return "no_descrito";
    
    // Normalize accent marks for search accuracy
    const lower = text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    
    const hasPathology = (keywords: string[]): boolean => {
      for (const kw of keywords) {
        const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let index = lower.indexOf(normalizedKw);
        while (index !== -1) {
          const priorText = lower.substring(0, index);
          const lastBoundary = Math.max(
            priorText.lastIndexOf("."),
            priorText.lastIndexOf(";"),
            priorText.lastIndexOf(":"),
            priorText.lastIndexOf("-"),
            priorText.lastIndexOf("•"),
            priorText.lastIndexOf("\n")
          );
          const precedingText = lastBoundary !== -1
            ? priorText.substring(lastBoundary + 1)
            : priorText;
          
          const postText = lower.substring(index + normalizedKw.length);
          const nextBoundaryIndex = [
            postText.indexOf("."),
            postText.indexOf(";"),
            postText.indexOf(":"),
            postText.indexOf("-"),
            postText.indexOf("•"),
            postText.indexOf("\n")
          ].filter(b => b !== -1);
          const nextBoundary = nextBoundaryIndex.length > 0
            ? Math.min(...nextBoundaryIndex)
            : postText.length;
          const succeedingText = postText.substring(0, nextBoundary);
          
          const negations = [
            "sin", "no se", "no hay", "no presenta", "ausencia de", 
            "descart", "libre de", "negativo", "no evidencia", 
            "sin evidencia", "no se evidencia", "sin signos", "no presenta signos", 
            "no se observa", "no se observan", "no se aprecian", "no se aprecia", 
            "no muestra", "sano sin", "normal sin", "integro sin", "íntegro sin", 
            "conservado sin", "desestim", "excluye", "no se detecta", "no se detectan", 
            "no se identifica", "no se identifican", "no se visualiza", "no se visualizan", 
            "normales sin", "descartar"
          ];
          
          let isNegated = negations.some(neg => {
            const negIdx = precedingText.lastIndexOf(neg);
            if (negIdx !== -1) {
              const inBetween = precedingText.substring(negIdx + neg.length);
              const contrastWords = ["pero", "asociado", " con ", " y presenta", " e presenta", " con presencia", "observa", "aprecia"];
              if (contrastWords.some(cw => inBetween.includes(cw))) {
                return false;
              }
              return true;
            }
            return false;
          });
          
          if (!isNegated) {
            return true;
          }
          index = lower.indexOf(normalizedKw, index + 1);
        }
      }
      return false;
    };

    switch (id) {
      case "common_extensor":
      case "common_flexor": {
        const completeTearKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "desgarro total", "ruptura total", "rotura total", "espesor completo", 
          "desinsercion completa", "desinserción completa"
        ];
        const partialTearKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "espesor parcial", "discontinuidad parcial", "microdesgarro", 
          "desgarro de fibras", "defecto fibrilar"
        ];
        const tendinopathyKws = [
          "epicondilitis", "epitrocleitis", "tendinosis", "tendinopatia", 
          "tendinitis", "engrosado", "hipoecoic", "edema", "anisotropia", 
          "epicondilalgia", "epitroclealgia", "codo de tenista", "codo de golfista"
        ];
        
        const testKws = getStructureKeywords(id);
        if (!hasPathology(testKws)) return "no_descrito";
        
        // Scan sentence specific blocks
        const segment = lower;
        if (completeTearKws.some(kw => segment.includes(kw))) return "desgarro_completo";
        if (partialTearKws.some(kw => segment.includes(kw))) return "desgarro_parcial";
        
        // We look up standard tendinosis / epicondylitis / epitrochleitis
        if (id === "common_extensor" && (segment.includes("epicondilitis") || tendinopathyKws.some(kw => segment.includes(kw)))) {
          return "epicondilitis";
        }
        if (id === "common_flexor" && (segment.includes("epitrocleitis") || tendinopathyKws.some(kw => segment.includes(kw)))) {
          return "epitrocleitis";
        }
        
        return "normal";
      }
      
      case "radial_collateral":
      case "ulnar_collateral": {
        const completeTearKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "desgarro total", "ruptura total", "rotura total", "discontinuidad completa"
        ];
        const partialTearKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "espesor parcial", "discontinuidad parcial", "desgarro"
        ];
        const sprainKws = [
          "esguince", "engrosamiento", "engrosado", "distendido", 
          "laxitud", "inflama", "hipoecogen"
        ];
        
        const testKws = getStructureKeywords(id);
        if (!hasPathology(testKws)) return "no_descrito";
        
        if (completeTearKws.some(kw => lower.includes(kw))) return "desgarro_completo";
        if (partialTearKws.some(kw => lower.includes(kw))) return "desgarro_parcial";
        if (sprainKws.some(kw => lower.includes(kw))) return "esguince_leve";
        
        return "normal";
      }
      
      case "humeroradial_joint": {
        const moderateKws = [
          "derrame articulación", "derrame de codo", "sinovitis significativa", 
          "sinovitis moderada", "liquido moderado", "líquido moderado", 
          "derrame moderado", "derrame articular moderado", "abundante liquido"
        ];
        const mildKws = [
          "derrame", "liquido", "líquido", "sinovitis", "hidrartrosis", 
          "receso articular", "sinovial", "derrame leve", "liquido leve"
        ];
        
        const testKws = getStructureKeywords(id);
        if (!hasPathology(testKws)) return "no_descrito";
        
        if (moderateKws.some(kw => lower.includes(kw))) return "derrame_moderado";
        if (mildKws.some(kw => lower.includes(kw))) return "derrame_leve";
        
        return "normal";
      }
      
      case "ulnar_nerve": {
        const subluxationKws = [
          "subluxacion", "subluxación", "luxacion", "luxación", 
          "desplazamiento dinamico", "inestable", "luxa", "subluxa"
        ];
        const neuritisKws = [
          "neuritis", "neurodocitis", "engrosado", "engrosamiento", 
          "hiperemico", "atrapamiento", "compresion", "compresión"
        ];
        
        const testKws = getStructureKeywords(id);
        if (!hasPathology(testKws)) return "no_descrito";
        
        if (subluxationKws.some(kw => lower.includes(kw))) return "subluxacion";
        if (neuritisKws.some(kw => lower.includes(kw))) return "neuritis";
        
        return "normal";
      }
      
      default:
        return "no_descrito";
    }
  };

  const syncStatesFromReport = async () => {
    if (!generatedReport) {
      return;
    }

    setIsSyncing(true);
    setSyncLogs([]);
    const logs: string[] = [];
    logs.push("🔍 Analizando reporte de US de Codo para sinopsis...");

    const structures = [
      {
        id: "common_extensor",
        label: "Tendón Extensor Común",
        allowedStates: ["no_descrito", "normal", "epicondilitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "radial_collateral",
        label: "Ligamento Colateral Radial",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "humeroradial_joint",
        label: "Articulación Humerorradial",
        allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"]
      },
      {
        id: "common_flexor",
        label: "Tendón Flexor Común",
        allowedStates: ["no_descrito", "normal", "epitrocleitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "ulnar_collateral",
        label: "Ligamento Colateral Cubital",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "ulnar_nerve",
        label: "Nervio Cubital",
        allowedStates: ["no_descrito", "normal", "neuritis", "subluxacion"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Codo",
          structures: structures
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;
        
        const finalStates = { ...states };
        const finalDescriptions = { ...customDescriptions };

        structures.forEach(struc => {
          const apiState = data.states[struc.id] || "no_descrito";
          const apiDesc = data.descriptions[struc.id] || "No mencionado / No descrito.";

          finalStates[struc.id] = apiState;
          finalDescriptions[struc.id] = apiDesc;

          parsedCount++;
          if (apiState !== "normal" && apiState !== "no_descrito") {
            foundPathologies++;
          }
          if (apiState !== "no_descrito") {
            logs.push(`[Hallazgo] ${struc.label}: ${apiState.toUpperCase().replaceAll("_", " ")} \n  ↳ ${apiDesc}`);
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con IA. Sincronizadas ${parsedCount} estructuras de Codo con alta fidelidad clínica (${foundPathologies} patologías detectadas).`);
      } else {
        logs.push(`[Error API] No se pudo obtener el análisis estructurado.`);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía de codo:", err);
      logs.push(`[Error de red] ${err.message || String(err)}.`);
    } finally {
      setIsSyncing(false);
      setSyncLogs(logs);
    }
  };

  // Perform sync at load or when report text changes significantly
  useEffect(() => {
    // Disabled auto-sync on mount/report changes to save tokens as requested.
    // Sync will only occur manually when requested by user.
  }, [generatedReport]);

  const handleUpdateStructureState = (id: string, newState: string) => {
    setStates(prev => {
      const next = { ...prev, [id]: newState };
      return next;
    });

    setCustomDescriptions(prev => {
      const next = { ...prev };
      if (newState === "no_descrito") {
        next[id] = "";
      } else if (newState === "normal") {
        next[id] = "Dentro de límites normales.";
      } else {
        // set recommended text
        let recommended = "";
        switch (id) {
          case "common_extensor":
            if (newState === "epicondilitis") recommended = "Signos ecográficos de epicondilitis lateral (codo de tenista).";
            if (newState === "desgarro_parcial") recommended = "Desgarro parcial intrasustancia del tendón extensor común.";
            if (newState === "desgarro_completo") recommended = "Ruptura y desgarro de espesor completo del extensor común.";
            break;
          case "common_flexor":
            if (newState === "epitrocleitis") recommended = "Patrón reactivo de epitrocleitis o epicondilitis medial.";
            if (newState === "desgarro_parcial") recommended = "Solución de continuidad parcial del tendón flexor común.";
            if (newState === "desgarro_completo") recommended = "Ruptura de espesor total de las fibras flexoras comunes mediales.";
            break;
          case "radial_collateral":
            if (newState === "esguince_leve") recommended = "Esguince de colateral radial con laxitud e hipoecogenicidad.";
            if (newState === "desgarro_parcial") recommended = "Desgarro de fibras del ligamento colateral radial sin compromiso total.";
            if (newState === "desgarro_completo") recommended = "Desgarro completo de la banda del ligamento colateral radial.";
            break;
          case "ulnar_collateral":
            if (newState === "esguince_leve") recommended = "Esguince con distensión focal del ligamento colateral cubital.";
            if (newState === "desgarro_parcial") recommended = "Desgarro parcial de la banda anterior del ligamento colateral cubital.";
            if (newState === "desgarro_completo") recommended = "Desgarro completo de la banda anterior del ligamento colateral cubital.";
            break;
          case "humeroradial_joint":
            if (newState === "derrame_leve") recommended = "Leve distensión de receso humerorradial.";
            if (newState === "derrame_moderado") recommended = "Derrame articular con volumen sinovial moderadamente distendido.";
            break;
          case "ulnar_nerve":
            if (newState === "neuritis") recommended = "Cambios ecográficos de neuritis del nervio cubital por edema intraneural.";
            if (newState === "subluxacion") recommended = "Inestabilidad dinámica con subluxación del nervio cubital en flexión codo.";
            break;
        }
        next[id] = recommended;
      }
      return next;
    });
  };

  const handleCustomDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({
      ...prev,
      [id]: text
    }));
  };

  // Helper colors for SVG paths based on clinical states
  const getColorForSVG = (id: string): { fill: string; stroke: string } => {
    const s = states[id];
    const isHovered = activeHover === id || selectedStructure === id;

    if (s === "no_descrito") {
      return {
        fill: isHovered ? "rgba(71, 85, 105, 0.25)" : "transparent",
        stroke: isHovered ? "#64748b" : "transparent"
      };
    }
    if (s === "normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.12)",
        stroke: "#10b981"
      };
    }
    if (s === "desgarro_completo") {
      return {
        fill: isHovered ? "rgba(239, 68, 68, 0.45)" : "rgba(239, 68, 68, 0.25)",
        stroke: "#ef4444"
      };
    }
    // Pathological cases (esguince, epicondilitis, epitrocleitis, desgarro parcial, neuritis, subluxacion)
    return {
      fill: isHovered ? "rgba(245, 158, 11, 0.45)" : "rgba(245, 158, 11, 0.22)",
      stroke: "#f59e0b"
    };
  };

  // Export clinical findings block
  const handleExportClick = () => {
    let cleanTable = `\n| ESTRUCTURA / ELEMENTO | ESTADO CLÍNICO | SINOPSIS ECOGRÁFICA Y OBSERVACIONES |\n| :--- | :--- | :--- |\n`;
    
    let hasEntries = false;
    ELBOW_STRUCTURES.forEach(struc => {
      const s = states[struc.id];
      if (s !== "no_descrito") {
        hasEntries = true;
        const stateLabel = s.toUpperCase().replaceAll("_", " ");
        const desc = customDescriptions[struc.id] || "Dentro de límites normales.";
        cleanTable += `| **${struc.name}** | \`${stateLabel}\` | ${desc} |\n`;
      }
    });

    if (!hasEntries) {
      cleanTable = "\n*(No se han seleccionado ni detectado estructuras para el mapa sinóptico de codo)*\n";
    }

    onExportTable(cleanTable);
  };

  const getClinicalBadgeClass = (s: string) => {
    switch (s) {
      case "no_descrito":
        return "bg-slate-950/65 border-slate-800 text-slate-500";
      case "normal":
        return "bg-emerald-950/30 border-emerald-900/60 text-emerald-400";
      case "desgarro_completo":
        return "bg-red-950/30 border-red-900/60 text-red-400";
      default:
        return "bg-amber-950/30 border-amber-900/40 text-amber-400";
    }
  };

  const getClinicalStateText = (s: string) => {
    if (s === "no_descrito") return "No Descrito";
    if (s === "normal") return "🟢 Normal";
    if (s === "desgarro_completo") return "🔴 Desgarro completo";
    if (s === "desgarro_parcial") return "🟠 Desgarro parcial";
    if (s === "esguince_leve") return "🟡 Esguince ligamentario";
    if (s === "epicondilitis") return "🟡 Epicondilitis lateral";
    if (s === "epitrocleitis") return "🟡 Epitrocleitis medial";
    if (s === "derrame_leve") return "🟡 Derrame leve";
    if (s === "derrame_moderado") return "🟠 Derrame moderado";
    if (s === "neuritis") return "🟡 Neuritis cubital";
    if (s === "subluxacion") return "🟠 Subluxación dinámica";
    return s;
  };

  return (
    <div className="flex flex-col gap-5" id="elbow-anatomy-viewer-container">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-950/50 border border-indigo-900/60 text-indigo-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase font-mono tracking-wide">
              SINOPSIS ANATÓMICA: ECOGRAFÍA DE CODO
              <span className="text-[10px] bg-indigo-950 border border-indigo-800/40 text-indigo-300 font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                MEDIAL / LATERAL
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Mapeo de hallazgos para codo de tenista, codo de golfista, ligamentos y nervio cubital.
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {setIncludeInReport && (
            <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/20 border border-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-850 transition-all select-none">
              <input 
                type="checkbox" 
                checked={includeInReport} 
                onChange={(e) => setIncludeInReport(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
              />
              <span className="text-[10.5px] font-medium text-slate-300">Insertar en Reporte PDF</span>
            </label>
          )}

          <button
            type="button"
            onClick={syncStatesFromReport}
            title="Sincronizar forzado desde el reporte redactado"
            className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 text-indigo-300 hover:text-indigo-200 transition-all flex items-center gap-1.5 text-[11px]"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar
          </button>

          <button
            type="button"
            onClick={handleExportClick}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-[11px] font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-1.5 border border-emerald-500/30"
          >
            <Download className="h-3 w-3" />
            Integrar Tabla c/Hallazgos
          </button>
        </div>
      </div>

      {syncLogs.length > 0 && (
        <div className="bg-slate-950/20 border border-indigo-900/30 rounded-xl px-3 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-indigo-400 items-center font-mono">
          <Sparkles className="h-2.5 w-2.5 animate-pulse text-indigo-400 flex-shrink-0" />
          <span className="font-bold">CONEXIÓN REPORT-HUD:</span>
          {syncLogs.slice(-3).map((log, i) => (
            <span key={i} className="opacity-90">{log}</span>
          ))}
        </div>
      )}

      {/* WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COMPARTMENT: ILLUSTRATIONS */}
        <div className="lg:col-span-7 bg-slate-950/30 border border-slate-850/60 rounded-3xl p-4 flex flex-col gap-3">
          
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              Visualización Anatómica
            </span>
            
            <div className="flex bg-slate-900/50 p-0.5 rounded-lg border border-slate-800/80">
              <button
                type="button"
                onClick={() => setSubViewMode("lateral")}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  subViewMode === "lateral" ? "bg-indigo-950 text-indigo-300 border border-indigo-800/30 font-bold" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Cara Lateral
              </button>
              <button
                type="button"
                onClick={() => setSubViewMode("medial")}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  subViewMode === "medial" ? "bg-indigo-950 text-indigo-300 border border-indigo-800/30 font-bold" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Cara Medial
              </button>
              <button
                type="button"
                onClick={() => setSubViewMode("dual")}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  subViewMode === "dual" ? "bg-indigo-950 text-indigo-300 border border-indigo-800/30 font-bold" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Vista Dual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* CARA LATERAL SVG CONTAINER */}
            <div className={`${
              subViewMode === "dual" ? "md:col-span-6" : subViewMode === "lateral" ? "md:col-span-12" : "hidden"
            } flex flex-col pt-1`}>
              <div className="text-center py-1 text-[11px] font-bold font-mono tracking-wider text-slate-400 border-b border-slate-800/30 mb-2">
                CARA LATERAL (Codo Tenista / LCR)
              </div>
              <div className="w-full flex items-center justify-center min-h-[240px] bg-slate-950/20 p-2 rounded-2xl relative overflow-hidden">
                <svg 
                  id="elbow-anatomy-svg-lateral"
                  viewBox="0 0 240 240" 
                  className="w-full max-w-[200px] h-auto drop-shadow-xl select-none"
                >
                  <defs>
                    <linearGradient id="lateralBoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>

                  {/* BACKGROUND GRID */}
                  <rect width="240" height="240" fill="none" />
                  <path d="M 120 0 L 120 240 M 0 120 L 240 120" stroke="rgba(30, 41, 59, 0.2)" strokeWidth="0.5" />

                  {/* OUTLINE HUMERUS (Lateral Condyle) */}
                  <path 
                    d="M 60,10 C 60,30 50,60 55,90 C 58,110 70,120 90,122 C 105,123 115,115 118,90 C 120,60 110,30 110,10" 
                    fill="url(#lateralBoneGrad)" 
                    stroke="#475569" 
                    strokeWidth="1" 
                  />
                  
                  {/* OUTLINE RADIUS (Radial Head / Neck) */}
                  <path 
                    d="M 85,150 C 70,150 55,155 55,165 C 55,170 65,178 68,185 L 68,230 L 102,230 L 102,185 C 105,178 115,170 115,165 C 115,155 100,150 85,150 Z" 
                    fill="url(#lateralBoneGrad)" 
                    stroke="#475569" 
                    strokeWidth="1" 
                  />

                  {/* HUMERORADIAL JOINT SPACE AND CAPSULE */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("humeroradial_joint")}
                    onMouseEnter={() => setActiveHover("humeroradial_joint")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      id="hr_joint_path"
                      d="M 70,135 C 75,134 95,134 100,135 C 104,136 106,144 100,147 C 95,149 75,149 70,147 C 64,144 66,136 70,135 Z" 
                      fill={getColorForSVG("humeroradial_joint").fill} 
                      stroke={getColorForSVG("humeroradial_joint").stroke} 
                      strokeWidth={states.humeroradial_joint !== "normal" && states.humeroradial_joint !== "no_descrito" ? "2.3" : "1"}
                      fillOpacity={states.humeroradial_joint !== "normal" && states.humeroradial_joint !== "no_descrito" ? "0.8" : "0.3"}
                    />
                    <line x1="85" y1="141" x2="165" y2="135" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="85" cy="141" r="2" fill="#81a1c1" />
                  </g>

                  {/* RADIAL COLLATERAL LIGAMENT */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("radial_collateral")}
                    onMouseEnter={() => setActiveHover("radial_collateral")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      id="radial_collateral_path"
                      d="M 80,102 L 60,165 L 72,166 L 86,104 Z" 
                      fill={getColorForSVG("radial_collateral").fill} 
                      stroke={getColorForSVG("radial_collateral").stroke} 
                      strokeWidth={states.radial_collateral !== "normal" && states.radial_collateral !== "no_descrito" ? "2.5" : "1"}
                      fillOpacity={states.radial_collateral !== "normal" && states.radial_collateral !== "no_descrito" ? "0.95" : "0.5"}
                    />
                    <line x1="72" y1="130" x2="25" y2="110" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="72" cy="130" r="2" fill="#81a1c1" />
                  </g>

                  {/* COMMON EXTENSOR TENDON */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("common_extensor")}
                    onMouseEnter={() => setActiveHover("common_extensor")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      id="common_extensor_path"
                      d="M 58,85 C 55,95 50,110 46,128 C 42,143 50,158 56,168 L 61,162 C 57,153 50,138 52,125 C 54,112 55,100 60,86 Z" 
                      fill={getColorForSVG("common_extensor").fill} 
                      stroke={getColorForSVG("common_extensor").stroke} 
                      strokeWidth={states.common_extensor !== "normal" && states.common_extensor !== "no_descrito" ? "2.5" : "1"}
                      fillOpacity={states.common_extensor !== "normal" && states.common_extensor !== "no_descrito" ? "0.95" : "0.5"}
                      strokeDasharray={states.common_extensor === "epicondilitis" ? "3,2" : "none"}
                    />
                    <line x1="53" y1="110" x2="20" y2="175" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="53" cy="110" r="2" fill="#81a1c1" />
                  </g>

                  {/* Outer Labels */}
                  <text x="18" y="185" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">T. Extensor Común</text>
                  <text x="22" y="102" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">Lig. Colateral Radial</text>
                  <text x="168" y="137" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">Art. Humerorradial</text>
                  
                  {/* Bone names */}
                  <text x="85" y="45" fill="#64748b" fontSize="5.2" textAnchor="center">HÚMERO</text>
                  <text x="85" y="215" fill="#64748b" fontSize="5.2" textAnchor="center">RADIO</text>
                </svg>
              </div>
            </div>

            {/* CARA MEDIAL SVG CONTAINER */}
            <div className={`${
              subViewMode === "dual" ? "md:col-span-6" : subViewMode === "medial" ? "md:col-span-12" : "hidden"
            } flex flex-col pt-1`}>
              <div className="text-center py-1 text-[11px] font-bold font-mono tracking-wider text-slate-400 border-b border-slate-800/30 mb-2">
                CARA MEDIAL (Codo Golfista / LCC / N. Cubital)
              </div>
              <div className="w-full flex items-center justify-center min-h-[240px] bg-slate-950/20 p-2 rounded-2xl relative overflow-hidden">
                <svg 
                  id="elbow-anatomy-svg-medial"
                  viewBox="0 0 240 240" 
                  className="w-full max-w-[200px] h-auto drop-shadow-xl select-none"
                >
                  <defs>
                    <linearGradient id="medialBoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>

                  <rect width="240" height="240" fill="none" />
                  <path d="M 120 0 L 120 240 M 0 120 L 240 120" stroke="rgba(30, 41, 59, 0.2)" strokeWidth="0.5" />

                  {/* OUTLINE HUMERUS (Medial Epicondyle / Epitrochlea) */}
                  <path 
                    d="M 120,10 C 120,30 110,60 112,90 C 114,103 95,115 80,118 C 72,119 55,112 52,90 C 50,60 60,30 60,10" 
                    fill="url(#medialBoneGrad)" 
                    stroke="#475569" 
                    strokeWidth="1" 
                  />
                  
                  {/* OUTLINE ULNA (Proximal Ulna / Olecranon process) */}
                  <path 
                    d="M 80,150 C 95,150 110,155 110,165 C 110,173 100,180 98,188 L 98,230 L 64,230 L 64,188 C 62,180 50,173 50,165 C 50,155 65,150 80,150 Z" 
                    fill="url(#medialBoneGrad)" 
                    stroke="#475569" 
                    strokeWidth="1" 
                  />

                  {/* ULNAR COLLATERAL LIGAMENT (LCC) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("ulnar_collateral")}
                    onMouseEnter={() => setActiveHover("ulnar_collateral")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      id="ulnar_collateral_path"
                      d="M 85,102 L 105,160 L 98,162 L 78,103 Z" 
                      fill={getColorForSVG("ulnar_collateral").fill} 
                      stroke={getColorForSVG("ulnar_collateral").stroke} 
                      strokeWidth={states.ulnar_collateral !== "normal" && states.ulnar_collateral !== "no_descrito" ? "2.5" : "1"}
                      fillOpacity={states.ulnar_collateral !== "normal" && states.ulnar_collateral !== "no_descrito" ? "0.95" : "0.5"}
                    />
                    <line x1="90" y1="126" x2="165" y2="105" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="90" cy="126" r="2" fill="#81a1c1" />
                  </g>

                  {/* COMMON FLEXOR TENDON */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("common_flexor")}
                    onMouseEnter={() => setActiveHover("common_flexor")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      id="common_flexor_path"
                      d="M 95,85 C 98,95 104,110 108,128 C 112,143 104,158 98,168 L 93,162 C 97,153 104,138 102,125 C 100,112 99,100 94,86 Z" 
                      fill={getColorForSVG("common_flexor").fill} 
                      stroke={getColorForSVG("common_flexor").stroke} 
                      strokeWidth={states.common_flexor !== "normal" && states.common_flexor !== "no_descrito" ? "2.5" : "1"}
                      fillOpacity={states.common_flexor !== "normal" && states.common_flexor !== "no_descrito" ? "0.95" : "0.5"}
                      strokeDasharray={states.common_flexor === "epitrocleitis" ? "3,2" : "none"}
                    />
                    <line x1="103" y1="110" x2="165" y2="165" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="103" cy="110" r="2" fill="#81a1c1" />
                  </g>

                  {/* ULNAR NERVE */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("ulnar_nerve")}
                    onMouseEnter={() => setActiveHover("ulnar_nerve")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    {/* Retro-epitrochlear nerve tunnel path */}
                    <path 
                      id="ulnar_nerve_path"
                      d="M 124,40 L 122,95 C 120,118 116,160 115,220" 
                      fill="none" 
                      stroke={getColorForSVG("ulnar_nerve").stroke || "#475569"} 
                      strokeWidth={states.ulnar_nerve !== "normal" && states.ulnar_nerve !== "no_descrito" ? "3.5" : "1.8"}
                      strokeOpacity={states.ulnar_nerve !== "normal" && states.ulnar_nerve !== "no_descrito" ? "0.9" : "0.6"}
                      strokeDasharray={states.ulnar_nerve === "subluxacion" ? "4,3" : "none"}
                    />
                    <line x1="120" y1="130" x2="25" y2="140" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                    <circle cx="120" cy="130" r="2" fill="#81a1c1" />
                  </g>

                  {/* Outer Labels */}
                  <text x="22" y="143" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">Nervio Cubital</text>
                  <text x="168" y="102" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">Lig. Colateral Cubital</text>
                  <text x="168" y="168" fill="#a5b4fc" fontSize="5.5" fontWeight="semibold" textAnchor="start">T. Flexor Común (Epitróclea)</text>
                  
                  {/* Bone names */}
                  <text x="85" y="45" fill="#64748b" fontSize="5.2" textAnchor="center">HÚMERO</text>
                  <text x="85" y="215" fill="#64748b" fontSize="5.2" textAnchor="center">CÚBITO</text>
                </svg>
              </div>
            </div>

          </div>

          <p className="text-center mt-2.5 pt-2 border-t border-slate-800/40 text-[10.5px] text-zinc-400 italic font-medium leading-relaxed">
            💡 Haz clic en los trazados coloreados del codo para inspeccionar o auditar los hallazgos en tiempo real.
          </p>
        </div>

        {/* RIGHT COMPARTMENT: DETAILS & CONTROL PANEL */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* HUD OVERVIEW badges */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-3 flex flex-col gap-2">
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none mb-1">
              <Layers className="h-3 w-3 text-indigo-400" />
              Inspección de Órganos y Estructuras
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ELBOW_STRUCTURES.map(item => {
                const s = states[item.id];
                const isSelected = selectedStructure === item.id;
                
                let bgBadge = "bg-slate-800/30 border-slate-800/80 text-slate-400 hover:bg-slate-850/50";
                if (s === "normal") {
                  bgBadge = isSelected
                    ? "bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold"
                    : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/10";
                } else if (s === "desgarro_completo") {
                  bgBadge = isSelected
                    ? "bg-red-950/80 border-red-500 text-red-200 font-bold"
                    : "bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-900/10";
                } else if (s !== "no_descrito") {
                  bgBadge = isSelected
                    ? "bg-amber-950/70 border-amber-500 text-amber-200 font-bold"
                    : "bg-amber-950/20 border-amber-900/40 text-amber-400 hover:bg-amber-900/10";
                } else {
                  if (isSelected) {
                    bgBadge = "bg-slate-800 border-indigo-500 text-slate-100 font-bold";
                  }
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedStructure(item.id);
                      // Auto toggle aspect tab if selected is from another tab
                      if (item.aspect === "lateral" && subViewMode === "medial") setSubViewMode("lateral");
                      if (item.aspect === "medial" && subViewMode === "lateral") setSubViewMode("medial");
                    }}
                    className={`px-2 py-1.5 text-[10px] rounded-lg border text-left truncate transition-all ${bgBadge}`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE STRUCTURE CONFIG PANEL */}
          {(() => {
            const activeStruct = ELBOW_STRUCTURES.find(s => s.id === selectedStructure);
            if (!activeStruct) return null;
            const state = states[selectedStructure];

            return (
              <div className="bg-slate-900/35 border border-slate-800/65 rounded-2xl p-4 flex flex-col gap-4">
                
                {/* Structural Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {activeStruct.name}
                      <span className="text-[9px] font-normal text-slate-400 capitalize tracking-tight font-mono">
                        ({activeStruct.aspect})
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{activeStruct.description}</p>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-tight uppercase border flex-shrink-0 ${getClinicalBadgeClass(state)}`}>
                    {state.replaceAll("_", " ")}
                  </span>
                </div>

                {/* Status selector radio controls */}
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Alterar Estado en Diagramas y Tabla:
                  </label>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    
                    {/* Baseline / No_descrito */}
                    <button
                      type="button"
                      onClick={() => handleUpdateStructureState(selectedStructure, "no_descrito")}
                      className={`px-2 py-1 text-[10px] rounded border transition-all ${
                        state === "no_descrito"
                          ? "bg-slate-850 border-slate-600 text-slate-100 font-bold"
                          : "bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      No Descrito
                    </button>

                    {/* Normal */}
                    <button
                      type="button"
                      onClick={() => handleUpdateStructureState(selectedStructure, "normal")}
                      className={`px-2 py-1 text-[10px] rounded border transition-all ${
                        state === "normal"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-bold"
                          : "bg-slate-950/40 border-slate-900 text-emerald-600/70 hover:text-emerald-500"
                      }`}
                    >
                      🟢 Normal
                    </button>

                    {/* Render pathologies depending on structure ID */}
                    {(() => {
                      if (selectedStructure === "common_extensor") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "epicondilitis")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "epicondilitis"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟡 Epicondilitis
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_parcial")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "desgarro_parcial"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟠 Desg. Parcial
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_completo")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all span-2 col-span-2 ${
                                state === "desgarro_completo"
                                  ? "bg-red-950 text-red-300 border-red-705 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-red-500/70 hover:text-red-500"
                              }`}
                            >
                              🔴 Desg. Completo
                            </button>
                          </>
                        );
                      }
                      if (selectedStructure === "common_flexor") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "epitrocleitis")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "epitrocleitis"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟡 Epitrocleitis
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_parcial")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "desgarro_parcial"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟠 Desg. Parcial
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_completo")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all span-2 col-span-2 ${
                                state === "desgarro_completo"
                                  ? "bg-red-950 text-red-300 border-red-705 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-red-500/70 hover:text-red-500"
                              }`}
                            >
                              🔴 Desg. Completo
                            </button>
                          </>
                        );
                      }
                      if (selectedStructure === "radial_collateral" || selectedStructure === "ulnar_collateral") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "esguince_leve")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "esguince_leve"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-500/70 hover:text-amber-550"
                              }`}
                            >
                              🟡 Esguince
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_parcial")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "desgarro_parcial"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟠 Desg. Parcial
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "desgarro_completo")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all col-span-2 ${
                                state === "desgarro_completo"
                                  ? "bg-red-950 text-red-300 border-red-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-red-500/70 hover:text-red-505"
                              }`}
                            >
                              🔴 Desg. Completo
                            </button>
                          </>
                        );
                      }
                      if (selectedStructure === "humeroradial_joint") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "derrame_leve")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "derrame_leve"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-500/70 hover:text-amber-500"
                              }`}
                            >
                              🟡 Derrame Leve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "derrame_moderado")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "derrame_moderado"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-500/70 hover:text-amber-500"
                              }`}
                            >
                              🟠 Derrame Mod.
                            </button>
                          </>
                        );
                      }
                      if (selectedStructure === "ulnar_nerve") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "neuritis")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "neuritis"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-550/70 hover:text-amber-500"
                              }`}
                            >
                              🟡 Neuritis
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStructureState(selectedStructure, "subluxacion")}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                state === "subluxacion"
                                  ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                                  : "bg-slate-950/40 border-slate-900 text-amber-500/70 hover:text-amber-500"
                              }`}
                            >
                              🟠 Subluxación
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}

                  </div>
                </div>

                {/* Descripciones sinópticas personalizadas */}
                {state !== "no_descrito" && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center justify-between">
                      <span>Sinopsis de Hallazgos en Reporte:</span>
                      <span className="text-[8px] text-indigo-400 capitalize">Personalizado</span>
                    </label>
                    <textarea
                      rows={2}
                      value={customDescriptions[selectedStructure]}
                      onChange={(e) => handleCustomDescriptionChange(selectedStructure, e.target.value)}
                      placeholder="Redactar o auditar sinopsis diagnóstica de la estructura..."
                      className="w-full text-[11px] bg-slate-950/80 border border-slate-800/80 rounded-xl px-2.5 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700 transition-all font-sans leading-relaxed resize-none"
                    />
                  </div>
                )}
              </div>
            );
          })()}

        </div>

      </div>

    </div>
  );
}
