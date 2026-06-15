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

interface AbdomenAnatomyViewerProps {
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

const ABDOMEN_STRUCTURES = [
  {
    id: "higado",
    name: "Hígado",
    allowedStates: ["no_descrito", "normal", "esteatosis_leve", "esteatosis_moderada", "esteatosis_severa", "hepatomegalia", "cirrosis", "lesion_ocupante_espacio", "quiste"]
  },
  {
    id: "vesicula",
    name: "Vesícula Biliar",
    allowedStates: ["no_descrito", "normal", "litiasis", "barro_biliar", "colecistitis_aguda", "colecistitis_cronica", "polipo", "pared_engrosada"]
  },
  {
    id: "pancreas",
    name: "Páncreas",
    allowedStates: ["no_descrito", "normal", "pancreatitis_aguda", "pancreatitis_cronica", "atrofia", "lesion_quistica", "no_visible_gas"]
  },
  {
    id: "bazo",
    name: "Bazo",
    allowedStates: ["no_descrito", "normal", "esplenomegalia", "nodulo_esplenico"]
  },
  {
    id: "rinon_derecho",
    name: "Riñón Derecho",
    allowedStates: ["no_descrito", "normal", "litiasis", "quiste_simple", "hidronefrosis", "quiste_complejo", "masa_solida"]
  },
  {
    id: "rinon_izquierdo",
    name: "Riñón Izquierdo",
    allowedStates: ["no_descrito", "normal", "litiasis", "quiste_simple", "hidronefrosis", "quiste_complejo", "masa_solida"]
  },
  {
    id: "vejiga",
    name: "Vejiga",
    allowedStates: ["no_descrito", "normal", "pared_engrosada", "sedimento_urinario", "litiasis", "masa_vesical"]
  },
  {
    id: "prostata",
    name: "Próstata",
    allowedStates: ["no_descrito", "normal", "hiperplasia_benigna", "quiste", "calcificaciones"]
  },
  {
    id: "utero",
    name: "Útero",
    allowedStates: ["no_descrito", "normal", "miomatosis", "endometrio_engrosado", "liquido_libre"]
  },
  {
    id: "ovarios",
    name: "Ovarios",
    allowedStates: ["no_descrito", "normal", "quiste_simple", "quiste_complejo", "ovarios_poliquisticos"]
  },
  {
    id: "psoas",
    name: "Músculo Psoas",
    allowedStates: ["no_descrito", "normal", "hematoma", "absceso", "asimetria"]
  },
  {
    id: "colon",
    name: "Colon",
    allowedStates: ["no_descrito", "normal", "meteorismo_abundante", "diverticulosis", "pared_engrosada", "fecaloma"]
  }
];

export default function AbdomenAnatomyViewer({
  selectedModel,
  generatedReport,
  onChangeReport,
  onExportTable,
  onExportNarrative,
  includeInReport = true,
  setIncludeInReport,
  onChangeStates,
  onChangeDescriptions
}: AbdomenAnatomyViewerProps) {
  
  const [states, setStates] = useState<Record<string, string>>({
    higado: "no_descrito",
    vesicula: "no_descrito",
    pancreas: "no_descrito",
    bazo: "no_descrito",
    rinon_derecho: "no_descrito",
    rinon_izquierdo: "no_descrito",
    vejiga: "no_descrito",
    prostata: "no_descrito",
    utero: "no_descrito",
    ovarios: "no_descrito",
    psoas: "no_descrito",
    colon: "no_descrito"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    higado: "",
    vesicula: "",
    pancreas: "",
    bazo: "",
    rinon_derecho: "",
    rinon_izquierdo: "",
    vejiga: "",
    prostata: "",
    utero: "",
    ovarios: "",
    psoas: "",
    colon: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("higado");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

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

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (s === "no_descrito") {
      return "No mencionado / No descrito.";
    }
    if (s === "normal") {
      return "Dentro de límites normales.";
    }

    switch (id) {
      case "higado":
        if (s === "esteatosis_leve") return "Infiltración grasa hepática leve.";
        if (s === "esteatosis_moderada") return "Infiltración grasa hepática moderada, atenuación haz sónico.";
        if (s === "esteatosis_severa") return "Infiltración grasa hepática severa, mala visualización diafragmática.";
        if (s === "hepatomegalia") return "Heredo-diámetro longitudinal renal aumentado.";
        if (s === "cirrosis") return "Bordes lobulados / nodulares y ecotextura heterogénea.";
        if (s === "lesion_ocupante_espacio") return "Imagen nodular sólida hipo/hiperecogénica sospechosa.";
        if (s === "quiste") return "Lesión anecoica de paredes finas con refuerzo posterior.";
        break;
      case "vesicula":
        if (s === "litiasis") return "Cálculos hiperecogénicos móviles con sombra acústica posterior.";
        if (s === "barro_biliar") return "Ecos de bajo nivel en su interior que decantan sin sombra.";
        if (s === "colecistitis_aguda") return "Pared engrosada (>4mm), signo de Murphy ultrasonográfico positivo.";
        if (s === "colecistitis_cronica") return "Paredes escleroatróficas o engrosadas con litiasis crónica.";
        if (s === "polipo") return "Imagen ecogénica fija a la pared sin sombra acústica.";
        if (s === "pared_engrosada") return "Engrosamiento difuso de la pared vesicular sin Murphy positivo.";
        break;
      case "pancreas":
        if (s === "pancreatitis_aguda") return "Glándula aumentada de tamaño, hipoecoica y difusa.";
        if (s === "pancreatitis_cronica") return "Fibrosis focal, calcificaciones e irregularidad del conducto de Wirsung.";
        if (s === "atrofia") return "Tamaño pancreático disminuido, ecogenicidad aumentada por infiltración grasa.";
        if (s === "lesion_quistica") return "Lesión de contenido líquido en cuerpo/cola hepáticos.";
        if (s === "no_visible_gas") return "No valorable de forma óptima secundario a interfase gaseosa intestinal.";
        break;
      case "bazo":
        if (s === "esplenomegalia") return "Diámetro mayor a 120-130 mm con ecotextura conservada.";
        if (s === "nodulo_esplenico") return "Discreta imagen focal hipoecogénica vascularizada.";
        break;
      case "rinon_derecho":
      case "rinon_izquierdo":
        if (s === "litiasis") return "Nódulo hiperecogénico lobulado con sombra acústica.";
        if (s === "quiste_simple") return "Quiste cortical asintomático de contornos definidos.";
        if (s === "hidronefrosis") return "Dilatación del sistema colector renal secundario a obstrucción.";
        if (s === "quiste_complejo") return "Quiste complejo Bosniak con tabiques o calcificación.";
        if (s === "masa_solida") return "Lesión ocupante de espacio sólida con vascularización anormal.";
        break;
      case "vejiga":
        if (s === "pared_engrosada") return "Vejiga de paredes gruesas de aspecto inflamatorio crónico.";
        if (s === "sedimento_urinario") return "Abundante sedimiento vesical móvil en suspensión.";
        if (s === "litiasis") return "Imagen hiperecogénica móvil con sombra acústica en luz vesical.";
        if (s === "masa_vesical") return "Lesión sobreelevada vegetante compatible con masa vesical.";
        break;
      case "prostata":
        if (s === "hiperplasia_benigna") return "Aumento difuso de tamaño del volumen prostático sugestivo de HPB.";
        if (s === "quiste") return "Definido quiste prostático de carácter benigno.";
        if (s === "calcificaciones") return "Calcificaciones periuretrales de aspecto residual.";
        break;
      case "utero":
        if (s === "miomatosis") return "Miometrio heterogéneo con nódulos miomatosos descritos.";
        if (s === "endometrio_engrosado") return "Engrosamiento de la línea endometrial para su edad.";
        if (s === "liquido_libre") return "Líquido libre en escasa cantidad en fondo de saco vaginal posterior.";
        break;
      case "ovarios":
        if (s === "quiste_simple") return "Quiste anecoico simple avascular de paredes delgadas.";
        if (s === "quiste_complejo") return "Lesión quística compleja con tabiques o septos internos.";
        if (s === "ovarios_poliquisticos") return "Ovarios aumentados de volumen con microfolículos periféricos.";
        break;
      case "psoas":
        if (s === "hematoma") return "Colección hipoecoica definida en músculo psoas sugestiva de hematoma.";
        if (s === "absceso") return "Colección fluida compleja retroperitoneal sugestiva de absceso.";
        if (s === "asimetria") return "Asimetría en espesor de músculos psoas bilaterales.";
        break;
      case "colon":
        if (s === "meteorismo_abundante") return "Importante distensión gaseosa de asas colónicas.";
        if (s === "diverticulosis") return "Imágenes saculares de adición diverticulares en colon.";
        if (s === "pared_engrosada") return "Engrosamiento de la pared del colon compatible con colonopatía.";
        if (s === "fecaloma") return "Masa de retención fecal con sombra acústica en fosa ilíaca izquierda.";
        break;
    }
    return "Alteración focal descrita.";
  };

  const runLocalHeuristics = (logs: string[]) => {
    const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };

    const keywords: Record<string, string[]> = {
      higado: ["higado", "hepatico", "parenquima", "segmento", "lobo hepatico", "hipertrofia", "esteatosis"],
      vesicula: ["vesicula", "colecisto", "biliar", "litiasis vesicular", "barro biliar", "polipo", "murphy"],
      pancreas: ["pancreas", "pancreatico", "wirsung", "cabeza", "cuerpo", "cola"],
      bazo: ["bazo", "esplenico", "linea esplenica", "esplenomegalia", "nodulo esplenico"],
      rinon_derecho: ["rinon derecho", "rd de las vias", "rd renal", "rinon d", "r. derecho", "renal derecho", "rd"],
      rinon_izquierdo: ["rinon izquierdo", "ri de las vias", "ri renal", "rinon i", "r. izquierdo", "renal izquierdo", "ri"],
      vejiga: ["vejiga", "vesical", "replecion vesical", "replección vesical"],
      prostata: ["prostata", "prostatic", "hpb", "glandula prostatica", "glándula prostática"],
      utero: ["utero", "uterino", "miometrio", "endometrio"],
      ovarios: ["ovario", "anexial", "anexos", "folicular"],
      psoas: ["psoas", "musculo psoas", "músculo psoas"],
      colon: ["colon", "marcobase", "meteorismo", "gas intestinal", "ciego", "sigmoides"]
    };

    Object.keys(keywords).forEach(id => {
      let isMentioned = false;
      keywords[id].forEach(kw => {
        if (textLower.includes(kw)) {
          isMentioned = true;
        }
      });

      let detectedState = "no_descrito";
      let desc = "No mencionado / No descrito.";

      if (isMentioned) {
        detectedState = "normal";
        desc = "Dentro de límites normales.";

        // Subpattern search
        if (id === "higado") {
          if (textLower.includes("esteatosis leve") || textLower.includes("higado graso leve") || textLower.includes("infiltracion grasa leve")) {
            detectedState = "esteatosis_leve";
            desc = "Infiltración grasa hepática leve.";
          } else if (textLower.includes("esteatosis moderada") || textLower.includes("higado graso moderado") || textLower.includes("infiltracion grasa moderada")) {
            detectedState = "esteatosis_moderada";
            desc = "Infiltración grasa hepática moderada.";
          } else if (textLower.includes("esteatosis severa") || textLower.includes("higado graso severo") || textLower.includes("infiltracion grasa severa")) {
            detectedState = "esteatosis_severa";
            desc = "Infiltración grasa hepática severa.";
          } else if (textLower.includes("hepatomegalia") || textLower.includes("aumentado de tamano")) {
            detectedState = "hepatomegalia";
            desc = "Hepatomegalia descrita.";
          } else if (textLower.includes("cirrosis") || textLower.includes("heterogeneo de aspecto cronico")) {
            detectedState = "cirrosis";
            desc = "Cirrosis / Cambios hepáticos crónicos.";
          } else if (textLower.includes("loe") || textLower.includes("nodulo") || textLower.includes("lesion ocupante")) {
            detectedState = "lesion_ocupante_espacio";
            desc = "Lesión ocupante de espacio sospechosa.";
          } else if (textLower.includes("quiste")) {
            detectedState = "quiste";
            desc = "Quiste hepático simple.";
          }
        } else if (id === "vesicula") {
          if (textLower.includes("litiasis") || textLower.includes("calculo") || textLower.includes("concreciones")) {
            detectedState = "litiasis";
            desc = "Litiasis vesicular.";
          } else if (textLower.includes("barro") || textLower.includes("microlitiasis") || textLower.includes("sedimento biliar")) {
            detectedState = "barro_biliar";
            desc = "Barro biliar detectado.";
          } else if (textLower.includes("colecistitis aguda") || textLower.includes("murphy positivo")) {
            detectedState = "colecistitis_aguda";
            desc = "Signos ecográficos de colecistitis aguda.";
          } else if (textLower.includes("colecistitis cronica")) {
            detectedState = "colecistitis_cronica";
            desc = "Colecistitis crónica litiásica.";
          } else if (textLower.includes("polipo")) {
            detectedState = "polipo";
            desc = "Pólipo vesicular parietal.";
          } else if (textLower.includes("pared engrosada") || textLower.includes("engrosamiento difuso")) {
            detectedState = "pared_engrosada";
            desc = "Pared vesicular engrosada.";
          }
        } else if (id === "pancreas") {
          if (textLower.includes("pancreatitis aguda") || textLower.includes("edematoso")) {
            detectedState = "pancreatitis_aguda";
            desc = "Signos de pancreatitis aguda.";
          } else if (textLower.includes("pancreatitis cronica") || textLower.includes("calcificaciones pancreatica")) {
            detectedState = "pancreatitis_cronica";
            desc = "Pancreatitis crónica con calcificaciones.";
          } else if (textLower.includes("atrofia") || textLower.includes("atrofico")) {
            detectedState = "atrofia";
            desc = "Atrofia pancreática parenquimatosa.";
          } else if (textLower.includes("quiste") || textLower.includes("pseudoquiste")) {
            detectedState = "lesion_quistica";
            desc = "Lesión quística o pseudoquiste.";
          } else if (textLower.includes("gas") || textLower.includes("meteorismo") || textLower.includes("no visible") || textLower.includes("no se observa por gas")) {
            detectedState = "no_visible_gas";
            desc = "No visible por interposición de gas intestinal.";
          }
        } else if (id === "bazo") {
          if (textLower.includes("esplenomegalia") || textLower.includes("bazo aumentado")) {
            detectedState = "esplenomegalia";
            desc = "Esplenomegalia descrita.";
          } else if (textLower.includes("nodulo") || textLower.includes("focal")) {
            detectedState = "nodulo_esplenico";
            desc = "Nódulo esplénico aislado.";
          }
        } else if (id === "rinon_derecho" || id === "rinon_izquierdo") {
          const block = id === "rinon_derecho" ? "derech" : "izquierd";
          const isRight = id === "rinon_derecho";
          
          if (textLower.includes("litiasis") || textLower.includes("calculo") || textLower.includes("concreccion")) {
            detectedState = "litiasis";
            desc = `Litiasis renal ${isRight ? "derecha" : "izquierda"}.`;
          } else if (textLower.includes("quiste simple") || textLower.includes("quiste cortical")) {
            detectedState = "quiste_simple";
            desc = `Quiste simple cortical renal ${isRight ? "derecho" : "izquierdo"}.`;
          } else if (textLower.includes("ectasia") || textLower.includes("hidronefrosis") || textLower.includes("pielocalicial")) {
            detectedState = "hidronefrosis";
            desc = `Ectasia / Hidronefrosis renal ${isRight ? "derecha" : "izquierda"}.`;
          } else if (textLower.includes("quiste complejo") || textLower.includes("bosniak")) {
            detectedState = "quiste_complejo";
            desc = `Quiste renal complejo ${isRight ? "derecho" : "izquierdo"}.`;
          } else if (textLower.includes("masa") || textLower.includes("sólido") || textLower.includes("loe")) {
            detectedState = "masa_solida";
            desc = `Masa renal sospechosa en polo ${isRight ? "derecho" : "izquierdo"}.`;
          }
        } else if (id === "vejiga") {
          if (textLower.includes("pared") && (textLower.includes("engrosada") || textLower.includes("gruesa"))) {
            detectedState = "pared_engrosada";
            desc = "Vejiga con pared engrosada.";
          } else if (textLower.includes("sedimento") || textLower.includes("detritus") || textLower.includes("suspension")) {
            detectedState = "sedimento_urinario";
            desc = "Abundante sedimento urinario móvil.";
          } else if (textLower.includes("litiasis") || textLower.includes("calculo") || textLower.includes("sombras")) {
            detectedState = "litiasis";
            desc = "Litiasis vesical detectable.";
          } else if (textLower.includes("masa") || textLower.includes("vegetante") || textLower.includes("neoformacion")) {
            detectedState = "masa_vesical";
            desc = "Imagen de aspecto vegetante en pared vesical.";
          }
        } else if (id === "prostata") {
          if (textLower.includes("hiperplasia") || textLower.includes("hpb") || textLower.includes("adenoma") || textLower.includes("aumentada de tamano")) {
            detectedState = "hiperplasia_benigna";
            desc = "Hiperplasia benigna de próstata (HPB).";
          } else if (textLower.includes("quiste") || textLower.includes("anecoic")) {
            detectedState = "quiste";
            desc = "Quiste prostático simple.";
          } else if (textLower.includes("calcificacion") || textLower.includes("corpora amylacea")) {
            detectedState = "calcificaciones";
            desc = "Calcificaciones periuretrales de carácter residual.";
          }
        } else if (id === "utero") {
          if (textLower.includes("mioma") || textLower.includes("miomatosis") || textLower.includes("focal")) {
            detectedState = "miomatosis";
            desc = "Nódulos miomatosos intramurales.";
          } else if (textLower.includes("endometrio engrosado") || textLower.includes("hiperplasia endometrial")) {
            detectedState = "endometrio_engrosado";
            desc = "Engrosamiento de la línea endometrial.";
          } else if (textLower.includes("liquido libre") || textLower.includes("douglas")) {
            detectedState = "liquido_libre";
            desc = "Líquido libre en fondo de saco vaginal posterior.";
          }
        } else if (id === "ovarios") {
          if (textLower.includes("quiste simple") || textLower.includes("anecoic")) {
            detectedState = "quiste_simple";
            desc = "Quiste ovárico simple cortical.";
          } else if (textLower.includes("complejo") || textLower.includes("tabique") || textLower.includes("solido-quistic")) {
            detectedState = "quiste_complejo";
            desc = "Quiste ovárico de características complejas.";
          } else if (textLower.includes("poliquistic") || textLower.includes("sop") || textLower.includes("microfolicul")) {
            detectedState = "ovarios_poliquisticos";
            desc = "Ovarios de aspecto poliquístico.";
          }
        } else if (id === "psoas") {
          if (textLower.includes("hematoma") || textLower.includes("sangre")) {
            detectedState = "hematoma";
            desc = "Colección compatible con hematoma de psoas.";
          } else if (textLower.includes("absceso") || textLower.includes("coleccion liquida")) {
            detectedState = "absceso";
            desc = "Colección del psoas sugestiva de absceso.";
          } else if (textLower.includes("asimetria") || textLower.includes("atrofia")) {
            detectedState = "asimetria";
            desc = "Asimetría de vientres musculares del psoas.";
          }
        } else if (id === "colon") {
          if (textLower.includes("meteorismo") || textLower.includes("gas abundante") || textLower.includes("distendido")) {
            detectedState = "meteorismo_abundante";
            desc = "Interposición gas colónica importante.";
          } else if (textLower.includes("diverticulo") || textLower.includes("diverticular")) {
            detectedState = "diverticulosis";
            desc = "Diverticulosis incidental cólica.";
          } else if (textLower.includes("pared engrosada") || textLower.includes("colitis")) {
            detectedState = "pared_engrosada";
            desc = "Engrosamiento de pared del marco cólico.";
          } else if (textLower.includes("fecaloma") || textLower.includes("materia fecal")) {
            detectedState = "fecaloma";
            desc = "Fecaloma / Retención fecal colónica.";
          }
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = desc;
      logs.push(`[Local-Heurística] ${id} clasificado como ${detectedState.toUpperCase()}.`);
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
    logs.push(`🔍 Extractores Inteligentes analizando diagnóstico de Abdomen de alta fidelidad (${generatedReport.length} caracteres)...`);

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Abdomen",
          structures: ABDOMEN_STRUCTURES.map(s => ({
            id: s.id,
            label: s.name,
            allowedStates: s.allowedStates
          }))
        })
      });

      const data = await response.json();
      if (data.success && data.states && data.descriptions) {
        let parsedCount = 0;
        let foundPathologies = 0;
        
        const finalStates = { ...states };
        const finalDescriptions = { ...customDescriptions };

        ABDOMEN_STRUCTURES.forEach(struc => {
          if (data.states[struc.id]) {
            let parsedState = data.states[struc.id];
            let rawDesc = data.descriptions[struc.id];

            let finalDesc = rawDesc || "Dentro de límites normales.";
            if (parsedState === "normal") {
              finalDesc = "Dentro de límites normales.";
            } else if (parsedState === "no_descrito") {
              finalDesc = "No mencionado / No descrito.";
            }

            finalStates[struc.id] = parsedState;
            finalDescriptions[struc.id] = finalDesc;
            parsedCount++;

            if (parsedState !== "normal" && parsedState !== "no_descrito") {
              foundPathologies++;
            }
            logs.push(`[Inteligente] ${struc.name}: ${parsedState.toUpperCase()} - "${finalDesc}"`);
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setSyncLogs(prev => [...prev, ...logs, `✔ Sincronización realizada correctamente. Evaluados ${parsedCount} órganos, ${foundPathologies} hallazgos patológicos.`]);
        setLastSyncedReport(generatedReport);
      } else {
        logs.push("La API no devolvió un formato válido. Aplicando heurísticas de respaldo...");
        runLocalHeuristics(logs);
        setSyncLogs(prev => [...prev, ...logs]);
      }
    } catch (error) {
      console.error("Error en extracción inteligente:", error);
      logs.push("Error de red con la API de IA. Ejecutando análisis heurístico local...");
      runLocalHeuristics(logs);
      setSyncLogs(prev => [...prev, ...logs]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => {
      const up = { ...prev, [id]: s };
      return up;
    });
    
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No mencionado / No descrito." }));
    } else if (s === "normal") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "Dentro de límites normales." }));
    } else {
      setCustomDescriptions(prev => ({ ...prev, [id]: getSimplifiedDescription(id, s) }));
    }
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  // Auto scan on load of new report
  useEffect(() => {
    if (generatedReport && generatedReport !== lastSyncedReport && lastSyncedReport === "") {
      handleScanReportText(false);
    }
  }, [generatedReport, lastSyncedReport]);

