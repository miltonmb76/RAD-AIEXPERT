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
  Download,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sliders,
  CheckSquare,
  Square
} from "lucide-react";

interface NeonatalBrainAnatomyViewerProps {
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

interface NeonatalBrainStructure {
  id: string;
  name: string;
  description: string;
  category: "ventricles" | "plexus" | "matrix" | "parenchyma" | "extraaxial";
}

export default function NeonatalBrainAnatomyViewer({
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
}: NeonatalBrainAnatomyViewerProps) {
  
  // Neonatal brain structures keys
  const initialKeys = [
    "ventricle_right",
    "ventricle_left",
    "ventricle_third_fourth",
    "choroid_right",
    "choroid_left",
    "germinal_right",
    "germinal_left",
    "parenchyma_periventricular_right",
    "parenchyma_periventricular_left",
    "parenchyma_focal_right",
    "parenchyma_focal_left",
    "subarachnoid_space"
  ];

  const [states, setStates] = useState<Record<string, string>>({
    ventricle_right: "no_descrito",
    ventricle_left: "no_descrito",
    ventricle_third_fourth: "no_descrito",
    choroid_right: "no_descrito",
    choroid_left: "no_descrito",
    germinal_right: "no_descrito",
    germinal_left: "no_descrito",
    parenchyma_periventricular_right: "no_descrito",
    parenchyma_periventricular_left: "no_descrito",
    parenchyma_focal_right: "no_descrito",
    parenchyma_focal_left: "no_descrito",
    subarachnoid_space: "no_descrito"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    ventricle_right: "",
    ventricle_left: "",
    ventricle_third_fourth: "",
    choroid_right: "",
    choroid_left: "",
    germinal_right: "",
    germinal_left: "",
    parenchyma_periventricular_right: "",
    parenchyma_periventricular_left: "",
    parenchyma_focal_right: "",
    parenchyma_focal_left: "",
    subarachnoid_space: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("ventricle_right");
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
      case "ventricle_right":
        return [
          "ventriculo lateral derecho", "ventrículo lateral derecho", 
          "vld", "ventriculos laterales", "ventrículos laterales", "asta frontal derecha", "asta occipital derecha"
        ];
      case "ventricle_left":
        return [
          "ventriculo lateral izquierdo", "ventrículo lateral izquierdo", 
          "vli", "ventriculos laterales", "ventrículos laterales", "asta frontal izquierda", "asta occipital izquierda"
        ];
      case "ventricle_third_fourth":
        return [
          "tercer ventriculo", "tercer ventrículo", "cuarto ventriculo", "cuarto ventrículo", 
          "iii ventriculo", "iii ventrículo", "iv ventriculo", "iv ventrículo", "linea media"
        ];
      case "choroid_right":
        return [
          "plexo coroideo derecho", "plexos coroideos derechos", "plexo coroide derecho", 
          "plexo derecho", "plexos coroideos"
        ];
      case "choroid_left":
        return [
          "plexo coroideo izquierdo", "plexos coroideos izquierdos", "plexo coroide izquierdo", 
          "plexo izquierdo", "plexos coroideos"
        ];
      case "germinal_right":
        return [
          "surco caudotalamico derecho", "surco caudotalámico derecho", "matriz germinal derecha", 
          "zona germinal derecha", "ganglio basal derecho", "caudado derecho"
        ];
      case "germinal_left":
        return [
          "surco caudotalamico izquierdo", "surco caudotalámico izquierdo", "matriz germinal izquierda", 
          "zona germinal izquierda", "ganglio basal izquierdo", "caudado izquierdo"
        ];
      case "parenchyma_periventricular_right":
        return [
          "parenquima periventricular derecho", "parénquima periventricular derecho", "sustancia blanca periventricular derecha", 
          "halo periventricular derecho", "ecogenicidad periventricular derecha"
        ];
      case "parenchyma_periventricular_left":
        return [
          "parenquima periventricular izquierdo", "parénquima periventricular izquierdo", "sustancia blanca periventricular izquierda", 
          "halo periventricular izquierdo", "ecogenicidad periventricular izquierda"
        ];
      case "parenchyma_focal_right":
        return [
          "parenquima lobar derecho", "parénquima derecho", "hemisferio cerebral derecho", 
          "lobulo derecho", "lóbulo derecho", "fosa posterior derecha", "cerebelo derecho"
        ];
      case "parenchyma_focal_left":
        return [
          "parenquima lobar izquierdo", "parénquima izquierdo", "hemisferio cerebral izquierdo", 
          "lobulo izquierdo", "lóbulo izquierdo", "fosa posterior izquierda", "cerebelo izquierdo"
        ];
      case "subarachnoid_space":
        return [
          "espacio subaracnoideo", "cisterna magna", "cisternas", "espacio extraaxial", 
          "fisura interhemisferica", "fisura interhemisférica", "surcos corticales"
        ];
      default:
        return [];
    }
  };

  const getSimplifiedDescription = (id: string, stateInput?: string) => {
    const s = stateInput || states[id] || "no_descrito";
    if (s === "no_descrito") {
      return "No mencionado / No descrito.";
    }
    if (s === "normal") {
      return "Dentro de límites normales.";
    }

    // Ventricles
    if (id.startsWith("ventricle_right") || id.startsWith("ventricle_left")) {
      if (s === "dilatacion_leve") return "Dilatación ventricular leve (diámetro levemente aumentado).";
      if (s === "dilatacion_moderada_severa") return "Dilatación ventricular moderada a severa (hidrocefalia franca).";
      if (s === "hemorragia_intraventricular_sin_dilatacion") return "Hemorragia intraventricular (Grado II) sin dilatación asociada.";
      if (s === "hemorragia_intraventricular_con_dilatacion") return "Hemorragia intraventricular (Grado III) con dilatación ventricular.";
    }
    if (id === "ventricle_third_fourth") {
      if (s === "dilatacion") return "Dilatación del tercer y/o cuarto ventrículo.";
    }

    // Choroids
    if (id.startsWith("choroid")) {
      if (s === "congestion_hemorragica") return "Congestión/engrosamiento hemorrágico del plexo coroideo.";
      if (s === "quiste_plexo") return "Quiste del plexo coroideo, hallazgo habitualmente benigno.";
    }

    // Germinal Matrix
    if (id.startsWith("germinal")) {
      if (s === "hemorragia_subependimaria_g1") return "Hemorragia subependimaria (Grado I) confinada a la matriz germinal.";
      if (s === "quiste_subependimario") return "Quiste subependimario residual (secuela de sangrado previo).";
    }

    // Periventricular Parenchyma
    if (id.startsWith("parenchyma_periventricular")) {
      if (s === "leucomalacia_periventricular_leve") return "Aumento de ecogenicidad periventricular difuso, sugerente de leucomalacia periventricular (LPV) Grado I.";
      if (s === "leucomalacia_periventricular_cavitaria") return "Leucomalacia periventricular cavitaria residual (quistes subcorticales bilaterales).";
      if (s === "calcificaciones") return "Calcificaciones puntiformes en la sustancia blanca periventricular.";
    }

    // Focal Parenchyma
    if (id.startsWith("parenchyma_focal")) {
      if (s === "hemorragia_intraparenquimatosa_g4") return "Hemorragia intraparenquimatosa unilateral (Grado IV - infarto hemorrágico venoso).";
      if (s === "calcificaciones_focales") return "Calcificaciones focales parenquimatosas sugerentes de etiología infecciosa (TORCH).";
      if (s === "edema_difuso") return "Edema cerebral difuso con colapso de surcos y ventrículos.";
    }

    // Subarachnoid Space
    if (id === "subarachnoid_space") {
      if (s === "dilatacion_benigna") return "Dilatación benigna del espacio subaracnoideo (hidrocefalia externa benigna).";
      if (s === "coleccion_extraaxial") return "Colección líquida extraaxial o engrosamiento meningeo focal.";
    }

    return "Hallazgo patológico descrito.";
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis con heurísticas locales para transfontanelar neonatal...");
    const textLower = generatedReport.toLowerCase();
    
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    const structureKeys = Object.keys(states);

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado / No descrito.";
        return;
      }

      // Check if specifically declared normal
      const isNormal = [
        "normal", "conservado", "conservada", "homogéneo", "homogénea", "homogeneo", "homogenea",
        "sin alteraciones", "morfología habitual", "aspecto habitual", "adecuado", "adecuada",
        "sin evidencia de nódulos", "dentro de límites normales", "limites normales", "no dilatado", "no dilatados",
        "simétricos", "simetricos", "calibre conservado", "sin colecciones", "sin coleccion"
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
      }

      // Deep heuristic scanning
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      const sideStr = id.includes("right") || id.endsWith("right") ? "derech" : id.includes("left") || id.endsWith("left") ? "izquierd" : "ambos";

      if (id.startsWith("ventricle_right") || id.startsWith("ventricle_left")) {
        const hasDila = textLower.includes("dilat") || textLower.includes("hidrocef") || textLower.includes("aumentado de tamaño") || textLower.includes("ventriculomegalia");
        const hasHemorragia = textLower.includes("hemorragia") || textLower.includes("hgv") || textLower.includes("sangrado") || textLower.includes("hiv");
        const isRight = id.includes("right");

        // check lateralized keywords
        const sideMatches = sideStr === "ambos" || 
          (isRight && (textLower.includes("derech") || textLower.includes("vld") || textLower.includes("ld"))) ||
          (!isRight && (textLower.includes("izquierd") || textLower.includes("vli") || textLower.includes("li"))) ||
          textLower.includes("bilateral") || textLower.includes("ambos");

        if (sideMatches) {
          if (hasHemorragia && hasDila) {
            detectedState = "hemorragia_intraventricular_con_dilatacion";
            desc = "Hemorragia intraventricular con dilatación ventricular secundaria (Grado III).";
          } else if (hasHemorragia) {
            detectedState = "hemorragia_intraventricular_sin_dilatacion";
            desc = "Hemorragia intraventricular sin dilatación (Grado II).";
          } else if (hasDila) {
            if (textLower.includes("sever") || textLower.includes("moderad")) {
              detectedState = "dilatacion_moderada_severa";
              desc = "Dilatación ventricular moderada a severa (hidrocefalia franca).";
            } else {
              detectedState = "dilatacion_leve";
              desc = "Dilatación ventricular leve (ventriculomegalia leve).";
            }
          }
        }
      } else if (id === "ventricle_third_fourth") {
        if (textLower.includes("tercer") || textLower.includes("cuarto") || textLower.includes("linea media")) {
          if (textLower.includes("dilat") || textLower.includes("hidrocef") || textLower.includes("ampliado")) {
            detectedState = "dilatacion";
            desc = "Tercer y/o cuarto ventrículos dilatados.";
          }
        }
      } else if (id.startsWith("choroid")) {
        const isRight = id.includes("right");
        const sideMatches = (isRight && textLower.includes("derech")) || (!isRight && textLower.includes("izquierd")) || textLower.includes("bilateral") || textLower.includes("ambos");
        if (sideMatches) {
          if (textLower.includes("quiste") || textLower.includes("quístico")) {
            detectedState = "quiste_plexo";
            desc = "Quiste del plexo coroideo.";
          } else if (textLower.includes("congestion") || textLower.includes("hemorrag") || textLower.includes("engrosado") || textLower.includes("irregular")) {
            detectedState = "congestion_hemorragica";
            desc = "Congestión o irregularidad hemorrágica del plexo coroideo.";
          }
        }
      } else if (id.startsWith("germinal")) {
        const isRight = id.includes("right");
        const sideMatches = (isRight && textLower.includes("derech")) || (!isRight && textLower.includes("izquierd")) || textLower.includes("bilateral") || textLower.includes("ambos");
        if (sideMatches) {
          if (textLower.includes("hemorrag") || textLower.includes("sangrado") || textLower.includes("grado i") || textLower.includes("grado 1") || textLower.includes("subependimar")) {
            detectedState = "hemorragia_subependimaria_g1";
            desc = "Hemorragia subependimaria de la matriz germinal (Grado I).";
          } else if (textLower.includes("quiste") || textLower.includes("cavidad")) {
            detectedState = "quiste_subependimario";
            desc = "Quiste subependimario de matriz germinal.";
          }
        }
      } else if (id.startsWith("parenchyma_periventricular")) {
        const isRight = id.includes("right");
        const sideMatches = (isRight && textLower.includes("derech")) || (!isRight && textLower.includes("izquierd")) || textLower.includes("bilateral") || textLower.includes("ambos");
        if (sideMatches) {
          if (textLower.includes("calcificaci")) {
            detectedState = "calcificaciones";
            desc = "Calcificaciones periventriculares de aspecto secuelar/infeccioso.";
          } else if (textLower.includes("leucomalacia") || textLower.includes("ecogenic") || textLower.includes("quiste periventricular")) {
            if (textLower.includes("quiste") || textLower.includes("cavit") || textLower.includes("sever")) {
              detectedState = "leucomalacia_periventricular_cavitaria";
              desc = "Leucomalacia periventricular cavitaria (LPV quística).";
            } else {
              detectedState = "leucomalacia_periventricular_leve";
              desc = "Leucomalacia periventricular leve (aumento de ecogenicidad periventricular).";
            }
          }
        }
      } else if (id.startsWith("parenchyma_focal")) {
        const isRight = id.includes("right");
        const sideMatches = (isRight && textLower.includes("derech")) || (!isRight && textLower.includes("izquierd")) || textLower.includes("bilateral") || textLower.includes("ambos");
        if (sideMatches) {
          if (textLower.includes("hemorrag") && (textLower.includes("grado iv") || textLower.includes("grado 4") || textLower.includes("intraparenquimatosa"))) {
            detectedState = "hemorragia_intraparenquimatosa_g4";
            desc = "Hemorragia intraparenquimatosa masiva (infarto hemorrágico Grado IV).";
          } else if (textLower.includes("calcificaci")) {
            detectedState = "calcificaciones_focales";
            desc = "Calcificaciones parenquimatosas focales.";
          } else if (textLower.includes("edema") || textLower.includes("colapso")) {
            detectedState = "edema_difuso";
            desc = "Edema cerebral difuso con compresión de surcos y cavidades.";
          }
        }
      } else if (id === "subarachnoid_space") {
        if (textLower.includes("espacio subaracnoideo") || textLower.includes("fisura interhemisferica") || textLower.includes("extraaxial")) {
          if (textLower.includes("coleccion") || textLower.includes("colección") || textLower.includes("hematoma")) {
            detectedState = "coleccion_extraaxial";
            desc = "Colección líquida extraaxial o hematoma subdural residual.";
          } else if (textLower.includes("dilat") || textLower.includes("aumentado") || textLower.includes("ancho")) {
            detectedState = "dilatacion_benigna";
            desc = "Dilatación benigna del espacio subaracnoideo (hidrocefalia externa).";
          }
        }
      }

      if (detectedState !== "normal" || isMentioned) {
        nextStates[id] = detectedState;
        nextDescriptions[id] = desc;
        logs.push(`[Heurística] ${id}: ${detectedState.toUpperCase()}`);
      }
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
    logs.push(`Iniciando extracción con IA de estructuras cerebrales neonatales (${generatedReport.length} caracteres)...`);

    const structuresList = [
      { id: "ventricle_right", label: "Ventrículo Lateral Derecho", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
      { id: "ventricle_left", label: "Ventrículo Lateral Izquierdo", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
      { id: "ventricle_third_fourth", label: "Tercer y Cuarto Ventrículo", allowedStates: ["no_descrito", "normal", "dilatacion"] },
      { id: "choroid_right", label: "Plexo Coroideo Derecho", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
      { id: "choroid_left", label: "Plexo Coroideo Izquierdo", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
      { id: "germinal_right", label: "Surco Caudotalámico Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
      { id: "germinal_left", label: "Surco Caudotalámico Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
      { id: "parenchyma_periventricular_right", label: "Parénquima Periventricular Derecho", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
      { id: "parenchyma_periventricular_left", label: "Parénquima Periventricular Izquierdo", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
      { id: "parenchyma_focal_right", label: "Parénquima Lobar Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
      { id: "parenchyma_focal_left", label: "Parénquima Lobar Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
      { id: "subarachnoid_space", label: "Espacio Subaracnoideo y Cisternas", allowedStates: ["no_descrito", "normal", "dilatacion_benigna", "coleccion_extraaxial"] }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.6-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido Transfontanelar Cerebral Neonatal",
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
        logs.push(`Análisis transfontanelar finalizado con IA. Sincronizadas ${parsedCount} estructuras cerebrales (${foundPathologies} patologías detectadas).`);
      } else {
        logs.push(`[Error API] Fallo al sincronizar. Ejecutando análisis heurístico local.`);
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía transfontanelar:", err);
      logs.push(`[Error de red] ${err.message || String(err)}. Ejecutando análisis heurístico local.`);
      runLocalHeuristics(logs);
    } finally {
      setIsSyncing(false);
      setSyncLogs(prev => [...prev, ...logs]);
    }
  };

  const getColorForSVG = (id: string) => {
    const s = states[id] || "no_descrito";
    const isHovered = activeHover === id || selectedStructure === id;

    if (s === "no_descrito") {
      return {
        fill: isHovered ? "#1e293b" : "rgba(15, 23, 42, 0.45)",
        stroke: isHovered ? "#64748b" : "#334155"
      };
    }
    if (s === "normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.15)",
        stroke: "#10b981"
      };
    }
    // Pathologies
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.6)" : "rgba(244, 63, 94, 0.3)",
      stroke: "#f43f5e"
    };
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
    let md = `| Estructura Cerebral Neonatal | Detalle / Descripción de Hallazgos Clínicos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "ventricle_right", label: "Ventrículo Lateral Derecho" },
      { id: "ventricle_left", label: "Ventrículo Lateral Izquierdo" },
      { id: "ventricle_third_fourth", label: "Tercer y Cuarto Ventrículo" },
      { id: "choroid_right", label: "Plexo Coroideo Derecho" },
      { id: "choroid_left", label: "Plexo Coroideo Izquierdo" },
      { id: "germinal_right", label: "Surco Caudotalámico Derecho" },
      { id: "germinal_left", label: "Surco Caudotalámico Izquierdo" },
      { id: "parenchyma_periventricular_right", label: "Parénquima Periventricular Derecho" },
      { id: "parenchyma_periventricular_left", label: "Parénquima Periventricular Izquierdo" },
      { id: "parenchyma_focal_right", label: "Parénquima Lobar Derecho" },
      { id: "parenchyma_focal_left", label: "Parénquima Lobar Izquierdo" },
      { id: "subarachnoid_space", label: "Espacio Subaracnoideo y Cisternas" }
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
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras cerebrales neonatales se reportan sin alteraciones.* |\n`;
    }

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
      setCustomDescriptions(prev => ({ ...prev, [id]: getSimplifiedDescription(id, s) }));
    }
  };

  const bulkAction = (action: "normal" | "no_descrito") => {
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    initialKeys.forEach(key => {
      nextStates[key] = action;
      if (action === "no_descrito") {
        nextDescriptions[key] = "No mencionado / No descrito.";
      } else {
        nextDescriptions[key] = "Dentro de límites normales.";
      }
    });

    setStates(nextStates);
    setCustomDescriptions(nextDescriptions);
  };

  const badges = getBadgesCount();

  const structures: Record<string, NeonatalBrainStructure> = {
    ventricle_right: { id: "ventricle_right", category: "ventricles", name: "Ventrículo Lateral Der.", description: "Asta frontal, cuerpo y asta occipital del ventrículo lateral derecho." },
    ventricle_left: { id: "ventricle_left", category: "ventricles", name: "Ventrículo Lateral Izq.", description: "Asta frontal, cuerpo y asta occipital del ventrículo lateral izquierdo." },
    ventricle_third_fourth: { id: "ventricle_third_fourth", category: "ventricles", name: "3er y 4to Ventrículo", description: "Ventrículos mediales de la línea media y de fosa posterior." },
    choroid_right: { id: "choroid_right", category: "plexus", name: "Plexo Coroideo Der.", description: "Tejido vascular intraventricular derecho productor de LCR." },
    choroid_left: { id: "choroid_left", category: "plexus", name: "Plexo Coroideo Izq.", description: "Tejido vascular intraventricular izquierdo productor de LCR." },
    germinal_right: { id: "germinal_right", category: "matrix", name: "Matriz Germinal / Surco CTD", description: "Surco caudotalámico derecho, zona altamente propensa a hemorragia subependimaria (Grado I)." },
    germinal_left: { id: "germinal_left", category: "matrix", name: "Matriz Germinal / Surco CTI", description: "Surco caudotalámico izquierdo, zona altamente propensa a hemorragia subependimaria (Grado I)." },
    parenchyma_periventricular_right: { id: "parenchyma_periventricular_right", category: "parenchyma", name: "Periventricular Derecho", description: "Sustancia blanca que rodea el ventrículo lateral derecho, susceptible a leucomalacia." },
    parenchyma_periventricular_left: { id: "parenchyma_periventricular_left", category: "parenchyma", name: "Periventricular Izquierdo", description: "Sustancia blanca que rodea el ventrículo lateral izquierdo, susceptible a leucomalacia." },
    parenchyma_focal_right: { id: "parenchyma_focal_right", category: "parenchyma", name: "Parénquima Lobar Der.", description: "Corteza lobar y núcleos grises profundos del hemisferio derecho." },
    parenchyma_focal_left: { id: "parenchyma_focal_left", category: "parenchyma", name: "Parénquima Lobar Izq.", description: "Corteza lobar y núcleos grises profundos del hemisferio izquierdo." },
    subarachnoid_space: { id: "subarachnoid_space", category: "extraaxial", name: "Espacio Extraaxial", description: "Espacio subaracnoideo, fisura interhemisférica y cisternas basales." }
  };

  return (
    <div id="neonatal-brain-viewer-root" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8 shadow-2xl relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity id="neonatal-brain-activity-icon" className="w-4 h-4 animate-pulse" />
            </span>
            <h3 id="neonatal-brain-viewer-title" className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Anexo Interactivo: Ultrasonido Cerebral Neonatal (Transfontanelar)
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Protocolo transfontanelar interactivo para la detección de hemorragias ventriculares, hidrocefalia, leucomalacia periventricular y calcificaciones.
          </p>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Badge indicator */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800/80 rounded-xl px-2.5 py-1 text-[10px] gap-2 font-mono">
            <span className="flex items-center gap-1 text-rose-450 font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
              {badges.pathological} Alterados
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              {badges.normal} Normales
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-slate-500">
              {badges.empty} Omitidos
            </span>
          </div>

          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-indigo-50 px-3 py-1.5 text-xs rounded-xl font-bold transition-all shadow-md disabled:opacity-40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: isSyncing ? "1.5s" : "0s" }} />
            {isSyncing ? "Analizando..." : "Sincronizar IA"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: DIAGRAM INTERACTION */}
        <div className="lg:col-span-6 bg-slate-950/55 border border-slate-850/50 rounded-xl p-4 flex flex-col items-center">
          <div className="text-[10px] uppercase font-bold font-mono tracking-wider mb-2 text-slate-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Vista Coronal Transfontanelar Esquematizada
          </div>
          
          <div className="relative w-full max-w-[280px] h-[220px] flex items-center justify-center bg-slate-900/40 rounded-xl border border-slate-800/40">
            <svg 
              id="neonatal-brain-anatomy-svg"
              viewBox="0 0 300 240" 
              className="w-full h-full drop-shadow-2xl"
            >
              {/* Outer Skull Line / Espacio subaracnoideo background */}
              <path 
                d="M 50,200 C 30,120 70,40 150,40 C 230,40 270,120 250,200 Z" 
                fill={getColorForSVG("subarachnoid_space").fill}
                stroke={getColorForSVG("subarachnoid_space").stroke}
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("subarachnoid_space")}
                onMouseEnter={() => setActiveHover("subarachnoid_space")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Interhemispheric fissure (vertical midline split indicator) */}
              <line x1="150" y1="40" x2="150" y2="200" stroke="#1e293b" strokeWidth="2.5" strokeDasharray="3,3" opacity="0.5" />

              {/* Hemisferios Parenquima Lobar (Outer parenchymal areas) */}
              {/* RIGHT LOBE (patient's right is screen's left) */}
              <path 
                d="M 148,45 C 80,45 45,115 60,195 C 90,195 120,180 148,160 Z"
                fill={getColorForSVG("parenchyma_focal_right").fill}
                stroke={getColorForSVG("parenchyma_focal_right").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("parenchyma_focal_right")}
                onMouseEnter={() => setActiveHover("parenchyma_focal_right")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* LEFT LOBE (patient's left is screen's right) */}
              <path 
                d="M 152,45 C 220,45 255,115 240,195 C 210,195 180,180 152,160 Z"
                fill={getColorForSVG("parenchyma_focal_left").fill}
                stroke={getColorForSVG("parenchyma_focal_left").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("parenchyma_focal_left")}
                onMouseEnter={() => setActiveHover("parenchyma_focal_left")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* PERIVENTRICULAR PARENCHYMA (Sustancia Blanca) */}
              {/* Right Side Periventricular */}
              <path 
                d="M 148,80 C 110,80 90,110 95,145 C 115,145 130,135 148,130 Z"
                fill={getColorForSVG("parenchyma_periventricular_right").fill}
                stroke={getColorForSVG("parenchyma_periventricular_right").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("parenchyma_periventricular_right")}
                onMouseEnter={() => setActiveHover("parenchyma_periventricular_right")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Left Side Periventricular */}
              <path 
                d="M 152,80 C 190,80 210,110 205,145 C 185,145 170,135 152,130 Z"
                fill={getColorForSVG("parenchyma_periventricular_left").fill}
                stroke={getColorForSVG("parenchyma_periventricular_left").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("parenchyma_periventricular_left")}
                onMouseEnter={() => setActiveHover("parenchyma_periventricular_left")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* LATERAL VENTRICLES (Ventrículos Laterales) */}
              {/* Ventriculo Lateral Derecho (Viewer's Left) */}
              <path 
                d="M 145,95 Q 115,100 120,125 Q 135,120 145,115 Z"
                fill={getColorForSVG("ventricle_right").fill}
                stroke={getColorForSVG("ventricle_right").stroke}
                strokeWidth="1.8"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("ventricle_right")}
                onMouseEnter={() => setActiveHover("ventricle_right")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Ventriculo Lateral Izquierdo (Viewer's Right) */}
              <path 
                d="M 155,95 Q 185,100 180,125 Q 165,120 155,115 Z"
                fill={getColorForSVG("ventricle_left").fill}
                stroke={getColorForSVG("ventricle_left").stroke}
                strokeWidth="1.8"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("ventricle_left")}
                onMouseEnter={() => setActiveHover("ventricle_left")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* PLEXOS COROIDEOS (Inside Ventricles) */}
              {/* Plexo Coroideo Derecho */}
              <path 
                d="M 125,112 Q 130,110 135,115 Q 132,118 127,117 Z"
                fill={getColorForSVG("choroid_right").fill}
                stroke={getColorForSVG("choroid_right").stroke}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("choroid_right")}
                onMouseEnter={() => setActiveHover("choroid_right")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Plexo Coroideo Izquierdo */}
              <path 
                d="M 175,112 Q 170,110 165,115 Q 168,118 173,117 Z"
                fill={getColorForSVG("choroid_left").fill}
                stroke={getColorForSVG("choroid_left").stroke}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("choroid_left")}
                onMouseEnter={() => setActiveHover("choroid_left")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* GERMINAL MATRIX / SURCO CAUDOTALAMICO */}
              {/* Surco Caudotalamico Derecho (Near ventricle corner) */}
              <circle 
                cx="122" 
                cy="130" 
                r="6"
                fill={getColorForSVG("germinal_right").fill}
                stroke={getColorForSVG("germinal_right").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("germinal_right")}
                onMouseEnter={() => setActiveHover("germinal_right")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Surco Caudotalamico Izquierdo */}
              <circle 
                cx="178" 
                cy="130" 
                r="6"
                fill={getColorForSVG("germinal_left").fill}
                stroke={getColorForSVG("germinal_left").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("germinal_left")}
                onMouseEnter={() => setActiveHover("germinal_left")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* TERCER Y CUARTO VENTRICULO (Medial Lower Cavities) */}
              <path 
                d="M 146,135 L 154,135 L 154,155 L 146,155 Z M 144,170 Q 150,165 156,170 Q 150,185 144,170 Z"
                fill={getColorForSVG("ventricle_third_fourth").fill}
                stroke={getColorForSVG("ventricle_third_fourth").stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("ventricle_third_fourth")}
                onMouseEnter={() => setActiveHover("ventricle_third_fourth")}
                onMouseLeave={() => setActiveHover(null)}
              />

              {/* Text indicator for laterality */}
              <text x="30" y="225" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="monospace">DER (Paciente)</text>
              <text x="210" y="225" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="monospace">IZQ (Paciente)</text>
            </svg>

            {/* Hover overlay text */}
            {activeHover && structures[activeHover] && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-slate-950/90 border border-indigo-500/30 text-indigo-200 text-[10px] py-1 px-2.5 rounded-lg shadow-xl pointer-events-none font-sans font-bold uppercase tracking-wider">
                {structures[activeHover].name}
              </div>
            )}
          </div>

