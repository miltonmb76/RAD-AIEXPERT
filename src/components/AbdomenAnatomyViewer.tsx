import React, { useState, useEffect, useRef } from "react";
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
  externalStates?: Record<string, string>;
  externalDescriptions?: Record<string, string>;
  additionalFindings?: Array<{ id: string; structureName: string; state: string; description: string }>;
  includeElastography?: boolean;
  setIncludeElastography?: (val: boolean) => void;
  elastographyHasStiffness?: boolean;
  setElastographyHasStiffness?: (val: boolean) => void;
  elastographyStiffness?: number;
  setElastographyStiffness?: (val: number) => void;
  elastographyCAP?: number;
  setElastographyCAP?: (val: number) => void;
  qusAttenuation?: number;
  setQusAttenuation?: (val: number) => void;
  fatFraction?: number;
  setFatFraction?: (val: number) => void;
  stiffnessOverride?: string;
  setStiffnessOverride?: (val: string) => void;
  steatosisOverride?: string;
  setSteatosisOverride?: (val: string) => void;
  includeBiliary?: boolean;
  setIncludeBiliary?: (val: boolean) => void;
  includeAppendix?: boolean;
  setIncludeAppendix?: (val: boolean) => void;
  includeDiverticulitis?: boolean;
  setIncludeDiverticulitis?: (val: boolean) => void;
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
    allowedStates: ["no_descrito", "normal", "litiasis", "litiasis_unica", "barro_biliar", "colecistitis_aguda", "colecistitis_cronica", "polipo", "pared_engrosada"]
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
  },
  {
    id: "pared_linea_alba",
    name: "Pared (Línea Alba)",
    allowedStates: ["no_descrito", "normal", "diastasis", "hernia_epigastrica", "lipoma", "tumor_solido"]
  },
  {
    id: "pared_umbilical",
    name: "Pared (Región Umbilical)",
    allowedStates: ["no_descrito", "normal", "hernia_umbilical", "defecto_aponeurotico", "tumor"]
  },
  {
    id: "pared_inguinal_derecha",
    name: "Pared (Región Inguinal Derecha)",
    allowedStates: ["no_descrito", "normal", "hernia_inguinal_derecha", "hernia_crural", "lipoma_canal"]
  },
  {
    id: "pared_inguinal_izquierda",
    name: "Pared (Región Inguinal Izquierda)",
    allowedStates: ["no_descrito", "normal", "hernia_inguinal_izquierda", "hernia_crural", "lipoma_canal"]
  },
  {
    id: "pared_muscular",
    name: "Pared (Músculos rectos / oblicuos)",
    allowedStates: ["no_descrito", "normal", "diastasis_de_rectos", "desgarro_muscular", "hematoma", "tumor_desmoide", "hernia_spiegel"]
  },
  {
    id: "suprarenales",
    name: "Glándulas Suprarrenales",
    allowedStates: ["no_descrito", "normal", "hiperplasia", "adenoma", "nodulo_sospechoso"]
  },
  {
    id: "retroperitoneo",
    name: "Retroperitoneo",
    allowedStates: ["no_descrito", "normal", "adenopatias", "liquido_libre", "masa_retroperitoneal"]
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
  onChangeDescriptions,
  externalStates,
  externalDescriptions,
  additionalFindings = [],
  includeElastography = false,
  setIncludeElastography,
  elastographyHasStiffness = true,
  setElastographyHasStiffness,
  elastographyStiffness = 5.2,
  setElastographyStiffness,
  elastographyCAP = 230,
  setElastographyCAP,
  qusAttenuation = 0.55,
  setQusAttenuation,
  fatFraction = 5.5,
  setFatFraction,
  stiffnessOverride = "auto",
  setStiffnessOverride,
  steatosisOverride = "auto",
  setSteatosisOverride,
  includeBiliary = true,
  setIncludeBiliary,
  includeAppendix = true,
  setIncludeAppendix,
  includeDiverticulitis = true,
  setIncludeDiverticulitis
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
    colon: "no_descrito",
    pared_linea_alba: "no_descrito",
    pared_umbilical: "no_descrito",
    pared_inguinal_derecha: "no_descrito",
    pared_inguinal_izquierda: "no_descrito",
    pared_muscular: "no_descrito",
    suprarenales: "no_descrito",
    retroperitoneo: "no_descrito"
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
    colon: "",
    pared_linea_alba: "",
    pared_umbilical: "",
    pared_inguinal_derecha: "",
    pared_inguinal_izquierda: "",
    pared_muscular: "",
    suprarenales: "",
    retroperitoneo: ""
  });

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string>("higado");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [lastSyncedReport, setLastSyncedReport] = useState<string>("");

  const [localIncludeElastography, setLocalIncludeElastography] = useState<boolean>(false);
  const [localHasStiffness, setLocalHasStiffness] = useState<boolean>(true);
  const [localStiffness, setLocalStiffness] = useState<number>(5.2);
  const [localCAP, setLocalCAP] = useState<number>(230);
  const [localAttenuation, setLocalAttenuation] = useState<number>(0.55);
  const [localFatFraction, setLocalFatFraction] = useState<number>(5.5);
  const [localStiffnessOverride, setLocalStiffnessOverride] = useState<string>("auto");
  const [localSteatosisOverride, setLocalSteatosisOverride] = useState<string>("auto");
  const [localIncludeBiliary, setLocalIncludeBiliary] = useState<boolean>(true);
  const [localIncludeAppendix, setLocalIncludeAppendix] = useState<boolean>(true);
  const [localIncludeDiverticulitis, setLocalIncludeDiverticulitis] = useState<boolean>(true);

  const activeIncludeElastography = setIncludeElastography ? includeElastography : localIncludeElastography;
  const activeHasStiffness = setElastographyHasStiffness ? elastographyHasStiffness : localHasStiffness;
  const activeStiffness = setElastographyStiffness ? elastographyStiffness : localStiffness;
  const activeCAP = setElastographyCAP ? elastographyCAP : localCAP;
  const activeAttenuation = setQusAttenuation ? qusAttenuation : localAttenuation;
  const activeFatFraction = setFatFraction ? fatFraction : localFatFraction;
  const activeStiffnessOverride = setStiffnessOverride ? stiffnessOverride : localStiffnessOverride;
  const activeSteatosisOverride = setSteatosisOverride ? steatosisOverride : localSteatosisOverride;
  const activeIncludeBiliary = setIncludeBiliary ? includeBiliary : localIncludeBiliary;
  const activeIncludeAppendix = setIncludeAppendix ? includeAppendix : localIncludeAppendix;
  const activeIncludeDiverticulitis = setIncludeDiverticulitis ? includeDiverticulitis : localIncludeDiverticulitis;

  const handleToggleInclude = (val: boolean) => {
    if (setIncludeElastography) setIncludeElastography(val);
    else setLocalIncludeElastography(val);
  };
  const handleToggleIncludeBiliary = (val: boolean) => {
    if (setIncludeBiliary) setIncludeBiliary(val);
    else setLocalIncludeBiliary(val);
  };
  const handleToggleIncludeAppendix = (val: boolean) => {
    if (setIncludeAppendix) setIncludeAppendix(val);
    else setLocalIncludeAppendix(val);
  };
  const handleToggleIncludeDiverticulitis = (val: boolean) => {
    if (setIncludeDiverticulitis) setIncludeDiverticulitis(val);
    else setLocalIncludeDiverticulitis(val);
  };
  const handleStiffnessChange = (val: number) => {
    if (setElastographyStiffness) setElastographyStiffness(val);
    else setLocalStiffness(val);
  };
  const handleCAPChange = (val: number) => {
    if (setElastographyCAP) setElastographyCAP(val);
    else setLocalCAP(val);
  };
  const handleAttenuationChange = (val: number) => {
    if (setQusAttenuation) setQusAttenuation(val);
    else setLocalAttenuation(val);
  };
  const handleFatFractionChange = (val: number) => {
    if (setFatFraction) setFatFraction(val);
    else setLocalFatFraction(val);

    const { cap, attenuation } = deriveCAPAndAttFromResult(val);
    if (setElastographyCAP) setElastographyCAP(cap);
    else setLocalCAP(cap);

    if (setQusAttenuation) setQusAttenuation(attenuation);
    else setLocalAttenuation(attenuation);
  };
  const handleStiffnessOverrideChange = (val: string) => {
    if (setStiffnessOverride) setStiffnessOverride(val);
    else setLocalStiffnessOverride(val);
  };
  const handleSteatosisOverrideChange = (val: string) => {
    if (setSteatosisOverride) setSteatosisOverride(val);
    else setLocalSteatosisOverride(val);
  };

  // Dedicated extrahepatic biliary tree states
  const [biliaryForceActive, setBiliaryForceActive] = useState<boolean>(false);
  const [biliaryDilated, setBiliaryDilated] = useState<boolean>(false);
  const [biliaryLitosProximal, setBiliaryLitosProximal] = useState<boolean>(false);
  const [biliaryLitosDistal, setBiliaryLitosDistal] = useState<boolean>(false);
  const [biliaryThickening, setBiliaryThickening] = useState<boolean>(false);
  const [biliaryTumor, setBiliaryTumor] = useState<boolean>(false);
  const [biliaryVesiculaLitos, setBiliaryVesiculaLitos] = useState<boolean>(false);
  const [biliaryVesiculaLitoUnico, setBiliaryVesiculaLitoUnico] = useState<boolean>(false);
  const [biliaryColecistitis, setBiliaryColecistitis] = useState<boolean>(false);
  const [biliaryVesiculaPared, setBiliaryVesiculaPared] = useState<boolean>(false);
  const [biliaryVesiculaBarro, setBiliaryVesiculaBarro] = useState<boolean>(false);
  const [biliaryVesiculaPolipo, setBiliaryVesiculaPolipo] = useState<boolean>(false);
  const [biliaryNotes, setBiliaryNotes] = useState<string>("");
  const isManualBiliaryChangeRef = useRef<boolean>(false);
  const [isVesiculaManuallyOverridden, setIsVesiculaManuallyOverridden] = useState<boolean>(false);
  const [draftState, setDraftState] = useState<string>("");
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [manuallyModifiedOrgans, setManuallyModifiedOrgans] = useState<Record<string, boolean>>({});

  // Dedicated appendix / acute appendicitis states
  const [appendixForceActive, setAppendixForceActive] = useState<boolean>(false);
  const [appendixInflamed, setAppendixInflamed] = useState<boolean>(false);
  const [appendixDiameter, setAppendixDiameter] = useState<number>(5);
  const [appendixFluid, setAppendixFluid] = useState<boolean>(false);
  const [appendixCollections, setAppendixCollections] = useState<boolean>(false);
  const [appendixLito, setAppendixLito] = useState<boolean>(false);
  const [appendixFatStranding, setAppendixFatStranding] = useState<boolean>(false);
  const [appendixNotes, setAppendixNotes] = useState<string>("");

  // Dedicated diverticulitis / acute diverticulitis states
  const [diverticulitisForceActive, setDiverticulitisForceActive] = useState<boolean>(false);
  const [diverticulitisWallThickening, setDiverticulitisWallThickening] = useState<boolean>(false);
  const [diverticulitisDiverticula, setDiverticulitisDiverticula] = useState<boolean>(false);
  const [diverticulitisFatStranding, setDiverticulitisFatStranding] = useState<boolean>(false);
  const [diverticulitisAbscess, setDiverticulitisAbscess] = useState<boolean>(false);
  const [diverticulitisFreeAir, setDiverticulitisFreeAir] = useState<boolean>(false);
  const [diverticulitisHinchey, setDiverticulitisHinchey] = useState<string>("0"); // "0", "Ia", "Ib", "II", "III", "IV"
  const [diverticulitisNotes, setDiverticulitisNotes] = useState<string>("");

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
      // Find the character right after the matched header (like a colon or whitespace)
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

  const isBiliaryPathologyActive = (text: string, posKeywords: string[]): boolean => {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    for (const kw of posKeywords) {
      const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let startIdx = 0;
      while (true) {
        const idx = normalized.indexOf(kwNorm, startIdx);
        if (idx === -1) break;
        
        const contextStart = Math.max(0, idx - 35);
        const context = normalized.substring(contextStart, idx);
        
        const negations = [
          "sin ", "no ", "no se ", "no se observa", "no se aprecia", "ausencia de", 
          "libre de", "descarta", "normal", "conserva", "sin evidencia de", "negativo para",
          "no dilatad", "sin ectasia", "conservado", "sin litiasis"
        ];
        
        const isNegated = negations.some(neg => {
          const negNorm = neg.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return context.includes(negNorm);
        });
        
        if (!isNegated) {
          return true;
        }
        
        startIdx = idx + kw.length;
      }
    }
    
    return false;
  };

  const isBiliaryImpressionActive = (): boolean => {
    if (!generatedReport) return false;
    
    const section = getImpressionTextSection(generatedReport);
    
    const hasDil = isBiliaryPathologyActive(section, ["dilatad", "dilatacion", "ectasia"]);
    const hasThick = isBiliaryPathologyActive(section, ["engrosad", "colangitis", "engrosamiento"]);
    const hasLito = isBiliaryPathologyActive(section, ["lito", "calculo", "concrec", "coledocolitiasis", "enclavado"]);
    const hasTumor = isBiliaryPathologyActive(section, ["tumor", "masa", "neoformacion", "neoformativ", "colangiocarcinoma", "klatskin"]);
    
    // Gallbladder (Vesícula)
    const hasVesiculaLito = isBiliaryPathologyActive(section, ["colelitiasis", "lito en vesicula", "litos en vesicula", "calculo en vesicula", "calculos en vesicula", "litos vesicular", "litiasis vesicular", "lito vesicular", "concreciones en vesicula", "concrecion en vesicula"]);
    const hasVesiculaLitoUnico = isBiliaryPathologyActive(section, ["lito unico", "calculo unico", "unica imagen litiasica", "litiasis unica", "un solo calculo", "concrecion unica"]);
    const hasColecistitis = isBiliaryPathologyActive(section, ["colecistitis", "murphy ecografico", "murphy positivo", "edema de pared vesicular"]);
    const hasVesiculaPared = isBiliaryPathologyActive(section, ["pared de vesicula engrosada", "engrosamiento de pared vesicular", "pared vesicular engrosada", "grosor de pared vesicular"]);
    const hasVesiculaBarro = isBiliaryPathologyActive(section, ["barro biliar", "detritus biliar", "detritus en vesicula", "sludge biliar", "barro en vesicula"]);
    const hasVesiculaPolipo = isBiliaryPathologyActive(section, ["polipo", "polipos", "poliposis", "polipo vesicular", "polipos vesiculares"]);

    return hasDil || hasThick || hasLito || hasTumor || hasVesiculaLito || hasVesiculaLitoUnico || hasColecistitis || hasVesiculaPared || hasVesiculaBarro || hasVesiculaPolipo;
  };

  const isBiliaryActive = isBiliaryImpressionActive() || biliaryForceActive;

  const isAppendixImpressionActive = (): boolean => {
    if (!generatedReport) return false;
    
    const section = getImpressionTextSection(generatedReport);
    
    // Solamente se despliega si se menciona explícitamente "apendicitis" o "apendice cecal inflamado"
    return isBiliaryPathologyActive(section, ["apendicitis", "apendice cecal inflamado", "apendice inflamado"]);
  };

  const isAppendixActive = isAppendixImpressionActive() || appendixForceActive;

  const isDiverticulitisImpressionActive = (): boolean => {
    if (!generatedReport) return false;
    
    const section = getImpressionTextSection(generatedReport);
    
    // Solamente se despliega si se menciona explícitamente "diverticulitis"
    return isBiliaryPathologyActive(section, ["diverticulitis"]);
  };

  const isDiverticulitisActive = isDiverticulitisImpressionActive() || diverticulitisForceActive;

  const getBiliaryTextFromCheckboxes = (
    dilated: boolean,
    thickening: boolean,
    litoProx: boolean,
    litoDist: boolean,
    tumor: boolean,
    vesiculaLitos: boolean,
    colecistitis: boolean,
    vesiculaPared: boolean,
    vesiculaBarro: boolean,
    vesiculaLitoUnico: boolean,
    vesiculaPolipo: boolean
  ): string => {
    // Si tenemos un reporte generado, busquemos obligatoriamente la descripción exacta de la vesícula
    // y de la vía biliar en la impresión diagnóstica para no inventar ninguna frase predefinida.
    let reportVesiculaDesc = "";
    let reportColedocoDesc = "";

    if (generatedReport) {
      reportVesiculaDesc = extractSentenceForOrgan(generatedReport, "vesicula", "");
      reportColedocoDesc = extractSentenceForOrgan(generatedReport, "coledoco", "");
    }

    const segments: string[] = [];
    
    // Gallbladder (Vesícula)
    if (reportVesiculaDesc) {
      segments.push(reportVesiculaDesc);
    } else {
      const vesiculaSegments: string[] = [];
      if (vesiculaLitoUnico) {
        vesiculaSegments.push("colelitiasis única (lito único)");
      } else if (vesiculaLitos) {
        vesiculaSegments.push("colelitiasis (litos múltiples)");
      }
      if (vesiculaBarro) {
        vesiculaSegments.push("barro biliar");
      }
      if (vesiculaPared) {
        vesiculaSegments.push("engrosamiento de pared");
      }
      if (colecistitis) {
        vesiculaSegments.push("colecistitis aguda");
      }
      if (vesiculaPolipo) {
        vesiculaSegments.push("pólipo(s) vesicular(es)");
      }
      
      if (vesiculaSegments.length > 0) {
        segments.push(`Vesícula biliar: ${vesiculaSegments.join(", ")}.`);
      } else {
        segments.push("Vesícula biliar: Normal, de tamaño conservado.");
      }
    }

    // Coledoco / VBE
    if (reportColedocoDesc) {
      segments.push(reportColedocoDesc);
    } else {
      const ductSegments: string[] = [];
      if (dilated) {
        ductSegments.push("dilatación ectásica");
      }
      if (thickening) {
        ductSegments.push("engrosamiento difuso parietal");
      }
      if (litoProx) {
        ductSegments.push("lito proximal");
      }
      if (litoDist) {
        ductSegments.push("lito distal");
      }
      if (tumor) {
        ductSegments.push("lesión sólida / masa");
      }

      if (ductSegments.length > 0) {
        segments.push(`Vía biliar extrahepática: ${ductSegments.join(", ")}.`);
      } else {
        segments.push("Vía biliar extrahepática: Calibre y trayecto conservados.");
      }
    }

    const combined = segments.join(" ");
    return combined.trim();
  };

  const getBiliaryDescription = (
    dilated: boolean,
    thickening: boolean,
    litoProx: boolean,
    litoDist: boolean,
    tumor: boolean,
    vesiculaLitos: boolean,
    colecistitis: boolean,
    vesiculaPared: boolean,
    vesiculaBarro: boolean,
    vesiculaLitoUnico: boolean,
    vesiculaPolipo: boolean
  ): string => {
    if (biliaryNotes && biliaryNotes.trim() !== "") {
      return biliaryNotes;
    }
    return getBiliaryTextFromCheckboxes(
      dilated,
      thickening,
      litoProx,
      litoDist,
      tumor,
      vesiculaLitos,
      colecistitis,
      vesiculaPared,
      vesiculaBarro,
      vesiculaLitoUnico,
      vesiculaPolipo
    );
  };

  const updateReportWithBiliaryDesc = (reportText: string, newDesc: string): string => {
    if (!reportText) return reportText;
    
    const lines = reportText.split("\n");
    let updated = false;
    
    const keywords = ["coledoco", "colédoco", "vía biliar extrahepática", "via biliar extrahepatica", "vbe", "vía biliar", "via biliar", "vesicula", "vesícula"];
    
    const newLines = lines.map(line => {
      if (updated) return line;
      const lowerLine = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasMatch = keywords.some(kw => {
        const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerLine.includes(kwNorm);
      });
      
      if (hasMatch) {
        updated = true;
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const prefix = line.substring(0, colonIndex + 1);
          return `${prefix} ${newDesc}`;
        } else {
          const bulletMatch = line.match(/^[\s*-|#\d.?+•\t]+/);
          const bullet = bulletMatch ? bulletMatch[0] : "- ";
          return `${bullet}Vía Biliar Extrahepática: ${newDesc}`;
        }
      }
      return line;
    });

    if (updated) {
      return newLines.join("\n");
    }

    // Try to find the "Hígado" or "Vesícula" section to append it neatly under
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes("higado") || lower.includes("vesicula")) {
        insertIndex = i + 1;
      }
    }

    if (insertIndex !== -1) {
      const copy = [...lines];
      copy.splice(insertIndex, 0, `- **Vía Biliar Extrahepática**: ${newDesc}`);
      return copy.join("\n");
    }

    return reportText + `\n- **Vía Biliar Extrahepática**: ${newDesc}`;
  };

  const getAppendixDescription = (
    inflamed: boolean,
    diameter: number,
    fluid: boolean,
    collections: boolean,
    lito: boolean,
    fatStranding: boolean
  ): string => {
    if (!inflamed && diameter < 6) {
      return `Apéndice cecal de morfología y situación habitual, sin engrosamiento parietal significativo ni alteraciones en su calibre, con diámetro transverso máximo de ${diameter} mm. No se aprecia líquido libre ni colecciones en fosa ilíaca derecha. Grasa periapendicular de características normales.`;
    }

    const segments: string[] = [];
    segments.push(`apéndice cecal en fosa ilíaca derecha de aspecto francamente inflamatorio, de trayecto distendido y no compresible, que mide ${diameter} mm de diámetro transverso máximo`);
    
    if (lito) {
      segments.push("con presencia de imagen hiperecogénica en su interior de aproximados 4mm compatible con apendicolito obstructivo");
    } else {
      segments.push("con paredes engrosadas, edematosas e hiperémicas al Doppler color");
    }

    if (fatStranding) {
      segments.push("asociado a prominentes cambios inflamatorios con aumento difuso de la ecogenicidad de la grasa periapendicular adyacente");
    }

    if (fluid) {
      segments.push("asociado a escaso a moderado líquido libre pericecal");
    }

    if (collections) {
      segments.push("identificándose colección líquida tabicada y de paredes gruesas en la vecindad inmediata compatible con absceso periapendicular en formación");
    }

    const combined = segments.join(", ");
    return combined.charAt(0).toUpperCase() + combined.slice(1) + ".";
  };

  const updateReportWithAppendixDesc = (reportText: string, newDesc: string): string => {
    if (!reportText) return reportText;
    
    const lines = reportText.split("\n");
    let updated = false;
    
    const keywords = ["apendice cecal", "apéndice cecal", "apendice", "apéndice", "fosa iliaca derecha", "fosa ilíaca derecha", "fid"];
    
    const newLines = lines.map(line => {
      if (updated) return line;
      const lowerLine = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasMatch = keywords.some(kw => {
        const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerLine.includes(kwNorm);
      });
      
      if (hasMatch) {
        updated = true;
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const prefix = line.substring(0, colonIndex + 1);
          return `${prefix} ${newDesc}`;
        } else {
          const bulletMatch = line.match(/^[\s*-|#\d.?+•\t]+/);
          const bullet = bulletMatch ? bulletMatch[0] : "- ";
          return `${bullet}Apéndice Cecal: ${newDesc}`;
        }
      }
      return line;
    });

    if (updated) {
      return newLines.join("\n");
    }

    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes("colon ") || lower.includes("colon:")) {
        insertIndex = i + 1;
      }
    }

    if (insertIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (lower.includes("vejiga") || lower.includes("utero") || lower.includes("prostata")) {
          insertIndex = i + 1;
        }
      }
    }

    if (insertIndex !== -1) {
      const copy = [...lines];
      copy.splice(insertIndex, 0, `- **Apéndice Cecal**: ${newDesc}`);
      return copy.join("\n");
    }

    return reportText + `\n- **Apéndice Cecal**: ${newDesc}`;
  };

  const getDiverticulitisDescription = (
    thickening: boolean,
    diverticula: boolean,
    fatStranding: boolean,
    abscess: boolean,
    freeAir: boolean,
    hinchey: string
  ): string => {
    if (!thickening && !diverticula && !fatStranding && !abscess && !freeAir && hinchey === "0") {
      return "Colon izquierdo y sigmoides de características habituales, de calibre y grosor parietal conservados, sin evidencia de cambios inflamatorios pericólicos ni sáculos diverticulares significativos.";
    }

    const segments: string[] = [];
    if (diverticula) {
      segments.push("múltiples formaciones saculares / divertículos herniados a través de las capas musculares de colon izquierdo y sigmoides");
    } else {
      segments.push("segmento de colon izquierdo y sigmoides");
    }

    if (thickening) {
      segments.push("con franco engrosamiento parietal circunferencial de tipo inflamatorio");
    }

    if (fatStranding) {
      segments.push("asociado a marcada alteración con aumento de la ecogenicidad de la grasa pericólica circundante, compatible con cambios inflamatorios flemónicos (diverticulitis)");
    }

    if (abscess || hinchey === "Ib" || hinchey === "II") {
      if (hinchey === "Ib") {
        segments.push("identificándose pequeña colección líquida tabicada pericólica de aproximados 3cm compatible con absceso pericólico localizado (Hinchey Ib)");
      } else if (hinchey === "II") {
        segments.push("identificándose colección líquida tabicada pélvica a distancia compatible con absceso pélvico / retroperitoneal (Hinchey II)");
      } else {
        segments.push("asociado a colección líquida perilesional organizada compatible con absceso pericólico");
      }
    }

    if (freeAir || hinchey === "III" || hinchey === "IV") {
      if (hinchey === "III") {
        segments.push("asociado a neumoperitoneo localizado y abundante líquido libre tabicado pericólico compatible con peritonitis purulenta localizada o generalizada (Hinchey III)");
      } else if (hinchey === "IV") {
        segments.push("con franco neumoperitoneo persistente secundario a perforación diverticular libre y signos de colecciones fétidas generalizadas sugestivo de peritonitis fecaloide (Hinchey IV)");
      } else {
        segments.push("con presencia de neumoperitoneo secundario a microperforación extraluminal");
      }
    } else if (hinchey === "Ia" && !fatStranding) {
      segments.push("compatible con flemón pericólico localizado sin formación de abscesos (Hinchey Ia)");
    } else if (hinchey === "Ia") {
      segments.push("clasificado en fase Hinchey Ia (flemón pericólico)");
    }

    const combined = segments.join(", ");
    return combined.charAt(0).toUpperCase() + combined.slice(1) + ".";
  };

  const updateReportWithDiverticulitisDesc = (reportText: string, newDesc: string): string => {
    if (!reportText) return reportText;
    
    const lines = reportText.split("\n");
    let updated = false;
    
    const keywords = ["diverticulitis", "diverticulo", "diverticulos", "colon izquierdo", "sigmoides", "hinchey"];
    
    const newLines = lines.map(line => {
      if (updated) return line;
      const lowerLine = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasMatch = keywords.some(kw => {
        const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerLine.includes(kwNorm);
      });
      
      if (hasMatch) {
        updated = true;
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const prefix = line.substring(0, colonIndex + 1);
          return `${prefix} ${newDesc}`;
        } else {
          const bulletMatch = line.match(/^[\s*-|#\d.?+•\t]+/);
          const bullet = bulletMatch ? bulletMatch[0] : "- ";
          return `${bullet}Diverticulitis Aguda: ${newDesc}`;
        }
      }
      return line;
    });

    if (updated) {
      return newLines.join("\n");
    }

    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes("colon ") || lower.includes("colon:")) {
        insertIndex = i + 1;
      }
    }

    if (insertIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (lower.includes("vejiga") || lower.includes("utero") || lower.includes("prostata")) {
          insertIndex = i + 1;
        }
      }
    }

    if (insertIndex !== -1) {
      const copy = [...lines];
      copy.splice(insertIndex, 0, `- **Diverticulitis Aguda / Sigmoides**: ${newDesc}`);
      return copy.join("\n");
    }

    return reportText + `\n- **Diverticulitis Aguda / Sigmoides**: ${newDesc}`;
  };

  const handleBiliaryCheckboxChange = (
    field: "dilated" | "thickening" | "litosProx" | "litosDist" | "tumor" | "vesiculaLitos" | "vesiculaLitoUnico" | "colecistitis" | "vesiculaPared" | "vesiculaBarro" | "vesiculaPolipo",
    value: boolean
  ) => {
    isManualBiliaryChangeRef.current = true;
    setIsVesiculaManuallyOverridden(false);
    setBiliaryNotes(""); // Clear user manual text override when changing a checkbox state so it regenerates
    if (field === "dilated") setBiliaryDilated(value);
    if (field === "thickening") setBiliaryThickening(value);
    if (field === "litosProx") setBiliaryLitosProximal(value);
    if (field === "litosDist") setBiliaryLitosDistal(value);
    if (field === "tumor") setBiliaryTumor(value);
    if (field === "vesiculaLitos") {
      setBiliaryVesiculaLitos(value);
      if (value) {
        setBiliaryVesiculaLitoUnico(false);
      }
    }
    if (field === "vesiculaLitoUnico") {
      setBiliaryVesiculaLitoUnico(value);
      if (value) {
        setBiliaryVesiculaLitos(false);
      }
    }
    if (field === "colecistitis") setBiliaryColecistitis(value);
    if (field === "vesiculaPared") setBiliaryVesiculaPared(value);
    if (field === "vesiculaBarro") setBiliaryVesiculaBarro(value);
    if (field === "vesiculaPolipo") setBiliaryVesiculaPolipo(value);

    if (value && !biliaryForceActive) {
      setBiliaryForceActive(true);
    }
  };

  const handleToggleBiliaryForceActive = () => {
    isManualBiliaryChangeRef.current = true;
    setIsVesiculaManuallyOverridden(false);
    setBiliaryNotes(""); // Reset notes
    const nextForceActive = !biliaryForceActive;
    setBiliaryForceActive(nextForceActive);

    if (!nextForceActive) {
      setBiliaryDilated(false);
      setBiliaryThickening(false);
      setBiliaryLitosProximal(false);
      setBiliaryLitosDistal(false);
      setBiliaryTumor(false);
      setBiliaryVesiculaLitos(false);
      setBiliaryColecistitis(false);
      setBiliaryVesiculaPared(false);
      setBiliaryVesiculaBarro(false);
    }
  };

  const handleAppendixCheckboxChange = (field: "inflamed" | "fluid" | "collections" | "lito" | "fatStranding", value: boolean) => {
    let nextInflamed = field === "inflamed" ? value : appendixInflamed;
    const nextFluid = field === "fluid" ? value : appendixFluid;
    const nextCollections = field === "collections" ? value : appendixCollections;
    const nextLito = field === "lito" ? value : appendixLito;
    const nextFatStranding = field === "fatStranding" ? value : appendixFatStranding;
    let nextDiameter = appendixDiameter;

    if (field === "inflamed") {
      setAppendixInflamed(value);
      if (value && appendixDiameter < 6) {
        setAppendixDiameter(8);
        nextDiameter = 8;
      } else if (!value) {
        setAppendixDiameter(5);
        nextDiameter = 5;
      }
    }
    if (field === "fluid") setAppendixFluid(value);
    if (field === "collections") setAppendixCollections(value);
    if (field === "lito") setAppendixLito(value);
    if (field === "fatStranding") setAppendixFatStranding(value);

    // Auto-active force if checkbox is checked
    if (value && !appendixForceActive) {
      setAppendixForceActive(true);
    }

    const newDesc = getAppendixDescription(nextInflamed, nextDiameter, nextFluid, nextCollections, nextLito, nextFatStranding);
    if (onChangeReport && generatedReport) {
      const updatedReport = updateReportWithAppendixDesc(generatedReport, newDesc);
      onChangeReport(updatedReport);
    }
  };

  const handleAppendixDiameterChange = (val: number) => {
    setAppendixDiameter(val);
    const nextInflamed = val >= 6 ? true : appendixInflamed;
    if (val >= 6 && !appendixInflamed) {
      setAppendixInflamed(true);
    } else if (val < 6 && appendixInflamed) {
      setAppendixInflamed(false);
    }

    if (!appendixForceActive) {
      setAppendixForceActive(true);
    }

    const newDesc = getAppendixDescription(val >= 6 ? true : appendixInflamed, val, appendixFluid, appendixCollections, appendixLito, appendixFatStranding);
    if (onChangeReport && generatedReport) {
      const updatedReport = updateReportWithAppendixDesc(generatedReport, newDesc);
      onChangeReport(updatedReport);
    }
  };

  const handleToggleAppendixForceActive = () => {
    const nextForceActive = !appendixForceActive;
    setAppendixForceActive(nextForceActive);

    if (!nextForceActive) {
      setAppendixInflamed(false);
      setAppendixDiameter(5);
      setAppendixFluid(false);
      setAppendixCollections(false);
      setAppendixLito(false);
      setAppendixFatStranding(false);

      const normalDesc = getAppendixDescription(false, 5, false, false, false, false);
      if (onChangeReport && generatedReport) {
        const updatedReport = updateReportWithAppendixDesc(generatedReport, normalDesc);
        onChangeReport(updatedReport);
      }
    } else {
      const currentDesc = getAppendixDescription(appendixInflamed, appendixDiameter, appendixFluid, appendixCollections, appendixLito, appendixFatStranding);
      if (onChangeReport && generatedReport) {
        const updatedReport = updateReportWithAppendixDesc(generatedReport, currentDesc);
        onChangeReport(updatedReport);
      }
    }
  };

  const handleDiverticulitisCheckboxChange = (field: "thickening" | "diverticula" | "fatStranding" | "abscess" | "freeAir", value: boolean) => {
    const nextThickening = field === "thickening" ? value : diverticulitisWallThickening;
    const nextDiverticula = field === "diverticula" ? value : diverticulitisDiverticula;
    const nextFatStranding = field === "fatStranding" ? value : diverticulitisFatStranding;
    let nextAbscess = field === "abscess" ? value : diverticulitisAbscess;
    let nextFreeAir = field === "freeAir" ? value : diverticulitisFreeAir;
    let nextHinchey = diverticulitisHinchey;

    if (field === "thickening") setDiverticulitisWallThickening(value);
    if (field === "diverticula") setDiverticulitisDiverticula(value);
    if (field === "fatStranding") setDiverticulitisFatStranding(value);

    if (field === "abscess") {
      setDiverticulitisAbscess(value);
      if (value && nextHinchey === "0") {
        setDiverticulitisHinchey("Ib");
        nextHinchey = "Ib";
      } else if (!value && (nextHinchey === "Ib" || nextHinchey === "II")) {
        setDiverticulitisHinchey("0");
        nextHinchey = "0";
      }
    }

    if (field === "freeAir") {
      setDiverticulitisFreeAir(value);
      if (value && nextHinchey === "0") {
        setDiverticulitisHinchey("III");
        nextHinchey = "III";
      } else if (!value && (nextHinchey === "III" || nextHinchey === "IV")) {
        setDiverticulitisHinchey("0");
        nextHinchey = "0";
      }
    }

    // Auto-active force if checkbox is checked
    if (value && !diverticulitisForceActive) {
      setDiverticulitisForceActive(true);
    }

    const newDesc = getDiverticulitisDescription(nextThickening, nextDiverticula, nextFatStranding, nextAbscess, nextFreeAir, nextHinchey);
    if (onChangeReport && generatedReport) {
      const updatedReport = updateReportWithDiverticulitisDesc(generatedReport, newDesc);
      onChangeReport(updatedReport);
    }
  };

  const handleDiverticulitisHincheyChange = (val: string) => {
    setDiverticulitisHinchey(val);
    
    let nextAbscess = diverticulitisAbscess;
    let nextFreeAir = diverticulitisFreeAir;
    let nextThickening = diverticulitisWallThickening;
    let nextFatStranding = diverticulitisFatStranding;
    let nextDiverticula = diverticulitisDiverticula;

    if (val !== "0") {
      nextThickening = true;
      setDiverticulitisWallThickening(true);
      nextFatStranding = true;
      setDiverticulitisFatStranding(true);
      nextDiverticula = true;
      setDiverticulitisDiverticula(true);
    }

    if (val === "Ib" || val === "II") {
      nextAbscess = true;
      setDiverticulitisAbscess(true);
    } else if (val === "0" || val === "Ia") {
      nextAbscess = false;
      setDiverticulitisAbscess(false);
    }

    if (val === "III" || val === "IV") {
      nextFreeAir = true;
      setDiverticulitisFreeAir(true);
    } else {
      nextFreeAir = false;
      setDiverticulitisFreeAir(false);
    }

    if (val !== "0" && !diverticulitisForceActive) {
      setDiverticulitisForceActive(true);
    }

    const newDesc = getDiverticulitisDescription(nextThickening, nextDiverticula, nextFatStranding, nextAbscess, nextFreeAir, val);
    if (onChangeReport && generatedReport) {
      const updatedReport = updateReportWithDiverticulitisDesc(generatedReport, newDesc);
      onChangeReport(updatedReport);
    }
  };

  const handleToggleDiverticulitisForceActive = () => {
    const nextForceActive = !diverticulitisForceActive;
    setDiverticulitisForceActive(nextForceActive);

    if (!nextForceActive) {
      setDiverticulitisWallThickening(false);
      setDiverticulitisDiverticula(false);
      setDiverticulitisFatStranding(false);
      setDiverticulitisAbscess(false);
      setDiverticulitisFreeAir(false);
      setDiverticulitisHinchey("0");

      const normalDesc = getDiverticulitisDescription(false, false, false, false, false, "0");
      if (onChangeReport && generatedReport) {
        const updatedReport = updateReportWithDiverticulitisDesc(generatedReport, normalDesc);
        onChangeReport(updatedReport);
      }
    } else {
      const currentDesc = getDiverticulitisDescription(diverticulitisWallThickening, diverticulitisDiverticula, diverticulitisFatStranding, diverticulitisAbscess, diverticulitisFreeAir, diverticulitisHinchey);
      if (onChangeReport && generatedReport) {
        const updatedReport = updateReportWithDiverticulitisDesc(generatedReport, currentDesc);
        onChangeReport(updatedReport);
      }
    }
  };

  const syncBiliaryFromReport = (reportText: string, forceSync: boolean = false) => {
    if (!reportText) return;
    
    if (forceSync) {
      setIsVesiculaManuallyOverridden(false);
      setManuallyModifiedOrgans(prev => ({ ...prev, vesicula: false }));
    }
    
    // Si fue de forma manual desde el modulo de via biliar, y no estamos forzando la sincronizacion, omitimos
    if (isManualBiliaryChangeRef.current && !forceSync) {
      isManualBiliaryChangeRef.current = false;
      return;
    }

    const section = getImpressionTextSection(reportText);
    const normalized = section.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Para ver si es biliar activa en el reporte
    const hasDilTmp = isBiliaryPathologyActive(section, ["dilatad", "dilatacion", "ectasia"]);
    const hasThickTmp = isBiliaryPathologyActive(section, ["engrosad", "colangitis", "engrosamiento"]);
    const hasLitoTmp = isBiliaryPathologyActive(section, ["lito", "calculo", "concrec", "coledocolitiasis", "enclavado"]);
    const hasTumorTmp = isBiliaryPathologyActive(section, ["tumor", "masa", "neoformacion", "neoformativ", "colangiocarcinoma", "klatskin"]);
    const hasVesLitoTmp = isBiliaryPathologyActive(section, ["colelitiasis", "lito en vesicula", "litos en vesicula", "calculo en vesicula", "calculos en vesicula", "litos vesicular", "litiasis vesicular", "lito vesicular", "concreciones en vesicula", "concrecion en vesicula"]);
    const hasVesLitoUnicoTmp = isBiliaryPathologyActive(section, ["lito unico", "calculo unico", "unica imagen litiasica", "litiasis unica", "un solo calculo", "concrecion unica"]);
    const hasColTmp = isBiliaryPathologyActive(section, ["colecistitis", "murphy ecografico", "murphy positivo", "edema de pared vesicular"]);
    const hasVesParedTmp = isBiliaryPathologyActive(section, ["pared de vesicula engrosada", "engrosamiento de pared vesicular", "pared vesicular engrosada", "grosor de pared vesicular"]);
    const hasVesBarroTmp = isBiliaryPathologyActive(section, ["barro biliar", "detritus biliar", "detritus en vesicula", "sludge biliar", "barro en vesicula"]);
    const hasVesPolipoTmp = isBiliaryPathologyActive(section, ["polipo", "polipos", "poliposis", "polipo vesicular", "polipos vesiculares"]);

    const isBiliActive = hasDilTmp || hasThickTmp || hasLitoTmp || hasTumorTmp || hasVesLitoTmp || hasVesLitoUnicoTmp || hasColTmp || hasVesParedTmp || hasVesBarroTmp || hasVesPolipoTmp;
    
    if (isBiliActive) {
      // 1. Dilatación
      setBiliaryDilated(hasDilTmp);
      
      // 2. Engrosamiento de paredes (Vía biliar / colédoco)
      setBiliaryThickening(hasThickTmp);
      
      // 3. Tumoraciones
      setBiliaryTumor(hasTumorTmp);
      
      // 4. Litos en colédoco / conductos
      if (hasLitoTmp) {
        if (normalized.includes("distal") || normalized.includes("meato") || normalized.includes("vater") || normalized.includes("duoden") || normalized.includes("pancreatica") || normalized.includes("ampolla")) {
          setBiliaryLitosDistal(true);
          setBiliaryLitosProximal(false);
        } else if (normalized.includes("proximal") || normalized.includes("comun") || normalized.includes("hiliar") || normalized.includes("portae")) {
          setBiliaryLitosProximal(true);
          setBiliaryLitosDistal(false);
        } else {
          setBiliaryLitosDistal(true);
          setBiliaryLitosProximal(false);
        }
      } else {
        setBiliaryLitosProximal(false);
        setBiliaryLitosDistal(false);
      }

      // 5. Hallazgos en Vesícula (Litos en Vesícula / Lito único)
      if (hasVesLitoUnicoTmp) {
        setBiliaryVesiculaLitoUnico(true);
        setBiliaryVesiculaLitos(false);
      } else {
        setBiliaryVesiculaLitoUnico(false);
        setBiliaryVesiculaLitos(hasVesLitoTmp);
      }

      // 6. Colecistitis Aguda
      setBiliaryColecistitis(hasColTmp);

      // 7. Engrosamiento de pared vesicular
      setBiliaryVesiculaPared(hasVesParedTmp);

      // 8. Barro biliar
      setBiliaryVesiculaBarro(hasVesBarroTmp);

      // 9. Pólipo vesicular
      setBiliaryVesiculaPolipo(hasVesPolipoTmp);

      // Sync exact extracted sentence in biliaryNotes
      const matchedSentence = extractSentenceForOrgan(reportText, "vesicula", "");
      if (matchedSentence) {
        setBiliaryNotes(matchedSentence);
      }

    } else {
      // If report is completely clear and not forced manually, we reset all checkbox states
      if (!biliaryForceActive || forceSync) {
        setBiliaryDilated(false);
        setBiliaryThickening(false);
        setBiliaryLitosProximal(false);
        setBiliaryLitosDistal(false);
        setBiliaryTumor(false);
        setBiliaryVesiculaLitos(false);
        setBiliaryVesiculaLitoUnico(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryVesiculaPolipo(false);
      }
    }
  };

  // Auto-extraction hook from generated report text
  useEffect(() => {
    syncBiliaryFromReport(generatedReport);
  }, [generatedReport, biliaryForceActive]);

  // Sincroniza el estado complejo/detallado de la vía biliar y vesícula interactiva
  // de vuelta a la estructura estándar "vesicula" para actualizar en tiempo real el mapa general de hallazgos (tarjeta de sinopsis)
  useEffect(() => {
    if (isBiliaryActive) {
      let newState = "normal";
      if (biliaryColecistitis) {
        newState = "colecistitis_aguda";
      } else if (biliaryVesiculaLitoUnico) {
        newState = "litiasis_unica";
      } else if (biliaryVesiculaLitos) {
        newState = "litiasis";
      } else if (biliaryVesiculaPolipo) {
        newState = "polipo";
      } else if (biliaryVesiculaBarro) {
        newState = "barro_biliar";
      } else if (biliaryVesiculaPared) {
        newState = "pared_engrosada";
      } else if (biliaryDilated || biliaryThickening || biliaryLitosProximal || biliaryLitosDistal || biliaryTumor) {
        newState = "litiasis"; // Para que califique como alteración activa en la tarjeta de sinopsis
      }

      const newDesc = biliaryNotes && biliaryNotes.trim() !== ""
        ? biliaryNotes
        : getBiliaryTextFromCheckboxes(
            biliaryDilated,
            biliaryThickening,
            biliaryLitosProximal,
            biliaryLitosDistal,
            biliaryTumor,
            biliaryVesiculaLitos,
            biliaryColecistitis,
            biliaryVesiculaPared,
            biliaryVesiculaBarro,
            biliaryVesiculaLitoUnico,
            biliaryVesiculaPolipo
          );

      setStates(prev => {
        if (prev.vesicula === newState) return prev;
        return { ...prev, vesicula: newState };
      });

      setCustomDescriptions(prev => {
        if (prev.vesicula === newDesc) return prev;
        return { ...prev, vesicula: newDesc };
      });
    } else {
      setStates(prev => {
        if (prev.vesicula === "normal" || prev.vesicula === "no_descrito") return prev;
        return { ...prev, vesicula: "no_descrito" };
      });
      setCustomDescriptions(prev => {
        if (prev.vesicula === "Dentro de límites normales." || prev.vesicula === "No mencionado / No descrito.") return prev;
        return { ...prev, vesicula: "No mencionado / No descrito." };
      });
    }
  }, [
    isBiliaryActive,
    biliaryDilated,
    biliaryThickening,
    biliaryLitosProximal,
    biliaryLitosDistal,
    biliaryTumor,
    biliaryVesiculaLitos,
    biliaryVesiculaLitoUnico,
    biliaryColecistitis,
    biliaryVesiculaPared,
    biliaryVesiculaBarro,
    biliaryVesiculaPolipo,
    biliaryNotes
  ]);

  // Auto-extraction hook for appendix / appendicitis from generated report text
  useEffect(() => {
    if (!generatedReport) return;
    const section = getImpressionTextSection(generatedReport);
    
    if (isAppendixActive) {
      const hasInflam = isBiliaryPathologyActive(section, ["apendicitis", "inflado", "inflamado", "distendido", "edema", "engrosamiento"]);
      setAppendixInflamed(hasInflam || isBiliaryPathologyActive(section, ["diametro de 6", "diametro de 7", "diametro de 8", "diametro de 9", "diametro de 10", "diametro de 11", "diametro de 12", "diametro de 13", "diametro de 14", "diametro de 15"]));

      const matches = section.match(/(\d+)\s*mm/);
      if (matches && matches[1]) {
        const parsedVal = parseInt(matches[1], 10);
        if (parsedVal >= 4 && parsedVal <= 18) {
          setAppendixDiameter(parsedVal);
        }
      } else {
        if (hasInflam) {
          setAppendixDiameter(8);
        }
      }

      const hasFluid = isBiliaryPathologyActive(section, ["liquido libre", "volumen libre", "derrame periapendicular", "pericecal", "liquido en fosa"]);
      setAppendixFluid(hasFluid);

      const hasCollections = isBiliaryPathologyActive(section, ["coleccion", "absceso", "plastron"]);
      setAppendixCollections(hasCollections);

      const hasLito = isBiliaryPathologyActive(section, ["apendicolito", "apendicocolito", "lito", "concrecion"]);
      setAppendixLito(hasLito);

      const hasFat = isBiliaryPathologyActive(section, ["grasa periapendicular", "infiltracion de la grasa", "engrosamiento de la grasa", "cambios inflamatorios de la grasa", "grasa adyacente"]);
      setAppendixFatStranding(hasFat);
    } else {
      setAppendixInflamed(false);
      setAppendixDiameter(5);
      setAppendixFluid(false);
      setAppendixCollections(false);
      setAppendixLito(false);
      setAppendixFatStranding(false);
    }
  }, [generatedReport, isAppendixActive]);

  // Auto-extraction hook for diverticulitis from generated report text
  useEffect(() => {
    if (!generatedReport) return;
    const section = getImpressionTextSection(generatedReport);
    
    if (isDiverticulitisActive) {
      const hasThickening = isBiliaryPathologyActive(section, ["engrosado", "engrosamiento", "pared engrosada", "grosor de", "grosor parietal"]);
      setDiverticulitisWallThickening(hasThickening);

      const hasDiverticula = isBiliaryPathologyActive(section, ["diverticulo", "diverticulos", "saculo", "saculos", "formaciones saculares"]);
      setDiverticulitisDiverticula(hasDiverticula);

      const hasFat = isBiliaryPathologyActive(section, ["grasa pericólica", "grasa pericolic", "grasa adyacente", "fat stranding", "infiltracion de la grasa", "cambios inflamatorios de la grasa"]);
      setDiverticulitisFatStranding(hasFat);

      const hasAbscess = isBiliaryPathologyActive(section, ["absceso", "coleccion", "colección líquida"]);
      setDiverticulitisAbscess(hasAbscess);

      const hasFreeAir = isBiliaryPathologyActive(section, ["perforacion", "neumoperitoneo", "perforado", "gas libre", "aire libre"]);
      setDiverticulitisFreeAir(hasFreeAir);

      const secLower = section.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (secLower.includes("hinchey iv") || secLower.includes("hinchey 4")) {
        setDiverticulitisHinchey("IV");
      } else if (secLower.includes("hinchey iii") || secLower.includes("hinchey 3")) {
        setDiverticulitisHinchey("III");
      } else if (secLower.includes("hinchey iib") || secLower.includes("hinchey 2b") || secLower.includes("hinchey ii") || secLower.includes("hinchey 2")) {
        setDiverticulitisHinchey("II");
      } else if (secLower.includes("hinchey ib") || secLower.includes("hinchey 1b")) {
        setDiverticulitisHinchey("Ib");
      } else if (secLower.includes("hinchey ia") || secLower.includes("hinchey 1a")) {
        setDiverticulitisHinchey("Ia");
      } else {
        if (hasFreeAir) {
          setDiverticulitisHinchey("III");
        } else if (hasAbscess) {
          setDiverticulitisHinchey("Ib");
        } else if (hasThickening || hasFat) {
          setDiverticulitisHinchey("Ia");
        } else {
          setDiverticulitisHinchey("0");
        }
      }
    } else {
      setDiverticulitisWallThickening(false);
      setDiverticulitisDiverticula(false);
      setDiverticulitisFatStranding(false);
      setDiverticulitisAbscess(false);
      setDiverticulitisFreeAir(false);
      setDiverticulitisHinchey("0");
    }
  }, [generatedReport, isDiverticulitisActive]);

  const getFibrosisLevel = (stiffness: number, override: string): number => {
    if (override && override !== "auto") {
      if (override === "F0-F1") return 1;
      if (override === "F2") return 2;
      if (override === "F3") return 3;
      if (override === "F4") return 4;
    }
    if (stiffness < 6.0) return 1;
    if (stiffness < 8.0) return 2;
    if (stiffness < 12.5) return 3;
    return 4;
  };

  const getSteatosisLevel = (cap: number, override: string): number => {
    if (override && override !== "auto") {
      if (override === "S0") return 0;
      if (override === "S1") return 1;
      if (override === "S2") return 2;
      if (override === "S3") return 3;
    }
    if (cap < 238) return 0;
    if (cap < 260) return 1;
    if (cap < 290) return 2;
    return 3;
  };

  const deriveCAPAndAttFromResult = (fat: number) => {
    let cap = 230;
    if (fat <= 5.0) {
      cap = 150 + (fat - 1) * (88 / 4);
    } else if (fat <= 12.0) {
      cap = 238 + (fat - 5) * (22 / 7);
    } else if (fat <= 22.0) {
      cap = 260 + (fat - 12) * (30 / 10);
    } else {
      cap = 290 + (fat - 22) * (110 / 18);
    }

    let att = 0.55;
    if (fat <= 5.0) {
      att = 0.30 + (fat - 1) * (0.28 / 4);
    } else if (fat <= 22.0) {
      att = 0.58 + (fat - 5) * (0.20 / 17);
    } else {
      att = 0.78 + (fat - 22) * (0.42 / 18);
    }

    return { cap: Math.round(cap), attenuation: parseFloat(att.toFixed(2)) };
  };

  const applyPreset = (stiffness: number, cap: number, attenuation: number, fat: number) => {
    handleStiffnessChange(stiffness);
    handleFatFractionChange(fat);
    if (setElastographyHasStiffness) {
      setElastographyHasStiffness(true);
    } else {
      setLocalHasStiffness(true);
    }
  };

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

  // Sync draftState and draftDescription with actual state when active organ selection or saved states change.
  useEffect(() => {
    if (selectedStructure) {
      setDraftState(states[selectedStructure] || "no_descrito");
      setDraftDescription(customDescriptions[selectedStructure] || "");
    }
  }, [selectedStructure, states, customDescriptions]);

  // Extract the exact sentence from the "Impresión Diagnóstica" mentioning keywords for a given organ
  const extractSentenceForOrgan = (reportText: string, organId: string, fallback: string): string => {
    if (!reportText) return fallback;
    const section = getImpressionTextSection(reportText);
    if (!section) return fallback;
    
    // Split section into sentences/clauses
    const sentences = section.split(/(?:\.|\n|\r|;)+/);
    
    // Map organId to its main keywords
    const keywordsMap: Record<string, string[]> = {
      higado: ["higado", "hepatico", "parenquima", "esteatosis", "hepatomegalia", "cirrosis", "quiste", "solida", "nodulo", "lobulo"],
      vesicula: ["vesicula", "colecist", "biliar", "litiasis", "lito", "calculo", "barro", "barro biliar", "asiento", "pared vesicular", "pared de vesicula", "sludge", "polipo", "concrecion", "coledoco"],
      pancreas: ["pancreas", "pancreatico", "pancreatitis", "wirsung", "cabeza", "cuerpo", "cola", "atrofia", "quistica", "gas"],
      bazo: ["bazo", "esplenico", "esplenomegalia", "nodulo"],
      rinon_derecho: ["rinon derecho", "rd ", "renal derecho", "r. derecho"],
      rinon_izquierdo: ["rinon izquierdo", "ri ", "renal izquierdo", "r. izquierdo"],
      vejiga: ["vejiga", "vesical", "sedimento", "replecion", "replección"],
      prostata: ["prostata", "prostatic", "hpb", "calcificaciones", "glandula"],
      utero: ["utero", "uterino", "miometrio", "endometrio", "mioma"],
      ovarios: ["ovario", "anexial", "folicular", "quiste anexial"],
      psoas: ["psoas", "musculo psoas", "músculo psoas"],
      colon: ["colon", "marcobase", "meteorismo", "gas intestinal", "ciego", "sigmoides"],
      pared_linea_alba: ["linea alba", "epigastrio", "epigastrica", "diastasis rectos"],
      pared_umbilical: ["umbilical", "ombligo", "hernia umbilical"],
      pared_inguinal_derecha: ["inguinal derecha", "ing_derech", "conducto inguinal derecho", "hernia inguinal derecha"],
      pared_inguinal_izquierda: ["inguinal izquierda", "ing_izquierd", "conducto inguinal izquierdo", "hernia inguinal izquierda"],
      pared_muscular: ["pared anterior", "musculo recto", "músculo recto", "recto abdominal", "pared muscular", "oblicuo", "spiegel", "desmoide"],
      suprarenales: ["suprarrenal", "adrenal", "suprarenal", "glandulas suprarrenales"],
      retroperitoneo: ["retroperitoneo", "retroperitoneal", "adenopatia retroperitoneal", "ganglios retroperitoneales"]
    };
    
    const kws = keywordsMap[organId] || [];
    if (kws.length === 0) return fallback;
    
    // Find the first sentence that matches any keyword
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      
      const normalizedSentence = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matches = kws.some(kw => {
        const normalizedKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedSentence.includes(normalizedKw);
      });
      
      if (matches) {
        // Return the clean sentence with a trailing period if it doesn't have one
        const cleanStr = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        return cleanStr.endsWith(".") ? cleanStr : `${cleanStr}.`;
      }
    }
    
    return fallback;
  };

  // Transactional Manual Save function of drafts to permanent states
  const handleConfirmManualChanges = () => {
    if (!selectedStructure) return;
    
    // Write permanently
    setStates(prev => ({ ...prev, [selectedStructure]: draftState }));
    setCustomDescriptions(prev => ({ ...prev, [selectedStructure]: draftDescription }));
    
    // Mark as manually modified so that dynamic effects know not to touch it
    setManuallyModifiedOrgans(prev => ({ ...prev, [selectedStructure]: true }));

    // Real-time synchronization for Biliary Tract checkboxes and note state
    if (selectedStructure === "vesicula") {
      setIsVesiculaManuallyOverridden(true);
      
      const s = draftState;
      if (s === "litiasis") {
        setBiliaryVesiculaLitos(true);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "colecistitis_aguda") {
        setBiliaryColecistitis(true);
        setBiliaryVesiculaLitos(true);
        setBiliaryVesiculaPared(true);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "barro_biliar") {
        setBiliaryVesiculaBarro(true);
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryForceActive(true);
      } else if (s === "pared_engrosada") {
        setBiliaryVesiculaPared(true);
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "normal" || s === "no_descrito") {
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(false);
      }
      setBiliaryNotes(draftDescription);
    }
    
    setSyncLogs(prev => [...prev, `💾 Guardado manual: ${getActiveStructureLabel()} actualizado a "${draftState.toUpperCase()}"`]);
  };

  const getSimplifiedDescription = (id: string, stateInput?: string): string => {
    const s = stateInput || states[id] || "no_descrito";
    if (!s || s === "no_descrito") {
      return "No mencionado / No descrito.";
    }
    if (s === "normal") {
      return "Dentro de límites normales.";
    }
    const standardStates = [
      "normal", "no_descrito", "esteatosis_leve", "esteatosis_moderada", "esteatosis_severa", "hepatomegalia",
      "cirrosis", "lesion_ocupante_espacio", "quiste", "litiasis", "litiasis_unica", "barro_biliar", "colecistitis_aguda",
      "colecistitis_cronica", "polipo", "pared_engrosada", "ectasia_biliar", "dilatacion_coledoco",
      "quistes_corticales", "perdida_relacion_corticomedular", "nefrolitiasis", "quiste_simple", "hidronefrosis",
      "esplenomegalia", "lesion_focal", "pancreatitis_aguda", "compromiso_atrofico", "calcificaciones",
      "derrame_libre", "coleccion_organizada", "adenopatias", "ectasia_aortica", "aneurisma_fusiforme", "placas_calcificadas"
    ];
    if (!standardStates.includes(s)) {
      return `Se describe hallazgo: ${s.charAt(0).toUpperCase() + s.slice(1)}.`;
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
        if (s === "litiasis") return "Colelitiasis (litos múltiples).";
        if (s === "litiasis_unica") return "Colelitiasis única (lito único).";
        if (s === "barro_biliar") return "Barro biliar.";
        if (s === "colecistitis_aguda") return "Colecistitis aguda.";
        if (s === "colecistitis_cronica") return "Colecistitis crónica.";
        if (s === "polipo") return "Pólipo vesicular.";
        if (s === "pared_engrosada") return "Pared vesicular engrosada.";
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
      case "pared_linea_alba":
        if (s === "diastasis") return "Diástasis de rectos en la línea alba.";
        if (s === "hernia_epigastrica") return "Hernia epigástrica palpable.";
        if (s === "lipoma") return "Pequeño lipoma subcutáneo en la línea media.";
        if (s === "tumor_solido") return "Masa sólida palpable en línea media.";
        break;
      case "pared_umbilical":
        if (s === "hernia_umbilical") return "Hernia umbilical con saco reducible.";
        if (s === "defecto_aponeurotico") return "Defecto aponeurótico umbilical palpable.";
        if (s === "tumor") return "Foco nodular denso compatible con masa umbilical.";
        break;
      case "pared_inguinal_derecha":
        if (s === "hernia_inguinal_derecha") return "Hernia inguinal derecha reducible.";
        if (s === "hernia_crural") return "Defecto compatible con hernia crural derecha.";
        if (s === "lipoma_canal") return "Lipoma del canal inguinal derecho.";
        break;
      case "pared_inguinal_izquierda":
        if (s === "hernia_inguinal_izquierda") return "Hernia inguinal izquierda reducible.";
        if (s === "hernia_crural") return "Defecto compatible con hernia crural izquierda.";
        if (s === "lipoma_canal") return "Lipoma del canal inguinal izquierdo.";
        break;
      case "pared_muscular":
        if (s === "diastasis_de_rectos") return "Separación anormal de vientres de músculos rectos.";
        if (s === "desgarro_muscular") return "Disrupción fibrilar con hematoma en plano muscular.";
        if (s === "hematoma") return "Hematoma de la pared muscular abdominal.";
        if (s === "tumor_desmoide") return "Masa bien delimitada compatible con tumor desmoide.";
        if (s === "hernia_spiegel") return "Hernia de Spiegel a través de la línea semilunar.";
        break;
      case "suprarenales":
        if (s === "hiperplasia") return "Glandulas suprarrenales con engrosamiento difuso compatible con hiperplasia.";
        if (s === "adenoma") return "Nódulo suprarrenal de bordes definidos compatible con adenoma.";
        if (s === "nodulo_sospechoso") return "Nódulo suprarrenal de aspecto sospechoso.";
        break;
      case "retroperitoneo":
        if (s === "adenopatias") return "Adenopatías / Ganglios aumentados retroperitoneales.";
        if (s === "liquido_libre") return "Líquido libre retroperitoneal.";
        if (s === "masa_retroperitoneal") return "Masa sólida retroperitoneal.";
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
      colon: ["colon", "marcobase", "meteorismo", "gas intestinal", "ciego", "sigmoides"],
      pared_linea_alba: ["linea alba", "epigastrio", "epigastrica", "diastasis rectos"],
      pared_umbilical: ["umbilical", "ombligo", "hernia umbilical"],
      pared_inguinal_derecha: ["inguinal derecha", "ing_derech", "conducto inguinal derecho", "hernia inguinal derecha", "fid"],
      pared_inguinal_izquierda: ["inguinal izquierda", "ing_izquierd", "conducto inguinal izquierdo", "hernia inguinal izquierda", "fii"],
      pared_muscular: ["pared anterior", "musculo recto", "músculo recto", "recto abdominal", "pared muscular", "oblicuo", "spiegel", "desmoide"],
      suprarenales: ["suprarrenal", "adrenal", "suprarenal", "glandula suprarrenal", "glandulas suprarrenales", "suprarrenales"],
      retroperitoneo: ["retroperitoneo", "retroperitoneal", "espacio retroperitoneal", "adenopatia retroperitoneal", "ganglios retroperitoneales"]
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
        } else if (id === "pared_linea_alba") {
          if (textLower.includes("diastasis") || textLower.includes("diástasis")) {
            detectedState = "diastasis";
            desc = "Diástasis de los rectos en la línea alba.";
          } else if (textLower.includes("hernia epigastrica") || textLower.includes("hernia epigástrica")) {
            detectedState = "hernia_epigastrica";
            desc = "Hernia epigástrica de la línea alba.";
          } else if (textLower.includes("lipoma")) {
            detectedState = "lipoma";
            desc = "Lipoma subcutáneo de línea alba.";
          } else if (textLower.includes("tumor") || textLower.includes("masa")) {
            detectedState = "tumor_solido";
            desc = "Masa sólida en línea media.";
          }
        } else if (id === "pared_umbilical") {
          if (textLower.includes("hernia umbilical")) {
            detectedState = "hernia_umbilical";
            desc = "Hernia umbilical reducible conteniendo grasa.";
          } else if (textLower.includes("defecto aponeurotico") || textLower.includes("defecto aponeurótico")) {
            detectedState = "defecto_aponeurotico";
            desc = "Defecto aponeurótico umbilical palpable.";
          } else if (textLower.includes("tumor") || textLower.includes("nodulo") || textLower.includes("nódulo")) {
            detectedState = "tumor";
            desc = "Nódulo o tumor en región umbilical.";
          }
        } else if (id === "pared_inguinal_derecha") {
          if (textLower.includes("hernia") || textLower.includes("saco")) {
            detectedState = "hernia_inguinal_derecha";
            desc = "Hernia inguinal derecha reducible.";
          } else if (textLower.includes("crural") || textLower.includes("femoral")) {
            detectedState = "hernia_crural";
            desc = "Hernia crural derecha.";
          } else if (textLower.includes("lipoma")) {
            detectedState = "lipoma_canal";
            desc = "Lipoma del canal inguinal derecho.";
          }
        } else if (id === "pared_inguinal_izquierda") {
          if (textLower.includes("hernia") || textLower.includes("saco")) {
            detectedState = "hernia_inguinal_izquierda";
            desc = "Hernia inguinal izquierda reducible.";
          } else if (textLower.includes("crural") || textLower.includes("femoral")) {
            detectedState = "hernia_crural";
            desc = "Hernia crural izquierda.";
          } else if (textLower.includes("lipoma")) {
            detectedState = "lipoma_canal";
            desc = "Lipoma del canal inguinal izquierdo.";
          }
        } else if (id === "pared_muscular") {
          if (textLower.includes("diastasis") || textLower.includes("diástasis")) {
            detectedState = "diastasis_de_rectos";
            desc = "Diástasis de los rectos abdominales.";
          } else if (textLower.includes("desgarro") || textLower.includes("ruptura")) {
            detectedState = "desgarro_muscular";
            desc = "Desgarro o rotura fibrilar.";
          } else if (textLower.includes("hematoma")) {
            detectedState = "hematoma";
            desc = "Hematoma en plano muscular.";
          } else if (textLower.includes("desmoide")) {
            detectedState = "tumor_desmoide";
            desc = "Tumor desmoide intramuscular.";
          } else if (textLower.includes("spiegel") || textLower.includes("semilunar")) {
            detectedState = "hernia_spiegel";
            desc = "Hernia de Spiegel.";
          }
        } else if (id === "suprarenales") {
          if (textLower.includes("hiperplasia")) {
            detectedState = "hiperplasia";
            desc = "Hiperplasia suprarrenal engrosada.";
          } else if (textLower.includes("adenoma")) {
            detectedState = "adenoma";
            desc = "Glándula suprarrenal con lesión nodular compatible con adenoma.";
          } else if (textLower.includes("nodulo") || textLower.includes("masa") || textLower.includes("sospechos")) {
            detectedState = "nodulo_sospechoso";
            desc = "Nódulo o masa suprarrenal de características sospechosas.";
          }
        } else if (id === "retroperitoneo") {
          if (textLower.includes("adenopatia") || textLower.includes("adenopatía") || textLower.includes("linfadenopatia") || textLower.includes("gangli")) {
            detectedState = "adenopatias";
            desc = "Adenopatías retroperitoneales identificadas.";
          } else if (textLower.includes("liquido") || textLower.includes("líquido")) {
            detectedState = "liquido_libre";
            desc = "Líquido libre en espacio retroperitoneal.";
          } else if (textLower.includes("masa") || textLower.includes("tumor") || textLower.includes("sarcoma")) {
            detectedState = "masa_retroperitoneal";
            desc = "Masa retroperitoneal sospechosa.";
          }
        }
      }

      if (detectedState !== "normal" && detectedState !== "no_descrito") {
        desc = extractSentenceForOrgan(generatedReport, id, desc);
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
      try {
        const textLower = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const elLogs: string[] = [];
        
        const hasElastographyKeywords = 
          textLower.includes("elastografia") || 
          textLower.includes("fibroscan") || 
          textLower.includes("shear wave") || 
          textLower.includes("kpa") || 
          textLower.includes("db/m") || 
          textLower.includes("qus") || 
          textLower.includes("pdff") || 
          textLower.includes("atenuacion") || 
          textLower.includes("rigidez") || 
          textLower.includes("grasa") || 
          textLower.includes("esteatosis") ||
          textLower.includes("steatosis") ||
          textLower.includes("porcentaje") ||
          textLower.includes("fraccion");

        if (hasElastographyKeywords) {
          handleToggleInclude(true);
          elLogs.push("📊 [Elastografía & QUS] Detectados indicadores de elastografía o grasa hepática.");
          
          // Match stiffness (kPa) using multiple robust patterns
          let parsedStiffness: number | null = null;
          const stiffnessPatterns = [
            /([0-9]+[.,][0-9]+|[0-9]+)\s*kpa/i,
            /(?:rigidez|elasticidad|stiffness|fibroscan|shear\s*wave)(?:\s+media|\s+hepatica|\s+promedio)?(?:\s+de|\s*:|\s+es\s+de|\s+fue\s+de)?\s*([0-9]+[.,][0-9]+|[0-9]+)/i,
            /valor\s+de\s+(?:rigidez|elasticidad)(?:\s+de)?\s*([0-9]+[.,][0-9]+|[0-9]+)/i
          ];
          for (const pattern of stiffnessPatterns) {
            const match = textLower.match(pattern);
            if (match) {
              const val = parseFloat(match[1].replace(",", "."));
              if (val >= 2.0 && val <= 25.0) {
                parsedStiffness = val;
                break;
              }
            }
          }

          // Fallback Proximity-Based Parser for Stiffness
          if (parsedStiffness === null) {
            let bestStiffnessCandidate: { val: number; score: number } | null = null;
            const numberRegex = /([0-9]+[.,][0-9]+|[0-9]+)/gi;
            let match;
            while ((match = numberRegex.exec(textLower)) !== null) {
              const val = parseFloat(match[1].replace(",", "."));
              if (val >= 2.0 && val <= 25.0) {
                const matchIndex = match.index;
                const start = Math.max(0, matchIndex - 40);
                const end = Math.min(textLower.length, matchIndex + match[0].length + 40);
                const windowText = textLower.slice(start, end);
                
                let score = 0;
                if (windowText.includes("kpa")) score += 50;
                if (windowText.includes("rigidez") || windowText.includes("stiffness")) score += 45;
                if (windowText.includes("elasticidad") || windowText.includes("shear wave")) score += 35;
                if (windowText.includes("fibroscan")) score += 35;
                
                // Penalize if fat fraction terms are closer
                if (windowText.includes("%") || windowText.includes("grasa") || windowText.includes("qus") || windowText.includes("pdff")) {
                  score -= 25;
                }
                
                if (score >= 20 && (!bestStiffnessCandidate || score > bestStiffnessCandidate.score)) {
                  bestStiffnessCandidate = { val, score };
                }
              }
            }
            if (bestStiffnessCandidate) {
              parsedStiffness = bestStiffnessCandidate.val;
              elLogs.push(`   → Rigidez Hepática extraída por proximidad contextual: ${parsedStiffness.toFixed(1)} kPa`);
            }
          }

          if (parsedStiffness !== null) {
            handleStiffnessChange(parsedStiffness);
            elLogs.push(`   → Rigidez Hepática extraída: ${parsedStiffness.toFixed(1)} kPa`);
          }

          // Match Fat Fraction / PDFF / QUS Fat Percentage (%) using multiple robust patterns
          let parsedFatFraction: number | null = null;
          const fatPatterns = [
            /pdff[^\d]{0,20}([0-9]+[.,][0-9]+|[0-9]+)/i,
            /(?:porcentaje\s+de\s+grasa|grasa\s+hep[aá]tica|grasa\s+por\s+qus|grasa\s+qus|esteatosis\s+por\s+qus|esteatosis\s+qus|fracci[oó]n\s+de\s+grasa|porcentaje\s+de\s+esteatosis)(?:\s+de|\s*:|\s+es\s+de|\s+del)?\s*([0-9]+[.,][0-9]+|[0-9]+)/i,
            /qus[^\d]{0,20}([0-9]+[.,][0-9]+|[0-9]+)\s*%/i,
            /qus[^\d]{0,20}([0-9]+[.,][0-9]+|[0-9]+)/i,
            /([0-9]+[.,][0-9]+|[0-9]+)\s*%\s*(?:de\s+grasa|de\s+esteatosis|por\s+qus|de\s+pdff|en\s+qus)/i,
            /(?:grasa|esteatosis|pdff)(?:\s+hepatica)?(?:\s+de|\s*:|\s+es\s+de|\s+del)?\s*([0-9]+[.,][0-9]+|[0-9]+)\s*%/i
          ];
          for (const pattern of fatPatterns) {
            const match = textLower.match(pattern);
            if (match) {
              const val = parseFloat(match[1].replace(",", "."));
              if (val >= 1.0 && val <= 40.0) {
                parsedFatFraction = val;
                break;
              }
            }
          }

          // Fallback Proximity-Based Parser for Fat Fraction (The absolute safest extractor)
          if (parsedFatFraction === null) {
            let bestCandidate: { val: number; score: number } | null = null;
            
            // 1st pass: Look for numbers followed by %
            const percentRegex = /([0-9]+[.,][0-9]+|[0-9]+)\s*%/gi;
            let pMatch;
            while ((pMatch = percentRegex.exec(textLower)) !== null) {
              const val = parseFloat(pMatch[1].replace(",", "."));
              if (val >= 1.0 && val <= 40.0) {
                const matchIndex = pMatch.index;
                const start = Math.max(0, matchIndex - 60);
                const end = Math.min(textLower.length, matchIndex + pMatch[0].length + 60);
                const windowText = textLower.slice(start, end);
                
                let score = 20; // baseline for % sign
                if (windowText.includes("qus")) score += 50;
                if (windowText.includes("pdff")) score += 50;
                if (windowText.includes("grasa") || windowText.includes("fat")) score += 40;
                if (windowText.includes("esteatosis") || windowText.includes("steatosis")) score += 30;
                if (windowText.includes("atenuacion") || windowText.includes("atenuación")) score += 25;
                if (windowText.includes("fraccion") || windowText.includes("porcentaje")) score += 20;
                
                if (windowText.includes("kpa") || windowText.includes("rigidez")) {
                  score -= 30;
                }
                
                if (score > 20 && (!bestCandidate || score > bestCandidate.score)) {
                  bestCandidate = { val, score };
                }
              }
            }
            
            // 2nd pass: Look for plain numbers without % but surrounded by direct labels within 50 chars
            const plainNumberRegex = /([0-9]+[.,][0-9]+|[0-9]+)/gi;
            let nMatch;
            while ((nMatch = plainNumberRegex.exec(textLower)) !== null) {
              const val = parseFloat(nMatch[1].replace(",", "."));
              if (val >= 1.0 && val <= 40.0) {
                const matchIndex = nMatch.index;
                const start = Math.max(0, matchIndex - 50);
                const end = Math.min(textLower.length, matchIndex + nMatch[0].length + 50);
                const windowText = textLower.slice(start, end);
                
                let score = 0;
                // Check if terms are extremely close (within 20 characters)
                const closeStart = Math.max(0, matchIndex - 20);
                const closeEnd = Math.min(textLower.length, matchIndex + nMatch[0].length + 20);
                const closeText = textLower.slice(closeStart, closeEnd);
                
                if (closeText.includes("qus") || closeText.includes("pdff")) score += 50;
                if (closeText.includes("grasa") || closeText.includes("esteatosis")) score += 30;
                if (windowText.includes("qus")) score += 20;
                if (windowText.includes("pdff")) score += 20;
                if (windowText.includes("grasa") || windowText.includes("esteatosis")) score += 15;
                
                if (windowText.includes("kpa") || windowText.includes("rigidez")) {
                  score -= 40;
                }
                
                if (score >= 20 && (!bestCandidate || score > bestCandidate.score)) {
                  bestCandidate = { val, score };
                }
              }
            }
            
            if (bestCandidate && bestCandidate.score >= 20) {
              parsedFatFraction = bestCandidate.val;
              elLogs.push(`   → Porcentaje de Grasa (QUS) extraído por análisis de proximidad contextual: ${parsedFatFraction.toFixed(1)}%`);
            }
          }

          if (parsedFatFraction === null) {
            // Backward hook: check CAP and map to fat fraction % if only CAP is reported
            const capMatch = textLower.match(/cap[^\d]{0,12}([0-9]+)\s*db\/m/i) || textLower.match(/([0-9]+)\s*db\/m/i);
            if (capMatch) {
              const parsedCAP = parseInt(capMatch[1], 10);
              if (parsedCAP >= 150 && parsedCAP <= 400) {
                parsedFatFraction = Math.max(1.0, Math.min(40.0, 1.0 + (parsedCAP - 150) * (39 / 250)));
                elLogs.push(`   → CAP detectado (${parsedCAP} dB/m) - Mapeado a grasa: ${parsedFatFraction.toFixed(1)}%`);
              }
            }
          }

          if (parsedFatFraction !== null && parsedFatFraction >= 1.0 && parsedFatFraction <= 40.0) {
            handleFatFractionChange(parsedFatFraction);
            elLogs.push(`   → Porcentaje de Grasa (QUS) extraído: ${parsedFatFraction.toFixed(1)}%`);
          }

          // Determine whether stiffness/rigidez is mentioned in the report text
          const hasStiffnessMention = parsedStiffness !== null || 
            textLower.includes("kpa") || 
            textLower.includes("rigidez") || 
            textLower.includes("elasticidad") || 
            textLower.includes("stiffness") || 
            textLower.includes("fibroscan") || 
            textLower.includes("shear wave") ||
            textLower.includes("metavir") ||
            /f[0-4]\b/i.test(textLower);

          if (setElastographyHasStiffness) {
            setElastographyHasStiffness(hasStiffnessMention);
          } else {
            setLocalHasStiffness(hasStiffnessMention);
          }
          
          if (hasStiffnessMention) {
            elLogs.push(`   → Rigidez hepática activa: SÍ (mencionada en reporte)`);
          } else {
            elLogs.push(`   → Rigidez hepática activa: NO (no se menciona en reporte, se ocultará en el dibujo)`);
          }
        }
        
        if (elLogs.length > 0) {
          setSyncLogs(prev => [...prev, ...elLogs]);
        }
      } catch (e) {
        console.error("Error al extraer elastografía/QUS:", e);
      }
      setIsSyncing(false);
      // Forzar la sincronizacion de la via biliar al sincronizar manualmente
      syncBiliaryFromReport(generatedReport, true);
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

    if (id === "vesicula") {
      setIsVesiculaManuallyOverridden(true);
      // Sincronizar hacia los estados individuales de vesícula/biliar para que coincidan con la selección manual:
      if (s === "litiasis") {
        setBiliaryVesiculaLitos(true);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "colecistitis_aguda") {
        setBiliaryColecistitis(true);
        setBiliaryVesiculaLitos(true);
        setBiliaryVesiculaPared(true);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "barro_biliar") {
        setBiliaryVesiculaBarro(true);
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryForceActive(true);
      } else if (s === "pared_engrosada") {
        setBiliaryVesiculaPared(true);
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(true);
      } else if (s === "normal" || s === "no_descrito") {
        setBiliaryVesiculaLitos(false);
        setBiliaryColecistitis(false);
        setBiliaryVesiculaPared(false);
        setBiliaryVesiculaBarro(false);
        setBiliaryForceActive(false);
      }
    }
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setCustomDescriptions(prev => ({ ...prev, [id]: text }));
    if (id === "vesicula") {
      setIsVesiculaManuallyOverridden(true);
      setBiliaryNotes(text);
    }
  };

  const syncAvailable = generatedReport && generatedReport !== lastSyncedReport;

  // Auto scan has been disabled to make synchronization fully manual and save resources as requested
  // It will only execute when manually triggered by clicking the action button.

  const exportTableData = () => {
    let md = `\n| Estructura analizada | Hallazgos ecográficos / Sinopsis del reporte |\n`;
    md += `| :--- | :--- |\n`;

    let hasRows = false;
    ABDOMEN_STRUCTURES.forEach(item => {
      const s = states[item.id];
      if (s !== "no_descrito" && s !== "normal") {
        const desc = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
        md += `| **${item.name}** | ${desc} |\n`;
        hasRows = true;
      }
    });

    if (!hasRows) {
      md += `| *Sin hallazgos patológicos* | *Todos los órganos y estructuras sólidas evaluados se reportan normales.* |\n`;
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
    // Only automatically sync narrative findings to the live brief description, table is manual
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
      s === "meteorismo_abundante" ||
      s === "diastasis" ||
      s === "diastasis_de_rectos" ||
      s === "lipoma" ||
      s === "lipoma_canal" ||
      s === "defecto_aponeurotico" ||
      s === "hiperplasia" ||
      s === "adenoma" ||
      s === "adenopatias" ||
      s === "liquido_libre"
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
          { val: "litiasis", label: "Colelitiasis (litos múltiples)" },
          { val: "litiasis_unica", label: "Colelitiasis única (lito único)" },
          { val: "barro_biliar", label: "Barro biliar" },
          { val: "colecistitis_aguda", label: "Colecistitis aguda" },
          { val: "colecistitis_cronica", label: "Colecistitis crónica" },
          { val: "polipo", label: "Pólipo vesicular" },
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
      case "pared_linea_alba":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "diastasis", label: "Diástasis de rectos" },
          { val: "hernia_epigastrica", label: "Hernia Epigástrica" },
          { val: "lipoma", label: "Lipoma subcutáneo" },
          { val: "tumor_solido", label: "Masa sólida palpable" }
        ];
      case "pared_umbilical":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hernia_umbilical", label: "Hernia Umbilical" },
          { val: "defecto_aponeurotico", label: "Defecto Aponeurótico" },
          { val: "tumor", label: "Masa o tumor umbilical" }
        ];
      case "pared_inguinal_derecha":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hernia_inguinal_derecha", label: "Hernia Inguinal Derecha" },
          { val: "hernia_crural", label: "Hernia Crural" },
          { val: "lipoma_canal", label: "Lipoma del Canal Inguinal" }
        ];
      case "pared_inguinal_izquierda":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hernia_inguinal_izquierda", label: "Hernia Inguinal Izquierda" },
          { val: "hernia_crural", label: "Hernia Crural" },
          { val: "lipoma_canal", label: "Lipoma del Canal Inguinal" }
        ];
      case "pared_muscular":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "diastasis_de_rectos", label: "Diástasis de rectos abdominales" },
          { val: "desgarro_muscular", label: "Desgarro / Rotura fibrilar" },
          { val: "hematoma", label: "Hematoma de la pared" },
          { val: "tumor_desmoide", label: "Tumor desmoide" },
          { val: "hernia_spiegel", label: "Hernia de Spiegel" }
        ];
      case "suprarenales":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "hiperplasia", label: "Hiperplasia Suprarrenal" },
          { val: "adenoma", label: "Adenoma Suprarrenal" },
          { val: "nodulo_sospechoso", label: "Nódulo Suprarrenal Sospechoso" }
        ];
      case "retroperitoneo":
        return [
          { val: "no_descrito", label: "No mencionado en el reporte" },
          { val: "normal", label: "Dentro de límites normales" },
          { val: "adenopatias", label: "Adenopatías / Ganglios retroperitoneales" },
          { val: "liquido_libre", label: "Líquido libre retroperitoneal" },
          { val: "masa_retroperitoneal", label: "Masa retroperitoneal" }
        ];
      default:
        return [];
    }
  };

  const badges = getBadgesCount();

  const [forceShowWall, setForceShowWall] = useState<boolean>(false);

  const showAbdominalWall = forceShowWall || 
    (states.pared_linea_alba && states.pared_linea_alba !== "no_descrito") ||
    (states.pared_umbilical && states.pared_umbilical !== "no_descrito") ||
    (states.pared_inguinal_derecha && states.pared_inguinal_derecha !== "no_descrito") ||
    (states.pared_inguinal_izquierda && states.pared_inguinal_izquierda !== "no_descrito") ||
    (states.pared_muscular && states.pared_muscular !== "no_descrito") ||
    (generatedReport.toLowerCase().includes("pared abdominal") ||
     generatedReport.toLowerCase().includes("diastasis") ||
     generatedReport.toLowerCase().includes("diástasis") ||
     generatedReport.toLowerCase().includes("hernia") ||
     generatedReport.toLowerCase().includes("defecto aponeurotico") ||
     generatedReport.toLowerCase().includes("aponeurosis") ||
     generatedReport.toLowerCase().includes("musculatura de pared") ||
     generatedReport.toLowerCase().includes("rectos abdominales"));

  const textLowerForGender = generatedReport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hasColecistectomia = textLowerForGender.includes("colecistectomia");
  const hasDilatacionViaBiliar = textLowerForGender.includes("dilatacion de la via biliar extrahepatica") || 
                                 textLowerForGender.includes("dilatacion de la via biliar extra-hepatica") || 
                                 textLowerForGender.includes("dilatacion de las vias biliares extrahepatica") || 
                                 textLowerForGender.includes("dilatacion de vias biliares extrahepatica") || 
                                 textLowerForGender.includes("dilatacion de coledoco") ||
                                 textLowerForGender.includes("dilatacion del coledoco") ||
                                 textLowerForGender.includes("coledoco dilatado") ||
                                 textLowerForGender.includes("vias biliares extrahepaticas dilatadas") ||
                                 textLowerForGender.includes("via biliar extrahepatica dilatada") ||
                                 textLowerForGender.includes("dilatacion de la vbe") ||
                                 textLowerForGender.includes("dilatacion vbe");
  const mentionsProstate = textLowerForGender.includes("prostata") || textLowerForGender.includes("prostatic") || states.prostata !== "no_descrito";
  const mentionsFemale = textLowerForGender.includes("utero") || textLowerForGender.includes("ovari") || states.utero !== "no_descrito" || states.ovarios !== "no_descrito";

  // Filter visible structures for selector pills based on gender hints
  const visibleStructures = ABDOMEN_STRUCTURES.filter(s => {
    if (s.id === "prostata" && mentionsFemale) return false;
    if ((s.id === "utero" || s.id === "ovarios") && mentionsProstate) return false;
    if (s.id.startsWith("pared_") && !showAbdominalWall) return false;
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
            onClick={() => setForceShowWall(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              showAbdominalWall 
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 shadow-[0_2px_8px_rgba(99,102,241,0.15)]" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <span>{showAbdominalWall ? "Pared Abdominal: Sí" : "Pared Abdominal: No"}</span>
          </button>

          <button
            onClick={handleToggleAppendixForceActive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              appendixForceActive 
                ? "bg-rose-600/30 border-rose-500/50 text-rose-350 shadow-[0_2px_8px_rgba(244,63,94,0.25)] animate-pulse" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${appendixForceActive ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : "bg-slate-600"} inline-block`} />
            <span>Apendicitis: {appendixForceActive ? "Sí" : "No"}</span>
          </button>

          <button
            onClick={handleToggleDiverticulitisForceActive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              diverticulitisForceActive 
                ? "bg-amber-600/30 border-amber-500/50 text-amber-350 shadow-[0_2px_8px_rgba(245,158,11,0.25)] animate-pulse" 
                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-705"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${diverticulitisForceActive ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" : "bg-slate-600"} inline-block`} />
            <span>Diverticulitis: {diverticulitisForceActive ? "Sí" : "No"}</span>
          </button>

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: DIAGRAMS (100% VECTOR INTERACTIVE MODEL) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 bg-slate-950/30 p-3.5 border border-slate-850/50 rounded-xl max-w-full">
          
          <div className="w-full text-center border-b border-slate-850 pb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#6366F1]">
              Esquema Anatómico Abdominal
            </span>
          </div>

          {/* SVG RENDERING CONTAINER */}
          <div className="w-full flex items-center justify-center min-h-[220px] bg-slate-950/20 p-2.5 rounded-xl relative overflow-hidden">
            <svg 
              id="abdomen-anatomy-svg"
              viewBox={showAbdominalWall ? "0 0 440 240" : "0 0 240 240"}
              className="w-full h-auto drop-shadow-2xl"
              style={{ maxWidth: showAbdominalWall ? "400px" : "210px", maxHeight: "210px" }}
            >
              {/* Spine Backbone illustration (anatomy context) */}
              <rect x="114" y="20" width="12" height="200" fill="#1e293b" rx="2" opacity="0.15" />
              {/* Aorta and Vena Cava illustration in background */}
              <line x1="108" y1="20" x2="108" y2="220" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
              <line x1="124" y1="20" x2="124" y2="220" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.15" />

              {/* RETROPERITONEO (Retroperitoneal space background layer) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("retroperitoneo")}
                onMouseEnter={() => setActiveHover("retroperitoneo")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Clickable capsule area surrounding the spinal vessels */}
                <rect 
                  x="100" 
                  y="30" 
                  width="40" 
                  height="170" 
                  rx="6"
                  fill={getColorForSVG("retroperitoneo").fill}
                  stroke={getColorForSVG("retroperitoneo").stroke}
                  strokeWidth={(states.retroperitoneo !== "normal" && states.retroperitoneo !== "no_descrito") ? "2.0" : "1.0"}
                  strokeDasharray={(states.retroperitoneo !== "normal" && states.retroperitoneo !== "no_descrito") ? "none" : "3,3"}
                  fillOpacity={(states.retroperitoneo !== "normal" && states.retroperitoneo !== "no_descrito") ? "0.45" : "0.08"}
                />
                
                {/* Retroperitoneal lymph node representations */}
                <circle cx="106" cy="48" r="2.0" fill="#f59e0b" opacity={states.retroperitoneo === "adenopatias" ? 1 : 0.4} />
                <circle cx="134" cy="62" r="2.0" fill="#f59e0b" opacity={states.retroperitoneo === "adenopatias" ? 1 : 0.4} />
                <circle cx="106" cy="142" r="2.5" fill="#f59e0b" opacity={states.retroperitoneo === "adenopatias" ? 1 : 0.4} />
                <circle cx="134" cy="154" r="2.5" fill="#f59e0b" opacity={states.retroperitoneo === "adenopatias" ? 1 : 0.4} />
                
                <text x="120" y="42" fill="#cbd5e1" fontSize="5.0" fontWeight="black" textAnchor="middle" opacity="0.8" pointerEvents="none">Retroperitoneo</text>
              </g>

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
              {hasColecistectomia ? (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("vesicula")}
                  onMouseEnter={() => setActiveHover("vesicula")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 88,103 C 85,103 82,108 82,112 C 82,120 90,128 95,128 C 98,128 98,120 95,114 C 92,108 90,103 88,103 Z"
                    fill="rgba(244, 63, 94, 0.05)"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                  />
                  {/* Cross lines indicating absence */}
                  <line x1="84" y1="106" x2="93" y2="124" stroke="#ef4444" strokeWidth="1.5" />
                  <line x1="93" y1="106" x2="84" y2="124" stroke="#ef4444" strokeWidth="1.5" />
                  {/* Surgical titanium clips */}
                  <line x1="86" y1="101" x2="91" y2="101" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="87" y1="103" x2="92" y2="103" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                  <text x="78" y="132" fill="#ef4444" fontSize="4.6" fontWeight="black" pointerEvents="none" textAnchor="end">COLECISTECTOMÍA (AUSENTE)</text>
                </g>
              ) : (
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
                  {biliaryVesiculaLitoUnico && (
                    <circle cx="89" cy="118" r="1.6" fill="#fbbf24" stroke="#78350f" strokeWidth="0.3" pointerEvents="none" />
                  )}
                  {biliaryVesiculaLitos && (
                    <g pointerEvents="none">
                      <circle cx="86" cy="117" r="0.9" fill="#fbbf24" stroke="#78350f" strokeWidth="0.15" />
                      <circle cx="90" cy="119" r="0.8" fill="#f59e0b" stroke="#78350f" strokeWidth="0.15" />
                      <circle cx="88" cy="121" r="0.9" fill="#d97706" stroke="#78350f" strokeWidth="0.15" />
                    </g>
                  )}
                  {biliaryVesiculaBarro && (
                    <path
                      d="M 83,116 C 83,116 86,126 94,124 Q 92,118 83,116 Z"
                      fill="#78350f"
                      opacity="0.85"
                      pointerEvents="none"
                    />
                  )}
                  {biliaryVesiculaPolipo && (
                    <g pointerEvents="none">
                      <circle cx="85" cy="111" r="0.8" fill="#ffffff" stroke="#047857" strokeWidth="0.15" />
                      <circle cx="94" cy="119" r="0.7" fill="#ffffff" stroke="#047857" strokeWidth="0.15" />
                    </g>
                  )}
                  <text x="78" y="132" fill="#cbd5e1" fontSize="5.5" fontWeight="black" pointerEvents="none" textAnchor="end">V. Biliar</text>
                </g>
              )}

              {/* VÍA BILIAR EXTRAHEPÁTICA (Colédoco / CHD) */}
              {hasDilatacionViaBiliar ? (
                <g 
                  className="cursor-pointer transition-all duration-200 animate-pulse-slow"
                  onClick={() => setSelectedStructure("vesicula")}
                  onMouseEnter={() => setActiveHover("vesicula")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 96,87 C 94,95 91,102 96,114" 
                    fill="none" 
                    stroke="#f43f5e" 
                    strokeWidth="4.5" 
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                  <path 
                    d="M 96,87 C 94,95 91,102 96,114" 
                    fill="none" 
                    stroke="#ffe4e6" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                  />
                  {!hasColecistectomia && (
                    <path 
                      d="M 88,103 Q 91,100 94,101" 
                      fill="none" 
                      stroke="#f43f5e" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                  )}
                  <text x="100" y="103" fill="#f43f5e" fontSize="4.6" fontWeight="extrabold" pointerEvents="none" textAnchor="start">COLÉDOCO DILATADO</text>
                </g>
              ) : (
                <g 
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setSelectedStructure("vesicula")}
                  onMouseEnter={() => setActiveHover("vesicula")}
                  onMouseLeave={() => setActiveHover(null)}
                >
                  <path 
                    d="M 96,87 C 94,95 91,102 96,114" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  {!hasColecistectomia && (
                    <path 
                      d="M 88,103 Q 91,100 94,101" 
                      fill="none" 
                      stroke="#10b981" 
                      strokeWidth="1.2" 
                      strokeLinecap="round"
                      opacity="0.8"
                    />
                  )}
                  <text x="100" y="103" fill="#64748b" fontSize="4.0" fontWeight="bold" pointerEvents="none" textAnchor="start" opacity="0.55">Vía biliar (Normal)</text>
                </g>
              )}

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

              {/* SUPRARENALES (Glándulas Suprarrenales - Cap-like shapes on top of kidneys) */}
              <g 
                className="cursor-pointer transition-all duration-200"
                onClick={() => setSelectedStructure("suprarenales")}
                onMouseEnter={() => setActiveHover("suprarenales")}
                onMouseLeave={() => setActiveHover(null)}
              >
                {/* Right Adrenal Gland - on top of Right Kidney */}
                <path 
                  d="M 50,132 Q 62,118 74,132 C 73,133 62,131 50,132 Z"
                  fill={getColorForSVG("suprarenales").fill}
                  stroke={getColorForSVG("suprarenales").stroke}
                  strokeWidth={(states.suprarenales !== "normal" && states.suprarenales !== "no_descrito") ? "2.0" : "1.0"}
                  fillOpacity={(states.suprarenales !== "normal" && states.suprarenales !== "no_descrito") ? "0.9" : "0.5"}
                />
                
                {/* Left Adrenal Gland - on top of Left Kidney */}
                <path 
                  d="M 166,132 Q 178,118 190,132 C 189,133 178,131 166,132 Z"
                  fill={getColorForSVG("suprarenales").fill}
                  stroke={getColorForSVG("suprarenales").stroke}
                  strokeWidth={(states.suprarenales !== "normal" && states.suprarenales !== "no_descrito") ? "2.0" : "1.0"}
                  fillOpacity={(states.suprarenales !== "normal" && states.suprarenales !== "no_descrito") ? "0.9" : "0.5"}
                />
                <text x="62" y="127" fill="#cbd5e1" fontSize="5.0" fontWeight="black" textAnchor="middle" pointerEvents="none">SUPRARENAL D.</text>
                <text x="178" y="127" fill="#cbd5e1" fontSize="5.0" fontWeight="black" textAnchor="middle" pointerEvents="none">SUPRARENAL I.</text>
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
              {mentionsProstate && !mentionsFemale && (
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
              {mentionsFemale && !mentionsProstate && (
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
              {mentionsFemale && !mentionsProstate && (
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

              {/* ABDOMINAL WALL SECOND DRAWING */}
              {showAbdominalWall && (
                <g id="abdominal-wall-group">
                  {/* Divider line between Organs and Wall */}
                  <line x1="220" y1="20" x2="220" y2="220" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
                  {/* Label for Organs on top left */}
                  <text x="110" y="15" fill="#64748b" fontSize="6.5" fontWeight="black" textAnchor="middle" opacity="0.7">ÓRGANOS SÓLIDOS</text>
                  {/* Label for Wall on top right */}
                  <text x="330" y="15" fill="#64748b" fontSize="6.5" fontWeight="black" textAnchor="middle" opacity="0.7">PARED ABDOMINAL</text>

                  {/* Silhouette background outline */}
                  <path 
                    d="M 280,30 C 300,30 360,30 380,30 C 394,70 398,120 388,170 C 378,205 358,220 330,220 C 302,220 282,205 272,170 C 262,120 266,70 280,30 Z" 
                    fill="#0f172a" 
                    stroke="#1e293b" 
                    strokeWidth="1.5" 
                    opacity="0.55" 
                  />
                  <path 
                    d="M 280,30 C 300,30 360,30 380,30 C 394,70 398,120 388,170 C 378,205 358,220 330,220 C 302,220 282,205 272,170 C 262,120 266,70 280,30 Z" 
                    fill="none" 
                    stroke="#334155" 
                    strokeWidth="1" 
                    strokeDasharray="3,3" 
                  />

                  {/* 1. PARED MUSCULAR (Músculos rectos) */}
                  <g
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("pared_muscular")}
                    onMouseEnter={() => setActiveHover("pared_muscular")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    {/* Right rectus (anatomical left, screen right) */}
                    <path 
                      d="M 334,40 L 354,40 C 358,80 358,160 354,200 L 334,200 Z"
                      fill={getColorForSVG("pared_muscular").fill}
                      stroke={getColorForSVG("pared_muscular").stroke}
                      strokeWidth={(states.pared_muscular !== "normal" && states.pared_muscular !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_muscular !== "normal" && states.pared_muscular !== "no_descrito") ? "0.9" : "0.5"}
                    />
                    {/* Left rectus (anatomical right, screen left) */}
                    <path 
                      d="M 326,40 L 306,40 C 302,80 302,160 306,200 L 326,200 Z"
                      fill={getColorForSVG("pared_muscular").fill}
                      stroke={getColorForSVG("pared_muscular").stroke}
                      strokeWidth={(states.pared_muscular !== "normal" && states.pared_muscular !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_muscular !== "normal" && states.pared_muscular !== "no_descrito") ? "0.9" : "0.5"}
                    />
                    <text x="313" y="100" fill="#64748b" fontSize="5" fontWeight="bold" textAnchor="end" pointerEvents="none">M. RECTO D.</text>
                    <text x="347" y="100" fill="#64748b" fontSize="5" fontWeight="bold" textAnchor="start" pointerEvents="none">M. RECTO I.</text>
                  </g>

                  {/* 2. LÍNEA ALBA (Centred fibrous line) */}
                  <g
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("pared_linea_alba")}
                    onMouseEnter={() => setActiveHover("pared_linea_alba")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path
                      d="M 327,35 L 333,35 C 333,35 333,105 333,105 L 333,135 L 333,205 L 327,205 Z"
                      fill={getColorForSVG("pared_linea_alba").fill}
                      stroke={getColorForSVG("pared_linea_alba").stroke}
                      strokeWidth={(states.pared_linea_alba !== "normal" && states.pared_linea_alba !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_linea_alba !== "normal" && states.pared_linea_alba !== "no_descrito") ? "0.9" : "0.5"}
                    />
                    <text x="330" y="55" fill="#ffffff" fontSize="4.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">LÍNEA ALBA</text>
                  </g>

                  {/* 3. REGIÓN UMBILICAL (Central circular button) */}
                  <g
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("pared_umbilical")}
                    onMouseEnter={() => setActiveHover("pared_umbilical")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <circle
                      cx="330"
                      cy="120"
                      r="14"
                      fill={getColorForSVG("pared_umbilical").fill}
                      stroke={getColorForSVG("pared_umbilical").stroke}
                      strokeWidth={(states.pared_umbilical !== "normal" && states.pared_umbilical !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_umbilical !== "normal" && states.pared_umbilical !== "no_descrito") ? "0.9" : "0.6"}
                    />
                    <circle cx="330" cy="120" r="4.5" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" pointerEvents="none" />
                    <text x="330" y="141" fill="#cbd5e1" fontSize="5.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">UMBILICAL</text>
                  </g>

                  {/* 4. REGIÓN INGUINAL DERECHA (Lower anatomical right / screen left) */}
                  <g
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("pared_inguinal_derecha")}
                    onMouseEnter={() => setActiveHover("pared_inguinal_derecha")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path
                      d="M 285,185 C 285,175 310,185 315,195 C 315,200 295,205 285,185 Z"
                      fill={getColorForSVG("pared_inguinal_derecha").fill}
                      stroke={getColorForSVG("pared_inguinal_derecha").stroke}
                      strokeWidth={(states.pared_inguinal_derecha !== "normal" && states.pared_inguinal_derecha !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_inguinal_derecha !== "normal" && states.pared_inguinal_derecha !== "no_descrito") ? "0.9" : "0.5"}
                    />
                    <text x="295" y="177" fill="#cbd5e1" fontSize="5.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">ING_D</text>
                  </g>

                  {/* 5. REGIÓN INGUINAL IZQUIERDA (Lower anatomical left / screen right) */}
                  <g
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStructure("pared_inguinal_izquierda")}
                    onMouseEnter={() => setActiveHover("pared_inguinal_izquierda")}
                    onMouseLeave={() => setActiveHover(null)}
                  >
                    <path
                      d="M 375,185 C 375,175 350,185 345,195 C 345,200 365,205 375,185 Z"
                      fill={getColorForSVG("pared_inguinal_izquierda").fill}
                      stroke={getColorForSVG("pared_inguinal_izquierda").stroke}
                      strokeWidth={(states.pared_inguinal_izquierda !== "normal" && states.pared_inguinal_izquierda !== "no_descrito") ? "2.5" : "1.2"}
                      fillOpacity={(states.pared_inguinal_izquierda !== "normal" && states.pared_inguinal_izquierda !== "no_descrito") ? "0.9" : "0.5"}
                    />
                    <text x="365" y="177" fill="#cbd5e1" fontSize="5.5" fontWeight="bold" textAnchor="middle" pointerEvents="none">ING_I</text>
                  </g>
                </g>
              )}
            </svg>
          </div>

          {/* CONTROL PARA MOSTRAR/OCULTAR ESQUEMA ESPECÍFICO DE VÍA BILIAR EXTRAHEPÁTICA */}
          <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-850/60 shadow-inner">
            <div className="flex flex-col text-left">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-400">
                🔬 Vía Biliar Extrahepática
              </span>
              <span className="text-[8px] text-slate-500 font-medium">Anexo de alta definición para hallazgos de colédoco</span>
            </div>
            <button
              onClick={handleToggleBiliaryForceActive}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-150 border cursor-pointer ${
                isBiliaryActive 
                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30 font-black" 
                  : "bg-slate-900 text-slate-500 border-slate-800"
              }`}
            >
              {isBiliaryActive ? "Activado / Visible" : "Oculto (Sin patología)"}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 font-medium text-center max-w-[220px]">
            Haga clic sobre un órgano en el esquema o selecciónelo en el panel derecho para editar sus hallazgos e integrarlos al reporte.
          </p>
        </div>

        {/* RIGHT COLUMN: CONTROLS & FIELD EDITOR (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
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

            {additionalFindings && additionalFindings.map((item) => {
              const s = item.state || "Alterado";
              return (
                <div
                  key={item.id}
                  className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg border border-dashed border-indigo-900/40 bg-indigo-950/20 text-slate-200 flex items-center gap-1.5 cursor-default select-none"
                  title={`${item.structureName}: ${item.description}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <span className="font-extrabold">{item.structureName}:</span>
                  <span className="normal-case font-normal text-slate-400 truncate max-w-[150px]">{item.description}</span>
                </div>
              );
            })}
          </div>

          {/* ACTIVE DISCIPLINARY EDITOR */}
          <div className="bg-slate-950 p-4 border border-slate-855/70 rounded-xl flex flex-col gap-3.5 relative overflow-hidden">
            {/* Soft decorative background indicator */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#6366F1]/3 rounded-full blur-2xl pointer-events-none" />

            {/* Title / Structure Identity */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="text-xs font-black text-[#10B981] uppercase tracking-widest font-mono">
                ✏️ Editar {getActiveStructureLabel()}
              </span>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase">
                {selectedStructure}
              </span>
            </div>

            {/* Custom State Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Diagnóstico / Hallazgo Clínico (Sinopsis):
              </label>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={
                    draftState === "no_descrito" 
                      ? "" 
                      : draftState === "normal" 
                        ? "Normal" 
                        : draftState
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    let nextVal = val;
                    if (val.trim().toLowerCase() === "normal" || val.trim().toLowerCase() === "sin lesiones") {
                      nextVal = "normal";
                      setDraftDescription("Dentro de límites normales.");
                    } else if (val.trim() === "") {
                      nextVal = "no_descrito";
                      setDraftDescription("No mencionado / No descrito.");
                    } else {
                      if (draftDescription === "Dentro de límites normales." || draftDescription === "No mencionado / No descrito." || !draftDescription) {
                        setDraftDescription(`Se describe hallazgo: ${val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()}.`);
                      }
                    }
                    setDraftState(nextVal);
                  }}
                  placeholder="Escriba el diagnóstico del hallazgo (ej: Esteatosis, Litiasis, etc.)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftState("normal");
                      setDraftDescription("Dentro de límites normales.");
                    }}
                    className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                      draftState === "normal"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-medium"
                        : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400"
                    }`}
                  >
                    ✓ Cons. Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftState("no_descrito");
                      setDraftDescription("No mencionado / No descrito.");
                    }}
                    className={`flex-1 py-1 px-3 text-[10px] rounded border transition-all cursor-pointer ${
                      draftState === "no_descrito"
                        ? "bg-slate-850 border-slate-600 text-slate-100 font-medium"
                        : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400"
                    }`}
                  >
                    ⚪ No Descrito
                  </button>
                </div>
              </div>
            </div>

            {/* Synopsis Field (Custom text override) */}
            {draftState !== "no_descrito" && (
              <div className="flex flex-col gap-1.5 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Sinopsis Clínica (en Tabla del Reporte)
                  </label>
                  <span className="text-[9px] font-semibold text-emerald-400 font-mono">
                    Borrador
                  </span>
                </div>
                <textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Por favor ingrese un resumen o hallazgo personalizado..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* CONFIRM MANUAL CHANGES BUTTON */}
            <div className="pt-2.5 border-t border-slate-850 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleConfirmManualChanges}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-550 active:scale-98 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-950/30 flex items-center justify-center gap-1.5 cursor-pointer font-mono"
              >
                <Check className="h-4 w-4" />
                Confirmar y Guardar Cambios
              </button>
              <p className="text-[9px] text-slate-500 text-center leading-snug">
                Presione para registrar permanentemente este hallazgo en el reporte y tarjetas sinópticas.
              </p>
            </div>
          </div>

          {/* Mapeo de Hallazgos Clínicos Sintonizados (aligned anatomical cards) */}
          <div className="bg-slate-900/10 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-[11px] font-black text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 leading-none mb-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              Mapeo de Hallazgos Clínicos Sintonizados (Abdomen)
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {ABDOMEN_STRUCTURES.filter(item => states[item.id] !== "no_descrito" && states[item.id] !== "normal").map(item => {
                const s = states[item.id];
                const isSelected = selectedStructure === item.id;
                const simplified = customDescriptions[item.id]?.trim() || getSimplifiedDescription(item.id);
                
                let dotColor = "bg-slate-500";
                let badgeBg = "bg-slate-950/60 text-slate-400 border-slate-800";
                
                if (s === "normal") {
                  dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                  badgeBg = "bg-emerald-950/40 text-emerald-450 border-emerald-900/30";
                } else if (s.includes("leve") || s.includes("bursitis_l") || s.includes("derrame_l") || s.includes("quiste_simple") || s.includes("diverticulosis") || s.includes("litiasis_vesicular_leve") || s.includes("esplenomegalia_l") || s.includes("nefrolitiasis_l")) {
                  dotColor = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
                  badgeBg = "bg-amber-950/40 text-amber-400 border-amber-900/30";
                } else if (s.includes("ruptura") || s.includes("colecistitis_aguda") || s.includes("masa_solida") || s.includes("pan pancreatitis") || s.includes("hidronefrosis_severa") || s.includes("aneurisma")) {
                  dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                  badgeBg = "bg-rose-950/40 text-rose-455 border-rose-900/30";
                } else {
                  dotColor = "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.4)]";
                  badgeBg = "bg-pink-950/40 text-pink-400 border-pink-900/30";
                }

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedStructure(item.id);
                    }}
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
                          {item.name}
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

              {ABDOMEN_STRUCTURES.filter(item => states[item.id] !== "no_descrito" && states[item.id] !== "normal").length === 0 && (!additionalFindings || additionalFindings.length === 0) && (
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
                onClick={exportNarrativeNarratolog}
                className="py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-950 transition-all shadow-md flex items-center justify-center gap-1.5 font-mono cursor-pointer"
                title="Inyecta un resumen narrativo de hallazgos al reporte"
              >
                📥 Insertar Viñetas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DIAGRAMA INDEPENDIENTE DE VÍA BILIAR EXTRAHEPÁTICA (MODERNIZADO Y SIN TRASLAPES EN MACBOOK PRO) */}
      {isBiliaryActive && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 font-bold">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono">
                  Esquema: Vía Biliar Extrahepática (VBE)
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Anexo anatómico detallado para el mapeo avanzado de patología biliar y simulación interactiva.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleToggleIncludeBiliary(!activeIncludeBiliary)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-2 font-mono ${
                  activeIncludeBiliary
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/20"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                {activeIncludeBiliary ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400 font-bold" />
                    <span>Adjuntar al PDF: Sí</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-600 block" />
                    <span>Adjuntar al PDF: No</span>
                  </>
                )}
              </button>

              <span className="text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider bg-rose-950/30 text-rose-450 border border-rose-900/30 animate-pulse">
                Hallazgos Detectados
              </span>
            </div>
          </div>

          {/* TWO COLUMN SIDE-BY-SIDE GRID (DIBUJO Y HALLAZGOS "A LA PAR" EN PANTALLAS GRANDES SIN TRASLAPES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* COLUMN 1: BILIARY TREE SPECIFIC INTERACTIVE SVG */}
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/50 flex flex-col items-center justify-center relative min-h-[220px]">
              <svg
                id="abdomen-biliary-svg"
                viewBox="0 0 200 180"
                className="w-full h-auto animate-fade-in"
                style={{ maxWidth: "230px", maxHeight: "200px" }}
              >
                <defs>
                  <linearGradient id="duodenumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#451a03" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#78350f" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="gallbladderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#064e3b" />
                  </linearGradient>
                  <linearGradient id="gallbladderInflamedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="40%" stopColor="#b91c1c" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </linearGradient>
                  <linearGradient id="gallbladderAcousticShadow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#020617" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* DUODENUM (Anatomical ending backdrop) */}
                <path
                  d="M 50,145 C 50,135 80,135 100,140 C 130,145 150,145 150,155 C 150,165 110,165 100,160 C 80,155 50,155 50,145 Z"
                  fill="url(#duodenumGrad)"
                  stroke="#d97706"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                  opacity="0.6"
                  pointerEvents="none"
                />
                <text x="140" y="162" fill="#d97755" fontSize="4.5" fontWeight="bold" opacity="0.6" pointerEvents="none">Duodeno</text>

                {/* TRAILING ACOUSTIC SHADOWS FOR ENCLAVED CALCULI & GALLSTONES */}
                {biliaryLitosProximal && (
                  <rect x="81" y="65" width="8" height="120" fill="rgba(15, 23, 42, 0.45)" stroke="none" opacity="0.6" pointerEvents="none" />
                )}
                {biliaryLitosDistal && (
                  <rect x="81" y="115" width="8" height="70" fill="rgba(15, 23, 42, 0.45)" stroke="none" opacity="0.6" pointerEvents="none" />
                )}
                {(biliaryVesiculaLitos || biliaryVesiculaLitoUnico) && (
                  <path
                    d="M 115,123 L 105,180 L 150,180 L 145,124 Z"
                    fill="url(#gallbladderAcousticShadow)"
                    pointerEvents="none"
                    opacity="0.6"
                  />
                )}

                {/* VESÍCULA BILIAR (Gallbladder pear shape - interactive toggle) */}
                <g className="cursor-pointer" onClick={() => {
                  if (biliaryVesiculaLitoUnico) {
                    handleBiliaryCheckboxChange("vesiculaLitoUnico", false);
                  } else {
                    handleBiliaryCheckboxChange("vesiculaLitos", !biliaryVesiculaLitos);
                  }
                }}>
                  {/* Outer Wall Edema (Double wall contour for acute cholecystitis) */}
                  {(biliaryColecistitis || biliaryVesiculaPared) && (
                    <path
                      d="M 130,85 C 120,80 115,100 115,110 C 115,123 130,130 140,130 C 150,130 155,120 155,110 C 155,95 140,90 130,85 Z"
                      fill="none"
                      stroke={biliaryColecistitis ? "#f43f5e" : "#fbbf24"}
                      strokeWidth={biliaryColecistitis ? "7" : "4.5"}
                      strokeOpacity="0.45"
                      strokeDasharray={biliaryColecistitis ? "2,1" : ""}
                      className={biliaryColecistitis ? "animate-pulse" : ""}
                    />
                  )}
                  {/* Gallbladder main bulb */}
                  <path
                    d="M 130,85 C 120,80 115,100 115,110 C 115,123 130,130 140,130 C 150,130 155,120 155,110 C 155,95 140,90 130,85 Z"
                    fill={biliaryColecistitis ? "url(#gallbladderInflamedGrad)" : "url(#gallbladderGrad)"}
                    stroke={biliaryColecistitis ? "#f43f5e" : "#10b981"}
                    strokeWidth={biliaryColecistitis ? "2.2" : "1.5"}
                    transition="all 0.3s ease"
                  />
                  {/* Biliary Mud / Shadow */}
                  {biliaryVesiculaBarro && (
                    <path
                      d="M 117,118 C 117,118 122,128 135,128 C 148,128 153,118 153,118 C 153,118 148,129 135,129 C 122,129 117,118 117,118 Z"
                      fill="#78350f"
                      opacity="0.9"
                    />
                  )}
                   {/* Litiasis (Multiple hyperechoic gallstones) */}
                  {biliaryVesiculaLitos && (
                    <g opacity="1">
                      <circle cx="125" cy="122" r="3" fill="#fbbf24" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="131" cy="124" r="2.5" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="137" cy="123" r="3.2" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="142" cy="121" r="2.2" fill="#fef3c7" stroke="#78350f" strokeWidth="0.5" />
                      <circle cx="134" cy="119" r="2.8" fill="#fbbf24" stroke="#78350f" strokeWidth="0.5" />
                    </g>
                  )}
                  {/* Litiasis única (Single large hyperechoic gallstone) */}
                  {biliaryVesiculaLitoUnico && (
                    <g opacity="1">
                      <circle cx="135" cy="122" r="4.5" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
                    </g>
                  )}
                  {/* Pólipo vesicular (echogenic projection fixed to wall without shadow) */}
                  {biliaryVesiculaPolipo && (
                    <g opacity="1">
                      <path d="M 118,105 Q 120,102 124,106 Z" fill="#ffffff" stroke="#10b981" strokeWidth="0.4" />
                      <circle cx="121" cy="104.5" r="1.3" fill="#ffffff" stroke="#047857" strokeWidth="0.35" />
                      <circle cx="144" cy="122" r="1.2" fill="#ffffff" stroke="#047857" strokeWidth="0.3" />
                      <path d="M 142.5,123.5 C 143.5,123 144,121.5 144.5,123 Z" fill="none" stroke="#047857" strokeWidth="0.3" />
                    </g>
                  )}
                  <text x="135" y="108" fill="#ffffff" fontSize="4.5" textAnchor="middle" fontWeight="bold" pointerEvents="none">Vesícula</text>
                  {biliaryColecistitis && (
                    <text x="135" y="115" fill="#fca5a5" fontSize="3" textAnchor="middle" fontWeight="black" pointerEvents="none" className="animate-pulse">INFLAMADO</text>
                  )}
                </g>

                {/* CONDUCTO CÍSTICO (Cystic duct winding) */}
                <path
                  d="M 130,85 Q 115,80 105,85 T 85,85"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <text x="111" y="77" fill="#a7f3d0" fontSize="3.8" pointerEvents="none" opacity="0.7">Cístico</text>

                {/* COLEDOCAL WALL THICKENING BACKGLOW */}
                {biliaryThickening && (
                  <g opacity="0.8" pointerEvents="none">
                    {/* Left Wall outline glow */}
                    <path d="M 81.5,45 L 81.5,140" fill="none" stroke="#ea580c" strokeWidth="6.5" strokeLinecap="round" opacity="0.75" />
                    {/* Right Wall outline glow */}
                    <path d="M 88.5,45 L 88.5,140" fill="none" stroke="#ea580c" strokeWidth="6.5" strokeLinecap="round" opacity="0.75" />
                  </g>
                )}

                {/* RIGHT & LEFT HEPATIC DUCTS */}
                <path d="M 55,30 Q 70,45 85,45" fill="none" stroke={biliaryThickening ? "#f43f5e" : "#10b981"} strokeWidth="2.0" strokeLinecap="round" pointerEvents="none" />
                <path d="M 115,30 Q 100,45 85,45" fill="none" stroke={biliaryThickening ? "#f43f5e" : "#10b981"} strokeWidth="2.0" strokeLinecap="round" pointerEvents="none" />
                <text x="50" y="26" fill="#cbd5e1" fontSize="3.5" fontWeight="bold" pointerEvents="none">Ducto H.D.</text>
                <text x="120" y="26" fill="#cbd5e1" fontSize="3.5" fontWeight="bold" textAnchor="end" pointerEvents="none">Ducto H.I.</text>

                {/* COMMON HEPATIC DUCT & COMMON BILE DUCT (COLÉDOCO) CORE INNER CANAL */}
                {biliaryDilated ? (
                  // DILATED MAIN TUBE LAYER
                  <g pointerEvents="none">
                    {/* Wide dilated body */}
                    <path
                      d="M 85,45 L 85,140"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="7.0"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    {/* Inner luminous lumen */}
                    <path
                      d="M 85,45 L 85,140"
                      fill="none"
                      stroke="#fecdd3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {/* Pulsing indicator tag */}
                    <text x="96" y="55" fill="#f43f5e" fontSize="4" fontWeight="black" letterSpacing="0.1">VBE DILATADA</text>
                  </g>
                ) : (
                  // NORMAL DIAMETER LAYER
                  <g pointerEvents="none">
                    <path
                      d="M 85,45 L 85,140"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <text x="94" y="55" fill="#4b5563" fontSize="4.0" fontWeight="bold" opacity="0.8">Hepático Común</text>
                  </g>
                )}

                {/* Labels for landmarks */}
                <text x="94" y="100" fill={biliaryDilated ? "#fca5a5" : "#6b7280"} fontSize="4.0" fontWeight="bold" pointerEvents="none">Conducto Colédoco</text>
                <text x="94" y="142" fill="#d97706" fontSize="4.0" fontWeight="black" pointerEvents="none">Ámpula de Vater</text>

                {/* COLEDOCAL / EXTRAHEPATIC TUMORATION */}
                {biliaryTumor && (
                  <g>
                    {/* Tumor mass body */}
                    <path
                      d="M 75,90 C 70,95 72,110 85,108 C 98,107 98,92 90,90 C 85,88 80,85 75,90 Z"
                      fill="#b91c1c"
                      stroke="#7f1d1d"
                      strokeWidth="1"
                      fillOpacity="0.9"
                    />
                    {/* Texture / bumps */}
                    <circle cx="76" cy="98" r="3" fill="#ef4444" opacity="0.7" />
                    <circle cx="88" cy="97" r="3.5" fill="#b91c1c" opacity="0.8" />
                    <circle cx="84" cy="104" r="4" fill="#7f1d1d" opacity="0.9" />
                    <circle cx="80" cy="92" r="2.5" fill="#f87171" opacity="0.6" />
                    {/* Luminous mass label */}
                    <rect x="35" y="93" width="36" height="8" rx="2" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="0.4" />
                    <text x="53" y="99" fill="#f87171" fontSize="3.8" fontWeight="black" textAnchor="middle">TUMORACIÓN</text>
                  </g>
                )}

                {/* LITO PROXIMAL (HIGH BULGE) */}
                {biliaryLitosProximal && (
                  <g>
                    <polygon
                      points="85,60 89,63 88,68 82,67 81,63"
                      fill="#f3a207"
                      stroke="#78350f"
                      strokeWidth="0.6"
                    />
                    <polygon points="85,60 85,65 89,63" fill="#fef3c7" opacity="0.8" />
                    <polygon points="85,60 82,63 85,65" fill="#d97706" opacity="0.8" />
                    {/* Indicator line & tag */}
                    <line x1="81" y1="64" x2="48" y2="64" stroke="#d97706" strokeWidth="0.4" strokeDasharray="1,1" />
                    <text x="44" y="66" fill="#f59e0b" fontSize="4" fontWeight="black" textAnchor="end">LITO PROXIMAL</text>
                  </g>
                )}

                {/* LITO DISTAL (LOW BULGE / MEATO) */}
                {biliaryLitosDistal && (
                  <g>
                    <polygon
                      points="85,120 89,123 88,128 82,127 81,123"
                      fill="#f3a207"
                      stroke="#78350f"
                      strokeWidth="0.6"
                    />
                    <polygon points="85,120 85,125 89,123" fill="#fef3c7" opacity="0.8" />
                    <polygon points="85,120 82,123 85,125" fill="#d97706" opacity="0.8" />
                    {/* Indicator line & tag */}
                    <line x1="81" y1="125" x2="48" y2="125" stroke="#d97706" strokeWidth="0.4" strokeDasharray="1,1" />
                    <text x="44" y="127" fill="#f59e0b" fontSize="4" fontWeight="black" textAnchor="end">LITO DISTAL</text>
                  </g>
                )}
              </svg>
            </div>

            {/* COLUMN 2: ACTIVE FINDINGS LIST AND CONTROLS NEXT TO THE DRAWING */}
            <div className="flex flex-col gap-4 justify-between bg-slate-950/30 p-4 rounded-xl border border-slate-850/40">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-400 block border-b border-slate-800 pb-1.5 text-left">
                  Controles de Simulación
                </span>
                
                {/* MANUAL INTERACTIVE CHECKBOXES - FLOW FLEXIBLE EN REJILLA COMODA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-850/60 shadow-inner">
                  <span className="col-span-full text-[10px] font-black uppercase text-indigo-400 tracking-wide mb-1 text-left">Conducto Colédoco:</span>
                  
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-indigo-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="biliary-check-dilated"
                      checked={biliaryDilated}
                      onChange={(e) => handleBiliaryCheckboxChange("dilated", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Dilatación VBE</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-indigo-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="biliary-check-thickening"
                      checked={biliaryThickening}
                      onChange={(e) => handleBiliaryCheckboxChange("thickening", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Engrosar Pared</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-indigo-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="biliary-check-proximal"
                      checked={biliaryLitosProximal}
                      onChange={(e) => handleBiliaryCheckboxChange("litosProx", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Litos Proximales</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-indigo-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="biliary-check-distal"
                      checked={biliaryLitosDistal}
                      onChange={(e) => handleBiliaryCheckboxChange("litosDist", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Litos Distales</span>
                  </label>
                  <label className="sm:col-span-2 flex items-center gap-2.5 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-950/20 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-rose-300">
                    <input
                      type="checkbox"
                      id="biliary-check-tumor"
                      checked={biliaryTumor}
                      onChange={(e) => handleBiliaryCheckboxChange("tumor", e.target.checked)}
                      className="rounded border-slate-705 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Tumoración / Masa de Vía Biliar</span>
                  </label>

                  <span className="col-span-full text-[10px] font-black uppercase text-amber-500 tracking-wide mt-2 mb-1 text-left block">Vesícula Biliar:</span>

                  <label className="flex items-center gap-2.5 p-2.5 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl border border-amber-950/20 hover:border-amber-500/30 transition-all cursor-pointer text-xs font-bold text-amber-300">
                    <input
                      type="checkbox"
                      id="biliary-check-vesicular-litos"
                      checked={biliaryVesiculaLitos}
                      onChange={(e) => handleBiliaryCheckboxChange("vesiculaLitos", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Colelitiasis (Litos múltiples)</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl border border-amber-950/20 hover:border-amber-500/30 transition-all cursor-pointer text-xs font-bold text-amber-300">
                    <input
                      type="checkbox"
                      id="biliary-check-vesicular-lito-unico"
                      checked={biliaryVesiculaLitoUnico}
                      onChange={(e) => handleBiliaryCheckboxChange("vesiculaLitoUnico", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Colelitiasis única (Lito único)</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-950/20 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-rose-350">
                    <input
                      type="checkbox"
                      id="biliary-check-colecistitis"
                      checked={biliaryColecistitis}
                      onChange={(e) => handleBiliaryCheckboxChange("colecistitis", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Colecistitis Aguda</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl border border-amber-950/20 hover:border-amber-500/30 transition-all cursor-pointer text-xs font-bold text-amber-300">
                    <input
                      type="checkbox"
                      id="biliary-check-vesicular-pared"
                      checked={biliaryVesiculaPared}
                      onChange={(e) => handleBiliaryCheckboxChange("vesiculaPared", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Pared Engrosada</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl border border-amber-950/20 hover:border-amber-500/30 transition-all cursor-pointer text-xs font-bold text-amber-400">
                    <input
                      type="checkbox"
                      id="biliary-check-vesicular-barro"
                      checked={biliaryVesiculaBarro}
                      onChange={(e) => handleBiliaryCheckboxChange("vesiculaBarro", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Barro Biliar</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-950/20 hover:border-emerald-500/30 transition-all cursor-pointer text-xs font-bold text-emerald-300">
                    <input
                      type="checkbox"
                      id="biliary-check-vesicular-polipo"
                      checked={biliaryVesiculaPolipo}
                      onChange={(e) => handleBiliaryCheckboxChange("vesiculaPolipo", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Pólipos Vesiculares</span>
                  </label>
                </div>

                {/* RECAP OF RESULTS FROM THE GRAPHICS */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wide text-rose-400 block text-left border-b border-rose-950/30 pb-1">
                    Resumen de Alteraciones Activas
                  </span>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-855/60 flex flex-col gap-1.5 text-left text-xs">
                    {biliaryNotes ? (
                      <div className="flex flex-col gap-2 bg-indigo-950/25 p-2.5 rounded-lg border border-indigo-900/30 text-slate-200 font-medium font-sans animate-fadeIn">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                          <div>
                            <span className="text-[9px] uppercase font-black tracking-wider text-indigo-400 block mb-1">Descripción Manual Personalizada:</span>
                            <span className="text-slate-200 font-medium font-sans leading-relaxed">{biliaryNotes}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!biliaryDilated && !biliaryThickening && !biliaryLitosProximal && !biliaryLitosDistal && !biliaryTumor && 
                         !biliaryVesiculaLitos && !biliaryColecistitis && !biliaryVesiculaPared && !biliaryVesiculaBarro && !biliaryVesiculaPolipo ? (
                          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/15 p-2.5 rounded-lg border border-emerald-900/20">
                            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Vía Biliar y Vesícula: de aspecto y calibre normales, sin alteraciones.</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 bg-slate-950/20 p-2 rounded-lg border border-slate-900/30 font-semibold font-sans">
                            {biliaryVesiculaLitos && (
                              <div className="flex items-start gap-1.5 text-amber-450">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                <span><strong>Litos en Vesícula (Colelitiasis):</strong> Múltiples concreciones litiásicas hiperecogénicas móviles con sombra posterior.</span>
                              </div>
                            )}
                            {biliaryColecistitis && (
                              <div className="flex items-start gap-1.5 text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5 animate-pulse" />
                                <span><strong>Colecistitis Aguda:</strong> Pared inflamada engrosada (edema), distensión lumen y Murphy positivo.</span>
                              </div>
                            )}
                            {biliaryVesiculaPared && (
                              <div className="flex items-start gap-1.5 text-amber-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500/80 shrink-0 mt-1.5" />
                                <span><strong>Pared vesicular:</strong> Engrosamiento parietal de aspecto reactivo (&gt;3mm).</span>
                              </div>
                            )}
                            {biliaryVesiculaBarro && (
                              <div className="flex items-start gap-1.5 text-amber-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-800 shrink-0 mt-1.5" />
                                <span><strong>Barro Biliar:</strong> Barro/sludge biliar denso móvil dependiente de la gravedad.</span>
                              </div>
                            )}
                            {biliaryVesiculaPolipo && (
                              <div className="flex items-start gap-1.5 text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                                <span><strong>Pólipos Vesiculares:</strong> Una o más imágenes ecogénicas pequeñas proyecciones fijas a la pared vesicular sin sombra acústica.</span>
                              </div>
                            )}
                            {biliaryDilated && (
                              <div className="flex items-start gap-1.5 text-rose-400 font-bold border-t border-slate-900/50 pt-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                                <span><strong>VBE Dilatada:</strong> Dilatación anormal del conducto colédoco / vía biliar extrahepática.</span>
                              </div>
                            )}
                            {biliaryThickening && (
                              <div className="flex items-start gap-1.5 text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                                <span><strong>Paredes Colédoco:</strong> Engrosamiento inflamatorio de paredes ductales (colangitis).</span>
                              </div>
                            )}
                            {biliaryLitosProximal && (
                              <div className="flex items-start gap-1.5 text-amber-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                <span><strong>Litos Proximales:</strong> Litiasis biliar en conducto hepático común proximal.</span>
                              </div>
                            )}
                            {biliaryLitosDistal && (
                              <div className="flex items-start gap-1.5 text-amber-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                <span><strong>Litos Distales (Enclavado):</strong> Lito impactado en colédoco distal/región ampular.</span>
                              </div>
                            )}
                            {biliaryTumor && (
                              <div className="flex items-start gap-1.5 text-rose-450">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-650 shrink-0 mt-1.5 animate-pulse" />
                                <span><strong>Tumoración / Masa:</strong> Lesión neoformativa sólida sospechosa de neoplasia de vía biliar.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* MINI REPORT INTEGRATION PREVIEW WITH MANUAL EDIT CAPABILITY */}
              <div className="bg-indigo-950/10 p-3.5 rounded-xl border border-indigo-900/40 text-left mt-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                    Editar descripción manualmente / personalizar:
                  </span>
                  {biliaryNotes.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setBiliaryNotes("");
                        setIsVesiculaManuallyOverridden(false);
                        setSyncLogs(prev => [...prev, "🔄 Restablecido el texto automático de Vía Biliar."]);
                      }}
                      className="text-[9px] hover:text-indigo-300 text-indigo-400 underline font-semibold transition-colors cursor-pointer"
                    >
                      Restablecer automático
                    </button>
                  )}
                </div>
                <textarea
                  id="biliary-notes-textarea"
                  rows={3}
                  value={biliaryNotes || getBiliaryTextFromCheckboxes(
                    biliaryDilated,
                    biliaryThickening,
                    biliaryLitosProximal,
                    biliaryLitosDistal,
                    biliaryTumor,
                    biliaryVesiculaLitos,
                    biliaryColecistitis,
                    biliaryVesiculaPared,
                    biliaryVesiculaBarro,
                    biliaryVesiculaLitoUnico,
                    biliaryVesiculaPolipo
                  )}
                  onChange={(e) => {
                    const txt = e.target.value;
                    isManualBiliaryChangeRef.current = true;
                    setBiliaryNotes(txt);
                  }}
                  className="w-full bg-slate-950/80 border border-indigo-950 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 resize-y font-medium leading-relaxed"
                  placeholder="Escriba aquí los hallazgos personalizados, por ejemplo: litiasis única..."
                />
                
                {/* BOTÓN CONFIRMAR Y GRABAR CAMBIOS DE VÍA BILIAR */}
                <div className="pt-2 border-t border-indigo-955/40 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const txtToSave = biliaryNotes.trim() || getBiliaryTextFromCheckboxes(
                        biliaryDilated,
                        biliaryThickening,
                        biliaryLitosProximal,
                        biliaryLitosDistal,
                        biliaryTumor,
                        biliaryVesiculaLitos,
                        biliaryColecistitis,
                        biliaryVesiculaPared,
                        biliaryVesiculaBarro,
                        biliaryVesiculaLitoUnico,
                        biliaryVesiculaPolipo
                      );

                      setBiliaryNotes(txtToSave);
                      setIsVesiculaManuallyOverridden(true);
                      
                      // Sync description to general atlas structure
                      setCustomDescriptions(prev => ({ ...prev, vesicula: txtToSave }));
                      
                      // Sync to report
                      if (onChangeReport && generatedReport) {
                        const updatedAndSynced = updateReportWithBiliaryDesc(generatedReport, txtToSave);
                        onChangeReport(updatedAndSynced);
                      }

                      setSyncLogs(prev => [...prev, `💾 Guardado de Vía Biliar: Cambios grabados en el reporte (${txtToSave.slice(0, 30)}...)`]);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-550 active:scale-98 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer font-mono"
                  >
                    <Check className="h-4 w-4" />
                    Confirmar y Guardar Cambios
                  </button>
                  <p className="text-[9px] text-slate-500 text-center leading-snug">
                    Haga clic aquí para registrar esta descripción tanto en la ficha informativa visual como en la sección de Vía Biliar del reporte médico principal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIAGRAMA INDEPENDIENTE DE APENDICITIS AGUDA */}
      {isAppendixActive && (
        <div id="appendix-section-root" className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-450 font-bold">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono">
                  Esquema: Apéndice Cecal (Apendicitis Aguda)
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Anexo anatómico de Fosa Ilíaca Derecha para mapeo avanzado y simulación de hallazgos obstructivos/inflamatorios.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleToggleIncludeAppendix(!activeIncludeAppendix)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-2 font-mono ${
                  activeIncludeAppendix
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/20"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                {activeIncludeAppendix ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400 font-bold" />
                    <span>Adjuntar al PDF: Sí</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-600 block" />
                    <span>Adjuntar al PDF: No</span>
                  </>
                )}
              </button>

              <span className="text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider bg-rose-950/30 text-rose-450 border border-rose-900/30 animate-pulse">
                Fosa Ilíaca Derecha Evaluada
              </span>
            </div>
          </div>

          {/* TWO COLUMN SIDE-BY-SIDE GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* COLUMN 1: SVG DIBUJO VECTORIAL DE APÉNDICE */}
            <div className="flex flex-col items-center justify-center bg-slate-900/40 border border-slate-850/60 rounded-xl p-4 min-h-[220px]">
              <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 font-mono">DIBUJO DE FOSA ILÍACA DERECHA (FID)</span>
              
              <svg
                id="abdomen-appendix-svg"
                viewBox="0 0 240 240"
                className="w-full h-auto max-w-[210px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="acousticShadow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#020617" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
                  </linearGradient>
                  
                  <linearGradient id="appendixGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={appendixInflamed ? "#f43f5e" : "#808ea0"} />
                    <stop offset="50%" stopColor={appendixInflamed ? "#fda4af" : "#cbd5e1"} />
                    <stop offset="100%" stopColor={appendixInflamed ? "#be123c" : "#475569"} />
                  </linearGradient>

                  <linearGradient id="cecumGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3f3f46" />
                    <stop offset="100%" stopColor="#27272a" />
                  </linearGradient>
                </defs>

                {/* Spine representation / anatomy background */}
                <rect x="10" y="200" width="220" height="15" fill="#1e293b" opacity="0.1" rx="1" />

                {/* CIEGO & COLON (BASE ANATÓMICA) */}
                <g opacity="0.85">
                  <path
                    d="M 25,20 C 50,20 65,30 65,80 C 65,130 50,145 25,145"
                    fill="none"
                    stroke="url(#cecumGrad)"
                    strokeWidth="32"
                    strokeLinecap="round"
                  />
                  {/* Haustras del colon */}
                  <path d="M 12,45 C 38,45 38,60 12,60" fill="none" stroke="#18181b" strokeWidth="1" opacity="0.3" />
                  <path d="M 12,85 C 38,85 38,100 12,100" fill="none" stroke="#18181b" strokeWidth="1" opacity="0.3" />
                  <path d="M 12,125 C 34,125 34,136 12,136" fill="none" stroke="#18181b" strokeWidth="1" opacity="0.3" />
                  <text x="36" y="84" fill="#a1a1aa" fontSize="5.5" fontWeight="black" textAnchor="middle" className="font-sans tracking-wide">CIEGO</text>
                </g>

                {/* HALO DE INFILTRACIÓN DE LA GRASA (FAT STRANDING) */}
                <path
                  d="M 50,100 C 100,100 150,85 185,115 C 205,130 195,190 150,190 C 110,190 80,165 52,143"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="24"
                  strokeLinecap="round"
                  strokeDasharray="4,6"
                  opacity={appendixFatStranding ? "0.35" : "0"}
                  className="transition-all duration-300 pointer-events-none"
                />

                {/* LÍQUIDO LIBRE PERIAPENDICULAR */}
                <path
                  d="M 85,138 C 115,132 155,152 178,142 C 190,165 155,185 120,182 Z"
                  fill="#0284c7"
                  opacity={appendixFluid ? "0.45" : "0"}
                  className="transition-all duration-300 pointer-events-none"
                />

                {/* APÉNDICE CECAL EN SÍ MISMOS */}
                <g className={appendixInflamed ? "animate-pulse" : ""}>
                  <path
                    d="M 46,128 C 88,140 135,114 165,142 C 178,154 162,180 134,178 C 105,176 75,156 50,140"
                    fill="none"
                    stroke="url(#appendixGrad)"
                    strokeWidth={appendixDiameter ? Math.max(3.5, appendixDiameter * 1.5) : 8}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                  
                  {/* Si está inflamado, dibujar líneas de hiperemia (Doppler color) */}
                  {appendixInflamed && (
                    <path
                      d="M 52,130 C 90,141 133,116 161,142 C 172,152 158,174 132,173"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="2,3"
                      opacity="0.8"
                    />
                  )}
                </g>

                {/* INDICADOR DE DIÁMETRO */}
                <g>
                  <line x1="134" y1="130" x2="134" y2="155" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" strokeDasharray="1,1" />
                  <text x="135" y="125" fill="#f43f5e" fontSize="5" fontWeight="bold" textAnchor="middle" className="font-mono">
                    {appendixDiameter}mm
                  </text>
                </g>

                {/* CRISTAL DE APENDICOLITO */}
                {appendixLito && (
                  <g className="transition-all duration-300">
                    {/* Sombra acústica posterior */}
                    <polygon points="76,134 50,225 102,225" fill="url(#acousticShadow)" opacity="0.75" />
                    {/* El lito */}
                    <ellipse cx="76" cy="134" rx="5" ry="4" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
                    <line x1="76" y1="134" x2="160" y2="70" stroke="#ca8a04" strokeWidth="0.4" strokeDasharray="1,1" />
                    <text x="164" y="72" fill="#eab308" fontSize="4.5" fontWeight="black" textAnchor="start" className="font-mono">APENDICOLITO</text>
                  </g>
                )}

                {/* ABSCESO / COLECCIÓN COALICIONADA */}
                {appendixCollections && (
                  <g className="transition-all duration-300">
                    <circle cx="165" cy="165" r="16" fill="#a3e635" opacity="0.25" filter="blur(1px)" />
                    <circle cx="165" cy="165" r="11" fill="none" stroke="#84cc16" strokeWidth="1.5" strokeDasharray="3,3" />
                    <circle cx="165" cy="165" r="6" fill="#ca8a04" opacity="0.3" />
                    <line x1="165" y1="165" x2="210" y2="210" stroke="#84cc16" strokeWidth="0.4" strokeDasharray="1,1" />
                    <text x="212" y="213" fill="#a3e635" fontSize="4.5" fontWeight="black" textAnchor="start" className="font-mono">ABSCESO FID</text>
                  </g>
                )}
              </svg>
            </div>

            {/* COLUMN 2: ACTIVE FINDINGS LIST AND CONTROLS */}
            <div className="flex flex-col gap-4 justify-between bg-slate-950/30 p-4 rounded-xl border border-slate-850/40">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-rose-450 block border-b border-slate-800 pb-1.5 text-left font-mono">
                  Hallazgos de Apendicitis Aguda
                </span>
                
                {/* MANUAL INTERACTIVE CHECKBOXES/CONTROLS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-850/60 shadow-inner">
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="appendix-check-inflamed"
                      checked={appendixInflamed}
                      onChange={(e) => handleAppendixCheckboxChange("inflamed", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Apéndice Inflamado</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="appendix-check-lito"
                      checked={appendixLito}
                      onChange={(e) => handleAppendixCheckboxChange("lito", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Apendicolito Obstructivo</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="appendix-check-fluid"
                      checked={appendixFluid}
                      onChange={(e) => handleAppendixCheckboxChange("fluid", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Líquido Libre Local</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl border border-slate-850/60 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      id="appendix-check-fat"
                      checked={appendixFatStranding}
                      onChange={(e) => handleAppendixCheckboxChange("fatStranding", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Grasa Infiltrada</span>
                  </label>

                  <label className="sm:col-span-2 flex items-center gap-2.5 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-955/20 hover:border-rose-500/30 transition-all cursor-pointer text-xs font-bold text-rose-300">
                    <input
                      type="checkbox"
                      id="appendix-check-collections"
                      checked={appendixCollections}
                      onChange={(e) => handleAppendixCheckboxChange("collections", e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>Absceso o Colección Líquida en FID</span>
                  </label>
                </div>

                {/* APÉNDICE ESTIMATED DIAMETER SLIDER CONTAINER */}
                <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-850/60 shadow-inner space-y-2 text-left">
                  <div className="flex justify-between items-center leading-none select-none">
                    <label htmlFor="appendix-diameter-slider" className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                      Diámetro Transverso del Apéndice (mm)
                    </label>
                    <span className={`text-[11px] font-black uppercase font-mono px-2 py-0.5 rounded border ${
                      appendixDiameter >= 6 
                        ? "text-rose-400 border-rose-950/30 bg-rose-950/20 animate-pulse" 
                        : "text-emerald-400 border-emerald-950/30 bg-emerald-950/15"
                    }`}>
                      {appendixDiameter} mm ({appendixDiameter >= 6 ? "Patológico" : "Normal"})
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    id="appendix-diameter-slider"
                    min="4"
                    max="16"
                    step="1"
                    value={appendixDiameter}
                    onChange={(e) => handleAppendixDiameterChange(parseInt(e.target.value, 10))}
                    className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer transition-all list-none outline-none appearance-none hover:accent-rose-400"
                  />
                  
                  <div className="flex justify-between text-[8px] font-bold text-slate-500 select-none">
                    <span>4 mm (Mín)</span>
                    <span className="text-rose-500/70 font-black">6 mm (Límite superior normal)</span>
                    <span>16 mm (Máx)</span>
                  </div>
                </div>

                {/* RECAP OF RESULTS FROM THE GRAPHICS */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wide text-rose-400 block text-left border-b border-rose-950/30 pb-1 font-mono">
                    Resumen de Síndrome Apendicular
                  </span>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-855/60 flex flex-col gap-1.5 text-left text-xs">
                    {!appendixInflamed && appendixDiameter < 6 && !appendixFluid && !appendixCollections && !appendixLito && !appendixFatStranding ? (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/15 p-2.5 rounded-lg border border-emerald-900/20">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Apéndice Cecal de calibre y grosor normal de FID. No se aprecian signos patológicos agudos.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 bg-slate-950/20 p-2 rounded-lg border border-slate-900/30 font-semibold font-sans">
                        {(appendixInflamed || appendixDiameter >= 6) && (
                          <div className="flex items-start gap-1.5 text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                            <span><strong>Apendicitis:</strong> Diámetro de {appendixDiameter}mm con engrosamiento y signos de hiperemia Doppler.</span>
                          </div>
                        )}
                        {appendixLito && (
                          <div className="flex items-start gap-1.5 text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                            <span><strong>Apendicolito:</strong> Obstrucción litiásica proximal en la luz del apéndice.</span>
                          </div>
                        )}
                        {appendixFluid && (
                          <div className="flex items-start gap-1.5 text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                            <span><strong>Líquido Libre:</strong> Derrame periapendicular secundario a exudado inflamatorio local.</span>
                          </div>
                        )}
                        {appendixFatStranding && (
                          <div className="flex items-start gap-1.5 text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                            <span><strong>Grasa Infiltrada:</strong> Incremento difuso de la ecogenicidad grasa circundante por edema.</span>
                          </div>
                        )}
                        {appendixCollections && (
                          <div className="flex items-start gap-1.5 text-rose-455 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0 mt-1.5" />
                            <span><strong>Colección de Líquido:</strong> Áreа heterogénea compatible con absceso por fase perforada.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MINI REPORT INTEGRATION PREVIEW */}
              <div className="bg-rose-950/5 p-3 rounded-xl border border-rose-900/15 text-left mt-2">
                <span className="text-[9px] font-black uppercase text-rose-450 tracking-wider block mb-1 font-mono">Texto del Reporte Sincronizado</span>
                <p className="text-[11px] text-slate-300 italic font-medium leading-relaxed font-sans">
                  "{getAppendixDescription(appendixInflamed, appendixDiameter, appendixFluid, appendixCollections, appendixLito, appendixFatStranding)}"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIAGRAMA INDEPENDIENTE DE DIVERTICULITIS AGUDA */}
      {isDiverticulitisActive && (
        <div id="diverticulitis-section-root" className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400 font-bold">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono">
                  Esquema: Diverticulitis Aguda & Clasificación de Hinchey
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Anexo del Colon Izquierdo/Sigmoides para simulación de diverticulopatía con estadificación de Hinchey.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleToggleIncludeDiverticulitis(!activeIncludeDiverticulitis)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-2 font-mono ${
                  activeIncludeDiverticulitis
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/20"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                {activeIncludeDiverticulitis ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400 font-bold" />
                    <span>Adjuntar al PDF: Sí</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-600 block" />
                    <span>Adjuntar al PDF: No</span>
                  </>
                )}
              </button>

              <span className="text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider bg-amber-950/30 text-amber-450 border border-amber-900/30 animate-pulse">
                Fosa Ilíaca Izquierda / Pelvis Evaluada
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* COLUMN 1: INTERACTIVE DIAGRAM */}
            <div className="flex flex-col items-center justify-center bg-slate-900/40 border border-slate-850/60 rounded-xl p-4 min-h-[220px]">
              <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 font-mono">DIBUJO DE COLON SIGMOIDES</span>
              
              <svg
                id="abdomen-diverticulitis-svg"
                viewBox="0 0 240 240"
                className="w-full h-auto max-w-[210px] drop-shadow-2xl"
              >
                <defs>
                  <linearGradient id="colonWallGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={diverticulitisWallThickening ? "#f59e0b" : "#64748b"} />
                    <stop offset="100%" stopColor={diverticulitisWallThickening ? "#b45309" : "#334155"} />
                  </linearGradient>
                  <linearGradient id="abscessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>
                </defs>

                {/* Ambient fat stranding lines */}
                {diverticulitisFatStranding && (
                  <g stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" strokeDasharray="3,3">
                    <line x1="70" y1="60" x2="50" y2="50" />
                    <line x1="160" y1="180" x2="180" y2="190" />
                    <line x1="180" y1="120" x2="200" y2="130" stroke="#f59e0b" strokeWidth="2" />
                    <line x1="160" y1="80" x2="184" y2="70" />
                    <line x1="50" y1="140" x2="30" y2="150" />
                  </g>
                )}

                {/* Abscess outline if active */}
                {diverticulitisAbscess && (
                  <circle cx="165" cy="135" r="18" fill="url(#abscessGrad)" opacity="0.8" stroke="#15803d" strokeWidth="1.5" />
                )}

                {/* Sigmoid Colon Loop Path */}
                <path
                  d="M 60 40 Q 180 80 120 140 T 120 220"
                  fill="none"
                  stroke="url(#colonWallGrad)"
                  strokeWidth={diverticulitisWallThickening ? "28" : "18"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />

                {/* Inner lumen */}
                <path
                  d="M 60 40 Q 180 80 120 140 T 120 220"
                  fill="none"
                  stroke={diverticulitisWallThickening ? "#b45309" : "#1e293b"}
                  strokeWidth={diverticulitisWallThickening ? "6" : "10"}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />

                {/* Diverticula sacs protruding if checked */}
                {diverticulitisDiverticula && (
                  <g>
                    {/* Sac 1 */}
                    <circle cx="125" cy="73" r="6" fill={diverticulitisWallThickening ? "#ef4444" : "#94a3b8"} stroke="#ef4444" strokeWidth="1" />
                    {/* Sac 2 */}
                    <circle cx="158" cy="115" r="7" fill={diverticulitisWallThickening ? "#e11d48" : "#64748b"} stroke="#f43f5e" strokeWidth="1.5" />
                    {/* Sac 3 */}
                    <circle cx="78" cy="160" r="5.5" fill={diverticulitisWallThickening ? "#f43f5e" : "#475569"} stroke="#fda4af" strokeWidth="1" />
                  </g>
                )}

                {/* Gas bubbles for free air/perforation */}
                {diverticulitisFreeAir && (
                  <g fill="#02afc7" opacity="0.9" className="animate-bounce">
                    <circle cx="145" cy="95" r="3" />
                    <circle cx="178" cy="100" r="2.5" />
                    <circle cx="150" cy="110" r="1.5" />
                    <circle cx="95" cy="60" r="3.5" />
                  </g>
                )}

                {/* SVG Text Labels */}
                <text x="60" y="30" fill="#cbd5e1" fontSize="9" fontWeight="bold" fontFamily="monospace">COLON DESCENDENTE</text>
                <text x="50" y="225" fill="#cbd5e1" fontSize="9" fontWeight="bold" fontFamily="monospace">RECTO / SIGMOIDES</text>
                
                {diverticulitisWallThickening && (
                  <text x="140" y="170" fill="#f59e0b" fontSize="8" fontWeight="bold" fontFamily="monospace">PARED ENGROSADA</text>
                )}
                {diverticulitisAbscess && (
                  <g>
                    <rect x="145" y="145" width="45" height="11" rx="3" fill="#15803d" opacity="0.8" />
                    <text x="148" y="153" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">ABSCESO</text>
                  </g>
                )}
                {diverticulitisFreeAir && (
                  <text x="135" y="55" fill="#06b6d4" fontSize="8" fontWeight="bold" fontFamily="monospace">GAS LIBRE</text>
                )}
              </svg>

              <div className="flex gap-4 mt-3 flex-wrap justify-center text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-600 border border-slate-500" />
                  <span>Sáculos diverticulares</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-600 border border-amber-500" />
                  <span>Grasa Estriada</span>
                </div>
              </div>
            </div>

            {/* COLUMN 2: CONTROLS & HINCHEY */}
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-450 tracking-wider font-mono block mb-2">Simulación de Hallazgos</span>
                <div className="grid grid-cols-2 gap-2 text-left">
                  
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer">
                    <input
                      id="diverticulitis-check-diverticula"
                      type="checkbox"
                      checked={diverticulitisDiverticula}
                      onChange={(e) => handleDiverticulitisCheckboxChange("diverticula", e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Sáculos Diverticulares</span>
                      <span className="text-[9px] text-slate-500">Múltiples divertículos de sigmoides</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer">
                    <input
                      id="diverticulitis-check-thickening"
                      type="checkbox"
                      checked={diverticulitisWallThickening}
                      onChange={(e) => handleDiverticulitisCheckboxChange("thickening", e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Engrosamiento Parietal</span>
                      <span className="text-[9px] text-slate-500">Pared colónica generalizada &gt; 4 mm</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer">
                    <input
                      id="diverticulitis-check-fat"
                      type="checkbox"
                      checked={diverticulitisFatStranding}
                      onChange={(e) => handleDiverticulitisCheckboxChange("fatStranding", e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Grasa pericólica estriada</span>
                      <span className="text-[9px] text-slate-500">Aumento focal de ecogenicidad grasa</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer">
                    <input
                      id="diverticulitis-check-abscess"
                      type="checkbox"
                      checked={diverticulitisAbscess}
                      onChange={(e) => handleDiverticulitisCheckboxChange("abscess", e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">Colección / Absceso</span>
                      <span className="text-[9px] text-slate-500">Flemón pericólico con necrosis</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer col-span-2">
                    <input
                      id="diverticulitis-check-freeair"
                      type="checkbox"
                      checked={diverticulitisFreeAir}
                      onChange={(e) => handleDiverticulitisCheckboxChange("freeAir", e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span id="diverticulitis-hinchey-value" className="hidden">{diverticulitisHinchey}</span>
                      <span className="text-xs font-bold text-slate-200">Gas extraluminal (Microperforación / Aire libre)</span>
                      <span className="text-[9px] text-slate-500">Signos de perforación y neumoperitoneo secundario</span>
                    </div>
                  </label>

                </div>
              </div>

              {/* CLASIFICACIÓN DE HINCHEY CORRESPONDIENTE EN GRANDE */}
              <div>
                <span className="text-[10px] font-black uppercase text-amber-450 tracking-wider font-mono block mb-2">
                  Clasificación de Hinchey (Estadificación)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { value: "0", label: "Estadio 0", title: "Leve", desc: "Diverticulosis simple sin cambios agudos" },
                    { value: "Ia", label: "Ia", title: "Flemón", desc: "Inflamación pericólica localizada flemónica" },
                    { value: "Ib", label: "Ib", title: "Absceso <5cm", desc: "Absceso pericólico localizado tabicado" },
                    { value: "II", label: "II", title: "Pélvico", desc: "Absceso a distancia pélvico o retroperitoneal" },
                    { value: "III", label: "III", title: "Purulenta", desc: "Peritonitis purulenta generalizada por rotura" },
                    { value: "IV", label: "IV", title: "Fecaloide", desc: "Peritonitis fecaloide por perforación libre" }
                  ].map((stage) => {
                    const isSelected = diverticulitisHinchey === stage.value;
                    return (
                      <button
                        key={stage.value}
                        type="button"
                        onClick={() => handleDiverticulitisHincheyChange(stage.value)}
                        className={`p-2 rounded-xl border transition-all text-center flex flex-col justify-between items-center group relative cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border-amber-500 shadow-md shadow-amber-950/20"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-705"
                        }`}
                        title={stage.desc}
                      >
                        <span className="text-xs font-black tracking-tight">{stage.label}</span>
                        <span className="text-[8px] text-slate-500 font-medium tracking-tighter capitalize leading-none mt-1">{stage.title}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Active Hinchey Explanation Box */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase font-mono">
                      Clasificación de Hinchey Activa:
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Estadio {diverticulitisHinchey}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {diverticulitisHinchey === "0" && "Diverticulosis no inflamada. Los sáculos diverticulares se visualizan sin engrosamientos parietales concéntricos asociados ni alteraciones grasas pericólicas."}
                    {diverticulitisHinchey === "Ia" && "Inflamación pericólica focal limitada (diverticulitis aguda no complicada). Caracterizado ecográficamente por flemón pericólico con aumento de ecogenicidad de la grasa peri-diverticular sin focos purulentos organizados."}
                    {diverticulitisHinchey === "Ib" && "Absceso pericólico o mesocólico inferior a 5 cm, localizado en la vecindad inmediata del colon sigmoides inflamado. Se visualiza como una colección anfractuosa de paredes gruesas."}
                    {diverticulitisHinchey === "II" && "Absceso pélvico, abdominal distante de mayor tamaño o retroperitoneal. Implica propagación progresiva del exudado purulento primario en el espacio retroperitoneal, requiriendo en ocasiones drenaje."}
                    {diverticulitisHinchey === "III" && "Peritonitis purulenta generalizada. Ruptura de un absceso pericólico o flemón hacia la cavidad peritoneal libre. Hay abundante líquido libre ecogénico de aspecto purulento con burbujas gaseosas."}
                    {diverticulitisHinchey === "IV" && "Peritonitis fecaloide generalizada secundaria a una perforación libre con paso de contenido fecal hacia la cavidad. Mortalidad elevada; clínicamente cursa con shock séptico grave."}
                  </p>
                </div>
              </div>

              {/* MINI REPORT INTEGRATION PREVIEW */}
              <div className="bg-amber-950/5 p-3 rounded-xl border border-amber-900/15 text-left mt-1">
                <span className="text-[9px] font-black uppercase text-amber-450 tracking-wider block mb-1 font-mono">Texto del Reporte Sincronizado</span>
                <p className="text-[11px] text-slate-300 italic font-medium leading-relaxed font-sans">
                  "{getDiverticulitisDescription(diverticulitisWallThickening, diverticulitisDiverticula, diverticulitisFatStranding, diverticulitisAbscess, diverticulitisFreeAir, diverticulitisHinchey)}"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN COMPLEMENTARIA INTERACTIVA DE ELASTOGRAFÍA TRANSITORIA Y QUS */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-505/20 text-indigo-400">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono">
                Mapeo de Elastografía Transitoria y QUS (Hígado)
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Añade cuantificaciones inteligentes de rigidez hepática y porcentaje de grasa por QUS.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (setElastographyHasStiffness) {
                  setElastographyHasStiffness(!activeHasStiffness);
                } else {
                  setLocalHasStiffness(!activeHasStiffness);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-2 font-mono ${
                activeHasStiffness
                  ? "bg-indigo-950/80 text-indigo-400 border-indigo-500/50 shadow-md"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              <span>Evaluar Rigidez: {activeHasStiffness ? "Sí" : "No"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleInclude(!activeIncludeElastography)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-2 font-mono ${
                activeIncludeElastography
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/20"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
            >
              {activeIncludeElastography ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400 font-bold" />
                  <span>Adjuntar al PDF: Sí</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-600 block" />
                  <span>Adjuntar al PDF: No</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* COLUMNA IZQUIERDA: DISEÑO DE WORKSTATION MÉDICA DARK PREMIUM */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="relative bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-slate-950/40">
              <svg 
                id="abdomen-elastography-svg" 
                viewBox="0 0 540 210" 
                className="w-full h-auto bg-[#070b13] rounded-xl border border-slate-850"
              >
                {/* GRADIENTS & GLOW EFFECTS DEF */}
                <defs>
                  <linearGradient id="liverTissueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={
                      (() => {
                        const fLevel = getFibrosisLevel(activeStiffness, activeStiffnessOverride);
                        return fLevel === 1 ? "#022c22" : fLevel === 2 ? "#14532d" : fLevel === 3 ? "#431407" : "#500730";
                      })()
                    } />
                    <stop offset="100%" stopColor={
                      (() => {
                        const fLevel = getFibrosisLevel(activeStiffness, activeStiffnessOverride);
                        return fLevel === 1 ? "#06b6d4" : fLevel === 2 ? "#10b981" : fLevel === 3 ? "#f59e0b" : "#e11d48";
                      })()
                    } />
                  </linearGradient>

                  <linearGradient id="barKappaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="35%" stopColor="#10b981" />
                    <stop offset="70%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>

                  <linearGradient id="barGrasaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="35%" stopColor="#a3e635" />
                    <stop offset="70%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>

                  <clipPath id="liverPathClip">
                    <path 
                      d={getFibrosisLevel(activeStiffness, activeStiffnessOverride) === 4
                        ? "M 65,105 Q 80,85 95,90 Q 110,75 125,80 Q 140,70 155,75 Q 170,68 185,75 Q 200,80 215,90 Q 225,105 235,115 Q 240,130 235,143 Q 225,155 215,157 Q 200,163 185,160 Q 170,167 155,163 Q 140,169 125,164 Q 110,165 95,160 Q 80,153 72,140 Q 65,125 65,105 Z"
                        : "M 65,105 C 65,65 125,60 185,70 C 235,80 245,110 235,140 C 220,165 165,170 115,160 C 80,153 65,130 65,105 Z"
                      }
                    />
                  </clipPath>
                  
                  {/* Subtle drop shadow filter for text glowing */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* CYBER BACKGROUND HUD ELEMENTS */}
                <rect width="100%" height="100%" fill="#070b13" rx="10" />
                {/* Tech target rings/radar grids */}
                <circle cx="140" cy="110" r="85" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,5" />
                <circle cx="140" cy="110" r="55" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1,4" />
                
                {/* Left crosshairs */}
                <line x1="140" y1="18" x2="140" y2="28" stroke="#334155" strokeWidth="0.75" />
                <line x1="140" y1="192" x2="140" y2="202" stroke="#334155" strokeWidth="0.75" />
                <line x1="48" y1="110" x2="58" y2="110" stroke="#334155" strokeWidth="0.75" />
                <line x1="222" y1="110" x2="232" y2="110" stroke="#334155" strokeWidth="0.75" />

                {/* GAUGE CARDS BACKGROUND PANELS */}
                {activeHasStiffness ? (
                  <>
                    <rect x="295" y="10" width="112" height="190" rx="12" fill="#0b111e" stroke="#1e293b" strokeWidth="0.8" />
                    <rect x="415" y="10" width="112" height="190" rx="12" fill="#0b111e" stroke="#1e293b" strokeWidth="0.8" />
                  </>
                ) : (
                  <rect x="310" y="10" width="200" height="190" rx="12" fill="#0b111e" stroke="#1e293b" strokeWidth="0.8" />
                )}
                
                {/* LIVER LOBE PARÉNCIMA */}
                <g>
                  {/* SMOOTH OR BUMPY LIVER PROFILE */}
                  <path 
                    d={getFibrosisLevel(activeStiffness, activeStiffnessOverride) === 4
                      ? "M 65,110 Q 80,90 95,95 Q 110,80 125,85 Q 140,75 155,80 Q 170,73 185,80 Q 200,85 215,95 Q 225,110 235,120 Q 240,135 235,148 Q 225,160 215,162 Q 200,168 185,165 Q 170,172 155,168 Q 140,174 125,169 Q 110,170 95,165 Q 80,158 72,145 Q 65,130 65,110 Z"
                      : "M 65,110 C 65,70 125,65 185,75 C 235,85 245,115 235,145 C 220,170 165,175 115,165 C 80,158 65,135 65,110 Z"
                    }
                    fill="url(#liverTissueGrad)"
                    stroke={getFibrosisLevel(activeStiffness, activeStiffnessOverride) === 4 ? "#f43f5e" : "#06b6d4"}
                    strokeWidth={getFibrosisLevel(activeStiffness, activeStiffnessOverride) === 4 ? "2" : "1.2"}
                    opacity="0.9"
                    className="transition-all duration-300"
                  />

                  {/* Concentric ultrasound waves representing attenuation blocks (QUS) */}
                  {(() => {
                    const waveRadii = [30, 50, 70, 90, 110, 130];
                    const attenFactor = Math.min(1, Math.max(0, (activeAttenuation - 0.30) / (0.90)));
                    
                    return (
                      <g clipPath="url(#liverPathClip)">
                        {waveRadii.map((r, idx) => {
                          const depthRatio = idx / (waveRadii.length - 1);
                          const dynamicOpacity = Math.max(0, (0.50 - depthRatio * 0.3) * (1 - attenFactor * depthRatio));
                          const waveColor = attenFactor > 0.50 ? "#fbbf24" : "#22d3ee";
                          
                          return (
                            <circle
                              key={idx}
                              cx="140"
                              cy="40"
                              r={r}
                              fill="none"
                              stroke={waveColor}
                              strokeWidth={0.8 + (1 - depthRatio) * 0.8}
                              strokeDasharray="2,4"
                              opacity={dynamicOpacity}
                              className="transition-all duration-300"
                            />
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* Fibrous scar streaks for >= F3 */}
                  {getFibrosisLevel(activeStiffness, activeStiffnessOverride) >= 3 && (
                    <g stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" fill="none">
                      <path d="M 95,105 Q 115,120 130,110 Q 145,100 160,130" />
                      <path d="M 125,145 Q 150,150 175,120 Q 190,100 210,115" />
                      {getFibrosisLevel(activeStiffness, activeStiffnessOverride) === 4 && (
                        <>
                          <path d="M 80,135 Q 105,125 110,155" />
                          <path d="M 165,87 Q 185,100 195,140" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
                        </>
                      )}
                    </g>
                  )}

                  {/* Lipid Translucent Droplets for Steatosis */}
                  {(() => {
                    const lpf = [
                      { cx: 95, cy: 90, r: "2.0" }, { cx: 125, cy: 85, r: "1.5" }, { cx: 155, cy: 95, r: "2.5" },
                      { cx: 80, cy: 110, r: "1.8" }, { cx: 110, cy: 105, r: "2.2" }, { cx: 140, cy: 110, r: "1.6" },
                      { cx: 170, cy: 100, r: "2.0" }, { cx: 195, cy: 105, r: "1.4" }, { cx: 105, cy: 130, r: "2.5" },
                      { cx: 135, cy: 135, r: "1.6" }, { cx: 165, cy: 125, r: "2.2" }, { cx: 210, cy: 120, r: "2.0" },
                      { cx: 85, cy: 140, r: "1.4" }, { cx: 125, cy: 153, r: "2.0" }, { cx: 155, cy: 147, r: "1.6" }
                    ];
                    let showCount = 0;
                    const sLevel = getSteatosisLevel(activeCAP, activeSteatosisOverride);
                    if (sLevel === 3) showCount = lpf.length;
                    else if (sLevel === 2) showCount = 10;
                    else if (sLevel === 1) showCount = 4;
                    
                    return lpf.slice(0, showCount).map((item, idx) => (
                      <circle 
                        key={idx} 
                        cx={item.cx} 
                        cy={item.cy} 
                        r={item.r} 
                        fill="#fef08a" 
                        stroke="#eab308" 
                        strokeWidth="0.4" 
                        opacity="0.8" 
                      />
                    ));
                  })()}

                  <text x="140" y="114" fill="#ffffff" fontSize="9.5" fontWeight="950" textAnchor="middle" filter="drop-shadow(1px 1px 3px rgba(0,0,0,0.9))" className="select-none pointer-events-none">
                    Foco Hepático
                  </text>
                  <text x="140" y="125" fill="#a5f3fc" fontSize="6.3" fontWeight="bold" textAnchor="middle" filter="drop-shadow(1px 1px 1px rgba(0,0,0,0.9))" className="select-none pointer-events-none uppercase font-mono tracking-wider">
                    {activeHasStiffness ? (() => {
                      const fLevel = getFibrosisLevel(activeStiffness, activeStiffnessOverride);
                      return fLevel === 1 ? "METAVIR F0/F1" : fLevel === 2 ? "METAVIR F2" : fLevel === 3 ? "METAVIR F3" : "METAVIR F4";
                    })() : "CUANTIFICACIÓN QUS"}
                  </text>
                </g>

                {/* CENTRAL GRID SPLITTER */}
                {activeHasStiffness && (
                  <line x1="275" y1="15" x2="275" y2="195" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.8"/>
                )}

                {/* RIGHT COLUMN: GAUGE 1 (RIGIDEZ - KAPPA) */}
                {activeHasStiffness && (
                  <g transform="translate(295, 10)">
                    <text x="56" y="28" fill="#94a3b8" fontSize="6.5" fontWeight="black" textAnchor="middle" letterSpacing="0.8" className="font-mono">RIGIDEZ (kPa)</text>
                    
                    {/* Arc gauges track background */}
                    <path d="M 21,110 A 35,35 0 0,1 91,110" fill="none" stroke="#111827" strokeWidth="6" strokeLinecap="round" />
                    <path d="M 21,110 A 35,35 0 0,1 91,110" fill="none" stroke="url(#barKappaGrad)" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
                    
                    {/* Needle position calculated */}
                    <line 
                      x1="56" y1="110" 
                      x2={(() => {
                        const ratio = Math.min(1, Math.max(0, (activeStiffness - 2.0) / 23.0));
                        const angle = Math.PI - ratio * Math.PI;
                        return 56 + 32 * Math.cos(angle);
                      })()} 
                      y2={(() => {
                        const ratio = Math.min(1, Math.max(0, (activeStiffness - 2.0) / 23.0));
                        const angle = Math.PI - ratio * Math.PI;
                        return 110 - 32 * Math.sin(angle);
                      })()} 
                      stroke="#ffffff" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                    />
                    <circle cx="56" cy="110" r="4.5" fill="#f43f5e" stroke="#070b13" strokeWidth="1.5" />

                    <text x="56" y="142" fill="#ffffff" fontSize="13.5" fontWeight="900" textAnchor="middle" className="font-mono">
                      {activeStiffness.toFixed(1)} <tspan fontSize="7.5" fill="#94a3b8" fontWeight="bold">kPa</tspan>
                    </text>
                    
                    {(() => {
                      const fLevel = getFibrosisLevel(activeStiffness, activeStiffnessOverride);
                      const fColor = fLevel === 1 ? "#22d3ee" : fLevel === 2 ? "#34d399" : fLevel === 3 ? "#fbbf24" : "#f43f5e";
                      const fLabel = fLevel === 1 ? "F0-F1 Sano" : fLevel === 2 ? "F2 Moderada" : fLevel === 3 ? "F3 Avanzada" : "F4 Cirrosis";
                      return (
                        <g>
                          <rect x="11" y="156" width="90" height="15" rx="7.5" fill={fLevel === 1 ? "rgba(34,211,238,0.15)" : fLevel === 2 ? "rgba(52,211,153,0.15)" : fLevel === 3 ? "rgba(251,191,36,0.15)" : "rgba(244,63,94,0.15)"} stroke={fColor} strokeWidth="0.8" />
                          <text x="56" y="166" fill={fColor} fontSize="6.8" fontWeight="bold" textAnchor="middle" className="uppercase font-mono tracking-wider">
                            {fLabel}
                          </text>
                        </g>
                      );
                    })()}

                    <text x="21" y="118" fill="#475569" fontSize="5.5" fontWeight="black" className="font-mono">2.0</text>
                    <text x="91" y="118" fill="#475569" fontSize="5.5" fontWeight="black" textAnchor="end" className="font-mono">25.0</text>
                  </g>
                )}

                {/* RIGHT COLUMN: GAUGE 2 (PORCENTAJE DE GRASA POR QUS) */}
                <g transform={activeHasStiffness ? "translate(415, 10)" : "translate(354, 10)"}>
                  <text x="56" y="28" fill="#94a3b8" fontSize="6.5" fontWeight="black" textAnchor="middle" letterSpacing="0.8" className="font-mono">GRASA QUS (%)</text>
                  
                  {/* Arc gauges track background */}
                  <path d="M 21,110 A 35,35 0 0,1 91,110" fill="none" stroke="#111827" strokeWidth="6" strokeLinecap="round" />
                  <path d="M 21,110 A 35,35 0 0,1 91,110" fill="none" stroke="url(#barGrasaGrad)" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
                  
                  {/* Needle position */}
                  <line 
                    x1="56" y1="110" 
                    x2={(() => {
                      const ratio = Math.min(1, Math.max(0, (activeFatFraction - 1.0) / 39.0));
                      const angle = Math.PI - ratio * Math.PI;
                      return 56 + 32 * Math.cos(angle);
                    })()} 
                    y2={(() => {
                      const ratio = Math.min(1, Math.max(0, (activeFatFraction - 1.0) / 39.0));
                      const angle = Math.PI - ratio * Math.PI;
                      return 110 - 32 * Math.sin(angle);
                    })()} 
                    stroke="#ffffff" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                  <circle cx="56" cy="110" r="4.5" fill="#fbbf24" stroke="#070b13" strokeWidth="1.5" />

                  <text x="56" y="142" fill="#ffffff" fontSize="13.5" fontWeight="900" textAnchor="middle" className="font-mono">
                    {activeFatFraction.toFixed(1)} <tspan fontSize="7.5" fill="#94a3b8" fontWeight="bold">%</tspan>
                  </text>
                  
                  {(() => {
                    const sLevel = activeFatFraction < 5.0 ? 0 : activeFatFraction < 12.0 ? 1 : activeFatFraction < 22.0 ? 2 : 3;
                    const sColor = sLevel === 0 ? "#34d399" : sLevel === 1 ? "#a3e635" : sLevel === 2 ? "#fbbf24" : "#f97316";
                    const sLabel = sLevel === 0 ? "Normal" : sLevel === 1 ? "Leve" : sLevel === 2 ? "Moderado" : "Severo";
                    return (
                      <g>
                        <rect x="11" y="156" width="90" height="15" rx="7.5" fill={sLevel === 0 ? "rgba(52,211,153,0.15)" : sLevel === 1 ? "rgba(163,230,53,0.15)" : sLevel === 2 ? "rgba(251,191,36,0.15)" : "rgba(249,115,22,0.15)"} stroke={sColor} strokeWidth="0.8" />
                        <text x="56" y="166" fill={sColor} fontSize="6.8" fontWeight="bold" textAnchor="middle" className="uppercase font-mono tracking-wider">
                          {sLabel}
                        </text>
                      </g>
                    );
                  })()}

                  <text x="21" y="118" fill="#475569" fontSize="5.5" fontWeight="black" className="font-mono">1.0</text>
                  <text x="91" y="118" fill="#475569" fontSize="5.5" fontWeight="black" textAnchor="end" className="font-mono">40.0</text>
                </g>
              </svg>
            </div>

            {/* QUICK PRESETS CARDS FOR COMBINATIONS */}
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-2xl flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-1.5 leading-none">
                <Sparkles className="h-3.5 w-3.5 text-indigo-450 animate-pulse" />
                Preajustes Clínicos Básicos (kPa / % Grasa):
              </span>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1.5 font-mono">
                <button
                  type="button"
                  onClick={() => applyPreset(4.2, 195, 0.45, 3.2)}
                  className="py-1 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-850 text-emerald-400 border border-slate-800 transition-all cursor-pointer"
                >
                  Sano F0-Normal
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(5.4, 245, 0.61, 7.8)}
                  className="py-1 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-850 text-blue-400 border border-slate-800 transition-all cursor-pointer"
                >
                  Leve F1-Leve
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(7.3, 275, 0.73, 13.8)}
                  className="py-1 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-850 text-amber-500 border border-slate-800 transition-all cursor-pointer"
                >
                  Moderado F2-Mod
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(10.8, 305, 0.83, 22.4)}
                  className="py-1 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-850 text-orange-400 border border-slate-800 transition-all cursor-pointer"
                >
                  Avanzado F3-Sev
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(18.5, 335, 0.94, 32.5)}
                  className="py-1 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-850 text-red-500 border border-slate-800 transition-all cursor-pointer col-span-2 xs:col-span-1"
                >
                  Cirrosis F4-Sev
                </button>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: LOS ÚNICOS 2 ELEMENTOS DE CONTROL MANUAL REQUERIDOS */}
          <div className="lg:col-span-6 flex flex-col gap-4 justify-center">
            
             {/* PARAM 1: RIGIDEZ HEPÁTICA */}
             {activeHasStiffness && (
               <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-2.5 animate-fadeIn">
                 <div className="flex justify-between items-center leading-none">
                   <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-250 font-mono text-left flex items-center gap-2">
                     <span className="h-2 w-2 rounded-full bg-indigo-500" />
                     RIGIDEZ HEPÁTICA (kPa / Fibrosis)
                   </span>
                   <span className="text-sm font-black font-mono text-indigo-400 shrink-0">
                     {activeStiffness.toFixed(1)} kPa
                   </span>
                 </div>
                 <input
                   type="range"
                   min="2.0"
                   max="25.0"
                   step="0.1"
                   value={activeStiffness}
                   onChange={(e) => handleStiffnessChange(parseFloat(e.target.value))}
                   className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                 />
                 <div className="grid grid-cols-4 text-[8px] font-bold text-slate-500 font-mono leading-none pt-1">
                   <span className="text-left">Normal &lt;6.0</span>
                   <span className="text-center">Mod f2 (6.0-8.0)</span>
                   <span className="text-center">Avanzada f3 (8.0-12.5)</span>
                   <span className="text-right">Cirrosis f4 &gt;=12.5</span>
                 </div>
               </div>
             )}

            {/* PARAM 2: PORCENTAJE DE GRASA (QUS) */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-2.5">
              <div className="flex justify-between items-center leading-none">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-250 font-mono text-left flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  PORCENTAJE DE GRASA POR QUS (%)
                </span>
                <span className="text-sm font-black font-mono text-emerald-450 shrink-0">
                  {activeFatFraction.toFixed(1)} %
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="40.0"
                step="0.1"
                value={activeFatFraction}
                onChange={(e) => handleFatFractionChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="grid grid-cols-4 text-[8px] font-bold text-slate-500 font-mono leading-none pt-1">
                <span className="text-left">Normal &lt;5.0%</span>
                <span className="text-center">Leve (5.0-12.0%)</span>
                <span className="text-center">Moderado (12.1-22.0%)</span>
                <span className="text-right">Severo &gt;22.0%</span>
              </div>
            </div>

            {/* SINTESIS DE HALLAZGOS SINTONIZADOS */}
            <div className="bg-slate-950/50 p-4 border border-slate-850/65 rounded-2xl flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#06b6d4] font-mono leading-none text-left">
                {activeHasStiffness 
                  ? "📋 Interpretación Médica de Hallazgos Sintonizados (QUS & Elastografía)" 
                  : "📋 Interpretación Médica de Hallazgos Sintonizados (Cuantificación QUS)"
                }
              </span>
              <p className="text-[11px] leading-relaxed text-slate-400 text-left">
                {activeHasStiffness ? (
                  <>
                    La rigidez hepática sintonizada de <strong className="text-slate-100 font-mono">{activeStiffness.toFixed(1)} kPa</strong> es sugerente de <strong className="text-indigo-400">{
                      (() => {
                        const fLevel = getFibrosisLevel(activeStiffness, activeStiffnessOverride);
                        return fLevel === 1 ? "elasticidad tisular conservada (F0-F1, sin fibrosis significativa)" : 
                               fLevel === 2 ? "fibrosis hepática significativa leve a moderada (compatible con METAVIR F2)" : 
                               fLevel === 3 ? "fibrosis avanzada pre-cirrótica crónica (compatible con METAVIR F3)" : 
                               "cirrosis hepática crónica establecida u obstrucción severa (METAVIR F4)";
                      })()
                    }</strong>.{" "}
                    El contenido graso hepático estimado por QUS es del <strong className="text-emerald-400 font-mono">{activeFatFraction.toFixed(1)}%</strong>, lo cual se asocia a <strong className="text-amber-500">{
                      (() => {
                        if (activeFatFraction < 5.0) return "rango fisiológico normal";
                        if (activeFatFraction < 12.0) return "infiltración grasa hepática leve";
                        if (activeFatFraction < 22.0) return "infiltración grasa hepática moderada";
                        return "infiltración grasa hepática severa";
                      })()
                    }</strong>.
                  </>
                ) : (
                  <>
                    El contenido graso hepático estimado por QUS es del <strong className="text-emerald-400 font-mono">{activeFatFraction.toFixed(1)}%</strong>, lo cual se asocia a <strong className="text-amber-500">{
                      (() => {
                        if (activeFatFraction < 5.0) return "rango fisiológico normal";
                        if (activeFatFraction < 12.0) return "infiltración grasa hepática leve";
                        if (activeFatFraction < 22.0) return "infiltración grasa hepática moderada";
                        return "infiltración grasa hepática severa";
                      })()
                    }</strong>.
                  </>
                )}
              </p>
            </div>
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
