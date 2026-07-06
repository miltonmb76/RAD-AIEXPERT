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

interface ShoulderAnatomyViewerProps {
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
  laterality?: string;
  externalStatesLeft?: Record<string, string>;
  externalDescriptionsLeft?: Record<string, string>;
  onChangeStatesLeft?: (states: Record<string, string>) => void;
  onChangeDescriptionsLeft?: (descriptions: Record<string, string>) => void;
}

// Structure Types
interface ShoulderStructure {
  id: string;
  name: string;
  description: string;
}

export default function ShoulderAnatomyViewer({
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
  additionalFindings = [],
  laterality = "Derecho",
  externalStatesLeft,
  externalDescriptionsLeft,
  onChangeStatesLeft,
  onChangeDescriptionsLeft
}: ShoulderAnatomyViewerProps) {
  
  // States of each structure
  // Levels: 
  // - supraspinatus: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - infraspinatus: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - subscapularis: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - biceps: normal | tendinitis | subluxacion | desgarro_parcial
  // - bursa: normal | bursitis_leve | bursitis_severa
  // - glenohumeral: normal | derrame_leve | derrame_moderado
  // - acromioclavicular: normal | artrosis | hipertrofia
  // - dynamic_assessment: normal | pinzamiento
  const [states, setStates] = useState<Record<string, string>>({
    supraspinatus: "no_descrito",
    infraspinatus: "no_descrito",
    subscapularis: "no_descrito",
    biceps: "no_descrito",
    bursa: "no_descrito",
    glenohumeral: "no_descrito",
    acromioclavicular: "no_descrito",
    dynamic_assessment: "no_descrito"
  });

  // Manual or custom descriptive text override
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    supraspinatus: "",
    infraspinatus: "",
    subscapularis: "",
    biceps: "",
    bursa: "",
    glenohumeral: "",
    acromioclavicular: "",
    dynamic_assessment: ""
  });

  // Left-Side Anatomical States for Bilateral Studies
  const [statesLeft, setStatesLeft] = useState<Record<string, string>>({
    supraspinatus: "no_descrito",
    infraspinatus: "no_descrito",
    subscapularis: "no_descrito",
    biceps: "no_descrito",
    bursa: "no_descrito",
    glenohumeral: "no_descrito",
    acromioclavicular: "no_descrito",
    dynamic_assessment: "no_descrito"
  });

  const [customDescriptionsLeft, setCustomDescriptionsLeft] = useState<Record<string, string>>({
    supraspinatus: "",
    infraspinatus: "",
    subscapularis: "",
    biceps: "",
    bursa: "",
    glenohumeral: "",
    acromioclavicular: "",
    dynamic_assessment: ""
  });

  const [activeSide, setActiveSide] = useState<"derecho" | "izquierdo">("derecho");

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("supraspinatus");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);

  // States for Supraspinatus Ruptures Manual Tuning & Layout Mode
  const [includeSupraspinatusInPdf, setIncludeSupraspinatusInPdf] = useState<boolean>(true);
  const [supraspinatusRuptureTypeRight, setSupraspinatusRuptureTypeRight] = useState<string>("auto");
  const [supraspinatusRuptureTypeLeft, setSupraspinatusRuptureTypeLeft] = useState<string>("auto");

  const [supraspinatusSideView, setSupraspinatusSideView] = useState<"derecho" | "izquierdo" | "bilateral">(
    laterality === "Bilateral" ? "bilateral" :
    (laterality === "Izquierdo" || laterality === "Izquierda" || laterality === "izquierdo" || laterality === "L" || laterality === "Left") ? "izquierdo" :
    "derecho"
  );

  useEffect(() => {
    const side = 
      laterality === "Bilateral" ? "bilateral" :
      (laterality === "Izquierdo" || laterality === "Izquierda" || laterality === "izquierdo" || laterality === "L" || laterality === "Left") ? "izquierdo" :
      "derecho";
    setSupraspinatusSideView(side);
  }, [laterality]);

  const [manualRuptureDetailsRight, setManualRuptureDetailsRight] = useState<SupraspinatusRuptureDetails>({
    type: "none",
    surface: "articular",
    thicknessPercent: 50,
    distanceFromInsertion: 0,
    gap: 5,
    tendonAPSize: 32,
    ruptureAPSize: 12,
    location: "anterior",
    retractionDistance: 15
  });

  const [manualRuptureDetailsLeft, setManualRuptureDetailsLeft] = useState<SupraspinatusRuptureDetails>({
    type: "none",
    surface: "articular",
    thicknessPercent: 50,
    distanceFromInsertion: 0,
    gap: 5,
    tendonAPSize: 32,
    ruptureAPSize: 12,
    location: "anterior",
    retractionDistance: 15
  });

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
    if (externalStatesLeft && Object.keys(externalStatesLeft).length > 0) {
      setStatesLeft(prev => {
        const changed = Object.keys(externalStatesLeft).some(key => externalStatesLeft[key] !== prev[key]);
        return changed ? { ...prev, ...externalStatesLeft } : prev;
      });
    }
  }, [externalStatesLeft]);

  useEffect(() => {
    if (externalDescriptionsLeft && Object.keys(externalDescriptionsLeft).length > 0) {
      setCustomDescriptionsLeft(prev => {
        const changed = Object.keys(externalDescriptionsLeft).some(key => externalDescriptionsLeft[key] !== prev[key]);
        return changed ? { ...prev, ...externalDescriptionsLeft } : prev;
      });
    }
  }, [externalDescriptionsLeft]);

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

  useEffect(() => {
    if (onChangeStatesLeft) {
      onChangeStatesLeft(statesLeft);
    }
  }, [statesLeft, onChangeStatesLeft]);

  useEffect(() => {
    if (onChangeDescriptionsLeft) {
      onChangeDescriptionsLeft(customDescriptionsLeft);
    }
  }, [customDescriptionsLeft, onChangeDescriptionsLeft]);

  // Unified helper that supports Spanish spelling variations, abbreviations, and common typos (e.g. "supraesponoso")
  const getStructureKeywords = (id: string): string[] => {
    switch (id) {
      case "supraspinatus":
        return [
          "supraespinoso", "supraespinosa", 
          "supraesponoso", "supraesponosa", 
          "supraspinatus", "supraspinoso", 
          "supra-espinoso", "supra espinoso",
          "manguito rotador superior", "manguito superior", "tendon superior"
        ];
      case "infraspinatus":
        return [
          "infraespinoso", "infraespinosa", 
          "infraesponoso", "infraesponosa", 
          "infraspinatus", "infraspinoso", 
          "infra-espinoso", "infra espinoso"
        ];
      case "subscapularis":
        return [
          "subescapular", "subescapulares", 
          "subscapularis", "sub-escapular", "sub escapular"
        ];
      case "biceps":
        return [
          "bíceps", "biceps", "bicipital", 
          "porción larga", "porcion larga", "plb"
        ];
      case "bursa":
        return [
          "bursa", "bursitis", "subacromiodeltoidea", "sad", "bolsa serosa", "bolsa subacromio"
        ];
      case "glenohumeral":
        return [
          "glenohumeral", "derrame", "receso posterior", "receso axilar", 
          "líquido articular", "liquido articular", "líquido intraarticular", 
          "liquido intraarticular", "articulación escapulohumeral", "articulacion escapulohumeral"
        ];
      case "acromioclavicular":
        return [
          "acromioclavicular", "artrosis", "osteofitos", "clavícula", "clavicula", "acromion"
        ];
      case "dynamic_assessment":
        return [
          "dinámica", "dinamica", "dinámico", "dinamico", 
          "pinzamiento", "impingement", "neer", "yocum", 
          "hawkins", "maniobra", "conflicto"
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
          // Find the last list item, clause or sentence boundary (period, semicolon, colon, bullet)
          const lastBoundary = Math.max(
            priorText.lastIndexOf("."),
            priorText.lastIndexOf(";"),
            priorText.lastIndexOf(":"),
            priorText.lastIndexOf("-"),
            priorText.lastIndexOf("•")
          );
          const precedingText = lastBoundary !== -1
            ? priorText.substring(lastBoundary + 1)
            : priorText;
          
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
            "excluye"
          ];
          
          const isNegated = negations.some(neg => {
            const negIdx = precedingText.lastIndexOf(neg);
            if (negIdx !== -1) {
              const inBetween = precedingText.substring(negIdx + neg.length);
              // Avoid cross-talk across structures that might be mentioned back-to-back
              if (inBetween.includes("bursitis") || inBetween.includes("derrame") || inBetween.includes("artrosis")) {
                return false;
              }
              return true;
            }
            return false;
          });
          
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
      case "supraspinatus":
      case "infraspinatus":
      case "subscapularis": {
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
          "hipoecogénic", "hipoecogenic", "anisotropía", "anisotropia", "edema", "inflama"
        ];

        if (hasPathology(completeKws)) return "desgarro_completo";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(tendinosisKws)) return "tendinosis";
        return "normal";
      }

      case "biceps": {
        const subluxKws = ["subluxa", "luxa", "desplazamiento medial", "fuera de la corredera"];
        const partialKws = [
          "desgarro", "ruptura", "rotura", "espesor parcial", 
          "intratendinos", "lesión parcial", "lesion parcial", "discontinuidad"
        ];
        const tendinitisKws = [
          "tenosinovitis", "tendinitis", "líquido", "liquido", 
          "derrame", "distundido", "colección", "coleccion", "engrosamiento"
        ];

        if (hasPathology(subluxKws)) return "subluxacion";
        if (hasPathology(partialKws)) return "desgarro_parcial";
        if (hasPathology(tendinitisKws)) return "tendinitis";
        return "normal";
      }

      case "bursa": {
        const inflammationKws = ["bursitis", "distensión", "distendido", "líquido", "liquido", "engrosamiento", "engrosada"];
        const severeKws = ["sever", "marcad", "abundante", "importante", "franc", "significativ", "notori", "grav", "acusad"];
        
        if (hasPathology(inflammationKws)) {
          // Check if any severity keyword is present (and not negated)
          const lowerNoNegationsSevere = severeKws.some(skw => lower.includes(skw));
          return lowerNoNegationsSevere ? "bursitis_severa" : "bursitis_leve";
        }
        return "normal";
      }

      case "glenohumeral": {
        const effusionKws = ["derrame", "líquido", "liquido", "colección", "coleccion", "distens"];
        const moderateSevereKws = ["moderad", "abundante", "notori", "sever", "significativ", "importante", "franc"];
        
        if (hasPathology(effusionKws)) {
          // Check if any moderate/severe keyword is present
          const lowerNoNegationsModSevere = moderateSevereKws.some(mskw => lower.includes(mskw));
          return lowerNoNegationsModSevere ? "derrame_moderado" : "derrame_leve";
        }
        return "normal";
      }

      case "acromioclavicular": {
        const hypertrophyKws = ["hipertrof", "hipertrófica", "prominencia", "osteofito", "calcifica"];
        const arthrosisKws = ["artrosis", "pinzamiento", "degenerativ", "irregularidad", "erosi", "estrecham"];

        if (hasPathology(hypertrophyKws)) return "hipertrofia";
        if (hasPathology(arthrosisKws)) return "artrosis";
        return "normal";
      }

      case "dynamic_assessment": {
        const pinzamientoKws = ["pinzamiento", "impingement", "conflicto", "atrapamiento", "positivo"];
        const normalKws = ["negativo", "libre", "conservado", "sin s", "adecuado", "normal"];
        
        if (hasPathology(pinzamientoKws)) return "pinzamiento";
        if (hasPathology(normalKws)) return "normal";
        if (hasPathology(["dinamic", "dinámic", "maniobra"])) return "normal";
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
        let clean = line.replace(/^[\s*\-|#\d.?+•\t]+\s*/g, "");
        
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
            const otherIds = ["supraspinatus", "infraspinatus", "subscapularis", "biceps", "bursa", "glenohumeral", "acromioclavicular"].filter(otherId => otherId !== id);
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
    // Pathology means parseStateFromText returns something other than "normal" or "no_descrito"
    let bestCandidate = uniqueCandidates[0];
    let foundPathological = false;

    for (const candidate of uniqueCandidates) {
      const state = parseStateFromText(id, candidate);
      if (state !== "normal" && state !== "no_descrito") {
        if (!foundPathological) {
          bestCandidate = candidate;
          foundPathological = true;
        } else {
          // If already found a pathological candidate, pick the more descriptive (longer) one
          if (candidate.length > bestCandidate.length) {
            bestCandidate = candidate;
          }
        }
      }
    }

    // If no pathological candidate found, pick the longest candidate (most detailed normal description)
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
        // Look for a colon divider
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const prefix = line.substring(0, colonIndex + 1);
          updated = true;
          return `${prefix} ${newDescription}`;
        } else {
          // Keep bullet / decoration prefixes
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
      // Find where we can insert it elegantly, e.g. under general "HALLAZGOS" block
      const findingsIdx = lines.findIndex(l => {
        const lw = l.toLowerCase();
        return lw.includes("hallazgos") || lw.includes("descripción") || lw.includes("exploración");
      });

      if (findingsIdx !== -1) {
        const label = translateStructureLabelInBrief(id);
        lines.splice(findingsIdx + 1, 0, `  - ${label}: ${newDescription}`);
        return lines.join("\n");
      } else {
        const label = translateStructureLabelInBrief(id);
        return reportText.trim() + `\n  - ${label}: ${newDescription}`;
      }
    }

    return newLines.join("\n");
  };

  // Default descriptive text based on state
  const getDefaultDescription = (id: string, state: string) => {
    if (!state || state === "no_descrito") return "Estructura no mencionada ni descrita detalladamente en el cuerpo del reporte clínico escrito.";
    if (state === "normal") return "Dentro de límites normales.";
    const standardStates = [
      "normal", "no_descrito", "tendinosis", "tendinitis", "bursitis_leve", "bursitis_severa", 
      "derrame_leve", "derrame_moderado", "desgarro_parcial", "desgarro_completo", "artrosis", 
      "hipertrofia", "pinzamiento"
    ];
    if (!standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }
    switch (id) {
      case "supraspinatus":
        if (state === "tendinosis") return "Tendón supraespinoso con engrosamiento difuso e hipoecogenicidad leve a moderada, sin solución de continuidad. Sugiere tendinosis reactiva.";
        if (state === "desgarro_parcial") return "Defecto focal anecoico de espesor parcial que compromete el plano articular/bursal del supraespinoso, con remanente de fibras tensas.";
        if (state === "desgarro_completo") return "Ruptura completa del tendón supraespinoso con retracción del cabo proximal de ~1.5 cm bajo el acromion. Signo del cartílago humeral expuesto (+)";
        return "Fibras del tendón supraespinoso con espesor, ecogenicidad y patrón fibrilar conservados de inserción anatómica.";
      
      case "infraspinatus":
        if (state === "tendinosis") return "Tendón infraespinoso discretamente engrosado e hipoecoico en su tercio distal, compatible con tendinosis.";
        if (state === "desgarro_parcial") return "Microruptura intra-sustancia parcial en la inserción del infraespinoso, manteniendo alineamiento general.";
        if (state === "desgarro_completo") return "Ruptura de espesor completo de la inserción distal del infraespinoso con retracción mínima de fibras.";
        return "Tendón infraespinoso íntegro, sin signos de ruptura, adelgazamiento ni colección peritendinosa.";

      case "subscapularis":
        if (state === "tendinosis") return "Inserción del subescapular en el troquín muestra pérdida del patrón fibrilar fino e hipoecogenicidad focales, compatible con tendinosis.";
        if (state === "desgarro_parcial") return "Ruptura de fibras superiores del subescapular con preservación de la banda inferior.";
        if (state === "desgarro_completo") return "Ruptura completa del tendón subescapular con compromiso completo en la inserción del troquín.";
        return "Tendón subescapular conserva grosor normal y patrón fibrilar homogéneo. Deslizamiento dinámico libre.";

      case "biceps":
        if (state === "tendinitis") return "Tendón del bíceps (porción larga) rodeado por moderada cantidad de líquido anecoico en la corredera bicipital, compatible con tenosinovitis.";
        if (state === "subluxacion") return "Subluxación medial del tendón bicipital fuera del canal intertubercular, cabalgando sobre el troquín con lesión asociada del ligamento transverso.";
        if (state === "desgarro_parcial") return "Fibrilación longitudinal y ruptura parcial intrínseca del bíceps.";
        return "Porción larga del bíceps se aloja adecuadamente en la corredera intertubercular, con vaina peritendinosa íntima y normal.";

      case "bursa":
        if (state === "bursitis_leve") return "Distensión líquida laminar discreta (<1.5 mm de espesor) de la bursa subacromiodeltoidea.";
        if (state === "bursitis_severa") return "Bursitis subacromiodeltoidea franca, con engrosamiento sinovial parietal e importante distensión líquida visible.";
        return "Bolsa subacromiodeltoidea fina, no distendida, libre de colecciones o de engrosamiento de paredes.";

      case "glenohumeral":
        if (state === "derrame_leve") return "Leve distensión líquida del receso posterior de la articulación glenohumeral, compatible con derrame laminar.";
        if (state === "derrame_moderado") return "Derrame articular glenohumeral cuantificable con acumulación líquida libre en recesos posterior y axilar.";
        return "Articulación glenohumeral íntegra, sin evidencia de distensión líquida, derrame o engrosamiento sinovial.";

      case "acromioclavicular":
        if (state === "artrosis") return "Irregularidad ósea cortical en extremos articulares con pinzamiento del espacio articular compatible con artrosis senil incipiente.";
        if (state === "hipertrofia") return "Hipertrofia de la articulación acromioclavicular con prominencia osteofitaria marginal que genera discreto efecto de masa sobre el vientre del supraespinoso.";
        return "Articulación acromioclavicular con contornos óseos regulares y espacio articular conservado.";

      case "dynamic_assessment":
        if (state === "normal") return "La valoración dinámica bajo pantalla ecográfica demuestra un adecuado deslizamiento del tendón supraespinoso por debajo del arco acromial, sin evidencias de pinzamiento.";
        if (state === "pinzamiento") return "La valoración dinámica ecográfica evidencia un resalto sutil y atrapamiento del manguito rotador superior contra el borde acromial anterior durante la maniobra dinámica, compatible con pinzamiento subacromial.";
        return "Estudio dinámico sin evidencias de pinzamiento.";

      default:
        return "Estructura conservada, sin hallazgos patológicos significativos.";
    }
  };

  // Perform intelligent scanning of the `generatedReport` by extracting exact sentences to avoid inventing data
  const handleScanReportText = async (showFeedBack: boolean = false) => {
    if (!generatedReport) {
      if (showFeedBack) {
        setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: No hay reporte clínico disponible para analizar.`]);
      }
      return;
    }
    
    setIsSyncing(true);
    const logs: string[] = [];
    logs.push(`Iniciando extracción inteligente de hallazgos en Hombro (${generatedReport.length} caracteres)...`);

    const structures = [
      {
        id: "supraspinatus",
        label: "Tendón Supraespinoso",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tendinitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "infraspinatus",
        label: "Tendón Infraespinoso",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tendinitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "subscapularis",
        label: "Tendón Subescapular",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tendinitis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "biceps",
        label: "Tendón Bíceps",
        allowedStates: ["no_descrito", "normal", "tendinosis", "tendinitis", "luxacion", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "bursa",
        label: "Bursa SAD",
        allowedStates: ["no_descrito", "normal", "bursitis_leve", "bursitis_severa"]
      },
      {
        id: "glenohumeral",
        label: "Articulación Glenohumeral",
        allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"]
      },
      {
        id: "acromioclavicular",
        label: "Articulación Acromioclavicular",
        allowedStates: ["no_descrito", "normal", "esguince", "artrosis", "hipertrofia"]
      },
      {
        id: "dynamic_assessment",
        label: "Valoración Dinámica",
        allowedStates: ["no_descrito", "normal", "pinzamiento"]
      }
    ];

    try {
      if (laterality === "Bilateral") {
        logs.push(`Estudio Bilateral detectado. Extrayendo hallazgos para Hombro Derecho...`);
        const resRight = await fetch("/api/analyze-anatomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel || "gemini-3.5-flash",
            reportText: generatedReport,
            studyType: "Hombro",
            structures: structures,
            side: "Derecho"
          })
        });
        const dataRight = await resRight.json();

        logs.push(`Extrayendo hallazgos para Hombro Izquierdo...`);
        const resLeft = await fetch("/api/analyze-anatomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel || "gemini-3.5-flash",
            reportText: generatedReport,
            studyType: "Hombro",
            structures: structures,
            side: "Izquierdo"
          })
        });
        const dataLeft = await resLeft.json();

        if (dataRight.success && dataRight.states && dataLeft.success && dataLeft.states) {
          const finalStatesRight = { ...states };
          const finalDescriptionsRight = { ...customDescriptions };
          const finalStatesLeft = { ...statesLeft };
          const finalDescriptionsLeft = { ...customDescriptionsLeft };

          structures.forEach(struc => {
            const stateR = dataRight.states[struc.id] || "no_descrito";
            const descR = dataRight.descriptions[struc.id] || "No mencionado / No descrito.";
            finalStatesRight[struc.id] = stateR;
            finalDescriptionsRight[struc.id] = descR;

            const stateL = dataLeft.states[struc.id] || "no_descrito";
            const descL = dataLeft.descriptions[struc.id] || "No mencionado / No descrito.";
            finalStatesLeft[struc.id] = stateL;
            finalDescriptionsLeft[struc.id] = descL;

            if (stateR !== "no_descrito") {
              logs.push(`[Derecho] ${struc.label}: ${stateR.toUpperCase()} \n  ↳ ${descR}`);
            }
            if (stateL !== "no_descrito") {
              logs.push(`[Izquierdo] ${struc.label}: ${stateL.toUpperCase()} \n  ↳ ${descL}`);
            }
          });

          setStates(finalStatesRight);
          setCustomDescriptions(finalDescriptionsRight);
          setStatesLeft(finalStatesLeft);
          setCustomDescriptionsLeft(finalDescriptionsLeft);
          setLastSyncedReport(generatedReport);
          logs.push(`Análisis bilateral finalizado con IA.`);
        } else {
          logs.push(`[Error API] No se pudo obtener el análisis estructurado bilateral.`);
        }
      } else {
        const response = await fetch("/api/analyze-anatomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel || "gemini-3.5-flash",
            reportText: generatedReport,
            studyType: "Hombro",
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
          logs.push(`Análisis unilateral finalizado con IA. Sincronizadas ${parsedCount} estructuras clínicas (${foundPathologies} patologías).`);
        } else {
          logs.push(`[Error API] No se pudo obtener el análisis estructurado. Espere un momento e intente nuevamente.`);
        }
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía:", err);
      logs.push(`[Error de red] ${err.message || String(err)}.`);
    } finally {
      setIsSyncing(false);
      setSyncLogs(prev => [...prev, ...logs]);
    }
  };

  // Synchronize incoming report changes quietly in real-time, maintaining bidirectionality and preventing infinite loops
  useEffect(() => {
    // Disabled auto-sync on mount/report changes to save tokens as requested.
    // Sync will only occur manually when requested by user.
  }, [generatedReport]);

  // Handle manual structure finding change from UI inputs
  const handleStateChange = (id: string, newState: string) => {
    const newDesc = getDefaultDescription(id, newState);
    
    // Automatically propagate the updated finding to the text report
    if (onChangeReport && generatedReport) {
      const nextReportText = updateReportTextWithStructure(id, generatedReport, newDesc);
      setLastSyncedReport(nextReportText);
      onChangeReport(nextReportText);
    }

    if (laterality === "Bilateral" && activeSide === "izquierdo") {
      setStatesLeft(prev => ({
        ...prev,
        [id]: newState
      }));
      setCustomDescriptionsLeft(prev => ({
        ...prev,
        [id]: ""
      }));
    } else {
      setStates(prev => ({
        ...prev,
        [id]: newState
      }));
      setCustomDescriptions(prev => ({
        ...prev,
        [id]: ""
      }));
    }
  };

  const handleCustomDescriptionChange = (id: string, text: string) => {
    // Automatically propagate custom finding text edits to the text report
    if (onChangeReport && generatedReport) {
      const nextReportText = updateReportTextWithStructure(id, generatedReport, text);
      setLastSyncedReport(nextReportText);
      onChangeReport(nextReportText);
    }

    if (laterality === "Bilateral" && activeSide === "izquierdo") {
      setCustomDescriptionsLeft(prev => ({
        ...prev,
        [id]: text
      }));
    } else {
      setCustomDescriptions(prev => ({
        ...prev,
        [id]: text
      }));
    }
  };

  // Clear all states
  const handleReset = () => {
    const initial = {
      supraspinatus: "no_descrito",
      infraspinatus: "no_descrito",
      subscapularis: "no_descrito",
      biceps: "no_descrito",
      bursa: "no_descrito",
      glenohumeral: "no_descrito",
      acromioclavicular: "no_descrito",
      dynamic_assessment: "no_descrito"
    };
    const initialDesc = {
      supraspinatus: "",
      infraspinatus: "",
      subscapularis: "",
      biceps: "",
      bursa: "",
      glenohumeral: "",
      acromioclavicular: "",
      dynamic_assessment: ""
    };
    setStates(initial);
    setCustomDescriptions(initialDesc);
    setStatesLeft(initial);
    setCustomDescriptionsLeft(initialDesc);
    setSyncLogs(["Valores iniciales restablecidos (No mencionado)"]);
  };

  // Get finalized text description for a structure
  const getOutputDescription = (id: string) => {
    const activeDescs = laterality === "Bilateral" && activeSide === "izquierdo" ? customDescriptionsLeft : customDescriptions;
    const activeSts = laterality === "Bilateral" && activeSide === "izquierdo" ? statesLeft : states;
    if (useOriginalReportText) {
      return activeDescs[id] || extractDescriptionFromReportText(id, generatedReport) || getDefaultDescription(id, activeSts[id]);
    }
    return activeDescs[id] || getDefaultDescription(id, activeSts[id]);
  };

  // Helper to ensure clean, capitalized and punctuated simplified findings
  const getSimplifiedDescription = (id: string, forcedState?: string): string => {
    const activeSts = laterality === "Bilateral" && activeSide === "izquierdo" ? statesLeft : states;
    const state = forcedState !== undefined ? forcedState : (activeSts[id] || "no_descrito");
    if (state === "no_descrito") {
      return "No mencionado / No descrito en el reporte.";
    }
    if (state === "normal") {
      return "Dentro de límites normales.";
    }

    const standardStates = [
      "normal", "no_descrito", "tendinosis", "tendinitis", "bursitis_leve", "derrame_leve", "artrosis",
      "desgarro_parcial", "subluxacion", "hipertrofia", "desgarro_completo", "bursitis_severa", "derrame_moderado"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }
    
    // If we have an alteration, let's build a clean, concise, high-yield summary similar to a report wrap-up / summary:
    switch (id) {
      case "supraspinatus":
        if (state === "tendinosis") {
          return "Tendinosis del supraespinoso (engrosamiento muscular difuso e hipoecogenicidad leve/moderada, sin desprendimiento ni solución de continuidad).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial de la inserción del supraespinoso (defecto focal anecoico que compromete plano articular/bursal, con remanente de fibras adheridas).";
        }
        if (state === "desgarro_completo") {
          return "Ruptura de espesor completo del tendón supraespinoso (defecto total transfixiante con retracción proximal del cabo de ~1.5 cm y cartílago humeral expuesto).";
        }
        break;
        
      case "infraspinatus":
        if (state === "tendinosis") {
          return "Tendinosis distal del infraespinoso (mínimo engrosamiento focal e hipoecogenicidad sin rotura).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura de espesor parcial / microruptura intra-sustancia focal en la inserción del infraespinoso.";
        }
        if (state === "desgarro_completo") {
          return "Ruptura de espesor completo del infraespinoso en inserción distal, con mínima retracción de fibras.";
        }
        break;
        
      case "subscapularis":
        if (state === "tendinosis") {
          return "Tendinosis en inserción del subescapular (pérdida de patrón fibrilar fino e hipoecogenicidad en troquín).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura parcial del subescapular (afecta fibras de la porción superior, con preservación de la banda inferior).";
        }
        if (state === "desgarro_completo") {
          return "Ruptura completa del tendón subescapular con extensión total del compromiso a la anchura de inserción.";
        }
        break;
        
      case "biceps":
        if (state === "tendinitis") {
          return "Tenosinovitis de la porción larga del bíceps (líquido libre anecoico moderado circundante en corredera intertubercular).";
        }
        if (state === "subluxacion") {
          return "Subluxación medial dinámica del bíceps (desplazamiento fuera del canal con lesión de ligamento transverso).";
        }
        if (state === "desgarro_parcial") {
          return "Ruptura parcial longitudinal con signos de fibrilación y defecto intrínseco de fibras.";
        }
        break;
        
      case "bursa":
        if (state === "bursitis_leve") {
          return "Bursitis subacromiodeltoidea (SAD) laminar leve (discreta banda de líquido <1.5 mm sin engrosamiento sinovial).";
        }
        if (state === "bursitis_severa") {
          return "Bursitis subacromiodeltoidea (SAD) franca/severa (marcada colección líquida distendida y engrosamiento parietal sinovial).";
        }
        break;
        
      case "glenohumeral":
        if (state === "derrame_leve") {
          return "Derrame articular glenohumeral laminar leve persistente.";
        }
        if (state === "derrame_moderado") {
          return "Derrame articular glenohumeral franco con acumulación líquida libre en recesos posteriores y axilar.";
        }
        break;
        
      case "acromioclavicular":
        if (state === "artrosis") {
          return "Cambios degenerativos / artrosis acromioclavicular discreta (irregularidades corticales y leve disminución del espacio).";
        }
        if (state === "hipertrofia") {
          return "Hipertrofia articular acromioclavicular con prominencia osteofitaria marginal (efecto de masa leve sobre vientre de supraespinoso).";
        }
        break;

      case "dynamic_assessment":
        if (state === "normal") {
          return "Valoración dinámica: Deslizamiento conservado, sin signos de pinzamiento.";
        }
        if (state === "pinzamiento") {
          return "Valoración dinámica: Positivo para pinzamiento subacromial.";
        }
        break;
    }

    // Fallback block if any other custom description exists, we capitalize and clean it
    const rawDesc = getOutputDescription(id);
    if (!rawDesc || rawDesc.trim() === "" || rawDesc === "Dentro de límites normales.") {
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

  // Compile full Findings Table (Simplified 2-Column format as requested)
  // Excludes any structures that are "no_descrito" (not mentioned in the report)
  const generateTableMarkdown = () => {
    let md = "| Estructura | Hallazgos |\n";
    md += "| :--- | :--- |\n";

    const rows = [
      { id: "supraspinatus", label: "Tendón Supraespinoso" },
      { id: "infraspinatus", label: "Tendón Infraespinoso" },
      { id: "subscapularis", label: "Tendón Subescapular" },
      { id: "biceps", label: "Bíceps (Porción Larga)" },
      { id: "bursa", label: "Bursa Subacromiodeltoidea" },
      { id: "glenohumeral", label: "Artic. Glenohumeral" },
      { id: "acromioclavicular", label: "Artic. Acromioclavicular" },
      { id: "dynamic_assessment", label: "Valoración Dinámica" }
    ];

    if (laterality === "Bilateral") {
      md += "| **LADO DERECHO** | |\n";
      let hasRowsRight = false;
      rows.forEach(row => {
        if (states[row.id] !== "no_descrito" && states[row.id] !== "normal") {
          const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id, states[row.id]);
          md += `| *${row.label} (Der)* | ${desc} |\n`;
          hasRowsRight = true;
        }
      });
      if (!hasRowsRight) {
        md += `| *Sin hallazgos patológicos (Der)* | *Todas las estructuras derechas se reportan de características normales.* |\n`;
      }

      md += "| **LADO IZQUIERDO** | |\n";
      let hasRowsLeft = false;
      rows.forEach(row => {
        if (statesLeft[row.id] !== "no_descrito" && statesLeft[row.id] !== "normal") {
          const desc = customDescriptionsLeft[row.id]?.trim() || getSimplifiedDescription(row.id, statesLeft[row.id]);
          md += `| *${row.label} (Izq)* | ${desc} |\n`;
          hasRowsLeft = true;
        }
      });
      if (!hasRowsLeft) {
        md += `| *Sin hallazgos patológicos (Izq)* | *Todas las estructuras izquierdas se reportan de características normales.* |\n`;
      }
    } else {
      let hasRows = false;
      rows.forEach(row => {
        if (states[row.id] !== "no_descrito" && states[row.id] !== "normal") {
          const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id, states[row.id]);
          md += `| **${row.label}** | ${desc} |\n`;
          hasRows = true;
        }
      });

      if (!hasRows) {
        md += `| *Sin hallazgos patológicos* | *Todas las estructuras se reportan de características normales.* |\n`;
      }
    }

    return md;
  };

  // Compile narrative paragraphs summary
  const generateNarrativeText = () => {
    let txt = "SÍNTESIS ANATOMOPATOLÓGICA DE HOMBRO:\n";
    const items = [
      { id: "supraspinatus", label: "TENDÓN SUPRAESPINOSO" },
      { id: "infraspinatus", label: "TENDÓN INFRAESPINOSO" },
      { id: "subscapularis", label: "TENDÓN SUBESCAPULAR" },
      { id: "biceps", label: "PORCIÓN LARGA DEL BÍCEPS" },
      { id: "bursa", label: "BURSA SUBACROMIODELTOIDEA" },
      { id: "glenohumeral", label: "RECESOS ARTICULARES" },
      { id: "acromioclavicular", label: "COMPLEJO ACROMIOCLAVICULAR" },
      { id: "dynamic_assessment", label: "VALORACIÓN DINÁMICA" }
    ];

    if (laterality === "Bilateral") {
      txt += "\n[HOMBRO DERECHO]:\n";
      let countR = 1;
      items.forEach(item => {
        if (states[item.id] !== "no_descrito") {
          const desc = customDescriptions[item.id]?.trim() || customDescriptions[item.id] || getDefaultDescription(item.id, states[item.id]);
          txt += `${countR}. ${item.label}: ${desc}\n`;
          countR++;
        }
      });

      txt += "\n[HOMBRO IZQUIERDO]:\n";
      let countL = 1;
      items.forEach(item => {
        if (statesLeft[item.id] !== "no_descrito") {
          const desc = customDescriptionsLeft[item.id]?.trim() || customDescriptionsLeft[item.id] || getDefaultDescription(item.id, statesLeft[item.id]);
          txt += `${countL}. ${item.label}: ${desc}\n`;
          countL++;
        }
      });
    } else {
      let count = 1;
      items.forEach(item => {
        if (states[item.id] !== "no_descrito") {
          const desc = customDescriptions[item.id]?.trim() || getOutputDescription(item.id);
          txt += `${count}. ${item.label}: ${desc}\n`;
          count++;
        }
      });
    }
    return txt;
  };

  const translateState = (id: string, s: string) => {
    if (s === "no_descrito") return "No especificado / No descrito";
    if (s === "normal") return "Sin lesiones patológicas";
    if (s === "tendinosis") return "Tendinosis/Tendinopatía";
    if (s === "desgarro_parcial") return "Ruptura Parcial";
    if (s === "desgarro_completo") return "Ruptura de Espesor Completo";
    if (s === "tendinitis") return "Tenosinovitis / Inflamación";
    if (s === "subluxacion") return "Subluxación Medial";
    if (s === "bursitis_leve") return "Bursitis Laminar Leve";
    if (s === "bursitis_severa") return "Bursitis Distendida Severa";
    if (s === "derrame_leve") return "Derrame Articular Leve";
    if (s === "derrame_moderado") return "Derrame Articular Franco";
    if (s === "artrosis") return "Cambios Degenerativos / Artrosis";
    if (s === "hipertrofia") return "Hipertrofia Articular Ósea";
    return s;
  };

  const getSeverityLabel = (s: string) => {
    if (s === "no_descrito") return "No especificado";
    if (s === "normal") return "Ausencia de hallazgos";
    if (s === "tendinosis" || s === "tendinitis" || s === "bursitis_leve" || s === "derrame_leve" || s === "artrosis") return "Leve / Moderado";
    if (s === "desgarro_parcial" || s === "subluxacion" || s === "hipertrofia") return "Significativo";
    if (s === "desgarro_completo" || s === "bursitis_severa" || s === "derrame_moderado") return "Severo / Clínicamente Crítico";
    return "-";
  };

  // Set colors dynamically for the SVG rendering
  const getColorForSVG = (id: string, sideStates?: Record<string, string>) => {
    const activeStates = sideStates || (laterality === "Bilateral" && activeSide === "izquierdo" ? statesLeft : states);
    const s = activeStates[id] || "no_descrito";
    if (s === "no_descrito") return { stroke: "#1e293b", fill: "transparent", opacity: 0.1, color: "text-slate-600 font-normal italic" };
    if (s === "normal") return { stroke: "#475569", fill: "#1e293b", opacity: 0.6, color: "text-slate-400" };
    
    // Tendinitis / Tendinosis -> Orange Yellow
    if (s === "tendinosis" || s === "tendinitis" || s === "bursitis_leve" || s === "derrame_leve" || s === "artrosis") {
      return { stroke: "#f59e0b", fill: "#451a03", opacity: 0.9, color: "text-amber-400" };
    }
    // Partial Tear / Subluxation -> Coral Red
    if (s === "desgarro_parcial" || s === "subluxacion" || s === "hipertrofia") {
      return { stroke: "#ec4899", fill: "#500730", opacity: 0.95, color: "text-pink-400" };
    }
    // Complete tear or severe fluid -> Bright Flashing Red / Magenta
    if (s === "desgarro_completo" || s === "bursitis_severa" || s === "derrame_moderado") {
      return { stroke: "#ef4444", fill: "#7f1d1d", opacity: 1, color: "text-rose-500 font-bold" };
    }
    // Fallback for custom findings -> Bright pathological styling
    return { stroke: "#ef4444", fill: "#7f1d1d", opacity: 1, color: "text-rose-500 font-bold" };
  };

  const activeStatesRef = laterality === "Bilateral" && activeSide === "izquierdo" ? statesLeft : states;
  const activeDescriptionsRef = laterality === "Bilateral" && activeSide === "izquierdo" ? customDescriptionsLeft : customDescriptions;

  const renderShoulderSvg = (side: "derecho" | "izquierdo") => {
    const sideStates = side === "izquierdo" ? statesLeft : states;
    const isIzqui = side === "izquierdo";
    const isLeftShoulder = (laterality === "Bilateral" && side === "izquierdo") || 
                           (laterality === "Izquierdo") || 
                           (laterality === "Izquierda") || 
                           (laterality === "izquierdo") || 
                           (laterality === "Left");
    const shouldMirror = !isLeftShoulder;

    const shoulderHotspots = [
      { id: "glenohumeral", x: 152, y: 165, name: "Receso Glenohumeral" },
      { id: "subscapularis", x: 149, y: 162, name: "Tendón Subescapular" },
      { id: "biceps", x: 187, y: 200, name: "Porción Larga del Bíceps" },
      { id: "supraspinatus", x: 185, y: 106, name: "Tendón Supraespinoso" },
      { id: "infraspinatus", x: 228, y: 142, name: "Tendón Infraespinoso" },
      { id: "bursa", x: 191, y: 86, name: "Bursa Subacromiodeltoidea" },
      { id: "acromioclavicular", x: 208, y: 54, name: "Articulación Acromioclavicular" }
    ];

    const getHotspotColor = (id: string, sideStates: Record<string, string>) => {
      const s = sideStates[id] || "no_descrito";
      if (s === "no_descrito") return "#475569"; // slate-600
      if (s === "normal") return "#10b981"; // emerald-500
      if (s === "tendinosis" || s === "tendinitis" || s === "bursitis_leve" || s === "derrame_leve" || s === "artrosis") {
        return "#f59e0b"; // amber-500
      }
      if (s === "desgarro_parcial" || s === "subluxacion" || s === "hipertrofia") {
        return "#ec4899"; // pink-500
      }
      return "#ef4444"; // red-500
    };

    return (
      <svg 
        id={isIzqui ? "shoulder-anatomy-svg-left" : "shoulder-anatomy-svg"}
        viewBox="0 0 350 350" 
        className="w-full max-w-[320px] h-auto drop-shadow-2xl"
        style={{ maxHeight: "310px" }}
      >
        <defs>
          <linearGradient id={`boneGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2e3d52" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id={`clavGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#3d4e66" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <pattern id={`stripePattern-${side}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="2.5" />
          </pattern>
        </defs>

        {/* Background structural guidelines - Grid/Circle */}
        <circle cx="175" cy="175" r="150" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
        <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />
        <line x1="20" y1="175" x2="330" y2="175" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

        {/* Graphic content wrapped with horizontal mirror mapping if right shoulder */}
        <g transform={shouldMirror ? "translate(350, 0) scale(-1, 1)" : undefined}>
          
          {/* BONES BLOCK */}
          {/* Scapula Body / Glenoid cavity */}
          <path 
            d="M 60,180 C 60,240 100,280 140,290 C 130,250 120,200 135,170 C 140,160 145,150 142,140 C 135,115 110,110 90,115 C 70,120 60,140 60,180 Z" 
            fill={`url(#boneGrad-${side})`} 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          <path 
            d="M 144,130 C 138,150 138,180 144,200 C 147,210 152,215 155,200 C 158,180 158,150 155,130 Z" 
            fill="#1e293b" 
            stroke="#475569" 
            strokeWidth="1" 
            strokeDasharray="2,2" 
          />

          {/* Coracoid Process */}
          <path 
            d="M 132,120 C 122,110 110,115 115,130 C 120,145 140,150 145,145 C 145,138 138,125 132,120 Z" 
            fill="#334155" 
            stroke="#64748b" 
            strokeWidth="1.5" 
          />

          {/* Humerus Bone */}
          <path 
            d="M 155,130 C 160,120 185,110 215,128 C 240,144 245,170 240,195 C 235,210 230,215 220,215 L 210,320 L 175,320 L 175,210 C 165,205 160,200 154,190 C 148,180 148,150 155,130 Z" 
            fill={`url(#boneGrad-${side})`} 
            stroke="#334155" 
            strokeWidth="2" 
          />

          {/* Clavicle */}
          <path 
            d="M 60,40 C 90,42 120,52 145,45 C 170,38 200,45 210,50 L 210,62 C 195,57 165,48 140,55 C 115,62 85,52 60,50 Z" 
            fill={`url(#clavGrad-${side})`} 
            stroke="#475569" 
            strokeWidth="1.5" 
          />

          {/* Acromion Process */}
          <path 
            d="M 210,50 C 235,52 260,65 260,85 C 260,105 240,115 225,115 L 218,102 C 230,102 242,98 242,88 C 242,75 225,65 210,62 Z" 
            fill="#334155" 
            stroke="#64748b" 
            strokeWidth="1.5" 
          />

          {/* ACTIVE PATHWAYS / TENDONS CONTROLLERS */}
          {/* 1. Glenohumeral Joint Recess */}
          <g 
            className="cursor-pointer transition-all duration-200 hover:opacity-90"
            onClick={() => { setSelectedStructure("glenohumeral"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("glenohumeral")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 146,134 C 158,140 162,175 158,198 C 152,198 148,170 146,134 Z" 
              fill={getColorForSVG("glenohumeral", sideStates).fill} 
              stroke={getColorForSVG("glenohumeral", sideStates).stroke} 
              strokeWidth={sideStates.glenohumeral !== "normal" ? "3.5" : "1.5"}
              fillOpacity={sideStates.glenohumeral !== "normal" ? "0.6" : "0.1"}
              strokeDasharray={sideStates.glenohumeral === "derrame_leve" ? "3,3" : "none"}
            />
            <line x1="152" y1="165" x2="110" y2="165" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
          </g>

          {/* 2. Subscapularis Tendon */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("subscapularis"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("subscapularis")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 125,160 C 135,150 165,150 178,162 C 182,165 178,175 168,175 C 150,175 135,170 120,170 Z" 
              fill={getColorForSVG("subscapularis", sideStates).fill} 
              stroke={getColorForSVG("subscapularis", sideStates).stroke} 
              strokeWidth={sideStates.subscapularis !== "normal" ? "4.5" : "2"}
              fillOpacity={getColorForSVG("subscapularis", sideStates).opacity}
              strokeDasharray={sideStates.subscapularis === "desgarro_parcial" ? "4,4" : "none"}
            />
            {sideStates.subscapularis === "desgarro_completo" && (
              <path d="M 148,152 L 148,172 M 153,153 L 151,171" stroke="#ef4444" strokeWidth="2.5" />
            )}
          </g>

          {/* 3. Biceps Tendon */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("biceps"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("biceps")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 183,124 C 182,145 186,170 188,195 L 193,285 L 187,285 L 181,195 C 178,170 175,145 178,124 Z" 
              fill={getColorForSVG("biceps", sideStates).fill} 
              stroke={getColorForSVG("biceps", sideStates).stroke}
              strokeWidth={sideStates.biceps !== "normal" ? "4" : "1.8"}
              fillOpacity={getColorForSVG("biceps", sideStates).opacity}
              strokeDasharray={sideStates.biceps === "desgarro_parcial" ? "3,3" : "none"}
            />
            {sideStates.biceps === "subluxacion" && (
              <path d="M 184,170 C 172,175 165,188 163,195" stroke="#f43f5e" strokeWidth="3" fill="none" strokeDasharray="2,2" />
            )}
          </g>

          {/* 4. Supraspinatus Tendon */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("supraspinatus"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("supraspinatus")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 148,95 C 160,94 185,92 214,104 C 224,108 226,118 220,123 C 205,116 180,111 154,111 C 145,111 142,102 148,95 Z" 
              fill={getColorForSVG("supraspinatus", sideStates).fill} 
              stroke={getColorForSVG("supraspinatus", sideStates).stroke} 
              strokeWidth={sideStates.supraspinatus !== "normal" ? "5" : "2"}
              fillOpacity={getColorForSVG("supraspinatus", sideStates).opacity}
              strokeDasharray={sideStates.supraspinatus === "desgarro_parcial" ? "4,4" : "none"}
            />
            {sideStates.supraspinatus === "desgarro_completo" && (
              <g>
                <rect x="180" y="93" width="12" height="28" fill="#ef4ef4" opacity="0.1" /> 
                <line x1="184" y1="92" x2="178" y2="120" stroke="#7f1d1d" strokeWidth="4" />
                <line x1="196" y1="94" x2="202" y2="122" stroke="#7f1d1d" strokeWidth="4" />
              </g>
            )}
          </g>

          {/* 5. Infraspinatus Tendon */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("infraspinatus"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("infraspinatus")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 218,124 C 228,124 238,135 240,150 C 242,160 234,166 226,155 C 220,148 215,138 218,124 Z" 
              fill={getColorForSVG("infraspinatus", sideStates).fill} 
              stroke={getColorForSVG("infraspinatus", sideStates).stroke} 
              strokeWidth={sideStates.infraspinatus !== "normal" ? "4" : "1.8"}
              fillOpacity={getColorForSVG("infraspinatus", sideStates).opacity}
            />
          </g>

          {/* 6. Subacromial-deltoid Bursa */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("bursa"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("bursa")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 155,83 C 170,80 195,80 228,93 C 242,100 244,114 238,122 C 235,114 234,103 222,98 C 196,87 172,87 156,89 Z" 
              fill={getColorForSVG("bursa", sideStates).fill} 
              stroke={getColorForSVG("bursa", sideStates).stroke} 
              strokeWidth={sideStates.bursa !== "normal" ? "4" : "1.2"}
              fillOpacity={sideStates.bursa !== "normal" ? "0.6" : "0.1"}
              strokeDasharray={sideStates.bursa === "bursitis_leve" ? "3,3" : "none"}
            />
            {sideStates.bursa !== "normal" && (
              <circle cx="212" cy="86" r="4.5" fill="#ef4ef4" />
            )}
          </g>

          {/* 7. Acromioclavicular Joint Complex */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => { setSelectedStructure("acromioclavicular"); setActiveSide(side); }}
            onMouseEnter={() => setActiveHover("acromioclavicular")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <rect 
              x="203" 
              y="46" 
              width="11" 
              height="16" 
              rx="3"
              fill={getColorForSVG("acromioclavicular", sideStates).fill} 
              stroke={getColorForSVG("acromioclavicular", sideStates).stroke} 
              strokeWidth={sideStates.acromioclavicular !== "normal" ? "3" : "1.5"}
              fillOpacity={getColorForSVG("acromioclavicular", sideStates).opacity}
            />
            {sideStates.acromioclavicular === "artrosis" && (
              <path d="M 201,48 L 205,45 M 216,56 L 212,60" stroke="#f59e0b" strokeWidth="1.5" />
            )}
          </g>

          {/* 🇨🇭 INTERACTIVE HOTSPOTS SYSTEM OVERLAY (Pulsing Glow Markers) */}
          {shoulderHotspots.map((hot) => {
            const hColor = getHotspotColor(hot.id, sideStates);
            const isSelected = selectedStructure === hot.id;
            return (
              <g
                key={hot.id}
                className="cursor-pointer group/hotspot"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStructure(hot.id);
                  setActiveSide(side);
                }}
                onMouseEnter={() => setActiveHover(hot.id)}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Outer animated glow pulse ring */}
                <circle cx={hot.x} cy={hot.y} r="5" fill="none" stroke={hColor} strokeWidth="1.8" opacity="0.8">
                  <animate attributeName="r" values="5;14" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* Additional Selection Guideline Outer Circle */}
                {isSelected && (
                  <circle cx={hot.x} cy={hot.y} r="9" fill="none" stroke="#6366f1" strokeWidth="1.2" strokeDasharray="2,2" />
                )}

                {/* Inner central solid button dot */}
                <circle
                  cx={hot.x}
                  cy={hot.y}
                  r={isSelected ? "5" : "3.5"}
                  fill={hColor}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="transition-all duration-200 group-hover/hotspot:stroke-indigo-300"
                />
              </g>
            );
          })}
        </g>

        {/* Text labels outside the mirrored group to avoid reversed text */}
        {shouldMirror ? (
          <g className="pointer-events-none">
            {/* Right Shoulder (Mirrored) */}
            <text x="256" y="145" fill="#64748b" fontSize="7" fontStyle="italic" textAnchor="middle">Apófisis coracoides</text>
            <text x="130" y="270" fill="#475569" fontSize="8" fontWeight="bold">Húmero</text>
            <text x="270" y="35" fill="#64748b" fontSize="7" textAnchor="end">Clavícula</text>
            <text x="100" y="58" fill="#64748b" fontSize="7" textAnchor="middle">Acromion</text>
          </g>
        ) : (
          <g className="pointer-events-none">
            {/* Left Shoulder (Unmirrored) */}
            <text x="94" y="145" fill="#64748b" fontSize="7" fontStyle="italic">Apófisis coracoides</text>
            <text x="180" y="270" fill="#475569" fontSize="8" fontWeight="bold">Húmero</text>
            <text x="80" y="35" fill="#64748b" fontSize="7">Clavícula</text>
            <text x="250" y="58" fill="#64748b" fontSize="7" textAnchor="middle">Acromion</text>
          </g>
        )}

        {/* FLOATING TEXT HOVER LABELS */}
        <g opacity={activeHover ? "1" : "0"} className="transition-opacity duration-150 pointer-events-none">
          <rect x="10" y="310" width="330" height="25" rx="5" fill="#020617" stroke="#334155" strokeWidth="0.8" />
          {activeHover && (
            <text x="175" y="326" fill="#f43f5e" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
              {activeHover === "supraspinatus" && `TENDÓN SUPRAESPINOSO • ${translateState("supraspinatus", sideStates.supraspinatus).toUpperCase()}`}
              {activeHover === "infraspinatus" && `TENDÓN INFRAESPINOSO • ${translateState("infraspinatus", sideStates.infraspinatus).toUpperCase()}`}
              {activeHover === "subscapularis" && `TENDÓN SUBESCAPULAR • ${translateState("subscapularis", sideStates.subscapularis).toUpperCase()}`}
              {activeHover === "biceps" && `PORCIÓN LARGA DEL BÍCEPS • ${translateState("biceps", sideStates.biceps).toUpperCase()}`}
              {activeHover === "bursa" && `BURSA SUBACROMIODELTOIDEA • ${translateState("bursa", sideStates.bursa).toUpperCase()}`}
              {activeHover === "glenohumeral" && `RECESO GLENOHUMERAL (DERRAME) • ${translateState("glenohumeral", sideStates.glenohumeral).toUpperCase()}`}
              {activeHover === "acromioclavicular" && `ARTICULACIÓN ACROMIOCLAVICULAR • ${translateState("acromioclavicular", sideStates.acromioclavicular).toUpperCase()}`}
            </text>
          )}
        </g>
      </svg>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-6 shadow-2xl font-sans" id="shoulder-viewer-root">
      
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-950/80 rounded-2xl border border-indigo-900/60 shadow">
            <Activity className="h-6 w-6 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono">
              Módulo de Visualización y Análisis Avanzado de Hombro
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Detección anatómica y edición del manguito rotador
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {setIncludeInReport && (
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 px-3 rounded-xl border border-slate-850 select-none mr-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase font-mono tracking-wider cursor-pointer" htmlFor="include-shoulder-toggle">
                Adjuntar a PDF
              </label>
              <input 
                type="checkbox"
                id="include-shoulder-toggle"
                checked={includeInReport}
                onChange={(e) => setIncludeInReport(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          )}
          {/* Sync status indicator */}
          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-indigo-900/40 font-mono transition-all cursor-pointer"
            title="Refrescar y re-analizar el reporte de texto escrito"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar Texto
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-slate-850 font-mono transition-all cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Sync Warning Card - Shows when report changes and user hasn't synced yet (provides full manual control "si así yo lo deseo") */}
      {generatedReport && generatedReport !== lastSyncedReport && (
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-300 uppercase tracking-wide font-mono">
                Reporte de Hombro Modificado Directamente o Nuevo
              </p>
              <p className="text-[10.5px] text-slate-400 mt-1">
                Se detectaron cambios en el informe clínico escrito. Para actualizar el modelo gráfico y la tabla de síntesis con tus hallazgos reales del reporte médico, presiona el botón de sincronización. (No se inventarán datos; se utilizará el texto de tu informe real).
              </p>
            </div>
          </div>
          <button
            onClick={() => handleScanReportText(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-450 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 font-mono font-bold"
          >
            <RefreshCw className="h-3 w-3 animate-spin" />
            Sincronizar Hallazgos Reales
          </button>
        </div>
      )}

      {/* Sync Status Feedback Board */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-850/60 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-emerald-450 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono block">
              Resultados del escaneo de reporte:
            </span>
            <div className="flex flex-col gap-1">
              {syncLogs.map((log, lIdx) => (
                <span key={lIdx} className="text-[10px] text-slate-350 leading-relaxed font-mono">
                  {log}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bilateral Side Selectors for editing/working on specific sides */}
      {laterality === "Bilateral" && (
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-850/80 max-w-md mx-auto shadow-inner">
          <button
            onClick={() => setActiveSide("derecho")}
            className={`flex-1 py-2.5 text-center rounded-xl font-mono text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              activeSide === "derecho"
                ? "bg-indigo-600 text-slate-100 shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/55"
            }`}
          >
            Hombro Derecho (R)
          </button>
          <button
            onClick={() => setActiveSide("izquierdo")}
            className={`flex-1 py-2.5 text-center rounded-xl font-mono text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              activeSide === "izquierdo"
                ? "bg-indigo-600 text-slate-100 shadow-lg font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/55"
            }`}
          >
            Hombro Izquierdo (L)
          </button>
        </div>
      )}

      {/* Main Interactive Workspace Area: Drawing vs Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Col: The Anatomical SVG Drawing Canvas */}
        <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 flex flex-col items-center justify-between space-y-4 relative overflow-hidden group">
          
          <div className="absolute top-3 left-3 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[8px] font-black text-indigo-400 uppercase tracking-widest font-mono">
            VISTA ANTEROLATERAL DEL HOMBRO
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-2 py-0.5 rounded border border-slate-800 text-[8px] font-bold text-slate-500 uppercase font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Dinámico
          </div>

          {/* Interactive Workspace: Side-by-side SVG and Findings Map */}
          <div className="w-full flex flex-col md:flex-row items-center gap-4 py-2 mt-7">
            {/* Left Portion: Diagram */}
            <div className="w-full md:w-[48%] flex justify-center items-center">
              {laterality === "Bilateral" ? (
                <>
                  <div className={activeSide === "derecho" ? "w-full flex justify-center" : "hidden"}>
                    {renderShoulderSvg("derecho")}
                  </div>
                  <div className={activeSide === "izquierdo" ? "w-full flex justify-center" : "hidden"}>
                    {renderShoulderSvg("izquierdo")}
                  </div>
                </>
              ) : (
                renderShoulderSvg("derecho")
              )}
            </div>

            {/* Right Portion: Mapa de Hallazgos Sidebar / Dashboard */}
            <div className="w-full md:w-[52%] flex flex-col gap-2 bg-slate-900/40 border border-slate-850/60 p-3 rounded-xl self-stretch justify-center">
              <div className="flex items-center gap-1.5 border-b border-slate-850/50 pb-2 mb-1">
                <span className="text-[9.5px] font-black text-indigo-400 font-mono uppercase tracking-widest block">
                  📍 Mapa de Hallazgos Clínicos
                </span>
              </div>
              
              <div className="space-y-1 max-h-[290px] overflow-y-auto scrollbar-thin scrollbar-indigo pr-1">
                {[
                  { id: "supraspinatus", label: "Supraespinoso" },
                  { id: "infraspinatus", label: "Infraespinoso" },
                  { id: "subscapularis", label: "Subescapular" },
                  { id: "biceps", label: "PL Bíceps" },
                  { id: "bursa", label: "Bursa SAD" },
                  { id: "glenohumeral", label: "Derrame GH" },
                  { id: "acromioclavicular", label: "A. Acromioclav." },
                  { id: "dynamic_assessment", label: "Val. Dinámica" }
                ].filter(struct => activeStatesRef[struct.id] !== "no_descrito").map((struct) => {
                  const s = activeStatesRef[struct.id];
                  let dotColor = "bg-slate-500";
                  let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                  
                  if (s === "normal") {
                    dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                    badgeBg = "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
                  } else if (s === "tendinosis" || s === "tendinitis" || s === "bursitis_leve" || s === "derrame_leve" || s === "artrosis") {
                    dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                    badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                  } else if (s === "desgarro_parcial" || s === "subluxacion" || s === "hipertrofia" || s === "pinzamiento") {
                    dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                    badgeBg = "bg-pink-950/40 text-pink-400 border-pink-900/30";
                  } else if (s === "desgarro_completo" || s === "bursitis_severa" || s === "derrame_moderado") {
                    dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                    badgeBg = "bg-rose-950/40 text-rose-400 border-rose-900/30";
                  } else {
                    // Fallback for custom findings
                    dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                    badgeBg = "bg-rose-950/40 text-rose-400 border-rose-900/30";
                  }
                  
                  const isSelected = selectedStructure === struct.id;
                  const shortFinding = getSimplifiedDescription(struct.id);

                  return (
                    <div 
                      key={struct.id}
                      onClick={() => setSelectedStructure(struct.id)}
                      onMouseEnter={() => setActiveHover(struct.id)}
                      onMouseLeave={() => setActiveHover(null)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 relative overflow-hidden group ${
                        isSelected 
                          ? "bg-slate-900 border-indigo-500 shadow-md scale-[1.01]" 
                          : "bg-slate-950/60 border-slate-850/40 hover:bg-slate-950/80 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-none select-none">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`}></span>
                          <span className={`text-[10px] font-black uppercase tracking-wide truncate ${isSelected ? "text-indigo-400 font-bold" : "text-slate-200"}`}>
                            {struct.label}
                          </span>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                          {translateState(struct.id, s)
                            .replace("No especificado / No descrito", "N/D")
                            .replace("Sin lesiones patológicas", "Normal")
                            .replace("Tendinosis/Tendinopatía", "Tendinosis")
                            .replace("Ruptura de Espesor Completo", "Rup. Compl.")
                            .replace("Ruptura Parcial", "Rup. Parc.")
                            .replace("Tenosinovitis / Inflamación", "Inflamación")
                            .replace("Bursitis Laminar Leve", "Bursitis L.")
                            .replace("Bursitis Distendida Severa", "Bursitis Sev.")
                            .replace("Derrame Articular Leve", "Derrame L.")
                            .replace("Derrame Articular Franco", "Derrame S.")
                            .replace("Cambios Degenerativos / Artrosis", "Artrosis")
                            .replace("Hipertrofia Articular Ósea", "Hipertrofia")
                            .replace("Positivo para pinzamiento subacromial", "Pinzamiento")
                          }
                        </span>
                      </div>
                      
                      <p className="text-[9px] leading-relaxed text-slate-400 truncate">
                        {s === "no_descrito" ? "No descrito" : shortFinding}
                      </p>
                    </div>
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
                      <div className="flex items-center justify-between gap-1 leading-none select-none">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`}></span>
                          <span className="text-[10px] font-black uppercase tracking-wide truncate text-slate-200">
                            {item.structureName}
                          </span>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                          {s}
                        </span>
                      </div>
                      
                      <p className="text-[9px] leading-relaxed text-slate-400 truncate">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick interactive instructions footer */}
          <div className="w-full bg-slate-900/60 border border-slate-850 p-2 rounded-xl text-center">
            <span className="text-[9px] font-black text-rose-450 uppercase tracking-wider font-mono">
              💡 Interactividad total: Haz clic en el dibujo o en la lista de hallazgos para enfocar y editar cada estructura clínica
            </span>
          </div>

        </div>

        {/* Right Col: Interactive Finding Controllers */}
        <div className="space-y-4 flex flex-col justify-between">
          
          <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="text-[10px] font-black text-indigo-400 font-mono uppercase tracking-widest">
                Modificador del Estado Clínico y Anatomía:
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                Estructura seleccionada
              </span>
            </div>

            {/* Custom/Original Text Toggle (Anti-invented data) */}
            <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-850">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-[9.5px] font-black text-slate-300 uppercase tracking-wider font-mono">
                  Origen de datos de la Tabla:
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850/60">
                <button
                  onClick={() => setUseOriginalReportText(true)}
                  className={`px-2.5 py-1 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    useOriginalReportText
                      ? "bg-indigo-950/80 text-indigo-405 text-indigo-405 border border-indigo-900/40"
                      : "text-slate-500 hover:text-slate-450"
                  }`}
                  title="Utiliza exactamente el fragmento o frase escrita en tu reporte, evitando textos genéricos o inventados"
                >
                  Texto del Reporte 📄
                </button>
                <button
                  onClick={() => setUseOriginalReportText(false)}
                  className={`px-2.5 py-1 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    !useOriginalReportText
                      ? "bg-slate-900 text-slate-350 border border-slate-800"
                      : "text-slate-500 hover:text-slate-450"
                  }`}
                  title="Utiliza plantillas detalladas clínicas preprogramadas para cada grado de lesión"
                >
                  Plantilla Fija 📋
                </button>
              </div>
            </div>

            {/* Structure selector pills */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "supraspinatus", label: "Supraespinoso" },
                { id: "infraspinatus", label: "Infraespinoso" },
                { id: "subscapularis", label: "Subescapular" },
                { id: "biceps", label: "PL Bíceps" },
                { id: "bursa", label: "Bursa SAD" },
                { id: "glenohumeral", label: "A. Glenohumeral" },
                { id: "acromioclavicular", label: "A. Acromioclav." },
                { id: "dynamic_assessment", label: "Val. Dinámica" }
              ].filter(struct => activeStatesRef[struct.id] !== "no_descrito").map((struct) => {
                const s = activeStatesRef[struct.id];
                let indicatorColor = "bg-slate-800 border border-slate-700";
                if (s === "normal") indicatorColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
                else if (s === "tendinosis" || s === "tendinitis" || s === "bursitis_leve" || s === "derrame_leve" || s === "artrosis") indicatorColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
                else if (s === "desgarro_parcial" || s === "subluxacion" || s === "hipertrofia" || s === "pinzamiento") indicatorColor = "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.3)]";
                else if (s === "desgarro_completo" || s === "bursitis_severa" || s === "derrame_moderado") indicatorColor = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]";

                return (
                  <button
                    key={struct.id}
                    onClick={() => setSelectedStructure(struct.id)}
                    className={`px-2.5 py-1.5 text-[9px] font-black rounded-lg transition-all cursor-pointer font-mono uppercase tracking-wider border flex items-center gap-1.5 ${
                      selectedStructure === struct.id
                        ? "bg-indigo-950/60 text-indigo-400 border-indigo-900 shadow-md ring-1 ring-indigo-500/20"
                        : "bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${indicatorColor}`}></span>
                    {struct.label}
                  </button>
                );
              })}
            </div>

            {/* Settings block for the currently selected structure */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 space-y-3">
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-100 uppercase tracking-wide">
                  {translateStructureLabel(selectedStructure)}
                </span>
                <span className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                  Estado: {translateState(selectedStructure, activeStatesRef[selectedStructure]).toUpperCase()}
                </span>
              </div>

              {/* Custom State Input */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">
                  Diagnóstico / Hallazgo Clínico (Sinopsis):
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={
                      activeStatesRef[selectedStructure] === "no_descrito" 
                        ? "" 
                        : activeStatesRef[selectedStructure] === "normal" 
                          ? "Normal" 
                          : activeStatesRef[selectedStructure]
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
                    placeholder="Escriba el diagnóstico (ej: Tendinosis leve, Bursitis moderada, etc.)"
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStateChange(selectedStructure, "normal")}
                      className={`flex-1 py-1 px-2 text-[8.5px] font-black uppercase text-center rounded border transition-all cursor-pointer ${
                        activeStatesRef[selectedStructure] === "normal"
                          ? "bg-emerald-650 border-emerald-500 text-white shadow"
                          : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-850"
                      }`}
                    >
                      ✓ Cons. Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                      className={`flex-1 py-1 px-2 text-[8.5px] font-black uppercase text-center rounded border transition-all cursor-pointer ${
                        activeStatesRef[selectedStructure] === "no_descrito"
                          ? "bg-slate-800 border-slate-700 text-slate-300 shadow"
                          : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-850"
                      }`}
                    >
                      ⚪ No Descrito
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom description input */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Descripción Detallada en el Reporte:
                </label>
                <textarea
                  value={getOutputDescription(selectedStructure)}
                  onChange={(e) => handleCustomDescriptionChange(selectedStructure, e.target.value)}
                  className="w-full h-16 bg-slate-950 border border-slate-850 rounded-lg p-2 text-[11px] text-slate-300 leading-relaxed font-sans focus:outline-none focus:border-indigo-500/50 resize-full"
                  placeholder="Detalla los hallazgos ecográficos detectados..."
                />
              </div>

            </div>

          </div>

          {/* Table display & action buttons to export to report */}
          <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 font-mono uppercase tracking-widest">
                  SINOPSIS ACADÉMICA LISTA PARA EL REPORTE
                </span>
              </div>
              <span className="text-[8px] font-black uppercase bg-indigo-950 text-indigo-400 px-2.5 py-0.5 rounded-full">
                Sincronizado
              </span>
            </div>

            {/* Quick overview grid of aligned anatomical cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.entries(activeStatesRef).filter(([_, sVal]) => sVal !== "no_descrito" && sVal !== "normal").map(([id, sVal]) => {
                const s = sVal as string;
                const label = translateStructureLabelInBrief(id);
                const simplified = getOutputDescription(id);
                const isSelected = selectedStructure === id;
                
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-455 border-emerald-900/30";
                } else if (s === "tendinosis" || s === "tendinitis" || s.includes("leve") || s.includes("bursitis_l") || s.includes("derrame_l") || s.includes("artrosis") || s.includes("hipertrofia")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s.includes("desgarro_completo") || s.includes("bursitis_severa") || s.includes("moderado") || s.includes("pinzamiento")) {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
                } else {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-450 border-pink-900/30";
                }

                return (
                  <button 
                    type="button"
                    key={id} 
                    onClick={() => setSelectedStructure(id)}
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
                          {label}
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
                    className="p-2.5 rounded-xl border border-slate-850/60 bg-slate-950/60 text-left transition-all hover:bg-slate-950/80 hover:border-slate-800 flex flex-col gap-1 relative overflow-hidden group cursor-default"
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

            {/* Export trigger actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onExportTable(generateTableMarkdown())}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer border border-indigo-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe actual"
              >
                <Download className="h-3 w-3" />
                Exportar Tabla
              </button>

              <button
                onClick={() => onExportNarrative && onExportNarrative(generateNarrativeText())}
                className="py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-950 transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer"
                title="Inyecta un resumen narrativo de hallazgos punto por punto al final del informe"
              >
                📥 Exportar Viñetas
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* --- EXCLUSIVE SUPRASPINATUS TEAR MODELING DASHBOARD & DUAL VECTOR DRAWINGS --- */}
      {(() => {
        const rightReport = getSideSpecificReport(generatedReport, "derecho");
        const leftReport = getSideSpecificReport(generatedReport, "izquierdo");
        const parsedRight = parseSupraspinatusRuptureFromText(rightReport || generatedReport, states.supraspinatus, "derecho", generatedReport);
        const parsedLeft = parseSupraspinatusRuptureFromText(leftReport || generatedReport, statesLeft.supraspinatus, "izquierdo", generatedReport);

        const detailsRight = supraspinatusRuptureTypeRight === "manual" ? manualRuptureDetailsRight : parsedRight;
        const detailsLeft = supraspinatusRuptureTypeLeft === "manual" ? manualRuptureDetailsLeft : parsedLeft;

        // If in bilateral mode, edit side is whichever of the two is selected in activeSide (or switcher).
        // Otherwise, edit side matches supraspinatusSideView.
        const activeSupraspinatusEditSide = supraspinatusSideView === "bilateral" ? activeSide : supraspinatusSideView;

        const activeRuptureDetails = activeSupraspinatusEditSide === "derecho" ? detailsRight : detailsLeft;

        const translateSide = (s: string) => s === "derecho" ? "HOMBRO DERECHO" : "HOMBRO IZQUIERDO";

        const syncDetailedTearToReport = (side: "derecho" | "izquierdo", details: SupraspinatusRuptureDetails) => {
          let sentence = "";
          if (details.type === "none") {
            sentence = "Tendó;n supraespinoso intacto, de espesor y ecogenicidad conservados.";
          } else if (details.type === "partial") {
            const locText = details.location === "anterior" 
              ? "en su cara anterior" 
              : details.location === "posterior" 
                ? "en su cara posterior" 
                : "en su región media";
            sentence = `Tendón supraespinoso con desgarro de espesor parcial que compromete el ${details.thicknessPercent}% de su grosor en la superficie ${details.surface}, ${locText}, localizado a ${details.distanceFromInsertion} mm de su inserción.`;
          } else if (details.type === "full_partial_width") {
            const locTextAbbr = details.location === "anterior" 
              ? "anteriores" 
              : details.location === "posterior" 
                ? "posteriores" 
                : "medias";
            sentence = `Tendón supraespinoso con desgarro de grosor completo y anchura parcial que compromete las fibras ${locTextAbbr} midiendo ${details.ruptureAPSize} mm en el plano AP (diámetro AP total del tendón: ${details.tendonAPSize} mm) con un gap/brecha entre cabos de ${details.gap} mm.`;
          } else if (details.type === "naked_head") {
            sentence = `Desgarro masivo del supraespinoso con retracción del cabo proximal de ${details.retractionDistance} mm, quedando la cabeza humeral desnuda (porción expuesta del footprint cortical).`;
          }

          if (side === "derecho") {
            setStates(prev => ({ 
              ...prev, 
              supraspinatus: details.type === "none" ? "normal" : details.type === "partial" ? "desgarro_parcial" : "desgarro_completo" 
            }));
            setCustomDescriptions(prev => ({ ...prev, supraspinatus: sentence }));
          } else {
            setStatesLeft(prev => ({ 
              ...prev, 
              supraspinatus: details.type === "none" ? "normal" : details.type === "partial" ? "desgarro_parcial" : "desgarro_completo" 
            }));
            setCustomDescriptionsLeft(prev => ({ ...prev, supraspinatus: sentence }));
          }
        };

        return (
          <div className="mt-6 bg-slate-950 rounded-2xl border border-slate-850 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
              <div className="space-y-1 flex-1">
                <h3 className="text-xs font-black text-slate-105 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                  🔬 REPRESENTACIÓN EN ALTO DETALLE DE RUPTURAS DE SUPRAESPINOSO: AP & LAT
                </h3>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl font-sans">
                    Visualización interactiva y parametrizada del tendón supraespinoso. Representa con precisión desgarros parciales (articular / bursal), de grosor completo / espesor total y anchura parcial con gap de fibras, o retracción masiva con cabeza humeral desnuda.
                  </p>

                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 px-2.5 py-1 rounded-lg shrink-0 hover:bg-slate-800 select-none">
                    <span className="text-[9px] font-black text-slate-450 uppercase font-mono tracking-wider">Lado del Dibujo:</span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setSupraspinatusSideView("derecho")}
                        className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer font-mono ${
                          supraspinatusSideView === "derecho"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-900/40"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        Derecho (R)
                      </button>
                      <button
                        onClick={() => setSupraspinatusSideView("izquierdo")}
                        className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer font-mono ${
                          supraspinatusSideView === "izquierdo"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-900/40"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        Izquierdo (L)
                      </button>
                      <button
                        onClick={() => setSupraspinatusSideView("bilateral")}
                        className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer font-mono ${
                          supraspinatusSideView === "bilateral"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-900/40"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        Bilateral (R+L)
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[9.5px] font-black text-rose-400 uppercase font-mono tracking-wider bg-slate-900 border border-slate-850 px-2.5 py-1 rounded-lg shrink-0 hover:bg-slate-800 select-none" title="Si está activo, las vistas AP y LAT de este desgarro se inyectarán de manera automática como anexo micro-anatómico en el reporte PDF">
                    <input
                      type="checkbox"
                      checked={includeSupraspinatusInPdf}
                      onChange={(e) => setIncludeSupraspinatusInPdf(e.target.checked)}
                      className="accent-rose-500 rounded text-rose-500 cursor-pointer h-3.5 w-3.5"
                    />
                    Incluir Dibujos en PDF 📄
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-bold text-slate-550 uppercase font-mono tracking-wider">MODO DE PRECISIÓN:</span>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => {
                      if (activeSupraspinatusEditSide === "derecho") setSupraspinatusRuptureTypeRight("auto");
                      else setSupraspinatusRuptureTypeLeft("auto");
                    }}
                    className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer font-mono ${
                      (activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) === "auto"
                        ? "bg-rose-950/80 text-rose-400 border border-rose-900/40"
                        : "text-slate-550 hover:text-slate-400"
                    }`}
                    title="Extrae e interpreta automáticamente las dimensiones del desgarro directamente del reporte de impresión diagnóstico"
                  >
                    Auto 🤖
                  </button>
                  <button
                    onClick={() => {
                      if (activeSupraspinatusEditSide === "derecho") {
                        setSupraspinatusRuptureTypeRight("manual");
                        setManualRuptureDetailsRight(parsedRight);
                      } else {
                        setSupraspinatusRuptureTypeLeft("manual");
                        setManualRuptureDetailsLeft(parsedLeft);
                      }
                    }}
                    className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer font-mono ${
                      (activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) === "manual"
                        ? "bg-indigo-950/80 text-indigo-400 border border-indigo-900/40"
                        : "text-slate-550 hover:text-indigo-400"
                    }`}
                    title="Habilita los controles reguladores para simular manualmente la geometría lineal del desgarro"
                  >
                    Ajuste Manual 🎚️
                  </button>
                </div>
              </div>
            </div>

            {/* Grid display layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              
              {/* Left Column: Visualizers */}
              <div className={`${supraspinatusSideView === "bilateral" ? "lg:col-span-12" : "lg:col-span-6"} flex flex-col justify-center gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-900`}>
                {supraspinatusSideView !== "bilateral" ? (
                  <div className="flex items-center justify-center gap-4 flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-[200px]">
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest font-mono">CORONAL (VISTA AP)</span>
                      {renderSupraspinatusAP(activeRuptureDetails, false, activeSupraspinatusEditSide)}
                    </div>
                    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-[200px]">
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest font-mono">SAGITAL (VISTA LAT)</span>
                      {renderSupraspinatusLAT(activeRuptureDetails, false, activeSupraspinatusEditSide)}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                    {/* Hombro Derecho Box */}
                    <div className={`flex flex-col items-center gap-2 bg-slate-950/30 p-3 rounded-lg border ${activeSupraspinatusEditSide === "derecho" ? "border-rose-900/40 ring-1 ring-rose-500/15" : "border-slate-850/60"}`}>
                      <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest font-mono border-b border-rose-950/40 pb-1 w-full text-center">HOMBRO DERECHO (R)</span>
                      <div className="flex items-center justify-center gap-2 w-full mt-1">
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider font-mono font-bold">Vista AP</span>
                          {renderSupraspinatusAP(detailsRight, false, "derecho")}
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider font-mono font-bold">Vista LAT</span>
                          {renderSupraspinatusLAT(detailsRight, false, "derecho")}
                        </div>
                      </div>
                    </div>

                    {/* Hombro Izquierdo Box */}
                    <div className={`flex flex-col items-center gap-2 bg-slate-950/30 p-3 rounded-lg border ${activeSupraspinatusEditSide === "izquierdo" ? "border-rose-900/40 ring-1 ring-rose-500/15" : "border-slate-850/60"}`}>
                      <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest font-mono border-b border-rose-950/40 pb-1 w-full text-center">HOMBRO IZQUIERDO (L)</span>
                      <div className="flex items-center justify-center gap-2 w-full mt-1">
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider font-mono font-bold">Vista AP</span>
                          {renderSupraspinatusAP(detailsLeft, false, "izquierdo")}
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider font-mono font-bold">Vista LAT</span>
                          {renderSupraspinatusLAT(detailsLeft, false, "izquierdo")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Custom Controllers / Read-only synopsis */}
              <div className={`${supraspinatusSideView === "bilateral" ? "lg:col-span-12" : "lg:col-span-6"} bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex flex-col justify-between gap-3`}>
                <div className="space-y-3.5">
                  {/* Bilateral active edit side selector */}
                  {supraspinatusSideView === "bilateral" && (
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850/60 justify-center items-center gap-1 max-w-sm mx-auto">
                      <span className="text-[9px] font-black text-slate-450 uppercase font-mono tracking-wider pl-2 pr-1.5 whitespace-nowrap">Ajustando lado:</span>
                      <button
                        onClick={() => setActiveSide("derecho")}
                        className={`flex-1 text-center py-1 rounded-lg text-[9px] font-black font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          activeSide === "derecho"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-900/40 font-bold"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        Derecho (R)
                      </button>
                      <button
                        onClick={() => setActiveSide("izquierdo")}
                        className={`flex-1 text-center py-1 rounded-lg text-[9px] font-black font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          activeSide === "izquierdo"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-900/40 font-bold"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        Izquierdo (L)
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider font-mono">
                      COEFICIENTES GEOMÉTRICOS ({translateSide(activeSupraspinatusEditSide)})
                    </span>
                    <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {activeRuptureDetails.type === "none" ? "SANO / INTACTO" : activeRuptureDetails.type.toUpperCase().replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Tear type */}
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Tipo de Rotura:</label>
                      <select
                        value={activeRuptureDetails.type}
                        disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          const next = { ...activeRuptureDetails, type: val };
                          if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                          else setManualRuptureDetailsLeft(next);
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[9.5px] font-bold text-slate-300 uppercase tracking-wide font-sans focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                      >
                        <option value="none">Sano / Sin desgarro</option>
                        <option value="partial">Grosor / Espesor Parcial</option>
                        <option value="full_partial_width">Espesor Completo y Ancho Parcial</option>
                        <option value="naked_head">Desgarro y Ancho Completo (Cabeza Desnuda)</option>
                      </select>
                    </div>

                    {/* Surface (for partial) */}
                    {activeRuptureDetails.type === "partial" && (
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Superficie Rompida:</label>
                        <div className="flex gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                          <button
                            onClick={() => {
                              if ((activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual") return;
                              const next = { ...activeRuptureDetails, surface: "articular" as const };
                              if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                              else setManualRuptureDetailsLeft(next);
                            }}
                            disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                            className={`flex-1 text-center py-1 text-[8.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                              activeRuptureDetails.surface === "articular"
                                ? "bg-slate-850 text-slate-200 border border-slate-750"
                                : "text-slate-550 hover:text-slate-400"
                            }`}
                          >
                            Articular
                          </button>
                          <button
                            onClick={() => {
                              if ((activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual") return;
                              const next = { ...activeRuptureDetails, surface: "bursal" as const };
                              if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                              else setManualRuptureDetailsLeft(next);
                            }}
                            disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                            className={`flex-1 text-center py-1 text-[8.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                              activeRuptureDetails.surface === "bursal"
                                ? "bg-slate-850 text-slate-200 border border-slate-750"
                                : "text-slate-550 hover:text-slate-400"
                            }`}
                          >
                            Bursal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Thickness percent (partial) */}
                    {activeRuptureDetails.type === "partial" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Porcentaje de Grosor:</label>
                          <span className="text-[9px] font-bold font-mono text-rose-450">{activeRuptureDetails.thicknessPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="95"
                          step="5"
                          value={activeRuptureDetails.thicknessPercent}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const next = { ...activeRuptureDetails, thicknessPercent: val };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                    {/* Distance from insertion */}
                    {activeRuptureDetails.type !== "none" && activeRuptureDetails.type !== "naked_head" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Dist. desde Inserción:</label>
                          <span className="text-[9px] font-bold font-mono text-indigo-400">{activeRuptureDetails.distanceFromInsertion} mm</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="1"
                          value={activeRuptureDetails.distanceFromInsertion}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const next = { ...activeRuptureDetails, distanceFromInsertion: val };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                    {/* Slide gap (full_partial_width) */}
                    {activeRuptureDetails.type === "full_partial_width" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Brecha/Gap de Fibras:</label>
                          <span className="text-[9px] font-bold font-mono text-rose-455">{activeRuptureDetails.gap} mm</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="20"
                          step="1"
                          value={activeRuptureDetails.gap}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const next = { ...activeRuptureDetails, gap: val, retractionDistance: val };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                    {/* AP tendon size (full_partial_width) */}
                    {activeRuptureDetails.type === "full_partial_width" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Medida AP Tendón:</label>
                          <span className="text-[9px] font-bold font-mono text-indigo-400">{activeRuptureDetails.tendonAPSize} mm</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="45"
                          step="1"
                          value={activeRuptureDetails.tendonAPSize}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const rSize = Math.min(val, activeRuptureDetails.ruptureAPSize);
                            const next = { ...activeRuptureDetails, tendonAPSize: val, ruptureAPSize: rSize };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                    {/* AP rupture size (full_partial_width) */}
                    {activeRuptureDetails.type === "full_partial_width" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Medida AP Rotura:</label>
                          <span className="text-[9px] font-bold font-mono text-indigo-400">{activeRuptureDetails.ruptureAPSize} mm</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max={activeRuptureDetails.tendonAPSize}
                          step="1"
                          value={activeRuptureDetails.ruptureAPSize}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const next = { ...activeRuptureDetails, ruptureAPSize: val };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                    {/* Fiber location (full_partial_width or partial) */}
                    {(activeRuptureDetails.type === "full_partial_width" || activeRuptureDetails.type === "partial") && (
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Ubicación de la ruptura (Plano AP):</label>
                        <div className="flex gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                          <button
                            onClick={() => {
                              if ((activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual") return;
                              const next = { ...activeRuptureDetails, location: "anterior" as const };
                              if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                              else setManualRuptureDetailsLeft(next);
                            }}
                            disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                            className={`flex-1 text-center py-1 text-[8.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                              activeRuptureDetails.location === "anterior"
                                ? "bg-slate-850 text-slate-205 border border-slate-750 font-black text-rose-450"
                                : "text-slate-550 hover:text-slate-400"
                            }`}
                          >
                            Cara Anterior
                          </button>
                          <button
                            onClick={() => {
                              if ((activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual") return;
                              const next = { ...activeRuptureDetails, location: "media" as const };
                              if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                              else setManualRuptureDetailsLeft(next);
                            }}
                            disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                            className={`flex-1 text-center py-1 text-[8.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                              activeRuptureDetails.location === "media"
                                ? "bg-slate-850 text-slate-205 border border-slate-750 font-black text-rose-450"
                                : "text-slate-550 hover:text-slate-400"
                            }`}
                          >
                            Región Media
                          </button>
                          <button
                            onClick={() => {
                              if ((activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual") return;
                              const next = { ...activeRuptureDetails, location: "posterior" as const };
                              if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                              else setManualRuptureDetailsLeft(next);
                            }}
                            disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                            className={`flex-1 text-center py-1 text-[8.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                              activeRuptureDetails.location === "posterior"
                                ? "bg-slate-850 text-slate-205 border border-slate-750 font-black text-rose-450"
                                : "text-slate-550 hover:text-slate-400"
                            }`}
                          >
                            Cara Posterior
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Massive retraction distance */}
                    {activeRuptureDetails.type === "naked_head" && (
                      <div className="space-y-1 col-span-full">
                        <div className="flex items-center justify-between">
                          <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Distancia Retracción proximal:</label>
                          <span className="text-[9px] font-bold font-mono text-rose-455">{activeRuptureDetails.retractionDistance} mm</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="35"
                          step="1"
                          value={activeRuptureDetails.retractionDistance}
                          disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const next = { ...activeRuptureDetails, retractionDistance: val, gap: val };
                            if (activeSupraspinatusEditSide === "derecho") setManualRuptureDetailsRight(next);
                            else setManualRuptureDetailsLeft(next);
                          }}
                          className="w-full accent-indigo-500 disabled:opacity-40 cursor-pointer h-1.5 bg-slate-900 rounded"
                        />
                      </div>
                    )}

                  </div>
                </div>

                {/* Sincronización feedback panel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-indigo-950/20 border border-indigo-900/30 rounded-xl mt-2 select-none">
                  <div className="flex items-start gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-[8.5px] leading-relaxed text-indigo-300">
                      <span className="font-extrabold uppercase tracking-wider block">Integración con Impresión Diagnóstica</span>
                      Presiona "Escribir en Reporte" para traducir estas medidas en una frase médica formal e inyectarla de inmediato al texto del examen.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      syncDetailedTearToReport(activeSupraspinatusEditSide, activeRuptureDetails);
                    }}
                    disabled={(activeSupraspinatusEditSide === "derecho" ? supraspinatusRuptureTypeRight : supraspinatusRuptureTypeLeft) !== "manual"}
                    className="py-1 px-3 bg-indigo-600 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-650 disabled:border-slate-850 border border-indigo-500/20 text-white text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                  >
                    📝 Escribir en Reporte
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- HIDDEN PRINT PACKAGE WRAPPERS ENABLING HIGH-QUALITY RASTERIZATION BY App.tsx --- */}
      {(() => {
        const rightReport = getSideSpecificReport(generatedReport, "derecho");
        const leftReport = getSideSpecificReport(generatedReport, "izquierdo");
        const parsedRight = parseSupraspinatusRuptureFromText(rightReport || generatedReport, states.supraspinatus, "derecho", generatedReport);
        const parsedLeft = parseSupraspinatusRuptureFromText(leftReport || generatedReport, statesLeft.supraspinatus, "izquierdo", generatedReport);

        const detailsRight = supraspinatusRuptureTypeRight === "manual" ? manualRuptureDetailsRight : parsedRight;
        const detailsLeft = supraspinatusRuptureTypeLeft === "manual" ? manualRuptureDetailsLeft : parsedLeft;

        const isBilateral = laterality?.toLowerCase() === "bilateral";
        const hasRight = isBilateral || laterality?.toLowerCase().includes("der") || laterality?.toLowerCase().includes("right") || laterality?.toLowerCase() === "r";
        const hasLeft = isBilateral || laterality?.toLowerCase().includes("izq") || laterality?.toLowerCase().includes("left") || laterality?.toLowerCase() === "l";

        return (
          <>
            <div 
              id="supraspinatus-ap-print-wrapper" 
              data-include={includeSupraspinatusInPdf && hasRight && detailsRight.type !== "none" ? "true" : "false"} 
              style={{ display: "none" }}
            >
              {renderSupraspinatusAP(detailsRight, true, "derecho")}
              {renderSupraspinatusLAT(detailsRight, true, "derecho")}
            </div>
            <div 
              id="supraspinatus-ap-print-wrapper-left" 
              data-include={includeSupraspinatusInPdf && hasLeft && detailsLeft.type !== "none" ? "true" : "false"} 
              style={{ display: "none" }}
            >
              {renderSupraspinatusAP(detailsLeft, true, "izquierdo")}
              {renderSupraspinatusLAT(detailsLeft, true, "izquierdo")}
            </div>
          </>
        );
      })()}

    </div>
  );
}

// Helpers for translations and options
const translateStructureLabel = (id: string): string => {
  switch (id) {
    case "supraspinatus": return "Tendón Supraespinoso";
    case "infraspinatus": return "Tendón Infraespinoso";
    case "subscapularis": return "Tendón Subescapular";
    case "biceps": return "Porción Larga del Bíceps";
    case "bursa": return "Bursa Subacromiodeltoidea";
    case "glenohumeral": return "Receso Articular / Líquido Glenohumeral";
    case "acromioclavicular": return "Articulación Acromioclavicular";
    case "dynamic_assessment": return "Valoración Dinámica / Pinzamiento";
    default: return id;
  }
};

const translateStructureLabelInBrief = (id: string): string => {
  switch (id) {
    case "supraspinatus": return "Supraespinoso";
    case "infraspinatus": return "Infraespinoso";
    case "subscapularis": return "Subescapular";
    case "biceps": return "P. Larga Bíceps";
    case "bursa": return "Bursa SAD";
    case "glenohumeral": return "Receso GH";
    case "acromioclavicular": return "A. Acromioclav.";
    case "dynamic_assessment": return "Val. Dinámica";
    default: return id;
  }
};

const getAvailableStatesForStructure = (id: string) => {
  switch (id) {
    case "supraspinatus":
    case "infraspinatus":
    case "subscapularis":
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Cons. Normal ✓" },
        { val: "tendinosis", label: "Tendinosis 🟡" },
        { val: "desgarro_parcial", label: "Ruptura Parcial 🌸" },
        { val: "desgarro_completo", label: "Ruptura Completa 🔴" }
      ];
    
    case "biceps":
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Cons. Normal ✓" },
        { val: "tendinitis", label: "Tenosinovitis 🟡" },
        { val: "subluxacion", label: "Subluxación 🌸" },
        { val: "desgarro_parcial", label: "Ruptura Parcial 🔴" }
      ];

    case "bursa":
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Cons. Normal ✓" },
        { val: "bursitis_leve", label: "Bursitis Leve 🟡" },
        { val: "bursitis_severa", label: "Bursitis Severa 🔴" }
      ];

    case "glenohumeral":
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Cons. Normal ✓" },
        { val: "derrame_leve", label: "Derrame Leve 🟡" },
        { val: "derrame_moderado", label: "Derrame Moderado 🔴" }
      ];

    case "acromioclavicular":
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Cons. Normal ✓" },
        { val: "artrosis", label: "Artrosis / Pinzam. 🟡" },
        { val: "hipertrofia", label: "Prominencia Ósea 🔴" }
      ];

    case "dynamic_assessment":
      return [
        { val: "no_descrito", label: "No Descrita ⚪" },
        { val: "normal", label: "S/P Deslizamiento ✓" },
        { val: "pinzamiento", label: "Pinzamiento Sub. 🔴" }
      ];

    default:
      return [
        { val: "no_descrito", label: "No Descrito ⚪" },
        { val: "normal", label: "Normal ✓" }
      ];
  }
};

// --- EXCLUSIVE SUPRASPINATUS TEAR PARSING AND VECTOR RENDERING CONTROLLER ---

export interface SupraspinatusRuptureDetails {
  type: "none" | "partial" | "full_partial_width" | "naked_head";
  surface: "bursal" | "articular";
  thicknessPercent: number; // 10 to 100
  distanceFromInsertion: number; // mm
  gap: number; // mm
  tendonAPSize: number; // mm
  ruptureAPSize: number; // mm
  location: "anterior" | "posterior" | "media";
  retractionDistance: number; // mm
}

export const getSideSpecificReport = (text: string, side: "derecho" | "izquierdo"): string => {
  if (!text) return "";
  const lower = text.toLowerCase();
  
  // Look for sections
  const rightIndex = lower.indexOf("hombro derecho");
  const leftIndex = lower.indexOf("hombro izquierdo");
  
  if (rightIndex !== -1 && leftIndex !== -1) {
    if (side === "derecho") {
      if (rightIndex < leftIndex) {
        return text.substring(rightIndex, leftIndex);
      } else {
        return text.substring(rightIndex);
      }
    } else {
      if (leftIndex < rightIndex) {
        return text.substring(leftIndex, rightIndex);
      } else {
        return text.substring(leftIndex);
      }
    }
  }
  
  // Fallback if just "derecho" or "izquierdo" exists as standalone section
  const dIndex = lower.indexOf("derecho:");
  const iIndex = lower.indexOf("izquierdo:");
  if (dIndex !== -1 && iIndex !== -1) {
    if (side === "derecho") {
      return dIndex < iIndex ? text.substring(dIndex, iIndex) : text.substring(dIndex);
    } else {
      return iIndex < dIndex ? text.substring(iIndex, dIndex) : text.substring(iIndex);
    }
  }
  
  return text;
};

const extractDiagnosticImpression = (text: string): string => {
  if (!text) return "";
  const lower = text.toLowerCase();
  const headings = [
    "impresión diagnóstica",
    "impresion diagnostica",
    "conclusiones",
    "conclusión",
    "conclusion",
    "diagnóstico",
    "diagnostico",
    "imp. diagnóstica",
    "imp. diagnostica",
    "concl:",
    "impresión:",
    "impresion:",
    "impresión",
    "impresion",
    "diagnósticos:",
    "diagnosticos:",
    "diagnósticos",
    "diagnosticos",
    "juicio clínico",
    "juicio clinico"
  ];
  
  for (const heading of headings) {
    const idx = lower.lastIndexOf(heading);
    if (idx !== -1) {
      return text.substring(idx);
    }
  }
  return "";
};

export const parseSupraspinatusRuptureFromText = (
  reportText: string,
  clinicalState: string,
  side: "derecho" | "izquierdo" = "derecho",
  fullReport?: string
): SupraspinatusRuptureDetails => {
  const lower = (reportText || "").toLowerCase();
  
  // Default values
  const result: SupraspinatusRuptureDetails = {
    type: "none",
    surface: "articular",
    thicknessPercent: 50,
    distanceFromInsertion: 0,
    gap: 5,
    tendonAPSize: 32,
    ruptureAPSize: 12,
    location: "anterior",
    retractionDistance: 15
  };

  // Extract and scan the diagnostic impression of the full or side-specific report
  let detectedPartialFromImpression = false;
  let detectedFullFromImpression = false;
  let detectedNakedFromImpression = false;
  let surfaceFromImpression: "bursal" | "articular" | undefined = undefined;
  
  const targetReport = fullReport || reportText;
  const impressionText = extractDiagnosticImpression(targetReport);
  if (impressionText) {
    const impressionLower = impressionText.toLowerCase();
    
    // Isolate section relevant to our side
    let relevantImpressionText = impressionLower;
    
    const hasRightInImpression = impressionLower.includes("derech") || impressionLower.includes(" der ") || impressionLower.includes(" der.") || impressionLower.includes("hombro d") || impressionLower.includes("m.s.d");
    const hasLeftInImpression = impressionLower.includes("izquierd") || impressionLower.includes(" izq ") || impressionLower.includes(" izq.") || impressionLower.includes("hombro i") || impressionLower.includes("m.s.i");
    
    if (hasRightInImpression && hasLeftInImpression) {
      // It's a bilateral impression - split into side-specific sections
      const lines = impressionLower.split(/[\n\r✓•\-\d)]+/);
      let sideLines: string[] = [];
      let currentSectionSide: "derecho" | "izquierdo" | null = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const lineHasRight = trimmedLine.includes("derech") || trimmedLine.includes(" der ") || trimmedLine.includes(" der.") || trimmedLine.includes("hombro d") || trimmedLine.includes("m.s.d");
        const lineHasLeft = trimmedLine.includes("izquierd") || trimmedLine.includes(" izq ") || trimmedLine.includes(" izq.") || trimmedLine.includes("hombro i") || trimmedLine.includes("m.s.i");
        
        if (lineHasRight && !lineHasLeft) {
          currentSectionSide = "derecho";
        } else if (lineHasLeft && !lineHasRight) {
          currentSectionSide = "izquierdo";
        }
        
        if (
          currentSectionSide === side || 
          (lineHasRight && side === "derecho") || 
          (lineHasLeft && side === "izquierdo") || 
          (!lineHasRight && !lineHasLeft && currentSectionSide === side)
        ) {
          sideLines.push(trimmedLine);
        }
      }
      if (sideLines.length > 0) {
        relevantImpressionText = sideLines.join(" ");
      }
    }
    
    // Now check the clinical text block of the isolated impression
    const containsRupture = 
      relevantImpressionText.includes("rotura") || 
      relevantImpressionText.includes("ruptura") || 
      relevantImpressionText.includes("desgarro") || 
      relevantImpressionText.includes("solución de continuidad") ||
      relevantImpressionText.includes("parcial") || 
      relevantImpressionText.includes("completo") ||
      relevantImpressionText.includes("espesor") ||
      relevantImpressionText.includes("grosor") ||
      relevantImpressionText.includes("afectación");
      
    if (containsRupture) {
      const isPartial = 
        relevantImpressionText.includes("espesor parcial") || 
        relevantImpressionText.includes("grosor parcial") || 
        relevantImpressionText.includes("rotura parcial") || 
        relevantImpressionText.includes("ruptura parcial") || 
        relevantImpressionText.includes("desgarro parcial") || 
        relevantImpressionText.includes("parcial") ||
        relevantImpressionText.includes("vertiente") ||
        relevantImpressionText.includes("superficie") ||
        relevantImpressionText.includes("borde") ||
        relevantImpressionText.includes("unión miotendinosa");
        
      const isNaked = 
        relevantImpressionText.includes("cabeza humeral desnuda") || 
        relevantImpressionText.includes("humero desnudo") || 
        relevantImpressionText.includes("húmero desnudo") || 
        relevantImpressionText.includes("cabeza desnuda") || 
        relevantImpressionText.includes("retracción masiva") || 
        relevantImpressionText.includes("masivo") ||
        relevantImpressionText.includes("masiva");
        
      const isFullComplete = 
        relevantImpressionText.includes("espesor completo") || 
        relevantImpressionText.includes("grosor completo") || 
        relevantImpressionText.includes("espesor total") || 
        relevantImpressionText.includes("completo") || 
        relevantImpressionText.includes("transfixiante") ||
        relevantImpressionText.includes("completa");
        
      if (isNaked) {
        detectedNakedFromImpression = true;
      } else if (isFullComplete) {
        detectedFullFromImpression = true;
      } else if (isPartial) {
        detectedPartialFromImpression = true;
      }
      
      // Determine vertical / horizontal surface in the impression
      if (
        relevantImpressionText.includes("vertiente articular") || 
        relevantImpressionText.includes("superficie articular") || 
        relevantImpressionText.includes("borde articular") || 
        relevantImpressionText.includes("lado articular") || 
        relevantImpressionText.includes("carilla articular") || 
        relevantImpressionText.includes("articular") || 
        relevantImpressionText.includes("joint")
      ) {
        surfaceFromImpression = "articular";
      } else if (
        relevantImpressionText.includes("vertiente bursal") || 
        relevantImpressionText.includes("superficie bursal") || 
        relevantImpressionText.includes("borde bursal") || 
        relevantImpressionText.includes("lado bursal") || 
        relevantImpressionText.includes("carilla bursal") || 
        relevantImpressionText.includes("bursal")
      ) {
        surfaceFromImpression = "bursal";
      }
    }
  }

  // Check if clinical state or text indicates rupture / desgarro
  const isRupture = 
    clinicalState === "desgarro_parcial" || 
    clinicalState === "desgarro_completo" ||
    lower.includes("desgarro") || 
    lower.includes("ruptura") || 
    lower.includes("rotura") || 
    lower.includes("solución de continuidad") ||
    detectedPartialFromImpression ||
    detectedFullFromImpression ||
    detectedNakedFromImpression;

  if (!isRupture) {
    return result;
  }

  // Define type
  if (detectedNakedFromImpression) {
    result.type = "naked_head";
  } else if (detectedFullFromImpression) {
    const lowerTarget = (lower + " " + (impressionText || "")).toLowerCase();
    if (
      lowerTarget.includes("anchura parcial") || 
      lowerTarget.includes("ancho parcial") || 
      lowerTarget.includes("ap") || 
      lowerTarget.includes("anterior") || 
      lowerTarget.includes("posterior") || 
      lowerTarget.includes("fascículo") || 
      lowerTarget.includes("fibras")
    ) {
      result.type = "full_partial_width";
    } else {
      result.type = "full_partial_width";
    }
  } else if (detectedPartialFromImpression) {
    result.type = "partial";
  } else {
    // Fallback to body-only parsing
    if (
      lower.includes("cabeza humeral desnuda") || 
      lower.includes("húmero desnudo") || 
      lower.includes("humero desnudo") || 
      lower.includes("cabeza desnuda") || 
      (lower.includes("completa") && lower.includes("retracción") && (lower.includes("masiva") || lower.includes("retracción masiva") || lower.includes("desnuda")))
    ) {
      result.type = "naked_head";
    } else if (
      (lower.includes("completo") || lower.includes("completa") || lower.includes("transfixiante") || lower.includes("espesor total") || lower.includes("grosor completo") || lower.includes("espesor completo") || clinicalState === "desgarro_completo") &&
      (lower.includes("anchura parcial") || lower.includes("ancho parcial") || lower.includes("ap") || lower.includes("anterior") || lower.includes("posterior") || lower.includes("fascículo") || lower.includes("fibras"))
    ) {
      result.type = "full_partial_width";
    } else if (
      lower.includes("parcial") || 
      lower.includes("espesor parcial") || 
      lower.includes("grosor parcial") || 
      clinicalState === "desgarro_parcial"
    ) {
      result.type = "partial";
    } else if (clinicalState === "desgarro_completo") {
      result.type = "full_partial_width";
    } else {
      result.type = "partial";
    }
  }

  // 1. Surface for partial tears (Maximum priority to diagnostic impression)
  if (surfaceFromImpression) {
    result.surface = surfaceFromImpression;
  } else {
    // High-precision phrases in the report body
    const bodyHasArticularRupture = 
      lower.includes("vertiente articular") || 
      lower.includes("superficie articular") || 
      lower.includes("borde articular") || 
      lower.includes("carilla articular") ||
      lower.includes("lado articular") || 
      lower.includes("espesor parcial articular") ||
      lower.includes("ruptura articular") || 
      lower.includes("rotura articular") || 
      lower.includes("desgarro articular");

    const bodyHasBursalRupture = 
      lower.includes("vertiente bursal") || 
      lower.includes("superficie bursal") || 
      lower.includes("borde bursal") || 
      lower.includes("carilla bursal") ||
      lower.includes("lado bursal") || 
      lower.includes("espesor parcial bursal") ||
      lower.includes("ruptura bursal") || 
      lower.includes("rotura bursal") || 
      lower.includes("desgarro bursal");

    if (bodyHasArticularRupture && !bodyHasBursalRupture) {
      result.surface = "articular";
    } else if (bodyHasBursalRupture && !bodyHasArticularRupture) {
      result.surface = "bursal";
    } else {
      // General fallbacks but filter out unrelated "bursal" words such as general subacromial bursitis or bursal fluid
      if (lower.includes("superficie bursal") || lower.includes("lado bursal")) {
        result.surface = "bursal";
      } else if (lower.includes("superficie articular") || lower.includes("lado articular") || lower.includes("articular")) {
        result.surface = "articular";
      } else if (lower.includes("bursal") && (lower.includes("ruptura") || lower.includes("rotura") || lower.includes("desgarro") || lower.includes("parcial"))) {
        result.surface = "bursal";
      } else {
        // Safe anatomical default is articular-sided as they represent over 80% of clinical cases
        result.surface = "articular";
      }
    }
  }

  // 2. Percentage of thickness
  const pctMatch = lower.match(/(\d+)\s*%/);
  if (pctMatch) {
    result.thicknessPercent = Math.min(100, Math.max(10, parseInt(pctMatch[1], 10)));
  } else {
    if (lower.includes("25%") || lower.includes("un cuarto") || lower.includes("leve")) {
      result.thicknessPercent = 25;
    } else if (lower.includes("50%") || lower.includes("mitad") || lower.includes("moderado") || lower.includes("compromiso del 50") || lower.includes("compromete 50")) {
      result.thicknessPercent = 50;
    } else if (lower.includes("75%") || lower.includes("tres cuartos") || lower.includes("subtotal") || lower.includes("severo") || lower.includes("compromiso del 75") || lower.includes("compromete 75")) {
      result.thicknessPercent = 75;
    }
  }

  // 3. Distance from insertion in mm
  const distPatterns = [
    // Matches: "a X mm de la inserción", "a X mm de su inserción", "a Xmm de su insercion", "a X mm del footprint"
    /a\s*(\d+(?:[.,]\d+)?)\s*mm\s*(?:de\s*(?:la\s+|su\s+|su\s+inserci[oó]n\s+|distal\s+)?|del\s+sitio\s+de\s+|de\s+la\s+huella\s+de\s+)?(?:inserci[oó]n|footprint|huella)/i,
    
    // Matches: "dista X mm de la inserción", "distante X mm de su inserción"
    /(?:dista|distante|distancia)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*mm\s*(?:de\s*(?:la\s+|su\s+|su\s+inserci[oó]n\s+|distal\s+)?|del\s+sitio\s+de\s+)?(?:inserci[oó]n|footprint|huella)/i,
    
    // Matches: "localizado a X mm de la inserción"
    /localizado\s+a\s+(\d+(?:[.,]\d+)?)\s*mm\s*(?:de\s*(?:la\s+|su\s+)?|del\s+sitio\s+de\s+)?(?:inserci[oó]n|footprint|huella)/i,

    // Matches: "inserción a X mm", "insercion a Xmm"
    /(?:inserci[oó]n|insercion|footprint|huella)\s*(?:a|de|distante\s+a)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,

    // Matches: "X mm de inserción", "X mm de la inserción"
    /(\d+(?:[.,]\d+)?)\s*mm\s*(?:desde|de|de\s+la|de\s+su)\s*(?:sitio\s+de\s+)?(?:inserci[oó]n|footprint|huella)/i,

    // Matches: "distancia al footprint de X mm"
    /(?:distancia|dista)\s*(?:al|a\s+la\s+huella|al\s+footprint)?\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*mm/i,

    // Matches: "distancia de la inserción es de X mm"
    /(?:distancia|dista)\s*(?:desde\s+la|de\s+la|a\s+la)?\s*inserci[oó]n\s*(?:es\s+de|de)?\s*(\d+(?:[.,]\d+)?)\s*mm/i,

    // Raw backups
    /(?:inserci[oó]n|insercion)\s*(?:a|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /a\s*(\d+(?:[.,]\d+)?)\s*mm\s*(?:de\s*la\s*inserci[oó]n|de\s*la\s*insercion|de\s*inserci[oó]n)/i,
    /distancia\s*(?:desde|de|de la)?\s*(?:la\s*)?(?:inserci[oó]n|insercion)\s*(?:de|es|mide)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /(\d+(?:[.,]\d+)?)\s*mm\s*(?:desde|de|de la)\s*inserci[oó]n/i
  ];

  for (const pattern of distPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.distanceFromInsertion = parseFloat(match[1].replace(",", "."));
      break;
    }
  }

  // 4. Gap / Brecha between fibers
  const gapPatterns = [
    /(?:gap|brecha|retracci[oó]n|retraccion|distancia entre cabos|separaci[oó]n|separacion)\s*(?:de|del)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/,
    /(\d+(?:[.,]\d+)?)\s*mm\s*(?:de)?\s*(?:gap|brecha|retracci[oó]n|retraccion|separaci[oó]n|separacion)/
  ];

  for (const pattern of gapPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.gap = parseFloat(match[1].replace(",", "."));
      result.retractionDistance = result.gap; // Keep retraction distance in sync
      break;
    }
  }

  // 5. AP tendon size
  const tendonAPPatterns = [
    // Matches: "diámetro anteroposterior (AP) de X mm", "diámetro ap del tendón es de X mm"
    /(?:di[aá]metro|espesor|grosor|grosor\s+tendinoso|ancho)\s*(?:anteroposterior|antero-posterior|ap)\s*(?:del\s+|de\s+)?(?:tend[oó]n\s*)?(?:de|es|mide)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    
    // Matches: "tendón supraespinoso... con diámetro ap de X mm"
    /tend[oó]n\s+.*?(?:mide|de)\s+(\d+(?:[.,]\d+)?)\s*mm\s+(?:en\s+|de\s+)?(?:di[aá]metro\s+)?(?:ap|anteroposterior|coronal)/i,
    
    // Matches: "grosor tendinoso: X mm"
    /(?:grosor|grosor\s+tendinoso|espesor|espesor\s+tendinoso|ancho)\s*(?:del\s+tend[oó]n\s*)?(?:mide|de|es)?\s*(\d+(?:[.,]\d+)?)\s*mm(?:\s+en\s+(?:el\s+)?plano\s+)?\s*(?:ap|anteroposterior)/i,

    // Matches: "ancho ap del tendón: X mm"
    /(?:ancho|grosor|grosor\s+tendinoso|di[aá]metro)\s+ap(?:\s*del\s*tend[oó]n)?\s*(?:de|es|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    
    // Fallback: "grosor tendinoso de X mm"
    /(?:grosor|espesor)\s+(?:tendinoso|del\s+tend[oó]n)\s*(?:mide|de|es|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    
    // General fallback
    /di[aá]metro\s+ap\s*(?:de|es|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /(?:medida|di[aá]metro|diámetro|ancho|ancho\s*ap|grosor|grosor\s*ap)\s*(?:del)?\s*tend[oó]n\s*(?:de|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)\s*(?:en|de)?\s*ap/i,
    /tend[oó]n\s*(?:mide|de)?\s*(\d+(?:[.,]\d+)?)\s*mm\s*(?:en)?\s*ap/i,
    /ap\s*(?:del)?\s*tend[oó]n\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*mm/i
  ];

  for (const pattern of tendonAPPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.tendonAPSize = parseFloat(match[1].replace(",", "."));
      break;
    }
  }

  // 6. AP rupture size
  const ruptureAPPatterns = [
    // Matches: "ruptura que mide X mm en el plano AP"
    /(?:ruptura|desgarro|brecha|defecto|rotura)\s+.*?(?:de|mide|es|mide\s+unos)\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)\s*(?:en\s+|de\s+)?(?:el\s+plano\s+)?ap/i,
    
    // Matches: "diámetro AP de la rotura es de X mm", "brecha AP de X mm", "ancho AP del desgarro: X mm"
    /(?:di[aá]metro|espesor|grosor|ancho|extensi[oó]n|brecha)\s+ap\s*(?:de\s+la\s+|del\s+)?(?:ruptura|desgarro|brecha|defecto|rotura)\s*(?:de|mide|es|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,

    // Backups
    /(?:ruptura|desgarro|brecha|defecto|rotura)\s*(?:mide|de|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)\s*(?:en|de|en\s+sentido)?\s*ap/i,
    /(?:ruptura|desgarro|brecha|defecto|rotura)\s*(?:en|de)?\s*ap\s*(?:mide|de|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /ap\s*(?:de\s+la\s+|de\s+)?(?:ruptura|desgarro|brecha|rotura|defecto)\s*(?:de|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /(?:ruptura|desgarro|brecha|defecto)\s*(?:mide|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)\s*(?:en|de)?\s*ap/i,
    /(?:ruptura|desgarro|brecha|defecto)\s*(?:en|de)?\s*ap\s*(?:mide|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i,
    /ap\s*(?:de la)?\s*(?:ruptura|desgarro|brecha)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/i
  ];

  for (const pattern of ruptureAPPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.ruptureAPSize = parseFloat(match[1].replace(",", "."));
      break;
    }
  }

  // 7. Location of rupture in AP (anterior vs posterior vs media)
  if (lower.includes("anterior") || lower.includes("anteriores") || lower.includes("fibras anteriores") || lower.includes("borde anterior") || lower.includes("cara anterior")) {
    result.location = "anterior";
  } else if (lower.includes("posterior") || lower.includes("posteriores") || lower.includes("fibras posteriores") || lower.includes("borde posterior") || lower.includes("cara posterior")) {
    result.location = "posterior";
  } else if (lower.includes("medio") || lower.includes("media") || lower.includes("región media") || lower.includes("region media") || lower.includes("central") || lower.includes("fibras medias") || lower.includes("borde medio")) {
    result.location = "media";
  }

  // 8. Retraction / massive retraction distance
  const retractionPatterns = [
    /(?:retracci[oó]n|retraccion|retra[íi]do|retraido)\s*(?:de|en|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|mil[íi]metros)/,
    /(?:retracci[oó]n|retraccion|retra[íi]do|retraido)\s*(?:de|en|es)?\s*(\d+(?:[.,]\d+)?)\s*(?:cm|cent[íi]metros)/
  ];

  for (const pattern of retractionPatterns) {
    const match = lower.match(pattern);
    if (match) {
      let val = parseFloat(match[1].replace(",", "."));
      if (pattern.source.includes("cm")) {
        val = val * 10; // Convert cm to mm
      }
      result.retractionDistance = val;
      result.gap = val; // Also update gap for full_partial_width consistency
      break;
    }
  }

  return result;
};

export const renderSupraspinatusAP = (
  details: SupraspinatusRuptureDetails,
  isPrint: boolean,
  side: "derecho" | "izquierdo" = "derecho"
) => {
  const isLeft = side === "izquierdo";
  const shouldMirror = side === "derecho";
  
  // Background colors
  const bgColor = isPrint ? "#ffffff" : "#020617";
  const borderColor = isPrint ? "#e2e8f0" : "#1e293b";
  const boneColor = isPrint ? "#f8fafc" : "#0b0f19";
  const boneStroke = isPrint ? "#94a3b8" : "#334155";
  const tendonFill = isPrint ? "#fce7f3" : "rgba(244, 63, 94, 0.15)";
  const tendonStroke = isPrint ? "#db2777" : "#ec4899";
  const cartilageColor = "#06b6d4";
  const textMuted = isPrint ? "#475569" : "#64748b";

  const transformGroup = shouldMirror ? "translate(200, 0) scale(-1, 1)" : undefined;

  const dFromInsertion = Math.min(25, Math.max(0, details.distanceFromInsertion));
  const thicknessPct = Math.min(100, Math.max(0, details.thicknessPercent));
  const gapSize = Math.min(30, Math.max(2, details.gap));
  const retractDist = Math.min(40, Math.max(0, details.retractionDistance));

  return (
    <svg
      id={`supraspinatus-ap-svg${isLeft ? "-left" : ""}`}
      viewBox="0 0 200 200"
      className="w-full max-w-[190px] h-[190px] drop-shadow-md select-none"
      style={{ background: bgColor, borderRadius: "12px", border: `1px solid ${borderColor}` }}
    >
      <g transform={transformGroup}>
        {/* Humeral head bone slice */}
        <path
          d="M 10,190 C 10,130 70,80 130,105 C 150,113 160,118 175,115 C 185,112 195,125 195,190 Z"
          fill={boneColor}
          stroke={boneStroke}
          strokeWidth="1.5"
        />
        {/* Articular cartilage lining */}
        <path
          d="M 14,188 C 14,132 72,82 130,107"
          fill="none"
          stroke={cartilageColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Footprint zone */}
        {details.type === "naked_head" ? (
          <path
            d="M 130,105 C 145,113 155,116 175,115"
            fill="none"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeDasharray="2,2"
          />
        ) : (
          <path
            d="M 130,105 C 145,113 155,116 175,115"
            fill="none"
            stroke={tendonStroke}
            strokeWidth="2"
          />
        )}

        {/* Normal Tendon Base Shape */}
        {details.type === "none" && (
          <path
            d="M 0,60 Q 50,65 100,75 C 130,82 150,90 175,115 L 173,117 C 148,93 128,85 98,78 Q 48,68 0,80 Z"
            fill={tendonFill}
            stroke={tendonStroke}
            strokeWidth="2"
          />
        )}

        {/* Partial Thickness Tear Shape (Anatomical Thickness Cross-Section) */}
        {details.type === "partial" && (
          <>
            {/* Soft grid background */}
            <line x1="10" y1="50" x2="190" y2="50" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />
            <line x1="10" y1="100" x2="190" y2="100" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />
            <line x1="10" y1="140" x2="190" y2="140" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />
            <line x1="50" y1="20" x2="50" y2="145" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />
            <line x1="100" y1="20" x2="100" y2="145" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />
            <line x1="145" y1="20" x2="145" y2="145" stroke={isPrint ? "#f1f5f9" : "#0f172a"} strokeWidth="1" />

            {/* Bone block on the right representing greater tuberosity */}
            <path
              d="M 145,55 C 145,55 168,55 174,68 C 178,82 174,96 174,115 C 174,124 156,130 145,130 L 145,142 L 195,142 L 195,45 L 145,45 Z"
              fill={boneColor}
              stroke={boneStroke}
              strokeWidth="1.2"
            />
            
            {/* Articular cartilage under the tendon */}
            <line x1="10" y1="120" x2="145" y2="120" stroke={cartilageColor} strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Bursa on top of the tendon */}
            <line x1="10" y1="80" x2="145" y2="80" stroke="#a855f7" strokeWidth="1.2" opacity="0.65" strokeDasharray="2,2" />

            {(() => {
              const distPx = dFromInsertion * 3.5;
              const defectW = Math.max(10, gapSize * 2.2);
              const defectH = 34 * (thicknessPct / 100);
              
              // Ensure we don't go out of the tendon left end (X = 15)
              const defectX = Math.max(15, 145 - distPx - defectW);
              
              // Re-calculate actual visual distance for arrows
              const visualDistPx = 145 - (defectX + defectW);
              const isBursal = details.surface === "bursal";
              
              // Custom tendon path clipping the defect out
              const tendonPath = isBursal
                ? `M 12,118 L 145,118 L 145,82 L ${defectX + defectW},82 L ${defectX + defectW},${82 + defectH} L ${defectX},${82 + defectH} L ${defectX},82 L 12,82 Z`
                : `M 12,118 L ${defectX},118 L ${defectX},${118 - defectH} L ${defectX + defectW},${118 - defectH} L ${defectX + defectW},118 L 145,118 L 145,82 L 12,82 Z`;

              const defectY = isBursal ? 82 : 118 - defectH;
              
              return (
                <g>
                  {/* Definition of clip-path to clip fibers nicely within tendon boundaries */}
                  <defs>
                    <clipPath id={`tendon-clip-${side}`}>
                      <path d={tendonPath} />
                    </clipPath>
                  </defs>

                  {/* Draw visible tendon base block */}
                  <path
                    d={tendonPath}
                    fill={tendonFill}
                    stroke={tendonStroke}
                    strokeWidth="1.8"
                  />

                  {/* Fibers inside clip path */}
                  <g clipPath={`url(#tendon-clip-${side})`}>
                    <line x1="10" y1="91" x2="145" y2="91" stroke={tendonStroke} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.4" />
                    <line x1="10" y1="100" x2="145" y2="100" stroke={tendonStroke} strokeWidth="0.8" opacity="0.3" />
                    <line x1="10" y1="109" x2="145" y2="109" stroke={tendonStroke} strokeWidth="0.8" strokeDasharray="4,2" opacity="0.4" />
                  </g>

                  {/* Draw Red Tear Defect Overlay (with soft red fill and dotted boundary) */}
                  <rect
                    x={defectX}
                    y={defectY}
                    width={defectW}
                    height={defectH}
                    fill="rgba(239, 68, 68, 0.25)"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                    rx="1"
                  />
                  {/* Subtle tear texture lines inside defect */}
                  <line x1={defectX + 2} y1={defectY + 2} x2={defectX + defectW - 2} y2={defectY + defectH - 2} stroke="#ef4444" strokeWidth="0.75" opacity="0.5" />
                  <line x1={defectX + defectW - 2} y1={defectY + 2} x2={defectX + 2} y2={defectY + defectH - 2} stroke="#ef4444" strokeWidth="0.75" opacity="0.5" />

                  {/* Footprint attachment cortical line */}
                  <line x1="145" y1="82" x2="145" y2="118" stroke="#f43f5e" strokeWidth="2.5" />

                  {/* HIGH-CONTRAST LABELS & ANNOTATIONS */}
                  
                  {/* Distance from Insertion dimension indicator */}
                  {dFromInsertion > 0 && (
                    <g>
                      {/* Left reference vertical line from defect end to dimY */}
                      <line
                        x1={145 - visualDistPx}
                        y1="82"
                        x2={145 - visualDistPx}
                        y2="62"
                        stroke="#f43f5e"
                        strokeWidth="0.75"
                        strokeDasharray="1.5,1.5"
                      />
                      {/* Insertion point vertical reference line to dimY */}
                      <line
                        x1="145"
                        y1="82"
                        x2="145"
                        y2="62"
                        stroke="#f43f5e"
                        strokeWidth="0.75"
                        strokeDasharray="1.5,1.5"
                      />
                      {/* Horizontal dimension line */}
                      <line
                        x1={145 - visualDistPx}
                        y1="62"
                        x2="145"
                        y2="62"
                        stroke="#f43f5e"
                        strokeWidth="0.8"
                      />
                      {/* Dimension ticks */}
                      <line x1={145 - visualDistPx} y1="59" x2={145 - visualDistPx} y2="65" stroke="#f43f5e" strokeWidth="0.8" />
                      <line x1="145" y1="59" x2="145" y2="65" stroke="#f43f5e" strokeWidth="0.8" />

                      {/* Dimension Text label */}
                      <text
                        x={145 - visualDistPx / 2}
                        y="57"
                        textAnchor="middle"
                        fill="#ef4444"
                        fontSize="6.5"
                        fontWeight="black"
                        className="font-mono bg-slate-950"
                        transform={shouldMirror ? `scale(-1, 1) translate(${-2 * (145 - visualDistPx / 2)}, 0)` : undefined}
                      >
                        {details.distanceFromInsertion} mm
                      </text>
                    </g>
                  )}

                  {/* Thickness Percentage dimension indicator */}
                  {thicknessPct > 0 && (
                    <g>
                      {/* Right-hand side or left-hand side thickness line */}
                      <line
                        x1={defectX - 6}
                        y1={defectY}
                        x2={defectX - 6}
                        y2={isBursal ? 82 : 118}
                        stroke="#ef4444"
                        strokeWidth="1"
                      />
                      {/* End ticks */}
                      <line x1={defectX - 9} y1={defectY} x2={defectX - 3} y2={defectY} stroke="#ef4444" strokeWidth="1" />
                      <line x1={defectX - 9} y1={isBursal ? 82 : 118} x2={defectX - 3} y2={isBursal ? 82 : 118} stroke="#ef4444" strokeWidth="1" />

                      {/* Label for thickness percentage */}
                      <text
                        x={defectX - 11}
                        y={defectY + defectH / 2 + 2}
                        textAnchor="end"
                        fill="#ef4444"
                        fontSize="6.5"
                        fontWeight="black"
                        className="font-mono"
                        transform={shouldMirror ? `scale(-1, 1) translate(${-2 * (defectX - 11)}, 0)` : undefined}
                      >
                        {details.thicknessPercent}%
                      </text>
                    </g>
                  )}

                  {/* Surface Labels */}
                  <text
                    x="20"
                    y="76"
                    textAnchor="start"
                    fill={isPrint ? "#475569" : "#94a3b8"}
                    fontSize="5"
                    fontWeight="bold"
                    className="font-sans"
                    transform={shouldMirror ? `scale(-1, 1) translate(-40, 0)` : undefined}
                  >
                    VÍA BURSAL
                  </text>
                  <text
                    x="20"
                    y="128"
                    textAnchor="start"
                    fill={isPrint ? "#475569" : "#94a3b8"}
                    fontSize="5"
                    fontWeight="bold"
                    className="font-sans"
                    transform={shouldMirror ? `scale(-1, 1) translate(-40, 0)` : undefined}
                  >
                    VÍA ARTICULAR (JOINT)
                  </text>

                  {/* Label for Tear Size / Gap */}
                  <text
                    x={defectX + defectW / 2}
                    y={isBursal ? 82 + defectH + 8 : 118 - defectH - 4}
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize="5"
                    fontWeight="extrabold"
                    className="font-mono"
                    transform={shouldMirror ? `scale(-1, 1) translate(${-2 * (defectX + defectW / 2)}, 0)` : undefined}
                  >
                    {details.gap}mm
                  </text>

                  {/* AP Secondary Plane Visualization Card (at the bottom of the SVG) */}
                  <g>
                    {/* Dark/White translucent container card */}
                    <rect
                      x="20"
                      y="152"
                      width="160"
                      height="38"
                      rx="6"
                      fill={isPrint ? "#f8fafc" : "#090d16"}
                      stroke={isPrint ? "#cbd5e1" : "#1e293b"}
                      strokeWidth="1.2"
                    />

                    {/* Title */}
                    <text
                      x="100"
                      y="161"
                      textAnchor="middle"
                      fill={isPrint ? "#1e293b" : "#e2e8f0"}
                      fontSize="5"
                      fontWeight="black"
                      className="font-mono tracking-wide"
                      transform={shouldMirror ? "scale(-1, 1) translate(-200, 0)" : undefined}
                    >
                      PLANO SAGITAL / DIÁMETRO AP
                    </text>

                    {/* ANT/POST markers */}
                    <text
                      x="25"
                      y="172.5"
                      textAnchor="middle"
                      fill={textMuted}
                      fontSize="4"
                      fontWeight="bold"
                      className="font-mono"
                      transform={shouldMirror ? "scale(-1, 1) translate(-50, 0)" : undefined}
                    >
                      ANT
                    </text>
                    <text
                      x="175"
                      y="172.5"
                      textAnchor="middle"
                      fill={textMuted}
                      fontSize="4"
                      fontWeight="bold"
                      className="font-mono"
                      transform={shouldMirror ? "scale(-1, 1) translate(-350, 0)" : undefined}
                    >
                      POST
                    </text>

                    {/* AP Tendon representation slide */}
                    {(() => {
                      const tendonAP = details.tendonAPSize;
                      const ruptureAP = details.ruptureAPSize;
                      const apRatio = Math.min(1.0, ruptureAP / Math.max(1, tendonAP));
                      
                      const barW = 130;
                      const barX = 35;
                      const redW = barW * apRatio;
                      const redX = details.location === "anterior"
                        ? barX
                        : details.location === "posterior"
                          ? barX + barW - redW
                          : barX + (barW - redW) / 2;

                      return (
                        <g>
                          {/* Base grey bar representing entire AP width of tendon */}
                          <rect
                            x={barX}
                            y="168"
                            width={barW}
                            height="5.5"
                            rx="1.5"
                            fill={isPrint ? "#e2e8f0" : "#1e293b"}
                          />
                          {/* Red bar representing active tear portion */}
                          <rect
                            x={redX}
                            y="168"
                            width={redW}
                            height="5.5"
                            rx="1.5"
                            fill="#f43f5e"
                          />

                          {/* Dimensions written out */}
                          <line x1={barX} y1="178" x2={barX + barW} y2="178" stroke={isPrint ? "#cbd5e1" : "#1e293b"} strokeWidth="0.5" strokeDasharray="1,1" />

                          <text
                            x={barX}
                            y="184"
                            textAnchor="start"
                            fill={isPrint ? "#475569" : "#a1a1aa"}
                            fontSize="5"
                            fontWeight="bold"
                            className="font-mono"
                            transform={shouldMirror ? `scale(-1, 1) translate(${-2 * barX}, 0)` : undefined}
                          >
                            TENDÓN AP: {tendonAP}mm
                          </text>

                          <text
                            x={barX + barW}
                            y="184"
                            textAnchor="end"
                            fill="#ef4444"
                            fontSize="5.5"
                            fontWeight="black"
                            className="font-mono"
                            transform={shouldMirror ? `scale(-1, 1) translate(${-2 * (barX + barW)}, 0)` : undefined}
                          >
                            ROTURA AP: {ruptureAP}mm ({details.location === "anterior" ? "ANT" : details.location === "posterior" ? "POST" : "MED"})
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                </g>
              );
            })()}
          </>
        )}

        {/* Full Thickness, Partial Width Tear Shape */}
        {details.type === "full_partial_width" && (
          <>
            {(() => {
              const gapCenter = 150 - (dFromInsertion * 2);
              const gapW = gapSize * 1.5;
              const leftEnd = gapCenter - gapW / 2;
              const rightEnd = gapCenter + gapW / 2;

              const showDistanceLine = dFromInsertion >= 1;
              const dimY = 35;
              const midX = (gapCenter + 150) / 2;

              return (
                <g>
                  {leftEnd > 0 && (
                    <path
                      d={`M 0,60 Q 30,62 ${leftEnd - 10},68 C ${leftEnd - 5},70 ${leftEnd},72 ${leftEnd},80 L ${leftEnd - 2},85 C ${leftEnd - 5},78 ${leftEnd - 12},74 0,80 Z`}
                      fill={tendonFill}
                      stroke={tendonStroke}
                      strokeWidth="2"
                    />
                  )}
                  {rightEnd < 170 && (
                    <path
                      d={`M ${rightEnd},82 C ${rightEnd},90 ${rightEnd + 5},100 175,115 L 173,117 C 158,103 ${rightEnd + 3},95 ${rightEnd},92 Z`}
                      fill={tendonFill}
                      stroke={tendonStroke}
                      strokeWidth="2"
                    />
                  )}
                  <rect
                    x={leftEnd}
                    y={65 + (150 - gapCenter) * 0.15}
                    width={gapW}
                    height={25}
                    rx="3"
                    fill={isPrint ? "#ffffff" : "#020617"}
                    stroke="#ec4899"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                  <rect
                    x={leftEnd + 1}
                    y={65 + (150 - gapCenter) * 0.15 + 1}
                    width={gapW - 2}
                    height={23}
                    rx="2"
                    fill="#ec4899"
                    opacity="0.15"
                  />
                  <text
                    x={gapCenter}
                    y={60 + (150 - gapCenter) * 0.15}
                    textAnchor="middle"
                    fill="#ec4899"
                    fontSize="6.5"
                    fontWeight="bold"
                    transform={shouldMirror ? `scale(-1, 1) translate(${-2 * gapCenter}, 0)` : undefined}
                  >
                    GAP: {details.gap}mm
                  </text>

                  {/* Draw Distance from Insertion Dimension Indicator */}
                  {showDistanceLine && (
                    <g>
                      {/* Reference line from gap center to top dimY */}
                      <line
                        x1={gapCenter}
                        y1={65 + (150 - gapCenter) * 0.15}
                        x2={gapCenter}
                        y2={dimY}
                        stroke="#ec4899"
                        strokeWidth="0.75"
                        strokeDasharray="1.5,1.5"
                      />
                      {/* Reference line from insertion point 150 to top dimY */}
                      <line
                        x1={150}
                        y1="100"
                        x2={150}
                        y2={dimY}
                        stroke="#ec4899"
                        strokeWidth="0.75"
                        strokeDasharray="1.5,1.5"
                      />
                      {/* Horizontal dimension line */}
                      <line
                        x1={gapCenter}
                        y1={dimY}
                        x2={150}
                        y2={dimY}
                        stroke="#ec4899"
                        strokeWidth="0.8"
                      />
                      {/* End ticks */}
                      <line x1={gapCenter} y1={dimY - 3} x2={gapCenter} y2={dimY + 3} stroke="#ec4899" strokeWidth="0.8" />
                      <line x1={150} y1={dimY - 3} x2={150} y2={dimY + 3} stroke="#ec4899" strokeWidth="0.8" />

                      {/* Dimension label */}
                      <text
                        x={midX}
                        y={dimY - 4}
                        textAnchor="middle"
                        fill="#ec4899"
                        fontSize="6.5"
                        fontWeight="black"
                        className="font-mono"
                        transform={shouldMirror ? `scale(-1, 1) translate(${-2 * midX}, 0)` : undefined}
                      >
                        {details.distanceFromInsertion} mm
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </>
        )}

        {/* Naked Humeral Head / Massive Retraction */}
        {details.type === "naked_head" && (
          <>
            {(() => {
              const retractPx = Math.min(90, 40 + (retractDist * 1.5));
              const rightBoundary = 150 - retractPx;
              
              return (
                <g>
                  <path
                    d={`M 0,60 Q 20,62 ${rightBoundary - 15},65 C ${rightBoundary - 5},67 ${rightBoundary},70 ${rightBoundary},80 C ${rightBoundary},88 ${rightBoundary - 5},91 ${rightBoundary - 15},85 C 20,75 10,78 0,80 Z`}
                    fill={tendonFill}
                    stroke={tendonStroke}
                    strokeWidth="2.2"
                  />
                  <path
                    d={`M ${rightBoundary + 15},70 L ${rightBoundary + 5},75 L ${rightBoundary + 15},80`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={rightBoundary + 5}
                    y1="75"
                    x2={rightBoundary + 35}
                    y2="75"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  />

                  <g transform={shouldMirror ? `scale(-1,1) translate(${-300},0)` : undefined}>
                    <rect
                      x="115"
                      y="98"
                      width="50"
                      height="12"
                      rx="3"
                      fill="rgba(239, 68, 68, 0.15)"
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <text
                      x="140"
                      y="106"
                      textAnchor="middle"
                      fill="#ef4444"
                      fontSize="5"
                      fontWeight="black"
                      className="font-mono"
                    >
                      HUELLA DESNUDA
                    </text>
                  </g>
                </g>
              );
            })()}
          </>
        )}
      </g>

      {/* Overlays */}
      <text x="10" y="16" fill={isPrint ? "#020617" : "#a5b4fc"} fontSize="8.5" fontWeight="black" className="font-mono">
        VISTA CORONAL (AP)
      </text>
      <text x="10" y="26" fill={textMuted} fontSize="6.2" className="font-sans">
        {details.type === "none" && "Inserción Humeral Normal"}
        {details.type === "partial" && `Espesor Parcial: ${thicknessPct}% (${details.surface})`}
        {details.type === "full_partial_width" && `Espesor Compl / Ancho Parc`}
        {details.type === "naked_head" && `Huella Desnuda Retraída: ${retractDist}mm`}
      </text>

      <text x="10" y="172" fill={textMuted} fontSize="6.5" className="font-mono">Húmero</text>
      <text x="105" y="152" fill={textMuted} fontSize="6" className="font-mono">Cartílago</text>
    </svg>
  );
};

export const renderSupraspinatusLAT = (
  details: SupraspinatusRuptureDetails,
  isPrint: boolean,
  side: "derecho" | "izquierdo" = "derecho"
) => {
  const isLeft = side === "izquierdo";
  const shouldMirror = side === "derecho";

  // Background colors
  const bgColor = isPrint ? "#ffffff" : "#020617";
  const borderColor = isPrint ? "#e2e8f0" : "#1e293b";
  const boneColor = isPrint ? "#f8fafc" : "#0b0f19";
  const boneStroke = isPrint ? "#94a3b8" : "#334155";
  const tendonFill = isPrint ? "#fce7f3" : "rgba(244, 63, 94, 0.15)";
  const tendonStroke = isPrint ? "#db2777" : "#ec4899";
  const cartilageColor = "#06b6d4";
  const textMuted = isPrint ? "#475569" : "#64748b";

  const apSize = Math.max(1, details.tendonAPSize);
  const rupSize = Math.min(apSize, Math.max(0, details.ruptureAPSize));
  const tearFrac = rupSize / apSize;

  const transformGroup = shouldMirror ? "translate(200, 0) scale(-1, 1)" : undefined;

  return (
    <svg
      id={`supraspinatus-lat-svg${isLeft ? "-left" : ""}`}
      viewBox="0 0 200 200"
      className="w-full max-w-[190px] h-[190px] drop-shadow-md select-none"
      style={{ background: bgColor, borderRadius: "12px", border: `1px solid ${borderColor}` }}
    >
      <g transform={transformGroup}>
        {/* Humeral head circle */}
        <circle
          cx="100"
          cy="110"
          r="48"
          fill={boneColor}
          stroke={boneStroke}
          strokeWidth="1.5"
        />
        {/* Articular cartilage rim */}
        <circle
          cx="100"
          cy="110"
          r="50.5"
          fill="none"
          stroke={cartilageColor}
          strokeWidth="3"
        />

        {/* Biceps Tendon */}
        <circle
          cx="42"
          cy="95"
          r="5.5"
          fill={isPrint ? "#f1f5f9" : "#020617"}
          stroke={isPrint ? "#64748b" : "#818cf8"}
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          fill={isPrint ? "#475569" : "#818cf8"}
          fontSize="5"
          fontWeight="bold"
          transform={shouldMirror ? "translate(42, 97) scale(-1, 1)" : "translate(42, 97)"}
        >
          B
        </text>

        {/* Normal Supraspinatus Dome */}
        {details.type === "none" && (
          <path
            d="M 45,90 A 58,58 0 0,1 155,90 L 145,102 A 46,46 0 0,0 55,102 Z"
            fill={tendonFill}
            stroke={tendonStroke}
            strokeWidth="2"
          />
        )}

        {/* Partial Thickness Tear Dome */}
        {details.type === "partial" && (
          <>
            <path
              d="M 45,90 A 58,58 0 0,1 155,90 L 145,102 A 46,46 0 0,0 55,102 Z"
              fill={tendonFill}
              stroke={tendonStroke}
              strokeWidth="2"
            />
            {(() => {
              const loc = details.location || "anterior";
              if (details.surface === "bursal") {
                if (loc === "anterior") {
                  return (
                    <path
                      d="M 50,81 A 58,58 0 0,1 85,54"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                } else if (loc === "posterior") {
                  return (
                    <path
                      d="M 115,54 A 58,58 0 0,1 150,81"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                } else { // media
                  return (
                    <path
                      d="M 80,56 A 58,58 0 0,1 120,56"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                }
              } else { // articular
                if (loc === "anterior") {
                  return (
                    <path
                      d="M 58,91 A 46,46 0 0,1 90,65"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                } else if (loc === "posterior") {
                  return (
                    <path
                      d="M 110,65 A 46,46 0 0,1 142,91"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                } else { // media
                  return (
                    <path
                      d="M 82,68 A 46,46 0 0,1 118,68"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                    />
                  );
                }
              }
            })()}
          </>
        )}

        {/* Full-Thickness, Partial Width Tear Dome */}
        {details.type === "full_partial_width" && (
          <>
            {(() => {
              const domeW = 110;
              const cutW = domeW * tearFrac;
              
              if (details.location === "anterior") {
                const sliceBoundaryX = 45 + cutW;
                return (
                  <g>
                    <path
                      d={`M ${sliceBoundaryX},76 A 58,58 0 0,1 155,90 L 145,102 A 46,46 0 0,0 ${sliceBoundaryX + 3},86 Z`}
                      fill={tendonFill}
                      stroke={tendonStroke}
                      strokeWidth="2"
                    />
                    <path
                      d={`M 45,90 A 58,58 0 0,1 ${sliceBoundaryX},76 L ${sliceBoundaryX + 3},86 A 46,46 0 0,0 55,102 Z`}
                      fill={isPrint ? "#f8fafc" : "#020617"}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.9"
                    />
                    <path
                      d={`M 45,90 A 58,58 0 0,1 ${sliceBoundaryX},76`}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                  </g>
                );
              } else {
                const sliceBoundaryX = 155 - cutW;
                return (
                  <g>
                    <path
                      d={`M 45,90 A 58,58 0 0,1 ${sliceBoundaryX},76 L ${sliceBoundaryX - 3},86 A 46,46 0 0,0 55,102 Z`}
                      fill={tendonFill}
                      stroke={tendonStroke}
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${sliceBoundaryX},76 A 58,58 0 0,1 155,90 L 145,102 A 46,46 0 0,0 ${sliceBoundaryX - 3},86 Z`}
                      fill={isPrint ? "#f8fafc" : "#020617"}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      opacity="0.9"
                    />
                    <path
                      d={`M ${sliceBoundaryX},76 A 58,58 0 0,1 155,90`}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                  </g>
                );
              }
            })()}
          </>
        )}

        {/* Naked Humeral Head */}
        {details.type === "naked_head" && (
          <g>
            <path
              d="M 45,90 A 58,58 0 0,1 155,90 L 145,102 A 46,46 0 0,0 55,102 Z"
              fill="none"
              stroke={isPrint ? "#cbd5e1" : "#1e293b"}
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.6"
            />
            <circle
              cx="100"
              cy="80"
              r="22"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="2,2"
            />
            <path
              d="M 80,82 L 120,82"
              stroke="#ef4444"
              strokeWidth="2"
            />
            <text
              textAnchor="middle"
              fill="#ef4444"
              fontSize="5.5"
              fontWeight="black"
              className="font-mono"
              transform={shouldMirror ? "translate(100, 74) scale(-1, 1)" : "translate(100, 74)"}
            >
              HUELLA EXPUESTA
            </text>
          </g>
        )}
      </g>

      {/* Title */}
      <text x="10" y="16" fill={isPrint ? "#020617" : "#a5b4fc"} fontSize="8.5" fontWeight="black" className="font-mono">
        VISTA SAGITAL (LAT)
      </text>
      <text x="10" y="26" fill={textMuted} fontSize="6.2" className="font-sans">
        {details.type === "none" && `Ancho Tendón: ${apSize}mm (Intacto)`}
        {details.type === "partial" && `Rotura Parcial ${details.surface === "bursal" ? "Bursal" : "Articular"}: Loc ${details.location === "anterior" ? "Cara Anterior" : details.location === "posterior" ? "Cara Posterior" : "Región Media"}`}
        {details.type === "full_partial_width" && `Rup: ${rupSize} / Tendón: ${apSize} mm AP`}
        {details.type === "naked_head" && `Completo con Retracción`}
      </text>

      <text x="12" y="112" fill={textMuted} fontSize="6" className="font-mono">{shouldMirror ? "POST" : "ANT (Intervalo)"}</text>
      <text x="156" y="112" fill={textMuted} fontSize="6" className="font-mono">{shouldMirror ? "ANT (Intervalo)" : "POST"}</text>
    </svg>
  );
};

