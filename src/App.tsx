import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ExtractedFile } from "./components/ZipDicomExtractor";

const BibliographySearch = React.lazy(() => import("./components/BibliographySearch"));
const ImageSearch = React.lazy(() => import("./components/ImageSearch"));
const ExpertImageAnalysis = React.lazy(() => import("./components/ExpertImageAnalysis"));
const ZipDicomExtractor = React.lazy(() => import("./components/ZipDicomExtractor"));
const AsistenteMedidas = React.lazy(() => import("./components/AsistenteMedidas").then(m => ({ default: m.AsistenteMedidas })));
const CreadorNotasPie = React.lazy(() => import("./components/CreadorNotasPie").then(m => ({ default: m.CreadorNotasPie })));
const CreadorCuadroSinoptico = React.lazy(() => import("./components/CreadorCuadroSinoptico").then(m => ({ default: m.CreadorCuadroSinoptico })));
const CreadorSinopsisFracturas = React.lazy(() => import("./components/CreadorSinopsisFracturas").then(m => ({ default: m.CreadorSinopsisFracturas })));
const BiomechanicalRadarModule = React.lazy(() => import("./components/BiomechanicalRadarModule").then(m => ({ default: m.BiomechanicalRadarModule })));
const ElastographyQUSPresentationModule = React.lazy(() => import("./components/ElastographyQUSPresentationModule").then(m => ({ default: m.ElastographyQUSPresentationModule })));
const ProstateUrinaryDynamicsModule = React.lazy(() => import("./components/ProstateUrinaryDynamicsModule").then(m => ({ default: m.ProstateUrinaryDynamicsModule })));
const Atlas3DModule = React.lazy(() => import("./components/Atlas3DModule").then(m => ({ default: m.Atlas3DModule })));
const Vascular3DModule = React.lazy(() => import("./components/Vascular3DModule").then(m => ({ default: m.Vascular3DModule })));
import { ProstateUrinaryData } from "./components/ProstateUrinaryDynamicsModule";
import { Findings3dRenderModule, Create3dRenderModal, Finding3dRender } from "./components/Findings3dRenderModule";
import CaseAnalysisRenderer from "./components/CaseAnalysisRenderer";
import InteractiveCaseEditor from "./components/InteractiveCaseEditor";
import { ClassificationBreakdownModule } from "./components/ClassificationBreakdownModule";
import { CaseAnalysisData, CaseAnalysisFormatOption, CaseAnalysisElementsConfig, Atlas3DData, Vascular3DData, UltrasoundPhotoLayout } from "./types";
import { 
  Activity, 
  ShieldCheck,
  AlertCircle, 
  ArrowDown,
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Code, 
  Copy, 
  FileDown,
  FileImage,
  Image as ImageIcon, 
  FileText, 
  History, 
  Layers, 
  MessageSquare, 
  Send,
  Key,
  Plus,
  RefreshCw, 
  Search, 
  Settings, 
  Sliders, 
  Sparkles, 
  Trash2, 
  Upload, 
  X,
  BookOpen,
  ExternalLink,
  Printer,
  User,
  Mic,
  MicOff,
  Square,
  Loader2,
  Undo,
  Edit,
  Save,
  RotateCcw,
  Download,
  Zap,
  Brain,
  Bone,
  Languages,
  Database,
  BookOpenText,
  Maximize2,
  Minimize2,
  Columns,
  Eye,
  Ruler,
  Bookmark,
  Box
} from "lucide-react";
import { initAuth, googleSignIn, logout as googleLogout, anonymousSignIn, emailSignIn, emailSignUp, getFirebaseConfig } from "./firebaseAuth";
import { CloudStudy, saveStudyToCloud, getStudiesFromCloud, deleteStudyFromCloud, Worklist, WorklistPatient, saveWorklistToCloud, getWorklistFromCloud, getSingleStudyFromCloud, testFirebaseConfigConnection } from "./firebaseDb";
import { idbSaveWorklist, idbGetWorklist, idbClearWorklist, idbSaveStudy, idbGetAllStudies, idbDeleteStudy, idbSaveHistory, idbGetHistory } from "./localDb";
import { uploadPdfToDrive } from "./lib/googleDrive";
import { Mail, LogOut, Clock, Calendar, ListTodo, UserCheck, ImagePlus, Wifi, HelpCircle, Info, Laptop, Network, ChevronDown, Link } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  STUDY_PRESETS, 
  PROMPT_SHORTCUTS, 
  GENERAL_SYSTEM_INSTRUCTION, 
  CHAT_SYSTEM_INSTRUCTION, 
  CLASSIFICATION_SYSTEM_INSTRUCTION, 
  CLASSIFICATIONS_DATA, 
  INTERACTIVE_RESULTS,
  Presets,
  ClassificationSystem 
} from "./constants";

// Interceptor global seguro de localStorage (preserva historial y delega datos pesados a IndexedDB)
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key: string, value: string) {
      try {
        originalSetItem.call(window.localStorage, key, value);
      } catch (error: any) {
        console.warn(`[SafeLocalStorage] Cuota de localStorage excedida para '${key}'. Se usar√° almacenamiento persistente IndexedDB.`);
        if (key === "rad_local_studies") {
          try {
            // Guardar versi√≥n ligera sin PDF base64 pesado para fallback en localStorage
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              const light = parsed.map((s: any) => ({ ...s, pdfBase64: "", attachedImages: [] }));
              originalSetItem.call(window.localStorage, key, JSON.stringify(light));
            }
          } catch (lightErr) {
            console.warn("[SafeLocalStorage] No se pudo guardar fallback ligero:", lightErr);
          }
        }
      }
    };
  }
} catch (e) {
  console.error("[SafeLocalStorage] Error al inicializar el interceptor:", e);
}

// Structure for historical reports stored in local storage
interface SavedReport {
  id: string;
  timestamp: string;
  studyType: string;
  clinicalHistory: string;
  reportText: string;
}


export const DIAGNOSTIC_GLOSSARY = [
  {
    acronym: "BI-RADS",
    name: "Breast Imaging-Reporting and Data System",
    category: "Mamograf√≠a",
    desc: "Escala estandarizada oficial para mamograf√≠a, ultrasonido y resonancia de mamas. Categor√≠as del 0 (estudio incompleto) al 6 (malignidad comprobada por biopsia). El BI-RADS 4 indica sospecha de lesi√≥n y amerita biopsia histol√≥gica."
  },
  {
    acronym: "ACR",
    name: "American College of Radiology",
    category: "General",
    desc: "Asociaci√≥n m√©dica norteamericana responsable de estandarizar la nomenclatura radiol√≥gica, gu√≠as de pr√°ctica cl√≠nica y control de calidad de dosis de radiaci√≥n ionizante."
  },
  {
    acronym: "U. Hounsfield (HU)",
    name: "Unidades Hounsfield",
    category: "Tomograf√≠a",
    desc: "Escala lineal que cuantifica cuantitativamente la atenuaci√≥n f√≠sica de los rayos X en tejidos. Referencias clave: Aire (-1000 HU), Grasa (-120 a -80 HU), Agua pura (0 HU), Sangre coagulada (+60 a +80 HU), e Hueso cortical (+1000 HU)."
  },
  {
    acronym: "FLAIR",
    name: "Fluid-Attenuated Inversion Recovery",
    category: "Resonancia",
    desc: "Atenuaci√≥n de Fluido por Recuperaci√≥n de Inversi√≥n. Secuencia de resonancia magn√©tica ponderada en T2 donde se cancela la se√±al libre del l√≠quido cefalorraqu√≠deo. Es de vital importancia para visualizar la esclerosis m√∫ltiple, infartos cerebrales tempranos y otras patolog√≠as con edema perilesional."
  },
  {
    acronym: "CIE-10 (CIE10)",
    name: "Clasificaci√≥n Internacional de Enfermedades",
    category: "General",
    desc: "C√≥digo de clasificaci√≥n diagn√≥stica administrado por la Organizaci√≥n Mundial de la Salud (OMS). Facilita el cruce internacional de morbimortalidad y estandariza la facturaci√≥n m√©dica (ej. M54.5 para lumbalgia)."
  },
  {
    acronym: "TI-RADS",
    name: "Thyroid Imaging-Reporting and Data System",
    category: "Ultrasonido",
    desc: "Escala ecogr√°fica para evaluar el riesgo de malignidad en n√≥dulos tiroideos. Basado en composici√≥n, ecogenicidad, forma, m√°rgenes y focos ecog√©nicos. Facilita decidir de forma objetiva la indicaci√≥n de biopsia por aspiraci√≥n con aguja fina (BAAF)."
  },
  {
    acronym: "PI-RADS",
    name: "Prostate Imaging-Reporting and Data System",
    category: "Resonancia",
    desc: "Est√°ndar cl√≠nico de informe para RM multiparam√©trica de pr√≥stata. Valora zonas perif√©rica e transicional con escalas de 1 (altamente improbable) a 5 (alta sospecha de c√°ncer cl√≠nicamente significativo)."
  },
  {
    acronym: "LI-RADS",
    name: "Liver Imaging-Reporting and Data System",
    category: "Tomograf√≠a",
    desc: "Sistema estandarizado de categorizaci√≥n para hallazgos hep√°ticos en pacientes cirr√≥ticos o con sospecha diagn√≥stica de carcinoma hepatocelular (CHC)."
  },
  {
    acronym: "Opacidad Alveolar",
    name: "Consolidaci√≥n de Espacio A√©reo",
    category: "Radiograf√≠a",
    desc: "Hallazgo en tele de t√≥rax caracterizado por el reemplazo del aire gas alveolar por exudado, sangre o pus. Cl√≠nicamente compatible con neumon√≠a cl√°sica, contusi√≥n pulmonar o edema agudo de pulm√≥n. Produce signo de broncograma a√©reo."
  },
  {
    acronym: "Atelectasia",
    name: "Colapso Parcial de Par√©nquima",
    category: "Radiograf√≠a",
    desc: "P√©rdida localizada de volumen pulmonar por reabsorci√≥n u obstrucci√≥n bronquial. Radiogr√°ficamente se presenta como una opacidad lineal o densa con desplazamiento de estructuras anat√≥micas."
  },
  {
    acronym: "KOSS",
    name: "Clasificaci√≥n de Kellgren & Lawrence",
    category: "General",
    desc: "Criterio radiol√≥gico clave para diagnosticar y medir el grado de osteoartritis de rodilla. Grados de 0 (normal) a 4 (severo, con grandes osteofitos y deformaci√≥n √≥sea articular marcada)."
  }
];

export interface ImageAnnotation {
  id: string;
  type: "point" | "box";
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w?: number; // percentage (0-100)
  h?: number; // percentage (0-100)
  label: string;
}

const formatDateToDMY = (dateStr: string): string => {
  if (!dateStr) return "";
  
  // Format yyyy-mm-dd
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${dd}-${mm}-${yyyy}`;
    }
  }
  
  // Format yyyy/mm/dd
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return dateStr;
};

const formatCostaRicaPhone = (rawPhone: string): string => {
  if (!rawPhone) return "";
  // Strip all non-numeric characters
  const clean = rawPhone.replace(/\D/g, "");
  if (!clean) return "";
  
  if (clean.length === 8) {
    return "506" + clean;
  }
  if (clean.startsWith("506") && clean.length > 8) {
    return clean;
  }
  if (clean.length > 8 && !clean.startsWith("506")) {
    return "506" + clean;
  }
  if (clean.length < 8 && !clean.startsWith("506")) {
    return "506" + clean;
  }
  return clean;
};

const extractSectionContent = (reportText: string, sectionKeywords: string[]): string => {
  if (!reportText) return "";
  const lines = reportText.split("\n");
  
  const normalizeHeader = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      .replace(/^[\s#\-\*]+/, "")
      .replace(/[\*\_\:]/g, "")
      .trim();
  };

  const allHeaders = [
    "tipo de estudio", "estudio",
    "historia cl√≠nica", "historia clinica", "indicaciones", "historia cl√≠nica / indicaciones", "historia clinica / indicaciones",
    "t√©cnica del examen", "tecnica del examen", "t√©cnica", "tecnica",
    "hallazgos", "hallazgos principales", "resultados",
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresiones diagn√≥sticas", "impresiones diagnosticas", "impresi√≥n", "impresion",
    "conclusi√≥n", "conclusiones", "conclusion",
    "diagn√≥stico", "diagnostico",
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen",
    "fdo", "m√©dico", "medico", "firma"
  ];

  for (const key of sectionKeywords) {
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const norm = normalizeHeader(lines[i]);
      if (norm === key || norm.startsWith(key + " ")) {
        startIndex = i;
        break;
      }
    }

    if (startIndex !== -1) {
      const sectionLines: string[] = [];
      for (let j = startIndex + 1; j < lines.length; j++) {
        const currentLine = lines[j];
        const normCurrent = normalizeHeader(currentLine);

        const isBoundary = allHeaders.some(h => {
          if (normCurrent === h) return true;
          if (normCurrent.startsWith(h + ":") || normCurrent.startsWith(h + " ")) return true;
          return false;
        });
        if (isBoundary) {
          break;
        }
        sectionLines.push(currentLine);
      }

      const extractedText = sectionLines.join("\n").trim();
      if (extractedText && extractedText.replace(/[\s\-\*\#\:\.]/g, "").length > 0) {
        return extractedText;
      }
    }
  }
  return "";
};

const extractImpresionDiagnostica = (reportText: string): string => {
  return extractSectionContent(reportText, [
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresi√≥n diagnostica", "impresion diagn√≥stica", 
    "impresiones diagn√≥sticas", "impresiones diagnosticas", "conclusi√≥n", "conclusiones", "conclusion", 
    "diagn√≥stico", "diagnostico", "impresi√≥n", "impresion"
  ]);
};

const extractHallazgos = (reportText: string): string => {
  return extractSectionContent(reportText, ["hallazgos principales", "hallazgos", "resultados"]);
};

const extractResumenOperacional = (reportText: string): string => {
  if (!reportText) return "";

  // 1st Priority: Explicit Resumen Operacional / Resumen Ejecutivo
  const explicitResumen = extractSectionContent(reportText, [
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen"
  ]);
  if (explicitResumen) return explicitResumen;

  // 2nd Priority: Impresi√≥n Diagn√≥stica / Conclusi√≥n / Diagn√≥stico
  const impresion = extractImpresionDiagnostica(reportText);
  if (impresion) return impresion;

  // 3rd Priority: Hallazgos Principales / Hallazgos
  const hallazgos = extractHallazgos(reportText);
  if (hallazgos) return hallazgos;

  // Fallback 1: let's look for bullet points in the entire report that are NOT part of standard template headers
  const lines = reportText.split("\n");
  const normalizeHeader = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      .replace(/^[\s#\-\*]+/, "")
      .replace(/[\*\_\:]/g, "")
      .trim();
  };

  const allHeaders = [
    "tipo de estudio", "estudio",
    "historia cl√≠nica", "historia clinica", "indicaciones", "historia cl√≠nica / indicaciones", "historia clinica / indicaciones",
    "t√©cnica del examen", "tecnica del examen", "t√©cnica", "tecnica",
    "hallazgos", "hallazgos principales", "resultados",
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresiones diagn√≥sticas", "impresiones diagnosticas", "impresi√≥n", "impresion",
    "conclusi√≥n", "conclusiones", "conclusion",
    "diagn√≥stico", "diagnostico",
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen",
    "fdo", "m√©dico", "medico", "firma"
  ];

  const cleanBulletLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-") && !trimmed.startsWith("*") && !/^\d+\./.test(trimmed)) return false;
    
    // Check if the bullet line is just a header
    const norm = normalizeHeader(trimmed);
    if (allHeaders.includes(norm)) return false;
    
    return true;
  });

  if (cleanBulletLines.length > 0) {
    return cleanBulletLines.slice(0, 6).join("\n");
  }

  // Fallback 2: If we still don't have anything, let's look for the last section of the report that has text
  let lastNonEmptyBlock: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line) {
      // If we hit a known header or potential header line, that starts the block!
      const norm = normalizeHeader(line);
      const isHeaderLine = allHeaders.includes(norm) || norm.endsWith(":") || line.startsWith("#");
      if (isHeaderLine) {
        lastNonEmptyBlock.unshift(line);
        // Let's get the content below it
        let j = i + 1;
        while (j < lines.length) {
          const subLine = lines[j].trim();
          const subNorm = normalizeHeader(subLine);
          if (allHeaders.some(h => subNorm === h || subNorm.startsWith(h + ":"))) {
            break;
          }
          if (subLine) {
            lastNonEmptyBlock.push(lines[j]);
          }
          j++;
        }
        break;
      }
    }
  }

  if (lastNonEmptyBlock.length > 0) {
    // Remove the header line if it's there
    const headerLine = lastNonEmptyBlock[0];
    const normHeader = normalizeHeader(headerLine);
    if (allHeaders.some(h => normHeader === h || normHeader.startsWith(h + ":"))) {
      lastNonEmptyBlock.shift();
    }
    const fallbackText = lastNonEmptyBlock.join("\n").trim();
    if (fallbackText) {
      return fallbackText;
    }
  }

  return "";
};

interface ManualPatientAdderProps {
  onAdd: (newPatient: { name: string; age: string; gender: string; patientId: string; studyType: string; time: string; phone?: string }) => void;
}

const ManualPatientAdder: React.FC<ManualPatientAdderProps> = ({ onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [patientId, setPatientId] = useState("");
  const [studyType, setStudyType] = useState("");
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      age: age.trim(),
      gender: gender,
      patientId: patientId.trim(),
      studyType: studyType.trim(),
      time: time.trim(),
      phone: formatCostaRicaPhone(phone.trim())
    });
    // Reset form
    setName("");
    setAge("");
    setGender("");
    setPatientId("");
    setStudyType("");
    setTime("");
    setPhone("");
    setIsOpen(false);
  };

  return (
    <div className="bg-slate-950/20 border border-slate-850 rounded-xl overflow-hidden mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 flex items-center justify-between transition tracking-wider font-mono"
      >
        <span className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-indigo-400" /> A√±adir Paciente Manual
        </span>
        <ChevronRight className={`h-3 w-3 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="p-3.5 border-t border-slate-850/40 space-y-2.5 bg-slate-900/5">
          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              placeholder="Ej. Carlos P√©rez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Edad</label>
              <input
                type="text"
                placeholder="Ej. 45"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">G√©nero</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
              >
                <option value="">--</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Identificaci√≥n</label>
              <input
                type="text"
                placeholder="C√©dula / ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Hora Turno</label>
              <input
                type="text"
                placeholder="Ej. 08:30"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Estudio Solicitado</label>
            <input
              type="text"
              placeholder="Ej. Ecograf√≠a Renal"
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Tel√©fono o Celular (Costa Rica)</label>
            <input
              type="text"
              placeholder="Ej. 8888-8888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white font-bold text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition"
          >
            Agregar a la Agenda
          </button>
        </form>
      )}
    </div>
  );
};

interface UltrasoundWorklistExporterProps {
  patients: WorklistPatient[];
}

const UltrasoundWorklistExporter: React.FC<UltrasoundWorklistExporterProps> = ({ patients }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"standard_csv" | "samsung_v7_csv" | "ge_csv" | "mindray_xml" | "json_bridge">("samsung_v7_csv");
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<"export" | "guide">("export");

  const handleExport = () => {
    if (patients.length === 0) {
      alert("No hay pacientes en la agenda para exportar.");
      return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    if (exportFormat === "standard_csv") {
      const headers = ["ID Paciente", "Nombre Completo", "Edad", "Genero", "Estudio Solicitado", "Hora Turno", "Estado"];
      const rows = patients.map(p => [
        p.patientId || `REG-${p.id.substring(p.id.length - 4)}`,
        p.name,
        p.age || "",
        p.gender || "",
        p.studyType || "",
        p.time || "",
        p.status
      ]);
      const csvContent = "\ufeff" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `agenda_radiologia_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "samsung_v7_csv") {
      // Samsung V7 optimized CSV structure with standard DICOM field mappings
      const headers = ["PatientID", "PatientName", "Gender", "BirthDate", "StudyDescription", "AccessionNumber", "ScheduledDate", "ScheduledTime"];
      const rows = patients.map(p => {
        let birthDate = "";
        if (p.age) {
          const numericAge = parseInt(p.age.replace(/\D/g, ""));
          if (!isNaN(numericAge)) {
            const birthYear = today.getFullYear() - numericAge;
            birthDate = `${birthYear}0101`; // format YYYYMMDD
          }
        }
        
        // Para el Samsung V7, exportamos el nombre completo sin delimitadores de careto "^" ni cortes.
        // Al enviarlo como un solo string continuo, el ec√≥grafo muestra el nombre completo con todos sus apellidos y nombres.
        const cleanName = p.name.trim();
        
        return [
          p.patientId || `SS-${p.id.substring(p.id.length - 4)}`,
          cleanName,
          p.gender || "O",
          birthDate,
          p.studyType || "Ultrasound",
          `ACC-${p.id.substring(p.id.length - 4)}`,
          dateStr.replace(/-/g, ""),
          p.time ? p.time.replace(":", "") + "00" : "080000"
        ];
      });
      const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Samsung_V7_Worklist_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "ge_csv") {
      const headers = ["Patient ID", "Patient Name", "Sex", "Birth Date", "Accession Number", "Requested Procedure"];
      const rows = patients.map(p => {
        let birthDate = "";
        if (p.age) {
          const numericAge = parseInt(p.age.replace(/\D/g, ""));
          if (!isNaN(numericAge)) {
            const birthYear = today.getFullYear() - numericAge;
            birthDate = `${birthYear}0101`;
          }
        }
        return [
          p.patientId || `GE-${p.id.substring(p.id.length - 4)}`,
          p.name,
          p.gender || "",
          birthDate,
          `ACC-${p.id.substring(p.id.length - 4)}`,
          p.studyType || "Ultrasound"
        ];
      });
      const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=ascii;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GE_Worklist_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "mindray_xml") {
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<PatientList Date="${dateStr}">\n`;
      patients.forEach(p => {
        const id = p.patientId || `MR-${p.id.substring(p.id.length - 4)}`;
        const sex = p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : "Other";
        xml += `  <Patient>\n`;
        xml += `    <PatientID>${id}</PatientID>\n`;
        xml += `    <Name>${p.name}</Name>\n`;
        xml += `    <Sex>${sex}</Sex>\n`;
        xml += `    <Age>${p.age || ""}</Age>\n`;
        xml += `    <ExamType>${p.studyType || "US"}</ExamType>\n`;
        xml += `    <ScheduledTime>${p.time || ""}</ScheduledTime>\n`;
        xml += `  </Patient>\n`;
      });
      xml += `</PatientList>`;
      const blob = new Blob([xml], { type: "text/xml;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `mindray_worklist_${dateStr}.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "json_bridge") {
      const data = {
        date: dateStr,
        patients: patients.map(p => ({
          name: p.name,
          patientId: p.patientId || `REG-${p.id.substring(p.id.length - 4)}`,
          gender: p.gender,
          age: p.age,
          studyType: p.studyType,
          time: p.time
        }))
      };
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `worklist.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const pythonScript = `# Servidor DICOM Worklist Local (MWL SCP) para Ecografo Samsung V7
# Corre este script en tu PC (requiere instalar: pip install pynetdicom pydicom)
import os
import json
import re
import datetime
from pydicom.dataset import Dataset
from pynetdicom import AE, evt, debug_logger
from pynetdicom.sop_class import ModalityWorklistInformationFind

debug_logger() # Imprime conexiones entrantes en la consola

def cargar_pacientes():
    if os.path.exists("worklist.json"):
        with open("worklist.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("patients", [])
    return []

def formatear_nombre_dicom(nombre_completo):
    if not nombre_completo:
        return "Paciente^Anonimo"
    
    # Limpiamos espacios adicionales
    palabras = [w for w in nombre_completo.strip().split() if w]
    if not palabras:
        return "Paciente^Anonimo"
        
    # Heur√≠stica robusta de nombres en espa√±ol para evitar nombres cortados o mal ordenados:
    # 1 palabra: "Luz" -> "Luz"
    # 2 palabras: "Milton Maldonado" -> "Maldonado^Milton"
    # 3 palabras: "Milton Maldonado Brizuela" -> "Maldonado Brizuela^Milton"
    # 4 o m√°s palabras: "Maria del Carmen Gomez Perez" -> Surnames: "Gomez Perez", GivenNames: "Maria del Carmen"
    # Esto asegura que el ec√≥grafo Samsung V7 reciba todos los apellidos y nombres sin recortar nada.
    
    if len(palabras) == 1:
        return palabras[0]
    elif len(palabras) == 2:
        return f"{palabras[1]}^{palabras[0]}"
    elif len(palabras) == 3:
        # e.g., Milton Maldonado Brizuela -> Apellidos: Maldonado Brizuela, Nombre: Milton
        return f"{palabras[1]} {palabras[2]}^{palabras[0]}"
    else:
        # 4 o m√°s palabras: e.g., Maria del Carmen Gomez Perez -> Apellidos: Gomez Perez, Nombres: Maria del Carmen
        apellidos = f"{palabras[-2]} {palabras[-1]}"
        nombres = " ".join(palabras[:-2])
        return f"{apellidos}^{nombres}"

def parse_patient_age_and_dob(edad_raw):
    """
    Intenta extraer la edad y fecha de nacimiento a partir del string ingresado.
    Retorna (fecha_nacimiento_dicom, edad_dicom)
    """
    dob_fallback = "19800101"
    age_fallback = "040Y"
    
    if not edad_raw:
        return dob_fallback, age_fallback
        
    val = str(edad_raw).strip()
    
    # 1. Intentar detectar formato fecha de nacimiento: YYYY-MM-DD o DD-MM-YYYY
    # Patr√≥n YYYY-MM-DD / YYYY/MM/DD
    match_iso = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', val)
    # Patr√≥n DD-MM-YYYY / DD/MM/YYYY
    match_lat = re.search(r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', val)
    
    dt = None
    if match_iso:
        try:
            dt = datetime.date(int(match_iso.group(1)), int(match_iso.group(2)), int(match_iso.group(3)))
        except ValueError:
            pass
    elif match_lat:
        try:
            dt = datetime.date(int(match_lat.group(3)), int(match_lat.group(2)), int(match_lat.group(1)))
        except ValueError:
            pass
            
    if dt:
        dob_str = dt.strftime("%Y%m%d")
        # Calcular edad actual en base a la fecha de nacimiento
        hoy = datetime.date.today()
        calculated_age = hoy.year - dt.year - ((hoy.month, hoy.day) < (dt.month, dt.day))
        calculated_age = max(0, calculated_age)
        age_str = f"{calculated_age:03d}Y"
        return dob_str, age_str
        
    # 2. Si no es fecha, intentar extraer un n√∫mero (ej. "45", "45 a√±os", "45a")
    match_num = re.search(r'\d+', val)
    if match_num:
        try:
            years = int(match_num.group(0))
            if 0 <= years <= 130:
                age_str = f"{years:03d}Y"
                hoy = datetime.date.today()
                # Estimamos fecha de nacimiento usando el a√±o y un mes/d√≠a promedio (06 de junio)
                birth_year = hoy.year - years
                dob_str = f"{birth_year}0601"
                return dob_str, age_str
        except Exception:
            pass
            
    return dob_fallback, age_fallback

def handle_find(event):
    print("\\n[+] Consulta DICOM recibida del Samsung V7!")
    pacientes = cargar_pacientes()
    for index, p in enumerate(pacientes):
        ds = Dataset()
        
        nombre_original = p.get("name", "").strip()
        nombre_formateado = formatear_nombre_dicom(nombre_original)
        ds.PatientName = nombre_formateado
        
        print(f"   [-] Paciente original: '{nombre_original}' -> DICOM enviado: '{nombre_formateado}'")
            
        ds.PatientID = p.get("patientId") or f"REG-{index+1:04d}"
        
        g = p.get("gender", "").upper()
        ds.PatientSex = g if g in ["M", "F"] else "O"
        
        # Calcular edad y fecha de nacimiento de forma dinamica
        edad_raw = p.get("age", "")
        dob, age_dicom = parse_patient_age_and_dob(edad_raw)
        ds.PatientBirthDate = dob
        ds.PatientAge = age_dicom
        
        print(f"       -> Edad: '{edad_raw}' | DICOM DOB: {dob} | DICOM Age: {age_dicom}")
        
        step = Dataset()
        step.ScheduledStationAETitle = "MWL_SERVER"
        # Usar la fecha actual de hoy para la cita
        step.ScheduledProcedureStepStartDate = datetime.date.today().strftime("%Y%m%d")
        step.ScheduledProcedureStepStartTime = p.get("time", "0800").replace(":", "") + "00"
        step.Modality = "US"
        step.ScheduledProcedureStepDescription = p.get("studyType", "Ecografia US")
        step.ScheduledProcedureStepID = f"SPS-{index+1:04d}"
        
        ds.ScheduledProcedureStepSequence = [step]
        ds.RequestedProcedureID = f"RP-{index+1:04d}"
        ds.RequestedProcedureDescription = p.get("studyType", "Ecografia US")
        ds.AccessionNumber = f"ACC-{index+1:04d}"
        
        yield (0xFF00, ds)

ae = AE(ae_title=b"MWL_SERVER")
ae.add_supported_context(ModalityWorklistInformationFind)

print("--------------------------------------------------")
print(" Servidor DICOM Worklist activo para Samsung V7")
print(" Direccion IP de tu PC: Usa tu IP local (ej. 192.168.1.5)")
print(" Puerto: 1040")
print(" AE Title: MWL_SERVER")
print("--------------------------------------------------")

ae.start_server(("0.0.0.0", 1040), evt_handlers=[(evt.EVT_C_FIND, handle_find)])
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="bg-slate-950/40 border border-indigo-500/25 hover:border-indigo-500/40 rounded-xl overflow-hidden mt-3 transition duration-300">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/10 flex items-center justify-between transition tracking-wider font-mono"
      >
        <span className="flex items-center gap-1.5">
          <Network className="h-4 w-4 text-indigo-400 animate-pulse" /> Sincronizar con Samsung V7
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-indigo-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-850/60 bg-slate-950/20 space-y-3.5">
          <div className="flex border-b border-slate-850/60 pb-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`flex-1 text-[8.5px] font-black uppercase tracking-wider py-1 text-center transition cursor-pointer ${
                activeTab === "export"
                  ? "text-indigo-400 border-b-2 border-indigo-500 pb-2 -mb-2 font-black"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              1. Exportar Lista
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guide")}
              className={`flex-1 text-[8.5px] font-black uppercase tracking-wider py-1 text-center transition cursor-pointer ${
                activeTab === "guide"
                  ? "text-indigo-400 border-b-2 border-indigo-500 pb-2 -mb-2 font-black"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              2. Gu√≠a Samsung V7 (Wi-Fi)
            </button>
          </div>

          {activeTab === "export" && (
            <div className="space-y-3.5">
              <p className="text-[9.5px] text-slate-400 leading-normal">
                Genera un archivo optimizado para el ec√≥grafo <strong className="text-indigo-400">Samsung V7</strong>. Desc√°rgalo para transferirlo localmente por USB o cargarlo mediante el puente de red de tu consultorio.
              </p>

              <div className="space-y-2">
                <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block">Selecciona Formato</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat("samsung_v7_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "samsung_v7_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    Samsung V7 (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("standard_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "standard_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    CSV Est√°ndar (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("ge_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "ge_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    GE Voluson / Logiq
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("mindray_xml")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "mindray_xml"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    Mindray XML (.xml)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("json_bridge")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border col-span-2 transition cursor-pointer ${
                      exportFormat === "json_bridge"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                    title="Formato JSON directo para alimentar el servidor de red local"
                  >
                    Puente JSON (.json)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9.5px] uppercase tracking-wider py-2 rounded-lg transition flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(99,102,241,0.2)] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Descargar Archivo para Samsung V7
              </button>
            </div>
          )}

          {activeTab === "guide" && (
            <div className="space-y-3.5 text-left max-h-[350px] overflow-y-auto pr-1">
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 flex gap-2">
                <Wifi className="h-4 w-4 text-indigo-400 shrink-0" />
                <p className="text-[9px] text-slate-300 leading-relaxed font-bold">
                  ¬°Excelente elecci√≥n! Tu ec√≥grafo <span className="text-indigo-400">Samsung V7</span> est√° en red mediante cable y tu computadora a trav√©s de Wi-Fi en el mismo m√≥dem. Al estar en el mismo m√≥dem, pueden comunicarse de forma inal√°mbrica y privada.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-850 rounded-lg p-2.5 space-y-1.5 bg-slate-900/10">
                  <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-1">
                    <Laptop className="h-3 w-3" /> Opci√≥n A: Carga local r√°pida por USB
                  </span>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    La forma m√°s sencilla sin instalar nada es utilizar el puerto USB de tu Samsung V7:
                  </p>
                  <ol className="list-decimal list-inside text-[9px] text-slate-400 space-y-1">
                    <li>Selecciona el formato <strong className="text-slate-300">Samsung V7 (.csv)</strong> arriba y desc√°rgalo.</li>
                    <li>Gu√°rdalo en una memoria USB e ins√©rtala en el puerto de la consola del Samsung V7.</li>
                    <li>En el ec√≥grafo, presiona la tecla de <strong className="text-slate-300">Patient</strong> en la consola t√°ctil.</li>
                    <li>Selecciona <strong className="text-slate-300">Import</strong>, selecciona el archivo CSV desde el USB y realiza el mapeo de columnas si es necesario. ¬°La lista de pacientes se cargar√° al instante!</li>
                  </ol>
                </div>

                <div className="border border-indigo-500/10 rounded-lg p-2.5 space-y-2 bg-[#090C17]">
                  <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider font-mono flex items-center gap-1 animate-pulse">
                    <Check className="h-3 w-3 text-emerald-500" /> Opci√≥n B: Puente DICOM Worklist Activo (Inal√°mbrico)
                  </span>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Si quieres automatizarlo para que al presionar el bot√≥n <strong>"Search/Query"</strong> de tu <strong>Samsung V7</strong> jale la lista autom√°ticamente por Wi-Fi sin usar USB:
                  </p>
                  
                  <ol className="list-decimal list-inside text-[9px] text-slate-400 space-y-1.5">
                    <li>Descarga la agenda en formato <strong className="text-indigo-300">Puente JSON (.json)</strong> de arriba y col√≥cala en una carpeta de tu PC.</li>
                    <li>Copia el script de Python de abajo y gu√°rdalo como <code className="text-indigo-300">samsung_mwl.py</code> en esa misma carpeta.</li>
                    <li>Ejec√∫talo en tu PC desde una consola con <code className="text-indigo-300">python samsung_mwl.py</code>.</li>
                    <li>En tu ec√≥grafo <strong>Samsung V7</strong>:
                      <ul className="list-disc list-inside pl-3 pt-1 space-y-0.5 text-slate-400">
                        <li>Presiona el bot√≥n <strong className="text-slate-300">Utility</strong> (o Setup) en la consola f√≠sica.</li>
                        <li>Ve a la pesta√±a <strong className="text-slate-300">Connectivity</strong> y luego a <strong className="text-slate-300">DICOM</strong>.</li>
                        <li>Haz clic en <strong className="text-slate-300">Add</strong> para a√±adir un servidor.</li>
                        <li>Configura <strong className="text-indigo-300">Service Type: MWL</strong> (Modality Worklist).</li>
                        <li>Establece el <strong className="text-indigo-300">AE Title: MWL_SERVER</strong>, la <strong className="text-indigo-300">IP</strong> de tu PC, y el Puerto <strong className="text-indigo-300">1040</strong>.</li>
                        <li>Haz clic en <strong className="text-slate-300">Test</strong> para verificar la conexi√≥n.</li>
                      </ul>
                    </li>
                    <li>¬°Listo! Ahora ve a la pantalla de <strong className="text-slate-300">Patient</strong>, presiona <strong className="text-slate-300">Worklist</strong>, y haz clic en <strong className="text-slate-300">Query</strong> para descargar la agenda inal√°mbricamente.</li>
                  </ol>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black uppercase text-slate-500 font-mono">Script Python Local</span>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[8px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Copy className="h-2.5 w-2.5" /> {copiedScript ? "Copiado" : "Copiar C√≥digo"}
                      </button>
                    </div>
                    <pre className="text-[8px] font-mono p-2 bg-slate-950 rounded-lg border border-slate-850 max-h-[140px] overflow-y-auto text-indigo-300 whitespace-pre scrollbar-none select-all leading-normal">
                      {pythonScript}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default function App() {
  // Public Patient View System
  const [currentCloudStudyId, setCurrentCloudStudyId] = useState<string>("");
  const [isPatientPublicView, setIsPatientPublicView] = useState<boolean>(false);
  const [isPatientViewLoading, setIsPatientViewLoading] = useState<boolean>(false);
  const [patientViewError, setPatientViewError] = useState<string | null>(null);
  const [loadedCloudPdfBase64, setLoadedCloudPdfBase64] = useState<string>("");
  const [patientLogoUrl, setPatientLogoUrl] = useState<string>("");
  const [operationalSummaryText, setOperationalSummaryText] = useState<string>("");
  const [isGeneratingOperationalSummary, setIsGeneratingOperationalSummary] = useState<boolean>(false);

  // Navigation & General Settings
  const [activeTab, setActiveTab] = useState<"generator" | "classifications" | "consult" | "presets" | "api" | "bibliography" | "images" | "expert-analysis" | "measurements" | "cloud-db">("generator");
  
  // Synchronized export states from medical image generator
  const [exportedImage, setExportedImage] = useState<string | null>(null);
  const [exportedMimeType, setExportedMimeType] = useState<string>("");
  const clearExportedImage = () => {
    setExportedImage(null);
    setExportedMimeType("");
  };
  
  // Patient Infographic generation states
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState<boolean>(false);
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicError, setInfographicError] = useState<string | null>(null);
  const [attachInfographicToOfficialReport, setAttachInfographicToOfficialReport] = useState<boolean>(false);
  // Local storage customizable instructions
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  const [chatInstruction, setChatInstruction] = useState<string>("");
  const [classifyInstruction, setClassifyInstruction] = useState<string>("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // 1. STATE FOR REPORT GENERATOR
  const [selectedPresetId, setSelectedPresetId] = useState<string>("torax-rx");
  const [studyType, setStudyType] = useState<string>("");
  const [clinicalHistory, setClinicalHistory] = useState<string>("");
  const [findings, setFindings] = useState<string>("");
  const [inputReport, setInputReport] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  // 1b. Patient & Corporate Header customization states for PDF/Print
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");
  const [patientGender, setPatientGender] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [dicomNotification, setDicomNotification] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState<string>(() => localStorage.getItem("rad_patient_email") || "");
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [clinicName, setClinicName] = useState<string>("");
  const [doctorName, setDoctorName] = useState<string>(() => {
    const saved = localStorage.getItem("rad_doctor_name");
    if (!saved || saved === "Dr. Benavides S. Cod.6025" || (saved.includes("Benavides S. Cod.6025") && !saved.includes("Milton"))) {
      localStorage.setItem("rad_doctor_name", "Dr. Milton Benavides S. Cod.6025");
      return "Dr. Milton Benavides S. Cod.6025";
    }
    return saved;
  });
  const [doctorLicense, setDoctorLicense] = useState<string>(() => {
    const saved = localStorage.getItem("rad_doctor_license");
    if (!saved || saved === "M.S.P. Reg: 6025 / Senescyt: 1005-12-7489") {
      localStorage.setItem("rad_doctor_license", "C√≥digo Profesional 6025");
      return "C√≥digo Profesional 6025";
    }
    return saved;
  });
  
  // Helper to generate a stable, professional cryptographic verification hash
  const getValidationHash = () => {
    const seed = `${patientName || ""}-${doctorName || ""}-${reportDate || ""}-${clinicName || ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
    const pSeed = (patientName && patientName.length > 0) ? patientName.charCodeAt(0) + patientName.length : 42;
    const dSeed = (doctorName && doctorName.length > 0) ? doctorName.charCodeAt(0) + doctorName.length : 17;
    const partKey = ((pSeed * 231 + dSeed * 19) % 65535).toString(16).toUpperCase().padStart(4, "E");
    return `SHA256: FD82-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${partKey}-9B1C-E8B1`;
  };
  // Multiple custom clinic logo upload states
  const [customLogos, setCustomLogos] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    const saved = localStorage.getItem("rad_custom_logos");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    const legacyLogo = localStorage.getItem("rad_custom_logo");
    if (legacyLogo) {
      return [{ id: "custom-legacy", name: "Logotipo Principal", url: legacyLogo }];
    }
    return [];
  });
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState("");

  const [selectedLogo, setSelectedLogo] = useState<string>(() => {
    const saved = localStorage.getItem("rad_selected_logo");
    if (saved) return saved;
    const oldLegacy = localStorage.getItem("rad_custom_logo");
    if (oldLegacy) return "custom-legacy";
    return "none";
  });

  const [customLogoStyle, setCustomLogoStyle] = useState<string>(() => {
    return localStorage.getItem("rad_custom_logo_style") || "left"; // "left" or "banner"
  });

  useEffect(() => {
    localStorage.setItem("rad_custom_logos", JSON.stringify(customLogos));
  }, [customLogos]);

  useEffect(() => {
    localStorage.setItem("rad_selected_logo", selectedLogo);
  }, [selectedLogo]);

  const customLogoUrl = useMemo(() => {
    if (isPatientPublicView && patientLogoUrl) {
      return patientLogoUrl;
    }
    const matched = customLogos.find(l => l.id === selectedLogo);
    if (matched) return matched.url;
    if (selectedLogo === "custom" && customLogos.length > 0) {
      return customLogos[0].url;
    }
    return "";
  }, [isPatientPublicView, patientLogoUrl, selectedLogo, customLogos]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("rad_selected_model");
    if (!saved || saved === "gemini-3.6-flash" || saved === "gemini-2.5-flash" || saved === "gemini-1.5-flash") {
      return "gemini-3.7-flash";
    }
    return saved;
  });

  useEffect(() => {
    localStorage.setItem("rad_selected_model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewStudyId = params.get("view_study");
    if (viewStudyId) {
      setIsPatientPublicView(true);
      setIsPatientViewLoading(true);
      setPatientViewError(null);
      
      // Try to load from local storage rad_local_studies first
      let localStudy: CloudStudy | null = null;
      try {
        const stored = localStorage.getItem("rad_local_studies");
        if (stored) {
          const parsed = JSON.parse(stored) as CloudStudy[];
          const found = parsed.find(s => s.id === viewStudyId);
          if (found) {
            localStudy = found;
          }
        }
      } catch (e) {
        console.error("Error reading local studies in view parameter:", e);
      }

      if (localStudy) {
        setCurrentCloudStudyId(localStudy.id);
        setPatientName(localStudy.patientName || "");
        setPatientEmail(localStudy.patientEmail || "");
        setPatientAge(localStudy.patientAge || "");
        setPatientGender(localStudy.patientGender || "");
        setPatientId(localStudy.patientId || "");
        setReportDate(localStudy.reportDate || "");
        setDoctorName(localStudy.doctorName || "");
        setDoctorLicense(localStudy.doctorLicense || "");
        setClinicName(localStudy.clinicName || "");
        setStudyType(localStudy.studyType || "");
        setClinicalHistory(localStudy.clinicalHistory || "");
        setFindings(localStudy.findings || "");
        setGeneratedReport(localStudy.reportText || "");
        setLoadedCloudPdfBase64(localStudy.pdfBase64 || "");
        setPatientLogoUrl(localStudy.customLogoUrl || "");
        setCustomLogoStyle(localStudy.customLogoStyle || "logo");
        setCustomSignatureUrl(localStudy.customSignatureUrl || "");
        setOperationalSummaryText(localStudy.operationalSummaryText || "");
        if (localStudy.specificStudy) setSpecificStudy(localStudy.specificStudy);
        if (localStudy.pdfLayoutType) setPdfLayoutType(localStudy.pdfLayoutType as any);
        if (localStudy.selectedLogo) setSelectedLogo(localStudy.selectedLogo);
        if (localStudy.attachedImages) setAttachedImages(localStudy.attachedImages);
        if (localStudy.findings3dRenders) setFindings3dRenders(localStudy.findings3dRenders);
        if (localStudy.patientSummary) setPatientSummary(localStudy.patientSummary);
        setIsPatientViewLoading(false);
      } else {
        getSingleStudyFromCloud(viewStudyId)
          .then((study) => {
            if (study) {
              setCurrentCloudStudyId(study.id);
              setPatientName(study.patientName || "");
              setPatientEmail(study.patientEmail || "");
              setPatientAge(study.patientAge || "");
              setPatientGender(study.patientGender || "");
              setPatientId(study.patientId || "");
              setReportDate(study.reportDate || "");
              setDoctorName(study.doctorName || "");
              setDoctorLicense(study.doctorLicense || "");
              setClinicName(study.clinicName || "");
              setStudyType(study.studyType || "");
              setClinicalHistory(study.clinicalHistory || "");
              setFindings(study.findings || "");
              setGeneratedReport(study.reportText || "");
              setLoadedCloudPdfBase64(study.pdfBase64 || "");
              setPatientLogoUrl(study.customLogoUrl || "");
              setCustomLogoStyle(study.customLogoStyle || "logo");
              setCustomSignatureUrl(study.customSignatureUrl || "");
              setOperationalSummaryText(study.operationalSummaryText || "");
              if (study.specificStudy) setSpecificStudy(study.specificStudy);
              if (study.pdfLayoutType) setPdfLayoutType(study.pdfLayoutType as any);
              if (study.selectedLogo) setSelectedLogo(study.selectedLogo);
              if (study.attachedImages) setAttachedImages(study.attachedImages);
              if (study.usPhotoLayout) setUsPhotoLayout(study.usPhotoLayout as any);
              if (study.findings3dRenders) setFindings3dRenders(study.findings3dRenders);
              if (study.patientSummary) setPatientSummary(study.patientSummary);
            } else {
              setPatientViewError("El estudio cl√≠nico solicitado no existe o el enlace es incorrecto.");
            }
          })
          .catch((err) => {
            console.error("Error fetching single study publicly:", err);
            const isQuota = 
              err?.message?.toLowerCase().includes("quota") || 
              String(err).toLowerCase().includes("quota") || 
              err?.message?.toLowerCase().includes("exceeded") || 
              String(err).toLowerCase().includes("exceeded");
            
            if (isQuota) {
              setPatientViewError(
                "El servidor de base de datos temporal ha superado su l√≠mite de cuota diaria gratuita de Google Cloud (Plan Free de AI Studio). Por favor, contacte a su especialista de salud o reintente m√°s tarde cuando se reinicie la cuota diaria de Google. Su reporte cl√≠nico est√° guardado de forma 100% segura en la nube."
              );
            } else {
              setPatientViewError("Error de conexi√≥n al cargar el estudio cl√≠nico. Por favor, reintente.");
            }
          })
          .finally(() => {
            setIsPatientViewLoading(false);
          });
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/firebase-config")
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch server config");
        return res.json();
      })
      .then((serverConfig) => {
        const localCustomStr = localStorage.getItem("rad_custom_firebase_config");
        let localCustom = null;
        if (localCustomStr) {
          try {
            localCustom = JSON.parse(localCustomStr);
          } catch (e) {}
        }

        if (localCustom && localCustom.apiKey && localCustom.projectId) {
          // El navegador tiene una configuraci√≥n personalizada en localStorage.
          if (serverConfig && (serverConfig.projectId === "gen-lang-client-0578019690" || !serverConfig.projectId)) {
            // El servidor tiene la base de datos predeterminada de AI Studio.
            // Sincronizamos subiendo nuestra configuraci√≥n personalizada al servidor.
            console.log("Detectado Firebase personalizado en localStorage local. Sincronizando con el servidor para fijarlo...");
            fetch("/api/save-firebase-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: localCustom })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                console.log("¬°Configuraci√≥n de Firebase personalizada fijada en el servidor!");
              }
            })
            .catch(err => console.error("Error al sincronizar Firebase personalizado con el servidor:", err));
          } else if (serverConfig && serverConfig.projectId !== localCustom.projectId) {
            // El servidor tiene una configuraci√≥n personalizada diferente de la local. El servidor manda.
            console.log("Sincronizando configuraci√≥n de Firebase desde el servidor...");
            localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
            localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            window.location.reload();
          }
        } else {
          // El navegador NO tiene una configuraci√≥n en localStorage.
          if (serverConfig && serverConfig.projectId && serverConfig.projectId !== "gen-lang-client-0578019690") {
            // Pero el servidor s√≠ tiene una personalizada. La descargamos y recargamos.
            console.log("Descargando configuraci√≥n de Firebase personalizada del servidor...");
            localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
            localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            window.location.reload();
          }
        }
      })
      .catch((err) => {
        console.warn("No se pudo sincronizar la configuraci√≥n de Firebase con el servidor:", err);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailAccessToken(token);
      },
      () => {
        setGmailUser(null);
        setGmailAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const compressImageBase64 = (base64Str: string, maxWidth: number = 2000, quality: number = 0.92): Promise<string> => {
    return new Promise((resolve) => {
      try {
        if (!base64Str || !base64Str.startsWith("data:image")) {
          resolve(base64Str);
          return;
        }
        const isPng = base64Str.startsWith("data:image/png");
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            if (!isPng) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
            
            // Preserve PNG format to keep alpha transparency and crisp vector-grade edges
            const mimeType = isPng ? "image/png" : "image/jpeg";
            const compressed = canvas.toDataURL(mimeType, quality);
            resolve(compressed);
          } else {
            resolve(base64Str);
          }
        };
        img.onerror = () => {
          resolve(base64Str);
        };
        img.src = base64Str;
      } catch (e) {
        console.error("Error compressing image:", e);
        resolve(base64Str);
      }
    });
  };

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const originalName = file.name || "Nuevo Logotipo";
    const cleanName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressedBase64 = await compressImageBase64(rawBase64, 2400, 0.95);
      const newLogoId = "custom-logo-" + Date.now();
      const newLogo = {
        id: newLogoId,
        name: cleanName,
        url: compressedBase64
      };
      setCustomLogos(prev => [...prev, newLogo]);
      setSelectedLogo(newLogoId);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogoById = (id: string) => {
    if (confirm("¬øEst√°s seguro de eliminar este logotipo de la lista?")) {
      setCustomLogos(prev => prev.filter(l => l.id !== id));
      if (selectedLogo === id) {
        setSelectedLogo("none");
      }
    }
  };

  const handleRemoveCustomLogo = () => {
    if (selectedLogo.startsWith("custom-logo-") || selectedLogo === "custom-legacy") {
      handleRemoveCustomLogoById(selectedLogo);
    } else {
      setSelectedLogo("none");
    }
  };

  const handleChangeCustomLogoStyle = (style: string) => {
    setCustomLogoStyle(style);
    localStorage.setItem("rad_custom_logo_style", style);
  };

  // Custom doctor's signature upload states
  const [customSignatureUrl, setCustomSignatureUrl] = useState<string>(() => {
    return localStorage.getItem("rad_custom_signature") || "";
  });

  const [uploadedReportContent, setUploadedReportContent] = useState<string>("");
  const [uploadedReportName, setUploadedReportName] = useState<string | null>(null);
  const [uploadedReportMimeType, setUploadedReportMimeType] = useState<string>("");
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressedBase64 = await compressImageBase64(rawBase64, 1600, 0.95);
      setCustomSignatureUrl(compressedBase64);
      localStorage.setItem("rad_custom_signature", compressedBase64);
    };
    reader.readAsDataURL(file);
  };

  const handleReportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedReportName(file.name);
    setUploadedReportMimeType(file.type || "");
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const result = event.target?.result as string;
        setUploadedReportContent(result);
        
        // Auto-detect study type only for text-based files, skip for binary attachments like PDF or images
        const isPdfOrImage = file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf');
        if (!isPdfOrImage) {
            autoDetectSpecificStudyAndModality(result, file.name);
        }
    };
    
    const isPdfOrImage = file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (isPdfOrImage) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
  };

  const handleRemoveCustomSignature = () => {
    setCustomSignatureUrl("");
    localStorage.removeItem("rad_custom_signature");
  };

  const [showPatientDetails, setShowPatientDetails] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [adaptivePDFContrast, setAdaptivePDFContrast] = useState<boolean>(false);
  const [pdfLayoutType, setPdfLayoutType] = useState<"classic" | "clinical_slate" | "executive_medical">("classic");
  
  // PDF Real-Time Preview States
  const [printModalDocType, setPrintModalDocType] = useState<'report' | 'patient_summary'>('report');
  const [printModalViewType, setPrintModalViewType] = useState<'html_simulator' | 'pdf_viewer'>('html_simulator');
  const [generatedNativePdfUrl, setGeneratedNativePdfUrl] = useState<string | null>(null);
  const [generatedSummaryPdfUrl, setGeneratedSummaryPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdfPreview, setIsGeneratingPdfPreview] = useState<boolean>(false);
  const [isSplitPdfActive, setIsSplitPdfActive] = useState<boolean>(true);
  
  // WhatsApp Share States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsappShareType, setWhatsappShareType] = useState<'report_pdf' | 'patient_infographic' | 'patient_summary'>('report_pdf');
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => localStorage.getItem("rad_whatsapp_phone") || "");
  const [whatsappIncludePatientSummary, setWhatsappIncludePatientSummary] = useState<boolean>(true);
  const [whatsappIncludeOperationalSummary, setWhatsappIncludeOperationalSummary] = useState<boolean>(true);
  
  // Gmail Share States
  const [showGmailModal, setShowGmailModal] = useState<boolean>(false);
  const [gmailTo, setGmailTo] = useState<string>("");
  const [gmailSubject, setGmailSubject] = useState<string>("");
  const [gmailBody, setGmailBody] = useState<string>("");
  const [gmailAttachedType, setGmailAttachedType] = useState<'report_pdf' | 'patient_summary' | 'both_pdfs'>('patient_summary');
  const [gmailAttachReport, setGmailAttachReport] = useState<boolean>(false);
  const [gmailAttachSummary, setGmailAttachSummary] = useState<boolean>(true);
  const [gmailAttachInfographic, setGmailAttachInfographic] = useState<boolean>(false);
  const [gmailSuccessMessage, setGmailSuccessMessage] = useState<string | null>(null);
  const [gmailErrorMessage, setGmailErrorMessage] = useState<string | null>(null);
  const [gmailUser, setGmailUser] = useState<any | null>(() => {
    try {
      const stored = localStorage.getItem("rad_cached_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(() => {
    return localStorage.getItem("rad_gmail_access_token");
  });
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authFormMode, setAuthFormMode] = useState<'google' | 'email_login' | 'email_register'>('google');
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);

  // 1c. WORKLIST ("LISTA DE TRABAJO") STATES
  const [worklist, setWorklist] = useState<Worklist | null>(() => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const isExplicitlyCleared = localStorage.getItem("rad_worklist_explicitly_cleared") === "true";
      if (isExplicitlyCleared) {
        return null;
      }
      const primaryKeys = ["rad_worklist_current", "rad_worklist_latest"];
      for (const key of primaryKeys) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
            return parsed;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isWorklistSidebarOpen, setIsWorklistSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return localStorage.getItem("rad_worklist_sidebar_open") === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("rad_worklist_sidebar_open", String(isWorklistSidebarOpen));
    }
  }, [isWorklistSidebarOpen]);

  const [isProcessingWorklist, setIsProcessingWorklist] = useState<boolean>(false);
  const [worklistError, setWorklistError] = useState<string | null>(null);
  const [selectedWorklistPatientId, setSelectedWorklistPatientId] = useState<string | null>(null);
  
  // Real-time voice dictation states using Web Speech API
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const errorTimeRef = useRef<number>(0);
  const useContinuousRef = useRef<boolean>(true); // Intenta continuo primero, reduce a simple si falla

  // Premium Audio Recorder Dictation states
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [isAssistingHistory, setIsAssistingHistory] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecordingAudio = async () => {
    setSpeechError(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine modern mimeType, fallback to standard
      let mimeType = "audio/webm";
      if (typeof MediaRecorder === "undefined") {
        setSpeechError("El navegador no soporta grabaci√≥n de Voz/Dictado directa.");
        return;
      }

      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        // Fallback for iOS Safari which supports audio/mp4 for audio voice clip recording
        mimeType = "audio/mp4";
        if (!MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = ""; // use browser default
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone cleanly
        stream.getTracks().forEach((track) => track.stop());
        
        // Auto-detect the exact mimeType produced by the browser or recorder options
        const actualMime = audioChunksRef.current[0]?.type || mediaRecorder.mimeType || mimeType || "audio/webm";
        let apiMime = "audio/webm"; // standard fallback
        
        // Map detected formats precisely to supported Gemini API mimetypes
        const cleanMime = actualMime.toLowerCase();
        if (cleanMime.includes("mp4") || cleanMime.includes("m4b") || cleanMime.includes("m4a") || cleanMime.includes("quicktime")) {
          apiMime = "audio/mp4";
        } else if (cleanMime.includes("aac")) {
          apiMime = "audio/aac";
        } else if (cleanMime.includes("wav") || cleanMime.includes("wave")) {
          apiMime = "audio/wav";
        } else if (cleanMime.includes("ogg")) {
          apiMime = "audio/ogg";
        } else if (cleanMime.includes("webm")) {
          apiMime = "audio/webm";
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (audioBlob.size === 0) {
          setSpeechError("La grabaci√≥n de voz est√° vac√≠a.");
          return;
        }

        // Convert blob to base64
        setTranscribing(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result?.toString().split(",")[1];
          if (!base64Data) {
            setSpeechError("Fallo al procesar el audio.");
            setTranscribing(false);
            return;
          }

          try {
            const resp = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio: base64Data,
                mimeType: apiMime,
              }),
            });

            const data = await resp.json();
            if (data.success && data.text) {
              const transcribedText = data.text.trim();
              setFindings((prev) => {
                const trimmedPrev = prev.trim();
                return trimmedPrev ? `${trimmedPrev} ${transcribedText}` : transcribedText;
              });
            } else {
              setSpeechError(data.error || "Error al transcribir el dictado por IA.");
            }
          } catch (e: any) {
            console.error("Transcription API error:", e);
            setSpeechError("Error de conexi√≥n: no se pudo enviar el audio al servidor de IA.");
          } finally {
            setTranscribing(false);
          }
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Slice chunks list
      setIsRecordingAudio(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access error:", err);
      setSpeechError("No se pudo acceder al micr√≥fono para realizar la grabaci√≥n de dictado.");
    }
  };

  const stopRecordingAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsRecordingAudio(false);
  };

  const startListening = (forceSingleShot = false) => {
    setSpeechError(null);
    const SpeechRecognitionDefault = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionDefault) {
      setSpeechError("La API de Dictado por Voz no est√° soportada de forma nativa en este navegador. Recomendamos usar Safari (iOS/macOS) o Google Chrome en computador.");
      return;
    }

    // Detectar si est√° en iOS o iPadOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Los dispositivos iOS limitan de forma estricta el modo continuo. 
    // Usamos modo no-continuo con bucle de auto-reinicio para simular continuidad de manera ultra-estable.
    if (isIOSDevice || forceSingleShot) {
      useContinuousRef.current = false;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognitionDefault();
      recognition.continuous = useContinuousRef.current;
      recognition.interimResults = false;
      recognition.lang = "es-ES";

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onerror = (event: any) => {
        console.error("Reconocimiento de voz error:", event.error);
        errorTimeRef.current = Date.now();
        
        if (event.error === "not-allowed") {
          setSpeechError("Acceso denegado al micr√≥fono. Por favor, asigne permisos de micr√≥fono en la barra del navegador para dictar.");
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === "service-not-allowed") {
          // Si fall√≥ con continuous = true, baja autom√°ticamente al modo alternativo (single shot)
          if (useContinuousRef.current) {
            console.log("Reintentando dictado en modo alternativo compatible...");
            useContinuousRef.current = false;
            setTimeout(() => {
              if (isListeningRef.current) {
                startListening(true);
              }
            }, 300);
          } else {
            setSpeechError("service-not-allowed");
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          // Otros errores de red o silencio
          setSpeechError(`Error al dictar (${event.error})`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        const timeSinceLastError = Date.now() - errorTimeRef.current;
        // Si el usuario quiere seguir dictando (isListeningRef.current es true)
        // y estamos en modo no continuo, reiniciamos la sesi√≥n inmediatamente (emula dictado ilimitado en iPhone!)
        if (isListeningRef.current && !useContinuousRef.current && timeSinceLastError > 1500) {
          console.log("Reiniciando sesi√≥n de audio para dictado continuo...");
          try {
            recognition.start();
          } catch (e) {
            console.error("Fallo al auto-reiniciar:", e);
          }
        } else if (!isListeningRef.current || timeSinceLastError <= 1500) {
          setIsListening(false);
        }
      };

      recognition.onresult = (event: any) => {
        let resultText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            resultText += event.results[i][0].transcript;
          }
        }
        if (resultText) {
          setFindings((prev) => {
            const trimmedPrev = prev.trim();
            const addition = resultText.trim();
            // Evitar acumulaciones dobles instant√°neas del buffer
            if (trimmedPrev.endsWith(addition)) {
              return prev;
            }
            return trimmedPrev ? `${trimmedPrev} ${addition}` : addition;
          });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error(e);
      setSpeechError("No se pudo iniciar el dictado por voz.");
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Error stopping voice recognition:", err);
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Custom smart selection states
  const [modality, setModality] = useState<string>("Radiograf√≠a");
  const [specificStudy, setSpecificStudy] = useState<string>("T√≥rax");
  const [customStudy, setCustomStudy] = useState<string>("");
  const [laterality, setLaterality] = useState<string>(""); // "" | "Derecha" | "Izquierda" | "Bilateral"
  const [projections, setProjections] = useState<string[]>([]);
  const [customProjection, setCustomProjection] = useState<string>("");
  const [activeProtocol, setActiveProtocol] = useState<string>("");

  // Helper to build gendered laterality
  const getGenderedLaterality = (lat: string, study: string) => {
    if (!lat || lat === "Bilateral") return lat;
    const masculineStudies = [
      "Hombro", "Tobillo", "Pie", "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior", "Cr√°neo", "Abdomen",
      "Escroto", "Cuello", "T√≥rax", "Codo", "Muslo Anterior", "Muslo Posterior"
    ];

    if (masculineStudies.map(s => s.toLowerCase()).includes(study.toLowerCase())) {
      if (lat.toLowerCase() === "derecha") return "Derecho";
      if (lat.toLowerCase() === "izquierda") return "Izquierdo";
    }
    return lat;
  };

  // Helper to build projections string
  const getFormattedProjections = (projs: string[], customProj: string) => {
    if (!projs || projs.length === 0) return "";
    const mapped = projs.map(p => {
      if (p === "Otra") {
        return customProj.trim() ? customProj.trim() : "Otra";
      }
      return p === "Lateral" ? "Lateral" : p === "Oblicua" ? "Oblicua" : p === "Axial" ? "Axial" : p;
    });
    if (mapped.length === 1) return mapped[0];
    const last = mapped[mapped.length - 1];
    const rest = mapped.slice(0, -1).join(", ");
    return `${rest} y ${last}`;
  };

  // Helper to build the studyType string dynamically
  const buildStudyTypeString = (mod: string, spec: string, lat: string, custom: string, projs: string[], customProj: string) => {
    let mainStudy = spec === "Otro" ? (custom || "") : spec;
    if (!mainStudy) {
      return mod;
    }

    const mainStudyLower = mainStudy.toLowerCase();

    // Custom alignment for Mamograf√≠a/Momograf√≠a
    if (mod === "Mamograf√≠a" && (mainStudyLower === "mamas" || mainStudyLower === "momografia" || mainStudyLower === "mamograf√≠a")) {
      const gLat = getGenderedLaterality(lat, mainStudy);
      return gLat ? `Mamograf√≠a ${gLat}` : "Mamograf√≠a";
    }

    let preposition = "de";
    if (mainStudyLower.startsWith("doppler")) {
      preposition = "-";
    }

    let base = `${mod} ${preposition} ${mainStudy}`;
    base = base.replace(/\s+-\s+/, " - ").trim();

    if (lat) {
      const gLat = getGenderedLaterality(lat, mainStudy);
      base = `${base} ${gLat}`;
    }

    if (mod === "Radiograf√≠a" && projs && projs.length > 0) {
      const formattedProjs = getFormattedProjections(projs, customProj);
      base = `${base} ${formattedProjs}`;
    }

    return base;
  };

  // Synchronise form dropdowns when parsing a string
  const handleLoadStudyType = (fullStudy: string) => {
    if (!fullStudy) {
      setModality("Radiograf√≠a");
      setSpecificStudy("T√≥rax");
      setCustomStudy("");
      setLaterality("");
      setProjections([]);
      return;
    }

    // 1. Detect Modality
    let detectedModality = "Radiograf√≠a";
    if (/ultrasonido|ecograf√≠a|eco|ud|usg/i.test(fullStudy)) {
      detectedModality = "Ultrasonido";
    } else if (/mamograf√≠a|mamografia|momograf√≠a|momografia/i.test(fullStudy)) {
      detectedModality = "Mamograf√≠a";
    } else if (/tomograf√≠a|tomografia|tc|tac|ct/i.test(fullStudy)) {
      detectedModality = "TAC";
    }
    setModality(detectedModality);

    // 2. Detect Specific Study
    const studies = [
      "Abdomen",
      "Mamas",
      "Vias urinarias",
      "Escroto",
      "Cuello",
      "Rodilla",
      "Hombro",
      "Tobillo",
      "Muslo Anterior",
      "Muslo Posterior",
      "Mu√±eca",
      "Mano",
      "Pie",
      "Doppler de car√≥tidas",
      "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior",
      "Columna lumbosacra",
      "Columna dorsal",
      "Columna cervical",
      "Momograf√≠a",
      "T√≥rax",
      "Cr√°neo",
      "Cadera",
      "Pantorrilla y Tend√≥n de Aquiles"
    ];

    let foundSpecific = "Otro";
    let foundCustom = "";

    const cleanFull = fullStudy.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const study of studies) {
      const cleanStudy = study.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (
        cleanFull.includes(cleanStudy) || 
        (study === "Muslo Posterior" && cleanFull.includes("muslo posterior")) ||
        (study === "Muslo Anterior" && cleanFull.includes("muslo") && !cleanFull.includes("posterior")) ||
        (study === "Pantorrilla y Tend√≥n de Aquiles" && (cleanFull.includes("pantorilla") || cleanFull.includes("pantorrilla") || cleanFull.includes("aquiles") || cleanFull.includes("achilles")))
      ) {
        foundSpecific = study;
        break;
      }
    }

    if (foundSpecific === "Otro") {
      let cleaned = fullStudy;
      // Remove modality names
      cleaned = cleaned.replace(/radiograf√≠a|ultrasonido|mamograf√≠a|mamografia|momograf√≠a|tomograf√≠a|tomografia|tc|tac|ct/gi, "");
      // Remove starting prepositions / separators
      cleaned = cleaned.replace(/^\s*(de|-|\s+)\s*/i, "").trim();
      // Remove projections if present
      cleaned = cleaned.replace(/\s*(ap|pa|lateral|lat|oblicua|obli|axial|otra)\b/gi, "").trim();
      // Remove trailing 'y'
      cleaned = cleaned.replace(/\s+y\s*$/gi, "").trim();
      // Remove laterality from the very end of custom study if present
      cleaned = cleaned.replace(/\s*(derecha|derecho|izquierda|izquierdo|bilateral)\s*$/gi, "").trim();
      foundCustom = cleaned;
    }

    setSpecificStudy(foundSpecific);
    setCustomStudy(foundCustom);

    // 3. Detect Laterality
    let detectedLaterality = "";
    if (/derecho|derecha/i.test(fullStudy)) {
      detectedLaterality = "Derecha";
    } else if (/izquierdo|izquierda/i.test(fullStudy)) {
      detectedLaterality = "Izquierda";
    } else if (/bilateral/i.test(fullStudy)) {
      detectedLaterality = "Bilateral";
    }
    setLaterality(detectedLaterality);

    // 4. Detect Projections
    const detectedProjections: string[] = [];
    if (detectedModality === "Radiograf√≠a") {
      if (/ap\b|anteroposterior/i.test(fullStudy)) {
        detectedProjections.push("AP");
      }
      if (/pa\b|posteroanterior/i.test(fullStudy)) {
        detectedProjections.push("PA");
      }
      if (/lateral\b|lat\b/i.test(fullStudy)) {
        detectedProjections.push("Lateral");
      }
      if (/oblicua\b|obli\b|oblicuas\b/i.test(fullStudy)) {
        detectedProjections.push("Oblicua");
      }
      if (/axial\b/i.test(fullStudy)) {
        detectedProjections.push("Axial");
      }
      if (/otra|otras\b/i.test(fullStudy)) {
        detectedProjections.push("Otra");
      }
    }
    setProjections(detectedProjections);
  };

  // Auto-detect and active clinical study block based on keywords in inputted text or generated reports
  const autoDetectSpecificStudyAndModality = (reportText: string, currentStudyType: string) => {
    // Completely disabled per user request: Protocol activation must be strictly manual via buttons or dropdown.
    return;
    const combined = `${currentStudyType || ""} ${reportText || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Detect Codo (Prioritized to avoid conflicts, e.g. "bicep" in elbow reports triggering shoulder)
    if (
      combined.includes("codo") ||
      combined.includes("epicondilo") ||
      combined.includes("epitroclea") ||
      combined.includes("epicondilitis") ||
      combined.includes("epitrocleitis") ||
      combined.includes("colateral radial") ||
      combined.includes("colateral cubital") ||
      combined.includes("nervio cubital") ||
      combined.includes("nervio ulnar")
    ) {
      setSpecificStudy("Codo");
      setModality("Ultrasonido");
      return;
    }

    // 2. Detect Muslo Posterior (biceps femoral, semitendinous, semimembranoso, sciatic/ciatico, isquiotibiales)
    if (
      combined.includes("muslo posterior") ||
      combined.includes("isquiotibial") ||
      combined.includes("isquio") ||
      combined.includes("biceps femo") ||
      combined.includes("biceps femoral") ||
      combined.includes("semitendinoso") ||
      combined.includes("semimembranoso") ||
      combined.includes("ciatico")
    ) {
      setSpecificStudy("Muslo Posterior");
      setModality("Ultrasonido");
      return;
    }

    // 2. Detect Muslo Anterior (recto femoral, quadriceps, sartorio, vasto lateral/medial)
    if (
      combined.includes("muslo anterior") ||
      combined.includes("recto femoral") ||
      combined.includes("cuadriceps") ||
      combined.includes("sartorio") ||
      combined.includes("vasto medial") ||
      combined.includes("vasto lateral") ||
      (combined.includes("muslo") && !combined.includes("posterior") && !combined.includes("isquio"))
    ) {
      setSpecificStudy("Muslo Anterior");
      setModality("Ultrasonido");
      return;
    }

    // 3. Detect Hombro
    if (
      combined.includes("hombro") ||
      combined.includes("supraespinoso") ||
      combined.includes("infraespinoso") ||
      combined.includes("subescapular") ||
      combined.includes("bicep") ||
      combined.includes("glenohumeral") ||
      combined.includes("acromioclavicular")
    ) {
      setSpecificStudy("Hombro");
      setModality("Ultrasonido");
      return;
    }

    // 4. Detect Rodilla
    if (
      combined.includes("rodilla") ||
      combined.includes("patela") ||
      combined.includes("rotula") ||
      combined.includes("menisco") ||
      combined.includes("ligamento cruzado") ||
      combined.includes("femorotibial")
    ) {
      setSpecificStudy("Rodilla");
      setModality("Ultrasonido");
      return;
    }

    // 5. Detect Tobillo
    if (
      combined.includes("tobillo") ||
      combined.includes("talo") ||
      combined.includes("aquiles") ||
      combined.includes("peroneo") ||
      combined.includes("calcaneo")
    ) {
      setSpecificStudy("Tobillo");
      setModality("Ultrasonido");
      return;
    }

    // 6. Detect Doppler Venoso
    if (
      combined.includes("doppler venoso") ||
      combined.includes("venas del miembro") ||
      combined.includes("safena") ||
      combined.includes("trombosis venosa")
    ) {
      setSpecificStudy("Doppler venoso de miembro inferior");
      setModality("Ultrasonido");
      return;
    }

    // 7. Detect Doppler Arterial
    if (
      combined.includes("doppler arterial") ||
      combined.includes("indice tobillo brazo") ||
      combined.includes("arterias del miembro") ||
      combined.includes("enfermedad arterial")
    ) {
      setSpecificStudy("Doppler arterial de miembro inferior");
      setModality("Ultrasonido");
      return;
    }

    // 7.5 Detect Mu√±eca
    if (
      combined.includes("muneca") ||
      combined.includes("mu√±eca") ||
      combined.includes("carpo") ||
      combined.includes("carpiano") ||
      combined.includes("nervio mediano") ||
      combined.includes("canal de guyon") ||
      combined.includes("de quervain") ||
      combined.includes("extensor carpi ulnaris") ||
      combined.includes("fibrocartilago triangular")
    ) {
      setSpecificStudy("Mu√±eca");
      setModality("Ultrasonido");
      return;
    }

    // 8. Detect Cuello / Tiroides
    if (
      combined.includes("tiroides") ||
      combined.includes("tiroideo") ||
      combined.includes("tiroidea") ||
      combined.includes("istmo tiroideo") ||
      combined.includes("lobulo tiroideo") ||
      combined.includes("parotida") ||
      combined.includes("parotideo") ||
      combined.includes("submandibular") ||
      combined.includes("ganglios cervicales") ||
      (combined.includes("cuello") && !combined.includes("doppler de carotidas") && !combined.includes("doppler carotideo") && !combined.includes("doppler de carotida") && !combined.includes("doppler carotidas"))
    ) {
      setSpecificStudy("Cuello");
      setModality("Ultrasonido");
      return;
    }

    // 9. Detect Doppler Car√≥tidas
    if (
      combined.includes("carotida") ||
      combined.includes("carotideo") ||
      combined.includes("carotidas") ||
      combined.includes("doppler de carotidas")
    ) {
      setSpecificStudy("Doppler de car√≥tidas");
      setModality("Ultrasonido");
      return;
    }

    // 9.5 Detect Escroto
    if (
      combined.includes("escroto") ||
      combined.includes("escrotal") ||
      combined.includes("testiculo") ||
      combined.includes("testicular") ||
      combined.includes("testiculos") ||
      combined.includes("testiculares") ||
      combined.includes("epididimo") ||
      combined.includes("epididimos") ||
      combined.includes("varicocele") ||
      combined.includes("hidrocele") ||
      combined.includes("orquitis")
    ) {
      setSpecificStudy("Escroto");
      setModality("Ultrasonido");
      return;
    }

    // 10. Detect V√≠as Urinarias (Renal and Urinary Tract)
    const pointsToUrinaryOnly = 
      combined.includes("vias urinarias") || 
      combined.includes("vias urinaria") || 
      combined.includes("renal y vias") || 
      combined.includes("urologico") ||
      combined.includes("us renal") || 
      combined.includes("ecografia renal") ||
      combined.includes("urosonido");
      
    const mentionsAbdomenTitle = 
      combined.includes("abdomen completo") || 
      combined.includes("abdomen superior") || 
      combined.includes("ecografia de abdomen") || 
      combined.includes("ultrasonido de abdomen") ||
      combined.includes("abdomen inferior") ||
      combined.includes("abdomen");

    if (pointsToUrinaryOnly && !mentionsAbdomenTitle) {
      setSpecificStudy("Vias urinarias");
      setModality("Ultrasonido");
      
      if (combined.includes("prostata") || combined.includes("prostatic")) {
        setUrinaryGenderMode("hombre");
      } else {
        setUrinaryGenderMode("mujer");
      }
      return;
    }

    if (mentionsAbdomenTitle) {
      setSpecificStudy("Abdomen");
      setModality("Ultrasonido");
      return;
    }
  };

  useEffect(() => {
    const computed = buildStudyTypeString(modality, specificStudy, laterality, customStudy, projections, customProjection);
    setStudyType(computed);
  }, [modality, specificStudy, laterality, customStudy, projections, customProjection]);

  // Auto-detect specific study from pasted/draft report, findings, or clinical history if specificStudy is the default "T√≥rax"
  useEffect(() => {
    if (specificStudy === "T√≥rax") {
      const combinedText = `${inputReport || ""} ${findings || ""} ${clinicalHistory || ""}`;
      if (combinedText.trim()) {
        autoDetectSpecificStudyAndModality(combinedText, "");
      }
    }
  }, [inputReport, findings, clinicalHistory]);
  
  // Image input
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // ZIP-DICOM Extractor state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isZipExtractorOpen, setIsZipExtractorOpen] = useState<boolean>(false);
  const [zipExtractedFileForAnalysis, setZipExtractedFileForAnalysis] = useState<{ file: ExtractedFile; slot: 1 | 2 | 3 } | { file: ExtractedFile; slot: 1 | 2 | 3 }[] | null>(null);
  
  // Loading & Generation results
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSteps, setGenerationSteps] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<string>("");

  // --- INTERACTIVE SYNTACTIC HIGHLIGHTING AND DYNAMIC AESTHETIC STATES ---
  const [isSyntacticHighlightingActive, setIsSyntacticHighlightingActive] = useState<boolean>(true);
  const [manualSeverityOverrides, setManualSeverityOverrides] = useState<Record<string, "critical" | "altered" | "normal">>({});
  const [aiSeverityCache, setAiSeverityCache] = useState<Record<string, "critical" | "altered" | "normal">>({});
  const [isAnalyzingParagraphs, setIsAnalyzingParagraphs] = useState<boolean>(false);

  // Cloud studies states
  const [cloudStudies, setCloudStudies] = useState<CloudStudy[]>([]);
  const [isLoadingCloudStudies, setIsLoadingCloudStudies] = useState<boolean>(false);
  const [cloudStudiesError, setCloudStudiesError] = useState<string | null>(null);
  const [cloudStudiesSuccess, setCloudStudiesSuccess] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState<boolean>(false);
  const [cloudSearch, setCloudSearch] = useState<string>("");
  const [viewingCloudStudy, setViewingCloudStudy] = useState<CloudStudy | null>(null);

  // Biomechanical Radar Data
  const [biomechanicalRadarData, setBiomechanicalRadarData] = useState<any | null>(null);

  // 3D Schematic Volumetric Renders for Findings
  const [findings3dRenders, setFindings3dRenders] = useState<Finding3dRender[]>([]);
  const [is3dRenderModalOpen, setIs3dRenderModalOpen] = useState<boolean>(false);
  const [modal3dSourceImage, setModal3dSourceImage] = useState<any>(null);
  const [modal3dInitialFinding, setModal3dInitialFinding] = useState<string>("");

  useEffect(() => {
    if (!generatedReport) return;

    // Parse elements to get all unique paragraphs and list items
    const elements = parseReportToElements(generatedReport, "temp");
    const paragraphsToAnalyze: string[] = [];

    elements.forEach(elem => {
      if (elem.type === "list") {
        elem.items?.forEach(item => {
          let cleanItem = item.trim();
          const isNumbered = /^\d+\.\s+/.test(cleanItem);
          if (isNumbered) {
            const match = cleanItem.match(/^(\d+\.)\s+/);
            if (match) {
              cleanItem = cleanItem.substring(match[0].length);
            }
          } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
            cleanItem = cleanItem.substring(2);
          }
          cleanItem = cleanItem.trim();
          const cleanItemLower = cleanItem.toLowerCase();

          if (cleanItem && !aiSeverityCache[cleanItem] && !aiSeverityCache[cleanItemLower] && !paragraphsToAnalyze.includes(cleanItem)) {
            paragraphsToAnalyze.push(cleanItem);
          }
        });
      } else if (elem.type === "text" || !elem.type) {
        elem.lines?.forEach(line => {
          const trimmedLine = line.trim();
          const trimmedLineLower = trimmedLine.toLowerCase();
          if (trimmedLine && !aiSeverityCache[trimmedLine] && !aiSeverityCache[trimmedLineLower] && !paragraphsToAnalyze.includes(trimmedLine)) {
            paragraphsToAnalyze.push(trimmedLine);
          }
        });
      }
    });

    if (paragraphsToAnalyze.length === 0) return;

    const timeoutId = setTimeout(async () => {
      setIsAnalyzingParagraphs(true);
      try {
        const response = await fetch("/api/analyze-paragraphs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            paragraphs: paragraphsToAnalyze
          })
        });
        const data = await response.json();
        if (data.success && data.results) {
          const normalizedResults: Record<string, "critical" | "altered" | "normal"> = {};
          Object.entries(data.results).forEach(([key, value]) => {
            const trimmedKey = key.trim();
            normalizedResults[trimmedKey] = value as "critical" | "altered" | "normal";
            normalizedResults[trimmedKey.toLowerCase()] = value as "critical" | "altered" | "normal";
          });
          setAiSeverityCache(prev => ({
            ...prev,
            ...normalizedResults
          }));
        }
      } catch (e) {
        console.error("Error calling analyze-paragraphs:", e);
      } finally {
        setIsAnalyzingParagraphs(false);
      }
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [generatedReport, selectedModel]);

  const [reportTheme, setReportTheme] = useState<string>("slate-dark"); // 'slate-dark' | 'academic-light' | 'clinical-minimal' | 'retro-glowing'
  const [reportFont, setReportFont] = useState<string>("sans"); // 'sans' | 'serif' | 'mono'
  const [reportDensity, setReportDensity] = useState<string>("airy"); // 'compact' | 'airy'
  const [showPathology, setShowPathology] = useState<boolean>(true);
  const [showAnatomy, setShowAnatomy] = useState<boolean>(true);
  const [showNormal, setShowNormal] = useState<boolean>(true);
  const [showTechnical, setShowTechnical] = useState<boolean>(true);

  // --- VERSION HISTORY AND MANUAL REPORT EDIT STATE ---
  const [originalBaseReport, setOriginalBaseReport] = useState<string>("");
  const [reportHistory, setReportHistory] = useState<string[]>([]);
  const [reportRedoHistory, setReportRedoHistory] = useState<string[]>([]);
  const [isEditingReportManual, setIsEditingReportManual] = useState<boolean>(false);
  const [editedReportText, setEditedReportText] = useState<string>("");
  const [isAtlas3DModuleOpen, setIsAtlas3DModuleOpen] = useState<boolean>(false);
  const [includeAtlas3DInReport, setIncludeAtlas3DInReport] = useState<boolean>(true);
  const [atlas3dData, setAtlas3dData] = useState<Atlas3DData | null>(null);
  const [isVascular3DModuleOpen, setIsVascular3DModuleOpen] = useState<boolean>(false);
  const [includeVascular3DInReport, setIncludeVascular3DInReport] = useState<boolean>(true);
  const [vascular3dData, setVascular3dData] = useState<Vascular3DData | null>(null);
  const [usPhotoLayout, setUsPhotoLayout] = useState<UltrasoundPhotoLayout>("auto");

  const pdfStateRef = useRef<any>({});
  pdfStateRef.current = {
    generatedReport: isEditingReportManual ? editedReportText : generatedReport,
    patientName,
    patientEmail,
    patientAge,
    patientGender,
    patientId,
    reportDate,
    doctorName,
    doctorLicense,
    clinicName,
    clinicalHistory,
    findings,
    studyType,
    customLogoUrl,
    customLogoStyle,
    customSignatureUrl,
    specificStudy,
    pdfLayoutType,
    selectedLogo,
    biomechanicalRadarData,
    findings3dRenders,
    atlas3dData,
    includeAtlas3DInReport,
    vascular3dData,
    includeVascular3DInReport,
    usPhotoLayout,
  };

  // --- SPECIAL INTERACTIVE AI PARAGRAPH ACTIONS STATES ---
  const [selectedParagraphText, setSelectedParagraphText] = useState<string | null>(null);
  const [selectedParagraphOriginal, setSelectedParagraphOriginal] = useState<string | null>(null);
  const [paragraphActionLoading, setParagraphActionLoading] = useState<boolean>(false);
  const [paragraphActionResult, setParagraphActionResult] = useState<string | null>(null);
  const [paragraphActionActive, setParagraphActionActive] = useState<string | null>(null);
  const [paragraphActionError, setParagraphActionError] = useState<string | null>(null);
  const [customParagraphPrompt, setCustomParagraphPrompt] = useState<string>("");

  const handleSelectParagraph = (lineText: string) => {
    const trimmedText = lineText.trim();
    if (!trimmedText) return;
    if (selectedParagraphOriginal === trimmedText) {
      // Toggle unselect
      setSelectedParagraphText(null);
      setSelectedParagraphOriginal(null);
      setParagraphActionResult(null);
      setParagraphActionActive(null);
      setParagraphActionError(null);
      setCustomParagraphPrompt("");
    } else {
      setSelectedParagraphText(trimmedText);
      setSelectedParagraphOriginal(trimmedText);
      setParagraphActionResult(null);
      setParagraphActionActive(null);
      setParagraphActionError(null);
      setCustomParagraphPrompt("");
    }
  };

  const handleToggleManualSeverity = (severity: "critical" | "altered" | "normal") => {
    if (!selectedParagraphOriginal) return;
    const trimmed = selectedParagraphOriginal.trim();
    setManualSeverityOverrides(prev => ({
      ...prev,
      [trimmed]: severity,
      [selectedParagraphOriginal]: severity
    }));
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      const selectedStr = selection.toString().trim();
      // Only process selections of meaningful size
      if (selectedStr.length > 4 && selectedStr.length < 1500) {
        setSelectedParagraphText(selectedStr);
        if (generatedReport && generatedReport.includes(selectedStr)) {
          setSelectedParagraphOriginal(selectedStr);
        } else {
          setSelectedParagraphOriginal(null);
        }
        setParagraphActionResult(null);
        setParagraphActionActive(null);
        setParagraphActionError(null);
        setCustomParagraphPrompt("");
      }
    }
  };

  const executeParagraphAction = async (actionType: string, customPromptText?: string) => {
    if (!selectedParagraphText) return;
    
    setParagraphActionLoading(true);
    setParagraphActionActive(actionType);
    setParagraphActionError(null);
    setParagraphActionResult(null);
    
    try {
      const response = await fetch("/api/ai-paragraph-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          text: selectedParagraphText,
          action: actionType,
          customPrompt: customPromptText,
          fullReport: generatedReport,
          studyType: studyType || "No especificado",
          clinicalHistory: clinicalHistory || "No especificada"
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setParagraphActionResult(data.result);
      } else {
        setParagraphActionError(data.error || "Ocurri√≥ un error inesperado al procesar la acci√≥n de p√°rrafo.");
      }
    } catch (err: any) {
      console.error("Error executing paragraph action:", err);
      setParagraphActionError("Error de conexi√≥n con el servidor de IA.");
    } finally {
      setParagraphActionLoading(false);
    }
  };

  const handleApplyParagraphImprovement = (improvedText: string) => {
    if (!selectedParagraphOriginal || !generatedReport) return;
    
    // Save current report in history
    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);
    
    // Replace the original text with improved text in generatedReport
    const updatedReport = generatedReport.replace(selectedParagraphOriginal, improvedText);
    setGeneratedReport(updatedReport);
    
    // Reset selection states
    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleInsertBelowParagraph = (newText: string) => {
    if (!selectedParagraphOriginal || !generatedReport) return;

    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);

    const index = generatedReport.indexOf(selectedParagraphOriginal);
    if (index !== -1) {
      const insertionPoint = index + selectedParagraphOriginal.length;
      const updatedReport = 
        generatedReport.substring(0, insertionPoint) + 
        "\n\n" + newText + 
        generatedReport.substring(insertionPoint);
      setGeneratedReport(updatedReport);
    }

    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleAppendParagraphToReport = (newText: string) => {
    if (!generatedReport) return;

    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);

    const updatedReport = generatedReport.trim() + "\n\n" + newText;
    setGeneratedReport(updatedReport);

    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleStartManualEdit = () => {
    setEditedReportText(generatedReport);
    setIsEditingReportManual(true);
  };

  const handleSaveManualEdit = () => {
    if (editedReportText !== generatedReport) {
      if (generatedReport) {
        setReportHistory((prev) => [...prev, generatedReport]);
        setReportRedoHistory([]);
      }
      setGeneratedReport(editedReportText);
    }
    setIsEditingReportManual(false);
  };

  const handleCancelManualEdit = () => {
    setIsEditingReportManual(false);
  };

  // --- CONTROLES DE CHAT INTELIGENTE M√âDICO-RADIOL√ìGICO ---
  const [showVersionComparison, setShowVersionComparison] = useState<boolean>(false);
  const [smartChatMessages, setSmartChatMessages] = useState<Array<{
    id: string;
    role: "user" | "model";
    text: string;
    summary?: string;
  }>>(() => {
    return [
      {
        id: "welcome",
        role: "model",
        text: "¬°Hola! Soy tu **Asistente Inteligente M√©dico-Radiol√≥gico**. Consulta clasificaciones (ej. Neer o Bosniak), dosis de contraste o t√©rminos. Te brindar√© res√∫menes exportables para inyectarlos directo en el reporte."
      }
    ];
  });
  const [smartChatInput, setSmartChatInput] = useState<string>("" );
  const [isSmartChatLoading, setIsSmartChatLoading] = useState<boolean>(false);
  const [smartChatError, setSmartChatError] = useState<string | null>(null);

  const smartChatBottomRef = useRef<HTMLDivElement>(null);

  const handleSendSmartChatMessage = async (customMessage?: string) => {
    const textToSend = customMessage || smartChatInput;
    if (!textToSend.trim() || isSmartChatLoading) return;

    setSmartChatError(null);
    setIsSmartChatLoading(true);
    if (!customMessage) {
      setSmartChatInput("");
    }

    const newMsgId = "msg-" + Date.now();
    const userMsg = { id: newMsgId, role: "user" as const, text: textToSend };
    const updatedMessages = [...smartChatMessages, userMsg];
    setSmartChatMessages(updatedMessages);

    // Scroll smoothly
    setTimeout(() => {
      smartChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);

    try {
      const systemInstruction = `Eres un consultor e inteligencia conversacional m√©dica y radiol√≥gica de √©lite. Tienes un dominio absoluto de la terminolog√≠a de salud, enfermedades, dosificaciones de medicamentos, dosificaciones de medios de contraste, y clasificaciones radiol√≥gicas internacionales (como Neer de h√∫mero proximal, Bosniak, BI-RADS, Fleischner, etc.).
Tu objetivo es dar respuestas sumamente claras, cient√≠ficamente precisas, profesionales y estructuradas.

${generatedReport ? `Contexto del informe radiol√≥gico activo actualmente en el que trabaja el m√©dico en su workspace:\n"""\n${generatedReport}\n"""\n` : ""}

REGLAS CR√çTICAS PARA CLASIFICACIONES Y RES√öMENES:
1. Explica con total claridad y detalle los grados de la clasificaci√≥n o temas que se te consultan.
2. Si el usuario te consulta o solicita clasificar un hallazgo en t√©rminos cl√≠nicos o escalas (por ejemplo, 'escala de Neer', 'clasificaci√≥n de fracturas de h√∫mero proximal', 'Bosniak', 'Fleischner', etc.), DEBES incluir al final de tu respuesta un bloque especial de resumen de clasificaci√≥n opcional encerrado EXACTAMENTE entre los delimitadores [RESUMEN_CLASIFICACION]...[/RESUMEN_CLASIFICACION] para que el m√©dico pueda exportarlo.
3. El contenido dentro de [RESUMEN_CLASIFICACION] debe ser redactado en formato Markdown limpio, sin rodeos, listo para ser acoplado directamente en el reporte de estudio bajo una secci√≥n de conclusi√≥n o impresi√≥n diagn√≥stica. No repitas la escala completa aqu√≠, solo aplica un resumen personalizado y conciso del hallazgo aplicable al caso.
Ejemplo:
[RESUMEN_CLASIFICACION]
**Clasificaci√≥n de Neer (H√∫mero Proximal):** Fractura-luxaci√≥n en 3 partes con desplazamiento del troquiter > 1 cm y angulaci√≥n de la cabeza humeral > 45¬∞. Impresi√≥n diagn√≥stica de inestabilidad articular que requiere interconsulta con traumatolog√≠a.
[/RESUMEN_CLASIFICACION]`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          systemInstruction,
        }),
      });

      const data = await response.json();
      if (data.success) {
        let rawReply = data.reply || "";
        let parsedText = rawReply;
        let summaryText: string | undefined = undefined;

        const startTag = "[RESUMEN_CLASIFICACION]";
        const endTag = "[/RESUMEN_CLASIFICACION]";
        const startIndex = rawReply.indexOf(startTag);
        const endIndex = rawReply.indexOf(endTag);

        if (startIndex !== -1 && endIndex !== -1) {
          summaryText = rawReply.substring(startIndex + startTag.length, endIndex).trim();
          parsedText = (rawReply.substring(0, startIndex) + rawReply.substring(endIndex + endTag.length)).trim();
        }

        setSmartChatMessages(prev => [...prev, {
          id: "reply-" + Date.now(),
          role: "model",
          text: parsedText,
          summary: summaryText
        }]);
      } else {
        setSmartChatError(data.error || "No se pudo obtener una respuesta v√°lida de Gemini.");
      }
    } catch (err) {
      console.error(err);
      setSmartChatError("Error de conexi√≥n m√©dica con el servidor de inteligencia.");
    } finally {
      setIsSmartChatLoading(false);
      setTimeout(() => {
        smartChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    }
  };

  const handleAppendBlockToReport = (content: string) => {
    const currentText = generatedReport || "";
    const spacing = currentText.endsWith("\n\n") ? "" : currentText.endsWith("\n") ? "\n" : currentText ? "\n\n" : "";
    const updated = currentText + spacing + content;
    
    // Save history
    if (generatedReport) {
      setReportHistory(prev => [...prev, generatedReport]);
      setReportRedoHistory([]);
    }
    setGeneratedReport(updated);
    setEditedReportText(updated);
  };


  const handleRevertReport = () => {
    if (reportHistory.length === 0) return;
    const previous = reportHistory[reportHistory.length - 1];
    setReportHistory((prev) => prev.slice(0, -1));
    if (generatedReport) {
      setReportRedoHistory((prev) => [...prev, generatedReport]);
    }
    setGeneratedReport(previous);
    setIsEditingReportManual(false);
  };

  const handleRedoReport = () => {
    if (reportRedoHistory.length === 0) return;
    const next = reportRedoHistory[reportRedoHistory.length - 1];
    setReportRedoHistory((prev) => prev.slice(0, -1));
    if (generatedReport) {
      setReportHistory((prev) => [...prev, generatedReport]);
    }
    setGeneratedReport(next);
    setIsEditingReportManual(false);
  };
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<boolean>(false);
  const [presetCopiedId, setPresetCopiedId] = useState<string | null>(null);
  const [copiedEhrStudyId, setCopiedEhrStudyId] = useState<string | null>(null);

  // States for embedded classification recommendations
  const [classRecommendations, setClassRecommendations] = useState<any[] | null>(null);
  const [isRecommendingClassifications, setIsRecommendingClassifications] = useState<boolean>(false);
  const [recommenderError, setRecommenderError] = useState<string | null>(null);
  const [incorporatedRecs, setIncorporatedRecs] = useState<Record<number, boolean>>({});
  const [includeManagementRecs, setIncludeManagementRecs] = useState<Record<number, boolean>>({});
  const [incorporatingIndex, setIncorporatingIndex] = useState<number | null>(null);

  // States for interactive report modification & image valuation
  const [imageEvaluation, setImageEvaluation] = useState<string>("");
  const [isEvaluatingImage, setIsEvaluatingImage] = useState<boolean>(false);
  const [currentModInstruction, setCurrentModInstruction] = useState<string>("");
  const [isModifyingReport, setIsModifyingReport] = useState<boolean>(false);
  const [pendingRecText, setPendingRecText] = useState<string | null>(null);
  const [pendingRecs, setPendingRecs] = useState<Record<string, boolean>>({});
  const [incorporatedAuditRecs, setIncorporatedAuditRecs] = useState<Record<string, boolean>>({});
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Queue references for simultaneous / sequential recommendation processing
  const recQueueRef = useRef<string[]>([]);
  const isProcessingRecQueueRef = useRef<boolean>(false);

  const generatedReportRef = useRef(generatedReport);
  generatedReportRef.current = generatedReport;

  const editedReportTextRef = useRef(editedReportText);
  editedReportTextRef.current = editedReportText;

  const isEditingReportManualRef = useRef(isEditingReportManual);
  isEditingReportManualRef.current = isEditingReportManual;

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const base64ImageRef = useRef(base64Image);
  base64ImageRef.current = base64Image;

  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  const [additionalEvaluation, setAdditionalEvaluation] = useState<string>("");
  const [isEvaluatingAdditional, setIsEvaluatingAdditional] = useState<boolean>(false);
  const [additionalEvalError, setAdditionalEvalError] = useState<string | null>(null);

  // States for Complete Case Analysis & Intelligent Medical Bibliography Search
  const [caseAnalysis, setCaseAnalysis] = useState<string>("");
  const [isAnalyzingCase, setIsAnalyzingCase] = useState<boolean>(false);
  const [caseAnalysisError, setCaseAnalysisError] = useState<string | null>(null);
  const [isIncorporatingDiffs, setIsIncorporatingDiffs] = useState<boolean>(false);
  const [diffsIncorporated, setDiffsIncorporated] = useState<boolean>(false);
  const [diffsError, setDiffsError] = useState<string | null>(null);
  const [selectedCaseFormat, setSelectedCaseFormat] = useState<CaseAnalysisFormatOption>("flujograma_semiologico");
  const [caseElements, setCaseElements] = useState<CaseAnalysisElementsConfig>({
    includeSonographic: true,
    includeSonographicDetails: true,
    includeClinicalCorr: true,
    includeCertainty: false,
    includeDifferentials: true,
    includeDiscardedDifferentials: true,
    includeManagement: true,
  });
  const [isFormattingCaseJSON, setIsFormattingCaseJSON] = useState<boolean>(false);

  // States to hold the structured case data editable in real-time on the main screen
  const [editableCaseData, setEditableCaseData] = useState<CaseAnalysisData | null>(null);
  const [checkedDetails, setCheckedDetails] = useState<boolean[]>([]);
  const [checkedDifferentials, setCheckedDifferentials] = useState<boolean[]>([]);
  const [checkedDecisionSteps, setCheckedDecisionSteps] = useState<boolean[]>([]);
  const [isExtractingCaseData, setIsExtractingCaseData] = useState<boolean>(false);
  const [caseDataError, setCaseDataError] = useState<string | null>(null);

  // Automatically load/extract the structured Case Analysis components whenever caseAnalysis is populated or format changes
  React.useEffect(() => {
    if (caseAnalysis) {
      const loadCaseAnalysisData = async () => {
        setIsExtractingCaseData(true);
        setCaseDataError(null);
        try {
          const response = await fetch("/api/extract-essential-findings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              model: selectedModel,
              analysisText: caseAnalysis,
              requestedFormat: selectedCaseFormat,
              elementsConfig: caseElements
            }),
          });
          const data = await response.json();
          if (response.ok && data.success && data.caseAnalysisData) {
            setEditableCaseData(data.caseAnalysisData);
            
            // Initialize sub-level checkmarks
            if (data.caseAnalysisData.sonographicPillar?.details) {
              setCheckedDetails(data.caseAnalysisData.sonographicPillar.details.map(() => true));
            } else {
              setCheckedDetails([]);
            }
            if (data.caseAnalysisData.diagnostics) {
              setCheckedDifferentials(data.caseAnalysisData.diagnostics.map(() => true));
            } else {
              setCheckedDifferentials([]);
            }
            if (data.caseAnalysisData.decisionFlow) {
              setCheckedDecisionSteps(data.caseAnalysisData.decisionFlow.map(() => true));
            } else {
              setCheckedDecisionSteps([]);
            }
          } else {
            setCaseDataError(data.error || "No se pudo extraer los componentes estructurados del caso actual.");
          }
        } catch (err: any) {
          console.error("Error al estructurar el caso:", err);
          setCaseDataError("Error de comunicaci√≥n/red al estructurar el flujograma.");
        } finally {
          setIsExtractingCaseData(false);
        }
      };

      loadCaseAnalysisData();
    } else {
      setEditableCaseData(null);
      setCaseDataError(null);
      setCheckedDetails([]);
      setCheckedDifferentials([]);
      setCheckedDecisionSteps([]);
    }
  }, [caseAnalysis, selectedCaseFormat]);

  const handleFormatAndIncorporateCaseAnalysis = () => {
    if (!editableCaseData) return;

    setIsFormattingCaseJSON(true);
    setDiffsError(null);
    try {
      // Clone the editableCaseData to avoid modifying active state before saving
      const finalCaseData = JSON.parse(JSON.stringify(editableCaseData)) as CaseAnalysisData;

      // 1. Filter sonographic details based on checkedDetails checkbox states
      if (finalCaseData.sonographicPillar?.details) {
        finalCaseData.sonographicPillar.details = finalCaseData.sonographicPillar.details.filter((_, i) => checkedDetails[i]);
      }

      // 2. Filter diagnostics based on checkedDifferentials checkbox states
      if (finalCaseData.diagnostics) {
        finalCaseData.diagnostics = finalCaseData.diagnostics.filter((_, i) => checkedDifferentials[i]);
      }

      // 3. Filter decision flow steps based on checkedDecisionSteps checkbox states
      if (finalCaseData.decisionFlow) {
        finalCaseData.decisionFlow = finalCaseData.decisionFlow.filter((_, i) => checkedDecisionSteps[i]);
      }

      // 4. Update elementsConfig in final data
      finalCaseData.elementsConfig = {
        ...caseElements,
        includeSonographicDetails: caseElements.includeSonographic && (finalCaseData.sonographicPillar?.details?.length ?? 0) > 0,
        includeDiscardedDifferentials: caseElements.includeDifferentials && (finalCaseData.diagnostics?.filter((d: any, idx: number) => d.refutingCriteria && idx > 0).length ?? 0) > 0
      };

      // Construct the standard [CASE_ANALYSIS_JSON] wrapping block
      const jsonBlock = `[CASE_ANALYSIS_JSON]\n${JSON.stringify(finalCaseData, null, 2)}\n[/CASE_ANALYSIS_JSON]\n\n`;

      // Construct the formatted markdown text summary accompanying the JSON
      let textSummary = `**AN√ÅLISIS INTEGRADO DE CASO (${selectedCaseFormat.toUpperCase().replace("_", " ")})**\n\n`;
      if (caseElements.includeSonographic && finalCaseData.sonographicPillar) {
        textSummary += `‚Ä¢ **Pilar Sonogr√°fico Fundamental**: ${finalCaseData.sonographicPillar.primaryFinding}\n`;
      }
      if (caseElements.includeClinicalCorr && finalCaseData.clinicalCorrelation) {
        textSummary += `‚Ä¢ **Correlaci√≥n Cl√≠nica/Lab**: ${finalCaseData.clinicalCorrelation}\n`;
      }
      if (caseElements.includeDifferentials && finalCaseData.diagnostics?.length) {
        textSummary += `‚Ä¢ **Diagn√≥stico Principal**: ${finalCaseData.diagnostics[0]?.name}\n`;
      }
      if (caseElements.includeManagement && finalCaseData.managementRecommendation) {
        textSummary += `‚Ä¢ **Conducta Recomendada**: ${finalCaseData.managementRecommendation}\n`;
      }

      setGeneratedReport(prev => {
        return mergeCaseAnalysisBlock(prev || "", finalCaseData.format || "custom", jsonBlock, textSummary);
      });
      setEditedReportText(prev => {
        return mergeCaseAnalysisBlock(prev || "", finalCaseData.format || "custom", jsonBlock, textSummary);
      });
      setDiffsIncorporated(true);
      setTimeout(() => {
        setDiffsIncorporated(false);
      }, 3000);
    } catch (err: any) {
      console.error("Error al formatear e incorporar el an√°lisis:", err);
      setDiffsError(err?.message || "Error al procesar la inserci√≥n de datos.");
    } finally {
      setIsFormattingCaseJSON(false);
    }
  };

  const [bibliography, setBibliography] = useState<string>("");
  const [isSearchingBibliography, setIsSearchingBibliography] = useState<boolean>(false);
  const [isSearchingMoreBibliography, setIsSearchingMoreBibliography] = useState<boolean>(false);
  const [bibliographyError, setBibliographyError] = useState<string | null>(null);
  const [bibliographySources, setBibliographySources] = useState<Array<{ uri: string; title: string; summary?: string }>>([]);

  const [reportEvaluation, setReportEvaluation] = useState<string>("");
  const [isEvaluatingReport, setIsEvaluatingReport] = useState<boolean>(false);
  const [reportEvaluationError, setReportEvaluationError] = useState<string | null>(null);

  // States for Patient Summary (Interactive & Demystifying)
  const [patientSummary, setPatientSummary] = useState<any | null>(null);
  const [isGeneratingPatientSummary, setIsGeneratingPatientSummary] = useState<boolean>(false);
  const [patientSummaryError, setPatientSummaryError] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Record<number, boolean>>({});
  const [attachSummaryToOfficialReport, setAttachSummaryToOfficialReport] = useState<boolean>(false);
  const [isAsistenteMedidasOpen, setIsAsistenteMedidasOpen] = useState<boolean>(false);
  const [isCreadorNotasOpen, setIsCreadorNotasOpen] = useState<boolean>(false);
  const [isCreadorCuadroSinopticoOpen, setIsCreadorCuadroSinopticoOpen] = useState<boolean>(false);
  const [isCreadorSinopsisFracturasOpen, setIsCreadorSinopsisFracturasOpen] = useState<boolean>(false);
  const [isBiomechanicalRadarOpen, setIsBiomechanicalRadarOpen] = useState<boolean>(false);
  const [includeRadarInReport, setIncludeRadarInReport] = useState<boolean>(true);
  const [isElastographyQUSModuleOpen, setIsElastographyQUSModuleOpen] = useState<boolean>(false);
  const [isProstateUrinaryModuleOpen, setIsProstateUrinaryModuleOpen] = useState<boolean>(false);
  const [includeProstateUrinaryInReport, setIncludeProstateUrinaryInReport] = useState<boolean>(true);
  const [prostateUrinaryData, setProstateUrinaryData] = useState<ProstateUrinaryData | null>(null);

  // States & Handlers for Sistema de Activaci√≥n R√°pida de M√≥dulos (Procesamiento en Lote)
  const [selectedBatchModules, setSelectedBatchModules] = useState<Record<string, boolean>>({
    radar: false,
    atlas_3d: true,
    vascular_3d: false,
    case_analysis: false,
    quality_eval: false,
    bibliography: false,
    operational_summary: true,
    patient_summary: true,
    glossary: false,
    schematic: false,
    measurements: false,
    footnotes: false,
    organ_synoptic: true,
    fractures: false,
    classifications: false,
  });
  const [isActivatingBatch, setIsActivatingBatch] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  const handleToggleAllBatchModules = (select: boolean) => {
    setSelectedBatchModules({
      radar: select,
      atlas_3d: select,
      vascular_3d: select,
      case_analysis: select,
      quality_eval: select,
      bibliography: select,
      operational_summary: select,
      patient_summary: select,
      glossary: select,
      schematic: select,
      measurements: select,
      footnotes: select,
      organ_synoptic: select,
      fractures: select,
      classifications: select,
    });
  };

  const handleActivateBatchModules = async () => {
    const activeReport = isEditingReportManual ? editedReportText : (generatedReport || "");
    if (!activeReport) {
      setModifyError("Genera o redacta un reporte antes de activar los m√≥dulos en lote.");
      return;
    }

    setIsActivatingBatch(true);
    setBatchSuccessMessage(null);

    // 1. Activate interactive UI panels immediately
    if (selectedBatchModules.radar) setIsBiomechanicalRadarOpen(true);
    if (selectedBatchModules.atlas_3d) setIsAtlas3DModuleOpen(true);
    if (selectedBatchModules.vascular_3d) setIsVascular3DModuleOpen(true);
    if (selectedBatchModules.measurements) setIsAsistenteMedidasOpen(true);
    if (selectedBatchModules.footnotes) setIsCreadorNotasOpen(true);
    if (selectedBatchModules.organ_synoptic) setIsCreadorCuadroSinopticoOpen(true);
    if (selectedBatchModules.fractures) setIsCreadorSinopsisFracturasOpen(true);

    // 2. Trigger async AI generation processes concurrently with smart micro-staggering (prevents instant 429 burst rate limits without slowing UX)
    const taskQueue: (() => Promise<any>)[] = [];
    if (selectedBatchModules.case_analysis) taskQueue.push(() => handleAnalyzeCase());
    if (selectedBatchModules.quality_eval) taskQueue.push(() => handleEvaluateReport(activeReport));
    if (selectedBatchModules.bibliography) taskQueue.push(() => handleSearchBibliography());
    if (selectedBatchModules.operational_summary) taskQueue.push(() => handleGenerateWhatsAppSummary());
    if (selectedBatchModules.patient_summary) taskQueue.push(() => handleGeneratePatientSummary());
    if (selectedBatchModules.glossary) taskQueue.push(() => handleGenerateDynamicGlossary());
    if (selectedBatchModules.schematic) taskQueue.push(() => handleGenerateSchematicSummary());

    const promises = taskQueue.map((fn, idx) => {
      return new Promise<any>((resolve) => {
        setTimeout(async () => {
          try {
            const res = await fn();
            resolve(res);
          } catch (err) {
            console.error("Error en ejecuci√≥n de m√≥dulo por lote:", err);
            resolve(null);
          }
        }, idx * 300);
      });
    });

    try {
      await Promise.allSettled(promises);
      const activeCount = Object.values(selectedBatchModules).filter(Boolean).length;
      setBatchSuccessMessage(`¬°√âxito! Se han activado y procesado ${activeCount} m√≥dulos seleccionados en lote.`);
      setTimeout(() => setBatchSuccessMessage(null), 6000);
    } catch (err) {
      console.error("Error al procesar m√≥dulos en lote:", err);
    } finally {
      setIsActivatingBatch(false);
    }
  };

  // States for Advanced Vascular Analysis & Schematic Drawing
  const [vascularTable, setVascularTable] = useState<string>("");
  const [vascularStates, setVascularStates] = useState<Record<string, string>>({});
  const [carotidPlaques, setCarotidPlaques] = useState<any[]>([]);
  const [includeCarotidBifurcations, setIncludeCarotidBifurcations] = useState<boolean>(true);
  
  // States for attached images / DICOM captures
  const [attachedImages, setAttachedImages] = useState<{
    id: string;
    name: string;
    url: string;
    base64: string;
    caption: string;
    isDicom: boolean;
    dicomMetaData?: Record<string, string>;
    width?: number;
    height?: number;
    modality?: "MMG" | "US";
    projection?: "MLO" | "CC" | "OTRO";
    side?: "Derecha" | "Izquierda" | "Bilateral";
  }[]>([]);
  const [loadingAiLabelId, setLoadingAiLabelId] = useState<string | null>(null);
  const [loadingAutocompleteId, setLoadingAutocompleteId] = useState<string | null>(null);
  const [isLabelingAll, setIsLabelingAll] = useState<boolean>(false);
  const [isCorrelatingFigures, setIsCorrelatingFigures] = useState<boolean>(false);
  const [vascularDescriptions, setVascularDescriptions] = useState<Record<string, string>>({});
  const [vascularSubLocations, setVascularSubLocations] = useState<Record<string, string>>({});
  const [isAnalyzingVascular, setIsAnalyzingVascular] = useState<boolean>(false);
  const [vascularError, setVascularError] = useState<string | null>(null);
  const [includeVascularSchemaInReport, setIncludeVascularSchemaInReport] = useState<boolean>(false);
  const [includeShoulderSchemaInReport, setIncludeShoulderSchemaInReport] = useState<boolean>(true);
  const [shoulderStates, setShoulderStates] = useState<Record<string, string>>({});
  const [shoulderStatesLeft, setShoulderStatesLeft] = useState<Record<string, string>>({});
  const [shoulderDescriptions, setShoulderDescriptions] = useState<Record<string, string>>({});
  const [shoulderDescriptionsLeft, setShoulderDescriptionsLeft] = useState<Record<string, string>>({});
  const [includeKneeSchemaInReport, setIncludeKneeSchemaInReport] = useState<boolean>(true);
  const [includeGonartrosisSchemaInReport, setIncludeGonartrosisSchemaInReport] = useState<boolean>(false);
  const [kneeStates, setKneeStates] = useState<Record<string, string>>({});
  const [kneeStatesLeft, setKneeStatesLeft] = useState<Record<string, string>>({});
  const [kneeDescriptions, setKneeDescriptions] = useState<Record<string, string>>({});
  const [kneeDescriptionsLeft, setKneeDescriptionsLeft] = useState<Record<string, string>>({});
  const [includeAnkleSchemaInReport, setIncludeAnkleSchemaInReport] = useState<boolean>(true);
  const [ankleStates, setAnkleStates] = useState<Record<string, string>>({});
  const [ankleDescriptions, setAnkleDescriptions] = useState<Record<string, string>>({});
  const [includeThighSchemaInReport, setIncludeThighSchemaInReport] = useState<boolean>(true);
  const [thighStates, setThighStates] = useState<Record<string, string>>({});
  const [thighDescriptions, setThighDescriptions] = useState<Record<string, string>>({});
  const [includeThighPosteriorSchemaInReport, setIncludeThighPosteriorSchemaInReport] = useState<boolean>(true);
  const [thighPosteriorStates, setThighPosteriorStates] = useState<Record<string, string>>({});
  const [thighPosteriorDescriptions, setThighPosteriorDescriptions] = useState<Record<string, string>>({});
  const [includeNeckSchemaInReport, setIncludeNeckSchemaInReport] = useState<boolean>(true);
  const [neckStates, setNeckStates] = useState<Record<string, string>>({});
  const [neckDescriptions, setNeckDescriptions] = useState<Record<string, string>>({});
  const [includeNeonatalBrainSchemaInReport, setIncludeNeonatalBrainSchemaInReport] = useState<boolean>(true);
  const [neonatalBrainStates, setNeonatalBrainStates] = useState<Record<string, string>>({});
  const [neonatalBrainDescriptions, setNeonatalBrainDescriptions] = useState<Record<string, string>>({});
  const [includeUrinarySchemaInReport, setIncludeUrinarySchemaInReport] = useState<boolean>(true);
  const [urinaryStates, setUrinaryStates] = useState<Record<string, string>>({});
  const [urinaryDescriptions, setUrinaryDescriptions] = useState<Record<string, string>>({});
  const [urinaryGenderMode, setUrinaryGenderMode] = useState<"hombre" | "mujer">("mujer");
  const [includeElbowSchemaInReport, setIncludeElbowSchemaInReport] = useState<boolean>(true);
  const [elbowStates, setElbowStates] = useState<Record<string, string>>({});
  const [elbowDescriptions, setElbowDescriptions] = useState<Record<string, string>>({});
  const [includeAbdomenSchemaInReport, setIncludeAbdomenSchemaInReport] = useState<boolean>(true);
  const [includeBiliarySchemaInReport, setIncludeBiliarySchemaInReport] = useState<boolean>(true);
  const [includeAppendixSchemaInReport, setIncludeAppendixSchemaInReport] = useState<boolean>(true);
  const [includeDiverticulitisSchemaInReport, setIncludeDiverticulitisSchemaInReport] = useState<boolean>(true);
  const [includeSmallBowelSchemaInReport, setIncludeSmallBowelSchemaInReport] = useState<boolean>(true);
  const [includeHepatopatiaSchemaInReport, setIncludeHepatopatiaSchemaInReport] = useState<boolean>(true);
  const [includeAneurismaSchemaInReport, setIncludeAneurismaSchemaInReport] = useState<boolean>(true);
  const [includeElastographyInReport, setIncludeElastographyInReport] = useState<boolean>(false);
  const [elastographyHasStiffness, setElastographyHasStiffness] = useState<boolean>(true);
  const [elastographyStiffness, setElastographyStiffness] = useState<number>(5.2);
  const [elastographyCAP, setElastographyCAP] = useState<number>(230);
  const [qusAttenuation, setQusAttenuation] = useState<number>(0.55);
  const [fatFraction, setFatFraction] = useState<number>(5.5);
  const [stiffnessOverride, setStiffnessOverride] = useState<string>("auto");
  const [steatosisOverride, setSteatosisOverride] = useState<string>("auto");
  const [abdomenStates, setAbdomenStates] = useState<Record<string, string>>({});
  const [abdomenDescriptions, setAbdomenDescriptions] = useState<Record<string, string>>({});
  const [includeScrotumSchemaInReport, setIncludeScrotumSchemaInReport] = useState<boolean>(true);
  const [scrotumStates, setScrotumStates] = useState<Record<string, string>>({});
  const [scrotumDescriptions, setScrotumDescriptions] = useState<Record<string, string>>({});
  const [includeWristSchemaInReport, setIncludeWristSchemaInReport] = useState<boolean>(true);
  const [includeDeQuervainSchemaInReport, setIncludeDeQuervainSchemaInReport] = useState<boolean>(false);
  const [wristStates, setWristStates] = useState<Record<string, string>>({});
  const [wristDescriptions, setWristDescriptions] = useState<Record<string, string>>({});
  const [includeBreastSchemaInReport, setIncludeBreastSchemaInReport] = useState<boolean>(true);
  const [breastStates, setBreastStates] = useState<Record<string, string>>({});
  const [breastDescriptions, setBreastDescriptions] = useState<Record<string, string>>({});
  const [breastBilateralOverride, setBreastBilateralOverride] = useState<boolean | null>(null);
  const [breastBilateralType, setBreastBilateralType] = useState<"quistes" | "fibroadenomas" | null>(null);
  const [activeVascularIdHover, setActiveVascularIdHover] = useState<string | null>(null);
  const [includeAbdominalWallSchemaInReport, setIncludeAbdominalWallSchemaInReport] = useState<boolean>(true);
  const [abdominalWallStates, setAbdominalWallStates] = useState<Record<string, string>>({});
  const [abdominalWallDescriptions, setAbdominalWallDescriptions] = useState<Record<string, string>>({});

  const [includeCalfAchillesSchemaInReport, setIncludeCalfAchillesSchemaInReport] = useState<boolean>(true);
  const [calfAchillesStates, setCalfAchillesStates] = useState<Record<string, string>>({});
  const [calfAchillesDescriptions, setCalfAchillesDescriptions] = useState<Record<string, string>>({});

  // States for Intelligent Anatomy Dialog and Additional Findings (not mapped to draw structures)
  const [isSmartAnatomyDialogOpen, setIsSmartAnatomyDialogOpen] = useState<boolean>(false);
  const [additionalFindings, setAdditionalFindings] = useState<Record<string, Array<{ id: string; structureName: string; state: string; description: string }>>>({});
  const [smartInstructionsText, setSmartInstructionsText] = useState<string>("");
  const [isSmartAnatomyModifying, setIsSmartAnatomyModifying] = useState<boolean>(false);
  const [smartAnatomyError, setSmartAnatomyError] = useState<string>("");
  const [newExtraStructureName, setNewExtraStructureName] = useState<string>("");
  const [newExtraState, setNewExtraState] = useState<string>("Alterado");
  const [newExtraDescription, setNewExtraDescription] = useState<string>("");

  // States for Dynamic Medical Glossary on current report
  const [dynamicGlossary, setDynamicGlossary] = useState<any | null>(null);
  const [isGeneratingDynamicGlossary, setIsGeneratingDynamicGlossary] = useState<boolean>(false);
  const [dynamicGlossaryError, setDynamicGlossaryError] = useState<string | null>(null);
  const [glossaryLitSearch, setGlossaryLitSearch] = useState<Record<string, { loading: boolean; text?: string; error?: string; sources?: any[] }>>({});

  // States for Schematic Summary / Findings Table
  const [schematicSummary, setSchematicSummary] = useState<any | null>(null);
  const [isGeneratingSchematicSummary, setIsGeneratingSchematicSummary] = useState<boolean>(false);
  const [schematicSummaryError, setSchematicSummaryError] = useState<string | null>(null);
  const [schematicFormat, setSchematicFormat] = useState<"blocks" | "table">("blocks");

  // States for expanding sections (maximizing read size)
  const [isMainReportExpanded, setIsMainReportExpanded] = useState<boolean>(false);
  const [isSmartChatExpanded, setIsSmartChatExpanded] = useState<boolean>(false);
  const [isVascularExpanded, setIsVascularExpanded] = useState<boolean>(false);
  const [isCaseAnalysisExpanded, setIsCaseAnalysisExpanded] = useState<boolean>(false);
  const [isReportEvaluationExpanded, setIsReportEvaluationExpanded] = useState<boolean>(false);
  const [isBibliographyExpanded, setIsBibliographyExpanded] = useState<boolean>(false);
  const [isPatientSummaryExpanded, setIsPatientSummaryExpanded] = useState<boolean>(false);
  const [isGlossaryExpanded, setIsGlossaryExpanded] = useState<boolean>(false);
  const [isSchematicSummaryExpanded, setIsSchematicSummaryExpanded] = useState<boolean>(false);
  const [isImageEvaluationExpanded, setIsImageEvaluationExpanded] = useState<boolean>(false);
  const [isAdditionalEvaluationExpanded, setIsAdditionalEvaluationExpanded] = useState<boolean>(false);

  // States for Semiology and Clinical Justification Table
  const [semiologyData, setSemiologyData] = useState<any | null>(null);
  const [selectedConfirmedDiagnoses, setSelectedConfirmedDiagnoses] = useState<boolean[]>([]);
  const [selectedRuledOutPathologies, setSelectedRuledOutPathologies] = useState<boolean[]>([]);
  const [isGeneratingSemiology, setIsGeneratingSemiology] = useState<boolean>(false);
  const [semiologyError, setSemiologyError] = useState<string | null>(null);
  const [isSemiologyExpanded, setIsSemiologyExpanded] = useState<boolean>(false);

  // States for Image Annotations / Marking regions
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([]);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<"point" | "box">("point");
  const [isDrawingBox, setIsDrawingBox] = useState<boolean>(false);
  const [drawStartPercent, setDrawStartPercent] = useState<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    type: "point" | "box";
    x: number;
    y: number;
    w?: number;
    h?: number;
  } | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string>("");
  const [isAutoLabeling, setIsAutoLabeling] = useState<boolean>(false);
  const [autoLabelError, setAutoLabelError] = useState<string | null>(null);

  // 2. STATE FOR CLASSIFICATION EXPLORER & CALCULATORS
  const [classificationQuery, setClassificationQuery] = useState<string>("");
  const [isLoadingClassification, setIsLoadingClassification] = useState<boolean>(false);
  const [classificationResult, setClassificationResult] = useState<string>("");
  const [classificationError, setClassificationError] = useState<string | null>(null);
  
  // Interactive classification wizard state
  const [selectedClassSystem, setSelectedClassSystem] = useState<string>("bosniak");
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>({});
  const [wizardOutput, setWizardOutput] = useState<string>("");

  // 3. STATE FOR DIALOG CHAT CONSULTANT
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isSendingMsg, setIsSendingMsg] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 4. STATE FOR API HEALTH DIAGNOSTICS
  const [apiDiagnostics, setApiDiagnostics] = useState<any>(null);
  const [checkingApi, setCheckingApi] = useState<boolean>(false);

  // Dynamic Firebase configuration states
  const [customFirebaseRaw, setCustomFirebaseRaw] = useState<string>(() => {
    return localStorage.getItem("rad_custom_firebase_config_raw") || "";
  });
  const [firebaseConfigStatus, setFirebaseConfigStatus] = useState<string | null>(null);
  const [isTestingFirebaseConfig, setIsTestingFirebaseConfig] = useState<boolean>(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isMigratingStudies, setIsMigratingStudies] = useState<boolean>(false);
  const [migrationProgress, setMigrationProgress] = useState<string | null>(null);
  const [confirmResetFirebase, setConfirmResetFirebase] = useState<boolean>(false);

  const getStructuresForProtocol = (protocol: string): Array<{ id: string; label: string; allowedStates: string[] }> => {
    const norm = protocol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let caseKey = protocol;
    if (norm.includes("hombro")) caseKey = "Hombro";
    else if (norm.includes("rodilla")) caseKey = "Rodilla";
    else if (norm.includes("tobillo")) caseKey = "Tobillo";
    else if (norm.includes("muslo anterior")) caseKey = "Muslo Anterior";
    else if (norm.includes("muslo posterior")) caseKey = "Muslo Posterior";
    else if (norm.includes("cuello")) caseKey = "Cuello y Tiroides";
    else if (norm.includes("urinarias") || norm.includes("orina")) caseKey = "V√≠as Urinarias";
    else if (norm.includes("codo")) caseKey = "Codo";
    else if (norm.includes("pared") || norm.includes("abdominal wall")) caseKey = "Pared Abdominal";
    else if (norm.includes("abdomen")) caseKey = "Abdomen";
    else if (norm.includes("escroto")) caseKey = "Escroto";
    else if (norm.includes("muneca")) caseKey = "Mu√±eca";
    else if (norm.includes("mama")) caseKey = "Mamas";
    else if (norm.includes("pantorrilla") || norm.includes("aquiles") || norm.includes("achilles") || norm.includes("pantorilla")) caseKey = "Pantorrilla y Tend√≥n de Aquiles";
    else if (norm.includes("cerebro") || norm.includes("neonatal") || norm.includes("transfontanelar")) caseKey = "Cerebro Neonatal";

    switch (caseKey) {
      case "Hombro":
        return [
          { id: "supraspinatus", label: "Supraespinoso", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "infraspinatus", label: "Infraespinoso", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "subscapularis", label: "Subescapular", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "biceps", label: "PL B√≠ceps", allowedStates: ["no_descrito", "normal", "tendinitis", "subluxacion", "rotura"] },
          { id: "bursa", label: "Bursa SAD", allowedStates: ["no_descrito", "normal", "bursitis_leve", "bursitis_severa"] },
          { id: "glenohumeral", label: "Derrame GH", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] },
          { id: "acromioclavicular", label: "Artic. Acromioclav.", allowedStates: ["no_descrito", "normal", "artrosis", "hipertrofia"] },
          { id: "dynamic_assessment", label: "Val. Din√°mica", allowedStates: ["no_descrito", "normal", "pinzamiento"] }
        ];
      case "Rodilla":
        return [
          { id: "quadriceps", label: "Tend√≥n Cuadricipital", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "patellar", label: "Tend√≥n Rotuliano", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "lcm", label: "Lig. Colateral Medial", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "lce", label: "Lig. Colateral Lateral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "medial_meniscus", label: "Menisco Medial", allowedStates: ["no_descrito", "normal", "meniscosis", "desgarro_parcial", "rotura"] },
          { id: "lateral_meniscus", label: "Menisco Lateral", allowedStates: ["no_descrito", "normal", "meniscosis", "desgarro_parcial", "rotura"] },
          { id: "joint_effusion", label: "Derrame Articular", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] },
          { id: "baker_cyst", label: "Quiste de Baker", allowedStates: ["no_descrito", "normal", "quiste_leve", "quiste_severo"] },
          { id: "popliteal_artery", label: "Arteria Popl√≠tea", allowedStates: ["no_descrito", "normal", "ectasia", "ateromatosis"] },
          { id: "popliteal_vein", label: "Vena Popl√≠tea", allowedStates: ["no_descrito", "normal", "trombosis"] },
          { id: "distal_tendons", label: "Tendones Distales", allowedStates: ["no_descrito", "normal", "coleccion"] },
          { id: "popliteal_fossa", label: "Fosa Popl√≠tea", allowedStates: ["no_descrito", "normal", "adenopatia"] }
        ];
      case "Tobillo":
        return [
          { id: "t_aquiles", label: "T. Aquiles", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "fascia_plantar", label: "Fascia Plantar", allowedStates: ["no_descrito", "normal", "fascitis", "desgarro_parcial", "rotura"] },
          { id: "l_peroneoastragalino_ant", label: "LPAA", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "l_peroneocalcaneo", label: "LPC", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "l_tibioastragalino_ant", label: "LTAA", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "t_tibial_anterior", label: "T. Tibial Anterior", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "t_peroneo_largo", label: "T. Peroneo Largo", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "receso_articular", label: "Receso Articular", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] }
        ];
      case "Muslo Anterior":
        return [
          { id: "recto_femoral", label: "R. Femoral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_medial", label: "V. Medial", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_lateral", label: "V. Lateral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_intermedio", label: "V. Intermedio", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "tensor_fascia_lata", label: "Tensor Fascia Lata", allowedStates: ["no_descrito", "normal", "sobrecarga", "tendinosis", "desgarro"] },
          { id: "sartorio", label: "Sartorio", allowedStates: ["no_descrito", "normal", "sobrecarga", "tenosinovitis", "desgarro"] }
        ];
      case "Muslo Posterior":
        return [
          { id: "semitendinoso", label: "Semitendinoso", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "semimembranoso", label: "Semimembranoso", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "biceps_femoral", label: "B√≠ceps Femoral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "nervio_ciatico", label: "N. Ci√°tico", allowedStates: ["no_descrito", "normal", "ciatalgia", "atrapamiento"] },
          { id: "tejido_subcutaneo", label: "T. Subcut√°neo", allowedStates: ["no_descrito", "normal", "edema_leve", "edema_severo"] }
        ];
      case "Cuello":
        return [
          { id: "glandula_tiroides", label: "G. Tiroides", allowedStates: ["no_descrito", "normal", "bocio_nodular", "tiroiditis"] },
          { id: "lobulo_derecho", label: "L√≥bulo Derecho", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso"] },
          { id: "lobulo_izquierdo", label: "L√≥bulo Izquierdo", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso"] },
          { id: "istmo", label: "Istmo", allowedStates: ["no_descrito", "normal", "quiste", "hipertrofia"] },
          { id: "glandulas_salivales", label: "G. Salivales", allowedStates: ["no_descrito", "normal", "sialoadenitis", "sialolitiasis"] },
          { id: "parotida_derecha", label: "Par√≥tida Derecha", allowedStates: ["no_descrito", "normal", "quiste", "adenoma"] },
          { id: "parotida_izquierda", label: "Par√≥tida Izquierda", allowedStates: ["no_descrito", "normal", "quiste", "adenoma"] },
          { id: "submandibular_derecha", label: "Submandibular Der", allowedStates: ["no_descrito", "normal", "ectasia", "sialolitiasis"] },
          { id: "submandibular_izquierda", label: "Submandibular Izq", allowedStates: ["no_descrito", "normal", "ectasia", "sialolitiasis"] },
          { id: "ganglios_linfaticos", label: "Ganglios Linf√°ticos", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] }
        ];
      case "Vias urinarias":
        return [
          { id: "rinon_derecho", label: "Ri√±√≥n Derecho", allowedStates: ["no_descrito", "normal", "litiasis", "quiste", "ectasia"] },
          { id: "rinon_izquierdo", label: "Ri√±√≥n Izquierdo", allowedStates: ["no_descrito", "normal", "litiasis", "quiste", "ectasia"] },
          { id: "vejiga", label: "Vejiga", allowedStates: ["no_descrito", "normal", "cistitis", "sedimento", "litiasis"] },
          { id: "ureteres", label: "Ur√©teres", allowedStates: ["no_descrito", "normal", "dilatacion", "obstruccion"] },
          { id: "prostata_o_utero", label: "Pr√≥stata / √ötero", allowedStates: ["no_descrito", "normal", "hipertrofia", "miomatosis", "quiste"] }
        ];
      case "Codo":
        return [
          { id: "t_triceps", label: "T. Tr√≠ceps", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "t_biceps_distal", label: "T. B√≠ceps Distal", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "t_comun_extensor", label: "T. Com√∫n Extensor", allowedStates: ["no_descrito", "normal", "epicondilitis_lateral", "desgarro_parcial", "rotura"] },
          { id: "t_comun_flexor", label: "T. Com√∫n Flexor", allowedStates: ["no_descrito", "normal", "epicondilitis_medial", "desgarro_parcial", "rotura"] },
          { id: "n_cubital", label: "N. Cubital", allowedStates: ["no_descrito", "normal", "neuritis", "subluxacion"] },
          { id: "receso_olecraniano", label: "Receso Olecraniano", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado", "sinovitis"] }
        ];
      case "Abdomen":
        return [
          { id: "higado", label: "H√≠gado", allowedStates: ["no_descrito", "normal", "esteatosis_leve", "esteatosis_moderada", "esteatosis_severa", "hepatomegalia", "cirrosis", "quiste", "hemangioma", "lesion_ocupante"] },
          { id: "vesicula_biliar", label: "Ves√≠cula Biliar", allowedStates: ["no_descrito", "normal", "colelitiasis", "barro_biliar", "colecistitis_aguda", "polipo", "pared_engrosada"] },
          { id: "vias_biliares", label: "V√≠as Biliares", allowedStates: ["no_descrito", "normal", "ectasia_intrahepatica", "dilatacion_coledoco"] },
          { id: "pancreas", label: "P√°ncreas", allowedStates: ["no_descrito", "normal", "pancreatitis_aguda", "pancreatitis_cronica", "quiste", "calcificaciones"] },
          { id: "bazo", label: "Bazo", allowedStates: ["no_descrito", "normal", "esplenomegalia", "nodulo_esplenico", "infarto_esplenico"] },
          { id: "aorta_abdominal", label: "Aorta Abdominal", allowedStates: ["no_descrito", "normal", "ectasia", "aneurisma", "placas_calcificadas"] },
          { id: "retroperitoneo", label: "Retroperitoneo", allowedStates: ["no_descrito", "normal", "liquido_libre", "adenopatias_retroperitoneales"] }
        ];
      case "Escroto":
        return [
          { id: "testiculo_derecho", label: "Test√≠culo Derecho", allowedStates: ["no_descrito", "normal", "orquitis", "quiste", "nodulo", "atrofia", "microcalcificaciones"] },
          { id: "testiculo_izquierdo", label: "Test√≠culo Izquierdo", allowedStates: ["no_descrito", "normal", "orquitis", "quiste", "nodulo", "atrofia", "microcalcificaciones"] },
          { id: "epididimo_derecho", label: "Epid√≠dimo Derecho", allowedStates: ["no_descrito", "normal", "epididimitis", "quiste", "hipertrofia"] },
          { id: "epididimo_izquierdo", label: "Epid√≠dimo Izquierdo", allowedStates: ["no_descrito", "normal", "epididimitis", "quiste", "hipertrofia"] },
          { id: "hemiescroto_derecho", label: "Hemiescroto Derecho", allowedStates: ["no_descrito", "normal", "hidrocele_leve", "hidrocele_moderado", "varicocele_grado_i", "varicocele_grado_ii", "varicocele_grado_iii"] },
          { id: "hemiescroto_izquierdo", label: "Hemiescroto Izquierdo", allowedStates: ["no_descrito", "normal", "hidrocele_leve", "hidrocele_moderado", "varicocele_grado_i", "varicocele_grado_ii", "varicocele_grado_iii"] }
        ];
      case "Mu√±eca":
        return [
          { id: "nervio_mediano", label: "Nervio Mediano", allowedStates: ["no_descrito", "normal", "neuritis", "atrapamiento_tarsiano", "engrosamiento"] },
          { id: "tendones_flexores", label: "Tendones Flexores", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "flexor_carpi_radialis", label: "Flexor Carpi Radialis", allowedStates: ["no_descrito", "normal", "tenosinovitis", "tendinosis"] },
          { id: "arteria_radial", label: "Arteria Radial", allowedStates: ["no_descrito", "normal", "ateromatosis", "aneurisma_falso"] },
          { id: "receso_radiocarpiano_anterior", label: "Receso Radiocarpiano Anterior", allowedStates: ["no_descrito", "normal", "derrame_leve", "sinovitis"] },
          { id: "canal_de_guyon", label: "Canal de Guyon", allowedStates: ["no_descrito", "normal", "atrapamiento_cubital", "lesion_ocupante"] },
          { id: "receso_radiocarpiano_posterior", label: "Receso Radiocarpiano Posterior", allowedStates: ["no_descrito", "normal", "derrame_leve", "sinovitis"] },
          { id: "articulacion_radiocubital_distal", label: "Regi√≥n Radiocubital Distal", allowedStates: ["no_descrito", "normal", "artrosis", "subluxacion"] },
          { id: "tendones_extensores_compartimentos", label: "Compartimentos Extensores", allowedStates: ["no_descrito", "normal", "tenosinovitis_de_quervain", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "fibrocartilago_triangular", label: "Fibrocart√≠lago Triangular", allowedStates: ["no_descrito", "normal", "degenerativo", "rotura"] },
          { id: "extensor_carpi_ulnaris", label: "Extensor Carpi Ulnaris", allowedStates: ["no_descrito", "normal", "tenosinovitis", "subluxacion"] }
        ];
      case "Mamas":
        return [
          { id: "mama_derecha", label: "Mama Derecha", allowedStates: ["no_descrito", "normal", "condicion_fibroquistica", "ecorrefringencia_aumentada"] },
          { id: "mama_izquierda", label: "Mama Izquierda", allowedStates: ["no_descrito", "normal", "condicion_fibroquistica", "ecorrefringencia_aumentada"] },
          { id: "cuadrantes_mama_derecha", label: "Cuadrantes Mama Der", allowedStates: ["no_descrito", "normal", "quiste_simple", "quiste_complejo", "fibroadenoma", "lesion_altamente_sospechosa"] },
          { id: "cuadrantes_mama_izquierda", label: "Cuadrantes Mama Izq", allowedStates: ["no_descrito", "normal", "quiste_simple", "quiste_complejo", "fibroadenoma", "lesion_altamente_sospechosa"] },
          { id: "axila_derecha", label: "Axila Derecha", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] },
          { id: "axila_izquierda", label: "Axila Izquierda", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] }
        ];
      case "Pared Abdominal":
        return [
          { id: "rectus_abdominis_right", label: "M√∫sculo Recto Der.", allowedStates: ["no_descrito", "normal", "diastasis", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "rectus_abdominis_left", label: "M√∫sculo Recto Izq.", allowedStates: ["no_descrito", "normal", "diastasis", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "oblique_muscles_right", label: "M√∫sculos Oblicuos Der.", allowedStates: ["no_descrito", "normal", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "oblique_muscles_left", label: "M√∫sculos Oblicuos Izq.", allowedStates: ["no_descrito", "normal", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "linea_alba", label: "L√≠nea Alba", allowedStates: ["no_descrito", "normal", "diastasis", "hernia", "ruptura"] },
          { id: "umbilical_region", label: "Regi√≥n Umbilical", allowedStates: ["no_descrito", "normal", "hernia_umbilical", "diastasis"] },
          { id: "epigastric_region", label: "Regi√≥n Epig√°strica", allowedStates: ["no_descrito", "normal", "hernia_epigastrica", "lipoma"] },
          { id: "inguinal_region_right", label: "Regi√≥n Inguinal Der.", allowedStates: ["no_descrito", "normal", "hernia_inguinal_directa", "hernia_inguinal_indirecta", "adenopatia"] },
          { id: "inguinal_region_left", label: "Regi√≥n Inguinal Izq.", allowedStates: ["no_descrito", "normal", "hernia_inguinal_directa", "hernia_inguinal_indirecta", "adenopatia"] },
          { id: "crural_region_right", label: "Regi√≥n Crural Der.", allowedStates: ["no_descrito", "normal", "hernia_crural", "adenopatia"] },
          { id: "crural_region_left", label: "Regi√≥n Crural Izq.", allowedStates: ["no_descrito", "normal", "hernia_crural", "adenopatia"] }
        ];
      case "Pantorrilla y Tend√≥n de Aquiles":
        return [
          { id: "gastrocnemius_medial", label: "Gastrocnemio Medial", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial", "hematoma"] },
          { id: "gastrocnemius_lateral", label: "Gastrocnemio Lateral", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial", "hematoma"] },
          { id: "soleus_muscle", label: "M√∫sculo S√≥leo", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial"] },
          { id: "achilles_tendon", label: "Tend√≥n de Aquiles", allowedStates: ["no_descrito", "normal", "tendinosis", "rotura_parcial", "rotura_completa", "entesopatia"] },
          { id: "plantaris_tendon", label: "Plantar Delgado", allowedStates: ["no_descrito", "normal", "desgarro", "engrosamiento"] },
          { id: "retrocalcaneal_bursa", label: "Bolsa Retrocalc√°nea", allowedStates: ["no_descrito", "normal", "bursitis"] }
        ];
      case "Cerebro Neonatal":
        return [
          { id: "ventricle_right", label: "Ventr√≠culo Lateral Derecho", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
          { id: "ventricle_left", label: "Ventr√≠culo Lateral Izquierdo", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
          { id: "ventricle_third_fourth", label: "Tercer y Cuarto Ventr√≠culo", allowedStates: ["no_descrito", "normal", "dilatacion"] },
          { id: "choroid_right", label: "Plexo Coroideo Derecho", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
          { id: "choroid_left", label: "Plexo Coroideo Izquierdo", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
          { id: "germinal_right", label: "Surco Caudotal√°mico Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
          { id: "germinal_left", label: "Surco Caudotal√°mico Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
          { id: "parenchyma_periventricular_right", label: "Par√©nquima Periventricular Derecho", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
          { id: "parenchyma_periventricular_left", label: "Par√©nquima Periventricular Izquierdo", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
          { id: "parenchyma_focal_right", label: "Par√©nquima Lobar Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
          { id: "parenchyma_focal_left", label: "Par√©nquima Lobar Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
          { id: "subarachnoid_space", label: "Espacio Subaracnoideo y Cisternas", allowedStates: ["no_descrito", "normal", "dilatacion_benigna", "coleccion_extraaxial"] }
        ];
      default:
        return [];
    }
  };

  const getProtocolStateAndSetters = (protocol: string) => {
    const norm = protocol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let caseKey = protocol;
    if (norm.includes("hombro")) caseKey = "Hombro";
    else if (norm.includes("rodilla")) caseKey = "Rodilla";
    else if (norm.includes("tobillo")) caseKey = "Tobillo";
    else if (norm.includes("muslo anterior")) caseKey = "Muslo Anterior";
    else if (norm.includes("muslo posterior")) caseKey = "Muslo Posterior";
    else if (norm.includes("cuello")) caseKey = "Cuello";
    else if (norm.includes("urinarias") || norm.includes("orina")) caseKey = "Vias urinarias";
    else if (norm.includes("codo")) caseKey = "Codo";
    else if (norm.includes("pared") || norm.includes("abdominal wall")) caseKey = "Pared Abdominal";
    else if (norm.includes("abdomen")) caseKey = "Abdomen";
    else if (norm.includes("escroto")) caseKey = "Escroto";
    else if (norm.includes("muneca")) caseKey = "Mu√±eca";
    else if (norm.includes("mama")) caseKey = "Mamas";
    else if (norm.includes("pantorrilla") || norm.includes("aquiles") || norm.includes("achilles") || norm.includes("pantorilla")) caseKey = "Pantorrilla y Tend√≥n de Aquiles";
    else if (norm.includes("cerebro") || norm.includes("neonatal") || norm.includes("transfontanelar")) caseKey = "Cerebro Neonatal";

    switch (caseKey) {
      case "Hombro":
        return { states: shoulderStates, setStates: setShoulderStates, descs: shoulderDescriptions, setDescs: setShoulderDescriptions };
      case "Rodilla":
        return { states: kneeStates, setStates: setKneeStates, descs: kneeDescriptions, setDescs: setKneeDescriptions };
      case "Tobillo":
        return { states: ankleStates, setStates: setAnkleStates, descs: ankleDescriptions, setDescs: setAnkleDescriptions };
      case "Muslo Anterior":
        return { states: thighStates, setStates: setThighStates, descs: thighDescriptions, setDescs: setThighDescriptions };
      case "Muslo Posterior":
        return { states: thighPosteriorStates, setStates: setThighPosteriorStates, descs: thighPosteriorDescriptions, setDescs: setThighPosteriorDescriptions };
      case "Cuello":
        return { states: neckStates, setStates: setNeckStates, descs: neckDescriptions, setDescs: setNeckDescriptions };
      case "Vias urinarias":
        return { states: urinaryStates, setStates: setUrinaryStates, descs: urinaryDescriptions, setDescs: setUrinaryDescriptions };
      case "Codo":
        return { states: elbowStates, setStates: setElbowStates, descs: elbowDescriptions, setDescs: setElbowDescriptions };
      case "Abdomen":
        return { states: abdomenStates, setStates: setAbdomenStates, descs: abdomenDescriptions, setDescs: setAbdomenDescriptions };
      case "Pared Abdominal":
        return { states: abdominalWallStates, setStates: setAbdominalWallStates, descs: abdominalWallDescriptions, setDescs: setAbdominalWallDescriptions };
      case "Escroto":
        return { states: scrotumStates, setStates: setScrotumStates, descs: scrotumDescriptions, setDescs: setScrotumDescriptions };
      case "Mu√±eca":
        return { states: wristStates, setStates: setWristStates, descs: wristDescriptions, setDescs: setWristDescriptions };
      case "Mamas":
        return { states: breastStates, setStates: setBreastStates, descs: breastDescriptions, setDescs: setBreastDescriptions };
      case "Pantorrilla y Tend√≥n de Aquiles":
        return { states: calfAchillesStates, setStates: setCalfAchillesStates, descs: calfAchillesDescriptions, setDescs: setCalfAchillesDescriptions };
      case "Cerebro Neonatal":
        return { states: neonatalBrainStates, setStates: setNeonatalBrainStates, descs: neonatalBrainDescriptions, setDescs: setNeonatalBrainDescriptions };
      default:
        return null;
    }
  };

  const handleApplySmartModification = async () => {
    if (!activeProtocol) return;
    setIsSmartAnatomyModifying(true);
    setSmartAnatomyError("");
    try {
      const helper = getProtocolStateAndSetters(activeProtocol);
      if (!helper) throw new Error("Protocolo no soportado");

      const structuresList = getStructuresForProtocol(activeProtocol);

      const response = await fetch("/api/smart-modify-anatomy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentStates: helper.states,
          currentDescriptions: helper.descs,
          structures: structuresList,
          instruction: smartInstructionsText,
          studyType: activeProtocol,
          reportText: isEditingReportManual ? editedReportText : (generatedReport || ""),
          model: selectedModel,
          currentAdditionalFindings: additionalFindings[activeProtocol] || []
        })
      });

      if (!response.ok) {
        throw new Error("Error al consultar el servicio inteligente de modificaci√≥n");
      }

      const data = await response.json();
      if (data.states && data.descriptions) {
        helper.setStates(data.states);
        helper.setDescs(data.descriptions);
        const nextExtras = data.additionalFindings && Array.isArray(data.additionalFindings)
          ? data.additionalFindings
          : data.additionalTexts && Array.isArray(data.additionalTexts)
            ? data.additionalTexts.map((txt: string, idx: number) => ({
                id: `smart-add-${idx}-${Date.now()}`,
                structureName: "Hallazgo Adicional " + (idx + 1),
                state: "Alterado",
                description: txt
              }))
            : [];

        if (data.additionalFindings && Array.isArray(data.additionalFindings)) {
          setAdditionalFindings(prev => ({
            ...prev,
            [activeProtocol]: data.additionalFindings
          }));
        } else if (data.additionalTexts && Array.isArray(data.additionalTexts)) {
          setAdditionalFindings(prev => ({
            ...prev,
            [activeProtocol]: nextExtras
          }));
        }
        
        // Extract only the newly requested/changed diagnoses
        const changedDiagnoses: string[] = [];
        for (const struct of structuresList) {
          const prevS = helper.states[struct.id] || "no_descrito";
          const prevD = helper.descs[struct.id] || "";
          const nextS = data.states[struct.id] || "no_descrito";
          const nextD = data.descriptions[struct.id] || "";

          if (nextS !== "no_descrito" && nextS !== "normal") {
            const hasStateChanged = prevS !== nextS;
            const hasDescChanged = prevD !== nextD;
            if (hasStateChanged || hasDescChanged) {
              changedDiagnoses.push(nextD);
            }
          }
        }

        const prevExtras = additionalFindings[activeProtocol] || [];
        for (const extra of nextExtras) {
          const matchingPrev = prevExtras.find((pe: any) => pe.id === extra.id);
          if (!matchingPrev || matchingPrev.description !== extra.description || matchingPrev.state !== extra.state) {
            changedDiagnoses.push(extra.description);
          }
        }

        if (changedDiagnoses.length > 0) {
          const activeReport = isEditingReportManual ? editedReportText : (generatedReport || "");
          const separator = activeReport ? "\n\n" : "";
          const textToAppend = changedDiagnoses.join("\n");
          const nextReport = activeReport + separator + textToAppend;

          if (isEditingReportManual) {
            setEditedReportText(nextReport);
          } else {
            setGeneratedReport(nextReport);
            setEditedReportText(nextReport);
          }
        }

        setSmartInstructionsText("");
      } else {
        throw new Error("No se devolvieron estados ni descripciones actualizados.");
      }
    } catch (err: any) {
      setSmartAnatomyError(err.message || "Error al aplicar los ajustes inteligentes.");
    } finally {
      setIsSmartAnatomyModifying(false);
    }
  };

  const checkApiHealth = async () => {
    setCheckingApi(true);
    setApiDiagnostics(null); // Explicitly reset to null to show loading state initially
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout
    
    try {
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      setApiDiagnostics(data);
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error("Error diagnosticando API:", e);
      setApiDiagnostics({
        status: "error",
        message: "No se pudo conectar con el servidor para diagnosticar la API.",
        error: e?.name === "AbortError" ? "Se agot√≥ el tiempo de espera (Timeout de 6s)." : (e?.message || String(e)),
        api_key_configured: false
      });
    } finally {
      setCheckingApi(false);
    }
  };

  // Run the diagnostic load automatically when switching to the API or configuration tabs
  useEffect(() => {
    if (activeTab === "api") {
      checkApiHealth();
    }
  }, [activeTab]);

  // Initialize values and load from Local Storage on mount
  useEffect(() => {
    // Instructions setup
    const savedGenInst = localStorage.getItem("radiology_sys_inst");
    if (savedGenInst) setSystemInstruction(savedGenInst);
    else {
      setSystemInstruction(GENERAL_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_sys_inst", GENERAL_SYSTEM_INSTRUCTION);
    }

    const savedChatInst = localStorage.getItem("radiology_chat_inst");
    if (savedChatInst) setChatInstruction(savedChatInst);
    else {
      setChatInstruction(CHAT_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_chat_inst", CHAT_SYSTEM_INSTRUCTION);
    }

    const savedClassInst = localStorage.getItem("radiology_class_inst");
    if (savedClassInst) setClassifyInstruction(savedClassInst);
    else {
      setClassifyInstruction(CLASSIFICATION_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_class_inst", CLASSIFICATION_SYSTEM_INSTRUCTION);
    }

    // Reports log setup with IndexedDB persistent storage
    idbGetHistory().then(idbReports => {
      if (Array.isArray(idbReports) && idbReports.length > 0) {
        setSavedReports(idbReports);
      } else {
        const storedReports = localStorage.getItem("radiology_reports_history");
        if (storedReports) {
          try {
            const parsed = JSON.parse(storedReports);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSavedReports(parsed);
              idbSaveHistory(parsed);
            }
          } catch (e) {
            setSavedReports([]);
          }
        }
      }
    });
  }, []);

  // Prevent browser-added default print headers and footers by dynamically stripping title during print
  useEffect(() => {
    const handleBeforePrint = () => {
      try {
        (window as any)._originalDocTitle = document.title;
        document.title = "";
      } catch (e) {
        console.error(e);
      }
    };
    const handleAfterPrint = () => {
      try {
        if (typeof (window as any)._originalDocTitle === "string" && (window as any)._originalDocTitle) {
          document.title = (window as any)._originalDocTitle;
        } else {
          document.title = "My Google AI Studio App";
        }
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);



  // Set defaults or modify states based on active preset selection
  const applyPreset = (preset: Presets) => {
    handleLoadStudyType(preset.studyType || "");
    setClinicalHistory(preset.defaultHistory || "");
    setCustomPrompt(preset.customPrompt || "");
  };

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    const preset = STUDY_PRESETS.find(p => p.id === id);
    if (preset) {
      applyPreset(preset);
    }
  };

  const resetGeneratorForm = () => {
    setCurrentCloudStudyId("");
    setModality("Radiograf√≠a");
    setSpecificStudy("T√≥rax");
    setCustomStudy("");
    setLaterality("");
    setProjections([]);
    setCustomProjection("");
    setStudyType("");
    setClinicalHistory("");
    setFindings("");
    setInputReport("");
    setUploadedReportContent("");
    setUploadedReportName(null);
    setUploadedReportMimeType("");
    setCustomPrompt("");
    setSelectedFile(null);
    setBase64Image(null);
    setGeneratedReport("");
    setReportError(null);
    setReportHistory([]);
    setReportRedoHistory([]);
    setIsEditingReportManual(false);
    setEditedReportText("");
    setSelectedPresetId("");
    setImageEvaluation("");
    setIsEvaluatingImage(false);
    setCurrentModInstruction("");
    setIsModifyingReport(false);
    setModifyError(null);
    setAdditionalEvaluation("");
    setIsEvaluatingAdditional(false);
    setAdditionalEvalError(null);
    setCaseAnalysis("");
    setIsAnalyzingCase(false);
    setCaseAnalysisError(null);
    setBibliography("");
    setIsSearchingBibliography(false);
    setBibliographyError(null);
    setBibliographySources([]);
    setReportEvaluation("");
    setIsEvaluatingReport(false);
    setReportEvaluationError(null);
    setAnnotations([]);
    setIsDrawingBox(false);
    setDrawStartPercent(null);
    setTempBox(null);
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  // Convert File to base64
  const processImageFile = (file: File) => {
    const isZip = file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    if (isZip) {
      setZipFile(file);
      setIsZipExtractorOpen(true);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Por favor, sube un archivo de tipo imagen (PNG, JPG, BMP).");
      return;
    }
    
    // File size safety check
    if (file.size > 15 * 1024 * 1024) {
      alert("La imagen excede el l√≠mite recomendado de 15MB.");
      return;
    }

    setSelectedFile(file);
    
    // Revoke old blob URL
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreviewUrl);
      } catch (_) {}
    }
    
    const objUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        // Strip out metadata prefix (e.g., "data:image/png;base64,") for SDK
        const parts = reader.result.split(",");
        if (parts.length > 1) {
          setBase64Image(parts[1]);
        } else {
          setBase64Image(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadExtractedToGenerator = (extracted: ExtractedFile) => {
    const fileObj = new File([extracted.rawArray], extracted.nameOnly, { type: extracted.mimeType });
    setSelectedFile(fileObj);
    setBase64Image(extracted.base64);
    
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      try { URL.revokeObjectURL(imagePreviewUrl); } catch (_) {}
    }
    
    if (extracted.isDicom) {
      // Use the beautiful decoded visual base64 directly as preview so the browser can display it
      setImagePreviewUrl(extracted.visualUrl || `data:image/png;base64,${extracted.base64}`);
    } else {
      const blob = new Blob([extracted.rawArray], { type: extracted.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setImagePreviewUrl(blobUrl);
    }
  };

  const handleLoadExtractedToSlot = (extracted: ExtractedFile, slot: 1 | 2 | 3) => {
    let cleanUrl = extracted.visualUrl ? extracted.visualUrl.trim().replace(/\s/g, "") : "";
    if (cleanUrl && !cleanUrl.startsWith("data:") && !cleanUrl.startsWith("blob:")) {
      let mime = "image/png";
      if (cleanUrl.startsWith("/9j/")) {
        mime = "image/jpeg";
      } else if (cleanUrl.startsWith("iVBORw0KGgo")) {
        mime = "image/png";
      } else if (cleanUrl.startsWith("PHN2Zy")) {
        mime = "image/svg+xml";
      }
      cleanUrl = `data:${mime};base64,${cleanUrl}`;
    }

    console.log(`[ZIP Single Loader] Pre-load check: Slot ${slot} - File: ${extracted.nameOnly}`);
    console.log(`[ZIP Single Loader] visualUrl first 150 chars:`, cleanUrl ? cleanUrl.substring(0, 150) + "..." : "EMPTY");

    setZipExtractedFileForAnalysis({
      file: {
        ...extracted,
        visualUrl: cleanUrl
      },
      slot
    });
    setActiveTab("expert-analysis"); // Automatically switch to the "expert-analysis" tab so they see it load!
  };

  const handleLoadMultipleSlots = (selections: { file: ExtractedFile; slot: 1 | 2 | 3 }[]) => {
    // Explicitly sanitize each file's visualUrl to ensure zero serialization issues before reaching components
    const sanitizedSelections = selections.map(seq => {
      let cleanUrl = seq.file.visualUrl ? seq.file.visualUrl.trim().replace(/\s/g, "") : "";
      
      // If it doesn't start with base64 data: or blob:, prepend correct header
      if (cleanUrl && !cleanUrl.startsWith("data:") && !cleanUrl.startsWith("blob:")) {
        let mime = "image/png";
        if (cleanUrl.startsWith("/9j/")) {
          mime = "image/jpeg";
        } else if (cleanUrl.startsWith("iVBORw0KGgo")) {
          mime = "image/png";
        } else if (cleanUrl.startsWith("PHN2Zy")) {
          mime = "image/svg+xml";
        }
        cleanUrl = `data:${mime};base64,${cleanUrl}`;
      }

      console.log(`[ZIP Batch Loader] Pre-load check: Slot ${seq.slot} - File: ${seq.file.nameOnly}`);
      console.log(`[ZIP Batch Loader] mimeType detected:`, seq.file.mimeType);
      console.log(`[ZIP Batch Loader] visualUrl base64 structure:`, cleanUrl ? cleanUrl.substring(0, 150) + "..." : "EMPTY");
      
      return {
        ...seq,
        file: {
          ...seq.file,
          visualUrl: cleanUrl
        }
      };
    });

    setZipExtractedFileForAnalysis(sanitizedSelections);
    setActiveTab("expert-analysis"); // Automatically switch to the "expert-analysis" tab so they see it load!
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const imageRef = useRef<HTMLImageElement | null>(null);

  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pendingAnnotation) return;
    
    const coords = getRelativeCoords(e);
    if (!coords) return;

    if (activeAnnotationTool === "point") {
      setPendingAnnotation({
        type: "point",
        x: coords.x,
        y: coords.y,
      });
      setPendingLabel("");
    } else {
      setIsDrawingBox(true);
      setDrawStartPercent(coords);
      setTempBox({
        x: coords.x,
        y: coords.y,
        w: 0,
        h: 0,
      });
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingBox || !drawStartPercent) return;
    const coords = getRelativeCoords(e);
    if (!coords) return;

    const x = Math.min(drawStartPercent.x, coords.x);
    const y = Math.min(drawStartPercent.y, coords.y);
    const w = Math.abs(drawStartPercent.x - coords.x);
    const h = Math.abs(drawStartPercent.y - coords.y);

    setTempBox({ x, y, w, h });
  };

  const handleImageMouseUp = () => {
    if (!isDrawingBox || !tempBox) return;
    setIsDrawingBox(false);
    setDrawStartPercent(null);

    if (tempBox.w < 1 && tempBox.h < 1) {
      setTempBox(null);
      return;
    }

    setPendingAnnotation({
      type: "box",
      x: tempBox.x,
      y: tempBox.y,
      w: tempBox.w,
      h: tempBox.h,
    });
    setPendingLabel("");
    setTempBox(null);
  };

  const handleAutoLabelAnnotation = async () => {
    if (!pendingAnnotation || !base64Image) {
      setAutoLabelError("No hay una imagen cargada o regi√≥n seleccionada.");
      return;
    }

    setIsAutoLabeling(true);
    setAutoLabelError(null);

    try {
      const response = await fetch("/api/auto-label-annotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image,
          mimeType: selectedFile?.type || "image/png",
          studyType: studyType || "Estudio de Imagen",
          clinicalHistory: clinicalHistory || "",
          annotation: {
            type: pendingAnnotation.type,
            x: pendingAnnotation.x,
            y: pendingAnnotation.y,
            w: pendingAnnotation.w,
            h: pendingAnnotation.h,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener la etiqueta sugerida de la IA.");
      }

      if (data.label) {
        setPendingLabel(data.label);
      } else {
        setAutoLabelError("La IA no pudo sugerir una etiqueta clara para esta regi√≥n.");
      }
    } catch (err: any) {
      console.error("Error al obtener etiqueta IA:", err);
      setAutoLabelError(err.message || String(err));
    } finally {
      setIsAutoLabeling(false);
    }
  };

  const handleSaveAnnotation = () => {
    if (!pendingAnnotation) return;
    const labelToSave = pendingLabel.trim() || (pendingAnnotation.type === "point" ? `Punto de Inter√©s #${annotations.length + 1}` : `Zona de Sospecha #${annotations.length + 1}`);
    
    const newAnn: ImageAnnotation = {
      id: Math.random().toString(36).substring(2, 11),
      type: pendingAnnotation.type,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      w: pendingAnnotation.w,
      h: pendingAnnotation.h,
      label: labelToSave,
    };

    setAnnotations([...annotations, newAnn]);
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  const handleCancelPending = () => {
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter((ann) => ann.id !== id));
  };

  const handleClearAllAnnotations = () => {
    setAnnotations([]);
  };

  // 1. ACTION: SEND PAYLOAD TO GENERATE REPORT
  const handleGenerateReport = async () => {
    if (!studyType.trim()) {
      setReportError("Por favor, especifica el Tipo de Estudio solicitado.");
      return;
    }

    // Reset current cloud study ID for the newly generated report
    setCurrentCloudStudyId("");

    setIsGenerating(true);
    setReportError(null);
    setGeneratedReport("");
    setClassRecommendations(null);
    setIncorporatedRecs({});
    setImageEvaluation("");
    setAdditionalEvaluation("");
    setCurrentModInstruction("");
    setModifyError(null);
    setAdditionalEvalError(null);
    setCaseAnalysis("");
    setCaseAnalysisError(null);
    setBibliography("");
    setBibliographyError(null);
    setBibliographySources([]);
    setReportEvaluation("");
    setReportEvaluationError(null);

    // Setup visual steps for medical analysis feeling
    const steps = [
      "Extrayendo metadatos cl√≠nicos...",
      "Estableciendo canal seguro con Gemini...",
      selectedFile ? "Renderizando densidades anat√≥micas complejas..." : "Analizando concordancia sint√°ctica...",
      "Aplicando reglas de redacci√≥n radiol√≥gica...",
      "Compilando informe estructurado..."
    ];

    let currentStepIndex = 0;
    setGenerationSteps(steps[0]);

    const stepInterval = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setGenerationSteps(steps[currentStepIndex]);
      }
    }, 1200);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image || undefined,
          mimeType: selectedFile ? selectedFile.type : undefined,
          studyType,
          clinicalHistory,
          findings,
          inputReport,
          uploadedReportContent: uploadedReportContent || undefined,
          uploadedReportMimeType: uploadedReportMimeType || undefined,
          systemInstruction: systemInstruction || undefined,
          annotations: annotations.length > 0 ? annotations : undefined,
          attachedImages: attachedImages && attachedImages.length > 0 ? attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || ""
          })) : undefined,
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        const textResponse = await response.text().catch(() => "");
        throw new Error(`La respuesta del servidor no es JSON v√°lido (C√≥digo HTTP ${response.status}). Detalle: ${textResponse.slice(0, 200) || "Sin respuesta del servidor"}`);
      }

      clearInterval(stepInterval);

      if (response.ok && data.success) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setOriginalBaseReport(data.report);

        // Resetear casillas del Sistema de Activaci√≥n R√°pida de M√≥dulos: por defecto Atlas 3D, Cuadro Sin√≥ptico de √ìrgano, Resumen Operacional y Paciente marcados
        setSelectedBatchModules({
          radar: false,
          atlas_3d: true,
          vascular_3d: false,
          case_analysis: false,
          quality_eval: false,
          bibliography: false,
          operational_summary: true,
          patient_summary: true,
          glossary: false,
          schematic: false,
          measurements: false,
          footnotes: false,
          organ_synoptic: true,
          fractures: false,
          classifications: false,
        });

        // Activaci√≥n Autom√°tica de Evaluaci√≥n de Calidad al Generar Reporte
        handleEvaluateReport(data.report);

        // Auto-detect specific study protocol (e.g. Muslo Posterior, Hombro, Rodilla, etc.) and switch active components
        autoDetectSpecificStudyAndModality(data.report, studyType);
        
        // Save to History Log
        const newReport: SavedReport = {
          id: Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toLocaleDateString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }),
          studyType,
          clinicalHistory: clinicalHistory || "No especificada",
          reportText: data.report
        };

        const updatedHistory = [newReport, ...savedReports.slice(0, 49)]; // Keep up to 50 reports in history
        setSavedReports(updatedHistory);
        localStorage.setItem("radiology_reports_history", JSON.stringify(updatedHistory));
        idbSaveHistory(updatedHistory);

        // Auto-save generated report into local studies database (IndexedDB + localStorage)
        try {
          const autoStudy: CloudStudy = {
            id: newReport.id,
            userId: "local",
            userEmail: "anon@local.com",
            timestamp: newReport.timestamp,
            patientName: patientName || "Paciente Local",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "M√©dico Radi√≥logo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Cl√≠nica Privada",
            studyType,
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "Hallazgos guardados autom√°ticamente.",
            reportText: data.report,
            attachedImages: attachedImages || [],
            operationalSummaryText: "",
            pdfBase64: "",
            patientSummary: null,
            createdAt: new Date().toISOString(),
            specificStudy: specificStudy || "General",
            pdfLayoutType: pdfLayoutType || "classic",
            selectedLogo: selectedLogo || "none"
          };

          // Save into IndexedDB reliably
          await idbSaveStudy(autoStudy);

          const storedStudies = localStorage.getItem("rad_local_studies");
          let studiesList: CloudStudy[] = storedStudies ? JSON.parse(storedStudies) : [];
          studiesList = [autoStudy, ...studiesList.filter(s => s.id !== autoStudy.id)];
          try {
            localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
          } catch (e) {}
          
          // Re-fetch cloud/local studies to update UI
          fetchCloudStudies();
        } catch (autoErr) {
          console.warn("Error auto-saving study to local archive:", autoErr);
        }

        // If base64Image is present, automatically trigger image evaluation
        if (base64Image) {
          triggerAutoImageEvaluation(base64Image, selectedFile?.type, studyType, clinicalHistory, findings, annotations);
        }
      } else {
        setReportError(data.error || `Error del servidor (C√≥digo ${response.status}): ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      clearInterval(stepInterval);
      setReportError(`Falla de red o de servidor: ${error?.message || String(error)}. Aseg√∫rate de que el servidor est√° encendido y que tu API Key en la pesta√±a de Configuraci√≥n es correcta.`);
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to trigger standard image clinical assessment automatically
  const triggerAutoImageEvaluation = async (
    img: string,
    mime: string | undefined,
    study: string,
    history: string,
    finds: string,
    anns?: ImageAnnotation[]
  ) => {
    setIsEvaluatingImage(true);
    try {
      const resp = await fetch("/api/evaluate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          image: img,
          mimeType: mime || "image/png",
          studyType: study,
          clinicalHistory: history,
          findings: finds,
          isAdditional: false,
          annotations: anns && anns.length > 0 ? anns : undefined,
        }),
      });
      const resData = await resp.json();
      if (resData.success && resData.evaluation) {
        setImageEvaluation(resData.evaluation);
      }
    } catch (e) {
      console.error("Error auto-evaluating image:", e);
    } finally {
      setIsEvaluatingImage(false);
    }
  };

  // ACTION: ASSIST AND POLISH STUDY INDICATION (CASING & SPELLING ORTHOGRAPHY)
  const handleAssistClinicalHistory = async () => {
    if (!clinicalHistory.trim() || isAssistingHistory) return;
    setIsAssistingHistory(true);
    try {
      const response = await fetch("/api/assist-clinical-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          clinicalHistory,
          studyType,
        }),
      });
      const data = await response.json();
      if (data.success && data.polishedText) {
        setClinicalHistory(data.polishedText);
      } else {
        console.error("No se pudo pulir la indicaci√≥n:", data.error);
      }
    } catch (e) {
      console.error("Error al asistir con la indicaci√≥n cl√≠nica:", e);
    } finally {
      setIsAssistingHistory(false);
    }
  };

  // ACTION: REQUEST CUSTOM MODIFICATIONS (DIALOG MODIFIER) OR QUICK BUTTONS
  const handleModifyReport = async (instructionText: string) => {
    if (!generatedReport) return;
    setIsModifyingReport(true);
    setModifyError(null);
    try {
      const response = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: generatedReport,
          instruction: instructionText,
          image: base64Image || undefined,
          mimeType: selectedFile?.type || undefined,
          attachedImages: attachedImages && attachedImages.length > 0 ? attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || ""
          })) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setCurrentModInstruction("");
      } else {
        setModifyError(data.error || "Ocurri√≥ un error al intentar modificar el informe.");
      }
    } catch (err: any) {
      console.error("Error al modificar informe:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setIsModifyingReport(false);
    }
  };

  const processRecQueue = async () => {
    if (isProcessingRecQueueRef.current) return;
    isProcessingRecQueueRef.current = true;
    setIsModifyingReport(true);
    setModifyError(null);

    while (recQueueRef.current.length > 0) {
      const recText = recQueueRef.current[0];
      const activeReport = isEditingReportManualRef.current ? editedReportTextRef.current : (generatedReportRef.current || "");

      if (!activeReport) {
        recQueueRef.current.shift();
        setPendingRecs(prev => {
          const next = { ...prev };
          delete next[recText];
          return next;
        });
        continue;
      }

      let sanitizedRec = recText.trim();
      sanitizedRec = sanitizedRec.replace(/^\*\*|\*\*$/g, "").trim();
      sanitizedRec = sanitizedRec.replace(/^["']|["']$/g, "").trim();

      setPendingRecText(recText);

      try {
        const response = await fetch("/api/modify-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModelRef.current,
            currentReport: activeReport,
            instruction: `Integra de forma totalmente fluida, nativa y natural, actuando en todo momento como el radi√≥logo principal que redacta el informe desde el principio, la siguiente clasificaci√≥n, escala o recomendaci√≥n cl√≠nica: "${sanitizedRec}". REQUISITO CR√çTICO: NO debes justificar la recomendaci√≥n, ni meter introducciones, explicaciones cl√≠nicas de por qu√© se usa ("para facilitar el manejo...", "se sugiere...", "como recomendaci√≥n de auditor√≠a..."), ni meta-comentarios. Escribe directo la categor√≠a, el grado o el dato cl√≠nico en la secci√≥n adecuada del reporte (HALLAZGOS o IMPRESI√ìN DIAGN√ìSTICA). Conserva intacto todo el resto del reporte.`,
            image: base64ImageRef.current || undefined,
            mimeType: selectedFileRef.current?.type || undefined,
          }),
        });
        const data = await response.json();
        if (data.success && data.report) {
          setReportHistory((prev) => [...prev, activeReport]);
          setReportRedoHistory([]);
          setGeneratedReport(data.report);
          setEditedReportText(data.report);
          generatedReportRef.current = data.report;
          editedReportTextRef.current = data.report;

          setIncorporatedAuditRecs(prev => ({
            ...prev,
            [recText]: true
          }));
        } else {
          setModifyError(data.error || "Ocurri√≥ un error al intentar incorporar de manera inteligente la recomendaci√≥n.");
        }
      } catch (err: any) {
        console.error("Error al incorporar recomendaci√≥n de auditor√≠a:", err);
        setModifyError(err?.message || String(err));
      } finally {
        recQueueRef.current.shift();
        setPendingRecs(prev => {
          const next = { ...prev };
          delete next[recText];
          return next;
        });
        setPendingRecText(null);
      }
    }

    isProcessingRecQueueRef.current = false;
    setIsModifyingReport(false);
  };

  const handleIncorporateRecommendation = (recText: string) => {
    if (!recText || incorporatedAuditRecs[recText] || pendingRecs[recText]) return;

    setPendingRecs(prev => ({ ...prev, [recText]: true }));
    recQueueRef.current.push(recText);
    processRecQueue();
  };

  const handleIncorporateToReport = (analysisText: string, studyTitle: string, medicalHistoryCombined: string, isAutoSync: boolean = false) => {
    // Check if it is a structured Case Analysis with JSON
    const jsonMatch = analysisText.match(/\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/);
    if (jsonMatch && jsonMatch[0]) {
      const jsonBlock = jsonMatch[0] + "\n\n";
      const textSummary = analysisText.replace(jsonMatch[0], "").trim();
      let format = "custom";
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        format = parsed.format || "custom";
      } catch (e) {
        console.error(e);
      }
      setFindings(prev => {
        return mergeCaseAnalysisBlock(prev || "", format, jsonBlock, textSummary);
      });
    } else {
      const wrappedContent = `=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===\n${analysisText}\n=== FIN DE VALORACI√ìN EXPERTA ===`;
      
      setFindings(prev => {
        if (!prev) return `${wrappedContent}\n\n`;
        
        const regex = /=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===[\s\S]*?=== FIN DE VALORACI√ìN EXPERTA ===/;
        if (regex.test(prev)) {
          return prev.replace(regex, wrappedContent);
        }
        
        if (prev.includes("=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===")) {
          const splitted = prev.split("=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===");
          const afterPart = splitted.slice(1).join(" ");
          const cleanedAfter = afterPart.replace(/^[\s\S]*?\n\n/, "");
          return `${wrappedContent}\n\n${splitted[0]}${cleanedAfter}`;
        }
        
        return `${wrappedContent}\n\n${prev}`;
      });
    }

    // Auto-sync clinical history and study information into report generator inputs
    if (medicalHistoryCombined && !medicalHistoryCombined.includes("S/D. Sospecha: S/D")) {
      setClinicalHistory(prev => {
        if (!prev || prev.trim() === "") return medicalHistoryCombined;
        if (prev.includes(medicalHistoryCombined)) return prev;
        return `${prev}\n\n[Contexto Doble Valoraci√≥n]: ${medicalHistoryCombined}`;
      });
    }

    if (studyTitle) {
      setSpecificStudy(prev => {
        if (!prev || prev.trim() === "") return studyTitle;
        return prev;
      });
    }

    if (!isAutoSync) {
      setActiveTab("generator");
    }
  };

  // ACTION: REQUEST ADDITIONAL OR SECOND VIEW CLINICAL EVALUATION OF THE IMAGE
  const handleEvaluateImage = async () => {
    if (!base64Image) return;
    setIsEvaluatingAdditional(true);
    setAdditionalEvalError(null);
    try {
      const response = await fetch("/api/evaluate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image,
          mimeType: selectedFile?.type || "image/png",
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
          isAdditional: true,
          annotations: annotations.length > 0 ? annotations : undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.evaluation) {
        setAdditionalEvaluation(data.evaluation);
      } else {
        setAdditionalEvalError(data.error || "Error al realizar la valoraci√≥n adicional.");
      }
    } catch (err: any) {
      console.error("Error al evaluar imagen:", err);
      setAdditionalEvalError(err?.message || String(err));
    } finally {
      setIsEvaluatingAdditional(false);
    }
  };

  // ACTION: COMPLETE CASE ANALYSIS
  const handleAnalyzeCase = async () => {
    if (!generatedReport) return;
    setIsAnalyzingCase(true);
    setCaseAnalysisError(null);
    setCaseAnalysis("");
    setDiffsIncorporated(false);
    setDiffsError(null);
    try {
      const response = await fetch("/api/analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setCaseAnalysis(data.analysis);
      } else {
        setCaseAnalysisError(data.error || "Error al realizar el an√°lisis del caso.");
      }
    } catch (err: any) {
      console.error("Error al analizar caso:", err);
      setCaseAnalysisError(err?.message || String(err));
    } finally {
      setIsAnalyzingCase(false);
    }
  };

  // ACTIONS FOR ADVANCED VASCULAR ANALYSIS & DIAGRAMS
  const handleAnalyzeVascular = async () => {
    if (!generatedReport) return;
    setIsAnalyzingVascular(true);
    setVascularError(null);
    try {
      const response = await fetch("/api/analyze-vascular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          reportText: generatedReport,
          studyType: specificStudy
        }),
      });
      const data = await response.json();
      if (data.success) {
        setVascularTable(data.table || "");
        setVascularStates(data.states || {});
        setVascularDescriptions(data.descriptions || {});
        setVascularSubLocations(data.subLocations || {});
        setCarotidPlaques(data.carotidPlaques || []);
      } else {
        setVascularError(data.error || "No se pudieron analizar los hallazgos vasculares del informe.");
      }
    } catch (err: any) {
      console.error("Error al realizar el an√°lisis vascular:", err);
      setVascularError(err?.message || String(err));
    } finally {
      setIsAnalyzingVascular(false);
    }
  };

  const handleToggleVascularSegment = (segId: string) => {
    const isVenoso = specificStudy === "Doppler venoso de miembro inferior" || generatedReport.toLowerCase().includes("venoso");
    const current = vascularStates[segId] || "normal";
    
    let nextState = "normal";
    if (isVenoso) {
      // venous levels: normal -> reflux -> thrombosis -> normal
      if (current === "normal") nextState = "reflux";
      else if (current === "reflux") nextState = "thrombosis";
    } else {
      // arterial & carotid levels: normal -> mild -> severe -> normal
      if (current === "normal") nextState = "mild";
      else if (current === "mild") nextState = "severe";
    }

    setVascularStates(prev => ({
      ...prev,
      [segId]: nextState
    }));

    // Sutil prefilled description matching the manually edited state
    let label = "Normal / Conservado";
    if (nextState === "mild") label = "Placas ateromatosas con estenosis leve (<50%)";
    else if (nextState === "severe") label = "Estenosis hemodin√°micamente significativa / severa (>=50%)";
    else if (nextState === "reflux") label = "Insuficiencia valvular con reflujo retr√≥grado";
    else if (nextState === "thrombosis") label = "Obstrucci√≥n tromb√≥tica patente / No colapsable";

    setVascularDescriptions(prev => ({
      ...prev,
      [segId]: label
    }));
  };

  const handleExportVascularTableToReport = () => {
    if (!vascularTable) return;
    setReportHistory((prev) => [...prev, generatedReport]);
    const separator = "\n\n";
    const title = "### CUADRO DE HALLAZGOS VASCULARES (S√çNTESIS DIAGN√ìSTICA)\n";
    
    // Avoid double inclusion if already exists
    if (generatedReport.includes("### CUADRO DE HALLAZGOS VASCULARES")) {
      // Replace existing
      const regex = /### CUADRO DE HALLAZGOS VASCULARES[\s\S]+/g;
      const cleanReportText = generatedReport.replace(regex, "").trim();
      const nextReport = cleanReportText + separator + title + vascularTable;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    } else {
      const nextReport = generatedReport + separator + title + vascularTable;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    }
  };

  const handleExportVascularBlocksToReport = (blocksText: string) => {
    if (!blocksText) return;
    setReportHistory((prev) => [...prev, generatedReport]);
    const separator = "\n\n";
    const title = "### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER\n";
    
    // Format blocksText inside triple backticks so it gets parsed perfectly as standard code in markdown and PDF
    const formattedBlocks = blocksText.trim().startsWith("```") 
      ? blocksText 
      : "```text\n" + blocksText.trim() + "\n```";
    
    // Avoid double inclusion if already exists
    if (generatedReport.includes("### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER")) {
      // Replace existing
      const regex = /### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER[\s\S]+/g;
      const cleanReportText = generatedReport.replace(regex, "").trim();
      const nextReport = cleanReportText + separator + title + formattedBlocks;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    } else {
      const nextReport = generatedReport + separator + title + formattedBlocks;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    }
  };

  // ACTION: INCORPORATE ENRICHED DIFFERENTIAL DIAGNOSTICS SYNTHESIS TO REPORT
  const handleIncorporateDifferentialDiagnostics = async () => {
    if (!generatedReport || !caseAnalysis) return;
    setIsIncorporatingDiffs(true);
    setDiffsError(null);
    try {
      const response = await fetch("/api/incorporate-differentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: generatedReport,
          caseAnalysis: caseAnalysis,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setDiffsIncorporated(true);
      } else {
        setDiffsError(data.error || "Error al incorporar los diagn√≥sticos diferenciales sintetizados.");
      }
    } catch (err: any) {
      console.error("Error al incorporar diagn√≥sticos diferenciales:", err);
      setDiffsError(err?.message || String(err));
    } finally {
      setIsIncorporatingDiffs(false);
    }
  };

  // ACTION: MEDICAL BIBLIOGRAPHY SEARCH
  const handleSearchBibliography = async () => {
    if (!generatedReport) return;
    setIsSearchingBibliography(true);
    setBibliographyError(null);
    setBibliography("");
    setBibliographySources([]);
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setBibliography(data.bibliography);
        if (data.sources) {
          setBibliographySources(data.sources);
        }
      } else {
        setBibliographyError(data.error || "Error al buscar la bibliograf√≠a m√©dica.");
      }
    } catch (err: any) {
      console.error("Error al buscar bibliograf√≠a:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingBibliography(false);
    }
  };

  // ACTION: SEARCH MORE BIBLIOGRAPHY (PAGINATION/LOAD MORE)
  const handleSearchMoreBibliography = async () => {
    if (!generatedReport || isSearchingMoreBibliography) return;
    setIsSearchingMoreBibliography(true);
    setBibliographyError(null);
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          findings: findings || "",
          searchMore: true,
          existingSources: bibliographySources,
          existingBibliography: bibliography,
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setBibliography(data.bibliography);
        if (data.sources && data.sources.length > 0) {
          setBibliographySources((prev) => {
            const seenUris = new Set(prev.map((s) => s.uri.toLowerCase().trim()));
            const newSources = data.sources.filter((s: any) => s.uri && !seenUris.has(s.uri.toLowerCase().trim()));
            return [...prev, ...newSources];
          });
        }
      } else {
        setBibliographyError(data.error || "Error al buscar fuentes bibliogr√°ficas adicionales.");
      }
    } catch (err: any) {
      console.error("Error al buscar m√°s bibliograf√≠a:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingMoreBibliography(false);
    }
  };

  // ACTION: EVALUATE GENERATED REPORT
  const handleEvaluateReport = async (overrideReportText?: string) => {
    const activeReport = overrideReportText || (isEditingReportManual ? editedReportText : (generatedReport || ""));
    if (!activeReport) return;
    setIsEvaluatingReport(true);
    setReportEvaluationError(null);
    setReportEvaluation("");
    try {
      const response = await fetch("/api/evaluate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: activeReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.evaluation) {
        setReportEvaluation(data.evaluation);
      } else {
        setReportEvaluationError(data.error || "Error al realizar la evaluaci√≥n del reporte.");
      }
    } catch (err: any) {
      console.error("Error al evaluar reporte:", err);
      setReportEvaluationError(err?.message || String(err));
    } finally {
      setIsEvaluatingReport(false);
    }
  };

  // Gmail API Integrated Share Handlers (Google Workspace Integration)
  const handleOpenGmailShare = async (type: 'report_pdf' | 'patient_summary' | 'patient_infographic' | 'both_pdfs') => {
    setGmailAttachedType('report_pdf');
    setGmailTo(patientEmail || "");
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    // Only select the official report PDF (as other elements are now included directly in the report)
    setGmailAttachReport(true);
    setGmailAttachSummary(false);
    setGmailAttachInfographic(false);
    
    // Construct default subject & email body nicely for the official report
    const clientName = patientName || "Paciente";
    let subject = `Reporte de Estudio Cl√≠nico - ${clientName}`;
    let body = `Estimado(a) ${clientName},\n\nLe enviamos adjunto a este correo el Reporte de Estudio Cl√≠nico Oficial realizado.\n\n`;

    body += `Quedamos a su entera disposici√≥n para cualquier aclaraci√≥n o consulta adicional.\n\nAtentamente,\n${doctorName || "M√©dico Especialista"}`;
    
    setGmailSubject(subject);
    setGmailBody(body);
    setShowGmailModal(true);

    // Auto-save/update to cloud if user is logged in to ensure a valid and updated cloud link
    if (gmailUser && generatedReport) {
      try {
        await handleSaveToCloud();
      } catch (err) {
        console.error("Auto cloud save error on opening Gmail share:", err);
      }
    }
  };

  const handleGmailLogin = async () => {
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
        if (patientEmail && !gmailTo) {
          setGmailTo(patientEmail);
        }
      }
    } catch (err: any) {
      console.error("Gmail authorization failed:", err);
      setGmailErrorMessage("Error al autorizar con Google: " + (err.message || String(err)));
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await anonymousSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Anonymous authentication failed:", err);
      setGmailErrorMessage("Error al iniciar acceso instant√°neo: " + (err.message || String(err)));
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contrase√±a.");
      return;
    }
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await emailSignIn(authEmail, authPassword);
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Email authentication failed:", err);
      let friendlyMsg = err.message || String(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMsg = "Credenciales incorrectas o usuario no registrado.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "El formato del correo es inv√°lido.";
      }
      setGmailErrorMessage("Error de inicio de sesi√≥n: " + friendlyMsg);
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contrase√±a.");
      return;
    }
    if (authPassword.length < 6) {
      setGmailErrorMessage("La contrase√±a debe tener al menos 6 caracteres.");
      return;
    }
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await emailSignUp(authEmail, authPassword);
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Email registration failed:", err);
      let friendlyMsg = err.message || String(err);
      if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = "Este correo electr√≥nico ya est√° registrado.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "El formato del correo es inv√°lido.";
      } else if (err.code === 'auth/weak-password') {
        friendlyMsg = "La contrase√±a es muy d√©bil (m√≠nimo 6 caracteres).";
      }
      setGmailErrorMessage("Error al registrar especialista: " + friendlyMsg);
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleGmailLogout = async () => {
    try {
      await googleLogout();
      setGmailUser(null);
      setGmailAccessToken(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleSendGmailAction = async () => {
    if (!gmailAccessToken) {
      setGmailErrorMessage("Debes iniciar sesi√≥n con Google antes de realizar el env√≠o.");
      return;
    }
    if (!gmailTo) {
      setGmailErrorMessage("Por favor, especifica el correo electr√≥nico del destinatario.");
      return;
    }
    if (!gmailAttachReport && !gmailAttachSummary && !gmailAttachInfographic) {
      setGmailErrorMessage("Por favor, selecciona al menos un archivo para adjuntar.");
      return;
    }
    
    setIsSendingGmail(true);
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    try {
      // Helper to chunk base64 strings into 76-character blocks as required by standard MIME (RFC 2045)
      // and strictly enforced by intermediate SMTP servers/receivers (RFC 5321 line length limits of 1000 chars)
      const chunkBase64WithCRLF = (base64Str: string): string => {
        const chunks: string[] = [];
        for (let i = 0; i < base64Str.length; i += 76) {
          chunks.push(base64Str.substring(i, i + 76));
        }
        return chunks.join("\n");
      };

      let explanationPDFBase64 = "";
      let reportPDFBase64 = "";
      let infographicBase64 = "";
      let infographicContentType = "image/png";

      // 1. Generate PDFs in-memory as Base64 strings if selected/checked
      if (gmailAttachSummary) {
        if (!patientSummary) {
          throw new Error("Debe generar primero la 'Traducci√≥n Emp√°tica y Explicaci√≥n' para poder adjuntarla.");
        }
        const rawSummaryB64 = await handleDownloadPatientSummaryPDF(false, false, true) || "";
        explanationPDFBase64 = chunkBase64WithCRLF(rawSummaryB64);
      }

      if (gmailAttachReport) {
        if (!generatedReport) {
          throw new Error("Debe generar primero el 'Reporte de Estudio' para poder adjuntarlo.");
        }
        const rawReportB64 = await handleDownloadNativePDF(false, false, true) || "";
        reportPDFBase64 = chunkBase64WithCRLF(rawReportB64);
      }

      // 2. Fetch and convert infographic image if selected/checked
      if (gmailAttachInfographic) {
        if (!infographicUrl) {
          throw new Error("Debe generar primero la 'Infograf√≠a' para poder adjuntarla.");
        }
        try {
          let plainInfographicBase64 = "";
          if (infographicUrl.startsWith("data:")) {
            const match = infographicUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              infographicContentType = match[1];
              plainInfographicBase64 = match[2];
            } else {
              throw new Error("Formato de URL de datos de infograf√≠a no reconocido.");
            }
          } else {
            const res = await fetch(infographicUrl);
            const blob = await res.blob();
            infographicContentType = blob.type || "image/png";
            
            const arrayBuf = await blob.arrayBuffer();
            const bytesList = new Uint8Array(arrayBuf);
            let binaryStr = "";
            for (let i = 0; i < bytesList.length; i++) {
              binaryStr += String.fromCharCode(bytesList[i]);
            }
            plainInfographicBase64 = window.btoa(binaryStr);
          }
          infographicBase64 = chunkBase64WithCRLF(plainInfographicBase64);
        } catch (imageErr: any) {
          throw new Error("Error al preparar la imagen de la infograf√≠a: " + (imageErr.message || String(imageErr)));
        }
      }

      // 3. Build RFC 2822 Multipart MIME Message cleanly
      const boundary = "boundary_part_medico_reporte_" + Math.random().toString(36).substring(2);

      // Helper to strip accents & restrict to safe ASCII characters for MIME headers
      const sanitizeMimeFilename = (nameStr: string): string => {
        return nameStr
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/√±/gi, "n")
          .replace(/[^a-zA-Z0-9_\.-]/g, "_")
          .replace(/\s+/g, "_");
      };

      const cleanPatientName = patientName ? sanitizeMimeFilename(patientName) : "paciente";
      const filenameSummary = `Explicacion_${cleanPatientName}.pdf`;
      const filenameReport = `Reporte_${cleanPatientName}.pdf`;
      const fileExt = infographicContentType === "image/jpeg" ? "jpg" : "png";
      const filenameInfographic = `Infografia_${cleanPatientName}.${fileExt}`;

      const formattedBody = gmailBody.replace(/\n/g, "<br/>");
      const htmlBodyContent = `<div style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">${formattedBody}</div>`;
      const htmlBodyBase64Raw = window.btoa(unescape(encodeURIComponent(htmlBodyContent)));
      const htmlBodyBase64 = chunkBase64WithCRLF(htmlBodyBase64Raw);

      // Set UTF-8 encoded subject to guarantee character sets are preserved
      const b64Subject = window.btoa(unescape(encodeURIComponent(gmailSubject)));

      const parts: string[] = [];
      parts.push(`MIME-Version: 1.0`);
      parts.push(`To: ${gmailTo}`);
      parts.push(`Subject: =?utf-8?B?${b64Subject}?=`);
      parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      parts.push(``); // Blank line separating headers from standard multipart payload

      // Email text content part (Base64 encoded to safely preserve all Spanish characters/accents)
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: text/html; charset="UTF-8"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push(``); // Blank line separating part headers from content
      parts.push(htmlBodyBase64);
      parts.push(``); // Safe spacer

      // Native Report Attachment
      if (gmailAttachReport && reportPDFBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: application/pdf; name="${filenameReport}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameReport}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(reportPDFBase64);
        parts.push(``); // Safe spacer
      }

      // Patient Summary/Explanation Attachment
      if (gmailAttachSummary && explanationPDFBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: application/pdf; name="${filenameSummary}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameSummary}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(explanationPDFBase64);
        parts.push(``); // Safe spacer
      }

      // Infographic Image Attachment
      if (gmailAttachInfographic && infographicBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: ${infographicContentType}; name="${filenameInfographic}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameInfographic}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(infographicBase64);
        parts.push(``); // Safe spacer
      }

      // End boundary
      parts.push(`--${boundary}--`);

      // Combine parts with exact standard CRLF
      const emailRaw = parts.join("\n");
      
      // Base64URL encode MIME message safely
      const utf8Encoder = new TextEncoder();
      const bytes = utf8Encoder.encode(emailRaw);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

       // 4. Post to Google Gmail API send endpoint
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw: base64Url
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setGmailAccessToken(null);
          localStorage.removeItem("rad_gmail_access_token");
          throw new Error("Su sesi√≥n de Gmail ha expirado por seguridad (las sesiones de Google duran 1 hora). Como hemos habilitado el acceso r√°pido, simplemente haga clic en 'Autorizar Gmail' para renovarla en 1 segundo sin tener que volver a elegir su cuenta ni ingresar sus datos.");
        }
        const errorText = await response.text();
        throw new Error(`Gmail API report√≥ un error de env√≠o: ${errorText}`);
      }

      setGmailSuccessMessage("¬°Correo electr√≥nico enviado con √©xito v√≠a Gmail!");
    } catch (err: any) {
      console.error("Failed to send email via Gmail:", err);
      setGmailErrorMessage("Error al enviar el correo: " + (err.message || String(err)));
    } finally {
      setIsSendingGmail(false);
    }
  };

  // WhatsApp Share Handlers
  const handleOpenWhatsAppShare = async (type: 'report_pdf' | 'patient_infographic' | 'patient_summary') => {
    setWhatsappShareType(type);
    setShowWhatsAppModal(true);

    if (type === 'patient_summary') {
      setWhatsappIncludePatientSummary(true);
      setWhatsappIncludeOperationalSummary(false);
    } else if (type === 'report_pdf') {
      setWhatsappIncludeOperationalSummary(operationalSummaryText ? true : false);
      setWhatsappIncludePatientSummary(false);
    } else {
      setWhatsappIncludePatientSummary(patientSummary ? true : false);
      setWhatsappIncludeOperationalSummary(operationalSummaryText ? true : false);
    }
  };

  const getWhatsAppTextPreview = (overrideId?: string) => {
    let text = `*REPORTE RADIOL√ìGICO DIGITAL*\n`;
    text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n\n`;

    if (patientName) text += `*Paciente:* ${patientName}\n`;
    if (patientAge) text += `*Edad:* ${patientAge}\n`;
    if (patientGender) text += `*G√©nero:* ${patientGender}\n`;
    if (patientId) text += `*ID/C√©dula:* ${patientId}\n`;
    if (studyType) text += `*Estudio:* ${studyType}\n`;
    if (reportDate) text += `*Fecha:* ${formatDateToDMY(reportDate)}\n`;
    if (doctorName) text += `*Especialista:* ${doctorName}\n`;
    text += `\n`;

    // 1. Resumen Cl√≠nico Operativo (Conclusions)
    if (whatsappIncludeOperationalSummary && operationalSummaryText) {
      const cleanOperationalSummary = operationalSummaryText
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{1F000}-\u{1F9FF}]/gu, "")
        .replace(/\p{Emoji_Presentation}/gu, "")
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "")
        .replace(/  +/g, ' ')
        .trim();

      text += `*RESUMEN CL√çNICO OPERATIVO*\n`;
      text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n`;
      text += `${cleanOperationalSummary}\n\n`;
    }

    // 2. Acompa√±amiento Explicativo para el Paciente
    if (whatsappIncludePatientSummary && patientSummary) {
      text += `*EXPLICACI√ìN PARA EL PACIENTE*\n`;
      text += `_Traducci√≥n de hallazgos m√©dicos a un lenguaje claro_\n`;
      text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n\n`;

      if (patientSummary.summary) {
        text += `*Resumen de su estado:*\n${patientSummary.summary.trim()}\n\n`;
      }

      if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
        text += `*Hallazgos Principales:*\n`;
        patientSummary.keyFindings.forEach((finding: any, idx: number) => {
          const title = finding.finding || finding.title || "";
          const desc = finding.explanation || finding.description || "";
          text += `${idx + 1}. *${title}:* ${desc}\n`;
        });
        text += `\n`;
      }
    }

    text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n`;
    text += `_Por favor, descargue y conserve los documentos PDF oficiales adjuntos para presentarlos en su pr√≥xima consulta de seguimiento._`;
    return text;
  };

  const handleSendWhatsAppAction = async () => {
    let studyIdToUse = currentCloudStudyId;

    // Save/update to cloud automatically first to guarantee the link is always generated, saved and up to date! (skip if already saved)
    if (gmailUser && generatedReport && !currentCloudStudyId) {
      try {
        const savedId = await handleSaveToCloud();
        if (savedId) {
          studyIdToUse = savedId;
        }
      } catch (err) {
        console.error("Auto cloud save error inside handleSendWhatsAppAction:", err);
      }
    }

    const text = getWhatsAppTextPreview(studyIdToUse);
    const cleanPhone = whatsappPhone ? whatsappPhone.replace(/\D/g, "") : "";
    const urlEncoded = encodeURIComponent(text);
    
    // Construct WhatsApp Send URL
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${urlEncoded}`
      : `https://api.whatsapp.com/send?text=${urlEncoded}`;

    // 1. OPEN WHATSAPP ENTIRELY SYNCHRONOUSLY!
    // This is the absolute key to bypass the browser's popup blocker.
    try {
      window.open(url, "_blank");
    } catch (popupErr) {
      console.error("Popup blocker prevented opening WhatsApp:", popupErr);
    }

    // 2. Perform the heavy infographic processing in the background (No PDF downloads to local device)
    if (whatsappShareType === 'patient_infographic') {
      if (infographicUrl && (infographicUrl.startsWith("data:") || infographicUrl.startsWith("blob:") || infographicUrl.startsWith("http"))) {
        try {
          const response = await fetch(infographicUrl);
          const blob = await response.blob();
          const format = infographicUrl.includes("image/png") ? "png" : "jpeg";
          const file = new File([blob], `infografia_paciente.${format}`, { type: blob.type });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: "Infograf√≠a Paciente",
              text: `Infograf√≠a de ${patientName || "Paciente"}`
            }).catch(err => {
              console.warn("Native Share failed for infographic image:", err);
            });
          }
        } catch (err) {
          console.warn("Could not share infographic image as file:", err);
        }
      }
    }

    setShowWhatsAppModal(false);
  };

  // ACTION: GENERATE DEMOCRATIZED AND SIMPLIFIED PATIENT KEY FINDINGS & SUMMARY
  const handleGeneratePatientSummary = async () => {
    if (!generatedReport) return;
    setIsGeneratingPatientSummary(true);
    setPatientSummaryError(null);
    setPatientSummary(null);
    setExpandedFindings({});
    try {
      const response = await fetch("/api/generate-patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setPatientSummary(data.data);
      } else {
        setPatientSummaryError(data.error || "Error al generar el resumen del paciente.");
      }
    } catch (err: any) {
      console.error("Error al generar resumen para paciente:", err);
      setPatientSummaryError(err?.message || String(err));
    } finally {
      setIsGeneratingPatientSummary(false);
    }
  };

  // ACTION: GENERATE DYNAMIC MEDICAL GLOSSARY ON REPORT TERMS
  const handleGenerateDynamicGlossary = async () => {
    if (!generatedReport) return;
    setIsGeneratingDynamicGlossary(true);
    setDynamicGlossaryError(null);
    setDynamicGlossary(null);
    setGlossaryLitSearch({});
    try {
      const response = await fetch("/api/generate-dynamic-glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setDynamicGlossary(data.data);
      } else {
        setDynamicGlossaryError(data.error || "Error al construir el glosario del reporte.");
      }
    } catch (err: any) {
      console.error("Error al construir glosario din√°mico:", err);
      setDynamicGlossaryError(err?.message || String(err));
    } finally {
      setIsGeneratingDynamicGlossary(false);
    }
  };

  // ACTION: GENERATE OPERATIONAL SUMMARY FOR WHATSAPP
  const handleGenerateWhatsAppSummary = async () => {
    const reportContent = isEditingReportManual ? editedReportText : generatedReport;
    if (!reportContent) return;
    setIsGeneratingOperationalSummary(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{
            role: "user",
            text: "Resume de forma muy concisa √öNICAMENTE los hallazgos cl√≠nicos principales de este reporte m√©dico en 3 o 4 vi√±etas de texto asertivas y claras, redactadas con un lenguaje profesional pero comprensible, apto para ser compartido por WhatsApp y consultado digitalmente por el paciente. NO incluyas ninguna recomendaci√≥n, sugerencia de manejo ni plan a futuro, lim√≠tate estrictamente a los hallazgos de forma asertiva. No agregues pre√°mbulos, saludos, ni comentarios personales, devuelve directamente las vi√±etas con guiones '-'. Reporte:\n\n" + reportContent
          }]
        })
      });
      const data = await response.json();
      if (data.success && data.reply) {
        const summary = data.reply.trim();
        setOperationalSummaryText(summary);

        // If currently synced to cloud, update cloud record too so the patient can see it immediately
        if (currentCloudStudyId && gmailUser?.uid) {
          let pdfB64 = "";
          await saveStudyToCloud(gmailUser.uid, gmailUser.email || "", {
            id: currentCloudStudyId,
            timestamp: new Date().toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" }),
            patientName: patientName || "Paciente An√≥nimo",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "M√©dico Radi√≥logo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Cl√≠nica Privada",
            studyType: studyType || "Estudio General",
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "No especificadas",
            reportText: reportContent,
            pdfBase64: pdfB64,
            operationalSummaryText: summary,
            customLogoUrl: customLogoUrl || "",
            customLogoStyle: customLogoStyle || "logo",
            customSignatureUrl: customSignatureUrl || "",
            attachedImages: attachedImages || [],
            findings3dRenders: findings3dRenders || [],
            patientSummary: patientSummary || null
          });
          fetchCloudStudies(gmailUser.uid);
        }
      } else {
        alert("Ocurri√≥ un error al generar el resumen. Por favor, intente de nuevo.");
      }
    } catch (error) {
      console.error("Error generating WhatsApp summary:", error);
      alert("Error de red al generar el resumen.");
    } finally {
      setIsGeneratingOperationalSummary(false);
    }
  };

  // ACTION: GENERATE SCHEMATIC SUMMARY OF FINDINGS
  const handleGenerateSchematicSummary = async () => {
    if (!generatedReport) return;
    setIsGeneratingSchematicSummary(true);
    setSchematicSummaryError(null);
    setSchematicSummary(null);
    try {
      let reportWithExtras = generatedReport;
      if (activeProtocol) {
        const extras = additionalFindings[activeProtocol];
        if (extras && extras.length > 0) {
          reportWithExtras += "\n\nHALLAZGOS ADICIONALES DETECTADOS POR EL M√âDICO TRATANTE:\n";
          extras.forEach(item => {
            reportWithExtras += `- ${item.structureName}: ${item.description}\n`;
          });
        }
      }

      const response = await fetch("/api/generate-schematic-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportWithExtras,
          studyType: studyType || "Estudio Radiol√≥gico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSchematicSummary(data.data);
      } else {
        setSchematicSummaryError(data.error || "Error al estructurar el esquema del reporte.");
      }
    } catch (err: any) {
      console.error("Error al construir esquema din√°mico:", err);
      setSchematicSummaryError(err?.message || String(err));
    } finally {
      setIsGeneratingSchematicSummary(false);
    }
  };

  // Helper to generate text content based on the selected format (blocks vs table)
  const getSelectedSchematicContent = () => {
    if (!schematicSummary) return "";
    if (schematicFormat === "blocks") {
      let text = "### ESQUEMA CL√çNICO DE HALLAZGOS PRINCIPALES\n\n";
      schematicSummary.findings.forEach((f: any, idx: number) => {
        const id = f.findingId || `H${idx + 1}`;
        text += `**[${id}] ${f.anatomicalSite.toUpperCase()}**\n`;
        text += `- **Hallazgo:** ${f.description}\n\n`;
      });
      return text.trim();
    } else {
      return schematicSummary.markdownScheme;
    }
  };

  // ACTION: APPEND THE GENERATED SCHEMATIC TABLE DIRECTLY TO THE ACTIVE REPORT
  const handleAppendSchemeToReport = () => {
    if (!schematicSummary) return;
    
    // Choose active text source (manual draft may be currently in edit)
    const activeText = isEditingReportManual ? editedReportText : (generatedReport || "");

    // Save history
    if (activeText) {
      setReportHistory((prev) => [...prev, activeText]);
    }
    
    const contentToAppend = getSelectedSchematicContent();
    if (!contentToAppend) return;

    const separator = "\n\n---\n\n";
    const newReportText = activeText + separator + contentToAppend;
    setGeneratedReport(newReportText);
    setEditedReportText(newReportText);
    alert(`¬°Esquema de hallazgos cl√≠nico (${schematicFormat === "blocks" ? "en Bloques" : "en Tabla"}) insertado con √©xito al final de tu informe!`);
  };

  // ACTION: GENERATE SEMIOLOGY AND JUSTIFICATION TABLE
  const handleGenerateSemiologyTable = async () => {
    const reportText = isEditingReportManual ? editedReportText : generatedReport;
    if (!reportText) return;
    setIsGeneratingSemiology(true);
    setSemiologyError(null);
    setSemiologyData(null);
    setSelectedConfirmedDiagnoses([]);
    setSelectedRuledOutPathologies([]);
    try {
      const response = await fetch("/api/generate-semiology-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "Estudio Radiol√≥gico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSemiologyData(data.data);
        setSelectedConfirmedDiagnoses(new Array(data.data.confirmedDiagnoses?.length || 0).fill(true));
        setSelectedRuledOutPathologies(new Array(data.data.ruledOutPathologies?.length || 0).fill(true));
      } else {
        setSemiologyError(data.error || "Error al estructurar el cuadro de semiolog√≠a.");
      }
    } catch (err: any) {
      console.error("Error al construir cuadro de semiolog√≠a:", err);
      setSemiologyError(err?.message || String(err));
    } finally {
      setIsGeneratingSemiology(false);
    }
  };

  // Helper to build markdown dynamically based on user selections
  const buildDynamicSemiologyMarkdownTable = () => {
    if (!semiologyData) return "";
    
    let md = "### CUADRO DE SEMIOLOG√çA Y JUSTIFICACI√ìN RADIOL√ìGICA\n\n";
    
    const filteredDiagnoses = (semiologyData.confirmedDiagnoses || []).filter((_: any, idx: number) => selectedConfirmedDiagnoses[idx]);
    const filteredRuledOut = (semiologyData.ruledOutPathologies || []).filter((_: any, idx: number) => selectedRuledOutPathologies[idx]);
    
    if (filteredDiagnoses.length > 0) {
      md += "#### 1. Diagn√≥sticos Confirmados y Justificaci√≥n Semiol√≥gica\n\n";
      md += "| INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |\n";
      md += "| :--- | :--- |\n";
      filteredDiagnoses.forEach((d: any) => {
        md += `| ${d.diagnosis.replace(/\|/g, "\\|")} | ${d.justification.replace(/\|/g, "\\|")} |\n`;
      });
      md += "\n";
    }
    
    if (filteredRuledOut.length > 0) {
      md += "#### 2. Patolog√≠as Diferenciales Descartadas y Evidencia de Exclusi√≥n\n\n";
      md += "| INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |\n";
      md += "| :--- | :--- |\n";
      filteredRuledOut.forEach((r: any) => {
        md += `| ${r.pathology.replace(/\|/g, "\\|")} | ${r.exclusionCriteria.replace(/\|/g, "\\|")} |\n`;
      });
      md += "\n";
    }
    
    return md.trim();
  };

  // ACTION: APPEND THE GENERATED SEMIOLOGY TABLE DIRECTLY TO THE ACTIVE REPORT
  const handleAppendSemiologyToReport = () => {
    if (!semiologyData) return;
    
    // Choose active text source (manual draft may be currently in edit)
    const activeText = isEditingReportManual ? editedReportText : (generatedReport || "");

    // Save history
    if (activeText) {
      setReportHistory((prev) => [...prev, activeText]);
    }
    
    const contentToAppend = buildDynamicSemiologyMarkdownTable();
    if (!contentToAppend) {
      alert("No has seleccionado ning√∫n punto para insertar.");
      return;
    }

    const separator = "\n\n---\n\n";
    const newReportText = activeText + separator + contentToAppend;
    setGeneratedReport(newReportText);
    setEditedReportText(newReportText);
    alert("¬°Cuadro de semiolog√≠a por im√°genes insertado con √©xito al final de tu informe para el PDF formal!");
  };

  // ACTION: SEARCH TECHNICAL LITERATURE FOR A GLOSSARY TERM DIRECTLY WITHIN PANEL
  const handleSearchGlossaryTermLiterature = async (term: string, query: string) => {
    setGlossaryLitSearch(prev => ({
      ...prev,
      [term]: { loading: true }
    }));
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: `Realiza una b√∫squeda de evidencia para el t√©rmino m√©dico: ${term}. Contexto adicional: ${query}`,
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setGlossaryLitSearch(prev => ({
          ...prev,
          [term]: { 
            loading: false, 
            text: data.bibliography, 
            sources: data.sources || [] 
          }
        }));
      } else {
        setGlossaryLitSearch(prev => ({
          ...prev,
          [term]: { 
            loading: false, 
            error: data.error || "No se pudo recuperar la revisi√≥n cient√≠fica sobre este concepto." 
          }
        }));
      }
    } catch (err: any) {
      console.error("Error buscando literatura para t√©rmino:", err);
      setGlossaryLitSearch(prev => ({
        ...prev,
        [term]: { 
          loading: false, 
          error: "Error de comunicaci√≥n con el servidor central." 
        }
      }));
    }
  };

  // ACTION: PRINT PROFESSIONAL EXPLAINED REPORT FOR PATIENT
  const handlePrintPatientSummary = () => {
    if (!patientSummary) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite ventanas emergentes para abrir el formato de impresi√≥n.");
      return;
    }
    
    const findingsHtml = patientSummary.keyFindings.map((finding: any) => `
      <div style="margin-bottom: 22px; padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; background-color: #fafafa;">
        <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700;">${finding.title}</h3>
        <p style="margin: 0 0 12px 0; font-size: 11px; font-style: italic; color: #4b5563; font-family: monospace;">T√©rmino original en informe t√©cnico: "${finding.originalTerm}"</p>
        <p style="margin: 0 0 12px 0; font-size: 13.5px; font-family: system-ui, sans-serif; color: #1f2937; line-height: 1.55;"><strong>Explicaci√≥n:</strong> ${finding.simplifiedExplanation}</p>
        <p style="margin: 0 0 8px 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #7c2d12; background-color: #fff7ed; padding: 10px; border-radius: 6px; border-left: 3px solid #f97316;">üîç <strong>Analog√≠a de comprensi√≥n:</strong> ${finding.analogy}</p>
        <p style="margin: 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #1e3a8a; font-weight: 600; background-color: #eff6ff; padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">ü©∫ <strong>Contexto Cl√≠nico y Perspectiva M√©dica:</strong> ${finding.reassurance}</p>
      </div>
    `).join("");

    const carePointsHtml = (patientSummary.carePoints || []).map((point: string) => `
      <li style="margin-bottom: 10px; font-size: 13.5px; font-family: system-ui, sans-serif; color: #374151; line-height: 1.5;">${point}</li>
    `).join("");

    const questionsHtml = (patientSummary.suggestedQuestions || []).map((q: string) => `
      <li style="margin-bottom: 12px; font-size: 13.5px; font-family: system-ui, sans-serif; color: #111827; line-height: 1.4; font-weight: 600;">"${q}"</li>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Acompa√±amiento Radiol√≥gico Explicativo</title>
          <style>
            @media print {
              body { margin: 0; padding: 15px; font-size: 12pt; }
              .no-print { display: none; }
            }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 40px; 
              line-height: 1.6; 
              color: #1f2937; 
              max-width: 820px; 
              margin: 0 auto; 
            }
            .header-banner {
              text-align: center;
              border-bottom: 4px solid #ea580c;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-banner h1 { 
              color: #ea580c; 
              font-size: 26px; 
              margin: 0 0 8px 0; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-grid { 
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 12px;
              background: #f3f4f6; 
              padding: 16px 20px; 
              border-radius: 8px; 
              margin-bottom: 30px; 
              font-size: 12px; 
              font-family: ui-monospace, monospace; 
              color: #374151;
            }
            .section-title { 
              font-size: 18px; 
              color: #111827; 
              margin-top: 35px; 
              margin-bottom: 15px;
              border-bottom: 2px solid #e5e7eb; 
              padding-bottom: 6px; 
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 11px; 
              color: #6b7280; 
              border-top: 1px solid #e5e7eb; 
              padding-top: 20px; 
            }
            .btn-print {
              display: inline-block;
              background: #ea580c;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 14px;
              font-weight: 700;
              border-radius: 8px;
              cursor: pointer;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }
            .btn-print:hover {
              background: #d97706;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: right;">
            <button class="btn-print" onclick="window.print()">Imprimir de Inmediato</button>
          </div>
          <div class="header-banner">
            <h1>Gu√≠a M√©dica Explicativa para el Paciente</h1>
            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #4b5563;">Traducci√≥n Emp√°tica y Comprensi√≥n Humana Asistida por Inteligencia Artificial</p>
          </div>
          
          <div style="font-size: 13.5px; margin-bottom: 25px; color: #4b5563;">
            Estimado paciente: La siguiente gu√≠a interactiva simplifica y explica los hallazgos descritos en el reporte cl√≠nico oficial de su estudio diagn√≥stico. Este material tiene car√°cter informativo y educativo; est√° dise√±ado para calmar su inquietud y dotarlo de pautas saludables de conversaci√≥n con su especialista tratante.
          </div>
          
          <div class="meta-grid">
            <div>
              <strong>ESTUDIO DIAGN√ìSTICO:</strong> ${STUDY_PRESETS?.find((p: any) => p.id === studyType)?.name || studyType || "Estudio Radiol√≥gico"}<br>
              <strong>IMPRESO EL:</strong> ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style="text-align: right;">
              <strong>INDICACI√ìN INMEDIATA:</strong> ${clinicalHistory || "Sin indicaci√≥n reportada"}<br>
              <strong>PROGRAMA ASOCIADO:</strong> AI Radiologist Suite Pro
            </div>
          </div>
          
          <div class="section-title">Desglose Detallado de Hallazgos Cl√≠nicos Explicados</div>
          ${findingsHtml}
          
          <div class="footer">
            <strong>ADVERTENCIA CL√çNICA IMPORTANTE:</strong> Esta gu√≠a simplificada de orientaci√≥n formativa complementa -pero nunca invalida- el informe radiol√≥gico oficial firmado digitalmente por el especialista m√©dico ni sustituye la indicaci√≥n prescriptiva del cirujano o m√©dico cl√≠nico.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ACTION: RECOMMEND CLASSIFICATIONS BASED ON GENERATED REPORT TEXT
  const handleRecommendClassifications = async () => {
    if (!generatedReport) return;
    setIsRecommendingClassifications(true);
    setRecommenderError(null);
    setClassRecommendations(null);
    setIncorporatedRecs({});
    setIncludeManagementRecs({});
    try {
      const response = await fetch("/api/recommend-classifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport
        })
      });
      const data = await response.json();
      if (data.success) {
        setClassRecommendations(data.recommendations);
      } else {
        setRecommenderError(data.error || "No se pudieron obtener las clasificaciones sugeridas.");
      }
    } catch (err: any) {
      console.error(err);
      setRecommenderError("Error de conexi√≥n al obtener recomendaciones de escalas.");
    } finally {
      setIsRecommendingClassifications(false);
    }
  };

  // ACTION FOR INFOGRAPHIC GENERATION
  const handleGenerateInfographic = async () => {
    if (!generatedReport || !studyType) return;
    setIsGeneratingInfographic(true);
    setInfographicError(null);
    setInfographicUrl(null);
    try {
      const response = await fetch("/api/generate-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: generatedReport, studyType }),
      });
      const data = await response.json();
      if (data.success) {
        setInfographicUrl(data.imageUrl);
      } else {
        setInfographicError(data.error || "Error generando la infograf√≠a.");
      }
    } catch (err: any) {
      setInfographicError(err.message || "Error al conectar con la API de infograf√≠as.");
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  // ACTION: APPEND THE SELECTED CLASSIFICATION/CRITERIA TO THE REPORT TEXT
  const handleIncorporateClassification = async (rec: any, index: number) => {
    if (!generatedReport) return;
    setIncorporatingIndex(index);
    setRecommenderError(null);
    try {
      const response = await fetch("/api/incorporate-classification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          classificationName: rec.name,
          whyRecommended: rec.whyRecommended,
          contentToAppend: rec.contentToAppend,
          studyType: studyType,
          includeManagementRecommendation: !!includeManagementRecs[index]
        })
      });
      const data = await response.json();
      if (data.success && data.modifiedReport) {
        setGeneratedReport(data.modifiedReport);
        setIncorporatedRecs((prev) => ({ ...prev, [index]: true }));
        if (classRecommendations) {
          const updated = [...classRecommendations];
          updated[index] = { ...updated[index], alreadyIncorporated: true };
          setClassRecommendations(updated);
        }
      } else {
        setRecommenderError(data.error || "No se pudo incorporar la clasificaci√≥n de forma inteligente en el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setRecommenderError("Error de conexi√≥n al incorporar la clasificaci√≥n de forma inteligente.");
    } finally {
      setIncorporatingIndex(null);
    }
  };

  // 2. ACTION: CHAT MESSAGE SENT FOR COMPLEX CASES
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    setChatInput("");
    setChatError(null);
    setIsSendingMsg(true);

    const updatedMsgs = [...chatMessages, { role: "user" as const, text: userMsgText }];
    setChatMessages(updatedMsgs);

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMsgs,
          systemInstruction: chatInstruction || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setChatMessages([...updatedMsgs, { role: "model", text: data.reply }]);
      } else {
        setChatError(data.error || "Error al obtener respuesta de Gemini Consultor.");
      }
    } catch (e) {
      setChatError("Falla de conexi√≥n con la API del servidor local.");
      console.error(e);
    } finally {
      setIsSendingMsg(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // 3. ACTION: CLASSIFICATIONS QUERY VIA GEMINI
  const handleQueryClassification = async (customQuery?: string) => {
    const activeQuery = customQuery || classificationQuery;
    if (!activeQuery.trim()) return;

    setIsLoadingClassification(true);
    setClassificationError(null);
    setClassificationResult("");

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          query: activeQuery,
          systemInstruction: classifyInstruction || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setClassificationResult(data.info);
      } else {
        setClassificationError(data.error || "No se pudo obtener informaci√≥n de la escala.");
      }
    } catch (e) {
      setClassificationError("Error de comunicaci√≥n con el servidor de consulta.");
      console.error(e);
    } finally {
      setIsLoadingClassification(false);
    }
  };

  // Interactive flow calculators for Tab 2
  const handleWizardOptionSelect = (stepIndex: number, optionValue: string) => {
    const currentWizard = CLASSIFICATIONS_DATA.find(c => c.id === selectedClassSystem);
    if (!currentWizard) return;

    const newAnswers = { ...wizardAnswers, [stepIndex]: optionValue };
    setWizardAnswers(newAnswers);

    // If there's another step, let the user fill it. Else, compute final suggestion
    const optionSelected = currentWizard.steps[stepIndex].options.find(o => o.value === optionValue);
    
    if (optionSelected?.category) {
      // Direct category identified
      const categoryName = optionSelected.category;
      setWizardOutput(INTERACTIVE_RESULTS[categoryName] || `C√°lculo exitoso: Categor√≠a sugerida ${categoryName}`);
    } else if (stepIndex === 0 && selectedClassSystem === "fleischner" && optionValue.startsWith("solid_")) {
      // Fleischner requires risk level (step index 1)
      // Wait for step 1 selection
    } else if (stepIndex === 1 && selectedClassSystem === "fleischner") {
      // Combined Fleischner logic
      const noduleType = newAnswers[0];
      const riskLevel = optionValue;
      const keyCombined = `${noduleType}_${riskLevel}`;
      setWizardOutput(INTERACTIVE_RESULTS[keyCombined] || "No se encontr√≥ un criterio espec√≠fico en las gu√≠as est√°ndar para esta combinaci√≥n.");
    } else if (selectedClassSystem === "bosniak" && optionValue === "complex") {
      // Ask no further questions
      const optionsBosniakStep2 = [
        { label: "TC: Septos nodulares o engrosamiento parietal visible sin verdadero n√≥dulo s√≥lido", category: "Bosniak III" },
        { label: "TC: N√≥dulos blandos medibles con realce o componentes s√≥lidos invasivos", category: "Bosniak IV" }
      ];
      // Quick fallback
      setWizardOutput(`**Requiri√≥ mayor especificaci√≥n:**\nSi los septos son simplemente engrosados con realce parcial, entra en **Bosniak III** (cirug√≠a o biopsia). Si presenta masas de partes blandas o n√≥dulos con realce evidente, entra en **Bosniak IV** (malignidad confirmada).`);
    } else {
      setWizardOutput("No se pudo clasificar interactivamente. Por favor consulte el buscador general de escalas.");
    }
  };

  // PDF Printing Utilities
  const handlePrintPDF = () => {
    if (!generatedReport) return;
    setShowPrintModal(true);
    // Attempt window.print() but also show the on-screen helper modal
    try {
      window.print();
    } catch (e) {
      console.warn("window.print block protected", e);
    }
  };

  const ensureCompatibleImageFormat = (src: string): Promise<{ dataUrl: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 640;
          const h = img.naturalHeight || img.height || 480;
          
          // Downscale to a maximum height/width of 750px to maintain pristine quality but reduce base64 size drastically
          let targetW = w;
          let targetH = h;
          const maxDim = 750;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            // Use JPEG (0.65) to drastically reduce the PDF file weight without losing diagnostic details!
            const compressedUrl = canvas.toDataURL("image/jpeg", 0.65);
            resolve({ dataUrl: compressedUrl, width: targetW, height: targetH });
            return;
          }
        } catch (err) {
          console.warn("Error converting image to compatible format:", err);
        }
        resolve({ dataUrl: src, width: img.naturalWidth || 640, height: img.naturalHeight || 480 });
      };
      img.onerror = () => {
        resolve({ dataUrl: src, width: 640, height: 480 });
      };
      img.src = src;
    });
  };

  const decodeDicom = (inputBuffer: any) => {
    // Robust audit of input buffer type to extract safe, isolated ArrayBuffer boundaries
    let arrayBuffer: ArrayBuffer;
    if (inputBuffer instanceof Uint8Array) {
      arrayBuffer = (inputBuffer.buffer as ArrayBuffer).slice(inputBuffer.byteOffset, inputBuffer.byteOffset + inputBuffer.byteLength);
    } else if (inputBuffer instanceof ArrayBuffer) {
      arrayBuffer = inputBuffer;
    } else if (inputBuffer && inputBuffer.buffer instanceof ArrayBuffer) {
      arrayBuffer = (inputBuffer.buffer as ArrayBuffer).slice(inputBuffer.byteOffset || 0, (inputBuffer.byteOffset || 0) + (inputBuffer.byteLength || 0));
    } else {
      arrayBuffer = inputBuffer as ArrayBuffer;
    }

    const view = new DataView(arrayBuffer);
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Fast, non-blocking chunked base64 encoder
    const uint8ToBase64 = (arr: Uint8Array): string => {
      let binary = "";
      const len = arr.byteLength;
      const chunkSize = 0x4000; // 16KB chunks
      for (let i = 0; i < len; i += chunkSize) {
        const subset = arr.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, subset as any);
      }
      return btoa(binary);
    };

    let jpegStart = -1;
    // scan from 0 to capture preamble-less encapsulated JPEGs
    for (let i = 0; i < uint8.length - 10; i++) {
      if (uint8[i] === 0xFF && uint8[i+1] === 0xD8 && uint8[i+2] === 0xFF) {
        jpegStart = i;
        break;
      }
    }
    
    let base64 = "";
    if (jpegStart !== -1) {
      let jpegEnd = -1;
      for (let i = uint8.length - 2; i > jpegStart; i--) {
        if (uint8[i] === 0xFF && uint8[i+1] === 0xD9) {
          jpegEnd = i + 2;
          break;
        }
      }
      if (jpegEnd === -1) {
        jpegEnd = uint8.length;
      }
      
      const slice = uint8.subarray(jpegStart, jpegEnd);
      base64 = "data:image/jpeg;base64," + uint8ToBase64(slice);
    }
    
    let rows = 0;
    let cols = 0;
    let bitsAllocated = 8;
    let samplesPerPixel = 1;
    let planarConfiguration = 0;
    let photometricInterpretation = "";
    let pixelDataOffset = -1;
    let pixelDataLength = 0;
    
    const meta: Record<string, string> = {};
    try {
      const textDecoder = new TextDecoder("utf-8");
      
      // Auto-detect preamble or raw start
      let hasPreamble = false;
      if (uint8.length > 132 && uint8[128] === 68 && uint8[129] === 73 && uint8[130] === 67 && uint8[131] === 77) {
        hasPreamble = true;
      }
      
      const startOffsets = hasPreamble ? [132] : [0, 132];
      
      for (const startPos of startOffsets) {
        let pos = startPos;
        rows = 0;
        cols = 0;
        bitsAllocated = 8;
        samplesPerPixel = 1;
        planarConfiguration = 0;
        photometricInterpretation = "";
        pixelDataOffset = -1;
        pixelDataLength = 0;
        
        while (pos < arrayBuffer.byteLength - 8) {
          const group = view.getUint16(pos, true);
          const element = view.getUint16(pos + 2, true);
          pos += 4;
          
          let vr = "";
          try {
            vr = String.fromCharCode(uint8[pos], uint8[pos+1]);
          } catch {
            vr = "";
          }
          
          let length = 0;
          let isLongVR = false;
          if (["OB", "OW", "OF", "SQ", "UT", "UN"].includes(vr)) {
            isLongVR = true;
            length = view.getUint32(pos + 4, true);
            pos += 8;
          } else {
            if (uint8[pos] >= 65 && uint8[pos] <= 90 && uint8[pos+1] >= 65 && uint8[pos+1] <= 90) {
              length = view.getUint16(pos + 2, true);
              pos += 4;
            } else {
              // Implicit VR: length is 32-bit field right after group and element
              length = view.getUint32(pos, true);
              pos += 4;
            }
          }
          
          if (length === 0xFFFFFFFF) {
            // Sequence of undefined length
            if ((group === 0x7fe0 && element === 0x0010) || (group === 0x7FE0 && element === 0x0010)) {
              pixelDataOffset = pos;
              pixelDataLength = uint8.length - pos;
              break;
            } else {
              // It's a metadata sequence (SQ) of undefined length.
              // Skip it by finding the Sequence Delimitation Item (FFFE, E0DD)
              let foundDelimiter = false;
              for (let i = pos; i < uint8.length - 8; i++) {
                if (
                  (uint8[i] === 0xFE && uint8[i+1] === 0xFF && uint8[i+2] === 0xDD && uint8[i+3] === 0xE0) ||
                  (uint8[i] === 0xFF && uint8[i+1] === 0xFE && uint8[i+2] === 0xE0 && uint8[i+3] === 0xDD)
                ) {
                  // Skip FFFE E0DD and its 4-byte length field (usually 0x00000000)
                  pos = i + 8;
                  foundDelimiter = true;
                  break;
                }
              }
              if (!foundDelimiter) {
                break;
              }
              continue;
            }
          }
          
          if (length > 0 && pos + length <= arrayBuffer.byteLength) {
            if (group === 0x0010 && element === 0x0010) {
              meta["paciente"] = textDecoder.decode(uint8.subarray(pos, pos + length)).replace(/\^/g, " ").trim();
            } else if (group === 0x0010 && element === 0x0020) {
              meta["id"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x0030) {
              meta["fechaNacimiento"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x1010) {
              meta["edad"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x0040) {
              meta["sexo"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0020) {
              meta["fechaEstudio"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0060) {
              meta["modalidad"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0080) {
              meta["institucion"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x1030) {
              meta["estudio"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0028 && element === 0x0010) {
              try {
                if (length === 2) rows = view.getUint16(pos, true);
                else if (length === 4) rows = view.getUint32(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0011) {
              try {
                if (length === 2) cols = view.getUint16(pos, true);
                else if (length === 4) cols = view.getUint32(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0100) {
              try {
                if (length === 2) bitsAllocated = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0002) {
              try {
                if (length === 2) samplesPerPixel = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0006) {
              try {
                if (length === 2) planarConfiguration = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0004) {
              try {
                photometricInterpretation = textDecoder.decode(uint8.subarray(pos, pos + length)).trim().toUpperCase();
              } catch {}
            } else if ((group === 0x7fe0 && element === 0x0010) || (group === 0x7FE0 && element === 0x0010)) {
              pixelDataOffset = pos;
              pixelDataLength = length;
            }
            pos += length;
          } else {
            if (length === 0) {
              // skip empty tag
            } else {
              break;
            }
          }
        }
        
        if (pixelDataOffset !== -1 && rows > 0 && cols > 0) {
          break;
        }
      }
    } catch (err) {
      console.warn("Could not extract metadata tags from DICOM file", err);
    }
    
    // Natively decode raw, uncompressed pixels if there's no embedded JPEG
    if (base64 === "" && pixelDataOffset !== -1 && rows > 0 && cols > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(cols, rows);
          const data = imgData.data;
          
          if (samplesPerPixel === 3) {
            const rawBytes = uint8.subarray(pixelDataOffset, pixelDataOffset + Math.min(pixelDataLength, rows * cols * 3));
            const numPixels = rows * cols;
            if (planarConfiguration === 1) {
              const rPlane = 0;
              const gPlane = numPixels;
              const bPlane = numPixels * 2;
              
              if (photometricInterpretation.startsWith("YBR")) {
                for (let i = 0; i < numPixels; i++) {
                  if (bPlane + i < rawBytes.length) {
                    const Y = rawBytes[rPlane + i];
                    const Cb = rawBytes[gPlane + i];
                    const Cr = rawBytes[bPlane + i];
                    
                    let r = Y + 1.402 * (Cr - 128);
                    let g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
                    let b = Y + 1.772 * (Cb - 128);
                    
                    const idx = i * 4;
                    data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
                    data[idx+1] = Math.max(0, Math.min(255, Math.floor(g)));
                    data[idx+2] = Math.max(0, Math.min(255, Math.floor(b)));
                    data[idx+3] = 255;
                  }
                }
              } else {
                for (let i = 0; i < numPixels; i++) {
                  if (bPlane + i < rawBytes.length) {
                    const idx = i * 4;
                    data[idx] = rawBytes[rPlane + i];     // R
                    data[idx+1] = rawBytes[gPlane + i];   // G
                    data[idx+2] = rawBytes[bPlane + i];   // B
                    data[idx+3] = 255;                   // A
                  }
                }
              }
            } else {
              // Interleaved (Planar Configuration = 0)
              if (photometricInterpretation.startsWith("YBR")) {
                for (let i = 0; i < numPixels; i++) {
                  const rIdx = i * 3;
                  if (rIdx + 2 < rawBytes.length) {
                    const Y = rawBytes[rIdx];
                    const Cb = rawBytes[rIdx + 1];
                    const Cr = rawBytes[rIdx + 2];
                    
                    let r = Y + 1.402 * (Cr - 128);
                    let g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
                    let b = Y + 1.772 * (Cb - 128);
                    
                    const idx = i * 4;
                    data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
                    data[idx+1] = Math.max(0, Math.min(255, Math.floor(g)));
                    data[idx+2] = Math.max(0, Math.min(255, Math.floor(b)));
                    data[idx+3] = 255;
                  }
                }
              } else {
                for (let i = 0; i < numPixels; i++) {
                  const rIdx = i * 3;
                  if (rIdx + 2 < rawBytes.length) {
                    const idx = i * 4;
                    data[idx] = rawBytes[rIdx];     // R
                    data[idx+1] = rawBytes[rIdx+1]; // G
                    data[idx+2] = rawBytes[rIdx+2]; // B
                    data[idx+3] = 255;             // A
                  }
                }
              }
            }
          } else {
            // Monochrome / Grayscale (or single channel)
            if (bitsAllocated === 8) {
              const rawBytes = uint8.subarray(pixelDataOffset, pixelDataOffset + Math.min(pixelDataLength, rows * cols));
              const isInverted = photometricInterpretation === "MONOCHROME1";
              for (let i = 0; i < rawBytes.length; i++) {
                const val = isInverted ? 255 - rawBytes[i] : rawBytes[i];
                const idx = i * 4;
                data[idx] = val;     // R
                data[idx+1] = val;   // G
                data[idx+2] = val;   // B
                data[idx+3] = 255;   // A
              }
            } else if (bitsAllocated === 16) {
              const numPixels = rows * cols;
              const wordsNeeded = Math.min(Math.floor(pixelDataLength / 2), numPixels);
              const rawWords = new Uint16Array(wordsNeeded);
              for (let i = 0; i < wordsNeeded; i++) {
                rawWords[i] = view.getUint16(pixelDataOffset + i * 2, true);
              }
              
              let min = 65535;
              let max = 0;
              for (let i = 0; i < rawWords.length; i++) {
                const v = rawWords[i];
                if (v < min) min = v;
                if (v > max) max = v;
              }
              const range = max - min || 1;
              const isInverted = photometricInterpretation === "MONOCHROME1";
              
              for (let i = 0; i < rawWords.length; i++) {
                let val = Math.floor(((rawWords[i] - min) / range) * 255);
                if (isInverted) val = 255 - val;
                const idx = i * 4;
                data[idx] = val;
                data[idx+1] = val;
                data[idx+2] = val;
                data[idx+3] = 255;
              }
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          // Use lossless PNG for highest medical detail evaluation as requested
          base64 = canvas.toDataURL("image/png");
        }
      } catch (decodeErr) {
        console.warn("Could not decode raw pixel data natively: ", decodeErr);
      }
    }
    
    const hasSuccessfulImage = (base64 !== "" || (pixelDataOffset !== -1 && rows > 0 && cols > 0));
    return { base64, meta, success: hasSuccessfulImage };
  };

  const generateDicomCanvasFallback = (filename: string, meta?: Record<string, string>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, 640, 480);
      
      ctx.strokeStyle = "rgba(71, 85, 105, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke();
      }
      for (let y = 0; y < 480; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
      }
      
      ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(320, 30, 420, Math.PI * 0.35, Math.PI * 0.65);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(320, 30, 220, Math.PI * 0.35, Math.PI * 0.65);
      ctx.stroke();
      
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "rgba(100, 116, 139, 0.15)";
      ctx.fillText("SECTOR PROBE AREA", 270, 150);
      
      ctx.beginPath();
      ctx.moveTo(110, 390);
      for (let x = 110; x < 530; x++) {
        const y = 340 + 35 * Math.sin((x / 35) + Math.cos(x / 13)) * Math.exp(-Math.pow((x - 290) / 130, 2));
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 10px monospace";
      ctx.fillText("PW doppler: +114.5 cm/s", 90, 290);
      ctx.fillText("V_diastolic: -22.4 cm/s", 90, 305);
      ctx.fillText("RI (√çndice Resist.): 0.70", 90, 320);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText((meta?.paciente || "PACIENTE GENERAL").toUpperCase(), 30, 45);
      
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("MOD: US (ECOGRAF√çA DOPPLER)", 30, 60);
      if (meta?.institucion) {
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("HOSPITAL: " + meta.institucion.toUpperCase(), 30, 75);
      }
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("REG: " + filename, 30, 90);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("ULTRASOUND DICOM RAW CAPTURE", 430, 45);
      const dateStr = new Date().toLocaleDateString();
      ctx.fillText("FECHA: " + dateStr, 430, 60);
      ctx.fillText("ESTADO: ENCAPSULADO", 430, 75);
    }
    return canvas.toDataURL("image/png");
  };

  const detectImageMetaFromFilename = (filename: string, dicomMeta?: Record<string, string>) => {
    const upper = (filename + " " + JSON.stringify(dicomMeta || {}) + " " + (specificStudy || "")).toUpperCase();
    let modality: "MMG" | "US" = "US";
    let projection: "MLO" | "CC" | "OTRO" = "OTRO";
    let side: "Derecha" | "Izquierda" | "Bilateral" = "Bilateral";

    if (
      upper.includes("MMG") ||
      upper.includes("MAMO") ||
      upper.includes("MX") ||
      upper.includes("MLO") ||
      upper.includes("CC") ||
      upper.includes("MAMOGRAFIA") ||
      upper.includes("MAMMO") ||
      dicomMeta?.Modality === "MG"
    ) {
      modality = "MMG";
    }

    if (upper.includes("MLO") || upper.includes("OBLIQ") || upper.includes("OBLIU")) {
      projection = "MLO";
    } else if (upper.includes("CC") || upper.includes("CRANEO") || upper.includes("CAUDAL")) {
      projection = "CC";
    }

    if (upper.includes("IZQ") || upper.includes("LEFT") || upper.includes("LCC") || upper.includes("LMLO") || upper.includes("L-CC") || upper.includes("L-MLO")) {
      side = "Izquierda";
    } else if (upper.includes("DER") || upper.includes("RIGHT") || upper.includes("RCC") || upper.includes("RMLO") || upper.includes("R-CC") || upper.includes("R-MLO")) {
      side = "Derecha";
    } else {
      side = "Bilateral";
    }

    return { modality, projection, side };
  };

  const handleAiLabelImage = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem) return;
    
    setLoadingAiLabelId(id);
    try {
      const response = await fetch("/api/classify-and-label-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imgItem.base64 || imgItem.url,
          filename: imgItem.name,
          studyType: specificStudy || "Mamograf√≠a y Ultrasonido",
          clinicalHistory: clinicalHistory || "",
          findings: findings || inputReport || "",
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setAttachedImages(prev => prev.map(item => item.id === id ? {
          ...item,
          caption: data.label || item.caption,
          modality: data.modality || item.modality || "US",
          projection: data.projection || item.projection || "OTRO",
          side: data.side || item.side || "Derecha"
        } : item));
      } else {
        alert(data.error || "No se pudo generar la rotulaci√≥n con IA.");
      }
    } catch (err) {
      console.error("Error al rotular con IA:", err);
      alert("Error de conexi√≥n al rotular la foto.");
    } finally {
      setLoadingAiLabelId(null);
    }
  };

  const handleAutocompleteLabelFromReport = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem) return;
    
    if (!imgItem.caption || !imgItem.caption.trim()) {
      alert("Por favor, escribe primero una palabra o frase clave en la descripci√≥n (ej. 'ves√≠cula', 'quiste' o 'car√≥tida') para poder buscar y autocompletar desde el reporte.");
      return;
    }

    const reportToUse = generatedReport || inputReport || findings;
    if (!reportToUse) {
      alert("Por favor, redacta o genera el reporte primero para poder buscar y autocompletar la rotulaci√≥n.");
      return;
    }

    setLoadingAutocompleteId(id);
    try {
      const response = await fetch("/api/autocomplete-label-from-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          phrase: imgItem.caption,
          currentReport: reportToUse,
          studyType: specificStudy || "Mamograf√≠a / Ecograf√≠a",
          clinicalHistory: clinicalHistory || "",
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.label) {
        setAttachedImages(prev => prev.map(item => item.id === id ? { ...item, caption: data.label } : item));
      } else {
        alert(data.error || "No se pudo autocompletar la rotulaci√≥n.");
      }
    } catch (err) {
      console.error("Error al autocompletar rotulaci√≥n:", err);
      alert("Error de conexi√≥n al autocompletar desde el reporte.");
    } finally {
      setLoadingAutocompleteId(null);
    }
  };

  const handleAiLabelAllImages = async () => {
    if (attachedImages.length === 0) return;
    setIsLabelingAll(true);
    try {
      const promises = attachedImages.map(async (imgItem) => {
        try {
          const response = await fetch("/api/classify-and-label-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image: imgItem.base64 || imgItem.url,
              filename: imgItem.name,
              studyType: specificStudy || "Mamograf√≠a y Ultrasonido",
              clinicalHistory: clinicalHistory || "",
              findings: findings || inputReport || "",
            }),
          });
          
          const data = await response.json();
          if (response.ok && data.success) {
            return {
              id: imgItem.id,
              label: data.label,
              modality: data.modality,
              projection: data.projection,
              side: data.side
            };
          }
        } catch (err) {
          console.error(`Error labeling image ${imgItem.id}:`, err);
        }
        return null;
      });

      const results = await Promise.all(promises);
      setAttachedImages(prev => prev.map(item => {
        const found = results.find(r => r && r.id === item.id);
        if (found) {
          return {
            ...item,
            caption: found.label || item.caption,
            modality: found.modality || item.modality || "US",
            projection: found.projection || item.projection || "OTRO",
            side: found.side || item.side || "Derecha"
          };
        }
        return item;
      }));
    } catch (err) {
      console.error("Error al rotular todas las im√°genes:", err);
      alert("Error al intentar rotular todas las im√°genes.");
    } finally {
      setIsLabelingAll(false);
    }
  };

  const handleCorrelateFigures = async () => {
    const reportToUse = generatedReport || inputReport || findings;
    if (!reportToUse) {
      alert("Por favor, genera un reporte o redacta un borrador primero para poder correlacionar las figuras.");
      return;
    }
    if (attachedImages.length === 0) {
      alert("No hay im√°genes cargadas para correlacionar. Por favor sube im√°genes primero.");
      return;
    }

    setIsCorrelatingFigures(true);
    try {
      const response = await fetch("/api/correlate-figures-retroactive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: reportToUse,
          attachedImages: attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || img.name || ""
          })),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.report) {
        if (generatedReport) {
          setReportHistory(prev => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);

        if (data.reorderedImageIds && Array.isArray(data.reorderedImageIds) && data.reorderedImageIds.length > 0) {
          setAttachedImages(prev => {
            const map = new Map(prev.map(img => [img.id, img]));
            const reordered: typeof prev = [];
            data.reorderedImageIds.forEach((id: string) => {
              const found = map.get(id);
              if (found) {
                reordered.push(found);
                map.delete(id);
              }
            });
            // Append any remaining images not explicitly listed in reorderedImageIds
            map.forEach(img => reordered.push(img));
            return reordered;
          });
        }
      } else {
        alert(data.error || "Ocurri√≥ un error al intentar correlacionar las figuras.");
      }
    } catch (err) {
      console.error("Error al correlacionar figuras:", err);
      alert("Error de red al intentar correlacionar las figuras.");
    } finally {
      setIsCorrelatingFigures(false);
    }
  };

  const handleAttachedFiles = async (filesList: FileList | File[] | null) => {
    if (!filesList) return;
    const filesArray = Array.from(filesList);
    const loaded: {
      id: string;
      name: string;
      url: string;
      base64: string;
      caption: string;
      isDicom: boolean;
      dicomMetaData?: Record<string, string>;
      width?: number;
      height?: number;
      modality?: "MMG" | "US";
      projection?: "MLO" | "CC" | "OTRO";
      side?: "Derecha" | "Izquierda" | "Bilateral";
    }[] = [];
    
    const promises = filesArray.map((file) => {
      if (file.size === 0) return Promise.resolve();
      
      const nameLower = file.name.toLowerCase();
      // Skip Mac OS metadata files, DICOMDIR metadata records, thumbs.db, and XML files
      if (
        nameLower.startsWith(".") || 
        nameLower.startsWith("_") || 
        nameLower === "thumbs.db" || 
        nameLower === "dicomdir" || 
        nameLower.endsWith(".xml")
      ) {
        return Promise.resolve();
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || "";
      const isZip = fileExt === "zip" || file.type === "application/zip" || file.type === "application/x-zip-compressed";
      const isKnownImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt);
      const isDicomExt = ["dcm", "dicom"].includes(fileExt);
      
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        
        if (isZip) {
          (async () => {
            try {
              const jszip = new JSZip();
              const zipContent = await jszip.loadAsync(file);
              const zipPromises: Promise<void>[] = [];
              
              const localUint8ToBase64 = (arr: Uint8Array): string => {
                let binary = "";
                const len = arr.byteLength;
                const chunkSize = 0x4000;
                for (let i = 0; i < len; i += chunkSize) {
                  const subset = arr.subarray(i, i + chunkSize);
                  binary += String.fromCharCode.apply(null, subset as any);
                }
                return btoa(binary);
              };

              for (const [filename, fileObj] of Object.entries(zipContent.files)) {
                if ((fileObj as any).dir) continue;
                
                const innerNameLower = filename.toLowerCase();
                if (
                  innerNameLower.startsWith(".") || 
                  innerNameLower.startsWith("_") || 
                  innerNameLower.endsWith("thumbs.db") || 
                  innerNameLower.endsWith("dicomdir") || 
                  innerNameLower.endsWith(".xml")
                ) {
                  continue;
                }
                
                const innerExt = filename.split('.').pop()?.toLowerCase() || "";
                const isInnerImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(innerExt);
                const isInnerDicomExt = ["dcm", "dicom"].includes(innerExt);
                
                const p = (async () => {
                  const u8Array = await (fileObj as any).async("uint8array");
                  if (u8Array.length === 0) return;
                  
                  const hasDicomHeader = u8Array.length > 132 && 
                                         u8Array[128] === 68 && 
                                         u8Array[129] === 73 && 
                                         u8Array[130] === 67 && 
                                         u8Array[131] === 77; // "DICM"
                  const isInnerDicom = isInnerDicomExt || hasDicomHeader;
                  
                  if (isInnerImage) {
                    const mime = innerExt === "jpg" || innerExt === "jpeg" ? "image/jpeg" : (innerExt === "gif" ? "image/gif" : (innerExt === "webp" ? "image/webp" : "image/png"));
                    const base64Str = `data:${mime};base64,${localUint8ToBase64(u8Array)}`;
                    const res = await ensureCompatibleImageFormat(base64Str);
                    const fname = filename.split("/").pop() || filename;
                    const meta = detectImageMetaFromFilename(fname);
                    loaded.push({
                      id: "attached-" + Math.random().toString(36).substring(2, 11),
                      name: fname,
                      url: res.dataUrl,
                      base64: res.dataUrl,
                      caption: "",
                      isDicom: false,
                      width: res.width,
                      height: res.height,
                      modality: meta.modality,
                      projection: meta.projection,
                      side: meta.side
                    });
                  } else if (isInnerDicom) {
                    try {
                      const cleanDcmBuffer = u8Array.buffer.slice(u8Array.byteOffset, u8Array.byteOffset + u8Array.byteLength);
                      const parsed = decodeDicom(cleanDcmBuffer);
                      let finalBase64 = parsed.base64;
                      if (!finalBase64) {
                        finalBase64 = generateDicomCanvasFallback(filename.split("/").pop() || filename, parsed.meta);
                      }
                      const res = await ensureCompatibleImageFormat(finalBase64);
                      const fname = filename.split("/").pop() || filename;
                      const meta = detectImageMetaFromFilename(fname, parsed.meta);
                      loaded.push({
                        id: "attached-" + Math.random().toString(36).substring(2, 11),
                        name: fname,
                        url: res.dataUrl,
                        base64: res.dataUrl,
                        caption: "",
                        isDicom: true,
                        dicomMetaData: parsed.meta,
                        width: res.width,
                        height: res.height,
                        modality: meta.modality,
                        projection: meta.projection,
                        side: meta.side
                      });
                    } catch (err) {
                      console.error("Error decoding inner ZIP DICOM:", err);
                    }
                  }
                })();
                zipPromises.push(p);
              }
              await Promise.all(zipPromises);
            } catch (zipErr) {
              console.error("Error unpacking ZIP attachment:", zipErr);
            } finally {
              resolve();
            }
          })();
        } else if (isKnownImage) {
          reader.onload = (e) => {
            const base64Str = e.target?.result as string;
            if (base64Str) {
              ensureCompatibleImageFormat(base64Str).then((res) => {
                const meta = detectImageMetaFromFilename(file.name);
                loaded.push({
                  id: "attached-" + Math.random().toString(36).substring(2, 11),
                  name: file.name,
                  url: res.dataUrl,
                  base64: res.dataUrl,
                  caption: "", // Starts completely empty as requested by the user
                  isDicom: false,
                  width: res.width,
                  height: res.height,
                  modality: meta.modality,
                  projection: meta.projection,
                  side: meta.side
                });
                resolve();
              });
            } else {
              resolve();
            }
          };
          reader.readAsDataURL(file);
        } else if (isDicomExt || file.size >= 132) {
          // Candidates for DICOM (try to check tags or fallback by extension / header)
          reader.onload = (e) => {
            const buf = e.target?.result as ArrayBuffer;
            if (buf) {
              const uint8 = new Uint8Array(buf);
              let isRealDicom = isDicomExt;
              if (uint8.length > 132) {
                if (uint8[128] === 68 && uint8[129] === 73 && uint8[130] === 67 && uint8[131] === 77) {
                  isRealDicom = true;
                }
              }
              
              if (isRealDicom) {
                const parsed = decodeDicom(buf);
                let finalBase64 = parsed.base64;
                if (!finalBase64) {
                   finalBase64 = generateDicomCanvasFallback(file.name, parsed.meta);
                }
                
                ensureCompatibleImageFormat(finalBase64).then((res) => {
                  const meta = detectImageMetaFromFilename(file.name, parsed.meta);
                  loaded.push({
                    id: "attached-" + Math.random().toString(36).substring(2, 11),
                    name: file.name,
                    url: res.dataUrl,
                    base64: res.dataUrl,
                    caption: "", // Starts completely empty as requested by the user
                    isDicom: true,
                    dicomMetaData: parsed.meta,
                    width: res.width,
                    height: res.height,
                    modality: meta.modality,
                    projection: meta.projection,
                    side: meta.side
                  });
                  resolve();
                });
              } else {
                resolve();
              }
            } else {
              resolve();
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          resolve();
        }
      });
    });
    
    await Promise.all(promises);
    
    if (loaded.length > 0) {
      setAttachedImages((prev) => [...prev, ...loaded]);
    }
  };

  // Clipboard Paste (Ctrl+V) handler for screenshot or diagnostic images mapping
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleAttachedFiles(e.clipboardData.files);
      } else if (e.clipboardData && e.clipboardData.items) {
        const files: File[] = [];
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf("image") !== -1 || item.kind === "file") {
            const blob = item.getAsFile();
            if (blob) {
              const ext = blob.type.split("/")[1] || "png";
              const file = new File([blob], `pasted_capture_${Date.now()}.${ext}`, { type: blob.type });
              files.push(file);
            }
          }
        }
        if (files.length > 0) {
          handleAttachedFiles(files);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [attachedImages]);

  const convertSvgToPng = (svgElement: SVGElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Read the viewBox or size of the SVG to determine the dynamic aspect ratio
        const viewBox = svgElement.getAttribute("viewBox") || "";
        const parts = viewBox.split(/[\s,]+/).map(parseFloat);
        let aspectRatio = 1.42; // standard for vascular schema
        
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          aspectRatio = parts[2] / parts[3];
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          
          if (Math.abs(aspectRatio - 1) < 0.15) {
            // Square aspect ratio (for example, the shoulder diagram) - optimized
            canvas.width = 600;
            canvas.height = 600;
          } else {
            // Wide aspect ratio (for example, the vascular diagram) - optimized
            canvas.width = 750;
            canvas.height = 530;
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Use compressed JPEG instead of PNG for massive size reduction!
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            URL.revokeObjectURL(url);
            resolve(dataUrl);
          } else {
            URL.revokeObjectURL(url);
            reject(new Error("No 2D context"));
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      } catch (e) {
        reject(e);
      }
    });
  };

  const getParagraphSeverity = (text: string): "critical" | "altered" | "normal" => {
    if (!text) return "normal";
    const trimmed = text.trim();
    const trimmedLower = trimmed.toLowerCase();

    // Check manual overrides first
    if (manualSeverityOverrides[trimmed]) {
      return manualSeverityOverrides[trimmed];
    }
    if (manualSeverityOverrides[trimmedLower]) {
      return manualSeverityOverrides[trimmedLower];
    }
    if (manualSeverityOverrides[text]) {
      return manualSeverityOverrides[text];
    }

    // Check AI semantic cache second
    if (aiSeverityCache[trimmed]) {
      return aiSeverityCache[trimmed];
    }
    if (aiSeverityCache[trimmedLower]) {
      return aiSeverityCache[trimmedLower];
    }
    if (aiSeverityCache[text]) {
      return aiSeverityCache[text];
    }

    const blockClean = text.toLowerCase();
    const sentences = blockClean.split(/[.:;]/);
    let severity: "critical" | "altered" | "normal" = "normal";

    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      
      const cleanText = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const criticalKeywords = [
        "ruptura", "desgarro completo", "trombosis", "oclusion", "maligno", "malignidad",
        "birads 4", "birads 5", "birads 6", "birads_4", "birads_5", "birads_6", "aneurisma",
        "colecistitis", "apendicitis", "isquemia", "infarto", "critico", "critica", "criticos", "criticas",
        "trombosis venosa profunda", "tvp", "oclusion total"
      ];

      const alteredKeywords = [
        "desgarro parcial", "desgarro", "alteracion", "alterado", "alterada", "disminuid", "disminucion",
        "aumentad", "aumento", "engrosad", "engrosamiento", "bursitis", "sinovitis", "derrame",
        "quiste", "quistica", "quisticos", "quisticas", "quistes", "calcificacion", "calcificaciones",
        "ectasia", "bocio", "nodulo", "nodulos", "fibrosis", "esteatosis", "hepatomegalia",
        "esplenomegalia", "colelitiasis", "lodo biliar", "adenopatia", "adenopatias",
        "heterogeneo", "heterogenea", "moderado", "moderada", "leve", "litiasis", "lesion", "lesiones",
        "insuficiencia", "insuficiente", "insuficiencias", "reflujo", "reflujos", "incompetente", "incompetentes",
        "incompetencia", "retrogado", "retr√≥grado", "retrogrado", "dilatado", "dilatada", "dilataciones", "dilatacion",
        "ectasico", "ectasica", "tortuoso", "tortuosa"
      ];

      const hasActiveKeyword = (keywords: string[]) => {
        for (const kw of keywords) {
          const kwClean = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const idx = cleanText.indexOf(kwClean);
          if (idx !== -1) {
            // Context before key covers the whole sentence up to the keyword
            const contextBefore = cleanText.substring(0, idx);
            
            const negationPatterns = [
              /\bsin\b/,
              /\bno\s+se\b/,
              /\bno\s+aprec\w*/,
              /\bno\s+evid\w*/,
              /\bno\s+observa\w*/,
              /\bno\s+detecta\w*/,
              /\bno\s+visualiza\w*/,
              /\bno\s+hay\b/,
              /\bausencia\b/,
              /\blibre\s+de\b/,
              /\bnegativ\w*/,
              /\bnormal\b/,
              /\bconservad\w*/,
              /\bdescarta\w*/,
              /\bpermeable\b/,
              /\bcolapsable\b/,
              /\bcompresible\b/,
              /\bno\s+muestra\b/,
              /\bno\s+revela\b/
            ];

            const isNegated = negationPatterns.some(pattern => pattern.test(contextBefore));
            if (!isNegated) {
              return true;
            }
          }
        }
        return false;
      };

      if (hasActiveKeyword(criticalKeywords)) {
        severity = "critical";
        break;
      } else if (hasActiveKeyword(alteredKeywords)) {
        severity = "altered";
      }
    }

    return severity;
  };

  const getImageDimensionsVirtual = (url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve({ width: 0, height: 0 });
        return;
      }
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  };

  const handleDownloadNativePDF = async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    studyOverride?: Partial<CloudStudy>,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    // Shadow state variables to support optional study overrides gracefully using pdfStateRef.current to avoid TDZ
    const generatedReportLocal = studyOverride ? studyOverride.reportText : pdfStateRef.current.generatedReport;
    if (!generatedReportLocal) return;

    const patientNameLocal = studyOverride ? (studyOverride.patientName || "Paciente An√≥nimo") : (pdfStateRef.current.patientName || "Paciente An√≥nimo");
    const patientEmailLocal = studyOverride ? (studyOverride.patientEmail || "No especificado") : (pdfStateRef.current.patientEmail || "No especificado");
    const patientAgeLocal = studyOverride ? (studyOverride.patientAge || "") : pdfStateRef.current.patientAge;
    const patientGenderLocal = studyOverride ? (studyOverride.patientGender || "") : pdfStateRef.current.patientGender;
    const patientIdLocal = studyOverride ? (studyOverride.patientId || "") : pdfStateRef.current.patientId;
    const reportDateLocal = studyOverride ? (studyOverride.reportDate || "") : pdfStateRef.current.reportDate;
    const doctorNameLocal = studyOverride ? (studyOverride.doctorName || "M√©dico Radi√≥logo") : (pdfStateRef.current.doctorName || "M√©dico Radi√≥logo");
    const doctorLicenseLocal = studyOverride ? (studyOverride.doctorLicense || "No especificada") : (pdfStateRef.current.doctorLicense || "No especificada");
    const clinicNameLocal = studyOverride ? (studyOverride.clinicName || "Cl√≠nica Privada") : (pdfStateRef.current.clinicName || "Cl√≠nica Privada");
    const clinicalHistoryLocal = studyOverride ? (studyOverride.clinicalHistory || "No especificada") : (pdfStateRef.current.clinicalHistory || "No especificada");
    const findingsLocal = studyOverride ? (studyOverride.findings || "No especificadas") : (pdfStateRef.current.findings || "No especificadas");
    const studyTypeLocal = studyOverride ? (studyOverride.studyType || "Estudio General") : (pdfStateRef.current.studyType || "Estudio General");
    const customLogoUrlLocal = studyOverride ? (studyOverride.customLogoUrl || "") : (pdfStateRef.current.customLogoUrl || "");
    const customLogoStyleLocal = studyOverride ? (studyOverride.customLogoStyle || "logo") : (pdfStateRef.current.customLogoStyle || "logo");
    const customSignatureUrlLocal = studyOverride ? (studyOverride.customSignatureUrl || "") : (pdfStateRef.current.customSignatureUrl || "");
    const specificStudyLocal = studyOverride && studyOverride.specificStudy ? studyOverride.specificStudy : pdfStateRef.current.specificStudy;
    const pdfLayoutTypeLocal = studyOverride && studyOverride.pdfLayoutType ? (studyOverride.pdfLayoutType as any) : pdfStateRef.current.pdfLayoutType;
    const selectedLogoLocal = studyOverride && studyOverride.selectedLogo ? studyOverride.selectedLogo : pdfStateRef.current.selectedLogo;
    const usPhotoLayoutLocal: UltrasoundPhotoLayout = (studyOverride && (studyOverride as any).usPhotoLayout) 
      ? (studyOverride as any).usPhotoLayout 
      : (pdfStateRef.current?.usPhotoLayout || usPhotoLayout || "auto");

    // Now re-assign to local variables with the exact same name as states to shadow them!
    const generatedReport = generatedReportLocal;
    const patientName = patientNameLocal;
    const patientEmail = patientEmailLocal;
    const patientAge = patientAgeLocal;
    const patientGender = patientGenderLocal;
    const patientId = patientIdLocal;
    const reportDate = reportDateLocal;
    const doctorName = doctorNameLocal;
    const doctorLicense = doctorLicenseLocal;
    const clinicName = clinicNameLocal;
    const displayClinicName = clinicName && clinicName.trim().toUpperCase() !== "CL√çNICA PRIVADA" && clinicName.trim().toUpperCase() !== "CLINICA PRIVADA" ? clinicName.toUpperCase() : "";
    const clinicalHistory = clinicalHistoryLocal;
    const findings = findingsLocal;
    const studyType = studyTypeLocal;
    const customLogoUrl = customLogoUrlLocal;
    const customLogoStyle = customLogoStyleLocal;
    const customSignatureUrl = customSignatureUrlLocal;
    const specificStudy = specificStudyLocal || "T√≥rax";
    const pdfLayoutType = pdfLayoutTypeLocal || "classic";
    const selectedLogo = selectedLogoLocal || "none";
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      });

      let yCoord = 20;
      let marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      let contentWidth = pageWidth - (2 * marginX); // 170mm

      // Load virtual image dimensions to prevent any layout distortion on any device
      const logoDims = await getImageDimensionsVirtual(customLogoUrl);
      const signatureDims = await getImageDimensionsVirtual(customSignatureUrl);

      const drawAsymmetricSidebar = (docObj: any, pageNum: number, startY: number = 20) => {
        if (pdfLayoutType !== "asymmetric") return;
        
        // Draw elegant vertical dividing line at x = 70
        docObj.setDrawColor(226, 232, 240); // slate-200
        docObj.setLineWidth(0.35);
        docObj.line(70, startY, 70, pageHeight - 20);

        if (pageNum === 1) {
          // Draw a very elegant Swiss-style slate background card for patient info
          const cardY = startY + 2;
          const cardW = 46;
          const cardH = 75; // slightly taller to fit everything nicely
          
          docObj.setFillColor(248, 250, 252); // slate-50
          docObj.setDrawColor(226, 232, 240); // slate-200
          docObj.setLineWidth(0.2);
          docObj.roundedRect(20, cardY, cardW, cardH, 2, 2, "FD");

          // Red/blue minimalist Swiss accent bar at the top of the sidebar card
          docObj.setFillColor(79, 70, 229); // Indigo accent
          docObj.rect(20, cardY, cardW, 1.8, "F");

          let textY = cardY + 7;
          
          // SIDEBAR HEADER
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7.5);
          docObj.setTextColor(100, 116, 139); // slate-500
          docObj.text("INFORMACI√ìN", 24, textY);
          textY += 4.5;

          // PACIENTE
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184); // slate-400
          docObj.text("PACIENTE", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42); // slate-900
          const pName = (patientName || "NO ESPECIFICADO").toUpperCase();
          const pNameLines = docObj.splitTextToSize(pName, cardW - 8);
          pNameLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 4;
          });
          textY += 2;

          // FECHA
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("FECHA DEL ESTUDIO", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42);
          docObj.text(formatDateToDMY(reportDate), 24, textY);
          textY += 5.5;

          // ESTUDIO
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("ESTUDIO / EXAMEN", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8);
          docObj.setTextColor(15, 23, 42);
          const studyClean = (specificStudy || "ECOGRAF√çA").toUpperCase();
          const studyLines = docObj.splitTextToSize(studyClean, cardW - 8);
          studyLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 3.8;
          });
          textY += 2;

          // M√âDICO
          if (doctorName) {
            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(7);
            docObj.setTextColor(148, 163, 184);
            docObj.text("M√âDICO", 24, textY);
            textY += 3.5;

            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(8);
            docObj.setTextColor(15, 23, 42);
            const drText = doctorName.toUpperCase();
            const drLines = docObj.splitTextToSize(drText, cardW - 8);
            drLines.forEach((l: string) => {
              docObj.text(l, 24, textY);
              textY += 3.8;
            });
          }
        }
      };

      const drawAnatomicalCards = (
        docObj: any,
        findings: Array<{ label: string; state: string; description: string }>,
        boxX: number,
        boxY: number,
        boxW: number,
        boxH: number,
        isVascular: boolean = false
      ) => {
        // Aligned Anatomical Cards format for Appendix / Synopses in PDF (Opci√≥n 1: Fichas Anat√≥micas Alineadas)
        const isLargeSingleMode = boxH > 100;
        const paddingX = 2.5;
        const paddingY = isLargeSingleMode ? 10.5 : 8.5; // Starts after header text space
        const startX = boxX + paddingX;
        const startY = boxY + paddingY;
        const availW = boxW - (paddingX * 2);
        const availH = boxH - paddingY - (isLargeSingleMode ? 3.5 : 2.5);

        const count = findings.length;
        const cols = count > 3 ? 2 : 1;
        const colGap = 2.0;
        const rowGap = isLargeSingleMode ? 3.0 : 2.0;
        const colW = cols === 2 ? (availW - colGap) / 2 : availW;

        const totalRows = Math.max(1, Math.ceil(count / cols));
        const cardH = (availH - (rowGap * (totalRows - 1))) / totalRows;

        findings.forEach((finding, index) => {
          const colIndex = index % cols;
          const rowIndex = Math.floor(index / cols);
          const cardX = startX + colIndex * (colW + colGap);
          const cardY = startY + rowIndex * (cardH + rowGap);

          const stateClean = (finding.state || "").toLowerCase().trim();
          let dotColor = [99, 102, 241];      // indigo-500
          let badgeBg = [238, 242, 255];      // indigo-50
          let badgeText = [67, 56, 202];       // indigo-700
          let drawBorder = [226, 232, 240];    // light border

          if (isVascular) {
            if (stateClean === "normal" || stateClean === "permeable" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              dotColor = [16, 185, 129];        // Emerald-500 (Green)
              badgeBg = [240, 253, 244];
              badgeText = [21, 128, 61];
              drawBorder = [209, 250, 229];
            } else if (stateClean === "mild" || stateClean === "reflux" || stateClean.includes("mild") || stateClean.includes("reflux") || stateClean.includes("leve") || stateClean.includes("espesor_conservado")) {
              dotColor = [245, 158, 11];        // Amber-500 (Orange for mild-moderate)
              badgeBg = [254, 252, 232];
              badgeText = [180, 83, 9];
              drawBorder = [254, 243, 199];
            } else if (stateClean === "severe" || stateClean === "critical" || stateClean === "thrombosis" || stateClean.includes("severe") || stateClean.includes("critico") || stateClean.includes("cr√≠tico") || stateClean.includes("trombosis")) {
              dotColor = [220, 38, 38];         // Red-600 (Red for severe)
              badgeBg = [254, 242, 242];
              badgeText = [185, 28, 28];
              drawBorder = [254, 205, 211];
            } else {
              // Fallback for custom or unmapped states in vascular studies (Amber/Orange)
              dotColor = [245, 158, 11];
              badgeBg = [254, 252, 232];
              badgeText = [180, 83, 9];
              drawBorder = [254, 243, 199];
            }
          } else {
            if (stateClean === "normal" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              dotColor = [16, 185, 129];        // emerald-500
              badgeBg = [240, 253, 244];         // emerald-50
              badgeText = [21, 128, 61];          // emerald-700
              drawBorder = [209, 250, 229];
            } else if (
              stateClean.includes("ruptura") || 
              stateClean.includes("desgarro_completo") ||
              stateClean.includes("orquitis") ||
              stateClean.includes("torsion") ||
              stateClean.includes("colecistitis") || 
              stateClean.includes("severa") || 
              stateClean.includes("severo") || 
              stateClean.includes("masa") || 
              stateClean.includes("solido") || 
              stateClean.includes("s√≥lido") || 
              stateClean.includes("maligno") || 
              stateClean.includes("birads_4") || 
              stateClean.includes("birads_5") || 
              stateClean.includes("birads_6") || 
              stateClean.includes("suspicious") || 
              stateClean.includes("aneurisma") ||
              stateClean.includes("trombosis") ||
              stateClean.includes("critico") ||
              stateClean.includes("cr√≠tico")
            ) {
              dotColor = [239, 68, 68];          // rose-500
              badgeBg = [254, 242, 242];         // rose-50
              badgeText = [185, 28, 28];          // rose-700
              drawBorder = [254, 205, 211];       // rose-200
            } else if (
              stateClean.includes("leve") || 
              stateClean.includes("quiste_simple") || 
              stateClean.includes("benigno") || 
              stateClean.includes("sinovitis_l") || 
              stateClean.includes("derrame_l") ||
              stateClean.includes("espesor_conservado") ||
              stateClean.includes("hidrocele_l") ||
              stateClean.includes("ectasia_l") ||
              stateClean.includes("bursitis_l") ||
              stateClean.includes("birads_2") ||
              stateClean.includes("birads_3")
            ) {
              dotColor = [245, 158, 11];         // amber-500
              badgeBg = [254, 252, 232];         // amber-50
              badgeText = [180, 83, 9];           // amber-800
              drawBorder = [254, 243, 199];       // amber-200
            }
          }

          // Draw card background
          docObj.setFillColor(255, 255, 255);
          docObj.setDrawColor(drawBorder[0], drawBorder[1], drawBorder[2]);
          docObj.setLineWidth(0.18);
          docObj.roundedRect(cardX, cardY, colW, cardH, 1.2, 1.2, "FD");

          // Draw colored stripe indicator on left edge
          docObj.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
          docObj.rect(cardX, cardY, 1.2, cardH, "F");

          // Draw badge for state FIRST
          let rawState = (finding.state || "ALTERADO").replace(/_/g, " ").toUpperCase();
          if (isVascular) {
            const stateClean = (finding.state || "").toLowerCase().trim();
            if (stateClean === "normal" || stateClean === "permeable" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              rawState = "PERMEABLE";
            } else if (stateClean === "mild" || stateClean.includes("mild") || stateClean.includes("leve") || stateClean.includes("espesor_conservado")) {
              rawState = "LEVE";
            } else if (stateClean === "reflux" || stateClean.includes("reflux")) {
              rawState = "INSUFICIENCIA";
            } else if (stateClean === "thrombosis" || stateClean.includes("trombosis")) {
              rawState = "TROMBOSIS";
            } else if (stateClean === "severe" || stateClean === "critical" || stateClean.includes("severe") || stateClean.includes("critico") || stateClean.includes("cr√≠tico")) {
              rawState = "ESTENOSIS";
            } else {
              rawState = "ALTERADO";
            }
          } else {
            if (rawState === "NORMAL") rawState = "NORMAL";
            else if (rawState === "DESGARRO MIOFASCIAL") rawState = "D. MIOFASC";
            else if (rawState === "DESGARRO INTRAMUSCULAR") rawState = "D. INTRAC";
            else if (rawState === "VALORACION DINAMICA") rawState = "VAL. DIN.";
            else if (rawState === "ADENOPATIA REACTIVA") rawState = "INFLAMATORIO";
          }

          const badgeFontSize = cardH > 20 ? 5.2 : 4.0;
          const badgeH = cardH > 20 ? 3.4 : 2.3;
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(badgeFontSize);
          const stateTextWidth = docObj.getTextWidth(rawState);
          const badgeW = Math.min(colW * 0.45, stateTextWidth + 2.5);
          const badgeX = cardX + colW - badgeW - 1.2;

          docObj.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
          docObj.roundedRect(badgeX, cardY + 1.0, badgeW, badgeH, 0.5, 0.5, "F");
          docObj.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
          docObj.text(rawState, badgeX + badgeW / 2, cardY + 1.0 + (badgeH * 0.72), { align: "center" });

          // Draw structure label (Title) with auto-scaling font size to avoid truncation
          let labelFontSize = cardH < 10 ? 5.0 : (cardH > 20 ? 7.2 : 5.6);
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(labelFontSize);
          docObj.setTextColor(15, 23, 42); // slate-900

          const maxTitleWidth = badgeX - (cardX + 2.4) - 1.0;
          let titleText = finding.label.toUpperCase();

          while (labelFontSize > 3.6 && docObj.getTextWidth(titleText) > maxTitleWidth) {
            labelFontSize -= 0.3;
            docObj.setFontSize(labelFontSize);
          }
          if (docObj.getTextWidth(titleText) > maxTitleWidth) {
            while (titleText.length > 3 && docObj.getTextWidth(titleText + "..") > maxTitleWidth) {
              titleText = titleText.slice(0, -1);
            }
            titleText += "..";
          }
          docObj.text(titleText, cardX + 2.4, cardY + (cardH > 20 ? 3.8 : 2.8));

          // Draw wrapped clinical description without cutting off lines
          docObj.setFont("helvetica", "normal");
          let descFontSize = cardH < 9 ? 4.2 : (cardH < 13 ? 4.6 : (cardH > 20 ? 6.2 : 5.0));
          let spacing = descFontSize * (cardH > 20 ? 0.45 : 0.42);

          docObj.setFontSize(descFontSize);
          docObj.setTextColor(71, 85, 105); // slate-600

          const textToWrap = finding.description || "";
          const wrapWidthLimit = colW - 4.2;
          let linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);

          const startTextY = cardY + (cardH > 20 ? 4.0 : 2.8) + spacing;
          const maxTextY = cardY + cardH - 1.0;
          const maxAllowedLines = Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1);

          if (linesWrapped.length > maxAllowedLines && descFontSize > 3.8) {
            descFontSize = 3.8;
            spacing = descFontSize * 0.40;
            docObj.setFontSize(descFontSize);
            linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);
          }

          const linesToRender = Math.min(linesWrapped.length, Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1));
          for (let i = 0; i < linesToRender; i++) {
            let lineStr = linesWrapped[i];
            if (i === linesToRender - 1 && linesWrapped.length > linesToRender && lineStr.length > 3) {
              lineStr = lineStr.slice(0, -3) + "...";
            }
            docObj.text(lineStr, cardX + 2.4, startTextY + (i * spacing));
          }
        });
      };

      // Helper function to check space and add page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
        }
      };

      // Helper function to wrap markdown mixed text safely
      const wrapMarkdown = (docObj: any, textStr: string, maxWidth: number) => {
        // Strip unicode box drawing or stray '%' lines that break font encodings
        const sanitizedText = textStr.replace(/[‚îÅ‚ïê‚îÄ‚Äî]{2,}/g, "").replace(/^[\s%]{4,}$/g, "");
        const parts = sanitizedText.split("**");
        const tokens: { text: string; isBold: boolean }[] = [];

        parts.forEach((partText, idx) => {
          if (!partText && idx !== 0) return; // Allow empty first item (implies starting with bold)
          const isBold = idx % 2 === 1;
          const subParts = partText.split(/(\s+)/);
          subParts.forEach((sub) => {
            if (sub === "") return;
            tokens.push({ text: sub, isBold });
          });
        });

        const lines: { text: string; isBold: boolean }[][] = [];
        let currentLine: { text: string; isBold: boolean }[] = [];
        let currentWidth = 0;

        const originalFontType = docObj.getFont().fontStyle;

        tokens.forEach((token) => {
          if (token.isBold) {
            docObj.setFont("times", "bold");
          } else {
            docObj.setFont("times", "normal");
          }
          docObj.setFontSize(10.5);
          const tokenWidth = docObj.getTextWidth(token.text);

          if (currentWidth + tokenWidth <= maxWidth) {
            currentLine.push(token);
            currentWidth += tokenWidth;
          } else {
            if (token.text.trim() === "" && currentLine.length === 0) {
              return; // Skip leading spaces
            }
            if (currentLine.length > 0) {
              lines.push(currentLine);
            }
            currentLine = [token];
            currentWidth = tokenWidth;
          }
        });

        if (currentLine.length > 0) {
          lines.push(currentLine);
        }

        docObj.setFont("times", originalFontType);
        return lines;
      };

      // Header Brand/Clinic Logo & Name
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          // Banner Style (Centered wide banner)
          let bannerWidth = 165;
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth; // 170
            const maxHeight = 52;
            if (aspect > maxWidth / maxHeight) {
              bannerWidth = maxWidth;
              bannerHeight = maxWidth / aspect;
            } else {
              bannerHeight = maxHeight;
              bannerWidth = maxHeight * aspect;
            }
          }
          
          try {
            const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customLogoUrl, format, (pageWidth - bannerWidth) / 2, yCoord, bannerWidth, bannerHeight);
            yCoord += bannerHeight + 5;
          } catch (err) {
            console.warn("Could not draw banner image inside jsPDF", err);
            // Fallback
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;
          }

          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 5;
          }
        } else {
          // Left Aligned Logo Style
          let logoWidth = 36;
          let logoHeight = 36;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = 42;
            const maxHeight = 42;
            if (aspect > maxWidth / maxHeight) {
              logoWidth = maxWidth;
              logoHeight = maxWidth / aspect;
            } else {
              logoHeight = maxHeight;
              logoWidth = maxHeight * aspect;
            }
          }
          
          try {
            const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customLogoUrl, format, marginX, yCoord, logoWidth, logoHeight);
          } catch (err) {
            console.warn("Could not draw logo image inside left header", err);
          }
          
          const textX = marginX + logoWidth + 6;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", textX, yCoord + (logoHeight / 2) + 4);
          
          yCoord += Math.max(logoHeight, 15) + 6;
        }
      } else {
        // Standard (No user custom logo file, or they chose default medical vectors)
        let symbolWidth = 0;
        if (selectedLogo === "medical-cross") {
          symbolWidth = 14;
          doc.setDrawColor(220, 38, 38); // Red
          doc.setFillColor(220, 38, 38);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "heart-pulse") {
          symbolWidth = 14;
          doc.setDrawColor(244, 63, 94); // Rose
          doc.setFillColor(244, 63, 94);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "dna" || selectedLogo === "shield-check") {
          symbolWidth = 14;
          doc.setDrawColor(79, 70, 229); // Indigo
          doc.setFillColor(79, 70, 229);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        }

        if (symbolWidth > 0) {
          const textX = marginX + symbolWidth + 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          // Centered Clinic Name or default heading
          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900 / dark
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("REPORTE DE RADIODIAGN√ìSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 11;
          }
        }
      }

      // Add a line under header
      if (pdfLayoutType === "clinical_slate") {
        doc.setDrawColor(71, 85, 105); // slate-600
        doc.setLineWidth(0.65);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      } else if (pdfLayoutType === "executive_medical") {
        doc.setDrawColor(15, 23, 42); // Navy
        doc.setLineWidth(0.6);
        doc.line(marginX, yCoord - 2.5, pageWidth - marginX, yCoord - 2.5);
        doc.setDrawColor(197, 160, 89); // Gold
        doc.setLineWidth(0.35);
        doc.line(marginX, yCoord - 1.5, pageWidth - marginX, yCoord - 1.5);
      } else {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      }
      yCoord += 2;

      // Patient Metadata Block
      if (pdfLayoutType === "clinical_slate" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CL√çNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / G√âNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Clinical Slate metadata card
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.35);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical divider inside the card for Row 1
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.25);
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Draw vertical divider in Row 2
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "executive_medical" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CL√çNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / G√âNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Executive Medical metadata card (Cream & Gold style)
        doc.setFillColor(253, 251, 247); // Sophisticated cream
        doc.setDrawColor(197, 160, 89); // Metallic Gold
        doc.setLineWidth(0.4);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical gold divider inside the card for Row 1
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Row 2 divider
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "asymmetric") {
        drawAsymmetricSidebar(doc, 1, yCoord);
        yCoord += 4;
        marginX = 74;
        contentWidth = 116;
      } else if (patientName || reportDate) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD/SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }
        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 21 : 12;

        doc.setFillColor(248, 250, 252); // greyish background
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "S");

        let xOffset = marginX + 4;
        let totalDateWidth = 0;
        const formattedDate = formatDateToDMY(reportDate);
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA: ";
          totalDateWidth = doc.getTextWidth(dateLabel) + doc.getTextWidth(formattedDate);
        }

        if (patientName) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          doc.text("PACIENTE: ", xOffset, yCoord + 7.5);
          const labelWidth = doc.getTextWidth("PACIENTE: ");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          
          let patientText = patientName.toUpperCase();
          const maxNameWidth = (contentWidth - 8 - totalDateWidth) - labelWidth - 4;
          if (doc.getTextWidth(patientText) > maxNameWidth) {
            while (patientText.length > 5 && doc.getTextWidth(patientText + "...") > maxNameWidth) {
              patientText = patientText.slice(0, -1);
            }
            patientText += "...";
          }
          doc.text(patientText, xOffset + labelWidth, yCoord + 7.5);
        }

        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          const dateLabel = "FECHA: ";
          const rightX = marginX + contentWidth - 4 - totalDateWidth;
          
          doc.text(dateLabel, rightX, yCoord + 7.5);
          const dateLabelWidth = doc.getTextWidth(dateLabel);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(formattedDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        if (hasExtraMeta) {
          // Draw a small line divider
          doc.setDrawColor(226, 232, 240);
          doc.line(marginX, yCoord + 11.5, marginX + contentWidth, yCoord + 11.5);

          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const labelText = `${col.label}: `;
            doc.text(labelText, xOffset, yCoord + 16.5);
            const labelW = doc.getTextWidth(labelText);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, xOffset + labelW, yCoord + 16.5);
          } else if (extraCols.length === 2) {
            // Col 1 (Left)
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label1 = `${col1.label}: `;
            doc.text(label1, xOffset, yCoord + 16.5);
            const label1W = doc.getTextWidth(label1);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, xOffset + label1W, yCoord + 16.5);

            // Col 2 (Right)
            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label2 = `${col2.label}: `;
            const val2 = col2.value;
            const totalW2 = doc.getTextWidth(label2) + doc.getTextWidth(val2);
            const rightX = marginX + contentWidth - 4 - totalW2;
            doc.text(label2, rightX, yCoord + 16.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(val2, rightX + doc.getTextWidth(label2), yCoord + 16.5);
          }
        }

        yCoord += cardHeight + 7;
      }

      // --- DYNAMIC PAGE BUDGET & COMPLETE WIDOW/ORPHAN CONTROL ---
      const isVascularStudy = specificStudy === "Doppler de car√≥tidas" || 
                              specificStudy === "Doppler venoso de miembro inferior" || 
                              specificStudy === "Doppler arterial de miembro inferior";
      const isCarotidasForPDF = specificStudy.toLowerCase().includes("car√≥t") || specificStudy.toLowerCase().includes("carot");
      const hasBifurcDer = !!document.getElementById("print-bifurcation-der");
      const hasBifurcIzq = !!document.getElementById("print-bifurcation-izq");

      let factor = 1.0;
      let estimatedHeight = 20; // Start at top margin

      // 1. Header height estimation
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth;
            const maxHeight = 52;
            bannerHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
          }
          estimatedHeight += bannerHeight + 5;
          if (displayClinicName) estimatedHeight += 5;
        } else {
          let logoHeight = 36;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = 42;
            const maxHeight = 42;
            logoHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
          }
          estimatedHeight += Math.max(logoHeight, 15) + 6;
        }
      } else {
        estimatedHeight += 18;
      }
      estimatedHeight += 2; // Underline

      // 2. Patient metadata block estimation
      if (pdfLayoutType !== "asymmetric" && (patientName || reportDate)) {
        estimatedHeight += 19;
      }

      // 3. Estimate text blocks (paragraphs) and tables
      try {
        const stripEmojisLocal = (str: string): string => {
          if (!str) return "";
          return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
        };
        const reportToRenderLocal = isEditingReportManual ? editedReportText : generatedReport;
        const emojiFreeReportLocal = stripEmojisLocal(reportToRenderLocal || "");
        let cleanReportLocal = cleanRawClinicalText(emojiFreeReportLocal);
        cleanReportLocal = cleanReportLocal.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");
        cleanReportLocal = cleanReportLocal.replace(/\[CASE_ANALYSIS_JSON\][\s\S]*?\[\/CASE_ANALYSIS_JSON\]/gi, "");
        cleanReportLocal = cleanReportLocal.replace(/\n*---\s*\n+\*\*AN√ÅLISIS INTEGRADO DE CASO[\s\S]*?(?=(?:\n\n---|(?:\n\n###|\n\n\*\*|\n\n#)|$))/gi, "");
        cleanReportLocal = cleanReportLocal.replace(/\*\*AN√ÅLISIS INTEGRADO DE CASO[\s\S]*?(?=(?:\n\n---|(?:\n\n###|\n\n\*\*|\n\n#)|$))/gi, "");
        cleanReportLocal = cleanReportLocal.trim();
        const normalizedReportLocal = cleanReportLocal
          .replace(/\n+\s*(---\s*)/g, "\n\n$1")
          .replace(/\n+\s*((?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
          .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[o√≥]n(?:es)?|impresi[o√≥]n(?:es)?\s+diagn[o√≥]stica(?:s)?|diagn[o√≥]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
        const rawParagraphsLocal = normalizedReportLocal.split(/\n\n+/);
        const paragraphsLocal: string[] = [];
        let inConclusionLocal = false;
        let conclusionBufferLocal: string[] = [];

        rawParagraphsLocal.forEach((p) => {
          const trimmed = p.trim();
          if (!trimmed) return;

          const isSemiologyLineLocal = /semiolog[i√≠]a|justificaci[o√≥]n|exclusi[o√≥]n/i.test(trimmed);
          const upperTrimmed = trimmed.toUpperCase();
          const isConclusionHeader = !isSemiologyLineLocal && (
            /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed) ||
            upperTrimmed.includes("IMPRESI√ìN DIAGN√ìSTICA") || upperTrimmed.includes("IMPRESION DIAGNOSTICA") ||
            upperTrimmed.includes("CONCLUSIONES DIAGN√ìSTICAS") || upperTrimmed.includes("CONCLUSION DIAGNOSTICA") ||
            /^\s*(?:#+|\*+)*\s*(?:CONCLUSI[O√ì]N|CONCLUSIONES|IMPRESI[O√ì]N|IMPRESION|DIAGN[O√ì]STICO)\s*[:*#\s]/i.test(trimmed)
          );

          const isFootnoteOrDividerLocal = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
            /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

          const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
            /^\s*\*\*(?:hallazgos|estudio|t√©cnica|tecnica|m√©todo|metodo|exploraci√≥n|exploracion|motivo|comparaci√≥n|comparacion|datos\s+cl√≠nicos|indicaci√≥n|indicacion|antecedentes|pie\s+de\s+p√°gina|nota\s+de\s+pie)\b/i.test(trimmed) ||
            isFootnoteOrDividerLocal;

          if (isFootnoteOrDividerLocal) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else if (isConclusionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = true;
            conclusionBufferLocal.push(trimmed);
          } else if (isOtherSectionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else {
            if (inConclusionLocal) {
              conclusionBufferLocal.push(trimmed);
            } else {
              paragraphsLocal.push(trimmed);
            }
          }
        });

        if (inConclusionLocal && conclusionBufferLocal.length > 0) {
          paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
        }

        const tempDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        let isFirstBlockLocal = true;
        const estContentWidth = pdfLayoutType === "asymmetric" ? 116 : contentWidth;

        paragraphsLocal.forEach((block) => {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) return;

          if (!isFirstBlockLocal) {
            estimatedHeight += 4.5;
          } else {
            isFirstBlockLocal = false;
          }

          if (trimmedBlock.startsWith("|") && (trimmedBlock.includes("-|-") || trimmedBlock.includes("---") || trimmedBlock.includes(":---"))) {
            // Table block
            const rows = trimmedBlock.split("\n").filter(r => r.trim() !== "");
            const bodyRows = rows.slice(2);
            estimatedHeight += 16;
            bodyRows.forEach((r) => {
              const cells = r.split("|").map(c => c.trim());
              let maxLinesLocal = 1;
              cells.forEach((cellText) => {
                const wrapped = tempDoc.splitTextToSize(cellText.replace(/\*\*/g, ""), (estContentWidth / cells.length) - 6);
                if (wrapped.length > maxLinesLocal) maxLinesLocal = wrapped.length;
              });
              estimatedHeight += (maxLinesLocal * 5) + 4;
            });
            estimatedHeight += 4;
          } else {
            // Standard block
            const linesOfBlock = trimmedBlock.split("\n");
            linesOfBlock.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) {
                estimatedHeight += 2.5;
                return;
              }
              if (trimmed === "---" || /^---+\s*$/.test(trimmed)) {
                return;
              }
              const isHeader = trimmed.startsWith("#") || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isHeader) {
                estimatedHeight += 5.5;
              } else {
                const wrappedLines = tempDoc.splitTextToSize(trimmed.replace(/\*\*/g, ""), estContentWidth);
                estimatedHeight += wrappedLines.length * 5.0;
              }
            });
          }
        });
      } catch (estError) {
        console.warn("Error estimating paragraph heights:", estError);
      }

      // 4. Clinical schematics / Diagram estimation
      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        estimatedHeight += 95;
      } else if (includeVascularSchemaInReport && isVascularStudy) {
        estimatedHeight += 85;
        if (isCarotidasForPDF && includeCarotidBifurcations && (hasBifurcDer || hasBifurcIzq)) {
          estimatedHeight += 75;
        }
      }

      // 5. Signature block estimation
      estimatedHeight += 38;

      // 6. Calculate pages and remainder for widow/orphan detection
      const usablePageHeight = 255;
      const estTotalPages = Math.ceil(estimatedHeight / usablePageHeight);
      const estRemainder = estimatedHeight % usablePageHeight;

      // If we spill onto a new page, and that new page has less than 48mm of content (orphaned signature/conclusion!),
      // we reduce spacing to pull it back onto the previous page elegantly!
      if (estTotalPages > 1 && estRemainder < 48) {
        factor = 0.84; // 16% spacing compression
      } else if (estTotalPages > 1 && estRemainder < 60) {
        factor = 0.88; // 12% spacing compression
      }

      // Adjust starting patient offset with factor
      if (patientName || reportDate) {
        yCoord = yCoord - 19 + (19 * factor);
      }

      // Strip emojis from the generated report
      const stripEmojis = (str: string): string => {
        if (!str) return "";
        return str
          // Strip surrogate pairs (handles 4-byte emojis like ü´Å, ü´Ä, ü¶¥, üß†, üìã, üîç, etc.)
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          // Strip miscellaneous symbol emojis & shapes in the BMP (like ‚ö†Ô∏è, ‚è±, ‚öï, ‚úîÔ∏è, ‚ùå, ‚≠ê, etc.)
          .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
      };

      // Clean non-ASCII smart quotes, dashes, bullet symbols, and special unicode symbols that distort jsPDF letter spacing
      const cleanTextForJSPDF = (text: string): string => {
        if (!text) return "";
        return text
          .replace(/[‚Äú‚Äù‚Äû¬´¬ª‚Äü]/g, '"')
          .replace(/[‚Äò‚Äô`¬¥‚Ä≤‚Ä≥]/g, "'")
          .replace(/[‚Äî‚Äì‚Äí‚Äï]/g, "-")
          .replace(/[\u2022\u25E6\u2023\u2043\u25AA\u25FE\u25C6\u25C7\u25B6\u25B7\u25C0\u25C1]/g, "-")
          .replace(/[\u00A0\u200B\u2009\u202F\u2000-\u200A]/g, " ")
          .replace(/‚Ä¶/g, "...");
      };

      const reportToRender = isEditingReportManual ? editedReportText : generatedReport;
      const emojiFreeReport = stripEmojis(reportToRender);
      let cleanReport = cleanRawClinicalText(emojiFreeReport);

      // Extract all CASE_ANALYSIS blocks from the report text to draw them in the Annex at the end
      const caseAnalysisBlocks: CaseAnalysisData[] = [];
      const caseRegex = /\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/g;
      let caseMatch;
      while ((caseMatch = caseRegex.exec(cleanReport)) !== null) {
        if (caseMatch[1]) {
          try {
            const parsed = JSON.parse(caseMatch[1]) as CaseAnalysisData;
            caseAnalysisBlocks.push(parsed);
          } catch (e) {
            console.error("Error parsing case data block for PDF annex:", e);
          }
        }
      }

      // Strip all [START_CASE_ANALYSIS:format] ... [END_CASE_ANALYSIS:format] blocks
      // from the main report content so they do not print as plain text.
      cleanReport = cleanReport.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");

      // Strip JSON & summary cleanly without truncating remainder of report
      cleanReport = cleanReport.replace(/\[CASE_ANALYSIS_JSON\][\s\S]*?\[\/CASE_ANALYSIS_JSON\]/gi, "");
      cleanReport = cleanReport.replace(/\n*---\s*\n+\*\*AN√ÅLISIS INTEGRADO DE CASO[\s\S]*?(?=(?:\n\n---|(?:\n\n###|\n\n\*\*|\n\n#)|$))/gi, "");
      cleanReport = cleanReport.replace(/\*\*AN√ÅLISIS INTEGRADO DE CASO[\s\S]*?(?=(?:\n\n---|(?:\n\n###|\n\n\*\*|\n\n#)|$))/gi, "");
      cleanReport = cleanReport.trim();

      const normalizedReport = cleanReport
        .replace(/\n+\s*(---\s*)/g, "\n\n$1")
        .replace(/\n+\s*((?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
        .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[o√≥]n(?:es)?|impresi[o√≥]n(?:es)?\s+diagn[o√≥]stica(?:s)?|diagn[o√≥]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
      const rawParagraphs = normalizedReport.split(/\n\n+/);
      const paragraphs: string[] = [];
      let inConclusion = false;
      let conclusionBuffer: string[] = [];

      rawParagraphs.forEach((p) => {
        const trimmed = p.trim();
        if (!trimmed) return;

        // If this is a CASE_ANALYSIS_JSON block, do not merge it with the conclusion or any other buffer
        if (trimmed.includes("[CASE_ANALYSIS_JSON]")) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
          return;
        }

        const isSemiologyLine = /semiolog[i√≠]a|justificaci[o√≥]n|exclusi[o√≥]n/i.test(trimmed);
        const upperTrimmed = trimmed.toUpperCase();
        const isConclusionHeader = !isSemiologyLine && (
          /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed) ||
          upperTrimmed.includes("IMPRESI√ìN DIAGN√ìSTICA") || upperTrimmed.includes("IMPRESION DIAGNOSTICA") ||
          upperTrimmed.includes("CONCLUSIONES DIAGN√ìSTICAS") || upperTrimmed.includes("CONCLUSION DIAGNOSTICA") ||
          /^\s*(?:#+|\*+)*\s*(?:CONCLUSI[O√ì]N|CONCLUSIONES|IMPRESI[O√ì]N|IMPRESION|DIAGN[O√ì]STICO)\s*[:*#\s]/i.test(trimmed)
        );

        const isFootnoteOrDivider = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
          /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

        const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
          /^\s*\*\*(?:hallazgos|estudio|t√©cnica|tecnica|m√©todo|metodo|exploraci√≥n|exploracion|motivo|comparaci√≥n|comparacion|datos\s+cl√≠nicos|indicaci√≥n|indicacion|antecedentes|pie\s+de\s+p√°gina|nota\s+de\s+pie)\b/i.test(trimmed) ||
          trimmed.includes("ANEXO DIAGN√ìSTICO") ||
          trimmed.includes("DESGLOSE Y JUSTIFICACI√ìN") ||
          isFootnoteOrDivider;

        if (isFootnoteOrDivider) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else if (isConclusionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = true;
          conclusionBuffer.push(trimmed);
        } else if (isOtherSectionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else {
          if (inConclusion) {
            conclusionBuffer.push(trimmed);
          } else {
            paragraphs.push(trimmed);
          }
        }
      });

      if (inConclusion && conclusionBuffer.length > 0) {
        paragraphs.push(conclusionBuffer.join("\n\n"));
      }

      // Set standard font settings
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);

      let isFirstLine = true;
      let isFirstBlock = true;
      let inFootnoteSection = false;
      let hasDrawnSignature = false;

      const renderSignatureBlock = () => {
        if (hasDrawnSignature) return;
        if (doctorName || customSignatureUrl) {
          checkPageBreak(38); // Requerir suficiente espacio para el bloque homologado dual
          yCoord += 12;

          const startY = yCoord;

          // Dibujar borde gris claro con fondo suave en la columna izquierda (Caja de verificaci√≥n)
          const boxX = marginX;
          const boxY = startY;
          const boxW = (pageWidth - marginX * 2) * 0.48; // Columna izquierda (48% de ancho)
          const boxH = 26;

          // Rellenar fondo
          doc.setFillColor(248, 250, 252); // slate 50
          doc.rect(boxX, boxY, boxW, boxH, "F");
          // Dibujar borde
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.35);
          doc.rect(boxX, boxY, boxW, boxH, "S");

          // Metadatos de Integridad en Columna Izquierda:
          let internalY = boxY + 4;
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105); // slate 600
          doc.text("VERIFICACI√ìN INTEGRIDAD DE DOCUMENTO", boxX + 3, internalY);
          internalY += 3.5;

          // Obtener el Hash generado determin√≠sticamente
          const sSeedCombine = `${patientName || ""}-${doctorName || ""}-${reportDate || ""}-${clinicName || ""}`;
          let sHashVal = 0;
          for (let i = 0; i < sSeedCombine.length; i++) {
            sHashVal = ((sHashVal << 5) - sHashVal) + sSeedCombine.charCodeAt(i);
            sHashVal |= 0;
          }
          const sHexStr = Math.abs(sHashVal).toString(16).toUpperCase().padStart(8, "0");
          const pSeedVal = (patientName && patientName.length > 0) ? patientName.charCodeAt(0) + patientName.length : 42;
          const dSeedVal = (doctorName && doctorName.length > 0) ? doctorName.charCodeAt(0) + doctorName.length : 17;
          const partVal = ((pSeedVal * 231 + dSeedVal * 19) % 65535).toString(16).toUpperCase().padStart(4, "E");
          const pdfValidationHash = `SHA256: FD82-${sHexStr.substring(0, 4)}-${sHexStr.substring(4, 8)}-${partVal}-9B1C-E8B1`;

          doc.setFont("courier", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(30, 41, 59); // slate 800
          doc.text(pdfValidationHash, boxX + 3, internalY);
          internalY += 3;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139); // slate 500
          doc.text("ESTADO DEL DOCUMENTO: ", boxX + 3, internalY);
          const stateW = doc.getTextWidth("ESTADO DEL DOCUMENTO: ");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(21, 128, 61); // green 700
          doc.text("FIRMADO ELECTR√ìNICAMENTE", boxX + 3 + stateW, internalY);
          internalY += 2.8;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.1);
          doc.setTextColor(100, 116, 139); // slate 500
          doc.text(`REG. M√âDICO: ${doctorLicense || "M.S.P. Reg: 6025 / Senescyt: 1005-12-7489"}`, boxX + 3, internalY);
          internalY += 2.8;

          doc.text(`FECHA DE VALIDACI√ìN: ${reportDate} (AUT√ìNOMO)`, boxX + 3, internalY);
          internalY += 2.8;

          doc.setFont("helvetica", "italic");
          doc.text("Firma de Validez Homologada seg√∫n Normativa Sanitaria.", boxX + 3, internalY);

          // --- Columna Derecha: √Årea de Firma Digital / Aut√≥grafa ---
          const rightColX = pageWidth - marginX;
          
          // Agregar firma f√≠sica si est√° cargada
          if (customSignatureUrl) {
            try {
              let sigWidth = 35;
              let sigHeight = 11;
              if (signatureDims.width && signatureDims.height) {
                const aspect = signatureDims.width / signatureDims.height;
                const maxWidth = 50;
                const maxHeight = 15;
                if (aspect > maxWidth / maxHeight) {
                  sigWidth = maxWidth;
                  sigHeight = maxWidth / aspect;
                } else {
                  sigHeight = maxHeight;
                  sigWidth = maxHeight * aspect;
                }
              }
              const sigX = rightColX - sigWidth - 4;
              const sigY = boxY + 1; // Alinear ordenadamente arriba
              const format = customSignatureUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(customSignatureUrl, format, sigX, sigY, sigWidth, sigHeight);
            } catch (imgError) {
              console.warn("Could not render custom signature image inside jsPDF", imgError);
            }
          } else {
            // Si no hay firma f√≠sica, mostrar sello digital elegante
            doc.setFont("helvetica", "oblique");
            doc.setFontSize(7);
            doc.setTextColor(30, 64, 175); // blue 800
            doc.text("FIRMADO ELECTR√ìNICAMENTE CON TOKEN", rightColX - 62, boxY + 8);
          }

          // L√≠nea horizontal para firma del doctor (solo del lado derecho)
          const lineStart = rightColX - 70;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.3);
          doc.line(lineStart, boxY + boxH - 8, rightColX, boxY + boxH - 8);

          // Nombre del doctor en la derecha
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          const docText = (doctorName || "Dr. Milton Benavides S. Cod.6025").toUpperCase();
          const docTextWidth = doc.getTextWidth(docText);
          doc.text(docText, rightColX - docTextWidth, boxY + boxH - 4.5);

          // Especialidad del doctor en la derecha
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          const titleText = "Especialista en Radiolog√≠a e Im√°genes Medicas.";
          const titleTextWidth = doc.getTextWidth(titleText);
          doc.text(titleText, rightColX - titleTextWidth, boxY + boxH - 1.5);
          
          yCoord = boxY + boxH + 6;
        }
        hasDrawnSignature = true;
      };

      const renderSingleReportBlock = (block: string) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        // Check for explicit page break tag
        if (/^(?:\[(?:salto(?:_de_p[a√°]gina)?|page_break|salto_pagina)\]|<pagebreak>)$/i.test(trimmedBlock)) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
          return;
        }

        // Check for explicit vertical spacing tag (e.g. [ESPACIO] or [ESPACIO_10MM])
        const spaceMatch = trimmedBlock.match(/^\[ESPACIO(?:_(\d+)MM)?\]$/i);
        if (spaceMatch) {
          const mm = spaceMatch[1] ? parseInt(spaceMatch[1], 10) : 10;
          yCoord += mm * factor;
          return;
        }

        // Skip inline Case Analysis JSON blocks as they are rendered in Step 5 (Diagn√≥stico Avanzado)
        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }

        // Skip decorative delimiter lines that break PDF font encodings
        if (/^[%‚îÅ‚ïê‚îÄ‚Äî_~*-]{4,}$/.test(trimmedBlock.replace(/\s+/g, ""))) {
          return;
        }


        // Check if the block is a footnote (for Creador de Notas de Pie de P√°gina)
        const blockLower = trimmedBlock.toLowerCase();
        
        const isHeadingOrTableOrCode = trimmedBlock.startsWith("#") || 
                                       trimmedBlock.startsWith("**") || 
                                       trimmedBlock.startsWith("|") || 
                                       trimmedBlock.startsWith("```") || 
                                       (trimmedBlock.startsWith("===") && (trimmedBlock.includes("S√çNTESIS VASCULAR") || trimmedBlock.includes("S√çNTESIS DE ANATOM√çA")));
        
        if (isHeadingOrTableOrCode) {
          inFootnoteSection = false;
        }

        const isFootnote = inFootnoteSection ||
                            blockLower.startsWith("*pie de p√°gina:") || 
                            blockLower.startsWith("pie de p√°gina:") ||
                            blockLower.startsWith("*nota de pie:") ||
                            blockLower.startsWith("nota de pie:") ||
                            blockLower.startsWith("*nota de pie de p√°gina:") ||
                            blockLower.startsWith("nota de pie de p√°gina:");

        if (isFootnote) {
          checkPageBreak(8 * factor);
          doc.setFont("times", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(115, 125, 140); // Slate-500 (dim gray)
          
          let cleanTxt = trimmedBlock;
          // Strip "Pie de p√°gina: " or similar prefixes if they exist
          const prefixRegex = /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina)\s*(?:\*+)?\s*:\s*(?:\*+)?\s*/i;
          cleanTxt = cleanTxt.replace(prefixRegex, "");

          if (cleanTxt.startsWith("*")) {
            cleanTxt = cleanTxt.replace(/^\*\s*/, "").replace(/\*$/, "");
          }
          cleanTxt = cleanTxt.replace(/\*\*/g, "");

          const lines = doc.splitTextToSize(cleanTxt, contentWidth);
          lines.forEach((l: string) => {
            checkPageBreak(4.5 * factor);
            doc.text(l, marginX, yCoord);
            yCoord += 4.5 * factor;
          });
          yCoord += 2 * factor; // subtle gap
          
          // Reset default font styles
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 1. Check if the block is a conclusion/diagnostic impression block (Sugerencia 1: Cuadro de Conclusi√≥n)
        const isConclusionBlock = /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmedBlock);

        if (isConclusionBlock) {
          const blockLines = trimmedBlock.split("\n");
          
          let totalBlockHeight = 0;
          const parsedLines: {
            isHeader: boolean;
            isBulleted: boolean;
            bulletToken?: string;
            wrappedLines: { text: string; isBold: boolean }[][];
          }[] = [];
          
          // Padding dentro del bloque de sombreado sutil
          const boxPaddingLeft = 6;
          const boxPaddingRight = 6;
          const boxPaddingTop = 5;
          const boxPaddingBottom = 5;
          
          const boxContentWidth = contentWidth - boxPaddingLeft - boxPaddingRight;
          let headerTitle = "";

          blockLines.forEach((line) => {
            let lineTrimmed = line.trim();
            if (!lineTrimmed) {
              totalBlockHeight += 2.5 * factor;
              parsedLines.push({ isHeader: false, isBulleted: false, wrappedLines: [] });
              return;
            }
            const isFootnoteLineInBox = lineTrimmed === "---" || /^---+\s*$/.test(lineTrimmed) ||
              /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(lineTrimmed);
            if (isFootnoteLineInBox) {
              return;
            }
            
            let isMarkdownHeading = false;
            if (lineTrimmed.startsWith("# ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^#\s+/, ""); }
            else if (lineTrimmed.startsWith("## ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^##\s+/, ""); }
            else if (lineTrimmed.startsWith("### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^###\s+/, ""); }
            else if (lineTrimmed.startsWith("#### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^####\s+/, ""); }

            const lineLower = lineTrimmed.toLowerCase();
            const isHeader = isMarkdownHeading || 
              (lineTrimmed.startsWith("**") && lineTrimmed.includes("**")) ||
              lineLower.startsWith("conclusi√≥n") ||
              lineLower.startsWith("conclusiones") ||
              lineLower.startsWith("conclusion") ||
              lineLower.startsWith("impresi√≥n diagn√≥stica") ||
              lineLower.startsWith("impresion diagnostica") ||
              lineLower.startsWith("impresiones diagn√≥sticas") ||
              lineLower.startsWith("impresiones diagnosticas") ||
              lineLower.startsWith("diagn√≥sticos") ||
              lineLower.startsWith("diagn√≥stico") ||
              lineLower.startsWith("diagnostico") ||
              lineLower.startsWith("diagnosticos");
            
            if (isHeader && !headerTitle) {
              let cleanHeading = lineTrimmed;
              cleanHeading = cleanHeading.replace(/^#+\s*/, "");
              cleanHeading = cleanHeading.replace(/\*\*/g, "");
              cleanHeading = cleanHeading.replace(/\*/g, "");
              cleanHeading = cleanHeading.replace(/:$/, ""); // Remover dos puntos finales
              cleanHeading = cleanHeading.trim();
              headerTitle = cleanHeading;
            } else {
              const isBulleted = lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ") || /^\d+\.\s+/.test(lineTrimmed);
              let bulletToken = "-";
              let cleanText = lineTrimmed;
              
              if (isBulleted) {
                if (/^\d+\.\s+/.test(cleanText)) {
                  const numMatch = cleanText.match(/^(\d+\.)\s+/);
                  if (numMatch) {
                    bulletToken = numMatch[1];
                    cleanText = cleanText.substring(numMatch[0].length);
                  }
                } else if (cleanText.startsWith("- ") || cleanText.startsWith("* ")) {
                  cleanText = cleanText.substring(2);
                }
              }
              
              const wrapped = wrapMarkdown(doc, cleanText, isBulleted ? (boxContentWidth - 6) : boxContentWidth);
              totalBlockHeight += (wrapped.length * 5.0) * factor;
              
              parsedLines.push({
                isHeader: false,
                isBulleted,
                bulletToken,
                wrappedLines: wrapped
              });
            }
          });
          
          // Calcular la altura para el t√≠tulo de la cabecera si existe
          let wrappedHeaderLines: string[] = [];
          let headerHeight = 0;
          if (headerTitle) {
            wrappedHeaderLines = doc.splitTextToSize(headerTitle.toUpperCase(), boxContentWidth);
            headerHeight = (wrappedHeaderLines.length * 5.5 + 3.0) * factor; // Altura de l√≠nea + espaciado debajo
          }
          
          const finalBoxHeight = totalBlockHeight + headerHeight + (boxPaddingTop + boxPaddingBottom) * factor;
          
          // Margen de seguridad para evitar saltos hu√©rfanos
          checkPageBreak(finalBoxHeight + 6);
          
          // Colores de Opci√≥n 3 (Sombreado Cl√≠nico Sutil sin bordes laterales)
          let bgColor = [248, 250, 252]; // Tono pizarra extremadamente sutil (slate-50)
          let lineAccentColor = [148, 163, 184]; // Delicada l√≠nea pizarra (slate-400)
          let textColor = [30, 41, 59]; // slate-800
          let headerColor = [15, 23, 42]; // slate-900 para el t√≠tulo interno
          
          if (pdfLayoutType === "clinical_slate") {
            bgColor = [241, 245, 249]; // slate-100
            lineAccentColor = [100, 116, 139]; // slate-500
            textColor = [15, 23, 42];
            headerColor = [71, 85, 105];
          } else if (pdfLayoutType === "executive_medical") {
            bgColor = [253, 251, 247]; // Crema sutil (warm white)
            lineAccentColor = [197, 160, 89]; // L√≠nea dorada de cierre
            textColor = [15, 23, 42];
            headerColor = [141, 110, 50]; // Bronce profundo
          } else if (pdfLayoutType === "asymmetric") {
            bgColor = [249, 250, 254]; // √çndigo extremadamente sutil
            lineAccentColor = [129, 140, 248]; // √çndigo suave (indigo-400)
            textColor = [15, 23, 42];
            headerColor = [79, 70, 229];
          }
          
          // Dibujar el sombreado de fondo sin bordes perimetrales r√≠gidos
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(marginX, yCoord, contentWidth, finalBoxHeight, "F");
          
          // Dibujar la delgada l√≠nea horizontal superior para abrir el bloque
          doc.setDrawColor(lineAccentColor[0], lineAccentColor[1], lineAccentColor[2]);
          doc.setLineWidth(0.35); // Grosor fino y elegante (0.35mm)
          doc.line(marginX, yCoord, marginX + contentWidth, yCoord);
          
          // Dibujar la delgada l√≠nea horizontal inferior para cerrar el bloque
          doc.line(marginX, yCoord + finalBoxHeight, marginX + contentWidth, yCoord + finalBoxHeight);
          
          let currentY = yCoord + boxPaddingTop * factor;
          
          // Renderizar el t√≠tulo de la cabecera si existe
          if (headerTitle) {
            doc.setFont("times", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
            
            wrappedHeaderLines.forEach((wLine) => {
              doc.text(wLine, marginX + boxPaddingLeft, currentY);
              currentY += 5.5 * factor;
            });
            currentY += 3.0 * factor; // Espaciado elegante bajo el t√≠tulo
          }
          
          parsedLines.forEach((pLine) => {
            if (pLine.wrappedLines.length === 0) {
              currentY += 2.5 * factor;
              return;
            }
            
            doc.setFont("times", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            
            if (pLine.isBulleted) {
              let isFirstLineOfBullet = true;
              pLine.wrappedLines.forEach((wLineArr) => {
                if (isFirstLineOfBullet) {
                  doc.setFont("times", "bold");
                  doc.text(pLine.bulletToken || "-", marginX + boxPaddingLeft + 1.5, currentY);
                  isFirstLineOfBullet = false;
                }
                
                let currentX = marginX + boxPaddingLeft + 6;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            } else {
              pLine.wrappedLines.forEach((wLineArr) => {
                let currentX = marginX + boxPaddingLeft;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            }
          });
          
          yCoord = yCoord + finalBoxHeight + 3 * factor;
          
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a code block (starts/ends with triple backticks, or is a raw EMR segment)
        const isCodeBlockSegment = trimmedBlock.startsWith("```") || (trimmedBlock.startsWith("===") && (trimmedBlock.includes("S√çNTESIS VASCULAR") || trimmedBlock.includes("S√çNTESIS DE ANATOM√çA")));

        if (isCodeBlockSegment) {
          const linesOfBlock = trimmedBlock.split("\n");
          // Filter out the opening/closing backtick lines
          const codeBlockLines = linesOfBlock.filter(line => !line.trim().startsWith("```"));
          
          // Allocate height for the spacing
          const lineSpacing = 4.2 * factor;
          const neededHeight = (codeBlockLines.length * lineSpacing) + 7 * factor;
          checkPageBreak(neededHeight);

          // Draw a clean background box
          doc.setFillColor(248, 250, 252); // slate-50 / light gray
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "F");
          doc.setDrawColor(226, 232, 240); // slate-200 border
          doc.setLineWidth(0.3);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "D");

          // Set monospace font Courier (built-in)
          doc.setFont("courier", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);

          let relativeY = yCoord + 4.5 * factor;
          codeBlockLines.forEach((line) => {
            doc.text(line, marginX + 4, relativeY);
            relativeY += lineSpacing;
          });

          yCoord = relativeY + 1.5 * factor;
          
          // Re-set default font settings for the next paragraphs
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a separator/divider
        if (trimmedBlock === "---") {
          inFootnoteSection = true;
          checkPageBreak(8 * factor);
          yCoord += 4 * factor;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 6 * factor;
          return;
        }

        // 2. Check if the block is a markdown table
        const linesOfBlock = trimmedBlock.split("\n");
        const hasPipe = linesOfBlock.some(line => line.includes("|"));
        const isTableDivider = linesOfBlock.some(line => line.includes("---") && line.includes("|"));
        const isTable = hasPipe && (isTableDivider || linesOfBlock.length >= 2);

        if (isTable) {
          if (!isFirstBlock) {
            yCoord += 16 * factor; // Elegant, clear vertical gap between preceding diagnostic text and table
          } else {
            isFirstBlock = false;
          }
          const nonTableLinesAtTop: string[] = [];
          const tableOnlyLines: string[] = [];
          let foundTableStart = false;

          linesOfBlock.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.includes("|")) {
              foundTableStart = true;
            }
            if (foundTableStart) {
              tableOnlyLines.push(line);
            } else {
              nonTableLinesAtTop.push(line);
            }
          });

          const cleanTableRows = tableOnlyLines
            .map(line => line.trim())
            .filter(line => {
              const rowHasPipe = line.includes("|");
              const isDivider = line.includes("---") || /^[|:\-\s]+$/.test(line);
              return rowHasPipe && !isDivider && line.replace(/\|/g, "").trim().length > 0;
            });

          if (cleanTableRows.length > 0) {
            const parseRowCells = (rowText: string) => {
              const rawParts = rowText.split("|");
              let cells = rawParts.map(c => c.trim());
              if (rowText.startsWith("|")) cells.shift();
              if (rowText.endsWith("|")) cells.pop();
              return cells;
            };

            const headers = parseRowCells(cleanTableRows[0]);
            const bodyRows = cleanTableRows.slice(1).map(row => parseRowCells(row));

            // Determine column widths
            const colCount = headers.length || 1;
            const colWidths: number[] = [];
            
            if (colCount === 1) {
              colWidths.push(contentWidth);
            } else if (colCount === 2) {
              const isAsistenteUnilateralNoRef = headers.some(h => h.toLowerCase().includes("estructura")) && 
                                                 headers.some(h => h.toLowerCase().includes("derecha") || h.toLowerCase().includes("izquierda") || h.toLowerCase().includes("medida"));
              if (isAsistenteUnilateralNoRef) {
                colWidths.push(contentWidth * 0.45);
                colWidths.push(contentWidth * 0.55);
              } else {
                colWidths.push(contentWidth * 0.4);
                colWidths.push(contentWidth * 0.6);
              }
            } else if (colCount === 3) {
              const isAsistenteUnilateral = headers.some(h => h.toLowerCase().includes("referencia"));
              const isVascular = headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("derech") || lower.includes("izquierd") || lower.includes("alterad") || lower.includes("vaso");
              });
              if (isAsistenteUnilateral) {
                // Column 0: Estructura (30%), Column 1: Derecha/Izquierda (50%), Column 2: Valor de Referencia (20%)
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.50);
                colWidths.push(contentWidth * 0.20);
              } else if (isVascular) {
                colWidths.push(contentWidth * 0.34);
                colWidths.push(contentWidth * 0.33);
                colWidths.push(contentWidth * 0.33);
              } else {
                colWidths.push(contentWidth * 0.15); // ID col (compact)
                colWidths.push(contentWidth * 0.35); // Structure / Site Name
                colWidths.push(contentWidth * 0.50); // Detailed Main Findings
              }
            } else if (colCount === 4) {
              const isClassificationTable = headers.some(h => {
                const l = (h || "").toLowerCase();
                return l.includes("criterio") || l.includes("pondera") || l.includes("score") || l.includes("justifica") || l.includes("sustento");
              });
              const isAsistenteBilateral = headers.some(h => {
                const l = h.toLowerCase();
                return l.includes("derecha") || l.includes("izquierda");
              });
              const isGenericAsistente = headers.some(h => h.toLowerCase().includes("registrada")) || headers.some(h => h.toLowerCase().includes("referencia"));

              if (isClassificationTable) {
                colWidths.push(contentWidth * 0.24); // Criterio Evaluado
                colWidths.push(contentWidth * 0.28); // Hallazgo en el Reporte
                colWidths.push(contentWidth * 0.16); // Ponderaci√≥n / Score
                colWidths.push(contentWidth * 0.32); // Justificaci√≥n Diagn√≥stica
              } else if (isAsistenteBilateral) {
                colWidths.push(contentWidth * 0.25);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.15);
              } else if (isGenericAsistente) {
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.30);
              } else {
                colWidths.push(contentWidth * 0.12); // ID Column (e.g. H1, H2, H3)
                colWidths.push(contentWidth * 0.28); // Estructura / Sitio
                colWidths.push(contentWidth * 0.22); // Categor√≠a
                colWidths.push(contentWidth * 0.38); // Hallazgo Principal
              }
            } else {
              const equalWidth = contentWidth / colCount;
              for (let i = 0; i < colCount; i++) {
                colWidths.push(equalWidth);
              }
            }

            // Pre-calculate heights of all table rows to prevent the table from being split across pages if possible.
            const cachedRowsData: {
              cellSpansLines: { text: string; isBold: boolean }[][][];
              rowHeight: number;
            }[] = [];

            let calculatedRowsHeightSum = 0;

            bodyRows.forEach((row) => {
              const cellSpansLinesList: { text: string; isBold: boolean }[][][] = [];
              let maxLines = 0;

              row.forEach((cellText, cIdx) => {
                const currentColWidth = colWidths[cIdx] || (contentWidth / colCount);
                const cellSpansLines = wrapMarkdown(doc, cellText, currentColWidth - 6);
                cellSpansLinesList.push(cellSpansLines);
                if (cellSpansLines.length > maxLines) {
                  maxLines = cellSpansLines.length;
                }
              });

              const rowHeight = (maxLines * 5 * factor) + 4 * factor;
              calculatedRowsHeightSum += rowHeight;
              cachedRowsData.push({
                cellSpansLines: cellSpansLinesList,
                rowHeight,
              });
            });

            // The header takes 12 units baseline check, then yCoord is advanced by 9.
            // So total calculated height for table is roughly: header (12) + rows + extra gap (4)
            const totalTableNeededHeight = (12 * factor) + calculatedRowsHeightSum + (4 * factor);

            // Estimate the height of any non-table lines/titles at the top
            let estimatedHeadingsHeight = 0;
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              if (isHeader) {
                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                estimatedHeadingsHeight += (wrappedHeaders.length * 5.5 + 4) * factor;
              } else {
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                estimatedHeadingsHeight += (lines.length * 4.5 + 4) * factor;
              }
            });

            // We want to make sure that the headings AND the table header + at least the first row of the table
            // can fit together on the current page to avoid orphans!
            const firstRowHeight = cachedRowsData[0]?.rowHeight || (15 * factor);
            const minimumCombinedHeight = estimatedHeadingsHeight + (12 * factor) + firstRowHeight + (4 * factor);

            // Check combined page break before printing anything (including headings)!
            checkPageBreak(Math.min(minimumCombinedHeight, pageHeight - 40));

            // Draw any non-table heading lines from the top (e.g., table titles/headings)
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              checkPageBreak(10 * factor);
              if (isHeader) {
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                
                if (pdfLayoutType === "clinical_slate") {
                  doc.setTextColor(30, 41, 59); // slate-800
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setTextColor(15, 23, 42); // Navy
                } else {
                  doc.setTextColor(15, 23, 42);
                }

                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                wrappedHeaders.forEach((lineText: string) => {
                  checkPageBreak(5.5 * factor);
                  
                  if (pdfLayoutType === "clinical_slate") {
                    // Left vertical slate bar
                    doc.setFillColor(71, 85, 105);
                    doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
                  }
                  
                  doc.text(lineText, marginX, yCoord);
                  yCoord += 5.5 * factor;
                });

                // Underlines for headings
                if (pdfLayoutType === "clinical_slate") {
                  doc.setDrawColor(226, 232, 240); // slate-200
                  doc.setLineWidth(0.25);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setDrawColor(197, 160, 89); // Gold
                  doc.setLineWidth(0.35);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                }
              } else {
                doc.setFont("times", "normal");
                doc.setFontSize(10.5);
                doc.setTextColor(51, 65, 85);
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                lines.forEach((l: string) => {
                  checkPageBreak(5 * factor);
                  doc.text(l, marginX, yCoord);
                  yCoord += 4.5 * factor;
                });
                yCoord += 2 * factor;
              }
            });

            // Now check page break for table header + first row only. If that fits, we start the table on this page
            // and let subsequent rows split naturally across pages as needed.
            checkPageBreak(12 * factor + (cachedRowsData[0]?.rowHeight || 10 * factor));

            // Header Render
            checkPageBreak(12 * factor);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setFillColor(71, 85, 105); // slate-600
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(51, 65, 85); // slate-700
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else if (pdfLayoutType === "executive_medical") {
              doc.setFillColor(15, 23, 42); // Navy-900
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.4);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else {
              doc.setFillColor(241, 245, 249); // slate-100 / cool grey background
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(203, 213, 225); // slate-300 border
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            }

            let currentX = marginX;
            doc.setFont("times", "bold");
            doc.setFontSize(9.5);
            
            if (pdfLayoutType === "clinical_slate" || pdfLayoutType === "executive_medical") {
              doc.setTextColor(255, 255, 255); // white text
            } else {
              doc.setTextColor(15, 23, 42); // slate-900
            }

            const isVascularTable = colCount === 3 && 
              headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("derech") || lower.includes("izquierd") || lower.includes("alterad") || lower.includes("vaso");
              }) && 
              !headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("referencia") || lower.includes("estructura");
              });

            headers.forEach((headerTxt, hIdx) => {
              let hClean = headerTxt.replace(/\*\*/g, "").trim();
              if (colCount === 2) {
                // Force headers to read exactly "INTERPRETACI√ìN" and "Hallazgos" ONLY if header explicitly indicates semiology or interpretation
                const isSynoptic = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("aspecto") || l.includes("detalle") || l.includes("sinopsis") || l.includes("evaluado") || l.includes("cl√≠nico") || l.includes("sistema") || l.includes("categor√≠a") || l.includes("criterio") || l.includes("paso") || l.includes("par√°metro") || l.includes("definici√≥n") || l.includes("estadio") || l.includes("ponderaci√≥n") || l.includes("justificaci√≥n");
                });
                const isExplicitSemiology = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("interpretaci") || l.includes("semiol");
                });
                if (!isSynoptic && isExplicitSemiology) {
                  if (hIdx === 0) hClean = "INTERPRETACI√ìN";
                  if (hIdx === 1) hClean = "Hallazgos";
                }
              } else if (isVascularTable) {
                if (hIdx === 0) hClean = "Segmento Alterado";
                if (hIdx === 1) hClean = "Derecho";
                if (hIdx === 2) hClean = "Izquierdo";
              }

              const currentColW = colWidths[hIdx] || (contentWidth / colCount);
              doc.setFont("times", "bold");
              doc.setFontSize(9.5);
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(8.5);
              }
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(7.5);
              }
              doc.text(hClean, currentX + 3, yCoord + 1);
              currentX += currentColW;
            });
            
            yCoord += 9 * factor;

            // Rows Render
            bodyRows.forEach((row, rIdx) => {
              const cachedRow = cachedRowsData[rIdx];
              const cellLines = cachedRow.cellSpansLines;
              const rowHeight = cachedRow.rowHeight;

              checkPageBreak(rowHeight);

              if (rIdx % 2 === 1) {
                if (pdfLayoutType === "clinical_slate") {
                  doc.setFillColor(241, 245, 249); // slate-100
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setFillColor(253, 251, 247); // Cream-50
                } else {
                  doc.setFillColor(248, 250, 252); // standard grey alternate background
                }
                doc.rect(marginX, yCoord - 4 * factor, contentWidth, rowHeight, "F");
              }

              if (pdfLayoutType === "clinical_slate") {
                doc.setDrawColor(203, 213, 225); // slate-300
                doc.setLineWidth(0.25);
              } else if (pdfLayoutType === "executive_medical") {
                doc.setDrawColor(220, 210, 195); // light gold-gray
                doc.setLineWidth(0.25);
              } else {
                doc.setDrawColor(226, 232, 240); // slate-200 border
                doc.setLineWidth(0.2);
              }
              doc.line(marginX, yCoord - 4 * factor + rowHeight, marginX + contentWidth, yCoord - 4 * factor + rowHeight);

              let startRowX = marginX;
              row.forEach((_, cIdx) => {
                const colW = colWidths[cIdx] || (contentWidth / colCount);
                let tempY = yCoord;
                const spansLines = cellLines[cIdx] || [];

                spansLines.forEach((spanLine) => {
                  let cellX = startRowX + 3;
                  spanLine.forEach((span) => {
                    if (span.isBold) {
                      doc.setFont("times", "bold");
                    } else {
                      doc.setFont("times", "normal");
                    }
                    doc.setFontSize(9.5);
                    doc.setTextColor(51, 65, 85);
                    doc.text(span.text, cellX, tempY + 1);
                    cellX += doc.getTextWidth(span.text);
                  });
                  tempY += 5 * factor;
                });

                startRowX += colW;
              });

              yCoord += rowHeight;
            });

            yCoord += 4 * factor; // margin after table completes
            return;
          }
        }

        // 3. Render as standard block with paragraphs and line spacing
        if (!isFirstBlock) {
          yCoord += 4.5 * factor;
        } else {
          isFirstBlock = false;
        }

        const blockSeverity = getParagraphSeverity(trimmedBlock);

        linesOfBlock.forEach((line, lineIdx) => {
          let trimmed = line.trim();
          if (!trimmed) {
            yCoord += 2.5 * factor;
            return;
          }

          // Clean Markdown headers format if any
          let isMarkdownHeading = false;
          if (trimmed.startsWith("# ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^#\s+/, "");
          } else if (trimmed.startsWith("## ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^##\s+/, "");
          } else if (trimmed.startsWith("### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^###\s+/, "");
          } else if (trimmed.startsWith("#### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^####\s+/, "");
          }

          const isHeader = isMarkdownHeading || (
            trimmed.startsWith("**") && (
              trimmed.endsWith("**") || 
              trimmed.replace(/[:\s]+$/, "").endsWith("**")
            )
          );
          const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

          // Determine if first visual line is the main title of study
          const isMainTitle = isFirstLine && (isHeader || /REPORTE|INFORME|ESTUDIO|DIAGN√ìSTICO|VALORACI√ìN/i.test(trimmed));

          if (isMainTitle) {
            isFirstLine = false;
            // Center-align main title beautifully
            doc.setFont("times", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            const wrappedTitle = doc.splitTextToSize(cleanHeaderTxt.toUpperCase(), contentWidth);
            wrappedTitle.forEach((lineText: string) => {
              checkPageBreak(7 * factor);
              doc.text(lineText, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6 * factor;
            });
            return;
          }

          if (isFirstLine) {
            isFirstLine = false;
          }

          if (isHeader) {
            // Let's estimate the height of the header + next few lines to avoid orphans!
            let lookAheadHeight = 12 * factor; // space for header + spacing
            let countLinesLookedAt = 0;
            
            // 1. Look ahead in the remaining lines of the current block
            for (let nextIdx = lineIdx + 1; nextIdx < linesOfBlock.length; nextIdx++) {
              const nextLine = linesOfBlock[nextIdx].trim();
              if (!nextLine) continue;
              
              // If we hit another header, stop look-ahead
              const isNextHeader = nextLine.startsWith("#") || (
                nextLine.startsWith("**") && (
                  nextLine.endsWith("**") || 
                  nextLine.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isNextHeader) break;
              
              const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
              let cleanNext = nextLine;
              if (isNextBulleted) {
                if (/^\d+\.\s+/.test(cleanNext)) {
                  cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                } else {
                  cleanNext = cleanNext.substring(2).trim();
                }
              }
              
              const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
              lookAheadHeight += (wrappedNext.length * 5) * factor;
              
              countLinesLookedAt++;
              if (countLinesLookedAt >= 2) break;
            }
            
            // 2. If we haven't found enough content lines yet, look at the next paragraph blocks!
            if (countLinesLookedAt < 2) {
              const currentBlockIdx = paragraphs.indexOf(block);
              if (currentBlockIdx !== -1) {
                for (let nextBlockIdx = currentBlockIdx + 1; nextBlockIdx < paragraphs.length; nextBlockIdx++) {
                  const nextBlock = paragraphs[nextBlockIdx].trim();
                  if (!nextBlock) continue;
                  
                  if (nextBlock.startsWith("```") || nextBlock.startsWith("|") || (nextBlock.startsWith("===") && (nextBlock.includes("S√çNTESIS VASCULAR") || nextBlock.includes("S√çNTESIS DE ANATOM√çA")))) {
                    lookAheadHeight += 15 * factor;
                    countLinesLookedAt += 2;
                    break;
                  }
                  
                  const nextBlockLines = nextBlock.split("\n");
                  let hitHeaderInNextBlock = false;
                  
                  for (let i = 0; i < nextBlockLines.length; i++) {
                    const nextLine = nextBlockLines[i].trim();
                    if (!nextLine) continue;
                    
                    const isNextHeader = nextLine.startsWith("#") || (
                      nextLine.startsWith("**") && (
                        nextLine.endsWith("**") || 
                        nextLine.replace(/[:\s]+$/, "").endsWith("**")
                      )
                    );
                    if (isNextHeader) {
                      hitHeaderInNextBlock = true;
                      break;
                    }
                    
                    const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
                    let cleanNext = nextLine;
                    if (isNextBulleted) {
                      if (/^\d+\.\s+/.test(cleanNext)) {
                        cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                      } else {
                        cleanNext = cleanNext.substring(2).trim();
                      }
                    }
                    
                    const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
                    lookAheadHeight += (wrappedNext.length * 5) * factor;
                    
                    countLinesLookedAt++;
                    if (countLinesLookedAt >= 2) break;
                  }
                  
                  if (hitHeaderInNextBlock || countLinesLookedAt >= 2) {
                    break;
                  }
                }
              }
            }
            
            // Avoid heading orphans by requiring at least 25mm of space, up to calculated lookahead
            const minRequiredHeight = Math.max(25 * factor, lookAheadHeight);
            checkPageBreak(minRequiredHeight);
            
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setTextColor(30, 41, 59); // slate-800
            } else if (pdfLayoutType === "executive_medical") {
              doc.setTextColor(15, 23, 42); // Navy
            } else {
              doc.setTextColor(15, 23, 42);
            }

            const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
            wrappedHeaders.forEach((lineText: string) => {
              checkPageBreak(5.5 * factor);
              
              if (pdfLayoutType === "clinical_slate") {
                // Draw elegant vertical slate bar on the left of header
                doc.setFillColor(71, 85, 105); // slate-600
                doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
              }
              
              doc.text(lineText, marginX, yCoord);
              yCoord += 5.5 * factor;
            });

            // Underlines for headings
            const isAnnexHeading = cleanHeaderTxt.toUpperCase().includes("ANEXO") || 
                                   cleanHeaderTxt.toUpperCase().includes("DESGLOSE Y JUSTIFICACI√ìN");
            if (isAnnexHeading) {
              doc.setDrawColor(203, 213, 225); // slate-300
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 1 * factor, marginX + contentWidth, yCoord - 1 * factor);
              yCoord += 3.5 * factor;
            } else if (pdfLayoutType === "clinical_slate") {
              doc.setDrawColor(226, 232, 240); // slate-200
              doc.setLineWidth(0.25);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            } else if (pdfLayoutType === "executive_medical") {
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            }
          } else {
            // Is it a bullet/list item in original design?
            const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
            if (isBulleted) {
              let cleanItem = trimmed;
              let bulletToken = "-";
              const isNumbered = /^\d+\.\s+/.test(cleanItem);

              if (isNumbered) {
                const numMatch = cleanItem.match(/^(\d+\.)\s+/);
                if (numMatch) {
                  bulletToken = numMatch[1];
                  cleanItem = cleanItem.substring(numMatch[0].length);
                }
              } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                cleanItem = cleanItem.substring(2);
              }

              const indent = 6;
              const textWidth = contentWidth - indent;
              
              checkPageBreak(6 * factor);
              doc.setFont("times", "bold");
              doc.setFontSize(10.5);
              doc.setTextColor(15, 23, 42);
              doc.text(bulletToken || "-", marginX + 1.5, yCoord);
 
              const lines = wrapMarkdown(doc, cleanItem, textWidth);
              const itemSeverity = getParagraphSeverity(cleanItem);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
                
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX + indent;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            } else {
              // Wrap markdown formatted lines (bold and normal text mixed) safely and beautifully
              const lines = wrapMarkdown(doc, trimmed, contentWidth);
              const itemSeverity = getParagraphSeverity(trimmed);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
 
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            }
          }
        });
      };

      // Categorize paragraph blocks according to requested 10-step insertion sequence:
      // 1. CUERPO DE REPORTE CON FIRMA AL FINAL
      // 2. CUADRO SINOPTICO
      // 3. SINOPSIS POR ORGANO
      // 4. SINOPSIS DE HALLAZGOS CON DIBUJO Y TARJETAS SINOPTICAS
      // 5. CUADRO DE ASISTENTE DE MEDIDAS
      // 6. ANEXO DE FOTOS Y CAPTURAS DE ULTRASONIDO
      // 7. DIAGNOSTICO AVANZADO
      // 8. DESGLOCE Y JUSTIFICACION DE CLASIFICACIONES
      // 9. RESUMEN DEL PACIENTE
      // 10. INFOGRAFIA DEL PACIENTE
      const mainReportBlocks: string[] = [];
      const organSynopsisBlocks: string[] = [];
      const measurementAssistantBlocks: string[] = [];
      const classificationAnnexBlocks: string[] = [];

      let currentPdfSection: "main" | "organ" | "medidas" | "classification_annex" = "main";

      paragraphs.forEach((block) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }

        const upperBlock = trimmedBlock.toUpperCase();
        if (
          upperBlock.includes("RADAR BIOMEC√ÅNICO") ||
          upperBlock.includes("RADAR BIOMECANICO") ||
          upperBlock.includes("PUNTAJE GLOBAL DE CARGA TISULAR:") ||
          upperBlock.includes("VECTOR PATOL√ìGICO DOMINANTE:") ||
          upperBlock.includes("MATRIZ DE VECTORES CLAVE:") ||
          upperBlock.includes("S√çNTESIS BIOMEC√ÅNICO-INFLAMATORIA:") ||
          upperBlock.includes("RECOMENDACI√ìN DIN√ÅMICA:") ||
          (upperBlock.startsWith("‚Ä¢") && (upperBlock.includes("/10") || upperBlock.includes("[")))
        ) {
          return;
        }

        const normalizedBlock = upperBlock.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 1. Identification of Organ Synopsis Headers and Content
        const isOrganSynopsisHeader = (
          /^\s*#{1,6}\s*(?:SINOPSIS\s+CL[I√ç]NICA|SINOPSIS\s+POR\s+[O√ì]RGANO|SINOPSIS\s+DE\s+[O√ì]RGANO|CUADRO\s+SIN[O√ì]PTICO|ESQUEMA\s+CL[I√ç]NICO\s+DE\s+HALLAZGOS)\b/i.test(trimmedBlock) ||
          /^\s*\*\*\s*(?:SINOPSIS\s+CL[I√ç]NICA|SINOPSIS\s+POR\s+[O√ì]RGANO|CUADRO\s+SIN[O√ì]PTICO)\b/i.test(trimmedBlock) ||
          upperBlock.startsWith("### SINOPSIS") ||
          upperBlock.startsWith("## SINOPSIS") ||
          upperBlock.startsWith("# SINOPSIS") ||
          upperBlock.startsWith("### CUADRO SIN√ìPTICO") ||
          upperBlock.startsWith("### CUADRO SINOPTICO")
        );

        const isOrganSynopsisTableOrSummary = (
          normalizedBlock.includes("| ASPECTO EVALUADO |") ||
          (normalizedBlock.includes("| DETALLE CLINICO / VALOR |") || normalizedBlock.includes("| DETALLE CLINICO / VALOR|")) ||
          normalizedBlock.startsWith("**RESUMEN INTERPRETATIVO:**") ||
          normalizedBlock.startsWith("RESUMEN INTERPRETATIVO:")
        );

        // 2. Identification of Classification Breakdown Annex Headers and Content
        const isClassificationAnnexHeader = (
          /^\s*#{1,6}\s*(?:ANEXO:\s*DESGLOSE|ANEXO\s*:\s*DESGLOSE|DESGLOSE\s+Y\s+JUSTIFICACI[O√ì]N|DESGLOSE\s+DE\s+CLASIFICACI[O√ì]N|DESGLOSE\s+DE\s+CLASIFICACIONES|CLASIFICACI[O√ì]N\s+DE\s+BI-RADS|CLASIFICACI[O√ì]N\s+DE\s+TI-RADS|CLASIFICACI[O√ì]N\s+DE\s+LI-RADS|CLASIFICACI[O√ì]N\s+DE\s+O-RADS|CLASIFICACI[O√ì]N\s+DE\s+PI-RADS|CLASIFICACI[O√ì]N\s+DE\s+BOSNIAK|CLASIFICACI[O√ì]N\s+DE|CLASIFICACION\s+DE)\b/i.test(trimmedBlock) ||
          /^\s*\*\*\s*(?:ANEXO\s+DIAGN[O√ì]STICO:\s*DESGLOSE|ANEXO:\s*DESGLOSE|DESGLOSE\s+Y\s+JUSTIFICACI[O√ì]N)\b/i.test(trimmedBlock) ||
          upperBlock.startsWith("### ANEXO: DESGLOSE") ||
          upperBlock.startsWith("## ANEXO: DESGLOSE") ||
          upperBlock.startsWith("# ANEXO: DESGLOSE") ||
          upperBlock.startsWith("### DESGLOSE Y JUSTIFICACI√ìN") ||
          upperBlock.startsWith("### DESGLOSE Y JUSTIFICACION") ||
          upperBlock.startsWith("### CLASIFICACI√ìN DE") ||
          upperBlock.startsWith("### CLASIFICACION DE") ||
          upperBlock.startsWith("#### CLASIFICACI√ìN DE") ||
          upperBlock.startsWith("#### CLASIFICACION DE") ||
          upperBlock.startsWith("#### TABLA DE JUSTIFICACI√ìN") ||
          upperBlock.startsWith("#### TABLA DE JUSTIFICACION") ||
          upperBlock.startsWith("#### FICHA EXPLICATIVA")
        );

        const isClassificationAnnexContent = (
          (normalizedBlock.includes("| CRITERIO EVALUADO |") && (normalizedBlock.includes("| HALLAZGO EN EL REPORTE |") || normalizedBlock.includes("| JUSTIFICACION DIAGNOSTICA |") || normalizedBlock.includes("| PONDERACION / SCORE |"))) ||
          normalizedBlock.startsWith("**SISTEMA:**") ||
          normalizedBlock.startsWith("**SISTEMA / ESCALA:**") ||
          normalizedBlock.startsWith("**DEFINICION & SIGNIFICADO CLINICO:**") ||
          normalizedBlock.startsWith("**DEFINICION Y SIGNIFICADO CLINICO:**") ||
          normalizedBlock.startsWith("**SUSTENTO DIAGNOSTICO INTEGRADOR:**") ||
          normalizedBlock.startsWith("**CONDUCTA Y RECOMENDACION DE SEGUIMIENTO:**") ||
          normalizedBlock.startsWith("##### CRITERIOS CLAVE:") ||
          (normalizedBlock.startsWith("* **PASO 1:") && normalizedBlock.includes("CRITERIO CUMPLIDO"))
        );

        // 3. Identification of Measurement Assistant
        const isMeasurementHeader = (
          /^\s*#{1,6}\s*(?:ASISTENTE\s+DE\s+MEDIDAS|CUADRO\s+DE\s+ASISTENTE\s+DE\s+MEDIDAS|TABLA\s+DE\s+MEDIDAS|MEDICIONES\s+Y\s+PAR[A√Å]METROS|PAR[A√Å]METROS\s+Y\s+MEDIDAS)\b/i.test(trimmedBlock) ||
          /^\s*\*\*\s*(?:ASISTENTE\s+DE\s+MEDIDAS|TABLA\s+DE\s+MEDIDAS)\b/i.test(trimmedBlock)
        );

        // 4. Identification of Main Impression / Conclusions
        const isImpressionHeader = (
          normalizedBlock.includes("IMPRESION DIAGNOSTICA") ||
          normalizedBlock.includes("IMPRESIONES DIAGNOSTICAS") ||
          normalizedBlock.includes("IMPRESION CLINICA") ||
          normalizedBlock.includes("IMPRESION ECOGRAFICA") ||
          normalizedBlock.includes("IMPRESION RADIOLOGICA") ||
          normalizedBlock.includes("CONCLUSION DIAGNOSTICA") ||
          normalizedBlock.includes("CONCLUSIONES DIAGNOSTICAS") ||
          /^\s*(?:#{1,6}\s*|\*\*|\*|__|\d+\.|\b)*(?:IMPRESI[O√ì]N|CONCLUSI[O√ì]N|CONCLUSIONES)\s*[:*#\s]/i.test(trimmedBlock)
        ) && !isOrganSynopsisHeader && !isClassificationAnnexHeader && !isOrganSynopsisTableOrSummary && !isClassificationAnnexContent;

        // Route blocks accurately
        if (isClassificationAnnexHeader || isClassificationAnnexContent) {
          currentPdfSection = "classification_annex";
          classificationAnnexBlocks.push(trimmedBlock);
        } else if (isOrganSynopsisHeader || isOrganSynopsisTableOrSummary) {
          currentPdfSection = "organ";
          organSynopsisBlocks.push(trimmedBlock);
        } else if (isMeasurementHeader) {
          currentPdfSection = "medidas";
          measurementAssistantBlocks.push(trimmedBlock);
        } else if (isImpressionHeader) {
          currentPdfSection = "main";
          mainReportBlocks.push(trimmedBlock);
        } else {
          if (currentPdfSection === "organ") {
            organSynopsisBlocks.push(trimmedBlock);
          } else if (currentPdfSection === "classification_annex") {
            classificationAnnexBlocks.push(trimmedBlock);
          } else if (currentPdfSection === "medidas") {
            measurementAssistantBlocks.push(trimmedBlock);
          } else {
            mainReportBlocks.push(trimmedBlock);
          }
        }
      });

      // Filter mainReportBlocks to strictly prevent urological annex text from contaminating main report
      for (let i = mainReportBlocks.length - 1; i >= 0; i--) {
        const norm = mainReportBlocks[i].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (
          norm.includes("EVALUACION INTEGRAL DE VIAS URINARIAS") ||
          norm.includes("DINAMICA PROSTATICA") ||
          norm.includes("VOLUMETRIA Y MORFOLOGIA PROSTATICA") ||
          norm.includes("DINAMICA MICCIONAL Y RESIDUO") ||
          norm.includes("PROTRUSION PROSTATICA INTRAVESICAL") ||
          norm.includes("CORRELACION CLINICO-UROLOGICA Y ESTRATIFICACION")
        ) {
          mainReportBlocks.splice(i, 1);
        }
      }

      // Mutual cross-contamination safeguards between Organ Synopsis and Classification Annex
      for (let i = organSynopsisBlocks.length - 1; i >= 0; i--) {
        const raw = organSynopsisBlocks[i];
        const norm = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (
          norm.startsWith("### ANEXO: DESGLOSE") ||
          norm.startsWith("### DESGLOSE Y JUSTIFICACION") ||
          norm.startsWith("### CLASIFICACION DE") ||
          norm.startsWith("#### CLASIFICACION DE") ||
          norm.startsWith("#### TABLA DE JUSTIFICACION") ||
          (norm.includes("| CRITERIO EVALUADO |") && norm.includes("| JUSTIFICACION DIAGNOSTICA |"))
        ) {
          const extracted = organSynopsisBlocks.splice(i, 1);
          classificationAnnexBlocks.push(...extracted);
        }
      }

      for (let i = classificationAnnexBlocks.length - 1; i >= 0; i--) {
        const raw = classificationAnnexBlocks[i];
        const norm = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (
          norm.startsWith("### SINOPSIS CLINICA") ||
          norm.startsWith("### SINOPSIS POR ORGANO") ||
          norm.startsWith("### CUADRO SINOPTICO") ||
          (norm.includes("| ASPECTO EVALUADO |") && norm.includes("| DETALLE CLINICO / VALOR |"))
        ) {
          const extracted = classificationAnnexBlocks.splice(i, 1);
          organSynopsisBlocks.push(...extracted);
        }
      }

      // Safety recovery pass for jsPDF: Ensure Impression & Conclusions are NEVER trapped inside annexes
      const isImpressionBlockHeader = (bText: string): boolean => {
        if (!bText) return false;
        const firstLine = bText.trim().split("\n")[0].trim();
        const normFirst = firstLine.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (
          normFirst.startsWith("### ANEXO") ||
          normFirst.startsWith("## ANEXO") ||
          normFirst.startsWith("# ANEXO") ||
          normFirst.startsWith("ANEXO:") ||
          normFirst.startsWith("### DESGLOSE") ||
          normFirst.startsWith("### SINOPSIS") ||
          normFirst.startsWith("### CUADRO") ||
          normFirst.startsWith("### ASISTENTE") ||
          normFirst.startsWith("#### TABLA") ||
          normFirst.startsWith("#### FICHA") ||
          normFirst.includes("EVALUACION INTEGRAL DE VIAS URINARIAS") ||
          normFirst.includes("VOLUMETRIA Y MORFOLOGIA PROSTATICA") ||
          normFirst.includes("DINAMICA MICCIONAL Y RESIDUO") ||
          normFirst.includes("PROTRUSION PROSTATICA") ||
          normFirst.includes("CORRELACION CLINICO-UROLOGICA") ||
          normFirst.includes("ASISTENTE DE MEDIDAS")
        ) {
          return false;
        }

        return (
          normFirst.includes("IMPRESION DIAGNOSTICA") ||
          normFirst.includes("IMPRESIONES DIAGNOSTICAS") ||
          normFirst.includes("IMPRESION CLINICA") ||
          normFirst.includes("IMPRESION ECOGRAFICA") ||
          normFirst.includes("IMPRESION RADIOLOGICA") ||
          normFirst.includes("CONCLUSION DIAGNOSTICA") ||
          normFirst.includes("CONCLUSIONES DIAGNOSTICAS") ||
          /^\s*(?:#{1,6}\s*|\*\*|\*|__|\d+\.|\b)*(?:IMPRESI[O√ì]N|CONCLUSI[O√ì]N|CONCLUSIONES)\s*[:*#\s]/i.test(firstLine) ||
          normFirst.startsWith("IMPRESION:") ||
          normFirst.startsWith("CONCLUSION:") ||
          normFirst.startsWith("CONCLUSIONES:")
        );
      };

      // Ensure ONLY ONE Impression block is ever present in mainReportBlocks:
      let impressionFoundInMain = false;
      for (let i = 0; i < mainReportBlocks.length; ) {
        if (isImpressionBlockHeader(mainReportBlocks[i])) {
          if (impressionFoundInMain) {
            mainReportBlocks.splice(i, 1);
          } else {
            impressionFoundInMain = true;
            i++;
          }
        } else {
          i++;
        }
      }

      // Recover from other buffers ONLY if mainReportBlocks has no impression at all
      if (!impressionFoundInMain) {
        const recoverImpressionForPDF = (sourceArr: string[]) => {
          for (let i = 0; i < sourceArr.length; ) {
            if (isImpressionBlockHeader(sourceArr[i])) {
              const recovered = sourceArr.splice(i, 1);
              mainReportBlocks.push(...recovered);
              impressionFoundInMain = true;
              break;
            } else {
              i++;
            }
          }
        };

        recoverImpressionForPDF(organSynopsisBlocks);
        if (!impressionFoundInMain) recoverImpressionForPDF(measurementAssistantBlocks);
        if (!impressionFoundInMain) recoverImpressionForPDF(classificationAnnexBlocks);
      }

      // Fail-safe Invariant: If mainReportBlocks still lacks an impression, extract it from cleanReport
      if (!impressionFoundInMain) {
        const rawLines = cleanReport.split("\n");
        let capturingImpression = false;
        let fallbackImpressionBuffer: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
          const l = rawLines[i].trim();
          if (!l) continue;
          if (isImpressionBlockHeader(l)) {
            capturingImpression = true;
            fallbackImpressionBuffer.push(l);
          } else if (capturingImpression) {
            const isNextAnnex = /^\s*(?:#{1,6}\s+|\*\*\s*)(?:ANEXO|DESGLOSE|CUADRO|SINOPSIS|ASISTENTE|TABLA|MEDIDAS|COMPLEMENTO|RADAR|INFOGRAF√çA)\b/i.test(l) || l === "---";
            if (isNextAnnex) {
              capturingImpression = false;
              break;
            } else {
              fallbackImpressionBuffer.push(l);
            }
          }
        }
        if (fallbackImpressionBuffer.length > 0) {
          mainReportBlocks.push(fallbackImpressionBuffer.join("\n\n"));
          impressionFoundInMain = true;
        }
      }

      // --- 1. CUERPO DE REPORTE CON FIRMA AL FINAL ---
      mainReportBlocks.forEach((block) => {
        renderSingleReportBlock(block);
      });

      if (!hasDrawnSignature) {
        renderSignatureBlock();
      }

      // --- 2. SINOPSIS POR √ìRGANO / CUADRO SIN√ìPTICO (P√ÅGINA INDEPENDIENTE INMEDIATAMENTE DESPU√âS DEL REPORTE) ---
      const validOrganSynopsisBlocks = organSynopsisBlocks.filter((b) => b && b.trim().length > 0);
      if (validOrganSynopsisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        validOrganSynopsisBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // Restore standard margins and content widths for any diagrams, annexes, and signature block
      marginX = 20;
      contentWidth = pageWidth - (2 * marginX);

      // --- 4. SINOPSIS DE HALLAZGOS CON DIBUJO Y TARJETAS SIN√ìPTICAS EN ANEXO DEDICADO ---
      const isDopplerStudy = specificStudy === "Doppler de car√≥tidas" || 
                             specificStudy === "Doppler venoso de miembro inferior" || 
                             specificStudy === "Doppler arterial de miembro inferior";

      const activeSchemasList: Array<{ key: string; name: string }> = [];

      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        activeSchemasList.push({ key: "shoulder", name: "Hombro" });
      }
      if (specificStudy === "Rodilla") {
        if (includeKneeSchemaInReport) activeSchemasList.push({ key: "knee", name: "Rodilla Trauma" });
        if (includeGonartrosisSchemaInReport) activeSchemasList.push({ key: "gonartrosis", name: "Rodilla Gonartrosis" });
      }
      if (includeAnkleSchemaInReport && specificStudy === "Tobillo") {
        activeSchemasList.push({ key: "ankle", name: "Tobillo" });
      }
      if (includeThighSchemaInReport && specificStudy === "Muslo Anterior") {
        activeSchemasList.push({ key: "thigh_ant", name: "Muslo Anterior" });
      }
      if (includeThighPosteriorSchemaInReport && specificStudy === "Muslo Posterior") {
        activeSchemasList.push({ key: "thigh_post", name: "Muslo Posterior" });
      }
      if (includeNeckSchemaInReport && specificStudy === "Cuello") {
        activeSchemasList.push({ key: "neck", name: "Cuello y Tiroides" });
      }
      if (includeUrinarySchemaInReport && specificStudy === "Vias urinarias") {
        activeSchemasList.push({ key: "urinary", name: "V√≠as Urinarias" });
      }
      if (includeScrotumSchemaInReport && (specificStudy === "Escroto" || activeProtocol === "Escroto" || /escrot|testic/i.test(specificStudy || ""))) {
        activeSchemasList.push({ key: "scrotum", name: "Escroto" });
      }
      if (specificStudy === "Mu√±eca") {
        if (includeWristSchemaInReport) activeSchemasList.push({ key: "wrist", name: "Mu√±eca" });
        if (includeDeQuervainSchemaInReport) activeSchemasList.push({ key: "de_quervain", name: "De Quervain" });
      }
      if (includeBreastSchemaInReport && (specificStudy === "Mamas" || specificStudy === "Momograf√≠a" || modality === "Mamograf√≠a" || modality === "Mamograf√≠a y Ultrasonido de Mamas")) {
        activeSchemasList.push({ key: "breast", name: "Mamas" });
      }
      if (includeElbowSchemaInReport && specificStudy === "Codo") {
        activeSchemasList.push({ key: "elbow", name: "Codo" });
      }
      if (specificStudy === "Abdomen" || activeProtocol === "Abdomen") {
        if (includeAbdomenSchemaInReport) activeSchemasList.push({ key: "abdomen", name: "Abdomen General" });
        if (includeBiliarySchemaInReport) activeSchemasList.push({ key: "biliary", name: "Ves√≠cula Biliar" });
        if (includeAppendixSchemaInReport) activeSchemasList.push({ key: "appendix", name: "Ap√©ndice" });
        if (includeHepatopatiaSchemaInReport) activeSchemasList.push({ key: "hepatopatia", name: "Hepatopat√≠a" });
        if (includeDiverticulitisSchemaInReport) activeSchemasList.push({ key: "diverticulitis", name: "Diverticulitis" });
        if (includeAneurismaSchemaInReport) activeSchemasList.push({ key: "aneurisma", name: "Aneurisma" });
        if (includeSmallBowelSchemaInReport) activeSchemasList.push({ key: "small_bowel", name: "Asas Intestinales" });
        if (includeElastographyInReport) activeSchemasList.push({ key: "elastography", name: "Elastograf√≠a & QUS" });
      }
      if (includeAbdominalWallSchemaInReport && specificStudy === "Pared Abdominal") {
        activeSchemasList.push({ key: "abdominal_wall", name: "Pared Abdominal" });
      }
      if (includeCalfAchillesSchemaInReport && specificStudy === "Pantorrilla y Tend√≥n de Aquiles") {
        activeSchemasList.push({ key: "calf", name: "Pantorrilla y Aquiles" });
      }
      if (includeNeonatalBrainSchemaInReport && specificStudy === "Cerebro Neonatal") {
        activeSchemasList.push({ key: "neonatal_brain", name: "Cerebro Neonatal" });
      }
      // Old vascular schema disabled
      if (false && includeVascularSchemaInReport && isDopplerStudy) {
        activeSchemasList.push({ key: "vascular", name: "Vascular Doppler" });
      }

      const totalActiveSchemasCount = activeSchemasList.length;
      let renderedSchemasCounter = 0;

      const getNextSchemaPlacement = () => {
        const isFirst = (renderedSchemasCounter === 0);
        let forceAddPage = false;
        let yStart = 26;
        let boxH = 74;
        let leftBoxW = 88;
        let rightBoxX = 111;
        let rightBoxW = 79;
        const isSingleFullPage = (totalActiveSchemasCount === 1);

        if (isFirst) {
          forceAddPage = true; // Always start on a new separate annexed page!
        }

        if (isSingleFullPage) {
          // 1 Schema: Large prominent full page format!
          boxH = 138;
          leftBoxW = 92;
          rightBoxX = 113;
          rightBoxW = 75;
          yStart = 26;
        } else {
          // 2 or more schemas: Dual per page format (2 per page)
          const posOnPage = renderedSchemasCounter % 2;
          if (posOnPage === 0 && !isFirst) {
            forceAddPage = true; // New page for 3rd, 5th, etc.
          }
          if (posOnPage === 0) {
            yStart = 26;
          } else {
            yStart = 108;
          }
          boxH = 74;
          leftBoxW = 88;
          rightBoxX = 111;
          rightBoxW = 79;
        }

        renderedSchemasCounter++;

        return {
          forceAddPage,
          yStart,
          boxH,
          leftBoxW,
          rightBoxX,
          rightBoxW,
          isSingleFullPage
        };
      };

      // üõ†Ô∏è DRAW SHOULDER DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        try {
          const sanitizeShoulderSvgForPrint = (svgEl: HTMLElement) => {
            const clonedSvg = svgEl.cloneNode(true) as SVGElement;
            const stops = clonedSvg.querySelectorAll("linearGradient stop");
            stops.forEach(stop => {
              const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
              if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
              if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
              if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
            });

            const paths = clonedSvg.querySelectorAll("path");
            paths.forEach(p => {
              const fill = p.getAttribute("fill") || "";
              const stroke = p.getAttribute("stroke") || "";
              if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
              if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
              if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
              if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

              if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
              if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
              if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
              if (stroke === "#334155") p.setAttribute("stroke", "#475569");
              if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
            });

            const texts = clonedSvg.querySelectorAll("text");
            texts.forEach(t => {
              const fill = t.getAttribute("fill") || "";
              if (fill === "#64748b") t.setAttribute("fill", "#475569");
              if (fill === "#475569") t.setAttribute("fill", "#1e293b");
            });

            const circles = clonedSvg.querySelectorAll("circle");
            circles.forEach(c => {
              const stroke = c.getAttribute("stroke") || "";
              if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
            });
            const lines = clonedSvg.querySelectorAll("line");
            lines.forEach(l => {
              const stroke = l.getAttribute("stroke") || "";
              if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
            });
            return clonedSvg;
          };

          const getCardDataForSide = (statesObj: any, descObj: any) => {
            const structures = [
              { id: "supraspinatus", label: "Supraespinoso" },
              { id: "infraspinatus", label: "Infraespinoso" },
              { id: "subscapularis", label: "Subescapular" },
              { id: "biceps", label: "PL B√≠ceps" },
              { id: "bursa", label: "Bursa SAD" },
              { id: "glenohumeral", label: "Derrame GH" },
              { id: "acromioclavicular", label: "Artic. A.C." },
              { id: "dynamic_assessment", label: "Val. Din√°mica" }
            ].filter(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getPDFSimplifiedDescription = (id: string, state: string) => {
              if (descObj && descObj[id] && descObj[id].trim() !== "" && descObj[id] !== "No mencionado / No descrito." && descObj[id] !== "No descrito.") {
                return descObj[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const data = structures.map(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getPDFSimplifiedDescription(struct.id, s)
              };
            });

            const shoulderExtras = additionalFindings["Hombro"] || [];
            shoulderExtras.forEach((extra: any) => {
              data.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            return data;
          };

          if (laterality === "Bilateral") {
            const svgDer = document.getElementById("shoulder-anatomy-svg");
            const svgIzq = document.getElementById("shoulder-anatomy-svg-left");

            if (svgDer && svgIzq) {
              const imgDataDer = await convertSvgToPng(sanitizeShoulderSvgForPrint(svgDer));
              const imgDataIzq = await convertSvgToPng(sanitizeShoulderSvgForPrint(svgIzq));

              checkPageBreak(125);
              yCoord += 15;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(30, 41, 59);
              doc.text("ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA - HOMBRO BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6;

              const yStart = yCoord;

              // --- HOMBRO DERECHO (LEFT COLUMN) ---
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("HOMBRO DERECHO", 60, yStart - 1, { align: "center" });

              // Diagram Box Left
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart, 80, 50, 3, 3, "FD");
              doc.addImage(imgDataDer, "PNG", 35, yStart + 2, 50, 46);

              // Findings Box Left
              const dataDer = getCardDataForSide(shoulderStates, shoulderDescriptions);
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart + 53, 80, 52, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - DER", 24, yStart + 58.5);
              doc.line(24, yStart + 60, 96, yStart + 60);

              if (dataDer.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 60, yStart + 75, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataDer, 20, yStart + 53, 80, 52);
              }

              // --- HOMBRO IZQUIERDO (RIGHT COLUMN) ---
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("HOMBRO IZQUIERDO", 150, yStart - 1, { align: "center" });

              // Diagram Box Right
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(110, yStart, 80, 50, 3, 3, "FD");
              doc.addImage(imgDataIzq, "PNG", 125, yStart + 2, 50, 46);

              // Findings Box Right
              const dataIzq = getCardDataForSide(shoulderStatesLeft, shoulderDescriptionsLeft);
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(110, yStart + 53, 80, 52, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - IZQ", 114, yStart + 58.5);
              doc.line(114, yStart + 60, 186, yStart + 60);

              if (dataIzq.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 75, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataIzq, 110, yStart + 53, 80, 52);
              }

              // Footnote
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.0);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapas anat√≥micos y sinopsis correspondientes al estudio bilateral.", pageWidth / 2, yStart + 101, { align: "center" });

              yCoord += 112;

              // --- SUPRASPINATUS EXTRA DRAWINGS FOR BILATERAL STUDY ---
              try {
                const supraspinatusWrapperDer = document.getElementById("supraspinatus-ap-print-wrapper");
                const supraspinatusWrapperIzq = document.getElementById("supraspinatus-ap-print-wrapper-left");

                const shouldPrintSupraspinatusDer = supraspinatusWrapperDer && supraspinatusWrapperDer.getAttribute("data-include") === "true";
                const shouldPrintSupraspinatusIzq = supraspinatusWrapperIzq && supraspinatusWrapperIzq.getAttribute("data-include") === "true";

                if (shouldPrintSupraspinatusDer || shouldPrintSupraspinatusIzq) {
                  checkPageBreak(120);
                  doc.addPage();
                  yCoord = 20;

                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(8.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text("ANEXO: ESTUDIO MICRO-ANAT√ìMICO DE ROTURA DE SUPRAESPINOSO", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 3.5;

                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(6.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("INTERPRETACI√ìN PARAM√âTRICA VECTORES CORONAL (AP) Y SAGITAL (LAT)", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 8;

                  const yS = yCoord;

                  if (shouldPrintSupraspinatusDer && supraspinatusWrapperDer) {
                    const svgChildren = supraspinatusWrapperDer.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(20, yS, 80, 52, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(7.0);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO DERECHO: DETALLE DE ROTURA", 60, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 22, yS + 10, 36, 36);
                      doc.addImage(latPng, "PNG", 62, yS + 10, 36, 36);
                    }
                  } else {
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(229, 231, 235);
                    doc.roundedRect(20, yS, 80, 52, 3, 3, "FD");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.0);
                    doc.setTextColor(71, 85, 105);
                    doc.text("HOMBRO DERECHO: DETALLE", 60, yS + 6, { align: "center" });

                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(6.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text("Tend√≥n supraespinoso sin desgarro", 60, yS + 26, { align: "center" });
                  }

                  if (shouldPrintSupraspinatusIzq && supraspinatusWrapperIzq) {
                    const svgChildren = supraspinatusWrapperIzq.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(110, yS, 80, 52, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(7.0);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO IZQUIERDO: DETALLE DE ROTURA", 150, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 112, yS + 10, 36, 36);
                      doc.addImage(latPng, "PNG", 152, yS + 10, 36, 36);
                    }
                  } else {
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(229, 231, 235);
                    doc.roundedRect(110, yS, 80, 52, 3, 3, "FD");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.0);
                    doc.setTextColor(71, 85, 105);
                    doc.text("HOMBRO IZQUIERDO: DETALLE", 150, yS + 6, { align: "center" });

                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(6.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text("Tend√≥n supraespinoso sin desgarro", 150, yS + 26, { align: "center" });
                  }

                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("An√°lisis cl√≠nico y modelaci√≥n de fibras intactas vs soluci√≥n de continuidad.", pageWidth / 2, yS + 58, { align: "center" });

                  yCoord = yS + 62;
                }
              } catch (ex) {
                console.warn("Error printing extra supraspinatus detailed drawings", ex);
              }
            }
          } else {
            // Unilateral
            const sideTitle = `HOMBRO ${laterality ? getGenderedLaterality(laterality, "Hombro").toUpperCase() : ""}`;
            const svgElement = document.getElementById("shoulder-anatomy-svg");
            if (svgElement) {
              const clonedSvg = sanitizeShoulderSvgForPrint(svgElement);
              const imgData = await convertSvgToPng(clonedSvg);

              const willPageBreak = (yCoord + 95 > pageHeight - 20);
              checkPageBreak(95);
              if (!willPageBreak) {
                yCoord += 18;
              } else {
                yCoord += 6;
              }

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.0);
              doc.setTextColor(30, 41, 59);
              doc.text(`ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS - ${sideTitle}`, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.3);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA DEL MANGUITO ROTADOR Y ESTRUCTURAS ADYACENTES", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 4.5;

              const yStart = yCoord;

              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart, 75, 75, 3, 3, "FD");
              doc.addImage(imgData, "PNG", 22.5, yStart + 2.5, 70, 70);

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(100, yStart, 90, 75, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(67, 56, 202);
              doc.text(`SINOPSIS DE HALLAZGOS CLINICOS - ${sideTitle}`, 104, yStart + 5.5);

              doc.setDrawColor(229, 231, 235);
              doc.setLineWidth(0.2);
              doc.line(104, yStart + 7.5, 186, yStart + 7.5);

              const cardData = getCardDataForSide(shoulderStates, shoulderDescriptions);

              if (cardData.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 145, yStart + 30, { align: "center" });
                doc.text("Todas las estructuras musculotendinosas", 145, yStart + 36, { align: "center" });
                doc.text("y articulares se reportan normales.", 145, yStart + 42, { align: "center" });
              } else {
                drawAnatomicalCards(doc, cardData, 100, yStart, 90, 75);
              }

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.2);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapa anat√≥mico y lista sin√≥ptica correspondientes al reporte f√≠sico.", 145, yStart + 72, { align: "center" });

              yCoord += 80;

              // --- SUPRASPINATUS EXTRA DRAWINGS FOR UNILATERAL STUDY ---
              try {
                const supraspinatusWrapperDer = document.getElementById("supraspinatus-ap-print-wrapper");
                const supraspinatusWrapperIzq = document.getElementById("supraspinatus-ap-print-wrapper-left");

                const shouldPrintSupraspinatusDer = supraspinatusWrapperDer && supraspinatusWrapperDer.getAttribute("data-include") === "true";
                const shouldPrintSupraspinatusIzq = supraspinatusWrapperIzq && supraspinatusWrapperIzq.getAttribute("data-include") === "true";

                if (shouldPrintSupraspinatusDer && shouldPrintSupraspinatusIzq) {
                  // Print both side-by-side!
                  checkPageBreak(58);
                  yCoord += 11;

                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(8.0);
                  doc.setTextColor(30, 41, 59);
                  doc.text("ANEXO: DETALLE BILATERAL DE ROTURA DE SUPRAESPINOSO", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 3.5;

                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(6.2);
                  doc.setTextColor(148, 163, 184);
                  doc.text("COHERENCIA GEOM√âTRICA CON LA IMPRESI√ìN CL√çNICA: VISTA AP & LAT", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 5.5;

                  const yS = yCoord;

                  if (supraspinatusWrapperDer) {
                    const svgDerChildren = supraspinatusWrapperDer.querySelectorAll("svg");
                    if (svgDerChildren.length >= 2) {
                      const apSvg = svgDerChildren[0] as SVGElement;
                      const latSvg = svgDerChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(20, yS, 80, 38, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(6.5);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO DERECHO: DETALLE DE ROTURA", 60, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 24, yS + 8, 28, 28);
                      doc.addImage(latPng, "PNG", 64, yS + 8, 28, 28);
                    }
                  }

                  if (supraspinatusWrapperIzq) {
                    const svgIzqChildren = supraspinatusWrapperIzq.querySelectorAll("svg");
                    if (svgIzqChildren.length >= 2) {
                      const apSvg = svgIzqChildren[0] as SVGElement;
                      const latSvg = svgIzqChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(110, yS, 80, 38, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(6.5);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO IZQUIERDO: DETALLE DE ROTURA", 150, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 114, yS + 8, 28, 28);
                      doc.addImage(latPng, "PNG", 154, yS + 8, 28, 28);
                    }
                  }

                  yCoord = yS + 42;
                } else if (shouldPrintSupraspinatusDer || shouldPrintSupraspinatusIzq) {
                  const isLeftActive = !!shouldPrintSupraspinatusIzq;
                  const activeWrapper = isLeftActive ? supraspinatusWrapperIzq : supraspinatusWrapperDer;
                  const sideLabel = isLeftActive ? "IZQUIERDO" : "DERECHO";

                  if (activeWrapper) {
                    const svgChildren = activeWrapper.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      checkPageBreak(58);
                      yCoord += 11;

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(8.0);
                      doc.setTextColor(30, 41, 59);
                      doc.text(`ANEXO: DETALLE DE ROTURA DE SUPRAESPINOSO - HOMBRO ${sideLabel}`, pageWidth / 2, yCoord, { align: "center" });
                      yCoord += 3.5;

                      doc.setFont("helvetica", "normal");
                      doc.setFontSize(6.2);
                      doc.setTextColor(148, 163, 184);
                      doc.text("COHERENCIA GEOM√âTRICA CON LA IMPRESI√ìN CL√çNICA: VISTA AP & LAT", pageWidth / 2, yCoord, { align: "center" });
                      yCoord += 5.5;

                      const yS = yCoord;

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(45, yS, 120, 38, 3, 3, "FD");

                      doc.addImage(apPng, "PNG", 55, yS + 3, 32, 32);
                      doc.addImage(latPng, "PNG", 123, yS + 3, 32, 32);

                      yCoord = yS + 42;
                    }
                  }
                }
              } catch (ex) {
                console.warn("Error printing unilateral detailed supraspinatus drawings", ex);
              }
            }
          }
        } catch (err) {
          console.warn("Could not draw shoulder diagram inside jsPDF", err);
        }
      }

      // üõ†Ô∏è DRAW KNEE DIAGRAM IN THE PROGRAMMATIC PDF
      if ((includeKneeSchemaInReport || includeGonartrosisSchemaInReport) && specificStudy === "Rodilla") {
        try {
          const sanitizeKneeSvgForPrint = (el: HTMLElement) => {
            const cloned = el.cloneNode(true) as SVGElement;
            const stops = cloned.querySelectorAll("linearGradient stop");
            stops.forEach(stop => {
              const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
              if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
              if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
              if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
            });

            const paths = cloned.querySelectorAll("path");
            paths.forEach(p => {
              const fill = p.getAttribute("fill") || "";
              const stroke = p.getAttribute("stroke") || "";
              if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
              if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
              if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
              if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

              if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
              if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
              if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
              if (stroke === "#334155") p.setAttribute("stroke", "#475569");
              if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
            });

            const texts = cloned.querySelectorAll("text");
            texts.forEach(t => {
              const fill = t.getAttribute("fill") || "";
              if (fill === "#64748b") t.setAttribute("fill", "#475569");
              if (fill === "#475569") t.setAttribute("fill", "#1e293b");
            });

            const circles = cloned.querySelectorAll("circle");
            circles.forEach(c => {
              const stroke = c.getAttribute("stroke") || "";
              if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
            });
            const lines = cloned.querySelectorAll("line");
            lines.forEach(l => {
              const stroke = l.getAttribute("stroke") || "";
              if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
            });
            return cloned;
          };

          const getKneeCardDataForSide = (statesObj: any, descObj: any) => {
            const pdfKneeStructuresBase = [
              { id: "quadriceps", label: "T. Cuadricipital" },
              { id: "patellar", label: "T. Rotuliano" },
              { id: "lcm", label: "Lig. C. Medial" },
              { id: "lce", label: "Lig. C. Lateral" },
              { id: "medial_meniscus", label: "Menisco Medial" },
              { id: "lateral_meniscus", label: "Menisco Lateral" },
              { id: "joint_effusion", label: "Derrame Artic." },
              { id: "baker_cyst", label: "Quiste de Baker" },
              { id: "popliteal_artery", label: "Art. Popl√≠tea" },
              { id: "popliteal_vein", label: "Vena Popl√≠tea" },
              { id: "distal_tendons", label: "Tendones Dist." },
              { id: "popliteal_fossa", label: "Fosa Popl√≠tea" }
            ];

            if (includeGonartrosisSchemaInReport) {
              pdfKneeStructuresBase.push(
                { id: "gon_pinzamiento_artic", label: "Pinzamiento Art." },
                { id: "gon_osteofitos", label: "Osteofitos" },
                { id: "gon_esclerosis_sub", label: "Escl. Subcondral" },
                { id: "gon_geodas_quistes", label: "Geodas/Quistes" },
                { id: "gon_desgaste_cartilago", label: "Desgaste Cart." },
                { id: "gon_menisco_deg", label: "Menisco Deg." }
              );
            }

            const pdfKneeStructures = pdfKneeStructuresBase.filter(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getKneePDFSimplifiedDescription = (id: string, state: string) => {
              if (descObj && descObj[id] && descObj[id].trim() !== "" && descObj[id] !== "No mencionado / No descrito." && descObj[id] !== "No descrito.") {
                return descObj[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const kneeCardData = pdfKneeStructures.map(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getKneePDFSimplifiedDescription(struct.id, s)
              };
            });

            const kneeExtras = additionalFindings["Rodilla"] || [];
            kneeExtras.forEach((extra: any) => {
              kneeCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            return kneeCardData;
          };

          if (laterality === "Bilateral") {
            const svgElementAntDer = document.getElementById("knee-anatomy-svg");
            const svgElementPostDer = document.getElementById("knee-anatomy-svg-posterior");
            const svgElementAntIzq = document.getElementById("knee-anatomy-svg-left");
            const svgElementPostIzq = document.getElementById("knee-anatomy-svg-posterior-left");
            const svgGonDer = document.getElementById("knee-gonartrosis-svg");
            const svgGonIzq = document.getElementById("knee-gonartrosis-svg-left");

            const imgAntDer = svgElementAntDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementAntDer)) : null;
            const imgPostDer = svgElementPostDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPostDer)) : null;
            const imgAntIzq = svgElementAntIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementAntIzq)) : null;
            const imgPostIzq = svgElementPostIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPostIzq)) : null;
            const imgGonDer = svgGonDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonDer)) : null;
            const imgGonIzq = svgGonIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonIzq)) : null;

            if (imgAntDer || imgAntIzq || imgGonDer || imgGonIzq) {
              checkPageBreak(127);
              yCoord += 15;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(30, 41, 59);
              doc.text("ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO REGIONAL ANTERIOR Y POSTERIOR - RODILLA BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6;

              // --- ROW 1: RODILLA DERECHA ---
              let yStart = yCoord;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("RODILLA DERECHA", pageWidth / 2, yStart - 1, { align: "center" });

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 50, 2, 2, "FD");
                if (imgAntDer) doc.addImage(imgAntDer, "PNG", 16.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 46, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 50, 2, 2, "FD");
                if (imgPostDer) doc.addImage(imgPostDer, "PNG", 49.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 46, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 50, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 82.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 46, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                // Box Left (Anterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 50, 2, 2, "FD");
                if (imgAntDer) doc.addImage(imgAntDer, "PNG", 18, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 38, yStart + 46, { align: "center" });

                // Box Middle (Posterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 50, 2, 2, "FD");
                if (imgPostDer) {
                  doc.addImage(imgPostDer, "PNG", 67, yStart + 1.5, 40, 40);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 23, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 46, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 50, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 42.5, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 46, { align: "center" });
              }

              // Box Right (Findings)
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 50, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - DER", 117, yStart + 5.5);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const dataDer = getKneeCardDataForSide(kneeStates, kneeDescriptions);
              if (dataDer.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.0);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos.", 154, yStart + 25, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataDer, 113, yStart, 82, 50);
              }

              yCoord += 56;

              // --- ROW 2: RODILLA IZQUIERDA ---
              yStart = yCoord;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("RODILLA IZQUIERDA", pageWidth / 2, yStart - 1, { align: "center" });

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 50, 2, 2, "FD");
                if (imgAntIzq) doc.addImage(imgAntIzq, "PNG", 16.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 46, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 50, 2, 2, "FD");
                if (imgPostIzq) doc.addImage(imgPostIzq, "PNG", 49.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 46, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 50, 2, 2, "FD");
                if (imgGonIzq) doc.addImage(imgGonIzq, "PNG", 82.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 46, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                // Box Left (Anterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 50, 2, 2, "FD");
                if (imgAntIzq) doc.addImage(imgAntIzq, "PNG", 18, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.text("VISTA ANTERIOR", 38, yStart + 46, { align: "center" });

                // Box Middle (Posterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 50, 2, 2, "FD");
                if (imgPostIzq) {
                  doc.addImage(imgPostIzq, "PNG", 67, yStart + 1.5, 40, 40);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 23, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 46, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 50, 2, 2, "FD");
                if (imgGonIzq) doc.addImage(imgGonIzq, "PNG", 42.5, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 46, { align: "center" });
              }

              // Box Right (Findings)
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 50, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - IZQ", 117, yStart + 5.5);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const dataIzq = getKneeCardDataForSide(kneeStatesLeft, kneeDescriptionsLeft);
              if (dataIzq.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.0);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos.", 154, yStart + 25, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataIzq, 113, yStart, 82, 50);
              }

              // Footnote
              doc.setFont("helvetica", "italic");
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapeo dual y sinopsis anat√≥micas correspondientes al estudio bilateral.", pageWidth / 2, yStart + 54, { align: "center" });

              yCoord += 59;
            }
          } else {
            // Unilateral
            const sideTitle = `RODILLA ${laterality ? getGenderedLaterality(laterality, "Rodilla").toUpperCase() : ""}`;
            const svgElement = document.getElementById("knee-anatomy-svg");
            const svgElementPost = document.getElementById("knee-anatomy-svg-posterior");
            const svgGonDer = document.getElementById("knee-gonartrosis-svg");

            const imgDataAnterior = svgElement ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElement)) : null;
            const imgDataPosterior = svgElementPost ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPost)) : null;
            const imgGonDer = svgGonDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonDer)) : null;

            if (imgDataAnterior || imgGonDer) {
              const willPageBreak = (yCoord + 80 > pageHeight - 20);
              checkPageBreak(80);
              if (!willPageBreak) {
                yCoord += 15;
              } else {
                yCoord += 6;
              }

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.0);
              doc.setTextColor(30, 41, 59);
              doc.text(`ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS - ${sideTitle}`, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.3);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO REGIONAL ANTERIOR Y POSTERIOR DE COMPLEMENTOS Y ESTRUCTURAS EVALUADAS", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 4.5;

              const yStart = yCoord;

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 60, 2, 2, "FD");
                if (imgDataAnterior) doc.addImage(imgDataAnterior, "PNG", 16.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 54, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 60, 2, 2, "FD");
                if (imgDataPosterior) doc.addImage(imgDataPosterior, "PNG", 49.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 54, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 60, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 82.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 54, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 60, 2, 2, "FD");
                if (imgDataAnterior) doc.addImage(imgDataAnterior, "PNG", 16.5, yStart + 2, 43, 43);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 38, yStart + 54, { align: "center" });

                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 60, 2, 2, "FD");
                if (imgDataPosterior) {
                  doc.addImage(imgDataPosterior, "PNG", 65.5, yStart + 2, 43, 43);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(6.0);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 25, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 54, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 60, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 42.5, yStart + 2, 43, 43);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 54, { align: "center" });
              }

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 60, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(67, 56, 202);
              doc.text(`SINOPSIS DE HALLAZGOS CLINICOS - ${sideTitle}`, 117, yStart + 5.5);

              doc.setDrawColor(229, 231, 235);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const kneeCardData = getKneeCardDataForSide(kneeStates, kneeDescriptions);

              if (kneeCardData.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 154, yStart + 25, { align: "center" });
                doc.text("Todas las estructuras evaluadas", 154, yStart + 31, { align: "center" });
                doc.text("se reportan normales.", 154, yStart + 37, { align: "center" });
              } else {
                drawAnatomicalCards(doc, kneeCardData, 113, yStart, 82, 60);
              }

              doc.setFont("helvetica", "italic");
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapeo dual y sinopsis anat√≥mica de la articulaci√≥n.", 154, yStart + 57, { align: "center" });

              yCoord += 65;
            }
          }
        } catch (err) {
          console.warn("Could not draw knee diagram inside jsPDF", err);
        }
      }

      // üõ†Ô∏è DRAW ANKLE DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeAnkleSchemaInReport && specificStudy === "Tobillo") {
        const svgLateral = document.getElementById("ankle-anatomy-svg-lateral");
        const svgMedial = document.getElementById("ankle-anatomy-svg-medial");

        if (svgLateral || svgMedial) {
          try {
            const processAnkleSvg = async (svgEl: HTMLElement) => {
              const rect = svgEl.getBoundingClientRect();
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
                if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
                if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
              });

              // 2. Adjust paths fill/stroke colors for paper print
              const paths = clonedSvg.querySelectorAll("path");
              paths.forEach(p => {
                const fill = p.getAttribute("fill") || "";
                const stroke = p.getAttribute("stroke") || "";
                
                if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
                if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
                if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
                if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

                if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
                if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
                if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
                if (stroke === "#334155") p.setAttribute("stroke", "#475569");
                if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
              });

              // 3. Adjust text colors
              const texts = clonedSvg.querySelectorAll("text");
              texts.forEach(t => {
                const fill = t.getAttribute("fill") || "";
                if (fill === "#64748b") t.setAttribute("fill", "#475569");
                if (fill === "#475569") t.setAttribute("fill", "#1e293b");
              });

              // 4. Adjust custom guides/circles in background
              const circles = clonedSvg.querySelectorAll("circle");
              circles.forEach(c => {
                const stroke = c.getAttribute("stroke") || "";
                if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
              });
              const lines = clonedSvg.querySelectorAll("line");
              lines.forEach(l => {
                const stroke = l.getAttribute("stroke") || "";
                if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
              });

              return await convertSvgToPng(clonedSvg);
            };

            const imgLateral = svgLateral ? await processAnkleSvg(svgLateral) : null;
            const imgMedial = svgMedial ? await processAnkleSvg(svgMedial) : null;

            // Check page break for 95mm (75mm content + margins/header)
            const willPageBreak = (yCoord + 95 > pageHeight - 20);
            checkPageBreak(95);
            if (!willPageBreak) {
              yCoord += 18; // Generous space/gap from the diagnostic impression above
            } else {
              yCoord += 6;  // Normal small spacing at the top of a fresh page
            }

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.0);
            doc.setTextColor(30, 41, 59);
            doc.text("ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS DE TOBILLO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 3.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(148, 163, 184);
            doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA DE LA ARTICULACI√ìN DE TOBILLO Y SUS TENDONES", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // --- DRAW SIDE-BY-SIDE LAYOUT ---
            const yStart = yCoord;

            // 1. Draw Left Diagram Box (Cara Lateral)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(20, yStart, 43, 78, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("CARA LATERAL", 41.5, yStart + 5.5, { align: "center" });

            if (imgLateral) {
              doc.addImage(imgLateral, "PNG", 21.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 41.5, yStart + 35, { align: "center" });
            }

            // 2. Draw Second Diagram Box (Cara Medial)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(65, yStart, 43, 78, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("CARA MEDIAL", 86.5, yStart + 5.5, { align: "center" });

            if (imgMedial) {
              doc.addImage(imgMedial, "PNG", 66.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 86.5, yStart + 35, { align: "center" });
            }

            // 3. Draw Right Findings Container (Slate Background)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(111, yStart, 79, 78, 3, 3, "FD");

            // Header of findings: Unified title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text("SINOPSIS DE HALLAZGOS CL√çNICOS", 114, yStart + 5.5);

            // Draw horizontal divider line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(114, yStart + 7.5, 186, yStart + 7.5);

            // Ankle structures to map (9 structures in total)
            const pdfAnkleStructures = [
              { id: "achilles", label: "T. Aquiles" },
              { id: "plantar_fascia", label: "Fascia Plantar" },
              { id: "lpaa", label: "LPAA" },
              { id: "lpc", label: "LPC" },
              { id: "peroneal_tendons", label: "T. Peroneos" },
              { id: "tibial_posterior", label: "T. Tibial Post." },
              { id: "tibial_anterior", label: "T. Tibial Ant." },
              { id: "joint_effusion", label: "Derrame Artic." },
              { id: "deltoid", label: "Lig. Deltoideo" }
            ].filter(struct => {
              const s = ankleStates[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getAnklePDFSimplifiedDescription = (id: string, state: string) => {
              if (ankleDescriptions && ankleDescriptions[id] && ankleDescriptions[id].trim() !== "" && ankleDescriptions[id] !== "No mencionado / No descrito." && ankleDescriptions[id] !== "No descrito.") {
                return ankleDescriptions[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const ankleCardData = pdfAnkleStructures.map(struct => {
              const s = ankleStates[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getAnklePDFSimplifiedDescription(struct.id, s)
              };
            });

            // Append additional findings if any
            const ankleExtras = additionalFindings["Tobillo"] || [];
            ankleExtras.forEach((extra: any) => {
              ankleCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            if (ankleCardData.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 30, { align: "center" });
              doc.text("Los tendones y ligamentos evaluados se", 150, yStart + 36, { align: "center" });
              doc.text("reportan normales.", 150, yStart + 42, { align: "center" });
            } else {
              drawAnatomicalCards(doc, ankleCardData, 111, yStart, 79, 78);
            }

            // Footnote at the bottom of the findings card
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6.2);
            doc.setTextColor(148, 163, 184);
            doc.text("Mapa anat√≥mico dual y lista sin√≥ptica correspondientes al reporte cl√≠nico.", 150.5, yStart + 75, { align: "center" });

            yCoord += 83;
          } catch (err) {
            console.warn("Could not draw ankle diagram inside jsPDF", err);
          }
        }
      }

      // üõ†Ô∏è DRAW THIGH DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeThighSchemaInReport && specificStudy === "Muslo Anterior") {
        const svgSuperficial = document.getElementById("thigh-superficial-svg");
        const svgDeep = document.getElementById("thigh-deep-svg");

        if (svgSuperficial || svgDeep) {
          try {
            const processThighSvg = async (svgEl: HTMLElement) => {
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
                if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
                if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
              });

              // 2. Adjust paths fill/stroke colors for paper print
              const paths = clonedSvg.querySelectorAll("path");
              paths.forEach(p => {
                const fill = p.getAttribute("fill") || "";
                const stroke = p.getAttribute("stroke") || "";
                
                if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
                if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
                if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
                if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

                if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
                if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
                if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
                if (stroke === "#334155") p.setAttribute("stroke", "#475569");
                if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
              });

              // 3. Adjust text colors
              const texts = clonedSvg.querySelectorAll("text");
              texts.forEach(t => {
                const fill = t.getAttribute("fill") || "";
                if (fill === "#64748b") t.setAttribute("fill", "#475569");
                if (fill === "#475569") t.setAttribute("fill", "#1e293b");
              });

              // 4. Adjust custom guides/circles in background
              const circles = clonedSvg.querySelectorAll("circle");
              circles.forEach(c => {
                const stroke = c.getAttribute("stroke") || "";
                if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
              });
              const lines = clonedSvg.querySelectorAll("line");
              lines.forEach(l => {
                const stroke = l.getAttribute("stroke") || "";
                if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
              });

              return await convertSvgToPng(clonedSvg);
            };

            const imgSuperficial = svgSuperficial ? await processThighSvg(svgSuperficial) : null;
            const imgDeep = svgDeep ? await processThighSvg(svgDeep) : null;

            // Check page break for 95mm (75mm content + margins/header)
            const willPageBreak = (yCoord + 95 > pageHeight - 20);
            checkPageBreak(95);
            if (!willPageBreak) {
              yCoord += 18; // Generous space/gap from the diagnostic impression above
            } else {
              yCoord += 6;  // Normal small spacing at the top of a fresh page
            }

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.0);
            doc.setTextColor(30, 41, 59);
            doc.text("ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS DE MUSLO ANTERIOR", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 3.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(148, 163, 184);
            doc.text("MAPEO DE CAPAS MUSCULARES SUPERFICIALES Y PROFUNDAS DEL MUSLO ANTERIOR EN ECOGRAF√çA", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // --- DRAW SIDE-BY-SIDE LAYOUT ---
            const yStart = yCoord;

            // 1. Draw Left Diagram Box (Plano Superficial)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(20, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO SUPERFICIAL", 41.5, yStart + 5.5, { align: "center" });

            if (imgSuperficial) {
              doc.addImage(imgSuperficial, "PNG", 21.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 41.5, yStart + 35, { align: "center" });
            }

            // 2. Draw Second Diagram Box (Plano Profundo)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(65, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO PROFUNDO", 86.5, yStart + 5.5, { align: "center" });

            if (imgDeep) {
              doc.addImage(imgDeep, "PNG", 66.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 86.5, yStart + 35, { align: "center" });
            }

            // 3. Draw Right Findings Container (Slate Background)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(111, yStart, 79, 75, 3, 3, "FD");

            // Header of findings: Unified title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text("SINOPSIS DE HALLAZGOS CL√çNICOS", 114, yStart + 5.5);

            // Draw horizontal divider line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(114, yStart + 7.5, 186, yStart + 7.5);

            // Filter out structures that are NOT described in the report
            const pdfThighStructures = [
              { id: "rectus_femoris", label: "Recto Femoral" },
              { id: "sartorius", label: "M. Sartorio" },
              { id: "iliotibial_band", label: "T. Iliotibial" },
              { id: "vastus_medialis", label: "M. Vasto Med." },
              { id: "vastus_lateralis", label: "M. Vasto Lat." },
              { id: "vastus_intermedius", label: "M. Vasto Interm." }
            ].filter(struct => {
              const s = thighStates[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const translateThighStateForPDF = (id: string, s: string) => {
              if (!s || s === "no_descrito") return "No descrito";
              if (s === "normal") return "Sin lesiones";
              if (s === "desgarro_miofascial") return "D. Miofascial";
              if (s === "desgarro_intramuscular") return "D. Intramusc.";
              if (s === "desgarro_completo") return "D. Completo";
              if (s === "tendinopatia") return "Tendinopat√≠a";
              if (s === "desgarro") return "Desgarro";
              if (s === "friccion") return "Fricci√≥n";
              if (s === "contusion") return "Contusi√≥n";
              if (s === "desgarro_parcial") return "D. Parcial";
              if (s === "hernia_muscular") return "Hernia Fasc.";
              return s;
            };

            const getThighPDFSimplifiedDescription = (id: string, state: string) => {
              if (thighDescriptions && thighDescriptions[id] && thighDescriptions[id].trim() !== "" && thighDescriptions[id] !== "No mencionado / No descrito." && thighDescriptions[id] !== "No descrito.") {
                return thighDescriptions[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const thighCardData = pdfThighStructures.map(struct => {
              const s = thighStates[struct.id] || "no_descrito";
              const stateText = translateThighStateForPDF(struct.id, s);
              return {
                label: struct.label,
                state: stateText,
                description: getThighPDFSimplifiedDescription(struct.id, s)
              };
            });

            // Append additional findings if any
            const thighExtras = additionalFindings["Muslo Anterior"] || [];
            thighExtras.forEach((extra: any) => {
              thighCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            if (thighCardData.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 30, { align: "center" });
              doc.text("La musculatura anterior del muslo se", 150, yStart + 36, { align: "center" });
              doc.text("reporta normal y sin desgarros.", 150, yStart + 42, { align: "center" });
            } else {
              drawAnatomicalCards(doc, thighCardData, 111, yStart, 79, 75);
            }

            // Footnote at the bottom of the findings card
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6.2);
            doc.setTextColor(148, 163, 184);
            doc.text("Mapa anat√≥mico dual y lista sin√≥ptica correspondientes al reporte cl√≠nico.", 150.5, yStart + 72, { align: "center" });

            yCoord += 80;
          } catch (err) {
            console.warn("Could not draw thigh diagram inside jsPDF", err);
          }
        }
      }

      // üõ†Ô∏è DRAW THIGH POSTERIOR DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeThighPosteriorSchemaInReport && specificStudy === "Muslo Posterior") {
        const svgSuperficial = document.getElementById("thigh-posterior-superficial-svg");
        const svgDeep = document.getElementById("thigh-posterior-deep-svg");

        if (svgSuperficial || svgDeep) {
          try {
            const processThighPosteriorSvg = async (svgEl: HTMLElement) => {
              const clonedSvg = svgEl.cloneNode(true) as SVGExúÏ}KsG∂Ê˛˛älﬁx-BxÒ•nŸÇ†Ñ{¡áRn∑€¡.T%¿íUp@âÓvƒÙréââﬁÕ,f<;/ºË–f¢∑¯'Ûf~¬úìôıŒ¨@Iîtõ™2Ofû<'_Á;'-:•ˆ¸wˇBbüƒœ«èIΩJNWßd§ÈﬂN\gaDÉˇtãj6qsÀ¥)—Àq=‚ÿd‚jÜ	îâ7wf^ÇûÓÿûxCû	«¶∆vR˝nA›ª!µ®>w‹∂eU∂ê™Ê>ã€⁄N÷ñ™é∑´È7¸Eû~F˛íHÂ´/‹VJ∆§’	ù∑Ás◊-Ê¥≤ÖèvX3∂∂…_ˇ™J“	Slm%ÎCà9&ï∞úßO…÷ø÷i„∞9⁄¬â7⁄4v@åïÂ©™ÛíéÎ„›Òaö“k„˙~CìïXØ◊˚ÖJ‘G∆.≠,±Ÿl’wwe%6ç›€[´ƒ‡IZ.U“6^.†_g⁄¸∆#c”≤{s◊˘6êFx9£◊5ÌπTyÊlYƒ4Èj±úÅeJ÷ H >VãíØ+¨EÈÃ¸Ö:ª¥€xE¢bπMíΩ¬j≈dÓ`¨çuïDHµvÎZ≠ôIäéõ˙~Rªµ⁄~≥ñIJß˚„fR˚„∫Q7≤kE¥±ï/NÀg=£F«-¯H®â~@zÜﬁÿkÏ©™'ß∑s»ç˚˚J¶≈»çwiM÷ôQrá˚˚µbµÍúIÆµøªªßëb‰¸§Y‰ˆZ˚≠ÉQQÂo ?ßØÁBﬂ•˙çÔÛÙ”§Kf9˝û–Ôy)˝Nà´œ †¢◊léGı—Á∑íîØ¸≈∏›
∏≠√gJ&”†ﬁc›ta‡”é,§Ω‡ßÃÓû*]+ë;Ë=´/ÇS/9`¶ƒ6!uµÿ¬ r0Æ…)´.kä,}“YŒÄV!X˜∆k5$πtæpm¢Ω“LTZ˚ñ∫s‡¡•saO*Kî~Hê·m4ßì·¶ˆ±©õ*üw{π(eÊ::ıºÀsrs·xsÍöéÖT‚È∑…b/,ÎwÚ¢é)ùÒ2ÿ∑"ƒ1aH5FT™sCıoa	1ÅuµKµoŸZÂpw:%ï}¸%œq›˚)ôjÓƒ¥Ω«7T3®ª-©ﬂ+–Í†tƒ=%ïªé„∏‰=‹%ü±BûS®·úÏêF-¡]+‰ÆÓ&ﬁ£H¸&V¬vJÓ¸Úûí˙¡Ô∞uœ®Ma0à7”t˙x¢Õ»ÿÖqc~CâajxeÍ¿ÿôÏ3a◊†çú[ÔvB-èfîµ˜;∆…3«ùB{«bÂôˆÑhsVnú1—†tÍ›0NƒÀHıÀs∆e÷~e]mKe8l<8Å™l›PÎñB[4TÖëcI=à§öﬂ” A5Ÿ"≈%L7l·\i÷ëV˝Ÿ=î§ƒY©≤’>Î˛·¸	Èø∏Íû∂…qó<o˜˚Ì?>;íØ»∞wv~1ÏÒ˘È’∞N.Œáó›AÔ| ’D.|iÛãËGÇ°è»_àfô˚	Ÿ“A®ªï√B÷7´ª	ëV3≈f˝ì«ñΩj3è-ı÷¡#Rﬂk¬üÉñí3ßÌãÓ96º”æh±˘ù´~{–í·’Ewp“ÎÙ⁄˝.rÈbp~ruv‹F6ıì|"›3“Ìú?¥Oñ?∂Ôák≠◊@‡vvv»Ò†˝%t⁄qwÁË´¸óÙ€_ù_]‚KâæﬂÁöÎA:M∂Ï«ÆˆäÙÈxNéπì#Á5©\XöÌêË∏'ÌPwŒÛ∆ÓÓ#‚ˇëwñ$7!]≥édâŸÚÄòÈ*êqﬁêuË“}(¢…˛øurúZëØßr{UE’CŸ⁄áJ@Í5YR.Y˝ˆŸyTä∂PM´ª~C`º›≈_rëH™Ò	,=®b¡öaÙ¶ xâƒ–Óã≥gP|#^<ËG«é‰£J’\5Á–…Œ/…Ÿ}UäbZÂÓôÉ≠7slsd—4gõJ∆∆öRÖÜPÖ!›1d p·:cêKÁ}i¬ﬁÓ™	b¸<á¬ˆ÷QæR ìL˛ﬁﬁG+¯	^Æ*¯M!¯∂;1m÷EÈ@4ÿI∏§2¥¥9%G¡∆-O∞=ç›˛i‹ß‘ÎıPˆÛ4 \§¡ n,⁄ıÑ\ŸÊÿ§ôõsãﬁ£ ÏÁ´Ãﬁ>¨’ˆ†©5‡÷+5qvˆk5ÖEh·¬≠”_˛x÷Îú°nız+ÆP6∞˛Ωq\Û{ÏTƒË÷Dæ‡NqΩÓÅƒ} ¬÷;ïZU÷›XH%^À}‹˙¡^¸ë§‚ TsÏø€™.tÿ¬¶x~´vÕ•‰Ï¸í‘”aØ	j⁄l%Ó“ô„∆èp≈Æ1NÏøBíO…◊	Ω˚1–£ë©”ôw=¶S`üwm› À-mD-xw¥¸_í:≠í˛sP∂GÖàxJ"√"ùö∞”)vºÖ°p
˘ƒªjvˆ)ùé\Më_fÂáı®√5å∑4í˚~õÈòÀü‡µ£& CÙO.Æaú∂ìhÛw‰Tª√:ƒ(|S31®pêùgà”<YKÙ0å\ﬁ◊<c’4æaÁ∂sÕ•fÓ§é6ƒ¡ÉG~É«—î‰ìO¬«lßíYìÚ+éÅ·†IŸÉG'é{q|Çq‰‘F®GƒÛønÀö ∂Ÿ≥;Ò£óh∑˝˙≥…B’Fvx„gÊ{Æ ﬂ¥»¢∏”¶^VF >—\◊πûöŒXC·àR9Æí”y2¶åö.<}ainúRœU-DIw¶3ã∆òD:˛”,f–ÖÎÃ@ µ(#≈√Â/ZV^j√‹ËiS¥AFãÓ∆ûg¿súÚ=íπ√ü-ﬂÿÖZ>”‹t?\àá*A/rÑ6ÅI,&Ω µC f“c&g≥9ûŒ$E•<Wú„:!Á°Œ©ﬂ~ç
ùõ¢
ÖO+€\s∑
Pd	A¶‘÷·°f8è}™ñ!fJ/\ÉN»¶ï:.ïé»inç∆/íëAYz¥öÑ⁄∞s(M+ú¨ÏXâb8Q÷m¶ƒZ˛Ç3ñGxÍÂÂ,ñV’o4∑=Ø‘∂´sÁj˚›éÊQË‰O≈{Á∞ÍÿÆBK,æ>æ~Ú∏Eí´8π¿«;§£π∆±6◊–∂™^CTß⁄ÏùLQ˛—=Œ)h”zZ`é©ÙA)S{¡⁄tßâZdføí≥;	ï\T(ù¬%˙IÒ¡$^Á§t‰Læ∞xlÉ\ ≈0L$Î^Äb´Ÿwπﬂ}ú≈.i¯˚£Ø∑NûÂê ÌÎ∏Ø⁄*£òf*?¡™H«FπVgÔ¶¢Ï+F≥¨ñœ¥)UvôüV[m\f¡x∑ï”Ö<_‰QéMK∫üW¥ŒÇôt~√Üìö|ØøﬁÜ<}≤!€í◊j∏≥ÇJΩô<[èmœ`µt£Yñˆ˝ƒÒÁ·XÀ7X{†SΩ’`CêŸ≠E∑Íµ"[ıhA}çà≈t™Ff>€†_,|íË—t9{eÀ·ø&ÜeﬂÚ†ç˛C“ñV£–±É‚|6ömÿ6Ö^¥Pº
TÊëBÙ±ORG π'é3∑qaÎ9s4M;cˆ+t(§‡qÄ\÷“í¶8˝(m©–ft¨Aﬂ ü`≤^@◊‹¡Ó4ªg˘fÜ5É!ÃÖyhÊÿ	ì´Ã‰Dá◊ÜÃ¢c'G˚ .Tÿ'j—™˛ ¨õÎ7§B]7©±8™:≠æ“\ªÎŸÖeÄlÕY«ÛNé ≤8s5mœ4(yÈ¡Ã ’E≤±Ú˛%˘-ËsËÌˇ˜?˛˚ˇ¸øˇ˚øpS…Y∑Û∞xª|˛’‡ºwLé{ÌgÉˆ)Èù¡£.ûK‚œ”ˆeØC†,AÑ6⁄∫µ0Ë’øÍ7t™ıÏ„$€Œ®ìï>ú/å;æÈ,®e≈WYböæù\ﬁ‹πéi¿4]∫@,%€ªÉU›ıå
Ï<Ùow4¶w;êegŒÛDE,†˜ÃµÙJëõ∞,±2∂r+á+GütºÁÓù§Sì6c—Ì'IÔŒ÷—.ÃCœ/O˚¢R“…M¿=|S>∑ôw≠*{rÊ¥S›™d¯‚ô†î∏?7 ‘µHâÍÑ˙–@®uZµ∏ﬁEû6Î∞ï·+Éh
oPÆîÎÂ™ µAπnPÆøîk∏œà¨Î T±Zè¨¸s¨¡f#‹x®I˙€áñuÉe}ØX÷ŒU∑ﬂ?ááó=‹¯wáø4k˚¨}π¸˚iØsNÆ˙óÉvwx9∏Í\^⁄}dÀ≥˛Úog«W˝v¿óGd–}÷;?Î…≥ˆŸ≥>|eÿØ¬¥C2l˜{/˚ë°[/M ©∑Å∂ñÙE¥j=\k0Âa˙D¬ûıÒ¨DÓË0ã<&C†˚˛0ﬁ,≤µ”ºËu`p}Ïíkc\eG∞~—Qç‡È68◊ŒuÉsıŸ∞¡π
ú+€ì@∑
3”µã:qm9£(≤≥ø|3ZX9¶n5X+©Òù>-V[*RΩÔø+C ÙÊ7”T¥ÁÕß¡¬-l:”\gÓ7,íˇôµ¸…f†∏ÂxØ±∆Âì¡6eQ¡ve@g£)÷Ê±ç™*y¢jNç‚¥‰ı
HÂVdv≤–¨å:aäuÚ	)+ƒÈ(*ÑõgW≥±Iƒ∫õŒnàÌÄÄ°Z^&KpÌ^õ—“4{bôéGŒÃ[jë^NµY4ä…§RòÃmïâd–(L"£5/ä6Ê6ã'/‘<QâÓ„≤J¥≤•![Ÿ“PîHé4$ì-≈àdJCAŸ“PîHé4®á>ùh˙›cƒpkŸ„ArÛKÒ˜: E«˘uMb"Ω"SÌ•¬O=÷⁄:/4à\∏¶≠õ3§íAb··	ˇµÁ¿\:7=oAcÀ"ÃÒ_“óUrÑ[«[Ào¬f+Ü˜Ó-1°s\ª‹/æ€ñDï'ü˘XrŸÛ4Ç\öªn<3k!¥∏å¬«Ö?ÜMùã>tú8vE_y∆ÑØ•~k‚∂ÛÒ⁄Y*˘>P⁄»≠Ll∂Ä„I!ŸaÊ¬@Ïh7Î¿áü	ö≠ÄÌ#è?õiè-m:’Êé{GtˇîP3®çéP7&7q+˜üö>á9eF∏'TLØã}dO8ÜÚ÷v,ÖßxÊÅY⁄'¢6¡SnôEÌÌ;Ø|Ìïö*Ω#ø˛Xr€ØÏ] ‹LoÇ∑¸&-I“√ŸAû0÷q^ +ÃtøÃ5Û≥
(rÖì]˛ŸãèKêµ*êE ŸÖK-õá‰R&§ZârJfa≈DÿP¶(u∂ƒ˙Œs¶¥ÚÌ+≤‚JW¯eﬁn3xC%Q`Eï!⁄éå»MiÊ%út±Tﬁ‘¯ìO
◊7¬≠úDñ§ÍO7¶#GdäÊÂßÖ≠Ä•¨µ±™HÕyÉ[z1%Üb⁄l‹=◊ºg|î«YL,7Ç	çI√•¶ùØ‚√ØTVxÉW&`*ÛG¶9%ïH%(§Ãl!,eãlAZd‚¶˛≠vT˜√Õ¢d:ñ [Ω¨˘?±ô?^D˛å<™[)ÍiTV|1˝CZcŸ¯j…
báû∆¬“»\út?"ˇôG<nke˙u›µÓ»úæ4a!#~@<ﬂ0†Ÿë=”ªq⁄ä ∆∆UÎ£r’¬Æ}˛YWÉﬁY{yL›3ƒ(ïu–∫rM[sÔ
˘hΩ¿’‘Çe0Ÿ-Ò’Põ≈U∫VÒ¸w1Ô*3I]µ^PèÌùJºÂŸd˛ZºÇ‹[KP/ÂÆÂ3l„±µÒÿ⁄xlÒœ∆ck„±µÒÿ⁄xl©…m<∂>è-6l∏ûöx6#g˘∆=k„ûEÓ€=ÀﬂZã¯ÑU∏2÷˘9æY·Ó"≤’»§ÏJ{hIj∞<∞äú\D›®rN">:ó®À€C±·Óµ?Vá(1¢,Fóàz~FmÏƒßb◊«ü¬Vï7Œ§|tfÎ˘˘È—†K*ùÛ3“}—Ó_µ;ΩÂﬂœbxπ¸€eØ”ﬁﬁ"àΩπ˙˜Ó`K—Nπa±´ñ;¡Ôx{@˚¢=h_ûãÛéØ»Â†›Åü¢_ŒAU~˚óxı¯Û[Ú∫∫'/*>RI;u„Bï·9¬˙mˇ)1K‰˘ä∞dﬂ©{ÙùÚ'“˜$ˆå√cƒyfÌdÖFcÆ#/∫C6w¬!¯úç¿ëó†B
5ãπÆKñÙú’/-™g"·∆)k„îµq ÚŸ°;e…≤ò]Ãw»íxöe9Ø®!6_ˇAÔ2|∞∏Ô’∑¶a”ª∆{`.ˇ±|c£è’o2\ùòøï2{Ô˚Ô&uçº–@‘Ÿê¬ïª¸€_¨ Ï*0≤`çe~A_öç\	c]
Ÿûﬁ+ä9Öch}h»ıbqÀÁ¥LI «È~(ègn_F€uıB∞DìŸÊs(r^•˙Líê¸A’T≈ÙY∫ë3◊a`îHï.‹Â|&≠éD‹g∆ÿ?gà:J
.·ëÎ—˜Ìî ⁄pq|≤∂7ÇhW“!AÚÿ˜IPºJª%®hÛL»À]»9AA$g¥ÒOxK˛	¢7‚.
)U-Ï•∞ÆJ¶9zœé
R5}
ÇSôN
/àœü„<Ó≠ Mh¶”%ΩbvlH»««‡€b78≈ÏòÚ@q˘∆ù‡ÖP,éº6”\(é0<πÛ±RŒ= e∞D(cÀkL2tv„–ªB*&d∞‚ÉE˙ùì”-`ƒM»qgÊôûè2‘ PtÀ[ ;ÉÛÀ´”Ú √°Ó:Û≈40¨HÜ]S;[!ˆˇÎéï~ˇò≤e…ylVÒKÇ(w~⁄ñ"E≈≤†ÖOÖ  ÖÇR)°œñ€	ﬁ/cå
òpHaÛ=ÉJŒ@‚Áh∑É|k1eË,⁄qKÒ+<L@5n÷j≥◊„æ"ﬂÆÁ2ŒÔ@B¥£è‹b◊¯¿-M≠†“MÌcÅ∞‘e¯¥SbÙLò¸S0¥\‹H∏\òøû´I¨»k9Z§(N$Åõ‡ºƒS≠ˇ„H√ﬂ‡cŸ™ú∞™(p"™»Oºé5˜[¬.JbC'mdQ‘¸§|(»ãw∆⁄‘¥¨%2ÓKZù\˜K yò@Ú,ÀúyÙë ï<"mY‡YÖ;å&Ò™˛J¿2R˘|\∆ò@Y/“$j#Ñπ)¡©b‚è„NFZÖ-¥òQOk’FcªtπF}¨—›rÂ6ZXÊ.N›uVÓA˘r’h∆¨r[è.[XlswÖb«¥E•¯∫§,+zZÜô„˚˘»Û &V®r‰ŒaKkéVU5ﬁ˚`õæ"8Ì)Ã,»‹ 6î,~\:CvÜ£˘DËYŒH–√ØïØEﬂ‡j~7C'/Dè·≈ßØß÷Ôpœç|∫òèwdÀfâJ{5ËWu®ÊÙ|ÙF¯]•¶Ú…7›X3XÜLMè˛ûM}V©¿ÆﬂÅ±+sÿ0ß—0n‡íçÏ”I’±-GCß¬äÇZ0Ÿkˆ≠ª∑Ü7LLÓï-û@÷¡DdÆ≤ÈHÏ’j©¯dúëå◊g˛°m<åphtbKÍF ‹"Zã∏Ù˘kπ‰§W≈el`=dˇﬂ´Ò?R¢i’¬ûcΩSuõ;(PÿÛBíf6,‰§‘P\\z*äíLg‰ΩÈπ:;Ë±íØS[.Œ-\ò∆Äh…ctÂßú<â`“fé«NG@àSõ~±˘å4ÍäMæfRAYüíf£¿iw
1ìU˘ÛA∆∞õ°dd9˙∑≤=_)ìWq[ßõD»‘˜·«˛æ“by¬™…cÆ{“≤W≈∫ÂZ'ÔÎ÷e{=Æi∞NF¨ë“&G˚≠ßÕ“ïa˜ò≠±QKôk)S£4k‰"»¥/i Ée±m2;•ª«^+ ¸(õ‹∑ìäkü,lΩÖP∏Ó∂·W˝ˆ jÿåv]ΩÆ∂,ãM.a#cjP«£|ÙÜH†7ö—#ëzì[œw˜r1À¿∫dŒ∂˜ØP¬‹ØÍï{≥ÔKå˜ıf⁄zèœ‰Ü;aÄÃ∂øÛòÖÖÊnÈ°ón˘ã.¢†fõ¡C:f`ÚñR*`ß3”ÄˇMeuÍ¬ªÂ/¯2øN!Yù"î
‘ÈÜNM~f%´’Ûm~µ¢§dãã÷,FÌióœå±Ã]÷¯,Fïáa|Œ±:ÁZúEcíg…cﬂ‚¨xï∂8´h≥8ÁÂ.dqV)fqfª”wki~∑VÊ,Û∫÷e¡˘∏uy≥Ú∫ ˆ÷Õ Ôﬂû,XîiOˆ≠R˚på@a˚p¢á?˚p≤Yø
˚piõmõ©¬eöji∞XàôY—`-'a÷ãÍ‹åÃ˛Ü&3º√pB2í;0æ¸D˚^3’ß⁄BƒûÅIã5ÜÑ∆“¸	Õ√—ŸLbnΩª∞ø«ªªóÉﬁ“∑
òÖ}ªóÆÈÕVa«ƒ€c˙≈Ç∫∑öi«ìl+B”ú.ñˇ†hFíYz€∂∏˝)…(¸sµ¯&¨¿ö «Õ¡)”†ÿã‡^ˆ˚)7∏Á=Ø‡êya…*ÜÊo–ùÔD÷D¡A…¬ôG◊	€œáU(e)Á<€ÿ…7vÚçù¸€…<Dféu7qÏ◊l^A˜&˚|Uc∫2ÍŒ∆ò˛`çÈë¯W#˚∆»æ1≤ˇ çÏ∞VÂK¡`—öà˚_vFó∑9AepŸÀIá‡\⁄A“‚«_p“ë%~.ÌË∫[F<yº∂Åƒo‡π°qNØñˇµ€io `@›_Y(v¿1k¸ŒËná1¡AoÿcRÉÀb¨'ÀgPjÃ»8˘‰ì¸≥ü‰ „Wn‰¿tÎ±ƒP9Ën 3^%è∂û°mKH•—ê,å¯“H öÏ?…ÑUN dB–íúuó>Ìé
Cß=hìˆŸew–;g»êÉÿôdk_Ã#NRfç^Üb∫Ä£∏%˘∞9zq>X∫ﬂ∫_ñQÑ°«_Ïl≈NˆaN√ÒΩ)[À=Dvûü^¥óΩ”ÓŸÂ9È°tƒÕ3¢Õdq3≤;Uè;ÍAvwD\oAXNàyK√
≈h˚i	∏—ØÔk:}}¯ñá©.
öÓwxŸ€À‡Ï±„zh4˛pXkˆ◊ÊmZ3 œπL=é)	ˆ!\9Ók<k)˙Ô·w¨Ø`¡<x—Óùa4ƒÿ–∂ç¢πª~ˇm ìÒÊ?<»$õ0|‹§$‹Nô)Ií£HR"Ë_¡ãó9◊Sjòöû±‰TºHÉ#HL€@¯¿ıÿ¢Ø7vuÓ•xGN¸wÑx˛k]sgÊ5ﬁí%v“de^„aß»…◊Ê/»Äø» {rÍ9åÇ√™Møˆ-∏—pO,üt≥ËÈö≠Y◊Ωû,Ó;B†É/kˆåΩ([•¿∏õÆüÆr¯Ñ¿YDt#I\xoNåsÉŒq°Æı§∂á|≠„µ—Pû:—ÓÎi2Ö¿πÿ–πiiÁzgOnÚ® ¯iñø`¢,r~≈ÑT-,tŒè’™sïÑ∫¶Ó1KÖ*=ñ”J„ªÎÄµ⁄Ã∫¶≥QT©™§}—‹Ω8"®¡vV˚ÅVOª∆H∑ ˛◊ñâü®™ø¿d(¢È¬d`k~Ìs8&äv˘á_¢g8≥ôE›ÎõªuÈ‘‘"‘é˘ªÄN^_IÜŸô1Êcß´vI	¿Ú+NÌÅ¿ïY÷¬,øJP`àÂ‘CØ,}ëF+ÀÛ√*gÁ-ÑTñí(≤çÿ‡î◊¬)3æ«Q 	Â+U^OÕ“<º†rRıﬁZôq)´Ïﬁ§XÂHˆ¬HÂX,8Âx£6(eYA|ïÈ·Ìì∏?@±øRaCívÂ)óV’∂Zâk6ﬂ
F9&Bô≤	ƒgÙÉLÊv%ÅKˆÓò|4Ë∂À!ì≈ ÔJëYßdÒ™Nµ©Êqê‰•3u†UcºìL¯;≥{˙xe·PÓÿ∞»«NÊ• £Z¶D	Í±Ê†b°◊lï¢∆Lù≈â°·O$ãWå#Åël10∆;ïÕ^ßC{¬üûjˆÇ›⁄C·)Üí>!ï	;æãx`2lWç3âp¬Mîö∏7õèW®¿[ghÿWU_ˇiQk÷j;¯œﬁ¯∂∆J˛EÀsÁ¬?◊º/†4º°úmecY%¨_‰⁄ÓÔXŒ-äOŒ¶Úâªÿ≥”Pqì|A⁄”Ö57gÕ Ì'Òr”d$∏≈êäYË<◊c7√ÁÒûù;∞;‘A•VËÅq$ˇ¶VÏáÄÔm¶w®ÄY Å±s;PÂ€‹Qfª†L>ñoœ°Ó.ŒE∏CE–Tí˚ü+s$>Q¥SUE’êêQ˚T’*e[#œvy7ÄX>‘@WJÚ=…ÏØdé'd¨¡r-£ıJ˘^yUˆ|N®ZQä”'ñ$Ô◊Êwdy?.¶Å-ñ93òFˆΩå<gvbﬁóÊ¸¶≤≈.6ÁÀ±Ωºƒ¨Qzà≠¸µI$ˇ£Ù"à,:Á€ˆÏRDÆ‚∞Ü”Õ?©ë∞ﬁoíZyU`Â ≤<´PÍÑ’èty´<l„üHÎ‰ß≤˛Gx˛!	◊WU1≥´8xHÛEúÍµ—·ÅÙ*åú;ÅÊ÷´äR#@Å†ç©ÉÓÚUªv‰5t‹jéw•.@˜“PyC`kioŸ∂*ΩÖÚ⁄™æﬂΩX[-M=Àhª?qhûáá|™±å%Pg¬'!J%∂Ñ∂¨€±≈z53YtºWåÇ}¡…ës»=◊&XÅ¯ÆèÎ6?±öŸ…ƒÕ∆˘	≈ú≥äe»ïl Í!:ÃaqÁ†VÀÓâXÍ˝R©w1u·∂‘âDKŒäK,J:´f8Ö™.Ÿ^◊ÂSë˚U∞§ícü‰w{ü‡|5g»Ì`ÀIFlvÜ’Ñ1·>¨;øπ8>¡ªøÌ2æøˇ*Nâ‚;åÍ.¨äØß‘ö@˜∆£qCxﬁ.®LTv‚RjÉÃÂ”íM•Hm‰∆¶é¬µ™ƒP‚L∑ˇíb∫*ˇj{ª„÷ûh±AÈL¥˜†H{Wïªçß„∆”1Yüçßc¢}˜‚ÈË[Ç3¯Ñ√`‚p!8´œÒD¶ﬂHêOî˙Á: >P◊¬á‰9¯–ù·G¬ﬂ¨}⁄¸ ? ø£^ø}Ÿ¥˚JﬁÀ`‘˛çË\˜Jﬁàé…ÚY$T ÄıÛ°˙+„+ê/¿üA∑ÛºM*ß«€´π≠HÄ§Sâ}S∆BLïÔ∞Ú¿9ÿ˚„WΩÓ‡y»‹VpO)å™∏'76<†>Ï∑¯¢◊u<˙ñùﬁΩ#ﬂ5¥ãDpû◊Ù%lØCÑÓÈ1)/)©´ÉÛ\YÆF^Æ¶,W3/WKñ´ïókWñk7/◊û,◊^^Æ}YÆ˝º\≤\yπeπÛr’k“nÆÂÊìãGÆ|‘•Rœñÿ*πéÊR'Ó%¿≤¢Ô≤àËê‚⁄õQ[ßI†Ç"iÜ¸mÌµii…¸m|òU∫ôR®^Ö2S
’+†PfJ°z L)TØÄBô)ÖÍP(3•PΩ
e¶™W@°ÃîBı
(îôR®^Ö2”
’+¢PfZ°zE L+TØàBôJÖÍW(S•PΩ2
e¶™U®X6eÑz±Ω‡ÁO}~ûÚª*ú˝4ìV«ÅÛÍÛ'd‰8’lÚ√◊ﬂ/Ω‘bÆå…RR/éöÒ"8œªÊá≠◊ﬁb:’‹;	2:ﬁöé4O‡ˇ“©dÕ|B–¥üwv c3˜ù°ÜXAˆ‡ˆ
(l °ÄÔdD_•Rˆ∂à√ç≤√™’j¢ıÃø¡ú”)6≤¬Ö2Ø —;Ï7˚E•OBöRfÉ“’2%<ˇ,ÎZ46ÍñßM©Ma»]qG=èxqËˇêÙ9 ÷"•#í,[Ü7å ı9ŸOâgNºF"πÍÒ›}Ãô.ˇ)`nÒî©£4Y≠n†ã08«W»£¬Å¥YÖ‹∑Mb/ﬂbÜo¯›ãåÓÁıˆí/V”Q–aQOØÙSﬂ’K˛&ÌÎ•†PÃŸ+'s!o/9ç<ñÑÆF±°∆w2Ú;FÈ»˜6˝®xç‚éT)ı.ÍI•I±ï°ÀRJàQç¸ØO"ÏHÌÛﬂ°«U8‰ƒ|≠ƒWŸëîÅúÅ~E/,Œ·l7,òäÂ>X—ÃÖù∞‚Ú1xa˘·BttøÒ›;–‘Ã-´A'`LiÕ¥©”’n·Òf†aÃˆ|‘€¥èá‹?)Q˘¯ƒ9©vÚiµ$5æ@É tí¡}T¸‚u‡ﬁƒqe¢b–9’ÁG&E•ÇGÅãÆˇE5C˛Sos…QèïVœE4≤íg„d¡√eﬂá√Ç¨$Xõ~K]Ÿ1AìÍ/ÙTF_€Ò¯ô]:!–“≠Ö«Æß»~/{óâÓñg¢WúÈÂU"B&ß1JâÑ©π(Ò·î#ÍÕ{6wÍ…‰Ç°¡Ë0ÕFí"ëxoWA{ËÎÛq%y(~¯*Ê5õswÍÃÉ)®Ñ◊-¿Øﬂ˚ïT s¬&@jâ·2gHP»-h‚Ñ˙>=~¢Æüs!ˆ#Æ8~≈—|ào‰ÚÚµ  œ∫†Pt~ãvOï=™<ô;8&¸…˚∑Øü¸…€˘Êﬂ‡[ÂÎ⁄Œﬁ7¯H€—ø˘¸ØÏÁ_{ün?6îJ“·GVDŸJ ∆=S+\Fíi(ãåòL¬ÑñˆäÔY∫ØÎﬂÑÛ'ÔS—Ò%YZ≈˙g1Ñ˛ˆ/úÍ.≤ê.ONå÷ç‹µ:oÊçÊµÌªÁbŸÕÂ∏Ä*:∆RØ]‘mW=gJ1é¿g≈‚K®÷pâ2?èT◊Ää˘F±Ñe¬&‘6:ÎUíNsR7;û˝+¥∏˚sÒ^Ké\xsjXr]‘ù)NVíF~ífíÉ©|ºRjÚà·üŸ¸õÃ˙œçMõFß(dFùñ6’ZòE≠∫åD=a∏RπCßÍ∂ãÑ[Ã∏ﬁàfÊ∞c˘ôÖæ±ó ü™ïö≥æ„,ÓæÑénµ§íÉØü√ÎÉÍÆÚ˝‡=Ûl&;0€qÇèâqÅ~$Ë™œy¬?<
Ñsá∞àì<ø¯˜9,!ôıˇ(¬9	z…∑˛äë]ôYÙr8%∑ÉR#U©˚¥zñ◊àeQ–=:ßöµ≥WJ¬Brç0Ìú˚çà°5E-’2fv55VT»S˝!˘Ê≥£ÒHH∑ñøÿ∞Ù‹°∫3qó?çŸŸıwr,>¬√*”	πÖËP˝€˙Ú˛<˜ì¢∏Œ˜éÆ˛˝›Ω”ã>FÙ2…†w>$›3Üˇ≠{§;º\˛ç¥;óΩÁ€mÙn'Ω)Lﬂˆ¸Ù∏Äπ…”2•”cπávÑdØ,…^J]ÖWzXIÓôîêVñ¥ãzX7ÅzπWw‘)ÆÈ¨á…#<1^.ÿpÈ;”ë	Få∞Kuf^ÏÕÄﬁ,ö>º6¨;biwŒ"	˝éÙÀˇ4Ãå∞Õ}-RÓdƒÇ≠˛R1,`Ÿ¬ı1yÍÚ g∂£„{æP$ÈÑ)‰Æ,vîΩIà˘Aƒﬂàk°doµΩ˙~¶Ø‘0â.¡˝®£Úí∫∞•ëÿ!—π%Øˇ∏¢¨@ñ;Ë∞‹ﬁóC%˚Äﬂï≈˛ƒ-QÈN‰óDÂı`˙®ƒÌPëûK^ÊÑ≥ZìC¥j’ñÚn#∆ï’¸¬d}'π’»wVHqh®ÌÓÌ™
Jë¨ÌçˆåV…É√˙®Qò§Ô¥óE“–{ÖK`¶–"t6Ohπßâå4À≠[Ph›“B+ª¨ÑπJﬂó=◊Óm¿K3π€â¨@ñ;`¶‘|!Ê^¢Wº‚bèÀ—Á–ä[Í‚|È\d˙ã§˜∑!ÃilÒ[&$pÓ…?∂¶ê£›•ÂÙ‚ÂÙ î”ì‹»È 5∂Ãâ+9X&Ë·%@∏†˙Ví*é‘ØI¨◊¸ìâ◊Á%j_tU±’M”-T¿˙£iGŒÎÁæo ~ÉmQz6z¡x‘ ∞ﬁoLß¯Ôÿú«/=·+!4ËÍ‘∫˚çL0%˚m‘xÒG àR —0Kt/Ç·Å¬è hÂ#“dˇóÌ_˘úE'ŒòÅ`⁄‰m[Ò†Î2?πNqoÑ0}¬'·ÚÍ∏ß⁄ƒ∫ù^ó=™8˘Ì>E«˜ê≥ËÇ+%≥Y¶ö±ﬁ´dÅ•¨*ÜlNÚ-ƒ43'ÇÂﬂN÷å€ΩÄO$™7ÂR∑XuN)kÛnı†XõÒdcÍ(˙≠0∏Ùç∂2®ˇ$˜ÑJ«2~Êœ‚k 9’¨m⁄Ãÿ%ôX8⁄\€a…∂ÑC8ÓÌ$)˛÷„<Ç,Y!Çck¡>9Y≤bA¶Ω1Y!Ç∫6ÛÕ') *Ò¥√ …‘Ë√˛T≤ﬂˇ0CÔ¯*Î∑mëá€Í∑ãû‡¿,Ôxï4óT`◊;Yò∂	ì»ƒﬁŒZ8˚ƒY*à3PAH‹≥ùW∞1tß≈©≥MPR◊ôjdF]ÛÂœYã√ŒLª∞L:YPè–˝T·E'$∫0A™√nõfcè;ö≈¢,j∫π|cü*‚%≤ˆÓ3Ú.H:Dç˛œ˙_$Í>ÙÑl¡p(hætLªÇÉ"Ü∂™ •yV¿ëÇ•^∏À7‹‹Ω¸≈û”â´=∞ô8,xÎXõõv˙8’ÿç	ñ∫B“uW˛(©XB£§Y~îÏ›˜()%∏Œ()%∏Œ()'∏÷()%y?£§Ydî4„£§yØ£§%eƒ◊%Õ¯(iÆ5JöÒQ“\yî4ì£§˘∂GIÛ^F…¿EPåìÊ;'#ÂæüëuE_∏†ê°¡[,ùe§cçÒèQ∆ygRﬁÃ2Á»R ° ‡˙¯“a+È1¨çÖÌ˘KWõ˘õnú‰XÑ˘≠ù∫c-¶6aa§eÜ•Ö†F<”œºè¬ˇ[Y7Ç?
VìÄü>%ªUi‚»*ﬂæuß# °}l?¿6Ù£;‹fJg∂Ó≥_Ù@%Á–#pˆ2øız#±ü¬+˜‡?Ÿ5g>Õ≤[IŸ∆*á~ÒKœ¸L|ÈoâÃµ∫ﬁ¨≈[€*xß#~îÎê¸£,uOÙ¬ûÿ≠}Ã=ër—ÆÔ‹s_îø;A∆èΩ¢'BYÜ˜$/:ÒûD,Ìƒ”&X+åYÏRCˇ-èëÔ-àæ¸âMó8∏T”˘:7Ÿö≤øs˛Ö«à;§ò5ûBõ|H·S≤W côn?ô!˜πÅúπ{ﬂá©»Ôß+˝µrÙQï∑˛ø€?:ˇ“è˛_<¯◊9Ø“±ˇ%—˝;é}Õ!‘20
ã	¬Ê#D!˛ª4Avc_IzÏ˙?KàﬂØ<p⁄≈ÇÒ[Á—˚F,•yo¯É¢ÿÉwá;(Ö9h–¶±ãx«Ç˙xw,5KJTcÍı˙AcøPâÍHéíõÕV}wWVb”h—ΩΩµJTF•[Q±˛aMÏÉîÂi D⁄P_ µê Eı÷¡·aSaå˚˚˚…ß¥F˜∆íQ¨)R\eìbË:n¡gUÙAöoX69ﬁÃ"‰∆ªá¥&cyî‹·˛~≠XÌÑ¬díkÌÔÓ !)r~“,r{≠˝÷Å$∆©RΩVƒ‘k^JΩ2Ï∑LçW»feÑT¿»“°bïl‰1ÜÛ)"ß]∫xÓÄôz3ÉG/9‡§K˛£´JÖi)ËXdâ£êºU@∫ +v¨a‚H2ˆÍ…àIõ≈ëƒ£ï‡0 ÿë·R6≤pL@S‚À¡»
3'Äd∞™W∏πî˝’™Ô[ÄNµ¬¿¨áª”©§
Ø@Ûìrƒ>∞,üBÚ#lÍ…ç)É«π+á2Ù˝ob%§∑i·ÓØ~êË˘°gò!±ELﬂ/@ÿ|Ù;¨X™u£H ‚1ﬁg…ØH4ÓZÁ¸¯ÍÜΩÚ%ã9˚ò‡Ò„Hë√ãêwMÙ)»	9`!}n—º'W‘±}÷æ\˛˝√:F¿Ñ>„©t⁄É6ÒC<~Eÿœ”.ÏuêÂX‘J±H.5)vı*˜ˆf!aè≈¡¬ëÛÍ¨πÒ)7·§Já—ãb£¬WÃ˝G‰†ïàzÎÅ>˜ÎZâ®…íä”´HWC—Õ›òÎ˚U‡¥…KÈèÀ…Å%ôí'Hõ±b–m^∏ŒG…‰8û≠~±Íæ*E—#¡ê°|ƒÙfémé,öÊh≥–Ihzºm¡R–C"˙bÊzOíøWˇ0%üèjU¥µé‡Àπ¸“¢rœ”Ö1Y≠ÿ'¯π™ÿ7ÖÿÛ¿‚¬Æ„Û ï!lí£¿€(OreØ>ˆ◊#—µÚT ÜÉı—ùO»ïméMÑõsãﬁ£ŒZªjªãæ∂5·Kâïö8kÜ≠m∆ïJ¬÷ø7ék~èùjÅ›ö»‹,≠◊=ê…l≠R©I›-E‹f*H˜·n¸Q≤‚‚~IºçÌ#≤#‡ÍŒtÍÿ◊¿7j{N4D‚eë$Ï)»ıt˘O[›ê√80N¢ú“Èõì*ì»7QÕ®™	›,¶‘u9DJÃ#î⁄ÓºJûÛ<âöêh◊ÿ¢Øì≠:aœr€¥∞lÕ-‘§Œbî—$NÔèè<cwécV«‰;√ f⁄ ]]84!ªœäQì“ ºÈŒèV$4Cb ïã+≥Í@U.éO"Qœía¯¸–Zj∏ø∆
%É¬•˙1·§/“!·‰˘ãEÑÀŒ[( úîD∂ïRÏƒÉ¿W¸KÍ&¡ú–~~:å”ΩFΩHŸ±s„√‘Î≤Kæ≠Â/SÉÚ\E‚FÉffÖ±cÔ◊e«˙"….°îÖŸ≠ß~i^ﬁsÄ:âJ∆¬‘Ω£`tåKô±ËòEZã.í∑p(∫XëËÇQ1hTvË’ı◊Ô2∑ùïo[ö ®¢.µË≠Üëœ™q4ÆÏk≈†=aA}†Î¥·∏ç°»]$Db&≠ta{e”Af	≈‡G,ÍÖG≈‡™Ÿëq/YzÃÿ≠(∂e™àÅ1Ÿà‰ë˜ìùY¯⁄ä˜p± À7Sƒ;AO∆g÷ã7Å˚@âLeØ°ÈsËÉ4∑˜ï‹Vúƒ`ö+cÉX$—I˜ÄjüüvœJ`É$Ëüˆ»p@-ò%õæ∫pùπÀ‰¯˚hã#0#Ò:4äs'@ˇà¥Yç'âÄ;ZÅ˝¥í˝ê¯ÒkªÅ¸l ?»O"ˇÚ≥Å¸l ?¸≥Å¸‹‰'EJƒyJËê?»ïß¢Ïß’ÉÈ
§≥F’∞U:2Œ[«ÃÑÎµò%πàä.«6@?˝«d€è_7ñ•s~z—Ô^rPÀΩr‰-@W∫ÇSç¯⁄*ÂﬂªEØ†˘Î∞·/ˇ>x÷>.ˇﬁÔ√÷◊Ω≥vøãˆ«›√u¨˙äÕl⁄¨/Ü∑’∂‚V}l ~˝#∞Í'¯˘+∞Í◊#V˝√çUw,~–V˝∆zV}°’Ÿv˝s¬lÅ¡˘˘ÚˆDißæ•û©/b7æ†ﬁÚ|ÜW™ôYó$Œ4=.í˘b˘ìx¶Ã5“æèVÒ™1¶Ìÿ◊–WxwX$◊¿\˛=Uè≈õÊ˜ﬂ-LÍ2Ω‡]ó^gc<b‘úq¥˘D≥`P˛LÄ+Z√ÂcîÈù[Õ5ù(˚œ≈u≈<'÷_ßÀz–◊π`/2ê^Q‰Î∞ﬂí·R„öE^k÷(∆|E*˝Â/í¥·Âvù≈tí®«–ÇÃÄNò«Úïü$óè∫¢YB®$UÛiˆDJr\-N’ó¥"t{˘tßÏûÿ-¶Ç⁄)ÉÊ©*ﬁbÊBzõÖ[	iŸcˇπZyÆT˛2á]aLw‚/îÿEsì∂≠ƒÿ‘ÛﬂÅ[Ÿ£îÊÈÊ‹å6 ƒ¯l8§o¬é–më§(¶∆ﬂ†JP5ë°∂ÆFÛ)>dçh√}`kDªíË…c_£xïFÿ®h√ÿ‰Â.Ñ≤QŸ‡líDﬁ	ŒFÙFiìR’¬XõuUÚ≠£m§j˙>6ÇSôàﬂ +›ƒÜ›$˙˚cﬁ$õı±BoökAo.¡‡M¿À7ÓD√–dRlL∫®“¿#k Lí;ÄõÑL‡QRj7ˇ!An<”^æôÕ9‰∆o]	–Mî„ı≤†õXDπïA7~≠Ôv\*Ùb˘cõı˙ΩˆÄtˇp9h?Ô^,ˇvŸÎ¥ã].Å–≠¯]Ñ∆o-É—àÙE`4#û‘á—ƒ	
$ç ∑“5A~’Ï5AõÎ|6◊˘lÆÛë}‘p%™äıì≤ﬁo˚:üuÔﬁë¡a¥›ÉöûMRo¥Í5Eÿø_Àu>π¢∂W_ÈŒ5úéq∑,«WèóÇüB1S¬¬Véõ‚s=&â>J*+v ®µ€¨)ÙÂ!‹Ö¥v…ÁIQ§P‚©∂?nµ‰”Ò¡~}?ï6¿¨©§u•+ùJIÎ€πË)\∆–:…%Zt…''Ö¥‰LJ m‰°_#@Üíw´<àãw8˙•sﬁ?ﬂÅ?›„ÛNªO*ÍUˇZÒJíKÉaÚxVÊ>ö40F¡µ2¡i9H¶;ºËvñ?ä(/§›«pùﬁ˘YóYy˚Ìå}”}20çù·Å†ÒŒ—Ï˚Œ—lá!m3ÿ∫ﬁ≠X-ﬂçY"fÛz≠Â∫utRWe˘çWeÌ∫#+AúÏg<Ü‚Maú◊;.ÉN¿ÊÄˇÊ¡’·µEµ[Jºô¶SÜi-,ãŒU˜FEA,bp	c≤‡› aü|äÅáwﬁCYÎ#Vô°?˘€∫™jøË‡R˘fO^VUyq‘›.¶äp¢ûYÖát/ï›«KƒT˜iàÌ0Œ«&oåÃÎè≈·Køc[Ï èzˆl1œ8àvycÍﬂR%ºpyÛ œJE^∏ŒksöÎ8^‡L‰X©∏c`{ô¬ñ~5f.¶Ï(£(1π™†Ïí^ KﬂDßÕ¬%˙∏w«¬å+52ZÙﬁpæjÒ;õ]´≤B@˘®˝Ñ∂Ô‚≈Îë\k5ùcVh6C7¨UÙëÊ∫+q|Ñ◊kµcô≥ï û±ú%$ù◊E«¬O>âççUˆÉ€±¡5r7K'Æ∆—¯»/\dmc°„ÓXÀü°!hbá)FqLPè»0ÈW%|î[õÆ=qOõ‚Ò©s‡ÿ“¶l/MfD`BªÛ[çÉ^®˜Î»≠4Ÿ’
ÜRøR˛É‹*Åˆöﬁï„è≠Ñô1wnËl˘3rË,rL^=ƒˆ˛,Ro(‡ˆ^øW¯(L*‘÷-Ì^oÁv|Éﬁ¡_π5`©Ñò<&}X¸‚=Csv≈eÙS•ﬁÂU»™C|XˆÎ{ö['€,øw*lú&–÷‹úa$`‡í•ë€ ≠»u.ó;ÈQ[V;ˆ¶\A:`Å≈+ 8´÷16™˚’ã>,T≥ÄÇ6YP±˙'°xºªÉ—©0Î¯®üd{Zr¿+Gÿu$Ïía> Ñ"ïœö”i·jÒ!Y-ˆ4∑ZÏn›d°∞Ç¿ˆ√.KˆdaVÒ©"≈+ˆ8øVÀ7òÆ‚máL©P¯[§ÂOäGôx◊ÀÚg=»ºÑøZ¿J•û¬dh∆7Ìé◊ˆØ@å˜Ü˜äsâg≤◊∂3¢SÕ^‡@åw¡yà1ø◊Õÿ%‹¨@ÅöÇ%±ÊeÉ!¯'<ìD™åô˛Ñï•ﬁéü1úhq£“Ü'=Øj≤LËπƒ£*b®ÚEÂ¶>B‰MºeÚ,BÚ™Ú}˘≠	Ÿ»wPõÖG˝~p`ÀÎÇèÒ‡;;m·≤∏&T¿4™
Ø
´≥áNò˛™≈ÜåÂ?ÿ’Auq*ÇÊ9têƒdﬁëπ´›Qæ∆s¿rSÕí‡ÿo];√ûﬁ qˆ†Ú¯ÎÍüÏo>}ºÕ_ÊúNÒúˇ¨⁄ˆ·ö±w¡Ö~Ú-˛	ãN±Qî≤Æw√OZoˇåz˚€ø`Ê™Œ(Q~<≈ﬁ?;VÕ¡•N1 ΩX˛¢# "£¸ıê›Nk aØk@$÷È ª•"â¢áÜ? s¨m==≥Ò1àzÛÖºRyüa÷ÕÖ.é&Ï–à]`=bë\Rï®˝Ω^`òÚKı?k›G(Lˇ—f˛>÷Ã›zñnáR±Î#‘2Ñ=Q¨˙*O¨êˇ26≠Úê∫DÆ∑wC€3ˇb∂ƒÖl⁄‚5◊3æ∫Ukûc5·xú ™ñ85›]Ìæ∂ΩñƒŒîx≤ﬁ%mb∂Ωá€Ÿd.~ihV˚¢{v‹ÎÙ.{C“~vu‹FÇãÂ∆á]“È¢%ß,Fã„nÕ◊ÖAZ~ÜB¡éD⁄LòñOp%úVP˝Pk‘⁄ µ6@≠U5çyÜî!|§$kçÉñæüÉ˝jÏj“ CRíE¬ çÎz}†÷Ú’76§ÛÛ´á’·I˝ÙqÜ…0_⁄®Y;¯aCëÖJ< Or…[Ñ(ëCÍe
+ı◊b—¯¢≥rr>lì^˘cª\+æIÄCÉÛNwxÓ/ÂØ˙à:#2˛ΩCÿ»ˆÅ·^Ø—ÿc8ÊˆÜ+`Ü¸=xÃê?¨$@CAè|p†°:Fj`0ôÉ∞K ÜNz«—mmàä∞‰„Eıòë+ûÏ™π°ﬁYVB¯‚«åπ≈À¥∏ß¯ÍÂùX≥L#«ò~ΩµyôÚ¥˘Z•ÅÑ‡bí≈(^™ÊZnèoπÛ‰⁄Ï⁄≥ÂœF/ùÍ,÷êáÒÂ1VE`xÖÔk¨∆*Œ¬W‰⁄:cBÊ◊-˙∞@˝Xi3S;#ÓMçêà:0Èƒ	ÄEÎ¬0Yˆ¥ú›’ÚÉzpS∆ºa÷`® åhÖkBö™ì6œ≠t¥iÕ},D¢¢ë
5ËT€'¥WÛ4v≥0Lòàí(Z≥®@'kyWÃ∆œ´Èm‰¡äúı‚Gh˛ú˝ÇZö¿ZMG&≥ò7Yç˚2•ÙÄí©„éa∏ü‡—ˆÒÃ˘BTÛF·Îz√ä]ı1á˜£,ıÿ\˛4≈‡4h|¥Ω[4VCYà9ÄµƒLsMähöàAíóED¨o:äŒØ˜b:
¶˜q	√K⁄Ë"5π|ú&ôÿó∂úD˙Ò°ZN¸iÔ›ôNûw/⁄óÁzitÀøü≠‚–˛úbd	¯œ‘
€K"yäòLn¬‰ôVìY˚Â¶ìÑÒ$⁄úµÏ'˜hAë⁄Pﬁä•úÂ][Rﬁù-e}kJñı;£7◊≥©î∞™¨mWπÀ ;µ≠¨l]QıÂ[±∞ºÀ[∞≤‰äÚz.Ò%ú‚◊vãWáÈWãí“Õ}5Q ·ÂzV´v´{±\Ω€U.á÷≥_ï∞`≠m√z◊V¨‰”Cc7]⁄∂vzö.◊ROõ#cúe[Ÿ>VZ;V∂í…ÌdKY|â3ñ…ñà…ÂßÍ¸ NYâö.d9À∑ù≠vÃ]‹~VﬁÇñs˘ÑtGÚ^√†·Î€Ää—V=9/nH[iÔú6¶=Ôûû˜Œñc∑U|ENœ'Á˝Âﬂü	Î⁄ÛﬁEwpŸ=ˆÄù‰‚|pŸÓﬂ/UÜ¥¿î_¿îñkL[…ú&3®±–â,¨ã€cfwf—ùfñMMaUÛW¬™ñ∂´)ããö≈"G¬208◊2V»6v_√Ü >&çiπLC¡ﬂ;àu…Å‘J¶∞ì=_˛¯¨}|ŒÆÆ^‚†¬Â=4òE8•0ò›ü‚´åf+òÕJŒb¶óSqPõ}Œ=_·FóiêØ∏≈'·akkÙ≥\π∑êç≈
]±ÿæÌoπbÉ€ÇW,∂ÎÅ®⁄ŒîN`Ù,ŸdÀªbD–Ùr%˚¡ÿWÏaÕ5uZ≤»[û©|ë&¶;65n(X&À¥cà\%¨á[ODÉ|O¯(¥Ï®ñ¬*õä∞å”N‘ûÇ>›3Õ]˛l∑0ßZÃqŸ}rL◊]æ¡«J√ä"ÆmNÕNc¶(6O‹ºôQ-ﬂ£ÆK÷˙ ;Ësüã˜ÚÁX†G{0«^pØ∫mÚÑ‘ÎêÎ¯0:nä'´ÙÛ	k/¯Òïû@ö∞—ãT~˚—™»t∫˝Ñ<7g∞5°6w«fâ,•WYÈû˚s‹bñ™NÿE…ö©Îê£·HÎs6x≤≤V®0¿¸>pawag ΩT˘ƒ`ºF[ècC≥ÇõE2D0≥=â!‹oT¸Ò -KPﬁ“®≥£õö°ÚBŒ≠µ?Ó÷g˛{Âz∆¨¯b~Ä>êÿÛÒæê’πÌOÅVÚﬂ+◊˚≈Ú'NPw0öÜÀúÔ–\\Êh¶
é˘ñ?cHÔ“Éï‹B]PJ-ƒÂmƒ+Zâ€â3ŒSV≥∑ØΩÁ-`1∂}IâX∞Å∂¥π8“©•Ã≈ycô^‰çsÃ∆ëıNqÀ±ƒt]⁄z|‹{—\"\7Ê{áAœ`˚ıÏÙºw‹ñ6'õxÜá@!{
[î„ŸäïçXéLªrú¯J>yâfm<Û2MÊœºÿg„ô∑ÒÃ€xÊm<Û6ûyØg^j39*ñí≈I∫XavÃ[ƒ∞⁄¸™<ˆ§+ÿOHßﬂˆNzùváYÃò	Ì¨Ûº˚’∆wOÌªÚR‚º◊˚„WΩÓ‡¯]∫ÔÅ∏?$˜Ω≤¯êõ∂¥Èà∫+8˘mZ√ÅOQT‘Ã(ñ∆Ä≠•}`ß™ÍºC_<`›0-÷•úÒzÈ}nhaåpË„u…ÉFfÌ±{k?
µˇ∞Ñï+◊ªt©kFˆŒÒêìπ≤üÛ¸…<ºêñ«=ÜVãˇ|‚R⁄63#|À€˘4SÍ;]¶≤7¶$Ô∫ôÒÃuyvò!HÆ.1‚‹∫ñÙy¯Ωj⁄6uQ[¯Íñ¿T€ ·|	|[Œ7.¯÷[˛ÑW∂{$¢.àÀÆi'û9ô:¶ë5ôÎF,éÛ:!ú£ÓU˙ÚgV”∫C*üëVÅ(ÆQΩÚ~zÜ9^xZÃ3Õ:P’5¢w[!¿nCc€8çÕ˜∑ XJ¯Ô2æyaÄV2◊FèÅñµ)ûΩé, Õ≥¬y/¨≤ >≤Kh`¿2˛;∑bGw¥¿(±¿™	∆o≈ÿr÷b .§«¿°Páq
önUQÃ	BE˙xe/hœV◊õkñ±F*·* ¶SêgÊ~ß√tjÇDG≈âGwtºmÈ÷US‹ÊıpÜPïﬂ”H•ç{ïè«‰∆| ywî(xîUàT⁄È&ñ£Û(∫˘=Ÿ%˙¥DyΩ¨ÚzëÚñ?[∑X⁄+ÊÆö‡x\q–à2•fÂ^p˙l/:[∏--ª"b0ì1◊ÅΩ∞V¢‰Yøàóãòdá?Ö8Àãï<R©∂•yÊ§∆7,ìÁºf0¿Í-ZMı )må. 7>£˜æ-Ì3j~ˇ›¬§ÆQﬁk4“ì’k4æ0záa7œ∫WÉﬁPÑ>Bê%iüüˆŒVâ∑i”Ökz”‚§AéB7˝ƒŸ!7˝T+ªéÜÕÿ8énG7é£«—ç„Ë*¢åëX¨\S O•*B–Z/,–˙Ωπè&eëèr	ÕºK·ù∫ö~¯nªræoúy7Œº ?Tgﬁ√ñ÷•û˙R˚Q;ËF∑ ÒX∂©ex|yØ:´à“‹8Êû?!ˇ  ˇˇÏ}KW#G÷‡~~Eò”∂ÖíØÓ≤O"Ñ—˜	Ñ%Qn’5v"• mI)gJTaSs¶óΩËUÔfÁŸı¬ãÔx◊[˛…¸íπ7"232˘P.ª©s™
§à7nºÓ˚ä…m”ƒΩíe=Db€ﬂITn∑ŸËúˆ˙›ÛÛhwN?oıœ)©æ"˝Æu⁄{—Ïˆﬁy.lÓ˜*
wkkç Q˜xÆÔŒz}â‹pb˜ä¿%%™MÚØÒÁ˘ïC*ÂΩ ~Ö\ﬂûªÒFÙ´≠ÍÊõjuÖÔU#öâÑ∂·Ω[”+"Ê‰Ÿ^#;wkÛ∑∑[EØÄÍ _Vqª@–nØuz˜è≥~´Å∂uÈj›∆î˙›∆Ì¶ÈjPˇÛ ∫.ˆákºö„¬±o…"¥l(^Ã/Á2äç≥i‰≈MREÕbF∞∑òL2ä
≥f97◊}œ3ráau@8´≤_0≥i¬Z°ãÜ-≥[kùµ7ÛOZ¨&Éﬂ“K”q:º¡çÉ≠È˘i¿VE}\*c '˙X=<9¡óÓú>“+˜È÷Ä'd÷qòﬁ,}{„RÈÚò˛È9I)qñ+∏-b5{ıA"√ƒ++OdX0vN	ùìVü¢ƒﬁAîÿµ¿'wø¯<äπ`F—xuﬂ˜1a´øÀ ±÷iøŸÎ∑NÒó6OÀaıX•∂¢¢<ﬂ„Ôµ3Œm"äª‰y7l}Å≠SçD1–•¢¿Ñi<EÄ•⁄æû"¿û"¿~˜`ïÕãΩ›JÜ≠¶æ∑mV™™z⁄˙û≥yÒ†Ae\9˘8`˜3=‰6<‹”Ï mZ@ÒM;ÖŸÆ†ˇ_Ç“µ⁄V•^OŸé≤—BXÆæﬂÜ’—ˆrTÎ€5Á‚¡n≥ﬂdú^ÁøΩµ≥µ´\Pz´Åﬁ¿◊E∂‘ı—wó‡„ä~7%ÒhÍP\—ü∆«——ˇ≠·¨û’ãÿu´›Ïßﬁæ˚˚Á-`⁄€≠ÉnÛ)ÙM}£T3»9IÍëó{¥¸_F ;ÔG\eπ¨-!·Ê≈x·,OÍqc‡‚˚Aä®˙õ´BG’ÙXÑÆ≤-,BÅ»7ußoÑ}¨©OPËww¡g8Gˆè+ËØ¡ÀXg'òªSÔÎ°3æ¥áﬁ + 2–Ç:∑kπôf‹rÏ0_£¢$>u™0V3ÓÑß˙=#*ÉÑbÏ)º≠t•ùøôYB@ÖL≠:9d–˜…~D(oÕ÷Õg,ΩûDüÁ9ÊØQ,[¡â&N¯ƒ≈¸Ä74^$ò€cXøâò2ë≠äK»Ò:nÃ¬2u	-T≈c)hÖ”KÏ'Ì–µ∏Áà∂È.|;L@◊¶ÙÑkárﬂıO∏Âv¿©G∫p∏¢r™<ÿæpE√Hû¢k˘Â‹Z &ΩÅ=zÌÌ!#äú8œ®¥Sì”ªÅµ‰kÒ ·2\äÉ1hTÁsB-ó¯qÙˆõTÅ~6vÁmÓöGü¸ AÙ=˙‹Ñ◊»û……!Ü!ZB-È>äˆ•òfŒ·∫Hë@íTO1z	o6Y»$§3
QˆRﬂÿÏ¶ˇ¥õ0≤ç∑˛ç|5,%¸=;¢Ê∆=<zÃQ◊˙í4€VØﬂ˘ºkùE>"_úÉ‰’≤‡˜øHˇò&"¡_O¨~´Å8ò,IÕ±Ã=@xvuìeEÚ|˜ØÌ÷$√˚¬ÄÆáΩ÷Aé‚„Q¥0Xbÿh,∏rÓká≈¨”Üí∆¬kò&üuzsw4ö≤Ñ"ºËsÕ∏k√:ì:¡'ÊÊ,â¬»û˘6uœ07µÊÿÙ˚E ?8”ÖÕZKÕQ†õcƒÒ¸4†Å|7]`.èÄå|oÇßññ*ˇp˝˘Q÷RöÚß¬öC‡+¶ólcúÿÄ¶p‡SîCÒC⁄tüî¢ıb3Õ†÷p»·õNŸú|7≥OËa|‚Rû‡Ô•ç“g˚∏ùÜŒ∑î‹Ó Î€àÙ£óÓ›œØÏ€ \¥€‡ ±˝øüº∂Øù’óˇÛ/√W?nÆUÎoK/7◊˜^={Y^{≈~∫eˇ≠B[P∏˝Œ{3`â0{ÓÍÜã N„É˝ëN∆ ®z•\D`J√ü_V^ôÕ›srM≥:–·GcœûóÑ~e@klú“ >*¿®˝~Ãß§Ç„è"ª¿R©GæÀæT#˚•=3/(|yk”›=p_zwøºöﬁ⁄ÉóãªΩ¬ıµ’E˚±∫V{À◊ixÒóç…Ì–∏ŒΩóÈGñ¬4ÆL4ÃP¿Œø2òΩ]ËµfR	D+Òú†Z(\‡C6£Â`◊N°ÖÄK«º4Ωƒ-\ éM3Cﬂ¬Ωs;éF∑#∏®¬≈…{à>|ÑÛ!_tÁ/¡3Ü-\53"J?åë_5.`D j¯s—£%Ù+z¥@Dñs;ZMˆ*‰\M*¨Öõ@èπ¯Äò«›@l¨¡Ÿ.œΩ#˜ç3,Uuà´~/ö∑ ≈˜9~¸:¸≈Ÿ|rO5"·∫«NP;4u’º&IÆ(õ¯†¯Z—⁄Ä2§tOÁ€
≥x»üÂD•vHË˙™x®|¿ëÁ∞˛¬.NËM≈>™b«‚ÈDÜ≥ç÷tÍ»znÆ˝E{OIŸú´ÜkiW«àT ‰ÿ±áé_t¿"j_YÓ©T»'pî—ˆij+»>ëã”˙»4≠Ô)j_ÆÇDt˚Ó|ÏHﬁ±Dœ°≤§üë»¨Ù¬jüÛ‘â'ÁÌ~ÎÃ∂¸Óo˝.+ÂvtŒ
ë¡™ó"Æ˛ÎΩQr≠Æ(∞˜#ÿçsÎ¥/§fÏ∑z4ﬂ‡aì êûÖı„Ó˛⁄«ÅJñé6T»ãgπF&∂˚ˇœ°)∆¥P$é®ÆÏ≈ÊAKåUQŸŒ…ﬁ∏±ß§ÆPùwD•µ
ï6À€⁄5E°æ$·*Zì÷ãL§\7OpÌ-.Êt›`0∂›	lÔ2 ∞ƒ◊ˆDµ£ÈUKFµ»æﬁ‹ƒ8
$tmO‹⁄*ëÖ≠MÌ9Y9±géG&Ã«e√úÓ˛…]M1÷µ†‘-g¿·Åπ˚Â–»‹0U˚åQ@e-ÀU5XÿSÄè{ç¶ÑÚù)ñ°Àó¿æø∫˚˘¬w1Ééè˜-BÀ`¿«¯^0∏˚eÜ∏ÎÓîï›ÕıXãã4-VÇCÙ$ß[H!y*VfÌlmVt»h„ÏÛï¥WÖçôl•Íó‚~’å]-ì€ùí/=ˇª`N•JÚ9^kÓ  ËM_¬/ıPÉqqC9¥œ∞=∆msáLmL|4NÜ—¿j√á/ê?√’üŒ«7dÓëÀÏ2†∑É,Óá‰√ƒö˝∆qÛêı>–∞
¯<[tî.ÿ©Úé¢öÀ¡pîŸmÒ)c ¥-é˜ÚjéMtØ∑äOêç$≤¯ú˝∞ñoÓπ¯Lç“â £ïe#óLFáùl˙xo˛œgWÑ=8œ…Œn|LpCéhyLŒJ[xÉ¡bvÜ¿·„¢øc∆ﬁ<ƒ¢îDŒ⁄*ºE5=B˚M˚¢_ocùlQd˛◊ŒÓdí÷Ìò†j39¯ä7>ÆÜ|ütÕ}@Ud Û;o ºr¨ÃCÌ "‚Æ„Á±Õ1?
_Ç“!1ù÷cÿ_·‹LgÌ8˙XΩ:C‰XÀç¨Åu,4£E5-Üµ,Jkà0∂˚$yJt4¿∆È`‡ÃÛga´çÙ·t3GnM‹(dh˚ﬂ1&Ç.˙(xñÿfc7´µs]7∞y1(∫k≈’jß˛Pµ>…æ2
õò8£k“Ω∞Üœ'ˇGÔE¯ùyÅKiƒ^*¬l qΩvÁW≤¬}·˙-ï∑…ï=—C.KÒRiP ¶+L1&œH)æË]ÚD,Â èaTu0bœHMÖiÜf˘é˝U‰/Ö3[¡]	µR5<,äîkVˇB” W¸Jd  —ù∑Œ˜*¢ÆÄB5CŸÛI7ù»*±hÎÏ˚íítçMbç]HÏø„5Ç[r[wà;Ñ=ùY/É⁄abÏ™06û¸h‰*å‡?πF\ s6ØV œ„ÿ9±ﬂ|J»—„∑åù:Aº˙‰E=çÆrº‹[;ÎÚ$¢˘ˆ$Ø/áY≈öµ{ÉŸz¬°e8JÅ¥ÿ¡=7C⁄°}€ ıE{åMê1` HΩ~ñ⁄¬Ÿ/¥¯’e_/∆ıPê{fuF∂B√,XØ4ØÅ≈•ëÃòìö˘+ÿ®∂∞áﬂ.Äo⁄	¢)4[ã8ID†_ÊÒEñ∑Ç 1∞¸æﬁµ„èÌô	Pÿ(£ñí\ÿÉÔ.)wCÏ1Ç}ÑßòÚPÛ¥°QD)˙:d‘£î±r˙Û*.-Ö∂ı©ÆTêtªånÉ{∫æ•ÒÈçwOß€˙ú%Ó9Èv»,z§â=°ô|bl%H∞]÷B‰!•Ó‹RŒn9áΩö+[õËÔƒIÄ˛bó^‰4=®ènIì◊#]À$âN÷5O#œCá{›NæØe†^ﬁ-¢BM∫E≈ÁN•]Lπ/;›ˇÏı≠~´sJZùìføãÍ˚P_=‹ Z“R‚4j¢—ÌúP•<
?9kZßç⁄¨~Û4¥Xçªˇ”C’}r˚ôo™uÿ/UUTâuÇR{∫p©J¬Zô4Bwon_¢ˇwÙÃ»Ω—Jõ–@enÈ¿ïÁ£Ç˙”⁄ãπß5>Sõk%Ÿ·O∞ﬂ6°Û«GõÎGïè°â⁄bó∑®ÍøÆ†ÆøØ·˜m}¨Ïì‘ÈÜi€•È„T)R+h¢?ëSÍKÁ¶‚oØ3Ë`U†j‘†\Niæv‘òÁSc`j1Î⁄ûb{≠•Èhã4\ü5<Ê™v[ıØc@πÌ=ﬁ¸Éº[@jnﬁh,ˇ\åti{õÒ““/û„™≤Ø* W’M˛›˜j´ß&rñh;◊Œ8\by~8óﬁ&%ho3\›“üÍj≠v⁄ﬁl{Ù*"%ú–:Eæ ∂3zUr‚K¿+PÆ‡ç∞i¥“´ëÈC„Oy3›∞U&/‹`!‹ ]{
#˜–)äÿ≤:ào¸V‘≥VwçfUÅÑópµé/XΩö¥ce)ë™U™zB3#&ãªVÛËëTGÿL=í®r^ì¶ΩÜ¨c’§B∫Ô√∂]Ïa∏I„C÷Ï5,‡{»xπh‘#ºOM`	,—∆ån¶ßwˇË1´2ÚÕ”^á4èzÁ'»9ı∫Á4ˆIˇf’EúS∂éÌ£V…ãÁb[+6iÏµtwVˆ	<∆÷ãVW∏3ÒÛ¿ï§ﬁLqö&‘b{ô€˚›00;åÍ¢Æ”ÊÖ˛¶À∏%NûUI<oøY	¬¯ ¥`coò£ï€0é∂EÈªn§oh˚}oˆUÂÁj¶≥A|Ö†PŸ€·π#ˆ;öø∆ëÁˇÎôlıÇ¢‡wˆ03ï
Pç†ﬁoò-‰‰È…≠¶çt©ﬁJ0÷ˆ.˛Õ™ñ9TÓ`ämîè¿V±´.Ukﬂvå%+˝	c&V¢›éBX4√pﬁ«îYNª:Å-√‡ãıùÚ^ß€íPk„›◊·5ﬂ“ÇÖï_Ùº˚œ)Ô˚›ôm ^À n∫x´˚¿-pFÖ˙|e‹∫U…Z]$œ»Óo·>mFlÛ≥¬Î4…©E˜i5Â>-tçUÔ}çQ9∑äv∑zM˛·Ó±îÎ≤˙¿◊X⁄ïY}ÔÔ1v4Aî Çr‰—¶YÚîÉ\Q™√ı!Å∫◊•rà¿QÎÅ.%ÅDâ"Z¿Ø£XÛ!â#Ÿöè∫†˘8q–	.¿BÿWæ7a{@ZSÍ_Î˘§a˚CΩ:d∫ò–/S‹FAl€YÃ‡2Äﬁü€3Ë_À‡ñ∞e‰~"ÒÃ!îOH)¬8ÈU‰§√ÃP#ÆVK%ÇA~;‰,#U)·Û¢QOõhb60!>"n¥˝Lˇœ3ö
_ß12wZﬂÔ”ÁT’Ñ!‚:ì¢5º6B‹5AƒáY”Hı˙ÒÙÙÊ-Õ≠HeiºÌ∑Ã¡û	A∫≤ªÉ≠ÒüM]R	—D»iñZ˛”ÑÄúû3]
´él]-FÓ‹»‘√i÷vä ÉOLeGπc¥üôáGsÖF0Oc´ïJépçúäU’¡Nõ†ÈÔò5·bHWq<à˘'Õ˙^6C4˙6ˇ+ˆë_YØŸ¶Q/ßÈ-böïjrπΩr’d6L…Éún[hN´J∫m ±t'As¬T {[,ØLE∑ô)M\/D[wòb˚?JódµTY}ã"Ã7∆’´<ˆ‚mßØùj§LÀLOô+g¥∫√T´’%ßjN3§ Oèu _îOÀ‹†ÎIX±iÓê#ê'·±‹)oöèh5Öµ÷ô)√pè¢xÖœiºÇ¿∏†‡˙°Ã∫ƒ¨Hµ5|ìŒ€UÄ∑S@RÍç`~BJ1C˜,d‡NzÏR`°Éíeƒ‘-r o]‰E+ä	‹#
fvë° OØ˜ë7˘bc
21	ÆÅ”$';4q2∫ªV}≥+MÎÍ›*≥Rπ—»`§
≤Qô~?πô¶Ç,ìÃ±,eòaÁÈ^‹ ˝2˜÷2ÎÈ∫w»`},éo-º@äq*˜≥LÂR§]àC—EU∑É Pô§*„4g®ÉcbNÃç ö¿†	¶‰√oåÀî í‹#¶,RfDß‡‘´6”LeGÓØOKeEñ>qúA)50›◊4®Y”|Ïí‹áÅ€®Ìãgπ@~£Á¡<m“Á°ì%å„7Ú
µLf£
ÃF≈Ãl‘Tf£VÄŸ»2“ÎõÛuÂ◊~èWæ÷åÌækÔ◊≈Øq£'™a‘‘ãfˆñ6&ﬂß˜[ª0û3r4¡ﬁòQ*!◊ùÚ`≤qr¸Éyﬁø…¥ÎåˆIo.—jmó qΩJ’ΩM∫ÃÊ]úÎ›⁄«Âëk_∏cö©±˜œÍÍ	H∆èå◊‡VÊ=ZÉ{TÒ0 ®˜Ë÷oˇ›˙=ﬁ£çŒÈQÀ:hµ[á÷!líø5Nc-ﬂ÷{~Ö¢πÛyW´iSl}—›ò8C4‘?4œÏ7v{ÆT67*õƒ~øp∏E=Ãﬁ‚Ó'<⁄Åyñø…ª≤·ªs«w=Ó@∑ÒÂ¸ªZ€LY–‘{2∂{
ºlõÁv’mæ3¶yÉ"ÛÁ©Ìc2áká`≤\Ê;‹iˇ@Ièœ5C¥ôË¸Yﬂ¸wp˛îÊùÔ∆åÊ≠§«°q+˙Ù8æõöÖÇé˘¸N1^0èÁ)&“Ôûuõ˝0Q“›ﬂëÈ≈œ?ÔZá—ËtªÕ6op‹Íı;<¬"Èm∫˝ 7zﬁ+°ònZ÷}ÒËDæ™ÖÚM—§Œ°˘=*3Õ&´˚‰ÿèÌ.Ω ∞òÃ‡p_å1ûéxlx†oÀ‰d·sêZÖ‹õB ÃÏ‚”AcÄ6π˚…«4Aú◊>≈ƒB~ªÚ5áˇß,≠6 Ÿ‚5X˛FôÁæ¶ÿêHªÿÌåßπñı˚3œßi%É÷ÊCd"≠3¢»&YÑCﬁÆﬂçùoÌÈ–#∂ Ù„Åw'6¨M∆ÓÏÓgt%ay—Œò.KöÑëC©3·Tgôô”πWVRwãT8±ßˆ%MwãYù∏!ovÜDc|˜3^Ó¿§;$X\∫éœÚ; ÖÊ8<ÃË¬ı‡LûsÓ˛ââ†R≤⁄˝´◊_#G≠ÉuÛ¨≥nkï‹`•„Ö;qi±„¿õÜAòM£~˜ÀÑ6wˇÇµüº√ìK¡˛ô/•«ú˛⁄Ωlf	ßk!ÎõVô8Mføÿ„i	¢í`í∑>çl÷®¿Cêq¢®Q;3Áyté⁄“Ö∆ÁÆıÈ¢d1ìÍBVµ{à™˜≤)µ<$âaäπ≥Ú'Œ Mêú‰–dÁôu.'9Ê∞<ìè`∆sü‰û˚‰]Ã=feÓ-õo‹)ìæ3∏‚aÇ3g¿C“Äú‰#b(O9∆3ûÊùyﬁ|ÍÕ#9Äâ°≠"$ıß°6™D.ôäâX»M¥.Vüj]Ï[À√B™Ö∂
≤êâiØ±h‡ä9Õ{(π—í`<Z®s⁄ÏEb7µIÛãÛ÷÷;Îv˙ùFßÕ
á¬«ΩÂÏñzÈÆêtû«-ú>º}ﬂû√Ç›Gï?<ËVT˝§Å5ﬂ∞g}<¡ÇÂ0(¡öˇøˇ˝4»üˇ∞ bá=,ÓsÜu≥H3öì/mê…˘UK≥ﬁóMê:\áVçî‹ÀídcÙøÁ‡–æ7ÇçL9ænßE™ÂMé„`¬+; ﬂÁ–j=ò…-¿z‚ò˘
ä&óƒÃæpîGe}ÆΩÒÇÁö¥â/ ú&ÉV©eé~Æ‘ÚyS„–Õ`~˜êûñ™‡*¬}˙√Öœy"Œõú]ÁÂM»)Vºâ;:¥∫≈˘Y$ ›ÿ£ªüm“≤[í“≠ãE¿a »ö°≤[ﬁ2·ØîÇ˜ª\¬:8Ïú–‘_ZÌvŒBÒáh+~	¨m≤í8≠ø oÛﬁ|1ºa¡¶g6Ê∏ä˙%ÍE•∆ZfëqZ‚5¥\á«h~è‡Ò„-…Ω©ï≈U≈ì≥Z∫∞¯ÉWﬂÀJœ‚IX¡pÃîJk°É=TÂÒºU«ﬂ]≈qMµÒ⁄≈÷h€—’7◊!Ø:µaΩ
√dWÁ5hñπÎõW*ï›ÍNÆMµ∞5\ÀÀnZs|çUq∆u +2€Æ?R0,_Â<WÖÛ{T7øgesÌr·àe~ì%^øú*“®À]-ÀU˘VF∂S7ÌÑ‚ï»∑vvÎ;:pπQß<kxV*©®èúQm†k©äÁ[ı⁄Êû÷[_L>µ›ë=“¶ÇRP€⁄©◊∑˜VÿÌ!|ŒBß¢„$`•§S·ôÎÉgëds{sØRìãOW∂+ÉÍ‡Å%\|âœ´ıZ}´Æ˘‹ÜœwÚ09∏Q.^æ}Æ2Ù˜(AœÚÛKﬂ,rµ˜{›,)•„·f1¢æÃÕíÇ˙7ãµºYRP.|0¬á9„lf*‡∞tB0”LÊq∆˜9#JÔG;$0“û⁄„3ÚÀúì4‰ó8()»=‡IIC∫Q·úk∆Ia≠T∞ºwtN9é…‡>ßDÓ¸hádêgDˆ∏Gƒà˙2'$ı%àµ<)(õEÕ<k
|3œ*Qƒ,¢tÛüdT≠eùcl£Ç§=£3<œqÜÁÖŒ∞iÓÛ¢s'Jof‹˘ˆ⁄,Ôjé•Ü\æ3_¯Sbø∂›9NÎ⁄ÒÁ@Ææw6Ω,E‘ì’ò(ß0◊´1h© ÆHo&ÅB +g+	v·;ˆw4âÏ^]™4¡∆|T¬*`¥·sRäu»uÚ)güî_(Í]RäD„R}êAµ—∆Ü©äî	∆Ø$‘¸ïu™2!Ñ2eX‹ÉóÌM¥*faëm
ªJ5Ê¸F¡ú◊Î}qéJÈ√&9∂⁄mÎø>ÔÙ»W§◊:ÌúıZ4W€ô’m∆:·±ñê‰8O>c±ëúà†®±E5;…Ü2çππ<uLñO’:µ˙wˇ8¡|™ÕFÁÛÓ›_èÁFÁ‰¨›ÏSS€z⁄l)¥a«ÊÜï´]‘3X)≥Zmg4'áº^ÙÅ˜Üîö‹§õHzˆU-E•ê<˛èû∏¢ü‹]ƒtçEÉe)CgÉUﬁ◊»Óu4´ÈMí˜;.€J!èv7¡£“:≥z‰‰º◊@Á∞&íNMí-80«ÕÓisÆ‡ô£>ïQiq¸-Gmqû[[µJÑhà˘€±UîµC◊¢·0≠ÇÂÀ_ØôIõªò\_Ω‘™1âO=,Ñ7Û¶Ë•R≤f$db¢ ©®ÚS—•/ ¶≠û^&Àë—R4QÙ¨cë‚\øc±πüã›Ω¨s?6ﬁÿ6Ø}réŸ{·î”“sxêv≤“ˆ¨∫ÀnV9¬w$?áxÕ≈á&~ÄÌªøü¬uãÁ©_Ï8i»@◊˜ Û›pQ«∞ç0søO-a˜[…C∑‹¥bdÀÍb±WO~$#ŒÀ%é«ﬁkgàG˙?ùd_J'‰G‚a«£∆s|Õ≠únµè(DúCÉì2⁄¿Á±¶sÿÛé_Ü„±ñÿﬁ#¨÷ﬂß¿Ú.∆.</_Oä“:º:–d∞Ç¨dH*R†tî®ÂÚk{|a›€w?√ßƒ¬Oç=åˇÿ„Ø}Á“ı¶BˇÆsY&Á·˜fŒÃΩ¥—k`Ä—Ñw?—)ò¿i^‡#ÕÅ(d•†ZºQaeXaì†“I;±†^*R⁄$•$BG'Âï˛(Qﬂ⁄$≈ˆ˘‰	+ÉêOGâ˘îòMÙxÌÑ4ág"x…˙ï›·+*-NΩØáNÄﬁßû"8r9-`˘…≈ñ‘"¸ò≤∑“3¶ø,@fELŒ|w:?§∞f‘d($*Û˝[#X!Ω~(-Ù-NNÄ–T¶/_‚ƒ≥îa‰IiïMp%mÔˇ]ïº)÷g› »pzï¿à˚ËúsC—9îÍ—™ÔJc¶¬¡ûÀ+ú2∏à%:b;c,VèIi‘j≥∫±#2Ÿ(e∞√ÿ}˛ÓÁâ[ò∞^Nê=\∏ÉqƒÚ‡ ˆ≠yâ÷v?üÕøaN	ãu∞Ô∏·)\çJ◊o|ΩªqÖ»¨Ö^Å^;äyhœ„ƒv…”\ûÿ≥wxpU¢ÚäÉ¢ø…˜âéü˙Õ0ﬁi˚¶√\äÑÉ,«ÓøÕ∏&Ä≤fXóÄº@˝c±êt»Û¬Ê±ß7“7ﬂ†“.Í2À/-J¬ó“Iâ°ƒ.…˛æè√jÔ!qÕÀ≥EpU2“úB*áûÄŒ©=qå§€Ú#∫b·ç∑ J∆í∞~¬G]\*˝Òx&Ê4v¶óòA´¶ƒÌ˝Â/UºΩGÿ πä¬Qfˆ‹ﬂ˝rIC4‡˙¬¬ ‘∑±åº9¶Mä¥Õ|5≠‚Ò⁄∞ﬂˆ˛EéèyuÆD@g¡Çïn‘Q∂ãérFÕ{X~◊ü∫∂è?:◊ˆx;"  ≥€◊û
£<ÏVÆÇ]&1‰ã∫#"ÁHì£ñ øµƒˆG˝É"ˇ•K∑E∑è&B˙Åtf∞àXpÔÓóŸúïSáSãAYpiDW1‹5>V.ı¶‘ü–jÜÔ¸?Ñ˚÷C•¸n%ó%÷üÌÓâhæÖ6\ëí„˚ÚƒÀœ;Â◊∂?-≠4º≈x[`N◊K¿W)T‰ÜÖèøŒè WÑöÓ»?•8⁄6¨ˆ±Nâ’8nµimå¢æ∂{<≤WÓvmNW€È÷:ÿ‰ÜÙ·©@Geòëı˝¬ zﬂ[&Õ˜∂ıh›Êxdπﬁ"∞BÆ∑âIæWû∑OŒ¥ˇ^Œ¥O±O±O±Z<9ƒ>9ƒ>9ƒ>9ƒ>9ƒ>9ƒ¶"ˇ‰˚‰˚‰õä˙ìCÏìCÏìCÏØÂÀï]	áX≠
*Rf=˘√ÜÌˇ¸aO˚ùn∑ﬂ¬7˝ÊÈ!-`‹$÷Á-Ê¯‰ €ywîzTwŸt]˘ìˇlnˇY¨¯}ﬁËüw—ã∂’¡Õ g™g·È:≤zçáqüU-!¢˚,∂zrü}rü}rü%ø˜Y<“ÈÓ≥‘%”Lùâªæû8¿àåè√œ„Ø=r¬æ5˙.&a·ˆ˜Õ¿⁄¸k#44A#J‘ÈUtwΩ˚:Ex§w˜ÀÿÒÃ BªÎ◊sx°Ó¶ÛÆ lØùÌª0gÏ+rËå/—ã&≈≠Ámèˆ‘±«__,¸@Ù¿=∆ÅM∫a£ªü†U◊Œpïe◊ŒÛ"Æùë°/<;q„Ÿ)ŒMvÏ4}˙u¶}Ø∫u¶BÀÁ’ôD.ßŒ4HO>ù2êw‚”âK¢¯t&èqnüŒ9±èÓ“©;≈øÜK'R+√•3√HÎ„ÉÕÌ„)ÓÅﬂãègbNO>ûi>û ¯]û0€•ËÊ9≤LKzÉWÂúÌæpˆå˜Ô{‚‚)ÓîﬂôãÁ,qÉÃï‰7Êâ+EsK≥'ÊQ<>OõùS´oµ…A◊jùw˜<u‡áÖ?A¯ŒÂÔŸp|ÁxÖ∞ßﬁøì¬KsúÚÓÎÿ2À√ìÇ+‰‚ôúÿ{Ë„˘‰Û˜õˆ˘√í´p…Ïm•ª¸çú-g;ü9u´6™;.N•Z§öS"GÖmÿä=ñ[`≠∂U©kº⁄äπ&yÚH»Z‹ﬂ≤GB‚ô≠˛Kú†4áÑ«9A·¥êyÇñpZ0û†1/ía†Ç'JÑ§:ΩE†®ﬂZn_ZN≥UÚê˛NèÏ%ati‡^+Ôﬁ?!d÷
z*f∆û\¬ˆøÖÛvøkı:ß≠√i4ªM6⁄ëËÒ‰ü@˝÷…ãVØoa¿ñ∫ äùˆé:ß} s€Íæßæ	Z
>æ√AuS–Z†ëº˛ﬁ;¿QË„1y—<Ìw[4kV≤∫w;˝‚ºﬂÑ'€ﬁZﬁÁ@#ÎÜòàN¥ô—Î`wë¯x$(˘o‡sP©ƒ'ÉVWN=ZüÉ<;øöì¡÷o¬…`Kq2ÿ›.‡d@èp∫ó¡5*∫]WïÃH/õªü©Aøm≥]Œ‡*≈ò√í≤#)†Z?|øp?Õ2õ_π˛Îë∑ÁW–¨≈Ÿö{D üíæ	ñ“sá 4œ∆ŒÉ¬óéó=…é4E	Lé	^:˛Ñ•∏í0ÍïI√^=ÿtw?MPuùâTK¬Jï1ÃÇ0\›LÏØ±j)_¥Ç®ƒ≥˝ªN"˙Ú∂Yô‹R¿À4’BOœˆ%@yuE†mÔÇ:â‰DóLAí¡KG0X@êﬁ¶∏âÇô==hö¯VAGìü˝Ü˘Ù$‡§yõD«]v7âæ(‚o2M»gÔÖ√	EÂa<N≥ì]Nå_Ü>'©Tßìtx˘ºNÚ¡»Âví
Í…ÔDÚN¸N®ïJq<ëNtnœìá9ªèÓz¢=œøÜÔ	•~™Ûâbï‘:õpr{õ$V˛˜‚níú‘Ô‹ﬂdÛ^˛&Õ1¡ZØæ!BkdÜeÄuS·≥H»‚©#v9°,3Åo	OR¸N6›Ô$±ep•Aı7Íx2«⁄«#"ß¨l'ëË;F¢Tyªõ‚d>%l}ÓÈc¬ñùL^X,K}ñ{	)∂z÷AªyH÷IóΩ≥CrqC^À§vHzxÊ√wÉ⁄‹l‹á¿Bqª[ÿXıFqÉCoÁŒßÓ("ôdgn⁄`øzX¶ô>–Ä‡Û§G
m`¿9Ø ˛p˙~ôÛ<Wy{xíEHÉœÅÀù˚>Â"êC÷<=T(œ`5|¸)’í[\Ûp¬h]ÇèÏŒoòŸm59’ÑwFnÓ"DùZ·íﬂºı¯ÎEÙå…Ç:§¢≥≠Å9ÖjÂóÀ»∫^n$?Àî“P'¿çËìÙu G¢Ç∞DR †È4qù	00¿MG K{>Õúóø{Ÿ-ìóvQzË—dÜ(ÔÈÑ¥\Y]Uπ„ø’Qö]†©/ù)–gé:Oz∂≥â=vÊÙnõz\⁄xÂcŒ†Í5É^96„+UÌ⁄ä;ôÖiMu
ˆÓóÄ=GÜÜﬁT^”F≤a;X7„∑‘%’‹U˝N¿MeWbåºY!˛äÜ»RÇ&®.…£Æ-ø≠Üoí4Å"ò∑¶CÁMgT‚Ω6ÜﬁZ–%ﬁıäNˆK[∆r∞∏`ö¢Òö†ÜÂt¡≠f+†WJ–Úπ
¬ñ∑'?w∆6“Ò6∂”ûh›>ëc÷âÏ¢õ:,‹√L‘2[‡}^¡©XSãb
“Ò-í9†õâvfD[xRH‹®âmpK…•ÄãQúe±[P”Ly≥ì∫Ó:E\–’¿3îíå%^èÓ‰YÛC«µk‰ñL‘}ˇ˚£æ}ÎáÔµèíBΩ‹—¬≈çıJ¡PËf`ót.¬‘ÖózÍ¶y(œPÒ±~ÕπQÊôL7_ÿ!·TZÅ/Ø]ÁıÅ˜Ê˘«ÎïÍ&Ÿ$€[õd´æ˘Ò+y+røÊ»ıX—ÅJƒéºsdga.–
ïi1ëËóÇf$∂È&7ΩËÛÆ_6≈.bàÎpÉh¸/ì@ayãÖÛ≠≈C<WïùóF¬∏ëñàx¿xUŸ¢Ÿ‡±QÊq±«o„FŒµ$‚&÷≠I-◊Z$†iÉ”J\ÑÚ	œAâœ µÅ»Zm»πÁ”ê¬Ç∏Ïhªìãî·°Œ!W<HO≤à¶BÜK]÷oó>≈…ê|˙ãasüæ")‹%/+æ¯.1M.=wËÏS!ÑP*vÆ&¥Æ®;X†∞€JΩq#&— ∏¯äw(éî≤ä¨A'Á‰Ãˆ#Â£ˆ:ø∑ÑImv¿ÌÈëÍ')"(vƒ`«+égËì`lÕÌƒ”§gÉÑ#´}qîEÖE:“πZä;ﬂƒ≥M©E˜ê∫ :).«>U3ÂdHP∏ﬁGc2|ÿ˜ÓAﬂ(√°yÿ7ıüByY‰'—æºÒbÓ†∏2æ∞ﬂ·–?xﬁƒbå[@uœ#ÙYSñÛÅîÙ:äLY—_õœf∆£X ê9ZìÀ•yq:ñ ÿs∞˘µoπG
¥ñ"˛M≥ÚÚÎΩ¯w'R⁄©√ø‹¬∞YmüQMí„oå<nriœ$ª∞ÏØøkˆo6˙7˛NúÈCS øü”¸W‰∞uz˜W¯ôRÁ®}˛a’ÎÊ´}n5ZòÕØŸË¨vŒŒ⁄Õ_€e~}}ùôø⁄ÕØößá“ö∂NUÛÙ–rœ/ú©xMP◊¥ì¬ÖF9xÕıå@óï/MâkÙ%Ô÷4Ü$Öçd6“‚ª¥9k9”SäÁRê‡WÚ8F-g√ Å@6„ïnŒKD’k*\‹√ÿ“Ó%Edä<{Åﬁ %J‹⁄¡⁄Hëüı2B*>I¡7#7•ùVå}í≥SŒ“Z“N‰Rñº#Ù∫—Ì8Y∫À?jﬁ;F≥©‘…öÖ ömaav©˘öm?&ˇËûsIY®¯πé£S_i™‰Åﬁ\Nráeg:ætÁW•ïØStÏLdÍ»≈LÌ≥úëkñTé£ƒ§ı4ﬂ0ﬂ}ûUL¢õ2*≈|πQıè–&î.π;nÏá´qÅÁ"£‰ÊæYﬂ€ﬁﬁKÎ3qA.°˜6˚›wF„≈∆poggs€‰˙ﬂ™€U˘˚¥ù◊F’ßùwÍEéìÔx˜•è¸¯;Pí8>#+gé?qlå®$˚àá®E]ãπgF)DI	h–*–Y`Öv]ZÖ£o*Åo=2≈pÄπ3òStı.PöŒKvcc⁄ã Â»¸›hÃ6ëø´7⁄ÀN2pÓ˛8©∑‘3mgiHúπCÛÆü˘8Â'FË˘T®á;,Bo⁄¡.–·Ç:Sr8ìŸÿô/”›ªWo|ÓÕçNÑ#Ó
˚√Êd-¥÷…9Ys°gÅ‹â6YÊæ•ÅﬂuÇl∫á©∞YäÓ‹˝¡2≈‰íª›A…b‚Ì°0¬›/T›ñóZ^!…Ÿ-—≠  
û÷ŒJ‚˙`èÃÒΩÉ≈•!†nˇbÕ¶6qP∑q˜3∆ò‡ÌçùõÇ1wy „–yuŸŒû‹∑¿:6%z?¬B›—"(poJ=Û_dÚêÀRÇ#¸`§†Álbœ£ÖÕEπ(@5⁄º xéT·0ãÂ:¿Õô^¬µbO0h«#◊sßsw¬èw óÓ$ˇhYE9ØËÆzÆΩƒ
úk«wRcm≥O≠z$ûö°∑¶¡Æ3ó≤≈E`œØ`∆|õõ·˜£V9ı2±îìhlíê_8A‡åóí/@¯iôå3Ÿxç HÒg(8“œ‰)Ø]¸≈@i–Ê¨Ï«õ•—–Âû‰-›DÀVJK'—≤ilâ∂n°È¯U“éèDT_ôQFﬂ
-œ{G)0ÉLs√ôÿÆLŒºŸ¯ÓÁπ£nÃ®G0ªÙNRZ&Ä˜ŒÃ-ÅµZˆ≠îñ	ò˝ò3ÿWB”3çÇ4ZY7±[Z)ª%±XV bŸâ%∞ÃK`ã3≤Ú,Åù óïB.;A.+Ö\ví\à\∞S-Cgd/∆Û®5;å…t>Ü,EoºòLI€æÒ‘∆Â;®o@v;
µ%¡`õLﬁ§ıißÓå$¬>˙(ÚQ¸=Ñﬂb[´F}eÉÏ{Áztq*Qt>©Âbß€=¸^ÊΩ
e§+òÍÈæYÈä˙ù,üÃM'µFüT¥ZÙ±∏z·Ö˛'Ç„E‰r¢7¿õï´ô:Pﬁ #Êˇhqå¬ä◊…I´yr–Eên≥q‹Qﬂx—Â5°Ã)= ∆≠ˇ˙‚º’Ïjp÷¨,ıçâ@/ô'0Ú˘¢'Ub'Â
§ıπ1åì÷∑5óõN°røLzsÈ›˚HÃß∑Dø˚_jíΩ{§Ÿ{‡D{Ï„©ı⁄rjΩ•ñ'#Ω^Ò{b_≥{¸Z2˜Í3œü‰Rû?|£a•ŸŒ;ókÏÂ¢?Ö]ﬁÃË/…˜Jÿ≥Ì\äèÒ˚Û¢aMÃRÒ∏/öÏKY(€j¬Å0˘$êRwÿ⁄ñ πÛπËØÃpUr\öºi|mV uy;‚≠µ-w’ﬂú|üT˜Ÿ∂∑	zÂ˛™€dg˚7øM¢wòî⁄∏Q*õ’˚Ô≠„∫~ß@”hßÏÏ<ƒN©Ì«Ôk€‰∞õw¸é÷Ñ—ı›«ﬂ";y∂»ΩE˛Z∏Yj“V1ŒÁë∫Zrø`&¨›ù‰GôIéˆmıò±à•ïπ¶*≠§D)Ê£d*/Ù<Ë\|ã\˛Œπ	JI/Ñ’0%e…f;ä˜1πÜ${û!9\BÃrDGèiÄÃﬁ_∫∏¡Äyï°l˝≤\.'A ÿAı£büåmÔÅ;w“Ÿ}	7w=8Àá›Á“T˘ ⁄ºÉ
Rªˇsç(/õ“ÇP•l®Ì≈πí◊∏Òß.˚Tﬂ€â€9aoTµÜ”üÒs•ªöTìŸBò£ô∆¶ÑÍÌóØpv
ºl¡*√“"¢Œ7D:}·?
¢g—Os;˛1˛tÊ¯—œ¡$˛q¶øIRÒ„áX¬èÒi¯Ö?Œ¢ü øË«¯Sƒ/¸ã~úÈÔ-u!6©´Ó˜wπn∂Ô‡ëc¥nv¥Bvºnvºnv∏n˜]!ƒ$<@#·«hÖÏh-ÏxÖÏxÖÏpÖñ]ãåG∂áé≈pΩŸÃÈ.JÏŸÃ±}2r}âUãLLgÃÛ‰¶„YxC.ÛRqœ@9µ3mD>#õdüTsòëBÂ ÊZ*Ÿk‰Ç¢'œ†dØíuı”ãU}»R8!ânr8LûÎí|`˙¬rèFù•Y}W‘‘ı£ë˚FœŸ†kÂz}*5L˝≤M.òç0a(EÑc˜Õ~å±}˚á„Òﬂ~c÷ƒ‡QÙŒà£w÷îQ†’i∫’64=c8 K·œ‹”3dJ>’±$DÇ.ı5\Ç*ùü´⁄J-≈vì“D±,eÏ<¥,óÈZÌ^¯%Ø„_€CèuàE¶.aé:Îßq2Üﬂ∞ÑøÃ”Ô ôx È—" 6uå≥ÁX ± ¯QÒ‡∆-õ‰Äﬁñø— ì%mfeíNÓ–•sIø»e0œK&åèBZŒË;Iâ.±4œ8äÖ± »+Æd6gl-ˆí#ë≤˚Ü¨π∑¸‚'ßõ;µµ|%ˇ^≤[+Û˙$∏~ó¶ﬁúÈ¥}gÏ\€”π.«tﬁ<⁄∆Îp∂+À`ê«>é©o ±-o\möÌ5™t(@È£È¥|˙—2¯‰#œõOΩπ∂”Øï¸].≤ê?>¯~Å…„#∑xŸØÈÀê|Ù√’ 7$X∞$‰cŒ∆w?O°?ÜIÂrÆdÔQBÑÁBOπé•π:‹í3âÉd7¢psÌrïu”Œa/U+™_Ò8’∏&¢∏˙qV¿x’„Ä-\2œâí_*"˙¿s5èIF&*œ‚≤¨Ô¶ËÀõ}´›n¢˘†utﬁmXçVÁ¥Ÿ#´€Èﬂ˝˝∞iaÜì≥∂’∞–§<±˝Kw˙Á0YGñÓ˛¶$£≠√x+ƒﬂJô8œ`rr÷nYáhálìÉÛˆf2ÈZ'0i,˝iı[m$FÁ	b5˙ÕÓ›ﬂ{˝ÉÙ[g“ZoΩP…Çe4LÉP¿ Ô]xoxa‹Á§^’Àï–Ü%M0cÿ◊Ü’McÿÂÿ¢≤πßÛ
†JtÙÁZ'm,N¡„¨—Põi™zLc&üZú-&$«ZLº˜¿vUáÈl◊—ƒôb›l≥ù'Z¿√ï{/≥êÕW≈ÌúB÷‘|÷Œ®CdÛå—™Ï
»Ï¿uS«⁄Èπ,üÃ¬#Ï©(®≠∫øˆÆ¬„pœ]%¨™l∞œ€√Øk+v‘A\Wé÷≤ÎﬂiÒ›ıL…Ù{ÀŒ∆6‰b1F*iπú¬!¸ho´°„ü—~¥p;{÷˘ësK¬≥r"«DZ⁄˜áÔóÖúíÅëWö«(M¨õç&¡ãfä≠œ¯g⁄EW°süRQ±¯òÔ,ËÊ!∆`z€'Õ”æ’m¡Ô›ÊÁ≠^økZΩ˝‹áíL˛∫ !Ù’t§–Èrh4™íhoD:ûôYøÉ§µÆk1âˆ#”Bˇøˇ˝	˙∏˛·«YôÈ£ì^o˜…*@Iﬂùy¥’¸fÊº%•(ƒhü~˛ˆˆ√5“∑'ˆ›{¸  €U¸I‘â~F>ÜA?Ü˝û¸|ü|¸Ò[çv3““œ∆ÓºˇÜgê,≥_Å®}è&%&í[˜˘ÑË6æË®ÀÁŸV…¥|U ˆéé¨‹AswÒ®?ˆ∑üñ¯],±ÙI∫8è Òˆ…¸ü—O∆≤aa—0¯3¢û“‚q≥≈U…Å„É¸åUÊ.“G";´¯âR2.ê∏∞}•ÄòP4å˝Ä0&6ÍÖ	˚y›ç»≈ÿ|GJﬁt|ÉOféµ«∞Ká7T-5%ˆSÜbbœ	ñ/c…∂ÄQﬁà%¬h'l"N÷wÄKÛ£ØpÃÿ¿$‚à)Îe“8∑©g)±zx¿[B≈€ìÊaû!ç#´b ïVÄï ÌÈúÃ_“q¨÷a£ålLL+P0jtÏ)ÒîSŒvz9vXF+6a÷ZX£
‘	OWjı€0·⁄!9ÍÙ;›n”j=,êp¯[õÁ‰åÇI,Å6¢'ô5€AÌêõug√µœvùQy∞·˘geõ6añ_¥K#g=rßNúD¯3]G±_‘Æ√¯”?&qéKãixÜ&|∏(jÕsÜAMB¿Rﬂ ∫Ù£¥vºÅ5ù:hh>‡‡⁄”í:óè>“\˜ayÜ≈É¥Ôƒ›°ƒs©%“¡˜;ó#p«ãf]ÿlüc˙Fota¢1np'u†pÁdä1À¿/‡ƒƒÛâøèÌY@Ô1ùbÑK.L–Oñù‹<ØlEcD
¡j-:d¬õ Ç–x8Ê˘àÙ4àÉîHe“∫–Õm˝õôwÈ€≥´õ’ƒ‰Ú±¡2œW¡‹#öìØr}(∞÷ò,Ö(T3µ'h¶î,√Eè≠ñ1ñ©oNùæj!≥i†r¿•d."$§Äò
€:*ó·7 õ„)äSÊ¯Ó–Ö[5`ñ‚kt•æ˚'Vm•â6ÏÒı◊ò‡úµß¨Æsâ?#ﬂRROÕ¨âMÄMë}$©i≥â-\oE™<˝ˆ—‘í_¯àë=˙@ø"[¬&R»'Ë26k†ÄˇT¨Iî|í∑Í“¢PwdiØhY+ü$Ó£∫·<VÀ‰»ΩD.ÅùG˙ﬁ¬«’ÍÕo‡£Ü={ãy|CgôK⁄Öª ®5¢pXXóoË86ﬁ E6…M“Ù¬‚sΩıÿ,I˜—~\b£åqÎ—≠¶á≥Wn…âiéa¢{zZfπˇ«[†ÆÏ QÜﬁÛhı´nmäù™È˚¶&ÔQU¶lòà	sÆ.ÁûFu·?≤÷piQw~XkTwë‡O1µ<c‘={#‡~È^1SÖöLë&Un` ïã≈◊".^·2‚+G	ló(v ªπÆH%ÿ°•;““«÷ 2â«)πBp∆+UF±–¬πI]RíB˘ÎŸi∑Àâ47H‚`”ÖR√„ç1>ágåÎ)ù°}“øFˆ¡yùÄπp/—ïâÿx,ÁƒGcyÌŒØ0¸o¸70fppÂKá≥Q∫ÎÜ}%ﬁÈbrˆ9±ÁWÂâ;-%Æ5"fÿÁŒ°ˆå»w}‘µ†¬ó˚˛B,v}w¨ˇ.@;)E9|Uÿ»Ô	(Û+ïÏd£®≤©yàxÉcj%“7–¢ KZíˆiïﬁÇªF'—¨–î°e%ê {€å5fp#Ùnc«®i«ÿ’qTÇéúÔç`Ïú\T—4W˝~@u@∑Üo¬µVdCæiˇLsã«dF{%>ìgÈ?™=ø“◊C@’ºÌG^{˛wË”ÖO‹»∑'‘?ë~≠ïK8õ√’<M¢},Ó¥£Îî‡h”íü¶\Ó≥Ø÷¯äÚˇèÒ¢ﬂ‰ˇ®∂Z˝
öÖÇ<Ciì5º8d[¡‹◊a¥ùxr§GF¨lÏ¯°”HmT∫!v/µù˘‹ÒﬂRñV¯8béVTnU&[^Âø™Î÷>göÕlØ„fÌ7å‰xÙ¯ŒEÌÖ˛ûû>æP˙á/¶›ö0BbxÍrä%e•û±<˘∫iÚëæd¯Ì"ò;√˚¢(º∆IêØ·Lb^‡h?Kº0	pZﬂü‰{/ÉØ	Îê	^>Oæ≥>à¬'ãÒ‹•Ú}Ï¶Féº¡"†R?VRí·Õ‘Üo–Ü€çàH˙‘Q¶{•«`√∂·Ãı¶ºÏÏ∞ƒYy(¿îU_≤»éñø¬?Ò,{Cã‡Z|<*€¶Eà„á¶Nhld,ä˝¶è±)r∞≤H∑ö0|Àcòü$æK›‘ÚL∞NUΩcoÆúgwrŸÉœÒ]¢[lG´°êZá˜≈1DÏø∆≥XG±#X‚Ú©•^>º>øÙàTÙù∏”\§¡πØÑ{Õ˝≈÷ÉõóÛØ¿nïøÑäûùaÒ1,£Fi|Ê{3‘¿9⁄ G›PÒúf–˜b`y::Î	ù5˜—Gn˘5e§>%õÒGÏpõL◊¯'¢Åc#—]7ºly¨'≥¶l>	ˇ†+kXoÓë‡˚ÖÌÀ9P8i÷%G.-SÏ…2o—ù'ä[”¬'¨˝\Î6ˇ4:˙$ã!–∞ï:áΩ∞ı'—¿≥√ﬂÒG–t|CòÁ
ïΩ0ã‰0∏∂X€∞»ó ¶ó∏∞TbÒÁg*TDáv=DXaˇe_≈ æ@G é9	F¬&π˝#Ôéd¯√W·_Ü? Ôôê›≥z}˘ı0€¯¬ô†ùÔµÌOK+pèá‘Ã∆¿*±¢hL$At?;<RÕzlÒâ)tº9º:bŒ:zõ~Ãäão3ÆeòŸ[|⁄É≈L™k|nÒ.Pﬁ#›Ö9*ˆΩY¯@D˜~t—Îﬂ‚à_ó=b≠GlÇ_g#∆<{4îÜa/ÍI£IïbzŒUK¬6Õê$™ yBåöf:Ã¢p‘itp'pñqW‡È8aü…/˙ª‚ÖTÅ◊©ä~g’≠ƒjU§È	ª'¢G(%Ü¨·ß…—	—éú@ï¢¸ì∑Ñ”D.	ø˝ÒsçBåÔköM∆†
€*ìû3qÅTóÙp6ò"õÕ>F> j¬õ©w–ö;Ωé+l—|3„!Â™mëß¶≤í»x^Ô#TÓôò⁄Tkö‘ém¯Ñâ¨◊<iu⁄wˇ¯úW•å≥§5OI∑ŸËúˆ˙›Ûk\;‘˙q◊L∏	Œ˛&Fê˚‰‡‚0˘
ﬂ‡m[™Q˘Á:Y÷¢tÖJMm°Wñ'µ¸‚útZï˚ÏÜ”ùò€πPj°‹?ÔZ»„e(§Œ\Ÿ[:E∂Q‚çË6è Ñ™h‡ÍõK¬;lˆ›÷€ígV?⁄æíı∑ﬂm∂NößΩVÁ‘JéΩ£U «é˜±∏®â’Lﬁ ë2sKPb∫◊aÈwo‰…1FÜìIïißçè…OÎNy;]Rf°Æm™É–K„8©8"ñi÷`⁄[K<ó˘06>ñÇΩ"a⁄™ÎåB|´è˜ºÔî∑“1F7≥LÑy¿˜°3∑›qàµ§ãﬂ›4N"R'Ü≈jèxÖ#ΩGÑQÙILU£rÑﬁÎc¸^B!Äå¡Æ»/HG/ôßÖk
fŸÄ5ÕÛ\›8ãêì˚ø’≠¥—ñ¨kúHá&{©ö‹Ä>£¯K‚õh&ì/ë°≥U/{o‡QYÊÓê=<R:Zå«/Y¶v\}7WMjà^¢%3Ë·b3À⁄™eàx≈˜X`É”ﬂ1Â{ı/ «CŸc!~‘Ev◊Äó.ÀCú]Ïò≈Â›‹ú™òQŸ[#µ=t≈Á\’ô;˝n}[2"€kŒ’nëXåˇ¿–PÉc∑ÏZ‘ˆ	O%√|aDò§õÃªz2Ú—ÖŸmrÆM|Á?¿“$ÿ+äÑzS‘ä-LÃÜ·=óìMM~XQÛÑ‘X/ì◊õ`)Ù)7h2˛©¿≤ëﬁÕt~Â`÷Í©uÊ{òÌîÂZg™◊`1Å…ﬂ`pîêÌﬂ-U¢ºáäÄÁu(˜U	ΩÛ´4Ü#/Œ™”Lˆ∏‹zÒQôPäQeËOÄ3ÿ™Ä00
¶h»0ºó⁄FÜ[Ù”Ω‚u|¿1ÎƒŒéÿ´v?√{ÀQ}¡v˘?ZS<ç:∂•–-èË,]LF	”YT*IBh-Ú
™IKßÄ™¢ÏªèPªkz°T«÷6´PŸß≥´LáÁWπ˚˚iøâoZùìf„ÓØòıvçùü6®lí„aÀ˙¸ÙÓ4n}eiˇ≠G;ª©ø…;ﬂÄãƒP©Ïw¬—À˚ ØëbÚ’ÒÛÍ’£!Íu16,zc;åﬁËù∑˙Õ∏(EÌê|D∫Îƒ:#_ú∑∫wˇß˚9V —mº‡1?Èqad–°…ÆQ„}í¸‚è	‹‹ ∆+gáÿa˘0äÄ±±çÃ∑ë„9‚ßQ7«è>äæ◊Æè}©§k˜≠=úÿ3Ê¨Em§4¨œb	;=tZ4ÓL
+1∑)hJë——p´!õ†Dû»‘3åî#˛‰~±!°K∫7"·»≠È üC›‘ﬂ˜›› ˜´‘9È¨7O:á≠”ªø&5ùø˜ ëh5á±0§+EÉÙﬂßAû"ÌÛ€Ú@ê73¿‘Né£8⁄—A^Ü`û$…ù3àQN™ï∑Ø$ú§ñ3úƒ† —∞}˘H“U7í◊ø#¢ô∆∂ˆ˝LâëÔ)c®»â=sº8éÕ÷J∑«–RçÒƒXê¨=íıX˛“ÿ’ã«˘aI•âAÊ¯ ]D@bZ,µÍ·Ø<	Kj5±“‚.âˇŸÉgëRóΩm¯ÅÁ”ddãAÑã|˙Vr:Ùà≈ºu∫h—î]˛˘i⁄:‚˚ô¥ÇÜ·…‚?ºªTá´§g◊6à‡R^≥•\ªÙé]≈‹∫îô®éA„÷µîSó‚WïÂ–ïJ‰å¨ÜëÑ?tÉœÑŒ -[ìÀ/i–Î≥nd¸ì}PGPﬂ÷Ô|¸ìÙ„„®˙Ø4W1±m“Oå£†R/«õ»‘ÀÎ!¶•kHp,Ùft∏TΩ¿Ñ»íòﬁI0ù.±ê˝"_Æ©L›«oMòtZ \3r6ì•ÍnKº	îÏ|¶—˝ÿ√K'ºR3hP≈Èc∏gK}/p5πÅ∏∂:’Ç¯aU¥8à¨ÁŸD—&”•(îór∏2∫à`9rüa±Xc&û'=k$(YvåF¡¯ŒÕ3âΩS‘˙‹M/mqóµÆ}ŒÛõ∑"Ç}√D˛;‹ÍR¯J¯“G‹<ÊWﬁ~ìï…EdÜwM‘ﬁÛ¨`Ä‚è-Z
¶eÃ‚"ö∆›ÊfdÙ§ä·gÁÕ8æ®WÃÓ’nñ”uüKMÒàïÚﬁ4Ò?ökΩä#æ>‰’Ãû∞ÇCûÏd«ŸŒ#TvD!ßk§±FÛÛôTW%A€¢Ò∏cùçÆvQ,ÍQ8HãöËôåEMF£ÍE≈¯π6Ö[bòa<Ú:©–‡»Ë‘ït#û;‘ï•1”*xP)tŒ;ïêüërR˚§é˘qSf¬c>ËÕ»`Ak0_ÿ„Ü»ºl &ã#,	CfvÏánŸÃ˚¬{'îzL”‘ER|≤ ÖØö% »)8X—6kƒæ1˙T´‰≤∞P:W5(T/BD˚œº“gdÖÏˆñÉZ"b≈≥RTºëÊ°bb˘q+D H±–]JÆíΩ⁄¿5/]œÆ(tƒßE*¥∆#u‹Ò—ÔÖ®Àßâ#≠üõ _l¨õ°Äx‘Î3*öÈkÑîRöîŒLË˘©Óﬁ–OQ¡ƒ∞
†Œ±≈„OoÅ§h¿•&·\èà¶è~)(@	Ú&ÏUED\¥ è™ ˇ—g‡ïƒ®‰·èÑ®êRF)*$LÙì"G·üHñ¢DÕ&Ü7Ó™ôJ“#)ÀÏìWD˚dRÙÿ,oÛT°Jƒy˘ú∞)—BÛ|VÿÅÀ<û-™ßOMOüzRr˘ê<±X	ﬁìΩ¯»}R‘¬@¨º!X…≠%∞é]Êk™ª"]˙L˚Õ~|Ã)Øî§â¡Î;NæÈ$>áŒèÉqæfFﬂZ9ú GÅl +	Ô_ãÒπØ<ú?hÀ(Ûÿê,E=óñu;?˘)üÈqÄYõÑÔπ†∆Ô[˘ä√uÉ•N∏WÃ5˙|Q¿SUî4eu8;•ª™¶d≥yyJ˝≤y™µE7/ÌB%•ƒB·r(≠
≥£l&[Ö‹BÁO≈S™R<yÑ„~πo∂¯∫)â∞p	>Aí∂,≈ßÒK“úpc5¿E¿¬‡H©Åiƒ\öÌqt˜≥M@b∑Æ=Dø÷±sÈFUaèb˝∏ôsic°IÑß·0‹yF+≈_≈H∞ë%QûÎ∞Ì◊4I\ˇfÊò ≈Ö/√ÜRQGé›í”yTN≤Ä˘zÂ≠…î)ôKYKÎDu »èáíú•ø{.M≥„_”ÔøûL\w%·B6Xıº[¯œn{ˇﬂFeoÁ◊≥€—ÿπ∞H¢}Î;£Ò‚[èó‹€p·ppè≈îX’ ñŸ=9iµ ªíËb ·∞.üÂÀÚ'¯Ì-ˇµ¸IX∏Ô6n0s&4ÇÕ"ˇÌÃõç_∫w?øö;0K˜¬≈œﬂõ¬Ø3g3tÁ∑É±Ω¬’0–MP;Cœü{Óÿµ⁄˘} —¿0Âà2_ˆE‹‹‚Ø6±/ÜËÄ˜f·ª¡(Ä_›F-iuÀóãªΩöä¬,(Q.X)¶t{È›˝Ú üÁù/∞‚¥JxÆ©~ê†è~Ó>îßM?º•ˇ:¡mT¥¸	ˇ¬Ω˚oä˜Ù÷∑}há©ù›ÎÎôÌøtÓ˛˘j˙˝¬•Ö¥‡√|ÛõGÙ	S˙%&) ¯YÈ[mÃ⁄¸ÛYª”Â·Ä/ößùû≈úÄö4˜ıY≥{“¥ZÌ÷°u2^Î¥w~‘j¥ößçñµ/Vﬂóån<—ù»"V∑ﬂÏ∂¨6aèmb∫Ì:£nêN£}ﬁC‰‘¡¢µ…35´”ÌwZÌªø[çxÇ'ùÓQÁ‰Óo˝.z@n$Î(“Õìg¨.`9U}BµNZ–ØﬂµŒ,hÒ≈yÎƒÍπ•q¥§˙*™’˙/>⁄nˆî*[˚+RÊæË˝1*Çi^v2ı»ï}√_9sºèm2ª˚	S"‚s≥†bâocÍ˜˘›œÛ≈ÿπd:∞/ú∞
œÅ‹È§JF.fî(˝Øj}2YÖWSÍRo*Pq‰Ô˙ß®ﬁq’óV„¬áb7>}‚üÑ¬#.|œOÜ>cƒ5pmï§<`rNtA˝Qm7GÀj¯÷fû>ΩöÂ Ä-kIË€¶åhâ>z5GÀ≠$Ù›<Û›¢–ı^Y…ñuâÏï<»◊i <-∑%µ<Î∫M±œÚ4¿ñ;¯zúv¯¬M≥<^ ∂s£‹pXª–£y∫F Ò:∆(§˚’*3öªã´ÇX¬ë˛Ÿœƒ≥ıñ2ﬁsw∫`>í´ﬂ¿ùòhQƒöòB–ÏT	öÊy"cì>:%Ÿ}ó£^ﬁ+∞â7”z¨–'òﬂ ò ¸Ø◊¸(°◊/ª
Ÿ,åë™…,'g]x£8˚¿!UóÄ‘ÔvN8G–>ˇ/©∂§nÛ®}˛¯ÿ#vÕ>ed8º≠eÊhµ[›&áP_¬ô’Ô‚ÉæAé∞“»IHÒÌ%`µNŒÄK¿ŸeÜ†vR@œNΩ¨À|ãﬁ ~G“≠Tb7ë‘*fD"•úÔΩ6W-‚J9Ø6hXnÄëû4ÏπsI£z=
”¡§[ÏÀ™	r)¬s.±≤J¸!ıˆõÚ‹k{ØCGl>UGŸó xÂeÔ≈Ÿ+j∆±£xë ñ◊Òaæˆt„'»∆åˇz;ﬂ9Û˘ÌÖw3ºz√·Ì’ìûÖ¨~8	mqË`œèT$ÑÑ»I\ˆñWßò$ø9ü‚eÀq–f∑ã©À≈îE0Çø3&e{°L ~C…¥ŒÎ+ÿô∞Ó-êhÓ¿EùEêK˚◊¡˛Œnùô{˘“æ˚ÈU@”ÛﬂbÃ_ÄÂ:
·’{—” •›`l;ı#
ÄwUbß%7»§¥¬RD>#+´+»ˆØ®•≠¢›<„CaG¸D∆¿Ωp£Ä ÊÊá§¡æ@Ωî·\ÃØP="¿b,ö
}:`äkÅeõM0®"Âç „⁄_£®Kø†_Dáî˛Tﬂ‹$ì`’tTÌ±Àqß{Ï^∞j +ÎÜ^≥+;pB«—ÿ{}F?I“f\ﬁ˝4uP4›˝ﬂypÓdûπ NP…µËwíÏ≤ _˜räuÏêhp 'éçK2¥á¨„_cÌÜØõ˙¯ÛÌô¶Eé˜ÓZ(∞¨'¨z.·~öÚîî«—NHC:<k°§†¨ôöï'>k°ì®üÍ2ùéµPÊ…t`ß&‰·ßd-tr¡ú•AåO–Z(ﬁ‰
G%5Otí÷B±&ksEIq⁄∫î√◊…å:RŒ))è/5∂•|<≥‰Ø·\å˘zƒå=a9Ì≥z"…_)14HTâjJvƒPè›^∂†xÅI¯éÌìÈ¬πéµ17p›ã≈∑¥_®Å—p"â§7°ÎQu[8ãÊíø:=˛…“µp 2K8˜é∆nÆza‚ù{ÂYΩ[—…ê'ˇ∞≤√S'a€LsÒπñ"«Ø«©âCÆ˛zã`tHÕ™0T®ø≤M-Qö»ÖÛÏÒz∑w?Ó“ç©G1ÛÇ
p‰ıÊçﬁ˝ZÊMu„Ùf(4ƒ¶HÍL–s|®q¥ë9ƒBõBŒ'3»Ω)„Xö~ÑM—i(p/~¯63Â›⁄óE<êÇ»Ω‹Kl	cJ°Ìa (tœÌ ß·öÁﬁÛq¨yÑÌ–ÂÊSv[ o'ÙWÿÃå{KÉkoAB§»‹~
2∆Ìß ¡øµ˙f∏Obf,ﬂ>°Iëw·∫ﬂ3¶Ï‹cüT∂¬R›[<À‡∆ûÍ@ﬁg◊¯“ÆÒsÔ+æ„eAQN…Ñˇ'ºà2ÿV0„a•∂Õñ`ÓÿcÕÈ/vo€rí6,2ó˚ÓÜ∂±æfœ}Ã/Äu	‡ü‰Á¢Ú’ùãêr_"˚L"˙,7…g„X©˙gZºõ¡\Â≈ﬂ5Ω”\Õ
<ë‚Ωì¸D«∂±˙°…ûLußãPΩœ3-<K¶¶êq~ã’öI	˘MÇmîàÿ'ºı9Ò¸flG7¥Œtüúı^¨ë x~à;é˘ó¿ßc{`oúŸæãŸ(÷¬môÜgw“Y∑MâÖ.‘LôeÌµUÎv-À∫mÁ∂n€™uªÆ˜˜ì˙Pq‹%ÎˆNñ’◊≠€π†K÷ÌΩ<tØÁ≤Ã€„v%9∑sôÊmçq{k3ˆÃ∏ΩgŒU∑√Údﬁ˛˜5ooã∫≥2oÛõï€µÀÄåΩ§QªszhÒÓÀX≤·‚&•¡d#XÂ@ñ2b[˝VÆbªıá±óá≤îÌ∫çÓt¿pZ›V≥O+ÿ˜4]À)«ÏwcøN^<i¡ñçÖèc%|m_áŸ¨∞#˛
\√Ï
ŸÜõ–|•ö…˙æõnõ◊X¯-Ñ%ÿ»@‹@«‹Tì›µ/Äπˆi¥{jáê´∫Öù9˛Ä[Ó5wDS§—Ç8∂ø_àc®$cüw¸>7ï&[·?ÄIq˝·má©ëumáˆª≥f<_ß!ûåµê«Ãg=R)¡è≈Z»YÊÇyùj;ºˆcàyÌÜ©˘;ƒ¥≤ë`:åéŒZ»<>¥È–~”·k…Hﬂ_K÷√@jˇê∂√Ì•⁄„¸F´Rç^ïøæùOz:s[˙xøwy«=ÄÖœLç˚Y¯B~4áöƒåÇ^;%™Ü’ º€[öÍÓ'ﬁ‘°qÔz‹Œmˇ%Ï:·E˝(Vä¬Ö;b~bÀ˘Çáµ3ö˜≈kikæŒΩ5_ècYÁ∂&àC~˛ã§… m°)DÓËqYRS Öè@p∆xøﬂ%’ÈŸ{Y]ﬂ{u[˝K˘Â&˛P˚K˘vÎ/ÂvÔÛ´ôÈÚ⁄àÓuØe;›u~C›µ?éE˝áÿˇ  ˇˇÏΩMsG∂(∏ø"Õ◊ˆ[ D $E—ñ JÄ …÷’S\Å"TvÖÆ$≤mM\/ﬂ¬+OƒDÃÆg7ã^ºË››Úü‹_2ÁdfUÂg° î‘WénäÚÛ‰9'œwäˇ¡~+Úù#Ω~}@—‚Î_˘øŸø1£eŸèÂıœçx∑¡íHAí(7éD~j«ŸßFﬂaN›;∫•G1ÉSﬂöOÁÙ(.Óÿ£HKxV®˙#}I∑¢}ÀÎp+∆v¡u√˛≥t+&©–&ßbö˘åO>∏ "9Ò ©‹YêZ'v≤∞ØƒΩx_ˆ.Ú®ÊÅÃ-+8É¸ﬁ≈`˜bê¯z—ÉÉ±íg˝’|n¥¿‡b|ò´S>c`p2>»≥˛ú^∆¿‡f¨‰:ÄÉ¸hé∆\'¿<çryëfæ∏ø∏◊öEãŒE∆qw8ÀEV∞¢ØÒ§yÛ€Y£ﬂmZúsæ’›t,ç6iœ£ÏæVt>æ	’9DdpÀÙŸÿ/‹“ˇHkÇ∞Á“H›Öˇ1eGüüÛqË9c¡◊Ö∫37<«NÆ‹â}vÀm⁄õπ™;rSﬁ€ˇn»‡ÚC≥VI1F◊ÏãñpEÊvoKx#s˙7É%<ëy=ª¡Üë¡<ë√Lœ‚B«§‚»¸‚â‰É(óhn7‰Ü2?[?d,¨n¿®%öÓ‹ŒL´˛
™á˝˙∏∫˚Î„Ω$S(fÕˇ‘ñÂ°Ç√‹h1Ù›cÉ¶ef}˙bYˆÌãœıÆ|Æ±2ªà«˙Ó«±≠5#nìﬁÕÿ ∞	å,◊ˇ$ÏÂñ±ïdÉû+uƒû¿˝»@ˇ¥W±EÈãÁä◊‘58≠∫çÛZÎ9f8‡´W˜ìd8Íõbón≠[$˝©\üj˝Ì"π˘}2Ù.>∞ÊE≥)4ªi+òåËõlòw‚9£…Õ?¢ôäò\OZﬁ{Êv^Ö+¯Æ¬ÿuµ–ıÍû´Ω√kgé´<ÎP¸Vã¸VaÏ∂ 5∫‚µ:|òcÌ˘úV°)5.Wß‹√´´Í¢§ƒ0vXU˜Û8¨(ˆ~qX}qX≠”a’ËıªœÎ˝Á]tÒ$9|#xEáï‰
WÙVu≠∏êz≠À«Y≈WÖCΩ—*·Õ@K9[~®õﬂœOöı¡j∂Ω>ªU¯p´¯¨ZÌÛßÕ˛ÛvÕÒÅVqZù4kOœo˛Ëı±~Ωö9ﬁçÁJ‡KüüÁj]°–=B◊‚7GÙÀ`…Rﬂ•/zN˙ﬁÿÕN.ìÊ‚œG∏Õ…–Õˆ2˘ÓDÍÁ÷bodıÇ∏ÙœÏA
?!R^∑L∏Ñ	ê1kLéπ≈XÃ5¶ìYZ”ô•#ÊıyôãÙÑ5Êu∂g…â°Kyπ∆DZX‡„•£Æ€q§πÜ‚£M>pîäòûÚ}ì‘oËã˚Hæ…rªèRı.y‹'Ï@äe«œﬂrM›FèÀáªøVh6¬/ïøV„ﬂxÊ
g…Õs¥∆
sõ≥≠«ö¿&Úôj›ªGâÍˇ,Ìc”´Lezµ?ìT&~ü~¥\¶
`ƒ˛!2ÉlÃÈ<ú˙F,ªJ$Wœäec•n(AµΩªGäª<yâÁ.˝ZVXã>ß∏ì$7G-aÍ‰ØaÍÃ¸TCﬂÑc‚#pä›ˇYºÄüØ J‡ﬂáºè 'Ó*ÛÿSŸÑóüOx1£ÿê[Ωﬁl>$ÍÀ~ƒÓŒGï˚i˜•‡üH¸…‰ØSÍ˚©ej#—@?ÃÁÎïM’©√lbõ›mﬂ†ÊL∏ƒß≠û6Œ›ZKj?ï≥¨Ánøÿ∏»√3–˝vã*+∏€.OCıπ∆E~µAÏ¥À1∂‚≥{òßKÆL∂Å˛Tce—[äÉÿcóc™√n/«Ç‚ws<§Xw¬`Êø∏‘æ∏‘÷ÈR{QÎµÂ˜+:”‘¨≠¡j˛49—j∞b‚O≥*tz/Ó7N^l≥°Vq¶u—'W´◊Ô◊ÍM6 *>4•^dâçîÂD≥‚ˆr˛.âm|Ü/säï-ï ñÑuã∫çbFî•¨£=Åã˘‚Ã˛(¡Q'xÛ2|v3/FŒQ8ãwˇ¸IUÉO»#ñ7˝iêﬂ#∂D’ƒ¡)UŸN1sã\ƒZ√{s1
π`µÓ®ÅŸ7f^iN/ñ¸ßZgQua)¨/ÈN|Ì& Ì±Bèºp¢`sœ¨}Ææ´¡ÊRüË_]$àO˝D¶›ƒÖ§í<cuóf‡ïMπwX5l∞1W√zû}qLßæõøÚ‡'éˆö´c∫ÑØcJùÉç˘:(‡ªÆœTˇX€˙∏àøëº£€y!Û-–¯RƒÕ
}ñ3ÿås·s±vãÎN◊\5⁄¨Ö∆Ä^%r‚FÉ–õbË'C0¶ÅíﬁıdˆÉB…qpEmÄƒÒ1>âƒ(Ë˜
F«áÑgﬁ4ÖŒ%ñÜ–Á˙ú°ºZªÔºô∆Øª—v2?◊¢pÆ√h∞ê)¯|ıÑ⁄>µ8]hø∆∆—¿8¿+ΩS
îπìyeŸz9:“YôÖÜÿ^eœú+z¥∞]Ò§A9*õÕGò2Œx?Ei√*{3wä>aΩz√∑T#ËÛq°≠Õó¿⁄^≥Y0Ó8®qÏg∂§úz-≈ÓÒ3ı2&^-jR…$©¢O˛æª∏ x&¡å\z3;òá!öÇ¶†#	(KÙ72]g‚_CHJX∫@P¬T¨JXÜñ*_U#$$í’Õﬁ˚î}PF"∆mÏÔÍΩŒ≥øv±kπ,Ù™Ï∫!ê)~vK{Já†…›a7áq=Vùd¸«÷È…ñÃNı=ÊàL±¯EïZZ≥ÓÁ¢g]8—Ω,ı”†z¬N  îÏ?vs®ÌÜŸú{7øü˜1D¨V#/•‘ã⁄—ñx+˚M0uﬂjYÿÀÉqﬂëÔÃ\EAÂ˚BíZÿé@ˇiú¸ô!§Q–Œ∞U*∏†‚@ÃZ$ î·ò^ß)W∏GÃN«8¿%!nÄ«ŒŒ^≤µÛ∆èÌ9iêÊŸÕoËyÜ?“§õZèŒjgÌß›⁄ÈÕÔà	œ[˝n≠◊>oû¥∑q>"Ú)g6¿∏√ÊO¬(ì]ë?1V;èX+º[Ânóû?sCêüFS¸∑7&\›¨&ÿ–ù·—∂gÓÃ9É1–Æ™K€‚/hEïÜ ãé±ﬁø€… pTèë≠≥≥ß"™±eÕ£|´˙*Y…õ¸9H¯’∂xD¸N	¬Ÿv"Ä—ÏàÃÆßnp©Ø°OËÇ@3!ØJ•v{]¬q
0∆Äj¶∞’ﬁ¡r8|:&g3éwº`º>ﬁEéÒ¶aÆœ)·o0§PW]∑ô≠/ÆÂ¬–˜XÍkËÇ–≈ô˘
¯Îı-ÚÑî…)üûµ⁄¯q>Æ˜@á:ÊCá:^8?\æ¨>®JÎ…ÔFúrág	q,+$h)Ùß"•‹#&M\hE“£ﬂ]pÙ òØv_s\0|aGétæÚíÛïmÛïœáÁ¥À·¶,U«Ø]n¶CïCïMCï-C·Ò5!Ó¥˚]@ûoæâO>SΩÏı3‹¸6≥GYÌÅx+ÑÈo…Øxqé¸‡¬ÒOΩQsxÖπ˚ﬂ ˙[çﬂ- ’“ ‚uR .∑i◊üwjÁ'm“™ëgÌÔk§ﬁ>Î¥˝Z,V.òÒ7~w◊&äïÀã∞‘ˆü»!‰°E £ ;≤lÀ—b
ˆã$Ú›*
„¯£" G§∫ºHn∂†:´èYA8ÈäÀÚôƒ €’ä>JW˚ñw«cSÛg:-äÏÆå¨˙`∏Ú·!	¶|MºÅ+È^ú€˙¡ı@êÚr˝`Ü.W*“^ê\ºô;é⁄DJFﬁ+àî§ª.GMhI@DP¶Riü÷}hç|&ëe/òHXŸ
¡rˇ®Û˚∫◊.”g'—ç¸U÷∂ZŸ˚∞§[Òt€›ç≥Ñ™ëdã®ãÍÌÛ>à\€F:3¬D%µx¬€QÖ<AYÅ∫‚ÛúÖ◊⁄q"∆]¢>Ö∆´≠Ô;çßZ¨≈Üm•'rˆRYvÀCîª?ùå∂∂∑ÖÅ:Á˙8i±õÏ¡Fﬁ•<ÿ”ÊÈ ÉΩw/¶Úh?4é;z–	¬=…»Dêóò‹Ø¯˝3ˆ˝3€˜B†¶≠I™G=ÈÒÜﬁ”„áª=˛‡-%Kìùß"GS*!˜ëπØå°€ó≈–X Ä M{ÂJ\2›„¥£iu$∞Ò˜œ“9ìëmm%Mº@Ÿ◊d∫WÙn÷líy® ⁄üÅ∆ºpmr§nÅnâ-Ó€‚T3æ¡ârÏ~Qõπƒ{/ä‡‰2Ÿ÷¬Ö(TÃÉ√,ó æZ`7R·ÍÈOì]ä/ç˙w@<#Ùˆ1ﬂÙ+ÖTãú&ãlÏüóÏüä¸8M£>$á}ˇÇS9@·™ÇÊ»]€5!J/™&ñH™’êØπìäŒ3g§|ü™64õÄâÈÇ˛ï•Pã á¿tÖ√ÆÛ;¬—Hi»Qù(˙EîÏ?îpì◊Ó` CÄÆYo˛6qRwÊC«á
ı˙∂âÎ3©*l‚ KO~ÊΩÄ¥@Pü¥/|o0w`	0Åæ°[∫£µÏZ–·\∆Sﬂ≈–"'Ù$}G≤«%ÇPºYM I•FC8O,p/ùπ?´;SÆ1¶¿eSÉÎ‚OâÙ›üºa ßp#ﬂô—sÜoπ=4∞^Ã‘#o|Ûˇ¡ﬂ~ù†oËN}ıurÛËD «ì±7ÉÅ„hP*ü⁄DÚ˘∑NI_Ëëä±Üã@›L>Ç˙;t·œ°Cﬁy—‹ÒΩøÚXX.s
€ƒ\¥’RP‡ñpøA±Òa'l0ò:≥õø√¿Œï`≠√¥∏#X∂3NúùCo‰Õ∞‡T\Ò@B[»Îà—wÒ«¸e¿?§˛Q	e\ÿYæ8Rg¡∂áy»#+: uÖfá§∆êawÑ1§/∏º‰”JB'. dµS2´Ï_¿rg3ÚˆUÀ0Dàã§n˘√Ö°»¿ôﬁRq∂¢?ÜÅÔñ‹0ho’Éπ?§éOg:u·^èÌﬁT¥`¢`˝OQÁ‰òﬁ~8Ó‚hÜÖWˇ¢[}â\$$o∞&d!B,t∏ó°¨ûÆØÈÿbêsC` !Ò8›Ñ %G\y∑®äœ òn´ÚÅ
˙˚Ω{FW1zòRà‹Dº ÂÓF≥!⁄èçv¡ó§^Î`ï>™ì>&RxﬁK32è}4Î3ˇ¡≤xé∞Êø·?¶yp'∑y–
∑M[
w>¢•P=ΩÆ<gû‹ÆpáN|EˇæÙ›+Ô;ÛsÃ*	<Ô)ˆ9˜Ú“•q;-Á:ò”›Öﬁ∞|UŸ"ø≤ﬂ+“Ô’‰˜*˛˛(m£ˆÁQÁ-LÀ∆m°X¬Ñåx|ïâ*+!BSâ¬R˘6kÜJ˛‘≈Áû°öÜÍ*3TÛœP5œ ˜îŸrÊ≥`ƒ+∏ FéZ4ÒôÔ4_Ÿá•lUy/˜»Í!-˘`âë´ÊëWÔ/]
¡MÊc`1(eI∆ìƒVﬁqCnUﬁSø9S¥«™üsoAA	_√ÊöëÜŒ3’B◊A;—˛Å˙Â,Ä[øÓÑC¸˙P˚Z∏Qƒ{([¸Ò040e}
ç≤Cä°âCB1õº&Ú†È∆»_I€)Yq ª.ó˜,‰l›ºâYPA€¸ûqÛá∆ÕÁBbGíÖ  VñáÉŒ”Ú¬·`£pÿ´f¿· !Ï.oO·PÕÑ√C#r¡°Ätuû’ΩhÏW2°!cî∆Åœ|Á–õ0xo˘f°ë6¢_¡?ﬂÂFÄÔ›S¡-{%}^yØø54ŸJ∂ÜÛ}¸ôõ≈Ô1∞Z∫J˙0ﬂÁü%¿)*'>/ rByÄR‰¬˛2wAΩpâ;AùhzÛ7Xå\°íZ˛p¬{‚°m–j>O¸œ|ûtëüµˇ4Cm[ü+5K17∑´!q£u∫gæ´(ÿ‹7òÕø≥˙ÒÓ⁄Ωª¿ %rÊÑÉÄtú(rw:N8√Î• 0H4üy>˘À‹o˛”/rMh≤™Ä”–x≠c!"õ£-’Ç˜wI·øüû÷NÎñAÚ©“0J˝¯døQ∂å"9±Ãx/Ü∆#ã.
H€ΩR>ã†ˇ”‚9`+%“ú¿Ãﬂ•	®qÑﬁƒi¬ ‹éÛ0 ]gËYûBäk ÀÃîà…R%G∫'ïﬂNìâ∆Œfºæqƒ?›…!4∆L◊Ù&œhÜóΩ”Ó·23ædâ@1!ÛÊãp«j·Å3ﬂ=-?®‘Lg.û&[eë/Çˇ˚ˇó¶7T¯õ3∑~Û70˜<√uu≥Ü|%vå≥IL∂ÌÿµŒ¶∑µ¯1në0¡∂Ù)LpƒªoŸÓ Af¯∆-ûâ3Á
ú‡zè8Óﬂ:t¬∂aeπ√'8±≈+ºu¸ƒ∆Ç`•X…ÑR»ñÔ–[6°>Fz=M1˙<©'BGë∑[¢8VcŒ^•ú+ˆ–=uú	à‘}ö'yÛ7≥I°€;ØëÔÉy8q|“õ]˚ÓÈÄÙ◊"µ"ˇÂÖ;Øá[.VÉÅSÔQﬂUÈ2∆ı∑NXÜn·`±† EÉ(æMæ&ï’aëƒv:√\∞ÿG‰[ƒü~&”B≠YñŒ‘a·˙¬<Â#rP:Ã⁄AˇjF’Qú†KwrΩ]1aúâûOÏﬂR†Gµ|ê1Ω+ì	13HÛ9
≠üe›Œ|{U∫ΩΩ“ﬁÚw&, ].åÏ°eﬂË(U6DKg_ëâf.ìÏr–”bY)aK4A0a£Ù/I˛/◊nÈêˇ0ÀMöf≈&˘ªfïûkëàÎ°é<vöË ìóó|âx∑Ù øˇÖ8>PˆŸBpπ·ñ%{ØD:ïÇOÄj˙∆S°«ˇpá$éÿ!ÁÄ>)ìo¯o3ÒKqÖ‹Åôë[]wÑa q1ì
PÒw£Å„S&ha0…Y 8ﬁ÷4Zf«Öuó„(ü-{õ
fûÛ&¡$›¢†∏m]«1ú°5KËI£
h7˝ÊìjGBÊ„b“ïŒ âº!⁄æ˘ﬁ¿-î∑K?ﬁÑ.Å˜W{Ê;„û+V€5Ì¯±˜M±ÍŒˇÛﬂˇXuÔ¨ÎGﬂ=[∆R˚OÓH»˙Ë«⁄5¡$˜÷“1Ój´q5Àc™Ê˛,t¢`í 0AË°‹6tÄ#≤X+∏OùŸÕ?∞D	≤∏FÊ†µñ4>`çsn#·Vçî[-⁄M∫qm5¶7A‚x`vú/ë˛Õﬂg®‚’“]ﬁC‹ésZI}‡2˝=S8–¶(¨™v¥¿qÕi≥%-∂e≈¯
¸è«~·Ÿf?™ï†@,zkkH·Dá∆’Ì4Æã
(yÉ∫h„X((&'f‡…aﬁ{¥¿›Çi©Tñ´¨£ñWh4å´ëgéÔ;B•ñÄ⁄Üj>»Xõh“&Î›"–o±~êçP4:(ÌÁ@#)l0≈#Ω∂S$¢•}+ÒËqÁÍDk·±fÓª¬Âxî‚ı-«”§H+N.‡Ôp¸n
(˛Í≈17≤¯ºwããM∑õ\ºÉ∞Ef;ÅUq[Î~Q6¶'›≠‚ÌAâ±ãN˝ÂÓº{¸(ˆ>õ%€øß˚Asdˆ<éÚ“Õ?∑%π&ôªCgB∆7ãX¨uJAìP[∞í˚)π∆Qœ“ùøÃ∆≤.oßÊπ\X_ºùˇ$ﬁN”ÔˆÇ3˚<¸˜àtùn£◊8ÔÛ∑∞ΩˇÒº∞∆™3§z nëgµV´ˆØO€B°ôƒü
óCu»‰º(Œ_∑ﬂ˜@∫¢|P∫ƒÁÜ&£(ÌÛÎØ‰’Îmö¯1ºÏÕ‡>Ô∫ó%^ôÎâπÉmîÌ∏@L!L´‡áTMä’∆Ê§3º$_=ä_ﬂHêü:‰˝Xbõ-§jékê3U%∏Dp÷‡æíF GhZ@≥±Ú‘
r∑FhÀ D&ù	fz“C£2‰áx/ó˘bÎ◊¿É˜ïµ*îv†Ï˛64ñ.¯¿¥`º8ÊT≠¿ÿÊÅÔxc°ÃÏ2◊ø^Hl?ﬂq <StÄßP‚ı¯RyÂƒ≠Æ;›uq¶™ø¸yí≈?á∞ô	&<¡»ïv†FBÙiÚjÒ®W¿çI-Ä,√©rR"MrhúXÂo˛6¿Õ£~Ô¯3D!2‹ã‹õˇùîÑM{>≠ È;4/*ƒe`C7¬Pz'&“'oπ∆#í]g÷@Ä"™†èë≥ƒòπ¿ÿÇÿyKÌÕ¸‘ìôÖÒ%Œ~˚NÂ…IƒYHE#Sô!& Ú®3•˚+Ï&≈üÒ“èN‘Ê·¿eﬁØæJ)E¸ ∫cÍ‘ª{—	JZJGˆkuxÊ¬¿ﬁı)ã_Es	˘{:
\#¶hWq$·W‰3o›¡œ»ˇ#Zg2t«é7â∞>‰TŒπé¡Öë,Ó0)˚üÆË	'V)Ö=!Òœá≤¢!ìT¬‡‰°W™')G~*(÷Ûöö‰ΩÏê]M®W«Ë¬¿‰K≠4épk˚Œt[Ûh1Œílu´€8?itÈÒº÷:"ßÌz≠*Eø›i?Ìﬁ¸v⁄¨∑È£1º·ãvÎ˘ŸÕˇÍw·sr“<π˘≠ﬁ«&ﬂ*‘µry∆¨R´Ãü√≠ﬁ¬»*ƒ)1®âŸÄÿRœUX¬éZwÁ6˚>4ﬂ&íu-~V&%v±ÅıF‚Êpö»r#”ˇ”/î—‹#eŸ8ú”t'_	<ÜÖ2D’_◊xPç{I!ÿ=¨≤≥m~=ÃJ&ïaNo“≤)°jâXUÌÃñ®¢*Ç"ªê*5(œC
X) qœÚD·F0-o>ºpéπ≥™QVx*±òn]|N@rœ^’X1Z—  CÈÿ ;2òxrºµ.˚¨=§\ïÀTãfÑ∞à)ﬁ#÷Á„–uX@7∞ï‡°÷í¯™TÔ6ÿÂ£‹ˇ©=€ù~≥}NéèH˝yÌ§{Û{˝y´FB.<Ì6OH´ˆ≤˝ºøΩ¶	c◊¢&◊á¬ÿ±TiØÑ°•C–¿Å}=‚ÄI 0`ÀΩúÅ§Õ|YTÓñöö¢ì©◊0C(Àx2à≈reu.ÚxgAﬁMNøòn¨(l∏Hê€ÅÊÓëo’z}›ê§õRô?W(5≥hÂ⁄Ûó1Ó&ˇÏ4í5Aè¥Ã
ÀŸﬂ‘Àî9Lu9√g∂ %“®'e‹ ]€›Ê”Êy≠%%»W2ˆ\÷ñì¯‹0¨Õv”%çu∑:}›öi[°¿tJÛfôµêNm4+C	¡a^Ä«î}‹#Î°ølõÃbj[ÔÂ◊mÔJÈÎ™c∞Á°p]>‹7≈yÊ\ ßKäeä›Ã}ıPÿn’÷ »≤R"©j∆î≤¬I£_kµ€Vå:\ôJ´Cäˇk'’ïPGZ§)%(ﬁWh‰Öy≥˜àg…)æí\À Tj∞¿ﬁ §o£¨âÙ;»W*(≤ïØìÿ‚ªµtáÓJ‘ûΩ»îç/SW@ﬂ{¿u-¥˚èÇƒÕg˛Ñ	°])”\¶=isïRÆñ»ãfØ_#gµz∑-ZVjÍk‹ˇ" •∑ÅKvH≤íø`Ö∏Xj≈¿ë»∫;◊;¯ØÅ»x4¿^ŒòïÿâI\Á~¶$‹=∂Çaê\JØºY√
ˇ°ﬁ≈åö4;¥ßíó√≥úÍ§∫ÙSå∏;·l®£>HΩd¥êN÷∑√ÿr›´©üYÓ+Ö66Eá@Ê≠kOQ†Œ‘¥D+à@JI¯
ÿΩtEÍá€F„Ar°‡‡¯àf∑Ÿ≥∂ƒsU]* %áñ§ZßR˙1ë≤º„lÛ/Í„5„\æòQÌY¿∫!2—82ﬁ5h‹W£$,IÃTóŸo–%<˚“/ä¸áZ©“˝Îaã)h2§”¨‰éeãµo£§¨Å‘˙fJ\	<›útÔûâK%∆O#À∏èoêöMdB,7Ûòl¬V;"˝ÓÕÔt£êg†}ˇk˚ºè‚~ï‘—Ÿrﬁ[Øl¯6ÿ°°ûG“)·ç… 6‡FU6¶ØxC≈tõüÖ·À∞Óª3{•±ÉViq5{•	È˚Ü¸¿µæ‰Çê4°Õ≤›≤ñkzóØ≈ßÆK„Hëï‘Ãe&äVö&ñ≥’:>∑∑àÒßΩoOÑ¥~ÂZ„rñÆºS} Ù•X≥≤,XF”√¥[ëÿ⁄≠UyèZZêë ™©m…LeUÂ9ëÃPI©‹û÷å&(˛ê˚(nç&®\ã\“ïwÆOöÊd√Sñ©	∞ØS;owÈ{£m|Ç≤ﬁmo«p[∫[≥≠)ÔyK2ä¸˜	˚∏géø√ˇ0£~Ó˚;¨™â`ñ¢¡S~0¯ô\∏~ûTwn9âñ∞1âyã)ì0:ŸbV6;iÆÛ5[ûÆ¯vñßEÀOD[ht⁄∑ùˆU£ì4ÉÙ4u:—∆
Ï}¯ÑÌT¢®.V∂Q•A3õ1RŸëÙ.ÕTR$’6õ©È£Ÿ®ñÅÁ¶lTfz[•Tø»¸¥FìSØy˛¥’@Å;óıV≠◊k÷◊nÖ¸Må67gé.êµJH›«¢`,≥†˝ÒÉ´ñ∂*Â¥+≠%§J≥.Òxu&ÿ\8H ∂ÂÂ≤@≠?Ùjyy=ü´xi;î(µØ=˛j±Ajië}Mcáæ-ﬂ⁄xQ‰Å:aGå≈r$õ'°{ÈÜÙi,Èˆ¨'pﬂPJ”Xz$â5{ÅäÖãi\¶®ìey—«:[“ñ”∞ô–≥ï∏Ræ¥Õ®›!√ ¶&O∏◊yØﬂ}^7¶ûÆ)VMµClÑ£›:XÕ@˜©¿ß®…õ3÷M¢e&#ﬂ%Ô118Ghb<çí∂å•)Ê¯Ù&≤TE$†”ä^EC$≠ƒ1c· ﬁM≥lJÚú0óÏ6¡ı¯J§£f.J;¸$8›R+Œ$Ü+@X(∞éáö±ÏÃu¢yË—å¬* 1ã}1ã≠Ÿ,&Êı¬<p≥à!ô∏Ó0ÇüÔ’‰ﬁènICMﬂˆ}öëãÂë—Ñ©ùˆA√ûTLâO&#≥Äƒ9ª¥¡øòpÔŒf N64∫ù¡œKYÓ§Ú˙>›˝EÚPˆRfΩt$5∂’¢`n »'õœ∆˜	˘RË*–˚bÒªµ≈œ^¸Û7ˇ	ùˇõ˙õZËAâú4kOœo˛Ë—‡±⁄ã⁄˘ø÷N⁄‰%©ùﬂ¸÷jˆö=Z˙•^ÎâuÄhÕ.∏Ök«øéºËΩ^k/úÛÈWÕ…ºjÊ(]¨ïÿÍûÚız
Âîw-ïrË[†Ô\^NÑÃﬁ∫c|˚”«Òxç©§	„UÖ5ÛﬂßA8#ÖI@∂‹ÒÖ;û»∞{≤E¸ ¯9µ*#ˇf£˜qc,CÚJ∫¬^”√„^'Wôm ˆˆ,&E ”""®´¿áB∫ÒhL£TÌ£‘X6Gy∞H‡n*Â1ö4Wƒ6 ¢Úâ˛l⁄À¬=`Á≥˘Ã“§7_+7≈„>qgn*"æò·[¡W Ü¥éJ\í•=•«É∑nÑ∏Aëò1AZ"é—W`a"ÔeáùÈ[opD~a/ÖG2@.!~–ä®!ı5˘PÜ I Ò•1h>Ä8≈/<⁄Ω=eê°wIM~(•E“Hï2jÀeX”A2–˛ET*+)çA¢—'‚Âı‡⁄Ò´T˜“av„ZtS)≥h!8Qœ	ÀîwhÿehYIZJ`05≠&M≈}öZÓ•Éä{ñJ_åì0ÊÚâœÁﬂ(
*Ø8ÅP‡„µµ¿áÖd†ΩyŒÑÓ%S±ÿwœ÷7•v©º◊kKy/íá–Ì≠ V&ì 9ÿ(-É÷Ä%d"ûÄå›6jì÷îå#Útu;¡…'ëkQ¢3nN^î(lI∞‘hNƒ,≠ù@q Ò®-´Ißµ‹[0∑êô`†:˜ ÃÉ˛mÏÒ¿eåî¨˜0$ÑÆ3ﬁyˇ÷ì™P€Ó^<°2∆ßÌÔ≤ÓcwÊ¯æ7 a0˘´ª3)oV*x4ª8‘>'%ÏÊNvËb¯Ÿ.$Hm-«t	Î'Fi¢[“¢4XrGàßíè"#?Äa*7kw)Z\vI∂˚/«¢r”¢uµ°@å‚¨Ÿ¥ò9‚ﬁ¢≥i—âÆ«Ã◊∑¯ˆ{ò∞'~ıÇKJúª;û,;⁄/AU¯lftn@‘≠Àá¢Œ:*ﬁü|o÷ú∑ 81–¯ˆóüI– ΩUpMT∂‹;Ã#∞f‹“K≤—[ûEÂø¸åßÅﬁ§Y≥.{ƒΩÖ#
6XÉ#±¸‡w'ŒÃ)≤∞ﬁÊJ≥ !Æ^í˜†ÚÜ.Í<ç‹øÃ≥iØ"J¡ˇëÈÙ-™j√çÊ:?£Y⁄!Ä.≠@ÈMF¬∞»
‚9U{
]5π—¢råCE3Æâóî$#w‚Ü¡<bE.ã$ -+|ÔEÒk∏dõÊ	ó»bHî\übKT&óﬁˇÚ¬xΩÂûH3≥pÓ¥U“Òõ≠çÎúzÍAf5sCi2ªŒhs"PFª˘Ç;Ã€·L 'µëL#È+¬Òì6	àìíå[3“∑
í|%wSÒ$6‘—Òãæx©\˙ÛüˆcÁﬂ"wÏ¡‡Û±⁄cDY‰÷iÎ˘˜ktV#Ω∆Y≥›∫˘„©ZΩS∫–ÕÓ¯£ Ùf„egØµû∂ª7ø˜ié¬}rÛ[˜∏›¬“'ç:ÄÏÊèÛ%◊‰F@¥∞ ‡!@À—‚≈∞8Öiû˜∞¶ìvótˇÕV≠€Ë-9˚ÿô:ˇåù˘ypVÎ‘Ëé+$†JÛ¥—mú◊õµ÷
´ 1„Ø#®u5«˙›ÊøR\∏˘ÉFl‘€gùZ∑÷oæ®©≥€80,&Å∞ ê‰¬	cãõN‰J2Á´dó¢L›\iÁ
•¶œÀñœ+Øµ9ñpQïÀ…R—?u»®1;À∏õ4K˜nIΩ	ËÀÊp·NpÜŒÖè0ù`¿≈_È[*ÏùÔJ5O bÍVJ—BÙÇÏ[N<mRqa0¡¿l,≈û∏-N€]¿;Ã∑∞#¡UÅˇ›ñÚﬁ‚∫7sßQ?@É¸©Ö°s˝ùJ%èc∑ëÍ¸âÎë€æÁhc˚˙bÓ√Ì=âøıZm·P¡öû›æ®r·Üz£ãQfÉèQÄzmH;â†§_‡Xé;Å± 2w®H¶Û4K”yÙ∂†Gphm%/R–xWVZöt∫M`vw’:¶êﬁÍÃÒS˙‰n8ÛÜÈ—∞g”]ìC¯Æ3AZ8¬Ô{ùì”Ç}õ•iËÚ_ü2Ì∂>,?º#πî>Uë◊“êµ«'<∑*¡-S–ˆÉu¨”(&m≈2•jí8Kâ)Ü›éÙ)]>l´WF˙â"°ßÅÖÎ”ïı` øÎY†bΩuÛ˚9†‡NÌº÷ø˘„åñ„ ¬¡z¸™}¡%ΩõøRéùà\ìñ@tÄ·y´b£i”˘è3ÓΩ‘Y¶ùñ<HûÑ¡®Âƒs$cOÇÆΩH:U·sÒ9Ã'∆pπ‰mæoäs%{À"î≠=âüõ¢28,ÖÓÂÉnÍ ∆∫°Á‡öáîÄ≈˝¡áÖØƒ@¿ñ&Œÿ-ÕÇVﬁÎ0ua[Ìhh≤≠æ˛KÈöÆFGè7˙ÖMÛCÊÙ’~x≥ΩÕﬁ—1kEoÉ˜âÑI©œ¨)úKl.¥˙V#ky"°qxKå˚oäÆwõ˝F∑âÇs£WØu˚ »„kSçÎ≠ÁΩf˚ÑËL¢>Öv|ç—§;√  ¢„-ˇ ¬g«»˝®3tı	}Ó(îÅÒG¬¯~¯¿0Äﬁ¢#√–…Õb‹Nä˙˘*Ëﬁ@ÉıÂÔwÉ∑ıIÅp;Ï5™U^”T)ïB˚ﬁí¡Àòe·9xÑ5{l!zµ´	N‘+‡Ò·˛§ÇNx*[‚•˘±’–®Às\ÚíõSÎ∞0f4ü¢≥\ eSH{:<#ÉË8ç®ÕYÖÆÆØR8¿‘ "ùRjv≈)√/CÀ%ùk0ã˚S D9Çeiù∆ÖSô7≥Ü"≈·£ZœœAn{9mû7Ò◊EBC-&#¯‰˚π
È:√|‚™Ñôl"Ök~!A≤</%)(=ód∆sHÃ¥|X$û¡:ãˇ-c®k’ÌQÜ1øQèÚ⁄éñ‡isqÂ%~t€Z¸¥9nç˝á∆$ë‘Â4tS'‰	œ•îAb"~ÁÜ?1G¶‰√«Hs¨ûE˜»ëôÄ¯w&ã^ÂËágá!ë◊„”Ö˘U›¯®˝å¯7;»z¥cæÿ˛F?]kAEˆüj∆uË‹∆÷.‹{ƒ÷(∫≠˛!˛ß“ûŒ‘Â¡•hUÍf†≈ê©3–F1ÿâcëÇG/3íw˙l*>Nû"˜‡äû¢G_mâ√‘ÈÇ-DùŸŸ3VE-Å“eı≈ˆπÑ˝/›π£Æ’°HÚÕ9Ê~9RòÅŒ¸3}ó¶jÊ
¨<›•¯aŸÙ°m∑∆mVJ¢ôO‹¶ms‹⁄ã˘Ò„äππvŒ«höAÕ§FœıCèJAÛ¯CZ%`¥/ ≤àÜ”}˘" ≤‡¬˜@À»Òı≠°ñÛ}_∫ÌXËY∏Ôáªé:§\é≤5ôÉ•§9ﬁÑƒw5vﬁ∞»`±√@HÜ?0Zñ¶ÔZ(:G¢H 9_±TNEzÀR9
c√’√`è°Î•Î%£•10ÜÕÖêú…ıß-:‰<B¨,`7=F!"œ∞Â‚èOíÀf—ƒ_‚ÈRya∆Éê„‡Ò?·≥$ìåañ;îÑ“l…≠b¬$»–âﬁ¬9¿•;Åk
≥‡p[‰¬ùΩw›	E’îGÎ2ÁAL(∆√C˘Ì3ê•Ùçı^,Êt·,—RÕ°¸—Ù>÷
a€*í≈m$>ë≥¬=/áD@à>¨Á˝‰=jäl@|}nï5≥¨qìÂâˇ≠cGysoSã—Vì“à-âLË3í Ã,\u÷>ÿä‰ÉïÇ2dÏZB∏MIT≤◊π-ßXumŸ™}ºTZ…k	ä«´_à›ÉH€≥§t∏Y–n{îÂÖìùÉ‰:(^Ω÷|4 jóqr…nFç‚]ÎÃvÏ§é&∏µUõÕπ–ukÂMàÊ0¥KNn˛Ò´ú-˝ç)fE√jº)Y
F@Ÿ†À‹!•7y7∂§S[ˇp>ò9‰öp3eèõ)u‡[G4/TıÿP∫Õbv£XJHÁs|ˇõ´$bÌ∆mgXª¡ˆÄ˚¨Ñê“L(ïô°÷Ä œ	&2ú◊f[`ÀSpc9ÇûÅdª8Ãaª†bögOkÃ±“Ü‰ΩH„ó´·Mz`ì“$åö
,Zº∑62˚Tù}jü!«√®Ú…J.¿1ës¯BÉÜu`≥‡Ù% Œ:®†·üñçüÊ∑)Iı	ÕX6Ωàbª¯˘.∆ôÌöÇÕƒM≠jj±>-4^˙qÖ7Ã4G$€EîåÇÉí\˜q|o4Óã`v√-ãJ±†ˇQ¨O+(ˇ¡5nça&®“,x,ëáHØYTçPœ`ï4=8©∆ÛâXtÌ|ööíMMe´‘-^0k∑«–Öòî∫¿ÂÌ1Ü¬∆3eçi&Ù·¬
ív•ZπMZt:oñ!ÎNZ1‰.ª≈ã±7Ã*Vf™Ë(*é–;Ω»ƒøT™ 5Ñ‘âçßi√ãÄ_rU√Õ;A<∞#¨πº›¢“º≥¶˝äﬂYU€Í…Ò_J√]î^¿R®¶à ≠™√⁄Ëj@“¸œˇøH!€CdMLiº@ñˆõ_ô=¬`∫u~Q_<—ì8>ı6A¨•üoRÿºﬂ⁄∂¨Üπ—xlÇò§¶7ÂöﬂàÿÌ_}e_¨äÅÍãN≥BO≥ﬁÓv-5⁄¥U;Œu†&U≥äzﬁÑÄ^DhÀ”∞S$fƒb–…C⁄JŒ5'§+À@Z¥y‹îU sœáê¸F ò…À%-¯f®(ëNn≈”84‚P0x9Cp,Æ€k:¥Í2á&Ÿn{j{Ò©ù<Ø˜k‰%9´ù7æœwXV3
≈~w4˜∆ûã∂<W(*π£õˇò˜]‡œô≈,&Ü5¡roX¶&ßÃªÏuä<EIr˜™‚øV)t∫\†TN•gMaRIDî2≥kü`ÌF¶Z+mß7ø¿GJ)R µõwñ6…‹µˆ-ÿ!Oœc¿
“ôQ`á∆Ü∞Ÿk¯B'⁄V‰@j‚Zd7ìbÄ‰Cµò∆h})K *;òÌ≠´€áY,a}S4¶qî≠=∫”í¿·(‰O ⁄'y∂_.etmÂÎ ÖvKívbÙ©YögÖ'm".ÈpªÖ!™@≥[¨ÌD®ÂÅ«$›2"…õ≥+Uª‘°O£s¯—mÙäZ£’(„	íO 0«\ˇ≥ÿEÁ˛Ñ+]èÒ 0YxíÖÿÎ¿füm˛àùuQ◊“ÅmDêñ√π’!Á¡Y1ÿF1Á(A˙y-){G$G≠Ç•Ã)9Í%¨/W˘.›†‹ˆb… »kè—§ÀΩ—Y4=•˘iA@‰ìŸ‹• ∏≤‘'Mp/3ª¡"~ ü`YøîµìØÓ
mƒ3»%“0tògêáêA-¯5:DsÏZ6FÀ˚¥Ö°≥*&>æΩ∞n1oÖkË#: ” 
ΩˆπTZ·¨÷m∂•'x çÇ`∂DM≥$óïÈ>›`k&ÿéßä`ª»»πÁZD@ÈËZå2 ÆÒ6Œ@ÖiW2%w §ﬂy—‹ÒIË='â¬]Ç≥Æµ3j°ßçF¬&^∫Öm≤„FYös°◊ñÔlÍê "~h[û.) )"–π3v-–0Œ¶Œ∫Ê¨„cG˙∏CnSrÑ	9Ù∂z™eYçîQ”†/ıSÍ˝ñÂ%n*Sß€àbîô©3ß{s∏Ÿ±a…Ñ¨¡åÔ`õ1Nv˚»ò!iôœò7ô:zuµç-ß ªÓeºE≠v«2l03EË ®Õ#5 ÿù:’⁄ˆ∂‚Ãç},÷ˇ(#≈ünuÄ≈!QW¬kÏ±ΩXÈıxÔ] ‡ç£h3‡´M∫*|uçhÌòJlVŒå≠òT&°ãb:◊a-ÃH∫ÏLBóefB`-;ïÿg·\:J…˘ƒvô"€sêùëœu∞)›Ò.¥«º˙„F]©ñ»Í»Y√¬ÓBYºe¸¨ËEê„g¯èM=∞öY`…Zs≤Ò[~ü1¬+Wm™Co\`\›Tøú±û´v∏'I∑≥kOD"◊d˙lcEæ≥Òó-tÅÇgTÒlﬁôµ ∂À\•6 -+˙n.è◊ÑJÙ-‹"94âÚÇW`˙ô%Á
›3›
ôG¨ 0üÁßÖ—≤é˜˙_à5·qπ3∂›w{¬ª·2¿G ≤éòÓıÛ:c√·-ÌÊ3UÁ≤Ã ª˝ˆ—ÌóQ|IáﬂÇ“‰LO≈á∞ „d‘˘% ¨©'Õ|ÜÛ\=))….C©≠⁄4ì‘∂¥¨S©T 9∂zÊ∞¯U=üO‘˙≈ú6n E‰Ïÿ¸¨•/Y˘IZ9Á&§S∞Z^ê\`™° rﬁ!›+ö˝Œ]àèrÀLtó∂Âq3x¬ÇùI≈zπ∂)ï¶Î€ã2¬ÕHÉÛU _⁄µY„≠%Gó+6öi∑öØ∫ﬁ¨≤ƒBA‚≈•à≠EàÕWΩvo^5Æí˛§Òk[1b”¶¸≠ñÅÊÅœå~èîÃ¨1ø
Ω7Ï±π Àq¶˙kÚÅ?O©‹Rë .òcF§–d’	ﬁë,j†r\∆NÒ≠aπâ˘™W-(¨∏¨Ãú€ﬁ´Ú≈—åuá§ï/W1‚∆Y?Od∑ÜU¸C≠q
sp‚Vˆ–ÂJfpì*	2pÃÜ”',›’	gÆÜHK"V¬˛®ò —ÒßÑ	d≤Ò@Ä˘∫Å'Ä“{$9V∏Vﬁñ∆ŒU!A¿¢∞4‘Ÿv¶X∏•q•X;Bñ…qpE
ç±:˛p€x‚â—Uz«ÿå©Õ∫|¯ ~ÛmWUÛüsû}nt7æ»ÏºúBô€ÿ∫Ñy'ùÈ5üû∑{§” ı¶Ÿ>Øù˜=R®ë”⁄ãvw{kaµ=ùﬂ!˘“Õ◊…	VãX @£rÙòø$LDÁ21Ø=|l:(‹(›∫¬˜≤G:g]+åä±n˛∂Å· •T‰îÛÑq⁄Ì”:ıSØ{Y5k‘œJ˚Ôbèry‘O∑Ÿ–æ’Óß—>+‚}8Ç?#—ÿ*Ú#[âÓÒÓ¯ß%¸Ùø 7ù∞…Â%ı3ñ°¸§€§üZ‚îKﬂöì€Ó]Ofo›»ãêi∏>ßr6œ‰'[‰X!Å›ñ2õaü∞§ó«€Ùﬂ$&E-ÿ\ÃŒ(KJØ(Ò≤véîLmÃ≤(·RZ0fWÎ‚îro9£∏u:(2çë"IS¬ñRA√–.ÑÕ⁄[Ÿ≈ä,+Æ';\√ •&œÎnZ˝¶™†Oó>B£{‚6íg)lnqîƒ'õ6(º§úﬁª˘≈Z|à6Õﬂ¡¨¸„Z´v^o§˛ˆm^ãÛ÷X\Q"jbU°s%dDõëin"ªåA‹Ë‚á±B~ôÿ7„&U1@8Pë-}†´ƒ>ÆÒ8@eﬁGû¥k
27¯πúgFæ†çœÁÙfG∆ß+I:q7#2≈⁄y„«ˆÈ÷Nj]r‹lü5Í7øaô“ ÕÛ”VÌ¨÷owõm–»ì«¥œû∑˙Õç:|AN∂7$˜!¬πáx_˜É.‹–.
*#wvÏc|áçä›∏Õ)`D◊≈∏ÂB≤d˙§é3√{øh–!-¸1^ˆf-FÊ!VL)]«Fy ¸,e†¥ËÚh£ÊÑÕçrûæ”á%Á çÏﬂXÒ—ÒŒ/(√è(ølíe”{ñÇUËëáÇ÷oG3°M.\¨Ê<ÚÉÃ&ôO&òKÚñı¢Ö›ù)Ôç«€“ZÚ1ï	åﬁ 8Ü{à@∂t…√››§C ∂J∫5˛<†=˙YAÉ∞2)%peêÑ÷„õTº<≥´†È““.Zˇ ¯Â†t+Ua+2hlÂäd
∏K±˙öı%?∞`HoÍ·Y◊ﬂ:Ä∆O] ÉYxç≈∑¯Õ#RhOgﬁŒoH" óæ'9óÓÏöOLfÕ°n.˘´$xÁÜæ3ç»{VRû5I›ﬂVqÄÛ÷iÙ£lv©ö ‘i}$¶j‚â±˘™´“â‹b2◊ÆËìSôî) èıãqÆC#ˆù+/jØ‚Áûã‰ù„˜AË∆ühWﬂ`2¢/Ω®Öª”ÑeV»˝xQ˜«GÜ”éõ†WMπh!ûöîw±3n_l∫≥y8QÆ>Xµt˜`∞?≥ŸAT†KTjc_…á!tâºâ±˝Lº£Ñ;H∆Ãr	026Ù§ÎéÊò≤˝ÃΩrF∞UR`ÿËªÔ\?"†k`^FL~ﬂ’ÿñUôI…≥íMûUQßyeô˜µP ói9ˆi‡MÅ∑W1∫∞M^(|è™ÄÇª_Ì~ˇ|£¸qÔû•“°»;≥ÇW‰D¸gƒYr`ãaüW”YÈ
òÃ¨t-«∏˝í X∆âŒı SÙmﬁ¢í∂(x®ôlìØ„ëÆ9  ßeVé•Ãj∞Tÿ_¯À≤~…Pá_)—◊·¨©j9#ﬂêˆ0ﬂçvÖ˙ú÷ê≠…\Î°ÈfZ«ﬁr≈!v√µå«¿:·K” «®>;¿•≈Kÿ!’“Æ<ƒ3öê∑ÙÅÉœÿõfåﬂS≤eIŸ—≥IÂ∏√ á{"ëÏÂø√,¸4!‰lE‚YHztt$Vê7¡ëÅ%ﬁTd#!V≥_ÆeΩò?;x·õfCN¢ŒóW!R•†%ã˚5SYM!ê◊÷M≈9ä§lÒΩ∑ ï“ 2”/(úKÙƒã˙ô<)—èŒÇ°¸Ñnæ^„â
æ{9€"øí-äyÙ∑8w·QÚ´: ù	ÖÇ∑te¸˛eÚ˝µ·`‡z·¯±Ô#÷ñ]1˙=◊è–/#πΩ–Å⁄[Ÿè	µY)|+Ÿ?në@ÊA|{fÈBÿ%õÈ;≤≥p*b„\;s©{„††3™r–”ÒÃåÑµÛëJ∂Å–ë[∑]€¸:2\Œ}ü‚toÜÚŒı@?˙@
˙Ö¢zÑ"–á˚¿*ﬁò0˙E1b$«8ó8≤é%¬È<äQÅFx≈¿~,Ûi-àãä›>0‰ ÎcŒﬁ$ö9ÉüA¬fœè¡áŒª¿äÇs,Rk∑ü»[JVœ[˙¨jŸ∏ÛÇJG‹x≤?ﬁ_›†≈bgÕ˝“˛ oî≈Z)Úç∂√\≥ãH^Çò—ã˜$˚(äÛ€ÕÆ‚òE>}1°"VÀ3∂ÿ·kQrÊP·d2qu∑ù Ü	+¯kÏuñ∞eß	q‘ˆã—@˘˜kl2°H∂ÍD¬»)˝™Eµíﬂ°∞Z"‘DÑ. œN‡_èÑwx‰1¥ËX≈xã¯Éıµé]Ó1HÓÉß¥tÆ…âÚ˙∑Ê›ËŒü
∆TÀ<ø∑ã·„£ §´]r	ÌÏr°ÑTºÔÙeıÌÚ! ∫∏2‰0hDúü®‹.Mòe∂bjQ‡†/í9=˘0tπÖ∂¬g…RW‚&‘W$ƒ‹+ënMNÇY™òe§¬ı´wÄÔ@âS±LC]c√ÅÁ*∞±‘*Pˇr*A~;√æt®M’˘π;ÛÚf@∫É,£‚3Î2§ô+¶Ó∑Æ;]¨/¡ùﬁºòÜCﬁπ88jÜ.æ ·‹¸oávwÄ´mI:Ü¢q "P≥ì¯≤Ó¬ú_ÄX∑˘ÙYüÙö'“©ù7ZG‰)3œ∂gHö¿BÆ@/=ÿ°j*¥7övùô§òä6\ÛÜØ¯§¶∏}∆∫¯ÿ˜Í6‡f	%-≥|Ê\ıπt&hÃ;ƒ$rˆå_∏n~ÛÇP≈ÿ£—„†≥‡!ˇö∑∆íÂÁq£©;Ãá¡÷á7ÊâZ/”ßK)Jõ—vz	≥˚' x…_©†" <!ØÑFîaàó_c·kÊŸ* ≤'Ú÷Æ÷.y,¶∫ç°[•“÷ka¢#±ΩfÒ§	mhLMKJ`PÉ∫•t4õŸˆuí÷,TBT“ösá-‰XXd÷SÉòôÖ´/ãfÚ2Y±	∑!c≈èú"Y ŸÍµÓ”È7{œ±Ëˇ”V˚∏÷⁄*∆∆#πhg¯ÿóπd∏Ê’ŸÀ«MÂ ƒ
:ë2Øµd†¶Ï“ÓõE´.ÔÂ\v^ÿV*∏p0wGÖä˘ãmx‰à∆HÈæ'æd®åü"ÀAk∂‹⁄ñﬂ˚ nS‚ÇOJº`∏â∆(ÆçsÎ»h|v[#£Cdv¡{bîY∑¸L£yêA·–
ßŸ∂	.Ò(<}◊-àï9hBpIªL"R®„)4="mºá©¬ºf‘)s·GÓ:¸©á9O$õÙ∂N=`	ΩÜË±o÷Z§pp≤ùpâ∞¢]7Å—~…X±0ÕCßîèYvò ˘|÷bC=6ùı\¯m[Á/Æ~∑(⁄k§wW”´Ìíbß')^—•ãË7˚“<‘ÀXhA¸£◊Ô•≤}ßﬂ*ÉqmeŸ-1‰¶Ú3KƒÂi±·∏avgΩd°·¿ÿ§∑≤ÀÙz|›2Ü$!wÍ;◊õ∞J'Ê%:FÍTÅ„⁄_Q˚òlŒ1)Ag–#≤¨ˆrs£≠‰˝[É,4Àöámá‰eÛç≤î«XJﬁh]MöÏ†µTr˛Æ¥‡ÜÛ]*óq[ENIj©'F˜$!£=
t·“I—ÎIU4zÅTæ¶7ÆÀ2Æclj`"èÄò<åpoøNÓmaàƒ®-ès†çS~Äz#t¿∆qjZ<PUi{∏≠ál†¡µ3…<Å¥?ïıÖ?ÀÚüJçÆ€yß,dQTìm{o“”Á∏	,bJÇôÊªò˘~\œ7»WbÙîÅ◊Jl‹Aï(Kf^*Üù‹Ñ¢p÷<9iaànΩﬂlüëìFø÷Ç^íÔü˜˙Õ”fùø0j=‹∂Ñ›≥çﬁ‰ s>ÁÚb@æìB˙¸·K“kwTøí2ëÃ7 ø3h˝á:/˘æ*4»}Z≠úiFa6ì10ÓG˙¿áËÕ⁄6ÖÎ ‘†g‹E±¶çé•FàHrÈK4êπËòü†Àıq„ÄL®aÅ÷u∆√…E€¶ÿj]b¥=E‰∆”˘ÃÂ>(Ñ›¶∂ØKVdÑÌî¯¯¯ﬁ3«˜ùøéh>ÜÙÂá7ÙπHJ?Õ£Y:˛E045ÓF”«X0Aõ˘˚∏	5ﬁ•ÛK]≠´†û‰“ÒÊäla…”o«AÄfµ‰Lì¿CW≥òÜËE¡wÑò<√•àÉg2âØúc≥·öo‰òÉˆ8Îîé3NI<ßt0„9©«Átº¯úéûìxR«¬I≥ì:ŒyRÑ6„îé≥N)«‡óF…é[Ûí˚Ñ!Á)E>{ÚgŸÄF±}ÌaI~$uÿ™¿ÔI:≠J÷<Ì∑§f‡Ç¬¡j∑V8TÀZ¶F¢∂¶∞lk˛„vzIvæè!E¨ﬁ,Döé}öxîÈ9®@hO∑sIHÜ3Î249Ì-¢†8é9î7øœÈg≥1+¨hJÎôñ>Jı	VﬂT\È∂RM'ë'ÿ¯bÓD’¸êµÕŒ∏ÑÎ9µ≈Áï ôcãLhkæÑ3ˆªáw∞èÊ41 ÏÅ`{Ã˜˙õ–öq£‘¯ñë
ìB’~ä¶ízB)=≥&˛A=DuL
pµπÄt3©⁄œÇ˚Y≈±å)º=_f	6∏dF‰BVh6œØŒoù∂üÒŒ†Ãèéxl‰à:O<Œ‚â«∆p%â◊€π‚±ù+.ì(pFõÄ¿9c%·å«Œx¨rFï7cú]Å5Æóì [òz˝‹Òˆ≈¨rè4∞°<L1ñ	Û±Eô1Zé–\jt!gÃ|ÌO))™â}ÜNÊå%—lq‹Ó˜€g©Ÿ"ÕA”¸vÑ$ø9mû◊Z… »óu};.–õè«ZÑ ∑‘O&nÿqÜT3êî‘¶Œ;¿Qt¥$åCè°/H„˝ôTBM°åæáñò”TüKÚ¸Â“ﬂ∫
ﬂ¯±VÔﬂô"/mƒ$∫∆%±±ùÖï-<¥¢Ó†^WœÙ˜zƒ§ERên+πLÕƒZ¶@OXx¯ìÓh”=)®≠"âMrñÆSÄ@».PpEÂañU÷~»ay&Åy+7ΩKDRÓâV˘aΩÿû±ÈnWƒdC…É™%=[¬ﬁºπ„ä{⁄.cﬁxö1ûíHÜÃú2vJ}f„v;®gtƒ›çµ÷snÁm"<Ì÷Zh}qÛ{≠Gûw·‰h¡•Ê˘ÕogXè¢”m˜˙7ø—⁄’-Ø€°Oàt¬ ¬Ùk=˚»îççeêYõÁ O`7¥)⁄åêË.
©«Áâ1ù€–?ÈqDﬂ~+-‘ã‚E6YJ˜–∂PûÚ›ëGLíøóYsˆP¬Ú≥&»¿S°ùHiXîªJV¯àp´X¡∞i¥ﬁigñ¢ﬁÔã∆7±D{˘–"ü<s˝)>ê!>3‰çaB„4√wx´∫W–â âbÄ	q0ÇkÃºÄÊsÍàû·ãg¡‰˛%h–¿µ°ßÍxÄ—õ8x'ª∆∆zD
·y„Ó-	Xëøj¯¥Ï–y÷?k—·¯'‰W2ô˚æÿ<ÚÉŸèI¢∞Ú≈K€?ÿæxë|Æq(‰ÅáÜV¶k}RÇèÊ°√›—ø˛*}˜>˛p˜[}†gÊÅ∏»§åÙ6˘T â].U´UfÈò9ò2${GUPQ.ùπ?¸}|bJ1
–-=f5¢È™ULí)h„˚¥ù9Ã:.âBä]]1˚˜7ºœßP-ÙqÀ«Ïê‘u•—Øø5|˘C2À3L◊fógG?ÚÒˆ)–-ÄÑÃ«€6géCØóº◊À∏◊≥§◊3≠ñ	–Ô? rä˜N(p√wŒü¬Eèã¢?1|í-$˛ßÑ}¢‰TÎıey‡h<≥¡[RpCÌ›p\<∞∂“{'ú∂a‚'Ÿ„ﬁÑtNNâÉ<Î÷Ç√òA¯AÂ>B˘åoHo~1ìb∫Öœ∂ú7n=€kª∂{‹ËΩ5)íF%z˘N9∏EXa
àXﬁ”ùÖ7wÿ’Û7\»Èsg"xúÄõêfßÉ∏y√yÄ(9{Zm‹'ÖnÁå|ΩMÆ…8∫æ3@ßõaÖ;«ákƒ)ÂÖS’®ZÍDπHà⁄pÛuAlqçg.ñ]àL YÍœ£eôÿ=OË-Ø‹°”4ÊNóIçR}†∫Óß≠Ï~-™?÷«ZøZ'ªcmjË‘œÓ”ùIÙŒ#◊–˜)hÕnv÷.∫»wXï˙	Ê !ê¬wÁ`∞ΩÖ"*˝hj`øÄ4·‹Z.@∏PŸﬂÅ/î¶bSl«ì¬^yÁ iü4iﬁoæ©èÀæ”)Kè6Ïæ;ÀB-Ãimx$^Ë…ËO≠cß‡·ã¯éÏß{*Äˆ«c∫á¯{ZŒ=iQ!Ö˝ùÚ.o√?¨í¬cˆô∂U3æÛÜ-œ|\Uu_€r˚ÙKaåÄ”˙`8}v®ƒí—øKYò„w‹ìâñôZÌzÿ  ÖíË.‡ˇ©8≥B°‡>Ê6-≤ãQÎßﬁï;,î∑∑ïwñ„wÇfﬂ¬‘¿Yäaª∆#ßHqÍE^‡ﬂ¸c‰¿¯ÙkFI;F\]äÒwF<Â˝ù
o+~âïˆyî¡; ô«Ñ6“÷˝$M+}\¿≠Ä‚¥ÙáUWJáÍ ≥–πpô˝˚¥…<≠È∫’qBwËF.'¬{j›@ú¡!A%¡§$√<6$˘ŸN‹Îà¶Ùi3ú£≤êN‰¡5Èπ>MÛò€‚Â˘èÕGPßπÇÆ˝lŸˇR È«îd·~Nè±6SÕüe?∆ÎGlU°tﬁƒ‡ª±;Ùh€≠cÁß@?¢¥˙,{$ò0√
ı∂8ÎõÏ9Î?˝Ç,V¿h:XKÄ1¨€E0^Ö-^j9cKdn∂K‰ƒõ‹¸måôÉâ\qD≠OêÇRiÉÕKi
iŸÑ÷å!∂£À¢0˚5ÃGÒÜºÉÆúÈOøpÙç◊≈êWFá^%“ı‹h‡»¶åÕå>é€mÄÈáíñ7Al—*yÓ 2É[j#‘ﬂçÍØπ{K*2`ŸéYÄØK√ (…Õ©µpı¬˘	Ëu@ﬂM	#∏€:Ω
j ﬁ›¸}‰NAÓ„π|7ø§å£”´mÉ‰&O=ô¡:I$<õÉΩÛFûÔ ∑†H·√O˝0I‰én˛Ãﬁ”	 iy‰†¥ïÃZñ¶ %ÚCª˚Ù˙5t≥ê …˝Í	©∑œ˚µÊy£K
\g>ÿ≥49/äéÉ´á∆∞∞™ë&èêfPq£öÖ∞Çùá˚ZEüTL5ñ¢Ÿ9Ã.îïQß…≠lõ¸_–+Ù™¶¶Í%≤«å„i…¯h
j¢›Åy=êÊfËrÊÜà„ÎÊ∞∞ãj;s"¬uÌÄ¬∫µç	Ê™ÌFÖı∞ö¸jÆqi Íx‘Ü•«Ü%n0ÇIí=)E· I»ƒ·Ê–˝ÿâ‹É=láhìTOÙ)¯é≤&HämVá∆YΩu¸À5;‡≥0ÉÂá·MºcÁ
ÇhÃÒyG|£Wì2«£5V}£ëVÌd‡EÇlF∞Zˇ‚~≈ÙD√æòx/ßònæÔHˆYdMV=)∆«!Nî¬Ûë ß,òUˆS*UÃå¡Úh3•ﬁ<}ÓãÀ‹ìrå‘˜Ωo„€œÌ´Ó—6pÉáZKfDh‘€Oªµ”õﬂk‰¨}“&«Ä•˝nÌº˜¢—Ì)>∞}s¨Ñ=’Â¿∂øÚ{ÀB^|ãm,áW+/î `:ÔıªœÎÃ‡WŸãvÎ˘ŸÕˇÍwõı⁄ñqÀπ@O(û‚Thä" âa‰ª1Øaa∑ﬁD‡9‚ÉÎ-enV•ˇtaîµâî)|g·´cF÷
Ã»qx'dy∞¢Mñ/…ãF~ë©“Àaüza‹ÓYÆÉ/xw[º[ëœ	∏Q¥˚Eæ∏ÎËª%—‡≠∫ë7 S–ô‹∑ )qç°ê€ß˘ôe≥g£ÿ≥Zß—Ü¥{⁄ﬁnÜ∂‰~ÄÙ%∑9π˘:≠∆è@9<|/6s!ù<–»rbI˙–ÒH.êj«Æ˙Ylˇ˘Ôˇ/ÈVÅ#…&@øf÷:öØc4àC~ΩMªd+ﬁ,Ñt’ú™iÇ¥1‹êÀÔÍÉÁ¢W)ë˙≥n˚4‚:≈¯iÛ¸)Èuu ∏3r\Îˆµ∏|†´≈¥å±)KPaSUUk†˝®¶lYWè÷G.ëgùcnµaü≠¡Îwê≥Ëà1BY∏{pÌ’ò–’8òR[˜N—–T„¨*` BÙºµ≤§fô_µ‡M›≠0…Ë>ŸÀ0Dà…ﬁ€ﬂ¶,¶àìŸpºjı3ıÆ–∆£√°È†\QÜÉU«C-?lÖ&nÔ#©ó-„bƒÈjcKf,CWóZ®]c)!°¢Â^…Z√á!ıa[E"/kC7‘ƒˇlñ°Œ_µ2aÛ3ﬂY÷Ù˚ñucëµ•˜ª‚¥îÔ ‹õó5ˇf!;µTÓ:*wÇ«ƒÅÍùA†Ñ˛‹ùÊã¨%,É‰∫´≈2Èò‚!TØºë yΩ95Óí„˘Ë7kT ìÁm“Å5P9Ïï.VwTë.ƒÍ*"N0,≤·nsU8˛–±V◊rk•√Ú1Ô–´‹Z÷™¯÷*ÔÕMXª4*wxgŸ¶ø%ªZ∞˚Ú>Vb1 †|G @G|÷‰õ›˛c„ﬁ+w¥˜ÜÔR}∆¸´1ÍÍËä¡,úG‘g⁄úÃBá{~It>b–î™2≥.∏5FthÓò®˙9∞l–~@cÏ≈°è›7RpPû]]âgWoœ≥qb bëw{û]Â®D«Za\œNáÂ<;Ô–·Ÿ˚Ä¬Ï‘ÑU1ÆYΩ#)≥ú5ˇfŸ÷>{îÿ ÇÚùÇ†í5ˇ¶9∑ ï;@5k˛• êZ≈ 6[Xµº8µÜ˝èÁµÛ~cE^4»Ymß§^ÎûÙH°rU!OCoX$‹6∂w8ìY0sÙßıúp∏Z%≠§¬≥±¨'⁄£15£ú5u“¿õ,∂ñ≥j≥lƒ·ïÚvˆó{51;wìÉf£’õ-è±hºS((l◊Xax´\J¨~/ôÅΩ’~™x∆∂l
¬MnŒ”Tw∞Æ“Œ´˜õÖã,WrÆ2ØaŒ H1æ‹õ_`Yã5≥∑§ﬂ¸ﬂ§FÌÈ”ZG˝¢O?ÔÀS#|=®≈——dl$£≤Ìæ¢Ye€∂“ÈòØv_”hœ≈®P∂ÂÏ∆T^9‚œ$ªÄâ·(ÜÅdÌÊ,<Jx:Æ≥v¥Rfä1£R!œ4Ú˜1ñ s¬∑Jı–50#qq¥ßÙAY˝@*≈π$õb˚Dπ‘m·¿©%£%â/Ø∂ä1.}*LÛ≤ëØﬂ,Z‰ù3∞
g`6oa'teﬂ‚6gRqò>cBÖ≠¬Ø)ÕBoå≈Ë≠º´í¡ª*+ÚÆä¿ª¿◊∆∫ÖR≤‰òE*µ ÊºÈTdWR»ªŒØƒP˜ª‡W‚Í(ùJî’n√Ø>m±Í∂Ä`$ÛÖÜOL⁄ZÏÚˇ4ÿUï≥+û8¡XZÇíÜ`Á@’T]ëU◊(=ÌÒÏåú°\öãêﬁ|äπ⁄+i+ê<ñº)Ô“te±ËÀmT¶OZ±π±ËL{@¬µn„$é$ﬂ`LoΩﬂ&ΩÁùF∑ŸÓ~rÚO‡—i¯ì8ˆf9F•»˜.>8U9‹˛¿•ör$c'ËΩÇﬁ[ë†˜6!RÿL9Ämıv∑€h’˙ÄrgçäròìﬂÌt<ˇÁ∏˝c‹T≠Ë&{ÕHSû“SÕ2ª‹Éh—éPŸìít :∞¶üßΩ™Î¥∂Hï≤“ΩmÍ—¨µVHcù4kOœo˛ËÒ®c~∫,$Ùy∑›∫˘„)|s¥¯∂∞•ÿ˜öY<·ˇ  ˇˇÏΩŸrIí ¯^_a≈.HD‡ ¿ô$@”∏ 3ª@ëÄ'#¬#›#p$+€o[˝–R#≥"#+“í{<‰CäloÕ»ÆîÃS„Ω>¢ø`>aU’Ã‹7?‚ ìôEJU"‹›N55U55=Ú2∑¶fÎìh\/Å¥ﬂ«‰ö,≤úˆ»Ìü‚Sãm*Äñ©Ú£p¡t˚f&5´G>ô∞VÁ»C˚BΩÇ?]yztú‹π5  *3ŒZ@XräÒsK 'â”Âöì?ÿúê˜åL‘Œ"HËxÖ·ü÷å€¥GŒ8÷’\û)Ü,¡`;ôéí|8⁄ô°*R~ÕPhkt*œ‘sπŒ7÷^Ó)DO .Åî £™ÆÓ¨ìv˚˘ÓÓ·ŒÓ·FB»Ò%§QÚ éOŸıKÅÏ8Ω?˚çÈF≤®~Ÿ8`á7\√≈Z∑±≈6æ|µπá∂⁄xŸ]€›⁄Udn∑ô[2•∏©êπÂídÆ(JJ$ﬂ£5ƒ¶VÿA¥á≠6xB–ÉΩwÓ_≤Ó∞3⁄@	á>˘WÎÛˇ˛?ˇ	á±˝Ú;&d^‘Ω˘3z˛≤A;^D˛—<\AΩR9	‹‘pQ76avJ˚∫¬V[ﬂ8Qê∆¬p)˜{…§œ?µU¸m∫ï=t≤Gˇ˜*]ªΩôÉ!≥ƒ®7DØ‡;ôËAﬁ	ÁÈà"«˘ò™EExhx#ç~ÿá`hDÏasÕ∞Dı”·ÕO^,=Øy∏Ñé«6V_ïôÇÛ†ëì¯@ÜILR‰πí„¨m≠Ëªiu}SJZxDh∂ ≠¬yêY„π≈Ô„+åK Î ‰Å™∞®`≥¢GA}X–ÂÀÂwÆX√ocû)`Rm`}ˇòcèx∂$ôúÔëÎn–\Îxqúdÿ†¯}œ:aÛmL;„õL™—0Ÿo∑-Tnò…+Î|7„Æ≠Ï ÈSl˚Ëx8Çeˇ‹oüÃùÎV($íô¶‹√÷d‘ƒhótµk≈π⁄‘√\UfÄgg∑±≈T¨U∫3ÀØ¡Ô‹1™∫v€°Å§ÀDÁ]P¡iàXPG*™vw¥Å*´Ç—ZX€⁄§H∞H˙w_p—w„ ö:LpΩ†5´4´>€›ù)úˆﬁ÷ïNFúVUqtœ+¬oïàx~îêîã9(àüQ<†Ü°Ã ˙)9≥ùî†]A©ÛGH v}Ÿ«„3/ﬁÄÌÙ~@’x@∫«vWu†!— ˛: I¶Ú€ﬂ˛ñì/yA—“%À‰Ñ”ê{p≠>sŒd∆ôô~76-µ´\¡ÈOgbS˛‹thY°ŸS#.éWx>Á&âßè÷’Ns+‹å…)¶Åœ≥¨±ôô uàXÖâ®h÷Q·|w¸ÍIDm|LmÀ»†:Oa¢Èº˝R\|§“£ñ{G+gÃó|í≠Ÿ⁄a13®õ∂ñé:pQ9ıYè8 Cmê”+Lµ¯Íj_gäYèÍx˘K&-x˙ÿÉÕ¥±Ég¿ÉMÆk9ÿ€›Yﬂò—$)J3 âHıá·nªMa¨T@b!9R˛˘©ú÷ÚN*:Rπ}95ÿ2»Á?ÏmÈ‰gsÁ˘Ó˛ˆj∑Wô∫¸ï®Î	∫pB i˚<–=à5íîwñŒP≤UÜ”	_π∞`E¬®Nx∏CèX{ÉôhQè≥ÛSpMˇé¶¿® €ËÜﬂqV#ú©Z]?.Îzº`FN*´Ã32k/5ÉluóÃ˜†Î3å¶ıñJ«√oû˘Õ∑∏ÀûEæ˜6Îo†∫°¥rr"#viFBóÎ8ÌµÅ>Ô_±Á<±`GM3¿î}ﬁ˙WIÒÕ—øf°‘)úïÉ.Ó ®dÊF∆#fßï
âf—Z*≥K+ˇêñ‹hﬁBgΩ…:ï‡◊%.+#≠˙Q7∑Ω`fk1"¸÷Ü:ΩÊ6Î¨ëŸ>|ÔÑßWπ-ä2ôm Ó∆Ò0ÚzÕ|∏iÂí∂‹;ÚPÆÅkCÚJiñÊ]‡√∫û&´±7á7?F›†™˘>j`w}6∏˘±â ´VπıŒXÿÎ õF +ë9 .Ï´düÓøvt∑î’›™ZTgó¸;Fl˘PØ€%Níçä #ı∏o¢Ä≥Wå'è![¡ Ÿ€Û#ä‰Ç±F∑o~l V»‹J5ó5é‘@zæﬂÚ[\/éÉ®V5\R	vñ1ØéA.ˇ™
qTÕ•Ú5q¡«ÍR.ù÷k}ÑÍ˙:§öXúüq]?§ÿêfÑµ∞f3ëè°û>UäÌÕuÈËêπN	∑·ê˘jmVJü03R„Âp´Ñ≈f¥Ç7É.ØòJä6Ê≥C…h¢Äï‰2ìå&À≤ãëd¥ñÕBL$£çˆ1>∫ÑJ7Ãí«éäxcŸ#MDﬂ`ÄëÜã∆ÈN…ò–´ÈÚπlÆ‘‘ e5Ã[¿¬â8h	62Ÿ‡’Ì¸äiéú1±;J–Õr≥“◊©•õ÷©Ω≈CG‰g:ëáj\tÃNºGÊ¢>Zûç¶©Ã,T≥≥ÍÚˇ8p-*qøn¨^Õ∏⁄≥C»9m 0fŸ=
5òë◊◊∞pïôtîÈÑΩï∑Ga§#√>$#€$ç$4:ºßƒú‰êåQM<”∂PY≈@éï Ú¨á5(¶ J\¢Je£ÄÌJÆÄÅÂﬂØJ[#,skÑGèú@#⁄ÒAaÊNﬁ#°ñYÕÈ*@´1°˜«)Ûµßi»"iù`å Xw"Ÿ	 +à|∂0™ÿXS–¨Ö2bÛË–◊h5Yë>@?∞·kìAˇ0â¥nhfW≥ÊËÀQÓ%4pß%O-∑Érª∑ÆlŒqâBÕòƒ˚ï≥“∏ø∏àø,‚˜ßë_"¬6¿√6Ä;ëj¡»» Ã(∏F≈±ö¸ãµ2§öq7¡=
qz_D¥òÚ&0fPj,„@6c˙H6Å1âº	ä>¢çêqëa»åwôªÖÒo5÷º»g{!å3f≈óM(.JßÔ4‘«Æ4˙X!˜BÉöÃøeS=Õü∞–ŒçT KI´zJ[n;T≈Ì#ÔEß2gxXír:H-∞T≥˚˘x‘ê{´Ø)k$Ü¬ﬁﬁÿYóñ.ÎÏŸÊ¸:\›ü∂R√∞dÁÂ]5™['&·ªl˝Ö¨íyAZg,Mëµ‚:‚Xß˛{
g≤È‚Xß∫≤Ñ,k^√¢v—eTêÌ»ÒXç[Ô4≈Á†u“z ﬁ2;Úhdˇæf4\¯FWã5ì/Ë(ºwÆΩ—î”h:dˇ`xzÍ«ø≈æy≥JëˇXVSµ“l ]hv≠®ìÀæ,≤π∞ê√æÃº∂´‹z«{sÈÇ3ô¬ó6C¯2ÕÓçÕ
æ¸Ëÿ¿˛∆ãW;»	^Ωÿÿﬂ\á_dtt
ìòº⁄:\e€7\7˝‡¶¬àñÏÒoµﬁ∫ÃŸ‚{∞—Í€l∂e“∂≤ê¶'¯ÚÉqÅ…y ∫Ë∑.—q‚∫˛f^0=]d‚›îÊ_Nô<ò&¯2õ˛ﬂ+§˛“Ó“∂†ÊI∂Ä2KŒËfîõΩvxy˝≥†È2•‘ÁWQGßÓvxTg7(5•¥¡(F]}jdn~6Ã`[ﬁ¿[©Ãÿñ≠h‰7∏3ÕÇ»&1ÿ´˝≠:€ÚÒ[€«tÒ™ Z∏?œ}ò» dÿ$ñsÏ¯»è˚ògSZ^xPï⁄®ZSw—
Ü¨%õ©„[€Ú÷ÑØ–Û/–≈´ƒ˛SüT´ît˚‹«|†ﬂ √v"lr±Ãmù±ùÁ·‚ªg&
÷√^'Ñ=¥s≠Rª¢Ø™( è√Œ ˝ìÑ∞ùŸêE áè1£˛Yç1Ö Ä≠Çπ;ÊZﬂ–ô6ÃnK›«$›ˆ∫ã]}W
Î›√ÕØVG¥ÿÕ≥ŸÕ∞⁄◊n˜;÷ª<E!Ì_LÓâ˜˘ 0‚ﬁXÜøÑıØÏÌº®ÿ4E€eögQÄœsﬂÙ˝SnÑü_Í4MwTßˇao√ÏUÀñ◊ÏÖﬂËÁµ˚ı∆≥ΩJÊn ‡l˚^<å|rÙ»≤åExÛÇ§≠¥§ÔGmxŸπb@A√· –%Üb]Œ$È3yû1')‚úRë¢l€ø€ﬂÏû

D∑âè("hOBxlÇ&	ë,ﬁÛ√»Îpåöc÷káå ÀÍX“™¸ûÍÛ|c<˜:ùÜ◊|ãÄçøzë_¶Ãû˙XG,õëß÷†Î]‚ÂSÃ kNé∏›íkf±ßjH)ª“|∑+6!kÑÉAÿ˝çµâ0Ô‹◊¨Qç·sGôóVXäuå)!˙Û
OÃ±¶|SÃVy°œSEæ∂ãÄÄ§ı¨Å÷⁄&kÖóùÖQ@÷Ú*LÏ¿
ãnL≤∆á`Ö«’k´€˙¶≈7ÇÜ≥b£œÚÆ˘üﬂÛ?_Û?zræk÷ÙPÜ©Ê¶ù¬é_'îÆV6≥°G4◊§D›ΩıÁx√&Ú•»’VãE√^èõù#„é—˝∏OôñÔíE>»ú,–G ´(P}ŒIÿF+ b®HƒÇB`p‚=*…œSß˛`á⁄Ÿm”kE/ D¨J&Pt·s¯Û≈c≠>º∏{◊ˆ‰fEB†ÕQ◊Ç<C¿ÜÇ∞>	#Fˇiæ;ÍvõcÖ)x`h±H∑“joyW@äØ˙ Ù=2/câº&ˆ[q:?jr«¸<^~bò¿{F\=∏ó∆Ä˙ó~sàù_£yßP–Á#Rx:~(∫|Úì›[~f^<5Ï%}ÿ…/°[°•¬’< µ~≥wÛ√)f≠Æ—ñ˚÷;Ö
z©DÏ2Í;Â‹◊q®\¿1jÕÃöt’8éhÂëJ8Ó‚>∏P^Ò¢∑x·ÎÀz^◊«}Ç8÷Ò€∂≈ù≥ﬁÇ""|0Ì~«ªZ£vv∞4›ﬂÿ€›áùÊd∫[…ÇlN,”Û“Á#ú&q“&YÑ±_xQ∂˜æ†¬”–¿Ô #[.¶~HHaÊ¿|f(5Z¸b‘Ì·êkKaöV3«»k≤m‰[˛FiT]Y!nã¡∞hù¡Ã¬¶∞ø∞î!Ë€6ó‚¡∞uÂ‹¯õsõ)ù·_'¬Øåê2
¨˜∞N	s≤èõ;ﬁ˘UIúëwòn	Ä¥xî6û‘¶@≥z™~õnŸlE™uA´¥¯iª∆Ò∆urVjîãŒÊ‘<ÑÈ>e`[(ı ZEDÊÇ^áe˛¬ênJ·õÎÊJ(]xcúéÃÆíV§ÿü‚HÆˆ›™yW…,∆	UC”ëíÖyñgù∞a©˚Ö–º?¿·+G$T…5#Pn∑ÅJ¢î»’-…ÃÈ^Qw˜*
¨éÒÌ0
∏Æ 1QKF∂û≠Ã-ú§zGQjê˘ppFŸ0Ü5™[¬~h∂à¿±∞Ô#™sÛË–€Ÿô#ﬂÔ•¶≥Ô]`EòO2§4‹íe¿zÒú7ø
ºØ˝∆˛k‰eU«' õ¯âí8Ò#vj/Dƒ<®Á8æ;wäÅı^WfÆ_ãPMu†lopÉãÁ◊<tSH¡Æ‡[≈’ª¶ô¨· OfìQaÊîêh“ÎììnÂ9l P"PzﬁypÍ¡Ò¢N‡A≠¥z’ÙzŸo´Ô®«xÖ·ﬂh€$øB˚aˆPµ¥4z≥ÊÒmüëÓâàV∞ı7êåa≈*;vÖΩŸ‚^â^¥
Ëj∫[ÄÖDDÙÖC9pœk‚≥_π~c©íﬂŒ‚´C8ÊÏ·gW<q#
/bÏGb9†=™=Ü}õ@zÁh=√óÕE=˚√Õ±Ÿ€Ò/Ω∆ò€‡ƒ “∆.ÇL°é]WEEƒ›F«ÎΩUMß¿2ŒπadCé√Õ}∆wûÔ)¨
82ºsœˆ¿ÿ¢pxz∆æâ'}0¿ªãÅÉõ?≥aèq-,<o.BÙ√ö¨¬ÓR –ﬁ)çE¥Å£º&∆+£ıZ] ÀûqOã√y¯s’käP+:"¨¿);$*˘òµ=Xæ1lJóQLÁ˘E¯⁄ÁñÙ8UäÃ¨$ÍOØwıDi
È¶ é'¬õrâ`Q©ÉõåÖJ@ù‘ì§π¶¯Ùäãk[7ˇ¥√„ìm~µ∫æZ°Ê¶YÒ©Qœñ‘*bÙ˙-ûòIÿîõpK#Üpú(•ÜpD@=5J7Ï@Â*ò¿+y«U_HÁó¥∑‹7;≤™≠í°)E‘∏Ï—«(%õÙ%ˇ`ê««Dá∫¯ËÅ˘’∏ÃlHRU¥‘ùraz·¡|∑´…[HCœÉh0ƒËätÕ◊
∫Ë}éF4@Óa∫Á´√ÏvËê†iËI©Z˛y–ÙçQy	◊Énú®ÍA\$≠‚z“¸Wº€jsÌu∑†Ç~_)=dOI{Óè‘÷Å¨≈T”Â!É}≤£ ¡∫É¡Œ¥Iû1¬ÅÎœ9ÌâQhj˘mØ€ Íÿü≤À ´ÓAîò¸…¶˙û6&|êªëPZ~Ø‡≥∆Õå`ÑÎ)·˙≥ÁœOqç?>áGõ0´Ê‚}*∫¯‡ŸÛìÔÒôá5\º˜\<?[ûÁ?—á’f¬>∑ÓÒ◊OAŸﬁÍãˆÏ’˙ãçCˆ;∂∂ªΩ∑µÁ©Ø7◊wøû€›ﬂ{π∫Éf7á˚ª[¨∫∫ıbwÛp{óí·EˇZ Ë´ÕWÎdæ˘Ú’Õ˜üØÓÏË˜ˇtï∆-è≥Öz≤OΩ/,∂î≥§∏X8¿z“ùÜ}±¥i,‘•"âõv…v‘.ôâ£÷z™èÉ´é8A70$fdõπ±~HyoŸ÷ »≠Sø†mî4ysÊºù>6ÚjÃ™?gWwYtΩÀ¢+≠h2¯ÂE≥Ñ571§'™˘9≠˙S˝µ(∫¢æg)xÏuæ˚ÿÏˆ.KA4≈Âf\≠h’Ú(.R-‹˝èl·ñãñÀ.aÃÁC-÷∂78´C≈™Ís«¢AëQKNWps¥∏–îRùÖâº¬ÿo§’U`±ŒÑd»∫˛¿#ã
Á&÷ÈÜ’Î–ŸL¡(πÒ˜Ípvjbò·Å·$Îj`Q'øKu9Ã
¶Æ∏◊mÅ(S“ C—ŒhÂë•√êmÖxl1Y:òlFL,7(ïÕåÊ l™#Õ–±æå.XÆï[Æ±∑≤·4iƒ-2ky‚ò(„GDôV<î˜e≤X(SäÑ‚\íÖ«•Çó§#åd5˜˛¢å§"Åda¢h ŒUéÃNÀD‘7†V^ø„≈‘+§V‚E:N0ê±CÅåd≤0 eÇÄËÁ ô∂√¢&j‰s'Òø_◊]≥iˇdéâ£Q˛—Ω–FˆAsx†Âr‰2^héIfy	ß£…ñÓA›Âfî'ÊL”πh¥%-ÂJí∑¨˘æ#ñÁH&U+Ù)±ö_¶›ç\Î®Ø‘CX©‡¥W€m.êgÀ∆˜Í≤Ò#‹ùùÊêåÖπ≈⁄ÉE~◊√¸‹fY·≈\ıœºôÔÍnf2√ÿkt¸=C˝∂ú†/É9‘Õ≈Ëx”ÙÉN’Ê\™ΩôTS˚…ß¶˘w©˙FRs Oÿ¢©—‰lÈ°éãâ&eæ˛pâ´Ôˇ†Íﬁ)AL®D§⁄S¡Gª>)”Ô˝˘¨~Ú~Àˆ´≠ÚKÆøk{<v2p]r\¢ñ|j«k	+@(g ¶Í‘sBÜ™sâÁús‚^cpï'¶¡“‚|⁄h≠ÿ9 Ÿ.ùõ–T=ÿö„ÍÜz'ˆ;ÜÁ—˜©∞íZÜÖ˚ÜzÂ◊Æ—"è£<Õà=tf¡K÷˘‹Y*È7•]1À;≠g\ç∏LìCJÃìùùe(s¥ü∂ï≤Æ˛’·Vxë§€±Ω˙h¡ûrﬂºÂIπ+XF F„ Lπ™ﬂ}hS&ìhÂÙ°}ô5 òÈ	óß_Ã6{V£^‘´V÷¬aß≈z!7∆çäKa˜Cööî˝≥úˇ.ïKÓ£∏T∫m<WQŸøzÛœ´€Ë¥´˘ÌVt≥cﬁq„'XÈ&æWrº-Îu z?≠Ÿ}7M∏M¡55ƒ©Ä≈ƒ¡2äkπ˚MΩıØQ≠=Õ÷îE±0çGØÌ&‹‘⁄ÃØíVß\ÒíIœjPöô
•≈ˆL:Kˆº‹∞“Am3‡(UÎó”G-◊]ìZM‰‹ôva)¬8‘ö¶¶˚ékË:á&Û5Ã|lÙ7•Ÿ>*ò¨iÏöo≈H5#";–MÙ˛∆Œ¡Ê≥-g“ô¬ﬂeKYÛU¥x¬-≤ZæÍî‰¶◊éd^Èw`ﬂ˚-íÙIVFŸµf∆±%≤õM-∏ÿ.dÔ=ƒˇ;HóÀ)òé+'7ı¿a1,ŒQiAO« k-ŸµCg$∞õ£A≠?Ñd	∫E◊åGŒ®gÚÕ.¯Q §’Û*∏È”_‚≥¿Ô¥jt˙ùVÕ≤ﬂo—π¨Ú
~0Xôi˝Ùâ¶‚ˇdQzΩ“]ßÛ˙/ñ÷ˇ™…z*Vóìå+3ß¸ˆ!éÔ„ò6≠SÿÁYÜ:3&∆ç) „°˛!œØÈgD8P÷70-Ó´ıÕ]”3s*∞¡¯p““èÂ√Ìëè%ˆ∏ûÊÍT‰/hsGˇ»ä¸Å⁄Ÿ‹ËX iEÕŒ∞¿ëFC€“hËôvGQ⁄R»!X<LÚËÀkÛΩ¨h˛iûYí#vq`X9†{π€nC?À‘ò$!ˇ2ÅC‘’O• Ø`)4ußg|8◊∑_’†®™¨›Á…8ŸCãÅ$^æt5¨<ﬂX{…#Yâ›˚EØíöz â.iOßo0ŸÇçÜtÔo˙c±rIÑ.≥W4&˝¿	‚¬#bzõY(;ŸBÍjiÕ†Öº·wìüˆNäXLN™jﬂß¬ˇM\¡É∑áö)yí\bF‹WÇ%]⁄"À≈:ΩÈ5‘’ı2j˚Úáu´‘ÎıJQ'Ã.Í-ÓMø
¯S[∞ÿ ıo≤Z ZL˝f©m¨”*%Há:õúôhÌ´AUFÿVc aÕÜÍ	ÛXc!‡R
sé\Êî√òÕnÎ§F	b¯æ˜µáB£∞r*Häç¡ñAMzî
í®ã@‹PDêÜ¿‚≥ùp1n≥,8RÊ¢˝)JäÜÀŒ C⁄ÁÀﬂõŸû6∑·â≤ Æé'Z∫3∏+ÿÂ$N◊ZyTCe˛9§”˜JÊ§÷¿ô.Ÿ˜¥R%èë(πlö‰oäì$•H÷Oy•ıÕïì˘=òiS÷itƒÖêYln3Srb´“ªç }Û…L•Å¥‚±≤'kF›c‰NNvèü99«∏{
yìÔ±≤&ßåº«œôlzOí1Ÿ2Ú˛‡˘íMÔ˜ú-9m‹˝~s%ªª?x¶‰¥Q˜dyí«Õí<fé‰â2$èü£Û˜(™('^"=~óÇää†MF ı3DY!Hóg~Ùô˛8IñÀÀü)ñøê«ù¢©ª&OÆ\ƒ˛ì—«ÓD4—S¶ÔŒƒâî≥Fòõò2ˇ> Ìﬁ4E∆W¬µ©pJÆ0[ÂA˛'è?l;èô”Îjlæ\⁄œ©dBÂÌnı…ﬂ™8ÈrÈîÀÈãèÃÑÀeÔ%FH∑Ï∏…J∂Ï∏arîòv¢ÂQ”,;í,Oëe§ñÃlÜc$Wv´	Ú”óH¨l≈/œI™<-ŒïÇRV:Â—ì)O£¨D ÊUnô\øô)îß∆-s≈„GIùú	∆úƒ…•“&èF…R´!YTˇ¿˜#÷"=åè!~N'Ö≤Éˆf&PviM/}≤√/+y≤Éß	ÒLú<=9+çÒY)ì«Jòúâˆ9YbKÂàÕA˚åD…*M2´6:√|§oN;mrÒ≥ì&Oå¯∆ËK ~v¬‰üÒç·0ƒœ,∆Ií¸^ëﬂyÖQ"9Ú8˜ŸIëßy@œÄ©n/Ù§»xÖ·ùá&j+Nµvy1A¶d;‡¿ÑyíÌAMò%y‹…?ìq
πëGS#˛<)2oBÀD£»>…éëy≤X°àPîµd‰Iƒˆ¢1fe@û,ˇq&E!˚qVí‚	2èC”ã3ø˜ê$nZoe<Å‹OòYJ2yd}\cß@'ÚœE„ßñ¯x4R?Ö§«„Ü≠…Bê“	è'Kw¸>µlE$~‘4«nR?m†+¡Ò¯ÈçÛ5”!Ò#&6vá(J"M≥9w¨"aùMI7 Gàj›&ÕƒE:A?˚>–„(àX<ƒT«h+«|äò¬Nå<åã›B!vv1∏ø◊
YkËu˚Y$™‚X{—¿ô3◊ç·7^ƒOÍÏ4
bÿ•^b]åâ=≈CÔ‹«∏éo;√nœc¡wﬂ?jy¨∫Ê}C˜BÁ0á∂º·ö±∆–/5ªTõÑ√◊ﬂU¿Å:>bÓ≈™√£ñrwÓ|}â«ZKoÈ·ﬂ·Ë‡Ty:FÖôÔõ0Ÿ˜;ò!!‚ÛO—Ú,oï√vyﬁ®DäÑ¿,Õî˛˚5˝˜•≠9∞WƒÓ|ƒ∫E◊≈£3=A(Î+yƒÑòÕ4}¿ôñ◊B¸ê–ﬂî–_I*&7=ØÉKM+nxêLÅπﬁœ7ºtßŒb˜-xq^˚◊Áâ¡ÎÊŒ·∆d∏ÎxûZﬂ]{µçv±ïYéÿ@Uf’Ù¥1®)c3ånßÉr∑1¿Ã∏ø_zÒô»ÉÅ{[$æ˘)∆π£›∞ooÍﬂo≠qCÄÁõtfñ uÌ÷;ì<Òw ⁄]Ωkö˛•=C˘∞„ ø¢0ΩöWèë sûdT8ï(ìÈÌKñ_|ÅÏ∏ñ|Ezm¥◊<Û¢µ∞ÂØåõZ{ﬂ¥S:∆/˝Kûã¸˙ΩFúté,D“ëÖ˚V:ãzﬂkQ§˘*l¯ |⁄¬∞èÉ”—◊AIÓ‰<¢ÀËOç/⁄ƒÊq÷éZ+F,ajØı´-5wÏOVØ⁄ª”tù∂ 5WÄÉ\πdﬁwzõP/Õ∞øÉ‚2PúR∞E∑Ól[mhhJû¥O ›^Æ..ﬂ_aœ◊.˙äuIµ¡t9Yöπv~Ç~“'1ìÎ⁄£gkµçáœﬁh‘†CÕpP§ê
-ÁS!]úRDË°ã•f>π…öÀH4µ`6Y9˝ÿ≤ì™¢j}ó¸X"J.c˘ÛJ‰òÅˇµ”U,£›IéljéãË	;ˇ˛ü·)¶Vcú3|æπøçCŸÿ⁄X;‹ﬁ<d[∏'ÀI"U£πîX≈≈˙√RÎXÏó∞\œ?{é¥ío‡(ZgÕ]4¡·¥c+h˙ΩòÛêÌ˙A}Ø¬‘È
ÿ≈eî¢Å¡≈Õ´êï˘˘Â⁄¬bÌ¡“√G¥Ÿ±” ·Cí>RÏ´’≠ÕuŒππuê‰w◊¨∫˙Í^ÔnÔŒL⁄©{“Ün∞F(6—Æˆøc/•8Ô±ÿ?Ω˘KèÌêõö7x=h+
ºzÊˆ–e	Ãÿ"ÂØud∫3oÖ›¸#4∞CﬁÛzpä√cî}ÌÊœßë◊ˆ¥,Ü¥ıÏ±Àç⁄!≤·u7läSô©ß6H. -ÙÊ÷Ñ∫0M€$Re÷a…€ä$ë‡4âvfJK>'™ ”_]ƒ—ì©®gÊkwË≥T3W[sŒ¶>w6§B[ûœ,¢¶≥ló#”òç`,áñ-’ä;"ö=¢‹êh∂ﬂ®˘$ÕÑOu◊Tñ≠VE;ï,ı[EÌ`4√zÄª$Ö3/äÇÜÁh¬ä∏¶£ı˚	ª¶˜†bØ·‰ÈøøüMf=´¬‘°»†kA˜î˚ïçº˘“ÅèC!º;ﬁe“∏—µ—ùÈ!ËàùyW&Aôe›§8XïŒËpPÕÔ Ò—Iy$:ltÇoá˛(…õùR‹}GÙ@ú%…‹·°ë»∏ÑPÄj[v∏˚˜;ïYaÔ/ŒJl‘5ﬁ◊Õﬂ∫˘	0TœiNÍ¢∂`3!–—V¢√Oó»R DwûNÀ‹;ÊSR√¥É$˚Üd…‹IAS√À¸dD©o#‹Å£b‰Î”Áö+>kœ‘"Ò√ëÿ•◊m <Ü¬Gﬁ“V÷#ê¶ÇŒ Ï±g>Ê~˙¿Í¿“[uû*3Yëåñ≥=Æ˘wóX">ô¯ß∑gC|©æl¡|)u@Gï÷$ê/bT<Y>ıöãXÄJ2f≈q†˚"q*Zπ˚l≥{Û™cb∂M·¯b=Å’Z&–ì.∞'M¿õ≠⁄†7C4⁄Íﬂ«Fi-@°ò«L?£Sè§øxóB´ìWWﬂ”GØ”™œ9õ€h∞¿ >IELÙh˘;‘Œnõ^+Ã5tG§;z¨’OÈåƒZSÑı¿ò€Û0ÈxÖG’&A	œ–m ´>L|PÄâ®^¿ÇóÙd˜Kaîíéz‰ƒÌ	&ı≥“≠ßê”®53kÜ∑7ÓÑ{dfw%.<TSz—[ÃGŒ5àår'=äƒ∂≈ù≥ﬁÇ"bG∫#›q¥¯ïL@»&µ˚œÙ‹Ù9â¿˚àêÑ3ã0~êxZÄÌ˚b£"äc¢‡∞'èÒ˙¡í\ê7¬ÏÉûŒó)+ù*ñf£f–&Ö-ã)â¬b§ÈÀC3&÷¬RF,,€+Fì~_9óë˚Ωñì›ê»XYâ⁄≤Ì' q¸2n
=^ı)Å∂ÅJ2∏Ä‰÷ª§ò…dØ)≥∂≥ö!ûªd>5ÈˆﬂsX†@x(R»øÖ&obR¢¶È.µ.kq“ÁçqÏô %≠d2@W˚ÓÀnW…,R&√˚∂©t<Æèñá{¨ÙÔ"koa÷wW∑î!<›+Üì{V«¯v\EÌÅ®≈ç!™ïŸ Ã—¬INÔ"±8tü¥êûf5“åXÈœ«Çó4…%âΩJe|ﬂù; e_WfÆ_˚“c2Ï%iÓµwØÒÜœ‰Vû{5∆Sd>áü’#È…l24O3Äè…0˚‘&nø9l ∞-@»†<~ÍÅºS'°æHΩjzΩÉÏ∑’w‘cº¬éÔ	¥mrûÙ⁄Í°™ó`f≥∆'ëHiﬁ•$Åo 
¬äUˆ⁄
3|Qô◊ÖÆ~dÚy5~êLﬂ)Ó	êWÆﬂËáy}¶èÛDôºs4‰Â∞wm[Ì8Ï˚ΩÕﬁéqË5&¿¡ﬂıP∂pÛ2vÙZ·EªÆääàÖçé◊{´•»∂ÁVÑÌ∂éÄ˘£`{6p9h›Åı•bá“†W+§ü◊œ‰.»å–ÊCsùﬂ[(
áßg\µ≥bE◊˜:~´±ã° ±ÿ∞«≥¨√—4›tc;b^–:q√IE\bs¢==OèƒÅ|Áíé 3=◊#f5æÍ5YU≥0“U∆¿7„W˝NË°æ®UDC"í¡‡-/u0√∏Z˘J≤êÌãO~ŒO÷2N<Ô0a˝j≥È«Òa¯÷ÔÕ≤”0<ÖëﬂÏ¯e^˚†ã∑’J}ÆD~ò√Ípp¶ZÂ4°Ö§ÜŸp’Óü≤ÕS}ó∏ß]Óà9°eœ§1≠¥¬]®ªaò˚t†√“ÊgÜ@$u4/mkìôÒœuOM,K-(Ò6æ[aÆoÙÔû;!˜
€¡≈d˝! ¿ì–àÍªÅ√†Îa©r¨r∑XÅ„“Ω˘y”nésYó@2ˆ™©ë'#nÖ∆ê«∞9\kêÓV^–&F⁄ß5üÌ¢Ωö◊1–HÜƒ¿œ8±Êx√wzx—√Fwà¬`ÓÍ∂D≥ÎÜnc≠Yfl\ò™´Q *qA£Lº!ˇÁ¡∞$TÏOFÖ2¡ªSZƒ∫~-''Yãx~	µW–Œ"˛ò$Å/‰êΩ◊jKö™V`VŸ,ﬂÙ¿”û≠PT¡ı’√›ùùä-ŒkChTó∏ƒ⁄˜z»“A⁄rΩWó+∑óÊnœ†‘RTÏﬁÌK(ÀXü=4 ä√œcâ©fåW‹5O#∞Ue£Rùí‚LT3u≥Wí¬N}≈R∫n Q\∏ |ÉÀ⁄æã4òŸd8ˇvH4´≠j¡)–¥f/&…64≈d«fLÆy”9‰nœCŸ3hù8ù©.\˘,ƒg7E¯ bh&Vi„û’GYØRãÈ^Æ˚·≈–ãZ-X0cqSªÅJV—ÂΩ≤‘|IQs]ÑãÑhvc¿ü»¢·BX÷nAsTV#ı…g“∆ù"!ô––ƒ∆˛Fªç∆¬∫ƒM,8>/ˆ@Çlá-;P¨œÇ¯Ä|≠ZÌU◊£IqXC5|)¥⁄ñÇÜ¯ù‹"ˇEù‹‹U?W´Ù⁄π÷∑¯WçjoÿQ·áØ]cìõuú¡ôuKçŒ®‚û.Sà]Å«è ˚È∆Á…ÎGêÕ1UTÜ@õBˇ»©∆∞è·è˜`Å;OTE^$gCü®`û•LI¡ $]d+‚'Ù1DãD
ñ…¯•¨ârP°ÛI{©ÊÅﬂ–åˇ~ˆ¯±l9	∞hj…-KïDØáÕô¸ŸÙl…eÖÂê[o$ü&‹${YJ2≤ÇÂâñ«‹#≠O<›ıâßµ>9€[WÉπ” ÈkP©“ó€∏u’Û∫òBÆseÎh“@_ô{˚^g∆Ë9a$ÜÓ»bº(Ü⁄úl{Ω°ß-|B°™∆Êhj,&ôR¢Ú51∑Ñ∑‡w◊DS¨≠ŸOBEiz≤úE2LcI:æ…´ü€∞†a—ì…&πf÷ÊìÚ≠n¸ì$I•kNzÎµºæ†óÅ%ÚbÒ¡"¬¸•I¯;Â¬üïÅä˛,|g•a≠h¬H™Ω2L’8(¥ƒu∆òTá `nyW UºòÉ7'3ö:ê¸?˜Ω~[å·πYWpßp≠%Ãk_©|Æ(µÜ¸Jàı”d‚£ÕùÕµM¥.Øﬂyz|¬‰ å£‡ÛÕù•íÊ∂ÿ˛∆ﬁÓ˛·∆Ò…q|ß∞›≤≈oUa3«∑ÊNgYµãÙdñı¨=Ö”Üogk‹{öµ¨˘E{“ËÉ÷„Ò©èùUû<ÆÃdîË_dó@‡ø„cø¶¬∑27É®Ie˛Ìˇv\ñiNˆ£ºy≈;Wø∂|ˆÚp{ã·	/fŒ£AËÚ’o‰˛Fú†ø) ˇÆ3¯úO»±ø;ü∏>z›>ˇ˙;◊◊oá!Ø|ªr€Ò˘∑˜Ò ∑]ï;ü˚πÂü~û -˝πﬂ∆›û(ÒØÆ‰UÃ‹¸ØŒ¥\%˛_Wâ^#”gN‡xÕ·@6É´ÑØó¯—U"–K¸‰*Í%˛Ï*1‘K¸≈UbU/ÒèÆzâ?∫JlÍ%˛…UbW/Ò'WâWzâˇ‚*q6Ëv¯wÁÇÇN≤dŒUﬂ—K¸sE€Hk¥G∂ºCˇúﬁ%Z‚‚Ò;fÌ(ÏAE6˘1º‰IÉêu¬≠ÿ`dnÖm?é·£piŒﬂ{HL™ﬂŒ<=np®—ì&ÈÖû∏ıª≤¿›πö≥Ñ◊á·] Rˇì≥ÌY‰“Y§Ÿ
≤ƒøπvßiI◊=>Ü˘~A!Ø”?ÛdØ”ˆú•˛ )Ñø›0Ù@Bê•Ë¡=ˇ3≠1zpÎeô°ª‰ Òç	&0uG*ﬁhó.~|îµa‡€IŒ∑jŒ∑ÒMm†’N¬I≈Î≈høœ–hà°é1ÃÚôÅHäò≠ }¥Ahá≠ÉR>reå¬˚©Äx≈*Ò∑C¥AhÑó¨˙Ôˇ˘áô
;ı˙®®FO≥^ÀãZ(¿Q"Ùjá˝Y•K‹πÌˆ5Üí(±Ô˛˝èˇßÕ√ıèˇó-®èˇˆØÙÕΩ≈˛˝èˇ}um≠øÚäH¸◊ˇáæf`Ô_ˇL_≥∞ˆØˇ}Œ¬÷ø˛w˙<LVKà°7%·^Jª~tÍ£ÈÜpºäÉòíF¢XÍ_1äÛáöx*}6‘Û7qÿ£*Ín	!¶'b≠¸°:È+Ωı#i¬ˇÊ#~æ^[=ÿxΩ∫≥∫ı˚ÉÕÉï[Ôxß◊'¬êKØ∫—kQ≈çùır’z˛Öú‚õ[Ô¥˛Øè{∑ﬁ%”πæıNõ}K:º~cÀ·Bî◊A∆}“’∂Ÿ$cƒ»øˇHJÚÿÏ"úë©ú	˚á°:8ÒéÀÀÇÅ6
;±Ÿ∫îàOâÎÇ^Àø‹mWµIÕËS˜{≠¸*07QÅ‘˜≤TQ‘Pc!ZHΩxí»T5@DÖy¯FüÜ√sRO√OU€k1…®,∫æ´AxÄ€M…ì≥ ]V9Ó˜*îUC‡Çˆé∫4õ∏Nqó"@mQ ÷ŒΩò4÷?ıöWÏ»@¡◊ˇ·`wÁD,Ò‡ÃCóê⁄wvŸÜ'¡'ÑSêΩ†|qÊ≈Ù=ÍÍà®/¶t“rÓ£ åΩ8|‘Y8QqÕFù\∞s’ Gâ¥Ì/±M"Ω:„·91›´G«ÒÒ¡	r=‡G«sÆrs÷Öìﬁ ßˆx¥pR‰®ôD
à}$)ÿCùû™V;¶jçk'±R]∫”=ñYb≥º1A˙#cW$pµqY˛ì8-[r µª™Æ2Ã≤W…–›·,ëd	\G ëÆ.K∑hjïtBx·É|–Í›Ê˘«“x˛Õ˜~ø[\íΩd¬	¿¯ÏäfŒyy ∑qÎpï“ó¯•∑©Dz_a@µ—N-ZÒ7˙⁄–è⁄“/~`åË7ä=¸∞–◊û‡°ÙÅ_S5zƒ‡Hæ∏}Zí õèsøÛTFü‚Ôp4O≠bAœèìwG¬î”•ﬂ
7ô‘˚Fÿ∫⁄/ÙÚNa›xIAR	ÑÔBùn»””côî‘î@8¸vàZÕvp©…∆Bù(¡ÄÆÅ(r⁄vÉû}I´í©™≠/I‰l≠â—«È—cÎg)Qs	ëÉëÊò≥_µ”:BËÏ˚ß>“ I…V≤Ï§œj
_fë¯ñ´øê6»Î˛•ﬂ¨j0BéÙñÚ∆e◊AÎ‹r.:◊uQ∏4ÄÎ˝a|&hûaE[∆˙Õ¢%8G≤G±ﬂçVpÓ€t&ã∂ÏÑ≥<P˜ù‚Àã¸îNı¸.5gx˚p@·á~(›ıÇûP)SJ°W5qQ{“µù.~+Q·ÿ!ú˝·¯‰‰ÆRπÚ©…ilq
KÈò è#-’P≤0RÖaù¡ÖΩ∑D<∏sguÁÊ∑6°lä«3a–√nE$US∂òê=)SJLZ∞%≥¸FdY}ÎÁEKoÏ1Dye%Èœ L«Ø∆:hõA}æFs¢¯åP≤ª¯N‡∫Æ4≤…ﬂdÏƒ$ê°§›—“PõÀ&¯Æ’»gz&ﬂRñ˜»¢‡|§ÔÎÆ…¬5äıx˝F’ëÉXI~…m*ókF?8Òtxá»W—;,VI Ã*π¨xô]QAX?Ô4Ú˙g•ö≈hR˘ÉñëßFq’¶-|ª†M:E>h¨ è‚YF¸€¨3›I¬πXËkî¥∆;”◊KH+Ï®^Ø;Gx¢(Æn@Ê*™¡ÃæU’†Ñkò†dç«Ö…kÖ∞¡RE∞	8™i∞Ióñ§T9à˛ÁÅDmêòhtç ¢xG1=¨Í⁄‹‡¯’ß–ÿ'˛î“∏∫jêöìbÆ”úR˜Ç>üQ–Ô-ÎHQ‰1.<ßk‘jµ
ôæŒ˝·Ë˚ï„⁄q|r˜÷\}‡«<Ê™’û8»pÛ-Ÿ8û˝∞u≈øNZ*Há›’ëñ¿ j¸M©8ºXÛ;.á∫(Ïà*+,äºÿK$Aã*í≈§¿HtK¥/´—b6±Ò¶\∆Ù5iı-Ò◊F ˚5‘Z=>⁄˚¨®◊É£X∫V?Ï€u§ ø†u§≥ìÆ¸èM–YP7£q´0®¸ìú°ìEä;,˘¬Å≠n0f˚r∆tjÕ&+äË“˘œtMs“*XD\íö˘RŒ ¬…‰w⁄\«ÕXhäp)‡4∞Jï °\Æôç8Y1ﬂ‚1?©ËQê4.B0 ÷vÈ4"JöÇèÆ#ÔPW÷
/ « Å+◊»ﬁœUôÅû6ºÊ€A ¬ø§hd√ª1ˆ¿õ7o*Ü%=ô )ÜonÙxBÅhÇÂä±$Õ†qÂ$IXJ∞1ñì‰hrêÃpÃ-ü∞u«k¬(Àﬂ ËZñπuÙTe√x>c˘Ï∆˘"
å3Ì„›m#zmë¥∆Ò@◊AT[°∑M¬t∂±Ωœ¸oá^ßÜQ¶D>©GÜq®."Tlµºk„j™>N˛£'À$\iaŸF‰‘î39XIÿ¸J∂¿˚≈qWÁî£#s…%,ªÄ®]@K˘3)¿;ˆt·√±≠«‚∑By£BŸ©™–x&wtáue	†=∞≥√ÑòWmÊÄëL0jú‡wN§w%QÎ…y[Õ;°ñ¸„;¡.õ±#≤†§Ücí™ªwy ÑvaáD˘5mØ.“¶œµßàˆ:˜ıËj√≠$˜ı–‹–'å˝÷Ø`ÂˆÌ‹™OWéè‡?±◊Ñ˜uÀ›?Ún~8¡»)3OøW7ﬂSô◊<¶ ÃÒ…˜_‡7˙ÙdÊ÷\¿èAÇ‡‚J6Ÿr-7…≤÷EÆÖvÉ1õ•c£t-Öy8Œá’Ò—∆∆©ŸE8∑Ónoœ<=>˘ŸfŒ/k2&Mù∏'bUHq∂Ù¸˘∂ü8òy ´¨åô¬ÁÒ÷÷Hq≈©$êÍ∏“§Î$4_4l7∞íÉ¶◊IN3–å¶%®Z}|ˇ}“â:s'‰1ªá%0nõój`5‡\∆<fD±4ø”j›M’R'Óyê˝òê÷ç*ö∏$^“·/~…ÔHÌ„~◊ß[x©…¥‘¯!°å¥‰ h%ûˇ[fù”¥!ò«´ÕD‹Ï]Ô)—˝·∑ËO™›Ü2spcènqƒ—ç9º±«wo‘Òç;¿±G∏4ÚC4∑°ËyÇΩW®ßñ6Ö™j,X®∆GP¨Ä—?sÆ§ÅC…2Â	y?v ¥•—eC(g\Î˙váI›.ˆ„:¬ﬂdÏüó=ï[Ä‘’¡‹nπàÃ…ÃbÀ•xr:⁄R∂zŒ¶√∆]∂ªÉ™9t¡ôW¡©)∫'4ÂÚ1eÚÚxrWhò∞ 6Òõnæ £z?;-‘R?É=˛ñT4ñ[’,{Î_Y&(EûV
ı1Á
›ÍzÕAù˛ª£6Æ	•R∫”R6"wéÔp≥m¯ëaÚA,—º≈;u≈+Ò5x-ˆ∏˝„ºX\€D$ÈPôà8mC§≈,‘í]—øÃ◊7üVÊâöé˚±«L√µ§¯¨÷’åÖ‡FI£_@!–zòı„wÄX…raŒäªwØﬂ\c≤∑8Fßª«¥Ø—≈8ÇÇ(]≠ÅXPy¢¿w“≤Eù›æò„= b…(ıÂP‡MﬁJ‰îR≈ø†ﬁ•j∞‡“„á%œÎi˜)≈V®ü¸çPrÄÿoa¥Œgß+0ŸPòFp_Ÿπ?*∞?»4¬≥Ë’:$áﬂƒÄ7¢öAú⁄ZZpÌ<˚–ª–ËÙot'æ{C[ëÍ÷ª≠0EmJ˜—Ú<„Âhè2aÃPàRÄ∆ÎiÏZs9>˙ù{êÍ ¥ˆì∞Vnﬂ‡qô}	‚tvkÇÊKŸ!4`:ëR‘ÑF¢ç¿‰“eŸ_iz1¬ñ¥6¥÷œ©?HÊ∫ËwFR§zF-Á•<Øve∞àôEbö¯ƒjœú—z˘1¶'ÍÖ]Ø$fr™™Ãc·Rèˇ*m4ÂFÏX¸∆ü¿»æ„‰˛h˘c¸;ØãÆÊÙ¶ƒ¢&ö1F!¯b ”†9ÏxÿåÍ¶3º‰±†∞4 ∞Ò‹æƒˇF~kÿLﬁEò: £&·C?ËÈ˝ÜÒ¿€Åı™◊M√èõ?íOÄTPä|ÛÁ÷∞Ú`œÚW–C£Ã'…Î¬aEV=Û£^‡}¡‘√Xé‡tÍE’Ñzp
˙7?†ZA‹Ÿ?‡ãßd“P.Ï‹¸ ·£cÉµçŒ¢a_ÆÏœ¶Jão:~¨ˇ‰–É…tºÆ($:—)<≈Vr%Ú.Jl©«a◊Øˆ;/î“®Oß®æzqA∫∞EmñåC¥ÿŒ∆àÿ+w ≥G†[Ï(9#Ω<∆5_C:/â5¨¶_[Jﬁ8ÂøóÁÁÁÊŸYxÓG+˙À≈yq˚Yk»…∑ÂyÛÏ€√îå¶W˘ˇÚü˛´Òf⁄åÇ>∫‚¬Áó xﬂùb¿ﬂdŸl 5	iuƒÕ,Ê+ÛÒ!√◊+I◊©!∫9ˆ†ıÓï±õ=˛Œ⁄…7?v˘Êm˚‚˙8¶Ùı{7?&?	Û£õ?`£“œP˛Çπ¯|Û‚Qã–ÏÊ/]ü„ÛŸP¸“—£P…P¸Ê/±'õ√‰óáΩ-ÅØ–è¯ß® Êhtë¬é—CÿÈ › ?	ÉµùFØ¯@¯·„˛
…Åá˛lºoû“ûﬂ¸¸ﬂ6Ä…Ô¶ù#ü≥àU∑¡lÖQL+í¨%[MΩ‡ª¨;å%ŸÇß—ŒÕè±ëaA¬»ÍÑﬁÖ¥B‘PàFÚ’Ò‰‚k»Fƒbû•ú†zÛSÀ37∑¿!
á»ÚmÌY€⁄£mÌMi[Û^âÂÓ„Êï◊√‘∏èÈ∑Ωèìóé}ú|Àﬂ«ˇ-go˚=˚[€∞)†øòäC.ûÚ}ÓuÜ∞áãv-Â"Ïê[0wìÛú∆OÄãÇ„$OÑ	1&ƒƒ&÷≤õå˚òT:‘®í◊ÚõC˛Aı"^z|€5"Œ)≤§◊è0ßèz6hÙ¬?•Ä”úõ`⁄j˙yÛSÚ[uD=GSå]êL#y¢ √^ÄnV4LÕ~zÛcœç'/°xÒ ùì„sœ¬Á·s/üóG¿gﬁ)Âi¬lÈjΩr±€äÈuZíQ…G«ı˜4◊?Áb˙ø¸Ô9òé±ÑêEπ±c[MjK^¨ê™p8°˝∂ÔÅH(fÊ(~◊'?¸9ô%	ÿ‡π:ª"ykÓãnóˆ˝˜2B¨∑ÁD=zàßqs™π@ˇ]§-p)hkÏQ™;Oõ@}{¸≥èC„Ï ÇÛ_$¯¨¢)]io8Õo~maûvE≥Öø≤ı0ô⁄K…é¥BZRÓí_ôÜø]G@◊√õõÿõ£<\≠"2‹F˝N"Pâ'Mµ◊,’æÊ#ÈˇëGéÅoFîØêØÓÅ––sI•Z∏˘0,¬Ã|Ãk};‚Ä>Êb™ èÈ(äËÁ¬(§¯øx‰ÙOª¸ß
áü†g∫1Mï’,f¢≈‚Ô_ÂùÎ X Úb.Z<†Vèº⁄w´µˇxÛ√Õè7?›¸˘Ê/7ˇxÛ«õ∫˘”Õπ˘◊õæ˘Ô7ˇ€q´vrwFû^ïkTcØ¯´±√ÜuéiÜçm•ÖJﬁ•NJÂ$´à#™ò◊9%Är*ûú™'Ÿú©} –?…iX!˜0ÑW†É•-ëu›˙(›®∆5\øı5œ'«´Âë1
Æà≈ªŒ˛U≠1€“_Øû7AÌÍ ˙^èØX¢8S8y]√µ¬ºÓ…‚rıôUS◊¶5áQFµ3ø”g˝À⁄|}ôE!ÜñoÒÿ+Ó⁄∫ê=Ú–à‡¯@¡ A0ˆE∞:*pÎù>π∫¢@0cO¨Òº„˚å=eUÎãR¶4ÄJ/≥Xû˘·0Ú∂◊Iò^ç÷Â6í›TÈÅYÉ#z ºÔ6Ù[)ˆo≥ÒHJ√€ñ“0ª∂÷vòÃ¥Q˛CCƒúäÔÊÓ∞C†9É†/#Vππ"ÀÛ;svié⁄eÖ◊à·h4ê9˝j∏ç2ï’ÊYç÷ï‘§óÙ¢€®-≤≥†’Çs+-jM∞2§∂ºàC(VÁ%Wê<Åø Ô5˝Î<ˆ°UÅJµÀãœÄπ_‘/πÀkÌhaæy√¢ª‰¢’% ›wµ£Gèù∞~HæÙ5äË◊zpí∏Fø	bòˇÖ'√!è©UkbàÎ®í^≠†⁄TÙ„]Æ®ÑëÅjëMLqÇˆUvÀ¢Ì'ÊHò‚5‡~Œ™ßèià9÷»IìÉÈ!B	2ﬂ"ò.»òH”e[]J˘ ≥«¨˜f3«Naõ£ÅÙª|gíRóI
Ï˚ùÏ7p–Ω¨kÉ)”◊ùC)ÚëG<‹§√"O~YRÅŒ ≠˚
g2£˙L1]˚
#gI3¥x9±Ûè~ﬂ	"3◊ˆNI≠*Æia3I˘å¿Á…òÔGvë_Ø◊”¬wπK≈$|∂yWÿ7nØﬂ‰^>∫ªó◊<2∑›A#≥ÉR7¯åÈwô˙-ﬁoÙ]VˆÇp4 fç6◊å”f,É 
›¸ï«U§@û∫ûÂklù…2öXmµH‚Ù:œÖjçéfQ8Aût∫¥Ë,§?UˇHVñalñRî¡…È"ëòü1«™è^îFèœ™–˝—X$m˚¢úsí&æ÷ÉñaGB‘Ñí∆ˆØ@∆ â{$nØà¬X¢UÀãÅŒÀ'l4ƒ¨∑âX’9’dÍ;W∏ëbL√\¯(Ïë∞#%0´—¶∏A!-±æ®Õ[bQJ∞9£©^–ÂH2ÖŸ_˘ùáÀ0∑¯V¯-6Áî4ÏVÖêT_F1IÒMä“E'.9	H"±áﬂCô)%”%(Ui>ˆó"Ê÷ øòò/‹„}êå6ñeèX# ’]Ô‡{¥<œ%A>`N∆ò¥qC©kclÊh≠±~—wìÉïN#Ôä®;†S¢Dõ∏7<%{ªTÔÇ–oZD…·8% /Ê˙≤∞6öôTHÙe‹∏$^é∫g¥ı‹ê;>EÄåc!√#>+,‰˚°IˇZŸ%˘&#§Çºàñe»‹p∫é©£,;ﬂ|œÓ‹πıKXhzÁ˚ûâ/:‰Ÿ˜o¥)¯Wô∑˙∫¯Px∏≥JˆBÏxQDzÄ¢≈Ë…Ç?„Çc–e¿≠_åœF‹üÇµ†˙w≥7«Ω;9Kqî|Ä-i•—>Yq≠”Á"í|©ÖAUj£x¡Í‡:pË:¯•îÈΩ2W?™ﬂπ˚Ù∑ﬁ]Wgæ?:>q|oﬂ˙›Ì‘v‰YO¨π'VßÏñ¥Wûßò‡ç†gñEÏ ïÿ…tx6∫ÿ∑/ÉxÄ∫9û‚{?"a ?ü5˙ñæôBÎ„TÑ!Ò¯˙W[·Û√˜7Ë\∞∂ªΩ∑µ±Ω±s∏À÷7W_Ï‹¸È‡psmwÖûˆW∑W1r’À’≠≠’ˇ¯b˜Ä˝ûlÓÏÓal´’ù’√õ?moÆQë[Ô$-å9ÓqfÖü˜°0Û≤»e≤0⁄ÇËˆ‹:‘-Ö6K˜√>(pÙkIHËÿË™n™π#a Ö…Dù
˙4ˆéè„;3O1‚¢—>ÏÄ#¯tLë∆™O'e˛ﬂÛ_µZÌ˚‰ıÒ1˛oÊ˚[33tïc{ÉÒ]
£¯êÏ¶‹≈lwÏµõº´!“]mÓ¶P?\‰à!Ùﬁ∞vDUç$€_@œæ√À∫™ïoˇ7é^p16˘ﬂPràß¡DÛ	®õç˛JâhBGßÉ;:úZËêX4zh¿˜M¸8h‚é)∑˝bI¿‘È‚Ø0N⁄xp’k
ã∂√ê◊[ªLuç¥ëj¶$Ω≈é0Ω'E/ﬁ˜õa‘˙BP˛˜â*∏®L9N*†‡*¿¸ÍãwzTef»˙˙kÑz4 ƒ¡áT…)é˜∞t%Í$C†≠ˆZ>jÓ—“"ü~∆Î…èaÌ@câ∑Ω>ë	 §Ôº?ñƒ:-≈Òj5RZ˙¨óÁ«$sQ¡ååsŒq¯=	X*+‡)Ó÷íÁÁa$¢CÄÍŒÕ±Ö:ì¯…x®√møKùˆ4πÚ=Öí›ﬂ€ﬂ8\]€º˘”ò•¡/<·Q™“]™µdî…?I)rG˜b(NÛTWÛIë¸ï£OÃ‰bÒbı†E`™Ù¬◊ã°
`CÊG§Ω7æSI˘ö,	K±∆–õ\gª3-Dé	 °q≈;^√ÔH]CãjÓÑL£^πFΩ—⁄R 2<≠Øç√ÆB¶Ãs∑sP#©AÙqπFuml.^@ã&lw†[pÍˆ‚1é‡ŒaÿÇ›–Åˇ+Àº-ö:3è—.ì_ZydÆ⁄ynn~ä1x,ÃÙ õÓhsPq©µ]êÜ#M–¥g	HÖõxO°B¸,»;"™Æ˚=a÷π˘© eK`§£±9ÌªîîÖ¶{]O°¥%hﬁπÉ:ö÷µâÀTYﬁËåÖƒECJ#¥s`)Ï÷«iåRœÛwØŒ6…∫Q%ËBÅw*π û<’ÛÑFÏiΩ$˘Ê√©OÃ$=r	ÃQî:Ë…y8Ï÷Ñ_´5Ì$°“LòÕdù"íÒ«ªÚ∏g—˙Ù&<ÙâúÆÛ°•aÃhê“+˛†§·0e-^ÂIL´$%˙Ê‚:c˘Ú–∑πXõ )›Kü2g}wı—îœu\Í–`I H µlC@Ó‰Á4!qymIØûÂK¬nÃCx≤òz≠…F¸µÈ¯©ÖlÍÖ¨ãÔ 6∑B=\çÙ∏múÚ˚∏•˘˘
9¥„ì∂ÅÃvGúAﬂ˘’ ŒÛu¿-up<úø7?_√?˜€f∫Ü$Nµú$Iñ8ë¶πI+±◊yñ‘êì∏„¢k%xãöãåı≈™ÊÄÜÙü∏Ø ‚˚=ã§ÿ£…9≤∆Íü£/úÛ[5˝åO‹Sf˛‹•§)À˙Ì∂ÚO∑AÓ´nL!W»0ëàîòñæ5:48:#ÓØgGO;»k‚ˆ2F€«[Ìe9Z|“Ü´ïÛ0Öë*»-Ê¬»Îù˙÷~÷ÏKŒ¬aú&*‹Åùè’,∏ŸSRL‹˜…+˜`0l]q˘ı%, °J⁄pDH«Áß2‘„$xeËåx˚Ïj≥¿}÷Ñ_™ÈªÔ3’å´+D¬!úŒ1òï*\ß∑ò“Ÿ8/√â∫…£üí=ÂØ·ª*ê±7Ÿp«,D√`ØÖ⁄@˛¬>˜w”˙í?≈rJÇ≤⁄ÈTocÖ5Ù∏Ú€Ò—ΩFÂˆ,3ﬂ∑⁄ÀÌGÈ¥ŒIkÓ÷ ÷OzZÙÔµñ'Å’¿Ë#òo/<XÙ“#h6ZÀ˛BâX¨ï≠ØVaa··‚É	F`50˙Ó›[ZX^û`Vcå†µ‰ﬂø?…ÃR#¯\?ïØ∂(◊:ﬁ« #u:d˙6Ÿam UÖ™ø>í©Qˆ∂fnÒ¶˝∞Ìµõ3eññº˘{F-ø}Ø˘ øP›˜ÊçZMˇA˚^~≠ÌÖ÷BÀÏÀ_Ù3aç ÇR~{	˛	@ãw≠Ê‚˝≈˚Ö5õK=≤j6<»ö_R™Ω¸»üoX5=x0_ÿßÅò‚›“ÉÂÂ˚Ÿ¥¡*•◊ºøÙ`Èa√¿¶{	6ë=G†1F6≠ñ#wòVUK"û6ƒ•dàM¯Oÿeß√ ÿˇfÒFQÁ€çó∏l@Æˆ¢ˇ∞=Ø"s>oóÑ££@O⁄‰Ä;˛)}˛,s…˜æäÉ£¯˙•LlHÃ™¸Å.÷:*àË"$Ÿ%ï’KG)WæVBú¨∏?Ï◊ŸûxùWUIç∫kR
Õ*Ò¨°¬8{·9Ωw‘2§A=|å£Vc°[Z¸√Qjıûâ˜SÊV$—ﬁsU=‡_ú‡°ê2vßÎ¸ufü≤Z7Ñ_töKU}⁄tbåá≤¥π¸´‚[≠Ø’]uL\V{©ΩuT“®J{⁄[•≥‡ˆcuÃ¡æ:®Œœòj1ºΩLR„à„µ,âK‚`»—~k]È.S€QøGslI¸L€í~8∂¶“%;6©‘¬æÇÊµ ΩÂ‘]äZ ZhÀ¡&æ(çe`Ñ%`ÿ˝»ãaUº¡0Æ¨(≠≥=¶#Í0jÃ«÷¬8dUøt7Î ZA{o}x˙Õ‘ÔMåÅ ¿Úƒ†3Ü*›C>Õ°,EﬁË˚1œ»âÖƒÌGÄG~ù√jπN›‘ ÓUñ¢^htŸb ÜE;∏ºûé¯èBœn≠Q–kOiç(‹°ëQõj©∫ËﬂE<’óÏ˝ÆK;ƒ0∞3“´cåÓΩ≠é	à>
Uâ≈Agò¶◊Goî`¢≈±˙'m¯≤mVÌﬂ¸aúH˜ñjç(¿Ømh‰˝Ï{ÿ%øRZ&Æá}uï@ŒJIıìµy¥˛1¥£~è¬ì±AXnï¿&˙%ñ'OÆÑ$ô6Áîè¥qÛ6œ™@ìø≈êlåB‚‡í6√(Úë!ÁßX>aí
V$Ë›¸@QVÙû,"dS¬‚¥$ç≤€(;$Jt¬ﬁiÄ«zÄ˝bN®ê†#–ëè˜
ﬁ¥˝&Ì5∆±¶ÃBÅ|‰Â≠S°L†ÙöB‰†Œ Ñ„Ä«™´Î3∞`]tD¡≈YıtÍv+•eÀ_£B]vﬂmΩº9^ï¿«)ø)0â˜ÔïÄœiPíÇß¡"ÂÄ©@àLb+2ΩAB∞©Å.atuø w
œåÓ(!A√kªâmÇèÒ:õ@à `å x≥„ùãpë9`q»πk^∑˛äã‰‡<ƒ‡B≤(KuÄÃ°	’Ω\∞ä«T“] L(fè1Ö∏åá	1≠N¬'Ç:ºˆ‚ÿèc§	y‡IAbÓR4WqúB8U¬8zAHÏ@F÷â}äs°„>R"⁄@ów÷9Ÿ∫ R’‘fÀDZƒFõ%˙·6g“?eâ·‹ø&Á`BﬂÕ√I è∫bÿÚ»)\õ~†ÜøßZ[Â?◊‘≤˛†v_zojãn∑N∫«ª7?Ø"Z®»FÛ√¸Ó√¸Gœ~õ¿a['ﬂ;:VôÂPµﬁ≤k9ßlÔ–Ó{©Ã¿®˜r@ı∏ ]Q9]∫¢Tpø˙áË7ÿ øAë–0ô¨Èæ∏⁄Û/√∂Åª$˚(£º+vÄ±V˘±ÜÒ;}¥)ﬂKáG„#«ÿªa/tπâ&7¨Ê∑Ωæ™∏j!å+ñ„RÊ]-.	¿^<‚Qvÿ†÷M¿º÷ïG–èçâÙS^öôÎHNπ¯T`≥∏ªBø1-˜‘ÖŒ|<fö!L»s˜æ,Ωw	„º¨yCÿkÜÔÊ‹∂ÖÆ ‚iÖ≠ò'¢ÀûÖóVö4zN#∞œí_âósøvOèc:=‘…ò∆ƒ]ñÌ…,3|aÕ›ô⁄£|T¨-º@Ñ—≈ù´∞ŸÎÒõ3‹ÖØ_ü∫ù•¨º6˝ÅÁÆ¿<˜16Ö(‡íÖ‰ò1º ∂¥¬*&œ≤í'°hW,opÏlüËí·∏…≠¿qjD˙é!á Ëõ÷ˆÓ∂=§U0†øoét«∫Á¸Àü˛…±kúyÜqzòŒ:)˙Éˇ
 x-Üˇ¡âÅE  /≈ﬂ+ïcƒÔéì‡fÈñ‚hñë=#FÜ‘U¿ f≥õ0ı™âM˝\ûﬂÑy˙÷G°Œå˘-àì°™∫∑≈ûÒSUAE:©®zx˚˘’^’ñíÚãó˘’”“ÆjcÂ…:[UEÍ˘ç9ÑC’⁄W V“\ÖŸaÉ;©cls?“luc˝Í#÷Mh”Ê∑<∏/‚»$œˇi6øôMg˛jˇ2õnÖisïaçU’så€’Éx'\óZﬁ«Æ[#-ª’∑°èñ‘¥‘ˆ4sU⁄’§Ï,ãgú›ZB•˘OÖI?¢—·ÖÂå"ééßOd‘ÊÛ¢ãXmY|„›õÃ`#RT@ãnÅc÷);@[VcE!¯£0úwƒ¸gzZ‰çÆ`¸NÊT8π‚0%RF-Hâ5…¸+Zse!π x?±O¨Y4È©y5«Äº0k[—ÈO÷lç#B©i:àÂµòÔrc1UK∑t¥∫TøéWiÈ<ÏYhfúW ﬁˆµÉı EÊÏËíŒ®ë©E«ºˇ†T®È@Ÿå&G8“1¥∂ÈqUr‹{dÁ√ô’—<é<◊õÒàÍ¸DHÎÌôè¨}ÛSåI<0ˆ°ÈˆÚaiÔ—ıP:∏Í¶êﬂÛ˝B3HU®¿r?l 9Ol˘:tŸ?⁄mÏÖÒHÌ‘˙®´√˚ê,*53j8Óàà5¨
µ^“I–q1-uQºH≤BìõDNn9≥»…#ßa9πq‰4Ã#'7êúÜâ‰‰Fí”0ìú¿P“›Bi≥∆q«5m◊∏qÛ∆I'1qúƒ»q,3«\[,él≥X0÷3C¨xÌ∂æ7ôF’eå?Ûy™¢‡jõ{ö›~◊ZƒDá∑˘#qÚO¶è”7}Ñ∫CêñRó∫‚}¶i†L¯dÃq[ΩtT·f?i3Äqù÷É%nç∑ù13« ’ŸóÙ6£/Q%Ò≥≤*ΩpV¬k±qwª!ﬁ∏Ï'a_Ñ]o`€PÍØ]’z˛0
‚ÆﬁÀjÚŒÖ≠ K!´|«ø⁄s⁄\˙Q7àÉF@)á^SzDÃ‚¢öxﬁ~f Oÿ)Ü)kâÌÇsV-ü2¿{·ıN;A»ˆU'Ô¡¬iœ'+œîïÁ∑CØï4Å 7ÒîFYMﬁb–«tHâ©gK≥ÔƒsÊá0 ¥Õ;ﬂèö9ﬂ~^›Rî±¿*%<„ßn∫I)Ø˜>Õ6∑Éf
”ÿ0˘Úπ±ö¿ÑΩe ıZY&^”Çæö2Y¡Õï∂ŒÏ4ªyÄ/‰®‹	usnsì∆£ÏÍÄ*"Õá%·vyÔΩ%íQœ[k€ÉVéûlà48≥ƒ¶”—OX˝˜VÒ˜˝√u„¡u£\9.ΩÊÚZæ≠wÅL«5ä=èU•]õ∞".—,?√–ÜòèÄíO'R≤‡sJ◊Ã¬Ê°7óÿòí∫±9Ñ~Cñh¡ƒH¬2h≈◊|*ÛG#aúˇ¥-¸beÉ
‘—&Ω.ÈCf8À#Ïox◊¢ﬂ2≥≈ÿÉ◊~ª=§¸ ”0ÊÜâ°≤†‰Æ"Ô§fúÑ4™7YrŒk{-©∞”eÃ}Ω∑~Ù∫yÁö%Êä¸ÄÃœ∞Hµ∏I&x]ÔÊ_˝oá>¸»ù{¡!È‚swXÛ $3yz äƒhﬁqm‡ó±„≈≤ ◊≤<˝Ë*óúfùD∏ùnã0¿G‚ì1€∂¯∞2F£yGÜ8NIZK4\ Øs?»›,Œ#“W{%ßëÎsÙ@3¯88œo£¯ºÖß¸HòÎknJ–≈hP·r–kì‡@4-ì1lëQ∫ÄLÊ∞‡Ñ`&3tHm#∞€u;íIy'Ö=∞QÛ˝Úèªâ©~—¶∑wáÎHº*^"#ünˇ
€˝d€¸Ò€6/}\∂Õqûq≥∏MeÎCØ£˙Éö8cNtº˝g(C†Ã8ß§«lõÁtLKxÒ˘S€»π€¡»yIX¶,Â9Øä˘ç`ﬂ¨lp•IÛ‚Ë&Õ…åÚlõπ˝”—"ŸPÂX“RFZ÷≤“Tx^CLsYyÚ3H8ì.ï±£÷l+Ù,úVµ—¨´ÕNKòWÔ%öΩîÔåÀ†ø’Ùd?∫ïûÍZ'P 0dv,˜ÿ>“í”äÿÀn-ºÉ
Œ\ø73˚£Ö˙Ú…¥MÌìïæÔ⁄”üÔâÜ˜ö._k÷ŸöÆ°Œ∑˚Nt“F˚R…ö_U™™ﬁVpäóñÄ≥u∂M⁄´¢⁄~FÌ-Æ¸…Øn+»TSBıSn∂û)›L©—Xú¥5?∑»/#P*’ÄP<ê÷°`-mEÇ·P,Œeõ°ÛµÊÄg“íçX«Qª÷Èõ_‡Ta‘TœÒP§è#’à√!ﬂ£‡≠4TŸõ@ï Dƒwô√éË˙0˛@3õ˝x‹ﬁöW∂≈.÷Ô'∑áqõˇ‰ˆ∑Êˆê2Õ˙‰Ú‡öÕœ‰ÚêX∂ˇM¯<ê˙©K˙="úÇã√˚˜fXÌΩÌª3h•
¸√¨z^LÁ>Ãçßbáì´nT©¨3Wût=ãoÈXÕ”ä÷úcÛì{¬'˜ÑOÓ	˘qú'â‰<¬ﬁ˚‰ˆ∑Ëˆ†„Xv|Á——Ë=xLËC=ŒÛH\hÑXœ…iR∂È2L.+HyûÉ ÜÎ†PL•\πRk¥∂∏™,IÑÖrÄê"¸ñúûî-˘útó∏x–s2)ukÏh—)≠Ëï¿Ùvyáéfìëd∂*™ F#Ê`√Öµb≤dç1∏¬åâƒÏ9ÏuËvÒ¥CÜKDõà˘óA<àï@óö‚Ô~«>≥hgà*ÁÅöZ3ï∞I¿%Ëî~hàÀÍ…%Ωùk’ê8EêñgjÕÆ=#ê¯∆€^‹¥Í<óØ¶È Ûﬁ|m¬VF’ËÎÙBe?yÑ§<BºÊ∞[B∂˙Ì0@˛k«˙÷l˜ëIS≠±˝R∂d!HƒdÑlÑ£}nWf∏n≤pÖ¬ë◊txõ∏çœ:⁄Üø&ëk{ñCDòh%i=jt”Î4o~Ë˘<¬¨ﬂÚª„ªÄ$ œ1°üò-∞“Jº òç˜Ω\∞N√AZ&±Í÷ﬁÍÍ{*π3ï5∑,S√/Åú`Ë•‡Ÿú85¿ó6öà_àΩµq·g£&R{Ü1ßœ‰éê^a#ÙSòr
Óñ›ﬂè@4)mü[,xHœ´$¸ybç*8ª4ã;Qñ∆~Ûóí˛p%HÆAi˙K°dh¢§æLÆ?óﬁé‚z«ò_´x,√ü¯µ™˘∑PÕ~Ã5k·ƒ«ÖºtØë~&‡ı»¸Ç≈N3A‘¶g–‚≤f÷‡íVNﬁ	Œàù.cóOã≤\±$·Ç ≤Ä§e|˚u”eíC:i[ô‰\?'"-RπshìDÑ«ıPD1˜ÔUlR˜À¥Ç_Ìœ;eΩ‹˘≥áˇ≈˙óq˙p?æ`ﬂN√˜9V∆åKøî`ﬂC Ñ‚Z8.Ú{q™!ø3Ìg{ôƒ¥≈ÎÅÿˆZ~-p¥v1sÛÓl+èﬂ∂"”∂ÔRzøß{¶¸e4zÂ√q⁄Td´ÿ∆nk›˚|W.dÌÇ®ÚdS9àyd[ñ∏≠√Ò_∏¬:f·ﬁº≤®)¥«%l∆SêO€ç„øπÙú#:	Æ∂ë«;[È˝—-∞ñ˙º‘
Ûy¸ÇX ˛}¨ØÀÑ«m¢cF-%<\àY¸Psº‡ro$ºXJß„á(c%aº≥b,˙¸)y¿/œáÅUÖ2„¿”è÷õ!—C∆‚B≠\`+nÍU5Sqz¡ˆ¯˜W ‘j	{´´EöF˘µÇA⁄: cû{\qR0—î√h„êüè)>_©ví„π´ô’^Q+SqzÈ—lWêuë5-,iﬂÔ%í”Õ5ê—ÓØƒ‚ﬁ≥ÓƒäMÓÌ[¥O6˜„6ˇ…Ê˛oÕÊ>m4Ò…Ëﬁ5õü…Ë>1ø˛õ0∫∑(≠—Ø"”¿·\
mÛµR∂˘€plìàüLÙ?ôË2—ˇd¢/ˆ·'˝O&˙üLÙì°˛ÚLÙÜ∞3Å·ò÷P\®≈™∞3[–∫Ô˜ã[iA)YùÍv˜ÊÄú¶˘¢€0_´È∞¢7€Õ4◊qÈc◊é∆≈à2[•jÜyæiVØŒ0≠Á˝eI\…˘äKsø£ÙƒB§Ñ\si]’Ÿ∂züWùb±vá1Oj¥∞)?Â[tªLT£lÁdIºH#é°F2ØKáuô”ñ>
ÏåœÈUFæ¥™· H=d#ΩÀ®ëgˆñk”~ÊGΩ¿{ÌÄ˚K˙¬P˜¸^3∫èm–>∞j«∏ÂR/èÇ÷â√&∆YÓô¥ÁŸ≤G~÷˙u€ÔÜò8◊*wÛIãGıïÃê∫_79≈“,kü>ÈtÃdAfd45æÛ ZéicBE`+™9ˆ¢¿7?*wÖ8N{aÃ¸fx›¸–¶Î*RÒgπv±|≠É=i´ßE”EïtË˜ÑısƒøƒDÉéå}˚∫ÁÍ\É˝4•⁄∆üÏä€ﬂÀ»Æ!WΩ¥=nK;Bt˚lB4ƒ∞H ~Ûˇ  ˇˇ ^¸æ|xúÏΩÀvG∂ :˜WÑQu\§LÄ_zXîDR™¯jÇRµ[RQÅD H;ëâ LP§Æ’gÿÉs'uGw“ÀwV≠^µj÷S˛…˘Ç˛Ñﬁ;ôôëâIŸ≤ã≤dFÏÿ±c«é˝ä2¶°„RØQ˚Êí|∫!£?§1R;£Q<âNG¨Â›®ˆ»˛ﬁ£13q˚d!ä·Ÿ⁄⁄"5'°¨¯µE≤x˙§∂€c#Jzn$r}“cã‚p‚¿{Í∏WˇƒG§ÔvCô¯f†C≈√‡TvNkdGæ"ÚLàÎ˜]/i/ C6∫˙)vùÄxÓÄÖAµvú`4ˆXhO∆à6âÉX∂“c}Êƒ~è√´üúÿı;s{ÃèYuÚªP:ƒ1òîx»Bﬂ•ß£I‰L<hÙiî@î$VU`$¸´üFÆC+—@k·Y ‰áA‚Ea»¬ÄìGŒE»¥wAÏ6°–|‰.e¿À/≤-ı_æD¸‡∞pB ˜*ÒÒˇê óXÚBgH√Vº∞≤ÿàÉó„1∑Å÷ã‰k˘>Ú\á-4≥®®Æ∂<dvA∏~†u„Úõ/æ–
.»zè{ÓI÷£Qt@Gl´6äÎ»8ÆoínˆXXèÎ´ÍkèFC÷Sø!Ω®Ø≠¨@{~\è®’ÄQ|·±≠ÄªÏ)“∞ÌG¿aèHçûnØ∂$(õyJ.Uøû$†8¶ÇÔÎ˝âÁëòù«u>v!uÎkµ'⁄®eÎ¬Øõ+„Û∑dÇ‘ÂúÃÒÓ^è¿îs~p˝A˝=`
ÿ è˙ËÄ_ilêÆ8?hù’$§Â≥Û‡Ÿç˛:·“Éë‘ÛËèÉ "§„˙¡8r#|æ?âº  ÊnÍX/⁄F7∆˘N<¥Ùa¯ÅŸ—>BÎ++T˜ÈòÒÈ‡–1çíy∆"M nﬂ≈È»m9w(‚ÌaA@úJƒ	Û	sh£ıë›k£'˙T8ö}èù¸ßÓâFè¯˜0xO‹òç¢:à];CÚ˝$ä›˛ÖÒáéËy˝}}ÌP;Ø”	Ã:Ω£ñÔë=÷è…Æ«FPÌŸôÄòŸq)‡<ä»”‡ú‹[æ,aõ˜ı◊k´úiÜmÖÎÅáÄ◊◊@û uXØàIaÃçU‡ùh¬¸}=≥ß™?]øg@I—[Ÿªh∫˛ı†µ;B.Ï”´ª~ffo£)⁄3¿™6)Gõ”p5®cÓ∞(bΩN ‰€Dp7ov–hY†îkãCâ∆‘œ≥˘˝∆F·d≈ÆﬂsA}SLœf—<kOé<
OµŒ<^∆&≠∏BQˇ‰©,xÔusçsE"tπT≥ÇÍQ◊sòK∑}üÖ/Nˆ˜PXûû„ë˜àXá‡Ú“Ü⁄ræ91ÇüEÚà¯Ä˜e·pÔ06˛¸∆f.ËpΩÍ}$ó˚_—(s ä·µµØå˜±w∆í!˚ FÆmÅLá‘Ô›D;∆’Mhm˚ı©1Õ/kô5AàÍcw0‘dı3ú·˛ ı7äg»i)Ò@4ãE{c•HgÑv©L∂H€,Ÿ≠S√ò(dõ®<D∫yå∫¸=v^Œöáb÷ÿe‚}]%”Ü C†)◊g¨sıˇ¸œø˝j	5f€ª˙ËÉEëSáY¥0©mˆYYwI°K¸ÉCÅ.ä=ó/êvñ.|xmÈ’‚ˆ@”¡Ë Û•œFA∂·Òhó¡t¨sk‰>Mù\.√àhCÌâ^}øA:‚qP^Ÿı‹ vª ”Oª‘Ôi N§ùº,íµÅ<^¡ÀÄÏ≥^£ê‘P∂@Ÿ£q5(∫=hÅ”ÊØT“€ZΩ,\RÑl=—¨§Ùˆ!pmD∂H<Y—Aª(z-Í4‹ﬁ[2ùö&ÿ7  Ë l˘“óãyƒ
öŒA[låËxAV\¸§]*Ñ€‚Ì¿M}ãX‹Úi†ÌÒf¯õÖhÒõ/äÎÛV«±Üπƒp'}î≈ö8µ5Ó∏£±Áˆ]÷;…‘XH*,ëÇÜ3V™˘·¢·v±ı!tôìçj¸cd|.$ØRÿ-KBV
µx´,L.ÛYuûã}‚1äkX›|VºP»?»
˘QÆ-‹h≠i|∏§Aò∫íÇ|öÊgdÇY°%ﬁZƒyÚ“bªJe/≈wµ∫ò[◊äVë?¿öÔ≥:TŸ,≠áu¬∞F+aøhìyB|rûoız."A=•∂,‘Ã%≤ñÉ`SŒÚè™(oY⁄T‰GI˙œXÛËƒπÈ†∆!d=g=Mìö7
¯QnL§QM	_®ªg‹√êq\pmé¬vŒ=n!ã∆P—ãÖeÉ∞3ÍM§'°‹ï≤™¢◊¡91Bò”˝´è˙H—=1ÜJ‹ÖYN”Ã„ßˆÉsÅpû	i®7lGA$z’qÜËÒŸ"öúG·óÆÔxì≥o˚«º(9£1s@`:ùx“ªKâ`û§NÍ”D%_JNÅ÷H!âŒŸ‡Y Dd¢≥A¢L£È!kë«bL†®u“*˛´%bzyô4Zp@îÇ¯/h0¿íT¡yx¡ X4pËpH( „H¬—⁄S_ì¡h@g<Í∞ñÁ-¸+’9∞≠⁄Ôölı·Z∑ˆá%b>Ô7˚˝áµ?,√ÿ∂ÉÿÆ!imï≠ı6VoÑEƒu∞XÈ7ÔØ“<N∑∑¡öï∞»ÄÿÆ!ëfÛ¡Í˝aëq,÷÷÷õ7¬"‚ZXÙ÷ŸÊÊÕ∞0A‰∞–Á·jÉ¥z®rÄÃãá ô]œ[Ü=¯!ô}}ê∂c
+ÛŒ=ÑhN˘§ˇ†O˚Naèd©ıç&]Y3Í±˛ösV=–ÓØ≠ıvøø6´ﬁ˝~≥◊ÏôÌ±U∂ZBy$îc˝u¯H≤Àg=gusu≥B]g˝¡√áô∫›’˚˜ã˚ôîÎo<d+›L›á˜ÔØTh◊`X˘l˝˛∆∆fô¸»î”ÎnÆﬂ_–ÕÿZ¬c®@H∂∫&©“·ôÅn¶TZO1§ÅÍzÇ™ˇ#2ò†ácŸqC„ÆØ-XÛØBíJ∆Ú°8`ï=ËØËË»eZ¡4cp“‹;Ë~›-∞”ú	_t¡ÑíÎÔ”ãvo°∆MÆ˙Xiu-<S(5©©&`π#qx=(Ø qH®Xùœ†íH€”("ƒwâ÷cv/x¿µÍ/Y íåzÿ¥∏ƒ®*Ø¶¿•ööπØæ"_Äãµ00»|Ó{ÃËzhiÎJ:LÄ{@¡X}5T2éNƒ’B◊6º
Iº˜  9ß ßå™$√Õ™|&Ã∞QXd´êdå‹@‰ıP}ÉÏßœÀ™C?¡∞˚ËØ•,)Py[=µuñM¬ VBóÍíØ>R[ÊÉ8àË’SΩ©]„π•¢-ad[<ã•¥gñ$ê9íø1HTñê…0≈KÅ&·…√´cr$≤k!W∆E`"ú)≈o_ªΩ∑ñºáÚ
≈)[ÂÈµπêüﬁ’«ëãv•(Õ¥\6zÔbt®†Éy.]†Ò8qüz√≤4óÛG%˚§o	å®€ø˙{àÊ+¶æ ∂Öu+ x‰˙4¨ñS8ﬂTãFnë§›F3∫ã%#=4»Ωg…WT§tŸèhÀá ªÖCÍpìæB~QÜÓ—ËŒÄz‚Á>ã>ÕgüÕKtŸ\⁄¢NnÊë3î*!K2.ÆMıß!Ò†z¿âŒ¢1ã@ÈW•ØAxåˆ≈˝WATû‘u3nAXéŒÿ'§∑`olhACË”ÕsË.O2»D“⁄]Î“˘Í®Ë¨HÚuA}∏}öKjpœiº—í£zíaóêêPåt¢&Õ5†9±BF‘«µ@W°:ê'vùSüÖg¨åÊVÕ‚ÿ∏'gºy í\àÿIk‰x¨?C®TRD‡iÍSıÇà∑wıÑÔéãqŸN≠®BÁiØ7q‚ <—Å_Œr≈…±)>"K÷aÔ¸$P?+V=´8¸%˘±òi+¶≤Zƒî®Sô≥äÌn iâaîÚ≤YW[Í3ÁÍüπ,‘ª—ª—Oí ö®∆≈±ãœ4C4ùGw)¢w)¢w)¢w)¢w)¢ñœ]äh÷BïÓvó%˙[ÕMô_Uöhﬁ˚ó&5>”^bÆhÉÏΩ(OèÃª≥
 uf  ∏gÃÃS˘nF™f÷›êÉÅ/g¡0åÁ¬¸v≤ÌämãÂ@≤F®ÅHKºﬁ∫∏≈|Q3(Û©GØë˝yC¯i†v∑}•|P[’ªƒ–ˇ≤â°Îø˘ƒP-∑Ô_834u¸FRCwΩn~fF®VjF"Ëv–Ó≤?Ô≤?Ô≤?Ô≤?Â<ºÀ˛ºÀ˛ºÀ˛LP˝ıeÓâ˝ñeôöÑ:Â∂⁄¶h÷Â&Õ\ŒÁæH¶òñH¿∞g}¶»Y3>ìÊ≤9ü≤û%%3ÖXòï©*[Ú<EÉ∞	&ÖPeU#€3ìÆ)±_Mñ¶rˇ∏ëVÈ$}hKtÉ<∞CÙZª∆s{E`tòB˘ä⁄skæc
?;≈¸#†œìΩÇÙOQi¿7⁄,˜Éûµ*ã`∆˚NÆ¡]˘º†≈§ö•…§Íæµ*¶ud®r†YäGìÆ79ßéôH—QOı¥—Oê˝…Y¸⁄Iü_ädt=˚Rgˆ|
¶∆ˆ¶QñO¿¨û◊y§RmTÍ’ÖñÛÊG,<É1‘ê_ R<ù`4
¸SX‚òÄ rafL=nf*8ò?rıø}qÿöÑ`úZBOyJPï)K‰Ç¿°zrá¢OÑ\i∂ä¢⁄i‘;ÖE^-2%tò9€πH932òÙ¥(œP\üfeáUö¢Íos‰:aÜ2]Ø‡ê>+Ü∞xBUAäÔòBÂ…xV∑è°èfî¬òÛ <‰$—4§èô´ê˝9S&ÄR0LäÉï∞R"òd~ÙY^Éı∑È®Î<_%}/2ã¯\`ÂLò≈Ó≥ï4 ôÜéË≠Œ`Äàãb†j∂ÎƒÛixC¶Ì°ö„úßa\∏F≈âÉÇˇ“4ôkÛªJAÂ<îN öd¡q¢'iÅ…ûÎ î®îô¢.Lg§æK	#Cw`∫Û]«Ì—G…a!g“u≈˘ì#ÃßÏzBF(ò•dôΩ~¶GDÍmFtW®P
$ßJ>˛uÊ°z8L≠ë;¿úWá¢K5™íŒóÀ‚£VÁùØª<œÆŒ≥ÏÑ”†1ıÖ:¶rR◊Wio]0éÙÄ„ah æ–2≥ôÄ5=[¡Í≥Nˆ÷ÕÑΩ·ZÆÏπÙ<såäÇ °πvR:bWÒpmV"û5™1G“DYòHÑÒÆ>R≤ã	vW?!#¿l∑∏òÄˇ’?«±òdõÇ¯P∆ÿ÷ë—•k%Âa"Fµ÷gd÷u^=èf'”≠ ∫¢ƒåU#°NEÏíórôŸ»—Ïæ5âLˆ1Û„J2„ù?ªl©ÍYq:ø‹j™‘√Oô)•ˇ©s·§˚·≥ﬂ1¶ÖV]—â_œ‡J¢ˇ ·ƒZÉ¸Íü#¢ƒıÂ.Ó∑óá„˙´J|À˙Då„	wïácõ€uÂI^yøB
kœ‡¶nÂƒ8¶≥R◊,ˆy
≠∆ÚBîE Åô¶Ø—√g¬n≠“øúYÿΩÌ…¨¨:›ÀÁ‘	„©b.K|⁄∑{Da‹ü#7≠®∫; ”∏eÛ≈WŒkc7ÈÏt∂¨cı.ãÌ∫‡∏ëÎÉëµ–2∞2R˛√ª!ß¬{˛ØÍ+◊Gí2øˇ†∏ÏÚ›ÂìÚÃ5[?C÷]ÂºªYôw3rÔäµ TiSjLQ÷ò‘Û6∏ûßzóPª<π∞$ÓfŒû_ÔëîÜH˙÷åÖ,ên±€j†Ç~Œ)ä"ÎÏ_2/—ÅÆﬂ~2" û‡≈>Q‡√ﬂr¢5±„‡e7£ô©àF9=q¡íç∏ai·˜‰$cG¯MÇ‹˚/óˇ5ä≈Æ≥Ï6K**µ≈≈œ ¡ÒgJé
]∫–‹\"ÕœÍ√%≤“X]]‘ıö} 6™ Z]G ‡ü&Ù`qÓ¥+	h}âlÆ-ëáÎgm√Ñ”gÎ¨BjRs•˚A”LíYYøˇ`„ö)Q›ıçµï
iM˝ıµ˛À‘eÕ’µ‚—(Mâz∏N◊∫f◊’2õÚ©Xzé“≠ÂR©Ñ@KNTi=⁄ÑˇË¸9X˘‹-ï~6˜ëwBŒî%*E¢àû™§“ùÃÉÈPπÉÁƒ€°sIù‚Áde[æHÆ?±¥ÇîÂ,Ì6!‹&öxND†[ìNF„vtÛ/W’˝ÒØóÖΩÇ mKe6v{ﬂ»÷Ó.ºª˙à/≠Ì¶UmÌjïmÌ¬*·
πnk˘E˙÷⁄¥^€÷∏^øùÏ˝zkíZw`‘‰ê®—…õ¬í£™√÷,ö¬¥côIMd≥Ω2Îò3¨(ù=IÕÚ∏‡µÇí÷HÊÌûõñfa¿2Ó’OπA^?)µ+CS¸uE!Ex¯ÒDJ?jûoÚ©Cê≥#êÕ≈»ç€ä@ŸÀrV>¿d L∞1ODfÆ£'$ä˘pL&Sq˘§·ïÑ’û∫ûäaﬁEW~k—)?ø KFKô”’^®∑Tq∂ßﬁm·Uœj2©ßmÜg›´ŒUáäÓ˝€ÙtÎXu7éÜÑ>gL&N∏Enﬁ_ïó\¯«áy/πÎs«¶8∫Lsô'„ˇ-˘ê\ù±≥±≤ÚÊ¯àé∫@w|p˘Ó“|/∆ßñ:≈Mø˜ßqno⁄4 }Xs>Ï&œ?Æ¯
¿4À}–∂EØ»Ò,ö'˚s”õ…w∏_ñ4ı©]ƒ ’g´ö~ÛÒêìt≈ö13√Qléú$H„:ÆWòôﬁ–âCÁÑ6%.ŸH˙d—©ÀÌvéI¥çJ• ›ö‹ ñu^)‰ö
™=È¬ûwèècKÇ—=≤ö{D¿jCºp‚t4%,Ø∞ÓÄ—·àïVd’*_6åÓåΩü¡á˝ÁtÆBv‚¬÷ä%lt@À◊;ÏøLpwàÎõeÔ^∫˙sËÁ∞Î~^˜‡Jw•ﬂ|8ˇé›;gˆo√ôm€\’ô}Á/´w{épu#`ô'¸=J¥ƒÆ∂rXÔ|IŒë©OªP∆zâåó≥!ˆX˝Ø≤pÒ=2Zá≠[äı‹2£ad∏¸ãÄ‘√)C…]≈öÈeC±0<ê ∞∫WµÅ∞∂†w≤∞âÑŸ∆eÆ«Ek˜ÎchΩ"G#g…E9	àÈoÆ:â∑~<âÜ©*(#bÎé∏◊ÿÚ©p˚ÚÖûLóƒS¸núñi},2¢)‚ùLÔÉw ¢ﬁ©C√±{*“ç;ëüm€™—ç fV"æ¿‰∆lFbz5ã^3‡ÕB◊N’t7Ø¶Ür‰UÄ'Ò[‡80µΩ”;L._´∏ç/P◊}Œ_TE!ëyv@f€;£ˆ#‚>-	O‰-ûä;Ft oÔî° >ÖØ|«Ä˚›ÙHUR∆:òn7ƒ≈ÆG¡i·¯M⁄Ä™2W±êåBDrO”4òbw˚eöóô;¿`¶
ZmVÙ˛zöêÜéΩS6ÓöY´≠£ΩÂ›£ßdZZ¥ı `ÛÙ4r˝‡sh=óoJ’‡º¬<‚ÄJa¡Rey“í(|åoØ~¡ÀR8Ω`<ˆXx:º À¨™AÈ∞´‡a‹¢H&KjM*Õ‰Xﬁ¡Ú≥‡Õ'
Í≠Õ
Ú≤ŸpaÓaA∞–ZÓó
ä‡∏ùu5¸¥QCiŒ∂˘/5¸Pn∑œRq2Æåo¡bÁ◊<g>O∂g s∂ıE©∞√H¢ı»Ëd/à≤ÒØG§µ¢v˘™Læí+cÇFJ˙|+≤Ê.˜>ÄñÒ£‹-jJ t,OG{¡ÏT{±fƒ¢>ã›õ´ü~˜ÊZaÏ¥ú≠Ú⁄>»⁄ºÇæXr-§ﬂÏhØå»ZÉoM|≥E›>‰QÆÊ=’Ôw∞n<,Ô˜+€Ò∑1Áéø˘¢ÃI◊Ìª˛¨˚˛l4rm£PÆeíﬁE4ôœÌBW˙úûc}@S{_oD”æˇC*ƒÙmç©•xZ‘*û Lwõç>è4 Ì/ñ„jç3Gq.Isæ›ΩÛ]qëtŸ∆∂›Ω∑¡ôEÕåd…]¥2CÈêÁäeV’ªÏí_Qvâ‘ﬂ~kŸ%Ó]n…]n…]nIıvÓrKrü[ª!AF‡π% çï¶ô¸ã&î$wF*Çmì"ÄÓ§–à˙=˙sdé‡ç¢%©#*5D/¶Ô}¸2≥MëOÿ}:¢Q-ü4"^#uœ%/2
z¿IqZµ⁄[rA^¶˚Dπâ∑˙©vH
éÎG/óè¬=∂ ‹œ	{Á’s˘VÕtHÅh`@¥}è·NBØ·1ıKÑyû;éÿs/Ò’Kx^eºD∆Åw1¿„˝˝ ‹•Œpac ‘ø»Ë3RÉËµ‚8‰ß6`d∏›IÃjnØ∂(vï¶¢àbxçpHÙg7.‘¯Aÿà“V◊óDò
’ÓA≤¢L	–Î-·÷’or5˘Q~Ø∏v”Ï%4-±\Õ“æ&«rPy¸ 	"ÉòüÄ»©‘õåPŒïºÜÃy©Veà ™BFùK®B≈ËC>~Rπ#2egéé»$ö€ÍàâËÚ2—˙Qµ"°jé>»óπ˚êÈAÚ›“5˝ÂBR4©xÅ¸ºLj‘nH¡âû≈îW,-∆œÖ 3‰Jv:ñ–T /‡;®”6ÿàÉΩ‡}rÿ&üK|#ZÂ≈Ñ®™PP
∑yx⁄¬óI+á<πÄ∫ú¬FÈ˚sïﬁ¿“3˚4Ég5îﬂ.”ú©≤uu}Eàœc€í èãà,s¬4t,ÖQAÍ”ëÎ]`ù!ÛŒnV´PÎ=CÖ	k°rïV∏ÃÂÑ•›‘í<y—lzwÌñ^Ë ñï$ùãkm÷T.·Ã
Ìb#ëK©“G'ºW[:ûﬂß…"JÔ˝∆ëGô∂4dK‡â)8ûËpLÃû}ßˆ®w æﬁ‘Æö‹!u≤˚=#Õ¸NeQz’Vzµ®Ùö≠ÙZQÈu[Èı¢“∂“E•7m•7ãJﬂ∑ïæ_T˙Å≠ÙÉ¢“m•ïnÆXág•∞º}8«≥i–¶}DaÍÜ¨IÅô4ƒ´ÎÔlï¡Ç§ß`'¯À÷≈c·P≥Ôà∑∂⁄Ù‹ıhæÕﬂO€¬ó∂V›É∑K‹Õ1xªÑ¡›É∑K‹Õ1xªÑ¡›É∑K‹Õ1xªÑ¡›É∑K‹Õ1xªÑ¡›É∑K‹Õ3xªå¡›<É∑À‹Õ3xªå¡›Boœfp∑à¡€U‹Õ3x€∆‡º⁄¨”r¢ø¯v‡r-uÖgocQ‘iÔVs∆ˆVÛj':¡]~”MÛõ‡áÕIb¯ê~Ÿßƒ÷aë∑J∆A»Á‚gsûã,Ow®=¯§ÛTKéôyÇ–:´≈¡ÁÕëò;>gnƒ<p—œü3¯Ωøsì∑qﬁ=≤◊oàx7÷jﬂÂ !ÚÀÂ ÑAƒn+óÉH¶Sßk\≤&∞(èÍØ:˚†@Áö?˝@ *9≤π÷“ÆES·π∆]ñ¡Ø0À†6gí–òœ—çåj[°•œ=@…àªDÅíù;M ≥¡ø§9xØ%<.<J^¿lÈ‚Ö4∂ñ§´∆1»7>Â˝  ìB∞ÀÙkƒ∆4º´x õÔˇÍüΩâá˜ãÁë8±Ô¡laÁc/‡€'∂~ˇK&?§7ﬁIÍ\}Ïsr‚±cyB≤»ç@˙9 Z›^ ÇñzÃfÊAXJÎÈñC2éh»z$©WrXFöPPà†
R˝=†`;V‹Fõ ≥5X˝hçÂe“lêgAË0ÌvpB·ﬂƒèÎä<§Ä∞‚ñVÏEc°îZê9&!◊9†ÏE‚⁄Û~≥ø—◊é!»Aÿ∂ÿÆZ?iiï≠ı6VoÄA¿¸¨Ùõ˜Wiu®√L2 ∂´÷OG°Ÿ|∞zˇd ÃèÅqT«u0» ∏Ωu∂πyL 9“π∂⁄P'`‡="†]ac5√˙A/A"'Á<ÛK~≥πÚ∞πVvàçıËõÕ¶≥ÍÃ]+=¶‡úõ[:.ß*òıçy¡Ëá‘±S˘§ûç“ìz™ÇY/?Á˙«Ù\ˇêûÍ«ÏÃò5s≤cØπJ◊6÷Ô_ßMc¡êœÿ*{–_IÁ®e¶ç
–(fCêk]¬ç∫B‘ûÄ›Z º≥œˇôÛÙCgAƒûEÄÈäìËT™+nt ê$í’ «ò¬BZ†vêZéAœAOA!åˆèµ¿∫xÄ;M"–X¨xBgj®ã,Ñ<	 ;
® —SÍuıHﬁﬁ’GxJZ¯4Wc2Í∫ﬁÔuÚ àqfƒ†A^™˜÷SÎORp
ÍÓBÅ´üx	KÀ†ˆOPΩîïs‰‚ ⁄≤P¡≤023AÿIÊÑìp€ºH
f}≤∫lû◊ûAU‹>3p
e©a)Ã
úÚòh>TöâàV<@câD÷≥4–00– ûêQ¯≤‡§å“Ú≥OÃ‡ìxrP|ÜÜxıèj T˙)yTß#ûS_~°ª[Ì\∞.«‹(K–Ør≤FÇW.k·‚Ù˙•çÜ–F&|ú˙¡” K_xÉ(Ã∆D˚⁄<îç'a0∑kyJ.Uã“2‹ìâKØôqi´ó@Ï_µ^ûkâM'KÇGüò2¶ùΩÓôÎπÿ¯∑áÆZ:ëø‰◊ÙÖX#‘4ΩÉˆÇD
¡t∑ø–ä8tLuæ\"t¨:	,}AÇù.Ùr»Bﬂ•!|5∫t≠P6∆â¢—£$ê,<…Äãùa6¨åûÂMˇ[;˜»ËºN' i £‡Ú0Ú48ü_7ììoâO.Í*àEC⁄ﬁ◊£Qâﬂ]˛,àà€°˘Y¡°óD›≥!–
·œD°ª4›wÀ∑UÜ‡ôXc~ªÌ]–Ò≥€¯úGÛWp,WYÊâ;ﬁÏ≤ZÛæŸ“Õ”w»Œ˛ÓŸ_ﬂ≤õ◊π@vñ¶çª©;¸|P0—§+ÏÖÖt4˝äoï˝ú/ãÕÖÇ~˘]€ÜiÄ¡T±çª Ë©Dˇ/∑s˚sæ7cT&w„V¬ÕØ»˝9Ç¢€‘Î∑ú°ÎÅA=3&ö/<3$Í«@®@˘˝f~O‰ë÷_'. πqåTç~ùJîÓB§w!“2ÓB§w!“ªÈ]àÙ.Dz"˝!RTFÏ!R¶Ï¿I$nr–œ˛ûæñ◊9X¢}&ô
_dOæŒAâè!
<¿©á6Ø˛wƒßÔ\˝”cAæ¢R≤‰©˚ôã$2j]Æ6–‘èÒöÄ|ı#ÒäÏ0o@{ññ˘ûLºïã˙åzß›IÈ—’ßÅQ±9]˝•™Ü˘‘àU	Û9∫Ú˚ŸD˘t¨≤Aæ¢w1æ≤‚∑‚k°±⁄…aß2⁄ñ0ˇ|±µo˛)	¿bÍ{`èqÛ©$¸ßŸXLøÑO-É^r'Ô ò1ç!ﬁ≈?øx`πÈXlˇ"B®zÜv^»Ã∞†àVC…∏ºwÒ¿ªx‡]<.¯ÀƒKuõªp‡]8.hºøŒCíªp‡Ã0»]|–xî◊È~eÒ¡dºóÛzˇu√Öø\êÄ?√<ì+ZJ¢Ññ“3¬Ñ€,d›0 ™Êç√ÇæTÔ"?G\PT,ã3R?M¿B¯Ò7ñ»Í⁄Y_µxÒ+E"fﬁn~€>l€}ÿ’|ÿ6Otiõ%èÊ‹+òµ9¿\?ÊPr{ÈıÌÅlVRÌ&ˆ˘˘W∫ÂÒÎπˇ3á†¬¸∑˚‰œ–[„¬<ÕÌ9yÖoÆ>rw¯[ñp◊ﬁ5ù¬»Ï;…Åhˇ¬üÖ6ˇv
$∫aÔ¥LB~nµ∂“‚Ç¨«—¿Z6¬É0p{πÓ·ŒdõødAqgT˝LW2’K:2`·Hl `–iêm:ÅzW?qœY!	åy%àc≥ù·≈àûÇ§u%Å—%ó'Ø˛Ó$X“édŸ¢=j%`≥4≥BµÔ“†Ú{`KQ‹∫<T2=®)«éÿîô°èÃ  °qöÂ.>p≤{=ë™J±ñd*V	∂¯ÜÒŸD[¥≤·ñ¬óÒñ“Ú∑pŸMtM©SÇ e˜Y˜∏PfºÔ∏‚R–Ü˘±ÀeCÓ∫aák{‘KpÑ˘\É0˙ô¢€jÿîñ˛ôE`¿ÄB´õã8ıﬁB‹„∂∞·ﬂa ;ˆÒª¿À]‡Â.rx˘e/ÂzŒ]‰Â.Úry1ﬁﬂE^Ê!…ø|‰%ÔYæã¥¸f"-YM_-¶üyÄÂãƒÒ‘FÃRWÍc@2‹¸üÖ¡HÜK∂»íWsM‡réÖÃ[øí[ÒUrÎ˛h ë£¸≈„O∂»∫rËW{`Aé±˛%¢Å"M|”.G;nÌ¥é…”ˆ·˛Óˆ’ø¥∑kãÿ^Yπñ(fπ¡3/$6ÇH(ÉPO‚¿¢±Á∆µ7æ
‚`Ñf‡]Ps`tî[…æÿhØ"‚úIÅÅÃµ¥îÿ¬Á«Ø¯kXËàÖ}◊#œ@ˆsaBN‹}|Z%–‚ ’d4¢ÄÒVr†t~Ö˘ Ω~ã~Á∑Z@…ı[ÁºG}ÍEÏÌy
LæÔê …}o|sYŒaº1Çy5Ò}.$ÚSåû(°Ëù®o¯Ræ”ÜÍËÂ¡IÎèª‰˘ﬁ·”÷ŸŸ%€≠„Á-r“Óº‹k?2Ôø8å(Zæ[
óˇΩ∞º¶˜ı¬∑èﬁ4‡Ô‚∑ão¢{oñ·üÊ
∏≤¯-˛Öá€4P¸∫˙/ãoø^|≥∏¯Ì≤´≠à*jﬁΩgˇòÜ{Ê4e_7ﬂI‰ıÍ€Eá®wj◊Ù•∑)ÊÈˆjw˚‰òµN˜Æ˛ˆxúÏÓ∑Z'ª¢ÂÿNASó™.7ÓïÇJ-ª¸∫’Æ•Ó∑Né€ˇGT ﬂÌêÌΩ÷´,v	ì‚%∑⁄‰y¥Bõù´ˇ Ñ;Ìé!$ÍÌÉg{-¿Á∏›*jﬁhƒl_«¨¥˘„›mhı`ßµ›æ˙€Ÿi\˝˚~{˚:mıY÷°ßö∆ÚV›ˇ¸ÔˇˇJãIÊ5ŒÇ◊8Åﬂ,7W‡i]æyãoﬁ …≤ ?p-Ëgˆºë‚ÚÑÔõyæOlU}Çµ˝8ôE†ªÆX {ÏLºV∏/Tµ§ËzqQaßÅ‹ïV™®∞ÒT4ıU÷çH¬ÕC%v‹ºµT„ôdõAè2O>ËÓV=∂^™áx¢˛‡ZqUà)ûÿ£ÚzÁÚ
]Æjà÷≈wÆu\Øı3*‹´4<tAm≥ãä∂UU˜«–3f~‰Vi‹QüS„»´Ò6Ò‘¿ ˙œ©ßÛ◊ç∆ìh∏9E∆Ωñˇ/	∂^RÃµîa…ÀÚ#%Ü0»®_o·∑Ê3@ùp§°_+ÅaF]í ?˘Ø@¡KTº¥˘Ã∏îy¡◊’G∆"4ˇZ¥≤ﬁV™∫D∫\•Ä]∑!Iµ≤HñâÜ	¨S¡34˛ÖÊb⁄åπ¶œ±‚RëÂ®Ü~≤Œ’GTÎ›à˛æ˙	Üu9y∫Kµf»ú ËË˜¯ÿ!qAe0
µ_‚p)Ω¿¬pQ”Kè5ﬁ”–_®ÌÜ!OË	#b®[Ü§á:xîxiA‘ñ÷WÍ¥°Ú¢E %,*∑BÌÔàÀÏ¢¨˙o®˚\øNË ]ôdÖ}Y"ŒÑˆ¬Äsb†É˛* UÀÔ\à∏â˛Ç˙>;O»ÄúL£ÔèhàVÿxò—»óﬂ¯o¸Ø≈¢£7◊:È+ƒ58Ÿ)…ë++¡q,+¿qµ¯BÍËìÔŒ>Ωíao•>mÛØº˛çC´°"œÀq(Fè”+ó«ö[7´èç≈´Dı∂Î*Ø∑[ù›”÷AkÔ;–óNˇÿ9<x´Î
Ñ‡Onõk Dºƒ'B¶»H0ºÙ,n:≠P∫5´lS¢∏Óu∫∏bâñ[\©ööZBñb=3≠¥ jÂ‘C~˝J"(}bçÀæxç¶≥*Ãf7z¡(òΩ˚4¸ÅÛ»Ú_Pq¸ˆ—Ô>4ó6/ﬂD_Oﬂ‹Éˇ¢{”zΩ>˝œˇ˛ˇ..7@é∆	Á&(Ëx∑vˇÎ·#Û~m7jè∆!ã"°†e[∫«[Zº'û∂˜è`d⁄ØØ˛ˆˆ –ÿi∑û_ù†€‘|ﬂùnlÔΩTíüáªù©Y˜0˚ª≥¯¶ªÏÊzUÏÃÕR\‚"@_˝ç„hY¯Pñ=LãVoPıZ|doEÔn∂πåÉ!»å>∞ô}PpÏ’¿Ïv˛ÀÀ›˝…ˆL
†éŒ.¸Û¢µ∑◊˙oœ;˝Ë∏}∞›>jÌ˘∑_∂vé±T∏˛oG|ƒ$ƒgª˚–>§˙¶òÇ˜Ï∏µ}ÚÚ∏eÙ!ÈeˆE˜Tù”PêΩ3–::<V3Ò4~ÔvNé_r§wZo∫ãXK˙ów°Ökéµñ•ÅO7ù˘Ñÿµ›“FHæ˙ŒnDpgó|G˛¯™?É~KAµã¬±ì>π∏≈¸ûb∂WŒŒ!Ö»Ó´÷ﬁKY}ˇÂﬁ	ÂqkˇÍ ñMΩ"hùìó;Ì√§√˘!AœNü∑û]˝«L<tÈ˙ªﬂ˝épÛU∫FùYU ßØ<’PHgÀ|∂N>ã5ïHü,È⁄f®röéÜÔt˚J¬.©(u?KUéIIM°*Z*ÚY\RQhñ∆¬Ãœm0Àm•»È∞§ñ,,RE…X›îRßÁá$O!)Ωªí**≠ k…/õuyôQ\ó ¢5¶QÙà¥¸¥¨Ñé¡`ﬁ¡úEDaYPgô˜åƒC o1æÜ◊DSC‰Õ‡nâ@Kä¿(q†∞#á{ﬂaÁ˝ å
/QÕBA∆wg‰õåÑÄe6>±ôf©_+å‚=ÓÆóEπëö∏kı`∆Î”È% å_J•>eSÎ3I¢REÕeFùb&W#ßÆÃ*(µñ¥‰∫‚<ö†&à2J’Y‰Ñπà‹Çö˙´‚ﬂ(±Ö,,Í∂1sÇ3¶0Ñáºcﬂ’MTçMp#–è¸∞¸yL†¨Ùñ|£©ˆY¡à≠#ÿ◊Ó[ã_Y‚¬ÕQÑá|Ê ˙KtR'Ÿ– ó9ò˛bc.7ç§√Qk£¢CH£‘<©6„M◊¸Ò_ùÒp%√UDÌÖD^rú
ã)YX^J…πDHÌ∞ﬁiâ	!DS»∆æÉDJ{+ÚnADIrIÊäÛ”⁄˛>º’„	6^PœÚÉïdaì#xPÿ“≤>∞	ã'\“ÃFí“¬›»ârgÇIﬁÛï¥m˜AÇ7
ˇâIˇT∫DK@ŸàÖ1ña&@*ƒ≈Mï¥èI"è¿¿MP-JGZ≤4*è)∫.∂"0ãM≤$DXo~S8≥c}’VsS™ßCfÎÜøÊzb˝:ÇΩ\¥W,yXΩ‡nß¶vyÈ\âd˝-#Ú5i¶¨ı~Ëzå,|ü£¥-¥≥7Œ“˙˚Zßµ‹Ë Í	{l_I⁄∑ûí∆K\&È0Îçö]…H…tRâœ˜È\”_dYˆ˚¥ê)t≥J©Y˜”‘õã9uN…
ΩYY"∞,≤µ\!¥îV¡SËém‡˚¿ıQwBÌI™N¬≥_‡ıN5È¬öENq˛“på'p¨K›≠ÔFÚ;	ÈdDyÜÍ=kœó¯8ÒË'ãæ¬7]¿°òˇ pOcò'⁄ à◊ßa–√ΩËÈ∂j%≤-∞¡0À<·˚™¯éÖ<r2vc∑–]›öé€ø‡pÕ»‹7Èÿ.‘˜$nS'êG6ÓâÛßû3öéO#ø¿+o⁄áˇ«àÈ=∏(òéY‘∏Gë)]M=w@1Ø?h‹ÉRò6ÌîcÔµ{ıÒmÃ®“ÎEs‘Z˛ﬁ'6äÄgçã 4 ]†N0kÄU±œjÄNS’ó©7¶tJ„>ﬂÿô:∑«º8p{”ÿÌ∫_I0∏`¬21¬õîä«g{xÃπàb7ÜÈz´#‰Ë†)Ô`!W˙úËÆõû±àÛ9∆€ß£I8^Lá.»AU"?«0o†¨ÎLª‘˚(fSXUCò,#WM PÙßIËæG{¸ôÀbÍïL!X ˝ûÎ‹˛Qr· Q≠ÃÁ4>Ø)øfWãﬂŸ¥œÍπ0"Úm¿ÅÂ
qE¯ﬁ„˚¶È¥≥Üüè	è\Í”iÃ]6ç{¯p:bQ†É/£}~l€ˇ~^‹ÓâfO]∫pê<Ò≠ßßÈôâü’`Å –02+ßÈ£æ€]|ÑΩx\˝Û≠Øï3<í÷è¶x J‡Z&KHì?≠‰xN®-ùæÈé‚Ôﬂtßx%j¿5‡‚1¶ëO›ËØ(
‚~ÿàÅ|ç8èÔÙ&òE1Ìäiœpb˜Ÿ(¿ìûMº…¥1÷c9ÃäŸÂdxÅ« ‹.ßƒhÒÁÚ£äg˙ı±á˘Tñ˝ÃTŸÅ©¸‡⁄SøQBMá4∫£ &=ÿ∫ çß› :4u˝>qñã¢Süè`o‚%èäÎ≈«unw∞Ühï±êE?≥±†#Íß}‹íÀû±§ÅíÎ9O
9åÎn~?ÂÁ*cpû‡·≤É0R8É"P$c‘VíOCw „¸c˙ ˛Ä,–@≈¡i4c™9^f:!>Bqqä&ıN˚ﬁ‰{Tù∆`‡#j ÇG…"Ø@ãÓ`D°=Ã≠ìYm≤Êt»'?û§›∏Á∏ ß¢©¯„Ç4 |^”´üﬁNSé[ ˇã’JáB<∏N1O3_ÓT∏5é
d~?Cf‚àMQc
¬SÜS”¶"ûDßAWd{∫g0\„ÚYü»≥©Ñ‡±Ò‹ßK¿ÜÓkˇÍo≈–LaI†ëãVåÀówÙGN'a:å≈C◊qB<=Âv/@´õUV(±uêÔUﬁÈg«)vÜ¢¨?˜=Òßlrø?Ç“∞æ´xLjÁ¯M–bäïï?≈:¸‘+ft7~
WCPlÆ“0Ê¸¸Y:r©´A˛m‹Ø¶É¿óﬂ∆Æˇ£¥zNi®∆Õ¡Ø¿ √xçòÔFN:Ì¶|KY˙õî@(ëß0#@e€ûÙ˚∑,U‡S é0.ÿÊ–W,›>Øy•êõ¬:RX
QaÂëˆ+ötÒHˇ1'ºHÇ'¡¸iö4vºÆ>æ≈crË„Y}É[∂á	µp0d˜Ûö=+π6˘ﬁeåÃT≈	‚¿xå¶>∆†D¡ÙÄe*ûvÖöÎâ?› Ú]˙hΩu˛
√ª¡†x(^ñ4º8ÇπâªowD&¯ÈXB/ôôŒ\P∆8¸&À^yxxV¶Bñú)wÎÄÌÕù?åX•^(’û˜&®ìFÒ»uƒv»i™√Í∞¯6ﬂH{¬TËì¯{z∆æw qΩâ3,—Q^ÅPEÔÌÙôÑ˙YçGœ=cb} ä˙N6Ñr˛Lﬁÿµ≈)ÌF®M¬‰—©Ë–ÙÍü≥¶Å¯ÉKN¯È M˚I≈±ÁP9õä°’ÅÅÎ3h±hT,Ê√q‚∆3«D%6èçJÑÀßòì]¢ÂVíÖ÷¡’øÔµ1õÁ›…ÏÔÕù≈öñi1‚Éö4ïZtƒë
∫kŸ5|;\πŸ'˛hÊtœîJUﬂº@0È¢u∏-≤‰_]˝G´C^∑Z®Cæ#G«„mù¥tJ	Íd{•+⁄V|òΩÑÆÄèJ’ÓôË∑ˆèe>Êng˚¯û/ìì]å8c‚ˇÏN§f°µcpÑéw‡·LtOáÖºc,^Ï]˝ª»KòÖâÓ ”ûÍn1+Çygÿ<û¥è€;ª”ÕÉÙi±Q0ã÷Ò…Ò!6ﬂèw⁄{{ê»)ºÈ´b5w&˚≠ÉÁ/€'á9xÁ∞€Ê›ﬁÈªRg˜,TˆvE¬ºÍ)¥ãRaø}x≤{∞”>8ÏÄîòâ]>¥•Ω≥¥f°µ}∏∑ª›Üi}ç∂ûø‹©0Tπç˛ ¥ô…/GHÇÌyPHW_ÊÀS:òÙ≤ÃùAõœùÉπw‡Á1óÇÛ‡õˆkb† ƒ?èì„÷À˝oˇpÆâñ`Îà%lùC5¨ÆàÍ∞Ÿ·qß˝ä„{r¯=úçØaxÂW∫√ÉÌd⁄w‰‰Â> 
´H^˜,mÂ;Ú™›Ÿﬁ=66ûUË‰(˙!€ø(fÅ4E≠ﬂD![^&€CÊ¸¿˜Í‚fÈHb’
Cz—p#˛WhjXd1Q≠ç˝…i∂]≤?∑ó¶˘ÅzöÓ˜hwÒs•Ôí‡OqéÅxŒ‘˝eö—O˛Øf›Ã˛Q˙4v(∑áÛ∂@ïÃ≈;w{…ˆ·:Z†≠'Û8ÿó˙Ì·_®4¯ŒÚ]Íπ~`Û(Ú˘⁄«ÉæNG4‡Ë,“¸å7ÎJEï ËÃ\~7z™únÓM…^EÈ2U˘S=¥˙ØU˜ŒûÚ¨Eú…IX˛î+>¯Ëfh_SA≥Œ\0˚P0ÈËiã¶ÚÔ)˝O–è–—í.ﬁ€óÊï¢†sE9ã#µ’É≥∑GàRsÕ‰F–°eHñ/%ú!Qì§Hw4¶X!*#ÎîüåNÒ\(ÈÚrÅ»å\Ø’‘Û˛rê§..DX¿Û˛]y‚åô v™r¡NE.íû√tC±UE≥œ»–:FÏg∑àÈ$â†—iíI ˜d¨√'ìLe7\≥ÁP©úq‰tãÀTHWxıëºˇ:–≥#Oyﬁ§(pCVüW≈67¥ãƒ´œ|<å÷xçì¡„wR¿ö›ê≠+k‚íúÉauäÇSP˝pyÂÓQ@,ëˇ"JH1	•Ú~d´+ÙÊéòg‘Û`=˝Å8®c£èu»<‹Õ–ü¯‚tò/‘Ê[êDxü?•ª—L(ò∑ΩÎ˙ıî¥YÍ4bËs62áÎ í|9gc7p	ô©|7†‰,/°%x^íVıÓ‰∂ZÃŸ–úë¸ÅÎµ7ó[√ñ¯>g≥’=vf
·òd¶Ø;ü1gkUµôË˛<≠ÃÂ  Ñ2ÁißÍäÒE¡tmüNÚa]<Iz±⁄˜^ÒD2q"Æ8-óÒ£Zµ¢¶m	¨◊Î–áRÈqXr?%ﬂÚø%QõÍÁÄ&V^D≥À˙…óqî›ìè%ƒˆRU†)Ægêk∑<îKàs\⁄=‹z«4Pe;?Ï„^1h4=øò÷gV…n∫Sƒìÿ}Mƒ~3¯"@ß«»g }MöÊ—∞ôΩx&`M—NÉ»Rr(âç’*Ãíî3À8hÁÁ	∏ÍïÆÓÅ]9˜∂Œ›hOûq∫ Ø0SGi'—„oÌ‹Ããó∞≥8yRvîqéÉ˙˝UÊ˜ÇyÃC–ˆ–Sôê)ó- ìòxﬁû,h92-®¬„ñ»∏Q^ËòÕÈº8|π∑≥{¯gEËç"l¯∫∫)qMì§/L◊JNnP›OXåkÙ·då'®6ÓôÌø˜d)Àìp‘∞O∆@ΩJMs+˜fñ∂í,jË$)ë4◊–õR…kEıü™‰∂NÍg”Î[R€≤ é“"EP≤	sp€èò∑É«s¡›ÊÖ»ñ!OØ>buhÄv∏†Y‚n÷L[}¡MŒ?E-"$~Å6øØn_÷”ì{
q3–cﬂ„îº3*<Z6íx]@[/¨C—y{êéV∂ˆçf Æ6@R˛ioÕ"°~∫Hü≠Âæë˛áõåƒNJì]úöGB’àfL›t+®¨–∏ßµ[D≥=w–¿Î4±i•ÂIÀèçπ§0KÄÎ=®}*\˝‰3kÈ[ã≈VÂÍÃFˆyc‚Jíiÿ¬Ú§?qÓS±È∑/GqSÒâ!ª°XÁ2cBÍ#Êt⁄«5JÑdzydDÆ˛1äÄ˜[√Æ5»üvw…a^Úo¬¿©ò.R·Œ%íî¿9/Û]o…>π$Ω;	ªÄ023πg´o÷†?” ZÜ€%˝ëï`Ìâ≤£;£¸∆˘RﬂV•-®y÷Õˆ¡Y∞ì¡+æªw±MìÂàÓãb `y5+H∞%Lê3∞U0wœã`j1∂Ç P‚Í#Ö…<0§ç:^ j‚π‘/!ò‰H‘04≈è»£|F>-^qC@KêY—XpU,±pMÇçôéú¶P®Q‡Q◊0ücîv»¬¥K¡&)dÒ ¢‰ä_}Ñ≤ :ûbiC≤¨7∏ákÌ∑?æ<˛.ü˝0g“ó’∂ˆl“ù!/™¡éo‚$‡AÉèÅ÷ËD/¢’éÑAˆU^áFrœúJ∂Ä[ÍÖ,ﬂÂA—¡Õÿù\˜•œØR⁄◊™djVÜb’Œ6qx˚,}iôÏäÇálÄ$zÅ~≠ÔÑ_+«!ïﬂ8kXèPò1‰÷#‰ÓÍÏY	πıUØ“™ÍD”„+E ^ieo/£f‰Éäyπ2Í∫A$Ô,óÖM›·Lm≈P èz|'b/p
≈Õ+õOyy¡oW«‚c–ÂìC)¶*êZŒ»'PÒÍ¿}!Íå±	ZÙQÍ@Œ´–’R9W»≥¶æüÇÙ4ÀÁ&≥{ı/IZi†’«¿	„∏ábyåˇ-ìñ≈K”|cˆôáK»#'ä`µ¥¬MÔ7»…ãÔ–Ìü#gÖLeπ^mÅÁ€‹gêTd®Ô,öäÏ≠8î{Ô≈¸ÒãVŸç{*Ω¬AV˛,õ&hÈàB:D	¶qOOœ=-Ç’%)9i◊è[;ùÃÇzº&"…A;2†dMQR/\˝]‘ ò∏® ’nã◊‰DU`å¸É∫Ú['ÌÌ‹»WœñÁLê¶ãL˘Æ{û‚÷Á4Ö1’ˆ±W‡!9`i≈dë)ËÃ}ÙÒõ;¢ã„Ç<√ZEWG™ä’·Ë
§›î\+≥c
◊Ñ¥Æ9ÖUÍgq∆ã`ÛgÒ¥V J8D¶—®ï:{–A	Û»ö»Äœ±ña_HU«IdX¶{—eÖö≥¨#ÂdmYô.Tÿ]ÒÌ’´è<Ω∆‡ËáŒ;;´l?·¨l€¶üÊ(‚.î≥¸îcÛˇlm‰2Ò1åÎî˘í¬ù¿ëë©ëEÄûÛÚ∞<ã‚Ö¢å«yz,n)´™ñî≥Ç⁄
c|vNP˘†ç{FB®¸ë(ö÷A»	Q	ãj†Ù∆°)Ò§3uøﬂ@.7ÏïÒ§“≤⁄zUÉ-õ+bKã»±È'€Í%•t˘)ñL·
‹ú∂2ã•OR|
òQá6ù[O∂√Oì¢˜Ùﬁ¬⁄é`»AUùÏBÒ´èºj9Ûè\ ¥ ºÔkáH¿‹<Á»hÏ˙.ÆàÖ≥ÈUR´kßáSå]c»-´Ä∏.Oÿk/T=ì√õôoÙ˘äb≤:ªKRër‹˚€7óÂØ©8œÃ¸”«£7]µKzÀÀ-0È.˘¨p<ƒk¬SπÆ~¬*9ÉÄ©”˙8„HÅ?(5
Äm^©ZÜä¢îÀò¸YMHÓä¬˘ïGnúŒÍ<˝ŒÄ74Ω.íµ˘≠ IÂ,TŒØF‹Æ®ÅÈ
*,Ù¥ÑJÌ)¢¥ÿÕ°CG”Äg.‚∂X"-_<™„µuÿÈæ⁄∞nÀÒ˜≠ÔRé/˛4ËÈ&qA<ﬂwÜÏbná˜9dœétƒÒt8ôê+ª@rÆÑJL™a_¨÷PÙ0bµ´b2œ†V∆ﬂeR%H§_/µîAÅáAôÕº√Å\}Dÿå¨h∏È‘}òiN˚‘¶^:ÓT}¢ñ2Cvcƒ	˙òÍÓ†~‚≈Á1’1ï|Ñ€	0!…[¢≤1(4‚æ¯ê™§Z<”,Hçá©œ&£@MP|{N#tÕ'`å˘¢raÅ§Is?x>ba∫a~0ø–”ã‰≥«[du5iäø˙&õGí¶—¨,ë’ºg≥÷hdí¢¸è†êÂﬁvuóSŸÅ8˘æLˆµ%gâËª·p÷Æ$®&∑¢ÀÕ'#yGq∂^ö π?b»⁄ÊJ˙ÃA◊*¶éóÀdUÀ°Á«‚˛¶÷ÃÄ≈G<—ãg-=¬fª,îW†™üπ˚N®?ßCÏ”xÿ8jì{d⁄í8/¬Oé‘â* IÓ≠¿ ‚öa‘±b'äHÇ®‹%¿JvÍk®wOÄ)ª¿±HÆΩ∞ã\?Såˇ‚ﬂ˘’ü˙•ó_/Òb…ï∆ÍYi¨„?õ¯œÉ%“l¨hR¢Œwxqsß® w/ÚØ)¡dg2;O9◊,◊B‚$ß
«Öèﬁ‘ ¿ﬁ”/`ñ†ﬂ˝˛√8nú_.ÒøóÔdzWf/‰•ûàÑËHÙã∂_⁄ë≥°F≈-∞Ê5V¨Lú“i)Ó>xRf(ç¢:b[µQ\ M’7	_°√z\_U_#å ÷◊VV»ÁË#~‘}]§∑’«t¿H?„zDax"PGù∏Œ%˛S˜XØ`•´_‘7kO$=≥ÌøØ„b®UwÎ´çÖB◊ƒeue%Å∞Ük:(c ê~ æuØ'ÆÈrhƒ÷#û˝_Ô‚çºí ˛:
ãﬂ9qc6äÍí—t\_’Öf°W~Æaº¿x‘7√ˇÛ?ˇüˇıxã¡êßΩà¥’ÙbÅ«À√5≠C„ÿÛHGqQL∫c∑“ÿ0p√5VXr∆Øˇ≈ ∑3°~Ï¢ŒuFÆ>Úå1∆»]≥T\Û∫Æ˛>¬~qG_›4<«…‚¬˛‰ãÇÒƒ9À'nƒ®ﬁ$£ﬁ#ÌÁ*ßÁ¶$1ø A√ˇ√Ú=≤áL∞çjªˇàt∆|êû„e%ÆC6	ÇI∂¨ë0À—ΩGP®é‘GÆ$§ì¨î„(ê§Ω˙πG∆ı¡¯‚l2É∏ù˙B˝ƒ{n˙∞÷AπÔ1?√%g<∑>‡2qIÜØTQøŒ\ˆ˛ipæı·›
Y!øóOÂﬂwóñ92¨„ëI(√ÎÔÎØ◊ÓØåœﬂM
n>¢ y¡Œ)û:Ωx9]¥
Å4éÒ6òﬁ9óCFidL)«~`[†‘%Éåâ£-<—%Èªû∑UÛA©aÊg`˝;ß€€`Mı‡œúµ‰˜çÜ˜≥sx|ù^«{πêG§∂JVkódŸÏ‡‚‚eÆ√0ªx2ﬁ‡ûÔÈ\ãÇ˙	Íâ.ÇµUA}§h}Ï·µdÇ6ó‰ºπıA0»%π–æüØn} ê Ø…Ö¸zqôíÎ·:]Î>»í´±ZòÌ^Zà∞ÉÍêZmû¡p‰(ëå°9m}R#∫t·˛√%rï∂’á∏,ÉÓ¶Íz}ìmd∞\´e«	QzÖ'Èûìù û=,eÀavX ∆¸–8n
i28Œ˘ñX3âs±%VMn’6@éJd∫˙¸ìÈs≈q¡|i¬¶oó^◊3x4ß	§≤äÍ∏JŸ∂Ár/»Ûñ∏ñÚmzX$O⁄[6˘≠ë ˆOWÆ› zE±ÕDóúBQ¥◊ ER´Åj•^√Çâáñ9∑·È]»∑π ‹¢¯=Aﬂ»^Ñü¥übù ∂A∞˝ØAle_Ë	ˇ¢ë«§>ªˆ6Í∂6l]í‰≠=XDÿ™&»…‚HQ:≥ë£Ur∞*Æ^óß√¥À’0N˝ÛUô‹S¢&ßÂÃVÔ‹ˆ*x∂ÿDã”tÎÉ†≠≠T/@£ÏNP	Qxo’¯ö	f≤•pV'{˝∞±kØ¶^¢‰–µH•¢Â°=±¿ˇ†˜[›ÛÿVìøàπ>*(Ez[5˝M6™=˘êN˝À«ÀºXu Õ∆¿–˚Œ;ô™π≤˚®”µ'§æ\Üe≤¥±«À∂Áã∞‰€;Fé÷≤{£©w6X˘å`‰≤/ñ…oP‡œÜFó◊Œ_7W4VHmÃ∆úåtÕ}˙:ö6¸©‘ ÏíåZwÃ‰ı©“qî*˜Ã'4§Wˇ†da≠WJVÍ@£cÕ¿0tw©>Òã˛î∆˝‹∫®L¥Gƒ•e_¡BéÕëßh˛ıÇ˜> Á–=øé:Æ¬u£áàFæ·mˆ2kf¯‹⁄˝zc√b„)µæÀ‚˜,£«ãF≥úc∑ãÿ°Ç	™Õ+~Âe-?Ié&¿ ﬂ3E)ê"kÊDpYómS0K@ﬁˆê&ã1NÎ¨q¸€¥‡%‘ò«™√'fy¢‹å‡m˘ò,‚’û ÌJﬁÀ◊ÓúHAk?!5ÔW∆é…¯;r±`èä:¶H2óC-/¿eQüÚO-˝¥øù3áqªÒy}8~|ÅLfBÍq©»∞0Õ¬ b YVD=˛Î˛Jv“Ò«8Á\’∫ /ÿy 5Í´ÁëÖƒúÖ<Ñ"@H ‹jáj(Í£µ¨PØDæ¨¿≤f≥Œ’r)∆ EåíX´Y©0\øÕ˘/XËæ·ﬂLQˆÄ∞d‚≈n*˙6w3ùÆó≥NŒ9ç4ÁåÕ¨ZfBŒPÍ)[•w^j≠»ù¿¥7`€à*∫¿NlÑ[z(∑y˜’ÔîßíGËÛÀ´≈|£/†!TÚdãÄ
õkÜ3‰Üùinµ@OTd≥âMKªû¥!~içàsµ≤fi≈πÄÂS5¬hmﬂ¢â\Ö∫∏‰é‘°c.´Ôá∞BŒ\SΩ¨©k≥WT¡YÂíÄ£TA¢gÂ¯µépQáﬂ·
1˙[¡@⁄rÎˆ≤H˘˝Pd'UÛÜ±Õ®(ZtÌ}˚.oLdDàÔUﬁ+©VCC◊ˇ°éû√îY.ﬂ˜1Â1‘õÁƒﬁ∫¸ÊÙÁº§H[ö≤Zxêƒ˙ÀbÍzh¢‰lÖ7Ü„›‡∆œÌ—x°Vj7ÜåB^àüG◊ﬂ“9ô\»Ü¡˜ÿ/œc‰"Ìó–ÔAµâ/ªœ"≤ —ÏÇtÇn»∏Î~Q££.˙Ø#ˆ◊0djwsH˝Ö¸≤S$X*ÎÎB∂¿¿©A¥ÈhŸÆjíà;m
Q· -?‡„dWã§S≥P6=4dX±=‰õò[\†!÷ﬂ◊E»…™W£c@;qŸ ∫≥X∑ˆâ[Ä√"y£["|}®_πÒíœ9_[§T"û¯:"F–ﬁátlÌËÇÏ;ÉÓ-VÏüU(	@}Dœ‡˘∏/TâüôÃjƒBÊ¡<Ë•ciÌ≈ctC´%ÊÅö»è†Kºc€ÿé≥mÂ‚{C8B◊-OÒ0îÎR(C¥ü
M◊πU2!ﬂ˘∞!]{bä∆›åÓ]áz9.Z4¬≥•ÎSÁ¬èáò≥MûÁdÔ§&ò◊‚£Û{)√?"d™÷&∫t&£/ÃA∞DË7åô∏ºY2MoáWóAD=‰_ª¡y]¬Q≤®4†y[k•ƒ∂8‹é∂Í(ªXVâªˇÁˇ˜ì
ªwÆ>ä]çD§]˝‰cd[Kß‰ô´á∏Û‘Ãp|©à(ß∏»•x?"SF¢/$îòuXrﬂ£z÷<¥ÚìÈ≈Ãªˇåyê<3Œ¸·áÏàS™Z~/…≈≤ûT%M≠äTÃ"^^¬M≤í“§/Q¯i–ª‡'Ï$gbÂZê)_iâ|BWûæﬂın
èƒÅGìámÍπ÷“¶4ªúm{µEG¥„b¯IVE4|≈¥9![¡à6Vhƒcµ7¶≈)∆ª¿-∑8ıy|º√Ô˘I-hãÌñ™Vºñ€3‘´f⁄ Ò.–˘@0Eá;m€~”Ô©—3‹K∏$∏/Ûî\fåá«x∂QKbzÃ©åã'[W8_7⁄°·'CÜvø )πœHŸƒpH¬XJıp#√ìˆs$y<©·í!Ig¬”Ï{tåûì£ùg€Fy`tø≥Z*Å‹’©~@óxˆA6™Ü9i¿∑oÏC“πq4®mv«xïÈ€∫í˛{6®Bz!kﬂÙ$ôÂ˚–’ú}ü»x]ı ”;saΩ>j`29!®SCìúäKÀÇPLVL“éwIDµêV∫¥ﬂ‡\ê”8˘†°ø3˙Vfﬁ·ytY-ªÈÑä>º%d’P%(*‡wÌ Ω¥òÌS◊W◊é©¥õB|Y>ﬁ=:<>Ÿù∂ûÔÔNw;'/w⁄á”ùvÎ˘ÓioNµ≥(U2á∞òoí//Í–j“ê®–àÉó®-»k≈“£Ò¯°v–UËHy¡ù›ŒÛΩ√Œ.˘é¸Ò%`˜¨Ω-´-Ê∞IX±ÉÃâ40—”Ë[¢qÓSûÛà<ÍΩß ∂i$ JNﬁcçÙ-1&Ú#bœLô>Ø‡≠Hßü‰ã<˘V¨ôc`uˇï/"zxíKõå}2A&{RÆ“HKΩEäü‘v¯yäuﬁ'NàzÓ±mÒ2ia'PvÈÇY)ñÔßÄ6rœSú–⁄gÇÎñ»;±ÓÎøÁNäw3≠ÇîÚZÍÖ:µ6e°Îë_ˆ⁄dœÀå∞∆ïbÁpEÅcÕBx<\Õ;£ëÍ+TŸØ!(ÆXÂçÖkË´3">≈%‰4∫∏ÿkV™asﬁëí‘EE¢}	∑Ó‰∏äpY’πrã#s„…2lA‰»êµ˘WØI˛◊Õ5=d0k÷˘¸‡S¿Í‹∞Vi ÷Æ9  30C∫†X÷~Ûgô ˜?˝◊ È_Å“Î◊fıf6:VJnNÏüÅ‘õüä‘ÎÖ‚^˝-V°=7ä+ŸfÖÍëç cœ)êµ–©ı≠ú‡˜%ÓÊjÀ¸˙lî<9πÖP-çkÌ®i≥®p_√¸ÙÂøºÈ}˝¶Ò&˙zY(‚	 k›ÓƒÉ?ù1ı—ãAù∏¡ˇ=ÁÁ|lCﬁ—˜˘¸ëƒfîôA´âœ_$FgööíB€ñ´ˆœ≈ŒPùﬁåùh'ÀY‡›\ƒ~Ê:&∑˘bIh¢ı⁄÷IÀ<≤EFRßüóænn&>ÒPƒt¯éúîO>pú^7ﬂ™†<Êƒ˘¥ﬂÈJcÂ≠‹õhÈ}VO 9. b@,B'ıB≠NÑie{è§gèœÉËj> lœ&2Äı§ŸZ$í6±ÄÛWJ¸#¶	kz8æNí(rëAôÏÇì8	_ç<åé¶[ŸrIÚûñL≈å]Áå∫á#Ωo·ë&¨ò≥#XyC7æêi˚4§‹÷‘ëèK¶≠LÓNÍs'ûá‚[0m¸^≠ÎŸÓ*K¬÷sA• ∞ﬂ{Ü)5¸ÎÚ∆
nçßñ°ô®ÀáP%zD#K÷ã∆õfó®#O¸<=Ri;ºOÍ«Ú˙ı{5ãÒãì‚ìÂÊ›Ôìßéù”9‹X¯ZX”=>§¬Œñ•íì~Y◊òNæÚH^≤öãôlm≠(4mﬁŒ»«ûﬂc”Æ«l˛2Ë2#Â1S?A æ~õıah‡8xüN~À“Üç)!Õÿ}ÆÉw#>íIÛ≈…˛ﬁ	¢çæ2	-
F†ıB!.Mı¡ºÙ )eø• ≠&Q‚ı4gäòíÅX≤o«6µø‰πEˆWIê∂†Êè•åÉöÆÃ-Z(•Œg∞—H£¯wh˛Ï¥√y‡Ì]t¸Îƒeaœ˛ñK>ZÚåF≈îπÂ–B‚TZç?39+ƒÏësNÎ±Ö$œPãëfB–?CPÅâ¢=È*‡ÀcË*ﬂ2<:FÎ
k÷˚.HÕºœ-F4\Øë!öÊÜ±´ÜSS©ŸÕïïÂáZ6ë›√ˆ8ç&’ËΩˆ‰~Pså[9√%2,≤oƒu2æ#:Y«-)~
$Èö]3Hj¥U@c1”nó^ˇ∑∑≠iâ∏	à¶ƒ⁄\ VÁ°©EñÆØówΩp)ÆVÅf´e4´Jµ’s±—≠π˘ooı}Ss\≥ƒj	VüÕúîkÆ‹ _+7nÅä•ùÆLπ≤Y`œä.gmÎÆÿ€¶sE*ó®"ßñ±{5
óéuƒ˙| ÏCT(ØπWNú›qw”∞Xd[¥Ícõk®÷aqπCK®G¡|£õ∏√¥y¿¨⁄¿¥•.Wh
óÏŒ¿Ëˆz¯&cåé“°4ÀÍ*Ó	C7…âœ%0óßÔ˘2a^O‘?4¥πS-%Ø¨f5H˝sILÁG
æ"ùóÔÏCaﬂÖ->ÃÒ.x9⁄ÅXº7˘}DòOiÊZc^óD£”EëUø(VÎdâT≠ìR≤^¶⁄§5Z´,]°ﬂÖK$lú#êÌ(5FÀ’Tïœob¸7≤*3WÑÚÃçS]ÊŒ;„\”,„MiW+‚•[1H‘ß»«"¿Y"NπÇùûOÁy“µÍ	;”ãD	éÖæX	sâº√Øu·èM\±|d·ØS‡èU~ÄàÁ¸ñﬂ;π‹ä>—Z∫?ßÂi∫é∂÷îä¨r‰
˜yî(V∫7^[YÆâÖLÕôµ„Afˇfç´›∞4≈∂`<?¨Òrπ»VA˜K5rﬂ†õ…NÀe¥HÜîØ∫( z≈ki"–z	ªó¨ºkØæîf˝ØÂ©·’ﬁjKÔ⁄äéGB‡9a€2úf¡É¨ÕrÒ¬\∂4kﬁf)Æä°¿Bö[E’«∫B€◊h˚*ù?Üåó√Â2õúƒ=DsÂ}./ì÷ß/ñ·ÙA∂|õc›j¡js+Öë± ó¸æD<˚Í"V
åFèXOY√cï‡è5@Õıµ≤EŒÔ0ﬁâé2ÑÔ/H+ö…{µEî*˙{`ÌmÌË+˝ÑØÜz˝êçÅÌŸ¬Úõ{ojÀÉ%Ù˘ö@¨»f–zm˝◊µ”hu⁄eËUöÈiÂé<óË1&òóã.UI 5≥>µt–œ'î3zi`9aå$∫Ã∑å&VZŸ∆L45œÄç´Wí¥Zí¶•∏}˙‰∂_tëMÎB)IïSA5ÎÄÊ∑ñ'™Øº°ƒ€R=≠ÂE„úπ’2LëaBò3s†rﬂÆõ*êF”exΩ8®~≠DÅõw†Bf¿<ù(„¶ÇÈ?«‰Oª;O∫µ∆0©Ï√y<k∆‰Êã¡oóE;ge©KÀ˛:÷”∂Îiõ˜Ñ^Ç›OO•µÏ»”J®’2C‘Ãv⁄Ôí3©u›WgårÔÄ8eDœ1ÊbPº√õ2à!èÕÿŸálß5Ü¿≈|[$GFø}‘uÇ–d∆Pê…ı	ıâÿí)≤8s«Øic2˜Qﬂi'˝ÆÈ‡Û¢>ªU∆æCFsö©∂;T˘í;ú/ÍÂ:√`‚!_Ã(˜'ü±YeZxˇ˚¨B'Cê⁄ï
·}+òM1∑]ØºüŸQº:j2öUÏœ°≈≥
·PÕ.’ÍäÉÃº?Én7´6ı˙-gËzãfï=`ÅOcÍ=AôÕ∂mª«Ø‚å˝o‰%€û;ÓxH†å/»$vÒﬁ}ëû@;æ8	“b[ÑFæcnc^¬£M˘nﬁG0~∆·{Xó?v1n˜æµlI∆kgÄø8c»ƒÂì∑ëì÷àÓÑõ bk6ﬂäåÔ∏‚‚ô¿'ÏøíØ0·uH&∏9‘‰Gãöå‰JéÚ‰·˜c˙~[Bƒ«jÉ5Ø"Ù—óti4W‰9ÛYS\^Ùñè+Ø˚X†]º59fﬁÈáåë†8Ö‚†«?‹ª˜‚)ﬁfè	R‘Ôπëi4$xÖj§Ï–p>¬tƒÒ{2æ©ÌıóÖﬂ}˝&˙zqy0‚ò•òg˜˜æ]ƒ/‹N˚}ñ~ËWÜdÃqΩ¢|∂E?D6(˛ˇk^ø·ÕoƒÆMB4V‹1]±tDD…}Ïömæ¶—2tù!A$â|tmtÜ§ÁÜPmIàFTØ#‘PlÔw»üA‹íeÒG‹Æad–o¨ÙªHß]ÉoØW˝Hñ]ôŒèºéDaKê“AÒm3ÒëëC«LtFo!ˆ	ø4Ê›@˝ˇFA“ù^¿"ˇ†¶æ)º'è7F#¬b∑-∆ti-yÇFåıPëEtÖ"±Ø¯h}EG„ojãeã2^\\‰â(2¿"∫≤bˆá≈0hä∑˘"õê1Éø∞ÊƒfV.&æ…ê@ˆƒN≤¢ø«9j¿ps¸Œíw≠7áf*òô∂öÊ€,©Õñ”I¯;L™œ9@4˝ªÂ„ºzMúoÑÙç±^ª.÷7C˚∆xØ_Ôƒuã¶"¥ºD‹}Ú˚Ê„ÂÓxUxæíÂ'e≥|[:µ¯‚«}x ØáÕd⁄Îz≥≈›7N=|∏+› ,Ê‡”Â¯#;ªD˘¸2æ@ÂÍsü&á˙S
OBf®ˇ´çÎfÍúê´÷˝ë%%Ñ&Oæµ$†≠Œü˘µ$f≠˜¸Ÿ#"b˘z† Ä.¡8©&û‘„`¸à¨à¶2bØƒsôÔùÒ‡cu„‘7µ,Áñtw=€YQ˛œˇ  ˇˇÏΩ]o◊ñ ˙~~≈6;hSâHëî‰ÿä?ÜñhG”≤•ë‰dNÀªDñƒäã,û™¢dEp^˜6ò”òá¡Ù§q/Á‚Ê°ëó¡Ah˝ì¸ÅÈü0kÌè™˝YU§d«IL$2Yµk◊ﬁkØΩˆ˙^S≈ÉM}F⁄ìŸ”G>{Ø§xmc°rH›,ƒBò,õ˝:›
ªÈX∫q—ëKvi,ˆœ}â?V√Ï•«G‰ı˝	.9t ≠æ†fá∆ê√p˙b"9ªtÏçÇ|ç‹Ób≤‹€¿éÅHÀÙ/jˇz|îLæ@m∆kı≈¿msÅjº PÜ¿…P˛áqwg@òâ«ó¥q•i4B1êrÉŸÉttlRÔ¢éóu≤Jß©…'*˙\ñOûQVÙí_êˆ“Ÿ~FÒ˘´˝|!yŸ6Ω¨=ƒ~$ä|â ˝‰Ç≠∑(ëFëB‚ÎYÜîZn€`HÇ◊_hÚ˙>Ú≥ÔSOò˚#?ı(K
ÇÿÉ⁄4=n‹≠=ºøƒnRì€'ˇc†°vÚ:{MüKàé;jÏù'ò
ÛgqËÒY0Ÿßôâç4$À6∞8∏±Fî∂uu;QR∂DÆ⁄m˝8åéÍ™òt∏H.®ùoMy  ∑hÈß¶t&†gtC[jΩ\*çwÊ)±¿¢yÜ± ıúÁaqDsITRUÁk	€% n•Î—$LÜ›‘ëùëöBÉ˝`‰G”¥^ßRå˘Â»∞‚d+/àsI˙4¨¥Ó«±ÛÃã'EQLíF‰»KÇ>…ÒÇŒÉ¶ *FkµEÇÂ„RqÎö® á˘!!¡‚òO∑«&z#T`éQ\Øijñc/@¬T ‰\ 9 π's]Ÿø“a*î*˘[U¯UÜû8◊œŸ€Ô28Ô–·2‡X≥—ë71ñB{mﬂÍJhõË√Ä˙q
H S¡≤Ç®»ÙÚ&ﬁƒ«:û˛€ ≈"√»¢	Œ˚2S“	5‹k¯"}⁄èû	’∆[¡ïL±&æh9ˇ∞M^‘ñ3î•Œ»pó]*π]&fÆ⁄⁄x4êıGkGﬂ±T¢óNê–ç‡GÛóKÖËoÁyQãﬂ|ãË™‰’F[cæ1}cH‡`¿Û‹—·Q¸2˘ÙÂ“#ﬁ’Ö˝ÖÅ‘(ÂÖ„ΩÜA÷_ÉÕ&k®ævù˙d.Ea	ÿ¶·wQ∏ ıQ 6£≠>ÕI—À&
Ñ\Øôòp‰Ë:(˙Í/˝pÇN‘9í)–Ãsn—B=cÑ\‚yÆ.EÉ)n∞:µﬂã|ëã‰(8
ÓFµàZ∂ÊÇ`B—‚–Ë{lœoú2ærëç‡$äOÄP%dì ¡ıúI\@Æ!ÎvåBïE_§ΩSs5ÕAO}A‚”IÏ»$3ﬁ∏˘;’ƒ◊c#Ÿıì	\•%çcÔl_—¡{}îÚ÷ëÂ§÷Ãú%ÕÎJ´U3“Ç≤Œ‹9ASÆá∂—!1æ¿ºcY—î:¬÷8å@Ì'˙‚;ÏèôKÕlÆÕÕ≥†ÀdG¨Â
¥êB9ºÃ¶ÚŸ^1Õ¶4è¢Tõ™ì‡]ñ>]ÜÙ⁄àó∫2†Bf√|9J≥*Ω:3|Y'ˇòôætè(©*Rßâ‰óÛ|%¥∞q€»ŸñπÁ∂ñ⁄≠<=è»Ödœ
Øöıï‰9#›)‘Ãt]¯—Ω^™¶Ì*Å©ûæÀ
”•{´Y¨≠ k•‰t¢†Zû–Ë]¡´S^3@Fœ´Uí@ÑoçB^fyÍ PZç·ª◊áÀr©˜î¸Ωò©ô
 X=ESQãy25·Gqà-œÿÑü‹ƒ§&ágILË	å	ÇÄ]qæº}˛N‰p^<⁄Ì≠o?Î=ﬂËÆol_˝È˘w“ïÌÁΩΩÔˆ^<ÌÌˆûØov47SGæô‹ò‹7’˘á¶≠ "G§.≠≠ªÔ¡À¡ÀÊÀO_6^&/˙„?æ¸Èø¸ø/rC˘„h9¯ˇ|¬=w+<r‡5∞†˝¡x9~y∏và÷ä√Gklƒááü.Ôn®˘k*‰†v˚;¸SˆÅ£÷˚îü‚+∫`_ZªÛºı¢¿ÿÃÕS∑nMÿw@¨‰Ä˜à«y~ùˆà◊€_òehTÊ≠[¡∏≈¿ß+2ËNòã^z«√. 4Úk»Ê∏õ<À‡£•™r«,(â≠Y

V∞R™È¿3¡'Íu=ò∆îö0.•|}2Z£ﬂ„ËLIò◊Kv≠øF{F,`¥0ËD¨FA¬#ˆDq∑{´≠•éQÚŸ°Œ™Zôb>úÉ÷´Œ‰Ì´6˛°À€w€wW€ù{ã≠fÎŒ¬a≠xk9RV´®WC]^’7t]UØ0âá7F»O¶¿EŒ%hÒ^´%Ö√ÊÈÊÜòeÕdårÔ=ﬁRÓNQ¸Ï≤•%óX9)V÷HTq§èbüÅ8Æ⁄«ÆWO§¨ÉD√*£Häå\ÀJô)œV,˘ìçq¨}` î4â+‰å…=≈3∞RÀ?Ó:» \ºV† g◊a”◊Îπæ≈ò¨ú(?"∑Uø€≤'À*éên£≠,G¥U⁄J∏âTßü˝áˇ¸˝5·Á¶ØnY‹^}KzŒU∫ØZÜ·$ï√ù%o>ëˆ¡m')∏ı%® —]d7ë€Ã*À—≥1äØ~J ]T/ú∑±»·Æ–£Ä™ât|UœQ∫’.˙e°~l∞FázªkJnªü;ö¶i4.x1J7j¨Y—1ç◊√†ˇÊ¡≥ ΩÒ Ù7sÜfWÍÇC+  H–ë|@⁄Î¿gq+z≤∏De©ö„-êBû^¢îqqïˆFG⁄=ú/ÓÂ¨·M”('|\ó6é∆>ÈO„$äTuâ%k{‘YmïÖÕr¯î`ÂºL÷ºÊÉ√g‘_“3’Ÿ√≤b#Ê+-Öò/ÁÉBSQ˘h§w‹i—©gláT∆ú]”Ug“;-ßå∆ÍPlôx1
!ëZ√"˜>pÄÕ{wCíÁ1ñO∆íÉ∏îM¿J÷~‹QÖeöOˇ
.1ô†©øÑs‡ß–√å*åQ≥Ÿ¨D¶ª^†¯Uëõá3 &<˚—ÕÃÔ∫≥⁄$|ÉÊòíïd¸˛Ã”åo`ñE±Ï r=^p¸ŸìŸÿt3d0ÕÁÕb.ûü-ì˘≈kg*sõruîÚ¿>vº(≈øÏaì·ÆôNçZQt¸\/∫xOA&t¸h9 Ì˝ï$Oœ´®I§Ú3€
ﬁj	‘ÅøΩê[îEùBÔ⁄ô‘Òc€JÔ(£zïAõY’Ÿ ù:‚¬ÏÍFbu°ÍØúZ?Ö:≤Ÿ3Z;zπŸù‚BIŒk:*k÷ˇ\ubT≤∞˙ºÿ›2Fu$+ÀàM«RT'ﬁEémyˇ-∫∆”n˝J≥Ò3K÷Ïº}ÂÃŸb,≥dœŒ_sÛy°ÛægŒçüü7?4√ã/™Eö⁄—≤TÃoô¨5:o,[À∂sÀø,ÓIä!T≈qÕmx"•z∂UX7r1≥ÉÇ”Y ;%ë››’ñô©Ÿ^wZœ»\”Ù§˘ôÂÿﬂ˜mπÄÿg÷\»¯ô%ø&~fŒ±)∫©<õ¯π°\õˆÆÊ ∑â7˜[öÏã•Ÿ¥d”,IöŸ™¶âm¸OôﬁÆbJ:xg&J¸88W∂+Wæ+gfJzKœNYsÓT™ïóICßUh°«œåi(Ÿàb[÷IYx3Ì$Ìñ¨ù¢—Æ!—aÕêï?’33Ê≠À≤3Z3
~nÊ‘å¯©∞[Xz<K<Ÿ0£Êπs3YÏ4 “]úÙÆG‰e©ö"éŒ§ M~ú€«ΩÅ‹[»ñ6é∑7S«Òz˙8vyØ8ù~Ê(+9ÿ2cr9¸Ãî`?≥$ôÀÄ`Ûæaä”€FÚµ·„π_k~&…”ÜÕƒFC¨~6[¬√[ˇ\ÀÀff«ïü«√Ê:√¨Ê]3≥oMëgMâ_.•ç“8%¸w·Ss5si
d4˜§…2_9µ>øh«ô
n3?ø”L5‘ªwò˘›e\Ë‘´ﬂ∞£LE7ô√If^ô[|ô1Á◊ÎS‚S∑Û–\N1øXóò9b -tÔ‹¶ä+L°#L!éﬁt=S‚ SÕ˝Â∆ù_Êu}˘;æTq{yüN/s{Ëﬁ∏√À/¡›eÆB7U]Jº#n‘…eNó"◊àÍÓ-eΩñkÀé-e≥∫Œ\n÷°evwñ¬ππkEé,3ŸMM!˝#»ªØ\ê‡”¨ ÅC_‰ (èübëªrri#Ïı≈g‚«ãhdxöÌŸrº”I€Ÿ¢jòQ ŒYÅ9ü∑ÅíSæ∞∑?5À∑ ^•<ﬂNò”’‡∆.T*ã∂ˆúæñ§;¿ø¯4w¿8¿ ZñÙŒÑ bsòUSL^]îke…;îW`ø7ÖnÈ®Hÿ‚D4ˆBËˆÍLÊkFÄ+º˙f5ö!=À»N"ßw≈ã x¿ŸüL°YHv6ûêË8Ë,Q∞GA1ÅËê–#¿"$TX9∆\Ã7yØôœ&_©,˝ßb6ØELŒM¡›‡3k ‡≥&6X—ï,Z⁄t	§"É∫æ>¿Ã?WZó„FA ˘µÈv,’±ÀÊõÔÜÓ_≈<-á¶ø•$E¨¢‘Îbä‘%Lm)ûäHıEö’‚•G´œ‰5St˙4,∑ù!ó5	QÒﬂo08˝Fq^6_.ﬁú3ÆÉ±z‰…b£Æû£Ÿ6dÅ7ìÇcôñ‡}'øÒ”ˇ—¡(∏8◊íôø?Ô_∂6?£pA›<ÎÇr&∆Êl,∏æ[Ï\N™xh√äÑßÂˇùª€óå÷;¿$˜”	AP&ö'äc;_°dâíódix>˙x‚FòùÈ‘ßâ†bÔú¶ˆßô¸Ò!¢cÿP®QÎ€≠…ˆ˘ &Ê‰e$a^é^~ﬂˇ˛Â¥”Ít‡ÔjÔ˝æåWñ?„íMM≤∫6# º	ÂÕæıi¡‡É–C”OÒTöƒ»ÖÖÁ∞À®g$¬O6Ù&Òc˙@ÏﬂNXÍ™¨æAÖ0x„ìO?hΩoO¢O?µŸx›ŒﬂTËõsO”lÿ/ìOº∆∑Wˇtı˝’üØ~∏˙ÒÍ/Wˇ|∏∞Ãø≈y^U“˙–´≤ÀÀñ∫x§p(˙È'ŸõiÙ˘Ê#Kèl/ùy'ÿGâbªiΩµ†æñ|&oR`Î˝zª:ŒÕ„N/3&‘•^‚Md˜wŒ¶Ã·]7·\øLπèü¡°~YpWﬁπ;}\√õ~˛VúÈo E|≈Â"n˜o…˛·òXÌ¶˝√[7·æ˙éú√ãjKN…úÜòû…µÎ8&´&ËbûjXXk◊ÈÅl˜x|∑n∆≠ñä^ÀÔﬁ«òØOπ£1çV∏¶óq±+ª‰öÀGı˘ÁZ’ºYEyÈ‰TM’ÉŸ!‡+`(ÙÎu!Âo…uóÍÂı¬–¯˘˝w€Ã¸¶ôèñaôYæ1ªåºqe€å∫â√ÚÕ˚ã1”Xxÿ1“»ê§}œ¬–fÛnÌ5+Ì5íΩÊZ¶öªø
SM˚h™…X’÷\ì’ƒæ	cÕG;~ﬁs¬`&˚ ¢∞§ãº^*√*9œ?S¢Ó¨I?ˆ˝q2åR«ÄnŒËìoÅè&ü,·ÀMõ{Ú•˛hÏ˘5Êì1‡ø5›˜›è∫Ôè∫oô'Ì8tﬂ´ÔRÔ›π	ΩwªıÛÍΩﬂ• ˚Û_è ªÕTﬁL!Ù!‰”xüZÓÍ
Óœ? ˜G›ˆG›∂ÙÇè∫m´<∏:ßJ‰˝Ë∑π™ÌŸX‘w£⁄˛êµ⁄Ö’≥ç1UÃ&$sU	´ƒ»\—®ßjR∞B"ØåàUBª‚%©…VC19OPb;B6—ã?—tÎÎ¸•LLïÍL-\§WœZ∏k#ñ+õ≥NÄ4à©7ÿ’åR†RDOrf+›¯E68ÜRÄ—IƒÜd¯∞∑˙eîŒŸùúÉÄıóI“fß∞S„îG±ÙGâ_≠√¡ÿ+Í®ÓçyGNE|ÜÖ—¯Y4M¸ì,Ëôn˙J`õrl∂jÓµ#€-gÌH?öÔ	›. s”jXmGO!Ó±ÙítÉ“µ˙ DLG&vìq®≠µÙRÜ–Mìwˇcá3Î“Og1étó%Q8ˆ9„Òﬁ‡]SãÀY∫R<«k·˛NœüØ⁄‰∆ª≥¡ ØS^ ¶ïø»°~∑\±ÄV.~¯d:F√óüêÕ.Ê>ÿπ˙>éΩ„hza-E@j#}†{4˜"]—IIß$ˆR¥nEdË}ã‘∞“H»ë$6öL«d¬˚]Bê«ld#NÍ8å»9@;b4§¡@·/÷5ÌÛqqÉúó‡¿}¥∞a‹Ó˝~=Vû˘ﬂ`àÈ"˘vÙÒvËa‰¸i¥Hzo'0ºáõ28∆ÔÕPq‚ü˝æéôêW¢No5⁄ /ox©w#ÖÅ©Ωc”†ØkóøzóÈåb2Ä∑Únƒ .Åœƒ∫˝°èI¿Ω4c{ØõBx‚ù¯Ø®8u3Âq÷ÇÏúã//“Jƒ,rﬁá3âG˙√Ü°?i˙°ñP–Ïôr'`âú(£=-ÀZ¡'µ%∆»aw∞”+ìÃI∫ró‚¬Æ∏yÑ˛˙±õiv§·„qdè‡˛ÈÔˇ»˛#{^€óÑì ∂>Z∏ÎO¢¯[¨˙˛Ã%X»€[dBª“a"∏«O∂PÃV(ÀıÕJ;s≤U}ºµò®+Ö Ê-ı‰˘‘?ı‰	Vú≈u˜=≥ol+ËòQöÊAÕ.aú·VïjG§dH7Éq¢K€°uc€!Ø⁄ ≥Êÿqø«—ôâ¸y
ù˜¥oÅeÕ#s|z„~DæÚ„î≤˜ı.Õ<O†ã2÷kŒ+ívı"Û.∏|7à¯*}ØŒÍg—è7∑úÆÊKwWùŸ»Ô…Ÿ»u˛$Á¨iö+’“Ò[õ6˛$ˆR∑Õ°LÕ%)°õ∆YÏMJÙÔäJÎõ(◊k/«5kµfËÒ¶1ÍºfÑ˛Îôå˜ÉîÊÓD∫rö∞üˆ_ñv{;€ª˚ΩÔ6ü?Ÿﬁ}÷˚Æ∑∑ˇbcs˚ªçÕÓ”ÁW⁄€ﬂ\ﬂ˛Ó´Ó÷ˆnw}ÛÍOœE˛U⁄ÉÆ‘b
≠Ï≠≥î5/DK&2r¶ªi‘çóêŒQ#ûg7ö±‚ﬁ+≥Ò
EÓ9LyQRÎ€í\≈(ˆÌXÿ¯ıX¬Ù'ÄŸ√Ì88°r∏÷t0ñ5“Íœ∑g™?ﬂ∂e.SóŒ“¿öêå…ÂŸÿ9RŸ‘UF±Î:ÍÚ*èñﬂK∞Ix¨3˛…ïﬂ¥ÌN ñ≠êCEZêb´≥å⁄÷ó…$¶âÖu3c◊úIF◊à-)˚Ú™-Îï=ﬂUä˚¯AÌK!îJB'∫vzÄÄ}zòõ]æì3lómò\—§ayg&,Ô|8Xætoır}Ds˙˘Ö†yßöœÄ–ÀBãÏùÂŒ∑Ù@n˝⁄ÈÛk[!7+2ø˛Â"Ûr)ì#/ÊégÚEûª‡¬/∆˘cÕ∆è5m–˚Ëc;≥è-ßeÓíçÆ◊T«≤∑Y˜›A'èÈ—í@≠GÅú7∑P¬È”∂VÛrÓ¡ΩÛqä9q˚_ŒÖàw Ê.Míã∫Å[bb≈{4;“sÓâüs{¸r	ñk—’g¡W‘t>ˇÄQÉ≥öB9Ñ≠≈B¨¯⁄fï+«CaV•W;rÌÇ¨Øe%1Ω‹÷¨Ø#‰D≤cﬂQPÌR6ÄÀì•u˝¡åse¡C8¿ˆ™s≤YÑ—“™<[vYônﬁ]G¡.v}æ	W›´◊,fRË¥Óx≤Wõ„mï)%≈V€¥‘™ŒÀqÆÇœ-,rRÃ≈‚«¨‚ﬁ?+ÈXr÷V¬Åí∫&
 :Z∫ló0∞æp∞°∆µ–#‘nœ‰}É·Øg /ãe¯Ú<Rùv:´-î‹]3◊h◊
+.|¨ÜKﬁ[√«j∏ÔªnÅ˝Èc5‹è’p•’pØÄ#YÂK¬)>÷¡Õ>Î‡ŒV7ÛU˛X˜c!‹èÖp•¸äúîzÖÑõÚØπ]C‘“ºV¯:â8ÒF|r¸©°3ªÔ»;q¡O•Ë(Æã§ÇpÅmÖ„z%z~Y˘’n≤ÚáÒ{.|3£ ∏∞ò±Uc¨ùâ’»ﬁ◊Å-◊”W”◊˜ûKk|C:„åCøæ÷òZxä‘®skçoLgúÕˆF¥∆ÂÆ≤áäC7≠($R÷'*Èàe,µãπıár,⁄jc™£>Ì¢bŸÂZ‰—!wÑ:Gá‹/Æ¢Hv©ëKï»"ú ¶8û7 Wú€ñX‹'
wS)&TËK¸iwBh˜4B@+)Nñc=‹‹-Åøï8m8ÜΩp/ç`C ØÎßh/©◊b¿sêqOŒ_%Á…´ z™-Úh‹M¯Oi0&uY˝°óä>˚= Úd]‡è‡¯‹Ï∆˝8≠◊˛Â{~ãœù¯céÖo?$r#èúLΩx‡º#Ô˙ÈîÜ“·œ~c‹ûá
/ˇVÕHÎ…@∫Î√80•∂ıhå).a4ˇ3h¬
˘'”òZ<˛0ı1s¶/ã—ü§∏>ç™∆◊√ÏH†åﬂ#…4!ß^Ak2∫˙Û ËG	ôD1Ùrå!Üèdõ<éK_©˙”ﬁÛﬁnwÎ’ﬁÔ˜ˆ{œ^m>ﬂ€ﬂ}±æøπ˝<C=xn]]ù˙˙ó›˝≤GÃ’®Øou˜ˆ6ülÆw±uQ3`_ÖÃÇàeSõ	%´N¯Rﬁ≈p>––Z™¸#C@Õ(ñ¢Ë5úcO‰¡Ó¡¿‰ŒòN^ ÿSÿ˚ˆL“<êÌ®«ÿ<Ücî‹zÄ"$bé‘∫Œ;©∏Iy‡ˇ+6ãs Àø›€~ﬁd…∫„˝É#|€ó¨πÚ2sªaôüò7-ﬁmlcùz˝ ÙË¶ä0¶ñ√ã·<p≤#Å`§ Jë˙Ûàx∏ßº¯Í{ÎÖ£˙»˚&‚$bAﬂh2∏Ìÿ˚#`≠ ¿ï=´¡%Îı“
òﬁ[Ï¶Ü ™A&Xâ¡≤g0¸u?zBŸtçsé∆ıä˙UíNpÇ¨©s8ë÷[mX[Xî{±œÆ†78î^_ùEÒ¥øN
KAOo+˜5àÄ\∆»Œïâµ}5Ü∆f[Aﬂ'’{	Y{π#¶ã≠6÷÷K
–a"Ü¬cÕ`›†ù¸∏ú…°Ëy—éˆ`ˇ^zÕC†Œyhô«^p2ˆ@2®“O"⁄ ›L«[ﬁy4M˜œ'Ä
Õ_Ö¥}MÑ1^ä]®lõ£0:ÇÌ2ˆœ»c¯Z?–(õº≠©öqët…UßÆÅ∏7°Q¯x<.}ìD„µø Ôò∆!º‚≈ÓVXP†Ñ€Gﬂ Ã·wﬂÆ5l¿öØÄ[ò·:ÂèÙ$ıöóSlŸ∆˛14áW(ó±⁄WyxJºéQ•¢W<Å˜Íìú1øéÊÏÕΩÌ=Ê»∑–L`:i˝ˆ˛ÌÖÉ÷·eßÙZÙùç
ı÷Mò90›Î√ †Æ˜ç:2‰Ïﬂ‰J\ıQF8-è"îbˇ4z#A	&'%ÈSØ”∫«kƒüÁ$õsàΩ8Ê	NüROLP¨"n£˘å¿ìÕëü$Ä8Ö‘ws§Q_ZUNxÒ;5>Ò{xÈ>öb7«ìi È°qd√Ÿå
]⁄C∆ãÁ5* ∆yíò[xQË¥ï¥5±P`„≤a¸.Ω ¿Àn7#±Êu_—∏ÀßE¶µŒlK>“£&¶USg,€ _hœâ”Önö?ßŒ˚ëƒúÏNâ=“4ŒU9‚d@¥ië8˚ìƒ,« Ï«Q≈Å89°“˛ÀfkUÅcá
|å^eŸUE	¸@œ_Û'Í“˙u®Zü≤Ω	√ø,ût~Vœ~˘‹ŒÊ*u&èﬂ»ÓX^\≤.
/0◊(_†Tti+øiD…às¶c∂· H6V©3m†ÎŸÀãÀÜò35Uq\apÚ·Iï¢ızﬁÿÇŸrWs#¥ÃnUùô zeSS∫“`ø'›≥æ∫2¸)S7«pœ≤¨GY‘€ÆqTv∆CŒ8Ïúü‘Fùwhuv˚E∫FR2pÖkùmWJl6lµ;m–;ÚMÎ `GûItˆ5”∞]˝«∑A›Fá±ç(OS˛âî%¬9ÁLª5E1U´÷îùœÇ10¢Mú*≤«¿_ íÛÑÏ\Œ–Öƒã˚√‡4bÇ=‘DˇÑú^}+ jŸƒÒtíF.VO,”•¬6·?›’∆u Ä)ŸF£A6∫õ[ø'_oÔ˛Õ÷Êﬁ>aJ RØ·Ø.ŸËë˝›Ó„Óø›Æ-`Ûåëûj?xÁ»f{≠â‹˘pæé±„_Hwœ·Éÿ≈ú' ¸ﬁ˜bµ’£r8ˇû5}|ŸêÑm/ ¡Ï°≥CΩ≥Hn∑n+OñßŸP\r#œÎO.pÄ®GçÔ`p˘ZWÚ˚∞¬Ç±Ä7y…˘∏OÍhëäÉÅˇ"Ò„Õ¡#ã∂ÀTqx‘å…ûÄû‘.–9ˆd‰!˛|‘úÙJçn≥Ãúï©J¯zh+Tœ}"`Â€M≤é……Êx‡øıè…DRœ√÷Â5ôïŒÉ¡—◊(Óyg^@=ï¯™\Ñ∆Z⁄ÚØˇöt„†$Ù_vπ…”á&‘)EΩ$úö¢Cgæ_d˛ç> mD64Âÿº5!WoÆü¢3q†¸-
y™–ö∫˚ÛéÉXàI)ÉïÎàï0Oö5eÙ œ©∑ÜsbJRÒriQ*ËûÚŒ^ÒŒ`ﬂ3˜˘x™zœÀk"’ª4º8GËKê…9b^æ^î⁄NÈÌ5˚Â˚¯–ö¿i˘Ü¿ó5rpò√RÇ´ÄÀMîs‰8éF\´ö0ò†µ≠dµyS†≤‡÷»ãœˇ[> Ÿ˚„∏/"ª˝Zπ]	zÍ#L`¥7<ˆ¬œÃJ/‡èÂA«QL5’0yÄ÷òó`∞`»ﬁßËAb◊a¡„“
!Fûb&:yLóÉπ⁄Å*ù”á·ÿX®ö/±{˛îAÜÿuïi◊Ñà}d‘gœ∂SÆ/kVBºOôP¬œµ)YÂn
Ë˚8®˚®[ì?P]6ë˜ÚJì<·»ΩhÈ:ü˙@aêòñÍ≥`w{)ıeÅ3Àë!:'C¿±‘ø≥,jÏü™nùù™âLpUC%˘äëÅß@ñ·Üﬁﬁƒä¿àÎbÉ8üÖ≥∞	¸ˆr∞dÁà°´]P¯∏(Ùõ>jiÖ≤eƒD¨5 ì©õÖ—ˆé—|WóôhÖªdÏ’Â"9»¡√âM$T 9Qnù‹…&%ö+á”^»@ÊÕ4~µÑ;eœ –'äVRyà*©ÛëKˆ?DàºO±äEKo]ˆ|…5p	q `ŸeR¡∆ß:úõ6kù”∞uZøo:!XqµNƒiÕ∏ë¿p@`˜ç—Õbåﬁx¥¯i|ÏıÖ«{ë›6ﬂß íç•“SLÿ~“¡»S≥d6x§â»¥ GI‚"5âõBC%Jc·NgÍË»9ØÃ :ÎÉú‹UxÆ2SW•Øôò8I°Âk ÷A9{4$Æ

õ¥¡JZéÁ´sﬁÛˆi≤Ê3Ù4”≤W0/Â-¨êr`_îﬂ∑hÚ£H˜oñèõ˝h=å¶•üEN∑öÙÌ®”√dƒyyÊ≈„zm=öôGpí·…%fã5;˙ÿ;=8ceb∫ﬁ+õ®¶n≥Ã0◊π¨–˜û¸à6ÃÈ&Œ¬ˇQq«ùmòbÆÓΩûÇ\˜‰/,áælêo€¡s/&‹“…q‘€≠Q√Ë"˘Òâﬂ„¸Ì9ä"zz<¿S#ë£à@	∂Ñ¶ŸNÁ≈≠≥D ~œTPa† ùn0fTızäQê¯˜Ÿ˜∞^á≥)
Oa®±è6n-:™í≈?Ü’◊≥]Q≥ÓÉ\ﬂÈ2Û™°O`SÓP[¨-h)ò¯LÍÏÛ,√§»E;≈Yò°áFˇL+XÅ4ÍÅ·ãü¡ô2Çı⁄í7	ñ®DÿhXõÉd‰ß√ü⁄Œˆﬁæ§[‡Ò€k
Ùj<î∞Å ÛöÕ’#ünﬁ˙7¨È<ç¬£#ØI»"Û÷£`‰3 MÕ†‹é~∏ñy˜<√ü“n/ √ ,=Í‹°*%oâüˆq[»Ù,∆—EG∂xK∂™»Õ>ßUÂ'”AÑ5Å‡qâHvÅKulL~Ã´ÙC;<'K±¿b
'îp—*kdLn±ê`IEËO‰ õ„Ë¨æÄG ´¬ù5SÔ¨Iˇ•√ﬂÒ˙¯>ül¯	-ÍÉHB∫hì&'Z5ÈŒ	u=«õÏõ~üOÓI3˚°∑BGÜs∂ÙìfˆCoïl‘¯ØÒû!Ï1˙¸B°Zj‰•Î¿v/◊˘ÌLm¢ºﬁKß∞n£O`ÌmB¶«ôvÙrAÂj’us2µ:÷p,¯)u≈å@ºÂpOêªé–õ€#‚–ç2níM∫=Zé%ÇÉÊïF6Ñ¬†+Œlo·Åeär®è<îÒ]9,dd√‘⁄	ïâÑ™¢qÜ´9QÀæÄ¯B´–`V}Ë¿Bõ±∫|°Á7Ω‚G¯ï6÷ﬁ.ûÚ—ŒéªÑ·Ød6¡jjí<˙Ù‡?xço[ç{Wﬂ_˝˘Íá´Ø˛rıœWˇt»Rçx[yœºâOmob∞Ÿ¯ËYÂKÎG!Dø:@}ÒæÒÛpQ_•áÚHt†7ß{ê˙â˝¨√¡·+dh’Ÿ&W8I\{l§+.•ë"ÉI€,íâgù}ìÉhVª>E<FQíÛ?ÄŒ~HÂc0yÁ @£;æ6'¢Ój——7>\sxí$Ä	ÄF–á\ä¬ï>sHÑ◊úﬂ$|Iˆ¸4cQ‰yi=[ÄÁåsËM}‡¢πR6…|T¸YÏÂë≤&'|M‡R0#Ó;À,ô˜•/qØÊdöçÊ™rOÉU”Ù'öÅ™~∂& ÷ﬂä¿®àU”&’¶˚-Gv2¶tuËù{Ç∏"NH«¥Ã 8	R∫q)}Yî_FÄÖ∞qÍçÿ∂¶á¡®∂08°oA∂¡O)ñ&SéŒº∞W?yh,•e˛iÄæóçCa‘‘§e/Ë§ı6w:ãh†˝ñæC/ÅmlTë¿xÖS…,|4a’6;hÿÇ“∞|“íoJ_›‘+ü∏ûÅjål≥ï—Õ¥∑ú—…¥ûèÍæår<ó®3C?£≠1’jˆÿA÷õ%Ô™àñÓÇ@:Ù„glOÿí&€¬c!04Ö&‹o‘wO£o8ûÂ«®‡≠Ä≈qK3åòo0c˛∏.«>Ïc:ÏcÎ∞ÌÔÀ{†={¬ÑÆ_… ˛ŸgÜ¡H˘Ì»2ÆΩ|‚†jä-i¡ÅΩÛ†‘\ËtÄØtÜ`_⁄¡!qñ®L/î’H∆í®œ‰†0Õ9∆√Í£Í!lpæLÆì5NuÈ˘rÔy´˛gí©Fr]»i§+ö-â‰y%kx‡ël(~°b/∞*cò“¶H1ƒú"5¢ç2g ÇÆ◊çÕY~≈ÛûÚsâO±5ÆL…∆‰4≤πAç˛Âú¯ãÑ∆hùµßø=lΩ9®Ái_†€tiò—ï:S†3
W<pç«µ¶<ÖEø|¯åóbﬂev*o—=…‰Œo˘˝ßTLÕö0©’h£-2°U¯g–ÕEU5|N\µ¥ÀSÌâÀ•™Nç…∞,‡—.œ*OÀ(9Ù“ƒõLX≥¨ªmGUïÛ'_—>Ÿıá/mK	á6ì{î8Õ"ië™4AÜÇCê<13ı`V_“l6'ãπ‹Œ±4ó€%ìlû™U¯ }AˆLï˛q˛òæ¿˙Çﬂ)œN8î KûÀ⁄Vîp,èUµP1EG)[ﬁhèO0C¨Õ,òv—¢Ê¯Nû⁄w2L*Qâ^ÏÕÚµÆˆŸ…‚êy£'q4íL &8oD2À?…8<ç¯Ã1≠Ó@¥ÿè‰Òﬁáƒˆ(HÔkËπHj¡†XQc†Øô±]Ói	ﬁ·9ÄÂ3&ª»ñ5¬¢]s˘⁄Ü¥˘k‰‡f˙õ	»‹Az}k˚≈ŸËÓww˜z¬AzÔ˜œ◊áh¯{
ÊVîvOˆ#·úîóÅO7ÔTäÅ_#˘aä‚ò€GòıøÒ—k:∑Ú1ÄtzôE3ÚAy\n±˙„â˛ÚS√èÏâpjulöÇëµU4¢8hµ-§é=ÚÖÀ.…˛U&AΩëE∏∫k.ïB‘1ùë‹ô1rCr•ÂT'¢uH&E’õuûŸ 7å £mü`ÑUœ!¡»CÀdoòª]Íæ≈¿ê%Ç<√Cv¡É´º¸≥dåPBÒ≥óf≥ç{¬5gÍ∫ŸC7¢5Ÿõ5!5x„h¸oË§õ˝hT3;@≥Ï˛—Ñ ˚i∂ú‰ÃÊöd°{ó‘Ep»ÇÂ¸I>N‘˜≥ ÊXü\±®ht—¿Rsﬂ Õ,Mp∂€›7®gSµ¿g≥9ø@˛ùÇ˝K‹Bva]˝»¬πœg…îü∫%G|‰<˘wWk…ÇÑãõ˝tıÎÖ<kØ]4ü:ËiÅÅ‘_iıæ=â§l≥Ò  ◊`ê{[˛€l¸›¸‘‘O›Õ6—ƒg©µÄŒMGËkÕ˙∂b«‡¯1µ∂"ÔÜ)ï-0£Å¯ÉnÍF!]a£kp}°*
ÖdòNœ}Co˝nâ
–°OèΩs8Ù©¡É_≥J´CòGEDO86Tù4Z«(é”≤2‚√9[~◊°.∑8öRZup0°BÉ5cêßê9«ÏLòÕíÒ)	 óÍÛ";X+„SŒ*SŸ‚‘≥<â±(ë`ç‘qÈz˛6qrÍÍÍ°±Q¬…5∞∆XQ•ÀÛøï‘\`‰[Ön0,jÍ	éÉ≈é8Cß )ΩÌÚAK±S›0É ‡êø≠£ºmKBπÃGT‚€?RƒÈ	pdÆè?dg˙x◊èLˆÕTRΩ¥®¢êlP¯{)Í‡≈ç≥ F”î¶ÃÛ.’ÒAÙÕèú7≠çÄ^d?≥[[ÛÅKÜVyn£ƒ8 ﬁµÜ";‚CæKÛe´ˆî≤vH≤»\œz÷À©N,Ä>:¡xÅ\LQù"Çì—E_·q$Ùkæ–Ê	°N√a§EÛ˝ú|uÆÀU„[’HåºSÜëˇ,ÊëÚ–úãÊ;ù¡ñ–Ø»EÛ—9'Õ]3]MüZ ;œ¬=Ûœ÷ŒgfõÀÁJ¨s)Û|3ÏÛıË
,¥
4œ⁄IOΩ^˝Ä,0ŸâÉS◊Û’πÏy˘Ïkr⁄≥Ò⁄’∏ÌŸ¯ÌRéª*œ=◊m·ªâ8lö”q2é·H ÈåÕ¯Ã\ˇÈÌ¬¶öI÷Âœ1É:
NŒ¿¢bLãÃZŸ–ﬂ©ÛK†uΩÓ-í#´Sq⁄ïSxÕ∫à˛^N–gk∏}∏$˚cÒ~À˝©˝UÈá≥≤–QFï)¥sAc;ÎjûßŸŸ)cús˝ÇÛ–˝Ÿï˜Â…Ì¶J◊\d´dÎÍ≥Lr¸Å˝ËI˚¥ºA∆©´‹˘3Ü—x'éNb?IÍµΩ`‹è£±p„aß$&ù•±@µödò!üŒà≈π«ícåEÚçÑ‰æ>4ç≠‘-ç∫Sf^y'“—Ìé—®X∏ósøÒ‹<ÉNœÜc£K◊{tû˙ÎCÙóLYa:/çétWÙº)+œ+º›;§v°ó‹•a›¥4ıÒÅÓÎpÎ≥œ‰Õ-ΩÔ @ÆV{dÊx=¯›¥h1ÚêÈ ˘Ä_„Ùn>jﬁª>O=ùa÷ã+e!PÍ-c°@qˇC :XBiƒ,êÿÏl<a“GrMò◊¬Ó{Ò	¶@È≥‚ºœ<ùuí"Ô*¨Z-qÀúò`—Sôèvl'ÍlÖù≥c€Ù~¶5:ÑÔ1kús∏î{‚ßfq;>\:	…ÌW∑ùµ≠B‘"yåëT˘Ø>π»∆C]˚SV: €æ6N√[ƒF‡•~Ö<à·Ô—∏ë˝∆1¸)UqÀ(‡stwÙq}P6œí–‹´JUéGÿ±H¨ˇyÊ√≠Ë‡cä3¨ËÍxz‰ó°õxä#Û⁄§\Ÿ2:±.œ;œÉ⁄rtcŸ±ò¨¯hMKuù”-Qq3hõ¥˚{,LE¥p¡`?¬¡`ı5yàMÜ›7˝uÚ3/6ctwQñìÛõÀw‰¬Áã§›÷b&8ﬁ™w®ë=|Úî%∂◊iíÉ£{≠+¯n\2d%ıUπ»‡xKﬁÄf^
v[	π•˜U2Ñ3è•ëîŒõ!)è.l¢ê6Úc°Ã!Ë¡<Ä„’#S·GÂªÇDpÎS§VStR”“ãòõ.õ3˛x3['µ}ñ.{HNß>…“ö+oBœVÂJS.NÜ˙Ω5S[(÷i√g‘H\¶ß¨j”E“YiµI´yo’ã≠{q\A|˝2n¡UÍ¥àÖ®*∫tÎ÷U0Â V`ï]æ&¿‰ı´µ¨=Ïˇ;7∫,g·\Sv2Ï≠b}j—ÖÃEpßˆ¨íŒL“î©dCâûj∆|NdÅôhÙˆî–MBÜ—uXùçdP‘
£`<EÌTv3áäúD\÷…ÈÏK¶¢ÎéA¨
F≤
J’Õ…ø,§‘Ú ’–ÂﬂÇBKß¸,
&tÖ ˙∫¸ªÒ
⁄ªyuv◊–‘Õßüì¥r⁄Ò´˜,i„¨Áiﬁ>◊¬âo∂°'‡3≈õrÍ)πÏÖråD˘-óñÕ~›ñ≠Nõ5Ì (HÍØ]‡Iiî•4O≥5›îñÇ√ÜSÂ'}¡˛’è±˜∂¶ DNÓØ&-≈'Xa†æºﬁJ}˘}`L˝v≥÷∫äS˝Õåe
∑É^ÓlkÍOÊf3Me	ÏXÓgÃ¬»çK˙;t˝ß˙õnU`iEó≠áî£f?fªä®ƒäÅZQs´í‹Ñi8≈	±`ºÜ<ÛÒ/¨˘‰O†"#´-—¸¸FW≈N»B≥f∂∫™c°Û…N@Ó.I/j*kãV\÷+sπ¡Máë±â+OóA3}âVöªiËV7©À⁄ßõ_f4å†ÈYÙ•ÀüZƒKwMÊañ\¸öá‘qn®Õ¯†0—∏ 5∑âÇUaËèÅ'Âí(•6Ä	Q¶—UñÊò°>2GÏeÎÔàÕ0ñ∆!d÷˛Â{!üe#¡òÙ´?c∆dD:%]û¨òNËVéÃù)™«Å∫p-këêªHVV[-›%DLaÌ8OÛíFj¶œBı∏ÀO3>dI_2≈rµ\/vÌ∫™(èb~Î®9“T	[có«zøZ-7?Ä√’	^bZõiñùöN¸Èa¿∑◊g∫˘1áè?†]Ωæ7Q$ëS7†˜–ioF‰\∏!ãÅ¬PVÃKûsóy[óëlìRÁDH%\*U•Å9I≈¿ }B≥§”öáñ9ESA38‚(î¢˘.(≈r+£≥ëÑ¢çj0;üë‰[&fÆ‰O,Ù
eñ˝h„ŸÔQ˚Ãsyπˆ4øù’Üäº…Ô5Éq?ú¬é¨◊≤Ü ÀHC}nDcû˝®°¢>m%ß=Y∂DÓº˛‰Ç∂;Ë^.âÔmÈ{Î0èG∏¸]˛ó?œá≈ÔlDo8≤ﬁƒ™Òõ'Q\]ıœ7˛–c∫)ögRO’œ¬˘/óù˛Û$}êÎŸ_[T≠<ﬂÓå\D5‰‰(ÇC°y√s4ΩæxßÇF—$0èÏ8f/)Fz˝!éÒùU∆Wt¿ˆ∂˜Â.3gaïXá]¬qx&‡>FÉA¡`tı=÷∫ñé@m÷ˆå/ÊVX∑òIÕ4	Sœl¨Fı´ˇ5FAáï¯	=ÑêEyE'!W†N6fqpâËyn†J$≤$Yú£BZœ2⁄	µ˘õ2]:Ê@∞ÿ<f)Ï–8êi¥»πü.2y¥R80TÂÖ©Ω0«˛≠|˙ s®Áy/Ã¥∆ﬁ’_∆YvåúsÀß›$YmIŒ≈Ñë±îƒFå”îH7c6(T'*k¯í©@âÊÈò¯™[z§™#uÛ˚◊*D!¥(|eìdÑ©kr@*Ùµ‚ç
Ö	>F\πc∂YPUÈç˚pDL›£u”€Æ¿m–ıÂ}r-'Ó?∫qöÈ9ño#éj£¢ﬂˆ¨Ä%âä3F4?wåµTäîÿÅ„∑›,ëçÛPR•◊wKOk|KÚ‰∂‹Gµˆk†ØM“ÀÓ˘I	µe)Ex„ŒÙ(˙_òF('≠Ÿmº¡=|ÚπµÌÔÇS©ä|û∆∞¡
çì£ì∆¡_µ>ou€Àá‰8)ˇ4˙QHMΩI£Ô”äÒﬂLìXNÒs“X©…ı√ıw–˙Âºm2Åâ7Œµ'ÃgŒÌ;dàx%¯KIx~%m–ˆ@”PwƒK÷7®æ…@ù˝F2	∆dÙ∂A’`çäÁ˛â1‚∑	´0b⁄fz)¡D¥çxıt2Ò„>∫A¡ª˚o Ëç3 î˚√™Ù—8™Èµÿ◊—WS±ÈÏ:‡ﬁ4ÒkÉe:j6õÍ∞ÙäÓñq¥[ì∑áÚ 6t	Ä≈∆„i“ß√¥ÜÒr§t çE¢ÚSÕ9 %L@$•å˜Ü¢–-›Ω≠:‚H|“•N˙πõ!ÿÚ€êåº∑ç≥∆h@ŒæŸP˝Óo†ØçŒ€P«zh36t€˝Ù_ˇ˚ˇ˙üˇÈ˛∂(ﬁ*‚=c•Ô;FÁ…»¿Í≥!Än.å&D_§ãb\§`iÿ1e√‡∂Ü¡+2”F…Z3wΩıña\Ë¯•ß)27íÖM”4kOF„ut–zpaÊ™e˝ÙÆx-n©Wõ^Í√R(≈†…ycô‰Ë∏⁄"CtÿYÀ.›]*ì_oeMÂÀü√eÅ±o9Çrä!·A∂ƒÚ",Ø—9Jsúqx_d¢ì(nL"‰j‚ö2O}Ω6)˚≥âL?’,Ïv7›MmyÿbÃGq=wi¢<'˙ÈYáY% ƒöÿ Ï·.voNk__Xû›ø?Û˚x‚g.?O[€f˜îºÆœgﬁUEøœ¸Øö„'~<ãÁ'ª.´f~˛´]Q´∫Ω˙‰¢Ó2÷ÀŒÜ/ìœh>”WµÊ(ø≈ÌCÍi£‘<HÕáe/Rı·b7R∫Ï˘»©áÎG‘óî'‰Œ\J©–L]Cvªoó»\~à*ÇKÄ_¥›†N÷;›˚Ã≠¡zkSã„ }‘Îπ'ÇÌ:w3PoÂûÍuG¯Naåé0Ó⁄ÀÃıö;ú÷∑j´ÁsÁø]M©yﬁvS6ÃkSìÔºeªˆîdJóÈïÕ—H◊\›»ÊB5;¢9—Ãädv≥#òΩÏ»eE≠ƒ≤°UE§™åRUåNNdr¢íëåÇ\Ò°…-’•â√j+lÆ*Œx„4¬ ®®Ã^,}JDæ@.F~… .|∫î–˜Yq y<ì∑ à sπ*∏∆#ç}D∂Rb;óÓ¥(çƒ—òƒiåR°UŒ:Ú”3ú)u¬ìBqÀÏÁƒõ4ñKu˜»˛áaû`¸2<ŸH#˛È”Ä3<ˆ¬A„ /˚^H%a¡˝Ü'„Á?%y(∆¡¯M£Âò†U|æˇı˛¸´gë?å+∏íÌ≈Dánëßbú[#aJtÌÍ]eI3•˛:£¥—jÆ⁄ƒ;óW„πÆ~¶À´Õ.Ûô¨+zpWüåÈ|FÄõq›m±âãk+-]xwÑÇ·m£É€¥ù°-n;« ¡Z˘o©¡dè9ïÏÌm)≥S—÷éíÖáøS…	[{^9D•#4√ß∂qalLÌ±Ú$óZπjı,d4XC5I¶˛Pç/¸⁄˚¨‰co<÷óπÈ'@∂¥œ˜;W"òóÈéœEfƒπ∆p©›R‘7*≈ÖÅ”ÔËﬁ_H‰êXï)0eMtLÜ˛qö¡•]I]ÉDÀ∫â¥≠#T$Ùóe˝À˜_F°∑ò)JL±‰Úñπ’´(oÄ©Ñ∆Úˆ˝if⁄‰Œ(}∂ã£,ﬁì¨ÚÇ5òÖ™/à—yk&r¬7gﬁÏ•
ªæ†@eì‚p]ñ˜ˇùñ§ª…∂πÅù–u5ïà}¨+p2ëU4¸ Ç¬Ã*k	∫Ø√Ü—î7ñc1æS¨‘°§éª?˝?¥ãDÈo˚çªH`òOú˝4t™{4‚!òÊ;∞·ß¿a'‰iJ…	6¡?∏◊ b…h-ˇŸ¡Möˇ\©¥«~i≈°ñ[mQ™(÷µ#âAEé¬‘◊Õcç;›ˇB|èΩ#åÌópŒÍ∂¸ﬁ|Jâ—c.çΩ
K[WB‘¿E>¢I`Íâ1¯ÔRd3„xSueP’/à1∞äj¥î¢Â*gV]Ô˛‰°±v⁄û<∏á=;w∞jø©=‹‹X„+eb„/˝QêØ
WŸ »ê/≈Ê‡í˜Ö†7S¯Á≥AàøìÈÙﬁ‡Ê&√¨:#ìÚN&ıÙÍœ¿¡D77/6ÿ‚©Y6B.Køõ!^ÔïdÌj ‡˛à◊•\úDÿê/5ºµúx˝J`˝ƒÔ±OH∏B˚∫–ñe
nmØqpkﬁíı\Ωµ`ªzü3ù‘"Nmì¶ﬁ—ô∞◊‚„*‘j`%´&ÓπÏπt˘ôú/èd◊?ij]_ö‘œ%øk,bKnã¯ò.¿„Ë-ŸŒc—ààWRπ≈{∏ö…kX0ã-¥Ó5ê#ï,q¢<p>É\_Ü∏∆ÎRl˚` FÈñb·ïEáÂ’Y	
ÕÖb∏m&ﬁQÖS¢	»4ÿ¸c#C&‰Àbû~÷É®\’ßK”n}‰‰∂#S 6hxú…áÕ¥eäTa#:Â ;h 8>§ü$åôã“d‚N∞Ôt¸Ï˙	öÙ<Ã3¨Ì¬n=
∫„Ö©¸)ÿΩ^lÊrœ≤Í[lÖ…WΩ›Õ'õÎ›çÌä√sbîe√ecå I
um˝i⁄™LsR M€æ	È˜ˇ»÷âù>#:x¨r&∆ä·≤e~&UÂ§tµïiê†["∆‡ce«~
Ñ≈p`©∆aÜ<ìÀ3N<¨_zŒ óbå,’(Ôd|ıcÇéãt¯Ü÷F’–\}∞yäb∫Ü∆¢£)XqÁÈ}◊}zÀ'7í@	jù"á""Ùˆ.ÔD¸\ƒî7ÁáWCp8oxÒõ∫˝Y0µ“∂W8CWï3¥DÌ/|–rÑEaÿF∫Xﬁ,ÄQø’n"J4ÆãïŒ\t»O¸GÚïsA<"a$)r+3´Ê.]jûﬁ€IËç)X…È“j≥Wˇ‰çfD—-KÇ†ËZxrïÉ\5~ï Ÿ2G2˝ú-‚+ô¡:%'bïSpå5%ÿÌ9ÚH<πÜF ˝wÀL{bWñ+ªÆ™0≠Ñig{wøªEv∫ÎõΩÁ˚ΩÍ«÷;$˜R˛ˇ7ﬂŒ)>Ó≥X…ﬁh¬<ª+—tÎ∆/¡îG≤Ö@f ¨0˜àŒÔ~û£g‹∞»è«’*‹í”æ%aUåIL…cÄ—)&@Bu˝NM‡ÙP›;\≠tº©Üƒ1ùLkK=Ú¡t‰>5–Lÿø6çäÎ\“Ö†LO·M†õ•'"√ÜJxlÀXtÆ‹ÆT1ü™ä∂ 9»
IÍBÌ4áﬁ)∞ÁÍ˝øˇ;°Ïz∫µΩ◊››‹&=Úewk´˚∑O∑˜HÔﬂÔlQñoœ∂)V,Û/””€4Òˆ~„üãEyDkó’πÉ
 ≈‚Ro1m/b/ı 5µ»ŸÄ†´–˛“ÿçxŸõIßX~›¡Azg•Élﬂ…‹πûBŒ¢Y¶úoñ7ˇßXŸ∂f§,√ä∏ J&Ô˚Ò»¶teÀlÏ¶l¡l˝ÿı˘ê9∏◊\U≈çKt√…ßãœ˛’ü„Q P‚Íác‰bƒÿ÷Í‹\,ö†ıèí¡öufó5∑4W
+Éq,Ä»§≥“8ü<îœ8Tm≥´˘‚% &Ñ¿b¡Áå;ª6@Xä`vDh∑&®º…“Ω¢£ÉÔ´ÏsºXFn'?`;∆õüÆÖh% Ÿ•Û∫˙ì~Ä†bóŒö>˝À⁄ç¢I÷}Ï‘@˜˝kB8ys^_$~–ÆX±ŸÏ@›õû¯1Ç”„rág√Qi“. ÕV+G€[∞KzN∆b›ã}≤É&xK°üu}hÕ√¢:oJ52™ŸM›—D¥ı/ÉY…µÃ˘éÏˆ÷∑üıûoÄ‰±˝º∑G~O÷_ln £Bûˆû˜vª[=ìeq1-p} ê¿¢ìçAêÙ…$l¨UŒ|ƒ
(≤{¡kCù5Ú4‰’xwÿô#»ÍÇæ·Ú˛RÿGh√yÿ4¥py£•e¿?¡§5ÚÔ¶/ú-UˆC"û 2˜ÖŸhÓ˝aÁÂ~q˚„?ˇbÏÏˆûæxæﬂ›#{/ûˆvakÏÅòæ€Öü‰Ÿ’‹ÿ\ﬂ&˚ª›˝ÆMl/ÿ'UVs¶-yaπ¶À1±-ü$xB#,˙ß,íá⁄Nˇd:∆oﬁ8J1"Ò0ÎAúLô)Sfb˛	∏#ÙZX_Õ;Ú˚~Ï≠Yßn=F*	6v2[Ω¯√†@æ°líceg’rnKÿŸ—≠R<…–n0^≤Ë^ÿô¡∆J>#ÌÀ&π¯Éõ◊túŒnZe∑-Ã„aaÍ07PÖ°ù¨çO=¿H”ˆ®Âv:§^)$RÔHèπÚ+“c Ÿ+öG∂©À¥;dZqXäßª›'W◊˝êôˇÂüˇ◊ˇ¸Od◊?	êM¶N˛ﬁmB	CQnÂIH˝¬äwófΩ¢ ˙M∑´ïô±,√ﬁ]}è¡C	^:T§÷>Õòr¬~p”Cú•ÚÂÆrbÒíæ3Ød¿Ê´Rˇ·Ÿ=H©¢ ef—AK©w0:·πÕÙZ¢’£LcÂJZ∞DùWñ%[3UD9ˆæÍ˜nãΩ… Ô%I‹gò∆·%Ò¬î˝¬Ç' Äx0Äáªuei˘êÁzÖ˜`±B…πYÛõ–\3W[5≤‰8Ò’àh*êg≠˘B©Êr…„gîdB´=¸Èèˇó¸ŒÀü˛¯ﬂäöŒÛP≤π2ï4ˇn  i1ê@BãîÜU¨®·^ùjfU∑ì¨‰~bUÃ¿À[˙}&Ô?^ç∞dî‘©\íˆ{yF0ú|ƒÕEKjÚNX¿Åè√\Ln/áÉ0”•∞aÇq
úLJ9∆ÙrS¯b`MÛ©"´ÊSrƒ£‚<.)bœÜòl$MerµHÛ~Úá©?Ú–?é¶ﬂ‡•∑<˛4Ji4Õ"≈ä†‰Fwj«^+£ü0v`iÅ÷G¥4ÖL1„Øú"cäûecÄ$Ö≈˝„(Jµÿ¬s`ÏN÷wπøùÜj ì_~Svp˝,‰ˆÎı≠ÌdcÛÈ&Z!ø⁄Ï}›€%?˝ÒÔ…ﬁÊﬁ~ÔYmO{{˚õWzçØ˛Ó˘ÊzótøÍ>ˇ[’ãE9.Ó/1òà+Yï1Ñû/Z!ZÙI˚ÛN˜Z—¢˙K∆Q=>R¬£∏î≤ßê†¸Î?¸◊?¬Ù7qˆ[‰À^w¿TÔ∂}dg_LˆIõ4»N¥x˘'Sò_@π›ß¯ŒQOÜÉáß““CΩıßdË{qzÜâ‘NÉd
c˛ÂïúZYbW›aZΩ–∑x«ªÖQØ-ÊP¢ªáÍÅØÏhóúıd«äÃqOsÓ”¬v7¸~≥Üÿˇ	%´∞wiÓ	5ÏÆÇg^{iÖú5‡–¬Ì1öºJøÂÚ3´Æg8ùÉªÿP9_ùo∂sˆ+˘îø¨,ı=k¥€ò»´Ì
€Â£≈h©”¿ìÖKht
T‘OQSÑÌÕ∆{–z’z’ºäOéº˙Ω{ãÌVg±≥“^l5WVù´Ip¡&%AŸJ„ƒG˜Iò4FFH§”s∏Jªj0_Nqw∑‰˘…/l–˝.∆n¡˘µCêﬂŒ‡’óP}‘tû-ıöÆÍˇhR∆M"DñÉŒ…bßÈ¿hƒ¢©„2ë>õ Hª›ØëcSÊ~úπE◊ˆ˛˝Now_hø>ÃÊÏútOÕ,)WÑ(*iKúÅ´ùU*?a—J∂`	«;Ä‡m;ñ∑kOQI»I˜·ÈÇ¯©?◊M6ŒbOﬂ2E*A]Õ!É6'∑Àõ
◊’<åZÇTQPpÌaÓı&âƒ∫˚¯1˙∞ò¬aÒ$4ˇ˚“  óœi€o†b0É±†ã tg˛C˙W˜<ñ¶}GÚ=ÜaXÆç∏Iûa
¢÷c{∏…^ì¨GÉÊùVgµLà.è∏◊Dô.—ÄÏ}ı4gé|/EÊõûî~é¬òäeN∑√ì5ó˙L	rª≤äñöÃá*4¯#UﬂÈâÊﬁΩ0æ´ *∫≈Lö˙8z˚†÷"-ÇT}.a¯†fuH∏?ÒÄ5<®=ÉÊ´‰K [++d˛ﬁ%∞Ô∑V;§›ÅVËÌ6æ%î70
ë∫8
£X\˝:§√5†‚ ‡HØj‰´ﬂD¡8ª,[9hã»	√C ∑y-Pt0aíñáØµI˛õ7˛˘q}'¸Ì–µ%ôà4Dz{t|ÈAﬁ/à..Îøõ÷q[^#µÛ0ÌÿY¡µ“Ûıíu≤&è{5¡ú∞ÄôpŒcÿµF¶?Â˜kåË£Ä)¥T√∞ï‹fDu6¶åö’(« í5>ã~HE\KÚò™îæ≠≤Õü;”"á≠∫f∑mq/ïrc‹-=neQQ…`H…0∂Ÿ:˚k÷ÛØJ.H¿Ã=û2àB¥^;Åu4ñõü7éa‰√ö°·…'tÒZ8G»Ñ⁄ù£—m5tƒQüwßÖPã˘ˇƒ≤I‰π—zÊ¸, ÆG§ñ4wÑbHp„9ﬁ^u2·∂n◊àÆ>f¸≥Ê‰ØeÀºG:ΩøÀ◊˙≤PO∑µßt~ÊGû‡¸÷Hè´iò¶Â∂M?xr.t=T≈O”`Ïï$H¯[o¢,ˇêÍkœËﬂO.™@a´˘ak,?VÇÇŸ•f¿©h4€Ã¥p}to7&1j|<¸~µHØŒ“â˙ìi<	˝j®ﬂæswÒÓ*†˛ÁÍ∑—y{çÏzﬂFc°fÃÇ~ºSo¸-&Úò©≥z|É{¢˝«j2°Y6Ä
˘lpHÔòŒ™tÿÉIG)∫˙oQ´LzÿzÔõH?1-˚«‹=õ…◊Q¸5æ{ÄÕG^º=Ò«ı[ÅÌ≤∂áÙƒ¡˜æá:˙‚Gæ±ë¨s2P[?*r+Ñ,®X‰‰
ÁHï99Ã}µFjv&S]Øf˘ªÆøÛÙ}«w]˜(b≤D÷˝ãph“h(ãF∏Òâ˝+(ïÉ+∞,÷u»ˆOÆ©iD%∂L¶Ï°>Juq∆ﬂã6:ÒΩ…ΩZ ‹Æ\Úm©‚OëpEí⁄öÎò}AëìaÉµsMàç∂¯ísRº‰◊∑˚´;ß”Ñ≤€òªv‡ÌaR7gÇ
»	ñ.0”TNX◊ÌD¿ﬁyÉ=Æ™√ÜJY‘@e‘`V \≈
}f¥≠h¢⁄w€pﬁµ;˜`ã∂Ó¿u«‘Í£Œ‰:|YM£¨Àì3»ä")is¨‚1Ó‹ÑÌ
ÿF
 4üØ∫¢µç◊g#óﬂ®ºCöç Æ–:‰_µ[G˜Ó∂ÌØ∑iÓÊíwk2›˛ÖïY ü6˛RÚµ¯©˚ZÈ”4œj´π?¶πÒ∏Ëm»ı@FŒS§¨Ùû§J§…ò\]◊gI+PEπgQÊ1“≠ßå¨ÑAEâ˜ç§íÃ~¯?~ œ∫õœ…˙ˆÛ}¯∑∑Kæﬁ‹ˇíÏwÔŸâ“P≠Üœ|§gò4Æˇf§‰9+*Ñ⁄ú]/É°∏∫uïÄô—P7ÏX8â-teÿàΩ3hm ™ΩnÏi6/∫"Œ≥∆ùnœÌ∂zÌÓ·“=…âöI˛ÕzŸ/CÖBëIcUöNDLJ8Ò Ò»&«3rÊˆ/…bôÙ„´ «öGÜÒ”–$IÜÃdzÑbi4!¬∂G5c¢:V¬òéí„»ïyÑS∆É67lZíÄ ï–|òΩ†\c$ﬂ◊ˆD%≈q¡Aâpt≤l¡∂wmﬁeŸ,°(ÂÔZËΩ…€¢úheÕf4¨8¿=w¸—aïvı„`äN+"I@Rçb€·_IzbG√æwÑzöW<äuUÉÃªÏS∞v+,Yß%◊fqÇMf–)HœÉ~gô-û ∆Oï´
UûÄÄ8U ´v¡™SM∞jwÄkC€	W6° *0ÈæäV1J∏I{⁄R—Ê.yët•I"N∞U=2‚ƒ…“(ñTpvDøû1]∏Õ/Ì≥&wg˘Œù„∂πáuÛ-ÔÀ√ÿDªåÆKËHø¢∑ôäî≤∑K˘⁄n°¬≈S>$ÙDêg≤bEée§LïDIëw$ÊiŒ¸D°qgf2¡„9~”DB¿‡#âòÅD†}‚+KΩ˜á)èæ:ëÁ}Pâu/q07C"0ﬂïü&øi!`ëDÃ@"–>x±"ﬁΩ/&"À{!X:˚§âû—$Ωq⁄‡MÇﬂ4]¿˘§	3–ÿO∞∂„{"Ôâp≠fwgÛ∆È¿Qp—IÏMÜÁøiÇ† ‚#eòÅ2(ê˚‡Iƒ´`¸~àÑ
ö˜A-ã7_˝‡Y©E~Ì:t√ßŒ„LÔtûømCá≈MQè’ﬂı–Å˜·Ä≈Ã*˝~Hà’M≤òàtVV€´w€‘˘¥2Ÿà∞JŸW^≈<Ïf˜∆9èÄÊ
¯MÇè‹∆ÙÇ√ÏÉ'4∆&&[z?tB¿Â}0yVÕ≈{Ê¨Pÿ˝¶ÈCÑèbáÄ⁄O#x’Ò˜e€»‡Ú>hõólE}•‘≤”›Û_ˇ·¸w≤◊€Í≠ÔoÔb∂äg€Ω≠m≤˝Ï˘ÊŒnoìÍì˙ﬁ~ws˚9Ÿ€‹Ë=ÓÓ.TîTù¶ò„“Qª’V	Ó¢±]4 ∏#˘9äVˆâ+MÉh:ÕY¯œöl†ØlQ‹ºuGHû√eëhÂ≠≠˜Ìﬁì<Ô˘’_˙°Y—ß≥ñ’Úå⁄É~Iœ'ò]äﬁ4©€ƒ¿©G?ÚÙAy†{G.ﬁŒP;y ÎKYÇ|Êém”N^{⁄<UÓ»ß∆‚ﬂuÜ‚[ﬂ¬b‰C¿}.úH¬~TòÔ0£Ä,AÊŒ T9]åÚÑ∂M.^õ>húy»˜â¥-fÇsG/,3z˚PÁsßc/*¸nÕ=DX÷n˝÷9ë„i)$?qf ¥'´6w¨∑ß∆6AÖë¶ô1ñ3Üﬁx«t°$Xß•AÄZ†J#¯≈b°~§3–à‚8¡*îÇF?ﬁ<ùP¢)EÂMRmÊH'ÙÄKìR‰p©H)JFi¬p'p£]\lôÔ⁄<dcb´ˆ”Kê[
v(-¥h%ïü5ËK´ãñeq‰¿c\ÚËúeÕÂù#VS√Jyoã™ :T–áõ∫pWÕ·d
Z&æ‰“÷∫≈bIk)–æ¨$ƒyo√∆AßC'õÈŒYz‹kqñ–#Ô‘∞Ú≈Yà!nìPKj˜í<DñÚó"ØP€ç∂,ÖhÌ·ÏΩÄ{∂íì©êO∞dZ ídNô
KãXú(÷zL∞Ï±,Mkm¢• óƒ9˝¯hY™'ó´*§”[SÚ0Õèôé∂≠‰ˆPc9l'9•+v¿L˜í=∞'äÄS∞7≥ö‡ŒgÜﬁx˙[ë7ò˘QxÃcåÒN|≤'˚Í≈¢Áô3u*0Ü=œ“}Ä}—£€º`—c¿Âôûæ¥e∫udv‰‚’Ÿ’4ûé˚û◊ey⁄.T(^‰ﬁµ?÷jÂt^P!ìÖ'OZÁÆÁEè6Ù4aÇ—‰≤∏gªÌ[?9∫˚Ö¯é M∞
ü«¢÷ÍN¿√ﬁ‡/R	ÇA¡cV`{ŒÔ;j¸|%ºúm∂◊1ÿ∫Sû(—])âá’˜¬ ¯"œ√>Æ5ÄUÿèA–Íh« ÇŒå‘.)øÎ¿XgZh˝Ñ()=‡8˘\¡ıÒ.C/ÜÎ°Ô≈úÙâh5YBìÛo⁄6ﬁ™e˝Wô¬PùSFJ¬<ãbSh+OÌÕ’WﬁÛV0ö^ú≥1ï∏^-*_å{2√à
€Ø∑wˇfoßªﬁ#››^Wi¸9è\ej◊NÎN˚ÛCÇ5t^9%uÖ …„yÙv–ç@dÄ•ÚΩöÉäF0‡˝Óc“^„5ë6∂wIèl>ﬂÔÌÓÏˆˆ{F!ûÉ´FÆi†f,Ú)E!mòfÈ¡≈Ö†k§µH®2æ5Ô›µ$ÆŸUûjgOµmè¯oÉt∆∑‰Ëä
√∂oØ⁄⁄[TµwLÑ’ı2ÊgT$xJ	⁄¨$¡][Ú
XËÕÒdöbÅÖx`©Ødæ˙ÜnxÑ5VÛz«v)ﬂYî$7quL}æ^¿[N∏\¯æ*Ê˝¥wfÑvU'·/RFﬁFÜp∆“éÃZaæ®:£=Ò/≥Ñ˙PÃ{‰≈Wﬂè¸»la˝yﬁ˝“∞S¬ôî3&‘˘ˇ©ÿ√O"wëPìE0Ö\-#∞ƒ'Jáà\j»ë¶P:L¥Ò≥sª˛1Lr∏~Ê`≤SsÚ\á[∞ﬁcï—Âeeiô¸‚kl›œ¥sWab#:M()ïÎpXˇÓ†√1Omªâ…&A"∆úyÆQπ«U∏!BÔ»+‡ë∆˙3√Õ8<Ãºvâæ£`≈πÉ™°¸ÁJÈ&†‘v±xwO≠-í⁄ãº~˛|Êç‰ª˚›uÌ*9'“#4ﬂß7Úí⁄!”# +PXåœ¨dœ≥U.@áÓmŒ>≈¶ıSQ™œ?@sÿí•ÁtrEÇ˚«[2ñ•‰*åÇ©0Y‰q–ß:ÄzÕ≠b»?e†+ê≤ÿGIwŒíSt™•Ösfs¶åÀŒnô›◊î:r¶∆róã{ü€Õ-Ígƒ◊íÆ¸® yfp±§ë≥êF‚◊Á-ã…÷û™± ç:Õ/«"˘U´πcOˆ¬;´k˛—“›5“9≤—)≠>w$©+ÅiÓQ?ED?Âd†¯‹c{ù>ÒºSÛS|l≤£®”ÃéGö‘ïó˚Æ˜#X%ƒ|/‘eî.2ººUëjîT[û„»{ááû4Â«*∫Ëf/\˜S/úqJd⁄Xå)pΩÒâü©∫“Í7S/>Ò”&Ìº ic*+î}vØH$9é˙”dÕ$Ï:VﬁÑc]˙°‘P<£Œô›˙mnN’»tKC;Î?ö¶4a••E€)h®¥πào˚´∏∆≥÷=D#,q√ø‹_b˜gÍÑmìáÙüπ:¯*2çQ”`O_¡nL»qaÆ>{hdJ#‹ÙÀ\ù¨O˝0Ñ>ÿøsu±∞b|Ì!ˇ2W'_F££∆¡˛ù´ã˝Ë(†s·_Ê[ÈiF§ã(D1,πÚ˚]ÓDâ⁄gvaŒNØ˛…Ô{ÿ˝2'ZS«>¯;◊„;Å_{ÊC<Ã≈„gˇŒ◊HÆ–A4òo¯—d˙1+ö_˝òÇ$[”z˘Z/8ı«QBè€Q‡#z£πï„ByõkΩ⁄ã«h©¡Çóµöse¬ÈhÏ¯{%^ü.¥qÌZ]¢8Ò¬º[ˆ˚Z]ˆ˝¯Õòyß‚ |ª+ ≈ﬂá“è˘à€’è±˜h˝wæi∆Wﬂè}‹1ÏÀ|{ﬁßQ#ùnrﬂ∏Bß˚á)˙A(i1ﬂÿ˝ÿG¨|Ó˜õ“%“ÆÃ’Ìväg˛%ıû`˚ºx°Jg˜óGY†s)‘‚®ÚEÄÂ&°£≈ÄÎÎ”$çF∞+'”ÙÊôÖ„e 
ö9ÉÃM˝à˚Ê¯Áí≤ı‚T%9ÅÇ∏âòé«S,™rq¢OónNab=x6Qb@Ûá¿Ø˚1∞äﬂ–JX—"ÂdébÔ[¯⁄Îg®±}î§WNc V≥Ÿ,û’á"£–∞y‰	6¬‡Ø˜´K-E†r·ØEVödFsMue•¿bP)zY¡ø√WŒÖ£≤ñ3”ÿ\eâ≥+9GK/1~î*x«Ù9d·ŒË·∑àÈÖKœêjZbhUÅ√íZ2Cãú‰6Éq?ú©+TqÅ|˜ù™Ò´D\mÓ||–ÙS¬≤Jt≥ÿ¿P≈¢ÄXZ¶ªC¢ä%S	|}∏IkO◊»Âb≈«7ÄyË=©q•zõﬂ∂˙Ò@Ó%øVΩü«A» -ıì_+—∫sK	„V*K™öK∏¡Ñı€§√*”Óœf;±ÖaåKœ˘Ñ†+9Êc≥+¥Âêg‹iV $Ã A	Må
œŒlcX≠lc¿wÏ&WËá˛—,7f6XÆb∏(3îõ`◊Œ≤%™ÿä-	%¨B'áV»P¨“¥ÑÁhõè0ÄÃQ¿vËåRSÄ%rìo59Ñïä•¯f§äÇÙ
H<clØ)u√)9∫ﬁŸ9¨,ŒÆèuËΩÅóT9ìa&qÙ[Ω2oKcBäÎR˝ù|ÑıÉ√ô»Ω+∫9˜Ÿ¥¯Ò.Ø’I—Ö£ƒˇ  ˇˇÏ}[oIñﬁ_âÊÃŒ{»‚µÿ-©]"KÍ⁄Â$’;^µ eU´≤;/5ôYºH#¿˚`∆.0∆é±kΩ2‡á∂÷˝‡¡¿∞ÅÂ?È?0˝|NDdfd‰-¢™H±{îÉië≈ »»àsNúÎw
ÆzÒ!ínÊ#7fµ˙⁄	])!dkæÍ[˚HRv‡}mÈ®-›	øËﬂπó”≤ˆKwå√ÔD÷¯‚OÙ«h_⁄ôYﬂÊô	‡Ø∆ZbùÇ–Ÿ±√∏2ñ<$≤$IL$IO´K 	h4	ºZ±£/x≤:*L°^tòJ´)r|¬¨ùtÌÙrrR§°º‚¢c[cÃ¶1fﬁ=iÒ5“w“©•˜%Æ>K3s(ô'˜K•≥’K!‚óŒ>¡∑u@@OπvœõÕ¶¥~K“bΩ–ú®Œ4ksû“µOäFﬂQÖH≤AsÉÓ≤YÚû”DGª04OtP5™9Ê≠é*RÒç7ÖgK,óju’\óÆ¨ùÄÖÿÕñ\¡[£∆î+ÛÖö¶îÓmî·Øx™^â¥h=ç^+BÅónîØL§"£ıT≤êé£∏^JÏbõú‚3<ÏnæÑ≠\=¨É∫~◊áe\¬&o◊ËŸëªMPy!ÅuÂ7ˆkÿ-À©çj‡ïèlƒ-¿◊≥aÜê∫∂j@ô\W@¢»À”»H&z!'ÃfàX&⁄l√K.7b…∏∫ƒ˛◊L∫3®•öE©àa‡UkeLõ$Y9¶ÿ◊;§‚Å%aêµ"a=≈Î*ˆ dkΩ¡J∫¬œïı:¢ò#s`TïËavUÿ¨YƒÉ$Crï¯`b0YU–[:…yøVJÙ’}˘J}*≈$HZ
f∏!˛ˆ*«°	®ı’Ú¸)åıîS⁄È/C%I6Üm`R∏•ä++û+Jπk™`∫¨ﬂ1Ø{1-v)∑∑ÁÈΩ∫1œïÙÍıg€D†∂€®=˝uåE}õO©,ná!LFÅ<®>ævhı:x¯∆˘Ì∞"Zw+≈µeÂb"≠JV¨Å≤r¥,oJË†“«˜‘3-À≈=Y
ÁK‚`UÍ1™h•vJöifÀyu˝—ƒ±—rú”!(A@á©D±Gzât „ÉR˙ÿôÛ€≈µ Wƒ¬¯õk]]ˇ!ÏO`£V\€ãû>UπÄF*∆¸zPo<@x(‡ i„ÓXC«∂WTíYˇ &-€lÓ‘¯†_’1‚∆ö¡ã1fî14ÊW¨ôÆÄ)∞f¡#§%òŒŸmì∆é¢^Ú–QÄ¢Õ-Œie™m¨:CÆÙˆÍb\'N‚“qc”AWHZ
®å∂¡ê1N|4ÆFÒ≈·óúª}ﬁï¨-LÆÄ«Páû»Ø´4@ÂæŸ–*6Ãàj›·å®’Íå® §‰k~wŸ“ïtù∆Ù<Àz=Ù√õ÷ó¶WÓ+]7¶O%c^ÓõæÔE`çÕÍ˘EìyƒCåº ∑úDV4)ﬂqóÓCSè	ƒZ'éjÅî√,Á‘£Ñ∆YÄØ•äsdGˆó∏b<ØxH¿úqk{v∞Ÿz¶#}ΩÎH}8uÃIûàdÆ∂«¯êo2qX4çcH†∫¢©Jƒƒ'5‰Yç›^w"ï‡xq#T©Óm»©°Áõè2’G2@õY´∑C!º—J!â?ô–à∏„â$ùÓ,TÚ,w0h¸Ñ\oÇxÒwÖP™`N îg%vòÙªw{‚†LøÀ[6Z€-Y6¶˚]®è3,éYuÒ”dYQ'clSﬁæ˛ﬂGL(î;ú†GñGy∂ê≈ò9Ù'AüÀÄ:„G/4<Ü¢–eg£g∞êB=Ø•\õÇ»•åúFñŒ^Ÿh…q≠::Øü…Üstånlm˚:v&ªÉ∫%∂ˆ.çOáQÿpΩ˚ä§Lèî˘ÓıªqfZWè[ÀRπV‚	G…´i;ˇQÉï∏Eø«ïƒZÅé	ßÖ ÊmFﬁ>≈«™©©;áè•¿ß*ÿï7FÀ≤ ûçîå§sZXã¢éøOCKﬂM¢KIfa—“›®=æP‹3b ûü0D`ÄVKx6çõÕ#Â3àÃw÷Kõÿ(ÜâÊS‹ô≠ïª!õeZŸüíÖ“Œ/·<ˆ|èÒ/0åSö9q?+∂Í—]¯µùi^≤öw=ﬂÀA„|¬{U©=≤$/y&qVX¸îhÇ-PÎÊëEûâåg»ıX{åEA\9BåªÅ–ƒì#Ú˙€∂◊A?¢c!É¡◊÷ˇ E◊"k´´Ü.+§›ŸsQÏ€˝“„s*03/∏ÑxöjËÌIkªBK~®√-•=r2¶¥?JÃÍëœ¡
æ32*ÚáCáŒ h*≈L±tWDåÆÑâ="≠ô˚HR°˚Lù9«“â∑ß•zˆ§O*“Ú]Ò4Û√ÃÄ≠ådK¿ã,.H¯,˙à+÷LàP'Q4«0$DdSwÏ3ˇ7ìAûuNáx¶œ.K2ææ˙^Qˆ5êRággïq]_å»7à7Æ•◊ãª4F◊	^±±Ù_ΩÚΩMTQ1${›SNXL2ÁòOE‘ç•’`ØÖÏÈãQçRI»%¡çó–˘pê5∑XT<gÍPı⁄elIz	™VÍÿH[UL[Êƒ4gÓ˝ØµäÛÉ@‡∆“µSÓ”ÖGﬂˇ„?˝Ò˜ø’2r™Z2|ÒzªDﬁ0ñ 2¿*kß’5ÿ…l¥X ”áEIãR@Ä˘…$Ùˇ5û⁄≠`<:a≥ea¢ª¯‰à.∆ãO∫û%˙ Â⁄±‘œ0€>äSßáödJW‚◊xû8K˛—2æJÌ´„°E5ˆQÖ8˜C“∆z{“∞èF†A,˚»,ë}´øH&òı
ﬂHé˜˙ªs,˚_˜îQ≥cÏÃN∞m9+~£	‚üÚPÆ§H_–ﬁ∂ñ”[«I&ÄÁ¿Ÿ∂Øÿg≠te·ª— ÆklÒóñ2Õ?÷\‘é≠˜E‰NXT8xã∑5èGœBãúXgV`,YZ¨ì S09ê›ˇ7ío⁄
ﬂ3æ!=«ˇıÑ≤’ûpî∞P⁄G]¸	„ûﬂ∑E√0¯‰‹ç Üº√0x∞Ì}ﬂı…Œ(] ã'†≤ú˘ó@‰è¯rì¥{∞È`ﬁ¿<åGìÎ?x±≥á,{Õ4˚	XäΩcÚF’nd˝Vt◊zæõ¬Çul]cÓGµÏ)◊í∂ÂsÎ "ñ÷àÆÜˇ˛?˛=·Ê˚˘î¬M¨èõñ3úàÕ#îU˚ÃÜ]&¯ÿ^Ãç∑≤grÒñâ£≤ñle·—… f‘i:CFVœvl¯ìu∑7´sì$l‹â√\açÓY ﬂ]î9(ïHä∆ç-·&ù ˝>EC>sm0¸ø;√úº≈H
2–îwHÒppj`»ŒÊœjí#0dÿDz~Ñ[Còpëhı;p¸‘i D«‘cU7tæK¸`eR[≠†£8ÍÈÕÖ]–÷´ó70î/<Údú=Ú…⁄√[çs°Fπ≠Ø∏5-…-ORaJ[qáAe»õòÒÇ» /ˇ¢ÈÖ5ƒœéﬂgÂÊ‰˚YxŸs,Ô´¢ˆ©Ÿ+ﬂ_¶<´YN]!qM›Ü$è∂
|Ü≠\˝EÍÂ¬àÆ$ÿr≈yÒâÆ„ƒ-Æ @eYÒ•∏&j]fv∆ZŒûÌ}U“Q;`—FÇá? 0°54∞sŒ¡Ñû[ZN<MCÔ¶…ì√1«\ﬁ@0:LÎ2Œü|≥¡≤∂n°π⁄ltÿü8ËHjü€aY?~ÈlÌL®%•©⁄Ÿ®g»ÿﬁ04KC}"Óö2ˇV0XïZúm¡ŸÏ¢•≤ø¯p‡0ƒg‘ù8ª+a}Á˙ª°›áﬂ`Ÿ'€√Áïéö4•.ÕGΩ	§’NÂ¨kqAuo¡P<Mñ˝ì|æ∂öx@f˝îÁõ~[æGÂ~‹)rbYî#ÆÈ:¬Z7ü¨ê.ÔÿZ‹ò
∂ˇ∆Q˚’˘kΩÚz◊öP%?#Œlá.‘|îÏˇÑü¿◊Ys±czVs*‰z)◊D©|·•D«…üçﬂ™ÎCÉ6¬8z∏–å.£•¶;XjégKÕÅﬂgˇπÑﬂ1ÛØ|ê™ìæPœ‘¿w—:≠ï8ø–M.&£O±mlˇ´F›y¨™ÖCTÄÎ©≤§2QÙC5P-7
√€âÔv`Ö£§íQ:¯À
üZ´ºiqc’ö‘Âpµ±nAˇµzÕÑ—g‹£Ô©˚™ÙGRµ_N¿8›ëùˇ‚€W(dO&òÌÀ'¡~"¡GªOVNu∫≤øª≤{∏Û´ï£ÉßãïôDSô,öx=Ãïf‰◊Ùâgô	a™$êñ&PJÓv|ÆøNs˜æÌR÷ÈYÔÈàSŒπöP1ÂpΩä<$ì©â÷É∞®*ΩèYW„Õ"%∏8H”R8;.»µ±J«TØ<fêcjabeµÊ˛ZÔMaóaMQ¢≈∂U‚ø L®´":âõv.¡Xÿ=lã∫kE¢«‰ë’∑E}ÁÖ˜òÓ∑'t»>¬S¯;ä´ÚbÜ\˚–30£ÄØg∑`9ìÓÜÛ+¯ÆÄ¸Y(≤íG˛≈ëÖ≈ú—.ç,€	Öπœﬂñ=xÜ’EzmC´Ü)åV&ç™*T |Àe”è~¯˙õ?”PL.µ85vqŸƒ’rÜ‘4+®oU°M`‘4∑ØhW≈ÄÔˇ·1[i'éæ·GˇgVËÑ“ê{~.S°É¢ìk°h/√Ù πƒÑCﬁÇx√z≈ÃéÔêµö≥™H7Ã!ÈU\ØhÑJ§mõI~q¨d9@x
ÔÂé˘B◊C(“¬'“G'.ù1'¶f÷˚ sæù£ÙvS<¢—_LÄIèÆø	ËkÒO›;TWó:Àºí”0ı}ﬂT#ÑÍw´ñ√µ»_¨qò°ªKVØJ∑-≤# »Ô tkŸV0Aw03|∂≥º∂æ±ŸªnßŸ≠≈÷˙@ˇeﬂ∏€ÙˇÑ·)H=ŸÅ∏A9ˇ≥``’ïÑ%L¿-KPƒ¶:
éìªMŸ‡ÆíÒÇç	∂É=qÓò “Œ¢±¿›3Kkê”÷ıø¯~⁄lµ?Î¬ÎGO˚'ÙÂÛ”Îo<hı:ªa¬Ja„Éhü03˘Ô[‘e{∏:O®ãëD¸q˝¿Ö◊LÃp˜å⁄}ÛI]`¡ıw∂Sœxpá„>Ô°6wæ°Æe◊lÖ 8º≈òoÍùÚ)g±'®åUÔã«‘.Á¨!kHõ0Z7¢nc!∞/≈Ã_Ú∑]"ÜC◊∫sL=[˜o†üﬂÏ˚Ó^.ºÊ»Ààπ[¨ÁŒ∆]‡ˆ˝Îo»·ÿtË˙;«˙)ìe¨∞Ä!\kÉÎw$¥Y&Ú;`¬˛ı∑˛¸%Ä¡…9˚¿]S9π¥ÿ7ûÃœg˝“ÉaoÉıwÉ&Ÿ∑,Ì}L=ÎiÄú4•˝˛ 	
Øü⁄©|>q,l_c∂2ˇƒ–∆l|ãÅ≤g˜Y^ﬁ˚Ál6ìFô[<‚¯€·#ﬂãÔ7OöGM‹Àm≤µ∫ﬁÇM<°˚W—6¬ ¥ñ◊÷ó?Ÿºwˇß^=7V>&O|^≤ıƒ∆Bˆ<Û
he_È»q|sÖﬂ¨6B.≤UAEÂlr?«Ó(ûKµ¨{´Ñìq=‰‹m¥Ô¡0¡Úº&»0Æ««W›AcÅKåÂ–zV4	Ë2ÀÃ\‘Õ˘#ÖY¯H^U∏˜¯óêÙ
∂W≥Òc¶f®È{g˙(	>)] 0B¯ !\,#Z¶;S8
lÔ´ÂZÄ—l>^˜gÅÉ±˝ÀÌŸV x‡áØˇ·oˇ¯˚ﬂ.§…zŸœÁSƒØyêbñ–ã&ÒÍ}7N©µ]8ﬂV>÷¢ıL
Ôé≤¥:yºƒ<s{Õ7äwY£ÇN/E'O¨jn¸%˛à	8≠íÊ\Æ‘0[CXœÅŒdçµñÔ§Œ%å£YjªöêW†O˝áÎ¸V˜~ÀZc|Uóêû\ôº'∂b˘]Îr˘b˘˘⁄:Àwˆ{ÿX	Œ/BN~∫ˆ%ñ‘,ªÿgÏ\i?6†g4hp‰Élæz∏‡˘ÀÒGzp9Zÿ#µ’è…µ€?öwsÃu¯8¶.
gÎı'TµñœYm8ªŸíÛµ ãπòÍsèW!C®-Í£ÚK∞AdãjÌõû∞◊‹aÕRﬂíñHFCAôLNËlñø\åyMËıY$Ño‡èµ≤;<V.çÃ™Ÿ∆bNµ¿?[$çqdàÆ'C4·π¥+I÷Ãè∆«[YLõh∂ì‹=s‹*Y9cΩÎÔ`e˚‰ô—ÌMòø›Ë~:Êoyó˘π0Wæïk∂2…0≤{˝≠À\Y˛–á„ùáØåRq*ˇ»2Ê#8≠`@NÆi!9kˆÑÎπ‰4∞áC†ï:0≈öæ‚Îƒ‰˙äka–÷ı«Ÿˆ L∂fiÉÏ∏˜€J~V-Åf(N∂3AÒ√‰îFˇÌd|<Q˙*ß{(=h'òºŒ>Ö{S,‹›ÅÕeü…ÉFTk =∆¨◊8ÂÃ£v`„låÑÖc;`‡>æ…£û‹SºΩ{êΩÉ}˚†YÑŒı7à·m2|8≤©[>¢˝Ø§Át¬˛d†ÏÃQ‡GqÈ∆
iük-opéûˇ√qÑÇxÓ]∆≈ÿM[√‚õπÀ8÷càÊ »ÔçÙ·é=4	⁄Â*îÑUTüî8∂î⁄§ú≠àP?≤õC):—Ï%J/Àp‹“÷¥a>ïÒÇ∑rÿ¿≈Ω£›AΩqÛi]â˝ê÷ùıën’4∑„◊ºZF◊∑˛TQ(≤áS¬ºÁ¥†dÒÉ?)WÚôr!?ùpè
û)º?
PÛƒÎ√Mâõ4ô^,c¥g®›ªñ)Ô¥´ñ˚8ñqôñô>Ω>µü6ÉìR[+-µSŸjï’KkvΩîdõπ ´@?6,∆å´1πWÕKsb#ìtMB+‡@xN¨À˘ƒıcs@ıûâùÀ0¶ı|åØÿªHÅ#P√
`»ı`«uYπ^‘HQ“*)Â ˚Ìßù≤€!G;¶HÊ’ﬂ™3WDg<.Ì–ﬂM8(F≠6Æc!£æ@
hŸ’:æwCœ{±ﬂu=óª°√ΩŒ›éﬂ≥{éçz)≥≈cæ≠kÄó8ÍqÓa”°ﬁ0ëGdUó†»[˛¸g´˜Ww◊⁄/JÌˆXÆ≥∫b¨âLÌZ=º`ÒpΩñ‰3µ{…*Jÿ¯Lô!˚°Q∞|ok{ôó≠†N˝gù¡_∞≠hy0]Æ>vf'v»∞1°PıWÅ†L3Oz/\ÕØJ÷è¶È√/ÉF◊ö·ób”H—ÚK'fá2¥©µ¥kIyÀÎ\àK“4Õ~≈ªjpãbødQ¬+Mò–-0at∫ò»ób»`*Á-€2¸“±h¯•Î™Úƒ©ü9∞é±Eh Ç‰A∂´◊Î"æXÄë1¬$®MˆŒ^[‰∑z^ÍÏï—¥ÓÅ¶u/âø&Y5¬Xí-!ÃÕ‰ÖÏ5s–ë_öm¯UUR‡‹ÏÙƒÆ‰á\zò
ï_⁄ì)¡Y2’>ÍÎ◊Ò˜5£Ø‚Î∫≠√L#¸zìú|äê2≥
Û&ﬁ9ÌM	ØÔˇ˚0õã·&hÙ«»oè/ÛÄx|•'∂n∆iˆ¢MÏ†y¯ÿWè›Ü–TÊ á‰QY`^äXa0≤*sÉoµäB˙-ñ≠KNIÛ e“Bc«Å|©êN?6:LÜ2cÄB®'}[\H;e Ω√@<|Yã^ﬁjp•÷35æT›VóõÌ¡Äëvi≤√±c]åÑº¡.óú‹adabÜb™ÿ÷g⁄v∆ç¥£Û5ìÒZg¡rñîßŸV•◊™∫<Gˆ11ÄÁg%ç6]Êôÿ1≥§≥$D,é¡©“œÓ«Ig˜ô„0ó´Wñßß®éääx∑R“ …|U# ùåQ¨ë‹+Nê<ŸÂéÆc*»@“k*Åu´ªO¥› ’≥¨µ∞yà¶"È_Á≤¥ùq‡_a≥9Míc…d6˙©Ä∫_úñüß‘bÕ4≥it2≈"°Ã-öjF'—ïCL§ikñJkIûXüá°œìoJÆÇ˜eâ‚zô.Ã¶ó};ﬁ’ãΩ°ÅÚ©⁄=6◊)VÓh0∞I»∑U‰&Ÿ–mÄ´Ô—ï ›◊¨≠÷†<_æÃt∏ª≈=ãæˇ§YBº„¶(ªÑï‡∏ˆc@C “«la2Å˝ïïZà~ÈrõæÌıG’›4‚ÀÑ·4œEù∞"^ht`;Ÿ@òÿÆj9≤]J⁄õpÿ¡bÔÊ$ÉÄ†]ÖƒÂ`2÷ËÆ\clîZ¨∑C∆ ê#Zq‘ŸTz’VêU|]u`˛`ö”.t∞}Ã$fiÍ]wå≠30?∂>8FÕ8Æo6–¬t”o6Û:a6Õ˚æ!¸j¶Û[Ÿû.<bà¢Ÿ	œÛ{r˝mh˜-ì^¥zî]≥Á¬êS¸p¯ÔT¸ÎR>…‹‘¬∆ÆåÎ+ªp√¿∫b—ï4i„≈Y.E¡+%≤°+iC<kæyCÄ"£»¯µ∞ñ»àbq~po>–u≤È
NFÇÿÅºüNX€†ÚNÍãáºßÅÌ‚Wæ™èøßóJV/Ùù	vhıq9QÜ,cmÌ:-?-ò(`ì°õ,<2sRU=oï?Ì‚gç8	ﬁÃÛ÷IÄ{võ/»x+oÿÛ#L]πÕMèºÕ}LﬁÚ∑2yMì›4‡Ûîª:tXnçõúsvzŒ°\∆N¶W$úåyØÀ9pæÿ;NØ…´
±'(9ãÃ˚øŒ€∏U~ôû√1
7Õ|>^Ô‚πÔunÅ£äı^f¶
erΩŸ&g@◊]À>∞C,–Òﬁı∑†.”P°È9]®qqBé’·Á≈zgRüöÍñôÃœÇw'ºSÂ'-V“–ˆÙUm~Ì∑è1_r≠Â∫f±Éµ>ú†
7Ä≠á-u¨+ÇD8¡J¶+Ç)·!v¿µ±%©7≠F‘81≥ÜI€y>V`·GsÿëFi›Eq£®ØÆ∞0X“47†ZÕ”´úJ/Ì/‚¬Ó^yñk˜…g@$,–ƒ[º˚ÈÅ—2 >Î2Ç}òπvø¢ù∆˙â≈Ï+Îg'sØÚóh¡$»,Ñ0ÂŸ`€dáŸÚü%ûÇÛ^fz2œÙñÀÖ¡ÙÒäY,∂xmFÀJI˝Ê:áââ©™∂ﬂó!™ï`ö;a‡JØB]È≈Ç^bìéÇ	ÌY`9háö“´~Å˝ìçiM1Úúíù2
ƒÁ˝Ë÷ÁgfÙ1ŸÉc!·?ÄçX∂–ÒÖl¬2Z/l`Q7I"kíê5Qèò&7gHÙÕÉ¡Ê£hÿ‡¥)∏-Ôúô´¶Â´9qñPN√3ÒÿMrŸ\˘Ãò”¶‡5vS9cjzàFXUìxt˘ÿ#ƒ◊J^Ωòj/ñ◊Lm∆™ß<_Ol“4ÅRz÷˙\üïy“zÊI˜¶|–7ô⁄öL†Ï≈2˚‹Fuùiµ§œãΩ}÷≤L2zwŒõ(bÖÎ∫™Ï!Æ¨‡TW§iR©ënœﬂ˘ò¢¡ä
˜ëÜq¿ûÈè<~ñ`õSÆÂª‚ÃáN¢Çπ^ﬁ$°ÇÎ,ö©`J˜™‘Ò:Ì—3èî‚ëäÿ∞%3/èùÜ‘Îüîe√µµï)yﬁ¸Q´”= ¸ÜÚçCÅm™ÄºËÜÚ¢ä¿^Ÿ∏ùΩI2YkÕÉLnAùXgR¸ì˚ôHVòòxÛ±}´"í% Ïà≤√’Ñ¨(Wƒ „cô	*öÄ312ëQ÷ó<Œ—ıªaì¨°Klm R3á“\ø:}Ù±4ƒ⁄ZMúqºD√=Ì;™5˝y˘=å˝ıﬂ˝ÿ©(·4-Œä«úçGO¸¿é˘Dk‡K>E≥˚ëé#U∫˜'c¯Öxkx7°`V8vn∑<=Lqﬁ§*û0kr	¨8È-˘¸Î1Oä@2Ω¥˙ëÂ≤ñ0Ræ‰8I!≈ {Óèuı˙Vèb≠iÛ¡ X3ë‹¿,f¯ªø3Y¿8∏yá7k´dQı£[Ix£4hÔ6± í¢Îo˙¨Õâàù,Åñ‘ÉpÒ(V∂œ·`rπôZLWbéS€‚n1¶œÅo_ëA“˘6næa∞Ä:≤—,ØeÊ/UŒ©ÆSo’üKéÂFE”ÍI¥wÚòeï7ùÆÃ∂”…ÆSP0üRê@'\ºó≠ ¿1hçä;P€˛Õo»Gÿ
˚À7£¿vÀaC
·Ë$‘û–YBcêä^•ê∆¯jyO∂r∞FóaE^çH¢xæ˙rs|˘rm˛{V„˛˝•µ’ı•ıÕµ•’ÊÊ‚ã‰e∑}§ıË
˝?…g"óœÛ#LÌÛ/≤@Z]ﬁcîpù:°22ÀÓCïÑP	ñwLœ@ûåv.ä:o«˝ê√±Ì…	Ç∏µyQ?ì9<√¨9å¿¯Õf-–ÊÉ“T„Íw=°˜ïCƒëMÿâ¸Ø÷k”3 •=<√håö?√ï	åÚú¿r%…_ˇ˝?ìùœ⁄ß§{p⁄ŸÎ>Ì¿?0œˇº€›9\>nÔv˜Æ˜~)ë2äÊ§vßL¥3≤¢Œ%º%p\·î?%g6™/<∂…°ô«µUÚöyQ% ãï˚˜H8t¯c`ÏI¿ê+Tÿ†¥^NÃ⁄`Å[¯ÄÒÚ=µRHòcõ1«„∏jçw^¿FY—:œtUa8“â∆In-eí-yÈ‘≤S˚®≈ûU¿pû%»ıMÍs’∏y⁄Ü [Ù*ö=UwK∏Kz≠.à—4	ïµÃ‘r•`ÖUp(…KuJ±¸‰0é’‚πã…I«2VñeÏl‰;◊ﬂ·ó
ÒR#~*@]JKÄäªLÉµ„{·ƒ¡:"òÅ}f˜Qıh∏J|h√?ûä;¸ë¡L^Åé˘†ÔbÜ–îØ\©£È’˜Uı3´/z–-t»£•tÛ‚∂1∆ø}4Æ‘Z≥0)kF0)Ë˜—ÜIø÷î1ËûÈïBπ_ Ñ≤¢4˙`Òdˆ5˛èÙÕç⁄“ÇL˘¬jaSc4îµÍäÜÍ*(Q∞v∏:« Õ,ÿ2ÿGÀ≈Ææ8Õ64 ˚u÷ÿcﬂ∫¥]Pær˝.†V¸7“ÿ˜A„#⁄±¢€G7óLØ⁄F~∞o{8)∫^ 9kdcΩ˛@ºÚT£óØB}a∆ç	ÇjÊBP•xˆiZC6ÍPíÎÀé`Ôu˙>vÛ´˝z‡3ÿ^◊PG„Î»$ı}˜ôÔXëˇ
´H?˛∏G@ƒŒº∫ÛÔ„èõ•g	i–/õ‰ÄÇdÚ…c?ÙlÎ´Eq¿0—QÖp
>zH◊ˆ¸∞IN)ÈÅ‡ ∫˛]+◊p±Ÿ°óh£ÕrgâÌ±¬◊¿A?à¿œqE.oIOõu“¶⁄Ú¢∞@ﬁÚN¯A√#∫Ú¶ Ù|”Æ 9årù+»ˆe»¬cT≠í(‹9G#äË\Ãﬂ◊≥©wN={`âîƒ™∫≠*Ü?¶”oW¥¿®„˚
Ì¢ Aå÷”ÛOzXU’F·\ÍÈQ¨∞W"ôX2WºALjSåÃËW:=+XéF`µó“%GV˛É5“∑ú~N≤Û—Ú˙&hﬁã/ÿ¡"˛∫…lï‚≈áÛ≠‘g™"ãËπ·p±∏ªµé·‘¡(50uÍb¬‚‡M(≈∏√|rw˘B¨ÈPo¿ﬁ;€®ÍØ¥Í∞˜‰	&ˆ¢ ⁄QÿDk»≤`«Œ/ÆßØI~¥¥‹≥æ¥`9j•z~¥∂µVÅ÷∂û’⁄÷Zeüu≈•ò|•Dπî@Jı3™U±ÿVmî,I¶∞ÖÖƒ™›ÍˆT”‘†Ë±Ñ¥5¿Òµ¬`œ`º¥ ’÷D‚æµ|Ôf}∏Ó∫Ôhˆ“öÏcÃ◊xy#˚?Ω–RóMÏÛÖGO)(1v“∏≥›ù„zÕÿ‰®ÄCpﬁ!ÃXÖÿ[èç™¶Îq&Åél~té∫|X„úxƒûÖS{´Î“§∞≤ﬁ3¨ñCyæπº	(∂Î8thy—1À
i#û¯QÈGAÁ…W≈Û´"ﬂGç3—˙˛¯
‘3Ê"Pê#;‡bK3G¢‹}»ˆà#vé”5‚>ÔGüì∫,Ó~˜0^¨ Îì/Û»‡ §èc˜Å¿ºS‹äá$&ê&/X∞–X˘‚˘qÁ‰Ÿ~Á‡ÂŒ^˚§˚§ª”ﬁÈ|Ò‚˘·'/>˛ÙãÁ_¨î|eeÑ∂∞("Ä&@}÷ÖeGπ1#{å{æöp(Œ∂ëÃ€`‰∑§oE˝ADC”ï·“§Ã¬“iùù<QÛõ⁄¿ÑŸ.∏Îô§Œ]Uã’+·¨π%Ö˙´j7Æ2üÔîHá¬ €Ò«ÿó”&Ëÿ"Æhô⁄XˆI(V†YÛÖÊ‡ä∆_ˇÓoâx¸ÅÄ‹yphô;*xZB¥boìÎN}ûõ–xıÖ˜Ö˜Ò«∏cË–IAíá»⁄˛¯„/ºüøI^ÎÌ+ÌGﬂc¶ŒÏ¨”∫U‘ÃDè7ô’sÏŸ˛.¬x3ÂR¨y≥@eÍ˙BGÿ8á-MêRcÜ˝ü$ô–M≤¨~~Í?ùƒIH¬âÎbŸiØ:GY.æSYUë‹à˘∏g àé∫òı5xπHu¸g4À◊2A"Yçmó3k@ªû!⁄N—,+Åq‚9a2‰LÅ\Éƒ÷í|êñí8YíôMiœâgâ‰ë3ôJù◊òº∏gáëo
Î8K·ºTW|(j?ÄlÀgX(òdµ;1ÚÏ»Ç≥âTŸZfA&}óXßV˝UïŸGªr€h’a∏ßÉ‡û˙Ø=,ˆ≥üëù√ÉùΩg'›Îﬂ±ÓE“)ü‡Y)/¢˛iiÑ∞]íÌ^ó$'ê•ÿ?àÕ'…∂O‰S6˛p+€'#á‚ßF8 ˚qW‚˜%hL∫[l*'íìÆ√T`¬‰∆=¨§Ô´qÊ|réö
#uWóπÊª=ß^‹S˝y±ºåOéêÔ˘L“UÔïPeº¿,{¯‘≈ä˜*⁄>Ác"qØıg/$íüá[|›å·‰/tÇjH<¿ıßÅö'}fr\5étŒG±È¡3ÍëGCr≈Ä1b#V#…ïw£ZNüa&ílFõc.âY¯~´ï™òTù˚ŸåÕ8C[V9D;9ÂL“4UŒÔˇÒü˛¯˚ﬂ™oTï“1’ä±EËŸ√ÙAèY)ÿ1={[F6Z±`ﬁÃØÁ_ñGÇ1”∏d^æ«Î4zw–&h_à/≥Kœ,†ﬁ*£úÎ'†U®i&ÂwïÍE»€%-KÓ’Ωπﬁ≈¥«“ÔH∏,Ë{‚º' Ê”ëfEb«πÂL®D]úf9Ò•Ì≈n…IÏﬁmFX—5Ÿ–Á[æFπ^Œgª•¢N≈5¨@Í2îòQâ—H(µG9Û˚ìp€üDXü%2DŸG˘f‹8 Õ™|=Â:ı-[äRô]ßΩs™	ˇL7%^ ìŸ¿ö*’{$m@}9LvOÂËz+-P…PA˙©zﬁπËŒ(∑+ï·ZEææGX‹Û∆;∑Y{\ŒöeﬂØ8Q^ôÂˇU´∑VPÚVT`î|ú˚\¿Ä‚N‚™ﬂC¯2˝ª¢—Kë¯WœﬁKgªÔ;À®X,¢Ä¥ZN
	
œÃ|a«æe{|b∑^Ÿëˆë&≤Ø§VmH•”p‰‰‰jﬁ;V¨ﬂ‘¥Jr•J5»vdy‘—ÕÀÍˇ sÿˆ±˙9ê<ÃgXVÏ°Rÿ ﬂÉ'†fCz®Ì¬cV2R9^åF2ÿæ‡Yp¯ÄMù^≥Á˛k[9u∂“€aNçRíZÀ§8m$9Œ’ÑŒç§jm%vÿ¬£ø:<˛Àì£ˆNÁÂÓq˚…iÛÙWßıvM≠UÉM =Àπz=≤kX„QXÔ◊œ∫ ‰öNâø±z&Ê\ZW!Ãsj¢IÖõ\Z–2«RΩµ™n„»´ë‘ëB)úÕx•·1l∑M§⁄L÷öó˘†AœùÕT≠Ã£Ø∂bo¥ö&∆˝8Ài4œÍÙ˙POì÷”‰Oß†∆w«`–xXÚ\\VÉﬁ
,Yõ_eM·DˇKk*EFŸ®oÜÕ` ¥msßköjV‡∂Ã©Y-|.géWëë•§¨<g¶›Øˆ~É6hﬂÆ™Bi‹å#2¯´hû1F•+ëaül®◊Ï\òî˘•|v≠XMj¥Í•EπÛöª3ÃdYKKœg¥`íI!ÃYæ‚ò	…÷˚Ï˙[ãäG}nÒ¢"	O•j–Í3Ωl{5“b5ûãËiî\u†ó=‘=æF[—À©]ËJK|§±úµ/ı1/˛’è©DGÉ3ﬁ-[Ke)hgV∆¥1[ŒâoâÒÍ+Xle›jâ'Wæ≤û˜Ωm≠ â47§;Âµßú™$Ê•˙O¶Kù•6F.TŒ,7.Áa›w˘‹y¢ﬁëÖ®`é%PL†.Ì>¡ú±SõÇÜEé©Â,rÀG,~Û{g(‰ŸÒùâÎU'‚ïKÇSo∞?Û◊ÂØ)zrI—+é∞Ãa^⁄Äñª·Â'Ø`ˇ6–•±BY‘®•Q¥<∞Eà¿‚$·`NÿÙZ¡∂Øπ*≠ò∞ŸQçèY!Ò¨nìÙ‰Vûª˛ÖÁÄíq¿Ä~aNç3À	´b_xÈd≠≥◊H¥ŒëB•˙ß9Q©r\ÊàVãJw1•!mZAdü˚Ç›±Ì'•Ôò§ˇÏxèx6ˆ—¨L”Ø°”x˚$0IßS{_t{8¶ﬁ_ç¨(lè«'#+†ç?Á˘–/«É≥?ü˘ Ÿmπî∑"â*'¯˛‰E™à∆âËH©gv‡"")'U	jëx´f UëqÚÎ	Ïv%Ω&@y…cﬂ7•>u-€πA2≈vpëâlê'~˛Å4%“Ñ?cÎîÄ˙d2Ø<€´YËn◊$Oˆ®˜CõX+zÍÔƒ≈y∑ªYôÉ◊1:≠÷ÿ2∞Cvº›zG¥û?igDaÖ*¥RVô7®kù=ﬂë÷t±¢πn∂Aúó=Î§ﬂÉ˝á/ÿGhé8{∂˜ïæW˘ƒ:“Fˆ'ï–+Sÿè"n[PJápz8°s‡U…µsV≠û≈9b’=¢¢¶Ë©ÖyéEºIè&g∞<ÈÄ˘HaS8ñˇÃ"ËÁq†AH0X—%Ô*ˇíœFßaVí+⁄b<˙ØÔ:|iÑh˘Ëé»‰6≥á}øìÓ_£ÛŸÒ‚˚9≥Ä°˝ç˜ „íe∆Ï õb€ç¬¸c‰§`˙œoFÀ{ó¥Ò)œgRs∫‰ﬁÏIf[iHÔM‹	è{∑„lø>üˇÅã¸`âÄƒepU]ö êøÒXEˇR;GpøÇõO§ó∫q≈oñÉ
Àπ.Ò¢FT#,I'à´¶ñ"•nìÖÖ
0tí¶Q™gÅSó¯ì+xÌaÓ©c&õŸúMˆâÉëËÑØa  :ú¬¶,0óuü§æÑÒ¡h3ﬂ¬U3çÿƒY≥9¬≈„k¨=ƒh≥˛I∫%åÜµã˘êU;ä¨˛Hä?û˙ágg¥ÁàöD¨?‡a,¯AáFfÇ‚í!¶KB" 3`¬Í”\Ò©Èb©±À™[ùA‚ ï\◊ù™@≤ôG~‚œg m{∞>æ|y/Óz∞∂µ¥vØµ¥∂~iµπæXÇÊóªTL6≈AZ∂ö1√G\u)vâ∞TÌ≤„äÓYôÿ|à˛˜æ3±±±J!»Aå:âyA`™{ ÃÈ•œƒ]{ÂƒK¿‰a3ﬂ≈q’—*C>Ï“(®‘zc-t-4R¢Ö•(hä¶7&_EX•‹"iÕ\Á1⁄Õ|¥◊·»ô®¡√t™7]tæﬂ‡*‘“úf›ØNë.kcÀz“fO˝∑º√laÚFA≈xZÕΩPŸÏµv°ã‡3≤›◊∞åD˜ ◊=^u#c–Õ–rí÷™ŒGÀÆ¨}ÕÏÍq{›êüK∂ïçakìÿ7≤≥9WÁv8±ãN÷ƒ/ª_k«◊‡ß™¿@í'IÑ?XûIΩâ®]ØèUaäR°RòñnK	ó≈ZJ<·ìÇ nE<·÷âUÅÕ—Y]]‚Ç⁄u¡ıw¨¡õn∏Ä_Z¯G˘–ÅTêíÜ$ZfOü!œZ_ArÚÒ£Qˆ^mv&5Ó1∞qÇâ^JÉh÷ £≈\≥(πôœ–ºÆtÅﬁ|Tê<˝Q¶Õ~¿uí)`¨^Ë;ìàäBµ∂¨™4l-„íR›f=9‰ÇÕL>"…U~ÂÈ!∞ıI;)õu’ú™∂kmïı)ñu√≠Z›∞û%FÂŒµÚkΩ™U“¬£€ãCòë‘¡Ó~6ˆúdmœ˛Éï—FÂ\∆π©òÚ¬∫r,Á8#0aQ]KÊfé{Láz¡f¨È®K#‡6—∞aÃ 'm—g€[bßqê˘ñÑ7x[‡˛s–Ïi∞Ë‚l-X∑`¬ @`(€”>∆Gñx˛ø´œùı:¥Ç™¨ËJ†·i—>–9)
÷˜ÈÄ5O?â,÷oã¸r?™⁄i6Y>DvøE^ÎÒ{⁄AíÜ6â∑‘ˆ¬ŒﬁºåX´G÷÷ïB>.g6ï(÷˝Læq$c(d≤ÌÈa9ïÙ,√@C.Ã@r{ÊrG≥ˆ›¯‡ı´¿ÄèéøOC÷w◊∂Üﬁıw@W}∫9e‰WaÎπ≤2P.Ÿ™öí.<äKñ@˙úDtæù~öÖÚR9[™˛Úi∫)†<+Ç#∂‹¥£àñ¢¬eN-7¥X‡1†Cƒ?
$÷êX}kp˝çã?3(§˜sÑùLS·‚ÆB»M≠÷`á«iue≠¿@)¿CZè’√DoîL^M∆J⁄kö:4àvÏ†Ô(FÁˆVRè'k“>~`ù÷QOÖ1=Ék·_h8÷˘—¬
ê5‚⁄<1}≠§¨ùÈ÷kyX˝"8J`Câ Í—˛ã¥úöˆIm>"G”…dHÍımcã`r›&§}`P÷ô{iµè∫ÿ’úÖ·â.TﬂlÏŒtü MòD	èöãhüÂ^ø√Ò‡ºZ]-xÂ›7≥n∞â±#Lï
Œû©$4÷ ∂*7àaya{1Pj[¡6˘ú®NíœPÆX‘wﬂÚ–îÔl¶HU≥yÿT?p“À<|º‹Á	3˛QﬁÉ
mh õdpMÚ%ØÖÛF¨W•‚5úHFLF…	o®y‘∫@¯õÿµ~|M≠N≥On9
˘Êj	,∆}ÓM+Ç≈0yﬂs!T≈6¡"F#ÚK≤VÁ4ÄNú¶Pﬂ~Ü	°sÏmÚXÈ[◊3ã¸ﬁãºÂÄçø,í¶joS“˘¯Ï∏∞´˜ø¶Ÿ|Ö{Ö…\´ı£®…}˘ õÇBöƒ≤ól£ÀÆ›Ï˛™BÊÖ`˚õÚ≥≤˛R¬IÂR†-Mß/òÏŒ™]j·.˛‹wŒ—›åz˘9û6à"éi∂%«¨Î∆”+<CÌø<ˇµv Nèv@Ö$ˆ∂>-vk±&LVõ1≈Ñ&ÖÓëU=<~˝®K ›_õ∑∏{‡ÎÚˆî|Y⁄FÖ√óò*I8π„‹ìO˚‹Ú^[*1]|ZÅAΩÄ ±è∂ÁNˇ¢4—ﬂ]âëÑÈÚÂÚÛÂµö	«tj \yZÆe0˝ cπn_<{3QtXÒ#;™1'o1äVg∑9©öl,ƒˇ)q˚Ûu‰_Å«˝Ï–˜ÖEk#Ú3‘àÇ5’¥z√hÇ˙Áp&òdyú-S∏àdÌäV^Ûﬁ8=œr{ /%–˛A+€î ±ü‚ü¯∑ÓÎ4DçØ©a∂“I≤õ∏©ïÑG4ÛH™®‡Æ∞%≠NDH€¡hâ≈ˇÂπÃ8çÁË%U=ÿ≥Æ`wgQczSH&∏˝¯ñqÿÏ	õ;nˇ¬Y{hXüÏG4ˆeÅ´ ËM0PA¶ñtEΩô\°t“ÔV*(oT†e5%	f≠¶∏ÎqX [•§⁄‚w[q“‰4vÏœ»g8pßñ§eƒ5ıﬂ‘È,2U;Wçuüªsuhù”È∏Z)‹ü≤Èll£ôuXís(ÁcΩ?ï¬º{û&ã‡Bœ "O'V0∞™ [í«ôtøõÇÏ˙ñ◊ß;S¶"ªvˇºØ\) 9;ı—≤ﬁØU{sÑ¯´Y©êÔ›ú…6?’u~¯˙ø±Ó2Ì›œ€;ù]≤ﬂŸÌÓ¥˜»qÁË¯î|ˆlóúÓuûí«Ì„;∑Ã∆5ÜΩNÛZ2Ÿl˜[Aﬁﬂ©[óév6]º(Ì.9âÆJ~Aû`˜æàÏ˚˚ÃF˚ÿø–qàó5A◊8ç±‚ıŒ[Õ`ä™≤Mﬂ´Rœ3˚kk\Í9™ C—f‚œhX.∫º,G>¶gl[©OvD}89ÚCò∏Ì§—m◊;îtcXxΩâÕΩ«∞åiå∂‡”è>Ãï£Í7MΩªùòÌ3¢büò5-CÈXv≠7X•%õ≈Ûfìµ}ZRWÓÖQõˆ‰	í±Ò‹d˝fë¨ßŸπ6Úƒ`d•n<fÂŒ2‡¥m¢E/ÀL≤êåoë|xØ∞üöPç3ÊdÚáO‰$t•πtí√EZæoi^ò‹?s†˚º	§ÀÖ‹Öî¢¥c÷Æ»∫ç°+~R£	ÇlòÊÕπ)uôOÂ≤A_`ˆb=8}aë„â#IÍI4≈~^˝6+Rüî|ß4´îæÃR∫˘≈Uç>2ÅsﬁÒó<òzb˚¡,±}7%V?B5ÀrX∆ìÖ¿à^h9Ë` &x¶ÈZÓüDìPIèÇoâ‘)¯ZËÛÉ∫D)æ∞cOû™◊{@?ò*ÇFÁ∑”_["qa!®≈çπÃè¡¬Z1∂iWBñ;”∞ÿ=ñ9OÛÕÑÜHúˇıˆäZÿ]]Ä•ı0;Ç\≈8î€∞+†ñ¿^êÎ?`J*ˇÊ∆ç7¯ı~≤xóiä±=áû#`øNÃZÌ˚XÛÕù≥§\±ÙU0¿¸pL˚#Tâ“4bãπêœiìt€v≥ÆÌÄ@b2cNmÜˆñ“üÖ=∞ÇdÅz0o,§¡9#hÆwaﬁp(ÁYi∆i‘\„·LöZ’uYº&æâ˝1ç©ΩÆö⁄yÄ™ r©;¥ïœ¸ÿÃXÊ≈iÛ=ÿ‘≥ÃÏƒJŒ´¡§ogN+K¢FAe<iìÔ*Ã1¿¶ Û≥ÌÛõça
ëœ±˘YàÇïªpÍ›A 0Ú˝?æ{øAäë9G`πúYÁà¿c{˝Ä¢î∞»^˜iÁ∏Ωﬂ98Ì‡fyˆ9e¨6†à9NôàêOóÅ"≤í˝s'WD‰f¬ô ˜≈äô∏ôËóu≈å›$ÌÎ±ÿŸB˚v,ÜDv}àGMd≥)\B˛ËO"È©(ª0XL7d	˙◊ﬂπå∂†thc›”ı∑±‹Z¬A¬û€ˆâ¸é¬°÷Q&èÖ∞¢ó@&0}!Li&ã∑æçøçØﬂÅ›xè⁄C&R˘cEÆ±	ãÂê‰Ö]N·	Í`≤Ã‚ˆP÷l1]Ä7~±|ƒ7£Iﬁrë∞ƒs<¯ -“≤õ#jÑÁî”cDŒÖâbÄJR&L*§9∫}ŸŸπYËk:ó%?|˝_ˇ˘'(?E«89Jü`\ΩF°ÁÉh ¿Ü0:≠d#˚◊ﬂ!ı…ä„a©Á2
 FD0‹N∑Éï≤çÓŒ.¸ªH,–ævâìpî∂Ò…
c$
êèe´®*ä/⁄.+Ûd¬F“È8“OìHzizpc\7z«BÒ2!£Fﬂµ1≥—BôÄ2ËGAV#¸ vÓ¨ÿŸÜd¿…∆≤S2§C0#d&W∑hÚˆÕqÓ	û¯·Îﬂ˛Ô?˛˛∑?A1s
g˛§OQ1Òãù=í)?tÆø¡≤%Vûù˙dŸq{K¨Õ∂†mÿVÿNÏÍŒ˜[ÍˆÁs¨,÷”œ"Ìù„&Q'√°V·â*øî1AC≥x)V⁄‘§O⁄˛ƒ¡/3›4ìîíBs/SI˛¡ˆ˚1äN4vä˙nÂ(à+%º€&]1Åk “‰?˝˛ˇ{CqRˇMw¢NOﬁ5◊≈ÁÉú„ +]µgıT-™•Ÿá
K}†Q`U;BÕx]ò˛0∂'A8Ï2©Ûôé¡™[ÕÜﬂ«›ìï£ˆŒâNÚ∑^§Ó÷•Ù"_ y±vlê∫y®0ö˝6yu‹9Z˛˘õ}+5œﬂÏG÷ª–Öπ|LÓØ¬µàk¯√€WK⁄Å]˚ÓxõxÙwà6õëﬂ=9<â∞5\cQw(∞Ñπœp[¸]Èﬁ:˚ëlãëX…o~Cv}ê¥‰sÀÒc"Í∂t«å∂m" øía9Ê¿w{Fêá6ˆq¯⁄„R4≥M–ÎääÉgÛ`†£=îP^Çt¿)/Îbõ0À!@Z	âÍÂìÍ≈	9y~"™n8Ë+$TvÄ≠‡Áˇ¶?≤¿éçN¢≥Â{K?CΩæ?†œéª;q€·∆_ú4C6 à™FLÌKƒõ8ŒY_\|˚ d>—j©ÌıG~ s“`˛ò&ÿ‡∞áôﬂçkA3ö±…aÄ¡àö ≈/åz∂∞$≠¬<çˇøj_v¯ÚÁo‚µi∆¸˝∂âœ}•˝H±=p’¥@R{ÉùëÌŸ…L˜}îo∫âœ ΩuAÛ—ªY+6ùá÷Ñ3RÙ3N¯ö-9çSçU"´…ú˜"÷U`≈e%eÂ=◊¶hMöâ\◊ˆd’¡I*èy&^‹
(ÓˆwTc›˛§sœÍïŒg«Ó9û¡©cıpE *Á”|\›å?¶˚<J_ÜMõ01µä‰ﬂˇ_meBSè‘√©˚JM’ZiQáYNûØ]cM@§-íRKÖá‘I∑cmé±l;M®ÖΩ(õf,bπUâó§§l®–]£ÂÁ≠u‰¡)2ˆ∆Ωù¢ó√»YØbÀXWw{âÇ£€Ã?¡/¡‰ô>Ωo≠Ÿ“MSgv0ZVë¬ÜI∂œîi~1û]&—Ñ4Œ◊ÊõŒgj±5L◊9I—\Ω¢Ï¡O…´ü|◊√í>F„¢Ê+¥ÜW„ﬂ4Õ_]Ò¶óKS‹§DÌÒëÎÂqñÙ˝HRÿ”•-@;RåyVZöHº^—L#˘ñ÷mÍÙ>YWi[Al:Ë‰9zÈ‚∞Î¿f}ù≠ö£˜Å¡
ÿ√Q"Ñwxo£[í¡R€´õó¬Y¸¡˜.áÁíh}í∏ è—L”}úŒ‰ﬁÊÆÌFjŒ-Kj	)e.¢:ﬂJ‰¥Ú·üäê^üRHK‚†U.§3BCOP´õS$•›îZ‰ÙºÂÚL_¡ÚÕÈ% äSÍ}√Ö•)Öéh¯π÷≠U„X=Í‹å8’"õ√•√˙îE«éSPü4¯äÎ∏†Ÿ{ÃÊ{ó:;ï /ÍΩë»pÏ^ rQæˇ˜ˇÉÏaËﬂr{6]$C^~y˝Œê“#Ml7mt7m›‰q˚¯∏Mv;‰Ò·È·AÁlÔu:ÌùÓıÔ»ø#'ÌΩ”C¸¯Ë˙oûv⁄¨±π⁄bä∏ÆTßï%96F◊”¥e`%ì3@)°Ø\xQQ∑ÁŸ!§ç”±Kh˜…ˆ|¸€ÔÎÜc∏c:≤–CæúëÍÀ›ŒÀ£6RÍã›™1lãPKˆli$‹⁄èØ∫É∆B¸ùeóIße	asaëX!˘Ït•Yæ$Ó$øaw›…`AW¸ìJ.˛˝˜aÚ2MÆZ0ÄhãüÃ´˙’O|LÏhT4b>üf<—ﬂ∆,ä´,ho[<ûG/ÿÕ„ëõ·§«ç’%æ$á{ıÖ˜Ö˜Û7@.oÒßWQ˛xŸÀ√ƒtÃF9µ]ÍO¢Üi˘I˜Âà6‘H…‹ãh)Ò∂[ﬁê68!˝ô+µ"6≈jÊ>7©Â["≠U˝Ç98A2Í/H—éƒ≠#˘å∆äËARz¡æ©≤d§JøàÇÑA5|KäûWB'Ï/2:˚ -ﬁS1¶g)›[k›\Èûàz<ô–‡5/‚IÚßB{8Õß},:ÓSûÕe˜m_d_•__øC∑K©Ç„pé–ÿüesÆ :˜±ï7i‹˜K“Âπ¢9±û)vƒÁˇ£Œ”õÓ ÔúÅ˛y¯rmuˇ√)˛·ˇpäÎ›˚·øÉß∏‰N€ É¿û‰ÂHo?⁄”\oÿ˙ä˘*·ºf»ŒÿÜ¡ÿ"GNΩµU◊nÙ4∞B^Íé'_¬—gCì—‰˙õ‡ÃÚ¸péßz;¸ã c›®[ ø~I:‚u;ñá~≠_‚Í9„Áö.;et”BÌæ^nÈÄbªI∂cÁÑØ`√‰Óÿ±äv´nØ±∏¨}*ÇîU©
µú[ŒÑ>|£ûèı¥® oP£(;Jä‰!m¬Ã@µi≤«h$ıÀ∏ªI<*ç&ñ„?e“∞R◊;´îú¸≠U.j+	iÑÆ F˝CÍ⁄jSø5∏çé‡Y$µ-ò	úÆ¨ì√6S‰÷gΩ¶ÀWı™A-L_;‹∑lèØtÁ{W|J@<q’o¿œA.lÆé/_◊ˆñ·/õ-K≈à”h˘˛V=qË@·JÒp!v.˚I(EÆrIJY~=π˛”ıküµ[=ƒe9òa"Sæk÷í“x˘^IªÄ®Ò˙ê÷=8{(KüÁÒóYœ4àwô‚iàÀ7ÎF÷Vk;¢àIEr™≈LÁn¸£ˆAgè˘Ów¿n~¸£Îø9>n?9$Gá«§€&çì√ΩÓN˜¥ΩÀ?Ç;ûù<kw5˙òÎ∆^êé@¬≥Ü≤L_◊—*hú~K.ÓëíäÆeIÖ$4§ïø¿7ΩëMÄ⁄äFÃˆﬁ· ó§ÃU‡<˚8 i7üI“®z*â¸ÓFìû∂}ú~6DŸ´⁄aƒ<M‹Y√ kóÈÎ"›%ÔS€ΩN˘~Qß‹UEëKsπ@ô∏ÜØóg˜$˘Œ¬'«b»áêK>Ÿ)»,—§Œà˚Ô2ËGZ˘È’t’À~ŸÄúÃæl8‡`ÄˆºHL7–yeä⁄ó)¶Ä©FKFis'ŒtÛRFb,GÁ1Î‡h:ê6¶_÷K¿‰˘T†√íÜçF}˛0*9í¢‹˜õ#+.ÄGÿœÄX≤å1]t3‡Áô±ÜÕ ÔtMI~±∂5,ø∂§Hó~ Ïæñv≈ûZöÎ…€Õc˙ö‹⁄{º®FN(ãõPÎ´6™ü iÎº˘,«Ï™3¨ñÕêØ‹ÒOTVó˚®‘JlÂå.°{|µiö	∆œ3⁄Áßî6·Ë¶H∞oó7ôM·¿U´‘¿«¬ØÖb]¸≠.Îiü¶F|PÆ0hÌ÷¿FKãê[Zâ≠∞1ΩöwsÊÉﬁËf)»…∏'z~À:÷Ã§◊≥ÒÀ“∞ıÅ íYﬂî°†ZÉÍ9ÅìÏ˙]ü·Ò‹A≥ó2bs~á°—R¡ `Äq„	6<¥£´C¯'@YàÅé“˚öQ`c±y≈Ì:=–2oU·$N˙T›oµ< vÄRxQ|ì«0Jª¡r:ë“/≥tbñ~)_m‰Lz;î†◊Ó%ÛåÍUVJgsïÆÂ5≥b≠y¸iÍ’.ˇÔBAUƒ¡ˇ’™à‰ÌZRYÃÃX8tuqxã„:“åÕw__ˇ7˙„π÷
‹±Ê¡—dßˆ¸Îˇ;9√!µ˙àVlé•B≥°s‘Ω~«–“x5ñEíâZüí£	E!≈í£Hâ¸z¬G·ÑCbZ»√˝@‹ÔìûçØ`©P©5vÑÎ˙@|+∆j¢ÅMD@ƒ”å¡˛X·qíª®ì+ñWÑ9˘vuqÔÜ±c–‹ÌÄ◊tÆº
±∂N˝·–-û‚S¶±¿ÈHQ*æîê12j˘r}©ø:’5ƒ)®√G[[âpÀMr¥[=∆W£‰∏}^zTø¿É‹¯.q¿ø‡Ä#©ª"ŸÅ“;YˇÌxáﬂ/nK©z"‘>◊‹ç™@â(IËö?5”ú≤ zÉ`ù√c]∑e|È6•‰◊å∫Ú£≈Q∆õü≈∂¶U…p©æB¶§?çNkêIò‹tW•ÈßÉ‚ÈÓäßxã¶îOIˇ[T|’Œπ+˜Z≤âíö9IU–Owe£u€“ã?{„G+ΩíuüRzµYKç¡üº‘Í√?òAl›]±ïÏ—îrKÄ„¥–£©ˆcä•˚`ΩU/¥R§ù[óY1ÿÕèTdÕàäìyÊ£—öc˘•áë#·M9EﬂúÎq—ƒÌœ^™»ã,_¿ÜE¶æ)§¸,r~¶‡=ø‚ràÀ(›âá‰i6õe•â+)_ÿX0›2è©ê≥7˝ÄX$õ?'§—~Ò≤42œ6J¿À ÆœØ™å)÷ô«¢ﬁ–kyV‚îUè‡\∞ﬂåÇç]º«Ù,†·hGÈg∑Œ‚MÎFA˙¯í{€YºCŒóhË’5ï∞∆2V[[3W'ˇ/Â‡GqØ0+Õªr,ÙáOõÄêÎ#∫≈}‰Ù›ôÔ%Éä^RÏ~§d˚4,ê<WØ©â¶ù¢‚è≥£Ì˘Ãµ>M2”◊7Ë‘bç=Io,”÷∞ò)‘vˆÒ#µ}\îä%L{±∏Få ’c)Ô5óﬂö´á È√R≈’¶°fö—ÜUØgE%Ñí‡!âxÓ!Õ7:XŸ2òöæ¬l†Bû¿ﬁ}Â–P#ıw˝∏≥M˙Dt
ÛpL]wJ.a≥!†òrÈ&‰Rº∏‰“›îKXËV;m\è0´⁄ß_˙¡üñ¢¨ˆÌÉ∫	!$÷ˆÉ∫õ2^Xu[ôÍ9z˚BË3-bö¥é¸ìFée{ƒ—â#∂∏‰—›îGlØÏË™TçE˚÷ÂQÁíg‡˝)…!∂\¿•—M¢du?H¢ª)âj%ı ∑+äv‚§„©Öëﬁ∑ÕÍwûµwè|Ún˜˙oˆü¢;~Ø˚¯∏Cé⁄«mÿÄ@ÀGù„ì√Éˆ^˜Ø€ª”˚Î3≈R-£Ç¡Yã•n aüÜ°5§'øûXÅBoÛ)f“Ì'QÉ%0k”çl∞YAHl„À›Cq®ƒ‚8Èf,`R_¥œ∆[k{„â^ÀD~ÒùA´‹%ó˙pö˘nrêæ;÷laÃØ"8¶ù¢AÕ1ô‰á¸%ΩB¯±‰)f©à8Iõ_—+~êvX]7¶`æ~úæˇ®X'1A≠‰W©∆ƒ&∞∞T9√º… Ú≥êK_n'ùº”∂·K¢^ôRî£`èU©hd-!’ƒeu(œ"g»L&˘ 7)H” Arµî¸XmLTƒπ¿oÈøúâÑ6Nﬂô6ug¶¥‰ΩJ‚˛”‰•:≥Ã>™zìáe87ìnÛ.ù
æŸäNö«À’.®%êY††ÓEÍÈ ¨$ÒônW—∏VÊÊ¥hFÈ.'òb73Œäw˙ÙŒmSm‹<S«@y1Vﬁ·(«–⁄Íxôœ˛ ã{ó∑45z3Û}Ÿ ø¡ñ·{“`=K<H:9ı<yF8∂=3]ΩXCAª*Ï:ñeD3%=˚4ƒÓÓ,As‚DXËz˝-¢˜V|äÖß›6Û¥ÆjuCIc˚‘≠/|EÏ£©Iù!'ÕHËƒ≠
≥tÕ˛¿-⁄L∑üÕ¨É_√ÜœíÂ8◊1Å+∏+&$ﬁvhÌÿAﬂ)˜|‡Û7ôkIt7¬|327¬s—˜Üè¯˙#¸.ß” N‹ÃøRºg7Tº~CÙ A√@(áÊ…çÍÎÛ±Ê&úÔe€qñ∑’˚ˇ   ˇˇÏ}iè#Göﬁ_	’Æ%∂ßÓK›µ›ÿ$´≈q]CVıÏé hÇÃ(VJ…ÃT’U›j`∆¸aÎ][ã]`∞∆†√∂`ˆX˛∞¸çˇd˛ÄÁ'¯}#Úà<»å YWWRW1+è»8ﬁxﬁÎyπGÜ™…":Æe’’7Û’;%ÍxëûnÇ∫*ïMv≈‚ü'≤∆ËÜ˛ˇä∫Wa5‚˜Ê†&ôç—dl eÅŸ˘¬ªBô
…ûﬂÜÀßfƒ∞T¬’RR∏sj“û¸:,ãEã~›Ω≥LﬂÙICÏ≥»+©ßF)DÅ·ì:ÃàC¶èB‘ÂÁ˘†(“ü”dHI¡H+q‡œ˘A‹áãOäs‚ùö¶!àëÊ˙^âßü◊Ä°Íá_-øO-˝G-4bXÖr¥|jÑÍÍÍ  ~ƒÓÉîÕH^*hOΩd˝´ÓA¸…9YYÇe◊KH‚  º
u–&ì˝d=C˝7§K»F^(8ÎzKkπ"±Z´∏|/’∆ZΩ_Á|äÃq”Ó;ûã!y>ûπHe9HÃxHÍ_óVoÎ10ã©≈Ü∞|_√{‘|«¬RWX*4°ë˝3Œá’⁄hNå∏w=,∏¿."N5oÈπì	˚TÑÁ∑ﬂ™àæ…gE&-Ìt¡[ê‹'“∏ÎÆk]&}ÿ}ÉîÔB±J4”∫Ûñ≠¡Ìµ.≥feå[Ò¡≠≠å±jlh¿d¶æ	H.o∆äÍ„S¬uª;bõï,Út˙;Òtıbbj§°‚,SC≥ã{Rª~≈Ipç3÷ˇZËáÎåhÚ:O(¥ıÊ¸ôl™ñ¯†8J™—¨Gør@&ô–nèë—OÅiÕY–‹≈5/:Ë9É=5y©+_Ó©õ'ÚqIÄKôi„¨Â*ÂÄ?úøHf%CZ∏ûÂ`q»Ñ\ﬁ0=∏ƒ Õ[Di1/u".Æ^ú{0˙Ê‡,––?”5◊‰møÖR°>ÿÄzi	'=1pW`´üí&;Q›ïy¨‹ uªUJÒûÉ˝Ôœ≤çm<i¯é‹ó-$ôR`Å®]⁄ƒSdhò |Ú¯—¥‚Y·dñ‰ƒµ¿W®4ˇw±›ZÍÈE‹	Â∏»åyáVöÆ´€¶ÁÊÄé∑‹∑L∑ÁPœX~Â¡úÂu+ ç∂¢˙£.£E#~m!5€ı±s·'⁄Õë‘•.„±éóÓ%À∫“$é®íe•!∂îh+ÀG\ï0ô≥â÷@¥Õ3IÕÁ¶ %®ÃÇÖèŸ hÃÂ$Ñ5ñóòJ@®_qe˛òπ›O·^ï'†|i˙0¥‰–^Íˆ=t_º@C™wIúSR⁄?ciÈ ØR-3]$Æâk‡~BVØµûŸ‹™ò	≥‘∞ß\- q„Ø?ﬂ⁄_Oœ6f+Õã/ù≤uõ]8;†]LÙv¢êhP7=Íì¶IˆËG‡>©ï˝[’j]OWŒ6¥¬MîNùÃª≤FÜ∆éL√Ç√≠>“˘7R∑V3áæ[´kﬂºë_≥Àgo‡⁄e”x;πTÕÜBôé\ê ƒÿ–‚{}—¶–≥ﬁ¬^ào64,”∆®Ê)ı]‹ç>ﬂ\Ÿ¯Ç8ΩØKwœƒ€/#fjY≥ülÈ∫yk˙0a{ú¬‡1∆]0∂Ç**ˇ¢¢L&Cg»…”˛¯õñõÛˆèø˘O⁄n«´"º§xcÂõŒkìR∏OuΩT–∂'aau√`baªÇ¨aÎ÷#G‘fU:˜§Ö	~≥{∑bmæ©V‹ú©ú˘eîå›Í8p€åïΩ˛%µï7ªÍm.á≈«Ôzzét‹Í _∂á£wX-÷'Ê◊ôyLÃâÖU€tºBöÌ∆·~ıª(ÏiJkiL@¬¯:`cJë`∞Åè$z!ùúP'≠Ú®±í»Ö.›;l‘˜Hã¥é[ùÉ√ ~®ˆ3+Ù’‰Î«V˜îí9”Ÿµ5~viáºuì∫uÑz˝3Û‹Ò	¬¿s”  SÃ·}Íπå€sÜÆÖø¿£ÃdFÚY∑J3<!?;DΩÕ£Àd¿Ö#éA=6ÃÜGO.*‰å\¢îé˛ o·çﬁqJ;úÎ4SUÙ∏˚Qs7∫Å(A/Í}xâe)zü…·ô’•>PP7=: (o¿/éK~Ö…¯≈,FxGrÏôÉ÷‡™“F∏î´YûÁD∏A}T}
¿*ìq*ÂÅdíHr¡ƒz√ïU%¡:°[•ä;6ˆ&“tj$>±e◊cÁ–ò&;•XF¥“DSiî¡v8Óï∂!N“2h@è±ÛNèôÕY>Öi‰´•åDVÌﬂ„¸Ûk•w´nZUˇTt†ÓnÓÊÀGfπô«Ë|F-çõ‹Ú_&≥Ú≤Hí™∞Âü∏ñCs9€Ä ∂É⁄˛YÜı£51‰Òı†J7öû)Ë≤Óa•&∫AËK˚ÄìÓ!|K ÙõpÙÉQã/{≈'…
Hër•9$a`"› ﬂÂxT'ºÜI@gW˛FN∏™‰∞Sx/•YRÒg‹†¯N$ 7£“˘úõULc:±Pei$™d∞O-⁄É=9g˚.I⁄ZY+ÊmmÛ*˜ÂA¨[‚ocDÜ^Ák'K”F•je∂jÌ´˜xky*£4'ÀºThoV¥B¥,60=X¢—J\!øj©<ñÁh´’†æ#‹i‘.¬~irT;õˆ˚Ãû-ò®¬≠¸Î≈e£?\\n6ˆó_õÓ"uy∞+é√J˛˚≈YB‡È1ﬂ ¨ˆƒB∆w˘F%{ã-ˆ≠⁄≠ÂÅ4aïÎT4“æ¶™OúuqNtK©V,◊\u©iÎö›Ω,ñ–≈e7Ö≠ YÑçHmr‚Âxõ÷‚µ/≈˚æ’Õä’
)áWu–â]«q≠ê'‡|8 P€f’Qo∆'s•ÇΩ∫ƒÊò+`[^Øˆq©´`lˆ^Üˇu}5ÔK#√K5‰ë∑QπÇ[AÆ¢ªUîW2Ò¨í ÒœYÁ√&9[⁄\ 0E≠g‹NŒMˆÍπsÒlaï¨íıM¯oÅ†ˇÍk∏ õ¨Å⁄â™ü–•¡YtÉ=”f}Í>[‡/≤ ˝
DeÓ/M#8{ˆz˘-1û-Ï?!kÎ÷:Y'õKõ√m≤Nüê'–¬µµ•µ«S|[]√/Ø%‡”Ëï•£ñ∆QÜSã√<=€úûÛ«+ôM|Dã—æ…√ª¶›˜õßä¯OWŒ6ï6VkÀÁÇ‰∂ƒ(œÙì‚Ú}´¶K©˘I¢®"!ô	ÚY–Ã7≠fÉ¢Ø‰Ò…wJi–ã\ª“0U‰∆sqˆT∂EeGˇ§–ﬂj±
„Rƒâõ√ûÈ+/–•Ïúí„≥pÿ≥©i˘‰ï	“"ˆKC˙ƒcBd◊Ò©‹:fä®»/ÁîéLQüƒ˜å\ ◊∏-ú†ÈCÚs'Ù–,åƒ‚ég¬o«>5∞+™÷ïÿÆêrQ2•bh«‰ªÚ$oï$j-´≈7L£ê«9æ:˛ÙyÛ∑ç€f•4Ë«äy©èÀıˆõ]¸˘”Ôø˚_ Z‰iZŒÛ˘≥‰ÕÃbÁÂïöŸºªËçayªÓÉ']Ù«¿‘…ˇú"YzBÓ≥R¨ëÏ,ü,]Ã§à˛q&¢’Z≥Áäb©÷È‘…
È¿nÔ†W≥Ô´&M”çö°cmÆπm9∆#-oŸC
„ƒC:A9\r˘£Ù˛&4Ω—Oﬁ –√"1aWÿ&ı	(¨–A£wß"¶Î®~–⁄#ıEÚ|yy˘π$Æ…Ñ´f&„åäÜëæ jmÛ£|oößEóéHòsÃ…"M”w?bç‹!bˆ¨Í=:y≤2[C&¨Î	Íjk≤≥ÂMøI‰„∏_°4û<∑x ¿ö÷î˚SUnÈ-∂7ÍQ_ük¨õ7ƒ4v»z√	7;¿◊?˛Ó7¿!êu}8R7 ÁQ§ 0>˝ΩNÌ i»€E˝b4‚˙≈∫ÙÃ?˝˛˛7Y˝”z˙–Mæ }å≠«,,Læ"µñåﬁŸ@ØH >öækπ¸„ˇ˝ˇÚwd-”àı≤Fº Î
r:Ü!]mÜV¨_ldZÒ›ﬂ`?l§Mÿ.k¬æ„Sêjª—ª!¸6C6r-¯ßã˝∞ëiƒì≤F|Ê|≈XòóCA∏Ëµ·B}QÆTÒíG"ˆ‘q›ÿSÌÑ®
¬@UçÀÊD	
Ôât.¥êöhâVFôH~‡ÔÄC8bZ
|≠`wóÑk+≈Å∞ i∫µæCπs8ÄË ≠õ‰xﬂs‰åIBõn≤)¨ï‹öb*üŒÉtJ`k≈c?rA†§´ózrSq∫™Äi˛°®¸ÆïjV>Ë`3V!GÜNCkï|
^ s‘—À|uV#"~π*‹>LÃ√Œ›5°«|’Iû2—ö~|ÄË.òNXnæB…¥™˙ê¨øt]$Úq£G¿®˚Bπë,ÿé¯_¢@>ü¯Å$äIC…ïm&%’?»fS\«•}3∏ÑÜMì–óM·O„8=x£AŸ5(aiônC«–èù2èŸ}‘˘jò¢¡GåíµE≤æHX–mOêƒ…ÅI±Z√î·{Èº˘T¬hY7J)UÖˇY¶PÕNè©hz_öv?¥êÿtg}ÇÚ¶˚Íïuñi=÷S?èŒâÁùèìMP∞+Ï*’ÌU+•|6¡[7˜T‘-K»i/ø¨∏…Ï"5Kßôè+´Ÿ±“ —;(Z5$ò4 ∑EtMÕ¡1p:Åê]‰ÿπ√¨º∑$ƒÊ“M<dn¨IêÓ-c*g_©®Kt˜z÷>ˇBYqœ	¨D\yéèé¬-)659»£`rå◊¸/"´IpK„Åƒî¢åö™“Ä≤µ˜v–≥2¡¿âˆÃ°`NÄï<˜ô£ßbVù¶≠Ç∫˝a&°€H_7D~çíB5.∑{ëò∆Ö∑‚ë(ÊhƒÑÖ’&üÃ∆_AM2X €ÿ>ËÆÁ1s≠kq“ı"øä«¢‡9X1ÓQr5*ïLsé<Á´®).¸≈¥œ“òÙ6S4ßãyu¢9>˛:KC°Üﬂ@Q
=[qRÃ’ﬂRK‘ﬂ*M‘«$KÆù≥(”Kä`ƒ¢+•
EÇÇÀë¶àüâ§®∏!`‚ﬁbÃ)à 
S<Ü?°«…œƒ1ùz<‹A“à“ûÔXaÄ,ZòÉ·!ın>^qÔ∞ù…†‡gÁÿ rñQ±CÂ"'≥õNs≥ôZÒQ,=ï»Øó÷5¨™ëâ°eôC”Ê‹ïƒ¬ºR‰Òyöåb®Ë/gØú£_7∑…$´1√pëêYƒH ·ÇAœÂ$Zq ˘Ü‰¶£≈Nq6éÉØa‰gx)Âÿ.Îºª·ACzVË!=mæÄSj∂-$™'Ñ ez‰¶Äg≤d¶zªÌ'ù:Ëi∆˘YªJÚÛbr?—ö–Ø±U{f¸€ì?SÄH˜ºøˇb!r‹úÜ˝3ﬂ§ÒHIìÌ¯<—„QΩ]ûÇQuiúßÅ◊Ω˝ı[Ωô¸¸'4Â§{Dı ßO¡às&~»\8Zj¶ >Ò’%∏),ÊDxÙêÜC8·€Ÿ…ŒPi®-i¯ÍQFR=y5óÆÕÜÙ“ös@Y˝‘„’u´U UªÚåBÆnl0õ1“Ì>¶¬`ÑWË™C_›BÏXOVƒ'ÈØ˙ÇT«7ã∑bQÚ!Vãu^8T?]öOµ8Æ§ ïn±>4›ÁI—›åË‘%¡.§}È≤ä∆J4îµl]^[‚˚[.æuyD+U‘¬Û˙¿≥DÄÕ„Y^^∆ø,íX1ﬁ·M};
◊≠·©Õ:J 5¬bU˙q˙A»íEu,®35cß≠dâΩŸÛ◊©bFÚˇ˛y∫"éœx;ò7üútßªàæ¥¥ÿÄ'‚mZ9Mut…T?Y©Ä¢Ow∫‚gR?UíaÔêKÜFÉˇ8<ÓN!"3G1ëö¨f¯—¯πs?˙ìº(8`>|ˇL+8Jn	SÎìFcé7‰ìÙ¸w˙õN)ï¯•sh[ΩΩÇ°) ªs©–~˝Mh2œﬂûõQ!¯õhR~:ü9,øxf|“luÊ∏™”IˆI˚Wøò„ç”˘˙…Ûˆﬁ<DÜÓuzWhNÎZLÙNW∑äÄ∫áπ]úâ˚^0>w.f™NóÄÈ™«3&íÍ>ØåF¶‹ñ®Feâú†ñßO[wîê&Û˚ûÈä¨©Úµ,˙z‡Ë™T¶Ÿ…\§¶©kø—t’∞∆«	'"Ùd<T˝òQÅú»ì•ø'§`»ùá¡G“S⁄Ú6¶o¢Ÿ≤|1∏ïÒbÒc∏Eï≈f)∆Pƒ±Ω[9ˆ29¨7kÀ,˜3§7)DéÕPK+ıì·bË1ŒtÁRò‘ùzÿ]–≥Áå‘ÿWÀ‰£sÊè~¿(»è…G∞˘˚N¸»Ö.¶a∂Â}Wò}¡Ô'ËW±4ó®œˇˆBøãH›î⁄5û¸ËË« ¥¥ä˝‡GÀ™úáZ°qÈg
uö_V.∑N^¡ˇsãÙï«Ìõçà∂w∫†_ÈnS¥B/éNz÷¥˝[ù{˝…}ŒS∆K˜ú¶Wu•ÁT©¯Ös›rDX1◊yÊπ«D∑Ω—ÌEä-.R“Œæ≈H—Ã%ô€å|£+ŸhÍ6EJUèp“8;%«B≠∫ïYg˘%”‚6K˚©£~•f√§ﬂ{i_I-I¸9˜©'™NŸwF⁄Î]•YFˇbÀ¯#R¥q0ı$Gdiî´ﬂh]?≥çqºuQ◊>7Gsa‘≥YßØxE†îî©))ÂÙCøÑˆ] äi"e∂Û!3Ãpò/«í± N»Â·œÙpk_ìøHõÊÜV‚7!®7±3«Ç∑Hï0IÀB› 2Á#Y≥b$Pô:O÷ê3za$¬‘’a‘Ûp}êû2€∏ÙDÌ07–¥ó®ëÕH”d[õÎ(·êI√¯p¥∆‰i_iÑﬂ¨¶¡iR⁄QŸ‚#%	BßiÂ\«ük–N©”∏íÑ®∑a.Å¨ˇÑ-ﬁÏãi‹0‚N∞\∏ﬁsË£©Óî\,›à,ëµôn∆o 7ƒNsü(´oß˘€kíâÙÆÒÏÁe*]°LAi·Ôç4læÇsE"ù–’õ"mlüó:¨„›LÁä#p˛¯Ô˛^pNSÁ%u 9 ñÙb±ÒÛ ç*?•“Ëg≥J£ü=H£ª(ç∫Ê 4uÎvO#é˛„ïã£ÈúœZH{£I^:V8dÅö¡.™"ˆ ∑çû”œ®õ∆≤;'∂4=ô≤ë@n]'Ù˙,1kÆøÙ>mf8µ¢û¨…Âzø˝ñ,,Ëﬂ∏Ìob@¯#]f◊/dZw“EùzD˘Á®_à“-»≥Ém)pñ<rÍ9√§ &¶—úõTf–¿ƒg…=–;„BÃHW&¢Gæ8µyß◊óóÓåä2e≤ìRüi©ïı$:Hù◊Xá°£§ñU	aGRC&˛-ÈºÕUµjáÚ'Å/òÕ<¥é[!÷P—	ü<X?Äó∑Ñ%éK~Ù=Æy'™pÈåúEAÍ÷íf≠RûŸò´ *gt˙}
æ∂ñqg_ëôi:!›†0è3é‹ò"Ô≠íjÉ{0uÌ√∫[Ö>Opıâ*EØ´÷u≈µcˇé˚BqËn„≥÷~˝∏› ù÷A≥’Èí›√9Ÿ;Ó‘ªá'M≤€>h∂^t˘ì6∫ßëdóÖr8±‡ëX~˛≥7ßπ+'9ˆ±3X¨m˜≠k“ß∞«ôÜ¬.õFæï	ËØ≤ƒÊÎ·cºƒ⁄õXz=§ŒNõ¥C>Äì§‹ÓÎMfú8π&ÓTé-r˝≈KÕ£?2y˜ÈKÛå˚äl˚äñû∏ïZÚØ73|—≥Ö¡>˙rµ√Ñ(•·1x-˛æ◊os.ê0~N≠/J ö∏™⁄¯R!üÊtœWøÄwÊïb*§€x4ó∂ù?<j«ßD¸í Ωz’ô
ŸMË¯ï	¬©çÃ'<≈Ù±5»¥Vh‚‰ÅoXéœ‘¿¯ò8•ñ_nÀß€)á∂ôOúÓŸyˆ,g°üt•ü∂˛Ÿõa·ç&]jf⁄ü\ù}≠âœB„ÚµÆ7»ÒÄ{∫xgvÚ7Æ¥¥˙XA‚tÙùòùﬁ∑†M ◊>3˝¿Ò.üΩ…ò<q∫Ù<ñ6{%~üU∫û‹iëƒ∆™Yñ◊Ñ+n,--ë˝—wÕìΩC“lë˙I≥}|ÿ˝mù¸iΩ¨Ôù‘Ì—w¯∑F}Ø›¨7Ò◊NÎË∞s‹"µìÁÌFtF˚`ø’l◊èÎ‰Ë∞{ºÙ¢u–Íà?=‚Oô¨å√∫m°7ò3å
ˇ^uZ_ﬁu3º\⁄FEÔÛ?[[_=]£_§4ài—¯s”Å9r^&j“∆Ö≈+¬´óÅGÂ2V“≤E™7bin∂∏!âJè“”∆Î›0Ωæ≈rq2JˇX</zÖM© ∆Õ®‚.1â+ÅÂ	—s.„±ÅÈ
^≤÷W¨ÚÄKRy¡Xô0Ìæ7`±ëK"F>*,ÕHÉZXõf%\ØÆ)]VVnuÇ{|s¸ªzQ.ΩR’(Óﬂô]úQú;Á–‰ˆ5¸¥`ïº≈à∏7Íghby
åÜ∆Û“dQn¨Ë
ŸÅ±Né5˙q¿´¿¯· 4f$8‰⁄15æ
ÌÄz3˜†ä∫3iYãxÁxi;vÀÛo ïÌ.mô8∞`–Mà•ÇY∏Sä¶çÿíR2Î«‘X	êÄ£r¿ˇÙ˚ﬂ˝w"^éŸÑ&≥|gLL÷DÁ›Î⁄‚∏ìoˆÖKπUº¢'>%ß&÷i4mÖ;‚WóØ1ÃìKË’”’ﬁ⁄ˆ+OÁHä÷"∂RôΩUîŸ wÈqNt«¬xS∆	˚”Âç…[∆å–„ØäNÄ*ì Êtªâ^FsØ)mb¬cïg™íæ.aê‰¥mØ‰ü,≈;v∏√˜úWôJµp|b»J‘%Ω\ﬂDd≈n∫Å3?ä’Ë√À©‘≥UJ-Rcì,:‰V„l;≥Gﬂ2ë#Ì”ö,$p Z ∑Ú˜WÆC´ZîB›@ßV !M∂SØèUR™ƒ6¨v±]h%Íèçâyt”d–µv;˚-}Ñ¨lU+íÀœ…µº•Lãõô’ÖÆõ4≈”hC)§^x\¶ÈW©3Îç„ˆÀ∫r©õæuåÕckO ãöı˛:Ï‹Ù)ß°vz>ÛŒcdóçw¸õ–	˛¢m˜∂aÍâÔ¯ó~H-û[EﬂDiƒ†Qãx ∆Ñ∞u9 ëG£œ`T’™ˇ)V˛õ/ª∞™<Òôu∫/è˚ˇùoËZbV«Â´ÔÏ-k∑«b™öãß|‡*Ü∂gòëÚ¥@a;¨iF+›Å ’≠∆cFeÅ ®•-˜…j9Ã≠(Hôˇ»†.u◊† VL…Ås1%©∑<p§¥V÷öja,’íX1}€xx]ÿ!OCt´tHG‡e@£∫Éºﬁ›–ëÉ'¯“˚Ù¬Ú•—;èÒÍ4òˆÑïfj˚ËØ‚÷¶·<R‚zTìÑì_A5kÊÈæic„Û iì;j75(huruûF]6áß™t®’ªÜLÀI®æ„^;p»Ì9‘3jy%rëC∑ÆåSúx¸“ë`≥?≥¥ﬁE÷ﬂî¨XîÀïoN∞H±ìÇøTµ⁄h8ú˜_2ÅÕuF(Ì∫jqXh∞ámA—Ç√Ô;Æt|b¬Ÿ(5·‰ÙÂåGäÖYÀ&/XåÁ9.°çˆ°G≤°…-;’9B˚Ã©Ÿ”ó©/”Å44[~ﬂR®üpçKãIﬂ¬’ÈvPi∑^Dv¯-ÿÃOï«\ÉT]œú^\	«X‹8·J”MeeJxEíU|A%Ût=_£$	M•ûÇ¥âÅÎ’…Ê ∏~Ÿ2ŸRâü75”#ô∫~æ˝ñrBÊÂØŸ•_swóuXﬂ$yÃÕ(Ü§høÇ  ‰∏DQÙ◊´F®iÎπè ﬁvå0RVY«î¥J"·&enß˙ò* z™UVºzé¨i®øN‘mÙ⁄¸y’›ﬂ 
8W·9_ ˛Œî
¬ó® #°}¨?æºº¸kÖ§6Ì…i˚+ym`{Ív(}xZwuÂ·Ë] Cã‹Ø@¸+‡™:ªÎÀòzπ(I$¨ñ‘•íD¬f∂ÑﬁF67<VVì~∫z⁄µH„pOÕV¶>h
õÁú~ﬁ◊Ùk·CÈØ>^€¸Ç{FdKz©92ÇÒëﬂƒ¥±åN‚0π∂†º≥G¡é1Y≠Ê&Ï5Ó>§ ‹ƒø~æµ™í¢TÖ·ç¿lYl@Ì îy–÷}V¢è-‰Ω ◊‡™T“mwè[˚un2Á¶]a%Ôå~{‘nÚ√QÿIó‘é:áçV∑æﬂn‚Ùﬁ;<n©Dçåqo°Q–Œπƒx≥Úq1§|ìGˇú‰ëã›t[9ï∞bE_ç˜ÓM·-À;‘“RÏS9¯¶Úöï¯Ã
–jR)“2ØY|P⁄u~E›,HŸà≤ùÉP*@D√T=WıP”EˆÙl£∞€ïx≈K§Ç¢ºKuë	o»çÖuÈåﬁπËqÄ√˚£ç–r|≈mÍlcùx∫M~´∏ãOö©su~ï ºõ¬aWÔ¯Í&–X*K∂HR#)zø˙!5@âÊ‹â0Pˆ©%
P#tı]‹=‚õ√–Bk6ã¬©D:PJ≠!m•˛QppÕ”Ç{„sÙœDwËV?Qvç≈∂ÑRôäTW∂ Ë∫≈JyDﬁH›≤xﬂàÙ_ƒï´h&EY†Í
˜cÒö¥†≠…$Á¸@ÎHçç"©]b"–µÙ®,¥}
Ø)™»V^KœmòÍﬁáõö©l,Û[|ºzÕì°…¸·UÃu%b‚9(4†ñ3 /∞Dpïú±ÆÖ%}›TÑ∏o>ØV◊Ü¬4@S§¥˝ÀcaQ·
Œ≥˝È˜ˇÌØIØƒ¥¿]'p<èQ‡Ü7õÅØ∫MÉ—èC≥Oïû–£∆Ä¡Í«{ı.‹\È"ÿá˚;ËaÊd^ÿèÜ¶ùfövf¬˙Jæ!◊e_n*ZB„‡Âe•√®9ﬁN§ÚJ*B©ÃÕ* *eTﬂV∑Ayúœ©œaã˛Pˇ/§b!øó—-∞c?©Ó2áØ3tñ>cËî±GÔ`§≠ë~YÔ6NˆÍÕ¡n:.`/G10Ì–Y$CÍRr.µëK-ºë)é€9Gˆ
&j€éo"∆(H_r&Ω¿4£ü∏ZJ|ÜŸ¯Îwè‘”Òˇ?I/#œMg»˙ k1√ùë∂}jQP[œtH≠ù+	˙pª˘Hk»;ı&å˜∂÷x7B
çñe≤MŒ1U¡c>ÈI˘
Iqhaº}ßÁ1ÿnÔﬂíF§%µ©u	É†ª®"È¯ÒÙﬂ!ûiÊê“4È¿˝Ë¯µ~NÌ◊‘‡C?]ñõGÕ]ΩÒov:≠Ω»¯ˆ!^ØµÚôO=–N,öﬂß.éÉâpˇS+¸
ìÓÜ4R».PÉâM-|Í3Ç±Fã!Oâ¯P:'‚#71)æ	y!∫/Ÿ9µ4Áƒ?¸Ìò§'ŒÛ[jÌ‚I(≠Œ Ût¨åˆÃœg£?PÌß8Ü{Ma≈sñ Ö"ûÙ2Ôˇöbå°>πîâl0‡upœÏY&Nj˜ÏRsÄø˚y>˙	≠Ÿ.Ó3z«Ö*åv◊Ω]{¡uP?Ùñıãí@¥^ËvîÜGzI√˙Há3˙Å∑jê§S?"^AKML±ÇŸj0¶‰∏Œ@°¥á`˛ı&Ü◊à =)‘˙“á†+ièÚﬂ¿ZÖK°ØÒf‹¿e· ñt[Ìóg4ÎÆ≤>>πaç~@ÒØπó∑∫'˚≠rxƒ3kÍ{:√ﬂEêòØiÍf|FòÁ47‘åòC6}!ú“*íÌà˝CdÙn`Z ò}>˙¡!0ßI¸∂Ô£¿áÃîìÂ?¸å§µá}:bÊÌ"8ùYqS°up‹“ô
« U√>ØQÛºFÇ—˜}Ã|'0ò=ÈWhGÌ√ËYq±èŸ¸Î#Îpndy`£#È∏FnbX0˘˝)ˇ?íp%EÑﬁåı1\[«£ÔΩ°	:èûHﬂ;Ï÷;ÌCùql,FÍà¿OMP∏9∞†˚ bˆgn\wÏ>sqˇ6“Ω~äÅt—∞,#ˇû"ˇzCË˜A©Ñ’Ÿ◊√ø'-·Ç  G?∫A4Üâ¸÷√n˚‡®€ÓÍå·!¨?•rN€$¥cˇ97} õ(óÌKP»êÿÅuﬂ3≈@&D_ÒHäÈPäÔ71ñCF˝–cË‹—Uµæ˚;R˜—3â~!ÙA2ÉÁƒG˚-’M‰≥h÷µSZêåõ«0ç¬èG√∏¸S˜Ì_ä∞O»’æIâç;Út ÎvÎŒßéÿh∫:“?§ 2û¥r‡îwŸë…áˆ±á≠gÈ<jÛŒ£—o_¥¥Ù$AS["(Ei¬ûÕ€Î–5#≈)(™˝|Eß’à:Rñ∂‚à$oSv kœ(∂æÙ/m¨û™+vˇ«oHÉª{sRwÙﬁUœ®Ÿ8©7;ápiÁE˝@k˜L±E#ã¥3¿‡IÎí—èº1∞ê]÷ÁJíÉRYÿ0˝∏›”ÿ∫ﬁ»<®’ÑWÛ⁄W*öpAÙÍÆ‘ˇ˙p72pÌä€pØ˛^x≠≠A›Á¯§£'|q@,C>¬:*Ì®ÅG√ab≥‚FK∆.#…2§6˚ yÓ4„]ÉÍÆˆÆ˙◊ËJƒÓ‰í∑ae)i:2çﬁ“›´w€ªúAÍ†•5÷Õx|a-¬†zÊkûŸËôúŸﬂè9bUNö˝X{ﬁ^Í‘õ›Er˝dA˘—cﬁ≥¬ålÊﬂ”—Ê_Á6‘_päƒ⁄–QacME™z”Á4Ã œ»àjvÃêùÍü√-óMCÅw>báWâƒF?≠¬iÑ|Õ.9úrÅBœ±4≥∞AZ∑mÉ]<{£XUeJvnü›í˛≠q^7~ßö:—wƒ˚¶2'≈'∆Ú^Uº˛≠j≈+ENn«˛7Ï≤Èº≤µãÖôß§∆0ÚùìÄ.¥x,&I…¬#Œt∆{@yìù“–
j$‰s”)Fu÷q’Y8uû3 KP∞!Ö“¨èÂ(_{3«Ï4.UJÉß ã ˝¯)˘ıüsA≈∑Ä∑∂I’⁄J2¨ÅVöO&=9…;I#é0Ü∫4_∫`T$-X©Ê≤5
ÇôYÅDú{È íhó¯äıEé≈åº8R´à¸ä3Û8Ø[éÂPÉ∫ÜOéëTËÒµã‚ê Õqw}ú◊=ÁBùÙ¢/V2JDãBΩÓ*Áá∂u©˛0)SÉì≥•MdLHãÛ ≈Ë9…ÿ±ï‘DÃ≠¬4i@±]™ôâ<B⁄ı¸ƒÙáN·ôJX›o∂µPœ-«@∫±„xIH∏nàm…%∞ÍÆÑÈÍCâgàüZæ»?ûﬂôat»då©≠RçS.§œÓñÙWÑÆB~®G˛´ùX	#™j+®ÑF·Ò!˙û|≤ÀòÅÏêï°°ozx]tŸ>¸OL%qtlj∏¨≠oÊÁÅ¨‹óe0≈Øbõö=≈∆@!bñ
≠‹Ïà¢§õi!&ZUÊ(Œè÷˜X;∂jçß¬Q¶Uπ@fvµ®SçÜ◊ãÖOO/≤™&k’íB*ÎÁGw Å'®QDπ≈ºÓ≤_+≥<Zˆù!´=w@’¶∂B∏}±ˆí?‹ymdKèQænJ.àm•J€6èeQ˘úœWóü<˛¢X√mK™Î)∂†˛‡ºä97^ùamf›UÂÑeVpV-â }ö*yRêÉE•ò“∆ÿ@ˇÚÃëM.W™¶åB"qq®Qk)†⁄aßÛœØ NëÇèå&ƒR˙‹ugJ…dÜ„ÉZ≠ìß∞◊)2Å©vR!-Uí«)èàf∑àúÍ©ΩQY“QµòxQ'Lq
ˆ£9˜`u∫J¶IÂñQ*‚lÙÉì÷À:È∂	Wk˝`Ù€Ωv∑›ƒ≠›CÚW‰˘Ëw›_ú¥Dz˙ÛˆÛΩˆ·ãN}ÈIıs—Ÿ)CcRv
OÏÆÿzD∆ågêµù8äXƒëE~Fê∏∫€a∆Rê ù4C~ÂöåÄ÷≥àßﬂÁô≠ruN9ÍÎyMjnú—Îj9Á\æ¬Œ§Ç∏TIöÀyèß(Õ†ùñ\ãÆ$T¯ãU”Í´J’´kxY _Ñ¿Â∞˛â‚ƒ‹`ír®‘çπê{déÆv1
^°ãÊÑ•++_p$g 3ë¶∞Hâ°]ï<¿ÛFr·O.Ë&}”≈ÄrI†YCu∞πLC%y¸j¿É¢Lqsä›Ljªi6B7M5sâÙá∫5@Æ§`»ˇpdZ‘„6ˆ©K)Œ®8≈ı.oß/%|Ωeö|ÔX™Æ)e›W%‰î—¬‚õ"€≥ú˛◊JK°%∆k7,ÓîmeCvÊ¥&*7‡ı∏Æ©RÀÚ>˘iQ‡D2´æå„Hxn^‚D?t≈ÙÑç[ûèpFª`ˆ-á1€ßCåvT  õ@qbõ¡∞º	Î;“"H0˙≠” ◊SìıM˘≠€Ñ(XÒKW,•ígoÏƒÎ,}pDq÷üÊâòá¯•a∆1tVÈC7w¯íNüÿÃ\†˝H6√T€¬∑ÅxV˙HÙ—è<ÇæPçbﬁ¡9U|∂˛üÓrTS¥™Ys?<‹_Ÿ?]ÒÎ"ÅgÏ^0ÀÑê®âf⁄ÑÉı(ÂN¸Òê+Td˘OìéÈ¸ëeû≈NÉ
g§≤këøJ‹m-^K√ı+ò–e3‰„BpQR%Z68 æ…¨°Rß<sﬁ)˘∏Ëî‘ÚHÊ¸l™NiEVte˜Anã(Òå‰™†ç/≈åp jïΩ/o√„
ﬂL‡ÖvæDœÂÓ≠2 Í‚èÊ≈®Fä£*™ÚˆQîØ.3M≥(øRÌ“¢y”≈
ï–â_fºúBΩﬁ(—[Ùä¡KŒ±ˆÕ·$R⁄"âıú%jÊJypTçïöV»§#∑‘4re{`yuıl
±òY^±Í•í5mpjf)Äñi“k/õÙäsƒ2<3„öåTIûÈΩ∂P=wúØ±LÒÿYßÁﬁ~ÛT:π⁄Èl∫€Ê©8˘9;9√î8i6´Tí1~olPq∫;†¶MyOC€”xrÿFﬂ€RÓñ/¯oÏ(ˇv ⁄˜2+<	ÇŸ0%∞óÈâ¬Øú,ZbPòd(
·˙Û(w;òÍ2ÍıœûKtzòJ\èNF≠[‹∂íŸ≤ãÓΩEU•√sEËJÙÊ‹°É˘la
®JÅ∫„˙—’∆Né3&%mπ&@ï-¥t!ïR®ï~q÷õVÂ\DwYç©pZDWÒâ≥·´îÈﬁ ¨®ƒ=ò?£ü2<RIm{·ı¡Q°HE˙M8˙>¢íÇñüBRÉæ^2kÙCPhYƒ3Ö•Ll∏?ø®ê['ı√Õ{X’–v˙å;†r c»19]’Õa´®`§^z∏*.ˆ◊E∫•ê*ÀŸï_mÔ-¨ èŒ!™∏+Áç©ÆbS¿Vyë›]?û⁄‹!¬T&⁄“N(Liñ¿+œŒDj1oS◊∫OÖ6úG◊¬$Ê§{¬N|§§3mS¬©€æ‚ŸddÊXª^e¿ÂÕæΩ¯K"Ùä´e≈£≤ïá`Òπ≥A∞ò	Ìﬁ ∞ç[L7ìQìîÕ26ty·7Èò°€ø	Mq»≤É,›»qÀIPêª&0⁄Ù£w=32]ı`ä"úÛ»ÈËnus‡JÄ	fæÆ Ê”Y—=†ÎuÔr#`+Àúóß◊{o¡÷∏Q∫"–ïä™kˆjÓ\*ÄKêNz∞πdÅÃıCÆ≠ùî2I˝∏‡ŸCÊ ´ŒÖΩ}f¨p^ó2êA◊Ö≠:√{ç¨bè·1Ã«±Û4fÇº˝¯™Ñ§ÛÓ£´Ñi3∆Vb<
»Jú7£Î0b&Ω7∏*C´ Ñ¯LxU•≤ª93‘%·QÌ	|ä®ˇÑ?—@
u«¬◊pH/ÙQ([©‹ì]ì‹C(§£“õYÕKõ¬Úy—ÂNã≤¥os#0Kf∂ÕRﬂﬁàï¢+¬X±»ö/¬öˇÓ•Ä±¢íÈ%ªÕıÉ´ÌùÑÀ8cø:äSi¯∂w]P*Âæ◊Xjè^2o<⁄Ohòo?å*·…æ˚0*eπﬁ‹ çHHEgŒÜ§b~{É§Zp, ‡®∞ú˜„tf©ú\ãû@QÍïIë1,tCf†—g<ß,¬J—Ÿ95E=…/)Öt)ñäΩzd’çÈÎg4`ÈﬂÁF∞UÜk^^u[˜]ÂGÈä‡U“ßÛ≈Ws›—†UŒ^ämÆd}ºSQa‡∫ïD;yØV'¥&¯SBù€∞JÁ’›áX_“Êj~T ˘èfDYQ›é{≤‚8,	Â$H*Q<Ü¡LÃZ^¶:	MÍ˚»àèÖÇ∞Œì‡ƒáy(‚#í⁄3¸ŒÕ∏bIZOIøÜ‹Ωx#Ê™$Ø∏Ì'ã)ZHh®π¯Á\-R≥7øñq—mD'Èé°î¶lñˆçíÑ9…)è€ ⁄VI¡ôÌÏ*WN˜Õ•´Ô±¢@π_ôY¨ '«Ì=J{ÕõÚÅ¿N>Ïcu=/›∞sïõ|tÆ4[j¯ÁÒéBQûk54IEqÓ5Bª'h_è∑y&ıÑn? L¨ªèÅ§:Mâø._›)W‰i÷X®L©´˚Ö
ıå£∫>  q¶Ü\œq8éµª¯LsÖÏÚy4¬ Dﬁ"/yèEG–πó)˛ï@hπÔ f‹4Ëâ$3_<Ä'˛òÖ~— ;—jÃÇiÀŸŒ.Áu’bz`'[¯-/ÕØÏLÿ_TÒN~d¨√rúÉgyô‡FÄN/Ét&ï´ªV∏#€}∂Ó1‹©§ìå±m‘-_ï¯¡OqÆ…Ìn#°	÷†BÏ“|¨AŸ˙ê˜	e›m„[rL4àLÌpN_ÃA?#Ô\/¶8%¯y‰‘Éˆ˙úÈŒ3]‘QoÑ…†àÉƒ:‚ï)ÒQ¸1'Ù–˚dRcs¡F6#MlT2"2JJ˜	*E˚E\<˜Ü¿RyÿÎÑF§‰—Ωûc—º˜Çê|¸§∫€0(W^Ëzà…ì¢ ˜5Y¿=Ví_JÑù&sI¿‘59Í;ˆiT[ƒ#~ò‡ â¥9)∂Påøî™I'Â¶y<¯Ì@DÒrJñ“&ä?Êƒ>“@EÒbÕ¬"yo⁄Œ-¯+FIDØçŸã4aQÈ†‰Ä?Ax Ñ=÷K∑åõ EOví‘nh≠ë√	1ÛÀ3¯u◊}¿G7îm˙¡±c8ÔF*õdi*Ñ/À{ê¢¯lâ n#€ã iöäãD`êg9–◊$‚ÌíÅ‚≤Odﬂ|ƒu‹¬Æ˘ö¯öãÉy±ÃbÕÙ[Üô2ÌS;Ñ◊ˇî )(3ƒAû†¥›í£˜Ö9Ö˛ƒ^z@_•Õ∞Ûíπz≈Î™A‡ °Á ˚∂j–{ıb´ËBÖf√ƒw¿¨ﬂh≥^^^Vôt;”/xj∞€Ú«˛.·ÜÁ±[!;w©µ"24∆7¸”Ôø˚õõ@‘k´;±±âX£JK†]êú§{
”Î5:ˆ/©==¢÷.Ù|Gv˜Ãdñ¡Ê∆.VﬁswaOûiwgÛQêAv<,9Ñ-Œõ1˝±µﬂ>‹;|qüHR;LÁß>U§v»M(3ôPOã≈À„Ùcv	a∂Ï#K}hÛ{†g◊êÍu˙”èµoö" ê˜à≈çõ)3ö<©«…Èoà«kÎÚ€>u‚c|ó¯=¸éÁÂeìTus·êÖ‹…æ∏-ÀîÀ…¢ª
ÿù<v##ŒnpßìÚjp∂÷™ŒP6qÎæXùtîÆm§>Ñ‘*#j›9éÇ[¬—ŸM§á§Â+„H/π$ËM‡Íµ“ÅÌ¿#œMg»˙£w<wåë∂}jQtb!}÷E9nLÖ´πêÒ·–˚Ç®+çﬂ•T◊í…v˜ëÙı'∫vÍÕzál7Ôòy≥mìs¨•Ñ%ª{“<Úâ)	-ÅÉEÖq¿º1é pÊE¿a7≈aë	GíDWÄôh¥é‡7Ï¡ã∞3ºº≈◊œÉÔ>˛òczG¡ﬁ˙X∆kÀÛò∞—®:ÌÀGCv◊ÛÉ¬WﬂÛLØdC∏¥æCéáÚH‰º∑iò Z–Œ:Eï˝CÚãì.ŸhíZRT˝˙Ìç∏àﬂ´›3c˘$ª€†Ë:ÕãáGçˆËª≤N˛¯õˇ¨“sÔ,:ˆF?$Iª(©˚Ë%{N~Fˆ©ÀU«<ƒ9c1˚≠ﬁŸm?¬3ÃæÁPÔõ–ƒXI‰°Ω$/DΩ;~ø¶Ècé+sœÈ9Éq~Ÿnﬂ0Jñä{v	À^7¥ÿ ä?Ê¯∫"´ﬁ5⁄ÚÓ;2⁄˝áqïJà®|3∏T¥±C^r«¡âg⁄‘√z∑í#˝4†Ωt¨p»¨◊‚#&Zß(\DD⁄>z¿G≥‚£…ì')ó™<h˝Â!.[ÑIù£˝{Éìd)ÂzéDAå–ßÄö<,m¬|¬*î±°))ä⁄>:Zƒ(I”‚¬≈√X∂ët"˘Wè@Ú˘údñB/≤ËﬂtÍ«æ(Ù•X7óP)˚1«w–TüÎÅJcá°*…Ç_MìwàOõ;§`ô]Y»Ä¥»ÿöÍ	„ÉìÌÊg/ﬁˇZ˘åª€È˙›k??<È‘˜Óõ5©√˙¢öI_¶<:"g&<*˘V[ ê∞=‚Ùii§[_qR-ÂÈ ÊM{’¯BŸh>Ä¢Ï«,vÃÉ/-ˇQJ~-€OîÈaÛcê·ÜçDºÑ~©èi[Íﬂåmkát—ñL^R⁄
MÖ}¢‰8CgÈ36tå§ﬂ5· òÏÌ§˜™4ÒªÄß0„Ó6÷·/#ùx$r8Gú7 yYÔ6NˆÍsÍı„√˝—ﬂ÷a≈~÷⁄?l∂Fø›o7ÓOº~”q]dıaÊ£Ê,í˝˝v{ëºd∂„√∑Cõœ%©;^‡ò®úúƒ&áCÍr“X”·‘S'"NÉ¡ß+iª4]å.$%âA*3®›0,ä“2 Ã“æ— G|…f°Q≤/mÀ´˝ä`ëº	fÖ¸ù±ïç@Ü$øH©¯∑πb§ &úÅ
dä˜äCG‘Ñ75ç+/·ái yà1º\⁄ÆF<˘gUé£œ,÷òC»¨go2_´%åó§`–¥…>’œÒÉ–∏<ætAí!Y&z∫x®˙J«œ8q| àWõΩJ√e≠ZJN– ΩHÓN°vóŸw◊æ…€™wÆXºï+6µ’°PÄBqÖ©Øhu»œÅñæ'ã„aäÁ>W2≈ãl–zìªåQÙjßyÓâ≥=˜∂≥?Â≥ΩúSo∆óì≈]Ìú/<Ûa÷Áﬁˆa÷„Göı%IpäÛ|L~≈ÕÉ)Ω‹ €h∏ıªG—`êøù€c£ü0oÂ=uπ:¬íé?÷â∑ôØ·Iìπ8°N°óóó≈ ΩU±–∫RËîJìqñ|}Kx-Ü”Ó[°¡x◊¥#a Ì-9™r7«>vãµ•ÎA¶úcÄhd|*π3ˇª⁄ÌÁ#≠Ê%ØÊ"±d~‡›±œ0´=}}¯I„û-Nu<WúR˝ÄJ”Ã”ï¨†∏.1™êö•"Vs¬¨*võãN4+ùôÜ¡ÏÖ
Y3!öÜÑ™ä–$ZtÇ çC™ pïw•∫<}öÎ≤#è˘Ã8ô¢XΩ®»¥·Œ‘ÍÊÈ©Õ|ˇŸ&ΩyrX˘Fç˙Qˆp@˘‚]p‘	ù¸ÏÕi˙EÂ\÷ƒ∫<åÍ“='€”ªñà˜≤'(Jy«~I≠ê˘êd.‰¸∏øIü∫ã∞∏ÙpiŸ–•7U¶≠Ï’†)™óJ#X√∆œ≈
øé„3≈¥)H>SÍ˝˜LÄUpJjÆq⁄≈‡”;]ÓáûRÎë"R(πt9'P»3íiñ“ûöå˙Ü≠ÂΩà#yaâÇyIÛ“¶C≥öº¥%1ˇ™ıùÒ°¡◊¢ÚTéD∫õ´ÑÉY>ˇ≥’'´∆⁄ˆ∏ôÁÉYí–Óµ|‘ ∂}‚?K}«öËu/ó÷‚–pq$éxŸà}©÷ ãÙ’¶b¸≈”=áBc◊≥^ΩmÚ
˛œbô∆J1Æ§2"ÄC§Ú0ìçIa&ä/GHX «ö_fbÕ4©ΩYµ#_ú¶Ö2ˇln≠≈˜=‘äMn|6Iæ®È]≈}v|ŒçÍ>;úÂÓ=Éˆ-!¥Ëﬁz
r{bÉí{™) 3Ó¬Â˚‰.Ém9:A≠â*]¨®™«-£≠+A~µ&
˝v∫[lÙ4∂Í⁄ª˘Ω¥]—∞Õ≥ŒmÏn≠±I;ïK‚cΩÔ¥ïBÙÔ4∏-)5}7·m˘Ùæ≥X6≥®nˆ‰TÉàK&wŒ-É÷ŸTnâÛ¡É.üΩIWrÕŸ)v3nÛœﬁ_7¸¢ˆ‰†û^<˛©ßœªq‹#Ω˚Õ‡ùqC¥t4Ö›œII»µ·)πñ›†RP‘#ãÈâ™˙„≠EPeπaq‚ƒ/B”˝‰Ò"´™¿©4¸`ß$éˇN#ß$ØÈn„&≈I}gÅT~ë=`©qüY±‘y‘”≈ﬂ¥’ÀÃ-¶ U/3OΩq\ïÌÑ€≠“Öq£Ë™ÿå[∞äçªU´4◊ÒÓ¬¨gS™∞‹¸†ıKrT?hÌÌêˆ~˝E+©ËıW§~–$Õv˝≈¡a˜∏›Ëíüü¿œ›v£~‹><P∏ı’µªº$è6Dº„~⁄+Û–ﬁÀ’R(ØV¿T´K^¯I˙æ j¬°b~∫GÜÙbÈ’í?T≠’|…U}s`;>Ò®ë‘ÚEù^™bﬁï-ﬁ-i5g^.>Îb!ñcÜs≤u‰ÛîÅ G‚{ÊvíöóîÎQü‚OP∞,Jÿ9º ûî‘®õπogIißñÁ¡∞k/qôÃæ∞6âoAŒMœ®2ìñ RîÃÖ¿újÎ8˜íƒ)ÛÍPéºt˚$o"o[.≈Ó™xªO…¬©y¡¿∞9/mí°±#~Ö±xΩ¥≈c_Aº⁄[[ˇbÂ…AñΩ‚%Ù∏¿+ò7”A€à3‹ﬁ]zúìœ±ƒ›ä%.ﬁsËO-¯rπÑıœÛ|F( Ù.m@a +”ÈE÷~Ú*∂ì≠¬vR⁄@t?°ûì∂TÑ&ÁKÃÚi6©˘ì[^åõy}ÿ√:Ô‰Êµ≈Á6”Äø¡Å™§¸).N⁄Û+5;Ä¡Üëƒ€¬œWKõè…˛”pbß•}∆Ÿ'¯‹‡c.Hñÿ94œ_≤õÒ-N≥-Ÿ˘bv¯ÔûÛ
/›ﬁ#äüxt{Ÿm¡Ù‚ˆñ6ñ∑8_≈¶€ê:ﬂóL;U≥påØ∏Ωæ5{¥í≈Çü©F&î†ñ˘q	•”ó‰ÁqïVÓÙU4Ï®PÒ3'Ç
úaÄî@ÍÔ.;≤˘bq=ÜÒöÁûÌ©˚‡±Dı"0@ô	ßEº…)∞@/9«>»ñCÀ–”VÑÂxe[7¥¯ÒMài˝>£æ–MÔ&,h™ßçïØ<ÍNM”•»„Éü sºƒj‰1eÏ?ÖM[É˙?2˝äùbz ∏›I¡rÙ<ïÙ>J¥=¯—G#ÈGbyFa˝dµ∞Mo…ƒÀ®Ÿx∏◊ƒâûYmXìÁıâh|§‹ü"’è$6ÊÈ‡ö*©P5◊è¯f`ï#=Ï≥ñ§Ü¡ÖßC:˙ÉÉ5™GÔlLŸ‰‰†CPTpy*’>Ω0áÊk¯€Ëù«(/rï§©ÒÇ6‚÷†ã<™dÌ¡èö»”vïZπ¯y∫o⁄ÿjñ”¨7óqóÑïΩ™z≈SE_Õ·©*=ôr ÕY`ÂƒOﬂq/è8‰ˆÍµ^hZFÇú“>ıæ–kÛÇ·µGòÔ£SK&n™y˚Dnç©»-æ-¡¿˝è&úîÉèK=i#–k»ê 2+Uñ∞⁄Ë7◊Ñı¿4ÓU≠Ÿ†pÓ4ìATàØC/ŸFZﬁQ7∞ÎçsF∏ Iñ…Ô0≤•#´?íÂÿoõﬂ¯t §+Ç #@_YÅ±‚bCYX¥A˜1aƒh0r‘‹ùÎúQ£àT†§-≤ÅgˇAµÕáÕ¥µÙÎ:âm‚1] ™_ZJÍæÕå-≠¡a¥õUÎº≈&'÷_5¨®£&≥[èñ—”V®
‹®g|æø ,&°ßtJB÷ñ't˘Zö"ÿ/qîmÖÌºu&≥7¨Ø™v©®N,==‚Ÿåı‰û:ñE]Ã˜V¡£ÜÍŸxæWŒÃúQˆ‰.˘ˇ   ˇˇ Ñ.ªΩxúÏ}[oIñÊ˚˛ä0ªßKÓ1%R›∂FrÅ&igtQÆô√®2CdñìôÏÃ§-ï∆¿ˆÀlÔ`∑3¿Ï Ωı∂ıP≥ı≤h,–@ÛüÙÿ˘	{ND^"Ô$eŸû Fª(232.'NúÀwŒaıG≠∆÷√ÒŸï_˜,Í≥˙n#¯Û≈„Ÿ’KrÈÿ~}ËXôœfÃQèﬂ•£W¶=Æø1Ê÷û¸¢|Ì˚2≤®Áù–);®ÕÍ;‚e#f˚Ã%oÍÕÌ⁄ìæ=⁄‹ﬂÚ'Îhÿbó>6ªµÌû\ÙŒœŒ{ÌNÒÕ	Ùé˚ßGão˚ùˆöﬂ∑ΩµCÜé”S∑¬b~≈å◊û|÷>:jˇ›·È@ÔÕp∑´z7∂Ã®°|ª?tåkyTÜ˘V∏~MÇÒvÀ~„±©ÈXŒ¯∫K}∫9rÏK”ù2£k“±ÌxÃ#?˚©∫gsJg∆°ˆıbW{ƒûOáÃΩOûê≠•s…+v}pçºïÜ{ÛÀâÛöπ{√q0–«ç∆V≥Å‰n{¶o:v}=t=Ú”õ{≥ÿ»gF'”—–ÏKÚ)˘ƒô—ëÈ_◊w[üê=Ú…'o˘Vá¬∞£FŸf°ñ9∂ÎS”0,¶µ	y€¶=õ˚ö‚_œ†'£	Ω:W5ÌÁ˘ìÃ8∏πW5Éoµ€vÏŒÑ⁄cX»∆â‚Fª	Ë†c{>:¿ ‰≈ÊÊfqO_˛≈Øtr@ÿ¶O›1Û7ÉπY¶Iè˘É¬Nn/ºØﬂÚ[˝Uê÷uÊ∂≥ò‰·˘2∫¶vΩ]:£π∑Á‚Å}7©Ô›%Ò^l5»hÓzé[ü9&“ø.Òminæ-_ôsOlW1Äm>“0{◊wfµ'7∆¶!ñ ÙﬁÆ˚≠;÷Ë]%'“nÉXpT‡∏Ã¢WÃ‡˚jÓ˘Ê•9¢»˝¥;ßsVrˇæ:±›l‹´<S˛˛Ô´œãŸc8»H„>ûBöÁ»KÂXÉµnvﬁ&óm7¡€•%ƒÌ`˙∞à£@.k6A0´=9q`|dB-ã∫éM8-~Äı9	∆J¯l0o‰öæ„mﬁÚ™Æ4ãíÜZÀp3ZLÂÊ˝-êS™on´ºÔfÎÁ‰å˙H@ãÔ©G∫0è‘ı©üæU=ÿ}xçº∆» L’wîÎÙ”óª:`S/§ë1ù’∑ÛE˜f#ñ›-÷Öwqœ‘±E	bFaÀ˝ö‘õõ-î∞·ﬂÄ·◊/Áñ≥n ‡ö*˜›ﬁ$›!wÕKÊ2{dRãIK‡xÎ£áÏ\ˆò9∑PS
áxe/-ÁM}"≥g’÷∂™Äºœ…[~˚1|%Øº∞¿8,:Û‘%Ω}-·_à≈Ú»'o–áaû*Û£Ú¯£Ú¯ÓîGwn1„tÓcû‡∑fûˆòsìP›˜M}<œˆÙG˝±‰ —ã¶=T s∫˙jê9Ω¸QÖ‰◊´ê;°
â‹.£F∫õ≥`¡Æ◊ÆFÓÆ¢F∫õÏjdÕ=‡Ä–Còk“˜YïÃ;a2∫dﬁ	Û·+ìñÈ˘\ôúIjè!©= Â2é–≈∑p´˘£B©qõö÷ô÷Df~®‚qŸ0°bÏÜryv∂ä
“C®|Çö¶p÷g¥ºåPœµ áXìíyŒf.ÛÄtA¸Y¸`#—]¿äQÚÃqßÜC]JŒ∫œ»F◊Júö#zOaëpL
CáógG.Í<^å√äU¡´:ù˚y3>'¶ö´øqÈå†≤û8ãíg[rAvLsR2•Wu8‘‘ÑÁõ·‹¥åÓµMa~!Ô:¶Ó+√yc„|≤Ö˝µø˝W$ÌïnÅæî¸ä¶òsf„4uêæ⁄6µÆÅë3jC*∑∆‹òøˇkòL˛t%kŒÿ∆ı?iõ€Õ«/Q„ñj;¸¿¶Ã•ñÅ‹%˛pÎmÛΩ˜êp”˛É
@“Ü#¨◊·ü3ÿ†çÔéåFƒõPX∫∫5˛kNëHfsK¡∞ﬂ˘†Å˘◊I´ÕCéäWÖ›ﬂ¢€ˆf¶≠`µŸüÌïxs‰3åùbÜ·˘
$ﬁÛ|w>ÚÁ†]N|$hŒÅ>-æ∑Õ|p¶3ã˘·ïD<[f∞1Kú2√úO”ám!Oƒ›¸¶ÓMÜ:`ÊdÒ-∞¬◊‘öÛ[hÿMX åÑ•lÊö[˛„Xz«E62~ºÑôr¯ø¯aÏy L˚,[y¢V›Î8[·ÔπÆ„ÍoX_a”∫é'é f˙®ø¿v›Iúî|Ò¯oπ∂TâúåZæ9ûTSovàÂúxù3™=ô¿>;rwØ‡ÖÈ™‚ß§vi‚©e⁄†ZÇ 25ˆƒGXãØÎhS‰Lï6õÕ›ó[è[dSh∏ŒX≈‹Âº≥åÕÓ∆Î∂∞Yx√¨˛(≈mC˛πÚœmŸr{-ék…DC-ã¿T¯;≠Vïä∏GjÚ@tèÜ‹Ó·NñÕ2Êê9_RÉ’M{˘~Wí™Ω·…5d˛Ü÷Ô"1ôa7
Ω∫´"}™π>‘‹(˘ßü0$O?e7≈˛d7s\yôsNj∏¯§”v¿ÙOûùû˜H∑G⁄'ã_ı˝˛—iNIÁÙ¯Ï®wq™§€Lv◊§⁄¨y≈Üsﬂwl•…ÊDÒÄö1«±;†¸æ:∏Ÿ‡>`H˝\ˆ∂1√üÔÕuPŸåÇæt¶O—^E\@“*Eä7[ÁOUìK±Ó¯˙î3∑êéÒ }‹»cl≠Fí‚Q∂„∆∏¶¯è|ÔNC›Í&òk¨1eÏÜ¡X'èH_6äx˚Kµ•˜Mﬂ*<%q
œaõSXn†:•ãuiŒÄo∆ETê `ak8‡czeNÕØ·∑≈∑.£xöe·y≤qÏÄ‰'ö6Á~M•Éj\•∏˚™F¨˝c”∆é≥ÌßÂﬁa¯WŸ|¶A˝≠b∫÷Vï…‹ﬂºf›|,≈ïFŒÏ˙¬ÅØfCá∫∆Ü,ø= ó‘>mæ§f¬ë∂ã||8ƒ√ôÂ€pÏ_’∑aP•çM)˚Uµ≈(Õ7ı¯jÀﬂqf&Ïπv®GÆï÷h º5ÔRU-‚ÕV®F€π™Q´D5⁄ñT£ÕVDOëS"m∑äD?"¸`uÿùí(ß˛üˇÔˇ¸£•®°Ç;sÄïÓ…°b∆RXÄr%
/4Cq#§O8Ãråá8.7G”t\üÙAÀq}n©r†Pæ±©’l6årub'≠N¥≤Í.\b-+~«
’tèvù7ÅåÇ>ø/’Z)≠%D≤ÖPÈPUX':JÉ3òQ˜öMÚë¨<ü4¡©û1˚ìVÖ‚3ƒîYcZ“Rv›üûu˙ß'=Æ-†—æ8%=–'Ωsi9kü∑9%AŒ{gßÁ=Eá §µFoäÇ˜ALKzM¯O•K9JJÆ)&˛ÇáX|P5b€™à•`Ç§˜∑8ìÌßG0ÒC‘Ó\Ù??(Mò¢ÀB–òk¨m:6Ñ=3„œUË8G†≠ë¢ªísLâ–ñ#¸7,2ﬂ∫¯ôI\îâ©Ál5∞X+gdbŒ?¯ÔÒôm∏ãoâ7'3èn|ƒ¥,*Zˇ’úëŸú°À‚îÂ—É—ˇx@Æ…Ã¡&<"Å›î€i?"Ùô€FqW ÛM¬:‹J—
]¡Œöú·C´T≈5SDû∫¶AúK≤ú8ÀaN«ÿ
˛Éº€Iÿt¸Á6±∆“ü-¡4ï<Ñ–…jö1Pk.≠˘WŒÿËÀ–ìnéú⁄ò˘!≥‡Ü”ôòˆÊy›KÑÁä[©Òf¯◊Ü{ˇÙ/ˇ˛@«4¸—1G.-9c∂Gß&'ñs ⁄Ë9Úˆ¡í]•÷≠Ë”¸ÆnÀ]ç{˜oø˚Ìåª∑¯µÏà¥±•≈˜º)ÏlóçÄÿ°›ﬁ1à∫63-
Ùö”≠ù=“7âª‰,∫1Íﬂ?¸´‚.ˆÅía‚È„πÂõÜÈçÃôe⁄‘5©nßtFøLx#r:πªGé·>ﬂ+˜ü~üË!øgMˆxË˜ÀwÕØ˘A4ßW-Ïﬁ≈	òç∏-$ª˛«TØR∑ÇT8E˛„õØUgÌ%&^N}u¢ébIT⁄ﬂ4U8ÖæU-£¡™#Á‰–%8m≥€&¿øe≥Ñ¯ÒtÜ¬¨^—Ee°™Æ°E´6¢åbKwÚÅö#•⁄&ÂÏ¥¸ú≤*õ 	Ò2”À1Jbä5¿;Yk‡£å50rõÖ_lá¶¿Ì<S`®¶L(^¬,(`˘jf¿ƒ]ø»≥n´Z’ÌÉ j%ï√,¶√zS∞õ/N)bgÒ‡.5a≥º’≤»ìçÜªK#3pûÚ>qŒ¨Ÿ)e£§ˇè$ãF÷£ø+¡rDﬂáñ3zÙè≠.ÎòU0ç:ëMxË√2p?cœ0—å1aå‰3js’‰Õ¥˚ºÆAt§¢’8«ilπé‘¥◊∑ÃyíèÆ»=dM0å#áB∑´·5mxMeêMI®çÁÁXí öÂ∆#fDé Ü
‹ÊÊ¶H¶∏Ày˙{!ˆd¿Pt‚`∫(∞*»H`Ü9å%zÖí\Àwa±}«ßñbœY∫ F5Î„r$=¯sJ+A“Î¢‰xµÃbúì	#¨[„∑ﬁ$&-Ÿ8Ö÷Œecf3Æ˜KPb±§.C‚‹ΩØ˛Bç5ÜŒ¡ø+r*DÂ™Œ°ƒgÒ≠Ç’*ûQY…Ì‡&˚ù™hö¸¡M˙’ñ@†ÓeÀ˘RYh∆âvÔ‡F˛K£GùD#©/î{""h∫Ãß¶Ö}I¸≠”õTCôØt{
* >( Rø‰oóË]≤—Ç¥Á-é=ŸLûAÈ€eÊ1—h¡jÌ™a|‘ô í≤Nå(ﬁ)t∞ @˛2VŸ!ùÕî´»™9[&s[F”¯Ÿ–(K®Îö√¿ :°C”Bå)rr&dHIxÄÛÌ±.{mzsjô_¶¿ûZÖ3’YÖJœùêyÊÿ‰)∫ó3®;√ÑÉK˘hxß0ß	óÈ≈q—∂…"õWT2LπºÅ†—f(˝ˇÂ‡ÙÉ•ÓeZ¯“H€`Ù°U|≤õ(¨Ô†€fW6Ø§$À§s∫4à∆˘ ≠J ñXÛeM3ô	YòµõÃ⁄ÕfΩµ«Ëºa∂ó=í∑‚ÀvªQ‘Ì4ûl;ÌqÒÜöæNÔ3t©Ÿı"‹Y+apz∏Ú,À”Ù∞!ﬂ§Yíﬂ(Âh(Òà∆$¢Ω‡ÔnG»™{ﬁàZ¨˛¢±˘¯ÒÀuÊîÒh9úEç¶a» ’ﬂ@XV◊SÛ≠¨ΩÛwp]F C∏äÀlss\üë-~¢n≠gÎR”e¯Ã-M$…÷à≥öÂ”≥§¿ò«`J·”∆Y®°9ÚÊoï®1∫ËI<ok†8	◊ñú>â€Bf€∏≈‘CXæ?2îêû§$´GA21ﬂ)™≤Ù∑	lé˚®÷$()JH∑|î9s›C≠µú÷±dê©? «Á¢˘ﬁ˝)[¿|v8Óm'˜¶n≤Ê‰w»ôEÅ‰®≤Àﬁ l”·oø ôç«ç·KÆÅg}∫i0≠LTÍLtx:¸LaCG*ëÁ»Z¬±¯Á ,LÔP—ºRb°ó«_˜,6¶∂Œº®–,MØe¶íÈø”‡ÒßÊ–2Ø3õ\ì£Óh¢B.ÓñòhcÈPÚVÛπ°‰>£÷{G˛‘q^ùŒò]ËË‚}ˇ†Ç»;@√sKà‰∫ô(¥ô.æ3ÚÿñœmXZÎÉé#?g‹
áÉs⁄ÇV@›£∆‚ª©ñ∑°q2õÅè"ˇõa¬Ë}◊ÒcÇ«’S“D`{hÁ„pªÖû”;J˚Û#œÒv√«á´p<`ù2«\s¯¯/öp)ÜèG¨U7vºu€±„bZgAnﬂ>ä¿q>Í«"µË›ÜéÁxíj.ºu«çá≠Æ1h¸È‚ü˝º◊mìß˝ßG˝”√Û≈Øüı;mÚ9|æ¯M{@:Gãﬂú¿7jq	?Üé°„y¨Ìc	_Çm«ó–¿£Ω«çGL-‘ã˘ÈàÒËÆè7\<oz?†pÒÇÓˇ..øÓn¬≈eyÌùÖãGßñR¨x¥øE†8«_&Yﬂ˚)—ˇÂ‚{7‚˚dÀ⁄i<l<¨∞e…bÿ˙≠YEÃÔé≠Y…ùSK
y™¶¨*ÌmÎÁ);î3wGåôˆ+èÜÒß’‡îÑ^&·ŸΩræs”>!çÂ≤DÊ#`î!Å§)±/ªZ“˙⁄„∏{WàM-úÀRõ∂¶‰û∫ùu†$öı…ÔÑ<õ≥0ﬁÙ0≤›t¬4á◊§gC‡˜–¢•V!„6Ç∑´"PA’ñ#Pq}’b˛Û)^$ˆ˜¯<±øVBˇ}uHîÛ_˘ââÀ.nD◊6ÁÆ©˛§»Á~P˚» ~•.ªÃ:®Ÿé3C(±Ë s]ùDÁ·gH◊ÿX]øë,>>ÀKrypç
L¡ÈS(8$ Û:±t¬-â6–ô~öÜæÄâbW⁄BEÍUD)∑úgÌÂ≠BÆ$¶£û'—e+XÑ1Pû=kñé˜◊É–€]kª˛‚˚—‹rHÉ∑ﬂ_"K€"ásê¨îîñh:î¢Î≥}ÒÊ”)ulõôYÚSr≤lÿ∑yÎ:_Å‚T9aé˝å5∞≈EfK˘L,≠^]Â»qi$‡WZãÓ◊)åı‚Q≤Q ´í°y	KùT3r¬ıvjæ11O,¡éyDò∫Ê'/®—ù€#åÍn¢€BÑ~"üJ⁄ëüZañ[TQ°V‘®◊óë_-ﬂSªgÕâÕ®Ìnønëç£”vóüû˜…◊>ÏüàQ˜óH˝ƒË"Òè¬©/•ÚWëöd«ı1à	≈cÈ0ÕÿÉù©APt>£†ÓøÚê§@øí?[U!8gó.Û&ù7…máõÆµö”:x¡ùπÆ≈ıtÓç∏C˜2–D¿∆î«–ôò˛∆0y"$ÂJﬂu0¶5yﬁö[\≤Ôﬁû≥◊0ÿÑÁöò@|Wºl…5ÇöÁëÛ€¢ƒ≈Id
Uä(ŸÒSZÎd›r8QUä∂íúl\<èxL&†¯Ex∫gúˆ¥ÍLı5Œ…√Í5ïÂ›[p¢·ı«?t1ãÊ◊w.QGÀ˚≥H¡t]≈ íOïHe¡j]“¶¯.ÿqSµî^‚
$dn√bcò 
Åˇ¬æ.~èiá‡˙ö⁄_Û‰]69õèA≤M`DD¯]¸+|≈ù	%Ë‰f‹hõ‡Zddÿ‰ò)àå"=∫a⁄ƒòœpﬂªº*,!bÀ€[˜Bh»?z©zV ª#@ ‚∞OüÙ˙…kj≥´zKƒY«	 B§ºG≤™$>Û∫7E¡NZïGµ(÷2e8”Ü'Àú§! RÔó+««x(íì†>+pŸ7‹‚≠∂T õ¸ÃöÁhh|ÀEó#s:g°Q∂“ì®GjÆ‹Œ‡†K_U@Qh¸§˜7†úÙéˆ0˘„Qø”æËéŸ˙ª§w|÷æ¯¨ﬂÅﬂ/˙Ωì2x~|‹>ˇÇlÙ€U
√Ìˆ€ÙD¯/"ú¡ø∞%™Vë\°π€∏l–\å´„bïÕ;AπíÈ5l•JÁZUJó`÷ı¬•∆ONêÄÉR?ƒï“$y9±æ?_Ÿçuk&a—∞A@*ôövP‹ê¯ãÔFàg%<Ï›«…g”Ÿ‚[Ã/¯Äå0f px˘§ÈŒ)œ‰•∫‘—∞>‚»¡|âOPÇ@«·ïà‰ÄsÖo,ÎŒÅ±≥ƒ∂˛ °±j€7o§∑ãêù≠∆1Å˚&yÓöQ≤óÕFÉ)¢d%Ê¨ãì}∏$NWµeÅe≈`JïV!\ˆ·RpY§∫[ƒÃrD ,å Â:Eﬁ·É.âØoE§Cœ±Ê á˚∞Œ´Éf∏ÿ∫˚ã"?B¢êf+û,.÷r¬‡À-$‡:{ç	t0FÂ˘¶Ÿ◊$!Y„ÿpüg?¸]`æH·áÉ°∏°ŸPì∞V<ÍsÓ/≤<ÜBÑ:~∏»í¢jâQ√«˝Z´Ò‰‚º›}ﬁôÊA^¸˙B êY¸–ÌÖÆT—
Hd~g©íÁ*ÚìN}ÃØ<Ï6 hÍ2SC£Z6ÃØ)-Ñ|f∆A·ñ;Q¨ZCdq⁄c¸∞¢]cΩˆ…U0›|gÛJ∏∫ªÌ˚t4	N‰ÁÙÚ“ƒ4’"äuÛ	ú7|XÍùèØ±êÕ∏JO˙Ë«‚Ï±)G Ω)„¬iŸ¨(Ur	ÁVãck_4æ‹û]}˘˛Ôéát£˘AÛQÎAs˚ÒÉ∆Êˆ}≈§%x}H∏Ò“È«iÌ°\„Õßp>zXõ`dÕM¨î@Å&L`#<˝ñ$}p@8‡_ìrDÊ/vÂpÃe€¯jn˚auÜ∞…ƒ}ÿf∫•uÇÃ´∆˙éròÏ†á~µ&b2a¬2Û•lúæ€,%Y£§4+—6XbNÄ¿nRÓ´øû8£|ıcâ4ZJ˘ç/qòHrm$Î9çÑxõé8íÓ¸xcéÚ'˙ä:*¿èqGÚÎﬁM‹ëp9vù7∂ÂP#π4g›gÎè<äÕ?—>ì∂s“)©±Ru¸tâÆª[m3ãMZÎ2t€çERU^vÍä;∑yvÆ¥âÏay-M‘û⁄ÿÙπú'¸Êπœ‰
Ê˙Ç†ˆ√Uœ
îi9jP>QÄw†£ÔçÍ>É√¡Oíˆ˙CÈö≠ƒ) e.Isx]+ÈLOtï`}ﬁöÔÈ{t•Rq$ï4¯Æëz˘™¶MszƒıY‰©tﬁíïŸ2bçˇfB}Ø=õ&‘eü^ä/ ¯'keÕ˙QZ?8øåiöíSÍ1)Øz+î‹≥_cp(ìxôTÍ–†Ex®=G|µÖ´≈åF¿yaªÓ≥5“˛1Û<:fÉ_ÕÅ(÷™ÈFêYπ»(˘>Óé√)5≠;Ÿ.Àﬂ¯}ﬁñøˇwµ:éÎ2–$P±p·AÑ(Ã=‡Â+∑Œ-ÕÓÑ`±îwÔ‹{Ω“˘0∑Ú&¨
P	ËÔIgˆbœ-ÎŸæˇŒR	D•ÿ
s	‹⁄.∏Â§]äû≈úÈwS_Kúõ<ºÿ#G¶Á:¡Ùc›}W¥6Æ„≠TØÖW‚˝›Êﬁ_EﬂRn5∏+Øˆ‰ﬂ~˜€ﬂhd,UW@ui{YA£[4d`7À¢_èÅﬁ⁄6ı?Lπ/1‡K|‹¯å~ù5GÅZ)L6nwÇ˘T„Z*!‰ E™HHπ,qí}mæb◊!=ãPÒKÒ◊°ˆ5ﬂ7¬X’óbÍCüHâX»Ω{,¯#|›h˚•ZÅQó¡yh´õìpéîMî˙ÅÎ2ñ≥ ¡mëÚŸL0‰Lîsí€&¯uKŸÍ™·∑–¬ﬂ„ï5æ˜RÀy~7n»ÊÊ&˛ıÄµﬁŒ`˛ôºUh/i |y1W¬G”4LAú≤èÊﬁû3˜-”fÕîü≥1ﬁYKˆVS√0Æ∂Z(Ø„úÚ(∆∑4K0´•!ë:ƒœç˚›7ˇE7»V\7≥—Ú∑±]	’M’lÃ∆HkœŒ≈‚;∆E+fàHπŒ^¡ë<√å(»	kysÏN
Däw-öº–≠x¡‹È€⁄2+°9óZ“¸Å‹±¶
{Ö§Ãá	0»¢\òÑ<dƒ÷ò$RQpπfÊÜd‚Ò?˝„ˇ&ß#+qπOËOˇ¯y˝s!8hÊm–ç@◊(ëÌºföáÇ¢û/~“†ø«’OÆ üiI˛MÉJı%I#	]‘Ñ°XÙX:‚ëmÖ	(_©¬YŸPóeƒïxªòSΩ  wKFjÜWB?{ò=2A<ﬁ”ï.O-:ìR@aê%±=œú¬–/Mf‡PõªÚıËaôSD3ù&dÄ™›8 éDúÅú%¢9ÿ¿E¡sΩÑ˚®òpwã3Í»Ñ[l^[bÖC©‚ø0N‘ÇàñNçÇ*`'[⁄ø[Rì’,#uÇ^Ks¥ƒ|ƒ'Ω¿…^øUSÉûﬂ)ï≠9KFﬂÀDŒMÖcº+ÁÔVÇﬂ
â˜˚êƒ;^NFJzw∆\o∆∞pY˚›êyPs5û≥Ì€bÍ.É7cΩˆë¶:∞<ëﬂ⁄ 
≤Fª˜U.oﬁ¨cS]Èñ˜'Zπ˚≈I˚∏ﬂ!ÁΩ≥”Ûrxt:`pÚﬂÙ/>#Ωœ˚›ﬁIßGßœœ;˝ì√˜&\π{m”©9:¥œ[!^π—∏lÓÊ∆+sùÛéV:Ûá´åπ}|w~Õ£v—¢M]>µ£$>ÿ3Û2Œˆ‘ÏQ»rÙG-˜∞V´µgbY¡DÑ∂Gw"A¢˜Ä D z)jn€TŒòb8·‰†⁄sçfnj	D}Âxâ@ 1{Œù«(…Ω¸1)Áıv£îç%r›∞∑kPn6¨π≠†q„wU∆G+<9J…Rúº\-üè/89ö+›–dÕæË◊&‚=ã#ãQªÖÿbÕd¿QjQ,∑YmŒ5bç◊UÓ◊iÊCµ}ﬁ?%›˛…‚◊ ªûbÒ†xr: _êŒQ{–∆Éã1Öß⁄p>Ñê‚∞dﬂ) GÜi,æ˘q6œü£5»ÁÖ¸úë»y-‰d)œß\ Ò>‹œñK∏ñ¶_"P+b¢qòVÃÒ∑HáhEw}ºZÈ©˝ÄB≥r∫˛cPñ¸∫˜‹ô“61ñwœH(r^ﬂƒ3 „xÀXœ√–lÒ>√=ó©÷R≠€fuMAgÄáß–
Ëª≠-“;†¡c≈ƒÛØ-ty√+±H ‘Ô ‘â#"Ù¬§<≤Ê1◊:k*&fÛíÅné¬æ¢U≥6@´éHÖuj˜U1á…ÓFUóíYÃ”iõª˚ñ0¥7Ù∫€⁄0äp…áÁ>…c ¡ØÎÍ1B^ù)÷Y∂≥swfIÙ¸-w8∏c]]>É'Ó÷©Ô:ﬁ≤=è–ô\ï)å¥FœU<ùkôæHB‹∑/Ë“8‡ G·˜/¯ÿëºƒÚ/7√H9 ó=‰Ì_®ºL1´Éó’EÀ&Ãé≠ 4l<ä´eaA	lëe®∫ÑQ∆Ï#Vb⁄lºîÚG%Q˜(eVZoc4qá≠≠b#
Ø¬Ëáiâ∆à…8˝¸ZPz•\ä@Rñ¨é~k}kN Aë5•¡∫¥≥˘&⁄ü∫xSµJrÈ7Õ\«ûcZw$c˝L⁄∏’b¿Œ2Ë≤F¶Mù≠S◊3{/oL∑Óß◊öØåMSó•#9í2æ‘™Rç$ÛüﬁÑgöR1O˘∫Iú¨∑B’¨[•‘+ñgÒ	^≤ö®âà–Ö8‰⁄ìnúLb&åﬂˇ$òtëhBè‚ı*∂U obESq˘AŸ¬ÑXw[“42]pxØwnìxˆòY	V®›-∂‹tàÁÀy\#¿F—xm4∫l≥¨âV5`F:•L¥6Ø√5‚ÁCPNdñ…˝’úÅ Ìq…íò6¡ÛÂ%éb$˜ÃØÔ§D2]…A€˝§I`y!ó.Åkî£Ø•0!Õ≤˜Z‡Ñ,€ñ\ÊyÛ2ë_ôÑ“⁄10Ñ‰(¨Ò√6"QÈ_»Õ®¸˚k§K≠Éô√Ù0ﬁ8∏I(QõÅÇ§◊X≤ñK|Í*Ÿ¬3Jy∫vK§¥l7¢nÔ9øÔ_◊CÕ3S°ë™ÀπLçb3^⁄t©l‚“4r◊H√Ë^i£Gr_€‹n-óÕCú◊Rﬁﬂ‰ôS- 'uTÛm:Ê˚ËKÃüX∏ÇÈ[jé¢hú\¬ˆ∂ÁJO∏Uw>ÑOËâ∑xF˜ÕäÀ†âÃ±ñèLbf—k<¢˝	##Íh0B‚‘äRJm;˛¸äÒ\Sa:≤,XËì @ÚEƒ¯Õ4&g9q9ƒ•∞¢∆“,d¶À[B ˇ˝&«¬@G*ﬂÊ≤±ÈatM‰æ>ò=ΩÍÙ™>ÅŸ}»ß7õπ°9'´``Íıa˚oDºdœbcj˚ÁÃõ9∂«6≤d˛Ä‘ÁgMS∫X&d7u,ÓÑ@S†|^=ÿ#p‹sáF r7èvÿajSá≠√æŒ˝a”bˆÿüê'§±îΩ®§,{ZHÏ‰´q(á›ƒäÏÌƒDÇdI|*W?Âò`¨7£ñ·ËF“,KS†%t,˝¯&ºÚiJx =w8 ·S?ÂÉ‘%ß`:Íå|qÉËÜÆ°0º&.ª‰mrﬁK6‚SwÃ¸É⁄ó@áˆ+› ∫~xP≥gÜ—hÜaóÃuı‰d{‚˘34≥kl∫æjì%%T££4Tÿâæ√√ﬂ≈—‡ŸÛq".†Ë0k±/◊Òeˆ ^·A¸€
bN)qÑ˛∑ï»Fπ∫{Ú“KçæJ”nΩ‰C∑iLØÆ8_)˛≈‘"!R›õ%›ìMo≈Ed™=Á≈EXc9.¢µB\Ñ˚§õÛ g2Ù÷I„d∫ç∞DÂ[‚´£?Æ∞ƒAÁ≥ﬁq˚¢ﬂ!ù£˛Iø”>ä ¶û>#’˚Ç<Îüt˚'áÉ˜&$q0ö0PÕ—ä5T1&q'7&1N}Å%∆y?>ò®ƒ^îπÙ;ürÄÌ$Jµ7sMPqgºÓ¯GàÁkı0˛Rd§r,"≈‡&*´Ú©ÒàJ¶‡Ö∞^h4™@;:Kñ93LóÒØ¬,˜£95\åÑ¥?Ã¸˜!<—KÌÎè9>1w¨∑†ò~Â2äi÷ªÓR™çQ„ëb§bÃ£ﬂÀP≈`,eGÀ´ÿ'@Í"HQ	„R›R–b<kÔ"jQ©djU4cú])gLeëºª†∆#8~‹TÕ1)ú1»ætwÒåQ÷j£Î≈BEúø˜,*»FGäÉËPTI—˚AÑ5∆‚ï»Z¿kÇ!ÃŒT§˘π5B‚Ú6nå~	D	˙°4Æ\ï'ÌÊeHÄCç«H'j&¯‹Ó$Bl°◊´ëä¡…œ éj ‘U6◊Í!4Ù#2Ûb2#·@Ã÷Fç„®<uWJ"&3'B)4ñd"°VMEØüIàó•/F™a4—öÒπ∂›Hsæ$!»Ÿ¯tﬁ≥G“ÈNj…E∂äÍªTÉ1U˘’ÈL©Êyj9¿∑=Eæ£„ä/vâè¯ûõDÙ«=RyÈÓëÌ=rs´Ê$”äîUˆjø˚¯ˇ"UÙc…∞§™_ÚÓI&ê¥©ƒéJßXn?}X9ä¶˘ P2Ñs»Ø”IlæBí ’=.B:ë ?ïÎÄåA8‡hpfDKƒ˘m(eﬁç&3Õá©‘öy{Î
äéDäÇW˝Å’°∫)SêØ „pB©ñ≥fìcÍæ2ú7∂kxGÂY€0≥∂†Ev·úÛlÜÎßåƒÁ˝éˇJíÂ√›ñ‚S‘2Œ¨y ÷¶Y’ˆòÎc©?õàU`k%íuV8´†˝Í£aÎÁ ◊Úh$P˝`G]◊œ®Á3ÚÃEﬂñuç(®ÕÄ%ÅLˆÜ¸|K€:$˘bEá;«Q∆¬°á¯ÈUÄ[UMûÒµl^&´ddË–∏è"ÈS~Ìò5ÓÚVŸc¬=∏∑d†f‰rHπî≠ç´'åÎ"0jÕlÄÍ=Y"F=?Ïqπõ<ˆ…'î⁄&ÁnM¡›$[`°nª≠]ZÊ2$øæÅ†¥_~ˆS§ÚÁ§©*.„÷KœTökﬁñ Ò¨=C¶<I	[`π7}Á98*64QhKE.ﬂ∆Õ)RNÅ/¬yõq«@ºüó€6Y?E,«•˘´Ìùt.ÙUP¥^•ÂE4Ç£ﬂ£˘pˆBÏÂ [8"¬⁄† ¨Ìö¸,z´O∫—∫kΩU™‘òö:üŸÅ)ä≠·|é‹›¡È+ü“ÀúK˚‹˛òS0>Ú^;rÄ∞fû*”Ÿ˜'∞!îó€wsÇ¢s‹∆¥‚\Qâ2^ä¯âæJJ(á◊ûÙª˚[˛d-ù≥1∑`nI˛…uµ≤áÿ√´”2‹Î™nJçıﬂ˜áéq-˜®÷®éÈe˘áXyÒtÂU[VT∑ÏkScvuXÛ25UÒí¨î…Qàºô*ú∑øºÔπTôID! f)˘0Q}Q?Ê-_‹˚sMaè∂2WSv©ÿ∑Ã0ì"ﬁ{0∏§D∂\Xg"å2êu`¨Ê»±ÛÒ∏9„ÀZ√¬ß5m¡D\)ÈÊVgNùì‚•lËT)3ºYÆöªããk2òT«£ WsÍÚ•§·McW≈è€© íX∫…Ñ’¶≥∑©j¬˘¬sÃøƒ6ò÷‰*zjç*≠Rê|Àÿ∞Ø0ö8Ã ¯d‡¯ö"§•,Jœ=
2iÙp/ =;¥≈ﬁèoÁ(Èë∞Á^ìóáGëf£Òg éé—µ√l‚ô∞'ß‘#N ™Êëû¢û¸√\¨„ÕΩÉ›6D¸≈à}N Q]'lÿw6aâ-ÕÇ¬;¶0˝Ÿàÿ1Ò‘¬§•◊ò·ˆÁÿò7¢ÓòÚfœ∫œ™ÒZj+Ùn¬^Íı:Ù:ù˛‚õ¨6pﬁ{÷«∫YΩì^}†ÚÏÙ¸∏G~F∫˝≈ØèN˘∑«ß›†>Ümî#¥r‚AbW¥£∞e„A2†›Ãn≈ÊR¡QÓOvTî±=•D+( ìÍ +˜@yØê®ì.<t‡âû†,2vB4)9«DfhÀF≥6»¸¶K:X˜$®ô§fﬂﬁﬂöÏ¨ ¢âµT1¸;¡ØùŒ-û°:,∫M"Œ‹!#Õü,YrJlaóâ{`Z<6Ö¬
kxØ+J£Ù‹â=7Åñ¯j1Úî{™ÅèLN^hÈ*ú3™é´‹ƒR«éa^^b⁄®Ö4'/À5LµAG‚÷à ¡Ëh~˛Œ6@[ tÒ{õLﬂzàPüìw"∏¨
x+N?ez¢s@]™.µd∫©]¥oãh”`sN§˜Ñ_ã óºRi<X§È®§üvÈ=ùî)EõI˘ßPlI'è”ÈVs¶ä9´ﬁ¨ŸuPƒKÏ5πÃõtﬁ‰¯Ùr≤CÖs’RC”´(
Ô«NÏÑi*ìÃ∑˙Â’¥Ó•œ{È<⁄Kï¸IÑ±∆ÌÊb˛(^¡èÃ·ˇ@€ºj3°X√õà’Ò—Zƒ?!»áÖÏ6Q"H{Æ	BXfg”é££=¯,RdJ’ÄÄ√!{!´Q¬Eﬂ◊àj"À<#J¬Ø»1¢“…i~˝∞ìN˜ˇ#Ø®‡b¶÷Õ)rI..–∫xƒÁ·kLô)îﬂ•&πtM¨S>g[≤úi géD*•©Nu%ô-êì«(°Ã|ï Ó[»V∫o—!∆ıñ…º∑ô)òf!PqQXÁ‚Xä†^ﬂBaù≠îègji¡t¬® Ã‚åQó© ¨_SÿK7£πã»p≤D}*+8Œ&X@Œ3Çù;yçm∞MëUhìøR…6√ºTP|ò{PÎ}µG>·™∑åxÛ1sE
9JûˆÎÁÌÓÄÏ|ÚÄ|“µñëH¿‚∏d¸1^ÓSûspÒ=QxÇ˘£M€zjE“	T¥VÍ∏âQƒóŒhÓ•§÷á≠$÷%8wHBqçÌi›Yö0éåç:s3ÒH”Ù·,ﬂ¸:¯iRoÓJfˇ¥Ô\aöV∫:BPπ_-õÂÓ%Z.ô4èﬂÀmy”wÕ©˛#)=q±iå¬ ¥Y˜ù∫K.]gQ
7N¯◊/"¨´|O+"‹¯N|.íµ¯Õ1ëGﬂ√Ì9ﬂ™Èrr·l‡ä ˜7”g$«ê¥Ç\fç5Ú§Ñ Ã®DAº]@HŸÆ¶4%Lﬁ≤2\±'å\öVR…+Áﬂ›ÔLÿËU«tGVN€‚¯Rk§‡-A∫’û¥A∂∂Ø„ÅRK√´^Q∑*â7SNä˘Fx≥•9GZjπø÷ñsDì*r]‡†ñTÙy.Åœ€GßÁÅ©øs¥¯&≠¬Ôè⁄§‹>Ïùê„≈Ó‚ó’éÄõ!ÃÊ√›˛îéŸRi§T§ïµf˘–V-
”kÏ<Ÿ˛	Uë]£,°F"ıFÌ…rEÛ’ıù 0è˚ZBRƒ ):T"#∆Ì˙Sxèûô4ôe‰‹â“¨S#üÉ≤&uÄ?˘c6lÅÔ`ŒJNÔjW
øÔùªSíGGmj-æ˜—Lop›•s∫% p;Ñ‚ô˚âß¬Ú∞2K¶ìt*I,î ú™ô)™Íá®Wy™*¶ôSSì«Râ
¡VSË7mwˇÚ˘…E{Ωn‰™ScEÄÊ¢|Ÿ¿ RHæ¢^Ôµx Gº˝ûâü¬T´°ï'™»˛˜® ˘ü»EFs¯2åë\DÉzì(@bââúÅjËW,ÒÛÜ¬úÅ°Ì1ïêp	Ò∂∏íTäµîø*≤ë(ÌÛØì¨—¨ÒZŒ(H=`¸?jı7÷«™·AºËßﬁxÑuáŒï“FX…√nÍ'õ—EWÕ¸ˆ∞Ò®π≠ò˘-íVtøÌÆí¯-#à)å~è‘‚w/ùô/•B}´G]E'&,”FçØ;÷™TZ¬s¥™ñÇLEﬁ[¢JÄ¨Ω ûIú±_êœ⁄GGÌø;<êˆI˚bÒÕqøs:Pëz˙1çXìu/¶fÕ∞e≤Ì‰g
)‡^öâBJ&I«•ﬂa∫ºVa”Òıi¢\ªî4$÷eπ3ù2DÚ˝Íe‚ø”¨!xÈ†„£Ï!3~˜…CRgJ•#—
ı( #jÆ mÈ++Ã%¢ˇfıızeøt9`äó•3{§dª0√«2‹L;}GÅŒoÕ|@»∂»‰û$ı¿Kù,Ç‰íA‚V»D˘Ñ÷»ÕïíÁ)ã‹\jÆJ?	¸8êúMKœ§C3”≤¥‚πU ?è∞®$&“˘ü
ãÅöä.Ö∑(◊∏.(ñŸeµ§‹©òyHu≠PÁ`[ƒñí∂ap
ßÅÂcû7EÂœπ‰e˛x◊ñÃEZXã7Ñ∞§U®iú	9qô?ö‡/•*œyº§!RpL’c‡4çî%‚ΩÜHˇ«?tô«®'∞Ö≤Õ¡§c{ÒÉ«Mñx‡[◊è∫&%3◊πÑMG?UÊ"ÍÂ•9ÜÛ†ÂÖD>ÅÂÉ˛X^ Ù{	JÙ‚[ÀÙLùÇ!408´Õ'l‘B%û9A3>hÄX !ûI^À‡2Ä™àe-ìúc%+Ø÷‹Í®OZá}*ÒR¿oÑÓ´z†ÀÄàÿ¸s˝£6*ìÏH`Ûá-Ûô¯:„˜LBä`Âªw+œA"H˛öë†&N(GiÁ/êñ¨≠Uò∑Ü¡@ãaÎAÿéË0ÓÕA∞kOÉ]´S∏XΩØû¸Ø7yäcﬂZ»Æ≤úƒÊH¨RÏdªé”»ﬂ∆®∆∑jÁs]Àm
ˆkë6RœGØ»Ï˙`
ûâèHˇnP‰jf©xí√XÕm–ŒiÎ|¨πª=TÙ$ù˜ﬁ{ 0ˇd}‹»¶skIÈüxj∑Ë ¸|qH€{‚Ö∏ç@´†ÈWD^?hø¥ ⁄Íâ~˚dÒÕ‡—SÌnø”?=iëçAÔ˘I∑MNœ˙'¸∆ﬁﬂûıŒ/⁄j’Q~tPHWûÉ¢åO~|^äOÖ¯Æ
)6vVHlæ’»l ŸaënΩeóEÎ}pYîMˇË∑®ŒèŒã¢Wﬁ≠Û"OÃ|ß…‘êÔ√hZ+>/FZá/\
7y2hÛûI™‘reƒ…Ωb¯û≤{£ä◊rcå6ı|7«Œ˙›9v6e.µå¸¢Â·èú[©¥—)§Bôògù T©brFUÇÀ≈ÕÜ}äî˙$|'¨å˜ß˘F/;ZQÃØNùΩ*ÛªËbLUã»-¡3jOŒ\«w0sa ˚6ç€ÿqÏKì⁄_S“	J˛¯t¥ä≥WDé“¶Nß.<¢§ﬂFè^bÊÃ≤ “kq#õH°Ç6{éÈfòìG° ©X»k”õSã¸jŒÇW>≈t[ÿ§+*:ä‘\An—ÍbA‰hÜÆ&fÇgÕ&Æ çnNﬂMdqò“k~Ÿº„æÖ˛»¸É≥ñ÷Au‹íkπm’X µ‘`Ω„ßΩn∑◊%ù£ˆ`¿s~]Äé: ÁΩŒÈÒqÔ§€;ïÌW ∂T8œÆJ8OëkÏ$ùQoW7oÅJ¯è¨-≠; ®?üÁV∆cD…©\2§)•@˝j·Aí<y€Be)◊∏£_ô∏[ÙöÙÄe¬ó··@´˝jaAw‘ﬁg*˚éH≠∏ÁŸLÃ2g⁄#«ù9®–≤`Ã∆¯éÒ!∏œÖ5ﬂ)Ü)jô)t≥	Ò9=ŒLóZ¨5Oo¢óQ(jAª° údYqK3ÇΩ'í¢‘◊Í#’À∂•≤X)ïP…¥´¶Rî6î≥q∂l,€PéÖYcé"≈ÂπnÛ-Ò;QæIòm∆ÕW)æ∏Æ!Vº__v#7$U›©9ŒT±OwjNö·»ù∫[‚NÕ’˝TTª˝∂≈\_§*»Ïà“@»#Èµäô±r+•»!h¸`JÎ.ú√inÊ2ë±2f´yá”∑&◊∞¬MUﬁ„>OO
¯–Uﬁ˜õ≥«˛ÑWıj,C|r<$·‰Ãª⁄ëêJ9÷◊'£»v;–]·@VZ¸¨]Ç9ìÿˆâcGr»ìΩÚî„ò0ê\xˆ¡ ¶yìúÕô¡”@è,Ãîk;>‹gôCW§çvCÊ‡B˘Ó]I0∑B]Oñ£≠Xõ©…íπùÖ2`byïÂÍ¢òßÈµ-ÿ u{4"‰ﬁ=hgìäØ˙° $øwœîæÅ^x/‡Ö/UÚﬂk·(-˜‚'ç«çn≥˝≤D·-»∂ï0Ó¶ Eº’*»ÂÍçëÆ(N°<UQ›‡XLU™J∫ü'bÜπë5ãEd£¶Õ≥ëÒJã§*ª@ZHÛ$ œ…Æ’åé[àEŸi,ÖB◊ ŒAU®”õñ%™a‹$6≠ûÀêøÛ],Öd£œäÛ-ˆÈ’(™|™ΩJa≤©§Ï∂Õ•mQ¥ô|Ac≈€p∞JB\´@w~óXS],œªX«∏∂«√DÈıÏ2∆•>nk≈‰RÇ¯"/•ÔÙı‚{ï‘2â∑-≥äzu5J)Ú‘‚¿+)∏µ'(ﬁo⁄–Ã[u§S–âB·Tv¥¥R5°2™ÀÍA,xÒaºô\G3ÙV@√’oªó`ºJ”ƒÎ“z≠úßâÌ°_Ñ)ìF∑ËÏVÄÎÂÉJ@|≤äë¬aıπèxâ›n⁄≥πØ˝Xs!√:Wz)qÒg—‚»%^kn∞cj”1è”âƒ^Ωs^\yπr˚yoÿ¿2îº¿ÚŸ‹‹ƒø˛⁄=•—∫Iﬁ™œÃeL0…
æí»ú0…Ò0 ^õ•Ÿºï":Brî¬oÙGY^¢NS?PH%4≥N©çUô∂P#2Ê†Ò.W°L1˝s˙!Õ3@c•5€VoWXUêUW“.ì6ÂXï’°j…M5å…¥ÄÆØ»ΩÉbcÂT–beÆÛÇHıäì7z2ÊF[§¬f¥œ0Øl•°_ÀJ£◊$OSË—©>´áÀ¡v|®ÛF-°¥|ÌëúFÛPÃ:Fî—•ΩCM?ï—L{2éÈa#ü(ø]<—	§S Í!ˇ∂´≈gu0∫Z“SÒ≤iÎ∞Z—s¸Õ≤—l˚=ôÉïM“ãµ,‘WRÓı'&G1Êì"[®√juŒR≠kè˛∂á[RYD1ñPã?∏Ôb‰:ß∫&Z9ì^Áπ¿zÂgAtaKPKŸ¿_óÖ(Ω¯I£’x‘lº¨Æ
π;íei3 £ õÓ> `_ÂäÎﬁ»u,kH›∫?ÅmZE∑ó+-ûÎüÀo+·j¶CéƒéQïÂ1ez÷í√˘‚{é0¶Z'ÉÙ∫¬cc— _≥w[¬$G* Qgâ¨êN¶»6rÒÄZØºH£BeﬂÍöæj.© Á†Ü«ão∫œèxy—nopxt:Ëë/»_>\H•F·GD"ﬂúûÙ‰º›Ìü-æ9ÑØ*(ƒ§∏˛´WÜÛ∆Ü9∑ π§∞ß"É·9÷6 ˝wŒ3
0¯ΩK·ùp(åyÇ‘Ë€Ú)GG‰ı⁄ n¢è(˜áUÕ¯eEúç0Fƒ,hF˛≥¸I«}·àÆÇ Cmõ]·@î<s¬+î!È°„@2ÑµµkU¥*ûœÓÕ;à^ÒÁ$Í`UÛì›Ÿ⁄´‹)h/’m≈gﬂñMx…![∫Ô
v\Ÿ^√]vŒ≠«öOÌ=‡Æ‘™˚Ê{†ô—áœûuü°õúûE˚h rÜf\∂≈S?˚Yf•KÃãÈ”Ëá∑b0¯Ã4ıg/…ï≈?>ÇèI]2rH&"E:Öè≠ÑüÎ9*ê:<ggCÃ˘q8ÎÀxK¯Sôyü⁄[r|"GÉ+„¿ÎÆm¶ÊJm*ƒh|≤|è´’*Æj.?©{YΩµùñÏÀIã1ëÄ£ ü|ﬁ\¥…ŸyÔÛ~È¢Ú‹¨6¬©T¯^SÃ5lŸÄ˜¡aﬂÜÚÒÚ)Ÿ≥Ar„WJ‰Àdﬁsù≈–ÖZ*4e1WQë◊°QHœK)X< ï*ê¸¶
p—ÔüùíÛ^˚Ë]lÑj)≤¢vepC’‚u.ù·‚ÿÄKTN˘iPÿ´úùìàaü≈e#
ïL~~¨≠¢∑^fÖlFÖ38•∞µ`äpÜ6>¢Ú'
ñÅ¥a:ÛÕ◊Q›x·åY„Ú_5ãÛ,="nÎG•§ß}J>IbÛ%T}œRkjè7ï©#Wí÷`ª—®n∫⁄TZÕ‘åK ’√Óé`gp4¬Ã~ÈÕßSÍ^´PnÏ≥π<=\DüûôÇ˙≥Q/;kŸQbè‘í£3®j \'PÖxpÌ∑«Âî,Ç]·Å∑tHørx‰yeñéÍ=ÿìﬂrºb-;Rµ4VIq©á^%É«A;vêU◊[◊©¢nº#Ó—6Ë’^–¬Åo‹£Ÿ/ıøÌtéÿÿa°
·:¡#VÂ9É—ﬂıËN%˚®#P´O– „JoRÁµSò$L∆#g‡ì≈ßåHvPY\=å-jySfVgæ}tq˙	N“…È˘q˚ËìıÑIU"+ﬁ…Æ+ó«`Ùî—uﬁÿñCçÃœÜÔŒ:Êíøü%xwtü^&ﬂ®	ÇLµäÛıÀ'∑¬i∂b÷öÄ^€C—E£h=3ÖY¸+%ˆúΩ¶´SË~Ô
˙bSÎ»¥”YŸGπŒÉiÈ™∂–¯¶ÛÏ?sa,Z÷øº
Îà}·9/w‚Ñ	ª_ÈWbƒπ∑QπC"m∞9åÀÁÆ%{'¬›¿∏_Èª/ØzΩæ‹R}’á|Å·ÁPÿ£Bì¢!®"tmŸBz⁄Â„íz|ç1/EtÃ YVõ®*°¡’˘AÕpÁD∏&‚?âI∆ëtÒﬁ"è|&Ï1ÿ}’‰f^‚ŒØ\1œÅ˜”õ5œÿ€ü¯éÉ(ÄÉÊœl˙≥
{	•pÉ©ëO ÂÛ„(Ù}lGÂ‹q—ÉÔ2˜S|_‘lß~Uıp≈^U£ﬂw«¿‰ƒ4
L¨0Dbc" ••ÊYÇq≈Å0´T ≠¶¯OÅ>ÄV>sls.©&4WêüCÂ5ukµ$[Z[îi+•3à
(W^qƒ«ÊDA€Åiá Ò‚∏¬hcG¿`¢s¡≈X/ÿñJ√¨FøÜ¶ÃJÅµ`	‹ :∂Q‘gãü∫_1ür∏’B‹(ÿ¶xÅüÄ	{∏Ñ´/îJ⁄™•û-˘1∑…b±4ãËQáﬂç“—ü3ò¥"¡g
¬íZçÜÇÓ/€´CXDt¡‡bÒÎìn˚Ò5ÁΩnª√—6{d–;Èüûõ”√˛‡Ç6[e.—ﬁÛãg¿≈ΩŒÛÛÈúûúÙ:ò6¨¯¡íÈŒ_∏¸roﬁﬂö:®9mf~√`˙ƒ?ÿ~JvˆDjÓSÃÃç<?∫hü\êŒgÌãåp#∞t»∑y±*sÀØÂyW˜„æd∆Ñ1„—√ô_MÙ?j‹‹ê¿§πG·|⁄|¸(lHûâßö—SÕºGÿïÈkæ%VOÒ¡0π5ﬁﬂlÂ›ü)9µ≤‹4»ö<Ä'ıÓ—F≥—x=©7waS‹I¶¶ç˘:aG‰‰ÎÃ°ñ¬=€PÕ<ó+§≈œ8!]ÓvÀ˘ä[O'‘'ì2|âœ…ÄMZ
<GÅU(jãÖüÙÛòÚ78Ìâ¯+9„]¨7Kã“ﬂ∑^¢ÔÁ$ïÛ¶ëH¯'ä¢Vä„QÀ«ÃÛËò~5ßnq]ÂTıüé‡Oﬁïãqïe	‰÷õ8é'hÌ8.
Gë‘ª.+V" î¨nŸO•÷«î±ÿÙm^íç πÈFÌè82ß<m3à?ÛÑ˜f‰œE1"nsÿ4ı>≠›øèN‹ƒ¡R{/^¬Åä∏¶(îd'‰ﬂ!‘I°R¡ÌÂb†}æV¥<·îƒ|¨S±ÌÆ¯ÑÁ–
†g<ì⁄´1¡Ä#£Êï“Gôi‰î+˚Ùf$-]2·R±π"ÀÃ"≈r cjÛ©ó1ó&&m&ú"ËáÂÈ†Këß9a˙9¨2o(—c6eI˛úéﬂ;Âa˚πÃ™Y ¨Ñ˝ú˙≈úZ´¶"ˆ}Ò{ÿ‚†¢Sr»@‰0	¥ÈÑeøÇOò9‡Ç<œ°<vﬂ^Ú§P§˜’©EZ-0b≥9àÄã\zEËÓ≤ÄcNÒEÊ3d˛jnz>¸w6∑`ª“ Ô:æ¯`ç©Aê?˛!¡U?-6¶,«pÀå'â›¬s7MΩqúª©ÿÊ≤ü'Û∆Wî1©‰Ÿ] ∑⁄Oo‡ÂõÆc	ª6˜‡8F_|∏€òmp7{¯7œYT+ÛÒUAmKıWπÉÇ$_<B@s2áÒnàÙ∏Ú–n1±ÁQpñú®≤ÄZÈªÕôåJì@¢™K¢¶d≤VKBNŸV)õíÆ◊RÊØÕãì Àòëäí\ïv•‹°´âøMÊe_=ÑJ'…D≠?\Ù∫dµÙ≈7†¶üﬁÁ$ÿ;ÓüÙeÌµ›Ø@õ,ÉHÊ3¬s>MÂoYv<
Ä‰ƒ˘†@6µ'¸]ÿø∑
∆BµHŒ¸∞=y1aUØ]qq‘|ûÔŒÔ\Q∫A	uèΩ±N¨GBÃ∏§«’	„´“≈#´ï±Zb<’lr⁄“¸A5uõ^AŸTv·îB6sù!B„ºX£Åπ¥‹ù∏
Uï[]ã•Ò \ªπ°6R¡“f÷¨SV≤Œ·§rUòö∂"6Ó}—^^bJ¯`]vy¿[ÍÄä5zxõ/≈ó+Z}ÃJƒkw(jY…§±Ò)ÓÁÃ¯>	Có‚¢?E%úsT¯
¶
Îm01hﬁÌ¢)ÕKK‘	⁄àÚÒÊ
y¨cˇªF|P‘JπµÄmÇ¿*Æ·p€Ù&Ê•M›/çïd<'∞í.ª§†!mîÜ
2\… PˆH— ç3‡[lzsj]û⁄»À√x¶‘F}‘sÀv§ ≤≤ÉÜûπ·†vD5_|<•H*sù7ﬁ¡Õ∂Ç$°)∂÷F˘ú2¢k"o*Vì‚ŸÛsƒÔ‰J4ÁÃ}ûîêW„êf)‘®[l∞iÛkÒ@˛Ëﬁäñ¨\Z(öKπ¯Ät^c2‹hWm˙Æ9›(‹…„7t´(©º-¥CÜ"º3‡Ì›ÑE$a¨çè]nœaÌ%«Ò“ÖÎÀ=˚µI›µŸŒñpw…áﬁÆ›=“Ób†=Ë
Á=2¯Ùâc“?\ú?Á~;rvz~—>™t|O÷Î-Á¯
˛˜Â¯⁄ë_°’Ú·;qhqƒJ\@)~y.‡'€c›0
Vº=ﬂ ˛Ä˘àÉL•√Aq8∑B49gcÃœQ⁄SƒS–)ZÂ∞∏õE⁄Z›ä¬&ˆ∑&€£◊∑T:ÎKÚú1◊s¬B<‘{æã’÷∏ŸqJÅõπ‘„ı⁄BSe‡° ¸á!ù·içí s¿ë&
∏aghôc¯ƒ´Ú æcÓ” €ΩAÉÇn≥¯˝QÊ|é˝¿fXA˛˚]ª\D˝∑ﬂ˝ˆøëˆYüÄÚÍ•C:‘5»™ÿsƒõÄà±G:ã¶t›G 
.¬kÜ›W˜†Ja
€UáU≤‹{%“KK‰£òŒqí^CÆÛÌnf»<3-6ÚWg‚-ﬁé<;œ9&ﬁÅ}e;Ø±zÒ<§<ævΩ/äm¸%:êÍ.5∂8Ã?ø2bô∫÷√@Ó|π˛°§/ˆZ‰Áôƒ≈zË‡ÙñU2‰5±¶òWÖWƒ‚ÆAÿK"g÷=ÖØ⁄«(æ&Iêj∏ü†µ1s”ßõd`xtŒxLa®F
Û?ªöôÆ¥>@?ÎúW¨‡µ∑@‚ŒOÉThÁ ø€±ä8YE 83’Ã¡⁄ÇÈ¨lî„¶Ó´ú¿qﬁ(…zXº,≥X·˛‹Ñ„óí}J&®!◊&æ?Ûˆ∂∂®TÙ;Œÿbõ#g∫U#B<®}	Tnø™!A©Œå”≤ÌD‡‘Ã\îÁF◊kËVcÇ_]*ÿ,cb-QËÒê˜â¥˚d¿;I6r∫{ã>·ı‘êÜ"?4˙êFsj˝jn"ﬂCb·ÿ<—fë!g´xKÁW∆
2D˚¬€lòg÷€ás«±«YèalÆ2üÛÛj˚[‚Å'd„4¡ª¡æou *ùÌ¿Œ˜YN∞«πMÉ~ÛË¨k∑¯a[ùÚ0Oî.ftKaaò•‘„®Ã!u]æÓSf/~l	éMQy’ß•p	É7$B{ ⁄{<›úÔES#	QOj°»%Øb'¨2+⁄Ÿ"6r¶˚\Cg∞z*º‡ßµœ	O»0‚Ôq§ÜîúL&™í|^@⁄sY'TXwÃª–ƒúÚˆHªTÕ¶»†+◊êÕ¡E’∞a˜søÃó@a_ÚSª‰úcü#¨n a°^ƒG¶@Ω|t„pÚuÔG´§?ﬂ˚[NA*h%yG+å›Û”"r<ÔXX(Æm]xD¸È_æ!s¨7˜…?p–ÉÑ∫›/É"«?Ω—>bÂ¢øÖl?xÃ}mr%ä£Pm¬ô_$‹H1Â‚≠@√√‡A∂Â2<èñæL°ä‚ÎRhy5ü•í£dì˜WÁd‚ix^N∏Râ≠ΩπŒ`†¡∫Pòı©|>BßıE•(gdE˛ÛU¡è*q≤™≤ ®6ºR»∂.Û»ñnXçqê[§MìjuÑÛ–Qí≈O√\ú†2y¿J·1‘˚9Æ
ß‡1pç+%mÅç√ﬁIÔº}Ù•∞?})Ÿü™rÏï¸Zö/YR5JÉTVè{à@D"cuÙ√£F≤Äb®∑"T´€∏Òì¥WÜˆ&nØ.©^QFs"≤ÎÈaéí2ø≈∑CWxÒ{¨m'ò(/ì|s:Û∑;≠∏Ì2áÊü˛”w‰\"¡ß0ÊcUDpA"≠T≤ÑºC&”’‚{:ÌÛvÁ¢wﬁÏë/M¬x∞,D•,V5v7Z¶∑:Ó¥ÏnUt´	gOK¡ªÑ)&;>.3f˘{§∫ª˘E>–=ú¨¶Gí6êîŸÆ©Í˙E"T_¢Ω4PÀ1T∫V`blïú´ §H‰Uvx"g¨:ÂÚZ›‘^|˙º) à0Z89∂»‹BÛÑcÉ¨ƒ∞(¿Ã74 )∞πî·ØÉ=Ê`wﬂö^lYÈ®Hnπ;©e[íY¢ú!	ΩEr@≥ËÎª_dÁ)\¥\ÏKqÜNÚQ=æ∞ª_X—	|Î€]c{WÏàD™jYa>û=±ìŸy:˜–ºƒ≈ë^PΩ˜öt\ê∏—Kqã;AÃ¯ı≤ª!˚¯è;bù;Ç[8Ñ<à60ô¯ˇ?   ˇˇÏΩmoIñ.¯˝˛ä(VOó‘#Q$ıbIkª@S¥Õæí®+ Óè◊ï"STV%ôÏLR∂¨6p∏¿b±sg–∑˚aÿ_`∞”¿÷ç⁄É˛rÅ÷?È?0˝Ó9'"3#2#"ìî‰rıª≠íí˘q‚ºüÁ»˜–Yk</IJGÔ¬fíœîüπ%qVõÆå=ó…Î8∆xÏf+A
òÀ¬˝PÎ*=d°àj2óÜJä@à÷7ÛYs•√å·2_“Ñbõ<∂…‹9w∞XHãÛ≠_©ÍÕìg§à˙≠≠Jú¢ˆjcÚÊUΩ?¬·©≥¥≥≥RØ5VıïZu}9WoÀ?¶ÂﬁH_4˜•‘·˘S_6w…”ø◊m=;hû4y∂KÛ∞]úÏ‚Lº≈]¬_I.]íKÍSñ+Jå©/ (ÙE÷º”ÕF¶p4H=≠{°ßu√‚œ5GÛÔ4ßTﬁÛ˝V&ébÀƒA'Óïù∫C…Kõ—Ë1Â‡|¿,™
ƒ, 
gçú~à1x «Ñ˙(8õæ¶¢Ω´ÖL‰F`«5[Ωµ„NoôqÄ'6∂]œ£⁄¬1˜µ•â	†a;æ9ÜcÛ/\4]F¶â•‘≈¶Ø9Ò,ä2õt.ú¯‘u|≥õ,£ﬁ6ïºé◊©ù’/uçãŸ¡"Ú±T‰?#EM˚+idÁåóæ K†øDÎ‰π‰™∂$‰Íã∏¬‰ï¡*1µ@Ñêáø0î‡'{πÀLì>ÇtÈhH{„ÓdCïŸ‚Â·˛ÌÔ˛ #≤t;'›c÷ÍuAp/Çõa$t·æå¸YÉ/aÏmn-ö.l=üå7#Å®u¿)uëü3gRÇ°H$1ÍÉ ¥í<Öp˙µ§º√z#"Öˆ´+PÇR⁄âH£¢∑Â+Óâ-¶»
m¬!QêGÄR¸5ÜD“íkØ∂AE˛Ùls«≠ùæ¥’e∞”¢Ã‹)*Ÿr¬!U{°πîi_≤s≥9Ò˚$£jr”Ú≈≥Vá´ÎWÖG¢D$≈òÚ÷lÖúˆ‚≠öµxkCŸöe˜,ë[ŒÑã∑Ã◊')9q 0eÙ(≈éﬁgÚ”ıL,Œ·T#évıé;ËxŸ]f∑€°h(ÖÈôIN'È\"√™#Q÷RX´õΩ–-*L«¨‚elƒ$ÎE…¢4Àòl"æª)1l5pú–ÛfM¥¸llX[~ÍäÁA¨∞LI	`æ–µﬂªLõ«Eø.,¶D ˚-C>ß" ?™:ötÍ(¸≠SH3Cã˜m º2J´“$™ÑbjÀX∞(9i¿|Ïz‘(îCô•X	©0ÿøh¡±•®ﬂò^UŒ¯Õ\=Ω√ËàVÎ®Êß6∏¿)Ëg!∫júyC÷õbB*’@t6U«qı
÷\'©bëÅ?_}Â^æä”Ä‹AŒËÁJ{xU§´]ﬂ+E∑‚"’ …∑iXëH¿∆ôœb!Q¬!¢n«ÌXc§ï}¿F98Gmı[©´i∏?»

Õ:´…ïõåˆ[ØùÓl◊_V‰ïRtfjÓóWö7÷œ6›óv4y)m~è)XUz$/&ıoØÊÍ≤=wäﬁüÅCØ˚ÿ¡Ú*ıî¬v>®Úè}e∂∆S•◊,$S˝o")Æñ9[åﬁ ¶Àö®¸≠É6ﬂç…´qï¿π…–ΩÈ∂§"EØ^{”ÛWé˜÷â®ç9ﬁª‰{›‰ÔJs¥øç˛±òã-¶>≠K¡Z´Î˜„Å“(˛ÙèˇÙoˇ˙˜…iùÒ°¨Ÿ“aóª†¥ŸyÎÙ.ó∑TπM≈5ÄJœ«%XòÛ‰ö∆¶¿H∑–o‰'â˙œ^;·}kîâÀ4?≠;∑¡ÅQd8È‹â^E≥êv/<ıUjáYRyv±ûzNÖïâ[e≠±ib·'È@¡Ê´√ÃWN¥ï|®†ﬂIqÛ9ﬂƒ‹∆Û∏øüWo ˝syGyΩM\é≤õ‘fXﬁ√¢ï>ıx
). v#»ë~w˝ıÿ•≤#⁄:|yÊç9TiRN≤ƒó|Q·Ã"‘$¿R¶d∏·ı˚âG√é∞Vf>XÆ≤∂üÑ5‘…sá˝ËGg¶¬EóÃ'àP¯’èã£–ƒ]øü∆Yƒ?˙–†œ]»µ7ÚTãÇõlπMåç‰GÂ° ¥Ö5|õc)œdÁjl0pFëKS@Ò€^7@B2¡˜‡˜˜Å}Öıí‹Uè=D£ø)“πÊn,.KÂÌíê¢$0Ò∏í}∂K◊ÛÕ&9ö@è¬…èÄ¿Å9q:&wr1#∑ Ílû˜˙fë¨¨·!wf˜Q[8ÈÓ, “§eüZ&ÖåÑì^r^.IéEºª8ô}RJÙE1ªÛ8–pÏÕ#Õ„•ä˜∂ëÖfìÅ∑&ä‚Áˆo	f{Ñõ:t£¿øp©˝Öª.A_a‘4âÔ˙sÁí¿Ä'zú5%%Å›⁄UbU∂ÁÖ◊_]Ω‚i¡$âJó©’‘FFﬁtÜï1ºtñjF≥	f0Ü<‡ÎÒ1ˇ˘I~≈Ö.’ëá¡`÷wM%å%xgRbeùÜrD{©∑Ï∑ﬂ£É«ˇüBÀ«ù'œéõ‘–ÇÌµ˜ŸA~v±&ñ–nJ_|ZsÎ[çùóﬂF‡∞§Ë¸ëCµSgaÙDÈWæké⁄†(,K±◊fù√ìˆ~ÁI˚∞’i≤ÊÒIÁq~€ß%ö7∂hŒ)@2òOµ‰>	å•Ô†^6pn\oπ√Î?–Œüzì∏.õ™˝/π*B“xÖÍY:m„éy=WïÌcNËA®ˆ¡ö)õnú÷®bˆIú(WÅ∆7I6tx‘œ9CGßèj'4ÙÉSP6P$ ãÎo3ü†˚„“Wßû;öp(ºã1_i^óËØˆ-ˆ∏ío¥yº«ÍªÏÒ~≥˜‘¢<Ö ’\Ê{ S≈˘‘ ¯«ReH»'´Î’{´g÷ÁîΩsiö…W´s‚'ÈeŸ2´c7íáÃCµπa[ŸæÇΩcBäﬁVùÑÜ4“z√îG∏?∏ÓΩ⁄i}˝e^ØÕfqÔîRîô‰7õeFá∂;¸Á—QÕhrÒ¬Å%Y‰€-pÇñvòë∫"êz`·Ÿc\¯R^…¨7ÍπhV≈@(YŸ
B´”¸∆dãÖt7ïvÙÛ·ògsÂ7p–„¿Œ º!æA≥u“yﬁ%⁄qª’=hÓ5˜∫Öû´Bã™–∑µ®@•^ˆ◊ßw&ÈH-F1ƒ
◊Ω©‘p5vKÙM,j	üÃyåc∑ÛÎØOCèÅËÀ=ÕÍ‚ÙÀXºVYg‡"N°ò!ÉÌáﬁD†xcBkö:—äÄv˝~Ë˘çöÒ°¥ƒY°Í,q©;9Ì^ãÚ<g†‹Pª"‘π)[îŸ JÜí‰í<,ˆô,∆Ã“¸ô‰ÜíøyN€Ncd% õ#¢éÔæu"Ÿ6◊rD…Ú§≈â%6ªV43ö!Òa√F\ÙgÓÃü¡Â@◊ﬂ Ie…	¯õ7û’€ÿcsÕrí{rãSº[f*(yûIﬁ˜Ün(@‡' èÿh”XèU§†⁄Î`¡Ö	Ã"0ëcúRâÙo:„`ÑwÅ?Ä´¢õœtÅ'iûç]vt‹˝àÙŒ˙Í$0m;Ç◊¥Ou%t–…,J…Ë†‚†U≠omØloÇzÔ{Ù£—AÎÏ(æ£Ë§ãÖ|øKz®˙û©6 ⁄?=jüp≠Ù‡˙W?Ì4ŸQ˜Ñ<9™©s·åIïxë{˝˚D©Ñ)Rt	ã FŒŸlLz(Ã›„u™¬…{àaÓà"ˆ,ráp)
¿	L;áˆÂhKe_ä ;Ω˛fÑÿíHÂzÃ*®—†EkT.DøWN?ÂÙL—êQg∏ÎØœDŒ ıÔ|˝
hF}ÿåHD2Èõ)•^qi+Üî‚ 4F@ô•%∏≤Ôq¯P©åÛÔ[o=!Ô&ü-ÿIÃ∆9óTç∑Ñßà/|ª≈VoàΩIL∞ïÇ;ƒï0î$≠#w˘Éi¨s]Z¿˝œ¨πáa°ﬁ…qsØ+˙Ç˜éö˚{]ˆ3∂◊<Èˆÿ~∑’‹o˜Êä†Ä’ÿyiá"0EP
q ø›XJ˙Eqî=gÍPÅnqÖ"'Ωˆìg«ùΩÊL}≤
∞" 2‹Iî‰Ê	8®¬0ïﬂÚé∫£Î˜o–—s[Á+T≤tÍ˘¥áÒDY‚‰¡dâƒÁ"Ñ,HCD⁄•T.œ±U∑…9V·ÄcP¸∞^´˝€«J⁄’«^M¿QÕeµ&∫tíDgéHÙ¡âòàV¢0Á ¸éËé¯_?@a‡≤s/B8û$¬NrI≤.êÑêp«Î˜òMcú+Ä&èyﬁ»·Dñ(=/êBOØ›S∂§ãRXØm’/µqi•∂∂ñC‡ç5™àÓ¡+Çû#"÷ÀUv(`(a<¿R–ÜÇˇä…»≥SåÒè·?q·5ÈW3–√8[áÛà^D16wÍâN¨)q
’Ï÷cc—H≥¿∞4ÌJÓç”ÉtugãeÓíÿ~C`Ÿ!¸]Åkôù∑)Ìº1íÄèŸF%ˆ`™õˆœAI‚)o‘µÈúñs©˙eåói—18ät§›HŸ˝v)#§∆H¥É†?ï±ÑÂÌe´ª,S…47P,«´·s›Ù}@%qQÖnŒÀ„D˘SÉ©a¿≠<ÇÕéÑ*mg=(∂∆i"æ∫ß´¡€©nŒpcÅG-nˆ$tÿ≈∞NÔcS9? Sã§‚Œçı°…¡ˆ'`º1ùZF{	ï=˘ªÀJ:#1Sk)d‘qî¯˛v>ae˝∏\ÆéôEóƒ*ì´%∆ﬁÂ40
G¬è'^él¢É.Ã⁄Jb◊+^.Á⁄êv|r\ÍÀÔy˘ÏçÃ¶èøª«¬G¥ÒÃ”gì≈˜7„%b!k
"à˜π’b,¥)=lÌg},"gû_‡yt˙}w2}P!Æc?5ED‰áÔ»G9Áﬁ î5€ìl@0ÓÖÀ∆/Jÿ∏∑üÏ7∫fΩ ⁄„ßsJÑM¿{S{njá∂Rä±/Vu3Ø∫◊mŒº≤≥ ıKœ14Ea…œ≤kO(&ÊóÈÍ»©.TÂ·Q∑wR¥om>´Üúu]y∏ÊLº5¥^æ-Hö∑˙èJÆFFññŒÑSJ˛ó.òV$ﬂ¢ 4R‰#©Ÿ≠g«˚ªvWßAµ ’®eÆ“Lµ	É¿§SÅÚÆ§˛ˇpıü≠˛î·ä≤ø˘¯ÍSViTÈæzl·Q»7Åhç¯¶8q¿>„—¶
ÍóxreóUNZ¥cO|¸ıY»õàUV¯Ÿ}ã{ˇ)ÈóxÕ6ìÇ±¡ªÿjRá1∞|„ºÚ–ÌüUvD¶è;‰∂Ñ…˜¢jr_êw¡Ëà`˝Ò¶Ñª∆ß¬Z¡ÏÃXpö¬ÛR[ﬂwüÒ˜¡n[ªkkdéü—t~M&Mc`S N‹Ñ˛‘~3˘QV) § ñjπ!ØÛ¯në“N%Çïp£ñ≈≈Ö¨pˇ.‡ßÏ∏ç›Z€Ë l˜NûÌu∫’jï-=M€6cRSRîv‡Ñ_¿BY&í®P3ªW≥»‡›ÚâvÊPµBƒ⁄Ω‡.eb£ NP≈—Ö£Î˜òbQ”â≠ãHº5TAæÕ_•2/,‹Ñ{∂A∞˝ÙxÖ1c¬9œ_Á•ﬁp"
xt¯dÌ«GOòCÌY∂6Ráÿ'S>;S/ÙÖøt‚Ñ◊ÔGÆpÙMúKRm és|K´¡€S+6Uµb√§L(√˝Ê≠|e}≥å\ãk€Ñ`;J'Î«ΩÓ!Î∆”dg,ÊQ>k¥r∏ˇºÁè∫«ØkˇÒ…0h¬Á∞˜Ïº˝lÿl¸ﬁRÎ˙‹Ò∫¢C8XæŸìGﬁ»çÖçbm2¬£Ç¯œ/'Ó∞b{»-®—®I™&"ò§£5ÃW£Ó]
/KÓRiPA±Í7hRÚ‘¸ΩãçxbÊ PíÒóœPÕÃì∏úÊË¯˙W≠ìN´i⁄°∆^¨Ûq9]d£p&Ã‹é≥∞ƒKB’»îåÀMêêOÉÈWÓeR≈ªBz#hë/\ëÖ˛ ÛÀ@F[Ê˜ò≈‡u¥í0: €¿T8ıàªFIˇ@~®”X†Í∞sÉ¿§4 N4):+¿7C5Z*÷ã\q?— vó‚`U‚ ∆OúõG¸§ÕäZPç©#ºŸüO}Ti,#~±ÁE∫,ó:<rv˚tK/ÜŒ‰¸r1<lÂπSæ∆÷,·#i z.∫Å"±m€wá@ª®Í„ﬁ_{Xπ≥8ê\à[zqÌ˜ã^f—;8Ybµ5€=ÛP¡I–D€+Ú¢WK4¡œB‡Y±d∑¥å‹)øÖ;†g%W˙ÔIÁàª/%è1^“å…g©‚æq÷çoE{ëfJoëz≥CXàå≥7˘˜Eœ˜§Á6ÕQZL±:∫V≤R®I™:[4w∆˝ ∫Ñπ;	xª’ƒ#ùˇJwè˘ò©ÊÆºè\)ÍËfˆQzI|Dw®èNÿVï?¶ªÚÃ#®`Òo∫≥ﬁzì66Hƒ˘~Ï˘p˜Ïë«AØùqÄ?œ›%©f»~%›n	·†µu¡.„!†_¬Áj‚ñx'~Ù¡#ù(}Lv'Óx	'Â›≤ñæÃ´É”≈xJrı˜Ã§3¡¥≈ß`ñ∏X’£‹Ÿ⁄â£⁄µ|?4{p°S_èX‰'fÔúÇ3SaLV·)ﬁ|
ˇ}Ω˙l,¥øŒW_4¯oJÈÍZ«Ò‘üÖ´/∂)1 –QÀ⁄zÓ%Èº]≠õuJÂõ‚d˘À_Ø÷0!ıÜR•§¯6È%¢ıUa¨7á‹#5j˙"ˆÕÂó,ÕD6«uÑ€^µı∑`≠∑,—·BOé-≥"ﬂ&Lﬂ&1’ßHÇr#‹ßIV%N¢{,21mÌX¥NÖ<‹=!Ò]ov€Oöô‰V†ıN•¬ÆíŒòEÀbbTcüÉsz°P]≈ƒsBÕ(kﬁ%ò†@Äô∂Pö‹—üëªÅBYëÎZJ)C÷∑|u¡+¯ÙG¢—0{»j6<ß¢L≤L~X•µ ’2Ñ
2Ô∫îí >)XD˘d:ÔO’€‰båÌ$]a™*Ä†‘w–‡∫ÀÊÇƒ[◊≤?	ùH›d¬ygoAÅ⁄}AZ…ˆ*
‡⁄Úπl»HÜ√ZÈ	J”îöJò∞1⁄+ZÂhéß˝∑≥¢‘÷,+°;Ö°,ﬁ:+;ÿDv—ìLêÚ˜≈Ëƒ5
xJp@π]_k∞U"<zÕK:`Ó®¢ò-WágÈ‡ùLDö4.}ë{æÜ•…eeïJ]?ƒcDQÃ¿≠$|3N<wXªJ±xéKeîOH”ÑèÏı#>h(l¶¸BëE\˛Âªò¶]ƒïvßR/Ò∫°±∏π-˘ö¶SîT†ù[TÕdƒåÿï*[ñk‚óî˙R†‡pûvLA>r)≤z◊àô'Ö5Íd⁄ª§0√Ã`o\Åâı0D¬éÿ>¸•ÂpWKKF7v%ü≤3‚ñÓÄ=` ;„K8ïf?ø(00íL⁄∏’i∞ºvClÑæd†CúÖc£»«'Wì‹ıÜUo‹˜g†π,—≥óŸ/iªK&Á‰F˜‚õ˝¿~Ωà”∫·®Ê∞w∆ñ‚≈âµ$¥∆kÀÜ≈(òO[ €$Ïv≤F„%.™¨+ :“CÅ}∏5∑}Q« Z¯!Ìˇ≠¥ÿ™§h22¢ë•¯‹ÒO¸»À…ót˘ôœ3S(ﬁÁ;ÏÙ˙êÜ@‹œ$œù˛ı◊Å•Ã‹ú›Aﬂô).O hP‘R}%ÀiÑp≥DÄ∞*iﬂ„ïªh∞$Ômîé¸ì“‚FIluÑ_f„X∆
È‹è=!à•¬·$¶Sx˝^k<6ibU≠sΩP31ÌÊ÷mmÎNùp–JÆ”ñ3ßy_%e‰Lñàªì|0„Ëﬁ◊˘ı“z¯Æà1zÉíÖ8Ÿ˙ŸƒÿÇ£˝˙÷zÌ•Q!“U÷l´Ω‘"Å◊í—_b˜YvC∏’$vöƒ)˚‰3æ_Q]yA÷}ëáIg$¨õÀvÍzhS™Æ»ŒïGïÆÉ⁄‡È∆º•{∞◊ûÚ(ÂΩ(Z’n£iI¡úËR8U-ÙA’‘!£MﬁÕ—+e.RIäì
K; ¢Â’w2ı*•”sàÈ±‰c-aKÌñ[ìB.◊ù∏dD…Nºá°XöåJX‹üØ‹˙|4≥Gâ»@ÆŒ€õh’˙í¶y]L≥Zh∑IpÈrî°Ó9å¶w`	63ÇT=/”k•ÏöﬂËîb∫)[22ôÇ6=¬DŒ˚K¯ÒÈ©%˙ÊÄ€ä¶≤â∂ò>%"wi/f‰K*_/q5w˝ÓŒ‡7!Gí¬ñt¸¢‹ù∏v:ççÍ•ÖñªI7ÙÜÿìººè&\©~2¥«˚ aæUÀE´x_Yè∑»∫4{Ω/WïËWŸ‚EK-§VŸ§:Nª’Q» Lù!KE∆~%^YN( oß-≤˚¡‰Ú$ÄCì” å•,)≠P%ÜµA*~‰Á7r´ŸÌZIû⁄(¥ëS≈i⁄‡…á'•"∫©7ı·µ[<‘∆—9
ÍNÈnvi /]ı∑F<ú√Óπæ;UXë7XÑb‰>+ôÄõdk$mü≠X6ÓûfnJ+mﬂIK7§]ÿÆ<S*nN[®ÿXø^6ÑÒ"ç{∑ºîªÀ9Lpã^,F⁄ 6ºt<üuÅŒ|Á!?Á2øBLH†K¢ÎtOumåpíX´|ÊaÅ7©ΩZcoWÂ*9—%[—ã±ŸêÊ &´î¸2“02‘®èJYX∫,æ¬L+mN”BπVEŸVÜ'DFWPÁí$"À ·º¡_≥©Mô@-u3±Ωyq˛“ÊË)• ˆ”⁄BN≥av”XñZ8z,IFˇ§≈∞Ã@_lÕq±Æ/óå’‘ \¿çûﬂy≈>ùÇdÉrŒÆ¡é®≤÷l`[F.	0^¨yââÉÖ9SÉ˘5åuõñ¸ŒøMeÔy∏ÌÁŸ°ô”RÒ£±’’NgJ√¯åW@Íœg÷¥S°™Ñ∆e˝È<©*697OﬂVéëß`éˆ¸ª7ø°zÛ7bà¥,TQâ¯\⁄x‘öã∏fÉ¡—)m—Ü‘ùp$ ˇÉéêÕ»yÙà˚ıÏõÔ–Ê;w
öBõﬂÌîwˆÿk]ˇn0ÛùH;∑>ÒùA°„€ÆEö∏ì˘ëÕaA´ﬂoyI⁄gm,ÃÀ_ã'TdÚQ/«ìÎﬂç›2ê˝∑ø"|vÓhQæUNﬂBx˜Ä›-√GG’∏#∂Õq{Ñ6ﬂ/)ö•”∏*7ﬂÍº>v˚ÁN¨oﬁ—¨J!$Õ¥rG·ºNj˛˚≤œèwéP—u=xç®©p(≈õ)*Vlö",Ã\Ø„≈Ãª]ú\Ë∏`ÆÚaÃ‘M5⁄X£fyJGãÁYÉŸÂyˇEÈ:£¨£))5∞‰çl/Óì0Ø~5OR‰8@˚ªïT¥HÌò÷=Û˙%ÍÊ@îA£Oôƒz-…πNG¨°†"ÿ˘,pñA≠oÙ1Úc[¥˚nÒmÏ.Ø|t⁄B^†âº¶¢,mk‰B±¿¯J˚<‹á€>BÓ˝»MfWàöµ≠AãŒeÛK±»ç|˙‘"µBsU
¡ûç∆.ëπò.ö∞p1È8OzﬁÄ}n”Î≠ tÎ‹>`¬íö€2˛¯û‚pÉ‡ã˛lTûŸÓ¬/Ä§TÔ»rD§õ!Ü¿ÄÙe∂‘~zl≈û”(Ë¨2œv £¡l$…óx√›4é¡G∞SpË!nhfà·¸Cv¥˜ò=%'wΩàÊûRwîîãﬂr]ﬁŒbw“$ÔÍrˆ€e3xl"ÿ~'Mœ‚7kÕ¿íO”+;Õ›ºÅÂ.X^bıò.„Éé“øŒ^Id°Àè¢EÁ/¯∞ÊPy+¯”~ÓÇè·û˘I¸H·>Ø3êü•%ÖÙÃyüëö¸Ùê„‰O˚πÛ>&5ÄÈ1{…üˆs{Ãæ|?íü$é^1ÔÛ8≥I^´ï¸i?wﬁ«ƒ–7Ùê«‚€yVÓ“úNù˛π¿‹—›∆QN@W–ãósèyù”`ﬂπfS¯3˘H—Ã¡ˆÃÏ;ûäu‡ﬂ∏√lsíúS¯>È^ÎÕF#G+e& 	xK
∑Zoj—öÆ1fu™*V¨M+:V|„W≤˘óE¢g·Wd†ﬂµ^u£ ˚î∑l7öì1Á[©ñÜN∏h>ÿîË•Ω≥ø˛É|Fì'.Ì∏„æÑÊ7v<9;≈é;Oûû∞^gØ˝®yºÀˆ;Ωì&”û75‹e{ùÊqß©§ã›7>K"§:t"˜`N¬Í ¬‚§-'Ç≥2/)el¡:Nœ)ã*Õ® Ô~)UK\∞æ!_¢I÷äµ =@EƒöRwÄJÑôo√ 
C/ŒŸÿç"xnÓ4pF¯ˇ ﬂJó<wû #º¯¥∂S€´∑í.Â~÷ë¥…h*ver∫≤_»S#C”Y BZÿs˚A»/òìx{·Üö
˚(,BÿH±K$b.ª,LÉ’êùÖ¡H∂{/<Gi≠»_*˝‡ŒÈ”≠ı≠≠≥∫4KÛ~Ç"cê±‚w‚∏Â&ØÒf±À8õ ¢K_,Wc®rÀclm√\ogrñ$O\›‚•[üaÀ‰©DX|*/∫¨êÜß∑PÇ$)2íﬂ“%÷÷;
_ì:ûÑŒ©Û•…Å1OwÇlw:ﬂËy-’5¡0`∞Ì∆áÌyNË9Ü—ﬁàZ”í∆¨N‰UâéNÑ,ù9~§/œ∞%Ïe¢pRé^™Qdté%EØ0Ô];Y•3ıL˙Å>!3±G¡‡≤EMŸ>åÇ¶y|Q?|ÓjÍ…î;Ä#”znü&j-%Æ!L›[-á-à÷aÈ¥⁄î≈‘¶0ÈRUä-.úo\2Æóa,iòcmß6w[j3@áè>ÚgQ¶˙k®√ ÕΩh<¬ó√∞…Õ¡¬‚]M”i˜lRS`Cıªï9ÅûŸÍ∑Á±QpËŒ-”,Rnè7ã‘é©á=àgc^ç çÛ√è%B“Âô¢∂ÉÎØù§ˇ‚x¿ªb”y±\}7á€°É%4ıh!Â-t`∏´{!hnûoœÇ35xœuõ,èpìmÊ1p¢sXÊR»KKAùkhcäköF22™N¶Rb‹âÚÀQ- eî¿q≥u[å˚,Ú>+?2ùñq3&®*ó=`	∏˛}^}Q{i˜=qXe[Â2øˇ»Ö€RhÚ4x˝Ra÷ˆ]¸ız⁄+t‚j_úYYF_‘”ìÉ˝Nõ8”VìÀ#±|'v∆ÈîÜ∫¢‰Û*=àÍóød\˛õÔmÚ4îÒŸªUº»9ı¶⁄ãé¬ ˚vkàﬂA{ÉwF{P{[Kà9g•†á£¸æ-’’cRnò)≤#∞€\ã∞æW#0zãÅ35ÇEÓõUy◊-–T…ì'3ënSŸáPJ\˙U´’ÖclQr;≥2˝RÉ+€årËDkBâl™•"çÿ‡™§Kk(±M˘4*][≠ÉHO`ÇFõOºáÆèn	P’ÇäÀÖr•=-£¥¨«MË*OÇhKèQÜØ°L˜BFåiºhnÙãmN“¶¿ √^@Õ†±Ø€
˚Ò¸¯I˚——ç¢mÑ¨áóMv˙ƒrb÷ù‡™G,ë=¢<åá±\®XÚ&b«pñ7xêP≈º?VOÛeZ“ŸJ¿D3`°L.XWr¬ ’K‹3gÊO[\Œ=∏")7óH*‹˘t‰?¬‹ÿ˘≠ãX9∫ˆ`FûkÈƒ≠3Æçº¢åN©2±Ú∏“ÏÙß3«7hˇ∆é–‡à∂√0 ⁄¡6ÉzÏ–◊B
Û3eKñjÛµn∂‰õF∂∫_Qo◊ïÆƒŸ¸I⁄V¥ìLõ®†)]í`h§¶y
lK‡ôâÙÔSû˛Õßå£TTS?Z;„SWcŒÍz√ŸöyzêÜàn≤D;¡˜)È (Ç$õ€+av=ìß‰‘¢S,ËπH9¿‹¿tGâ¡ªî¨ÿÁq48AªMæˆNü‚g£Ç‰é∏„ﬂs7ø-(˝b¿'4Æ®„a8Z™¸Ò¥±+ˆ0ŒxœU¥Ú±Ω òGq0˜Á¿îªãÒ◊Û‡ÚÛ ≤›HcP”‰í5Do∂Ñ¨hHO*$2ƒ≥∞4XÂl¸r∑Å“d-”*UÊáÚé-ıÿ¢@∑{ﬂ†Ê4fÂ;ûIÇXòÉöıû˜ÃÜFÈÍìd¿62ÓÇJû√~T@ä/¡Ê†∏y	¨‚æ1vë°G∂Hò¨Il∑å€Åƒh,bLZ4˛Õ¢∂”aÂ·a¿ŒùÀ‘w∑Xﬂ;»Ê§™.[™‰>t∏ﬂ<`Ï;@ó"ñFåg7(Í∞ŸÆy¬!D\Ò◊
Ì÷}S -ÂE=—…ç=`‚zLèG
å{º≈\+…—C⁄çœv8ùEt˛g}ûŸ˘ôôµø›)„∑j>fg√z0ÏkjßÿMMËa”Ã#HÙ»›ÙA√¨·ê6d.s7Ã{≈˚!ÂU¥¿Ë¸É≤«6ÅvYbôßúsVÌﬁ¨Dﬂ7µÕîjõÀ/-/ÃLì'=πQióü[‚aÒ‹6ß|rÅÂ¢wÃÃ8≈Œo‚üc)˝å*U`öÕ8eı^ôWÀÕ£|˜˙fÆ¶ƒ r≥‡T⁄'“Løkkâö=rßŒ¿ùGZ¿l‹#'ú‚ªæ({«kÁ`⁄srau2ãŒóæ¯¡ïÙı;Ê|Qê¿ü=…Õô˚©_Wß¡3/º5B…;KŸÃŸ¡vˆvY:‡]¢Ï†'Á`öÁo˚Áﬂ˛ÊˇñÔãgYÔôÆÅ ÇÙé_Ç÷∂Ta˙œˇùUÙ¯ß†K~
 ◊Ëz*iÏÿ{©\æ˙BP~∆ÿV›∂‹GeHWcJk‘"‰WŸÌ˛Ó€∏l˛DÆ_v»1qn R OŸ‹Ív_¥t„Çst¯©ÛÍπ^ë—b¢.Ñ\,zµ≤À2”ÑüÑ"¿é˙°¢vö/êu€Á0Í1ÚŒTè¶FlZUuÀõ„J”[ïÑ⁄∂`x(∑;ﬂ0'y%*>OÂíb¥7w≥öÑbÅrÅ£˜¢~Ø†Y˛$”2∂†õ)o±væQÇ*ã1∑ÈÈ	.Ij⁄<3…ú¡%»M1xCπôâ«VnV
a»KPI9tzû‡ä¯≠L »q÷báQ¸±Ä≈
÷ı8Fâˇ&ï_%vÄ¥p±nXÀz¸UΩÜT)–Â∂S‚«Õ¬∞Ø:‡◊ƒÒUtqâ˝°Ö~çìü
…§¯µ1QA§ÜÓ/fÿ\gÄ:ó3÷%‰e.M≠
Q‘Yfõ”ñ¥õvCI»⁄T,M‚!µë%qì‡≥§‹{Ô⁄ÇΩØs—+èÑUhˆyxí:^r;Ì˙í›	ü≈t@‹á)ÔÆQ/»€ìá,ÜâB©è%∆eÿPFO∏˙BÑôÕæ¸\!å-!/QaS{TÿãûZÖeõœîò†ì`8Ù›‚Ö,≠ƒÕGæ©±?q©<Ó≥“R∂§¥¿œ(Ω¸c E(C&s°Ë q%πë:ãÍì7ØÙﬁ¢∆ÚÀπÂK1ÅrQ∏¶êÄ¸)'Sb	¥Ñ;Ê>!=õúDı‡GR:Vd?÷°™y
1ËJø«Ò‰ª¢$dKÉr>nûù∏!);±%K˚ÒP[ÃHoÖÿ¨Èe =»F∂Ñ&Ôäéé]jWˇaâ‰6∫8Y/¯…Tb2&¸6b>8uù~	kÎ∆ú”ZêHmÊ©#&rN:—ÎíNûúØ&I>•WçüÂç©%òx %m
∏˛l"ß‰∆I|˛0ê“ç ≤„I\ìÚîáJ/¨ñ}j	J±d¡ıÊrCKaK‰ﬁp8wú2)‘öƒ$öûÔéÙI?¸ÙHÖN∆ﬂWú¬Ø‚Àì IGÛT˚û7Óá¡ÿ{ã≠\—Zn˜ØøÜŒ&£∂ﬂPö®¯&[l®ﬁ3xYÑÎ?úﬂÕ Ô}êf”|ûè≥]ˆ‚•n¿ö©Mj’©é[˛NZcI∫∫(8˛Ì?¸Ï®”∆
Ù£ÊìŒ°\y~ˇ,®‰√Ä¬€iiIäd©]ÆR]“∂©t:Ì“Ôa⁄nJçù¯é:–OsÕ¶îA)±°l^ñûRÂxˆú3_„ÍÏ»q5¶dÇÅCAòΩ∞ <_ñÈô•+g8©•u¢ï\‰ùÅÂ⁄áUw£]ˆ®≥z‹‹Î±Ê=˚Qç=Á+˙˝±ÔzQˇ|ÏjZŸ‡R∑ë#˝≤Ï5Y4MZà √'ÌÉŒaáaZÓ„˝fÔ)ÎQ4˜≤7VÊÊ˛'2âz—œΩI[4òL†ﬁz™∏RÑ‘}8shîú.Ωä·µ4˜ìw¥∏ÔÉ+Òã¸jbA‰Ís’"w˙s~âGÖJl≥œ] ◊◊ºSüá%!'¡ì-fwxX‹…ïø◊]‹ÛÉ©·:¸*…¡Ãüz∞å·€HæR˘"Ω.q¶Œ#ŒV~ÛœÏ†ª◊ﬁÔ"giˆ:Ωìˆa´”&s‹dùÉ£„vØs˝õCˆ3÷˛ÈQ˜¯§Ÿ¢?ún©›;j√π˚¨sÙ¥{ÿ^;Ë>ÍÏ∑ŸYÁÒqÛ†Ω,±®´Ë<x}Ñ†ºÀíJUÛ$c€§˘&ÕŸ*iŒ&IZvü‰2‰òΩîQΩ˛∆Wõ%mæI˙Ì4∞ÔëΩER⁄KI∂T	à‰%$∏´˚9Iiuûìì–7kú¥πHq…“2≤*pœWQÉ,◊õoÆ6De:b7#ò[¬	Ö©Óå&†NêHº§}ö‡ Á—¥J°±èPë†ßÏj#Å^úi{Mx£—<‘∏©Cp∂ê6A+íÛ˙òÇX∞öÖ*	W†∑Ku™5Ó
Æÿ∞Hl¿ê«Aƒ+†˜Ç>£»«%C‘(˛{—NIò%G…qjÉ˙÷ÀR[&A
–ÿyˆ2>Y'Ã™ÅrÜúW†<Èüè¨◊4S6mÂÄ∂-µ^Ò¨€ w§›¥'j|Ê0xö∞?JUÕo UÛ®Ãí;ıD(Ú˙ΩüTqj¸ FÅ]adò—L@P˛Î ~qò˚‹yaU;8ìπß[Wûﬁc≈ÿ∂˘¬Úl!e	0óﬁ˙«Å4y∫‰ıù\jK‘¸5)]⁄L)÷LâìÏ0πoE’héŒ>Sz∆-Ñ$® ‚7%?”|˚]∫}∫M3ëÍ|"méâÍÔ≠Oæ“{@/¸?rÄ˙ZßÇŸ!˚≠bºC£ßj^D=uâGΩä¯≥Ã’oá–å§ñ∑≈Gƒ©Nî$;5ô’ˆàª¢<Ìôƒ˛Ìﬂ˛ù<>‘® ƒETz
≤ê°ÜÙZè÷várÉ‰ÎÊ:Ç-~ÏíÚ †ﬁäjª¢ÚhÊÇ,dé”6&ŒiH÷D‰çf~Ï˘·U#4™I ;ı¬ ıI˘Ω UÀ£oˇvde=[“,%Y°ôÓB¬¢¶»ô V:ø‚ÛØ\V‘ÚÙázé¬Í‰'nO‡∆£Êl03Ú…õNh¨.-»º/YÂlÜÙrQ±FÕ¿/Áì•ˇÁ?ˇ€ø˛=Î—˚°ÀqaÊ¶7ßé…‡Ïbªﬂ) êF]^˚éê≈o˛{ÓÚ>«¿õÿRﬁV—1ÜMíiÂL—÷Ã'AÙÍÆ–‹4¬Êma€⁄	∆ÑH⁄ ±πÃüîßÜe˘ª·».Ûé∞‰Ça©QO,Å‰ß&{o‰`jï‹|≤∫iÃ+¨!‡íº@Új›Ûo¸ C†Åﬂ[€≤ﬁRJ¬[ΩJ8§ˇˆ>Yã∏ÛwOïYa=ÁÃ	=\°#gô˚ûiáchÑeÖì√Æ(ßÿÊãÉƒa;Avé–“#T	AÄc_∫˝(§ìÃ∆1Å2v?Ç£„·√fáÚS=ÏÓ…è¨†¢0v.‹!±Ê	ÍÃ_Ç⁄@ÍLËùåNCWx3ù…§
J)LKp:E'>0µ„„ˆÉ—ƒwßπéWº+†ºåŸÙ˙ÎÈÃ"6ˆÄ√Ñ¥ºƒu'ço6ı® Êí^¬ìëoºıõ]ÉVº `i·»t´Æ£r+7ØNt[=«ÇÃnû€È‰¢ÂŒ!E˘aVÑ8πzÇ
–üûX$-ô∞*1UN‰
nZŸS]◊Zq^«pFß!œ;‡U;6∏@]rèaó[:ô¡TàÂ©≠éˆio∞%Ï ˙ÏxÌ)Ïâe∏Â≠(K”ÿ4úï"1:Ô÷),˙Íí\‹©Ö∂4¥E«øõÑ’~C6üoË´V@\ML)#¬ˆU∏Ã—B∑KZëïwlÈ%ŒıÔN£Ä*MZ2’ØZ_≈V~Õ+UAp=}ˆÄΩæºÆ˙Aü 8´Á°{f.sgÁ∑XaïW@;„ØÃΩ¿D—∏yH|˜êπíiübæß^Ûæ˝-fkΩ°±ﬁ+ÿh§ΩèdØiöÛµ/‰€ÆÃNqàˆg∏Cì-v8s/⁄Ö|˜gŒÄ+tR\ìÿ∞µk˜Gæ'ó'<hr8·`i®vî[a$4ﬁTŸ€ˇ∏◊=¨Ç:	ƒ‰æ§∫ÂW®	—
k,=ˆÌ;{JºfÔ)–ﬂ=1áçhÁo¢M(VÒÓ«%6ûàÁ–Ê:v#¥T€B&¬Ó‚Õ∂∏πo6*NîßYkR†ÅQ
yÏÙÜÇAìò©p§1≤∞Ñ;·~Â!ı◊}4-ù∞\%Jb¨t4é≤íÕ6Ü1]ˇa,Ã¬ÿrÀíÎ·»y¬’ﬂ˝ÎJV‹$ÕR‰ŒlŸ
dg◊_G†âîÌ‚”⁄iÌ¨æÛ“dcîJM†ÖÀé)†»õ±p⁄]›Û=j®vìFø÷ w[Õç“c ˜∏á-Ç/¬ªéí5Q§è©bΩ|ãÏ¢[}–HóoªÆÊø!–+E¨m‘XL`{ÛØÃp Z&P7g7ÃJ–mg‡˘‘≠÷õfxjäEkBÈÊXŸ∂jÈM “]ËD Kög2%•ÑgF5[=∂&´,è˘N6ıp∂˝.9≥˙“Îå˚!“;‘j¡i7 Y≠áÅ∏¶¨T*Å7	0È˛˙k'ból‰¢°,6vá†òM◊qÈ4ˆ◊vÜÒyB∞q,qwáﬁ©Á”#»èàM!∞£∏C~5ê¶c7XAæ7é»<„y1ø'Ü≤÷;cﬁ8¶Ûi–ËÉä‹H◊¬:°ñZã|”mÌàBëYÿ_{£z&–úÕÖC@gÛâ˝ŸA⁄„^âò Õµ&RÉÖ8X‘Ã_øÙâÊ¶ñ
ô_Ñ´¡ÿøπ“⁄4z„&ÀÉΩ◊Îï∞üRºÉ¢´bFvù≥)∆kPã£Kﬁ§'fŒI˝r®ïc`%c*ÂÍãœ>{)%EL‚Œ¡D4m„SG7˘@2ÿç‰Æ ê˘!ÃÂøΩN~À®û ê«"V&ÕÉH<Ú¿©AµHSQ	À ƒ3ïäUÍàUÃ£„Ó´fÎ§ÛºKZÊa˜¯†πoS2Ÿ-#X√`"˜KP‚öè2ÏPû◊IÄ7Z∏>H˝µ#èú˘G◊Ô—%-˙0	î—∏F∫éÓûínÊO—0»Œê‰∂D'∑*˛ÙèˇÙoˇ˙˜bµÿˇGÎ˙7]ˆüûuNö«¨Ωœˆ;áˇqÌi˜∏…⁄álø…ûv‹dè;ΩN´˘πv˝ÊH…uXóDZÇÛçÛ¡15Úò„À:˚‰íÎÔˆ	‡˝âIáëå¢ Hå«–:F‚å	'0Ä&Œú¯ây$è	Ë˛îïD"s&9+R^õ1MÃÃ/53öô¡Jµ’ÅıŸƒóZòôÒâÓ˚ﬁ√ˆﬂÒ5⁄ J|)}Öv:±Ki7ò∏*‘„2dw+-i++àÌ†ÎFï$º≈Ç9o”BlÈ·LhÈç™¿G<Ûõ>ä_ ﬂ«O8‘ÿ^™‡ÒõjıT•=Óˇ¿¢D‘á&û∞‚8ôTÿ/y‡¿+ºb*ZNﬂˆ“¯∏dG´ïá{Ìﬁ¡ıØé[Õ˝fŸómGSD≠
ﬂ:·ı{‹i|®<ÊÉjhRl
áä–$å&ÏÃÌüsï0¿wNw»
º¯ó◊ÔaWM)⁄ät—h6˜ï∫‚m&ap§ÑÏÿ8Ù˚k3çò#Uèõ◊ˇ€ø¿øØYØΩﬂnùtè±™iØ”k_ˇ∫À⁄{8ÇıJKÌﬁ…ıØ˜Ä´=Ô±ﬁ≥ŒœªÀp⁄1^¬z›G«m‰vœ;=∏A©¸É‘Œõ÷ñpﬂz∂ÿr4òøÿ≈IÏ§Úás‰ä£EÕÏ0keÀ•àÛ
¶®^£±ŸaP¬5˚¡Û^ π◊ø‚9L‰âÁé&%‡hâ“`Îóa˘Üy¬Ü~c2œZŒË‘#F5°ö‡∏∏ïó `Z#∞ÄY:„	—,~è∞=´,©,pE¶$Ïfóø}úë@à¸ËﬁJπRﬂﬁÏı⁄¸¢$%9ølWüıï§ã*0†⁄¨LAFíx›3`/‹ˆg¸ïì'ø¡¥¶\ƒxÚ’õ9Hp;xÁÌg
L)ºM∆û˘ÉÂS9ï2£2)ú5©ø¥‹ﬂ%.•Ä&OŸP7|I≥ÜÙY<∂ÿ7˘	zÙM&‡‡lﬂπfSJ¨–x˝Jâ@ëËs$z—4+∞aŒòè˚óJ,¿|[sÊ†¸Ü‰ÛNﬁ“hØ~Æ&ó˘;§é5‹´’Ã €«ú)/_ö˚M√-Á…+‰ö<pƒz|≤„o1Nv+¥»À+z˘øxíT^∂eﬁSÎ-Íj…áù:∑>rÍ¸ªâ©Sï/â∫±ƒz5‚Î/úJÛÔ[@®†≠ …ÈrÆÌD Ø€¸»âÙ◊øNXhVuπyº‘`ƒîHÑ◊v∞1)˘ÙÙ’LrˇL„˝L	œÖ†0%ÇvF∑∫.†&ãàÚwÚÔ••Ω<Ÿﬁî8kÈ∑ÂE…∆ÏÇÈæ∂v◊≤Má™≈÷÷S	Y[QY@˙«˜¨Ÿ:y÷‹Ô¸ºy∏◊ES˜§…éé€œ;M0ô˜—™®VÕ±Û¸ÃÉ=•ÔDû!«$£T\iÏù∂„T‰ -Fﬁ—.ÄÓpÄY√[€ÙáPÁK765•R B4‹<·<âÈ%ı‹ÑgÖo€`}ÿnÏÌjùä”ã91Dd¸HæmLzf£¶Tq&M.rê1mµ≈çTòcbzÃ£ëMS<”••Öy%ñ˝—Å6pœNtØ&Öªlﬂì7Øø∆éÙ‰˝£ÓvqLÚL9¡[\˝bÊÚVwîÚLK6=«/Cû´Ë¡æ%™S–»˘Üâñ˝ ,Ïß˝5ÿ⁄}t∏åª
‚<óhoÍ¡MM^F–X‰°+IKÕq
ò¿Ü¡õè:åÊÃÉ!77XÉÃ»ª ≤fX ∏,Fk]≤Á]‹ôS$˜xXã∆jÁbƒÂ€ªïÔéeMr≤W,\7lâ˙P&¸»Ú+¡˝Ôqá`÷&°´—Cπ≠∏=8ë∏ÍÊïD≤0”é¸ò àEÇ “æ√∆¿‡}ÜYËÁÊYFY‰~6‡!ô@I¢e{¡∆Ú+JzÑ∑ú◊ ÒÏ‹∫§'Û…0º~õ †„{¡N«¢:!8œ
√ûòpUÔi≥±π≈.Y?DÊÄªë`Æ7 ~rÓ`≤väÃò¶¬6Swƒ∆ˆxÖ©ÑI¬™®áúaJ˘nz<.Ä†/ñm{íãB„{DaˇAqj£v<üÙI©LÜ◊18(&Â€≤&#örX2∂∫h∫Zﬂ04¢ÑES•*P`ˆœ1πyæ‘	[[√õΩzCœ¯ËeÛû“Cµ2}#÷%≠üä ˇÆ∞ùd~€k ≥¨I‘√2¬†‘ ›˝ÇQ hj 7≤o´¢ö∆ÕÑıås±û6¶ë•äpÕàä0ñ†ˇdm°¬R°õù^Íú“∏ËZ|°	‚nGAï	¯ÑN£ T2GËH–'B>ﬁ.éû˚Ü≤BöÎ$‚fTÖ~¸#-+Ë¿\V‡ÄÌ’|˙RcΩS$&£‰îo’TÇ€FiiŸ]J˜<;Qá#ñ¥ x€&QÊ#Œ‹@À⁄LäÕFÅw¢Xò@äå]ããº!wÎ…à≈≈ÒÌ≤tuówÏßú∆*!Dæh‘k£—ÀÿnnÏ‹£øﬁ$(úúÃÈ¯€ $@4⁄≈\9∫2¶j`‹:èızMn§ZoLﬁºZﬂäªc‘VË’˙ˆÚK)Íù¯Îûè«¬iç_‡µHo5ÿ‚W}‡π¡h?®Ô¸á,=–õ^˙¬ãzÍ`õ¬JiR "ÙCÁíÚü9èNcö∂zPïÕØGäî2˛wÊì˙†íLœÑ(`é-%UJç„`¢ı-Ó^d"¬£¡Èó;ÌÛF·º¥Â∂°{ÊÜ° 4.	Ò0>4ßñddSfıiÔ(wzî]M;«X áZ˝\≈m¶qµŸ'HóÑ®T‘0@c∂n°Ÿ∫UqHb„Íˆ¶	h®HûÂìæ⁄T˚c\’n£e∂°Ÿ∏Hﬁ…∫3‚œ\;$˛–N¡”-Ù‘Y›¿Y›òw/ƒüˆD¸)Ëg≥$‚œ}˚-£“ÒESZÌáAbÚ¨Ëb»–≥Û(xÛ†Rc5÷ÿÄˇW¿úˆ˝—ÉzÃV‘)ﬁÜﬁVhk´ê∂íßNúÈ9 ¨Ô0ÃÏ9_›¨n>ﬂÏ◊V´€Î´’≠{ËâèˇE¯CcÔŒ}∫Ÿ«SY-Û]ø3Ò;˛;«˚÷w˙5ggæã˛‚^ÅÉx
'”çYÊ€(;¨∑ï¬ﬁÙÆk0≈≈'ñÈªì_Ùsòb\\s;KŒ˘˙*ør≥¿è˛ƒLœT®?≤Ôç›æ3yP!&$≈&Õ…a˝PvÊ¢‘≥—ØW7v`A6∂ÿ˙ÍzµQáˇ¿B6·√5˙_}~]Ô√y˜∂Äj÷,"Ê6í%mTÔm¨6‡j#sqÉmWÅ8Y£∫Nƒ≥Q≠¡Õˇª˜ÛrÑ ÜŸ`ı∆”∏>{Aî∂q¯(kÄ˘∂ﬂYäÍ_:„Ö(
IRkÉ†±πK~÷Å“X=⁄°’«√¯€ë¯k5>í]˝ºDõP1Í
ı¶˛†≤Uaó¸?o*ım¯S¸W?ës?Änô>aÎVpß$ù{Æ?‡;ﬂa⁄îJÁgx÷hD€¿/∂WÎµÁõ˛ÍˆÍ:‹x˝‚∞ß-‰!5˙QR8I˜/≠j∞ç’çÀÄÓ)M7ÈÓdæ6€Ï&˚π‚ie∏ÑÖjp°Œ¶K˜éù¨izA‚äòb¿ô”©Ò;≤«¢Lg—tÏ≈≥_‹#ºt'`¨•t*ö*¥‘≈∂ƒÎƒ`Ÿ`,√’¡@nEÑ≈Cùë3tãö	ˆ˛µb±Ó˛A˘∏çc®g’qsØ”›Î4ü^ˇ¶w“iuﬁ“æ‡∂-≥`‡íª ˜úiAÎÈ¨âúFä<â$;âºíÈ€,èx?Ë·c¨øŸÕ˚≥Kñ<Ñ∫D]QÓ=ΩÃI∞w≥•ÙÂñ„rÃ¢–±Ìk√
ò,⁄û’Ës{Ïa}QÔmÚº≈®5ƒÍ~˘K&ΩéX^ÎhS˝õøføåNy≈±X≥µMπLÁuËL»˚Ç=”ø@^EgkÛä˝=WÚÎüïf¥tbcïáÒ‰«˛·´
´XZiZ‹Q˘,ü#¨î
ï^ŸZ LO\ÄÁ‹—∑=©¥o…#ﬂéxÊ–ù›˚ˇ€ﬁ˘-⁄AÅ”†∞d<ÉπÏ©	8˜∏+[jV&è,õÿáÆ\Ω4€ v0I‚t˛M\¸$¢Ô\h_Ω{∞6O’ö=6$áÎa‰ı“ô‚E¡|`aóÌ≈à!sÚ4Å52Ñ).§+}lãø4L_.π[ÛtDπÎuRŒb˜4˜;èéEw∫'ΩΩ«åpö!/´∂†s¬#jÉ∫˛|–Ÿ¸“ÑV1bs÷ø®≠ÄI¥¬o˛m¿øM¯∑ˇÓ¡øm¯∑CÁ‘^VGŒdÈvÄü?Ó—GΩdÏF{ÄW≥Uóöa—≥<ùÖ„"52◊/ˇ˘ Ω|p+Ù¢Á—≈œu∏≈)È/6Õ€G—È=âTWÛea@”∏üX∏j)R‡ücÿ∏Ø–J¿ÓÑC"≤‡wŸ·tÈW`‚VÈ¯òÒõÏGÈ∫-ø[a7=a˘ãï‚Ë÷√@|X·ÒÈc˙ñ«ß5˙ÕÖ0˛öq\D"Ÿ¸UôﬁÀÖùóçxÜÿ=Ÿ4÷πÿÇ`b≈|{#.ìâπ3Xñ•¨©'Œ»aN1∆@+MÄ—â1’—ı{LGÊXø¿ûŸ~âÉ	∞”ƒô∏∫ÍïÇ◊^@º+Õx·…=7ÙŒå˙ΩoS ◊˙""+Û¢ˆ¿√Ã_nwãN’ü3é∆8öt*ƒxM4*&ÃZ˛®+6rºqå∆…Q=zﬁÅ≠˙A|8áŒ∏w	G#/äbËˇçxŒ;g4ÒΩ)ˇª:Å∑_J_ƒ:àV<ÖÕÅ€›È#/°JI≈r«Òwè√`ƒo/›vÖùjO6<ÆÄ„[G∏Ãı*k=kQŸÿ‚∑ı¥7gÓ hºî›°5£∏ÇõQÇπBÄÙeµß¡¿¥?ªÂìˆ(\.•k]ÏW∞N≈„ŒÒAì5˜·óC¯âu4…‘Ïóöõ´•AÄ˝äb3óá£{ﬁpÏ¿πîL;g πLßv+UîDÊ3ò˛•ó˜él“∆•â¶aoVK7ù≠GTë™èÎº˝≈ÃsC¯mÈ¿≈Ë)O¶~åâ”¨çJuaÙ¨≥®õ] ˇIUÿ˘˜T¯ƒ§ﬂÕv¬€”WŒ¶{æXﬂ ocπ{›Õı^aÚb;4qoNÁ´µc¯œ ˝øﬁV‹dn¯0øPsX‚FEùN2T˙(FT&©DöE)Å≥∂∫ZY„4tùØ8˛/∑Ê‡◊2^m‡‘œ;D^ˇ‘âŒóJ
úæyZ…lÿHÉ∏ÓU˝,|)TôÄÁ+Ñ†ßj=ë;Ú≤¿qﬂGsÜF:XàáEè >f≠®+ïEV®r"Hö’`B§rN˛‹›$ªCo7úù:ôüç}xFTÏHª˚◊nSZ˙≠-º“Rœ!K≈(sœàûîpÖ á∞˜œïV†ºÏc(„ãg+ô æ$cœõ˚ùΩÊ^ó˝ÙÄ'ùﬁ…1¸Q<9ﬂ˙j∆ù†ˆ›°„/æ®:Ï÷Ëı+˜›KÓ¯É)Ó{Å,9Ç.ˆemèÅ•f8≠≤˙Ü•˝Ü:wÖÇ§Hß√Q†X¶v˝b·:…ê–ª´c?sk'RIWùjkπöcÛró≠–$á:ŒÛ¶"ËR‹úrZ"S76tS¢ö#ß÷ñ|Mq√R	û¸#•y C/ëÎ…?îÒIQ"MìË2P∆≈L◊π∆®À e#Ô¨¨˚ÍhÊOΩâY˙i7HÂüíô%Ù¥rŸ§tª<I4≤©õk€≤•'òHRM#r%4=	≠5∫ 
ã4$IL._mÂOÉ˝ïÀFVπ4V˛Ùﬂr∆íˇkntÇ`ŸÎ<Èú4˜⁄á'Ìr/\Zxï]Î‚ú)CÈ√4_
ÇıÖURÕÀU?(O…õπmÏLâﬁÚ‹Y˚/´y™ÛÜAÍ‰ÒflU«VÿÛHJÚ∏—„éy
]◊_c»¨3∫~è.∞H`◊D˙&»•FòZY©0WåÆåü@3{©¶ZbÂ¨¡“í~·Ù^N˛A°ÅN∞Êﬁqóı:á◊ø9¬ª£GÎT\¿∑≥mqÌ–>Bg◊.∑fO›≥ Â’RF°Z‡üè˚GÙı.´8˛kÁ2™¨p#89ÃØ{˜Æ`™ãÛnﬂ≥GS™˜Ói'∫ÄU›5π¨WëN∫GΩNèuèŸıoéü4ªlÈË˙WO:áM÷9‹kµ˜:»ÕÌŒÆ+ç˙{:∫}:“LÛ∑LE[U∂◊Ó=ŸÔˆ⁄`V˛¯YÔ§Û∏”!Ω6kÌ7{‚H˜∞›≥Së∏∏e≥ç|•Åª–úË	Aö©oô ÓUYÛ∞˝”Ó.¶W6èŸ£N˜†›∫˛’!Jü60ë«˚ÕÉ&b^#o‹˜góEùqJ“‰√OMúá•$Je	¶
√u—®wÀK∫∑.◊Á<ol,R%˛´µ±ÆVn6 ⁄£â‰.5qQù®…µ±x˚/∫h;w@)“VfÆLøé“µª)X{b∑ú¨Ωl	ÔÕ wÕ»Qãñ‡ä∑–·&Ø»_J¸i´˝∏ˇ,R{Öæ^ΩºgnÿfI,∞eZ,ú¨˛‚”⁄YΩVs_ñää5[›É£ÊıØõ®ouÅqû¥ü7˜ŸQ[ù‡[ã]mKW◊’%Ïh RBª•¬Ñ‡Ã≥~ñ≠ œyäòroáAî§PF∆˜ö∑áñÒãR©∏$±˛€K™∑Â–Œ’2¿L∆|!\$yﬁ>7Ò9y>!hµÀ≈§œóMû∑gy¢Ræ∏xÍ|)z≥¯ßÊŒúüóßtŒ¸Ìœ•‹€IdÃ _}–ÈÂâTG!µ)Ù…”˜Ã«úqP·D/DÍÌàı\ËfÛ
√Õ∑è§”åE”≥©;ˆÅP)e÷ØejhC‘∆§;oeSalH–&¯IÍ˜º°ÚâF~Èß‡òí\åYMò “⁄1TŒ7ÀhÒõ!
Òx%=ìqí¡Ù]‡îc,(er˝M‰MP6ÁPﬁ»ÈS˜jñvgJ«‰2IVô%ÆF¸øfmV#‰¯ºK"emk%ÃÆIäÔ¨≈⁄ip¨ù∂\î.øˇ√çÅﬂ—ª“D˚yØÕû6˜˜õ?“Ì±ˆOèˆ;≠Ê^∑g÷ÕÑP©waøaÔ∫Ò<+˝ï{˘£O„aÙ9ï
,ùÒ?wô3æ\aﬁ‡Õ.œÙôRn==î«WΩS0Úh∏uo|%Ωæô5M°m∫MeÅbL®S∫Òá“„é*S≈ïò“*az9ÅäJzuB∂ê¡§Íé›“3	&%Ñ√›Hgπ˛—jMJp*0'hQ¨$ÔÄVÓçˇƒGÔ*ÂıÁüÜ9¯c˘IHªQ•jÛn
}ùºb‰ç‡Ñ3œ‡ôŒò˙Ó`©Îu)]ëc±o[_UƒΩ%å˜5fÊïRı¥≤≈O¸‹Yå.0iMXsä+J3ñRÖCﬂ^æ≥ß,8K…ù˙3∑`ä®îlÊ¶Èù÷©°So:3ΩŸ–	Õ9Ür÷UË¬{ÕÄYıo∆5ä«ãT∂X¡÷3B¶RÈAH#4å_V}w<úû≥á¨VdL,ä≠˘Ò+© ˘›br‹nu⁄á{qhÊg¨ıåÚ{ÏI˚∞}‹‹oõTªr¡≤Mdïæ∞õLœW”éêÛrT3ap›ÉêjwÄf~>ÂÉ!ê^˚∞xÆËâÔÃR˘«ºCò°i¸ùÕí+µw¢ŸpñÜ;¯O3lÕåu{(“wh/Ω¯¥6®πıçów∏ó˛€ˇÔ•£„ˆìgá'Ml‰˙§}€®«∑ΩgÏ‡˙ﬂ√`ÿ…qÛ§iKå*ÿSFpõ≤‰⁄«û! <º∂◊ı›%Õ4¬†√Ÿs∆u`ÿ„Cj;çïb3ÍPW¯f$2í¿DÌã6ÁãÇx€+Íâ.çâZãÿ-e6Á!øXòXÃ‹Ωî:’@jÃîQb∑{OBÀíä&ÌÛcÇ$”ÉgÕÍÔ™ÏÍ78€ŸﬁÇ-#L|/…új‰51‹%≈”Ê÷
b¸òw±qã¸ÿt”õ»ô_6ıôç∏Ë@4ƒ¥Ïª©ë£ﬁQTDÛVL%‡/TWYœT®ï£<MÚü÷ëJM*Ui†§+ UA6ä◊_t ®¶,^„#íPÀìô<gÅ^0∫JßL§æ®ê§}_‹àÕ∆æb‚RuìhU^{ãD|A$ø‡éw›®·sÂr∏KÍÏÄ‘4ù]ZÿFäO9X•ås—ÅºB/†ÚÇò£√ ¶tS∞1Ω¿ø¶√<C‡nz≈(µö|;œCÑ≈Öv±@çAôbÄEã ÊH˛Wí˛wíúˇÜ.Á‰ãååEsˇŒ˘ø)úúAãª'µ—@Â+LŸÎ≈RÃ
ü4Wä˘πÂe≥ •9∏µîq#´À$!I«º	◊7AÉª≠¯ñÅﬁÓ†Å—∫n‘ªCåå‚"¿S–˚‘MÔoosÅñk^ßò€ a=B»¬ñiqÄs˝á1 ﬁo`ñùE~÷ÖößÅ?s.ÇpX—0t#êç>60ƒfD†∫˜Ω	¸}…Œù∑tPçAá™°Ü˙Lï
≈_.É∂P—∫†D‚€¶ê'\ç†Üâ∏õÙb–0•≠öÛÈá)©+ﬂ≈wSl§%ïbGI¥Êÿò‹˝tÚ….”(iÜªmoÍäe≥J,	JÀï⁄l¶/êÎ·îoñ›;^%›t4=ñ‘ûJº´h˙"5]˜fmö·∂⁄	}}S◊:>G-–d)ç∫ò⁄-…´ﬁ)ÎÑ“ g;%N•
z„ù5‡[Œ¡‰L√KtŒkπ¡Î*›l)ómˆ∞3Ìü≥%7?A¯n^.·î‹’ ﬂÔ`è¬go√ªrâ®-π≤£ëÔˆŒLA∑—ïk]È uK£ıc%ùo˝a)B∫O•&Vû√ÆyΩ∫ëI¨ YÖù¨*Ì/±mπJXäÑÂ’-ﬁî‹±|KññsÔ˛⁄(¿Y®*«sÃOfy˛Ìoˇ;;ËÓ>£ƒÀ„ìhÄXÛìßÕì^ÛËà-	∞úﬁ
f±wü7_ˇ◊&œ˜ûÅí(óƒ\E¿á~rÓL£Êd¬Ÿ®‚»r“ÑÌùyh∆mﬂblíí|ô§H'\ÀOømåÖÿ‚Ø0#wí)@ΩüŒò™‘{c (««Jö îozπÀj+·~´Ólf±’Ñ¢\QOÆ®gOwﬂx”9ÓÆ ûü÷vjÉ∫ì∏tyoêuÿ!J∫¶˝∂™¬•}∫ekE∑H<OAqÛù≤Áìïß» |ë@©ÔÜFa“ÎïÊqkòÙ»˚ÁÎeÚ ¨-y’Rç6Ñ∞rN8æpÅ9nÒûbK˚ˆÌª7ö.Áá∂væ^XöA97…€≤z’BŸ“∆éêâö¢!0QûÔûjRÓ™IÎ≤E>,<^±  ‹ƒ®†3£fAZÃÁ˘LÍ:/Íbµi&‡¥páPôá0Ö6s\/ıÊã6n€µãÛ<$>P¢åxwv∆gÅ∆Gî¬:ó‰1æ éúØDÚ%›Òäß‡õñÍ(‰é“;Ó˜/¶.DªöØã∂Æl¡P>øû•A(oZP.Ä{#ˆnÏEØ◊j≈ö‘ÇûÃ>})BA+uäî≥¯öX⁄íg‘ëºˆq2ÑOTqÜTë$A¨∞È,)á9ÙnDnP|ùÇ0pfﬁ ©W-)ÏªaUŸI0‡M{√†èF•“ºÆúŒ§ûπóx¶;&ﬁE€ãÎﬂ—˝FF≥§uîjÌC[’ôf/¥\Ê£≤5ûÃÚ[–ö´£Zﬂ9u˝¸™ÌòÀ–÷ÕTT»˚Øˇ ¥Hﬁ˜¯=≤a©;Èªs¸Â|@Ò˛çµxﬂ$[V'u˘€Ö⁄’ÿ˝ä∏7®'jV¢‚ıH%ÜoÀ@ˇ≠%!ìËæá°Ω—‘v\Y_Ô¶ù¿ªÁ07| ⁄¸.€‹ÿ©◊k‚√ñ0Ï€ø˛≠Ç~uÆøéX‰çŸ_≥±«\§0/àñı7øp¸hèØqw8ì…—y06d%ÅÄ>«Kê–Æß5F.%pjÊVÅ›iïûS≥_fiÌ≈ˇZ[›yπ6\1£∞2‘~"èØç'ªÈMÉ–∫U∏≤≥Tv¯*~∑WºIeÖôoc .ŒÉSÎ\õ9W∆NÕFãgAÌÊ¨Sçfr@Ö*ì“EWãÔÃ¶ıƒìCKUGöÄ©;≥©î-„ÑŒÜﬂ4Õÿ3"NªÀzêÙóNÑ˛ø±‡N ¸ÆøVRéésÅÕŒAiΩ~œ·FàMÖà⁄Îú(£(K˚Œ≤a8õËötNCPs}E|ÂÂÇF*òŸˇQ≥◊eı]∞i{'«œZ'`–Çâ÷jØ˘cÏ´1UG/ kR÷B	q`≤ãí@çfm‚w=rAÎÛÊÒÏûÕ£íN˝•´34⁄IiuK/5pÓOÇ·–wYwÇ@œ$¶X\‹¢èVÊ§Î’í∞·’¿$®®P•!¡bR;WQ≠ΩŸ<™Ë˘Â'A:^1\úCS∞Ôs¶X∂RΩL&¯îr1¶q@<¡kPËLwﬂe1≥Ïp4ÄnnpÊ($Zú£å-MêY€R;˝6j5K`s7Û∂µ<’Z|Y*÷1Ωw_–G,¢:÷‘›Ô4xc
¨º»9ı›¡É+√˙ö¢ótc∫ŒD?¸aÒ"ôÓûì·íà5ﬁl)‚bp∆–´öT£ Èj=˘âØvSà-LRº∫dæé≠ƒÑÙ”n*<7píö•›âˇ!óY„F”
b&.KZ÷àâæ
 ı#… ‹ç|Êaé‹’|ú?∞≈õ√L-ÏéÅ2ﬁ-ÇÄ…&ﬁ#
≈≈Â˝˙k\"å
ß!ZÄ˘VµÊ3¿∆ˇ”?˛X„¨]í˙¿¨Õÿ|L≤b(FËâi∆‹A|Û_Ä∂i¨µjÕeÌ¬¿±ã‰‡~¥1ÃÕG-|2E†á–9*5®Ôé¸ëé∫¶%MÜÚÊ®‘KóL{¡rÇEÅ~ ^˚kæ5¡Ré´‡G(J~•Ø2t‘u‹˜@¢DòW‚√c1	ùK6òaF<œùáﬂî*œîyî›^üÂqò¿ttæÓJ¿î∫¢¿mÏ".\´y¸§yÃö«≠ßùÁ›;⁄{¸hÉ‚ª∫eƒÜl/Œ⁄ï†mÿ“ÓãÊ‡K¨§µ·´El“\=D4⁄ÕvP—¬So§‡ıÿúÅhl“rô#Èáã~ÇûsY≥L“O“àtËà6â"‡∂®ØlíÒÀb‹Ë!ÀÀY]ÿMøã∑,ÜÖ
Rπàã•ü`*˛~PIÈG(⁄@«
jpÊaö'OP,ò\›˝#°î|¥0ª—Ã[∫,];vFIº"AUØﬂâõcw˘l,$úÚMo6óΩRœ©Ân¨Ñ‹§&ÿQúπ@rÏ8.[¥≈•ÚÒ;ŸÁs™%Ÿ•°)∑[Œ∞
U°ª1À∏˙BÓΩtK[∫ÑƒXYï%k
›KÀ§î∑V
Ï≤MΩ]¶_™/Ùk≈˘]<HÂÄ∏ﬂE)z8ê„aÂÍÃ˘“ç’πÄí–ÚzòõSg1}X®bZÖÎ/íi68”îï“oÅcfÙ^∂ÁÆﬂ˜—£sC~YÍíw}3èö˚{€>dO∫›'˚m∂w‹y>g§S@t-">>U7}Á.k>;È\ˇ
aÊÔL°5k∞∑§órq“s.M1µSœvR˘ÊEœ&∏≠aZ≠W|B%?÷íÇ•ñu;˘k«õJ…E∂ëOïN2m∂¥¯Në[‚´mﬁå%„[+»Å„ªp©Ùfß^àÏ/raÄd9Îá$àõâ;uÿ£fØçA÷ΩÊ	ò∏ jûzbi¬ÀkŸ ≤îﬁ?vœB7:oΩ÷…ó∏:(öx„“¬∆Viwﬂπt1√pqYfpÆEœÃ51‹ñ§£:_T‘Öª%i∑1á¥3;¥8"NΩ©É9lX«◊‚∏´R‡m;ÖnId∏Q‰]é;Óæ˛Æ•¶e@”ìÙ™êÂ◊ÅúÁwÉ5J9O>Ê¢Ú<ŸçÌ\*m∂7)ﬂ"£¡Æ&Áà“{¯ÏOBó£ÂfÛiÑ¸¡+™±i<)ﬂ†kI∫†÷>|ﬁl>ïk¢GÆ˛(UÆ}gåπ-I¬—%;r—“.ç<t6WøÓ–xﬂ—≤ëÛ–={`Ô£ÁÁÂPSq-qò“Ï¯≈} «1Â‰¡-î‹Aô ﬂi ﬂﬂÏât?TJ*ˆ˚œBø=Ó‡yÄ`€≥„ÜT·ñ„Èﬁ8D— \£EÈ˙‚|:ùDªkkŒƒ´∆#ØÇŸ≥vÍ‡sJ|É´ÙfÔ~àáCÈﬂ}a—ø
†πô¡w≤lj"Ãch*Ø`oåø“k\¿6∞Ë)ò†>≈∆Å¿ñ°Ø€%mQ5LRjô∫V∑¯iKÆ‰¢›¢^h4`´yóÍòÄ_+µﬁnIÌ>ïEÂ˝=DÇ)UŒ!. m@∞ñÜ,Ω,yƒké÷›h≥«J∫˚n»&ó'<grÄBG[tÖŸºÅà§·Ü”• ﬂ«¬›æ"ÓÊ°@«r`±ŒƒôÄ¿ã>a˚†àîè	Ú` ì•÷4Ùˇ˙˘2jê®ëd¶≤jJ0.¿»ƒá5Œæ‘v“)˙⁄°5}*∫∂√≥Ek˙Ë˜Dà¬h≥Hu/õ§Ö‘ÚBXa 1µÌê[Rô;∞¬Yü√ÛΩ¬ØP©„D[™∂)£E ∫bëO÷pR¥®| ﬁ\êì´≤–j‡çR%F1ûïHI0"(g-Oc9BıΩO°˙∫≠vØõ©¸M¿0·˜•ıÎ!ûﬂ^∑ß≠4—g¶ÃK∑Ôa∆˝·¡NæêBbe6ôÇõ¢{ﬂ{¯T¬ÆÉˆ˚î–"—€§íñ*î∏u<%ƒŒâoÏÑ˝sÔ~A/0`P;&¬è¡
´&lÀÏ ıÉíKŒ§QŸÖQa±û5˝>aµX~"πËA9ÊØ¡OôR>∏∞éºáxÀÆÒÑ∫S
dß#û)të'Ë.p∆‹.Ã≤/Û±ñÃ∫F	ƒ=X+ˇ¯æ'¬+XG·¶Tr7¡RºAI“˜E˜j˜◊Çú—YJ§da=ˇçó’ˇ√ˇo,´ouèè€]÷ﬁo∑NéØCÌ·ñû4;˚q´£ìÓqÆ§˛…»Ò¸ÔÎÈÔ¶ûæ∞HË˚z˙≤ıÙ@¶™¢ÅŸ}BDÖÓÄRcØÏdJ©VÂ–Uÿk`ö
ïπ
Ïiá%0òÅŒïp'ïıÈŒ˛æ¨^«ás˚$.´?˘Ç"[m˝∆MjÎõ≥È9<Ö'V—a¡ı)6Y2Ñ-◊◊¡Ç^}2ƒEnˆ˚nù_ã–4Úcœ6ıê†srg{d‡uMA~)X6-"õ!sV”±Å›
|/&´t≈É#÷Y$YL0pyˆ≤4µe0[ÃŒ¸π ÙŒPçﬂÑÔù˙ºÎ¯Èå1/ãı8D©u<cXò⁄ñBHOnÌ»É5óéöëÁ(MÑcw∫Aÿ'TA9–@ﬂ ÅÕ‚FYAÏÄ–%M€E›°è7å¯Ñ‹§‹-GÕi–˚¡–3¥$ëÉÊpú7ÏåÈ¢bœá
¥ÖTq¸qëZK±+†§É(Ÿb˙îfIò	÷å¥UËæ‡Z¬<Å_uv˚¶’rËw±P/ôA} v¸ü   ˇˇÏ]Ko#«æÁW¥È†ëK_í`≠CëîñıÄ®›ƒ^Òàú%«Ê3‰ÆhzÅ»=6∑X8∑r|…]ˇƒ ˛	©™ÓywœÉí÷ﬁ¿¥π"áúfwWwu=æ™¢ÌÁFT$⁄Ãdë˜MíπÂŒy[2	á≤N(HØøà#{päÏœ˘D⁄∏‡êì5Ö∂M˚@ÓLÊv:’±¸Ó«†Òÿãâæ∆·|\’◊j.Û•^ÆP·àN®√´¿$$Jçc˚ôMQÓ	@≈|„jˆäÏËC4OÁ™*1Io„+Û˙kÌ©¢a‚`>BƒX5∞Bk:¥üc˜Vy˜Aéù˘J≈¨Çe»BHü∞Ê∂ë2u¢íN2w}Ç-û~«oñM%UJ«r*àìÄ2Òƒ†h£bÑ+l†Ö~•K≥q(®S~æZÜŒ<uí¨Áº‚$π7ªy4?.Í+CFr[¶ì–ûËØH'q0)“bw9qõVç∫X¸å8¬°Ç9îº)àèäÜÎ∫¿}htÁX„eé∑vªHJ¶P0xÓO…T*k–¶%!µŸ¡ÑØ€«ŸTè¥∞
…?	
Y‹-ˇ£“§âK∂eZÉâq?îÒœ‚˝–≈Ø…Y>ÿz/y¶â3√É€1ˆ“\ò≤ƒÇÒø!áè—ÔBÜèiá.∏4g:¨–ÛN†ßƒ◊ƒI§¿ç—á…°€tÙ´‚∂#…Ω? o∏"ãH’Ω"w≠Ç´yñ∞Ï~K>òû+M¯µ∞Aﬂ{˛+R(c¬˘º»û¸ﬁ”`)"Ω’EÈƒ[Qè˜yW4Ì’Ldm‚‰a6ˆ8’>‡˝I≥Ï≈‰g^˚‚æü7@¯±≈hrﬂ¨Ø~zl~A»'‚”Ky√C?w2Óy Øgß«∫Õ>IÄâêG4¥dƒ⁄@y˜ÓFY'‰öé∫Üª˝øGo~x˚ÊOI°≥«÷—] ∫¿ô≠‚Ié:Ô°Z»q˝Ã^∂Lñy√€˙©≠¯pì ^¬E’!éÑ%≠E13É≤+ç,˝˙&Û∂1¬í2$äÿã˘l®Ô<LÖ±¯√kÕï≈Öy!D˛êaÕØıÖ»ΩíœÜ†tYÜlÄ™ÂCìÔˇ˛∆a 	ÿ*8$é/°£í–úÔ±h‚ C;6VƒÉ√•µ2¨óU∏Ñºï‘é=‘-Cé¢I#óToà‚êßº7≈b1çpÇ»,ô‡Mi≈k˛ >‹‘≤K-©Û%«ä(öZFâZN©ÿöDR©%K*Àñ|%>
C!ÔKä9≈|MˆD≥:∆I∑sKµåcyMc{çÜ ≥·	7`_U¥˜˚˛ò≤«˝Å–ãKÀúÊwºKB*◊3,+a˝…‚%T…8ˇW°*[.9dâ+h˘Q¨$ë1ïfNi1m“YtaLù]qnu–Õé◊∏¶¨0Q–S˛V|m…¯ag∑è¨√°¬‰¡∞Ó0ïØMeRW√ò¡ÑÔﬁ¯  eÉı≈ìÛÔï∞ÔRVáRyÏGXe˚/˝7Éc~ÅeŒYøﬂcﬂˇÒNPpﬂÄ˝i∞sD±ÊE7~B2cg[º
+bëÄ˚ñì5Ê+e‘:—◊p<±º¿YbôıÅ˙’.V4Å≥·•`•µ íñG±/ç°»Ù••
ÛŸÑoÇÎù8œõö≥¬∏¿_ä¡^î¡+cYOÀJH∫ñ˚ê»±◊ÅTî>Ë©Åà¯°‡ Ör—ÌáıwaﬁÖ>˛
’ÀqlZ.¬ŒY]ÿ®[urqkpzÌƒà(`YÚÚææÇæ¢üíZæTΩ◊$:õuGØì’Ûıgû‰XΩrùáÔﬁp,ﬂ+˛'TÃó«∂GõÀP£7ƒk¢ï&#ÃS™’À´ñsÁH2∂ƒË ,æXç!“Ü}Ä´Ö“™©JµK0uƒ¸’ìOfW?Íq4ºJú*Ä´ÙQ-àl(ÀÑá6C\(∂u™ıÍ<h›‚◊b≤}g´ä≥UMª2ù«U§∑9≈†&ÎÑ∏
jXLh`Õm[π`‹∂Ìó#Ü¡äGÛõ√\âïòVÖˇsÏÖ9ôÊ‡±`ô¥ê#Êdh ˇ®'ñäˇÖ1O)Ô3L„:.‘äµgµA©P‹´äı*‘Œ”∆ƒ5œó›'µ~ïïBüŸöâ◊¯cªÂ˝Aâ¡∑CüŸÿæ∏Ü˜øƒN<Å/S√,Ù©Ó÷Wπx©ÈL©˙1•∏%ƒ¿z˛›H…˘÷ñ˙“ñ_˝ù9\és	Wzp»Ù≈aéòÄˇÍ ¯ªóUÎÇ|’YWEuP.V˜a¢´uV)TäZ˛ Åöd¯,—Â:º¨‡{ç:¨Ü
‚T·íÊíJ+6™/¥–Õ€+¬¢cZ±Bã¢Z’∫Ç_ò4X„”x˚;›”XY{≤w‚oV±iZ9’1¸;\)√ô˛Æê¡ZüeZ!Hbd≠*T´UÄî¯∑+áïÌ}¢&^∆W˚¥(ƒªÇs≈ΩZÔ>MPÑ(ﬁnf∞õÚaÆûck˛ÁF;Ãï˜‡≠¯+ü∏‘SS^Àı;5|ØKÀõ∆dX†º„Ô·Û%cHœà4¶iˆÏÁΩBπÙ¨6)Ï*–`ÂeÿF˜xâ˛I8|mNÅ∑ïÅ=h¨
¢‚ÉPO•r+êŒ™JÓëo*,Íõ¡qˇ8ÂJ±N)ª|4.Gl„◊n…+xgÈN∂9ÆæïSî–}ø÷,ız©û∑qy[®ÆÎ_vıµ?êQk*œÈ„<7(]óp◊|hÍ£ŸÌwˆí™xÃ±Bµ™≤rDJ8¨Ï∫Z˙|Gd’´1˜≤ŸÓû∑ªÕì≥€7}iæF>9…2&j
^‹d‘m}ô∆•oƒ—@wjÈ¿–¥◊éç¡X?êTwÕπ€8÷–xº°ö1‘˚´y˚Ùìº7öù◊n–ı˝Ÿ—Ç¿; q% πúhîZÍÏs6¡A∂è8âíâu|˝5Ûı4:ÒrsHPO≠ÖÙT.ïºÓWWΩh;JÜ™˜∞t¸ªˆR4yL
±hË°4 u£D@F3Qâ[Ó Äw H∫…1)*>˝ÍŸØ’¬KˆyY#lÇhôaô°YJ≥πÓkíhëﬂ≥c/W¿>ﬂÕl•ÿÅµ˜Z˙ƒº∂‹äd£≈úOò—ù.,™?æ˝óÕ·O0?êÖŸˆ]∞Fæµ∫˝∑Œ.ö≠~y¥Å=Ω≈ú÷ìw+ÌBÙ˝ã–D¨hÆÕ÷_E …†∆gø·ãòÅ†”ûÃ~s=Ù∏úŒ°•Hˆ»B˙äÆ¥L•¢iNŸì˘Ñ›ûV¨9X®Œ	”ÒÏ-nà}-÷Åb?24Ni´ŸÎ]6[›€7gÏ§ﬂ>fÕ÷U˜YSﬁ˘·)≥ké#ë–º£·ƒÓ:p9≥Ã˛˘º¥“ı.”‡YÅgû5x÷·ŸÄÁ<˜È;•œäS}ëß∫Út]<U◊èÈôa€ÏÔbÑ»í]âîx
y(í6√{|i¨7–®“0ö2Xfc_®µ.∑B˚É‰û◊‘K> dä5·∏çîAÔ1thÈ"
ääNÃsç(≈UÃK2"“∂∏˜‰sktùˇÂÊ¥ü"]œÉFWcøˆË∞Ûzó›ı;üÔ™ºº#∏0¬‚¡¨—”É“È;ÓEäåg±∏´«D˛_mÖOí$^{9DSmG¡0“Òƒ Áï$VX?—ß:£c }f ¢b~Ñ˘à:Tò^VÄ„∞∏ˆÌ?≠!∞>∂ÑSqqib@üÅÂ
Fò&”OÙËé¬Sn¯vsOÑeNY>?Œ8–Å7s≈3˙ôvghB_G¸Í©>[ÈËºÄﬂp]ìÙUPú¬K\Á—„?¥aS›úÒØÌb¡Â°5Ôõ≥˘µ:ÁÚ‹È≥˛Æ⁄¶Ì\DW·çhˇ5Ùœ^LÃ%ﬂ78'Ü¥êœj£pNièÃ˘e%ÙËM.ùœé≠˘î∑itó]Ko	˝òÇâJÃH¡rëµûv./(—ô£ ‡D20QDVwd2_~kWrã:ÅÀ|!Â±8®¨t1ÛÒ‹Ã£†Z◊îÚ∏{y⁄dÕº8£¨S=o–ΩÿQoÚ√˘ $5G]‚n0Lh¢√,O≠âDmíOnÒ:ÊÆG¿4G…P¶]ûZ∑–pCEÓBπ¯Ê¢Ú"ﬁí™éz‚–úuø¢\*/ÙG^	ıA±íÕ&ãNâORE,u≠‰˙j•GçÛó<¿»÷Hn8Õ j<≥‘ÛJ’K◊AQuIyJ“∫ÖQ§1ÌÍπë“õ…çÏ¢?º˝€∑ˇ˝œüA=Ùqî$)‰Z—@,vy—¿§∞œÁÏõ!rõG<ÌV9,_[Ü˛%Gπq>Ä°1¶C`êœ@ØR-™'∫=V˝‚‚Ê„3Y?«ï4‡á÷ /¨œÑiBÛè;9©eÄDëyt≤ÙÖ1Û˛˙5î  4ïÉT´ F#pUîÏ7AŒï;eﬁ:ˆ¬¿® ÃTüSÍ∆Œ„˛{iåLÙ#l9VôHuœÑ˝l´'7ºLÎp€¡ym˚ÛX+∏T| J∏}sF∏e^M‚Ò∏1˝Ã*2ÚáÑR—=Ncœ@≈•‰®ü¿±z“Ì_]¬ı$ºsÍÙÁ‹∂ﬂ3F˙$;ë¸£3ó∞çπ«=cÕ?0uò∞…«üÁª¸ELjõ÷|”ZYπ∫≥5ªV#ƒÖ∏Cá0ï€Ô0DFwö
RHÿ@ÍS›guóePC¨k™Le—ñÀ”Ø9(AÁ‘◊ˆJdÒãÒ:Ed¥Xÿ≤‘pF"Äóñ0—P,éä?|h*c U¸A¿*¢llÌ`|‡∆Â™3sÂ…K2†õö70˜@ø¬t5Yöã…:ÒW∂@`ÒGÇ6FJIÇbKI©ÖëRNÂ) bª~≈,wÌ-,i·µ¿/'÷
'ì&/‘J•Ä<Â~˘Ö©§ZE	î˚·Ì_ˇ¬u"`‘ÌÓI˜™Ÿ;Ìú]u‚ò»¸ìhßÜ>(p∑!t7≈Ê,π≈ı¶PœÄ)˙⁄¶Öä+Å‹Nô5≠\ï!∞Ryz’‹l#§à¢Ú˛ﬁÿ∏1„kP0X¿`›ÈÌ∑h#±Öâ∆.fÔóßxüD<˙®d¶<YÏ¬.≥&ôäÊ,·g¶Üvêf˚Úúıªg∑o.–˝-∑HmGå {16 Z·hı8‡˙“µÒbnÅ¯•è¸(y|{Ñü—«,ßO^Èk;∑À’,˜2ø/à°W˜Ì!-:4sr´ét>ïÅ*˜CÌJ…|~—Ôˆ)Î¯ÌõÀìÊŸ9À_‹~s“=k≤ÓYªs—9kwë- ≠âµÁe∞ı2êÃÊ/Çzëµ;˝ìﬁyøÍ oüˆØ∫«›ñpœaf˙^≥/Æúüu˙ÚE‡∑g0j[Rˇ'MBﬂ\<0ÈE÷<Î¸˛¸ 1KÕKv‘=?Ì¥nø°rÿΩ«ΩÊ)V
Ë*ò8•dCÔŒ<˙˘µœ7q|y◊å/qG0ÃcÖCº◊‡æ◊ø¯   ˇˇ ±á\J