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
  includeDeQuervain?: boolean;
  setIncludeDeQuervain?: (val: boolean) => void;
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
  includeInReport: propIncludeInReport = true,
  setIncludeInReport: propSetIncludeInReport,
  includeDeQuervain: propIncludeDeQuervain = false,
  setIncludeDeQuervain: propSetIncludeDeQuervain,
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
    extensor_carpi_ulnaris: "no_descrito",

    // De Quervain specific (First Extensor Compartment)
    dq_tendones_apl_epb: "no_descrito",
    dq_vaina_sinovial_liquido: "no_descrito",
    dq_retinaculo_extensor: "no_descrito",
    dq_doppler_hyperemia: "no_descrito"
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
    extensor_carpi_ulnaris: "",

    dq_tendones_apl_epb: "",
    dq_vaina_sinovial_liquido: "",
    dq_retinaculo_extensor: "",
    dq_doppler_hyperemia: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("nervio_mediano");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

  const [localIncludeInReport, setLocalIncludeInReport] = useState(true);
  const [localIncludeDeQuervain, setLocalIncludeDeQuervain] = useState(false);

  const includeInReport = propIncludeInReport !== undefined ? propIncludeInReport : localIncludeInReport;
  const setIncludeInReport = propSetIncludeInReport !== undefined ? propSetIncludeInReport : setLocalIncludeInReport;

  const includeDeQuervain = propIncludeDeQuervain !== undefined ? propIncludeDeQuervain : localIncludeDeQuervain;
  const setIncludeDeQuervain = propSetIncludeDeQuervain !== undefined ? propSetIncludeDeQuervain : setLocalIncludeDeQuervain;

  useEffect(() => {
    const dqKeys = ["dq_tendones_apl_epb", "dq_vaina_sinovial_liquido", "dq_retinaculo_extensor", "dq_doppler_hyperemia"];
    const isDqSelected = dqKeys.includes(selectedStructure);
    if (!includeInReport && !isDqSelected) {
      setSelectedStructure("dq_tendones_apl_epb");
    } else if (!includeDeQuervain && isDqSelected) {
      setSelectedStructure("nervio_mediano");
    }
  }, [includeInReport, includeDeQuervain, selectedStructure]);

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
      case "dq_tendones_apl_epb":
        return [
          "apl", "epb", "abductor pollicis longus", "extensor pollicis brevis", "tendon de quervain", "tendones de quervain", "tendon de primer compartimento", "tendon del primer compartimento", "tendones del primer compartimento"
        ];
      case "dq_vaina_sinovial_liquido":
        return [
          "vaina de quervain", "vaina de primer compartimento", "vaina del primer compartimento", "liquido de quervain", "derrame de quervain", "halo de quervain", "distension de la vaina del primer", "distension de la vaina de quervain"
        ];
      case "dq_retinaculo_extensor":
        return [
          "retinaculo extensor", "retinaculo de quervain", "retinaculo del primer compartimento", "polea de quervain", "polea del primer compartimento", "engrosamiento del retinaculo extensor"
        ];
      case "dq_doppler_hyperemia":
        return [
          "doppler de quervain", "hiperemia de quervain", "vascularizacion de quervain", "flujo doppler de quervain", "doppler color de quervain", "hiperemia en el primer compartimento"
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
      "perforacion", "degenerativo", "engrosado", "desgarro_parcial", "derrame_leve", "derrame_severo",
      "engrosado_fibroso", "sin_flujo", "doppler_leve", "doppler_severo"
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
      case "dq_tendones_apl_epb":
        if (s === "engrosado") return "Tendones APL y EPB engrosados e hipoecogénicos, sugestivos de tendinopatía focal.";
        if (s === "desgarro_parcial") return "Defecto focal intrasustancia compatible con desgarro parcial en el tendón APL o EPB.";
        break;
      case "dq_vaina_sinovial_liquido":
        if (s === "derrame_leve") return "Leve acumulación de líquido rodeando los tendones del primer compartimento extensor.";
        if (s === "derrame_severo") return "Distensión marcada de la vaina sinovial con halo de líquido, compatible con tenosinovitis severa.";
        break;
      case "dq_retinaculo_extensor":
        if (s === "engrosado_fibroso") return "Engrosamiento del retináculo extensor suprayacente con cambios fibróticos.";
        break;
      case "dq_doppler_hyperemia":
        if (s === "sin_flujo") return "Sin señal Doppler de neovascularización activa.";
        if (s === "doppler_leve") return "Señal Doppler color leve en la vaina tendinosa, indicando hiperemia activa de bajo grado.";
        if (s === "doppler_severo") return "Marcada hipervascularización en el estudio Doppler color en el primer compartimento extensor.";
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
      } else if (id === "dq_tendones_apl_epb") {
        if (textLower.includes("desgarro") || textLower.includes("rotura") || textLower.includes("ruptura")) {
          detectedState = "desgarro_parcial";
          desc = "Defecto focal intrasustancia compatible con desgarro parcial en el tendón APL o EPB.";
        } else if (textLower.includes("engrosado") || textLower.includes("hipoecogen") || textLower.includes("tendinos") || textLower.includes("tendinopat")) {
          detectedState = "engrosado";
          desc = "Tendones APL y EPB engrosados e hipoecogénicos, sugestivos de tendinopatía focal.";
        } else {
          detectedState = "normal";
          desc = "Dentro de límites normales.";
        }
      } else if (id === "dq_vaina_sinovial_liquido") {
        if (textLower.includes("tenosinovitis") || textLower.includes("liquido") || textLower.includes("derrame") || textLower.includes("halo")) {
          if (textLower.includes("severo") || textLower.includes("marcado") || textLower.includes("abundante")) {
            detectedState = "derrame_severo";
            desc = "Distensión marcada de la vaina sinovial con halo de líquido, compatible con tenosinovitis severa.";
          } else {
            detectedState = "derrame_leve";
            desc = "Leve acumulación de líquido rodeando los tendones del primer compartimento extensor.";
          }
        } else {
          detectedState = "normal";
          desc = "Dentro de límites normales.";
        }
      } else if (id === "dq_retinaculo_extensor") {
        if (textLower.includes("retinaculo") && (textLower.includes("engrosado") || textLower.includes("engrosamiento") || textLower.includes("fibro"))) {
          detectedState = "engrosado_fibroso";
          desc = "Engrosamiento del retináculo extensor suprayacente con cambios fibróticos.";
        } else {
          detectedState = "normal";
          desc = "Dentro de límites normales.";
        }
      } else if (id === "dq_doppler_hyperemia") {
        if (textLower.includes("doppler") || textLower.includes("hiperemia") || textLower.includes("flujo") || textLower.includes("vasculariz")) {
          if (textLower.includes("abundante") || textLower.includes("severo") || textLower.includes("marcado") || textLower.includes("alto grado")) {
            detectedState = "doppler_severo";
            desc = "Marcada hipervascularización en el estudio Doppler color en el primer compartimento extensor.";
          } else if (textLower.includes("leve") || textLower.includes("discreto") || textLower.includes("bajo grado")) {
            detectedState = "doppler_leve";
            desc = "Señal Doppler color leve en la vaina tendinosa, indicando hiperemia activa de bajo grado.";
          } else {
            detectedState = "sin_flujo";
            desc = "Sin señal Doppler de neovascularización activa.";
          }
        } else {
          detectedState = "normal";
          desc = "Dentro de límites normales.";
        }
      }

      nextStates[id] = detectedState;
      nextDescriptions[id] = desc;
      logs.push(`[Local] ${id} clasificado como ${detectedState.toUpperCase()}.`);
    });

    const hasDeQuervainKeywords = ["quervain", "de quervain", "apl", "epb", "primer compartimento"].some(kw => textLower.includes(kw));
    if (hasDeQuervainKeywords && setIncludeDeQuervain) {
      setIncludeDeQuervain(true);
      logs.push("[Local] Se detectaron palabras clave de De Quervain. Auto-activando esquema de De Quervain.");
    }

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
      },
      {
        id: "dq_tendones_apl_epb",
        label: "Tendones APL y EPB",
        allowedStates: ["no_descrito", "normal", "engrosado", "desgarro_parcial"]
      },
      {
        id: "dq_vaina_sinovial_liquido",
        label: "Vaina Sinovial Común",
        allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_severo"]
      },
      {
        id: "dq_retinaculo_extensor",
        label: "Retináculo Extensor (I Comp)",
        allowedStates: ["no_descrito", "normal", "engrosado_fibroso"]
      },
      {
        id: "dq_doppler_hyperemia",
        label: "Señal Doppler / Hiperemia",
        allowedStates: ["no_descrito", "sin_flujo", "doppler_leve", "doppler_severo"]
      }
    ];

    try {
      const response = await fetch("/api/analyze-anatomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "gemini-3.5-flash",
          reportText: generatedReport,
          studyType: "Ultrasonido de Muñeca (Volar, Dorsal y Compartimento I)",
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

        // Check if De Quervain is active or found
        const dqKeys = ["dq_tendones_apl_epb", "dq_vaina_sinovial_liquido", "dq_retinaculo_extensor", "dq_doppler_hyperemia"];
        const dqHasPathology = dqKeys.some(k => finalStates[k] && finalStates[k] !== "no_descrito" && finalStates[k] !== "normal");
        const reportLower = generatedReport.toLowerCase();
        const hasDqText = ["quervain", "de quervain", "apl", "epb", "primer compartimento"].some(kw => reportLower.includes(kw));
        
        if ((dqHasPathology || hasDqText) && setIncludeDeQuervain) {
          setIncludeDeQuervain(true);
          logs.push("Se identificó hallazgo de De Quervain vía IA. Auto-activando esquema.");
        }

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

    const generalList = [
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

    const dqList = [
      { id: "dq_tendones_apl_epb", label: "Tendones APL y EPB" },
      { id: "dq_vaina_sinovial_liquido", label: "Vaina Sinovial (I Comp)" },
      { id: "dq_retinaculo_extensor", label: "Retináculo Extensor (I Comp)" },
      { id: "dq_doppler_hyperemia", label: "Señal Doppler / Hiperemia (I Comp)" }
    ];

    let list: Array<{ id: string; label: string }> = [];
    if (includeInReport) {
      list = [...list, ...generalList];
    }
    if (includeDeQuervain) {
      list = [...list, ...dqList];
    }

    let hasRows = false;
    list.forEach(item => {
      if (states[item.id] !== "no_descrito" && states[item.id] !== "normal") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.label}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todas las estructuras de la muñeca evaluadas se reportan de características normales.* |\n`;
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
      extensor_carpi_ulnaris: "Extensor Carpi Ulnaris",
      
      dq_tendones_apl_epb: "Tendones APL y EPB (I Compartimento Extensor)",
      dq_vaina_sinovial_liquido: "Vaina Sinovial Común (I Compartimento)",
      dq_retinaculo_extensor: "Retináculo Extensor (I Compartimento)",
      dq_doppler_hyperemia: "Señal Doppler / Hiperemia (I Compartimento)"
    };

    const dqKeys = ["dq_tendones_apl_epb", "dq_vaina_sinovial_liquido", "dq_retinaculo_extensor", "dq_doppler_hyperemia"];

    keys.forEach(id => {
      const isDqKey = dqKeys.includes(id);
      if (isDqKey && !includeDeQuervain) return;
      if (!isDqKey && !includeInReport) return;

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
    } else if (pathologicalItems.length === 0) {
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

    const dqKeys = ["dq_tendones_apl_epb", "dq_vaina_sinovial_liquido", "dq_retinaculo_extensor", "dq_doppler_hyperemia"];

    Object.keys(states).forEach(key => {
      const isDqKey = dqKeys.includes(key);
      if (isDqKey && !includeDeQuervain) return;
      if (!isDqKey && !includeInReport) return;

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
      case "dq_tendones_apl_epb":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "engrosado", label: "Engrosamiento / Tendinopatía focal" },
          { val: "desgarro_parcial", label: "Desgarro o rotura parcial" }
        ];
      case "dq_vaina_sinovial_liquido":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "derrame_leve", label: "Derrame leve (Líquido peritendinoso)" },
          { val: "derrame_severo", label: "Derrame severo (Tenosinovitis marcada)" }
        ];
      case "dq_retinaculo_extensor":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "engrosado_fibroso", label: "Retináculo engrosado / Cambios fibrosos" }
        ];
      case "dq_doppler_hyperemia":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "sin_flujo", label: "Normal (Sin neovascularización activa)" },
          { val: "doppler_leve", label: "Hiperemia leve (Flujo Doppler bajo)" },
          { val: "doppler_severo", label: "Hiperemia severa (Flujo Doppler alto)" }
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
      extensor_carpi_ulnaris: "Extensor Carpi Ulnaris (ECU)",
      dq_tendones_apl_epb: "Tendones APL y EPB",
      dq_vaina_sinovial_liquido: "Vaina Sinovial Común (Líquido)",
      dq_retinaculo_extensor: "Retináculo Extensor (I Comp)",
      dq_doppler_hyperemia: "Señal Doppler / Hiperemia"
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
            <span className="font-bold text-slate-200 block text-[11px]">Esquema General de Muñeca</span>
            <span className="text-[9px] text-slate-400">Diagramas interactivos de caras Anterior (Volar) y Posterior (Dorsal)</span>
          </div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none py-1.5 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors bg-slate-950/20 flex-1">
          <input 
            type="checkbox" 
            checked={includeDeQuervain} 
            onChange={(e) => setIncludeDeQuervain && setIncludeDeQuervain(e.target.checked)}
            className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
          />
          <div>
            <span className="font-bold text-slate-200 block text-[11px]">Esquema de De Quervain</span>
            <span className="text-[9px] text-slate-400">Diagrama anatómico especializado del I Compartimento Extensor</span>
          </div>
        </label>
      </div>

      {/* CENTRAL AREA: TWO DIAGRAMS SIDE-BY-SIDE OR TABBED ON DESKTOP, EDITOR ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE DIAGRAMS */}
        <div className="lg:col-span-5 flex flex-col gap-4 max-w-full">
          
          {includeInReport && (
            <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row gap-4 bg-slate-950/30 p-3 rounded-xl max-w-full border border-slate-850/45">
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
                {/* Grid de fondo tipo escáner médico */}
                <path d="M 0,20 L 200,20 M 0,40 L 200,40 M 0,60 L 200,60 M 0,80 L 200,80 M 0,100 L 200,100 M 0,120 L 200,120 M 0,140 L 200,140 M 0,160 L 200,160 M 0,180 L 200,180" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />
                <path d="M 20,0 L 20,200 M 40,0 L 40,200 M 60,0 L 60,200 M 80,0 L 80,200 M 100,0 L 100,200 M 120,0 L 120,200 M 140,0 L 140,200 M 160,0 L 160,200 M 180,0 L 180,200" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />

                {/* Hand Forearm & Carpus Base contour (Sombra de la mano sutil) */}
                <path 
                  d="M 50,195 C 48,150 55,110 52,90 C 48,70 28,55 32,40 C 35,20 58,32 68,48 C 88,43 102,48 112,48 C 132,32 155,15 160,32 C 165,48 150,62 147,82 C 144,102 148,150 146,195 Z" 
                  fill="#060913" 
                  stroke="#1e293b" 
                  strokeWidth="1" 
                  opacity="0.8"
                />

                {/* ANATOMÍA ÓSEA DE FONDO (Radio, Cúbito, Carpo y Metacarpo) */}
                {/* Radio distal (Izquierda en vista volar anterior) */}
                <path 
                  d="M 38,195 L 38,135 C 38,125 42,122 45,119 L 85,119 L 88,132 L 88,195 Z" 
                  fill="#0e1726" 
                  stroke="#334155" 
                  strokeWidth="0.8" 
                  opacity="0.5" 
                  title="Radio"
                />
                {/* Cúbito distal (Derecha en vista volar anterior) */}
                <path 
                  d="M 108,195 L 108,132 L 111,119 L 138,119 C 140,122 142,126 142,135 L 142,195 Z" 
                  fill="#0e1726" 
                  stroke="#334155" 
                  strokeWidth="0.8" 
                  opacity="0.5" 
                  title="Cúbito (Ulna)"
                />
                {/* Espacio Articular Radiocarpiano (Línea sutil) */}
                <path d="M 45,119 Q 93,122 138,119" fill="none" stroke="#475569" strokeWidth="0.5" opacity="0.3" />

                {/* Huesos del Carpo de fondo (Estilizados e impecables) */}
                <g opacity="0.45" stroke="#334155" strokeWidth="0.6" fill="#131d31">
                  {/* Fila proximal */}
                  <path d="M 48,114 C 45,106 52,100 58,102 C 60,105 55,112 48,114 Z" title="Escafoides" />
                  <path d="M 61,112 C 59,103 72,101 75,109 C 71,113 65,114 61,112 Z" title="Semilunar" />
                  <path d="M 78,111 C 77,105 88,102 91,108 C 88,112 82,113 78,111 Z" title="Piramidal" />
                  <circle cx="96" cy="112" r="4.5" title="Pisiforme" />
                  {/* Fila distal */}
                  <path d="M 50,94 C 47,88 56,84 60,89 C 58,94 54,96 50,94 Z" title="Trapecio" />
                  <path d="M 63,93 C 61,87 70,85 72,90 C 69,94 66,95 63,93 Z" title="Trapezoide" />
                  <path d="M 75,91 C 73,81 86,81 88,89 C 84,93 79,93 75,91 Z" title="Grande (Capitate)" />
                  <path d="M 91,92 C 89,84 102,83 103,90 C 99,94 95,94 91,92 Z" title="Ganchoso (Hamate)" />
                </g>

                {/* Metacarpianos (Bases de fondo) */}
                <g opacity="0.3" stroke="#334155" strokeWidth="0.5" fill="#0f172a">
                  <path d="M 42,75 L 48,65 L 53,75 Z" />
                  <path d="M 58,74 L 62,55 L 68,74 Z" />
                  <path d="M 73,73 L 77,50 L 83,73 Z" />
                  <path d="M 88,74 L 92,52 L 97,74 Z" />
                  <path d="M 102,76 L 106,58 L 112,76 Z" />
                </g>

                {/* ESTRUCTURAS INTERACTIVAS (CON ACCIONES CLINICAS E IA PERFECTAMENTE CONSERVADAS) */}

                {/* Receso Radiocarpiano Anterior (Articular Volar) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("receso_radiocarpiano_anterior")}
                  onMouseEnter={() => setActiveHover("receso_radiocarpiano_anterior")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 43,122 Q 91,126 138,122 Q 138,112 91,114 Q 43,112 43,122 Z"
                    fill={getColorForSVG("receso_radiocarpiano_anterior").fill}
                    stroke={getColorForSVG("receso_radiocarpiano_anterior").stroke}
                    strokeWidth={states.receso_radiocarpiano_anterior !== "normal" && states.receso_radiocarpiano_anterior !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.receso_radiocarpiano_anterior !== "normal" && states.receso_radiocarpiano_anterior !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="91" y="120" textAnchor="middle" fill="#94a3b8" fontSize="5" fontWeight="black" letterSpacing="0.5" className="pointer-events-none select-none font-sans uppercase">Receso Volar</text>
                </g>

                {/* Flexor Carpi Radialis (FCR) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("flexor_carpi_radialis")}
                  onMouseEnter={() => setActiveHover("flexor_carpi_radialis")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Trazado elegante y fiel del tendón FCR diagonal */}
                  <path 
                    d="M 58,195 Q 63,140 59,94 L 56,80" 
                    fill="none"
                    stroke={getColorForSVG("flexor_carpi_radialis").stroke}
                    strokeWidth={states.flexor_carpi_radialis !== "normal" && states.flexor_carpi_radialis !== "no_descrito" ? "3.2" : "1.5"}
                    opacity={states.flexor_carpi_radialis !== "no_descrito" ? "0.9" : "0.35"}
                  />
                  <text x="49" y="172" fill="#f59e0b" fontSize="5" fontWeight="bold" className="pointer-events-none select-none font-mono">FCR</text>
                </g>

                {/* Tendones Flexores (Múltiples haces anatómicos paralelos del flexor profundo y superficial de los dedos) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("tendones_flexores")}
                  onMouseEnter={() => setActiveHover("tendones_flexores")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 88,195 Q 89,140 85,95 L 68,58 M 94,195 Q 95,140 91,95 L 82,55 M 100,195 Q 101,140 97,95 L 96,55 M 106,195 Q 107,140 103,95 L 110,58" 
                    fill="none"
                    stroke={getColorForSVG("tendones_flexores").stroke}
                    strokeWidth={states.tendones_flexores !== "normal" && states.tendones_flexores !== "no_descrito" ? "5" : "2.5"}
                    opacity={states.tendones_flexores !== "no_descrito" ? "0.9" : "0.3"}
                  />
                  {/* Banda del retináculo flexor translúcida de fondo */}
                  <path d="M 52,106 Q 91,111 130,106 L 130,96 Q 91,101 52,96 Z" fill="#475569" fillOpacity="0.15" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />
                  <text x="94" y="150" textAnchor="middle" fill="#64748b" fontSize="5" fontWeight="black" className="pointer-events-none select-none font-sans uppercase">Tendones Flexores</text>
                </g>

                {/* Arteria Radial */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("arteria_radial")}
                  onMouseEnter={() => setActiveHover("arteria_radial")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Arteria roja elegante y sinuosa con ramitas colaterales */}
                  <path 
                    d="M 48,195 Q 50,145 44,115 T 40,78" 
                    fill="none"
                    stroke={getColorForSVG("arteria_radial").stroke}
                    strokeWidth="1.2"
                    opacity={states.arteria_radial !== "no_descrito" ? "0.95" : "0.3"}
                  />
                  {/* Indicador de pulso arterial */}
                  <ellipse 
                    cx="47.2" 
                    cy="138" 
                    rx={states.arteria_radial === "aneurisma" ? "5" : "2.2"} 
                    ry={states.arteria_radial === "aneurisma" ? "5" : "2.2"} 
                    fill={states.arteria_radial === "trombosis" ? "#475569" : "#ef4444"} 
                    fillOpacity="0.8"
                    className={states.arteria_radial !== "trombosis" && states.arteria_radial !== "no_descrito" ? "animate-pulse" : ""}
                  />
                  <text x="41" y="130" textAnchor="end" fill="#ef4444" fontSize="4.5" fontWeight="bold" className="pointer-events-none select-none font-sans">A. Radial</text>
                </g>

                {/* Nervio Mediano */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("nervio_mediano")}
                  onMouseEnter={() => setActiveHover("nervio_mediano")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Nervio con su discurrir exacto y ramificaciones sensitivas terminales en abanico en la mano */}
                  <path 
                    d="M 76,195 Q 78,140 76,102 Q 74,90 68,64 M 76,102 Q 78,88 84,60 M 76,102 L 76,60" 
                    fill="none"
                    stroke={getColorForSVG("nervio_mediano").stroke}
                    strokeWidth={states.nervio_mediano !== "normal" && states.nervio_mediano !== "no_descrito" ? "3.5" : "1.5"}
                    strokeDasharray={states.nervio_mediano === "comprimido" ? "1.5,1.5" : undefined}
                    opacity="0.95"
                  />
                  <text x="70" y="160" textAnchor="end" fill="#f43f5e" fontSize="5" fontWeight="black" className="pointer-events-none select-none font-sans uppercase">N. Mediano</text>
                </g>

                {/* Canal de Guyon (Lado cubital, derecho en vista anterior) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("canal_de_guyon")}
                  onMouseEnter={() => setActiveHover("canal_de_guyon")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 115,122 C 112,112 128,112 128,122 L 123,138 C 121,141 113,141 113,138 Z"
                    fill={getColorForSVG("canal_de_guyon").fill}
                    stroke={getColorForSVG("canal_de_guyon").stroke}
                    strokeWidth={states.canal_de_guyon !== "normal" && states.canal_de_guyon !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.canal_de_guyon !== "normal" && states.canal_de_guyon !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="121.5" y="123" textAnchor="middle" fill="#cbd5e1" fontSize="4.5" fontWeight="bold" className="pointer-events-none select-none font-mono uppercase">Guyon</text>
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
                {/* Grid de fondo tipo escáner médico */}
                <path d="M 0,20 L 200,20 M 0,40 L 200,40 M 0,60 L 200,60 M 0,80 L 200,80 M 0,100 L 200,100 M 0,120 L 200,120 M 0,140 L 200,140 M 0,160 L 200,160 M 0,180 L 200,180" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />
                <path d="M 20,0 L 20,200 M 40,0 L 40,200 M 60,0 L 60,200 M 80,0 L 80,200 M 100,0 L 100,200 M 120,0 L 120,200 M 140,0 L 140,200 M 160,0 L 160,200 M 180,0 L 180,200" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />

                {/* Hand Forearm & Carpus Dorsal Back contour */}
                <path 
                  d="M 50,195 C 48,150 55,110 52,90 C 48,70 28,55 32,40 C 35,20 58,32 68,48 C 88,43 102,48 112,48 C 132,32 155,15 160,32 C 165,48 150,62 147,82 C 144,102 148,150 146,195 Z" 
                  fill="#060913" 
                  stroke="#1e293b" 
                  strokeWidth="1" 
                  opacity="0.8"
                />

                {/* ANATOMÍA ÓSEA DE FONDO (Radio, Cúbito con estiloides, Carpo dorsal) */}
                {/* Radio distal (Ahora a la derecha en vista dorsal posterior) */}
                <path 
                  d="M 112,195 L 112,135 C 112,125 108,122 105,119 L 65,119 L 62,132 L 62,195 Z" 
                  fill="#0e1726" 
                  stroke="#334155" 
                  strokeWidth="0.8" 
                  opacity="0.5" 
                  title="Radio con tubérculo de Lister"
                />
                {/* Protuberancia estilizada del Tubérculo de Lister (Dorsal) */}
                <path d="M 88,135 Q 88,131 92,135" fill="none" stroke="#475569" strokeWidth="0.8" />
                {/* Cúbito distal (Ahora a la izquierda en vista dorsal posterior) */}
                <path 
                  d="M 42,195 L 42,132 L 39,119 L 12,119 C 10,122 8,126 8,135 L 8,195 Z" 
                  fill="#0e1726" 
                  stroke="#334155" 
                  strokeWidth="0.8" 
                  opacity="0.5" 
                  title="Cúbito"
                />
                {/* Espacio articular radiocarpiano posterior */}
                <path d="M 105,119 Q 57,122 12,119" fill="none" stroke="#475569" strokeWidth="0.5" opacity="0.3" />

                {/* Huesos del carpo dorsal de fondo */}
                <g opacity="0.45" stroke="#334155" strokeWidth="0.6" fill="#131d31">
                  {/* Fila proximal */}
                  <path d="M 102,114 C 105,106 98,100 92,102 C 90,105 95,112 102,114 Z" title="Escafoides" />
                  <path d="M 89,112 C 91,103 78,101 75,109 C 79,113 85,114 89,112 Z" title="Semilunar" />
                  <path d="M 72,111 C 73,105 62,102 59,108 C 62,112 68,113 72,111 Z" title="Piramidal" />
                  {/* Fila distal */}
                  <path d="M 100,94 C 103,88 94,84 90,89 C 92,94 96,96 100,94 Z" title="Trapecio" />
                  <path d="M 87,93 C 89,87 80,85 78,90 C 81,94 84,95 87,93 Z" title="Trapezoide" />
                  <path d="M 75,91 C 77,81 64,81 62,89 C 66,93 71,93 75,91 Z" title="Grande" />
                  <path d="M 59,92 C 61,84 48,83 47,90 C 51,94 55,94 59,92 Z" title="Ganchoso" />
                </g>

                {/* Metacarpianos bases */}
                <g opacity="0.3" stroke="#334155" strokeWidth="0.5" fill="#0f172a">
                  <path d="M 108,75 L 102,65 L 97,75 Z" />
                  <path d="M 92,74 L 88,55 L 82,74 Z" />
                  <path d="M 77,73 L 73,50 L 67,73 Z" />
                  <path d="M 62,74 L 58,52 L 53,74 Z" />
                  <path d="M 48,76 L 44,58 L 38,76 Z" />
                </g>

                {/* ESTRUCTURAS INTERACTIVAS (CON ACCIONES CLINICAS E IA PERFECTAMENTE CONSERVADAS) */}

                {/* Receso Radiocarpiano Posterior (Articular Dorsal) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("receso_radiocarpiano_posterior")}
                  onMouseEnter={() => setActiveHover("receso_radiocarpiano_posterior")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 43,124 Q 91,128 138,124 Q 138,114 91,116 Q 43,114 43,124 Z"
                    fill={getColorForSVG("receso_radiocarpiano_posterior").fill}
                    stroke={getColorForSVG("receso_radiocarpiano_posterior").stroke}
                    strokeWidth={states.receso_radiocarpiano_posterior !== "normal" && states.receso_radiocarpiano_posterior !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.receso_radiocarpiano_posterior !== "normal" && states.receso_radiocarpiano_posterior !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="91" y="122" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="bold" opacity="0.85" className="pointer-events-none select-none font-sans uppercase">Receso Dorsal</text>
                </g>

                {/* Articulación Radiocubital Distal (ARCD) */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("articulacion_radiocubital_distal")}
                  onMouseEnter={() => setActiveHover("articulacion_radiocubital_distal")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Espacio articular vertical preciso */}
                  <rect 
                    x="105" 
                    y="136" 
                    width="6.5" 
                    height="32" 
                    rx="2"
                    fill={getColorForSVG("articulacion_radiocubital_distal").fill}
                    stroke={getColorForSVG("articulacion_radiocubital_distal").stroke}
                    strokeWidth={states.articulacion_radiocubital_distal !== "normal" && states.articulacion_radiocubital_distal !== "no_descrito" ? "2" : "1"}
                    fillOpacity={states.articulacion_radiocubital_distal !== "normal" && states.articulacion_radiocubital_distal !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="101" y="153" textAnchor="end" fill="#a1a1aa" fontSize="4.5" fontWeight="black" className="pointer-events-none select-none font-mono">ARCD</text>
                </g>

                {/* Fibrocartílago Triangular (CFCT) - Rediseñado de forma anatómica exacta en cuña articular */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("fibrocartilago_triangular")}
                  onMouseEnter={() => setActiveHover("fibrocartilago_triangular")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 39,122 L 53,122 L 40,136 Z" 
                    fill={getColorForSVG("fibrocartilago_triangular").fill}
                    stroke={getColorForSVG("fibrocartilago_triangular").stroke}
                    strokeWidth={states.fibrocartilago_triangular !== "normal" && states.fibrocartilago_triangular !== "no_descrito" ? "2.2" : "1"}
                    fillOpacity={states.fibrocartilago_triangular !== "normal" && states.fibrocartilago_triangular !== "no_descrito" ? "0.6" : "0.15"}
                  />
                  <text x="49" y="130" textAnchor="middle" fill="#cbd5e1" fontSize="4.5" fontWeight="black" className="pointer-events-none select-none font-sans">CFCT</text>
                </g>

                {/* Tendones Extensores (Compartimentos I-VI) - Hermoso abanico anatómico de tendones */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("tendones_extensores_compartimentos")}
                  onMouseEnter={() => setActiveHover("tendones_extensores_compartimentos")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  {/* Múltiples tendones que cruzan el dorso representando los compartimentos */}
                  <path 
                    d="M 68,195 Q 67,135 73,92 L 102,52 M 74,195 Q 73,135 79,92 L 88,50 M 80,195 Q 79,135 85,92 L 72,50 M 86,195 Q 85,135 91,92 L 56,54" 
                    fill="none"
                    stroke={getColorForSVG("tendones_extensores_compartimentos").stroke}
                    strokeWidth={states.tendones_extensores_compartimentos !== "normal" && states.tendones_extensores_compartimentos !== "no_descrito" ? "4.5" : "2"}
                    opacity={states.tendones_extensores_compartimentos !== "no_descrito" ? "0.9" : "0.35"}
                  />
                  {/* Banda del retináculo extensor translúcida */}
                  <path d="M 52,106 Q 91,111 130,106 L 130,96 Q 91,101 52,96 Z" fill="#475569" fillOpacity="0.12" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />
                  <text x="82" y="165" textAnchor="end" fill="#22c55e" fontSize="5" fontWeight="black" className="pointer-events-none select-none font-sans uppercase">Extensores</text>
                </g>

                {/* Extensor Carpi Ulnaris (ECU / Sexto Compartimento, sobre el cúbito) */}
                <g
                  className="cursor-pointer transition-all duration-205"
                  onClick={() => setSelectedStructure("extensor_carpi_ulnaris")}
                  onMouseEnter={() => setActiveHover("extensor_carpi_ulnaris")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 28,195 Q 26,140 31,90 L 34,70" 
                    fill="none"
                    stroke={getColorForSVG("extensor_carpi_ulnaris").stroke}
                    strokeWidth={states.extensor_carpi_ulnaris !== "normal" && states.extensor_carpi_ulnaris !== "no_descrito" ? "3" : "1.5"}
                    opacity={states.extensor_carpi_ulnaris !== "no_descrito" ? "0.85" : "0.35"}
                  />
                  <text x="31" y="160" textAnchor="end" fill="#f59e0b" fontSize="5" fontWeight="bold" className="pointer-events-none select-none font-mono">ECU</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* DE QUERVAIN SPECIALIZED DIAGRAM CONTAINER */}
      {includeDeQuervain && (
        <div className="flex flex-col items-center bg-slate-950/30 p-3 rounded-xl max-w-full border border-slate-850/40">
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest border-b border-slate-850 pb-1 mb-2 w-full text-center">
            Compartimento I Extensor (Tenosinovitis de De Quervain)
          </span>
          <div className="w-full flex items-center justify-center min-h-[190px] relative overflow-hidden">
            <svg 
              id="wrist-de-quervain-svg"
              viewBox="0 0 200 200" 
              className="w-full max-w-[170px] h-auto drop-shadow-2xl transition-all duration-300"
              style={{ maxHeight: "180px" }}
            >
              {/* Medical scanner background grid */}
              <path d="M 0,20 L 200,20 M 0,40 L 200,40 M 0,60 L 200,60 M 0,80 L 200,80 M 0,100 L 200,100 M 0,120 L 200,120 M 0,140 L 200,140 M 0,160 L 200,160 M 0,180 L 200,180" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />
              <path d="M 20,0 L 20,200 M 40,0 L 40,200 M 60,0 L 60,200 M 80,0 L 80,200 M 100,0 L 100,200 M 120,0 L 120,200 M 140,0 L 140,200 M 160,0 L 160,200 M 180,0 L 180,200" stroke="#1e293b" strokeWidth="0.2" opacity="0.3" strokeDasharray="2,2" />

              {/* Soft background shape representing radial aspect of hand/wrist */}
              <path 
                d="M 50,195 C 45,150 55,115 50,90 C 45,65 75,45 105,30 C 120,22 135,32 130,50 C 125,70 115,110 120,150 C 125,170 120,195 120,195 Z" 
                fill="#060913" 
                stroke="#1e293b" 
                strokeWidth="1" 
                opacity="0.8"
              />

              {/* Distal Radius Bone with styloid process bump */}
              <g 
                onClick={() => setSelectedStructure("dq_retinaculo_extensor")}
                className="cursor-pointer"
              >
                <path 
                  d="M 60,195 L 60,140 C 60,125 50,122 50,118 L 82,118 C 88,122 92,126 92,140 L 92,195 Z" 
                  fill="#0e1726" 
                  stroke="#334155" 
                  strokeWidth="0.8" 
                  opacity="0.5" 
                />
                <text x="73" y="165" fill="#475569" fontSize="5" fontWeight="bold" className="pointer-events-none select-none font-sans uppercase">Radio</text>
                <text x="54" y="115" fill="#475569" fontSize="4.5" className="pointer-events-none select-none font-mono">Estiloides</text>
              </g>

              {/* VAINA SINOVIAL COMÚN / LÍQUIDO */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedStructure("dq_vaina_sinovial_liquido")}
                onMouseEnter={() => setActiveHover("dq_vaina_sinovial_liquido")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 68,175 C 65,155 75,115 70,80 C 74,68 88,68 92,80 C 97,115 107,155 104,175 C 101,185 71,185 68,175 Z"
                  fill={getColorForSVG("dq_vaina_sinovial_liquido").fill}
                  stroke={getColorForSVG("dq_vaina_sinovial_liquido").stroke}
                  strokeWidth={states.dq_vaina_sinovial_liquido !== "normal" && states.dq_vaina_sinovial_liquido !== "no_descrito" ? "2.2" : "1"}
                  fillOpacity={states.dq_vaina_sinovial_liquido !== "normal" && states.dq_vaina_sinovial_liquido !== "no_descrito" ? "0.55" : "0.15"}
                />
                <text x="86" y="152" textAnchor="middle" fill="#cbd5e1" fontSize="4.5" fontWeight="black" className="pointer-events-none select-none font-sans uppercase">Vaina Sinovial</text>
              </g>

              {/* TENDONES APL & EPB */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedStructure("dq_tendones_apl_epb")}
                onMouseEnter={() => setActiveHover("dq_tendones_apl_epb")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* APL Tendon */}
                <path 
                  d="M 76,195 C 74,155 83,115 79,75 C 80,55 92,40 92,40" 
                  fill="none"
                  stroke={getColorForSVG("dq_tendones_apl_epb").stroke}
                  strokeWidth={states.dq_tendones_apl_epb !== "normal" && states.dq_tendones_apl_epb !== "no_descrito" ? "4.5" : "2"}
                  opacity={states.dq_tendones_apl_epb !== "no_descrito" ? "0.9" : "0.35"}
                />
                {/* EPB Tendon */}
                <path 
                  d="M 82,195 C 80,155 89,115 85,75 C 86,55 98,40 98,40" 
                  fill="none"
                  stroke={getColorForSVG("dq_tendones_apl_epb").stroke}
                  strokeWidth={states.dq_tendones_apl_epb !== "normal" && states.dq_tendones_apl_epb !== "no_descrito" ? "3.5" : "1.5"}
                  opacity={states.dq_tendones_apl_epb !== "no_descrito" ? "0.8" : "0.3"}
                />
                {/* Jagged partial tear line if state is desgarro_parcial */}
                {states.dq_tendones_apl_epb === "desgarro_parcial" && (
                  <path 
                    d="M 80,110 L 85,112 L 81,114 L 86,116" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="1.8" 
                  />
                )}
                <text x="80" y="52" textAnchor="middle" fill="#22c55e" fontSize="4.5" fontWeight="black" className="pointer-events-none select-none font-mono">APL / EPB</text>
              </g>

              {/* RETINÁCULO EXTENSOR */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedStructure("dq_retinaculo_extensor")}
                onMouseEnter={() => setActiveHover("dq_retinaculo_extensor")}
                onMouseLeave={() => setActiveHover(null)}
              >
                <path 
                  d="M 54,115 C 72,118 84,118 102,115 L 102,102 C 84,105 72,105 54,102 Z" 
                  fill={getColorForSVG("dq_retinaculo_extensor").fill}
                  stroke={getColorForSVG("dq_retinaculo_extensor").stroke}
                  strokeWidth={states.dq_retinaculo_extensor !== "normal" && states.dq_retinaculo_extensor !== "no_descrito" ? "2.2" : "1"}
                  fillOpacity={states.dq_retinaculo_extensor !== "normal" && states.dq_retinaculo_extensor !== "no_descrito" ? "0.6" : "0.2"}
                />
                <text x="78" y="111" textAnchor="middle" fill="#f59e0b" fontSize="4.2" fontWeight="bold" className="pointer-events-none select-none font-sans uppercase">Retináculo I</text>
              </g>

              {/* SIGNAL DOPPLER / NEOPLASM HYPEREMIA */}
              {(states.dq_doppler_hyperemia === "doppler_leve" || states.dq_doppler_hyperemia === "doppler_severo") && (
                <g
                  className="cursor-pointer animate-pulse font-mono"
                  onClick={() => setSelectedStructure("dq_doppler_hyperemia")}
                  onMouseEnter={() => setActiveHover("dq_doppler_hyperemia")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 69,145 Q 65,135 72,128 T 68,112 M 71,155 Q 67,145 74,138" 
                    fill="none" 
                    stroke={states.dq_doppler_hyperemia === "doppler_severo" ? "#ef4444" : "#f59e0b"} 
                    strokeWidth={states.dq_doppler_hyperemia === "doppler_severo" ? "2" : "1"} 
                  />
                  <path 
                    d="M 100,138 Q 104,128 97,118 T 100,98 M 103,148 Q 107,138 100,128" 
                    fill="none" 
                    stroke={states.dq_doppler_hyperemia === "doppler_severo" ? "#ef4444" : "#f59e0b"} 
                    strokeWidth={states.dq_doppler_hyperemia === "doppler_severo" ? "2" : "1"} 
                  />
                  <text x="106" y="128" fill="#ef4444" fontSize="4" fontWeight="black" className="pointer-events-none select-none font-sans">DOPPLER</text>
                </g>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* FALLBACK IF BOTH SCHEMAS ARE DISABLED */}
      {!includeInReport && !includeDeQuervain && (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl text-center">
          <Layers className="h-10 w-10 text-slate-600 animate-pulse mb-3" />
          <p className="text-xs font-bold text-slate-400">Esquemas Visuales Desactivados</p>
          <p className="text-[10px] text-slate-500 max-w-xs mt-1">
            Active al menos un esquema (General o De Quervain) para visualizar los esquemas interactivos e incluirlos en el reporte PDF.
          </p>
        </div>
      )}

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
