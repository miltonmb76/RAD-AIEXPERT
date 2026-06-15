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

interface KneeAnatomyViewerProps {
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

// Structure Types
interface KneeStructure {
  id: string;
  name: string;
  description: string;
}

export default function KneeAnatomyViewer({
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions,
  selectedModel
}: KneeAnatomyViewerProps) {
  
  // States of each structure:
  // - quadriceps: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - patellar: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - lcm: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - lce: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - medial_meniscus: normal | meniscosis | rotura
  // - lateral_meniscus: normal | meniscosis | rotura
  // - joint_effusion: normal | derrame_leve | derrame_moderado
  // - baker_cyst: normal | quiste_leve | quiste_severo
  const [states, setStates] = useState<Record<string, string>>({
    quadriceps: "no_descrito",
    patellar: "no_descrito",
    lcm: "no_descrito",
    lce: "no_descrito",
    medial_meniscus: "no_descrito",
    lateral_meniscus: "no_descrito",
    joint_effusion: "no_descrito",
    baker_cyst: "no_descrito"
  });

  // Manual or custom descriptive text override
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    quadriceps: "",
    patellar: "",
    lcm: "",
    lce: "",
    medial_meniscus: "",
    lateral_meniscus: "",
    joint_effusion: "",
    baker_cyst: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("quadriceps");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);

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
      case "quadriceps":
        return [
          "cuadricipital", "cuádriceps", "cuadriceps", 
          "tendón cuadricipital", "tendon cuadricipital", 
          "manguito cuadricipital", "inserción cuadricipital"
        ];
      case "patellar":
        return [
          "rotuliano", "patelar", "rotuliana", "pateliana",
          "tendón rotuliano", "tendon rotuliano", "tendón patelar", "tendon patelar",
          "ligamento rotuliano", "ligamento patelar"
        ];
      case "lcm":
        return [
          "colateral medial", "colateral interno", "lcm", 
          "ligamento colateral medial", "ligamento colateral interno",
          "banda medial", "complejo colateral interno"
        ];
      case "lce":
        return [
          "colateral lateral", "colateral externo", "lce", 
          "ligamento colateral lateral", "ligamento colateral externo",
          "banda lateral", "complejo colateral externo"
        ];
      case "medial_meniscus":
        return [
          "menisco medial", "menisco interno", "meniscomedi",
          "cuerno posterior del menisco medial", "cuerno anterior del menisco medial",
          "cuerpo del menisco medial", "cuerno posterior del menisco interno",
          "cuerno anterior del menisco interno"
        ];
      case "lateral_meniscus":
        return [
          "menisco lateral", "menisco externo", "meniscolat",
          "cuerno posterior del menisco lateral", "cuerno anterior del menisco lateral",
          "cuerpo del menisco lateral", "cuerno posterior del menisco externo",
          "cuerno anterior del menisco externo"
        ];
      case "joint_effusion":
        return [
          "derrame", "líquido articular", "liquido articular", "líquido intraarticular",
          "liquido intraarticular", "sinovitis", "sinovial", "receso suprapatelar",
          "receso patelar", "fondo de saco", "recesos parapatelares", "receso femororotuliano",
          "hidrartrosis", "hidrartros"
        ];
      case "baker_cyst":
        return [
          "baker", "quiste de baker", "quiste popliteo", "quiste poplíteo",
          "quiste en fosa poplítea", "colección líquida en fosa poplítea",
          "semimembranoso-gemelo"
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
            "no se visualizan"
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

              // Also check for distinct non-coordinated structures to prevent negation from bleeding through unrelated findings.
              // Standard listings like "ni", "o", "tampoco", "y sin" are coordinated – meaning negation continues.
              // But "hidrartrosis" ends with "artrosis", so we must NOT treat "hidrartrosis" as a negation-breaking "artrosis".
              const cleanInBetween = inBetween.toLowerCase()
                .replaceAll("hidrartrosis", "")
                .replaceAll("hidrartros", "");

              let hasUnrelatedCrossTalk = false;
              if (cleanInBetween.includes("bursitis") || cleanInBetween.includes("artrosis")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "joint_effusion" && cleanInBetween.includes("derrame")) {
                hasUnrelatedCrossTalk = true;
              }
              if (id !== "baker_cyst" && cleanInBetween.includes("quiste")) {
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

          // Check succeeding negation/normality (e.g., "Quiste de Baker: No se observa")
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
      case "quadriceps":
      case "patellar": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "desgarro total", "ruptura total", "rotura total", 
          "espesor completo", "espesor total", "ruptura transfixiante", "retract"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "espesor parcial", "intrasustancia", "intratendinos", 
          "lesión parcial", "lesion parcial", "fisura", 
          "discontinuidad parcial", "microdesgarro", "desgarro", "rotura", "ruptura"
        ];
        const tendinosisKws = [
          "tendinosis", "tendinopatía", "tendinopatia", 
          "engrosamiento", "engrosado", "hipoecoica", 
          "hipoecogénic", "hipoecogenic", "anisotropía", "anisotropia", "edema", "inflama", "gonalgia"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(tendinosisKws)) return "tendinosis";
        return "normal";
      }

