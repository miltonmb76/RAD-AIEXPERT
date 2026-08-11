import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Loader2, 
  Check, 
  Plus, 
  Info, 
  FileText, 
  Bookmark, 
  CheckCircle,
  HelpCircle,
  Wrench,
  AlertCircle,
  BookOpen,
  Trash2,
  Sliders,
  CheckCircle2,
  Zap,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Search,
  Activity
} from "lucide-react";

interface FootnoteSuggestion {
  id: string;
  category: "Médico Tratante" | "Paciente" | "Control" | "Técnico / General";
  text: string;
  selected: boolean;
}

interface ClinicalGuideline {
  id: string;
  title: string;
  description: string;
  text: string;
  source: string;
  requiredAnatomy?: string[];
  requiredAny?: string[];
  excludeAny?: string[];
}

interface DetectedGuideline {
  id: string;
  title: string;
  description: string;
  text: string;
  source: string;
}

interface CreadorNotasPieProps {
  selectedModel: string;
  reportText: string;
  onReportUpdated: (newText: string) => void;
}

// We have replaced the keyword-based matching with real-time AI-based clinical context evaluation to prevent false positives.

// Database of Clinical Practice Guidelines & Consensuses
const PRACTICE_GUIDELINES: ClinicalGuideline[] = [
  {
    id: "gpc-ti-rads",
    title: "ACR TI-RADS 2017",
    description: "Nódulos tiroideos y estratificación de riesgo de malignidad.",
    text: "Estratificación de riesgo estimada mediante criterios ACR TI-RADS 2017.",
    source: "American College of Radiology (ACR)",
    requiredAnatomy: ["tiroides", "tiroideo", "tiroidea", "istmo", "lóbulo", "lobulo"],
    requiredAny: ["nódulo", "nodulo", "quiste", "ti-rads", "tirads", "ecogenicidad", "calcificación", "calcificacion", "bocio"]
  },
  {
    id: "gpc-sru-carotidas",
    title: "Consenso SRU Carótidas",
    description: "Estenosis carotídea y criterios hemodinámicos de velocidad.",
    text: "Criterios hemodinámicos y graduación de estenosis carotídea basados en el Consenso de la Society of Radiologists in Ultrasound (SRU).",
    source: "Society of Radiologists in Ultrasound (SRU)",
    requiredAnatomy: ["carótida", "carotida", "carotídeo", "carotideo", "carótidas", "carotidas", "bulbo", "yugular", "bifurcación carotídea", "bifurcacion carotidea"],
    requiredAny: ["estenosis", "placa", "psv", "edv", "vps", "vdf", "soplo", "ateromatosa", "ateroma"],
    excludeAny: ["miembro inferior", "miembros inferiores", "pierna", "pedio", "tibial", "poplítea", "popliteal", "safena", "venoso", "venosa", "fístula", "fistula", "arterial de miembro", "arterial de miem"]
  },
  {
    id: "gpc-bi-rads",
    title: "ACR BI-RADS",
    description: "Estratificación y pautas de manejo en patología de mama.",
    text: "Categorización y pautas de manejo de lesiones mamarias según el sistema BI-RADS del American College of Radiology (ACR).",
    source: "American College of Radiology (ACR)",
    requiredAnatomy: ["mama", "mamario", "mamaria", "mamas", "mamarias", "retroareolar", "pezón", "pezon", "axila", "axilar"],
    requiredAny: ["bi-rads", "birads", "nódulo", "nodulo", "quiste", "ecogenicidad", "microcalcificación", "microcalcificacion", "fibroadenoma", "mamografía", "mamografia"],
    excludeAny: ["tiroides", "tiroideo", "carótida", "carotida", "quiste renal", "riñón", "riñon"]
  },
  {
    id: "gpc-bosniak",
    title: "Clasificación de Bosniak",
    description: "Estratificación de sospecha de malignidad en quistes renales.",
    text: "Estratificación y sospecha de malignidad en lesiones quísticas renales mediante criterios de la Clasificación de Bosniak.",
    source: "American College of Radiology (ACR)",
    requiredAnatomy: ["renal", "renales", "riñón", "riñon"],
    requiredAny: ["quiste", "quística", "quístico", "quisticas", "quisticos", "bosniak", "tabique", "calcificación", "calcificacion"],
    excludeAny: ["mama", "mamari", "tiroides", "carótida", "carotida", "bifurcación", "bifurcacion"]
  },
  {
    id: "gpc-sru-esteatosis",
    title: "Consenso SRU Hígado",
    description: "Gradación de esteatosis hepática por QUS (Leve 5.0-12.0%, Moderada 12.1-20.0%, Severa >20.0%) y pautas de control.",
    text: "Grado de esteatosis y pautas de seguimiento ecográfico según los criterios del Consenso de la Society of Radiologists in Ultrasound (SRU).",
    source: "Society of Radiologists in Ultrasound (SRU)",
    requiredAnatomy: ["hígado", "higado", "hepático", "hepatico", "vesícula", "vesicula", "portal", "porta", "suprahepáticas", "suprahepaticas"],
    requiredAny: ["esteatosis", "graso", "infiltración", "infiltracion", "hepatomegalia", "atenuación", "atenuacion"],
    excludeAny: ["mama", "mamari", "tiroides", "carótida", "carotida", "quiste renal", "quistes renales"]
  },
  {
    id: "gpc-kellgren",
    title: "Kellgren & Lawrence",
    description: "Grado de compromiso articular y severidad de osteoartritis de rodilla.",
    text: "Grado de compromiso articular y desgaste estructural valorado según la clasificación de Kellgren & Lawrence.",
    source: "Criterios Radiológicos Internacionales",
    requiredAnatomy: ["rodilla", "rodillas", "articulación", "articulacion", "femorotibial", "rotuliana"],
    requiredAny: ["kellgren", "artrosis", "osteofito", "esclerosis", "pinzamiento", "derrame", "menisco", "meniscal"],
    excludeAny: ["carótida", "carotida", "tiroides", "mama", "mamari", "doppler"]
  },
  {
    id: "gpc-sru-tvp",
    title: "Consenso SRU de TVP",
    description: "Evaluación de permeabilidad y criterios de compresión venosa.",
    text: "Evaluación de permeabilidad y compresibilidad venosa según las directrices del Consenso de la Society of Radiologists in Ultrasound (SRU) para Trombosis Venosa Profunda.",
    source: "Society of Radiologists in Ultrasound (SRU)",
    requiredAnatomy: ["venoso", "venosa", "safena", "femoral", "poplítea", "poplitea", "tibial", "peronea", "ilíaca", "iliaca"],
    requiredAny: ["trombosis", "tvp", "compresibilidad", "compresible", "reflujo", "insuficiencia", "válvula", "valvula", "permeabilidad", "trombo"],
    excludeAny: ["carótida", "carotida", "tiroides", "tiroideo", "mama", "mamari", "renal", "arterial"]
  },
  {
    id: "gpc-tasc-ii",
    title: "Consenso TASC II Arterial",
    description: "Evaluación de flujos doppler y estenosis arterial periférica.",
    text: "Clasificación de estenosis arterial periférica y perfiles de flujo Doppler según las recomendaciones del consenso TASC II (Trans-Atlantic Inter-Society Consensus).",
    source: "TASC II Group",
    requiredAnatomy: ["arterial", "arteria", "femoral", "poplítea", "poplitea", "tibial", "pedio", "peronea", "ilíaca", "iliaca"],
    requiredAny: ["tasc", "estenosis", "placa", "trifurcación", "trifurcacion", "monofásico", "monofasico", "bifásico", "bifasico", "trifásico", "trifasico", "itb", "índice tobillo-brazo", "indice tobillo-brazo"],
    excludeAny: ["carótida", "carotida", "carotídeo", "carotideo", "bulbo", "yugular", "venoso", "venosa", "safena", "tiroides", "mama"]
  },
  {
    id: "gpc-mannheim",
    title: "Consenso de Mannheim GIM",
    description: "Medición y percentiles del grosor íntima-media carotídeo.",
    text: "Medición y percentiles del grosor íntima-media carotídeo (GIM) valorados bajo los criterios del Consenso de Mannheim.",
    source: "Mannheim Consensus",
    requiredAnatomy: ["carótida", "carotida", "carotídeo", "carotideo", "carótidas", "carotidas"],
    requiredAny: ["gim", "imt", "íntima-media", "intima-media", "grosor", "espesor", "mannheim"],
    excludeAny: ["miembro inferior", "miembros inferiores", "pierna", "renal", "rodilla", "mama"]
  },
  {
    id: "gpc-or-ads",
    title: "Clasificación O-RADS",
    description: "Estratificación de riesgo en masas anexiales y ováricas.",
    text: "Estratificación de riesgo de malignidad de masas anexiales estimada mediante criterios de la clasificación internacional O-RADS (Ovarian-Adnexal Reporting and Data System).",
    source: "American College of Radiology (ACR)",
    requiredAnatomy: ["ovario", "ovárico", "ovarico", "ovarios", "anexo", "anexial", "anexos", "útero", "utero", "endometrio"],
    requiredAny: ["or-ads", "orads", "quiste", "sólido", "solido", "tabicado", "papilar", "septado", "líquido libre", "liquido libre", "pelvis", "pélvico", "pelvico"],
    excludeAny: ["rodilla", "carótida", "carotida", "tiroides", "mama", "renal"]
  },
  {
    id: "gpc-iota",
    title: "Reglas Simples IOTA",
    description: "Evaluación ecográfica de tumores de ovario.",
    text: "Evaluación morfológica de masas anexiales mediante la aplicación de las Reglas Simples del grupo IOTA (International Ovarian Tumor Analysis).",
    source: "IOTA Group",
    requiredAnatomy: ["ovario", "ovárico", "ovarico", "ovarios", "anexo", "anexial", "anexos"],
    requiredAny: ["iota", "reglas simples", "simple rules", "b-rules", "m-rules", "malignidad", "benignidad"],
    excludeAny: ["rodilla", "carótida", "carotida", "tiroides", "mama", "renal"]
  },
  {
    id: "gpc-tokio-tg18",
    title: "Guías de Tokio TG18",
    description: "Evaluación de sospecha y severidad de colecistitis aguda.",
    text: "Evaluación de sospecha y severidad de colecistitis aguda aplicando los criterios de las Guías de Tokio 2018 (TG18).",
    source: "Tokyo Guidelines",
    requiredAnatomy: ["vesícula", "vesicula", "biliar", "colédoco", "coledoco", "hepático", "hepatico"],
    requiredAny: ["colecistitis", "litiasis", "cálculo", "calculo", "barro biliar", "tokio", "tg18", "tokyo", "murphy", "engrosamiento de pared"],
    excludeAny: ["mama", "mamari", "tiroides", "carótida", "carotida", "quiste renal", "rodilla"]
  },
  {
    id: "gpc-apendice-acr",
    title: "Criterios Apendicitis ACR",
    description: "Hallazgos ecográficos de sospecha de apendicitis aguda.",
    text: "Criterios diagnósticos ecográficos de apendicitis aguda según las guías consensuadas del Colegio Americano de Radiología (ACR).",
    source: "American College of Radiology (ACR)",
    requiredAnatomy: ["apéndice", "apendice", "ciego", "fosa ilíaca", "fosa iliaca"],
    requiredAny: ["apendicitis", "diámetro apendicular", "diametro apendicular", "coprolito", "plastrón", "plastron", "apendicofito", "inflamatorio"],
    excludeAny: ["mama", "mamari", "tiroides", "carótida", "carotida", "vesícula", "vesicula"]
  }
];

