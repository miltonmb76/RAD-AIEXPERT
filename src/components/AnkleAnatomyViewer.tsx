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

interface AnkleAnatomyViewerProps {
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

// Structure Types
interface AnkleStructure {
  id: string;
  name: string;
  description: string;
}

export default function AnkleAnatomyViewer({
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
}: AnkleAnatomyViewerProps) {
  
  // States of each structure:
  // - achilles: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - plantar_fascia: normal | fascitis | desgarro_parcial | desgarro_completo
  // - lpaa: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - lpc: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - peroneal_tendons: normal | tenosinovitis | desgarro_parcial | desgarro_completo
  // - tibial_posterior: normal | tenosinovitis | desgarro_parcial | desgarro_completo
  // - tibial_anterior: normal | tenosinovitis | desgarro_parcial | desgarro_completo
  // - joint_effusion: normal | derrame_leve | derrame_moderado
  const [states, setStates] = useState<Record<string, string>>({
    achilles: "no_descrito",
    plantar_fascia: "no_descrito",
    lpaa: "no_descrito",
    lpc: "no_descrito",
    peroneal_tendons: "no_descrito",
    tibial_posterior: "no_descrito",
    tibial_anterior: "no_descrito",
    joint_effusion: "no_descrito",
    deltoid: "no_descrito"
  });

  // Manual or custom descriptive text override
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    achilles: "",
    plantar_fascia: "",
    lpaa: "",
    lpc: "",
    peroneal_tendons: "",
    tibial_posterior: "",
    tibial_anterior: "",
    joint_effusion: "",
    deltoid: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("lpaa");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);
  const [subViewMode, setSubViewMode] = useState<"lateral" | "medial" | "dual">("dual");

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

