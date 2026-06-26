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

interface ThighAnatomyViewerProps {
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

// Thigh anatomy structures
interface ThighStructure {
  id: string;
  name: string;
  description: string;
}

export default function ThighAnatomyViewer({
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
}: ThighAnatomyViewerProps) {
  
  // States of each structure:
  // - rectus_femoris: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - sartorius: no_descrito | normal | tendinopatia | desgarro
  // - iliotibial_band: no_descrito | normal | friccion | desgarro
  // - vastus_medialis: no_descrito | normal | contusion | desgarro
  // States of each structure:
  // - rectus_femoris: no_descrito | normal | desgarro_miofascial | desgarro_intramuscular | desgarro_completo
  // - sartorius: no_descrito | normal | tendinopatia | desgarro
  // - iliotibial_band: no_descrito | normal | friccion | desgarro
  // - vastus_medialis: no_descrito | normal | contusion | desgarro
  // - vastus_lateralis: no_descrito | normal | contusion | desgarro
  // - vastus_intermedius: no_descrito | normal | hernia_muscular | desgarro
  const [states, setStates] = useState<Record<string, string>>({
    rectus_femoris: "normal",
    sartorius: "normal",
    iliotibial_band: "normal",
    vastus_medialis: "normal",
    vastus_lateralis: "normal",
    vastus_intermedius: "normal"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    rectus_femoris: "Dentro de límites normales.",
    sartorius: "Dentro de límites normales.",
    iliotibial_band: "Dentro de límites normales.",
    vastus_medialis: "Dentro de límites normales.",
    vastus_lateralis: "Dentro de límites normales.",
    vastus_intermedius: "Dentro de límites normales."
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("rectus_femoris");
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

  // Dictionary of keywords to match text automatically
  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "rectus_femoris":
        return [
          "recto anterior", "recto femoral", "rectoanterior", "rectofemoral", 
          "músculo recto femoral", "musculo recto femoral", "m. recto anterior"
        ];
      case "sartorius":
        return [
          "sartorio", "músculo sartorio", "musculo sartorio", "m. sartorio"
        ];
      case "iliotibial_band":
        return [
          "tracto iliotibial", "banda iliotibial", "iliotibial", "cintilla iliotibial", "cintilla"
        ];
      case "vastus_medialis":
        return [
          "vasto interno", "vasto medial", "vasto-medial", "vastomedial", 
          "vastointerno", "m. vasto interno", "m. vasto medial"
        ];
      case "vastus_lateralis":
        return [
          "vasto externo", "vasto lateral", "vasto-lateral", "vastolateral", 
          "vastoexterno", "m. vasto externo", "m. vasto lateral"
        ];
      case "vastus_intermedius":
        return [
          "vasto intermedio", "vasto-intermedio", "vastointermedio", "m. vasto intermedio"
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
      case "rectus_femoris":
        if (hasTear) {
          if (isNegated(["desgarro", "ruptura", "rotura", "miofascial", "intramuscular"])) return "normal";
          
          // Grado I, Grado II, or Partial must NEVER be complete
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

      case "sartorius":
        if (hasTear || hasWord(["tendinopatía", "tendinitis", "tendinosis", "insercional"])) {
          if (isNegated(["desgarro", "ruptura", "tendinopatía", "tendinitis", "tendinosis"])) return "normal";
          if (hasWord(["tendinopatía", "tendinosis", "insercional"])) return "tendinopatia";
          return "desgarro";
        }
        return isNormal ? "normal" : "no_descrito";

      case "iliotibial_band":
        if (hasWord(["fricción", "síndrome", "centes", "entesopatía", "liquido", "líquido", "edema"])) {
          if (isNegated(["fricción", "friccion", "síndrome", "centes", "entesopatía", "liquido", "líquido", "edema"])) return "normal";
          return "friccion";
        }
        if (hasTear) {
          if (isNegated(["desgarro", "ruptura"])) return "normal";
          return "desgarro";
        }
        return isNormal ? "normal" : "no_descrito";

      case "vastus_medialis":
      case "vastus_lateralis":
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

      case "vastus_intermedius":
        if (hasTear) {
          if (isNegated(["desgarro", "ruptura"])) return "normal";
          return "desgarro";
        }
        if (hasWord(["hernia", "herniación", "herniacion"])) {
          if (isNegated(["hernia", "herniación", "herniacion"])) return "normal";
          return "hernia_muscular";
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
      case "rectus_femoris": return "Recto Femoral";
      case "sartorius": return "Músculo Sartorio";
      case "iliotibial_band": return "Tracto Iliotibial";
      case "vastus_medialis": return "Vasto Medial";
      case "vastus_lateralis": return "Vasto Lateral";
      case "vastus_intermedius": return "Vasto Intermedio";
      default: return id;
    }
  };

  const getSimplifiedDescriptionByState = (id: string, state: string): string => {
    if (state === "no_descrito") return "No mencionado / No descrito.";
    if (state === "normal") return "Dentro de límites normales.";

    const standardStates = [
      "normal", "no_descrito", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo",
      "tendinopatia", "desgarro", "friccion", "contusion", "desgarro_parcial", "hernia_muscular"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "rectus_femoris":
        if (state === "desgarro_miofascial") return "Desgarro miofascial periférico con líquido laminar.";
        if (state === "desgarro_intramuscular") return "Desgarro intramuscular grado II (espesor parcial).";
        if (state === "desgarro_completo") return "Ruptura completa fibrilar con retracción de extremos.";
        break;
      case "sartorius":
        if (state === "tendinopatia") return "Signos sugestivos de tendinopatía de tracción del sartorio.";
        if (state === "desgarro") return "Desgarro fibrilar parcial del fuste muscular.";
        break;
      case "iliotibial_band":
        if (state === "friccion") return "Síndrome de fricción con edema reactivo fascial periférico.";
        if (state === "desgarro") return "Discontinuidad focal/parcial de sus fibras.";
        break;
      case "vastus_medialis":
      case "vastus_lateralis":
        if (state === "contusion") return "Contusión muscular con edema reactivo difuso.";
        if (state === "desgarro_parcial") return "Desgarro de espesor parcial, grado II.";
        if (state === "desgarro_completo") return "Ruptura completa con defecto de continuidad evidente.";
        break;
      case "vastus_intermedius":
        if (state === "hernia_muscular") return "Defecto aponeurótico con hernia muscular.";
        if (state === "desgarro") return "Desgarro fibrilar muscular focal profundo.";
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

    const structureKeys = ["rectus_femoris", "sartorius", "iliotibial_band", "vastus_medialis", "vastus_lateralis", "vastus_intermedius"];
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Muslo Anterior (${generatedReport.length} caracteres)...`);
    
    const structures = [
      {
        id: "rectus_femoris",
        label: "Recto Femoral",
        allowedStates: ["no_descrito", "normal", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo"]
      },
      {
        id: "sartorius",
        label: "Músculo Sartorio",
        allowedStates: ["no_descrito", "normal", "tendinopatia", "desgarro"]
      },
      {
        id: "iliotibial_band",
        label: "Tracto Iliotibial",
        allowedStates: ["no_descrito", "normal", "friccion", "desgarro"]
      },
      {
        id: "vastus_medialis",
        label: "Vasto Medial",
        allowedStates: ["no_descrito", "normal", "contusion", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "vastus_lateralis",
        label: "Vasto Lateral",
        allowedStates: ["no_descrito", "normal", "contusion", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "vastus_intermedius",
        label: "Vasto Intermedio",
        allowedStates: ["no_descrito", "normal", "hernia_muscular", "desgarro"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Muslo Anterior",
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
      console.error("Error al analizar anatomía:", err);
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
    let updated = false;

    const newLines = lines.map(line => {
      if (updated) return line;
      const lowerLine = line.toLowerCase();
      const hasMatch = keywords.some(kw => lowerLine.includes(kw));
      if (hasMatch) {
         const colonIndex = line.indexOf(":");
         if (colonIndex !== -1) {
           const prefix = line.substring(0, colonIndex + 1);
           updated = true;
           return `${prefix} ${newDescription}`;
         } else {
           const bulletMatch = line.match(/^[\s*-|#\d.?+•\t]+/);
           const bullet = bulletMatch ? bulletMatch[0] : "";
           const structLabel = translateStructureLabelInBrief(id);
           updated = true;
           return `${bullet}${structLabel}: ${newDescription}`;
         }
      }
      return line;
    });

    if (!updated) {
      const findingsIdx = lines.findIndex(l => {
        const low = l.toLowerCase();
        return low.includes("hallazgos") || low.includes("descripción") || low.includes("exploración") || low.includes("resultado");
      });

      if (findingsIdx !== -1) {
        const bulletText = `* **${translateStructureLabelInBrief(id)}**: ${newDescription}`;
        lines.splice(findingsIdx + 1, 0, bulletText);
        return lines.join("\n");
      } else {
        return reportText + `\n* **${translateStructureLabelInBrief(id)}**: ${newDescription}\n`;
      }
    }

    return newLines.join("\n");
  };

  const getDefaultDescription = (id: string, state: string): string => {
    if (!state || state === "no_descrito") return "Estructura no descrita.";
    if (state === "normal") return "Aspecto fibrilar habitual, ecogenicidad y espesor normales sin signos de lesión ni hematomas.";
    const standardStates = [
      "normal", "no_descrito", "desgarro_miofascial", "desgarro_intramuscular", "desgarro_completo",
      "tendinopatia", "desgarro", "friccion", "contusion", "desgarro_parcial", "hernia_muscular"
    ];
    if (!standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "rectus_femoris":
        if (state === "desgarro_miofascial") return "Desgarro miofascial periférico en la unión aponeurótica interna con discreto líquido laminar adyacente.";
        if (state === "desgarro_intramuscular") return "Foco de desgarro intramuscular con discontinuidad de fibras y formación de microcolección hemática líquida.";
        if (state === "desgarro_completo") return "Ruptura completa tránsfuga con retracción de extremos y defecto estructural significativo.";
        break;
      case "sartorius":
        if (state === "tendinopatia") return "Engrosamiento e hipoecogenicidad insercional sugestiva de tendinopatía de tracción del sartorio.";
        if (state === "desgarro") return "Microrupturas longitudinales con pérdida parcial del patrón continuo de sus fibras.";
        break;
      case "iliotibial_band":
        if (state === "friccion") return "Síndrome de fricción con líquido reactivo fascial y edema en el tejido blando subyacente.";
        if (state === "desgarro") return "Foco de desgarro intrasustancia de espesor parcial.";
        break;
      case "vastus_medialis":
      case "vastus_lateralis":
        if (state === "contusion") return "Edema difuso sin rotura ecográfica fibrilar, compatible con contusión en fuste muscular medial/lateral.";
        if (state === "desgarro_parcial") return "Brecha en la arquitectura normal con desgarro fibrilar parcial e infiltración líquida asociada.";
        if (state === "desgarro_completo") return "Ruptura completa del espesor muscular con defecto contráctil evidente en maniobras dinámicas.";
        break;
      case "vastus_intermedius":
        if (state === "hernia_muscular") return "Pequeño defecto fascial con herniación de fibras musculares durante la contracción muscular activa.";
        if (state === "desgarro") return "Foco de rotura fibrilar adyacente al plano cortical femoral con discreto edema.";
        break;
    }
    return "Alteración de la de señal fibrilar.";
  };

  const generateTableMarkdown = () => {
    let md = "| Estructura | Hallazgos |\n";
    md += "| :--- | :--- |\n";

    const rows = [
      { id: "rectus_femoris", label: "M. Recto Femoral" },
      { id: "sartorius", label: "M. Sartorio" },
      { id: "iliotibial_band", label: "Tracto Iliotibial" },
      { id: "vastus_medialis", label: "M. Vasto Medial" },
      { id: "vastus_lateralis", label: "M. Vasto Lateral" },
      { id: "vastus_intermedius", label: "M. Vasto Intermedio" }
    ];

    let hasRows = false;
    rows.forEach(row => {
      // ONLY include rows that are NOT no_descrito and NOT normal
      if (states[row.id] !== "no_descrito" && states[row.id] !== "normal") {
        const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id);
        md += `| **${row.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras musculares se reportan de características normales.* |\n`;
    }

    return md;
  };

  const generateNarrativeText = () => {
    const list = [
      { id: "rectus_femoris", label: "Músculo Recto Femoral" },
      { id: "sartorius", label: "Músculo Sartorio" },
      { id: "iliotibial_band", label: "Tracto Iliotibial" },
      { id: "vastus_medialis", label: "Músculo Vasto Medial" },
      { id: "vastus_lateralis", label: "Músculo Vasto Lateral" },
      { id: "vastus_intermedius", label: "Músculo Vasto Intermedio" }
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
      md = "* *No se han registrado hallazgos patológicos en Muslo Anterior.*";
    }

    return md;
  };

  const getSeverityBadge = (s: string) => {
    if (s === "no_descrito") return "bg-slate-900 text-slate-500 border-slate-850";
    if (s === "normal") return "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
    if (s === "tendinopatia" || s === "friccion" || s === "contusion" || s === "hernia_muscular" || s === "desgarro_miofascial") {
      return "bg-amber-950/40 text-amber-550 border-amber-900/40";
    }
    if (s === "desgarro" || s === "desgarro_parcial" || s === "desgarro_intramuscular") {
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
    if (s === "tendinopatia" || s === "friccion" || s === "contusion" || s === "hernia_muscular" || s === "desgarro_miofascial") {
      return {
        fill: activeHover === id ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.18)",
        stroke: "#f59e0b"
      };
    }
    if (s === "desgarro" || s === "desgarro_parcial" || s === "desgarro_intramuscular") {
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
    // Fallback pathological styling for custom findings
    return {
      fill: activeHover === id ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
      stroke: "#f43f5e"
    };
  };

  return (
    <div className="w-full flex flex-col gap-6" id="thigh-anatomy-container">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-650/10 border border-indigo-500/20 rounded-2xl">
            <Activity className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              Hallazgos Interactivos: Muslo Anterior
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Sincronización bidireccional inteligente de ecografía muscular de fuste anterior del muslo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-350 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-mono"
            title="Escanear y recopilar del informe médico actual"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-indigo-450" : ""}`} />
            Sincronizar
          </button>

          <label className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 font-mono cursor-pointer">
            <input
              type="checkbox"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport && setIncludeInReport(e.target.checked)}
              className="rounded text-indigo-500 focus:ring-transparent h-3 w-3 bg-slate-950 border-slate-800"
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
            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider font-mono self-start mb-1 h-3.5 px-2 bg-indigo-950/30 border border-indigo-900/40 rounded-full flex items-center">
              Plano Superficial
            </span>
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800 text-[7px] font-bold text-slate-500 uppercase font-mono">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
              Superficial
            </div>

            <div className="w-full flex items-center justify-center py-2 mt-4">
              <svg 
                id="thigh-superficial-svg"
                viewBox="0 0 350 350" 
                className="w-full max-w-[240px] h-[240px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="thighGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="muscleSuperGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.25" />
                  </linearGradient>
                </defs>

                {/* Guidelines */}
                <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
                <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

                {/* Thigh Outer Contour */}
                <path 
                  d="M 90,30 C 95,120 100,220 120,320 L 230,320 C 250,220 255,120 260,30 Z" 
                  fill="url(#thighGrad)" 
                  stroke="#334155" 
                  strokeWidth="1.2" 
                />
                
                {/* 1. Tracto Iliotibial (On Lateral side / Left side visually) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("iliotibial_band")}
                  onMouseEnter={() => setActiveHover("iliotibial_band")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 92,30 C 98,120 102,220 125,320 L 135,320 C 112,220 108,120 105,30 Z" 
                    fill={getColorForSVG("iliotibial_band").fill} 
                    stroke={getColorForSVG("iliotibial_band").stroke} 
                    strokeWidth={states.iliotibial_band !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="100" y="160" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="middle" transform="rotate(-78, 100, 160)">TRACTO ILIOTIBIAL</text>
                </g>

                {/* 2. Músculo Recto Femoral (Central Bipennate) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("rectus_femoris")}
                  onMouseEnter={() => setActiveHover("rectus_femoris")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 175,50 C 135,100 135,220 175,275 C 215,220 215,100 175,50 Z" 
                    fill={getColorForSVG("rectus_femoris").fill} 
                    stroke={getColorForSVG("rectus_femoris").stroke} 
                    strokeWidth={states.rectus_femoris !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <path d="M 175,50 L 175,275" stroke="#334155" strokeWidth="0.8" strokeDasharray="2,2" />
                  <text x="175" y="150" fill="#cbd5e1" fontSize="7.5" fontWeight="black" textAnchor="middle">RECTO FEMORAL</text>
                </g>

                {/* 3. Músculo Sartorio (Crossing Obliquely from lateral-top to medial-bottom) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("sartorius")}
                  onMouseEnter={() => setActiveHover("sartorius")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 115,30 C 135,30 160,110 205,220 C 220,260 225,290 225,320 L 210,320 C 210,290 205,260 190,220 C 145,110 125,48 115,30 Z" 
                    fill={getColorForSVG("sartorius").fill} 
                    stroke={getColorForSVG("sartorius").stroke} 
                    strokeWidth={states.sartorius !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="155" y="110" fill="#94a3b8" fontSize="7" fontWeight="bold" textAnchor="middle" transform="rotate(45, 155, 110)">SARTORIO</text>
                </g>
              </svg>
            </div>
          </div>

          {/* SVG 2: PLANO PROFUNDO */}
          <div className="relative bg-slate-950/40 p-4 rounded-2xl border border-slate-850 flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider font-mono self-start mb-1 h-3.5 px-2 bg-indigo-950/30 border border-indigo-900/40 rounded-full flex items-center">
              Plano Profundo
            </span>
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-1.5 py-0.5 rounded border border-slate-800 text-[7px] font-bold text-slate-500 uppercase font-mono">
              <span className="h-1 w-1 rounded-full bg-cyan-500 animate-pulse"></span>
              Profundo
            </div>

            <div className="w-full flex items-center justify-center py-2 mt-4">
              <svg 
                id="thigh-deep-svg"
                viewBox="0 0 350 350" 
                className="w-full max-w-[240px] h-[240px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="boneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2e3d52" />
                    <stop offset="100%" stopColor="#111827" />
                  </linearGradient>
                </defs>

                {/* Guidelines */}
                <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
                <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

                {/* Thigh Contour */}
                <path 
                  d="M 90,30 C 95,120 100,220 120,320 L 230,320 C 250,220 255,120 260,30 Z" 
                  fill="none" 
                  stroke="#334155" 
                  strokeWidth="1.2" 
                  strokeDasharray="4,4"
                />

                {/* Femur (Osseous Core) */}
                <path 
                  d="M 165,30 L 185,30 L 185,290 C 193,295 198,300 198,308 C 198,318 152,318 152,308 C 152,300 157,295 165,290 Z" 
                  fill="url(#boneGrad)" 
                  stroke="#475569" 
                  strokeWidth="1.2" 
                />
                <text x="175" y="70" fill="#90a4ae" fontSize="7" fontWeight="bold" textAnchor="middle">FEMUR</text>

                {/* 4. Vasto Intermedio (centrally over the femur) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("vastus_intermedius")}
                  onMouseEnter={() => setActiveHover("vastus_intermedius")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 148,80 L 202,80 L 202,275 L 148,275 Z" 
                    fill={getColorForSVG("vastus_intermedius").fill} 
                    stroke={getColorForSVG("vastus_intermedius").stroke} 
                    strokeWidth={states.vastus_intermedius !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="175" y="165" fill="#e2e8f0" fontSize="7.5" fontWeight="bold" textAnchor="middle">VASTO INTERMEDIO</text>
                </g>

                {/* 5. Vasto Lateral (Outer left deep) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("vastus_lateralis")}
                  onMouseEnter={() => setActiveHover("vastus_lateralis")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 145,50 C 105,90 102,180 115,260 L 145,260 Z" 
                    fill={getColorForSVG("vastus_lateralis").fill} 
                    stroke={getColorForSVG("vastus_lateralis").stroke} 
                    strokeWidth={states.vastus_lateralis !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="126" y="140" fill="#cbd5e1" fontSize="7.5" fontWeight="bold" textAnchor="middle" transform="rotate(-75, 126, 140)">VASTO LATERAL</text>
                </g>

                {/* 6. Vasto Medial (Inner right deep - lower teardrop) */}
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedStructure("vastus_medialis")}
                  onMouseEnter={() => setActiveHover("vastus_medialis")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 205,100 C 235,130 240,190 225,260 L 205,260 Z" 
                    fill={getColorForSVG("vastus_medialis").fill} 
                    stroke={getColorForSVG("vastus_medialis").stroke} 
                    strokeWidth={states.vastus_medialis !== "no_descrito" ? "2.5" : "1.2"}
                  />
                  <text x="218" y="180" fill="#cbd5e1" fontSize="7.5" fontWeight="bold" textAnchor="middle" transform="rotate(75, 218, 180)">VASTO MEDIAL</text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* EDITOR CONTROL PANEL (2 xl:col-span-5) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
            <h5 className="text-[10px] text-indigo-400 font-black uppercase tracking-wider font-mono mb-2">
              Modificador de Estructura Selecciónada
            </h5>
            
            {/* SELECTOR DROPDOWN */}
            <div className="mb-4">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Estructura Activa:</label>
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 uppercase font-mono cursor-pointer"
              >
                <option value="rectus_femoris">M. Recto Femoral (Superficial)</option>
                <option value="sartorius">M. Sartorio (Superficial)</option>
                <option value="iliotibial_band">Tracto Iliotibial (Superficial)</option>
                <option value="vastus_medialis">M. Vasto Medial (Profundo)</option>
                <option value="vastus_lateralis">M. Vasto Lateral (Profundo)</option>
                <option value="vastus_intermedius">M. Vasto Intermedio (Profundo)</option>
              </select>
            </div>

            {/* Custom State Input */}
            <div className="mb-4 space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Diagnóstico / Hallazgo Clínico (Sinopsis):</label>
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
                    handleUpdateStructureState(selectedStructure, nextVal);
                  }}
                  placeholder="Escriba el diagnóstico del hallazgo (ej: Desgarro, Contusión, etc.)"
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStructureState(selectedStructure, "normal")}
                    className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                      states[selectedStructure] === "normal"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-medium"
                        : "bg-slate-905 hover:bg-slate-900 text-slate-400 border-slate-850"
                    }`}
                  >
                    ✓ Cons. Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStructureState(selectedStructure, "no_descrito")}
                    className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                      states[selectedStructure] === "no_descrito"
                        ? "bg-slate-850 border-slate-600 text-slate-100 font-medium"
                        : "bg-slate-905 hover:bg-slate-900 text-slate-405 border-slate-850"
                    }`}
                  >
                    ⚪ No Descrito
                  </button>
                </div>
              </div>
            </div>

