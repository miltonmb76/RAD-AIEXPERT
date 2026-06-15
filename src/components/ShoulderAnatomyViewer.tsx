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
  onChangeDescriptions
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

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("supraspinatus");
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
    if (state === "no_descrito") return "Estructura no mencionada ni descrita detalladamente en el cuerpo del reporte clínico escrito.";
    if (state === "normal") return "Dentro de límites normales.";
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

    setStates(prev => ({
      ...prev,
      [id]: newState
    }));
    // Reset custom description to default on state change
    setCustomDescriptions(prev => ({
      ...prev,
      [id]: ""
    }));
  };

  const handleCustomDescriptionChange = (id: string, text: string) => {
    // Automatically propagate custom finding text edits to the text report
    if (onChangeReport && generatedReport) {
      const nextReportText = updateReportTextWithStructure(id, generatedReport, text);
      setLastSyncedReport(nextReportText);
      onChangeReport(nextReportText);
    }

    setCustomDescriptions(prev => ({
      ...prev,
      [id]: text
    }));
  };

  // Clear all states
  const handleReset = () => {
    setStates({
      supraspinatus: "no_descrito",
      infraspinatus: "no_descrito",
      subscapularis: "no_descrito",
      biceps: "no_descrito",
      bursa: "no_descrito",
      glenohumeral: "no_descrito",
      acromioclavicular: "no_descrito",
      dynamic_assessment: "no_descrito"
    });
    setCustomDescriptions({
      supraspinatus: "",
      infraspinatus: "",
      subscapularis: "",
      biceps: "",
      bursa: "",
      glenohumeral: "",
      acromioclavicular: "",
      dynamic_assessment: ""
    });
    setSyncLogs(["Valores iniciales restablecidos (No mencionado)"]);
  };

  // Get finalized text description for a structure
  const getOutputDescription = (id: string) => {
    if (useOriginalReportText) {
      return customDescriptions[id] || extractDescriptionFromReportText(id, generatedReport) || getDefaultDescription(id, states[id]);
    }
    return customDescriptions[id] || getDefaultDescription(id, states[id]);
  };

  // Helper to ensure clean, capitalized and punctuated simplified findings
  const getSimplifiedDescription = (id: string, forcedState?: string): string => {
    const state = forcedState !== undefined ? forcedState : (states[id] || "no_descrito");
    if (state === "no_descrito") {
      return "No mencionado / No descrito en el reporte.";
    }
    if (state === "normal") {
      return "Dentro de límites normales.";
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

    let count = 1;
    items.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const desc = customDescriptions[item.id]?.trim() || getOutputDescription(item.id);
        txt += `${count}. ${item.label}: ${desc}\n`;
        count++;
      }
    });
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
  const getColorForSVG = (id: string) => {
    const s = states[id];
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
    return { stroke: "#475569", fill: "#1e293b", opacity: 0.7, color: "text-slate-400" };
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
              <svg 
                id="shoulder-anatomy-svg"
              viewBox="0 0 350 350" 
              className="w-full max-w-[320px] h-auto drop-shadow-2xl"
              style={{ maxHeight: "310px" }}
            >
              <defs>
                <linearGradient id="boneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2e3d52" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="clavGrad" x1="0%" y1="0%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#3d4e66" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <pattern id="stripePattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="2.5" />
                </pattern>
              </defs>

              {/* Background structural guidelines - Grid/Circle */}
              <circle cx="175" cy="175" r="150" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
              <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />
              <line x1="20" y1="175" x2="330" y2="175" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

              {/* BONES BLOCK */}
              {/* Scapula Body / Glenoid cavity */}
              <path 
                d="M 60,180 C 60,240 100,280 140,290 C 130,250 120,200 135,170 C 140,160 145,150 142,140 C 135,115 110,110 90,115 C 70,120 60,140 60,180 Z" 
                fill="url(#boneGrad)" 
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
              <text x="94" y="145" fill="#64748b" fontSize="7" fontStyle="italic">Apófisis coracoides</text>

              {/* Humerus Bone */}
              {/* Shaft & Head */}
              <path 
                d="M 155,130 C 160,120 185,110 215,128 C 240,144 245,170 240,195 C 235,210 230,215 220,215 L 210,320 L 175,320 L 175,210 C 165,205 160,200 154,190 C 148,180 148,150 155,130 Z" 
                fill="url(#boneGrad)" 
                stroke="#334155" 
                strokeWidth="2" 
              />
              <text x="180" y="270" fill="#475569" fontSize="8" fontWeight="bold">Húmero</text>

              {/* Clavicle */}
              <path 
                d="M 60,40 C 90,42 120,52 145,45 C 170,38 200,45 210,50 L 210,62 C 195,57 165,48 140,55 C 115,62 85,52 60,50 Z" 
                fill="url(#clavGrad)" 
                stroke="#475569" 
                strokeWidth="1.5" 
              />
              <text x="80" y="35" fill="#64748b" fontSize="7">Clavícula</text>

              {/* Acromion Process */}
              <path 
                d="M 210,50 C 235,52 260,65 260,85 C 260,105 240,115 225,115 L 218,102 C 230,102 242,98 242,88 C 242,75 225,65 210,62 Z" 
                fill="#334155" 
                stroke="#64748b" 
                strokeWidth="1.5" 
              />
              <text x="250" y="58" fill="#64748b" fontSize="7" textAnchor="middle">Acromion</text>


              {/* ACTIVE PATHWAYS / TENDONS CONTROLLERS (MANUAL & DYNAMIC CLICK TO SELECT) */}
              
              {/* 1. Glenohumeral Joint Recess (Derrame) */}
              <g 
                className="cursor-pointer transition-all duration-200 hover:opacity-90"
                onClick={() => setSelectedStructure("glenohumeral")}
                onMouseEnter={() => setActiveHover("glenohumeral")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 146,134 C 158,140 162,175 158,198 C 152,198 148,170 146,134 Z" 
                  fill={getColorForSVG("glenohumeral").fill} 
                  stroke={getColorForSVG("glenohumeral").stroke} 
                  strokeWidth={states.glenohumeral !== "normal" ? "3.5" : "1.5"}
                  fillOpacity={states.glenohumeral !== "normal" ? "0.6" : "0.1"}
                  strokeDasharray={states.glenohumeral === "derrame_leve" ? "3,3" : "none"}
                />
                
                {/* Visual marker label pointer */}
                <line x1="152" y1="165" x2="110" y2="165" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                <circle cx="152" cy="165" r="2" fill="#81a1c1" />
              </g>

              {/* 2. Subscapularis Tendon (Troquín / Anterior) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("subscapularis")}
                onMouseEnter={() => setActiveHover("subscapularis")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Horizontal-ish band wrapping troquín anteriorly */}
                <path 
                  d="M 125,160 C 135,150 165,150 178,162 C 182,165 178,175 168,175 C 150,175 135,170 120,170 Z" 
                  fill={getColorForSVG("subscapularis").fill} 
                  stroke={getColorForSVG("subscapularis").stroke} 
                  strokeWidth={states.subscapularis !== "normal" ? "4.5" : "2"}
                  fillOpacity={getColorForSVG("subscapularis").opacity}
                  strokeDasharray={states.subscapularis === "desgarro_parcial" ? "4,4" : "none"}
                />
                
                {/* Shredding lines for Complete Tear */}
                {states.subscapularis === "desgarro_completo" && (
                  <path d="M 148,152 L 148,172 M 153,153 L 151,171" stroke="#ef4444" strokeWidth="2.5" />
                )}
              </g>

              {/* 3. Biceps Tendon - Long head inside bicipital groove */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("biceps")}
                onMouseEnter={() => setActiveHover("biceps")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Vertical long band from upper head down shoulder */}
                <path 
                  d="M 183,124 C 182,145 186,170 188,195 L 193,285 L 187,285 L 181,195 C 178,170 175,145 178,124 Z" 
                  fill={getColorForSVG("biceps").fill} 
                  stroke={getColorForSVG("biceps").stroke}
                  strokeWidth={states.biceps !== "normal" ? "4" : "1.8"}
                  fillOpacity={getColorForSVG("biceps").opacity}
                  strokeDasharray={states.biceps === "desgarro_parcial" ? "3,3" : "none"}
                />
                
                {/* Deviation for Subluxation */}
                {states.biceps === "subluxacion" && (
                  <path d="M 184,170 C 172,175 165,188 163,195" stroke="#f43f5e" strokeWidth="3" fill="none" strokeDasharray="2,2" />
                )}
              </g>

              {/* 4. Supraspinatus Tendon - Over top head humerus under acromion */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("supraspinatus")}
                onMouseEnter={() => setActiveHover("supraspinatus")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Curved broad band representing the crown tendon */}
                <path 
                  d="M 148,95 C 160,94 185,92 214,104 C 224,108 226,118 220,123 C 205,116 180,111 154,111 C 145,111 142,102 148,95 Z" 
                  fill={getColorForSVG("supraspinatus").fill} 
                  stroke={getColorForSVG("supraspinatus").stroke} 
                  strokeWidth={states.supraspinatus !== "normal" ? "5" : "2"}
                  fillOpacity={getColorForSVG("supraspinatus").opacity}
                  strokeDasharray={states.supraspinatus === "desgarro_parcial" ? "4,4" : "none"}
                />

                {/* Draw gap/rupture visual representation if COMPLETE tear */}
                {states.supraspinatus === "desgarro_completo" && (
                  <g>
                    {/* Broken gap */}
                    <rect x="180" y="93" width="12" height="28" fill="#ef4ef4" opacity="0.1" /> 
                    <line x1="184" y1="92" x2="178" y2="120" stroke="#7f1d1d" strokeWidth="4" />
                    <line x1="196" y1="94" x2="202" y2="122" stroke="#7f1d1d" strokeWidth="4" />
                    <circle cx="190" cy="106" r="4" fill="#ef4444" className="animate-ping" />
                  </g>
                )}
              </g>

              {/* 5. Infraspinatus Tendon - Behind/Adjacent to Supraspinatus */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("infraspinatus")}
                onMouseEnter={() => setActiveHover("infraspinatus")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Angled band slightly posterolateral */}
                <path 
                  d="M 218,124 C 228,124 238,135 240,150 C 242,160 234,166 226,155 C 220,148 215,138 218,124 Z" 
                  fill={getColorForSVG("infraspinatus").fill} 
                  stroke={getColorForSVG("infraspinatus").stroke} 
                  strokeWidth={states.infraspinatus !== "normal" ? "4" : "1.8"}
                  fillOpacity={getColorForSVG("infraspinatus").opacity}
                />
              </g>

              {/* 6. Subacromial-deltoid Bursa (Bursitis fluid) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("bursa")}
                onMouseEnter={() => setActiveHover("bursa")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Thin overarching bubble between acromion and supraspinatus */}
                <path 
                  d="M 155,83 C 170,80 195,80 228,93 C 242,100 244,114 238,122 C 235,114 234,103 222,98 C 196,87 172,87 156,89 Z" 
                  fill={getColorForSVG("bursa").fill} 
                  stroke={getColorForSVG("bursa").stroke} 
                  strokeWidth={states.bursa !== "normal" ? "4" : "1.2"}
                  fillOpacity={states.bursa !== "normal" ? "0.6" : "0.1"}
                  strokeDasharray={states.bursa === "bursitis_leve" ? "3,3" : "none"}
                />

                {/* Fluid drop symbol representing bursitis */}
                {states.bursa !== "normal" && (
                  <circle cx="212" cy="86" r="4.5" fill="#ef4ef4" className="animate-pulse" />
                )}
              </g>

              {/* 7. Acromioclavicular Joint Complex */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("acromioclavicular")}
                onMouseEnter={() => setActiveHover("acromioclavicular")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Small ellipse/joint line between acromion & clavicle */}
                <rect 
                  x="203" 
                  y="46" 
                  width="11" 
                  height="16" 
                  rx="3"
                  fill={getColorForSVG("acromioclavicular").fill} 
                  stroke={getColorForSVG("acromioclavicular").stroke} 
                  strokeWidth={states.acromioclavicular !== "normal" ? "3" : "1.5"}
                  fillOpacity={getColorForSVG("acromioclavicular").opacity}
                />
                
                {/* Spikes/irregularites visual on Artrosis */}
                {states.acromioclavicular === "artrosis" && (
                  <path d="M 201,48 L 205,45 M 216,56 L 212,60" stroke="#f59e0b" strokeWidth="1.5" />
                )}
              </g>

              {/* FLOATING TEXT HOVER LABELS */}
              <g opacity={activeHover ? "1" : "0"} className="transition-opacity duration-150 pointer-events-none">
                <rect x="10" y="310" width="330" height="25" rx="5" fill="#020617" stroke="#334155" strokeWidth="0.8" />
                
                {activeHover === "supraspinatus" && (
                  <text x="175" y="326" fill="#f43f5e" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    TENDÓN SUPRAESPINOSO • {translateState("supraspinatus", states.supraspinatus).toUpperCase()}
                  </text>
                )}
                {activeHover === "infraspinatus" && (
                  <text x="175" y="326" fill="#ec4899" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    TENDÓN INFRAESPINOSO • {translateState("infraspinatus", states.infraspinatus).toUpperCase()}
                  </text>
                )}
                {activeHover === "subscapularis" && (
                  <text x="175" y="326" fill="#14b8a6" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    TENDÓN SUBESCAPULAR • {translateState("subscapularis", states.subscapularis).toUpperCase()}
                  </text>
                )}
                {activeHover === "biceps" && (
                  <text x="175" y="326" fill="#eab308" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    PORCIÓN LARGA DEL BÍCEPS • {translateState("biceps", states.biceps).toUpperCase()}
                  </text>
                )}
                {activeHover === "bursa" && (
                  <text x="175" y="326" fill="#a855f7" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    BURSA SUBACROMIODELTOIDEA • {translateState("bursa", states.bursa).toUpperCase()}
                  </text>
                )}
                {activeHover === "glenohumeral" && (
                  <text x="175" y="326" fill="#3b82f6" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    RECESO GLENOHUMERAL (DERRAME) • {translateState("glenohumeral", states.glenohumeral).toUpperCase()}
                  </text>
                )}
                {activeHover === "acromioclavicular" && (
                  <text x="175" y="326" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
                    ARTICULACIÓN ACROMIOCLAVICULAR • {translateState("acromioclavicular", states.acromioclavicular).toUpperCase()}
                  </text>
                )}
              </g>

              </svg>
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
                ].filter(struct => states[struct.id] !== "no_descrito").map((struct) => {
                  const s = states[struct.id];
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
                  }
                  
                  const isSelected = selectedStructure === struct.id;
                  const shortFinding = getSimplifiedDescription(struct.id);

                  return (
                    <div 
                      key={struct.id}
                      onClick={() => setSelectedStructure(struct.id)}
                      onMouseEnter={() => setActiveHover(struct.id)}
                      onMouseLeave={() => setActiveHover(null)}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-indigo-950/65 border-indigo-500/30 shadow-md scale-[1.01]" 
                          : "bg-slate-950/45 border-slate-850/40 hover:bg-slate-950/80 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-none">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`}></span>
                          <span className={`text-[9.5px] font-black uppercase tracking-wide truncate ${isSelected ? "text-indigo-300 font-bold" : "text-slate-200"}`}>
                            {struct.label}
                          </span>
                        </div>
                        <span className={`text-[7.5px] font-black uppercase px-1 py-0.5 rounded border tracking-wider shrink-0 font-mono ${badgeBg}`}>
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
                      
                      <p className="text-[8px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wide truncate leading-tight">
                        {s === "no_descrito" ? "No descrito / omitido" : shortFinding}
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
              ].filter(struct => states[struct.id] !== "no_descrito").map((struct) => {
                const s = states[struct.id];
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
                  Estado: {translateState(selectedStructure, states[selectedStructure]).toUpperCase()}
                </span>
              </div>

              {/* Status radios/buttons */}
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                {getAvailableStatesForStructure(selectedStructure).map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => handleStateChange(selectedStructure, opt.val)}
                    className={`px-2 py-1.5 text-[8.5px] font-black uppercase text-center rounded border transition-all cursor-pointer ${
                      states[selectedStructure] === opt.val
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-md font-bold"
                        : "bg-slate-950 hover:bg-slate-900 text-slate-450 border-slate-850"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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

            {/* Quick view of states table in brief */}
            <div className="overflow-x-auto max-h-36 bg-slate-900/40 border border-slate-850/60 rounded-xl p-2.5 space-y-1 font-mono text-[9.5px]">
              {Object.entries(states)
                .filter(([_, state]) => state !== "no_descrito")
                .map(([id, state]) => {
                  const stateStr = state as string;
                  return (
                    <div key={id} className="flex items-center justify-between py-1 border-b border-slate-850/30 last:border-0 hover:bg-slate-950/20 px-1 rounded transition-all">
                      <span className="text-slate-200 font-semibold uppercase">{translateStructureLabelInBrief(id)}:</span>
                      <span className={`uppercase font-black ${getColorForSVG(id).color}`}>
                        {translateState(id, stateStr)}
                      </span>
                    </div>
                  );
                })}
              {Object.values(states).every(state => state === "no_descrito") && (
                <div className="text-slate-500 italic text-center py-2">
                  Ninguna estructura descrita en el reporte.
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
