import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Check, 
  Layers,
  Download,
  HelpCircle, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";

interface BreastAnatomyViewerProps {
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
  externalBilateralOverride?: boolean | null;
  externalBilateralType?: "quistes" | "fibroadenomas" | null;
  onChangeBilateralOverride?: (override: boolean | null, type: "quistes" | "fibroadenomas" | null) => void;
}

export default function BreastAnatomyViewer({
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
  externalBilateralOverride = null,
  externalBilateralType = null,
  onChangeBilateralOverride
}: BreastAnatomyViewerProps) {
  
  // Breast structures state:
  // - "no_descrito": Omitted from table/diagrams
  // - "normal": Within normal limits (not included in the findings table)
  // - "hallazgo": Active pathologic finding (included in table)
  // Two breasts: Right (md_) and Left (mi_)
  const initialKeys = [
    // Right Breast
    "md_eje1", "md_eje2", "md_eje3", "md_eje4", "md_eje5", "md_eje6", 
    "md_eje7", "md_eje8", "md_eje9", "md_eje10", "md_eje11", "md_eje12",
    "md_retroareolar", "md_cola_spence", "md_axila",
    // Left Breast
    "mi_eje1", "mi_eje2", "mi_eje3", "mi_eje4", "mi_eje5", "mi_eje6", 
    "mi_eje7", "mi_eje8", "mi_eje9", "mi_eje10", "mi_eje11", "mi_eje12",
    "mi_retroareolar", "mi_cola_spence", "mi_axila"
  ];

  const [states, setStates] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    initialKeys.forEach(k => {
      s[k] = "no_descrito";
    });
    return s;
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    initialKeys.forEach(k => {
      d[k] = "";
    });
    return d;
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("md_retroareolar");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

  const lastReceivedStates = useRef<string>("");
  const lastReceivedDescriptions = useRef<string>("");

  useEffect(() => {
    if (externalStates && Object.keys(externalStates).length > 0) {
      const extStr = JSON.stringify(externalStates);
      if (extStr !== lastReceivedStates.current) {
        lastReceivedStates.current = extStr;
        setStates(prev => {
          const changed = Object.keys(externalStates).some(key => externalStates[key] !== prev[key]);
          return changed ? { ...prev, ...externalStates } : prev;
        });
      }
    }
  }, [externalStates]);

  useEffect(() => {
    if (externalDescriptions && Object.keys(externalDescriptions).length > 0) {
      const extStr = JSON.stringify(externalDescriptions);
      if (extStr !== lastReceivedDescriptions.current) {
        lastReceivedDescriptions.current = extStr;
        setCustomDescriptions(prev => {
          const changed = Object.keys(externalDescriptions).some(key => externalDescriptions[key] !== prev[key]);
          return changed ? { ...prev, ...externalDescriptions } : prev;
        });
      }
    }
  }, [externalDescriptions]);

  const [manualBilateralOverride, setManualBilateralOverride] = useState<boolean | null>(externalBilateralOverride);
  const [manualBilateralType, setManualBilateralType] = useState<"quistes" | "fibroadenomas" | null>(externalBilateralType);

  useEffect(() => {
    setManualBilateralOverride(externalBilateralOverride);
  }, [externalBilateralOverride]);

  useEffect(() => {
    setManualBilateralType(externalBilateralType);
  }, [externalBilateralType]);

  const textNorm = (generatedReport || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Detect bilateral benign conditions STRICTLY (must explicitly mention "multiple"/"multiples" AND "bilateral"/"bilaterales")
  const autoHasQuistesBilaterales = 
    (textNorm.includes("quiste") && 
     (textNorm.includes("bilateral") || textNorm.includes("bilaterales")) && 
     (textNorm.includes("multiple") || textNorm.includes("multiples") || textNorm.includes("multip") || textNorm.includes("varios") || textNorm.includes("diversos")));

  const autoHasFibroadenomasBilaterales = 
    (textNorm.includes("fibroadenoma") && 
     (textNorm.includes("bilateral") || textNorm.includes("bilaterales")) && 
     (textNorm.includes("multiple") || textNorm.includes("multiples") || textNorm.includes("multip") || textNorm.includes("varios") || textNorm.includes("diversos")));

  const autoBilateralActive = autoHasQuistesBilaterales || autoHasFibroadenomasBilaterales;

  const isBilateralBenignActive = manualBilateralOverride !== null 
    ? manualBilateralOverride 
    : autoBilateralActive;

  const hasQuistesBilaterales = isBilateralBenignActive 
    ? (manualBilateralOverride !== null 
        ? (manualBilateralType === "quistes")
        : autoHasQuistesBilaterales)
    : false;

  const hasFibroadenomasBilaterales = isBilateralBenignActive 
    ? (manualBilateralOverride !== null 
        ? (manualBilateralType === "fibroadenomas")
        : autoHasFibroadenomasBilaterales)
    : false;

  // Dedicated breast implant schema states - Bilateral support
  const [breastImplantForceActive, setBreastImplantForceActive] = useState<boolean>(false);
  const [implantActiveSide, setImplantActiveSide] = useState<"MD" | "MI">("MD");

  // Right Side (MD) Implant states
  const [breastImplantRuptureIntraMD, setBreastImplantRuptureIntraMD] = useState<boolean>(false);
  const [breastImplantRuptureExtraMD, setBreastImplantRuptureExtraMD] = useState<boolean>(false);
  const [breastImplantFluidMD, setBreastImplantFluidMD] = useState<boolean>(false);
  const [breastImplantFoldsMD, setBreastImplantFoldsMD] = useState<boolean>(false);
  const [breastImplantCapsuleMD, setBreastImplantCapsuleMD] = useState<boolean>(false);

  // Left Side (MI) Implant states
  const [breastImplantRuptureIntraMI, setBreastImplantRuptureIntraMI] = useState<boolean>(false);
  const [breastImplantRuptureExtraMI, setBreastImplantRuptureExtraMI] = useState<boolean>(false);
  const [breastImplantFluidMI, setBreastImplantFluidMI] = useState<boolean>(false);
  const [breastImplantFoldsMI, setBreastImplantFoldsMI] = useState<boolean>(false);
  const [breastImplantCapsuleMI, setBreastImplantCapsuleMI] = useState<boolean>(false);

  const isImplantImpressionActive = (): boolean => {
    if (!generatedReport) return false;
    const normalized = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const keywords = [
      "implante", "implantes", "protesis", "prótesis", "protesico", "protésico", "silicona", "mamoplastia"
    ];
    return keywords.some(kw => normalized.includes(kw));
  };

  const isImplantActive = isImplantImpressionActive() || breastImplantForceActive;

  const getImpressionTextSection = (text: string): string => {
    if (!text) return "";
    const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const rawHeaders = [
      "impresion diagnostica",
      "impresion clinica",
      "conclusiones",
      "conclusion",
      "diagnosticos",
      "diagnostico",
      "sintesis diagnostica",
      "sintesis"
    ];
    
    const headers = rawHeaders.map(h => h.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    
    let lastIdx = -1;
    let matchedHeaderLength = 0;
    
    for (const header of headers) {
      const idx = lower.lastIndexOf(header);
      if (idx > lastIdx) {
        lastIdx = idx;
        matchedHeaderLength = header.length;
      }
    }
    
    if (lastIdx !== -1) {
      let offset = matchedHeaderLength;
      while (offset < 20 && lastIdx + offset < text.length) {
        const char = text.charAt(lastIdx + offset);
        if (char === ":" || char === " " || char === "\n" || char === "\r" || char === "-") {
          offset++;
        } else {
          break;
        }
      }
      return text.substring(lastIdx + offset);
    }
    return text;
  };

  const extractSentenceForBreast = (reportText: string, id: string, fallback: string): string => {
    if (!reportText) return fallback;
    const isRight = id.startsWith("md_");
    const { primary } = getStructureKeywords(id);
    if (primary.length === 0) return fallback;

    const section = getImpressionTextSection(reportText);

    const findMatchInText = (text: string, prioritizeSideAffinity: boolean): string => {
      if (!text) return "";
      const sentences = text.split(/(?:\.|\n|\r|;|\n\n)+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        
        const normalizedSentence = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const matchesPrimary = primary.some(kw => {
          const normalizedKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return normalizedSentence.includes(normalizedKw);
        });
        
        if (matchesPrimary) {
          const hasRightAffinity = /\b(derecha|derecho|der|md|m\.d|m\. derecho|m. derecho|mama d)\b/gi.test(trimmed);
          const hasLeftAffinity = /\b(izquierda|izquierdo|izq|mi|m\.i|m\. izquierdo|m. izquierdo|mama i)\b/gi.test(trimmed);
          
          if (prioritizeSideAffinity) {
            if (isRight && hasLeftAffinity && !hasRightAffinity) continue;
            if (!isRight && hasRightAffinity && !hasLeftAffinity) continue;
          }

          let cleanStr = trimmed;
          // Clean list bullet symbols and spaces
          cleanStr = cleanStr.replace(/^[\s*\-|#\d.?+•\t]+/g, "").trim();
          // Clear prefix labels e.g. "MAMA DERECHA: " or "**MAMA IZQUIERDA**:" or "M.D - EJE 12:"
          cleanStr = cleanStr.replace(/^(?:\*\*[^*]+\*\*|[^*:]+):\s*/g, "").trim();

          if (cleanStr.length > 0) {
            cleanStr = cleanStr.charAt(0).toUpperCase() + cleanStr.slice(1);
          } else {
            cleanStr = trimmed;
          }

          if (!cleanStr.endsWith(".")) {
            cleanStr = `${cleanStr}.`;
          }
          return cleanStr;
        }
      }
      return "";
    };

    let match = findMatchInText(section, true);
    if (match) return match;

    match = findMatchInText(reportText, true);
    if (match) return match;

    match = findMatchInText(section, false);
    if (match) return match;

    match = findMatchInText(reportText, false);
    return match || fallback;
  };

  const updateReportTextWithImplantFinding = (
    currentText: string,
    side: "MD" | "MI",
    findingType: "intra" | "extra" | "fluid" | "folds" | "capsule",
    checked: boolean
  ): string => {
    if (!currentText) return currentText;

    const sentencesMap: Record<"MD" | "MI", Record<string, string>> = {
      MD: {
        intra: "En la mama derecha se evidencian signos de ruptura intracapsular de la prótesis, con colapso de la cubierta y signo de linguini.",
        extra: "En la mama derecha se evidencian signos de ruptura extracapsular con presencia de siliconoma extracapsular e infiltración.",
        fluid: "Se aprecia una colección líquida anecoica periprotésica compatible con seroma periprotésico reactivo en la mama derecha.",
        folds: "Se identifican pliegues radiales pronunciados de la cubierta de silicona en la prótesis de la mama derecha.",
        capsule: "Se observa engrosamiento de la cápsula con signos de contractura y calcificación capsular reactiva en la mama derecha."
      },
      MI: {
        intra: "En la mama izquierda se evidencian signos de ruptura intracapsular de la prótesis, con colapso de la cubierta y signo de linguini.",
        extra: "En la mama izquierda se evidencian signos de ruptura extracapsular con presencia de siliconoma extracapsular e infiltración.",
        fluid: "Se aprecia una colección líquida anecoica periprotésica compatible con seroma periprotésico reactivo en la mama izquierda.",
        folds: "Se identifican pliegues radiales pronunciados de la cubierta de silicona en la prótesis de la mama izquierda.",
        capsule: "Se observa engrosamiento de la cápsula con signos de contractura y calcificación capsular reactiva en la mama izquierda."
      }
    };

    const sentenceToInsert = sentencesMap[side][findingType];
    const keywords: Record<string, string[]> = {
      intra: ["ruptura intracapsular", "rotura intracapsular", "linguini"],
      extra: ["ruptura extracapsular", "rotura extracapsular", "siliconoma", "extracapsular"],
      fluid: ["seroma", "colección líquida", "coleccion liquida", "líquido periprotesico", "liquido periprotesico"],
      folds: ["pliegues radiales", "pliegue radial", "pliegues de la cubierta"],
      capsule: ["contractura capsular", "calcificación capsular", "calcificacion capsular", "engrosamiento capsular", "capsula engrosada"]
    };

    const sideKeywords = side === "MD" 
      ? ["mama derecha", "derecha", "der.", "md", "m.d."] 
      : ["mama izquierda", "izquierda", "izq.", "mi", "m.i."];

    const norm = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (checked) {
      const hasFinding = () => {
        const sentencesList = currentText.split(/[.\n]/);
        return sentencesList.some(s => {
          const sNorm = norm(s);
          const hasPath = keywords[findingType].some(kw => sNorm.includes(norm(kw)));
          const hasSide = sideKeywords.some(sw => sNorm.includes(sw));
          return hasPath && (hasSide || sNorm.includes("bilateral"));
        });
      };

      if (hasFinding()) {
        return currentText;
      }

      const targetHeader = side === "MD" ? "MAMA DERECHA" : "MAMA IZQUIERDA";
      const paragraphs = currentText.split("\n");
      let headerIdx = -1;

      for (let i = 0; i < paragraphs.length; i++) {
        if (norm(paragraphs[i]).includes(norm(targetHeader))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx !== -1) {
        paragraphs.splice(headerIdx + 1, 0, sentenceToInsert);
        return paragraphs.join("\n");
      } else {
        let impIdx = -1;
        for (let i = 0; i < paragraphs.length; i++) {
          if (paragraphs[i].toUpperCase().includes("IMPRESIÓN DIAGNÓSTICA") || paragraphs[i].toUpperCase().includes("CONCLUSION")) {
            impIdx = i;
            break;
          }
        }
        if (impIdx !== -1) {
          paragraphs.splice(impIdx, 0, sentenceToInsert);
          return paragraphs.join("\n");
        } else {
          return currentText.trim() + "\n\n" + sentenceToInsert;
        }
      }
    } else {
      const lines = currentText.split("\n");
      const filteredLines = lines.map(line => {
        const clauses = line.split(/[.;]/);
        const filteredClauses = clauses.filter(cl => {
          const clNorm = norm(cl);
          const hasPath = keywords[findingType].some(kw => clNorm.includes(norm(kw)));
          const hasSide = sideKeywords.some(sw => clNorm.includes(sw));
          const isBilateral = clNorm.includes("bilateral");
          if (hasPath && (hasSide || isBilateral)) {
            return false;
          }
          return true;
        });
        return filteredClauses.join(".");
      });

      return filteredLines.join("\n").replace(/[.]{2,}/g, ".").trim();
    }
  };

  const handleToggleImplantFinding = (
    side: "MD" | "MI",
    findingType: "intra" | "extra" | "fluid" | "folds" | "capsule",
    checked: boolean
  ) => {
    if (side === "MD") {
      if (findingType === "intra") setBreastImplantRuptureIntraMD(checked);
      if (findingType === "extra") setBreastImplantRuptureExtraMD(checked);
      if (findingType === "fluid") setBreastImplantFluidMD(checked);
      if (findingType === "folds") setBreastImplantFoldsMD(checked);
      if (findingType === "capsule") setBreastImplantCapsuleMD(checked);
    } else {
      if (findingType === "intra") setBreastImplantRuptureIntraMI(checked);
      if (findingType === "extra") setBreastImplantRuptureExtraMI(checked);
      if (findingType === "fluid") setBreastImplantFluidMI(checked);
      if (findingType === "folds") setBreastImplantFoldsMI(checked);
      if (findingType === "capsule") setBreastImplantCapsuleMI(checked);
    }

    if (onChangeReport && generatedReport) {
      const updatedReport = updateReportTextWithImplantFinding(generatedReport, side, findingType, checked);
      onChangeReport(updatedReport);
    }
  };

  useEffect(() => {
    if (!generatedReport) {
      if (!breastImplantForceActive) {
        setBreastImplantRuptureIntraMD(false);
        setBreastImplantRuptureExtraMD(false);
        setBreastImplantFluidMD(false);
        setBreastImplantFoldsMD(false);
        setBreastImplantCapsuleMD(false);

        setBreastImplantRuptureIntraMI(false);
        setBreastImplantRuptureExtraMI(false);
        setBreastImplantFluidMI(false);
        setBreastImplantFoldsMI(false);
        setBreastImplantCapsuleMI(false);
      }
      return;
    }

    const normalized = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (isImplantActive) {
      const mdMarkers = [
        "mama derecha", "mama d.", "m.d.", "m. derecha", "derecha:", "mamas derecha", "cse md", "csi md", "cie md", "cii md", "mama der"
      ];
      const miMarkers = [
        "mama izquierda", "mama i.", "m.i.", "m. izquierda", "izquierda:", "mamas izquierda", "cse mi", "csi mi", "cie mi", "cii mi", "mama izq"
      ];

      let firstMdIdx = -1;
      for (const marker of mdMarkers) {
        const idx = normalized.indexOf(marker);
        if (idx !== -1 && (firstMdIdx === -1 || idx < firstMdIdx)) {
          firstMdIdx = idx;
        }
      }

      let firstMiIdx = -1;
      for (const marker of miMarkers) {
        const idx = normalized.indexOf(marker);
        if (idx !== -1 && (firstMiIdx === -1 || idx < firstMiIdx)) {
          firstMiIdx = idx;
        }
      }

      const impressionSection = getImpressionTextSection(generatedReport);

      const checkImplantFinding = (findingKws: string[], side: "MD" | "MI"): boolean => {
        const checkSentence = (sentence: string): boolean | null => {
          const sNorm = sentence.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const foundKw = findingKws.find(kw => sNorm.includes(kw));
          if (!foundKw) return null;

          const kwIdx = sNorm.indexOf(foundKw);
          const beforeKw = sNorm.substring(0, kwIdx);
          
          const negations = [
            "sin ", "no se ", "ausencia de ", "negativo ", "normal ", "integro ", "integra ", 
            "normales ", "integros ", "integras ", "sin signos de ", "sin evidencia de ", 
            "descartar ", "sin ruptura ", "descartando ", "falsos ", "no evidencian ", 
            "no muestra ", "no muestran ", "no se observa ", "no se observan ", "libre de "
          ];
          
          const isNegated = negations.some(neg => beforeKw.includes(neg));
          if (isNegated) return false;

          const hasRight = /\b(derecha|derecho|der|md|m\.d|m\. derecho|m. derecho|mama d)\b/gi.test(sentence);
          const hasLeft = /\b(izquierda|izquierdo|izq|mi|m\.i|m\. izquierdo|m. izquierdo|mama i)\b/gi.test(sentence);
          const isBilateral = /\b(bilateral|bilaterales|ambas|ambos|ambas mamas)\b/gi.test(sentence);

          if (isBilateral) return true;
          if (side === "MD" && hasRight && !hasLeft) return true;
          if (side === "MI" && hasLeft && !hasRight) return true;
          if (!hasRight && !hasLeft) {
            const idxInDoc = normalized.indexOf(sNorm);
            if (idxInDoc !== -1) {
              const insideMD = firstMdIdx !== -1 && firstMiIdx !== -1 
                ? (firstMdIdx < firstMiIdx ? (idxInDoc >= firstMdIdx && idxInDoc < firstMiIdx) : (idxInDoc >= firstMdIdx))
                : (firstMdIdx !== -1 ? idxInDoc >= firstMdIdx : false);
                
              const insideMI = firstMdIdx !== -1 && firstMiIdx !== -1
                ? (firstMdIdx < firstMiIdx ? (idxInDoc >= firstMiIdx) : (idxInDoc >= firstMiIdx && idxInDoc < firstMdIdx))
                : (firstMiIdx !== -1 ? idxInDoc >= firstMiIdx : false);

              if (side === "MD" && insideMD) return true;
              if (side === "MI" && insideMI) return true;
            }
          }
          return null;
        };

        if (impressionSection) {
          const sentences = impressionSection.split(/(?:\.|\n|\r|;|\n\n)+/);
          for (const s of sentences) {
            const res = checkSentence(s);
            if (res === true) return true;
            if (res === false) return false;
          }
        }

        const allSentences = normalized.split(/(?:\.|\n|\r|;|\n\n)+/);
        for (const s of allSentences) {
          const res = checkSentence(s);
          if (res === true) return true;
        }

        return false;
      };

      setBreastImplantRuptureIntraMD(checkImplantFinding([
        "ruptura intracapsular", "rotura intracapsular", "linguini", 
        "cerradura de llave", "no integrada", "colapsado", "signo de la cerradura"
      ], "MD"));

      setBreastImplantRuptureExtraMD(checkImplantFinding([
        "ruptura extracapsular", "rotura extracapsular", "silicona libre", 
        "siliconoma", "leaking", "tormenta de nieve", "extracapsular"
      ], "MD"));

      setBreastImplantFluidMD(checkImplantFinding([
        "seroma", "coleccion peri", "coleccion liquida", "liquido peri", 
        "liquido alrededor", "acumulacion de liquido", "liquido periprotesico", "seroma periprotesico"
      ], "MD"));

      setBreastImplantFoldsMD(checkImplantFinding([
        "pliegue radial", "pliegues radiales", "pliegues de la cubierta", "pliegue de cubierta", "ondulacion"
      ], "MD"));

      setBreastImplantCapsuleMD(checkImplantFinding([
        "contractura capsular", "calcificacion capsular", "capsular calcificada", 
        "engrosamiento capsular", "capsula engrosada"
      ], "MD"));

      setBreastImplantRuptureIntraMI(checkImplantFinding([
        "ruptura intracapsular", "rotura intracapsular", "linguini", 
        "cerradura de llave", "no integrada", "colapsado", "signo de la cerradura"
      ], "MI"));

      setBreastImplantRuptureExtraMI(checkImplantFinding([
        "ruptura extracapsular", "rotura extracapsular", "silicona libre", 
        "siliconoma", "leaking", "tormenta de nieve", "extracapsular"
      ], "MI"));

      setBreastImplantFluidMI(checkImplantFinding([
        "seroma", "coleccion peri", "coleccion liquida", "liquido peri", 
        "liquido alrededor", "acumulacion de liquido", "liquido periprotesico", "seroma periprotesico"
      ], "MI"));

      setBreastImplantFoldsMI(checkImplantFinding([
        "pliegue radial", "pliegues radiales", "pliegues de la cubierta", "pliegue de cubierta", "ondulacion"
      ], "MI"));

      setBreastImplantCapsuleMI(checkImplantFinding([
        "contractura capsular", "calcificacion capsular", "capsular calcificada", 
        "engrosamiento capsular", "capsula engrosada"
      ], "MI"));
    } else {
      setBreastImplantRuptureIntraMD(false);
      setBreastImplantRuptureExtraMD(false);
      setBreastImplantFluidMD(false);
      setBreastImplantFoldsMD(false);
      setBreastImplantCapsuleMD(false);

      setBreastImplantRuptureIntraMI(false);
      setBreastImplantRuptureExtraMI(false);
      setBreastImplantFluidMI(false);
      setBreastImplantFoldsMI(false);
      setBreastImplantCapsuleMI(false);
    }
  }, [generatedReport, breastImplantForceActive, isImplantActive]);

  // AUTO-SYNC ON MOUNT / PROP CHANGE HAS BEEN DISABLED PER USER REQUEST TO SAVE RESOURCES.
  // Synchronization will only execute manually when the user explicitly clicks the "Sincronizar MD / MI" button.

  const lastPropagatedStates = useRef<string>("");
  const lastPropagatedDescriptions = useRef<string>("");

  useEffect(() => {
    const statesStr = JSON.stringify(states);
    if (onChangeStates && statesStr !== lastPropagatedStates.current) {
      lastPropagatedStates.current = statesStr;
      lastReceivedStates.current = statesStr; // update this to prevent re-triggering from external prop
      onChangeStates(states);
    }
  }, [states, onChangeStates]);

  useEffect(() => {
    const descsStr = JSON.stringify(customDescriptions);
    if (onChangeDescriptions && descsStr !== lastPropagatedDescriptions.current) {
      lastPropagatedDescriptions.current = descsStr;
      lastReceivedDescriptions.current = descsStr; // update this to prevent re-triggering from external prop
      onChangeDescriptions(customDescriptions);
    }
  }, [customDescriptions, onChangeDescriptions]);

  const getStructureLabel = (id: string): string => {
    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");
    const side = isRight ? "Mama Derecha" : "Mama Izquierda";

    if (name.startsWith("eje")) {
      const idx = name.replace("eje", "");
      return `${side} - Eje ${idx}`;
    }
    if (name === "retroareolar") {
      return `${side} - Región Retroareolar`;
    }
    if (name === "cola_spence") {
      return `${side} - Cola de Spence`;
    }
    if (name === "axila") {
      return `${side} - Región Axilar`;
    }
    return id;
  };

  // Helper keyword matcher
  const getStructureKeywords = (id: string): { primary: string[]; contexts: string[] } => {
    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");
    
    // Primary keywords for identifying sub-regions
    let primary: string[] = [];
    if (name.startsWith("eje")) {
      const num = name.replace("eje", "");
      const numPadded = num.length === 1 ? `0${num}` : num;
      primary = [
        `eje ${num}`, `eje ${num}:`, `eje ${num}.`, `eje de las ${num}`, `eje de las ${num}:`,
        `hora ${num}`, `hora ${num}:`, `hora ${num}h`, `hora ${num} h`, `hora ${num}:00`,
        `hora ${numPadded}`, `hora ${numPadded}:00`,
        `${num}:00`, `${numPadded}:00`, `${num}h`, `${num} h`, `${numPadded}h`, `${numPadded} h`,
        `a las ${num}`, `a las ${numPadded}`,
        `sector ${num}`, `posicion ${num}`, `posición ${num}`, `radio ${num}`, `radio de las ${num}`
      ];
    } else if (name === "retroareolar") {
      primary = ["retroareolar", "retro del pezon", "detras del pezon", "areolar", "retro-areolar", "pezon", "pezón"];
    } else if (name === "cola_spence") {
      primary = ["cola de spence", "prolongacion axilar", "prolongación axilar", "cola spence"];
    } else if (name === "axila") {
      primary = ["axilar", "axila", "ganglio axilar", "hueco axilar", "adenopatia axilar", "adenopatía axilar"];
    }

    // Breast context headers to prevent bleeding right and left
    const contexts = isRight 
      ? ["mama derecha", "m. derecha", "md:", "md ", "hemidif de la derecha", "derecha"] 
      : ["mama izquierda", "m. izquierda", "mi:", "mi ", "hemidif de la izquierda", "izquierda"];

    return { primary, contexts };
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (!s || s === "no_descrito") {
      return "No descrito en el reporte.";
    }
    if (s === "normal") {
      return "Ecosonográficamente normal, sin alterations discretas.";
    }
    const extracted = extractSentenceForBreast(generatedReport, id, "");
    if (extracted) return extracted;

    const isRight = id.startsWith("md_");
    const name = id.replace("md_", "").replace("mi_", "");

    if (name === "axila") {
      return `Linfadenopatía / hallazgo axilar en ${isRight ? "mama derecha" : "mama izquierda"}.`;
    }
    if (name === "retroareolar") {
      return `Alteración / ectasia en región retroareolar (${isRight ? "mama derecha" : "mama izquierda"}).`;
    }
    if (name === "cola_spence") {
      return `Hallazgo en prolongación axilar / cola de Spence (${isRight ? "mama derecha" : "mama izquierda"}).`;
    }
    return `Hallazgo ecográfico focal en ${getStructureLabel(id)}: ${s}.`;
  };

  // Generate table markdown
  const exportTableData = () => {
    let md = `\n| Región | Hallazgo |\n`;
    md += `| :--- | :--- |\n`;

    let hasFindings = false;

    if (isBilateralBenignActive) {
      const label = hasQuistesBilaterales ? "quistes simples bilaterales" : "fibroadenomas múltiples bilaterales";
      md += `| **Ambas Mamas** | Presencia de ${label}. |\n`;
      hasFindings = true;
    }

    initialKeys.forEach(k => {
      const s = states[k];
      if (s && s !== "no_descrito" && s !== "normal") {
        const descText = customDescriptions[k]?.trim();
        const isInvalidDesc = !descText || descText.toLowerCase().includes("no descrito") || descText.toLowerCase().includes("no mencionado");
        const desc = !isInvalidDesc
          ? descText
          : extractSentenceForBreast(generatedReport, k, getSimplifiedDescription(k, s));

        md += `| **${getStructureLabel(k)}** | ${desc} |\n`;
        hasFindings = true;
      }
    });

    if (!hasFindings) {
      md += `| **Examen de Mamas** | No se describen hallazgos patológicos o nódulos sospechosos en los ejes explorados. |\n`;
    }

    onExportTable(md);
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis local de mamas por heurísticas de proximidad...");
    const textOriginal = generatedReport;
    const textLower = textOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Let's divide text into right breast block and left breast block to avoid false mapping!
    let rightBlock = "";
    let leftBlock = "";

    // Locate boundary markers
    const idxMD = Math.max(textLower.indexOf("mama derecha"), textLower.indexOf("m. derecha"), textLower.indexOf("md:"));
    const idxMI = Math.max(textLower.indexOf("mama izquierda"), textLower.indexOf("m. izquierda"), textLower.indexOf("mi:"));

    if (idxMD !== -1 && idxMI !== -1) {
      if (idxMD < idxMI) {
        rightBlock = textLower.slice(idxMD, idxMI);
        leftBlock = textLower.slice(idxMI);
      } else {
        leftBlock = textLower.slice(idxMI, idxMD);
        rightBlock = textLower.slice(idxMD);
      }
    } else if (idxMD !== -1) {
      rightBlock = textLower.slice(idxMD);
      leftBlock = textLower;
    } else if (idxMI !== -1) {
      leftBlock = textLower.slice(idxMI);
      rightBlock = textLower;
    } else {
      // No explicit headers, use full text for both as fallback but restrict carefully
      rightBlock = textLower;
      leftBlock = textLower;
    }

    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    initialKeys.forEach(id => {
      const isRight = id.startsWith("md_");
      const { primary } = getStructureKeywords(id);
      const targetBlock = isRight ? rightBlock : leftBlock;

      if (!targetBlock) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado.";
        return;
      }

      // Check if primary keywords are mentioned in the contextual block
      const foundKeyword = primary.find(kw => targetBlock.includes(kw));

      if (!foundKeyword) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No mencionado.";
        return;
      }

      // Locate sentence around this keyword to verify normal vs finding
      const kwIdx = targetBlock.indexOf(foundKeyword);
      const targetBlockOffset = isRight 
        ? (idxMD !== -1 ? idxMD : 0) 
        : (idxMI !== -1 ? idxMI : 0);
      const kwIdxInTextLower = targetBlockOffset + kwIdx;

      const startContext = Math.max(0, kwIdxInTextLower - 40);
      const endContext = Math.min(textLower.length, kwIdxInTextLower + 85);
      const contextText = textLower.slice(startContext, endContext);

      // Check if normal/negated
      const isNormal = [
        "normal", "normales", "conservado", "conservada", "homogeneo", "homogenea", "habitual", "negativo", "negativa",
        "sin hallazgos", "sin alteraciones", "sin nodulos", "sin lesiones", "no se observan masas", "no se observa masa",
        "sin masas", "sin quistes", "no hay quistes", "libre de", "adenopatia reactiva de aspecto habitual", "fosa libre",
        "fosas libres", "hueco libre", "libres", "sin ectasia", "sin ectasias", "sin secrecion", "sin secreciones",
        "sin deformidad", "sin retraccion", "sin retracciones", "aspecto habitual", "morfologia habitual",
        "morfologia conservada", "morfologia normal", "simetrico", "simetrica", "planas", "plano", "sin evidencia",
        "no se evidencia", "no se aprecian", "no se observan", "sin colecciones", "sin distorsion", "sin distorsiones",
        "sin engrosamiento", "sin dilatacion", "sin dilataciones", "sin adenopatias", "sin adenopatia",
        "sin linfadenopatia", "sin linfadenopatias", "sin signos", "no sospechoso", "no sospechosa", "sin patologia",
        "no patologico", "no patologica", "sin lesion", "sin focalidad", "simetricas", "simetricos", "sin secrecion hematica"
      ].some(p => contextText.includes(p));

      // Attempt to capture pathology / actual suspicious text
      if (isNormal) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        logs.push(`[Local] ${getStructureLabel(id)} clasificado como NORMAL.`);
      } else {
        nextStates[id] = "hallazgo";
        
        // Extract a clinical synopsis around the found keyword
        const exactSentence = extractSentenceForBreast(textOriginal, id, "");
        
        let customDesc = "Alteración ecográfica descrita.";
        if (exactSentence) {
          customDesc = exactSentence;
        } else {
          // Fallback to corrected offset context parsing
          const keywordInOriginal = textOriginal.slice(startContext, endContext);
          const sentences = keywordInOriginal.split(/[.;:]/);
          const relatedSentence = sentences.find(s => {
            const sNorm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return primary.some(kw => sNorm.includes(kw));
          });

          if (relatedSentence && relatedSentence.trim().length > 6) {
            customDesc = relatedSentence.trim()
              .replace(/^, -/, "")
              .replace(/\s+/g, " ");
          }
        }

        if (customDesc.length > 120) {
          customDesc = customDesc.substring(0, 117) + "...";
        }

        nextDescriptions[id] = customDesc;
        logs.push(`[Local] ${getStructureLabel(id)} clasificado como HALLAZGO: ${customDesc}`);
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Ultrasonido de Mamas...`);

    const structuresList = initialKeys.map(k => ({
      id: k,
      label: getStructureLabel(k),
      allowedStates: ["no_descrito", "normal", "hallazgo"]
    }));

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.7-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido de Mamas",
          structures: structuresList
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;

        const nextStates = { ...states };
        const nextDescriptions = { ...customDescriptions };

        initialKeys.forEach(k => {
          if (data.states[k] !== undefined) {
            nextStates[k] = data.states[k];
            nextDescriptions[k] = data.descriptions[k] || "No descrito.";
            parsedCount++;
            if (data.states[k] && data.states[k] !== "no_descrito" && data.states[k] !== "normal") {
              foundPathologies++;
            }
          }
        });

        setStates(nextStates);
        setCustomDescriptions(nextDescriptions);
        setLastSyncedReport(generatedReport);

        logs.push(`Sincronización exitosa con la IA.`);
        logs.push(`Se evaluaron ${parsedCount} sub-divisiones bilaterales clínicas.`);
        logs.push(`Se detectaron ${foundPathologies} hallazgos focales activos.`);
      } else {
        logs.push("La API de IA no devolvió resultados compatibles. Corriendo heurísticas locales secundarias...");
        runLocalHeuristics(logs);
      }
    } catch (err: any) {
      console.error("Failed integration sync with Gemini API:", err);
      logs.push("Fallo en la comunicación con el servidor. Aplicando algoritmo local de proximidad...");
      runLocalHeuristics(logs);
    } finally {
      setIsSyncing(false);
      setSyncLogs(logs);
    }
  };

  const handleReset = () => {
    const s: Record<string, string> = {};
    const d: Record<string, string> = {};
    initialKeys.forEach(k => {
      s[k] = "no_descrito";
      d[k] = "";
    });
    setStates(s);
    setCustomDescriptions(d);
    setSyncLogs(["Mapeo reiniciado a valores neutros."]);
  };

  // Helper mathematical path sector plotter
  const getPathForSector = (
    cx: number,
    cy: number,
    r_in: number,
    r_out: number,
    startDeg: number,
    endDeg: number
  ) => {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1_out = cx + r_out * Math.cos(startRad);
    const y1_out = cy + r_out * Math.sin(startRad);
    const x2_out = cx + r_out * Math.cos(endRad);
    const y2_out = cy + r_out * Math.sin(endRad);

    const x1_in = cx + r_in * Math.cos(startRad);
    const y1_in = cy + r_in * Math.sin(startRad);
    const x2_in = cx + r_in * Math.cos(endRad);
    const y2_in = cy + r_in * Math.sin(endRad);

    return `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 0 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 0 0 ${x1_in} ${y1_in} Z`;
  };

  // Status-based colors
  const getColorsForState = (stateValue: string, isCurrentHover: boolean, isCurrentSelected: boolean, id: string) => {
    let effectiveState = stateValue;

    if (isBilateralBenignActive) {
      if (effectiveState === "no_descrito" || effectiveState === "normal") {
        effectiveState = "normal";
      }
    }

    let baseFill = "fill-slate-900/10";
    let baseStroke = "stroke-slate-700/40";
    let glow = "";

    if (effectiveState === "normal") {
      baseFill = "fill-emerald-500/15";
      baseStroke = "stroke-emerald-500/80";
      if (isCurrentHover) {
        baseFill = "fill-emerald-500/35";
        baseStroke = "stroke-emerald-400";
      }
    } else if (effectiveState !== "no_descrito") {
      baseFill = "fill-rose-500/25";
      baseStroke = "stroke-rose-500";
      glow = "drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]";
      if (isCurrentHover) {
        baseFill = "fill-rose-500/45";
        baseStroke = "stroke-rose-400";
      }
    } else {
      // no_descrito
      if (isCurrentHover) {
        baseFill = "fill-indigo-500/20";
        baseStroke = "stroke-indigo-400";
      }
    }

    if (isCurrentSelected) {
      baseStroke = "stroke-indigo-400 stroke-[2.5]";
      if (effectiveState === "no_descrito") {
        baseFill = "fill-indigo-500/25";
      }
    }

    return { baseFill, baseStroke, glow };
  };

  const renderBreastSvg = (isRight: boolean) => {
    const cx = 160;
    const cy = 110;
    const r_in = 22;
    const r_out = 65;
    const prefix = isRight ? "md_" : "mi_";

    // 12 Sectors
    const sectorElements: React.ReactNode[] = [];
    for (let h = 1; h <= 12; h++) {
      const id = `${prefix}eje${h}`;
      const startAngle = -90 + (h - 12.5) * 30;
      const endAngle = -90 + (h - 11.5) * 30;

      const pathD = getPathForSector(cx, cy, r_in, r_out, startAngle, endAngle);
      const isSelected = selectedStructure === id;
      const isHovered = activeHover === id;
      const stateVal = states[id] || "no_descrito";
      const { baseFill, baseStroke, glow } = getColorsForState(stateVal, isHovered, isSelected, id);

      // Midpoint coordinate for label placing
      const midAngleRad = ((startAngle + endAngle) / 2 * Math.PI) / 180;
      const r_text = r_in + 24;
      const tx = cx + r_text * Math.cos(midAngleRad);
      const ty = cy + r_text * Math.sin(midAngleRad);

      sectorElements.push(
        <g key={id} className="cursor-pointer" onClick={() => setSelectedStructure(id)} onMouseEnter={() => setActiveHover(id)} onMouseLeave={() => setActiveHover(null)}>
          <path id={`${id}-svg-path`} d={pathD} className={`${baseFill} ${baseStroke} transition-all duration-150 ${glow}`} />
          <text x={tx} y={ty + 2} textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-mono font-black text-[7px]" style={{ fontSize: "7px" }}>
            {h}
          </text>
        </g>
      );
    }

    // Retroareolar
    const retId = `${prefix}retroareolar`;
    const isRetSelected = selectedStructure === retId;
    const isRetHovered = activeHover === retId;
    const retState = states[retId] || "no_descrito";
    const retColors = getColorsForState(retState, isRetHovered, isRetSelected, retId);

    // Cola de Spence
    const spenceId = `${prefix}cola_spence`;
    const isSpenceSelected = selectedStructure === spenceId;
    const isSpenceHovered = activeHover === spenceId;
    const spenceState = states[spenceId] || "no_descrito";
    const spenceColors = getColorsForState(spenceState, isSpenceHovered, isSpenceSelected, spenceId);

    // Axila
    const axId = `${prefix}axila`;
    const isAxSelected = selectedStructure === axId;
    const isAxHovered = activeHover === axId;
    const axState = states[axId] || "no_descrito";
    const axColors = getColorsForState(axState, isAxHovered, isAxSelected, axId);

    return (
      <svg id={`breast-anatomy-${isRight ? "right" : "left"}-svg`} viewBox="0 0 320 220" className="w-full h-auto drop-shadow-xl bg-slate-950/40 border border-slate-900 rounded-2xl p-2 select-none">
        {/* Bilateral Benign Finding Badge */}
        {isBilateralBenignActive && (
          <g>
            <rect id="breast-bilateral-badge-rect" x="75" y="8" width="170" height="15" rx="5" fill="#0b1329" stroke="#10b981" strokeWidth="0.8" />
            <circle cx="85" cy="15.5" r="2.5" fill="#10b981" className="fill-emerald-400 animate-pulse" />
            <text id="breast-bilateral-badge-text" x="94" y="18" fill="#10b981" className="fill-emerald-400 font-sans font-extrabold text-[6.5px] uppercase tracking-wider" style={{ fontSize: "6.5px", fontWeight: "extrabold" }}>
              {hasQuistesBilaterales ? "Quistes simples bilaterales" : "Fibroadenomas múltiples bilaterales"}
            </text>
          </g>
        )}

        {/* Background anatomical reference bounds */}
        <text x="160" y="210" textAnchor="middle" className="fill-slate-500 font-sans font-black tracking-widest text-[9px]">
          {isRight ? "MAMA DERECHA (MD)" : "MAMA IZQUIERDA (MI)"}
        </text>

        {/* Outer boundary guidelines */}
        <circle cx={cx} cy={cy} r={r_out} className="fill-none stroke-slate-800/20 stroke-1 stroke-dasharray-[3,3]" />
        
        {/* 12 sectors */}
        {sectorElements}

        {/* Cola de Spence - Superior Lateral lobe */}
        {isRight ? (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(spenceId)} onMouseEnter={() => setActiveHover(spenceId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${spenceId}-svg-path`}
              cx={95} cy={60} rx={18} ry={25} 
              transform="rotate(-35, 95, 60)" 
              className={`${spenceColors.baseFill} ${spenceColors.baseStroke} transition-all duration-150 ${spenceColors.glow}`} 
            />
            <text x="91" y="62" className="fill-slate-400 select-none pointer-events-none font-sans font-bold text-[6px]">Spence</text>
          </g>
        ) : (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(spenceId)} onMouseEnter={() => setActiveHover(spenceId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${spenceId}-svg-path`}
              cx={225} cy={60} rx={18} ry={25} 
              transform="rotate(35, 225, 60)" 
              className={`${spenceColors.baseFill} ${spenceColors.baseStroke} transition-all duration-150 ${spenceColors.glow}`} 
            />
            <text x="229" y="62" className="fill-slate-400 select-none pointer-events-none font-sans font-bold text-[6px]" textAnchor="end">Spence</text>
          </g>
        )}

        {/* Axila - Furthest Superior Lateral nodes */}
        {isRight ? (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(axId)} onMouseEnter={() => setActiveHover(axId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${axId}-svg-path`}
              cx={35} cy={30} rx={15} ry={21} 
              transform="rotate(-40, 35, 30)" 
              className={`${axColors.baseFill} ${axColors.baseStroke} transition-all duration-150 ${axColors.glow}`} 
            />
            <text x="35" y="32" textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-sans font-black text-[7px]">AXILA</text>
          </g>
        ) : (
          <g className="cursor-pointer" onClick={() => setSelectedStructure(axId)} onMouseEnter={() => setActiveHover(axId)} onMouseLeave={() => setActiveHover(null)}>
            <ellipse 
              id={`${axId}-svg-path`}
              cx={285} cy={30} rx={15} ry={21} 
              transform="rotate(40, 285, 30)" 
              className={`${axColors.baseFill} ${axColors.baseStroke} transition-all duration-150 ${axColors.glow}`} 
            />
            <text x="285" y="32" textAnchor="middle" className="fill-slate-400 select-none pointer-events-none font-sans font-black text-[7px]">AXILA</text>
          </g>
        )}

        {/* Centered Retroareolar region */}
        <g className="cursor-pointer" onClick={() => setSelectedStructure(retId)} onMouseEnter={() => setActiveHover(retId)} onMouseLeave={() => setActiveHover(null)}>
          <circle 
            id={`${retId}-svg-path`}
            cx={cx} cy={cy} r={r_in} 
            className={`${retColors.baseFill} ${retColors.baseStroke} transition-all duration-150 ${retColors.glow} stroke-dashed`} 
          />
          <text x={cx} y={cy + 2.5} textAnchor="middle" className="fill-slate-300 font-sans font-bold text-[6.5px] pointer-events-none select-none">
            RETRO
          </text>
        </g>
      </svg>
    );
  };

  const renderImplantDiagram = () => {
    if (!isImplantActive) return null;

    const renderSingleImplantSide = (side: "MD" | "MI") => {
      const isRight = side === "MD";
      const intra = isRight ? breastImplantRuptureIntraMD : breastImplantRuptureIntraMI;
      const extra = isRight ? breastImplantRuptureExtraMD : breastImplantRuptureExtraMI;
      const fluid = isRight ? breastImplantFluidMD : breastImplantFluidMI;
      const folds = isRight ? breastImplantFoldsMD : breastImplantFoldsMI;
      const capsule = isRight ? breastImplantCapsuleMD : breastImplantCapsuleMI;

      const setIntra = isRight ? setBreastImplantRuptureIntraMD : setBreastImplantRuptureIntraMI;
      const setExtra = isRight ? setBreastImplantRuptureExtraMD : setBreastImplantRuptureExtraMI;
      const setFluid = isRight ? setBreastImplantFluidMD : setBreastImplantFluidMI;
      const setFolds = isRight ? setBreastImplantFoldsMD : setBreastImplantFoldsMI;
      const setCapsule = isRight ? setBreastImplantCapsuleMD : setBreastImplantCapsuleMI;

      const toggleIntra = () => handleToggleImplantFinding(side, "intra", !intra);
      const toggleExtra = () => handleToggleImplantFinding(side, "extra", !extra);
      const toggleFluid = () => handleToggleImplantFinding(side, "fluid", !fluid);
      const toggleFolds = () => handleToggleImplantFinding(side, "folds", !folds);
      const toggleCapsule = () => handleToggleImplantFinding(side, "capsule", !capsule);

      const hasAnyAlteration = intra || extra || fluid || folds || capsule;

      return (
        <div className="flex flex-col gap-4 bg-slate-900/10 border border-slate-900/60 p-4 rounded-2xl relative overflow-hidden">
          {/* Header for this side */}
          <div className="flex items-center justify-between border-b border-slate-900/85 pb-2 mb-1">
            <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 font-sans ${isRight ? "text-cyan-400" : "text-sky-400"}`}>
              <span className={`w-2 h-2 rounded-full ${isRight ? "bg-cyan-500 animate-pulse" : "bg-sky-500"}`}></span>
              {isRight ? "MAMA DERECHA (MD)" : "MAMA IZQUIERDA (MI)"}
            </span>
            {hasAnyAlteration ? (
              <span className="text-[8px] px-1.5 py-0.5 bg-rose-950/60 text-rose-450 border border-rose-900/50 rounded-md font-bold uppercase tracking-wider font-mono">
                con alteraciones
              </span>
            ) : (
              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-950/60 text-emerald-455 border border-emerald-900/50 rounded-md font-bold uppercase tracking-wider font-mono">
                aspecto normal
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start text-left">
            {/* SVG Illustration Column */}
            <div className="w-full sm:w-1/2 flex flex-col items-center justify-center p-2 rounded-xl border border-slate-900 bg-slate-950/50 relative">
              <svg 
                id={`breast-implant-svg-${side}`} 
                viewBox="0 0 320 220" 
                className="w-full h-auto select-none"
                data-intra={intra ? "true" : "false"}
                data-extra={extra ? "true" : "false"}
                data-fluid={fluid ? "true" : "false"}
                data-folds={folds ? "true" : "false"}
                data-capsule={capsule ? "true" : "false"}
              >
                <defs>
                  <linearGradient id={`muscleGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#be123c" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id={`gelGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id={`fluidGrad-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Pectoral Muscle / Chest Wall */}
                <path d="M 10 10 C 25 10, 45 70, 45 110 C 45 150, 25 210, 10 210 Z" fill={`url(#muscleGrad-${side})`} stroke="#f43f5e" strokeWidth="1" strokeOpacity="0.4" />
                <path d="M 15 25 L 35 110 L 15 195" stroke="#f43f5e" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3,3" />

                {/* Capsule Outer Boundary */}
                <circle cx="150" cy="110" r="65" 
                  fill="transparent" 
                  stroke={capsule ? "#f59e0b" : "#334155"} 
                  strokeWidth={capsule ? "3.5" : "1.8"}
                  strokeDasharray={capsule ? "4,4" : "none"}
                  className="transition-all duration-200 cursor-pointer hover:stroke-amber-400"
                  onClick={toggleCapsule}
                />

                {/* Peri-implant fluid / Seroma layer */}
                {fluid && (
                  <path 
                    d="M 92 80 A 61 61 0 0 1 208 80 A 56 56 0 0 0 92 80 Z" 
                    fill={`url(#fluidGrad-${side})`} 
                    stroke="#38bdf8" 
                    strokeWidth="1"
                    className="animate-pulse cursor-pointer hover:opacity-80"
                    onClick={toggleFluid}
                  />
                )}

                {/* Gel Body (Prosthesis) */}
                <circle cx="150" cy="110" r="54" 
                  fill={`url(#gelGrad-${side})`} 
                  stroke={folds ? "#22d3ee" : "#0891b2"} 
                  strokeWidth="1.8"
                  className="transition-all duration-200 cursor-pointer hover:stroke-cyan-400"
                  onClick={toggleIntra}
                />

                {/* Pliegues radiales (radial envelope folding) */}
                {folds && (
                  <g stroke="#22d3ee" strokeWidth="1.8" className="cursor-pointer" onClick={toggleFolds}>
                    <path d="M 190 74 C 180 82, 175 92, 170 95" fill="none" />
                    <path d="M 110 146 C 122 138, 128 132, 135 125" fill="none" />
                    <path d="M 140 58 C 144 70, 148 80, 150 90" fill="none" />
                  </g>
                )}

                {/* Ruptura Intracapsular (Linguini sign) */}
                {intra && (
                  <g stroke="#ffffff" strokeWidth="1.6" fill="none" className="cursor-pointer" onClick={toggleIntra}>
                    <path d="M 110 95 C 125 110, 135 75, 150 90 C 165 105, 175 75, 190 95" className="animate-pulse" />
                    <path d="M 105 115 C 120 135, 140 100, 155 125 C 170 150, 180 115, 195 110" />
                    <path d="M 120 135 C 130 145, 150 140, 160 145" />
                    <path d="M 130 85 C 135 90, 145 80, 150 85 C 155 90, 165 80, 170 85" opacity="0.6" />
                  </g>
                )}

                {/* Ruptura Extracapsular (snowstorm droplets) */}
                {extra && (
                  <g className="cursor-pointer" onClick={toggleExtra}>
                    <circle cx="225" cy="85" r="4.5" fill="#22d3ee" className="fill-cyan-400 animate-bounce" />
                    <circle cx="232" cy="115" r="3.2" fill="#22d3ee" className="fill-cyan-400" />
                    <circle cx="218" cy="140" r="4.8" fill="#22d3ee" className="fill-cyan-400" />
                    <g transform="translate(242, 122)">
                      <circle cx="10" cy="10" r="14" fill="#ec4899" fillOpacity="0.12" stroke="#ec4899" strokeWidth="0.8" strokeDasharray="2,2" />
                      <ellipse cx="10" cy="10" rx="9" ry="9" fill="#0891b2" fillOpacity="0.22" />
                      <text x="10" y="13" textAnchor="middle" fill="#ffffff" className="font-sans font-black text-[5px]" style={{ fontSize: "5px" }}>LNP</text>
                    </g>
                    <path d="M 210 95 L 215 115" stroke="#f43f5e" strokeWidth="2.5" />
                  </g>
                )}

                {/* Labels and Leader lines */}
                <g className="pointer-events-none select-none animate-fadeIn" style={{ fontSize: "4.8px", fontFamily: "sans-serif" }}>
                  <text x="15" y="25" fill="#ec4899" className="font-sans font-black" textAnchor="start" style={{ fontSize: "5px", fontWeight: 900 }}>PARED TORÁCICA</text>
                  
                  <text x="295" y="28" fill="#cbd5e1" className="font-sans font-bold" textAnchor="end" style={{ fontSize: "4.6px", fontWeight: 700 }}>CÁPSULA RETRACTIL</text>
                  <line x1="225" y1="26" x2="168" y2="48" stroke="#475569" strokeWidth="0.5" />

                  <text x="295" y="195" fill="#22d3ee" className="font-sans font-bold" textAnchor="end" style={{ fontSize: "4.6px", fontWeight: 700 }}>PRÓTESIS DE SILICONA</text>
                  <line x1="210" y1="192" x2="178" y2="148" stroke="#0891b2" strokeWidth="0.5" />

                  {capsule && (
                    <g>
                      <text x="15" y="190" fill="#ea580c" className="font-sans font-black" textAnchor="start" style={{ fontSize: "4.6px", fontWeight: 900 }}>CONTRACTURA / CALCIFICACIÓN</text>
                      <line x1="120" y1="184" x2="95" y2="145" stroke="#ea580c" strokeWidth="0.5" />
                    </g>
                  )}

                  {fluid && (
                    <g>
                      <text x="150" y="32" fill="#38bdf8" className="font-sans font-black text-center" textAnchor="middle" style={{ fontSize: "4.8px", fontWeight: 900 }}>SEROMA PERIPROTÉCICO</text>
                      <line x1="150" y1="36" x2="150" y2="52" stroke="#38bdf8" strokeWidth="0.5" />
                    </g>
                  )}

                  {intra && (
                    <g>
                      <line x1="88" y1="110" x2="114" y2="110" stroke="#ffffff" strokeWidth="0.5" />
                      <text x="82" y="112" fill="#ffffff" className="font-sans font-black" textAnchor="end" style={{ fontSize: "4.6px", fontWeight: 900 }}>RUPTURA INTRACAPSULAR</text>
                    </g>
                  )}

                  {extra && (
                    <g>
                      <line x1="225" y1="140" x2="215" y2="155" stroke="#ec4899" strokeWidth="0.5" />
                      <text x="295" y="157" fill="#ec4899" className="font-sans font-black" textAnchor="end" style={{ fontSize: "4.6px", fontWeight: 900 }}>RUPTURA EXTRACAPSULAR</text>
                    </g>
                  )}
                </g>
              </svg>
              <div className="text-[8.5px] text-slate-500 font-semibold uppercase mt-2 tracking-widest text-center italic font-sans select-none pointer-events-none">
                Sección Sagital de Prótesis - {side}
              </div>
            </div>

            {/* Checkboxes List Column */}
            <div className="w-full sm:w-1/2 flex flex-col gap-2">
              <label className={`flex gap-2.5 items-start p-2.5 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl border transition-all cursor-pointer select-none ${
                intra 
                  ? "border-white/30 bg-slate-900 shadow-sm shadow-white/5 text-white" 
                  : "border-slate-850/60 text-slate-400"
              }`}>
                <input 
                  type="checkbox" 
                  checked={intra} 
                  onChange={(e) => handleToggleImplantFinding(side, "intra", e.target.checked)} 
                  className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 mt-0.5"
                />
                <div className="leading-tight text-left font-sans">
                  <div className="text-[11px] font-black uppercase flex items-center gap-1 font-sans">
                    🟢 Ruptura Intracapsular
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight font-sans">
                    Colapso de cubierta (linguini sign).
                  </p>
                </div>
              </label>

              <label className={`flex gap-2.5 items-start p-2.5 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl border transition-all cursor-pointer select-none ${
                extra 
                  ? "border-pink-500/30 bg-slate-900 shadow-sm shadow-pink-500/5 text-white" 
                  : "border-slate-850/60 text-slate-400"
              }`}>
                <input 
                  type="checkbox" 
                  checked={extra} 
                  onChange={(e) => handleToggleImplantFinding(side, "extra", e.target.checked)} 
                  className="rounded border-slate-800 text-pink-500 focus:ring-pink-500 mt-0.5"
                />
                <div className="leading-tight text-left font-sans">
                  <div className="text-[11px] font-black uppercase flex items-center gap-1 font-sans">
                    🔴 Ruptura Extracapsular
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight font-sans">
                    Fuga de gel (snowstorm appearance).
                  </p>
                </div>
              </label>

              <label className={`flex gap-2.5 items-start p-2.5 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl border transition-all cursor-pointer select-none ${
                fluid 
                  ? "border-cyan-500/30 bg-slate-900 shadow-sm shadow-cyan-500/5 text-white" 
                  : "border-slate-850/60 text-slate-400"
              }`}>
                <input 
                  type="checkbox" 
                  checked={fluid} 
                  onChange={(e) => handleToggleImplantFinding(side, "fluid", e.target.checked)} 
                  className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 mt-0.5"
                />
                <div className="leading-tight text-left font-sans">
                  <div className="text-[11px] font-black uppercase flex items-center gap-1 font-sans">
                    💧 Seroma Periprotésico
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight font-sans">
                    Colección líquida anecoica periprotésica.
                  </p>
                </div>
              </label>

              <label className={`flex gap-2.5 items-start p-2.5 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl border transition-all cursor-pointer select-none ${
                folds 
                  ? "border-teal-500/30 bg-slate-900 shadow-sm shadow-teal-500/5 text-white" 
                  : "border-slate-850/60 text-slate-400"
              }`}>
                <input 
                  type="checkbox" 
                  checked={folds} 
                  onChange={(e) => handleToggleImplantFinding(side, "folds", e.target.checked)} 
                  className="rounded border-slate-800 text-teal-500 focus:ring-teal-500 mt-0.5"
                />
                <div className="leading-tight text-left font-sans">
                  <div className="text-[11px] font-black uppercase flex items-center gap-1 font-sans">
                    〰️ Pliegues Radiales
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight font-sans">
                    Pliegues pronunciados de la envoltura.
                  </p>
                </div>
              </label>

              <label className={`flex gap-2.5 items-start p-2.5 bg-slate-900/40 hover:bg-slate-900/80 rounded-xl border transition-all cursor-pointer select-none ${
                capsule 
                  ? "border-amber-500/30 bg-slate-900 shadow-sm shadow-amber-500/5 text-white" 
                  : "border-slate-850/60 text-slate-400"
              }`}>
                <input 
                  type="checkbox" 
                  checked={capsule} 
                  onChange={(e) => handleToggleImplantFinding(side, "capsule", e.target.checked)} 
                  className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 mt-0.5"
                />
                <div className="leading-tight text-left font-sans">
                  <div className="text-[11px] font-black uppercase flex items-center gap-1 font-sans">
                    ⚠️ Contractura / Calcificación
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight font-sans">
                    Engrosamiento capsular denso o calcificación.
                  </p>
                </div>
              </label>

              <button
                type="button"
                onClick={() => {
                  handleToggleImplantFinding(side, "intra", false);
                  handleToggleImplantFinding(side, "extra", false);
                  handleToggleImplantFinding(side, "fluid", false);
                  handleToggleImplantFinding(side, "folds", false);
                  handleToggleImplantFinding(side, "capsule", false);
                }}
                className="w-full py-1 text-[9px] font-bold border border-slate-850/40 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg bg-slate-950/20 hover:bg-slate-950/40 transition-colors cursor-pointer mt-1"
              >
                Limpiar {side}
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="w-full bg-slate-950/60 border border-slate-900 rounded-3xl p-5 mt-4 transition-all duration-300 animate-fadeIn text-left col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-3 mb-4">
          <div>
            <span className="p-1 px-2 bg-gradient-to-r from-cyan-950 to-indigo-950 border border-cyan-850 text-cyan-400 text-[8px] font-black uppercase rounded-full tracking-wider">
              Evaluación Bilateral Simultánea
            </span>
            <h4 className="text-sm font-black text-white mt-1 uppercase tracking-tight flex items-center gap-1.5 font-sans">
              🔬 EVALUACIÓN DE PRÓTESIS MAMARIAS BILATERALES
            </h4>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5 font-sans">
              Alteraciones de la envoltura e interacciones tisulares para ambas mamas representadas simultáneamente en corte sagital.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                handleToggleImplantFinding("MD", "intra", false);
                handleToggleImplantFinding("MD", "extra", false);
                handleToggleImplantFinding("MD", "fluid", false);
                handleToggleImplantFinding("MD", "folds", false);
                handleToggleImplantFinding("MD", "capsule", false);

                handleToggleImplantFinding("MI", "intra", false);
                handleToggleImplantFinding("MI", "extra", false);
                handleToggleImplantFinding("MI", "fluid", false);
                handleToggleImplantFinding("MI", "folds", false);
                handleToggleImplantFinding("MI", "capsule", false);
              }}
              className="px-2.5 py-1 text-[9.5px] font-bold border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg bg-slate-900/60 transition-colors cursor-pointer"
            >
              Reiniciar Ambas Prótesis
            </button>
          </div>
        </div>

        {/* Dynamic side-by-side grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderSingleImplantSide("MD")}
          {renderSingleImplantSide("MI")}
        </div>

        {/* Shared Clinical Guidelines Footer */}
        <div className="bg-slate-900/40 border border-slate-900 p-3.5 rounded-2xl flex flex-col gap-1 text-[11px] leading-relaxed text-slate-450 font-sans mt-4">
          <span className="font-extrabold text-white text-[10px] uppercase tracking-wider flex items-center gap-1 text-cyan-400 font-sans">
            💡 GUÍA CLÍNICA DE COMPLICACIONES PROTÉSICAS RECURRENTES:
          </span>
          <span>
            • La <strong>ruptura intracapsular</strong> ecográfica es altamente sugestiva al presenciar líneas ecogénicas paralelas onduladas internas en gel de silicona (<strong>linguini sign</strong>) correspondientes a la cubierta colapsada flotando de forma libre.
          </span>
          <span>
            • La <strong>ruptura extracapsular</strong> se sospecha fuertemente al observar tejido circundante altamente ecogénico con sombra sónica "en tormenta de nieve" (<strong>snowstorm appearance</strong>) secundaria a microgotas de silicona extracapsulares.
          </span>
        </div>
      </div>
    );
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  const getActiveFindingsCount = () => {
    return Object.values(states).filter(v => v && v !== "no_descrito" && v !== "normal").length;
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 font-sans scale-in">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-rose-950/50 border border-rose-900 text-rose-400 text-[9px] font-black uppercase rounded-full tracking-widest">
              Protocolo Mama
            </span>
            <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">
              Mapeo de Hallazgos Focales 2D
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white mt-1 flex items-center gap-1.5 uppercase">
            🩺 DIAGRAMA Y MAPEO BILATERAL DE MAMAS
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {setIncludeInReport && (
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 hover:bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 transition-all">
              <input 
                type="checkbox" 
                checked={includeInReport} 
                onChange={(e) => setIncludeInReport(e.target.checked)} 
                className="rounded border-slate-800 text-indigo-500 focus:ring-opacity-40" 
              />
              <span>Incluir anexo en informe</span>
            </label>
          )}

          <button
            onClick={handleReset}
            className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 hover:text-white text-slate-400 rounded-xl transition-all cursor-pointer"
            title="Reiniciar valores"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DETECTOR / SCAN GENERATOR */}
      <div className="bg-slate-950 border border-slate-900 p-4 rounded-2xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400 animate-pulse" /> Sincronización Ecográfica de Mamas
            </h4>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1 max-w-xl">
              Sincroniza y pobla automáticamente los hallazgos descritos en el informe escrito. No se asume normalidad automática de las áreas no mencionadas.
            </p>
          </div>

          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing || !generatedReport}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-97 border ${
              syncAvailable 
                ? "bg-rose-600 text-white border-rose-500 hover:bg-rose-500 hover:border-rose-400 animate-pulse" 
                : "bg-slate-900 text-slate-350 border-slate-800 hover:bg-slate-850 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar MD / MI</span>
              </>
            )}
          </button>
        </div>

        {/* CONTROLES MANUALES PARA PROTOCOLO DE LESIONES BENIGNAS MÚLTIPLES BILATERALES */}
        <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-x-6 gap-y-2 items-center text-xs">
          <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
            Protocolo Lesiones Benignas Múltiples:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextOverride = manualBilateralOverride === true && manualBilateralType === "quistes" ? null : true;
                const nextType = manualBilateralOverride === true && manualBilateralType === "quistes" ? null : "quistes";
                setManualBilateralOverride(nextOverride);
                setManualBilateralType(nextType);
                if (onChangeBilateralOverride) {
                  onChangeBilateralOverride(nextOverride, nextType);
                }
              }}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                isBilateralBenignActive && (manualBilateralOverride === null ? autoHasQuistesBilaterales : manualBilateralType === "quistes")
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-white"
              }`}
            >
              👁️ Activar: Quistes Múltiples
            </button>
            
            <button
              onClick={() => {
                const nextOverride = manualBilateralOverride === true && manualBilateralType === "fibroadenomas" ? null : true;
                const nextType = manualBilateralOverride === true && manualBilateralType === "fibroadenomas" ? null : "fibroadenomas";
                setManualBilateralOverride(nextOverride);
                setManualBilateralType(nextType);
                if (onChangeBilateralOverride) {
                  onChangeBilateralOverride(nextOverride, nextType);
                }
              }}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                isBilateralBenignActive && (manualBilateralOverride === null ? autoHasFibroadenomasBilaterales : manualBilateralType === "fibroadenomas")
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-white"
              }`}
            >
              👁️ Activar: Fibroadenomas Múltiples
            </button>

            {manualBilateralOverride !== null && (
              <button
                onClick={() => {
                  setManualBilateralOverride(null);
                  setManualBilateralType(null);
                  if (onChangeBilateralOverride) {
                    onChangeBilateralOverride(null, null);
                  }
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 underline font-semibold transition-colors ml-1 cursor-pointer"
              >
                Restablecer Automático {autoBilateralActive ? "(Detectado)" : "(No detectado)"}
              </button>
            )}

            <button
              onClick={() => {
                const nextOverride = manualBilateralOverride === false ? null : false;
                setManualBilateralOverride(nextOverride);
                setManualBilateralType(null);
                if (onChangeBilateralOverride) {
                  onChangeBilateralOverride(nextOverride, null);
                }
              }}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                manualBilateralOverride === false
                  ? "bg-rose-950/80 text-rose-400 border-rose-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-white"
              }`}
            >
              🚫 Forzar Desactivación Manual
            </button>
          </div>
        </div>

        {/* CONTROLES MANUALES PARA IMPLANTES MAMARIOS */}
        <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-x-6 gap-y-2 items-center text-xs">
          <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider font-mono">
            Evaluación de Implantes Mamarios:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBreastImplantForceActive(!breastImplantForceActive)}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                isImplantActive
                  ? "bg-cyan-950/80 text-cyan-400 border-cyan-500/50 hover:bg-cyan-900/60"
                  : "bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{isImplantActive ? "✨ Estudio de Implantes Activo" : "👁️ Activar Estudio de Implantes"}</span>
              {isImplantImpressionActive() && (
                <span className="px-1.5 py-0.5 bg-cyan-900/60 text-cyan-300 rounded text-[7px] uppercase font-black tracking-wider border border-cyan-700/30 scale-95 ml-1">
                  (Auto)
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SYNC CONTEXT LOGS */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 font-mono text-[9px] text-slate-400 leading-normal max-h-[140px] overflow-y-auto">
          {syncLogs.map((log, index) => (
            <div key={index} className="flex gap-1">
              <span className="text-indigo-400">#</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN LAYOUT: SVGs SIDE BY SIDE & EDIT SIDEBAR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* SVGS VIEWPORT */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {renderBreastSvg(true)}
            </div>
            <div className="flex flex-col gap-2">
              {renderBreastSvg(false)}
            </div>
          </div>

          {additionalFindings && additionalFindings.length > 0 && (
            <div className="w-full bg-slate-900/10 border border-slate-850 p-3 rounded-2xl mt-2 text-left">
              <h5 className="text-[9px] uppercase font-black text-indigo-400 font-mono tracking-wider mb-2 select-none">
                📍 Hallazgos Adicionales Detectados
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
                {additionalFindings.map((item) => {
                  const s = item.state || "Alterado";
                  return (
                    <div 
                      key={item.id}
                      className="p-2 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col justify-between"
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

          {/* DIAGRAMA ESPECIAL EN CORTE SAGITAL PARA IMPLANTES MAMARIOS */}
          {renderImplantDiagram()}
        </div>

        {/* SIDEBAR DETAILED HANDLER */}
        <div className="xl:col-span-4 bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex flex-col gap-3 min-h-[300px]">
          {isBilateralBenignActive && (
            <div className="p-3 border border-emerald-900/40 bg-emerald-950/30 rounded-xl space-y-1">
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Sincronización Bilateral Activa
              </div>
              <p className="text-[10.5px] text-emerald-300 leading-snug">
                Se detectó: <strong className="text-white">{hasQuistesBilaterales ? "Quistes simples bilaterales" : "Fibroadenomas múltiples bilaterales"}</strong>. Ambas mamas se marcan como hallazgo benigno (verde).
              </p>
            </div>
          )}

          <div>
            <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest">
              Anotador Estructural
            </div>
            <h3 className="text-sm font-black text-white mt-0.5 truncate uppercase">
              {getStructureLabel(selectedStructure)}
            </h3>
          </div>

          {/* Custom State Input */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
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
                  setStates(prev => ({ ...prev, [selectedStructure]: nextVal }));
                  if (nextVal !== "no_descrito" && nextVal !== "normal") {
                    if (!customDescriptions[selectedStructure]) {
                      setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: getSimplifiedDescription(selectedStructure, nextVal) }));
                    }
                  } else {
                    setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: "" }));
                  }
                }}
                placeholder="Escriba el diagnóstico del hallazgo (ej: Nódulo, Quiste simple, etc.)"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStates(prev => ({ ...prev, [selectedStructure]: "normal" }));
                    setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: "" }));
                  }}
                  className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                    states[selectedStructure] === "normal"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-medium"
                      : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400"
                  }`}
                >
                  ✓ Cons. Normal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStates(prev => ({ ...prev, [selectedStructure]: "no_descrito" }));
                    setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: "" }));
                  }}
                  className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
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

          {/* EDIT FINDING DESCRIPTION */}
          {states[selectedStructure] !== "no_descrito" && states[selectedStructure] !== "normal" && (
            <div className="mt-1 animate-fadeIn">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                Hallazgo Clínico Específico (Editable):
              </label>
              <textarea
                value={customDescriptions[selectedStructure] || ""}
                onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: e.target.value }))}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 text-slate-250 text-xs rounded-lg p-2 focus:outline-none focus:border-rose-500 font-medium leading-relaxed resize-none"
                placeholder="Insertar sinopsis del hallazgo descrito en el reporte..."
              />
            </div>
          )}

          {states[selectedStructure] === "normal" && (
            <div className="p-2 border border-emerald-950/30 bg-emerald-950/15 rounded-lg text-emerald-450 text-[10px] leading-snug">
              ✓ <strong>Normal</strong>: Esta zona ecográfica se reporta sin anormalidades. Se omitirá del cuadro de hallazgos para evitar saturación del informe.
            </div>
          )}

          {states[selectedStructure] === "no_descrito" && (
            <div className="p-2 border border-slate-900/30 bg-slate-950/40 rounded-lg text-slate-450 text-[10px] leading-snug italic">
              Zonas no descritas quedan excluidas del mapeo activo.
            </div>
          )}

          {/* Mapeo de Hallazgos Clínicos Sintonizados (aligned anatomical cards) */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3 mt-3">
            <label className="text-[11px] font-black text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none mb-1">
              <Layers className="h-3.5 w-3.5 text-rose-400" />
              Mapeo de Hallazgos Clínicos Sintonizados (Mamas)
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.keys(states).filter(id => states[id] !== "no_descrito" && states[id] !== "normal").map(id => {
                const s = states[id];
                const isSelected = selectedStructure === id;
                const transLabel = getStructureLabel(id);
                const descText = customDescriptions[id]?.trim();
                const isInvalidDesc = !descText || descText.toLowerCase().includes("no descrito") || descText.toLowerCase().includes("no mencionado");
                const simplified = !isInvalidDesc
                  ? descText
                  : extractSentenceForBreast(generatedReport, id, getSimplifiedDescription(id, s));
                
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-450 border-emerald-900/30";
                } else if (s.includes("leve") || s.includes("quiste_simple") || s.includes("ectasia") || s.includes("benigno")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s.includes("masa") || s.includes("suspicious") || s.includes("sospecha") || s.includes("nodulo") || s.includes("birads")) {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
                } else {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-400 border-pink-900/30";
                }

                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setSelectedStructure(id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 relative overflow-hidden group cursor-pointer ${
                      isSelected 
                        ? "bg-slate-900 border-rose-500 text-rose-450 shadow-md scale-[1.01]" 
                        : "bg-slate-950/60 hover:bg-slate-950/80 border-slate-850/40 text-slate-350"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none w-full select-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className={`text-[10px] font-black uppercase tracking-wide truncate ${isSelected ? "text-rose-400" : "text-slate-200"}`}>
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
                const badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
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

            {/* Export button */}
            <div className="mt-2">
              <button
                type="button"
                onClick={exportTableData}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer border border-rose-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe actual"
              >
                <Download className="h-3 w-3" />
                Insertar Tabla al Reporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
