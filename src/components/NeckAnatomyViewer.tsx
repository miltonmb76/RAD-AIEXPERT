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

interface NeckAnatomyViewerProps {
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

interface NeckStructure {
  id: string;
  name: string;
  description: string;
}

export default function NeckAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions
}: NeckAnatomyViewerProps) {
  
  // States of each neck/thyroid structure:
  // - "no_descrito": Not mentioned in the report (will NOT be exported or shown in table)
  // - "normal": Described but normal (will be shown in table as "Dentro de límites normales")
  // - Pathologies depending on structure
  const [states, setStates] = useState<Record<string, string>>({
    thyroid_right_lobe: "no_descrito",
    thyroid_left_lobe: "no_descrito",
    thyroid_isthmus: "no_descrito",
    parotid_right: "no_descrito",
    parotid_left: "no_descrito",
    submandibular_right: "no_descrito",
    submandibular_left: "no_descrito",
    nodes_right: "no_descrito",
    nodes_left: "no_descrito",
    major_vessels: "no_descrito",
    muscles_soft_tissues: "no_descrito"
  });

  // Manual or custom descriptive text override
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    thyroid_right_lobe: "",
    thyroid_left_lobe: "",
    thyroid_isthmus: "",
    parotid_right: "",
    parotid_left: "",
    submandibular_right: "",
    submandibular_left: "",
    nodes_right: "",
    nodes_left: "",
    major_vessels: "",
    muscles_soft_tissues: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("thyroid_right_lobe");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);
  const [subViewMode, setSubViewMode] = useState<"thyroid" | "cervical" | "dual">("dual");

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
      case "thyroid_right_lobe":
        return [
          "lóbulo tiroideo derecho", "lobulo tiroideo derecho", "lóbulo derecho tiroideo", 
          "lobulo derecho de la tiroides", "lóbulo derecho de tiroides", "lóbulo derecho", 
          "lobulo derecho", "ld de la tiroides", "ld tiroideo", "ld de tiroides"
        ];
      case "thyroid_left_lobe":
        return [
          "lóbulo tiroideo izquierdo", "lobulo tiroideo izquierdo", "lóbulo izquierdo tiroideo", 
          "lobulo izquierdo de la tiroides", "lóbulo izquierdo de tiroides", "lóbulo izquierdo", 
          "lobulo izquierdo", "li de la tiroides", "li tiroideo", "li de tiroides"
        ];
      case "thyroid_isthmus":
        return [
          "istmo", "istmo tiroideo", "istmo de la tiroides", "istmo de tiroides"
        ];
      case "parotid_right":
        return [
          "parótida derecha", "parotida derecha", "glándula parótida derecha", 
          "glandula parotida derecha", "parótida dda", "parotida dda"
        ];
      case "parotid_left":
        return [
          "parótida izquierda", "parotida izquierda", "glándula parótida izquierda", 
          "glandula parotida izquierda", "parótida izq", "parotida izq"
        ];
      case "submandibular_right":
        return [
          "submandibular derecha", "glándula submandibular derecha", "glandula submandibular derecha", 
          "submaxilar derecha", "glándula submaxilar derecha", "glandula submaxilar derecha"
        ];
      case "submandibular_left":
        return [
          "submandibular izquierda", "glándula submandibular izquierda", "glandula submandibular izquierda", 
          "submaxilar izquierda", "glándula submaxilar izquierda", "glandula submaxilar izquierda"
        ];
      case "nodes_right":
        return [
          "adenopatía derecha", "adenopatias derechas", "ganglio derecho", "ganglios derechos", 
          "cervicales derechos", "adenopatía cervical derecha", "niveles derechos", 
          "cadena ganglionar derecha", "niveles cervicales derechos", "nivel derecho"
        ];
      case "nodes_left":
        return [
          "adenopatía izquierda", "adenopatias izquierdas", "ganglio izquierdo", "ganglios izquierdos", 
          "cervicales izquierdos", "adenopatía cervical izquierda", "niveles izquierdos", 
          "cadena ganglionar izquierda", "niveles cervicales izquierdos", "nivel izquierdo"
        ];
      case "major_vessels":
        return [
          "grandes vasos", "carótida", "carotida", "yugular", "eje carotídeo", 
          "vascular cervical", "vascularización cervical", "eje vascular", "vasos principales"
        ];
      case "muscles_soft_tissues":
        return [
          "músculos", "musculos", "tejidos blandos", "tejido celular subcutáneo", 
          "planos musculares", "musculatura cervical", "esternocleidomastoideo"
        ];
      default:
        return [];
    }
  };

  const getSimplifiedDescription = (id: string) => {
    switch (id) {
      case "thyroid_right_lobe":
        return "Lóbulo derecho tiroideo de tamaño y ecoestructura conservados.";
      case "thyroid_left_lobe":
        return "Lóbulo izquierdo tiroideo de aspecto normal homogéneo.";
      case "thyroid_isthmus":
        return "Istmo tiroideo de espesor conservado sin nódulos.";
      case "parotid_right":
        return "Glándula parótida derecha de contornos y ecogenicidad normal.";
      case "parotid_left":
        return "Glándula parótida izquierda sin alteraciones estructurales.";
      case "submandibular_right":
        return "Glándula submandibular derecha de tamaño e histoarquitectura normales.";
      case "submandibular_left":
        return "Glándula submandibular izquierda normal sin dilatación ductal.";
      case "nodes_right":
        return "Cadenas ganglionares cervicales derechas de configuración habitual.";
      case "nodes_left":
        return "Cadenas ganglionares cervicales izquierdas sin adenopatías patológicas.";
      case "major_vessels":
        return "Grandes vasos cervicales permeables sin placas hemodinámicamente significativas.";
      case "muscles_soft_tissues":
        return "Planos musculares y tejidos blandos cervicales de aspecto normal.";
      default:
        return "Sin alteraciones.";
    }
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis con heurísticas locales basadas en patrones...");
    const textLower = generatedReport.toLowerCase();
    
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    const structureKeys = [
      "thyroid_right_lobe", "thyroid_left_lobe", "thyroid_isthmus",
      "parotid_right", "parotid_left", "submandibular_right", "submandibular_left",
      "nodes_right", "nodes_left", "major_vessels", "muscles_soft_tissues"
    ];

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado / No descrito.";
        return;
      }

      // Check if it's declared normal
      const isNormal = [
        "normal", "conservado", "conservada", "homogéneo", "homogénea", 
        "sin alteraciones", "morfología habitual", "aspecto habitual",
        "sin evidencia de nódulos", "dentro de límites normales", "limites normales"
      ].some(p => {
        return keywords.some(kw => {
          const idx = textLower.indexOf(kw);
          if (idx === -1) return false;
          const context = textLower.substring(Math.max(0, idx - 50), Math.min(textLower.length, idx + 100));
          return context.includes(p);
        });
      });

      if (isNormal) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        logs.push(`[Local] ${id} clasificado como NORMAL.`);
        return;
      }

      // Deeper analysis for pathologies based on ID
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      if (id.startsWith("thyroid")) {
        if (textLower.includes("nódulo") || textLower.includes("nodulo") || textLower.includes("quiste") || textLower.includes("foco")) {
          detectedState = "nodulo_benigno";
          desc = "Nódulo tiroideo benigno.";
          if (textLower.includes("tirads 4") || textLower.includes("tirads 5") || textLower.includes("sospechoso") || textLower.includes("irregular")) {
            detectedState = "nodulo_sospechoso";
            desc = "Nódulo tiroideo sospechoso (TIRADS alto).";
          }
        } else if (textLower.includes("bocio") || textLower.includes("multinodular") || textLower.includes("aumentado de tamaño")) {
          detectedState = "bocio_multinodular";
          desc = "Bocio multinodular/difuso.";
        } else if (textLower.includes("tiroiditis") || textLower.includes("heterogénea") || textLower.includes("heterogeneo")) {
          detectedState = "tiroiditis";
          desc = "Tiroiditis crónica de base.";
        }
      } else if (id.includes("parotid") || id.includes("submandibular")) {
        if (textLower.includes("sialoadenitis") || textLower.includes("inflamación") || textLower.includes("inflamacion")) {
          detectedState = "sialoadenitis";
          desc = "Sialoadenitis reactiva.";
        } else if (textLower.includes("litiasis") || textLower.includes("cálculo") || textLower.includes("calculo") || textLower.includes("obstrucción")) {
          detectedState = "litiasis";
          desc = "Litiasis ductal detectada.";
        } else if (textLower.includes("nódulo") || textLower.includes("nodulo") || textLower.includes("tumor") || textLower.includes("masa")) {
          detectedState = "solido";
          desc = "Nódulo sólido detectado.";
        } else if (textLower.includes("quiste") || textLower.includes("colección") || textLower.includes("anecoica")) {
          detectedState = "quiste";
          desc = "Quiste glandular benigno.";
        }
      } else if (id.startsWith("nodes")) {
        if (textLower.includes("reactivo") || textLower.includes("ganglios reactivos") || textLower.includes("adenopatía reactiva") || textLower.includes("adenopatia reactiva")) {
          detectedState = "adenopatia_reactiva";
          desc = "Adenopatía reactiva cervical.";
        } else if (textLower.includes("sospechoso") || textLower.includes("adenopatía sospechosa") || textLower.includes("pérdida de hilio") || textLower.includes("redondeado") || textLower.includes("calcificación")) {
          detectedState = "adenopatia_sospechosa";
          desc = "Adenopatía sospechosa cervical.";
        } else if (textLower.includes("linfadenitis") || textLower.includes("conglomerado")) {
          detectedState = "linfadenitis";
          desc = "Linfadenitis cervical.";
        }
      } else if (id === "major_vessels") {
        if (textLower.includes("placa") || textLower.includes("ateroma") || textLower.includes("estenosis")) {
          detectedState = "placa_ateroma";
          desc = "Placa de ateroma extracraneal.";
        } else if (textLower.includes("ectasia") || textLower.includes("yugular dilatada")) {
          detectedState = "ectasia_yugular";
          desc = "Ectasia de vena yugular.";
        }
      } else if (id === "muscles_soft_tissues") {
        if (textLower.includes("contractura") || textLower.includes("desgarro") || textLower.includes("mielitis")) {
          detectedState = "contractura";
          desc = "Contractura muscular cervical.";
        } else if (textLower.includes("masa") || textLower.includes("lipoma") || textLower.includes("colección")) {
          detectedState = "masa_blanda";
          desc = "Masa de aspecto benigno (lipoma).";
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = desc;
      logs.push(`[Local] ${id} clasificado como ${detectedState.toUpperCase()}.`);
    });

    setStates(nextStates);
    setCustomDescriptions(nextDescriptions);
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Cuello y Tiroides (${generatedReport.length} caracteres)...`);

    const structuresList = [
      {
        id: "thyroid_right_lobe",
        label: "Lóbulo Derecho Tiroideo",
        allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "bocio_multinodular", "tiroiditis"]
      },
      {
        id: "thyroid_left_lobe",
        label: "Lóbulo Izquierdo Tiroideo",
        allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "bocio_multinodular", "tiroiditis"]
      },
      {
        id: "thyroid_isthmus",
        label: "Istmo Tiroideo",
        allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "engrosado"]
      },
      {
        id: "parotid_right",
        label: "Glándula Parótida Derecha",
        allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"]
      },
      {
        id: "parotid_left",
        label: "Glándula Parótida Izquierda",
        allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"]
      },
      {
        id: "submandibular_right",
        label: "Glándula Submandibular Derecha",
        allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"]
      },
      {
        id: "submandibular_left",
        label: "Glándula Submandibular Izquierda",
        allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"]
      },
      {
        id: "nodes_right",
        label: "Ganglios Cervicales Derechos",
        allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"]
      },
      {
        id: "nodes_left",
        label: "Ganglios Cervicales Izquierdos",
        allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"]
      },
      {
        id: "major_vessels",
        label: "Grandes Vasos Cervicales",
        allowedStates: ["no_descrito", "normal", "placa_ateroma", "ectasia_yugular", "permeable_sin_alteraciones"]
      },
      {
        id: "muscles_soft_tissues",
        label: "Planos Musculares y Tejidos Blandos",
        allowedStates: ["no_descrito", "normal", "contractura", "masa_blanda"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Cuello y Tiroides",
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
          const apiState = data.states[struc.id] || "no_descrito";
          const apiDesc = data.descriptions[struc.id] || "No mencionado / No descrito.";

          finalStates[struc.id] = apiState;
          finalDescriptions[struc.id] = apiDesc;

          parsedCount++;
          if (apiState !== "normal" && apiState !== "no_descrito") {
            foundPathologies++;
          }
          if (apiState !== "no_descrito") {
            logs.push(`[Hallazgo] ${struc.label}: ${apiState.toUpperCase()} \n  ↳ ${apiDesc}`);
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con IA. Sincronizadas ${parsedCount} estructuras de Cuello y Tiroides (${foundPathologies} patologías detectadas).`);
      } else {
        logs.push(`[Error API] No se pudo obtener el análisis. Usando heurísticas locales.`);
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía de cuello:", err);
      logs.push(`[Error de red] ${err.message || String(err)}. Redireccionando a análisis local.`);
      runLocalHeuristics(logs);
    } finally {
      setIsSyncing(false);
      setSyncLogs(prev => [...prev, ...logs]);
    }
  };

  useEffect(() => {
    // Disabled auto-sync on mount/report changes to save tokens as requested.
    // Sync will only occur manually when requested by user.
  }, [generatedReport]);

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
    if (s === "nodulo_benigno" || s === "litiasis" || s === "quiste" || s === "adenopatia_reactiva" || s === "contractura" || s === "engrosado") {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.25)",
        stroke: "#f59e0b"
      };
    }
    if (s === "nodulo_sospechoso" || s === "adenopatia_sospechosa" || s === "bocio_multinodular" || s === "tiroiditis" || s === "solido" || s === "sialoadenitis" || s === "linfadenitis" || s === "masa_blanda" || s === "placa_ateroma") {
      return {
        fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
        stroke: "#f43f5e"
      };
    }

    return { fill: "#1e293b", stroke: "#475569" };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let notInReport = 0;

    Object.values(states).forEach(st => {
      if (st === "no_descrito") notInReport++;
      else if (st === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normal: normalCount, empty: notInReport };
  };

  const generateTableMarkdown = () => {
    // Generates a table strictly with "Estructura Anatómica" and "Detalle / Descripción de Hallazgos Clínicos"
    // No "Estado Reportado" column!
    let md = `| Estructura Anatómica | Detalle / Descripción de Hallazgos Clínicos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "thyroid_right_lobe", label: "Lóbulo Derecho Tiroideo" },
      { id: "thyroid_left_lobe", label: "Lóbulo Izquierdo Tiroideo" },
      { id: "thyroid_isthmus", label: "Istmo Tiroideo" },
      { id: "parotid_right", label: "Glándula Parótida Derecha" },
      { id: "parotid_left", label: "Glándula Parótida Izquierda" },
      { id: "submandibular_right", label: "Glándula Submandibular Derecha" },
      { id: "submandibular_left", label: "Glándula Submandibular Izquierda" },
      { id: "nodes_right", label: "Ganglios Cervicales Derechos" },
      { id: "nodes_left", label: "Ganglios Cervicales Izquierdos" },
      { id: "major_vessels", label: "Grandes Vasos Cervicales" },
      { id: "muscles_soft_tissues", label: "Planos Musculares y Tejidos Blandos" }
    ];

    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
      }
    });

    return md;
  };

  const triggerExport = () => {
    onExportTable(generateTableMarkdown());
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => ({ ...prev, [id]: s }));
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No mencionado / No descrito." }));
    } else if (s === "normal") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "Dentro de límites normales." }));
    } else {
      setCustomDescriptions(prev => ({ ...prev, [id]: getSimplifiedDescription(id) }));
    }
  };

  const badges = getBadgesCount();

  const structures: Record<string, NeckStructure> = {
    thyroid_right_lobe: {
      id: "thyroid_right_lobe",
      name: "Lóbulo Derecho Tiroideo",
      description: "Lóbulo derecho de la glándula tiroides."
    },
    thyroid_left_lobe: {
      id: "thyroid_left_lobe",
      name: "Lóbulo Izquierdo Tiroideo",
      description: "Lóbulo izquierdo de la glándula tiroides."
    },
    thyroid_isthmus: {
      id: "thyroid_isthmus",
      name: "Istmo Tiroideo",
      description: "Puente de parénquima tiroideo que conecta ambos lóbulos por delante de la tráquea."
    },
    parotid_right: {
      id: "parotid_right",
      name: "Glándula Parótida Derecha",
      description: "Glándula salival mayor de localización preauricular derecha."
    },
    parotid_left: {
      id: "parotid_left",
      name: "Glándula Parótida Izquierda",
      description: "Glándula salival mayor de localización preauricular izquierda."
    },
    submandibular_right: {
      id: "submandibular_right",
      name: "Glándula Submandibular Derecha",
      description: "Glándula salival mayor situada en el triángulo submandibular derecho."
    },
    submandibular_left: {
      id: "submandibular_left",
      name: "Glándula Submandibular Izquierda",
      description: "Glándula salival mayor situada en el triángulo submandibular izquierdo."
    },
    nodes_right: {
      id: "nodes_right",
      name: "Ganglios Cervicales Derechos",
      description: "Cadenas ganglionares cervicales derechas de los niveles I al VI."
    },
    nodes_left: {
      id: "nodes_left",
      name: "Ganglios Cervicales Izquierdos",
      description: "Cadenas ganglionares cervicales izquierdas de los niveles I al VI."
    },
    major_vessels: {
      id: "major_vessels",
      name: "Grandes Vasos Cervicales",
      description: "Evaluación de permeabilidad y grosor íntima-media de arterias carótidas y permeabilidad de venas yugulares."
    },
    muscles_soft_tissues: {
      id: "muscles_soft_tissues",
      name: "Planos Musculares y Tejidos Blandos",
      description: "Músculo esternocleidomastoideo, tirohioideo, tejido celular subcutáneo."
    }
  };

  const getSubTitleText = () => {
    return "Protocolo Integrado de Cuello y Glándulas Tiroides / Salivales";
  };

  return (
    <div id="neck-anatomy-viewer-root" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8 shadow-2xl relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity id="neck-activity-icon" className="w-4 h-4 animate-pulse" />
            </span>
            <h3 id="neck-viewer-title" className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Anexo Interactivo: Cuello y Glándula Tiroides
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Mapeo anatómico dual y correspondencia clínica inteligente.
          </p>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Badge indicator */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800/80 rounded-xl px-2.5 py-1 text-[10px] gap-2 font-mono">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
              {badges.pathological} Alterados
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              {badges.normal} Normales
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              {badges.empty} Omitidos
            </span>
          </div>

          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-indigo-50 px-2.5 py-1 text-xs rounded-xl font-semibold transition-all shadow-md disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSyncing ? "Escaneando..." : "Sincronizar IA"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: DIAGRAM VIEWER PANEL */}
        <div className="lg:col-span-7 bg-slate-950/55 border border-slate-850/50 rounded-xl p-4 flex flex-col items-center">
          
          {/* TAB HEADERS FOR MAP VIEWS */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 w-full justify-between items-center max-w-sm">
            <button
              onClick={() => setSubViewMode("dual")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${subViewMode === "dual" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              VISTA DUAL
            </button>
            <button
              onClick={() => setSubViewMode("thyroid")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${subViewMode === "thyroid" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              TIROIDES
            </button>
            <button
              onClick={() => setSubViewMode("cervical")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${subViewMode === "cervical" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Cervical / Salivales
            </button>
          </div>

          {/* DUAL OR TARGETED DIAGRAM CAROUSEL */}
          <div id="neck-diagram-scaffold" className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full py-2">
            
            {/* IMAGE 1: THYROID MAP */}
            {(subViewMode === "dual" || subViewMode === "thyroid") && (
              <div className="flex flex-col items-center w-full max-w-[240px]">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2 flex items-center gap-1 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  Glándula Tiroides
                </div>
                
                <svg 
                  id="neck-anatomy-svg-thyroid"
                  viewBox="0 0 240 240" 
                  className="w-full max-w-[220px] h-auto drop-shadow-2xl"
                  style={{ maxHeight: "220px" }}
                >
                  <defs>
                    <linearGradient id="tracheaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2D3748" />
                      <stop offset="50%" stopColor="#4A5568" />
                      <stop offset="100%" stopColor="#2D3748" />
                    </linearGradient>
                  </defs>

                  {/* Trachea Structure */}
                  <rect x="105" y="20" width="30" height="200" fill="url(#tracheaGrad)" rx="2" stroke="#1A202C" strokeWidth="0.8" />
                  {/* Trachea Rings */}
                  <line x1="105" y1="40" x2="135" y2="40" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="65" x2="135" y2="65" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="90" x2="135" y2="90" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="115" x2="135" y2="115" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="140" x2="135" y2="140" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="165" x2="135" y2="165" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="190" x2="135" y2="190" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />
                  <line x1="105" y1="215" x2="135" y2="215" stroke="#1A202C" strokeWidth="1.5" opacity="0.6" />

                  {/* THYROID ISTHMUS (Center) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("thyroid_isthmus")}
                    onMouseEnter={() => setActiveHover("thyroid_isthmus")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 85,135 Q 120,150 155,135 Q 160,115 155,108 Q 120,123 85,108 Z" 
                      fill={getColorForSVG("thyroid_isthmus").fill}
                      stroke={getColorForSVG("thyroid_isthmus").stroke}
                      strokeWidth={states.thyroid_isthmus !== "normal" && states.thyroid_isthmus !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.thyroid_isthmus !== "normal" && states.thyroid_isthmus !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="120" cy="122" r="3" fill="#81a1c1" />
                    <line x1="120" y1="122" x2="120" y2="82" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* THYROID RIGHT LOBE (Anatomical Right = Screen Left) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("thyroid_right_lobe")}
                    onMouseEnter={() => setActiveHover("thyroid_right_lobe")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 104,74 C 95,50 68,54 53,85 C 40,110 40,140 55,165 C 68,185 96,170 104,146 Z" 
                      fill={getColorForSVG("thyroid_right_lobe").fill}
                      stroke={getColorForSVG("thyroid_right_lobe").stroke}
                      strokeWidth={states.thyroid_right_lobe !== "normal" && states.thyroid_right_lobe !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.thyroid_right_lobe !== "normal" && states.thyroid_right_lobe !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="78" cy="120" r="3.5" fill="#81a1c1" />
                    <line x1="78" y1="120" x2="35" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* THYROID LEFT LOBE (Anatomical Left = Screen Right) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("thyroid_left_lobe")}
                    onMouseEnter={() => setActiveHover("thyroid_left_lobe")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 136,74 C 145,50 172,54 187,85 C 200,110 200,140 185,165 C 172,185 144,170 136,146 Z" 
                      fill={getColorForSVG("thyroid_left_lobe").fill}
                      stroke={getColorForSVG("thyroid_left_lobe").stroke}
                      strokeWidth={states.thyroid_left_lobe !== "normal" && states.thyroid_left_lobe !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.thyroid_left_lobe !== "normal" && states.thyroid_left_lobe !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="162" cy="120" r="3.5" fill="#81a1c1" />
                    <line x1="162" y1="120" x2="205" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* Large Vessels Background Hint */}
                  <g opacity="0.25">
                    {/* Right Carotid */}
                    <rect x="25" y="20" width="8" height="200" fill="#EF4444" rx="1" />
                    {/* Left Carotid */}
                    <rect x="207" y="20" width="8" height="200" fill="#EF4444" rx="1" />
                  </g>

                  {/* TEXT LABELS */}
                  <text x="78" y="44" fill="#64748b" fontSize="7" fontWeight="black" textAnchor="middle">DER</text>
                  <text x="162" y="44" fill="#64748b" fontSize="7" fontWeight="black" textAnchor="middle">IZQ</text>
                  
                  {/* Pin label texts (only if hovered or selected) */}
                  <text x="35" y="84" fill="#cbd5e1" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "thyroid_right_lobe" || activeHover === "thyroid_right_lobe" ? 1 : 0.4} fontWeight="bold">LÒB. DER</text>
                  <text x="205" y="84" fill="#cbd5e1" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "thyroid_left_lobe" || activeHover === "thyroid_left_lobe" ? 1 : 0.4} fontWeight="bold">LÒB. IZQ</text>
                  <text x="120" y="75" fill="#cbd5e1" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "thyroid_isthmus" || activeHover === "thyroid_isthmus" ? 1 : 0.4} fontWeight="bold">ISTMO</text>
                </svg>
              </div>
            )}

            {/* IMAGE 2: CERVICAL LEVELS & SALIVARY GLANDS MAP */}
            {(subViewMode === "dual" || subViewMode === "cervical") && (
              <div className="flex flex-col items-center w-full max-w-[240px]">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2 flex items-center gap-1 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  Glándulas y Niveles Ganglionares
                </div>
                
                <svg 
                  id="neck-anatomy-svg-glands"
                  viewBox="0 0 240 240" 
                  className="w-full max-w-[220px] h-auto drop-shadow-2xl"
                  style={{ maxHeight: "220px" }}
                >
                  {/* Mandible and chin silhouette outline (faint lines) */}
                  <path d="M 25,25 Q 120,80 215,25" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                  
                  {/* GLÁNDULAS PARÓTIDAS */}
                  {/* Right Parotid Gland (anatomical right = screen left) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("parotid_right")}
                    onMouseEnter={() => setActiveHover("parotid_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse 
                      cx="42" cy="55" rx="16" ry="24"
                      fill={getColorForSVG("parotid_right").fill}
                      stroke={getColorForSVG("parotid_right").stroke}
                      strokeWidth={states.parotid_right !== "normal" && states.parotid_right !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.parotid_right !== "normal" && states.parotid_right !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="42" cy="55" r="2.5" fill="#81a1c1" />
                    <text x="42" y="30" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "parotid_right" || activeHover === "parotid_right" ? 1 : 0.4} fontWeight="bold">PARÓTIDA D</text>
                  </g>

                  {/* Left Parotid Gland (anatomical left = screen right) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("parotid_left")}
                    onMouseEnter={() => setActiveHover("parotid_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse 
                      cx="198" cy="55" rx="16" ry="24"
                      fill={getColorForSVG("parotid_left").fill}
                      stroke={getColorForSVG("parotid_left").stroke}
                      strokeWidth={states.parotid_left !== "normal" && states.parotid_left !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.parotid_left !== "normal" && states.parotid_left !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="198" cy="55" r="2.5" fill="#81a1c1" />
                    <text x="198" y="30" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "parotid_left" || activeHover === "parotid_left" ? 1 : 0.4} fontWeight="bold">PARÓTIDA I</text>
                  </g>

                  {/* GLÁNDULAS SUBMANDIBULARES */}
                  {/* Right Submandibular (anatomical right = screen left) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("submandibular_right")}
                    onMouseEnter={() => setActiveHover("submandibular_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 60,78 C 72,78 80,95 72,102 C 64,106 50,100 52,86 Z"
                      fill={getColorForSVG("submandibular_right").fill}
                      stroke={getColorForSVG("submandibular_right").stroke}
                      strokeWidth={states.submandibular_right !== "normal" && states.submandibular_right !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.submandibular_right !== "normal" && states.submandibular_right !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="63" cy="91" r="2.5" fill="#81a1c1" />
                    <text x="63" y="114" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "submandibular_right" || activeHover === "submandibular_right" ? 1 : 0.4} fontWeight="bold">SUBMAND. D</text>
                  </g>

                  {/* Left Submandibular (anatomical left = screen right) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("submandibular_left")}
                    onMouseEnter={() => setActiveHover("submandibular_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 180,78 C 168,78 160,95 168,102 C 176,106 190,100 188,86 Z"
                      fill={getColorForSVG("submandibular_left").fill}
                      stroke={getColorForSVG("submandibular_left").stroke}
                      strokeWidth={states.submandibular_left !== "normal" && states.submandibular_left !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.submandibular_left !== "normal" && states.submandibular_left !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    <circle cx="177" cy="91" r="2.5" fill="#81a1c1" />
                    <text x="177" y="114" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "submandibular_left" || activeHover === "submandibular_left" ? 1 : 0.4} fontWeight="bold">SUBMAND. I</text>
                  </g>

                  {/* CADENAS GANGLIONARES (NIVELES I-VI) */}
                  {/* Right Cervical Nodes Chain */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("nodes_right")}
                    onMouseEnter={() => setActiveHover("nodes_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    {/* Node chain circles */}
                    <circle cx="58" cy="130" r="4.5" fill={getColorForSVG("nodes_right").fill} stroke={getColorForSVG("nodes_right").stroke} strokeWidth="1" />
                    <circle cx="68" cy="155" r="5" fill={getColorForSVG("nodes_right").fill} stroke={getColorForSVG("nodes_right").stroke} strokeWidth="1" />
                    <circle cx="80" cy="185" r="6" fill={getColorForSVG("nodes_right").fill} stroke={getColorForSVG("nodes_right").stroke} strokeWidth="1" />
                    <line x1="58" y1="130" x2="68" y2="155" stroke={getColorForSVG("nodes_right").stroke} strokeWidth="0.8" strokeDasharray="2,2" />
                    <line x1="68" y1="155" x2="80" y2="185" stroke={getColorForSVG("nodes_right").stroke} strokeWidth="0.8" strokeDasharray="2,2" />
                    <text x="45" y="158" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "nodes_right" || activeHover === "nodes_right" ? 1 : 0.4} fontWeight="bold">GANGLIOS D</text>
                  </g>

                  {/* Left Cervical Nodes Chain */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("nodes_left")}
                    onMouseEnter={() => setActiveHover("nodes_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    {/* Node chain circles */}
                    <circle cx="182" cy="130" r="4.5" fill={getColorForSVG("nodes_left").fill} stroke={getColorForSVG("nodes_left").stroke} strokeWidth="1" />
                    <circle cx="172" cy="155" r="5" fill={getColorForSVG("nodes_left").fill} stroke={getColorForSVG("nodes_left").stroke} strokeWidth="1" />
                    <circle cx="160" cy="185" r="6" fill={getColorForSVG("nodes_left").fill} stroke={getColorForSVG("nodes_left").stroke} strokeWidth="1" />
                    <line x1="182" y1="130" x2="172" y2="155" stroke={getColorForSVG("nodes_left").stroke} strokeWidth="0.8" strokeDasharray="2,2" />
                    <line x1="172" y1="155" x2="160" y2="185" stroke={getColorForSVG("nodes_left").stroke} strokeWidth="0.8" strokeDasharray="2,2" />
                    <text x="195" y="158" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "nodes_left" || activeHover === "nodes_left" ? 1 : 0.4} fontWeight="bold">GANGLIOS I</text>
                  </g>

                  {/* Large Vessels Evaluation Zone (Center lines) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("major_vessels")}
                    onMouseEnter={() => setActiveHover("major_vessels")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <line x1="90" y1="100" x2="114" y2="215" stroke={getColorForSVG("major_vessels").stroke} strokeWidth={states.major_vessels !== "normal" && states.major_vessels !== "no_descrito" ? "4" : "1.8"} opacity={states.major_vessels === "no_descrito" ? 0.3 : 0.8} />
                    <line x1="150" y1="100" x2="126" y2="215" stroke={getColorForSVG("major_vessels").stroke} strokeWidth={states.major_vessels !== "normal" && states.major_vessels !== "no_descrito" ? "4" : "1.8"} opacity={states.major_vessels === "no_descrito" ? 0.3 : 0.8} />
                    <text x="120" y="225" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "major_vessels" || activeHover === "major_vessels" ? 1 : 0.4} fontWeight="bold">VASOS PRINCIPALES</text>
                  </g>

                  {/* Muscle Layout Indicator */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("muscles_soft_tissues")}
                    onMouseEnter={() => setActiveHover("muscles_soft_tissues")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path d="M 24,110 L 45,215" stroke={getColorForSVG("muscles_soft_tissues").stroke} strokeWidth={states.muscles_soft_tissues !== "normal" && states.muscles_soft_tissues !== "no_descrito" ? "5" : "2"} opacity={states.muscles_soft_tissues === "no_descrito" ? 0.21 : 0.7} />
                    <path d="M 216,110 L 195,215" stroke={getColorForSVG("muscles_soft_tissues").stroke} strokeWidth={states.muscles_soft_tissues !== "normal" && states.muscles_soft_tissues !== "no_descrito" ? "5" : "2"} opacity={states.muscles_soft_tissues === "no_descrito" ? 0.21 : 0.7} />
                    <text x="120" y="200" fill="#64748b" fontSize="6.5" textAnchor="middle" opacity={selectedStructure === "muscles_soft_tissues" || activeHover === "muscles_soft_tissues" ? 1 : 0.4} fontWeight="bold">MÙSCULOS/TEJIDOS</text>
                  </g>
                </svg>
              </div>
            )}
          </div>

          <div className="w-full text-center mt-3">
            <p className="text-[10px] text-slate-500 italic max-w-md mx-auto">
              Haz clic en cualquier órgano o estructura anatómica en los diagramas de arriba para editar sus hallazgos, cambiar su severidad o actualizar su descripción clínica.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE EDITOR PANEL */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* SELECTOR DROPDOWN */}
          <div className="bg-slate-950/40 p-3.5 border border-slate-850/50 rounded-xl">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1.5 font-mono">
              Estructura Seleccionada:
            </label>
            <div className="relative">
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                {Object.values(structures).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {states[item.id] !== "no_descrito" ? "✓" : "∅"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              {structures[selectedStructure]?.description}
            </p>
          </div>

          {/* STATUS SELECTOR */}
          <div className="bg-slate-950/40 p-4 border border-slate-850/50 rounded-xl">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-2 font-mono">
              Evaluación y Hallazgo:
            </span>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                  states[selectedStructure] === "no_descrito"
                    ? "bg-slate-900 border-slate-700 text-slate-300 font-bold"
                    : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                }`}
              >
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                  Omitir del Reporte
                </span>
                {states[selectedStructure] === "no_descrito" && <Check className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              <button
                onClick={() => handleStateChange(selectedStructure, "normal")}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                  states[selectedStructure] === "normal"
                    ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 font-bold"
                    : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                }`}
              >
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Dentro de límites normales
                </span>
                {states[selectedStructure] === "normal" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              {/* SPECIFIC PATHOLOGY CHIPS depending on selected structure */}
              {selectedStructure.startsWith("thyroid") && (
                <>
                  <button
                    onClick={() => handleStateChange(selectedStructure, "nodulo_benigno")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "nodulo_benigno"
                        ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Nódulo Tiroideo Benigno
                    </span>
                    {states[selectedStructure] === "nodulo_benigno" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "nodulo_sospechoso")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "nodulo_sospechoso"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Nódulo Tiroideo Sospechoso
                    </span>
                    {states[selectedStructure] === "nodulo_sospechoso" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "bocio_multinodular")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "bocio_multinodular"
                        ? "bg-rose-950/40 border-rose-850/65 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Bocio Multinodular
                    </span>
                    {states[selectedStructure] === "bocio_multinodular" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "tiroiditis")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "tiroiditis"
                        ? "bg-rose-950/40 border-rose-850/65 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Tiroiditis / Alteración Difusa
                    </span>
                    {states[selectedStructure] === "tiroiditis" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>
                  {selectedStructure === "thyroid_isthmus" && (
                    <button
                      onClick={() => handleStateChange(selectedStructure, "engrosado")}
                      className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                        states[selectedStructure] === "engrosado"
                          ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                          : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-mono">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        Espesor Engrosado
                      </span>
                      {states[selectedStructure] === "engrosado" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  )}
                </>
              )}

              {(selectedStructure.includes("parotid") || selectedStructure.includes("submandibular")) && (
                <>
                  <button
                    onClick={() => handleStateChange(selectedStructure, "sialoadenitis")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "sialoadenitis"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Sialoadenitis inflamatoria
                    </span>
                    {states[selectedStructure] === "sialoadenitis" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "litiasis")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "litiasis"
                        ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Cálculo / Litiasis ductal
                    </span>
                    {states[selectedStructure] === "litiasis" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "quiste")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "quiste"
                        ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Quiste Anecoico
                    </span>
                    {states[selectedStructure] === "quiste" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "solido")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "solido"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Nódulo Sólido
                    </span>
                    {states[selectedStructure] === "solido" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>
                </>
              )}

              {selectedStructure.startsWith("nodes") && (
                <>
                  <button
                    onClick={() => handleStateChange(selectedStructure, "adenopatia_reactiva")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "adenopatia_reactiva"
                        ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Adenopatía Reactiva
                    </span>
                    {states[selectedStructure] === "adenopatia_reactiva" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "adenopatia_sospechosa")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "adenopatia_sospechosa"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Adenopatía Sospechosa
                    </span>
                    {states[selectedStructure] === "adenopatia_sospechosa" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "linfadenitis")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "linfadenitis"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Linfadenitis cervical
                    </span>
                    {states[selectedStructure] === "linfadenitis" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>
                </>
              )}

              {selectedStructure === "major_vessels" && (
                <>
                  <button
                    onClick={() => handleStateChange(selectedStructure, "placa_ateroma")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "placa_ateroma"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Placas de Ateroma
                    </span>
                    {states[selectedStructure] === "placa_ateroma" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "ectasia_yugular")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "ectasia_yugular"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Ectasia de Vena Yugular
                    </span>
                    {states[selectedStructure] === "ectasia_yugular" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>
                </>
              )}

              {selectedStructure === "muscles_soft_tissues" && (
                <>
                  <button
                    onClick={() => handleStateChange(selectedStructure, "contractura")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "contractura"
                        ? "bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Contractura / Espasmo
                    </span>
                    {states[selectedStructure] === "contractura" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => handleStateChange(selectedStructure, "masa_blanda")}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all border ${
                      states[selectedStructure] === "masa_blanda"
                        ? "bg-rose-950/40 border-rose-800/60 text-rose-300 font-bold"
                        : "bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Masa blanda (ej. Lipoma)
                    </span>
                    {states[selectedStructure] === "masa_blanda" && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* EDITABLE DETAILED DESCRIPTION */}
          <div className="bg-slate-950/40 p-4 border border-slate-850/50 rounded-xl flex flex-col gap-2">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 font-mono">
              Hallazgo Clínico Detallado:
            </label>
            <textarea
              value={customDescriptions[selectedStructure] || ""}
              onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: e.target.value }))}
              placeholder="Escribe la descripción concisa del hallazgo en el examen..."
              disabled={states[selectedStructure] === "no_descrito"}
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed font-medium text-slate-200"
            />
          </div>

          {/* ACTION FOOTER */}
          <div className="flex gap-2">
            <button
              onClick={triggerExport}
              disabled={badges.empty === 11}
              className="flex-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-40"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Inyectar Tabla (Sinopsis)
            </button>
          </div>
        </div>
      </div>

      {syncLogs.length > 0 && (
        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <details className="group">
            <summary className="list-none flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 hover:text-slate-400 cursor-pointer select-none">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-400" />
                Auditoría NLP: Cuello y Tiroides ({syncLogs.length} notas)
              </span>
              <span className="text-[9px] group-open:hidden">Mostrar ▼</span>
              <span className="text-[9px] hidden group-open:inline">Ocultar ▲</span>
            </summary>
            
            <div className="mt-2.5 max-h-[140px] overflow-y-auto bg-slate-950/70 border border-slate-850/80 rounded-xl p-3 font-mono text-[9px] text-slate-400 leading-relaxed uppercase space-y-1.5 custom-scrollbar">
              {syncLogs.map((log, index) => (
                <div key={index} className="border-b border-slate-900/50 pb-1.5 last:border-0 last:pb-0">
                  {log}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
