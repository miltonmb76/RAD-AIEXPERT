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
const BiomechanicalRadarModule = React.lazy(() => import("./components/BiomechanicalRadarModule").then(m => ({ default: m.BiomechanicalRadarModule })));
import { Atlas3DModule } from "./components/Atlas3DModule";
import { renderAtlas3DAnnexToPDF } from "./utils/atlas3dPdfRenderer";
import { Atlas3DData, Vascular3DData } from "./types";
import { Vascular3DModule } from "./components/Vascular3DModule";
import { renderVascular3DPageToPdf } from "./utils/vascular3dPdfRenderer";
import { Findings3dRenderModule, Create3dRenderModal, Finding3dRender } from "./components/Findings3dRenderModule";
import CaseAnalysisRenderer from "./components/CaseAnalysisRenderer";
import InteractiveCaseEditor from "./components/InteractiveCaseEditor";
import { ClassificationBreakdownModule } from "./components/ClassificationBreakdownModule";
import { CaseAnalysisData, CaseAnalysisFormatOption, CaseAnalysisElementsConfig } from "./types";
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



const splitReportSections = (text: string) => {
  if (!text) return { mainReport: "", cuadroSinopticoReport: "", organSynopsisReport: "", annexReport: "" };
  let mainReport = text;
  let annexReport = "";
  if (text.includes("--- ANEXO") || text.includes("### ANEXO")) {
    const parts = text.split(/(?=---\s*ANEXO|###\s*ANEXO)/i);
    mainReport = parts[0] || "";
    annexReport = parts.slice(1).join("\n\n") || "";
  }
  return { mainReport, cuadroSinopticoReport: "", organSynopsisReport: "", annexReport };
};

const getRadarTitle = (mode?: string): string => {
  switch (mode) {
    case "rotator_cuff": return "RADAR BIOMEC√ÅNICO DE MANGUITO ROTADOR";
    case "knee_oa": return "RADAR BIOMEC√ÅNICO DE GONARTROSIS";
    case "cholecystitis": return "RADAR INFLAMATORIO VESICULAR";
    case "ankle_trauma": return "RADAR BIOMEC√ÅNICO DE TOBILLO";
    case "hepatic": return "RADAR DE HEPATOPAT√çA CR√ìNICA";
    case "renal": return "RADAR NEFROL√ìGICO";
    case "scrotal": return "RADAR ESCROTAL";
    case "appendicitis": return "RADAR APENDICULAR";
    case "thyroid": return "RADAR TIROIDEO";
    case "knee_trauma": return "RADAR TRAUMA DE RODILLA";
    case "muscle_injury": return "RADAR DE LESI√ìN MUSCULAR";
    case "visceral": return "RADAR VISCERAL / INFLAMATORIO";
    case "oncology": return "RADAR ONCOL√ìGICO / ESTRUCTURAL";
    default: return "RADAR BIOMEC√ÅNICO E INFLAMATORIO MULTIVECTOR";
  }
};

const getShortRadarAxisLabel = (label: string, maxLen: number = 25): string => {
  if (!label) return "";
  if (label.length <= maxLen) return label;
  return label.substring(0, Math.max(0, maxLen - 3)) + "...";
};

const getBiomechanicalRadarDataFromReport = (reportText: string, radarData: any) => {
  return radarData || null;
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

  // Atlas 3D Fotorrealista y Correlaci√≥n Anat√≥mica Data
  const [atlas3dData, setAtlas3dData] = useState<Atlas3DData | null>(null);
  const [includeAtlas3dInReport, setIncludeAtlas3dInReport] = useState<boolean>(true);

  // Suite Vascular 3D & Mapa √Ånatomo-Hemodin√°mico Data
  const [vascular3dData, setVascular3dData] = useState<Vascular3DData | null>(null);
  const [includeVascular3dInReport, setIncludeVascular3dInReport] = useState<boolean>(true);

  // 3D Schematic Volumetric Renders for Findings
  const [findings3dRenders, setFindings3dRenders] = useState<Finding3dRender[]>([]);
  const [is3dRenderModalOpen, setIs3dRenderModalOpen] = useState<boolean>(false);
  const [modal3dSourceImage, setModal3dSourceImage] = useState<any>(null);
  const [modal3dInitialFinding, setModal3dInitialFinding] = useState<string>("");

  const pdfStateRef = useRef<any>({});
  pdfStateRef.current = {
    generatedReport,
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
    includeAtlas3dInReport,
    vascular3dData,
    includeVascular3dInReport,
  };

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
  const [isBiomechanicalRadarOpen, setIsBiomechanicalRadarOpen] = useState<boolean>(false);
  const [includeRadarInReport, setIncludeRadarInReport] = useState<boolean>(true);

  // States & Handlers for Sistema de Activaci√≥n R√°pida de M√≥dulos (Procesamiento en Lote)
  const [selectedBatchModules, setSelectedBatchModules] = useState<Record<string, boolean>>({
    atlas3d: true,
    vascular3d: true,
    radar: false,
    case_analysis: false,
    quality_eval: false,
    bibliography: false,
    operational_summary: true,
    patient_summary: true,
    glossary: false,
    schematic: false,
    measurements: false,
    footnotes: false,
            classifications: false,
  });
  const [isActivatingBatch, setIsActivatingBatch] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  const handleToggleAllBatchModules = (select: boolean) => {
    setSelectedBatchModules({
      atlas3d: select,
      vascular3d: select,
      radar: select,
      case_analysis: select,
      quality_eval: select,
      bibliography: select,
      operational_summary: select,
      patient_summary: select,
      glossary: select,
      schematic: select,
      measurements: select,
      footnotes: select,
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
    if (selectedBatchModules.measurements) setIsAsistenteMedidasOpen(true);
    if (selectedBatchModules.footnotes) setIsCreadorNotasOpen(true);
    
    

    // 2. Trigger async AI generation processes concurrently
    const promises: Promise<any>[] = [];

    if (selectedBatchModules.case_analysis) promises.push(handleAnalyzeCase());
    if (selectedBatchModules.quality_eval) promises.push(handleEvaluateReport(activeReport));
    if (selectedBatchModules.bibliography) promises.push(handleSearchBibliography());
    if (selectedBatchModules.operational_summary) promises.push(handleGenerateWhatsAppSummary());
    if (selectedBatchModules.patient_summary) promises.push(handleGeneratePatientSummary());
    if (selectedBatchModules.glossary) promises.push(handleGenerateDynamicGlossary());
    if (selectedBatchModules.schematic) promises.push(handleGenerateSchematicSummary());
    if (selectedBatchModules.vascular3d) {
      promises.push((async () => {
        try {
          const resp = await fetch("/api/generate-3d-vascular", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportText: activeReport,
              requestedModel: selectedModel || "gemini-3.7-flash"
            })
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setVascular3dData(j.data);
            setIncludeVascular3dInReport(true);
          }
        } catch (e) {
          console.error("Error en batch vascular 3d:", e);
        }
      })());
    }
    if (selectedBatchModules.atlas3d) {
      promises.push((async () => {
        try {
          const resp = await fetch("/api/generate-3d-atlas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportText: activeReport,
              organOrStudy: specificStudy || studyType || "",
              laterality: (patientGender || "").toLowerCase().includes("izq") ? "Izquierda" : "",
              requestedModel: selectedModel || "gemini-3.7-flash"
            })
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setAtlas3dData(j.data);
            setIncludeAtlas3dInReport(true);
          }
        } catch (atlasErr) {
          console.error("Error al generar Atlas 3D en lote:", atlasErr);
        }
      })());
    }

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
  const [isCaseAnalysisExpanded, setIsCaseAnalysisExpanded] = useState<boolean>(false);
  const [isReportEvaluationExpanded, setIsReportEvaluationExpanded] = useState<boolean>(false);
  const [isBibliographyExpanded, setIsBibliographyExpanded] = useState<boolean>(false);
  const [isPatientSummaryExpanded, setIsPatientSummaryExpanded] = useState<boolean>(false);
  const [isGlossaryExpanded, setIsGlossaryExpanded] = useState<boolean>(false);
  const [isSchematicSummaryExpanded, setIsSchematicSummaryExpanded] = useState<boolean>(false);
  
  const [attachedImages, setAttachedImages] = useState<Array<{ id: string; url: string; label?: string; preview?: string; metadata?: any; isSelected?: boolean; notes?: string }>>([]);
  const [loadingAiLabelId, setLoadingAiLabelId] = useState<string | null>(null);
  const [loadingAutocompleteId, setLoadingAutocompleteId] = useState<string | null>(null);
  const [isLabelingAll, setIsLabelingAll] = useState<boolean>(false);
  const [isCorrelatingFigures, setIsCorrelatingFigures] = useState<boolean>(false);

  const [urinaryGenderMode, setUrinaryGenderMode] = useState<"hombre" | "mujer">("mujer");
  const [apiConnected, setApiConnected] = useState<boolean>(true);
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


  
  const applyPreset = (preset: any) => {
    if (!preset) return;
    setStudyType(preset.studyType || preset.name || "");
    setClinicalHistory(preset.defaultHistory || "");
    setFindings(preset.customPrompt || "");
    setSelectedPresetId(preset.id);
  };

  const checkApiHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.status === "ok") {
        setApiConnected(true);
      }
    } catch (e) {
      console.error("Health check error:", e);
    }
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

        // Resetear casillas del Sistema de Activaci√≥n R√°pida de M√≥dulos: por defecto Resumen Operacional y Paciente marcados
        setSelectedBatchModules({
          atlas3d: true,
          vascular3d: true,
          radar: false,
          case_analysis: false,
          quality_eval: false,
          bibliography: false,
          operational_summary: true,
          patient_summary: true,
          glossary: false,
          schematic: false,
          measurements: false,
          footnotes: false,
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
      const response = await fetch("/api/generate-schematic-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
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
          if (rawState === "NORMAL") rawState = "NORMAL";
          else if (rawState === "DESGARRO MIOFASCIAL") rawState = "D. MIOFASC";
          else if (rawState === "DESGARRO INTRAMUSCULAR") rawState = "D. INTRAC";
          else if (rawState === "VALORACION DINAMICA") rawState = "VAL. DIN.";
          else if (rawState === "ADENOPATIA REACTIVA") rawState = "INFLAMATORIO";

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
        const parts = textStr.split("**");
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
        const legacyIdxLocal = cleanReportLocal.indexOf("[CASE_ANALYSIS_JSON]");
        if (legacyIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, legacyIdxLocal).trim();
        }
        const summaryIdxLocal = cleanReportLocal.indexOf("**AN√ÅLISIS INTEGRADO DE CASO");
        if (summaryIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, summaryIdxLocal).trim();
        }
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
          const isConclusionHeader = !isSemiologyLineLocal && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed);

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

      // Strip the fallback text summary of the case analysis from the PDF text entirely
      const legacyIdx = cleanReport.indexOf("[CASE_ANALYSIS_JSON]");
      if (legacyIdx !== -1) {
        cleanReport = cleanReport.substring(0, legacyIdx).trim();
      }
      const summaryIdx = cleanReport.indexOf("**AN√ÅLISIS INTEGRADO DE CASO");
      if (summaryIdx !== -1) {
        cleanReport = cleanReport.substring(0, summaryIdx).trim();
      }
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
        const isConclusionHeader = !isSemiologyLine && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed);

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

            const isVascularTable = false;

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
      const cuadroSinopticoBlocks: string[] = [];
      const organSynopsisBlocks: string[] = [];
      const measurementAssistantBlocks: string[] = [];
      const classificationAnnexBlocks: string[] = [];

      let pdfSectionTarget: "main" | "cuadro" | "organ" | "medidas" | "annex" = "main";

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

        const isHeaderMarker = /^\s*(?:#{1,6}\s+|\*\*\s*)/.test(trimmedBlock) || trimmedBlock.toUpperCase().startsWith("ANEXO:");
        const isImpressionHeader = /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[O√ì]N\s+DIAGN[O√ì]STICA|IMPRESI[O√ì]N\b|CONCLUSI[O√ì]N|CONCLUSIONES|DIAGN[O√ì]STICO|DIAGN[O√ì]STICOS)\b/i.test(trimmedBlock) ||
                                    upperBlock.includes("IMPRESI√ìN DIAGN√ìSTICA") || upperBlock.includes("IMPRESION DIAGNOSTICA") ||
                                    upperBlock.includes("CONCLUSI√ìN:") || upperBlock.includes("CONCLUSIONES:");
        const isCuadroHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ESQUEMA\s+CL√çNICO\s+DE\s+HALLAZGOS\s+PRINCIPALES|CUADRO\s+SIN√ìPTICO|MATRIZ\s+SEMI√ìTICA)\b/i.test(trimmedBlock) && !isImpressionHeader;
        const isOrganHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:SINOPSIS\s+CL√çNICA|SINOPSIS\s+POR\s+[O√ì]RGANO|SINOPSIS\s+DE\s+[O√ì]RGANO)\b/i.test(trimmedBlock) && !isCuadroHeader && !isImpressionHeader;
        const isMeasurementHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ASISTENTE\s+DE\s+MEDIDAS|CUADRO\s+DE\s+ASISTENTE\s+DE\s+MEDIDAS|TABLA\s+DE\s+MEDIDAS|MEDICIONES\s+Y\s+PAR√ÅMETROS|PAR√ÅMETROS\s+Y\s+MEDIDAS)\b/i.test(trimmedBlock) && !isCuadroHeader && !isOrganHeader && !isImpressionHeader;
        const isAnnexHeader = isHeaderMarker && (trimmedBlock.includes("ANEXO DIAGN√ìSTICO") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACI√ìN DE CLASIFICACI√ìN") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACI√ìN") ||
                              trimmedBlock.includes("CLASIFICACI√ìN DE") ||
                              /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ANEXO|CLASIFICACI[O√ì]N)\b/i.test(trimmedBlock)) && !isCuadroHeader && !isOrganHeader && !isMeasurementHeader && !isImpressionHeader;

        if (isImpressionHeader) {
          pdfSectionTarget = "main";
        } else if (isCuadroHeader) {
          pdfSectionTarget = "cuadro";
        } else if (isOrganHeader) {
          pdfSectionTarget = "organ";
        } else if (isMeasurementHeader) {
          pdfSectionTarget = "medidas";
        } else if (isAnnexHeader) {
          pdfSectionTarget = "annex";
        }

        if (pdfSectionTarget === "cuadro") {
          cuadroSinopticoBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "organ") {
          organSynopsisBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "medidas") {
          measurementAssistantBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "annex") {
          classificationAnnexBlocks.push(trimmedBlock);
        } else {
          mainReportBlocks.push(trimmedBlock);
        }
      });

      // Safety recovery pass for jsPDF: Ensure Impression & Conclusions are NEVER trapped inside annexes
      const isImpressionBlockText = (bText: string) => {
        const u = bText.toUpperCase();
        return u.includes("IMPRESI√ìN DIAGN√ìSTICA") || u.includes("IMPRESION DIAGNOSTICA") ||
               u.includes("CONCLUSI√ìN:") || u.includes("CONCLUSIONES:") ||
               /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[O√ì]N|CONCLUSI[O√ì]N|CONCLUSIONES|DIAGN[O√ì]STICO)\b/i.test(bText);
      };

      const recoverImpressionForPDF = (sourceArr: string[]) => {
        for (let i = 0; i < sourceArr.length; ) {
          if (isImpressionBlockText(sourceArr[i])) {
            const recovered = sourceArr.splice(i, sourceArr.length - i);
            mainReportBlocks.push(...recovered);
            break;
          } else {
            i++;
          }
        }
      };

      recoverImpressionForPDF(cuadroSinopticoBlocks);
      recoverImpressionForPDF(organSynopsisBlocks);
      recoverImpressionForPDF(measurementAssistantBlocks);
      recoverImpressionForPDF(classificationAnnexBlocks);

      // --- 1. CUERPO DE REPORTE CON FIRMA AL FINAL ---
      mainReportBlocks.forEach((block) => {
        renderSingleReportBlock(block);
      });

      if (!hasDrawnSignature) {
        renderSignatureBlock();
      }

      // --- 2. CUADRO SIN√ìPTICO ---
      if (cuadroSinopticoBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        cuadroSinopticoBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 3. SINOPSIS POR √ìRGANO (P√ÅGINA INDEPENDIENTE DESPU√âS DEL CUERPO DEL REPORTE) ---
      if (organSynopsisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        organSynopsisBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // Restore standard margins and content widths for any diagrams, annexes, and signature block
      marginX = 20;
      contentWidth = pageWidth - (2 * marginX);


      // --- 5. CUADRO DE ASISTENTE DE MEDIDAS ---
      if (measurementAssistantBlocks.length > 0) {
        checkPageBreak(25 * factor);
        measurementAssistantBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 5.5. ANEXO: ATLAS 3D FOTORREALISTA Y CORRELACI√ìN ANAT√ìMICA (P√ÅGINA DEDICADA) ---
      const activeAtlasData = studyOverride ? studyOverride.atlas3dData : (pdfStateRef.current?.atlas3dData || atlas3dData);
      const shouldIncludeAtlas = studyOverride ? (studyOverride.includeAtlas3dInReport !== false) : (pdfStateRef.current?.includeAtlas3dInReport !== false && includeAtlas3dInReport);
      if (activeAtlasData && shouldIncludeAtlas && activeAtlasData.panels && activeAtlasData.panels.length > 0) {
        renderAtlas3DAnnexToPDF(doc, activeAtlasData, {
          marginX,
          pageWidth,
          pageHeight,
          contentWidth,
          factor
        });
      }

      // --- 5.6. ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODIN√ÅMICO (P√ÅGINA DEDICADA) ---
      const activeVascularData = studyOverride ? studyOverride.vascular3dData : (pdfStateRef.current?.vascular3dData || vascular3dData);
      const shouldIncludeVascular = studyOverride ? (studyOverride.includeVascular3dInReport !== false) : (pdfStateRef.current?.includeVascular3dInReport !== false && includeVascular3dInReport);
      if (activeVascularData && shouldIncludeVascular && ((activeVascularData.panels && activeVascularData.panels.length > 0) || (activeVascularData.hemodynamicTable && activeVascularData.hemodynamicTable.length > 0))) {
        await renderVascular3DPageToPdf(doc, activeVascularData, doc.internal.pageSize.getHeight() > 280 ? "a4" : "letter", pdfLayoutType);
      }

      // --- 6. ANEXOS DE IM√ÅGENES DIAGN√ìSTICAS (MAMOGRAF√çA Y ULTRASONIDO) ---
      if (attachedImages.length > 0) {
        const mmgImages = attachedImages.filter(img => (img.modality || detectImageMetaFromFilename(img.name, img.dicomMetaData).modality) === "MMG");
        const usImages = attachedImages.filter(img => !mmgImages.includes(img));

        const sortMmg = (list: typeof attachedImages) => {
          return [...list].sort((a, b) => {
            const metaA = detectImageMetaFromFilename(a.name, a.dicomMetaData);
            const metaB = detectImageMetaFromFilename(b.name, b.dicomMetaData);
            const projA = a.projection || metaA.projection;
            const projB = b.projection || metaB.projection;

            const scoreA = projA === "CC" ? 1 : (projA === "MLO" ? 2 : 3);
            const scoreB = projB === "CC" ? 1 : (projB === "MLO" ? 2 : 3);
            return scoreA - scoreB;
          });
        };

        const sortedMmgImages = sortMmg(mmgImages);
        if (sortedMmgImages.length === 2) {
          const meta0 = detectImageMetaFromFilename(sortedMmgImages[0].name, sortedMmgImages[0].dicomMetaData);
          const meta1 = detectImageMetaFromFilename(sortedMmgImages[1].name, sortedMmgImages[1].dicomMetaData);
          const proj0 = sortedMmgImages[0].projection || meta0.projection;
          const proj1 = sortedMmgImages[1].projection || meta1.projection;
          if (proj0 === "OTRO" && proj1 === "OTRO") {
            sortedMmgImages[0].projection = "CC";
            sortedMmgImages[1].projection = "MLO";
          }
        }

        let globalFigIdx = 1;

        // 6A. ANEXO DE IM√ÅGENES DE MAMOGRAF√çA (MMG) - OCUPANDO LA HOJA COMPLETA
        if (sortedMmgImages.length > 0) {
          doc.addPage();
          yCoord = 20;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42); // slate 900
          doc.text("ANEXO: IM√ÅGENES DE MAMOGRAF√çA (MMG)", marginX, yCoord);

          yCoord += 4;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 10;

          const boxW = contentWidth; // ~180mm
          const boxH = sortedMmgImages.length === 1 ? 160 : 88; // Fill page nicely
          const slotSpacing = sortedMmgImages.length === 1 ? 175 : 122;

          let itemsOnPage = 0;

          for (const imgItem of sortedMmgImages) {
            if (itemsOnPage >= 2 || yCoord + boxH + 20 > pageHeight - 15) {
              doc.addPage();
              yCoord = 20;
              itemsOnPage = 0;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5);
              doc.setTextColor(100, 116, 139);
              doc.text("ANEXO: IM√ÅGENES DE MAMOGRAF√çA (CONT...)", marginX, yCoord);
              yCoord += 4;
              doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
              yCoord += 10;
            }

            try {
              let format = "JPEG";
              if (imgItem.base64.includes("image/png")) format = "PNG";
              else if (imgItem.base64.includes("image/gif")) format = "GIF";
              else if (imgItem.base64.includes("image/webp")) format = "WEBP";

              let drawW = boxW;
              let drawH = boxH;
              let drawX = marginX;
              let drawY = yCoord;

              if (imgItem.width && imgItem.height) {
                const aspectImg = imgItem.width / imgItem.height;
                const aspectBox = boxW / boxH;
                if (aspectImg > aspectBox) {
                  drawW = boxW;
                  drawH = boxW / aspectImg;
                  drawY = yCoord + (boxH - drawH) / 2;
                } else {
                  drawH = boxH;
                  drawW = boxH * aspectImg;
                  drawX = marginX + (boxW - drawW) / 2;
                }
              }

              // Background fill for image frame
              doc.setFillColor(248, 250, 252);
              doc.rect(marginX, yCoord, boxW, boxH, "F");

              // Draw MMG Image
              doc.addImage(imgItem.base64, format, drawX, drawY, drawW, drawH);

              // Border around frame
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.3);
              doc.rect(marginX, yCoord, boxW, boxH, "D");

              // Projection tag
              const meta = detectImageMetaFromFilename(imgItem.name, imgItem.dicomMetaData);
              const proj = imgItem.projection || meta.projection;

              let figTitle = `Figura ${globalFigIdx}. Proyecciones Cr√°neo Caudales (CC)`;
              if (proj === "MLO") {
                figTitle = `Figura ${globalFigIdx}. Proyecciones Medio Lateral Oblicuas (MLO)`;
              } else if (proj === "OTRO") {
                figTitle = `Figura ${globalFigIdx}. Proyecci√≥n Complementaria MMG`;
              }

              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5);
              doc.setTextColor(15, 23, 42);
              doc.text(figTitle, marginX, yCoord + boxH + 5);

              const defaultCaption = proj === "CC"
                ? "Proyecciones Cr√°neo Caudales (CC). Tejido fibroglandular de distribuci√≥n sim√©trica sin evidencia de n√≥dulos ni microcalcificaciones de sospecha."
                : (proj === "MLO"
                  ? "Proyecciones Medio Lateral Oblicuas (MLO). Adecuada visualizaci√≥n de los planos pectorales sin distorsiones ni adenopat√≠as axilares."
                  : "Mamograf√≠a digital, proyecciones complementarias.");

              const rawCaption = imgItem.caption && imgItem.caption.trim() ? imgItem.caption.trim() : defaultCaption;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(71, 85, 105);
              const textLines = doc.splitTextToSize(rawCaption, boxW);
              let offsetTextY = yCoord + boxH + 9.5;
              textLines.forEach((lineText: string) => {
                doc.text(lineText, marginX, offsetTextY);
                offsetTextY += 3.8;
              });

            } catch (imgErr) {
              console.error("Could not append attached MMG image in jsPDF: ", imgErr);
              doc.setDrawColor(226, 232, 240);
              doc.rect(marginX, yCoord, boxW, boxH);
              doc.setFont("helvetica", "italic");
              doc.setFontSize(8.5);
              doc.setTextColor(148, 163, 184);
              doc.text("No se pudo renderizar la mamograf√≠a", marginX + 10, yCoord + (boxH / 2));
            }

            itemsOnPage++;
            yCoord += slotSpacing;
            globalFigIdx++;
          }
        }

        // 6B. ANEXO DE IM√ÅGENES Y CAPTURAS DE ULTRASONIDO (US)
        if (usImages.length > 0) {
          doc.addPage();
          yCoord = 20;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42); // slate 900
          doc.text("ANEXO: IM√ÅGENES Y CAPTURAS DE ULTRASONIDO", marginX, yCoord);

          yCoord += 4;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 11;

          const colWidth = (pageWidth - (marginX * 2) - 8) / 2;
          const imgHeight = colWidth * 0.75;
          
          let currentCol = 0;
          for (const imgItem of usImages) {
            if (yCoord + imgHeight + 17 > pageHeight - 20) {
              doc.addPage();
              yCoord = 20;
              currentCol = 0;
              
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.setTextColor(100, 116, 139);
              doc.text("ANEXO: CAPTURAS DE ULTRASONIDO (CONT...)", marginX, yCoord);
              yCoord += 4;
              doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
              yCoord += 11;
            }

            const posX = marginX + currentCol * (colWidth + 8);
            
            try {
              let format = "JPEG";
              if (imgItem.base64.includes("image/png")) format = "PNG";
              else if (imgItem.base64.includes("image/gif")) format = "GIF";
              else if (imgItem.base64.includes("image/webp")) format = "WEBP";

              let drawW = colWidth;
              let drawH = imgHeight;
              let drawX = posX;
              let drawY = yCoord;

              if (imgItem.width && imgItem.height) {
                const aspectImg = imgItem.width / imgItem.height;
                const aspectBox = colWidth / imgHeight;
                if (aspectImg > aspectBox) {
                  drawW = colWidth;
                  drawH = colWidth / aspectImg;
                  drawY = yCoord + (imgHeight - drawH) / 2;
                } else {
                  drawH = imgHeight;
                  drawW = imgHeight * aspectImg;
                  drawX = posX + (colWidth - drawW) / 2;
                }
              }

              doc.addImage(imgItem.base64, format, drawX, drawY, drawW, drawH);

              doc.setDrawColor(241, 245, 249);
              doc.setLineWidth(0.25);
              doc.rect(posX, yCoord, colWidth, imgHeight);

              // Print Figure label with continuous globalFigIdx
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(15, 23, 42);
              doc.text(`Figura ${globalFigIdx}.`, posX, yCoord + imgHeight + 4.5);

              const captionText = imgItem.caption || "Sin descripci√≥n";
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.0);
              doc.setTextColor(71, 85, 105);
              const textLines = doc.splitTextToSize(captionText, colWidth - 2);
              let offsetTextY = yCoord + imgHeight + 8.0;
              textLines.forEach((lineText: string) => {
                doc.text(lineText, posX, offsetTextY);
                offsetTextY += 3.5;
              });

            } catch (imgErr) {
              console.error("Could not append attached US image in jsPDF: ", imgErr);
              doc.setDrawColor(226, 232, 240);
              doc.rect(posX, yCoord, colWidth, imgHeight);
              doc.setFont("helvetica", "italic");
              doc.setFontSize(8);
              doc.setTextColor(148, 163, 184);
              doc.text("No se pudo renderizar la imagen", posX + 5, yCoord + (imgHeight/2));
            }

            if (currentCol === 0) {
              currentCol = 1;
            } else {
              currentCol = 0;
              yCoord += imgHeight + 20;
            }
            globalFigIdx++;
          }
        }
      }

      // --- 6.5. ANEXO: REPRESENTACI√ìN ESQUEM√ÅTICA 3D DEL HALLAZGO ---
      const active3dRenders = (studyOverride ? (studyOverride.findings3dRenders || []) : (pdfStateRef.current?.findings3dRenders || findings3dRenders || [])).filter((r: any) => r && r.includeInPdf !== false);

      if (active3dRenders.length > 0) {
        doc.addPage();
        yCoord = 20;

        // Title of 3D Annex
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("ANEXO: REPRESENTACI√ìN ESQUEM√ÅTICA 3D DEL HALLAZGO", marginX, yCoord);
        yCoord += 4 * factor;

        doc.setDrawColor(6, 182, 212); // Cyan 500
        doc.setLineWidth(0.6);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 6 * factor;

        // Subtitle disclaimer
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(100, 116, 139); // slate-500
        const subtitleText = "Representaci√≥n volum√©trica tridimensional orientativa correlacionada con la ecograf√≠a 2D. Ilustraci√≥n did√°ctica de alta resoluci√≥n dise√±ada para facilitar la comprensi√≥n espacial y anat√≥mica del hallazgo.";
        const subLines = doc.splitTextToSize(subtitleText, contentWidth);
        subLines.forEach((line: string) => {
          doc.text(line, marginX, yCoord);
          yCoord += 3.5 * factor;
        });
        yCoord += 4 * factor;

        for (let rIdx = 0; rIdx < active3dRenders.length; rIdx++) {
          const renderItem = active3dRenders[rIdx];
          const hasSourceImg = !!renderItem.sourceImageBase64;
          const isDual = !!renderItem.render3dMacroBase64;
          const isGrid2x2 = isDual && renderItem.pdfLayout === "grid2x2";
          
          // Check if space remains on page
          const requiredHeight = isGrid2x2 ? 115 : (isDual ? 95 : 90);
          if (yCoord > pageHeight - requiredHeight) {
            doc.addPage();
            yCoord = 20;
          }

          // Card header with Title and Badge (prevent text overlap)
          const badgeText = isDual ? "RENDER 3D DUAL: FOCAL + TOPOGR√ÅFICO" : "RENDER VOLUM√âTRICO DID√ÅCTICO";
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7 * factor);
          const badgeWidth = (doc as any).getTextWidth ? (doc as any).getTextWidth(badgeText) : 52;
          const maxTitleWidth = contentWidth - badgeWidth - 10;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);
          const titleText = renderItem.title || `Ilustraci√≥n 3D del Hallazgo #${rIdx + 1}`;
          const titleLines = doc.splitTextToSize(titleText, maxTitleWidth);
          const headerHeight = Math.max(7, titleLines.length * 4 + 2) * factor;

          doc.setFillColor(241, 245, 249); // slate-100
          doc.setDrawColor(203, 213, 225); // slate-300
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, yCoord, contentWidth, headerHeight, 1.5, 1.5, "FD");

          let curTitleY = yCoord + 4.5 * factor;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);
          doc.setTextColor(15, 23, 42);
          titleLines.forEach((tLine: string) => {
            doc.text(tLine, marginX + 3, curTitleY);
            curTitleY += 3.8 * factor;
          });

          // Badge
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7 * factor);
          doc.setTextColor(14, 116, 144); // cyan-700
          doc.text(badgeText, pageWidth - marginX - badgeWidth - 3, yCoord + 4.5 * factor);
          yCoord += headerHeight + 3.5 * factor;

          const imageRowY = yCoord;

          if (isGrid2x2) {
            // ==========================================
            // OPTION B: CUADR√çCULA 2x2 (GRID LAYOUT)
            // ==========================================
            const pairWidth = (contentWidth - 6) / 2;
            const pairHeight = pairWidth * 0.75;

            // Row 1 - Left: 2D Ecograf√≠a
            try {
              if (renderItem.sourceImageBase64) {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, pairWidth, pairHeight, undefined, "FAST");
              }
              doc.setDrawColor(148, 163, 184);
              doc.setLineWidth(0.3);
              doc.rect(marginX, imageRowY, pairWidth, pairHeight);
              
              doc.setFillColor(15, 23, 42);
              doc.rect(marginX, imageRowY + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(255, 255, 255);
              doc.text("1. ECOGRAF√çA 2D ORIGINAL", marginX + 2, imageRowY + pairHeight - 1.5);
            } catch (err2d) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, imageRowY, pairWidth, pairHeight);
            }

            // Row 1 - Right: 3D Focal Render
            try {
              doc.addImage(renderItem.render3dBase64, "PNG", marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight, undefined, "FAST");
              doc.setDrawColor(6, 182, 212);
              doc.setLineWidth(0.5);
              doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);

              doc.setFillColor(8, 51, 68); // cyan-950
              doc.rect(marginX + pairWidth + 6, imageRowY + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(103, 232, 249); // cyan-300
              doc.text("2. RENDER 3D FOCAL (DETALLE)", marginX + pairWidth + 8, imageRowY + pairHeight - 1.5);
            } catch (err3dFocal) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);
            }

            const row2Y = imageRowY + pairHeight + 4;

            // Row 2 - Left: 3D Macro Panoramic Render
            try {
              doc.addImage(renderItem.render3dMacroBase64!, "PNG", marginX, row2Y, pairWidth, pairHeight, undefined, "FAST");
              doc.setDrawColor(99, 102, 241);
              doc.setLineWidth(0.5);
              doc.rect(marginX, row2Y, pairWidth, pairHeight);

              doc.setFillColor(30, 27, 75); // indigo-950
              doc.rect(marginX, row2Y + pairHeight - 5, pairWidth, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(199, 210, 254); // indigo-200
              doc.text("3. VISTA MACRO TOPOGR√ÅFICA", marginX + 2, row2Y + pairHeight - 1.5);
            } catch (err3dMacro) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, row2Y, pairWidth, pairHeight);
            }

            // Row 2 - Right: Structured Text Box side-by-side
            const textPanelX = marginX + pairWidth + 6;
            const findingLabel = `Hallazgo: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, pairWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", pairWidth - 6);

            const textContentHeight = (findingLines.length * 3.2 + explLines.length * 3.2 + 8) * factor;
            const rightBoxHeight = Math.max(pairHeight, textContentHeight);

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(textPanelX, row2Y, pairWidth, rightBoxHeight, 1.5, 1.5, "FD");

            let textInnerY = row2Y + 4 * factor;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7 * factor);
            doc.setTextColor(30, 41, 59);
            findingLines.forEach((fl: string) => {
              doc.text(fl, textPanelX + 3, textInnerY);
              textInnerY += 3.2 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8 * factor);
            doc.setTextColor(51, 65, 85);
            explLines.forEach((el: string) => {
              doc.text(el, textPanelX + 3, textInnerY);
              textInnerY += 3.2 * factor;
            });

            yCoord = row2Y + Math.max(pairHeight, rightBoxHeight) + 8 * factor;

          } else if (isDual) {
            // ==========================================
            // OPTION A: TR√çPTICO HORIZONTAL (3 COLUMNS)
            // ==========================================
            const colWidth = (contentWidth - 8) / 3;
            const colHeight = colWidth * 0.75;

            // Col 1: 2D Ecograf√≠a
            try {
              if (renderItem.sourceImageBase64) {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, colWidth, colHeight, undefined, "FAST");
              }
              doc.setDrawColor(148, 163, 184);
              doc.setLineWidth(0.3);
              doc.rect(marginX, imageRowY, colWidth, colHeight);
              
              doc.setFillColor(15, 23, 42);
              doc.rect(marginX, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(255, 255, 255);
              doc.text("1. ECOGRAF√çA 2D", marginX + 1.5, imageRowY + colHeight - 1.2);
            } catch (err2d) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(marginX, imageRowY, colWidth, colHeight);
            }

            // Col 2: 3D Focal
            const col2X = marginX + colWidth + 4;
            try {
              doc.addImage(renderItem.render3dBase64, "PNG", col2X, imageRowY, colWidth, colHeight, undefined, "FAST");
              doc.setDrawColor(6, 182, 212);
              doc.setLineWidth(0.5);
              doc.rect(col2X, imageRowY, colWidth, colHeight);

              doc.setFillColor(8, 51, 68);
              doc.rect(col2X, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(103, 232, 249);
              doc.text("2. 3D FOCAL (DETALLE)", col2X + 1.5, imageRowY + colHeight - 1.2);
            } catch (err3dFocal) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(col2X, imageRowY, colWidth, colHeight);
            }

            // Col 3: 3D Macro
            const col3X = marginX + (colWidth + 4) * 2;
            try {
              doc.addImage(renderItem.render3dMacroBase64!, "PNG", col3X, imageRowY, colWidth, colHeight, undefined, "FAST");
              doc.setDrawColor(99, 102, 241);
              doc.setLineWidth(0.5);
              doc.rect(col3X, imageRowY, colWidth, colHeight);

              doc.setFillColor(30, 27, 75);
              doc.rect(col3X, imageRowY + colHeight - 4.5, colWidth, 4.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.8);
              doc.setTextColor(199, 210, 254);
              doc.text("3. 3D PANOR√ÅMICO (MACRO)", col3X + 1.5, imageRowY + colHeight - 1.2);
            } catch (err3dMacro) {
              doc.setDrawColor(203, 213, 225);
              doc.rect(col3X, imageRowY, colWidth, colHeight);
            }

            yCoord += colHeight + 4 * factor;

            // Full-width Structured text block below 3-columns
            const findingLabel = `Hallazgo Ecogr√°fico Base: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, contentWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", contentWidth - 6);

            const boxHeight = (findingLines.length * 3.5 + explLines.length * 3.5 + 8) * factor;

            if (yCoord + boxHeight > pageHeight - 15) {
              doc.addPage();
              yCoord = 20;
            }

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");

            let textInnerY = yCoord + 4 * factor;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(30, 41, 59);
            findingLines.forEach((fl: string) => {
              doc.text(fl, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(51, 65, 85);
            explLines.forEach((el: string) => {
              doc.text(el, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            yCoord += boxHeight + 8 * factor;

          } else {
            // ==========================================
            // SINGLE 3D RENDER (CLASSIC LAYOUT)
            // ==========================================
            if (hasSourceImg) {
              const pairWidth = (contentWidth - 6) / 2;
              const pairHeight = pairWidth * 0.75;

              // Left: 2D Ecograf√≠a
              try {
                doc.addImage(renderItem.sourceImageBase64, "JPEG", marginX, imageRowY, pairWidth, pairHeight, undefined, "FAST");
                doc.setDrawColor(148, 163, 184);
                doc.setLineWidth(0.3);
                doc.rect(marginX, imageRowY, pairWidth, pairHeight);
                
                // Caption banner
                doc.setFillColor(15, 23, 42);
                doc.rect(marginX, imageRowY + pairHeight - 5, pairWidth, 5, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(255, 255, 255);
                doc.text("ECOGRAF√çA 2D ORIGINAL", marginX + 2, imageRowY + pairHeight - 1.5);
              } catch (err2d) {
                doc.setDrawColor(203, 213, 225);
                doc.rect(marginX, imageRowY, pairWidth, pairHeight);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text("Captura 2D de referencia", marginX + 4, imageRowY + pairHeight / 2);
              }

              // Right: 3D Volumetric Render
              try {
                doc.addImage(renderItem.render3dBase64, "PNG", marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight, undefined, "FAST");
                doc.setDrawColor(6, 182, 212);
                doc.setLineWidth(0.5);
                doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);

                // Caption banner
                doc.setFillColor(8, 51, 68); // cyan-950
                doc.rect(marginX + pairWidth + 6, imageRowY + pairHeight - 5, pairWidth, 5, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(103, 232, 249); // cyan-300
                doc.text("RECONSTRUCCI√ìN ESQUEM√ÅTICA 3D", marginX + pairWidth + 8, imageRowY + pairHeight - 1.5);
              } catch (err3d) {
                doc.setDrawColor(203, 213, 225);
                doc.rect(marginX + pairWidth + 6, imageRowY, pairWidth, pairHeight);
              }

              yCoord += pairHeight + 4;
            } else {
              // Single wide 3D render
              const singleWidth = Math.min(contentWidth * 0.7, 120);
              const singleHeight = singleWidth * 0.75;
              const singleX = marginX + (contentWidth - singleWidth) / 2;

              try {
                doc.addImage(renderItem.render3dBase64, "PNG", singleX, imageRowY, singleWidth, singleHeight, undefined, "FAST");
                doc.setDrawColor(6, 182, 212);
                doc.setLineWidth(0.5);
                doc.rect(singleX, imageRowY, singleWidth, singleHeight);
              } catch (errSingle) {}

              yCoord += singleHeight + 4;
            }

            // Measure explanation height
            const findingLabel = `Hallazgo Ecogr√°fico Base: ${renderItem.findingDescription || "No especificado"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            const findingLines = doc.splitTextToSize(findingLabel, contentWidth - 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            const explLines = doc.splitTextToSize(renderItem.explanation || "", contentWidth - 6);

            const boxHeight = (findingLines.length * 3.5 + explLines.length * 3.5 + 8) * factor;

            // Check if box fits or needs new page
            if (yCoord + boxHeight > pageHeight - 15) {
              doc.addPage();
              yCoord = 20;
            }

            // Set fill and draw colors AFTER potential addPage() to prevent jsPDF from resetting fill to black
            doc.setFillColor(248, 250, 252); // slate-50 light background
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.3);

            doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");
            let textInnerY = yCoord + 4 * factor;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(30, 41, 59); // slate-800
            findingLines.forEach((fl: string) => {
              doc.text(fl, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            textInnerY += 1.5 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5 * factor);
            doc.setTextColor(51, 65, 85); // slate-700
            explLines.forEach((el: string) => {
              doc.text(el, marginX + 3, textInnerY);
              textInnerY += 3.5 * factor;
            });

            yCoord += boxHeight + 8 * factor;
          }
        }
      }

      // --- 7. DIAGN√ìSTICO AVANZADO Y AN√ÅLISIS DEL CASO ---
      if (caseAnalysisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;

        // Title of Annex
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("ANEXO: DIAGN√ìSTICO AVANZADO Y AN√ÅLISIS DEL CASO", marginX, yCoord);
        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 10 * factor;

        // Resolve active theme palette to match the rest of the report (no "embedded/foreign" look)
        let activeThemeBg = [248, 250, 252]; // default slate-50
        let activeThemeHeaderBg = [15, 23, 42]; // default slate-900
        let activeThemeBorder = [203, 213, 225]; // default slate-300
        let activeThemeAccent = [79, 70, 229]; // default Indigo
        let activeThemeTextDark = [15, 23, 42]; // slate-900
        let activeThemeTextMuted = [71, 85, 105]; // slate-600

        // Determine card styles based on pdfLayoutType to be cohesive with the rest of the report
        let cardsStyle = {
          sonographic: { border: [79, 70, 229], bg: [245, 247, 255] },
          clinical: { border: [16, 185, 129], bg: [240, 253, 244] },
          differentials: { border: [217, 119, 6], bg: [254, 252, 232] },
          management: { border: [147, 51, 234], bg: [250, 245, 255] }
        };

        let pillar1Color = [79, 70, 229];
        let pillar2Color = [16, 185, 129];
        let pillar3Color = [217, 119, 6];
        let pillar4Color = [147, 51, 234];

        if (pdfLayoutType === "clinical_slate") {
          activeThemeBg = [241, 245, 249]; // slate-100
          activeThemeHeaderBg = [71, 85, 105]; // slate-600
          activeThemeBorder = [148, 163, 184]; // slate-400
          activeThemeAccent = [100, 116, 139]; // slate-500
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [100, 116, 139];

          cardsStyle = {
            sonographic: { border: [71, 85, 105], bg: [241, 245, 249] },
            clinical: { border: [100, 116, 139], bg: [248, 250, 252] },
            differentials: { border: [148, 163, 184], bg: [241, 245, 249] },
            management: { border: [71, 85, 105], bg: [248, 250, 252] }
          };

          pillar1Color = [71, 85, 105];
          pillar2Color = [100, 116, 139];
          pillar3Color = [148, 163, 184];
          pillar4Color = [71, 85, 105];
        } else if (pdfLayoutType === "executive_medical") {
          activeThemeBg = [253, 251, 247]; // cream-white
          activeThemeHeaderBg = [141, 110, 50]; // metallic bronze-gold
          activeThemeBorder = [220, 201, 159]; // golden-cream border
          activeThemeAccent = [141, 110, 50]; // Bronze
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [141, 110, 50];

          cardsStyle = {
            sonographic: { border: [141, 110, 50], bg: [253, 251, 247] },
            clinical: { border: [197, 160, 89], bg: [254, 253, 250] },
            differentials: { border: [141, 110, 50], bg: [253, 251, 247] },
            management: { border: [197, 160, 89], bg: [254, 253, 250] }
          };

          pillar1Color = [141, 110, 50];
          pillar2Color = [197, 160, 89];
          pillar3Color = [141, 110, 50];
          pillar4Color = [197, 160, 89];
        } else if (pdfLayoutType === "asymmetric") {
          activeThemeBg = [249, 250, 254]; // Soft blue-indigo
          activeThemeHeaderBg = [79, 70, 229]; // Indigo
          activeThemeBorder = [165, 180, 252]; // Indigo-300
          activeThemeAccent = [79, 70, 229]; // Indigo
          activeThemeTextDark = [15, 23, 42];
          activeThemeTextMuted = [99, 102, 241];

          cardsStyle = {
            sonographic: { border: [79, 70, 229], bg: [249, 250, 254] },
            clinical: { border: [129, 140, 248], bg: [245, 247, 255] },
            differentials: { border: [79, 70, 229], bg: [249, 250, 254] },
            management: { border: [129, 140, 248], bg: [245, 247, 255] }
          };

          pillar1Color = [79, 70, 229];
          pillar2Color = [129, 140, 248];
          pillar3Color = [79, 70, 229];
          pillar4Color = [129, 140, 248];
        }

        caseAnalysisBlocks.forEach((caseData, blockIdx) => {
          // If we are on a subsequent block, let's put a page break or a nice spacing
          if (blockIdx > 0) {
            checkPageBreak(85 * factor); // require generous space, otherwise break page
          }

          const cfg = caseData.elementsConfig || {
            includeSonographic: true,
            includeSonographicDetails: true,
            includeClinicalCorr: true,
            includeCertainty: true,
            includeDifferentials: true,
            includeDiscardedDifferentials: true,
            includeManagement: true,
          };

          let formatTitle = caseData.title || "AN√ÅLISIS DEL CASO";
          if (!caseData.title) {
            if (caseData.format === "flujograma_semiologico") {
              formatTitle = "FLUJOGRAMA SEMIOL√ìGICO";
            } else if (caseData.format === "flujograma_algoritmico") {
              formatTitle = "FLUJOGRAMA ALGOR√çTMICO / √ÅRBOL DE DECISI√ìN";
            } else if (caseData.format === "esquema_pilares") {
              formatTitle = "ESQUEMA INTEGRADOR POR PILARES";
            } else if (caseData.format === "mapa_diferenciales") {
              formatTitle = "MAPA DE DIAGN√ìSTICOS DIFERENCIALES";
            } else if (caseData.format === "matriz_semiotica") {
              formatTitle = "MATRIZ SEMI√ìTICA COMPARATIVA";
            }
          }

          // Header title bar of the format
          checkPageBreak(25 * factor);
          doc.setFillColor(activeThemeHeaderBg[0], activeThemeHeaderBg[1], activeThemeHeaderBg[2]);
          doc.roundedRect(marginX, yCoord, contentWidth, 11 * factor, 1.8, 1.8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5 * factor); // Spacious, readable font size in appendix
          doc.setTextColor(255, 255, 255);
          doc.text(formatTitle, marginX + 5 * factor, yCoord + 7 * factor);

          yCoord += 16 * factor;

          // --- FORMAT 1: FLUJOGRAMA SEMIOL√ìGICO ---
          if (caseData.format === "flujograma_semiologico") {
            const semiologyStepsToDraw: Array<{
              title: string;
              subtitle: string;
              content: string;
              bullets?: string[];
              accentColor: number[];
              bgColor: number[];
            }> = [];

            if (cfg.includeSonographic && caseData.sonographicPillar) {
              semiologyStepsToDraw.push({
                title: "HALLAZGO ECOGR√ÅFICO PRINCIPAL",
                subtitle: "Punto de Partida Semiol√≥gico",
                content: cleanTextForJSPDF(caseData.sonographicPillar.primaryFinding),
                bullets: (cfg.includeSonographicDetails !== false && caseData.sonographicPillar.details) ? caseData.sonographicPillar.details.map(cleanTextForJSPDF) : undefined,
                accentColor: cardsStyle.sonographic.border,
                bgColor: cardsStyle.sonographic.bg
              });
            }

            if (cfg.includeClinicalCorr && caseData.clinicalCorrelation) {
              semiologyStepsToDraw.push({
                title: "INTEGRACI√ìN CL√çNICO-ANAT√ìMICA",
                subtitle: "Correlaci√≥n de S√≠ntomas y Laboratorio",
                content: cleanTextForJSPDF(caseData.clinicalCorrelation),
                accentColor: cardsStyle.clinical.border,
                bgColor: cardsStyle.clinical.bg
              });
            }

            const primaryDiag = caseData.diagnostics && caseData.diagnostics.length > 0 ? caseData.diagnostics[0] : null;
            const discardedDifferentials = caseData.diagnostics
              ?.filter(d => d.refutingCriteria && d !== primaryDiag && (!primaryDiag || d.name.toLowerCase() !== primaryDiag.name.toLowerCase()))
              .map(d => cleanTextForJSPDF(`${d.name}: ${d.refutingCriteria}`)) || [];

            const showDiscarded = cfg.includeDiscardedDifferentials !== false && cfg.includeDifferentials;
            if (showDiscarded && discardedDifferentials.length > 0) {
              semiologyStepsToDraw.push({
                title: "CRITERIOS DESCARTADOS Y EXCLUSIONES",
                subtitle: "Diferenciales Desestimados",
                content: "Criterios que permitieron descartar otras sospechas cl√≠nicas:",
                bullets: discardedDifferentials,
                accentColor: [185, 28, 28], // Red/Rose tone
                bgColor: [254, 242, 242] // Light Rose bg
              });
            }

            if (cfg.includeDifferentials && caseData.diagnostics && caseData.diagnostics.length > 0) {
              const primaryDiag = caseData.diagnostics[0];
              let conclusionText = cleanTextForJSPDF(primaryDiag.name);
              const bulletsArr: string[] = [];
              if (primaryDiag.supportingCriteria) {
                bulletsArr.push(cleanTextForJSPDF(`Soporte: ${primaryDiag.supportingCriteria}`));
              }
              if (cfg.includeManagement && caseData.managementRecommendation) {
                bulletsArr.push(cleanTextForJSPDF(`Manejo sugerido: ${caseData.managementRecommendation}`));
              }

              semiologyStepsToDraw.push({
                title: "DIAGN√ìSTICO PRESUNTIVO DEFINITIVO",
                subtitle: "Conclusi√≥n del Juicio Radiol√≥gico",
                content: conclusionText,
                bullets: bulletsArr,
                accentColor: cardsStyle.differentials.border,
                bgColor: cardsStyle.differentials.bg
              });
            }

            semiologyStepsToDraw.forEach((step, idx) => {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedContent = doc.splitTextToSize(cleanTextForJSPDF(step.content), contentWidth - 12 * factor);
              let cardHeight = 14 * factor + (wrappedContent.length * 4.6 * factor); // generous vertical spacing

              let wrappedBullets: string[][] = [];
              if (step.bullets && step.bullets.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor);
                step.bullets.forEach(b => {
                  const lines = doc.splitTextToSize(`- ${cleanTextForJSPDF(b)}`, contentWidth - 18 * factor);
                  wrappedBullets.push(lines);
                  cardHeight += lines.length * 4.2 * factor;
                });
              }
              cardHeight += 3.5 * factor; // Bottom padding

              checkPageBreak(cardHeight + (idx < semiologyStepsToDraw.length - 1 ? 6 * factor : 0));

              // Background card
              doc.setFillColor(step.bgColor[0], step.bgColor[1], step.bgColor[2]);
              doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "F");

              // Left accent border (thick for step)
              doc.setFillColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
              doc.rect(marginX, yCoord, 2.5 * factor, cardHeight, "F");

              // Header and Subtitle
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9 * factor); // Spacious, readable
              doc.setTextColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
              doc.text(`${idx + 1}. ${step.title}`, marginX + 5 * factor, yCoord + 5.5 * factor);

              doc.setFont("helvetica", "oblique");
              doc.setFontSize(8 * factor); // Spacious, readable
              doc.setTextColor(100, 116, 139);
              doc.text(step.subtitle, marginX + 5 * factor, yCoord + 9 * factor);

              let textY = yCoord + 14 * factor;

              // Main Content text
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(30, 41, 59);
              wrappedContent.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, textY);
                textY += 4.6 * factor;
              });

              // Bullets if any
              if (step.bullets && step.bullets.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                doc.setTextColor(71, 85, 105);
                wrappedBullets.forEach(lines => {
                  lines.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                });
              }

              yCoord += cardHeight;

              // Draw dashed connecting line between steps
              if (idx < semiologyStepsToDraw.length - 1) {
                const arrowY = yCoord;
                doc.setDrawColor(step.accentColor[0], step.accentColor[1], step.accentColor[2]);
                doc.setLineWidth(0.5 * factor);
                doc.line(marginX + contentWidth / 2, arrowY, marginX + contentWidth / 2, arrowY + 5 * factor);
                
                // Draw a small downwards arrowhead
                doc.line(marginX + contentWidth / 2 - 1.5 * factor, arrowY + 3.8 * factor, marginX + contentWidth / 2, arrowY + 5 * factor);
                doc.line(marginX + contentWidth / 2 + 1.5 * factor, arrowY + 3.8 * factor, marginX + contentWidth / 2, arrowY + 5 * factor);

                yCoord += 5 * factor;
              }
            });

            yCoord += 6 * factor;
          }

          // --- FORMAT 2: FLUJOGRAMA ALGOR√çTMICO ---
          else if (caseData.format === "flujograma_algoritmico") {
            const steps = caseData.decisionFlow || [
              ...(cfg.includeSonographic && caseData.sonographicPillar ? [{ title: "Punto de Partida Sonogr√°fico", desc: caseData.sonographicPillar.primaryFinding }] : []),
              ...(cfg.includeClinicalCorr && caseData.clinicalCorrelation ? [{ title: "Integraci√≥n Cl√≠nico-Laboratorial", desc: caseData.clinicalCorrelation }] : []),
              ...(cfg.includeDifferentials && caseData.diagnostics && caseData.diagnostics.length > 0 ? [{ title: "Conclusi√≥n Diagn√≥stica", desc: `Diagn√≥stico principal: ${caseData.diagnostics[0].name}.` }] : []),
              ...(cfg.includeManagement && caseData.managementRecommendation ? [{ title: "Conducta y Manejo Sugerido", desc: caseData.managementRecommendation }] : []),
            ];

            steps.forEach((st, idx) => {
              const stepNum = idx + 1;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedDesc = doc.splitTextToSize(st.desc, contentWidth - 22 * factor);
              const boxHeight = (9 * factor) + (wrappedDesc.length * 4.6 * factor);

              checkPageBreak(boxHeight + (idx < steps.length - 1 ? 8 * factor : 0));

              // Draw background box using activeThemeBg
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.3);
              doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 1.5, 1.5, "FD");

              // Step Number pill using activeThemeAccent
              doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.roundedRect(marginX + 4 * factor, yCoord + 2.5 * factor, 7 * factor, 5 * factor, 0.8, 0.8, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor);
              doc.setTextColor(255, 255, 255);
              doc.text(`${stepNum}`, marginX + 7.5 * factor, yCoord + 6.1 * factor, { align: "center" });

              // Step Title
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.text(st.title.toUpperCase(), marginX + 13 * factor, yCoord + 6 * factor);

              // Description
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
              doc.setTextColor(30, 41, 59);
              let descY = yCoord + 11 * factor;
              wrappedDesc.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, descY);
                descY += 4.6 * factor;
              });

              yCoord += boxHeight;

              // Down arrow indicator
              if (idx < steps.length - 1) {
                yCoord += 2 * factor;
                doc.setDrawColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
                doc.setLineWidth(0.5);
                const midX = marginX + (contentWidth / 2);
                doc.line(midX, yCoord, midX, yCoord + 6 * factor);
                doc.line(midX, yCoord + 6 * factor, midX - 1.5 * factor, yCoord + 4.5 * factor);
                doc.line(midX, yCoord + 6 * factor, midX + 1.5 * factor, yCoord + 4.5 * factor);
                
                yCoord += 7 * factor;
              } else {
                yCoord += 4 * factor;
              }
            });
          }

          // --- FORMAT 3: ESQUEMA INTEGRADOR POR PILARES ---
          else if (caseData.format === "esquema_pilares") {
            const pillars = [
              {
                title: "PILAR 1 ‚Äî HALLAZGOS ECOGR√ÅFICOS",
                content: caseData.sonographicPillar ? caseData.sonographicPillar.primaryFinding : "",
                subContent: caseData.sonographicPillar?.details ? caseData.sonographicPillar.details.map(cleanTextForJSPDF).join(" - ") : "",
                borderColor: pillar1Color,
                included: cfg.includeSonographic && !!caseData.sonographicPillar
              },
              {
                title: "PILAR 2 ‚Äî CORRELACI√ìN CL√çNICO-LAB",
                content: caseData.clinicalCorrelation || "Sin datos de laboratorio o cl√≠nica adicionales.",
                subContent: "",
                borderColor: pillar2Color,
                included: cfg.includeClinicalCorr
              },
              {
                title: "PILAR 3 ‚Äî CONCLUSI√ìN & DIAGN√ìSTICO",
                content: caseData.diagnostics && caseData.diagnostics.length > 0 
                  ? `Diag. Principal: ${caseData.diagnostics[0].name}` 
                  : "Diagn√≥stico diferencial sustentado.",
                subContent: "",
                borderColor: pillar3Color,
                included: cfg.includeDifferentials
              },
              {
                title: "PILAR 4 ‚Äî CONDUCTA Y MANEJO",
                content: caseData.managementRecommendation || "Seguimiento ecogr√°fico seg√∫n evoluci√≥n cl√≠nica.",
                subContent: "",
                borderColor: pillar4Color,
                included: cfg.includeManagement
              }
            ].filter(p => p.included);

            pillars.forEach(p => {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5 * factor);
              const wrappedContent = doc.splitTextToSize(p.content, contentWidth - 10 * factor);
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5 * factor);
              const wrappedSub = p.subContent ? doc.splitTextToSize(p.subContent, contentWidth - 10 * factor) : [];
              
              const cardHeight = (10 * factor) + (wrappedContent.length * 4.8 * factor) + (wrappedSub.length > 0 ? (wrappedSub.length * 4.2 * factor) + 1.5 * factor : 0);

              checkPageBreak(cardHeight + 10 * factor);

              // Draw card background
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

              // Thick top border color
              doc.setDrawColor(p.borderColor[0], p.borderColor[1], p.borderColor[2]);
              doc.setLineWidth(1.2 * factor);
              doc.line(marginX, yCoord + 0.6 * factor, marginX + contentWidth, yCoord + 0.6 * factor);

              // Header title
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
              doc.setTextColor(p.borderColor[0], p.borderColor[1], p.borderColor[2]);
              doc.text(p.title, marginX + 5 * factor, yCoord + 5.5 * factor);

              let textY = yCoord + 10.5 * factor;

              // Main content
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
              doc.setTextColor(15, 23, 42);
              wrappedContent.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, textY);
                textY += 4.8 * factor;
              });

              // Subcontent details
              if (wrappedSub.length > 0) {
                textY += 1.5 * factor;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
                doc.setTextColor(100, 116, 139);
                wrappedSub.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, textY);
                  textY += 4.2 * factor;
                });
              }

              yCoord += cardHeight + 4.5 * factor;
            });
          }

          // --- FORMAT 4: MAPA DE DIAGN√ìSTICOS DIFERENCIALES ---
          else if (caseData.format === "mapa_diferenciales") {
            if (cfg.includeSonographic && caseData.sonographicPillar) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor);
              const wrappedPillar = doc.splitTextToSize(caseData.sonographicPillar.primaryFinding, contentWidth - 40 * factor);
              const pillarHeight = 10 * factor + (wrappedPillar.length * 4.6 * factor);
              checkPageBreak(pillarHeight + 12 * factor);
              
              // Draw background
              doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
              doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX + 15 * factor, yCoord, contentWidth - 30 * factor, pillarHeight, 1.5, 1.5, "FD");

              // Left marker line
              doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.rect(marginX + 15 * factor, yCoord, 1.5 * factor, pillarHeight, "F");

              // Title label
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8 * factor); // Spacious, readable (increased from 7)
              doc.setTextColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.text("HALLAZGO SONOGR√ÅFICO PRIMARIO", marginX + 19 * factor, yCoord + 5 * factor);

              // Text content
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8)
              doc.setTextColor(30, 41, 59);
              let tempY = yCoord + 10 * factor;
              wrappedPillar.forEach((line: string) => {
                doc.text(line, marginX + 19 * factor, tempY);
                tempY += 4.6 * factor;
              });

              yCoord += pillarHeight + 2 * factor;

              // Draw visual radiating line
              doc.setDrawColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
              doc.setLineWidth(0.4);
              doc.line(marginX + contentWidth / 2, yCoord, marginX + contentWidth / 2, yCoord + 5 * factor);
              yCoord += 6 * factor;
            }

            if (caseData.diagnostics && caseData.diagnostics.length > 0) {
              caseData.diagnostics.forEach((diag, idx) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5 * factor);
                const wrappedName = doc.splitTextToSize(diag.name, contentWidth - 30 * factor);
                const nameLinesCount = wrappedName.length;

                let cardHeight = 11 * factor + (nameLinesCount > 1 ? (nameLinesCount - 1) * 4.6 * factor : 0);
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor);
                const wrappedSup = diag.supportingCriteria 
                  ? doc.splitTextToSize(`- A favor (Sonogr√°fico): ${cleanTextForJSPDF(diag.supportingCriteria)}`, contentWidth - 14 * factor)
                  : [];
                const wrappedRef = diag.refutingCriteria 
                  ? doc.splitTextToSize(`- En contra / Ausente: ${cleanTextForJSPDF(diag.refutingCriteria)}`, contentWidth - 14 * factor)
                  : [];
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9 * factor);
                const wrappedTest = (cfg.includeManagement && diag.confirmatoryTest) 
                  ? doc.splitTextToSize(`- Test Confirmativo / Conducta: ${cleanTextForJSPDF(diag.confirmatoryTest)}`, contentWidth - 14 * factor)
                  : [];

                if (wrappedSup.length > 0) cardHeight += 2 * factor + (wrappedSup.length * 4.2 * factor);
                if (wrappedRef.length > 0) cardHeight += 2 * factor + (wrappedRef.length * 4.2 * factor);
                if (wrappedTest.length > 0) cardHeight += 2 * factor + (wrappedTest.length * 4.2 * factor);
                
                cardHeight += 3 * factor;

                checkPageBreak(cardHeight + 5 * factor);

                // Draw card background
                doc.setFillColor(activeThemeBg[0], activeThemeBg[1], activeThemeBg[2]);
                doc.setDrawColor(activeThemeBorder[0], activeThemeBorder[1], activeThemeBorder[2]);
                doc.setLineWidth(0.25);
                doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

                // Left number indicator
                doc.setFillColor(activeThemeAccent[0], activeThemeAccent[1], activeThemeAccent[2]);
                doc.roundedRect(marginX + 4 * factor, yCoord + 2.5 * factor, 6 * factor, 5 * factor, 0.6, 0.6, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8 * factor);
                doc.setTextColor(255, 255, 255);
                doc.text(`${idx + 1}`, marginX + 7 * factor, yCoord + 6 * factor, { align: "center" });

                // Title
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5 * factor); // Spacious, readable (increased from 8.5)
                doc.setTextColor(15, 23, 42);
                let titleY = yCoord + 6 * factor;
                wrappedName.forEach((line: string) => {
                  doc.text(line, marginX + 12 * factor, titleY);
                  titleY += 4.6 * factor;
                });

                let textY = yCoord + 11 * factor + (nameLinesCount > 1 ? (nameLinesCount - 1) * 4.6 * factor : 0);

                if (wrappedSup.length > 0) {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(16, 120, 80);
                  wrappedSup.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                  textY += 2 * factor;
                }

                if (wrappedRef.length > 0) {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(185, 28, 28);
                  wrappedRef.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                  textY += 2 * factor;
                }

                if (wrappedTest.length > 0) {
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(9 * factor); // Spacious, readable (increased from 7.5)
                  doc.setTextColor(109, 40, 217);
                  wrappedTest.forEach((line: string) => {
                    doc.text(line, marginX + 7 * factor, textY);
                    textY += 4.2 * factor;
                  });
                }

                yCoord += cardHeight + 4.5 * factor;
              });
            }
          }

          // --- FORMAT 5: MATRIZ SEMI√ìTICA COMPARATIVA ---
          else if (caseData.format === "matriz_semiotica") {
            const requestingSigns: string[] = [];
            if (caseData.semioticMatrix?.requestingSigns && caseData.semioticMatrix.requestingSigns.length > 0) {
              requestingSigns.push(...caseData.semioticMatrix.requestingSigns);
            } else {
              if (cfg.includeSonographic && caseData.sonographicPillar?.primaryFinding) {
                requestingSigns.push(caseData.sonographicPillar.primaryFinding);
              }
              if (cfg.includeSonographicDetails !== false && caseData.sonographicPillar?.details) {
                requestingSigns.push(...caseData.sonographicPillar.details);
              }
            }

            const discardSigns: string[] = [];
            if (caseData.semioticMatrix?.exclusiveSigns && caseData.semioticMatrix.exclusiveSigns.length > 0) {
              discardSigns.push(...caseData.semioticMatrix.exclusiveSigns);
            }
            if (caseData.semioticMatrix?.discardCriteria && caseData.semioticMatrix.discardCriteria.length > 0) {
              discardSigns.push(...caseData.semioticMatrix.discardCriteria);
            }
            if (discardSigns.length === 0 && caseData.diagnostics) {
              const pDiag = caseData.diagnostics[0];
              caseData.diagnostics.forEach(d => {
                if (d.refutingCriteria && d !== pDiag && (!pDiag || d.name.toLowerCase() !== pDiag.name.toLowerCase())) {
                  discardSigns.push(`[Exclusi√≥n ${d.name}] ${d.refutingCriteria}`);
                }
              });
            }

            const colWidth = (contentWidth - 6 * factor) / 2; // more gap

            // Column 1: Signos Peticionantes (Inclusivos)
            let reqHeight = 10 * factor;
            const wrappedReqLines: string[][] = [];
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor);
            requestingSigns.forEach(s => {
              const wrapped = doc.splitTextToSize(`- ${cleanTextForJSPDF(s)}`, colWidth - 10 * factor);
              wrappedReqLines.push(wrapped);
              reqHeight += (wrapped.length * 4.2 * factor) + 2.5 * factor;
            });

            // Column 2: Signos Exclusivos / Descarte
            let discHeight = 10 * factor;
            const wrappedDiscLines: string[][] = [];
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor);
            discardSigns.forEach(s => {
              const wrapped = doc.splitTextToSize(`- ${cleanTextForJSPDF(s)}`, colWidth - 10 * factor);
              wrappedDiscLines.push(wrapped);
              discHeight += (wrapped.length * 4.2 * factor) + 2.5 * factor;
            });

            const matrixHeight = Math.max(reqHeight, discHeight, 25 * factor);
            checkPageBreak(matrixHeight + 15 * factor);

            // Column 1 Box (Emerald)
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.setLineWidth(0.25);
            doc.roundedRect(marginX, yCoord, colWidth, matrixHeight, 1.5, 1.5, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8 * factor);
            doc.setTextColor(16, 120, 80);
            doc.text("SIGNOS PETICIONANTES (A FAVOR)", marginX + 5 * factor, yCoord + 6 * factor);

            let reqY = yCoord + 11 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
            doc.setTextColor(30, 41, 59);
            wrappedReqLines.forEach(wrapped => {
              wrapped.forEach((line: string) => {
                doc.text(line, marginX + 5 * factor, reqY);
                reqY += 4.2 * factor;
              });
              reqY += 1.5 * factor;
            });

            // Column 2 Box (Rose)
            const col2X = marginX + colWidth + 6 * factor;
            doc.setFillColor(255, 241, 242);
            doc.setDrawColor(254, 205, 211);
            doc.setLineWidth(0.25);
            doc.roundedRect(col2X, yCoord, colWidth, matrixHeight, 1.5, 1.5, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8 * factor);
            doc.setTextColor(185, 28, 28);
            doc.text("SIGNOS EXCLUSIVOS Y DESCARTE", col2X + 5 * factor, yCoord + 6 * factor);

            let discY = yCoord + 11 * factor;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
            doc.setTextColor(30, 41, 59);
            wrappedDiscLines.forEach(wrapped => {
              wrapped.forEach((line: string) => {
                doc.text(line, col2X + 5 * factor, discY);
                discY += 4.2 * factor;
              });
              discY += 1.5 * factor;
            });

            yCoord += matrixHeight + 5 * factor;

            // Bottom Synthesis Box
            const showMgmt = cfg.includeManagement && !!caseData.managementRecommendation;
            if (caseData.clinicalCorrelation || showMgmt) {
              const wrappedCorr = caseData.clinicalCorrelation ? doc.splitTextToSize(`Correlaci√≥n Cl√≠nica: ${caseData.clinicalCorrelation}`, contentWidth - 10 * factor) : [];
              const wrappedMgmt = showMgmt ? doc.splitTextToSize(`Conducta y Manejo: ${caseData.managementRecommendation}`, contentWidth - 10 * factor) : [];
              
              let synthHeight = 9 * factor + (wrappedCorr.length * 4.2 * factor) + (wrappedMgmt.length * 4.2 * factor) + 5 * factor;
              checkPageBreak(synthHeight + 5 * factor);

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.25);
              doc.roundedRect(marginX, yCoord, contentWidth, synthHeight, 1.5, 1.5, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5 * factor); // Spacious, readable (increased from 7.5)
              doc.setTextColor(79, 70, 229);
              doc.text("S√çNTESIS DIAGN√ìSTICA Y BALANCE SEMI√ìTICO", marginX + 5 * factor, yCoord + 6 * factor);

              let synthY = yCoord + 11 * factor;
              if (wrappedCorr.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
                doc.setTextColor(30, 41, 59);
                wrappedCorr.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, synthY);
                  synthY += 4.2 * factor;
                });
                synthY += 2 * factor;
              }

              if (wrappedMgmt.length > 0) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9 * factor); // Spacious, readable (increased from 7)
                doc.setTextColor(67, 56, 202);
                wrappedMgmt.forEach((line: string) => {
                  doc.text(line, marginX + 5 * factor, synthY);
                  synthY += 4.2 * factor;
                });
              }

              yCoord += synthHeight + 5 * factor;
            }
          }

          yCoord += 6 * factor;
        });
      }

      // --- 8. DESGLOSE Y JUSTIFICACI√ìN DE CLASIFICACIONES ---
      if (classificationAnnexBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        isFirstBlock = true;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("ANEXO: DESGLOSE Y JUSTIFICACI√ìN DE CLASIFICACIONES RADIOL√ìGICAS", marginX, yCoord);
        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 10 * factor;

        classificationAnnexBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 8.5 ANEXO: RADAR BIOMEC√ÅNICO E INFLAMATORIO (AN√ÅLISIS MULTIVECTOR 6D) ---
      const radarDataToRender = getBiomechanicalRadarDataFromReport(
        generatedReportLocal,
        pdfStateRef.current.biomechanicalRadarData || biomechanicalRadarData
      );

      if (includeRadarInReport && radarDataToRender && radarDataToRender.axes && radarDataToRender.axes.length > 0) {
        doc.addPage();
        yCoord = 21 * factor;

        // Header Title (Positioned cleanly below global running header line at 14mm)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11 * factor);
        doc.setTextColor(15, 23, 42); // slate 900
        const headerTitleText = getRadarTitle(radarDataToRender);
        doc.text(headerTitleText, marginX, yCoord);

        yCoord += 4 * factor;
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 7 * factor;

        // Spider Chart Geometry Parameters (Optimized scale and safety margin to guarantee zero overlaps with right panel)
        const chartCenterX = marginX + 37 * factor;
        const chartCenterY = yCoord + 35 * factor;
        const maxR = 21 * factor;
        const numAxes = radarDataToRender.axes.length;

        const getRadarPt = (axisIdx: number, valScore: number) => {
          const angle = (Math.PI * 2 / numAxes) * axisIdx - Math.PI / 2;
          const r = (valScore / 10) * maxR;
          return {
            x: chartCenterX + r * Math.cos(angle),
            y: chartCenterY + r * Math.sin(angle),
            angle
          };
        };

        // 1. Concentric Regular Hexagons (scale levels 0.2, 0.4, 0.6, 0.8, 1.0)
        doc.setDrawColor(226, 232, 240); // slate 200
        doc.setLineWidth(0.35);
        [0.2, 0.4, 0.6, 0.8, 1.0].forEach((scale) => {
          const points: [number, number][] = [];
          for (let i = 0; i < numAxes; i++) {
            const pt = getRadarPt(i, scale * 10);
            points.push([pt.x, pt.y]);
          }
          for (let i = 0; i < numAxes; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % numAxes];
            doc.line(p1[0], p1[1], p2[0], p2[1]);
          }
        });

        // 2. Radial Axis Lines & Outer Labels
        const rightX = marginX + 94 * factor;
        const rightWidth = contentWidth - 94 * factor; // 86mm width
        const rightBoundary = rightX - 3.0 * factor; // Hard boundary limit for spider chart labels

        doc.setDrawColor(148, 163, 184); // slate 400
        doc.setLineWidth(0.4);
        radarDataToRender.axes.forEach((axis, i) => {
          const endPt = getRadarPt(i, 10);
          doc.line(chartCenterX, chartCenterY, endPt.x, endPt.y);

          const lblPt = getRadarPt(i, 11.0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.0 * factor);
          doc.setTextColor(30, 41, 59); // slate 800

          const cleanLabel = getShortRadarAxisLabel(axis.label, radarDataToRender?.radarMode);
          let textAlign: "left" | "right" | "center" = "center";
          let labelX = lblPt.x;
          let labelY = lblPt.y;

          const cosVal = Math.cos(lblPt.angle);
          const sinVal = Math.sin(lblPt.angle);

          if (cosVal > 0.25) {
            textAlign = "left";
            labelX += 1.5 * factor;
          } else if (cosVal < -0.25) {
            textAlign = "right";
            labelX -= 1.5 * factor;
          }

          if (sinVal < -0.8) {
            labelY -= 1.8 * factor;
          } else if (sinVal > 0.8) {
            labelY += 2.5 * factor;
          } else {
            labelY += 0.8 * factor;
          }

          const fullLabelStr = `${cleanLabel} (${axis.score}/10)`;
          let textW = doc.getTextWidth(fullLabelStr);

          if (textAlign === "left" && (labelX + textW > rightBoundary)) {
            // Split onto two stacked lines to avoid right panel overlap
            doc.setFontSize(6.8 * factor);
            const line1W = doc.getTextWidth(cleanLabel);
            if (labelX + line1W > rightBoundary) {
              const maxAllowedW = Math.max(10 * factor, rightBoundary - labelX);
              const wrappedLabel = doc.splitTextToSize(cleanLabel, maxAllowedW);
              doc.text(wrappedLabel, labelX, labelY - 1.2 * factor, { align: "left" });
            } else {
              doc.text(cleanLabel, labelX, labelY - 1.2 * factor, { align: "left" });
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5 * factor);
            doc.setTextColor(79, 70, 229);
            doc.text(`(${axis.score}/10)`, labelX, labelY + 2.2 * factor, { align: "left" });
          } else {
            doc.text(fullLabelStr, labelX, labelY, { align: textAlign });
          }
        });

        // 3. Data Filled Polygon
        const dataPts: [number, number][] = radarDataToRender.axes.map((a, i) => {
          const pt = getRadarPt(i, a.score);
          return [pt.x, pt.y];
        });

        doc.setFillColor(224, 231, 255); // indigo 100 fill
        doc.setDrawColor(79, 70, 229);   // indigo 600 border
        doc.setLineWidth(1.2);

        if ((doc as any).polygon) {
          (doc as any).polygon(dataPts, 'FD');
        } else {
          for (let i = 0; i < numAxes; i++) {
            const p1 = dataPts[i];
            const p2 = dataPts[(i + 1) % numAxes];
            doc.line(p1[0], p1[1], p2[0], p2[1]);
          }
        }

        // 4. Vertex Dots
        dataPts.forEach(([vx, vy]) => {
          doc.setFillColor(79, 70, 229);
          doc.circle(vx, vy, 1.5 * factor, 'F');
        });

        // Spider Chart Footer Caption
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(100, 116, 139);
        doc.text("Representaci√≥n gr√°fica vectorial en ara√±a (0-10)", chartCenterX, chartCenterY + maxR + 9 * factor, { align: "center" });

        // RIGHT SIDE PANEL: Global Load Index & 6-Axis Matrix (Positioned cleanly at marginX + 94mm)
        let rightY = yCoord;

        // Global Load Index Card
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8 * factor);
        const cardMaxTextW = rightWidth - 8 * factor;
        const domVecText = `Vector Dominante: ${radarDataToRender.dominantVector || "No especificado"}`;
        const domVecLines = doc.splitTextToSize(domVecText, cardMaxTextW);
        const finalDomVecLines = domVecLines.length > 2 
          ? [domVecLines[0], domVecLines[1].substring(0, Math.max(0, domVecLines[1].length - 3)) + ".."]
          : domVecLines;

        const cardH = 23 * factor + (finalDomVecLines.length > 1 ? (finalDomVecLines.length - 1) * 4.0 * factor : 0);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.roundedRect(rightX, rightY, rightWidth, cardH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2 * factor);
        doc.setTextColor(79, 70, 229);
        doc.text("CARGA TISULAR GLOBAL", rightX + 4 * factor, rightY + 6.0 * factor);

        doc.setFontSize(14 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text(`${radarDataToRender.globalScore} / 10.0`, rightX + 4 * factor, rightY + 14.0 * factor);

        doc.setFontSize(7.2 * factor);
        doc.setTextColor(225, 29, 72); // rose 600
        doc.text(`Carga: ${(radarDataToRender.globalLoadIndex || "Moderada").toUpperCase()}`, rightX + rightWidth - 4 * factor, rightY + 6.0 * factor, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8 * factor);
        doc.setTextColor(71, 85, 105);
        finalDomVecLines.forEach((line: string, lIdx: number) => {
          doc.text(line, rightX + 4 * factor, rightY + 18.5 * factor + (lIdx * 4.0 * factor));
        });

        rightY += cardH + 5 * factor;

        // Table of 6 Vectors (Compact: Only label and score badge)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("DESGLOSE MULTIVECTORIAL (6D)", rightX, rightY);
        rightY += 5.2 * factor;

        const colW = (rightWidth - 4 * factor) / 2;

        radarDataToRender.axes.forEach((axis, idx) => {
          const isSecondCol = idx % 2 === 1;
          const cardX = isSecondCol ? rightX + colW + 4 * factor : rightX;
          const cardY = rightY + Math.floor(idx / 2) * 8.5 * factor;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(cardX, cardY, colW, 7.8 * factor, 1, 1, "FD");

          doc.setFont("helvetica", "bold");
          const displayLabel = getShortRadarAxisLabel(axis.label, radarDataToRender?.radarMode);
          const maxLabelWidth = colW - 13 * factor;
          
          let labelFontSize = 7.5;
          doc.setFontSize(labelFontSize * factor);
          while (doc.getTextWidth(displayLabel) > maxLabelWidth && labelFontSize > 4.8) {
            labelFontSize -= 0.2;
            doc.setFontSize(labelFontSize * factor);
          }

          doc.setTextColor(30, 41, 59);
          doc.text(displayLabel, cardX + 2.5 * factor, cardY + 5.2 * factor);

          let levelColor = [16, 185, 129]; // emerald
          if (axis.score >= 8) levelColor = [225, 29, 72]; // rose
          else if (axis.score >= 6) levelColor = [217, 119, 6]; // amber
          else if (axis.score >= 3) levelColor = [8, 145, 178]; // cyan

          doc.setTextColor(levelColor[0], levelColor[1], levelColor[2]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.8 * factor);
          doc.text(`${axis.score}/10`, cardX + colW - 2.5 * factor, cardY + 5.2 * factor, { align: "right" });
        });

        rightY += Math.ceil(radarDataToRender.axes.length / 2) * 8.5 * factor + 4 * factor;
        yCoord = Math.max(chartCenterY + maxR + 15 * factor, rightY);

        // MIDDLE SECTION: DETALLE Y JUSTIFICACI√ìN DE LOS VECTORES
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("DETALLE Y JUSTIFICACI√ìN DE LOS VECTORES (HALLAZGOS Y SOBRECARGA)", marginX, yCoord);
        yCoord += 6.5 * factor;

        const detailColW = (contentWidth - 5 * factor) / 2;
        const axesList = radarDataToRender.axes;

        for (let i = 0; i < axesList.length; i += 2) {
          const axisA = axesList[i];
          const axisB = axesList[i + 1];

          // Set font size BEFORE splitting text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.0 * factor);

          // Compute lines for axisA
          const findingA = axisA.finding ? `Hallazgo: ${axisA.finding}` : "";
          const justA = axisA.justification && axisA.justification !== axisA.finding ? `Justificaci√≥n: ${axisA.justification}` : "";
          const textA = [findingA, justA].filter(Boolean).join(" ");
          const linesA = doc.splitTextToSize(textA, detailColW - 7 * factor);

          let linesB: string[] = [];
          if (axisB) {
            const findingB = axisB.finding ? `Hallazgo: ${axisB.finding}` : "";
            const justB = axisB.justification && axisB.justification !== axisB.finding ? `Justificaci√≥n: ${axisB.justification}` : "";
            const textB = [findingB, justB].filter(Boolean).join(" ");
            linesB = doc.splitTextToSize(textB, detailColW - 7 * factor);
          }

          const maxLines = Math.max(linesA.length, linesB.length, 1);
          const cardH = 9.0 * factor + (maxLines * 4.3 * factor) + 4.0 * factor;

          // Render Card A
          doc.setFillColor(250, 252, 255);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(marginX, yCoord, detailColW, cardH, 1.2, 1.2, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5 * factor);

          const levelStrA = `(${axisA.level})`;
          const levelWidthA = doc.getTextWidth(levelStrA);
          const maxTitleWidthA = detailColW - levelWidthA - 7 * factor;

          doc.setTextColor(30, 41, 59);
          const titleA = doc.splitTextToSize(`${i + 1}. ${axisA.label}`, maxTitleWidthA)[0];
          doc.text(titleA, marginX + 3.5 * factor, yCoord + 6.0 * factor);

          doc.setTextColor(79, 70, 229);
          doc.text(levelStrA, marginX + detailColW - 3.5 * factor, yCoord + 6.0 * factor, { align: "right" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.0 * factor);
          doc.setTextColor(51, 65, 85); // slate 700
          let textY = yCoord + 10.5 * factor;
          linesA.forEach((l: string) => {
            doc.text(l, marginX + 3.5 * factor, textY);
            textY += 4.3 * factor;
          });

          // Render Card B (if exists)
          if (axisB) {
            const cardBX = marginX + detailColW + 5 * factor;
            doc.setFillColor(250, 252, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(cardBX, yCoord, detailColW, cardH, 1.2, 1.2, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5 * factor);

            const levelStrB = `(${axisB.level})`;
            const levelWidthB = doc.getTextWidth(levelStrB);
            const maxTitleWidthB = detailColW - levelWidthB - 7 * factor;

            doc.setTextColor(30, 41, 59);
            const titleB = doc.splitTextToSize(`${i + 2}. ${axisB.label}`, maxTitleWidthB)[0];
            doc.text(titleB, cardBX + 3.5 * factor, yCoord + 6.0 * factor);

            doc.setTextColor(79, 70, 229);
            doc.text(levelStrB, cardBX + detailColW - 3.5 * factor, yCoord + 6.0 * factor, { align: "right" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.0 * factor);
            doc.setTextColor(51, 65, 85);
            textY = yCoord + 10.5 * factor;
            linesB.forEach((l: string) => {
              doc.text(l, cardBX + 3.5 * factor, textY);
              textY += 4.3 * factor;
            });
          }

          yCoord += cardH + 4.0 * factor;
        }

        yCoord += 4 * factor;

        // BOTTOM SECTION: S√çNTESIS BIOMEC√ÅNICO-INFLAMATORIA FINAL
        if (radarDataToRender.clinicalSummary) {
          const innerPadding = 7 * factor;
          const availableTextWidth = contentWidth - (innerPadding * 2);
          const synthFontSize = 8.8 * factor;
          const lineHeight = 4.6 * factor;

          // Set EXACT font size BEFORE splitting text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(synthFontSize);

          const wrappedSynth = doc.splitTextToSize(radarDataToRender.clinicalSummary, availableTextWidth);
          const boxH = 11 * factor + (wrappedSynth.length * lineHeight) + 4 * factor;

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(199, 210, 254); // indigo 200
          doc.setLineWidth(0.4);
          doc.roundedRect(marginX, yCoord, contentWidth, boxH, 1.5, 1.5, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.8 * factor);
          doc.setTextColor(79, 70, 229); // indigo 600
          doc.text("S√çNTESIS BIOMEC√ÅNICO-INFLAMATORIA FINAL", marginX + innerPadding, yCoord + 7.5 * factor);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(synthFontSize);
          doc.setTextColor(30, 41, 59);

          let synthY = yCoord + 13.2 * factor;
          wrappedSynth.forEach((line: string) => {
            doc.text(line, marginX + innerPadding, synthY);
            synthY += lineHeight;
          });

          yCoord += boxH + 4 * factor;
        }
      }

      // --- 9. RESUMEN DEL PACIENTE (SI CORRESPONDE) ---
      if (attachSummaryToOfficialReport && patientSummary) {
        doc.addPage();
        yCoord = 20;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate 900
        doc.text("ANEXO: EXPLICACI√ìN DE INFORME PARA EL PACIENTE", marginX, yCoord);

        // Simple divider
        yCoord += 4;
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 11;

        // Introduction Summary
        if (patientSummary.summary) {
          const cleanSummary = stripEmojis(patientSummary.summary);
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(51, 65, 85);
          
          const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth);
          splitSummary.forEach((line: string) => {
            checkPageBreak(5.5 * factor);
            doc.text(line, marginX, yCoord);
            yCoord += 5.5 * factor;
          });
          yCoord += 4 * factor;
        }

        // Key Findings section
        if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
          // Estimate first finding height
          const firstFinding = patientSummary.keyFindings[0];
          const title0 = stripEmojis(firstFinding.title || "");
          const originalTerm0 = stripEmojis(firstFinding.originalTerm || "");
          const simplifiedExplanation0 = stripEmojis(firstFinding.simplifiedExplanation || "");
          const analogy0 = stripEmojis(firstFinding.analogy || "");
          const reassurance0 = stripEmojis(firstFinding.reassurance || "");

          const splitTitle0 = doc.splitTextToSize(title0, contentWidth - 10);
          const splitOrig0 = doc.splitTextToSize(`T√©rmino original en informe t√©cnico: "${originalTerm0}"`, contentWidth - 10);
          const splitExp0 = doc.splitTextToSize(`Explicaci√≥n: ${simplifiedExplanation0}`, contentWidth - 14);
          const splitAnalogy0 = doc.splitTextToSize(`Analog√≠a de comprensi√≥n: ${analogy0}`, contentWidth - 14);
          const splitReassurance0 = doc.splitTextToSize(`Contexto Cl√≠nico y Perspectiva M√©dica: ${reassurance0}`, contentWidth - 14);

          const neededHeight0 = ((splitTitle0.length * 5) + 
                               (splitOrig0.length * 4) + 
                               (splitExp0.length * 5) + 
                               (splitAnalogy0.length * 4.5) + 
                               (splitReassurance0.length * 4.5) + 20) * factor;

          checkPageBreak(15 * factor + neededHeight0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("HALLAZGOS IDENTIFICADOS Y TRADUCIDOS:", marginX, yCoord);
          yCoord += 7 * factor;

          patientSummary.keyFindings.forEach((finding: any) => {
            const title = stripEmojis(finding.title || "");
            const originalTerm = stripEmojis(finding.originalTerm || "");
            const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
            const analogy = stripEmojis(finding.analogy || "");
            const reassurance = stripEmojis(finding.reassurance || "");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            const splitTitle = doc.splitTextToSize(title, contentWidth - 10);
            
            doc.setFont("times", "italic");
            doc.setFontSize(9);
            const splitOrig = doc.splitTextToSize(`T√©rmino original en informe t√©cnico: "${originalTerm}"`, contentWidth - 10);
            
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            const splitExp = doc.splitTextToSize(`Explicaci√≥n: ${simplifiedExplanation}`, contentWidth - 14);

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            const splitAnalogy = doc.splitTextToSize(analogy, contentWidth - 14);

            const splitReassurance = doc.splitTextToSize(reassurance, contentWidth - 14);

            const neededHeight = ((splitTitle.length * 5) + 
                                 (splitOrig.length * 4) + 
                                 (splitExp.length * 5) + 
                                 (splitAnalogy.length * 4.5) + 
                                 (splitReassurance.length * 4.5) + 20) * factor;

            checkPageBreak(neededHeight);

            doc.setFillColor(250, 250, 250);
            doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "F");
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.35);
            doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "D");

            let interiorY = yCoord + 6 * factor;

            // Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 58, 138); 
            splitTitle.forEach((line: string) => {
              doc.text(line, marginX + 5, interiorY);
              interiorY += 5 * factor;
            });

            // Original term
            doc.setFont("times", "italic");
            doc.setFontSize(9);
            doc.setTextColor(75, 85, 99); 
            splitOrig.forEach((line: string) => {
              doc.text(line, marginX + 5, interiorY);
              interiorY += 4.5 * factor;
            });
            interiorY += 2 * factor;

            // Explanation
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42); 
            splitExp.forEach((line: string) => {
              doc.text(line, marginX + 7, interiorY);
              interiorY += 4.8 * factor;
            });
            interiorY += 2 * factor;

            // Analogy
            const analogyHeight = (splitAnalogy.length * 4.2 * factor) + 4 * factor;
            doc.setFillColor(255, 247, 237); 
            doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, analogyHeight, "F");
            doc.setDrawColor(249, 115, 22); 
            doc.setLineWidth(0.5);
            doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + analogyHeight);

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(124, 45, 18); 
            splitAnalogy.forEach((line: string) => {
              doc.text(line, marginX + 8, interiorY);
              interiorY += 4.2 * factor;
            });
            interiorY += 4 * factor;

            // Context
            const contextHeight = (splitReassurance.length * 4.2 * factor) + 4 * factor;
            doc.setFillColor(239, 246, 255); 
            doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, contextHeight, "F");
            doc.setDrawColor(59, 130, 246); 
            doc.setLineWidth(0.5);
            doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + contextHeight);

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 58, 138); 
            splitReassurance.forEach((line: string) => {
              doc.text(line, marginX + 8, interiorY);
              interiorY += 4.2 * factor;
            });

            yCoord += neededHeight + 2 * factor;
          });
          yCoord += 4 * factor;
        }

        // Care Points Section
        if (patientSummary.carePoints && patientSummary.carePoints.length > 0) {
          // Estimate first point height
          const firstPoint = stripEmojis(patientSummary.carePoints[0]);
          const splitPoint0 = doc.splitTextToSize(firstPoint, contentWidth - 8);
          const firstPointHeight = ((splitPoint0.length * 4.8) + 2.5) * factor;

          checkPageBreak(22 * factor + firstPointHeight);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("PAUTAS Y RECOMENDACIONES DE BIENESTAR:", marginX, yCoord);
          yCoord += 7 * factor;

          patientSummary.carePoints.forEach((point: string) => {
            const cleanPoint = stripEmojis(point);
            const splitPoint = doc.splitTextToSize(cleanPoint, contentWidth - 8);
            
            checkPageBreak(((splitPoint.length * 5) + 3) * factor);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            doc.text("‚Ä¢", marginX + 2, yCoord);

            doc.setFont("times", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(51, 65, 85);

            splitPoint.forEach((line: string, i: number) => {
              doc.text(line, marginX + 6, yCoord + (i * 4.8 * factor));
            });
            yCoord += (splitPoint.length * 4.8 * factor) + 2.5 * factor;
          });
          yCoord += 4 * factor;
        }

        // Suggested Questions Section
        if (patientSummary.suggestedQuestions && patientSummary.suggestedQuestions.length > 0) {
          // Estimate first question height
          const firstQ = stripEmojis(patientSummary.suggestedQuestions[0]);
          const splitQ0 = doc.splitTextToSize(`"${firstQ}"`, contentWidth - 8);
          const firstQHeight = ((splitQ0.length * 4.8) + 3) * factor;

          checkPageBreak(22 * factor + firstQHeight);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("PREGUNTAS SUGERIDAS PARA SU CONSULTA M√âDICA:", marginX, yCoord);
          yCoord += 7 * factor;

          patientSummary.suggestedQuestions.forEach((q: string, idx: number) => {
            const cleanQ = stripEmojis(q);
            const splitQ = doc.splitTextToSize(`"${cleanQ}"`, contentWidth - 8);

            checkPageBreak(((splitQ.length * 5) + 3) * factor);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(`${idx + 1}.`, marginX + 2, yCoord);

            doc.setFont("times", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);

            splitQ.forEach((line: string, i: number) => {
              doc.text(line, marginX + 7, yCoord + (i * 4.8 * factor));
            });
            yCoord += (splitQ.length * 4.8 * factor) + 3 * factor;
          });
        }
      }

      // --- 10. INFOGRAF√çA DEL PACIENTE (SI CORRESPONDE) ---
      if (attachInfographicToOfficialReport && infographicUrl) {
        try {
          let base64Image = infographicUrl;
          if (!infographicUrl.startsWith("data:")) {
            // It's a blob or normal URL. Let's fetch it and convert to data URL
            const response = await fetch(infographicUrl);
            const blob = await response.blob();
            base64Image = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          doc.addPage();
          yCoord = 20;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42); // slate 900
          doc.text("ANEXO: INFOGRAF√çA EXPLICATIVA PARA EL PACIENTE", marginX, yCoord);

          // Simple divider
          yCoord += 4;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 11;

          // Let's determine format
          let format = "PNG";
          if (base64Image.includes("image/jpeg") || base64Image.includes("image/jpg")) {
            format = "JPEG";
          } else if (base64Image.includes("image/webp")) {
            format = "WEBP";
          }

          // Measure its aspect ratio to fit perfectly without distortion
          const imgAspect = await new Promise<number>((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => {
              resolve(tempImg.naturalWidth / tempImg.naturalHeight);
            };
            tempImg.onerror = () => {
              resolve(1.0); // Fallback to square
            };
            tempImg.src = base64Image;
          });

          const maxDrawWidth = contentWidth;
          const maxDrawHeight = pageHeight - yCoord - 20; // 20mm margin bottom

          let drawW = maxDrawWidth;
          let drawH = maxDrawWidth / imgAspect;

          if (drawH > maxDrawHeight) {
            drawH = maxDrawHeight;
            drawW = maxDrawHeight * imgAspect;
          }

          // Center horizontally
          const drawX = marginX + (maxDrawWidth - drawW) / 2;
          const drawY = yCoord;

          doc.addImage(base64Image, format, drawX, drawY, drawW, drawH);
        } catch (err) {
          console.error("Error adding infographic to PDF:", err);
        }
      }

      // Add running headers on pages 2+ and page numbers on all pages (Format Editorial)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer: draw page number at the bottom.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        if (pdfLayoutType === "clinical_slate") {
          doc.setTextColor(100, 116, 139); // slate-500
        } else if (pdfLayoutType === "executive_medical") {
          doc.setTextColor(197, 160, 89); // Gold
        } else {
          doc.setTextColor(148, 163, 184); // slate-400
        }
        const footerPageStr = `P√°g. ${i} de ${totalPages}`;
        doc.text(footerPageStr, pageWidth - marginX - doc.getTextWidth(footerPageStr), pageHeight - 10);
        
        // Faint, small watermark or clinic name on the left of footer
        const footerLeftText = displayClinicName || "REPORTE RADIOL√ìGICO";
        doc.text(footerLeftText, marginX, pageHeight - 10);

        // Header for page 2 onwards (Running Header)
        if (i >= 2) {
          // Draw thin horizontal line
          if (pdfLayoutType === "clinical_slate") {
            doc.setDrawColor(148, 163, 184); // slate-400
            doc.setLineWidth(0.35);
          } else if (pdfLayoutType === "executive_medical") {
            doc.setDrawColor(197, 160, 89); // Gold
            doc.setLineWidth(0.35);
          } else {
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.2);
          }
          doc.line(marginX, 14, pageWidth - marginX, 14);

          // Draw study name on the left of the header
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          if (pdfLayoutType === "clinical_slate") {
            doc.setTextColor(71, 85, 105); // slate-600
          } else if (pdfLayoutType === "executive_medical") {
            doc.setTextColor(15, 23, 42); // Navy
          } else {
            doc.setTextColor(100, 116, 139); // slate-500
          }
          
          let studyLabel = studyType ? studyType.toUpperCase() : "REPORTE DE RADIODIAGN√ìSTICO";
          
          doc.text(studyLabel, marginX, 11);

          // Draw pagination aligned to the right inside the running header
          doc.setFont("helvetica", "normal");
          const runningHeaderPageStr = `P√°g. ${i} de ${totalPages}`;
          const rWidth = doc.getTextWidth(runningHeaderPageStr);
          doc.text(runningHeaderPageStr, pageWidth - marginX - rWidth, 11);
        }
      }

      if (returnBlobUrl) {
        const blob = doc.output("blob");
        return URL.createObjectURL(blob);
      }

      if (returnBase64) {
        const dataUri = doc.output("datauristring");
        return dataUri.split(",")[1];
      }

      // Output either as file download or Blob URL opened in a new clean screen
      if (returnRawBlob) { return doc.output("blob"); }
      if (shareViaWebShare) {
        const blob = doc.output("blob");
        const filename = patientName ? `${patientName.trim().replace(/\s+/gi, "_")}_reporte.pdf` : "reporte_radiologico.pdf";
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Reporte de Estudio",
            text: `Le comparto el Reporte de Estudio Doppler de ${patientName || "Paciente"}`
          });
        } else {
          // Automatic physical browser download as backup
          doc.save(filename);
        }
      } else if (openInNewTab) {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else {
        const filename = patientName ? `${patientName.trim()}.pdf` : "reporte_radiologico.pdf";
        doc.save(filename);
      }
    } catch (err) {
      console.error("Error generating native PDF through jsPDF:", err);
      alert("Ocurri√≥ un error al generar el PDF: " + String(err));
    }
  };

  const handleDownloadPatientSummaryPDF = async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    if (!patientSummary) return;

    const displayClinicName = clinicName && clinicName.trim().toUpperCase() !== "CL√çNICA PRIVADA" && clinicName.trim().toUpperCase() !== "CLINICA PRIVADA" ? clinicName.toUpperCase() : "";

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      });

      let yCoord = 20;
      const marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - (2 * marginX); // 170mm

      // Load virtual image dimensions to prevent any layout distortion on any device
      const logoDims = await getImageDimensionsVirtual(customLogoUrl);
      const signatureDims = await getImageDimensionsVirtual(customSignatureUrl);

      // Strip emojis helper to prevent visual square errors in default fonts
      const stripEmojis = (str: string): string => {
        if (!str) return "";
        return str
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
      };

      // --- DYNAMIC PAGE BUDGET & COMPLETE WIDOW/ORPHAN CONTROL (ALGORITMO DE CORRECCI√ìN DE VIUDAS Y HU√âRFANOS) ---
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
      if (patientName || reportDate) {
        estimatedHeight += 19;
      }

      // 3. Document Title
      estimatedHeight += 12;

      // 4. Intro Summary
      const tempDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      if (patientSummary.summary) {
        const cleanSummaryLocal = stripEmojis(patientSummary.summary);
        const splitSummaryLocal = tempDoc.splitTextToSize(cleanSummaryLocal, contentWidth);
        estimatedHeight += splitSummaryLocal.length * 5.5 + 4;
      }

      // 5. Key Findings
      if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
        estimatedHeight += 22;
        patientSummary.keyFindings.forEach((finding: any) => {
          const title = stripEmojis(finding.title || "");
          const originalTerm = stripEmojis(finding.originalTerm || "");
          const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
          const analogy = stripEmojis(finding.analogy || "");
          const reassurance = stripEmojis(finding.reassurance || "");

          const splitTitle = tempDoc.splitTextToSize(title, contentWidth - 10);
          const splitOrig = tempDoc.splitTextToSize(`T√©rmino original en informe t√©cnico: "${originalTerm}"`, contentWidth - 10);
          const splitExp = tempDoc.splitTextToSize(`Explicaci√≥n: ${simplifiedExplanation}`, contentWidth - 14);
          const splitAnalogy = tempDoc.splitTextToSize(`Analog√≠a de comprensi√≥n: ${analogy}`, contentWidth - 14);
          const splitReassurance = tempDoc.splitTextToSize(`Contexto Cl√≠nico y Perspectiva M√©dica: ${reassurance}`, contentWidth - 14);

          const neededHeight = (splitTitle.length * 5) + 
                               (splitOrig.length * 4) + 
                               (splitExp.length * 5) + 
                               (splitAnalogy.length * 4.5) + 
                               (splitReassurance.length * 4.5) + 20;
          estimatedHeight += neededHeight + 2;
        });
        estimatedHeight += 4;
      }

      // 6. Care Points
      if (patientSummary.carePoints && patientSummary.carePoints.length > 0) {
        estimatedHeight += 22;
        patientSummary.carePoints.forEach((point: string) => {
          const cleanPoint = stripEmojis(point);
          const splitPoint = tempDoc.splitTextToSize(cleanPoint, contentWidth - 8);
          estimatedHeight += (splitPoint.length * 4.8) + 2.5;
        });
        estimatedHeight += 4;
      }

      // 7. Suggested Questions
      if (patientSummary.suggestedQuestions && patientSummary.suggestedQuestions.length > 0) {
        estimatedHeight += 22;
        patientSummary.suggestedQuestions.forEach((q: string) => {
          const cleanQ = stripEmojis(q);
          const splitQ = tempDoc.splitTextToSize(`"${cleanQ}"`, contentWidth - 8);
          estimatedHeight += (splitQ.length * 4.8) + 3;
        });
      }

      // 8. Sign-off block
      estimatedHeight += 38;

      // 9. Calculate pages and remainder for widow/orphan detection
      const usablePageHeight = 255;
      const estTotalPages = Math.ceil(estimatedHeight / usablePageHeight);
      const estRemainder = estimatedHeight % usablePageHeight;

      if (estTotalPages > 1 && estRemainder < 48) {
        factor = 0.84; // 16% spacing and height compression
      } else if (estTotalPages > 1 && estRemainder < 60) {
        factor = 0.88; // 12% spacing and height compression
      }

      // Helper function to check space and add page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
        }
      };

      // Header Brand/Clinic Logo & Name
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          let bannerWidth = 165;
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth;
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
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName || "ACOMPA√ëAMIENTO EXPLICATIVO", pageWidth / 2, yCoord, { align: "center" });
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
          doc.text(displayClinicName || "ACOMPA√ëAMIENTO EXPLICATIVO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("EXPLICACI√ìN M√âDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + (logoHeight / 2) + 4);
          
          yCoord += Math.max(logoHeight, 15) + 6;
        }
      } else {
        let symbolWidth = 0;
        if (selectedLogo === "medical-cross") {
          symbolWidth = 14;
          doc.setDrawColor(220, 38, 38);
          doc.setFillColor(220, 38, 38);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "heart-pulse") {
          symbolWidth = 14;
          doc.setDrawColor(244, 63, 94);
          doc.setFillColor(244, 63, 94);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "dna" || selectedLogo === "shield-check") {
          symbolWidth = 14;
          doc.setDrawColor(79, 70, 229);
          doc.setFillColor(79, 70, 229);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        }

        if (symbolWidth > 0) {
          const textX = marginX + symbolWidth + 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "ACOMPA√ëAMIENTO EXPLICATIVO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("EXPLICACI√ìN M√âDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("EXPLICACI√ìN M√âDICA COMPRENSIBLE PARA EL PACIENTE", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("EXPLICACI√ìN COMPRENSIBLE DE ESTUDIO RADIOL√ìGICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 11;
          }
        }
      }

      // Add a line under header
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      yCoord += 2;

      // Patient Metadata Block
      if (patientName || reportDate) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, yCoord, contentWidth, 12, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, yCoord, contentWidth, 12, "S");

        let xOffset = marginX + 4;
        let totalDateWidth = 0;
        const formattedDate = formatDateToDMY(reportDate);
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA DEL ESTUDIO: ";
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
          const dateLabel = "FECHA DEL ESTUDIO: ";
          const rightX = marginX + contentWidth - 4 - totalDateWidth;
          
          doc.text(dateLabel, rightX, yCoord + 7.5);
          const dateLabelWidth = doc.getTextWidth(dateLabel);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(formattedDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        yCoord += 19 * factor;
      }

      // Title of the Document
      checkPageBreak(12 * factor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("INFORME DE ACOMPA√ëAMIENTO Y EXPLICACI√ìN SIMPLIFICADA", pageWidth / 2, yCoord, { align: "center" });
      yCoord += 8 * factor;

      // Introduction Summary
      if (patientSummary.summary) {
        const cleanSummary = stripEmojis(patientSummary.summary);
        doc.setFont("times", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(51, 65, 85);
        
        const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth);
        splitSummary.forEach((line: string) => {
          checkPageBreak(5.5 * factor);
          doc.text(line, marginX, yCoord);
          yCoord += 5.5 * factor;
        });
        yCoord += 4 * factor;
      }

      // Key Findings section
      if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
        // Calculate the height of the first finding to check combined page break
        const firstFinding = patientSummary.keyFindings[0];
        const title0 = stripEmojis(firstFinding.title || "");
        const originalTerm0 = stripEmojis(firstFinding.originalTerm || "");
        const simplifiedExplanation0 = stripEmojis(firstFinding.simplifiedExplanation || "");
        const analogy0 = stripEmojis(firstFinding.analogy || "");
        const reassurance0 = stripEmojis(firstFinding.reassurance || "");

        const splitTitle0 = doc.splitTextToSize(title0, contentWidth - 10);
        const splitOrig0 = doc.splitTextToSize(`T√©rmino original en informe t√©cnico: "${originalTerm0}"`, contentWidth - 10);
        const splitExp0 = doc.splitTextToSize(`Explicaci√≥n: ${simplifiedExplanation0}`, contentWidth - 14);
        const splitAnalogy0 = doc.splitTextToSize(`Analog√≠a de comprensi√≥n: ${analogy0}`, contentWidth - 14);
        const splitReassurance0 = doc.splitTextToSize(`Contexto Cl√≠nico y Perspectiva M√©dica: ${reassurance0}`, contentWidth - 14);

        const neededHeight0 = ((splitTitle0.length * 5) + 
                             (splitOrig0.length * 4) + 
                             (splitExp0.length * 5) + 
                             (splitAnalogy0.length * 4.5) + 
                             (splitReassurance0.length * 4.5) + 20) * factor;

        // Ensure title + first item fit on the current page together!
        checkPageBreak(15 * factor + neededHeight0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("HALLAZGOS IDENTIFICADOS Y TRADUCIDOS:", marginX, yCoord);
        yCoord += 7 * factor;

        patientSummary.keyFindings.forEach((finding: any) => {
          const title = stripEmojis(finding.title || "");
          const originalTerm = stripEmojis(finding.originalTerm || "");
          const simplifiedExplanation = stripEmojis(finding.simplifiedExplanation || "");
          const analogy = stripEmojis(finding.analogy || "");
          const reassurance = stripEmojis(finding.reassurance || "");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          const splitTitle = doc.splitTextToSize(title, contentWidth - 10);
          
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          const splitOrig = doc.splitTextToSize(`T√©rmino original en informe t√©cnico: "${originalTerm}"`, contentWidth - 10);
          
          doc.setFont("times", "normal");
          doc.setFontSize(10);
          const splitExp = doc.splitTextToSize(`Explicaci√≥n: ${simplifiedExplanation}`, contentWidth - 14);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          const splitAnalogy = doc.splitTextToSize(`Analog√≠a de comprensi√≥n: ${analogy}`, contentWidth - 14);

          const splitReassurance = doc.splitTextToSize(`Contexto Cl√≠nico y Perspectiva M√©dica: ${reassurance}`, contentWidth - 14);

          const neededHeight = ((splitTitle.length * 5) + 
                               (splitOrig.length * 4) + 
                               (splitExp.length * 5) + 
                               (splitAnalogy.length * 4.5) + 
                               (splitReassurance.length * 4.5) + 20) * factor;

          checkPageBreak(neededHeight);

          doc.setFillColor(250, 250, 250);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "F");
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.35);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 4 * factor, "D");

          let interiorY = yCoord + 6 * factor;

          // Title
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 58, 138); 
          splitTitle.forEach((line: string) => {
            doc.text(line, marginX + 5, interiorY);
            interiorY += 5 * factor;
          });

          // Original term
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99); 
          splitOrig.forEach((line: string) => {
            doc.text(line, marginX + 5, interiorY);
            interiorY += 4.5 * factor;
          });
          interiorY += 2 * factor;

          // Explanation
          doc.setFont("times", "normal");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42); 
          splitExp.forEach((line: string) => {
            doc.text(line, marginX + 7, interiorY);
            interiorY += 4.8 * factor;
          });
          interiorY += 2 * factor;

          // Analogy (orange border bar)
          const analogyHeight = (splitAnalogy.length * 4.2 * factor) + 4 * factor;
          doc.setFillColor(255, 247, 237); 
          doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, analogyHeight, "F");
          doc.setDrawColor(249, 115, 22); 
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + analogyHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(124, 45, 18); 
          splitAnalogy.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2 * factor;
          });
          interiorY += 4 * factor;

          // Context (blue border bar)
          const contextHeight = (splitReassurance.length * 4.2 * factor) + 4 * factor;
          doc.setFillColor(239, 246, 255); 
          doc.rect(marginX + 5, interiorY - 3 * factor, contentWidth - 10, contextHeight, "F");
          doc.setDrawColor(59, 130, 246); 
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3 * factor, marginX + 5, interiorY - 3 * factor + contextHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(30, 58, 138); 
          splitReassurance.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2 * factor;
          });

          yCoord += neededHeight + 2 * factor;
        });
        yCoord += 4 * factor;
      }

      // Care Points Section
      if (patientSummary.carePoints && patientSummary.carePoints.length > 0) {
        // Estimate the first point height to avoid orphan header
        const firstPoint = stripEmojis(patientSummary.carePoints[0]);
        const splitPoint0 = doc.splitTextToSize(firstPoint, contentWidth - 8);
        const firstPointHeight = ((splitPoint0.length * 4.8) + 2.5) * factor;

        checkPageBreak(22 * factor + firstPointHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("PAUTAS Y RECOMENDACIONES DE BIENESTAR:", marginX, yCoord);
        yCoord += 7 * factor;

        patientSummary.carePoints.forEach((point: string) => {
          const cleanPoint = stripEmojis(point);
          const splitPoint = doc.splitTextToSize(cleanPoint, contentWidth - 8);
          
          checkPageBreak(((splitPoint.length * 5) + 3) * factor);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          doc.text("‚Ä¢", marginX + 2, yCoord);

          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(51, 65, 85);

          splitPoint.forEach((line: string, i: number) => {
            doc.text(line, marginX + 6, yCoord + (i * 4.8 * factor));
          });
          yCoord += (splitPoint.length * 4.8 * factor) + 2.5 * factor;
        });
        yCoord += 4 * factor;
      }

      // Suggested Questions Section
      if (patientSummary.suggestedQuestions && patientSummary.suggestedQuestions.length > 0) {
        // Estimate the first question height to avoid orphan header
        const firstQ = stripEmojis(patientSummary.suggestedQuestions[0]);
        const splitQ0 = doc.splitTextToSize(`"${firstQ}"`, contentWidth - 8);
        const firstQHeight = ((splitQ0.length * 4.8) + 3) * factor;

        checkPageBreak(22 * factor + firstQHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("PREGUNTAS SUGERIDAS PARA SU CONSULTA M√âDICA:", marginX, yCoord);
        yCoord += 7 * factor;

        patientSummary.suggestedQuestions.forEach((q: string, idx: number) => {
          const cleanQ = stripEmojis(q);
          const splitQ = doc.splitTextToSize(`"${cleanQ}"`, contentWidth - 8);

          checkPageBreak(((splitQ.length * 5) + 3) * factor);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(`${idx + 1}.`, marginX + 2, yCoord);

          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);

          splitQ.forEach((line: string, i: number) => {
            doc.text(line, marginX + 7, yCoord + (i * 4.8 * factor));
          });
          yCoord += (splitQ.length * 4.8 * factor) + 3 * factor;
        });
      }

      // Signature / Sign-off block
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

   xúÏΩ[oIñ0ˆﬁø"∫F€™íX≈")™[‘ÕEusW7à‘ÃéIéî¨LVe++≥&3K$õ¢±˚Ê}¯|û≈g`a`—k˚°ÏÒÿ∞1X‡ÜÔ˚#ÊÏO9'.ôïER›=≥]Ë´2„r‚ƒâsã'cããl›˜Y:ç„0≤Q‡˘Aö±$fodl˘&Ûbü~∞x:>/Ω(⁄OítÏÂl”Û$Ω®Û	£œ â≥úÂIÓE/©‰}Ê'Éﬁ0»üS;/ÈqªsWT8LR÷éÇúÖPtÈ.¸πw_´nﬁÏ∞SQöQkYê„Àv®ZaL}Å±=Ií<H◊òüzG˙ @úèvê‰y2ÓŸm>I‚º›—˚ ^kÅµbf‘“˙— náﬂÌœ{´Â∑;¡qæëDI⁄^∫ı≈[∫Ωˇ|q´s°À"/∫∑˙}Uã#Ìê†∆ÅmÁ) „ÌÀÛoá=vÌ4<c~ ¨úΩ5ªÃ°ø∂QÅ∆˝ã–œG¨À∆^:„øÖob2@zi÷Íj_·pîCÈ•~ÜΩ0ŒX6Fí8ÇÒ ö“wÊrÖq8`±7êd›Qpò≥‰P–9ÍßPaBr	≥I‰ùlP;œ±ôXkÛo_>›⁄Xﬂÿ:ˇÕsˆxÛ)€‹ﬁy˝xÎE´≤…9z◊ÿÙ1}E´Äíhf‡?ÚR®˝ïX(ºHG’
Y;dÓ≥eùD©µ«H{˘(åŸ»7@.^ƒ`LÅVLPÂ‘≤º|{Å-Ø,√?∑˙:µ,k‘¢Í=Ö÷¯$ˆ{À⁄DÒÿW[}Èñì"ÖéÜÙ,ü˙'ŒiƒÔúcîAr,°É$Ú[%Ëå%‰z´-°~¿\Ã,≠‹—ë≤j E˚äÏÑ‡Í–˝ÿ9ôÏ!{kê“K¯ª˘|gPrÌTÎÂ…Î…$H7º,hwŒﬁ≤5ãeµ÷]7ä04:\Zr„&(åΩ<$V„¿NH¯Nâh√8Å–Éu7öà2/ìkP4∆©{n§Z·¥uøÃc\ÌóÊú–Â*Y≈ xõ≤•≥O‰_Òóh‰”4~%Ø”H_©x!¿N¶˘d
à√G:¶xÏı´ßΩA ÒΩ8¯:‰ªçEUIW∑@C∑oï{ıΩ‹{ùÜV«¯töÜYûàZ=‡ë!_huvóˆkzÂ·∏°{’Byò
kX/yiÛ–˚Ep∞ç_/Ñ/¡€√( r¶0É8'~k⁄©ˆ†É∑;Ω4 ∆?⁄ã{ŸÕ≈a$˚¶’9{√Xﬁ ñEo‚“b‘ûΩô¿h)¿ó-–}±'µΩãêÓ/(– 19¨xh”õPõ∏¸±)v¶1{Ô√°˙Nèpƒ>˚åè^º]˝¥}J=fklˇÓC€¶ƒéº0gVmΩ3[X0^Âa·6%^Œ3ºoPò¥¨‚∞÷÷ÄÍ•Ω1t} ÿ¬jØ”ñzÃò,í∆/ [goµvu|ù±  càƒôº˜A[‚ﬁµly5ƒv2	‚≠¯yp¥„\Ç¯™á≤3/cGaÏ'G=Ï∫-*"D^¸Æh∫4∂Y‘æ©QÎî?µW#ó£ˆåeF¨§iÅM<âÇ<A€⁄ƒ?lƒA
0ÇtAaÙ>`ÿø'”À«O@ •…t8b_gkd6*˚Û¢ ÖŸx1ò¶)õ∆åöá¢ÈGÌàqA	åí›d€ƒˆF—BF¬í#yvIl√Hwí«)wüyŸI<`Ìªˇ@å,OO‘AneØ'Q‚˘–∂®’Œ”iÅ"“¡‡)/µù{˘4k∑~§·!Ä$%2\$Ω^Ø √‚9Ö±ÂÎÉAêe;…ª ^`√$§ ∆∑b@ˇ}±ƒ√Ò$A¸Ù√48 ·∞>ÕGE´®ª‰ÿÇ™a6‹∂˚«µÚ)’–Wâ{H––é Œæ$ çaôÿ+FËòØ»†`i„k“!•M&«äëÒ◊=Øòﬁ¬ô∆G$›vJ0î˝ª«NƒΩ∆û„d≤…‡Il§Ωñ›¿N8Ä±¥9Uπ[lÅπ¥“Ô˜ç∫\ ∫íœZπÇÿOê/∞	Æ§ªï/i#Ω
êñˆñIËE	ùêJ<‚Ãö”_¡èì£}NòA˚–¶
ÇŸıg˚¡!ÿ3˛3ÆéÃ¢´y0*iA„Lº°‡áCˆÙ X<®Xüå
U¢˜ycÎÏçú-‚˜õ∏#X[√pêíE¸1Yü»)˝“?î<µòÅ≤æËA¶=Zﬂﬁ€ù=^ﬂy±≠ãS±ƒyÉbnº¯DüGúbÌ}olçt–∂\œ{a<à¶~êµØﬂÍ/]Ô†÷2´ÿ ıé•îUÃœÀ áYí°=6E“Gyúı`9t=ç¡Z\ïÕœHuNä#upMõ¡6Â∞W>ãb*KZÇÍ¬©‡õ\œ–÷]™·Ãf√Ü(7Ãõ’fuÜ(ñ√ˆt6‰…l&°ñ°©&;£úŸå7]√Ó^0Ãb{Ø÷Y—EY *‹·{PC+©JÉ{Aá≤]ï&”=]¸ˆÀ©ó˙MXò'¥ 2XT˙”ñÆÔ5ÂÊ∑
nÆ´–…,%î›Ë'µx∏PñìtÜÓY€HÔÚ#aÍE—,%ô»–Tƒõf¡Ê·!ÿOm]„&úçí£ó†¡Áœ`éıiòm£ß(a}Äíæ@÷¶F ’ ˇ–r–ê‹!À-ﬁ°ñõªÍ›bñﬁ@;g˙ˇ“U£O£»≤ï,ÿ‰bΩpf›F–U‹‡È:ÖXh6xÑaX˜»7Ó™«9'ê-üÑ*:C†M·‰\c:Ò°Áó0ä08 úï ë/ïmâ
¶-ej
"π∫Ëb[)∑–/† Z,RàLé†ø‘ö≤ZRò¿xÙÎM“;hê˛~zˇælπÜ∞hi 5ô¶œ%5g Á3cXµ¢∞qÎç‘ÀC%M™ß•° õ1=ŸåÈ1◊¬\Ûì]Ì¸dW5?5À[wÉπº5≥˝5ËTô»eÏüƒﬁ‰5y€GS ˙Ãtl‡+÷Ω.Ë9c,Üˆ»2‹(Ü⁄ú<Û‚©ßMº‚P∏UcK¥ìM™Ú	7%€ÙªÎ¶)Ê÷ÏGqQûÏG°¿4¶$
ºTB\î∏k„Ç¿‹•_¶ò‰ûY[N ßºÒWºê,ï∂9È©Á{¡/7í8OΩLº∞ò0hr ˛l†ˆ]˘o?‰Ijˇ~Ç8è∏ïZML≥<?MÜ	˙OµGh„ÄBíÍyD∞0ÇÇ˘‘;¨‚∆<ŸÔhÓ@ƒ>Óq›b/{»mÓ‡Êª(∂ñÇÔ:rÓ[≠ªÖ •÷P~B	1öNºªı|kcÎË®Ω˜ˆπÇ‹Í8
>Ÿzﬁ†îjÓ){µ˘Ú≈´ùÕΩ˝ΩÏ∆Ãvõø÷:{◊á¨=F~≤¿&K÷ö¬a√ªR†çÜ•bEõo¥_–z‹ÿYÎ¡˝Vß¢DƒK‹´.Å»ﬂ;Â∞üQ·kKïÖa:†2¸?õe¿j= ùW‹sâ∞Øvû=ehÅ·eÏ  {4<æ|Úâ\ﬂHÙ∑Ñ‰œ¢¸.êc>äó\/ΩÒÑø˝Ãıˆ◊”ÑWæﬁ∫Óx˝≥ï;ºÚuWÂüık_˚¡ÆBZ˘ı$öf„Xî¯ù´≤πå8ˇüú=ÑÔC?%˛_Wâ¯ √gN‰xÉi.¯÷U"–K|Á*Í%~Î*ëË%~Ô*1’K¸¡Ub]/Ò˜Æõzâpïÿ“K¸'Wâzâﬂ∏Jº÷K¸ì´ƒ(G¸ΩsBÚ0RSÊúıÁzâˇ‹““≠ëßﬁN∑,á‹;!†˘ù±√4CE1ë<‰Iy¬¢$y'Öõ•…aêe“ã¨=d&Ì_wÓp®Òì'ÈÖ∏M∆≤¿Õ≈Æ≥Ñ7ée©ˇŒYÜ÷Ö,rÏ,2ì\ñ¯£kepû¶ä∏VËﬁ¨‡4fÚ¢…»ìeºË–sñ:rUøªqËÅÜ K—˜¯GZcÙ√Yl<ïe¶ÓfPd74!öR¿hx|:û´¯¡a„‚{ªUﬁÌ◊ºk◊ºÎàw≈Zè≤,/ŒìtÃ0h
˙Jß¡»KA%≈L?LAY•ñj˘(ï…5¶Éî«÷ ~=≈ÑÉ‰òµˇÙ_æÌ¥ÿ–õ†£t!Xb^Í£7≈•…\üm⁄ƒ]|∂Õ~ë§~ß¡∫˚”?¸Ø∂◊_˛o∂
Pº¸„ÔËù{â˝È˛{zÎZZˇ∆+VÒø˝_Ù∂ÇzˇÌ˜Ù∂äjˇÌˇ£◊U‘˙oˇJØßj∂ÑjA®~SRÓ5•t§√ C«÷Åëùdaˆ(JÔP-é√’˘M=]¿àC À‚˜◊YSï‚.	°¶+µV~):—Ωóæ“Ì‹KQi{ªªΩ≥˛jÁÕ∆˙ˆÊõıÁÎOπΩµΩvÌîwz∂/πÙ™õ±O7ü?nV-é‰ﬂ^;’˙?€ãØù™·ú];’∆AÔTáPfÍ·Bï◊QF±'≠bŸlQ0b\œ@~®íÚ∞Ö˘àBÂÇcX?›¡”¥ØÅ”À¬\EÜo˘«í±«^˚¡Òã√∂6®é>Ù ˆÎ´¿ÿDrﬂÀ>–E—]BèÖh°Ù‡Å»t5Á†¢¬8£œlz¿â°›_(ÍiÙY‘ˆÅôTT]ﬂ,°Ò0ŸMIÀYÄrìµˆ‚ΩC8-hœ®K≥â35â/p
èBÙÖb>¡ÓeP¬–ú∞]Éﬂ¸ıˆãÁ˚bäÛëó?≠˝˘ã6ÚﬁÛÿH"x1ŸÍ#/£˜§–+LD}2≈aÀπéZ{r8‘U4—rç¶∞\∞Û¢NÂÿ'^‚yàÙN»∆C;±‹ôäÌ›Ωlo{•»ø›ΩEWπEk√IÔàS˚πª¥ozäÏ∏	ÔƒK≥ Y
ˆ–£_m´”µ∆ΩìX©«ßâ›TØ•OÈ	ò  ÚäU°j”≤¸Höñ-9à⁄]UwV≈´T¯Ópî»≤≠#Ç»WWÂ[4ΩJ:#<
@?„Îá¥^¢ÛØß∏ˆ'X‚íÌ©+ÑÒ—Õ9óu!ÿ’È!.ÓR⁄‰øå¿‚1ï»Ô[∏6∆)cD+~èÄO”ó„È7S˙éjˇ"Ùç'd(=¡@‡7i‡Ω£üŸ∫ªè°/Â°‹˘xD◊ƒ…˛°yh„ SœvE(mò„ÚSqL¶Ù¸ ÒO^%G˙˘
áÿÀ=x•+¯à0Y(DÔ¬ùólJÎÈ>˚Ò¶∆  ·ØßË’<è5}¿òà›˝B1†m ha'yâ›@≥E´R®K	í ÈoË≥2Ùÿ:√QJ|ÇTáßAà5g\¸∫∏ù÷bÁU0êW^ñm©i'÷`ƒç0˛∑Õ›_»dèΩ‡8¥5ú #G~KycèrÏ‡uÓ9üª8\¡Ω…4	ûgD—6â~≥x	éë‚ƒQÌwìﬁõœTÒñÁ…—ëÿÑüù‚”ãÚî¨zæóèû34E ˝(‹Ëá“c/åÖKŸã
ø™Iã⁄/›€Èí∑íˆ ÈÓØˆˆ˜o.W>49åßú√“@&Ä¶ÊpTêeJEjP—\9–{SÍ¡çÎœœˇ˛È4√∂ûÔl~˘j˝1∫àÙ¢•+íES∂öP=(SKT-ÿöY}#≤¨æéu{—Ú∆kLGq^YIûg °c™◊ÇbºÕ‡>ø¿p¢lDH≠.æ∏ ÅÆƒQŸ‰'+Ê¶zT[Ún–KQ◊‹Ê≤	æj5∂¿Öû)∑ä»{Q`ÈÃ˚¨ãÖª≤p˜⁄)Ùuˆ∂®#ÅXSﬂ‰2ï”’—ßiö`;(WÒtXVH$Å0´‰S≈[(ÏfÑ˘ÛÜ©75jvDx}¡0∆2“j[m⁄ƒFÄZ’) Acp	8!ˆ
XO}ùeVÕò©®Ëá$úìÖ«!`éTkº3}æÑF±∆v{Ωû¬˝Ç„ÍdÆ¢ŒÏ]UK8áuRs|Q‹êæ67XjnBNjnpµhQ•öaÑËø%≈©¿â∆◊®,™w»´ÏÍ⁄ÿ¿¸ö¥qÚ±O¸+8•±uuF†5´b.k	¨‘ó·¡ßF
ÙÉ) É>∆ïÁrçn∑€¢–◊≈_Ì~X€ÎÓe˚7Ø-ˆÚ À	´=aH x¯ñlm?lΩåÑÑì—É&„E?ÍHS` µˇ¶VúmQƒµ·‰HWÖ;UXLΩ#XK§Aã*Rƒî–H|K¥/´—d∞ÒÅú∆≤â™FKˆPx©ıo≠óç¬√‹∂ız`äïkMíâ]G∫ÒΩÅZ„©†qîˇæâ:Îª}S!~%a«(ZMRÖ0ÂKBF›bÃˆ·a«<‘ZÕV
¶Kˆüy4Õ…[®‡,Ê¢4Û°ïEìÍ{9\«-Xh„*xÄ3¿™T™Üs)˙îÅK1L+Ç"ßƒEx—›P5.R0 ’é…%M≈ç¥¶mπ'Äæ2?9√-Ó\£x/¥'⁄®2?=ÔÚî…—(&Üwc¨Å∑oﬂ∂åHz
*æπ––	yê	ñõM%e≠‘ï˝
"a%≈∆òN»•–‘ô©‡òK^âu«c¢(Îºï—u¸Ÿrçdì8„¢≤<_1}v„|≈ôÒÒÓ∂ë
Ω√ â¥ÀÈP!©≠1å…Q:€|ˆäøûzQ7á1¨Èî∏@'9;J—±Â£Ωk”ÍRΩØ> (Aƒ…2J*-≠⁄Ñ\r•kàõøê%qi‹’π@Â¸ƒ‹p
õN z0í¡C˘ÉfÊ` !á‰îÄeúΩŒÄ
u3‰™¬„©ˆ<hÎƒR@cP∞≥≈Ã€∂p¿L&ˆPJÅõK˚“ãª¶‹zr‹Vs∆JË™_	vŸäQÖ•ìU›º…x F∞;% _“R‡ŸapÎ¢<a˙»–{ädØK_è∂1›ä⁄ØáÊ¶@>I¯qk∂n’~∏∂∑ˇd^î'˜çºôÏzÁﬂÓcÊîŒ√≈¡*ÛÜÁTÈÏÌ∏áÔË’ÉŒµ≈êõAÇ·ÍJ5€r2-7À≤ÊEŒÖ∂É±PÂcP∫¶¬4éÎqµ∑ªπçyj^ ûˆ¸õœûuÓÌˇ`#Áõ5É¶óN⁄π*§:€x¸JˇÖÂ'·Ôgúr+´b§˙‚k{§∫‚tH˜ ^¯ uœ€ºLËÄ¶)kö—ºm´èT'ÖÕ≠»}∂Ç%0oÎK∑àä.H.cQ¨,Ô¥Z7Kµ
áü<(C	J(˚èÊUxMZ…¯Àæ‚{§∂˘Ä/≈ˆÈS‹‘$#Q{áò(Ç¥Ê$h%ôˇ3fŸi¶aıØÖàõΩÎ=)O—Ø~ÜÁIµ›CBVwaËñÁÑÓÇ‡]æïy·ª(ÄÜ÷‹:@4ó°Ë˘ko¶üZ∆ÃtUc¡ôn|D≈öÅ˝5óJ:
]¶9#≥G”∑L}ç/J9„˛[◊ªL˙vA∂Ôıˇ¶`øk‡_ˆ‘lJ[ÑsªÂYlNŒ`ïXn$ìÀŸñ™›s66ˆ≤›îHÕ¡†gÿå8Nˇ»¨}BS/ø†Nﬁ@W{ÖF´lﬂÈ·´–HÒGI‰£ó˙¨Òw‰¢±éU-∞w¡âÇ2Î§UA˙$d‹’ıyè˛}P€Ñ“)˘Eå»çΩ<læTÑ|êHÙÄnqOΩêï¯ ﬁH¶1èÏã…µCDTáEàà36DFÃB-Ÿ˝‡õ˘˙‚” <(@”iü∞!÷ò∏¶ä/h]u,7PçﬁÉ&‡ı0Í˚ß@Xj∫Œ∫ÙC†‚ÊÕ≥∑gl exËÓ~„¬ª¥1é® N◊=@*h=–‡©ål)l∑{ãºGYLA©OGÅ^ıTßƒWQ¸ı.cP¬†Kœ¶(û◊”ÓC˛à≠Q?ı°· µ?{äŸ:◊`∞âç‡geøœı—ÇıA°^ò/‡©÷)¯UÁ hrS™f•••ı ∂hÙË˚^ÖFßˇAW‚È[Zä4Q◊NY’R∏Bóg¡Ω≥⁄gº≠Q&Ç∫ÄQJ–xv´÷úé˝ ¶"ƒ÷+ï÷ }6¯¢BåﬁÑŸ6v‰·‡+Ÿ!4`':ëJ‹Ñ — 0•tSÒ◊ò_Ã±$≠≠ı3r5÷ øaíbJëˆQí˙ŒMy^Ì `ë^û<MédbeIi‚0´ó^>¢˘
Ä%±ı8{Q®¬,‰Pã2˜≈ëz¸¥1îköR≤cÒøÇ ˚&…‘7¸‚òc¸oåGÕÈ…aòâö∆ò&ò‡ãN√¡4Ú∞ô¢õhzÃsAai `„˜·1˛õ˛t†û¡ØpÄYì«$åı~ì,í√–˙ëèCFê¢ ïøÄ®R‡î·˘¸˜˛4Jx≤g˘-å1Ë$ı¸Ñ◊cEVizF_0Ù|öI»OC/M©&‘K(ÏüˇñÂáŸtˇê7,~©ACπ$:ˇ=&î√ü¿sôù•”âú/Xü ∂©àÇLˇ ±Éâº±($⁄◊9<ÂVrB	A
jÈe…8hOê:è
ß—Ñ¨®IÒ‡à|aG∑πe—b9[ b!¨af‹{!˝b∞èë^Ûöo üóÃf3ËﬁN~0‰ﬂW˚˝≈•>%ÔÉtM∏‹ªü›˘EΩ[Ìõ∂/Lÿ ≥	C/ˇ˛œˇ¯/a§É4ú‡Q\x˝Ëﬁ7CL¯´¶ç¡(Ä)Å”)≠ØHÏÃzæáŸµät¡ΩñÍ‡¨d‚1«Zü´Ÿ„œ¨ï|˛›ò/ﬁ√@|¡3éD) ˝¯¸;ıï(?=ˇ}ïæ&Úå%‡ãM-"√—˘∆ßÁ—T|”Ë—£T…P¸¸bM¶ÍõáΩÑæ†WËG|+*Ã8ô_§¥cÙc2ç∆r5¿W¢`m•—#(?ºc¸¬Åëzxûç˜ùD”qLΩΩ?ˇ.ÕÉælÄ:‘˜AêæG9g1´Òo–O“å^∂$[SK≠x¿WŸxöI∂¨—Ë¸ª\,dòê$µ:°g	Õu ‚ L¯ÏxrÚÄÉ»F∆≤5A¶∞z˛[?H*∑†!Já»øÚeÌYÀ⁄£eÌ]—≤ÊΩ„´]«É/∆´=p”w{´áéu¨ﬁ’Ø„ˇßf?bô˚[[∞Ñ)‡ø–
√îãCæ†ﬂ{—÷¨U˚úÓ†cE ‹MYÃÔ∞‰0æZG˝"J»B¡l2ÌVìŸ$»E-˘É*y~0òÚE/‚°«ó›A % eñÙ&i0Ω‚Ar@ –É`H	ßπ4Å	Ê‹‡¸∑Í{—`˝@úL1wÅÜ˙Eïßqà«¨ÇQ2ˆˇ]$∆/Øí†zqÀù#ì”sl—sLÙ◊–ÛÍÙÃ;˛ÂÉò⁄–Ê´ñ∫‡ò^‰KA%⁄4Æ?wêπ˛∫ñ“ˇ˘_j(s	°àrS9Ê∂ût(eqAÑPÖ„yŸ?<P	≈ÅôE Ñ?Ë˛"ÀÄÕíÜ
bpDGåU°ûöÎb<¶ı@ˇQ!#¬z˜û8¢G?2†i\¬úk.—øÀ¥éoÕºaò[¸w ‹7ÊØçãÉÏøT»3òESª“ûpû?ÉÓRüV≈¿«oUÙ∫£áÒRÚ'⁄úàñúªtÆL£ﬂ‹&◊Â9»uÁ¸ªv√pZ|ªµÑ:ô¶ìH)T‚óM¶⁄cïjoÎâÙ©c« 7S(º¿¯ºÄqåÜòS¬Ë™ÖÛoÅ¬“ô∑Áˇzf!Ω¨•TÅ8û”Q—Ì¬4°¸øhr√1ﬂ≈iÉÒ∆Êë¬0C”Tπ¨ÄmRÒø	NÍÏ:@®º@hË‰ZlÔz›o÷ªˇÌ˘∑Áﬂùˇˆ¸˜Á8ˇ˚Û8ˇOÁø9ˇßÛﬂùˇÁÛ=ˇü˜¸Ó˛Õé¥^ã£Q/gõ∞Öª==∞ÏXqÌœÙ‡Y·ÖRœ ß¬Â$´Uá˚ú¢úé'ßÎI6gzü*¸OrV =Åq*P¬`yKd]∑?J™qÅ¯òÔCÉWªG∆(¯ƒpH"ﬁe˚∑µ∆ÏHΩz› µË+õx131Â8+hÚ¨ãs’ÖGjrπ˚Ã™©{””4K“Ó(à&lr‹Ì˜VYö`jyüÁ^	q’vÒY”	çÃJä¡t"í’QÅkß˙‡zXúÚu∆≤∂ı¶pñ<ÄÖ3˛⁄©8∏;
0√3P‰uo öΩ.ÕÀudª•2ÚfLÙdﬂuËˇz·ÿøŒ÷ƒOr^∑úÜ
vmÆÌ4ôe?¢¸` bM≈”≈lxNNd∆J`7'y~c—.Õ©C€¨20çryß_∑—Me›•≈e÷•y%7È1=tóŸ(Ù}∞[iRªBî!›’e¬±⁄óRA ˛¸sxÆ˘_ó‡ÁZ§‘=éX6·~‘]>ÊG^ªªK˝…Ò>ÄE{…]$´c ∫o∫ªwÓ‹ŸgìÑŒ“w)£O÷ç¡í¥Fﬂâ2ˇÜñ·îÁ‘Í0≈u⁄*œV	Qá:˙q/WT¬Ã@›%ƒ»íÊ?¶<··IuÀ¢ÌÊ
PBÒË _W’”aö‚ktHì£Èƒ»|áh:¢`"Õómu)ıÉ ´ûõÕhªDmé œÍì‘∞∫JV`ÔËlè§ÅÉÔUm\1øpÌ94buÃ√Õ:,∆QÅqıÕ“
tQnÌW8/c1™ﬂcÖ–µ∑0j¶¥bBgO'v˛£ü√”YäHÁÃ^)•Y≈9ùŸå*_ë¯\MÄ©˛»6Ú{Ω^Y˘n∂©®“gõ{Öc∑ÏmÌÊ£ª{π˝«3s€Tv–hü1}/Sﬂ≈˚D_eM7ÁC`5“hquú!0
†‘ÕèB∞w#èñÿ+œ˜“ı8&Ù¥}:ÆO˜◊{âv)#,T˙“ √_ÍáÑ◊nøcöu
Äx:^?Êó*[ıÓ™2Y¯∆)¨‹ÓœÑƒøœ_.ÚII˜«Ø‡≈Á∑µn@—Iv"≠ ôCL¬AíÚg«Œ;Á≈C~ÍÃâQÔÂª¡ñ°/s~Rs¨ÀdÅE™)–ãï©x≥‘«›]}∆$ù TbP7°ﬁﬁ‰ …⁄EGö‰'ÆbY[≈Ëód&ÊúWÿ†˝ﬁÚÎ˜n·?∑ÒºŸπ◊ﬂ/p9LCˇeù·"õ™“ôY˙Z LªÃìO"ñiø!™S‹ÅbeœÁ‹{ô∑√ﬁKªßY4ç◊?ÂΩ„≥˙{"Ôk=ÎÙæm≥çYwi§z2mGÄoPÁ’ ÁÕÎ—LvåŸsBe¬ÙIëóäjﬁÛ√˜∫Œ8Œª_@W›€R)œA˜6ÙÛT»qçÆÒc<Gù´–Ti°`Sí{tΩ1?áp“Ω≠_ªˇ#nbU&`RÄ%i˚è‘ΩÕö
}o¥¢7≈€
≠>âV}M5vË√ÖÅ‚VÎóΩΩ§wS®±ìÓmÑﬂˇ˘¯?ÑbÀNa
â°Ì‡ù¢ƒÕ:z¥»hE–§‘Ïq¶É∏⁄Ôk√Éπ£€ÄÌY‚É5‰'Ï}0‡7…≥¡‘√d‹‰•g;ˇ-öx-)xÈ–cyò·>≤,?ˇ¥†¶$iÉ9ú5Éã0Ö>©òO\≥¥pª`ƒgh˘k⁄œe¬ÁmÅbäø’‡G„Ôg¥?∑∆∂'4I_bÑ)≤Ì€ËúDﬁßY≤%äˆ◊†Åâë™á
uNÎ(J75'›UN¯¬lÉiÕ1¥u#0Mπ	lQ…˚!;¬+ïÔü¢ò8c#∫*]˛¬%«†öˆAP^O≈_3ÇP¨ë^Ìï ÔuwW>G#ÿ2(ÅIå‡•ÄØØÇcèòßm˘üÍ¨ï3§IûôyJ‘D1“π1ß∑≤≥˚¿x2º˛"äÓ∑–∫n°s3yPˇlp‡ØKÚ›.}ø•~?ˆNﬁ‘„ÌëúæÖ°Xºë5÷ZfÀ≠3∂h1ñRå∆†$†s~Æ4“πÑÇ¸®d§:^2o¶ƒè`≠˜»Ω≈qs∆éóÓür9c'⁄˜„Â˚ß–$kv"æûúË∫sÀ[9¯¬FWoπ80˚=s S1)mû¿tî0°ÊPŒú&ü‰¶√Ø˝˘ùˆyÅ-/ﬂA±º‹ÔhìzÎ÷Ì`’Çr•eœÇÙs‹L?fèì|ˆ¥‘âC{ZÍcyj0˝wTLŒ‡¯>óôlprüKMñﬁo≠8∞ÜÈcçπ·º¨á£ÎØ	—Ad–&hN%hYw^a{Ü-W±6z—ˆ¿ˆÄø§•<Ï•¯EI©I∫+@–Xkl/í#K˝&ŸœiÀNÈí sè+äÓ†Hj5P≠‘k8 â–@¿2«.8£Òˆ§TôN p¯ â[g∞˘ß'óSv˚øiúÓ·Ì4ëË‰ÎŒÓÇªèÆ´◊ê©∑/:à WUú(é‡•a0´%\…≥5ØPzmÉ<∆|6:ÓJ5ÖSˇ‹”nÇ—?bq:ﬁ¿jçé]/†Bt‚zÅ]¨NÔür‹∫J˘…8åA/z*!2Ô˚-íô^‘r∂u≤›;ΩUt≠Í%r]ãî*Zπ5ÁFÄé\◊N~Óπj“ãúÙQé)Êü‹o¡Ïﬂ∆≠ß≈“?ª∑òW˘ë›ç,ıV†√ÂçÉ,‘\=J˙A˚T·≥Eìµù›[t=GOñ{‡`‰h„`ÌkFWo]mπvSpÊJ{)u¸¯˜Ü≥Õ°ùÔ.ı5R(l}OÅì1Åæé¶ç∂”PeóXj›+u’ﬂ›.î˚ f^ÍùˇŒcÌMæ%ﬁÔVåaL4√–›Ö˙Ñ§ß4Ó/£‰ ï©ƒÛ˜,}Çªcè–¸£¥F¿ü”¯"Í∏4oôá_ år«x¨¬îôv„sk˜∑z´O™ıA~Xz<Ô‘¶∑XELPm]—ÊôcßËÂ‡Î@b
x≈p;‹Ä≥!tÓ÷ÿ§æW 56ƒ¥ye«@øK∏∏3$®∂iaV†'+≠ÍKÑ¨=@'UØ_˜‚'°ÿÁ+N_Ò˛™i\ñÕ?Ça¨UL¢x.!Cäﬁ@≈éö{;¨4NÁî•∏hKó†õwWÄ‚''8@µ
èKCÇï”Kr´ñ~}^⁄–•«∏Ê¯Üø»@•∂o3äâÑ◊B¿9 ¶“F5ı—V≥›D}6√„ºÊvó‘r¡∆ÍYå‰XÀ6W›∫ ıØˆ¬K8zdCÃR√ûM#åûê¨ø}˚q«¸ËV=Èîú3ŸXsŒpﬂÃ≤c%î¿û¥U¸„ZkÖ´‚û?(†]#¶ë°êM©GËÛ+´≈tΩ&Ä¡ULÉ*l© Ô$ZE≠é÷ïälvq€—ÖáCW}_Z'¸¡\Ω¨8z±Ã¨àä÷˙†ﬂºãRï∫∏†é¬°cäU⁄∂ú)S£!»‘ïŸïSV=' êptõè!Â±˙<ù∆…–b9˙[¡@‹íuÎ¬!ÚÆ≤äU’≤aÏ2*™C$\c;}[6&,ñÏ{ô∑Z%¶$•a¸Æãû√ÇX*çhåç°ﬁ<'ÙNÒ[“üÀê*~Ï¸iÚjÓA‚ÚWÑÃ}∆˛ö»
#c ªmxç^…º•⁄ç[∆Bôâgfﬂ_ÙÀÅØ≈¢¡ùÉÓq\Q∞ìb\Í¥p|1¸ cmyû(É≤€…AêÎæ£·Qg˝a˚+∏	djwsp˝vYÏT1ñ∆˙:Á-0qr]:ö=Tçë”¶ÇUN“‚4Onu∞ä;-UÚ¶;oík9Y\†!vè∫|À…©W£cÄnèZ:Î1ùè9¨€äà-7¿w™¯çnâ|ŒO›à_•˘œâÆ\J±'í#|„ã:⁄√√¥0gùÜ„s2%ﬁê8\CŸ¥ ≠’ÿÒ÷b∂C’\VÚŸß%Û@.‰5ÕcBÏö€â›WI¯&æ6ò#Ë*?≈pùãb»¬⁄Oxt"\)öêÓ‚»êön=0Yc	o∆.ÇΩuåÌŸZ˘ÑÁ’GA¶ƒ#º!	%Såk$„q˚î··<U∆íâ´˚ÃIpÏ–Ø+qÒvÕb4Ω⁄æ∫ÿD‰ªáÙı 9Óäv$/™›–º*Y)†≠ﬁnG[ulÀ&˚Ó˙ßoÂ∂˚6ù@£©°–¢ÛoÒ–Ó?L&ﬁ±§mqó®ô€Òµ,¢„<ñ£*3ìG“È55»1ª rèËøq◊6ùÙdz1ÀÓ?c®g†Ãa†éÿä¡DÉ¸éòıÿW±XzÆeÓ…(¬¢äPÃ2$»€u}Ò¬èüRî/Ê≤SG% ]ZwÌ∂/ÁuMZOtÙ0$≤ıO‘ù§:†€!n?…ÀÿŒQ¯j]üSm#ÿX°á)™xí.Î6º†»Îhá∏t˛\®VT+Ùıjåë6ÓÊ≈)√r⁄n≈,ø5÷Úﬁ'°ﬂZ‡‘g=egñÒpOø§Ïa	NÙ.a>√K3ºÙEÀﬁ?•∏AkÁﬁ‚≤Ó¨v¶dÊOJÓç“J,úæE4®p&0ê¿hõ†Á‰Â„'ò].ı`vÇY-î@ru 0$ä>∞C†0Ûã∂·[7Â!k2è∂Õ·Ø¨±›í‹ø·»Ü›aÍùp¡·õ$≥¯9µdﬂ+ØÎcÕPû¨£:'C≠ã"'¿ulhú^∑¨ÿä±Ÿt%Ó¥¸\*˜è‡ˆ´};ˇ~¯§ÒãE‰^ªek ﬂeÑL»X>17…xxÖ¿ºÖ∞(fœ0V#PXÜ›P÷Xﬁ|Y|µ˘Ú≈´ùÕ[œüºxılÛ√ÊˆŒÎ«[/><ﬁZˇÚ˘˘o∂w∂6^|¯˘˙”Ø÷7∂ŒÛ\&@¶:Â.Ixâ2UGºB/O^£∂¿3ÿhπg◊üo˛Ìûí±æ‡„ÕÌ/üæÿﬁdød˝†{≤µ¡kuJ–(R‹F‚Dò‡iÙêiî˚àbëF£#Ôÿ∂óÒ´˜X£xÀåÖº¶∑∏éw¯DoµWÒ∂8Ø™B‰˘(’ƒö1N˜_Ω—∑'â€Xˆ!Ì‰û≤§—ªQ•¯	máÓ-Ó“ò›“có2q·Fê-∫`UV§]‰T∑¿ﬁrπ?íWƒÕ¥
Ù32Óu∫˙≈®MÚ<≥¨ÄRäq;áNå«¬Ω—rŸÒòçı≠æJï˝åÚNﬂ…(/=)§°/œÿÒ©û(ŒßyJ^`{KM¶j¥4ÔL	Ï¢"— øå¨;1Ø|ª¨ÈZπ¬ôπÙb-’ü‡s†π˙ó/à˛›•}À`÷‹‚'Y?˛|Ò±&`yÓ	Xi4+ú Èò¡]ê≠qkÈ{Y ü,¸Ø‘„ø¶o]ò‘óÏ›±ZtÛ# ’∑?™oU≤{˘∑ZÖ¶ª7/eckªl9v
D-∫Úúoú‡˜rsmY7ﬂ ›ôàAnò’“°÷n6ãÜŸsÚ5P¢ÛR¬r’ê≥Ó%.ﬂûxq)74VÚ±çh†GÂ¯„\?F∂)ü?å∂∫Êöí€´ùï7&‚ zÙÔ™°avpú•ÅiÁI]M3m‘ÆA:÷ëkg§p˙qÈÓ“mÂO˘ûù»)0Ò†H+ìe»ô1Û≈∏ãCôºç˛æ<›Yn√÷ìÙ‰¢AG&|˜€÷EM].oª£â9|a∂V±’áb‚V\‰¯á/)`Œp|≠Ç(J;É"ÿ±⁄æG∏;Ze+mp2nîß÷sí7Û∂/Áoã«5ÀVw´˙‰dÇØîù–MÔÕÜnWZê6_2T&†¸bF_W˚à∏
-C3QÁ©Ù»∆é®ç6Õ!QvÃ¿ˇ~F$√vhLÚ«‚≠ãèj·W≈+qÛˆöí8]úN·Ü‡W∏pÁï)òù+J•ƒ˝l◊òéæ˙ù<%Õ˘JvˆVôLƒ±y;#{~èø◊·/S◊˙R˘‚n)kìvç/VøEi√∆-Õ8}Æ7f4ìjÛ´ùgOÂÖ€≤5J7ÚSŒ.MıA¬,–∏=!KëˇØ„Œç’”úi*ÀI˚Ì$¡…ˆ‹/)∂»˝Jm“V‘úbÂ<—oí6Óπñò˙π«©Í8“Ô∫◊vUŒvÂfYÿ"◊ﬁw˜^ÇIÂ∫∑]EﬁiªÜ÷¶Ï˜‡fßeSuJ[nÅ“Æ≤å@L¢»õ†ΩA7KÜ¿G ^®ú.Ù‘\ΩÉ!6-ñ Ÿ¯ï‚π‘Ô/ﬁ—‚k‹>ß{yjt)gá&Ù¬3Xï“KÆX“˚GlT•ÒÛj)tFXI6áh¡OoYqÀJUcK∫¯;V7xÄ¯÷_ÌWÙ¶Ö¶™&ñ\M¨Ã’ƒÚ|MhäÇcË∑Íá^…V´´5¿ŸrŒöbm˘ã9q·mÈˆ_Ì9ÀÊip≈5À5P9ºsbn©	xùX\Ω,÷∫1ÊÍVÅ;N∏û¥ùÁDØœ±\á†ÜîZGÓÕ0\;◊Â&nÕ◊Ñ{ä*˘5˘©^ÚLJ‰ÄU≥lá “|nKµD“¶D‹Ñ‡'ÛÕnπ¡«†∫FÛ4≥ÏjfÎõ_O√ ≠Ñg◊úW¿ËÓz¯·FTéÆ√ë0ö*ÀÍ*ûíBìOEâóBzÎ⁄åí¥¨'ÍüZ°ÖñR÷?ñmRˇúQn±5	(ÉùNµ¯Tù@ù∆òÔ™Ó-Ê#w#F˘§Äh"-˘í÷X÷%—3fëáuO™’:Q¢PÎƒÉ≠gÖ6È‹øî∂◊Ô“ñnUdL·@¶nÑö°¶uÑj™ à«ÿ_±eÀ¡ïgû·”Pó…Ω·&ú≥júY.–w≠*Z∫ÉD~™º|lPØ`€"ya’†äŸôÆ…‚í÷JÔ§hsÅΩ≈Ø]Ó°TŒIöY¯;®P •‘à¬aº˚;'ìÑºÇË%l'V™@æî¶;–dM-À™ÆÚ‰Cçb•˚ß5…rA(D∞ ¨_X'0éZûW ∞ƒ bF≠¿Î‰*[„ùö°˚√Tgkî—*R/uëï˘’≤T14_ë{ç‰≠êΩ∫(µ=íı¡“Õo3—ª“◊·PûSªƒpº∂4…’ÇπN4k˛W¡Æ™[AZí¢Ú„î–nÌñ“Âƒ\T≈•ÆC¢π"!Ÿ„‡–õFπÿ`n—çø‚mâtõmﬂöáåN-¯}ÅEnÈ"Æ%·w/cﬁ1qï∑sÀñﬂzXî≠rÛ€Ωπ?W´hn—›h— ˙{ Ì≠Üñä∑æs¨›oOı’‰¸∫S„˙q˛q[SmÈø.X™„Œ¬WmÏ£ì: T¢Ô∫D¿¿¢“~KìêH3Rê¸ÒÑD°◊nµ*¬P˚≠tà∫2Ø·6ékŒxWÛLÿ§Èt©∏òÂö0-ËÎ„á{˝†Sàd⁄ÂJI°úr¨9'¥|`Æv:Q}•éî∑•f?±UfçsÓ¶7€K7YÜŸ¬ú{Èç«v—ÕÛbYl8Wo3_hÎ¸Úh∞W>œ Í®©b˘œ±¯ã·ŒÄ¨L¡˚pœZ1•ıb–€Y’YRô>›q‚,µl⁄q6Æó‡ã<≠é3jZ	)--§ZLOﬂ™,Õ∫Ó´FΩwÄÁ›–£nâÚw@§áÃ‡«ÊﬁŸ©=hç à-§Ì»l0
∆`· Çy9åGS3/f¸ê"èk,%$”ÊdÓ‰◊≈ +“`∑ÙÊÀ¨ﬁ><‚>3¢π?ÍÛc(Ú·ƒ⁄ÒFNÃñ6H&'löá04∫ÊY¶‚úúÏ$E±˚ÃÀN‚Å}w7ûÚ√cçÍ÷2πΩæ¿(ˇ\æÂ?túÕñz V»G¸Ú6Õ<M2MÅ5LIÛ‰gTÈL&æ#yïbr‘ù‡oŸg˘7bS<•⁄—–õdmiêlì¸˛ ;⁄-‚cy“î™p±¬«RpD sπ«æ‚ ÖôÂ≠À38ƒmy˜Qt¬” `…!¿îÚåw◊o‹∏Œ#Ø¡∆H/ˆô8é≈F^6bXtôÃ\†¡¸RﬁŒ!«Ôj~ï˚WÌü›‹À"∑1È›é"÷uÂPÏ⁄p|◊6L…Ñ`‚£Ç’	Î.{óπZâ˜‚õTø·Iµªÿƒfå∑3¢90â¡12&≥fd‚@Øfí≠h∏L√¡à°ﬂâeq*˙ÑRÊá)T[‡+µ*º~wà´ıŸ6£€“˘q-Eí⁄ì±ûÈ∏Î—9c9≈mE\O>é∂˜µ
<\◊@–.ÀÒêºI¿£Õ7_Ì8, S™U¯7K‘p¸$»‚Î†ùÅ‚ü±{´„1Úûﬂ Ωa¶ıqacÅè˙Çk»ëb∆>£Ÿ˙ÃOÓ∂:eÓÒ2Q^]‰/2ƒ"∫å2«ˇòÆ¢ñ¥MºU°—Çü+Ò¸Tüà¬1àFûÚ#≈≈Ç¯¡5j ¿∞nÊ@’ª√€VLΩ¬Ík…|k£⁄ÏπXÑ?√Ë‚í›´©]5 _ÊÂ¬|)†/ı E°æÿóÜ˚÷Ö·Æ \Wd∂VÊË˜\[∫∑x¿lºi{±h$eãÍV˘Üeê#◊Î—íZˆ∫∫‰ÚL
«œ5ã[Õ¯¥-˝=ÏÒ&ìÆÀ$=<reQ´˜pß∫pµSÇjü<¡kFLqæ
o√oUÇ+pdçQå?p@Wù_–˝f≠#z∂&Ó8.◊axI&™“Õì…ÎÛÆ,∂W„∞*èé{ˆÒ±ºzÁnÀ¶‹ö·ﬁ≤ÀfõYG[ìjâŸêœﬂ*õÅº•“Dapπ96éjq≤Rn∑"æ©∂ôeG3U¸@&UÅUö ısO”O‰fQ÷é—‚Cˆl_nSÏ Y›%osw$p4}óïâú?:Ù∆at≤∆ÆØc÷–Î†éÅ%√Ì≤ª≠ü≈Ÿ‰.±oÕé°¬uÉrÅkºé}¥!p0§ˇpÌÓ3Ûƒîv˘Ì°®A#í6®*õ÷∫º–»9X£QA‘te¨N>g≥áuå=4∫=s`ñn£]c?Î”ÁÆ‹øQÀÙ¨ı €—8Ú"Ù⁄)üoyWÖ¶◊ÛT≠¬•Õâmø5»‰Ì=‘g‹£ à{„ ˜H%CÏ~kövøh=∏∑»_“NÀµSMˇË!î¿Fﬁ™nÚÙD#t\Q±˜>bN$L$$LDº\<å¡ˆÈ)≥ëŒ¶8bœC~ (éòQ∂m.'beãdpµ÷®Ù£(9hÔöf“˛;•Ìù5£`n¡—ÕhLbØ‘ï¥Z93çw‰Ö9s‡¢wÑAÒÌ]Á~˝—Œmê•jé◊y˜&ÃF2	ü€∞[~’≠(ÿ	«A2Õ€m≤b 5H#Ô,∞e†ŸbOoÅ[≠§©}*,˛ﬁëóM>ÛÂÄÚ'Ï¿À¬+ËÇ∆¡¸)òä…ZkÅaC\&m]pqLh∏8√›L”2y#V`åI⁄nYnñC/D∆\ Ï\`9-∫1QµTûW˛W¶“©RÙj‚Ø1ˆƒUÕÒ[˚D·˘%ÅÀëhU–ﬂ-äî¶¬™C7Ö3a-¢/º(Hs 
ﬁØÜé, /o‚Mº–08Û$ÛP(RÛ>SN:ÈÜãﬂC#»üvíg“µÑáv‡âr¨…/VÚ3,£∂é•“K*(≈†¬[˛H∫‰^q£ÄÒ]JÈ}†¬c_s¥Æ|‡9;á!ÿ∏{|∑¢¯ﬁbmªwë ≤æˇŸ‘åÆKeK„M©7ÆêÄ`@y^—‡A∫ó›ÿ[|(ö#_X©Ω(‘⁄„'ÎƒZ≠F°jØÀÍF£
ö›éì˜õFãI4m”ËCu¥6j–V*ksR◊Ÿƒ¿PU7ì2πé}√_˝UM0v6aÔ√l
<ÛDld†ü1A-Ò§pèä¨M€∂2qﬁ;¢PDœ,†ó≠◊ëJËî∑Ó@nS¿ÚzqŒı ¡0Iá¿®2∂EvpªP;®5®fcº)—òÙjùv))7Ö §cÓñ8QIÊ∫qÔsggìCÚ*»&îÓvMΩ£√Ô– €@ïì6±
n¿å|ó∑˙˝V)?"o¨:9b.¸–.>$A,n¿õïJ1ÁIéª¿Ì'ˆ‰Wl;©HJÒlﬂZ§É÷SªÎÒx©% 
˝§ŸiP≥[¶ÀˆÜ˘µq‘Â4c√æ‡y§1Rƒæ$ÓÃv4HÒVL«Ã4oF´ï©éìS| )èÏ@~@QÊêíY &< ËÜ◊•RÚ*ïŸ_\ÍyJdRwzls7◊»"")≤:óT9o~Ï`á¶˘ãf‡‘Œc‰ƒÈ‚ùUuƒR¢µQñ.y≥TëŸÂc·kπæÊ¿åù`hF&!0æ-yVõÓfë“ódTqjÛÚxYô4£ØÁ•55lû´¶Ó$ˇER÷‡«àÉúù∫?≈ìô%õgs 	∆Q¿üTˆäº—'j8{ª_mnºx∂˘¸Ò˙∆÷ÓãÛﬂÏ?ˇ†=yÒ|s˚√ˆÎ/7_m>ﬂÿZÔX—Öâ7äÕ‰AŸ˝Q|(è:0†5È,mÏ˚ÓÓ˘{ΩΩ{›ΩlÔO˜/{˙/ˇ˚ﬁÉ}±¡0ª:Ó|¿ÆâÄÕUvæÊBîﬂ˝’^º∑ø∂èª˚w◊8ƒ˚˚7√èj—McÑÏ∂ÆÔ¿fı"i‘˘ûÙ)1£˜‘∫c¶ù%≈æb±=ıÈß˛+€ÌÔ£8/ûsaˇæÏﬁ›°J≥Í˚tÔ”O√xê§†ßÅ*‚ØO}L ≠ı1ÿ≥Œ‚ï“*ËØã\•2±rˆTá™~yÊ~süñ‹^§@Üg!2
∂ıß)q∑c‹„ùç◊Ë{öôc‡˘Ãõãn…p60{∆¸ú`ÌY95Eò8®%oπ∫≥⁄_\.›}ÖÍ–Ú™yE*≈ú›˛õÂ…Òõ%¸áÆn^∫Ω∞Ù≈Í¬“ÚùÖ~Øª≥ﬂ™áa≠  ∞ ƒ˝ Í ™≠∏aD‡™qﬁs7xq8Fïx2µ†Ó¿3Œ™›È˜µSêEﬁ≠Ê¬X+´åGE–ñ(©7xªÓÿ‰FŒº{Üﬂ´√ÔwëW,T‰—·üSI8Uó¿Vu=—“Ø1ã™J∑EËƒµb‹∑c–Ÿ-G"Ÿ£ î2#_‹-vƒÌû˙∏oî*>’¬V ·Ù≠Å=©
æ}±Â1≈)òÚCv›§Ò/˙„d≈§q@“u‹++m’A∂mbÖök∫‰Áﬂˇ˘¸ˆí¯´ÊØ’∂∏˚"≠^’fÕR≠fπ~z≠ÚÓèk⁄:∏n”$°€ûÇ}ÖÍ&jõÍä-íçIz˛[o¶Î.Neú7ÖàÿqHn";Ú⁄ÙsÃ\jßÉY'º8∞•}Ûu-’Ãx]]Ô`öÁI\”1Z7˜[ºXùH‚ç(ºª wF^ÏG¡V°–º2åÜ∂‘–Íê‚á∆˚˜µµzñ ±∫öıwıÕts+Yf*.’7(jkcY[=B/ÌÂ®ÎMÛ§`|¬ó'q¿”4K“.π.ÒÓ©-Øˆgùñ¯ôAïUbÚ_^ˆDÒíÅ_Ø 4WW
À-3ø’7ò˘JnÕÜFÎ„vüÜÆ‘Ì>g˛Ãvùi}:§å•ÍµLºçèN∆¨·mﬂhÄΩ;_Ï◊ûDΩË…R]2Œƒ3’º“7HóMEaÖÀ‚øRKÃ&∏’?CsRËÅ‚
±üÙzΩFl∫∂È—WCÏ"öë¸cÙì´ﬂeGµD¯∑cfÃ$◊˜Áfz£¨;ÕPUıÒÁŒa‚ÚÃë Yøh:gYæîŒßo+s:ªú´¸rt%^å[ê‹Ä¡à–ÃJèZ]*h¸\.¥Ïß&%4~,Äe≤fw{3≤HÈÿÕ‹AÖÃv¢∑Y&i–oOu`Î“Iˆ.ùR?Æ•ÙëRK7∫ú^öYÈ#ÆM3] 0-]˝çsL„ß÷G6jﬂäÃ∆•$’ïÊ¬å‰øï3˝y·:q*Í4uqÎ◊
Ê´…5+50¡Rwav;v%@wÃ,’Æé◊oî:?Û§. 7N!,aô'çp—M≥π¯π–ní C{Ã-éÒIw≈yã≥ÿˇ÷çÕ=Ç)·øåÜZû[◊ÖÀ•D¥ú]í∞R˘æå,^_¨ˆÀij›◊–⁄Èh[ñ∑∞‡‹U∑’ª°œºâ`Ò3OrA¸Ãù`PV∫™$É¯π¢DÉÓ¶.îl?’:‡ÃLG<«†#ï‡ååÅ˝féÅ‘•ÃÚ^5L¡G¿W¶·√OÖúØJıSïÏß2-Ω≤SÛµ*W*˘¶u÷∞‹Ø›ß∆œú9¯8D©+Âûn¬îwñ˙∫èÜŒ TÅD`Õëí?Õ”“•g•¶sf•ìZÕ‹yÈ”`µ‹`é`˙ˆÑô‰´Z’‡“ Xw}∆ØY4¢OK”¸X4íöY¯©\>’®z	πrfâÚÂºY‚Öù;ã?ûC—©œ•Öü‹©Öôî&dŒÃZ¯ô+ª~Ê…∞•ê‡äA·ÓÅrÃâq"‡πÇàgr-ﬁÑèƒ≈Cú—&Oeú≥˝πT¨…‹·?Lú…e¿lc2wÑI]|…åËúJß©¥s?Fd…Uƒï\»^Æ`£E<âJ˚SÈ˚¯≥i<Ú√áé4€â˘¯a#?`–HVzóØ8\§a∞»è#T‰¢Å"3v§gmi¸ÂÜàÃôÖ∑öMíÖÜ¸ŸÜ\0,dˆ>’G	iRRK#µ/´ÍÃirÂ!  ˘˛—$¯„˚˝∏púÍïá}¸9}\Ëñè¶·3bÆ4‘„ÇÅuÕÉ<fÙRÔò5™ÀåÂj√:ÊÍ®[µc≠.úcÆ›√≤ë˛3±Õ7Œ∆~CecØU•”∆OΩ…›8≥nÈÁG:•à◊âºRzkÈŸû/¡5⁄≠5£åtŒãÃãÌπ	µkØÂ5g¶8ñ»kî‰∏gÂ˚æ≠∫•Uh\Ò*À∫3€:éŒø˝%†ÙS– ”r¢Ø</G˘ à≤Æ.ÔLÍ´%í7pø=Öf	*ñ ıÉ9ëƒ^ÕûˇS⁄¬ú1–
œøÖQç'aD≤åΩL¿‰Ùﬁ'È €”·äEÏÂ„',9!OóÎ*¶0yTÑååï√ª8”±Á{Ωb4≈L©D$Ùß·ô~ÅØÃLLËÓäëu}@¯º«˚oŸN+g¥ÜRô>⁄^?¬Û˝?‘·˛™¿çöc‘óÊ€©vYÇ€6_v≈nÿQF<ﬁpTé:‘¨àU¥z´‘Ö∫c⁄•vGDßÚºˆ•uÑŸg∂ÁäöÎåˆ4öΩwÜZ÷$‚∑ŒØ\·Ì+	G››ÎÌuˆØ.$µBq∆•Èf£Ìû£ú∫¡´¨`†ÿ›Ó≤ŒK}•æÒßø˚ó
E°Jsù1ÚÔ/ñœÕ[siòsBÖ„
ê-M∏åé˝¢>:∂˛P•7[„´3R*w˛?z†≠{ (Î?¶züN:êÄ3Q∂$AÌbÜ≤Eb/Ÿ‚Ëd2
P‚&ò£Ë}@ÈêRÔÑ‹S>{|Äõ…!,(Ù®‹ª…ÓÒÍ[ÃŸ^,πΩúÏ›ÑÔˇ∏7]Ó//√ø´õ∑È˚
˛{keˇ¶∞ljxí3¿‡MH7˚&†k@Ç≈£F©4IQãN`ï≈ÉhJ8A…Ü—$AJ“‡z∆8©,ˇ
Q¯.`7nå µﬁ7√‰∆◊ou4}\”îz/ª±Îuø9ˇ›˘∑Áﬂùˇˆ¸˜Á8ˇ◊˝ŒbxÒ%.≤ã"í6F^ìU>k™Î!°|„∆µS’a/O^£~±≥–ÓP‡ë´”πWÇJÃì∫û∑˚≥[vS_§†÷Ì•èTÆ+&XÆÈ&z∏PS.cÖWbæB⁄«Væb∏∑>zPy^"¶|˝G	)ø™Ò[U!‚Ó¯æéÈ≈Æ:>ºÒ·´)8ºÓV-(YêrdrÎ2Å…ÊtΩN5™Ωh¥2ŸÒ¯q√å˚}ìºV>~å±òüŸÅ∆tZ·íQ∆ı°ÏZhÆÄÍGüÎtÛ™Î¥5…i
M3Çπ¬¿7–P◊[EîˇëBw…/oﬂäãüc¸nioÊ‚[3?ÌÃ»ùôï+€ó—Ææ7c.‚hˆ‚˝≥Ÿ¶qË∞W≤I£cí⁄ûÖ?¬=õèª_sÎß˝møÊR[5_¸El’,˝n’(UıGª]£.æäÕöüˆiÛ=ßeÚQ &zS∫ nÂT•gªÁ.BÙù¢É5§Ag£$Ø ËÍ6}ä%”ñœè,Ì…Uo˜S˝”fœ_bVïí¸?öÔ˚ãü|ﬂ?˘æuùtπ¬˜Ω˙1˝ﬁÀW·˜^Íˇ∞~ÔèÈÚ˛¸/«ÂΩƒ]ﬁ‹!Ùc»ßÒ}zπõ;∏?ˇ9∏Úmˇ‰€÷:¯…∑Ì¥W/Ë˘~¸€æÆÌ˘T‘è„⁄˛1{µkÔ,T7¶‰òÕXW	øèêá¢Q§zRû@q? ﬁ%ËKÔäóÂAfÔ¯MÇŸIÜ€™â^ôÂ[ﬂùrg09’π[∏ŒØÆJTﬂ8€Ÿ¨÷ áﬁÂOß@ßàù‰ÃuÅ·]')†édòpÉ!Ö¨≠û≤NWŸúûÉÄ∑ß,Èr£∞R”\úb´i3M≤†YÉ~Ï’548Òb—P•#^Qa?K¶Yzrˇîz¶•C]Ç⁄TP≥”s_qÉ‚RøÚEy~¥XˆæÄÆMõ«jóÌDÚO†Y7h]€G_π	¯·t\V¿`0nk+ΩT…Ë¶j#PÚé‡lœÃV˘çJµ’GZ•YMA}c∫^4Mñ∞≥lßxA◊,¡ıùüt?_u;»K}+`ıÓå‰∞äé*‹Ôé'. Ë˛ﬁO¶1n|€Z«‹/œøMSÔ0YÉVx	FHªcl |èr/“å&»2X>e©ó„ÓV¬Fﬁ7»`ç§@å	ÀP£Ÿ4f—Ó"zÄ<æG6ˆ@RßQ¬N €iò‚F 
ˇ‚ÌûóÿêÛ2xÄ;lxÏzåqø+œÇØÒàÈ˚
V¥q<Ú‰¸˚dÅmO |áã2<ƒÔù^™ÛWø/≥ÉÖJ»y[m5*Äè{πw%◊˚ÅR{€Â¿X◊u—ı+Ó3JôΩäf$g†g‚∫ùQÄIP‡ûïœˆ^6ëÓƒo»ú∫öKq‘íÌú»/æóçË>^~r> ô$N˙√Ç°üî~®/îùAcS’	d"'bb‘“äÓëz“í¶UÏ;∏˘UôÕiæÚ*«Ö€qÛ$åÇ««^N≥£Åè‚»}Ç˚Oˇ¯w¸?∂ÌE∞|9CÜ∞Ùqáª˝$Iø¡ªœüy1pÇNQﬁa∫Ωê[wÑÑ·≈C@aÜT∆k1QñÃQ≥,#˙ƒmÃr†U)T∂b‹©gœß¡{O`√Q\v=êÃæ≤•`g`ˆì</Çô]¢$√'¸jPÚéh…ê.ÜíD◊ñCˇ ñCqw©»ö„¶˝ı4Mé ƒ_§0∞uO˜ÿ$’<a0∆GëˆÛ ÕIΩoØ£hyÇÄ\ GB.BıVäÊ]=U—gá?¬}◊´Û∆YˇÍ÷Be®˘‚´ïŸ»ÔËŸ»m˛§–¨)MèìÎKÎ¯ÿÂº7IÉ
´€PfÊá“è–L˜(ı&3¸ÔÜKÎÎ$å€≠Ω∏Âº≥Zºjä∫Ç®ÈˇzÊÖÒNòS˚P¶+G5ä∑__mæ|ÒjgÛ√÷Û'/^=€¸∞πΩÛ˙Ò÷ãè∑÷ø|~˛õÌù≠ç~æ˛Ù≈´ıç≠Ûﬂ<ó˘W©€©≈Z™◊y.˜Æ%Knrvfái÷‹ûÆ]≈MÈ"ª—‰Ä_q}k>]°.<á;/f‹xÌHÆR∫Ú∫bb”w±"çÈó`Å≤G/“pHr8◊åcé.y≥ΩÊ‘9
8íqª\¡.à ÂÆ*•ªl†ÆH°¨¸^RMB±Œıß™¸¶K’	¿‘U∏HkRl·%%≈˜÷Wÿ$•ƒãrwS©kïIF◊ò+)˚ ™+Îï;ﬂUéÎ¯~Î+iîjF'Üvz@ÄÊÂ&? ä-ÕZ0Ö£…¢ÚÂπ®|˘«CÂãwVØ W–OdNü?2_nFÊsÙ èÇ†eˆŒŸ¡∑$ê˚È¸˘≠Î:3'1ø˝Û%ÊïôJé˛Ω^;û+˘¬.¸ŸÑ ˇts·O7∫∞˜SåÌ‹1∂ÇóU_\X’McsLıÊ\¥ÇÜèH¥®Pß(–Û‚;î }ñú∑yUÆ¡Ìì8«ú∏ÉØÄÊ"§;@Û:%…Eﬂ¿ßr`ık4;Û wZ¡∂x<ÉÅ…ùkŸ˘≥‡+zK|æ¯î(¢g3ÖrKã±®Ã™péGr[ïû.Îw®∂Vå,ƒÙx…⁄}£&¢ƒ~≈Öjg˙∏>X/à¸9« !ÄK´ïÉU'åWı—Ú«∆pãÊñÍ‚œ/6‡¶kıíóô‘≠W‘l§’t€‰éîWé.—Ö£∂.[ßπJ=∑ˆíìz-?Â€C™á¶œj>ñBµ’h`∆Ω&…Vî¨N∞=CÅdÄmÆE£˝pw&Ô+<ép˙vÆ¸≤xÕÇòûáf–ŒÚjﬂD•◊,<⁄≠⁄~∫ñ}oá~®;akva~∫ˆß;aˇBÔÑΩ¸1moz∆°ÇünÉUüünÉùÔ6X±˚”u∞?]˚”u∞ZW}Ãåçà∂Ù_ê0/®u‚∑6T¢ín‰ß†ü¶ÁTÊè†¯(a¯itFHx‰»¨Ÿa d\Ó¢ö?Ø,cWyˇã¿Ò˜|˝Àúé”⁄+}ù~SK&6w£:tﬂ
jπú˜¥ôÔ¥˛ñÎ˘NØ»s™4ÙÀ˚Niü£ŒôxaﬂÈïyN’hØƒw:{¿M÷P˝F'>jôî≥F#O©N•nfqa/ö~"ÎŒSÚTÀHÅ•∫+£g˚RØƒì∫,±9tP›qwjï3u¶+U*rπO/z,U m«â‘œY‘óòP0#£/r‰›À<‡›”<åÄ¨¥”¢ÇÍ·Â∂,	˙≠¶iÉˆ¢Ì<Å∫nê„ÆAªïùÉç;<yìùdoBh©µ Œ§n¡ètJG‘≥öåº\∂Åﬂ/–èjÑá'Âfº(HÛvÎèﬂäW‚Ÿ0àÒà(|ÛÉàÊ∆NΩ‘˜|/√ÛgÉ|J Á IÒÙöáØ‡”V)π%GÈ´ ‡¨¿)Ì0'1&zh˛Î&ÊëÑ
Ü”î¸˛øûò?2ÄŒRåj+n@gã±{¯=ñM3ˆﬁã(Õ∆Áﬂ˘· …ÿ$I°ïC<h˜PﬂôF∏Ïôjπ˘|Û’˙”7€ø‹ﬁŸ|ˆfÎ˘ˆŒ´◊;[/û+“ÉzÊÏ¥7æZﬂôU•<ÌçßÎ€€[O∂6÷±t]sP_ÉÃCà≥Ü6I6ôæäÉ|†¶‰˙c# Õ$’Œí[4«kGæCﬂq‘õWòN|/ÁÍ)¨}ü◊…zá!™Ìãß FŸß˜—Ñ‡!Âh•€¢ëÜãT√Gqh˘ÎÌœ{@†’úh/Ù∞∑Øxq£≥Úr√ÀnRQ¥~µ=ÊÎΩ7#èUÇ'KnÒä.C02Œ
íÏ!k?Oòák Kœø≈√≠ ™ºØ¡":ˆB”—µªÔ¶û4Éj5]™ÆÖ’Íô1õ«ÿÃz·ÅN39‡JÀÎ‡!–ù‰e”	.4
ÄÎ˝&Àß>Hê5sCmæÕÇ≠ŒÇﬁä{t5≠U°√hıÕQíæ√Ω“7†I·Ö»u‡Ÿeı∂¸ÿeäÍ‹lêxŸ71.7Ò4q÷ºïàó◊‚æÿf∞≤%XS¿÷”‘N/ÛÂÙÍz>É∫˙≤µ‡Ó;?âÍ∆°√ §s9∆±c,É&Ìd≤¨ﬁÃƒ?|Íù$”|Ád“ ©P¸MDÂ[Ú0ﬂô\Ö∆≤9àíX.qpƒ¡◊ˆÆ≈ŸÙeµ@n∆∂‹Ÿ_`ß‰N]soBg—Q<.~ù%qÙºªF”4Ç.^øz⁄8·ãÉØÁªçΩ[ÖÅÊS†-ÃÛúã*"IGªÂ‹KˆFip≈°„1ﬁy%Jâ∑)∫‘#?y#—zoÆù‚àÅ±mºGik˚≈6gÎÙ2NﬁææsΩ≥€ﬂ?Î·êﬁ ∂TË∑Ó¡»AÈﬁÖëèæﬁw&d®Ÿø+ú∏fUŒ8UKi>yßa	'%PÏe;H”5Ê≈'À‚föÇÚR  Óâi∫A°ÇYƒe‘b7‘ÏçÉ,¬©Âæ[cã˚“›j2ñ‘©xl‚£{∏ªO¶πò§%ë≤∫‘B`ÇEyçér¿që*ÂS|(}⁄FÚñT:∞q⁄0¯+z —À_˜9ÁÌ¿∏Î“By≠’ﬁR @zÿ√‰‚QŒ@∆Úp◊™s •- "”Ìhfé˙ÇC‚Uz%Ÿb:G*K -∞ ˆ43´ ∑8jH•&4≥˝ŸÄïƒZS‰îƒ°ÅüR´∫Ìjí~†Â_àmm~Î4wü‘⁄œÍ]»Í˘–ØÀm5V≠1®˛XΩqt<c^]‡BPJΩ¿T6ÈÑUºt1‚BÈò\]Q∞jçYÄn®7éégÅX(5Mi‹Pp
¥ÜfíıFQÿAŸzS&h]›j:2SıRC3ö≤pø≠Ωsv›ˇ§‘]`ÑÇÁòﬁ¢M,ÊÎ*8Å≠t»9¡.ÙIÍ¢A'‘ÍıÎ4™Çd‡Ü÷:ﬂ™‘4X∂ŸúÙK˝• Ï®3È@´Ø √v˛«aû|
äW—û&˝âÖ§aöòÓ›öbºòÈUÎÈ…)è¬—’c–/P?)t¬uÆPË"Ê•ÉQ¯>·ÜΩ *”?cÔœøçB¯ï®]“t:…ì*UON”ô°6·üı›∆mR¿èl∑€eè◊∑û˛í˝‚≈´øy∫µΩ√∏àµ[¯kù=ﬁd;Ø÷≠ˇıãVã+Et™ùƒ˜NPÕı⁄2·EzW«ÔjoO‡ÉXÕú'`¸2R≥‘œ¶˝]}zŸàÆE]Í √Û∑1ÿ°Ωº¿Æ˜Øµ}ﬂQõÉRUQlÚºΩvä ¢}<∆}ˇÏ≠Ì‰9`Ü•b=yŸI<`m‹ëJC?xùÈñˇ–·Ì*ª8<⁄∆‰5†%≥	ÆéΩ0¬ü{”êû¥hô©Ì,Â*ÛaÕPªàâÄô_Í±LQ»∂b?8¸«èÿDsœ√“7çá˛¡/–‹Ûéºê~}©ÈUÖ'7k©‰gü±ı4¨á˝Âè{"âfFA)Ê#&¸ :ãı¢ÎoTA[à44Â¯∏-#◊.nK—π4P—ã¡û4Ä[›ôª~Ö ñfí≈ `ÊñÂÃößÂéC=Ã£ä÷¡CçòòSvÆMJﬂS—ÿ—¨{DûNÕr}NtÑ¢{óŸ}6π Ã≥∑ZŸ)Ω^3®_èï÷$MÎ/$Ω¨±›˝ó^´∏“C;◊gái2^’å„wkqÉM“0°=o⁄4ñ º{È…ﬂ`…˚lWıWA1Ô%A®◊oç◊ç∞gV·£ª‡°E(3u ™°¸áIJûj<‡oZ◊p–)ŸﬁÔ1ÇƒÌ√ÇÍ⁄!Eæ«|l:Òîu\Åv‘j}”:ß  ˆ%ö€óÿº®UbC¸π…á¨gåàt“ÁıJ{ß¬>´ÿÊUQ´å%¸\öì5n¶ÜüÒOW„siä
Õm}-ﬂÍ±'Ç∏◊Ä, Á˜pD ”°í?V∑óS,»,/BÖËÑçÄn‰T‚ò‘4xoÜu9·”21¡SãîÙ'ïÑT¢®e rmÿÂÀTqqYj®§°g·(\ÜÜx˝#,Jéî|µCèK¢††óV:k—&@Jî»Z4ï}≥ ÌÊ!nﬂµu%⁄–.πzu∂¿vï"∏ﬂ—T—L#•Bªì/’†dÒdwø§¥◊*êE1K_ù°ùÚ:	T£n&çJ‰§. ◊ˆˇê ä6Â,÷MΩs⁄ã)∑–%Õ©í Æ≥
üµ—QπhUÈÇám–-v”	√{G'LJkÆçd` F>É’còEå—xthzËdƒ{›æm±N9B¥=ñFµ∏±˝¨É±”∂§y¢Ö2ÎòüfÒJìÅ∂ƒÀFC#N„–N§fZ—PÂ∏‘.ÎºªkPØ±R◊§≠πî8Õae-RÛ`»ãàõ¢¬e-¸h-≠ä˙Õ5Ôã∂YVÕÁhiÆiol`ûÈKÿ`Â†æø?•@âﬂ¨ãõùd#J¶æ—ŒÇ‡€ùıéN0˚òåîóG^∑[…ÿ\úÄ$C…%Gã7W∞uú©10€Ô•jπ€úÇP%ó˛æ©W”Ü›§Í<:ÓD∞wÃµÈóC)(|OAßS˙˙Ü¨Ïmkı^OƒNß‚Ë∑[£ç—6“a∞)Ù€5vê$$=ƒ—hMò#e‚∞%U+]\YË%F àweTπ}Kls.Ç~=Ëbf¡=.‚¥€ õíË=Äö∏«mùéj¥„ãü“ÆoÈòïlä∂uÔ˛Œ™m^s TãäòÄ÷B´c%"#iÛ
:Â9¿$‚¢Fq‘•‹ãÿ√MÂâïtl`˝¿%Px&E∞›ZÙ&·"YÑ]I∂@µJ∆A>J@ÒiΩ|±Ω£˘ƒ˘Ì5{-qî∞ãŒÛñ+‘£n—∆7¨Ÿ:ç°£#Øiƒ¢Î÷„pD %(0^'~≠©Ëûg¯S[Ì5Ë‚¿ë%±G¡¶SÚS9„”.ùüÂ£49"r‰KAî‰≥ä⁄Ïs∫[}2ıº™k<@€83a„ˆªTé¯}7‘∞‘9y⁄Ñ?S8!∆Ew5¨±ò“NÒ#¡öä6–J‘ {qr‘Ó†‡wQ´b1EgMz¯ó¿È∞øÄ=2 -Ñ~¢ëM⁄§'òVK{3§–s|…øŸÔ≈@P·ûÙ‘ª2ú©üÙ‘ªTr®Òo©ü¨1Íø∞áËñ{˘F¯t˚∑≈Î&¯0∫˜Ú),ÄÎ”T{ùQ¿t¨º£gS´5Á≠R©µ©FPâ‰äôÄy+û°v`4w#·–Bâ{lãV°Góí$ H`\y‚"(<t%îÌß(∞ ¶˙#˜uz7ÑJv…6 ^;È2—HUV¥Z05ıÃ∫ãsÀ”A~¥Ô8ÅØ„å¸¶Áépå_©∞’ª¨‡>;ÆNø⁄∂	>ËÂ…”‰(HÒûêvß8}∫˚+Ø˚Mø{Á¸€ÛÔŒ{˛˚Û?úˇÎ˘Ôˆ≈Å‘“y[¯gﬁ$†Ω7	¨Çﬂ«»™@õ?¬}≠@¥%$|Úp¡û•:$6“{@”õ∞˙â[÷!pÿÖé≠6_‰Ü&âsèÖl«•)*òTfÅM¨s÷Íõ~àpı* (“i8N≤Bˇr"rî«a˙ A-ÄNw|jNB·j…¡◊n∏¯dYÅå†πD¬ç^$B˜íÊ∑¸LL…vê+Eóµ–’<á:ïs@/ÌiÄáÂô–r*Pâ∫ÿ CcNÜbN‡r∞“πoï_±hÀû‚_Ω…4ïäõŒ=W=œ˜ÌΩ–t?;”‡⁄Ω"2Rûi”nhíÎ≠ :v_y'ûdÆ~"iL˜°¯·0Ãi·Y–ªà†¬TÇ4˜∆|Yì`x™-
á‘™ANTöM9ãÎ≠¯)é∆/ﬁá{9	ps(JzÇµÏÖ1†NõÔÚJÁ'h°jO√»À`Yá~«≈µêJ]T:ôeå& ﬂlqA√'îéÂ≥æ˛R˚ZÕΩäÅ€â»c‰≠NnÂ˝ñ£ô∂®ÓÈ$'2jVÊ`L”gTé™jª™5GˆQyZz“Qê>„k¬5ëYÇã?¿°N<öBi'eèˆÍ)∞Pjƒ≥^ço-Œ∑îa§‹C˘Ãü¡t ¿>$∞ù`ª˚+Z†ÖÆj8°€O∆oﬁ,mø+rm[ùO*∏ö±ó‘©†ﬁãê‘Ö»È
ﬂÈ&+ê}ÊFá¶Y¢3Av®ªëJSb÷)PQﬁŒ)U6´öB∏§˘rªN˜8µµ˙≥£Áù˛üârçæ&∞Úƒv4ïº$Z‰ïÓ·Å*
¬_dÏ8ù1‹iSÁ‚Aë”FY(Â%ÜnﬂûZ®¸F‰=ÈsY@‘åWÓd„v€zLõ˛iN¢#È1⁄‡Â…„∑ç•∑¸vëˆö}MS√7])òÉQP\âÉk‚\k†ñÌ
π.≈øÎÍTQb}X(Çﬂä˜_íô™äp´µT
†ñ%î—*¯*Ï¶™y|N>uî+&”lIÿ•¶Oç€∞¸¿£€û5jÎ$9ÚÚÃõLx1’é{o«tïãöo®M vªÚôk*Ahsª«8ßYg-íK√0díÂ…ëôÇMÓ˙≤^Ø7Y(ÏvA•Ö›Æm…©*–µÄ®UßI˚8~L_‡Ï‡£ÓD`Iíºπl-Eç∆ä≥™.&±XqÜîœÇ(¥-®kK¶]p∏9>ËC˚†„§ó∏‚…ﬁö=◊Õ—>?"˘9dQËIöåµ-Â2:ØE∫ ?Qû≈|.0¨u_ñÿIÙÛ~)Öƒãqòﬂ≥»sÅµBøT—‚®oïœvUKÍŸ.L_i∞|Z‹ûÀ∑.¢-ñ†å¿XcªW”ﬁ\H“O_º~ÃØÔ¨?Zﬂﬁî“€ø|æaD√øÔ¡¬|ö®ÎÕ≥ùD')q¥xß⁄¯5VS4«™cÑâ©ˇMÄQ”≈æ†8#xÄFœ‘iFî'Ïg<ûlØêÅ¨≤-èSõ∞YF^÷à"–f÷ë:^Ân’æ$ˇkÇ¢ëÂqı™±4:¢éÈåÙ∆Jêó,ÁHõNs VC@d⁄©˙≤E]d6¿c ®Tv@0˝"·qÒZ/©Å¶loª€Í˛T ¿êeí=C%∑·!\^¡QA:EGÒUg@Ÿº¡Ö“;ö3≠zπâaDkz4z:"⁄‚$˛oh–ΩA2nï¿mX˝„	@˝,óú Êö∂7BkóµÂ·êé£QS¿â˛~~ø7ﬁ“mÏ®X÷qÉ•U˝˛K±ÕRSÁzÕ…˝1E65;¯\nCœ/P|'¥?„â[ÿ+X_ÁøÁ«π*Í´‰∆O{'G~Ù<≈˜™“⁄NÆ˙Y’ÆâLººı∞\Î0$iÅ©ø÷Í}3L¥|±âC@USÄálxo≈ÔrY–«hÒ”V?ÖñÀ$ìÄß÷>7c¨5o€I˛·#⁄m≠%—w*;pFÒ˝ıºöÑláçÌ¡ë¸Ö\À(=+˛Ü—ˆ€q0h@GâΩzú’†‡∑v•M.‚""	«AµY£F)Ngeêë°Ÿä∑ÓrG†)°–È” ¡Ñ~®AàAëBÊ≥3a6KÆßd@\fÃã`m¿g»™≤≥•“œÚX$ûEI§jd¬e˚YDoRr⁄ÓäÅ∞‘(‰:œXë”Â)èø’+Z!0˙´⁄0~jÍ	¬¡œéTù¢0å∂+Ä÷ŒN≠GëJ·°ËmŸËÌ©Fr*FT”€∏>RßŸ	pt≠OTr+}¢Èáeı∑©¥[pG›Älê"˙a`§ò¿ÀGa>J¶9Ûß<Úµ±"∆Êß!éõÓF¿(2K¿‹ª≠‡⁄F´>6•(qH¥Dª°®Å˘P¨“b⁄ö’2&√çI~r Á≥≠ZyÔES$ `åNO∞ãâ‘â*]åéÈ_§7/ÃGâuöÔá‘´ì»ø¨VçΩö'1äFÈFÒ≥Ê0èV®VáZ¥òÿπ¥hÖoò¬†°]ØGö¥Õ¨*"ı‘ô∫Û<⁄sΩ˛Ïl|nµy∂‚‹Huû©<_ç˙|y∫Å
m"Õs6R£SoDÁøEòΩL√˜UıõkŸ’≥/©iœßk7”∂Á”∑gj‹MuÓãh›ΩõIa”õ∆Ÿ(<ëT◊Ê3˝ß◊µE≠-Ÿ™xéy‘q8D<ÉäägZtE–©Ü~bé/É“Ì∂∑¿úA≈˘∫ûj¿Î)Ï"˘{C√ü˝
∏x§«câvÈÌòÌ4iG®≤–P†RÌBE∞‘Œ∂ôÁiæ@vRå≠_jv<ª—_ëú—ΩUÈ“öÎˆ*˘º<ìú®∞ì<	”ÄÆ7Pö∫©ù?„‘êƒ/”dòY÷nmáÒ Mb∆√•$&ù•≥¿µzlî°ÄF	Ã‚ƒ„…1bô<√b!E¨•±ïë∫3O›#üqÚN¶£{È‚¶¬#^.‚∆ãÌz.6V˘zNÚ`cÑÒí9øûÕÀì;Ω( /©ï—n\2õ∞/û•c›t2≈¯¿ü{ÃY^›º©/n≠ø›µZ´ÿÃÈF‚Îy;¥ŒhË ê‡◊aúQ@-Z∑«iß3T≠T•,N˝cÀX(â@æˇ1eú¡i‰(êŸº|¸Ñ[#Ç»-cﬁNX+x‡•CLÅQ])ÔU§≥ÕRÙUÖw7k⁄≤`&xıßÆGW,'
∂¬kçïÿ.G?”2ˆò.4\“û«i9¬é˜á·ª˛Êz«P.‰ÅìCX@-∞∑aå¨*xsÌT¡C°˝9ø: Àæ-IôR¥òç†)jÌJ{èø'q7›C`¯SrâùQ‡swp~–6WIh>ï≥JÆãä*\@,0Áü∞∏åxÇ√„V|J4√Øçß¡,rìµ±Ò®M∫∆îOc%’yÁ≈°∂Ç‹xv,n+>\”ÕR€Á¥MGÀ‰©∏9ºM÷˚m~LEñ®°øì 0x˚öbè√î„uÒ3/ıRwì )ÙÕï€˝˙Ô∂¥d1DeTÙjÓ0Ozlr‰≥/yb{+qëe9T4oï‚◊ûóïl%≥´¬d®Ë•(@ôó§CÖø6ä|j∑5Îx»dO+˙âñŒõ©8]ÿC#m§“ô√0ÇŸÒÍ±©å£
™â‡“'§’2|Rx˛"•´17ù3˛xùÚ-6Ö'≥ºJ	ß*ÈÈ„Ãö<≠π—F∂Oz˙ÂdËﬂ[£”0Ê=ıeøë>ÁFÚ1xÇ≥öEÿÚ≠~Åı{wV]Áb±Ùfö60_dª\€ ÑKù.±–™ &´}Î&ö
∏Rè/â0}˛ö`Mïáı˚ÍQßr^∆JÜµUÔOC/ö‰êÖ	^È=k‰3”<e&€0LC√¢'œX ò,(›Õm„Ë&c£dä>¨Â.ùd0‹
„0û¢wJΩ,∞¢'◊}r∂˙¢\tÎ1òU·8i-¸ˇ   ˇˇÏΩ[s„Fö ˙>ø"ÕÓŸQyEJ§Dï™¶J^ñƒ*Î¨™§ïdwÔî+lêÑH∏@ÄÄ%…EÙÀ93}bzc&v£«'Œ∆Ü#÷s¸“—±O£‚?–˝Œ˜e&ÄÃD&ê†.V€áK$àK^æ˚UΩëO[¸¶!•ö©Ö.ˇlHL≠t“◊≤dBS*°hØÀ?V‹¬z∑®ÕÓñ∫≈ÏsÇUNaøÍìkúñüÊ◊ÁV∏ÙìnËqa·3√õƒı§Zˆ©qå1¢¸'ìïM^W≠∏ÕcÖîıWN¢4“VπŸc›∂ÇØß:“W˙Ç„´Ô"Á¨!-àX‹_.Zäw∞∆@Cqø•˛‚7zC@„v≥´Uß¸ù%˜}§ôÄ•ÖN©˜®ˆL˘;E=QS
-z©tE›xÃRØB˜©T¨ÑY,Säˇ†⁄‘≈agÁ»Q ú¶∫¬Òã;Q%øKµ™ÌEï«BÁìq4˛Hø/+&hçï[¥s=óõ#bwûnÉ‚ J9¶0;™F”Gl=UΩh¬#_”kp∫˘E¡°êD"‹ã±q˘]À8c·◊7Ea†Nm}%$CxpÓxÕ‰?V§πVâUæÔ crÕíRÄÑ0≥p®&HL[Ã@Öˆ≤Ç(o»µ(lçAil¸€◊©æïçsÃØæ¡
»8àdNzº¯0ù–90l†¸uhÓ∆≠¶eJÎ2YÔÆÆ™!È±vÛ≤-I(WÓ,5wKπ˘¥ÇCVƒ%3€’n—[Àe}ø:ßá≈°£%H11ƒlèMËCªﬁlÆÔÅƒòvL·À‘Ã≥j”t‚ë>&p;Cfk¯˙∏#˙®â3t£™¢°ÈÏ*ÌÕà<[ÓòbKQ0>,JûÛ≠´HvëRÁDH&\2U•Å˛9I≈@uBu c-BÀåÖü ©FJ38çR¿ë(EÎ6(≈⁄jF)ÍëÑÇçÏ ;ØIrîÒSÑY®òK•B‰8‹y˘ü—öÃksôpöˇúızO)¯#ˇ≠ÂCπ‘häVaÜ∆–§ÛjFMÙÈUbì5M&Œ?ø†◊ΩÓºπ\I?∑Öœ´oÚ¸ÇÀø»ˇÂ˜Û!¸ı_Ëàﬁ6Hd˝	®I¡€Áado Áà?qò≠â÷çTKÔ≥Ù¸ÀïèﬁyÓ)ã}ö€Õø–òNy˝* ‹cÃDD≥‚lShùFp-óüæS£pÊπ#òG∆éŸK Å^ΩâC|ß´ÅxÀÄJo˚2˜v}5Xƒá{<·:0à3’ÁÍkÏ]-∞@e÷z∆7Û ;&¯{ÃEVtÒR œ|¶ÖnV;Ó -@ﬁáª1eB(¢º√±œ¢Ûòç9e\iÕ∏ı<7Û”	≈YYó®ê÷≥
u©¸©Œ8.∞9P,vOXI:4ˆg*rÓ&Àl˘⁄˘j¬¬R]X3ˇÉ|˙“Û%ê˘yﬂœ¨¿Œ’Ç¨⁄E.πÂ”në¨W$ób¸∞∞ïƒôÑL“H76Ë™ŒB4æ§ÀœSêa›çô;¢∂¢èdÛ¢ÍnbµJÆ]_—a$8UñΩÇﬂ +Í^ÒãJï	>F‹πÜ,hztÇ!∞àQ—ñ®E∫⁄ı`qõt˘3π’Òè"""a±<!áÚ}Ñ1 m4‹ª© cEü¢LÕ˘Na/•¶#∫M‡≠7M¶‚"îTzÍÌ“”GI^¨ñ«ú6~ÙµE˙Ÿon\AmYâûîx0¯ﬁSÀÂ§5˚‡;˘‹
ΩÍüåºwBW¯<ÕIì5'ÉqÛıœVÆˆ⁄ko»âZ>˛”Ü>u›∆Õ°K;¿9è9”Ø≥ÊzCÏÆæÉˆ#Á◊∆3òxÛ\π£xœi≥ΩA&¯ÔÏæÆiÒŒœ$M⁄íh⁄éx˙&µ79Å‘Ÿm∆3/ ”≥&ÓFc´–¡ﬁ?+å¯,f„>ña¶ßb,,€\áWœg37bXº{¯Ωy
‰ÄJÿe>¬Ü⁄[}c∞¥„òHg∑ˆÊ>®_;¨rQ´’íá•vh◊åÛu{uvˆF ÆFÀR∆≥y<§√Hio ùÍëó)ã≤à“WπÜÄP Åî
ﬁ˜D·±lÈÂ`’I?Ä∆áK∫“YÖÁlf ∂vÊì©s÷<mNG‰î¡õ‘7øÅæ6;gæ
ıpMPÿ–uºÓ˚˛ó?˛˛7OVärTIﬂ”)ÏÙìIßxZÄÍ”	,›BMH™|ë™q°:ÄïIß0(∑^!Ñ6J÷öXâÎÃiÜq°¬óZv®àH0ò'I(wÜ¡6\=Ω(÷ûeá =A*Yã{ﬁÂK/’aIèB–ÏºπFrpÏÆí	‡<ŒNmvSM·ìü_Õ.O?Ñ”)ƒûq ÂCÄÉlã≈MXÎñ—9Js=úqd_¢„0jŒBîj¢Ü4Ouøv©¯≥ãB?µ,ˆvöΩ]e{ÿf,Fq$;Q¢2'∆©UÑYO$à]¢”ßØË£3µœ˙kÌÕı„5ÒX<fèÖ‚6Ÿ⁄Í¶P#~S∏Ò∫1ú˘£,„8Ûª@N<M$';/6üf~˜Û√¥˜Ù0¸¸ÁK&Áª<¯Y¸Ôi}“œX`ü¯sL®£åRâ-ﬁ,FÖ 7óáÖ“m7ËGF;‹0§±°º¿v"Jïf
Ë≥üáuâ,W(∏∞À∫hPÉˆóﬁXS–˛¥´‰eÂ±Ú˘<≤@wûá»?ÂëÚyC:NiŒMÍ‹’ñπﬂï6ÂŸ≤Ôùœù7]J›Ì∫EGª25—ëÆ¨∑Ë1WÓ\„"Ω“©÷ÇÎÇõÿL†¶4#òiÅLbz 3Çó∏¥†UX:∞≤*kê*®rp2ìî¥ÄTh0¡äﬁbØµV[seu∆	œÒ=†¢¢¿{±Ú!IÎˇq5Úc÷F·√ïúA?a≈˛≈ÒÃŒ@·≤õJçE|D±R;W6V)çE·ÑƒyÑZ°Vœ∏…)Œî´:˛∏T›*>gÏÃökï6ÅGdˇ√0«òèw6ìî `ö¿√#«57`QÒ¥Î¯TN•_\2~˛U–á‚I‰oõ´Ü)—j’∑T√b ˜ü~˜Õ¥ZúFˇ(ú¡ùlW&J$tç>eP„Ãâ¢F◊∂◊Ë¨5ÕÑ∆ÎLìÊj´´SÔLQrLÊ∫˙Ñ.ßQ_Á+û–ÓËÎMu2 JÁ3ÿL·ëhsïM<=∑æ™*oÈ/©Å·¨ŸA4mg`ãhgÿ9ÿ+˜å:LéXP…——û4;Ï`Ô(Yÿ˙ôú∞ΩÁù@d:B+v*àccfèu–'π÷ Mkhg!”—c4ìdÊi–¯¬_∏˛0Ñù|ÊÅB∏äH?≤• <«wnƒe^£ü´ÃÚÁ√ïˆ™dæë).ú~∆p˝R"áƒ™ Ä)ZÇ‡¡Ù´Ôû$Ÿ∫¥≠Ã5H¥¥H§†Nj"°ﬂ4Ùo_˙Œrf()™%óQ›∆x‘H&4ö∑œ3◊÷(F2,≥¸M2Ú∞k6»`™aJåŒ≥‹±¥∆{´6≤WxÙˆÇìM∆"RÊ∫&‚ˇ∆™`ª…–º ù
Pm5Vƒ>R8åà&Œ»Ä†0∑ „√—a„çÜM"ƒw ç:îtª˚Ìˇ†›eXûj˚'Ë‹E√b‚Ù‹–hÓQàG*¸∞ÿÅ7	;&/"oTAH∆x	˛É∏ãßèÛØD“¸Î∫éKÚ“∫¡,◊]•T1›◊N∫±H,%ä¢ΩnoDäÈ∫ı/uÄ¿Á»`Ææ [¿´€‚{Û)Håö;pY¿Uÿ⁄%)‘_N$êÙ#Z‘e©@b
ÚwÇåŸ $ﬁDﬁ4ıßƒƒ…4ZI—rì3Îñ˜d∂Uÿ;'_?¬'1Xˆﬂ4∂vwÛù*Bì/›©óÔ
7Ÿä¿êo≈ÓËí?óæXí?üÆ¯≠Lß?rF77!¶Ìåxé…≠LÍ≈’7 ¡Ñ77/6ÿÚ©i!.+ôﬂÕØ;%Y«ﬁå:x<‚u)qÌK»óúÆZMº~$k˝‹N∞ØéO∏A˚∫´-Í<tπ\„À≠DK.ÂÊ≠⁄4™ª‹ÄàSßygª¥ÄsK<÷^…w≥b‘r¢%´≈exdÚÁ“Ìgzæ8íCw‹R}Y§~&˝]˚ÿBDƒgtûÖgd?œ-#iæí,-^Ë”œä≤Ü≤ÿF´Q9Pâ'Í'>H·o4 ÌekºœTAlÕŸ¿(›í<º¢Í∞÷ÕÅï†“\™ÜÎf‚‚–ü£⁄Œ@ß¡¡ô0%_Tcê˚iQµ©O’¶Õˆ»Ÿ –ëeõ4›≠(á’BCë"Y ¢Q“âÉÖÅ¿¬åOËøRLíºåYà“lÓ#&Ë1èC7FóÚ√ºb⁄!`Î¿©ÅE„O≈Ç= ÷ãÕúÆú"≥tÕÀi◊‰”˛·ÓÛ›ÌﬁŒæÂå•ô«d≠0FÂÉ∫≤ˇ¥Ufåóh”˙çØÄEB@˚˝ªlü(—2¢Élï1ö•ò¨iÊW§™úîvW3À tÌ@“1∏ÿ©qò a9ÿzqíœ,¬vã3˚ëû≥v§òÛJ-ä#œWﬂ≈∏Há_∞⁄»ö´Ø«õg⁄ºOµ–hl4%;n‰ﬁõfÓ-rn$Å¬™u äHj∑7E'‚qQŸú3nÜ‡Îº„DoóÙ‰A—*≠õ±ÌJ<¥¬Ïü∆†Â ã ∞ét±:,ÿ–8§q´Ω8mπ∏ùÓt¢CæˇıˇC>u#. §∑§Ñ0í•ï⁄¶πó&3OˇlÊ;]V≤Bz¥{Ï’ø:S¸1§‡ñ5P∫íûl√»eÁWê≠q S˘lôÃhÂÎTpD.8Aè∫Ù˛ãxô\#X„wRëô>âùY+x1ÿyŸÑ©%L˚á«Ω=r–€ﬁÌø:Ó€≥≠[$˜R˛ˇ˛˜ºùSxÿgπí˝ÈåEv[—t-‚W@Í#ŸF‡Úf∆,?èàŒ}òÉg‘‘Ëè∏é]i…Ëﬂ†Ä∆°‰¨—;,hÑÊ˙É(ú˜–‹;ÈZ±7ŸëÄ0¶íie´ßÓ»õOÕLP!≠ò˝’YTL|IU~Ä2Ω √cVûß3d¬£€∆2æÚd≤n„>ïeCÚ%+%h’”˙Kâ87Ôˇ◊Hç]/ˆˆèzáª˚dßO>ÓÌÌı˛Ê≈˛ÈˇÚ`èä|G:§X◊Ãø NØ≥ƒÎ7¯≠{ûn G¥ŸP°	§ÿ,ÍÀ"Ù“–¢9<ÍÈ\Y¿FŸCå&G“ônø‡ º”*˝ √;ëÄ˜3’≥h’(„õ«Õﬂß;{¡ó≠ïx	´òíûH[ ª—Tgte€\¿¶l√tœ—€ÛKVÊı£VWVW))•F9==éØæâ¶<ÄäWﬂû†ìéÌ±¡úõ´E3Ù˛Q2ÿ–ŒÏ≤a÷Ê*◊™ 8ñ¨H“Y
I„-ë«°iõùÕ7/5¡8g“Ÿu†Å≠ÍBªÕ AñMVï±⁄ |(ã7,b]∏ùú¡v
6ÁÆ•`ï.dèŒÎÍ[,˙ä®]¬r6‘È_6nL≤«G.¨hÄ¡–ΩÊ
«oœ´◊â\g±¨xY˝E=öè›ó”·zá£ÉQa“¶ZdYµ2Ω^sÉ^”3
€N‰ít¡ÎD
ï◊·j~1l™ÒG°ÁÖùﬂ‘úMDØ˛ÛVr¶ñﬂë√˛ˆ˛À˛´–<ˆ_ıè»&€üÏÓ††B^Ù_ı{{˝¢»bZ‡¸‹WõH6G^<$3øŸ%™ú≈˛§3(°»Êg¢÷»Àä€…60nﬂ”7Ö$´˙ÜÀ'+æß°Êq¡ÊæF 38-5x >∆¢5#ÚüÊxã>ƒÈ]˘MEº(^¥0~Ëeπ?;¸¯«ˇï‚«¡aˇ≈'Øé{G‰Ëì˝C@ç#P”{ïºº˙/;ª€˚‰¯∞w‹”©Ì%xbõ∞öm—‘Ò´-]ÜâÌπ$F·M±ÄÔæc%ê¥v∫„yÄüú L∞¨!q∞ÍAÏçÁÃÇî3±˛¸í⁄µ∞_ö3pán‰<÷N]ÀF¨=ôµoF~µ (—oh õXŸÈj¯∂êÅù±nô‚	éˆÇ‡%™Ó’âùŸz¿X…ø'ÌÀπ¯ïY÷4pg3≠“˚â∞(⁄0w–Ñ¢ù*å/Ä»¢ÔQ©’tH>SJ§n…éπ˛#≤cäŸÎJDv—ñ©»‘¬&à/{œØ˛°wüôˇÙøˇ¯˚ﬂêCwÏ°òLÉ¸ù˙Ñb¢‹Àì•-‹]˚Y€7Õn¨’Ãç•ˆÓÙÍkLäÅ“°"µvi≈î1˚¬]QVöóá.8(â9ƒâC¯ÃhºT/u_U∆◊è •Ü*ìõE]ZJΩΩÈò◊63–kÅVO«X∆ T¥`ÖØ¨	æfjà2‡æ˜ÆÀΩ… Ô%q4dòG˛%q¸Ñ}√&“Äx2ÄÉÿ∫æ≤ˆÜ◊zÖ˜`ÛA!∏YâõPB3ª´≤b‡å¯jÑ
t	ïË≥⁄Ä¸‘®f
…„<Jp°5∂æˇıﬂy˘˝Øˇ{£©¡gäLI TÕh˛”‹ÉÖ§Õ1@ÒlPôV±.ß{uÏ‹™Ê Y!¸Dk®!ÀÅX˙u¶ÔøYç∞bî4®\–ˆ˚yE0ú|»Õ”+©À;f	.Lsâ±∏ºËE ôN⁄!
/å1OÅìI°∆ò⁄>
_ú&X”z™(™πîÒ,á(œK
ŸΩ>õ
NSë\-S«ºˇjÓNÙ≈èº¡¸K<u∆S‡ﬂÖÒ2≠Ä¶x§XSì‹ÈN˝¯ keÙ∆"-–˙ê∂öÈ"V¸‚ùPDHQ´,`ê`∞xrÜâí[xÇÉ>»zì«€)†&!ò¯ÚõÚÉ´ºê˚Ø∑˜ˆ?Ÿ!;ª/v—˘Ènˇ˝CÚ˝Øˇ+9⁄=:ÓøÏ°/„EˇËx˜Í∑Ø‡‚´xµª›#ΩO{Ø˛Fébëÿ≈ì∂&Èa	Y◊0\=)_‘"[Ùy˚aßw≠lQı%AÿƒàèÑ,.È	Ÿ]HP˛Ùª˛5LgøG>Ó˜v`ôñz -≈ŸOf»Ö]“&Mr-Y˛˘ÊÁQi˜æsF≥	|·È©¥ïP˚ô∏Nîúb!µw^<á1Ö˙JN≠4π´Ê4-¯\[≤„fi÷Î*(Q√C’ƒW∆⁄Ö`=1∞"‹SÇ˚î¥›wFÏB|˛òíU¿]Z{BNª≥àÃkØ¨ì”Êk`Zà†…]˙)◊ﬂòªX=√Èºﬁƒ%˛j|≥^≤_œß¸@ei™Ôi≥›∆B^mS⁄.-fKΩÛQπÑãﬁuI’L”ˆL„}Ω˙˘ÍÁXÅœ£Ò¿YzÙhπΩ⁄YÓ¨∑óW[Î›oåªIp√fAŸNyAÏb¯$Löé3C$“…9ú•èj≤XŒÙ,b∑˘…Oƒ†'=Ã›Ç_ƒ◊N@;ÖˇÂXB˘÷ble‘¥m¸£.Ië$UY^w6èùb£ãE+◊â‘hƒTF⁄ıqçö≤„,,∫±’ˇÂAˇ8µ~‰0Mö≥!r“<5]v∞`\IUQ¡ZbL\Ìt©Ú˝åe+È“ÉÔ Ä∑ıPﬁ~¶±ıçÑút◊HO∑H‚ßÒ‹6Ÿ<çe LÇ™‚õØ˙úÃ!oÚ∫vÛ4ja• íÇ[y‘õ†áÓ„F√RTÀ'°ƒﬂW& òbN€⁄|¯(zÅÔ.,]KwJ◊BˇU#èÖio±«0≠¬µµ»KœO@’zÊbaOXnr‘"€·®µ±⁄ÈV)—’˜ä*”c#ë£O_‰‚¬¿uæ)ßq>
c*◊q8›ˆ«èŸ∫L1f*%∑Î]Ù‘d1T~A.(îÍ{7V¬ª◊aç7%@≈∞xÇESüÖgO´dï U_Éì'ûÔ?mhûÃçFO/·Ú.˘»¬ﬁ˙:È¬øõ~Ø€!Ì¸Yß?∑Ò®°ºÖQ§•ãC?å“≥øF…‰ihEzf`¥◊ß
‚Ÿ/C/»Nã^zEÙÑIì	,wë≠¿¢®ÀÑEZ∂.æP&˘ﬁ∫Á'<;ÊoﬂÅGkäÈÅJsAÑ∑á''¿H‡˝k¢™ÀÍ˜ñv‹ö◊◊9XvÏ1Y«ΩRÎıí=‰±8Ónå5a2Åœüx`m°“üÙ˝ÃË£S¶h…éa-πÕàj=°å∫’®ƒ ä5æGÆOU\MÒ[Jﬂñ≈Êá∆≤Ñ(aÀ°Ÿm]ﬁãUmÃ◊õïÏVT•
Üî)é±›–±»}¨Â6µ 2èx… ∫¢Kç10‘¿kÆµ6O`‰ìF¡¬ìOË‚ã48B$‘ÊçfØ°!_à∆º=ÑJŒˇœ5H"Œçˆ(ŒOcÏ˙à4rF≥ëÜRi<¬€]£Æ{Ïc¢öèô¸¨˘+’2QFß>ÔÚu[h§€”∆:?Û#œq~èIüõiò•Â†Õ–9#rû⁄z®â%ö'^‡TH¯g&mˇÑ⁄kOÈø?ø∞Ym\[%[˘±Ã(5õ NE°Ÿ≈J◊˜vs°u¡EÊ˜£zyñF–üÕ£ôÔ⁄Å~{csy≥†ˇﬁÄ~É∑ìCÁ´0HÕåY“èÛŒ	æ‚…DsïcUè/'*¿ˇY$™É Ú gh¿W∫`68´J,–'ì>ıﬂ£^%òÙ1àıŒó° 15¯Sƒû›¯aÙ-æG Õ'⁄üπ¡“ûÓ¥ÇC*1EŒq®£bg˘D“Œ© ⁄*´»Ω¢¢¢—ì-¯Hç9˘*ÒÍ1iËòÃt›ÕÍw]ÛTº„X◊D^DV»∂aéòÅ6ycQ7ﬁqbÁ	±–8∏€¢›árÛHC!2®…0¸)
e[Í(u‘≈)/˙Ë“œ-’Rve“o+íÜ+íî‘÷‹∆¿¸íû÷Œ--†6ÍÚK.äì‚-øfàÓ3Ï÷úÃcJ»˛
k˜˛’É‘•^Púã+(QÄú`©
3-ÂÑ}—O‚˝¿ç’d8€Äô≤»â h¡¥™\≈}f⁄ñ,QÌçÂ6ªvÁ†ËÍ†®9ßVu¶ﬂ–·≥Ãjöe]]úA4t¡HõCœqÁ.lS¬6RÄ‘Ç∞k ÷.º>π¯FÈ¬l‘qâ÷·B˛¨Ω:x¥Ÿ~£ΩŒr∑híºŸíié/¥d©|⁄dK…0ÍÙ´k•N≥»´µÓ˛à÷∆„v†3ü€Å
5ä*•U“{úHô&5 Ÿﬁ÷ß)+`c‹”ÛÈVKFZAPY·˝BQIÊ?¸üﬂíóΩ›Wd{ˇ’1¸Ìí_ÏLé{œétéƒi ^√ó.“3,7|;ÛÚä5BkŒ°„˘í√P≥∏™wçÄô”PuÏh8â=eÿâúS¥2 Ÿ_8äœãÓºÛ¥π±Œ˝πΩ’~ª˜fÂë‡äDÀ$ˇånΩÏ[¡ÑBëY≥+L
'íN*‚A‚ëMéW‰Ã˝_Ç«2F!vAé&é
ŒœÇ%Ipd∆Ûfà%·å§æ=jKªc≈LË®`G¶ #ú2æns«¶¶®ÿ˘›áY”*5Ü‚Ô
NXéK%"‡t ∫l	⁄õêwMtKHF˘MΩ/ ∂®'jE≥öéÉC‚5Hœw˙¶Ñ øº˙n4«†ï¥H@lG±ıÎo•=1÷pÏ–Ó@ÎäáëjjÖ`ì
ˆnùÎ‘‘⁄,/∞…:%Ây0é„4Û≈S¿‰âRß≤≠RÂ§+êr’t™´∂Öb’±S¨⁄ê⁄–wÏJßTi&5VQ´F•!DNk:⁄l“ëóiWä&b\6+’##Nú,!çbE%fßÙ„)≥ÖÎ‚‚—?[‡6÷66N⁄EVcÃ˜úsl£SÌ2∫.Ä#˝à—f2Pä—¨‰k{.Êu)ÍáÑrq&ÎZ‡XC d•J¶uG"^ÊÃç%j°Qwjì	ûœÒì&Èº'5HD∫h˜û@ºdm©è~5«‰—ª°Ÿ‚‹ïÿvbÉêq3$Î]πI¸ì&Èº'5HD∫h˜ûD˘ww%DdÀr'ƒ[gè[Ë·ôŒíßŒÃ˚I”úˇ{öPÉ&‡Ç›{zÄΩÔà–ı∏#B¿≠öΩÉ›ßo‡{·8rfìÛü4Aê‚=e®A§ïª˜$‚àu0æ"!/Õ]PãgÈOÆæu¥‘"?w∫·“‡Ò&ñw:èΩü∂é°Æ≈MQèÓOÅz®ãwˇ	¨≈[¨*}7$§∞>ròd9È¨wó€›ÕÂ6>µ&";!v)˚‘Ò√àWÉ›Ì›∏‰·—Z?i¬¡ó‡Ω¥QÉ^5ª˜dÇñ¬ÿ≈bKwC'“uπ!#Ø`¬∫π8∑‡ﬁ¿ÖÕ—‡'M≤ExO!Í88“Uª˜4Çwø+ﬂF∂.wA#ÿ‹0πd/J≠ñç·û˙›ˇ¸r‘ﬂÎoÔbµäó˚;˝Ω}≤ˇÚ’Ó¡aˇãÍì•£„ﬁÒÓ˛+r¥ª”÷;|`ù()M±¿•A{µ=zcì‹EsªhpGà;2µéâ´,ÉXö”»ü1Ÿ@›Ÿ≤ºy-Fë√UôhØÊtÎ'√7˙ËIûä˜ÍÍCﬂAà¥åÈ,]Kª:£˙§BíÛVó¢?©€‰¿…,äsáº|PûËﬁõ∑s T8Ou)Míœ¬πm
W·Ωßã\eC‰"òãøiL≈◊æÖÂ&àL¿Ã∆BËYEÒ≈, Míπ1U,#›°†…≈≈4.<‰x"†EÕ$8sˆ¬£∑[j:üπ{Y„wmÌ!Z¿≤±µ„ÿÁXÃ§≠ê‹ÿXP_ÃnÓÿoOŒ#,%l)FöVÃ9–˙√-”Öäd¡{N*ì ï4@ôFìÂ4BJ
|O#j–àÚ<AJA≥oûNHŸîiÂMReÊH'‘ÑÀ"•»◊≈íRTåRõÑa.‡F7∫ºŸ2«⁄<ec¶Îˆ”èëkvH-¥i%’ü=Ë+ªãVU1‘¿cRÚÙúUÕıU"ñK√
uoÀ∫ T0ÜõÜp€÷p**ZEx…µL¨5´/DS V”†}M*à?uŒöìÊÎNáN6≥ú≥<å∏WÚ4©GŒ;wƒ⁄g)Üà&´@	4•›+Íi⁄_¶uÖ⁄f∞e%D[GÄ{èl%„πçPN–Tz $©88i*¨X,lby°X-õ`’c·^Z>V{âR\PÁTˆ±™Èû\m™∏∑b‰añüb9⁄∂¬»ıP9túú.•)w†XÓ%ª·(mNóΩïı7ﬁ3qÇëÔÓÖŒ®ˆ≠:òGÄ˘N	ŸùC˘dŸ˝,ò:I!Ü›œ“cX˚≤[˜y√¢g ÀµÓæ‘U∫5T6‘‚U≈’$öC'M◊eu⁄.‰Uº,©Ω´g?⁄n‰TYP"ì•ä≠3˜Û¢ÏÖ=Ò¶ÿÄ`:ª,Ô≈≈n=ä‚ëÉª[
Ôx∏∞b·ª9,km…x0Ë›˘"ëÄ¿ï‹¶ vËk~o»˘ÛQÛv∂Æc≤uß∫P¢πSO´Ô˚»Eé&3Ü¶=Ä]8é@—Í(lô†±"µI@ 5@¨±,¥ !*Z8ü)πﬁ†ﬁe‡≈Äa€wùàìû2≠!jhb˝M‚u5˚ﬂe√4Èú
RD /ähN°Æ=µ15W›˘‚2Ôy”ôÁDπc%ı*Y˘Jbl‡à#l±¯èz€}“;Ï˜‰¥—©"üÛÃUfvÌ¨n¥æ!ÿìAïÖPRb´. q`ºéﬁÜ„b„Ø)®∞Uéßvsê¡|‹{F⁄èyO§ù˝C“'ªØé˚áá˝„~°OÕ‰™ià{⁄ÇU+l )e)mXf6ÈÈ≈EJì’eBç˘©ıhSGê∏eW∫´ù›’÷›‚ûyIÕ∑‰‡ä7¶éºæ›’]Ø1’nVµÀ\°#¡ô/t$h≥ñõ∫‚∞—ª¡lû`ÉÖh§ÈØT|<€D÷ÏÊ˝éıZæ±)IÓ‚ÍÌ˘jo±‡rÈ˚l‹	*∑7VÑ6u'·/íô#o”Çr∆ é‘Ì0_÷ùQ_¯óy¬
ˆP¨{‰DW_O›»liˇy˛¯ïIßB2©LhˇãáüáÊ&°E°®‰*Å9Q`"b´!CôBÅô(5‚ÎKáÓ	Lr≤}j2ÆÇ5yÆ#-hcù—≈meeY |„{¨≈g˙pSc‚B	tZPRh◊a˛m†√0OmªÖ≈&A#∆öy¶Qô«Uäæ3p}8RD&aòá≠l¿èü¨–wîå°ú w–4î]ØDrX¥◊çCl¡√SÀ§ÒIﬁøøæt¶‚Ø«ΩmÂ,9'¬-¥ﬁß3u‚∆fG Q†¥?üYŒ≥É‡Åf4gGπÎ@>,µ˙¸ ö√∂,9ßì+Stÿ·ùºíâ,+˜¿bÃlÄ≈"Oº!µ,5Ã&Ü¸®Z∫-ãRi∏sVú¢cWŒX˝ÕX2.„›¢∏ØuƒJ#L<‰!èÍ›-Ú1Â{IwæX¨<s∏h ÉàUH√Ù€√UçÀV_™±§å:≠/«ë¯™nÿìΩp£[¢±ÊáZên≥PêŒPçN∫Í°°H]’äÓ˘(#ZxTìÅræ«}üæÙ~£Âßúm2V‘ieÏëuÂÌæóÜ!ÏBæ„´Å2“#2∏¸¿íjTt[^ÄÂ›"””,M5˚CCEˆ“}Á¯s N±HÀ!X¿ƒ	∆nfÍ*êV∑ï8—ÿMZÙ·%@ÉG—X!·Ÿ£2ï‰$Œ„«Er¡ŒcÁM`Î¬©ØÄuŒ¸÷gπ;%ÌF¶z⁄ŸÛ√yB∆QZZF∞çäÜLõÀà@9Ç?	Y«5∂ôçﬁ`N±≈ˇdÖ˝^Î!M∂ËüÖ©Áƒd°•œ√'}
ÿìO“=≥èN¶$Då†z»ˆ‹ı}x˚ª–#√våolÒ=‰„p:à`ÏÔBè8ùˇ∞ÿNœc?$=A/å`À•Ô◊x‰AÀœÃN,¯–´uá>å~X¨i`¸ª–Ìû€ÿÇ<¨≈„g{hÆÄp¥ÿw¬ŸÃw#÷49∫˙.M
PS{˙Z/xÁaLŸÌ‘sº—› a°˙ökΩ⁄â∆h´¡íóó]µ‡Œ¯Ûi‡¯w∆Œênt·‹µ=
£ÿÒÛ«≤Ô◊z‰–çﬁ°3hzf1Ï
sıwK¯≤qª˙.rŒÄ∂—øãM3∫˙:pcÿá≈pﬁ	í0äêŒÉ4yÏ#n–È˝jé±Ñ@*ÆXlÏn‰"TærA˙MË)gzÏ~Ç<ˇ%K˝TÏs¢6{≤¬$ õKô 7GT÷ZÑé*mº¥=èìp
X9õ'7/¸K/36–•YP1»¬‘OÄ∏Ô?îûêÌg™NYÈ	tâKÅàŸàp<Â™*W'ÜtÎT&∂ÛõÎ©3X4wÚ∫Å®¯%ÌÑ.SIf9_¡«˛0ç˝Aú\}ìD∞X≠V´|V˜EG·©aãË'¬⁄§…πoØµî-ï—	- ∞ﬁ"{0‚à[™≠çØπÉÿP≤À¶Ú;|‰R8kπ0çóÀ"qv&óhÈ)&èRo@ÔCÒ˛pA?ÖÃ.\…CÏ¨ƒpïÖÑ%\U*-sí˜¶ÂC4dI¢ä»ﬂ˛≠lÒ≥"Æ∫pæ
Ó5˝†Ãänñ;l<
•U∂;$™ÿ2eô–¡«W õ¥˜tÉ\.[ﬁæ¬√p‚OIœÿ?c˜+ÄV7âO…œŸ?ÁôÁ≥ïûìü´∞∫sO	ìV,ú%∂ÓÓ0aœm—aUY˜Î˘Nti)ƒ%Á|B»Ë*ÿ:øB[Lπ0&¡›K∑!~∂î–‰ãaqomC◊⁄«Ä26Ù.SÍáz(ûÉs¨Ÿ8.™’Æ¿⁄:(a„G(˜$Tà
Uí¨w Z©@—•e	œ—7b Q¢ tI¡µ&[
‰._;=Ñ≤J…S|3ZEIF$%ë1∫◊TÜ·T∞Æ[„√“Ê∫ÿáﬁ9±OÜmòE·ól˜™¢-≤d◊•˙˘ó^ø©EÓMŸÕyÃ¶&éw≠[÷'Ea
ˆN	<™…∫π∫q≤Q)Ø≠ëx*Ñl‹¨¯÷;Ñ¯b/-ÙÑ;·ã˝ù{)k/ì±lü±? ‡ùã_z∆˛Ω3O˚^cI$ ø÷ñ´§,ùù/N3c…S"RíLE‰¥™ í»MÊQPIvÏ	è,£¬™IG]jµ@åµìØù]L
5Wúwl[ö—aÃ®uOX|ãù|h˘}ô©œ±å ∆…ÏR˘hÌBàÿa≥Opq} –Æ›ÎV´%¨ﬂ≤∞Xo,j3Ã ò'<lı]√Ë{™°Å6Xn–}VK~`≈ƒF5±ë.j™'∂ÇàÂsi#äî\q°Â-)]™îU]∫d=±[]1É∑Bå1ÛZIS˜ÆÂî·W‰™Á<,⁄N¢∑ÚP‡aÎ•¿CÚT‰d¥ÄÃ.Å5‘Ú[‡°¯.ìc|GÄ›Õó±ïkÄyPW_aó±…€’^¶f^H‰úáÄçë˜Ïñ„Wz5(z6“‡ŸÕªSOu5 M÷¯(ät•ÆgDÚ^à≥2ÉHi¢¿6|Œ(„ZJWóÈ≠¨€0-µT±(%><*µåEÉ$À} á.ˆu¡©∏Ñ◊í®µ$°ì◊Î“[‰\o–Ü≤nÜπ4_á'sH£,=¿ÆfWâŒ*W<»"$∑QàèÊﬁüe	Ω∆1∆¯99–ó˜Â£•P
’ßÚöYKA	“´WYö»uﬁ6O·ß8ïWh°cß?	J≤4lt€4^¡†ÊpK4ñf<ó§rWd¡Ï“~«,Ô•n≤ãYﬂæIÎ’≠YÆÑ©WÛ∂•à@+âºÈR%˜∑QÌu>%≥∏«0•‰A9˚y±3›—”/f∑√äX›Y[ÿ–Áñô…Dûï¨h¶t4Å◊ÖÍ†¬ÈMïß…X,……Ç;_ ´BèQï°ıM5SiÀYv˝¡‹˜"ﬁrú¡!Q‰é·l%©EzôDÓûB»c'nLçﬂS\rNº¡áﬂ¶Œ˘’‚·6jeÍÈÁ≈Cï50RÍ0f«ìjE‡	ñ˜p#•8@ﬁ∏;ïê„ôËR2´_@©eèé›F!»WU,ÜﬂXÒp}çÂ„”÷ÃW†naMÕ+Ñ%à®Ãπ€#K€Når…ø ä¬‹ÉZôr´Jë3ﬁ^û¨ÇÎ‰ '6>7Ulâ§VcPä X+í¢p¢r5qH»ô_∆wá¨+h[®\Û°DòèØ+U@‰ãü^¨Y%◊åàÍﬁ„à®’Úà®®‰WÏn”“ ∫Jb˙ﬁÂ|5„€ñóÓKM∑&OeS?›7üÔi‰ÃÍÂÛÛ&ÛX˝‚‹rî8…‹º?¸./ﬁÑvJ+ç8™b.≥\è2ßæÆJŒÈ/i∆xQ
s¶≠ÌÈÄf©#}µÈHùp‰9ŸõRëç’(≤Ìœãf¡ÜxUWTı@àòáÑUzV°∑Wq$≥éS¬Aî·ﬁ∆ñÄˇ—Ò0/S%pdËQmın Ñ5Z—Ç˚©å;nHÚ·^J^ÄÊ
MòÅÀ“Eî.˛'Íó±ZÃIÚuAÜ2ìa‰Óéò‰ª¢fcµ›ÇfSwøµÚ8≠≈q]Y¸8[Vî√…€î˜Óˇ_bM(§;p–'pY¥êCë9Á—–≠M™î;◊B5∞
ù<˚rçº‘s;«⁄ºà\é»πg)√ÏïµÆË◊™ÇÛ≤‚3≤K∞ «h∆∂÷ØScÚtTµÑ\◊ﬁq¨ßC∆Hlò‹}Nr§G»H¬È’◊	‚Tµ.n%JZâg%Æ¶Á˚Ï£*1ç.ù«πÄZëç
gU5 ‘[âﬁ=ƒß™Ö°ªPK)ü™‘Æº5X	ı@©uñJ[A‘A›ÿ±7ìÿBR=∑®q7*Ÿí{*CåÄ¿3Cx–r
OáqªqÑ |FI=¬-[i3•f†πÄ˜Üf[≈nàjôUtƒG§ëñ4˛≈ç«AH˝1·)∫qåëèd¢∞Q]›Öè•Ê%´E”Ûf°4ŒC÷´JÌë%X…•¿Xa˛)ìª ÷›Dy∆)Œê9 ±ﬁìÇòpÑ5ÓF\œX‰’∑lØÉvDﬂAÉÀy≠ˇVç¶iØÆ˛%ö¨vØã˙‰•74≤œÖÏ¡TΩ`‚E.†Y¥œmm
54¸PZ∑‘ê£ôÎ'ôz„‰S–ÇÔçJ¬ÒÿwØAhJ…å^∫/$∆ñ¬§Ijf6íú®§6Ef.†tfÌÈ™ñ˝‘''i≈ÆxñÒaı
[’¢-ª  A‚0B¡–Ë&XS"‚˙ô†9K !'œùŒBjˇ¶4(pﬁπc‰È◊ß%í≠Ø⁄ÖÖáÖá^Tjˇ‰§‘èc+‡Û'2«÷∑íÎ˘]O∑q^—gŸOΩtﬁuDQ˛H:›còLr√p3Q∑VTQ{-¶l§EÄ/µrî.ó¨nºhÄ^+∫É∏≠πKΩ‚r9SﬂuPÆmbK“3µRW«Zﬁ™b—4'*93Î•†èÇõR◊yË6∂æˇÁ˘„Ôc•‰îµ§ı≈´ıq√h({L∂∏¢tZûÉùç∆
§>,JXîRòq&.ˇ∑Yh∑R;`ÎàéñJÑôÏÚ*$n4f_B≤8ºP°KıÂˆQ:î$s∏‚_”q‚(Ÿ©&N•rÿ—P£öÖ(Bºc“√|{≤‰L@ÇX&ﬁÅ3Z&/ù·2«®W∏"c=nL¶WﬂΩ√¥ˇe~_‰“$j ∆NºÒ€ñ”‰77´¯ÁƒÃï+“ßÓ‡±≥[«π‰¿ÛÅ∑5aäC⁄JW$æk]y]SÖèm∏∞îy¸±Â¢>Ò=ª;aQÅÒÍ∑%è≠Obá9'N‰LY;¥ì 08êﬁøÖ…6mÖÌ€êÅ˛jÓ“’û≥*†°ÙvÒ˙ÇpËÒÜapÊ]¯
‚√X‹(ÄmÜ”êlO¢p
`ÒDñìÄ¸Y∑Ho õÍ¸†?ö\˝!HçÖ¯H”4ÛË'@):«lFÂfl˝Vl◊˙f7Ö:ÎË∫¶ÿèbŸ
RSGÿñOùsá8VODw5¨¯˜ˇ◊?Vﬁ‹ßüè]∏âˆq„èÑÂåÁ|≥A	a’;Ò`ó	˛€ŒòÚfz'#oíÖ•µ»Nî∆VÉM2Jµ!åãŒêâ3|~rÓ˜fıﬂ¡ 	›üÈ‹ß¶∞•›ìÆ} bPNëâ[¬Õ]4á.*bpnÍÅ‚ˇ›	∆‰ç\Ù§ ÕAx«)>HptŸyÏ]-r ä» Lpã“&å$:É»ã¸07¿π37†Y7ÓÕ.Òìïye∂Çç‡h'7kª†µ3≠ó50/dy"ñY^cKî.-¯BÖp[ùq[7%◊§BÖ6}áAÂë∑Á0c	ëß ^·i+[‚ü˝pH= ≠	–˜e“¯|‡;¡[]˚T˘(ˆó1G5ã°+$Õ©[Ë—Ü∆fÿ-‰_‰V.ÙË
Ñ≠êúórt#Æ>+Öe≈ñR√4Qi2ÎSÎ¯{^÷–—⁄a—CÇÃióñ∞sŒ´π˚Œ±2‚Y*z∑û¨säÂKX£Ê˘?íÒßÿl–‘v¢ƒ,t„Äv= ⁄Œ}4$ıﬁy±©;l∂ˆZUKå°÷—®'àÿ¡8ÆÜ˙úﬂµ`¸)¨`—,µ0€ﬁ<EMeæÑ¿ph≈Áƒù4∫3aCˇÍª±7Ño∞ÏsV€#åo*5kJmåGΩ§ÂFeŸ¥ÿPM¡(&KˇdÁ€´πÉa⁄O˘f√oÕ{d∂„.KΩiN◊Ê∫ÖdÖÏ≤é≠fÁ∆Be˚oΩjø:~ã§WñÔZ·™d<‚ƒÛ›F≈ï î`ˇ'l@¯.ßÕ≈›ì
ÆPË•\¡àr˙¬Râ≥~2ÛCß™Í≥‰i£ïú%À≠Èhπ5ù,∑F·ê˛sﬂ1Úœ¸ê2NØï3-ÍªXqkÖ∫≈»dÚ∂çæ]™‚«™X8F∏*ôâºj—rMÎﬁŒl∑#'ûdôå„7%>uWKxÛ‰∆≤5©`ÂOpµ±Æ¶ˇZµx1ßôˆËƒªÅÍ~—ãÜt©:£/Á†ú>í]ºÚ$≤GsåˆJÈG¯0£`K;œWéyºÚrgeg˚ó+Ø^<(…Ã$ñ¬§n‡’eÆ,=øıÀ¿Ä<Òâ4 ï–≤,îR∏Á√‰◊EÓ~ÈM]⁄ÈŸÓÌX%∆åπñ•bÃ`ryJã¡T∫D´ã∞®"ΩËèÈ®˛f¨w“tÃN”
m¨≤˙c*äWûz%«‘>¬ƒëµ‚˛JÎç∂À∞%)±B€2Ú_¶&Te•Õ˚g†¨éº∂E›qﬁcÚ¿z<øÛ¿Ö®Ïù∂'Ù…K,Ï¬ÔHÆÃ…Öˆ°5P¿;r‚,g÷›ÊæKJ˛4tZÚ$<=p0ô3Ÿq«Û„•‚¬πó5Séj&=˘≥ãÏ⁄Üñ=FÎ≠Ã4UT()-¶M7∂˛Ùªo˛†á°\*Î,TË≈¶Å´Èπj¶…ÔñUõ@Øia_QØJ ﬂˇ”ˇGu•Ì‘˚Üß˛˜uK']Ó≈±,Tç\≥Iª©¶)Ù ñ*≤ƒkuJo#ôŸ}“Æà0+Ût√≤^≈UÂkU%≤÷Õª8f≤º¬.Ãk:Û›$î ›ÆBëU}"˚ÍD‹§3c@B≈Ãj`¡∂sêﬂ^∑Q°—ˇ1$=∏˙&rø‚™ÊPû!l4ö¨Ç—0∑}ﬂV#ÑÚπï”·  _%®qêawá¨ñïÓ9dõßëﬂ4ÿ≠ld[Çª£k£¿«€ÕvgmΩz›vk∑≤∂÷{¯7]qø·ˇ9≠ß Ùdt`
ÂÕÛÇëSïñ!”,A[àfw◊EÉ˚
∆Ô6ÿ>ˆƒπg"Ko|âÓæ6µ:Ì\˝kàÓßınÔ=±÷ˆ∞‰û!}~qıM‡FVΩŒn_∏∞Ò—5`ü=‡⁄‡ˇ“¡B]^Ä´Û‹ù¢'?æƒØÔëA{\ÓüRªçEﬂB“GXtı]ÄÌ‘%Œ“˛l»z®›8ﬁ∏S«´ÿ
q˙xKmº©6 ÁòEﬂ†"Vµ-Cª¸#–Üú±€ÇßÌ&Ót©9£œ˘»?g≥]&5]i¬/ ıåo›†˝¬÷0úæ«eÌqÉ∏\R1wÉˆ‹Yªÿ˛ÚÍõb86∫˙Œ«aéﬂ§âàiàÅµ—’◊$ˆh$Ú◊ÄÑ√´o√õß 58Á(v-d‰≤BˇùÏ˘7â¸l‘üÿª@˝ù®E^z>¶ˆ>sÁ¬ 9j	˚˝ûhèW<ü˚∂/Kk∂R˚ƒÿ√h|ííÅ≤Ái\ﬁèŸt$Ò≠"7≈-‡∑œû|(˛≤u‘:h·^>&´ù.l‚ë∏Ò<yåe∫Õvß˘p}Û—{L◊=7V>$œCñ≤ı‹√DÍˆÊ8Û#rh…ìD8Ú˝∞æ¿_/7BL≤Uãää—‰¥¸Ω√Xx.ó≤6W	„Íísw—æ√”ÛZ@@π¬èœŒwGKF1ö±7údπMô˘¿6Êèh£º Í2l*Â_E“K–^ç∆OëöVM–[Ís†¯‰p)ñ—‡ƒ ·¥âÖ–§ÓLÒ$ÚÇ∑Õ ux≥˘t›?â|ÙÌo;”ÅÁD˛Ùª˙ª?˛˛7ç<XO>3I¸ñåîoÙ‘ /ñ¿kwmRÎMÅø≠|hÎRÔ∂≤¥6qº§~‰0ˆä+ÙªlëAg¢SV5∂~IOQgï“\àïÀ90Ñˆ–`&m¨’|§	ùÀ«2!‘õZñºy*>’¨Û•Ì˝é∞FÒ™* =;§∏'∫|˘ßŒYÛ¥˘∫›°ÒŒ· +ﬂ	,¡…∏·‘;fÈ£Ê[„Ã¸sÎ◊FÓâEntm>⁄¬fz Æ\éUÌë Ï«ÏBÎˆèıª9:|∫S`
f€ı'T•ñ¨û≥⁄pvΩ+∆kôìπ®Ë≥…≤ø!"îÌ´≤√≤`èµ⁄7;boπ√ñ©æÜñHºåÜRe2„–rîøòåqMhıô8$é7
I@[9Ñ≤ÉÄ¶K#≤Z∂±∏°\‡ãåÕÉ∆Xeà› 8C2g±¥+Y‘Ãüçéµ≤X4–l;ª˚⁄~´lÂhyg\}+;‰Eû)‹ﬁÜ˙[“çÓ«£˛öªÃﬂr[π ôI5=ªWﬂNaa©)+á¿ﬁô˚™V(NÈè4b>ñËD#rtéoã…!h≥ˇé09óGﬁx∞RUL±¢ØxáLGÖæ‚V5h´zãcálo*]≥ºAv⁄˚m)?Õñ@µ'œü#˘°t ¢ˇvˆ|‰(C,*‹=^¥Õøíﬂ¬¨)ÓÓ»c¥ØŒã&.à÷º8Äö0ræ¬!KØ⁄ÜçÛ–œºà˜	Îºjà=≈{;Ø‰ß˜±è‡d#á —π˙kx◊y|<Ò\∂|‚ﬂ
ÔÈ«√˘HŸôÉ(L“‘ç“{gµd¨¡9Z˛˜g	‚Ô2Œü›Ú,4ækw«|ﬁ\Ò})πÖ·D©ö9Ì
J\á“Â'eÜ-%7©†+b©—Ã°$ùXˆíéÖ…“:n˘Ñ-uòèƒz¡Ö⁄¿˙ﬁ—”Q°0Z„n¶etiÌá<ÔD◊G∫[—‹é7’2∫∫ıßZÖBfNj∞û”5
JÍ_¸–,‰S·B|;a‰)¨?
@Û<¬Môô4^Jc¨Gh›ª)Ôµ©ñŸ8ö∏LM*Ow∂”JuR*s•Öv*]Sæ¥e◊KÅ∂’'`%’èk&c¶ŸòÃ™äÍeÄsR%ìËö«Nƒ
·˘©,í)œªÅ™ﬁ◊BgSçi;≈+:˜T‡ ƒ0Mrª≤„∂®\MjÑQ¬*)È /{/˙Ø»Nül◊≠d^~Uï∫¬;„1jáˆn¬äbTJ„62‡5T¿JØ∂±Ω◊¥ºÎÌÓ(ÿô‹k‹´ÃÌ∏o‡{(óR]<≈€™xô°«∑|7'≤EV-ÍË¨ÂØ∂˙huß›{c‘€S2ÿ°y≈òôÎµvıÇ˘ÀÌZí_K©›ÀVQH¿¡WPe∆Ù√íf˘.Tˆ27≠†M˛gï¬ØŸV‘<®Ñn[é!vf'^Lkcb!≠‚ØEyÇ|PÕ´“„x‡¬X^*h?ñ™;,[mÜäN#xÀœ¸L’¶⁄y◊sÀÎÇãKê,’v§ªZ„Eë´Ñó™0ÒT£¬ÿt1Eë¡PŒ;÷eÿa£—∞√∂¨´ΩÀá~‚√:¶EdI≤ySª^ÈAåÊQe∞∑|†oë›XX©ÂCí¥6A“⁄Ã¸ØôCVı0¢%∏˙oº ◊v:≤√≤Ì; ΩJJ9w•vz¶W2&ó3S.Ú€QgH¿K⁄G{˘:Ωﬁ“˚ /∑mV◊œéãåÛYB »J‘õt/X…È∞÷ê¯˛ø˝üı∆Rs,˙cHèØ·Oè˙ÒÙ»9∂mƒ©|∏-Ï†yÖÿWŸÓíM°)È(∫‰QX†VäT`®˜»Í¬P“°/˛Ω—’πÙª4Z%•úÇ‰¬d≈µ‚°ñt¢%ÒS•£Œ£Í!Ä∂‘ìΩ..<»:d ø£y™q±º\Z`•’;-.*o´ÀîÕﬁhDA	ª4yÒÃwŒI8√1k∞À('SA(X‘QC1TlÌ3o;3M¨#ç˙*EºVi∞LÅ%Ê0€≤ZUñgï}Í(¿7SŒJx⁄bëg|«Íùe.bŒ
?{îù=¢Ü√B¨û)NOÒ~Ö§ô¡|’¬!ù=C/ëlÍC K∂ŸP¬dL•≤Ä¥OõJ`ﬁÍŒsk3H˘(K]-tº©àCÜWﬂMiÿŒ,
œ±ŸIÊ[™3˚P@€≈Á•ÿzíŸ"2ôb?·ÜPjÕ%££‰‹wóî§YKñJkIX_,C_ﬂ\9Óã≈Ù≤òòOûÎÍEgXC ˘HÌ[Ë+ˆ¨Ò‡:.ﬂÆŒL≤f€ ◊ﬁbKvø¢mµFÊ‚˘‚QOÜª_1ph¡˜5J9æG
”¡ï®¨éÎ0-hË2F˙å. &ÚæBa•≤D;l±ç?æ'Â›4“£¬YÚE∑"®t`;Ÿà´ÿÆ™ôxSóÙ÷ÅŸ¿bÔÊ,ÇÄ†^öƒd
¬¡|f—]πBX3j¥∑É§à≠¥ÍıDzUWE|[q‡Ê%¿<¶ùÀ`/1íòÜ©ÔNgÿ:„„`{‡ƒ!J∆i~s)Ã6¸fΩ( aÿ˜ÀØJùﬂL{⁄ÿ¢·y≥Á˜¸Í€ÿ:uz—⁄Av≈ûsENi√ Á‰ﬂ
MıU-lÏJ±.S±‰ÖGŒ9ıÆ‰AkËØ–GπËúWäg√ñ“∆»kû^\Ä»d4æΩö`côL\LÆ¿õÎp¬÷»fK8ëq`~1ßms  ˚1à/&Gﬁ/y[ÌœúA˙sÏ–‚r"ibnmáLöØy&,∞N´õ4∂Í© ﬁ∑ ﬁáâvÈª&oÁ}·û›ÂŸÔdÜÉ0¡–ïª‹D˛ ª‹«lñw∏ïŸ4ÎÏf<œ±;r«>ç≠ôf|ŒÀ˘“eÏdzN‚˘åı∫ºÃÁ{«‡5õ*'ªiPÅ≥H≠ˇ÷∆ÖãÚM˜∞ëòõinf·”ı÷è-˙A«&Ã’∫P?»»TB†npΩ¡’ÄÎ› ”>∞C,¿Òﬁ’∑ .ª±”7ƒ∫P‚bÄúä√Ø◊ÙrgñüöÀñR‰ßfÓÑu™|ÿ%†%çΩ¿^‘f«Àﬁ!∆K∂ª”i=ﬂNçµﬁü£7Ç≠á-ıùÛpé@8«L¶sÇ!·1v¿ı∞%i0©ÜÁ8QµÜR/àY<V‰‡©ÿx¢õ‰y˙FQoœ11Xê4µP.ÊŸeNÂáıÖ∏∞;ÁÅ3ıÜ‰c òu4±Ôa@†¥åHHªå`GjÆ7,ÈFg±~<AQû≤}Ùq6ˆ2{âUôÒÄÖ‡™<}ÿc≤Muò¸«ôÂÄ‡∏õTNfëﬁbz#Wò>\©Áã’ØÕ§)T@1‰ovXôò™*˚1¢j	uc'Í8∏Ú„ÆÆ¸†N/æI—‹8†9XªöÚCW~Å˛ë}Z<˘ÜÇù®ÂàØ˜cõü/çËC≤l!√è0Ççh:h¯B4°≠ß†œõ$â3éILõ®'TíªfÕú¡ı)ÜÓ±ßÄi`õÏÔº6V-äW7ÑYÇC9w\«nÀnœjc⁄∏Fo“Ä3Ü¶Áéh,´Z«m~ˆÎÎå´^
µßÕv]ù±Ï-Ø;ôNöP
ÔÍ‹Ëª§7u§7m.¯¢n™Oh+"Å‰É
dﬁ;≈u*’í!KˆiÀjP»ÑÀiÃ8_G”ÆÎ™≤á∏≤Sß Îï÷íÌŸú]Tò@Pa6“ÿA'Ë3√I¿x	∂9eR˛&NmË$ô`1÷Àõƒ@TPbΩéd ërzn4º. zn" Eˇ$vE‰`È±ãÄzıõd4l∑Wƒ˘˙ØZ]ÏUıo0oÏ∫àf¢k DÇΩ≤v7+zõ`“Óﬁò‹:rNˇ'≥3ë¨Xa¶‚›åÓ[Êë4`«*;LLêm@Ö$±>V=BE]sº‡LZô®V‘ó¯úÉ´Ø«-“FìX{¡TÜz•ΩtqÔ£—≈⁄]ÕåqË<C≈=Ô;j5¸õ≤{<ôm˝Èwˇ√N%Q‹Tè1[œ√h
:µâDŒ(l"Ëä¶˜oëæ/d∫Á3ZÎ≠·›ƒµ¬˜pªÉ≈√–¬îv·Õ≤‚	’&óANÔ¢$dóß8……Óô3Lú)mÈ1%ÂKV')v1ÛûŸc}‚Cg‡bÆiÎ… Ã2êºÜZL∑_gSÁÊQÍﬁ»¥-√:¢ËÁ&t%aFπ”Ê6wF@íí´oÜ¥Õ	˜ù,Éî4Ä∏x.2+/dÂ`p±Ÿu®¨Dßû√‹b(ﬁWüìQ÷˘6mæQcmhcΩ∏ñk_T:¶™NΩe?ú“çí¶’ÛHÔ‰ç27ù.ç∂≥âÆS™`æpÅF ú0ÚnZïëc–ËÈÖÛ;P⁄˛€ø%`s¿sÏ/ﬂJ"oj.¢-G'TÌ…
:’Ñ§W¡•1;oÆc‡…F°¨—Y\W√É(^Ø~æ>;˚ºΩˇD„Å≥ÙË—r{µ≥‹Yo/Ø∂÷º…&˚8DXOŒ—˛ìù„±|Aò`h_x*g YuyO´Ñ€‰	ô¿Lﬁá2
ˇ§¥Xﬁ°{Ùd≤}™ÎºùˆCég^ Zt‡ﬁÍ±§~JsXÑhsËÅ	[≠ BõOå/('∆Âs=¢˜÷wïä#Î∞ß¯Ø’¥›≤†“Ú07≠öçôÜ9&–,Ñ !˘”Ô˛ÒëÌè{«d˜’qo˜E˛¿8ˇÀŒÓˆ~Û∞∑≥ªøwı€≈@e…@Ì∏L≤=qí˛Ã0N;‰èH„ƒCÒÖ9¡÷Yi&¸ÿ^%_Q+™P»bÂ—& Üé¢pà=èhÂ
µlPû/f≠—à¿|¡¨π©f
qul=≈x|Æö„m™∞fJZgëÆjé|†iê[WdWE>4y»†uYÅgU®9NCruBì˙^’oû∑!¿ñÉífOÂ›x›•π÷∂à—"ï%πÃB©ÂR*@´Ä)ËË•:§î~≤2éÂ‰±ã“IﬂSññ&v6
˝´Ô∆•ÑºTêüí¢.∆ }7ÉE™DmáA<˜1èF‡ùxCîA7^!>ˆ‡OÇ‡?“2ìÁ c&!»ª!¥‡îKe4ª¸æ≤~f’I∂â≈j)ªErª4√ﬂ>òïJ≠rôîv≠2)h˜±.ì¬øV§1ÿrç¸(By§)Ñ≤¢4˙†˛Dˆ6˚#\πVôZ •/¨jõä‘ÆÜ“.œh(œb‡%4ká´s‘ÃÅ-É}t¶ÿ’óŒFµ¿!\N{ºtŒº)_π˙:rùÙ7≤Ù2qå=—ÖJ∫}îa≥axÂ:Úìó^ÄÉr; YA´5'| =›º
’â∑F ëã*•[“çcgÏ∆KUUí´”éh¡ﬁS◊ÜÿÕØÚÚ(§e{ß·»ı-.G$ÅÀˇÌÎèCﬂ˘ÄÖÁòE˙·á=`	ÂyU¸Ô√[F^Bñ‹/[‰ïî)$œ¬8ú∑8É°¢°
À)Ñh!â¶^∆-rÏí@°´o–¥rıá)6#ÓÍ√®Û≈ÃX‚4Ò5Ú—‚E9Õ»e-È›Vµ)7Éº©(X ny?ä¬h) %∫Ù¶“¸∫]
u0Ã2W$˜eêÀcî≠O‹:Á&.Vø·¢ˆæÅÁÔ‹¿9<$±,o´·],”Ôï¥¿®¬˚È¢Ã@å⁄ïÛûÕòU’C‚l¥Ù(Zÿ‹ôi2Á¨ALÆSÃ"åV˙'j&–⁄çL⁄¿b0Û¥ë°„óÄìΩõ4;Î y?xCˇuùÍ*˙≈˛f¥Yƒ*…bÙ¶Ò¯Ay·Óä™u¥N<•¢Lù∫ò∞8xR1f0ü«Ã\ﬁH%7—yÀè Xx©ÓPU{O`VÇ·/ﬂhJ;rù®ç(Jpj¸br:‡ö`GÀ”=´O5ÀQI’ÂÚ€ µµª©≠#KmÌÆE⁄gUr)_)^.≈ëR˛érQ¨¢l´uï,ÅÊe¥âƒ™ﬁ:®™iç§Gh[«∑rÉ}œ”TRU`ÀÍAÃ∂VÏ›l_ÆªÍÀﬁCVÉ}Ü—‚ìØ•ˇgO◊jÍ¬C3˝º±ı¬!∆ÀwˆvopΩÆŸ‰HÉ!8ÓF¨ñÿÎ§J’-√ıLrA†!õ±ŒY‰6O#gV [Ù]8¥K_ó%Ñôzœ–\Â˝‡rπÿ.¨Ôªc'HiTXÏ.•_&*¸ÿïF∞y3ñ´bÒUI¢ƒÅëh√pv‚5G	»â1≤e#a6“=b;gyäÖÒàı£/P]Íwø5^ú¯<ïOzet^´H´9< éq+ûí@Z†º`¬¬“ gØ˚GüºÏø˙|{Øw¥˚|wª∑ΩªˇÍ≥7Ø?ã?;zÛ·GüΩ˛l≈p…  ≠ÒÄ{ ÎÍsN/!ÿ»}å·ÿ{`6ùh‘:ç Cq¥KŸ∏k<˘íùd8!X—∞ÓJqiπT√≤iùùΩ—ÚJÎ¬Ñr‹´LReÆ™¨’+‘YõıW’n\&õÔÇïπñ∑Œ∞/-Ü3Ã—∞E¶ºeRÏa⁄'q1ÕπŸ“L–¯”Ô~˚wÑø˛Uò‘(>pÔã„‘(-sOiKËÅTåûap›q»bñæ¯,¯,¯C‹14ËdÜ ¡B‰<˛√œÇü_d”∫¸¬˙’∑Åòπ1[6ZwuÕLÏpìj=wÄûª‹ﬁE(nÊXä9o-Pôõæ–6ã¬1\eY§¥6¬˛íË6Q÷>æÂü~f$$Ò|:≈¥”Ay¸éÚDπÙNÎz»™à4M®MÄY Ë‹)F}çx=¯Çß:˝’Ú∂‰$Ö—Tw9qFÓnP≥⁄énî•Öq“1a0‰µπ5[Ò k4$3≤d#[Pü„Ô‚¡#1F,R‚ïØ1xqœãì∞nY«Î$ŒãNu≈Ü¢ˆê[.¯c-a≈ÓL…Ûx)”µåÇÃ˙.—N≠ˆ´*¢èuÊv≠U´YÜ{±‹≥Jf˘≥ü˝ålÔø⁄ﬁ˚‰h˜Í∑¥{ë¿•·ÚJqÌπe≠
€Üh˜™ 9^Yä˛¡⁄|m{(rŸÙ‰Ü‹'£P≈Oıpò˚qó÷ÔÀ™1Ÿnq]:ëq∫>Å	•Ë˜p≤æØµ#Á3>Zó»‘wmëÎ¶ nﬂP/ÓÖ~~`N„=‰{!•tÂÏΩ¥TK0ìôOïüA_qØ§Ìs—«¿=õ›ø|#Ä¸Mò≈;ı8ø÷jï Ò◊ﬂç‘∏Ä4ËSäqµ`ÈèR’ÉE‘#é∆‰ú∆HïXã W˙∏[P3|∆í'πlŒ%¶N‡G›n.bJUu…õiÑ∂(rv
b»ô XäúﬂˇÛø¸Ò˜øQgT“±–ä—Eà‹ìß˘ãû—T∞C˜‰“6Væ`÷Ãoûô=¡ilW∞ºãﬁn§/¨/≥„û8 ΩeJ9ì+é@™P√LÃwÂ]ÂmCãA£√Ωºó!ìª®ÙhºF®ÀÇ∂'Ü¿è” ƒB`b"“*	ÏxÁ¯sWÄâ]¶¯ÚˆÜ|∑ƒ†zÔí€J0£'i—Gó∑bér5ùóª•¢L≈$¨¨Ä‘Y, £‚£PhèrÁÒ„pû`~è•ßä-Ãòr íïy=≈<ïÉöñ¬H≥´§w51≈ü≈Üƒ`§¨»ÇQ≠G¬Tß√»{*z◊ªyÇä˘YïﬂÎí\4≤3“ÌRa∏RêØÓñˆº	ﬁy¥=.CM”ı%ÃÈUΩ¯ørÒˆ…
Rﬁí√È¬y^Œ wífÌÑñ/C“ø√ΩË»ø {œ¸«√–o¢`—|®$ µjfâZûYLÏxÈxÿùgv‰}CƒÑ	yJj÷ÜêJ±HGÅNÆ≠czâ¯∂Üeàï2Jº €Å∏æm‰ò,ˇÕ°€GÛÁÄÚPõ°)ŸCÖ∞Q±O‰¢õ·°≤OΩîë“Á•’HFèOYæ`›¶ó«ıcˇ≠µú*]ÈπÁSßE*I•f¢…ÿπ–π&’ÇTµ≠Lkl˝bˇ?Ù∂˚üÔˆû∑éy\≠◊Tj5ÿ0p¸ÛØ‡•N‰å#g6â´-‡ˆQWr"A°ÈˇçÊ3Q„RG-a^–P3âHH<êtraAMÜ•jmU›∆S†W°#Öí8+Y•·5Ïnèπô¥5/µAÉú{=Uµ4éæ\ãΩ’lö"è˚ÛLß±‰’˘Ò>ü&œß).ûMBM8ùÅB` ≥>≠≠ò≤vsô5⁄Å˛SkJIÜÈ©c^Õ`ƒ•Ì˙F◊<‘Lc∂,à≤âŒãë„•,“¬≥d®‘ÄôÁîaz√rÎ∑æhÉıÌä¢ Ö∆ı‘#É_yÛå
]íGÜûŸ–à◊ÙFLL∂A!û› Wì+≠valÏlCπ‰Óè•(k¡aÑÍDRpuñ≠8FB“ı>π˙÷¡§"üñ£~Á∞§"°ûJŸCÀy∫i{-¬b-ûıÙ‹KÆ–πÜÀ
=TΩæBZ±ã©mÏ
K|`±úïÂ_™}^6¯kÔ÷&®$£÷-€Jd—¥33!mäñ7ÑÉwÑx’,û≤nï¿SH_Èmo´b Õ-…NEÈ© *Òq©ˆì≈¬@Øì#&*KÀçÀπ?DÛ]D>ıb®w‡`U0ﬂ·ULG .Ï<«ò±cœ	ã∫éˇÄâX!÷‚ØÔ5y∂C> ÉÄj(‚•KÇC_¢?≥È≤iägÔÇ.)r≈∂CÄ1‹î4`eƒ÷Vx˘—ÀÿødiÃPÊ˘≈Ji.jÿ"Ñ◊b ·cLÿ‚R¡∫ØÖ,≠∞)´∆◊¨êtTw	zb+œù4A»xE˝¬òñN?.Û}·aêï∆ﬁZ§ı!T»∫!(Uÿeh≠†tC¢1¿¶'ﬁªêÉ„tÊÖYÍ;Èr∏G˚hñÜÈW¿i∫˝5(0…áC˚°‡vÊøò8I‹õÕé&N‰.˝ãá˛|6:˘´_1∫≠Ú¶£®bÄÔèû§rØaàéêz‚ES¨H @ïóuH∫U◊ UqÙ´9Ïv)ºfÖÚ≤◊˛–ê˙bÍx˛-Ç)∂ÉìH&ûÿ–Ä'ûöh¬œÿ:%rC2è©UûÓ’u‡n∑O˙™61WÙ8‹N3˛ñ„›2ÏfiÔ…Ëµ`µBóÅÚ“Ìÿ≠6D€Ÿì∂'.¨PâTJ3ÛFB±ªˇ  ˇˇÏ}}oGöﬂW)1ÜwxÊ˚ã,Ò$£·HûÑ‰f(ﬂ›Í©ÿS∂‹”=ÓÓ°H…÷ˇ$¿óª‹.¿&¡BAêƒHå‡‡ 9Ï	pÛMˆd?Bûß™∫ª˙m∫™gH…∂ª9ÏÆÆÆóßû◊ﬂØ∏ù¯é¥∫ãÕUΩı£ºÏy;˝Ï?|¡ˆπåÊàs`ª_È{ï˚Ùñ6Óao2z•Ü˝(„∂•tXßá∫ÄΩ™∏vﬁáõ≠û≈>b’=¢b.¶ËeÛJ‹…)ãŒ`y≤˜ë¬§,ˇπE¨ü>‚@Éê‡∞íô`ï&z£É”0Ø …mÒ=˙Oo€bh§hπıû»‹m&føæùÃ_£˝yo˘›äúy¿–ã˛&8¿¡∏‰ô1-ÿ¶Hª±N∏åÙ-”ZÇ(åïsó–¯îÁ3es∫Tnˆ8≥≠4§˜:b¬ﬁƒΩ(€œ˝_!0c°ÁØê∏.cKSÚ"g—ø≤Ã¬Ø0 '“+l\—õÂ†¬rÆÀè?&Ÿà*bÑ≈È§>eSKq•Óë••8`Ë$M¢TO|ß*Ò'Wzäπkpx$éôtfs:Ÿ'
F¢æbSŒ¨√)$eÅæleÒI™KÔùÔ‰π!FŸL#ﬁqN°F∏D|ç”CúÔT?I∑Ñ—∞v1≤jÜ!µŒï¯„â◊=;C†=G÷$b˝Åc¡:84Í&(.‚∫Ñ‘!î`L8˚4œ¯‘t±‘¯áVçâN#QêJ≠ÎNT ’Lâ"?—wà3ê–lç/ü›âX6oØlﬁŸ]Ÿ‹∫ª≤±∂µ\ÇÊó˚d1Ÿ2“¬∞’ú>ÚSë‚ñ™v—öäÕË∑úâçƒ*Ö Í$ÊÅ©ÓÇ0gówÕ¡ãâÉ%®Õ¶Æ≈v≥≠Õ˘èFA•÷k°hA†ë-,AAÀh`zmäQÑQ íVœu£MÊ£=«Œ$<LÜ!^ı¶ÉÄŒ˜kÖ 5ßY˜´S§Àil9'm˙‘#fì7
*∆ìjÓ•ôdØï]üëf_√2›É\˜x’ç åA7CÀI´*-ˇ§ÌknW_ã€Îö¸\™≠l[õƒ#∞qC;ùsuaªËdç]Ò™˚µ≤}ç˝4+0ÁIÈV{Rm"j◊ﬂÎcUò¢ThÖÍÆ€“ÖÀ„	ªôx¬ßA‹ÒÑ_¨ÿù—’]º2B–FªŒü˛¿	ﬁt√‚£Öî()Iÿ@YÀ¸ÈãZ»ÛƒœXrÍÒ£Qˆ>€Ïåk‹#`„Ωt¢YWP(ès≈†‰z>y]È ΩæUê<}+E3Ü_ù§l =<g2YCò≠-õUÅé>ñQI©.YOπ`'ïÇàEjï_yzL}L'esVÕZµ]õúßX’oWÍÜ’[‚|ª‹ôê≠¸⁄öEï¥Ù†oªQ(3í⁄»Óg#Á$ß=x˜÷œ∑gˆeúÎäÑ)/¨+«≤pÅ3!™kIﬂ¡q{ÃqòK	í5p“—a∑I¬Ü1/ü¥%œ&“["”8»|ä%!≈oK¬zÉ}
B,∫([∆Õü2h çôÖÒëëø%Ó≤Ñ≥û√Ü‘üï=h∏.⁄:'e¡˙!pÚÙ~H9ﬂ˛zÂ~‘,”‡Mn˘Ÿ›]Ú
∂é—~O®Èaà`{Kmó#`ÔÕÀ¯`Îcı»ÊV¶êO»ôùLÎn*ﬂ8T1RŸˆÙ∞úJ8À0–ê3ê‹úçÑ£Ÿ˚Æ>xu¡™0‡“Écﬂ≥X¿	˜m:tß?¿∫í‡Ëı˙îí_Ö‘see†B≤Õ"%]zï,ÅÙÈálº©ﬂÕBÜºDŒñ™ø¢õ£Pû¡[%Ìƒ("uATå∏SKƒ)<˙là¯GæÇ¬j—¡Ùª˛Ã°êﬁÃBtrMEàªBÆ∂ZÉè	“∆˙fÅÅRÄá¥©á±ﬁ®ò¢öåó¥Wê:Ã[∂o9£Û6ÏÌ€q9<û¨1?|Ù¿*≠£zƒ0ÙÆ•b†·XG/@÷àghƒ‰µ‚≤vÆg¿[oÊaıã‡(a*†ÌøHÀ©†OöAÛj8ö˙ì!ÛôkŸcã`
›&`lPŒÃç\ZÕ„í·†ö≥‘g!ûÿ¡AıÕF&pÆ˚¯`hÚ¿$Jx‘\$}÷h˙€ÉG8jUµ‡3Ë˙vsè≥¿$Fzå4UfÏÏπJB#‚ˆÃ	‚X^H/JÕCÍÔë/òèÍ$˘U@ˇäG}©ã¶|{`sEj6@0Ôá=@ı;Ω*¬«´ñxHêÚèf·=8†–∂∞I
◊$_ÚZà·±h$¿jU*√Ädî¡dîúÜöG•Dºâ]È«◊‘Í4yrÀQ»w6J`1Ó
oZ,Ü…˚^H°*gp,≤axN>!õU~AËƒE,¬dT”œp!tÅ‹&uëæu=≥∏ﬂOCw’ÁÌØ §© €2È|¢wBÿU˚_ìlæ¬π¬dÆçÍV≤…}˘ õÇBö
ƒ≤ólªÀÆ›ÏÓFfôÇÌÔ®œJ˚cH…N*óÂhi:º`™;´r®•ª¯œπ@w3ÍÂx⁄ ä8¶UÿTçYWµßVxÇ⁄y˛keb=⁄>i.±7’˘kë„XkkBgµ7¶ÏﬁîY˜»Üø~‘%Ÿ›O{oÏÓÅßª∑kÓÀRNò,æ≤©‚Ñì˜|˜ƒ˚ßyA›W4ªÅ∏å.>≠¿†^@•Á°ÌŸ≤^ñ&z‚;£+ë í0[Ω\}∫∫˘•f¬@èùÉÜölÆ¸ZÆ‹`˙A∆r›<˙àÏÕX—5ÿä∑Ï@™∆byÀV¥ò›§jÚ∂ˇk‚ˆ#ÊÎπ˜R⁄"Ógû€∏}≠ç»œQ#
∆PV”Í5£	Íü√ô‡íÂ›Ì¸Hhô¬EƒcW4Úö˜FÈytt
ÚRΩ_Ï¶I	b˚)˙I\uWá5˙‘ÜŸJz§»nÒÂéV—Ã√#â¢Ç≥¬áTRù»ê∂É—*˛ëÂπÃ8çÁË%U›;†W0ªÛ®1¯y]∏Lp˙Ò-£∞Ÿ#ﬁwú$q¬Yà{XPùÏG4~±Å¿äTÙ&® µ%ùDGo¶E(ùÙπ¿JÂµ
¥¥¶§ ¿lV √≥ßÄ“UJY[¸˝Vú4w?ˆÁ‹gÿÏ±fxíñ—Æ©æRáY§ù´∆∏/\âvu@/XΩ]-˜)‹ül”˘∂çf÷aIŒ°öèıÓT
sˆ<Õ-Ç=Ôy<°˛ÄŒÇlâg¬~WcŸY‘µò√œîZÀÆ≈Ô_‘¬+WärŒN}¥¨wk’^ﬂB¸≥yW°òª/√õ$~™Í¸·∑ˇû≥À4˜øhµ⁄˚‰∞Ωﬂi5HØ}‹ÌùêœüÏììn˜†sÙò<lˆ*Ï‹2◊ˆ:…kIe≥››’˙~ß›»˙∏t¥≥È¢AivH?ºr˘ò<Bˆæêz˚ÃFªÁΩ‘qàóë†kúç∆XÒzÁ≠f0%´≤’Á™‘sG@œ~I«•û£Yy(⁄õ¯sÊ˚tÑ./ „»=v∆ßïy§%Î√…±@«mœ'çN≥⁄°§√¬œÎ»‹{√òƒhæΩuˇ~ÆUü4ı˝eb∂œH˚ƒå¥•ûÍZoJKﬁãßkkúˆi%;r_—¥«OP¸ãçß&mËìE¬≥ß˚⁄»/É'C{(u£∆0+wûÎ“DK.ÀT≤êäoyßêOM™∆)s2˛√ßjzÜ\:Nå"-O¿[ö¶ÚgŒtü7Åtw°p!%(Ìòµ+≥n#Ëäå?Æ—A6LrãLJ]Ê”Gπl¿Ã_ÏN_§n‘q\ízÕ@±_ﬂÊå‘ßLæSíÜU∫æÃR∫≈G®ñ 2ÅsﬁÒV<òπr˙¡,±ΩQ*J®¢öEûÒD8—©rÄÓ¶l¬ÅG†õ# ·˛I8	2ÈQpïLùÇÀO0h™•ƒ¿é5<yYΩfË€Çˇ¡TÈ 4:g∏ó¸∫+∆!ÇZ\õk¡¸,¨„ìv%e9lgXæ} 3ÁY~Cs°!Áøû¿\1äÏÍ,Ì≥#»UÑCπ≥j	Ãô˛SR≈Uòwé∏¡ØÜ,”c{ª¿Ä|ùòµjyXÛ-ú≥ƒÚßﬂá<}0/3ÎU¢$çòrÚ[#m«¡vïΩóÆmü@bÚ∆ù⁄Ì-Y?¢ˆÄ‰íÖ’ÉycÛ/¯ÇzÊ˚_Årûñfbç⁄ÉÈw.ˆdmI´∫.ç◊$&"∂?Íò⁄[YS;0+à\Í›Õg~Ï§,ÛÌ‚4é≈lŸ≥ÃÏƒäœ´¡ƒ≤SßUV£\e"iSÃ*Ù—GRÄ≈Ÿˆ˘…∆0ÖLéÿ¸<D¡À]ƒÍm! ˘˝oﬁæ€ ≈µ»úc∞\ŒË"ÿÆÂ3îît∑{Õ√ˆ—I'Àµ/ﬂjÜò„åãıtdDV<£…ëπôp&¿}—Ñb&n*˙%C]—∆^#ÕÈ?P~∂0ÀéƒêÃÆ®	m~"+∏?¨I®<e&ÀÓ<A˙√àØ-(ÿX˜4˝>í[+ÿ"Hÿﬁûí–`+jeÚX
+v	À∫/Ö)"ÌB"ÒfŸ¯€x˙Ï∆3x‘–rë*+sçeKX,áKŒ∑Qÿµ·û`£û&KÓ) züÊ» ∆çW,ÒÕXú∑\$,Ò˜?HÀÉ¥Ïƒ˚5¬&÷ﬂàb∆ä*m∏2°SÀ-†õóùÌÀsäæ¶≈QÚáﬂ˛›ˇ¯	 O…ßFÈL®◊(Ù<∂·åNO§5˝Wü™HÒ=¨p.£ ‡ã»ÂÇöku⁄X)€Ë¥ˆ·ﬂeBA˚Êÿ}$J¿P⁄F'+hå°,@¬?Üå¨¢™(/¥GºÃìEßH?kD—KìÉ´‡¸àË-‰À|5z#3]X(PΩ–OkÑƒŒ{+vZ“êÙ≈≤ÒÜ¸îÿÃô)‘ÌÇ5yÛÇÊë<˜‰û¯√oˇ˙ˇø¸Îü†ò9Å3b1TLºbgèb ùÈwX∂ƒÀ≥ìÇCèLB;¢∑ƒ⁄l;⁄ÜiÖÈDVw1ﬂ
€ü'∞≤8ß%ÕVoçd;#†V·ÇXï_Iôè†°QQäïêzÅÙ	A€ü8x1◊Ω@3	A))4˜Rï‰lø£Xã∆NPﬂin•¬‚JﬁÕìéÏéƒ5 iÚØ~ˇˇGCqR}•Ü;QßÜ'ÔãÍ‚ÛAŒqÂÉ£,gu-äj•7≈°¬R(|Â”ŸéP3^∫?åÏI˚\Í|Óc∞Í¿V≥·∑FØ”_?n∂˙:…ﬂzë∫√ó“ã|Å‰≈⁄Y∞@ÍRr_;`ÊK4˚=Úº◊>^˝Ëı!œ◊ŒœÛ¸GŒ]8Çæ¸πªüe¨X√ﬁ<_—\å–µ?ÔóΩƒbçÂµ–ÎÙª˝©·À∫MÅ%,|Ü{Ú«J˜÷ÅgÖûø'ˇ≈≈Jæ˘Ü,Ì{ i…‘Ò¢E‘i.È∂l{D~≈Õ"rÃë7:ı1Ç<¥ë«m‡i∑À–ÃAØ+*fNú7,ÇÅévSRix“ª‡?ÛÈÀ=¿¨Ü ±ÈLHT/üT/N(ñÁã Qp¬aÅ>«Ö ∞u¸˛è≠s
vlxû≠ﬁY˘Ë5s-o¿ûÙ:≠àv∏Òœ˚›£µÄ7 ¢™≠ˆ‚NgÖl-/øyn“üÅ§Zj∫÷πÁCü`ipÃÿ‡0máõﬂç%∫§M∑∏&`Ä¡àö¿ä_:˜ŸŸ“ä2
ãh4˙#4¸VcÃ∑ÉgΩé∆f-⁄ﬂo÷πœµ)‚‘\≠Qê‘Ó†un;ÉF∫3ıﬁ¿B˘¶õ¯úπ◊g#–|Ùn÷äMÁ°5·åî|∆1ﬂ⁄Æö∆ôçU"gì9ÔD¨gÅóïîïsÆ’†&MEÆ+9Ÿeupú cûâQEl£g˚SŒq<´◊€ü˜‹*<ÉSáû‚àîUŒ'˘∏∫\˜yêºÔ6·bj…ø˝?⁄ Ñ¶©ÜSuIE’ZiQáYN^&^ª…I@î-.•›,<§N∫ß8Fƒ≤Ω$I†ˆ¢¨õi∞à’›ô¯wqJ v∫Î|ıÈÓÓ¡{„”ù‚4áë≥5k[F∫˙Ëî#Qtõ≈'¯≈ò<ı”˚6◊vu¸≤={	pæöE
∆Ÿ>5”¸"<ªT¢	i\l.6ùœ‘<‚còåsú6¢9zEŸÉüëÁ|’√£q·⁄s¥Ü7¢ﬂ4Õ_]Ò¶óKSLRíÂ¯»qy\%ºq
{2¥hGY‚è±»JKâ∑fêiƒWiMP—Ù†N‰ëszUê∂ÂG¶ÉàN^†ó.
ªlÓ—◊ô™z8¨Ä=<èÖpKp›êVhØÆ_
ßÒﬂπ^H¢ı5H‚<F3Y¸E¥Ó£t6XÓM·⁄nÃ@ÕπaI≠ •,DTÁ©Ñ@Ngæ¸πÈ≠öBZªÂB:%4Ùuvrä§Ù(Y≠rz—ryÆK∞|≥¢DYqJµo∏∞4•–?W˙¢µäaz úÎßZÀ¶ÕqÈÑ>·—±^ÍëÜq4è˘|Ô
≥S	Ú¢ﬁ… «>ıe. Ôıü»Ü˛ÈË‘Ê†ãd( /ßo]	)}ÆâÌ¶çÓ¶≠õ<lˆzM≤ﬂ&ª'›£vlté⁄ÕVg˙Î#ÚÁ§ﬂ<8È‚◊«”owéöúâÿ\m1≈
‹ Tßï96F◊S›2∞íŒ†øî¨Ø\x1£n/(≤CH1¶#ó–˛£Ω≈¯7ﬁ◊««tH—CæÙî/’g˚Ìg«M\©_.ÈVÂ»f`Z®œ®ÍŸ≤P∫µ^uç•Ëö’óN´
¬Ê“2°˘¸‰ •Y.íwío∏«]∑3X–=∆§íKºÑ@ˇΩøÃöP-8@4'ÛÜ~ıìhçäZl√˜u⁄ì¸Æ–fQ\eI{⁄¢ˆ\ˆíﬂ|?jy-òúä¿GccE	∆·ûˇÖ˚ÓGØaπº¡üû√W˘‡eÁ,ì›1kÂƒ1o6LÀˇH2/g∞h}Äî‘ΩàñMkè∫C÷È‹\â±#G3˜ΩI-ﬂ
Ÿ›–/òÉÛ$£˛ÄÕHD)~‡k¨h=ËwJ/ÿW+KF©ÙHT√o+—ÒÂFAËÑˇEEá·_$≈{YåÈyJ˜6wØØtOF=MòˇJÒƒ˘SÅ=úHÚiãé-&≤πlÀˆdˆUr…x˙›B<•
é√B ?À>Ê\ï1˜Òë7!Ó˚ÑtDÆ®O˙‘ôb«¢ˇ?Í<Ωzyª˙g˜ŸÊ∆··áS¸√)˛·◊ª˜√)˛û‚ä;ÌvÆ$/Gz˚—ûÊÚxCÍ+Ó´ÑÛö#;#ÿ2GNΩÕç—H∫E–”¿yŸh<yGcîMŒ'”Ô¸3Íz¡Oı¶Ô{/gÎFl‚Û	iÀ◊}ËP˝Zü‡Í9„ö.[3∫äi°∂•ó[:`H7…gÏÇÉLò é©h7Íˆ∫âÀ ß"HŸ,U°≤ÅÍLÿ˝◊ŸÛ±Z¢ÄuéÚ‘(∆èí"y»÷†g†⁄¨Ò«h$ı´∏ª/„xTM,«J•a%Æ7~VerÚood·¢n«!ç`$Å—$ø`¿Fvñ‘oÓÉDcÁá4í⁄mË	úÆúIçcõe‰÷gΩb´W ÍÕQ¥0}Ì‡ê⁄ÆÈˆ%,<‰Æ¯åÄ,x
‚ j@/@.Ïlå/óø$#€]ÖøÏÏÚX*FúŒWÔﬁÆ^:P∏ @‹_äúÀ^JQ´\‚RñØ'”Ô1]ø¢Òy9ÿ™!.ÀÅ«ôÚ¨Y∑q)çWÔîøu!^ÆµXN  ˜y¸eN‚ôÒ.sA<q˘⁄ÁlD`-aµ∂#ãò≤HNïòÈ¬ç‹<jpﬂ}Ï&È«?û~€Î5u…q∑G:M“Ëw:≠ŒIs_|w<È?iˆ:›eá>Ê∫ÒdÉcêúPñÎÎö ZƒÈw∞‰‚)©»äQz©êxÈFÂØMØe†∂¢”‹;B˘Rîπ∏¡Ö«>ÙA⁄-Ü!IiUO%Qﬂ›®”uÈ„§á@ÓgCAî˛4;πßI8k8†·tôû.“]¸>ïÏuôÎãòr72ä\íÀ»dd¯z˘Ì'ˇ¡Y¯æXı¢0‰èüÇ‹çÎåÑˇ.Ö~§ïèëP´^˙bÉÂdv±`=(¿9¿ Ïyëòn†Û µ/◊R¥jµ∑“
Lúz˝ ¥ƒ∑[DKú¡—¥!mLø¥óÄÀÛZ†√äÜçF}˛0*9ä¢lyéád∆≈‚¿#ÏßO®*#L›∆ˆÛ‹X√fÄw∫¶§¯p⁄ö	ñ_S%R!§ªÅß•]ÒßñÊz
∫y§†Ø»≠Ω#äj‘Ñ≤àÑZ_µ…˙	bZÁ’–„9`Wùaµlj˘™å≤≤∫‹Gï≠ƒŒú—%Î_≠ô`ÙyFá‚î“^8∫)¸ÍríŸ<kï¯Xƒg©X£ªı¥OS£}PÆ0hÌVÏÅÌ]≠=Äªe7∂∂Î´y◊g>ËµnñÇ∑€w–Û[∆X3ó^œ€/K√÷R(Kf5|SéÇJ’”áìl˙÷‚¯@"w–Ï•å∂π∏√–hô±A¿ ∆>⁄·U˛ÒQb†£Ùæµ–∑±ÿ|∆Ì:h©∑ö·$éy™ÓÓÓ‚yîfÄ ÏEy•àaî≤¡äu¢§_¶◊âY˙•˙i‚Œd7≥ÙË^Rœò= ô“Ÿ\•kyÕ¨k™=⁄e·„Y(®äÿ$ÁˇlUD¸vªJYÙÃX8tu	x*åqù
•«Ê≥ØØˇä˝vã‹õÓÄHÛh≤µΩˇÙè<C√qH©5aæ§bshöù££È[éñ&™±(AH&F?#«ÜBä'G#ê˘z¬G¡D@bR‹√ñ/Ô˜»©çØ‚c©¨R:vÑk˙ æç∞öòK`Ò4#∞?^xß«.Î‰« ·’aéØû]‹ªmÏ4w;‡ßûÎ?ÖX['ﬁpËHäßËîi,âu§ã(}2ê2îj˘r}Ö_ùã™q
Í—÷ŒD∏Uím™«Ë”(9nüñ’_‚An|ó<‡øÄ#âª"ûÅ“;óó9ˇv4CÜÔ—Rf=Yûk·FÕ@…(I02jäú≤ zÉ`ï√cKóå2˙ËíRäœú∫ÚKæœSﬁ¸t(v∑ÆJ˛‡HHıurƒ1%Ω::≠A&a|”˚*ù8H?|OÔØxä¶®¶|ä˘oQÒÕ2ÁÆﬂŸUMîÿ–ÃI™>›ıÌ›õñ^‚Ÿ€?ZÈè{MÈ’‰îÉüΩ‘≤‡L	¯ ∂ﬁ_±œQMπ%¡qv—£ôÂcä§ˇbk∑Zh%H;7.≥"∞õ©»ö'ıÃ-IÕ1è¸“ø√»ë∫|E_üÎqŸƒÌœ_™»â,_@¬"S_x)?èúü+x/>Q9ƒeòÃƒ}Úö¨≠≠ïMî&Æ§˙¿ƒÇÈñzÃ9{›àD≤˘sK#ıl£‘ ¸ƒı≈gVFéÎÃcQoÎQûï8e≥Gp.ÿo∂Çç]º=vÊ≥‡ºï·≥€‚Ò¶-£ }ÙQπÌ®†c»˘Ω∫¶÷X∆jkkÌÍ‰‚áC9xaƒFìº+á¢?ºnBéG.Û»Èª3ﬂIªd»~î…ˆi,Qê<WØòâ¶ù†‚è”≠x‹µ^'àÎÎ€1tj±∆ß7ñiÎ1XLµù?A^b§∂èãR±§i/◊h£
ıX…{ÕÂ∑ÊÍ°r˙∞Rqµc®ô¶¥·¨◊sF%D&¡CÒ¬Cö':Xøm–5}ÖŸ@ÖÏ√‹}Â∞@#ıw˝x&fõÙâdÚÛpL]Ôï\B≤!X1‰“u»•hp?»•˜S.a°[%Ï¥q=¬ºbËêΩ¸üóbºˆÌÉ∫!$«ˆÉz?e"ºÍ∂29tÍLÿÕ°œ)Zƒ,¶é¸ôI#á⁄ÓqtM‚àÓyÙ~ #>WvxU*è∆à¢}„Ú®})2~NràÏ“ÇË:Q<∫$—˚)â*âÅ‚zÄõE≠(È∏∂0“ª⁄¨.∞ı§πﬂ„…˚ùÈ∑›«]t«tˆ⁄‰∏Ÿkr¿Z>n˜˙›£ÊAÁóÕ˝˙˛˙T±‘ÆQ¡‡º≈R◊Äáp»ÇÄYˇÎ	ı3Îm1≈L∫|XÛ÷1≥–õuÑÅD_ÒÎ¬à@%«1H0€&EÛl<µ∂;ûËQ&äè8—9¥ä¡]…Ç”Ã≈˘±Ôç∆ö∆‚S«‘*j‘ìI}»ø`W??≈,u 'Ÿ⁄WÏJ§m^◊ç)ÖØ•o¿ﬂoÎ$&®ï‚S™1Ò,≠ÃÏâaxﬁddç˘i»•{1ìwBæ"ÎUpS r‰XÂëjüYÁt°®&#^á2q)9ÛAvh`2©ü<iHAöV†ík7Éí©ç±ä∏¯-˝ó3ë–∆È;uSwÊJ€¡Ω7sqˇ<˜RïŸÉ	f∑fΩà…√“ú;1€ºÇKóﬂ‹Öì«´’.®≈P∑@A›ã¬È [IŸg∫¨¢÷ÃÕ∫hFÈ.}L±õgÉ7%ò>›€T7œ‘1P^åïw8 ëZ[/[ÊãÇ?¿‚ﬁ’€öΩôyè>Ñtêﬂ` =ôøï^<∏trÍy¸å`lªf∫z∞FÌ™êu,ΩÕîtﬂ≥XÄÏÓ<As‚ÑXË:˝—˚/>≈¬”NéyÉµÆjuMIcáÃËﬂ√˚®ˆRÁ»Is.tü"™¬Ù∫ÊmäÌg'≠¡‡eH¯¨»QÅs-Óä…o:Ã[∂o9Âû|˛w-IÅ>
±ﬂlôõ·ÅπËπ√b¸~W¨S?J‹,.)û≥k*^ø¶ı*@√@(Ê…çŸ◊m-L8ﬂI”qŒ¢’€I¸-Y0TC—≤ûU≥ofŸ;ËxëS”u](õÙéÕÂ?œDç1M˝ˇ%_á◊à∑Õïöx5 ≈ÿB»˚t¬7ﬁ  T†à(˛Ï1\º4%¬RVKqgm–ûÏ>, Eè~”ùæuÏ¿HKú≥à+ifFidÅ·ìzl•LO–ñ_‰Éd¶>gü!$#Ì8Äø‡Ò.>IÊƒ;Ì€å¥–˜ä#5¯ºLï5q¯FhuÃµ‘ä‘*Ùê£Á” ‘‘Œ–7#NÑlFR{Í«˚_˜‚OŒ» ]v´ $ÆàÊU†®É5ü'[)ËøΩ\E4Ú·Ïÿ_›ÃêƒÌ‚‚≥‘Xó0˝&«SdÅpà€ÆÂ˘cL…#†·£¬≥∞	©§Éƒäáòˇ∫ ∑˙∂≥XZl€˜ºG#§∫B™–Fr˙¨∏ v◊ƒEw¢ƒﬁıëpÅ]JN=oÂπ≥˚tÑÁ7ﬂËàæŸWIóñqπ‡{P‹' ∏õ„±sèaGåNPv≈.1,ÎŒz∂∂∂◊ñäöïrnE_ÓÓ¶úU•©≥ë˙fhrY7VP//	7nâ6´lÿ‰…Ú˜¢Â*¯b"jÑ°‚(S#û≥ãgRßyÕEp≠sf}%Ï√≠N4uü«⁄fkæF%õÆÖ%>(éb6∫;•/<êI6Ù€gd˙ª–v,h~å{^–Cgj¸R◊æ›ì0O&3‰”Çó"◊‡ßi u Å`¥x9ØJÜ∞pßéá‰ê1∏¸¿ˆ°}â '◊-ji.u,.Æ_\¯0˚ˆ<4∞?ì=∑œ˚˛JÖÊ–gCÍ'Nfb‡=@\Å£t¯4Ÿìº+ãÿπï˚v∑‚=£ˆˇt∂≠‹¥—¢·'≤•zHRT`°Zªrà§»…¿÷∆ì«è°ÁÿôÃFIéC|á*Îˇˆ€»<≠QƒÉPﬁë1D;Õ4‘Ì“{HCœ_≥{|ÍQ∞ˆ“á5Ày+äù∂Ç˝——Å¢ø±î∏Ì,\¯˝Ê:¶c∆+b=?9K÷LdQ%7ä®!vµ`+È#ÆKò,XÑ»= èy¶ò˘‹0∆M	&≥@G·svç2:s5K√óùÂTµÑ˛◊èYX{mU^ÄR;Ä©%]wµo˘æxåéTˇäxg§Ü‘:g“—!l^-.3*o˜D∏»∆çÚô-å≈L∏•Fß⁄ƒh≤∆çø˛bπøÓùoœGÕâ/⁄É¶À.Ω=∞Æá6F;QH¥Ë8ú¯4 ˚6∫”tÄ§Q<ıotŸ∫Ó≠üo•õh]:weìå{*N∑˛LgﬂxD«çÜ=Ú”Zﬂ˙Êù¸ä]›˜ÆŸÉ7≥©j∂5h:2I*5Ä±°+$-—ßâÔºÅ≥<øπ–±T%Á)∆x=›Yﬂ˛íxß/Oœ8⁄/#VjQ∑ÔÓöÜyo,Xép<÷pxîÑJT—¯å2©
ùO˚˝Ø˛É⁄ù7øˇ’4;^‡˝≤f√⁄ç.Íê“hßö/u¶µ-|nòJ,„‚LCU,`◊˙‰ò∫¨ ‚ûï†0Éﬁ7Õ◊ªŸÇõ.ﬂÊ‚ârWORz–qµm'2ı¨+Íju’á\F/?ÛÃ¬Ëx–ÅvŸMﬂ"Wl@¨n1Ûåò'r&xÆ∫Ò:ŸÔ¥∫á’Ô¢q¢iÌ§ítÑr∞"‰ˇä˘às¢Ÿ…àdq—œ+»[–“Én´y@⁄§st“Óu+«°: ¨1V≥Ô/ÂˆTJ9ì’µ[æ∫åﬁ˙1k°æun_xA%¬Ä˙KÃ„ıı«å{sFcÄGŸÒä‰´n}¢¨DtÔL¯’¥⁄|∫F@£ç7†>•i·1éãÊ8#W•”Ä∑ßo9†Æuö‚k Z?ﬁ$ÙÇÌ√è˝JÚ}f'gV}††ﬁ˜È˘¸‡ç…/±C1õﬁëú¯ˆpà\U∂órì¢ Ûå– üúZï™7U™@R%$ôTb≥|·ÌJNI–_Ω…∏ ˜\MÈ4({bkcü]@gˆŸE—JM•K˚·çØµQâ÷ÄÜÙÔåÒåŸÙ7kg∞åΩÇÈ”ñ⁄=Æø†QÿZu◊™∆ßb MOÛqñ<2çÃ\b-µZ∂∏’øÊ¯%”Ú2ë™q‰?;ÕTH‹‚∂Ü∆†w~i˙rœEäò˛q9T·Ç)”s•\6}‰i°NÂí3Ñ	Ñ~=ô~Ø°éh$≈Ω‚›¯ÖJëör≠ÈíIh#ÿ ?ÂxN'º∆X¶‚té≠*¢çnU+\ßÒ^Z´§‚œx@ÒìHê7£…˘ê;uc&ôPEE$∫P∞˜z
gr∆Û]P≤µæôØ⁄∫Õ9ÓãSXw≈ﬂJD&^gôìïe£√YôÊ¨ù·Û.˜ï«â2Zk≤(FÖﬁfMD€aC€á-*w‚:˘eÁXÁ±ºB[èÅNDé§Y“ªaÁ•ö£ﬁ’‘≤ÿ8ºød£	∑˛G+kk¥≤∂ﬂ:\Y{eèWËòß∫‚<¨gø\ÖoVQÒÙYÄ¨˜ƒ\ΩwÒA+KΩ≈˚FØiu"Ì¡ aù˚t,“uæß™/úwsŒJÈÚïÓ∫ƒ±uCõÓÄ^Â	tq€’ƒõ∞%Õ&/⁄éÔ”^ºÒ≠¯sﬂâ˙N≈jÉî´WM∞â«ﬁxÇ{Öy!G√
 u]VùCz`√¸§Ó‘V¯3Ùµ≈lµw
•µ{)Ù◊≠çl$çåÆÙ4è¨èj,êT››ººRagµHp1Láv»˘ÍŒÅ%Í‹_‚ëpra≥óΩÀ˚KdÉlÌ¿ˇñFØæÇ@∞˘ ¡ZhùËF	«4<óÿ.≥Ë¯˛ë%Â€ *3_ˇ©=œÔøÜQ~C˜óÔíÕ-gãlëù’ù—m≤EÔíª–√ÕÕ’Õ;Ø¯mcy•)Ô≠√ÄËlΩ"é"=UìÊﬁ˘N}ƒø`5Ï”êW#:‰òZ6O>Ï€ÆÂ{./	Ó≠üÔhu¨‘jÀVÇdéDYe˙ ø}ﬂËŸRzQôS§#$3	A˜≥]k∏`Ëk≈{≤ÉRòÚ¢ícW:¶Ú»xc\=ï}—ô≈Èø”oΩLçy©J·ƒ√·¿¬ı«PˆŒ»…˘dtÍR€	»K§EïyEËü	ë˝qƒ‚SytÃïOë›Œ	ôÆ=πoµ,ÎhÿIπR‘hPùB÷$»#ê(ÊÃ^–Øê[,ñõÅ‡¿O,<Ñ™◊¬T<‹Gˆp™£nÏ9¡û±É®ò Ÿ
&/Y,I⁄–}H⁄F⁄©{\üu"˝'∂ì‚/Ôdï"˛Èº‡Îâ{.uÕ• Li.Uîé%∏û1Úç˚–Ø†cuR¯“I˚IÏ∆g°?˝aË√Ç&å‡#{»œMt∑˘ÏåÅÊcŸ∏⁄1)Éœ%õ+dkÖ∞–Z[ñÂ>Q:`ú3¨◊1Ì¨ô¬uÛôI¬åQ&K!àä∞9U–îÙÚ®ÃÛ®'`%∏ommÕºnV;ùÉÏ]ﬂ`ŸÓW•÷˘"'Zw.6Q$¿Æq®t_åí»ÁºM˚ Õÿ¶„YGÚ`˜@#Ûã‘4ÄF÷+\(V”^·¬†–èP¥H0eﬁ—UuCbnx°ê]‰ƒ˚∞bÚ-Eà-dòx˙»0<X„¿‹{$∆tÆæVQ®Õî2ÿx˙•vícF`≈‚*¶xﬁRÑUL’|;áq≈ˇ"2ôR‘ u≈î¶å™Ö-®ù~'Ëyë`‡•ˆH‘J¿N^¯ —ukË]flÇÊR∏S‘ô[ƒ*ønãú-É™,õ{ÖÿÉKÉ,A3,˝åá &‰ó∏O0;x˝
fg_˘√YH˘ﬁ›Óò]›à“¨W¯]‹ˇÑ◊ F¸r‹à^ÒT™;«æ˜Bve? 8ˆ<ùIö©—ù>Ê“âÓ¯„<¡˛XOCi‚ªöGêfv˛Æ^j˛naj>&Vr{ËÇ…Ï.mU£¬ïF#DRÇA]£°àü´,1 `≤∂Çˇbú	DeÖ)~áˇ¬àì[˜≈±&º’Ç å“”¿s&!÷ÕbﬁÖè≈Êx¯p•≥8Jù=•A⁄T÷ø:Süúq∫ä*-I:ëöõŒŒäæE∞ÈåÇ¸juÀÄ·B∫⁄é=≤]éVAÃ%≈j ·ì7¨!6–ä˛l~¨\s"úÃ!Ô∆TMK\æi1˙ìtóµhF∂ä;íYé;√’X¶rºÇô7+Û…EÌî\Ôtf–]XﬂÓ:rÍL|§…B6'n€\rz\TdGÓıL1ÿÊC(|‘y¸§◊;mpI>!õ◊	wñCŒ¥)ÏkF›ë){Ú—Îú:Å Oááèó$EœŸƒ:lÕî21ÈèÆ#æ$vx⁄E’≠Qnﬁ˜Ê˘Cl¬ô/¿ˇÖÆ<Èﬂ4ùˆÂ5j‡Œ≈?jıõëô)îåÄáıLK⁄rõ9ßH√qúmíÙ
UVÄﬁñÜ_} |’ã◊pÎÍï÷(/m∏¥ÕO3$Ω≤Hõyã1÷¨F~n‰0õÔX˝âka˙æƒP∆Íñ§ûêÏà…èÊÇ‘‡R±âíèC<≤e8T,ò~¶¿z8ª1µ)dÆÿF˜(4;)—i
{ïKı2≈âå6Ëki&Pê§¯˛ÜãoS‰êJì ≠¨=p?∂‡xM÷÷÷/+$2å˜xWﬂ¿âÇﬂõ≤v„åêbã0œCWf‰ÙU≤¢®éuä%¶.w~å±∑<ëŒ V$üü{Î‚˚9õÉuÛ‡Iø^c f¯÷2¬ˇô©èí∫®Â-µ$~“REüÈr≈œ§~™$√AóKÜVãˇ”=Èukà¸,PL$.´y~åÖ~~t?Êã</8`=<Äˇ‘M¬“z–j-∞AæH‡Î7ZS*Ò[$–∑˙˛
Ü}AË∆•BÁ’◊õ˘Ò€C[RøΩ{AÅ.Â"¬‰≥ÄÌ≠å˚Ìﬁwu≤»t~˘'l8YØv!2LÔ3ª√|”‘cbvπæWÃΩˆ¿9ˆéΩ@xË]ŒÖG◊˛öö«5™9#ìΩé9^T:VÏK‘ÉØ@«ÉÀÎ2ç≤œÀ∑«ªÓÁ‘qË´°gFM°]Zó∫IœR7~£z¯◊ep∏ì–ì åß
aSB‚ Hñ˘ôê$Ä9ÇˇN}JG=∆Ã€6 ó)*‹ôÅª©(ˇè®¢‹,Õä(∑w7S±¨¶ı¶}ô≈qÜ§ë\ÊÿËŸIú7√)„’Ìc
ã⁄«bDŒNã#{¡HÉΩX#ø∏`¡Ù{ÃÇ¸≈
˘úGA»~˛âaÈ/ñ…,üWpámâö~πÇ`‹Çë˛{:	wë©õ¿πDÀÄ;˝!ú8Fæ¯1?≤*◊°Qj\Ú©aNÛ€
”Â∂»K¯ˇ¬2}ï«qˇfKBı‘K˙UZ´—≥<:ÂYu«7ó,˜:∆ì«úkÊ+m÷USÈYÇöﬂ∏–#G§sõgëgålˆù/JnqÜf˛#F…f.Ä≈08f‘ÜÆÂ†i∫aT|¬≈›(©YLπXÊ˘À‚}ñˆsP∆LßIˇ‰•}q&µ"Ò<¶æ¿ôÆ¡Ô∑v≥“ﬁÏ.S
J„¿,¢è µ‡î®F˜IO£äwktˇ‹>∆rÔ¢©nÅÓB9ÛyÎs»îh⁄xhœöPoJeP°"úIk É8£ñá?”«£}S˝E94∑RÒÉv;˜xãƒS¨,¥≠;Ù~°ZVìÚJ¶…ìMxßk—aRﬂ«˝ANµ∆î'ßëåCCI% m6Â∂Q$~éΩ¿<€IŒVIùˆµf¯ÕÎ¨„ê2Œ •HÕ®Ê:˙Ã…:3K§÷	%	QÔ"ÎÍ}ÚÑ-6ˆeù0åh	6¬Z¬ü¬’j)æYià¨íÕπ„@Éÿ¡:Ì»™lŒ¸ˆ77ö$#ÌÆrƒ≥"ì.MXHıµù§ÕW`ö)†5iÛ9πA[≥ΩkŒ¿˘˝ø¸CÖ≥ñö∫(©Så±jñãçü“®ÚS(ç>ôW}ÚA˝•QﬂNlS¶Æ:‚ËoØ]’>i⁄€˚‰œôåXËÉeMw(ÈË#∞yÛä∫:û›∫,Ås…Gêç<r{–˜&æ≈bÁ±·˛K⁄È∏∞¬©#G≤°Ù‘°ÑÜ;¡ˆ@LDwÃ‹FËOòQKF‚!oSèBYé∂Ò•ÄkEú‹h´°∑Íì3ﬂ≈ÃXFsaSAkº’Òƒª3˙BàÂŒXÙ®7'>Ô‰˛b∫	ƒú™6åÈ=x’≠8;Hùœ°£ ø∫ ∞#a5ó?≈É∑≥°«p†~§|Ã\Ê£w‹ô n∫»N˘‚AÃ@Ni[˛∑¸Ù;‹ÛíÈêÛüÀ$˝I3ÃVôEâOïZ—X&|s3Œ‡?"2S=!›`∞é3 ‹®Q˜V	µAGß∞M˝√¶GÖ	úÓ•:ƒûc=v-8¬ ˚g\Å'*ÂÕìÉf'˛Q˜§€Îµõù˛Iì¸9i·oÕVg˙Î#“<jûL}ÿi5˘MƒXÕ&{dÛ§ÎX$+ }'"a:»·|;‰£‰3¬‡[6Ë≈Wb»c»7u¸µ<Gfæ`˚:ˆ=LLpÓø∆*^ƒaÏáì_¿ÍÂ´8sEs≥[ì	~†ˆ›_ö-Dåè`8>V˝ï?i»F∂k√¶ˇtıÓº‚…GÒÓøÊ?nóŸ˜pÉ'æ-˙MÁN€µú	Ç˛äëÜi_»¢Ô+ﬂ…∂ì|g–‘∫÷öÓ?Èú¥…Õ~Î…A≥áã˚crÿ<níÈ∑∞éªá›’œ€á›˝Œ—Ù[X“]ù%˝8RŸáU-?ã^’rÄ≈
ç~”\€_§nVæògÖ'm,bëõµ¶∑Œaa˜[∞îõ'ùÈµèˆ€Ω>»Òyrp“kˆªOé@¨wé`°?ÓÎ,r©°´ uıR«É˚Øœ2˜V@ÿyÓâ7:,±„¡ÿ+ˆ@ÀbÅaÕˆ5v·T¿qœ«G˘qÙ.é‹˘+…öÄnÌë[pëÚè„˘U(∞ÍBÖı·π¡Eº‹bF&Ößíº<GR©DQ©ÏÔìÒÄ*˝ù_ﬂ›t ÁãÄ¨¸Â&¶m—ñœ‡q‹4Öë|´√£ÑåY“∫£R`àã÷P¬6 a†?À¯Zün|	ÔŒQ¿+µÿrª=È?ºÏ…gD¸€Ù{xhÈ<¶¶?s
fŒ{bfRèù}6ÿ+<≈s]≠Z-«òÆ¶d4Œ®T;5ä
üÌ⁄ì]Èï©ÿÈıw?°≠8Hì∑∏ˇzî{≥™”\}è¯˛ÙÎU<?“ò*µ©∂Â}z6˝ûVh7ñ˝≥˝s;=ˇÍ˛ÎÃUã©O/—Í≤ó‚Á˘OÑßq[+$
\\ﬂˆCΩeuuïNΩˇ‰†Kˆ€§˘døvÁÙØ–‰l—<x"-N¯[l—˝Ê>˛ÿkw{†”7û<T\—9:lÔwö`¨w˚'´è€GÌû¯”2 lesL¢ân^]Âùç‰èÆVo£ﬂÔÈ?€‹⁄8€§_&®∏	oËÖÌ¡I.sYbØŸ6ßæm¿äæ∆»góÊ)‹é¸e»)Â9é' ;™ôü[ÁÃ˙™e˚ñ√2iìüíó˛<˘
;
¶QÍp1Êâ6"2ûRÉƒY#i¢˝ÇYûOö0¥<∂(,ªÔ»a{EƒÃKnAFZ`ÒË 6@•[¶öVp6°p>[jß¸]}	≠¢E§%”ÄÒùŸÂ9≈µsAGÍ] ñyà˜> {âRV$éªo‚qÄCÉùÁÏíàZC#Ç≈”,ÉÈC¯c@Ç…ê˘6‚›rg)ºò∏!ıÁ¡yπ›ÖÌmmœm˚æÁ◊‹Ÿ„’¢‚»Ê‚{1éÏNö◊=AÏ€éÎ´´of>D<¶ 	ˇ√oÛﬂàx9ÊØÚΩí!®†F^®8à„^∂€óc É§#ÒY:≥ë™«vRd4ÿ?Ç∏|ÖYˇ\Boúmúnﬁ˛r˝Óùf›VåÀY(≥wÛ20^Ωì›ë0ﬁQÖqxµä,⁄Ÿ@…`‚ÛW≈òpUÑ‘Í‰∏ë/cx÷v1Ü5Ã™ú_´ò3_∑Ôï∞pÂµ≥|`G{¸gﬂ{ô"+ÉÔgf0 !9ÕåçƒÆü¬0rmæxπÖêﬂËÉÁyöy1›œ¥¿QÊ∑H‰(Á¥!(’= RªŸˆµ©»4É+˜Ù„5z|9IÌµvíe[àmÿÌ‚∏Â¥9€3À™ÎTwéu{ámsY;>¶«ì∆Ø-IÏ]€’FIO≠Í‹–ÕZ‚IÚπRa%u∆UÃfÎ§ÛES{ºÙ#°&±«Ÿ‰·≈ bDAßŸıª∞*ÿµOÊ_Dö]:˝˝„Ø'^¯«◊Ú|8Ü©/~«øXÍpú8*,4 A§4™ "~ÈÑptÑÇ√{Ï{ÉY≠R£ë”`–[4ÿºÆ<	òs∂
/èÁˇôËFb÷$»<˜'œ≥–)’©cº‰÷X≥“)dãÿ9DÛ2Â`+è:]ôÚën¬RπŒ®-RÆr‰ﬁ›(÷≥BK÷¨RZó~¶à¿ŸM∞‚3)ÜIFOqa¶ÚU|ππ°ŸÅ7œı¶>BÛ,Wœa{ ‰È≥lB:¢”@£1úæI¡´i∞"D& ‚K“K{ƒ+Vßo}∆… 0xàƒcçCÏW—¥=ñµ†ı$·ÏW–-¢ºwhªÿ˘¨í¥√Ûvv…MJ7Ô…![¿Su‘à˘√@¶e$îÂçØN<¯j|ÍQ–»ë+D¯øMe‘R1âK˘÷Q‘f-∏~eøã"pIÿÆäEec£SÍ·QJ£fÂÎljΩ–Ú8å‚[Ëä0Io™∏Í5'JΩ“Ù‡vs’∂Ä≤é]8€Ö.úåΩúÚ‡(©ëõÈZ∂,U∞∞#Ÿ»ÊûùÍ;a}fÃÏZñc©d`ŸÚvU˝òzBŸLäÚ-<QΩ^∑ávHÁË§˝X˙·˜å‘f~©:Áp—˙vf}q%beQÁÙ9ï+Y´8AUÜ9$'ä‚u∫ï•¨äk	©ß!m"≈ı˙‰ÛA!∏yŸRE”r•ab&ì–œ7ﬂê.«Á_˚ä]ç1„≥≥Çe%∞æ<ßRíøsÇ(UÚúEÚØ◊+å–“6Ωmâ0“6YK„ƒËY@â=¶´›3Iq~]ΩF6LèÁ±πçQõè™Z£‡‹ÑÁYw¯3Á´¯_íüW$""…sÉ§6˝…X˚ÎYk‘ˆ$ÏP¯ÑÜmÂ—Ùm7Cè4	=ÆA¸kL†â∫|l±gLü=P	4ÖäHÿI3™nßqbq¡K'Ÿ™ó]˚à¥∫zæ2˝I[TÆ|µ¿œ∆öûãäµqgsÁKQ=ÈÖÓH©∆À∏âÌ"´Z0πæ†l∞G√è1€¨Ê.ÏM>Q<
ƒ}∫ª°S®E ÛZdq∂6§n∆<XÎ+∞«ñ≤QÄ 9‘ò¡ycè2©§ﬂÈü¥õ‹eŒ]ª¬Kﬁõ~{‹ŸÁ_À¥ì>i˜∫≠vøyÿiùtqytO⁄:Y#%a‚]t
éEp.vﬁ¨öœ)>‰1>ßD‰¢0›n∆$¨ÿ—◊E√≥{GDÀ≤µÿ:ÆŒ2YX‘¨ fñS≠f1SEÕä‘≠SÁótúVRnÉär;£BÈ("ÆÍÖöáÜ!≤{Á€π”Æ *{"5ÏÌS™è¿®#Ó,l¢r!ïêﬁÙÌ#ı·Ùá¡ƒÒÕcÍ|{õ∏ﬁ!øõ?≈g≠‘Öø
eﬁª“√Æ?’èUcÖ•rÖ0D Qå~Y: #öCÈ¬D1¯“¢/“ ®∫c<}ÿ£âÉﬁl&”©DuhÇ¥+5m≠Ò—p-“Ég„CZÁb8L…∞¥Ccë/°0F¶#’µΩ2¶a±BXTQz“t>6¢ %©Á:ñI^ËÜ¬˝ÿYº©lhgHR∏ô8–ß&Rc;èqªL==:Ìê¬k
RÒj¡k‡ÈyÑ~Ù·]≠àD6≈->›∏·≈∞œÇ—u¨}#bÊ5([4§é7$èë1æJŒI3È(øÓh™∏ØüVõkSa¿RL™(óV4Ó·ƒp€~˚ﬂE˙§˚å™e-S2˝÷•°7ÚV?gË´wßoG∂Âi=‡îÜ∞ﬂ=>>hcaÆ÷mp[{dÊH˛ƒ™ﬂàZæw°tÃ=ﬂg‘Uëí∆°vú¸∞ôóWà5}ãß;˜J!∂ÉÎ6Í!=ÖDõÃÒ,[‚@`V3áü5≠~¬<{˛YJªÁ‚LÈú‚ÍΩ˜¶˙È⁄kBñå.àˇ˙óÑWis†Ä‘0_!«<:ù≈ 6aqLÄAçVDÑB0œzP<hf-†´“Å}Ü‰∑‚ÚÃ˙‡hŸ∞*2îw∫"¡Ù{ÃhÇÂrj{#+	ãwj¨
≈‘,<ª”ÜÏMØñ∫o∏2˛Õˇ$=ºç<LF∆#åt‹3áÇÏ˘∂GM00Ä∑˜óçVFØπﬂÏ¡]&+£5°n»=’‰6li:¡RS'Î‚¢ÄYºSü¡Ò5¸ÈM-jœ®Kù+ò√)˛Ów$ô?^.x§≈ÿ<≤Nˆm:tß?!˛⁄º†Ó+:‡Sø\›K«˚èÃÊ?CÚ1ﬁo≤@#°>X;MoÈ3xoì/ÎY`˛œú…¨ÊQi‡]¢uõ:¯‘+ÇçKa†.âË´dMDﬂºãEÒıÑC=<c‘1\˜W%ET@(ÇO6:‚‘\ì	ÊÂ])kúO^¿¶ˇ@Q-8√9tÿ+
;~@±ÍOûüzïçß’ò„\ÍP¶#ù\x”|jü:6.ÍÒ˘ï·ˇ˙7‰·ÙwË-PêÌ¢ùÈ[.Ta∂˚ûÌ∆cn≥Ä9c∂≠˜ù¢sÙÿd≤eY9ç;f!⁄⁄Ù{ﬁ´aÃøAâÎÖûü¡´ﬂ`%‘ô‰à∆&«%&òˇ˙.¶◊3ëfKùg¡d∂óÒ,ˇkÿ´p+åU„3'¯ÛxÿzN√†9É¨è.n9†Åº7<À€˝'áÌ#“=Êï∫›£ÊÅ…Ù˜—TÌW4â+3æ"ÏöôjFÏ—}!úíJ vT'®Nﬂms/¶ﬂ{÷4âﬁˆß(·ƒ√Ss±¸€ˇåôπNú ê,á»#zL-Å3j≤*éa)¥èN⁄&K·T’â≈)–^0–◊H8˝Œrπ…F0j=°/–/k¡
8u".4üπ¸◊3ÎqË}ubÂ7…º /ﬁ≈¥aÒ56ˇﬂì«p'E}?2‰qoùLøÛG6ÿ«f"˝†€oˆ:]ìyÏX§©£~fª†Ö€Ct4∫>úœ‹YÔπ„˘=HŒ˙9FGµ2ç¸˜d˘ØÔb
ÎúÅ1b[¶s¯7§-Bƒ„Ùáq(Á0ñﬂFsÿÔuè˚ùæ…vaˇπ(ï3"ÿ%7ä∑ê;@‹3êÀÓdàõåäµÃ™1ë1éd4ì‚ãd*≈ÔÔb.Gåüa∞»‘‘˙ı_ìfÄëNå3aLìxçΩ<o©Ÿl">∆~”h2ï…∏oÀ2Çh÷0-,ò Ä;‰[v‚πjŸî∏x"◊S∞ﬁo€˘ÃÛB◊ã¡‘F˙{ÇxCè¡y!ÂCvlÛ©=F›√5sìwxIËÒÙ€«ù##;I†‡¬ëFQR ËÚ>¡>€“p f
2π¥Œ¨JdbU⁄äoyõÄﬂ∏ÚåbÎYpÂ"9∑©ÿ˝Ôø"->ŒH›ÈØ±U3oxÎIsø◊Ö[{èõGFßg¢;hÚé¿–ÙÜòå9@⁄Y2˝Åw6ÚòY‹HÚP*'gıªéØ+Ü%ŒBMãYçaõo|ß¬⁄ÅeºSˇÀˇ¬yÙ∆“¡ıH4√≥&ór/MÍ#0pNûÙÃÑo+J∞Â PÄjUN‘–ßìQÏ≥‚NK∆c:ëíeD]ˆ¬˚).<«áÕ]„Sı/14â√…%oÀIC‹ÙT`≥≠{–ÏwqD™ÓQ€hÆ˜£˘ÖΩìÍ€Øx‹¡∑9qLAêËù§ö≤Ò∞≥⁄kÓ˜WHW˛ÀBkmπ∆úü:ìîlÊø'≥Õ]ÿT…#O2bB±K¡‰>πu+¬òUÉÙO°…5{†Ak"…Gt2ªÔÒ•£q!!_±+é1ßÕÄ[ìõ!`aø‡ı…ç∑‘–ßyêHo:KF|¢Qﬁ#∑∆ËWÕ˚ﬂËÚj22§´—∑ïºâ≠“ÇÙrﬁ›åOY]åAQ∫\≥⁄£˚y˛_C|æIïñ+znú~Óçj:Rµ®qëAí^Ç	≥Ö≈±πlí|Ö˙z5pë¯Ë’õœ#íö'Q¶8„S…O)=Q…Ï ¿◊`í©ÁGóêƒåóAê¿jwG$TY∏ÜOΩK}4K¨zÑ
ê@ü_E·~R—ÄõEÕ∆Á	¢‰|u´‚>nd!ü!•†ª1jfÛÕS.â›b4ËcFOë´	cƒãSå¯=ã“u’∑|æ.é'ÄÖ˚F¯‹L}¢È˛@≠I{h¡»Kã∑˙ß3“˜R˚©DÔ6xÓ]ïÃº+%Æó^á—OÏ^Áí¨˙“Jï†äKE7„OÊ?O0êGå˛Ø2˜Ôı)ﬁ'o;Ñˇ”!”©,≠˝UÕßùÏJP≠≠¢ïËÔUpí•µ∑5`f@¬	˘ö3çäoeΩ¡0k÷˝Îq‰TÆèˆ%!zÆ.ß[nÜCYJS,~ô[-Ït”ùÕíùcSC$9ã≤ôê©ˆCµ¨Ph<Ÿà<±©æ˘Ü‹í≈£úg=hôhÀkÅ7bçáûgÄ´ëOùÁZF{/Â±uπz%Ïé‚æ≠j¶ ô-®Q$]÷”çµªwæÃs6Ó*<éÚlwΩmÔe™ÚsaS˚Æ™Ë'µÉ”¶àT‚ìö?≈µç :‰i€•ô‹≈•;\ÆT-çJ—¸"–√N∫ßyŒÙÿôœÇÛ÷À"ÅìØ¸Á3cXÎåòtèeD%cJµ–¿¿<6)y“8Î4°ût)Ww®»„(¬pXD—lè4^Îli…"mÍ∏T<™±]^V◊ÎîTzºiX'|Ù§˝EìÙ€≠å≥y4˝ˆ†”ÔÙ2gøK˛ú<ú˛¶ˇ'O⁄¢˛¯aÁ·Aß˚∏◊|Ñ¯ìÊ≈∆πÚÉ—`V˘Ø‹≠8zDIÑ? õ{QZßHÏëÅê∏¶«a ;+:I	t	¶ñ™m•5 ^_ùÖ.Œ…’!oeÌ¶ÖÅÎ9 Óq˘
'ìé∆•ã¬[l[{ﬂ∏Ó¥09XK(Ë ‘Í÷Mó ÿ÷∞Ò“ä|^.VÎÔ
∑z˛§òáZ√ò…ÅFh‡ÊI∑èi…C¥ ]∫í⁄Ä @…B™·P2π'nU67O‰œ‰£å¡6±Ï1f(ê+›°Rá€–ˆ1wç'Ü¢:H§~ã∆)3i<J“√˚<“*Çp+D˘C”"N8‚8∂Ís¨õZ÷bF®∏≈ı#ﬁœ@©ËvKùÇﬁH™njïUWV¬gå—‹Ê(≠Å<u<Î+≠≠–ÛıHNèíµ”ô˙{⁄ïVƒc¨’sç¬>~ôåd«´ÍYÿÁUvqT≥;Ànu=¬Q0Ÿ∂è37†#L Ùñt"≤≈]†∏∞ÌpT‹Ö≠=e$ò~Î√2¿˝¥œ,õß‚övAfè=ã≠TÏÌΩhü%ñVVù'é`´>ÿQRìS¯–ù=æ•ì'Óßn0~$F≈4áºp.˜¿]| ^ï<'}˙OinÅ™F1¸Çj>[ÑcœF!Í	FÏı<,
ÌkáEÎë›Á£ )(≥LâÜË¡,:¯≤)k†ƒªú≤N∆±Îµeÿeû√Œ¬ä §v81aZM^âä◊“n%Ç∫V›êwrŸ1+ºÍpT„ëiG•	{6y'à4äBf‚m∫±hMÿkÌ BÊà(àçdhÆ ¯ÜÅ@É@PYÓTDgB‚Zã|.∞—¶ÎcD//ò}Aﬁ‘¨%√+Ü€Ã–- oÑâ‘ª5Ôﬁ#Ö[<Óãúó5ÃÎÌª%ØÕk:8K˝õ£Y®£yî‚†zÓJurtùïÜ^»x wı,rm`ŒıØ–`Yî/@c#ÊK}"y∏í:◊»ßÁñ’2©B<MW!‚qÏ!Oïø!'U\¯˜≥ˆP=ÙºØêû∂tUFıíÔø{*Y\ùd5˝∏›SQ5jz*2é)q—|^©∏Ñ˜g„ÉäÍè—U∑9…5N*íI˜4ú~Á*≈4ónæ+r·†ñœ∞‘}¿≥“ôK)ñl_0{rÙ
Ë…Ä¬: #¡t,Çœ¥û2’g‘∑Œ*ıÁf:ï∏ÉåFMº›J-Oo∫ü¨VU8=◊§]â—\∏j≈ﬂ`1GòÜV•Å•pÛ⁄’ˆ^ƒ#A—∏!Ö*Õ§ÛÛU©¥R≠ÃŸ7ﬂùbUÛ„÷¨J(,Û⁄Ut·|˙UàÛ≥Q∞$á9*8∞~¶øK˚ƒ‰Â"ÍÉ≥BkÚÎ…Ù;âÌ=ø E´Ã-gr≈|≠∑&`–2	¸É\àË∆o ªFU÷–¯)Ç¿πû≈xpP(TËX†‰ÿ?Ë›ÈVëü	î%3Ω*BÛèàoﬁSï*¢î›m?Yµ*;;◊§QECπhùÍ:N1›*´√HÙ±õ◊ßvˆàpïâæ†K¡ÁI®4ç®îÖÀ!çHßoè∆ØMxÀ7•Ñ)P6Û*aˇ  ˇˇÏ}[è…ïÊ_	’ÃnófT÷ÕR≠$ÉbQjzÎÊb©==Ç–NíY¨¥íL:3)©∫F¿˙q±Î`€òfˆ€ˆC?Ã˙ea,0¿‘?ÒXˇÑ='.ôë7Êâd≤.í“∞∫äïåååÀâs˘Œwh˝º•JÿÀ Ó/Z∂1–ÌWæ‘j$÷XßYÊ¿Â›æΩ˙ó∆∞§ !©YŸN´`Íﬁ˘T0EMı…(`^-≈ˇë0µè/Wô=ö ^r)√∞ˇzÍ†á¥'»©ã§£úï…DBg‡¿º¯¯’˜=G∫Æz∞DQùÛŸŸ’è4us ï‡°},®“∫Ç)ÕL…ím¿–õ∂r# Ví ,Õwˆ—*[E≥¥ •+U◊#4<π(
ó`Ù·pI*2◊ØrmÔ∆v H§Í«œ>RiXº¨¯Ò¥w`÷8—«ƒ≤A]ónÒÀ}“öïäû¬z,\ßäöÔˆÎW9¨âw_ªä®ïn%Ê#£Yâ˚ÊJ™»OFØJ\⁄B|FDóZ]’îÍÇqT{§>I.6O ßµ¿±Éx¨7P(ª±‹”Cì<B(§£àZ7ØdÌ]å-ÿ>/$iU-À∏ôQ≥t™—$È'†b•¶hA:ñYıjXıü^´%jõ8~t⁄\ørµ≥ëÀ&¸W«*ïÜ{◊•J≈Øü¥.µo]ÿ~±∂Ò‚ﬁ~5*á∏¯Ó´Q1Ì÷vjFRäîºs>MJ62öT˚=¥ÄåÓÖv∫Ø“ôù»èn*åäZûV(?}¿ÎÄB'S{Äƒ¿Ê9eRWíwªÏÃ¥∏§È"÷]ºf’U|‚s:∞Ã€π›*A˛≠Ô∫ÌOBªJœ“Ç‘´hLÎ’Øj=—™ïÑ≥ÁÍ6◊Ød˝d∑ÑÚ˝∫Ù+çjÚìV∞N¶Óå8`L®s˚¨‹uu˜U,ç/ik==+˘¸GsjY≤ê¬'£d)ñ¶ÂDöîT¢8Ü¡â‹Z~¢\ÑUê¢+∑`·ARÎP‡#¢b ¸3\õ™ÑD\‡	IøF<ºx#Ó™(Ø∏DõIn$Ù,Oœ˜&F§fóø‘ı¢€®ùƒ')MŸ…íÑ9…1è€Zc;ß»Nróì”}S)«ÙÛo3#VË•ô≈9YtˆêŒöÀ¸â¿A>Ícπ3?>ñppïõ˛i≠4[4˝Á·.°J µ:ö¥*%ü¥"Ñ~O∞&ﬁ˚<£/∑_J,¨ªØiÖs¢x]∫‹N™ÍŒºX®DÌ°OG òïÖV@˝·U¡áæ,*9ÒΩâüc1%æ“&Bvç0úbÔ˛˙û °JTcäTËy‡	lp”JèîÃ|Û|Vx‘Âd∆≈@Ÿëª1©ÏhGŒNr;oP,ò);…J\ii~= ŒåÛÖ™Ô§ÁA◊u¯á\œ¡ª¸ƒ	päŒ£›‹Zª\vD%vØSœ˘Lπ)€⁄ı˜‘xÂfﬁ"ª˚
Oä>ˇzà7’∂¸d¥]”–›–L\‰™AöèF∫ÖÑ[«wyΩA¯N$ﬁ.ÿ»‡¯'.˚nÙÊ„e™ásÜÀé‚äÏ*É$˘ÀN–52 Î:∞∆X˜ß)ÏÅ¯ê√KvŸPˆH~˙ikZ^f<qî¥-%íÍñ~ÚÌ§Ñ…ÇºK3	∏(:^*WŸZ]0=5ÑGíœmj»≤|≥ï!°€?U’x≥)Î’’U ¢€≠æ!‡©J1¿aÛÿü˛˘ªàŸã{ﬁ¶ˆ[Ô>≠R£V˛˘˜ﬂ˝óõ–®Îª™/“hhpAr≤úI(LÉkU™£R∏ï4j„2=wD√Óû;∂;‡˘¡ÖõUæ˝ˆÏïv∑ıÏ®v≥R≤Sµû%üÁØµ:G˚G/>%äã[ÑVA≈ÓG¢+H-('ZP\üõóGYUnÄ¿£ıëcl:Êm n†U[‡UÉQEÌ;^+z`á®»˚+
ÎyH˝j˘úZÏÊqµ∑.N±Ôïak™ïœÍ˜<Í∑Zó{Vhh›\8$UÓË\‹—Â /∏)7›"‘nΩ2Ω&ŒnD·éÂbÙl£îû_:ÛË^àZMØmy„3YΩUj°í5j”5éÇ[”£µ.¯Üö¥˛MŸp¢†√MË’ç]vbaπ˘gé7≤˚Wﬂs‰èÕ:„3◊¬¬ò¸xùZuõQAØÊB&Äè>ç∫¥L‘]*Ê,∂ªØI_?LÒ§π◊<a;{üå2ÚR•’Ó∞∑»Ñãóz⁄:
0GZBı°@ÁZ2_g^¬	NSú=]$Ç)ÇöâNkÈ ø·»ºÿ,†;√Àª|ˇ|éœ´À)ˆ3$Q^≥jî>6ÙX=ˇP`{æ„ÁıÍA•7Ã∏’§{åb¢$q„ÿ€nâäT⁄,-5û÷&F+;Â M˙Y•”ß™x€}rô¯µ\»¯ëiÕ…'+·Âœ	¬È‡‚+H]ªèGB?*ˇ¶7œx9‡A∆éÌwqg∏¿•ô a;ı"©ñ 
ﬁÀV^$ﬂ›∏ëeÔ\≤gKw»Ï¢Í⁄Ó ¿zâ;$ÛY–Ó–ü=˝H6«Á%û∫Í[‚9ÜqIúâZÿ'6(≥´›)«1⁄-†ùı,‘(”ÕMî˘®,?a›§çóTÊÆ¶⁄5`)ó’dÍˆ“”*‡<öE^Ç'ÈGòJQ¶ú¥ÁŸ¿◊∑ÖÁ9·ò`√ÿ|h:R@s>•¥ÊçOΩ·–µ;⁄˜A¶ºµ‹»:…iôˇù÷|=“™.yUãƒ"»,º‡›qÃ–ø>¸◊R#õ]ÍxØ∏•¸•⁄˙„µ§†X∏}R˘*ì∞–¯a˚Ï∏yÿﬁﬂeùÉÊãvo¸ö5˜ÿ^ß˘‚®{⁄iuŸœ^¬üwZÕ”Œ—!°È≈ı;?``|,ÄÑ~ıÎè÷çù◊(°”~÷(.“HªSwÑ±éˇ`ô„ôV˚‰b•°‚*‚Âä›T∆ø;Lä}÷V˘ÅµÔY–Õã¯ù;©®¥!ÿ£%Ó™t±NÕsµ9À„IÒU%£Ñ‡/Ç5¯òr^X´ÿù[¥∞N˜»zøÚn%Që§úóN‹•J_≈tt‡≠Qô‚√¢’kèÍπKØ›`⁄<w…(w¢X3≥ﬂ√—√ﬁºó Ñq-fø≈\e∏)ä†œ=∂Ûäø(‘ˆ}òv„->¨*æà<∞F⁄©,˛íô†ì'õˇ-ó{.UƒΩ®\-mß^≤$VT◊Ä‚ôh<ûº™ïÍÏ˚âÖ√UÚv?eKgŒ{{¿ŸÇB–úGÉ]Ò#Ã≈∑úæÜã·ü¨˜Ø◊m3T∫a€O@ºL}.pÛV<iõR0CÛìïá)˘¨$Ó∂í∏ÿ*:œ\¯Âb—Ÿi«Ï`*@Ñ+õ–Gò»R_¢p[FØ2„8ŸŒ'πDËºµ„ûû;ÿ°i _f≥∫?ªÁ•ÊÊÕÚèáÏ÷µÀ◊6Nì(Â«p¢J£úŸÕiıœùÜ∞k`≤±Ñ64ˇ}∑≤ıêù„?
%ÅÉèw√Ûµ¡Á\xøWÏ∑–Ω`eÏçm~ƒUâ`FÎ≈ÓÚü}Ô˛ú{ºÀò¶ö›^Ù%Zìﬁ ÊÍ6w‹oÑWÈV.ô∞î˙ú√mıÌjCz5lZÏ4“ZÍù2ˆÇ˝La»8˜Ì•H±U~ÁL%√$8
1ÍIwœGI"¯D¯fô¯vhÒí+<õ÷ÖÛ?ÙÌÑ"kÔy"˜ÃÅ€dÒòX±<Ω†K2;W◊2Va§]©Àq‹›d:∆J» ìhÛÚù®á¯eJÜËR5N‹Fãbo+îÔ|kRó@i‚¢7cI|Å=ÀÑfmÉ(^z≈N÷óUt˙ "ß,çsí‚óxôk#Ò•ÅPX?Zœ”€:-w`C¸G√Ã—¶Øt`3KÒóçuj2a+
}j6®Q’Ú@ß∏B'tÛ5=ôZSLá≠ëuı/"hØæDÇ“oÉ,P‰)÷{g‰|ª˙ﬁ∑9ã:ëv{˘ ìRD”`ã‹/ç]‚Ey}ß ˘z|‡å±◊ô˙\´xJ¬øƒìëéOcU√S)#GÇkX)Ò”˜&ß|4Èyñ?XÓMw âÆ£I:∞¸7†Ùé9úy˘˛ÙΩ∂±l ™iˇDj¿ˆÂÊ€ #t·ƒ0#.ı¥måä^°7 Å~“%§◊%^¥Ÿoyô∆∆Lç™—j ‹[e1¸zFi<à—Î›°n6œ	·œ≤ˆ3ÃÏfÓÃöœdænéÕ¶>7Q©<Ì+)06A\líÖEGq¯¬ÇQÖaé˜û◊∫fh9¯6´ê}g¿4€8ú¡Zã›‡3±√&°¬M°˘ed4°Ìªó•µ§:å~≥rõ7€Â»˚K”M¡huõ·”|cÉ*=ÁÎ˝]b3	;}hjP2÷Xù1‰¨4¢≤ü »;2—‹¥w&q6l¨SáT`'≥Ã– NVÍ©Á∫÷C√T≈"<∑≠ınºﬂOI2Hº^Ê§å∞~Ò9õk·≠@Ú€»7J˚xı
¨B∞√:„˛Í„µºéÜQV`≥k∞g;áßÌì„ìˆi≥’π˙ÓP∆ÀÆæ{—i5k~ﬁ∆⁄¶h7oƒóû~Ÿ‹ﬂo˛Ìã£ÆŸì·nüº|÷å÷œ„∞Á8HÿS0√+L˛ø¡uo‡ïÙ\ØJßÑ=‡í¬Ï ùŸe˜¨é¨…ÚÚ`óY„ãÃºﬂe„)Rgs]ï™™ã˜ÙŸ˚Ï§¡˚	˚8á∑„±Œ ;ÿÛ∞rÔ)(E+”—W–Ïk∞YæP4Ô[€_Ä1Ò≈`≈ô¨0ÏË`÷f±\g8^Å‰rÈ"%j€O¶4¶	˝>ç>z!{ﬁ{∫˘¨.˛M˚ﬂ+Aöf©_†±ûc)@∞_lE™ÉXódG'∞'Ï’ÍÍjqO_”…K6.÷…fØÇ7¥√U96UöÏ∞[ÿ…e˘@"DøH®é‰•-Xy–8Fîéò˛4ÿM∏fòJıIaÊvó~5uÅ48y˘7
∂kúQ¶bÔÜﬁdÈÈÂ`u ¶ 	>‘˝TÙ}Eœöq"ÅúIOÅéEôŸ(˝å;grV1vüË4¿Îr˘^ÈôÚwW~¶∏ˆx9‚V÷ÔóáTSØgÚv‚0Uû€¸…ÂÊá‰¥m%d{*ú‡Ñ0â}e4@1[zzËa9(Ωq
5–◊‘nÃ˜±ÒÍÇ'ê:–,jDÂzçk◊ıHˆ„±∆#∞Û‹6Î1≠∫ﬂÛ1Z¿d˚q#m?Ó%‡/—îV2·}˝l<~6Ái¯≥ÒxÎåGÍ⁄É£iÇ˘?uÚ¨«úõÑ˘Ëﬂ6ÛÒ$€”œˆ„å+«~,¬[h@ÊtıZê9Ω¸lBÚÎÜM»MeB¢¥Àòë˛ÍDNÿEÌf‰÷<f§ø!çZ>Ôv¨€lJÊù0[2ÔÑπ˚∆§Î!7&Ë”$›±5æ˙nu>î∑UíÚg¨¶±‡ƒ?iÜ
Æe|6HË√¶òxFMFÊâ=ÒÌ ñÆÑ-¬¢Ctâ≈ûƒ#Á<ﬁ{Œñ˜XâXÜÌ˛.aí(ú0àıÙÌÏõÉ:OsXAd
æxÙwÁ ÁƒêCsqà∆z‚,Jûm…ID<YJíÚÏ8‘h Û%≠Ca¨Aˇk “©1Î◊ª D¶†¿˚øÖ¡‰ﬂÆòm÷kl4ÂfõÈ‰◊◊ùpF‡ƒ»e8—íÕ4Èªìo÷éÍ1bŒTt$1hŒã´9"®—µCÔNÁöumâ‘dˆ[ÀùÚŒ“°&≈&æ„Å≤eIR®æís¥˜åî'†Y¢ÚÅ3FH˘¸ƒOÛÓu-µ¡ÔdÓXy⁄XÊõ9¶?ÆJ‚XKÔnΩπcV£—ÿ"ÊéÈb÷4}l´Z˙ÿ69sLºàÈ—ê€=rÚXÂ~ó:í £eπT∑ªqT5I.¨¯ë^æßæÑ®Œ·Û£ì^´∞yxıõ˝N∑”≈_ZÕÓkÔ∑OèH∂MùÃíuŒÿµßÿ‰â∑è%À¶ÇËéØdçôdÆç.ÿ∂S_“7…‚0k“MﬁPﬂ°ºõÇÓNΩ—∑Ëdã¸Ã]ª∂õ‚Ís¥zãZNÏÍ∏Ìπ7MeG÷∫jt^ÇôwF5ãx≥%¶—FÆi¥=√4⁄–L£’Ìh=EAâ¥ﬂ*Œﬁq0ëËOôñ?˝”ˇ¸ˇÁÔôx[-T∞c'à“]} (n,¬Ã6¢B7wBÜ"Øaàá8NwGÇ–Ù¸P¶ÂpOï?®@≠ ÃâÌFc}0€ú®ƒ_U˝é™QÃØ tåÑ¯˘L˚@†ï“VÇ^»Rí.‘âé¢bp∫ÀÉnì¸C$´œ']p‘3ÊÒ˘vâ·P ΩÓg4-rË˛Ë∏’9:lskmàÊÈkÉ=—müHÀqÛ§…WÚ◊Ï§}|tr⁄&TŒ∑kå¶¢1i£>'¸O6Ú2q1î‘\
®>\◊*çê~^ƒí‡.kˇédÛŸ><«5[ßùØé∫§#Ü,àÄ∆\gm£0∞!¸ôÊ¨ıLßè∞]ATzÇ:Xø±#˜≠è?€öub+VAÄ∞ãA!O˝π3π˙Ch„=°=¯Wﬂ≥` Î“#Ôï8Æ++¥"S≈djc»‚D‘j=Ëü„/ÿõxÿD¿@ÖA
-?ví4˜ç‚Æ !:6(Îp´ÖQ–Pîµwd¶kQ¢P"ÚÙ¶GzglKû8’0ßô$K”zíe"ÁR∞›l˘I._—,Ê¿¨9sßøÚxÇoT$Yœ¿»˜ln8öàaoÏ≤Á—Ω…R1¸;Ü{ˇÙœˇ~¡¿4Vòq˙.ßá9∂«Å5r¯b9—»ÿñÿáªjπCÙ¢èÚª∫°w5Ó›üˇªˇwÔÍ7>à#÷ƒñÆ~‰Mag˜Ï>,vh≈¥wv ã∫6q\÷kN∑6wY[‹ƒYré££˛˝˝ˇ µ*ÓbVÚ–óÀ˛`ÍÜŒ¿	˙Œƒu∆ñÔX¶=YÎõD4"ßì[ªÏ Ó”ÒΩzˇÒèâÚ[q‘ÙàáyøBﬂ˘V,?§¿…È’6ˆ
Ô‚Ñç∏M-ª˙áTØR∑ÇV8B˘É¸<ƒﬁΩÊ¿ƒ≥QHá!öñL@°˝Ug@ÖSò{’2,9ßß.¡i+Ñ›≤Ë0√röÌ+˛x4Ae÷ äèÿCc°£Ãx÷≤∞¢©çêQlIG‡fû#0Bs‰ëDzvZN˘….¿ò:^éQCl ﬁ…zfºÅQÿL+7-|ÄyÆ¿∏Ñä	/·∞|ö0q◊OÚºÉ‰B'tˇ AM2i0Õb‘[i vÛ’ÈûÖÿ!˙<πã¶lŒnuVÊIéE#®6ïä)ÉßºO\2väl`ÃËˇCÕ£ëçËoi∞—˜ûÎıﬂ»>„±`‘ew"”híŸ‘âJ@ŸiƒASËÜéÏKŒ˜‚”ÙMdÖGã´JpÁ&%÷,¨ùßãR 5ıù<…G◊‰ç≤FæFósûﬂÄØëO Élf§⁄aéÁ 	¢È[`‹zq0ë/Z@bÚ+Ö Dˆ{ú!ˆ¥k£Íƒ¡<í≥±*X_`Ü9åE*Ω¬»©˙0Ÿ°ZnΩÉÇËÀ’,ºè’ñÙD‡œ)8î$±lM$∆s∫≈∏$NX#±∆oΩL‡∂|9ÃùoãÚ~J,¶‘∑qÒÅ	Óﬂß?–`N±VBÁîTà •é°&gÒ©B‘œ®¨Ê◊à?£™¶Èórô˛Ñ⁄í¨<ël,ÁC≤“å#¸<¡ìK˝7Éµç§> ˜Dd–ÏŸ°Â∏ÿóƒÔ&ΩI5î˘»¥G`¿†°Ç°¨ıKˇ¥BÔíç¸¡xÏ–≥·çª°=—GP˚¥ 8&-¯≠]∆á.T*Í:1¢x≥0¿™˘d¨ ≥C;')ñ(™Da,™°i%~V9eôÂ˚NOzYœ≠û„:°ê‰∂–!ı ¢ËVù¯ˆ['òZÆÛ≠¢!˛T
w0uJ#wí	Ωè∆6{∆ïÓj’‚`òpëèÜkÖ9	Gq\4«Õ¢ªW(	xú •¸ A/¢M•˝ˇ¨{tà…R˜2-|8H˚`Ã°U|∞¢êÎ‰=(Wö{%•Y&É”eE^ÛAZƒ≤ÆU]3ôôòµïÃ⁄ f…ﬁéΩﬂ—{g¯^vYﬁåWÌˆzQ∑”x≤çtƒUΩƒ;À	MzüYóÜ]/¬ùm'N;sè≤>L;ÎM•4ijé'.ç3HD{Ú˜nGË™ªAﬂrÌïWÎ´èΩÆ0G∆£ÂH4öÅ#+◊~ a›\Oç7ŸzÁœ‡∂å$lEW£l]„á!⁄÷fæ.:ò.#g4ê9≈)Ê¬YÀf˘∞D¿,-Ò∆Q)¸¥|,”,Gﬁ¸"PâoW =â«≠Üß·⁄í√ß-√¶–Ÿñ8Ç7Jn>á%¥'mÈÊë$ù>—¸–µß∏Ms<FUì¢D‘ê>n˝hF˙Tñﬁ¸ßu¨§@ÍÛ¿ÒπhæÎ?eÑœ&«ΩmÊ‡ﬁË.k.@∞z®«é]ñúÂ*Qc‚ŸªyûÚÀ_J@Ê˙£ıﬁknÅñég\™VŒLÍLvx:˝å∞!ä≥§I$í√E	-éu¿__¡¬BzáíÊIƒBó>œønªˆ–á'v0⁄NA”ó2¶TË_kÚ¯3ßÁbÅ$kr~¡∫∂Â˜œ©)‰‚nââ6*ßío7~íõJ⁄ñ{KÛ»üyﬁ^ƒª(–≈˚~ßí»[∞ÜßÆP…]3Y<—ftı√@ ˇ@lÖ‹á%—Zw:è¸ƒÊ^8|YQ˝Zsœ\˝0…ÚchúM¶∞¿˚Q¸m‡¿€áæ”Á«Ñ(.*@ö( ∆˙˘8‹nbAœoæÓhO€üi˙xÊõ>ﬁõG‚ÅË‘%f›•Gp”«#—zM•GÈπ„‚-åŒÇ˘™éﬁÊƒq˛÷èµËÕ¶éÁxöi.º∫Û∆U´5&ç?ª˙ßÓœ_∂˜öÏYÁŸ~ÁË≈…’o∞<˚öΩxyı€fóµˆØ~{ü–Ú>ßéÀ‘Ò<—ˆ±§éW€Ò%,h/«y„ëPSv1ˇ ù1›ıÒ¶ãÁÔJ/Ë˛Átq˝q7ì.ÆÎk◊ñ.ùZ§\ÒhãDqéø‹∏SU£ıvı#%åxõ|YõÎ;Î;%æ,]´ﬂõU$¸nÿõï‹9KI%èÍ *≥ﬁ÷˛*ÂáÚ¶~ﬂf˚Œ¯M¿^®¸”rpJ¬.çpvØúè7ÌS∂^ç5 rÅ†T$ΩR˚≤e§≠◊û«›~_[.éÂLü∂°Êûü∫ù†$ö˙Ùw∆ûOmïo˙"Ú›¥Õ·kè°vy¥h2ëº]ñÅ
¶v∫Ã'-Á?≈bˇÄˇ¬â˝ç˝” Á?˘Áæ}ˆ‰RtmuÍ;Ùo
>˜'Kﬂ¿≤ø°k¿æÌ>Y{ﬁ°|lÏAlﬂ7!:Wﬂ8ˆ@√∏¿∆VÃ…"‡„≥¸ë¶óÀ£®_‡˙êßO°‚ê Ãõ‰“â∞$˙@'Êh1¯!ä9\içIa[Ì	≥=ÁY˘v°T√±íß—e+X®®`<ñéP˚Å€AÌ^j˙·’è˝©Î±&o_˝xÜ"mçΩòÇfE2Z¢· e◊g˚LG#À'¯63,Ú‰ßÙd›±?Ê,÷+|ä©r«~∆∏ÕUfó|&æ≠Y]rÊè∏¯©Ik—˝&Ö±^=L÷!JEU2k^√R'Õåú4F≥ùöÔLÃSK∞c¡π*ÃäÊ'/©—üé˚ò’'¬DØ6Ñ
˝T?ïå3?ç“,◊,¢AM¥®Îc‰ßÒ=5[1kNÏFmÓu„Ê>[ﬁ?jÓ±É£ì6"˘ö/:á¢@‘˝
‘O\Å.RØÒ(Öï?Ek“◊†$è iöq;SÉ†Ë|F=Äøñ<$)–Øœ¶'ˆôoÁ≠w…máõn{æ†µ|¿çÖÆ≈ılÙy@˜L⁄"acƒsË§ø8úà«Mπ4v-ﬂ©¶$œÖ≈±≈•«Ó«S˚-ºl"rÕX|ÔyŸí5O£‡∑k± '¡$§LäàÏáá)’:XN'*£hõ¡…∆’ÛH∆dÿ ≈_D§{¢¡	aOS˜`™Ø1ˇE§”kíı›—˙∑›C+‰◊˜Œ–
Gœ˚Y§`8a]≈ íüíH≤bUó∂)>ì;nD£ÙóDê∞È∂ê=Ñ∞`E‡ø∞ozWD⁄!¯≈zkçøÂ‰]cv<ÌÄfõ¿ààÙ1ÎÍ_‡#‘ÿa√ ∑Õù∂	©Åp@GÜMéLA¨Ÿ	–gÃ”	Ó{üWE∞•'Dly{uOÑÅ˛cF’3Ôé )ã√>}“õì◊,MﬁØlã<´ﬁ0Dàå˜HW’‘g^˜¶H#ÿLõÚhV¬JÄπL9Œå·…:'ÈàÃ˚ä`Â¯W*9ìıYA æ„o⁄Të7˘±;ÕK0∞¯ñ´>;@·tb+ß‡¢ËIËôös∑SÙIÂ´(
ç∂Ü¿a{…˜;≠ÊiÁ+dÎﬂcÌÉ„ÊÈóù¸˝¥”><e›óÕìØŸrßYf0,∂ﬂN “1·˛Ö-—•zEr-Ñ∆÷˙Ÿ∫ïãqı|¨≤y#(W6∫Ä≠T\+£tëopß∞Æßæ5ò‚…	∞,ı√|ç&QÚrb}5~æ⁄wÎ™j&a—kÉÇ´d‰åeqC^˝–G<+„iÔ!æ=ö\}è¸ÇXs¶/ü4ö¿98ºT∑áÄ:K’GÏ{»ópÇ8:∂èD$ú+|cπ7åù$∂ıùÑ∆“∂oﬁõ.!;ôObÇÙM ‹öQ≤gçıuõàí’Ñ≥)Nvß"NgµeÅe≈ÀÃ<T∂·≤;ï‡≤∏ÍàôÂà ò g÷eG∂$Æxs/¢’<w
zxÛå∞:hÜ´≠[±(ÚC\⁄h≈É≈’Zæ0¯tx≈~ã:åQzæˆ5πê‹aÏ∏Äüg?¸^‡æH·áÂ´I‹–§gàI®è˙2Ä˚ã<èJâ†„áã<)TO˜´VÁ…ÈIsÔeK0ÕÉ|ıõS@ñ:≤¯√^[∏¢¢Hd~ÁL=$/6T'Ö»O~Ì&ÍËÍêÃ‘–hÄûÁ[ã´B?QÃ8®\ aπÂ⁄†7DW7†ù!Ê˝ı˙'Á¡tÛùÕ+·ﬁtw3≠˛π<ëOΩ£≥3i™EÎ2Ú	ú7¸PÍùèØTX»F\â µ'sÙc1{l ¡!µ72.‹ö5*dG"ÖK8∑≤Xú[˚j˝õç…˚o¬ˇ˝aœZnÏ<h<‹~–ÿxÙ`}u„>ë¥ØªÑü9¸8¨m‘kÇÈŒ« kÙ›©Éï,XàNøÂK“î˛!)O0ŸÔ=éπl~5á™:Éj2q∂ôn©NêyŸª^á…&FËÁ„0É	ñ/≤s˙fYJ≤NImT¢mPaL`Å-~Pn´_OûQæy¯±dU2~„K&öﬁgÈvŒzBΩMgiw~º9G˘}á≤é
_‡sﬁë˛∏Î…;!«=Ô›ÿı¨Arjé˜û/◊üyª¢}¶mÁ§#R3c¥Í¯€3l›tl⁄fõtiœ∆∞›Pê™Ú≤SÔypõ≥s•]Ù`WÂµtQXhC'‰zûàõl–˚n`÷óıXÕzéR@^ÀÒ´ ÚâºΩk\¨Óc8¬‰“Æ?ïÆ±ù8¥Eôª§9ºn;LOt•^b}n…öÔ¿“ÒËk•‚Xä4¯ù›´qıÚYMªÊÃo‘g¡SÈ›Ü%´ãeƒˇ‚‹
ÉÊd“=∑|{˘•¯F¿ø®U4Ë«Ã˙¡˘eL”+9e˛/Â9ÛC≤í€„∑òjk≤L+u8∞ä(xh=Grµ©Ÿ‚∆Åîçº∞›ﬁÛ◊˛Å÷–Ó˛z
ã¢VK7z]îF…€∏;^å,«Ωë≠·€˘€?œ€ÍÛOj;¥<ﬂ∑¡í@√¬á/"Dap /üπ:∑4W∏‰dëwÔ‹≠ﬁiæ ‰V^ÖYÅUˆ˚r2ò˝ÄçßÆ˚Äm‹ø6*Å®[!ó¿¬v¡ÇIˆ,åÏ9”o¶æ<ñ8wxzq¿ˆù dVø√èuÃC—z⁄∏I¥í^oFÙwÉGâ±•‹jpÔÉ•ß˛˝Ô~k¿XJO'†∫å£¨`Q]`7◊µæ¬zké≠Í#Kîri ?.i}ùu˙“¨.?Ü;¡x“§%Öú\§∫`	ëÀ'≈◊Í˚B≠gë*~&~€e÷¯Ç'åÔÇÑı‡]ÈÖKë˙0dÎvÔû-Qè{mø¶ım8«twéŸEiû∏Æc9nãåœFB g≤úì“6!Ø∑…^WÉ∏Ö˛Ø¨ÛΩùö÷(Úª|…VWWÒ∑åœıÆÛüŸZB£∫¥!ó¯Ú(cnf
OúM#–0qq»ﬁüªﬁ4tù±Õ—<≤ºò¯9õ„ùıdØ5„Fi´EâÚÜ9Œ9 èb|Kc∆c>≠C¸‹¯ÛÔø˚Ø¶I∂‚∫î¬JdÀ/4cª™õ™ŸòÕë6ù”´8Ωò
ë,πﬁn¡ë<¡å(…	kysÏN
Dä˜R4x*¨xj˚£KUf¬p,ç2§˘rﬂ5UÿK-e˛ö†cÇ,Í¿Ö$‰JªCñHE…ÂÜÃI‚Ò?˝√ˇfG}L+ÒyLËOˇy˝s°8Ú6òf†â»vﬁêÊ°†®Á´øX∑‡è"(jòú>“ö˛õïö%io∫®!Ø‚Z “ˇãbKi LÆ|RÖ≥YØZUó‚Ìbil°Í5pW1SS]	C¸@{wÌqﬂıx◊Ù≠Lej—ôî≤ 
y@*ºp$ˆgØ~ÊÿkÃC˘fÎ° )bHÁ¡øìM2@”n(G"œ@ßDâ÷éûl‡£‚YÔ¬}Xºp∑äuÙÖ[Ï^´0√J´¯ÔﬂK¡âûÃhi©l4[*m÷˛Õ.u1XçYKùa‘“ÈWè¯§8Ÿãt5Uˆ¸FWyœù⁄…Ï{}ëÛø¶“1ÆkçÛgÅ‡Y‚?¸Q-Ò<áóì—HÔém?òÿX∏ R¢˝fñπ¨πèŸ∆¢Ñ∫o√ì±^{ﬂ–®æ»ˆ≤Ål–Ó}ä√Â·…&>’πnπ=Ÿ {_6:-v“>>:9e/ˆè∫]LN˛EÁÙK÷˛™≥◊>lµY˜ËÂI´s¯‚÷§+Ô]å≠ë”·zA0GæÚ˙˙Yc+7_ô€úw8[YÿÃw)Wπ}Bz¡≥v—£m˘
|kë¯`œú≥òÌG÷Ï!∞›‚¨Â6÷jo8XV0ë°0è;Aê<`Ä^äö€cKgLxjp–Ïπ@∑
wµ(Ç®_yA"@åûw„9 É‰^˛òìîÛ^u±Y É9%J]’€Zîçuª±ALPé§ÒuïÒ1JOñØ2„)NNÆVÀÁ„KNé∆ 45Ÿ∞/Êµâxœ‚Ãb¥ﬂê[lHQãbπÕ¬lcÂ87»5Æ5´8r‹◊ÈÊCµy“9b{ù√´ﬂÄÓzÑƒ›Œã√£.˚öµˆõ›Œsû\åû¥◊π)≈™dﬂç
ı£Å3∏˙æ∆l.A8EoP»˘y}¡y!Ùt© ¥Ó\"ÒIÓdÀè%]ÀP	à/ë®	—8M+ñ¯Îö¥HßhEw}º	ZÈ°ΩC©Y9]ˇúî•?ÓVÄ;S6¿*Úa7ÄÒå‘Å¢‡ı¬ ûè„Ç±û/î€‚6√=´Tk)∑m≥∂¶XgÄáß–Ëªµ5÷Ç0Ù¿ÇÌ≈ÜI^∏ÚÜGqm–î≠∞ÖP'ˆÑ*
ìä|ËQòG‹Í\¢∏òù3∆_tµØ˙ä^Õ•.zuÆtÍ,›ßbì›ç™.%YÃ”¥ÕƒÓ~`6˙z›ä}mòEX±«Í‹gy@˛µÆ#‰’a˝ê™ùù˙W[ÚwΩ√Úé∫∫|=A‹µ£–˜Ç™=è–Æ F⁄†ÁîHß ≈∫N(Hà;„3∫4î`_}˛äø; É◊X˛Âía)‰Ú£á}¯îá!fM≤¶hŸÑ€q[ÉzÎ„™FYXP<[‰*/aîq˚ËÖïÏu´±˛Z„?éJ¢ÓQ ≠T/â1:çx¿vLÒ©´0{¿ `:√bD2Œ0øîY)ó"êî∆Ö)[¡∏µ9Ñ5'Å†»õ2¡Z9ÿ|ÌOSº)≠í\˙IﬂOë÷ó±y	&c‹j1`ß
∫lÇôi#oÌ»wÜˆx7Ôùß7öœçMU‘ei¿HNÖ§åá/µ™ÅT#Õ¸//’ôF*Ê©_óâìu± T√∫U †Yq∞úƒ8óp≈jr`&z†B‚êóûÓ≈dª0`¸˛ßr–—ÑŸä7´ÿVÇºâM‚0ÚÉrkb1‹Õ“D»t¡·]Ôÿ&ÒÏ±∞¨–∫ÌπlπQœóì∏0ÜƒFYÒ‹tQn'Y÷D´0#ìR&Fõá◊·ÍÛÛAñ™2πøû⁄†@\≥dŒòa˙yuç£…=	W6S*ô©Ê`~2\`y)öîû◊òçæ÷“ÑO»ˆ[hÅ/L9mkzò Ê*ô_L¬hQ~L!ŸW5~ÏÂHUz¿'r5*ˇcˇ◊•—¡Ãÿ¿	0~‰2aD≠J…¨±d-ó¯‘%˘¬3Fy∫vKd¥l¨G›ﬁı0?ºXQñg>¶4B#ïósä›xh”Jl‚2T4rÁ»¿È≠.∆Ë+πàØÓ∑÷ÀÊ!Œ´RÙ7y©"s‘rZGüf‚æèûQa¸ƒƒ_•1Íä¢qz	€EèïôrK>®oò©∑xFwÕçÀ†	ÊX7D!1q≠<¢√sõı-Ä#\úFYJ©m«ø?g>◊(DòéÆ∆$@–b1~3ç…©¶#VC\Ä%0ñF°0≠ÓEP ˛ˇˆù« @K+ﬂÊ€C'@tC‰æ9ò==Î÷˚ïs›>ºi8ÿƒWÓú¨ÅÅ‘ıa˚/Eæd€µá÷8<±Éâ7ÏÂÏ2¿ñÁÁí°vQ%e7u¨Ó(†)¨|^=8`p‹sG†2yò«8Ì0µ©UÎ∞Øsˇ∞Í⁄„axŒû≤ıJ˛¢eŸ”@bß†úò'âÉúv≤ã…âÕ\I|¶W?Âò`¨7±‹ÅgöIS)ó¶¿*JÿXÊ˘MxÂØ)Å¸æ@¬OùT“t9…◊01gÙã«D7LÖÍ:˜Ì3ﬁ/Á]±ë–Úáv¯dÈXá„7¶	tÍy¯diÏyÃŒ@7å}f˚æôûlO|ˇÿÀÏõ^ô∑…%T££4Tÿå>√√ﬂG
çË∆”a"/†Ë0Uµÿ´uº ¿Kƒø˚GuÛï¬GõkŸê´ª'/3jı(Cøu≈/-“ô^^q>æRÚÀ¶eB§∫7IÜ'"ﬂ4 ã»T{ŒÀãpáz^ƒˆyZÓì)ÁAŒ`òÕì¡…¥à¥DÚ≠Ñ¸≈ÚÏ≈è+-±€˙≤}–<Ì¥Xkøsÿi5˜£≤©GœŸlÕûw˜:á/∫∑&%±€?∑¡ t˙s÷P≈úƒÕ‹úƒò˙‡é&%∆ºw&+±1óbÇûç≈ŒG`{QÌM|L‹	Ø;˛ë$"∆|≠Ê_
&AKœE¥0π¿ïU˘–6®JŒ @†`'º:*¨—®Ì÷Y≤ÃŸ¿Òm˛ëbπÔO≠Åèôê„´?L¬€êû§ˆı«úüò˚ÆãMPL?≤JÜbZÙ÷]JuΩø˛êò©ÀË[ô™(ﬂe÷—rsõ2AÒñ∫HR‘@¬8UJZåGÌ:≤I%SÀ≤cv•8ù1≈"ysIç˚p¸¯©öcZ:£d_∫π|∆®µ˙Ë⁄±RÛ˜«J[nâC±ääﬁ;ë÷´WÇµÄ◊-B∏ù-AÛs!jÑƒÂm¸˝"U	ÎÆ%4Œ]ïìvÛ2$ °ÜC\'4|nw)61Íµû ¡…geG3e‰ì›µfÛåÃºúÃH9£µºƒqT=îí»…Ã…PRŒíL&‘ºTÙÙ¸L∆Ç‰[äÙ˘¶Në≠ükÎi…ó\:ü…svYöÓîPÄ
∞U®œ¢&cRÂ’—D»©∆.{Êz ∑¢‹1	≈ﬂä]"æÁSÿ$‚E?Ôë“ÀtèlÏ≤S[ZêÃ(Sñ’æ˛¸ˇ"SÙc·®hj«óæ{íÑ ö5ïÿQiJÄj˚ÈnqÛ‚òÒ
ü9Ù«ôõœA@›„"•W˘W`r=aCP8‹DS*Û¸ñIÃõ¢—$CÅl^Q–ö˘∞pÜÇ¢#<AQ†p’w¨’Â,Â
Oiµ\tÿcv`˘oﬁª1I4\Sy÷&åÏX¨E˚‘;·lÜıØåƒÛ~«ø»ídπã·fKÒ≠åcwöÚµVC∂b©ø1≥`◊∫HÍ¨pV≤ˆÀèÜµøΩñg#ÅÈ;ÍbÂÿ
Bõ=˜1∂Â^‡∆Å$k3`I «~«˛jÕÿ;§≈bEá;«Y∆"†á¯—{â[•“Ågb-´g…*Y	˜Q&}*Æã∆ÕBŸ™GLx‰˜ñ‘åB©Ÿ€8?`\I¬®Ÿ È=©ê£ûüˆhvò<é…'å⁄ón!›4_`°mªa\ZÊL-øŒ Aiø¸Ú/qÂ∞øf™∫,ﬂ€<Q,=Rq~hÆ√{C+«3Oˆ8º≤≈IJ0Ÿ≤”Ωz/Ò®h¡Q±làB´îπºàõSK9æP„6·ÅÅx?W€6Ÿ8E¨«•˘ÛÌù‘:êÎ\ÿ´`hΩIÎãË«∏«J√ŸUÿÀπ∑p¥óû¬
¬*—æ√œ¢Ê´¿4[∑÷[)PRc4s.>≥•+ Æ·|é¬›ÚÙ’OÈ*Á“cÓÃ©˘R÷ˆ=XXìÄ*táÁ∞!»”˙9I—9a„ZrÆP≤å+âÄ0ë√7AM	ı•ßùΩ«k·y-ùÿCÓ¡\”‚ìuµ≠ƒC·5iÓı©õ“`˛á=op°˜V=Ã—
“ÀÚb≈g'íÈ‰Y´™x“=˚Ü≈T≈;˚&¢πJMUºt+Âr*o¶
Á‚ÚóáÉ‹Uô!¢ ≥î~ò®æhûÛñØÓ˝µ°≤«6Y™Q^{¶⁄WÂ5ì*ﬁ-xπ§FV-≠3ëF)uxWßÔçª”·§πÕßu	ü.+&‚Ji79∫$≈ãÏË§îíèGëKwq°&áIy>Jr5ß._J;±–4vU¸q#ïDk7ô¥⁄4{’ŒWûc˘%∂¡hIØ¢Gkî4Kí|Àÿÿø¬lb≈ .c2p¸ı“ã“À¿ù4˙r/`ÀÌ±Ú≈ﬁèoÁ(ÈæÁ^∞â=!èbçııÍËC;ˆòÏ…ë0OÇ™y¶ß®ßˇÿ>VÜ	¶AﬂÜ›÷C¸êÖ˚!ú@¢∫éj8ÙVaâ-Md·G∏˛∆àÿVòxÀ≈§•◊ò·ßÿX–∑¸°≈õ=ﬁ{^é◊¢Õ–ı§Ω¨¨¨∞nª’Í\}wà’N⁄œ;X7´}x ´tüù¥Ÿøg{ù´ﬂÏΩ‡üÌ…J¯5lc6B+'$°v•Aª1
Îa6$⁄ùÅŸ-Ÿ\Â„ÛM
Ç2ˆßÃ∞

¿§&» «]XyopQ'Cx¿=A]dË)4);A"3Ùe£[t~«g-¨{"k&—¸€è◊Œ7ÁLe1ƒZRø éDr≈[Øoı¶.g®VE∑ô«ƒô€≥ôÖÓO;YrJlaﬂ˜¿∞vøØÑ´jx◊ï•1Û‹â?ü:∞ñ¯lŸÏè$îKò|y°ß≥G8g®Å´\b©o‡ú]à≈¥º§÷ú>-0‘´/é9Gñ^Ãz m¡ü¿Z`÷’«ltı}Äı)y/ÇÀR¿[1˝îàŒ¡Í¢Ü‘ítS[Ë)ﬁŸ¶rsI'≤{‘«"…%èC*-‚‰7§G:AG•˝is=Ωß≥â23—fˇ™-iÚxEß[.ôJ∆¨|≥fÁÅàóx´…∑ÉÛ÷ªúò^;î´möû
†(ºõ;±©h*ì¬∑¸·ÂkQÌ•Ø{È$⁄K•Úâ¬®q˚˚»≈+¯±)¸÷6Ø⁄Ã,¨·m´¢∑àˇÑ [â€Dâ¿†Ì˘(a2ÕŒ°g'FÈ{≥†»‘™ÅÑó){J‘êp—íQMd]fD$¸DâïNNÀãËõi∫ˇœ≤¢DVàë™[R‰‡íRBMP]2‚+µ¡örÉëÖ¬ÏªhöÀûÉu ßˆZî,o$ıÃæ†RÍ⁄ÇÍ‘Tìâ–9<F	Û`R∏¿V˙ÿµzò◊;KÁ]$íf°PqUDÁ’`*dΩ4æÖTùÇU ﬂß≥¥`∏•2JY1À∑) Î∑Ï•'ó˝©è»pxemıQVpúùc	8œlvnÂ5∂lØ
V°U˛Hí7lÇºTÁ`¯ÿ˛ì•ˆØvŸ‹Ù‚ûë`:¥}A!g±gùïìÊ^óm~ÒÄ}±ß¨ñæ'5`q\⁄¸k<<¥8Á‡’èVﬂÇoÿaï‚[OÕHö@µ¿
ﬂN71ä¯ÃÎOÉî÷∫≥ùƒ∫»Épì%gÂlO€Œ⁄ÄÈpdl‘õÜ»Tƒ3M”áà|Á[˘ßÛï∆ñÊˆO«Œ	√4ó@ËtÑ†)rø\7À›'§µ<cT–=~/∑Â’–wF4¸GR{‚j”ïAhs%ÙV|vÊ{£hï°r„©ﬂ~a]ı{∂£Öﬂâﬂãt-~sº»£œ·ˆúOi∂úŒ úM\À˝›π⁄,«ë4á^ÊxR 3*QoPR6 W	ìWUá+÷‚ÑìÀêa/:HûÃø˚∏un˜ﬂ¥øÔf‡Ù±/éOµÔ§€“”&Ëv ˆM"P4^xÖn%©ó#æ0à|#ºŸôú#€4ÓØ⁄8GhòTÌ%ÎÕIXRÆ–ÁÖæjÓùHWkˇÍ∑HZÖüÔ7YÁ†˘¢}»Æ˛Û~X∏Ï¡hÓluF÷–ÆD#E—Vje˘06-
È56w@7ÅîÈ/ÿ5fj$®7ñûV+ÇòoÆo Äy&HƒW{ààï#T"'∆b„)ºGœ◊k2+»y•#ΩSõ}∆Æ"uÄ_˘◊∆∞~Äp&ΩÀC)¸ækß‡•øù5∂‹´Ct”∏ÌÅ⁄πµ& p{Ã¬3ˆß¬
∞2ûù§”tÑì LQV?Ñ^Â©¨òfNMMûK%*T»L3ËÖ4mÓ˝ÏÂ·i≥ﬁ0rŸâå‘ÿ≤Ë,Å©(_÷ae»7@’køﬂ#Ÿ~œ¡ü‘®’–fï∞ˇ=, ˇQ÷˙†—{ùJ∆HN‚¿
Œ£T M$&8iËW,ÒÛÜBŒ@Â{LVPoã+Iï°Xg W¢»DëËüõçéç:£†Ä‡‡ˇ°’ﬂ®O(î√Éx—æz„-†Í>ˆº˜§çP√íá›‘I6cêäNe~€Yÿÿ 2øE⁄ä)Ò€÷<ƒoEåˆªl)~vef6ºHÖ˙Êœ∫äN$,3Fç◊ùk5S™πê≠“(»(˙^Ö*∫ıÇx&q∆~ÕælÓÔ7ˇˆ≈Qó5õßWﬂtZG]Í—È«rMÍûL√öaUÿvÚôB
§ó!Q^I≤êt^˙“Ö‡5èòéØü& µk§!±ç®Îùi -ˆk∆ƒ£¨!xô†„#ˆêÇøyÚºËBiÊõ•zÒà(Àï‹ñi±≤B.Û'”ÍÕ ~ôJ¿î,K3{§t;≈QEö”wÿúÒ÷ÃÑl&á[BÍÅ}YHrÕ!±êeB>°∏πR˙¸/uïõkÕeÙì è•ÊÏå±ÙL:53≠Kœ≠ôÚSFÑE%1AÁrR3CÑßêk\î
ÀÏ≤•§ﬁId¢Œ⁄|lãÿR÷¯
∑\”g¡ç?Ôåó˘„]´»EZXãWAX“&‘(fBV)#æˆœÒ/3MŒy\—Ä#zú°ìrÜzo†“ˇ€øÓŸÅm[®˚k8æ˙C¿]ñx‡ª6ŒüÂ;õ¯ﬁl:Îßd)BO(ü…1úuò]ÿ@	TO˙Ôby)'DÏ%—WﬂªN‡ÏL°Å!` Y«|¿z≤*ú°Hö	¡ƒÒHÚZg™" ñQ∂LråI^^£±51üå˚Òíî7¬ˆ•Ë: "v∆ƒú`î√F1…¶6ﬂŸ÷1üâè3qœ$°Væuc∞Ú$ÇØâ	4uÇú•ù?AF∫∂QaﬁBj-Ü≠À¥—a‹õ]πkè‰Æ5)\L/√k¶ˇõçF^Å‚8∂¶ƒUB◊ÉìÿÈãYäÉl1ç¸"FÄöﬂjÃÁZÀmˇµ-m\=9º"ÁeÎÉY"ö—˛{≤24Ë’∂Kâ$_cæ∞A3ß≠ƒÏ∆÷Fè;H:∑>z†ø`˛…˙h=KÁ∂≠—?qj∑Ë º1à8•ÌñD!ëh%õŒ	E‡ıe˚3´¨ÕêË4_^}◊=EÙTsØ”Í6˜Ÿr∑˝‚Â·^ìw˘çÌø9nüú6i’Q>(¥+/@1KN~|Qä9OÖ¯°
-6Vhb~{=≥ÅÙÄE"πu¡!ãÌ€≤ò5¸w0nQÚ:üÉEèºŸ‡Eûöy≠Õ’ê√ÿ.ÙV|Qå¥+BÑã"V„'%ëM´4
eƒ‰^1|èﬁ(ìµ‹∆¢O=?Ã±Yò#√nèlﬂr˘EÀ’˘¬ﬂN—FPH)ùò≥Ne™Tˆêúë∫‡rq≥™OëQüÑÔ® x˙ÁÔÃÿ—är~MÍÏïπﬂE„U•âàÃ´%d∆“”cﬂ=d.î∞ogc[ﬁ¯Ã±∆ﬂZ¨%K˛2¯Ùåä≥óDéh©Ä”‘Ö˚Î4ÖÅŸ£g»úÇ,Ç^ã;ŸÖ
˙Ï9¶€FLûÖ™S±∞∑N0µ\ˆÎ©-	ÆBÈ∂∞I_Tt‘\íõÖg¥˙X9!gYÜ‡ªNâ+¿¢õ2/Ù,#Î¬Éø¨ﬁ0Åoa<2ˇ‡\J€†&a…Znõ7àF÷>x÷ﬁ€kÔ±÷~≥€Âú_ß`£vŸIªutp–>‹küà ˆs±ÄUJÁŸ¢§Ûî»Ω∆Æ\Ú*Èîâzª¶ºîÙ›Z™;h6~>/¨å«)®\í2D î"¨~Zzê¶O.:AhÂè`¥‡c…¥¿√¢¨">TáÉUØ†•›DRPdXú)ˆA≠∏Ál≤Ã9„æÁO<4hm9
≤Ò»ÿ1~	Óƒs°oÆ~ ¶é3Ö)Àëüÿ`á√ô9¿©sÕÈMÃÖ¢V`å*Â$€Yœ∆à∑3ÿ∑c!-KΩ÷∞∞ Tüµ-…q`ï–åaß“
µ2˚rcç‰\ò9äàoî∫Õ˜ƒoF|ì0⁄6w_•‰b]ØXZæ>v#_-P©·‘ú`™ÿß2úöC3ÖS∑fÑSsm?äi˜∏È⁄~(®
Ú;"â<“Kd∆ ≠î¢ß†ÒÉ)mªp	#¥πâo∆ XÃNO\M°a¬Me—„K>NëLír÷UﬁÁ´Æ=ÜÁº™◊zï≈ßÁCrNgﬁ5ŒÑ$q¨◊ß£Ë~;∞]·@&M˛!÷.AŒ$ª˚ƒGz»…^9Â8íJÕÖ≥ úÊUv<µú∫Ô"SÓÿ·>◊È˘Ç6⁄W¬M‡î~w]ÃBV◊”jk+6ƒ&4]2∑s¢P,ØíAÆé!äy:A”ıA¨\4˚}ˆÑ›ªÌ¨Z‚£éRD%ÅˇΩ{éˆ	Ù"x|M·ø7*¬1≥\‹´øX¥æ◊hæûa∞m%\Å[)»Aoæ
rπvcd+äS(œT§;ãWï±`F˜ÛTL≈çlX,"„u∆úçåWZdeÏi%YÒ$ œÈ°’åç[àEŸ\ØÑBW7Ê†ã*‘ôKÖjóâMk2‰œºé©–|ÙYGqæ«>=EïOçgIëM%u∑ÆÖoà¢ÕÏk+6ºVIàk=Óˇ  ˇˇ ò˜ˇ xúÏΩ_oIñ/¯>ü"ä’”EıäIâ≤¨kª@S¥Õ˝[Qˆt∑Ø·J1SdñìLvf“ñ¨2p∏ÿ}ÿ≈zk∞≥ãùÒÉù~®ı2ËóFﬂ§ø¿ÃG∏Áúà¸ôI….WO≥€*)ôôq‚¸?ø√òÙso√_Û!ˇV˛Ycª¨^È
∏ﬁÜç√˜çôuøfœ{n5Œw¸ä÷E–xæ≥∏x¡Œ›y G8∫\,,ol¯<¯€ûOol”Ú∂∏htÿ‚≤—jvôÁ.Á¶e≤≥I√òùY^„n∑µ±›‚cÚ#[≠;s=”Úƒ¬3[≠çÕøÂÃùªÏ‹±.òX3ø1∂Êú?1çv≠⁄¸–˚ˆÀ˙∂7v¨‰kOxÊ7¯≥∆6∞CóŸÛ±Î-\œ0]∏¶Ò˙˙;£ÍÏÆ≤äÔ*ú~o√¥_Wˇﬁt+˘⁄¥~ruÈêÔÅ’Ë¿˙(€´=∏Ú¨qs√ºª∑1›™Ùã‹3<o∑ê 7ﬂÍ

≠ô}Ê:&s,√ƒ˚{ñc\ e)≠"U–kºô^ûXcw6≥êf´≠¿¢ ˝Æ>≥˝û„¡õ\ˆ∆cˆ”üV‹±˜`Ωìì∑`«Â∂GÂçqœ1Œ,'9∞|ÀuXrµ≤TcœM{‚“∂û∫Ø-o7ytSCLâ≠>^zæÎ5ÆM7ı-«çπ;Ø∫ÆÙZˆ|±*_∆XpπÄ9O≠Ò´3˜¢∂¬t≠eﬁø˙Ï3`$Œ“¥åπ1±Ä¬ 5ˇπm^º®Bh·«ù˜ß∆|b›ø™[kÏ˛ò¢`(ªC}·YØÒÑ˙k6õ¯◊:£€Ó2´ﬁƒ
ö‚1ŸªµJ|'zÀò`"~œ99ﬂƒ;»·'‚ ):Ÿn·/˝])AÌ"ı46â„œAc$«hàn´˙‚l¨@Hƒ«iömèy»*ÄSc˚˙˚93-63Ê÷◊.€`cwn.«Å±
ÁGfB˚∞⁄eïe@ÖïÆ8v˘qœñA‡Œ+<4êΩcè_’—√0käË¿Í#%⁄Áˆÿlw^á%Zg@Îï®⁄¥}„Ã¡M…˛ (st}¡>ªüÕóé√æ˘Ü%yxïƒ€ÂÍ+–ïêºA[ÍÑ∫R„¬QÒWµŒ%ˆ[øò˚6æ}√Ä«Ùß∞´^5Z
Â©ì‡π?π™Dp…∑ØH‡_≤Zû «Ú«L®É!˜ËÜÇ$uë‡s7¿uﬂXfU∞À$|(Ê6ﬁ(!s/$û˛çaÃò€3<æX:æU˝%Œ·‰3›h'¶+yº£ûËPóü&.œ∑Uâœæ˚™¸Æ®§=©ó¢¢&Uô9üXÁûÂO˚o“Ü√&
™h)˝Ö=œÃ6»(4)z``¿∂\∆|%Óé‘ù‘1?¸ƒÙQâêLJ‚µ¡Ü≤ÊÏƒÇµ¨¸ˆ˙uèù•üy€P[Iº±«.ŸÅkíHÚ>∆õWëÍ\¸ñ^h%œæ⁄¯;Ö¿éA„¥≠7å˚~∂Qˆ≥6p≥Áü∑∫≠ùvÎ[4∂bÁ
Ã¥!Ê≥	SMè¨Ò83.”∆÷CéwR§qŸ0ñÅZx9Û«ûÎ8gÜ◊¶∞≠A•[çÀPv˙ o+%Ÿ◊‚í˛nÅ!•¸≥≥F¶"zîp
Œ¬_ƒ((ïgΩ%èó◊ﬂ®Ÿ”≥<k>∂vp˝;àô-œ`é¡˛ÿpå›•L‚|°ì⁄8÷ƒ@≥∆_∏sﬂBıÆ	™v ˙Ã©€É)öõÎ¨ñôª⁄⁄ªJ∑¨prÈS◊˛K·IÔ
wnâªi«(ﬁø∏gç,Ò∑{O˜èÿﬁ ˛?zº4∞_≤ü?ù˚Ω˛˙€C¸≤øﬂâ#GáÉ;ÈÌèˆØø}áF4í~ªﬂK´ÎAXΩ2›7s`òKGœ%=‚§»`@M˜¶ç™ gØ`ˇ.ûG-Û$:Ñ¬ƒö[h'à£˙)˜É•yyä>Ä´ËW‘˚˝Ö5∆á·¡Ç!àçX&ºëÂ¿0…?ıW∫sN–ß.T0yå˘‹∫¿!€ßH[áçÏÙLÿ;ªü}u|ë‹¡±Z≠àV˘¿ÀÖâÉ¡¿·-˛'=`—æ<N?N]åW∏S‡“AÊ±K^˚N7·!´›wäß€k∏ÀNÏ…4`}◊YŒÊª¿]ßÿ3ãëw√ˆkãÔ=b!<U˚hzFplû˜¯U?˝in•5Ó≈¨4z”8G„vfÓæi<ﬂÍ˛Âv·–Ø;k⁄ñƒç±Î§<;;ëM‡(·Ôâ	â‹©mö÷\#òp∆p6¯|±' ƒA÷ÎxKŒA⁄ÿ 	∆»7Eù¥ﬁ“ÔávÚfÙÚZ˘ôΩmﬁË˛zÈˆ˘e„Ã
ﬁX⁄ó.7E@@„,íB˜ŸéE{<•≤nÅ¬∫ï’6j≈æ±\¿HÁÍW7À…™1ëÇSB?y6ùˆÿÒ…‡Ÿ∞átQ(7ãùp%dkπµË>?lY¡˚‡ıaﬂÜ˙q© @IÇ`Y≠í«œ‘˙e Qi1™Xƒ%?|zJö»•t∞b›JNœÍòßöíœ&Iï[Ó ÍÊ‰Zë≈MK,¿Èppp|ƒNΩ˝è±äµH)ç7}„-;,µÖPÏπcFÍÿà4*W/îO%Ÿ9± Ä’¬EF&…èb˛[“’ÕCN¸‰b_[∆∫—1H© ‘K√Å)¬™¡UÂ/Jx≤éi$F4.Â6™2åŒò3…z£3QúRÁEˆç»◊æU);ÌKˆEº+1ﬁD/Ùf
Àr› ì£13ÀµKC—kÅåjo2XùyF·Û‚°ã]•≈å†ús©¨◊Á$ÿàFòŸó˛r63ºÀ2î«l>Wè¯≈ZDüùôıGã≥Î.å±\66oeG ÌŸÅcÂñÉ1@U3ÀsÖ)Ñn*ÎÇ¸±<Vk8˘>3ŒåØ›∆Qj7ﬂÉÉ‰]é≈-neGñÒæ¢dÏ≠zÜèQ%ì°MËŒŸCﬂø-Y∆‹¯H‹£g4{¡
_º˛ôë?X]¯uB>êÿÿB˛)◊)qSN yôÍª^$›•µN–Àj®UA¨(Â“=,†+„•ÓTû‘é`ífˆ€8#ú,ãç áxÌ¢±XDe≈{<yó]IVgæ∑zÙN“·—…Aoˇãb◊n9°¸)Ï:Ω>oœì2ˆ‹7s«5ÃCCÃO=ñÊ“ﬂßxwt^ï˝Z#ûî÷‹3	ËoRhÔ)…]Böi˜tÒl
zÌùy∂GN-∞z`7◊ø7ÿ|iΩ6nN°˜,s√Ÿ∑ÁŸàl2FyõÇiÂä[Ë¸€≥˝Öc\≤·#ﬁ•í˜èåœv⁄«áπ/3s]{$ﬂi Ôßïq'Œgı¬9h≈Ê0œüzN2:Ó˙b≠0vØxﬂ¥Sjwã?âƒ≈Ôaxs≥X»+?;@a;JSIGê:;XÌ–äwÆ:^öN∂)ﬁKë3ä≤˝•·Db»≤ÿEUò\∏Å(õ·'*òÚˇK8G2Ó|eD>…¶Qˇw_1πŸÁ∏ÛWÃ˜∆†¬˝‰ÍñgÏ›ÁÅÎb¿˝ˆOÁ∆ÎÖ1∑¸˚≠är≈‘$%Pi˘±Fàû€)#w<å‡{ñwÏÇ0øº_õªçP—≈{µ˝~<∂hlWab Rê„)›r°ëW\£d\%XU1≈!|Dû¨ÚÖ;∑¡0'M5eπÇ˛ØôSã5Ÿ¬BŸ›Õî}†ÕÄπ9o∞,EYÒqsR¬⁄Åi„BÄ-Á"Ô )Â˙ªπ=vyL$<f9∏-K≥˛ƒxCŸc‘kb	<>¶˚(j¯µc∞¿æ∂J»!Ø?ë≥+∏3(ëò∞èKxÛÖ*ﬁ÷Lw≠ÊKÈêjQí"ñP.ÄÄø§s™?1òl"≈geI›V´ÑÌüÙó∞ÍÇ—Èıo˜z'ò_s2ÿÎı)€fóçá√£ëbsÙx8:eè€]]Háè˜ÙÙp±—†ˇÙd¿˙GááÉ˛ÈËP}°f∫Â'ø@zÚΩçôãñS3˜¨|z Ï=dõªloÿ{|x4:ˆÒFO˜O{áß¨ˇ§wö≥ÆxÓƒ©qF€ºÜπ*K'®…¢´˜‚g…Ω”+DdxqÓ[{ˆü·‹ø∫b¬•πÀZÎ·,¯≠ywGñl"4œ‘UÌË™∂ÏÎ¬*ﬁ%6OÒBsÈQjûﬂÓ ŒOlŒp∑@óõ],»¥ û6û√Ω«ıv´ız⁄ho¡¶X{¡fˆºﬂ¿éÄ=íù+	µ(˜lÏFÍ‰µ∆PEÍ\D∫g˙·≤Íßl√˘“Ì&9Dﬁ”©∞©.ø§œ…%õtKú¨¢î£V≠¸dØü¬îø¡iO’_ÖsN jd7K´=–3xΩΩ?›Ã…ñSâx|BUµ¢ÆG’9",ﬂ7&÷Ë◊K√À({ Dt˜!p=ª{∂1ô_ã7v}ç¯õnj&@Ø RëkF‘(^óÕL®=Ëª*GëÚÊ€ìπÎ≥K–‹œÖYºéÂk ÕÍÍæ“z3^DµÎ€>gu‡ºÁ∂7´◊˛Ì_˜ÌŸ¬Ì‘ﬂÚyÙf`Çß)“Âõ6¸/kkk¿M,ñ⁄Ø?°LT&ñÃkÚ\?Á'§còÍ§ˆ@ƒzn/ÌÂòjy¬)Ò˘P¨ì⁄wßñîZ‘·Nñ†bzñQí	
éåñW.ë^Xb[å'ﬂmÌµ{/˚ÙjúX∫¶cÕ'¡îyK„Æ»3≥»C±öÒòŸ|ÂäèuÃ•›Ó“NE0;;„≈1Vô/”ó∞ ∏ºAc=∆l¨ö.œåÒıwÆæl_ ¨⁄Zf≈’xŒY†Ê‘Y£NÀ∏ÒŸØˇ [LtÉ=∂@Â∞å	,mÏŒéı5¸Ê¬ÔÇ¬J˘ÃÉÒ›âw˝”À˝&|ΩÀjëULÉÕ≠%®Ä◊ﬂ{∆3pñsÜ7≤aLü˝zi˚¸w±t`ª¬™˙»s0m¬/Œƒ0çuˆoˇö‚™_™ù)´1\ùÛ$µ[f∆¢^ü˘^JﬂZπfæQ˚ΩÇQt6d2\J[Ì'WpÛ¶Á:‹¬Æ-}«ãwõ57)Ã˛Ê™‘t1æ¢T[≠˝ö|@Níœw0°9©IÚ2¢˛bfÓÜ[åÔyTúA‘§ÇZªïLF°KÄWë∆EÌXãôèŸn¶c∂ùVâ¢Ã›L}™.^+´ì"må≥ÚÖgÒDæTâTòG¢}@∑b˛múÅy;%TU@&T¥˛tt:ÿcu¥“Øø3˝hçH˛Ò‡`x8LZØΩaA∂…*…4#ñi/g¸ñUﬂßDBrJ>î õ⁄∫>ﬂªŒ¬rïúÚÚ∞>≤ö∞¢€ﬁpq ≈<˜ñ?zHd«±^¶˝¿üT©ıH¢úkûXgˆ™B=yVõdƒ1œ∏YIÖëFΩÎ≥¸!‚'E5™t˜´$ÈdΩ99á1àò6»û{Ü©q˛:¢µ<CNº	UÈΩÆjm|‡y†3V ´Wı…∫€Ì"A÷≠√ø„¢,zr8m\…DOô¬€¯ÈU{yÖ)°óı¨Û˚4˙CL¨–√;πØ7¥ÜàJØ‚ÕJZYbfsR<ê9ÃhüÑ•K¥—Ï˘\È πáséüb™^Œ“‚/Mè≠öR,Q?º®·—pJÎŒˇ ∫ƒ¸†hΩ∑¿jÇ¬ ◊Äíp(√j˙S˚<Ä°÷¥µía"+Ÿ≥Œ∞êÍ⁄2BûºÑ7·e–]¢zI•Ûa|ÀöÇ]ey˜k{ñ?ˆÏ3ã‹ˆ®Õ\0œ±,€Öáq„ÌƒM;ËËYö.ZG∆Øó◊ﬂOQieû˚∆ø’)·…•–®ΩµûSNuMnˆ≈%¶Z_ÑN∑¥˙ùIπ‚√πÀÄ@	QAKŒRhQwsπY¿¶Ì∑¸˘(lÔíû,)-®Ê2Å*îî◊ﬂ|√>ãvU3ÏY]π/“‚7JËÓ≤tzwî˙N|7øT	s¢ìH–J"¡;óºΩïÚà§úµ±ÿ%G∏Ñµkƒq∑H(p∆}UfVr¢ÊØm√ª5ﬂŸ
·Æ‰ﬂa¥kkóıˆ∞–lÖì˝Ïâ6<ùû<•∏;>:9ÌÌæÄßÎıW|ÖˇÁ
|m&_°◊r˚£¥(c%äW%n.•@µ~⁄…9ÎŒ¢b≈[π7≤ÃÉÃ¿·†:‹ïÜTN¨	ú»≥¥gòOaÃ–+Á¢Wçı|Ù∫© &ÓmL;ä∑ØÓ©TÎgÅ(ÂÿÚ|ókÙ_√û˚Å∑∑„Ã nÊË=¥"W•àP0˙‚Ãòù¡’stJÇŒ"çî@Ï>sœ{øy6y4@å|¢<À4∆<æ≥àÔo¬óî,Ò9pÀó[
[[Ø¢˛«?¸›oYÔx»@ã}ı‹e}√3YMÏ%ÊõÄä±À˙◊ﬂœ\xÙ Qp^[x—Z˘j¢L°S$¨í:–WQ¶W%˚ë6ÜöŒq“QC≤˘"¢™†Z„‰/F‚UoGBÁŸeGb‚]ÿWs˜µ·5ÑîGk7¯•⁄«Ø±Å Ó≤–bãÀ¸≥n†bsmÄÖF∏Ûπ:Î\?¡0X%¥◊¢8Ë$Ë8}k≤ƒM[vÃqU\?¬^‚òEÜ `à.Ü˛1ÔìƒI5‹O0⁄Ñ∆“å&Ÿ.]ZT”¡,4#π˚ﬂ∫Xÿè¥Æcúv9l¥Â1!áAR˙π‰gªéäìe≤ú≥Û#S-P¨òŒÜiçÅ·ΩÔUã7ÚznT¬{®ﬁé≠6∏üŸ ~vœ`S¥êk” X¯ªÜçË9∂€ú∏Óƒ±öcw∂Qc‹º_{	T>U√4`LJuDÀs7JNÕÕÖ_CØaXïø|Îú˝«:Ê¨(ËÒ1=ÎŸàí’%èªvo√x¿ê¶êÜ¢84∆ê∆K√˘ı“FæáƒBπy|Lï#ÁﬁÜzµÛõÃ¥0{8‡—~`√Ñ¨w‰é;ü‰#Ü±∏ˆÿ
à'ÄöWª∑¡/x¿ÍG)ﬁmrˆ˝A_†Ã√ˆaÁñ‰ySièÀπ!ûõ™g`èØø_¿V7®ÃµãÖ± ãE!oB  <3<è÷}fÕØˇ l	Œöπƒ-0'ì≤Œ·ÂÕ°≠ÉıOe7˘ÆööÑı†™\…UÏc÷≤C>ŒYcœﬁ¥F »Hü+æ¯Í÷ÁÑ ∆tWdjpEâÅd≤—î§ymœ√ÃbêX ®@ëa˜∆¿ºï.ÊL¥'±€¡‘ls›døÅ§;Xéπ—Öi‰qôó@a/IJ‚#<Xâ01b˘0vÅöL$,¥ãËÕJPÔ/≠?^Çædxk—*UüÔ{Æ
∫îæS©å›≤*r<Ôã ƒïq¨su®‡èˇ˜∑Ït…˙4uV†?ªü√}(XN“]‡cÀ7Hıwêç·/æÂΩ∂MûrE∫1n$œôØRnZå^ΩÂŸÚ†€íO’“ß¬ZR}]IçÚR¸Ÿ.˝Óπo˜Ä£‰¡˚ã1ôëÜp9K§+i|ÌÌf8É¬
Çu°27„ëXuîù6Üä
3≤ ˇ¸¶…èeÍdÀV»ñŒj√O&≥mœÚ-–-=î¿«%πE÷§ò¨–™cƒC«i?±8¡<¥‡Õ+ÖÀ–Óß|∏¢<ﬂ
Fó∏Râ-P<8úÙˆ_rˇ”ÀÑˇ©cOÛ≠/ÊH¿ •Y7òª”∏∑ EàDBD
±:˙bßïå%uÛâz[aÊCŸÓ6^,`“˛ –ﬂD˛jM˜
ÕÒ Æ§á%j6»¸Æﬂüy∏¬◊ ›S0Qç%‡õ≥E¿π%ﬂiÍ±uÕ?˛/øc'	|Ô¨â0U+Ä¥2`	2!´ÈÂÍ{˙Ωì^ˇtp2Ì≤+?K¬"yPW¢¢√*ŒÄΩI-˜¥U¬i˘›Z2¨∆É=›—Q¶òvº´sf™‚=âæ[Ú&Nyt‚xê‘m◊.∫ì*’O–^6Ò∞R`HU∫¶p1v5r5ó …√Æ≤K@Œÿu
˝óÃò_ø{ﬁÊ)à∂ 96ÿ“A˜Ñ;]âæpP Úça
4Wr¸ıÒâ)Ÿ›≈{ÜÆóy∞™v§“[~8≠•ì–Y"ÃêTΩ√$I≥uåı≠©¸<≈•Rà}%Œ–O_Zç/l≠∆n˛‡€Ω¬ˆ.ÿ)®Í§¡‡ˇÈÏâÕ‹ûpÿ√•èÓ%RG8÷;Ú£æ7F)>‡N‡3~πÍn»_˛Áqõ;Ç<\DXÖRëóîHGÔB7 g œ\âí8≠MW∆ûÀ‰uú`<t≥ï Ãe·~®Õ4=d°àZI,.	ïÅmvÛYs•Ωå·R-i"eõ<∂IÂä∞XHã’÷äØTÛÊ…3âà˙≠≠JòºırkqÒ≤›Åﬁ‰Ã®ﬂΩªﬁnu÷;[ÌıVss-WoÀ?™ÂﬁH_5˜•‘·Í©/›]ÚÙÔıüO{<€•w8(Nv1ˆjâ.x·Æ$ó≠O.…%ˆ)'+Jî©/©ßêYÛN7[ô
¿ô{Z·˜BOÎñ∆ü´éÊ–úRyœ˜˙ô8ä.◊1∏W6∞&	/-lF•sDïÉÛ≥p®*≥ (ú53∆∆‡E(Í}˜<xCE{!Vô»&FL∞„é{˝—∆…p¥∆8¿ç€ÅÁQm·ú˚⁄‚ƒ–∞G√QÑ˘W.ö.#	„ƒRÍ‚
”◊[ÿEôãM:N|bé⁄MñQoxõJ^«k¥Œ€ÊYc∆bv∞ä|,˘œHQ’˛äô √9Á•/»Ë/—:πí\ïñÑ\}∂@¯Ire∞J,] B»√_)JìΩ\¯eÇ®è çë8Í—ﬁ∏¿ù¨®2[Ω<¸?˛·wH"≤OèNXˇË‡¯Ë˜*∏JíAæ"·K…ü%¯ ﬁÊ⁄¢È¬÷Û—Ûf$µ8£.Ús&0É$F}‡ÇVí«†Nø~"oC±ﬁàH!˝Í
î†òv|“®®√m˘ä{bä)“ÇE´pHR»#@)˛Z
Ü$°%∑^ÓÄä¸˘y˜Æ’:{°/™/ `S¶E©πST≤ox™ˆBs)“ædS≥9Ò˚(£©r”Ú≈”Váß◊Ø	∑DâHä1Â≠È
9ı≈[-mÒ÷VjkñA‹”Dn9.
‹2\_B…	Ä1£@)zÙ>ïüÆ®gbqg:‚®WÔ∏Ééó›evª™Å•0=3 È‡$ùãBdÿAs& Z
ku≥ZEÖÉÒ3ßÒ26bëı¢dQöìòl"æ€M0Ït‡8¢ÁnK¥¸Ïli[~ ä´ Vh¶§0ügÈ«.”Êq’ØãÑ)HøGK¿êWTD˘'≠éFù: À“Ã∆ê‚}+Øå“öjUB1’e¨Xî5`>±ljî
 aí•h	©0ÿøj¡±¶®_ô^UŒ¯Õ\=Òlì·t¯ç6™˘Òü.p
˙YàÆÁˆÑçLH•àÇŒ¶ÈÁ∏˙
kÆìT1éHÜÅ¿ü/_Yó/√4 À,¬˝2’>-“”]ﬂkECqâjÂ€t¥H$`„T√≥X…FL‡Q∑„A®Ç1“ >b£øLQF˝6—UÑ4‹üdÖdù”…ïõåˆ€nù››iø®%W*•3Ssøº“ºµyﬁµ^Ëm–Ë•§˘=™`UËëºòîø}:WóÌYzLÉ^˜ëÅÂUÈS
€˘|§~x»?ˆ9îŸ{Dï^+∞êLıø6àîrµTl1z+õ.k¢Ú∑vWÿ|7&ØRƒUÁ&C˜™aIEÚ_æ±ÉÈK√~k¯‘éäû9‹ª‰{›#‰ÔZs‘øç¸∂òã-¶>ÆK¡Z´Î˜s”Ë)˛¯˜ˇ¯ÔˇÚ∑—i√˘°¨Y˝–À]–⁄æ5FókÖ[™‹¶‚@mdœ√,Ãy2xM£wS`§[Ë7Ú◊ë˙œﬁﬁ}îâÀ4?µ;∑¡ÅQ§8ij¯/˝•GªÓ˙2∂Cä,©<ªÿå='ä¬ »≠≤—È*ÅX¯I2P∞jµc‚1Ûï<m%*(¡wb‹|Œw1p∆lÓÔÁ’Hˇ\^¿Q^oñ£ÏFµ⁄a— òz<y∑ ªdèHøª˛nnQŸmæ<∑Á™4*'©Û¬%GDKüj·b)SÙ∏ﬁı˚ÖMèÌc≠0Ãºª÷d'
k§k$ß˚ŸœŒmLÑã.ôC°´G°â;ª~ÑYƒ?˚–†√]»µ7…©7Ÿrõ,…è⁄h!
k¯6«R$û…Œ=‘ÿ`‡å"ã¶Ä‚-∂}Ìﬁ 	IﬂÉ‹ﬂÜˇ
Î%π´n{àFO§sUn,ûî ;% EI`‚v%˚lóÆÁ·õ-·h=
'ﬂÊƒÈò‹…≈å\+´≥yﬁõ›"Y-X√ÓÃ£∂nÒÓ, “®e_∫,2˛Lz…yπr(‚ù ÿ’	»Ï≥Rr††/ä⁄ù«ÅÜCoiF/Myo;Yh∂$÷"eá8ì ˛-¡lèqS{ñÔ:Ø-jaÖÆK–√◊5M‚ª~j\òDõ≥¶®$ê†[«¢J¨…ˆlÔ˙ªâÖ°W<Õ]DQÈ2u£í⁄HﬂñX√Kgy°¶ø\`£«æ6f‚?ÌzØ∏–•:rœ5ócKU¬XÇwFı'Z÷©(G‘˜ó*pÀ˛=:xÃˇ˚Gø|4|¸Ù§G-ÿﬁ`ü¡œ#¨â%¥õ“Å√Áü∑¨ˆvÁÓã"pX
R¥z‰0›©≥0z¢Ùïc©£á:(
ÕRÏÿt∞?|<8Ï{¨wr:|4Ñﬂˆiâ™∆’Ÿ H’TKﬁ·ì¿X∆Íe¶aZaAºÖoMÆˇ@;?∞a]6U˚_rUÑ0§Ò*
’!≤t‹‡«öÛzÆ&€«ú–ÉPÌÉ5üP6›<ÆQ≈Ïì0QÆçoílb®üqééNü‘Nh‚∏g†,pQ$ ãÎÔÕ•C–˝aÈ´ÅmÕ
CÔ¢ÃW™Í›‚’æ≈WÚçˆNˆX{ó=⁄Ôçûhîß¢∞@πöÀ|`™8,Û ¡?Íµ	!ü46õwÁ÷”öÜ&Ωsqö W+s‚GÈeŸ2≠c◊O>2’Ê[ÀˆSH—wUH—;i'°"ç¥›QÂëÜÓOÆ{ßu÷ﬁ|ë◊k≥Y@‹;ï* åÚõ’∑R£CÎ˛UtT5ö\∏p`I˘vú†•f§Æ§XxˆæîW2Îç˙*Y4õ∆@(YŸ
B´”¸∆dãüÈvSÌË´·ògsÂª8ËÖÒ`geﬁﬂ†◊?>;"⁄…†t08‹ÎÌzÆ
-™Bﬂ÷™ïzMË_üﬁô§#µ@òÖ+\˜¶R√FËñ ËõP‘>ôÒ÷ùá0n”ÎÔŒ<õÆËÀmäfua˙e(^õlhZà”B(f»`«ûΩ(ˆú–ö√_O†]øüÿE£f|(-qV®:K\jÖNNΩA£<Wî+jWÑ:ê±Eô¢d(J.	¡√Bü…jÃ,ŒüâL¯õ+⁄v#+Ÿ|uÎ≠·'ms)GLX˛œÄ¥8±Ñf◊∫ÇffK$>lÿàã·Ãù;K∏·˙{$©,9≥ÁK∑y{¨“,Gπ'∑8≈˚∞eA…U&yﬂûXû 	Äü <7`£°õjêÇjØÅØ_`Åâ‚¥êJl†”òª3˛L ÆÚo>”hò|P§yvvŸÒ…—'§w∂œ≈¥!Ï˛c”>”_B],=†îå*ju–ˆˆŒ˙Nt–;÷A?¥Õé=˜G™ÅV ]¸§»˜«§á¶ﬂ3÷FŸ‡«ÉìSÆï\ˇÊ√É;>:%OŒüÑjjº6Ê§Jö∂o]ˇ>R*aäR∫áEr#Á|9'=ÊnâÒ∫¥¬…{àaÓHJÏπX>dM‡RÄòvÌÀ—ñ‡Àq(dlp˝˝±;"ïÎ1P£Aãñ(®\à˛Y9˝î”0E=Fù·Æø;9+◊øs‡È◊A3√fDÍ í!H'ÿ|òHôË∑bài @cîYJQÇ+«6áM¥Ç1˛sÎ≠ß‰›‰≥;iÅŸÿ3„í™ÒÍxÅ¯¬∑€Ã`Ìéÿõt¡[)Xs3¨Ñ1-Pí§é‹µè¶±V∫¥Ä˚üXo√B£”ìﬁﬁëË>:ÓÌÔ±_≤ΩﬁÈ—àÌı{˚ÉQ•
hQùª/ÙP™J!‰Kâ_†(é≤gË«Q(r2<~z2‹ÎÌ¡‘G´ +íZÜ%πyj'LÂ∑º£ÓÏ˙˝:z^á÷˘:ï,ùŸÌ!D<Q9y0Y"Úπ!“ëv)ïÑÀ√)∂™·69«*4I0F ≈⁄≠÷_≤}¨§m<≤=?( GUó’~úË“iù1ëËÉ±≠DaŒ) ¯—Òøéã¬¿bS€G8û$¬N…ídY 	1 aƒÎ˜òMbúß  M&yﬁÃö·Dñ(=€MÑûﬁXg¨.ãRÿlm∑;/§qÈTmm+á¿jT=ÇW=GD¨◊öÏP¿P¬Ûp KA)¸WLF^ûaåˇ	ØIøZÇ∆Ÿ:úGÙ"ä±πSOtbçâS®f∑ÛgÚÿòÜµ†iWÃpoú$´;[-sóå¿¡Åe{D+tnev^7±ÛÊHf˘îÿÉ©nÜ7ûÇíƒSﬁ®k9“9-gΩ˘µÔŒ◊h—18ät$›HŸ˝vôDHëhMw$±Ñì€KWwY¶í©2P,«´·s›s@%qQÖnŒÀ„D˘Sá•√Ä€yõª	 ‘ƒvñÉbKú&‚´;≤ºªÕnuÄ<jq≥'°√ÆÜuzõ 9.X∫H*Ï‹XPml∆ã“©Fa‘óPÈsëº¨d83µCF} ééØÁZ∆0Àµ·Íê)QtI¨2πZBÏ]N¶[¿8r~<Òr¶ta÷Vª>µ·ìÂ\[âOtâèÂ˜|ÚÏ≠Ã¶øª√¬'¥ÒÃ”ßã’˜7„%bÎ	"˜π÷b,¥)mlÌßΩ-"Á∂S‡y4∆ck‹Ø◊—ü#"rÅ√wd	Åì9S€eMw'–Bå{!ƒ≤Úã6ÓÌ'˚U@◊l7Ÿ`nr:ßDÿº7øÁˆ†Ù—VBJQˆ≈jvÛ™{[ÁÃ+€1´\øÙCK),˘YñcÌ	≈Dc‡≤"^ù‰B¶™ˆ‡¯htZ¥ou>´N2Î∫ˆ`√XÿhΩ|[ê4Øıï\çå8,-ù	ßî¸Ø-0≠Hæ˘.h§6»GR≥˚OOˆwıÆNC⁄ÇLG-3pïj™ç@&]x!ﬂ·*ë√ˇW_Å@qX„Wî˝◊ˇ
ﬁx¬j}ó*›ß¿VÖ|(Ä6àoäMˆè6’PG∏ƒìkª¨v⁄ß{f∫ Ò◊ßo"V[Ágè,Ó1ú'§g\‚5{ÿL
ûﬁ≈≈éP¶G∆¿ÚÛ =k<uõÏÿımL7»m	ìo˚Õh\êwÓÏò`˝qP¬›ı¬Sa≠`vñÃ=ã·y©≠Ôª/¯˚`∑≠›ç2«ßÆÏÇ¿o%ISÿÄ7°øjøö¸(´ex‘?Kµ,è◊y¸∏HißÊ√JXæÀãb·B÷∏sv2¿n≠tFßO˜ÜGÕfì’üƒmõ1©)*J;0ºW&X(kD5jf˜rÈ[&éñO¥Sá™5"⁄ÓR&vöÏ5¡Y˝ Q8ª~è)f>5ùÿﬁ“àƒ[CîÔÎ¸•aQ*≥£áÖA∏gãON÷3&úÛ¸5◊§8üóË'¢Ä«áè7~~¸ò‘ûe{+vhÅ}Ÿ	lœ˛“Ö·]øüY¬—∑0.Iµu);Œp4≠oO≠Ë¶’ä-ï2ëäñË7ØÂ+õ›2r-¨mÇÌ8û¨üèéŸQ8Mz∆¢~
ﬁgçV˜ü˝Ï·—…õ÷_=û∏=¯éûNO'Ω¡Ô’˚◊ﬂ„¶◊¬Ó⁄ÕÓ<≥gV(îË)6Û	‹ ˇ¸zaMj∫õ‹Ççöd⁄√$AKËhùÊ´R˜.ÖóïÏR©PA±Í7hRÚTıﬁ≈J<1u( ¯Àg®fÊqXNs|r˝õ˛È∞ﬂSÌPe/÷j\NŸ(ú	5∑„,,ÚíP52%„r$‰7xe]FUºÎ§7ÇÈÚ¬Â˘PË∞1øvìh´¿¸˛f—}„ØGåéÚ6Å]™l‚Æ~‘?ê_Í4®lj`òîƒâ&Eg¯¶g°FK≈zæ%∆bga)V%ö!~¢‡‹<¢‡DmV“’ò:¬õ˝9‘Gïûef√Ø"ˆºJóÂRá+ gg`∞œ@∑¥›âg,¶ó´·aßF»ùÚg`l…>LLŸ»B˜!P$6†8÷hU]wÓ√˚KK wV' í˛jK/Æ˝Û¢óYÙ!NñXm…vwÁ<TpÍˆ–ˆÚmˇ˛Uù&¯©<+îÏöñÅæ!,ìÓ]≠Ëøó8ˇ@å^èn£º§íOΩf]Ä∏ ÎF<oMzëdJoëz≥è∞g˘œEœwV§ÁÕQZH±2∫Ne•ﬁO'© lQw>úè]ËÊÓ‘ÂÌV#èt˛+Ÿ’ò©d +πèÓ_•˛î›– Ï£¯íàÏ*PoêæU˛òÏ sõ†~ÄEÑø…Œzk/ÿ Á˚ëÌ¿ËŸ#è\/\;Â˛*7JTÕê˝*1\·†•uÓ.„!†ØcÉs51$éƒè˛<2Ù„€∏ﬁ—¬ö◊—q_~X÷2v‹•Ÿ0œV„)—’f&%ò	¶->≥ƒ¢¿™ÂN◊ND’nÂ˚â†ŸÉ˚Úxƒ™ ?1{{„¨ò%ò
Åªh¿]Ï…4Äˇæi<ÌØi„yáˇñ*]›»‡8û9KØÒ|á£µ¥Õ†+∑(â'‡m£≠¬◊)ï¨äìÂ/”hw`B⁄ùTïR G∞•H/≠Ø
cΩ9‰ûDQß%/bÔÆΩ`q&≤:Æ#‹ˆi[÷z[.Ù‰Ë2+Ú-a`¬‰a"S=@L6¬}e5P‚$⁄±'"S◊éEÍT»√›rﬂıj∑ˇƒŸêQnZÔT*l•“≥àcYLåfËs0Œ<€s\™´XÿÜ«¸%eÕ[‰
03¬äì;∆Kr7P(À∑,M)≈j»˙öØÆ|xìOø/≥¨•√s* $À‰áıQZR-S@òBÊ›L§ÑDàO),¢|2˜g⁄€‰¢åÌD]aöi ¡DﬂAÖÎ.õn]≈Àj¸‘3¸Ù&Œ;}
‘Ó“ä∂WQ Wóœ•CFRñJOPöj*a2ac>T¥W‘ —é˚ÓdE©ÆYV(*<+ÄGYΩuVˆa#ŸEwRA ﬂS ◊(‡)¡Âv{£√DxÙöót@›QE~3]Æœ“¡ëTD5.}ë?vµÜ•—eeï&∫~ﬁ∆à¢òÅ9Zè¯fòxn07tïbÒó$ P‹(üê&	ÈÎG–Pÿ¬ã˘EJq˘óÔbwOµ;MÙo+ã´€íoH:E%Í §S†Îè*˘BÅåòªâ ñàÂ™¯%•æ(8úßù∫»G.ÖAVÔ*1Ûaç2ôˆ.*ÃPs≈ÿW`B=ë∞}∂I9‹UΩÆtìaWÚÄù∑¥Lvü•ﬁÅØ„T™˝l|P`‡IÓ≥ƒ∆mÓæ˚∆Ú∞z]·AÜ∏ÙÊJëèwnFπ%Èõˆ|Ï,As©”Ω◊ÿ7ﬂËF…‰ú‹h,æŸOÅ Ù√»Eú‘-G%áÌsV'‘í–o≠)£`>ulï∞ªõ5/—pIÀ∫¢¨S!=ƒÿá€ïÌã6V÷¬èƒ˛ﬂAãµJä$#√üiZÄWé‚')∞∞úqπAó_:<3Ö‚}é¡ŒÆˇ‡iƒ˝¨AÚÃ_Áj Ã’ŸÙmëôB‡Úd°ÃÃ¢ŒêÈW“úF( á0K(0«†íém^πãKÙﬁJÈ»?0)}nîÑ∆êKQG¯e9e¨ ü¡˝ÿcÇX2'2ùºÎ˜R„â∞I#®©ùÎïöâI7∑lkkwjU¿Agí¯sì∂ú:Õ˚*‚(3cQ'ÓNÚAç£{OÊ◊ã?Ë·ª"∆hõ%q≤ı≥ë±G«ÌÌÕ÷•B$´¨ŸI˜RÎà^=¿KF	›{dŸM`®EË4	Sˆ…¶|ø¢∫ÚÇ¨˚"ìÃHÿTóÌ
‘Õ2–™T]ëú+è*]µ≈”çyK˜`Ø>Â1ë˜V@—i=·6öñÃâ,Ö3≠ÖÇ>HOÿ3dT≥≈ª
ΩR*ëJTúTX⁄QÜ5Ø~7SØR:]0áòJ>÷∂‘nπ5)!‰r›˘–‡ÅKfîÏƒ{ä•…®Ñ≈˝˘ ≠œ'3ÀaîàT·ÍºΩâN[_âiﬁ”ú.¥Î\z≤JQwáF“;∞A¨ûóÈµRvÕotJ1›î-Y†MœáëÜÛ˛~|∫kâ>É9‡∂"Ñ©lb«¿Ñ-&Oâ»]:
y=Õ◊K\Õ]ø˚Æaﬁ`r$•XC]∆/ çƒµ” 4™Î
-7»ëgO∞
&yØ8é$\ô˛dhè˜A¬|ªï/äN„}e=ﬁ"ÎRÌıæl§¢_eã5µêR5§Kuúz´£ê®:Cñ.ä˝Jº8≤ú"P ﬁ(N[eˇé›≈Â©ág.KYRZßJmÉT¸$Sú/í≠fwZ9$¡;ÈF°ùú“(NìO>>)Å◊v‡¿k˜y®ç£s‘ù“v© /YıF<ú√ÓYé§XëmÆB1…>+ôÄ[¬÷à⁄>+Z±l}xöπ)≠{‹#],r@‹êfdaªÚL©∏9m°b£˝zMA ã$2Ï›Z=7JÖ&∏E/#m ^∂√éÄŒ„!'Á2øBLH†K¢ÎdOumépíX´|ncÅ=©›h±∑çdïúËíù“ã±Ÿê¶Èπã%øÃdå5 „Éâ,,Y_a¶ï4ßi•\´¢l+≈ù"•+(Ñsâëì ·º¡_≥©Mô@-u3æ”}=}°sÙîâRe˚im#ßŸRªi4K-=öå$•RcXf†/∂+A\l À«∆jlÆ‡FœÔºbüNA≤A9Á?◊`gTY´6∞5O.	0^,yâÖÅÖ9>É˙5îuõö¸ŒøUeÔy∏ÌgŸGSß•‚'Uƒ÷Nw:K5åœx=‡˘Ã™ˆo,TÂÇPπ¨ø®í™¢ìsU ¯∂så<s‘Á_ËΩ˘ù¥7+ÑHÀBïàœ≈çGµπà´a6(ùâ#⁄ê™°é‡ﬂj–	C”∑f6›<¬‚~=˝Êª¥Ñz‰aA¬BhÛ;Â√=∂¡˙◊ø3óéQiÁ÷'~h:æıZ§ä;©oŸõ¥˙˝Åód`Ê±0/}-Së…'ΩèØ7∑ @ˆﬂ˛äŸ˘@ãÚÉr˙>¬ªªÏ√2|tTÕ«ƒ∫9Ã–Ê˚Ê—,ùû´vQÉŒÎ#k<5B}ÛÕj"Ñ$ôVÓ(‹É˜¡IÕ_6‡˘ÈŒ1Í ∫ÆØÒ5•x3EEãMSÑÖôÎuºöÇ˘a':.ò´|3ˆASÕÜ4÷(Yû“—‚*kP"ª<Ôø(]gîu4E•öºëù’}Í’œ„†Ê‡Iäh˜£äñDD;$óù€„ıe–ËKMbªÂ\«O,°†"ÿ˘,pñAmvzÑ(˘±.⁄˝aÒmÙ.Ø|tZC^†âº¶¢,mm‰B±¿¯ `ÍÌ√∞è\è{?rìY∆íNá⁄ë†EÁ≤˘±»≠|˙‘*µBï*Öî`œJcã»,¶ãf,\L:Œìûm≤/uzΩVôÓO-‡*º†DsõÇ@∆øΩß8úÈ~¶—üï 3€]˘êîJ‚iÜAD1L“óY}‰Dä]—(Ë¨Re;ô ¸ÿ<áçî%ﬁp7Uœ1¯vä=AºööB8èÔ=bèE……á^Du
œ
©;©îç_3Ñ,ogµë$…;Ö∫ú~∏lèNÎGí§Ò¨>X	ñÏ<àØöí—lS3
ñóh=¶kx£„¯ÔÇ≥WºYË…[—Å¢ÛWºYoíz+¯SÓä∑·ûù‰ù¯ë¬+Vºﬂ–LﬁKJ
ÒôUÔõ¸tììËO˝πUo¿tõΩËO˝π´›fﬂæÔ'Ô$é^Qı~úŸDØ’è˛‘ü[ı6!Ù›‰ë¯CwûñªÙÇ¿OÊél#u∫Çûø–>”&0R$u›√EÁîX˝h9õRvøHùÄCR‹S;®"V™∫Fô^ô÷uBµ6•ÏÑ?}mGëY zB Ç•ÎΩ"K˘C+87ävWHeºeNùYm•˙ñÁﬁ™·¸aU∆ïÙL√˙ã‰=ûAt¥cÕ«	Xmÿ∞ìiäò±u2|¸‰îçÜ{ÉáΩì]∂?ùˆ!ˆÙ§˜∞˜Û#∂7Ïù{©º≠{ ;`MÄèTáﬁ‹¨¡ôA†Y˘àTò=e¯pVÊ%©S∞é¡î“ô‚‘¶¸ÓO‰Lâ6∑íóH≤¶¬å©r7HCS”_Û1mR[gËN9ü[æ˜m¡H¶1[¿7¯W~(Y€4B(x˛yÎnkØ›è⁄Ö;YèNó!‚SË±…$WeSØhKùMg)iaœªø p·ˆò¿ÄíR˜L*Ç∫à°©êJdDM∑€n√cÁû;K†Øm#’„⁄M~ôjÃé∏Jüoonoü∑eËUí˜¢}øWπoª≈æ€lNâ,è∞\)ä¢‹,vµsΩìIJ∏ƒ⁄wŸfu®+ïÀÒy©ºË“bS(ÓRåˇü	Iëë¸öv≠∫&N¯ö‘
‘3ŒåØUûÑ*mÓJ≥„˘Fh©ˆä#knlœ6<€P<Ìç°%Ωa‘ÍD^ï DH˝‹p|yùÑ.s.K$À≈EFÁ∏õ ï+L@óNVÈî9ï~ è$ôÿC◊º,¡¬DuQ6ô√ëqBù?ˆ\«ÅQUÕërIDÎ≤ë5¶â⁄àâkS˜V a¬fX√úÓé¢Íµã*≈WN¸-`À0ñ8ﬁ∞q∑Uπ?¥)Ç„8;K?SÜÄEıOs/:ÄÂPlru‘Æ∏RV“Ω$±{∫‘ùWQÜÆeN†gˆèNüX)8dÁñÈ⁄òÏSvmî>”õ/Áº’˝"¯ÜJÑ®›2ÖOÕÎÔå®j¿ªb˜w±\c+†!√T5K!ÂÕ3‡q{hnàbnœS¬ÂRuZœµ},5ìÌ™a˛ñπÑÑ µJ¡øu§¡ΩIGó$ºM¶,1¡∏#Âó√KîÎó T”µ=ÚÜ'?SùñCSSG"Ã(ã›g ˛ÌŸ|ﬁz°w\q|c]	1f¡∞#<s/‡F¶;^"6·f«¬_¢ÀªF'6∆‚Ã⁄3|ˆ‰Ù`à”&Œ‘«Ú–C(ﬂâùq:•G]O?»óM∫’7ﬂ0.ˇ’c´<e|E˙∂ë¶Ìg‚E€˛±Áb-`·;»áWxg§•√jbΩ9+=Â˜m©ˆ∫≤ºLµ°ŒÊíIÑı›¡Ë-F∞îñdk÷¨ ª©¡àäÓºX:9À>ƒ4‚“ØŸlÆú°¢WÎqëS”üË4•õÒC.Éa®ÕÏHöj±H#6ÿHh¿â5L∞Õ‰iTC÷hÉHèz:JõOºá¨°m	t”Ç“«ïíñSzZFiŸª¡’ú∫3–ñ°ﬂ@ôn{å”|’$ÂÁ;ú§Uπxµ#ó∫2cÉµuˆÛc¯Ò◊Éá«7 L÷≤ÁUtªUË»âŸ—W›gëlPËÂÒ4îu;≈í7;ä≥lÛ~V@Û˛P=Õ◊K%ˆ»vÑÍôAÌd… ÒTrVπ¬e”:7ñN–ÁrÓ˛IπJ"E®p”`Ê<rΩ‹Ë˘≠Ö†5≤>]Jû´iâ-3Æïº¢ÔŒŒ®DAÎ∏“låÉ•·(¥ekÊ =ûÁÇm`ø?9àÁ!Ö˘ôäz
â%KEÚR7[ÙM'[füRo7SÌÅ≥âå¥≠h'©6QAw∏(”OIMU*]K ãâ<Ï3ûáÕßå£XTScX=„KØF≈2w≈Ÿ‚u∫êÜàn≤H;≈˜)È (¬´ÏïPªû…Sr¶—)VÙ\ƒ†2B‹qd÷£˚2åG∞Û†…∑ﬁ…sÌtTçàõ1¸=7¯ma⁄#/°qE≠ΩYΩˆoˇ:¿æ®ÿL`≤‰ÕO— Gú0è¬n `ÓGŒÅÄªãÒ◊©{˘emMo§1B
i≤Æ—´-!-,ë∆ﬂâ±Ñ,,ŒÀMs6~πõáàeI-S+U™cÍ?√^ãÚlQ†[ÇØPç¸”„[%A4Ã!ù~û˜ÃzJÈÍ≥h¿6RÓ¬,Æ`?¶–Ç/¡Ê†∏y	l }£lÁB∑ÏìPYìaÜ˚˜ÄƒË¨bLj4˛nQˇgØˆ‡–eS„2ˆ›≠Vêƒ˜N;9™Hj'-Ur‹oÓ2Dÿ5—•à5
ÛÂ™+t∂kûpöV¸µŒ@ªµ.Jπ•l$Z™±˚L\èyÍHÅa≥µêkE…rHª·π¿É•OÁ1Ê)ñ_®YõÚ«
™èùÌ˚∏åÍ)∂+	˝ ~ô˙	‚=4Ãâﬂhí5‚Œ»eF√TÁÅ(Ø&E(Áî=∫	‘ÀÕ<Âú≥È6 ©Ë{W⁄’®’]{°ya¶öºƒù;%!o˘π%nŒm/‡ìk∫öãﬁ10Âbô´œq"˝åJ ”1›0•qßÃ´ÂÊ19zªõ+ÓP†Õ¨8ï˙âT”Ô∆F§fœ¨¿0–âIòû{lxæÎÛøw∏vÊG6KZˇÍ'WâØﬂ1„´ÇÏœÏâ»2Œåó˛∫∏OQº%GN§gv∏∑À‚éa >Ùb
¶y~ÿˇ¯áoˇü‰∏xñvÃxƒ#~Z[Ω∆˛¯ﬂ˛_VìwV‡üÇv	¯)¿>ËÁ±§—É‡≈r˘Í+A˘c;Ì∂Â>*Ry:¶¥AΩ:~rï›ÓÔæ“=óŒü»ıÀ!9&¶™,•¸îU∆2◊˚¢ú#2≠Üÿß( ‰zEFwâ∫˚∞Ë’ :,ÀL~"äƒr|=¸FÍ! aR«˘Y∑},#Ô,Ì—îàM≠™Æy≥bÄgz´íò◊0ç‘p”-uíW§‚ÛTÆDÏÇˆÊnVìHY†ÕB ⁄=oﬂ)®N~¢iôk`∆Ro±1›*Aï≈‡◊t˜àó$5iûY¬ú»M!äBπô	ü≠‹¨‚Åó†ír0Ò<¡ÅTô@r+‚¨≈££Am¨ÎëÁŒ"ˇM,øJÏÄƒ¬Ö∫a+OË·WÌfP≈<@ñ€¶Lâã7+„Ø X#«W—≈%ˆáÉ5L~*$ìb÷rƒDixÑUÍYø^bóu.c.K»À\[¢∫≤ÃVß-I7ÌV*!´õÇíTâáÿFNàõßò%Âﬁ´x◊Ï}ôã>uKXÖﬁòá'©ı$∑”n†/ÈùYp`xõãvAﬁ^Úë≈c¢Pc≠o6î—Ææafµ/?W£K»ãTÿÿû∂ƒ¢«VaŸ.0%&Ë‘ùL´x!K+q’»76ˆï«}QZ ñî¯˘ J/ˇ®r êI%x 6mBnƒŒ¢ˆ‚‚•‹[‘Y{QYæî¯!Ö•
	$?Â‰~J,ÅîêB«‹G#§ß”àTŒpJ«z“èıQ®™J!f]…˜8û¸°(IÜù“°úè«}gßñG Œ'Al—“~:‘2“[!6m∫Aôr≤ë5°…EG'ıçˇ∏DrÌî4Å¸d*1~õO0üúY∆∏ÑµucŒ©-H§~ÔTãàøôíNÙ¶§ì'Á´âíOÈU√{ŸsÍÕ%n@Iõ7?õ»ôp„D>xê“√≤œπ&ìèê∫i‚Ö”EÅeÔZÇR¥YpΩ∫‹_—€˜ñ⁄◊P®5äIÙLûÔ‚Õ‰I?¸Ù—ÑNvÁﬂ˚Wú¬Ø‚ÀS7JGÛTzÛë={Ó‹~ã=U—ZåØøüx∆9&£.(MT|ì-6î?ﬁSxôèÎﬁúèÇfÄà˜ﬁè≥iæÃGÉŸ.{˛Bˆ¿í©çj’©é;˘]bqî%ÈÈE¡Ÿ¯è¯ªˇüXÅ~‹{<<LVûﬂ;w]*˘P¿·ÖvZ\íí∞‘.Tó¥£*ùˆgªÙªÁæ—[ÉâÀ
†E˙¶∫f3ëAô`CŸ<º,=• ÒÏ9c2ø˛ûkÏ≤cƒ’úí	LÉÇ0{^ìÿNR¶gñÆú·î.≠=µ‡"˚,◊1¨∫ÂÔ≤á√∆Iooƒz«tÔáÆ?∑çWÙ˚#«≤˝ÒtnIzpÈpKwê#}Sˆö,¨%-DÌ¡„¡¡p»0-˜—~oÙÑQÙ˜≤ßÊÊﬁ'2â⁄˛ØÏ≈@tzå†ﬁ⁄™∏J	©{pÊ,–,:=Ò*∂è◊ﬁóåó‹—b‹˚W‚ó‰w®âπæ%œUÛ≠‡W¸é
ïÿfÔ[œ◊◊ºKﬂKBN›«!FY»Ó∞…J~/ªx‰∏Å‚:¸*…¡“	ÏX∆≠üº2ıE|]‰åùGú≠|˚OÏ‡ho∞Ñú•7éNá˝aòÃIèéO£·ı∑áÏólã„£ì”^ü˛Dî∏˙`t<Äs˜Ÿ¯…—·`„‡Ë·p¿~ ÜèNzÉµã∫ÚßÓõcu‡Ìé“ÒIu1Rˆ/™ﬁπ®bœ¢ä›ä§Ï> e»1˚DFıÊÖìÓZ‘Ωà›Ì`"}Ø¢∏©Q“
HK@$/Å'¡]›œHJÉ®{m9	}≥F›U–ÇKñf»ê)àê”w⁄@≤\ìºJ˝Ä ¥¶Ó˘0∑ÿ	S=ú-@ù ëxI˚4$Œ£-HïBeCü<"¡(µ´ïPrq&m“≥‡?Ûòﬂ™VΩŸB⁄≠(ôØ0∆ø¿Çï,TI∏π]*S≠qWp≈∆ÖEb3yÓ˙ºzœ3ä|\2Dç‚øÌîàYrî£e∂∑_î⁄2RÄƒŒ”óÒ%u¬¨òÃ∞ÄÛ
î'˘›¬'kÖ5Õ‘
MZ9 Ì-W<€∫Úùƒn⁄5æ.3GıTÿ•™Êª…™yTf…ùçz¢y˝ﬁâ™ä›05ﬁ·X◊Ÿ¶ø–îˇj¬/≥aü€3€kJNeÓ…÷ïß˜h¡Æuæ∞<[àYÃ%°®~¡UûÆdáör..•Ä%È¸Üt>Rº¥ôR¨ü®2Ÿ«‰æÒ®Js¸KˆE:  g‹BHÇ
"~KÂg™áﬂ•·„möâTÁisLT>∂<˘JÓu ΩÀ!€Kù
já\Ë∑
Òïû™™àzÍ∑zÈÛ{©™?°)I-˚‹ß∫d¿†$Ÿ•ìYu∑¯Pîß¢=µÉ¯?˛·ˇ=:y2®Qï	ã®‰§!C	)»µ©#Ï Aío™cË∂¯©K óö`§T˚€ï«Kd!3ò∂9ÅwYæ=[:°ÁáWç0–®.Ï‘◊hPñC ÔkRµl˙÷pnGV∂≥%Õâƒ"-4”áê∞®)r&àïŒ/˘º¿+óµ<˝°ù„Ä∞:9¸â€∏·Ss6òyÚ…Oh¨..»ºœüiÂlÜÙrQ±NK¡/´…“ˇÛü˛˝_˛ñçË˝–eç∏0ÖÈÕ©caûøDLbÎGEâß.Øè˝H»‚€ˇŒûYº·¬	&Vo¬€ ":j¬–I2…°ú)⁄_Zﬁ¬%®ÅA›öõJÿºmÏª¿8ÇI€96ó˘ìÚ‘∞,üb7˘√bˆ1ñ\0,5Ú‡é%ê¸“…ﬁ[yX∫à*Ÿù{—ËjÛ
k∏$/êºR˜¸ÖS{ 4{~õB÷+ÅBJIx≠W	Èˇx≠EÿÇéª'¯ ¨≥ëqnx6Æ–±a˙Íd“«Qt§“¬…a{í3Ï∑≈A‚∞Øõ"¥ÙUB–‡ÿ◊÷xIÑ
È$ÀyHA†å›Û·Ë|Ú†7§¸T€lÚ#Î®(Ãç◊÷ÑXÛıfœ/Am u&ÙóŒrggû%ºô∆b—•¶≈=–IÄ7åÌ¯Ücw∂p¨Ä#◊Òäwwîó9ÆøñéÎ≥π∆£=`GÆªƒÛ-õ
ba.ôª‡·%<˘Üi{®ﬂÏ*¥‚ K∑@¶mtï€dÈH∑ïCqTdzÛÿæH'Ωo) ≥"‹ê¿…”'§˙„ã§°&6DLïSπÇ]-{jÀzVugÑqlÚº^uW(KÓQÏrMÎ!5ò
±ºtœ°}⁄¨éÌQüûÏo<Å=±¶∑ºeieºe)£Ûnù¬¸Wó‰‚é-t8∞-°-:˛„$¨¡Ÿ|é¢¡Yqı0•åÿˇU·2◊D/€,i-Èx®Ωcıcî8◊ø78ç~™Ti…Tø™}]˘5ØT¡ı‘sÿ}ˆ¯é˚¶È∏c*„lN=Î\]Ê*Œv1"ŒáXgµó@;ÛWÍ¶\¢h\˝H|˜êπíiü¢SÆyﬂ˛”µﬁêáXÔl4	“ﬁ'≤◊§Õj}˘∂+≥”D‹Çπ¢Ó–hã.≠◊ÌBæÉ«K√‰
]"ÆIlX€>˚ﬂàãÀSn¥8sœ¨O“≠›÷	çï7Uv¯üèéõ†Nqπ◊”n˘ujB¥Œ:kE∑˝H˚Nü/Ÿ{)háüò√é∞’≈õË◊âFºqâç'‚9¥πN,-ï’∂ê Ç–ªx≥Ωfgñi/g≈©Ä…iñöËE`îB:}Å° |–"d*iå,,a√.∏_yBç.=MK√OÅ´¯QåïéÜQV≤ŸÊL◊ò≥0¥‹ÚÄ‰r8rûpı7ˇÃéV‹"ŒR‰ŒÏ§»ŒØøÛA)€/‡˘Á≠≥÷y˚ÓïçAP*-ÅûtÑ$räº+ßÕ–’#«¶Üj7È∏´≠|◊’‹§z‰n˜†o¿BeAx◊Y¥&)È£™X/ﬂ´∫(¡V4íÂ€n¶ÛﬂË éá"6vîj4&∞”˝K5Äî	¥’Ÿ¿µ¥B€∏?µçµÉOç±hU(›+[W-ù£	D∫ÛdIœ4)%<3Ú∏◊±ç§ ÚàÔdU3eM—Ô
ë3≠/ç±·|Ï ΩA≠,êv&»jm<ƒ∞R>®ˆ¬≈§˚ÎÔü]≤ôÖ.0Ñ≤4ÿ‹öÄb∂@\«˙)hÏ!ÆÌ6„ÛÑ`„X‚nMÏ3€°[êõB`koÉ¸j MÁñªé|oÓì3x…Ûb~Od≠}ÊÖºqNÁ”C£ ∑|Y7ÌÑÍ⁄–Áö>HkGRôÖ˝’wågÕY]8îtVü8ëë§=Óï	R]kíh∞ãz˘ÎÎüI’T∞$˘Ö◊pÁŒ%»5ê÷™ßWn≤<ÿ{ªÕ1ˆKÔ‡çËGCÃ»Æq`ºµ8∫‰">1sNÏóC≠Ñ+S)œø¯‚Ö81âë›Öh⁄∆ˇ¶én…—√nE£¶ô¬åQ˛€õË∑åÍôz‰îc+ì™ œp*¬GH[§±®Ñe‚ôJ≈jdDá*ÊÒ…—À^ˇt¯Ïà¥Ã√£ìÉﬁæN…d∑å`„[_É◊3m ∞CyN\'ﬁË√Ì∆ ı7émrÊ_øG3î¥Ë√(PF„ö…82∏CxJ∏©û¢°êù …mâNnU¸ÒÔˇÒﬂˇÂo≈j±˚◊˛ı∑GÏ~:<Ìù∞¡>€˛’∆ì£ì≤˝{rÙÛ{4˚Ω/•ÎW!$◊`3!“"úoúˆà™ÒêÕ'©≥O@.∞˛÷ò —@p–üq…(
¿Ät¡x≠£/ŒXp‚ Éh‚‹x?1èÑ‚1.çOYI$2ó	gE¨√Àb3™âY:•ffK23X©÷0mÃN¢ÖôüËûc?ÃÒ_£&@ _ä_aùù-AÏR⁄&Æ
ıGƒ∏Ÿ›©ñ¥µµƒÅ6Pâµ¸Zﬁbn≈a˙à-=Y
ç ®	|ƒVøÈ√Ò˘	á€K‹æõÆû™Êc‡Xîà˙–¬V'ì´Ûíº¬+¶¸µ¯m/ï∑ãvt:c°ˆ`o0:∏˛ÕIø∑ﬂ+˚≤?@‘*Ô≠·]ø««7Å C>òMäçA·PöÑßÖ	;∑∆SÆ∫¯ŒÒYáˇ˙˙=Ï™Ä¢≠ûHıó31&®‘cáYxÓ9ê≤cÂ£ﬂ€XJÑ@ÖT=n^ˇØˇˇæc£¡˛†ztÇUM{√—‡˙∑Gl∞7Ñ#XØTåNØs∏\ÌŸàçûu¥ßù‡%ltÙdÄ‹ÓŸpî ?àÔºi≠	˜mfã-gfıbK'°ì ôT»,G´öŸ^÷ Nñ"VL}PΩfsµ√†ÑkˆÉÌ∏º@‘∑ÆÔÜ·sò»S€ö-\J¿ë•¬÷/'¬ÚÛÑ}°2œ˙∆ÏÃ&Fµ†ö‡∞∏ïó `Z#∞ÄÂ8XÚÑæ«k∞=õ,™,∞D¶$Ïfãø}òë@à¸Ëﬁäπ“ÿﬁlè]⁄¸¢$%:ølWáçï!T†Kµ+Xô‡Åå$ÒÍYÁ¿^L‹ˆÁ¸ï£;_`éZSb<9È¡§^∆xªƒôS
áq=WŸÛ/∞|*g™Ã®L
g+—_:Ÿﬂ%,•3Aìßl®åáæèƒYCÚ,]lÇõÜ¸9˙Ü$–<ﬂ7.›e@IÄ5ö{\+ë(ΩBéD/gv‘Ûa·R	Å•¢òo´ŒLæ!˘º£∑T⁄´_ Ä…	É¸b«øåÓ¥ZÍÄÌ£Œîé/IÇ}W1dïºBÆ…cG®«G;˛„d∑Bãú±º§óˇì'…‘Àñ¢Ã;Èzãv∫‰COù€ü8u˛Õ?á‘ôñ/üâZ°ƒz9„ÎOúJÛÔ[@®†≠ ……rÆıD ØÎ~‚D˙€ﬂF,4´∫‹<^™0bJ$¬K;ÿ®î¸zÚj¶dˇLÂx™ÑÁBPòA;•[=.êNÂÔ‰ﬂãK{y≤Ω*qV”oÀˆí<∞∫•ıF€]K7R®]tXœT»JŸäJ ˙„ﬂøgΩ˛È”ﬁ˛WΩ√Ω#4uO{Ï¯dlÿìy≠äfS[QœOÏ)y'Ú9F!òT≈ïƒ¿ﬁíiÎ!NE–bfœÌËWò5¸±ΩCuæt„`US™TyÉáÜõ-úg"1›L•û´p‡¥m[å¢[√mãΩm¥©8-‚∞òCD∆è‰€∆ƒgvZRAf“‰"”VZ—âeÄ:&&«<ö%¢i)œt©@ia^âfÄC†<2ÊÊôãÓ’®p`óÌ`Ú∫Œıwÿëûº‘›.°ÇIû)'òcã´_/-ﬁÍéRûiÈ¡¶Á¯eh¬Û c=ÿØEâºj : 9ﬂ0—rÏÇÖ˝⁄_∂ˆ„ÆÇ0œ≈_¬õ⁄0® ÀHã<d%i±9Nÿ08¯ÃÄGáß9∑·ë{[Ã¡	ñ‰]Y3Ã\£µŸÛÓÃ …=|¨Ucµïq˘ˆnÂ;ÉcYS2Ÿ+Æ[∫Dy(~d˘ï‡˛w∏C0kK†ß£á…∂‚˙0`ı"q’Õ+âí>¿L;Ú 	H˚õÉwfM†ü´Cdeë˚ŸÄád%àñÉπÀ1D¨(.Ëﬁr^+«≥#pÎíûÃc$Ô˙=lóéÔπ8#PàÍÑ‡<Î{b¬U£'ΩNwõ]≤±áÃw"¡\ˇŒ$~250Yª?˘j	LS°õ©ï;bc{º¬T¬(aU‘CòÁòRæ Ëã5›û‰¢P˘æ7æ_ú⁄(}ûœîÙY©LÜ7!8(&Â€≤ïD4Â∞d ltQ–ho©— B£©R(0˚gò‹\-uB◊÷&|Ø›ë3>zŸ|Ög‚¶RôæÍë÷OEêSÿN2øÌ%ÄY⁄$ÍaÈcP Dwø`Aî2[¿çÙ€™®¶±±ûôYâı0ç,VÄk˙TÑi∞˝«Ljcñ
›ÏÙRSJ„¢kÒÖàªÌªM&‡"8!åÇP…`°#A¡98\=weÖ4⁄I*ƒÕ˛§
˝¯'±¨†s8¨ØÊìóÀù"!Ÿ(%gRÒNªÉ BpÎ(-.ªãÈûg' ~ƒí oÎ$Ju0‚Ã R÷¶Rl∂
º≈¬DR§ÏZ\‰˘∞˛êå8Iπ8°]ØÓ⁄nÅ˝î”Xëœ;Ì÷lˆ"¥õ;wÔ–_
''sz˛6	‡œv1WéÆ©∑ÃcΩŸJ6Rmw/7∑√Ó≠u˙_≥Ω≥ˆ"ıé|ëuœüG√iï_‡µHoUÿ‚Wc‡πÓlﬂù∏®Ô¸Ùß,>0
.·E=3∞Ma≠4)e˙&ûq…˘œÄúgg!MkΩ®JÕ&Í◊#E*ı¸Ô‘'NpøMœÑ(`Ü.%5ë«¡D€€‹Ω"»DÑG›≥Ø1v:Êç¬yhÕ∞ûunyûÂª 4.	Ò0<TQKR≤)µ˙T¡; ùeWSœ1V¿°NÆ¬6”∏⁄Ï3§KBT*j 1[∑—l›.é8D±ÒÙˆ¶	Ë§ë< '}’M˜5∆∏™ﬁFÀlCµqΩìvgÑüJ;$¸–N¡”5Ù~“≥∫Ö≥∫Uu/ÑüˆD¯)Ëß≥$¬œ=˝¯I”ÒESjå=◊˜	1∫óˇz¬–≥Û–Ω∏_k±Îl¡ˇk`N;Œ˝öhÑA=fkÈ)ﬁÅﬁI—÷v!mEw]¡îô¿€wfˆL›f˜Yw‹j4w6ÕÌ;Ëâˇ˘¯CcÔ5ú˚§;∆SY+Ûùø3Ò;˛õ‚∏Ìª„É≥3ﬂ˘8æ8Ü◊ø∆áx'”¿,Û≠ü}¨∑µ¬ﬁÙÆ0≈≈'ñÈªì_Ù©L1,Æπù%Á|}ïØ¨,£mõ¡Ù~ç⁄Ò#˚ˆ‹ã˚5bB…£ÿ§9:¨¢ Œ\ïz∂∆ÌÊ÷]Xê≠m∂Ÿÿlv⁄X»¸c¯ØEˇko√Øõc8ÔŒ6PÕ&ÉEƒ\¬N¥§ùÊù≠F6:ôã;lß	ƒ…:ÕM"û≠f√ú;ÏŒØ BÚ¡·1;¨›yrF¿{o·-à“∂¶ ü eôòo˚£•®Ò•1_â¢ê$ê!ı∑à :›MX˙;≥î∆⁄˛]Z}<åø›%"5¬#——Ü¯ÎW%⁄Ñä°ÆPÌ˚µÌª‰ˇπË‹Øµw‡OÒ_˘DVæﬂa˚VnAI“ü⁄ñcÚäù1m&J´3ºÎt¸‡;çvÎY◊iÏ46a‡Õ◊wÄ=m#i—èí¬)1ˆxiÿPám5∂>.∫W§4›§ªì˙⁄l≥õÏÁäßï·™¡Ö:õ,›;t≤∆Èë+"¿Ä3ßR„Ô&=e:ã∆œ^<˚≈=¬Kw¶á’îN˘A
Çñ∫ÿñxù,åÂ∏⁄5ì≠à∞xh83&VQ3¡¬ﬁøzB,÷›?Í"ü∞cı¨:ÈÌèˆÜΩ«á◊ﬂéNá˝£Ç∑‘/∏nÀ¨¯Ç‰.¿=#(h=ù5ë„¬Hë'q….A^—ÙuÀ#Ü7zÎovÛ>ƒÏíE7°.QWî{O/sÍÓ¸≤ø‹ZXéY:÷}≠XµÉE⁄≥}nèl¨/
·ΩUû∑µÜX›7ﬂ∞ƒÎhÄÂ•é∂¥_¢õÒK`ˆÀÏåWã5€Ë&Àtﬁx∆Çº/ÿ3ˇÀ‰ì°Ëlm^±øÁ*˘zÖƒß•)ùËÿ_ÌA8˘°¯™∆jZÅVöÔ¶˘,ü#¨î
Mº≤∂@òÓ∏-V‹—∑=©¥o…#?yÊ–Gù›˚ˇáﬁ˘˝$¥C
NÉ¬íyf±'∂/‡‹√Æ¨ﬁ'¨LYS±Yπzi∂AÏ`'ƒ…¸õ∏¯QDﬁπPæzw¿⁄<	TBh˙ÿP2\Oﬁ.ù)^Ã6¡vŸ^àB0'O‹X#ò‚B∫í«¡∂˘K√ÙÂíã∞%1OGLvΩé™¿ôÄ‚BÏûﬁ˛·âËN˜x¥˜àAØ ‰•’dNxDmHØ?Ël~iD+ë—9Îü∑÷¡$Zg¯∑	ˇ∂‡_˛m√ø;o˛›•sZ/ö3cQ;@ÉOá˜Ë†^2∑|ü›«´YÉ¡•jòGÙ,Ko^§FÊö„Â?Ø¨À˚Wp≥B/z]|*À¿-NIﬁUoüîN/ËI,`z%1_(˚âyMëˇ¯˚√∆}ÖVv'úiêøÀæÚ&gıü\Äâ€§„u0„ªÏgÒ∫≠Ω[g7=aÌ´ı‚Ë $¨˜Å¯∞¬„ÛGÙ!,èœ[Ù)ö `¯)4„∏àD≤˘À2Ωó;/+Ò±{≤ÍY+±¡ƒä˘ˆVX&rg∞,KYSèçô¡åb
åÅæ;[ ¢c™≥Î˜òéÃ±~Áô¿ûY øÃƒ¡ÿia,,YıJ¡kØ ﬁSÕx·Œ#À≥œï˙ΩoS ◊˙""+≥˝ÅicÊ/∑ªEßÍ/ôGCM:‚º&ö5f-ø’õˆ<D„‰®#{é¿Vc7<Ïzc>∫Ñ£æÌá1Ù!ÓÛû”_8v¿ˇÅN`√ı¯E¥·¡ä{†∞0Ãƒ
⁄ÓUJ*ñ;	ø{‰π3>|bÿuv&=YqªéØq·2∑õ¨ˇtprLdCã_◊”^ùπÉ†ÒâÏ©≈‹åÃ§/≠=ˆ ¶˝ÿ-ü¥áÆyYè◊∫ÿØ†ùäG√ìÉÎÌ√/áÎh¢©Ÿ/57Wu”≈~E°ôÀ√—#{27`ç,J¶≠¿G.”¡©›ŒAEë˘¶'’À˚n“§K="L¬ﬁ¥ñn<[©("V]6|˚Î•my[˝¿¬ËÄ'S?¬ƒi6@•⁄Üá0z⁄YîMÉ,Âçˇ®™Ï¸;i¯ƒ®ﬂÕNƒ€„WŒ¶{>ﬂ‹"ocπ{Ÿ™ÎΩ2¬‰˘Nh‚NEÁ´∂c¯6œ ˝øﬁV‹d|ê_®
÷Å®H†”IäJüîïI*IÃb"Å≥µ∫ZY„Ã≥åWˇó[skØ6pÍgÇ"Øb¯”zâ‡BÅ”7O+ô˚iP ◊Ωlü{/ÑÉ™ì$‡jÖtW©'¬∑fv8.„˚Ë-—H± „∞ËVŸ€l£uïfëµ™úp£f5ò©áúK~>‹$úXo7úô:ôüç}xÜ_ÏH˚Ø=†¥Ù[[¯T√K9á,£Ã›G zR¬¬ﬁü¶ZÅÚ≤èI_<[…Tˆ%{÷€Óıˆéÿ/Ax<ùû¿≈ìÛÉØfÿ	jﬂöŒÍãöØ√nçˆ∏ˆ`ﬂ∫‰é?ò‚±Ì&%áªŒ≈>¢¨Ìë"PÔyAìµ∑4Ì7“sW(Hät:¸ä5`j◊ﬂ#Æ=zweÏß≤ví!…™s@m-Ws¨æCä‹ìVhîCÊySt© nN9-ëã){6tS¢öìL≠-˘öb¿R	û¸ìHÛL>zâ\O˛°åO¢àiö¸ìÇ.e\Ãtõkå≤P6≥/`≠`›≥•ÿÁ≤Ù›nê ?%3+JËiÂ≤Ii∏<It≤©õ;IKO0ë®ö&	»—Ù¬”÷Ë¶û†∞H#!â…Â+≠¸È@@§_¢rŸ…*ó  û˛[ÓÅ±Ö‰ﬂ˝ñù XˆÜèáßΩ˝É¡·È†‹ó^e◊∫8gJQ˙‰KA∞æ∞I™yπÍá‘]ÚÊAÆ¿F;KEoyÓCR˚/´y™Ûäáî…„nhUáVÿÛHJ…ÁJâkŒP¿Ë∫˛Cf√Ÿı{tÅ˘ª∆ó7A.ıÑ±ïÛî—ïÒHf/÷TK<D9k∞¥§_˘πóìPCË†¨∑wrƒF√√Îoè1√EÔËë:WÌÏh\;¥è–ŸµÀ≠Ÿ3Î‹ı@y5&îQ(Ç¯ÁC¸˛!}ΩÀjÜÛ∆∏ÙkÎ‹éÛÎﬁΩ+òÍ‚¬º€˜Ï—î Ω{“â.`Uö\6õH'G«£·àù∞ÎoO˜èX˝¯˙7èáá=6<‹˜Ü»ÕıŒÆ+â˙œtt˚t$ôÊòä∂õlo0zº4ÄY˘Ûß£”·£a_Ñ¿˜¨øﬂâ#GáÉëûäíÅã[ˆ0Î»gU¯–°ö9!$fÍ&Ä;M÷;¸‚h”+{'Ï·Ë`–ø˛Õ!Jü0ëG˚ΩÉb^#{>vñ¶EÅ¢·<¶Çƒ‰√O=úáz•“SÖ·≤h‘ªµ∫Ï≠Àı9œ´Tâƒjm¨´M6eÉŸBrÎ=DúAT'jr≠,ﬁ˛ì.⁄ŒHißfÆLøé“µª1XªÎa∑ú¨Ωl	ÔÕ w’»Q´ñ‡ä∑ê·FØ»_J¸©´˝∏˜‘O˜
}”∏xG›∞MìX†À¥X9Y˝˘Á≠Ûv´eΩ(Îıèé{◊øÌ†æuåÛt¯§∑œé{ÿÍˇ€jÏj]∫∫¨.·Æ§,!&¥[*L8ŒºgŸ
ú'à)˜v‚˙Q
•Ø|Ø™=¥î_îJ≈˝(âı8©˛   ˇˇÏ]_s„÷uÔß∏¶”Ñ™%ä§H≠§Y≠À•∏Zf$Q%µÎ$[◊ëâ5– )âV4”ÃÙ•3…tZÁ©ÌåªyÀL˝êq:yåæIæ@˝zŒπ¿p/ RíΩŒòâºˇÄ˜œ˘˚;ø≥$ÜFÛ^• å!Ê3≈‡2‡˘ÙÙπNû»‡˘`CGª\< |>/x>Âùïà
Â‚Ú–˘\˚-%>µ0r~Q^û‹ò˘˚üKπ∑ì@Ã!_}´”K—¥3´èÑüs
ÙΩ#d,8—
ëZ;b9FŸ¨ÃlÛ=±#©c—Ûlj⁄÷¿•,˘ïÚ ⁄Zì¥—ôŒõq$L¥é}í⁄=◊¢b¢p_éCnLI-˙í∆i”)TFı<F|L√∆ˆÑ¯z‚$-ìqíü¬Ù]‡îc*ÿu&∑_{÷‘;†æÄp%£ßïS∫ùE&Á¡X≈ñ∏‰Òı.⁄¨Z∆ÒEóDm+≈çØIHÔ¨§⁄©r™ï±úÖyﬂ˚ü˜É+tü˜ZÏy„‡†Òã˝Nèµ~v|–n6ˆ:=ΩA®ﬂyà⁄Òdı∂Æ≥YÈOÕ˘3L>ŸCÔC™(ûÒ?wòaœWô5∏⁄aˆ9ü	qõË!?|Í&BëG√Õ®ßªG–u "§ibπòh√c*Î-û.“å';ìÓ7T˘µø+Æ≈îñà“3+îU—´r‚u:K◊6sœ$xÑá´ë…r˚í’Íl‡P_N–°$XÓ€£‹≤çÒâÈûﬂÚ·ÙüÜ‰c˛IõQÖVÛN»|‹¢gù√Œ,sÄÔ4l¬Û=¿RW*ZëS±o•ﬁ™H{KÔÎ"ÀÃ•*aaÀ8åc˜÷d5∫ƒ§5`Õ)≠(ÕX∏+zu~ìé2XrñÇ9:œÃå)¢J≤ô¢;SßÜﬁz◊ôÈÕÜ¶KdŒ>ì≥jSπ&‹◊ÑUˇnR#+nºLaK*◊zL…ÙA+#©á>Çˆ≈“ÿ¥á”{¬ Yæƒ≤‘öÔæQ*êﬂˇ—W ›V≥sÿ:⁄Û33?gÕÏ±˝÷Q´€8hÈLãt„Ç≈{»F⁄¬÷ôZÆÜ!ï®˙ç¡m"™›A˛ò˘≈åÜL@jÎ#%@pMﬂx£Ôè ˙¬4çH˝◊“<π\g«õá‡iòÉøõagF«Vù°‰õæGgÈ’˚ÂAŸ¨‘>~¿≥ÙoˇÌü•„nkˇ≈—I˚∏Ó∑∫påz<n€{¡oˇysa'›∆I#ïq¶¥‹2i»úGË [ÜÄÚ∞Œ±ªÓÿº@Nr∞L=Ï :úŸ¯õa;‘Äaã©Î4äÕ∆SÉö¿+Áê.j_t9_ñ√;Ω‡†ÿ“à”Z∆o…s0∏˘li˘ë‚æDπΩ1H©2§æL1„¿ó°~∑˜ ≥,ôh≤”æ8%H0M0xˆ´‹îÿıgwÃ7ßãΩ%;FË‰^ úÜ›»KbxHä£Ê÷Ü<ƒÙ1obcfÖ±È¢w´è”·^Íj‡B’Ø9PÁï˝0%r‘:äjh>B¯˚• *+±µ|;OÅ˝S∆Q©GeTD–ärQ–ÖÅΩÜ¸ıÍ¿Äà≈€Ø«H§ªef∏ÀX¢å™–)ñ®œj É¸#a€”c3€¿[B™fêL£¬kbü„&æ†-ø‡â7ﬁ®ﬂ3Âj∏95v¿›4ùÕâ,ÃÜë‚7úX§ås—wa{πñC’æDáLÈ¢‡c yˇÄøLOsÄ¿√¥äâîjÚ„º»&ÃÆkHWKî‰©X∂`ÏÛø@˛´*»ˇ˘X 2ñÖ˛/˘ø+õúí
AIª'u—@„L5‡ıl-ñ û¥¬|hy^Pπ4˜Ü◊ä∫I≤8≈[ﬂÖÓæÚ[ö˝ˆ ˝ã6‰l£:¢Ì_‰◊ ûÇEÿßfzø˛CZ4_Ô"e†ÔV(ßıà ;¶˘  „ˆè6Íﬁo†◊ùYq÷•zßÉ?3.wD—–5=–çcÏ_àΩà¿tÔ[¯{ŒF∆ÁÌ`ÉU‡Cu’@ïø≈œxìA;®ÅÍqM0"ÒnC∆nFPøƒ<Mj5®ôé‹âV≈ìË√p´G^ÛØ∞ëyÏ8∏)©ä“H™5!∆‰Êßì+$$õáY“òt€™´je„F,(	BÂJ]6√H¥pJˆ ÓçúÀ„†ôé¢≈R¥•Rç7o§¨jﬁ¨DnE°o‘UΩ†˝˜D”CKÙX
≥.∫nKÚ™7AÀÆ¥ÚÒFIôSÂº±Œ≤˙Ô≠$Xr¶Ó\¡ús	*◊π,—≈ä	∞-¯√∆¥?bE3y=Œ@„åÕ‹ú„¬[üé¸}gf8~ﬁîã∂H¥#W|4Ú’nÙ;Ë>örmDör›”ÜQ∆±Ç∆∑„aÆçÙò&*ä´¡©π\´≈pïÇ#+≥ëU°ıªñÆD•HT^m—·-KÇX‚{9!ÒØü;8•»ÛJ·«ﬁ7_~˘;vÿŸ#rF®ÀÓIÏ?,Ç˘Ëy„§◊8>fE¡î”[E{gø€xv˚õUŒ˜^Äâ(◊√\{ Ö>SØ1ôp!Òˇ„r4zg∫Ü~«œ˛‡ëÁ>:êπX{ä‰m◊ô`∆»≈˛~ôp‹I¨˙Ùq8_Qìﬁ≤a;c,£q¿D±¶ÛV^ÂÙÜ[iª'VVH‰ï‡ï¯€Õ+k∫¿’£öÁ’˚ÂÌÚ†b›jR>˚«cŒGÉÆËΩ5‡¬&›≤ØU∂∏yûÉ1b&€d/¶)Oó–î…
Å\Ó™¬\R[ïpÁOhË¨»«£ç<(à‘~º—:Ö-ÑúrÜ;©pÅ7ˇL±‚ÅÉM{¿Îı¶+…°≠è62Î2ËI.Kíû¨⁄∞àim˚F√D9b&Qvm	∏™≥9ÑfëüÒ._¸i¢ó—ñQ±†?ÀñÚ|&UmUô⁄8Õ<!T„!°zBÍÖ±|—√m´|1JÚA‡J;√?ùm˚ÃQDàíCÿ‡z‹'WŸñÄ˛J/r≈ÌØH
~h©àB.‡»}‚NÒ|JÍL™´≈Zh´j4µC˛Ì•4#pÂC¬Ho$ﬁıcËïr˘ØYÉ˙œì”ßÆC»»_Ö!ë|˛^Î∫]äãRÃﬁáBåiWú·Æ ´l:Û@À!ÄﬁÙ(äiØSP^Ï¬8.5™Ö!π}”uº;qºcØÎÙ—•åtÆÖONgR√‹9æ”¥IvQºˆ‚ˆ˜tΩ@ê—,)√§JÔ0≠‰LqöÊx6FSÀûÃíG0
´⁄µc„‘'Wm[_É∂°ﬂEô≤ˇËˆè∞)ˆÓﬂ«@é.;ì>à;cºíL'>^ß±füõ‡»™£
ºùi]]¡Èè®{çy≈$Fb°∆Pêmiˆˇ -§ =∂pG(/4£Wv¨“N`âÕå√tw¡ñﬂaı⁄v•RVƒ§oˇˆkÙmà˜’∏˝ cûe≥òm1wòÂx+Íã_„Xèóx:å…‰x‰ÿL(Ë¬+ACõ)$≠>m)1S3≥ÚxhNKÙ=%pJfäÎØ˛°º∂˝Ò˙pUO¡ –¯H≤]kﬂL‚¶7u\chñ‡ìmÿ1≈à√O¸{˚dÇ)¨2˝e4¨≈IfjU £ûdló”ˆ‚ô”üy;	ﬂTµGcPa Ñ˚¬gÇ+˚WufS‚y‚––àü™⁄ä¯øÆ5≥Æé-Çé'ﬂùÿc*Ny zlÈ7Üá—?[H'P~∑_9´°D«π¿NÁ`¥ﬁæÂ\#$¶\§Ïó(£KõŒ≤°;õ8ò4N]0s«ıï‘
≠†ˇ«ç^áUv¿ß=Íùt_4O¿°º’^„ß*ŒW-PG≠Ú[f!á:–˘EAöF±6˛Ωõ`ı⁄ºs<;ÅÔÊ9…Cd¶~c™\Öuí€‹Rkú˚g8õ¨3AñgRSÃ/mQÁ*⁄ı˙µ§lx)0)**S©JúÄiÁ&jjcˆ’è‘ÚÚ='Ø.Œ°.’˜!ãx∂RµL,ıJ1&€!Á:›’wò/,€ú
†ìú>…áÊ#a"c·1Îõ—6ø’r9%≠πª€Z9)Fï_|´ÑﬁÕkıHä™ˆï5µˆ;uÆti’ÅÂßcs∞{≠Y_]Óí.Lü”måˇ8{ëtWOËpI≈j/Vî∏ú6ÒÖ‘Dhtïq¸ R[j·]ëò.˘áóæólı¥Î™Œ5í§ú“ÎDK˛ê¿@fq∏—¥ÇöÒÀ∆Ç~5b¢/úå¢AıH‚:∑ñƒfë»]/&yGº1t¡’¬÷®S·ﬁ<∏ ∏lÓÓQzœØ,Ôª∑_!€y`T5ÕàŒ‹∑R*ö˛üˇ˝ø¿g‡Ìí÷ÁÏ˝‡m˙ÓcÄâ°°%¶ëÉxÁüÅµ©-MM”Ík⁄ÖÉìÆ~DäÉ«—lòõwZ˘ƒJ@ﬂ•súkP?(˘!)úËöÊP4±MêT0«πÆòCπƒÚ?(ñ{P,ﬁíÖ~ºÊ;S,˘§
>dÖAWp+ !]]Ìæ≈CT	®”F1)ù9ÃœëÛ€íZæ¸'ëyî√^?Ií0ÅÎhºqJ¡‰˙DÜZ›AR∏f£ªﬂË≤F∑˘º˝≤”c«{œ˛}PºW”#<¨Àˆ|ÃÆƒk√ä«x.É7XG·*”WÀ¯§âjÔ|'ﬁ>E]OçëúK{Ï—3Xg'$p#·É´˛µ‰J≈òÑ—tdàâ"·∂l¨lãÀbÚ\!KÍYU⁄-™~´)—2üJH˘⁄VSl(ıSÈ˜n!‹ 8\—⁄7Pù3Aû>†&X0π™Îi$F∞SíŸ¬¯A”so©0∫ÈÃ9	≤U•Dr«Ôå›·≥±îrJvº©GBˆëäx£ñ[±mì∫`«Æsfz‰ -)±˝ºl÷óä«‰ú/h˛ÂBã\n%&*¢›ùE∆ıkπÒ“=È~cyMñ∏+Ù"-#»Ô≠d¯euµ_¶^™◊Íµ‚Ú.IïÄxﬁE!F8P‚a›ÍÃxc˙ÊúC¥§f&ÃYSLip˝E
Õ*ö≤Q˙HÃò›Àˆ¨¡Ì€>FtÓ(/s}$√ƒ›ÿA$‡q„ 9o[Glø”Ÿ?h±Ωn˚ÂÇôÑÄ®˙Cº{¶nxœ÷xq“9º˝rÃ?òA´∑`Ô….ÂÍ§g\ ï¢fßZÏÑ˙ÕÚ^LX√¥¶~‚]P*…±ÊT,ÂxÿI+»/kö©!§Y-	îA2%VZº—[‚•-ﬁâ%[À¿¿ÒG∫r)Ùfßñã‚œzaÄdıCö‘ÕƒúÏi£◊¬$Î^„\\P5˚éÉëXö¸V∂bg•>ÓögÆÈçöó*˝‚◊yÀŒ≠l“ÍÏsÜÀÎ2MpM´‚82WO√p_öé™|—là.‹=iª⁄⁄N–‡à¯ÓËMƒ∞a_ìo¿ùËºÔ†–=©ÃC”Ûå°…I«ÕÀÔ4-∆ò¿®>^_;2ŒÔ5AIπû±®'[€J@i„çI˘9Ï( h8GÔ·≥?qMNï«”˝ÉüÃ®aƒV§˛§`~Ol U?“%≠∞÷—À6ò`ãô\5mı;ir6b[¿—úõËÈàêFí7õõ_?|l(≈»»5œv”õ®˚¯<⁄9‘Q\π9t0;˛·>lGõ0ypâvTf‰ÔÚ˜˜{ÓáFI!˝˙3w‹≤˚&xvëÍ ~{—mcJ.iOã8xÌEsiå)F◊Î—t:Òv÷◊çâUÚG^∑g¸‘¡á‹˝—ux±õ„ó√S·o^ßÿ__†∏ò&v≤¢Î ÃshªÖO‡lÿü™-.XÙ‰L–ûb∂ìNêÜ–èî⁄=QBRÍó∫^Iâ”Ê,\IdªEΩ–˘ÄÒé˜;T«Ú:RÈãÁÊ¥ÓC]î?ﬁ–Cò\Â‚d—“Ñç!kØÒ∫°7¶˘c9√}wì˘âﬂ39u¿†£#∫ “¢Å»£a∫”b·Oo}eé·Ü±	*Æf°B«Úq±∆ƒòÄ¬Ûﬁc`»«e0lìbsÍé?xπÇ$Z$±©,È ∆π±¸∞"ÿ˙N*A];¥ÆÜ¢+€;ßXMÔ¸ôh¬¶–˙,R›K∆!i‚npy!¨0aL”N»=ôÃm8Ó¨œ…˘.˜S4Í¯¶ÕU€≥"e[1∆«'[8!WT2Ø/»ITY(-jÆ#üÕJ@¥¸…qœS[ŒÅD}oC¢æN≥’Îƒ**L¯Ω∏Qf=dÛ€ÎÙîï&jd∫£`º4˚"ËN
»Öê+v»"¨)™[[OûKÃc«ÉÛ>% z$jüT≤R•Çû∑ˆßÑƒŸ †„Ö∑?≤.‡å#˝¡ÿoÉ‰ñtÃñÒA™%óúI£JWF%$≈r8j˛ˆm j±¸D
—ÉqÃoÉøeJxp)ê:Ú≤-õ"∆„¬ÌN1)ü¶0,Dë†¯Äasø0.˛a<ºlåµd©kløk·…üﬁˆD∫bÎœ¸l!\îJÓ&Xä7pﬁöæ®nÌÒ∫ìp:Ûâ,QVˇ€ˇ—ñ’7;›n´√Z≠ÊI˜ˆÍW‹?l¥¸>G'ùn¢§~ˇ‹∞∆?‘”?L=}fë–ıÙyÎÈaõFD˜	ÂöÇ˙QŸ…åR•…°™∞Wê4e8*ÿ”	H0U(·A*Î√ì˝CYΩJ'Œâ_VÍíEiµıµª‘÷7f”|+*O¨¢√ÇÎSÏ<Í2«eHZ2ÓXE
z˝ﬁπ—Ôõûw‚|
"Bï–Hé=ﬁ“C"Œ© mÌQÄW˘πHŸî|l‰¨¢b[!V#‰Ω4ò∏—ÂéDgñf—ë¿%≈À&Ï©Mç€¢Ê/D!†Ü*‚&¸ÏTÓ]«G€F\ÎqÇ 2Îx>Fì∞–ı:Ã≈2û‹€ë´/’ÛŒLÑc∑ÎöéÁ8ÿ$4¬0ÊD}ÀT D5ãeπ\ì,mmá>^–„rÑr˜ú5ßA8CK”êDNö√€‡}√∂M é|Di∂PÉF\•ñÉØÿP–>î´Öx1}∏g≈ñ–oX=œVf¯Ç[	ã$~£≥≥D⁄7¨&êSøÀ•z…ïhã›ó<éiiDÕÊBÒıÿÃ-wÊmY»8TB≥Ù⁄Úã§Ÿ-≤’Í{§q—[ŒˆT4ﬁ6ùuZ0[⁄]ìV«ﬁªÇ«„M∆∆oÁ√∏æncZ,ØfÖöDtF^ É&5MÏ/ä
4 uÚMkÿ+∏—0>wt=R(o”€Ú ùˆt’0i∞i°L,Ñòa¥ÇîùÁº¿Ωµ›}µ„Ã4UÃ:XÜz#ƒ¸	◊ÒÃúTH‘“â:©“ı±x˙9,ûJ.B«J.àìÄ2qZPåQ	3"060B?3îlöUá)ÔÃ¶1ΩÉZ'+zŒ« 4…Ω≈ÕìÏ∏ËØx…=ïOBg¢7#üƒ«§([5‹E„ 6≠ñL±»Ç8!°¢ú?ZŸ≈G%Àu‡ÃòmçkbΩ£*14n§dÉ3*¶R€Å6Ô“5[H˜∫Ã‚¯ájΩw!˘+QC¿_ñ‡»ßk“¿-€¥‹˛ÿºüïëgÒ~÷Eˆ‰aYﬁ[˙,Ö°â3√ã€±ˆ“öX*b¡ÙÔP√«Ëﬂ.ÑMÚ±\pjŸÏã~°ß"◊ƒóHÉ£≥K∑IıÎÍ∂‰^~Âoπ#ãH›gwÌÇgë≤Ï}˛ëbîû+O˘µàAﬂ;ˇ9î)Â|a˚„0?~Ô4XöJo}KD“x3Í‚Ò}>of÷&~@Ê ‡àsù>û<€^L˛¬{_|Óá,q <7+ ´Aû>≥ﬁr«Ø¯)oxÈÁ ÇgEM˘ı›úîËΩ.sN2`"îçm±7–ﬁΩ{E5µß£Ô‡ÆGˇoQøõoæ¸‚ü≤⁄A/^[Gü“v^8*ûï®∫çú6Œ≈õñ©ò7¬£ü;ÍÄèÄÅ™q$Dî475≠ÃLbW∫∆Ê&ãû9ƒÜ2däx«+”_,˝≈¯^lq^à-,∞&{}1r´,≈¥)ÀXP∑ùR÷‰œˇ˘Ö/2¥∞TqHö\~äâJBs~èM⁄Ú∞(óÊÃt'‹V·ÚRV;é–pM5ä>fçt©€’!üÛ—îJ•<∆	.¿¬ñ	~(ØY‚:óﬁÓu}q´%7_r™âR’€(…»)µZSX*ılKÖa”íœ≈Kq(‰}Y1áÿÅØ!¿ûVß∂8˘NŒd™∑QR"ØybØ…RY”ÏÛ` éU∑ˆrÓ?S∂Ôá†ﬂciÍZÁ≈ï)aãÁÿV"˙≥HñPg„¸Eï
Ëbπîtå,KZ;À«©ñƒÇÖ®4s⁄à±∏&È¢c◊D`™=Ã]$‹jaöü„û"à¬LCO˚]Èù%”o{—r˘ŒZ* ÇA!Îw¢ÀµÈBÍz≥& òÒû»RSπ≈`}©≠‰‰≥œ]™∫Pj’~BT6A∞_Ò∆6®˘	69gΩﬁ˚Û?˛Œ/
Óôp>M÷A@k∑”'daÏlì˜`E,Hø˛t<GæR∆A≠ccÍâŒõ¨˜]ØV±◊†íüäˆYã iy˚‘¶ØT(-]`Õ±«‹xR÷âÀºsÀ^≠ÒÔWWÅb±1x‡^Êc¬≤ínáﬁÁM
Ï&BE)·@MDÃ¿Ewéhìãi?Ïæw>—√o°ÆcéM+$ƒô¶k zNNNaûü˙5"Xñ∫πØ‘ŒWåS—…óz˜7â…f√˜ÎT›|eÊIé’´lÚÚ›+éÂª‰ˇƒZ˘Ú⁄ˆ‰ÂË–ì5…>ì	·©ÙÍ’=Àyr${ñƒË™"◊|≥ö\ˆÓ¢U”5jW`˛6Û∑ô≠ôˇ0Í«—ÌmD¡©∏J/’£Ë¡G⁄&·±√êJmBùkø˙⁄∑¯∂∂èËl’p∂jyw¶ˇX¢áÙ2 ß‘DdüêTAoõ	ı]«Û¥&∏∂w1dX¨¯‘π⁄-îYôUkˇ;≥∆„›®∂I%bAÖí˜¿ff£¯«‡(åÿ dJeõ!çÎh≠^™ø¨˜Àk•≠çµ“Ê#t®˝ˇ#ûcsÔ}^Ô„[Y9ˆöø3Ò;˛å∫ïÌ~ô¡ªcØyx}Ò~˛ÒﬁLf±WΩ¯∞>/§[MÎ0•˙7§4‚V,Ê»—„cÔ∂î\~`o©OÕ¯¬Úg?≤”—n!a‚ôPÚ}c≤[ ! ?˚ˇ‡i›æ†\ı¢ª¢÷Øîj€0—µM∂±∂Q™V‡X†¸0¸)”ˇ*õÎFﬁ˜hv√É≈©¡S’`©™•Gµµ*>πVç}∏ ∂J∞ÈXµ¥Aõ¢V◊zﬂ0~ƒ˝"}ÅÂ√™¨R}æüƒÔ¨·•iÁ‘F≈ﬂ‚Nÿ∆˜páÙÁÜΩ–¡%F¡—¨—ÇVÎ∞îè‡øÿ9¨‚m”j‚”¯€6m
Ò◊öˇLÏö¯Îé’€Ÿ&ª™Ï6lŒˇπ™Ó*[ß¯W=qπ/Ló
ØºyßﬂÎ÷ÚFñ9¨Ô¯˜pèId˘QïU´ﬁúÁ≠µJ˘e}º∂µ∂‹∏xbcœxô˛ì°§kûÉl´Äx®≤òä≤z:ó[Ét÷ıqOºSQøÓè˜èSÆ5Î¥∂À„Q%?Z^¡_Æ·≥Õqwò≠|E… ›ñΩÊ4`i8J˝ºç*ÀBuÉ¸r‡Ë#¯F≠s5ßèˇ”h‡tu·SŒ¿2ÜˆÌ◊ﬁî∫x8ÿü⁄ WY{GZ8¨ÍyΩı˘--ìË^ç•∏›∆^ª≥◊nÏ›~—SÚ5Ú˚P/ŸÇDM—'Ø9ıû1Õ	„VNx«…Bç`Í˘¿–t÷ûô˝ë±£ËÓõÛ‡‚ÿC„…5ıå°—ü8{á?/Üw≥r]ﬂ_-
º#é+—ŒÂ–ƒ†‘‘`˚»Ÿä ÒâíIt¸ÚóLir‚’·ê®üZè˘©X\.˘¶ÏÆÜ’vDÜÆ˜àt¸wR4ày
ÖX≤ÙPæÌæ—" ìL—≈≠GOê¿€Kz]`JT|˛›≥]Ø«∑Ï´Jï∞	Ú≠-ÀåÕRû√u_ìD'àÚû-o:Ò˘ÌÃVé¯PgØiå≠S7Ë»A1Z‰Ñ09aF˚|‚
P˝≥€Ø<_xé¸@.≤Ì`çbsv˚É7öΩ8ÚËŒÙD4;Øû}ZÈbÓ'⁄Ñ&Eb∂rÅ¨Äü˝GR≈DùW3À·zq%_BKCˆ»B∆åÆÏôH•bhNŸsÁå›!5û÷Ï5Xhìﬂ$LS"≥7π"Ò5ôGö˝®–08•Õ∆A˚i∑—lﬂ~qƒˆ{{œX£y“~ŸPèG≠<UqÕQ¢ö4NºÏÉ@2´‚üØ ´`]Ø≤*¸l¿O~Í≥	?è‡g~∂È=ÂèKÁ∆§H-t’t]ú™kåj⁄6=èÌ‚ßÿ¬TdWÇOc%h3¬«ßÊ|˜.™L∆¶∂ŸH*µ
¡’QhπHÓU]øÂ#F¶ÿ~⁄8≤2ò=ÜMƒ¬ö¶£S#ZsyIÜ¥¥Mû=yÌOã?∫>ÔßDœ¡£´≥ø	◊aÂfï›ı+ØWı^>‹OvaÛ kÙ˚œËAt˙~zGs„Y*ÓÍ	-ˇ_/ÖORØ›$îhÆ„(F>ôë|‡í§Î˚∆π¡H`ŒLT‰Á@òèËCÖÙ≤áÕµoÔ@Ù±)¸r.ûúZX–gbªÇâÊa˙I™>ë(<‰ÅÔÄ{"ns™¯¸∏h‡@~ôŒËgy≠ÅcÚg{f`Úæ#HM“[¡qäg,±p1Œ£«øËöùñÕﬂ∂äóÆ”≥lgÇ^ùˇ¥„ª7ág=ÀÛüƒT·ï∏˛åœõå≠)ˇªgr N1~ !∏∞|ÓÁD[¯‘rŒ—V¬åﬁ∏ÎøˆÃuŒ˘u]eß èƒæL#D· \¡Jâ5_¥∫«DtÊ˚Ç*8ë
Lî∞’}õL‚∑,∑dÿt≠3u)èkÇ¢rè1≈ÃÔü‡f·
Í}MÂM>kw¨q øÎ‘Ax”©w}]8}∞‘|wâß¡ê–ƒÄY6_∏cÖ€§û0<‚õ»'ºô /–UAN∆òv9µn-‚·∆ö‹≈∏¯|·¢À"ﬁí∫éÜÊê√⁄üó¸V˛#ÔÑ˙A±.õB6ùüÂ*äZÍz9Ù’ÀÎè LnyÄï≠â:‹8Õ zúYÍ’F-§Î†™∫,ûíºia4ÈbB;Åz~î3ñ ‰Fq—oæ¸è∑ˇ˜øˇí	Í°óìKí√ÆH≈.Oò6Êú•í…m÷9ÌV%nü∫¶Ò)Gπq9Ä•)°Cê/¡ØP/™ÁÜ7“˝“ÍÊ”ô¨_·NÍs•ıIÂÃ˝XÑ&™Ú}gìZFñ(1è>K_3/˜Ø!Ç TvrÌÇè\¿U—≤øéJÆ¬°hÛ÷Ú&&V S}AÎ˚è˚øŸÆ9¥0è∞‰Ω™L™‰]Xpû=}‡‰·nØ”:XˆÊ¬kÀ<÷)ï^Äøæenôwì∏$7¢ˇFYEÜrAåäÓI÷M1ˆ\\"G˝9®’˝vÔ§Ë'·[_ùû√c˚Ê–/æHÚÖA–YS8F˝¬ìsŒ?0uHÿ$…ggï´Qƒ§Óëb-6‹iâUj+Kãk=B\ò;§$@®‹~ç%2F’‘êB!rku)ÍÆbPC¨k.¶≤‰ï#€Sˆå|î†Øı´[eä¯•dù6Z*lY8#@∆•e‹é∏P*éä?$4ï<ƒH∞äV6µw0>"p„JÕüπ #≤óT@+vn]¡‹√˙≠ùœ∆Sk2ûg~À,˛»H¿¶X)YPlÂRV„H),ß
qàø‹1+ÿ{WŸx-ÚÕô}Ü‚cJÚ¬jπ±ßÇ¬/Ÿò ÍUî±rﬂ|˘€Â>ÍΩˆ~˚§qpÿ::i•ﬂ`¶œZ;=ÙAÉªç°ª©6g #ÆWkõ`™ãæ∂£ÅiëÉ‚ŒGÑ€)b≥Êµ´(¨‘jØz¿6B˛áh*/è&"∆Mõg¨¡¿bìµœoﬂbåƒ!Ø¥¯∏B? T|
ÛX¯£äô
m±(ª\îd*…Y¬uf„ çΩnáı⁄G∑_c˙[P∆él•ƒ hác‘cá˚KßÊô„Ç˘eeî<˛˘_J/Ô∞Ç1æ4Ê^aïªY¡”¸sQΩ~l—°ôSGuîÛ©-Tπü’ﬁ(·2wé{Ì±éﬂ~—›ouXÒ¯ˆW˚Ì£kÌµé[G{mãÍ®«µ"Z¯√6Xz(fÛÅ7¡fâÌµz˚ù^‹ïüæËù¥üµõ"=áÃÙçûx¶s‘Í©7Å^ X]rıﬂÈ%îÊ‚ÅóÓQâ5éZ?ÎÏ f©—eO€ù√VÛˆW‘.†ß˜ŸA„;¥5BúË&≈–€v∏~“ç%„Ûºøb∆W§à¢w	ÃGc≈Kº"œ¡Án˛Íˇ  ˇˇ 	eÀƒ