/**
 * Helper to split full report text into:
 * 1. bodyText: The main report content (and its optional footnote section)
 * 2. annexesText: Any annexes appended after the main report body (e.g. ### CLASIFICACIÓN DE..., ### ANEXO..., ### CUADRO SINÓPTICO...)
 */
export const separateReportBodyAndAnnexes = (fullText: string): { bodyText: string; annexesText: string } => {
  if (!fullText) return { bodyText: "", annexesText: "" };

  const annexPattern = /(?:\n\s*---\s*)?\n(?:\s*(?:#{1,6}\s+|\*\*\s*)(?:ANEXO|DESGLOSE Y JUSTIFICACIÓN|CLASIFICACIÓN DE|ESQUEMA CLÍNICO DE HALLAZGOS|CUADRO SINÓPTICO|MATRIZ SEMIÓTICA|SINOPSIS CLÍNICA|SINOPSIS POR ÓRGANO|SINOPSIS DE ÓRGANO|ASISTENTE DE MEDIDAS|TABLA DE MEDIDAS|MEDICIONES Y PARÁMETROS|PARÁMETROS Y MEDIDAS|SÍNTESIS VASCULAR|SÍNTESIS DE ANATOMÍA|SINOPSIS DE FRACTURAS|EXPLICACIÓN DE INFORME|INFOGRAFÍA EXPLICATIVA)|(?:\s*ANEXO\s*:|\s*ANEXO DIAGNÓSTICO|\s*DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIÓN))\b/i;

  const match = fullText.match(annexPattern);
  if (match && match.index !== undefined) {
    const bodyText = fullText.substring(0, match.index).trimEnd();
    let annexesText = fullText.substring(match.index);
    if (!annexesText.startsWith("\n")) {
      annexesText = "\n\n" + annexesText.trimStart();
    }
    return { bodyText, annexesText };
  }

  return { bodyText: fullText.trimEnd(), annexesText: "" };
};

/**
 * Helper to insert or remove footnote lines specifically in the main report body.
 */
export const updateFootnotesInReport = (
  fullText: string,
  linesToAdd: string[],
  linesToRemove: string[] = []
): string => {
  const { bodyText, annexesText } = separateReportBodyAndAnnexes(fullText);

  // Split bodyText into main content (before ---) and existing footnotes (after --- inside bodyText)
  let mainContent = bodyText;
  let existingFootnotes: string[] = [];

  const dashParts = bodyText.split(/\n\s*---\s*\n/);
  if (dashParts.length > 1) {
    mainContent = dashParts[0].trimEnd();
    const footnoteSectionRaw = dashParts.slice(1).join("\n\n");
    existingFootnotes = footnoteSectionRaw
      .split(/\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  } else {
    mainContent = bodyText.trimEnd();
  }

  // Filter out any footnote that should be removed
  let updatedFootnotes = existingFootnotes.filter(fn => {
    return !linesToRemove.some(rem => fn.includes(rem.trim()) || rem.trim().includes(fn));
  });

  // Add new footnote lines if not already present
  linesToAdd.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !updatedFootnotes.some(fn => fn.includes(trimmed) || trimmed.includes(fn))) {
      updatedFootnotes.push(trimmed);
    }
  });

  // Reconstruct bodyText
  let newBodyText = mainContent;
  if (updatedFootnotes.length > 0) {
    newBodyText += `\n\n---\n\n${updatedFootnotes.join("\n\n")}`;
  }

  return newBodyText + annexesText;
};

