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
  externalStates?: Record<string, string>;
  externalDescriptions?: Record<string, string>;
  additionalFindings?: Array<{ id: string; structureName: string; state: string; description: string }>;
}

interface NeckStructure {
  id: string;
  name: string;
  description: string;
  category: "thyroid" | "salivary" | "lymph" | "other";
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
  onChangeDescriptions,
  externalStates,
  externalDescriptions,
  additionalFindings = []
}: NeckAnatomyViewerProps) {
  
  // States of each neck/thyroid structure:
  // - "no_descrito": Not mentioned (Omitido / Desactivado)
  // - "normal": Normal (Activo)
  // - customized pathology/finding
  const [states, setStates] = useState<Record<string, string>>({
    thyroid_right_lobe: "no_descrito",
    thyroid_left_lobe: "no_descrito",
    thyroid_isthmus: "no_descrito",
    parotid_right: "no_descrito",
    parotid_left: "no_descrito",
    submandibular_right: "no_descrito",
    submandibular_left: "no_descrito",
    sublingual_right: "no_descrito",
    sublingual_left: "no_descrito",
    nodes_r_i: "no_descrito",
    nodes_r_ii: "no_descrito",
    nodes_r_iii: "no_descrito",
    nodes_r_iv: "no_descrito",
    nodes_r_v: "no_descrito",
    nodes_r_vi: "no_descrito",
    nodes_r_vii: "no_descrito",
    nodes_l_i: "no_descrito",
    nodes_l_ii: "no_descrito",
    nodes_l_iii: "no_descrito",
    nodes_l_iv: "no_descrito",
    nodes_l_v: "no_descrito",
    nodes_l_vi: "no_descrito",
    nodes_l_vii: "no_descrito",
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
    sublingual_right: "",
    sublingual_left: "",
    nodes_r_i: "",
    nodes_r_ii: "",
    nodes_r_iii: "",
    nodes_r_iv: "",
    nodes_r_v: "",
    nodes_r_vi: "",
    nodes_r_vii: "",
    nodes_l_i: "",
    nodes_l_ii: "",
    nodes_l_iii: "",
    nodes_l_iv: "",
    nodes_l_v: "",
    nodes_l_vi: "",
    nodes_l_vii: "",
    major_vessels: "",
    muscles_soft_tissues: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("thyroid_right_lobe");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");
  const [subViewMode, setSubViewMode] = useState<"thyroid" | "cervical" | "dual">("dual");

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

  const isThyroidectomy = 
    generatedReport?.toLowerCase().includes("tiroidectomia") || 
    generatedReport?.toLowerCase().includes("tiroidectomía") ||
    generatedReport?.toLowerCase().includes("lecho tiroideo") ||
    generatedReport?.toLowerCase().includes("lecho de la tiroides");

  const isLobeEnlarged = (id: string, reportText: string, stateValue: string): boolean => {
    if (!reportText) return false;
    const textLower = reportText.toLowerCase();

    if (stateValue === "bocio_multinodular" || stateValue === "engrosado") {
      return true;
    }

    const globalEnlargement = [
      "bocio", "tiroideomegalia", "bocio multinodular", "bocio difuso", 
      "tiroides de aspecto aumentado", "tiroides aumentada", "tiroides aumentado",
      "tiroides de tamaño aumentado", "glándula tiroides de tamaño aumentado", 
      "glandula tiroides de tamaño aumentado", "tiroides aumentada de tamaño",
      "glandula tiroides aumentada de tamaño", "glándula tiroides aumentada de tamaño",
      "bocio difuso", "glandula tiroidea aumentada", "volumen de la glándula tiroides aumentado",
      "volumen de la glandula tiroides aumentado", "glándula tiroides con aumento de tamaño",
      "glandula tiroides con aumento de tamaño", "tiroides con aumento de tamaño",
      "aumento difuso de la glándula tiroides", "aumento difuso de la glandula tiroides"
    ].some(kw => textLower.includes(kw));

    if (globalEnlargement && id.startsWith("thyroid")) {
      return true;
    }

    const sizeKeywords = [
      "aumentado de tamaño", "aumentada de tamaño", "aumento de tamaño", 
      "aumento de volumen", "aumentado de volumen", "hipertrofia", "hipertrófico", "hipertrofico", "hipertrófica", "hipertrofica"
    ];

    let lobeKeywords: string[] = [];
    if (id === "thyroid_right_lobe") {
      lobeKeywords = [
        "lóbulo tiroideo derecho", "lobulo tiroideo derecho", "lóbulo derecho tiroideo", 
        "lobulo derecho de la tiroides", "lóbulo derecho de tiroides", "lóbulo derecho", 
        "lobulo derecho", "ld de la tiroides", "ld tiroideo", "ld de tiroides"
      ];
    } else if (id === "thyroid_left_lobe") {
      lobeKeywords = [
        "lóbulo tiroideo izquierdo", "lobulo tiroideo izquierdo", "lóbulo izquierdo tiroideo", 
        "lobulo izquierdo de la tiroides", "lóbulo izquierdo de tiroides", "lóbulo izquierdo", 
        "lobulo izquierdo", "li de la tiroides", "li tiroideo", "li de tiroides"
      ];
    } else if (id === "thyroid_isthmus") {
      lobeKeywords = ["istmo", "istmo tiroideo", "istmo de la tiroides", "istmo de tiroides"];
    } else {
      return false;
    }

    return lobeKeywords.some(lk => {
      const idx = textLower.indexOf(lk);
      if (idx === -1) return false;
      const context = textLower.substring(Math.max(0, idx - 100), Math.min(textLower.length, idx + 100));
      return sizeKeywords.some(sk => context.includes(sk));
    });
  };

  const adjustEnlargedDescription = (id: string, originalDesc: string, reportText: string, stateVal: string): string => {
    if (!id.startsWith("thyroid")) return originalDesc;
    if (stateVal === "no_descrito") return originalDesc;
    
    const enlarged = isLobeEnlarged(id, reportText, stateVal);
    if (!enlarged) return originalDesc;

    const descLower = originalDesc.toLowerCase();
    const hasEnlargementMention = 
      descLower.includes("aumentado de tamaño") || 
      descLower.includes("aumentada de tamaño") || 
      descLower.includes("aumento de tamaño") || 
      descLower.includes("hipertrofia") || 
      descLower.includes("bocio") || 
      descLower.includes("aumentado de volumen") ||
      descLower.includes("volumen aumentado") ||
      descLower.includes("engrosado") ||
      descLower.includes("engrosamiento");

    if (hasEnlargementMention) {
      return originalDesc;
    }

    if (originalDesc === "Dentro de límites normales." || !originalDesc.trim()) {
      return "Aumentado de tamaño.";
    }

    let cleaned = originalDesc.trim();
    if (cleaned.endsWith(".")) {
      cleaned = cleaned.slice(0, -1);
    }
    return `${cleaned}, aumentado de tamaño.`;
  };

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
        return ["istmo", "istmo tiroideo", "istmo de la tiroides", "istmo de tiroides"];
      case "parotid_right":
        return ["parótida derecha", "parotida derecha", "glándula parótida derecha", "glandula parotida derecha", "parótida dda"];
      case "parotid_left":
        return ["parótida izquierda", "parotida izquierda", "glándula parótida izquierda", "glandula parotida izquierda", "parótida izq"];
      case "submandibular_right":
        return ["submandibular derecha", "glándula submandibular derecha", "glandula submandibular derecha", "submaxilar derecha"];
      case "submandibular_left":
        return ["submandibular izquierda", "glándula submandibular izquierda", "glandula submandibular izquierda", "submaxilar izquierda"];
      case "sublingual_right":
        return ["sublingual derecha", "glándula sublingual derecha", "glandula sublingual derecha"];
      case "sublingual_left":
        return ["sublingual izquierda", "glándula sublingual izquierda", "glandula sublingual izquierda"];
      
      // Node Levels (Right)
      case "nodes_r_i":
        return ["nivel i derecho", "nivel i dda", "nivel ia derecho", "nivel ib derecho", "submandibular derecho", "submentoniano derecho", "nivel 1 derecho"];
      case "nodes_r_ii":
        return ["nivel ii derecho", "nivel ii dda", "nivel iia derecho", "nivel iib derecho", "yugular superior derecho", "nivel 2 derecho"];
      case "nodes_r_iii":
        return ["nivel iii derecho", "nivel iii dda", "yugular medio derecho", "nivel 3 derecho"];
      case "nodes_r_iv":
        return ["nivel iv derecho", "nivel iv dda", "yugular inferior derecho", "nivel 4 derecho"];
      case "nodes_r_v":
        return ["nivel v derecho", "nivel v dda", "triángulo posterior derecho", "triangulo posterior derecho", "nivel 5 derecho"];
      case "nodes_r_vi":
        return ["nivel vi derecho", "nivel vi dda", "compartimento anterior derecho", "pretraqueal derecho", "paratraqueal derecho", "nivel 6 derecho"];
      case "nodes_r_vii":
        return ["nivel vii derecho", "nivel vii dda", "mediastínico derecho", "mediastinico derecho", "nivel 7 derecho"];
      
      // Node Levels (Left)
      case "nodes_l_i":
        return ["nivel i izquierdo", "nivel i izq", "nivel ia izquierdo", "nivel ib izquierdo", "submandibular izquierdo", "submentoniano izquierdo", "nivel 1 izquierdo"];
      case "nodes_l_ii":
        return ["nivel ii izquierdo", "nivel ii izq", "nivel iia izquierdo", "nivel iib izquierdo", "yugular superior izquierdo", "nivel 2 izquierdo"];
      case "nodes_l_iii":
        return ["nivel iii izquierdo", "nivel iii izq", "yugular medio izquierdo", "nivel 3 izquierdo"];
      case "nodes_l_iv":
        return ["nivel iv izquierdo", "nivel iv izq", "yugular inferior izquierdo", "nivel 4 izquierdo"];
      case "nodes_l_v":
        return ["nivel v izquierdo", "nivel v izq", "triángulo posterior izquierdo", "triangulo posterior izquierdo", "nivel 5 izquierdo"];
      case "nodes_l_vi":
        return ["nivel vi izquierdo", "nivel vi izq", "compartimento anterior izquierdo", "pretraqueal izquierdo", "paratraqueal izquierdo", "nivel 6 izquierdo"];
      case "nodes_l_vii":
        return ["nivel vii izquierdo", "nivel vii izq", "mediastínico izquierdo", "mediastinico izquierdo", "nivel 7 izquierdo"];

      case "major_vessels":
        return ["grandes vasos", "carótida", "carotida", "yugular", "eje carotídeo", "eje vascular"];
      case "muscles_soft_tissues":
        return ["músculos", "musculos", "tejidos blandos", "planos musculares", "esternocleidomastoideo"];
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
    const standardStates = [
      "normal", "no_descrito", "nodulo_benigno", "nodulo_sospechoso", "bocio_multinodular", "tiroiditis",
      "engrosado", "sialoadenitis", "litiasis", "quiste", "solido", "adenopatia_reactiva", "adenopatia_sospechosa",
      "linfadenitis", "placa_ateroma", "ectasia_yugular", "contractura", "masa_blanda"
    ];
    if (s && !standardStates.includes(s)) {
      return `Se describe hallazgo: ${s.charAt(0).toUpperCase() + s.slice(1)}.`;
    }

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
      case "sublingual_right":
        return "Glándula sublingual derecha sin alteraciones evidentes.";
      case "sublingual_left":
        return "Glándula sublingual izquierda dentro de límites normales.";
      
      // Nodes Right
      case "nodes_r_i":
        return "Ganglios del Nivel I derecho de morfología y tamaño conservados.";
      case "nodes_r_ii":
        return "Ganglios del Nivel II derecho normales sin signos de sospecha.";
      case "nodes_r_iii":
        return "Ganglios del Nivel III derecho con hilio graso conservado.";
      case "nodes_r_iv":
        return "Ganglios del Nivel IV derecho de caracteres ecográficos normales.";
      case "nodes_r_v":
        return "Ganglios del Nivel V derecho sin evidencia de adenopatías.";
      case "nodes_r_vi":
        return "Ganglios del Nivel VI derecho normales de aspecto habitual.";
      case "nodes_r_vii":
        return "Ganglios del Nivel VII derecho dentro de límites normales.";
      
      // Nodes Left
      case "nodes_l_i":
        return "Ganglios del Nivel I izquierdo de morfología y tamaño conservados.";
      case "nodes_l_ii":
        return "Ganglios del Nivel II izquierdo normales sin signos de sospecha.";
      case "nodes_l_iii":
        return "Ganglios del Nivel III izquierdo con hilio graso conservado.";
      case "nodes_l_iv":
        return "Ganglios del Nivel IV izquierdo de caracteres ecográficos normales.";
      case "nodes_l_v":
        return "Ganglios del Nivel V izquierdo sin evidencia de adenopatías.";
      case "nodes_l_vi":
        return "Ganglios del Nivel VI izquierdo normales de aspecto habitual.";
      case "nodes_l_vii":
        return "Ganglios del Nivel VII izquierdo dentro de límites normales.";

      case "major_vessels":
        return "Grandes vasos cervicales permeables sin placas hemodinámicamente significativas.";
      case "muscles_soft_tissues":
        return "Planos musculares y tejidos blandos cervicales de aspecto normal.";
      default:
        return "Sin alteraciones.";
    }
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis con heurísticas locales de alta precisión para niveles cervicales...");
    const textLower = generatedReport.toLowerCase();
    
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    // General cervical normal nodes check
    const hasGeneralNormalNodes = [
      "sin adenopatías", "sin adenopatias", "no se observan adenomegalias", "no se observan adenopatías", "no se observan adenopatias",
      "cadenas ganglionares de caracteres normales", "cadenas ganglionares de aspecto normal", "ganglios cervicales normales",
      "ausencia de adenopatías", "ausencia de adenopatias", "sin adenomegalias", "ganglios de morfologia habitual", "ganglios de morfología habitual",
      "sin evidencia de adenopatías", "sin evidencia de adenopatias", "ganglios de aspecto normal"
    ].some(kw => textLower.includes(kw));

    const structureKeys = Object.keys(states);

    structureKeys.forEach(id => {
      // 1. If it's a lymph node level and there is a general normal nodes mention
      if (id.startsWith("nodes_") && hasGeneralNormalNodes) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        return;
      }

      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado / No descrito.";
        return;
      }

      // Check if specifically declared normal
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
        return;
      }

      // Check for general bilateral inflammatory cervical adenopathy
      const isGeneralBilateralAdenopathy = [
        "adenopatías cervicales de aspecto inflamatorio",
        "adenopatias cervicales de aspecto inflamatorio",
        "adenopatías de aspecto inflamatorio bilateral",
        "adenopatias de aspecto inflamatorio bilateral",
        "adenopatías de aspecto inflamatorio bilaterales",
        "adenopatias de aspecto inflamatorio bilaterales",
        "adenopatías cervicales bilaterales",
        "adenopatias cervicales bilaterales",
        "adenopatías reactivas bilaterales",
        "adenopatias reactivas bilaterales",
        "adenopatías inflamatorias bilaterales",
        "adenopatias inflamatorias bilaterales"
      ].some(kw => textLower.includes(kw)) || (
        (textLower.includes("adenopatía") || textLower.includes("adenopatia") || textLower.includes("ganglio") || textLower.includes("ganglios")) &&
        (textLower.includes("inflamatori") || textLower.includes("reactiv")) &&
        (textLower.includes("bilateral") || textLower.includes("ambas cadenas") || textLower.includes("ambos lados"))
      );

      const checkSpecificLevelMentioned = (nodeId: string, text: string) => {
        const levelNum = nodeId.split("_").pop()?.toLowerCase();
        const numMap: Record<string, string[]> = {
          i: ["nivel i", "nivel 1", "nivel ia", "nivel ib", "submentonian", "submandibular"],
          ii: ["nivel ii", "nivel 2", "nivel iia", "nivel iib"],
          iii: ["nivel iii", "nivel 3"],
          iv: ["nivel iv", "nivel 4"],
          v: ["nivel v", "nivel 5", "nivel va", "nivel vb"],
          vi: ["nivel vi", "nivel 6"],
          vii: ["nivel vii", "nivel 7"]
        };
        const kws = numMap[levelNum || ""] || [];
        return kws.some(kw => text.includes(kw));
      };

      if (id.startsWith("nodes_") && isGeneralBilateralAdenopathy && !checkSpecificLevelMentioned(id, textLower)) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        return;
      }

      // Specific checks
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      // Deeper analysis for pathologies based on ID
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
      } else if (id.includes("parotid") || id.includes("submandibular") || id.includes("sublingual")) {
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
      } else if (id.startsWith("nodes_")) {
        const sideStr = id.startsWith("nodes_r") ? "derecho" : "izquierdo";
        const levelNum = id.split("_").pop()?.toUpperCase() || "";
        
        if (textLower.includes("adenopatía") || textLower.includes("adenopatia") || textLower.includes("ganglio") || textLower.includes("ganglios")) {
          // Let's see if this specific side is affected
          const hasRightWord = ["derech", " der ", "der.", " dda ", "dda.", " derecho"].some(k => textLower.includes(k));
          const hasLeftWord = ["izquierd", " izq", "izq.", " iz ", " izquierdo"].some(k => textLower.includes(k));
          const isBilateral = ["bilateral", "ambas cadenas", "ambos lados"].some(k => textLower.includes(k));

          const sideMatches = isBilateral || (sideStr === "derecho" && hasRightWord) || (sideStr === "izquierdo" && hasLeftWord);

          if (sideMatches) {
            if (textLower.includes("reactiv")) {
              detectedState = "adenopatia_reactiva";
              desc = `Adenopatía reactiva en Nivel ${levelNum}.`;
            } else if (textLower.includes("sospechos") || textLower.includes("pérdida de hilio") || textLower.includes("redondead")) {
              detectedState = "adenopatia_sospechosa";
              desc = `Adenopatía sospechosa en Nivel ${levelNum}.`;
            } else if (textLower.includes("linfadenitis")) {
              detectedState = "linfadenitis";
              desc = `Linfadenitis en Nivel ${levelNum}.`;
            } else {
              detectedState = "adenopatia_reactiva";
              desc = `Hallazgo ganglionar alterado en Nivel ${levelNum}.`;
            }
          }
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
        if (textLower.includes("contractura") || textLower.includes("desgarro")) {
          detectedState = "contractura";
          desc = "Contractura muscular cervical.";
        } else if (textLower.includes("masa") || textLower.includes("lipoma")) {
          detectedState = "masa_blanda";
          desc = "Masa de aspecto benigno (lipoma).";
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = id.startsWith("thyroid")
        ? adjustEnlargedDescription(id, desc, generatedReport, detectedState)
        : desc;
      logs.push(`[Heurística] ${id}: ${detectedState.toUpperCase()}`);
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
    logs.push(`Iniciando extracción con IA de niveles cervicales y glándulas salivales (${generatedReport.length} caracteres)...`);

    const structuresList = [
      { id: "thyroid_right_lobe", label: isThyroidectomy ? "Lecho Lobular Derecho" : "Lóbulo Derecho Tiroideo", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "bocio_multinodular", "tiroiditis"] },
      { id: "thyroid_left_lobe", label: isThyroidectomy ? "Lecho Lobular Izquierdo" : "Lóbulo Izquierdo Tiroideo", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "bocio_multinodular", "tiroiditis"] },
      { id: "thyroid_isthmus", label: isThyroidectomy ? "Lecho del Istmo Tiroideo" : "Istmo Tiroideo", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso", "engrosado"] },
      
      { id: "parotid_right", label: "Glándula Parótida Derecha", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      { id: "parotid_left", label: "Glándula Parótida Izquierda", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      { id: "submandibular_right", label: "Glándula Submandibular Derecha", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      { id: "submandibular_left", label: "Glándula Submandibular Izquierda", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      { id: "sublingual_right", label: "Glándula Sublingual Derecha", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      { id: "sublingual_left", label: "Glándula Sublingual Izquierda", allowedStates: ["no_descrito", "normal", "sialoadenitis", "litiasis", "quiste", "solido"] },
      
      // Node Levels (Right)
      { id: "nodes_r_i", label: "Ganglios Nivel I Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_ii", label: "Ganglios Nivel II Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_iii", label: "Ganglios Nivel III Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_iv", label: "Ganglios Nivel IV Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_v", label: "Ganglios Nivel V Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_vi", label: "Ganglios Nivel VI Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_r_vii", label: "Ganglios Nivel VII Derecho", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      
      // Node Levels (Left)
      { id: "nodes_l_i", label: "Ganglios Nivel I Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_ii", label: "Ganglios Nivel II Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_iii", label: "Ganglios Nivel III Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_iv", label: "Ganglios Nivel IV Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_v", label: "Ganglios Nivel V Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_vi", label: "Ganglios Nivel VI Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      { id: "nodes_l_vii", label: "Ganglios Nivel VII Izquierdo", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa", "linfadenitis"] },
      
      { id: "major_vessels", label: "Grandes Vasos Cervicales", allowedStates: ["no_descrito", "normal", "placa_ateroma", "ectasia_yugular", "permeable_sin_alteraciones"] },
      { id: "muscles_soft_tissues", label: "Planos Musculares y Tejidos Blandos", allowedStates: ["no_descrito", "normal", "contractura", "masa_blanda"] }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.6-flash",
          reportText: generatedReport,
          studyType: "Cuello y Tiroides (Completo)",
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
          finalDescriptions[struc.id] = struc.id.startsWith("thyroid")
            ? adjustEnlargedDescription(struc.id, apiDesc, generatedReport, apiState)
            : apiDesc;

          parsedCount++;
          if (apiState !== "normal" && apiState !== "no_descrito") {
            foundPathologies++;
          }
          if (apiState !== "no_descrito") {
            logs.push(`[Hallazgo] ${struc.label}: ${apiState.toUpperCase()} \n  ↳ ${apiDesc}`);
          }
        });

        // Post-processing for general bilateral inflammatory cervical adenopathies
        const textLower = generatedReport.toLowerCase();
        const isGeneralBilateralAdenopathy = [
          "adenopatías cervicales de aspecto inflamatorio",
          "adenopatias cervicales de aspecto inflamatorio",
          "adenopatías de aspecto inflamatorio bilateral",
          "adenopatias de aspecto inflamatorio bilateral",
          "adenopatías de aspecto inflamatorio bilaterales",
          "adenopatias de aspecto inflamatorio bilaterales",
          "adenopatías cervicales bilaterales",
          "adenopatias cervicales bilaterales",
          "adenopatías reactivas bilaterales",
          "adenopatias reactivas bilaterales",
          "adenopatías inflamatorias bilaterales",
          "adenopatias inflamatorias bilaterales"
        ].some(kw => textLower.includes(kw)) || (
          (textLower.includes("adenopatía") || textLower.includes("adenopatia") || textLower.includes("ganglio") || textLower.includes("ganglios")) &&
          (textLower.includes("inflamatori") || textLower.includes("reactiv")) &&
          (textLower.includes("bilateral") || textLower.includes("ambas cadenas") || textLower.includes("ambos lados"))
        );

        if (isGeneralBilateralAdenopathy) {
          const nodeIds = [
            "nodes_r_i", "nodes_r_ii", "nodes_r_iii", "nodes_r_iv", "nodes_r_v", "nodes_r_vi", "nodes_r_vii",
            "nodes_l_i", "nodes_l_ii", "nodes_l_iii", "nodes_l_iv", "nodes_l_v", "nodes_l_vi", "nodes_l_vii"
          ];
          const checkSpecificLevelMentioned = (nodeId: string, text: string) => {
            const levelNum = nodeId.split("_").pop()?.toLowerCase();
            const numMap: Record<string, string[]> = {
              i: ["nivel i", "nivel 1", "nivel ia", "nivel ib", "submentonian", "submandibular"],
              ii: ["nivel ii", "nivel 2", "nivel iia", "nivel iib"],
              iii: ["nivel iii", "nivel 3"],
              iv: ["nivel iv", "nivel 4"],
              v: ["nivel v", "nivel 5", "nivel va", "nivel vb"],
              vi: ["nivel vi", "nivel 6"],
              vii: ["nivel vii", "nivel 7"]
            };
            const kws = numMap[levelNum || ""] || [];
            return kws.some(kw => text.includes(kw));
          };

          nodeIds.forEach(nodeId => {
            if (!checkSpecificLevelMentioned(nodeId, textLower)) {
              finalStates[nodeId] = "normal";
              finalDescriptions[nodeId] = "Dentro de límites normales.";
            }
          });
        }

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con IA. Sincronizadas ${parsedCount} estructuras de Cuello y Tiroides (${foundPathologies} patologías detectadas).`);
      } else {
        logs.push(`[Error API] Fallo al sincronizar. Ejecutando análisis heurístico local.`);
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Error al analizar anatomía de cuello:", err);
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
        fill: isHovered ? "#1e293b" : "rgba(15, 23, 42, 0.4)",
        stroke: isHovered ? "#64748b" : "#334155"
      };
    }
    if (s === "normal") {
      return {
        fill: isHovered ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.12)",
        stroke: "#10b981"
      };
    }
    // Pathologies
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.55)" : "rgba(244, 63, 94, 0.25)",
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
    let md = `| Estructura Anatómica | Detalle / Descripción de Hallazgos Clínicos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      { id: "thyroid_right_lobe", label: isThyroidectomy ? "Lecho Lobular Derecho" : "Lóbulo Derecho Tiroideo" },
      { id: "thyroid_left_lobe", label: isThyroidectomy ? "Lecho Lobular Izquierdo" : "Lóbulo Izquierdo Tiroideo" },
      { id: "thyroid_isthmus", label: isThyroidectomy ? "Lecho del Istmo Tiroideo" : "Istmo Tiroideo" },
      { id: "parotid_right", label: "Glándula Parótida Derecha" },
      { id: "parotid_left", label: "Glándula Parótida Izquierda" },
      { id: "submandibular_right", label: "Glándula Submandibular Derecha" },
      { id: "submandibular_left", label: "Glándula Submandibular Izquierda" },
      { id: "sublingual_right", label: "Glándula Sublingual Derecha" },
      { id: "sublingual_left", label: "Glándula Sublingual Izquierda" },
      
      // Node levels Right
      { id: "nodes_r_i", label: "Nivel Cervical I Derecho" },
      { id: "nodes_r_ii", label: "Nivel Cervical II Derecho" },
      { id: "nodes_r_iii", label: "Nivel Cervical III Derecho" },
      { id: "nodes_r_iv", label: "Nivel Cervical IV Derecho" },
      { id: "nodes_r_v", label: "Nivel Cervical V Derecho" },
      { id: "nodes_r_vi", label: "Nivel Cervical VI Derecho" },
      { id: "nodes_r_vii", label: "Nivel Cervical VII Derecho" },
      
      // Node levels Left
      { id: "nodes_l_i", label: "Nivel Cervical I Izquierdo" },
      { id: "nodes_l_ii", label: "Nivel Cervical II Izquierdo" },
      { id: "nodes_l_iii", label: "Nivel Cervical III Izquierdo" },
      { id: "nodes_l_iv", label: "Nivel Cervical IV Izquierdo" },
      { id: "nodes_l_v", label: "Nivel Cervical V Izquierdo" },
      { id: "nodes_l_vi", label: "Nivel Cervical VI Izquierdo" },
      { id: "nodes_l_vii", label: "Nivel Cervical VII Izquierdo" },
      
      { id: "major_vessels", label: "Grandes Vasos Cervicales" },
      { id: "muscles_soft_tissues", label: "Planos Musculares y Tejidos Blandos" }
    ];

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const rawDesc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        const desc = item.id.startsWith("thyroid")
          ? adjustEnlargedDescription(item.id, rawDesc, generatedReport, states[item.id])
          : rawDesc;
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras cervicales se reportan normales.* |\n`;
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
      const basicDesc = "Dentro de límites normales.";
      const adjustedDesc = id.startsWith("thyroid")
        ? adjustEnlargedDescription(id, basicDesc, generatedReport, s)
        : basicDesc;
      setCustomDescriptions(prev => ({ ...prev, [id]: adjustedDesc }));
    } else {
      const basicDesc = getSimplifiedDescription(id, s);
      const adjustedDesc = id.startsWith("thyroid")
        ? adjustEnlargedDescription(id, basicDesc, generatedReport, s)
        : basicDesc;
      setCustomDescriptions(prev => ({ ...prev, [id]: adjustedDesc }));
    }
  };

  // Bulk category actions
  const bulkAction = (category: "salivary" | "lymph", action: "normal" | "no_descrito") => {
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    const salivaryKeys = ["parotid_right", "parotid_left", "submandibular_right", "submandibular_left", "sublingual_right", "sublingual_left"];
    const lymphKeys = [
      "nodes_r_i", "nodes_r_ii", "nodes_r_iii", "nodes_r_iv", "nodes_r_v", "nodes_r_vi", "nodes_r_vii",
      "nodes_l_i", "nodes_l_ii", "nodes_l_iii", "nodes_l_iv", "nodes_l_v", "nodes_l_vi", "nodes_l_vii"
    ];

    const targetKeys = category === "salivary" ? salivaryKeys : lymphKeys;

    targetKeys.forEach(key => {
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

  const structures: Record<string, NeckStructure> = {
    thyroid_right_lobe: {
      id: "thyroid_right_lobe",
      category: "thyroid",
      name: isThyroidectomy ? "Lecho Lobular Derecho" : "Lóbulo Derecho Tiroideo",
      description: isThyroidectomy ? "Lecho quirúrgico del lóbulo derecho de la tiroides." : "Lóbulo derecho de la glándula tiroides."
    },
    thyroid_left_lobe: {
      id: "thyroid_left_lobe",
      category: "thyroid",
      name: isThyroidectomy ? "Lecho Lobular Izquierdo" : "Lóbulo Izquierdo Tiroideo",
      description: isThyroidectomy ? "Lecho quirúrgico del lóbulo izquierdo de la tiroides." : "Lóbulo izquierdo de la glándula tiroides."
    },
    thyroid_isthmus: {
      id: "thyroid_isthmus",
      category: "thyroid",
      name: isThyroidectomy ? "Lecho del Istmo" : "Istmo Tiroideo",
      description: "Istmo que une ambos lóbulos por delante de la tráquea."
    },
    parotid_right: {
      id: "parotid_right",
      category: "salivary",
      name: "Parótida Derecha",
      description: "Glándula parótida del lado derecho."
    },
    parotid_left: {
      id: "parotid_left",
      category: "salivary",
      name: "Parótida Izquierda",
      description: "Glándula parótida del lado izquierdo."
    },
    submandibular_right: {
      id: "submandibular_right",
      category: "salivary",
      name: "Submandibular Derecha",
      description: "Glándula salival submandibular del lado derecho."
    },
    submandibular_left: {
      id: "submandibular_left",
      category: "salivary",
      name: "Submandibular Izquierda",
      description: "Glándula salival submandibular del lado izquierdo."
    },
    sublingual_right: {
      id: "sublingual_right",
      category: "salivary",
      name: "Sublingual Derecha",
      description: "Glándula salival sublingual del lado derecho."
    },
    sublingual_left: {
      id: "sublingual_left",
      category: "salivary",
      name: "Sublingual Izquierda",
      description: "Glándula salival sublingual del lado izquierdo."
    },
    
    // Right lymph levels
    nodes_r_i: { id: "nodes_r_i", category: "lymph", name: "Nivel I Derecho", description: "Ganglios submentoniano (IA) y submandibular (IB) derechos." },
    nodes_r_ii: { id: "nodes_r_ii", category: "lymph", name: "Nivel II Derecho", description: "Ganglios cervicales yugulares superiores derechos." },
    nodes_r_iii: { id: "nodes_r_iii", category: "lymph", name: "Nivel III Derecho", description: "Ganglios cervicales yugulares medios derechos." },
    nodes_r_iv: { id: "nodes_r_iv", category: "lymph", name: "Nivel IV Derecho", description: "Ganglios cervicales yugulares inferiores derechos." },
    nodes_r_v: { id: "nodes_r_v", category: "lymph", name: "Nivel V Derecho", description: "Ganglios del triángulo cervical posterior derecho." },
    nodes_r_vi: { id: "nodes_r_vi", category: "lymph", name: "Nivel VI Derecho", description: "Ganglios del compartimento anterior derecho." },
    nodes_r_vii: { id: "nodes_r_vii", category: "lymph", name: "Nivel VII Derecho", description: "Ganglios del mediastino superior derecho." },

    // Left lymph levels
    nodes_l_i: { id: "nodes_l_i", category: "lymph", name: "Nivel I Izquierdo", description: "Ganglios submentoniano (IA) y submandibular (IB) izquierdos." },
    nodes_l_ii: { id: "nodes_l_ii", category: "lymph", name: "Nivel II Izquierdo", description: "Ganglios cervicales yugulares superiores izquierdos." },
    nodes_l_iii: { id: "nodes_l_iii", category: "lymph", name: "Nivel III Izquierdo", description: "Ganglios cervicales yugulares medios izquierdos." },
    nodes_l_iv: { id: "nodes_l_iv", category: "lymph", name: "Nivel IV Izquierdo", description: "Ganglios cervicales yugulares inferiores izquierdos." },
    nodes_l_v: { id: "nodes_l_v", category: "lymph", name: "Nivel V Izquierdo", description: "Ganglios del triángulo cervical posterior izquierdo." },
    nodes_l_vi: { id: "nodes_l_vi", category: "lymph", name: "Nivel VI Izquierdo", description: "Ganglios del compartimento anterior izquierdo." },
    nodes_l_vii: { id: "nodes_l_vii", category: "lymph", name: "Nivel VII Izquierdo", description: "Ganglios del mediastino superior izquierdo." },

    major_vessels: {
      id: "major_vessels",
      category: "other",
      name: "Grandes Vasos Cervicales",
      description: "Permeabilidad carotídea y venosa yugular."
    },
    muscles_soft_tissues: {
      id: "muscles_soft_tissues",
      category: "other",
      name: "Músculos y Tejidos Blandos",
      description: "Planos musculares y compartimentos de partes blandas."
    }
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
            Mapeo de niveles cervicales ganglionares (I-VII) y glándulas salivales mayores.
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
        
        {/* LEFT COLUMN: ANATOMY MAPS PANEL */}
        <div className="lg:col-span-7 bg-slate-950/55 border border-slate-850/50 rounded-xl p-4 flex flex-col items-center">
          
          {/* VIEW MODE SELECTION TABS */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 w-full justify-between items-center max-w-sm">
            <button
              onClick={() => setSubViewMode("dual")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${subViewMode === "dual" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              VISTA DUAL
            </button>
            <button
              onClick={() => setSubViewMode("thyroid")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${subViewMode === "thyroid" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              TIROIDES
            </button>
            <button
              onClick={() => setSubViewMode("cervical")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${subViewMode === "cervical" ? "bg-indigo-600 text-slate-50 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Cervical / Salivales
            </button>
          </div>

          <div id="neck-diagram-scaffold" className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full py-2">
            
            {/* THYROID MAP */}
            {(subViewMode === "dual" || subViewMode === "thyroid") && (
              <div className="flex flex-col items-center w-full max-w-[240px]">
                <div className={`text-[10px] uppercase font-bold font-mono tracking-wider mb-2 flex items-center gap-1 leading-none ${isThyroidectomy ? "text-emerald-400" : "text-slate-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isThyroidectomy ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`}></span>
                  {isThyroidectomy ? "Lecho Tiroideo (Postquirúrgico)" : "Glándula Tiroides"}
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

                  {isThyroidectomy ? (
                    <>
                      {/* LECHO ISTMO */}
                      <g 
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => setSelectedStructure("thyroid_isthmus")}
                        onMouseEnter={() => setActiveHover("thyroid_isthmus")}
                        onMouseLeave={() => setActiveHover(null)}
                      >
                        <path 
                          d="M 85,135 Q 120,150 155,135 Q 160,115 155,108 Q 120,123 85,108 Z" 
                          fill={states.thyroid_isthmus !== "normal" && states.thyroid_isthmus !== "no_descrito" ? getColorForSVG("thyroid_isthmus").fill : "rgba(148, 163, 184, 0.05)"}
                          stroke={states.thyroid_isthmus !== "normal" && states.thyroid_isthmus !== "no_descrito" ? getColorForSVG("thyroid_isthmus").stroke : "#64748b"}
                          strokeWidth={states.thyroid_isthmus !== "normal" && states.thyroid_isthmus !== "no_descrito" ? "2.5" : "1.2"}
                          strokeDasharray="4,3"
                        />
                        <circle cx="120" cy="122" r="3" fill="#81a1c1" />
                        <line x1="120" y1="122" x2="120" y2="82" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>

                      {/* LECHO LÓBULO DERECHO (Anatomical Right = Screen Left) */}
                      <g 
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => setSelectedStructure("thyroid_right_lobe")}
                        onMouseEnter={() => setActiveHover("thyroid_right_lobe")}
                        onMouseLeave={() => setActiveHover(null)}
                      >
                        <path 
                          d="M 104,74 C 95,50 68,54 53,85 C 40,110 40,140 55,165 C 68,185 96,170 104,146 Z" 
                          fill={states.thyroid_right_lobe !== "normal" && states.thyroid_right_lobe !== "no_descrito" ? getColorForSVG("thyroid_right_lobe").fill : "rgba(148, 163, 184, 0.05)"}
                          stroke={states.thyroid_right_lobe !== "normal" && states.thyroid_right_lobe !== "no_descrito" ? getColorForSVG("thyroid_right_lobe").stroke : "#475569"}
                          strokeWidth={states.thyroid_right_lobe !== "normal" && states.thyroid_right_lobe !== "no_descrito" ? "2.5" : "1.2"}
                          strokeDasharray="5,4"
                        />
                        <circle cx="78" cy="120" r="3.5" fill="#81a1c1" />
                        <line x1="78" y1="120" x2="35" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>

                      {/* LECHO LÓBULO IZQUIERDO (Anatomical Left = Screen Right) */}
                      <g 
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => setSelectedStructure("thyroid_left_lobe")}
                        onMouseEnter={() => setActiveHover("thyroid_left_lobe")}
                        onMouseLeave={() => setActiveHover(null)}
                      >
                        <path 
                          d="M 136,74 C 145,50 172,54 187,85 C 200,110 200,140 185,165 C 172,185 144,170 136,146 Z" 
                          fill={states.thyroid_left_lobe !== "normal" && states.thyroid_left_lobe !== "no_descrito" ? getColorForSVG("thyroid_left_lobe").fill : "rgba(148, 163, 184, 0.05)"}
                          stroke={states.thyroid_left_lobe !== "normal" && states.thyroid_left_lobe !== "no_descrito" ? getColorForSVG("thyroid_left_lobe").stroke : "#475569"}
                          strokeWidth={states.thyroid_left_lobe !== "normal" && states.thyroid_left_lobe !== "no_descrito" ? "2.5" : "1.2"}
                          strokeDasharray="5,4"
                        />
                        <circle cx="162" cy="120" r="3.5" fill="#81a1c1" />
                        <line x1="162" y1="120" x2="205" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>
                    </>
                  ) : (
                    <>
                      {/* ISTMO TIROIDEO (Normal) */}
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
                          fillOpacity="0.8"
                        />
                        <circle cx="120" cy="122" r="3" fill="#81a1c1" />
                        <line x1="120" y1="122" x2="120" y2="82" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>

                      {/* LÓBULO DERECHO (Anatomical Right = Screen Left) */}
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
                          fillOpacity="0.85"
                        />
                        <circle cx="78" cy="120" r="3.5" fill="#81a1c1" />
                        <line x1="78" y1="120" x2="35" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>

                      {/* LÓBULO IZQUIERDO (Anatomical Left = Screen Right) */}
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
                          fillOpacity="0.85"
                        />
                        <circle cx="162" cy="120" r="3.5" fill="#81a1c1" />
                        <line x1="162" y1="120" x2="205" y2="90" stroke="#4c566a" strokeWidth="0.5" strokeDasharray="1,2" />
                      </g>
                    </>
                  )}

                  {/* Text Labels */}
                  <text x="78" y="44" fill="#64748b" fontSize="8" fontWeight="black" textAnchor="middle">DER</text>
                  <text x="162" y="44" fill="#64748b" fontSize="8" fontWeight="black" textAnchor="middle">IZQ</text>
                  
                  <text x="35" y="84" fill="#cbd5e1" fontSize="7" textAnchor="middle" opacity="0.8" fontWeight="bold">
                    {isThyroidectomy ? "LECHO D." : "LÓB. D"}
                  </text>
                  <text x="205" y="84" fill="#cbd5e1" fontSize="7" textAnchor="middle" opacity="0.8" fontWeight="bold">
                    {isThyroidectomy ? "LECHO I." : "LÓB. I"}
                  </text>
                  <text x="120" y="75" fill="#cbd5e1" fontSize="7" textAnchor="middle" opacity="0.8" fontWeight="bold">
                    {isThyroidectomy ? "ISTMO" : "ISTMO"}
                  </text>
                </svg>
              </div>
            )}

            {/* UPGRADED CERVICAL LEVELS & SALIVARY GLANDS MAP */}
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
                  {/* Faint Neck and Jaw Outline */}
                  <path d="M 40,40 C 40,80 55,180 30,220 L 210,220 C 185,180 200,80 200,40" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                  <path d="M 25,25 Q 120,70 215,25" fill="none" stroke="#475569" strokeWidth="1.2" opacity="0.6" />

                  {/* GLÁNDULAS SALIVALES */}
                  
                  {/* Parótida Derecha */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("parotid_right")}
                    onMouseEnter={() => setActiveHover("parotid_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse cx="45" cy="55" rx="13" ry="18" fill={getColorForSVG("parotid_right").fill} stroke={getColorForSVG("parotid_right").stroke} strokeWidth="1.2" />
                    <text x="45" y="58" fill={states.parotid_right === "no_descrito" ? "#64748b" : "#fff"} fontSize="6.5" fontWeight="bold" textAnchor="middle">PD</text>
                  </g>

                  {/* Parótida Izquierda */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("parotid_left")}
                    onMouseEnter={() => setActiveHover("parotid_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse cx="195" cy="55" rx="13" ry="18" fill={getColorForSVG("parotid_left").fill} stroke={getColorForSVG("parotid_left").stroke} strokeWidth="1.2" />
                    <text x="195" y="58" fill={states.parotid_left === "no_descrito" ? "#64748b" : "#fff"} fontSize="6.5" fontWeight="bold" textAnchor="middle">PI</text>
                  </g>

                  {/* Submandibular Derecha */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("submandibular_right")}
                    onMouseEnter={() => setActiveHover("submandibular_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse cx="76" cy="65" rx="11" ry="11" fill={getColorForSVG("submandibular_right").fill} stroke={getColorForSVG("submandibular_right").stroke} strokeWidth="1.2" />
                    <text x="76" y="68" fill={states.submandibular_right === "no_descrito" ? "#64748b" : "#fff"} fontSize="6" fontWeight="bold" textAnchor="middle">SMD</text>
                  </g>

                  {/* Submandibular Izquierda */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("submandibular_left")}
                    onMouseEnter={() => setActiveHover("submandibular_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <ellipse cx="164" cy="65" rx="11" ry="11" fill={getColorForSVG("submandibular_left").fill} stroke={getColorForSVG("submandibular_left").stroke} strokeWidth="1.2" />
                    <text x="164" y="68" fill={states.submandibular_left === "no_descrito" ? "#64748b" : "#fff"} fontSize="6" fontWeight="bold" textAnchor="middle">SMI</text>
                  </g>

                  {/* Sublingual Derecha */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("sublingual_right")}
                    onMouseEnter={() => setActiveHover("sublingual_right")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <circle cx="100" cy="56" r="8" fill={getColorForSVG("sublingual_right").fill} stroke={getColorForSVG("sublingual_right").stroke} strokeWidth="1.2" />
                    <text x="100" y="59" fill={states.sublingual_right === "no_descrito" ? "#64748b" : "#fff"} fontSize="5.5" fontWeight="bold" textAnchor="middle">SLD</text>
                  </g>

                  {/* Sublingual Izquierda */}
                  <g 
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setSelectedStructure("sublingual_left")}
                    onMouseEnter={() => setActiveHover("sublingual_left")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <circle cx="140" cy="56" r="8" fill={getColorForSVG("sublingual_left").fill} stroke={getColorForSVG("sublingual_left").stroke} strokeWidth="1.2" />
                    <text x="140" y="59" fill={states.sublingual_left === "no_descrito" ? "#64748b" : "#fff"} fontSize="5.5" fontWeight="bold" textAnchor="middle">SLI</text>
                  </g>

                  {/* NIVELES GANGLIONARES DERECHOS (Screen Left) */}
                  
                  {/* Nivel I Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_i")} onMouseEnter={() => setActiveHover("nodes_r_i")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="82" y="78" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_i").fill} stroke={getColorForSVG("nodes_r_i").stroke} strokeWidth="1.2" />
                    <text x="93" y="89" fill={states.nodes_r_i === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">I</text>
                  </g>

                  {/* Nivel II Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_ii")} onMouseEnter={() => setActiveHover("nodes_r_ii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="52" y="100" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_ii").fill} stroke={getColorForSVG("nodes_r_ii").stroke} strokeWidth="1.2" />
                    <text x="63" y="111" fill={states.nodes_r_ii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">II</text>
                  </g>

                  {/* Nivel III Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_iii")} onMouseEnter={() => setActiveHover("nodes_r_iii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="52" y="122" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_iii").fill} stroke={getColorForSVG("nodes_r_iii").stroke} strokeWidth="1.2" />
                    <text x="63" y="133" fill={states.nodes_r_iii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">III</text>
                  </g>

                  {/* Nivel IV Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_iv")} onMouseEnter={() => setActiveHover("nodes_r_iv")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="52" y="144" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_iv").fill} stroke={getColorForSVG("nodes_r_iv").stroke} strokeWidth="1.2" />
                    <text x="63" y="155" fill={states.nodes_r_iv === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">IV</text>
                  </g>

                  {/* Nivel V Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_v")} onMouseEnter={() => setActiveHover("nodes_r_v")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="24" y="111" width="22" height="32" rx="4" fill={getColorForSVG("nodes_r_v").fill} stroke={getColorForSVG("nodes_r_v").stroke} strokeWidth="1.2" />
                    <text x="35" y="130" fill={states.nodes_r_v === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">V</text>
                  </g>

                  {/* Nivel VI Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_vi")} onMouseEnter={() => setActiveHover("nodes_r_vi")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="82" y="144" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_vi").fill} stroke={getColorForSVG("nodes_r_vi").stroke} strokeWidth="1.2" />
                    <text x="93" y="155" fill={states.nodes_r_vi === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">VI</text>
                  </g>

                  {/* Nivel VII Derecho */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_r_vii")} onMouseEnter={() => setActiveHover("nodes_r_vii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="82" y="166" width="22" height="16" rx="4" fill={getColorForSVG("nodes_r_vii").fill} stroke={getColorForSVG("nodes_r_vii").stroke} strokeWidth="1.2" />
                    <text x="93" y="177" fill={states.nodes_r_vii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">VII</text>
                  </g>

                  {/* NIVELES GANGLIONARES IZQUIERDOS (Screen Right) */}
                  
                  {/* Nivel I Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_i")} onMouseEnter={() => setActiveHover("nodes_l_i")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="136" y="78" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_i").fill} stroke={getColorForSVG("nodes_l_i").stroke} strokeWidth="1.2" />
                    <text x="147" y="89" fill={states.nodes_l_i === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">I</text>
                  </g>

                  {/* Nivel II Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_ii")} onMouseEnter={() => setActiveHover("nodes_l_ii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="166" y="100" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_ii").fill} stroke={getColorForSVG("nodes_l_ii").stroke} strokeWidth="1.2" />
                    <text x="177" y="111" fill={states.nodes_l_ii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">II</text>
                  </g>

                  {/* Nivel III Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_iii")} onMouseEnter={() => setActiveHover("nodes_l_iii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="166" y="122" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_iii").fill} stroke={getColorForSVG("nodes_l_iii").stroke} strokeWidth="1.2" />
                    <text x="177" y="133" fill={states.nodes_l_iii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">III</text>
                  </g>

                  {/* Nivel IV Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_iv")} onMouseEnter={() => setActiveHover("nodes_l_iv")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="166" y="144" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_iv").fill} stroke={getColorForSVG("nodes_l_iv").stroke} strokeWidth="1.2" />
                    <text x="177" y="155" fill={states.nodes_l_iv === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">IV</text>
                  </g>

                  {/* Nivel V Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_v")} onMouseEnter={() => setActiveHover("nodes_l_v")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="194" y="111" width="22" height="32" rx="4" fill={getColorForSVG("nodes_l_v").fill} stroke={getColorForSVG("nodes_l_v").stroke} strokeWidth="1.2" />
                    <text x="205" y="130" fill={states.nodes_l_v === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">V</text>
                  </g>

                  {/* Nivel VI Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_vi")} onMouseEnter={() => setActiveHover("nodes_l_vi")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="136" y="144" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_vi").fill} stroke={getColorForSVG("nodes_l_vi").stroke} strokeWidth="1.2" />
                    <text x="147" y="155" fill={states.nodes_l_vi === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">VI</text>
                  </g>

                  {/* Nivel VII Izquierdo */}
                  <g className="cursor-pointer" onClick={() => setSelectedStructure("nodes_l_vii")} onMouseEnter={() => setActiveHover("nodes_l_vii")} onMouseLeave={() => setActiveHover(null)}>
                    <rect x="136" y="166" width="22" height="16" rx="4" fill={getColorForSVG("nodes_l_vii").fill} stroke={getColorForSVG("nodes_l_vii").stroke} strokeWidth="1.2" />
                    <text x="147" y="177" fill={states.nodes_l_vii === "no_descrito" ? "#64748b" : "#fff"} fontSize="7" fontWeight="black" textAnchor="middle">VII</text>
                  </g>

                  {/* Vascular & Muscle zones */}
                  <text x="120" y="212" fill="#475569" fontSize="6" fontWeight="bold" textAnchor="middle">NIVELES CERVICALES D / I</text>
                </svg>
              </div>
            )}
          </div>

          <div className="w-full text-center mt-3">
            <p className="text-[10px] text-slate-500 italic max-w-md mx-auto select-none">
              Haz clic en cualquier glándula o nivel cervical (I-VII) en el diagrama para seleccionarla y configurar manualmente su estado patológico o desactivarla.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE EDITOR & QUICK SWITCHES */}
        <div className="lg:col-span-5 flex flex-col gap-4 text-left">
          
          {/* SELECTOR DROPDOWN */}
          <div className="bg-slate-950/40 p-3.5 border border-slate-850/50 rounded-xl">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1.5 font-mono select-none">
              Estructura Seleccionada:
            </label>
            <div className="relative">
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              >
                {Object.values(structures).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {states[item.id] === "no_descrito" ? "∅ Omitido" : states[item.id] === "normal" ? "✓ Normal" : "⚠ Alterado"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic select-none">
              {structures[selectedStructure]?.description}
            </p>
          </div>

          {/* QUICK TOGGLE BUTTONS FOR GROUPS (ACTIVAR/DESACTIVAR) */}
          <div className="bg-slate-950/40 p-3 border border-slate-850/50 rounded-xl space-y-3">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 font-mono select-none">
              Acciones Rápidas (Activar / Desactivar Grupos):
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Salivary Glands Actions */}
              <div className="bg-slate-900/60 p-2 border border-slate-800/40 rounded-xl space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-300 font-mono">Glándulas Salivales</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => bulkAction("salivary", "normal")}
                    className="w-full py-1 px-2 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-center transition-all cursor-pointer"
                  >
                    Activar Todas (Normal)
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkAction("salivary", "no_descrito")}
                    className="w-full py-1 px-2 text-[9px] font-black uppercase tracking-wider bg-slate-800/60 hover:bg-slate-800 text-slate-400 border border-slate-700/30 rounded-lg text-center transition-all cursor-pointer"
                  >
                    Desactivar Todas
                  </button>
                </div>
              </div>

              {/* Lymph Nodes Actions */}
              <div className="bg-slate-900/60 p-2 border border-slate-800/40 rounded-xl space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-300 font-mono">Niveles Ganglionares</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => bulkAction("lymph", "normal")}
                    className="w-full py-1 px-2 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-center transition-all cursor-pointer"
                  >
                    Activar Todos (Normal)
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkAction("lymph", "no_descrito")}
                    className="w-full py-1 px-2 text-[9px] font-black uppercase tracking-wider bg-slate-800/60 hover:bg-slate-800 text-slate-400 border border-slate-700/30 rounded-lg text-center transition-all cursor-pointer"
                  >
                    Desactivar Todos
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE STATUS CONTROL FOR INDIVIDUAL SELECTION */}
          <div className="bg-slate-950/40 p-4 border border-slate-850/50 rounded-xl space-y-3">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 font-mono select-none">
              Manejo de Hallazgo y Diagnóstico:
            </span>

            <div className="flex flex-col gap-2.5">
              {/* Quick toggle state buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleStateChange(selectedStructure, "normal")}
                  className={`flex-1 py-1.5 px-3 text-[10px] rounded-lg border transition-all cursor-pointer font-black uppercase tracking-wider text-center ${
                    states[selectedStructure] === "normal"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-600 shadow-md shadow-emerald-950/20"
                      : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-500"
                  }`}
                >
                  ✓ Activo (Normal)
                </button>
                
                <button
                  type="button"
                  onClick={() => handleStateChange(selectedStructure, "no_descrito")}
                  className={`flex-1 py-1.5 px-3 text-[10px] rounded-lg border transition-all cursor-pointer font-black uppercase tracking-wider text-center ${
                    states[selectedStructure] === "no_descrito"
                      ? "bg-slate-800 text-slate-100 border-slate-600 shadow-md"
                      : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-500"
                  }`}
                >
                  ⚪ Desactivado / Omitido
                </button>
              </div>

              {/* Specific Diagnosis text field (only shown if not deactivated) */}
              {states[selectedStructure] !== "no_descrito" && (
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono select-none">
                    Diagnóstico Patológico / Hallazgo de Subespecialidad:
                  </label>
                  <input
                    type="text"
                    value={states[selectedStructure] === "normal" ? "" : states[selectedStructure]}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleStateChange(selectedStructure, val.trim() === "" ? "normal" : val);
                    }}
                    placeholder="Ej: Adenopatía reactiva, Sialoadenitis crónica, Litiasis, Nódulo TIRADS 4..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none transition-all placeholder:text-slate-600"
                  />
                  <p className="text-[9px] text-slate-500 leading-normal">
                    Escriba la patología exacta descrita en el reporte. Al escribir un hallazgo, se considerará alterado de forma automática en el mapeo anatómico.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* EDITABLE DETAILED DESCRIPTION */}
          <div className="bg-slate-950/40 p-4 border border-slate-850/50 rounded-xl flex flex-col gap-2">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 font-mono select-none">
              Descripción Clínica Detallada (Manual):
            </label>
            <textarea
              value={customDescriptions[selectedStructure] || ""}
              onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: e.target.value }))}
              placeholder="Ej: Dentro de límites normales o inserte descripción de hallazgo patológico con sus medidas..."
              disabled={states[selectedStructure] === "no_descrito"}
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed font-medium text-slate-200"
            />
          </div>

          {/* INJECT BUTTON */}
          <div className="flex gap-2">
            <button
              onClick={triggerExport}
              disabled={badges.empty === Object.keys(states).length}
              className="flex-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white text-slate-200 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Inyectar Tabla (Sinopsis)
            </button>
          </div>
        </div>
      </div>

      {/* NLP IA AUDIT LOGS */}
      {syncLogs.length > 0 && (
        <div className="mt-5 border-t border-slate-800/80 pt-4 text-left">
          <details className="group">
            <summary className="list-none flex items-center justify-between text-[10px] uppercase font-black tracking-wider text-slate-500 hover:text-slate-400 cursor-pointer select-none font-mono">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
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