          {/* Quick Bulk Settings */}
          <div className="flex gap-2 w-full mt-4 justify-center">
            <button
              onClick={() => bulkAction("normal")}
              className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-all"
            >
              Todo Normal
            </button>
            <button
              onClick={() => bulkAction("no_descrito")}
              className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
            >
              Todo Omitido
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED CONTROLS */}
        <div className="lg:col-span-6 flex flex-col h-full justify-between">
          
          {/* STRUCTURE SELECTOR & FINDINGS SECTOR */}
          <div className="bg-slate-950/45 border border-slate-850/50 rounded-xl p-4 mb-4">
            <div className="flex flex-col gap-2 mb-3">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                Seleccionar Estructura Anatómica:
              </label>
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <optgroup label="Sistema Ventricular" className="bg-slate-900 font-bold text-slate-400">
                  <option value="ventricle_right" className="text-slate-100 font-bold">Ventrículo Lateral Derecho (VLD)</option>
                  <option value="ventricle_left" className="text-slate-100 font-bold">Ventrículo Lateral Izquierdo (VLI)</option>
                  <option value="ventricle_third_fourth" className="text-slate-100 font-bold">Tercer y Cuarto Ventrículo</option>
                </optgroup>
                <optgroup label="Plexos Coroideos" className="bg-slate-900 font-bold text-slate-400">
                  <option value="choroid_right" className="text-slate-100 font-bold">Plexo Coroideo Derecho</option>
                  <option value="choroid_left" className="text-slate-100 font-bold">Plexo Coroideo Izquierdo</option>
                </optgroup>
                <optgroup label="Surco Caudotalámico / Matriz" className="bg-slate-900 font-bold text-slate-400">
                  <option value="germinal_right" className="text-slate-100 font-bold">Matriz Germinal / Surco CTD</option>
                  <option value="germinal_left" className="text-slate-100 font-bold">Matriz Germinal / Surco CTI</option>
                </optgroup>
                <optgroup label="Parénquima y Sustancia Blanca" className="bg-slate-900 font-bold text-slate-400">
                  <option value="parenchyma_periventricular_right" className="text-slate-100 font-bold">Parénquima Periventricular Der.</option>
                  <option value="parenchyma_periventricular_left" className="text-slate-100 font-bold">Parénquima Periventricular Izq.</option>
                  <option value="parenchyma_focal_right" className="text-slate-100 font-bold">Parénquima Lobar / Hemisferio Der.</option>
                  <option value="parenchyma_focal_left" className="text-slate-100 font-bold">Parénquima Lobar / Hemisferio Izq.</option>
                </optgroup>
                <optgroup label="Espacios Extraaxiales" className="bg-slate-900 font-bold text-slate-400">
                  <option value="subarachnoid_space" className="text-slate-100 font-bold">Espacio Subaracnoideo y Cisternas</option>
                </optgroup>
              </select>
            </div>

            {/* Current Selected details info */}
            {selectedStructure && structures[selectedStructure] && (
              <div className="border-t border-slate-900 pt-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-black text-slate-200">{structures[selectedStructure].name}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-3">
                  {structures[selectedStructure].description}
                </p>

                {/* State Options selector */}
                <div className="space-y-2 mb-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Hallazgo Clínico / Estado:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                      className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "no_descrito" ? "bg-slate-950 border-slate-700 text-slate-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-400"}`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>OMITIR / DESACTIVADO</span>
                    </button>
                    <button
                      onClick={() => handleStateChange(selectedStructure, "normal")}
                      className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "normal" ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-emerald-400"}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>NORMAL / SANO</span>
                    </button>

                    {/* Ventricles specific pathological options */}
                    {(selectedStructure.startsWith("ventricle_right") || selectedStructure.startsWith("ventricle_left")) && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "dilatacion_leve")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "dilatacion_leve" ? "bg-rose-950/35 border-rose-500/40 text-rose-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>DILATACIÓN LEVE</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "dilatacion_moderada_severa")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "dilatacion_moderada_severa" ? "bg-rose-950/35 border-rose-500/40 text-rose-400 font-bold animate-pulse" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-400"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>HIDROCEFALIA MOD-SEV</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "hemorragia_intraventricular_sin_dilatacion")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "hemorragia_intraventricular_sin_dilatacion" ? "bg-rose-950/35 border-rose-500/40 text-rose-450 font-bold" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <Activity className="w-3.5 h-3.5 text-rose-500" />
                          <span>HEM. INTRAVENT. G-II</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "hemorragia_intraventricular_con_dilatacion")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "hemorragia_intraventricular_con_dilatacion" ? "bg-rose-950/35 border-rose-500/50 text-rose-450 font-black" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>HEM. INTRAVENT. G-III</span>
                        </button>
                      </>
                    )}

                    {/* Third Fourth Ventricle pathology */}
                    {selectedStructure === "ventricle_third_fourth" && (
                      <button
                        onClick={() => handleStateChange(selectedStructure, "dilatacion")}
                        className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "dilatacion" ? "bg-rose-950/35 border-rose-500/40 text-rose-450" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>DILATACIÓN VENTRICULAR</span>
                      </button>
                    )}

                    {/* Choroids specific pathological options */}
                    {selectedStructure.startsWith("choroid") && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "congestion_hemorragica")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "congestion_hemorragica" ? "bg-rose-950/35 border-rose-500/40 text-rose-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>CONGESTIÓN / HEMORRAGIA</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "quiste_plexo")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "quiste_plexo" ? "bg-indigo-950/35 border-indigo-500/40 text-indigo-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-indigo-400"}`}
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>QUISTE PLEXO BENIGNO</span>
                        </button>
                      </>
                    )}

                    {/* Germinal Matrix specific pathological options */}
                    {selectedStructure.startsWith("germinal") && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "hemorragia_subependimaria_g1")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "hemorragia_subependimaria_g1" ? "bg-rose-950/35 border-rose-500/50 text-rose-400 font-bold" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>HEM. SUBEPENDIMARIA G-I</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "quiste_subependimario")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "quiste_subependimario" ? "bg-indigo-950/35 border-indigo-500/40 text-indigo-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-indigo-400"}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>QUISTE SUBEPENDIMARIO</span>
                        </button>
                      </>
                    )}

                    {/* Periventricular Parenchyma specific pathological options */}
                    {selectedStructure.startsWith("parenchyma_periventricular") && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "leucomalacia_periventricular_leve")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "leucomalacia_periventricular_leve" ? "bg-rose-950/35 border-rose-500/40 text-rose-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>LPV GRADO I (EDEMA)</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "leucomalacia_periventricular_cavitaria")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "leucomalacia_periventricular_cavitaria" ? "bg-rose-950/35 border-rose-500/45 text-rose-450 font-bold" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>LPV QUÍSTICA / CAVITARIA</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "calcificaciones")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "calcificaciones" ? "bg-indigo-950/35 border-indigo-500/40 text-indigo-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-indigo-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>CALCIFICACIONES</span>
                        </button>
                      </>
                    )}

                    {/* Focal Parenchyma specific pathological options */}
                    {selectedStructure.startsWith("parenchyma_focal") && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "hemorragia_intraparenquimatosa_g4")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "hemorragia_intraparenquimatosa_g4" ? "bg-rose-950/45 border-rose-500/50 text-rose-450 font-black" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-450"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                          <span>INFARTO HEMORR. G-IV</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "calcificaciones_focales")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "calcificaciones_focales" ? "bg-indigo-950/35 border-indigo-500/40 text-indigo-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-indigo-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>CALCIFICACIONES</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "edema_difuso")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "edema_difuso" ? "bg-rose-950/35 border-rose-500/40 text-rose-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>EDEMA CEREBRAL DIFUSO</span>
                        </button>
                      </>
                    )}

                    {/* Subarachnoid space specific options */}
                    {selectedStructure === "subarachnoid_space" && (
                      <>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "dilatacion_benigna")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "dilatacion_benigna" ? "bg-indigo-950/35 border-indigo-500/40 text-indigo-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-indigo-400"}`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>DILATACIÓN EXTRAAXIAL</span>
                        </button>
                        <button
                          onClick={() => handleStateChange(selectedStructure, "coleccion_extraaxial")}
                          className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl border text-[10px] font-black transition-all cursor-pointer ${states[selectedStructure] === "coleccion_extraaxial" ? "bg-rose-950/35 border-rose-500/40 text-rose-400" : "bg-slate-900 border-slate-850 text-slate-500 hover:text-rose-400"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>COLECCIÓN EXTRAAXIAL</span>
                        </button>
                      </>
                    )}

                  </div>
                </div>

                {/* Edit Description Field */}
                {states[selectedStructure] !== "no_descrito" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Detalle descriptivo de los hallazgos en el reporte (Manual):
                    </label>
                    <textarea
                      value={customDescriptions[selectedStructure]}
                      onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: e.target.value }))}
                      placeholder={getSimplifiedDescription(selectedStructure)}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-100 font-medium font-sans resize-none transition-all"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EXPORT OPTIONS BOX */}
          <div className="bg-slate-950/30 border border-slate-850/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inclusión en Reporte Radiológico</span>
              <button
                onClick={() => setIncludeInReport && setIncludeInReport(!includeInReport)}
                className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-100 transition-colors"
              >
                {includeInReport ? (
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wide">Activo</span>
              </button>
            </div>

            <button
              onClick={triggerExport}
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 text-indigo-50 border border-indigo-500/20 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Inyectar Tabla Sinóptica</span>
            </button>
          </div>

        </div>

      </div>

      {/* SYNC LOGS HUD SECTION */}
      {syncLogs.length > 0 && (
        <div className="mt-5 border-t border-slate-850/80 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Consola de Sincronización Transfontanelar</span>
            </div>
            <button
              onClick={() => setSyncLogs([])}
              className="text-[9px] font-black text-slate-500 hover:text-slate-350 uppercase cursor-pointer"
            >
              Limpiar Consola
            </button>
          </div>
          <div className="bg-slate-950/85 border border-slate-900 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[9px] text-slate-400 leading-relaxed space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
            {syncLogs.map((log, index) => (
              <div key={index} className={`border-b border-slate-900/40 pb-1 ${log.includes("[Hallazgo]") ? "text-indigo-350" : log.includes("[Heurística]") ? "text-amber-400/90" : "text-emerald-400"}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