  const exportTableData = () => {
    let md = `\n| Estructura analizada | Hallazgos ecográficos / Sinopsis del reporte |\n`;
    md += `| :--- | :--- |\n`;

    let hasRows = false;
    ABDOMEN_STRUCTURES.forEach(item => {
      if (states[item.id] !== "no_descrito") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.name}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos descritos* | *Consulte el texto completo del reporte* |\n`;
    }

    onExportTable(md);
  };

  const exportNarrativeNarratolog = () => {
    if (!onExportNarrative) return;
    
    const pathologicalItems: string[] = [];
    const normalItems: string[] = [];

    ABDOMEN_STRUCTURES.forEach(item => {
      const s = states[item.id];
      const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);

      if (s !== "no_descrito") {
        if (s === "normal") {
          normalItems.push(item.name);
        } else {
          pathologicalItems.push(`**${item.name}**: ${desc}`);
        }
      }
    });

    let txt = "El análisis esquemático tridimensional del abdomen revela lo siguiente:\n\n";
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

    onExportNarrative(txt);
  };

  useEffect(() => {
    exportTableData();
    exportNarrativeNarratolog();
  }, [states, customDescriptions]);

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
    // Minor issues: esteatosis_leve, barro_biliar, polipo, quiste, etc.
    if (
      s === "esteatosis_leve" || 
      s === "barro_biliar" || 
      s === "polipo" || 
      s === "quiste_simple" || 
      s === "quiste" || 
      s === "no_visible_gas" ||
      s === "pared_engrosada" ||
      s === "sedimento_urinario" ||
      s === "calcificaciones" ||
      s === "endometrio_engrosado" ||
      s === "liquido_libre" ||
      s === "ovarios_poliquisticos" ||
      s === "asimetria" ||
      s === "meteorismo_abundante"
    ) {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
        stroke: "#f59e0b"
      };
    }
    // Severe / complex issues
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
      stroke: "#f43f5e"
    };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let notInReport = 0;

    ABDOMEN_STRUCTURES.forEach(struc => {
      const st = states[struc.id];
      if (st === "no_descrito") notInReport++;
      else if (st === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normalCount, notInReport };
  };

  const getStructureOptions = (id: string) => {
    switch (id) {
      case "higado":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "esteatosis_leve", label: "Esteatosis Hepática Leve" },
          { val: "esteatosis_moderada", label: "Esteatosis Hepática Moderada" },
          { val: "esteatosis_severa", label: "Esteatosis Hepática Severa" },
          { val: "hepatomegalia", label: "Hepatomegalia" },
          { val: "cirrosis", label: "Cirrosis / Aspecto crónico" },
          { val: "lesion_ocupante_espacio", label: "Masa / Lesión ocupante de espacio" },
          { val: "quiste", label: "Quiste simple" }
        ];
      case "vesicula":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "litiasis", label: "Litiasis vesicular (Cálculos)" },
          { val: "barro_biliar", label: "Barro biliar / Microlitiasis" },
          { val: "colecistitis_aguda", label: "Colecistitis aguda (Signo de Murphy +)" },
          { val: "colecistitis_cronica", label: "Colecistitis crónica" },
          { val: "polipo", label: "Pólipo parietal" },
          { val: "pared_engrosada", label: "Pared engrosada" }
        ];
      case "pancreas":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "pancreatitis_aguda", label: "Pancreatitis aguda" },
          { val: "pancreatitis_cronica", label: "Pancreatitis crónica" },
          { val: "atrofia", label: "Atrofia con infiltración grasa" },
          { val: "lesion_quistica", label: "Lesión quística" },
          { val: "no_visible_gas", label: "No visible por gas de colon / duodeno" }
        ];
      case "bazo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "esplenomegalia", label: "Esplenomegalia" },
          { val: "nodulo_esplenico", label: "Nódulo esplénico" }
        ];
      case "rinon_derecho":
      case "rinon_izquierdo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "litiasis", label: "Litiasis renal" },
          { val: "quiste_simple", label: "Quiste cortical simple" },
          { val: "hidronefrosis", label: "Ectasia pielocalicial / Hidronefrosis" },
          { val: "quiste_complejo", label: "Quiste complejo cortical" },
          { val: "masa_solida", label: "Masa renal sólida" }
        ];
      case "vejiga":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "pared_engrosada", label: "Paredes engrosadas (Cistitis)" },
          { val: "sedimento_urinario", label: "Sedimento abundante en suspensión" },
          { val: "litiasis", label: "Litiasis vesical intravesical" },
          { val: "masa_vesical", label: "Lesión de aspecto vegetante (Masa)" }
        ];
      case "prostata":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hiperplasia_benigna", label: "Hiperplasia prostática benigna (HPB)" },
          { val: "quiste", label: "Quiste prostático" },
          { val: "calcificaciones", label: "Calcificaciones benignas parenquimatosas" }
        ];
      case "utero":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "miomatosis", label: "Miomatosis uterina" },
          { val: "endometrio_engrosado", label: "Línea endometrial engrosada / Hiperplasia" },
          { val: "liquido_libre", label: "Líquido libre en saco de Douglas" }
        ];
      case "ovarios":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "quiste_simple", label: "Quiste ovárico simple" },
          { val: "quiste_complejo", label: "Quiste ovárico complejo" },
          { val: "ovarios_poliquisticos", label: "Ovarios poliquísticos" }
        ];
      case "psoas":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hematoma", label: "Hematoma muscular psoas" },
          { val: "absceso", label: "Absceso retroperitoneal" },
          { val: "asimetria", label: "Asimetría anatómica de psoas" }
        ];
      case "colon":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "meteorismo_abundante", label: "Abundante interposición de gas" },
          { val: "diverticulosis", label: "Diverticulosis colónica incidental" },
          { val: "pared_engrosada", label: "Engrosamiento de paredes (Colitis)" },
          { val: "fecaloma", label: "Fecaloma / Retención fecal" }
        ];
      default:
        return [];
    }
  };

  const badges = getBadgesCount();

  const textLowerForGender = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mentionsProstate = textLowerForGender.includes("prostata") || textLowerForGender.includes("prostatic") || states.prostata !== "no_descrito";
  const mentionsFemale = textLowerForGender.includes("utero") || textLowerForGender.includes("ovari") || states.utero !== "no_descrito" || states.ovarios !== "no_descrito";

  // Filter visible structures for selector pills based on gender hints
  const visibleStructures = ABDOMEN_STRUCTURES.filter(s => {
    if (s.id === "prostata" && mentionsFemale) return false;
    if ((s.id === "utero" || s.id === "ovarios") && mentionsProstate) return false;
    return true;
  });

  const getActiveStructureLabel = () => {
    return ABDOMEN_STRUCTURES.find(s => s.id === selectedStructure)?.name || "";
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border-2 border-slate-800/80 p-5 shadow-2xl flex flex-col gap-5">
      
      {/* PANEL HEADER WITH TOGGLES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              US de Abdomen
              <span className="text-[10px] lowercase font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-850">
                interactivo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Sincronización sinóptica de órganos sólidos abdominales
            </p>
          </div>
        </div>

        {/* CONTROLS (GENDER & REFRESH) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              syncAvailable 
                ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-555 hover:to-teal-655 border-emerald-500 text-emerald-50 shadow-[0_2px_8px_rgba(16,185,129,0.2)] active:scale-97" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-300" />
                <span>Extrayendo...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-emerald-300" />
                <span>Extrayendo de Reporte</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* THREE VALUE STATE BADGES */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 border border-slate-850/50 rounded-xl">
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-rose-950/30 bg-rose-950/10">
          <span className="text-xs font-black text-rose-500">{badges.pathological}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Patológicos</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-emerald-950/20 bg-emerald-950/10">
          <span className="text-xs font-black text-emerald-400">{badges.normalCount}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Normallím.</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-slate-850 bg-slate-900/40">
          <span className="text-xs font-black text-slate-400">{badges.notInReport}</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">No Descrito</span>
        </div>
      </div>

      {/* CENTRAL AREA: SIDE-BY-SIDE GRAPHICS & DIAGRAM / EDITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-5 items-start">
        
        {/* LEFT COLUMN: DIAGRAMS (100% VECTOR INTERACTIVE MODEL) */}
        <div className="lg:col-span-4 flex flex-col items-center gap-4 bg-slate-950/30 p-3.5 border border-slate-850/50 rounded-xl max-w-full">
          
          <div className="w-full text-center border-b border-slate-850 pb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#6366F1]">
              Esquema Anatómico Abdominal
            </span>
          </div>

          {/* SVG RENDERING CONTAINER */}
          <div className="w-full flex items-center justify-center min-h-[220px] bg-slate-950/20 p-2.5 rounded-xl relative overflow-hidden">
            <svg 
              id="abdomen-anatomy-svg"
              viewBox="0 0 240 240" 
              className="w-full max-w-[210px] h-auto drop-shadow-2xl"
              style={{ maxHeight: "210px" }}
            >
              {/* Spine Backbone illustration (anatomy context) */}
              <rect x="114" y="20" width="12" height="200" fill="#1e293b" rx="2" opacity="0.15" />
              {/* Aorta and Vena Cava illustration in background */}
              <line x1="108" y1="20" x2="108" y2="220" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
              <line x1="124" y1="20" x2="124" y2="220" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.15" />

              {/* 1. HÍGADO (Liver - Large wedge-shaped organ on anatomical right/screen left) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("higado")}
                onMouseEnter={() => setActiveHover("higado")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 112,65 C 108,50 63,55 45,63 C 30,70 33,98 50,110 C 65,120 100,105 118,92 C 122,88 116,80 112,65 Z"
                  fill={getColorForSVG("higado").fill}
                  stroke={getColorForSVG("higado").stroke}
                  strokeWidth={(states.higado !== "normal" && states.higado !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.higado !== "normal" && states.higado !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="75" y="86" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle" pointerEvents="none">HÍGADO</text>
              </g>

              {/* 2. VESÍCULA BILIAR (Gallbladder - small green pear below liver) */}
              <g 
                className="cursor-pointer transition-all duration-200 animate-pulse-slow"
                onClick={() => setSelectedStructure("vesicula")}
                onMouseEnter={() => setActiveHover("vesicula")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 88,103 C 85,103 82,108 82,112 C 82,120 90,128 95,128 C 98,128 98,120 95,114 C 92,108 90,103 88,103 Z"
                  fill={getColorForSVG("vesicula").fill}
                  stroke={getColorForSVG("vesicula").stroke}
                  strokeWidth={(states.vesicula !== "normal" && states.vesicula !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.vesicula !== "normal" && states.vesicula !== "no_descrito") ? "0.95" : "0.5"}
                />
                <text x="78" y="132" fill="#cbd5e1" fontSize="5.5" fontWeight="black" pointerEvents="none" textAnchor="end">V. Biliar</text>
              </g>

              {/* 3. BAZO (Spleen - purple oval on anatomical left/screen right) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("bazo")}
                onMouseEnter={() => setActiveHover("bazo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 165,70 C 182,72 195,85 195,95 C 195,108 178,118 162,110 C 158,105 158,80 165,70 Z"
                  fill={getColorForSVG("bazo").fill}
                  stroke={getColorForSVG("bazo").stroke}
                  strokeWidth={(states.bazo !== "normal" && states.bazo !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.bazo !== "normal" && states.bazo !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="176" y="93" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle" pointerEvents="none">BAZO</text>
              </g>

              {/* 4. PÁNCREAS (Pancreas - central golden structure crossing midline) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("pancreas")}
                onMouseEnter={() => setActiveHover("pancreas")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 98,118 C 110,116 142,105 155,116 C 160,121 148,131 138,128 C 122,126 112,130 100,128 C 94,127 94,119 98,118 Z"
                  fill={getColorForSVG("pancreas").fill}
                  stroke={getColorForSVG("pancreas").stroke}
                  strokeWidth={(states.pancreas !== "normal" && states.pancreas !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.pancreas !== "normal" && states.pancreas !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="126" y="123" fill="#cbd5e1" fontSize="6" fontWeight="bold" textAnchor="middle" pointerEvents="none">PÁNCREAS</text>
              </g>

              {/* 5. RIÑÓN DERECHO (Right Kidney - bean behind liver, anatomical right/screen left) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("rinon_derecho")}
                onMouseEnter={() => setActiveHover("rinon_derecho")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 72,134 C 55,134 45,148 45,162 C 45,176 55,190 72,190 C 76,183 73,172 73,162 C 73,152 76,141 72,134 Z"
                  fill={getColorForSVG("rinon_derecho").fill}
                  stroke={getColorForSVG("rinon_derecho").stroke}
                  strokeWidth={(states.rinon_derecho !== "normal" && states.rinon_derecho !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.rinon_derecho !== "normal" && states.rinon_derecho !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="59" y="165" fill="#cbd5e1" fontSize="6.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">RD</text>
                <text x="45" y="202" fill="#64748b" fontSize="6.0" fontWeight="bold" textAnchor="middle" opacity={selectedStructure === "rinon_derecho" || activeHover === "rinon_derecho" ? 1 : 0.4}>RIÑÓN D.</text>
              </g>

              {/* 6. RIÑÓN IZQUIERDO (Left Kidney - bean behind spleen, anatomical left/screen right) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("rinon_izquierdo")}
                onMouseEnter={() => setActiveHover("rinon_izquierdo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 168,134 C 185,134 195,148 195,162 C 195,176 185,190 168,190 C 164,183 167,172 167,162 C 167,152 164,141 168,134 Z"
                  fill={getColorForSVG("rinon_izquierdo").fill}
                  stroke={getColorForSVG("rinon_izquierdo").stroke}
                  strokeWidth={(states.rinon_izquierdo !== "normal" && states.rinon_izquierdo !== "no_descrito") ? "2.5" : "1.2"}
                  fillOpacity={(states.rinon_izquierdo !== "normal" && states.rinon_izquierdo !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="181" y="165" fill="#cbd5e1" fontSize="6.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">RI</text>
                <text x="195" y="202" fill="#64748b" fontSize="6.0" fontWeight="bold" textAnchor="middle" opacity={selectedStructure === "rinon_izquierdo" || activeHover === "rinon_izquierdo" ? 1 : 0.4}>RIÑÓN I.</text>
              </g>

              {/* 7. PSOAS MUSCLE */}
              {states.psoas !== "no_descrito" && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("psoas")}
                  onMouseEnter={() => setActiveHover("psoas")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Right muscle band */}
                  <path 
                    d="M 102,135 L 94,205 A 7,10 0 0 0 106,205 L 110,135 Z"
                    fill={getColorForSVG("psoas").fill}
                    stroke={getColorForSVG("psoas").stroke}
                    strokeWidth={(states.psoas !== "normal" && states.psoas !== "no_descrito") ? "2.5" : "1.2"}
                    fillOpacity={(states.psoas !== "normal" && states.psoas !== "no_descrito") ? "0.9" : "0.5"}
                  />
                  {/* Left muscle band */}
                  <path 
                    d="M 138,135 L 146,205 A 7,10 0 0 1 134,205 L 130,135 Z"
                    fill={getColorForSVG("psoas").fill}
                    stroke={getColorForSVG("psoas").stroke}
                    strokeWidth={(states.psoas !== "normal" && states.psoas !== "no_descrito") ? "2.5" : "1.2"}
                    fillOpacity={(states.psoas !== "normal" && states.psoas !== "no_descrito") ? "0.9" : "0.5"}
                  />
                  <text x="120" y="152" fill="#cbd5e1" fontSize="5.5" fontWeight="black" pointerEvents="none" textAnchor="middle">PSOAS</text>
                </g>
              )}

              {/* 8. COLON */}
              {states.colon !== "no_descrito" && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("colon")}
                  onMouseEnter={() => setActiveHover("colon")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 32,205 Q 38,195 34,185 Q 40,175 35,160 Q 42,145 35,130 Q 40,118 36,108 Q 50,105 70,106 Q 90,107 110,109 Q 130,107 150,106 Q 170,105 186,108 Q 200,118 196,130 Q 205,145 198,160 Q 205,175 198,185 Q 204,195 198,205"
                    fill="none"
                    stroke={getColorForSVG("colon").stroke}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.38"
                  />
                  <path 
                    d="M 32,205 Q 38,195 34,185 Q 40,175 35,160 Q 42,145 35,130 Q 40,118 36,108 Q 50,105 70,106 Q 90,107 110,109 Q 130,107 150,106 Q 170,105 186,108 Q 200,118 196,130 Q 205,145 198,160 Q 205,175 198,185 Q 204,195 198,205"
                    fill="none"
                    stroke={getColorForSVG("colon").stroke === "#475569" ? "#4f46e5" : getColorForSVG("colon").stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <text x="120" y="103" fill="#cbd5e1" fontSize="6.0" fontWeight="bold" textAnchor="middle" pointerEvents="none">COLON / M. CÓLICO</text>
                </g>
              )}

              {/* 9. VEJIGA */}
              {states.vejiga !== "no_descrito" && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("vejiga")}
                  onMouseEnter={() => setActiveHover("vejiga")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 102,192 C 102,178 138,178 138,192 C 138,208 102,208 102,192 Z"
                    fill={getColorForSVG("vejiga").fill}
                    stroke={getColorForSVG("vejiga").stroke}
                    strokeWidth={(states.vejiga !== "normal" && states.vejiga !== "no_descrito") ? "2.5" : "1.2"}
                    fillOpacity={(states.vejiga !== "normal" && states.vejiga !== "no_descrito") ? "0.9" : "0.5"}
                  />
                  <text x="120" y="196" fill="#ffffff" fontSize="6" fontWeight="bold" textAnchor="middle" pointerEvents="none">VEJIGA</text>
                </g>
              )}

              {/* 10. PRÓSTATA (Male pelvic organ) */}
              {states.prostata !== "no_descrito" && mentionsProstate && !mentionsFemale && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("prostata")}
                  onMouseEnter={() => setActiveHover("prostata")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 112,210 C 112,206 128,206 128,210 C 128,220 112,220 112,210 Z"
                    fill={getColorForSVG("prostata").fill}
                    stroke={getColorForSVG("prostata").stroke}
                    strokeWidth={(states.prostata !== "normal" && states.prostata !== "no_descrito") ? "2.5" : "1.2"}
                    fillOpacity={(states.prostata !== "normal" && states.prostata !== "no_descrito") ? "0.9" : "0.5"}
                  />
                  <text x="120" y="214" fill="#ffffff" fontSize="4.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">PRÓSTATA</text>
                </g>
              )}

              {/* 11. ÚTERO (Female pelvic organ) */}
              {states.utero !== "no_descrito" && mentionsFemale && !mentionsProstate && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("utero")}
                  onMouseEnter={() => setActiveHover("utero")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 112,175 C 112,160 128,160 128,175 C 128,188 112,188 112,175 Z"
                    fill={getColorForSVG("utero").fill}
                    stroke={getColorForSVG("utero").stroke}
                    strokeWidth={(states.utero !== "normal" && states.utero !== "no_descrito") ? "2.5" : "1.2"}
                    fillOpacity={(states.utero !== "normal" && states.utero !== "no_descrito") ? "0.9" : "0.5"}
                  />
                  <text x="120" y="177" fill="#ffffff" fontSize="5" fontWeight="bold" textAnchor="middle" pointerEvents="none">ÚTERO</text>
                </g>
              )}

              {/* 12. OVARIOS (Female pelvic organs) */}
              {states.ovarios !== "no_descrito" && mentionsFemale && !mentionsProstate && (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("ovarios")}
                  onMouseEnter={() => setActiveHover("ovarios")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Left Ovary */}
                  <path 
                    d="M 136,175 C 141,173 143,180 136,179 M 136,175 C 134,177 134,178 136,179 Z"
                    fill={getColorForSVG("ovarios").fill}
                    stroke={getColorForSVG("ovarios").stroke}
                    strokeWidth={(states.ovarios !== "normal" && states.ovarios !== "no_descrito") ? "1.5" : "0.8"}
                    fillOpacity="0.8"
                  />
                  {/* Right Ovary */}
                  <path 
                    d="M 104,175 C 99,173 97,180 104,179 M 104,175 C 106,177 106,178 104,179 Z"
                    fill={getColorForSVG("ovarios").fill}
                    stroke={getColorForSVG("ovarios").stroke}
                    strokeWidth={(states.ovarios !== "normal" && states.ovarios !== "no_descrito") ? "1.5" : "0.8"}
                    fillOpacity="0.8"
                  />
                  <text x="145" y="178" fill="#cbd5e1" fontSize="4.5" fontWeight="black" pointerEvents="none">OV</text>
                  <text x="95" y="178" fill="#cbd5e1" fontSize="4.5" fontWeight="black" pointerEvents="none" textAnchor="end">OV</text>
                </g>
              )}
            </svg>
          </div>

          <p className="text-[10px] text-slate-500 font-medium text-center max-w-[220px]">
            Haga clic sobre un órgano en el esquema o selecciónelo en el panel derecho para editar sus hallazgos e integrarlos al reporte.
          </p>
        </div>

        {/* RIGHT COLUMN: CONTROLS & FIELD EDITOR (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* STRUCTURE SELECTOR PILLS */}
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/40 rounded-xl border border-slate-850/60 max-h-[160px] overflow-y-auto">
            {visibleStructures.map(struc => {
              const currentSt = states[struc.id] || "no_descrito";
              let badgeColor = "border-slate-800 text-slate-400 bg-slate-900/10";
              
              if (currentSt === "normal") {
                badgeColor = "border-emerald-500/30 text-emerald-400 bg-emerald-950/10";
              } else if (currentSt !== "no_descrito") {
                badgeColor = "border-rose-500/30 text-rose-400 bg-rose-950/10 animate-pulse-slow";
              }

              return (
                <button
                  key={struc.id}
                  onClick={() => setSelectedStructure(struc.id)}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                    selectedStructure === struc.id 
                      ? "bg-[#6366F1] border-[#6366F1] text-white shadow-lg shadow-[#6366F1]/10 font-black scale-102"
                      : badgeColor
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    currentSt === "no_descrito" ? "bg-slate-500" :
                    currentSt === "normal" ? "bg-emerald-400" : "bg-rose-500"
                  }`} />
                  {struc.name}
                </button>
              );
            })}
          </div>

          {/* ACTIVE DISCIPLINARY EDITOR */}
          <div className="bg-slate-950 p-4 border border-slate-855/70 rounded-xl flex flex-col gap-3.5 relative overflow-hidden">
            {/* Soft decorative background indicator */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#6366F1]/3 rounded-full blur-2xl pointer-events-none" />

            {/* Title / Structure Identity */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                ✏️ Editar {getActiveStructureLabel()}
              </span>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase">
                {selectedStructure}
              </span>
            </div>

            {/* Diagnostic Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Diagnóstico ecográfico
              </label>
              <div className="relative">
                <select
                  value={states[selectedStructure] || "no_descrito"}
                  onChange={(e) => handleStateChange(selectedStructure, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                >
                  {getStructureOptions(selectedStructure).map((opt) => (
                    <option key={opt.val} value={opt.val}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Synopsis Field (Custom text override) */}
            {states[selectedStructure] !== "no_descrito" && (
              <div className="flex flex-col gap-1.5 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Sinopsis Clínica (en Tabla del Reporte)
                  </label>
                  <span className="text-[9px] font-semibold text-indigo-400 font-mono">
                    Editable
                  </span>
                </div>
                <textarea
                  value={customDescriptions[selectedStructure] || ""}
                  onChange={(e) => handleDescriptionChange(selectedStructure, e.target.value)}
                  placeholder="Por favor ingrese un resumen o hallazgo personalizado..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SYNC WARNING TIMELINE DISPLAY */}
      {syncLogs.length > 0 && (
        <div className="mt-2 bg-slate-950/85 border border-slate-850/60 p-3 rounded-xl max-h-[140px] overflow-y-auto">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-2">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span>Bitácora de Sincronización Inteligente (Abdomen)</span>
          </div>
          <div className="space-y-1.5 text-[10.5px] font-mono leading-relaxed text-slate-350">
            {syncLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap border-l-2 border-indigo-500/40 pl-2">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