export const CreadorNotasPie: React.FC<CreadorNotasPieProps> = ({
  selectedModel,
  reportText,
  onReportUpdated
}) => {
  const [footnotes, setFootnotes] = useState<FootnoteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Custom states for Dynamic Guidelines
  const [autoInsert, setAutoInsert] = useState<boolean>(() => {
    return localStorage.getItem("rad_auto_insert_guidelines") !== "false";
  });
  const [autoInsertedHistory, setAutoInsertedHistory] = useState<string[]>([]);
  const [dismissedGuidelines, setDismissedGuidelines] = useState<string[]>([]);
  const [showAllGuidelines, setShowAllGuidelines] = useState<boolean>(false);

  // States for external/fracture AI-powered detection
  const [detectedGuidelines, setDetectedGuidelines] = useState<DetectedGuideline[]>([]);
  const [isScanningExternal, setIsScanningExternal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("rad_auto_insert_guidelines", String(autoInsert));
  }, [autoInsert]);

  const [aiMatchedIds, setAiMatchedIds] = useState<string[]>([]);
  const lastScannedTextRef = React.useRef<string>("");

  const scanReportWithAI = async (isBackground = false) => {
    if (!reportText.trim()) return;

    if (!isBackground) {
      setIsScanningExternal(true);
      setError(null);
      setSuccessMsg(null);
    }

    try {
      const response = await fetch("/api/detect-external-guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText
        })
      });

      if (!response.ok) {
        throw new Error("Error al consultar el servicio de detección de IA.");
      }

      const data = await response.json();
      if (data.success) {
        setDetectedGuidelines(data.detected || []);
        setAiMatchedIds(data.matchedStandardIds || []);
        
        lastScannedTextRef.current = reportText;

        if (!isBackground) {
          const totalMatched = (data.matchedStandardIds?.length || 0) + (data.detected?.length || 0);
          if (totalMatched === 0) {
            setSuccessMsg("Análisis completado: No se detectaron clasificaciones ni consensos aplicables.");
          } else {
            setSuccessMsg(`¡Análisis clínico completado con IA! Se identificaron ${totalMatched} consensos/guías pertinentes.`);
          }
          setTimeout(() => setSuccessMsg(null), 5000);
        }
      } else {
        throw new Error(data.error || "No se pudo recuperar información de la IA.");
      }
    } catch (err: any) {
      console.error("Error al buscar clasificaciones con IA:", err);
      if (!isBackground) {
        setError(err.message || "Ocurrió un error al buscar consensos y clasificaciones.");
      }
    } finally {
      if (!isBackground) {
        setIsScanningExternal(false);
      }
    }
  };

  // Debounced auto-scan when reportText changes significantly
  useEffect(() => {
    if (!reportText.trim()) return;

    const getCoreText = (t: string) => {
      const { bodyText } = separateReportBodyAndAnnexes(t);
      return bodyText.trim();
    };

    const currentCore = getCoreText(reportText);
    const lastCore = getCoreText(lastScannedTextRef.current);

    if (currentCore === lastCore) return;

    const timer = setTimeout(() => {
      scanReportWithAI(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [reportText]);

  // Auto-insertion based on AI-matched IDs
  useEffect(() => {
    if (!autoInsert || !reportText.trim() || aiMatchedIds.length === 0) return;

    const match = PRACTICE_GUIDELINES.find(g => {
      const isMatched = aiMatchedIds.includes(g.id);
      const alreadyInText = reportText.includes(g.text);
      const isDismissed = dismissedGuidelines.includes(g.id);
      const wasAutoInserted = autoInsertedHistory.includes(g.id);

      return isMatched && !alreadyInText && !isDismissed && !wasAutoInserted;
    });

    if (match) {
      const finalReport = updateFootnotesInReport(reportText, [match.text], []);
      setAutoInsertedHistory(prev => [...prev, match.id]);
      onReportUpdated(finalReport);

      setSuccessMsg(`Autodetección con IA: Se añadió la nota de "${match.title}" al pie de página.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  }, [reportText, autoInsert, dismissedGuidelines, autoInsertedHistory, aiMatchedIds]);

  const handleGenerateFootnotes = async () => {
    if (!reportText.trim()) {
      setError("No hay texto de informe elaborado para analizar. Genera o escribe un reporte clínico primero.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/generate-footnotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText
        })
      });

      if (!response.ok) {
        throw new Error("Error al obtener las sugerencias del servidor.");
      }

      const data = await response.json();
      if (data.success && data.footnotes) {
        const mapped: FootnoteSuggestion[] = data.footnotes.map((fn: any) => ({
          ...fn,
          selected: true
        }));
        setFootnotes(mapped);
      } else {
        throw new Error(data.error || "La IA no retornó sugerencias válidas.");
      }
    } catch (err: any) {
      console.error("Error al generar pies de página:", err);
      setError(err.message || "Ocurrió un error inesperado al analizar el reporte.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setFootnotes(prev => prev.map(fn => 
      fn.id === id ? { ...fn, selected: !fn.selected } : fn
    ));
  };

  const handleInsertFootnotes = () => {
    const selectedFns = footnotes.filter(fn => fn.selected);
    if (selectedFns.length === 0) {
      setError("Por favor, selecciona al menos una nota de pie de página para incrustar.");
      return;
    }

    const footnoteTextLines = selectedFns.map(fn => fn.text);
    const finalReport = updateFootnotesInReport(reportText, footnoteTextLines, []);
    
    onReportUpdated(finalReport);
    setSuccessMsg(`¡Se han incrustado ${selectedFns.length} notas de pie de página al final de su reporte!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Manual interactive insertion for a guideline reference
  const handleInsertGuideline = (g: ClinicalGuideline) => {
    if (reportText.includes(g.text)) return;
    const finalReport = updateFootnotesInReport(reportText, [g.text], []);

    onReportUpdated(finalReport);
    setSuccessMsg(`¡Guía "${g.title}" añadida como nota de pie de página!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Manual interactive removal of a guideline reference
  const handleRemoveGuideline = (g: ClinicalGuideline) => {
    // Record as dismissed so background autodetect doesn't force re-inserting it immediately
    if (!dismissedGuidelines.includes(g.id)) {
      setDismissedGuidelines(prev => [...prev, g.id]);
    }

    const finalReport = updateFootnotesInReport(reportText, [], [g.text]);
    onReportUpdated(finalReport);
    setSuccessMsg(`Se ha removido la guía "${g.title}" del pie de página.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // AI-Powered search for bone fractures and other external guidelines/consensuses
  const handleDetectExternal = async () => {
    await scanReportWithAI(false);
  };

  const handleInsertExternalGuideline = (eg: DetectedGuideline) => {
    if (reportText.includes(eg.text)) return;
    const finalReport = updateFootnotesInReport(reportText, [eg.text], []);

    onReportUpdated(finalReport);
    setSuccessMsg(`¡Clasificación "${eg.title}" añadida como nota de pie de página!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRemoveExternalGuideline = (eg: DetectedGuideline) => {
    const finalReport = updateFootnotesInReport(reportText, [], [eg.text]);
    onReportUpdated(finalReport);
    setSuccessMsg(`Se ha removido "${eg.title}" del pie de página.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case "Médico Tratante":
        return {
          bg: "bg-indigo-950/40 border-indigo-900/40 text-indigo-300",
          icon: <Bookmark className="h-3.5 w-3.5 text-indigo-400" />
        };
      case "Paciente":
        return {
          bg: "bg-emerald-950/40 border-emerald-900/40 text-emerald-300",
          icon: <HelpCircle className="h-3.5 w-3.5 text-emerald-400" />
        };
      case "Control":
        return {
          bg: "bg-amber-950/40 border-amber-900/40 text-amber-300",
          icon: <CheckCircle className="h-3.5 w-3.5 text-amber-400" />
        };
      default:
        return {
          bg: "bg-slate-900 border-slate-800 text-slate-300",
          icon: <Wrench className="h-3.5 w-3.5 text-slate-400" />
        };
    }
  };

  // Check which guidelines are matched in current report text
  const matchedGuidelines = PRACTICE_GUIDELINES.filter(g => 
    aiMatchedIds.includes(g.id)
  );

  // Check which guidelines are already present as footer lines in report text
  const incrustedGuidelines = PRACTICE_GUIDELINES.filter(g => 
    reportText.includes(g.text)
  );

  return (
    <div className="bg-[#0b0813]/95 border border-slate-800/80 rounded-3xl p-6 shadow-2xl h-full flex flex-col justify-between backdrop-blur-md relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-44 h-44 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-900/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-650/15 border border-indigo-500/25 rounded-2xl">
              <BookOpen className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                Pies de Página Médicos Avanzados
              </h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono mt-0.5">
                Guías de Consenso e Inteligencia Clínica
              </p>
            </div>
          </div>
          
          {/* Global Auto-Insert Toggle Switch */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/60 px-3 py-1.5 rounded-2xl">
            <span className="text-[8.5px] font-bold text-slate-400 font-mono uppercase tracking-wide">
              Auto-Incrustar
            </span>
            <button
              onClick={() => {
                const newVal = !autoInsert;
                setAutoInsert(newVal);
                if (newVal) {
                  // clear dismissed list to allow fresh matching
                  setDismissedGuidelines([]);
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoInsert ? "bg-indigo-600" : "bg-slate-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoInsert ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* SECTION A: INSERCIÓN DINÁMICA DE GUÍAS DE PRÁCTICA CLÍNICA Y CONSENSOS */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider font-mono">
                Guías de Práctica Clínica y Consensos
              </span>
            </div>
            <button
              onClick={() => setShowAllGuidelines(prev => !prev)}
              className="text-[9px] font-black uppercase text-slate-400 hover:text-indigo-400 tracking-wider font-mono flex items-center gap-1 transition-colors"
            >
              <span>{showAllGuidelines ? "Ver Recomendadas" : "Ver Todas las Guías"}</span>
              {showAllGuidelines ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          <p className="text-[10.5px] font-medium text-slate-400 leading-normal">
            El sistema evalúa continuamente su reporte en busca de hallazgos para asociar consensos de la <strong>ACR, SRU o Kellgren</strong> y agregarlos automáticamente al pie de página.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRACTICE_GUIDELINES.map((g) => {
              const matched = aiMatchedIds.includes(g.id);
              const incrusted = reportText.includes(g.text);
              
              // Skip rendering if not matched and we are not in "showAll" mode
              if (!matched && !showAllGuidelines) return null;

              return (
                <div
                  key={g.id}
                  className={`border rounded-2xl p-3.5 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    incrusted 
                      ? "bg-indigo-950/15 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                      : matched
                        ? "bg-purple-950/10 border-purple-500/25 shadow-md shadow-purple-950/10 animate-pulse-subtle"
                        : "bg-slate-950/40 border-slate-900 opacity-65 hover:opacity-95"
                  }`}
                >
                  <div className="space-y-1 text-left">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h5 className="text-[10.5px] font-black text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <BookmarkCheck className={`h-3.5 w-3.5 ${incrusted ? "text-indigo-400" : matched ? "text-purple-400" : "text-slate-500"}`} />
                        {g.title}
                      </h5>
                      
                      {incrusted ? (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                          <Check className="h-2.5 w-2.5 stroke-[3px]" />
                          Incrustado
                        </span>
                      ) : matched ? (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-purple-950/40 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                          <Zap className="h-2.5 w-2.5 shrink-0" />
                          Recomendado
                        </span>
                      ) : null}
                    </div>
                    
                    <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed">
                      {g.description}
                    </p>
                    
                    <div className="text-[9px] text-indigo-300 font-bold font-mono uppercase bg-slate-950/60 p-1.5 rounded-lg border border-slate-900/60 leading-tight">
                      "{g.text}"
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-900/40 pt-2.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                      {g.source}
                    </span>

                    {incrusted ? (
                      <button
                        onClick={() => handleRemoveGuideline(g)}
                        className="py-1 px-2.5 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/30 rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 font-mono"
                        title="Retirar nota de pie de página"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                        <span>Quitar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInsertGuideline(g)}
                        className={`py-1 px-2.5 border rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 font-mono ${
                          matched
                            ? "bg-purple-600/20 text-purple-250 border-purple-500/40 hover:bg-purple-600/30"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>Incrustar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {matchedGuidelines.length === 0 && !showAllGuidelines && (
            <div className="p-3.5 border border-dashed border-slate-900 bg-slate-950/20 rounded-2xl text-center">
              <p className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                No se detectaron clasificaciones específicas (Tiroides, Carótidas, Mamas, Renal, Hígado, Rodilla, Doppler, Ginecología, etc.) en este reporte.
              </p>
              <button
                onClick={() => setShowAllGuidelines(true)}
                className="mt-2 text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest font-mono underline cursor-pointer"
              >
                Haga clic aquí para examinar e incrustar una guía manualmente
              </button>
            </div>
          )}
        </div>

        {/* SECTION A-2: AI CONSENSUS & BONE FRACTURE CLASSIFICATION DEEP SEARCH */}
        <div className="space-y-4 pt-4 border-t border-slate-900/60 bg-indigo-950/5 p-4 rounded-2xl border border-indigo-900/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              <div>
                <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono block">
                  Buscador de Fracturas e IA de Consensos
                </span>
                <span className="text-[8.5px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                  Base Científica Global y Ortopedia
                </span>
              </div>
            </div>
            
            <button
              onClick={handleDetectExternal}
              disabled={isScanningExternal || !reportText.trim()}
              className="px-3 py-1.5 bg-emerald-600/25 hover:bg-emerald-600/35 disabled:opacity-40 text-emerald-300 border border-emerald-500/30 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer font-mono"
            >
              {isScanningExternal ? (
                <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              <span>{isScanningExternal ? "Buscando..." : "Escanear con IA"}</span>
            </button>
          </div>

          <p className="text-[10.5px] font-medium text-slate-400 leading-normal">
            ¿Su reporte describe fracturas óseas, traumatismos o hallazgos complejos? Presione <strong>Escanear con IA</strong> para analizar en profundidad con Gemini y determinar con precisión la clasificación científica aplicable (ej: AO, Salter-Harris, Schatzker, Gustilo-Anderson, Garden, etc.).
          </p>

          {isScanningExternal && (
            <div className="py-4 flex flex-col items-center justify-center space-y-2 border border-dashed border-emerald-550/20 bg-emerald-950/5 rounded-xl">
              <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
              <p className="text-[9.5px] font-mono font-black text-slate-300 uppercase tracking-widest animate-pulse text-center px-4">
                Consultando literatura médica para determinar clasificaciones...
              </p>
            </div>
          )}

          {detectedGuidelines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider font-mono">
                  Clasificaciones Clínicas Especiales Detectadas:
                </span>
                <button
                  onClick={() => setDetectedGuidelines([])}
                  className="text-[8.5px] font-black uppercase text-rose-400 hover:text-rose-350 tracking-wider font-mono"
                >
                  Limpiar Búsqueda
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detectedGuidelines.map((eg) => {
                  const incrusted = reportText.includes(eg.text);
                  return (
                    <div
                      key={eg.id}
                      className={`border rounded-2xl p-3.5 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                        incrusted
                          ? "bg-emerald-950/15 border-emerald-550/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                          : "bg-[#111c1d] border-emerald-950 shadow-md shadow-emerald-950/25"
                      }`}
                    >
                      <div className="space-y-1 text-left">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h5 className="text-[10.5px] font-black text-emerald-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Activity className={`h-3.5 w-3.5 ${incrusted ? "text-emerald-400" : "text-emerald-300"}`} />
                            {eg.title}
                          </h5>
                          {incrusted && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                              <Check className="h-2.5 w-2.5 stroke-[3px]" />
                              Incrustado
                            </span>
                          )}
                        </div>

                        <p className="text-[9.5px] text-slate-300 font-medium leading-relaxed">
                          {eg.description}
                        </p>

                        <div className="text-[9px] text-emerald-300 font-bold font-mono uppercase bg-[#0d1617] p-1.5 rounded-lg border border-emerald-950/60 leading-tight">
                          "{eg.text}"
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-emerald-950/40 pt-2.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                          {eg.source || "Consenso Global"}
                        </span>

                        {incrusted ? (
                          <button
                            onClick={() => handleRemoveExternalGuideline(eg)}
                            className="py-1 px-2.5 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/30 rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 font-mono"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            <span>Quitar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInsertExternalGuideline(eg)}
                            className="py-1 px-2.5 bg-emerald-600/20 text-emerald-250 border border-emerald-500/40 hover:bg-emerald-600/30 rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 font-mono"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            <span>Incrustar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION B: AUDITORÍA DE REPORTES E IA FOOTNOTES */}
        <div className="space-y-4 pt-4 border-t border-slate-900/60">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider font-mono">
              Auditoría y Petición de Notas de Pie por IA
            </span>
          </div>

          {/* Generate Button / Trigger */}
          {footnotes.length === 0 && !isLoading && (
            <div className="py-5 flex flex-col items-center justify-center border border-dashed border-slate-805/50 rounded-2xl bg-slate-950/20">
              <FileText className="h-7 w-7 text-slate-600 mb-2 animate-pulse" />
              <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-3.5 font-mono text-center px-4">
                ¿Desea generar pautas personalizadas de seguimiento y control con IA?
              </p>
              <button
                onClick={handleGenerateFootnotes}
                className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer font-mono"
              >
                <Sparkles className="h-3 w-3 text-indigo-200" />
                <span>Ejecutar Auditoría por IA</span>
              </button>
            </div>
          )}

          {/* Loader State */}
          {isLoading && (
            <div className="py-8 flex flex-col items-center justify-center space-y-2.5">
              <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
              <p className="text-[9.5px] font-mono font-black text-slate-300 uppercase tracking-widest animate-pulse">
                Auditando reporte íntegro con IA...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3.5 bg-rose-950/10 border border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-400 text-[9.5px] font-mono font-bold uppercase">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success State */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-xl flex items-start gap-2 text-emerald-400 text-[9.5px] font-semibold font-sans">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footnotes Suggestions List */}
          {footnotes.length > 0 && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider font-mono">
                  Sugerencias elaboradas por la IA:
                </span>
                <button
                  onClick={handleGenerateFootnotes}
                  className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-wider font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Regenerar Auditoría</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {footnotes.map((fn) => {
                  const styles = getCategoryStyles(fn.category);
                  return (
                    <div
                      key={fn.id}
                      onClick={() => handleToggleSelect(fn.id)}
                      className={`p-3 border rounded-2xl transition-all cursor-pointer flex gap-3 ${
                        fn.selected 
                          ? "bg-slate-900/70 border-indigo-500/25 shadow-[0_0_12px_rgba(99,102,241,0.02)]" 
                          : "bg-slate-950/20 border-slate-900 opacity-60 hover:opacity-90 hover:border-slate-800"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                          fn.selected 
                            ? "bg-indigo-600 border-indigo-500" 
                            : "border-slate-700 bg-slate-950"
                        }`}>
                          {fn.selected && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider font-mono flex items-center gap-1 ${styles.bg}`}>
                            {styles.icon}
                            {fn.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed font-sans">
                          {fn.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleInsertFootnotes}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer font-mono mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Incrustar Seleccionadas ({footnotes.filter(f => f.selected).length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-900/60 flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-500 shrink-0" />
        <p className="text-[9px] text-slate-500 leading-normal font-sans">
          Las notas añadidas se inyectarán en la sección baja del PDF ("Footnotes") en color gris elegante y atenuado para no sobrecargar el cuerpo principal del diagnóstico clínico.
        </p>
      </div>
    </div>
  );
};