  // Unified helper that supports Spanish spelling variations, abbreviations, and common typos
  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "achilles":
        return [
          "aquiles", "tendón de aquiles", "tendon de aquiles", 
          "manguito de aquiles", "aquíles", "tendon aquiles", "tendón aquiles"
        ];
      case "plantar_fascia":
        return [
          "fascia plantar", "aponeurosis plantar", "fascitis", "fascitis plantar",
          "aponeurosis de la planta", "fascia calcánea", "fascia calcanea"
        ];
      case "lpaa":
        return [
          "peroneoastragalino anterior", "lpaa", "talofibular anterior", 
          "peroneo-astragalino anterior", "peroneoastragalino ant", "ligamento peroneoastragalino anterior",
          "peroneo astragalino anterior"
        ];
      case "lpc":
        return [
          "peroneocalcáneo", "lpc", "calcaneofibular", 
          "peroneocalcaneo", "ligamento peroneocalcaneo", "peroneo calcáneo",
          "peroneocalcaneo posterior", "peroneo-calcaneo"
        ];
      case "peroneal_tendons":
        return [
          "peroneos", "peronéos", "peroneo corto", "peroneo largo",
          "tendones peroneos", "tendon peroneo corto", "tendon peroneo largo",
          "tendones peronéos", "vaina de los peroneos"
        ];
      case "tibial_posterior":
        return [
          "tibial posterior", "tendón tibial posterior", "tendon tibial posterior", 
          "vaina del tibial posterior", "inserción del tibial posterior"
        ];
      case "tibial_anterior":
        return [
          "tibial anterior", "tendón tibial anterior", "tendon tibial anterior", 
          "vaina del tibial anterior", "inserción del tibial anterior"
        ];
      case "joint_effusion":
        return [
          "derrame", "líquido articular", "liquido articular", "líquido intraarticular",
          "liquido intraarticular", "sinovitis", "sinovial", "líquido tibiotarsiano",
          "derrame tibiotarsiano", "receso anterior", "receso posterior", "receso tibiotarsiano",
          "hidrartrosis"
        ];
      case "deltoid":
        return [
          "deltoide", "deltoideo", "colateral medial", "ligamento deltoideo", "complejo deltoideo",
          "tibioastragalino", "tibiocalcaneo", "tibionavicular"
        ];
      default:
        return [];
    }
  };

  // Dedicated helper to clean text and determine the clinical status, checking for negations properly
  const parseStateFromText = (id: string, text: string): string => {
    if (!text) return "no_descrito";
    
    const lower = text.toLowerCase().trim();
    
    // Helper to see if a keyword exists and is NOT negated
    const hasPathology = (keywords: string[]): boolean => {
      for (const kw of keywords) {
        let index = lower.indexOf(kw);
        while (index !== -1) {
          // Extract the preceding text in the current sentence or section block
          const priorText = lower.substring(0, index);
          // Find the last list item, clause or sentence boundary
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
          
          // Extract the succeeding text in the current sentence or section block
          const postText = lower.substring(index + kw.length);
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
            "sin",
            "no se",
            "no hay",
            "no presenta",
            "ausencia de",
            "descart",
            "libre de",
            "negativo",
            "no evidencia",
            "sin evidencia",
            "no se evidencia",
            "sin signos",
            "no presenta signos",
            "no se observa",
            "no se observan",
            "no se aprecian",
            "no se aprecia",
            "no muestra",
            "sano sin",
            "normal sin",
            "íntegro sin",
            "integro sin",
            "conservado sin",
            "desestim",
            "excluye",
            "no se detecta",
            "no se detectan",
            "no se identifica",
            "no se identifican",
            "no se visualiza",
            "no se visualizan",
            "normales sin",
            "descartar"
          ];
          
          // Check preceding negation
          let isNegated = negations.some(neg => {
            const negIdx = precedingText.lastIndexOf(neg);
            if (negIdx !== -1) {
              const inBetween = precedingText.substring(negIdx + neg.length);
              
              // If there's an active contrast like "pero con", "con presencia de", etc., that indicates
              // the negation has stopped and a positive statement has begun, we return false.
              const contrastWords = ["pero", "asociado", " con ", " y presenta", " e presenta", " con presencia", "observa", "aprecia"];
              if (contrastWords.some(cw => inBetween.toLowerCase().includes(cw))) {
                return false;
              }

              // Prevent negation from bleeding through unrelated structures in the same sentence
              const cleanInBetween = inBetween.toLowerCase();
              let hasUnrelatedCrossTalk = false;
              
              if (id !== "achilles" && cleanInBetween.includes("aquiles")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "plantar_fascia" && (cleanInBetween.includes("fascia") || cleanInBetween.includes("fascitis"))) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "lpaa" && cleanInBetween.includes("lpaa")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "lpc" && cleanInBetween.includes("lpc")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "peroneal_tendons" && cleanInBetween.includes("peroneo")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "tibial_posterior" && cleanInBetween.includes("tibial posterior")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "tibial_anterior" && cleanInBetween.includes("tibial anterior")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "joint_effusion" && cleanInBetween.includes("derrame")) {
                hasUnrelatedCrossTalk = true;
              }

              if (hasUnrelatedCrossTalk) {
                const negationCoordinators = ["ni", " o ", "tampoco", "y sin", "ni tampoco"];
                const hasCoordinator = negationCoordinators.some(coor => cleanInBetween.includes(coor));
                if (!hasCoordinator) {
                  return false;
                }
              }
              return true;
            }
            return false;
          });

          // Check succeeding negation/normality (e.g., "Fascia plantar: Sin alteraciones")
          if (!isNegated) {
            const cleanPost = succeedingText.replace(/[:=.,;]/g, "").trim().toLowerCase();
            const succeedingNegations = [
              "no se observa", "no se observan", "no se aprecia", "no se aprecian",
              "no se evidencia", "no se evidencian", "no se detecta", "no se detectan",
              "no se identifica", "no se identifican", "no se visualiza", "no se visualizan",
              "ausente", "negativo", "negativa", "normal", "conservado", "conservada",
              "sin hallazgos", "sin alteraciones", "sin lesiones", "normales", "libre",
              "no presenta", "no presentan", "no"
            ];
            
            isNegated = succeedingNegations.some(neg => {
              if (neg === "no") {
                return cleanPost === "no" || cleanPost.startsWith("no ") || cleanPost.endsWith(" no");
              }
              return succeedingText.toLowerCase().includes(neg);
            });
          }
          
          if (!isNegated) {
            return true;
          }
          // Continue searching if there are subsequent occurrences
          index = lower.indexOf(kw, index + 1);
        }
      }
      return false;
    };

    switch (id) {
      case "achilles": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "desgarro total", "ruptura total", "rotura total", 
          "espesor completo", "espesor total", "ruptura transfixiante", "retract", "solución de continuidad completa", "solucion de continuidad completa"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "espesor parcial", "intrasustancia", "intratendinos", 
          "lesión parcial", "lesion parcial", "fisura", 
          "discontinuidad parcial", "microdesgarro", "desgarro", "rotura", "ruptura", "solución de continuidad parcial", "solucion de continuidad parcial"
        ];
        const tendinosisKws = [
          "tendinosis", "tendinopatía", "tendinopatia", 
          "engrosamiento", "engrosado", "hipoecoica", 
          "hipoecogénic", "hipoecogenic", "anisotropía", "anisotropia", "edema", "inflama", "grosor aumentado"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(tendinosisKws)) return "tendinosis";
        return "normal";
      }

      case "plantar_fascia": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "desgarro total", "ruptura total", "rotura total"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", "lesión parcial"
        ];
        const fascitisKws = [
          "fascitis", "engrosamiento", "engrosada", "hipoecoica", "inflamada", "fasciopatía", "fasciopatia"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(fascitisKws)) return "fascitis";
        return "normal";
      }

      case "lpaa":
      case "lpc":
      case "deltoid": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "grado iii", "grado 3", "ruptura total", "desgarro grado iii", "discontinuidad completa"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "esquince parcial", "grado ii", "grado 2", "desgarro grado ii", "lesión parcial", "discontinuidad parcial"
        ];
        const esguinceLeveKws = [
          "esguince", "distensión", "distendido", "edema periligamentario", 
          "grado i", "grado 1", "esguince grado i", "engrosado", "edema"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(esguinceLeveKws)) return "esguince_leve";
        return "normal";
      }

      case "peroneal_tendons":
      case "tibial_posterior":
      case "tibial_anterior": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", "ruptura transfixiante", "desgarro total", "ruptura total"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", "desgarro intrasustancia", "longitudinal", "fisura", "ruptura de espesor parcial"
        ];
        const tenosinovitisKws = [
          "tenosinovitis", "tendinosis", "tendinopatía", "tendinopatia", "vaina distendida", "líquido peritendinoso", "liquido peritendinoso", "grosor aumentado", "engrosamiento", "líquido en la vaina", "líquido periférico"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(tenosinovitisKws)) return "tenosinovitis";
        return "normal";
      }

      case "joint_effusion": {
        const moderadoKws = [
          "moderado", "abundante", "franco", "severo", "marcado", "distensión capsular", "distension capsular"
        ];
        const leveKws = [
          "laminar", "discreto", "leve", "mínimo", "minimo", "escaso", "pequeño", "pequeño derrame"
        ];

        if (hasPathology(moderadoKws)) return "derrame_moderado";
        if (hasPathology(leveKws)) return "derrame_leve";
        return "normal";
      }

      default:
        return "normal";
    }
  };

  // Extracts the specific sentence/paragraph context for a structure to isolate findings text
  const extractDescriptionFromReportText = (id: string, text: string): string => {
    if (!text) return "";
    
    const lower = text.toLowerCase();
    const keywords = getStructureKeywords(id);
    
    // Find sentences in text
    // We split by standard sentence endings, bullet points, or newlines
    const sentences = text.split(/[.\n;•*]|\r/);
    const candidates: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const lowerSentence = trimmed.toLowerCase();
      // Check if any keyword matches
      if (keywords.some(kw => lowerSentence.includes(kw))) {
        candidates.push(trimmed);
      }
    }

    // Filter out empty candidates and remove duplicates
    const uniqueCandidates = Array.from(new Set(candidates.filter(c => c.trim().length > 0)));

    if (uniqueCandidates.length === 0) return "";

    // Find the best candidate: pathological finding gets highest priority!
    let bestCandidate = uniqueCandidates[0];
    let foundPathological = false;

    for (const candidate of uniqueCandidates) {
      const state = parseStateFromText(id, candidate);
      if (state !== "normal" && state !== "no_descrito") {
        if (!foundPathological) {
          bestCandidate = candidate;
          foundPathological = true;
        } else {
          if (candidate.length > bestCandidate.length) {
            bestCandidate = candidate;
          }
        }
      }
    }

    if (!foundPathological) {
      for (const candidate of uniqueCandidates) {
        if (candidate.length > bestCandidate.length) {
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate;
  };

  // Helper parser to update findings for a specific structure within the written report text automatically (bidirectional)
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
          const bulletMatch = line.match(/^[\s*|#\d.?+•\t\-]+/);
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
        const borderMarker = "\n---\n";
        return reportText + borderMarker + `* **${translateStructureLabelInBrief(id)}**: ${newDescription}\n`;
      }
    }

    return newLines.join("\n");
  };

  // Helper to translate structure IDs into natural labels in Brief
  const translateStructureLabelInBrief = (id: string): string => {
    switch (id) {
      case "achilles": return "Tendón de Aquiles";
      case "plantar_fascia": return "Fascia Plantar";
      case "lpaa": return "LPAA (Lig. Peroneoastragalino Anterior)";
      case "lpc": return "LPC (Lig. Peroneocalcáneo)";
      case "peroneal_tendons": return "Tendones Peroneos";
      case "tibial_posterior": return "Tendón Tibial Posterior";
      case "tibial_anterior": return "Tendón Tibial Anterior";
      case "joint_effusion": return "Derrame Articular Tibiotarsiano";
      case "deltoid": return "Ligamento Deltoideo (Complejo Medial)";
      default: return id;
    }
  };

  const runLocalHeuristics = (logs: string[]) => {
    const updatedStates: Record<string, string> = { ...states };
    const updatedDescriptions: Record<string, string> = { ...customDescriptions };

    const structureKeys = ["achilles", "plantar_fascia", "lpaa", "lpc", "peroneal_tendons", "tibial_posterior", "tibial_anterior", "joint_effusion", "deltoid"];
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
        updatedDescriptions[id] = extractedFindings || getSimplifiedDescription(id, parsedState);
        
        parsedCount++;
        if (parsedState !== "normal" && parsedState !== "no_descrito") foundPathologies++;
        logs.push(`[Sincronización Local] ${translateStructureLabelInBrief(id)}: ${parsedState.toUpperCase()}`);
      } else {
        updatedStates[id] = "no_descrito";
        updatedDescriptions[id] = "No mencionado / No descrito.";
      }
    });

    setStates(updatedStates);
    setCustomDescriptions(updatedDescriptions);
    setLastSyncedReport(generatedReport);
  };

  // Primary parsing function: Scans the written report text and updates UI states accordingly
  const handleScanReportText = async (showFeedBack: boolean = false) => {
    if (!generatedReport) {
      if (showFeedBack) {
        setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: No hay reporte clínico disponible para analizar.`]);
      }
      return;
    }

    setIsSyncing(true);
    const logs: string[] = [];
    logs.push(`Iniciando extracción inteligente de hallazgos en Tobillo (${generatedReport.length} caracteres)...`);

    const structures = [
      {
        id: "achilles",
        label: "Tendón de Aquiles",
        allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "plantar_fascia",
        label: "Fascia Plantar",
        allowedStates: ["no_descrito", "normal", "fascitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "lpaa",
        label: "Ligamento Peroneoastragalino Anterior",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "lpc",
        label: "Ligamento Peroneocalcáneo",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "peroneal_tendons",
        label: "Tendones Peroneos",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tenosinovitis", "desgarro_parcial", "luxacion"]
      },
      {
        id: "tibial_posterior",
        label: "Tendón Tibial Posterior",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tenosinovitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "tibial_anterior",
        label: "Tendón Tibial Anterior",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tenosinovitis", "desgarro_parcial"]
      },
      {
        id: "joint_effusion",
        label: "Derrame Articular",
        allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"]
      },
      {
        id: "deltoid",
        label: "Ligamento Deltoideo",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Tobillo",
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
        logs.push(`[Error API] No se pudo obtener el análisis estructurado. Usando procesamiento heurístico local.`);
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía:", err);
      logs.push(`[Error de red] ${err.message || String(err)}. Redireccionando a análisis local.`);
      runLocalHeuristics(logs);
    } finally {
      setIsSyncing(false);
      setSyncLogs(prev => [...prev, ...logs]);
    }
  };

  // Run the report scanner automatically when the report changes or when the component mounts
  useEffect(() => {
    // Disabled auto-sync on mount/report changes to save tokens as requested.
    // Sync will only occur manually when requested by user.
  }, [generatedReport]);

  const handleUpdateStructureState = (id: string, nextState: string) => {
    setStates(prev => {
      const next = { ...prev, [id]: nextState };
      setSyncLogs(log => [...log, `Cambio manual en ${translateStructureLabelInBrief(id)} -> ${nextState.toUpperCase()}`]);
      return next;
    });

    if (useOriginalReportText) {
      const currentDesc = customDescriptions[id] || getDefaultDescription(id, nextState);
      const updatedReportText = updateReportTextWithStructure(id, generatedReport, currentDesc);
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

  const getDefaultDescription = (id: string, state: string): string => {
    if (!state || state === "no_descrito") return "Estructura no descrita.";
    if (state === "normal") return "Dentro de límites normales.";
    const standardStates = [
      "normal", "no_descrito", "tendinosis", "desgarro_parcial", "desgarro_completo", "fascitis",
      "esguince_leve", "tenosinovitis", "derrame_leve", "derrame_moderado"
    ];
    if (!standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "achilles":
        if (state === "tendinosis") return "Tendinopatía de Aquiles caracterizada por engrosamiento difuso fusiforme e hipoecogenicidad del tendón medio distal, sin discontinuidad.";
        if (state === "desgarro_parcial") return "Desgarro intrínseco de espesor parcial que compromete aproximadamente el 40% de las fibras anteriores de su inserción distal.";
        if (state === "desgarro_completo") return "Ruptura completa y transfixiante del tendón de Aquiles con retracción de cabos fibrilares de 15 mm y colección líquida asociada.";
        break;
      case "plantar_fascia":
        if (state === "fascitis") return "Fascitis plantar caracterizada por engrosamiento difuso de su inserción calcánea (6 mm de espesor) con hipoecogenicidad y edema adyacente.";
        if (state === "desgarro_parcial") return "Microdesgarros de espesor parcial en la inserción proximal de la fascia plantar con pérdida del patrón fibrilar habitual.";
        if (state === "desgarro_completo") return "Ruptura completa de la aponeurosis plantar posterior con retracción de fibras y moderado edema blando rodeando el talón.";
        break;
      case "lpaa":
        if (state === "esguince_leve") return "Esguince grado I del ligamento peroneoastragalino anterior con edema de partes blandas periligamentario, sin ruptura evidente.";
        if (state === "desgarro_parcial") return "Ruptura de espesor parcial de sus fibras con conservación distal del ligamento peroneoastragalino anterior.";
        if (state === "desgarro_completo") return "Discontinuidad anatómica completa y desorganización fibrilar del ligamento peroneoastragalino anterior, compatible con ruptura aguda.";
        break;
      case "lpc":
        if (state === "esguince_leve") return "Esguince grado I/II del ligamento peroneocalcáneo con distensión de su trayecto y edema inflamatorio reactivo.";
        if (state === "desgarro_parcial") return "Defecto de continuidad focal parcial con adelgazamiento de fibras del ligamento peroneocalcáneo.";
        if (state === "desgarro_completo") return "Ruptura completa transfixiante con despegamiento insercional del ligamento peroneocalcáneo.";
        break;
      case "peroneal_tendons":
        if (state === "tenosinovitis") return "Tenosinovitis de tendones peroneos con distensión líquida moderada de la vaina común sinovial posterior al maléolo lateral, con tendones de calibre conservado.";
        if (state === "desgarro_parcial") return "Desgarro longitudinal/fisura intrasustancia del tendón peroneo corto, con tendón peroneo largo preservado.";
        if (state === "desgarro_completo") return "Ruptura completa del tendón peroneo corto con desplazamiento y retracción del extremo proximal.";
        break;
      case "tibial_posterior":
        if (state === "tenosinovitis") return "Tenosinovitis activa del tendón tibial posterior con presencia de líquido rodeando el trayecto fibrilar inframaleolar.";
        if (state === "desgarro_parcial") return "Rotura parcial longitudinal con patrón de aspecto trilobulado e hipoecogenicidad del tendón tibial posterior.";
        if (state === "desgarro_completo") return "Ruptura de espesor total y retracción proximal del tendón tibial posterior.";
        break;
      case "tibial_anterior":
        if (state === "tenosinovitis") return "Tenosinovitis del tendón tibial anterior con discreta colección fluida laminar que distiende la vaina sinovial.";
        if (state === "desgarro_parcial") return "Ruptura parcial y pérdida fibrilar focal en la zona distal del tendón tibial anterior.";
        if (state === "desgarro_completo") return "Discontinuidad total fibrilar transfixiante con retracción del tendón tibial anterior.";
        break;
      case "joint_effusion":
        if (state === "derrame_leve") return "Derrame articular discreto de aspecto laminar en el receso articular anterior tibiotarsiano.";
        if (state === "derrame_moderado") return "Derrame articular tibiotarsiano moderado con distensión de la cápsula anterior y posterior.";
        break;
      case "deltoid":
        if (state === "esguince_leve") return "Esguince grado I del complejo deltoideo con leve edema periligamentario focal tibioastragalino sin ruptura evidente.";
        if (state === "desgarro_parcial") return "Defecto focal de continuidad con desgarro de espesor parcial en fibras del fascículo tibiocalcáneo.";
        if (state === "desgarro_completo") return "Ruptura colateral medial completa y desorganización fibrilar de los componentes superficial y profundo del ligamento deltoideo.";
        break;
    }
    return "Alteración estructural.";
  };

  const getSimplifiedDescription = (id: string, forcedState?: string): string => {
    const state = forcedState !== undefined ? forcedState : (states[id] || "no_descrito");
    if (state === "no_descrito") {
      return "No mencionado / No descrito en el reporte.";
    }
    if (state === "normal") {
      return "Dentro de límites normales.";
    }

    const standardStates = [
      "normal", "no_descrito", "tendinosis", "tenosinovitis", "fascitis", "esguince_leve", "derrame_leve",
      "desgarro_parcial", "desgarro_completo", "derrame_moderado"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

    switch (id) {
      case "achilles":
        if (state === "tendinosis") {
          return "Tendinosis de Aquiles (engrosamiento del tendón medio distal con pérdida fibrilar, sin rotura).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial intrínseca de fibras del tendón de Aquiles.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa y transfixiante del tendón de Aquiles con retracción.";
        }
        break;

      case "plantar_fascia":
        if (state === "fascitis") {
          return "Fascitis plantar (engrosamiento reactivo de su inserción calcánea con edema).";
        }
        if (state === "desgarro_parcial") {
          return "Desgarro parcial o microdesgarros focales en la fascia plantar proximal.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa de la fascia plantar calcánea con retracción.";
        }
        break;

      case "lpaa":
        if (state === "esguince_leve") {
          return "Esguince grado I/II del ligamento peroneoastragalino anterior (LPAA) con edema.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial focales del ligamento peroneoastragalino anterior.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa del ligamento peroneoastragalino anterior con desorganización.";
        }
        break;

      case "lpc":
        if (state === "esguince_leve") {
          return "Esguince grado I/II del ligamento peroneocalcáneo (LPC) con edema reactivo.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura parcial focal del ligamento peroneocalcáneo.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa transfixiante profunda del ligamento peroneocalcáneo.";
        }
        break;

      case "peroneal_tendons":
        if (state === "tenosinovitis") {
          return "Tenosinovitis peronea (líquido excesivo en vaina sinovial con engrosamiento).";
        }
        if (state === "desgarro_parcial") {
          return "Fisura o rotura longitudinal parcial del tendón peroneo corto/largo.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura transfixiante completa con retracción de tendones peroneos.";
        }
        break;

      case "tibial_posterior":
        if (state === "tenosinovitis") {
          return "Tenosinovitis del tibial posterior (distensión fluida de la vaina sinovial).";
        }
        if (state === "desgarro_parcial") {
          return "Fisura longitudinal o ruptura parcial del tendón tibial posterior.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa con retracción distal del tendón tibial posterior.";
        }
        break;

      case "tibial_anterior":
        if (state === "tenosinovitis") {
          return "Tenosinovitis del tibial anterior (líquido rodeando el trayecto del tendón).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial focal del tendón tibial anterior distal.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa y transfixiante con retracción del tendón tibial anterior.";
        }
        break;

      case "joint_effusion":
        if (state === "derrame_leve") {
          return "Derrame articular discreto / laminar en receso tibiotarsiano anterior.";
        }
        if (state === "derrame_moderado") {
          return "Derrame articular moderado con distensión de recesos.";
        }
        break;

      case "deltoid":
        if (state === "esguince_leve") {
          return "Esguince grado I (distensión leve) del complejo deltoideo.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura parcial focal de fibras del ligamento deltoideo colateral medial.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa y desorganización del complejo ligamentario deltoideo.";
        }
        break;
    }

    // Fallback block if any other custom description exists, we capitalize and clean it
    const rawDesc = customDescriptions[id];
    if (!rawDesc || rawDesc.trim() === "") {
      return "Dentro de límites normales.";
    }
    let desc = rawDesc.trim();
    if (desc.length > 0) {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }
    if (desc.length > 0 && !desc.endsWith(".")) {
      desc += ".";
    }
    return desc;
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
    if (s === "normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.22)",
        stroke: "#10b981"
      };
    }
    if (s === "tendinosis" || s === "tenosinovitis" || s === "fascitis" || s === "esguince_leve" || s === "derrame_leve") {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.25)",
        stroke: "#f59e0b"
      };
    }
    if (s === "desgarro_parcial") {
      return {
        fill: isHovered ? "rgba(236, 72, 153, 0.55)" : "rgba(236, 72, 153, 0.28)",
        stroke: "#ec4899"
      };
    }
    if (s === "desgarro_completo" || s === "derrame_moderado") {
      return {
        fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
        stroke: "#f43f5e"
      };
    }

    // Fallback pathological styling for custom findings
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
      stroke: "#f43f5e"
    };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let undescribed = 0;

    const activeKeys = ["achilles", "plantar_fascia", "lpaa", "lpc", "peroneal_tendons", "tibial_posterior", "tibial_anterior", "joint_effusion", "deltoid"];
    activeKeys.forEach(id => {
      const s = states[id] || "no_descrito";
      if (s === "no_descrito") undescribed++;
      else if (s === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normal: normalCount, undescribed };
  };

  const { pathological, normal: normalCount, undescribed } = getBadgesCount();

  const generateTableMarkdown = () => {
    const keys = ["achilles", "plantar_fascia", "lpaa", "lpc", "peroneal_tendons", "tibial_posterior", "tibial_anterior", "joint_effusion", "deltoid"];
    
    let md = "| Estructura | Hallazgos |\n";
    md += "| :--- | :--- |\n";
    
    let hasRows = false;
    keys.forEach(id => {
      const s = states[id];
      if (s !== "no_descrito" && s !== "normal") {
        const label = translateStructureLabelInBrief(id);
        const desc = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
        md += `| **${label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras examinadas se reportan de características normales.* |\n`;
    }

    return md;
  };

  const generateNarrativeNarratolog = () => {
    const keys = ["achilles", "plantar_fascia", "lpaa", "lpc", "peroneal_tendons", "tibial_posterior", "tibial_anterior", "joint_effusion", "deltoid"];
    const pathologicalItems: string[] = [];
    const normalItems: string[] = [];

    keys.forEach(id => {
      const s = states[id];
      const desc = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
      const label = translateStructureLabelInBrief(id);
      if (s !== "no_descrito") {
        if (s === "normal") {
          normalItems.push(label);
        } else {
          pathologicalItems.push(`**${label}**: ${desc}`);
        }
      }
    });

    let txt = "El análisis esquemático tridimensional del tobillo revela lo siguiente:\n\n";
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

    return txt;
  };

  const ANKLE_STRUCTURES: AnkleStructure[] = [
    { id: "achilles", name: "Tendón de Aquiles", description: "Tendón grueso de inserción posterior distal que conecta los gemelos al calcáneo." },
    { id: "plantar_fascia", name: "Fascia Plantar", description: "Banda aponeurótica del arco longitudinal del pie que amortigua impactos." },
    { id: "lpaa", name: "LPAA (Lig. Peroneoastragalino Ant.)", description: "Ligamento colateral externo anterior, lesionado común en inversiones." },
    { id: "lpc", name: "LPC (Lig. Peroneocalcáneo)", description: "Ligamento colateral externo medio profundo estabilizador de retropié." },
    { id: "peroneal_tendons", name: "Tendones Peroneos", description: "Tendones peroneo corto y largo en la fosa maleolar externa." },
    { id: "tibial_posterior", name: "Tendón Tibial Posterior", description: "Tendón medial profundo de gran relevancia de arco interno." },
    { id: "tibial_anterior", name: "Tendón Tibial Anterior", description: "Tendón anterior dorsal extensor del tobillo." },
    { id: "joint_effusion", name: "Derrame Articular Tibiotarsiano", description: "Presencia anormal de líquido sinovial acumulado en la fosa." },
    { id: "deltoid", name: "Complejo Deltoideo", description: "Ligamento colateral medial potente estabilizador del tobillo interno." }
  ];

  return (
    <div className="w-full flex flex-col gap-6" id="ankle-anatomy-viewer-container">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-100 font-sans tracking-tight">
              Anatomía Interactiva y Sinopsis Esquemática del Tobillo
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Sincronización bidireccional automática del reporte mediante procesamiento de lenguaje clínico.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 disabled:bg-slate-900 border border-slate-700/60 disabled:border-slate-800 text-xs font-medium text-slate-100 hover:text-white rounded-lg transition-all"
            title="Analizar el texto actual del reporte clínico para mapear los hallazgos en el esquema anatómico"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar Reporte
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: interactive SVG viewport */}
        <div className="lg:col-span-6 flex flex-col justify-between bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 relative overflow-hidden min-h-[360px]">
          
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800/50 pb-3 mb-4 z-10">
            {/* View Mode Tabs */}
            <div className="flex bg-slate-950/80 p-0.5 border border-slate-800/80 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setSubViewMode("lateral")}
                className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded-md transition-all ${
                  subViewMode === "lateral"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                Cara Lateral
              </button>
              <button
                type="button"
                onClick={() => setSubViewMode("medial")}
                className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded-md transition-all ${
                  subViewMode === "medial"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                Cara Medial
              </button>
              <button
                type="button"
                onClick={() => setSubViewMode("dual")}
                className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded-md transition-all ${
                  subViewMode === "dual"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                Vista Dual
              </button>
            </div>

            {/* Badges indicators */}
            <div className="flex flex-wrap gap-1">
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-950/45 border border-red-900/35 text-[9px] font-medium text-red-400 font-sans">
                <span className="h-1 w-1 rounded-full bg-red-500"></span>
                {pathological} Lesiones
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/45 border border-emerald-900/35 text-[9px] font-medium text-emerald-400 font-sans">
                <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                {normalCount} OK
              </span>
            </div>
          </div>

          {/* Interactive Ankle SVGs Container */}
          <div className="w-full flex-1 flex items-center justify-center py-2">
            <div className={`w-full ${
              subViewMode === "dual" 
                ? "grid grid-cols-1 sm:grid-cols-2 gap-4" 
                : "flex justify-center"
            }`}>
              
              {/* --- CARA LATERAL SVG --- */}
              <div 
                className={`flex flex-col items-center bg-slate-950/30 border border-slate-800/40 p-2.5 rounded-2xl transition-all ${
                  subViewMode === "lateral" || subViewMode === "dual" ? "block" : "hidden"
                }`}
                style={{ width: "100%", maxWidth: subViewMode === "lateral" ? "320px" : "100%" }}
              >
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2 flex items-center gap-1 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  Cara Lateral (Externo)
                </div>
                
                <svg 
                  id="ankle-anatomy-svg-lateral"
                  viewBox="0 0 320 320" 
                  className="w-full max-w-[280px] h-auto drop-shadow-2xl"
                  style={{ maxHeight: "280px" }}
                >
                  <defs>
                    <linearGradient id="boneAnkleGradLat" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2e3d52" />
                      <stop offset="100%" stopColor="#111827" />
                    </linearGradient>
                    <linearGradient id="tarsusGradLat" x1="0%" y1="0%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="#3d4e66" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                  </defs>

                  {/* Structural design guidelines (very faint) */}
                  <circle cx="160" cy="160" r="130" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,6" opacity="0.1" />
                  <line x1="160" y1="20" x2="160" y2="300" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,8" opacity="0.1" />
                  <line x1="20" y1="160" x2="300" y2="160" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,8" opacity="0.1" />

                  {/* HIGH-FIDELITY BONY ANATOMY REFERENCE */}
                  {/* Tibia */}
                  <path 
                    d="M 98,25 L 98,165 Q 98,190 85,190 L 135,190 Q 130,165 130,25 Z" 
                    fill="url(#boneAnkleGradLat)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="114" y="50" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

                  {/* Peroné / Fibula */}
                  <path 
                    d="M 134,25 L 134,165 Q 132,185 132,215 Q 142,224 149,215 Q 149,165 149,25 Z" 
                    fill="url(#boneAnkleGradLat)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="142" y="38" fill="#3b4b5e" fontSize="7" fontStyle="italic" textAnchor="middle">Peroné</text>

                  {/* Astrágalo / Talus */}
                  <path 
                    d="M 98,191 C 110,190 135,190 145,195 C 148,198 148,206 142,212 C 138,216 142,223 125,223 C 110,223 90,223 80,215 C 75,208 85,195 98,191 Z" 
                    fill="url(#tarsusGradLat)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="110" y="212" fill="#64748b" fontSize="6.5" textAnchor="middle">Astrágalo</text>

                  {/* Calcáneo */}
                  <path 
                    d="M 80,235 C 95,223 115,223 125,223 C 135,223 145,222 145,228 C 155,220 175,220 190,225 C 205,230 215,240 215,255 C 215,275 195,278 175,278 C 150,278 120,275 95,268 C 80,262 78,248 80,235 Z" 
                    fill="url(#boneAnkleGradLat)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="165" y="260" fill="#475569" fontSize="7.5" fontWeight="bold" textAnchor="middle">CALCÁNEO</text>

                  {/* Cuboides */}
                  <path 
                    d="M 80,235 C 70,235 58,240 55,245 C 52,250 52,260 55,265 C 60,268 70,268 80,262 Z" 
                    fill="url(#tarsusGradLat)" 
                    stroke="#334155" 
                    strokeWidth="1.0" 
                  />
                  <text x="68" y="252" fill="#475569" fontSize="5.5" textAnchor="middle">Cuboides</text>

                  {/* ACTIVE PATHWAYS (SOFT TISSUES ONLY) */}
                  {/* 3. LPAA */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("lpaa")}
                    onMouseEnter={() => setActiveHover("lpaa")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 132,204 L 90,212 C 88,215 90,218 92,218 L 134,210 Z" 
                      fill={getColorForSVG("lpaa").fill} 
                      stroke={getColorForSVG("lpaa").stroke} 
                      strokeWidth={states.lpaa !== "normal" ? "3" : "1.2"}
                      fillOpacity={states.lpaa !== "normal" ? "0.9" : "0.6"}
                      strokeDasharray={states.lpaa === "esguince_leve" ? "3,2" : "none"}
                    />
                    <line x1="112" y1="209" x2="138" y2="135" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 4. LPC */}
                  <g 
                    className="cursor-pointer transition-all duration-205"
                    onClick={() => setSelectedStructure("lpc")}
                    onMouseEnter={() => setActiveHover("lpc")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 142,215 L 165,240 C 168,241 170,238 167,236 L 145,212 Z" 
                      fill={getColorForSVG("lpc").fill} 
                      stroke={getColorForSVG("lpc").stroke} 
                      strokeWidth={states.lpc !== "normal" ? "3" : "1.2"}
                      fillOpacity={states.lpc !== "normal" ? "0.9" : "0.6"}
                      strokeDasharray={states.lpc === "esguince_leve" ? "3,2" : "none"}
                    />
                    <line x1="154" y1="226" x2="255" y2="221" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 5. Tendones Peroneos */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("peroneal_tendons")}
                    onMouseEnter={() => setActiveHover("peroneal_tendons")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 149,60 L 149,170 C 150,190 154,205 160,212 Q 166,218 140,235 Q 105,245 75,245 L 75,240 Q 105,240 138,230 Q 155,208 153,202 L 151,170 L 141,60 Z" 
                      fill={getColorForSVG("peroneal_tendons").fill} 
                      stroke={getColorForSVG("peroneal_tendons").stroke} 
                      strokeWidth={states.peroneal_tendons !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.peroneal_tendons !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.peroneal_tendons === "tenosinovitis" ? "3,2" : "none"}
                    />
                    <line x1="160" y1="110" x2="255" y2="110" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 6. Tendón Tibial Anterior (Lateral aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("tibial_anterior")}
                    onMouseEnter={() => setActiveHover("tibial_anterior")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 95,60 L 95,165 C 97,185 88,215 77,240 L 82,243 C 94,217 103,185 101,165 L 101,60 Z" 
                      fill={getColorForSVG("tibial_anterior").fill} 
                      stroke={getColorForSVG("tibial_anterior").stroke} 
                      strokeWidth={states.tibial_anterior !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.tibial_anterior !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.tibial_anterior === "tenosinovitis" ? "3,2" : "none"}
                    />
                    <line x1="97" y1="115" x2="45" y2="115" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 7. Receso Articular Anterior (Lateral aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("joint_effusion")}
                    onMouseEnter={() => setActiveHover("joint_effusion")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 95,195 C 88,200 88,208 96,212 C 104,212 106,204 102,196 Z" 
                      fill={getColorForSVG("joint_effusion").fill} 
                      stroke={getColorForSVG("joint_effusion").stroke} 
                      strokeWidth={states.joint_effusion !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.joint_effusion !== "normal" ? "0.9" : "0.5"}
                      strokeDasharray={states.joint_effusion === "derrame_leve" ? "3,2" : "none"}
                    />
                    <line x1="95" y1="203" x2="45" y2="194" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 8. Tendón de Aquiles (Lateral aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("achilles")}
                    onMouseEnter={() => setActiveHover("achilles")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 178,60 L 184,170 C 185,190 183,210 182,228 L 176,227 C 177,210 179,190 172,170 L 172,60 Z" 
                      fill={getColorForSVG("achilles").fill} 
                      stroke={getColorForSVG("achilles").stroke} 
                      strokeWidth={states.achilles !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.achilles !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.achilles === "tendinosis" ? "3,2" : "none"}
                    />
                    <line x1="178" y1="120" x2="255" y2="140" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 9. Fascia Plantar (Lateral aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("plantar_fascia")}
                    onMouseEnter={() => setActiveHover("plantar_fascia")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 160,277 C 130,277 100,273 78,262 L 76,268 C 98,279 130,283 160,283 Z" 
                      fill={getColorForSVG("plantar_fascia").fill} 
                      stroke={getColorForSVG("plantar_fascia").stroke} 
                      strokeWidth={states.plantar_fascia !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.plantar_fascia !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.plantar_fascia === "fascitis" ? "3,2" : "none"}
                    />
                    <line x1="110" y1="275" x2="50" y2="288" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* Labels Cara Lateral */}
                  <text x="260" y="225" fill="#a5b4fc" fontSize="6.2" fontWeight="semibold" textAnchor="start">Lig. Peroneocalcáneo (LPC)</text>
                  <text x="260" y="114" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">T. Peroneos</text>
                  <text x="138" y="127" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="middle">LPAA</text>
                  <text x="40" y="119" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="end">T. Tibial Anterior</text>
                  <text x="40" y="194" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="end">Receso Artic. Ant.</text>
                  <text x="260" y="144" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">Tendón de Aquiles</text>
                  <text x="45" y="291" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="end">Fascia Plantar</text>
                </svg>
              </div>

              {/* --- CARA MEDIAL SVG --- */}
              <div 
                className={`flex flex-col items-center bg-slate-950/30 border border-slate-850/40 p-2.5 rounded-2xl transition-all ${
                  subViewMode === "medial" || subViewMode === "dual" ? "block" : "hidden"
                }`}
                style={{ width: "100%", maxWidth: subViewMode === "medial" ? "320px" : "100%" }}
              >
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2 flex items-center gap-1 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Cara Medial (Interno)
                </div>

                <svg 
                  id="ankle-anatomy-svg-medial"
                  viewBox="0 0 320 320" 
                  className="w-full max-w-[280px] h-auto drop-shadow-2xl"
                  style={{ maxHeight: "280px" }}
                >
                  <defs>
                    <linearGradient id="boneAnkleGradMed" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2e3d52" />
                      <stop offset="100%" stopColor="#111827" />
                    </linearGradient>
                    <linearGradient id="tarsusGradMed" x1="0%" y1="0%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="#3d4e66" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                  </defs>

                  {/* Structural design guidelines (very faint) */}
                  <circle cx="160" cy="160" r="130" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,6" opacity="0.1" />
                  <line x1="160" y1="20" x2="160" y2="300" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,8" opacity="0.1" />
                  <line x1="20" y1="160" x2="300" y2="160" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,8" opacity="0.1" />

                  {/* HIGH-FIDELITY BONY ANATOMY REFERENCE */}
                  {/* Tibia */}
                  <path 
                    d="M 172,25 L 172,165 Q 172,185 155,215 Q 162,224 168,215 Q 168,195 210,190 L 210,165 L 210,25 Z" 
                    fill="url(#boneAnkleGradMed)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="190" y="50" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

                  {/* Astrágalo */}
                  <path 
                    d="M 222,191 C 210,190 185,190 175,195 C 172,198 172,206 178,212 C 182,216 178,223 195,223 C 210,223 230,223 240,215 C 245,208 235,195 222,191 Z" 
                    fill="url(#tarsusGradMed)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="180" y="212" fill="#64748b" fontSize="6.5" textAnchor="middle">Astrágalo</text>

                  {/* Calcáneo */}
                  <path 
                    d="M 240,235 C 225,223 205,223 195,223 C 185,223 175,222 175,228 C 165,220 145,220 130,225 C 115,230 105,240 105,255 C 105,275 125,278 145,278 C 170,278 200,275 225,268 C 240,262 242,248 240,235 Z" 
                    fill="url(#boneAnkleGradMed)" 
                    stroke="#334155" 
                    strokeWidth="1.2" 
                  />
                  <text x="135" y="260" fill="#475569" fontSize="7.5" fontWeight="bold" textAnchor="middle">CALCÁNEO</text>

                  {/* Navicular */}
                  <path 
                    d="M 240,235 C 250,235 262,240 265,245 C 268,250 268,260 265,265 C 260,268 250,268 240,262 Z" 
                    fill="url(#tarsusGradMed)" 
                    stroke="#334155" 
                    strokeWidth="1.0" 
                  />
                  <text x="252" y="252" fill="#475569" fontSize="5.5" textAnchor="middle">Navicular</text>

                  {/* ACTIVE PATHWAYS (SOFT TISSUES ONLY) */}
                  {/* 3. Complejo Deltoideo / Ligamento Deltoideo */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("deltoid")}
                    onMouseEnter={() => setActiveHover("deltoid")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 158,212 L 195,223 C 197,226 185,238 168,238 C 158,238 152,228 152,220 Z" 
                      fill={getColorForSVG("deltoid").fill} 
                      stroke={getColorForSVG("deltoid").stroke} 
                      strokeWidth={states.deltoid !== "normal" ? "3" : "1.2"}
                      fillOpacity={states.deltoid !== "normal" ? "0.9" : "0.6"}
                      strokeDasharray={states.deltoid === "esguince_leve" ? "3,2" : "none"}
                    />
                    <line x1="168" y1="222" x2="130" y2="220" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 4. Tendón Tibial Posterior (Cara Medial) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("tibial_posterior")}
                    onMouseEnter={() => setActiveHover("tibial_posterior")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 166,60 L 166,170 C 166,185 164,195 156,202 C 148,208 150,214 185,225 L 189,220 C 168,210 160,202 161,196 C 170,190 172,180 172,170 L 170,60 Z" 
                      fill={getColorForSVG("tibial_posterior").fill} 
                      stroke={getColorForSVG("tibial_posterior").stroke} 
                      strokeWidth={states.tibial_posterior !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.tibial_posterior !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.tibial_posterior === "tenosinovitis" ? "3,2" : "none"}
                    />
                    <line x1="165" y1="120" x2="255" y2="120" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 5. Tendón Tibial Anterior (Cara Medial) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("tibial_anterior")}
                    onMouseEnter={() => setActiveHover("tibial_anterior")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 210,60 L 210,165 C 210,185 217,210 231,242 L 236,239 C 223,208 216,185 216,165 L 216,60 Z" 
                      fill={getColorForSVG("tibial_anterior").fill} 
                      stroke={getColorForSVG("tibial_anterior").stroke} 
                      strokeWidth={states.tibial_anterior !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.tibial_anterior !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.tibial_anterior === "tenosinovitis" ? "3,2" : "none"}
                    />
                    <line x1="216" y1="105" x2="265" y2="85" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 6. Receso Articular Anterior (Medial aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("joint_effusion")}
                    onMouseEnter={() => setActiveHover("joint_effusion")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 205,195 C 212,192 216,198 212,204 C 205,204 202,200 205,195 Z" 
                      fill={getColorForSVG("joint_effusion").fill} 
                      stroke={getColorForSVG("joint_effusion").stroke} 
                      strokeWidth={states.joint_effusion !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.joint_effusion !== "normal" ? "0.9" : "0.5"}
                      strokeDasharray={states.joint_effusion === "derrame_leve" ? "3,2" : "none"}
                    />
                    <line x1="208" y1="198" x2="255" y2="170" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 7. Tendón de Aquiles (Medial aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("achilles")}
                    onMouseEnter={() => setActiveHover("achilles")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 142,60 L 138,170 C 137,190 135,210 128,228 L 122,227 C 129,210 131,190 136,170 L 136,60 Z" 
                      fill={getColorForSVG("achilles").fill} 
                      stroke={getColorForSVG("achilles").stroke} 
                      strokeWidth={states.achilles !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.achilles !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.achilles === "tendinosis" ? "3,2" : "none"}
                    />
                    <line x1="136" y1="120" x2="60" y2="140" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* 8. Fascia Plantar (Medial aspect) */}
                  <g 
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("plantar_fascia")}
                    onMouseEnter={() => setActiveHover("plantar_fascia")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path 
                      d="M 160,277 C 190,277 220,273 242,262 L 244,268 C 222,279 190,283 160,283 Z" 
                      fill={getColorForSVG("plantar_fascia").fill} 
                      stroke={getColorForSVG("plantar_fascia").stroke} 
                      strokeWidth={states.plantar_fascia !== "normal" ? "2.5" : "1"}
                      fillOpacity={states.plantar_fascia !== "normal" ? "0.85" : "0.5"}
                      strokeDasharray={states.plantar_fascia === "fascitis" ? "3,2" : "none"}
                    />
                    <line x1="210" y1="275" x2="270" y2="288" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                  </g>

                  {/* Labels Cara Medial */}
                  <text x="125" y="224" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="end">Comp. Deltoideo</text>
                  <text x="260" y="124" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">T. Tibial Posterior</text>
                  <text x="270" y="89" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">T. Tibial Anterior</text>
                  <text x="260" y="174" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">Receso Ant. (Derrame)</text>
                  <text x="55" y="144" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="end">Tendón de Aquiles</text>
                  <text x="275" y="291" fill="#a5b4fc" fontSize="6.5" fontWeight="semibold" textAnchor="start">Fascia Plantar</text>
                </svg>
              </div>

            </div>
          </div>

          <div className="w-full text-center mt-3 border-t border-slate-800/50 pt-2 text-[10px] text-slate-400 italic">
            💡 Haz clic en los trazados coloreados del tobillo para auditar o modificar sus hallazgos en tiempo real.
          </div>
        </div>

        {/* Right Side: details & configurations */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* Quick HUD of structures list */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-3 flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none mb-1">
              <Layers className="h-3 w-3 text-indigo-400" />
              Mapeo de Hallazgos Clínicos Sintonizados
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ANKLE_STRUCTURES.filter(item => states[item.id] !== "no_descrito" && states[item.id] !== "normal").map(item => {
                const s = states[item.id];
                const isSelected = selectedStructure === item.id;
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-450 border-emerald-900/30";
                } else if (s === "desgarro_completo" || s === "rotura") {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
                } else if (s === "tendinosis" || s === "esguince_leve" || s === "tenosinovitis" || s === "fascitis" || s === "derrame_leve") {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-400 border-pink-900/30";
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedStructure(item.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 relative overflow-hidden group cursor-pointer ${
                      isSelected 
                        ? "bg-slate-900 border-indigo-500 text-indigo-400 shadow-md scale-[1.01]" 
                        : "bg-slate-950/60 hover:bg-slate-950/80 border-slate-850/40 text-slate-350"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none select-none w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className={`text-[10px] font-black uppercase tracking-wide truncate ${isSelected ? "text-indigo-400" : "text-slate-200"}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                        {s.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-450 truncate mt-0.5 max-w-full">
                      {customDescriptions[item.id] || "Sin hallazgos clínicos descritos."}
                    </p>
                  </button>
                );
              })}

              {additionalFindings && additionalFindings.map((item) => {
                const s = item.state || "Alterado";
                const dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                const badgeBg = "bg-rose-950/40 text-rose-400 border-rose-900/30";
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

              {ANKLE_STRUCTURES.filter(item => states[item.id] !== "no_descrito" && states[item.id] !== "normal").length === 0 && (!additionalFindings || additionalFindings.length === 0) && (
                <div className="col-span-full py-3 text-center text-slate-500 italic text-[10px]">
                  Sin hallazgos patológicos relevantes detectados.
                </div>
              )}
            </div>
          </div>

          {/* Active selected structure panel */}
          {(() => {
            const activeStruct = ANKLE_STRUCTURES.find(s => s.id === selectedStructure);
            if (!activeStruct) return null;
            const state = states[selectedStructure];

            return (
              <div className="bg-slate-900/35 border border-slate-800/65 rounded-2xl p-4 flex flex-col gap-4">
                
                {/* Structural Label / Info */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {activeStruct.name}
                      <span className="text-[9px] font-normal text-slate-400">({selectedStructure})</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{activeStruct.description}</p>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-tight uppercase border ${
                    state === "no_descrito" 
                      ? "bg-slate-950/60 border-slate-800 text-slate-500" 
                      : state === "normal"
                        ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
                        : state === "desgarro_completo"
                          ? "bg-red-950/50 border-red-800/60 text-red-400"
                          : "bg-indigo-950/50 border-indigo-800/60 text-indigo-400"
                  }`}>
                    {state.replaceAll("_", " ")}
                  </span>
                </div>

                {/* Custom State Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Diagnóstico / Hallazgo Clínico (Sinopsis):
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={
                        state === "no_descrito" 
                          ? "" 
                          : state === "normal" 
                            ? "Normal" 
                            : state
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
                      placeholder="Escriba el diagnóstico del hallazgo (ej: Tendinosis leve, Ruptura, etc.)"
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateStructureState(selectedStructure, "normal")}
                        className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                          state === "normal"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-medium"
                            : "bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        ✓ Cons. Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStructureState(selectedStructure, "no_descrito")}
                        className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                          state === "no_descrito"
                            ? "bg-slate-850 border-slate-600 text-slate-100 font-medium"
                            : "bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        ⚪ No Descrito
                      </button>
                    </div>
                  </div>
                </div>

                {/* Description Text custom override */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Hallazgo de texto inyectado en reporte clínico:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleUpdateCustomDescription(selectedStructure, getDefaultDescription(selectedStructure, state))}
                      className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> Revertir a Plantilla
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={customDescriptions[selectedStructure] || getDefaultDescription(selectedStructure, state)}
                    onChange={(e) => handleUpdateCustomDescription(selectedStructure, e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-600 transition-all font-sans leading-relaxed"
                    placeholder="Escribe la descripción anatomopatológica del hallazgo..."
                  />
                  
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="use-original-report-text-ank"
                      checked={useOriginalReportText}
                      onChange={(e) => setUseOriginalReportText(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-600 h-3 w-3"
                    />
                    <label htmlFor="use-original-report-text-ank" className="text-[10px] text-slate-400 cursor-pointer select-none">
                      Reescribir dinámicamente el reporte clínico activo al cambiar estados
                    </label>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* Export action modules */}
          <div className="bg-slate-900/15 border border-slate-800/60 rounded-2xl p-4 flex flex-col gap-3">
            <h5 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Acciones de Exportación para Reporte Escrito (PDF/Workspace)
            </h5>
            
            <div className="flex flex-row gap-2.5">
              <button
                type="button"
                onClick={() => onExportTable(generateTableMarkdown())}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-gradient-to-r from-indigo-900/40 to-indigo-800/40 hover:from-indigo-900/60 hover:to-indigo-800/60 text-slate-200 hover:text-white rounded-xl border border-indigo-700/35 hover:border-indigo-650 text-[11px] font-semibold transition-all"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                Inyectar Tabla de Hallazgos
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onExportNarrative) {
                    onExportNarrative(generateNarrativeNarratolog());
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700/60 hover:border-slate-650 text-[11px] font-semibold transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Inyectar Sinopsis Narrativa
              </button>
            </div>

            <div className="flex items-center gap-2.5 mt-1 border-t border-slate-850/50 pt-2.5">
              <input
                type="checkbox"
                id="include-schematic-toggle-ank"
                checked={includeInReport}
                onChange={(e) => setIncludeInReport && setIncludeInReport(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5"
              />
              <label htmlFor="include-schematic-toggle-ank" className="text-[10px] text-slate-300 cursor-pointer font-medium">
                Incluir esquema del tobillo de forma explícita al exportar el reporte a documento PDF impreso
              </label>
            </div>
          </div>

        </div>

      </div>

      {/* Sync history log view */}
      {syncLogs.length > 0 && (
        <details className="text-[10px] bg-slate-950/40 border border-slate-850/60 rounded-xl p-2 cursor-pointer group transition-all">
          <summary className="font-mono text-[9px] font-semibold text-slate-400 group-hover:text-slate-300 flex items-center justify-between select-none">
            Ver registro de auditoría de procesamiento NLP ({syncLogs.length} líneas)
            <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900 group-open:hidden">Mostrar</span>
            <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900 hidden group-open:inline">Ocultar</span>
          </summary>
          <div className="font-mono text-[8px] text-slate-500 mt-2 max-h-[100px] overflow-y-auto space-y-1 block leading-normal pt-1.5 border-t border-dashed border-slate-900">
            {syncLogs.map((log, i) => (
              <div key={i} className="py-0.5 border-b border-slate-950/35 last:border-0 truncate">
                {log}
              </div>
            ))}
          </div>
        </details>
      )}

    </div>
  );
}
