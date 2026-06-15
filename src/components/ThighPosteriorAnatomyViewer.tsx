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

interface ThighPosteriorAnatomyViewerProps {
  generatedReport: string;
  onChangeReport?: (newReport: string) => void;
  onExportTable: (tableText: string) => void;
  onExportNarrative?: (narrativeText: string) => void;
  includeInReport?: boolean;
  setIncludeInReport?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
  selectedModel?: string;
}

interface ThighPosteriorStructure {
  id: string;
  name: string;
  description: string;
}

export default function ThighPosteriorAnatomyViewer({
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions,
  selectedModel
}: ThighPosteriorAnatomyViewerProps) {
  
  // Structures states:
  // - biceps_femoris_lh: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - biceps_femoris_sh: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - semitendinosus: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - semimembranosus: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - sciatic_nerve: no_descrito | normal | neuropatia | engrosamiento
  // - adductor_magnus: no_descrito | normal | contusion | desgarro_parcial | desgarro_completo
  const [states, setStates] = useState<Record<string, string>>({
    biceps_femoris_lh: "normal",
    biceps_femoris_sh: "normal",
    semitendinosus: "normal",
    semimembranosus: "normal",
    sciatic_nerve: "normal",
    adductor_magnus: "normal"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    biceps_femoris_lh: "Dentro de límites normales.",
    biceps_femoris_sh: "Dentro de límites normales.",
    semitendinosus: "Dentro de límites normales.",
    semimembranosus: "Dentro de límites normales.",
    sciatic_nerve: "Dentro de límites normales.",
    adductor_magnus: "Dentro de límites normales."
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("biceps_femoris_lh");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);

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
      case "biceps_femoris_lh":
        return [
          "biceps femoral cabeza larga", "bíceps femoral cabeza larga", 
          "cabeza larga del bíceps", "cabeza larga del biceps", 
          "bíceps femoral (lh)", "biceps femoral (lh)", "bíceps largo", "biceps largo"
        ];
      case "biceps_femoris_sh":
        return [
          "biceps femoral cabeza corta", "bíceps femoral cabeza corta", 
          "cabeza corta del bíceps", "cabeza corta del biceps", 
          "bíceps femoral (sh)", "biceps femoral (sh)", "bíceps corto", "biceps corto"
        ];
      case "semitendinosus":
        return [
          "semitendinoso", "semitendinous", "músculo semitendinoso", "musculo semitendinoso", "m. semitendinoso"
        ];
      case "semimembranosus":
        return [
          "semimembranoso", "semimembranous", "músculo semimembranoso", "musculo semimembranoso", "m. semimembranoso"
        ];
      case "sciatic_nerve":
        return [
          "nervio ciático", "nervio ciatico", "ciático", "ciatico", "n. ciático", "n. ciatico", "nervios ciáticos"
        ];
      case "adductor_magnus":
        return [
          "aductor mayor", "aductor magno", "adductor magnus", "m. aductor mayor", "aductor posterior", "fuste posterior del aductor"
        ];
      default:
        return [];
    }
  };

  const parseStateFromText = (id: string, text: string): string => {
    if (!text) return "no_descrito";
    const lower = text.toLowerCase().trim();

    // Verification helper
    const hasWord = (words: string[]): boolean => words.some(w => lower.includes(w));

    // Negations list
    const negations = [
      "sin", "no se", "no hay", "no presenta", "ausencia de", "descart", "libre de",
      "negativo", "no evidencia", "sin evidencia", "no se evidencia", "sin signos",
      "no presenta signos", "no se observa", "no se observan", "no se aprecian",
      "no se aprecia", "no muestra", "normal sin", "conservado sin", "sano sin",
      "íntegro sin", "integro sin", "no asocia", "sin asociar"
    ];

    // Check if finding is negated
    const isNegated = (keywords: string[]): boolean => {
      for (const kw of keywords) {
        let index = lower.indexOf(kw);
        if (index !== -1) {
          const priorText = lower.substring(Math.max(0, index - 50), index);
          if (negations.some(neg => priorText.includes(neg))) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper to verify a keyword is both present AND not preceded by a negation keyword (not negated)
    const isWordActive = (words: string[]): boolean => {
      for (const w of words) {
        let index = lower.indexOf(w);
        if (index !== -1) {
          const priorText = lower.substring(Math.max(0, index - 50), index);
          if (negations.some(neg => priorText.includes(neg))) {
            continue; // this occurrence is negated, keep searching for other occurrences or words
          }
          return true; // found active instance
        }
      }
      return false;
    };

    const isNormal = hasWord(["normal", "conservad", "integro", "íntegr", "sin lesiones", "sin hallazgos patológicos", "sin ruptura", "morfología habitual", "sin alteraciones", "sin anomalías", "habitual", "adecuad", "sin desgarros"]);
    const hasTear = hasWord(["desgarro", "ruptura", "rotura", "miofascial", "intramuscular", "hematoma", "colección", "discontinuidad", "brecha", "microcolección", "microcoleccion", "desestructurac", "grado i", "grado 1", "grado ii", "grado 2"]);

    if (isNormal && !hasTear) return "normal";

    switch (id) {
      case "biceps_femoris_lh":
      case "biceps_femoris_sh":
      case "semitendinosus":
      case "semimembranosus":
        if (hasTear) {
          if (isNegated(["desgarro", "ruptura", "rotura", "miofascial", "intramuscular"])) return "normal";
          
          const isParcialGrade = hasWord(["parcial", "grado i", "grado 1", "grado ii", "grado 2", "leve", "moderad", "subtotal", "fibrilar"]);
          if (isParcialGrade) {
            if (hasWord(["miofascial", "periféric", "aponeurót"])) return "desgarro_miofascial";
            return "desgarro_intramuscular";
          }
          
          if (isWordActive(["completo", "total", "retract", "espesor completo"])) return "desgarro_completo";
          if (hasWord(["intramuscular", "sustancia"])) return "desgarro_intramuscular";
          if (hasWord(["miofascial", "periféric", "aponeurót"])) return "desgarro_miofascial";
          return "desgarro_intramuscular"; // Default tear if unspecified
        }
        return isNormal ? "normal" : "no_descrito";

      case "sciatic_nerve":
        if (hasWord(["neuropatía", "neuropatia", "edema", "fascicular", "pérdida de patrón", "neuronal"])) {
          if (isNegated(["neuropatía", "neuropatia", "edema", "pérdida"])) return "normal";
          return "neuropatia";
        }
        if (hasWord(["engrosamiento", "engrosado", "hipertrofia", "reactivo"])) {
          if (isNegated(["engrosamiento", "engrosado", "hipertrofia"])) return "normal";
          return "engrosamiento";
        }
        return isNormal ? "normal" : "no_descrito";

      case "adductor_magnus":
        if (hasTear) {
          if (isNegated(["desgarro", "ruptura"])) return "normal";
          const isParcialGrade = hasWord(["parcial", "grado i", "grado 1", "grado ii", "grado 2", "leve", "moderad", "subtotal", "fibrilar", "intramuscular"]);
          if (isParcialGrade) return "desgarro_parcial";
          if (isWordActive(["completo", "total"])) return "desgarro_completo";
          return "desgarro_parcial";
        }
        if (hasWord(["contusión", "edema", "golpe", "trauma"])) {
          if (isNegated(["contusión", "contusion", "edema", "golpe", "trauma"])) return "normal";
          return "contusion";
        }
        return isNormal ? "normal" : "no_descrito";

      default:
        return "no_descrito";
    }
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
      case "biceps_femoris_lh": return "Bíceps Femoral (LH)";
      case "biceps_femoris_sh": return "Bíceps Femoral (SH)";
      case "semitendinosus": return "M. Semitendinoso";
      case "semimembranosus": return "M. Semimembranoso";
      case "sciatic_nerve": return "Nervio Ciático";
      case "adductor_magnus": return "M. Aductor Mayor";
      default: return id;
    }
  };

  const getSimplifiedDescriptionByState = (id: string, state: string): string => {
    if (state === "no_descrito") return "No mencionado / No descrito.";
    if (state === "normal") return "Dentro de límites normales.";

    switch (id) {
      case "biceps_femoris_lh":
        if (state === "desgarro_miofascial") return "Desgarro miofascial periférico de la cabeza larga con líquido laminar.";
        if (state === "desgarro_intramuscular") return "Desgarro intramuscular grado II (espesor parcial) en fuste distal.";
        if (state === "desgarro_completo") return "Ruptura completa fibrilar de cabeza larga con retracción miotendinosa.";
        break;
      case "biceps_femoris_sh":
        if (state === "desgarro_miofascial") return "Desgarro miofascial de cabeza corta con fina película líquida adyacente.";
        if (state === "desgarro_intramuscular") return "Foco de desgarro intramuscular de espesor parcial grado II en el vientre muscular.";
        if (state === "desgarro_completo") return "Brecha completa líquida musculofibrilar con retracción distal.";
        break;
      case "semitendinosus":
        if (state === "desgarro_miofascial") return "Desgarro miofascial periférico medial leve con edema laminar.";
        if (state === "desgarro_intramuscular") return "Foco de desgarro grado II en porción media de fuste carnoso.";
        if (state === "desgarro_completo") return "Disrupción completa de patrón fibrilar del semitendinoso con hematoma interposicional.";
        break;
      case "semimembranosus":
        if (state === "desgarro_miofascial") return "Fino edema circunferencial miofascial compatible con distensión periférica.";
        if (state === "desgarro_intramuscular") return "Desgarro del fuste profundo grado II con colección intramuscular.";
        if (state === "desgarro_completo") return "Rotura completa miotendinosa con retracción libre proximal.";
        break;
      case "sciatic_nerve":
        if (state === "neuropatia") return "Neuropatía del ciático con pérdida de patrón fascicular y edema perineural adyacente.";
        if (state === "engrosamiento") return "Engrosamiento reactivo de los fascículos cilíndricos, sin signos de discontinuidad.";
        break;
      case "adductor_magnus":
        if (state === "contusion") return "Foco contusivo directo del vientre posterior con edema focal moderado.";
        if (state === "desgarro_parcial") return "Desgarro en espesor parcial grado II, sin retracción de extremos.";
        if (state === "desgarro_completo") return "Ruptura de fibras posterior completa con colección anecóica franca.";
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

    const structureKeys = ["biceps_femoris_lh", "biceps_femoris_sh", "semitendinosus", "semimembranosus", "sciatic_nerve", "adductor_magnus"];
    let parsedCount = 0;
    let foundPathologies = 0;

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => generatedReport.toLowerCase().includes(kw));

      if (isMentioned) {
        const extractedFindings = extractDescriptionFromReportText(id, generatedReport);
        let parsedState = parseStateFromText(id, extractedFindings || "");
        if (parsedState === "no_descrito") {
          parsedState = "normal";
        }
        
        updatedStates[id] = parsedState;
        updatedDescriptions[id] = extractedFindings || getSimplifiedDescriptionByState(id, parsedState);
        
        parsedCount++;
        if (parsedState !== "normal") foundPathologies++;
        logs.push(`[Sincronización Local] ${translateStructureLabelInBrief(id)}: ${parsedState.toUpperCase()}`);
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Muslo Posterior (${generatedReport.length} caracteres)...`);
    
    const structures = [
      {
        id: "biceps_femoris_lh",
        label: "Bíceps Femoral LH",
        allowedStates: ["no_descrito", "normal", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo"]
      },
      {
        id: "biceps_femoris_sh",
        label: "Bíceps Femoral SH",
        allowedStates: ["no_descrito", "normal", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo"]
      },
      {
        id: "semitendinosus",
        label: "Semitendinoso",
        allowedStates: ["no_descrito", "normal", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo"]
      },
      {
        id: "semimembranosus",
        label: "Semimembranoso",
        allowedStates: ["no_descrito", "normal", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo"]
      },
      {
        id: "sciatic_nerve",
        label: "Nervio Ciático",
        allowedStates: ["no_descrito", "normal", "neuropatia", "engrosamiento"]
      },
      {
        id: "adductor_magnus",
        label: "Aductor Mayor",
        allowedStates: ["no_descrito", "normal", "contusion", "desgarro_parcial", "desgarro_completo"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Muslo Posterior",
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
            logs.push(`[Hallazgo] ${struc.label}: ${apiState.toUpperCase()} \n  ↳ ${apiDesc}`);
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con IA. Sincronizadas ${parsedCount} estructuras cumpliendo fidelidad de reporte clínica (${foundPathologies} patologías detectadas).`);
      } else {
        logs.push(`[Error API] No se pudo obtener el análisis estructurado. Espere un momento e intente nuevamente.`);
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía de muslo posterior:", err);
      logs.push(`[Error de red] ${err.message || String(err)}.`);
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

  const handleUpdateStructureState = (id: string, nextState: string) => {
    const nextDesc = getSimplifiedDescriptionByState(id, nextState);
    
    setStates(prev => {
      const next = { ...prev, [id]: nextState };
      setSyncLogs(log => [...log, `Cambio manual en ${translateStructureLabelInBrief(id)} -> ${nextState.toUpperCase()}`]);
      return next;
    });

    setCustomDescriptions(prev => ({ ...prev, [id]: nextDesc }));

    if (useOriginalReportText) {
      const updatedReportText = updateReportTextWithStructure(id, generatedReport, nextDesc);
      if (onChangeReport) {
        onChangeReport(updatedReportText);
      }
    }
  };

  const handleUpdateCustomDescription = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
    if (useOriginalReportText) {
      const updatedReportText = updateReportTextWithStructure(id, generatedReport, text);
      if (onChangeReport) {
        onChangeReport(updatedReportText);
      }
    }
  };

  const updateReportTextWithStructure = (id: string, reportText: string, newDescription: string): string => {
    if (!reportText) return reportText;
    const lines = reportText.split("\n");
    const keywords = getStructureKeywords(id);
    let structureUpdated = false;

    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      const matches = keywords.some(kw => lowerLine.includes(kw));
      if (matches) {
        const colonIdx = lines[i].indexOf(":");
        if (colonIdx !== -1) {
          const prefix = lines[i].substring(0, colonIdx + 1);
          lines[i] = `${prefix} ${newDescription}`;
          structureUpdated = true;
          break;
        }
      }
    }

    if (!structureUpdated) {
      return reportText;
    }

    return lines.join("\n");
  };

  const getDefaultDescription = (id: string, state: string): string => {
    if (state === "no_descrito") return "Estructura no descrita.";
    if (state === "normal") return "Dentro de límites normales.";

    switch (id) {
      case "biceps_femoris_lh":
        if (state === "desgarro_miofascial") return "Bíceps femoral cabeza larga con desgarro miofascial periférico grado I, asociado a fina película de líquido laminar en la interfase fascial adyacente.";
        if (state === "desgarro_intramuscular") return "Bíceps femoral cabeza larga muestra área focal de discontinuidad fibrilar con hematoma intramuscular contenido grado II.";
        if (state === "desgarro_completo") return "Ruptura completa de la unión miotendinosa del vientre muscular con retracción fibrilar manifiesta.";
        break;
      case "biceps_femoris_sh":
        if (state === "desgarro_miofascial") return "Bíceps femoral cabeza corta con foco de desgarro periférico en interfase fascial adyacente.";
        if (state === "desgarro_intramuscular") return "Foco de desgarro intramuscular de espesor parcial grado II en fuste de cabeza corta del bíceps femoral.";
        if (state === "desgarro_completo") return "Ruptura de fibras de espesor completo de fuste muscular distal de cabeza corta del bíceps femoral con brecha líquida.";
        break;
      case "semitendinosus":
        if (state === "desgarro_miofascial") return "Músculo semitendinoso con alteración de la ecogenicidad periférica con líquido laminar en receso fascial medial.";
        if (state === "desgarro_intramuscular") return "Músculo semitendinoso con foco de desgarro de espesor parcial grado II en fuste medio.";
        if (state === "desgarro_completo") return "Rotura musculofibrilar completa con retracción de extremos y pérdida del patrón fibrilar habitual.";
        break;
      case "semimembranosus":
        if (state === "desgarro_miofascial") return "Finas bandas líquidas en interfase miofascial anterior del semimembranoso, sugiriendo desgarro leve.";
        if (state === "desgarro_intramuscular") return "Semimembranoso con desgarro intramuscular grado II con hematoma contenido en planos profundos.";
        if (state === "desgarro_completo") return "Rotura completa miotendinosa con retracción fibrilar manifiesta e interposición líquida.";
        break;
      case "sciatic_nerve":
        if (state === "neuropatia") return "Engrosamiento cilíndrico e hipoecogenicidad del nervio ciático con pérdida de su patrón fascicular característico y edema perineural adyacente.";
        if (state === "engrosamiento") return "Hipertrofia o engrosamiento reactivo de los fascículos del nervio ciático, sin disrupción de su continuidad.";
        break;
      case "adductor_magnus":
        if (state === "contusion") return "Edema reactivo difuso e hiperecogenicidad focal del aductor mayor compatible con foco contusivo directo.";
        if (state === "desgarro_parcial") return "Desgarro de fuste muscular de espesor parcial grado II del compartimento posterior del aductor mayor.";
        if (state === "desgarro_completo") return "Disrupción completa fibrilar de inserción posterior del aductor mayor con colección anecóica franca.";
        break;
    }
    return "Estructura alterada.";
  };

  const generateTableMarkdown = () => {
    let md = `| Estructura Anatómica | Detalle / Descripción de Hallazgos Clínicos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "biceps_femoris_lh", label: "Bíceps Femoral - Cabeza Larga (Superficial)" },
      { id: "biceps_femoris_sh", label: "Bíceps Femoral - Cabeza Corta (Profundo)" },
      { id: "semitendinosus", label: "Músculo Semitendinoso (Superficial)" },
      { id: "semimembranosus", label: "Músculo Semimembranoso (Superficial)" },
      { id: "sciatic_nerve", label: "Nervio Ciático (Profundo)" },
      { id: "adductor_magnus", label: "Compartimento Posterior Aductor Mayor" }
    ];

    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
      }
    });

    return md;
  };

  const generateNarrativeText = () => {
    const list = [
      { id: "biceps_femoris_lh", label: "Bíceps Femoral C. Larga" },
      { id: "biceps_femoris_sh", label: "Bíceps Femoral C. Corta" },
      { id: "semitendinosus", label: "Músculo Semitendinoso" },
      { id: "semimembranosus", label: "Músculo Semimembranoso" },
      { id: "sciatic_nerve", label: "Nervio Ciático" },
      { id: "adductor_magnus", label: "Músculo Aductor Mayor" }
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

    if (!md) {
      md = "* *No se han registrado hallazgos patológicos en Muslo Posterior.*";
    }

    return md;
  };

  const getSeverityBadge = (s: string) => {
    if (s === "no_descrito") return "bg-slate-900 text-slate-500 border-slate-850";
    if (s === "normal") return "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
    if (s === "neuropatia" || s === "engrosamiento" || s === "contusion" || s === "desgarro_miofascial" || s === "desgarro_parcial") {
      return "bg-amber-950/40 text-amber-550 border-amber-900/40";
    }
    if (s === "desgarro" || s === "desgarro_intramuscular") {
      return "bg-pink-950/40 text-pink-550 border-pink-900/40";
    }
    if (s === "desgarro_completo") {
      return "bg-rose-950/50 text-rose-500 border-rose-900/50";
    }
    return "bg-slate-900 text-slate-400";
  };

  const getColorForSVG = (id: string) => {
    const s = states[id];
    if (s === "no_descrito") {
      return {
        fill: activeHover === id ? "rgba(71, 85, 105, 0.25)" : "none",
        stroke: activeHover === id ? "#64748b" : "#475569"
      };
    }
    if (s === "normal") {
      return {
        fill: activeHover === id ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.22)",
        stroke: "#10b981"
      };
    }
    if (s === "neuropatia" || s === "engrosamiento" || s === "contusion" || s === "desgarro_miofascial" || s === "desgarro_parcial") {
      return {
        fill: activeHover === id ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.18)",
        stroke: "#f59e0b"
      };
    }
    if (s === "desgarro" || s === "desgarro_intramuscular") {
      return {
        fill: activeHover === id ? "rgba(236, 72, 153, 0.55)" : "rgba(236, 72, 153, 0.28)",
        stroke: "#ec4899"
      };
    }
    if (s === "desgarro_completo") {
      return {
        fill: activeHover === id ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
        stroke: "#f43f5e"
      };
    }
    return { fill: "none", stroke: "#475569" };
  };

  return (
    <div className="w-full flex flex-col gap-6" id="thigh-posterior-anatomy-container">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-650/10 border border-violet-500/20 rounded-2xl">
            <Activity className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              Hallazgos Interactivos: Muslo Posterior
              <Sparkles className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Sincronización bidireccional inteligente de ecografía muscular de fuste posterior de muslo (Isquiotibiales y Ciático).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-350 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-mono"
            title="Escanear y recopilar del informe médico actual"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-violet-455" : ""}`} />
            Sincronizar
          </button>

          <label className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 font-mono cursor-pointer">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport && setIncludeInReport(e.target.checked)}
              className="rounded text-violet-550 focus:ring-transparent h-3 w-3 bg-slate-950 border-slate-800"
            />
            Incluir Esquema en PDF
          </label>
        </div>
      </div>

      {/* DUAL WORKSPACE LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* INTERACTIVE DIAGRAMS (1 xl:col-span-7) */}
        <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* SVG 1: PLANO SUPERFICIAL */}
          <div className="relative bg-slate-950/40 p-4 rounded-2xl border border-slate-850 flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider font-mono self-start mb-1 h-3.5 px-2 bg-violet-950/30 border border-violet-900/40 rounded-full flex items-center">
              Plano Superficial Posterior
            </span>
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800 text-[7px] font-bold text-slate-500 uppercase font-mono">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
              Superficial
            </div>

            <div className="w-full flex items-center justify-center py-2 mt-4">
              <svg 
                id="thigh-posterior-superficial-svg"
                viewBox="0 0 350 350" 
                className="w-full max-w-[240px] h-[240px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="thighPostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                </defs>

                {/* Guidelines */}
                <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
                <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

                {/* Thigh Contour */}
                <path 
                  d="M 90,30 C 95,120 100,220 120,320 L 230,320 C 250,220 255,120 260,30 Z" 
                  fill="url(#thighPostGrad)" 
                  stroke="#334155" 
                  strokeWidth="1.2" 
                />
                
                {/* 1. Bíceps Femoral Cabeza Larga (Lateral / Visually Left) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("biceps_femoris_lh")}
                  onMouseEnter={() => setActiveHover("biceps_femoris_lh")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 95,30 C 135,50 145,150 145,230 C 145,290 120,310 115,310 L 155,305 C 165,220 160,110 145,30 Z" 
                    fill={getColorForSVG("biceps_femoris_lh").fill} 
                    stroke={getColorForSVG("biceps_femoris_lh").stroke} 
                    strokeWidth={states.biceps_femoris_lh !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="130" y="160" fill="#cbd5e1" fontSize="7" fontWeight="black" textAnchor="middle" transform="rotate(-65, 130, 160)">BÍCEPS FEMORAL LH</text>
                </g>

                {/* 2. Semitendinoso (Medial / Visually Right) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("semitendinosus")}
                  onMouseEnter={() => setActiveHover("semitendinosus")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 175,35 C 190,110 195,190 205,305 L 182,312 C 165,190 162,110 155,35 Z" 
                    fill={getColorForSVG("semitendinosus").fill} 
                    stroke={getColorForSVG("semitendinosus").stroke} 
                    strokeWidth={states.semitendinosus !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="178" y="130" fill="#cbd5e1" fontSize="7" fontWeight="black" textAnchor="middle" transform="rotate(78, 178, 130)">SEMITENDINOSO</text>
                </g>

                {/* 3. Semimembranoso (Medial, deep-running but visible superficially on margins) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("semimembranosus")}
                  onMouseEnter={() => setActiveHover("semimembranosus")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 195,40 C 220,100 225,190 215,300 L 245,280 C 248,190 235,100 215,40 Z" 
                    fill={getColorForSVG("semimembranosus").fill} 
                    stroke={getColorForSVG("semimembranosus").stroke} 
                    strokeWidth={states.semimembranosus !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="225" y="150" fill="#94a3b8" fontSize="6.5" fontWeight="bold" textAnchor="middle" transform="rotate(75, 225, 150)">SEMIMEMBRANOSO</text>
                </g>
              </svg>
            </div>
          </div>

          {/* SVG 2: PLANO PROFUNDO */}
          <div className="relative bg-slate-950/40 p-4 rounded-2xl border border-slate-850 flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider font-mono self-start mb-1 h-3.5 px-2 bg-violet-950/30 border border-violet-900/40 rounded-full flex items-center">
              Plano Profundo Posterior
            </span>
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800 text-[7px] font-bold text-slate-500 uppercase font-mono">
              <span className="h-1 w-1 rounded-full bg-cyan-500 animate-pulse"></span>
              Profundo
            </div>

            <div className="w-full flex items-center justify-center py-2 mt-4">
              <svg 
                id="thigh-posterior-deep-svg"
                viewBox="0 0 350 350" 
                className="w-full max-w-[240px] h-[240px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="femurPostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2e3d52" />
                    <stop offset="100%" stopColor="#111827" />
                  </linearGradient>
                </defs>

                {/* Guidelines */}
                <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
                <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

                {/* Thigh Contour Outline */}
                <path 
                  d="M 90,30 C 95,120 100,220 120,320 L 230,320 C 250,220 255,120 260,30 Z" 
                  fill="none" 
                  stroke="#334155" 
                  strokeWidth="1.2" 
                  strokeDasharray="4,4"
                />

                {/* Femur (Visual Reference) */}
                <path 
                  d="M 165,30 L 185,30 L 185,290 C 193,295 198,300 198,308 C 198,318 152,318 152,308 C 152,300 157,295 165,290 Z" 
                  fill="url(#femurPostGrad)" 
                  stroke="#475569" 
                  strokeWidth="1.2" 
                />
                <text x="175" y="70" fill="#90a4ae" fontSize="7" fontWeight="bold" textAnchor="middle">FEMUR</text>

                {/* 4. Bíceps Femoral Cabeza Corta (Visually Lateral Deep / Left) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("biceps_femoris_sh")}
                  onMouseEnter={() => setActiveHover("biceps_femoris_sh")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 115,100 C 110,160 115,220 135,280 L 160,260 C 145,210 140,160 140,100 Z" 
                    fill={getColorForSVG("biceps_femoris_sh").fill} 
                    stroke={getColorForSVG("biceps_femoris_sh").stroke} 
                    strokeWidth={states.biceps_femoris_sh !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="130" y="180" fill="#cbd5e1" fontSize="7" fontWeight="black" textAnchor="middle" transform="rotate(-75, 130, 180)">BÍCEPS SH</text>
                </g>

                {/* 5. Aductor Mayor - Compartimento Posterior (Visually Medial Deep / Right) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("adductor_magnus")}
                  onMouseEnter={() => setActiveHover("adductor_magnus")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 188,90 C 215,140 220,195 210,270 L 180,270 C 185,210 182,150 178,90 Z" 
                    fill={getColorForSVG("adductor_magnus").fill} 
                    stroke={getColorForSVG("adductor_magnus").stroke} 
                    strokeWidth={states.adductor_magnus !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="194" y="170" fill="#e2e8f0" fontSize="7" fontWeight="bold" textAnchor="middle" transform="rotate(78, 194, 170)">ADUCTOR MAYOR</text>
                </g>

                {/* 6. Nervio Ciático (Glow path running down the middle) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("sciatic_nerve")}
                  onMouseEnter={() => setActiveHover("sciatic_nerve")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Outer glow aura */}
                  <path 
                    d="M 153,60 C 158,140 156,220 151,290" 
                    fill="none" 
                    stroke={states.sciatic_nerve === "no_descrito" ? "rgba(100,116,139,0.1)" : "rgba(234,179,8,0.25)"} 
                    strokeWidth="15" 
                    strokeLinecap="round"
                  />
                  {/* Core nerve line */}
                  <path 
                    d="M 153,60 C 158,140 156,220 151,290" 
                    fill="none" 
                    stroke={getColorForSVG("sciatic_nerve").stroke === "#475569" ? "#eab308" : getColorForSVG("sciatic_nerve").stroke} 
                    strokeWidth={states.sciatic_nerve !== "no_descrito" ? "3" : "1.5"}
                    strokeDasharray={states.sciatic_nerve === "normal" ? "none" : "3,3"} 
                    strokeLinecap="round"
                  />
                  {/* Small neon pulsing point */}
                  <circle cx="155.5" cy="175" r={states.sciatic_nerve !== "normal" ? "4.5" : "3"} fill="#facc15" className="animate-pulse" />
                  <text x="156" y="210" fill="#fef08a" fontSize="7" fontWeight="black" textAnchor="start" transform="rotate(-88, 156, 210)">NERVIO CIÁTICO</text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* EDITOR CONTROL PANEL (2 xl:col-span-5) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
            <h5 className="text-[10px] text-violet-400 font-black uppercase tracking-wider font-mono mb-2">
              Modificador de Estructura Selecciónada
            </h5>
            
            {/* SELECTOR DROPDOWN */}
            <div className="mb-4">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Estructura Activa:</label>
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 focus:outline-none focus:border-violet-500 uppercase font-mono cursor-pointer"
              >
                <option value="biceps_femoris_lh">Bíceps Femoral LH (Superficial)</option>
                <option value="biceps_femoris_sh">Bíceps Femoral SH (Profundo)</option>
                <option value="semitendinosus">M. Semitendinoso (Superficial)</option>
                <option value="semimembranosus">M. Semimembranoso (Superficial)</option>
                <option value="sciatic_nerve">Nervio Ciático (Profundo)</option>
                <option value="adductor_magnus">M. Aductor Mayor (Profundo)</option>
              </select>
            </div>

            {/* STATUS SELECT */}
            <div className="mb-4">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Estado de Hallazgo:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { val: "no_descrito", label: "No Descrito" },
                  { val: "normal", label: "Normal (Sin Lesión)" },
                  
                  // Conditionals for muscle structures
                  ...(selectedStructure === "biceps_femoris_lh" || selectedStructure === "biceps_femoris_sh" || selectedStructure === "semitendinosus" || selectedStructure === "semimembranosus" ? [
                    { val: "desgarro_miofascial", label: "Miofascial (Leve)" },
                    { val: "desgarro_intramuscular", label: "Intramuscular" },
                    { val: "desgarro_completo", label: "Brecha Completa" },
                  ] : []),

                  // Conditionals for Sciatic nerve
                  ...(selectedStructure === "sciatic_nerve" ? [
                    { val: "neuropatia", label: "Neuropatía" },
                    { val: "engrosamiento", label: "Engrosamiento" },
                  ] : []),

                  // Conditionals for Adductor Magnus
                  ...(selectedStructure === "adductor_magnus" ? [
                    { val: "contusion", label: "Contusión" },
                    { val: "desgarro_parcial", label: "Desgarro Parcial" },
                    { val: "desgarro_completo", label: "Completo" },
                  ] : []),

                ].map((st) => (
                  <button
                    key={st.val}
                    onClick={() => handleUpdateStructureState(selectedStructure, st.val)}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-bold uppercase text-left transition-all ${
                      states[selectedStructure] === st.val
                        ? "bg-violet-650/20 border-violet-500 text-violet-450 shadow-inner"
                        : "bg-slate-900 hover:bg-slate-850 border-slate-850 text-slate-400"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DETAILED NARRATIVE OVERRIDE */}
            <div>
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Descripción Integrada en Informe:</label>
              <textarea
                value={customDescriptions[selectedStructure] || getDefaultDescription(selectedStructure, states[selectedStructure])}
                onChange={(e) => handleUpdateCustomDescription(selectedStructure, e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-550 leading-relaxed font-mono"
                placeholder="Escribe la descripción de los hallazgos en tiempo real..."
              />
              <p className="text-[8px] text-slate-500 mt-1">
                La edición de este texto actualiza automáticamente la sección correspondiente del reporte principal.
              </p>
            </div>
          </div>

          {/* REPORT EXPORT / INJECTION HUD */}
          <div className="bg-slate-950/40 rounded-2xl border border-slate-850/60 p-4">
            <h5 className="text-[10px] text-violet-400 font-black uppercase tracking-wider font-mono mb-2">
              Sincronización Bidireccional
            </h5>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-900 mb-2">
              <div className="flex flex-col">
                <span className="text-slate-300 font-extrabold text-[11px]">Sincronización Interactiva</span>
                <span className="text-[9px] text-slate-500">Actualizar informe al cambiar estado</span>
              </div>
              <input
                type="checkbox"
                checked={useOriginalReportText}
                onChange={(e) => setUseOriginalReportText(e.target.checked)}
                className="rounded text-violet-500 focus:ring-transparent h-4 w-4 bg-slate-900 border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 font-mono">
              <button
                onClick={() => onExportTable(generateTableMarkdown())}
                className="py-2 bg-violet-650 hover:bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer border border-violet-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe"
              >
                <Download className="h-3 w-3" />
                Inyectar Tabla
              </button>

              <button
                onClick={() => onExportNarrative && onExportNarrative(generateNarrativeText())}
                className="py-2 bg-slate-900 hover:bg-slate-850 text-violet-450 text-[9px] font-black uppercase tracking-widest rounded-xl border border-violet-955/40 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                title="Inyecta un resumen de hallazgos en viñetas al final del informe"
              >
                📥 Inyectar Viñetas
              </button>
            </div>
          </div>

          {/* ACTIVE STATUS GRID (Max 6) */}
          <div className="bg-slate-950/20 rounded-2xl border border-slate-850 p-4">
            <h5 className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono mb-2.5">
              Sinopsis de Hallazgos Sincronizados
            </h5>
            <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.entries(states).filter(([_, sVal]) => sVal !== "no_descrito").map(([id, sVal]) => {
                const s = sVal as string;
                const label = translateStructureLabelInBrief(id);
                const simplified = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
                return (
                  <div 
                    key={id} 
                    onClick={() => setSelectedStructure(id)}
                    className="p-2 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col justify-between hover:bg-slate-900/40 hover:border-slate-800 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-slate-350 truncate">{label}</span>
                      <span className={`text-[8.5px] font-mono font-black uppercase px-1.5 py-0.2 rounded border ${getSeverityBadge(s)}`}>
                        {s === "normal" ? "normal" : s.replace("desgarro_", "").replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-[8.5px] leading-relaxed text-slate-500 line-clamp-2">{simplified}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* SYNCHRONIZER METRIC LOGS */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-950/20 rounded-xl border border-slate-850 p-3 h-[80px] overflow-y-auto">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider font-mono block mb-1">
            Registro de la Herramienta Bidireccional – Muslo Posterior
          </span>
          {syncLogs.slice(-6).map((log, lIdx) => (
            <div key={lIdx} className="text-[8px] font-mono text-slate-400 py-0.5 border-b border-slate-900 last:border-b-0 leading-normal">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