      case "lcm":
      case "lce": {
        const completeKws = [
          "desgarro completo", "ruptura completa", "rotura completa", 
          "grado iii", "grado 3", "ruptura total", "desgarro grado iii"
        ];
        const partialKws = [
          "desgarro parcial", "ruptura parcial", "rotura parcial", 
          "esquince parcial", "grado ii", "grado 2", "desgarro grado ii", "lesión parcial"
        ];
        const esguinceLeveKws = [
          "esguince", "distensión", "distendido", "edema peritendinoso", 
          "grado i", "grado 1", "esguince grado i", "engrosado"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(esguinceLeveKws)) return "esguince_leve";
        return "normal";
      }

      case "medial_meniscus":
      case "lateral_meniscus": {
        const roturaKws = [
          "rotura", "desgarro", "ruptura", "fisura", "fractura",
          "radial", "horizon", "oblicu", "discontinu", "asa de balde", "lesión", "lesion"
        ];
        const meniscosisKws = [
          "meniscosis", "degeneración mixoide", "degeneracion mixoide", 
          "cambios degenerativos", "señal intramural", "degenerativo"
        ];

        if (hasPathology(roturaKws)) return "rotura";
        if (hasPathology(meniscosisKws)) return "meniscosis";
        return "normal";
      }

      case "joint_effusion": {
        const effusionKws = ["derrame", "líquido", "liquido", "sinovitis", "distensión capsular", "distendido", "hidrartrosis", "hidrartros"];
        const moderateEffusionKws = ["moderado", "abundante", "notorio", "severo", "grande", "importante", "franco", "significativo"];

        if (hasPathology(effusionKws)) {
          const lowerNoNegationsModerate = moderateEffusionKws.some(mkw => lower.includes(mkw));
          return lowerNoNegationsModerate ? "derrame_moderado" : "derrame_leve";
        }
        return "normal";
      }

      case "baker_cyst": {
        const cystKws = ["baker", "quiste", "colección líquida", "coleccion liquida", "colección fluida", "coleccion fluida"];
        const severeKws = ["grande", "voluminoso", "severo", "complicado", "marcado", "roto", "distendido"];

        if (hasPathology(cystKws)) {
          const lowerNoNegationsSevere = severeKws.some(skw => lower.includes(skw));
          return lowerNoNegationsSevere ? "quiste_severo" : "quiste_leve";
        }
        return "normal";
      }

