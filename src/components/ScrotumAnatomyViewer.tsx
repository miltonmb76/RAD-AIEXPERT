import React, { useState, useEffect } from "react";
import { 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Check, 
  HelpCircle, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";

interface ScrotumAnatomyViewerProps {
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

export default function ScrotumAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions
}: ScrotumAnatomyViewerProps) {
  
  // Scrotal structures state:
  // - "no_descrito": Omitted from table/diagrams
  // - "normal": Within normal limits
  // - Pathology values dependent on the structure
  const [states, setStates] = useState<Record<string, string>>({
    testiculo_derecho: "no_descrito",
    testiculo_izquierdo: "no_descrito",
    epididimo_derecho: "no_descrito",
    epididimo_izquierdo: "no_descrito",
    hemiescroto_derecho: "no_descrito",
    hemiescroto_izquierdo: "no_descrito"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    testiculo_derecho: "",
    testiculo_izquierdo: "",
    epididimo_derecho: "",
    epididimo_izquierdo: "",
    hemiescroto_derecho: "",
    hemiescroto_izquierdo: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("testiculo_derecho");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

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

  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "testiculo_derecho":
        return [
          "testiculo derecho", "hemitesticulo derecho", "t. derecho", "td renal", "testiculo d.", "gonada derecha"
        ];
      case "testiculo_izquierdo":
        return [
          "testiculo izquierdo", "hemitesticulo izquierdo", "t. izquierdo", "ti renal", "testiculo i.", "gonada izquierda"
        ];
      case "epididimo_derecho":
        return [
          "epididimo derecho", "epididimo d.", "cabeza del epididimo derecho", "cabeza epididimaria derecha", "epididimario derecho"
        ];
      case "epididimo_izquierdo":
        return [
          "epididimo izquierdo", "epididimo i.", "cabeza del epididimo izquierdo", "cabeza epididimaria izquierda", "epididimario izquierdo"
        ];
      case "hemiescroto_derecho":
        return [
          "escroto derecho", "hemiescroto derecho", "bolsa escrotal derecha", "pared escrotal derecha", "plexo pampiniforme derecho", "varicocele derecho", "hidrocele derecho", "tunica vaginalis derecha"
        ];
      case "hemiescroto_izquierdo":
        return [
          "escroto izquierdo", "hemiescroto izquierdo", "bolsa escrotal izquierda", "pared escrotal izquierda", "plexo pampiniforme izquierdo", "varicocele izquierdo", "hidrocele izquierdo", "tunica vaginalis izquierda"
        ];
      default:
        return [];
    }
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (s === "no_descrito") {
      return "No descrito.";
    }
    if (s === "normal") {
      return "Dentro de límites normales.";
    }

    switch (id) {
      case "testiculo_derecho":
      case "testiculo_izquierdo":
        if (s === "quiste") return "Quiste simple intratesticular de aspecto benigno.";
        if (s === "nodulo_benigno") return "Pequeño nódulo hipoecoico bien delimitado probablemente benigno.";
        if (s === "masa_sospechosa") return "Lesión sólida vascularizada sospechosa.";
        if (s === "orquitis") return "Incremento de vascularización y edema parenquimatoso por orquitis.";
        if (s === "atrofia") return "Atrofia testicular con volumen disminuido.";
        if (s === "trauma") return "Hematoma o parénquima heterogéneo secundario a traumatismo.";
        break;
      case "epididimo_derecho":
      case "epididimo_izquierdo":
        if (s === "espermatocele") return "Quiste o espermatocele en la cabeza del epidídimo.";
        if (s === "epididimitis") return "Engrosamiento epididimario difuso con hiperemia por epididimitis aguda.";
        break;
      case "hemiescroto_derecho":
      case "hemiescroto_izquierdo":
        if (s === "hidrocele") return "Colección líquida libre compatible con hidrocele.";
        if (s === "varicocele") return "Ectasia de venas del plexo pampiniforme (varicocele).";
        if (s === "engrosamiento_pared") return "Engrosamiento edematoso de las cubiertas escrotales.";
        break;
    }
    return "Alteración descrita.";
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis local con heurísticas de coincidencia...");
    const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };
    const keys = ["testiculo_derecho", "testiculo_izquierdo", "epididimo_derecho", "epididimo_izquierdo", "hemiescroto_derecho", "hemiescroto_izquierdo"];

    keys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No descrito.";
        return;
      }

      // Check if normal
      const isNormal = [
        "normal", "conservado", "conservada", "homogeneo", "homogenea", "sin alteraciones",
        "morfologia habitual", "aspecto habitual", "sin evidencia de colecciones", "sin colecciones",
        "sin hidrocele", "sin varicocele", "libre de lesiones", "dentro de limites normales",
        "limites normales", "no se observan nodulos", "sin nodulos", "sin masas", "sin quistes"
      ].some(p => {
        return keywords.some(kw => {
          const idx = textLower.indexOf(kw);
          if (idx === -1) return false;
          const context = textLower.substring(Math.max(0, idx - 45), Math.min(textLower.length, idx + 80));
          return context.includes(p);
        });
      });

      if (isNormal) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        logs.push(`[Local] ${id} clasificado como NORMAL.`);
        return;
      }

      // Match pathological patterns
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      if (id.startsWith("testiculo_")) {
        if (textLower.includes("quiste") && keywords.some(kw => {
          const idx = textLower.indexOf(kw);
          if (idx === -1) return false;
          const context = textLower.substring(Math.max(0, idx - 30), Math.min(textLower.length, idx + 60));
          return context.includes("quiste") || context.includes("quística");
        })) {
          detectedState = "quiste";
          desc = "Quiste simple intratesticular de aspecto benigno.";
        } else if (textLower.includes("orquitis") || textLower.includes("orquiepididimitis") || (textLower.includes("hiperflujo") && textLower.includes("aumento de vascularizacion"))) {
          detectedState = "orquitis";
          desc = "Incremento de vascularización y edema parenquimatoso por orquitis.";
        } else if (textLower.includes("atrofia") || textLower.includes("hipoplasia") || textLower.includes("reducido de tamano") || textLower.includes("volumen disminuido")) {
          detectedState = "atrofia";
          desc = "Atrofia testicular con volumen disminuido.";
        } else if (textLower.includes("ruptura") || textLower.includes("traumatismo") || textLower.includes("trauma") || textLower.includes("hematoma")) {
          detectedState = "trauma";
          desc = "Hematoma o parénquima heterogéneo secundario a traumatismo.";
        } else if (textLower.includes("masa") || textLower.includes("neoplasia") || textLower.includes("irregular") || textLower.includes("sospechosa") || textLower.includes("nodulo solido")) {
          detectedState = "masa_sospechosa";
          desc = "Lesión sólida vascularizada sospechosa.";
        } else if (textLower.includes("nodulo") || textLower.includes("foco hipoecoico")) {
          detectedState = "nodulo_benigno";
          desc = "Pequeño nódulo hipoecoico bien delimitado probablemente benigno.";
        }
      } else if (id.startsWith("epididimo_")) {
        if (textLower.includes("espermatocele") || textLower.includes("quiste de epididimo") || textLower.includes("quiste de la cabeza")) {
          detectedState = "espermatocele";
          desc = "Quiste o espermatocele en la cabeza del epidídimo.";
        } else if (textLower.includes("epididimitis") || textLower.includes("tumefacto") || textLower.includes("engrosado")) {
          detectedState = "epididimitis";
          desc = "Engrosamiento epididimario difuso con hiperemia por epididimitis aguda.";
        }
      } else if (id.startsWith("hemiescroto_")) {
        if (textLower.includes("hidrocele")) {
          detectedState = "hidrocele";
          desc = "Colección líquida libre compatible con hidrocele.";
        } else if (textLower.includes("varicocele") || textLower.includes("reflujo") || textLower.includes("vena") || textLower.includes("plexo")) {
          detectedState = "varicocele";
          desc = "Ectasia de venas del plexo pampiniforme (varicocele).";
        } else if (textLower.includes("engrosamiento") || textLower.includes("edema") || textLower.includes("pared")) {
          detectedState = "engrosamiento_pared";
          desc = "Engrosamiento edematoso de las cubiertas escrotales.";
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = desc;
      logs.push(`[Local] ${id} clasificado como ${detectedState.toUpperCase()}.`);
    });

    setStates(nextStates);
    setCustomDescriptions(nextDescriptions);
  };

  const handleScanReportText = async (showFeedback: boolean = false) => {
    if (!generatedReport) {
      if (showFeedback) {
        setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: No hay reporte clínico disponible para analizar.`]);
      }
      return;
    }

    setIsSyncing(true);
    const logs: string[] = [];
    logs.push(`Iniciando extracción inteligente de hallazgos en Escroto / Testículos (${generatedReport.length} caracteres)...`);

    const structuresList = [
      {
        id: "testiculo_derecho",
        label: "Testículo Derecho",
        allowedStates: ["no_descrito", "normal", "quiste", "nodulo_benigno", "masa_sospechosa", "orquitis", "atrofia", "trauma"]
      },
      {
        id: "testiculo_izquierdo",
        label: "Testículo Izquierdo",
        allowedStates: ["no_descrito", "normal", "quiste", "nodulo_benigno", "masa_sospechosa", "orquitis", "atrofia", "trauma"]
      },
      {
        id: "epididimo_derecho",
        label: "Epidídimo Derecho",
        allowedStates: ["no_descrito", "normal", "espermatocele", "epididimitis"]
      },
      {
        id: "epididimo_izquierdo",
        label: "Epidídimo Izquierdo",
        allowedStates: ["no_descrito", "normal", "espermatocele", "epididimitis"]
      },
      {
        id: "hemiescroto_derecho",
        label: "Hemiescroto Derecho",
        allowedStates: ["no_descrito", "normal", "hidrocele", "varicocele", "engrosamiento_pared"]
      },
      {
        id: "hemiescroto_izquierdo",
        label: "Hemiescroto Izquierdo",
        allowedStates: ["no_descrito", "normal", "hidrocele", "varicocele", "engrosamiento_pared"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido de Escroto",
          structures: structuresList
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;
        
        const finalStates = { ...states };
        const finalDescriptions = { ...customDescriptions };

        structuresList.forEach(struc => {
          if (data.states[struc.id]) {
            const parsedState = data.states[struc.id];
            const rawDesc = data.descriptions[struc.id];
            
            let finalDesc = rawDesc || "Dentro de límites normales.";
            if (parsedState === "normal") {
              finalDesc = "Dentro de límites normales.";
            } else if (parsedState === "no_descrito") {
              finalDesc = "No descrito.";
            }

            finalStates[struc.id] = parsedState;
            finalDescriptions[struc.id] = finalDesc;
            parsedCount++;

            if (parsedState !== "normal" && parsedState !== "no_descrito") {
              foundPathologies++;
            }
            logs.push(`[Sync] ${struc.label}: ${parsedState.toUpperCase()} - "${finalDesc}"`);
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setSyncLogs(prev => [...prev, ...logs, `✔ Sincronización completa. ${parsedCount} descritos, ${foundPathologies} hallazgos patológicos.`]);
        setLastSyncedReport(generatedReport);
      } else {
        logs.push("La API no devolvió un formato válido. Aplicando heurísticas de respaldo...");
        runLocalHeuristics(logs);
        setSyncLogs(prev => [...prev, ...logs]);
      }
    } catch (error) {
      console.error("Error en extracción inteligente de escroto:", error);
      logs.push("Fallo en conexión con la API. Ejecutando heurística local de respaldo...");
      runLocalHeuristics(logs);
      setSyncLogs(prev => [...prev, ...logs]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => ({ ...prev, [id]: s }));
    
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No descrito." }));
    } else if (s === "normal") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "Dentro de límites normales." }));
    } else {
      setCustomDescriptions(prev => ({ ...prev, [id]: getSimplifiedDescription(id, s) }));
    }
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  useEffect(() => {
    // Disabled auto-sync on mount/report changes to save tokens as requested.
    // Sync will only occur manually when requested by user.
  }, [generatedReport, lastSyncedReport]);

  const exportTableData = () => {
    let md = `\n| Estructura analizada | Hallazgos ecográficos / Sinopsis del reporte |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "testiculo_derecho", label: "Testículo Derecho" },
      { id: "testiculo_izquierdo", label: "Testículo Izquierdo" },
      { id: "epididimo_derecho", label: "Epidídimo Derecho" },
      { id: "epididimo_izquierdo", label: "Epidídimo Izquierdo" },
      { id: "hemiescroto_derecho", label: "Hemiescroto Derecho" },
      { id: "hemiescroto_izquierdo", label: "Hemiescroto Izquierdo" }
    ];

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos descritos* | *Consulte el texto completo del reporte* |\n`;
    }

    onExportTable(md);
  };

  const exportNarrative = () => {
    if (!onExportNarrative) return;
    
    const keys = ["testiculo_derecho", "testiculo_izquierdo", "epididimo_derecho", "epididimo_izquierdo", "hemiescroto_derecho", "hemiescroto_izquierdo"];
    const pathologicalItems: string[] = [];
    const normalItems: string[] = [];

    keys.forEach(id => {
      const s = states[id];
      const desc = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
      const label = id === "testiculo_derecho" ? "Testículo Derecho" : 
                    id === "testiculo_izquierdo" ? "Testículo Izquierdo" :
                    id === "epididimo_derecho" ? "Epidídimo Derecho" :
                    id === "epididimo_izquierdo" ? "Epidídimo Izquierdo" :
                    id === "hemiescroto_derecho" ? "Hemiescroto Derecho" : "Hemiescroto Izquierdo";

      if (s !== "no_descrito") {
        if (s === "normal") {
          normalItems.push(label);
        } else {
          pathologicalItems.push(`**${label}**: ${desc}`);
        }
      }
    });

    let txt = "El análisis esquemático bilateral transescrotal revela lo siguiente:\n\n";
    if (pathologicalItems.length > 0) {
      txt += "### HALLAZGOS PATOLÓGICOS DETECTADOS:\n";
      pathologicalItems.forEach(item => {
        txt += `* ${item}\n`;
      });
      txt += "\n";
    }

    if (normalItems.length > 0) {
      txt += `### ESTRUCTURAS SIN ALTERACIONES (DENTRO DE LÍMITES NORMALES):\n`;
      txt += `* Se describen íntegros y de características normales: ${normalItems.join(", ")}.\n`;
    } else {
      txt += `* No se identificaron estructuras completamente normales descritas.\n`;
    }

    onExportNarrative(txt);
  };

  useEffect(() => {
    exportTableData();
    exportNarrative();
  }, [states, customDescriptions]);

  const getColorForSVG = (id: string) => {
    const s = states[id] || "no_descrito";
    const isHovered = activeHover === id || selectedStructure === id;

    if (s === "no_descrito") {
      return {
        fill: isHovered ? "#334155" : "#1e293b",
        stroke: isHovered ? "#64748b" : "#475569"
      };
    }
    if (s === "normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.22)",
        stroke: "#10b981"
      };
    }
    // Minor issues: quiste, epididimitis, espermatocele, hidrocele, varicocele, trauma/engrosamiento
    if (s === "quiste" || s === "espermatocele" || s === "hidrocele" || s === "varicocele" || s === "nodulo_benigno") {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
        stroke: "#f59e0b"
      };
    }
    // Severe / inflammatory/ neoplastic issues
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
      stroke: "#f43f5e"
    };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let notInReport = 0;

    Object.keys(states).forEach(key => {
      const st = states[key];
      if (st === "no_descrito") notInReport++;
      else if (st === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normalCount, notInReport };
  };

  const getStructureOptions = (id: string) => {
    switch (id) {
      case "testiculo_derecho":
      case "testiculo_izquierdo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "quiste", label: "Quiste simple intratesticular" },
          { val: "nodulo_benigno", label: "Nódulo probable benigno" },
          { val: "masa_sospechosa", label: "Masa sólida sospechosa" },
          { val: "orquitis", label: "Orquitis activa / Hiperemia" },
          { val: "atrofia", label: "Atrofia / Hipoplasia testicular" },
          { val: "trauma", label: "Traumatismo testicular / Hematoma" }
        ];
      case "epididimo_derecho":
      case "epididimo_izquierdo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "espermatocele", label: "Espermatocele / Quiste epididimario" },
          { val: "epididimitis", label: "Epididimitis aguda engrosada" }
        ];
      case "hemiescroto_derecho":
      case "hemiescroto_izquierdo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hidrocele", label: "Colección líquida (Hidrocele)" },
          { val: "varicocele", label: "Dilatación de plexo (Varicocele)" },
          { val: "engrosamiento_pared", label: "Engrosamiento / Edema de pared" }
        ];
      default:
        return [];
    }
  };

  const badges = getBadgesCount();

  const getActiveStructureLabel = () => {
    switch (selectedStructure) {
      case "testiculo_derecho": return "Testículo Derecho";
      case "testiculo_izquierdo": return "Testículo Izquierdo";
      case "epididimo_derecho": return "Epidídimo Derecho";
      case "epididimo_izquierdo": return "Epidídimo Izquierdo";
      case "hemiescroto_derecho": return "Hemiescroto Derecho";
      case "hemiescroto_izquierdo": return "Hemiescroto Izquierdo";
      default: return "";
    }
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border-2 border-slate-800/80 p-5 shadow-2xl flex flex-col gap-5">
      
      {/* PANEL HEADER WITH TOGGLES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600/20 to-pink-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              US de Escroto y Testículos
              <span className="text-[10px] lowercase font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-850">
                interactivo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Mapeo de hallazgos anatómicos y sinopsis clínica escrotal
            </p>
          </div>
        </div>

        {/* CONTROLS (REFRESH / NLP SYNC) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              syncAvailable 
                ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-555 hover:to-teal-655 border-emerald-500 text-emerald-50 shadow-[0_2px_8px_rgba(16,185,129,0.2)] active:scale-97" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-300" />
                <span>Extrayendo...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-emerald-300" />
                <span>Extrayendo de Reporte</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* THREE VALUE STATE BADGES */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 border border-slate-850/50 rounded-xl">
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-rose-950/30 bg-rose-950/10">
          <span className="text-xs font-black text-rose-500">{badges.pathological}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Patológicos</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-emerald-950/20 bg-emerald-950/10">
          <span className="text-xs font-black text-emerald-400">{badges.normalCount}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Normallím.</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-slate-850 bg-slate-900/40">
          <span className="text-xs font-black text-slate-400">{badges.notInReport}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">No Descrito</span>
        </div>
      </div>

      {/* CENTRAL AREA: DIAGRAM ON LEFT, DETAILED EDITOR ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-5 items-start">
        
        {/* LEFT COLUMN: SVG DIAGRAM */}
        <div className="lg:col-span-4 flex flex-col items-center gap-4 bg-slate-950/30 p-3.5 border border-slate-850/50 rounded-xl max-w-full">
          <div className="w-full text-center border-b border-slate-850 pb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Estudio Anatómico Bilateral</span>
          </div>

          <div className="w-full flex items-center justify-center min-h-[220px] bg-slate-950/20 p-2.5 rounded-xl relative overflow-hidden">
            <svg 
              id="scrotum-anatomy-svg"
              viewBox="0 0 240 240" 
              className="w-full max-w-[210px] h-auto drop-shadow-2xl"
              style={{ maxHeight: "220px" }}
            >
              {/* Outer Scrotal Sac - divider line septum (Backbone background) */}
              <line 
                x1="120" 
                y1="30" 
                x2="120" 
                y2="210" 
                stroke="#334155" 
                strokeWidth="1.5" 
                strokeDasharray="3,3" 
                opacity="0.6" 
              />
              
              {/* === HEMIESCROTO DERECHO (anatomical right = screen left) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("hemiescroto_derecho")}
                onMouseEnter={() => setActiveHover("hemiescroto_derecho")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* External sac right half */}
                <path
                  d="M 120,40 C 70,40 45,70 45,130 C 45,185 85,205 120,205 Z"
                  fill={getColorForSVG("hemiescroto_derecho").fill}
                  stroke={getColorForSVG("hemiescroto_derecho").stroke}
                  strokeWidth={states.hemiescroto_derecho !== "normal" && states.hemiescroto_derecho !== "no_descrito" ? "2.5" : "1"}
                  fillOpacity={states.hemiescroto_derecho !== "normal" && states.hemiescroto_derecho !== "no_descrito" ? "0.6" : "0.15"}
                />
                
                {/* Visual veins of plexus for varicocele representation */}
                {states.hemiescroto_derecho === "varicocele" && (
                  <path 
                    d="M 60,60 Q 72,90 70,120 T 78,160" 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    opacity="0.8" 
                  />
                )}
                {/* Visual hydrocele fluid representation around testicle */}
                {states.hemiescroto_derecho === "hidrocele" && (
                  <path 
                    d="M 115,50 C 85,50 55,75 55,120 C 55,160 85,195 115,195 Z" 
                    fill="none" 
                    stroke="#0284c7" 
                    strokeWidth="4" 
                    opacity="0.6" 
                  />
                )}
              </g>

              {/* === HEMIESCROTO IZQUIERDO (anatomical left = screen right) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("hemiescroto_izquierdo")}
                onMouseEnter={() => setActiveHover("hemiescroto_izquierdo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* External sac left half */}
                <path
                  d="M 120,40 C 170,40 195,70 195,130 C 195,185 155,205 120,205 Z"
                  fill={getColorForSVG("hemiescroto_izquierdo").fill}
                  stroke={getColorForSVG("hemiescroto_izquierdo").stroke}
                  strokeWidth={states.hemiescroto_izquierdo !== "normal" && states.hemiescroto_izquierdo !== "no_descrito" ? "2.5" : "1"}
                  fillOpacity={states.hemiescroto_izquierdo !== "normal" && states.hemiescroto_izquierdo !== "no_descrito" ? "0.6" : "0.15"}
                />
                
                {/* Visual veins of plexus for varicocele representation */}
                {states.hemiescroto_izquierdo === "varicocele" && (
                  <path 
                    d="M 180,60 Q 168,90 170,120 T 162,160" 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    opacity="0.8" 
                  />
                )}
                {/* Visual hydrocele fluid representation around testicle */}
                {states.hemiescroto_izquierdo === "hidrocele" && (
                  <path 
                    d="M 125,50 C 155,50 185,75 185,120 C 185,160 155,195 125,195 Z" 
                    fill="none" 
                    stroke="#0284c7" 
                    strokeWidth="4" 
                    opacity="0.6" 
                  />
                )}
              </g>

              {/* === TESTÍCULO DERECHO (screen left) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("testiculo_derecho")}
                onMouseEnter={() => setActiveHover("testiculo_derecho")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <ellipse
                  cx="85"
                  cy="130"
                  rx="22"
                  ry="28"
                  fill={getColorForSVG("testiculo_derecho").fill}
                  stroke={getColorForSVG("testiculo_derecho").stroke}
                  strokeWidth={states.testiculo_derecho !== "normal" && states.testiculo_derecho !== "no_descrito" ? "2.5" : "1.2"}
                  fillOpacity={states.testiculo_derecho !== "normal" && states.testiculo_derecho !== "no_descrito" ? "0.9" : "0.4"}
                />
                <text x="85" y="132" fill="#cbd5e1" fontSize="7.5" textAnchor="middle" fontWeight="bold">TD</text>
              </g>

              {/* === TESTÍCULO IZQUIERDO (screen right) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("testiculo_izquierdo")}
                onMouseEnter={() => setActiveHover("testiculo_izquierdo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <ellipse
                  cx="155"
                  cy="130"
                  rx="22"
                  ry="28"
                  fill={getColorForSVG("testiculo_izquierdo").fill}
                  stroke={getColorForSVG("testiculo_izquierdo").stroke}
                  strokeWidth={states.testiculo_izquierdo !== "normal" && states.testiculo_izquierdo !== "no_descrito" ? "2.5" : "1.2"}
                  fillOpacity={states.testiculo_izquierdo !== "normal" && states.testiculo_izquierdo !== "no_descrito" ? "0.9" : "0.4"}
                />
                <text x="155" y="132" fill="#cbd5e1" fontSize="7.5" textAnchor="middle" fontWeight="bold">TI</text>
              </g>

              {/* === EPIDÍDIMO DERECHO (screen left outer oval curve) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("epididimo_derecho")}
                onMouseEnter={() => setActiveHover("epididimo_derecho")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path
                  d="M 98,102 C 114,102 112,142 104,158"
                  fill="none"
                  stroke={getColorForSVG("epididimo_derecho").stroke}
                  strokeWidth={states.epididimo_derecho !== "normal" && states.epididimo_derecho !== "no_descrito" ? "4.5" : "2.5"}
                  strokeLinecap="round"
                  opacity={states.epididimo_derecho === "no_descrito" ? "0.4" : "1"}
                />
                <text x="114" y="125" fill="#a1a1aa" fontSize="5.5" textAnchor="start" fontWeight="black">EpD</text>
              </g>

              {/* === EPIDÍDIMO IZQUIERDO (screen right outer oval curve) === */}
              <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("epididimo_izquierdo")}
                onMouseEnter={() => setActiveHover("epididimo_izquierdo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path
                  d="M 142,102 C 126,102 128,142 136,158"
                  fill="none"
                  stroke={getColorForSVG("epididimo_izquierdo").stroke}
                  strokeWidth={states.epididimo_izquierdo !== "normal" && states.epididimo_izquierdo !== "no_descrito" ? "4.5" : "2.5"}
                  strokeLinecap="round"
                  opacity={states.epididimo_izquierdo === "no_descrito" ? "0.4" : "1"}
                />
                <text x="126" y="125" fill="#a1a1aa" fontSize="5.5" textAnchor="end" fontWeight="black">EpI</text>
              </g>

              {/* Annotations/Labels */}
              <text x="85" y="24" fill="#64748b" fontSize="6.5" textAnchor="middle" fontWeight="bold">DERECHO (R)</text>
              <text x="155" y="24" fill="#64748b" fontSize="6.5" textAnchor="middle" fontWeight="bold">IZQUIERDO (L)</text>
            </svg>
          </div>

          <p className="text-[10px] text-slate-500 italic max-w-sm mx-auto leading-normal text-center">
            Haz clic en los testículos (TD/TI), epidídimos (EpD/EpI) o saco escrotal en el diagrama para modificar su estado patológico y descripción.
          </p>
        </div>

        {/* RIGHT COLUMN: DETAILED EDITOR */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* STRUCTURE SELECTOR DROPDOWN */}
          <div className="bg-slate-950/40 p-3.5 border border-slate-850/50 rounded-xl">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Región bajo estudio:</label>
            <div className="flex gap-2">
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-850 hover:border-slate-750 p-2 text-xs font-bold rounded-lg text-slate-100 uppercase tracking-wider"
              >
                <option value="testiculo_derecho">Testículo Derecho (TD)</option>
                <option value="testiculo_izquierdo">Testículo Izquierdo (TI)</option>
                <option value="epididimo_derecho">Epidídimo Derecho (EpD)</option>
                <option value="epididimo_izquierdo">Epidídimo Izquierdo (EpI)</option>
                <option value="hemiescroto_derecho">Hemiescroto Derecho (Vaso/Líquido/Pared)</option>
                <option value="hemiescroto_izquierdo">Hemiescroto Izquierdo (Vaso/Líquido/Pared)</option>
              </select>
            </div>
          </div>

          {/* ACTIVE STATUS SELECTOR AND RECAP */}
          <div className="bg-slate-950/20 p-4 border border-slate-850/50 rounded-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="text-xs font-black text-slate-200">
                {getActiveStructureLabel()}
              </span>
              <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-md border ${
                states[selectedStructure] === "no_descrito" ? "bg-slate-950 border-slate-850 text-slate-550" : 
                states[selectedStructure] === "normal" ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" :
                "bg-amber-950/20 border-amber-900/30 text-amber-400"
              }`}>
                {states[selectedStructure]}
              </span>
            </div>

            {/* STATUS CHIPS OPTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {getStructureOptions(selectedStructure).map(opt => (
                <button
                  key={opt.val}
                  onClick={() => handleStateChange(selectedStructure, opt.val)}
                  className={`py-2 px-2.5 rounded-lg border text-left text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                    states[selectedStructure] === opt.val
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                      : "bg-slate-950/70 border-slate-850/60 text-slate-450 hover:bg-slate-950 hover:border-slate-800 hover:text-slate-250"
                  }`}
                >
                  <span className="truncate pr-1">{opt.label}</span>
                  {states[selectedStructure] === opt.val && <Check className="h-3 w-3 shrink-0 text-indigo-400" />}
                </button>
              ))}
            </div>

            {/* SYNOPTIC SHORT CLINICAL DESCRIPTION */}
            {states[selectedStructure] !== "no_descrito" && (
              <div className="space-y-1.5 pt-2 animate-fadeIn">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Sinopsis de Hallazgo en Reporte:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDescriptions[selectedStructure]}
                    onChange={(e) => handleDescriptionChange(selectedStructure, e.target.value)}
                    placeholder="Ej. Hidrocele simple leve, Varicocele grado III..."
                    className="flex-1 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-xs font-semibold text-slate-200 outline-none"
                  />
                  <button
                    onClick={() => handleDescriptionChange(selectedStructure, getSimplifiedDescription(selectedStructure))}
                    className="px-2.5 py-2 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-250 rounded-lg text-xs font-bold"
                    title="Restablecer frase autogenerada sugerida"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* NLP SYNC LOGS HUD (micro logs showing matches) */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900 font-mono text-[9.5px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8.5px] uppercase font-bold text-slate-550 select-none">Consola de mapeo radiológico</span>
              <button 
                onClick={() => setSyncLogs([])}
                className="text-[8px] uppercase font-bold text-slate-550 hover:text-slate-350 bg-slate-900 border border-slate-850 rounded px-1.5 py-0.5 whitespace-nowrap cursor-pointer"
              >
                Limpiar logs
              </button>
            </div>
            <div className="max-h-[75px] overflow-y-auto space-y-1 divide-y divide-slate-900/60 scrollbar-none">
              {syncLogs.length === 0 ? (
                <div className="text-slate-600 italic">Copie o escriba su texto de reporte médico, el cuadro interactivo y la imagen se sincronizarán de forma integrada...</div>
              ) : (
                syncLogs.map((log, idx) => (
                  <div key={idx} className="pt-1 text-slate-400 flex items-start gap-1 leading-normal">
                    <span className="text-indigo-500 shrink-0 select-none">▶</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
