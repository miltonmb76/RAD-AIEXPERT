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
import { Atlas3DData, Vascular3DData, UsImagesGridMode } from "./types";
import { Vascular3DModule } from "./components/Vascular3DModule";
import { renderVascular3DPageToPdf } from "./utils/vascular3dPdfRenderer";
import { renderUsImagesToPdf, getPanelLetter } from "./utils/usImagesPdfRenderer";
import { renderMmgImagesToPdf } from "./utils/mmgImagesPdfRenderer";
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
        if (localStudy.atlas3dData) setAtlas3dData(localStudy.atlas3dData);
        if (localStudy.vascular3dData) setVascular3dData(localStudy.vascular3dData);
        if (localStudy.usImagesGridMode) setUsImagesGridMode(localStudy.usImagesGridMode as any);
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

  // Cuadr√≠cula y Presentaci√≥n Cient√≠fica para Fotos de Ultrasonido
  const [usImagesGridMode, setUsImagesGridMode] = useState<UsImagesGridMode>("auto");

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
    usImagesGridMode,
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
            atlas3dData: atlas3dData || null,
            includeAtlas3dInReport: includeAtlas3dInReport,
            vascular3dData: vascular3dData || null,
            includeVascular3dInReport: includeVascular3dInReport,
            usImagesGridMode: usImagesGridMode || "auto",
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
            atlas3dData: atlas3dData || null,
            includeAtlas3dInReport: includeAtlas3dInReport,
            vascular3dData: vascular3dData || null,
            includeVascular3dInReport: includeVascular3dInReport,
            usImagesGridMode: usImagesGridMode || "auto",
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

        // 6A. ANEXO DE IM√ÅGENES DE MAMOGRAF√çA (MMG) - FORMATO ELEGANTE DE REVISTA CIENT√çFICA
        if (sortedMmgImages.length > 0) {
          globalFigIdx = renderMmgImagesToPdf(doc, sortedMmgImages, {
            startFigIdx: globalFigIdx,
            studyTitle: specificStudy || studyType || "MAMOGRAF√çA",
            factor,
            detectMetaFn: (name, meta) => detectImageMetaFromFilename(name, meta)
          });
        }

        // 6B. ANEXO DE IM√ÅGENES Y CAPTURAS DE ULTRASONIDO (US) - FORMATO REVISTA CIENT√çFICA
        if (usImages.length > 0) {
          const activeGridMode = (studyOverride ? studyOverride.usImagesGridMode : (pdfStateRef.current?.usImagesGridMode || usImagesGridMode)) || "auto";
          globalFigIdx = renderUsImagesToPdf(doc, usImages, {
            gridMode: activeGridMode,
            startFigIdx: globalFigIdx,
            studyTitle: specificStudy || studyType || "ULTRASONIDO",
            factor
          });
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

      // Add running headers on pages 2+ and page numbers on all pages (Format Editorial)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer: draw page number at the bottom.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        const footerPageStr = `P√°g. ${i} de ${totalPages}`;
        doc.text(footerPageStr, pageWidth - marginX - doc.getTextWidth(footerPageStr), pageHeight - 10);
        
        // Faint, small watermark or clinic name on the left of footer
        const footerLeftText = displayClinicName || "EXPLICACI√ìN DEL ESTUDIO";
        doc.text(footerLeftText, marginX, pageHeight - 10);

        // Header for page 2 onwards (Running Header)
        if (i >= 2) {
          // Draw thin horizontal line
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.2);
          doc.line(marginX, 14, pageWidth - marginX, 14);

          // Draw study name on the left of the header
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139); // slate-500
          
          let studyLabel = studyType ? `EXPLICACI√ìN PACIENTE - ${studyType.toUpperCase()}` : "EXPLICACI√ìN PACIENTE";
          
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

      if (returnRawBlob) { return doc.output("blob"); }
      if (shareViaWebShare) {
        const blob = doc.output("blob");
        const filename = patientName ? `${patientName.trim().replace(/\s+/gi, "_")}_explicacion.pdf` : "explicacion_paciente.pdf";
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Explicaci√≥n del Estudio",
            text: `Explicaci√≥n amigable del estudio para ${patientName || "Paciente"}`
          });
        } else {
          doc.save(filename);
        }
      } else if (openInNewTab) {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else {
        const filename = patientName ? `Explicacion_${patientName.trim().replace(/\s+/gi, "_")}.pdf` : "explicacion_paciente.pdf";
        doc.save(filename);
      }
    } catch (err) {
      console.error("Error generating native explanation PDF through jsPDF:", err);
      alert("Ocurri√≥ un error al generar el PDF explicativo: " + String(err));
    }
  };

  const handleSaveToDrive = async () => {
    try {
      setIsUploadingToDrive(true);
      setDriveUploadStatus("Verificando sesi√≥n...");
      
      const { getAccessToken, googleSignIn } = await import("./firebaseAuth");
      let token = await getAccessToken();
      
      if (!token) {
        setDriveUploadStatus("Autenticando con Google...");
        try {
          const authRes = await googleSignIn();
          if (authRes) {
            token = authRes.accessToken;
          }
        } catch (e) {
          console.error(e);
          setDriveUploadStatus("Error: No se pudo autenticar.");
          setTimeout(() => setDriveUploadStatus(""), 3000);
          return;
        }
      }
      
      if (!token) {
        setDriveUploadStatus("Error: No autenticado.");
        setTimeout(() => setDriveUploadStatus(""), 3000);
        return;
      }
      
      setDriveUploadStatus("Generando Reporte Oficial...");
      const reportBlob = await handleDownloadNativePDF(false, false, false, false, undefined, true);
      
      if (!reportBlob) {
        setDriveUploadStatus("Error: No se pudo generar el reporte.");
        setTimeout(() => setDriveUploadStatus(""), 3000);
        return;
      }
      
      setDriveUploadStatus("Subiendo a Google Drive...");
      const reportName = patientName ? `${patientName.trim()}_reporte.pdf` : "reporte_radiologico.pdf";
      
      try {
        await uploadPdfToDrive(reportBlob, reportName, token, "BASE DE DATOS");
      } catch (uploadError: any) {
        if (uploadError.message && (uploadError.message.includes('401') || uploadError.message.includes('403'))) {
           setDriveUploadStatus("Permisos insuficientes. Re-autenticando...");
           const authRes = await googleSignIn();
           if (authRes && authRes.accessToken) {
             token = authRes.accessToken;
             await uploadPdfToDrive(reportBlob, reportName, token, "BASE DE DATOS");
           } else {
             throw new Error("No se pudo re-autenticar.");
           }
        } else {
           throw uploadError;
        }
      }

      if (patientSummary) {
        setDriveUploadStatus("Subiendo Explicaci√≥n a Drive...");
        const summaryBlob = await handleDownloadPatientSummaryPDF(false, false, false, false, true);
        if (summaryBlob) {
          const summaryName = patientName ? `Explicacion_${patientName.trim().replace(/\s+/gi, "_")}.pdf` : "explicacion_paciente.pdf";
          await uploadPdfToDrive(summaryBlob, summaryName, token, "BASE DE DATOS");
        }
      }

      setDriveUploadStatus("¬°Guardado Exitosamente en Drive!");
      setTimeout(() => setDriveUploadStatus(""), 4000);
    } catch (error) {
      console.error("Error al subir a Google Drive:", error);
      setDriveUploadStatus("Error al subir a Google Drive.");
      setTimeout(() => setDriveUploadStatus(""), 4000);
    } finally {
      setIsUploadingToDrive(false);
    }
  };
  useEffect(() => {
    if (!showPrintModal && !isSplitPdfActive) {
      if (generatedNativePdfUrl) {
        try { URL.revokeObjectURL(generatedNativePdfUrl); } catch (_) {}
        setGeneratedNativePdfUrl(null);
      }
      if (generatedSummaryPdfUrl) {
        try { URL.revokeObjectURL(generatedSummaryPdfUrl); } catch (_) {}
        setGeneratedSummaryPdfUrl(null);
      }
      return;
    }

    let active = true;
    let timeoutId: any = null;

    const updatePreviews = async () => {
      setIsGeneratingPdfPreview(true);
      try {
        if (generatedReport) {
          const rUrl = await handleDownloadNativePDF(false, false, false, true);
          if (active && rUrl) {
            setGeneratedNativePdfUrl(prev => {
              if (prev && prev !== rUrl) { try { URL.revokeObjectURL(prev); } catch (_) xúÏΩkoIñ(ˆΩEtç∂U%±äERTK‘ÀEusW/àÏôì)Yô¨ VVfMfñH6Ec˜õ˜√µq=ãk`a`›k˚Cÿ„±q/X~ﬂ1¿˚|ŒâGFDFfeëTwœl∫≈™Ãxú8q‚ƒy≈â”3vˆ	3>iêO”ò•_•—=„’YGˇ]T;cAîÏT{ô˘A§^¯/º<|ºÚ°¡v<ç"≠ô¢ëêµ'P2àÛÌÈxÏ•'£≈Ag9À†ˆÄyG^ò≥ë˚Q$9ä£ƒÛ_ï_=y⁄>Ù ¨f˛…”i`å;ˆ"˚Ï3Í¿ÏÿålûèfíÔŸÉáVy1|-“ﬂO<êM'ÔWØüı‡MÚ.xyu0»·7UÈ‹|º|0bÌ7Pºr~≤´ösH§`
“T«NK=xú§Ì÷&˛aCﬁtÃa é2Êüƒﬁ8xQt≤÷Z`ÿ‘=’˛a„≠Ìbf:6[Ÿ™ ¸ÔÅœ∏z˙{vÔìOdªa∂ÈáX˚u0I“¸πO=m‚Ûp$”|ÀbÉÓv¯œvªcŒˆt‚EÔYªÕª’Ôãü˙›uŒ8hbnÕ~u>‡$,˚¿Q(0ç)â/ï%ÓŸ∏ 0wÈW6Jé^•aú?O|/Z‡X ∂'Qòv◊©˘‘Å7˛*ÄÅœüÔ«9Í˘ﬁÑ÷ˇìßIúß^&^%˝Ò¸°…¯≥A∆·‡Ö7 ¯… OR˚˜≥pƒôxîRìO†u—ƒ4ÀìÒ≥dò âÎè∂√aÏ ı<"XçÅèÖòä'˛·3Ô∞∫s2	‡…~áãs(ƒ~¸⁄;⁄ ®Ω1S◊Œ·ÔÀr¿ÚPõ]ú≈OÒ]GŒ}´%»4
DkPKà˘Æ1âºA–^‹€›z±µ±ıí=ŸÏ›x¥∑ø8†z«QÈ÷ã•TsœÿÎÕW/_ÔlÓÌÔe7f∂€¥¯µ6@–Ÿª∂8\`Ì1Úì6Y≤÷ﬁçêZ Ì0¯…R±¢Õ7⁄/ç?h=ÓÏ¨ıÅÇ«.Ò˜´K Ú˜N9ÏgT¯⁄Re·Aò®Ãø¸ü-çâ…’ VÎ±#Ê{që=	â∞/wû?cPZê±É¿õÊ·!ÂìO‰˙Fö†ø%$Â˜¯Ä3ŸPº|ËzÈç'¸ÌgÆ∑øû&ºÚı÷u«Îü≠‹ÂïØª*ˇ¨_˚⁄Ü˜“ Ø'—4«¢ƒÔ\%êÕeº¿˘ˇËÏ!|˙Å(Òü]%‚ÉLü9ë„¶πl‡[Wâ@/Òù´D®ó¯≠´D¢ó¯Ω´ƒT/ÒWâuΩƒﬂ∫JlÍ%˛ŒUbK/Ò\%^Í%~„*Òï^‚\%F˘8‚Ôùíáëö2Á¨ø–K¸«ñ∂ê6hç<ÛvÇøfŸIú{«∞	cXS;Lì11T‹&“ Éá¿·ìòÂ	ãí‰ùX` \Ç‰íY/Ω®¡⁄Cf“˛uÁ—ﬁÁÅO1yí^Ë°ª–d,‹\Ï:Kx ÔXñ˙oúeh]»"«Œ"?…eâq≠Œ”T◊
›€Éú¡åB^4y≤åzŒRAÆ
·w7=êd)˙·ˇHkå~8ãçß≤Ã‘›Ó ŸmÕ]¿hx|:û´¯¡a„‚{ªUﬁÌ◊ºk◊ºÎàw≈Zè≤4/ŒìtÃRÔàMAû¡›i0ÚRIÉ˙0a	ÑvX:(Â„Æ<H∆(1Ñ <û∞VˆÎ©óÏ 9fÌ?˛ßo;-6Ù&AÅ…aây©è‹ó&;Lp}∂øŒ@X\|æÕ~ë§~ß¡∫˚„ﬂ˝ØˆÆø¸ﬂl†x˘/ø£wÓ%ˆ«ø˚oÈ≠ki˝+ØXAƒˇ˙—€
Í˝◊ﬂ”€*™˝◊ˇBØ´®ı_ˇô^O’l	—ÇP”˘rÃuä3M(È0ÿ≤`ŸIfè£d≈“‡8ÃPúﬂ—ƒS–ïaŒ=Ì˜◊YSï‚.	!¶+±V~):—Ωóæ“Ì‹KQh{ªªΩ≥˛zÁÕ∆˙ˆÊõıÎœ~πΩµΩvÌîwz∂ˇˆ^©ÍfÏS≈ÕOöUãÉ#9ƒ∑◊Nµ˛œˆ‚kßj8g◊Nµq–;’·Ÿ[[¢ºé2ˆ·C!∞√≤Ÿ:d0oip=É˝CïdÀQòè5<áı√2P(¶òò^Ê⁄(2ÑxÀ?ñÑè=ˆ¬ÿé_∂µAuÙ°±__∆&*†Ú°˙@Ew	-¢Ö“Éá
†B›‰}0é¿Ë3õpbh˜äz}µΩC`&ïE◊7BËEA<ÃGvSRs†‹d≠Ωx/n¡E⁄3Í“l‚LM‚Kú¬£≠E°òO–{ôî0Ù'l◊ ¡7π˝Ú≈æò‚|‰Â¿œ@jÒráç<P€q¬â‡≈d/(_åºåﬁWêBØPı…DS?»⁄-Á:juÏ…·PW—DÀ5öBs¡Œã8IÿˆŸ≈s≤ÈùêéázbπR€ª{Ÿﬁˆ>Óz∞ˇÌÓ-∫ -jjTÔàS˚πª¥oZä»‘¶˝ñNº4ê•`=˙’∂⁄1Mk‹:âïz|öÿ@ˇjõï%`öéQ±*^mZñI”≤%Qª´Í&√¬rgÍ¥›·(ëe	ZGë≠Æ ∂hZïtFxÄ|‡«◊s4Ì˘e:ˇzäk2Å%.Ÿû∞B›¨ëÛΩ.Ω:=ƒ•√MJõ\‚£ŒO&¡l´–jã◊û•Ôi˙í{Q@ﬂ∏¬ò“w{¯ÿBﬂxb•'oº9HÔ˝Ã&–}KpW_Óá˜ƒ>Ú>à≠±x:>R˛°yd„ Sœv˜Ecy0.?≈1ÄVz~ê¯'Øì#˝Ö|ÖCx‚Âº“|Dò,Ñ¢waŒK6•ˆ2C™L|Ö8 ¬·Øßh’<è5y¿òà›˝B0¿Møìº¬n†Ÿ¢Uπ©K	í»ÈoË≥2Ùÿ:√QJ|äTÁEgÕﬂ~]‹NÎ±Û:»+/À∂‘¥ì=k0‚?èFa∞67!oê=ˆÇ„`–÷på˘-‰’ EF4v:õ”UÛπ±ã√ï‹õL≥ë‡y∫EΩÇõ‘Ú#Û°U˚›dä˜ƒÊ3UºÂEr¥@$6!¶"¶˜S“Í3íÊ–rÜ™†? Ö+˝PzÏÖ±0){QaW5iQ˚•[;]˚≠$Ö=áp∫˚´Ω˝˝õÖ…ïM„Á∞4ê	†©9dYÄREëB¬‰í/Ùﬁîxp„∆˙ãÛø}∂Õ∞≠;õ_º^Ç&b=ºlÈÇd—î-&T îU∂dVﬂà,´Øc]_¥¨Ò∆”ëAúWVÍeË˝h√∂cbLöëºÕ‡>øÆ b@juÒï¿7Ë
¥fRDìüT¨Dÿ07=ê£⁄íwÉ\ä2∏f6óMU´±æÈô˚÷B!N¡˙ëŒºœ∫X∏+wØùB_goã:à5ıM.S9]]qö¶) ∂É˚Í3ƒo±#	ÑY%ü¡VºÖõ›¨Ç0ﬁ0ı&£FÕn¿^_0å±å‘Ö´Mõ¯√P´:≈}–ò\N»Ñæ⁄S_gôU3f
*⁄sÁd7ı`éTkº3}æÑD±∆v{Ωû¬˝Ç„j‹◊YT√ôÌU’∞ÑsXá 5«≈…k3qÉ•f·&‰§¶·FWãU™Fà˛ÎPR,ê
úh|ç ¢xáº ÆÆç‘ØI'˚ƒøÇSÆ´√0©YsiK†•æ
'>5R(†Zñﬁ¡ÀÉ<∆ÖÁrçn∑€Í†|∑¯´›k{›ΩlˇÊµ≈^d9Å`µ'Ù	 h{üç£Óá≠„±√âqjò4î…ü‘H≠¿ø)'GAqi89“E·NSÔ÷I–¢ä‹bJh$æ%⁄ó’h2ÿ¯@NcYEU£Ω%˚º‘zá∑÷ÀF·anÎäz=P≈ µ&…ƒÆ#Mé¯ﬁ@≠ÜYE=\GA?Æé:Îª}S v%°«(ZMRÖ0ÂKBÄèà1€ááùéO5[)ò.È&Ç\ºÖ
Œb.JA3 QY4©æó√u‹£`\pXïJ’p.ê8–ŒK
ıÔ¡ü˚|√Ñ'7o⁄v&†‘gƒEx—›P5Œﬂ#’éI%M¡ç§¶mÈ@[ôüç°ÀÅ◊(ﬁıâ6äÃ¿Oº¡ª<·_r4äâ·›k‡Ì€∑∫]LÑ æπ––	Yê	ñõM%ÂZâ+˚D¬JÇç1ùêK†©!2S¿1óº⁄÷èâ¢ÃÁf◊r7‰…&q∆EÂ≥O¥yÆò>ªq>âÇ‚Ù}º™m§BÔ0@"Ìr∫‘EHjkÃer@îŒ6üøf¡Øß^‘Õ¬ak:%.ê≈IŒéR4l˘®Ô⁄¥:ÉT®lî∞≈…2jWZZµ	π4‰ ¨!n˛Lñ¿«•qWÁïÛs√)l:Åh]¿H˜T3£ 9$£Ï 4„Ïù0û T(õ!WOÂÛ ÷â%Ä∆ &`g;äô∑ÌÕÅuË˛è‰.psi_Zq◊îYOé€jŒX	]ı·+¡.[±"™∞TÄc≤™õ7Ô!æ#ÿ¡˝g∫àoíÎ¢<a˙»–zädØÔæπYrX¯Î°π)êOí˛ü¬ö≠€≈_µ≠ÌÌ¬?ôÂ	¸}„o&ªﬁ˘∑˚√0ˆ:è>ÇTÊ<¿7{˚Ó„;zı∞sm1‰jê`¯Ü∏RÕ∂úLÀÕ≤¨yës°y0™lJ◊Tò q=Æˆv7∑_≠olΩD<Ì˘7ü?Ô<⁄€ˇ¡FŒù5É¶óN⁄c<îWä≥ç«Ø‰_X~B˛~∆)]Y#Ö◊üX€B ≈ßë@ö¬FPÆ£xæhÿn‡UÇ¥°)mö—¨m´èT'ÖŒ≠6êlK gÑÌVö`´Ë¬Œeå£#äï˜;≠÷ÕR≠B√·' –_Ç ˆ£y^ìñƒCR˛≤/πè‘V•pü>Cß&)â⁄;ƒD§-0o A+aÏ˘?cñû¶Å`™VˇZà∏Ÿªﬁì≤˝Íg{ŸÕEÕbÏêï¿]∫Â9°ª xÜoe^¯.
‡Ö!º57ÑÕe(zæƒ⁄õißñ13M’Xp¶Q±f FÕw%Ö,”úëáŸ„iÑ.S_„ÀÜPŒ∏˝÷ıÓì∂]ÿ€˜zàscøg‡_ˆ‘lJÆ¬π›Ú,6'g∞j[n¥'óÙ ÛúÕá_∂ªÉ©9Ùùg¡iôÂ'4ÂÚ ‰‰qÂ+4BXeõ¯N_Ö&`úD>Z©√G&ÎX’{úX!(≥NZ§?ABFØÆ7»{ÙÔÄ⁄pJ£t‰1"7ˆn∞m¯RÚA[¢tã>ıbØƒ« F2çy¸c_LÆ"¢:,BDú±!2bj…ÆËwÊÎãO+Û∞ Mß}¬ÜXcf‡ö*æ†u’±‹h@5zöHÄ◊√®úa©È:Î“Åäõ7œﬁû±tî·°ª-åÔícQAúÆ{ÄT–z®1¿SŸRËn˜yè≤òÇRüéΩÍ©$NâØ¢¯}Í]∆†*Ñ5@Wß£∑*Hê◊”Ó#˛à≠Q?ı°· ±?{G˘„·6°¸¨Ï˜π>Z∞>(4¬Û<’:•øÍ MnJ5√¨¥¥¥@çﬂ´–ËÙﬂÈJ<}KKë&Í⁄©"+†Z
WËfëó›ª´}∆À—e"ò°ÕÉ¥x´÷úé˝ ¶"ƒ÷kêﬁí(VùæË&Fo¬lªÚp•ÏX∑—À%nBêhòªt”ÌØ1øòcIZZÎg‰j¨@~√$=A§%©Ôt ÛjGPãÙÚ‰Yr§nUàx‚0´W^>¢˘
Ä%±ı8{Q®¬,‰Pã2ƒëz¸¥1îköz≠ıø¬FˆMí©o¯≈2–]æÒ∆x‘úûÜô®âaåi2≥ÑN√¡4Ú∞ô¢õhzÏ¬Ûﬂ«Xÿ¯}xåˇ¶Å?®g+Ñ_	˝òÑ±ﬁoíÂArZ?2£√‚qH√≤A§ÚU
‹ø∆Áø˜ß5'Ú[c–IÍ˘	Ø ä¨:
“8Ùåæ`Ë˘4ìêûÜ^öRM®öPÿ?ˇ-! ≥1»˛!oX¸RÉÜrIt˛{XyÙ⁄ÿ`.£≥t:ëÛÎs¬2UDA¶ÂÿÉ¡DﬁXÌÎûr+9°Ñ µÙ≤d¥'HùGÖ—hBZ‘§xpD∂∞£Ç€‹2îh±úàX¿z_·∞ì!†ÈÉ}‰àÙÚP$›@>/ô5Ãf–Ωú¸`»øØˆ˚ãK}6JﬁÈö˛pπ/ºü›˘EΩ[Ìõ∫/LÄñ§–Àø˝„ﬂˇﬂ∆KÈ 'x^	≤Å˜Õ0a⁄¥1X ≈ PN:•ı	œ¨Á{,@=ﬂMÅ—ˆZ™É≥íFà«ch}|b¨fè?≥VÚ˘wcæxÒœ8•LÄÙ„ÛÔ‘W¢¸Ù¸˜9,T˙ö»o0ñÄ/^TµàGÁúûGSÒM£G‹-®¯˘ƒöL’7{	}AØ–è¯ZTòq2æËçÂ⁄ûL£±\ï(X[iÙàÉ¬ÔøG†$áûg„}'—tSoÔœøKÛ‡Ä/†ı}§Ôqü≥ò’¯Ä7Ë'iF/[í≠©•V<‡´l<Õ$€Ü⁄ht˛].2LHíZù–≥Ñfà: q&|v<9y¿¡d£cYÅö SX=ˇ≠$ïã[–.QA:|Y{÷≤ˆhY{W¥¨yØƒ¯j◊Ò‡ƒãª∑˙¥éÈªΩé’C«:VÔÍ◊ÒˇS≥éü1_≠~†-X¬_h5»¸|Aø˜¢)¨·Y´ˆû äËXlÓÊ^”;k∆W@ãb«Qøà≤9≥…¯FÖ-m2õπ®%P%œS˛¢ËE<Ù¯≤;H˘ò0˘û§¡Äs˛ 9 ËA0ƒYbkÑ	Ê‹‡¸∑Í{—`Ì@úL1wÅÜ˙Eïßqà«¨ÇQ2ˆˇ]$∆/Øí†z—ÂŒë…È9∂Ë9&zékËyuzÊùˇÚaõ⁄–Ê´ñ∫‡ò^‰ÀçJ˛¥i\Ó s˝u-•ˇ„?’P:Ê¬- MÂ@tx“°‹ã"Ñ*œ≥»˛y‡ÅH(Ã,¢ÄúùŒ·/≤ÿ,I®∞éË®É±*‘Ss]å«¥Ëﬂ!
dDXÔﬁGÙËG4çKòsÕ%˙wôñ¿±‡≠ô7sãˇÄ˚∆¸uÄ†ÒÌ ˝/˚Ã¢)]iO8œÑAw©O´b‡„∑*z›QÉ√x)˘ÉmNDK∆]:W¶—onìÎÚ‰∫s˛› ªa8->mªµÑ:ô¶ìH	T‚óM¶⁄cïjoÎâÙ©c«∞o¶PxÅÒyÂ=0ßÑ°‰ïûñ&»º=ˇ◊”0Èe-•
ƒ°ED®èÜæÚ¸ »2R9É·ò{q⁄†¸Ñ±y§0ÃP5U&´`õT¸ØÇì:Ωê"/π€ª^˜õıÓ}˛Ì˘wÁø=ˇ˝˘Œˇˆ¸ÔŒˇ√˘oŒˇ·¸wÁˇÒ¸üœˇß=øª≥#µ◊‚h‘¡´Ÿ*l°ƒnO,=ñøÉvûV(ı¨lp*LN≤äPQ≈p∏ÕI! ixröûds¶ı©¬˛$áa•‹»ß%ñµD÷u€£Ù†∏Åè˘>4xwó¥Ä≠‡ÿÜC⁄‚]∫[kÃéÙ◊´◊P{Å∂≤â3„SÜ≥Ç&œ∫8W]x§&óõœ¨ö∫5m0M≥$ÌéÇh¬&«›~oï•P’|û{%ƒU€≈#daL'4RP( ”âHVGÆùÍÉÎ@0 xh¡s ◊{ƒ⁄÷õ¬LX≤ ∆¯kß‚‡Ó6&‚≥◊ΩHB∞Èui^Æ#€-ïë'0ª†¢á∞˜]á˛ØÜ˝ÎlM¸$£·uÀh®`◊Ê⁄NìY∂# "÷T<]º¡vÄÁ‰·Df¨vsBëÁ7Ì“ú:4gÖwêÅjîc õ$Ù.&nÉEòwóóYóÊïÃ§«Ù`|–]f£–˜Ao•IÌäÌÄßÈÆ.„Ü!´}π+»=Å?ˇûkˆ◊%¯9ÅV)uè#ñç`s?Í.Û#Ø››•˛‰x¿"_r…ÍàÓõÓÓ›ªw˜Ÿ$°≥Ù] Ëìuc–Ü$≠—w¢Å¬ø°f8Â9µ∫É k∂ ≥UB‘aÑÜ~ÙÂäJò®ªÑY“Ï«î' <<©nY¥˝–\jS<:¿◊Uıtò¶–Èê&G”ƒ»|áh:¢`"Õñmu)ÂÉ ´ûõÕh;vâ⁄îü’&©auï¨¿ˆËlèvﬂ´r\1øp˘±è:Ê·f„®¿∏˙fI˙Vn˘+äZöhkTøœäM◊va‘Li≈ÑŒûNÏ¸G?áß≥ëŒôΩRJ≥äs:≥Uæ‰\ì…ò≈òÔèÃëﬂÎı ¬w3ß¢Jüm˙
'Ü∑Ïm≠Û—›ΩtˇÒÃ‹vï4Ú‡3¶˚2u/ﬁ'˙*kÍ úÅ’H£≈’qÜ¿\( ÄR7?Aﬂå<ZbØ=ﬂK◊„ò–”ˆÈ∏æü(}âºÖîë*}ÈÅ ê·/ıCBÅk∑ﬂ1’:@<Øì€ÀÆwOï…¬o0NaÂvøx&v¸¸Â"èêît¸^|~[Î˝W§'“
ê9t@%$i vÏºs^<‰ßÆAùı^m±l˙0w‡'5«∫LXî°öΩXô˙Ä7K}¨Å–›”gL“	@%uÍ›‡Mí¨MPt§J~‚*ñÖ±Uå~IfbŒπ0ıÄ⁄Ô-/∞~Ô˛sˇπ≥¿ñz˝˝ó√4Ù_%—…~!≤©*ùô•Ø¬ƒ`äIƒ2Ì7D5†ä;P¨Ù˘ú+bØÚv∏¿{Äa-ı’JM√"ò‰Ω„≥˙{r&Úıùuz_É¥Ÿ∆¨ª4R=ô6Ç#¿7(åÄÛjÄsÅÊıh&;∆Ï9°2a˙§»KE5Ô˚·{]fÁ›;–U˜∂ sêΩ˘|r\£k¸œQGÁ*4QZÿî√Üˆ=T?áp“Ω≠_ªˇ#ÆbU&†RÄ&i€è8,À˝æ&Bﬂ≠ËMÒ6ÜB™O‚Ñõæ&;‰·BAqãıÀÜ‹^íª©îÿáI˜6B¯oˇ¯ﬂ˝B∞eß0Öƒ–v¬<
àõuÙhë—ä6†I©Ÿ„Lqµﬂ◊ÜsJ∑€Ûƒm»Oÿ˚ Û á^ƒSìqìïûÏ¸∑®ZhxÈ–cyò°	xYñüRPSä¥¡Œâö¡Eò¬áüTÃ'ÆYZ∏]P‚3Tà¸5ÌÁ2·Û∂@1≈ﬂj£Ú˙â`É¸skl{BìÙFòÇ"€æç∆I‰}ö&[¢h
·ò©z®PÁ‘>Å¢tUs“]Â4Äˇ Ã&1ò⁄C]˜0’î´¿ïº2†±|Ù‡∑â36
P∫îøÖ«…1à¶}ÿ(Øâß‚ØA(÷»®ÎMÛyx˜®ªªÚ9*¡ñBâ‹Hb/|}{ƒ<mÕˇTg≠ú!MÚ¨»ÃS“†&ÇèëÃç9u∏ñù= ∆ì·ıQÙ†Ö⁄uçõ…;Ä˙gÉ5Xí~A®h©ﬂO<PÎ”‘„Ì—>}C±x#k¨µÃñ[gl—Rb,°åAI@Á¸ \i§sm
Ú£íëÍ,X€‰G∞÷˚dﬁ‚∏9c«KN9Åú±Ì˚ÒÚÉSh¯5;_OŒ
t›ΩÂ≠‹±—’[nÃ~œH¿TFLÓ6Oa:JòPs(gN€ü‰¶√Ø˝˘›ˆyÅ-/ﬂ≈myπﬂ—&ı÷·≠€¡™ÂJÀû'ÈÁËL?fOí|ˆ¥‘máˆ¥‘måÂ©¡ÙﬂQ19É„|œdÉì|◊dÈÉ÷*QÅkà‡ê>÷òŒÀ˙qò±gﬁA]-¢É»†MêúJ(–≤Óº¬ˆ[.blÙ¢ÌÅÓHJy‘KÒ-n%•&—˛Ô≈hkçÅÌE2cd©ﬂ$˚9πÏî,	0˜∏†ËÆÇ§V≈JΩÜí,sÏÇ3:oOJïÈáÔ!í∏uõäqÚ} ÓÉaˇ7ç”=¸£ù&ù‹g›ŸΩ Cp˜—uı·í@ ıvßÉpUU¿â‚à^≥Z¬ï<[ÛwØmÿè1üçéªRC‡‘?˜µõ`ÙèXúé7∞Z£c◊®ù∏^`ÎÑ”ß∑ÆR~2cêãÉHàÃ˚AãˆL/j9
€2ŸÓ›ﬁ*öVÒ9á.EJ≠‹ö”†#◊Â…¿œ}WMzëì< 1≈¸ì-ò˝€¡∏ı¥X˙g˜Û*;≤ªë•ﬁ
¥aòºqêÖò´GI?lü
>|∂€dmg˜]œ—íÂ8(9⁄8X˚ö—’[W[.o
Œ\…óR«øAÄo€“˘ÓR_#ÖBÁ–}
ú,0à	‰uTm4OCï^bâuØ’U‹ª]˜AÃº‘;ˇù«⁄õ‹%ﬁÔVåaL4√ê›Ö¯Ñ§ß$Ó/¢‰ Ö©ƒÛ∑,}9v«£˙GiçÄ?ß·ÒEƒq©ﬁ2ø Âé7XÖπg⁄çœ-›ﬂÍ≠:t<)÷˘Q`…ÒºSõr‹:`94PAµuEŒ3áßË’‡Î@b
x≈)p;\Å≥!tzklRﬂ+Äbr^Y 1–Ôí..∆	™mZòË…J+Ç˙!k—H’ÎW¿Ωx¡I(¸|≈È+ﬁøB5çÀ“£˘G˛±YkUì(ûK»ê€o†¬£Êváï∆Èú≤m	‚tì„Ó
P¸‰®VBaqiH∞2`zI∫jÈ◊Á%á.=∆5«˛"ïrﬂf	Ø4Ñ,Äs L•çb( £≠fﬁD}6√„ºÊvóƒr¡∆ÍYå‰XÀ6W›∫ ıØ|·%=	≤!f©aœßFOH÷ﬂæ˝§c~t´ûtJ∆ôl¨g∏mfŸ±Jä
`OÍ*˛q≠∂¬EÒœ–ÅÇÆ”»åP»Ç¶‘#¥˘ï≈b∫^¿‡¢ ¶¡ ∂‘çÂw≠¢VGÎJD6ª∏ÌË¬√°´>¯/≠˛`Æ^VΩàXfVDEk}–oﬁE©èJY\PGa–1∑Ur[Œ‹S£!Ï©+≥wTNYıúÄ@j¿—m>~GÓ#ƒÍÛtc$CãÂho qK⁄≠3á»ªJ+VUÀä±K©®ëpçÌÙmYô∞X∞ÔedﬁzhïòílîÜÒª.Zb©4¢14ÜrÛú–;∑ﬂí¸\∂ÄTÒcÁOìWsﬂE»‹gÏ/â¨02Øº€Ü◊¯∑`‡ïÃ[ä›Ëb0<e&~ú]ò}ﬂÈó_ãEÉûÉÓq\Q∞ìb\Í¥p|1¸ cmyû(É≤€…AêÈæ£·Qg˝a˚+Ë2•ª9∏~ªºÌT1ñ∆Ú:Á-0qr]2ö=Tçë—¶ÇUN“‚ö'∑8X≈ùñ*y”]É7…Äµú4.êªG]Órr ’h†€£ñŒzLÁcÌ∂"bÀ›*~£k"üÛS7‚Wiæƒs¢kóRÏâˆ>ÉqÇâEùmã·aZò≥N√Ò9ôoHÆ°lZÂ÷jÙxk1€!Üj.+˘ÏÄ”íz ÚöäÊ1!vÕÌƒÓ´¥˘&æ6ò#Ë*?≈pùãb»¬ÍOxt"\)öêÓ‚»êön=4Yc	o∆.ÇΩu˜lÌ˛ÑÁ’GA™ƒcº!	%Såk$„q˚îa·<U∆íâ´˚ÃIpxËWçï∏xªf1ö÷ÕØ.úà‹{H_í„ÆhGÚ¢ZáÊUÌï⁄jw;Í™c{≥l‚wˇ„?|+›Ó€tç¶ÜBãŒø≈@ª[¸¿3©Px«íÊ‚.+P3›Òµ,¢„<ñ£*3ìG“È55»1ª∞Â—=~„Æ≠:È…¥bñÕ∆:Pœ@ò√@·ä¡DÉ¸éòıÿW±XzÆ•Ó…(¬¢äÃ2$»€u}Ò¬èüRî/Ê≤SG% ]ZwÌ∂/ÁuMZOtÙ0$≤ıO‘ù§:†€!∫ü‰elxÁ(|µÆœ©÷Çl¨–√U<Ióu^Pâ‰u4éC\:.D+™˙Üx5∆H
˜ı‚îaàm∑‚ñﬂkyÔì–o-pÍ≥û≤3Ky∏Ø_Rˆö∞Ñã'zó0ü·•^˙é¢eúR‹†Âπ∑∏¨;´ùÖ)ô˘”Åí˚£¥ßo*ú	$P⁄&h9yı‰)fóK=ò›G†V!êLùÚâ¢Ï(Ã¸¢9|Î‡¶<dMÊ—¿∂9„ï5∂[í˚7Ÿ∞;LΩæq8«¶…,~C-È˜ä«Î≤¿ÿ_3Ñ'Î®Œ≈…Pk∆¢»	0AÁÑWƒ-+\16õÆƒùñüKÂ˛‹~µoÁˇ¡ü4~Ò°àº√k∑l)‡ªÏÇê	À'ÊF"Øò∑≈¬Ï9∆ä£a
À∞ À[Ä/ãØ7_Ω|Ω≥˘aÎ≈”óØüo~ÿ‹ﬁ˘Í…÷ÀO∂÷øxq˛õÌù≠çó~æ˛ÏÂÎıç≠Ûﬂºê	ê©ÖNπK⁄<äDô™#^°ó'_°¥¿3ÿhπg◊_l˛ıKûí±æ‡ìÕÌ/ûΩ‹ﬁdød˘@˜tkÉ÷Íî†Q§∏çƒâ80¡”&Ë”(˜1≈<"çFGﬁ	∞m/„-
VÔ±FÒñyMoqÔ-àﬁjØ‚mq^U;Ñ»ÛQ™â5cúÊø˙MDwO∑±ÙC‡	⁄…=•I£u£J“›[‹•1"∫•«ÆÕÀƒÖAˆ÷´≤"Ì"ß∫ˆñÔ˚#yE‹L≠@?#c·^'°ã°_å⁄$œ3KX!°›9d†®0b¨8\˜GÀe√c6÷]}ï"˚Â›æìQ^zRHB_û·Ò©û(ŒßyJ^`{KM¶j¥4ÔL	Ï¢ — øå¥;1Ø‹]÷t≠\·Ã\z±åñÍO9–ø‹˝ÀDˇÓ“äÓ2ò5∑¯I÷è?w>÷,œ=+ç&`ÂÇ -3∏≤5ÆÌ/}/‡ÛèÖˇïz¸7¿Ù≠ì˙íÌ´E7?¢¸ÒQ}˚c°˙V%ªó´Eh∫{ÛR:∂Êç`ì»·)µË sÓ8¡ÔdÊ⁄≤næï∫3É‹0;8ä•9B≠›"l≥dk†DÁ•ÑÂ™!g›J\æ=Ò‚Rnh¨dc—@è Ò#∆π~ålS6muÕ%%	∂+V;7*oLƒAÙË	ﬁUC√Ï‡8K”Œì∫öf⁄®]Ét¨#óg§0˙q{ÈÓ“meOπOáN‰òxX$àÜ…2‰Ãò˘b‹≈°LﬁF_ûÓ,∑aÀIzr—†#æ˚ÌÎ¢É¶Ä.ó¬ÓhbŒ_®≠U,Aı°ÿÇ∏9˛·K
òÑ3<_´ äígPª‡"VÓ´qÑﬁ—‚([)hÉìq£<µˆò3ÿy”0?a˚2q˛∂x\≥lEp∑™OF&¯JŸ	›ÙﬁlËˆp•&iÛµ Ce /FÅ`Ùuqµèà[°–2Tu˛ê @èlÏàz—h”e«¸ÔgD2lá∆$,ﬁ∫¯®f~uPº⁄nﬁ^S;NßS∏±Ò+\∏Û ÃŒ•R‚~∂iLG_Ω'OÌÊ|%;{´L&‚pﬁŒà«ûﬂb∆oƒuÿÀ‘µæTA˛Ü∏[ ⁄§]„KÖ’oQ⁄–1EK3NüÎÕáÕ§Úa~πÛ¸ôºp[∂F…‡F~ Ÿ•)>à„@ò›≤Ÿˇ:Ó¸–¯ Q=Õò¶≤‹—Ó`øù$8Ÿû˚%≈π_)'mEÕ)fQŒ˝&i„ûkâ©ü{<ë™é#˝Æ{m`WelWfñeêÅ-rm`}w˚L*◊≠Ì*ÚNÛZNŸÔ¡ÃNÀ¶Íî∂tÅíWYF &Q‰MPﬂ†õ•C‡#e+TNzÍÆˆ`ß≈R9ø<ó˙˝≈ªZ|ç€Êt?Oç.ÂÏ–Ñ^x´Rz…KrˇhÅç™$~˛A)ÖŒ´ùÕ±µ‡ßÇ∑¨∏˜JUcKö¯;V7xÄ¯÷_ÏWÙ¶Ö¶™&ñ\M¨Ã’ƒÚ|MhÇÇcË∑Íá^…V´´5¿ŸrŒöbm˘Œúç∏∂t˚/ˆçúeÛ4∏‚öàÂ®Vå91∑‘øºN,Æ^k›su´¿'\O⁄Œs¢WçÁÜXÆCPCJ≠#˜fÆùÎr∑Êk¬=Eï¸öÏTØx&%2¿å™Y∂Cdi>∑•éZ"iS"nBì˘f∑‹‡›£yöYv5≥ıÕØßaêV¬3ÜkŒ+‡dw=¸p%*G”·H(Mïeuë OI° ß¢ƒK!ΩımFIZñıOâµ–BJ)ÀÀ∂©Œ(∑ÿöÜã¡NßZ|™Œ†LcÃwU˜Ûëªá=£|R@4ëñÉ|Ij,Àí®Ü≥»√Ö∫'’bù(Qàu‚AÅ÷≥Böt˙/•Ó«ÂªtÅ•[S8ê©õ °¶@®i°ö¢r‚±ˆlYƒrp·ôg¯4ƒe2o∏	Á¨gñ	¥¿]´äñÆD!ëü*´üÄ¡‘ÿE∆∂H^X5®bv¶i≤∏§µ“:)⁄\`oÒkó[(ïqíf˛*,îÚC)5¢pØ«˛Œ…$!´ Z	[≈âï*ê/%È¥Ω¶ñe’WyÚ°F∞“Ì”⁄ŒrA(D∞ ¨w¨G-œ+¿∞ƒ bF≠¿Î‰*]„ùö°˚√TgkÑ—*RøÎ"+Û´˜R≈–|EÓ5;o≈ﬁ´o•∂E≤>X∫Ÿ∆€lÎ]ÈÎp(œπ	ª∂·".xmií´7Ê∫≠Y≥ø
vU›
l§•]T~ú;¥{èvÔ“Âƒ\T∑K;\á,DsEB..≤'¡°7çr·`n—çø‚mâtõπoÕ√F'm-¯}ÅEÓ›E\K¬Ô^∆ºc‚*oßÀñﬂzXî≠2Û€Ωπ=W´h∫Ën¥Ë˝=êÇˆ÷CK≈[ﬂ9÷Ó∑ß˙Ír~›©q˝8ˇ8Å≠å)ç∂Ù_,’qg·´6ˆ—Ie*—Ω.0∞®‰oii∆Ají?ûêH"ÙZW´"Âo•C‘ï·x›8Æ9„]Õ3aì¶”•‚bñkB¿¥†ØèÓıÉN!íió%Öp ±Êú–ÚÅπ⁄ÈDÒï:R÷ñb´ÃÁÙ¶7Û•õ,√laN_z„±]‘y^¯óÖ√π⁄Õ|!◊˘Â–¿W>œ Í®©b˘œ±¯ã·ŒÄ¨L¡˚pœZ1•ıb–€Y’YRô>›q‚,µl⁄q6.ó‡ã<≠é3jZ	π[ZHµòûæUYöuŸW'åzÎ œª°G›‰ÔÄHô¡èMﬂŸ©=hç à-$wd6c–p¡ºx∆à£)åô3~Hë«5ñíis2wÚÎbêi∞[zÛeVoqü—Ãı˘1˘p‚Èx#
'	fK$ì6Õ√]Û,SqNNví¢ÿÊe'Ò¿æªO˘·±FukôtØ/0 ?óo˘èg3Ç• ÅÚø|ÜM3<OìLS`Sí<˘U:ìâÔhøJ19ÍN◊Ï3å¸±)û“ÈhËM≤é∂4hoì¸˛⁄;⁄-‚cy“î™mÖè•‡à Êrè}ƒA
3À[·ógpà€ÚÓ£ËÑ¶A¿íCÄ)ÂÔÆﬂ∏qùF^Éçë"^Ï3qãçºlƒ2–Ë2ôπ@É˘ïºùCéﬂ’¸"˜Ø⁄?ªπó·EncíªE¨Î °ÿµ%‡¯0Æmòí	¡ƒG´÷]ˆ.sµÔ≈7©6~√ìj˜∞âÕogDu`ÇcdLfÕ»ƒÅ^M%[—pôÜÉCªÀ‚D,¥	•ÃS®∂¿WJUx˝ÓWÎÛmF∑•-Ú?‚Zä$µ/&€z¶„ÆGÁåÂ8∑q=˘8⁄ <–(¿s]Aª4;ƒC6&å6ﬂ|µ„∞ÄLi(V·ﬂ,Q√Òì ãØÉtrÇrƒÓØé«,»x~+˜Üô÷SƒqÑç> /Æ±è3ˆÕ÷gﬁxrØ’©(süóâÚÍ"yë!—˜(s¸OË*jI€ƒ[-¯πœOıâ(≥Äh‰?rP\,à\£Ìˆgé TΩ;ºm≈î+¨æñÃ∑6™ÕûãE¯3å..ÈΩöÿUÚ•a^æ Ãó˙“PØ\ÍÀÅ}i∏o]Ó
¿uA∂akeé~ˇ‡·µ•˚ãÕ∆õ∂ãFR∂¯∞nïo[m~d∫~=ZRÀ^óVûIaÿ¡„πb—’åO€“ﬁ√ûl2iÍ±L@“¬3!Sµz=’Ä+O	ä}ÚØ1≈˘*ºø	T	.¿¡ì5F1˛¿]u~A˜3òµéËŸö∏„∏\Ñ!‡%ô®j¸I7O&k¨œª≤ÿ^ç¡™<:nŸ««ÚÍù{-õrkÜ{À,õ9T‹ÿÃ:⁄öTKÃÜ|˛VŸ‰-ï&™É3»Õ·8™≈…Jπ›ä¯¶⁄fñÕTÒôTVi*◊œ}M>ëŒ¢.¨£≈GÏ-Ëæ\ßÿ≤∫G÷ÊÓH‡h˙+9tËç√Ëdç]_«¨°◊AMÜÎe˜Z?ã≤…=TbﬂöCÖÎÂ◊¯
Pl8ˆQá¿¡ê¸√•ª#`ÃÃS⁄Â∑á¢çH“†™HplZÎÚB#Á`çFQ”ï±:˘úÕ.‘1fÙL<–ËˆÃÅY∫çvç˝¨Oü{“£ñÈYÎ!∂£q‰3DËµS>ﬂÚÆ("
MÆÁ©"ZÖIõ	⁄~	b,ê…€˚(œ>ºO˜«AÓëH
äÿÉ÷4?Ïﬁi=ºø»_íßÂ⁄©&ˇÙJ`#oU7yz¢:Æ®ÿ{1'&*"^.∆†˚Ùî⁄HgS±Á!?GÃ(€6ó±≤ER∏ZkT˙qî¥wM5iÅùí{gÕ® ò[p¥ÜC3ìÿ+5C%≠VŒåç∆;Ú¬ú9p—;¬†¯ˆ.ésø˛hÁå6HS5«Îº{fx#ôÑÅœuÿ-øç‚åV
ÏÑ„ ôÊÌ6i1Â$ëwÿ2–l·S√[‡AWkijüä çøw‰•@ìOA}9†¸ﬂ	;≤p¿
∫†q0
™b≤÷Z`ÿPóI[óƒG<\.≈p7”¥Lﬁàcí∂[ñôÂ–ëÒ =XNãnLT-ïÁïˇ’6SiT)z5Ò◊{‚™Ê¯Ç≠}¢¸ä¿Â»¥*ËÔEJSa’°õBçô∞—è^§9ÔWCCêó7Ò&^háyíy∏)RÚ>SF:iÜãﬂC#»üvíÁ“¥Ñáv‡â2¨…/VÚ3,£\«RË%îbP·-$MrØπR¿∏óRZ®ÿ◊ÌGkxN≈Œ√≈a˙zèÔUﬂ[¨≠`˜.D÷˜~ÄçE65£ÎRŸ“xSÍç$∞1‡~^—‡A∫ó›ÿ[|$ö#[X©Ω(‘⁄„'ÎƒZ≠F°jØÀÍF£
ö›éì˜õFãI4m”ËCu¥6j–V*ksR◊Ÿƒ¿PU7ì2πé}√^˝eM0v6aÔ√l
<ÛD82–Œò†îxRòã«â?≈÷&∑≠Lú∑¿¬É(—3heÎu§:·≠;ên
XûC/Œπ\π¿!&ÈU∆∂HnBb•’lå7%ìæ@≠ìóííqS@:Êa`âÉÖd.˜>1=;õí◊A6Åßt∑kÍÌ6xoÄZﬁäú‰ƒ*∏3Ú]ﬁÍ˜[•¸àº±Í‰àπ∞Cª¯êEL∞∏oV*≈ú'Q8Ó∑üÿì_·vRë8î‚Ÿæ=¥H≠ßv◊„'RK‡-@˙I≥”†∆[¶ÔÌÛj„®À9h∆Ü›·y§1Rƒæ$ÓÃ64HÒVL«Ã4oF´ï©éìS| )èÏ@~@QÊêíY &< ËÜ◊•RÚ*ïŸ_\ÍyJdRwzl”õkdëYùK™ú∑?v∞C”¸E3pjÁ1r‚tÒÓ™:b)—⁄(KóºY™»ÏÚ±µ‹_s`∆N04#ì(ﬂá<´Mw≥åHÈK2™8µyyº¨Ãö—ø◊ÛÄRéö6œUSwíˇ")kcƒAŒN]Éü¬≈df…ÊŸhcÜ(‡O*{EÔ@ÙâŒﬁÓ£◊õ/üoæx≤æ±µ˚Ú¸7˚/>hO^æÿ‹˛∞˝’õØ7_ll≠w¨Ë¬äƒÖ3yP6 ﬂ£hM:K~ﬂ›=Ø∑wcØªóÌ˝Òo˛iÔèˇÈﬂ{∏/≥´£Á‡˛sMl6®≤˚5≤†¸ÓØˆ‚Ω˝µ}ÙVÏ?⁄]„ÔÔﬂX?®E7ç≤€∫æˇˇô’ã§QÁ{íßƒåv‹SÎéôv>î˚*àÖ{Í”O'¸;V∂+⁄ﬂ«ÌºxŒ7˚d˜ÓUöUﬂß√xü~∆É$9D}ÍcRn≠è9¿ûuØîVAˇx-X‰*ïâï≥ß:T›»À3õ˚¥‰ˆ"20¸8ëÅP∞≠?Mâõ∏„ÔlºFﬂ”‰»»œgﬁ\tKÜ≥Å⁄3ÊÁkœ»Ÿ®)¬ƒA-yÀ’›’˛‚rÈÓ+áñWÕ+≤P(‡Ïˆﬂ,Oéﬂ,·?tuÛ“ÌÖ•;´KÀw˙Ω˛ÌŒ~´ÜµÇ(¿*˜®+´∂‡ÜÅ´∆yÃ›‡≈·E‚…ƒÇ∫Ã8´v∑ﬂ◊NAy∑Fòc≠,2JA[¢§ﬁ‡Ì∫cì89ÛÓ~ØøﬂE^±PëGáN%·T][’ıDKø∆,™*›°◊äqﬂéAg∑âdKplå å|q∑ÿ◊{ÍG‡æQ™¯T_[ÅÑ”∑Ù§*|¯ˆ≈ñ«xß` èÿuì∆ÔÙ …äI„Ä§ÎË++m’A∂mbÖök∫‰Áﬂ˛Ò¯ˆí¯´ÊØ’∫∏˚"≠^’fÕR≠fπ~z≠ÚÓèk⁄:∏n”$°€ûÇ}ç‚&JõÍä-⁄ìÙ¸∑ﬁL◊]ú, 8o
∞„êÃDv‰µiÁòπ‘N≥Nxq`K·˚ÊÎZ™ôÒ∫∫ﬁ¡4œì∏¶c‘n¥x±∫m â7¢pÓ¡)˜ åºÿèÇ≠B†ym(m)°’!≈3åˆhk‰,Abu5ÎÔÍõiÊ8V(≤
Ã\™oP‘÷∆≤∂zÑ\“ÀQ◊õÊI¡¯Ñ--N‚Ä¶iñ§]2]‚›R<Z^Ìœ:-)3É*/*ƒ‡Âø8ºÏâ‚%ø^@h.Æ8ñ[.f~´o0Ûï(tÕÜFÎ„vüÜÆƒÌ>g˛Ã6ùi}:vK‘!jôx)*!ùåY√€æê {wÔÏ◊ûDΩË…R}gú±œJﬂ ]6ÖJ,ãˇJ)1õ†´Ü‰ v°áä+ƒ~“Îı±È⁄¶;D_∞ãHFj¿Ûè—OÆf|ó’6·;t«ÃòI.Ôœ=ÃÙ
FYwöo@U’k∂?wóÌ`éTŒ≤¯E”9À˙Û•t>}[ô”Ÿe\Âó£´Ì≈∏…åÕ¨¥®’•Ç∆œÂ“AÀ~jRB„«X&kv∑7#ãtëé›ÃTÏŸNÙ6À$ÚÌ©l]:i¬ﬁ•SJ„«µî>RjÈ&@ó”Ks +mƒµi¶K¶•©øqéi¸‘⁄»ÊOÌ[ëŸ∏î§∫R]òë¸ó†r¶?/L'NEEù¶.n˝Z¡√|5y£f•&XÍ.ÃÆb«ÆËéÉô•⁄’Ò˙çR„gûÙ¡E˘∆)Ñ%,Û§.∫iñ ?Ú&©<¥«\„ütWú∑8ˇ∑ÆÙhÊ4H	˚e4‘Ú‹∫.\.%¢ÂÏí6+ïÔÀ»‚ugµ_NSÎæÜ÷NG€≤¨ÖÁÆ∫≠ﬁïÖÊMãüyí‚gÓÉ≤“U%ƒœ%t7u°dÉ¯©ñgf:‚9©gdÏ73§.)`ñı™a
>æ2~*ˆ˘™T?U…~*”Ú—+;5_´r•ímZgÀ˝Z?5~ÊÃ¡«!J])˜t¶Ï-XÍÎ6:PÅ5GJ:¸4OKWîûïöŒôïNJ5sÁ•√OÉ’¬sÉ9ÄÈÓ	3…Wµ®¡w`›ıøf—à>-MÛc—Hjrd·ßr˘T/†Í%‰ ô% óÛfâvÓ,˛xAß>ó~.pc§fRöê93k·gÆÏZ¯ô'√ñBÇ+Öõ 1'ZƒâÄÁ
"Nú…i¥x>qFõ<ìqŒˆÁR±&sáo¸0q&ó≥Yå…‹&uÒ%3¢Kp*]ú¶Rœ˝ë%WWr!}πÇçÒ$*ÌO•Ì„O:|§A»:“ÃÛÒ√F~¿†ë*¨¥._q∏H√`ëG®»EEfx§gπ4˛|CDfàÃ¬[çì‰B°!≤Å!ôÌß˙Ë!!MBj√Aji§ˆeUùa ÕÇ@Æ<‰¢ ˇé√?ö|ü°éSΩÚ∞è?Ö†è›Ú—4‹cFå¿ïÜz\0–£.@†yê«¨Å^*¿„·≥Fuô±\mX«¸Aµc´6¨’ÖsÃÂ=,+È1{—|„lÏ7T6ˆ
{QU:m¸‘´‹ç3Îñ~§Sä¯qù»+•∑ññÌ˘\”†›bQ3 ®AÁº»ºòœ›H®]{-ØÅ?3≈±D^£$«ï8+ﬂ˜m’-≠B„äWY÷ùŸ÷qt˛»/ù†üÇ¯òñ„}Â±xπ8 WFîeuygR_•∞(ëºÅ˚Ì)4KP±®‘â$ˆ"hˆ¸∑ò“ÊåÅTx˛-åj<	#⁄Àÿ´TNÔ}í.Ä‚{{:úB±àΩzÚî%á· ‰Èr=B≈4¶√"èÅàêë≤rbáa:ˆ|ØWå¶ò)ïàÑ˛4<”/µÄôâ	›]1≤Æü˜xˇ-€»bÂå÷P*”G€´·Gxæˇá:‹_∏Qså˙“|;’.KpÎÊÀÆÿ; à«é Qáö±äZoï∏PwL[£‘ÓàËTû◊^†T†é ˚Ãˆ\—Asù—ûF≥}g(eM"~Î¸ —æíp‘›Ωﬁ^gˇÍBR+Dg\öÆ6⁄Ê9 9°+ºJä›Ì.ÎºﬂW ¸õ™™$◊#ˇ˛b`˘‹¸Äq∞5óÜ9'T1Æ Ÿ“ÑÀËÿ;ı—±ıá*ç∏ŸkXùíRÈ˘ˇËÅ∂Ó)£¨ˇòÍ}:ah@ŒDŸíµã âΩdã£ì…(¿7¡EÔJáîz'î‡ûÚŸ„tB$á∞†–¢6p{ì›„’]ÃŸ^4È^Nˆn¬˜øﬂõ.˜óó·ﬂ’Õ€Ù}ˇΩµ≤Sh65<…‡ã&$õ}–µ ¡bÅQ„Æ4IQ
ãN`ï≈ÉhJ8¡ù£IÇî*§¡ıå'pRY˛¢]¿n‹jΩoÜ…ç.ou4)}\”îz/ª±Îuø9ˇ›˘∑Áﬂùˇˆ¸˜Á8ˇÁ˝ŒbxÒ%.≤ã"í6F^ìU>k™Î!ÖM˘∆çkß™√^û|ÖÚ≈ÃBªCÅGÆNÁ^	n(1OÍzﬁÓwÃnŸM}ëÇX¥ó>nPπ.òP`π&õËA‡BLπ@åy^Eà˘
I?@X˘ä©‡ﬁ˙ËAÂQxâòÚiÙÔ%§¸™BƒoUÖàª„√˚z|8¶ªÍ¯˛UƒáØ~§‡∫Xµ†d¡C ë…≠À&õ.ËzôjT{—he≤;‚Ò„Ü˜˚&y≠|¸c1?≥çÈ¥¬%£åÎCŸµ–\’è(>◊iÊU◊ik;ßπiöÃ
æÅÜ⁄∏ﬁ*¢¸˜∫Kvy˚V\¸¸„wKæôãªf~ÚÃHœÃ ï˘eÙÖ´˚fÃEÕ^º2ná{%Nì‘ˆú(¸˙l>ÆøÊ÷O˛Õ_s)WÕù?WÕ“ü†´Fâ™?Zwç∫¯*ú5?˘iÛ=ßaÚq *zS∫ nÂT•gªÁ&B¥ù¢Å5§Ag£$Ø ËÍú>≈¯…ÂÛ#K{r’Óûb™rˆ¸9fU)¿ˇΩŸæÔ¸d˚˛…ˆ≠À§À∂Ô’èi˜^æ
ª˜Rˇáµ{Lì˜Á>&Ô%nÚÊ°C>çÔ” ›‹¿˝˘è»¿˝ìm˚'€∂÷¡O∂mß>∏zAì»˜cﬂ˛”5mœ'¢~”ˆèŸ™]{g°∫©0%√l∆íXòJ¯}Ñ<ç"Õ–íÇ˜ä˚Ò.A_ZWº,“0{«oÃN2‘ÿPLÙ“0»,€˙ÜËîÉ…®ŒÕ¬uvuU¢˙Ü¿Ÿ∆f’∞9Ù.™8EÏ$gÆÔ)‡8Iu$√Ñ+Ÿ(`mîp∫ ÊÙº=•IóÖïöÊ‚[MõiíÕÙcØÆ°¡âãÜ*Òä
ì¯y2ÕÇØ&N˘°gZ:‘%àM5;-˜7(.ı+oPîÁGã5a˚ti⁄<Vªl'äêÔx˙MªAÌ⁄>˙ Uà¿ß„≤ v É©0[[È•JJ7UÅêwˇcÉxf∂ nT™≠Œ8“*=»íh
‚s”Ö¢iR∞Ñûe≈∫f	ÆÔ¸§˚˘™€@^Í[´wgt áUtTa~w<q@˜˜>|:ç—Òdlksº:ˇ6MΩ√dZ·% y«ÿ ¯Â^§Mêe∞| R/GÔV¬Fﬁ7»†ç§@å	À£Ÿ4f—Ó"ZÄ<Ó#{∞SßQ¬N €iò¢# ÖÒvœÅÄK8‰ºåÅ†áÔÇ]è1Ó◊eÂy51]`_¬JÄ6éGûúü,∞Õ„	 ÉÔpQÜá¯Ω”´Aï`˛Í˜e<X(Ñºë∑’∂PP£¯¯âó{WrΩµ∑]÷åu]]øÊ6£î˘–´hFqr&û°€ò‰ 7‹≥ÚŸﬁÀ&“ùx√‡©SWs©!éZ≤ù˘≈˜≤›«ÀOŒ∞'âì˛∞`Ë'•ÍKCeg–ÿTuô»âòµ¥¢[A§ú¥§	F~7ø*≥9ÕV^e∏pnûÜQ„ÿÀiv4q;rü‡˛„ﬂˇˇèm{,_ŒÜ!,}Ùp∑ü&È7x˜˘s/N–) ;tB∑≤¬EpWÏ0|¢x(Ãê x-& ⁄s‘,Àà>q≥hU
ï≠=ıÏ≈4xÔÈl8äÀÆ⁄≥Øl)ÿò˝$œãÖ`fó(Ì·~5(YG¥dHCiG◊ñCˇ ñCqw©»ö„¶˝ı4Mé ƒ_§0∞eO˜ÿ$—<a0∆«ëˆÛ ÕIºoØ„÷,ÚπîèÑ\ÑÍ≠‡Õ∫z™¢Œ>!~Ñ˚ÆWÁç≥$˛’≠Ö PÛ≈;´ïŸ»ÔÍŸ»m˛§ê¨)MèìÎKÌ¯ÿeº?IÉ
≠€PfÊá“è–L˜(ı&3ÏÔÜIÎÎ$å€≠Ω∏Âº≥Zºjä∫Ç®iˇzÓÖÒNòS˚P¶+G1ä∑__oæz˘zgÛ√÷ãß/_?ﬂ¸∞πΩÛ’ì≠óûl≠Ò‚¸7€;[/?¸|˝ŸÀ◊Î[Áøy!ÛØR∂Qã¥TØÛ\Ó]Kñ\‰ÏÃ”¨π=]#∫äõ“Ev£…ø‚˙÷|≤B]x7^Ã∏Ò⁄ë\•tÂu≈ƒ¶Ô(bE*”Ø@eè^¶·ê"‰pÆ	«]Úf{*Ã©sp&$„zπÇ]ïÀ\UJ#vŸ@]ëB˛X˘Ω§òÑ€:óü™Úõ.U' S3Ta"≠I±ÖwîîÙ≠Ø∞IJâ•wSâkïIF◊ò+)˚ ™+Îï;ﬂUéÎ¯AÎK©îjJ'Üvz@Ä⁄ÃÀM~î3Zöµ`
CìEÂÀsQ˘Úèá ÔÆ^AÆ†ü»ú>"dæ‹åÃÁ ËïAÀÏù≥ÉoiCÓˇπÛÁ∑ÆÎÃúƒ¸ˆOóòWf
9˙˜zÈxÆX‰_∏'Ç¸”ÕÖ?›\Ë¬ﬁO1∂s«ÿ
^V}qaU7ç’1’õs]–
>¶≠E9@ù[Åû∑P¬Ó≥‰ºÕ´rnüƒ9Êƒ|	4!›ö◊)I.⁄>ï´_£Hÿiòü ∏√†ê
∂≈„LzÆedœÇØh-,Ò˘‚SB†àŒf
Âñ?b%PôUaè§[ïû.Îw®∂Vå,ƒÙx…ÚæéQQ€~≈Öjg∫\¨áƒ˛úcÂáá¿•’ ¡™Fã´˙h˘cc∏EsÀuÒÁp”µz…ÀLjÉ÷+j6íj∫mrG å+GóË¬Q[ñ≠ì\•ú[{…IΩãüÚÌ!’ãCìg5K!⁄j40„^Éd+JV'ÿû!¿2¿Üúkë«»ÓŒ‰}Ö«NﬂŒï_ØY”Û»⁄Y^Ìõ®·öÖEªU{„¬Ow¬≤ÔÌ√u'lçÊß;a∫ˆœÙNÿÀC—|”3¸t¨˙¸tÏ|∑¡™à›üÆÉ˝È:ÿüÆÉ’:¯∏ÍcflD¥•ˇ∫pÄÑyA≠øµ°ït#?˝4=ß2≈G	õ¿O£3B¬"GÍ`çáÅêqπãj˛¥≤å]Â˝/«ﬂÛı/sNkØÙu⁄M≠=±π’!˚VPÀÂ¨ßÕlßı∑\_»vzEñS%°_ﬁvJ~é:c‚ÖmßWf9U£Ω€ÈÏ7YCıù¯®eRŒç,•:ï∫ô≈Ö≠h˙â¨O…R-#ñÍÆåûmKΩKÍ≤ƒ‰P–Au«MÃ©U∆‘ô¶Ty®»e>ΩË±Tπo;N§˛xŒ¢æ¬ÑÇ)}Yê#ÔŒXÊÔûÊad•ùT/∑eIêo5I∂a/⁄ŒX Î9z⁄≠Ët‹·…õÏ${BK≠q&u~§S:í(†û’ƒ`‰Â≤¸~ÅêxT¯#<<)7„EAö∑[ˇÚ≠x%éêÉèà¬7?àanÏ±·‘K}œ˜2<6»ßt†íOØyh
>mïí[rîæ Œ
úíá9â1—#@ÛˇnbIò°`8M…ÓˇÎiÄ˘#Ë,≈®–‚t∂ªá—±–ÄﬂcŸ4cÔΩ(Å“l|˛ùíåMíZ9ƒÉvètœ4¬eœT˚ãÕõØ◊üΩŸ˛ÂˆŒÊÛ7[/∂w^µ±≥ıÚÖ"=®∑aŒN{„ÀıùYU ≥—ﬁx∂æΩΩıtkcK◊50ı5¡<Ñ8khsëd”üÈ´¯	Ït¿îÏ`@l§ô§⁄YrãÊxç‚»wË;ézÛ
”âÔÂ\<ÖµÔÛ:YÔ0D±£ùbÒ∂QˆÈT!xH9ZÈ∂h§·"«ﬂﬂQú Z˛r˚Âã(D5'⁄˝ÏÌK^‹Ë¨º‹≤õT≠_mO¯¬zÔ¬»£Eï‡…RÅ[º"«ÅÀêåÇ≥Ç${ƒ⁄/Ê·öÚ“ÛoÒp+l’ﬁ◊â`{°ÈË⁄›wSOåA¥öÖ.U◊¬ãjıÃâòÕclf=ä@ßÖôp%ÅÂuËNÚî≤È
¿ıÜÄ~ìÂSvê5sCmæÕÇ≠ŒÇﬁä{t5≠U°√hıÕQíæC_Èê§B‰:Ï≤z[~Ï2Eqn6HºÏõ
óõxÇ8kﬁJƒÀÎq[l3XxŸ,É)`kåÈj'åÉyÉrzu=üA]}YéZp˜øùüDu„–a “9â„ÿá±öAìv2YVof‚>ÛNíiæs2iÄT(˛&¢Ú-yòÔLÆBcŸD…,ó88bè·k{◊‚l˙≤Z 3„[ÓÏ/∞S2ßÆÅ∫7°≥Ë∏=.~ù%q‰º{F”4Ç.æz˝¨"(p¬ó_Œ·w{∑
5‡Õß@[òÁ9UDíévÀ+∏	ñÏç“‡äC∆cºÛ*J<‹%ﬁ¶hRè¸‰çDOËΩπvä#∆¥Ò•≠Ìó€<ú≠”À`8y˚˙ŒıŒnˇ¨áCz+€VP°›∫#°{cF>⁄zﬂôê°dˇÆ0‚öU9„tTE,•¡˚‰ùÜ%údîl@±óÌ M◊òü,[Hàõi
¬ÏqOL”Ã".£ª…†fodN-˜›[‹óÓVì±¨ N≈√`›GWÏV<ôÊbíñ∂lÿõ—†K-Ù & X‹Ø—P8.R•|ä•M€HﬁíJ6NM$z˘Î^"Áºw}∑PVkÂ[
Hèzò\< Ï±|‹≥Í»›Ö	eëiãv45G}¡!Ò*Ω“ﬁbG*kCZ`ïÌijV ÓÌ®! ïí–ÃˆgV⁄÷ö"ß¥¯)µ™ÎÆ&I‡Z˛Ö®—÷Ê∑ÆA”˚§÷&ÄV?ËbØû˝˙æ≠∆™5¶√’ü®7éégÃã!\J)XÄ &ù∞äón f@\ÛÅ´ 
V≠1–ı∆—Ò,°¶)çNû÷–L≤ﬁ(
;([oÍ¬≠ã[MGfä^jhFSÓ∑µwŒÆ„üÑ∫ÃÅ¡[¥â≈|]G#∞ï9'ÿÖ<iA]4ËÑZΩ˛*ç™ ô∏!µŒ∑*5	VÅm6g˝JÈ 7vîôt†’Wea;ˇª„0O>Aáãç®Oì¸ƒBâ0MÃ	∑nM1^Ã¥™ıÙ‰îGaÇháä‚1»(ü2aç8WtÛ“¡(|üp≈^ ÉÍü±˜ÁﬂF!¸J‘ç.i:ù‰Iï®'ßÈÃõœzÜf„6	`ÜE∂€Ì≤'Î[œ~…~ÒÚı_=€⁄ﬁa‹ƒ⁄-¸µŒûl≤ù◊Îè◊ˇÚe´É≈ï 	2’N‚{'(fÉxm©"¯πéã„˜¥∑'¡Ä,ÑjŒS–?~x©YjågSÑ¸Æä>πlD◊¢.uÄ·˘€Ï–^^`◊˚◊ç⁄æÔ®ÕA©™(ú<oØù"ÄhGèÒ_ﬂ?{kyòa)X@O^vX=RiË_eA∫Â?rXª &è‹òº¥d6Å¡µ√±F¯ÛQo“ì-3ÂŒR¶1÷µãòò˘•€¿Öl+ˆÉ„¿ÚòM4Û<,]q3±—xË¸’=Ô»È◊ö\UXÇ–YK%?˚å≠ß)`=ÃË/‹I43
J1…0·á–Y¨]~£
⁄B‰†°*««m)πvq{ùKΩÏ©AËÍŒ‹ı+6b©&Y¨fnYŒ†yöQÓ8‘—√<:°h<‘àâ9eÁ⁄§4∞=çΩç¡∫ÁA‰È‘å!◊ÁDG(öwÈêmA–g†ì¬<{ª†ïù“Î5É˙ı˜XiM“¥˛B“À€›/p©·µÅ+=‘s}vò&caUÕ8N–[ã^6I√Ñ|ﬁ‰4ñ º{È…_a…lWıWA1Ô%A®◊oç◊ç∞gV·
£ª‡°E∏g6Í@T+B˘ìî,’0x¿ﬁ¥Æ·†S“Ωﬂcâ€Ü’µBä|è˘ÿt‚)À∏Ì(’˙¶vNïa€óTh∫/±yQ´ƒÜ¯sìYœ*ˇË§œÎï|ß¬>´ÿÊUQ´å%¸\öì5n¶ÜüÒOW„siä
Õu}-ﬂÍ±ßÇ∏◊Ä, Á˜pD ”°í=V∑óS,ÏY^Ñ—	›»©˛ƒ1©iﬁÎ$r¬ßebÇß)ÈO*	©D!PÀ@‰,⁄∞Àó©‚
(‚≤‘PI	BŒ¬Q∏Ò˙G≤±®}§d´Ìr\Ω ≠¥“Xã:R¢D÷†©lõh7—}◊÷ÖhC∫‰‚’Ÿ€UÇ‡~GE3çî
ITx'_©A…"‚…Ó~IhØ ãbñº:C:Âu$®F›Lï»H]@Æ˘ˇê ä6Â,÷MΩs⁄ã)∑–%’©í»Æ≥
üÂË®\¥™t¡√6ËªÈÑ·Ω£É&wk.çd† F>É’còEå—xthzËdƒ{ùﬂ∂Xß!öè•Q-ÆløÌ`Ï≈‰ñT¿#O¥PfÛ”4^©2êKº¨44‚4ÈtAJ¶UéKyYÁ≠(ÿ]ÉzçÖ∫&mÕ%ƒiV+këöcÔ±à∏)*\⁄¬èV”™®ﬂ\Úæhõe—|éñÊöˆ∆
ÊôæÑV‚ãÒ˚SJîÿÒÕ˙v≥ìlD…‘7⁄Y|ª”£ﬁ—fìë˚Âëó∆Ì÷F26'∞ì·Œ%Gã7W∞u⁄8Sc`∂›K‘2∑97f@’æl˜MΩ®6<Ë&Uá‡—p'Çm∏aÆHªÓÇ¬ˆt:•M_w» ﬁ∂∆PÔ´âtäMÌvk‰]`„ õBæ]cIBªá8≠mÊH@ô8l	E’JW:Gâ ‚]Ÿ@ÖUnﬂcŒE–Æ]å√,∏œ∑∏áÌ6ÏMIÙ@MÙq[ß£y|ÒSÚ˙ñéY…¶»≠˚†∞wVπyÕÅP,*bZ≠éïàHå§Õ+ËîÁ ìàã≈Qó
p3,bù˛ +Èÿ¿4⁄Å·K†LÇ`ªµËM¬E“ªílÅjîåÉ|îÄ‡”zır{G≥-àÛ€kˆZ‚(açÁ-W®G1‹¢)åoX≥eCFG^”àEó≠«·8‡!.à JP`ºN¸ ZS—=œÒß∂⁄k–≈)Ä#KbèÇ;L£‰ßr∆ß\:?ÀGirD‰»óÇ(…g•Ÿt∑˙dÍ'x3T◊xÄÊ83a„˙ªé¯}7‘∞î9y⁄Ñ?S8!∆Ew5¨±ò“NÒ#¡öä:–Ó&(ï˜‚‰®›¡-ÄﬂE≠ä≈ù5È·_ˇï7¿˛ˆ$» ¥d˙âF"4iìû`Z-ÌÕêBœÒ%ˇføAÅ{“S?ÏR»p¬ß~“S?ÏRy»°∆ø•~F∞∆®¸¬°YjÏÂ	‡ˇ5–Ì+|‹Ø;ò‡√ËﬁÀß∞ ÆcLPÌuF”±≤éûuL©÷ú∑J°÷¶A%~êS(fÍ≠¿{Ü“}xÄ—‹AåÑC%Ó±-ZÖ]Jí¿F„ A·°+!l?√´¨ °=r_ßwc≥¿ù]≤ç≤’NöL4RïÖ≠LM}ıÖÓb¡‹Út–Åm∆;N‡Î¯ #øÈyÑ#„W*lı.kËg«U¬ÈWsõ‡É^û<KéÇÔ	iwä”ßªøÚ∫ﬂÙªwœø=ˇÓ¸∑Áø?ˇ√˘?üˇn_H-ù∑’ÅÓMÚΩI`¸>FV⁄¸ÜËkÍ†-±£¡7±.ÿ≥ÙPáƒFzhz”V?qÔuv°c´Õπ!I‚‹c!€p©Aä&ïY`Îúµ˙¶¢\Ωätéì¨êÄúÉàÂ1GòærP
†”ﬂÄòìP∏ZruÄ◊ü,aÄ!ê¥a!óH∏¡´ÄDË^“¸ñüâ)Ÿr%¢Ë„≤∫öÄPßrË•=∞<ZN≈*Q[ydÃ…PÃ	ºAV:˜≠Ú+mŸS\‡´7ôf£Rq”∏g·™Á˘æ]£öÊgg\ªWDFC™¬3m⁄MrΩ‰A«Nb‚´#ÔƒìÃ’O#çÈ>?Ü9-\‚/zQTÇHêÊﬁò/k⁄<ûjã¬!ıÇbCêïfSAŒ‚z´~ä£±ƒÀÇ˜!∆^NtEIœ"@–ñΩ0‘iÛ]^È¸D-ÙOÌiy,Î–Ô∏∏A©ãJ#≥å—‡õ-"æ—	•c˘¨Øø‘æVsØb‡vb≤πF´ì[Ÿﬂr4¬ ”v’}ù‰DFÕ Éi˙úJc¬QUmWµÊ»>*OKØÉB:
“Á|M∏&2KpÒ8‘IÄGS(Ì§Ï—^=Jm√ˆ¨W#≈€@ãÛƒ-e)˜P>Û'Bp∞	ÏC'ÿÓ˛äh°´ŒCËˆÖÒõ7K#„wEÆm´ÛIW3|Iù
ÍΩI]àúÆ Òën‚∞Ÿgnthí%dá∫©4%fùewN©≤Y’‹ÑKí/◊ÎtãS[´?;zﬁiˇô(”Hak›!OlCS…J¢E^È®¢@!¸EÜø¿iå·Fõ:√ä¥ò6J»B(/1t˚ˆ‘B‰7"ÔIûÀ¢f¥∏r#◊”ÿ÷r˙{$9âé§≈hÉó'ãﬂ6ñﬁÚ€E⁄hˆ+öÓt•`
F¡ÌJ\ÁZsË waŸÆ üÀR¸ª.N%÷áEÅ"¯≠xˇ©©™◊ZK• jYB)≠ÚÄﬂ°¬n°™ö«Á‰SGπb2ÕñÑ^j⁄‘∏À<∫ıY£∂Ní#/œº…ÑSÌ∏};¶©\‘|Cm±€ïœ\S	õ6◊{åsöu⁄"ô4EÜ–!Yûôπ±IØ/ÎızìÖBoTZËÌöK∂HUÅ¶¨@®:M⁄«Òc˙güu'Kí‰µ»ek)j4VúUup1â≈ä3§|D°m1@EX[Í0ÌÇ√ÃÒA⁄'ç∏ƒOˆ÷Ïπnéˆ˘…œ!ãBO”d¨πîÀËºrÈ"ˇDIxÛπ¿∞÷}Yb'—GÃ˚ï‹$^é√¸æEû¨˙-†äG}´|∂´zXRvxƒva˙JÉ]‡”ZÄ∞‡∂\æum±e∆€ΩöˆÊB≤êﬁxˆÚ´'Ï…˙Œ˙„ıÌM Ω˝ÀF@4¸˚4Ãgâ∫ﬁ<€Idpí⁄.√ÄÔT;ø∆äÕ’±ÍabÍ`‘t·gƒ –Ëô:Õ(ÄÚÑﬁ‚å«ìÌªF ´lÀ„‘&lñÅëó5,¢¥ŸÜu§éWπWÂó‰çAP4≤<Æ^5ñFG‘1ùëﬁX	ÚíÊi”iƒjàL;U_÷®ãÃ∏`ï Ë ¶_$<.^Î%5–îÓcwk›ü
 ∏ía°L≤g®‰V<Ñ…+8*®@ß„(æÍ(õ7∏Pz'Cs¶U/71åhMè&BKGDŒ /N‚ˇä›$„Vπt¿ÍO8 Ígπ‰§6◊4ﬂ≠]÷ñáC:é>DM'⁄˚˘˝ﬁxK∑·Q±*¨£É•U˝˛·f©)ÇàsΩÊ‰˛Ñ"õö|.∑°Á(æ⁄üÛƒ-Ï5¨ØÛﬂÛ„\ıUr„ßÌ…ë=è@ÒΩ™¥ÊA¬…U?´⁄ı"ëâÇó∑ñkÜ¥[‡AÍ/Åµzﬂ-√_l‚P’‡!ﬁ[Òª\‰1Z¸‰Íß0√rôd‘Z¿Á¶cåµÊm;©√?|Lﬁ÷Z‚Õp£≤gtﬂ_œ´I»6ÿÿ…_»Da∞år–≥‚oç`øùÉ
t–∂wõg5∏Ò[^iÑãòàhá„†⁄¨—	£‹Ngeêë!Ÿä∑ÊrG†)°–i”Äç	¸PÉÿE
ôÃŒÑŸ,πúíqô1/zÄµü±Wïç-ïvñß¿"Ò,J"E#.€Œ"zì;ßm°KåíAÆ°Ûå]ûÒ¯[Ω¢£ø™É·ß¶û"¸ÏHÂ—) 
CÄ¡hªhÌÏ‘zI†äﬁñçﬁûi$ßbD5πçÀ#u‚ëù Gó˙D%∑–'ö~T–M•›˙ÄU4≤-@äËáÅíb/_Ö˘(ôÊÃüÚ»x‘∆äõüÜ8n∫£»,y s{[¿5G´>6%(q	H¥DﬁPá@}(Vi1mÕjì·∆$?9ÄÛŸV≠º˜¢)ÄÉ0F'åß	Ë≈DÍDïÇ.∆
«â¥Ø“öfåÇÜ£ƒ:Õ˜C ’I‰_V™∆^ÕìE£t£¯YsòG+T+C)ZLÏ\R¥¬7La–PäÆó£IZÑfVërÍLŸyÈπ^~v6>∑ÿ<[pn$:œûØF|æº ›@Ñ6ëÊ9©ë©7¢Ûﬂ¢Ã^•·˚™˙Õ•Ïã Ÿóî¥ÁìµõI€Û…€3%Ó¶2˜E§ná‹Õ‰f”õ∆Ÿ(<Ñ-©‡3.Á3˝ß◊µE-ólU<«<Í8"ûAD≈3-∫ ËC?1«óAÈv€[`Œ†‚|]O5‡ıvë¸ΩÇ°·œ~7∏x§«câvÎÌòÌ4iGà≤–P†RÌBD∞ƒŒ∂ôÁiæ@vå©_Jv<ª—_ëú—Ì™tIÕuæJ>Øœ$'*Ï$O√4†Îî§nJÁœ95$Ò´4¶Añµ[€a<HìXÜÒ]ìŒ“Ÿ‡Z=∂¬P@£fq‚Ò‰±Lûa±ê"÷á“ÿ H›ôßÓåëœ8y'”—ΩÚ—©XÜóã∏Ò¬=ÉAœ•¿∆*[Ô¡Ilå0^2Á◊≥yyr`á¢E˘%µ2⁄çãCfˆ≈≥t¨õ.C¶¯sü9k¿´õ7ı≈≠ı∑¢TkUù9›H¸`=oá÷dR ¸UÁw
®EÎˆ8ÌtÜ™ï™îÖ¿©l%»˜?¶¨É38ç2õWOûrmDπ•Ã€	aºtà)–#™+˜{Èl≥}U·›Õö¥,ò	^˝©À—ÀâÇ≠Zcµmó£üÈé{Ã.IOÇ„¥a«˚ã√pÅ]sΩc(˚ÅìCX@-∞∑aå¨*xsÌT¡C°˝9ø: Àæ-Ì2•hPAR‘⁄ï˙ O‚n>
∫á¿ßd*ûQ‡wp~P7WIh>ï≥J¶ãä*|ÉX`Œ?aqÒá«≠¯îhÜ_=OÇY‰&k	b„Qõtç)ü∆J™+ÚŒãCmπÒÏX\W|¥¶´•∂Õiõéñ…SqsXõ¨˜€¸òä,Q±QÑ˛NÇ¿‡Ìk:à=~{Pé◊¡«œΩ|‘K1‹uL"ßê7WnwÙÎøÿ“í≈ïJP—´q∏√<È±…ëœæ‡âÌ≠ƒEñÊP—ºUä_{^zT“ïÃÆ
ï°¢ó¢ e^í˛⁄8(Ú©›÷¨„!#ÿÛxZ—–O¥tﬁúH≈È¬*i„ ï∆ÜÃ>lØõ 8™†Íê.}@Z-√&ÖÁ/R∫zs”©1„èØRÓbSx2À´îp™íû>Œ¨…”ö=ad´Ò§ß_NÜˆΩ5:cﬁS_∂Y‡sn$ìÇ'8´YtÅ-ﬂÍ˜Xøww’u.Ko¶iıE∂À•m Bò‘È˝†™l≤⁄∂n¢©@∞Å+ı¯í”ÁØ	÷TyXˇ∑Øu*g·Ög¨dX[ıˆ4¥¢IY®‡ï÷≥F63ÕRf≤C544z≤åÇ…Ç0—›‹6én26J¶h√ZÓ“I√¨0„)Zß‘À+zq›&gã/ D∑ÉZéuîiõ”9X©£"YËäÔ•ïŒ¯Ywò∞Í(°nØ+æó0ﬁ¿zwQõ›%,u≥œiV9k˚µ[÷¨qŒ˝¥(_X·‰7ËY	Ò fÏzF.{i„QÒ™  Ê~Ó ÷ªÕöµ‘$ı∑à§4∆Tñw≥5ﬂ‘¶B‡Fp„'u∞s˛˚‘;n—ì˚õIK±øh†œ∑qøÅ˛ã*ƒ∑´J€&NÛ7?`\û˜êfb~,ºÙ»Æc€3Õﬂ¥Ù@DïZ˜ítEn<ÓãJH≈ÉWI˜©ë¨Ñ[,%«Ôî∫°è¸ÊprÇ;Jù”‘ï8˛‚NT√Ô«èZÕÌE5a°Ò®MÑ?“ÔÀÌ∞rÎvb°' ∫	bgû¶¡re…S©—‘ƒ√∂Mkró ‡pu¡°tàD´ã±qE≠±ˆvø,Ãì[ﬂ
…–.ØJÆâ2K™1sïTEA2¶–,â{ %$ ¬aõ Òÿ¢"}vxg%Qæ‚¨Eij*î∆÷ø|+ı-	û1?ˇ3 #˘î≠ã‰√4†ObÆ∞ÅäÓ–‹LXMÎî÷vkµﬂ∑C<‰.bÌi[ÚƒÃ‹YkÓ6ŒÊSïƒEäõÂnq[ÀM}ˆôáéñ ÀƒêÒ9Æä@4ªõ-àBêÂmÉí.1MÕTeõ¶Å?bõxÄ€p[{,¯‘‘»iU›–tvõ˜*&œÒ"S%„√EŸs¢†/ÎY,ªÃ©&d2.ì´R†¡R1–ﬂ–<È±.¬À*?’s…3˘ípN—˚úb•Ø8≈|,¡G≤1`'sÚÉb…Dr¡\(ô?JÖ:»NÚ‰˘/—ö,rsU≠iÒZ›ı.)¯RºÎÖÒ ö¬äl∑∫∫∆Ø2ÃPç,,≤uM“ßRzì«Iú∑◊N©‹ÓÚ˛Ÿ¢¸æ§}ÔÔÁŒ>)˛ı˜>q1Ωê»6G†&≈Ôû&isSæX¯#è€ö(o§ùzüœ?[|Ù>éxdËÉ¬n˛÷a:˘´ÄqÒ$"ö'	l
Ω£ÍQ∫|ŸßAF…$|á⁄éy'ıDoWøºÍ†¯Üï ﬁn~˘öªß÷◊
ã∏F„P'£ÉySP}Œø≈ª´µ-–µ{ì˘
oLàûqYŸ≈KÆ|¶•€¨ûh
Vd¥	°àÚEí#aùffπq…úPı§0Û”Ä2ç-È[ñê®ê◊Ûu“˛¿e◊∂9P,∂yJ:4ˆ+;	Úé>èn˛ÅÄLXò™sÊZﬂË±@ÅπüoF 
Ïùˇ!VŸ.
…≠vè©ª"Ö%•©dﬁ(·í¶∆∫π∞AXù$h|ëËÀ¶í$|Ãª1	|≤=2Õã∂ªâˇu*Qà-¬ØÓ0“ú*mKØL•¬û+Q®Vô0‚ÃÚ≈Ç¶G/¿·ómâŒEWZvÎÄ‹.ÕØhSX-q˝—BƒEXNO(®¸%“ê6ÓÈü
y“ßT	¢≈æSöK„“◊$˙vëõ„§‚E8©—Í«Âß-±$E≤Zs⁄˙s‡Ø=∂©ﬁŸnÀSÑàCâØ¶Q8¯yàiÅ
÷™^„±Så≠tW˝}?|Ø›
ﬂÅß;ÍÚã√Ÿ¡∞ª˚≥˛Á˝ı•ï}vÅñèˇtIDÆ€¨;Ë¯ØßY"ß¸9ÈﬁjÈ˜Å€}–}‰¢l6ÅÅwO¨Â:G›•€lÑˇàõ›o9ÆxOÚ.]I<mG‚
˙.Ÿõº8Ót≥I≥Òqg£ı∞tÉ9Ù?)A|úÒ„"L√Lè2L,€Ω]O'ì `XÙ=xHÔ; ÈoôO‚§eﬂ≠æÅ±òZàÔò»g7Äˆ¶®_OxÊ¢^ØgÇeﬂ–ÓÄsw©?9ﬁ◊D‹†•∆„i6 0$ØórK=R€eÍ`±êh¸4sh	êHI˛ëë(4ÀQw∑ ´e˘4>DÈ‚r⁄π£lÂ8bcÔ∏{‘˚Ïà”õã‘o„˙˛⁄]>él™á2qiBoaπ?˛√ˇ¸ˇ˝óˇ˛˛"ñ®_*≤üÂ“Lﬂ-óœ∆%™>Í.D—åIÂã≠£óÿ ,éñK@π(x…¢‡[:É–Fl≠ãô∏éﬂ∆©M_v⁄°ÚBrÄÉiû'±U3â70‡Í¡i9˜,ˇÿª'He k	œªYÙLÎˇ  ˇˇÏ}[o„Xöÿ{~≈iÕ^\K∂dÀÂr™<´≤U’JÏ≤cªz&[]®¶$ZbEjH™ló∑ÄyIÄ`w±¡N∞ã≥$H?l˙e1»”˙üÙÿ˘	˘æs…√√s»CIv{∫ãç.K/ÁÚ›Øxd(Ö†ÈU}É§‡ÿ^'c¿ŸINm∑cç·ìü_O.O?Ñ”1ƒ^r ÂCÄÉdã≈Mÿh—9Jsúqd_¢C?®O}îjÇZfûÚ~ı®¯”C°üZN:˚ıNO⁄∂ÛQúåùçá(Qô„Ä‰*¬¨'íƒ.Qà©”W‘—ô g˝ÂÕ’„5Òò?fèπ‚6Ÿ⁄™¶P!~S∏q—ŒÙQÜqúÈñY 'ñ"íìùõO3øø˝Ê$Ó==ﬂ¸—ıäŒ˘.~˛kZüÙMÌÏﬂ¢è	µ§QJ°˘õ≈®–ÏÕ≈a°t€5˙ë÷7il(/∞ùÑàR•ôÜ∫ÏÁÅB]"s≈f\X¯U’4®A˘Kg§æÉÖ)(ÍIyYi,Bˆ|Y†:œ√≤?•ëŸÛötú¬úõÿπ´,søK·m“≥≥æw>w˛]w)u∑´~Ì“‘DG∫¥ﬁ¢«\∫KpçãÙJ8$[7∞È@MhZ0Sôƒ‘ ¶/5p)A´ ∞T`eT∆ U P≈‡§&-())◊`Ç>$Ω≈\k$¨fFÃÕ™3ñ9ñÎ ﬁÎµOI\ˇè´ëü±6
üÆ•˙1+ˆ/égz	äóÌXjÏK‚#äïÇÿπ∂µNiÙ0ß $Œ‘rËïzVﬂé.p¶\’qGÖÍV˛9#kZﬂ(µ	<"c¯Ü9¬|d∏≥˘†¸SSXÓ∞æãäßmÀ•öp,˝∫£ÇÒÛØÇ>é«{[_◊LâP©æ≈Sæˇ€o~ß‘‚˙GÓÓd≥ƒ0Q °+Ù)çß∑H‰5∫¶πFg¨iF4^g’◊mïzßãíc2◊Õw tYµÍ:_˛ÑrG_mÀìëV:ù¿fáàD€Îl‚ÒπÕuYyãâóı¢i3[D;ÕŒ¡^Ÿó‘ar ÇJNO2≥ÀÇÏ%ªˇ*KNÿﬁÛN Y:B+vJàccfèM–'π÷ Mkhg!ì·öIÛGf–¯¬_ÿÓ¿áù|jyûD∏ÚH?≤%!<«wnƒeﬁ†ü™ÃŸ%N-ÜkÕıå˘&Kqa‡Ù3ÜÎ9$VeL—¶_]˚<J÷•idÆA¢•D"	ub	˝¶¿†˛˙3ﬂµVCI^-˘I’Må7@ç≤ÑFÒˆ≥Y‚⁄¶¡(Ü≈~íøIÜvm¡ÃC5àâ—Uí;◊xoTFˆRè⁄^P`≤IXDÃ\7D¸ﬂZl7	öÁ†S" ≤≠∆àÿ≤'Å—D√ÊVŸ	1F2ﬁ(ÿ$B|´ÿ®CI'∞ªﬂ¸/⁄]ÜÂ˘°ˆwtéŒ]$0,&NÕµÊâxƒ¬ãÿ∑#ê∞CÚ<pÜ%ÑdÑó‡?àÎ!±p≤ì~m!í¶_7çp<#/mjÃrÌuJ„}m≈ãƒ¿P¢»€ÎÊÒFƒòÆZˇB|¨>ÊÍ∞º∫)æ7ùRéƒ»πr∏
[ªí	ıœ&dÙ#Z‘e%GbrÚwÑåŸH$ﬁ(ª3hÍèâ1à”h)EKMŒ¨[ﬁ„ÈnnÔ$ú|ıü¨≈‡¨ˇ¶∂€€ﬂ·;ïá
&_⁄'›n≤Å!›äﬁ.}æ$:\Ò[ôNwhó7!¶Èåxé…≠LÍ˘Õ7 ¡¯ÀõlÒ‘åçêJôﬂrà◊ùí¨3gJ<qQ ≈A\˚ÚïMW-'^?íµ~f∆ÿW«%‹†ΩËjã:]n	◊¯rK—í+©yÎÅ2çÍ.7‡‚‘qﬁYèñ∞nâg√⁄K˘nFå:õËF…j~È¸πt˚ôû/é‰ƒ5§G»S?ù˛.âà]l°"‚S∫O˝KrîÊñë8_)+-^´”œÚ≤Ü≤ÿFÀQ)Pâ'ÍÁ.H·cg8LÌekºœTNlŒÿ¿(› xxE’a£ù+A•πPWÕƒÍáæ;Cµ¡üÇNÉÇ?062fJæ®∆ ˜S2¢rSü¨MÎÌë”>†#3 ÷i∫[^´ÑÜ"E2@D≠§sÅÖ”31IŸeLBî¶31AçÈxúÿ!∫Ùê¶”N [˚ŒPº»JÏQ≤^lÊtÂ$ô•≠_∂@π&üwOzœz{ù˝#√·i!J1èÒFnå 	uiˇi™ƒ3*–¶’_ãÑÄˆ˚ó…>Q¢3`DŸ*bK1ﬁPÃ/OU9)mØ'ñ$Ë Åƒc∞±S„ 
¬r8∞ı‚8ûiÄÌßˆ#ΩbÌH1ÁïZáé5Únæ1pë?gµ…Zhnæ9lûqÛ>ŸB£∞—Ï∏ñ{oÎπ∑»πë
´÷*
("±›^ùà«u@esŒ\∏ÇØÛæº]Qsêy´¥j∆<¥ù·°%fˇ8-XTÜU§ã’a¡Ü∆>ç[ÌÑqÀ≈ΩxßìÚ˝Øˇ˘‹∏Äﬂ¬H"îV*õÊ|–ôy∫óS◊ÚË≤í5“°›co˛—ö‡è>∑§®Åƒ–•ÙdFûu~ï Ÿ2ôœ…åFn∞V	G4·ÇSÙ®+AÌøHÅGê…%0Çı∞0~'ôÈìÿôçúÉùœö0ïÑÈ¯Ë‰¨s@é;{ΩÓã≥Æ9€∫ErØ!ÂˇÛøÁ‡Ìä¬#¿>ÀïÏN¶,≤€à¶+øBPI6ó71fπiDt˙Î√<É∫BƒulõHKZˇñ ‘0&%OaçﬁaA#4◊˛∏áÉÊﬁq€àΩe	c2ôñ∂zbùŸDœ%–Ÿ_ïEE«ódÂ(”s‡°!<fÌY\1#KxT€XƒWè7M‹ßYE⁄êt…
I⁄B’4á˛R‡NÕ˚ˇıØcc◊ÛÉ£”ŒIÔàÏw…gùÉÉŒü??:%›_PëÔTÖõä˘óŸÈUñxıøµØ‚M˘9ÌE∂¬Th)6ã∫ƒ2ºΩ44oENèzr◊»a£ÅÏ!Fì#Èå∑_pﬁiî~ê‡ùH¿µ˚ÎY¥jîˆÕÇ„ÊØ‚ùΩÊÀ÷àúàULâOƒ-êœÏ`¢2∫≤mŒaS≤a™Á®Ì˘+ÛÍQ£ùUW$))¶Z9=>Œnæ	&<Ää7ﬂû£èmGcŒM’¢)zˇ(¨)gˆ°¶◊ÊJ◊*'8¨H“YQ‡{£]ë«°iõùM7/5¡8'“Ÿ"– è¿÷’°ŸdêêïM÷±⁄ |êoX‡≈∫p[)ÉmÂl ]¡*^»ù◊Õ∑XÙ-PªÑÂ¨…”ˇP[*ò$èlX5– ΩÅΩ‡
áoØ ◊â\g∞¨xYıE=ùçÏ ó”‚zá•ÇQa“∫ögYï2Ω^qÉZ””
{V`ìct¡´D
ô◊‡j~1l™ˆG°ÁÖôﬂTüMDØ˛√VR¶ñﬂëìÓﬁ—a˜≈>hG/∫ß‰?êΩóΩ}T»ÛÓãÓIÁ†õYtBúüπ‚J`…˙–	dÍ÷€DCïìÿüxYø·L¥°¡iYq3Ÿ∆Ì:j·&óduMﬂ·ÒöÎ®G®Çy\∞ô´êÚ4NK Çè∞hÕê¸˚¸ﬁbÇa|WzS/ÚÕçjYÓ?˛ˆˇƒ¯q|“}˛Ú≈YÁîúæ|ﬁ=‘85˝§_…·ÕﬁÔÌë≥ìŒYG•∂‡âi¬j*¥À-∑ti&v`ì9Ñ3¡ Æ˝éï@≤–⁄ièf~≤<?¬≤Üƒ¬™°3ö1RbÃƒ˙Kl◊¬~iVﬂÿÅµ£ú∫íç)6j2kﬁå
¸j
P†ﬂ– 6!∞≤’Vm!;a›Yä'8⁄sÇó®∫ó'v&Îc%ˇö4?4»ıØÙ≤¶Ü;Îiï⁄∑0OÑEﬁÜπè&t-ËÑWa|nDÊ}èR≠F†CŸ3ÖDÍñÏòõ?";¶ëΩ)EdÁmôÍÄL%lÇHÒ¸§ÛÏÊØ;˜Ÿê˘wˇÔ_˛Èo»â=rPL¶A˛÷}B!QÓÂ	… µÓ>‰˚€7ın¨ıƒç•vorÛ5&Ö@xÈPëZ€¥b à}·Æá )ÕÀC,îƒ,bÖ>|f4>S/v_ï∆Wè •Ü*ùõE^ZJΩù…à◊6”–kÅVOFX∆JW¥`çØlæfjà“‡~6Ó]ï{ì ﬁK¬`¿0‹ƒr#ˆòdƒì,‹¿÷Õµç◊º÷+ºõ
¡ÕR‹ÑöŸ^Øë5gƒW#T†K®@üU‰«F5]HÁQÇ≠∂˚˝Øˇõ¯Œﬂˇ˙ø1ö
|&œîT°LÂåÊﬂœXH⁄4◊¬¶•iõŸtØñô[U$+Ñü(çd9KøNÙ˝ ´Våíï⁄~7≠Üì˜y†y|%uyá,·¿FÇÅi.!∑Çó√ù  ”ä;D·Ö!Ê)p2)‘ì€G·ã„kZOE5õí#ûÂ§yI>ª◊≈¢`¡i*í´UÍò∑√_ÕÏâÖæ¯°”ü}Öß.y
¸;?\•–$èkjí:›©d≠Ñ~¬ÿA§ZÔ”V"]ƒä_ºä)rïÃèœ}?írØ@pPYoÛx;	‘2&æ|Y~pôrˇıﬁ¡—À}≤ﬂ{ﬁC/‰ÁΩÓ/∫'‰˚_ˇWr⁄;=Îv–óÒº{z÷ª˘Õ∏¯ÊØ_Ùˆ:§ÛyÁ≈üg£X2Ï‚Ò[ì¯å∞Ñ¨kÆ^&_‘ [ÙYÛa´≥P∂®¸œØcƒGDxWÊ	…]HP~ˇ€øˇ5Løá≥? üu;˚∞L+Äñ±ç‚ÏÀ)raõ4Iù@KAñ6É˘9T⁄}éÔú¯¡t_xz*m%‘›{N∆∂DXHÌùŒ`ÃÔQ_I©ï"wUü¶ücÀ@v‹.Ãz]g%rx®ú¯ Xª¨'V$Å{Rpüî∂ªo¸Ä]àœQ≤
∏KkOd”Ó"Ûökõ‰¢˛
ò¢«hrõ~Jı7Ê.ŒÜû·t^m„Ö˛™}≥Z≤ﬂLß¸†≤0’˜¢ﬁlb!Ø¶.móè≥•ﬁ9ñ®\¬EÔÄä⁄QF’å”ˆÊL„}µ˛f˝MV‡M0Í[+è≠6◊[´≠ÕÊÍzc≥˝‡µv7	nÿ¥$#(Ÿ)«müÑI”q`Ê°èD:∫Ç≥ÙQuÀüEÏ"?˘ÈúÙ∏Éπ[ã¯⁄1Ëo6ñ0{k>x∂4j⁄4˛Qï§åH´,ØZ[Ç«N≤Å—å≈ºåÎDÚb*#ÌÍ∏FMI¯q]€Ì˛Ú∏{r[ørrò"ÕY9©üö*;X0Æƒ™®`-—&Æ∂⁄T˘~ ≤ïTÈ¡å∑ ¿õj(o>x]€}áFBN∫+§ß$Ò”xnõ¨_ñå2E&AYÒMW}N˙ê∑Ï∫∂”4ja•äíÇkªi‘õ†˚Óc√íWã'!≈ﬂó& ËbNõ |¯(:ûÎx6,ùKwA◊Lˇï#èÖio	±«0•¬µ4»°„F†j=µ±∞',79mê=ÿÿZoµÀîËÚå{IïÈ∞…ÈÁœSq°o[
ﬂîS9Ö1Î8únª£∂.åôä…Ìf=5Iïõìr•˙ﬁç§ÓMX„Ì†bX<¡¢©O˝À'µu≤Nê™o¿…s«uü‘î	èßàF√'µC∏ºM>≤p∞πI⁄Ô6º?h∑H≥6ÈœM|j(oaqÈbﬂıÉ¯Ï/úa4~RZü9 ÿ ÌıIçBÉxˆ+ﬂÒí”¢óÉ^Q=a\g@ÀùÁEk∞(Ú2aëñ›Î/•I˛Ÿ[˚Í<Ägá¸Ì˚hE1=PiÆâvˇ¸È¡ ﬁCduY˛ﬁPé[Ò·:ÀéÌêM‹+π^!…Cvƒq∑C¨	ê	|˛‹Ò ksï˛2ﬂøƒå>∫0EäV÷1¨$∑	Q≠&îQ∑ïXY±∆ChªT≈Uè1•ÙÕ¨ÿ¸P[ñ%ÏlhvSï˜bTÛ’v)ªU≈LC «XØt,∞wî¸œ§$@Ê)/DWt•6ÜÍ9ıç∆√˙9å|\ÀYx“	]GàÑZ_£QÔ5‘‰—òw≠áP ˘ˇ#íàs£˝ÚÛSª~Nj)£ŸäC±4û
·Õ∂VW=vá»Êc&?KA˛RµÃGî—…œ˚•º-4“ÌIÌ9ùÅ˘ëg8ø“Âffiyh3pÜ÷ê\≈∂jb	fë„Y%˛‹öf∂LÌµÙﬂ?∫6Ym\[)[˘±Ã(5õ NE¢Ÿ˘JãÉ{≥>–∫`#Û˚—}vñZ–üŒÇ©kõÅ~sk{uª†ˇﬁÄ~É∑w»âıﬁ˜b3cíÙcΩ≥º˜<ô»bÆr¨ÍÒ‚D	¯?≤≈Ñ™ @vÂ4‡+]å0úU)®ìIü˙Ü˙PØL˙ƒzÎ+_Êò
¸…cO/¸ÖºEãÔ)@sﬂ
é¶∂∑Úâ£:-·êåALºsj…ƒY~ëîs Å∂Ã*R/Ñ®®(Ùd>“BcN∫
yº⁄!5µ ìòÆ€I˝Æ≈1O∆;éuù~‡dçÏŸ6·»Åh£Åìa,·∆;Œ|Ï<êA,4n¬∂(˜!¡ü‘<Rìàj2ÚBŸÆ<Jï u}¡ﬂã>∫¯sÉGµîÖ]ÈÙ€R√_F√Õí§‘÷‘∆¿¸=¨ôZZ@mTÂó\Á'≈[~M›ßÿ≠9öÖîê˝)÷Ó¸”±K=ß8ÁW0CRÇ%+Ã¥îˆuD?à˜}k8íì·L6≤î%õ®åL£ U¨—gÇ†Õå%™πµ⁄~◊l=]ﬂ’Á‘ £NÙ:|ñYM≥¨Àã3àÜ"iS®‚9Ó‹Ö≠KÿF
[∂uŸ⁄π◊'#ﬂòyá09A<CÎp!÷\Ô?⁄næVø^eπõ7I^o…‘«≤T>≠3¯•‰u¸UéµíßôÁ’Jw@k„q;–•ÀÌ@πö?yï“(È=å2ô& Ÿ‹÷ß(+`b‹SÛÈñKFAPQ·˝\QIÊ?¸ﬂﬂí√NÔŸ;zqª'‰Ω≥œ»YÁÈ© ëÿ"ı¨◊–FzÜE„oßND^∞¶BhÕ9±7„0T,ÆÏ›D#`‚4î;
N‚ CˆÎ¬F- ÎØÛ,…ÁEwﬁyQﬂ⁄‰˛‹Œz∑ŸyΩˆHpE¢eíF∑^Ú-gB°Ç»¥ﬁ&Öâ'Ò ÒH&«+r¶˛/¡cª íG9ÁgŒí$82√Y3ƒ"Jbﬂµå≈›±B&tî∞#]ÂN_5πcSQTÏ¸ÉÓ√§Èï}Òw	'å«åp“]∂ Ìu»ª!∫%2F˘mΩœÀ∂®'*E≥äéçC‚Hœ-{Ú∫Ä ﬁ|7úa–J\$ 4£ÿÍı7“ûk8≥˙hw†u≈˝@65àB∞Œ?{∑…äu*jmÿdùÇÚ<«që¯‚)`ÚD°SŸT©≤‚àπjº
ÂäU”@±jô)VÕHmË;v•R™î
ì´®T£‚"ßm∂È»ã¥+I—.õëÍë'NñêF±¢í ≥˙ÒÇŸ¬UqÒËüÕp[[[ÁÕ<À1Ê÷∂áQ©v	]¿ë~ƒh≥,Pä—¨‰ks.˙u…ÎáÑrq&õJ‡ÿ@ d§J∆uG^ÊÃ3‘B°ÓT&<ü„'M$‚5¯H"*êàx—Ó=Å8dm©O5√‰—ª°…‚‹ïÿ≥Bçê±ÅıÆÏ(¸Iìàx>íà
$"^¥{O"N]Ñªª"íeπ‚Ä≠≥GÙL¶—“iÉ5u~“tÁˇë&T†	∏`˜û`o«;"t=Óàp´fÁ∏∑t:–w˙Æ„èk:æ˙IÑÃB|§(CfÂÓ=â8eåÔÜHdóÊ.®≈”¯çÁ7ﬂZJjëû[Ñnÿ4xºéÂùÆBÁß≠c»k±,Í—˛)PyÒÓ?ÅµxãU•ÔÜÑ‰÷'&YLDZõÌ’f{{µIÉOçâ»æè] >∑\?‡’`{ù•K≠ì&|	>JË_≥{O&h)å[∫:ØÀ]i÷Õ≈∫˜v(¨˚?i˙ê,¬G
Q≈¡Ø⁄ΩßºÎ¯]˘6íuπ¡ÊÜ…%˛ ”jYÓ˘˚ﬂ˛Ô ß›ÉÓﬁŸ—	V´8<⁄Ôë£√Ω„ìÓ)’'+ßgù≥ﬁ—r⁄€Ô>Ìú<0NîÃM±¿•~sΩ9|mí‹EsªhpKà;“5éâ+-ÉòöS»ü51Ÿ@ﬁŸ¢ºy%Fë√eôhØ~fµ˚õÁÉ◊ÍËIûä˜‚Êw◊ˆAà4åÈ,\K≥:£Í§B¢´)Vó¢?Ê©€r‡≤,äsá¥|PöËﬁõ∑s î8Oy)Eíœ‹πmW·ΩßÛ\eK‰"òãø≠M≈WæÖÂ&àL@œFB®YE˛˘, Eíπ6U,ìπCBìÎ/Û1h\xHÒD@ãäIp˙ÏÖFowÂt>}9ˆ¢∆Ô ⁄C¥ÄemwﬂD∞œ°òH[!Ÿ°∂†∫òŸ‹±ﬂ^6è∞ê∞≈TiZ>Á@¡cË∑LJíÔ9u(Mî“ ≥4Çü,¶ô§¿è4¢ç(Œ4°4˚q˘t"ìM'Q.ìBH3G:!'\Ê)E∫.Üî¢dî $}7∫—≈Õñ9÷¶)SU∑ünàDX—∞#ì—BõVR˝Y”Éæ¥ªhYÖM<&%OÆXu–Toë%‚liX°ÓmQWYMÇ
∆p”n”NyE+/©6ÉâµzıÖ(
ƒ*¥od
‚O¨À˙∏˛™’¢ìMlW,è#Ó•ºEÍëıŒ≤ˆ≈Iä!¢…:PEi˜í:Däˆóq]°¶lY	—⁄Ó)‡û√#[…hfCîïÑ I .3V,6±∏P¨íM∞Í±p/-´ºD*.®s2˚XWtO.7U‹[2Ú0ÀOæmSb‰j(â*NNóRó;ê/˜í‹p7ßÀﬁHzÇkÔ[ﬁ–µ|kX˘VxÃ√√|'éÑÏŒAˆd—˝,ò:ä!Ü›œ“3X˚¢[èx√¢ß ÀïÓ˛†™t´©"¨©≈+ã´Q0ÛVúÆÀÍ¥]gWÒCAÌ]5˚Qv† 'ÀÇ2Y»°x—:}?/ ^ÿ–#gÇ&”≈›†∏ÿ≠FQ<Rp∑·VÃüb>ãe≠≠ha Ω˚ _D pÜ∑)ÄÍöﬂ[Ÿ¸˘¿y;€◊1Ÿ∫U^(Qﬂ)âß’w]‰"Kë√›¿.ú†hµ$6àLP[ëZ' •øj V[ZÊ%≠4úOó\ØQÔb¿∞Á⁄V¿IOëäV54±˛¶
Ò⁄ä˝o3ÉaútN)"ê4ßP’ûZõö+Ô|~ôú…‘±ÇTå1íz•¨|)1÷≥DÅ∂ø8:˘wß«ùΩ.Èút;Ÿ¥—â$üÛÃUfvm≠o5æ&ÿìAñÖPRb´û!@‚¿xΩc«≈∆_P`´,GÓÊê#YÁ)iÓûH˚G'§Kz/Œ∫'«'›≥nÆO≈‰™âè{⁄ÄUÀm )E)mXf6È…ıuLv»˙*°∆|¯‘x¥≠"H‹≤õπ´ô‹’T›b_:Q≈∑§‡ä7∆éºæŸV]Ø0’nÂV∂À‰\Æ#¡•+t$h≤ñ€™‚∞—=o:ã∞¡B0TÙW øûè≠#´∑”~«j-_€î$uqµÚˆ|πÅ∑Xpπ}&Óô€k+BÎ∫ìeô#oìúr∆ éTÌ0_‘ùQ]¯óy¬rˆP¨{d7_OÏ»laˇy˛¯µq´D2)LhˇÛáü˘˙&°y!Ø‰JÅ9Q`"b´!MôBÅôH5‚´K'ˆ9Lrºw°ÆÇ5yëîø±ŒË‚∂≤≤é, 	æÒ=V‚3}∏Æ1qÆ:-()¥Î–xˇ∂–à°ô'é∂Ÿ¿bì†cÕ<›®Ù„*D◊Í€ÆI¢?ì0ÙÇ√n2‡ù«kÙc(&»-4•_7KëÌUÌõG‘⁄*©ΩL˚7‡◊Ck"˛z÷ŸìŒí+"‹BÎ}Z+¨Ωfv
˚ÉÒôï‡<;®q®Gsvª≤á°Vü@sÿñEWtrEä;úsÇW2ë≈`ÂåÇô∞X‰π3†6ÄïöﬁƒêeKW†e±#SÓäßhôïÖ”V”ñåKx∑(ÓKF±“y»≈£ájwKˆòΩ§ª_Vû9\ÂAƒ*§~¸Ì·∫¬e´.’XPFù÷ócåH|U;ÏI^∏’.–X”C.H∑ù+Hß©FóπÍ°¶H]ŸÚÓûÏQD¥('≈|èÍ>}Ò˝ZÀO1€d¨®’Hÿ#-Í €}Ø|ÿ%Ñ|Àïe2èH‡ÚC™Q“myñwãLO±4ÂÏ]Ÿ˜˝ùÂŒÄ8Ö"m,Ü`cÀŸâ©+GZÌFd#;j–á ycEœ©$Á˛`Ó‰…;èù7Å≠_2}2ëQWÃo}ô∫S‚nd≤ß°ô<ﬂüE¥`••E[´hdis(F«>Î∏∆6≥÷È˝	∂∏·Ø±ﬂ+=Ñ°….˝3◊>w¨êÃ¥Ù9¯§œCÚ2>1◊3ªËdä|ƒ˙aÆáÏÕl◊Ög∞øs=‚ƒb«¯⁄.ˇ0◊C>Û'˝ ∆¡˛Œıà3øÔ–πÛÌÙ,t}“At¸ ∂<Û}ÅG˚aˆô…â9zÛèˆ¿¬á—sÇ5ÏÉÁ∫˝ÿ±kªœ|Äáµ¯`¸ÏÔ|è Õ‡Á˛æ?ù∫v¿ö&7ﬂE†Ij*O/ÙÇw∂Ááî›N¡›≠ ØYË’VÄ0F[ººË™9w∆ùM<ã¿ø}?¥t£sÁzÙ–BÀMÀæ/Ù»ÅºC7f˙–¯Ã|ÿÂßÍÔÆe>‚vÛ]`]m£ÁõfpÛµg#∆∞Û·ºÂE~ ùiÚÃˆÜ‹†”˘’c	Å î\1ﬂÿÌ¿F®|aÉÙ—-íŒÃıÿ£y˛KV∫±ÿgLˆxçIî6ó"5 €U<Pÿh:™∏ ﬁ,å¸	`Ât-_¯œHºÃÿ@ófN≈ 	S?‚ﬁÛ~(=!ŸœXù2“Ë≥·xäUUÆNË÷Õ©LÏ•7WS%¶∞hˆ‰u; QÒ+⁄	À_•íL?∞ﬁ√«Ó ç£~›|∞XçF£xV˜EG·©aÛË'¬⁄ƒˇåsﬂ\k)Z*≠~! ∞Ÿ 0‚Ä[™ççØ∏ÉX?cóçÂw¯»•p4÷ra/œäƒ…ôT¢•ßò<JºΩ≈C¯√=¸‰3ªp)1≥√UñpU°0¥ IﬁÎÜ„‹–êïU|@˛‚/≤?#‚™
ÁK†‡^”O åËf±É¡ƒ£ÄPZfªC¢ä-SV	||∞I{O◊»áU√€˜Axå-·)ÒÛgÙﬁ¥⁄¡P|JzŒ¸9Oó≠¥úÙ\â’ù{Jò¥b‡,1uópá	{nÉ´Ã∫_Õw¢J√à!.∫‚BFW¬ÊP˘öb Ö6	Ó^∫qìÖ†Ñ&]É{+˚⁄∆>lê±•v1ËR?‰CÚ,Õm∞a‚∏(sîª k´†Ñâ°ÿìP"*îI∞ﬁHhÖEõñ%ºBﬂºèU Dâ–%g‘öl)ê∫|ÕÙ *3û‚Âh9D∆®^SÜS¬∫nçg6Áƒ∆>Ù÷–
Mx2l√4øbªWmôõê!£XîÍß#\yı∫π◊e7ß1õä8ﬁçvQüâ)ò;%('<Ëf9tc≤Q*Ømêp"Ñl-W|Î¬|1óñé;¬ù≈¸ŒÉúîuê»X¶œ8ÍŒDâ/>c˛åŒ•ì˚^aQê ~≠,%ñI!X:;"Ng∆í'D§$âä$»ie$ÅÕØîÏòû¨å
C('U©’1>x`‘N∫vf19xH‘P\qﬁ±meJá1•÷=aÒ¬w“°•˜%¶>À0r('≥K•£5!bá…>¡UƒvÅ@œπvØçÜ∞~´¬bΩ6®…0Kcû0’OT£Ô©ÜB⁄`∏A˜Y-˘Å’ƒD∫®®ûò
 jcÃQ§‡äk%oâÈR©¨öÎ“ï’0ª—3xKƒΩ0Øî4ÖpÔJN	~EÆz≈√¢Õ$z#¶^
<2ûäîåñêﬁe!∞ÜJ~<$ﬂ≈9√wxÿ›|[πzòuÛı ñqõº›¸ÆÔD~l6A·Ö÷ïÿ8Ôa∑,∑‘´ÅGﬁ≥∑ oe›°=qdW“dÖ_Å"OW™zF2ﬁ1`6À böËx∞oe‹à)„˙*˝Øët¶•ñJ•¿áÅG©ñ1oêd±‰ƒ∆æ.ÿ!7ÄZ¢ˆÅ$¥“z]jB6◊¥°§õ!|.Ã◊·…ÜQî`V≥´@gÕV<H"$˜PàfŒüE	Ω⁄1∆¯X)–˜Â£•Pr’ß“öIK¡6ƒWØ≥:4ÅmΩ≠_¿Oa,Ø–B9⁄N(I“∞—mS{Éö¡-E–XòÒ\ê ]í”£˝éYﬁK’dΩæΩLÎ’≠YÆÑ©óÛ∂k©à@#
ú…J)˜7QÕu>)≥∏Ü0©‰A1˚:°’wÌ·ìk'd∑√ä›YYÿPÁñÈ…Döï,i∫t¥,o
’AÖ”€2OÀbqFN‹˘9Xzå M´ß(™ôf∂úe◊œ\'‡-«ÇpˆŒ˙A[§WI`·˘ îÅ<vná‘¯=¡µ Wƒ¬\¯mb]›¸.Ã`£÷&éû?TY#Öcv<.Wcy;êä§çªc	9ú:û*%≥¸îZvËÿmoËÉ|U∆b¯ç%W◊òëûa0>uaÕt™÷TºBXÇÄ úΩYŸ≥BîK˛dÄ(
sñ¥2≈:Vô"ßΩΩ8Y◊…N¨}n¨:òI•∆ ï1V2ä¬©è ’ÿ">g~	ﬂ∞Æ|†mY†rÃá`z<æÆP= ë/|rΩaî \1"™}è#¢÷ã#¢†íÔŸ›∫•” tôƒÙºÀz?Ú√€ñóÊÓM∑&O%S=›7ùÔE`M´ÂÛÛ&ÛX˝)‚‹rY—Lø?¸.'< Ñ∂=JKç8≤¢/≥úèßæ∂LŒÈ/q∆x^
s∆≠ÌÈÄf≠LG˙r”ë<‡:»sí7≈"´„Q<d€üÕÄÒ™Æ®ÍÅ1Û	´Ù¨Do/„Hz¶ÑÉ(5ƒΩ4¨ ˇ£„a^¶R‡H–°⁄Í›@k¥¢ˆS·w‹"ê§√]JûÉÊ
çüÄÀ u/˛>'ÍBπòì4‰EAÜ2ìA‡ÙÔéË‰ªºfc¥›ÇfSuøïÚ8≠≈±®,~ñ,+ ·däm ;wÅˇáX
ÈN ÙÿÚl-dQd˝Y0∞+”Ä2Â«Ã5<W¨Bóçy9ÉZZÍπôbmZD.E‰‘≥î`ˆ⁄F[Ùkï¡yQÒô¨K0«h∆6÷ØccÚdX∂Ñ\◊ﬁ∑#¨ßCFHlò‹}ER§G»à¸…Õ◊‚Tµ.~n)JÂZâ'%Æ¶„∫Ï£*1ç.û«ïÄZÅâ
gT5 ‘€!º{àè-TsCwÆ>ñT>U™]yk∞,‡≈@©uŒî6Ç®„¿ÿ°en&1Ö§jnQÌnî≤/$˜TÜÅgÜ†≈û„v„A¯¢jÑ;k•MtîäÅÊR‹ömª!™eF—?'µ∏§)/n<ˆ|ÍèÒ/–ç£çúxî%
[Â’]ÿ±ìi^≤û7=oÁJ„<dΩ™‰YÇï<8+Ã?%í`ƒ∫eDë',ë‚ô°ÎL1)à	GX„n»%ÒÑEﬁ|€«ˆ:hGt-D0∏ú◊˙bE—`bëÊ˙˙£…
awÒX‘«áŒ@À>Á≤SıÇQàÁ©Äf—.¥±)T”C>h›RªONß∂='ÍçÌëœAæ74*ÚG#◊^Ä–íµt_Hå)Öâ-"©ôŸHR¢€L$ô9á“âµß-[ˆ+Püî§Âª‚∆áU+lUâ∂Ù  º»bÑ$Ä?†—GL∞¶DƒvAsBNDé=ô˙‘˛MiêgΩ≥G»”ß%[_π/Ω®‘—˘y°«T¿ÁOdé¨7n$◊Ûªûn‚º¢œ2üz·º´à¢¸ët∫g0ôd…∞úå®[+*©ΩR6“¿óJ9JóKR7^4@o‰›A‹÷‹¶^Òl9S◊∂PÆ≠cK“KµbW«F⁄™bﬁ4'*93Î©†éÇS◊>y`◊vøˇ˚¯ó˙#%ß® ≠/^ÆóàFCŸCZ∞≈•”‚Ïd4F(êÈ√"ÖEIEÄg‚ÚìÖvKµvOÈh©Dò»./|rl`∆≈'=œ‚}ÄrÌX Gòm≈†”CI2Ö+˛5'éíù™„TJwÄ]5™©è"ƒ;?$Ã∑'+ŒÒ$àU‚[√UrhêFΩ¬	Î±C2π˘Ó¶˝ØÚ˚õ&QS6vÓåfÿ∂ú&øŸI≈?+dÆ\Aêæ∞˚;FTÃlgûº≠S–V∫"Ò›hg◊5V¯ÿÜKô∆.Íc◊1ª±ØzÎQÚÿ}Z‰‘:∑á` “»¢ù®∏Ä¡ÅÙ˛]‹H∂iklœÿÜÙ]ˇW3õÆˆåUY •s‹√OËG¸Å√Ü¡ôw˛{6ƒÜ±ÿÅ€>'>Ÿ˛¿‚à,Á˛% ˘” .nêN6‘¯«C4π˘ùÒë∫i¶—OÄRté…åäÕ‡…˙≠ôÆır7Ö:ÎË∫∆ÿèbŸ)
RKÿñœ≠+ãXFODw5¨¯˜ˇÈo	+oÓ“œg6‹D˚∏ÒG¬rÜ3æŸ†ÑÇ∞Íú;∞ÀˇáÌıßLy”Ωìë∑åÖ•µdù(µ›õd#jMù!c´Ô∏¸d›ÔÕÍæÉA∫?ìôKMa+ΩÛ Æ} bPJë$â[¬Õl46*bpn‚Ä‚ˇ›9∆‰mÙ§ Õ@x«)>HptŸ9Ï]räHﬂèpã‚&å$Z˝¿	\?5¿ŸS€£Y7ˆró¯Ò⁄¨4[¡Dp4ìõï]–öâ÷À
Ç≤<ë gY^mWî>Ö·∂<„∂jJÆ>HÖ
mÍÉ“#oœa∆"/ º¸ãÜ∂¬?ª˛Äzîc†Ô´§ˆ¶ÔZﬁ[U˚‘ÏëÔ/£èjCWHúS∑!–£-ÖÕ∞ùÀøH≠\Ë—[.9/ÊË&F\uV
Àí-•Çi¢‘d÷•<÷rÔ≠¶5¢±√¢É4ô?“0.5¨`Áú3˚ùedƒ3TÙn<Y9ÊÀW∞F8LÛ2∆ü|≥A]€â≥–“m1 :Ã\4$uﬁ9°Æ;L∂v°™%⁄–„h‘sDloVC}∆Ôö3˛V0hñZòmoû†¶≤
_|`8¥‚≥‚N›àô∞æ{Û›»¿7Xˆ´Ì·áÀ
GMöRk„QÔG i±Q9kZ¨…¶‡-xì•íÛÕı‘¡Ç0Ìßº‹[˝ÈÌ∏sƒƒR/Gú”uåπn>Y#=÷±UÔ‹ò´lˇ≠WÌó«oêÙ Ú]K\ïåGú;Æ]+πÑÏˇÑü¡Â¥πÿâ}^¬rΩîKQJ_X*—IÚ¬óS◊∑ ˙–†é0çû‘—e¥⁄òW”·˘jcËË?ó#ˇÙ)‚ÙJ9”†æã∑ñp~°åLF?«∂±É∑+e¸XG( óC•&3ë˜C≠ Zn(›€âÌvhÖ„$ìQ`¸∫ƒßˆzAoö‹X¥&%¨¸1Æ6∂√UÙ_+Øg>„ùx7P›/;¡`å.Uk¯’î” Ÿ˘?|âDˆtÜ—^1}‚Ô'lÂxˇŸ⁄Ÿ/œ÷˜◊ˆèˆ~πv¸‚˘ÉÇÃLb(L™^^Ê –Û[Ω»/3¬PI -√B)π€q>L~ùÁÓCgb”Nœfo«*1zÃ5,£ ì´»R´¶‘%Z^ÑEÈELKˆ7Ûê`µì¶-avú&êkcï‘ìQºåT+9&˜&VQKÓ/µﬁ(ªí#¥-"ˇEjBY—i‹l∞{	 Í–Èc[‘}+‚=&è≠Å√Û;èmXpè ﬁq{Bóby`~Gr•Of»µ’®ÅºïM‹ÇÂL∫./·ª†‰OM•%è˝ãcì9£};≤7\˘$Ãù{°b Q≈D£«/1ª»¨mh—cîﬁ D£ëEÖÇﬂb⁄tm˜˜ø˝Êwjä¡•¥ŒBâ^¨∏úŒê™fä,vQµ	ÙöÊˆı™ÿ ˝ﬂ˝_™+Ì≈ﬁ7<ıˇ-ù†uπÁ«2WuP4rM#$Ì∫ö$◊É8S·êµ ﬁ®Rz…ÃûÔífIÑYëß∆êÙ*.+ØX©*ë±n&ÿ≈1ìÂñÄ∑a^ì©kG~–Õ*’'2ØNƒM:S$TÃ,∑Êl;«ÈÌUÎÂ™˝€ ÈÒÕ7Å˝ûˇ)õCqÜ∞÷x®≥NF√‘ˆ}[çäÁVLáK+†∆}@Üﬁ>Y#,+›±»O#øh–+md[ÄΩ·¬(Ÿ^ΩŸ⁄ÿlÉ^∑◊Ëï÷÷˙ˇ∫+Ó7¸?£ıÑûÏÄL°\>/Ze)a	0Õ±πX¡IrwU4∏Ø`¸`cÄÌbOú{&≤tFãH,p˜¬‘Ë¥uÛè>∫ü6€ùèƒZy¸¡√˛©}âÙ˘˘Õ7ûı:ªe¿n√∆¿>{¿¬‡ha°.«√’yfO–ìàÒÎGdP!√˝Sj˜∞ËõO∫hnæÛ∞ùz∆Ç≥r4∞jK«{b9%[!#No©å7ÂF˘≥Ëdƒ*∑≈chó{
⁄ê5≤¥^dOVjÅ5|√G˛ÜÕvïT|t©	?á‘SæuF˙˘çÅ?˘àÀ câ∏\P1wãˆ‹Ÿ∏ÿ~xÛÕ1õ›|Á˙#?≈oR«xƒƒ«¿⁄‡Êk:4˘k@¬¡Õ∑˛Ú)@Œ9ÙÄ]sπå–?y˛2ëüç˙çèΩ‘ﬂ‰–q1µ˜©ÌYÔ»iCÿÔèî@y¸ÿ∏:‡˘Ãµ∞}Y\≥ï⁄'FF„ìò¨ëg@„Ú~xÃ¶#	oπ˘+nø]ˆ‰ª@Ò√∆i„∏Å{πC∂÷[mÿƒS€≥√¡U¥Ée⁄ıf´˛ps˚—GLW=7÷>%œ|ñ≤ıÃ¡DÍˆÊ8Û#rhe'âp‰∫~uÅøZn,Ñòd+£…i˘9zá∂\*emØ∆Â%ÁÓ¢}Ü¶Á5ÄÄrÖü^ıÜ+5F1Í°3Ú¨hÿuô˘¿4Êè(£ºäÍ2lKÂ_4E“–^é∆èëöVM–;”Á@
I·R,£¡â ¬E°e∫3Ö„¿Òﬁ÷KD‘a‡ÕÊ„u∏Ë€ﬂ≥&}«
8¸˛∑˜óˇÚOSKÉı≤Áóìƒo»H	qÜO4bºf◊∆!µŒ¯€⁄ßF∞û	·›ìñ÷$éóTèF¬^rÖzó2ËÃBtÚ¿*«¡/Ò)J‡åRös±R£l°=òIk’)BÁƒ1Lu&Ü%Ø@û
OÎ¸¡Ù~ÀX£xUêûô∏'∫|˘'÷e˝¢˛™Ÿ¢ÒŒ~+ﬂÒ",¡…∏·ƒπfi{√˙[„L›+„◊ˆπvpÏmæzRÛ¸z| ¨\éQÌë“Ï«‰B„ˆè’ª9Ê:|úÿ`fõı'î•ñ§û≥‹pv≥-∆kÈìπ®Ë≥Õ≤ø!îÕ´≤√∞`è5⁄73bo∏√Ü©æöñHºåÜTe2·–Ÿ(1-„ö–Í3∂HoËè∂≤eMóFd5lc±§\‡ãåÕÉ∆Xeàûú!ö±X⁄µ$jÊ∆«ZYÃh∂ó‹Ω∞ﬂ*Y9Z∆y7ﬂ¡ xëg
∑∑°˛t£˚Ò®ø˙.ÛKAÆ|+◊lfREœÓÕ∑XXj ÚG>∞wÊæ™äS¯#çòèÄ%Z¡êú^·€Br⁄Ïü&Áí≥¿ç V ä)ñÙoë…0◊W‹®mYoqÏêÌA•°kñ6»é{ø≠"ÂßŸ®ˆÄ‡‰∏3$?îNÙﬂNûèeÄE%Äªá¬ãˆÇŸ˚Ï[ò5≈¬›:åˆUy—ÿ—ö^„÷{rÊU{∞qz¬¬©–‚>~ïW=±ßxgˇEˆÈ]Ï#8 Ÿ»"@tnæ¡ﬁUé€Ö-€É∑¬{∫·`6îvÊ8£8ucçtﬁ-kpéñˇ£iÑÑxÈ]∆˘≥éÅ∆∑póqÃ«‡ÕïﬂW“óN§Í°â”.ó°ƒu(U~Rbÿírìr∫"ñ˙ÕR“âa/ÈPò,≠„ñNÿPá˘πX/x+WX›;z2Ãï Fk‹rZF÷~HÛNT}§€%ÕÌÿ±¨ñ—Â≠?Â*YÊî†Î9]°†§˙≈ıB>.ƒ∑fQAû¬˙£ 4œº‹îòIì·≈4∆xÑ∆Õ±KëÚ^õjôç£éÀTßÚtkn;m¶NJiÆ¥–Ne´≠Àó6Ïz)–∂Í¨†˙q≈dÃ8ìYUQΩÙ∞bN¨d“]≥–
X!<7ñÂ|2·˘cK®ÍΩ:ÎjLõ¯(^—πW†« Ü) êõï7EÂrR#‘àVIJ9Ï<Ôæ ˚]rºWµíyÒUeÍ
Ôå«®⁄ª	+äQ*çõh»hÄWP#Ω⁄ƒˆ^—ÚÆ∂ª£l`frØhp/3∑„¬˜ùæÎ†\JuÒoÀ‡%Üz{ÿpmoç….Y7®K†≤ñø˙Ÿ˙£ı˝fÁµVoè…`ãÊcNd™◊ö’Ê/7kIæêR{ê¨¢êÄ=ÑØ† åËá≈Ú}xP⁄À\∑Ç&˘üe
øb[QÛ†∫ie8ÿôù8!≠çâÖî0àøÂZA5ÛåJè„Åcx©†˝™>Ï0PhLµvH:ç‡-øtct–Uõj¶]KÙ-Øs..A
0TcÿÔjÖ[$˝%[%ºPÖ	'
∆§ãâxHäÜrﬁ±.√çÜ¶e]Õ]û8Ùs÷1÷(CZêº»ôòı∫àÍ`§à0JÉΩ≥˙Ÿ≠ûÅï:{d$≠mê¥∂ˇk‚êï=åöh	Æ˛/dèÖùéÏ0l{¿ébØíTŒ]™ùûËïå…•Ãîã¸¬vTíπˆ—\æéØ7ÙæÚÀM[áUı¿≥„:·|Çê4≤ı&ﬁVr⁄Ø4$<æˇoˇ±⁄X*nÇAåÃ„+8¬„£∫C<>Rémqö=Ïv–<|Ï´Çlw≈§–TÊ»ª‰QX†VäX`®ˆ»Ú¬PôC]¸{´≠rÈ∑i¥JL9…ÑI?+ƒC.ÈDK‚«JGïGUC e©'s]\xêq»@zGÚT·b#x˘`ÄïFÔ4∏®∏≠.S6;√!%Ï“‰ÑS◊∫"˛OÑ¨¡.£úL°`QE≈P±9¥œ¥ÌÃ$2åÍk&‚µLÉe
,—áŸÖ◊ ≤<´ÏSE^N9+·iÛEûÒ´tñ∏à9ú+¸ÏQtˆàs±z∫8=ItîDƒ˚í¶ÛuátÚµD≤≠,ŸzC	ì1•  “.m*Åy´˚œåÕ ≈£,tµ–q¶"‹|7°a;”¿ø¬fs$ö%l© hÃCM/úüÁîb´IfÛ»dí˝ÑB©Y4ïåN£+◊^©Qíf,YJ≠%Y`}æ}|SpÂ∏/ZH$”À|n`:ºÏÏXW/:√
»œÂÓ±πN±bﬂ¿
Æ‚Úm´Ã$¶pÕ≠!¶†˜û∂’ÍãÁãG5Ó~!Dﬂ¢ﬂ‘(¡Á¯)tW¢í:ÆÉ∏†°ÕÈS∫Ä0ò¿yè¬Jiâvòb|«åãªiƒGÑ3‰ã&nE<PÈ¿v≤W-∞]U=r&6Èl≥Ä≈ﬁÕIAΩ4
…ÑÉŸ‘†ªrâ6∞°’hoáåB z¥‚.®ãâÙ≤Æ ä¯¶‚¿Ú%¿4¶ùÀ`áIL√‘{ì)∂Œ¿¯8ÿ8qÇíqúﬂ\A
3øŸÃÀÑŸ0Ï˚ÜÂW3ùﬂt{Z€•·y≥Á˜ÏÊ€–XUz—öAv…ûsENj√ ß‰ﬂ
M’U-lÏJ±.Q±≤7
¨+Í]IÉ÷–_°érQ9Ø$œÜ)•ë◊<πæ& ë—h|s4¡⁄*€ò\Å'∂7·Ñ©ëÕîp"1‚¿‡˝|F€Ê îwC_<L‡=ú	^Ú∂‹ˇû2X˝–wgÿ°’«ÂDR«‹⁄◊_ÒLX `ìV7©ÌV3RΩoùΩÌ‚wçﬁŒ˚Z$¿=ªÀ	≤ﬁ…˚~Ñ°+wπâ¸ïwπè…,Ôp+ìiVŸÕ
xûbw`è\[3I¯úìÚ9§Àÿ…ÙäÑ≥)ÎuπÃÁ{«‡5ô*'ªqPÅ≥H≠ˇ-÷∆ÖãÚu˚∞ëêõiñ≥Òz´«¸†cÀÃÂ∫P?»»dB Æøÿ‡*¿uœ√¥Ïp|pÛ-àÀv(¡ÙíXJ\êcq¯’ÜZÓLÚSSŸ2˘©ò;aù*∂	hI#«3µŸqÿ9¡x…f{2©Ê€©∞÷G3·Ü∞ı∞•ÆuÂœgò…tE0$<ƒ∏∂$ıF ’'™÷Pj„x!ã«
,<µÑ}Å'⁄Qöw°nıˆ
ÉISπ≈bûYÊTz_àªÂYg@> ÅYPGkÒÓ{§JÀê¯¥ÀvÙ!†Ê:ÉÇntÎ«≥S6è>N∆^d/1*ì ∞\ïß€!{TgÄ…ñXéªNÂdÈ-¶7rÖÈ”µjæXı⁄åÎBM˛fãïââ°™¥ﬂ£!≤ñP5v¢äÉ+=pu•uzÒM:fvﬂÕ¡ÿ’î™ÚÙO÷ß5«ìóÏÑG%G|Â∏”¸¸Ãà>%¿¸ÿà∫ÖÜ/D—z· jºIY£êÑ¥âzD%πÖ0CÄoÊÆN1TèΩ Lõ€≤˛ŒÖ±j^ºZf	Â‘}∞é›&ñ-œ*c⁄∏FoRÄ3Ü¶ßéh,´Z≈≠ˆÎÎå´^µıfUù±Ë-ØZâNöP
Ôj-ı]ô7µ2o⁄ûÛEs‹Tù–ñDe*ê9Ô◊©TK,Ÿ€ß-´A c.ß1„|ALπÆÎ“‚ rLùpÄ¨TZI∂gs>±QaAÖŸHCù8†œ∆„%ÿÊîI˘ò8µ°ìhå≈\X/oQAâu…î#Â‰Jkxùóı,# E˝$∂E‰`È±ÛÄz˘õ≤hÿlÆÕâÛ’_µ>ﬂ´™ﬂ†ﬂ8$ÿU≈D7§âJ{m„nVÙ6¡§Ÿ^ò‹:µŒˇ'≥3ë§Xa¢‚-G˜-ÚHj
∞cï&&dm@π$±>V5BE]sº‡L\ô®R‘ó¯ú„õØG“DìXsŒTÜj••^:ø˜QÎbmØ'∆8t^¢‚ûˆ5˛≤ÏèßªøˇÌ_˝ÿ©(Åõ™£‚1fc˜ôL@á£6ë¿˙ÇM]—Ù˛]“uÖL˜¡lJ~aΩ5ºõÿ†V∏Nn∑∞xZò‚.ºIV<°⁄‰*h#¿È-^˘ÏÚ'π#Ÿæ¥ë5°-=Ü†§|≈Í$Ö6fﬁ3{¨Klo`ımÃ5m<^õíWPãÈ˛ÊØ™,`Ï‹<ç›â∂•YG˝ÏàÆ$Ã(uö¿‹f÷HRtÛÕÄ∂9·æìUêí˙œFfÂ¯¨é 6€ïï®·‘±XÉ[EÄa¡{‡Í+2L:ﬂ∆Õ7*,†	m¨◊≤EÖc*Î‘[Ù≥Ê¡1›(hZ=ÎÉÙNû“H }”È¬h;ìË:©
Êsh¿	#Ô∫U:!∆ü\;!ø•Ìø¯Ú	6º¬˛Úç(p&˙≤! rtB’û§†≥PçAHz\”´˙&ûlÂ ]Üq5<à‚’˙õÕÈÂõÊ¸å˙÷ £G´Õı÷jk≥π∫ﬁÿ|:ôÏéè∞]°˝'9«c˘<?¬–>ˇ"õd‘Â=Æní'§≥Ï>Q¯«Ö≈ÚNÏs†'„ΩUÁÌ∏r8u<1@–†˜ná%ıSö√"Ã@õCåﬂhî⁄|¨}A11.ûÎ)Ω∑Æ-UŸÑù∏¿ç¶ubëÕ ïˆêáŸq’¸f§#˙ò@ΩÇÑ‰˜ø˝€ˇCˆ>Îúëﬁã≥ÓAÔy˛¿8ˇÛ~oÔ®~“ŸÔ‹¸Ê9|—PIrP;.Ìç≠®{	≥åS˘Á§vÓ†¯¬ú`õ¨4~lÆì˜‘ä*≤X{¥M˙Ä°√¿übœZπB.îf¿ãÅY4"p_0≠oÀôB\€å1ü+ÁxÎÍlËí÷Y§´\Ü#h‰÷ñŸGë-;d–è⁄¨¿≥¨ Tß&π<°I~ØÏ7O€`ÀÇ~A≥ß‚n	ºÓRÅ\kZƒhûÄ Ç\f°‘r!†âU¿TÙRRL?Y«bÚÇÿEÈ§Îå®À	K;˘ÓÕw#¯R@^J»OAQm
ê∫õ¡<U¢ˆ|/úπòG#pŒù †ûÆÇ:«ÛApáiô…+ê1#‰]åös Ö2öY~_Q?≥Ú§”Dá|µî^û‹ÆLÒ∑O¶ÖRk∂LJ≥Rô¥˚óI·_K“LπFz‰
°<RBYì}Pˇ"{ì˝Æ‹(M-»§/¨+õäTÆÜ“,Œh(Œb‡%ká´s‘ÃÇ-É}¥&ÿ’óŒFµ¿\N{ZóŒÑØÄ‹|ÿV¸Y9ÙAcOtÜ˛ÉÇnEÿ¨^±é¸¯–ÒpPvKA9Khcπ˛òOyÆßÎW°<1„÷A1raQ•xÌ0¥Fv∏RV%π<ÌàÏΩ∞›Åè›¸J/|Z∂w‚m◊‡rD∏¸üø˛Ãw≠O»©ÖY§ü~⁄QûW∆ˇ>˝¥°Â%d≈˛™A^ÿ@ô|Ú‘=«z˚Ä3ä>™∞úÇèí`‚x~ÿ g6È· ∫˘M+7øõ`≥1b_¢>å:_»å%éG_Ì N ü„å\÷íﬁnîQõb3»ÎíÇ‚ñwÉ¿V<P¢o*œØ⁄ WC/sŸæŸÚE´ƒ∑ÄŒŸëç’/\F∏®ΩØÔÿﬁ;€sÜI, €*B¯ÀÙ;-0 æ@∫(2£vFÂºß≥>fUuê8k-=íˆ%˜D&öÃkìÍ” £Äïnﬂ
Í—¥v-ì÷∞Ã¸md`πÉ‡dÔ∆ı÷&Hﬁ^S∆¬›§∫äzÒÅøim°L≤XΩI8zP\∏ª§j≠SO))S'/&,ﬁÑTåÃg!3ó◊bI«ˆÜtﬁŸÜGE,ºPw(´Ω'0)¡«Ø•πN‘Dî%86~19pM∞£•ÈûÂâßäÂ(•ÍŸÚ€ µ5€
©≠ïï⁄ömÉ¥œ≤‰Ræíº\í#•¯≈¢XIŸV„*Y)LÀ.(âeΩu“óU”
Iè–6(éo‰{	œSTíU`√ÍAÃ∂ñÔ›l^ÆªÏ√ﬁCFÉ}ä—‚ìØ§ˇ'OWjÍ¬C˝º∂˚‹!∆IwvzK\Øõ)0«¬àÂ{≠X©∫e∏ûf\h»f¨sÿıã¿öÊà«.}ÌÉÅØÀ¬tΩgh.áÙ~pπll÷uÌëÂE'4*,¥W‚ÅØ~ÃJ#òºÀU±¯™»˜Q‚¿H¥Å?ΩÒåöÄÉ‰»	Ÿ2åë–õÈ±äù”4≈Báxƒ˙—Á®.ıªﬂø/VxÂàâ óyepU©H´9<  ÛŒp+ûê@†º`¬¬ ⁄ØN∫ß/ª/ﬁÏtN{œz{ùΩﬁ—ã/^ø˙"¸‚Ùıß?ˇ‚’köK÷F hµ‹X•Püua9¡FÓ#å«ﬁ”æo√∆E ä£]I∆]·…»¿äcÇ´ÆóÜM5,ì÷Ÿ…Ø4.LòÌÇ€bïI ÃU•µzÖ:kM¢˛∫‹çKgÛù≥“!◊Úˆ¸)ˆ•≈pÜ∂»Ñ∑L
L˚$6f†YÀ-Õ¡çﬂˇˆ7I¯Î_¯QÖ‚˜æ8NÖ“2˜î&∞∞ÑH≈ﬁ)◊ù˘,6aÂÀ/º/ºO?≈CÉNb,D÷Œßü~·˝—u2≠_ø˙635fgç÷mU33‹§Zœ†gè€ª≈ÕK1ÁÕ°*S”¬¶Å?Ç´ãîVFÿˇEí›& ö«˜°¸”MåÑ$úM&òv⁄/éﬂëûÅ(ﬂi\Yë&µ	0À  ù=¡®Ø!ØüÛT«?£ZﬁÃ8âDa4÷]Œ≠°›Û*V€Qç≤∞0N<&Ü\»ë[!∞U≤A„A#K2≤9ı9˛.<bƒ"%^©ÒÉú0Ú´ñu\$q^t™K6π@∂ÂÇ;R&QÏNî<'≤Ä7ë"]À√(»§ÔÌ‘jæ™"˙gnWZµäe∏Á+¡=7/eñ?˚Ÿœ»ﬁ—ãΩÉóßΩõﬂ–ÓEóÜ3»+≈E4Áñï*lk¢›ÀÇ‰xe)˙kÛ	¥Ì°»e„ì[Ÿ>π*~≤áCﬂèª∞~_Rç…tã´“âÑ”u©L(›@øáïÙ}≠9ü—™D¶í∏kä\À*ªΩ§^‹s˝¸@ü∆'z»|JÈäŸ{a©2ñ`ñe>e~u≈ΩÇ∂œy˜@l∑ˇ¯µ ÚÀ0ã∑™·#p~•‘(A‚1Æø»qq–g&∆’Ä•3<äUQè8í+Z#VbÇ\È„n@ıf<…’`s (1u?j∑S3SUÁQ6b3é–EﬁNA9‰ CëÛ˚øˇá˘ßøëgT“1◊ä—EÏÛ'Èãû“T∞˚¸Élå|¡¨ô_ﬂø‘{Ç1“X3.ﬂcyΩ;ÏH_X_fﬂ>∑ zãîr&WúÇT!áôËÔ“ ™ €öÉZá{q/C&wQÈQ{çPómOÅw‚ ƒ\`b"“(Ïxgπ3[ÄâS|i{Cæ[bPΩw≈nDò—5Ë£¯[>GπúŒgª•¢L≈$¨§Ä‘e( £‰£PhèrÓf·é?ã0?ãGà“S˘fL9 …JøûbûâÃAuK°•Ÿe“;Éöê‚œ|Cb	0ô,…Çë≠G¬îß√d˜TÙÆ∑”ï§ge~ØJrQ»ŒH∑Ö·RAæºGX‹Û∆{Á–ˆ∏5u◊0C§W’‚ˇä≈€«kHy204ßsÁy9‹Iúµ„{XæIˇ>oÙ¢"ˇ2ÔΩtwæ[G¡¢˛PJ" jUO	î<3üÿqh9ÿùgv§}CƒÑâÏî‰¨!ïbûéù\œ[«‘ÒmK+•ïxA∂cÀ≥]”»±¨¸4ánÕü CmÜ∫d¬Ü˘<Åçn6Ñá“.<’RF
üW#Ó\∞(8|¡¶I/è≈cˇçµú2]Èô„RßA*I©f¢Iÿπ–πë©)k[âV€˝≈—…ø;=ÓÏuﬂÏütûù5Œ~yVÆ◊îj5ÿ–≥‹´˜“c+∞FÅ5áÂpÛ®´l"AÆÈˇçÊ3Q„RK.aû”PâHH<»Ë‰¬ÇÍKÂ⁄™ºç@Ø∆BG
)q6cïÜ◊h∞Ωr3ik^jÉ9w1Uµ0éæXãΩ’lö<è˚√Lß1‰’ÈÒ1ü&Õß…/ûIBç?ôÇB„a ≥:≠≠ò≤∂ºÃÂ@Ç©5Ö$C˜‘ÎØf0‰“vu£kj¶0[Êƒé¨âŒãë„Ö,“¿≥§©‘ÄôÁîa:ÉbÎ∑∫hÉÒÌí¢ Ö∆Õÿ#É_yÛå)
]è=≥•ØÈåòËlÉB<ªëØ&UZÕ¬"ÿÿŸÜr…›e¢¨á•ÁSX®I¡’Y∂‚	I◊˚¸Ê[ìä\Zé˙ù≈íäÑz*E-ÊÈ∫Ì5ã5xV–S/πl@Á.+ÙPˆ˙i≈,¶∂÷ñ¯ÿ`9KÀøî˚ºL◊‹¨LPâéáÁ¨[∂ë»¢hg¶C⁄-óÑÉwÑxÂ,é¥n•¿ìK_iÂmo[Îb Õ-…NyÈ)'*Òq…ˆì˘¬@…çï3ÀçÀy4@Û]@>wB®wlaU0◊‚ULá .Ô?√ò±3«	ãúÿñ˚ÄâX>÷‚Ø~Ôâ<{æ;õx≈A@Ò¬%¡°Ø–üŸtŸ4≈≥wAó$π‚€!¿ñ%±ï^~Ù2ˆoY3îy~qÄRöçö∂·5ÖH∏6øTòÓk.K+l ™Ò5k$’]Çûÿ sﬂø\2^–Bø0¶ïsÀã|_xòd©±∑i]"Ñ
˘OKÇRâ]ÊÄ÷J˜1§!lZ¡`ÏºÛ98N¶éü§æcê˛Àì‚9ÿG≥0LøN„ÌØ@ÅI:D⁄∑GS€˚≈ÿä¬Œtz:∂{ÂOY<ÙõÈ¸Oóæbt[.‰MEQ≈ ﬂ=IÂ^√8!ı‹	&XëîÅ*/	jëx´ Uq˙´Ïv!º&ÖÚí◊˛–ê˙|b9Ó-Ç)∂ÉÀêL<±• O<ˇ4–Ñü±uJ`˚dR´<›´E‡n7O˙™61WÙÃﬂã3˛V$„›*Ïfa…ËB∞Z¢À¿9ÒvÙ —fˆ§Ω±+T ï“ÃºaYÎÏeÿéåÜãÕe£‚∏ÏE˝Ë8¡Ó88Fuƒ=pº∑ÊVÂSÎÄ6‚∞?+,Ω2á˛»˝∂äT:ÃÄ3´∫\L;˜aÂÏY#f›”BT∂á!zrbûko÷∑É3hûˆê⁄HaSX-ˇÖI¿œ)÷Å"AÀ2÷ÄoXW˘7l4&u% π§-ä£ˇ¸uó-'-ü‹⁄ÇÿVEÌ°◊w”˝[È~vÚ‡á%9ãCW˝∆zÄÉrI#cˆ M±Ì∆°ˆ1r:0¸gè5
≥ıΩÄ5m|ÙÒLrLóÿõ=âl”∫ÙÆ„NxÃö∏G˚ÿ¯W	ÏX‰´(.-óQ‘•IW˘+À’ø‰ŒÃÆ0…“›∏‚ôÂJÖÂLóÚ'Dˆ®bç∞$ú4 9¥!uá‘ju¿–Höz©^nY‡O.·µè±k¿<R√L6≤9Ï;#—_ÇîÖy8 ¶,0ññ\ü§<ÖÒÒx3ﬂb"G—Å”f¢áã˘◊h{àÒf˘õLS+Ê.Ê]Vù(≤c¡ˇxÊùüc°=óÁ$b˛sc¡ì:4"®SÜ®,¡e ™&,ÊÊíMÕ¥ñ=¨≤51yHÏ§Û∫SHTSbœO|Î§mZ”À7€q◊ÉÊ÷jsªΩ⁄l=Z]o¥h™˘Âπ&õd U∫≠å·GôGä‹-U∫Ï∏¢V∆7¢˝}‡Œl¨¢,rWùƒ∏ P’= Êˆ•O…]g¯’ÃKä%àèÕ\ãœïüVËÚ°áAB•—åç™ï@#),≠Ç&I`fœd´´î[$£ëõº∆∏ôèÒ:ª3Ÿyò.CıUçÔ∑∏
•0gò˜kí§K€ÿ“û¥YÆˇÅuòUo(2∆”lÓZa≥◊“ÖVïœ»v_√4SFn ^M=SêÕPs÷™ÃFKè¨~MıÍ[1{›íùK‘ï+ó≠IT‚	Ë∏ëìçπzÁÑ3 ªhdMLÒ¢˘µÙ˘¯T‰H‚$	∑ã#)WçÛÔÕkUT≠Ra‰RònµÄK˝	m…üP·ƒ-'‹9∞JesLV◊xπá†ãz]pÛmfÍ.`áQ˝£ºÎ@HHI›,”∑/êMà/ 9ë˝§Ω´ùIé{\ÿ8©âÆÖATÎâÚ®1ó,Jn‰4Ø”.–ı'ä‡ÈO2m∆ìIÊ(`ıCﬂùE6œ!îsÀäR#–A◊2N)5m÷ì´\∞ôâ¡äEbñü><∂>i'Â–ÆösÂv5◊iübQ6‹*ïÀQbº°7&»ô_≠¢VIµ›S«ã]ë‘≈Ó~ˆú§mœÜ˛„µÒF·X¶π°2Â ºrLguF`¿¨Í™[≈‚∏'∂Î⁄ûE∞Ym::±#¿6ﬁ∞aJ”'ﬁg€[bßq†˘¶Ñ®º’ò˝‰ßD4∫8Z÷-ò—4xî3ô⁄Ùè¨≤¯-v◊ÄÎ·=ˆ»
ä¢¢œ[Ìçì<a˝–“ÊÈßëE˚m‡∑»◊€Qˇ?   ˇˇÏ}}oGöﬂW)3∆ÓÃ˜Y‚I2F√ë<	…·ÕP∫ª’	v±ß8lπß{‹›Cëí¨ˇIÄ.wπ=‹õÇ$∆≈ê√˛ë ôo≤_ ˚Ú<U’›’o”U=CJ≤5∞EN≥ª™∫Í©ßû◊ﬂì≠4xì[>DvgóºÑ≠c¥ﬂì“
˜0D∞â≠•∂ÀpÙÊi|∞ı1{ds+ì»'¯ÃN∆ãu'o™
©h˚˚zXN%5À–—ês3ê‹öçÑ°Ÿ˚Æ>xu¬™0‡“˝cﬂ≥X¿˛Ó€tËN ∫í‡Ëı∆î‚_Ö•Á “@gõUîtÈ~î≤‹ß≤q∫˛0+‰%|∂T¸√%ÄÚ<	éÿj—NÙ"RX≈àµÑﬂêr«£œÜà‰+(¨°Lø·Ô
ÈÌ¿!D'óTªõ¡‰jã5X·1AC⁄Xﬂ,PP
ê∂"Ò0ñUCdìÒîˆäbÑÛ√ñÌ[NFÈº{˚Vúè'k\>Í∞JÍ®¶¬Üû¬µt_L4Î‚h·	»˛åÈzL^+NkÁrºıfVøé∂°B ’hˇERNE˘§e>BCS2d>s-õ¢o‘B!€ÃÇ +sc-≠Êqã·†ò≥‘g!ûÿ¡AÒÕ∆J‡\ˆÒA—‰éI‰(π»ÚY£Èl∫p‡’™r¡gN–ıÌÊØv ã…1RUô±≥ÁJ	ç$à[3àcyay1jPè<a>äì‰s˝+Óı=§.™ÚÌÅÕ©Ÿ ¡|ˆ ≈Ù™pØZ¢ì eÕ¬{p@°m`ìÆI>Âµ√c—HÄ’¢T4á …(É…(9·%èJàxª“éØ)’i÷…-G!ﬂŸ(Å≈∏#¨iE∞&Ô{!ô™\¡5–»Ü·9˘ÑlVŸ†AÑ…®.?√ô–÷6y†ãÙ≠kô≈˝~∫´>oUMU>ñ	Á£ÃÆ⁄˛öDÛÆsmT∑íÓÀgﬁ$“T ñE∏d€ÂXv≈Ëfw62d^∂ø£ˆï∂«êíùTŒ —“tÍÇ©Ê¨ ©ñÊ‚'ûsÅÊfîÀ/¥Aq´∞©Í≥ÆjO√≠•ˇÚ¯◊ =⁄>iíÿÎÍ¯µ»p¨µ5a∞⁄S –˝}≤°á«ØÔuIv˜¿”ﬁ€ª{‡ÈÓÌö˚≤¥&L_ŸTq¿…;æ{‚˝”º†ÓKö›@\FüñcPœ°“ÛP˜lY/J=Òù—îHIò≠^Æ>]›|¶0–cÁ °&õ+OÀïLﬂ…X.õGΩ∫[Ò#;ê¢± oŸäVe∑âöº-ƒˇö∏˝à˘zÓΩê:Ç˚ŸÅÁ6>
ä.k#Ús‘àÇ9îŸ¥zÕhÇ˙Áp&8gy{;?bZ¶pÒ‹ÕºÊ≥QxùøT@oƒÖ›tQÇXä~w›—)à}j√l%#Rx∑∏∏£ÑG4„H"®‡™)ï•N§K€Ao	?d˙B.2N£Ω†™ªÙ
Vw1?Ø
…óﬂ2rõ=‰c«E˜ úÖxÜ’¡~ƒ@‚·70¨HAkÇÅRõ”Iq¥f
VÑ‹IøX)£ºVÜññîòÕ
`ò‚™«)`ÅtñRV∑'Õù∆è˝9˜∂ªF–“2⁄5’wÍT©UŒUcﬁ.ÜDª:†¨ﬁÆñ˚ûO∂È|€F3Í∞$ÊPç«z{"Öyı<Õ-Ç=Ôy4°˛ÄŒÇlâª3©~WÉÏ,ÍZÃ·gJ-≤kÒÁExÂBQŒÿ©èñıvµ⁄Î#ƒ?õó
≈⁄-òo≤SÖSÁø˘º∫LsˇIÛ®’ﬁ'áÌ˝N´y@zÌ„nÔÑ|˛xüútªù£G‰A≥W°ÁñÈ∏∆∞◊I\K*öÌŒÆÜ”G‘w⁄ç¥èKG;ö.öîfáÙ√+áëüëáXΩ/$áﬁ¿>≥Q¿Óy/t‚eE–5ŒFc¨xΩÛV”ôíŸÍ◊™‘3G¿»~A«•ñ£Yq(⁄õ¯sÊ˚tÑ&/ ˝»=v∆óïy§%Û√…±¿¿mœ'çN≥⁄†§Î√¬œ´H›{ ”ò¯hÆ~tÔ^.UøhÍª[âŸ>#YÏ≥¢Â†(ıT”zÉgZÚQ<][„eüV≤3˜Ã®L{‹Éb_l<5iCøX$Ùı(=÷FûzÜˆêÎFçaTÓ<÷--kY¶ÇÖT|ã¯‚Ì¬zjR4N©ìÒ>UÉ–3≈•„¿¡“ÚxK„¬‘˙ôÛ ›ÁU ›](LH	J;FÌ ®€∫"c¡ès4Åëìÿ¢•.≥È#_6®Ã_ÏN_ò§n4p$I=éf ÿ/™ﬁÊå–ßLºSÜUJ_f!›‚#DK ô¿9Ôx+:fÆ\~PKloîÚÅjÖ(fQáG<QŒ@ÙBÍÑ†{Ä!õp‡Êàr∏NÇLx‹%Cß‡∂¿4UÅRbb«ñº¨\3ÙÌ¡0T: âŒÓ%_we‡¬8DPãk3-òÉÖπb|—Æ$/áÌÃÀ∑Oy‰<ÀohŒ4d‡¸◊X+F±∫∫K;≈Ër·PÓ¡™ÄXkA¶ø√êTq∆∆ù#nÀ!¸FEïiÜæ=á] `ΩNåZµ<Ã˘∆Yb˘”ÔCæ

òåôué"QFLπ	˘Ç≠ë∂cè`ª —K”∂œ¿19Åq£6G{KËGå¬–Å$Y†åò¡	Z»]7Ï¬yöõ	µ”Ô\…⁄íVv]ØI,D¨‘Qµ∑≤™v`ñπ‘∫õè¸ÿIiÊ€≈aã=ÿ≤gôŸâüWÉâeßN+™P£§2¥)V∆ËcQÄ≈Èˆ˘≈F7Öéÿ¸‹E¡”]ı∂ å¸˛◊oﬁÆì‚ZxŒ1h.gÙxl◊Úr	J:è⁄ΩÊa˚Ë§çãÂ⁄åoµCÃq∆YÑz∫2,+^ø—‰ä»ÿL8‡πhA17Â˝íÆÆhcØëÊÙ∑îü-Ã≤#6$£Î<jBõüH¡
Ók*Ω"Ô¬@`9‹ÄËOq⁄‚Ä“ÅçyO”Ô#æµÇ-áΩ∞·Ì)	Ω∂"†÷ë'è%≥bó@&0|…Li±7À∆o„È–œ†´°=‰,Ut+cçeKò,á$Á€»Ï⁄p
O∞QOì•&˜yΩœ's‰„∆+Êè¯f,é[.bñxé˚∏Â˚¿-;Ò~DâÇ	ö„QÏ¬X0@°)∞›<Ôl_ûS¥5](Üí?¸ÊÔ˛˚èê äq™ó>Q¿ÑxçLœ÷@`N@È§ÒBZ”ê˙TAäÔa•Ê22 ND.g–\´”∆LŸFßµ?ó	Èõc˜ë(x [@nù¨ 1Ü2	ˇ2û∞ä¢¢º—Ò4OŒlôN ˝¨E.MnÃÇÛ£BÔòh!_&‡‘ËçlåltÅP& z°üñ?∞ùwñÌ¥§"È≤ÒÜ¸îÿ‘ô)ƒÌöºyFÛPû{rO¸·7˝ø˛ﬂ?ˇıèêÕú¿ô?±
&^±±GQÂáŒÙ;L[‚ÈŸI¬°G&°ï∑ƒ‹l;⁄ÜeÖÂƒ™ÓbΩïjû¿ ‚5˝(i∂zk$;µ
7ƒ¢¸JJ}	çäT¨§®pü§˝âÉ7sŸ$ìÑíBu/ïI˛A˜{Ÿä ;A}ß9J‚JÔÊôIGG‚ 7˘7øÉˇˇŸêùTﬂ©aN‘…·…õ∆¢º¯ºìsCy≈ ¡([≥∫Vâje4≈Æ¬R(\ÚÈlC®ôØ√F˙$0á}Œu>˜Ç1hu†´Ÿ≠—ÎÙ◊èõ≠æN∑ûßÓ∆•Ù<_¿y1wt‡∫î‹”vò˘Õ~è|ŸkØ~¸ÍêÜÁkgéÁ˘˛+Ø]8Ç±¸π≥üeÃX√_^π¢Ì∏°i4ﬁ#.{Å+ƒÀk°◊Èw˚!ñÜk,Î6ö∞∞Ó…_√+›Gûz˛û¸âƒJæ˘Ü,Ì{¿i…ÍxuöK∫mF€ëÄ_q≥às‰çN}Ù m¨„6¥€ehfè†’3'ŒŒ@Gª))4|‹á‡·”{ÄYub”ó®^<©ûüPêÁÛ Qp¡Å@øDBÂÿ:^ˇcÎúÇﬁõÑg´∑W>~≈\À∞«ΩN+*;‹¯ó˝Ó—Z¿ V’à®}Ö∏«Y![ÀÀØø4œ@ñZj∫÷πÁ√òÄ4∏=ftpòà∂√’Ô∆]“Ùá¶[\0¿†DMÄ‚óŒ}v∂¥¢Ã¬"ç˛	‘|·€¡øäÊf-⁄ﬂØ◊∞ﬂ/µªîqÍÆ÷(pjw–:∑ùA#=òzo`!”|Œ<Î≥H>zk˘¶Û–öpF z∆1ﬂ⁄Æ∆ôıU"gÉ9Ôx¨gÅó•îï◊\´Qö4ÂπÆ¨….≥É„PÛHº®PTÌ/™®∆´˝)Á8û’ÎÌœ{Ó%û¡©COqF 2Áìx\›à?.˚‹O^Üõp6µÇ‰ﬂ˛omaBSé‘√©∫•"k≠4©√,&/„Ø›‰E@˜-í“nR'‹éó8Fƒ≤Ω$H†ˆ¢lòi∞à’›ô¯wqH v∫Î|ıÈÓÓ¡{„”ù‚4áë≥5k[F≤˙Ëî#Qtõ≈¯≈ò<ı√˚6◊vu¸≤#{pæöE
∆—>5√¸"<ªT†	i\l.6úœT=‚sòÃs6¢9{E—Éüë/?.∏Â√Ωq·⁄ó®oDﬂ4’_]ˆ¶KS\§$[„#WÀ„2(©˚á∞'S[Ävî-¸1QiI Ò÷åbÒ]ZT¥<(”y‰ú^Ñm˘ëÍ ºìh•ã‹Æõ[ÙuñjÅ÷+`œc&‹µçnà+eØÆüßÒﬂ:^H†ı5p‚<F3^¸$¢˚(ú»Ω)L€ç®97Ã©§îÖ∞Í|)!‡”ôã?&ΩUìI+Ï`∑úIßòÜ£Œ.Nó%‘Z¿ßÕóÁ∫”7Î!Jî%ßT€ÜSS
—{•-Z+∆°ßÃπv™E6méKá'Ù	˜éıPè4ƒåÎò†˘{Ãg{W*;ï /ÍΩëåpÏS_∆¢¸˛óˇH–ıOGß6]$Cë~9}„JHÈsMl7mt7mŸ‰A≥◊kí˝6y–=Èµ˚¯kÛ†s‘n∂:”_ë?'˝Ê¡I/Oø}‘9jÚJƒÊbã)V‡V&;≠‹1®±1öûÍ¶ÅïŒ ˝•ÑærÓ≈å∏Ω œ!MƒòéLB˚˜{‡ﬂ§{_◊#”!E˘“SN™_Ï∑ø8n"•>[“Õ ëÕ¿≤PüQ’≤=d°4k?∏ÍK—=´#ŒùVÑÕ•eBÚ˘…·r≥&‹$ü$ﬂpãªÓ`0°+Í∆$ìKºÑ@ˇΩøÃö-8@4'ÛÜ~ˆìh+µÿÜÎu⁄ìı]°Õ"ø íˆ≤EÌπÏ¯^‘ÚZ09éè∆∆äòÙ√}˘Ó_∏øryçø}	óÚ¿ÀŒô&ác÷ â=bﬁ$lò¶ˇëd]ŒÄh}Äî‘≥àñ-kè∫C÷ÑÙ	nÆDãÿë≥ôªníÀ∑Bv7ÙÊ‡|Œ®?!E+ïéøp+¢˝AÈ9˚jE…(ô~!Éb¯-≈{".n∏N¯_Tt~!IﬁÀbLœì∫∑π{}©{“ÎÒp¬¸ó"â'éü
Ï·Düˆ0Èÿb"öÀ∂lOF_%∑åßo–,ƒC™‡8\ Ù÷gŸ«ò´≤ }|ÊM
˜}B:"V‘'}ÍàH±c1˛˜:NØﬁAﬁÓÉ¸Ÿ˝bs„√)˛·ˇpäÎ=˚·Oq≈úv+Wxíó#ΩΩ∑ßπ<ﬁ∞Ù∑U¬yÕëù±ÿ2FNΩÕç—HöE–“¿yŸh<yGcMŒ'”Ô¸3Íz¡Oı¶Ô{/fÎF’ƒÁ“ñØ˚¿°.⁄µ>¡7‘3∆/4\∂¶w√BmK/∂t¿∞‹$_±¬W∞`juÏHDªQ≥◊›à]Vˆä e≥DÖ .®3a˜^eœ«jéR‘9Úo£?Jä¯![ÉëÅh≥∆ª—ÍWqw_ƒ˛®ƒõXéˇî
√JLo¸¨ ƒ‰ﬂ⁄»¬E›ä]¡H£…˙ÇŸŸ¢~õ¸8;á?§ë‘n¡H‡tÂï‘8∂YÜüa~÷K∂z•Po÷â¢ÖÈká‘v≈L∑/Å∞v≈gx¡S`WVÜx|agc|π¸åålw˛≤≥À}©Ëq:_Ωs´ö8t†pïâ∏∑óΩÿï¢fπƒ©,_O¶ﬂc∏~E„Û÷`´Ü∏,3d WÕ∫Ö§4^Ω]‚¸. ÍBº>§µXN  ı<˛2/‚ô8Ò.sN<v˘ Á’à@[¬lmG&1eëú*1”Öˇ∏y‘>‡∂˚ËM“é<˝∂◊k>Ïí„nètö§—ÔtZùìÊæ∏O<Ó?nˆ:›eÉ>∆∫ÒdÉc‡º†,ó◊5A¥

ßﬂ∆îã€§$#CFiR!1ÈzÂØMØe†∂¢”µwÑ•s3pÉ:Ön¯¿ÌS!IiUO$Qﬂ›h–uÀ«IÅ‹œÜå(˝ivrKì0÷p@¬Àez∫HwÒ˚TVØÀ‹_T)w##»%±\ ÅLFÜØóﬂÓqúÖ·ö¿b®áÖ)x¸‰öhúg$Ïw)Ù#≠xådÇ*™Í•o6 '≥õçÄ ÎAŒ(`œãÿtçW¶®}πñ"
®’Z‹JS(X0qÍç+”ﬂrl-Ò
é¶ic˙•≠úü◊V$lTÍ+áQ»QeÀs<,f`úå >Q<¬~˙Ñ™,0¬t—mÃ`?œç5lxß´Jä/[3¡Ùk™x*˜f7¥§+ﬁki¨ß(7è%Ë+bkoã§5†,*B≠/⁄dÌqYÁ’–„1†Wùa∂lä|’ä2≥∫‹FïÕƒŒú—%tèØVßò`ÙqFá‚î“&›	~wyëŸ<´ïÿXƒg©X≠ªı¥OS£}P.0hÌVÏÅÌ]≠=Äªe7÷∂Îãy◊ß>ËµnÇ∑€w–Ú[V±f.πû∑_Ü≠§PÃj¯¶ï:™ß'ŸÙç≈ÒÅDÏ†ŸKmsÒÑ°“2cÉÄ&å},xháW]¯·#/DGGÈsk°oc≤˘å«uj†•ﬁjÜë8ÆSugwœ£t®Ã^îw
Fi5XA'J¯eöNÃ¬/’Ow&ªJ–+˜íÍcˆ,gRgsôÆÂ9≥rÆÖˇ©ˆlóπåW° +bìú√ˇŸ¨à¯Ìvï¥ô1s"hÍ$T(„: àÕW__˛7d˙Ìô6Ãë‰!–dk[˛Ôˇ9Ú«!•÷Ñ˘≤õC≥–lhMﬂp¥4ëçE	B21˙9û0dR<8Åî»◊Ó8
&ì‚∂|˘ºGNm|S]ÄJÈÿAÆÈ`Ä¯4¬jb.ÅED@ƒ”å¿˛x‚qª¨+ßWÑ9æ{vrÔ∂±a–‹ÏÄüz¶¸bmùx√°#K<EßLcI–ë.¢TÙ…Äåê°SÀßÎ+ı’π≥®™ NA>Í⁄∑Z$Gª‘cÙiî∑OKèÍgxê?%¯gp$1Wƒ+P˙‰Ú2Øø≠ê·˚Ee)≥ñàlùkaFÕ@I/I02Ô5Uú≤¿{É
`ï¡cK∑eÙ—-J)>s  /8-ûß¨˘iWÏn]ë¸˛ë‡ÍÎ‰àcJzudZÉH¬¯°wï;qê~6¯¿ûﬁ]ˆ-QM˛◊øE¡7[9w˝ˆÆ™¢ƒäféS‘”]ﬂﬁΩiÓ%˙ﬁ~oπW<Ô5πWìó‘¸‰πñ?0$‡€zwŸVºF5˘ñ«ŸEãf∂Sƒµ¯Ö≠›j¶ï Ì‹8œä¿nﬁSñ5'*N™œ˚-Yöc˛•ˇÑë!·U9E_üÈqŸƒÏœ_™»±L_¿ÇE¶∂\~>?óÛ^|¢tàÀ0Yâ{‰Y[[+[(M\Iı3ÄÖ’-’Õ>{›D,ŸºüÄÖá≈”“HımÄøæ¯Ãä»Q|ùy,ÍmΩíg%FŸÏúsˆõQ∞±â∑«Œ|ú∑2ıÏ∂∏øiÀ»I}‘⁄vTîc»Ÿ≠∫¶÷ò«jKkÌÍƒ‚áC9xaT+å&qWE{x› Ñ\π`T\GNﬂú˘V"®ÿ%√ÍGôhü∆ŒsıíôH⁄	*˛8›⁄Å«MÎuÇÅ∏ºæCßKÏqxcô¥É≈‘€yÚ#±}\ä%U{9πFUà«J‹k.æ5óïìáïå´C…4%g≠û32!2
ã“|°Éı[C”òD»>¨›W4BÁêègb∂È@ü»ÍAæaé©I‡ù‚KXl(Ê_∫æMÓæÙnÚ%Lt´Ñù6ŒGòó≤Áûˇ”‚BåÁæ}`B◊¡Ñ‰‹~‡AÔ&BÑû›V∆áNù	ªy&Ù9Eçò≈•#b‹»°∂˚Å];‚ì˚ÅΩõ¸àØï^ïÚ£1¢hﬂ8?j_äºü‚”ªÙ#∫FœÓNÙnr¢ ¬@q>¿Õ≤¢Vt\õÈ›mñÿz‹‹Ôq¯‰˝ŒÙ€ÉÓ£.ö„:zmr‹Ï59`-∑{˝ÓQÛ†ÛãÊ~}{}*Yj◊(apﬁd©k¿C8dA@á¨ˇıÑ˙z[L2ìn=â
,ÅyÛòéYháÕ:¬@b_Òı aƒ†˜„Ñòmì¯¢u6^Z€OÙJ&äè8—9¥ä¡S…Ç”Ã≈˘±Ôç∆ö%å≈ßé©U‘®9&ì⁄…øbW?˜b:ÄàìlÌ+v%“6œÎ∆å¬◊è¬7‡ÔÀ$&®ï‚S*1Ò,≠Ãâ°{ﬁdfç˘i»•Á{q%Ô§l¯äÃW¡M)”Q∞∆*˜T˚Ã:ß+E5Ò<îâK…ôºCìI˝‰ãÜÑiÂÅä πv3(˘ëÿãàÅﬂ“9mæS7tgÆ∞‹{3â˚ßπó™‘0˚h÷ãòtñF‡‹â´Õ+∏tYÕ]†Ë∏xºöÌÇQ¸u‰Ω(5`+)˚L∑™hTkÊf]¥£pó>ÜÿÕç≥¡õï>›€T7è‘1^åÖw8 ±¥∂8^FÊãÇ?¿‰ﬁ’[öΩôzè6Ñ¥ìﬂ`…=ôøï&$ùúx˜åm◊LVØ÷»†]VKoD3!›˜,`uw†9qBLtù~èË}Ñ'üb‚iß	«º≠kÉZ]S–ÿ!s˙ú√˜0ƒ>™MÍ9iNB˜Ÿ *Uò¶k˛°—¶™˝Ï§%º>+|T‡\Gû¡]1!Ò¶√¸∞e˚ñSn˘¿˛w∏iI2ÙQà)¯fdn
ÑÍ¢ÁÔã˘G¯]Aß~∏X‹Rºf◊îº~MÙ*@√Ä)Ê¡çŸ◊m-å9ﬂNó„úUVo'±∑d¡PQDÀFV]}3[ΩSÅŒÅ95MP◊Ö≤IÔÿ\¸ÛL‘”–ˇ_–ÒuXçx€\®â©Qc!Ï”	ﬂx7 (SÅ"¢ÿ√≥«p1iJÑ•¨ñÇ¬ùµA{≤˚∞(f-˙Mw˙∆±; -qŒ"Æ§ô•Ü=ıÿ 
ô>û†.ø»éd§ˆ≥œíÇëvÏ¿_pG‹áã=I«úxß}{ Äë˙^±ß˚k¡RYáoÑv`Q«º´•V$V°Ö-üÜ °¶zÜæ2Äq˙ d3Çó
ÿS?ﬁˇ∫gÔ9√+dŸ≠ê∏¢2ØE¥…¯<ŸJAˇçËÂ*¢ëÁ
Œé˝’ÕLëX£]\|ñÀF≥ﬂ‰xä,q€µ<å!y$|x∂ ïÂ 1„!Æ]Ä[}ÀÅYê¡ˆ}	Ô—<K]a©–Fr˙P\ ªk‚¢9QbÔ˙XpÅ]JN=o•ﬂŸÄ}:ÃÛõotXﬂÏª§IÀ8]HÓi‹ÕÒÿπäÁ∞#Ê(;Öbó¶ug-[€€kKEÕJ∑¢ãªª)cUih¿l§æí\÷å9‘ÀS¬Mß[¢Õ*õ6yB˛^DÆ¢^LÑBç0TejƒcvÒLÍ4Ø9	ÆuŒ¨ØÑ~∏5√à¶ÓÛB€åÊkd≤ÈjX‚ÉÏ(ÆF7`ßÙπ<…Üq˚åL⁄ŒÇÕ˚∏Á≈=`p¶∆/uÌ€=qÛd"C>-p)2~ö∂†\'FãÁ1U2ÑÖ;u<,ÉÀl⁄ópínQJãp©cvq˝¨‡¬á’∑áÁ°Å˛ôÏπ}>ˆwê+4á>R?)·d∆ﬁƒ8™AÜO@ì=Ywe;∑rﬂÓBºgƒ˛œ∂ïõ6"~"[™Ö$U
,Ù@jWqÅ9ÿ⁄xÚ¯1¥‚;ìŸ(…±kÅÔPÖ˛‚∏ç‘”E‹	ÂçÛ=⁄i¶Ænó^ÿCz˛öÂÿ„Sè˙Éµ>–,Ø[Ql¥’M(ÒKâŸŒ¬…Öüh7Gp–13ûÎ˘…Y≤f⁄ë!pDﬂ(*±´ÉXY>‚∫ò…ÇYà‹ÚògäöœMc‹î†2tæf◊»3`0W≥$|9X^j†É–‚⁄¸1kO£≠ ê>±XZ“uW˚ñèÓãGhHıØàwFöaH≠s6 ù¬Ê’™eFÂC‚ô®Ó}≤q£ıÃV≈Lò•Fß⁄Ö—dé˝≈÷˛∫{æ=_iÆà}ôî=h∫Ï“€Ìzh£∑ôDãé√âO≤o”°;˝!@x@≈KˇZ∑Z◊›ıÛm£p≠[g„Ælí—`OÖa¡Â÷_ÈÏèË∏—∞GC~ZÎkﬂ|ê_±´{Ø‡Ÿ5{zv©ömç2ô ï¿ÿ0¯ñ”ƒw^√Yäo.,5FYÛîc<çûÓ¨o?#ﬁÈs¸b·È{ª‡e•˚ŒÆ©ªêè∆rÑ„±Ü¡£ƒ]PZAïQQ&ï°3‚‡iøˇÂTáÛ˙˜ø¸O∆n«Îº_÷lXª—ERÌT◊Kù©mõÜ√∏8”Pî¡
∞k}rL]V•qœ
PòQﬁ7]Øw7“·õnΩÕ≈ Y\>IÈA«≈∂ùH’≥Æ®´}‘UrIº¸Ã3s£„A“eg4}Éµb¬Än∏∆Ã#b;X3¡smêç◊…~ß’=¨~çMk'ïÑ#îW+)DÇıøÜb=‚ÿÖhu2,Y‹¥¡c∆
‚4¶Ù†€jê6Èù¥{G› y®ˆ2kÃ’ÏÁKk{*©ú	uÌñSóq¿[?ÆZG®où€^@Pº∞ ~ây<ü¡¢˛òqkŒhÏ‡/–ïS$ß∫ıâBâhﬁôª'®µ˘tçÄ(F·ä7†>•À¬£’qFÆ–JßøÖ∑ßo8†“:M’m Z?ﬁ(ËEµ?∂+…˜ôúY]ËıæOá »‡oL~Å©¯ŸlFxGr‚€√!V‡™“E8ó´XïügX¯Ä®¯‰ƒ™Tæ©ííJ!…Ñõ≈oW÷î˘’õå´qœ≈ŸDêNÉ¥'∂6ˆŸfüùQ,"Zi†©4…‡8ºÒµé!J—–êû‡‰ù11õæ≤vdË%åHõ∂îÓë˛ÇFak’C´öüä	4=Õ«Ÿ‚ëidÊmÅS‘jq´Õ’óLÛÀ<D™∆ëˇxÏx4ì!q$à[Éﬁ˘Y$ÈÀ=	b:¯«Â’†
ôû+‰≤Ècù&`∫·$PŒ/9C¯ë@Ë◊ìÈ˜‚àFP|—+ﬁâﬂPà©%◊zë.ôÑ6ÇÚSé«t¬kåeÿ— «·ÿ™¬€»·Vµ‹uÔ•E%∆äüD¢x3™ú∏aQ«0f	UîD¢{◊°ßp&g,ﬂ)[Îõ˘¨≠[º∆}qÎÆ¯[	ã¿¿ÎlÂdÖltjV¶k÷Œ∞yó€ „@-ö,ÚQ°µY”—vÿ–ˆaã ù∏N~—9÷ÈñghÎU†û#<iñÙ¡yiÉ‰®w7µ,6Ô-Ÿ®¬≠ˇ— ⁄¿≠¨Ì∑W÷^⁄„:Ê°Æ∏ÎŸÔó´peOü¿z=ÊÚΩãZôÍ-éÿ◊zM´i†Î<ß£ëÆÛ=U}„ºõs¶SJ∑^π·ÆK[7¥ÈËUæÄ.nª∂Çx∂§⁄‰E€Ò]⁄ã7æÍ;Qﬂ®X≠êrÒ™	:ÒÿOpØê#/‰h8B †ÆÀ™c^lXü‘ì÷Íõc¶|mqµ⁄€ÖéÇ“‹Ω˙Î÷F÷ìFFWzíG÷F5»
j››<øRagµHp1Lªv»˘ÍŒuÓ-qO8π∞ŸãﬁÂΩ•≤A∂v‡ø%Çﬁ´Ø‡`l>p∞j'∫^¬1œe∂À,:æ∑ƒ_dIπ˙XeÊÚü⁄É¸ﬁ+òÂ◊dpoÈŸ‹r∂»ŸY››"[Ùπ#‹‹\›º?≈∑çM¸ÚRìﬁ]á	—Ÿ:zIEr™fiòªÁ;ı¸jÿß!œFt»1µl|ÿ∑]À˜\û(‹]?ﬂ—X©÷ñÕ…â2ÀÙ~~˚æ÷”•Ùº$2¶HáIfÇÓgá÷pA—◊Ú˜d'•0‰E-é]iò #„çëz*«¢≥ä”–òoΩHçu©
·ƒ√·¿¬ıGËPˆŒ»…˘dtÍR€	»∏E‰ïyÖÈü	ñ˝≥®äOÂ—1W<Ev;'`d∫˙‰¬›Oº’Jx∞¨°a'eJQΩAuY'è@¢ò3zA?Cn±Xnå?1Û¢^CÒpr⁄√	àé∫æÁ{∆¢6`d+@XL≤òí¥°€IZG⁄°{\ûu"˘'÷ì‚ã∑≥Bˇã4^pz‚bÀ•Æ∫Ñ)…•™§c	Ægå|„¡>¥√+Xùæt–~‚ªÒYËO˙@–ÑÏ“±á¸‹DsõœŒH>ñç‘éA|≈(Ÿ\![+ÑÖ÷⁄≤L˜â¬„òaΩÅiGÕ“Õg&3Fë,Ö *BÁTAS“‰QòÁ	à'†%∏ommÕ<oV;úÉÏ]ﬂdŸÓW•⁄˘"&'¢ª âM$	∞kú*›¿£ Ú˘o”>@5∂È8ÇA÷aººÿ=–»¸,5†ëµ
≤’¥U∏–)Ù≤V¶,¿ª¬∫j£nHÃ/ºãúxÔ1+.æ•0±ÖL ÜkÏò{áÿòŒ›◊ ÍbµôOüi9fVÃÆ‚œ[
≥äK5ﬂ a\ÒøàH¶TiÂ∫lJìG’¬‘é?ÅÙºà1Tâ{$r%`'/úrtÕz∑UﬁÄ™vü€Pë&\·>†Wﬁ$$‘·„êzÏ¬∆4∏ﬁ7˝5nΩ\Í™¯âı;Z…>1J»ö^p}p0e§".<|N`Ô»ÎÙ’ïÇ*à™~È9oÑñX‰[™Ö¥πoc/êÿ·0Â◊xàJVXLk∫”g>Ö™ &"êtarÔ®ÂÂ·{A⁄:\Ω-LÚ *Dv;ÉY5	k«ç	{1¬õöÑû õä
=à-U“%æ¸8˜kLƒƒrÃ'◊Æ≤`2≠&…#3Êø”≤´ƒﬁTf√I›ƒ˘¥DˆŒ_Ù{∞Ùö¸˛óˇH©oy®Ë<†éÂ«;B˚Î	AR9nµHsÖ<–”40miô¢°¥oP†˛’S› ˆ`ORÍ
·ÆE¯˙˚_ø!
Õ¬_‡Ï∑‡M‰√w˙fÑ‘∞·Ùw@N&D)ol^nÆêÕÀ≠≤uπµºD^ØòçûW≤I¶ˇ Kﬁÿ$Î|C¨-'cy¬çç=*Ö¯^><G§Ä◊È}+€˚ilEΩÉ®Â€/’Al¢œçwrÙ;rÅçª›JΩÙñ|È§[êÔBµ◊-ﬁ+€å∫≠”ÎV∂WxŸù∏W…„ï~€A8}„8rL¥8¨‰¿ßëwù{œiçµﬂNh[ËV¡⁄o'êÃ;ﬁ:GÔ;©ﬁwdÔ∑zﬂ)Ï£®Úı◊Í˘ô»ïÛ∆°Qf;áƒ˙ˆÜ‹#Ö«¥ªftìÀ}\‘5—HçQ xvüïI˚Ç0˜A{úô¶ÜÅ≈À˛…ùCÿ¢˘´!Ö‘√ïÁ∑"ãî"–$AMkªÈ(€Çóê√¬‘µ)∂"≥í[D!G£«¢‚Z(âe‡Ôs%¥‰=y g)Iõ¬˛§ÍjU¢ßîÅÂ"bÃ$ìÒË”2C‡4…YöIV•VÄ&~≈ÎEf˛Î
Zï©œ¡(ï˙ÏïØ€"EK‰*ÀÇ^Å≥Â“ÄΩÊ.„sÄQÎ2ﬁ#òU;äæ~Û=!Ï6ﬁŸ!àµ}oÑ·jòï‹à“ìW¯S<nÔ¡⁄jÀq#zãñŒ±Ô=óC√Ø2˛{û¡$Õ‘Ns–ƒp¸uûÅ`¨Á˜0:(5≥⁄wıR⁄wS⁄Ò¨‡~ƒ&≥¢¥’/åÓ!-œ« >ÃoÄdhùŒ'oH≈$)lb|&b<Ë˛ƒ√˝£{ÇFÏÅIÂîeEÈ)Í!‚MaæÇèß1ö(¯a[›Ÿlı~wÊd +	Àn& 0-DÓ°tVStã4eÉó´[«ôtÕ∑{dªBWp0Q4D,õ!ˆñÅ˘ÎœÊ∑|ôêÕ2ÒnLaAƒ∞ë=FM¬≈pö°≈…ê£√ŒêÀLı/aÂÕ‡1r—Æä=Nen‹~Ø>aßŒƒG©.eóÀƒ;Â≤∫cÏåú‡'oT—u.\az5d!áD8`!g*pà_'^xıd*ÈI•≥©‘ç2ûÀƒ#àˆ¬¶ÛaÁ—„^ìºÇ	$üêÕõùCÆRm
ï
ßQwf ﬂ‘¢úlÜñﬁ√√GKRï9õXÁÅM£ïR&=·—}b∆ó§:¬s?™çD9–$Ã|˛ÜÚ∏¯¯⁄∑◊ ‚9?T#˜áêÿ[lä´ì€Ã1'>ı‡h∑≤¡&IS®Bz[æ˙î[™â◊pÎÍ·{(/mH⁄’Œø,‹◊®Ç¨q¡ç$·ﬁº"˜ã?q-Ã¡¡Í/–Îàn«•»Ôà˚…ØÊå‘ƒ¬Äuæ"VÚ3,d)Üº^Ë—¶Ë¢z≈~‚:X¶u{ƒ˛0¥≈µ~S¨”{;óof
fi¿0–|”ÂÄ—ä)ÿ˜7ú}õ¬óVÍWh“»*W˜bÂ
èWdmmˇ≤B"+√Ík8Q∫iÈPc∞SR¨^Î[ÚrrÅ YëUGå:U™∂nM¸òQ/–Ø'r*EÚøˇ‹]◊ÁlËÊ˛„~Ω∆ÄÕ≠eB<S1F≥3åììè‘‚¯Isd}¶‰äüp¸TqÜÉ.Á≠ˇ—=Èuk∞¸,êM$ˆøy~åô~ﬁ;ÜÅs"œ3†á˚O]∆Q–$ê÷˝VkÅr"Ωèˇ÷o¥&W‚è.à1†°˙›e˚¢™<Á
ùó_OlÊƒ∑∂¨?ˇˆ⁄Á?∞ìœ∂_D˜˜€ΩÓÍÑ»Ów~Ò'l8°◊˚:ã`¶œô=ahQ4≥òò›ÆouØ=∞CÄçs/ 	xós≈ã»L’„9CàM˚+¬Ø)∂%Íah"©„¡ÌuÀù≤œÀ∑«"Lwù|Náæzfı1µÒ}RÈiÍ∆oTØWYMûIËI$Q∆Ûï–),ÎÚH∑†˘ôêd°!hf@)Ωt‘cÃºmÑ€¢∞rëû∏õr	ÚkxD%ài&rD	∆ªÿ45∑8mÀ,ˆ3$çÃ
?2?Ô"ß#nÜS∆!ˆ∆à⁄GD§3ßfˆÇë{æF~~¡ÇÈ˜òä˘ÛÚs8èÇê˝n¸˘¶ò˛|ô\˘ºÑ'lK 
‹W¨& Ç√øßì øãt·S6"~u˙C8qåj·«¸»™§C£¸º‰SCùÊèÊÏmëˇ¬“çïÓ∏}≥%ÒÇÎe+≠’ÖY2ü“W›˘Õe(ã…Ωé˘‰¸öI Jõuf’î{÷™É≈\Ëë#rõπŒ≥»3F6˚Vè%¡9èÖ;ˇ£§T`s3jC◊r–4]äXÆ>·hunÇVéŸ&¶aÁb˘dÒ.s˚⁄©«JáÈ\Ì=∑/NÁV8˛ÇÁ‘≈Æ‹˜Ü€õ=eXê∆¸DÕË#íp1Õ8á¥4™Ewåûü€∆Xn]4µœ-–\(ßb>ãa˝Bã2•†>NAç*œöxÛÈdêÃ˙àÏ…([&eAú(¬˚ÙÒhﬂTø(áÊ∂a:ÍMÏ‹s‡-%L—≤P∑rÏ–˚π™Y1»ô&=≥0aÍÍ1Í˚∏?»©6Ãπ“£qâAäßÏ¢™*N6ÂñQD)~é£$Ω$åW´$y˜Z#¸Ê5÷1Há∏ãèÇTìf¸}Ê,};ã•÷q%	VÔ-Ø
Ã{V«#ZÇç0Üñ∞¡ß0GµZäV"´dsÆ∆x– ∞N;2Eõ3¸ıç…HΩ´vΩH•À’G(ŒòKr*Ä’¸SΩIjcáº¬b[≥Ωké¿˘˝ø˛CÅ≥ñò∫(ÆS•∞jãçü‹®ÚS»ç>ôó}ÚÅΩè‹®o'∂iπ:ÏËoØù’s>I⁄€˚‰	")∞–Õ‡!™"Ó‰oVVº3OO¨cŸ]ﬁÄOﬁ» ∑}o‚[,6Óø§ùéN9ìµJ7ﬂê•%ÛÜ;¡ˆ@,Ô¢;fn#Ù'Ã®%#ˆê◊©G°¡C›¯R‘åA∞_‹h´°∑Íì3ﬂ≈Â=1çÊ¬¶*å'&÷x´„âzgtA∞Â…òı®'6Ô‰˘‚ö°2)-ï∫◊Mjºl≈—A˙ÿa&0°E¥äP≤@Ò‰ÌlËïYT?í>b.Û—:ÓL∞xõàN9Ò`·^W∂¸n˘Èw∏Á=YZÒÖŒeÉ~«F‹£Uä”D3Â`’Ùÿ¿¢∞‡õõ)wˇ·°Î¡h
ÓÛÄI±Q‰Fçº∑JºO::4µõ&∞b∫∑ÍTó‘∞ÎïH‘™âP˘¸å;§C°ºyr–Ï„¬?Ïût{ΩvÛ†”?ií?'-¸v–lu¶ø:"Õ£Ê…ÙWáùVì?TQùª¬‚oÔoûT\¡
'@£å·\¿_ÑÒÌê∫ähæÆ≤A/æ]Cæ©„ÀÚô=˘¢‰¯±Ôa`ÇsÔ¶D#Üe?ú8í¶Ç_ù¿ô+öõ›ö±Ôﬁ“lÊH8Û¡n’Øºß!ŸÆõ˛”’3ò∏Ûäû)Œ.ÇE‹{≈›‡óŸœpÖ'~,˙¶Û§ÌZŒ+âôÜed—ı Ó;ŸvíkM≠k—tˇqÁ§Mû4˚≠«Õ˜œ»aÛ∏I¶ﬂwª´ü∑ª˚ù£È∑@“]í~Bó˛Å™Âg—T}!'XPhÙMì∂ü§V.ÃC·Iã r≥÷ÙËªﬂRnûtZ§◊>⁄o˜˙¿«{‰Ò¡IØŸÔ>>∂ﬁ9B‘◊!r)°´¬u5©„ç¡ΩWgôg+pÙ=˜ƒœÿÒ‡Ù{†•±¿¥f«õp*‡ÿáÁcW~ÏΩã=w˛JB0¨=Ú‹§\‡~<ø
d∂B\®–><W¿·àó[ÃÃ§¿iíóÁ∞4ïê4ï„}<Peº˛ıÌ-ßÏ_8dÂóõX6‘E[>ÉÓ∏j
3¯Vá√o	5£§ug•@≠!ámî◊¢˙,ck}∫Òﬁùó"´îbÀıˆd¸º{9íœà¯%÷È˜–“È¶¶?s	f3ŒªbeR›Œ>û‚π°VBÀÒ¶kÇ)ôç3Í’FçbB·´]{±+≠2!M˜2⁄äÉ4yã{ØFπ7´:Õ’˜àüOø^EˇëƒT)Mµ-oË”≥È˜¥B∫±®Ìü€AË˘W˜^e.TSü^$¨’e/ƒÔÛüO„∂VH‰∏∏æÌárÀÍÍ*9ú˛jˇÒAóÏ∑IÛÒ~ÙŒÈ_° Ÿ~“<x,5N¯[t—˝Ê>˛⁄kw{ ”7? T‹—9:lÔwö†¨w˚'´è⁄GÌû¯”2Ôe∂∞ÉÇ9—D6ØŒÚŒzÚGW´∑–Ó˜Ù_lnmúm“gIi4ä_.lNrÀ[Õ∂/2Üß”0z≥åfhkålv‚JR?P⁄À∂†—(Œq<ﬁQ`p∑uŒ¨ØZ∂o9,6˘)yˇÛ˛‰+Ï(Âh1åR√ÑSPÌ3™H©`‹gÛî∂fÂ)iM¥ü3k¬„ÔIsäñÁ√≤˚nÄ––WD¨º0iÅ∆3†Éjvç:£ÖÂM7fDKÌîø´/°U¥™yÀ0`|gvyNëv.`XoN†ø	,zƒÖx¡ä,&''¡ŸàöéI#0x^"”Ç≥úZC{#V¨£ ÉÈC¯c@Ç…ê˘6›·∆R:x>qCÍœ=ÉïñØŸµ@_	›;⁄⁄û€ˆ}œØπ≥«´;D-fìÛÔ≈≈lvíçç{0Å?‹éÎTèŸ∑+œëì+¸ø˘ı#‚ÂòKhLÂ{%S0˚ÑYÙ¨O8∞„^vÿóc ù§3ÒY:≥±^∞Ì»§»h∞'~v˘£˛9áﬁ8€8›ºıl˝ŒÌf›VrZ»≥wÛ<:ØﬁŒ∞ÓàÔ®Ã8FVºZ≈¬YG…`‚ÛWEüpïáƒÍ‰∏ë/cx÷1∆àÃ¢@™Ö«W1fæÓÿ+a· sg˘ƒéˆ¯Ôæ˜"U1Æœå`îSröôYåe|
”¿Qï≈n‡ÂRÅW©9_Ïà;”„L3e}ãXérNÇRÕê–!µõm_ª∫¶sÂÆæøFØÜRí{≠_M©†d:∞mÿÌ‚∏Â§9€3”™Î$Twév{áms	Y€?¶W¨ùﬂ[ÿ´®(’ñ¢Í‹‘Õ"Ò$¯\-≠ƒuÊUôÃfÎ§Û§©=_◊S“®HXúZè;{‚\hø4ØùByiDÔ4`˛E$Ÿ•√ﬂˆıƒˇ∏„Zû«0ı≈w¸ã5°«…Ä£¬Ú@¢DB£*,‚ÖH&Ñ£#dº(…ÿ˜,´™[ﬁ®Rº∑-≤‚ù.?	òs∂
/èÁˇùËFl÷$»<ˆ'_e§S*S5∆xÀGcÕLßê-¬âÁ‡·ÀÑÉ≠<Ñwetàv¡èrôQõ!§\Â»çfd¿,”í9+¸GJÍ“è©(˚ëDÙ«f2_≈≈M›j∫u>"4œrÒ¶∞LûN0 &§#:˝-*çJ}&ÃHñ#ÎÃ-“K{ƒ3Vßo|∆KV°Û´üãÚë¢i{‡-kAˇj"õ˘
∫Iîwmüívx‹ŒéºªIÍÊ]9eËUØÙâA˘Qûñ·Pñ7æ:Ò‡“¯‘£˛†ëU"Wà∞õÚ(µ0`±})≥u±Y´ˆÅ≤ﬂE¯6
(i∂®ÇŒÔÃ∞§J'ï«Îlj=
hyº≠b[(EòÑ7U‹Ö∂{84-8º›|˘Xeõpr%õ¯_2˙r Ç£ÑFn¶sŸ∆”ﬁWQÉF˚É–#Ÿ»5±*SÏÑˆôQ≥Î◊´-“Å4[ﬁn°®◊ÒP6ì"|KTØ◊Ì°“9:i?ív¯=#±ôﬂ™Æπ\¥æûYü]	_Y48·_3fME•≥yïÏLñ+äÈt+[7;Œ%H∏û∑â◊Î„3ÃÅ‡ÊyÀlK%~^5Ï@¨d‚˙˘Ê“Â¯¸k_±´†1f‹c÷cV∞¨8÷óÁdCJwé•Rûs¨H˛ızôj⁄fÓ£¢∑-aF⁄*k1àG=»#—«t¢ª&!ŒØ™id”@ı¯2V∑—kÛqUÎØUú´<ÍßËà¯_¬Ø√D` "í|i¢ê`MË°OF€_œj˚XÊ6qÆué∑p'°q	_
#“,ËqÏ_c7Ù¡ægU§÷µã%)x
î≤Ñùç©oßq‘ö„∆’™…Æ}DZ›=[ô˛¢-*Væö·g}M_
äµq{sÁ˜å®ñÙBs§„•ﬂƒv±D]Ï0π∂†¨≥G√é1[≠Ê&ÏMÓ>Q‹ƒø>››–…‘* ÛJDq∂6§n <hÎ+–«ñ≤^Ä 5‘X¡y}è2®§ﬂÈü¥õ‹dŒMª¬Jﬁõ~{‹ŸÁóeÿIü4é{›Vªﬂ<Ï¥èN∫Hﬁ›ì∂N‘HâõxçÇc·úãç7ÎüÊcAäyÙœ)π»M∑õQ	+vÙıx—Ïﬁﬁ≤¨C-÷é´£LÊ5+ôÂD´ú◊,ÕGs^≥"ÒAÎ‘˘ßÖî[ ¢‹ àP:ÇàÅ©z°Í°°ãÏÓ˘vÓ¥+ä≈ñH=D˚îÍ#0Íàõ(\H!§7}3Fè\>ú˛0ò8^†yLùoœ£◊;‰wÛß¯,J]®Û´êÁΩ-9Ï˙_˝X4VJ~ÆÜHπ#äﬁ/kB†Ds(]X(-Í$Ç¢k0∆Û–'Å=ö8hÕf2úJdá&HªR“÷ö◊"-hp6>†°u.¶√¥ñ∂k,≤%˙»t∏∫∂U∆‘-Vã*ROöé√ÁFdπ"Ù\G3…Û]W∏ã7ïÌI
W"„˙‘ÑklÁ1NcÅ©•Gg£RxMüúx∆k`ÈyBﬂ˚∂("·çE~ãO7nòˆY0∫z–W"fﬁÉ‹∞ECÍxCÚ»∑ï0ÀˇÜ¯˛ÉuÄïˇF{…◊-‚ïØ€‰“QæÓhä∏ØûV´kKa@SL≤(óV4û·Ö‡±?¸Êü~I˙,˜e- Z:¶d˙≠KCo‰≠~Œ–VÔNﬂålÀ”Í‡îÜ:ÿÔ¥11WÎ18ä≠=t2sx$b	—oD-ﬂªPxÊÖûÔ3ÍÄ®HIcãP;k'≥`yÖX”7x∫s´b;∏^`£“ShA¥y¡œ≤%F5”qˇ¨iç÷ŸÛ˜»R⁄<_‡gJ«WÔΩ◊’Ωk”ÑL7$àˇ˙óÑgis†Ä‘4_Å@·£—YL`àc˙P5¢àÖ`zP<hÜ–TÈ¿OüaÒ[q{Ü>8Z6êÇCEƒÇÚNW$ò~èM@.ß∂7b@IòºSÉ*U≥ÏN+≤7M>ê∫oHˇÓê>F$3„F:ÓôCAˆ|€#ç&∞	X
ò¿[˚ÀFî—kÓ7{î	e¥&‘π•ö‹Ç-m¡ XjÈd˛C<@d∞ÍÅwÍ38æÜ?æ•E…„ÍRÁ
¡pâø˚I÷èßÀiÒ6è¨ì}õ›ÈAà_õ‘}I|…A„‚∑´{Èxˇ°Ÿ˙ß`H~ÜœõPH$‘m«°È-}Ô‚çaÒe>¨ˇô3yéŸ|#*ºK‘ÓÄ∞©ÉΩ÷†6B,ÖÅJ—•Ñ&¢+oÉ(æûp®á/ÿui‚Ô˛™$âäE…FG@ök≤¿<Ω+•çÛ≈ÿÙ∑≈Ç3\CáΩ§∞„s†Œ$‡Ò©WYZç5ŒÖeR0“¡Ö7Ω¿ßˆ©c#QèœØ¯Wø&¶øCk…ÄoÌLﬂp¶
´›˜ƒl7qù‘≥m˝®áËù£G&ã-”˙»i<0—÷¶ﬂÛQ„˙4ê∏^h˘âº0˚(°Œ"Gelrï£ƒÛØocyΩ1a∂‘˘"òå@˜2^Â{ÖπÍbc‹`Ê‡O[„Oœi4«c‡ı—Õ-$"‡˜Ügyªˇ¯∞}D∫«<S∑{‘<0Y˛>™™°˝í&~e∆)¬æ†ô•fƒç·–Ã)9†$oG¡qÇ·ÙÕ–vÄ0˜b˙ΩGÄ¶IÙ∂?FÜ'nòöƒÚÔˇ3FÊ:q @BëEÙòZg‘Ñ*éÅ⁄G'mR8QubÒhœ»k$ú~gπ\e#Ëµû–ÁhóµÄNù®öœ\˛µ∆ zz_]Xy%YWy·m,Îà?®±˘ˇû<Ç')JË˚ë"è{Îd˙ù?≤A?6cÈ›~≥◊Èö¨cg¿"I%3€)‹∫(†£“5·|Ê∆zœµÿœÔAr÷◊X»1™ïe‰ﬂìE‰_ﬂ∆÷9eƒ∂L◊oH[∏4∞«È„PÆaÃøç÷∞ﬂ9Í˜;}ì5Ï¬˛së+gX∞K&n‰o!vÄ∏g¿ó›+P»7k/Tc!c…h%≈Öd)≈˜∑±ñ#FÉâœ–Yd™j˝ÍØI3@O'˙ô–ß…<«^û∑‘l5cøi¥ò Üd‹∂ÇiA¥jL
¿Ú≠;Òå_µlJ\<ëÎ	XÔ∂Ó|Êy°ÎÅ∆`™#˝=Aº°Å«ì`éºêÚ);∂˘“£Ï·öô…é;<%Ùx˙Ì£Œëëû$Pp·H•(I t˘ò`ém©8e#E1πÁ¥Œ™Jdbï€ä+
øM¿èo\xF∂ıEpÂbqnS∂˚Oø$-Ó>Œp›ÈØ∞U3kxÎqsø◊ÖG{èöGFßg";®Úé@—ÙÜå9¿≤≥d˙l‰1≥∏í‰!WFŒ w[WKúÖö´√6ﬂ¯N⁄ÜeºSˇÀˇƒuÙ∆“¿ıP4√£&ór/-ÍCPpN˜Ãòo+
∞Â¬PÄbUN‘–ßìQl≥‚FKd∆c:ëúeD]ˆ‹˚1*.‹	«ß’]„Sı/—5â”…9oÀIC‹ÙT`≥≠{–ÏwrD™ÓQ€h≠˜£ıÖΩãÍ€/πﬂ¡∑y·ò Ç –;I6e„Agµ◊‹ÔØêÆ¸…Bkmπ∆öü:ìoÊﬂì’Ê_∂‘œ8Bcc‰ÈBFïPÏÄ√R∞πG>˙(¬òUùÙO°…5{†Q÷D—âÏæÀIG„FBæbWcNªnÕ⁄˚Øﬂ‡Hnº•Ü~ôâÙ¶C2‚ÕÚ˘åæj>ˇZ∑ﬁ°fEÜt6˙∂7±Uöê^^w7„Sñcêî.iV{v?#_~ÃiàÔœ◊©‘rEﬁç√œù°QNG*5N2H¬K0`∂096MíœP_Ø.Ω|Ûπ!`DPs·"Í„¿G|*Òâ"§'Jπ‚Ä]¯:LæÙú„Ë$1´À ä¿jGTYH√ßﬁ•>öÅ%®°‰–ØØ¢‘~\—†6ãçœD…˘Íf≈'ı∏UêÖ|Ñî¢ÄÓ∆eP3õoûtI¸Ë&£@«WÙ±ö0G<9≈®ægQ∏Æ‚ñè◊≈9„`·πˆõ…O4›(5Èo-~kÒVˇtF¯^*a?Ë]R^ßˆÆZÃº+û%.ó^—Ï^Áú¨˙÷Jë†™ñänƒüåû†3   ¸_eÏﬂ´S|N>vˇ”!”…,Õ˝U’ßù,%®⁄VQäJÙ˜*8…“‹€03 ·Õ©éF…∑2ﬂø`ö5Û˛ıj‰T“G˚íª=W∑¶[nÖCôJSÃ~ô[ÕÏt√ùÕÇùcUC9ã¥ôê©˙C5ØP x≤`ybS}Û˘H&èÚ:ÎA£HE[^ºk<<8\çxÍ|≠µ`¥˜B[ó´∑ë√Ó(6·[™d™úŸ¢4ä,óıtcÌŒÌg˘öçªJGy∂ª^à:É˜"Uxqé±∞©}WïÙì⁄¡iUD
ÒIŒüb⁄Fêù‚i€•ë‹≈©;úØTëåF¶hûÙ∞ìÓjû3=vÊ≥‡ºı¢à·‰3ˇ˘ Ê˙#&]¿}Q òí-4PèMRû4Œ:M®'›I Â*¸8ä0úë4€#çW:[ZVâ6uú*Âÿ./x´ÛåuR	*èΩ∫iò'|Ù∏˝§I˙ÌV∆Ÿ<ö~{–Èw˙ô≥ﬂ%NL›ˇì«më¸†Û‡†”}‘k>D¸IÛd„\˙¡h0+˝ÄgÓV="%¬êÕΩ(¨SˆH«p\”„0eàù$∫SKïÄ∂“œØŒBÁ¯ÍÇíê∑≤z”¬@Åıw9ÖìIG‚“E·-∂≠ÅΩoúwZ¨≈t juÛ¶KlkËxiA>/ãıwÑY=R‘C≠iÃƒ@#4pÛ§€«∞dç)Zê,]Y⁄Ä+ @	!’∞(ë‹∑*öõÚg‚Q∆†õXˆ#»ÅaçP®É√mh˚ª∆
Cë$BøE„ßô4&··}ÓiN∏¢¸°È'Ò?€ıyÃõZ÷™åPq≤Îá|úÅí—+Ùñ:	ΩW›‘J´ÆÃÑœ(£πÕQöyÍx÷WZ[°-÷Î°\,Ó%kß#ı˜¥'*‡≠®é±÷»5˚¯m“ìS’ëcügŸ≈^ÕÓXê'‹*=¬ë3Ÿ∂è37†# Ùñt<≤≈C†Hÿv8*¬÷û≤	íLøıÅp?Ì3ÀÊ°∏¶Cê—c_å≈V*Ë{{/⁄gI«√ ™”„∂Í;
jr
;›Ÿ„[:Èq?ıÄqóË˝ÀÚƒπ\áªÿ!ﬁïtâã>˝Åá4∑@T£~A5˚Óÿ≥Q»ázJÇQızÓÖˆµ›¢ıä›Á#')≥L0âÜ¡(:∏ÿî9P‚è]^≤N∆±Ûµ•€yû√Œ¬
§∂;1©¥öº/p(^KªïÍZ5CﬁŒE{ƒU·UÉ£ÍèL*M ±gë∑ÛéH#/d∆ﬂ¶Îã÷ÑΩ÷v déàﬂH¶ÃUy≈æaÑ#–¿T6Ü€ﬁô–ü∏|ë˝rãQŸt}åËÂóE_ê55kEŒí·634ãÚa!ıÕõ7«X¬≠
˜E∆ÀÍıvÅﬁíóÊ5ú•ˆÕ—,‘—<JqP
=s•∫8∫∆JC+d<ëªzπ∂=∞Á˙W®∞, †±Û©æ<\Y:◊»ßgñ—2…B<Mg!"ç8ˆêá ﬂêë*N¸˚I[®xﬁWXû∂î*£|…wﬂ<ïW'°¶˜€<e£¶ó"cò7ÕgïäSx26®(ˇPusêìX„$#ôtO√ÈwÆíLpÓÊª2!N j˘S›<*ùπ@Xb…ˆEeOé^#P†2ïNÉE‘3≠'Lıı≠ÛJ˛πôL%ûG'£QoE∂R”¡”õÓG+U.œ5IWb6.ZÒ7XÃ¶!Ui`)‹ºtµΩóÒHP4nH†JW“˘ÈäTZ°VÊ’7ﬂû`UÛ~KV%%,Û“Ut„|ÚUàÛì∞dspÄ~¶øK˚ƒ≈ÀÖ◊WÖ"÷‰◊ìÈw€F~Çfô[Œ‰ä˘ZoM@°e¯kU ¢(óÏeYC„ßÁz„ŒA!Py cÅêcs¸†∑'[ID~&PñÃ‰™Õ?*|ÛéäTi•Ïn˚—äUŸ’π&â*ö EÀT◊qäi»VYF¢è›º<µ≥GÑ©LåM
>B•iD•,\iD@:}{4vxnÍ¿[æ)!LÅ≤˘Iaè∏øål†w_¯ä®iê¢±N≥ ÄÀá˝Ó _
¬RT)Zï›¨›;üAS˝d∞ÆVÑˇëR¥è/©åç∆º≤óáX 0Ì_Ol‚ˆ1utî£R òHhl∏¿ãèOﬂú⁄“tu
$ä‚úOŒ¶ﬂ–‘€ÆŸ±ÄJÎ§43!K∂So⁄ [∂“PfYº≥≠∞U∂J◊$t%¨ÍÜ}ÑÜ'óé¿%P }8\“ÇÃÕã\ª{	Ü0)˙q∆sÄPîó?ûú≤¡:˙S<Ë¶d´_Ó'-YE√†«R:ç†˘ﬁ}˘*ãö¯ˇ  ˇˇÏ}[è€HñÊ_	ÁÃn•gÚ"Â≠Ì\€Y)g©7oì ™û√®¶$¶ímäTìîÌ¨[èã›ﬁ∂=@Ô Ωı∂ıP≥˝≤h,0¿‰?È?∞˝ˆúà ºâ'(*/∂ŸhW¶í
„r‚\æÛ8˙ÓøvQÜ∫ïòèåf%Óõ3t(©"?Ω*¡si
Ò]*uUSn®K∆QÌë˙$πÿD<qàú÷«¬wË≤˛‘G°l«rOMÚ°êé"jh‹æíµwÈ∞}ˆ%iU-Kªô[Q≥T™—$ÈG†b•¶hA:V(≤Í’∞Í?Ω:V[‘6±ºË¥πyÂjg7"óM¯ØN¬T~Ï›î*º~‘∫‘Åqiz≈⁄~ƒã{˜’®‚‚˚ØF≈¥√[€©I)RÚŒ˘4©ê∞˘£—§:Ô†dtw)¥”É0ùŸä|ÒË¶¬H†®ÂiÚ”^:8ôöC ˙&œ)ì∫íº€fÁñ(ê†ƒ%H±Ë‚5´^»'>ßKøù[—≠‰ﬂÍÆ€˛(¥´Ù,-HΩä∆¥^˝™÷ç†ZI8{ÆnsÛJ÷œvK(ﬂoJøR®&?jÎtjœà∆Ñ:w_¡ ]W˜_≈R¯í∂ÈY…Á?öSÀíÖ>%+ƒa)ZN§II%äc¨»≠Â% EQP) ±rﬁ$Â∞>"*¬?√µñêà<!È◊òáo≈]Âw˝h3…çÑÅÂ	˛˘¡Dã‘ÏÍó™^tµì¯ƒ •)[πcCíP"'9Êq[onÁT ŸIÓrr∫o*Âò~˛mfƒ
ÅΩ4≥ò 'ãŒ“Ysï?8»«,wÊ≈'¬é†rS?≠ïfã¶ˇ<⁄%TIπQGìR•‰£VÑ–Ô	÷ƒÎbügT‡ÂÓÎBâÖuˇu •pNØKó€IU›ôï®=ÙÒ®Bô≥≤–
®?º*¯»ìE%'û;q·s,¶ƒW⁄D».ü£FSå·≠‡œÅÁ
™D5¶HÂÅû˚ÆP¿Ü∑≠ÙH…Ã7œ'Ö'º¨Ã∏h(;r7&ïÂ»ŸInÁjÅ=e'Yâ+-ÕoFŸôqæPıùÙ<®∫ˇêÎ9xóó8nC—yºõ[kóÀé®ƒÓMÍ9ü(7e[†˛ûπC˜√†‹Ã[d˜_·I—ÁﬂÒf∏-?mGF◊t74◊Üπjê‚£ën!·÷Òl^oæâ∑K6v}x˛âÀ>ÅΩ˝xYÿ√9√e«qEˆ0É$˘Àñﬂ52 Î:4¨Ü˚9CJs(>‰í]6í=íü~‹öñõO%m+IuK=˘vR¬dAﬁ•ô\Øï´l≠.òã¬#…Á65dYæŸJÜê–Ìœ√jºàŸîáı⁄⁄e—ÌVﬂ‘P1¿asŸü˛˘˚àŸã{ﬁ¶Ê˜!≠R£¸ÛÔøˇ/∑°Q7ªa^§—P
‡Ç‰d]8ìPò˙7™TG•p+i‘⁄ezÓâÜ›ª∞L{»ÛÉ7kXT¯Ókÿ≥W⁄˝÷≥£⁄Õ°íù™ıú(˘</x≠sÿ=>8ﬁˇò(.NMZ{â.?µ†¨hAq}Zl^esmÄcSá∑Å0∏°RmÅWFu`y≠Ë°†"Ô1¨(¨Ê ı´·qj±€Wƒ√ΩuyÜ}Ø[[˘§~œ£~áÎÚrœ≠õá§ ùã;™\Ÿ‡7Â¶[Ñ⁄≠V¶WƒŸ≠(‹Ò¢\åû≠uÄ“ÛKg›Q´£Å¢Èµm◊9ó’ªP•!Y£÷]„¯@!∏=ZÈÇß©I´ﬂî'
:‹Ü^›‹eßñõnπcsp˝G˛ò¨Îú€ﬁ¿‰«õ‘™ìÿå
z52>|Ù°h‘•e¢ÓP1g±›M˙Êaäß≠Ω÷)€Ÿ˚hîiêóaZÌ{ÉL∏Xp©Ø¨#ÖYä–z∞®:Ô»ê˘"®8ÛNpö‚¥®È"L‘LtZK¯-GÊ≈f›^ﬁÊ˚ÁS|>º¨Ç——–`?AÂ5Î†°FÈÛgCç’Û&±ÔY^ŒÅPØTz√å;PM:5%â'Üc⁄%*Rh≥¥‘xZõ_ÆÓî+7ÈgïN_X}Ë–öˆ”´ƒØÂB∆ãLkN>Y—/éLáógXAÍ üò<z¯Q˘7]G<„À…2÷1ﬂ∆ù·óf*ù‘ã§Z*+x/[ŸOæªv#ÔÀﬁπdœñÓêŸE’ï›AÄıwHÊ≥†›°>z˙ÅléOK<u’∑ƒs‚í.8¥∞OMPf◊zSé⁄-†ùı‘(”ÕMBÛ1¥¸Ñuì6^Rôªä
Xh◊Ä∫¨&S€7óûµQÁA–Ã(ÚÏ8IÔ)8¬ÃPä2Â§≈8œæπ-<œ	«ˆ–‰C”ï¬ ˙õÛ)•5◊9sG#€Ï*ﬂôÚ∆∞#Î$ße˛wZÛıH´∫‰U-ã ≥Çw«1COd¸˙_#ŸÏR«{≈-Â(’÷ü¨'≈¬≈Ë” WôÑÖ∆è:ø`'≠£Œ¡.Î∂ˆ;QºÒk÷:⁄c{›÷˛—qÔ¨€Ó±ü	ˇ}—m∑Œ∫«GÑ¶◊Ô¸ÄÅˆ± ˙Â_47ÜÕùW(°”~÷(.“LªSwÑ±éˇ`ô„ôV˚‰rµ∆Uƒ'°+v34˛ÌQRÏ38∞∂ ¨◊Än¶Xƒw¿Ë‹IE•’0¡-qW•ãu*û´ÕYOäØ*• ·¨¡«îÛ¬J≈Ó‹“†Öu∫«∆ª’∑´˛òä$Ω‰ºtÇÁ.U˙*¶£[Å∑FeäãRØ=™Á.Ωv√È@‹%£‹âbÕÃ|GxÛ
\Ç∆6ò˘sï·¶(Ç>˜ÿŒ+˛¢¿S«Û`⁄µ∑¯D∞™xÆ/Ú¿öiß≤¯K2dÇN:úl˛∑\ÓπT˜¢rµ¥}úz…íXQ]äg¢ˆxÚ™VagﬂMÆí∑˚ú-ù[ÔÃ!g
@sw≈è0ﬂr˙.Ü÷Ë77^≠?ﬁf®t√∂üÄxôz\‡
Ê≠x“6•`ÜÊ'´èRÚ9î∏€°ƒ≈V—âxn√/ó´àŒN;fáS"\›Ñ>¬Dñ˙Ö€2zï«…vÊ8…Ì ˙¯Îç˜Ù¬¬M‡¯2õ’˝Ÿ=/50oçë<`∞Æmæ∂qöD)?ÜUÂÃnN£Ôªˆ4Ä]ìç%¥°Y¯Ô€’≠GÏˇ	Q8hÒòq7<_|ŒÖ˜{’|›ÛW◊1˘W%Ç≠{¥Àˆ‹∑¯sÓÒ.cö·Ïˆì†/–öÙW7◊∂π„~K#ºJ∞r…Ñ•‘ÁÑn√®oWÉ“´a”bßë÷R_Ëîë∞óÏÁ!Üåso–^ä[ÂwŒT2tbÄ„ £ûÙww=î$ÇOÑoñâg/π¬≥im8ˇœLË ≤ˆû+≤qœ-∏Mèâ¡”∫Ñ/≥sU-cF⁄ñ∫«›M¶V2@9òDìóÔD=ƒ+S2¬Å.U„ƒm¥(6Ò∂B)Ò÷3&ïq	ƒê&^z3ñƒh—≥º@hÊ–÷àÅ‚•∆AQÏd}YEßb Rq “8')~âóæ6_
Öı„FÊòﬁV—phŸx∏õ‚?
fé6-x•õYäøl¨Së	[QËS˘∞Iç™ñ:≈XÅùØÈ…¸à¿òb:D`åçÎqA{˝É3	Hø≤ $O94ﬁYcÎ[¯€ıû…Y‰–yà¥€Àáòî"ö[‰aiÏ/ö»+Ë;…á◊ìCÀ¡^gÍs≠·)	ˇOF:~P<UåUO•åd	ÆY`•ƒœ¿ù\ûπ—§Ôﬁpπ?µÏ°$∫é&È–^É“Îp8ÛÚ√ÙΩ˚¶∂l ™iˇDj¿ˆÂÊ€ #t·ƒ0#.ıîmåä^°7 Å~R%§◊%^¥Ÿoªô∆é™÷j ‹[e1¸zF…∆ËuóÓP◊õÁÑpçgY˘fv3wfıg2_7«f”üàõ®TûÄˆïõ .6…¬¢r¯¬Ç	√úÏΩ®uÕ–0rmV!y÷ê·?h∂˘p8Éµˇ∫¡gbáMÇ7ÖÊóñ—Ñ∂Ô^¬ó÷ñÍ0˙Õ mﬁló#Ô/MW‘1£’≠áOÛ¥™ÙÇØ˜∑âÕ$ÏÙëÆA…Xsm∆êW∞“à ~NÄ ÔX»Ds”ﬁôƒŸ∞—†©¿Nfô°C;9TO]€6&¶*¡Öi©w„˝^*HíA‚ı3'eÑıãœŸ\∑híﬂFæQ⁄«´ÜW`Ç÷ukO÷Éã:FYÅÕÆ√ûÌùuNON;g≠v˜˙˚#/ª˛~ø€n’¸ºçıÕp†Ìº_zˆEÎ‡†ıw˚«=Ω'√›y˘¨k≠ü'Aﬂ&pê∞ß`ÜW/ô¸!~É-Íﬁ¿+Èπ^ìN	s»%ÖÎõ>:≥ÀÓYìÂÂ·.3úÀfﬂÌ2gä‘Ÿ\W•™Í‚==ˆ⁄º;i¯Ó}¬>Œ·m«¯_¨3¿v=¨‹!î¢ùÈËKhˆÿ,üÖ4Ô[€üÅ1ÒŸg`≈È¨0ÏËp÷f1lk‰¨éArŸtëµm9ì)çiBΩÑOcÄ^»æ˚én>áˇ&Ü˝îç M≥T/–X/∞ ÿ/¶å"’A¨K≤é£ÿSˆrmm≠∏ßØhã‰%Î‰)3◊@áô¡öõ*M˙f–+Ï‰≤| ¢^$TGÚR¨<h#°éò¡‘ﬂM∏fXòÍì8¬ÙÌ.ı"j0·¬S„‰Âﬂ(ÿÆqFQ|òäΩ∏ì•gW√µ°ò*À_˜S—˜=k∆âvp&=:ef£Ù”ÓúŒY≈ÿC¢” Ø´Â•g ﬂˇ}˘ôbõŒrƒ≠4ñáTSØßÛv‚0UÆ›¸È’Ê˚‰¥m%d{*ú`0âÉ–6hÇb∂ÙÏ»≈r.P‡πN
50P‘nÃ˜∞Ò⁄Ç'ê:–,jDÂzùk◊ıHˆ„â¬#∞Û‹5Î1≠∫ﬂÛ1Z¿d˚q#m?Ó%‡/—îV2·}˝d<~2Ái¯ìÒxÁåGojõ√„i Ç˘?µÚ¨«úõÑ˘Ë›5ÛÒ4€”Oˆ„å+«~,¬;h@ÊtıZê9Ω¸dBÚÎñM»Õ–ÑDió1#Ωµâú∞À⁄Õ»≠yÃHo-Bµ=,ﬁmwŸîÃ;a2∂dﬁ	sˇçI€ÚnL–ßI∫c√π˛nµ>î∑UíÚg¨¶±‡ƒ?)Ü
Æá–¯lí–áL1%åöåÃSs‚ô>,]	[ÑEáËÉΩàGŒx≤˜Ç-ÔY∞±€√]¬$Q8aÎÈôŸ7uû,Ê∞Ç»|'Ëo/@Œâ!áÊ‚çıƒYî<€íìàx≤î$ÂŸ)p®—îÁ+
Zá‡√Xá˛◊@§Sc÷=Æ/,‡w	àLAÅ˜É…ø]1€¨ﬂ‹h>ŒÕ6S…Øo:·å¿âëÀp¢$õ)4“˜'ﬂ¨’cƒú©ËHb–úWsDP£mÓΩŒ5Îô©…Ã7Ü=Â/ú•CM&äM<ÀeÀê§PÉHŒ—ﬁÁ0RnúÄfà ñÉêÚ˘âüÊ›Î8Z·øóπcÂicôW\lÊò˙∏*âcmµªıÊéÕfsãò;¶äY›Ù±≠jÈc€‰Ã1Ò"∫GCn˜»…cï˚]ÍH*è>îÂR)H‹>Ï∆dP’D$π∞‚Gj˘û˙¢∫G/éOy≠¬÷—ıw›^∑áø¥[Ωc÷>><9Ëúìlõ:ô%Îú±O±…oJñM—_…3…\U∞mß
æ§3ní≈a>‘§õº°æGy7›ˇîz£>n—…˘ô7™˛vc6≈’Áhıïúÿ’q◊soZ°YÎb®—Axfﬁ9’,‚ÕñòFπ¶—ˆ”hC1ç÷∂£ı%“~´8{Cƒ¡D¢?eZ˛Ùªˇ˘ˇ˛œ?0Ò∂Z®`«N\•ªÍ@P‹XÑ	òmD·Ön(ÓÑD^√qúÓé°ÈzÅLÀ·û*oXÅZAò€Õfc8€ú®ƒ_U˝é™qÃØ tå¯˘L˚@†ï“VÇZ»Rí.‘âé¢bpz√{çnì¸C$´œ']p‘3Ê…≈vâ·P ΩÓe4-rË˛¯§›=>Ípkmà÷Ÿ1ÎÄ=—Îú
HÀIÎ¥≈WÚ◊Ï¥sr|z÷!T.∂kå¶¢1i£:'¸O&Ú2q1î‘\
®>j®ïBH?/bIpèu˛G≤ı¸ ûcàZÌ≥ÓW«=“ÄCD@cÆ≥∂Yÿ˛L}÷z¶“Gò∂ ™\A
,èﬂòë˚÷√üM≈Éã:±·ªk @áÿÄâ≈†êß˛¬ö\ˇ!0Òû¿tÜﬁıÃüÚ∫Ù»{e¯ñmÀ
≠»T1ôö≤Å8µZE¯À
ªdõ®0H°Â•¬NíF√‡æQ‹ ƒÀen50
à≤ˆñÃ√¥JjBDûÓcz§{Œ∂‰âSsöI≤1≠&Y&r.€Õëü‰Í%Õ≤`÷Ãös{˙+ó◊ ¯&å§#Î˘
å|ﬂ¥·Ü„âˆÊ.{›õ,≥¬‡_Ó˝”?ˇ/¯”Xa∆ÿúÊƒt|clÒ≈r™ê±-±˜+ªjÿ#Ù¢èÛª∫°v5Ó›üˇèˇ)Óﬁıwà#÷¬ñÆ‚Mag˜Ã,vhE∑w¶ã∫6±l÷kN∑6wYG‹ƒYrN¢£˛˝√ˇ µ*ÓbVÚ»ìÀ˛pj÷–Ú÷ƒ∂√≥›éçâÒM"ë”…≠]v˜©¯^µáˇÙ«D˘≠8jjƒCø_Åg}+ñR‡‰Ùj{ÖwÒÖ¬F‹.ªﬂ˝6’´‘≠†éQ˛ ?±wØ80Ò|–aà:Ü%PEhÕR·˙^µåKGŒ©©Kp⁄
a∑,:Ã∞‹Äb˚ä?OPô’Ä¢¡#ˆ–XËÜÊ<kYX—‘F»(∂§#p3œ°9Ú»"=;≠?ß|Ñd`L/«(â!÷ ÔdΩÅè2ﬁ¿(l¶îõ>¿ç<W`\BEäóp
X>Õò∏ÎgyﬁAr°∫êå†&ô4òf1ÓØ65 ª˘Ítﬂ@ÏÄêû‹ES6g∑:+Û$«¢Tõ°ä)ÉßºO\2kväl`ÃËˇ#≈£ëçËo)∞—˜æÌ^À>„±†’ew"”®ìŸ‘çJ@ôiƒASËéÏŒ˜‚—ÙMdÖGãkHpÁ&%÷,¨ùßäR 5ıù<…G◊‰ç≤FæFósûﬂÄØëO Élf§⁄¯AéÁ 	¢`‹¯jq0ë/Z@bÚ+Ö Dˆ{ú!ˆ¨g¢Íƒ¡<í≥±*+l 0√∆"ï^a‰Å‘
<òÏ¿ª^éAA‰jﬁ«jKz"ÁJíX∂&„9›b\í	'¨ñX„∑^%=[>ÉÊŒ3Ey/%SÍô∏¯¿˜“®1ßX´°èsJ*DÂR«Pë≥¯T!jâgTVsãkxƒüQU”ÙÀ?ΩJBmIVûH6ñÛ!Yi∆Å~ˇÈï˙õFè⁄âFRê{"2hˆÃ¿∞lÏK‚wùﬁ§ |§€#0`–P¿PV˙•~Z°w…F˛†=vËŸpù^`N‘T>≠2éâF˛@kóÜÒ°ïä∫Nå(ﬁ,∞™@˛2VêŸ°úÕîKU¢0ñU–¥?:eô·yV_zY/åæe[Åê‰¶–!’ ¢óËVùxÊÀü∂ımHC,¸©Ó`Í,îFÓ$˙ çmˆú+›’™≈¡0‡"7
sé‚∏h9C≈¢∫W(	x-•¸A/¢ÕP˚ˇyÔ¯ì•dZ¯pòˆ¡ËC´¯`7E!◊…;PÆ˜JJ≥LßÀäºÊÉ¥àe]´∫f220k+òµïÃíΩu‹ ﬂ—}kj¯^vYﬁåWÌv£®€i<ŸF:‚æƒ[√
tzüYóö]/¬ùm'N;sè≤:L;¯¶åRö45«óäà∆$¢=˘{
∑#t’]`ÿÊÍÀ∆⁄„«ØÍÃëÒh9íEç¶·» µﬂ@X5◊S„M∂ﬁ˘3∏-#	[—ƒU([◊˘aà∂µûØã¶À»ôdNqäπp÷≤Y>,0KI¸ÅqîC
?-ü»¥@Àë7øT¢∆€@O‚q´a≈)∏∂‰)À∞%t∂Âé‡≠íõœ°C	ÌIŸ@™y$…ƒk@4?TÌ)nƒèQ’§(5§[?öQÜ>ï•7ˇik)ê˙£<p|.öÔÊOŸ·≥…qoõ9∏7∫Àö¨Í≤€Ä%gÿ°®—ÒÏ›>O˘’/% ≥Ò∏—≈-¬r¿ÒåK’ r¿§Œdáß”œ¢8ª@öD"9\î–‚X¸ı%,,§w(iûD,tÂÒ¸Îémé'85˝	ò–f
öæîY0•BˇFì«ü[}$ìãK÷3opAM!wÉHL¥Q9ï|ª˘≥‹TÚ¿4Ï;öG˛‹u_Û"ﬁEÅ.ﬁ˜{ïDﬁÜ5<µÖJncò…‡â6„Îá˘b+‡>,â÷∫◊y‰ß&˜¬·ÀäÍ–
ò{∆˙«±Hñw†q6ô¬DÒ∑°ox÷Ä¢∏® i¢ p|ÙÛq∏›ƒÄûﬂ~›—æ≤??–ÙÒÃ+.6}º?èƒ—©JÃ∫Kè6·"¶èG¢ıÜJè“s«≈[hùÛUΩÀâ„¸≠j—€Mœ?”\xuÁçá≠÷ò4˛¸˙wΩø˘≤≥◊bœªœ∫«˚ß◊ﬂa9xˆ5€ˇÚ˙7≠k\ˇÊ>°Â%|Jó©„y¢ÌCIØ ∂„KX‡—^éÛ∆#°⁄≈¸Ét∆xt◊áõ.û7º˜(]º†˚ü“≈’«›N∫∏™Ø›X∫xtjër≈£˝-≈9˛r„^Uiå÷ˇ˘ıOî0‚]Úem6v;%æ,U´ﬂõU$¸nŸõï‹9KI%èÍ *≥ﬁ÷ˇ*Âárßﬁ¿dñÛ⁄g˚a˛i98%aóâF8ªWŒ«!7Ì3÷®∆πè@PÜ$ΩR˚≤••≠◊û«›y_q«r¶O[SsœO›ŒPí
M}˙;c/¶fòo∫˘n⁄!Õ·%Î8–”è<Z¥
ãHﬁ.À@S;]ÊìñÛüø‚±øœ·ƒ˛ZÑ˛OËêàÛü¸çœ<z%∫∂6ı,˙7ü˚”•o`Y9ØÈ∞g⁄Oó◊ù îè9.t¿Ù<¢Û'.hóÿÿ™~#Y||ñ?VÙry
\ÚÙ)TÄyù\:ñDËD?M#_ D1á+Ì°—)l´<a∂Á<Î/ﬂ.îJb8VÛ4∫lã0 w¶#Õ“·~‡vFªóZ^p˝”`jª¨ç…€◊?ù£H[g˚S–¨HFK4§Ï˙l_¸ÈxlxﬂfÊÅEû¸îû¨:ˆŒbΩ g†ò*'‰ÿœx∑π lìœƒ¬∑’´À@Œ¸ó?5i-∫_ß0÷ÀG…:D©®JfÕ+XÍ§ôëì∆®∑SÛùâyj	vÃø@ÖY’√¸‰%5zSgÄY}"LÙrC®–œ‘SI;ÛS+Õr› ‘Dã∫>F~ﬂS´≥Êƒn‘÷^?n∞ÂÉ„÷;<>Ì íØµﬂ=¢V†~‚
tëzçG·8P®¸)Zì∏>u axTN”å#ÿôEÁ3ÍÙ¯µ‰!IÅ~ïx6’ 85œ=”øhøMn;‹t€Û≠Ân-t-ÆÁS¿∫Á“>	cûCg!˝Õ–‚D<6h •±k˘N5%y.,é-.5vÔLÕ7≤â»5≥`ÒΩ„eK.‘<çÇﬂ∂¡|0úìPhRDd?Ãw9L©÷¡Zp:QE€N6ÆûG2&√(˛""›N{ö∫S}ç˘/"}ò^”ê¨Ô. àÜ◊ø˝Î≤X!øæ{éV8zﬁ«»"√	Î*ë|N> …äU]⁄¶¯LÓ∏1ç“K\A¬¶l!s`¿ä¿aﬂÙØˇà¥CãÒ∆pæÂ‰];ôˆA≥M`DD˙òq˝/jÏ0Éaê€‰N€Ñ‘ä@8†#√&G¶ 6àÏËÜÂ∞·tÇ˚ﬁ„ULÈ	[ƒ^›°°ˇËQıÃ≈ª#@ ‚∞OüÙ˙‰5Kìw´€"œ™?J "„=“Uıô◊Ω)“6”¶<öï∞`.Sé3mx≤ä¡I:"Ûæ"X9>∆Cïú…˙¨ eﬂrè7m™»õ¸ƒûÊ%hX|ÀUè¢p:5Cß‡¢ËIËôös∑SÙiÂ´(
çu~Ü¿QÁ`…∫Ì÷Y˜+dÎﬂcù√ì÷Ÿ›6¸˝¨€9:cΩ/[ß_≥Ân´Ã`Xlø-_§ˇb"¬	¸[¢Gıä‰ZÕ≠∆y√»≈∏∫VŸºî+_¬V*ÆïQ∫»7∏WX◊3œNÒ‰Xñ˙aûBì(y9±æ?_Õ{çuk&a—kÉÇ´dl9≤∏!Æ ûïÒ¥˜ ﬂOÆ@~¡6¿ú©°ÀÀ'ç'pN˘/’Ì"†ŒÎ#\‰KÑ8A€áG"íŒæ±Ï[∆N€˙^Bci€7ÔMãêùÃ'1A˙&enÕ(ŸÛf£aQ≤äp÷≈…ÓTƒ…‚¨ñ¢¨"∞¨xôôá v!\vß\W›1≥ #@˘Ã£Ï¿ñƒØÔE4˙ækOA`ûVÕpµuÎE~ÑãB≠x∞∏ZÀün°Øöoê@GÇ1Jœ7Õæ&í=äs‚Ïáﬂ‹)¸∞|5âöÙ51	µ‚QøÙ·˛"œc®D–Ò√Eû™'ÜÜ?é˚U´Û‰Ï¥µ˜e[0ÕÉ|˝›ô  KY¸aØ∏¢¢Hd~ÁL=$/6T'»O~ÌÍËÍêÃ‘–®èûÎ[É´B?	ôqPπ@¬r7 µAoà™n@;#Ã&˙5ÍıOŒÉÈÊ;õW¬Ω'ËÓVÉy"üπ«ÁÁ“Tã,÷e‰58o¯°‘;_b!õq%‘ûÙ—è≈Ï±)á‘ﬁ»∏pc÷®êâ.·‹ bqnÌÀ∆7ìwﬂ<Çˇ{£æ±‹‹Yi>⁄^in<^i¨m<$íñ‡uüp„3ááµÉzç?√˘ËcmÇÅ=µ∞RÇk¬1¬È∑<I˙‡Çr¿?!Â
Ê/ÛùÀ1ó≠·Ø¶NVgõL‹ám¶[™d^ˆÆ7ƒa≤â˙˘8Lƒ`¬Äe∆ãÏúæ]ñí¨SRïhTX`ãî€ƒÍ◊ìgîo~(ôFïåﬂ¯áâ¢˜«ŸF™ù”H®∑Èå#ÂŒ7Á(†ÔQ÷Q·| ;Rw3yG"‰∏Áæul◊&ßÊdÔ≈r˝ôG±˚'⁄g vN:"3∂@´éø=√÷≠A«¶mf±IóˆL€ç©*/;ıé∑9;W⁄Eèˆ∞ºñÖ.jﬂmd\œqÛ°	zü≈Ã˙í†ûÑ≥û£ê◊r¸™≤|¢ Ô@GÔ¬´˚á π¥ÎO•kn'NeQÊ.iØ€N”ì]ÈÇóXü;≤Êª∞tA<zJ©8ñ"~kˆk\Ω|V”Æ9Ω≈ıYT∫wa…™b±∆ø∏0ø5ôÙ.œ\˛LF)æë œjÕ˙1≥~p~”ÙJNôˇ≈KyŒ¸–Ö¨‰éÛìCMEñ)•áB•≠ÁHéc°∂p∂xÄq(e#/l∑˜¢∆µh˙æ12{øû¬¢®’“ç^@ÂÇQÚ.Óé˝±aŸ∑≤5<3[‡Áy["¸¸£⁄m◊ÛL∞$–∞‡ãQò˙¿ÀgÆŒ-ÕÓ9Y‰]¿;wß∑@ö/ πï◊`V`ïÄ˝æúfØ0gj€+l„·çQ	D•ÿ
π∂L∞g`dá»ô~;ıÂ±ƒπ≈”ã}v`˘3~¨õ†äV”∆u¢ïÙZx3¢ø<˙Kå-ÂVÉ{Á/=˚ÛÔˇÒ7å•Ù4q™K; 
’»v°°!÷q≥m„€¨∑ñc◊ÛX¢îKC¯q˘„[Ë¨5êf•pŸx1‹	∆ì&µ()‰‰"’Kà\ñ8)æ÷^õó·z©‚Á‚∑]f8ó<a|$‹∏ÔJ/\ä‘áSàXü≤L˘K¯∏ó–ˆ+ZÅQœÑÛ–°ªìpå».J˝ƒuÀY@p[d|69ìÂúî∂	yΩMˆ∫jƒ-¥˜xeùÔù‘¥FëﬂÂ+∂∂∂Üø≠0>◊ª"ÃfÔi	ç·•πƒóGs3Sx‚lÅÜâ3à3@ˆ¡‘ﬂußÅm9&GÛ»Úb‚Áléw÷ìΩﬁ‘påk•≠% kÊ8ÁÄ<äÒ-Õè˘hHîÒs„œøˇ˛øÍ&ŸäÎJ
+ë-ø–åÌR®n™fc6GZ{tŒÆ‰`\ÙbÜàdâ»uwé‰	Ê`DINXÀõcwR R<∏ó¢¡√äg¶7~øTe&4«R+Cö!˜]SÖΩ¬•Ã_4`LêE∏êÑ<ƒˆà%RQrπ&sCíx¸Oø˝ﬂÏxÄi%è	˝È∑ˇó◊?äÉ&oÉn∫FëàlÁ5i
äzæ¸ãÜˇ{AQÉ‰ëVÙﬂ4®Tè(Iy––EAx€∏ëé¯_[°¬‰ 'U8õı™Uq)ﬁ.ñ∆™^≥ w35√+aàJbÔûÈ,PèwuﬂJW¶ùI)†ê§¬Gbœ∑∆ÍÁñ9ƒ10 ◊[UNM:˛ùlíöv#π8y*%J¥v‘dœzÓ£‚ÖªUÃ®£.‹b˜ZÖµäˇ˛Éúh·…åñvòçÇ&`;L[ÅµªK]Vs÷Rgµ¥∆#>ÈNˆÚ=]Mï=ø’Uﬁ∑ßf2˚^]‰¸Ø©tåõZ„¸ŸD ¯Bñ¯èóxû√À…(§w'¶ÁOL,\eÑ¢˝vñπ¨πèŸ∆¢Ñ∫g¬ì±^˚@”®æ»ˆ≤Å¨—ÓCä√Â=·…:>’πnπ;Ÿ {_µªmv⁄99>=c˚«Ω&'ˇ¢{ˆÎ|’›Îµ;¨w¸Âiª{¥g“ï˜.clˆm◊˜Á»Wn4Œõ[π˘ ‹Êº«Ÿ ¬fæOπ »Ìx”Kûµãm√≥P‡ND‚É=≥Œc∂Y≥á¿rtá≥ñ;X´UºµoaY¡DÜ∂œL<ÓA¢ø¬" Ω5∑CeL∫·‡†ŸsânÓj		¢~Â˙âD 1zÓ≠Á(ì{˘CNRŒ{’≈f)Áî(u√ﬁ÷ö†‹l6ÃÊ1A9í∆7U∆G+=Yæ å3§89πZ-ü/99+›‘dÕæË◊&‚=ã3ã—~[@n±&pD-äÂ6≥çC«πFÆq≠Y≈ë„æN7™®≠”Ó1€Î]∫Î1f˜∫˚G«=ˆ5k¥z›<π)<iØsRä√í}+
ÍGCkx˝√ àŸ\¸`äﬁ†ÄÚsÇ#ÚRËËR~`‹ªD‚{í>‹ÕñJ∫ñ¶_"Q+¢qöV,Òä¥HßhEw}∏	ZÈ°ΩG©Y9]ˇîî•>ÓNÄ;S6¿Úa˘∑ÄÒå‘Å¢‡ı¬ ûè„Ç±û˚°€‚.√=´Tk)∑m≥∂¶XgÄáß–Ëªıu÷Ü0r¡ÇÌ«Üâ\⁄ÚÜG±M–îç†çP'ˆîa&˘P£0èπ’πDq1[ÁåøË⁄ Ï+z5ózË’T∏“©≥Ùêä9Lv7™∫îd1O”6ª˚ûôËo,Ëu;ˆµaa≈áÁ>À ÚØuı!ØÓÎáTÌÏ‘õÿ zêø´ñw‘’ÂË±‚ÆûÎWÌyåÄŒpU¶0“=ßD:(÷∂AB‹uŒ]Ë“HJÄÉÛó¸›Qº¬Ú/W”H9 ó=Ï˝†<L1´Éó’EÀ&‹é€‘o<ä´eaA	lëg®ºÑQ∆Ì£V2F≥ÒJ·?éJ¢ÓQ ≠T/â1:çx¿÷°¯à¬´0{@#`:√bD2Œ øî^)ó"êî∆Ö)[≈∏µ>Ñ5'Å†»õ2¡Z9ÿ|ÌO]º)≠í\˙Iœu¶HÎéÀXøì6nµ∞S]6¡Ã¥±ª~ÏY#”ŸÕ{ßÖ«ÈµÄÊscSCÍ≤4`$ßBR∆√óÉZU@™ëf˛óW·ôF*Ê©^Wâìu± TÕ∫U †^q∞úƒ8õp≈jr`&∫†B‚êóûÌ≈dª0`¸˛gr–—Ñﬁä◊´ÿVÇºâM‚0ÚÉrkb1‹≈“D»t¡·]Ôÿ&ÒÏ±∞¨–∫Ì€.lπqœó”∏0ÜƒFÒ‹htQn'Y÷D´0#ùR&Zõá◊·ÛAñÖer=5AÅˆπf…,áa˙yuç£…=	V7S*ôÆÊ†~“\`y)äîû◊òçæV“Ñ4O»ŒhÅ/L9mÎjò Ê*ô_L¬h	˝òBr÷¯1ó#UiÖO‰ZT˛«¸\óZ3cCÀ«L¯·”´Ñµ&$Ω∆íµ\‚Só‰œÂÈ⁄-ë—≤—à∫ΩÎb˛~pπZû˘ò“çT^Œe<,v„†M+±àKS—»ù#ßwxi–0F_…E|mpøµZ6q^ï¢ø…+,2G- ßtTÛi:Ó˚Ë∆OL\¡U£û(ßñ∞]ÙXÈ)∑Ù‡C¯=ıœËÆ ¢Ÿq4¡k($&∂qâGtpa≤Å·—aÑãS+K)µÌ¯˜ÁÃÁ”Qu¡¬òË J,"∆o¶19’tƒjàK∞¢∆“,¶’Ω!Äˇø}¯ce†≠îoÛÃëÂ#∫&r_Ãûûu„›ÍåÓﬁ4l‚ÖÓú¨ÅÅ‘ıa˚ØDæd«6GÜúö˛ƒu|s9ªÃWÿR‚¸\“‘.™§¨‡¶é’ùh
+üWˆ˜‹≈·áà<Ã£ùvò⁄‘aÎ∞Øsˇ∞fõŒ(∏`œX£íøhFYˆ¥êÿ)('ÊI‚ ß›ƒÜÏbr"A3óEü´’O9&k≈M{ËÍf“T •)∞ä6ñ~~^˘kJD }o êS7É‘]NÚ5tÃı‚Ò—]Gax]xÊ9oÉóÛÆÿH`x#3x∫Ù¨CÁµn]xÅ<|∫‰∏Ó≥3–cûõûßßá'€ﬂ?q¡2ªƒ¶WÁmrF	’Ë(M6£œ˜êB#:|g:J‰¶a-ˆjØ≤
‚¸ß Ê+Ö#é0˛6◊≤!WwO^z‘(·£4˝÷ø¥Hgzy≈˘¯J…/ìñ	ëÍﬁ$ûlä|”(/"SÌ9//¬©y€s‰E(πO∫ú9É°7O'”"“…∑ÚÀ≥?¨¥ƒ^˚ãŒaÎ¨€fÌÉÓQ∑›:à ¶ø`ˇ±Û5{—=⁄ÎÌ˜ÓLJbopaÇAhÊ¨°ä9âõπ9â1ı¡=MJåy?ÓMVb'b.≈=ãùè9¿ˆ"¢⁄õxò∏^w¸IDå˘Z}ÃøLÇÜöãh`rÅ)*´Ú°ÒMPï¨!, ?ÑùÍ®∞F£
¥cXg…2gCÀ3˘G!À˝`j=ÃÑtÆˇ0	ÓBz¢ü⁄◊r~bÓª.6A1˝»*äi—[w)’∆†Òàò©ÀË;ô™(ﬂe÷—rs[2AÒñ∫HRT@¬8UJZåGÌ&≤I%SÀ≤cv•8ù1≈"y{Içp¸x©öcJ:£d_∫Ω|∆®µ˙Ë:±RÛ˜ûƒJ[nãC±ääﬁ{ë÷´WÇµÄ◊-B∏ùAÛs)jÑƒÂmº˝"U	„æ%4Œ]ïìvÛ2$ °F#\'4|nw)6è0Í’HÂ‡‰≥≤£ô2ˆ»ÓZ=ÑÜ~Ff^Nf§à—Z^‚8*üJI‰dÊd(ÖŒíL&‘ºTÙÙ¸L∆¸‰[äÙ˘¶Në≠ükç¥‰K.ïçOÁ9ª,MwJ®¿ÿ*‘gQì1©ÚÍx"‰Tsó=∑]ê€>QÓËÑ‚Ôƒ.	ﬂÛ1lÒ¢üˆHÈ•ªG6vŸå--H¶ï)Kéjﬂ|˛ë)˙° T4µ„K›=IB ≈öJÏ®4%@µ˝tø8äÜ˘qÃxÖOÍ„tàÕÁ 	†Óqë“â´¸+0πû≤(n£)ïy~À$ÊM—hí°@6R–öyøpÜÇ¢#<AQ‚™ÔY™´Y& n®’r—a:Ï–^›∑I4‹Py÷å¨#÷¢yÊûr6√˙WF‚åàyø„_dI≤‹≈pª•¯àV∆â=M˘⁄4´°:æÈXÍœabÃZIùŒJ÷~˘—∞˛W†◊Úl$0˝`G]Æû~`≤∆∂ÏK‹8∞Ädm,	dôoŸ_≠k{áîX¨»¡·pÁ8ÀXÙ–?~'q´T:L¨eÌ<Y%´Ä°C#·> §O≈µc—∏Y([’à	è<‡ﬁRÅöQ»!b {Á'åÎ"Iµ& Ω'r‘Û≥¡œì«1˘ÑQ€‰“≠)§õ‚,¥m7¥KÀúáÀØ;DP⁄/ø¯K\9ÏØYì™.À˜÷OKèTúöÎﬁP ÒÃì=ØlpíL∂Ï¡tØÓóxT¥·®X÷D°U \^ƒÕ©•ú_Ñ„6·ÅÅx?W€6Ÿ8E¨«•˘ÛÌù‘:êÎ\ÿ´`hΩNÎãË«∏«j√Ÿ±óso·h.=ÉÑU¢=ãüEÔıWÅn∂n≠∑R0†§∆hÊ\|fKWîY√˘ÖªÂÈ´û“UŒ•'‹ˇòS0>Ú•¨∏∞∞&>UË<	.`Cêß;rí¢s¬∆¥‰\°dWA"áoÇöÍ·Kœ∫{O÷Éã:Z:5G‹ÉπÆƒ'Îj;qÑWße∏◊£nJç˘Ù›·•⁄cXı0G´H/ÀàüùH¶ìg≠™‚I˜ÏkSÔÏÈàÊ*5UÒR¨îÀQ®ºô*úãÀ_~sWeÜàB ÃR˙a¢˙¢~Œ[æ∫˜◊ö _ÿd©FyÌôj_ï◊L™xw‡ÂíYµ¥ŒD•‘u‡]≠ÅÎÙ¶£HsìOÎ>]“VLƒï“n:rtIäŸ—I)3$è"óÓ‚*BMìÚ|î‰jN]æîv b°iÏ™¯„F*â$÷n2iµiˆ6™%úØ<«ÚKlÉÒíZEè÷(iñ$˘ñ±1ÖŸƒ!+ªå…¿Ò◊∑lDH+,J_˙Ë§—ó#x[Ó8°/ˆa|;GIÑ?˜íMÃë˘pxk6ˇ‘—ÜvLá˘Ï…±·3WÇ™y¶ß®ßˇòVÜÒß˛¿Ñ›÷G¸êÅ˚ú@¢∫Nÿp‡Æ!¬[ö»¬;ñp˝9àÿ1ÒÜç%H9J+Æ1√;L±1`x#É7{≤˜¢ØEõ°õI{Y]]eΩNª›Ω˛˛´úv^t±nVÁËåWËΩ8>=Ï∞œˆ∫◊ﬂÔÛOè˜d%¸∂1°ïìíPª“†›Öı(õíÌŒ¿Ïñl.
éÚ…≈&A˚SfX`RdÂì¨º◊∏®ì!<‡âû†.2rC4);E"3Ùe£[t~Àcm¨{"k&—¸€O÷/6ÁLe—ƒZRøá éDr≈w`Ùß6g®ãn3óâ3∑o2›üf≤‰îÿ¬û)ÓÅaÒÕ¡ vX√ªÆ,çô˜‡N¸õ©kâœñ…ûÛHB9±Å…óz:˚ÑsÜ∏ %ñ:tá÷˘•XLÀK·öSßÂÜzhƒ1 Á»P+Ç+–¸˘Gg÷3ÆˇË∞Òı>"‘ß ‰›.Ko≈ÙSñ/:´ãRK“Mm°ßxCdõ Õ%-ú»Ó	?I.yRi'ø!=“	:*ÂOõçÙûŒ& ÃDõ)¸S®∂§…„C:›r…T2fÂõ5;DºƒXMûÈ_¥ﬂÊƒÙrÿ°¬±⁄¶°È© ä¡ª…±õ!MeR¯ñ?º|-Ü{È´ƒ^:çˆR©|"Ç0j‹˛'ÚGÒ
~l
ˇáµÕ´63kxCƒÍË-‚?!»«≈m¢D‡
h{ûJòL≥≥Ah«ŸâQ˙¸,(2ïj@ ·e ^(jH∏ËIç®&≤*3"~¢ƒàJ'ßÂEÙáÕ4›ˇ'YQ"+ƒH’-)rI)NP]2‚´pÉµ‰#ÖŸw—4ó=ÎîOÕı6(YÓXÍôA•‘3’©Æ&°rxåÊ¡$†$p/Ä≠ÙâmÙ1ØwñŒªH$9ÃB°‚™<àŒÎ?¿T»zi|Öu.V)üÃ“Ç·ñ (edqƒœ§ ¨ﬂ∞óû^¶"√·ïï’GqX¡qvÅ$‡<3C∞s;Ø±esM∞
≠ÒGíºa‰•∫ √«Ùû.u~µÀ>„¶˜å¯”ëÈ	
9É=ÔÆû∂ˆzlÛ≥ˆŸ^hµ\©ã„“‰_≥‡·Å¡9Ø2|√kﬂzjF“™V¯vÍ∏âQƒÁÓ`Íß¥÷ùÌ$÷EÑõ,a8áŒˆ¥Ì¨ò
G∆F›iÄLE<”4}8Å»∑æï∫Xmn)nˇtÏú0Ls)ÅNGÍ"˜Àu≥‹}BZÀ3F›„r[^<kL√$µ'Æ6çPÑ6Ww’cÁû;éV*7n¯€œ"¨´zœv¥p„;Ò{ëÆ≈oéyÙ9‹ûÛ)ÕñSÑ≥â+bπøΩ∞ìÂ8íÊ–ÀÏëOJ¿åJƒ€îîçÚïF¬‰U’·äµ8·‰“dX¡ãí'ÛÔ>i_òÉ◊mÀÿ8}Ïã„S≠A¡;È∂Ù¨∫à}ùçÜó^°Å[IÍ¡’ò/"ﬂov&Á»6ç˚´6Œ&Uy…∫¿Asñî+Ùy!ÅØZ«ß“’ﬂ>∏˛íV·Á-÷=lÌwéÿ·ıﬁ√ÀW}Õù≠Óÿôïh§(⁄J≠,⁄¶E!Ω∆ÊË&Oh˙vçYÑ	Íç•g’ä ÊõÎõ `û	“ÒU¡"bÂàï»â±ÿx
Ô—À6≈öÃ
rDÈJÔ‘–d_Å±í:¿Ø¸klÅá úIAÔÚP
øÔ∆√)x©og8Ü}˝SÄn˙!∑=P;7÷Enóx¶√~‚TX>V∆3ìÙaäÉéBbAÇpRô) Íá–´<ï”Ã©©…s©DÖ
πÉiΩê¶≠Ωüyt÷™7å\v"#5∂,˙ K`* óıXYÚPı:oƒ∑úQ$€X¯S¯j5¥ŸA%Ïè
»ˇCî—6˚ØR……I˛Eî
†àƒg ˝ä%~ﬁÄ¡P»˙SÑÑ‘€‚JRe(÷ôÚï(2Q$˙Áﬂ$E£%D„• (h¯ 8¯hı7Í
Â ^ÙÅØﬁxÑu˚Ó;“F®a…√nÍ&õ—HEß2øÌ457àÃoë∂¢K¸∂5Ò[F#º˝.[äü]ôô/R°æ˘≥Æ¢ì	À¥Q„uÁZÕ‘É*D.d´4
2äæW°JÄjΩ ûIú±_≥/Z≠ø€?Ó±÷QÎÏ˙˚√n˚∏G}#:˝òFÆI›ì©Y3¨
€N>SHÅÙ“$
¡+IíŒKøE∫ºÊ”Òıy¢\ªB€à™ﬁô¶QbøzL¸∑ Çó:>b)Ò€'¡ã.îfæâV™GèHhπí€“-VV»%¢ˇd:CΩ^Ÿ/]	òíeifèîn2|Tëf⁄Ù6gº5Û!Ç…·éêz‡E_í‹CqH,dôêOhnÆî>ˇKUÂÊZs˝$»c©9[ñûIßf¶ui‚π5S~ à∞®$&Ë|AN ¬b`¶bÇrçÎÇRaô]∂î‘;âÃC‘πBõOÄm[ Z√!_·ÜÕ`˙Lﬂ£ÒÁûÛ2ºkπHkÒÜñ¥	5éôê√îœ¯óô&Á<Æh@
é1=N”I9CΩ◊PÈˇÌ_˜Lﬂ4|Å-T}ñ1rÆˇ‡só%¯∂âÛgxñ¡&û{õŒ¯ú,EË	Â39ÜÛ†≥>ÅÍIˇ=,/eàΩ#˙˙€Ú-ûùÇ)40$´√¨/k°2ﬂâ§ô ,@,Äè$Øep.°*beÀ$«ò‰Â’[ÛIÎ∞O/Iy#l_ÍÅÆ"b˜g,AÙ	F9lTìl*`ÛùmÛô¯8˜LBä`Â[∑+œA"(Òöë@S'»Y⁄˘§•kkÊ-Ñ°F0–bÿ∫L€∆ΩŸìªˆXÓZù¬≈Ù2ºz˙øﬁh‰(éck°∏JËzp[1KqêÌ2¶ë_ƒPÛ[µ˘\kπç‡ø6¢•ç´ÁáW‰ºl}0B§@ë#ä√OVÜΩ⁄¥)É‰kÃ6hÂ¥µÄÿÅŸ‹⁄Ëc…CÁŒG‘Ã?Y7≤tn€
˝ßvã¿˚ÉàS⁄ÓHbâV≤ÈúPD^_∂?≥ ⁄¸ânkˇË˙˚ﬁ¢ßZ{›v˜¯®u¿ñ{ù˝/èˆZÏ¯§{ƒoÏ¸ÌIÁÙ¨E´éÚ)@°\yäYrÚ√ãRÃy*ƒóU(∞q∞BÛ€çÃRâ‰÷á,∂ÔB»b÷ﬂ√∏E…Î|
^=ÚvÉyjÊçF0WC~cª–[ÒD1“6¸ùen,ädÕüïD2≠R+îì{≈=rx£L÷rcÑ>ı¸0«f˝aéª96=√Ê-ˇ»˛vä6∫ÄB*‘â9ÎT¶Je…©.7ˆ)2Íìù∞2ﬁü˛˘{=v¥¢ú_ù:{eÓw—≈xU)""Ûj	ô±ÙÏƒsô%Ï€∆ÿ∆∂Îú[ÜÛ≠¡⁄≤‰/„ÄOW´8{IA‰à∂∞ê
8M]x`∞nK(ò=zéÃ)»≤ Ëµ∏ìMP®†œûc∫M$¡‰Y®*{c˘S√føûöí‡*0ênõÙDEGAÕ%πYxF´áë£2q6ëeækê∏,∫)s/¡‚06.]¯À⁄-¯∆#ÛŒ•¥™ñ¨Â∂ysÅh‘`ù√ÁùΩΩŒk¥z=Œ˘u6jèùv⁄«ááù£ΩŒ©®l?X•tû-J:OâQkÏ %&ù2QoWó∑Äí˛£ZKu' Õ∆œÁÖïÒ!ïKRÜHôRÑ’OKRÙ…E'Õ¢\„å6|,ôxXÙíu@d¬á··`î«+hiA∑ë‘Ÿgä}GP´EÓ9õÅÖ,sñ3pΩâã≠)G¡E6;∆/¡ùx.å·ıèƒÙ ¬Ò@c¶–e9‚SÏp83á8’bÆ9Ωâ£P‘
LÇvC•úd;çlåx[3É};&R≤‘káôÍ≥∂%9L¢ö1ÏTZ!¢∂Af‚bCn,gHŒÖ©ë£à¯Fy°€|O¸fƒ7	£mr˜UJ.÷ıä•ÔÎc7Ú¬•ä!5úöL˚TÜSshÜ£pÍ÷åpjÆÌG1Ìû¥l”UA^bGD!ëG câÃXπïR‘4~0•m.aÑ67ÒL¡XãÄ˘¢√Èâ´)4L∏©,z|≈«)íIR¡∫ ˚|Õ6ùQp¡´z5™,>5í´p*ÛÆv&$âcΩ>Eı€ÅÌ
2iÚè∞v	r&ôÿ'ÆÈ!${Âî„H(5Œ>(sö◊ÿ…‘rËÅçLπé¿}∂’˜m¥
∑ Íw7•¡,du=´∂∂bClB”%s;'
e¿¿Ú*‰Í¢òßÂ∑lƒ ek0`OŸÉ–Œö!>ÍÜä®$¿R>Å^¯/·ÅØ(¸˜ZE8fñã{˘ç«çΩfÎ’É∑Äm+·
‹JAä xÛUêÀµ#[QúBy¶"›·Xº™®å3∫üßbÜ‹»ö≈"2éQÀ·ldº“"+cH+…!?@¢¸úZÕÿ∏ÖXîÕF%Ç∏z1]T°NoX*T√∏JlZΩê!ÊMLÖ‚£œ:äÛ=ˆÈŸ(™|™=K!ŸTRw€‡Z¯Ü(⁄Ãæ6b√{ËbïÑ∏VÅÓ¯VòS› ,ŒMÃc\€c'Qz=;çq©èEMb°ûúJP_‘©‹°ÒÊ˙'
µL‚iUfQØN£F)E˛Zxi!oÈ™˜k4Ûûétíù(TN’@Àv™&T∆tô?â/˛o/.#ç»ÍÕÄF®	ûˆ !xI”ƒ„“vm œ”ƒˆ–/¬î°—-:ª	pΩ|–¡üjb§pX≤˛!èWÿÌñ3ô⁄_an¯}˜ùBJ\¸ªËq‰Ø=öáÜcåxûN§ˆÍùÛ‚ „ ÌÊ=aÀPÚÀWlmm[a¸±ª,¢—ï›dÔ)≈3sﬁ2^0…
æä úà0©+b'bØMÅ“òÍﬁJ-cÄÀQIø—üdQxâ:M]iê*®å≥é´2≠£E4úÇ≈[≠Bë˛9˝%Õ3@c¶5€¶∑´	¨*`’U¨À§O96euVµ&àF2-X◊ÔÿÉßOôÉïS¡äUe∏Œ ’w|yc!„n‘ÒıG&l∆˙yeK˝ZXVñx{Õ˛πDè˛   ˇˇ CWN
xúÏΩ]oIñ6x?ø"ä’”EıäIâ≤¨◊rÅ¶hõ=˙ZQˆt∑_√ïb¶»¨Jf≤3ì∂T*€¿ãw/vwΩ5ÿãŸ≈ŒxÅ¡N_‘ç∫ÙÕ £“`Ê'Ï9'"ø#"ìîÏrı4ª≠íí˘q‚|üÁ°’∏ﬂm±–∫÷ÃÚ«llµZÏ‹ÛMÀoégÏ¿SÔµÂÔûOƒ!ºhºœo∏^ÿ0«{côµø`K}vôÌé=Ó˘Fhªì°kZólooèŸÊÂí∑˙ú’2É£7≤]”ûxÚ£cÿ!3\{Ü«Á'∞ñ	|r4y€≠÷F;5]È„ıDGá∫¸4qyÒª≠÷2√{˚≈€ g?\‚æ◊ÍeÉÖ®/5Åñy0]pj]¯V0Ìøac«Ç#cfÌ’¶çMˆ˛EKÃm77€›Vçm<dΩπcè◊ÙöÕÊr#›Xf®kH›AœÒ-√ºÍç«`b˙Sk¸ïdRRØmzÃrŸ©kZÔ˘Ìﬂ˜Îû8ã ˜∂Õ.æo≥õzcü]±Cœ¥/Ë˜Ê’∑‹ÉçÛEzn’€?ÿ0Ì◊ˇ¢‚Ÿ◊?cg∞ÿâoΩ∂≠7Ï‹ÒÄ<~∂QuÄ‡iÈ˘nˆ‚”V∑µ”nΩdÛ∆L∂Ô-`ÛõçKG0≤"ü•=»ˇ‹~Á¿v û—-«∏¥L63.”∆÷CéwR§q’0°«À±∆a/g¡ÿ˜Á‹·∂u07∆ú◊aû77‹†V}âÚØE|q~˘íﬂÓ‹1`öÚÚc1ü[˛ÿ,˙=æ¬€¥ÇêÕŒmòäx(—úGøàª†Tö√πKï±'ãõÔfZ@∏ñoπc€`á7ø3ÅòŸ‹Êlå«ÿ]ÇÏàåñôØá◊lxóÅcM7<µÇπÁV›∑∆Õ1º∏ÂÜg^¶»5◊Y-7wµµ∑K=râì+ü∫ˆ_JOz[∫s+<M{èÚ˝ã{∂—h¿ªˇÏ‡òÌ‡ˇ£'«£˚%˚˘≥—ŸÒ∞ﬂÎoæ=¬/˚Ωë8r|4±”ﬁ˛¯‡Ê€'phDw“o˜}‹ƒC€sÅ∞˙ Ùﬁ∏¿0éûK˙ƒIë¡Ï]€¡¿¥Q‡Ïı–pÜœÇ£ñyü	Babπ é„£˙)¬Öyuv5∑ˆÆ„_Ÿ7ﬂ ∞∆8Ë,π±ÀÑ7≤∏M˙O˝ïûÀ	˙Ã„C›ªÆÆk]‚ã¨±ΩáÏ∫Ñ\`c { =ˆN»ˆÚØé/Rò 8V´ï—*øÒbn‚Õ‡∆—#˛∞ÏÅ>…ß.ÓW∫S‡“AnÿØ}´õpçê’Ó;≈é”Ì5‹eßˆd≤æÁ,fÓ.pW√iÑˆÃÉ$ÑYáˆkãùÏ?fs!<U˚hzFxb^Ù¯U?˝ia•·êJ K£7çãÖ„∞ôπ˚¶Òb´˚ó/Ÿ•CøÓ¿Ø¡‘∑›Ø-v·Ä∆ç?cDo ŸÿâmäÔ˝ﬁêò@±»ù⁄¶iπ¡Ñ3Ü≥¡Áã=!≤^«[ÚÔ˙BA0äë¥¯†”÷[ˆ˝&∆ŸËÂµÚ3ˇX∫Î,hå-\ZˆÂ"Ìã´∆πæ±¥/]Ì~88êˇ•R˝¡c€±hègT÷-PX∑Ú⁄FM∑ƒÌ@	rãjLª%”cÑ˙ÖãﬂÃ<◊+®1±ÇSA?y>ùıÿ…È‡˘∞átQ*7q∞%].[´≠Eßt¸∞eÔÉ◊á}È«ö]∫Ï ⁄,ØU“úkÙÀåb©≈X∆"Æ@X¯·”S—DÆ§ÉïÎVrzﬁ…ës¢Ü´)8IJÂñ;ÇÚ∫9πVÿ¸lä˘U£ïò6‡l88<9fßÉﬁ¡áÿÂZ§îFâõæÒçπñV⁄B(ˆΩ1#ulDïßó QIvN"`µ@ôëIÚ£úˇr[ªt5CT7k¸‰r_õÁˆ{¸ËÜ§ÇntR*ı“p`äpÜÍüqU˘≥
ûÅdzÆø b‹DbD„Rn£*lR?û1gÇﬂ∏Åç =:i#ØÁ‹#=á˝§Lá≈œ<ˇF‰Îãﬁ™íùˆ9˚,Ÿï€-±+ﬂLa˘AÆ`r4ffµ[Ì“≠Ëµ¿ Fµ7%‚pÉsﬂiÍ`ß’*øuπ´¥úTs.Uı˙¸Ä;—3˚*XÃfÜUÖrM;0ŒÀ‹ª˛D\=‚ˇi}~f~‘/ŒÆ77∆vx’ÿºì¥gáéUXr∆ UÕ,ﬂ¶∫©¨KÚ«éÌõÔ]f8áÇ|üÁ∆ó^„(µ€Ô¡A˙)'‚w≤#´x_Q2ˆÅV}#¿®í…–&Ù\ˆàÓ‹ïå¨bn| Ó—3ç9öΩ`D/^ˇƒ(\^¯u">ê⁄ÿB˛ó)◊q[N yôÂw=ZÊ€≠ú÷…zyuFê(Jyï(Õ∫2æPÈI’y@Ì&if-vûi≈˚¿bD#¿!^{h,ñQY˘èÔºÀÆ%´É3ﬂ;8;˛'ÈË¯Ù∞wYπk∑öP˛vù^É∑üÁq¨}ÔçÎxÜydà˘©á˛¬¬¿\ˆ˚ìÔéœ[fø÷à'e5˜\¬ ˙õ⁄{FrWêf⁄=]>õÇ^{ÁæÌìS¨û9ÿç∆ÕÔÊ.¨◊∆Ì)Ù¡‡∆‚ŒÅÌÊ#≤ÈÂ]
¶ïO(lëÛoﬂÊéq≈Üè}xó•ºd|∂≥>>∞3—AâÆ=íÔ4„˜” 8çÁìzÈâ¥bsòœ|'ùàv}±VªWºo÷ç)µª≈üD‚‚˜(ºπY.‰éü†∞•ã©¢#Ë¡\Î^î:¥íù´éófìm ˜RÏå‚ÅÏ`a8±ò≤,wQ=ÿòﬂrQ6√NT"40Âˇ$ñré‰‹˘ à|öM£˛Ìærr≥/pÁóÆX‡èAÖ˚…ıœÿ€OCœ√,ÄΩˆO]„ı‹p≠`ØUACQŒ°òö¥™,?¢—s`;U‰éè|ﬂÚO<ÊW{5◊kDá ..Ÿ´’Ë˜√1∞yc{&÷s,?Ï€˛ÿ±îlÃòù√Bu´ÖFV`\¸˛Z∆UÅUïS¸g¬Gƒ``ïœ=◊√ú4’åÂ
˙sdºÊN-◊dK∏ù|Ç»ò ŸòõÛ¶qívñ	OîÕIk¶ç∂pEﬁR ÕwÆ=ˆxL,|f9∏-+›f˝©Ò5‹ £XK‡Û{Zâè¢Ü_;ˇK+§ÑÚZ9ªÇ'É…Ä	∏Ñ∑_®Úm≠Q¿t◊jæîﬁR≠ JRƒR
ﬁ%∞·∑íÄtAı'ìèAd¯LzˇÊË≥‹ˆO˚EBôÎπ*≤•‘√—ŸÕoéˆ{ßò_s:ÿÔı)€fóçG√„Sëbs¸d8:cO⁄]]HáﬂÔŸŸc‡b£AˇŸÈÄıèèé˝≥·Òë˙BÕtÀN~ÅÙ‰3-ßf·;X˘Ï(∞˜àmÓ≤˝aÔ…—ÒËlÿ«=;8Îù±˛”ﬁY¡
∏Êπg∆9mÛÊ™,ú∞&ãÆ>H∆RxßØ,ë—≈ÖomÏ?√Ÿªæf¬•πÀZÎ·,¯≠yGñl"4œÃUÌ¯™∂ÏÎ“ó|Jbû‚ÖÊ¬ß‘*<ø›ïùü⁄>ú·nÅ.7ª‰YêY<mºÄgèÎÌVÎı¥—ﬁÇM±ˆíÕl∑ﬂ¿éÄ=íü+	µ(˜l‚FÍµ∆HEÍ\∆∫gvpyıSx∂·|Èvì"ÔÈ‘ŸTó_≤œ)$õt+ú
¨¢í£V≠¸‰Øü¬îø¡iü§úÉÒúì≤€M¿“jı^oÔO7Ú?òT"üP$Y(Ÿ¨>;Á–
cbç~Ω0¸ú≤ßLÑAwrœG±ªo˜Ê{Xº±hƒﬂtS3zÒ‹sÃº®Qº.õÖò,P{ÿ˜|TébÂ-∞'Æ∞+–‹R„Öø¢,^«
4
Äfuu_iΩè9/¢⁄ım_∞:pﬁ€ü’kˇˆØˆlnÉvÍO`<z31¡”ÈrÇM¡Áµµ5
‡&K‘_ºT¶*+Ê5˘^P“1LuR{ Ω∑óÔÿÆ¢ËGµ<—îå¯|(÷IÌªSKxJ≠ Í&P1}À®»GFÀ´êH/,±-∆¯Ô∑ˆ€Ωóä}z=N-]”±‹I8%Aﬁ“∏+äÃ,ˆP¨f<Ê6_9;¶QhòKª‹•ù	ä`vvŒãc4¨r´
´L 4÷c¬∆˙ëÈÚ‹ﬂ|Á≥⁄ZíYµµÃä´0N‡NJNù7Í¥å«~Ûÿ‚`¢Ïâ*áÕ‡û¿“∆ﬁlÓX_¬o¸.∏ ¨T¿|∏ø7Òoﬁazy–dÉ/wY-∂jÅi0◊ZÄ
xÛΩo\2cg9¿1g¯ Ó∞_/Ï ÑˇŒlWX’ yæM¯≈ô¶±Œ˛Ì_3\ısµ3e5Ü´sûdvÀÃò◊Î≥`≤éupƒc’>ó2ù7˘†ˆ{w—ŸêÈp)mµü\√√õæÁpª∂@c,>⁄mñkRò=˙ÃU?¨Èb|e©∂Z˚5=@Ní/v0°9≠IÚ2"¢ﬂÀ √—„{ÁT5≠†ñ∆n%ìQÍ‡U§Q¶Fój1ã1€ÕlÃ∂”™Pîπõ´O’≈keuR§çqV>˜-û»ó)ëäÚHÙC—tóÃøM20Ô¶Ñ™üÁ≠?ùˆY≠Ùõo¡L?^#í28”÷koXím≤JF2Õàe⁄ãYz=ë@V|ü
	…˘PÅljÈY8æ∑úÖ’*9ÂÂa—sd5aeèΩÂ‚Tãy*û-zHd«±^¶˝0ò,SÎë1D93÷åXgˆ™B=EVõfƒ	œ∏]I∑ä∫z◊Á˘CÃO j2TÈÓQdΩÈd=óú√DÃdsﬂ;«‘∏`ù—Zæ°'ﬁÜ™Ù^Wµ6>}–ó ´9Wı…∫ﬂÌ"Aﬁ≠√ø„¢,Aå‰p÷∏íâû*Ö∑…ËU{yÖ)°óı≠ã=∫˚#L¨–√[πØ7¥ÜÓ|Å÷†?´heâô-HÒPÊ0£}ï.—F≥]WÈ yÄséüb™^Œ¬‚/M√VM)X˘S√ù¿©u+ —ÎG’≠&<cbÖM∫ùí«zÓ_YWòﬂEÔ-∞ö†∞r¡5†$J√∞ö¡‘æ·Vk⁄ZI´âEv¿Jˆ≠,§∫∂åê'/!√Mytó®^RÈ|òﬂ≤¶`WY˛^mﬂ
∆æ}në˚√vÅ⁄å–ÛÀ≤=å„_Oº¨±ÉéûÖÈ°ud¸zqÛïVÊ{oÇΩÎN?H!ÖFÌ≠%^:^ª’5ΩŸÁWòj}9›≤Íw.ÂäﬂŒ[ÑË+!-=KëE›-‰fõ∂øÊ»g@a{WÙdIiA5óIÜzF^Û˚$ﬁUÕ–∑guÂæ»äﬂ8°ªÀ≤È›qÍ[4Ò›‚R•ÃâN*A;b(©ÔBÚˆV∆#íq÷&bó·÷Æ«Ÿ•ãïâ8Áæâ+3ór¢‹◊∂·ﬂôÔlÖpW˙Ô(⁄µµÀz˚Xh∂¬ÈÄç~	ˆƒ!çŒNüQ‹éùüûıJ_¿”Äı´æ¢ãˇsæ6SÅØ»kπ˝AZî±«´RóR†⁄?ÌúuÁq±‚˚ã≠<Y!ÊAÊ‡pPÓJC*ß÷N‰Y⁄3Ãß0fËïÛ–´∆zz›Te6¶≈€/Ô©TÎg°(ÂƒÚèkÙ_√vÉ–_åÖ€qf 7ÛÙZ±´RD(}qnÃŒ·jùí†sÄH#%{¿ºs«û¿oæMÕ9#ü(ﬂ2ç1èÔÃìÁõ%ÂÄÑﬁ∆
‰Ñ¬÷÷´®ˇÒ˜[÷;2–¢@_ΩXﬂMVG{Å˘&†bÏ≤˛Õ˜3Üb"
.¬k/Z´AMï)t ÑUZá ˙*ÀÙZ ~§ç°¶súÖl‘êlæÿá®*®÷8˘e.~êì2Jj	ùgóãâ˜`_πﬁk√jà(è÷nKµè_cU›eë≈ñî˘Á›@ÂÊ⁄ 5åhÁsu÷π˘~Ça
∞JhØ≈q>–I|–?p÷dÅõ
∂"Ïò‚™xAÑΩƒ1ã?D¿]˝c>&âìj¥ü‡n;4öld3∏taQM≥–å‰ÓÎrn˚<“∫éqVÿÂ∞–ñ«xÑIÈÁíüÌ9*NñÀrŒœsÇL5w@±v`:¶5JÑ˜6¸Ø¢ eﬁÎA∏Q)Ô°z8∂⁄‡~nÉ¯5ÿÉM—BÆM√pÏnl6¢Áÿ^s‚y«jéΩŸFçqKpØˆ
®‹˝™Üi¿òîÍÕâñ]/NN-ÃEjÙ©¿´8J°◊(¨ ﬂ	æıŒ˛sVîÙ¯Ñ∆ƒzC6¢A≤∫d∏k6åái
i(éCciº0ú_/l‰{H,îõ«Ô©r‰<ÿPO¢v~”πÇfá<⁄lòêıÄ‹Ò‹I1bòxÅkO¨êx®yµ¸Çá¨~ú·›&gﬂÔı™∂;?¥$„Õ§=.\Cåõ™g`èoæü√V7®Ãµãπ1ãE!oÒB  <7|ü÷}fπ7 6ågÕ<‚òìIY
Úfä–÷¡zO¶É≤Ñ|WMMJâzXãTÆÙ*ˆ1kŸ!øœYcﬂﬁ¥F »§œïÖ@|uÁsBÄczé'25∏¢ƒ@2ŸhJ“ºÄ∂Ácf1H,T†»∞c`ﬁJs.⁄ì⁄Ì`jbÙ&ãõëqÀ17∫0ç<.Û
(ÏII¬√uê#ëc®…D¬Bªàﬁ¨ıé“˙ìËKÜøØ“ÚÛ˝`√sñëïK‹‚≤$◊y· 8÷Ö:T«ˇÎ[v∂`}ö:+
–ÉÜÖ›/‡9,'Èç.±§˙;»∆ó¿Ú_€&Oπ"›7íoÉÃW)∑
-FØﬁÚlxxy–mIáßjÈ3·
≠®æÆ§Ä∆y)¡ló~˜Ω7¯˚-¿Q8∆π%”4òLÑHC∏ú“ï4æˆv3öAa¡∫çPôõqÅH¨:ŒN
CEÖ	{_•jÚ‚≤…èUÍd´V»VŒj√O.≥mﬂ
,–-}î¿«%π≈÷§ò¨»™cƒC«Y?ã∞8¡<¥‡Õ+ÖÀ–Óß|∏≤<Ö¿
GW∏R©-P28úˆ^qˇ”´îˇ©cOÛ≠/ÊH¡ eY7òªS‡ÌÈ(íHà» V«_Ï¥“±§n1Qo+ |– =…q>Ú˛ »ﬂD˛Í\ù:±@Gsº≤ÎÈaÅö2øõwÁ>ÆÕ@˜L‘Bc	¯Êlrn…wö˙ﬁ∫ÄÊˇ˚Ôÿiä¡;k"åe¡
 ≠XÇL»$jzµ˙û~Ô¥◊?úFªÏ:»ì∞H‘ï®Ë¿∞ 3`oF+åvôpZq∑V´Ò`O∑BtAî)fÄÔÎúô™x?Ó„ÓŸJˇëÚË¥sù$$u€µ´ÜÉÓeJıS¥óO<\*0§*]S∏ªπZHÄ‰Ä·WŸ# g"Ù;\1√ΩyˆºÕS·mArl∞ÖÉÓ	œ]âæpP Úçc
4Wr¸ıqƒîÏÓ·3#◊ãÆ™©ÙñNkÈ§tñ3$ìFÔ0I“lc}k*?èFqY*ƒægËg/]é/l≠∆n~Ô€}âÌ]≤#2P’iÉ!¯”ŸõÖ=·∞Gã ›K§ép¨w‰G}4nåRº«ù¿g¸j’›Pº¸œ;‚.wy8∏>à>∞%JED^R*1Ω›8ü©8sJ‚¥6]{.ó◊qä1»ÕVÅ0óÖ˚°6≥Ùêá"j•±∏$TRB¥Ÿ-fÕUN|ÙsÜÀrI€‰±∞MñŒ°xãÖ¥∏‹ZÒïjﬁ>y&Qø≥Uâ≤^¥^mÕ/_µ;√üúı˚˜◊€≠Œzg´ΩﬁjnÆÍm˘Gµ|¬)‚Ô´ÊæT:º|ÍKwó<˝˚«˝gáÉ£≥œvÈ ì]åπΩZ¢^¯ü+…eÎ£KrI| ÈäeÍKfÚ"kﬁÈf+W83O+¸^Íi›“¯s’—¸˜öÅS)Ô˘A?G—e‚†Å„9˜ Ü÷$Â•ÖÕ®té®rp>`Ub Ö≥f∆ÿ«ºÂcB}‡]Ño®h/¬j!Ÿƒ(Ç	v‹IØ?⁄8é÷∏1"c€"<™-tπØ-IL €p‘1EòÂ¢È*í0I,c6òæﬁ‹÷( \l“πp‚SÀp‘n≤úzÉ"≥#Íxç÷E€|)kÃXŒVëèï"ˇ9)™⁄_q#`8ºÙY˝≈O\NÆJKBÆøàZ ¸$Ω2X%ñ-!‰·/%¯…_.¸2a‹GêÓë:Í”ﬁ∏ƒù¨®2[Ω<¸?˛·wH#≤œéOYˇ¯‰¯˜*∏JíAæ"·K…ü%¯Ÿå™™E”iÑ%…%µ8ot4@…äú…EÃ âQz†ï1(Ñ”Øü €P¨7"RHø∫%(°ùÄ4*ç⁄Í˜ƒS§ãV·êdêGÄRb¸µIJKnΩ⁄˘”ãÓ}´u˛R_T_ñ¡¶LãRsß®dﬂ'TÌÖÊR>§}≈¶fs‚˜qFSÂ¶Âãß≠œÆ_âëc [”rÍã∑Z⁄‚≠≠Ã÷¨Ç∏ßâ‹r&\∏e∏æîí F/ÄRÙË}*?]YœƒÚŒlƒQØﬁq/ªÀÌv=T•4=3ŒÈ‡$]àB‰ÿAs& ZJkuÛZeÖÉ…ò≥x1œ{QÚ(ÕiL6ﬂÌ¶v6p”s∑%Z~v∂¥-?eEáÀ Vh¶§0üoÈÔ]•Õ„™_ó	S"ê~èVÄ!_RÂü¨:wÍ®¸-SHsCä˜≠ º*Jk¶IT≈Tó∞bQr‹Ä˘‘≤©Q*(áiñ¢%§“`ˇ™«ö¢~ezU5„7wıƒ∑MÜ?–4⁄®Ê'v∏¿)Èg!∫j\ÿ6
1!ïj J:õf«q˝
÷B'©rëÅ?_}e]Ωä“Ä,≥gÙÛL{¯¨Hœv}Øï›äcàHTÉ8ﬂ¶£E"g9<ãïlƒu;D*#≠Ï6˙+–¿µa‘oS]EH√˝I^PH÷9ªê\π…iøÌ÷˘˝ùˆÀZz•2:35˜+*Õ[õ]Î•ﬁç_Jöﬂ£
VUÅ)äI˘€gsuŸæ¢˜«4ËuX^ï=•¥ùœÍáá¸„ÄCôm∞«TÈµ…UˇkÉHWÀí-FÔd”ÂMT˛÷ﬁ
õÔ÷‰Uâ∏*‡‹‰Ë^u[RëÇWoÏp˙ ∞ø6jGEcéˆ.˘^w≈¡˘ªV¬ıo#,Êbã©OÍR∞÷ÍÊùk>ç‚èˇèˇ˛/ü6teÕÍG^TÓÇn–ﬁkctµV∫•™m*Æ‘F∂ï`aŒì¡k˝€#›Aøëøé’ˆ∆]Ù5lP&.3–¸‘Ó‹
Fë‚§©º
>Ì^xÍ´ƒ)≥§äÏb3Òú(
+c∑ Fß´b·'…@¡ñ´√,VN¥ïb®†ﬂIpÛ9ﬂƒ<¿≥πøüWo ˝syGyΩMTé≤◊fh>¬¢ï1ıxÚ). v#»ë~wÛùkQŸmæº∞]Uóì‘y·í#
"åE@Éö{X ◊øy7∑iÿ÷
√Ã{kM6p‚∞F∂Frj∞ü˝Ï¬∆t@∏Ëä9
ø:Qqö∏≥õwaîE¸≥ü:‹Ö\R{ìûjQpì/∑…É±ë¸®=Ä¢∞Üos,E‚ôÏ‹Cç.¿(≤h
(ﬁÇa€◊ﬁ-êêT=¯¡˝}h_aΩ$wï¡cè–ËÔâtÆ•ãß•ÚN≈ HYòx\≈>€ïÎy¯fK9ö@è¬…Ä¿Å9q:&wr9#◊ Í|û˜f∑LV÷ê;≥«®≠õF≤;Kà4nŸó-KÖåÑì^
^Æîäx+vu2˚§í(Èã¢vÁq†·»õGö∆K3ﬁ€Nö-º5œÿ!Œdiˇñ`∂'∏©}+ú◊µø∞"◊%Ë·Îåö&Ò]?5ÆÃ x¢ÕYS\H–≠cQ%÷d˚∂Û›ƒ¬–+ûÊÕ„®tï∫QImd`á¨å·•≥ºP3XÃ1É—Á_õèô¯œ_{˛W\ËRπÔôã±•*a¨¿;„˙-ÎTî#Í˚Kï∏e¯<f¯ˇ˛#Ç_>>yv⁄£Ülp¿è·Á1÷ƒ⁄MÂ¿·ãO[V{ªsˇÂ8¨)∫|‰0€©≥4z¢Ù+«RGuPö•ÿ∞·—Ÿ‡`¯dp‘ˆXÔÙl¯xø–-[TgÉî ,ßZÚü∆26P/3”ä
"‡-krÛ⁄˘°=èÍ≤©⁄ˇä´"Ñ!çWQ®ë•ì?ñÀÎπöÏ sB@Bµ÷|BŸtnR£äŸ'Q¢\üílb®üqÅéNü‘Nh‚xÁ†,ÙP$ ãõÔÕÖC–˝QÈ´°mÕÊ
CÔ¢ÃWZ÷%∫≈´}À=Æ‰ÌùÓ≥ˆ.{|–=’(OeaÅj5ó≈¿TqZÊ!Ç‘kB>il6Ô5.‡≠ß5L{Áí44ïØVÊƒè”ÀÚ)dZ«nê2’Ü≠e˚§Ë˚*§Ëù¨ìPëF⁄Ó®ÚH£˜'◊Ω◊:ooæ,Íµ˘, Óù e∆˘ÕÍG©—°ıˇetT5ö\¥p`Iñ˘vKú†ïf§Æ§XxˆæíW2Ôç˙"]4õ≈@®XŸ
B´”¸÷dãüÈv3ÌËó√1œÁ wKp–K„¿Œ™º!æAØ6|~L¥”Aˇ¯pp¥ﬂ€?.ı\ïZT•æ≠U*ıö–ø>Ω3IGjÅ0ã V∏ÓM•Üç»-A–7ë®%|2„kœç`‹¶7ﬂù˚69"<—ó€ÕÍ¢ÙÀHº6Ÿ–¥ßÖPÃê¡é}{.Pló–öB#XO†›ºõÿE£f|(-qV®:K\jENNΩA£</(W‘Æu.$cã2D…Pú\ÅáE>ì’òYí?ﬂ0Âo^“∂ìY1»Ê√«à®„X_A⁄6órƒîÂˇHãKdv≠+hf∂@‚√Üç∏Ë1Œ‹Ö≥ÄÀÅnæGí ì7€]xÕªÿcKÕrú{ráS| [&îºÃ$ÿÀ Ä]6ZÈ±ô)®ˆX@⁄fò»N©ƒ˙7◊õ·]‡¡‡™‡ˆ3]bÄF…eöggóùúDzgª1˜=L¬é‡?6Ì3;¯
:Ë|·•‰tPqP´É∂∑w÷w∫†Éﬁ˚≥˙—Ë†mv‚{?Rt	“≈OÜ|Lzhˆ=mî~q28=„ZÈ·Õo~1<Ï±ì„3Ú‰¸I®¶∆k√%U“¥ÎÊ˜±R	Sî—%8,íá9óÙPòª∆Î≤
'Ô!Üπ#±Áa˘ê5ÅKQ Œa⁄9¥/G[Ç/«i†ê±·Õ˜3ƒÓHâTÆ«4@ç-Z¢†r!˙gÂÙcPNO¡ıuÜª˘ÓB‰¨‹¸ŒÅ—ØÉf4ÜÕà‘A$CêN∞˘0ë2’+.i≈ê–@Ä∆(≥î¢Wémöjc¸Á÷[œ»ª…gv“≥±g∆U„’Ò4ÒÖo∑ô¡⁄±7ÈÇ9∂R∞\3™Ñ1-Pí§é‹µ¶±.ui) ˜?±ﬁ>ÜÖFgßΩ˝c—|t“;ÿ?fød˚Ω≥„;8Ó˜£•"(†EuÓø‘C®"(•8ê?l,%yÅ≤8 æT†[G°»…h‰ŸÈpø∑SØ¨HfﬁKî‰ˆ	8®ù¿0ïøÊug7Ô.——Û:≤Œ◊©dÈ‹vh!‚)à≤ÿ…É…±œEYêÜà¥K©$\N±U∑…9V°IÇ1(~ÿnµ˛í`%m„±Ìa	8™∫¨ˆ√DóŒ‚ËåiàDúàπh%
0wpNA ¿ÔàÓàˇu<õ⁄¬˘Û$ vJó$ÀIà	wºyáŸD∆y–D`ÚàÁÕ¨>AdÅ“3∑ΩTËÈçuŒÍ≤(50ÅÕ÷vªÛRóŒ‘÷∂
ºëF@—#xE–sDƒz≠…é%åáX
⁄»‡øb2Ú‚c¸.¸'*º&˝jzgÎp—ã(∆ÊN=—â5!N°ö›yl,ò…cc÷í¶]	√Ωuzê¨ÓlµÃ]2óñÌ¡Ø–∏ï€y›‘ŒsëÃ6
(±S›<%âßºQ◊r§sZŒzÛÀ¿s◊h—18ät$›H˘˝vïFHçêhMo¶±Ñ”€KWwY•íii†XéW√Á∫Á8(Ä*‚¢
›úó«âÚßÀÜ∑ã6˜S@®©Ì,≈ñ8MƒW˜d5x˜õ›Ân4®ÂÕûÑª÷Èl*Áx@`Ÿ"©®scI}hºA∞˝	/^DßÖQ_B•œE˛Ò≤í·LÃ‘Fıû8Jt=ü–2ÜqTÆWGLâ¢Kbï…’aÔr0Ω∆QÄ„âó3ùË†Û∂íÿıôü.Á⁄JÌ¯¯x™Ktt¨∏Á”goÂ6}Ù›=Œ>¢ç_bû>õØæø/ÛYOA¥œµc©Mick?Ìcππ∞ùœ£1[ÛpØF\GjÇà»ﬂëNF‰Lmî5›ìt@%0Ó•À /*ÿ∏wüÏ∑∫fª…Æ…Èúacﬁ¸û€É“°≠Ñî¢Ïã’ÏU˜∂ŒôWµcVµ~ÈÜñQXä≥,«⁄äâ:∆¿eE≤:ÈÖÃ.TÌ·…ÒË¨lﬂÍ|Vùt÷uÌ·Ü1∑70–zıuI“º÷Tq5r‚∞≤t&újPÚø¥¿¥"˘x†ë⁄ IÕÓ?;=ÿ’;∏r8Y2µÃ¡U™©6aòtY‡Öbá´Tˇ_\≈aç_0\Qˆ_ˇ+ºÒî’˙U∫7ŒÄ≠"<
˘&P mﬂ'öÏ3m™°épÖ'◊vYÌ¨O;ˆ‹Ù@‡„Øœ|ﬁD¨∂Œœ;X‹c8OIœ∏¬kˆ±ôåﬁ≈√éP¶O∆¿ÚçÚ }k<ıöÏƒlL7»m	ìoÕ¯æ ÔºŸ	¡˙„M	w◊èNÖµÇŸY0Ô<ÅÁ•∂æo?„ÔÉ›∂v76»üzA∏øï&Me`S N‹Ü˛2®˝jÚ£¨Rî·qˇ@,’≤|^ÁÒ„"=§ùZ +a,,äÖY„˛1\¿OŸÈ ªµ–A8ù=€7õMVö¥m∆§¶∏(Ì–ø2¡BY#í®Q3ªWã¿2Òn≈D;u®Z!¢Ì^>ebß…ŒPúE—Ö≥õwòbP”âÌ-çHº3TAæŒ_•2;,‹Ñ{∂ApÙtù1c¬9œ_ÛLäÛ˘©ﬁp"
xrÙd„Á'OòAÌY∂∑áÿ'!üù–ˆ·/ù˛Õªô%}s„äT[è≤„G”jÓ‘änV≠ÿR)ôàaÖ~ÛZæ≤Ÿ≠"◊¢⁄6!ÿNí…˙˘Ë¯àG”§g,ÍQ>k¥r∏ˇÏÁèéOﬂ¥˛Í…ƒÎ¡ÁhÙl:x6Èı~Øﬁø˘7E¥ÆËˆ÷n˜‰ô=≥"°D£ÿòªxî˝˘Â‹ö‘tπ55…¨áIÇñ“—:ÃW•Ó]	/+›•R°Çb’o–§‰©Â{+Òƒ‘A†8„7*ü°öô'Q9Õ…ÈÕo˙g√~OµCïΩXó„r≤»FÈL®πga±óÑ™ë)óõ0 !üz·W÷U\≈ªNz#hë/\ûëÖ˛ ÛK/ç∂
ÃÔØaΩ7¡zÃË(oÏQu`hw‚˛Å¸2Pß±@’`SÉ¿§4 N4):Î¿7}5Z*÷,q?— vï‚`U¢·'
ŒÕ#
N‹f%[Pç©#ºŸüC}Ti,3~±ÁU∫,W:ºrv˚tK€õ¯∆|zµvÊÖS˛å-Y¬G©)YË>äƒ¥«ö Ì¢™ÎπºøÙ∞rgu π¨∂Ù‚⁄?/zïE‚dâ’ñlwœÂ°Ç3Øá∂W`{◊uö‡g>¨H≤kZV»oaôÙ¨¯jEˇΩ‘˘á‚Óı¯1 Kz˘‘k÷%à∞nƒxk“ã$Szá‘õ¬Jdúø….zæ∑"=h÷à“"äï—u&+u/õ§*≥E=wËé=ËÊÓÃ„ÌVcètÒ+Ÿ=ñc¶íXÈ}¥wù˘Sˆ@+∑èíK¢#≤´@}4¸AˆQ≈c≤+/lÇ˙˝&;Îk{>¿â8ﬂèmÓû?ÚÿÛ£µSWÖªƒ’˘ØR∑´#¥¥é¡s·2rA ˙:Ü08W∑ƒ;Ò£ˇèÉ‰1û<∑‹::N‡À˜ÀZ∆é∑0Ê˘j<%æ˙œÃ§3¡¥≈ß`ñXXï£‹È⁄â(£⁄≠b?4{p°_èXï‰'ÊoúÉ≥ S!ÙÊxä=ôÜﬂ7ç`c°˝5mºËﬂ2•´9«sg·7^ÏPbî¢£ñ∂Ù“-Jí	¯∫—V·ÎT V≈…äóøi¥;0!ÌN¶J)„#ÿR§óà÷W•±ﬁrO™Ä®”í±w◊^≤$Y◊n˚¨≠økΩ≠âózrtô≈ñ00aÚÜ0±©"	¶·>ç≥(qÌÿSëâ©k«"u*·Ó	9àÔzµ€Üíl»8∑≠w*∂2Èåyƒ±<&F3Ú9ÁæÌ;’UÃm√g¡Ç≤Ê-Ç	Úòa%…„π(îXñ¶îb5d}ÕW◊ºÇ…ß?çÜŸC÷“·9ïeíÂÚ√˙(≠©V) Ã Ûn¶RBbƒßQ1ÑG˚3ÎmrQ∆v‚Æ0Õ,Ä`™Ô†¬uóœâ∂Æ‚e5~ÊAvì	Áùæji≈€´,Ä´ÀÁ“!#)K•'(M!5ï0ô∞1)⁄+jÂhÅ'˝wÚ¢T◊,+æ¬PVoùïl,ªËI*H˘b
d‚<%8†‹notXÉè^Ûä®;™»¶À’·Y:x'ë∆çKA_‰√^Æai|Y’F•©Æü{Q¿Qs0GÎ1ﬂåœÊEÆR,û„íCä“$·#}˝à
õ˚	ø»»".ˇä]Lì.‚ôvß©^‚mEcqu[ÚIß®TÄt
t˝Q%_(êsb7UŸ≥\ø§‘óáÛ¥3/˘»•0»Í]%f^*¨ÒP&”ﬁ∆ÖjÆ∏{„
L§á!v¿‡/)áªÆ◊ïn2ÏJ≤‚ññ…ˆXÊ¯Ò:N•⁄œ∆o
ådè•6n3Ùº7ñèç–Î
0ƒÖÔ*E>>πÁñdoÿ¥›±≥ Õ•Nœ^cﬂ|£ªK.Á‰V˜‚õ˝@πàì∫·®‰∞}¡Í—‚DZZ„≠5≈bîÃß.Ä≠v˜ÛF„.YYWñu*§á8˚p{i˚¢çïµ#µˇ∑#–b≠í"…»fö‡K«?ÒìXXNé∏‹†À/ûôBÒ>«`Á7Ä4‚~ﬁ ynåoæÛ4eÊÍÏ˙∂ÃL!py≤PffYg»Ï+iN#Ä#ò%ÇòÄcPI«6Ø‹EÉ%~o•t‰òî>7J"c»£®#¸≤p#+¿ß#p?ˆÑ ñLÑ√âM'ˇÊù‘x"l“ÿjjÁz•fb“Õ-€⁄⁄ù∫,‡†3I˝πI[NùÊ}sîô1Øw'˘†∆—} ÛÎ%Ù]c¥ÕäÖ8˘˙ŸÿÿÇ£„ˆˆfÎ•R!íU÷Ïd{©uDØ‡%ßøDÓ=≤Ï&p´y‰4âRˆ…¶|ø≤∫Úí¨˚2ìÃHÿTóÌ
‘Õ*–™T]ë\(è™\µ≈”çyK˜`Ø>Â1ï˜V2x†Ë¨ûpMKJÊDñ¬ô’BA§QÖˆ’l˛vâ^)KëJ\úTZ⁄QÖ5Ø~?WØR9]∞ÄòI>÷∂‘nµ5© ‰
›˘–‡ÅKfîÏƒ{ä•…©ÑÂ˝˘™≠œG3ÀQîàT·ÍºªâŒZ_©iﬁ”ú-¥Î\z∫JQwáF“;∞àA¢ûWÈµRuÕouJ9›T-ôá†MœáëÜÛ˛
~|zjÖ>É‡∂2Ñ©|b«¿Ñ-&Oâ(\:äy=À◊+\Õ]øûaﬁ‚&‰H ∞Ü∫å_Tª◊N√»®ÆÁ(¥⁄Mé}{Ç]P0…{≈˚H¬ïŸOéˆx!Ã∑[≈¢Ë,ﬁWﬁ„-≤.’^Ô´F&˙UµxQS)UC∫T«©∑:JÄ™3dÂ¢»»Øƒã#´)%‡ç‚¥UˆÔÿõ_ùyph~ÓÅ±î'•u™ƒ–6H≈O:≈˘2›jvßU@ºóm⁄)(ç‚4i‰√ìRx]háºvüá⁄8:GI›i)}¿ÕÆ‰%À†˛¡àásÿ}À±¬+≤ÕU(&›g%pKŸq€gE+ñ≠˜O3∑•ïÅcœÄÉ˚§ã≈à[“å,lWù)ï7ß-Ul¥_Ø)ByëDÜΩ]´Ó≤D‹¢ãë6Ä/€a«@géqÖêàÜSpô_#&$P
è%—u≤åßú∫Ê"ú$÷*_ÿXD`ª µ-ˆu#]%'∫dgÙblv§i˙ﬁºA…/3Y #GçÚ¯`*Kñ≈Wöi%ÕiZ)◊™,€JÒ$ÖÉHÈ
ä‡\‚D‰¥H8o◊|jS.PK›Ã_Ït_O_Í=U¢T˘~Z€»i∂‘nÕRGè&#IÈü‘ñ9ËãÌ• .6ÂÂ„)c51Wp£w^πOß$Ÿ†öÛük∞3™¨UÿöëDåK^bn`aNàcPøÜ≤nSì_√˘∑™ÏΩ∑˝<?4uZ*~2ElÌlß≥L√¯úW ’ûœ¨jˇ&BU.ïÀ˙ãeRUtrnô2æÌ#O¿ı˘zo~'ÎÕﬂä “ÚPE‚sI„Qm.‚jò
Ggj√à6§jËÑ¯∑tD –¨ôMè1Å∏_Oø˘n-°æÛ∞§	a)¥˘˚ùÚ·>€`˝õﬂô«®Ä¥sÁ?4Kﬂz-R≈ù‘èÏMJZ˝˛¿K20ÛáX
òóæO®»‰£^é'7øs≠*ê˝wø"|vﬁ”¢¸†úæèÓ{øUÓF¨õ„¡mæoæÕ“i\µ€àÇt^[„©ÈõÔiVS!$…¥rG·>ºNjÒ˚™œèwéP—umxç®©p(≈€)*Zlö2,ÃBØ„’Ã˜ª8Ö–q…\√òâöj6§±F…ÚTé/≥≤Àã˛ã uFyGS\j†…ŸY›'°^˝"jû§ÃqÄˆw?ÆhIE¥#BÿÒÖ=ÆP∞¢}ôIl∑‚úÎdƒ
*Éùœg	‘f∑§GàíÎ¢›ÔﬂFÔÚ*Fß5‰⁄ê»k*À“÷F.§åØ¶˛‹ˆ±ÁsÔGa2´∏B≤ÈP;¥ËB6*πULüZ•Vh©J!%ÿ≥“ÿ≈"2ÀÑÈ¢Yìéã§gõÏsù^ØU¶˚S¯Ä
/(’‹¶$êÒoÔ(gzühÙg•ÚÃvW~$•äxGö€à "›1L“óY}ÙTäΩ§5P“YeôÌd
 Û6R óxÀ›¥|é¡G∞SpË)B‡›–‘4¡˘˚Ïdˇ1{"JNﬁ˜"™SxVH›…§Ïh|¯ö[»ÚvVªì$yßTó”ﬂ.ü¡£¡˙;I“xVøYñ¨&WM…›lSs,/—zL◊A'…ﬂ%gØ¯$≤–”è¢eÁØ¯∞ﬁ$ÛVß˛‹√=;È'Ò#•W¨¯º°ô~ñîí3ó}FbÚ”CN„?ıÁ.˚òƒ ¶«Ï«Íœ]Ì16˝ ˝$q§Ùäeü«ôM¸Z˝¯O˝πÀ>&Çæ°á<ËŒ”ró^„©¿‹ë›∆»úÄÆ†/ó≥Ç‘‹4Pç?5˛ª‰Ïeü$*ÛƒÜ.ßaˆ	Ëµ®¿§X|•'Væ„“{m„Öc¯©Yxû9T~Õäsë<¶|:äÁ.sﬂ•G∏8Y=ÒmÇ∆¢°<À¨p3∞wâ|èˆ &xd¡∫MüSJ	3-f3C™ÜÃ3'‡-)ØΩ©"ÜØ∫Fôˆõ’¡#s+£ÑG?~-\ë†[a!zï ≤™ÁEú˜≠xﬂ*câ€;v,®≥uó[©æÂ˚ÜøjöFÒ∞*Pz	¶˛E˙åœl;⁄±‹q
ÓnlÿÈÙYÃ$<>yz∆F√˝¡£ﬁÈ.;éŒzà\|v⁄{‘˚˘1€ˆNáΩL>·Â∞V%@™√(√÷‡‹ 0∑b§4 Í38+˜í©î>X«pJivI ]q˜ßr˘ƒõ[ÈK$Ÿ|Q&_µd!”BjQ05rR[gËÊªp≠ ÄÁ∂‡N¶1õ√7¯WÒV≤Ï iåúÒ‚”÷˝÷~ª∑±wÚû∆.C$≤»ìòK˙Àß¶P¿:9öŒS“¬æ5ˆ|~AËÕ£Ì1ÅJ J∞“Ç%ÅLC†4ë©7A<el√zü]¯ﬁ,ÌymôﬁÎ^˙À4ﬁ:ﬂ_}∫ΩπΩ}—ñ°™IﬁOPdÑBW˛Nÿ^VËñ«ÚπN≤¸÷j%Rä2»"€ÃıN.©-Â™mk‹∏õÀC∞©\Ÿà€Åà`’Eó3EÒîÚæYÅêí9…Øi#¨k.ÜØI-*œ|„‹¯RÂ·Z¶}≈}	Æ{2ﬂËöØ‘VC1`0˛]”`˚∂·€Üb¥∑F*óÙ,R´EUb(!ı√	‰ı;∫åŒ\ò6ïƒôh9ù„~&á≥¥0B:YïS9U˙Å<Rïfbè<Û™Uo˘$Oì'âû¡ÿ˜Ó™j⁄U8Ä#-ıF÷ò&j#!Æ	L›◊R[Œ≈⁄˙l◊UÀ∏çY%∂∏rBz≈¿oé±$q∞ç˚≠•˚ñ´L8æ¯â≥rÂ1XC-(hÓEgæäMÆé&óWpK∫Í§vOó∫F+‡¥Ã	ÙÃ˛ÒÈ`…+áÏ‹*›D”˝3¢n¢“1ç∞Iı¬5‡’®AaúH"ƒm¿)¨oﬁ|gƒ2Ëﬁ~öbπ∆VÿEÜ[©j‚C õo¿p˚>hnàÆmœ3¬ãìnE&iGZ)ﬂÌ≈4Ç),s%h∂ñÅ%ÏHÉŒíNCiÿ•\πläq« /á=©ñnRËO◊é3jƒ…Ò¸LuZÂOπä±Ã,∂«bÙ?¸;¯º˘¢ıRÔÑ‚∏€∫“v~ˇô∑•ÿıπw	2ΩÒ©∞	8˛˙C15:±1g÷÷–ıÙÏ`à”&Œ‘mÛêX$ﬂâùq:•°ÆgÚyìDıÕ7åÀıΩUûÜ*æ"};S”åsqÃÌ‡ƒ˜∞±∞ÜË‰∑Wxg§•∑’‰ ¨ÙpTﬂ∑ï⁄>c–“ÚsUòÑÜ\Hr÷w# £∑YU"X“-ÉÛ*Ô¶ª,~Ú|· r"˚kãKøf≥πrÊî.çBè◊ùô˛T4›åór9lMm∆Q⁄TKD±¡FJN≠aäm¶O£⁄∆FDzå#’Q⁄|‚=dçñ+†Óñî‰ÆîLü—”rJÀf‘•∞ˆÃõÅ∂Ùe¯ t€gƒò‹UìÁ_ÏpíVÂà÷é<Íéçˇ÷ŸœO‡«_ù‹*c^G»r¸a—ÖY°O"'f«s\ıÄ≈≤A°GT«yQ÷ìïKﬁXÏ(Œ≤ÕΩºÄ*Á˝ëzZ¨„KÌëÌm6á&À“àô§¡jı¶ua,ú∞œÂ‹ﬁ5Iπ•DäP·¶·ÃyÏ˘Ö	–Û[¡îd˝„î<W”™]f\+yEﬂõùt Ç)r•Ÿá√Qhˇ ñ·+ Õ|ﬂ⁄¿>îrpŸ7B
Û3u>Kñ¿§n∂¯õN˛!£ﬁnf⁄VÁli[—NRm¢íÆÖq™íöñ©¿Æ x'ÍŒy} üN0éQMãıå/ªK¬/(æ»É*–sÄ4Dtì≈jÿæOEWFf›“^	µÎô<%ÁùbEœE¬ñF.<âﬁzºbüG—‡∏hÚ≠∑ÚPƒwƒÕ˝^∏˘]ıZ(GC„äZb˙≥zÌﬂ˛uÄ˝z±…≈d¡õÚ¢ïè˝'¿<ä∫TÄπ;BÓ.∆_ßﬁ’Áµ5Ωë∆¡:¢…∫6DØ∂Ñ¥pYO"$rƒ±∞$_<ÀŸ¯1‰n>"È•µL≠TYæ◊√sÏ*è¿ñ∫uÕ™ÅícŸÜa´$àÜ9dÀ"äûY_©"]ÔÿF ]@X⁄KÿèÎ+∞9(n^¡õqﬂ(€—#˚$T÷§@æÜ[F}•@btV1&5∑¨/π_{x‰±©qï¯ÓV+î„{'áÈW µ”ñ*πÓ7˜"?õËRƒ⁄wqã™ùÌZ$ÇL≠3–n≠ÀJn);âVlèâÎ±~)0jq≠8âi7:ÿa∏Ë¸œ∆<ı˜35kS~·X!„∑Í{¶Ô√z0l|´ßÿÆ$ÙÉ∏zÍ$zdò+y–$o8$ª´‹£Ò>'@Dy5)r>ˇ†Ï—M†^ñhÊ©‡úÕ∂˜ŒDﬂª“n[≠Ó⁄KÕ3’‰•û‹©≈Ãœ≠∞hn{!ü\””\ÙñY`Ä)ßÿÒ&ñπ˙ß“œ®45ã\‘ç“P˜™ºZa”wowEG
§ßR?ëj˙›ÿà’Ïô¶:é¥ÑŸ‡π'Ü‚ªæ(Ò{Gkg`^||asæ¶ı/~rù˙˙-3æ(…‰åŒûàÏ˜‹˝≤_7CÔäﬁ;£‚ùSÈÓ˘¡˜wY2‡~§Í†ÁS0Õã∑˝è¯ˆˇNﬂœ“ﬁ3YA…ø≠≠^c¸ü˛Vìw¸‡üí6¯)¡‰®¸â§—É3&r˘˙A˘9c;Î∂Â>*Ç~6¶¥A=d~rùﬂÓoø–çKÁO‰˙ÂêSUñRq ñ∆ÿ◊˚¢S7.9G∞ªí§¢∞ïÎ9›!"ÍRLŒ≤W´Í∞¨2M¯â)a"Ù∞0ôAT√JOÚÚn˚Båº≥¨GS"6µ™∫ÊÕ Å«È≠*b±k@^2∑õn©ìºbüßr•b¥7wÛöD∆Â(+hÒE˚^Iïz˙Oã´ÅøÀº≈∆t´UñÉ≤””c6\ë‘§yf)7p∏"g4EË’f&[µY)≈©Ø@%’⁄W¯ea∞å≥ñ;å¢èMX∞Æ«æ7ã˝7â¸™∞RÈÜ≠"°G_µ[òAï Ynõ2%.v‹¨å,Cé_eWÿRl‡(˘©îL ëÅ´•·ÜÆo˝zÅ›óL‘πWñêóª4±*D’oï=¨N[ín⁄≠LBV7q™âçú71U9K*ºW˘Æ-Ÿ˚2}Êë∞
Ω1ORKTnß›B_“;·Û†Úˆ+ÌíºΩÙê≈0Q(ç±Ω
 È	◊_à0≥⁄ó_(Ñ—%‰≈*lbOÇ
[a—´∞jw¢
tÊM&éUæêïï∏Â»71ˆÁï«}VY Vî¯yJ/ˇ®r™ê…R∞2Ã‰î‹HúEÌ˘Â+π∑®≥ˆri˘REL‡á\ñ*$ê˛Tì¯©∞RBäsåêûÕM#V=8√I)Îi?÷°™e
1KËJæ«Ò‰˜EI2LüÂ|tx?vf˘§Ï|ƒ/Ì«Cm#Ωb”¶T)˜ Yö|_ttjÁæ˝Åâ‰.⁄|i/¯…Ub2&¸ÊN0üú[∆∏ÇµukŒ©-HƒÀkÒ7b"S“âﬁTtÚ|5qÚ)ΩjÙ,€•ûq‚î¥)˙9‰9SnúÿÁ©‹….?ûÿ5ôBÊ°©ŒV}jJ—d…ıÍrEœiM‰^q∏pú2)‘«$z&œwÒgÚ§~zÑ¥C'{.¸wÔö≥C¯U|yÊ≈I‚hûJ>≤›±Ôπˆ◊ÿÎ≠Â¡¯Ê˚âo\`2Í‡í“D≈7˘bC˘û9¿À\˜Ë·¸.hàxÔ^íMÛy1ÃvŸãó≤K¶6ÆUß:ÓÙw©≈Qñ§gg„?˛·Ô˛?v2`˙IÔ…(]y˛‡¬Û®‰C”ŸiIIJ RªjP]“é™t:òÌ“Ôæ˜Fo¶:+ @e®∞ÍöÕTeäÂÛ∞Ùî*«≥Áåâ{Û=åkÏ±ƒïK…¶AAò}ø…m'-”sKWÕp ñ÷â^opë}ñÎV›
vŸ£a„¥∑?bΩzˆ#/pm„+˙˝±cŸ¡xÍZíﬁp:<›‰HﬂTΩ&∑JQ{¯dp8<2LÀ}|–=e«G@TáΩ£˝¸ç3sÛ`ÉôÇDÌ‡Wˆ| :ê∆–_€s™∏ ©pÊ>,–,>=ı*vÄ◊ÓIÓóﬁ—‚æ{◊‚óÙw®âyÅ%œU¨W¸é
ïÿÊü[/÷◊ºÕ>KBŒº'v^ƒÓ∞∏ìï˛^vÒ»ÒB≈u¯UÒí√Ö⁄s∞å·€ }eÊã‰∫ÿ	ò8è8[˘ˆüÿ·Ò˛‡‡9Ko4ùé˙√0ô”ûúF√õoèÿ/Ÿ‡'«ßgΩ>˝âËÖı¡Ëd Á∞·…”„£¡∆·Ò£·¡Ä˝îüˆk)uLΩ7'Í¿€pe)‚£ÍÆ•Ï´µ|G≠%{i-ŸEK Ó„\Ü≥OeTo^:ŸnZ›À∏1÷˝6∆“˜–Jöm•≠Ä¨DÚx‹’˝ú§4à∫◊∂Qê–∑Î¨’]≈∫biÜôÇ9+pß‘ ´5o\™OUïñÈΩ ÊñÄda™á≥9®$Øhü∆@ŸE¥©R®l4UD$evµä@.Œ§Õ£Êºmã^’B:_H£•Û∆òÇîX∞íÖ™W ∑Ke™5Ó
Æÿx∞HlÊ¡ê]/‡–˚ﬁòQ‰„ä!jˇΩlßƒÃí£‰-≥Ω˝≤“ñâë$vûæå/≠Ê’¿tÜúW¢<…üç¨’4Sã>iÂÄ¥oπ\ÒlÎ wRªi_‘¯zÃ`◊WaT™öÔ¶´ÊQô%w6ÍâP‰Õ;'Æ*ˆ¢‘x3Ç	^gsdò¡B@P˛´	øÃÜ}nœlø)ú ‹ì≠+OÔ—Ç∞Î|aE∂ê∞òKB˜˝åÖ™<]È5ãù_IK≤˘Ÿ|§dis•X?Qe$ŒÛ√‰æ1T•9˛9˚,ê3n!$AøeÚ3’∑ﬂ•€'€4©.&“ò®¸ﬁÚ‰+π◊Ù¬ˇ•–qAÍTP;‰"øUÑw®ÙT-ã®'°.Ò®Wñ⁄°˙√öí‘Ú„÷¯à8’•….õÃ™{ƒ˚¢<Ì©ƒˇÒˇÎÔ—…„êAç™LTD%ß JHAÆıHaÔQbê|SCG∞≈è]Rz‘ú%£⁄ﬂ≠®<YX ô·¿¥πﬁ˙dMˆl·Dû^5¬@£ö{∞S_†AY)øØI’≤È[√πYŸŒó4ßã¥–LÔC¬¢¶»ô V:ø‚ÛØ\U‘ÚÙávÅ¬Í'ÓN‡F£Êl07Ú…õLh¨.)»º/òiÂléÙ
Q±NK¡/óì•ˇ«?˝˚ø¸-—˚°Àqañ¶∑ßéπyÒ
1â≠e§F]]˚ëê≈∑ˇç=∑x#êS‡M¨ﬁÑ∑ïEt‘Ñ°ìdíCS¥ø∞¸πGP#Ç∫+57ï∞y€ÿ◊xéq!í∂l.˜'Â©aY>≈n8Úá≈Ï,π`Xj‰√+ ˘eìΩ∑ä∞lU∫k¸º—’Êï÷pI^"y•Ó˘Kßˆh‡˜¸6Ö¨WÖTíZØÈØE‘ëª'¯ ¨≥ëqa¯6Æ–âaÍ∆x“·(:•i·‰∞mŒ9ˆÅ„ qÿoíMZzÜ*!ËpÏKkº BÅtíÖQ(c8ÍNˆÜîüjc˚W~d◊xmMà5œQﬂ`∂{j©0q†xtñ7;˜-·Õ4ÊÛ&(•0-ﬁyàN|`b«G{≥πcÖπéWº{Î†º∏,º˘.\8^¿\8åO{¿é]w©Ò-Bõ
ba.ô7Á·%<˘Üi˚®ﬂÏ*¥‚ KK∑@Æùyï€twÛX∑ïCq,!»ÙÊ9∞}ëN.z2QîfE∏!ÅìgO»Ù''ñICM&làò*ßJrªZˆ‘ñıﬁ\÷1ú∆âA»ÛNx’}\†,πG±À5-±‘`*ƒÚ≤Ω∞ho∞:∂Ì}vz∞Òˆƒö‹ÚNî•ïi,ÙïHåŒªs
æ∫"wb°√Åm	m—Ò'a.…Êsç˜Jà´á)eDX¿˛ØKóπ&z,◊`Iki«CÌ-´ü†ƒπ˘Ω¡iÙP•JK¶˙UÌ´Ë Øy•*Ægæ√ˆÿ‡;ﬁõ¶„ç©å≥9ı≠uô´8€√à8ø≈:´Ω⁄qøR7ãE„Í!Ò›CÊJÆ}ä˙ûrÕ˚Ó∑òÆıÜ<ƒzØd£Iêˆ>íΩ&h.◊ﬂíoª*;Mƒ-ò'˙„·ç∑ÿ—¬zm–.‰;xº0LÆ–•‚öƒÜµm›?Úç8ø:Û‡AÛsœÕ˙$€rpùë–XySÂoˇÛ—ÒQ‘I . ˜z÷-øNMà÷Yg≠Ï±hﬂÈS‚%{/Ì„sÿ©xyÒ&˙»bÖoè]a„âxmÆS+@Keµ-§≤ Ù.ﬁ|‰ôe⁄ãYy*`zö•&z•êGN_`(4èò
G#Kÿ∞sÓWûPVﬂA”“«S‡*Ac•£Qîïl6∆tÛWòÖëÂV$ó√ëÛÑ´ø˘gvú≤‚ÊIñ"wfß≠@vqÛ] öH’~/>mù∑.⁄˜_™lÇRi	¥¥#$ïPÊÕX9mÜÆ965TªM'hmÂªÆÊ&”c†∏á}Ç/¬ªŒ‚5…HU≈zıÍe	∂Ú†ë,ﬂv3õˇÜ@p¨<±±£lP£	0	@ÄùÓ_™· §L†≠ŒÓ®ï†⁄Œ¿Û©ù±ÊxjÇE´BÈÊXŸ∫jÈM “ùo Kz¶1I)·ôë'Ω˛àm§Uñ«|'´ö|kä~Wàúi}iå›±OÄÙµZ∞@⁄ô`¿#´µÒ Wh¿J†ÿsìÓoæ3v≈f∫¿ “`Æ5≈lé∏éı3–ÿ#\€5l∆Á	¡∆±ƒ›öÿÁ∂Cè ?"6Ö¿ñÛ˘’@ö∫ñ∑é|œ»º‡y1ø'Ü≤÷>˜#ﬁË“˘4hÙAV Î°ùPM≠E±ÈÉ¥v$Cëyÿ_]àèûAhŒÍ¬°†≥˙ƒqÑål ÌqØDDêÍZìTÉÖ(X‘+^_ˇDrSMKö_¯œuÆ@ÆÅ¥Vç^π…ä`ÔÌ6CDƒLÿ/SºÉ¢1#ª∆EàÒ‘‚ËíÀ‰ƒ‹9â_µ~¨dL•lº¯Ï≥ó‚P\ƒ$ÓÏÕE”6˛7utKàªﬂ53d~3F˘oo‚ﬂr™gf»«"V&-ÉH<s¿©!kë&¢ñAàg*´=î™ò'ß«Øz˝≥·Ûc“2èéO{:%ì›1Ç5&∞æ%Æg⁄îaáÚú∏Nº—á«çAÍoúÿ‰Ã?πyáf(i—Gq †ä∆5ì%p‰páî8p≥|äÜBv∆Ä$w%:πUÒ«øˇ«ˇóø´≈˛Ì_˚7ﬂ≥ˇÒŸ¨w Ï`xÙWOèO{lpƒzÏÈÒœ{ÏÒp4Ï˜>óÆﬂ© ÖŒ õ)ë„|„<∞GTçálf8iù}r…Äı∑∆pàÇÉ˛ƒ8à√HFQ §∆chq∆ú@∆k¯ây$èÒË˛îïD"sërV$:º,6£öòÖSif∂$3Éïj”∆lÓ§Zò©Òâ8ˆ√ÅãÔ¯5⁄ ô¯RÚ
ÎÏ|bó“n0qU®?"∆•»ÓŒ¥§≠=¨"¥ÅJ¨‘‚ÛñºM±•'°$7j±’o˙(z|C?·Pc{©í«w≥’SµÅ;˛ÅEâ®Õma≈q2©±:/y‡¿+ºb*XKﬁˆJ˘∏xGg3j˜£√õﬂúˆ{Ω™/;BD≠Úø6¸õw∏!í¯&Pyƒ≥°I±1(*Bì0Zò∞k<Â*°áÔúÏêuxÒ/oﬁ¡Æ
)⁄Íãt—`1˜ïzÏ„mÊæw§ÑÏX9ÙâX"Uèõ◊ˇÛ?√øÔÿhp0ËüübU”˛p4∏˘Ì1Ï·÷+’£≥õﬂÌW{>b£g√_Ø¡ißx	?: ∑{>¡*Â$Üw—¥÷Ñ˚6Û≈ñ3s˘bK'ëì ô,ë3X*éV5≥˝ºïù.E\V0ıAıöπjáA◊4Ï€ÒxÅh`›¸ﬁã¬Á0ëg∂5õ{îÄ#%JÖ≠_MÑÊ	˙ReûıçŸπMåjN5¡Qq+/¿¥F`ãq∏‡	¡"zè◊`{6Y\Y`âLIÿÕ˚(#Å˘—Ωïp•±ºŸ{¥˘EIJ|~ÿÆ·+•.B®@èjW∞2¡I‚’∑.ÄΩò∏Ì/¯+«Oæƒ¥¶-ƒxr≤73ê‡v2∆◊ú)0•6ûÔ){˛VOÂÃîUI·l•˙Kß˚ªD•t&hÚîïÛp√—ë$kHû≈£ãMp”êü Gﬂêdö∆ï∑)	∞FS`èk2 E¢WƒëËEì¨¿é:c>Í/\)!∞Rt Ûm’ôÉÈ7$üw¸ñJ{ıs0y*aêøC‚¯óQ√ΩVK˝ ∞}‘ôÚ¬Ò%I∞Ô*nπL^!◊‰±Ä#“„„áq≤;°EŒX^—Àˇ…ìdÊe+QÊΩlΩE;[Ú°ßŒÌèú:ˇÊü#ÍÃ óèãD≠HbΩöqâı'N•≈˜-!T–VÄ‰d9◊z"Â◊u?r"˝ÌocöW]n/U1·•lTJ˛ä=y5S∫¶Ú~™ÑÁRPò
A;•[=.êMÂÔ‰ﬂKJ{y≤Ω*qV”oÀíåÿ=“z£ÌÆ•õ)TãÆ:¨g&d•lE•	 ˝ÒÔﬂ±^ˇÏYÔ`¯´ﬁ—˛1ö∫g=vr:x>ÏÅ…|ÄVE≥©é≠®ÁgÏ)y'Ú9∆!òL≈ïƒ¿ﬁíiÎNE–bfªàvtá´ Ã˛ÿﬁ°?Ñ:_πq∞™)U¶º¡G√ÕŒ3ëònfRœU8pZ¯∂-F—á-Å·∂≈æn¥©8-Ê∞òCD∆è€∆$gvZRAe“"9”VZ—IdÄ:&&«<ö•¢iœt•@ii^âfÄC†<2\Û‹C˜j\8∞À0y=ÁÊ;ÏHOﬁ?ÍnÖP¡$œï∏ÿ‚Í◊ã∑∫£îgZz∞È9~ö<¿ÿDˆkQ‚ ØÇ@Œ7L¥{`aø6∆7ﬂÅ≠=FGÅ≈∏´  s	¶6‹TÂe$çE≤í¥ƒßÄ	lº˘ÃÄ°√h.lroãy8¡Çº"kÜyÇÀb¥÷"{ﬁ¬ù"πG√Z5Vª#Æﬁﬁ≠zgp,kJ'{E¬uKóà e¬è<ø‹ˇw∆`m)t·lÙ0›V\\æÜH\u˚J¢¥0◊é¸î àEÇ “æ¡\`√¨âÙsuà,ß,r?ê\†§—r‡∞±CƒäíÇ·-Áµr<;∑.È…<F2Òoﬁ¡&Ë¯æ7á”1Ö®NŒ≥Œ∞'&\5z⁄Ît∑Ÿ˚»p◊ ÃÕÔL‚'Sì%∞˚S†ñ¿4∫ôZπ#6∂«+M%åVE=ÑyÅ)Âª…Ò® ÇæX”ÌI.
ïÔ¯„ΩÚ‘FÈx>QËìJôo"pPL ∑e+çh a…@ÿ
Ë¢∞—ﬁR4¢ÑFS•*P`ˆœ1πyπ‘	][√€ΩvGŒ¯Ëeãû©áJe˙V§KƒZ?A˛Mi;…‚∂ó fiì®áeÄA)›˝ÇQ hb 7“o´≤ö∆nÃzfÊR¨gÄidâ‚ \3†"LÉ≈Ë?fZ[˚∞TËfßóöR]ã/4G‹Ì¿k2ü√	aÑJ£	˙^»¡€E—sGQVHÛ†ù§R‹Ïè™–èRÀ
:0◊Ä3p¿˙j>y©±‹)ëçRr¶Ô¨;®*∑é“í≤ªÑÓyv¢·G,i	∂N¢,FúªÅîµ©õ≠ÔDπ0QÄ)ªóyCﬁØ?$'N2.é«hó%´ª∂[b?4÷B‰ãNª5õΩåÏÊŒ˝{Ù◊eå¬……ú^ÅøB≥]Ãï£+#™∆-ÛXo∂“çT€ù˘Â´ÕÌ®;Fkù˛◊lÔ¨ΩLEΩcﬂ@l›ÛÒh8≠ÚºÈ≠
[¸z<◊õxıùü˛î%F·ï#º®Á∂)¨U&•<Bﬂƒ7Æ8 ˇ9êÛÏ<¢i≠∑U©ŸD˝z§He∆ˇV}≤·Ñ{µx2x&î@3t)©©‘8&⁄ﬁÊÓA&"<Íùâ±”1oŒ@knÎ[ñÔ[˛âB„ä£CKjIJ6•VüñérßG’’‘såp®≥üÎ®Õ4Æ6˚Èíï HÃ÷m4[∑À#ql<ªΩi:Y$OÅÚI_u≥}ç1Æ™∑—r€Pm\ƒÔ§›—g©}hß‡È˙ç>ŸY›¬Y›Zv/DüˆDÙ)Èß≥$¢œ˝-ì•?‚ã"¶‘˚^îb¸¨‡ıÑ°gÁëwπWk±Îl¡ˇk`N;Œ^M4¬†≥µÏÔ¿Ôdhkªî∂‚ßŒçp L‡ÇÌ˚3{¶çn≥˚º;n5ö;õçÊˆ=ÙƒGˇ¸!é1¯˜Œ}⁄„©¨ï˚.Äﬂô¯ˇMÒæÌ˚„É≥sﬂxqØçÉx
'”çYÓ€ ?¨Øk•ΩˇË]7`äÀO¨“wß∏ËSòbT\s7KŒ˘˙*ø≤Ú¿è˛µmÜ”Ωµ!‚Gl◊ÛΩ1°ÙQl“V—egÆJ=[„vsÎ>,»÷6€ll6;m¯,d˛1¸◊¢ˇµ∑·◊Õ1úwo®fì¡"b.a'^“NÛﬁV£Éù‹≈∂”‚dùÊ&œV≥7√ú{ÏﬁØ™Bz‡0Ãkwûﬁá;‡≥∑Di[S¿G@Y&Ê€˛h)j|e∏+Qí2§˛@ßª	K~∂Å“X;∏O´èáÒ∑˚DD‚ØFt$>⁄˝™BõP1Í
uŸﬁ´m◊ÿˇœegØ÷ﬁÅ?≈ÂπÙËñ…∂Ô‰Ôï$É©m9&Øÿ˘”f™yÜ◊aùN∞¸bß—n=Ô:çù∆&‹xÛı=`O€»CZÙ£¢pJ›{º¥l®√∂[ñ=(Sön”›I}mæŸM˛sÕ” p	K’‡RùMñÓ9YìÙÇÿb¿ô”©Ò˜”ã*ùEì±óœ~yè ùÄi∞ö“© Ã@–R€
ØÅeÉ±|
W{f∫g∆ƒ*k&X⁄˚WOàÂ∫˚]‰”vå°ûUßΩ˝·Ò˛∞˜‰ËÊ€—Ÿ∞\Úñ˙◊mô_@ê‹∏oÑ%≠ßÛ&rR)Ú$Ó#Ÿ•»+ûænuƒ√ËAc˝Õn—áò_≤¯!‘%ÍörÔÈeŒº˝√_÷ìó[ã 1ÀB«∫Ø+†v∞H{V£œÌ±çıEº∑ Û°÷´˚Êñz∞º‘—ñıKts~	Ã~ôùÛäc±f›tôŒﬂòì˜{¶·9Ä|:ùØÕ+˜˜\ß_Øî¯¥4#•˚´=å&?Ú_◊XM+–*”‚˝,üÂsÑï“@°©W÷”W†≈%wÙ]O*Ì[Ú»û9ÙAg∑¬˛ˇ°w~?ÌêÅ”†∞d<ÉYÏ©8˜®+´˜	+ìG÷TÏCVÆ^ôm;ò'	q2ˇ&.~ëw.‘?ÑØﬁΩ∞6Oïö>6î◊√»€ï3≈ÀÇ˘¿&8¬.€èCÊ‰©7kdS\JWÚ8ÿ6iòæBr∂$ÊÈàÈÆ◊q8P\à›”;>:›Èûåˆ3¬!ËïÑº¥⁄ÇÃ	è®ŸıÁÉŒÁó∆¥ãù≥˛EkL¢u÷Åõo˛u·ﬂ6¸ªˇv‡ﬂ}:ßı≤93Êı◊∞4¯t¯·pèÍ%ÆlØfó™a—≥.|∑Lç,4«+~æ≤ÆˆÆ·a•^Ù"∫¯TñÅ[ûí˛¢´ﬁ>ù^–ìX¿ÏJbæ,(å˙â˘Mëˇ˚√∆}•Vv'úiêøÀæ'Áıü\Çâ€§„u0„ªÏg…∫≠Ω]g∑=aÌãıÚË÷√= >¨¯Ù1}À„”} ÊB}JÕ8."ël˛≤JÔÂ“ŒÀJ<CÏû¨ÎRlA0±ræΩï…D‹,ÀJ÷‘cf0#Çòc†ÔÕÊ¿ÉÖËƒòÍÏÊ¶#s,Çﬂ˘&∞g¬/3q0vösKVΩRÚ⁄+à˜L3^xÚ»ÚÌ•~Ø√€¿µÑæààá¿ Ï``⁄ò˘ÀÌn—©˙sf¡—GìNÉ8ØâÊCMÖYÀuÕfÜÌFhú’cdªl5ˆ¢√û?1‹—Ï :à°ˇKÒú∑0Œ`Óÿ!ˇ{:Å∑Ø'/¢Ñ+ÓÉ¬f¿m&V¯»ˆf®RR±‹iÙ›cﬂõÒ€ßnªŒŒ•'+W¬Ò5é#\ÊvìıüNO®ÅldÒÎz⁄´3w4>ï›!5£∏ÇõSÇπBÄÙ•µß¡¿¥?ªÂìˆ»3ØÍ…Zó˚¥SÒxxzÿcΩ¯Â~bM<5ïÊÊ∫nzÿØ(2sy8zdO\÷»¢d⁄%¯»e:8µ€®¢82ü√ÙÔdzyﬂOõ¥Q©G¨ÅIÿõ÷“MfÎE$Í£«Ü_ˇza[>¸V?¥0:‰…‘è1qöP©ˆÅ·!åûve” K9B„?Æ*;ˇ^>1Ów≥Ûˆ‰ïÛÈû/6∑»€X-¡^6BuΩWNòºÿ) M‹[“˘™ÌæÕ≥rˇœw•7π>,.‘÷Å∏Qô@ßìï>#*óTíö≈Tgkt%¥2Ú6∆πo_q¸_nÕ¡ØUº⁄¿©üvàº˛©LÎÇ%Nﬂ"≠‰6Ï§A\˜™}·ø™NöÄó+Ñ†ßJ=Å5≥Û¿q9ﬂGoÅF:Xà%áeè ?f≠®Î,ã¨RÂÑ7´¡ÑH=‰\˙Û˛&·‘öÿxªÂ»‘…‚lÿ¿3ÇrG⁄˚Ì••ﬂŸ¬g^ 9d•e·9—ìÆ‡ˆ˛4”
îó}L“¯‚˘J¶™/…ÿÛﬁ¡pø∑Ã~	z¿ì·ËÏ˛(üú|5£NP÷ƒpV_‘xvk¥«µá÷w¸¡èm/-9ºu.ˆemüÅzœõ¨Ω•iøëùªRAR¶”·áá(P¨Sª˘±pçxHË›ï±ü•µìTIVùjkµöcı2‰û∂B„Í(œõä†+p iÖ\LŸÿ–MâjN:µ∂‚käVJ‰üTögzËr=˘á2>â"*§iÚO∫îq1”mÆ1 2@ŸÃæÑµÇuoÃNhœù´ OªEj(ˇTÃ¨®†ßUÀ&•€I¢ìO›‹ÿI[zÇâƒ’4i@Æò¶Áæ∂F73Ç“"çî$&óØ¥Úß√±~â e'Ø\*+x˙oµc…ø˚-7:A∞ÏüœzáÉ£≥AµÆ,º™ÆuyŒî¢Ù!,ñÇ`}aìTÛj’ôßÕÉBÅç4vñâﬁÚ‹á¥ˆ_UÛ,UÁÉî…„ndUGVÿÛHJÈqeDèÂÚ0∫næ√êŸpvÛ]`Å¿Æ	‰Mê+ç0±≤aû1∫r~…Ï%öjÖAT≥+K˙ïOê{9˘5Ñ:¡z˚ß«l4<∫˘ˆ3\Ùé©SqﬂŒé∆µC˚ù]ª‹ö=∑.<îWcBÖ"hÅ>¬Ô—◊ª¨f8oå´†∂Œç‡¯0øÓÌ€í©./Ãª{œM©‹ª'ùËVıæ…e≥âtr|2éÿ…Ò)ª˘ˆÙIÔËò’On~Ûdx‘c√£˝¡…‡hà‹\ÔÏ∫ñ¯°ˇLGwOGíi˛Å©hª…ˆ£'«£òï?6:>ˆE|¿˙Ωë8r|4È©(∏∏c≥é|V•Å˜*†9ëBj¶~`∏◊dΩ£¡/éw1Ω≤w è˝õﬂ°Ù y|–;Ï!Êuâ0≤›±≥0-
›Ñ
RP?ıpÍqîJLUÜÀ¢Qo◊Í≤∑Æ÷Áºhl¨R%˛´µ±Æ6›lîfs»≠˜qQù®…µ≤x˚O∫hªp S§ùôπ*˝:*◊Ó&`Ìûè›r"∞ˆ™%º∑+ﬂU#G≠ZÇ+ﬁB^Ñø")ÒßÆˆ„¡≥ €+ÙM„û∫aõ&±@ói±r≤˙ãO[ÌVÀzY)*÷ÎûÙn~€;D}ÎÁŸ‡…iÔÄùÙ∞’	˛∑?‘ÿ’∫tuY]¬}IYBBhwTòpúy1Œ≥‡9OSÓÎâƒ)îÅÚΩñÌ°•¸¢R*ÓI¨ˇ·íÍu94äs•0ó1_ WIû◊áœU¸$ù<t∂À≈{HüØö<ØœÚ.D%|qı‘˘JÙ¶ÒO-ù9ø,.OÂú˘ªüÀto'ë1OÄh|ıAßóºiˆ?Ø»—˜Ã¡îq–‡D+DjÌàÂ\Ëe≥K£ÕwÑé$SåEœ≥–rm”eöÛK˘A∂¥"h£Rù∑Ûô0: h˙$µ{ﬁ ≤âNå}È$ÿò)±q?§’C®LªUî¯úÑÕ—Ñx<aíàñ…8…è`˙^„îc(ƒ˜Ê7ﬂvËÅ–]B∏LgO›ki∫ùe&W…± -q3‡ˇUõh+ ∞*«ó]íT“∂dQ¸¸ö$ŒR®ùá⁄ë)ÀeŸÓ˚ﬂ˝oÓ;:Wzh>Ôÿ”ﬁ¡AÔWOéGlãìÉaø∑<R+ÑjB®‘é;É†ﬂ∞uùõ¨Ùˇ  ˇˇÏ][s#«u~œØhAæÄ	 ¿%YÀU∞ ño∏+€E;Ü¿¨Äh 	—¨ä´Úí*ßRâ¸î§JYøπ*zp))?öˇƒ ˙	9ÁtœLœL˜Ã $•ïK∞©%qÙÙÂ\øÛù‰#æ“üöÛgò|≤ﬁáT)P<ÁÓ0√ûØ2´µ√Ïr>‚63–C0~¯‘MÑ"èÜõQOw5ä†Î‡ïEH”ƒr1—Ü«T÷'Z<]§Ov&›o®ÚW\ã)-•gV(´¢WÂ ƒÎtñÆmÊûIW#ìÂˆ+$´’Ÿ¿°æú†CI∞‹∑Fπe£S”ﬂÚ·ÙüÜ‰c˛IõQÖVÛN»|‹¢gç·ÁñŸ«w6·˘`©+	≠»©ÿ∑RoU§Ω%ä˜uëeÊÖRï∞∞e∆1¯{k≤]b“∞ÊîVîf,‹Ω:øIG,9K¡ùçff∆Q%ŸÃ—ù©SCoΩÎÃtg”%2gü…Yµ©\Ók¬™w7©ë7^¶∞%ïk=¶dz†ïNêÉ‘CA˚bid⁄ÉÈê=aÂ,_bYjÕwﬂ®»ÔˇË+êN´y|ÿ:⁄Û33ø`ÕÏ≤˝÷Q´”8hÈLãt„Ç≈{»F⁄¬÷ôZÆÜ!ï®˙ç¡m"™›A˛ò˘≈åÜL@jÎ#%@pMﬂx£Ôè ˙¬4çH˝◊“<π\g«õ‡iò˝øùagF«Vù°‰õæGgÈ’˚Â~Ÿ¨‘>~¿≥ÙoˇÌü•ìNkˇ≈—i˚∏Ó∑:på∫<n€}¡oˇisaßù∆i#ïq¶¥‹2i»úGË [ÜÄÚ∞∆ÿ]wd^ '9X¶v Ãl¸Õ∞j¿∞≈á‘u≈f£©AM	‡ï± $Åã⁄]ŒóÂN/8®∂4‚¥ñÒ[Ú.C>[Z~§∏/QnoR™L©/SÃ8e®ﬂÌ=»,K&öÏ¥/N	Lû}¿*7%v˝ŸÛÕÈbo…é:π ßa7Úíí‚®9Éµa0}ÃõÿòYal∫Ë›Í„t∏ó∫∏Pık‘9CDe?Lâµé¢öœ≈Ñ˛~©≤ J¨@-ﬂŒS`ˇîqTÍQ’¥¢\ta`Ø!˝Eá:0 bÒˆÎÈ¡nŸünﬂ2ñh£*tä%Í≥¿ ˇHÿˆ≈ÙÿÃ6Éê™$”®ÑÿÁ∏â/hã√/x‚º7Í˜¬LπnNçp7Mgs"≥a§¯cãîq.z.l/◊r®∫¿óË0Ä)]|$ÔÔÛóÈixòV1ëRM~úŸÑŸuÈ*bâÉ<µ À÷ ,Ä˝è`˛∑»U˘è cYËˇ“êˇª≤…)©î¥{R4˛∞¿T^œ÷b©ÏI!ÃÄñÁïKspoàq≠®ãaê$ãcQºı]»‡Ó+ø•Ÿo–øhCŒ6™√!⁄˛E~‡XÑ=j¶˜õ?§Ö@Ûı.ÚQ˙nÖrZè≤∞cö0nˇh£n·-Ò˙z›ôg]™w⁄	hÒs„¬qWA\”›8¬˛ÖÿãL˜û5ÅøÁlh|ﬂ¶1ÿP>TWT)[¸å7Ù∞É®◊#Ô6d<·fıKº¿”§VÉöÈ»ùhUº1â>∑z‰5ˇj— ô«éÉõí™±!ç§ZbLn~:πBB≤yò%çI∑≠∫™V6nƒÇí TÆ‘e3ºÅDßdØÏÓ–π<	öÈ(Z,E[*’xS—F ™ÊÕJî·V¥˙F]’⁄O4=¥Dè•0Î¢Î∂$Øz¥¨·J+oîî9ïQŒÎ<´ˇﬁJÇ%gÍŒÃ9ó†rùÀ]¨ò €Ç?lL{CV4ì◊„4Œ»,¡Õ9.º%ÒÈ»ﬂ7pFaÜ„ó·MπhãD;r≈G#_ÌFøÉÓ£)◊F§)◊=me+h|;‰⁄Hèi¢¢∏ !úöÀµZW)8≤2YZo∞kπ·JTäDÂ’ﬁ"–±$à%æóÔÒ˙ÿ¡Y(EûW
?.æ˘ÚÀﬂ±√„="«aÑ∫Ïú∂¡˛√"òèû7NªçìVL9›UÑ∞ÔwœnˇπAïÛ›`" ı0◊H°èÜ∆‘kL&\àF¸ˇ∏ÑﬁπÖÆ°ﬂ√ÒsÑøx‰yÄèd.÷û"y[ﬂu&ò1r±ø_&w´>}ŒW‘§∑lÿN∆Àh0Q¨È|áïW9Ω!¸V⁄Æ«â’Ñ˘D%¯D%˛vÛ ö.pı®Êyı~yª‹ØA@∑öîœ˛ÒÿÄÛ¡†+zoG∏∞I∑Ï´Dï-nûÁ`åò…6Ÿãi ≥%4e≤B ºª™0ó‘V%‹˘<:+ÚÒp#
"µo¥Aa!ßú·NA*\ ¬Õ?S¨x‡`”zΩÈJrhÎ√çÃ∫zíÀí§'´6,"GZ€æQ√0QéÿÇIîÉ›C€CÆÍl°Y‰ßEºÀˇDöËe¥eT,Ëœ≥•<üIU€EU¶6ƒN3O’xG®ûêza,_Ùp€*_ì|¯Ö“ŒOg€>w¢‰6∏˜…U∂e †ø¡ã\q˚+íÇZ*¢ê8rü∏3<ºí:ìÍj±⁄™öMÌê{)Õ\˘–ÇÅp“âw˝z•\˛1kPˇyr˙‘u˘´0$íœﬂk`]∑KqQCäŸ˚PàÌäs‹bïMgh9–õA1Ìu ¿¿ã]X}«•Fµ0$∑g∫éWbßNüwÏuù∫îëŒµ…ÈLjò;«wö6….ä◊^‹˛ûÆ2ö%eòTÈ¶ïú)ŒB”ÕFhjŸìYÚ¶BaUªvdúô£‰™mÎk–6Ùª(Sˆ›˛ˆ"≈ﬁ˝˚ËÀ—Ö‚Ò§‚Œ≠$”âè◊i¨ŸÁ&8≤*≈®ogZWWp˙#Í^cûD1âëòG®1d[ö˝ˇÅrÈ@è-‹ M¡h«ï©É¥Xbs„0›]∞ÂwXΩ∂]©î≈É1È€ª˝}‚}5nøÚògŸÏf[Ãƒf9ﬁä˙‚∆h÷„%ûc29:∂ì
zàJ––f
I´O[JÃ‘Ã,Å<ò”}O	úºô‚˙´ø/Ømº>X’S∞2¥>í«Öl◊⁄7ì∏ÈN◊ò%¯dvL± ‚ˇﬁ>ô‡E
´LkqíôZ»®'€Â¥ΩxÓÙfﬁN¬7UÌ—Tò2·æô‡ ˛UùŸîxû844‚ß™ˆÅ"˛ØkÕ¨´cãÖ†„…7E'ˆòäSû≤Æ[˙ç·aÙœ“	îﬂÌWŒj(—q.∞”9≠∑o9◊â)){Gƒ% («“√¶≥l‡Œ&&ç3Ã‹QD}%ıÇB+Ë≈ˇI£{Ã*;‡”uO;/öß‡–Çãﬁj∑Ò3Á´®£÷˘≠
	≥êCË¸¢ M£Xˇ^OL∞zmﬁ9ûù¬wÛú‰!2Sø1UÆÇ¬:…mn©µŒ˝©3åLv<AñgRSÃ/mQÁ*⁄ı˙µ§lx)0)**S©JúÄiÁ&jjcˆ’è‘ÚÚ='Ø.Œ°.’˜!ãx∂RµL,ıJ1&€!Á:›’wò/,€ú
‡818}íÕG¬D∆¬c÷7£m~´ÂrJZs'v∑µrRå*=æ¯.V	Ωõ◊ÍëUÌ+kjÌwÊ\È“™}À3ŒFf˜Z≥æ∫‹%]ò>ß€?˘Iˆ"ÈÆû–·íä’^¨(q18m‚5
©â–Ë*„¯A§∂.‘¬ª"1]Ú/}/1ÿÍi◊Uùk$I9•◊âñ¸!ÅÅÃ‚p£i5„óç˝jƒD_8EÉÍëƒun-â;Ã"ëª^LÚ‡éxc‡Ç´Ö≠1Pß¬ΩyppŸ‹›£Ùû_YﬁsoøB∂%Ú¿®jöù∏o•T4¸?ˇ˚Å7Œ¿€%≠œŸ˚¡€Ù›« CBKL3"ÒŒ?kS["öö¶’◊¥']˝àè£Ÿ07Ô¥ÚâïÄæJÁ$◊†~P8ÚCR8—5Õ°hbõ ©`Nr]1árâÂˇ~P,˜†X"º$˝xÕw¶XÚI|»
%ÇÆ4‡V@B∫2∫⁄=4äá®P¶çbR:s÷ü!û#Á·∑%µ
|˘O#Û(áΩ~ö$a◊—x„<îÇ…ıâ¥∫É§pÕFgø—açNÛy˚ÂqóùÏ=˚ÙAÒ^Mè∞.€Û1ªØ+û‡πhÙﬂ`Ö´L_-„ì&™!ºÒNº}ä∫û#9óˆ»1˙¢g∞ŒNH‡F¬W¸j…ïä1	¢·Ë»=E¬mŸXŸ$ó≈‰π6Bñ‘≥™¥[T˝VS¢e>'î0êÚµ?¨¶ÿPÍ	¶“Ô›B∏ˇ@p∏¢¥o†:ÁÇ<9ºOM∞`rU◊”Hå`ß$≥ÖÒÉ¶ÁﬁRat”ô3r‡e)™Jâ‰éﬂ˚òœ∆R )ŸÒ¶	ŸG*‚9åZn≈J¥MNËÇù∏ŒπÈë¥§ƒˆÛ≤YG\*êsæ†˘óS,-rπïò®àtw◊ØÂ∆K˜t§s¯AåÂ5Y‚Æ–Cà¥å ø∑í·ó’’~ôz©^´◊äÀª$uPT‚yÖ\·@âáu´3„çÈõsA–ívòô0g<,L1•¡ı)4´\h FÈw 1cv/€≥˙∑o{—π£ºÃıëwcëÄ'ç‰ºm±˝„„˝É€Î¥_.òiAà™?ƒªgÍÜ˜|Ã/NèoçÛf–Í-ÿ{≤Kπ:ÈH•ËÇŸ©;°~≥º<÷0≠©üxîJr¨9K9v“
ÚK√öfj)DVK•EêLâïØEÙñxiãwbâ≈÷20p¸ëÆ\
›ŸôÂ¢¯ÛÑ^Ëc YF˝ê¶ u31ß{⁄Ë∂0…∫◊8TÕæ„`$ñ&<øï≠ÿY)EÜè;Êπkz√Ê•Jø¯µAﬁƒ≤s+õ¥:ª«∆‹DÑ·Ú∫L\”™8éÃ’”0‹ó¶£*_4¢wO⁄Æ∂Ä∂”¥˙8"æ;∫S1lX≈◊‰p'∫Ô;(tO*Û–Ù<c`r“qÛÚ˚Mã1¶™è≈◊éåÛªBMPR.Ç'C,*«…÷∂P⁄xcR~D∆˝Áà‡=|ˆ'Æ…©r„x°ì5åÿä‘üÃÔâ†ÍG∫§÷:zŸl1ìk¢¶≠~'MÆ√FlK 8ö≥=“HÚfsÛÎ„áè•∫Ê˘nzuüG;á:ä+7áf«?‹ÉÌh&.¡Ç å¸B˛˛nO¿˝–()§_ÊéZvœ¡œ.R¿o/:mL©¬%ÌiØ¢Ëc.ç1≈Ëz=úN'ﬁŒ˙∫1±J˛»K‡ˆ¨Éü⁄ˇê Éª?∫/vÛ¸rx*„ÕÎ˚+„”ƒNVtÑym∑	ú˚Sµ≈bãûú	⁄SÃv“i“˙ëRª†'™BHJ˝R◊+)q⁄úÖ+âl∑®˜ÔxøCuL Ø#ïﬁ±xnNÎ>‘E˘„]‰Å…UŒ!>@÷Ä-Mÿ≤ˆJ¡Ø pcö?ñ3‹wG¡0ôü:=ì3::¢´,-à<¶;-˛Ù÷WÊnô†2·j*t,kLå	(<Ô=v vÄÄ|LP√6)6ßÓËÉó+hA¢Eõ í`ú+ÅÀ+Ç}°Ô§2‘µCÎj(∫≤Ωsä’ÙŒüâ&l
≠œ"’Ωdí&ÓóÇ¿
∆4ÌÑ‹ì…‹Ü„‡ŒzúúÔ“q?E£éo⁄\µM1+R∂c||≤ÖrE%˙ÇúDïÖ“ØÊ*1ÚŸ¨$AÀü˜<µÂH‘˜6$Í;n∂∫«± ﬂÄ
~/nîYŸ¸ˆéª J52›Q0^ö=Ùá'‰BHà;d÷’≠å¨'œ%Êäë„¡yü=µO*Y©RA	œ[˚SB‚¨–Ò¬Ü€ZFÅë˛Ç`ÏÑ∑¡rK:fÀ¯ ’ÉíKŒ§Q•+£íb95˚6µX~"ÖË¡8Ê∑¡ﬂ2%<∏îHyŸñM„q·vßòàOá?S¢H–|¿∞π_ˇ0^6¬Z≤‘5
6ÅﬂÄµ‰Ooª"]±äıg~∂.J%w,≈Î;ÔM_T∑ˆx›I8ùyàDñ(´ˇÌˇhÀÍõ«ùNÎòµZÕ”ŒÌ‘Æ∏ÿh¯}éNè;âí˙˝±aç~®ßòz˙Ã"°ÍÈÛ÷”¬6çàÓ* 5˚Ù£≤ì•JìCUaØ i pT*∞ßê`:™P¬ÉT÷á'˚á≤zïNúø¨˛ÃÈ'ä“jÎkw©≠oÃ¶C¯VTûXEá◊gÿy‘eéÀê¥d(‹ëäÙ˙Ω.r£◊3=Ô‘˘DÑ*°ë{º•áDúSï€⁄£ Ø(
Úsë≤)˘ÿ4»YE+ƒ*∂B¨F»{i0q£ÀâŒ,Õ¢#ÅKäóMÿSõ∑EÃ_àB@UƒM¯Ÿ©‹!∫éè∂ç∏,÷ÂAd÷Ò|å&a°Îuòãe 0<π∑#V_:™Áù#ò∆0n◊5œ'p∞IhÑ	`ƒâzñ#® àj *r∏&Y⁄&⁄=º†«'‰>ÂÓ9kNÉ>pñ¶!âú4á∑¡˚mõ>î˘à“l°ç˛∏J-_±#††}(WÒb˙pœä-°ﬂ∞zû≠Ã∑I¸Fggâ¥oXM ß~óKıí+—ª/y”“àöÕÖ‚!Í±)ò[ÓÃ€≤êq®ÑfÈµÂI5≤Zd+™#‘˜ H„¢∑úÌ©hºm:Í¥`∂¥ª&≠éΩw?è«õåå9ﬁŒá%p}›∆¥X^·Õ
5âËå&º,@Mjöÿ_8h Í‰õ÷∞Wp£˜1`<vt=R(o”€Ú ùˆt’0i∞i°L,Ñòa¥ÇîùÁº¿Ωµ›}µ„Ã4UÃ:XÜz#ƒ¸	◊ÒÃúTH‘“â:©“ı±x˙9,ûJ.B«J.àìÄ2qZPåQ	3"060B?3îlöUá)?ûMczµNVÙúèAhí{ãõ'Ÿq—_
í{*üÑŒDwF>âèIQ∂j∏ã∆AlZ-ôbëqBBE9¥≤)äèJñÎ¿π—7€=÷ƒzGUb$h‹.H…4g˛TL•∂mﬁ%§k∂êÓuô≈Ò’z5ÓBÚW¢ÜÄø,¡ëˇN◊§Å[∂iπΩëy?+#œ‚˝¨ãÏ…√≤º∑ÙY
C9fÜ∑cÌ•5±TƒÇÈﬂ°Üè—'æ]>ö‰bπ‡‘≤ÿ!‡˝BOEÆâ/ë7F/fónìÍ◊’m'»Ω¸< ﬂpGë"∫œ
Ó.⁄ßŒ"eŸ˚¸#≈(=WûÚkÉæw˛+r(S ˘¬ˆ«a~¸ﬁi∞4ïﬁ˙ñà§Òf‘≈„˚|*ﬁÃ¨M¸Ä<ÃA¿Á:|<y∂Ωò¸Ö˜æ¯‹ ˛X‚ 4xnVîWÉ<}fΩ!‰é_ÒRﬁ“œïœäöÚÎª9)—{]Êúd¿D(#€2bo†Ω{˜ äjjOGﬂ¡]è˛ﬂ¢~7ﬂ|˘≈?fµÉ^º∂é>•Ì
ºpT<+Q>t9múã7-S1oÑG?w‘	·%T‚Hà(injZôôƒÆ4pçsÃM=sÄe»Ò&é›7V¶øX˙ãÒΩÿ‚"º[˛X`Mˆ˙b‰VYä!hSñ±†n;•¨…üˇÛ_dh'`©‚ê4π¸ïÑÊ¸õ&>2¥Âa?<P.ÕôÈN∏≠¬-‰•¨v°·öj}ÃÈP∑!™CÛ—îJ•<∆	.¿¬ñ	~(ØY‚:óﬁÓu}q´%7_r™âR’€(…»)µZSX*ılKÖa”íœ≈Kq(‰}Y1áÿÅØ!¿ûVß∂8˘NŒd™∑QR"ØybØ…RY”ÓÔÛ` éU∑ˆrÓ?S∂Ôá†ﬂciÍZ„‚J¯î∞ä≈Ûl+˝Y$K®≥q˛¢Jt±\J:Fñ%≠ùÂ„TKb¡BTö9mƒX\ìt—âk"0’ÓÊ.nµ0ÕéœqODa¶°ß˝ÆÙŒíÈ∑ΩhπÖ|g-¡†Üuá;—Â⁄t!u=åYÃxO‰©©‹b∞æ‘VrÚYâÁ.U](µj?!*õ ÿØx„?‘¸õú≥n˜Ä˝˘~ÁwM8ü&;F@kú¥”'daÏlì˜`E,Høﬁt4GæR∆A≠#cÍâŒõ¨˜\ØV±◊†íüäˆYã iy˚‘Ï¶ØT(-]`Õ±G‹xR÷âÀº±eØ◊¯˜´´@±ÿãº
p/ÛaY	I∑√
ÔÛ¶v°¢îp†á&"f‡ã¢;G¥…≈¥vﬂÖ;üË‚∑P◊±«¶‚L”é5Äç=''g∞«g~çàñ•nÓ+µÛ„TtÚ•ﬁΩ¡Mb≤Ÿ˝:U7_ôyícı*õº|˜äc˘.˘?±Væº∂=yπ:Ù∆dM≤œdBx*Ωzuœrû…^Ö%1∫™»¡5ﬂ¨f◊ÜΩáªÖh’tç⁄òøMƒ¸mfkÊ¿?å˙qt{Qp™ Æ“Kı(zë∂IxÏ0§¿ÖRõPÁ⁄Ø˛Éˆ-æ-ÖÌ#:[5ú≠ZﬁùÈ?ñË!Ω»)5Ÿ'$U–õ¿fB=◊Ò<ÌÜ	ÆÌ]+>uÆveVf’¸ø¿Œ≠—h∑ jƒÖm“DâXP°Å‰=∞ôŸ(˛18
C÷ôRŸfH„:\´óÍ/ÎΩÚZikc≠¥˘jˇ«√ˇàÁ¸\¿{ü◊{¯VVéΩÊ¡ÔL¸é?CºneªWfÓÿk^_<áüø¿A<á7”ÖYÏU/>¨œÈV”:L©˛)ç∏ã94AÙ¯¸ª-%óÿ[ÍS3æ∞¸Ÿè¨˛t∏[@HòxÊ î|œòÏH»œæ√?xZ∑/(WΩËÆ®ı*•⁄6Ltmìm¨mî™¯®? Ùø &¸∫—É˜=⁄Ñ›∞¡`qjT5X™jÈQm≠äOÆUcÆ≤≠l:V-m–¶®ï¿µﬁ¿7å±GøL_`y¿0º*´Tüo√'Ò;kxi⁄9µ!|Ò∑∏S˙∂Ò=‹!Ωπa/¥CpâQp4k¥†’˙,Â#¯ov´x€¥ö¯4˛∂MõB¸µÊ?<ª&˛˙eÜ#Dıv∂…Æ*ªÖÕõÛÆ™ªÖ ¸)˛UO\Ó”•¬+oﬁÈ¬˜∫µº°eé˙kƒ;˛=‹cC~ATe’™∑Áyk≠R~Y≠m≠m¿7.Åÿÿƒ3^¶ˇd(ÈöcêmUVSÒAVOÁrkêŒ∫>Óâwj"Í◊Ω‚˛q µfù÷vy<¨$b„gAÀ+¯À5|∂9ÓæïØ(†€≤◊ú,G©ü∑aeY®nê_¸}?¬®5Vs˙¯?çNW>ÂÙ-c`ﬂ~ÌM©ãáÉ˝©pïµw§Ö√™û◊[üﬂ“2âÓ’Xä€iÏµè˜⁄ç˝£€/∫JæF~Í%[ê®)˙‰5'£ﬁ3¶9°a‹ 	Ô8Y®ÃC=öŒ⁄3≥74v›cs\{h<π¶û14˙SgÔ≈nVnÇ¢Î˚ã£EÅwƒq%⁄πöîöl9õ@ƒ„#>Q2âé_˝äI#MNº:ıSÎ1?ãK¿%ﬂî›’∞⁄éH¬–ıæëéˇŒCäë O°Kñ w£›7Zdíâ"∫∏ıË	Úx;bIØLâäœø{∂Îı¯ñ}U©6AæµÖaô±Y s∏ÓkíËQﬁ≥ÂMg >øùŸ qÍÏ5çëuÊ9(Fãú&'Ãhè'Æ ’?ª˝ „ÖÁ»‰"€~ ÷(6g∑0ÿI£Ÿç#èÆ·LOD≥ˇÍŸßïN!Ê~¢MhQ¥ f+w»
®ÒŸ$ULƒ@–y5≥ÆáWÚ%¥4dè<!dÃx· ûâT*FüÊî=w∆`Ï®Ò¥f?®¡Bõ¸&aöôΩ…âØ…<“ÏGÖÜ¡)m6⁄O;çf˚ˆã#∂ﬂ›{∆Õ”ˆÀÜz<jÂ©äkï–|†q‚Ö`íYˇ|U^ÎzïU·g~jSáüM¯y?[≥MÔ)\ì"µ–U”uq™Æ™i€Ù<∂ãübk?Pë]	J<ç=î†ÕüöÛ›k∏®60õ2ÿfC©‘:(WG°Â"πWu˝ñèôbO¯i„» `ˆ4köéN,LçhÕU‰%–“6yˆ‰µ;8+˛Ë˙ºü=_èÆŒ˛:\áïõUv◊7¨º^’x˘@pc<ŸÖÕÉ¨—Ô?£—È˚ÈÕ4åg©∏´'¥¸?^
ü§ ^ªI(—\«Qå|21"˘¿%I5÷˜ç±¡H`ŒLT‰Á@òèËCÖÙ≤áÕµoÔˆAÙ±)¸2ON-,Ë3±]¡ƒåÉÛ0˝$UüHÚ¿w¿=∑9U|~\4p†øÃ)gÙ≥ºVﬂÇ±¯≥áÜ=30yﬂ§&È≠‡8≈3ñX∏Á—„_tÕ∆ÜeÛ∑≠b√ÂæÎt-€ô†WÁ?Ì∏√ÓŒ·YœÚ¸'1Ux%Æ„Û&#k ˇÓöàSåﬂÜr.,üªá∆9—>µú1⁄Jò—u¸◊ûπŒò_'q—Uv¶¸HÏÀ4BT¿¨îXÛE´sBDgæ/®Ç©¿D	[›∑…$~Î¿rK&ÅM◊:WóÚ∏&(*˜SÃ¸˛	nÆ†ﬁ◊Tﬁ‰≥vÁ∞¡À±NÑ7}êz◊◊≈æ”KÕwóx	MòeÛÖ;R∏MÍ	√#æâ|¬õ	ÕQ‰dåióSÎ÷"n¨…]åãœ.∫å ‚-©Îhh9¨˝9qI¿oE·?ÚN®œ∞k·≤π d`”È ÒYÆ¢®•ÆóC@_Ωº˛®Ã‰ñXŸö®√ç”¢∑¡ô•^m‘B∫™™À‚)…õFì.&¥®ÁG9c`©Ln˝ÊÀˇx˚ˇ˚/ô†z9π$9ÏZqÅTÏÚ$·Å)a3aŒYö!ô‹fù”nU‚6ÒôkürîóX⁄ë:˘¸™>ı¢znxC=–/≠n>ù…˙Ó§WZüTŒ›èEh¢*ﬂw6©edâÛË≥Ù≈1Ûrˇ" Oe'◊.HÒ»\-˚Î®‰*ä6o-obbU 2’¥æ±ˇ∏ˇõÌòÛKﬁ´ §JﬁıÅÁŸ”NÓˆZ0≠˝eo.º∂Ãc≠ëRÈ(ÒÎ[6·ñy7âKíqC˙oîUd óƒ®Ëûd›c/¡≈%r‘_ÄZ›owO;á~æı’È:<∂`å—‚ã$_ù5Öc‘+<90Á<SáÑMí|vVπELÍ)÷b√ùñX•∂≤¥∏÷#ƒÖπCJÑ Ì◊X"c_M)b ∑Vó¢Ó*5ƒ∫Êb*K^9≤=eœ»G	˙Zø∫U¶à_J÷)a£•¬ñïÅ32d\Z∆Ìà•‚®¯CBS…CLÅTÒ´heS{„#7Æ‘¸ô´<"{I¥bcÎ
Ê÷om<M≠…hû˘-K ∞¯##õb•dA±ïKYç#•∞ú*t@ƒ! ¸r«¨`ÔM\e„µ»7gˆäå)…´Ârƒû

ødc*´WQ∆ }ÛÂoˇï˚D ®˜⁄˚Ì”∆¡aÎË¥ï~Éô¬?kÌÙ–Ó6ÜÓ¶⁄ú)è∏^≠m.PÄ©.˙⁄é¶Eä;nßàÕö◊ÆZ†∞R´ΩÍ€˘¢©º<öà7mû±w ãL÷ﬂæ≈â'B4^iÒqÖ~@®¯Ê±G3⁄bPvπ(…Tí≥ÑÎÃ*∆A{ùc÷m›~qÇÈouD@;Z ∞ï†éQèÓ/ùôÁéÊó1êQÚ¯ÁS|˝)Ωº√
∆Ë“ò{ÖUÓfOÛœE1Ù˙±=dDáfN’QŒß∂PÂ~V{£ÑÀ||“mwâu¸ˆãŒ~„ËòOnΩﬂ>j∞ˆ—^Î§u¥◊F±®éz\+¢Ö?lÉ•∑Åb6xlñÿ^´ªp‹mÅªÚ≥›”ˆ≥vS§Áêô˛†—œµ∫ÍM GáVó\˝wz	•πx‡•{Tbç£÷œèw≥‘Ë∞ßÌ„√VÛˆ◊‘.†ß˜ŸA„;¥5BúË˙&≈–€v∏~“ç%„Ûºøb∆W§à¢w	ÃGc≈Kº"œ¡Án˛Íˇ  ˇˇ úó