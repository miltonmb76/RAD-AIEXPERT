import React, { useState, useEffect } from "react";
import { 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Check, 
  Layers,
  Download,
  HelpCircle, 
  RotateCcw
} from "lucide-react";

interface WristAnatomyViewerProps {
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

export default function WristAnatomyViewer({
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
}: WristAnatomyViewerProps) {
  
  // Wrist structures state:
  // - "no_descrito": Omitted from table/diagrams
  // - "normal": Within normal limits
  // - Pathology values dependent on the structure
  const [states, setStates] = useState<Record<string, string>>({
    // Anterior Face
    nervio_mediano: "no_descrito",
    tendones_flexores: "no_descrito",
    flexor_carpi_radialis: "no_descrito",
    arteria_radial: "no_descrito",
    receso_radiocarpiano_anterior: "no_descrito",
    canal_de_guyon: "no_descrito",
    
    // Posterior Face
    receso_radiocarpiano_posterior: "no_descrito",
    articulacion_radiocubital_distal: "no_descrito",
    tendones_extensores_compartimentos: "no_descrito",
    fibrocartilago_triangular: "no_descrito",
    extensor_carpi_ulnaris: "no_descrito"
  });

  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({
    nervio_mediano: "",
    tendones_flexores: "",
    flexor_carpi_radialis: "",
    arteria_radial: "",
    receso_radiocarpiano_anterior: "",
    canal_de_guyon: "",
    receso_radiocarpiano_posterior: "",
    articulacion_radiocubital_distal: "",
    tendones_extensores_compartimentos: "",
    fibrocartilago_triangular: "",
    extensor_carpi_ulnaris: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("nervio_mediano");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

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
      case "nervio_mediano":
        return [
          "nervio mediano", "mediano", "tunel carpiano", "tunel del carpo", "compresion del mediano", "neuropatia del mediano"
        ];
      case "tendones_flexores":
        return [
          "tendones flexores", "flexores comunes", "flexor superficial", "flexor profundo", "flexor digitorum", "flexores"
        ];
      case "flexor_carpi_radialis":
        return [
          "flexor carpi radialis", "fcr", "palmar mayor", "flexor radial del carpo"
        ];
      case "arteria_radial":
        return [
          "arteria radial", "radial artery", "pulso radial"
        ];
      case "receso_radiocarpiano_anterior":
        return [
          "receso radiocarpiano anterior", "receso volar", "articulacion radiocarpiana anterior", "receso anterior"
        ];
      case "canal_de_guyon":
        return [
          "canal de guyon", "canal ulnar", "guyon", "nervio cubital", "arteria cubital"
        ];
      case "receso_radiocarpiano_posterior":
        return [
          "receso radiocarpiano posterior", "receso dorsal", "articulacion radiocarpiana posterior", "receso posterior dorsal"
        ];
      case "articulacion_radiocubital_distal":
        return [
          "articulacion radiocubital distal", "radiocubital distal", "arcd", "articulacion radio-cubital", "distal radioulnar joint"
        ];
      case "tendones_extensores_compartimentos":
        return [
          "tendones extensores", "compartimento extensor", "compartimentos extensores", "extensor digitorum", "abductor pollicis", "extensor pollicis", "de quervain"
        ];
      case "fibrocartilago_triangular":
        return [
          "fibrocartilago triangular", "fct", "complejo fibrocartilago triangular", "cfct", "triangular cartilage", "ligamento triangular"
        ];
      case "extensor_carpi_ulnaris":
        return [
          "extensor carpi ulnaris", "ecu", "extensor cubital del carpo", "cubital posterior", "sexto compartimento"
        ];
      default:
        return [];
    }
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (!s || s === "no_descrito") {
      return "No descrito.";
    }
    if (s === "normal") {
      return "Dentro de límites normales.";
    }
    const standardStates = [
      "normal", "no_descrito", "edematizado", "comprimido", "tenosinovitis", "desgarro", "tendinosis",
      "tendinopatía", "aneurisma", "trombosis", "calcificación", "derrame", "sinovitis", "quiste_espinoso",
      "compresion_nerviosa", "quiste_sinovial", "subluxacion", "artrosis", "de_quervain", "tendinitis_intersticial",
      "perforacion", "degenerativo"
    ];
    if (!standardStates.includes(s)) {
      return `Se describe hallazgo: ${s.charAt(0).toUpperCase() + s.slice(1)}.`;
    }

    switch (id) {
      case "nervio_mediano":
        if (s === "edematizado") return "Nervio mediano engrosado y edematoso compatible con síndrome del túnel carpiano.";
        if (s === "comprimido") return "Compresión del nervio mediano a nivel del retináculo flexor.";
        if (s === "tenosinovitis") return "Signos de tenosinovitis circundante al nervio mediano.";
        break;
      case "tendones_flexores":
        if (s === "tenosinovitis") return "Tenosinovitis de los tendones flexores con aumento de líquido en su vaina.";
        if (s === "desgarro") return "Pérdida localizada de la ecogenicidad compatible con desgarro fibrilar.";
        if (s === "tendinosis") return "Engrosamiento y alteración de la ecoestructura fibrilar por tendinosis.";
        break;
      case "flexor_carpi_radialis":
        if (s === "tendinopatía") return "Tendinopatía distal del flexor carpi radialis sin rotura.";
        if (s === "tenosinovitis") return "Tenosinovitis con líquido libre peritendinoso en el trayecto.";
        if (s === "desgarro") return "Rotura parcial o desgarro intrínseco del tendón.";
        break;
      case "arteria_radial":
        if (s === "aneurisma") return "Dilatación aneurismática focal de la arteria radial.";
        if (s === "trombosis") return "Ausencia de flujo Doppler por trombosis de la arteria radial Extrema.";
        if (s === "calcificación") return "Ateromatosis o calcificación parietal fina.";
        break;
      case "receso_radiocarpiano_anterior":
        if (s === "derrame") return "Derrame articular moderado en el receso radiocarpiano anterior volar.";
        if (s === "sinovitis") return "Hipertrofia sinovial con aumento difuso de la vascularización anterior.";
        if (s === "quiste_espinoso") return "Pequeño quiste sinovial emanando de la cápsula volar.";
        break;
      case "canal_de_guyon":
        if (s === "compresion_nerviosa") return "Compresión del nervio cubital (ulnar) en el canal de Guyón.";
        if (s === "derrame") return "Derrame o distensión sinovial en el compartimento ulnar anterior.";
        if (s === "quiste_sinovial") return "Quiste sinovial / ganglionar lobulado en el canal de Guyón.";
        break;
      case "receso_radiocarpiano_posterior":
        if (s === "derrame") return "Derrame articular libre en el receso dorsal radiocarpiano.";
        if (s === "sinovitis") return "Cambios sinovíticos con engrosamiento de la cápsula posterior.";
        if (s === "quiste_sinovial") return "Ganglión o quiste sinovial dorsal originado de la articulación carpo-radial.";
        break;
      case "articulacion_radiocubital_distal":
        if (s === "derrame") return "Derrame intraarticular en la articulación radiocubital distal.";
        if (s === "subluxacion") return "Subluxación o inestabilidad dorsal de la cabeza cubital distal.";
        if (s === "artrosis") return "Estrechamiento del espacio e irregularidad por artrosis radiocubital distal.";
        break;
      case "tendones_extensores_compartimentos":
        if (s === "de_quervain") return "Tenosinovitis de De Quervain (I compartimento extensor) con engrosamiento y líquido.";
        if (s === "sinovitis") return "Tenosinovitis de tendones extensores en trayecto dorsal.";
        if (s === "desgarro") return "Desgarro o rotura proximal/distal de fascículo extensor.";
        if (s === "tendinitis_intersticial") return "Tendinitis/tendinopatía con alteración fibrilar en extensores.";
        break;
      case "fibrocartilago_triangular":
        if (s === "desgarro") return "Desgarro o rotura focal del fibrocartílago triangular (fóvea o radial).";
        if (s === "degenerativo") return "Cambios degenerativos / adelgazamiento del complejo fibrocartilaginoso.";
        if (s === "perforacion") return "Perforación demostrada radiológicamente con paso de líquido.";
        break;
      case "extensor_carpi_ulnaris":
        if (s === "tenosinovitis") return "Tenosinovitis marcada del ECU (VI compartimento) con distensión de su vaina.";
        if (s === "subluxacion") return "Subluxación o inestabilidad del tendón ECU fuera de la corredera distal cubital.";
        if (s === "desgarro") return "Desgarro parcial intrasustancia o tendinosis severa del ECU.";
        break;
    }
    return "Alteración descrita.";
  };

  const runLocalHeuristics = (logs: string[]) => {
    logs.push("Ejecutando análisis local con heurísticas de coincidencia para Muñeca...");
    const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const nextStates = { ...states };
    const nextDescriptions = { ...customDescriptions };
    const keys = Object.keys(states);

    keys.forEach(id => {
      const keywords = getStructureKeywords(id);
      const isMentioned = keywords.some(kw => textLower.includes(kw));

      if (!isMentioned) {
        nextStates[id] = "no_descrito";
        nextDescriptions[id] = "No descrito.";
        return;
      }

      // Check if normal
      const isNormal = [
        "normal", "conservado", "conservada", "homogeneo", "homogenea", "sin alteraciones",
        "morfologia habitual", "aspecto habitual", "sin evidencia de colecciones", "sin colecciones",
        "integro", "integra", "sin liquído libre", "libre de lesiones", "dentro de limites normales",
        "limites normales", "no se observan desgarros", "sin desgarros", "sin masas", "sin quistes",
        "sin derrames", "sin sinovitis"
      ].some(p => {
        return keywords.some(kw => {
          const idx = textLower.indexOf(kw);
          if (idx === -1) return false;
          const context = textLower.substring(Math.max(0, idx - 45), Math.min(textLower.length, idx + 80));
          return context.includes(p);
        });
      });

      if (isNormal) {
        nextStates[id] = "normal";
        nextDescriptions[id] = "Dentro de límites normales.";
        logs.push(`[Local] ${id} clasificado como NORMAL.`);
        return;
      }

      // Match pathological patterns
      let detectedState = "normal";
      let desc = "Dentro de límites normales.";

      if (id === "nervio_mediano") {
        if (textLower.includes("comprimido") || textLower.includes("compresion") || textLower.includes("retinaculo")) {
          detectedState = "comprimido";
          desc = "Compresión del nervio mediano a nivel del retináculo flexor.";
        } else if (textLower.includes("tenosinovitis") || textLower.includes("liquido peritendinoso")) {
          detectedState = "tenosinovitis";
          desc = "Signos de tenosinovitis circundante al nervio mediano.";
        } else {
          detectedState = "edematizado";
          desc = "Nervio mediano engrosado y edematoso compatible con síndrome del túnel carpiano.";
        }
      } else if (id === "tendones_flexores") {
        if (textLower.includes("desgarro") || textLower.includes("ruptura") || textLower.includes("rotura")) {
          detectedState = "desgarro";
          desc = "Pérdida localizada de la ecogenicidad compatible con desgarro fibrilar.";
        } else if (textLower.includes("tendinosis") || textLower.includes("ecoestructura")) {
          detectedState = "tendinosis";
          desc = "Engrosamiento y alteración de la ecoestructura fibrilar por tendinosis.";
        } else {
          detectedState = "tenosinovitis";
          desc = "Tenosinovitis de los tendones flexores con aumento de líquido en su vaina.";
        }
      } else if (id === "flexor_carpi_radialis") {
        if (textLower.includes("tenosinovitis")) {
          detectedState = "tenosinovitis";
          desc = "Tenosinovitis con líquido libre peritendinoso en el trayecto.";
        } else if (textLower.includes("desgarro") || textLower.includes("ruptura")) {
          detectedState = "desgarro";
          desc = "Rotura parcial o desgarro intrínseco del tendón.";
        } else {
          detectedState = "tendinopatía";
          desc = "Tendinopatía distal del flexor carpi radialis sin rotura.";
        }
      } else if (id === "arteria_radial") {
        if (textLower.includes("aneurisma")) {
          detectedState = "aneurisma";
          desc = "Dilatación aneurismática focal de la arteria radial.";
        } else if (textLower.includes("trombosis") || textLower.includes("oclusion") || textLower.includes("trombosado")) {
          detectedState = "trombosis";
          desc = "Ausencia de flujo Doppler por trombosis de la arteria radial Extrema.";
        } else {
          detectedState = "calcificación";
          desc = "Ateromatosis o calcificación parietal fina.";
        }
      } else if (id === "receso_radiocarpiano_anterior") {
        if (textLower.includes("sinovitis") || textLower.includes("hipertrofia")) {
          detectedState = "sinovitis";
          desc = "Hipertrofia sinovial con aumento difuso de la vascularización anterior.";
        } else if (textLower.includes("quiste") || textLower.includes("espinoso") || textLower.includes("ganglion")) {
          detectedState = "quiste_espinoso";
          desc = "Pequeño quiste sinovial emanando de la cápsula volar.";
        } else {
          detectedState = "derrame";
          desc = "Derrame articular moderado en el receso radiocarpiano anterior volar.";
        }
      } else if (id === "canal_de_guyon") {
        if (textLower.includes("compresion") || textLower.includes("atrapamiento")) {
          detectedState = "compresion_nerviosa";
          desc = "Compresión del nervio cubital (ulnar) en el canal de Guyón.";
        } else if (textLower.includes("quiste") || textLower.includes("ganglion") || textLower.includes("sinovial")) {
          detectedState = "quiste_sinovial";
          desc = "Quiste sinovial / ganglionar lobulado en el canal de Guyón.";
        } else {
          detectedState = "derrame";
          desc = "Derrame o distensión sinovial en el compartimento ulnar anterior.";
        }
      } else if (id === "receso_radiocarpiano_posterior") {
        if (textLower.includes("sinovitis") || textLower.includes("hipertrofia")) {
          detectedState = "sinovitis";
          desc = "Cambios sinovíticos con engrosamiento de la cápsula posterior.";
        } else if (textLower.includes("quiste") || textLower.includes("ganglion") || textLower.includes("dorsal")) {
          detectedState = "quiste_sinovial";
          desc = "Ganglión o quiste sinovial dorsal originado de la articulación carpo-radial.";
        } else {
          detectedState = "derrame";
          desc = "Derrame articular libre en el receso dorsal radiocarpiano.";
        }
      } else if (id === "articulacion_radiocubital_distal") {
        if (textLower.includes("subluxacion") || textLower.includes("inestabilidad")) {
          detectedState = "subluxacion";
          desc = "Subluxación o inestabilidad dorsal de la cabeza cubital distal.";
        } else if (textLower.includes("artrosis") || textLower.includes("degenerativo") || textLower.includes("osteofito")) {
          detectedState = "artrosis";
          desc = "Estrechamiento del espacio e irregularidad por artrosis radiocubital distal.";
        } else {
          detectedState = "derrame";
          desc = "Derrame intraarticular en la articulación radiocubital distal.";
        }
      } else if (id === "tendones_extensores_compartimentos") {
        if (textLower.includes("quervain") || textLower.includes("de quervain") || textLower.includes("primer compartimento")) {
          detectedState = "de_quervain";
          desc = "Tenosinovitis de De Quervain (I compartimento extensor) con engrosamiento y líquido.";
        } else if (textLower.includes("desgarro") || textLower.includes("rotura")) {
          detectedState = "desgarro";
          desc = "Desgarro o rotura proximal/distal de fascículo extensor.";
        } else if (textLower.includes("tendinitis") || textLower.includes("tendinopatia")) {
          detectedState = "tendinitis_intersticial";
          desc = "Tendinitis/tendinopatía con alteración fibrilar en extensores.";
        } else {
          detectedState = "sinovitis";
          desc = "Tenosinovitis de tendones extensores en trayecto dorsal.";
        }
      } else if (id === "fibrocartilago_triangular") {
        if (textLower.includes("desgarro") || textLower.includes("rotura") || textLower.includes("ruptura")) {
          detectedState = "desgarro";
          desc = "Desgarro o rotura focal del fibrocartílago triangular (fóvea o radial).";
        } else if (textLower.includes("perforacion") || textLower.includes("perforado")) {
          detectedState = "perforacion";
          desc = "Perforación demostrada con libre flujo del líquido.";
        } else {
          detectedState = "degenerativo";
          desc = "Cambios degenerativos / adelgazamiento del complejo fibrocartilaginoso.";
        }
      } else if (id === "extensor_carpi_ulnaris") {
        if (textLower.includes("subluxacion") || textLower.includes("inestabilidad") || textLower.includes("retinaculo extensor")) {
          detectedState = "subluxacion";
          desc = "Subluxación o inestabilidad del tendón ECU fuera de la corredera distal cubital.";
        } else if (textLower.includes("desgarro") || textLower.includes("rotura")) {
          detectedState = "desgarro";
          desc = "Desgarro parcial intrasustancia o tendinosis severa del ECU.";
        } else {
          detectedState = "tenosinovitis";
          desc = "Tenosinovitis marcada del ECU (VI compartimento) con distensión de su vaina.";
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = desc;
      logs.push(`[Local] ${id} clasificado como ${detectedState.toUpperCase()}.`);
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
    logs.push(`Iniciando extracción inteligente de hallazgos en Muñeca (${generatedReport.length} caracteres)...`);

    const structuresList = [
      {
        id: "nervio_mediano",
        label: "Nervio Mediano",
        allowedStates: ["no_descrito", "normal", "edematizado", "comprimido", "tenosinovitis"]
      },
      {
        id: "tendones_flexores",
        label: "Tendones Flexores",
        allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro", "tendinosis"]
      },
      {
        id: "flexor_carpi_radialis",
        label: "Flexor Carpi Radialis",
        allowedStates: ["no_descrito", "normal", "tendinopatía", "tenosinovitis", "desgarro"]
      },
      {
        id: "arteria_radial",
        label: "Arteria Radial",
        allowedStates: ["no_descrito", "normal", "aneurisma", "trombosis", "calcificación"]
      },
      {
        id: "receso_radiocarpiano_anterior",
        label: "Receso Volar Articular",
        allowedStates: ["no_descrito", "normal", "derrame", "sinovitis", "quiste_espinoso"]
      },
      {
        id: "canal_de_guyon",
        label: "Canal de Guyon",
        allowedStates: ["no_descrito", "normal", "compresion_nerviosa", "derrame", "quiste_sinovial"]
      },
      {
        id: "receso_radiocarpiano_posterior",
        label: "Receso Dorsal Articular",
        allowedStates: ["no_descrito", "normal", "derrame", "sinovitis", "quiste_sinovial"]
      },
      {
        id: "articulacion_radiocubital_distal",
        label: "Artic. Radiocubital Distal",
        allowedStates: ["no_descrito", "normal", "derrame", "subluxacion", "artrosis"]
      },
      {
        id: "tendones_extensores_compartimentos",
        label: "Tendones Extensores (Comps I-VI)",
        allowedStates: ["no_descrito", "normal", "de_quervain", "sinovitis", "desgarro", "tendinitis_intersticial"]
      },
      {
        id: "fibrocartilago_triangular",
        label: "Fibrocartílago Triangular",
        allowedStates: ["no_descrito", "normal", "desgarro", "degenerativo", "perforacion"]
      },
      {
        id: "extensor_carpi_ulnaris",
        label: "Extensor Carpi Ulnaris",
        allowedStates: ["no_descrito", "normal", "tenosinovitis", "subluxacion", "desgarro"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido de Muñeca (Volar y Dorsal)",
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
          if (data.states[struc.id]) {
            const parsedState = data.states[struc.id];
            const rawDesc = data.descriptions[struc.id];
            
            let finalDesc = rawDesc || "Dentro de límites normales.";
            if (parsedState === "normal") {
              finalDesc = "Dentro de límites normales.";
            } else if (parsedState === "no_descrito") {
              finalDesc = "No descrito.";
            }

            finalStates[struc.id] = parsedState;
            finalDescriptions[struc.id] = finalDesc;
            parsedCount++;

            if (parsedState !== "no_descrito" && parsedState !== "normal") {
              foundPathologies++;
            }
          }
        });

        setStates(finalStates);
        setCustomDescriptions(finalDescriptions);
        setLastSyncedReport(generatedReport);
        logs.push(`Análisis finalizado con éxito.`);
        logs.push(`Se extrajeron ${parsedCount} estructuras de la muñeca. Se detectaron ${foundPathologies} hallazgos patológicos.`);
      } else {
        logs.push("La IA no devolvió un formato válido. Se procederá con heurística local de respaldo.");
        runLocalHeuristics(logs);
        setLastSyncedReport(generatedReport);
      }
    } catch (err: any) {
      console.error("Error al sincronizar con la IA", err);
      logs.push(`Fallo en llamada a la API: ${err.message || err}. Usando heurísticas locales directas de inmediato.`);
      runLocalHeuristics(logs);
      setLastSyncedReport(generatedReport);
    } finally {
      setIsSyncing(false);
      setSyncLogs(logs);
    }
  };

  const handleStateChange = (id: string, s: string) => {
    setStates(prev => ({ ...prev, [id]: s }));
    if (s === "no_descrito") {
      setCustomDescriptions(prev => ({ ...prev, [id]: "No descrito." }));
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

  const exportTableData = () => {
    let md = `\n| Estructura | Hallazgos |\n`;
    md += `| :--- | :--- |\n`;

    const list = [
      // Anterior
      { id: "nervio_mediano", label: "Nervio Mediano" },
      { id: "tendones_flexores", label: "Tendones Flexores" },
      { id: "flexor_carpi_radialis", label: "Flexor Carpi Radialis" },
      { id: "arteria_radial", label: "Arteria Radial" },
      { id: "receso_radiocarpiano_anterior", label: "Receso Volar Articular" },
      { id: "canal_de_guyon", label: "Canal de Guyon" },
      // Posterior
      { id: "receso_radiocarpiano_posterior", label: "Receso Dorsal Articular" },
      { id: "articulacion_radiocubital_distal", label: "Artic. Radiocubital Distal" },
      { id: "tendones_extensores_compartimentos", label: "Tendones Extensores (Comps I-VI)" },
      { id: "fibrocartilago_triangular", label: "Fibrocartílago Triangular (CFCT)" },
      { id: "extensor_carpi_ulnaris", label: "Extensor Carpi Ulnaris (ECU)" }
    ];

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito" && states[item.id] !== "normal") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras de la muñeca se reportan de características normales.* |\n`;
    }

    onExportTable(md);
  };

  const exportNarrative = () => {
    if (!onExportNarrative) return;
    
    const keys = Object.keys(states);
    const pathologicalItems: string[] = [];
    const normalItems: string[] = [];

    const labelMapping: Record<string, string> = {
      nervio_mediano: "Nervio Mediano",
      tendones_flexores: "Tendones Flexores",
      flexor_carpi_radialis: "Flexor Carpi Radialis",
      arteria_radial: "Arteria Radial",
      receso_radiocarpiano_anterior: "Receso Volar Articular",
      canal_de_guyon: "Canal de Guyon",
      receso_radiocarpiano_posterior: "Receso Dorsal Articular",
      articulacion_radiocubital_distal: "Articulación Radiocubital Distal",
      tendones_extensores_compartimentos: "Tendones Extensores (Compartimentos I-VI)",
      fibrocartilago_triangular: "Fibrocartílago Triangular",
      extensor_carpi_ulnaris: "Extensor Carpi Ulnaris"
    };

    keys.forEach(id => {
      const s = states[id];
      const desc = customDescriptions[id]?.trim() || getSimplifiedDescription(id);
      const label = labelMapping[id] || id;

      if (s !== "no_descrito") {
        if (s === "normal") {
          normalItems.push(label);
        } else {
          pathologicalItems.push(`**${label}**: ${desc}`);
        }
      }
    });

    let txt = "El análisis ecográfico de muñeca revela lo siguiente:\n\n";
    if (pathologicalItems.length > 0) {
      txt += "### HALLAZGOS PATOLÓGICOS DETECTADOS (MUÑECA):\n";
      pathologicalItems.forEach(item => {
        txt += `* ${item}\n`;
      });
      txt += "\n";
    }

    if (normalItems.length > 0) {
      txt += `### ESTRUCTURAS SIN ALTERACIONES (DENTRO DE LÍMITES NORMALES):\n`;
      txt += `* Se describen íntegras y de características normales: ${normalItems.join(", ")}.\n`;
    } else {
      txt += `* No se identificaron estructuras completamente normales descritas.\n`;
    }

    onExportNarrative(txt);
  };

  useEffect(() => {
    // Only automatically sync narrative description, table is manual
    exportNarrative();
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
    // Moderate pathologies
    if (
      s === "edematizado" || 
      s === "tendinopatía" || 
      s === "quiste_espinoso" || 
      s === "quiste_sinovial" || 
      s === "derrame" || 
      s === "calcificación" || 
      s === "degenerativo"
    ) {
      return {
        fill: isHovered ? "rgba(245, 158, 11, 0.55)" : "rgba(245, 158, 11, 0.28)",
        stroke: "#f59e0b"
      };
    }
    // Severe pathologies
    return {
      fill: isHovered ? "rgba(244, 63, 94, 0.65)" : "rgba(244, 63, 94, 0.35)",
      stroke: "#f43f5e"
    };
  };

  const getBadgesCount = () => {
    let pathological = 0;
    let normalCount = 0;
    let notInReport = 0;

    Object.keys(states).forEach(key => {
      const st = states[key];
      if (st === "no_descrito") notInReport++;
      else if (st === "normal") normalCount++;
      else pathological++;
    });

    return { pathological, normalCount, notInReport };
  };

  const getStructureOptions = (id: string) => {
    switch (id) {
      case "nervio_mediano":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "edematizado", label: "Edematizado (Ecoestructura alterada)" },
          { val: "comprimido", label: "Comprimido a nivel del túnel" },
          { val: "tenosinovitis", label: "Tenosinovitis peritendinosa circundante" }
        ];
      case "tendones_flexores":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "tenosinovitis", label: "Tenosinovitis con líquido peritendinoso" },
          { val: "desgarro", label: "Desgarro / Rotura fibrilar focal" },
          { val: "tendinosis", label: "Tendinosis / Disminución de ecogenicidad" }
        ];
      case "flexor_carpi_radialis":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "tendinopatía", label: "Tendinopatía distal" },
          { val: "tenosinovitis", label: "Tenosinovitis en la vaina del FCR" },
          { val: "desgarro", label: "Desgarro / Rotura parcial" }
        ];
      case "arteria_radial":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "aneurisma", label: "Dilatación focal compatible con aneurisma" },
          { val: "trombosis", label: "Trombosis / Oclusión total de flujo" },
          { val: "calcificación", label: "Ateromatosis / Calcificación fina de pared" }
        ];
      case "receso_radiocarpiano_anterior":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "derrame", label: "Derrame articular libre" },
          { val: "sinovitis", label: "Sinovitis con hiperemia capsular" },
          { val: "quiste_espinoso", label: "Quiste sinovial / Ganglión anterior" }
        ];
      case "canal_de_guyon":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "compresion_nerviosa", label: "Compresión del nervio cubital / ulnar" },
          { val: "derrame", label: "Derrame compartimental Guyón" },
          { val: "quiste_sinovial", label: "Quiste ganglionar proximal" }
        ];
      case "receso_radiocarpiano_posterior":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "derrame", label: "Derrame radiocarpiano posterior" },
          { val: "sinovitis", label: "Sinovitis / Engrosamiento de cápsula dorsal" },
          { val: "quiste_sinovial", label: "Quiste sinovial / Ganglión dorsal" }
        ];
      case "articulacion_radiocubital_distal":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "derrame", label: "Derrame sinovial radiocubital" },
          { val: "subluxacion", label: "Subluxación / Inestabilidad dorsal cubital" },
          { val: "artrosis", label: "Artrosis / Osteofitos radiocubitales" }
        ];
      case "tendones_extensores_compartimentos":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "de_quervain", label: "Tenosinovitis de De Quervain (Comp. I)" },
          { val: "sinovitis", label: "Tenosinovitis extensora general dorsal" },
          { val: "desgarro", label: "Desgarro / Rotura intrasustancia" },
          { val: "tendinitis_intersticial", label: "Tendinitis intersticial / Tendinopatía" }
        ];
      case "fibrocartilago_triangular":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "desgarro", label: "Desgarro / Rotura focal del CFCT" },
          { val: "degenerativo", label: "Cambios degenerativos / Adelgazamiento" },
          { val: "perforacion", label: "Perforación espontánea del CFCT" }
        ];
      case "extensor_carpi_ulnaris":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "tenosinovitis", label: "Tenosinovitis del ECU (Comp. VI)" },
          { val: "subluxacion", label: "Subluxación / Inestabilidad en vaina" },
          { val: "desgarro", label: "Desgarro parcial o tendinosis severa" }
        ];
      default:
        return [];
    }
  };

  const badges = getBadgesCount();

  const getActiveStructureLabel = () => {
    const labels: Record<string, string> = {
      nervio_mediano: "Nervio Mediano",
      tendones_flexores: "Tendones Flexores",
      flexor_carpi_radialis: "Flexor Carpi Radialis",
      arteria_radial: "Arteria Radial",
      receso_radiocarpiano_anterior: "Receso Volar Articular",
      canal_de_guyon: "Canal de Guyon",
      receso_radiocarpiano_posterior: "Receso Dorsal Articular",
      articulacion_radiocubital_distal: "Articulación Radiocubital Distal",
      tendones_extensores_compartimentos: "Tendones Extensores (Comps I-VI)",
      fibrocartilago_triangular: "Fibrocartílago Triangular (CFCT)",
      extensor_carpi_ulnaris: "Extensor Carpi Ulnaris (ECU)"
    };
    return labels[selectedStructure] || "";
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border-2 border-slate-800/80 p-5 shadow-2xl flex flex-col gap-5">
      
      {/* PANEL HEADER WITH TOGGLES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600/20 to-pink-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
              US de Muñeca (Mapeo Bilateral Volar & Dorsal)
              <span className="text-[10px] lowercase font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-850">
                interactivo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Esquemas dinámicos para Cara Anterior (Volar) y Cara Posterior (Dorsal) de Muñeca
            </p>
          </div>
        </div>

        {/* CONTROLS (NLP SYNC - ONDEMAND ONLY) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => handleScanReportText(true)}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              syncAvailable 
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-550 border-indigo-500 text-slate-100 shadow-[0_2px_8px_rgba(99,102,241,0.2)] active:scale-97" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin text-indigo-300" />
                <span>Extrayendo...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-indigo-300" />
                <span>Extrayendo de Reporte (Sincronizar)</span>
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

      {/* CENTRAL AREA: TWO DIAGRAMS SIDE-BY-SIDE OR TABBED ON DESKTOP, EDITOR ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
        
        {/* LEFT COLUMN: TWO INTERACTIVE SVGs */}
        <div className="lg:col-span-5 flex flex-col md:flex-row lg:flex-col xl:flex-row gap-4 bg-slate-950/30 p-3 rounded-xl max-w-full">
          
          {/* CARA ANTERIOR SVG */}
          <div className="flex-1 flex flex-col items-center border border-slate-850/60 p-2.5 rounded-xl bg-slate-950/20">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-850 pb-1 mb-2 w-full text-center">
              Cara Anterior (Volar)
            </span>
            <div className="w-full flex items-center justify-center min-h-[190px] relative overflow-hidden">
              <svg 
                id="wrist-anatomy-anterior-svg"
                viewBox="0 0 200 200" 
                className="w-full max-w-[170px] h-auto drop-shadow-2xl"
                style={{ maxHeight: "180px" }}
              >
                {/* Hand Forearm & Carpus Base contour */}
                <path 
                  d="M 50,195 C 48,150 55,110 52,90 C 48,70 30,55 35,40 C 38,20 60,35 70,50 C 90,45 100,50 110,50 C 130,35 152,18 158,35 C 163,50 148,65 145,85 C 142,105 148,150 146,195 Z" 
                  fill="#0b0f19" 
                  stroke="#334155" 
                  strokeWidth="1.5" 
                  opacity="0.85"
                />

                {/* Receso Radiocarpiano Anterior (Articular Volar) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("receso_radiocarpiano_anterior")}
                  onMouseEnter={() => setActiveHover("receso_radiocarpiano_anterior")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <ellipse 
                    cx="98" 
                    cy="115" 
                    rx="32" 
                    ry="10" 
                    fill={getColorForSVG("receso_radiocarpiano_anterior").fill}
                    stroke={getColorForSVG("receso_radiocarpiano_anterior").stroke}
                    strokeWidth={states.receso_radiocarpiano_anterior !== "normal" && states.receso_radiocarpiano_anterior !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.receso_radiocarpiano_anterior !== "normal" && states.receso_radiocarpiano_anterior !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="98" y="117" textAnchor="middle" fill="#cbd5e1" fontSize="6.5" fontWeight="bold" opacity="0.8" className="pointer-events-none select-none">Receso Volar</text>
                </g>

                {/* Tendones Flexores */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("tendones_flexores")}
                  onMouseEnter={() => setActiveHover("tendones_flexores")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 94,195 L 94,80 M 100,195 L 100,80 M 106,195 L 106,80" 
                    fill="none"
                    stroke={getColorForSVG("tendones_flexores").stroke}
                    strokeWidth={states.tendones_flexores !== "normal" && states.tendones_flexores !== "no_descrito" ? "5.5" : "3"}
                    opacity={states.tendones_flexores !== "no_descrito" ? "0.9" : "0.35"}
                  />
                  <text x="100" y="160" textAnchor="middle" fill="#94a3b8" fontSize="6" fontWeight="bold" opacity="0.95" className="pointer-events-none select-none">Flexores</text>
                </g>

                {/* Nervio Mediano */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("nervio_mediano")}
                  onMouseEnter={() => setActiveHover("nervio_mediano")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <line 
                    x1="84" 
                    y1="195" 
                    x2="84" 
                    y2="78"
                    stroke={getColorForSVG("nervio_mediano").stroke}
                    strokeWidth={states.nervio_mediano !== "normal" && states.nervio_mediano !== "no_descrito" ? "4" : "1.8"}
                    strokeDasharray={states.nervio_mediano === "comprimido" ? "2,2" : undefined}
                    opacity="0.95"
                  />
                  <text x="82" y="145" textAnchor="end" fill="#f43f5e" fontSize="6" fontWeight="extrabold" className="pointer-events-none select-none">N. Mediano</text>
                </g>

                {/* Flexor Carpi Radialis (FCR) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("flexor_carpi_radialis")}
                  onMouseEnter={() => setActiveHover("flexor_carpi_radialis")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 66,195 Q 68,140 64,88" 
                    fill="none"
                    stroke={getColorForSVG("flexor_carpi_radialis").stroke}
                    strokeWidth={states.flexor_carpi_radialis !== "normal" && states.flexor_carpi_radialis !== "no_descrito" ? "3.2" : "1.5"}
                    opacity={states.flexor_carpi_radialis !== "no_descrito" ? "0.8" : "0.3"}
                  />
                  <text x="56" y="175" fill="#f59e0b" fontSize="5.5" fontWeight="semibold" className="pointer-events-none select-none">FCR</text>
                </g>

                {/* Arteria Radial */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("arteria_radial")}
                  onMouseEnter={() => setActiveHover("arteria_radial")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 58,195 Q 58,135 52,95" 
                    fill="none"
                    stroke={getColorForSVG("arteria_radial").stroke}
                    strokeWidth="1.5"
                    opacity={states.arteria_radial !== "no_descrito" ? "0.95" : "0.35"}
                  />
                  <ellipse 
                    cx="58" 
                    cy="140" 
                    rx="3" 
                    ry="3" 
                    fill={states.arteria_radial === "trombosis" ? "#475569" : "#ef4444"} 
                    opacity="0.75"
                  />
                  <text x="48" y="125" fill="#ef4444" fontSize="5.5" fontWeight="semibold" className="pointer-events-none select-none">Radial Art.</text>
                </g>

                {/* Canal de Guyon */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("canal_de_guyon")}
                  onMouseEnter={() => setActiveHover("canal_de_guyon")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <rect 
                    x="124" 
                    y="110" 
                    width="14" 
                    height="20" 
                    rx="4"
                    fill={getColorForSVG("canal_de_guyon").fill}
                    stroke={getColorForSVG("canal_de_guyon").stroke}
                    strokeWidth={states.canal_de_guyon !== "normal" && states.canal_de_guyon !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.canal_de_guyon !== "normal" && states.canal_de_guyon !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="131" y="122" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="bold" className="pointer-events-none select-none">Guyon</text>
                </g>
              </svg>
            </div>
          </div>

          {/* CARA POSTERIOR SVG */}
          <div className="flex-1 flex flex-col items-center border border-slate-850/60 p-2.5 rounded-xl bg-slate-950/20">
            <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest border-b border-slate-850 pb-1 mb-2 w-full text-center">
              Cara Posterior (Dorsal)
            </span>
            <div className="w-full flex items-center justify-center min-h-[190px] relative overflow-hidden">
              <svg 
                id="wrist-anatomy-posterior-svg"
                viewBox="0 0 200 200" 
                className="w-full max-w-[170px] h-auto drop-shadow-2xl"
                style={{ maxHeight: "180px" }}
              >
                {/* Hand Forearm & Carpus Dorsal Back contour */}
                <path 
                  d="M 50,195 C 48,150 55,110 52,90 C 48,70 30,55 35,40 C 38,20 60,35 70,50 C 90,45 100,50 110,50 C 130,35 152,18 158,35 C 163,50 148,65 145,85 C 142,105 148,150 146,195 Z" 
                  fill="#0b0f19" 
                  stroke="#475569" 
                  strokeWidth="1.5" 
                  opacity="0.85"
                />

                {/* Receso Radiocarpiano Posterior (Articular Dorsal) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("receso_radiocarpiano_posterior")}
                  onMouseEnter={() => setActiveHover("receso_radiocarpiano_posterior")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <ellipse 
                    cx="96" 
                    cy="125" 
                    rx="28" 
                    ry="9" 
                    fill={getColorForSVG("receso_radiocarpiano_posterior").fill}
                    stroke={getColorForSVG("receso_radiocarpiano_posterior").stroke}
                    strokeWidth={states.receso_radiocarpiano_posterior !== "normal" && states.receso_radiocarpiano_posterior !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.receso_radiocarpiano_posterior !== "normal" && states.receso_radiocarpiano_posterior !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="96" y="127" textAnchor="middle" fill="#cbd5e1" fontSize="6" fontWeight="bold" opacity="0.8" className="pointer-events-none select-none">Receso Dorsal</text>
                </g>

                {/* Articulación Radiocubital Distal */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("articulacion_radiocubital_distal")}
                  onMouseEnter={() => setActiveHover("articulacion_radiocubital_distal")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <rect 
                    x="114" 
                    y="142" 
                    width="8" 
                    height="28" 
                    rx="2.5"
                    fill={getColorForSVG("articulacion_radiocubital_distal").fill}
                    stroke={getColorForSVG("articulacion_radiocubital_distal").stroke}
                    strokeWidth={states.articulacion_radiocubital_distal !== "normal" && states.articulacion_radiocubital_distal !== "no_descrito" ? "2" : "1"}
                    fillOpacity={states.articulacion_radiocubital_distal !== "normal" && states.articulacion_radiocubital_distal !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="111" y="158" textAnchor="end" fill="#a1a1aa" fontSize="5" fontWeight="semibold" className="pointer-events-none select-none">ARCD</text>
                </g>

                {/* Tendones Extensores (Compartimentos I-VI) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("tendones_extensores_compartimentos")}
                  onMouseEnter={() => setActiveHover("tendones_extensores_compartimentos")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 65,195 L 85,75 M 82,195 L 102,75 M 98,195 L 118,75" 
                    fill="none"
                    stroke={getColorForSVG("tendones_extensores_compartimentos").stroke}
                    strokeWidth={states.tendones_extensores_compartimentos !== "normal" && states.tendones_extensores_compartimentos !== "no_descrito" ? "4.5" : "2"}
                    opacity={states.tendones_extensores_compartimentos !== "no_descrito" ? "0.9" : "0.35"}
                  />
                  <text x="84" y="174" textAnchor="end" fill="#22c55e" fontSize="5" fontWeight="bold" className="pointer-events-none select-none">Extensores</text>
                </g>

                {/* Fibrocartílago Triangular (CFCT) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("fibrocartilago_triangular")}
                  onMouseEnter={() => setActiveHover("fibrocartilago_triangular")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <polygon 
                    points="123,124 140,124 123,135" 
                    fill={getColorForSVG("fibrocartilago_triangular").fill}
                    stroke={getColorForSVG("fibrocartilago_triangular").stroke}
                    strokeWidth={states.fibrocartilago_triangular !== "normal" && states.fibrocartilago_triangular !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.fibrocartilago_triangular !== "normal" && states.fibrocartilago_triangular !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="136" y="117" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="extrabold" className="pointer-events-none select-none">CFCT</text>
                </g>

                {/* Extensor Carpi Ulnaris (ECU / Sexto Compartimento) */}
                <g
                  className="cursor-pointer transition-all duration-205"
                  onClick={() => setSelectedStructure("extensor_carpi_ulnaris")}
                  onMouseEnter={() => setActiveHover("extensor_carpi_ulnaris")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 134,195 L 134,80" 
                    fill="none"
                    stroke={getColorForSVG("extensor_carpi_ulnaris").stroke}
                    strokeWidth={states.extensor_carpi_ulnaris !== "normal" && states.extensor_carpi_ulnaris !== "no_descrito" ? "3" : "1.5"}
                    opacity={states.extensor_carpi_ulnaris !== "no_descrito" ? "0.85" : "0.35"}
                  />
                  <text x="140" y="180" textAnchor="start" fill="#f59e0b" fontSize="5.5" fontWeight="semibold" className="pointer-events-none select-none">ECU</text>
                </g>
              </svg>
            </div>
          </div>

          {additionalFindings && additionalFindings.length > 0 && (
            <div className="w-full bg-slate-900/10 border border-slate-850 p-3 rounded-2xl mt-4">
              <h5 className="text-[9px] uppercase font-black text-indigo-400 font-mono tracking-wider mb-2 text-left select-none">
                📍 Hallazgos Adicionales Detectados
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
                {additionalFindings.map((item) => {
                  const s = item.state || "Alterado";
                  return (
                    <div 
                      key={item.id}
                      className="p-2 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col justify-between text-left"
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
        </div>

        {/* RIGHT COLUMN: DETAILED EDITOR PANEL */}
        <div className="lg:col-span-5 bg-slate-950/40 p-4 border border-slate-850/60 rounded-xl flex flex-col gap-3.5">
          <div>
            <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Configurar Hallazgo
              </span>
              <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-md">
                {getActiveStructureLabel() || selectedStructure}
              </span>
            </div>

            {/* Structure Switcher Dropdown */}
            <div className="mt-3">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Seleccionar Estructura:</label>
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <optgroup label="Cara Anterior / Volar">
                  <option value="nervio_mediano">Nervio Mediano</option>
                  <option value="tendones_flexores">Tendones Flexores (Superf./Prof.)</option>
                  <option value="flexor_carpi_radialis">Flexor Carpi Radialis (FCR)</option>
                  <option value="arteria_radial">Arteria Radial</option>
                  <option value="receso_radiocarpiano_anterior">Receso Volar Articular</option>
                  <option value="canal_de_guyon">Canal de Guyon</option>
                </optgroup>
                <optgroup label="Cara Posterior / Dorsal">
                  <option value="receso_radiocarpiano_posterior">Receso Dorsal Articular</option>
                  <option value="articulacion_radiocubital_distal">Artic. Radiocubital Distal</option>
                  <option value="tendones_extensores_compartimentos">Tendones Extensores (Comps I-VI)</option>
                  <option value="fibrocartilago_triangular">Fibrocartílago Triangular (CFCT)</option>
                  <option value="extensor_carpi_ulnaris">Extensor Carpi Ulnaris (ECU)</option>
                </optgroup>
              </select>
            </div>

            {/* Custom State Input */}
            <div className="mt-3 space-y-1">
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
                    handleStateChange(selectedStructure, nextVal);
                  }}
                  placeholder="Escriba el diagnóstico del hallazgo (ej: Tenosinovitis, Desgarro, etc.)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStateChange(selectedStructure, "normal")}
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
                    onClick={() => handleStateChange(selectedStructure, "no_descrito")}
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

            {/* Custom Description Textarea */}
            {states[selectedStructure] !== "no_descrito" && (
              <div className="mt-3 animate-fadeIn">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Hallazgos del Reporte (Editables):
                </label>
                <textarea
                  value={customDescriptions[selectedStructure] || ""}
                  onChange={(e) => handleDescriptionChange(selectedStructure, e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-indigo-500 font-medium leading-relaxed resize-none"
                  placeholder="Insertar hallazgos clínicos de los hallazgos patológicos..."
                />
              </div>
            )}
          </div>

          {/* SINOPSIS METRIC INFO */}
          <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed font-medium">
            <div className="text-slate-300 font-bold mb-1 flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-indigo-400" />
              <span>Criterio de Inclusión de Muñeca:</span>
            </div>
            Únicamente las estructuras marcadas como <strong className="text-amber-400 font-black">Patológicas</strong> se incrustan de forma estructurada en la tabla de hallazgos del reporte. Las estructuras marcadas como <strong className="text-emerald-400">Normales</strong> u <strong className="text-slate-500">Omisas</strong> quedan excluidas de la tabla para optimizar la visualización de datos clínicos de interés.
          </div>

          {/* Mapeo de Hallazgos Clínicos Sintonizados (aligned anatomical cards) */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3 mt-3">
            <label className="text-[11px] font-black text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none mb-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              Mapeo de Hallazgos Clínicos Sintonizados (Muñeca)
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.keys(states).filter(id => states[id] !== "no_descrito" && states[id] !== "normal").map(id => {
                const s = states[id];
                const isSelected = selectedStructure === id;
                const transLabel = id === "nervio_mediano" ? "Nervio Mediano" : 
                                   id === "nervio_cubital" ? "Nervio Cubital" : 
                                   id === "tendones_flexores" ? "Tendones Flexores" : 
                                   id === "tendones_extensores" ? "Tendones Extensores" : 
                                   id === "tunel_carpiano" ? "Túnel Carpiano" : 
                                   id === "canal_guyon" ? "Canal de Guyon" : 
                                   id === "tfcc_complejo" ? "Complejo TFCC (FCT)" : 
                                   id === "artes_carpo" ? "Articulaciones del Carpo" : 
                                   id === "bainas_sinoviales" ? "Vainas Sinoviales" : id;
                const simplified = customDescriptions[id]?.trim() || (s === "normal" ? "Dentro de límites normales" : s);
                
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-450 border-emerald-900/30";
                } else if (s.includes("leve") || s.includes("derrame_leve") || s.includes("sinovitis_l") || s.includes("quiste") || s.includes("engrosamiento_l")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s.includes("desgarro") || s.includes("ruptura") || s.includes("compresion_severa") || s.includes("sinovitis_severa") || s.includes("artrosis")) {
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
                        ? "bg-slate-900 border-indigo-500 text-indigo-400 shadow-md scale-[1.01]" 
                        : "bg-slate-950/60 hover:bg-slate-950/80 border-slate-850/40 text-slate-350"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 leading-none w-full select-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor} transition-transform group-hover:scale-110`} />
                        <span className={`text-[10px] font-black uppercase tracking-wide truncate ${isSelected ? "text-indigo-400" : "text-slate-200"}`}>
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

              {Object.keys(states).filter(id => states[id] !== "no_descrito" && states[id] !== "normal").length === 0 && (!additionalFindings || additionalFindings.length === 0) && (
                <div className="col-span-full py-4 text-center text-slate-500 italic text-xs">
                  Sin hallazgos patológicos relevantes detectados.
                </div>
              )}
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={exportTableData}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer border border-indigo-400/20"
                title="Inyecta una tabla formal de hallazgos médicos estructurados al final del informe actual"
              >
                <Download className="h-3 w-3" />
                Insertar Tabla
              </button>
              <button
                type="button"
                onClick={exportNarrative}
                className="py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-950 transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer"
                title="Inyecta un resumen narrativo de hallazgos al reporte"
              >
                📥 Insertar Viñetas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SYNC TRACE AND NLP LOGS */}
      {syncLogs.length > 0 && (
        <div className="border-t border-slate-800/80 pt-3 mt-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping inline-block" />
            <span>Bitácora de Sincronización (Muñeca):</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-indigo-300 max-h-[80px] overflow-y-auto leading-normal">
            {syncLogs.map((log, lIdx) => (
              <div key={lIdx}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
