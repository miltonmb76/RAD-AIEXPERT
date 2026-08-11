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

interface UrinaryAnatomyViewerProps {
  selectedModel?: string;
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
  genderMode?: "hombre" | "mujer";
  onChangeGenderMode?: (gender: "hombre" | "mujer") => void;
  externalStates?: Record<string, string>;
  externalDescriptions?: Record<string, string>;
  additionalFindings?: Array<{ id: string; structureName: string; state: string; description: string }>;
}

export default function UrinaryAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions,
  genderMode = "mujer",
  onChangeGenderMode,
  externalStates,
  externalDescriptions,
  additionalFindings = []
}: UrinaryAnatomyViewerProps) {
  
  // Current local states of kidney and urinary structures:
  // - "no_descrito": Not mentioned in report
  // - "normal": Normal, within normal limits
  // - Pathology depending on structure
  const [states, setStates] = useState<Record<string, string>>({
    right_kidney: "no_descrito",
    left_kidney: "no_descrito",
    right_ureter: "no_descrito",
    left_ureter: "no_descrito",
    bladder: "no_descrito",
    prostate: "no_descrito",
    right_uvj: "no_descrito",
    left_uvj: "no_descrito",
    include_uuv: "true"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    right_kidney: "",
    left_kidney: "",
    right_ureter: "",
    left_ureter: "",
    bladder: "",
    prostate: "",
    right_uvj: "",
    left_uvj: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("right_kidney");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [activePlan, setActivePlan] = useState<"renal" | "vesical">("renal");
  const [localGender, setLocalGender] = useState<"hombre" | "mujer">("mujer");

  // Sync internal gender state with prop
  useEffect(() => {
    if (genderMode) {
      setLocalGender(genderMode);
    }
  }, [genderMode]);

  // Propagate gender change back to parent
  const handleGenderToggle = (newGender: "hombre" | "mujer") => {
    setLocalGender(newGender);
    if (onChangeGenderMode) {
      onChangeGenderMode(newGender);
    }
    
    // Auto-select something else if prostate was selected and we switch to mujer
    if (newGender === "mujer" && selectedStructure === "prostate") {
      setSelectedStructure("right_kidney");
    }
    
    // If switching to mujer, force prostate state to no_descrito
    if (newGender === "mujer") {
      setStates(prev => ({ ...prev, prostate: "no_descrito" }));
      setCustomDescriptions(prev => ({ ...prev, prostate: "No mencionado / No descrito." }));
    }
  };

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
      case "right_kidney":
        return [
          "rinon derecho", "rd de las vias", "rd renal", "rinon d", "r. derecho", "renal derecho"
        ];
      case "left_kidney":
        return [
          "rinon izquierdo", "ri de las vias", "ri renal", "rinon i", "r. izquierdo", "renal izquierdo"
        ];
      case "right_ureter":
        return [
          "ureter derecho", "ureter d", "meato derecho", "via excretora derecha", "via urinaria derecha"
        ];
      case "left_ureter":
        return [
          "ureter izquierdo", "ureter i", "meato izquierdo", "via excretora izquierda", "via urinaria izquierda"
        ];
      case "right_uvj":
        return [
          "union ureterovesical derecha", "uuv derecha", "uuvd", "meato derecho", "meato ureteral derecho"
        ];
      case "left_uvj":
        return [
          "union ureterovesical izquierda", "uuv izquierda", "uuvi", "meato izquierdo", "meato ureteral izquierdo"
        ];
      case "bladder":
        return [
          "vejiga", "vejiga urinaria", "repletion vesical", "replecion vesical", "paredes vesicales", "volumen pre-miccional", "residuo post-miccional"
        ];
      case "prostate":
        return [
          "prostata", "prostatico", "glandula prostatica", "volumen prostatico", "lobo medio prostatico", "calcificaciones prostaticas"
        ];
      default:
        return [];
    }
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const state = stateInput || states[id] || "no_descrito";
    if (state === "no_descrito") {
      return "No mencionado / No descrito.";
    }
    if (state === "normal") {
      return "Dentro de límites normales.";
    }
    const standardStates = [
      "normal", "no_descrito", "litiasis", "quiste_simple", "hidronefrosis", "quiste_complejo", "masa_solida",
      "ectasia_leve", "hidroureteronefrosis", "litiasis_ureteral", "cistitis", "litiasis_vesical", "sedimento",
      "diverticulos", "neoplasia", "Hiperplasia", "calcificaciones", "prostatitis", "hiperplasia", "residuo_postmiccional", "ureterocele"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "right_kidney":
      case "left_kidney":
        if (state === "litiasis") return "Litiasis renal ipsilateral de 5mm.";
        if (state === "quiste_simple") return "Quiste cortical asintomático de 12mm.";
        if (state === "hidronefrosis") return "Ectasia pielocalicial moderada.";
        if (state === "quiste_complejo") return "Quiste complejo Bosniak tipo II.";
        if (state === "masa_solida") return "Lesión sólida cortical sospechosa.";
        break;
      case "right_ureter":
      case "left_ureter":
        if (state === "ectasia_leve") return "Ectasia ureteral proximal leve.";
        if (state === "hidroureteronefrosis") return "ECTASIA PIELOUreteral severa.";
        if (state === "litiasis_ureteral") return "Litiasis obstructiva en trayecto.";
        break;
      case "right_uvj":
        if (state === "litiasis") return "Lito enclavado en unión ureterovesical derecha.";
        if (state === "ureterocele") return "Uréterocele derecho.";
        break;
      case "left_uvj":
        if (state === "litiasis") return "Lito enclavado en unión ureterovesical izquierda.";
        if (state === "ureterocele") return "Uréterocele izquierdo.";
        break;
      case "bladder":
        if (state === "cistitis") return "Engrosamiento parietal inflamatorio (cistitis).";
        if (state === "litiasis_vesical") return "Cálculo vesical móvil de 15mm.";
        if (state === "sedimento") return "Detritus/sedimento urinario denso.";
        if (state === "diverticulos") return "Divertículo vesical de cuello ancho.";
        if (state === "neoplasia") return "Imagen vegetante intravesical sospechosa.";
        if (state === "residuo_postmiccional") return "Residuo postmiccional significativo.";
        break;
      case "prostate":
        if (state === "hiperplasia") return "Hiperplasia benigna (HPB) grado II.";
        if (state === "calcificaciones") return "Calcificaciones periuretrales benignas.";
        if (state === "prostatitis") return "Congestión difusa prostática sugestiva.";
        break;
    }
    return "Dentro de límites normales.";
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis local con heurísticas de coincidencia...");
    const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Auto-detect gender first if "prostata" is mentioned anywhere in the report
    const hasProstateMention = textLower.includes("prostata") || textLower.includes("prostatic");
    const activeGender = hasProstateMention ? "hombre" : "mujer";
    handleGenderToggle(activeGender);
    logs.push(`Género auto-detectado: ${activeGender.toUpperCase()} (Mención de próstata: ${hasProstateMention ? "SÍ" : "NO"})`);

    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    const keys = ["right_kidney", "left_kidney", "right_ureter", "left_ureter", "bladder", "right_uvj", "left_uvj"];
    if (activeGender === "hombre") {
      keys.push("prostate");
    }

    keys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado / No descrito.";
        return;
      }

      // Check if normal
      const isNormal = [
        "normal", "conservado", "conservada", "homogeneo", "homogenea", "sin alteraciones",
        "morfologia habitual", "aspecto habitual", "sin evidencia de litiasis", "sin litiasis",
        "dentro de limites normales", "limites normales"
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

      // Deeper analysis for pathologies
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      if (id === "right_kidney" || id === "left_kidney") {
        if (textLower.includes("hidronefrosis") || textLower.includes("ectasia pielo") || textLower.includes("dilatacion de la pelvis") || textLower.includes("pieloectasia")) {
          detectedState = "hidronefrosis";
          desc = "Ectasia pielocalicial.";
        } else if (textLower.includes("litiasis") || textLower.includes("calculo") || textLower.includes("imagen hiperecogenica") || textLower.includes("microlitiasis")) {
          detectedState = "litiasis";
          desc = "Litiasis renal no obstructiva.";
        } else if (textLower.includes("quiste cortical") || textLower.includes("quiste simple") || textLower.includes("imagen anecoica")) {
          detectedState = "quiste_simple";
          desc = "Quiste simple cortical renal.";
        } else if (textLower.includes("bosniak") || textLower.includes("quiste complejo") || textLower.includes("tabicado") || textLower.includes("paredes gruesas")) {
          detectedState = "quiste_complejo";
          desc = "Quiste complejo Bosniak.";
        } else if (textLower.includes("masa") || textLower.includes("solida") || textLower.includes("neoformacion") || textLower.includes("nodulo cortical")) {
          detectedState = "masa_solida";
          desc = "Masa sólida cortical sospechosa.";
        }
      } else if (id === "right_ureter" || id === "left_ureter") {
        if (textLower.includes("ureteral") && (textLower.includes("litiasis") || textLower.includes("calculo"))) {
          detectedState = "litiasis_ureteral";
          desc = "Litiasis ureteral obstructiva.";
        } else if (textLower.includes("hidroureter") || textLower.includes("ectasia ureteral severa")) {
          detectedState = "hidroureteronefrosis";
          desc = "Uréter dilatado obstructivo.";
        } else if (textLower.includes("ectasia leve") || textLower.includes("dilatacion leve") || textLower.includes("dilatado")) {
          detectedState = "ectasia_leve";
          desc = "Ectasia ureteral proximal leve.";
        }
      } else if (id === "right_uvj" || id === "left_uvj") {
        const side = id === "right_uvj" ? "derecha" : "izquierda";
        const adj = id === "right_uvj" ? "derecho" : "izquierdo";
        if (textLower.includes("ureterocele")) {
          detectedState = "ureterocele";
          desc = `Uréterocele ${adj}.`;
        } else if (textLower.includes("lito") || textLower.includes("calculo") || textLower.includes("litiasis")) {
          detectedState = "litiasis";
          desc = `Lito enclavado en unión ureterovesical ${side}.`;
        }
      } else if (id === "bladder") {
        if (textLower.includes("residuo postmiccional") || textLower.includes("residuo post-miccional") || textLower.includes("postmiccional")) {
          detectedState = "residuo_postmiccional";
          desc = "Residuo postmiccional significativo.";
        } else if (textLower.includes("cistitis") || textLower.includes("pared gruesa") || textLower.includes("engrosamiento difuso") || textLower.includes("cruda")) {
          detectedState = "cistitis";
          desc = "Pared vesical engrosada (cistitis).";
        } else if (textLower.includes("sedimento") || textLower.includes("detritus") || textLower.includes("ecos en suspension")) {
          detectedState = "sedimento";
          desc = "Sedimento urinario denso.";
        } else if (textLower.includes("calculo") || textLower.includes("litiasis vesical") || textLower.includes("sombra en vejiga")) {
          detectedState = "litiasis_vesical";
          desc = "Litiasis vesical móvil.";
        } else if (textLower.includes("diverticulo") || textLower.includes("diverticulos")) {
          detectedState = "diverticulos";
          desc = "Divertículos vesicales.";
        } else if (textLower.includes("masa vegetante") || textLower.includes("neoformacion") || textLower.includes("lesion de aspecto vegetante") || textLower.includes("lesion papilar")) {
          detectedState = "neoplasia";
          desc = "Lesión vegetante intravesical.";
        }
      } else if (id === "prostate" && activeGender === "hombre") {
        if (textLower.includes("hpb") || textLower.includes("hiperplasia") || textLower.includes("crecida") || textLower.includes("adenoma")) {
          detectedState = "hiperplasia";
          desc = "Hiperplasia prostática benigna (HPB).";
        } else if (textLower.includes("calcificaciones") || textLower.includes("corpora") || textLower.includes("concreciones")) {
          detectedState = "calcificaciones";
          desc = "Calcificaciones parenquimatosas benignas.";
        } else if (textLower.includes("prostatitis") || textLower.includes("congestiva")) {
          detectedState = "prostatitis";
          desc = "Cambios congestivos prostáticos.";
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Riñones y Vías Urinarias (${generatedReport.length} caracteres)...`);

    // Prior auto-detect gender based on prostate mentions
    const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const hasProstate = textLower.includes("prostata") || textLower.includes("prostatic");
    const activeGender = hasProstate ? "hombre" : "mujer";
    handleGenderToggle(activeGender);

    const structuresList = [
      {
        id: "right_kidney",
        label: "Riñón Derecho",
        allowedStates: ["no_descrito", "normal", "litiasis", "quiste_simple", "hidronefrosis", "quiste_complejo", "masa_solida"]
      },
      {
        id: "left_kidney",
        label: "Riñón Izquierdo",
        allowedStates: ["no_descrito", "normal", "litiasis", "quiste_simple", "hidronefrosis", "quiste_complejo", "masa_solida"]
      },
      {
        id: "right_ureter",
        label: "Uréter Derecho",
        allowedStates: ["no_descrito", "normal", "ectasia_leve", "hidroureteronefrosis", "litiasis_ureteral"]
      },
      {
        id: "left_ureter",
        label: "Uréter Izquierdo",
        allowedStates: ["no_descrito", "normal", "ectasia_leve", "hidroureteronefrosis", "litiasis_ureteral"]
      },
      {
        id: "right_uvj",
        label: "Unión Ureterovesical Derecha",
        allowedStates: ["no_descrito", "normal", "litiasis", "ureterocele"]
      },
      {
        id: "left_uvj",
        label: "Unión Ureterovesical Izquierda",
        allowedStates: ["no_descrito", "normal", "litiasis", "ureterocele"]
      },
      {
        id: "bladder",
        label: "Vejiga Urinaria",
        allowedStates: ["no_descrito", "normal", "cistitis", "litiasis_vesical", "sedimento", "diverticulos", "neoplasia", "residuo_postmiccional"]
      }
    ];

    if (activeGender === "hombre") {
      structuresList.push({
        id: "prostate",
        label: "Próstata",
        allowedStates: ["no_descrito", "normal", "hiperplasia", "calcificaciones", "prostatitis"]
      });
    }

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.6-flash",
          reportText: generatedReport,
          studyType: "Riñones y Vías Urinarias",
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
            let parsedState = data.states[struc.id];
            let rawDesc = data.descriptions[struc.id];

            // Force residuo_postmiccional in bladder if explicitly mentioned
            if (struc.id === "bladder") {
              const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (textLower.includes("residuo postmiccional") || textLower.includes("residuo post-miccional") || textLower.includes("postmiccional")) {
                parsedState = "residuo_postmiccional";
                rawDesc = "Residuo postmiccional significativo.";
              }
            }
            
            // Clean-up description
            let finalDesc = rawDesc || "Dentro de límites normales.";
            if (parsedState === "normal") {
              finalDesc = "Dentro de límites normales.";
            } else if (parsedState === "no_descrito") {
              finalDesc = "No mencionado / No descrito.";
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

        // Ensure leftover values are reset if we switched genders midway
        if (activeGender === "mujer") {
          finalStates.prostate = "no_descrito";
          finalDescriptions.prostate = "No mencionado / No descrito.";
        }

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
      console.error("Error en extracción inteligente:", error);
      logs.push("Fallo crítico en conexión con la API de IA. Ejecutando heurística local...");
      runLocalHeuristics(logs);
      setSyncLogs(prev => [...prev, ...logs]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => {
      const up = { ...prev, [id]: s };
      return up;
    });
    
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No mencionado / No descrito." }));
    } else if (s === "normal") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "Dentro de límites normales." }));
    } else {
      setCustomDescriptions(prev => ({ ...prev, [id]: getSimplifiedDescription(id, s) }));
    }
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
  };

  const handleUuvInReportChange = (val: boolean) => {
    setStates(prev => ({ ...prev, include_uuv: val ? "true" : "false" }));
  };

  const handleUuvStateChange = (side: "right" | "left", s: string) => {
    const key = side === "right" ? "right_uvj" : "left_uvj";
    setStates(prev => ({ ...prev, [key]: s }));
    
    // Fill text description
    let desc = "";
    if (s === "normal") {
      desc = "Dentro de límites normales.";
    } else if (s === "no_descrito") {
      desc = "";
    } else if (s === "litiasis") {
      desc = `Lito enclavado en unión ureterovesical ${side === "right" ? "derecha" : "izquierda"}.`;
    } else if (s === "ureterocele") {
      desc = `Uréterocele ${side === "right" ? "derecho" : "izquierdo"}.`;
    }

    setCustomDescriptions(prev => ({ ...prev, [key]: desc }));
  };

  const handleUuvManualTextChange = (side: "right" | "left", text: string) => {
    const key = side === "right" ? "right_uvj" : "left_uvj";
    setCustomDescriptions(prev => ({ ...prev, [key]: text }));
    
    // If the text has content, ensure standard state is marked accordingly or kept as is
    if (text.trim() !== "" && states[key] === "no_descrito") {
      setStates(prev => ({ ...prev, [key]: "custom" }));
    } else if (text.trim() === "") {
      setStates(prev => ({ ...prev, [key]: "no_descrito" }));
    }
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  // Render trigger sync if report changes disabled per user request
  useEffect(() => {
    // Disabled auto-sync to ensure everything is strictly manual and saves resources as requested.
  }, [generatedReport, lastSyncedReport]);

  const exportTableData = () => {
    let md = `\n| Estructura analizada | Hallazgos ecográficos / Sinopsis del reporte |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "right_kidney", label: "Riñón Derecho" },
      { id: "left_kidney", label: "Riñón Izquierdo" },
      { id: "right_ureter", label: "Uréter Derecho" },
      { id: "left_ureter", label: "Uréter Izquierdo" },
      { id: "bladder", label: "Vejiga Urinaria" },
    ];

    if (localGender === "hombre") {
      list.push({ id: "prostate", label: "Próstata" });
    }

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito" && states[item.id] !== "normal") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    // Indepedent UVJ section inclusion control
    if (states.include_uuv === "true") {
      if (states.right_uvj !== "no_descrito" && states.right_uvj !== "normal") {
        const desc = customDescriptions.right_uvj?.trim() || getSimplifiedDescription("right_uvj");
        md += `| **UUV Derecha** | ${desc} |\n`;
        hasRows = true;
      }
      if (states.left_uvj !== "no_descrito" && states.left_uvj !== "normal") {
        const desc = customDescriptions.left_uvj?.trim() || getSimplifiedDescription("left_uvj");
        md += `| **UUV Izquierda** | ${desc} |\n`;
        hasRows = true;
      }
    }

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras de aparato renal se reportan normales.* |\n`;
    }

    onExportTable(md);
  };

  const exportNarrativeNarratolog = () => {
    if (!onExportNarrative) return;
    
    const keys = ["right_kidney", "left_kidney", "right_ureter", "left_ureter", "bladder"];
    if (localGender === "hombre") {
      keys.push("prostate");
    }
    if (states.include_uuv === "true") {
      keys.push("right_uvj", "left_uvj");
    }

    const pathologicalItems: string[] = [];
    const normalItems: string[] = [];

    keys.forEach(id => {
      const s = states[id];
      const desc = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
      const label = id === "right_kidney" ? "Riñón Derecho" : 
                    id === "left_kidney" ? "Riñón Izquierdo" :
                    id === "right_ureter" ? "Uréter Derecho" :
                    id === "left_ureter" ? "Uréter Izquierdo" :
                    id === "right_uvj" ? "UUV Derecha" :
                    id === "left_uvj" ? "UUV Izquierda" :
                    id === "bladder" ? "Vejiga" : "Próstata";

      if (s !== "no_descrito") {
        if (s === "normal") {
          normalItems.push(label);
        } else {
          pathologicalItems.push(`**${label}**: ${desc}`);
        }
      }
    });

    let txt = "El análisis esquemático tridimensional del tracto urinario revela lo siguiente:\n\n";
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
    // Only sync narrative findings automatically, table is manual
    exportNarrativeNarratolog();
  }, [states, customDescriptions, localGender]);

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
    // Minor issues
    if (s === "litiasis" || s === "quiste_simple" || s === "ectasia_leve" || s === "sedimento" || s === "calcificaciones" || s === "residuo_postmiccional") {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
        stroke: "#f59e0b"
      };
    }
    // Severe / complex issues
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
      // Skip prostate if female
      if (localGender === "mujer" && key === "prostate") return;
      if (key === "include_uuv") return; // Skip the inclusion control key

      const st = states[key];
      if (st === "no_descrito") notInReport++;
      else if (st === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normalCount, notInReport };
  };

  const getStructureOptions = (id: string) => {
    switch (id) {
      case "right_kidney":
      case "left_kidney":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "litiasis", label: "Litiasis renal" },
          { val: "quiste_simple", label: "Quiste simple cortical" },
          { val: "hidronefrosis", label: "Ectasia pielocalicial / Hidronefrosis" },
          { val: "quiste_complejo", label: "Quiste renal complejo / Bosniak" },
          { val: "masa_solida", label: "Masa de aspecto sólido" }
        ];
      case "right_ureter":
      case "left_ureter":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "ectasia_leve", label: "Ectasia ureteral proximal leve" },
          { val: "hidroureteronefrosis", label: "Hidrouréter / Ectasia moderada-severa" },
          { val: "litiasis_ureteral", label: "Litiasis ureteral obstructiva" }
        ];
      case "right_uvj":
      case "left_uvj":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "litiasis", label: "Lito / Cálculo" },
          { val: "ureterocele", label: "Uréterocele" }
        ];
      case "bladder":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "cistitis", label: "Pared irregular / Cistitis crónica" },
          { val: "litiasis_vesical", label: "Cálculo vesical móvil" },
          { val: "sedimento", label: "Sedimento/detritus vesical" },
          { val: "diverticulos", label: "Divertículos vesicales" },
          { val: "neoplasia", label: "Masa o lesión vegetante parietal" },
          { val: "residuo_postmiccional", label: "Residuo postmiccional" }
        ];
      case "prostate":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hiperplasia", label: "Hiperplasia benigna (HPB)" },
          { val: "calcificaciones", label: "Calcificaciones parenquimatosas" },
          { val: "prostatitis", label: "Congestión prostática / Prostatitis" }
        ];
      default:
        return [];
    }
  };

  const badges = getBadgesCount();

  const getActiveStructureLabel = () => {
    switch (selectedStructure) {
      case "right_kidney": return "Riñón Derecho";
      case "left_kidney": return "Riñón Izquierdo";
      case "right_ureter": return "Uréter Derecho";
      case "left_ureter": return "Uréter Izquierdo";
      case "right_uvj": return "UUV Derecha";
      case "left_uvj": return "UUV Izquierda";
      case "bladder": return "Vejiga Urinaria";
      case "prostate": return "Próstata";
      default: return "";
    }
  };

  const hasRightUUVStone = states.right_uvj === "litiasis";
  const hasLeftUUVStone = states.left_uvj === "litiasis";

  const includeUuvInReport = states.include_uuv === "true";
  const rightUuvState = states.right_uvj || "no_descrito";
  const leftUuvState = states.left_uvj || "no_descrito";
  const rightUuvManualText = customDescriptions.right_uvj || "";
  const leftUuvManualText = customDescriptions.left_uvj || "";

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border-2 border-slate-800/80 p-5 shadow-2xl flex flex-col gap-5">
      
      {/* PANEL HEADER WITH TOGGLES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              US de Riñones y Vías Urinarias
              <span className="text-[10px] lowercase font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-850">
                interactivo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Mapeo de hallazgos para {localGender === "hombre" ? "Hombre (con Próstata)" : "Mujer (sin Próstata)"}
            </p>
          </div>
        </div>

        {/* CONTROLS (GENDER & REFRESH) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          
          {/* GENDER SELECTOR */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-850 flex items-center gap-1">
            <button
              onClick={() => handleGenderToggle("mujer")}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all duration-150 uppercase tracking-wider ${
                localGender === "mujer"
                  ? "bg-slate-850 border border-slate-700 text-pink-400 font-black shadow-inner"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Mujer
            </button>
            <button
              onClick={() => handleGenderToggle("hombre")}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all duration-150 uppercase tracking-wider ${
                localGender === "hombre"
                  ? "bg-slate-850 border border-slate-700 text-blue-400 font-black shadow-inner"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Hombre
            </button>
          </div>

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

      {/* CENTRAL AREA: SIDE-BY-SIDE GRAPHICS & DIAGRAM / EDITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-5 items-start">
        
        {/* LEFT COLUMN: DIAGRAMS (COLLAPSIBLE TABS: RENAL VS VESICAL) */}
        <div className="lg:col-span-4 flex flex-col items-center gap-4 bg-slate-950/30 p-3.5 border border-slate-850/50 rounded-xl max-w-full">
          
          {/* TABS PLANOS */}
          <div className="w-full flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 gap-1.5">
            <button
              onClick={() => setActivePlan("renal")}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 ${
                activePlan === "renal"
                  ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Plano Renal
            </button>
            <button
              onClick={() => setActivePlan("vesical")}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 ${
                activePlan === "vesical"
                  ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {localGender === "hombre" ? "Plano Vesico-Prostático" : "Plano Vesical"}
            </button>
          </div>

          {/* SVG RENDERING CONTAINER */}
          <div className="w-full flex items-center justify-center min-h-[220px] bg-slate-950/20 p-2.5 rounded-xl relative overflow-hidden">
            
            {/* PLANO RENAL */}
            <div className={activePlan === "renal" ? "w-full flex justify-center" : "hidden"}>
              <svg 
                id="urinary-anatomy-svg-renal"
                viewBox="0 0 240 240" 
                className="w-full max-w-[220px] h-auto drop-shadow-2xl"
                style={{ maxHeight: "220px" }}
              >
                {/* Arterial Cava / Aorta (Backbone anatomy background) */}
                <line x1="110" y1="20" x2="110" y2="220" stroke="#101827" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
                <line x1="126" y1="20" x2="126" y2="220" stroke="#311010" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
                
                {/* RIGHT KIDNEY (anatomical right = screen left) */}
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("right_kidney")}
                  onMouseEnter={() => setActiveHover("right_kidney")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 90,70 C 58,68 40,95 40,120 C 40,145 58,172 90,170 C 97,155 92,135 92,120 C 92,105 97,85 90,70 Z"
                    fill={getColorForSVG("right_kidney").fill}
                    stroke={getColorForSVG("right_kidney").stroke}
                    strokeWidth={states.right_kidney !== "normal" && states.right_kidney !== "no_descrito" ? "2.5" : "1.2"}
                    fillOpacity={states.right_kidney !== "normal" && states.right_kidney !== "no_descrito" ? "0.9" : "0.5"}
                  />
                  {/* Inner renal sinus */}
                  <path 
                    d="M 88,95 C 77,95 74,110 74,120 C 74,130 77,145 88,145 C 83,135 83,105 88,95 Z"
                    fill="#1e293b"
                    stroke={getColorForSVG("right_kidney").stroke}
                    strokeWidth="0.8"
                    opacity="0.7"
                  />
                  <text x="68" y="124" fill="#cbd5e1" fontSize="7" textAnchor="middle" fontWeight="bold">RD</text>
                  <text x="65" y="55" fill="#64748b" fontSize="6" textAnchor="middle" opacity={selectedStructure === "right_kidney" || activeHover === "right_kidney" ? 1 : 0.4} fontWeight="extrabold">RIÑÓN D</text>
                </g>

                {/* LEFT KIDNEY (anatomical left = screen right) */}
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("left_kidney")}
                  onMouseEnter={() => setActiveHover("left_kidney")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 150,70 C 182,68 200,95 200,120 C 200,145 182,172 150,170 C 143,155 148,135 148,120 C 148,105 143,85 150,70 Z"
                    fill={getColorForSVG("left_kidney").fill}
                    stroke={getColorForSVG("left_kidney").stroke}
                    strokeWidth={states.left_kidney !== "normal" && states.left_kidney !== "no_descrito" ? "2.5" : "1.2"}
                    fillOpacity={states.left_kidney !== "normal" && states.left_kidney !== "no_descrito" ? "0.9" : "0.5"}
                  />
                  {/* Inner kidney sinus */}
                  <path 
                    d="M 152,95 C 163,95 166,110 166,120 C 166,130 163,145 152,145 C 157,135 157,105 152,95 Z"
                    fill="#1e293b"
                    stroke={getColorForSVG("left_kidney").stroke}
                    strokeWidth="0.8"
                    opacity="0.7"
                  />
                  <text x="172" y="124" fill="#cbd5e1" fontSize="7" textAnchor="middle" fontWeight="bold">RI</text>
                  <text x="175" y="55" fill="#64748b" fontSize="6" textAnchor="middle" opacity={selectedStructure === "left_kidney" || activeHover === "left_kidney" ? 1 : 0.4} fontWeight="extrabold">RIÑÓN I</text>
                </g>

                {/* RIGHT URETER (screen left, descending down) */}
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("right_ureter")}
                  onMouseEnter={() => setActiveHover("right_ureter")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 87,135 Q 98,175 106,220" 
                    fill="none"
                    stroke={getColorForSVG("right_ureter").stroke}
                    strokeWidth={states.right_ureter !== "normal" && states.right_ureter !== "no_descrito" ? "3" : "1.2"}
                    opacity={states.right_ureter === "no_descrito" ? "0.25" : "1"}
                  />
                  <circle cx="87" cy="135" r="2" fill={getColorForSVG("right_ureter").stroke} />
                  <text x="75" y="195" fill="#64748b" fontSize="5.5" textAnchor="end" opacity={selectedStructure === "right_ureter" || activeHover === "right_ureter" ? 1 : 0.4} fontWeight="bold">URÉTER D</text>
                </g>

                {/* LEFT URETER (screen right, descending down) */}
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("left_ureter")}
                  onMouseEnter={() => setActiveHover("left_ureter")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 153,135 Q 142,175 134,220" 
                    fill="none"
                    stroke={getColorForSVG("left_ureter").stroke}
                    strokeWidth={states.left_ureter !== "normal" && states.left_ureter !== "no_descrito" ? "3" : "1.2"}
                    opacity={states.left_ureter === "no_descrito" ? "0.25" : "1"}
                  />
                  <circle cx="153" cy="135" r="2" fill={getColorForSVG("left_ureter").stroke} />
                  <text x="165" y="195" fill="#64748b" fontSize="5.5" textAnchor="start" opacity={selectedStructure === "left_ureter" || activeHover === "left_ureter" ? 1 : 0.4} fontWeight="bold">URÉTER I</text>
                </g>
              </svg>
            </div>

            {/* PLANO VESICAL & PROSTÁTICO */}
            <div className={activePlan === "vesical" ? "w-full flex justify-center" : "hidden"}>
              <svg 
                id="urinary-anatomy-svg-vesical"
                viewBox="0 0 240 240" 
                className="w-full max-w-[220px] h-auto drop-shadow-2xl"
                style={{ maxHeight: "220px" }}
              >
                {/* Ureter lines descending into bladder */}
                <line x1="85" y1="20" x2="105" y2="78" stroke="#334155" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.4" />
                <line x1="155" y1="20" x2="135" y2="78" stroke="#334155" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.4" />

                {/* Unión Ureterovesical (UUV) */}
                <g opacity="0.85">
                  {/* Unión Ureterovesical Derecha */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("right_uvj")}
                    onMouseEnter={() => setActiveHover("right_uvj")}
                    onMouseLeave={() => setActiveHover(null)}
                    opacity={selectedStructure === "right_uvj" || activeHover === "right_uvj" ? 1 : 0.8}
                  >
                    <circle cx="105" cy="78" r="6" fill={selectedStructure === "right_uvj" ? "rgba(99, 102, 241, 0.5)" : "rgba(99, 102, 241, 0.25)"} stroke={selectedStructure === "right_uvj" ? "#818cf8" : "#6366f1"} strokeWidth={selectedStructure === "right_uvj" ? 1.5 : 1} />
                    <circle cx="105" cy="78" r="2" fill="#a5b4fc" />
                    <text x="97" y="76" fill="#a5b4fc" fontSize="4.5" textAnchor="end" fontWeight={selectedStructure === "right_uvj" ? "black" : "bold"}>UUV Derecha</text>
                  </g>

                  {/* Unión Ureterovesical Izquierda */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("left_uvj")}
                    onMouseEnter={() => setActiveHover("left_uvj")}
                    onMouseLeave={() => setActiveHover(null)}
                    opacity={selectedStructure === "left_uvj" || activeHover === "left_uvj" ? 1 : 0.8}
                  >
                    <circle cx="135" cy="78" r="6" fill={selectedStructure === "left_uvj" ? "rgba(99, 102, 241, 0.5)" : "rgba(99, 102, 241, 0.25)"} stroke={selectedStructure === "left_uvj" ? "#818cf8" : "#6366f1"} strokeWidth={selectedStructure === "left_uvj" ? 1.5 : 1} />
                    <circle cx="135" cy="78" r="2" fill="#a5b4fc" />
                    <text x="143" y="76" fill="#a5b4fc" fontSize="4.5" textAnchor="start" fontWeight={selectedStructure === "left_uvj" ? "black" : "bold"}>UUV Izquierda</text>
                  </g>
                </g>

                {/* Lito Enclavado en UUV Derecha */}
                {hasRightUUVStone && (
                  <g>
                    {/* Sombra acústica posterior */}
                    <path
                      d="M 102,78 L 98,155 L 112,155 L 108,78 Z"
                      fill="rgba(15, 23, 42, 0.45)"
                      stroke="none"
                      opacity="0.75"
                    />
                    {/* Halo de advertencia pulsante */}
                    <circle
                      cx="105"
                      cy="78"
                      r="6"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.8"
                    >
                      <animate attributeName="r" values="3.5;7.5;3.5" dur="3s" repeatCount="indefinite" />
                    </circle>
                    {/* Cuerpo del cálculo */}
                    <polygon
                      points="105,74 108.5,76.5 107.5,80.5 104,81.5 102,79.5 101.5,76"
                      fill="#f59e0b"
                      stroke="#78350f"
                      strokeWidth="0.7"
                    />
                    {/* Facetas de brillo interno */}
                    <polygon points="105,74 105,78 108.5,76.5" fill="#fef3c7" opacity="0.8" />
                    <polygon points="105,74 102,76.5 105,78" fill="#fbbf24" opacity="0.8" />
                    {/* Texto indicativo */}
                    <text x="96" y="86" fill="#fbbf24" fontSize="4.5" textAnchor="end" fontWeight="black" letterSpacing="0.2">LITO ENCLAVADO</text>
                  </g>
                )}

                {/* Ureterocele en UUV Derecha */}
                {states.right_uvj === "ureterocele" && (
                  <g>
                    {/* Pulsing cystic ballooning */}
                    <circle
                      cx="105"
                      cy="78"
                      r="11"
                      fill="rgba(99, 102, 241, 0.4)"
                      stroke="#818cf8"
                      strokeWidth="1.5"
                    >
                      <animate attributeName="r" values="9;12;9" dur="4s" repeatCount="indefinite" />
                    </circle>
                    {/* Inner meatal slit */}
                    <ellipse cx="105" cy="78" rx="1" ry="3" fill="none" stroke="#e0e7ff" strokeWidth="0.8" opacity="0.9" />
                    {/* Indicative label */}
                    <text x="96" y="93" fill="#a5b4fc" fontSize="4.5" textAnchor="end" fontWeight="black" letterSpacing="0.2">URÉTEROCELE</text>
                  </g>
                )}

                {/* Lito Enclavado en UUV Izquierda */}
                {hasLeftUUVStone && (
                  <g>
                    {/* Sombra acústica posterior */}
                    <path
                      d="M 132,78 L 128,155 L 142,155 L 138,78 Z"
                      fill="rgba(15, 23, 42, 0.45)"
                      stroke="none"
                      opacity="0.75"
                    />
                    {/* Halo de advertencia pulsante */}
                    <circle
                      cx="135"
                      cy="78"
                      r="6"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.8"
                    >
                      <animate attributeName="r" values="3.5;7.5;3.5" dur="3s" repeatCount="indefinite" />
                    </circle>
                    {/* Cuerpo del cálculo */}
                    <polygon
                      points="135,74 138.5,76.5 137.5,80.5 134,81.5 132,79.5 131.5,76"
                      fill="#f59e0b"
                      stroke="#78350f"
                      strokeWidth="0.7"
                    />
                    {/* Facetas de brillo interno */}
                    <polygon points="135,74 135,78 138.5,76.5" fill="#fef3c7" opacity="0.8" />
                    <polygon points="135,74 132,76.5 135,78" fill="#fbbf24" opacity="0.8" />
                    {/* Texto indicativo */}
                    <text x="144" y="86" fill="#fbbf24" fontSize="4.5" textAnchor="start" fontWeight="black" letterSpacing="0.2">LITO ENCLAVADO</text>
                  </g>
                )}

                {/* Ureterocele en UUV Izquierda */}
                {states.left_uvj === "ureterocele" && (
                  <g>
                    {/* Pulsing cystic ballooning */}
                    <circle
                      cx="135"
                      cy="78"
                      r="11"
                      fill="rgba(99, 102, 241, 0.4)"
                      stroke="#818cf8"
                      strokeWidth="1.5"
                    >
                      <animate attributeName="r" values="9;12;9" dur="4s" repeatCount="indefinite" />
                    </circle>
                    {/* Inner meatal slit */}
                    <ellipse cx="135" cy="78" rx="1" ry="3" fill="none" stroke="#e0e7ff" strokeWidth="0.8" opacity="0.9" />
                    {/* Indicative label */}
                    <text x="144" y="93" fill="#a5b4fc" fontSize="4.5" textAnchor="start" fontWeight="black" letterSpacing="0.2">URÉTEROCELE</text>
                  </g>
                )}

                {/* BLADDER (VEJIGA URINARIA) */}
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("bladder")}
                  onMouseEnter={() => setActiveHover("bladder")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 120,55 C 65,55 55,90 55,123 C 55,145 75,160 120,160 C 165,160 185,145 185,123 C 185,90 175,55 120,55 Z"
                    fill={getColorForSVG("bladder").fill}
                    stroke={getColorForSVG("bladder").stroke}
                    strokeWidth={states.bladder !== "normal" && states.bladder !== "no_descrito" ? "2.5" : "1.2"}
                    fillOpacity={states.bladder !== "normal" && states.bladder !== "no_descrito" ? "0.9" : "0.5"}
                  />
                  {/* Bladder fluid surface line inside */}
                  <line x1="65" y1="95" x2="175" y2="95" stroke={getColorForSVG("bladder").stroke} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
                  <text x="120" y="115" fill="#cbd5e1" fontSize="7" textAnchor="middle" fontWeight="bold">VEJIGA</text>
                  <text x="120" y="38" fill="#64748b" fontSize="6" textAnchor="middle" opacity={selectedStructure === "bladder" || activeHover === "bladder" ? 1 : 0.4} fontWeight="extrabold">VEJIGA URINARIA</text>
                </g>

                {/* PROSTATE (Próstata - ONLY visible & interactive if male!) */}
                {localGender === "hombre" ? (
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("prostate")}
                    onMouseEnter={() => setActiveHover("prostate")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 120,162 C 102,162 90,172 90,188 C 90,200 108,209 120,211 C 132,209 150,200 150,188 C 150,172 138,162 120,162 Z"
                      fill={getColorForSVG("prostate").fill}
                      stroke={getColorForSVG("prostate").stroke}
                      strokeWidth={states.prostate !== "normal" && states.prostate !== "no_descrito" ? "2.5" : "1.2"}
                      fillOpacity={states.prostate !== "normal" && states.prostate !== "no_descrito" ? "0.9" : "0.5"}
                    />
                    {/* Urethra vertical axis through prostate */}
                    <line x1="120" y1="160" x2="120" y2="216" stroke={getColorForSVG("prostate").stroke} strokeWidth="1" strokeDasharray="2,1" opacity="0.6" />
                    
                    <text x="120" y="191" fill="#cbd5e1" fontSize="6.5" textAnchor="middle" fontWeight="bold">PRÓSTATA</text>
                    <text x="120" y="226" fill="#64748b" fontSize="5.5" textAnchor="middle" opacity={selectedStructure === "prostate" || activeHover === "prostate" ? 1 : 0.4} fontWeight="extrabold">PRÓSTATA</text>
                  </g>
                ) : (
                  // Female pelvic floor outline
                  <g opacity="0.6">
                    <path d="M 60,160 Q 120,185 180,160" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="3,3" />
                    <text x="120" y="174" fill="#64748b" fontSize="5" textAnchor="middle" fontStyle="italic">Piso Pélvico Femenino</text>
                  </g>
                )}
              </svg>
            </div>

          </div>

          <div className="w-full text-center">
            <p className="text-[10px] text-slate-500 italic max-w-sm mx-auto leading-normal">
              Haz clic en cualquier órgano del plano arriba para cambiar su estado clínico y redactar su resumen sinóptico.
            </p>
          </div>

          {additionalFindings && additionalFindings.length > 0 && (
            <div className="w-full bg-slate-900/10 border border-slate-850 p-3 rounded-2xl mt-4">
              <h5 className="text-[9px] uppercase font-black text-indigo-400 font-mono tracking-wider mb-2 text-left select-none">
                📍 Hallazgos Adicionales Detectados
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
                {additionalFindings.map((item) => {
                  const s = item.state || "Alterado";
                  return (
                    <div 
                      key={item.id}
                      className="p-2 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col justify-between text-left"
                    >
                      <div className="flex items-center justify-between gap-1 leading-none select-none">
                        <span className="text-[9.5px] font-black uppercase text-slate-200 truncate">{item.structureName}</span>
                        <span className="text-[7.5px] px-1 bg-rose-950/40 text-rose-450 border border-rose-900/40 rounded scale-90 font-mono font-black uppercase shrink-0">
                          {s}
                        </span>
                      </div>
                      <p className="text-[8.5px] leading-relaxed text-slate-400 mt-1 max-w-full truncate leading-tight">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DETAILED EDITOR PANEL */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* STRUCTURE SELECTOR DROPDOWN */}
          <div className="bg-slate-950/40 p-3.5 border border-slate-850/50 rounded-xl">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1.5 font-mono">
              Estructura Seleccionada:
            </label>
            <div className="relative">
              <select
                value={selectedStructure}
                onChange={(e) => {
                  setSelectedStructure(e.target.value);
                  const relatedPlan = (e.target.value === "bladder" || e.target.value === "prostate" || e.target.value === "right_uvj" || e.target.value === "left_uvj") ? "vesical" : "renal";
                  setActivePlan(relatedPlan);
                }}
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="right_kidney">Riñón Derecho</option>
                <option value="left_kidney">Riñón Izquierdo</option>
                <option value="right_ureter">Uréter Derecho</option>
                <option value="left_ureter">Uréter Izquierdo</option>
                <option value="right_uvj">Unión Ureterovesical Derecha (UUV D)</option>
                <option value="left_uvj">Unión Ureterovesical Izquierda (UUV I)</option>
                <option value="bladder">Vejiga Urinaria</option>
                {localGender === "hombre" && (
                  <option value="prostate">Próstata</option>
                )}
              </select>
            </div>
          </div>

          {/* APARTADO INDEPENDIENTE: UNIÓN URÉTERO VESICAL (UUV) */}
          <div className="bg-slate-950/60 border-2 border-indigo-950/40 p-4 rounded-xl flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-indigo-950 text-indigo-400">
                  <Activity className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs uppercase font-black text-slate-100 tracking-wider">
                  Unión Urétero Vesical (UUV)
                </span>
              </div>
              
              {/* CUADRO PARA DECIDIR SI SE INCLUYE EN EL REPORTEO O NO */}
              <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 px-2 py-1 rounded border border-slate-850 select-none hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={includeUuvInReport}
                  onChange={(e) => handleUuvInReportChange(e.target.checked)}
                  className="rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">
                  Incluir en Reporte
                </span>
              </label>
            </div>

            <p className="text-[10px] text-slate-400 leading-normal">
              Selecciona lito o ureterocele para las uniones uréterovesicales. Puedes escribir detalles o cambiarlos manualmente abajo.
            </p>

            {/* SECTIONS FOR RIGHT AND LEFT UVJ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* UUV DERECHA */}
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-850 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">UUV Derecha</span>
                  <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border ${
                    rightUuvState === "no_descrito" ? "bg-slate-950 text-slate-500 border-slate-900" :
                    rightUuvState === "normal" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/20" :
                    "bg-amber-950/40 text-amber-400 border-amber-900/20"
                  }`}>
                    {rightUuvState === "litiasis" ? "lito" : rightUuvState.replace("_", " ")}
                  </span>
                </div>

                {/* Predefined toggles */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("right", "normal")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      rightUuvState === "normal"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("right", "litiasis")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      rightUuvState === "litiasis"
                        ? "bg-amber-950 text-amber-300 border-amber-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Lito / Cálculo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("right", "ureterocele")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      rightUuvState === "ureterocele"
                        ? "bg-indigo-950 text-indigo-300 border-indigo-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Uréterocele
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("right", "no_descrito")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      rightUuvState === "no_descrito"
                        ? "bg-slate-800 border-slate-750 text-slate-200"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    No Descrito
                  </button>
                </div>

                {/* Manual control */}
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-[8px] uppercase font-mono font-bold text-slate-500">Descripción manual:</span>
                  <input
                    type="text"
                    value={rightUuvManualText}
                    onChange={(e) => handleUuvManualTextChange("right", e.target.value)}
                    placeholder="Ej. Lito enclavado de 3.5mm..."
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[9.5px] text-slate-250 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* UUV IZQUIERDA */}
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-850 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">UUV Izquierda</span>
                  <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border ${
                    leftUuvState === "no_descrito" ? "bg-slate-950 text-slate-500 border-slate-900" :
                    leftUuvState === "normal" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/20" :
                    "bg-amber-950/40 text-amber-400 border-amber-900/20"
                  }`}>
                    {leftUuvState === "litiasis" ? "lito" : leftUuvState.replace("_", " ")}
                  </span>
                </div>

                {/* Predefined toggles */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("left", "normal")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      leftUuvState === "normal"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("left", "litiasis")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      leftUuvState === "litiasis"
                        ? "bg-amber-950 text-amber-300 border-amber-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Lito / Cálculo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("left", "ureterocele")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      leftUuvState === "ureterocele"
                        ? "bg-indigo-950 text-indigo-300 border-indigo-700"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    Uréterocele
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUuvStateChange("left", "no_descrito")}
                    className={`py-1 px-1.5 text-[9px] rounded font-bold border transition-all cursor-pointer truncate ${
                      leftUuvState === "no_descrito"
                        ? "bg-slate-800 border-slate-750 text-slate-200"
                        : "bg-slate-950 border-slate-850 hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    No Descrito
                  </button>
                </div>

                {/* Manual control */}
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-[8px] uppercase font-mono font-bold text-slate-500">Descripción manual:</span>
                  <input
                    type="text"
                    value={leftUuvManualText}
                    onChange={(e) => handleUuvManualTextChange("left", e.target.value)}
                    placeholder="Ej. Lito enclavado de 3.5mm..."
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[9.5px] text-slate-250 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STATES SELECTION FOR SPECIFIC STRUCTURE */}
          <div className="bg-slate-950/50 border border-slate-850/70 p-4 rounded-xl flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Estado Clínico de {getActiveStructureLabel()}:</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                  states[selectedStructure] === "no_descrito" ? "bg-slate-900 text-slate-500 border-slate-800" :
                  states[selectedStructure] === "normal" ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/40" :
                  "bg-amber-950/50 text-amber-400 border-amber-900/40"
                }`}>
                  {states[selectedStructure]?.toUpperCase()}
                </span>
              </div>

              {/* Custom State Input */}
              <div className="flex flex-col gap-2 mt-3">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                  Diagnóstico / Hallazgo Clínico (Sinopsis):
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={
                      states[selectedStructure] === "no_descrito" 
                        ? "" 
                        : states[selectedStructure] === "normal" 
                          ? "Normal" 
                          : states[selectedStructure]
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      let nextVal = val;
                      if (val.trim().toLowerCase() === "normal" || val.trim().toLowerCase() === "sin lesiones") {
                        nextVal = "normal";
                      } else if (val.trim() === "") {
                        nextVal = "no_descrito";
                      }
                      handleStateChange(selectedStructure, nextVal);
                    }}
                    placeholder="Escriba el diagnóstico del hallazgo (ej: Litiasis, Quiste, etc.)"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-550"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStateChange(selectedStructure, "normal")}
                      className={`flex-1 py-1.5 px-3 text-[10px] rounded-lg border transition-all cursor-pointer ${
                        states[selectedStructure] === "normal"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-medium"
                          : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400"
                      }`}
                    >
                      ✓ Cons. Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                      className={`flex-1 py-1.5 px-3 text-[10px] rounded-lg border transition-all cursor-pointer ${
                        states[selectedStructure] === "no_descrito"
                          ? "bg-slate-850 border-slate-600 text-slate-100 font-medium"
                          : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400"
                      }`}
                    >
                      ⚪ No Descrito
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* DESCRIPTION SINOPSIS */}
            {states[selectedStructure] !== "no_descrito" && (
              <div className="flex flex-col gap-1.5 border-t border-slate-850/60 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider font-mono">
                    Hallazgos / Sinopsis:
                  </label>
                  <span className="text-[9px] text-slate-500 italic">Español</span>
                </div>
                
                <textarea
                  className="w-full bg-slate-950 border-2 border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl p-2.5 text-xs text-slate-100 font-bold min-h-[60px] resize-y"
                  value={customDescriptions[selectedStructure] || ""}
                  onChange={(e) => handleDescriptionChange(selectedStructure, e.target.value)}
                  placeholder="Redacta la descripción sinóptica del hallazgo patológico o normalidad..."
                  maxLength={120}
                />
                
                <p className="text-[9.5px] text-slate-500 italic mt-0.5 leading-relaxed">
                  {states[selectedStructure] === "normal" 
                    ? "Para estructuras normales, la descripción establecida es obligatoriamente: Dentro de límites normales."
                    : "Idealmente redacta resúmenes compactos de 2 a 7 palabras para asegurar que encaje de manera óptima en el cuadro sinóptico."
                  }
                </p>
              </div>
            )}
          </div>

          {/* Mapeo de Hallazgos Clínicos Sintonizados (aligned anatomical cards) */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-[11px] font-black text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              Mapeo de Hallazgos Clínicos Sintonizados (Vías Urinarias)
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.keys(states).filter(id => states[id] !== "no_descrito" && states[id] !== "normal" && id !== "include_uuv").map(id => {
                const s = states[id];
                const isSelected = selectedStructure === id;
                const transLabel = id === "right_kidney" ? "Riñón Derecho" : 
                                   id === "left_kidney" ? "Riñón Izquierdo" : 
                                   id === "right_ureter" ? "Uréter Derecho" : 
                                   id === "left_ureter" ? "Uréter Izquierdo" : 
                                   id === "right_uvj" ? "UUV Derecha" :
                                   id === "left_uvj" ? "UUV Izquierda" :
                                   id === "bladder" ? "Vejiga Urinaria" : 
                                   id === "prostate" ? "Próstata" : id;
                const simplified = customDescriptions[id]?.trim() || (s === "normal" ? "Dentro de límites normales" : s);
                
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-450 border-emerald-900/30";
                } else if (s.includes("leve") || s.includes("quiste_simple") || s.includes("ectasia_leve") || s.includes("calcificaciones") || s.includes("residuo_postmiccional")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s.includes("ruptura") || s.includes("litiasis_impactada") || s.includes("ectasia_severa") || s.includes("neoplasia") || s.includes("hematuria")) {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
                } else {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-400 border-pink-905/35";
                }
 
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => {
                      setSelectedStructure(id);
                      const relatedPlan = (id === "bladder" || id === "prostate" || id === "right_uvj" || id === "left_uvj") ? "vesical" : "renal";
                      setActivePlan(relatedPlan);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 relative overflow-hidden group cursor-pointer ${
                      isSelected 
                        ? "bg-slate-900 border-indigo-500 text-indigo-400 shadow-md scale-[1.01]" 
                        : "bg-slate-950/60 hover:bg-slate-950/80 border-slate-850/40 text-slate-350"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none w-full select-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className={`text-[10px] font-black uppercase tracking-wide truncate ${isSelected ? "text-indigo-400" : "text-slate-200"}`}>
                          {transLabel}
                        </span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                        {s.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-450 truncate mt-0.5 max-w-full">
                      {simplified}
                    </p>
                  </button>
                );
              })}

              {additionalFindings && additionalFindings.map((item) => {
                const s = item.state || "Alterado";
                const dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                const badgeBg = "bg-rose-950/40 text-rose-450 border-rose-900/30";
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border border-slate-850 bg-slate-950/60 text-left transition-all hover:bg-slate-950/80 hover:border-slate-800 flex flex-col gap-1 relative overflow-hidden group cursor-default"
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none select-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className="text-[10px] font-black uppercase tracking-wide truncate text-slate-200">
                          {item.structureName}
                        </span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                        {s}
                      </span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-400 truncate mt-0.5 max-w-full">
                      {item.description}
                    </p>
                  </div>
                );
              })}

              {Object.keys(states).filter(id => states[id] !== "no_descrito" && states[id] !== "normal").length === 0 && (!additionalFindings || additionalFindings.length === 0) && (
                <div className="col-span-full py-4 text-center text-slate-500 italic text-xs">
                  Sin hallazgos patológicos relevantes detectados.
                </div>
              )}
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={exportTableData}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer border border-indigo-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe actual"
              >
                <Download className="h-3 w-3" />
                Insertar Tabla
              </button>
              <button
                type="button"
                onClick={exportNarrativeNarratolog}
                className="py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-950 transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer"
                title="Inyecta un resumen narrativo de hallazgos al reporte"
              >
                📥 Insertar Viñetas
              </button>
            </div>
          </div>

          {/* RECENT SYNC LOGS OR LOGS CONSOLE */}
          {syncLogs.length > 0 && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 max-h-[140px] overflow-y-auto">
              <span className="text-[9px] font-mono font-bold text-slate-400 block mb-1 uppercase tracking-wider">Historial de Sincronización:</span>
              <div className="space-y-1">
                {syncLogs.slice(-4).map((log, i) => (
                  <p key={i} className="text-[9px] font-mono text-slate-400 leading-normal border-l-2 border-emerald-500/50 pl-1.5 py-0.5">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