            {/* DETAILED NARRATIVE OVERRIDE */}
            <div>
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Descripción Integrada en Informe:</label>
              <textarea
                value={customDescriptions[selectedStructure] || getDefaultDescription(selectedStructure, states[selectedStructure])}
                onChange={(e) => handleUpdateCustomDescription(selectedStructure, e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-550 leading-relaxed font-mono"
                placeholder="Escribe la descripción de los hallazgos en tiempo real..."
              />
              <p className="text-[8px] text-slate-500 mt-1">
                La edición de este texto actualiza automáticamente la sección correspondiente del reporte principal.
              </p>
            </div>
          </div>

          {/* REPORT EXPORT / INJECTION HUD */}
          <div className="bg-slate-950/40 rounded-2xl border border-slate-850/60 p-4">
            <h5 className="text-[10px] text-indigo-400 font-black uppercase tracking-wider font-mono mb-2">
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
                className="rounded text-indigo-500 focus:ring-transparent h-4 w-4 bg-slate-900 border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 font-mono">
              <button
                onClick={() => onExportTable(generateTableMarkdown())}
                className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe"
              >
                <Download className="h-3 w-3" />
                Inyectar Tabla
              </button>

              <button
                onClick={() => onExportNarrative && onExportNarrative(generateNarrativeText())}
                className="py-2 bg-slate-900 hover:bg-slate-850 text-indigo-450 text-[9px] font-black uppercase tracking-widest rounded-xl border border-indigo-950/40 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.entries(states).filter(([_, sVal]) => sVal !== "no_descrito" && sVal !== "normal").map(([id, sVal]) => {
                const s = sVal as string;
                const label = translateStructureLabelInBrief(id);
                const simplified = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
                
                let dotColor = "bg-slate-500";
                if (s === "normal") dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                else if (s === "tendinosis" || s === "esguince_leve" || s.includes("leve") || s.includes("bursitis_l") || s.includes("derrame_l") || s.includes("meniscosis")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                } else {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                }

                return (
                  <div 
                    key={id} 
                    onClick={() => setSelectedStructure(id)}
                    className="p-2.5 rounded-xl border border-slate-850/40 bg-slate-950/60 text-left transition-all hover:bg-slate-950/80 hover:border-slate-850 flex flex-col gap-1 relative overflow-hidden group cursor-pointer animate-fade-in"
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none select-none w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className="text-[10px] font-black uppercase tracking-wide truncate text-slate-200">
                          {label}
                        </span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${getSeverityBadge(s)}`}>
                        {s === "normal" ? "normal" : s.replace("desgarro_", "").replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-450 truncate mt-0.5 max-w-full">
                      {simplified}
                    </p>
                  </div>
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

              {Object.values(states).every(s => s === "no_descrito" || s === "normal") && (!additionalFindings || additionalFindings.length === 0) && (
                <div className="col-span-2 py-4 text-center text-slate-500 italic text-xs">
                  Sin hallazgos patológicos relevantes detectados.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* SYNCHRONIZER METRIC LOGS */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-950/20 rounded-xl border border-slate-850 p-3 h-[80px] overflow-y-auto">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider font-mono block mb-1">
            Registro de la Herramienta Bidireccional
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
