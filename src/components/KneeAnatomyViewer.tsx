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
  includeGonartrosis?: boolean;
  setIncludeGonartrosis?: (val: boolean) => void;
  onChangeStates?: (states: Record<string, string>) => void;
  onChangeDescriptions?: (descriptions: Record<string, string>) => void;
  selectedModel?: string;
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
  includeGonartrosis: propIncludeGonartrosis = false,
  setIncludeGonartrosis,
  onChangeStates,
  onChangeDescriptions,
  selectedModel,
  externalStates,
  externalDescriptions,
  additionalFindings = [],
  laterality = "Derecho",
  externalStatesLeft,
  externalDescriptionsLeft,
  onChangeStatesLeft,
  onChangeDescriptionsLeft
}: KneeAnatomyViewerProps) {
  
  const [localIncludeGonartrosis, setLocalIncludeGonartrosis] = useState<boolean>(false);
  const includeGonartrosis = propIncludeGonartrosis !== undefined ? propIncludeGonartrosis : localIncludeGonartrosis;

  // States of each structure:
  // - quadriceps: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - patellar: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - lcm: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - lce: normal | esguince_leve | desgarro_parcial | desgarro_completo
  // - medial_meniscus: normal | meniscosis | rotura
  // - lateral_meniscus: normal | meniscosis | rotura
  // - joint_effusion: normal | derrame_leve | derrame_moderado
  // - baker_cyst: normal | quiste_leve | quiste_severo
  // - popliteal_artery: normal | ectasia | ateromatosis | aneurisma
  // - popliteal_vein: normal | trombosis | ectasia | permisibilidad_reducida
  // - distal_tendons: normal | tendinosis | desgarro_parcial | desgarro_completo
  // - popliteal_fossa: normal | coleccion | adenopatia
  const [states, setStates] = useState<Record<string, string>>({
    quadriceps: "no_descrito",
    patellar: "no_descrito",
    lcm: "no_descrito",
    lce: "no_descrito",
    medial_meniscus: "no_descrito",
    lateral_meniscus: "no_descrito",
    joint_effusion: "no_descrito",
    baker_cyst: "no_descrito",
    popliteal_artery: "no_descrito",
    popliteal_vein: "no_descrito",
    distal_tendons: "no_descrito",
    popliteal_fossa: "no_descrito",
    gon_pinzamiento_artic: "no_descrito",
    gon_osteofitos: "no_descrito",
    gon_esclerosis_sub: "no_descrito",
    gon_geodas_quistes: "no_descrito",
    gon_desgaste_cartilago: "no_descrito",
    gon_menisco_deg: "no_descrito"
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
    baker_cyst: "",
    popliteal_artery: "",
    popliteal_vein: "",
    distal_tendons: "",
    popliteal_fossa: "",
    gon_pinzamiento_artic: "",
    gon_osteofitos: "",
    gon_esclerosis_sub: "",
    gon_geodas_quistes: "",
    gon_desgaste_cartilago: "",
    gon_menisco_deg: ""
  });

  const [activeTab, setActiveTab] = useState<"anterior" | "posterior">("anterior");
  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("quadriceps");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [useOriginalReportText, setUseOriginalReportText] = useState<boolean>(true);

  // Left-side states and custom descriptions for Bilateral studies
  const [statesLeft, setStatesLeft] = useState<Record<string, string>>({
    quadriceps: "no_descrito",
    patellar: "no_descrito",
    lcm: "no_descrito",
    lce: "no_descrito",
    medial_meniscus: "no_descrito",
    lateral_meniscus: "no_descrito",
    joint_effusion: "no_descrito",
    baker_cyst: "no_descrito",
    popliteal_artery: "no_descrito",
    popliteal_vein: "no_descrito",
    distal_tendons: "no_descrito",
    popliteal_fossa: "no_descrito",
    gon_pinzamiento_artic: "no_descrito",
    gon_osteofitos: "no_descrito",
    gon_esclerosis_sub: "no_descrito",
    gon_geodas_quistes: "no_descrito",
    gon_desgaste_cartilago: "no_descrito",
    gon_menisco_deg: "no_descrito"
  });

  const [customDescriptionsLeft, setCustomDescriptionsLeft] = useState<Record<string, string>>({
    quadriceps: "",
    patellar: "",
    lcm: "",
    lce: "",
    medial_meniscus: "",
    lateral_meniscus: "",
    joint_effusion: "",
    baker_cyst: "",
    popliteal_artery: "",
    popliteal_vein: "",
    distal_tendons: "",
    popliteal_fossa: "",
    gon_pinzamiento_artic: "",
    gon_osteofitos: "",
    gon_esclerosis_sub: "",
    gon_geodas_quistes: "",
    gon_desgaste_cartilago: "",
    gon_menisco_deg: ""
  });

  const [activeSide, setActiveSide] = useState<"derecho" | "izquierdo">("derecho");

  const activeSts = laterality === "Bilateral" && activeSide === "izquierdo" ? statesLeft : states;
  const activeDescs = laterality === "Bilateral" && activeSide === "izquierdo" ? customDescriptionsLeft : customDescriptions;

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

  // Synchronize left-side props with statesLeft
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

  // Synchronize left-side states to parent
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
      case "popliteal_artery":
        return ["arteria poplitea", "arteria poplítea", "a. poplitea", "luz arterial poplitea"];
      case "popliteal_vein":
        return ["vena poplitea", "vena poplítea", "v. poplitea", "permeabilidad venosa poplitea", "trombosis venosa poplitea"];
      case "distal_tendons":
        return ["tendones distales", "tendon semitendinoso", "semimembranoso", "biceps femoral distal", "semitendinoso distal", "semimembranoso distal", "biceps distal"];
      case "popliteal_fossa":
        return ["fosa poplitea", "fosa poplítea", "hueco popliteo", "hueco poplíteo", "quiste popliteo"];
      case "gon_pinzamiento_artic":
        return ["pinzamiento", "estrechamiento del espacio", "disminución del espacio articular", "pinzamiento articular", "estrechamiento femorotibial", "pinzamiento femorotibial"];
      case "gon_osteofitos":
        return ["osteofito", "osteofitos", "osteofitosis", "osteofito marginal", "picos de loro"];
      case "gon_esclerosis_sub":
        return ["esclerosis subcondral", "esclerosis ósea", "esclerosis osea", "osteoesclerosis"];
      case "gon_geodas_quistes":
        return ["geoda", "geodas", "quistes subcondrales", "quiste subcondral", "quiste de presión"];
      case "gon_desgaste_cartilago":
        return ["adelgazamiento del cartílago", "desgaste de cartílago", "desgaste cartilaginoso", "condropatía", "condropatia", "lesión de cartílago", "cartilago"];
      case "gon_menisco_deg":
        return ["menisco degenerado", "meniscosis avanzada", "extrusion meniscal", "extrusión meniscal", "menisco extruido"];
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

      case "gon_pinzamiento_artic":
      case "gon_osteofitos":
      case "gon_esclerosis_sub":
      case "gon_geodas_quistes":
      case "gon_desgaste_cartilago":
      case "gon_menisco_deg": {
        const keywordsMap: Record<string, string[]> = {
          gon_pinzamiento_artic: ["pinzamiento", "estrechamiento del espacio", "disminución del espacio articular", "pinzamiento articular", "estrechamiento femorotibial", "pinzamiento femorotibial"],
          gon_osteofitos: ["osteofito", "osteofitos", "osteofitosis", "osteofito marginal", "picos de loro"],
          gon_esclerosis_sub: ["esclerosis subcondral", "esclerosis ósea", "esclerosis osea", "osteoesclerosis"],
          gon_geodas_quistes: ["geoda", "geodas", "quistes subcondrales", "quiste subcondral", "quiste de presión"],
          gon_desgaste_cartilago: ["adelgazamiento del cartílago", "desgaste de cartílago", "desgaste cartilaginoso", "condropatía", "condropatia", "lesión de cartílago", "cartilago"],
          gon_menisco_deg: ["menisco degenerado", "meniscosis avanzada", "extrusion meniscal", "extrusión meniscal", "menisco extruido"]
        };
        const kws = keywordsMap[id] || [];
        const severeKws = ["grande", "voluminoso", "severo", "complicado", "marcado", "avanzado", "grave", "pronunciado", "grado iv", "grado 4"];
        const moderateKws = ["moderado", "franco", "evidente", "significativo", "grado ii", "grado iii", "grado 2", "grado 3"];

        if (hasPathology(kws)) {
          const isSevere = severeKws.some(skw => lower.includes(skw));
          if (isSevere) return "severo";
          const isModerate = moderateKws.some(mkw => lower.includes(mkw));
          if (isModerate) return "moderado";
          return "leve";
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
      case "quadriceps": return "Tendón Cuadricipital";
      case "patellar": return "Tendón Rotuliano";
      case "lcm": return "Ligamento Colateral Medial";
      case "lce": return "Ligamento Colateral Lateral";
      case "medial_meniscus": return "Menisco Medial";
      case "lateral_meniscus": return "Menisco Lateral";
      case "joint_effusion": return "Derrame Articular";
      case "baker_cyst": return "Quiste de Baker";
      case "popliteal_artery": return "Arteria Poplítea";
      case "popliteal_vein": return "Vena Poplítea";
      case "distal_tendons": return "Tendones Distales del Muslo";
      case "popliteal_fossa": return "Fosa Poplítea";
      case "gon_pinzamiento_artic": return "Pinzamiento Articular";
      case "gon_osteofitos": return "Osteofitos Marginales";
      case "gon_esclerosis_sub": return "Esclerosis Subcondral";
      case "gon_geodas_quistes": return "Geodas o Quistes Subcondrales";
      case "gon_desgaste_cartilago": return "Desgaste de Cartílago";
      case "gon_menisco_deg": return "Degeneración/Extrusión Meniscal";
      default: return id;
    }
  };

  const runLocalHeuristics = (logs: string[]) => {
    const updatedStates: Record<string, string> = { ...states };
    const updatedDescriptions: Record<string, string> = { ...customDescriptions };

    const structureKeys = [
      "quadriceps", "patellar", "lcm", "lce", "medial_meniscus", "lateral_meniscus", "joint_effusion", "baker_cyst",
      "popliteal_artery", "popliteal_vein", "distal_tendons", "popliteal_fossa",
      "gon_pinzamiento_artic", "gon_osteofitos", "gon_esclerosis_sub", "gon_geodas_quistes", "gon_desgaste_cartilago", "gon_menisco_deg"
    ];
    
    let parsedCount = 0;
    let foundPathologies = 0;
    let hasGonartrosisFindings = false;

    structureKeys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => generatedReport.toLowerCase().includes(kw));

      if (isMentioned) {
        const extractedFindings = extractDescriptionFromReportText(id, generatedReport);
        const parsedState = parseStateFromText(id, extractedFindings || "");
        
        updatedStates[id] = parsedState;
        updatedDescriptions[id] = extractedFindings || "";
        
        parsedCount++;
        if (parsedState !== "normal" && parsedState !== "no_descrito") {
          foundPathologies++;
          if (id.startsWith("gon_")) {
            hasGonartrosisFindings = true;
          }
        }
        logs.push(`[Sincronización Local] ${translateStructureLabelInBrief(id)}: ${parsedState.toUpperCase()}`);
      } else {
        updatedStates[id] = "no_descrito";
        updatedDescriptions[id] = "";
      }
    });

    if (hasGonartrosisFindings && setIncludeGonartrosis) {
      setIncludeGonartrosis(true);
    }

    setStates(updatedStates);
    setCustomDescriptions(updatedDescriptions);
    if (laterality === "Bilateral") {
      setStatesLeft(updatedStates);
      setCustomDescriptionsLeft(updatedDescriptions);
    }
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
      },
      {
        id: "popliteal_artery",
        label: "Arteria Poplítea",
        allowedStates: ["no_descrito", "normal", "ectasia", "ateromatosis", "aneurisma"]
      },
      {
        id: "popliteal_vein",
        label: "Vena Poplítea",
        allowedStates: ["no_descrito", "normal", "trombosis", "ectasia", "permisibilidad_reducida"]
      },
      {
        id: "distal_tendons",
        label: "Tendones Distales del Muslo",
        allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"]
      },
      {
        id: "popliteal_fossa",
        label: "Fosa Poplítea",
        allowedStates: ["no_descrito", "normal", "coleccion", "adenopatia"]
      },
      {
        id: "gon_pinzamiento_artic",
        label: "Pinzamiento Articular",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      },
      {
        id: "gon_osteofitos",
        label: "Osteofitos Marginales",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      },
      {
        id: "gon_esclerosis_sub",
        label: "Esclerosis Subcondral",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      },
      {
        id: "gon_geodas_quistes",
        label: "Geodas o Quistes Subcondrales",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      },
      {
        id: "gon_desgaste_cartilago",
        label: "Desgaste de Cartílago",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      },
      {
        id: "gon_menisco_deg",
        label: "Degeneración/Extrusión Meniscal",
        allowedStates: ["no_descrito", "normal", "leve", "moderado", "severo"]
      }
    ];

    let hasGonartrosisFindings = false;

    if (laterality === "Bilateral") {
      logs.push("Estudio Bilateral detectado en Rodilla. Analizando LADO DERECHO...");
      try {
        const responseD = await fetch("/api/analyze-anatomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel || "gemini-3.5-flash",
            reportText: generatedReport,
            studyType: "Rodilla",
            structures: structures,
            side: "Derecho"
          })
        });

        const dataD = await responseD.json();
        if (dataD.success && dataD.states && dataD.descriptions) {
          const finalStatesD = { ...states };
          const finalDescriptionsD = { ...customDescriptions };

          structures.forEach(struc => {
            const apiState = dataD.states[struc.id] || "no_descrito";
            const apiDesc = dataD.descriptions[struc.id] || "No mencionado / No descrito.";
            finalStatesD[struc.id] = apiState;
            finalDescriptionsD[struc.id] = apiDesc;
            if (apiState !== "no_descrito") {
              logs.push(`[Derecho - ${struc.label}]: ${apiState.toUpperCase()}`);
              if (struc.id.startsWith("gon_") && apiState !== "normal" && apiState !== "no_descrito") {
                hasGonartrosisFindings = true;
              }
            }
          });

          setStates(finalStatesD);
          setCustomDescriptions(finalDescriptionsD);
        }
      } catch (err: any) {
        logs.push(`Error analizando lado derecho: ${err.message || String(err)}`);
      }

      logs.push("Analizando LADO IZQUIERDO...");
      try {
        const responseI = await fetch("/api/analyze-anatomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel || "gemini-3.5-flash",
            reportText: generatedReport,
            studyType: "Rodilla",
            structures: structures,
            side: "Izquierdo"
          })
        });

        const dataI = await responseI.json();
        if (dataI.success && dataI.states && dataI.descriptions) {
          const finalStatesI = { ...statesLeft };
          const finalDescriptionsI = { ...customDescriptionsLeft };

          structures.forEach(struc => {
            const apiState = dataI.states[struc.id] || "no_descrito";
            const apiDesc = dataI.descriptions[struc.id] || "No mencionado / No descrito.";
            finalStatesI[struc.id] = apiState;
            finalDescriptionsI[struc.id] = apiDesc;
            if (apiState !== "no_descrito") {
              logs.push(`[Izquierdo - ${struc.label}]: ${apiState.toUpperCase()}`);
              if (struc.id.startsWith("gon_") && apiState !== "normal" && apiState !== "no_descrito") {
                hasGonartrosisFindings = true;
              }
            }
          });

          setStatesLeft(finalStatesI);
          setCustomDescriptionsLeft(finalDescriptionsI);
        }
      } catch (err: any) {
        logs.push(`Error analizando lado izquierdo: ${err.message || String(err)}`);
      }

      if (hasGonartrosisFindings && setIncludeGonartrosis) {
        setIncludeGonartrosis(true);
      }

      setIsSyncing(false);
      setSyncLogs(prev => [...prev, ...logs]);
      setLastSyncedReport(generatedReport);
      return;
    }

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
            if (struc.id.startsWith("gon_")) {
              hasGonartrosisFindings = true;
            }
          }
          if (apiState !== "no_descrito") {
            logs.push(`[Hallazgo] ${struc.label}: ${apiState.toUpperCase()} \n  ↳ ${apiDesc}`);
          }
        });

        if (hasGonartrosisFindings && setIncludeGonartrosis) {
          setIncludeGonartrosis(true);
        }

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con IA. Sincronizadas ${parsedCount} estructuras (${foundPathologies} patologías detectadas).`);
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
    if (laterality === "Bilateral" && activeSide === "izquierdo") {
      setStatesLeft(prev => {
        const next = { ...prev, [id]: nextState };
        setSyncLogs(log => [...log, `Cambio manual en [Izquierdo] ${translateStructureLabelInBrief(id)} -> ${nextState.toUpperCase()}`]);
        return next;
      });
    } else {
      setStates(prev => {
        const next = { ...prev, [id]: nextState };
        setSyncLogs(log => [...log, `Cambio manual en El Derecho ${translateStructureLabelInBrief(id)} -> ${nextState.toUpperCase()}`]);
        return next;
      });
    }
  };

  const handleUpdateCustomDescription = (id: string, text: string) => {
    if (laterality === "Bilateral" && activeSide === "izquierdo") {
      setCustomDescriptionsLeft(prev => ({ ...prev, [id]: text }));
    } else {
      setCustomDescriptions(prev => ({ ...prev, [id]: text }));
    }
  };

  const getDefaultDescription = (id: string, state: string): string => {
    if (!state || state === "no_descrito") return "Estructura no descrita.";
    if (state === "normal") return "Dentro de límites normales.";
    const standardStates = [
      "normal", "no_descrito", "tendinosis", "desgarro_parcial", "desgarro_completo", "esguince_leve",
      "meniscosis", "rotura", "derrame_leve", "derrame_moderado", "quiste_leve", "quiste_severo",
      "ectasia", "ateromatosis", "aneurisma", "trombosis", "permisibilidad_reducida", "coleccion", "adenopatia",
      "leve", "moderado", "severo"
    ];
    if (!standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
    }

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
      case "popliteal_artery":
        if (state === "ectasia") return "Dilatación focal leve del calibre de la arteria poplítea sin evidencia de trombo mural.";
        if (state === "ateromatosis") return "Presencia de placas de ateroma calcificadas/blandas en la pared de la arteria poplítea con flujo conservado.";
        if (state === "aneurisma") return "Focalización aneurismática mayor de 2cm con riesgo tromboembólico en fosa poplítea.";
        break;
      case "popliteal_vein":
        if (state === "trombosis") return "Defecto de llenado intraluminal completo con ausencia de señal Doppler e incompresibilidad venosa poplítea.";
        if (state === "ectasia") return "Dilatación pasiva del vaso venoso poplíteo con conservación de válvulas y flujo fásico lento.";
        if (state === "permisibilidad_reducida") return "Compresión extrínseca o estrechamiento intraluminal parcial con flujo Doppler amortiguado.";
        break;
      case "distal_tendons":
        if (state === "tendinosis") return "Engrosamiento e hipoecogenicidad insercional de los tendones distales de la corva.";
        if (state === "desgarro_parcial") return "Pérdida focal de patrón fibrilar con colección fluida laminar peritendinosa.";
        if (state === "desgarro_completo") return "Ruptura insercional distal completa del bíceps femoral / semitendinoso.";
        break;
      case "popliteal_fossa":
        if (state === "coleccion") return "Colección hipoecoica/anecoica organizada en los planos grasos profundos de la fosa poplítea.";
        if (state === "adenopatia") return "Presencia de ganglios linfáticos aumentados de tamaño con pérdida de hilio graso fisiológico.";
        break;
      case "gon_pinzamiento_artic":
        if (state === "leve") return "Estrechamiento focal leve del espacio articular femorotibial.";
        if (state === "moderado") return "Disminución moderada y asimétrica del espacio femorotibial con pinzamiento articular evidente.";
        if (state === "severo") return "Pinzamiento articular severo con colapso del espacio articular y contacto óseo directo.";
        break;
      case "gon_osteofitos":
        if (state === "leve") return "Pequeñas excrecencias óseas marginales (osteofitos) en los márgenes de los cóndilos femorales.";
        if (state === "moderado") return "Osteofitos marginales francos y definidos en las superficies articulares de fémur, tibia y rótula.";
        if (state === "severo") return "Osteofitosis marginal voluminosa y severa que limita parcialmente el rango de movilidad articular.";
        break;
      case "gon_esclerosis_sub":
        if (state === "leve") return "Discreto aumento de la ecogenicidad / densidad ósea subcondral en zonas de carga tibial.";
        if (state === "moderado") return "Esclerosis ósea subcondral moderada y bien delimitada en el platillo tibial medial.";
        if (state === "severo") return "Esclerosis ósea subcondral severa y extensa con remodelamiento de la superficie articular.";
        break;
      case "gon_geodas_quistes":
        if (state === "leve") return "Pequeñas geodas subcondrales incipientes en fémur o tibia medial.";
        if (state === "moderado") return "Presencia de quistes subcondrales de presión de tamaño moderado adyacentes a la esclerosis.";
        if (state === "severo") return "Geodas / quistes de presión subcondrales voluminosos y confluentes que debilitan el soporte óseo subcondral.";
        break;
      case "gon_desgaste_cartilago":
        if (state === "leve") return "Adelgazamiento leve del cartílago hialino de los cóndilos femorales con conservación de su regularidad.";
        if (state === "moderado") return "Condropatía moderada con adelgazamiento focal significativo y pérdida de la ecogenicidad normal del cartílago.";
        if (state === "severo") return "Pérdida completa de espesor del cartílago articular (condropatía grado IV) con hueso subcondral expuesto.";
        break;
      case "gon_menisco_deg":
        if (state === "leve") return "Cambios degenerativos intrasustancia leves en el cuerno posterior del menisco medial.";
        if (state === "moderado") return "Meniscosis moderada con extrusión meniscal lateral/medial discreta (desplazamiento < 3mm).";
        if (state === "severo") return "Degeneración meniscal severa con extrusión meniscal franca y pérdida completa de su función amortiguadora.";
        break;
    }
    return "Alteración estructural.";
  };

  const getSimplifiedDescription = (id: string, forcedState?: string): string => {
    const state = forcedState !== undefined ? forcedState : (activeSts[id] || "no_descrito");
    if (state === "no_descrito") {
      return "No mencionado / No descrito en el reporte.";
    }
    if (state === "normal") {
      return "Dentro de límites normales.";
    }

    const standardStates = [
      "normal", "no_descrito", "tendinosis", "desgarro_parcial", "desgarro_completo", "esguince_leve",
      "meniscosis", "rotura", "derrame_leve", "derrame_moderado", "quiste_leve", "quiste_severo",
      "ectasia", "ateromatosis", "aneurisma", "trombosis", "permisibilidad_reducida", "coleccion", "adenopatia",
      "leve", "moderado", "severo"
    ];
    if (state && !standardStates.includes(state)) {
      return `Se describe hallazgo: ${state.charAt(0).toUpperCase() + state.slice(1)}.`;
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

      case "popliteal_artery":
        if (state === "ectasia") return "Dilatación leve de la arteria poplítea.";
        if (state === "ateromatosis") return "Ateromatosis parietal en la arteria poplítea sin estenosis hemodinámica.";
        if (state === "aneurisma") return "Aneurisma fusiforme de la arteria poplítea.";
        break;

      case "popliteal_vein":
        if (state === "trombosis") return "Trombosis venosa profunda (TVP) en vena poplítea con incompresibilidad de la luz.";
        if (state === "ectasia") return "Ectasia pasiva / dilatación venosa poplítea.";
        if (state === "permisibilidad_reducida") return "Flujo venoso poplíteo disminuido por compresión o parcial alteración intraluminal.";
        break;

      case "distal_tendons":
        if (state === "tendinosis") return "Tendinosis/tendinopatía de la inserción distal de los isquiotibiales.";
        if (state === "desgarro_parcial") return "Desgarro de espesor parcial proximal/de la unión de tendones isquiotibiales distales.";
        if (state === "desgarro_completo") return "Desgarro completo y ruptura insercional del tendón del semimembranoso / bíceps distal.";
        break;

      case "popliteal_fossa":
        if (state === "coleccion") return "Colección líquida inflamatoria organizada en la fosa poplítea.";
        if (state === "adenopatia") return "Ganglio linfático / adenopatía reactiva en fosa poplítea.";
        break;
      case "gon_pinzamiento_artic":
        if (state === "leve") return "Pinzamiento articular leve.";
        if (state === "moderado") return "Pinzamiento femorotibial moderado.";
        if (state === "severo") return "Pinzamiento femorotibial severo / colapso articular.";
        break;
      case "gon_osteofitos":
        if (state === "leve") return "Osteofitos marginales leves.";
        if (state === "moderado") return "Osteofitosis moderada femorotibial/femororotuliana.";
        if (state === "severo") return "Osteofitosis severa / voluminosa.";
        break;
      case "gon_esclerosis_sub":
        if (state === "leve") return "Esclerosis subcondral leve.";
        if (state === "moderado") return "Esclerosis ósea subcondral franca.";
        if (state === "severo") return "Esclerosis subcondral severa.";
        break;
      case "gon_geodas_quistes":
        if (state === "leve") return "Geodas subcondrales incipientes.";
        if (state === "moderado") return "Quistes subcondrales moderados.";
        if (state === "severo") return "Geodas subcondrales voluminosas / confluentes.";
        break;
      case "gon_desgaste_cartilago":
        if (state === "leve") return "Adelgazamiento cartilaginoso leve.";
        if (state === "moderado") return "Condropatía / desgaste cartilaginoso moderado.";
        if (state === "severo") return "Desgaste severo del cartílago con exposición ósea.";
        break;
      case "gon_menisco_deg":
        if (state === "leve") return "Meniscosis leve degenerativa.";
        if (state === "moderado") return "Meniscosis moderada con extrusión leve.";
        if (state === "severo") return "Degeneración y extrusión meniscal severa asociada a artrosis.";
        break;
    }

    // Fallback block if any other custom description exists, we capitalize and clean it
    const rawDesc = activeDescs[id];
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

  const getColorForSVGOuter = (id: string, side?: "derecho" | "izquierdo") => {
    const sideSts = laterality === "Bilateral" && (side || activeSide) === "izquierdo" ? statesLeft : states;
    const s = sideSts[id] || "no_descrito";
    
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
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve" || s === "leve") {
      return {
        fill: activeHover === id ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.25)",
        stroke: "#f59e0b"
      };
    }
    if (s === "desgarro_parcial" || s === "moderado") {
      return {
        fill: activeHover === id ? "rgba(236, 72, 153, 0.55)" : "rgba(236, 72, 153, 0.28)",
        stroke: "#ec4899"
      };
    }
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo" || s === "severo") {
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

  // Compile 2-Column Markdown table for inclusion in active reports
  const generateTableMarkdown = () => {
    let md = "| Estructura | Lado | Hallazgos |\n";
    md += "| :--- | :---| :--- |\n";

    const rows = [
      { id: "quadriceps", label: "Tendón Cuadricipital" },
      { id: "patellar", label: "Tendón Rotuliano" },
      { id: "lcm", label: "Lig. Colateral Medial" },
      { id: "lce", label: "Lig. Colateral Lateral" },
      { id: "medial_meniscus", label: "Menisco Medial" },
      { id: "lateral_meniscus", label: "Menisco Lateral" },
      { id: "joint_effusion", label: "Derrame Articular" },
      { id: "baker_cyst", label: "Quiste de Baker" },
      { id: "popliteal_artery", label: "Arteria Poplítea" },
      { id: "popliteal_vein", label: "Vena Poplítea" },
      { id: "distal_tendons", label: "Tendones Distales" },
      { id: "popliteal_fossa", label: "Fosa Poplítea" }
    ];

    if (includeGonartrosis) {
      rows.push(
        { id: "gon_pinzamiento_artic", label: "Pinzamiento Articular" },
        { id: "gon_osteofitos", label: "Osteofitos Marginales" },
        { id: "gon_esclerosis_sub", label: "Esclerosis Subcondral" },
        { id: "gon_geodas_quistes", label: "Geodas / Quistes" },
        { id: "gon_desgaste_cartilago", label: "Desgaste de Cartílago" },
        { id: "gon_menisco_deg", label: "Menisco Degenerativo/Extruido" }
      );
    }

    let hasRows = false;
    if (laterality === "Bilateral") {
      rows.forEach(row => {
        if (states[row.id] !== "no_descrito" && states[row.id] !== "normal") {
          const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id, states[row.id]);
          md += `| **${row.label}** | Derecho | ${desc} |\n`;
          hasRows = true;
        }
      });
      rows.forEach(row => {
        if (statesLeft[row.id] !== "no_descrito" && statesLeft[row.id] !== "normal") {
          const desc = customDescriptionsLeft[row.id]?.trim() || getSimplifiedDescription(row.id, statesLeft[row.id]);
          md += `| **${row.label}** | Izquierdo | ${desc} |\n`;
          hasRows = true;
        }
      });
    } else {
      rows.forEach(row => {
        if (states[row.id] !== "no_descrito" && states[row.id] !== "normal") {
          const desc = customDescriptions[row.id]?.trim() || getSimplifiedDescription(row.id, states[row.id]);
          md += `| **${row.label}** | - | ${desc} |\n`;
          hasRows = true;
        }
      });
    }

    if (!hasRows) {
      md = "| Estructura | Hallazgos |\n| :--- | :--- |\n| *Sin hallazgos patológicos* | *Todas las estructuras de la rodilla se reportan de características normales.* |\n";
    }

    return md;
  };

  const generateNarrativeText = () => {
    const list = [
      { id: "quadriceps", label: "Tendón Cuadricipital" },
      { id: "patellar", label: "Tendón Rotuliano" },
      { id: "lcm", label: "Ligamento Colateral Medial" },
      { id: "lce", label: "Ligamento Colateral Lateral" },
      { id: "medial_meniscus", label: "Menisco Medial" },
      { id: "lateral_meniscus", label: "Menisco Lateral" },
      { id: "joint_effusion", label: "Derrame Articular" },
      { id: "baker_cyst", label: "Quiste de Baker" },
      { id: "popliteal_artery", label: "Arteria Poplítea" },
      { id: "popliteal_vein", label: "Vena Poplítea" },
      { id: "distal_tendons", label: "Tendones Distales" },
      { id: "popliteal_fossa", label: "Fosa Poplítea" }
    ];

    if (includeGonartrosis) {
      list.push(
        { id: "gon_pinzamiento_artic", label: "Pinzamiento Articular" },
        { id: "gon_osteofitos", label: "Osteofitos Marginales" },
        { id: "gon_esclerosis_sub", label: "Esclerosis Subcondral" },
        { id: "gon_geodas_quistes", label: "Geodas o Quistes" },
        { id: "gon_desgaste_cartilago", label: "Desgaste de Cartílago" },
        { id: "gon_menisco_deg", label: "Menisco Degenerativo/Extruido" }
      );
    }

    let md = "";
    if (laterality === "Bilateral") {
      md += "##### LADO DERECHO:\n";
      let hasD = false;
      list.forEach(item => {
        if (states[item.id] !== "no_descrito") {
          const statusText = states[item.id] === "normal" ? "Normal" : "Alterado/Lesión";
          const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id, states[item.id]);
          md += `* **${item.label}** [${statusText.toUpperCase()}]: ${desc}\n`;
          hasD = true;
        }
      });
      if (!hasD) md += "* Sin anomalías descritas.\n";

      md += "\n##### LADO IZQUIERDO:\n";
      let hasI = false;
      list.forEach(item => {
        if (statesLeft[item.id] !== "no_descrito") {
          const statusText = statesLeft[item.id] === "normal" ? "Normal" : "Alterado/Lesión";
          const desc = customDescriptionsLeft[item.id]?.trim() || getSimplifiedDescription(item.id, statesLeft[item.id]);
          md += `* **${item.label}** [${statusText.toUpperCase()}]: ${desc}\n`;
          hasI = true;
        }
      });
      if (!hasI) md += "* Sin anomalías descritas.\n";
    } else {
      list.forEach(item => {
        if (states[item.id] !== "no_descrito") {
          const statusText = states[item.id] === "normal" ? "Normal" : "Alterado/Lesión";
          const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id, states[item.id]);
          md += `* **${item.label}** [${statusText.toUpperCase()}]: ${desc}\n`;
        }
      });
    }

    if (!md) {
      md = "* *No se han configurado hallazgos o anatomía específica.*";
    }

    return md;
  };

  const getSeverityBadge = (s: string) => {
    if (s === "no_descrito") return "bg-slate-900 text-slate-500 border-slate-850";
    if (s === "normal") return "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve" || s === "ectasia" || s === "ateromatosis") {
      return "bg-amber-950/40 text-amber-500 border-amber-900/40";
    }
    if (s === "desgarro_parcial" || s === "permisibilidad_reducida" || s === "coleccion" || s === "adenopatia") return "bg-pink-950/40 text-pink-500 border-pink-900/40";
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo" || s === "trombosis" || s === "aneurisma") {
      return "bg-rose-950/50 text-rose-500 border-rose-900/50";
    }
    return "bg-slate-900 text-slate-400 border-slate-800";
  };

  const getClinicalImpact = (s: string) => {
    if (s === "no_descrito") return "Presencia no especificada.";
    if (s === "normal") return "Sin impacto clínico";
    if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve" || s === "ectasia" || s === "ateromatosis") return "Leve / Moderado";
    if (s === "desgarro_parcial" || s === "permisibilidad_reducida" || s === "coleccion" || s === "adenopatia") return "Significativo";
    if (s === "desgarro_completo" || s === "rotura" || s === "derrame_moderado" || s === "quiste_severo" || s === "trombosis" || s === "aneurisma") return "Severo / Clínicamente Crítico";
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
        baker_cyst: "no_descrito",
        popliteal_artery: "no_descrito",
        popliteal_vein: "no_descrito",
        distal_tendons: "no_descrito",
        popliteal_fossa: "no_descrito"
      });
      setCustomDescriptions({
        quadriceps: "",
        patellar: "",
        lcm: "",
        lce: "",
        medial_meniscus: "",
        lateral_meniscus: "",
        joint_effusion: "",
        baker_cyst: "",
        popliteal_artery: "",
        popliteal_vein: "",
        distal_tendons: "",
        popliteal_fossa: ""
      });
      setSyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: Restablecidos todos los mapeos de rodilla`]);
    }
  };

  const renderKneeSvg = (side: "derecho" | "izquierdo", tab: "anterior" | "posterior") => {
    const isIzqui = side === "izquierdo";
    const localStates = laterality === "Bilateral" && side === "izquierdo" ? statesLeft : states;
    const getColorForSVG = (id: string) => getColorForSVGOuter(id, side);

    const renderWithContext = (states: any) => {
      if (tab === "anterior") {
        return (
        <svg 
          id={isIzqui ? "knee-anatomy-svg-left" : "knee-anatomy-svg"}
          viewBox="0 0 350 350" 
          className="w-full max-w-[300px] h-auto drop-shadow-2xl mx-auto"
          style={{ maxHeight: "310px" }}
        >
          <defs>
            <linearGradient id={`boneKneeGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2e3d52" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
            <linearGradient id={`patellaGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#3d4e66" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <pattern id={`stripeKneePattern-${side}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
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
            fill={`url(#boneKneeGrad-${side})`} 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          <text x="175" y="55" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">FÉMUR</text>

          {/* Tibia (Proximal) */}
          <path 
            d="M 130,320 L 130,225 C 130,215 120,210 120,198 C 120,192 135,188 152,192 C 160,194 175,200 175,200 C 175,200 190,194 198,192 C 215,188 230,192 230,198 C 230,210 220,215 220,225 L 220,320 Z" 
            fill={`url(#boneKneeGrad-${side})`} 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          <text x="175" y="295" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

          {/* Fibula / Peroné (Lateral is shown on the Left side visually for the right knee, active side X<175 is medial) */}
          {/* Let's place it on the Right side visually (X > 220) */}
          <path 
            d="M 233,230 L 243,222 C 248,222 254,228 254,236 L 252,320 L 235,320 Z" 
            fill={`url(#boneKneeGrad-${side})`} 
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
          </g>

          {/* 3. Rótula / Patella (Neutral / Reference) */}
          <path 
            d="M 152,88 C 165,83 185,83 198,88 C 206,102 206,122 196,134 C 185,142 165,142 154,134 C 144,122 144,102 152,88 Z" 
            fill={`url(#patellaGrad-${side})`} 
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
          </g>

          {/* 6. Ligamento Colateral Medial (LCM) */}
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
          </g>

          {/* 7. Ligamento Colateral Lateral */}
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
          </g>

          {/* LABELS TEXT GUIDES ON GRAPH */}
          <text x="55" y="65" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Derrame suprapatelar</text>
          <text x="52" y="157" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Colateral Medial (LCM)</text>
          <text x="85" y="181" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Menisco Medial</text>

          <text x="248" y="53" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">T. Cuadricipital</text>
          <text x="286" y="157" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Colateral Lateral (LCE)</text>
          <text x="248" y="168" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">T. Rotuliano</text>
          <text x="270" y="181" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Menisco Lateral</text>

        </svg>
      );
    } else {
      return (
        <svg 
          id={isIzqui ? "knee-anatomy-svg-posterior-left" : "knee-anatomy-svg-posterior"}
          viewBox="0 0 350 350" 
          className="w-full max-w-[300px] h-auto drop-shadow-2xl mx-auto"
          style={{ maxHeight: "310px" }}
        >
          <defs>
            <linearGradient id={`boneKneeGradPost-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2e3d52" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
            <linearGradient id={`veinGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id={`arteryGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>

          {/* Background structural guidelines */}
          <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />

          {/* BONES BLOCK (POSTERIOR VIEW) */}
          {/* Femur (Distal) */}
          <path 
            d="M 125,30 L 125,115 C 125,125 110,130 110,145 C 110,165 130,172 145,172 C 160,172 170,160 175,160 C 180,160 190,172 205,172 C 220,172 240,165 240,145 C 240,130 225,125 225,115 L 225,30 Z" 
            fill={`url(#boneKneeGradPost-${side})`} 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          <text x="175" y="55" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">FÉMUR (POSTERIOR)</text>

          {/* Tibia (Proximal) */}
          <path 
            d="M 130,320 L 130,225 C 130,212 120,208 120,195 C 120,190 140,188 155,190 C 165,192 175,198 175,198 C 175,198 185,192 195,190 C 210,188 230,190 230,195 C 230,208 220,212 220,225 L 220,320 Z" 
            fill={`url(#boneKneeGradPost-${side})`} 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          <text x="175" y="295" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

          {/* Peroné / Fibula */}
          <path 
            d="M 97,230 L 107,222 C 112,222 118,228 118,236 L 116,320 L 99,320 Z" 
            fill={`url(#boneKneeGradPost-${side})`} 
            stroke="#334155" 
            strokeWidth="1.2" 
          />

          {/* Fosa Poplítea (Diamond-shaped region) */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => setSelectedStructure("popliteal_fossa")}
            onMouseEnter={() => setActiveHover("popliteal_fossa")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <polygon 
              points="175,125 215,175 175,225 135,175" 
              fill={getColorForSVG("popliteal_fossa").fill} 
              stroke={getColorForSVG("popliteal_fossa").stroke} 
              strokeWidth={states.popliteal_fossa !== "normal" ? "2.5" : "1"}
              fillOpacity={states.popliteal_fossa !== "normal" ? "0.5" : "0.15"}
              strokeDasharray={states.popliteal_fossa === "no_descrito" ? "3,3" : "none"}
            />
          </g>

          {/* Distal Tendons */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => setSelectedStructure("distal_tendons")}
            onMouseEnter={() => setActiveHover("distal_tendons")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 105,30 Q 115,85 135,140" 
              fill="none" 
              stroke={getColorForSVG("distal_tendons").stroke} 
              strokeWidth={states.distal_tendons !== "normal" ? "6" : "4"} 
              strokeLinecap="round"
              opacity={states.distal_tendons === "no_descrito" ? "0.3" : "1"}
            />
            <path 
              d="M 245,30 Q 235,85 215,130" 
              fill="none" 
              stroke={getColorForSVG("distal_tendons").stroke} 
              strokeWidth={states.distal_tendons !== "normal" ? "6" : "4"} 
              strokeLinecap="round"
              opacity={states.distal_tendons === "no_descrito" ? "0.3" : "1"}
            />
          </g>

          {/* Arteria Poplítea */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => setSelectedStructure("popliteal_artery")}
            onMouseEnter={() => setActiveHover("popliteal_artery")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 170,30 L 170,320" 
              fill="none" 
              stroke={states.popliteal_artery === "no_descrito" ? "#ef4444" : getColorForSVG("popliteal_artery").stroke} 
              strokeWidth={states.popliteal_artery !== "normal" && states.popliteal_artery !== "no_descrito" ? "6" : "3.5"} 
              opacity={states.popliteal_artery === "no_descrito" ? "0.2" : "0.95"}
            />
            {states.popliteal_artery === "aneurisma" && (
              <circle cx="170" cy="175" r="14" fill="#ef4444" fillOpacity="0.75" stroke="#b91c1c" strokeWidth="2" />
            )}
          </g>

          {/* Vena Poplítea */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => setSelectedStructure("popliteal_vein")}
            onMouseEnter={() => setActiveHover("popliteal_vein")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 182,30 L 182,320" 
              fill="none" 
              stroke={states.popliteal_vein === "no_descrito" ? "#3b82f6" : getColorForSVG("popliteal_vein").stroke} 
              strokeWidth={states.popliteal_vein !== "normal" && states.popliteal_vein !== "no_descrito" ? "6" : "3.5"} 
              opacity={states.popliteal_vein === "no_descrito" ? "0.2" : "0.95"}
            />
            {states.popliteal_vein === "trombosis" && (
              <rect x="178" y="150" width="8" height="30" fill="#1e3a8a" stroke="#ef4444" strokeWidth="1" />
            )}
          </g>

          {/* Baker's Cyst */}
          <g 
            className="cursor-pointer transition-all duration-200"
            onClick={() => setSelectedStructure("baker_cyst")}
            onMouseEnter={() => setActiveHover("baker_cyst")}
            onMouseLeave={() => setActiveHover(null)}
          >
            <path 
              d="M 182,185 C 195,178 205,170 215,185 C 225,195 230,225 210,230 C 192,232 182,210 182,185 Z" 
              fill={getColorForSVG("baker_cyst").fill} 
              stroke={getColorForSVG("baker_cyst").stroke} 
              strokeWidth={states.baker_cyst !== "normal" ? "3" : "1"}
              fillOpacity={states.baker_cyst !== "normal" ? "0.6" : "0.1"}
            />
            <line x1="220" y1="210" x2="255" y2="210" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
          </g>

          {/* Text labels for posterior view */}
          <text x="95" y="100" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">T. Isquiotibiales</text>
          <text x="125" y="160" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Fosa Poplítea</text>
          <text x="145" y="270" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Art. Poplítea</text>

          <text x="210" y="270" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Vena Poplítea</text>
          <text x="258" y="213" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Quiste de Baker</text>

        </svg>
      );
    }
    };

    return renderWithContext(localStates);
  };

  const renderGonartrosisSvg = (side: "derecho" | "izquierdo") => {
    const isIzqui = side === "izquierdo";
    const localStates = laterality === "Bilateral" && side === "izquierdo" ? statesLeft : states;
    const getColorForSVG = (id: string) => getColorForSVGOuter(id, side);

    return (
      <svg
        id={isIzqui ? "knee-gonartrosis-svg-left" : "knee-gonartrosis-svg"}
        viewBox="0 0 350 350"
        className="w-full max-w-[300px] h-auto drop-shadow-2xl mx-auto"
        style={{ maxHeight: "310px" }}
      >
        <defs>
          <linearGradient id={`gonBoneGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2e3d52" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id={`sclerosisGrad-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background grid/circle guidelines */}
        <circle cx="175" cy="175" r="145" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,6" />
        <line x1="175" y1="20" x2="175" y2="330" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />
        <line x1="20" y1="175" x2="330" y2="175" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,8" />

        {/* 1. Femur Bone with Marginal Osteophytes */}
        <path
          d="M 125,30 L 125,120 C 125,125 118,128 112,132 C 105,136 102,143 103,150 C 104,158 112,165 125,165 C 132,165 142,162 148,168 C 154,174 158,180 175,180 C 192,180 196,174 202,168 C 208,162 218,165 225,165 C 238,165 246,158 247,150 C 248,143 245,136 238,132 C 232,128 225,125 225,120 L 225,30 Z"
          fill={`url(#gonBoneGrad-${side})`}
          stroke="#334155"
          strokeWidth="1.5"
        />
        <text x="175" y="55" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">FÉMUR</text>

        {/* 2. Tibia Bone with Narrowed Medial Space and Osteophytes */}
        <path
          d="M 130,320 L 130,225 C 130,215 120,210 114,206 C 108,202 108,198 115,196 C 122,194 135,198 150,198 C 160,198 175,200 175,200 C 175,200 190,195 198,192 C 215,186 235,190 242,196 C 249,202 240,208 236,212 C 230,218 220,218 220,225 L 220,320 Z"
          fill={`url(#gonBoneGrad-${side})`}
          stroke="#334155"
          strokeWidth="1.5"
        />
        <text x="175" y="295" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">TIBIA</text>

        {/* Fibula / Peroné */}
        <path
          d="M 235,235 L 245,227 C 250,227 256,233 256,241 L 254,320 L 237,320 Z"
          fill={`url(#gonBoneGrad-${side})`}
          stroke="#334155"
          strokeWidth="1.2"
        />

        {/* INTERACTIVE GONARTROSIS PATHOLOGIES */}

        {/* A. Pinzamiento Articular (Joint Space Narrowing) */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_pinzamiento_artic")}
          onMouseEnter={() => setActiveHover("gon_pinzamiento_artic")}
          onMouseLeave={() => setActiveHover(null)}
        >
          {/* Medial femorotibial joint space band */}
          <path
            d="M 115,168 C 130,168 145,172 155,180"
            fill="none"
            stroke={getColorForSVG("gon_pinzamiento_artic").stroke}
            strokeWidth={localStates.gon_pinzamiento_artic !== "normal" ? "8" : "3"}
            opacity={localStates.gon_pinzamiento_artic === "no_descrito" ? "0.2" : "0.95"}
            strokeLinecap="round"
          />
          <path
            d="M 195,180 C 205,172 220,168 235,168"
            fill="none"
            stroke={getColorForSVG("gon_pinzamiento_artic").stroke}
            strokeWidth="3"
            opacity="0.3"
            strokeLinecap="round"
          />
          <line x1="135" y1="172" x2="80" y2="172" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* B. Osteofitos Marginales (Marginal Osteophytes) */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_osteofitos")}
          onMouseEnter={() => setActiveHover("gon_osteofitos")}
          onMouseLeave={() => setActiveHover(null)}
        >
          {/* Femoral lateral osteophyte */}
          <path
            d="M 103,150 L 94,153 L 105,157 Z"
            fill={getColorForSVG("gon_osteofitos").fill}
            stroke={getColorForSVG("gon_osteofitos").stroke}
            strokeWidth="1"
            opacity={localStates.gon_osteofitos === "no_descrito" ? "0.3" : "1"}
          />
          {/* Femoral medial osteophyte */}
          <path
            d="M 247,150 L 256,153 L 245,157 Z"
            fill={getColorForSVG("gon_osteofitos").fill}
            stroke={getColorForSVG("gon_osteofitos").stroke}
            strokeWidth="1"
            opacity={localStates.gon_osteofitos === "no_descrito" ? "0.3" : "1"}
          />
          {/* Tibial medial osteophyte */}
          <path
            d="M 112,198 L 102,196 L 115,204 Z"
            fill={getColorForSVG("gon_osteofitos").fill}
            stroke={getColorForSVG("gon_osteofitos").stroke}
            strokeWidth="1"
            opacity={localStates.gon_osteofitos === "no_descrito" ? "0.3" : "1"}
          />
          {/* Tibial lateral osteophyte */}
          <path
            d="M 238,196 L 248,194 L 235,202 Z"
            fill={getColorForSVG("gon_osteofitos").fill}
            stroke={getColorForSVG("gon_osteofitos").stroke}
            strokeWidth="1"
            opacity={localStates.gon_osteofitos === "no_descrito" ? "0.3" : "1"}
          />
          <line x1="102" y1="153" x2="65" y2="135" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* C. Esclerosis Subcondral (Subchondral Sclerosis) */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_esclerosis_sub")}
          onMouseEnter={() => setActiveHover("gon_esclerosis_sub")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <path
            d="M 116,200 C 130,201 145,203 158,202"
            fill="none"
            stroke={getColorForSVG("gon_esclerosis_sub").stroke}
            strokeWidth={localStates.gon_esclerosis_sub !== "normal" ? "6.5" : "2"}
            opacity={localStates.gon_esclerosis_sub === "no_descrito" ? "0.2" : "0.9"}
          />
          <path
            d="M 192,202 C 205,203 220,201 234,200"
            fill="none"
            stroke={getColorForSVG("gon_esclerosis_sub").stroke}
            strokeWidth="2"
            opacity="0.3"
          />
          <line x1="135" y1="202" x2="80" y2="230" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* D. Geodas / Quistes Subcondrales (Subchondral Cysts/Geodes) */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_geodas_quistes")}
          onMouseEnter={() => setActiveHover("gon_geodas_quistes")}
          onMouseLeave={() => setActiveHover(null)}
        >
          <circle
            cx="130"
            cy="215"
            r="5"
            fill={getColorForSVG("gon_geodas_quistes").fill}
            stroke={getColorForSVG("gon_geodas_quistes").stroke}
            strokeWidth="1"
            opacity={localStates.gon_geodas_quistes === "no_descrito" ? "0.2" : "0.95"}
          />
          <circle
            cx="145"
            cy="218"
            r="4"
            fill={getColorForSVG("gon_geodas_quistes").fill}
            stroke={getColorForSVG("gon_geodas_quistes").stroke}
            strokeWidth="1"
            opacity={localStates.gon_geodas_quistes === "no_descrito" ? "0.2" : "0.95"}
          />
          <line x1="130" y1="215" x2="70" y2="255" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* E. Desgaste de Cartílago (Cartilage Wear) */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_desgaste_cartilago")}
          onMouseEnter={() => setActiveHover("gon_desgaste_cartilago")}
          onMouseLeave={() => setActiveHover(null)}
        >
          {/* Medial Femoral Cartilage (worn / bumpy) */}
          <path
            d="M 112,154 C 118,154 122,152 126,155 C 130,158 135,152 144,152"
            fill="none"
            stroke={getColorForSVG("gon_desgaste_cartilago").stroke}
            strokeWidth={localStates.gon_desgaste_cartilago !== "normal" ? "4.5" : "2"}
            opacity={localStates.gon_desgaste_cartilago === "no_descrito" ? "0.2" : "0.95"}
          />
          {/* Lateral Femoral Cartilage */}
          <path
            d="M 206,152 C 215,152 220,158 238,154"
            fill="none"
            stroke={getColorForSVG("gon_desgaste_cartilago").stroke}
            strokeWidth="2"
            opacity="0.3"
          />
          <line x1="124" y1="154" x2="275" y2="120" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* F. Menisco Degenerativo/Extruido */}
        <g
          className="cursor-pointer transition-all duration-200"
          onClick={() => setSelectedStructure("gon_menisco_deg")}
          onMouseEnter={() => setActiveHover("gon_menisco_deg")}
          onMouseLeave={() => setActiveHover(null)}
        >
          {/* Squeezed / extruded medial meniscus */}
          <path
            d="M 103,178 C 111,178 116,180 118,185 C 112,187 106,187 103,184 C 101,183 101,180 103,178 Z"
            fill={getColorForSVG("gon_menisco_deg").fill}
            stroke={getColorForSVG("gon_menisco_deg").stroke}
            strokeWidth={localStates.gon_menisco_deg !== "normal" ? "2.5" : "1.2"}
            opacity={localStates.gon_menisco_deg === "no_descrito" ? "0.2" : "0.95"}
          />
          {/* Lateral meniscus */}
          <path
            d="M 235,178 C 227,178 222,180 220,185 C 226,187 232,187 235,184 C 237,183 237,180 235,178 Z"
            fill={getColorForSVG("gon_menisco_deg").fill}
            stroke={getColorForSVG("gon_menisco_deg").stroke}
            strokeWidth="1.2"
            opacity="0.3"
          />
          <line x1="108" y1="181" x2="65" y2="195" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
        </g>

        {/* TEXT LABELS */}
        <text x="60" y="133" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Osteofito marginal</text>
        <text x="75" y="170" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Pinzamiento articular</text>
        <text x="60" y="193" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Menisco extruido</text>
        <text x="75" y="228" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Esclerosis subcondral</text>
        <text x="65" y="258" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="end">Geodas / Quistes</text>

        <text x="280" y="118" fill="#64748b" fontSize="6.5" fontStyle="italic" textAnchor="start">Desgaste de cartílago</text>
      </svg>
    );
  };

  useEffect(() => {
    if (!includeInReport && includeGonartrosis && activeTab !== "gonartrosis") {
      setActiveTab("gonartrosis");
      setSelectedStructure("gon_pinzamiento_artic");
    } else if (includeInReport && !includeGonartrosis && activeTab === "gonartrosis") {
      setActiveTab("anterior");
      setSelectedStructure("quadriceps");
    }
  }, [includeInReport, includeGonartrosis]);

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

      {/* SELECCIÓN DE ESQUEMAS EN REPORTE */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850/60 text-xs">
        <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] self-center mr-2">Incluir en el Reporte:</div>
        <label className="flex items-center gap-2 cursor-pointer select-none py-1.5 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors bg-slate-950/20 flex-1">
          <input 
            type="checkbox" 
            checked={includeInReport} 
            onChange={(e) => setIncludeInReport && setIncludeInReport(e.target.checked)}
            className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
          />
          <div>
            <span className="font-bold text-slate-200 block text-[11px]">Esquema General de Rodilla</span>
            <span className="text-[9px] text-slate-400">Diagramas interactivos de caras Anterior y Posterior</span>
          </div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none py-1.5 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors bg-slate-950/20 flex-1">
          <input 
            type="checkbox" 
            checked={includeGonartrosis} 
            onChange={(e) => {
              const val = e.target.checked;
              if (setIncludeGonartrosis) {
                setIncludeGonartrosis(val);
              } else {
                setLocalIncludeGonartrosis(val);
              }
            }}
            className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
          />
          <div>
            <span className="font-bold text-slate-200 block text-[11px]">Esquema de Gonartrosis (Artrosis)</span>
            <span className="text-[9px] text-slate-400">Hallazgos típicos: pinzamiento, osteofitos, esclerosis y geodas</span>
          </div>
        </label>
      </div>

      {!includeInReport && !includeGonartrosis ? (
        <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl p-8 text-center my-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-300 font-bold text-xs">Ningún esquema de rodilla seleccionado</p>
          <p className="text-slate-400 text-[10px] mt-1 max-w-md mx-auto leading-relaxed">
            Active al menos un esquema (General o Gonartrosis) en los selectores superiores para visualizar la anatomía interactiva e incluir los esquemas en el reporte PDF.
          </p>
        </div>
      ) : (
        <>
          {laterality === "Bilateral" && (
            <div className="flex gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl justify-around self-stretch shadow-inner">
              <button
                onClick={() => setActiveSide("derecho")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSide === "derecho"
                    ? "bg-indigo-600 text-white shadow-md border border-indigo-400/20"
                    : "text-slate-450 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                LADO DERECHO (Derecho)
              </button>
              <button
                onClick={() => setActiveSide("izquierdo")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSide === "izquierdo"
                    ? "bg-indigo-600 text-white shadow-md border border-indigo-400/20"
                    : "text-slate-450 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                LADO IZQUIERDO (Izquierdo)
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* LEFT COLUMN: INTERACTIVE DRAWING (5 cols) */}
            <div className="lg:col-span-5 bg-slate-950/40 rounded-2xl border border-slate-850 p-4 flex flex-col items-center justify-between min-h-[380px] relative">
              
              <div className="absolute top-2.5 left-2.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex gap-1 z-10">
                {includeInReport && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab("anterior");
                        setSelectedStructure("quadriceps");
                      }}
                      className={`px-2.5 py-1 text-[8px] uppercase tracking-wider font-extrabold rounded-lg font-mono transition-all cursor-pointer ${
                        activeTab === "anterior" 
                          ? "bg-indigo-600 text-white shadow-md border border-indigo-400/20" 
                          : "text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("posterior");
                        setSelectedStructure("popliteal_artery");
                      }}
                      className={`px-2.5 py-1 text-[8px] uppercase tracking-wider font-extrabold rounded-lg font-mono transition-all cursor-pointer ${
                        activeTab === "posterior" 
                          ? "bg-indigo-600 text-white shadow-md border border-indigo-400/20" 
                          : "text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      Posterior
                    </button>
                  </>
                )}
                {includeGonartrosis && (
                  <button
                    onClick={() => {
                      setActiveTab("gonartrosis");
                      setSelectedStructure("gon_pinzamiento_artic");
                    }}
                    className={`px-2.5 py-1 text-[8px] uppercase tracking-wider font-extrabold rounded-lg font-mono transition-all cursor-pointer ${
                      activeTab === "gonartrosis" 
                        ? "bg-rose-650 text-white shadow-md border border-rose-400/20" 
                        : "text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    Gonartrosis
                  </button>
                )}
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 px-2 py-0.5 rounded border border-slate-800 text-[8px] font-bold text-slate-500 uppercase font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Dinámico
              </div>

              {/* Interactive Workspace */}
              <div className="w-full flex items-center justify-center py-2 mt-7 min-h-[310px]">
                {laterality === "Bilateral" ? (
                  <>
                    <div 
                      className="w-full"
                      style={activeSide === "derecho" ? { display: "block" } : { display: "none" }}
                    >
                      <div style={activeTab === "gonartrosis" ? { display: "block" } : { display: "none" }}>
                        {renderGonartrosisSvg("derecho")}
                      </div>
                      <div style={activeTab === "anterior" ? { display: "block" } : { display: "none" }}>
                        {renderKneeSvg("derecho", "anterior")}
                      </div>
                      <div style={activeTab === "posterior" ? { display: "block" } : { display: "none" }}>
                        {renderKneeSvg("derecho", "posterior")}
                      </div>
                    </div>
                    <div 
                      className="w-full"
                      style={activeSide === "izquierdo" ? { display: "block" } : { display: "none" }}
                    >
                      <div style={activeTab === "gonartrosis" ? { display: "block" } : { display: "none" }}>
                        {renderGonartrosisSvg("izquierdo")}
                      </div>
                      <div style={activeTab === "anterior" ? { display: "block" } : { display: "none" }}>
                        {renderKneeSvg("izquierdo", "anterior")}
                      </div>
                      <div style={activeTab === "posterior" ? { display: "block" } : { display: "none" }}>
                        {renderKneeSvg("izquierdo", "posterior")}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full">
                    <div style={activeTab === "gonartrosis" ? { display: "block" } : { display: "none" }}>
                      {renderGonartrosisSvg("derecho")}
                    </div>
                    <div style={activeTab === "anterior" ? { display: "block" } : { display: "none" }}>
                      {renderKneeSvg("derecho", "anterior")}
                    </div>
                    <div style={activeTab === "posterior" ? { display: "block" } : { display: "none" }}>
                      {renderKneeSvg("derecho", "posterior")}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full text-center py-1 mt-1 border-t border-slate-900/40">
                <span className="text-[9px] text-slate-500 font-medium font-sans">
                  💡 Haz clic en los marcadores anatómicos del dibujo para interactuar o usa el selector a la derecha
                </span>
              </div>

            </div>

            {/* RIGHT COLUMN: ACTION HUD & CONTROL PANEL (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Active Selection Block */}
              <div className="bg-slate-950/20 rounded-2xl border border-slate-850 p-4 relative">
                <div className="absolute top-3.5 right-4">
                  <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase font-mono ${getSeverityBadge(activeSts[selectedStructure])}`}>
                    {activeSts[selectedStructure].replace("_", " ")}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-900/60">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">
                      {translateStructureLabelInBrief(selectedStructure)}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 uppercase font-bold font-mono">Estructura:</span>
                    <select
                      value={selectedStructure}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedStructure(val);
                        if (val.startsWith("gon_") && activeTab !== "gonartrosis") {
                          setActiveTab("gonartrosis");
                        } else if (!val.startsWith("gon_") && activeTab === "gonartrosis") {
                          setActiveTab("anterior");
                        }
                      }}
                      className="bg-slate-900 border border-slate-800 text-[10.5px] font-bold text-indigo-400 uppercase rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500/50 cursor-pointer font-sans"
                    >
                      <optgroup label="Anatomía General" className="bg-slate-955 text-slate-400 text-[10px]">
                        <option value="quadriceps">Tendón Cuadricipital</option>
                        <option value="patellar">Tendón Rotuliano</option>
                        <option value="lcm">Lig. Colateral Medial (LCM)</option>
                        <option value="lce">Lig. Colateral Lateral (LCE)</option>
                        <option value="medial_meniscus">Menisco Medial</option>
                        <option value="lateral_meniscus">Menisco Lateral</option>
                        <option value="joint_effusion">Derrame Articular</option>
                        <option value="baker_cyst">Quiste de Baker</option>
                        <option value="popliteal_artery">Arteria Poplítea</option>
                        <option value="popliteal_vein">Vena Poplítea</option>
                        <option value="distal_tendons">Tendones Distales</option>
                        <option value="popliteal_fossa">Fosa Poplítea</option>
                      </optgroup>
                      {includeGonartrosis && (
                        <optgroup label="Hallazgos de Gonartrosis" className="bg-slate-955 text-slate-400 text-[10px]">
                          <option value="gon_pinzamiento_artic">Pinzamiento Articular</option>
                          <option value="gon_osteofitos">Osteofitos Marginales</option>
                          <option value="gon_esclerosis_sub">Esclerosis Subcondral</option>
                          <option value="gon_geodas_quistes">Geodas / Quistes Subcondrales</option>
                          <option value="gon_desgaste_cartilago">Desgaste de Cartílago</option>
                          <option value="gon_menisco_deg">Degeneración/Extrusión Meniscal</option>
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {/* Custom State Input */}
                <div className="mt-4 space-y-1">
                  <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono block">
                    Diagnóstico / Hallazgo Clínico (Sinopsis):
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={
                        activeSts[selectedStructure] === "no_descrito" 
                          ? "" 
                          : activeSts[selectedStructure] === "normal" 
                            ? "Normal" 
                            : activeSts[selectedStructure]
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
                        className={`flex-1 py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                          activeSts[selectedStructure] === "normal"
                            ? "bg-emerald-650 border-emerald-500 text-white shadow"
                            : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-855"
                        }`}
                      >
                        ✓ Cons. Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStructureState(selectedStructure, "no_descrito")}
                        className={`flex-1 py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                          activeSts[selectedStructure] === "no_descrito"
                            ? "bg-slate-800 border-slate-700 text-slate-300 shadow"
                            : "bg-slate-955 hover:bg-slate-900 text-slate-400 border-slate-855"
                        }`}
                      >
                        ⚪ No Descrito
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Description Textarea */}
                <div className="mt-4">
                  <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono block mb-1">
                    Hallazgo Clínico detallado (Texto oficial en Reporte):
                  </label>

                  <textarea
                    value={activeDescs[selectedStructure] || getDefaultDescription(selectedStructure, activeSts[selectedStructure])}
                    onChange={(e) => handleUpdateCustomDescription(selectedStructure, e.target.value)}
                    placeholder="Introduzada o modifique la redacción médica para esta estructura..."
                    className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500/55 min-h-[64px] font-mono leading-relaxed"
                    disabled={activeSts[selectedStructure] === "no_descrito"}
                  />
                  <span className="text-[9px] text-slate-500">
                    La redacción modificada se utilizará para generar la tabla y las viñetas.
                  </span>
                </div>

              </div>

              {/* Acciones de Exportación */}
              <div className="bg-slate-950/40 rounded-2xl border border-slate-850/60 p-4">
                <h5 className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono mb-2">
                  Inyectar en Reporte
                </h5>
                <div className="grid grid-cols-2 gap-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.keys(activeSts).filter(id => activeSts[id] !== "no_descrito" && activeSts[id] !== "normal").map((id) => {
                const s = activeSts[id];
                const isSelected = selectedStructure === id;
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "no_descrito") {
                  dotColor = "bg-slate-500 shadow-[0_0_6px_rgba(100,116,139,0.4)]";
                } else if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-400 border-emerald-900/30";
                } else if (s === "tendinosis" || s === "esguince_leve" || s === "meniscosis" || s === "derrame_leve" || s === "quiste_leve" || s === "ectasia" || s === "ateromatosis") {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s === "desgarro_parcial" || s === "permisibilidad_reducida" || s === "coleccion" || s === "adenopatia") {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-400 border-pink-900/30";
                } else {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-450 border-rose-900/30";
                }

                return (
                  <button
                    key={id}
                    onClick={() => setSelectedStructure(id)}
                    onMouseEnter={() => setActiveHover(id)}
                    onMouseLeave={() => setActiveHover(null)}
                    type="button"
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
                          {translateStructureLabelInBrief(id)}
                        </span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 font-mono scale-95 ${badgeBg}`}>
                        {s.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-400 truncate mt-0.5 max-w-full">
                      {activeDescs[id] || "Sin hallazgos clínicos descritos."}
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

              {Object.keys(activeSts).filter(id => activeSts[id] !== "no_descrito" && activeSts[id] !== "normal").length === 0 && (!additionalFindings || additionalFindings.length === 0) && (
                <div className="col-span-full py-4 text-center text-slate-500 italic text-xs">
                  Sin hallazgos patológicos relevantes detectados.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
        </>
      )}

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