      default:
        return "no_descrito";
    }
  };

  // Helper parser to extract findings for a specific structure from the written report to avoid inventing data
  const extractDescriptionFromReportText = (id: string, reportText: string): string => {
    if (!reportText) return "";
    
    const lines = reportText.split("\n");
    const keywords = getStructureKeywords(id);
    const candidates: string[] = [];

    // 1. Gather candidates from line-by-line matches with contextual line compiling
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const lowerLine = line.toLowerCase();
      
      const matches = keywords.some(kw => lowerLine.includes(kw));
      if (matches) {
        // Clear style markers like dashes, lists, asterisk, numbers or headers
        let clean = line.replace(/^[\s*-|#\d.?+•\t]+\s*/g, "");
        
        if (clean.length > 20) {
          candidates.push(clean.trim());
        } else {
          // Look at the next few lines
          let compiledText = "";
          for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
            const nextLine = lines[j].trim();
            if (!nextLine) continue;
            
            // Break if we hit a different section or custom boundary
            if (nextLine.startsWith("#") || nextLine.match(/^\d+\./) || nextLine.toLowerCase().includes("hueso") || nextLine.toLowerCase().includes("diagnóstico") || nextLine.match(/^[A-Z\s]{4,}:/)) {
              break;
            }
            
            // CRITICAL: Prevent cross-talk. If the next line belongs to another structure, do not compile it!
            const otherIds = ["quadriceps", "patellar", "lcm", "lce", "medial_meniscus", "lateral_meniscus", "joint_effusion", "baker_cyst"].filter(otherId => otherId !== id);
            const containsOtherStructure = otherIds.some(otherId => {
              const otherKws = getStructureKeywords(otherId);
              return otherKws.some(kw => nextLine.toLowerCase().includes(kw));
            });
            if (containsOtherStructure) {
              break;
            }

            compiledText += (compiledText ? " " : "") + nextLine;
            if (compiledText.length > 150) break;
          }
          if (compiledText.trim().length > 10) {
            candidates.push(`${clean} ${compiledText.trim()}`.trim());
          } else {
            candidates.push(clean.trim());
          }
        }
      }
    }

    // 2. Gather candidates from sentence-level split for safety / completeness
    const sentences = reportText.split(/[.·•\n]+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 5) continue;
      const lowerSentence = trimmed.toLowerCase();
      if (keywords.some(kw => lowerSentence.includes(kw))) {
        candidates.push(trimmed);
      }
    }

    // Filter out empty candidates and remove duplicates
    const uniqueCandidates = Array.from(new Set(candidates.filter(c => c.trim().length > 0)));

    if (uniqueCandidates.length === 0) return "";

    // 3. Find the best candidate: pathological finding gets highest priority!
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
        const borderMarker = "\n---\n";
        return reportText + borderMarker + `* **${translateStructureLabelInBrief(id)}**: ${newDescription}\n`;
      }
    }

    return newLines.join("\n");
  };

  // Helper to translate structure IDs into natural labels in Brief
  const translateStructureLabelInBrief = (id: string): string => {
    switch (id) {
      case "quadriceps": return "Tendón Cuadricipital";
      case "patellar": return "Tendón Rotuliano";
      case "lcm": return "Ligamento Colateral Medial";
      case "lce": return "Ligamento Colateral Lateral";
      case "medial_meniscus": return "Menisco Medial";
      case "lateral_meniscus": return "Menisco Lateral";
      case "joint_effusion": return "Derrame Articular";
      case "baker_cyst": return "Quiste de Baker";
      default: return id;
    }
  };

  const runLocalHeuristics = (logs: string[]) => {
    const updatedStates: Record<string, string> = { ...states };
    const updatedDescriptions: Record<string, string> = { ...customDescriptions };

    const structureKeys = ["quadriceps", "patellar", "lcm", "lce", "medial_meniscus", "lateral_meniscus", "joint_effusion", "baker_cyst"];
    
    let parsedCount = 0;
    let foundPathologies = 0;

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => generatedReport.toLowerCase().includes(kw));

      if (isMentioned) {
        const extractedFindings = extractDescriptionFromReportText(id, generatedReport);
        const parsedState = parseStateFromText(id, extractedFindings || "");
        
        updatedStates[id] = parsedState;
        updatedDescriptions[id] = extractedFindings || "";
        
        parsedCount++;
        if (parsedState !== "normal") foundPathologies++;
        logs.push(`[Sincronización Local] ${translateStructureLabelInBrief(id)}: ${parsedState.toUpperCase()}`);
      } else {
        updatedStates[id] = "no_descrito";
        updatedDescriptions[id] = "";
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Rodilla (${generatedReport.length} caracteres)...`);
    
    const structures = [
      {
        id: "quadriceps",
        label: "Tendón Cuadricipital",
        allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "patellar",
        label: "Tendón Rotuliano",
        allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "lcm",
        label: "Ligamento Colateral Medial",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "lce",
        label: "Ligamento Colateral Lateral",
        allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "medial_meniscus",
        label: "Menisco Medial",
        allowedStates: ["no_descrito", "normal", "meniscosis", "rotura"]
      },
      {
        id: "lateral_meniscus",
        label: "Menisco Lateral",
        allowedStates: ["no_descrito", "normal", "meniscosis", "rotura"]
      },
      {
        id: "joint_effusion",
        label: "Derrame Articular",
        allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"]
      },
      {
        id: "baker_cyst",
        label: "Quiste de Baker",
        allowedStates: ["no_descrito", "normal", "quiste_leve", "quiste_severo"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Rodilla",
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
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía:", err);
      logs.push(`[Error de red] ${err.message || String(err)}.`);
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
    if (state === "no_descrito") return "Estructura no descrita.";
    if (state === "normal") return "Dentro de límites normales.";

    switch (id) {
      case "quadriceps":
        if (state === "tendinosis") return "Engrosamiento difuso de su inserción con pérdida del patrón fibrilar normal e hipoecogenicidad leve.";
        if (state === "desgarro_parcial") return "Discontinuidad parcial focal en la vertiente profunda de la inserción.";
        if (state === "desgarro_completo") return "Ruptura completa y transfixiante con retracción de los extremos tendinosos.";
        break;
      case "patellar":
        if (state === "tendinosis") return "Tendinopatía distal con aumento de grosor e hipoecogenicidad del tendón proximal.";
        if (state === "desgarro_parcial") return "Presencia de microrupturas intrasustancia con pérdida zonal de fibras.";
        if (state === "desgarro_completo") return "Ruptura completa del tendón con ascenso rotuliano evidente.";
        break;
      case "lcm":
        if (state === "esguince_leve") return "Engrosamiento leve del ligamento colateral medial con líquido y edema peritendinoso.";
        if (state === "desgarro_parcial") return "Separación parcial de las fibras con conservación del trayecto lineal.";
        if (state === "desgarro_completo") return "Discontinuidad completa de sus fibras con inestabilidad articular.";
        break;
      case "lce":
        if (state === "esguince_leve") return "Edema de partes blandas adyacentes al ligamento colateral lateral con discreta distensión.";
        if (state === "desgarro_parcial") return "Pérdida focal de la ecogenicidad habitual del ligamento lateral.";
        if (state === "desgarro_completo") return "Ruptura completa del trayecto fibrilar proximal/distal.";
        break;
      case "medial_meniscus":
        if (state === "meniscosis") return "Aumento difuso de señal degenerativa intra-sustancia, sin compromiso de superficies articulares.";
        if (state === "rotura") return "Fisura lineal oblicua que compromete la superficie articular inferior del cuerno posterior.";
        break;
      case "lateral_meniscus":
        if (state === "meniscosis") return "Cambios mucodesestructurantes y de señal mixoide en el cuerpo meniscal.";
        if (state === "rotura") return "Desgarro longitudinal radial en el cuerno anterior del menisco externo.";
        break;
      case "joint_effusion":
        if (state === "derrame_leve") return "Presencia de derrame articular laminar discreto en receso suprapatelar.";
        if (state === "derrame_moderado") return "Derrame articular franco/abundante con distensión del receso suprapatelar y de recesos laterales.";
        break;
      case "baker_cyst":
        if (state === "quiste_leve") return "Pequeña colección fluida lobulada delimitada en el espacio poplíteo profundo.";
        if (state === "quiste_severo") return "Quiste de Baker voluminoso con distensión de los límites y riesgo de ruptura.";
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

    switch (id) {
      case "quadriceps":
        if (state === "tendinosis") {
          return "Tendinosis cuadricipital (engrosamiento difuso de su inserción con hipoecogenicidad leve, sin rotura).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial focal en la vertiente profunda de la inserción.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa y transfixiante con retracción de los extremos tendinosos.";
        }
        break;

      case "patellar":
        if (state === "tendinosis") {
          return "Tendinopatía rotuliana / engrosamiento distal con hipoecogenicidad, sin fisuras.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial / microdesgarros longitudinales con pérdida de patrón fibrilar.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa del tendón rotuliano con ascenso de la rótula.";
        }
        break;

      case "lcm":
        if (state === "esguince_leve") {
          return "Esguince grado I/II del ligamento colateral medial (LCM) con edema peroligamentario.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura parcial focal del ligamento colateral medial con pérdida parcial de fibras.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura ligamentaria completa de las fibras del ligamento colateral medial.";
        }
        break;

      case "lce":
        if (state === "esguince_leve") {
          return "Esguince grado I/II del ligamento colateral lateral (LCE) con edema de partes blandas.";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial proximal del ligamento colateral lateral.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa del trayecto fibrilar del ligamento colateral lateral.";
        }
        break;

      case "medial_meniscus":
        if (state === "meniscosis") {
          return "Meniscosis interna (degeneración mixoide intrasustancia en cuerno posterior).";
        }
        if (state === "rotura") {
          return "Fisura / rotura lineal oblicua en el cuerno posterior del menisco interno.";
        }
        break;

      case "lateral_meniscus":
        if (state === "meniscosis") {
          return "Meniscosis externa (cambios mucodesestructurantes de señal mixoide en cuerpo).";
        }
        if (state === "rotura") {
          return "Desgarro o rotura compleja en el cuerno posterior o anterior del menisco externo.";
        }
        break;

      case "joint_effusion":
        if (state === "derrame_leve") {
          return "Derrame articular discreto / laminar en receso suprapatelar.";
        }
        if (state === "derrame_moderado") {
          return "Derrame articular moderado/abundante con distensión de fondos de saco.";
        }
        break;

      case "baker_cyst":
        if (state === "quiste_leve") {
          return "Pequeño quiste de Baker incidental en fosa poplítea, de contornos lisos.";
        }
        if (state === "quiste_severo") {
          return "Quiste de Baker voluminoso delimitado en fosa poplítea profunda.";
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
    
    if (s === "no_descrito") {
      return {
        fill: activeHover === id ? "#334155" : "#1e293b",
        stroke: activeHover === id ? "#64748b" : "#475569"
      };
    }
    if (s === "normal") {
      return {
        fill: activeHover === id ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.22)",
        stroke: "#10b981"
      };
    }
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve") {
      return {
        fill: activeHover === id ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.25)",
        stroke: "#f59e0b"
      };
    }
    if (s === "desgarro_parcial") {
      return {
        fill: activeHover === id ? "rgba(236, 72, 153, 0.55)" : "rgba(236, 72, 153, 0.28)",
        stroke: "#ec4899"
      };
    }
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo") {
      return {
        fill: activeHover === id ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
        stroke: "#f43f5e"
      };
    }

    return { fill: "#1e293b", stroke: "#475569" };
  };

  // Compile 2-Column Markdown table for inclusion in active reports
  const generateTableMarkdown = () => {
    let md = "| Estructura | Hallazgos |\n";
    md += "| :--- | :--- |\n";

    const rows = [
      { id: "quadriceps", label: "Tendón Cuadricipital" },
      { id: "patellar", label: "Tendón Rotuliano" },
      { id: "lcm", label: "Lig. Colateral Medial" },
      { id: "lce", label: "Lig. Colateral Lateral" },
      { id: "medial_meniscus", label: "Menisco Medial" },
      { id: "lateral_meniscus", label: "Menisco Lateral" },
      { id: "joint_effusion", label: "Derrame Articular" },
      { id: "baker_cyst", label: "Quiste de Baker" }
    ];

    let hasRows = false;
    rows.forEach(row => {
      if (states[row.id] !== "no_descrito") {
        const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id);
        md += `| **${row.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos descritos* | *Consulte el texto completo del reporte* |\n`;
    }

    return md;
  };

  const generateNarrativeText = () => {
    const list = [
      { id: "quadriceps", label: "Tendón Cuadricipital" },
      { id: "patellar", label: "Tendón Rotuliano" },
      { id: "lcm", label: "Ligamento Colateral Medial (LCM)" },
      { id: "lce", label: "Ligamento Colateral Lateral (LCE)" },
      { id: "medial_meniscus", label: "Menisco Medial" },
      { id: "lateral_meniscus", label: "Menisco Lateral" },
      { id: "joint_effusion", label: "Derrame Receso Suprapatelar" },
      { id: "baker_cyst", label: "Quiste de Baker" }
    ];

    let md = "";
    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const statusText = states[item.id] === "normal" ? "Normal" : "Alterado / Lesión";
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `* **${item.label}** [${statusText.toUpperCase()}]: ${desc}\n`;
      }
    });

    if (!md) {
      md = "* *No se han configurado hallazgos o anatomía específica.*";
    }

    return md;
  };

  const getSeverityBadge = (s: string) => {
    if (s === "no_descrito") return "bg-slate-900 text-slate-500 border-slate-850";
    if (s === "normal") return "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve") {
      return "bg-amber-950/40 text-amber-500 border-amber-900/40";
    }
    if (s === "desgarro_parcial") return "bg-pink-950/40 text-pink-500 border-pink-900/40";
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo") {
      return "bg-rose-950/50 text-rose-500 border-rose-900/50";
    }
    return "bg-slate-900 text-slate-400 border-slate-800";
  };

  const getClinicalImpact = (s: string) => {
    if (s === "no_descrito") return "Presencia no especificada.";
    if (s === "normal") return "Sin impacto clínico";
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve") return "Leve / Moderado";
    if (s === "desgarro_parcial") return "Significativo";
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo") return "Severo / Clínicamente Crítico";
    return "Moderado";
  };

  // Quick reset all states
  const handleResetStates = () => {
    if (confirm("¿Estás seguro de que deseas restablecer los estados de anatomía de rodilla?")) {
      setStates({
        quadriceps: "no_descrito",
        patellar: "no_descrito",
        lcm: "no_descrito",
        lce: "no_descrito",
        medial_meniscus: "no_descrito",
        lateral_meniscus: "no_descrito",
        joint_effusion: "no_descrito",
        baker_cyst: "no_descrito"
      });
      setCustomDescriptions({
        quadriceps: "",
        patellar: "",
        lcm: "",
        lce: "",
        medial_meniscus: "",
        lateral_meniscus: "",
        joint_effusion: "",
        baker_cyst: ""
      });
      setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: Restablecidos todos los mapeos de rodilla`]);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header Info HUD */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850/65 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider font-sans">
              Mapeo Anatómico e Interactividad de Rodilla
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Sincroniza dinámicamente el reporte médico con una representación gráfica de la articulación de la rodilla.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-350 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-mono"
            title="Escanear y recopilar del informe médico actual"
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3 w-3 text-indigo-400 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar Reporte
          </button>
          
          <button
            onClick={handleResetStates}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition-all cursor-pointer"
            title="Restablecer mapeos"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: INTERACTIVE DRAWING (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/40 rounded-2xl border border-slate-850 p-4 flex flex-col items-center justify-between min-h-[380px] relative">
          
          <div className="absolute top-3 left-3 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[8px] font-black text-indigo-400 uppercase tracking-widest font-mono">
            VISTA ANTERIOR DE LA RODILLA
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-2 py-0.5 rounded border border-slate-800 text-[8px] font-bold text-slate-500 uppercase font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Dinámico
          </div>

          {/* Interactive Workspace */}
          <div className="w-full flex items-center justify-center py-2 mt-7">
            <svg 
              id="knee-anatomy-svg"
              viewBox="0 0 350 350" 
              className="w-full max-w-[300px] h-auto drop-shadow-2xl"
              style={{ maxHeight: "310px" }}
            >
              <defs>
                <linearGradient id="boneKneeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2e3d52" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="patellaGrad" x1="0%" y1="0%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#3d4e66" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <pattern id="stripeKneePattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="2.5" />
                </pattern>
              </defs>

              {/* Background structural guidelines - Grid/Circle */}
              <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
              <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />
              <line x1="20" y1="175" x2="330" y2="175" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

              {/* BONES BLOCK */}
              {/* Femur (Distal) */}
              <path 
                d="M 125,30 L 125,120 C 125,130 110,135 110,150 C 110,168 135,178 155,172 C 165,168 175,158 175,158 C 175,158 185,168 195,172 C 215,178 240,168 240,150 C 240,135 225,130 225,120 L 225,30 Z" 
                fill="url(#boneKneeGrad)" 
                stroke="#334155" 
                strokeWidth="1.5" 
              />
              <text x="175" y="55" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">FÉMUR</text>

              {/* Tibia (Proximal) */}
              <path 
                d="M 130,320 L 130,225 C 130,215 120,210 120,198 C 120,192 135,188 152,192 C 160,194 175,200 175,200 C 175,200 190,194 198,192 C 215,188 230,192 230,198 C 230,210 220,215 220,225 L 220,320 Z" 
                fill="url(#boneKneeGrad)" 
                stroke="#334155" 
                strokeWidth="1.5" 
              />
              <text x="175" y="295" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

              {/* Fibula / Peroné (Lateral is shown on the Left side visually for the right knee, active side X<175 is medial) */}
              {/* Let's place it on the Right side visually (X > 220) */}
              <path 
                d="M 233,230 L 243,222 C 248,222 254,228 254,236 L 252,320 L 235,320 Z" 
                fill="url(#boneKneeGrad)" 
                stroke="#334155" 
                strokeWidth="1.2" 
              />
              <text x="245" y="275" fill="#3b4b5e" fontSize="7" fontStyle="italic" textAnchor="middle">Peroné</text>

              {/* ACTIVE PATHWAYS / EVAL KEYS */}

              {/* 1. Receso Suprapatelar / Derrame Articular */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("joint_effusion")}
                onMouseEnter={() => setActiveHover("joint_effusion")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 148,65 C 160,50 190,50 202,65 C 206,75 204,95 195,100 C 185,105 165,105 155,100 C 146,95 144,75 148,65 Z" 
                  fill={getColorForSVG("joint_effusion").fill} 
                  stroke={getColorForSVG("joint_effusion").stroke} 
                  strokeWidth={states.joint_effusion !== "normal" ? "3" : "1"}
                  fillOpacity={states.joint_effusion !== "normal" ? "0.6" : "0.15"}
                  strokeDasharray={states.joint_effusion === "derrame_leve" ? "3,3" : "none"}
                />
                <line x1="175" y1="62" x2="115" y2="62" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="175" cy="62" r="2" fill="#81a1c1" />
              </g>

              {/* 2. Tendón Cuadricipital */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("quadriceps")}
                onMouseEnter={() => setActiveHover("quadriceps")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 154,40 L 196,40 L 193,86 L 157,86 Z" 
                  fill={getColorForSVG("quadriceps").fill} 
                  stroke={getColorForSVG("quadriceps").stroke} 
                  strokeWidth={states.quadriceps !== "normal" ? "3.5" : "1.5"}
                  fillOpacity={states.quadriceps !== "normal" ? "0.6" : "0.2"}
                  strokeDasharray={states.quadriceps === "tendinosis" ? "2,2" : "none"}
                />
                <line x1="175" y1="50" x2="230" y2="50" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="175" cy="50" r="2" fill="#81a1c1" />
              </g>

              {/* 3. Rótula / Patella (Neutral / Reference) */}
              <path 
                d="M 152,88 C 165,83 185,83 198,88 C 206,102 206,122 196,134 C 185,142 165,142 154,134 C 144,122 144,102 152,88 Z" 
                fill="url(#patellaGrad)" 
                stroke="#475569" 
                strokeWidth="1.5" 
              />
              <text x="175" y="114" fill="#cbd5e1" fontSize="7.5" fontWeight="bold" textAnchor="middle">RÓTULA</text>

              {/* 4. Meniscos (Interpuestos en el espacio articular) */}
              {/* Menisco Medial (Left visually X < 175) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("medial_meniscus")}
                onMouseEnter={() => setActiveHover("medial_meniscus")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 124,175 C 138,175 148,177 151,182 C 144,185 132,185 124,181 C 120,180 120,177 124,175 Z" 
                  fill={getColorForSVG("medial_meniscus").fill} 
                  stroke={getColorForSVG("medial_meniscus").stroke} 
                  strokeWidth={states.medial_meniscus !== "normal" ? "2.5" : "1.2"}
                />
                <line x1="135" y1="178" x2="90" y2="178" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="135" cy="178" r="2" fill="#81a1c1" />
              </g>

              {/* Menisco Lateral (Right visually X > 175) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("lateral_meniscus")}
                onMouseEnter={() => setActiveHover("lateral_meniscus")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 226,175 C 212,175 202,177 199,182 C 206,185 218,185 226,181 C 230,180 230,177 226,175 Z" 
                  fill={getColorForSVG("lateral_meniscus").fill} 
                  stroke={getColorForSVG("lateral_meniscus").stroke} 
                  strokeWidth={states.lateral_meniscus !== "normal" ? "2.5" : "1.2"}
                />
                <line x1="215" y1="178" x2="265" y2="178" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="215" cy="178" r="2" fill="#81a1c1" />
              </g>

              {/* 5. Tendón Rotuliano */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("patellar")}
                onMouseEnter={() => setActiveHover("patellar")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 164,136 L 186,136 C 184,166 182,194 179,206 L 171,206 C 168,194 166,166 164,136 Z" 
                  fill={getColorForSVG("patellar").fill} 
                  stroke={getColorForSVG("patellar").stroke} 
                  strokeWidth={states.patellar !== "normal" ? "3.5" : "1.5"}
                  fillOpacity={states.patellar !== "normal" ? "0.6" : "0.2"}
                  strokeDasharray={states.patellar === "tendinosis" ? "2,2" : "none"}
                />
                <line x1="175" y1="165" x2="230" y2="165" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="175" cy="165" r="2" fill="#81a1c1" />
              </g>

              {/* 6. Ligamento Colateral Medial (Slender on the Medial/Left side) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("lcm")}
                onMouseEnter={() => setActiveHover("lcm")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 112,125 C 114,145 116,165 121,215 L 126,215 C 122,165 119,145 117,125 Z" 
                  fill={getColorForSVG("lcm").fill} 
                  stroke={getColorForSVG("lcm").stroke} 
                  strokeWidth={states.lcm !== "normal" ? "3" : "1.2"}
                  fillOpacity={states.lcm !== "normal" ? "0.6" : "0.2"}
                />
                <line x1="115" y1="155" x2="80" y2="155" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="115" cy="155" r="2" fill="#81a1c1" />
              </g>

              {/* 7. Ligamento Colateral Lateral (Lateral/Right side visually) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("lce")}
                onMouseEnter={() => setActiveHover("lce")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 235,125 C 238,150 241,175 247,222 L 252,221 C 246,175 243,150 240,125 Z" 
                  fill={getColorForSVG("lce").fill} 
                  stroke={getColorForSVG("lce").stroke} 
                  strokeWidth={states.lce !== "normal" ? "3" : "1.2"}
                  fillOpacity={states.lce !== "normal" ? "0.6" : "0.2"}
                />
                <line x1="243" y1="155" x2="280" y2="155" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="243" cy="155" r="2" fill="#81a1c1" />
              </g>

              {/* 8. Quiste de Baker / Fosa Poplítea (Protrusion left deep side) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("baker_cyst")}
                onMouseEnter={() => setActiveHover("baker_cyst")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 90,215 C 75,230 75,260 92,265 C 108,268 114,248 109,235 C 105,220 98,210 90,215 Z" 
                  fill={getColorForSVG("baker_cyst").fill} 
                  stroke={getColorForSVG("baker_cyst").stroke} 
                  strokeWidth={states.baker_cyst !== "normal" ? "3" : "1"}
                  fillOpacity={states.baker_cyst !== "normal" ? "0.6" : "0.1"}
                />
                <line x1="95" y1="235" x2="60" y2="235" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="95" cy="235" r="2" fill="#81a1c1" />
              </g>

              {/* LABELS TEXT GUIDES ON GRAPH */}
              <text x="55" y="65" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Derrame suprapatelar</text>
              <text x="52" y="157" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Colateral Medial (LCM)</text>
              <text x="52" y="238" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Quiste de Baker</text>
              <text x="85" y="181" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Menisco Medial</text>

              <text x="248" y="53" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">T. Cuadricipital</text>
              <text x="286" y="157" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Colateral Lateral (LCE)</text>
              <text x="248" y="168" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">T. Rotuliano</text>
              <text x="270" y="181" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Menisco Lateral</text>

            </svg>
          </div>

          <div className="w-full text-center py-1 mt-1 border-t border-slate-900/40">
            <span className="text-[9px] text-slate-500 font-medium font-sans">
              💡 Haz clic en los marcadores anatómicos del dibujo para interactuar
            </span>
          </div>

        </div>

        {/* RIGHT COLUMN: ACTION HUD & CONTROL PANEL (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Active Selection Block */}
          <div className="bg-slate-950/20 rounded-2xl border border-slate-850 p-4 relative">
            <div className="absolute top-3.5 right-4">
              <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase font-mono ${getSeverityBadge(states[selectedStructure])}`}>
                {states[selectedStructure].replace("_", " ")}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-indigo-400" />
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">
                {translateStructureLabelInBrief(selectedStructure)}
              </h4>
            </div>

            {/* Quick State Toggle */}
            <div className="mt-3.5">
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono mb-2">
                Nivel / Estado Clínico detectado:
              </p>

              <div className="flex flex-wrap gap-2">
                {["no_descrito", "normal"].map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStructureState(selectedStructure, st)}
                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                      states[selectedStructure] === st
                        ? "bg-slate-955 border-indigo-500/50 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                        : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                    }`}
                  >
                    {st === "no_descrito" ? "No descrito" : "Sin lesiones / Normal"}
                  </button>
                ))}

                {/* Pathology States based on structure */}
                {(selectedStructure === "quadriceps" || selectedStructure === "patellar") && 
                  ["tendinosis", "desgarro_parcial", "desgarro_completo"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStructureState(selectedStructure, st)}
                      className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                        states[selectedStructure] === st
                          ? "bg-rose-950/20 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))
                }

                {(selectedStructure === "lcm" || selectedStructure === "lce") && 
                  ["esguince_leve", "desgarro_parcial", "desgarro_completo"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStructureState(selectedStructure, st)}
                      className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                        states[selectedStructure] === st
                          ? "bg-rose-950/20 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))
                }

                {(selectedStructure === "medial_meniscus" || selectedStructure === "lateral_meniscus") && 
                  ["meniscosis", "rotura"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStructureState(selectedStructure, st)}
                      className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                        states[selectedStructure] === st
                          ? "bg-rose-950/20 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))
                }

                {selectedStructure === "joint_effusion" && 
                  ["derrame_leve", "derrame_moderado"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStructureState(selectedStructure, st)}
                      className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                        states[selectedStructure] === st
                          ? "bg-rose-950/20 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))
                }

                {selectedStructure === "baker_cyst" && 
                  ["quiste_leve", "quiste_severo"].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStructureState(selectedStructure, st)}
                      className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                        states[selectedStructure] === st
                          ? "bg-rose-950/20 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))
                }
              </div>
            </div>

            {/* Custom Description Textarea */}
            <div className="mt-4">
              <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono block mb-1">
                Hallazgo Clínico detallado (Texto oficial en Reporte):
              </label>

              <textarea
                value={customDescriptions[selectedStructure] || getDefaultDescription(selectedStructure, states[selectedStructure])}
                onChange={(e) => handleUpdateCustomDescription(selectedStructure, e.target.value)}
                placeholder="Introduzca o modifique la redacción médica para esta estructura..."
                className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500/55 min-h-[64px] font-mono leading-relaxed"
                disabled={states[selectedStructure] === "no_descrito"}
              />
              <span className="text-[9px] text-slate-500">
                La redacción modificada se inyectará bidireccionalmente en la sección de Hallazgos del informe médico activo.
              </span>
            </div>

          </div>

          {/* Bidirectional Synchronization settings */}
          <div className="bg-slate-950/40 rounded-2xl border border-slate-850/60 p-4">
            <h5 className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono mb-2">
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

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => onExportTable(generateTableMarkdown())}
                className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer border border-indigo-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe"
              >
                <Download className="h-3 w-3" />
                Inyectar Tabla
              </button>

              <button
                onClick={() => onExportNarrative && onExportNarrative(generateNarrativeText())}
                className="py-2 bg-slate-900 hover:bg-slate-850 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-xl border border-indigo-950/40 transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer"
                title="Inyecta un resumen de hallazgos al final del informe"
              >
                📥 Inyectar Viñetas
              </button>
            </div>
          </div>

          {/* Quick overview grid of all 8 states */}
          <div className="bg-slate-950/20 rounded-2xl border border-slate-850 p-4">
            <h5 className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono mb-2.5">
              Estado de Estructuras Clínicas de Rodilla
            </h5>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.keys(states).filter(id => states[id] !== "no_descrito").map((id) => {
                const s = states[id];
                const isSelected = selectedStructure === id;
                let dotColor = "bg-slate-500";
                if (s === "normal") dotColor = "bg-emerald-500";
                else if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve") dotColor = "bg-amber-500";
                else if (s === "desgarro_parcial") dotColor = "bg-pink-500";
                else if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo") dotColor = "bg-rose-500";

                return (
                  <button
                    key={id}
                    onClick={() => setSelectedStructure(id)}
                    onMouseEnter={() => setActiveHover(id)}
                    onMouseLeave={() => setActiveHover(null)}
                    className={`p-2 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-indigo-500 text-indigo-400"
                        : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-350"
                    }`}
                  >
                    <span className="text-[9px] font-black truncate block uppercase tracking-tight">{translateStructureLabelInBrief(id)}</span>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      <span className="text-[8px] text-slate-500 font-mono truncate uppercase">
                        {s.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Sync Diagnostic Logs Console */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-955 border border-slate-850 rounded-2xl p-4 mt-1">
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-900">
            <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono">Consola de Sincronización Anatómica</span>
            <button 
              onClick={() => setSyncLogs([])}
              className="text-[8px] uppercase text-pink-500 font-bold hover:underline"
            >
              Cerrar Consola
            </button>
          </div>
          <div className="max-h-[90px] overflow-y-auto text-[9.5px] font-mono text-slate-450 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
            {syncLogs.slice().reverse().map((log, index) => (
              <div key={index} className="py-0.5 border-b border-slate-900/40 last:border-0">{log}</div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
