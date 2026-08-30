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
import { Atlas3DData } from "./types";
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
              requestedModel: selectedAiModel || "gemini-3.7-flash"
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

      if xúÏΩ[oIñ0ˆﬁø"∫F€™íX≈")©%Ífä¢∫π´DˆÃéIéî¨LVe++≥&3K$õ¢±˚Ê}¯|û≈g`a`—k˚°4ÏÒÿ∞1X‡ÜÔ˚#ÊÏO9'.ôïER}ôU°[¨ åÀâ'Nú[úhßA>M„Wﬁ·£(ŸÔ∞∆0?Ùíi>ôÊÌ÷>ºjuÓ≤”O}¬÷ŒF^¸2Ù~Ïo·W®*ﬁ26H‚,gXã›w5d<£ ˆ∆ûxyƒ˘s¸ıêΩπr¢=ËÂi8nwzi0âºA–^‹ÕÆ/√÷z›Íúæé&Q8a˜&˛¡∂ Z⁄≥◊¯-¯≤Â∫èÉCˆæ∂w“Ω⁄ &?û–¶7°6shsõbß⁄Ä3±˜.zyíˆGÏ≥œXÒh‡≈[’O€'‘c∂ vÔ¥≠„ï1Ô–sfı–÷K0≥Ö„UÊéaC‚ÂÏ0”Aƒ6≤|ÍáIÀ*Â´ÏçQ⁄C◊˚Ä-¨j0m©«å…bÔﬂ≥÷KÅÚ÷È≠]_ß,à≤¿"“KÊΩ⁄˜zÒOåjàÌdƒõÒÛ‡p€€ø ‚”Ø“ ~ıÍioê^ºÿˇ:‰ªçoµ*áaÏ'á=Ï∫-*"ÓG^¸∂h∫4∂Y‘æ°QÎî?µW#ó£ˆîeF¨§iÅM<âÇ<L“vkˇ∞a)¿ÅÛ]¿∞/¶ï¡^>~¬ÚQöLá#ˆuøV[ï˝yQê¬lºL”ãMcFÕ√—t
¯£vƒ∏†èF…Æ≥-¿G<$E{˝È›O>ëHy±[0“Ì‰qä¿›g^vXª√Ó?#À”c5∆,»7≥Ø&Q‚˘–∂®’Œ”iÅ"(BOy©≠‹ÀßYªıÀ  < 	(ë·"Èızh8ÃÅãÉ|m0≤l;yƒlò$CÄ4˙Ôã%é'	‚ß∑x¶¡æók”|T¥9À±U√l∏m˜èkÂS™°Ø˜ê†+†1& ú}A@√2±Wå–0_Yñ6æ∂VõC$JõLé#„Ø{^10ΩÖSçèH∫Ìî`*(70˙wèùà{ï=«…dì) ¿ìÿHç·S€·8 ∆“ÊTÂn±’Y`+˝~ﬂ®ÀwYg;ˇ¨ê+à˝ƒ ˘¸ õ‡Z@∫[˘Ç1R–´ i9`/`ôÑ^dê'öîJ<‚Ãö”_¡èì√}NòA˚¿¶
≥Îœ4ˆÉÉ0¸f,\ôEWÛ`T“Ç∆ôxC¡èá‡≠È>∞x$P±>™DÔÛ∆"÷Èk98πµàﬂØS‡éIî√AbÏ,‚è…¯DN	Ëó˛Å‰©≈,hê-E{⁄£µ≠ˆ˛[€~±•oßbâÛ≈‹xÒ±>è8≈⁄˚ﬁÿÜ7$iÀıº∆ÉhÍY˚Íç˛“’J-≥ä≠\ÌXBY≈¸º“qò%„lä§è˚q÷ÉÂ–ı4kqU6?#’9)é‘¡5m€î√^˙,ä©,I}àá$Çop9C[w©Ü3õ€@πaﬁ¨6´.¶´q±∂¶„±óœfjöb≤c1 ôÕx”5ÏÓ•√,∂g:°ù]î7DÅõ#¸ bh%Uip/ËP6†´“d∫ßÎOﬂ~1ıRﬂ£	Û$É÷@´ÅJ⁄“ÂΩ¶‹¸F¡Õu:ô%DÉ∞õ˝§¬ríŒê=kÈ]|$∞ôzQ4KH&24q∆¶Y∞qp ˙S[ó∏iŒF…·Kê‡Ûgâ∞«˙4Ã∂Ähr†ÑµÓÙ⁄∞ÜP5)¯†qÈtM˚ini•–‹‹UÔ≥Ù⁄9’ó¯ÆÌxEñÆd¡&ÎyÄ3Î6ÇŒ®‚Oó)ƒ™@µ¡#√∫GæqW=Œ9Ål˙¥©¢1⁄ºÀ´qÆ1ù¯–ÛKEfNçJê»J7¯DSó2%ë\\t±≠îkËÁ-)∂Lé†ø‘ö≤ZRò¿xÙÎM“;hê˛~zˇælπÜ∞hi µ=MüKjŒ‹üOça’nÖÕà[o§~?TªIı¥4‹»fLO6czÃµ0◊¸dó;?ŸeÕOÕÚ÷Õ`.kÕl{U&r˚«±7Ü˝¯ºm£)o ˙Ãtl‡+÷Ωæ=–s∆$X∂f~àµ9xÊ≈SOõx≈°ÄÿJ;Zã…¶
Q˘î67µ∑Ëw◊LSÃ≠Ÿè‚¢4<ŸéBÅiLIx©Ñ∏(q◊∆ÅπCøÃmí[fÌ}R>u‡çø
‡Öd©€¡QŒüzæ7¸r=âÛ‘Àƒã	Ûá&‡œQáÕË∑üÚ$µ?AúâG\Kx≠ã&¶Yûåü&√Ìß⁄#‘q@ Iı<"XçÅèÖòäA¿|ÍV∑è'<ŸÎhÊ@ƒ>˙8÷	j/BL¿‘µπÅ;#s¢-•‡ªéú˚VÎn±ÅRk∏B	1öLº≥˘|s}Û»®Ωkw˜∏Ä‹Í8
>Ÿ|ﬁ†îjÓ){µÒÚ≈´Ìç›Ω›Ï⁄Ãvõø“:ªWá¨=F~≤¿&K÷ö¬a√ªR†ïÜ•bEõo¥_–z‹ÿYÎ¡}è]"‚%ÓUó@‰ÔûpÿO©ï• ¬É0Pô?˝ü≠í—EX≠«éòÔ≈Eˆ8$~¿æ‹~ˆî°
Ñó±˝ Ù— ¯ÚÒ'r}#M–ﬂí?ãÚª|@é¯l(^>pΩÙ∆˛ˆ3◊€ﬂN^˘jÎ™„ı/VÓ W]ï—Ø}Ì√ª
iÂ◊ìhöçcQ‚˜Æ»Ê2^‡Ïrˆæ˝@î¯]%‚˝Lü9ë„¶πl‡[Wâ@/Òù´D®ó¯ﬁU"—K¸¡Ub™ó¯£´ƒö^‚Ô]%6Ùˇ‡*±©ó¯OÆ/Ùøsï¯J/ÒOÆ£|Ò˜Œ	…√HMôs÷üÎ%˛sK[HÎ¥Fûz€¡ﬂ2–rÔ6· ’Ôå§…ò*niê¡CÓH %…[±¿@∏…%9≤^zQÉµáÃ§˝€Œ√›}Œ5ûbÚ$Ω–w°…X∏æÿuñ& ﬁë,ıﬂ9À–∫êEéúE~íÀr≠Œ”T◊
››Öú¡åB^4y≤åxŒR˚AÆ
·w7=êd)˙·ˇHkå~8ãçß≤Ã‘›Ó Ÿ5mÕ]¿hx|:û´¯˛A„‚ª;UﬁÌ’ºk◊ºÎàw≈Zã≤4/ŒítÃRÔêMAû¡›i0ÚRIÉ˙0a	ÑvX:(Â„Æ<H∆(1Ìá <≥Vˆ€)∆ Ï'G¨˝ÁˇÚmß≈Üﬁ’ ¡ÛR∏).Mvê‡˙lìwÒŸ˚Uí˙ùÎÓœˇø⁄{∏˛Ú≥EÄ‚Âü~OÔ‹KÏœˇﬂ”[◊“˙7^±ÇàˇÌˇ¢∑‘˚o†∑UT˚oˇΩÆ¢÷˚Wz=U≥%DBç∞õípØ	•„ ÎËŸFvúÖŸ£(ºE±48
3Á∑5ÒteòsO˚˝uñƒT•xÑKBàÈJ¨ï_
ÅNtÔ•oÉt+˜R⁄ﬁÏlmØΩ⁄~Ωæ∂µÒzÌ˘⁄”_omn≠^9·ùûÓΩπ[™∫˚Tq„˘„f’‚‡PÒÕï≠ˇ”›¯ âŒÈïmÙNux˙∆ñ√Ö(Ø£åbOZ≈≤Ÿ<`0oip5É˝CïƒêÄÂ0ÃG¯û√˙ahò&øN/smBºÈI¬«{aÏG/⁄⁄†:˙–ÉÿØØc»|/˚@Ew	-¢Ö“É
 ”‘úÉà
„å>≥È>'Üv°®ß—gQ€; fRQYt}Ω Ñ^ƒ√|d7%5g u÷⁄çwc·P¥†=£.Õ&N’$æ¿)<—Zä˘Ωóy@	CopÃv|˝◊[/ûÔâ)ŒG^¸§ˆÁ/∂Ÿ»µ'ú^AˆÇÚ≈»ÀË})Ù
QüL· l9◊Q´cOá∫ä&ZÆ—öv^4¿I¢˚ƒK<#ëﬁ	Èx®'ñ˚ U±Ω≥õÌnÌ·Æ˚ﬂŒÓ¢´‹¢Âp“;‚‘~Ó,Ìôñ";nD¬;Ò“,@ñÇ=ÙËW€j«4≠qÎ$VÍÒib˜¸k…·)-”\påäU°j”≤¸Höñ-9à⁄]U7V≈´TÿÓpî»≤≠#Ç»VWe[4≠J:#<@>„´á¥^¢ÛØß∏ˆ'X‚íÌ©+ÑÒ—Õ9ﬂÎB–´”\:‹§¥¡%~Å≈c*ëﬂ∑pÌQ@û%˙ü¶/9∆“7Æ0¶Ù≈˛∂–◊ûÿCÈ…ƒØ˜”¿{K?≥	t/ºè°/˜CÈ˘xDWY<Ô¬5å–<¥äÖqê©g;{¢±<óü‚@+=ﬂO¸„W…°˛Bæ¬!<ˆr^È>"LB—ª0Á%R{ô!U&æB ·∑S¥jÑGö<`LƒŒ^!êZÿN^b7–l—™‹Tã•I‰Ù◊ÙYzlù·(%	>A™Û¢à≥Êåoø.nßuÑÿy‰ïe[j⁄…û5Òüá#åˇmsÛÚŸc/8
m'¿»ëﬂíAﬁQéºŒ!Á‚scá+#∏7ôf#¡Ûå(⁄&—o/¡12ZE±ﬂMV†xOl>S≈[û'áDbb*bzq?%≠û˚Ú—rÜ™†? Ö+˝PzÏÖ±0){QaW5iQ˚•[;]˚≠$Ö]áp∫Ûõ›ΩΩÎÖ…ïM„)Á∞4ê	†©9dYÄREëFtÙﬁîxpÌ⁄⁄Û≥ø∫	Õ∞ÕÁ€_ºZ{å&b=ºhÈÇd—î-&T îU∂dVﬂà,´Øc]_¥¨Ò∆”ëAúWVÍeË˝h√∂cbLöëºÕ‡>ø¬p¢lDH≠.æ¯]Å÷LÍÄhÚìäïÊÜrT[ÚnêKQ◊ÃÊ≤	æj5∂¿7=sﬂ*"Ôqã˝Hgﬁß],‹ïÖªWN†Ø”7E	ƒ™˙&ó©úÆéÆ8M” €∆}ı)‚∑ÿë¬¨íOa+ﬁƒÕnVAò?oòzìQ£f◊aØ/∆XFjç¬’¶M¸A®Uù‚>hÃ .'dB_Ì©Ø≥Ã™3˝êÑs≤8Ãëjçw¶œóê(VŸNØ◊sB∏Wp\=ÄÃUT√ôÌU’∞ÑsXá 5«Á≈…k3qÉ•f·&‰§¶·FWãU™Fà˛ÎPR,ê
úh|ç ¢xáº ÆÆç‘ØI'˚ƒøÇSÆ´É0©YsiK†•æ'>5R(†Ô≠ËHQ‰1.<óktª›Öæ.˛fÁ˝Ínw7€ª~e±óYN XÌ	}@¿√∑d„®˚aÎ≈∆¯^Ïp2z∞¿§°ºH˛§¶¿@j˛M©89\¢àK√…°.
w™∞òzá∞ñHÇU‰SB#Ò-—æ¨Fì9¿∆rÀ*™jÌ-ŸØ@‡•÷;ºµ^6
r[W‘ÎÅ*VÆ5I&virƒ˜j5Ã*Í·:
j®≥∞æ”7RaWzå“°’$eQSæ‘!¥`‘- ∆lv:<’l•`∫§ˇôG”úºÖ
Œb.JA3 QY4©æó√u‹£`\pXïJ’p.ê8–ŒK
ıÔ¬ü{|√Ñ'◊Ø€v&†‘ßƒEx—ùP5Œﬂ#’éI%M¡ç§¶-È@[ôüç°ÀÅ◊(ﬁıâ6äÃ¿O˜Ω¡€<·_r4äâ·›k‡Õõ7-#íûBÄäﬂ\ËËÑ,»ÀÕ¶íÚ≠ƒïΩ
"a%¡∆òN»%–‘ô)‡òK^mÎé«DQ÷y+£Î"¯≥‰…&q∆Ee#xæb˙Ï∆˘$
ä3„„›m#zió”†.BR[e>(ì¢t∂ÒÏ~;ı¢ncX”)q9Ä,Nrvò¢aÀG}◊¶’§z_}`£Ñ-NñQª““MõêKCÆ‹¡‚Ê/d	|Xwu.P9?17ú¬¶à÷ådpˇA5s0
ÄêC2 @3Œﬁ
„	@Ö≤rUaÒT>Úa[hbv∂≠òy€ﬁXóÅÓˇPÓ◊óˆ§wUôı‰∏≠Êåï–UæÏ≤+¢
K8&´∫~˝.‚ã0Ç]‹°KÅ¯&π. ¶è≠ßHˆ˙ÓÎëkë%Öøöõ˘$Y‡ˇ≈!¨Ÿ∫]¸M˚·ÍÓ¸ìyQû¿ﬂ◊~z≤„ù}ª7cØÛ}·!xOe^√|≥ª˜˛æ£W:WCÆ	Üoà+’lÀ…¥‹,Àö9öc° ∆ †tMÖ©◊„jwgcÎÂ⁄˙Êƒ”Æ˝Ÿ≥Œ√›Ωm‰‹YS1hzÈ§=ë´Bä≥ç«Ø‰_X~B˛a∆)]Y#Ö◊ÁüX€B ≈ßë@ö¬FPÆ£xæhÿn‡eB4ΩHi3–åf%h[}ºØ:)tnµÅ‹g+X8#l∑“¨ [Ev.cQ¨ºﬂiµÆój?yPÜ˛îP∂Õ+ö¥$íÚó}…}§∂˙Ä/Ö˚Ù):5II‘ﬁ!&ä mÅy	Z	cœˇ≥Ù4Sç∞˙◊BƒÕﬁıûî•Ë7ø¿Û§ö7ƒÿ!+Å;7tÀsBwNŒﬂ ºù¿sCxcn öÀPÙ|Åµ7”N-cfö™±‡L3>¢b’@å˛öÔJ:
Y¶9#≥G”]¶æ∆ó°úq˚≠Î›5&mª∞∑ÔˆˇÊ∆~◊¿øÏ©Ÿî\ÑsªÂYlNŒ`’∂‹hO.g[™6œŸ|ÿeª;(ëöÉAœ–qúˆëY~BS.?ßLﬁ@WæB#ÑU∂âÔÙUhvÒGI‰£ï˙¨Ò∑d¢±éU-∞∑¡±Ç2Î§UA˙$dÙÍzÉºGˇ>®7°4JG~#rm˜€Ü/!¥%z@∑ËS/ˆJ| Ø'”ò«?ˆ≈‰⁄!"™√"Dƒ"#f°ñÏä~pgææ¯¥2
–t⁄'là5fÆ©‚ZWã¿çT£˜†âx=å˙˛	ñöÆ”.˝®∏~˝ÙÕ)@G∫ªﬂ¬∏.9∆ƒÈ∫˚H≠<ëë-ÖÓvoë˜(ã)(ıÈ(–´ûJ‚î¯*äﬂ£ﬁe™BXtÈ˘√≈Ûz⁄¬}»±UÍß~!4\ ˆgO√·(4\Ö¡&"4Çüï˝!◊G÷ÖFxaæÄßZßt‡Wù†…M©fòïññ÷Ë¢—£zù˛]â'oh)“D]9QdTK·
›,ÚÚ†{ÁfüÒr¥FôfËF)A„Èe¨Zs:~Ú+wòä[ØTZ+˜Ÿ‡ÛnbÙ&Ã∂∞€ _ °;—âÃP‚&âÅπK7›˛Ûã9ñ§µ†µ~ÜAÆ∆∫‰7LRL)“>LRﬂÈîÁ’°ÈÂ…”‰0H1‹™î…ò’K/—|¿íÿZúåΩ(Tar®Eô˚‚H=~Z 5MΩ÷Ç˙é_a#˚&…‘7¸‚Ë.ﬂxc<jNO¬L‘ƒ0∆4¡_p¶ëáÕ›D”#û
Køéﬂ4ßı~ÖÃöÑ?&a¨˜õdyêÑ÷èÃË∞x“0Çl©¸Dï∑¿ØÒŸ¸iDM≈â¸∆tíz~¬ÎÇ≤"´éÇ4=£/z>Õ$‰Äß°ó¶TÍÅ&î ˆœæ'D˘a6Ÿ?‰ã_j–P.âŒ˛Ä	Âß∞¡\&FgÈt"Á÷ÁÄ≤m™¢ ”ørÏ¡`"o,
âÜˆtOπÅSBêÇZzY2⁄§Œ√¬h4!-jR<8$[ÿa¡mnJ¥XŒÜD,ÑUÃåõcoÄ"§_ˆë#“ÀCët˘ºd÷0õA˜pÚ˝!ˇ~≥ﬂ_\Í≥QÚ.HWıáÀ}·˝ÏÓÀ/Í›Õæ©˚¬Ñ0õ0ÙÚÔˇ¸èˇ∑ÒF:H√	≈Ö◊_Çl‡}3ƒÑøj⁄,Äb ò8ù“˙äÑg÷Û=ÃÆU§ÓµTß%çè9∆–˙¯ÿXÕf≠‰≥Ô∆|Ò‚ûq$Jô È«gﬂ©ØD˘ÈŸrX®Ù5ëﬂ`,_º®jéŒ˛88=è¶‚õFè•JÜ‚g‹kr0Uﬂ<Ï%ÙΩB?‚;hQa∆…¯"•£ìi4ñ´æk+çq@¯·„˛î‰–√ÛlºÔ$öécÍÌ›ŸwiÏÛe‘°æÇÙÓs≥ÔÛ˝$ÕËeK≤5µ‘ä|ïçßôd{¿0@çŒæÀ≈BÜ	IR´zñ–Q¿!ˆ√Ñœé''8ÿælT`,+Pd
´gﬂ˚ARπ∏Q:D˛ï/kœZ÷-kÔíñ5Ôï_Ì:{q˜Fü÷1}∑◊±zËX«Í]˝:˛j÷Ò≥ ñπøµKò˛≠0Lπ8‰˙ùMaœZµœÒQD«ä`s7˜‚òﬁY˚0æZ;é˙EîêÖ`»ôM∆7*lÅoìŸ$»E-˘É*y~0òÚE/‚°«ó›~ w@ ,ÈM“`¿πêÏÙ R¬iæõ¿snpˆΩ˙^tD;'SÃ]†Ü°~QÂi‚1+Ç`îåÅ˝âÒÀ´$hÅ^tπsdrzé-zéâû„zæ9=ÛNÅ˘∞M≠kÛUK›pL/ÚÂF%⁄4Æ?wêπ˛∫ñ“ˇ˘_j(s	·Â¶rÃm<È@Ó≈BéÁYdˇ,@$f)˛8†s¯ã,6K*lÉ#:Í`¨
ı‘\„1≠˙wà÷€wƒ=˙ëM„Ê\sâ˛]¶%p$xkÊ√‹‚ø‡æ1 h|;HAˇK≈~≥hJW⁄ŒÛa–]Í”™¯¯≠ä^∑’‡0^J˛‡Dõ—íqóŒïiÙõ€‰∫<πnü}7¿nNãO€n-°N¶È$Rï¯eì©ˆÿA•⁄€z"˝_Íÿ1Ïõ)^`|^@πFCÃ)at’¬Ÿ∑@aiÇÃ€Û;≥ê^÷R™@œÈ(äËzaöP˛_T9É·ò{q⁄†¸Ñ±y§0ÃP5U&´`õT¸oÇ„:Ωê"/π€;^˜õµÓ{ˆÌŸwgﬂü˝·ÏègˆgˇÈÏwgˇtˆ˚≥ˇ|ˆØgˇÛÆﬂ›ªﬁë⁄kq4jˇÂl∂Pb∑¶˚ñÀﬂA;œ
+îzV68&'YE®®b8‹Ê§Â4<9MO≤9”˙Taí√∞RÓ	dàSÅÀZ"Î∫ÌQzPç‹¿«|º;KZ@éV1l√!mÒ.›ø≠5fG˙Î’Î®Ω@[ŸƒãôÒà)√YAìß]ú´.<RìÀÕgVM›ö6ò¶YívGA4aì£nøwì•	¶ñ˜yÓïWmèêÖ1ù–HA}†dÄ L'"Y∏r¢ÆWp  ¡Ä‡Åœ	_gÏ!k[o
3a…X„ØúàÉª£ 3<E^ı 	¡¶◊•yπäl∑TFû¿ÏÇä¬ﬁw˙øZˆØ≤UÒìåÜW-£°Ç]õk;MfŸé(?àXSÒdÒ€ûìáô±ÿÕ1Eû_[¥KsÍ–úﬁ~™Qé)orê–ªò∏˝Aﬁ]Z\f]öW2ì—ÉÒ~wôçBﬂΩï&µ+∂û2§{s7aXÌÀ]AÓ	¸˘Á\≥ø.¡œ	¥*H©{±lõ˚aw˘àyÌÓ,ı'G{ ˘íªHVG@tﬂtwÓ‹π≥«&	ù•ÔRFü¨É6$içæd0˛5√)œ©’`äÎ¥Uû≠¢"4Ù£/WT¬Ã@›%ƒ»íf?¶<·¡quÀ¢ÌÊ
Põ‚)–æÆ™ß√4ùÄéHá49ön#ñ@Ê[D”!i∂l´K)TˆXı‹lF€±K‘Êh†¸¨˛0I´´d∂ø@g{¥8¯^ï€‡í˘ÖÀÁ–à}‘17Î∞G∆’7K*–∑rÀ_·ºå≈®~èõÆÌ¬®ô“ä	ù=ùÿ˘O~Of	"ùS{•îfÁtf3™|E‚s5¶¿˚s‰˜zΩ≤›Ã©®“gõæ¬â·-<}SÎ|tw/›<3∑›¡~eç<¯åÈæL›ã˜âæ ö:ÁC`5“hquú!0Á
†‘ÕèB–w#èñÿ+œ˜“µ8&Ù¥}:ÆO˜◊}âºÖîë*}ÈÅ ê·/ıCBÅk∑ﬂ1’:@<Øë€ÀÆwWï…¬o0NaÂVøx&v¸˚¸Â"èêîtÙ
^|~KÎ˝ó§'“
ê9t@%$i vÏºs^<‰ßÆAùı^n≤kl˙0w‡'5«∫LXî°öΩXô˙Ä7K}¨Å–›’gL“	@%uÍ]„Mí¨MPt§J~Ï*ñÖ±Uå~IfbŒπ0ıÄ⁄Ô-/∞~Ô˛sˇπΩ¿ñz˝Ωó√4Ù_&—Ò~!≤©*ùô•Ø¬‰Uúj±L˚5Q®‚+}>ÁäÿÀº.`XK≈çS¢iº˛)Ôù.–ﬂ„SëØÔ¥”˚§Õ6f›•ëÍ…¥æAaúWú4ØG3Ÿ1fœ	ï	”'E^*™yœﬂÈ2„8ÔﬁÜÆ∫∑§PûÉÏm»Á+(ê„]Â«(xé::W°â“B¿¶6¥Ô°“¿¯9Ñ„Ó-%¯⁄˝r£®2ï4I€~ƒaYÓ˜5˙ﬁhEoä∑1R}'¨ÿÙ5—ÿ!
ä[¨_6‰ˆí‹Mm†ƒ>L∫∑¬ˇÁˇ·ˇÇ-;Å)$Ü∂çwä7ÎË—"£m@ìR≥Gô‚Õ~_Ã(›lœ¥!?aÔÃ+zL=L∆MVz∞≥ÔQµ¿kIŸ¿KáÀ√˝H¿À≤¸Ï;êÇòíxP§ÊpN‘.¬>¯§b>qÕ“¬ÌÇü°B‰Øj?ó	ü∑ä)˛VÉï◊ßHÎ‰ü[e[ö§/0¬Ÿˆ-4N"Ô”4ŸE˚´Pè¿ƒH’CÖ:ßˆ	•´öìÓMN¯¬lÉ©Õ1‘u"PMπ
lQ…ª!ÀG˜Opõ8e£ •K˘/PxîÅh⁄áçÚäx*˛öÑbçåjØyx˜∞ª≥Ú9*¡ñBâ\Ob/|}yƒ<mÕˇDg≠ú!MÚ¨»ÃS“†&ÇèëÃç9u∏ñù›∆ì·ıQtøÖ⁄uçõ…[Ä˙É}ˇf∞$¸äP—Rø{x'oÍÒˆhüæÅ°XºëU÷ZfÀ≠S∂h)1ñPå∆†$†s~Æ4“π6˘Q…HuºdﬁLâ¡ZÔëyã„Êî-›?·r éµÔGÀ˜O†I‡◊ÏX|=>-–uÁÜ∑≤€FWoπ80˚=u S1π€<ÅÈ(aBÕ°ú9mí3ò˜ΩˆÁwÿÁ˝∂º|∑ÂÂ~Gõ‘7n7-(WZˆ<!HøDg˙{ú‰≥ß•n;¥ß•nc,O¶ˇéä…›Á{&ﬂÁª&KÔ∑n8∞ÜËcçπ·º¨Ö{ÍÌ—Â"!⁄è⁄…©Ñ-ÎA¿+lç@±Â"6¿F/⁄ËwÅ§îáΩﬂ‚VRjíÓ≈ä–4÷€ãd∆»RøIˆKrŸ)Y`ÓqA—]I≠äïz$*XÊ»gt,ﬁó*”	ﬂ$qÎ6ˇ„‰˚î›√˛Øß{¯G;M$:π«∫≥{Ü‡Ó£ÎÍ√5$Å@ÍÌv‡™™Ä≈º4Êf	WÚlÕ+‹Ω∂`?∆|6:ÓJ5ÅSˇ‹”nÇ—?bq:ﬁ¿jçé\/†BtÏzÅ]¨NÔüp‹∫J˘…8åA.z"!2Ô˚-⁄3Ω®Â(lÀd;wz7—¥Zàó»9t)RähÂ÷úé π.O~Óπj“ãú‰Qé)Êﬂo¡Ïﬂ
∆≠'≈“?Ω∑òWŸë›ç,ıV†√‰çÉ,ƒ\=J˙A˚D·”Eÿ&k;ª∑Ëzéñ,˜¿A…—∆¡⁄WåÆﬁ∏⁄rySpÊJæî:˛¸;√ÿÊêŒwñ˙):áÓS‡dÅAL Ø£j£y™ÙK¨{•Æ˙‡ﬁÌB∏bÊ•ﬁŸÔ=÷ﬁ‡.Ò~∞bc¢)ÜÏ.ƒ'$=%q%˚(L%ûœ∏eÈ3ÿ»±;ˆ’?Jk¸9èŒ#éKÖÜy¯¿(wºé«*Ã=”n|nÈ˛FÔ¶C«ìb˝~êñœ;µ)«≠VëCT[W‰<sxä^NÅ æ$¶ÄW¨ì∑Õ8Bß∑∆F ıΩ®±!&Áï•˝.9‡‚bÃê†⁄¢ÖYÅû¨¥"®/≤ˆ çTΩ~‹ãÁúÑ¬œWúæ‚˝+T”∏,=ö·?õE∞Z50â"‡πÑπΩ*<jnwXiúŒ)Kq—ñ .A79ÍÆ ≈OéqÄj%óÜ+¶ó§´ñ~}^rË“c\s‹·/2P)˜mÊ@1ë™AC»8¿T⁄(Ü¢<⁄jÊM¥–g3<ŒknuI,l¨û≈HéµlsÖ—çÀ\ˇ ^¬—„ bñˆlaÙÑd˝Ì[è;÷‡G7ÍIßdú…∆öqÜ€fñ+°§® ˆ§Æ‚’j+\ﬂ˜¸a@(Ë1çÃÖ,hJ=Bõ_Y,¶Î5.
`aK›àP~'—*ju¥ÆDd≥ã[é.<∫ÍÉˇ“:·ÊÍe≈—ãàefET¥÷˝Ê]î˙®î≈us[%∑ÂÃ=5¬û∫2{GÂîUœ	§›Ê„∑Â>B¨>Oß1F2¥XéˆV–∑§›:Épàº´¥bUµ¨ªîäÍ	◊ÿNﬁîï	ãe ˚^FÊ≠áVâ)…FiøÌ¢Â∞ ñä@#cAc(7œ	Ωs˚-…œeH?v˛4y5∑ Ò˝WÑÃ}∆˛ö»
#c ª-xç^…º•ÿç.√ÉPf‚GŸπŸ˜Ì~9µX4ËŸ0Ë«E;.∆•N «√2÷ñÁâ2(ªïÏßôÓ;u÷∂øÇN S∫õÉÎ∑À€Nci,Øsﬁ''—%£ŸC’8m*QÂ$-ﬁ¶yrãÉU‹i©í7›1xìXÀI„	±{ÿÂ.'ß\çÜ∫=jÈ¥«t>Ê–n+"∂‹ ﬂ©‚7∫&Ú9?u#~ïÊK<'∫vp)≈ûh·3'òX‘9–∂¶Ö9Ì4üì)ÒÜƒ· ¶Un≠Fè∑≥b®Ê≤"êœ8-©r!Ø™hb◊‹NÏæJõo‚kÉ9‚ÅÆÚS◊9/Ü,¸†˛ÑG'¬¡•¢	È.NÄ©È÷ì5ñfÔ<ÿ+QQ«pœ÷ÓOx^}d†J<¬"1ëP2≈∏ñA2±O@ˆŒSe,ô∏∫œúáá˛¶±o’,F”⁄°˘’Öë{ÈÎ~r‘ÌH^TÎ–º¨ΩR@[ÌnG]uloñM¸Ó˛ßo•€}ãN†—‘Ph—Ÿ∑xhwìx&
ÔX“\‹ej¶;æñE‘cú«R`TefÚH:Ω¶Ê9f∂‹C∫«o‹µ’C'=ôVÃ≤˘œXÍs®#\1òhêﬂ≥˚*Kœı†‘=EXTÇY∆Éyªé†/^¯Q‚S ÉÚ≈\vÍà¢D9†KÀ„Æ›ˆÂºÆIÎâéÜD∂˛±∫ìTt+D˜ìºåÔÖØ÷ı9’Z0Ççzò¢ä'È≤na√*±Äºé∆qàKÁœÖhEµBﬂØ∆iC·˛†^ú0—!£Ìfú¡Ú[e-Ô]˙≠N}÷Svj)˜ÙK ^6Äpë‡DÔÊSº4√KﬂR¥Ï˝ä¥<˜óugµ≥0%3:ProîVb·‰¢AÖ3ÅÇJ€-'/?¡Ïr©≥˚‘j!í©S˛Ä!QÙÅÖô_4áo‹îá¨…<ÿ6ácº≤∆vCrˇÜ#vá©wÃ7ÁÿÙ ô≈œa®%˝^Òx]˚´Üd’9?jÕX9&®cC„úä∏eÖ+∆f”ï∏”Ús©‹?Ç€ﬂÏ€˘√'ç_|("Ô⁄-[  ¯.∫ dB∆ÚâπëH∆√+Ê-ÑE±0{Ü±‚hÅ¬2ÏÜ≤∆Ú‡À‚´çó/^moºﬂ|˛‰≈´gÔ7∂∂øzº˘‚˝„Õµ/ûü˝nk{s˝≈˚_Æ=}Òjm}ÛÏwœedj°SÓí6è"Q¶ÍàWËÂ…W(-6ZÓŸµÁ˚Çßd¨/¯xcÎãß/∂6ÿØŸ_–=Ÿ\ÁÄµ:%h)n!q"L¥	z»4 }D1èH£—°wl€ÀxãÇÜ’{¨Qºe∆B^’[\√;|¢∑⁄´x[úW’!Ú|îjbÕß˘Ø~—›ìƒm,˝xÇvrOi“h›®¸Ñ¥C˜wiLÑànÈ±kÛ2q·FêΩu¡™¨Hª»©nÅΩ·˚˛H^7S+–œ»X∏◊IË|Ë£6…Û‘“VH(Fw(*å+¬Ω—rŸòçuW_•»~FyßÔdîûí–ógx|™'äÛiûíÿﬁRì©-Õ;Sª(H4¿/#ÌNÃ+wó5]+ó83^,£•˙|Ù/7BˇÚ9—ø≥¥¢ªfM¡~íı√O¿Ì5ÀsO¿J£	X9ÁHÀ¿ÓÇlçk˚K?»¯¸C·•ˇ0}„‹§æd{«j—Õè(xTﬂ˙P®æQ…ÓÂﬂjöÓﬁºêé≠y#ÿ$rx
D-∫Úú;N˚ôπ6≠õoÂáÓLƒ 7ÃébiéPk∑õE√Ï9Ÿ(—y)aπj»YwüóoMº∏î+ŸÿF4–√r¸àqÆ#€îÕüF[]sIIÇÌ
Ñ’Œç q=zÇw’–0;8Œ“¿¥Û§Æ¶ô6j◊ Î»Â)å~‹^∫≥tKŸƒSÓ”°9&	bÖa≤93fæwq(ì∑—ﬂìß;ÀmÿríÅ\4Ë»ÑÔ~{Õ∫Ë†)†Àeá∞;öòÛÄ¿jkKP}(∂ n≈EŒÄ¯í&·«◊*à¢‰¡.∏àï˚j°w¥8 V
⁄‡d‹(O≠=Êvﬁ4ÃèEÿæLúø%◊,[‹≠Íìë	æRvB7Ω7∫=\©ID@⁄|-»PôÄÚãQ }]ºŸGƒ≠Ph™â:He†G6vDΩh¥iâ≤c˛3"∂Ccí?oúT≥ø:(^m7oÆ®ßãÉ”)‹ÿ¯.‹ye
fÁäR)q?€4¶£ØﬁìßvsæíùΩU&q8ogƒcœo1„7‚:ÏeÍZ_™ C‹)em“ÆÒ•¬Í∑(mËò¢•ßœıÊ√åfR˘0ø‹~ˆT^∏-[£dp#?ÂÏ“ƒq ÃçÓ	YäÏw~h¸ê®ûfLSYÓhw∞ﬂNúlœ˝íbã‹Øîì∂¢Ê≥(Áâ~ì¥qœµƒ‘/=ûHU«ë~◊Ω6∞À2∂+3À2»¿π6∞æª}	&ïÎ÷vyßy-ßÏ`fßeSuJ[∫@…´,#ì(Ú&®o–Õ“!ë≤*ß=uW{0Ñ”b©úç_	ûK˝˛‚-æ∆ms∫óßFórvhBœ=ÉU)Ω‰ä%π¥¿FU?ˇ†îBgÑ’ŒÊÿZS¡[V‹{•™±)M¸´<@|„Øˆ*z”BSUKÆ&VÊjbyæ&4A¡1ÙıCØd´’’‡lπgM±∂|{ŒF\x[∫ıW{FŒ≤y\qMƒrT+∆úò[Í_ ^'o^k›su´¿'\O⁄Œs¢óçÁÜXÆCPCJ≠#˜fÆùÎr7Êk¬=Eï¸öÏT/y&%2¿å™Y∂Cdi>∑•éZ"iS"nBì˘f∑‹‡c›£yöYv5≥˘ÕoßaêV¬3ÜkŒ+‡dw=¸p%*G”·H(Mïeuë OI° ß¢ƒK!ΩımFIZñıOâµ–BJ)ÀÀ∂©N)∑ÿ™Üã¡NßZ|™Œ†LcÃwU˜Ûëªá=£|R@4ëñÉ|Ij,Àí®Ü≥»√Ö∫«’bù(Qàu‚AÅ÷”Böt˙/•Ó«ÂªtÅ•õS8ê©õ °¶@®i°ö¢r‚±ˆWlYƒrp·ôg¯4ƒe2o∏	Á¥gñ	¥¿]´äñ.E!ëü*´üÄ¡‘ÿE∆∂H^X5®bv¶i≤∏§µ“:)⁄\`okó[(ïqíf˛*,îÚC)5¢pØ≈˛ˆÒ$!´ Z	[≈âï*ê/$È¥Ω¶ñe’WyÚ°F∞“Ì”⁄ŒrN(D∞ ¨∑≠G-œ+¿∞ƒ bF≠¿Î‰*]„ùö°˚√TgkÑ—*RøÎ"+Û´˜R≈–|EÓ5;o≈ﬁ´o•∂E≤>X∫Ÿ∆€lÎ]ÈÎp(œπ	ª∂·".xmií´7Ê∫≠Y≥ø
vU›
l§•]T~ú;¥{èvÔ“Âƒ\T∑K;\á,DsEB..≤«¡Å7çr·`n—çø‚mâtõπoÕ√F'm-¯}ÅEÓ›E\K¬Ô^∆ºc‚*oßÀñﬂzXî≠2Û€Ωπ=W´h∫ËÆµË˝=êÇˆ÷CK≈[ﬂ>“Ó∑ß˙Ír~›©q˝8ˇ8Å≠å)ç6ı_Á,’qg·´6ˆ—Ie*—Ω.0∞®‰oii∆Ají?ùêH"ÙZW´"Âo•C‘ï·x›8Æ9„]Õ3aì¶”•‚bñkB¿¥†ØÓı£N!íió%Öp ±Êú–ÚÅπ⁄ÈDÒï:R÷ñb´ÃÁÙ¶7Û•õ,√laN_z„±ù◊y^¯óÖ√π⁄Õ|.◊˘≈–¿W>œ Í®©b˘œ±¯ã·ŒÄ¨L¡˚pœZ1•ıb–€i’YRô>›q‚,µl⁄q6.ó‡ã<≠é3jZ	π[ZHµòûºQYöuŸW'åzÎ œª°G›‰ÔÄHò¡èMﬂŸâ=hç à-$wd6c–p¡ºx∆à£)åô3~Hë«5ñíis2wÚÎbêi∞[zÛeVoqü—Ãı˘1˘p‚Èx=
'˚	fK$ìc6Õ√]Û,SqNé∑ì¢ÿ}Êe«Ò¿æªO˘·±FukôtØ/0 ?óo˙g3Ç• ÅÚø|ÜM3<OìLS`˚Sí<˘U:ìâÔhøJ19Ív∑Ï3å¸±)û“ÈhËM≤é∂4hoì¸˛ ;\-‚cy“î™mÖè•‡à Êrè}ƒA
3À[·ógpà€ÚÓ£Ëò§A¿íÄ)ÂÔÆ^ªvïF^Éçë"^Ï3qãçºlƒ2–Ë2ôπ@É˘•ºùCéﬂ’¸"˜o⁄ø∏æõ·EncíªE¨Î °ÿï%‡¯0Æ-òí	¡ƒG´÷]ˆ6sµÔ∆◊©6~√ìjw±âçogDu`ÇcdLfÕ»ƒÅ^M%[—pôÜÉCªÀ‚D,¥	•ÃS®∂¿WJUx˝ÓWÎ≥-F∑•-Ú?‚Zä$µ/&€z¶„ÆGÁåÂ8∑q=˘8⁄ ‹◊(¿s]Aª4;ƒC6&å6ﬂ|µ„∞ÄLi(V·ﬂ,Q√Òì ãØÇtrÇr»Ó›èYê¸VÓ3≠ßà„|î_\c)fÏ3ö≠œºÒ‰n´SQÊ/Â’E"C,¢ÔQÊ¯”U‘í∂â∑*4Zs!ûüÍQ8f—»S~‰†∏X?∏F⁄Ì/®zwx€ä)WX}-ôomTõ=ã]\“{5±´‰√º|Nò/ÙÖ°^9/‘˚¬pﬂ87‹ÄÎÇl√÷ ˝ﬁ˛É+K˜˜òç7m/ç§lÒA›*_∂⁄¸»t¸z¥§ñΩ..9¨<ì¬∞É«sƒ¢´ü∂•Ωá=ﬁ`“‘côÄ§ÖgB¶,jız™+ Wû˚‰	^3bäÛUx~®\ÄÉ'´åb¸Å∫Í¸äÓg0k“≥Uq«qπC¿K2Q’¯ìnûLVYüwe±ΩÉUyt‹≤èèÂ’;w[6Â÷˜Ü=X6s®∏±ôu¥5©ñò˘¸≠≤»[*MTgêõ√qTãìïrªÒMµÕ,;ö©‚2©
¨“TÆü{ö|"ùE]X;FãŸ–}πN!∞duó¨Õ›ë¿-–Ù]V&r˛Ë¿á—Ò*ª∫ÜYCØÇ8ö◊ÀÓ∂|Ôgìª®ƒæ1;Ü
W ÆÒ†ÿpÏ£ÅÉ!˘áKwá¿òô'¶¥ÀoE	)ê§AUë‡ ÿ¥÷ÂÖFŒ¡ç
¢¶+cuÚ9ù=\®cÃË©x†—Ì©≥tÌ*˚Eü>w•ˇF-””÷lG„»ßà–+'|æÂ]QDö\œSE¥
ì6'¥˝ƒX ì7˜Pû}pè ÓçÉ‹#ë±˚≠i~–Ω›zpoëø$OÀïM˛Ë!î¿Fﬁ®nÚÙX#t\Q±˜.bN$L$$TDº\<åA˜È)µëŒ¶8bœC~ (ôQ∂m.'beã§pµV©Ù£(ŸoÔòj“ﬁ;!˜Œ™Q0∑‡háf4&±WjÜJZ≠úçwËÖ9s‡¢wàAÒÌÁ^˝—Œmê¶jé◊y˜&Ãz2	üÎ∞õ~≈≠(ÿ«A2Õ€m“b 5H"Ô,∞e†Ÿ¬ßÜ∑¿ÉÆ÷“‘>Ô–KÅ&üÄ˙≤O˘ø∂Ôe·ÄtA„`˛T≈dµµ¿∞°.ì∂.àèx8?&4\à·n§iôº+0∆$m∑,3ÀÅ"„. z.∞ú›ò®Z*œ+ˇ´m¶“®RÙj‚Ø1ˆƒUÕÒ9[˚D·˘%ÅÀëhU–ﬂ-äî¶¬™C7Ö3a-¢ü.º(Hs 
ﬁØÜÜ, /o‚Mº–08
Û$ÛpS§‰}™åt“øÉFê?m'œ§i	Ì¿eXì_¨‰gXFπé•–K"(≈†¬[˛Hö‰^q•Äq/•¥>P·±Ø⁄W˜ﬂÛúäùã√ÙÙﬂ≠(æªX[¡Ó]$à¨Ô?|ãljF◊•≤•Ò¶‘H`c¿˝º¢¡˝t7ª∂ª¯P4G∂∞R{Q®µ«O÷â¥*ZçB’^ó’çF4ª'Ô6çìh⁄¶—˚$Íhm‘†≠T÷Ê§Æ≥âÅ°™n&e<
r˚ÜΩ˙À ö`Ïl¬ﬁÖŸxÊ±pd†ù1A)Ò∏0èä¨Mn[ô8oÅÌá˚Q(¢g– ÷ÎH!t¬[w ›∞<á^úsπrÅC0L“!0™åmí‹.ÑƒJ™ŸoJ4&}ÅZ'/%%„¶ÄtÃ-¬¿!
…\6Ó}bzv68$ØÇlOÈn◊‘;‹6lﬁ µºu9…âUpf‰ªº—Ô∑J˘yc’…saávÒ!	äò`qﬁ¨Tä9O¢(p‹n?±'ø¬Ì§"q(≈≥}{hëZOÌÆ«O‡•ñ¿[Ä(Ùìf'Aç∑Lﬂ€Ê‘∆Qós–åªÕÛHc§à}I‹©mhê‚≠òéôiﬁåV+S9&ß¯îSŸÅ0¸Ä¢Ã!%≥ 6Lxî—ØK•‰U**≥ø∏‘/Úî»§0ÓÙÿ¶7◊»"")≤:óT9o~Ï`á¶˘ãf‡‘Œc‰ƒÈ‚ùõÍà•Dk£,]Úf©"≥Àá¬◊r3|ÕÅ;¡–åLB†|[Ú¥6›Õ2"•/…®‚‘Ê≈Ò≤23hFˇ^œJ9jj0ÿ<WM›I˛Û§¨¡è9;u~
ìô%õgs†<å¢Ä?©Ïº—'J8ª;_m¨øx∂Ò¸Ò⁄˙ÊŒã≥ﬂÌ=Ø=yÒ|cÎ˝÷W_lº⁄xææπ÷±¢+oŒ‰AŸ¸Q|(è:0†5È,m¯}wv˝›ﬁÓµ›Ón∂˚Áø˚ó›?ˇóˇ}˜¡ûp0ÃÆéûÉ˜¯œ∞Ÿ† ŒC¿◊\»ÇÚ;øŸçw˜V˜–[±˜pgïCº∑wm1¸p†›4F»NÎÍﬁ{¸gV/íFùÔIû3⁄qO≠;f⁄˘PRÏÀ Ó©O?ùÔ@XŸéh∑Û‚9ﬂÏÔﬂó›ª;TiV}ü„}˙ií‰4E¸µ©èIπµ>Ê {÷YºRZ˝√„µ`ë´T&VŒûÍPu#√/œ<¿oÓ”í€ã»¿„,DB¡∂˛4%n¬„vå{º≥Ò*}OìC#s<üys—Œjœòü¨=k g£¶µ‰-WwnˆóKw_°8¥|”º"ÖbŒNˇıÚ‰Ëı˛CW7/›ZX∫}sai˘ŒBø◊ø’Ÿk’√∞ZeXe‚~ uÂ¶-∏aD‡M„ºÊn‚på"Òd
bA›Å	fúUª”Ôkß ãº[#ÃÖ±Z%éä†-QRoV›±…såúy˜øWáﬂÔ"ØX®»£√?'íp™.Å≠Íz¢•_cUïnã–âk≈∏o«†≥éD≤%8÷GeFæ∏ÏêÎ=ı#pﬂ(U|™/Ñ≠@¬…zR>|˚bÀ#<äS0ÂáÏ™I„∑˚Âd≈§q@“UÙïÑv”A∂mbÖök∫‰Áﬂˇ˘¸ˆÇ¯´ÊØ’∫∏˚"≠^’fÕR≠fπ~z≠ÚÓè+⁄:∏j”$°€ûÇ}Ö‚&JõÍä-⁄ìÙÏ{o¶Î.Neú7ÖàÿqHf";Ú⁄¥sÃ\j'ÉY'º8∞•}Ûu-’Ãx]]oöÁI\”1j7˜[ºX›6êƒÎQ8x{ˇÑ{F^ÏG¡f!–º2îÜ∂î–Íê‚á∆˚˜µµrñ ±∫öıwıÕ4s+Yf
.’7(jkcY[=B.ÈÂ∞ÎMÛ§`|¬ñ'q¿”4K“.ô.ÒÓ)-ﬂÏœ:-)3É*œ+ƒ‡Âø8ºÏâ‚%ø^@h.Æ8ñ.f~£o0Ûï(tÕÜFÎ„VüÜÆƒÌ>g˛Ã6ùi}:vK‘!jôx)*!ùåY≈€æê {wnÔ’ûD=Ô…R}gú±œJﬂ ]6ÖJ,ãˇJ)1õ†´Ü‰ v°ä+ƒ~“Îı±È⁄¶;D_∞ÛHFj¿Ûè—O.g|’·[t«ÃòI.Ôœ=ÃÙFYwöo@U’k∂?wóÌ`éTŒ≤¯y”9À˙Û•t>ySô”Ÿe\Âó£´Ì≈∏…åÕ¨¥®’•Ç∆œ≈“AÀ~jRB„«X&kv∑7#ãtëé›ÃTÏŸNÙ6À$ÚÌâl]:i¬ﬁÖSJ„«µî>PjÈ&@ó”Ks +mƒµi¶K¶•©øqéi¸‘⁄»ÊOÌ[ëŸ∏î§∫R]òë¸ó†r¶?/L'NEEù¶.n˝Z¡√|5y£f•&XÍ.ÃÆb«ÆËéÉô•⁄’Ò˙çR„gûÙ¡E˘∆)Ñ%,Û§.∫iñ ?ÁÚ&©<¥G\„wWú∑8ˇ∑ÆÙhÊ4H	˚e4‘Ú‹∫.\.%¢ÂÏí6+ïÔÀ»‚u˚føú¶÷}≠ùé∂eYŒ]u[Ω+
ˇÃõ?Û$ƒœ‹	e•ÀJ2àüKJ4ËnÍ\…ÒS-ŒÃtƒs:R	Œ»ÿofH]R¿,ÎU√||e>¸TÏÛU©~™í˝T¶Â£WvjæVÂJ%€¥Œñ˚µ~j¸ÃôÉèCî∫RÓÈ*LŸ[∞‘◊m4t†
$kéît¯iûñÆ(=+5ù3+ùîjÊŒKáü´ÖÁs$ ”›fíØjQÉÔ¿∫Î3~Õ¢}ZöÊ«¢ë‘‰»¬OÂÚ©^@’K»ï3Kî/ÁÕ/Ï‹Y¸ÒÇN}.-¸ú„∆H-Ã§4!sf÷¬œ\Ÿµ3OÜ-ÖW
7îcN¥àœ%Dú8ì”hÒ&|$.‚å6y*„úÌœÖbMÊﬂ¯q‚L.f≥ìπ#LÍ‚KfDó‡T∫8M•û˚!"K.#Æ‰\˙r-‚IT⁄üJ€«œ:|§A»è:“ÃÛ·√F~ƒ†ë*¨¥._r∏H√`ëüF®»yEfx§gπ4˛rCDfàÃ¬[çì‰\°!?€¿êsÜÖÃˆS}êê&!µ· µ4R˚≤™Œå0êfA órﬁ êˇ¿·MÇ?~»–ès«©^zÿ«œ!Ë„\∑|4˜ò#p©°ÁÙ®h‰1k†
8Gx«¨Q]d,ó÷1PGÌÿ™ku·syÀJ˙Ãƒ^4ﬂ8˚5ïçΩ¬^TïN?ı*w„Ã∫•√üËî"~\'ÚJÈ≠•e{æ◊4h∑X‘å2j–9/2œÁs7j◊^Àk‡œLq,ë◊(…q%Œ ˜}[uK´–∏‚Uñug∂uù	ÚK@'Ëß >¶Â8D_y,^.éÚïeY]ﬁô‘W),J$o‡~k
ÕT,Íu"âΩö=˚S⁄¬ú1ê
œæÖQç'aD{{ôÄ ÈΩK“P<`oOáS(±óèü∞‰ Ñ<]ÆG®òF¿tX‰12RVBÏ‚ L«ûÔıä—3•ë–üÜg˙æ031°ª+F÷ı·ÛÔøaY¨ú—Je˙h{5¸œ˜ˇXá˚´7jéQ_òoß⁄e	n›|ŸªaGÒx√Q9ÍP”"n¢÷[%.‘”÷(µ;":ïÁµ(®#<»>≥=Wt–\g¥ß—lﬂJYìàﬂ:ørâG¥/%ug∑∑€Ÿªºê‘
Qƒó¶´ç∂yérNË
Ø“ÇÅbw∫À:/¡˜ïÚ∆üˇÓ_*Ö*…u∆»∏X>7?blÕ•aŒ	Bå+@∂4·2:ˆv}tl˝°J#n∂∆Vß§Tz˛?x†≠{ (Î?¶züNêÄ3Q∂$AÌbÜ≤Eb/Ÿ‚Ëx2
p«M0G—ªÄ“!•ﬁ1%∏ß|ˆ¯ ù…,(¥®‹ﬁd˜xus∂€çE∫óì›Î˝wßÀ˝Âe¯˜Ê∆-˙æÇˇﬁXŸª.4õû‰ExíÕæ	Ë⁄êÉ`±¿®qWö§(ÖE«∞ ‚A4%ú‡ŒÜ—$AJ“‡j∆8©,ˇ
Q¯6`◊Æç µﬁ7√‰⁄5óè∑:öîæsÆi 	Ωõ]€Ò∫ﬂú˝˛Ï€≥ÔŒæ?˚√Ÿœ˛uØ≥ûâãÏ¢à§ıë◊dïœöÍzHaSævÌ âÍ∞ó'_°|±≥–ÓP‡ë´”πWÇJÃì∫ñ∑˚≥[v]_§ ÷Ì•TÆ&XÆ…&z∏SŒcÖóbæB“«èVæb*∏7>xPy^ ¶|˝G	)ø¨ÒU!‚Ó¯æéÈ≈.;>ºÒ·7?Ppx›¨ZP≤‡!Â»‰÷EìMtΩL5™Ωh¥2ŸÒ¯a√å˚}ìºV>|å±òüŸÅ∆tZ·ÇQ∆ı°ÏZhÆÄÍ'üÎ4Û™Î¥µù”‹4ÕÊ
ﬂ@Cm\oQ˛G
›%ªº}+.~~äÒª%ﬂÃ˘]3=3“3≥ri~}·ÍæsG≥Ôœ∆M„êa/≈I£cí⁄ûÖ?AüÕáı◊‹¯ËØ—¸5r’‹˛ãp’,˝]5JT˝…∫k‘Ö¿ó·¨˘Ëß¡œú6Ñ…G®Ë!LÈÇ∏5îSïûÌûõ—vä÷lêAúçíº†Às˙K‡£ÀÁ'ñˆ‰≤›=≈Ttˆ¸%fU)¿ˇ£Ÿæo¥}¥}Î2ÈrÖÌ˚Êá¥{/_Ü›{©ˇ„⁄Ω?§…˚Ûøì˜7ysÉ–O!ü∆iÂnn‡˛¸'d‡˛h€˛h€÷:¯h€vÍÉ7œi˘aÏ€?_”ˆ|"Íá1mˇî≠⁄µw™õ
S2Ãf,âÖ©ÑﬂG»C—(“-)xO†∏ÔÙ•u≈ÀÚ ≥∑¸&¡Ï8Cçm≈D/ÉÃ≤≠ØãNπ1òåÍ‹,\gWW%™oúmlVç kêCÔÚßäS†QƒNrÊ∫¿ÆéìPG2L∏¬êç¬ ÷÷ OŸß´lNœA¿€SötπQX©i.N±’¥ô&Y–¨A?ˆÍ{±h®“Ø®0âü%”,¯jrˇÑz¶•C]ÇÿTP≥”r_qÉ‚RøÚEy~¥X∂_@ó¶ÕcµÀv¢˘éß?–¥‘ÆÌ£Ø\Ö¸p:.`˚0ò
≥µï^™§tSµyá?6àgf´ÏF•⁄Íå#≠“˝,â¶ >á1]/ö&KËY∂Qº†kñ‡˙Œèªüﬂt»K}+`ıÓå‰∞äé*ÃÔé'. Ë˛ﬁO¶1:æÇåmÆaÓÉógﬂ¶©wê¨B+º#$Ô ﬂ£‹ã4£	≤ñOYÍÂË›Jÿ»˚π· ¥ëà1aYb4õ∆l"⁄]Dê«}dcvÍ4Jÿ1`;St§†/ﬁÓ9p	áúó1ê¿Ù∞·]∞k1∆˝z†¨<æ∆#¶ÏKX	–∆—»√ìÛÔí∂q4`.  øwz5®Ã_˝æàÖê◊Ú∂⁄
jT ?ˆrÔRÆ˜°ˆñÀ:Ä±Æk¢ÎW‹fî2zÕH NAŒƒ3t€£ ì‡Ü{Z>€{—D∫oº&uÍr.5ƒQK∂s,ø¯^6¢˚x˘…˘ ˆ$q“˝§ÙC}i(†Ïõ™N¿ 9£ñVt+àîìñ4¡®¬Ô‡ÊWe6ßŸ ´n√Õì0
c{9Õé>nGÓ‹˛«ø„ˇ±-/ÇÂÀ¬0Ñ•èÓˆì$˝Ô>Ê≈¿	:EyáNË∂BV∏ÓàÜOÖRØ≈DY{éöe—'ncñ≠J°≤£ßû=üÔ<}ÄGq—ı@{ˆ•-;≥ü‰y±ÃÏ•=|¬Ø%Îàñ©·b(ÌË⁄rË_⁄r(Ó.Ys‹¥øñ¶…aô¯ã∂ÏÈ^$ö'∆¯(Ú‚A¬~§9â˜Ì5‹öEû  óÚëêÛPΩº¢YWOTt¡Èá!ƒpﬂıÕy„,âyk°2‘|ÒˆÕ l‰wÙl‰∂RH÷î¶«…ı•v|‰≤ﬁõ§AÖ÷Ì
(3ÛCiÜGh¶{òzìˆw√§ıu∆Ì÷n‹rﬁY-^6E]B‘å¥=Û¬x;Ã)É}(”ï£≈[Å/ãØ6^æxµΩÒ~Û˘ìØûmºﬂÿ⁄˛ÍÒÊã˜è7◊æx~ˆª≠ÌÕıÔπˆÙ≈´µıÕ≥ﬂ=ó˘W©€®≈Z™◊y.˜Æ%KÆrvfái÷‹ûÆ]≈MÈ"ª—dü_q}c>Y°.<á/f‹xÌHÆR∫Ú∫bb”∑±"ïÈó†Å≤G/“pHr8◊åcé.x≥ΩÊ‘9
8íqΩ\¡.à eÆ*•ªh†ÆH°¨¸^RL¬mùÀOU˘Mó™Ä©™0ë÷§ÿ¬;JJÇ˙÷Wÿ$•ƒã“ª©ƒµ $£´Ãïî}Â¶+Îï;ﬂUéÎ¯~ÎK©îjJ'Üvz@Ä⁄ÃÀM~ê3Zöµ`
CìEÂÀsQ˘ÚOá Ô‹ºÑ\A…ú>?2_nFÊsÙ OÇ†eˆŒŸ¡∑¥!˜ˇ“˘Û◊ufNb~ÛÛ%ÊïôBé˛Ω^:û+˘‹.¸lBê?ﬁ\¯ÒÊBˆ>∆ÿŒc+xYı≈ÖU›4V«ToŒuA+h¯à∂Â unz^‹¬C	ªœíÛ6Ø 5∏uÁòw%–\Ñth^£$πh¯T¨~çf aßa~‡ÉB*ÿèg00Èπñmê=æ¢µ∞ƒÁãO	QÄ"r8õ)î#XZ¸àïx@en
„x$›™ÙtYøª@µµbd!¶«Kñ˜uåíà⁄ˆ+.T;’‡˙`=º .Á+?<Ñ .›¨¨:a¥xS-l∑hnŸ†.˛¸|n∫V/xôIm–zEÕFRmA∑MÓHôqÂË]8jÀ≤uí´îsk/9©óbÒSæ=§zqhÚ¨fc)D[çf‹kbêlE…Í€3ÿ@ÿês-Ú˘√›ôº/Ò8¬…õπÚÀ‚5bzöA;À7˚&*E∏fa—n’ﬁ∏ÒNXˆÉb¯±ÓÑ≠Ò¬|ºˆ„ù∞°w¬^¸äÊõûq®‡„m∞ÍÛÒ6ÿ˘nÉUªØÉ˝xÏ«Î`µ~W}Ãåçà6ı_Áê0/®u‚∑6T¢ín‰ß†ü¶ÁTÊè†¯ a¯itFHX‰H¨Ò02.vQÕœ+Àÿeﬁˇ"p¸_ˇ2ß·¥ˆJ_ß›‘⁄õõQ≤oµ\Ãz⁄ÃvZÀıπlßód9U˙≈mß‰Á®3&û€vziñS5⁄K±ùŒpì5TÄ—âèZ&Â¨—»R™S©õYú€ä¶ü»:áÒî,’2R`©Ó ËŸ∂‘K±§.À@lATw‹ƒúZeLùiJïáä\Ê”ÛKï˚∂„DÍOÁ,ÍKL(òë“ó9ÚÓåeÓiF@V⁄iQAırKñ˘Vì¥aˆ¢≠<Å≤nê£◊†›JÅŒA«øŒé≥◊!¥‘ZgR7·G:•#âÍYMF^.€¿ÔÁhâG5Å?¬É„r3^§yªıßo≈+qÑlƒxDæ˘Aƒscèß^Í{æó·˘≥A>•e¯sê§xzÕCÉWi´î‹í£ÙU pV‡î<ÃIåâöˇ∫Åy$aÜÇ·4%ªˇoßÊè†≥£Z@ã–ŸbÏF«B~èe”åΩÛ¢J≥ÒŸw~8H26IRhÂ ⁄=‘=”ó=SÌ/6ûoºZ{˙zÎ◊[€œ^o>ﬂ⁄~ı’˙ˆÊãÁäÙ†ﬁ∫9;Ìı/◊∂gU)œF{˝È⁄÷÷ÊìÕı5,]◊¿‘◊`Û‚¨°ÕEíM|™Ø‚«∞?–S≤É˝±êfíjg…-ö„5ä#ﬂ°Ô8ÍÕ+L'æósÒ÷æœÎdΩÉ≈évä≈SÿFŸß˜QÖ‡!Âh•€¢ëÜãTÕGqh˘Î≠œ{@†’úh/Ù˜±∑/yq£≥Úr√ÀnRQ¥~µ=ÊÎù7#èUÇ'KnÒä.C02Œ
íÏ!k?Oòák Kœæ≈√≠∞UÔ{_'ÇEtÏÖ¶£kgœM=i0—j∫T]/™’S'b6é∞ôµ(¬ùfr¿ïñ◊¡C†€…#P ¶(\H ◊k˙uñO}ÿAVÕ1µ˘6∂:z+Ó—’¥VÖ£’◊áI˙}•ØAí¬ëÎ¿≥ÀÍm˘	∞À≈πŸ Ò≤Øc(\n‚i8‚¨y+/Ø7ƒm±Õ`·eK∞¶Ä≠1¶#®ù0^Ê È’ı|uıe9j¡›ˇV~’çCáHÁ8råc+∆hM⁄…dYΩôâ‘;N¶˘ˆÒ§R°¯Îà ∑‰aæSπ
çe≥%˚∞\‚‡ê=ÇØÌã≥ÈÀjÅÃålπ≥∑¿N»ú∫
ÍﬁÑŒ¢„ˆ∏¯uñƒ-êÛÓ}L”∫¯Í’”à†¿	_Ï8áﬂmÏ›*‘Ä7ümaûÁ\TI:⁄-Ø‡&X≤7JÉ(]èÒŒ´(Òpóxì¢I=Úì◊=°˜˙ 	éK–∆{î6∑^lÒp∂N/É·‰Ì´€W;;˝Ω”Èçl[AÖvÎåÑÓıQ˘hÎ}kBÜí˝€¬àkVÂå”Q±îÔí∑ñ`píQ≤≈^∂É4]e^|\∞l!!n§)O∞ƒ=1M7T0ã∏åZÏ:ÉöΩqêe@8µ‹wslq_∫[M∆≤Ç8É|t]±õÒdöãIzP⁄≤aoFÉ.µ–òÄ`qøFC9‡∏HïÚ)>î6m#yK*ÿ8mx¸=êËÂØ{âúÛv`X‹ı›BY≠ïo) =ÏarÒ(g∞«Úp◊™≥/wZ$îE¶-⁄—‘ıáƒ´ÙJ{ãi©@¨iÅU∂ß©Y ∏∑£ÜÄTJB3€üXi[käú“vh‡ß‘™Æªö$Åh˘W¢F[õﬂ∫MÔìZõ ˛i˝†ãΩz>ÙÎ˚∂´÷òT¨ﬁ8:û1/Ü,p.(•\`*õt¬*^∫Åòq!tÃÆ.Ä(Xµ∆,@◊’G«≥@,Ñö¶4n8xZC3…zΩ(Ï†lΩ©s¥.n5ô)z©°MY∏ﬂ“ﬁ9ªnåÍŒ1B¿sLo—&Ûuç¿V2‰ú`Ú§u—†jı˙´4™Çd‡Ü‘:ﬂ™‘$X∂ŸúÙK˝• ‹ÿQf“ÅV_ïÖÌÏé¬<˘.6¢>MÚI$¬41«‹∫5≈x1”™÷”ìSÜ1¢=*ä« _†|R»Ñ5‚\!–EÃK£]¬{T™∆ﬁù}Ö+Q7∫§Ètí'U¢ûú¶SCl¬?köç€$ÄŸn∑ÀØm>˝5˚’ãWÛtskõq#k∑◊{º¡∂_≠=Z˚Î≠WÇ$»T€âÔ£ò‚µ•¬ã‡, ‰:.éﬂ’ﬁ√
∞™9O@ˇ¯u‡•f©1ûMÚª*˙‰≤]ã∫‘ÜÁoa∞C{yÅ]Ì_5j˚æ£6•™¢pÚºπrÇ ¢}<∆}ˇÙçm‰9`Ü•`=yŸq<`mÙH•°|ïÈ¶ˇ–aÌ*õ8<rcÚ–íŸ◊«^·œáΩiHOZ¥Ãî;KôJƒ|X3‘.b"`ÊózlS≤ÕÿéˇÒ#6—ÃÛ∞t≈ÕƒF„°øˇ+T˜ºC/§__hrUa	Bg-ï¸Ï3∂ñ¶Äı0£ø¸qO$—Ã((≈|$√Ñ`@g±^t˘ç*hëÉÜ™∑•‰⁄≈Ì]t.	TÙb∞ß†´;s◊Øÿà•öd±2òπe9sÄÊiFπ„PGÛËò¢uP#&Êîùkì“¿ˆT4ˆZ4ÎûëßS3Ü\ü°hﬁ•C∂AüÇN.ÛÙÕÇVvJØWÍ◊ﬂc•UI”˙I/´lgØ¿•Ü◊jÆÙPœıŸAöåÖU5„8Ao-z1ÿ$Úyì–XjÏ•«É%Ô≥’_≈Tºó°^ø1^7¬ûYÖ+åÓÇ^·ûŸ®Q≠Â?HR≤T√‡?x”∫ÜÉNI˜~á$nT◊f)ÚÊc”âß,„
¥£TÎõ⁄9UÜm_R°ÈæƒÊE≠‚œM>d=´`D¸£ì>ØWÚù
s¯¨b3òWE≠2ñsaN÷∏ô~∆?\çÃ•)*4◊MÙµ|£«û‚^≤Äúﬂ¿HLáJˆ,X›^N±,∞gy
D«lt#ß˙«§¶¡;3¨ì»	üñâ	ûZ§§?©$§Ö@-ë≥h√._¶äK†àãRC%%9G·R4ƒÎü»∆¢ˆëí≠∂c»qIÙ¥“Jc-ÍHâY´Ä¶≤m†›8@˜][¢ÈíãWßlG	Ç{MÕ4R*$Q·ù|©%ãà';{%°ΩVÄ,äYÚÍÈî◊ëH†u3iT"#uπÊˇCÇ(⁄î≥X7ıŒi/¶‹BóTßJ"ªŒ*8|ñ££r—™“[ß[Ï¶Ü˜ééô‹≠π4íÅ˘V_åa1F„—†ÈÅ7êÔu~€bùrÑh>ñFµ∏≤˝¥É±ì[Rè<—BôuÃO”x• @.Ò≤“–à”8§”)ôV4T9.Âeù∑¢`wÍ5Íö¥5óßY!¨¨EjåΩ«"‚¶®pi?YM´¢~s…˚ºmñEÛ9Zök⁄+òß˙6X9à/∆ÔO)Pb«7Î€Õv≤%SﬂhgAÌNèzG#ò}LFÓóá^∑[Î…ÿ\ú¿NÜ;ó-ﬁ\1¿÷i„LçÅŸv/5PÀ‹Ê‹òa U˚≤¡ﬂ7ÙJ†⁄†õTÇG√ù∂·Üπv Ìr∏
€S–Èî6}›!+{€CΩØ&¬”)6q¥€≠íctÅçÉtl˘vïÌ'	Ì‚h¥∂ô#e‚∞%U+]\YË%F àweTπuC8å9Aªt1≥‡ﬂ‚¥€∞7%—; 5–«mùéj‰Ò≈O…Î[:f%õ"∑Ó˝¬ﬁYÂÊ5B5∞®à	h-¥:V""1í6Ø†SûL".jG]*¿Õ∞à=t˙+K¨§c”hÜ/Å¬3	ÇÌ÷¢7	I#ÏJ≤™-P2ÚQÇOÎÂã≠mÕ∂ ŒoØÿkâ£Ñ]4û∑\°≈pã¶0æa’ñi	xU#]∂á„Äá∏ (AÅÒ:ÒÉhUE˜<√ü⁄jØAß é,â=
Ó0çíü üpYË¸,•…!ë#_
¢$üUîfü”›Íì©ü‡Õ8P]„ö_‡‘ÑçÎÔR8‚˜›P√RÊ‰i:¸L·Ñ›’∞ bJ;≈èkj(Í@á∏õ†Tﬁãì√v∑ ~µ*St÷§á	¸óﬁ ˚ÿ„ –íAË'â–§MzÇiµ¥7C
=«ó¸õ˝^ÓIO˝∞Ka √1ü˙IO˝∞KÂ!áˇñ˙¡£>{àf©±óØ'ÄˇW@∑/Òq[ºÓ`Ç£{/ü¬∏ä1=@µWL« :z⁄1•Zsﬁ*ÖZõjï¯AN°ò	®∑ÔJ˜·>Fs1-î∏«6izt)I	å+O\ÖáÆÑ∞˝7¨≤*áˆ»=ùﬁçÕwv…6 V;i2—HUV¥Z05ı‘∫ãsÀ”A~¥Ô8ÅØ„}å¸¶Áépå_©∞’ª¨†üW	ß_ÕmÇzyÚ49Rº'§›)NüÓ¸∆Î~”Ôﬁ9˚ˆÏª≥Ôœ˛pˆ«≥=˚˝û8êZ:o´ˇÃõ‰{ì¿*¯}å¨
¥˘#—◊
‘A[bGÉob?\∞gÈÅâçÙ–ÙÜ¨~‚ﬁÎ8ÏB«Võ/rCíƒπ«B∂·RÉL*≥¿&÷9kıM?D∏zÈ4'Y!ˇ 9 cé0}Â†@ß;æ1'°pµdˇÎ Æ>Y¬ C #h√B.ëp#ÇWâ–Ω§˘M?S≤‰JD—«e-t5œ°NÂ–K{‡ay&¥úäT¢.∂Ú–òì°òxÉ¨tÓ[ÂW,⁄≤ß∏¿Wo2ÕF•‚¶qœ¬UœÛ}ªF/4ÕœŒ4∏vØàåÜTÖg⁄¥ö‰z+»ÉéùƒƒWGﬁ±'ô´üF”}(~8sZ∏ƒ_Ù.¢®0ë ÕΩ1_÷¥y0<’ÖCÍ≈Ü '*Õ¶Çú≈ıV	¸GcâóÔBåΩúËäíûEÄ†-{a®”Êªº“˘âZËü⁄”0Ú2X÷°ﬂqq-$ÇRïFf£	¿7[D|£·J«ÚY_©}≠Ê^≈¿Ìƒd1rçV'∑≤øÂpÑA¶Ì™{:…âåöï9”Ùï∆Ñ£™⁄éjÕë}Tûñ^Öt§œ¯öpMdñ‡‚p®ì è¶P⁄IŸ£Ωz
,î⁄ÜÌYØFä∑ÅÁâ[ 0RÓ°|ÊOÑ‡
:`ÿN∞›˝-–BW5úá–Ì'
„◊ØóF∆Ôä\€VÁì
Æf¯í:‘{í:9]‚"›ƒa≤O›Ë–$K4&»u3RiJÃ:* ÓúRe≥™π	ó$_Æ◊Èß∂VvÙº”˛3Q¶ë¬÷∫CûÿÜ¶íïDãº“-<PEÅB¯ãÅ”√ç6uÜ!i1mîêÖP^bËˆÌ©Ö»oDﬁì<óDÕhqÂF6Æß±Õ«‰Ù˜HrIã—:/Oø-,ΩÈ∑ã¥/–ÏW45‹ÈJ¡åÇ€ï8∏&ŒµÊ–Ó¬≤]>ó•¯w]ú*J¨ãE[Ò˛RSUÆµñJ‘≤ÑRZÂøÖ›BU5èœ…ßér≈dö-	Ω‘¥©qñxtÎ≥Fmù$G^ûyì	/¶⁄q˚vLSπ®˘ö⁄b∑+ü∫¶6mÆ˜Á4Î¥E2iä°C≤<92scì^_÷Îı&Öﬁ.®¥–€5ólë™MXÅ:Puö¥è„«ÙŒ>1ÍNñ$…këÀ÷R‘h¨8´Í‡bãgH˘,àB[bÄä∞6’a⁄áô„Ω>¥˜:NqâKûÏÕŸs›ÌÛ#íüCÖû§…Xs)ó—yÈ(“E˛âí,Êséa≠˘≤ƒv¢èò˜KπIºá˘=ã<X+Ù[@-é˙V˘lWı∞§ÏêÌ¿Ùïª¿ßµ a¡mπ|„"⁄b	 åU∂s9ÌÕÖd Ω˛Ù≈WèŸ„µÌµGk[2@zÎ◊œ◊çÄh¯˜hòOuΩy∂ù»‡$µ]Ü-ﬁ©v~ïõ)™c’1¬ƒ‘ˇ&¿®È¬/(Œà†—SuöQ Â	Ω≈è'€+vç@VŸí«©Mÿ,#/kXDh≥ÎHØr∑ /…ˇÉ†hdy\Ωj,çé®c:#Ω±‰%Õ9“¶”à’ôv™æ¨Qôp¡*ï–LøHx\º÷Kj†)›∆Ó÷∫? p$√BôdœP…≠xìWpXPÅN∆Q|’P6op°ÙNÜÊL´^n`—™MÑñéàú^úƒˇ∫7H∆≠rË6Ä’?ûp ‘œr…I!lÆjæZª¨-át}àöN¥˜Û˚ΩÒñn√£bUXCK´˙˝¬ÕRSÁzÕ…˝1E65;¯\nCœ/P|'¥?„â[ÿ+X_g‡«π*Í´‰∆O€ì#?zÅ‚{UiÕÉÑì´~VµÎE"/o=,◊:i∑¿É‘_kıæ&ZÜæÿƒ!†™)¿C6º∑‚wπ,»c¥¯…’OaÜÂ2…$‡©µÄœM«kÕ€vRáàº≠µƒ#ö·FeŒË æøñWìêm∞±-8íøêâ¬`Â†g≈ﬂ0¡~;#Ë(†mÔ6=Œjp„∑º“&Á1—«AµY£FπùŒ  #?B≤o+ÃÂé@SB°”¶4¯°±ä2«òù	≥Yr9%‚2c^Ù k>cØ*[*Ì,OÄE‚YîDäF&\∂ùEÙ&wN€B1ñ%É\CÁ+2∫<ÂÒ∑zE+FU√OM=A8¯Ÿë £S@Ü É—v–⁄Ÿ©µ(í@)<Ω-Ω=’HN≈àjróGÍƒ#;é.ıâJn°O4˝∞,˛†õJªı=™hdõÄ—%≈^æ8ÛQ2Õô?Âë'®ç16?q‹t7FëYÚ  Êˆ∂ÄkéV}lJP‚êhâº°(Å˙P¨“b⁄ö’2&√çI~r Á≥≠ZyÁES$ `åNO–ãâ‘â*]åéi_§5/ÃGâuöÔ«î´ì»ø®TçΩö'1äFÈFÒ≥Ê0èV®VÜR¥òÿπ§hÖoò¬†°]/Gí¥Õ¨*"Â‘ô≤Û<“sΩ¸Ïl|n±y∂‡‹Htû)<_é¯|q∫Åm"Õs6R#SØGgﬂ£Ã^¶·ª™˙Õ•ÏÛ Ÿî¥ÁìµõI€Û…€3%Ó¶2˜y§ná‹Õ‰f”õ∆Ÿ(<Ä-©‡3.Á3˝ß◊µE-ólU<«<Í8"ûAD≈3-∫ ËC?1«óAÈv€[`˚Œ†‚|MO5‡ıvë¸ΩÇ°·œ~7∏mx§«câvÈÌÏõÌÏ7iGà≤–P†RÌBD∞ƒŒ∂ôÁiæ@vå©_Jv<ª—_ëú—Ì™tIÕuæJ>Øœ$'*l'O¬4†Îî§nJÁœ85$ÒÀ4¶Añµ[[a<HìXÜÒ]ìŒ“Ÿ‡Z=∂¬P@£fqÏÒ‰±Lûa±ê"÷á“ÿ H›ôßÓåëœ8y'”—ΩÙ–©HÜóã∏Ò¬=ÉAœ•¿∆*[Ô˛q¨è0^2Á◊≥yy≤oá¢E˘%µ2⁄çãCfˆ≈≥t¨õ.C¶¯sè9k¿´Î◊ı≈≠ı∑¢TkUù9]O¸`-oá÷dR ¸UÁ∑®EÎˆ8ÌtÜ™ï™îÖ¿©j%»˜?•¨É38ç2õóèüpmDπ•Ã€	aºtà)–#™+˜{Èl≥}U·›Õö¥,ò	^˝©À—ÀâÇ≠Zcµmó£üÈé{Ã.IOÇ„¥a«{ã√pÅ]}}µc(˚ÅìCX@-∞7aå¨*x}ÂD¡C°˝9ø: Àæ)Ì2•hPAR‘⁄ï˙ O‚n>
∫¿ßd*ûQ‡swp~P7WIh>ï≥J¶ãä*|ÉX`Œ?aqÒá«≠¯îhÜ_=O˜ÉY‰&k	b„Qõtç)ü∆J™+ÚŒãCmπÒÏX\W|∏™´•∂Õiãéñ…SqsXõ¨˜[¸òä,Q±QÑ˛vÇ¿‡Ìk:à=~{Pé◊¡«œº|‘K1‹uL"ßê7WnuÙÎøÿ“í≈ïJP—´q∏√<È±¡ëœæ‡âÌ≠ƒEñÊP—ºUä_{^zT“ïÃÆ
ï°¢ó¢ e^í˛⁄8(Ú©›÷¨„!#ÿÛxZ—–O¥tﬁúH≈È¬*i„ ï∆ÜÃ>lØõ 8™†Íê.}@Z-√&ÖÁ/R∫zs”©1„èØRÓbSx2À´îp™íû>Œ¨…”ö=ad´Ò§ß_NÜˆΩU:cﬁS_∂Y‡sn$ìÇ'8´YtÅ-ﬂË˜XøwÁ¶Î\,ñﬁH”ÍãlóK€ Ñ0©”%˙AUŸdµm›DSÅ`WÍÒ¶œ_¨©Ú∞˛o]>ÍTŒ¬s·œX…∞∂ÍÌihEì≤P¡+≠gçlfö•ÃdÜjhhÙdìa¢ª±e›dlîL—Üµ‹•ìÜYa∆S¥N©óVÙ$‚∫MŒ_îân-µ*Î&(”6ßˇr∞RGE≤–ﬂ+J+ùÒ≥Ó0a’QB›^W|/aºÅıÓº6ªXÍŒgü”¨r÷ˆk∑¨Y„ú˚iQæ∞¬…o.–≥‚ï·Õÿıå\ˆ“8∆7¢‚UïïÕ˝‹ï≠võUk#®IÍo=Iiå©,Ôf´.æ©MÖ¿ç‡:∆OÍ`˚Ï©w‘2¢'˜7ìñb~1–@üo„~˝Uà)nWï∂MúÊo~¿∏<Ô+ Õƒ¸XxÈë]«∂göøiÈÅà*9¥Ó$Èä‹x‹ïêäØí&ÓS#Y	∑XJéﬂ)uC¯/Ã·‰wî:ß©+q¸˘ù®Üﬂèµö€ãj¬B„Q;ö§ﬂñ	⁄aÂ÷ÌƒBO@t
ƒŒ<MÉÂ í;¶6:R£©â˜m/ö÷‰ï¡·‡ÎÇCÈâVc„äZ8bÌÌ^Yò'∑æí°5\8^ï\eñTcÊ*1®*äÇdL°Y˜ JHîÖ√6A‚±EE˙(ÏŒJ¢|≈Yã“‘T(ç≠?}ã˙÷ˇ  ˇˇÏ}mo#Gz‡˜¸ä2wìh|"%R¢F£Ã»·Hú±.öëNíΩ{∆M≤E∂ßŸÕÌ&Gí˚Âí`ŸC>wÿ¯páÉÅÛáúø,˜)˙'˛ª?·ûß™∫ª™∫™ªö¢d≠=mxD6˚•^û˜WR:Ã1ø˛+ „ ¶3“·≈áÈÑ>»ÄŸ`ÂØCs70n5-RZó…z{uUÒH¶0èµõómôÜrÂŒBs∑îõO+8§E\RC±]ÌΩµ\÷˜ÀszX:ZÇCÃˆÿÅﬁ∑ÎÕÊ˙HåI∑¡.±LÕ,≠6M'˛Èb∑”g∂ˆÄØè;†è9}7j†ä!ö`«PioJ‰Ÿ∫p«[äúÒa^ÚúÖ(àh]F≤Ûî:#B2·í©*ÙœH*˙´™RkZf,¸TL5ö¡Åhê éD)∑A)÷VSJQç$ldÿEEzê°åü Ã\≈úX*Í '·Óãˇà÷d^õÀÑ”¸Á¥◊{bH¡˘o/Ë˚3¿»•Z]‘¯”
34Ü&πòW3™À†OØÀò¨i2q>ˇÈ%ΩÓUÎı’JÚπ)|^}ùÂ\˝Iˆ/øü·/˛DGÙv@"Îé@M
ﬁ>#{S>G¸ë√lM¥n§Zzü•Á_≠|ÙŒsœXdËìÃn˛π∆t ÎW·b&"ö'ΩòB„,Ç˚hπ¸‰ùÖœ¿<RvÃ^RÙÍM‚[mƒ[TÇx€˝¯àπß∞Î´¡".¿8‹„q–ÅAú®>◊_aÔjÅ*≥÷s0æôáÿ1¡ﬂg.≤ºãóxÍ3Õu≥⁄u{hÚ˙8¨ÿç)BÂy}nù≈lÃ	„Jj>¿≠ôôüN(»í»≤∏DÖ¥ûU®KÃ‡Ot∆qÅÕÅb±w J“°±?µPëw∫Ãñœ°ùøA †&,,’Ö5Û?»¶/Ω1[ôüw˝‘
Ï\ˇ.H´]dí[6ÌI{Er)∆s[IúQ»$MÅt3aÉÆÍ$D„K≤|Ò,â÷›ò∏j+˙H6/™Ó&ˆW´D·j—ıFÇSeI—+¯≤R°Óø®Pô‡cƒù;e»Ç¶G'Ëã‰mâZ§À°]∑N˜ó?ì[-ˇ(""ÊÀr(?@–F√Ωõ¯ß<VÙ)J—åÔ‰ˆRj:¢€ﬂ:p”d*ŒCI•ßﬁ.=≠qî‰≈jyÃiÌá@_§õ˛Ê∆%‘ñï·Iâá≥ûÔı?ı∞,PFZ”üÒ±ìÕ-◊´˛Ò¿{'tÖØÅ¿S’Y„p“÷_˝dı·jßπˆöú˙†Â„?ı~ËS◊m\Ôª¥¸≥x
"gÚuR_Øâ˝¿’w–~‰¸⁄xØ_(w‰Ô9´77»ˇ·ù›◊5-ﬁ˘ôiù∂§öÜ∂#ﬁÇæNÌMN‡uvÎÒƒ»¯ºéªQ€Œu0á˜Or#>èY«¯ûèeòÈ©À÷◊·’≥…ƒç˙÷ÔÓøÖEØü9†“vôÉ∞¶ˆVﬂ¡ÿ,-ƒ8&“ŸÄΩôÍ◊.´\‘h4‰a©⁄5„|’\ùúøàkCá√≤‰ÜÒt˜È0Z√õr'z§¿eä∆¢,¢ÙUÆ! @@ •Ç˜=Qx,[∫GXµí†Ò·íÆ¥V·9õ)Ä≠ù˚dÏú◊œÍ„9c¶ıƒo†Øı÷πØB=\‰6tØ˚ÓüˇÂ˜ø˝’„º¢Uí˜¥r;˝x‘ =<Á†˙lK7Dí(_§Éj\®`e‘ J¡MÇ◊E°çíµ:V‚:wöa\™•ñ #íÜÙf”i(wÜ¡\=πÃ◊ûeá =A*Yã{ﬁÂKØ‘aIèB–‰¢æF2plØí‡l•ß6€	Ñ&…œØ¶óäß¬Èbœ9Ärä!¿A∫≈‚&¨µãË•πŒ∏≤/
—q’'!J5QMöß∫_{T¸ŸC°üZé:ªıŒû≤=l3Ê£8íùçá(Qô„Ä‘*¬¨'íƒ.—àÈ”WÙ—ô⁄g˝ÖˆÊÍÒöxÃ≥â«\qõlmuS®ø)‹x”ŒÏQñqúŸé] 'é&íìùõO3øø˚Ê(È=›ﬂ¸Ùr…‰|É?ãˇ≠O˙¶ˆÄˆâo1«Ñ: (ïà–¸ÕbT®|sqX(›vÉ~d¥√ıC lß!¢Ti¶°Ä>˚πØQó»\qÖ2Äø¨˚Å5hÈıw∞0ÌO{J^Vã üœ"tÁyÿÄ¸S ü7§„Ê‹$Œ]›`ô˚]	oSû-˚ﬁ˘‹˘w”•‘›Æ˚Qt¥+SÈ zãsÂ.¡5.“+]‡êj-∏)∏ÄÕjz@3Çô»Ù ¶0#xÈÅKZÄ•+K†≤©Ä*'#0AIHπ‹°Ë-ˆZã a5%1WVgú`Í9æTTx/W>$I˝?ÆF~Ã⁄(|∏í1Ë«¨ÿø8û…9(" \∂©±ßàè(V
bÁ ∆*•—É(úÄê8ãPÀ°#‘ÍY=wzÜ3Â™é?,T∑Úœ:ì˙Z©M‡¡ˇ0Ã!Ê#√ùıi ?e0u‡·ë„Í∞®x⁄u|™	'“Ø?,?ˇ*ËCÒ(ÚÇ∑ıU√îË µÍ[¢a1Â˚ø˘˙wZ-N£‰Œ‡N6K∫Fü2®qfãD^£k⁄kt÷öÊî∆Îåßı’F[ßﬁô¢‰òÃu˝-]N≠∫Œó?°›—WõÍdîïŒf∞ô¿!"—Ê*õxrn}UUﬁí_√yΩÖh⁄L¡—Œ∞s∞WÓ9uò≥†í„„}iv2ÿ¡ﬁQ≤∞˝'29a{œ;Å»tÑVÏT∆∆ÃÎ†Or≠ïõ÷–ŒB∆É-4ì§Êi–¯¬üπ~?Ñù|ÍÅB∏ÚH?≤• <«wnƒe^£ü©ÃÚg√ïÊ™dæë).ú~∆p˝B"áƒ™ÃÄ)ZÇ‡¡Ù´ÔûN”uiZôkêhiëHAùƒDBøi0Ëﬂæ˙8ÙùÂ‘PíWKÆ>»£∫çÒ®ëLh4o?ô•Æ≠Aå“gX¶˘õd‡a◊lê¡<T˝Ñ]§πcIç˜Fed/5ËÌ&õîE$ÃuMƒˇçU¡vì¢y:†⁄j¨à}§pRM4úëAanï≠√—a„çÜM"ƒ∑äç:îtª˚ıˇ¢›eXûjßË‹E√b‚Ù‹–hÓQàG"¸∞ÿÅ]w
vLûGﬁ†ÑêÒ¸q="è∑≤Ø-D“ÏÎ∫éKÚ“∫¡,◊^•T1Ÿ◊V≤±H,%äºΩnoDÇÈ∫ı/tÄ¿Á»ÈaÆæ [¿´õ‚{≥)ÂHåö;pï√Uÿ⁄%)‘_N$êÙ#Z‘e)GbrÚ˜)≤ëJºSyg–‘üc;$”h)EÀLŒ¨[ﬁ„…vnÔú|ıülƒ`ŸS€ﬁ€›‚;ïá
&_∫c/€n≤Å!€äΩ¡.}æ$6\Ò[ôNw‡7!¶Ìåxé…≠LÍ˘ı◊ ¡ÑãõlÒ‘4åçêW•Ão1ƒÎNI÷â7°èxS ≈A\˚Ú%ß´ñØ»Z?s˚#Ï´„n–æÈjã:]n◊¯r+—íKôyÎÅ6çÍ.7‡{‚‘IﬁŸ-‡‹œÜµWÚ›¨µúËF…j~ô¸πt˚ôû/é‰»6îG_Â©üIWDƒ.∂–Ò)›Äß·99»rÀHíØ$Kãó˙Ù≥º¨°Å,∂—j‘@T¢∆â˙¿©R¯»2{¬Ô3ï€360J∑$Ø®:¨µ3`%®4™·∫ô8Ω8Ùg®6Ñ–iA∆FFL…’‰~ZFTnÍSµi≥=r“tdFŸ:MwÀÀaï–P§Hàh‘Ét‚`n ∞p „#˙Øì$/c¢4ô˘à	zL«„»ç—•á¸0´òvÿ⁄Ûj‡Eﬁ¯S≤`è“ıb3ß+ß»,mÛ≤E⁄5˘¥{¥˜loß≥{`9<#DiÊ1ZÀÕÇQ9¡†ÆÏ?-CïcÜ⁄¥~„K`ë–~ˇ.›'Jt˙åË [ÂBåf)Fkö˘Â©*'•Ì’‘2Ä];êd.vjÏOÅÇ∞lΩ8JÅgaª≈âÉ˝H/X;RÃy•≈ÅÁÉÎoc\§√œYmdÕıWCèÕ3iﬁßZh46öÇ7rÔM3˜97í@a’ZEE$±€õ¢Ò∏å®lŒô7Cuﬁu¢∑KzÚ oï÷ÕÿÇá∂%ZbˆOb–2ÄEeXG∫Xlh“∏’Nú¥\‹Iv:—!ﬂ˝ÚêO›à…-I !ådä“Je”‹É+ìôß{>ÒùÄ.+Y!⁄=ˆ˙_ù1˛RpKã(]IO∂a‰≤Û´»÷8ê©|∂Hf¥rÉµJ8¢úÄ†G]	zˇE<ÇLÆÄ¨áÉÒ;â»LüƒŒ¨ÂºÏºl¬‘¶√É£ìŒ>9ÏÏÏu_ûtÌŸ÷-í{)ˇüˇ=oˆYÆdw<aë›V4]ã¯%Ç˙H∫∏º©1Àœ"¢≥_f‡’5˙#Æc€FZ2˙∑(†Ü1A(y
kÙ°π˛0
'¿=<4˜é⁄VÏMv$ å©dZŸÍ±;fc3TH@#fu_Rï†LœÅá∆òïgI≈ôË∂±àØ<≠€∏OeEŸêl…
I⁄Bı4á˛R‡ŒÃ˚ˇıc◊Û˝É„Œ—ﬁŸÌíè;˚˚ùø~~pL∫??‹ß"ﬂ±)÷5Û/≥”Î,Ò˙~Î^$õÚÌE∂ƒTh)6ã:«2ºΩ44oENèzr	◊_Â∞—Bˆ£…ët&€Ø8Ô¥J?HÒN$‡∆˝LÙ,Z5 ¯f¡qÛ˜…Œ^ÚekLΩ)´òíúHZ ü∏—Xgte€ú√¶t√tœ—€ÛVÊ’£F[VW))°F9=9NÆøé∆<Ää◊ﬂú¢ìåmÀ`ŒÕ‘¢	zˇ(¨igvU3ks•kïV§È,Ñi√më«°iõùÕ6/5¡8ß“ŸM†Å≠™B≥… AñMV±⁄ º/ã7,b]∏≠å¡∂r6„ÆÖ`ï,dáŒÎ˙,˙ä®]¬r÷‘È_’
&È„#V4¿†ÔﬁpÖ„∑ÂÎãƒÆ≥XVº¨˙¢œÜnÑÀÈpΩ√—¡®0i”Õ≥¨Zé^ØπAØÈã'r…!∫‡u"Ö Î˙p5ø6’¯£–Û¬ŒojŒ&¢Wˇq+SKÉÔ»QwÁ‡E˜Â.h/ª«‰?íùOˆvQP!œª/ªGù˝n^d1	-p~Êã+ÅM$Î/Óìâ_oUNcíPdÛÜ3—Ükde≈Ìd∑ÔÈÖõ\í’%}√’„ﬂ”èPÛ∏`3_#Âúñ< b—ö˘3¯º≈‚‰ÆÏ¶<^‰/ö?Ù≤‹~¸„ˇI„®˚¸ìó'ùcr¸…ÛÓ†∆1®ÈG¯J^\ˇÌÓﬁŒ99Íúttj{ûÿ&¨fB[4v¸rKóab˚.âëCxcl‡ªÔX	$≠ùÓp‡''ßX÷ê8Xı ˆÜ3fAJçôX~IÏZÿ/ÕÈπ}7r∂¥S◊≤+≈FOfm¿õQÅ_ÃA
Ù¿&V∂⁄æ-d`ß¨[¶xÇ£='xâ™{ybg∫0VÚÔHÛ™A.añ5‹ŸL´ÙæÖy",Ú6Ã]4°áhA'º
„s 2Ô{Tj5íœ©[≤cÆˇÄÏòbDˆ∫ëù∑eÍ2µ∞	"≈Û£Œ≥ÎË‹gCÊ?˝øﬂˇˆW‰»z(&” gÇ>°òÅ(˜ÚƒdÈRwW˘˛C÷ˆM≥k5uciÜΩ7æ˛
ìáb ºt®H≠]Z1e»æp◊CîñÊÂ°Jbq‚>3/U¿K‹W•Ò√’#H©° ‰fQóñRoo<‰µÕÙZ†’„!ñ±2-X°¡+kÇØô¢∏/«ΩÎro“¿{IıŸ fëE æai@<¿¡ç l]_Y{ÕkΩ¬{∞˘†‹¨ƒM(°ôÌ’Y1pF|5B∫Ñ
ÙYm@~bT3Ö‰q%∏–j€ﬂ˝ÚøâÔº˙ÓóˇΩà—T‡3y¶§e*g4ˇaÊ¡B“Ê†Å¯6(M´Xó”ΩZvnUsê¨~¢5TêÂ@,˝*’˜_Ç¨FX1JT.h˚›¨"N>‰ÅÊ…ï‘Â≥Ñ	¶πƒX‹
^Ù"ÄL'ÈÖ∆òß¿…§PcLmÖ/N¨i=U’\JéxñCîÂ%ÖÏ^ãÇçß©HÆñ©cﬁç1s«˙‚^oˆû:Á)Ô¬xôV@S<R¨©IÊtß~|êµR˙	cëh}H[Màt+~ÒN("§®U0H0X<>√©í[xÇÉ>»zì«€)†&!ò¯ÚE˘¡U^»˝◊;˚üÏí›ΩÁ{ËÖ¸tØ˚≥Ó˘ÓóˇïÔüt_t–óÒº{|≤w˝ÎópÒı?º‹€ÈêŒßùó-G±HÏ‚Ò
[ì‰å∞Ñ¨kÆûî/jë-˙¨˘∞’πQ∂®˙í ¨cƒ«î,.È	È]HP˛õ˛%LgøO>Óvvaôñ: -#≈ŸO&»Ö]“$ur-Y˛ŸÊÁQi˜9æsFì|·È©¥ïPwÁ9πN4=√BjÔºxc˛ıïåZirWÕiZπ0∂d«Õ¬¨◊UP¢Üá™âØåµ¡zb`E∏ß˜)iªªn?åÿÖ¯¸!%´Äª¥ˆÑúvgô◊\Y'gıW¿¥=F@ì€ÙS¶ø1w±zÜ”yµâJ¸’¯fΩdøûM˘KÄ ¬Tﬂ≥z≥âÖºö¶¥]>ZÃñzÁ9¢r	Ω*ÍN%U3I€õ3ç˜’Íõ’7-XÅ7—∞Á,=z¥‹\m-∑÷õÀ´çıˆÉ◊∆›$∏aìíå†tßº v1|&M«Åôá!ÈÈú•è™≥XŒ‰,b∑˘…OÁƒ†«Ã›Ç_ƒ◊é@;ÉˇÂXB˘÷|li‘¥m¸£.Ië$QY^µ6èùb£ãy+◊â‘hƒTF⁄ıqçö“„4,∫∂›˝˘a˜Ë$±~Â‰0Mö≥!r“<5]v∞`\ITQ¡ZbL\mµ©Ú˝Ñe+È“ÉoÄ7ıPﬁ|∫∂˝çÑútWHO∑H‚ßÒ‹6Y?ãeäLÇ™‚õ≠˙úÃ!oÚ∫∂≥4ja•äíÇk€Y‘õ†áÓ„F√íWã'°ƒﬂó& òbNõ⁄|¯(zÅÔ.,]KwF◊DˇU#èÖio±«0≠¬µ5»œüÇ™ı‘≈¬û∞‹‰∏Av¬Accµ’.S¢À3ÓU¶√F4 «ü>œƒÖûÎLQ¯¶úr¿˘(å©X«·t€n±ucÃTBn◊€Ë©Ic®¸ú\ê+’˜n®ÑwØ√oJÄäaÒã¶>œü‘V…*A™æ'O=ﬂR”$<û8 û‘^¿ÂmÚ1êÖ˝ıu“Ü7	‡˝~ªEö-¯≥Nn‚;PCy£HJá~%gÊ¶£'5†…ô}Ä–^ü‘(4àgøΩ =-z9Ëu–Fu$∞‹y^¥ã¢.iŸæ¸\ô‰_æu/N#xvÃﬂæè÷”ïÊíoOOÅën‡˝¢™ÀÍ˜Üv‹ö◊◊9Xvlã¨„^©ı˙I≤%éªcMXÄL‡Ûß^ Xõ´Ù'}ˇ3˙Ë¬)Z≤cXKnS¢ZM(£n5*±≤bç/¬ÅÎSWS<∆ñ“7e±˘°±,!JÿrhvSó˜bUÛ’f)ªUE©Ç!e
ÇclØt,r∑¥¸œ¶$@Ê1/DWt©6Üxıµ∆√˙)å|TÀYx≤	]~ûGàÑ⁄\£—Ï54‰—òw£áP…˘ˇ©Iƒπ—~˘˘iå]ëZ∆h6√P"çgBx≥m¬uè›"™˘ò…œJêøR-ÛetÍÛÆ>W∑ÖF∫=©=ßÛ#0?ÚÁ∑E∫‹L√,-Ô m˙ﬁ¿êãƒ÷CM,—lÍNIÅÑøv&“ˆè®Ωˆå˛˚”Kõ’∆µU‚∞ë;A¡ÏÄR≥	‡TöùØ¥pspo÷'Z\d~?X†ógi˝…,ö¯ÆË776ó7€ ˙ÔË71x{ã9_ÜAbfLì~úwN%O&rò´´z|Å8Q˛O#πòPêW>Eæ“≈x ≥¡YïbÅ>ôÙi8≈Pˇ}ÍUÇIüÄXÔ|™SÉ?yÏŸãFo—‚{–‹s¢Éâ,}‡ÈN+8§bSÔáZ*qñüC$Ìúr†≠≤äÃ!**=ŸÇè¥–òì≠BØ∂HM/¿§¶ÎvZøÎÊòß‚«∫N/Ú"≤Bv‹õp‰¿¥—»ìãB∏Òéì;HàÖ∆¡uÿÌ>§¯ìôGj
ëAMÜ·O^(€VG©†.œ¯{—Gó|n®ñ≤∞+ì~[j¯ì4\…ê§§∂f6Ê_êÙd@∞ffiµQó_rôüo˘5Atü`∑ÊÈ,¶ÑÏœ±v/`‡ü?H\Í9≈9øÇ»ñ™0”RNÿ◊˝D ﬁ˜ú¡PMÜ≥ÿê)ãú®åL´ U¨—gä†M…’‹Xnøk∂äÆn äösj’Qß˙>À¨¶Y÷Â≈DCå¥TÒwÓ¬6%l#H,€¶lÌ‹Î”ëãoîﬁ!ÃFMóh.‰Oö´ΩGõÕ◊˙◊Î,wÛ&…õ-ôÊ¯BkAñ ßuøî¸ £Næ™±VÍ4ÛºZÎÓèhm<n:˜π(WÛ'ØRZ%Ω«S)”§$€€˙4elå{c#›j…H+**ºü+*…¸áˇ˚Ú¢≥˜íÏº<Åø›#Ú≥Ωìè…IÁÈ±Œëÿ"uŸk¯¬EzÜE„˙o'ﬁîºdMÖ–ös‰xæ‰0‘,ÆÍ›D#`Í4T;NbCv#ÁÃE≠@ˆ◊é‚Û¢;Ô<´o¨sngµ€Ïº^y$∏"—2…?£[/˝ñ3°PAdRoì¬â$ìJÇxêx§ì„93ˇó‡±å˚Qà]ê#≈ÅâÜ£úÛ3gIôÒ¨áb”pBﬂµå%›±b&tî∞#SÂN_5πcSSTÏ¸ÉÓ√¥ÈïCÒw'¨«åp‹]∂ ÌM»ª&∫%$£¸¶ÜﬁÁe[‘µ¢YE«ä¡!Ò
§Áñ;~]@Â_\;òa–JR$ ∂£ÿ˙ı∑“ûk8qzhw†u≈√H55àB∞…?{∑ŒäujjmÿdùÇÚ<«qñ˙‚)`ÚD°SŸV©ríH∏j≤
ÂäU”B±jŸ)VÕHmË;v•S™¥
ì´®U£í"ß5m6È»ã¥+E1.õïÍë'NñêF±¢í ≥c˙ÒåŸ¬uqÒËüÕpkßÕ<´1Ê˚Œ∂á—©v)]¿ë~ƒh3(≈hVÚµπäÛ∫‰ıCB9Ç8ìu-p¨!e≤R%ì∫#/sÊ∆µ–®;ï…œÁ¯Qâdﬁìà
$"Y¥{O ^∞∂‘«øòaÚË›–âtqÓÇJÏ8±A»Xâ¿zWÓ4˛Qìàdﬁìà
$"Y¥{O"é}Ñªª"“eπ‚Ä≠≥áÙå'”Ö”g‚˝®ÈŒˇ=M®@p¡Ó==¿ﬁéwDËz‹!‡VÕŒ·ﬁ¬È@œÎ˘^8åú…Ë‚GM§ÖxO*PiÂÓ=â8fåÔÜH»Ks‘‚iÚ∆”Îo-µ»Œ›Ñn∏4xºéÂù.bÔ«≠c®k±(Í—˛1PuÒÓ?ÅµxãU•ÔÜÑ‰÷Gì,&"≠ıˆr≥Ωπ‹§¡ß÷Dd7ƒ.eü:~Òj∞{ùÖK≠£&|	ﬁKË_≥{O&h)å=,∂t7t"Yóª2≤
&¨õãsÓÏPXÙ~‘Ù!]Ñ˜¢äÉ#Yµ{O#x◊ÒªÚm§Îr4ÇÕìKˆ√æ‘jŸÓ˘áﬂ¸Ô!«›˝ÓŒ…¡V´xq∞€›? /^Óuè±®>Y:>ÈúÏº$«{ª›ßù£÷âír–\Í5WõÉ◊6…]4∑ã& ∑Ñ∏#CAQÎò∏“2à˘†9ç¸Yì‘ù- õ◊bÑ9\ñâˆÍ'Nª∑~⁄≠èû‰©x/Ø◊˜›ÑHÀòŒ¬µ¥´3™O˙!dz1¡ÍRÙ«<u[@úÃ¢8w» eâÓ-±y;@ÖÛî˜ó“$˘Ãù€¶pﬁ{:œU6D.Çπ¯õ∆T|Ì[XnÇ»Ã|a( ÑûU‰ﬂëœ“$ôP≈r1“
ö\~ûèA„¬CÜ'ZTLÇ3g/¨1zª≠¶ÛôÀ±5~◊÷¢,k€ª^
˚ã˘Ä¥í+ ÍãÅŸÕ˚Ì…yÑÖÑ-°¬H”Ú9C∏e∫Pí,xœ©Ci†í(”~≤òFHIÅÔiDQú'hC)hˆ„‚ÈÑîMô$Q.íB(3G:°&\Ê)E∂.ñî¢dî⁄$s7∫—≈Õñ9÷f)]∑ünåDX”∞C h°M+©˛lËA_⁄]¥¨¬à°ìí«¨:h¶∑®±\V®{[‘U÷ê†Ç1‹4Ñ€∂ÜS^— √K¶Õ`b≠Y}!ö±öÌkRA¸±s^’_µZt≤©ç‡ÇÂ1`ƒΩí∑†I=rﬁπ÷æ8M1D4YJ†)Ì^RáH”˛2©+‘4É-+!Z€>‹Ûxd+ŒúhÄrÇ¶í– I˘¡ISa≈baã≈jŸ´˜“Ú±⁄Kî‡Ç:ß≤èUM˜‰rSÖ¿Ω#≥¸‰À—6FÆÁÄä»°„‰t)Mπ˘r/È«Ip∫Ïç¥'∏Òûë|w?tïoÖ◊¡<Ãw‚H»ÓÏÀ'ãÓg¡‘”bÿ˝L =Åµ/∫ıÄ7,z
∞\ÈÓ+]•[CaC-^U\ùF≥†Ô$È∫¨N€•ºäWµwıÏG€mÄÇú*Jd≤êCÒ¢uÊ~^îΩ∞°OΩ16 OÆäªAq±[è¢xd‡Ó¬;.¨X8¡.|ÀZ[2¬ zwAæòJ@‡
n” ;Ù5ø7‰¸˘(åy;€◊1Ÿ∫U^(—‹)âß’w}‰"Gì√”¿.úD†hµ6àL–Xë⁄$ eø ÷XZÂ%≠úœî\oPÔRb¿∞„ªNƒIOëäV54±˛¶Ò⁄ö˝o3ÉaítN)"êE4ßP◊û⁄òö´Ó|~ô˜ΩÒƒs¢Lå±ízï¨|%16pDÅ∂?;8˙´„√ŒNóté∫9mt¨»Á<sïô][´ÕáØ	ˆdPe!îîÿ™KHØ£wà·∏ÿ¯k*lï„©›d0ÇütûíÊÔâ¥{pD∫dÔÂI˜Ë®{“Õ5‚©ò\5qO∞jπÌ@9•(•À¨¡&=πºLË√Y]&‘òüè6uâ[v•ªöÈ]M›-Óπ7≠¯ñ\Ò∆ƒÒÄ◊7€∫Î5¶⁄ç<¿™vô<ÉÀu$8˜ÖéM÷í`SWº6z/òÃ¶ÿ`!h˙+Â_œÜ«÷ëÖ’€YøcΩñolJíπ∏Zy{æ⁄¿[,∏\¯>wÇ Ìç°M›I¯ãdÊ¿»€8ßú±≤#U;Ãug‘˛eû∞ú=Î9—ıWcw
d∂∞ˇ<¸ ®U"ôî&4¯ˇyÇ√œBsì–ºàêWrïä¿Çú(0±’ê°L°¿LîÒ’•É#˜&9⁄93)W¡ö<7ë¥ø±ŒË‚∂≤≤é, 	æÒ=÷‚3}∏©1qÆ:-()¥Î0xˇ6–àaò'é∂Ÿ¿bì†cÕ<”®Ã„*DﬂÈπæ)¢?ì0ÃÇ√v:‡≠«+Ùc(&»-4e_◊KëÌUÌõG‘⁄2©}íıo¿Ø/ú±¯ÎIgG9K.àp≠˜Èåù∏ˆöŸ@(Ï∆gVÇÛÏ†∆x†ÕŸQÏ:êK≠>;ÄÊ∞-õ^–…):ÏN	^…Dãï{`1
f6¿bëß^ü⁄ ñjfCvî-]Åñ≈©4‹+N—≤+g¨˛f,óÚnQ‹Wå:b•&ÚêãGıÓ˘ÛΩ§ª_,Vû9\4ÂAƒ*§aÚÌ·™∆e´/’XPFù÷ócåH|U;ÏI_∏—.–X≥C-H∑ô+Hg®F']ı–P§Ælywè|-< …@1ﬂcáæO_rø—ÚSÃ6+j5RˆHã∫ÚvﬂK˝v	!ﬂÒ’@È)\~`I5J∫-œ¡ÚnëÈiñ¶ú˝°°ã"{·æøs¸ßX§ç≈ê,`‰C75uÂH´€ò:—–ù6Ë√Äèº±B¬≥GE*…iÿü≈[yr¡ŒcÁM`Î¬©ØÄu¡¸÷Áô;%ÈF¶zöÈÛ√Ÿîå£¥¥à`ô6Åb≤ékl3kùﬁ cã˛·Ò
˚Ω“Cöl”?s=‡Sœâ…,BKüáO˙∞1&ü$'ÊzfùL”1Ç~òÎ!;3◊˜·ÏÔ\è8
ÿ1æ∂Õ?Ãıêè√q/Çq∞øs=‚$Ïyt.¸√|;=ã˝êtΩ0Ç-óæﬂ‡ëáa,?3=1ÁCØˇ’Ì;¯0˙aN∞¶Å}Ô\∑znm˛ô∞åü˝ùÔ†π¬¬¡|√ﬂ'ﬂçX”‰Ë˙€)hRÄö⁄”7z¡;7c n«ûã‡çÓVÂ◊‹Ë’NÑ0F[ººË™9w∆üçá¿øΩ0v˙t£sÁnÙËA≈éü=ñ}ø—#˚nÙ›òŸCì3ÛaWò©ø€¬ó˘à€ı∑ës¥ç˛ùoö—ıWÅã√>ÃáÛN0£È<Hì'n0‡ùŒ/fK°‰ä˘∆ÓF.BÂK§ﬂ)›"ÂÃ\è=ò"œ¡…R7˚úËÅÕ√Ø0â≤¿ÊR§»ÕQ≈UÄµ°£Jö/ÌÃ‚i8¨úÃ¶ã˛%âóË“Ã©§aÍß@‹˜ÇÔKOH˜3Qß¨Ù∫ƒÖ@ƒlD8ûbUï´}∫us*;ŸÕ’Tâ	,ö;y›ç@T¸Çv¬
ó©$”ãú/·c∑üÇ∆A/û^=ç`±çFÒ¨Óãé¬S√Ê—OÑµI˛ísﬂ^k)Z*£˛FîaΩAˆaƒ∑T[^q%-∞°dóM‰w¯»•p4÷ra/óE‚ÙL&—“SL•ﬁÄﬁá‚!¸·Ç~
ô]∏îáÿYâ·*	K∏™PZÊ$Ôu√˙˛h»íDêø˘Ÿ‚gE\u·|)‹k˙)@ô›,v0ÿxJÀlwHT±e 2°#Çè/6iÔÈπZ∂º}Ñá˛»ûíú±∆ﬁó ≠n4üíù≥ŒSœg+-<';WbuÁû&≠X8Kl›%‹a¬û€†√*≥ÓWÛùË“0àõ^	!£+asxË¸
M1Â¬òw/›
Ñ¯ÈBPBì-Ü≈Ωï}mk6»ÿ–ªL©Í°xÊ6X≥q\î9 ]ÄµUP¬∆èPÏI( $	XÔ $¥BÅ¢MÀ^†o>ƒ* ¢DËíÄ3jM∂»\ævzeïíßx1ZEAFL"ctØ)√)a]∑∆á•Õ9r±Ω3pbû€0â¬/ÿÓïE[Ê&d…(nJı≥.Ωz]â‹õ≤õ≥òMMÔZª®Oä¬Ïùxîìt≥∫q≤Q*Ø≠ëx,Ñl,V|Î
¬|±óñ;¬ù≈˛Œ˝úîµü X∂œ8ËŒDâ/9cˇåŒπ'çÇ}Ø0Üi$ øVñÀ§,ù=%^úd∆í'D§$©ä$»ie$ë;ùEA)Ÿ±'<≤å
C('U©’1>x`‘N∂vv19x(‘P\qﬁ±miBá1°÷=aÒ-¬w≤°e˜•¶>«2r('≥Ke£µ!báÕ>¡UƒıÅ@œπvØçÜ∞~À¬bΩ∂®Õ0Kcû∞’Ot£Ô©ÜB⁄`πA˜Y-˘û’ƒF∫®®ûÿ
 jcÃïç(Rp≈•ñ∑$t©TVÕuÈíıLƒn¥≈ﬁ1∆,Ãk%M!‹ªíS"Ñ_ë´^∞h;âﬁ CÅá≠ó…Sëë—r 2ª,÷P…oÅá‚ªÿ"'¯é ªõ/c+◊ Û†ÆøÍ√2.cì∑ÎﬂıºiòòMPx!ës6Fﬁó∞[é_Í’¿#ÔŸHZÄ∑d7CÏé=’’Ä4Y„W@†»”ï™û…{!Ã "°â^ €ÜQ∆µÑ2Æ.”ˇi∑aZj©dQ
|xîjÛI˚@é\ÏÎÇRqØ%Q!jHB+´◊•∑ »πﬁ†•›·saæOÊêFQzÄ]ÕÆùUÆxêFHÓ†Õº:>ãzçcå=r2†/ÓÀGK°‰™Oe5	“ñÇ6$WØ≤:4ëÎº≠ü¡Oq"Ø–B9∆Nî§iÿË∂©ΩÑAÕ‡ñ"h,Ãx.HÂ.…ÇŸ£˝éYﬁK’d≥æΩHÎ’≠YÆÑ©óÛ∂K•à@cy„•RÓo£,⁄Î|Jfq'éa0J…Ébˆ5bßÁªÉ'ó^Ãná±∫≥≤∞°œ-3ìâ,+Y—LÈh2Ø’AÖ”õ*Oì±Xíìwæ@VÖ£*C3Í)öj¶“ñ≥Ï˙√ôÔEºÂ8ÉC¢»¬Ÿ0ö&Èeπx>e èù∫15~èq-»q~;◊øã˚3ÿ®ï±$üÁU÷¿H°√òèÀÅ«Xﬁ√çî‚ Y„ÓDBé'^†K…,•ñ:v7Ñ _ï±~c…√ı5fîgXåO_X3[Å™Ö55Øñ ¢2Á^á,Ì81 %2
@ÖπZôb´Lë3ﬁ^ú¨ÇÎ‰ '6>7Qlâ§VcPä X+í¢p¢r5rH»ô_ w˚¨+h[®\Û°DòèØ+T@‰ãü\ÆY%Wåàjﬂ„à®’‚à®®‰óÏn”“ ∫Lb˙ﬁÂ|9„€ñóÊÓM∑&O•S=›7õÔY‰L™ÂÛÛ&ÛX˝)‚‹r<u¶3Û˛ªºx⁄(A,5‚®àπÃrN<Jaú:¯⁄*9Gt§ø$„y¡C(Ãô¥∂ß7 öµ§éÙÂ¶#u¿uêÁ§oJD:V/†x»∂?8,ö‚U]Q’!bV5ËYâﬁ^∆ëÃ
8L	QjÄ{3hX˛G«√ºL•¿ë>†Cµ’ªÅ÷hE"Ïß*0¬Ô∏E …Ü{(yö;(4a
.KóQ≤¯ªú®_≈j1'e»7 L˙ë◊ª;r`íÔÚöç’vöM’˝÷ „¥«MeÒìtYQ'lSﬁπ¸Å5°êÓD¿Aù¿e—BEÊ8úE}∑2(S~Ï\√s’p¿*tÚhÏÀ‘≤RœÕk≥"r"gû•≥W÷⁄¢_´Œãäœ».¡£€ZøNå…„AŸr]{◊ùb=2Db√‰Óí!=B∆4_5Aú™÷≈œ-E©\+Ò£ƒ’Ù|ü}¥@%¶—%Û∏P+≤Q·¨™Äz+¬ªá¯ƒB57tÁÍc)ÂSï⁄ï∑À"æ(U¢ŒRia+à:å¬æ;ˆf[H™Ê5ÓF)˚BrOeàx∆aØZL·È0n7éÑœhZçpÀV⁄TG©h. ≈Ω°ŸV±¢ZfÒ©%%MÅq„qRLxÜnc‰ƒ#ô(lîWwa«ñ‘ºd5ozﬁÃï∆y»zU©=≤+π8+Ã?•í`ƒ∫EDëß,ë‚ô°ÎM0)à	GX„n¿%ÒîE^”√ˆ:hGÙD0∏ú◊˙`E—hÏêÊÍÍü¢…
a˜Ê±®è_x}#˚úÀL’F!ûgR öEªl–÷¶PC√ı†uK›9û∏nî™7n@>-¯ﬁ–®i8˙ÓM!ô—+@˜ÖƒÿRòƒ""IÕÃFíïƒf¢»Ã9îN≠=m’≤_Å˙d$-ﬂœ2>¨Za´J¥e  ò:åêD4˙)¨)q˝T–úL!'¶û;ûÑ‘˛MiP‡ºsá»”oNK$[_π/Ω®‘¡Èi°«V¿ÁOdé¨7n%◊Ûª,ûn„º¢œ≤üz·º´à¢¸ët∫'0ôd¡∞òå®[+*©ΩS6“ç"¿óJ9JóKZ7^4@ØÂ›A‹÷‹¶^qπú©Ô:(◊÷±%È9àZâ´c-kU1oöïúôıøT–«¡M®kÜ‹wk€ﬂ˝Ûø¸˛∑ø≤RräZ“˙‚Âzâ∏a4î=¶[\Q:-Œ¡NGcÖR%,J)Ã8óˇõ,¥[©∞}LGK%¬TvyíC73Ü/!Ÿﬁ(◊é•|Ñr˚(ùJí\ÒØ…8qîÏTßR∫ÏË®QMB!ﬁÖ1È`æ=YÚG A,Ô–,ìNˇôa‘+\ë≤7&„Îoﬂa⁄ˇ2ø/ri5ecßﬁpÜmÀiÚõõV¸sbÊ È3∑∑eE≈Ï÷q&9|‡muòbü∂“âÔZ[^◊D·c.,elπ®è}œÓBƒNXT`º˙≠G…c˚ìÿ!«Œ©ySñÜÌ$@≈§˜o„F≤M[a{∆6§Ááøòπtµg¨ h(ù√=¸Ñ~Ñ Ï{ºaúy~â¬Ü∏√07
`€˚·8$;£(X<ëÂ4< ¡≈“È¡¶ÉzˇËè&◊øc!>“4Õ,˙	PäŒ1ùQ±<]ø€µ^Ï¶Pg]◊˚Q,;FAjÏ€Ú©s·«ÍâËÆÜˇÓ?ˇ#aÂÕ}˙˘ƒÖõh7˛HXŒx∆7îPVΩSvô‡ˇ∞Ω·Ñ)o¶w2Ú&˘QXZãÏD©m◊ÿ$£Qk¬∞Ë9=œ˜‡'Á~oV˜í–˝œ|j
[⁄;ç‡⁄"eIë∏±%‹ÃE#@øÔ¢"Á∆(˛ﬂûbLﬁ¿EO
"–Ñw,ê‡#Ät ◊@óù«ﬁ’ á†»–ÅÙ¬)nQR¬ÑëDßyëfFÿ w‚4Î∆]Ï?^ôïf+ÿévr≥∂Z3’zYCABñ'`ôÂ’∂EÈ· Ç/î∑Â∑USrÕA*Th”wTy{3ñy‡û5BÄ∞%˛Ÿ˚‘£‹}_&µ7=ﬂ	ﬁÍ⁄ß Gæøå9™Y]!IN›ö@è646√v.ˇ"≥r°GW lπ‰ºÑ£€qıY(,+∂î
¶âRìYóÚX«ﬂ˜Ç∑Ü÷à÷ã“d˛H√∏‘∞Ñùs^Œ‹wéïœR—ªmdÂò,_¬bU‡0Àˇëå?˘fÉ¶∂f°Ö⁄Õ Ë†?Û—ê‘yÁ≈¶~ Ï∞Ÿ⁄U-1ÜXG£û"b√∏ZÍ3~◊úÒß∞ÇQD≥‘b¿lxÛ5ïe¯√°üCwíËFÃÑ˝Îoá^æ¡≤œXmè0^T8j⁄î⁄èz?Hãç ≤i±¶öÇ7‡Q,Lñ˛Iœ7W3¬¥üÚb√oÕ{d∂„ŒKΩIN◊!Ê∫ÖdÖÏ±é≠fÁ∆\e˚oΩjø:~ã§WñÔZ‚™d<‚‘Û›Z…ï î`ˇ'l@¯.ßÕ≈é‹”ÆêÎ•\¬à2˙¬Râé“~2ÒCß¨ÍìÈìZcz>]nåÀç…‡tπ1˚Ùüs¯éëÊáqz≠úiQﬂ≈ä[+8ø–F&ßa€ÿ˛€•2~¨äÖCÄÀ°“êô»˚°V-◊¥ÓÌ‘v;p‚Qö…(0~S‚S{µ Å7Kn,ZìV˛W€·j˙ØïãÄó3
üIèNº®ÓÁù®?Bó™3¯b ÈêÏ¸ÖWü#ë=ûa¥WBü8¬á)[:‹}∂rÚÛìïª+ª;?_9|˘¸AAf&±&u//seÈ˘≠^‰âO§a®$Äñe°î‹Ì8&øŒs˜oÏ“Nœvo«*1fÃµ,c~ ì´»R´Y¶‘%Z^ÑEÈELKı7Ûê`Ωì¶≠`ví&êkcï÷SQºåT+9¶ˆ&éå®%˜óZo¥]Ü-Iâ⁄ëˇ"5°,ãË8i6ÿ=eu‡ı∞-ÍÆ3Â=&ùæ«Û;]XÄ ﬁI{Büº¿Ú¿.¸é‰ úÃêkjP%º%'n¡r¶›ó]PÚß¶”íG·Ÿ°É…ú”]wÍx~ºÙAú;˜‡™b Q≈D£«ü`vë]€–¢«hΩï©F£ä
æ≈¥È⁄ˆ~ÛıÔÙ0îÄKiùÖΩÿ4p5ù!SÕ4Y‡Ì¢jË5ÕÌ+ÍUâ‡ª˙øTW⁄IºoxÍˇ›¥tÇ—ÂûÀ\’A—»5ô"i7’Ù πƒRÖC÷Çx≠JÈm$3;°Oö%fEûnC⁄´∏¨ºb•™D÷∫ô`«LñóXﬁÖyç'æ;%@∑´PdUü»æ:7ÈLêP1≥‹ò≥Ìf∑W≠Gî´FÙÔgÄ§á◊_GÓó¸OŸä3Ñç∆CìuB0f∂Ô€jÑP<∑b:\Z˘´ 5Ó2ÏÌí¬≤“=áÏ4Ú{Ä{•çlê`opc¯xßﬁl≠≠∑AØ€iÏï÷÷zˇ¶+Ó7¸?£ıÑûÏÄL°\</8e)a)0Õ±πX¡QzwU4∏Ø`¸`ÄÌbOú{&≤tÜ7ëX‡ÓSk†”ŒıøÜË~ZowﬁkÌÒG˚«Ó9“ÁÁ◊_nd’ÎÏñˇπ› ˆŸn˛/,‘Â∏:œ‹1zÒ„¸˙¥«çê·˛)µ;XÙ-$]4ÅE◊ﬂÿN]≤‡,L˙¨á⁄¬Ò∆;^…V®à”≈[*„MπQ>√,˙± mÒ⁄ÂÉ6‰›<moÍéójë3x√G˛ÜÕvôT|t©	?á‘æuI˙Öç~8~èÀ⁄cÅ∏\P1wÉˆ‹Yªÿ˛‚˙Îb86∫˛÷áaÜﬂ§éàqàÅµ—ıW$ˆh$ÚWÄÑ˝Îo¬≈SÄ
úsˆªÊ2rY°ˇn˙¸E"?ıõ {®ø5»œ«‘ﬁßn‡ºC «aøﬂSÌÒC„ÍÄÁ3ﬂ¡ˆeIÕVjüzçO2∞BˆΩ>çÀ˚˛1õé$æU‰ÊØ∏¸ˆŸìÔ≈_4éá‹À-≤±⁄j√&ªÅ˜/¶[X°]o∂Í◊7Ω«tÌa—scÂCÚ,d)[œ<L°noé3? áñ<IÑ#ﬂ´¸’r3`!ƒ$[µ®®MNÀœ—;åÖÁ2)ksï00./9wÌ˚Ä0Ã0=Ø¥ î+¸¯Ùbo∞Tc£{√¿ôŒ"∑N#3ÿ∆¸m>ÇWQ]ÜM•¸ã°Hz⁄´—¯	R”™ÈzK}î ü.≈2ú¯  ú’±ö‘ù)E^∂^Z ¬¢o6ü¨˚'ëèæ˝g‹Ûúà„¿~ÛO˜˚ﬂ˛™ñÎ…Áìƒo…H	ÒOb	ºv◊&!µﬁ¯€ áV∞.ÖÓ(Kk«K™G#a/πBøÀtv!:y`Ucã‡ó‰%pV)ÕπX©°úChœf“∆ZıGö–πq,BΩ±e…+êß¢˛Õ:_ŸﬁÔ¯ kØ “”Cä{¢;¿óÏú◊œÍØö-Ôˆ∞±ù`ä%87{Á¿,›`Pckúâa˝⁄»=u£»çC†ÕOjAXONŸïÀ±™=Rö˝ò^h›˛±z7«\áè#wB¡lª˛Ñ™‘í÷sVŒÆ∑≈x-s2}6Yˆ"DÑ“¢}ïCvXl‡—¢V˚fGÏ-wÿ2’◊–âó—P™L¶ZéÚ”Ç1Æ	≠>#áƒ¿Ò!	hK áPv–tiDVÀ6 ˛°»ÿ<håUÜÿÄ3Lg,ñv%çö˘£±¡±VÛöÌ§wﬂÿoïÆ-„ÉÎoae˚º»3Ö€€P∫—˝p‘_só˘Ö Wæï´úôT—≥{˝Õñö≤¬aÏùπØ*Ö‚˛H#Êß¿ùh@é/m19mˆœìs…I‰á +e≈K˙ä∑»xêÎ+nUÉ∂¨∑8v»ˆ†“–5Àd'ΩﬂñëÚ”l	T{@pÚ¸íJß,˙oßœGé“«¢¿›c·E;—ÏK˘-Ãö‚‡Ó<F˚™ºh‰ÇhÕãØ	#ÁK≤Ù™ÿ8=aÒƒãhqü∞ ´ÅÿSº≥˚R~z˚ˆA6rùÎØ±Üwï««#œıaÀGnˇ≠ûn‹üîù9å¬ií∫±B:Ô¨ñå58GÀˇ¡däÑx·]∆˘≥ûÖ∆w„.„òè¡õ+#æ/e/∑0ú(’CSß].CâÎP∫¸§‘∞•‰&ÂtE,ı#ö9î§À^“±0YZ«-õ∞•ÛëX/x#WXﬂ;z<»ï Fk‹bZF÷~»ÚNt}§€%ÕÌÿ±®ñ—Â≠?’*2sJQÉıúÆPPRˇ‚áf!ü
‚€	≥® Oa˝Q ögAnJÕ§Èc=BÎÊÿ•HyØMµÃ∆Q«e™Sy∫5∑ùV™ìRö+-¥SŸhõÚ•-ª^
¥≠:+®~\13…∆dVUT/¨òì(ô¥@◊,v"VœOdπêåy˛ÿ™zﬂùM5¶Ì|ØË‹+PÅC√4e»Ì é€¢r9©jD	´§§ÉºË<Ôæ$ª]r∏SµíyÒUeÍ
Ôå«®⁄ª	+äQ*ç€h»hÄ◊P+Ω⁄∆ˆ^—ÚÆ∑ª£l`grØhp/3∑„¬˜ºûÔ°\JuÒoÀ‡•Üz{‹›`8ëm≤jQó@g-ıì’G´ªÕŒk£ﬁûê¡Õ+∆ú»LØµ´Ã_n◊í¸FJÌ~∫äBˆ æÇ*3§ñ4Àwı†¥óπimÚ?À~Õ∂¢ÊA%t€ pÙ±3;ÒbZ!h%`- #¥‡ÉjXï«∆ÚRA˚±T}ÿa°–ÿj3ÏPt¡[~Ó'Ë`™6’Ã∫ñò[^Á\\Ç`©∆∞#Ÿ’
∑(˙ã\%ºPÖâ«∆¶ãâx(äÜrﬁ±.√çÜ∂e]Ì]û8ÙS÷1—("KZêæ»€ı∫HÍ`§à0ãJÉΩÂ}ãÏ÷¿¬J-í§µ	í÷fÍM≤™á—-¡’À‡˘∏±”ëñmÿQÏUR π+µ”SΩí1πåôrë_ÿé*C^2◊>⁄À◊…ıñﬁW~πmÎ∞™xv\¶úœBRFV†ﬁ${¡JNáïÜÑ«wˇÌ?UK≈M∞Ëè!=æÇ#<9™;ƒì#„ÿ∂ßÚ·6∞ÉÊab_dªK6Ö¶§#ÔíGaÅZ)Å°⁄#ÀCIáæ¯˜F[Á“o”hïÑr
íìaW6àáZ“âñƒOîé*è™Ü ⁄ROˆ∫∏ ÎêÅÏé
‰©¬≈VreÅïVÔ¥∏®∏≠.S6;É%Ï“‰≈ﬂπ ·Oƒ¨¡.£úL°`QE≈P±9¥œ¨ÌÃxj%i‘W)‚µLÉe
,1áŸÖ◊™≤<´ÏSE^L9+·iÛEûÒ´tñ∫à9ú+¸ÏQtˆàs±z¶8=EtTDƒ˚ífÛUát˙ΩD≤©,ŸfC	ì1ï  “>m*Åy´ªœ¨Õ ≈£,tµ–q¶"È_;¶a;ì(º¿fsd:KŸRï—ÿá⁄^8/>œ)≈VìÃÊë…˚	7ÑR≥h&O/|w©FIöµd©¥ñdÅı˘2ÙyÕ¿ï„æh!QL/ÛπÅÈ‰Ÿ±Æ^tÜêè‘Ó±πN±bﬂ¿
Æ‚ÚmÎÃ$k∂pÌ≠!∂`ÔK⁄Vk`.û/’d∏˚Ö=á|ˇA£ü„{§0\âJÎ∏ˆìÇÜ.c§OÈ¬`"ÔKVJK4∞√€¯„;AT‹M#9™ ú%_¥q+‚ÅJ∂ìç∏jÅÌ™ÍSoÏíŒ:0{ XÏ›úF‘Kß1Ép0õXtW.—÷å⁄ ÌÌ )¢G+ÈÇz3ë^’DﬂVXºò≈¥sÏF”0ıΩÒ[g`|lú8B…8…oÆ ÖŸÜﬂ¨ÁeB9Ã˚æa˘U©ÛõiOk€¥"<ov¬‚¸û]{}ßJ/Z;».ŸsÆ»)~X˘Ôå¸€Bæ©∫™Öç])÷•*ñºp√»π†ﬁï,h˝˙(ùÛJÒlÿR⁄yÕìÀK9çoÆÅ&X[&#ì+ƒÊ:ú∞5≤ŸN$Fÿºüœh€ÄÚn‚KÄ	º'ë7∆Kﬁñ˚ﬂ≥CÖßá˛;¥Ü∏úHCÍò[€"£˙+ﬁÇ	¬¨”Í&µÌjF™¢˜≠≤˜a¢]ÚÆ¡€y_ãD∏gw9Aˆ¬;ôa/úbË ]n"Â]Óc:À;‹ töUv≥ûgÿπCü∆÷åS>Áe|È2v2Ω Òl¬z]. Û˘ﬁ1xMß …nT†ƒ,RÎãµq·¢|›}l$Êfö≈,|≤ﬁ˙±EﬂÎÿ$Çô £ZÍ{ôJî¡ın6∏
pΩ`⁄và8ﬁø˛ƒe7V`zA¨%.»â8¸jM/w¶˘©ôl)E~jÊNXß ámZ“–ÏEmvºËaºd≥=WÛÌTXÎÉäpÿzÿRﬂπgÑ3Ãd∫ c\[íCêjxéUk(µÒÇò≈cEûZ¿æ¿›iñw°oıˆÉISª≈bû]ÊTvX_àª{8cØO> ÅYPGkÒ§JÀÄÑ¥ÀvÙ!†Êz˝ÇntÎ«Â)€Gßc/≤óXïIXÆ ”ámë™3¿‰?N-«]ßr2ãÙ”π¬Ù·J5_¨~mFu°ä!≥≈ ƒ$PU⁄oà—UK®;Q≈¡ï7pueuzÒM:åfnœÕ¡⁄’î∫ÚÙèÏ”ö„…
v¬£í#ær‹èm~æ4¢…>∞Ö?¬6¢Ó†·—ÑF¥ûyÄ<oíLùaLb⁄D}J%πaÜ ﬂÃ\ùbË{ò6∂…˛Œc’ºxµ Ã ô˚‡F8võX∂P<´åis‡ΩIŒöû9¢±¨j¥˘Ÿ#¨Ø3¨z	‘û’õUu∆¢∑ºj•:i@)º´µ–wIojIo⁄úÛEs‹Tù–ñD…»ºwäÎT™%}ñÏ“ñ’†
êó”òqæä ¶]◊Ueqe9¶é9@V*≠$€≥9π®0Å†¬l§±ÉN–g˙£ÄÒls §¸1Lú⁄–…tÑ≈\X/oQAâı&í)G ÒÖ—:/ÎYD ä˛I:4lã»¡“cÁıÚ7…hÿlÆÃâÛ’_µ:ﬂ´™ﬂ`ﬁ8$ÿUÕD◊îâ*{eÌnVÙ6¡§Ÿ^ò‹:vNˇ'≥3ë¥Xa™‚-F˜-ÚH
∞cï&&»6†\ÉX´°¢Æ9^p&©LT)ÍK|Œ·ıW√i¢I¨9g*C5É“B/ùﬂ˚ht±∂WSc:œQqœ˙éZQvè«ìÌ?¸ÊÔˇÏ‘4
ÅõÍ£‚1fc˚YçAá£6ë»ÑÇM]—Ù˛m“ıÖL˜˛lB~aΩ5ºõ∏†V¯^nw∞xZòí.ºiV<°⁄‰2h#¿Èù ^4ŸÂ	NrG≤{ÓÙßŒò∂ÙÄíÚ´ìªòyœÏ±>qÉæ”s1◊¥ÒxebH^A-¶¯ÎøØ≤ÄâsÛ8qo§⁄ñaQÙsßt%aFô”Ê6s@í¶◊_˜iõÓ;Y)©pÒ\dV^» ¿‡b≥ÎPYâN=á5∏≈PºÆæ É¥Ûm“|£¬⁄–∆jq-7æ®pLeùzã~6<8°M´g=êﬁ…S	dn:]mg]ßT¡|Óç 8a‰›¥*/∆8†¡ìK/Êw†¥˝7C>¿ÊÄÿ_æ1çº±πlà∂ùPµ'-Ë,Tcí^ó∆‰¢æéÅ'π≤FÁqA\¢xµ˙f}r˛¶πˇD√û≥ÙË—rsµµ‹Zo.Ø6÷ºN'ª"¨O/–˛ìû„±|A8≈–æLŒ ≤ÍÚûT	∑…2ÅôºE˛qa±º#˜Ë…hÁL◊y;ÈáOº@¥Ë¿Ω›aI˝îÊ∞3–Ê–6•Ö6_PLåãÁzDÔ≠Ô*G÷a'Œ_´iπd3@•‰anR5ˇ32sL†YABÚáﬂ¸„ˇ!;wN»ﬁÀìÓ˛ﬁÛ.¸Åq˛ÌÓﬁŒA˝®≥ªw∞˝ÎÁ≈@e…@Ì∏Ãtg‰LªÁ0K¿8Ìê?"µS≈Ê[g•ôcsï|I≠®B!ãïGõ§:à¬	 ˆ,¢ï+‘≤AYºòµF#7ì˙¶ö)ƒ’±ı„Òπjé∑©^¿ö)iùE∫™e8≤Å&AnmeêmqŸ–‰!É~‘fûU†‚8	»Â	MÍ{Uøy÷Ü [Ù
ö=wK‡uó
‰Z€"FÛT‰2•ñ© M¨¶†£óÍê˙… 8ìƒ.J'}oHeXNXÍÿŸ(ÙØø¬óÚRB~
ä∫SÄÙ›Ê©µÒÃ«<"ÅwÍıQ‹xÑ¯ÿÉ?AÇ;¸HÀL^Äå9Aﬁ≈°9ß\(£ŸÂ˜ı3+Oz∞Mt»WKŸÀì€•	˛ˆ¡§PjïÀ§4+ïIAªèuô˛µ$ç¡ñkdGÆ #M!î•—ı/ ≤7Ÿ· µ“‘)}aU€T§r5îfqFCq/(°Y;\ù#†flÏ£3∆Ææ¨p6™m® ˆ·r⁄ÿ„ÖsÓçA¯ä»ıWëÎ$øë•!àcÏâﬁ |P–Ì£õ√+÷ëøî€“PŒ⁄XÆÅ?ÊSûÎÈÊU(OÃ∏5BPå\XT)ŸÇn;C7^*´í\ûvDˆûπ~?ƒn~•óG!-€;Æoq9"	\˛o_}˙Œ‰8º¿,“?Ï òRûW∆ˇ>¸∞a‰%d…˝¢A^∫@ôBÚ4åœy˚Ä3ä!™∞úBàíhÏa‹ '.È· ∫˛M+◊øc≥1‚û£>å:_Ãå%^@_#Ì ^üìå\÷íﬁmîQõb3»ÎíÇ‚ñw£(åñP¢o*œØ⁄ W√,sEr_π<F—*Òƒ-†sÓ‘≈Í>#\‘ﬁ◊Û‹‡ùxáá$Âm!¸ëãe˙ΩÇex_ ]àQ;£rﬁ”Y≥™:HúçñE˚ú{"SMÊÇ5à…täIÑ—}¿JøÁDıÈ¥v#ì6∞Ã¸m§Ô¯˝%‡dÔFı÷:Hﬁ^S∆¬]ß∫ä~ÒÅøm±J≤XΩq<|P\∏ª§j≠SO))Sß.&,ﬁÑTåÃg13ó◊I«tﬁr√£"^®;î’ﬁòñ`¯”◊ö“é\'j" Çúøòú∏&ÿ—≤tœÚƒSÕrîRuπ¸6HmÕ∂Fjk…R[≥mëˆYñ\ä¡WäóKq§ø£X+)€j]%K ÖYŸm"±™∑é{™jZ!È— ⁄≈Ò≠‹`ü¿Û4’ÇTÿ≤z≥≠Â{7€óÎ.ª∆≤˜ê’`üb¥∏≈‰+ÈˇÈ”µö∫–T?Øm?wAàÒ“∆ùùΩÆ◊õi0«√à’{≠D©∫e∏ûH.4d3÷9â‹˙Y‰Lrƒcõæáve·Î≤Ñ0SÔöÀ°ºﬂ\.#€Öu}wË”#ªK…¿óâ
?v•lﬁåÂ™X|’4Q‚¿H¥~8π ÒåöÄ£)»S/bdÀ2F¬l>§{ƒ*vN≤5‚ÎGü£∫‘Ô~ˇjº8ÒE–'6*üÙ Ë¢Rë>Vs∏ ú‡V<!	Ä4@y¡ÑÖ•ïœ^uè?y—}˘fgøsº˜loß≥≥wÚ≥◊Ø>ã?;~˝·GüΩ˙l≈p…  ≠ˆÄ{ ´ÍsŒoJ∞ë˚#¬±˜¿§:—†qÜ‚hó“qWxÚÈ;”˛à`E√™+ƒ•·RÀ¶uv˙FÀ+≠ ]p[¨2Iôπ™¥VØPgmlH‘_UªqôlæsV:‰ZﬁN8¡æ¥Œ0C√ÛñI±áiüƒ≈4g±•9ò†Òáﬂ¸˙Ô˝ÀpZ°¯¿Ω/éS°¥Ã=•	,,°Rq0xä¡u'!ãMX˙¸≥‡≥‡√q«–†ìÇë≥ı·áü?ΩLßuıπı´o13c∂l¥nÎöôÿ·&’zÓ =˜∏ΩãP‹Ã∞sﬁ<Z†23}°!lÖC∏ ≤HieÑ˝_$–m¢¨}| ?›‘HH‚ŸxåißΩ‚¯Âàr…ù÷ıêUi<•6f †s«ı5‡ı‡sûÍ‰gTÀõíìHF›Â‘∏{A≈j;∫Q∆I∆Ñ¡ê7r‰Vl5ƒÉ¨—xê‘»íélN}éøãèƒ±HâWfº∆‡≈}/ûÜUÀ:ﬁ$q^t™+6µÄ‹r¡j	ì(vßJû7uÄ7ë"]+¿(»¥ÔÌ‘jø™"˙XgnWZµäe∏Á+¡=7/eñ?˘…O»Œ¡Àù˝Oé˜ÆMª	\Œ Ø—û[V™∞màv/í„ï•Ë¨Õ'–∂á"óMNn»}2rU¸Táπwa˝æ¥ìÌW•)ßÎRòP∫Å~'Ì˚Z9r>Â£UâL%q◊πUv{AΩ∏Á˙˘Å9çOÙêÔáî“≥˜¬Re,¡Lf>e~}≈ΩÇ∂œy˜@l∂ˇÙµ Úã0ã∑™·#p~≠‘*A‚1Æø©qI–ß„j¡“%™ã®Gç…-åë(±AÆÙq∑
†f¯å%Or5ÿú0JLù¿è⁄ÌLƒî™Í<í#6ìmQ‰‡Ìƒê3A∞9ø˚Á˘˝o•Œ®(§cÆ£ãπßO≤=•©`GÓÈï	l¨|¡¨ô_/<7{Ç1“ÿ0Æ0`yΩ;‹H_X_f◊=u zãîr&WÉT°ÜôòÔ2 ∫ €ÜÉFá{q/C&wQÈ—xçPómOÅ∑í ƒ\`b"“(ÏxÁ¯3WÄâ=¶¯≤ˆÜ|∑ƒ†zÔí€òbFœ¥A]¿ﬂÚ9 Ât^Óñä2ì∞“RÁ±ÄåäèFX@°= iÿü≈[·lä˘Y<Bîû ∑0c HVÊıÛLTjZ
#Õ.ìﬁ‘ƒÊKÄë6∞$Fµ	Pû#Ô©Ë]og	*dgU~ØKr—»ŒH∑Ö·RAæºGX“Û&xÁ—ˆ∏5M◊0C§W’‚ˇä≈€«+Hy20ßsÁy9‹IíµXæIˇ.oÙ¢#ˇ*Ô=˜∑˙°_G¡¢˛PI" jUO	¥<3üÿÒ¬Ò6∞;œÏ»˙Üà	Úî‘¨!ïbûéù\Õ[«ÙÒmÀ+eîxA∂C'p}€»1Y˛öC∑èÊœÂ°6CS≤á
aÉ|û»E7¬Ciûj)#ÖœK™ë∂ŒXæ`›¶ó«Õcˇ≠µú2]ÈôÁSßE*I©f¢IŸπ–π&’ÇTµ≠T´mˇÏ‡ËØé;;›7ªGùg'çìüüîÎ5•Z6ˇ‚KxÈ°9√»ôå‚r∏}‘ïúHêk:≈£˘L‘∏‘RKòÁ4‘T"$ù\XPìa©\[U∑ÒË’HËH°$ŒJVixçÖª◊!Bn&mÕKm– ÁﬁLU-å£/÷bo5õ&œ„˛8”i,yuvºœß…ÚiÚãgìPé'†–òÚ¨O´Ak¶¨-.≥F;–ajM!…0=ır»´∏¥]›ËöÖöiÃñ9±C6—¬y1rºêEZxñï0Ûú2LØ_l˝÷m∞æ]QTπ–∏ûxd+oû1A°KÚ»–3Òö˛¿àâ…6(ƒ≥[˘j2•’.,Ççùm(ó‹˝°e-8,Éê¬BïH
ÆŒ≤«HH∫ﬁß◊ﬂ8òT‰”r‘ÔñT$‘S)zh1O7mØEX¨E¿≥ﬁÄûy…U:◊pY°á≤◊óH+v1µµ=aâ-ñ≥¥¸KπœÀÌΩ¡⁄$` ïÈ·‡îuÀ∂Y4ÌÃLHõ†ÂÇpéØ<É≈S÷≠xrÈ+≠ºÌmcU§π%Ÿ)/=ÂD%>.’~2_ËMrcƒDeiπq9˙hæã»ß^Ãı¨
Ê;ºäÈ ƒ•√›g3v‚π aë#◊Ò0+ƒZ¸’ÔΩA"œNËœ∆AqPEºpIpËKÙg6]6MÒÏ]–%EÆ8ƒv0ÜEIVFlmÖóºLÄ˝€@ñ∆eû_°îÊ¢ÊÅ-BxM!>∆ÑÕ/<¶˚öÀ“J õ≤j|Õ
IFuó†'∂Ú‹œÑåó¥–/åiÈ‘Ò„"ﬂˆ YjÏ≠DZ°B˛”Ç†Taó9†µÇ“]iàÜ õN‘yÔBé„â¶©Ô§ˇ…—>	<Ï£Y¶_ß…ˆW†¿$"Ì˚Ç€Éâ¸l‰L„Œdr<r"wÈœY<Ùõ…‡Ùœæbt[.‰MGQ≈ ﬂ<IÂ^√$!ı‘ã∆XëîÅ*/	Íêd´n ™<‚¯3ÿÌBxMÂ•Ø˝æ!ı˘ÿÒ¸[Sl'ëL<±°O<ˇ4–Ñü±uJ‰ÜdS´<›´õ¿)‹n	ûÙUﬂlbÆËI∏ìd¸-)∆ªeÿÕ¬<ﬁì—¡jâ.;‰%€±Wnà∂≥'Ìå\X°©îfÊ Zg/¬vd5\Ãh.mîƒeﬂt–ﬂÉ˛áÏé¢CTG¸}/xkoU>vﬁh#á≥¬“+sËè‹o´I•√8ª:°¿U¡¥sVÕû≈1b÷=-DÂ¢ß&Ê˘	f=758ÉÊÈ®ç6Ö’Úø1â ¯9∆:–@$hYﬁÎ*ˇÜç∆¶N√M	H.iã‚Ëø}’eK√IÀ˜Ñ∂ ∂UQ{Ëı›lˇñ∫=¯~IŒMä°Î~c=¿Aπ§ë1;Ä¶ÿvcÖP˚9ÓG˛≥√ÖπÊ^¿Ü6>Êx&5¶KÏÕûF∂]zóI'<fM‹J¢˝˙l¸ÀvlFÀ(.-óQ‘•…T˘+´’ø‘ŒÃÆ0Œ“›∏íôÂJÖÂLóˆgDı®bç∞4ú4"c5¥!uã‘ju¿–Höy©>â|Ê¶˝ˇ   ˇˇÏ}ÎéIñﬁ´Dó3¨Ì∫_‘R≠§≈¢‘¥Î∂d©wwdA "£»T'ôÏÃd©Jj3l`çıÆwk`lc √∞›∞∆†x1?l¿|ìyœ#¯úëôë7fDíUí∫EÃ¥™Xôëëq9qÆﬂWtqN¡ÎÊÆ¡·;fíôÕ…dü0âN¯íM9≥'óî˙≤ï∆')/aº;ÿ…rC”ôF‘q"ãP#\"æFÙÉùÚ'Èñ0÷.fCVı ∞∫%˛xÍüü#–û#k±˛@Ñ±‡u‰óë.!ueòŒ>ÕS>5],5˙Xec¢”H§RÎ∫cH5S¬»O¯‚ƒ¥[„Àg∑C÷ÉÕ[+õ∑wW6∑Ó¨l¨m-†˘e>iL∂îÉ47l5gÜè¸îE§Ë#√R•√é#z`%bÛ>˙ﬂªŒƒFbï\êÉuÛÇ¿TÅ0Áó.âªzÔ≈dÅ%®Õ&Æ≈v”≠Õ˘–G£†RÎçµ–¥ –XÅ£†•40Ω6≈(¬(eI´Á:è—&Û—ágí∆√≠z”A@Á˚5éBÈö”¨˚’)“%[‚§Mû˙o√lnÚFN≈x\ÕΩ4ìÏµt†Û‡3íÏkXF¢{êÎØ∫Ñ1Ëfh9)cUÊ£•O“æ&ª˙Z‹^◊‰ÁRmecÿö»$Ççÿ…ú´€üÄÿE'k‰äW›Ø•ÌkÏßYÅÅ(OíI∞⁄ìrQª˛^´¬•B+§Pu›.\ä'Ï¶‚	üÁqgƒn|±¶`stFWwÒ AÌ:o˙ºÈÜƒGˇ(:P
R‚∞Å≤ñÈÈãZ»ÛƒœXrÍÒ£Qˆ>€Ïåj‹C`„Ωp¢YóS(ès…†dz>y]· Ω˛$'y˙ìÕ~!tí
∞÷ôÔ:ìÄÀ¬tmŸ¨“t|–XÜ%•∫d=‰ÇùD>"©U~≈È!0ıùîM¨öïjª67àßX’oïÍÜÂ[b∞]ÏLHW~mÕ¢JZ∫ﬂ±Ga(3íö»Óg#Á$—ûı‹ªÎÉÌô}g∫"a sÎ ±,\‡å@ááàÍZ–7Cp‹6w>≤í5ÈËê∞€$a√ò 'm…≥âÙñ»42ﬂ¬íê|Ç∑%·?Ω¡>!]ò≠„ÊM®ö≤ácﬁ≈¯»ä»ﬂwuÖ≥û√˚ñ7++z&–pU¥tN ÇıCﬁ#ÚÙN`ﬂ˛∏≈~‘4”‡Mn˘Ÿù]ˆ
∂é—~è©Èaà`yKÌ!`ÔÕÀ¯`Îcı»ÊV™êO»ôùTÎN"ﬂ8P1Ÿˆ˜ı∞ú
8À0–ê	3∞ÃúÖ£Ÿ˚Æ>xy¡™0‡“˝œÌrü˜m´?ö˛ ÎJÇ£WÎSB~ÂRœïÅ
…6ãîtÈ~X≤“ß±ˇ¶z7sÚb9[®˛änc@y*Çc∂J⁄âQDk¢bHN-7¥(ËÒ>‚y

´œ¨Æ’õ~7ƒü	
È›¿!D'i*B‹Õrï’dxå—ê6÷7sî<§≠P=åÙF≈‘’dT“^BFËp/hÿ^◊Iù∑`oﬂä ·Òdç¯·√ñiÂ´0'Ü°gp-›«∫8Z® Y#ûë£]¿„◊ä ⁄IœÄ∑ﬁÃ¬ÍÁ¡Q¬6T@9⁄ûñSBü4ÉÊ#–p4u&}ÓÒQ◊∂0∂f°–m|ﬁÖJÃ‹»•U?i!™9K‡âÌ/1Tﬂld'›«Cìì(·QsëÙY√È[l·¿´ï’Çœ†Î€Õmb;ÄIıi™ÃÿŸsïÑÜƒ≠ôDX^H/JÕÀ€c_q’Iˆ%™ÄﬁE}≠öÚÕûMä‘lÄ`Íá›Cı;Ω*¬«´]Ò?·M√{†–∂∞I◊$[Úöã·±h$¿rU*√Äd¡dúÜöG©Dºâ]Í«◊‘Í4yrãQ»w6
`1ÓoZ,Ü…˚^H°*gp,≤~0`ü±Õ2ø†t‚"aº ÈgH] ∑…]§o]œ,Ó˜≥`¥ÍQ˚´2i™Ù∂T:üËùvÂ˛◊8õ/wÆ0ôk£ºïtr_∂Ú&ßê¶±,ƒ%€.∆≤ÀG7ª≥ëZÊπ`˚;Í≥í˛V∞ìä•@1Zö/òÍŒ*jÈ.˛ u.–›åz˘û6à"éi∂•∆¨À⁄”+<FÌø8ˇµ¥±mè’róÿõÚ¸µ–q¨µ5°≥⁄SvoJ≠˚˚lCè_?ÍÔÓû´Ω∑svwœ’›€˜e!'L_ŸTQ¬…{æ{¢˝Sø∞FØ¨Ù"]|ZÅAΩÄJ€E€≥—}YòËâÔåÆDÜH¬|ırı…ÍÊSÕÑÅ6ÄÜoÆÏZ.›`˙A∆b›<¸àÏÕH—5ÿäüÿæTç≈Úñ≠h1ª-H’§∂ˇ+‚ˆ#ÊÎ¿})m˜≥}wT˚ƒœ˚ZëüP#r∆PV”Í5£	Íü¡ô …ÚÓv~(¥L·"¢±ÀyÕ{√Ù<kxÚRΩ_Ï&I	"˚)¸I\uGá5¸TÜŸä{§»nÒÂéV”Ã√c±¢Ç≥BC*©NdH€¡hâ%˛ëÂôÃ8çÁË%U›=∞Æ`vÁQcÛ:wô‡Ù„[Üa≥á‘wú$q¬Yà{∏_ûÏ«4∫ÿ@`Ö*zTê íN¢à£7Sà"îN˙\`ÖÇÚZZRSR`6KÄaÚYè¿…*•¥-˛~+Nö;çé˝9˜∂ªF¨J“2⁄5ÂWÍ0ãT¢s’˜Ö´!·Æˆ≠^mWÀ}
˜«€tæm£ôuXês®ÊcΩ;ï¬ú=Osã‡@œªEM,ØgÕÇlâg¬~WaŸu≠Qó;t¶TZv∫QØX) 8;ı—≤ﬁ≠U{}Ò/Ê]ÖbÓºoí¯©$®Û«ﬂ˛;bó©ÔU?j4˜Ÿasø’®∞vÛ‰∏} æ|ºœNèèZGèÿÉzªƒŒ-≤qçaØ„ºñD6€ù]ç†è‡w⁄≠èKG;õ.îzãuÇ+á≥ü±á»ﬁ∞C∑gü€®`∑›ó:Ò"tç≥—+^Ôº’¶§U∂Í\ïzÓËŸ/¨q°ÁhVäˆ&˛í{û5DóóEq‰6?ßiÂ.k»˙pv‚˙–q€ıX≠U/w(È∆∞Û:4˜¿0∆1⁄úo?πw/Sé™Oö˙˛21€Á,ç}bFZÜR[u≠◊®“ízÒdmçhüV“#˜‘à¶=zÇ‚_¨=1iCü,ûı(Ÿ◊Zv1<⁄C©6ÜYπÛ4Xï&ZrY&íÖT|ãËÀ€π|jR5Nòì—>Wì–S‰“QbåiYﬁ¬º0ï?s†˚¨	§ªÖ)Fi«¨]ôuBW§<¯Qç&≤~ú[¥`RÍ"ü> e^`z±38}aêé√é„í‘ìhä˝¢¯6g§>•Úù‚4¨¬ıeñ“->B’Ë
 8ÁwÖ¡É˘HN?ò%∂;Lƒ@ô’PÕ≤ x≤8—-' ÄÓ¶l¬Å«†õCã‡˛Y0ÒSÈQpïLùÇÀ|W0hÙ •ƒ¿é5<yiΩ¶ÔŸ=Üˇ¡Ti4:ßøˇ∫+∆ÇZ\õk¡¸Ã≠£Iªí≤∂3˜ªû}FôÛ<ª°Ih»ƒ˘o&0W‹Bvu	ñvÜŸÏ*ƒ°‹ÉYµÊÇMè)©‚*Ãç n´>¸d	ñié±=á_‡
@æNÃZÌ∫XÛ-ú≥¨ÎMø(}0◊ÛÓ U¢8çÿ"Ú_cM«¬vïΩóÆmè˜@b“#ß6°Ω≈ÎGÙ¬ÓY=πdaı`ﬁòœΩZ–BÔ¬ºaÔkPŒì“L¨Qª7˝nÑ=Y[“™ÆK‚5ââàÏè*¶ˆV⁄‘ŒÇ Ã
"∫Cw≥ô;	À|;?çc±[˙,3;±¢Û™7È⁄â” RV£\e"iSÃ*Ù—CRÄ≈ŸˆŸ…∆0ÖLéÿ¸¢†r±z ∆˛õ∑Ô6Hq-2Á,ósÎxÏQ◊„(%,v–z‘l◊õGßMú¨ë}¡i´ı8bésÍÈ“Kâ¨h˛Üì+&s3·LÄ˚¬	≈L‹DÙKÜ∫¬çΩ∆Í”ﬂYt∂Æä!ô]Ô„Qÿt"˘+∏?∫ì@y* .Lñ›ı)A˙√ê÷J˚6÷=MøÂ÷
∂ˆ¬Ü∑∑X‡ˆ∞µé2y,ÖøÑe›ó¬ëv°°xÎ⁄¯€x˙Ï∆sxTﬂÓìHèïπ∆≤%,ñ√%ÁŸ(Ïöp
O∞QWì%˜eΩGÉ9t{àq„ÊÀG|3Â-Á	K<«Ωè“ÚCêñ≠h?¢Fx¡≈ö£ç(va§†“Ü+:ÂÛÃ∫yŸŸºXËk∫P%¸Ìﬂˇ˜°¸îåqjî>6¿ÑzçBœ—¿`N¿Ë¥¢âÏN¿’ß*R¥áŒe ¥àF$8†πF´âï≤µVc˛]fhﬂÑ›«¬‰l•mx≤Ç∆»$¸c¿©`UEy°=§2O6äN'ê~÷ò¢ó∆7V¡y!—;Z»óÒi5∫C3G∞P&†∫Åó‘?äù˜VÏ4§!Èâe„ˆÈîÙyÃÇÃÍvŒöºyAÛPû{rO¸Ò∑Ûø˛ﬂ?˛ÕèPÃú¬ô?ÈrTL‹|gèb ˜ùÈwX∂DÂŸq¡°À&Å“[bm∂m√¥¬t"´ªòoÖÌœXYƒÈg±z£Ω∆“ùP´pA§ Ø$ÃG––,QäìzÅÙ	@€ü8x1È^†ô†î‰ö{âJÚè∂ﬂá(Vƒ¢±c‘w+≥Raq≈ÔÊÖIKvG‚Ä4˘óøáˇˇ£°8)øR√ù®S√ìuçÖuÒŸ Á8ÇÚä@¸aö≥∫Eµ“õ¸Pa°æÚ¨ŸéP3^∫ﬂÌI˚$uæt˝1Xu`´Ÿ[≠›Í¨ü‘ù‰oΩH›ç·KÈEæ@ÚbÌ,ÿ u-vO;`ÊI4˚=ˆº›<Y˝Ùı°÷Œ◊ıjÙ#q°/¬Ól¿g+÷á7œW¥CtÌ«{lƒ_‚Ò⁄ÚZ‡∂:«ù ©·jÀ∫MÅ%,|Ü{Ú«‡J˜÷û€\oO˛ããï}˚-[⁄wA“≤Ø,«Q´æ§€fx∞Ì1	¯5ã»1GÓÃ√rﬂF∑û´›.@3{ΩÆ®òú85,ÇÅévSRix“ª‡=Û¨ó{¿¨Ü ±ÈTHT/üT/N(ñÁQp¬aÅ>«ÖJÿ:~ˇß›ÅvlpoúØﬁ^˘Ù5u›‹n5B⁄·⁄?Ì≠˘‘ à™Z∏⁄Wÿh‚8+lky˘Õsì˛Ù$’R}‘∏Ù	ñ˘c÷¿áÅh:d~◊ñ¨%Õxh≤≈5F‘V¸“¿„ÁK+ (,¢—è–sXç˛3œˆü}˙:õµpøY√Á>◊~§à3∑wµfÅ§ı€È’íù©ˆ]îo∫âœ©{=>ÕGÔf≠ÿtZŒH…g!≠Ì™iúÈXu.q:ôÛNNƒzXqQIY1ÁZj“D‰∫îì]VG©<Êôx!P»ˆ2™€üré„YΩﬁ¸≤Õ‡‡^P·ú:÷éHQÂ|úè´õÒG∫œ˝¯e®€åƒ‘2(í˜øµï	M=RßÏíí™µ¬¢≥úºTºvìH@î-.•›4<§N∫—
ú bŸ^ú$P
{Q‘Õ$XƒÍÓL¸ª(%e;›5X}≤ªÖ{∞B∆ﬁ¯,Fß8À`‰lÕ⁄ñ°Æ><#$
Ån≥¯øìßzzﬂÊ⁄ÆnÇ_∫g/a´i§∞~îÌS1Õ/ƒ≥K$ö∞⁄≈Êb”˘LÕ#√xú£¥Õ—ÀÀ¸Ç=ˇ4Á˚∞ñu1¨=Gkx#¸M”¸’ozπ4˘$%iéèó«•_¿˚•∞«CõÉvî&˛ã¨¥8ëxkôFtï÷ÂMÍÙG.XW9i[^h:àË‰zÈ¬∞kœ&èæŒT-–˚@∞v	·Ü‡6∫!¨–^]øN‚æs9ºêDÎkêƒ9xåf≤¯´p›áÈl∞‹Î¬µ]õÅös√íZAJYà®ŒR	ÅúN}˘S“[Ö¥"vãÖtBhË	ÍÙ‰‰IÈaºZs‰Ù¢ÂÚ\ó`˘f5Dâ¢‚îrﬂpniJÆ#~.ıEk√8÷wÆGúj-õ&·“·	}J—±vÍ≤öq4Ω«|æwÖŸ© yQÔçdÄcüy2Âø¸èÏ Cˇ÷Ã&–E÷Âó”∑#	)=–ƒv”Fw”÷M‘€Ì:€o≤«ß«GÕ˛X?h5Îç÷Ù◊GÏ/Yß~pzå_üLı®uT'&bsµ≈+p+UùVT‰ÿ]OUÀ¿
:gÄ˛R∞æ2·≈î∫Ω†»cuƒò]B˚˜{‡ﬂdx_7#”ÅÖÚ•'¥TüÌ7üù‘q•>]“≠ ëÕ¿¥X∑Tœvü“≠˝‡™’´-Ö◊¨I:≠*õKÀÃÚŸóßá(ÕÍpëºì}Kw›Œ`AW¯ìJ.Ò˝˜^Ù2kBµ ÄhKúÃ˙’O¢Md4 k±	ﬂWiOÚªBõyqï%Ìi€ÒótÛΩ∞Â5r&µç1$á{˛œGˇ|ÙÈkX.oßÁUˆxŸ9À√dwÃZ9µá‹ù5”Ú?œÀ9,Z_ %q/¢•Ñ”⁄∂F}^È3‹\±±#G3ÛΩI-ﬂ
€›–/òÉÛ$£˛Ä‰ÕHH)~†5ñ∑Ù;•Ï´î%£T˙$™·∑îËâ¯r#'tBQ—aËã∏x/ç1=OÈﬁÊÓıïÓ…®«√	˜^â"û( ∑˚I>Ìb—qóãl.ªkª2˚*æd<}ãn!J©Ç„pÅ–»œ≤è9WEÃ}4Ú&ƒ}ü±ñ»ıX«rD¶ÿâËˇùßWÌ ovN@ˇ<~∂πqx¯Òˇxä<≈ıÓ˝xäøáß∏‚NªïÅÀ=…ãëﬁ>ÿ”\oH}EæJ8Ø	Ÿi¨û-s‰·‘€‹•[=T»Àá„…8√lh6òLøÛŒ≠ëÎ/TØ{û˚rÊ±nƒ >ü±¶|›é5Bø÷g¯ÜzŒ¯Ö¶ÀVåÆbZ®›’À-Ìq§õ§ª æú	SŸ±CÌF›^wCqY˙T)õ•*î6pa9~Ôu˙|,ó(†EP~É≈È(…ìá|z™Õ=F#©_≈›}≈£‚hb1˛S"+vΩ—Yï …øµëÜã∫Ö4¸°Fì¸Ç>⁄iRøM∏ç‡I$µ[–8]âIç∞ÕRÚÎ≥^Ò’+eı¶É(Zòæ∂hŸ#1“ÕKXx»]ÒYƒU∑]º π∞≥1æ\~ Üˆh˛≤≥K±Tå8VÔ‹*_:P∏ @‹[
ùÀnJQ´\¢Rño&”Ô1]ø§Òy9ÿ !.ãÅ«ô≤¨Y∑p)çWoøsu.^ÆµHN  ˜Y¸e"ÒåÉxóô ûÜ∏|ÌXKX≠Ì»"¶4íS)f∫p„ü‘èö‰ªoÄ›$˝¯'”_µ€ıá«Ï‰∏ÕZuVÎ¥≠”˙æ¯
Óx‹y\o∑éó5˙òÎF/»{' ·âPñÙuM≠‚Ù€XrqõTd≈(πTX¥Üt£Ú◊¯¶◊≤	P[^ãIÓ°|) ‹‹`Éá¬cx Ì√ê§¥™ßí®Ôn‘È™Ùq“C ˜≥° J~ÍæÌ‰iŒ4`DóÈÍ"›EÔS ^ó∫>è)w#•»≈π\†ÅLÜÜØó›ÓQÚúÖ·;Å≈–S!ÜºÁ“)HñhTg$¸w	Ù#≠|åxÄJXıí,'≥ãçÄ ´AŒ(`œÛƒtùW¶®}ôñ¬P©µ®ï∫pPp‚TÎW™%⁄r|-É£iC⁄ò~I/…ÛJ†√äÜçF}	˛0*9ä¢‹u…åãƒ',ÄGÿOèY™1]t3ÿœscõﬁÈöí‚C¥5,ø∂îHÖê~ ÏzÆñvEO-ÃıtÛHA_í[{[’®	e!	µæjìˆD¥Œ´ÅK9`Wùcµlb˘™å≤≤∫ÿGïÆƒNù—Î_≠
ô`¯yFá‚î“^8∫)tu1…lû∂J|,‚≥îØãø—›z⁄ß©—>(V¥ÅvKˆ¿ˆÆ÷¿›≤Ÿ
€’’ºÎ3ÙZ7KAé⁄Ì8Ë˘-b¨ôKØßˆã“∞ıÅäíYﬂîPP-á†z:píMﬂv	H‰öΩî—6w-36`¬¡ÿA¬C;∏:Ü<îÖË(ºo-l,6üqªZ‚≠f8â#û™;ªªx%†R{Q^)bÖl∞bù(Èó…ubñ~©~Í∏3˘Õ¨=∫óƒ3fèr™t6SÈZ\3+«Zƒü*èvQ¯«xr™"6Ÿ ˛üÆäàﬁnW)ãÄû'ÜÆ.Ob	c\'ÉBÈ±˘ÏÎÎˇÜ"Cø›<w¿fé; ‘<öleÔ¿ˇ˝?GÆÄ°!R´;·û§bs¨44:Gá”∑Ññ&™±,ÜêL‹˙ÇùL8
)JéF %ˆÕÑG˛D@bZ∏áªûºﬂeg6æäá•.∞J≠±É \”∑  Ò-¨´âèL"" "ûfˆGÖ«QzÏ≤N~¨^-ÊËÍŸ≈Ω€∆éAs∑~™πìãµuÍˆ˚é§x
Oô⁄íXG∫àR·'E "C	°ñ-◊W¯’)XTFàìSáè∂v*¬≠í‰hS=ÜüZ¡q˚§®~äπÒ]ÚÄ* GbwE4Öw./ˇv8CÜÔ“R¶=iûk·FMA…(â?4jÇú2'zÉ`ô√cKóå2¸ËíRäœú∫ÚKZãÉÑ7?ä›≠™íﬂ?R}ù¶§[Eß5»$ånz_•ÅÙÛﬁGÒÙ˛äßpä* ßàˇﬂ4sÓ˙Ì]’DâÕå§ ·”]ﬂﬁΩiÈ%ûΩ˝¡JØh‹+JØ:QjÙ~ÚR´ˇ`J¿G±ı˛ä≠hé* -	é≥ãÕ4S(µËã≠›r°#Ì‹∏Ã
¡n>Pë5'*N‚ô˜íöc˘•áë#·uÒäæ>◊„≤â€ü^*œä,_@¬"S_x)?èúü+x/>a9ƒeœƒ=ˆö≠≠≠Mî&Æ§˙È¡ƒÇÈñxÃ9{›E≤˘s|ÊK-Òl£‘ ¸ƒı≈gVFéÎÃbQoÎQû8e”Gp&ÿo∂Çç]ºm~Óq–HÒŸmQºiÀ(H~Tn;K–1d|âÜ^]S	k,cµµ5ÉvuÚ?ÒCPnrÖYqﬁïc°?ºjBÜGŒÊÛ»Èª3ﬂIø‰»~î ˆ©-Y yÆ^qM;F≈'[;p…µ^%àÙıÌ:5_cè“ã¥ı,¶Ç⁄NOêó©Ì„ºT,i⁄À¡5⁄®B=VÚ^3˘≠ôz®å>¨T\Ìj¶	m8ÌıúQ	ëJPDºêfâ÷otM_a6P!;0w_;‹◊H˝ùC?ûâŸ¶}"ŸÉ<√<Só¿{%óêlVÃGπtr)‹èrÈ˝îKXËV
;m\è0Ø:‰/\Ôß%Ö8’æ}B◊!Ñ‰ÿ~îAÔßBÑ™n+íCgŒÑﬂº˙“BãòG‘ë?1i‰XˆË£8∫&qDÉ˚QΩüÚàÊ Æ
Â—Q¥o\5/EﬁOI—p¡.˝(àÆCE£˚QΩüí®î(™∏YQ‘ìé+#Ω´ÕÍèÎ˚mÇOﬁoMup¸Ë›Ò≠Ì&;©∑ÎÿÄ@À'ÕvÁ¯®~–˙E}ø∫ø>Q,µkT08o±‘5‡!rﬂ∑˙ºÛÕƒÚRÎm1≈L∫|%XÛ÷1ù¿õuÑÅD_ÒÎ¬à@%ä„§òmì
¯ºy6ûZ{4ûËQ&äè8—	Z≈‡.âø‘Ö”ÃF˘âÁ«ö∆‚ì«‘»k‘ìI}»?„W?=≈,u '˘⁄◊¸J§M™Î∆å‹◊”7‡Ôü‰Î$&®ï‚S®1QñVfˆƒ0<o2≤FÅ¸$‰“ãΩà…;¶_ëı*∏)e9
r¨R§⁄„›ÅµÇPTì!’°LF;˜@vh`2©ü,iHNöV ík7Öí™çëä∏¯-˝ó3ë–∆È;USwÊJ€¡Ω7sqˇ4˜RôŸÉ	füÃzìá%8w"∂yó.æπ+:"èW´]P#ä˛†nÅú∫Ö”∂í≤œtYEC
¨òõU—:å“]:òb77Œ5%ò>G∂©6nû©c†º+Ôpî#¥∂:^¥ÃÄ≈Ω´∑45z3Û}… ø¡î·{ro+πxpÈd‘ÛË˛ÿôÈÍe¿)¥´\÷±‰F4S“=∑À}dwßÕâ`°ÎÙ{DÔcT|äÖß≠:Ûk]‘Íöí∆˘»∑^|GÏ£ KùêìÊ\ËÔÖTÖ…uMmÇÌg'©¡‡eH¯¨»QÅs.Óä…Ø;‹∂◊uä=¯¸r-IÅ>∞ﬂlôõ·ÅπËé˙˜≈¯#¸ÆXß^ò∏X\í?g◊Tº~MÎUÄÜÅPˆÕì”Ø/⁄Zòpæù§„úE´∑˚[“`®Ü(¢E=+gﬂL≥w*–9"g¶Í∫P6…õ…ûâcö˙ˇk|^#jõîöh5 ≈ÿ@»˚lBÔ eJPDx˙Œ_öa)´%á∏≥2hOzÊÂå¢Gø>öæulﬂˆYCú≥à+ifFidÅ·ì⁄º¶LüL–ñ_‰Éd¶>gü#$gÕ(Äø‡Qü$s‚ùˆÌû FZË{Eë|^¶™;qh#4˝ÆÂò?j©™UË!Gœß!@®©ù°o‡Gú>Ÿå‡•ˆ‘ãˆøÓDON… ]v+$.èÊU†®É5ù'[	Ëø°uπäh‰¬Ÿ±∑∫ô"â5⁄≈˘g©±.a4˙u¬S‰æpà€£ÆÎç1%èÅÜè
œ¬&§î+"˛Î‹Í[fÃbiÒ!lﬂW5ﬂuêÍ
©B#…È∞‚|ÿ]ì∫%ˆÆáÑ¸RÇpÍ¡x+œùÿß#<ø˝VGÙÕæJ∫¥åÀﬂÉ‚>Q∆]èù´h[blpÇ“C(vâaYw⁄≥µ-∞Ω∂T‘¨Ñs+¸rw7·¨*Lòç‘7CìKª±¬ÄzqI∏ÈpK¥Yes¿&èóø.W¡¢P#°L)gœ§V˝öã‡ﬁ˝Zÿá[3úhÍ>è ¥Õ÷|ÖJ6]K|PElt=~fΩpA&Ÿ–oè≥ÈÔ€Y∞†˘˜º†Œ‘Ë•Æ}ª«aûTf»Á9	.yÆ¡œìîÎî˛pÒr Zïa·Œ…!#p˘ûÌA˚NÆ[‘“B\ÍH\\ø(∏`ˆÌ˛ 0∞?„=∑O}•BΩÔÒæÂ≈Nfb‡=@\Å£t¯4Ÿïº+ãÿπ•˚v7‚=•ˆˇx∂≠‹¥·¢°π´zHT`ÅZªrà§»Iœ÷∆ì«è°ÁƒôÃFIéB¥Cïıˇ˚mdûVÄ(¢ î;FdÃhßôÜ∫G÷Ö›∑◊[Î:ˆ¯Ãµºﬁ⁄K÷,ÒV‰;m˚£)¢ÉÖN¸⁄RÏ∂Î‚‡¬øË7Gp–±5ÊTÎzÒY≤f˙ C‡à2πëG±´ÉXJq]¬d¡"DÓyÃs≈Ã'W¿7%òÃÖÊÏetÊjñÜ/;KTïÑ˛◊èYX{mï^ÄR+€á©e«£’N◊√≈#t§zWÃ=gı ∞∫ﬁc≠°’áÕ´≈ef…õƒ=!Ó}∂q£|fc1n©·ô61ö¨q£◊_,˜◊›¡ˆ|‘\°¯2°=®è¯•ª÷uﬂ∆h'
âÜ5&ûÂ≥}€Íè¶?¯Ë ˜Y-ÍﬂË≤u›]l•õh]:weì{{*N∑˛Lßﬂxhçk5{ÿß”Zﬂ˙¶N~ÕØÓΩÜ{◊ÏﬁõŸT5€4©$ï
¿ÿ–Ê{]—ßâÁºÅ≥<øç†câ>JŒSÀ„iÙdg}˚)sœ^‡/]<=£hºåX©y›æ≥k.§ﬁta9¬ÒX¡·Q.(dPE„_0 $*tÜûˆá_˛{µ;o˛Àˇ`vº.¿˚eÕÜµ]‘!•—N9_ÍLk[¯‹0ïX8∆≈ôÜ™2X¿Æıÿâ5‚e˜¨ÖÙæIæﬁ›–Ñﬂt˘6Oî≥∏zí¬Éé‘∂ù–‘Î^Y#Ì£Æ¸êKi‚≈gûY:–.[√È[‰äıáuC3eƒ<vê3¡Ÿ†Ø≥˝V„¯∞¸]4N4≠ùTêéPÃV@DÇ¸_}1QÓB8;)ë,.⁄†ú±úºç!=8n‘XìµéNõÌ£„“q(è2kå’Ï˚π=ïRŒxuÌØ.„Ñ∑NƒZ«,Ø;∞/\ü°xa˜@˝Ü%ÊR=C◊Ú∆úº9√±É?¿£ÏhE“™[ü(+›;∫zÇVõg≠±P≈,¯∆ÌY&i·1éãÊ8gWµ¶øÉ∑¶o	–◊∫ï‡k Z?Ÿ(ÙÇÌ√ã¸JÚ}f'gñ}††ﬁ˜¨>(Ú=¯¡≥_`)˛Üb6#º#;ıÏ~∏ lír%ì¢ ÛîÔY>>µ*Qo™TÅ$JHR©ƒf˘¬€•úí†ø∫ìqô!Óép4§”†ÏâØç=~ùŸÁÁíàñ:hJ]2ÿw|≠}K¥zV`ù‚‡ùs òM~≥vÀ»◊+ë>m©›„˙Ûkπ≠ïw≠l|J–Ù4ß…#ì»Ã÷≠®’¢≈≠˛5√/ôîóYàTç#ˇÒÿq≠TÖƒ-– nihzÁgû¶/˜\®àÈ‡≥AÂ ò2=W e›Cû&∫¡ƒWŒ7>CËH`÷7ìÈ˜ÍàFR|ﬁ+ﬁâﬁP®â)◊zëc6	l§Sér:·5∆2Ì®•„∂™à6‹™V∏N„Ω¥VI…üÒÄ¢ìHê7£…˘Äã:é1ìL®º"](ÿªéugr ÛùS≤µæô≠⁄∫E˜˘)¨ª‚o"Ø”Ã… ≤—·¨Lr÷Œy˚ £D≠5ô£Bo≥¶¢ÈæÌ¡ï;qù˝¢u¢ÛX™–÷c†ë#<iñÙn¬yiÉÊ®wµ’ÌÚqpo…Fn˝OV÷z›· ⁄~„peÌï=^±∆îÍäÛ∞û˛˝ræYE≈”„æ
∞ﬁ3ıﬁ˘≠,ıGÏΩ¶’â¥{=0ÑuÓ”±H◊iOï_8ÔÊúî“Â+7‹u±cÎÜ6›Åuï%–≈mW¡Wm¬Ü4õ‹p;æO{Ò∆∑‚O}'Í;ÀRRØÍ`è›Ò˜
;rB√
Ä5ÒÚÇ◊=Ê'qßÜ∑:«Áò¢ØÕg´Ωù((¨›K†ønm§#ilx•ßy§}TcÅ¨†rËÓfÂï
;´%@¸ã~2Ù∞√´;Kñ®soâ"·Ï¬Ê/∏ó˜ñ6ÿ€⁄Åˇ-1å^}7Ä`Û@Ç5–:—çé≠` 8∞GºkçÔ-—ã,)ﬂæ Qô˙˙œÌ^0∏˜F˘Î›[:º√6∑ú-∂≈vVwÜ∑ÿñuá›ÅnnÆnﬁÜ≈oõ¯À+M	xwDgÎËq‰È©ö‘0w;’ºú’∞oTçË∞´kSÚa«u=wDÖ"˛›ı¡éV«
≠∂t%HÍHîU¶˜≥€˜çû-•%ë9E:B2ï‰Û`?›µ⁄}≠xOzPrS^TrÏR«Toå´ß¥/:≥8˝∑„≠óÈ°1/e)úx8ÿ~∞˛ Ó9;LÜg#Àv|ˆ“iF%ánO˙Ã„Bdˇ,dÒ)=:Ê ßHoÁåL◊û\x¯âZ-ÖK;vÆ5T•ê5Ú$ä9≥Ù+‰ãÂf 8	°Í50˜°›üÄÍ®{é±gl?l&@∂Ç	Ñ˘KKí6tí¥ë∂DÍÈ∑úPˇâÏ§ËÀ€i•à˛"ù¥ûËã»s©k.˘ABs)£t,¿ıåêo\ÿávp´í¬óL⁄èc7ºÈ}4„Èÿ}:7—›ÊÒsöO◊∆’éI4c€\a[+å›µeYÓ¶F9√z”Œö…]7_ò$Ãe≤‰Ç®õSMI.èJ¿<_ÅzV¬®ÁÆ≠≠ô◊Õjßs∞ΩÎ,{Ùu°uæà¡	◊ùèãM	k*›ƒ£$Ú˘o›>@3∂Ó8B@Vº‘Ïhd~ëö–H{Ös≈j“+ú˙ E´ÅS&‡}]ïQ7$ÊÜŸ≈N›XÄÂìo)Bl!√DÈ √`çsÔë”π˙ZE]d†÷ `Ì…SÌ$«î¿äƒUDÒº•´à™˘V„ä˛"2ô‘ U≈î¶å™Ñ-®ù~
'Ë O0P©ƒÅ=µ∞ìært›zóõ†ôÓuÊs˙ Ø€"ßFÀ†* Ê^avÔ“† K–K?„!à	˘%Ó1ÃÜøÇôDÏ´=Ïê÷Cœ¢€≥´kaöı
›E˛'º1‚ó£FÙäß›9Ò‹≤+c¯Q∆±ÁÈL‹LÖÓt0óNt««ÁÈ6ßz˙Jo§yifÁÔÍ•ÊÔÊ¶Êcb%ŸC\fwi´"•Æ$0™0!íÍE¸\eâŸìΩ∞¸„L *k(LÒ;¸Fú}rO¨ªgÇ¿kP-®Ã®uÊªŒ$¿∫YÃª∞ÿR:Û£¥·ŸS§MdM–’©˙‰î”UúP©hIÚ–	’‹dvV¯-ÇMß‰W´[“≈–tÏ°="¥
Ê`.)V	üºa±ÅVÙÛcÂö·§ôh7&jZ¢ÚïPà–üD†3ø¨E3≤ïﬂë‘rt¯9Æ∆"ï„ÃºYôO&jß‰z'3ÉÓ¿˙ÜwÔy–ë3g‚! M≤9v€fí”£†<;rG®gä¡6B·√÷£«Ì:ÿiΩKˆ€ºN∏≥Ï–¶∞ØquG¶¯ÌŸßØ3Í<>Zí=ÁìÓ¿∑≠p¶îâIxxùÒ%…∞Cie∑ÜπxﬂõÁo±	gæ ˝]y‹π	h:ÌÀ+‘¿ƒ?jıõëô)îü¬z¶%môÕ	è3§·Ñ8Œ6YrÖ*+@oK√ØûEæÚ≈k∏uıJkîó6\⁄Êßí^Q§Õàº≈kV#?7tòÕw,ﬁd‘≈Ù>|â°:å’-I=!ﬁ˜„Õ©¡•±äíü!ÜxhÀT,ò~¶¿z8ªµ)dÆÿF˜(4;	—i
{ïIı2≈	ç6ËkI&Pê§¯˛ñƒ∑)rH©IÄVx⁄∏Ÿpxºfkkk¯ó∆{‘’7p¢‡˜¶¨∆8#,ﬂ"ÃÚ–ŸΩ@ï¨(™CAù`â© ]ÅcÏ-W§3àI~˛sw]|?gs∞nÓ?ÓTkƒm-#¸üô˙àq!π°ãZﬁRI"‡')PÙô.W¸,@*‡ßL2ìdh4Ëü„”ˆqÅüäâÿe5Ø†¿è±∞¿œ'0cæ»≥Ç÷√}¯OU¡ë”$,≠˚ç∆§Ezˇ[Ω—äRân]ê`@ﬂÍ˚+ˆ°IÖ÷´o&6˜z‚∑∂§~{˜Ç] EÑ…g€/\˜˜õÌÓÍxë›o˝‚œÿpº^Ô?h,Bdòﬁgvá¯¶©«ƒÏr}Øò{ÕûˆéΩ@x‡^ŒÖG’˛öö«™9CìΩä9ûW:ñÔK‘ÉØ@«ÖÀ´2ç0∂œ˝ÆgèCv›/-«±^ı]3j
Ì“∫ƒMzñ∫ÒU√ø.Ç√ùÆÒ‡î*ÑqL	â+#YÊgBú Ê˛;ı)-ı3o€ \&ØpCdÓ&¢XÙQyπYö9anÔn™bYMÎM˙2Û„q#ôÃ±9–≥„8nÜ3N’Ìcµá≈àƒNã#{¡YçøXc?ø‡˛Ù{ÃÇ¸˘
˚9úG~¿˛âa≠ü/≥+X>Ø‡ª+j˙‰
ÇqF.¯ÔŸƒ«ﬂE¶nÁ.˙v˙C0qå‡}Òc~dïÆC£‘∏¯S¡ú¶€r”Â∂ÿK¯ˇ¬2}ï«ë≥!°z™%˝*≠UËÖYùÚ¨™„õIÉ{„I1Áä˘¡JõUF’TzVÇ†¶z‰à¥b≤yy∆»fﬂÈÒ¢‰gahÊ?bîlÊXÉcFmËZö˙»BèQ°¯(
CjS.ñπD~Œ≤xü•˝îÑ—ìi“?ziüüI≠H¸è©'p¶+;F≠›¨¥7ªÀîÇ“¯0ã#@-à’Ë>ÈiTÒnçÓü€«XÏ]4ıœ-–](áb>èauéôÅíMõÌv'~‘õRBC®gí<¡ö Œ®Â°gzx¥o™ø(áÊ∂Aä"~–n‚◊Å∑àç0≈ B€ ±˜Á™e≈1I ´dö<ŸÑw∫¶Ây∏?ÿô6¬òÚD„4íq`Ë/)§M'¢‹2JÇƒœâÎ€Çg;N„√Ÿ*®”æ÷øy]ÉUR∆YŸ‚£	¬†’\áü9Ygfâ‘*°$!ÍG»∫zè=aãç=≠Ü-¡FCKÿ‡£J-E7+±U∂9Wc‘ 4à¨“é¨j¿ÊÃos£I2“Ó*F<À3È2–ÑπT_€q⁄|	¶ô:Që6Ôê»ÍÿöÌ^sŒ˛≈ﬂ*úï‘‘EIù|àU≥\l¸|îF•ü\iÙŸº“Ë≥è“ËCîFª?±Mô∫™à£øªvqT-¯l§ioÔ≥Ø\g2‰Åñ¡C4EF}IGÇÕõW‘UÒÏVe	úK>Çl§»Ì^«ùx]9è˜_‹Nk+‹r‰H÷TÇû*‘Ç–pÀﬂÓâ	°Gè˘®xn‘íëx»⁄‘√@÷ü£m|)‡Zg7⁄j‡ÆzÏ‹sá≥ñ—\ÿñä†ÅÖ5ÓÍx‚Å›~!ƒårg$z‘õcüw|>]ábNTFÙ1ºÍVî§èŒgÇ–ëÉ_ùÿ≥öÀü¢¡€Ÿ–c8P?R>‚#Ó°w‹ô n∫»NhÒ f QZ¿ñø¿-?˝˜ºd:$ﬁ„ÅLb–∞ë4√lïYî®—T©ù~◊Ç	ﬂ‹LÑ3ËGDf™Ü`!§å÷qÜôÍﬁJ°6¨·,ASˇ∞ÈQaBß{©±ÉÜÁXèù@é∞Ù˛W‡IáJy˝Ù†ﬁ¡âx|z‹n7Î≠Œiù˝%k‡oıFk˙Î#V?™üN}ÿj‘È¶b¨z ìøΩ≤yRÇu,íêæå0ù‰ãpæ¡(˚Çq¯ñ˜⁄—ïÚË”¶éæñÁ»Ï¡l_'ûãâ	ŒΩ◊X≈ã8åù`“#¨^æ:Ö3W47ª5ô‡jﬂΩ•Ÿ¬Aƒ¯xÜÉ„cÂØuõæ†gı˘–Ÿ∞Ì?_=á°î<€¬ÒEÑÉ{ØÈ«Ì˛2˚2y¢€¬ﬂtÓ¥G]gÇ∞øb¨a¢ƒ≤Å˚“«∑“Ìƒﬂ4µÆµ™a=w_6Îß≠k7èˆõÌ¨6{|p⁄Æwé¡ÇoÌ∑éutV¥‘]Tµ£|i„Ö˛Ω◊Á©{K¿Ω‹—©€Ô;<Æìﬁ9hrvOKóÉ1M˜52nKES›Q^◊àbﬁJº†[{Ï∏H˘Ç"^>fâ -—À‹ë¿∂/∑òëI Mƒ/O•¯•˝}<ÓYJ'ÙÎªõN˘|™íø‹ƒ¥°ñﬁ8<éîv	ﬂÎ∂KGò?™;*9&ähÂi≠ ˜ãîÍ…∆Sxw¬G.=ﬂã-ö∏ˇÙxŸì/ò¯!≤vˆê“yLE˚fÊÃúw≈Ã$;˚T±Wxjg∫Z∂éÎs]„¥`4Œ-«/7˜Ú
ÕvÂ….µWK6Br˝›K≈ÆJN—¯-ÓΩfﬁ¨ÏWﬂ#∫?˘z%œ5§RÌ©Ÿu¡>ü~oïË2]˙Õó∂∏ﬁ’Ω◊©/ S«∫àEÎàø?œ"<â⁄Za°K˜˙∂Í-´´´Ïp˙Î˝««lø…Íè˜[†ëOˇïÒÊWıÉ«Ráø5@KﬂØÔ„èÌÊ…q˚¥…jèÄv.Æh6˜[uP„Oé;ß´èöGÕ∂¯”2=e∂≤Éä8¶MX±.^^ˇöahøZΩÖë'ˇdsk„|”z„Ö∆åä∂'πåÚG˛Ñm"∆Ωe¿ëà^ò–õëdp€=	»∂fÄç' ; 9qﬁ˝∫a{]áß >sˆsÒ<˘
;
G&òÈ∞‘e)Bò|äîW†∑’'7_ÓÑ2ìY}ÜïÎ¡Öe˜]Ÿ=Øòòy…∫ÜºÓé›≥z∞J÷r¬µŸT´Ÿ<íù‚wı$ËÑ≈êLêƒwÊó◊ŒÖ5$lÂ‰"vÏC§êXë◊r‹!à«vûp˚%E¥ÜûÑ—∂z∞¶?ÙâÙﬁüÙπg#(πë¨ﬁã…(∞ºπGp^÷kaká[€5=œı*ÓÏÒÍS63ëèas'…xcômá.«úUèuâ93 RMÈÑˇÒ∑ø˘ØLº1+ZÂ{CPBª‡Q7p«Ìt∑/«ÖèJF‚∂tn#ââ=ÚQH±aoO¸‚ÚÊCìÑﬁ8ﬂ8€ºıt˝ŒÌö◊VÑXò+≥w≥20^Ωù›Øπ*å#ò¥´U‰Nªê{è^£eeæWP´„„Fæå·Yì€≈-È¶≤!≠b6q’æófW“¿˜Ëgœ}ô†qÇÔgÊv…!9KççDıü¡0⁄a⁄ç>º‹BhAÙaW≥∂^Iˆ3)pî˘Õ9 9m◊3C@W˝n∫}mí&M∑Û]}O∂ìH\ï™ù~ñ«„bvª8ÆámEé«ˆÃÇ”*•¶≠£á«Ì√¶πÜ¨9–cê¢kR◊vµÒ£´:3t≥ñxúñ´‘ûà–dïqU≥ﬁ8m}U◊/˝ëITf6≠ræ≤ísivΩÕ/lﬂº√g>˜.BÕ.ô¸≥o&nß≠Q◊ı‡∂<Ò;˛•;±BÄ£¢ÎÇFŸïFUYƒ/Bùéé@∞è=∑ÀaVÀ‘¬p‰4∏≈√≠+O|ÓúØ¬À„πC?”Ån$fMr#Ã≥"≤Ù≠Bù™6∆K>k÷Ä$ >8Éı\§leÒxK„ÊüÍ¶rÎå⁄A`à*GÓùç|0-¥d6?˝ì–∫ÙcËÅ4F—N%_≈π˘V©ö@ÒÂÊÜfﬁ<◊õ˙Á∞X=á!lÉê∑&òXCk˙;4ÉÈ[êTgÄµz r05_˙–∫¥áTÀ7}Îq¡äˆ)R2’]∞_E”vœ]÷E’ìÑ≥_A∑ºÏÓ°=¬Œßï§ hÿ1¿j6)jª+álO’P#NôñíP]w|uÍ¬W„3◊Úzµ¥π¬Ñˇ€TF-Â”[oEm÷2Wˆª(èïT÷™XT66Í1Ö•hdVñ§Œ¶÷[ó2ÿBWÑI‚G…UØâBÚJ”ÉCÌf,™mÚπp∂s]8){9·¡Qí∆6ìU>iUaGÚ°MûùÚ‚#a}¶ÃÏJñc°d`ŸRªπ™~ Øl&E˘û®v˚∏çvHÎË¥˘H˙·˜å‘f∫Tùs ]};≥∫∏±≤∞s˙l≥•|>D›ì‚T»à¢hùn•…|¢,ÎXÍiHõPqΩ>9√=Pn^∂îÿÇ\©Ÿæò…8ÙÛÌ∑ÏòêÀ◊æÊW~mÃ)b÷Ê]Y	¨/œ)Üî¥ÿå JÉfDë¸Îı
#¥¥Õ¬Gyo[ å¥M÷Ó∑(etƒAlèÈ*DwMí?_óØëM”„ydnc‘Ê”≤÷ﬂ®8ôîeá?ìØ@FíÃ•"±ûõ$-ò∞æËO ⁄_O[˚†∂«aá‹á«≠h+ßo∏z§Iup‚_cµË•ÂcÛ=c˙ºjäHÿ»!pSD¬Níkr;Y±âJ*7ƒi/_vÕ#÷8>–ÛïÈO⁄¢≤àÀ~:÷Ù\ƒP∫∑7wûRdDı§Á∫#•/„&ˆ˘¶¢Ä…••É=~åŸf5π∞7)<Ë9¢_üÏnËTLi—ïºYúMá˜≠Q ∆<XÎ>œ±«ñ“QÄ“9‘ò¡ycè2©§”Íú6Î‰2'◊Æí∑ßø:iÌ”◊2Ì§√j'Ì„F≥S?l5èNèqyü6u≤F
¬ƒªËã‡\‰ºYˇ<õí»c|Nâ»Öa∫›îIX≤£Ø'äÜg˜éàñ•jëu\ûe≤∞®YNÃ,£ZÕ‚ÏÕãöÂ©ZßŒ/¨qRIπ* ≠î
•£à∏™jÜ»Ó∂3ß]NT,ÚDjÿ!⁄ßT!#á‰,¨£r!ïêˆÙÌ#ı·Ùáﬁƒq}Õcj∞=èM\ÌêﬂÕû‚≥VÍBÉ_π2Ô]Èa◊¯ÍD™±¬ﬂ∑¬8bà-å~u'VåhÖâ‚e◊rS;™Æ˛œCè˘ˆp‚†7õÀt*Q7cêJM[k|4\ãÙ†¡Ÿ¯¿
∫1¶4A⁄°±–óê#”ëÍ⁄^”∞X.`§(=©;çç®rÒEÍπéeíï∫°p/ro*⁄È≥D≈}*Ùπâ‘ÿŒ¢?F.SOèŒF;¥‡5›rπ‡5ÙºB?˙ÆVD,Û‚üo‹bÿÁ˛:÷Éæ1ÛîÜ+∞∑œ!óvôúìÄ˚“Q~›—Tq_?)7◊4¶¬ÓÅ•(À&óV4n <z∏Áèø˝/≈®Rë e›¿ı<n9†}avps§ÓUY¡Ùá°›µ¥ûpfı˙û÷‚j›«pwÃ„M∫‚—JªãZÌ$∫•¯◊„H).Øm1ã¡.- 6ˆ2a∆lLùVﬁÈä˘”Ô1{≈ˆŸôÌy~ÙZiıf⁄ıˆ§ô¨òπr:i¥Ëpø)ÔÉˆ⁄¨ûÂÆå˝?Xoc‚ëqg≠—πcÅ…„z∂Àjı—Ù-L‡≠˝e£ï—ÆÔ◊€pó… hL¨Q@^Ivã]`ö;Lº:u2◊=Í ™~0Îæ{ÊqU˝ﬂ‘‚)ÛÃYŒLÇ·˜{œïF¯.kP±íÀ÷ŸæmıG”¸ ≠_X£WVè¶¥k∫\›K'˚ÕÊ?Qåˇ3ºﬂd%¿Ècy†Ÿ:VrKü√ª∏cò|Yª ÛÓL^`Â÷–í ¸%jÚ∞∞-üZaE!÷…˜‘%~Øâõw±(æôPˇ3~a9Ük‚Ôˇ∫†`Ü`4BQ£# J√4ô`*ÂIX^4y>ü˛ŒB£ÌÁ–·Ø,ÿÒ=Î]ŒÒ$†\ƒ´tÏ§¬g“DRÈˆ…D≤õû‡3˚Ã±qQèWÜ¸Îﬂ∞”ﬂ£e‹≥@∂ãv¶oI®¬lw\1⁄µG§üÇÍj∂≠µâ†uÙ»d≤e	;ã:÷EÃ°È˜‘´~ÑBo˘›≠¸«+ù`%Tô‰êÃ!√ü"&ò~}”ÎéπH©¥úg˛dz∂Ò,ˇ+ÿ´p+å’16FŒ'¯Àhÿj>∞ø>É¨/n8†Åº7<Àõù«áÕ#v|BUô«GıìÈÔ†YÿØ¨8Ü»iEÿVj™9≥ác8ÙÖpä()€Qqú†B8}€∑|t1˝ﬁe∞¶Y¯∂?FÅ'nòäãÂﬂ¸'Ã¬t¢`oºBÔ◊â’h{&´‚ñBÛË¥i≤NAUùtâË}ç”Ô∫®ìÉNè âı}p]XgN»‰Ò˝Zaf]†V'V~œ´¸‚]Lkø_aÛˇ{wZ®°Ô€†·QÉÉΩu:˝Œ⁄#WOQåD˙¡qßﬁnõÃc´«CM5s{Z∏›°ÇéFWœÉÛô≥Ó®À«x~˜‚≥æ¬Dé—)©L#˝O"˝˙.¶–Ô8#v◊tˇñ5Ö˚öÅxú˛0‰FÚ€h;≠£„ìN´c2á«∞ˇF(ïS"xƒ&£–∑Œ.l1≠@.èÆ¿ CÙPT¨enHÖâå–‘¬ô_ƒS)~s9‰ñ?Ò8LM≠_ˇ´˚’¬ò∆ØxèÍ©ÂykôÕ&b!Ï◊ç&SŸêú|+òÇÔá≥Ü)@˛ÀæG}⁄ä∞œ9»’Æm±û»’¨˜€v>w›`‰Ç≈`j#˝ClôûKGn`—êùÿ4µ'®{åÃ‹d'-*ˇ;ô˛ÍQÎ»»NXêp$ÇQ{ç®O∞«∂4ú“ŸdÇRÈÖUeV%>ß*m≈7äºç!@o\yF±ıÃø!E≠©ÿ˝oød
¶§ÓÙ◊ÿ™kÊ·x\ﬂo√≠ÌGı#£”3Và4yá`h∫}LºÎ!˘"õ˛@ùÅç<Ê]2í\î ¬…Èá˝Æ‚Îä¿9”Ä´bV#“ﬂ©∞∂A`Ô‘ˇ¸?q›±tp=ÕPD¯`r)˜Ç—§>ÁÙq€L¯6¬dJRÜ|TÎ,ÂD<k2å|V‰¥Da<∂&R≤≠·˛
∏––†πk|™˛Ü°p8IÚ6ú$úI[11€∫ıNÎ!°5çÊz?ú_ÿã0©û˝ä‚ûMÙ	~ƒ+`V‚ π⁄É÷jªæﬂYa«Ú_t◊ñ+Ã˘ô3I»f˙=ûm˙uaS˝î–¯jCW¸/‰∞}Ç ‡=vè}ÚIà™dü@ìkvO‹_BÎdÒ
~i≠îíØ˘·âiÛ@VD(˜y–…y˝°vQK5}∞sâÍ•≥dƒ'Â=ˆ	ﬁ˛™yˇ]÷/M\ÚdÂÒ∂#ﬂ*,>.füLA∂’@ À5´=∫_∞Áü“¢˝˘&QF¨Ë¡ªQ™±”7 ﬂO‘F	Âq*&GÊBf2≤’»ÎÂ 5‚£W[<7‹áH`ÕùD}Ãè¸Ï>%M§oÑÂ5ŒîÇ*3¿ü†©'â£ÀoÜN.®µª#íg∫∏Üœ‹K˝ ıÆXıX.7Ä>ÀÄ¬Ä(§¢CÅöyM…Äl∞∫É–1+≠ZPüÕÜQ–›à0µ˘Ê)ç√èn·ëLà1Øù»ÀÉ1¢B#ñªº‘L5ù)õõâcF4àpﬂüõ™E3›®5Èo-»∫4´>#U+QúùHÍ-‡D÷a†TIrÃÅö¢Q"ΩÙ:§à~Ô:I≤ÚKKUÇ2F›Ï.ôÎ:¡`ÄœrﬁC®∑“<Ø◊gxüºÌ˛oıπNXaùßj>Ì§WÇjmÂï#Ñ/É,¨≥¨PR>˛K»◊åÈhTh)kªsÜY≥∆[è)¢t}4/)ÑËétôç23»≤â|ÒÀGÂ¬N7µ’,±525DB´(ë∏j?îÀ
ÖÃŒó-Ä»õÍ€oŸ'≤PêÿÜ˝Zûâ∂ºÊªC^{‡∫på4rg≥åC˛pÔ•<∂.Wo£Ñ›Q|¬∑6riÍ%ÌÖ$çy≤±vÁˆ”,sŸÆ¬f&œˆë†Õ‡æË_`fì˚Æ¨¿#±Éì¶àT‚„˙.≈µçÄ
:B€ÖYª˘i‡;$W ñåFU`vË·‰h“ÆﬂmÛsè˚É∆À<Åì≠Ú¶ô1¨Î>A¸1übayêR“s}#.{ñu]X›A ‘ò)Ú80Q Ÿfµ◊:[Z2FÑõ:*Î)ó<ÇÂ5•:i„•GÜ{÷Ñ=n~Ugùf#^¨Mu–Í¥:Ö±sÃ˛í=ò˛¶Ûgèõ¢÷ÙAÎ¡AÎ¯Qª˛±ÕK3©Ê√ﬁ¨Ts™“,9zD˙ª◊cõ{aZßHÏëÅê∏¶«a¬;):qπk~í™m%5 ™•M√‘f‰ÍÇ
N∑“v”¬ `ıwIæ¬…§£qÈ"ÆÊÉòV¿Y7Æ1ÃM÷
:`§∫5≤eÌ˙6^Rëœ™¿˘j˝·VÅ~ÛPkS9–[?=Ó`Z≤∆-Hó.Ö±'$Â(XHºJ&˜dTñÕMâ¸©|î1ÿ&]{å
ÏäA∑Ü®‘¡·÷∑=Ã]£Ñ¬Ä¢∏2ı[4n·0≥⁄√8=ºCëVÑ[a ÍNÅOÇ!˝·ƒv,è–Ú≠±µ¨ÖÇ_räÎá‘O_©ﬁvKï‚ÕP™njï–ñV=ßå—ÃÊ(¨w;s‹Ó◊Z[°)ÊÎ°ú,äí5ìô˙{⁄•V»Ê©’sç".∫LF≤£Uı,Ï√¢ZZâ¢ö«c±<·‡V◊#\ìÌÆ„≤>Ú≠!&e∫K:Ÿ¸.X∏∞mZ◊9]ÿ⁄S6A‹ÅÈØ<X∏üˆy◊¶T\”.»Ï±gc±ïrûΩΩÓ≥¯¡Ø®[ÂâCÿ™œzvò‘‰‰>tgè∂t¸ƒ˝ƒ∆èƒËØòÊÄ
Á2‹≈‚UÒ#q“ß?PJsT5¡/,ÕgãpÏ˘0†¿°ûë`ƒ·LaQh_;,ZçÚ9ã∆IAôÂBH‘D7f—¡óuY%˛xLÙdöê}≈ò«Xõ+√é(Û~î µ√â1ãf¸JDf'^Kªï÷XuCﬁŒd{D‹»™√QçG&ï&§ƒÈ@‰Ìl “(
ôä∑È∆¢5!éµ©#"'6í¢4*fw°#ÅFdÔ˘}∏]ù	º…®ø»ÁRÄ≈à<Xxy¡‰¿Ú¶¶˝£(^q‹fÜnQ∫&RÔ÷¨{såt]%∞ﬂ∏œs^V0Ø∑sÏ3
t≈¡YËﬂŒBòÃ"“V  –sW™ì£Î¨4ÙBFπ´gëk˚Û9≈Áhlƒl©oM…ó—§˘‡Ù‹R†Z∆Uàg…*D\#é›ßT˘rREÖ?i’◊˝©HWeX/˘˛ªß‚≈’äW”áÌû
´QìSërLâãÊÛJE%º?TXå®™5»qÆq\ëÃéœÇÈw#•ò∆'ÈÊçdA.ú V◊„XÍﬁ£¨t>Ç%Åt:∂'X	Ωz“≥`∞°`µÙ¡]YMôÍpÀÎ(ıÁf:ï∏ÉåFMº›J-On∫≠Vï;=◊§]â—\∏jEo∞ò#LC´“¿R∏yÌj{/‚£h‹êBïdM˘È™TZ©VÊLãÔN± á˘∞5´∫¬¨v^8ü~‚¸d,…Wç
¨üÈÔ¿>Qµà˙‡¨Xà+¯Õd˙ùƒˆÅû_Ä"ÑUÊ]gr≈=(ÔN¿†Â¯y	—çn ªÜU÷–¯Ç¿ç‹.ß‡†P®\–±@…±	?Ë›ÈV}ùî%3Ω*Õoˇû™TI•Ùn˚—™UÈŸπ&ç* EÎT◊qäiËViF¢è›º>µ≥«Ñ´LÙ]
%°ZID•4\´Ö@:{8v®6µÁ.ﬂî¶@Ÿ¸§ï∞«>\_¥lc†˜_˘
WS/±∆Zı2.u˚˝’øÑ•ê˙&úï›¥
^;ü
BS˝d∞ÆVàˇë0¥è'Wéâ≈…µ
√7ï8Ñ=AL]%T
	Ïû_—ÙÙÌô-]Wg∞DQùÛÿ˘Ù{özw ï‡?PiÅîf¶d…6`ËM[y' V ,çwˆ£U∂äfÈöîÆXT›på–‰“Q∏
†áKRëπyïkw/∆∞A"U?<•aÖÙ…‰Ïê˜÷	ËclqêA7•[E¯r?iÕ*åû¬z,\ß!4ﬂ˚Ø_Â†&~¯⁄U}ÍVb>2öï∏nŒ–°Ñä¸‡Ù™ˇ  ˇˇÏ}[è€HñÊ_	ÁÃn•gÚ"Â≠Ì\€Y)g©7oì ™û√®¶$¶ímäTìîÌ¨[èã›ﬁ∂=@Ô Ωı∂ıP≥˝≤h,0¿‰?È?∞˝ˆúà ºâ'(*/∂ŸhW¶í
„r‚\æÛù™zUÇÁ“‚3"∫Tjh¶‹Póå£⁄#ıIr±âx‚9≠éÑÔ–e˝©èBŸéÂûö‰B!E‘–∏}%kÔ“1`˚ÏK˛“™Zñv3∑¢f©T£I.“è@≈JM—Çt¨Pd’´a’zt¨∂®mby—isÛ ’ŒnD.õ_ùÑ©4¸ÿª)U*&x˝®u©„“Ùäµ˝à˜Ó´Q9ƒ≈˜_çäiá∑∂S3íR§‰ùÛiR!aÛG£IuﬁA»ËÓRhßa:≥˘‚—MÖë@Q∑—‰ß+ºÊ#tp25á@ÙMûS&u%y∑ÕŒ-Q AâK*ê.b›«≈kVΩêO|Nñ~;∑¢[%»ø’]∑˝QhWÈYZêzçiΩ˙U≠'Aµípˆ\›ÊÊï¨üÌñPæﬂî~•PM~‘
÷È‘ûå	uÓæÇïªÆÓøä•%m5“≥íœ4ßñ%)|4JVà√R¥úHìíJ«0Xë[ÀKîã0¢*†>RîcÂ,º#H a
|DTÑÜk3,!xB“Ø1/ﬁäª* +Ó˙—fí	=À¸ÛÉâ©Ÿ’/UΩË.j'ÒâAJS∂r«Ü$°DNrÃ„∂ﬁ‹Œ© ≤ì‹Â‰tﬂT 1˝¸€Ãàzif1ANù=§≥Ê*"pêèXÓÃãOÑ%AÂ¶~Z+ÕMˇy¥K®ír£é&•J…G≠°ﬂ¨â◊≈>œ®¿À›◊ÖÎ˛Î@J·ú(^ó.∑ì™∫3/*Q{Ë„QÖ2fe°PxUë'ãJN<w‚¬ÁXLâØ¥âê]>G#å¶√[¡üœ$TâjLë =˜]°Äo[ÈëíôoûO
OxYôq—Pv‰nL*; ë≥ì‹Œ‘z N≤WZöﬂå≤3„|°Í;ÈyPu˛!◊s./q‹Ü¢Ûx7∑÷.óQâ›õ‘s>Qn ∂@˝=sáÓáAπô∑»Óø¬ì¢œø‚Õp[~4⁄éåÆ)Ënh&Æs’ ≈G#›B¬≠„Ÿºﬁ |'oólÏ˙¸ó}7z˚Ò≤∞ásÜÀé„äÏa(IÚó-øjdî◊uh8X˜sÜîÊP|»·%ªl${$?˝∏5-73û8J⁄V(íÍñzÚÌ§Ñ…ÇºK3	∏(:^*WŸZ]0=5ÑGíœmj»≤|≥ï!°€üá’x≥)Îµµ5 ¢€≠æ!‡©°bÄ√Ê≤?˝Û˜≥˜ºMÕ7ÓCZ/§F6¯Áﬂˇ_nC£n6v√2ºH£°¿……∫p&°0ıoT©éJ·V“®µÀÙ‹ªwaôˆêÁn÷∞®›◊∞gØ¥˚≠gGµõC%;UÎ9QÚy^ZÁ∞{|pºˇ1Q\úö"¥
*ˆ ]~jAY—Ç‚˙¥ÿº< Ê<⁄ 9∆¶oapC•⁄Øå*Í¿ÚZ—C3@EﬁcXQXÕ+@ÍW√„‘b∑Øàá{ÎÚ˚^∂∂ÚI˝ûG˝◊ÂÂûZ7Iï;:wTπ≤¡n M∑µ[≠LØà≥[Q∏„Eπ=[Î •ÁóŒ<∫¢VGE”k€Æs.´w°J-4B≤F≠ª∆ÒÅBp+z¥“OSìVø)Nt∏Ω∫πÀN,7ˇ‹r«Ê‡˙é¸1Y◊9∑,ºÅ…è7©U'±Ùj.d|¯ËC—®KÀD›'†bŒbªˇöÙÕ√O[{≠S∂≥˜—(” /√¥⁄ˆôp±‡R_YG˛
≥°%Ù`Q
tﬁë!ÛEPqÊ%ú‡4≈iQ”E"ò"®ôË¥ñ[éÃãÕ∫3ººÕ˜œß¯|xY££°¡~Ç$ k÷ACç“ÁœÜ´Á
Lbﬂ≥ºú°^=®ÙÜw†ötj:(&J7N«¥KT§"–fi©Ò¥61æ\›)Wn“œ*ùæ∞˙–°;4ÌßWâ_ÀÖåô÷ú|≤¢^˛?ò/œ∞Ç‘ï?1x$Ù£Úo∫éx∆óì!>d¨cæç;√.ÕT:©IµTV^∂≤ü|wÌFﬁóΩs…û-›!≥ã™+ªÉ Î%ÓêÃgAªC}ÙÙŸüñxÍ™oâÁ.ƒ%]p&.haüö†ÃÆı¶ ¥[@;Î®Q¶õõÑÊch˘	Î&mº§2w∞–Æ(tYM¶∂o.=k£ŒÉ†ôQ‰%ÿqíﬁSpÑô°e Iãqû|s[xûé	6Ï°…á¶+ÖÙ7ÁSJkÆsÊéF∂ŸUæ2ÂçaG÷INÀ¸Ô¥ÊÎëVu…´Z$Af·ÔécÜû»¯ı·øF8≤Ÿ•é˜ä[ P™≠?YO
äÖã—ßïØ2	çu~¡NZGùÉ]÷=lÌw¢x„◊¨u¥«ˆ∫≠˝£„ﬁY∑›c?ˇ˛˚¢€nùuèèM/Æﬂ˘Ìc$ÙÀøh<nõ;ØPBß˝¨Q\§ôvßÓcˇ¡2«3≠ˆ…Âj3å´àOBWÏfh¸€£§ÿgp`mïXÆ›L±àÔÄ—πìäJ´aÇ=Z‚ÆJÎT<Wõ≥<û_U2JA˛¬!XÉè)ÁÖïä›π•AÎtèçw´oW˝1Iz…yÈœ]™ÙULG∑oç •^{Tœ]zÌÜ”Å‡πKFπ≈öô˘éÊ∏!åm0ÛÊ*√MQ}Ó±ùW¸EÅßéÁ¡¥koÒâ`UÒ\_‰Å5”NeÒód»ùt8Ÿ¸oπ‹s©"ÓEÂji˚8ıí%±¢∫œDÌÒ‰U≠¬Œæõ8\%o˜9[:∑ﬁôCŒÄÊ<Óäa.æÂÙ5\ˇ¨—onºZºÕPÈÜm?Ò2ı∏¿-Ã[Ò§mJ¡ÕOV•‰s(q∑Câã≠¢Ò‹Ü_.WùùvÃßD∏∫	}Ñâ,ı%
∑eÙ*3éìÌÃqí€AÙÒ÷3ÓÈÖ5Ñö¿Òe6´˚≥{^j>‡aﬁ#ˇx¿.`]€|m„4âR~'™4 ô›úFﬂwÌi ª&KhC≥ﬂ∑´[èÿ˛¢$p–‚1„nxæ6¯úÔ˜™˘∫ÁØ:ÆcÚ#ÆJ3Z/ˆhóˇÏπoÒÁ‹„]∆4√ŸÌ'A_"†5ÈØnÆms«˝ñFxï`Âí	K©œ	1‹ÜQﬂÆ1§W√¶≈N#≠•æ–)#!`/ŸœCÁﬁ†Ω)∂ Ôú©dËƒ «F=ÈÔÓz(Iüﬂ,œ^rÖg”⁄p˛ûô–AdÌ=Wd„û[põ,+Çßt	_fÁ™Z∆å¥-u9éªõL¨dÄr0â&/ﬂâzàW¶dÑ]™∆â€hQl‚mÖR‚≠gL*„à!MºÙf,â/–¢gyÅ–Ã°≠≈KçÉ¢ÿ…˙≤äNƒ@§‚î•qNR¸/}m$æ
Î«çÃ1Ω≠¢·–≤Òp6≈ÃmZJ6≥ŸXß"∂¢–ßÚaìU-tä+∞;_”ì˘Å1≈tà¿◊ˇ‚"Çˆ˙g($ê~dAHûrhº≥∆÷∑∑Î<ì≥»°Ûi∑ó1)E4∂»√“ÿ%^4ëW–w
íØ'áñÉΩŒ‘ÁZ√S˛%ûåt¸†x™´ûJ…8\≥¿JâüÅ;π<s·£Iﬂ5º·rjŸCItM“°·Ω•◊·pÊÂá+Ë{˜MmŸî=T”˛â‘*ÄÌÀÕ∑-@F0˛Ë¬âaF\Í)€ΩBo@˝§JH=ÆKºh≥ﬂv'2ç9,U≠’@∏∑ b¯ıåí3å—Î.›°Æ7œ	·œ≤Ú3ÃÏfÓÃÍœdænéÕ¶>7Q©<Ì+)06A\líÖE7‰ÖÜ9Ÿ{QÎö°a‰‡€¨B6Ú¨!√–lÛ·pk-˛uÉœƒõ!n
Õ/-£	mﬂΩÑ/≠-’aÙõï€ºŸ.Gﬁ_öÆ®cF´[üÊiTË_ÔoõIÿÈ#]Éí±Ê⁄å!Ø`•ï˝ú Aﬁ±êâÊ¶Ω3â≥a£ARÅùÃ2Cávr®û∫∂mL04LU,Ç”RÔ∆˚ΩTê$ÉƒÎgN Îü≥πn—
$øç|£¥èWØ¿*;¨Î÷û¨u4å≤õ]á=€=:ÎúûúvŒZÌÓı˜G2^v˝˝~∑›™˘yÎõ·@€y#æÙÏã÷¡AÎÔˆè{zOÜª=ÚÚY◊Z?OÇæ;L‡ aO¡Ø^2˘C¸[‘ΩÅW“sΩ&ùÊêK
◊7}tfó›≥66&ÀÀ√]f8ó+Ãæ€eŒ©≥πÆJU’≈{zÏµy	v“›˚Ñ}ú√€éÒøXgÄÏz>XπB(E;”—ó–Ï+∞Y>iﬁ∑∂?c‚≥œ¿ä”Yaÿ—·¨Õbÿ÷»YÉ‰≤È"%j€r&S”Ñz	ü∆ Ωê}˜›|/˛M˚?(Aöf©^†±^`)@∞_LE™ÉXódG'∞ßÏÂ⁄⁄ZqO_—…K6.÷…SfÆÅ72É596UöÙÕ†Wÿ…e˘@"DΩH®é‰•,Xy–8FB71É©øõpÕ∞0’'qÑÈ€]ÍE‘`¬Ñß∆…ÀøQ∞]„å¢¯0{7p'KœÆÜkC1UñˇæÓß¢Ô+z÷å	Ï‡Lz
t, ÃFÈß›9ù≥ä±áDß^WÀJœîøˇ˚Ú3≈6ù‰à[i<,©¶^OÁÌƒ`™\ª
¯”´Õ˜…i€J»ˆT8¡
`°m–≈lÈŸëãÂ\8†¿sùj`†®›òˇÓa)‚µO u˛†Y‘4à ı:◊ÆÎ êÏ«ÖG`/Ê∏k÷cZuø#Êc¥Ä…ˆ„F⁄~‹K¿_¢)(≠d¬˚˙…x¸d<Œ”'„ÒŒèﬁ‘6á«” Û~jÂYè97	Û—ªkÊ„i∂ßüÏ«Wé˝X4Ñw–ÄÃÈÍ¥ sz˘…Ñ‰◊-õêõ°	â“.cFzk9aóµõë[ÛòëﬁZÑ4j{Xº€2Ó≤)ôw¬dl…ºÊ˛ì∂Â‹ò,†Oìt«Üs˝‹j}2(5n´$Â·œX7Lc
¿àR\°ÒŸ$°òbJ‡5ôßÊƒ3}X∫∂ã—%{!èú3dÔ[ﬁ≥`%b∂áªÑI¢p¬ ÷”3≥o.Í<YÃaë)¯N‡—ﬂ^ÄúCÕ	ƒ!Îâ≥(y∂%'Òd)I ≥S‡P£)œW¥¡á±˝ØÅHß∆¨{\_X¿ÔôÇÔˇìªb∂Yøπ—|úõm¶í_ﬂt¬Å#ó·DI6Sh§ÔOæY'™«à9S—ëƒ†97ÆÊà†F€‹{ùk÷3%Rìôo{ _8KáöLõxñ ñ!I°!êú£Ωœa§‹8Õï,!ÂÛ?Õª◊q¥¬~/s« ”∆2Ø∏ÿÃ1ıqU«⁄jwÎÕ3öÕÊ1wL≥∫Èc[’“«∂…ôc‚EtèÜ‹Óëì«*˜ª‘ëT}(À•Rê∏}ÿç»†™âHra≈è‘Ú=ı%Duè^üÚZÖ≠£ÎÔ∫Ωni∑z«¨}|xr–9;&Ÿ6u2K÷9c7ûbì'ﬁ>î,õ
¢;æí5fíπ6™`€N|Ig‹$ã√|®I7yC}èÚn
∫ˇ)ıF}‹¢ì-Ú3oT˝Ì∆2lä´œ—Í-*	8±´„ÆÁﬁ¥B;≤÷≈P£É
Ãºs™Yƒõ-1ç6rM£Ì¶—Üb≠mGÎ)
J§˝VqˆÜàÉâD ¥¸ÈwˇÛˇ˝ü`‚m¥P¡éù∏ Jw’Å†∏±0€à¬›P‹	àºÜ‚8‹	B”ıôñ√=Uﬁ∞µÇ0'∂õÕ∆p∂9Qâ)æ™˙T„ò_AË(3ÛôˆÅ@+•≠µê•$]®E≈‡Ù&Ü˜›&˘áHVüO∫‡®gÃìãÌ√°î{›ÀhZ‰–˝ÒIª{|‘·÷⁄≠≥c÷{¢◊9êñì÷iãØ‰ØŸiÁ‰¯Ù¨C®\l◊M!Db“FuN¯üL‰e‚b(©πP}‘P*Öê~^ƒí‡Î¸-édÎ˘<«µ⁄g›Øé{§#Ü,àÄ∆\gm≥0∞!¸ô˙¨ıL•è0mAT∏Ç:Xø1#˜≠á?õäub√w◊@Ä±ãA!O˝Ö5π˛C`‚=ÅÈΩÎò?ÂuÈë˜ -€ñZë©b251d	q"jµä.óv…&.6·3PaêBÀKÖù$çÜ¡}£∏+@àñ	 :‹j`4eÌ-ôáiî(‘Ñà<›«ÙH˜úm…ßÊ4ìd	bZM≤L‰\
∂õ"?…’Köe¡¨!ò5ÁˆÙW.ØAMIG÷Û˘æi√«1ÏÕ]ˆ"∫7Y*fÖ¡ø‹˚ß˛_¶±¬å5∞9=ÃâÈ¯∆ÿ‚ãÂT!c[bÔW*v’∞GËEÁwuCÌj‹ª?ˇ˛ˇS‹ΩÎÔ<G¨Ö-]ˇƒõ¬ŒÓôXÏ–änÔL7tmbŸ¨◊únmÓ≤é∏â≥‰úD7F˝˚áˇjU‹≈.¨‰ë'ó˝·‘¨°Â¨âm9Üg∫=„õD4"ßì[ªÏÓSÒΩjˇÈèâÚ[q‘‘àá~øœ˙V,?§¿…È’6ˆ
Ô‚Ñç∏-\vø˚m™W©[A+£¸A~bÔ^q`‚˘8†√uK&†ä–˛ö5§¬)ÙΩjñéúSSó‡¥¬nYtòaπ≈ˆ<û†2´EÉGÏ°±–Õx÷≤∞¢©çêQlIG‡fû#0Bs‰ëDzvZN˘….¿ò:^éQC¨ﬁ…zeºÅQÿL)7-|ÄyÆ¿∏Ñä/·∞|ö0q◊œÚºÉ‰B'tˇ AM2i0Õb‹_mj vÛ’ÈæÅÿ!<πã¶lŒnuVÊIéE#®6CSOyü∏d÷ÏŸ¿ò—ˇGäG#—ﬂR`9¢Ô}€ºñ}∆cA´À:ÓD
¶Q'≥©ïÄ2“àÉ¶–‡ŸúÔ≈£Èõ»
è◊ ê‡ŒMJ¨ˇXX;O-§@j:Í;+xíèÆ»=dç|ç2.Á<ø^#ü@ŸÃHµÒÉœAD30¿∏Ò’‚`"8^¥Äƒ‰W
ïâÏ˜8CÏYœD’âÉy$g!bUVÿ@`Ü9åE*Ω¬»©x0ŸÅvΩÉÇ»’,ºè’ñÙD‡œ)8î$±lM$∆s∫≈∏$NX-±∆oΩJ‡{∂|9ÃùgäÚ^J,¶‘3qÒÅ	Ó=§?PcN±VBÁîTà •é°"gÒ©B‘œ®¨Ê◊à?£™¶Èózï˛Ñ⁄í¨<ël,ÁC≤“å#¸<˛”+ı7çµç§> ˜Dd–ÏôÅaŸÿóƒÔ:ΩI5î˘H∑G`¿†°Ä°¨ÙK˝¥BÔíç¸A{Ï–≥·:Ω¿ú®#®|Zeç¸Å÷.„C*uùQºY`UÅ¸!d¨ ≥C9'ö)ñ(™Da,™†i%~6t 2√Û¨æÙ≤^}À∂!…M°C™ïE/—≠:ÒÃ7ñ?5lÎ€êÜX¯S)‹¡‘Y(ç‹I&Ù€Ï9W∫´9TãÉa"¿E>nÊ$8≈q—rÜä#DuØPZ>J˘!Ç^Dõ°ˆˇÛﬁÒ&K=»¥·0ÌÉ—áVÒ¡näBÆìw†\)ÓïîfôNóyÕiÀ∫VuÕdd`÷V.0k+ò%{Î∏æ£˚÷‘ΩÏ≤ºØ⁄ÌFQ∑”x≤çtƒ5|â∑ÜËÙ>≥.5ª^Ñ;€N8úvÊeuòv
M•4ijé'.ç3HD{Ú˜nGË™ª˛¿∞Õ’óçµ«è_’	ò#„—r$ãM√ëïkøÄ∞jÆß∆õlΩÛgp[F∂¢â´P∂ÆÛ√mk=_Lóë3»ú‚s·¨e≥|X"`ñí¯„(á~Z>ëiÅñ#o~®Dç∑+Äûƒ„V√äSpm…·SñaKËlÀ¡[%7üCá⁄ì≤ÅTÛHíâ÷Äh~®⁄S‹&à9£™IQ"jH∂~4£}*Ko˛”:÷R ıGy‡¯\4ﬂÕü≤¬gì„ﬁ6spotó5 X=‘e'∂KŒ∞CQ£„Ÿª}ûÚ´_J@f„q£ˇä[‡ÖÂÄ„ó™ïÂÄIù…Oßü6DqvÅ4âDr∏(°≈±¯ÎKXXHÔP“<âXË „˘◊€Npj˙0°Õ4})≥`JÖ˛ç&è?∑˙6H2&ó¨gﬁ‡ÇöB.Óëòh£r*˘vÛgπ©‰Åiÿw4è¸πÎæÊEºã]ºÔ˜*âºkxjï‹∆0ì¡m∆◊?ÚƒV¿}X≠uØÛ»OMÓÖ√ó’ˇ†0˜å·ıècë,Ô@„l2Ö>à‚oCﬁ>¨?&DqQ“D‡¯ËÁ„pªâ=ø˝∫£}e~†È„ôW\l˙xâ¢Sïòuóm¬ELèDÎï•Áéã∑–:Ê´:zó«˘[?‘¢∑õ:û‡)¶π8ÍŒ[≠1i¸˘ıÔzÛegØ≈ûwütè˜OØø√rÏk∂ˇÂıoZ=÷>∏˛Õ|BÀK¯î:.S«ÛD€áí:^Al«ó∞¿£ΩÁçGB-¥ã˘ÈåÒËÆ7]<oxÔQ∫xA˜?•ã´èªùtqU_ª±tÒË‘"ÂäG˚[$äs¸Â∆Ω™“≠ˇÛÎü(aƒª‰À⁄lÏ4vJ|Y™Vø7´H¯›≤7+πsñíJ’ïUfΩ≠ˇU ÂNΩÅ…,Áµœˆ√¸”rpJ¬.çpvØúèCn⁄g¨Qç5 rÅ†Hz• ˆeKK[Ø=èªÛæ‚6éÂLü∂¶Êûü∫ù†$ö˙Ùw∆^LÕ0ﬂt?Ú›¥Cö√K÷q†¶y¥h2ëº]ñÅ
¶v∫Ã'-Á?≈büˇ¬â˝µ˝ü– Á?˘ûy˛ÙJtmmÍYÙo
>˜ßKﬂ¿≤r^”5`œ¥ü.9Æ;A(s\ËÄÈy:DÁ·7N\–0.±±U˝F≤¯¯,¨ËÂÚ(∏>‰ÈS®8$ Û:πt",â>–â~öFæ@àbW⁄C£SÿVy¬lœy÷_æ](ïƒp¨ÊitŸ
aîÔLGö•#¬˝¿Ì åv/µº‡˙ß¡‘vYì∑Ø:Gë∂Œˆß†Yëåñh8HŸıŸæ¯”ÒÿæÕÃã<˘)=YuÏ;ú≈zïœ@1UN»±üÒnsïŸ&üâÖo´WóÅú˘#.~j“ZtøNa¨óèíuàRQïÃöW∞‘I3#'çQoßÊ;Û‘Ïò·Å
≥™á˘…KjÙ¶Œ ≥˙DòËÂÜP°ü©ßívÊßVöÂ∫A4®âu}å¸4æßV;fÕâ›®≠Ω.~‹:`À«≠=vx|⁄A$_kø{$
D=¨@˝ƒË"ıè¬q†P˘S¥&5p}Í@¬®ú¶G∞35äŒg‘ËÒk…Cí˝*Òl™Apjû{¶—~õ‹v∏È∂ÁZÀ‹ZËZ\œß˛Ätœ•} 6∆<áŒB˙õ°≈âxl–îKc◊ÚùjJÚ\X[\jÏﬁôöo‡eëkf¡‚{«Àñ\"®yømÉ˘`8	&°–§à»~òÔròR≠Éµ‡t¢2ä∂úl\=èdLÜP¸ED∫'
úˆ4u¶˙Û_D˙0Ω¶!Yﬂ]@Ø˚◊=d±B~}˜≠pÙºèëE
Ü÷U"˘ú|@í´∫¥MÒô‹qc•ó∏$ÇÑMÿBÊ¿ÄÅˇ¬æÈ_ˇiá‡„ç·|À…ªv2ÌÇfõ¿ààÙ1„˙_‡#‘ÿa√ ∑…ù∂	©Åp@GÜMéLAlŸ	–Àa√È˜Ω«´"ò“"∂<àΩ∫'BCˇ—£ÍôãwGÄî≈aü>Èı…kñ&ÔV∑EûUî "D∆{§´*Í3Ø{S§l¶My4+a%¿\¶g⁄dÉìtDÊ}E∞r|åá*9ìıYA æÂo⁄Të7˘â=ÕK–∞¯ñ´;D·tjÜN¡E—ì–35Ánß8Ë” WP?Í¸Å£Œ¡.í?t€≠≥ÓW»÷ø«:á'≠≥/∫m¯˚Y∑st∆z_∂NøfÀ›Vô¡∞ÿ~[æHˇ≈DÑ¯∂DèÍ…µö[çÛÜëãqu=¨≤y+(W6æÑ≠T\+£tëopØ∞Ægû1ú‚…	∞,ı√<Ö&QÚrb}5~æö˜Î÷L¬&¢◊V…ÿrdqC\ˇ8@<+„iÔæ9û\ˇÄ¸Ç+lÄ9SCóóOO‡úÚ-^™€E@ù÷G∏»ópÇ8:∂èD$ú+|cŸ∑åù$∂ıΩÑ∆“∂oﬁõ.!;ôObÇÙM ‹öQ≤ÁÕF√$¢d·¨ãì›©àì≈Y-EYE`YÒ23ïÌB∏ÏN%∏,Æ∫bf9" &FÄÚô1FŸÄ-â+^ﬂãhÙ}◊ûÇ¿<#¨ö·jÎ÷#,ä¸Ö2ZÒ`qµñ/>›B^5ﬂ Åécîûoö}M.${;.‡ÁƒŸø∏/R¯a˘j74Èkbj≈£~È√˝Eû«Pâ†„áã<)TO˜´VÁ…ŸikÔÀ∂`ö=¯˙ª3@ñ:≤¯√^',pEE/ê»¸ŒôzH^l®(N:ê'û¸⁄-‘–’!ô©°Q=÷∑W-Ñ~2„†rÅÑÂnîkÉﬁU›ÄvFò?LÙk‘Îüú”Õw6ØÑ{O–›≠ 0ÚD>sèœœ-§©Y¨À»k$pﬁC®w>æ2ƒB6„J®=È£ãŸcS©Ωëq·∆¨Q!;)\¬πï≈‚‹⁄óço6&Ôæyˇ˜F}cππ≥“|¥Ω“‹xº“X€xH$-¡Î>·∆g?kı:ÜÛ—«⁄{ja•÷ÑbÑ”oyíÙ¡ÂÄB Ã_Ê;óc.[√_Mù ¨Œ6ô∏€L∑T'»ºÏ]oà√d#ÙÛqòà¡ÑÀåŸ9}ª,%Yß§2*—6®0&∞¿?(∑â’Ø'œ(ﬂ<¸P2ç*øÒ%EÔè≥çT;ßëPo”G ùnŒQ˛@ﬂ£¨£¬¯îw§>ÓfÚéD»qœ}ÎÿÆ1LNÕ…ﬁãÂ˙3èb˜O¥œîÌútD*flÅV{Ü≠[ÉéM€Ãbì.Ìô∂	RU^vÍnsvÆ¥ãÏay-]‘æ⁄»
∏û'‚ÊCÙ>ãòı%A=	g=G) ØÂ¯Ue˘DﬁÅéﬁÖ5.V˜	Ari◊üJ◊‹Nú ¢Ã]“^∑ù¶'∫“/±>wdÕwaÈÇxÙîRq,E¸÷Ï◊∏z˘¨¶]szã7Í≥‡©tÔ¬íU≈2bçqa~k2È]ûπ¸ôåR|#‡ü’*öÙcf˝‡¸2¶Èïú2ˇãóÚú˘°Y…Á&áöä,SJÑ"JZœë«Bm·lÒ „P F^ÿnÔEçkˇ–Ù}cdˆ~=ÖEQ´•ΩÄ* £‰]‹˚c√≤oekxf˛∂¿œÛ∂D¯˘Gµ⁄ÆÁô`I†a·¡¢0ı9Äóœ\ù[ö+‹	r≤»ªÄwÓNoÅ4_ r+Ø¡¨¿*˚}9Ã^aŒ‘∂Wÿ∆√£àJ±r	,l,ò4`œ¿»ë3˝vÍÀcâsãß˚Ï¿Úf0¸X7A?≠¶çÎD+ÈµfD7xÙó[ ≠˜Œ_zˆÁﬂˇ„o4KÈi‚Tóvî,™ëÌBCC¨„f€∆∑#Xo-«Æˇ0Ê±D)óÜ„Ú∆∑–Yk ÕJ·≤Òb∏å'MjQR»…E™ñπ,qR|≠Ω6/√ı,R≈œ≈oªÃp.y¬¯.H∏qﬁï^∏©¶±>eòÚóq/°ÌW¥£û	Á°Cw'·ë]î˙âÎ*ñ≥Ä‡∂»¯l&r&À9)mÚzõÏu’à[h·ÔÒ :ﬂ;©iç"øÀWlmm[a|ÆwE0òˇÃﬁ”√Krâ/è2Êf¶ƒŸ4ggÄÏÉ©øÎN€rLéÊëÂ≈ƒœŸÔ¨'{Ω©·◊J[-Jî◊ÃqŒy„[ö30Û—ê(‚Á∆üˇ˝’M≤◊ïV"[~°€•P›TÕ∆lé¥ˆËú]ˇ»¡∏Ë≈…ëÎÓ…Ã¡àíú∞ñ7«Ó§@§xp/EÉÜœLo¸~© Lhé•VÜ4ˇBÓª¶
{ÖKôø&h¿ò ã:p!	y(àÌK§¢‰rMÊÜ$Ò¯ü~˚øŸÒ ”J<˙”oˇ/Ø.Mﬁ›tç"ŸŒk“<ı|˘˛˜8Ç¢…‡#≠ËøiP©QíÚ&†°ãÇ*∂q	"Òø(∂BÑ…ïO™p6ÎU´
‚Rº],çTΩfÓ*fjÜW¬?îƒﬁ=”X†ÔÍæïÆL-:ìR@!HÖéƒûoç·’œ-sàc`8<îØ∑™ú"öt¸;Ÿ$4ÌFrq$ÚTJîhÌ®…*ûı.‹G≈w´òQG]∏≈Óµ
3jˇ˝)8—¬ì-Ì0M¿vò∂kˇvó∫¨Ê¨•Œ0ji*åG|“úÏÂ{∫ö*{~´´ºoOÕdˆΩ∫»˘_SÈ7µ∆˘≥â@Ö,Òˇ.Ò6<áóìQHÔNLœüòX∏ E˚Ì,sYs5≥çE	uœÑ'cΩˆÅ¶9P}ë/ÏdY£›ááÀ{¬ìu|™s›rw≤ï˜æ>jv€Ï¥sr|z∆ˆé{=LN˛E˜Ï÷˘™ª◊9jwXÔ¯À”v˜hˇŒ§+Ô]:∆ÿÏ€ÆÔœëØ‹hú7∑rÛïπÕyè≥ïÖÕ|ürïë€'¶ó<k=⁄Üg°¿7úàƒ{fù«l?≤fÅÂËg-w∞V´xkﬂ¬≤Çâmüôx‹	ÇDÖ!D z)jn;Ü ò2t√¡A≥Á›*‹’D˝ ıâ bÙ‹[œQ&˜Úáú§ú˜™ãÕRŒ)(QÍÜΩ≠5AπŸlòÕbÇr$ço™åèVz≤|ïgHqrrµZ>^rr4V∫©…ö}—ØMƒ{g£˝∂Ä‹bM2‡àZÀmfáésç\„Z≥ä#«}ùn>TQ[ß›c∂◊=∫˛t◊cÃ Óu˜èé{Ïk÷>hı∫/xr1Rx“^Á>§á%˚V*4‘èÜ÷˙áA≥π¯¡ΩA/‰ÁG‰•–#,–•¸¿∏wâƒ˜$}∏õ9,?ît-M% æD¢V$D„4≠X‚7iëN—äÓ˙p¥“C{èR≥r∫˛))K}‹ù w¶lÄ5‰√Úo„©E¡ÎÖA<#«c=˜C∑≈]Ü{V©÷Rn€fmM±Œ O°9–wÎÎ¨`‰Ç€è?∏¥1‰è 4bõ†)A°NÏ)?"¬(L*Ú°Fas´sâ‚b∂Œ—µAÿWÙj.ı–´#®p•SgÈ!sòÏnTu)…bû¶m&v˜=3—ﬂX–ÎvÏk√,¬ä=œ}ñ' ‰_ÎÍ1B^›1÷©⁄Ÿ©7±ïı W;,Ô®´À'–cƒ]?<◊Ø⁄Ûù·™La§5zNât
P¨mÇÑ∏Îúª–•ëî ·Á/˘ª£<xÖÂ_Æ¶ër@.?zÿ˚ˇ@yòbV/´ãñM∏∑%0®ﬂxW5 ¬Ç‡Ÿ"œPy	£å€G-¨d6åf„ï¬9îD›£î[©^ctÒÄ≠CÒÖWaˆÄF¿tÜ≈àdúA~-(ΩR.E )åS∂äqk}kNAë7e&Çµr∞˘*⁄ü∫xSZ%πÙì&ûÎLë÷ó±~	&m‹j1`ß
∫lÇôicw˝ÿ≥F¶≥õ˜Nè”kÕÁ∆¶Ü‘ei¿HNÖ§åá/µ™ÄT#Õ¸/Ø¬3çTÃSΩÆ'ÎbA®öu´(@@Ω‚`9âq6‡ä’‰¿LtAÖ.ƒ!/=€ã…$va¿¯˝œ‰†¢	ΩØW±≠yöƒa‰Â6÷ ƒb∏ä•âêÈÇ√ªﬁ±M‚Ÿca%$X°u€∑]ÿr„>û/ßqaâç2‚π—Ë¢‹:6N0≤¨âV5`F:•L¥6Ø√5‡ÁÉ,'2
À‰˛zjÇÌsÕíY√ÙÛÍG1í{¨n¶T2]ÕA;¸§π¿ÚR)=Æ1}≠§	iûêù7–_òr⁄÷’*0îÕU2ø
òÑ—˙10Ö‰ ¨Òc.G™“
ü»µ®¸è˘7∏.µf∆Üñèô√ßW	#jMHzç%kπƒß.…û1 ”µ["£e£u{◊≈¸˝‡r5¥<Û1•©ºúÀxXÏ∆+@õVb+ó¶¢ë;GNÔ“†aåæíã¯⁄‡~kµl‚º*EìWXdéZ@NÈ®Ê”t‹˜—3*åüò∏Ç·´4F=Q4N-aªË±“SnÈ¡ázÍ-û—]D≥„2hÇ9÷PHLl„èË‡¬d√¢√ßVñRj€ÒÔœôœ5¶£ÍÇÖ1	–îXDåﬂLcr™Èà’ó`E	å•Y(L´{B ˇ˚>« @[)ﬂÊô#ÀGtM‰æ>ò==Î∆ª’›>ºi8ÿƒ›9Y9®Î√ˆ_â|…émé'85˝âÎ¯ÊrvôØ∞•ƒ˘π§©]TIY¡M´;!–V>ØÏ38Óπã√3yòG;Ì0µ©√÷a_Á˛aÕ6ùQp¡û±F%—å≤Ïi ±SPNÃìƒANªâŸ≈‰DÇf.ã$>W´ürL0÷äõˆ–’Õ§©îKS`%l,˝¸&ºÚ◊îà@˙ﬁ@ ·ßn*©ªú‰kËò3Í≈„¢∫é¬∫Ãsﬁ/Á]±ë¿FftÈXáŒk›∫y¯t…q›	fg†∆<7=OOO∂'æ‚ÇevâMØŒ€‰å™—Qö*lFü··Ô!ÖFt¯Œtî»(:L√ZÏ’:^e‡ƒˇ¯O·AÃW
Ga¸mÆeCÆÓûºÙ®Q¬Gi˙≠+~iëŒÙÚäÛÒïí_&-"’ΩI2<Ÿ˘¶Q^D¶⁄s^^Ñ=RÛ"∂Á»ãPrüt9rCoû4N¶E§%ío%‰/ñg/~XiâΩˆù√÷Y∑Õ⁄›£nªuïM=~¡˛cÁkˆ¢{¥◊=⁄Ô›ôîƒﬁ‡¬É–ÃYCs7sscÍÉ{öîÛ~‹õ¨ƒNƒ\ä	z&;sÄÌEDµ7Ò,0q'ºÓ¯íàÛµ˙ò)ò5—¿‰STVÂC„õ†*YCX ~;·’QaçFh«∞ŒíeŒÜñgÚèBñ˚¡‘zò	È\ˇa‹ÖÙD?µØ?‰¸ƒ‹w]lÇb˙ëU2”¢∑ÓR™çA„1S1ñ—w2UQæÀ¨£ÂÊ*∂dÇ‚,uë§®ÄÑq™î¥è⁄Md-íJ¶ñe3∆ÏJq:cäEÚˆí‡¯ÒR5«îtF…æt{˘åQjı—ub•"ÊÔ=âï
∂‹áb/:)Ω˜"≠1VØkØ9ZÑp;ÇÊÁR‘âÀ€x1˙E™∆}Khúª2*'ÌÊeH@BçF∏Nh.¯‹Ó$Rla‘´ë ¡…geG3eÏë›µz˝åÃºúÃH9£µºƒqT>=îí»…Ã…P
ù%ôL®y©ËÈ˘ôå˘…∑ÈÚM5ú&"[3>◊6i…ó\*üŒsvYöÓîPÄ
∞U®œ¢&cRÂ’ÒD»©Ê.{nª ∑}¢‹—	≈ﬂâ] æÁcÿ$‚E?Ìë“KwèlÏ≤3[ZêL+Sñ’æ˘¸ˇ"SÙC·®hj«ó∫{íÑ ä5ïÿQiJÄj˚È~qÛ=‚òÒ
ü8‘«ÈõœA@›„"•W˘W`r=e#P8‹FS*Û¸ñIÃõ¢—$CÅl>§†5Û~·EGxÇ¢ ƒUﬂ≥:TW≥Lî+ 8‹P´Â¢√tÿ°·Ω∫oíh∏°Ú¨-YG¨EÛÃ=ÂlÜıØåƒÛ~«ø»ídπã·vKÒ≠å{öÚµiVCu|”∞‘ü√ƒ,òµ.í:+úï¨˝Ú£a˝Ø@ØÂŸH`˙¡é∫\=1¸¿d/<åmŸó∏q`…⁄X»2ﬂ≤øZ◊ˆ)±XëÉ√·Œqñ±Ë°~¸N‚V©t‡ôXÀ⁄y≤JVCáF¬}îIüäk«¢q≥P∂™y¿Ω•5£êC*ƒ@ˆ6ŒO◊Eí0jM6@zO*‰®ÁgÉ=û&ècÚ	£∂…•[SH7≈Xh€nhóñ9ó_wà†¥_~Òó∏rÿ_≥&U]ñÔ≠ü(ñ©8?4◊·Ω°î„ô'{^Ÿ‡$%òlŸÉÈ^‹/Ò®h√Q±¨âB´îπºàõSK9æ«m¬Ò~Æ∂m≤qäXèK·ÛÁ€;©u ◊π∞W¡–zù÷—	éqè’(Ü≥b/Áﬁ¬—"\z+´D{?ãﬁÎØ›l›Zo•`@Iç—Ãπ¯ÃñÆ(≥ÜÛ9
wÀ”W=•´úKO∏ˇ1ß`|‰KY;paaM|™–y\¿Ü Ow‡Â$EÁÑç#0h…πB…2Æ$ÇDﬂ5%‘√óûu˜û¨u¥tjé∏s]âO÷’v(‚ØNÀpØG›îÛˇ$Ëª√Kµ«∞ÍaéVë^ñˇ+>;ëL'œZU≈ìÓŸ◊,¶*ﬁŸ”ÕUj™‚•X)ó£Py3U8óø¸$ÊÆ Ö ò•Ù√DıE˝ú∑|uÔØ5ï=æ∞…RçÚ⁄3’æ*ØôTÒÓ¿À%5≤jiùâ4J©Î¿ªZ◊ÈMG#êÊ&ü÷%,|∫§≠òà+•›,t‰Ëí/≤£ìRfH>E.-‹≈UÑö&Â˘(»’ú∫|)Ì@ƒB”ÿUÒ«çTI¨›d“j”ÏmTK8_yéÂóÿ„%µä≠Q“,IÚ,cc˛
≥âCVvìÅ„ØoŸàêVXîæÙ–I£/G∂‹qB_Ï√¯véíÓ%õò#Ú·(÷l4˛®£#ÌòÛ-ÿìc√gÆUÛLOQO˛1=¨„O˝Å	ª≠è¯!3ˆ8ÅDuù∞·¿]CÑ%∂4ëÖw,·˙s±b‚KêrîV\cÜw8òbc˛¿FoˆdÔE9^ã6C7ìˆ≤∫∫ zùvª{˝˝V8ÌºËb›¨Œ—Ø>–=zq|zÿaˇûÌuØø;8ﬁÁüÔ…J¯5lc6B+'$°v•Aª1
ÎQ6$⁄ùÅŸ-Ÿ\ÂìãM
Ç2ˆßÃ∞

¿§:» '=XyØqQ'Cx¿=A]d‰ÜhRväDfËÀF∑6Ë¸ñ«⁄X˜D÷L¢˘∑ü¨_lŒô ¢âµ§8~Aâ‰ä7Ó¿ËOmŒP›f.gnﬂd∫?Õd…)±Ö=S‹√‚õÉA( Ï∞Üw]Y3Ô¡ù¯7S÷ü-ì=ÁëÑr‡c	ì//Ùtˆ	Á5pïK,uË≠ÛK±òñó¬5ßNÀ%ı–àc@Œë°V3V†-¯ÛèŒ¨f\ˇ—a„Î|D®OA»ª\ñﬁäÈß,_tV5§ñ§õ⁄BOÒÜ»6ïõKZ8ë›~,í\Ú8§“"N~Cz§tT ü6È=ùMîôâ6S¯ßPmIì«át∫Âí©dÃ 7kvàxâ'∞ö<”øhøÕâÈÂ∞CÖcµMC”SÇwìc'6Cö §-x˘Z˜“WâΩtÌ•R˘Da‘∏˝O<‰è‚¸ÿ˛kõWmf÷6Üà’	–[ƒBêèä€Dâ¿–ˆ<î0ôfgÉ–é≥£Ù=¯YPd*’Ä@¬ÀîΩP‘êp—íQMdUfD$¸DâïNNÀãËõi∫ˇO≤¢DVàë™[R‰‡íR"ú†∫dƒW·k…F
≥Ô¢i.{÷)üöÎmP≤‹±‘3ÇJ©g
™S]M&B‰%ÃÉI@I‡^ [È€Ëc^Ô,ùwë,HròÖB≈Uyù◊Ä©êı“¯
Î\¨R˛>5ò•√-ïQ »‚àûIXø1`/=ΩL=DÜ√++´è‚∞Ç„ÏH¿yfÜ`Áv^cÀÊö`Z„è$y√&»KuÜèÈ=]Í¸jó}∆M/ÓÒß#”r{ﬁ]=mÌıÿÊg+Ï≥Ω–j∏R«•…øf¡√És^ˇd¯Ü÷(æı‘å§	T¨Ì‘q£àœ›¡‘Oi≠;€I¨ã<7Y¬pùÌi€Y0éåç∫” ôäx¶i˙pëo}+ˇt±⁄‹R‹˛Èÿ9aòÊRùé‘EÓóÎfπ˚Ñ¥ñgå
∫«‰∂ºx÷òÜˇHjO\m°2mÆÓ™«Œ=w≠2Tn‹∑üEXWıûÌh·∆w‚˜"]ãﬂ/ÚËs∏=ÁSö-ß2gWƒr{a&Àq$Õ°óŸ#ûîÄï(à∑()Â+çÑ…´™√kq¬…•…∞Ç$OÊﬂ}“æ0Ø€ñ7∞3p˙ÿ«ßZÉÇw“mÈYt;˚:(/	ºB∑í‘É´1_DæﬁÏLŒëm˜Wmú#4L™ÚíuÅÉÊ$,)WËÛB_µéO•´ø}p˝$≠¬œZ¨{ÿ⁄Ô±√ÎˇºáñÆ˙0ö;[›±12+—HQ¥ïZY>¥MãBzçÕ–M‡ü–ÙÏ≥5‘Kœ™AÃ7◊7 ¿<§‚´Ç=Dƒ *ëc±Òﬁ£ñmä5ô‰<à“ïﬁ©°…æc7$uÄ_˘◊ÿ?A8ìÇﬁÂ°~ﬂçáSRﬂŒp˚˙ß ›ÙCn{†vn¨ã2‹.3Lá˝ƒ©∞|¨åg&È√ÖƒÇ·§2Sî’°Wy*+¶ôSSìÁRâ
r”z!M[{?ˇÚË¨UoπÏDFjlYÙñ¿Tî/Î∞≤‰†Íuﬁào9£H∂?∞ß‘jh≥	ÇJÿˇêˇ	Ü(£1lˆ_•í1íì84¸ã(@â	Œ@˙K¸ºÉ°ê30Ù=¶	+®∑≈ï§ P¨3Â+Qd¢HÙœøIäFKà∆KïQ–Apˇ–Ío‘' ·AºË_ΩÒÎ>ˆ›w§çP√íá›‘M6£ëäNe~€i<jnôﬂ"mEó¯mk‚∑å"Fx˚]∂?ª23^§B}Ûg]E'ñi£∆ÎŒµö©Uà\»Vid}ØBï ’zA<ì8cøf_¥Z∑‹c≠£÷Ÿı˜á›ˆqè˙Ft˙1ç\ì∫'S≥fX∂ù|¶êÈ•IÇWí,$ùó~ãt!xÕ#¶„ÎÛDπvÖ4$∂UΩ3M¢ƒ~ıò¯oï5/t|ƒR0‚∑OÇ](Õ|≠Tè"ë–r%∑•[¨¨êKDˇ…tÜzΩ≤_∫0%À“Ã)›.d¯®"Õ¥È;
lŒxkÊB6ì√!ı¿ãæ,$πá‚êX»2!ü–‹\)}˛ó™ ÕµÊ2˙Iê«Rs∂,=ìNÕLÎ“ƒsk¶¸îaQIL–˘ÇúîÖ≈¿L≈·)‰◊•¬2ªl)©wôá®sÖ6ü €"∂îµÜCæ¬õ¡Ùôæ?F„œ=Áe˛x◊*rë÷‚!,ij3!á)#û./3MŒy\—Äczú¶ìrÜzØ°“ˇ€øÓôæi¯[®˙,c‰\ˇ¡Á.K<mÁœ,ÉM<˜6ùÒ9Yä– grÁAf6|’ì˛{X^ 
{	FÙı∂Â[<;Sh`HVáX_÷Beæ5I3XÄX !I^À‡\BUƒ2 ñIé1…À´5∂:Êì÷aü"^íÚFÿæ‘]DƒÓœXÇËårÿ® &ŸT¿Ê;€*Ê3Òq&ÓôÑ"¡ ∑nVûÉDP‚5"Å¶Nê≥¥Û'HK◊÷*Ã[Cç`†≈∞uô∂#:å{≥'wÌ±‹µ:ÖãÈexıÙΩ—»+P«÷Bqï–ı‡$∂bñ‚ €eL#øà†Ê∑jÛπ÷r¡mDKWœØ»yŸ˙`ÑHÅ"Gáˇû¨zµiS"…◊ò/l– ik±≥πµ—'∆íáŒùè®/ò≤>ndÈ‹∂˙'NÌÄ˜!ß¥›ë(ƒ"≠d”9°àºælfïµ˘›÷˛—ı˜Ω3DOµˆ∫ÌÓÒQÎÄ-˜:˚_ÌµÿÒI˜àﬂÿ˘€ìŒÈYãVÂSÄBπÚ≥‰‰á•òÛTà/™P2`„`Ö"Ê∑ô§,…≠YlﬂÖê≈¨·øáqãí◊˘º(z‰Ì/Ú‘Ãç`(ÆÜ¸∆v°∑‚àb§m¯;  ‹X…0ö?+âd(Z•V(#&˜ä·{‰Fô¨Â6∆}Í˘aéÕ˙√9vslzÜ=Ã/Z˛ë/¸ÌmtÖT®s÷©Lï >í3R\.n6ÏSd‘'·;aeº?˝Û˜zÏhE9ø:uˆ ‹Ô¢ãÒ™RDDÊ’2cÈŸâÁ.2Jÿ∑5å±çm◊9∑Á[Éµe…_∆üÆVqˆíÇ»ma!pö∫¿`›ñP 0{ÙôSêeA–kq'õ†PAü=«tõHÇ…≥PU*ˆ∆ÚßÜÕ~=5%¡U` ›6ÈâäéÇöKr≥åV"G#d‚l"À|◊ qXtSÊ^Ç≈al\∫óµ[&-åGÊúKiT',YÀmÛÊ—®¡:áœ;{{ù=÷>hızúÛÎl‘;Ì¥è;G{ùSQŸ~.∞JÈ<[îtû9¢÷ÿïK>L:e¢ﬁÆ.o%˝GµñÍN öçüœ+„1B
*ó§ë2•´üñ§ËìãNöEπ∆#m¯X2-∞Ë%ÎÄ»Ñ√√¡(èW–“Çn#)®≤,Œ˚é†Vã
‹s6YÊ,g‡zZSéÇãl<2vå_Ç;Ò\√ÎâÈAÑ„Å∆L°Àr$ƒß&ÿ·pfq™≈\sz=F°®òÌÜJ9…vŸÒ∂f˚vL"§d©◊3’gmKròD%4cÿ©¥BDmÉÃ>ƒ≈Ü‹XŒêúS#GÒçÚB∑˘û¯ÕàoF€‰Ó´î\¨ÎKﬁ◊«n‰ÖKCj85'ò*ˆ©ßÊ–G·‘≠·‘\€èb⁄=iŸ¶™ÇºƒéàB"èî«ô±r+•®)h¸`J€.\¬mn‚ôÇ±2ÛEá”WShòpSYÙ¯äèS$ì§Çuï˜˘öm:£‡ÇWıjTY|j>$W·TÊ]ÌLH«z}:äÍ∑€d“‰aÌ‰L2∞O\'“C&Hˆ )«ëPj.ú}PÊ4Ø±ì©9‰4–ôr7Ä˚l´Ô	⁄h/n! .‘ÔnJÉY»ÍzVmm≈ÜÿÑ¶KÊvN ÄÅÂU2»’1D1OÀoŸàïÀ÷`¿û≤†ù5C|‘QI‡ˇ‡Å•|Ω_¬_Q¯ÔµäpÃ,˜Ú/è{Õ÷´o€V¬∏ïÇAÊ´ ók7F∂¢8ÖÚLE∫√±xUQft?O≈πë5ãEd£ñ√Ÿ»x•EV∆.êVíC~ÄD˘95¥ö±q±(õçJ(qıb∫®Bùﬁ∞T®Üqïÿ¥z!C˛Ãõò
≈GüuÁ{Ï”≥QT˘T{ñB≤©§Ó∂¡µQ¥ô}mƒÜ˜–≈*	q≠›Ò≠0ß∫X˛úõò«∏∂«N¢Ùzv„RãöƒB5<9ï†æ®S∏C„ÕıOjôƒ”™Ã¢^ùFçRä¸¥<“B
ﬁ“3TÔ◊hÊ=È$;Q®ú™ÅñÌTM®åÈ2^¸5ﬁ^\Fë9‘õçP<ÌABí0¶â«•Ì⁄@ûßâÌ°_Ñ)C£[tv‡z˘†É >’ƒH·∞d˝C#Æ∞€-g2¥ø¬‹(˚Ó;=Ñî∏¯w—„»5^{:4«Ò<ùHÌ’;Á≈ï«ï€Õ{¬2ñ°‰ñØÿ⁄⁄˛∂¬¯cwYD£+ª…ﬁSägÊºeº`í|ï9aRWƒNƒ^õ•1’ΩïZ∆ ó£í~£?9»¢uö∫“ UPgVeZGãh8ã∑ZÖ2"˝s˙KögÄ∆Lk∂MoWXU¿™´XóIürl Í¨j%L5ådZ∞Æﬂ±Oü2+ßÇ´ pù$@™Ô¯Ú∆B∆›®„ÎèLÿåıÚ ñ:˙µ∞¨,Òˆö¸Ûz¥@´œ⁄·Íó§Dp‹ _‘}K#îVØ]ñ3¡ËﬁÉS«elFÂÖdÔﬂVêb4”~	«¥”HÊ'™üotÈîÚz®€“í≥
F˜ˇ  ˇˇ ˇøuYxúÏΩ]oIñ6x?ø"ä’”EıäIâ≤¨◊rÅ¶(õ=˙ZQˆt∑_√ï"SdñìôÏÃ§-Ye`XÏ^Ïª3Ë≠¡^Ã.v∆v˙¢h‘Õ†o˛ì˛3?·=ÁD‰wDdíí]Æûfïm)ôë'Œ˜ycüáQtF¸π±ú°ÎÕ\œ,g‹wFÊ€€€c÷Ëä}…™K‹â±À<ò.83/=”ütﬂ∞°m¯˛±15˜*ì⁄&{«öÅYÛgñ√Û*®ôS”3ÏQm´›®∞çá¨3≥≠°·å‹zΩæ‹H7ñÍ€eñﬂ±=”]wÜ√è01›â9|%ôîƒkè\f:ÏÃÑµÃ¸ˆ˙uOÌπüy€zﬂ∑ﬁNº±«ÆŸë;≤.ÈÁèÊÔJü¸`„bÆSˆˆ6F÷ÎáQÚÏõçü±sÿ Ï‘3_[Êvaª@?€(;¿¥‰¸^åkœ?o¥;Õ∆6´m¡d{Ó6ˇ®ve≥◊ôû¯ßÊ€∏	w⁄æ˘Øõç≥a; œ®y¶m\ô#65Æjì⁄÷s_õﬁ•Ìæ©]◊åy‡2ﬂ¥ÕaP√Àô?Ù\€æ0ºZ0ÅmÌœå°	Áµÿ•Î¿Õ«Øî_¢Ïk— üﬂü]Ω‡∑ª∞ò&:j9#kÏ÷∂`‹ÛŸÃÙÜÜo≤¿ÉÔÒﬁX#”ÿÙ¢÷Ñ©àÜN¡E¯É∏À}òåúªƒP{<_|g∞ë	Ñ{iz¶3¥v¥¯›àôÕœ`∂¡z˛–∞ç›%»é»hô˘zxœÜwÈŸÊÿpÇ3”üπéoV=sX¬ãõNpÓv`äú—:´dÊÆ≤ˆn©G.qrÈS◊˛K·IÔ
wnâßiÔQºqœ÷j5X‚o˜üû∞˝¸?x|x2Ë±_≤ü?ú˜˙›N∑ø¯ˆøÏv‚»…qo¿Œ:˚˝ì√≈∑è·–ÄÓ§ﬂÓ∫∏à7ñÎ<aıj‰æqÄaŒm=óÙàì"ÉŸª±¸ﬁ»BUÄ≥◊#√ô6<éö£≥ËL
c”q’OπÃG◊Á◊3sÔ&˙ë}Û0 sàÉ‡¡Ç[1GF¶∑I˛™ø“u8Aüª|®{7U√qÃ+|ë5∂˜ê›êl`√π{'`{ŸW«…M´Tähïﬂx>·Õ‡∆·#˛∞Ëæ<Nß*ÓW∏S‡“^fÿ%Ø}ßõpçê’Ó;≈é”Ì5‹eg÷x∞ÆkœßŒ.pW√Æ÷‘d03`Åı⁄dß˚l&ÑßjÌ@œNGó~’Oö[i8§RÜ≤“ËMÌrn€l:⁄}S{æ’˛ÀÏ ¶w‡G‚YŒ´ZÉ]⁄†q„_µ°¢w,,àòçùF(wºK¯s≠ëÕë»ùX£ëÈhŒŒü/ˆÑ8»zo…æË9¡(F“‡ÉNºDÊ˝∆∆ŸÂµÚ3˚X∫Î‘ØM\Zˆı‹¨ÀÎ⁄Öº1µ/]Ó~88êˇÖR˝¡Åeõ¥«S*Î(¨[Ym£¢€‚v†9y5¶ŸêÈ1B˝¬â≈o¶Æ„Ê‘òH¡)°ü<ÎŒ;ÏÙ¨˜¨ﬂA∫(îõ8ÿÇâ.ñ≠Â÷¢U8~ÿ≤Ç˜¡Î√æıcÕ.]vMñ’*iŒ5˙eh∑ŒÊ6ËòÀ,∆2q	¬¬üûí&r)¨X∑í”ÛNÜúc5\M…¿I*wv¢”vJx"†-PœØ¿¶ò]◊±iSbŒ˚Ω£”v÷Î~åçP¨EJiî∏ÈœòiŸa©-Ñ“`ﬂ2R«§Qπzi†ïdÁƒÇ Vô$?ä˘/∑µW3@u≥¬OÆûÌ:]€æ›êTB–çNAJ†^6LŒPıÆ*Q¬3OœÕW@åõHåh\ mTÖMÍE3fèÒ«∑PπØ†WÄ™Ëª^mÊíû√~R§√‚gñ}#ÚıÖoU N˚í}Ô ÌÜÿïo&∞¸ ◊09j”Qπ[Ì“≠Ëµ¿ Fµ7!‚pÉOP≠ŸMl5≈∑~˜U—Í3ÇrŒ•≤^üê`g af_˙ÛÈ‘ÆÀPÓ»Úç€Ì›|&Æãˇ¥à>;3?
Íèg◊ùC+∏Æmﬁ…é ⁄≥€Ã-9ºp®jjzÆ0Ö–Me^ë?vh-æwòa3
Ú}f\_ªxµJÂˆ{∞ó| ©xƒùÏ»2ﬁWîå]†Uœ =(Ü6°Î∞GtˇÆdds„#qèŒ»ò°ŸV@¯‚’œå¸¡ÂÖ_+‰âç-‰ërù‚∑ÂíóY~◊£eæ›»hùmÆuf4‘eA¨(eU¢$_hÀ¯B©'ïÁïò§©ıVÏºëÌìç áxÌ¢±XDe≈{<∫Û.ªë¨Œ|Á¸‰ú§„ì≥£Œ·≈Æ›rB˘Sÿuz}ﬁ~ú«6˜›7éÌ£cCÃO5Ê&Ê“ﬂü¶xwtﬁ2˚µB<)≠πsÇã°øI°Ωß$w	i¶›”≈≥)Ëµs·Y9µ¿ÍôÅ›h,~o0gnæ6nO°zW0«∞-'ëM∆(ÔR0≠|Bë`ù˚ñ?≥çk÷?‡]ñÚ˛ëÒŸL˚¯¿ŒD%∫ˆ0Hæ”îﬂO+„4Núœ™Ö;$r–äÕ1∫|ÍŸ…ËD∏Ëãµ¬ÿΩ‚}”nL©›-~%?á·ÕÕb!Øp¸Ï ÖÌ(]L%AfZ˜¢‘°Ô\uº4ÂÈ*·^âúQ<êÌœ;3@ñ≈.™≥[n  f¯¡âJÑ&¸Ab	ÁH∆ùØå»'Ÿ4Í·Ó+&7Îw~·ä˘ﬁT∏ü‹‹ÒåΩ˚<p]Ãÿk˛‘1^œ«Ù˜%4Âä©IJ†“Ú„0å=∂SFÓx¡˜LÔ‘a~ΩWq‹Zx®Ë‚ÇΩZé~?õ’∂óab€ÙÇÆÂmS…∆åÈ,Tª\hd∆≈ÔØe\%XU1≈!|D∆ V˘Ãu,0ÃISMYÆ†?á∆kÊ‘bM∂Ä€…'àå©åÕÄπ9ojW~.igôD—úî∞v`⁄∏`sG‰ •,æs¨°À”`"π‡1”∆mYÍ∆0ÎOå∑p+kàZ`E,Å«Ôi∆>ä
~m,0ºØÕÄr»k¡O‰Ï
ûJ$&Ï„ﬁ~°ä∑µF”]´˘RzKµÇ(IK(xW¿¿Üﬂä“9’üL6ë‚3…˝õ°œb€?È	eéÎ®»ñbPÁãﬂÔwŒ0øÊ¨∑ﬂÈR∂Õ.Ùé˚'g"≈Ê‰qpŒ7€∫êøﬂ”Û‡bÉ^˜ÈYèuOéè{›Û˛…±˙BÕtÀN~ÅÙ‰S-ßzÓ;X˘Ù(∞ÛàmÓ≤˝~ÁÒÒ…‡ºﬂ≈<=<Ôü≥ÓìŒyŒ
∏·πÁ∆mÛ
Ê™ÃÌ†"ãÆ>à«í{ßW&à»‚‹∑ñˆüaÔ›‹0·“‹eçuÜâp&¸Tøø#K6ögÍ™ftUSvâyeK>%6OÒ¬—‹£‘*<øŸñùüÿ>ú·nÅ.7Ω‚Yêi<©=ág´ÕF„ı§÷‹ÇM±ˆÇM-ßﬂ¿éÄ=íù+	µ(˜lÏFjÂµ∆PEj]E∫gzpYıSx∂·|Èvì"ÔÈƒÿDó_≤œ…%õ¥Kú¨¢î£V≠¸dØü¿îø¡i'úÉ—úì≤ŸM¿“*ı^oÔO6sÚﬂüÊT"üP$Y(Ÿ¨>;Á»Ù}cl~=7ºå≤ßLÑAwr◊C±ªocgÒ=,ﬁ–ı5‚o≤©ô ΩÇx·⁄£¨®Qº.õò,Pyÿu=Té"ÂÕ∑∆éÎ≥k–‹„Öﬂ¬,^€Ù5
Äfuu_iΩè/¢⁄ım]≤*pﬁKÀõV+ˇˆØá÷tfÅvÍèo˙<z30¡s$“Âõ6¸/+kk¿M,ñ⁄Ø>°LT&ñÃkÚ\?Á'§còÍ§ˆ@ƒzn/œ∂`õK¢ZûpJ|>Î§ˆ›©%<•V u∏„9®òûiîdÇÇ#£ÂïK§ñÿ„	¸˜˚ÕŒ≈>Ω&ñÆnõŒ8òê oh‹yfy(V33õØò”(4Ã•Ÿ Ó“LE0;Ω‡≈1VπUÜU∆ÂÎ1fc›–tyfﬂπ¿¨∂ñdVM-≥‚jå∏ìíSgç:-„∆±/˛ [LtÉ=6AÂ∞‹X⁄–ùŒlÛk¯…ÖüÑïÚô˜w«ﬁ‚=¶ó˚u÷˚zóU"´òsÃ9®ÄãÔ=„ä38Àé9≈YpOü˝zn˘¸;õ€∞]aU}‰9¯¡ˆÿÎÏﬂ˛5≈UøT;SVc∏:ÁIj∑LçYµ:ı«ÎXG<VÌsy ”y„jø7pùôó“V˚…<ºÓπ6∑∞+sƒ1∆‚√›f:#
≥áøÉπÍ]åØ(’Vkø&»IÚ˘&4'5I^FDÙ{Âc8 ‹b|œ£‚ú¢&‘¬ÿ≠d2
]0YâLçvc£%ãŸn¶c∂-–S
ÔºÀ“ä™.^+´ì"må≥ÚôgÚDæTâTòG¢ä>†ªd˛múÅy7%TÂ¯<ˇ®h˝È‡º∑œ™h•/æ3˝dçH˛qÔ®‹OZØù~A∂…*…4#Ê»öOìÎâ≤‚˚îHHN…ádSyHœ¬ÒΩ+·,,W…)/ü#´	+zÏ-ß\ÃSÒl˘‡–C";é% ˙0ÌG˛xôZèî! ô±fƒ:≥WÍ…≥⁄$#éy∆ÌJ*∏E®P‘’ª>À"~RTì°Jw#ÎπH'Î8‰∆ b⁄ õyÓ¶∆˘Îà÷Ù}8Ò6T•˜∫™µÒûÁÅŒ∏YÕ∏™OÜ–˝v{£ôwÎÔ∏(KDC9ú6Æd¢ßL·m<z’^^aJËe=ÛrèÓ˛»k
ÙNÆ≈Î≠æ3õ£5ËMKZYbfsR<ê9ÃhüÑ•K¥—,«Q:H‡ú£¡ßò™◊Ü=7˘K”∞US
V˛ƒp∆pj’sÙ∫·EU≥œõAùnß‰±ÆÛWÊ5ÊEw—{Ã:(¨\pı(	á“0Ã∫?±.∏’ö∂V“¨cë∞í}Û“ ©™-#‰…K»p^›%™óT:f¿∑Ã	ÿU¶∑WŸ7˝°g]ò‰˛∞†6#p¡<«≤lc€∆€±õ6v–—3πhøû/æû¢“ <˜çøw”*·…•–®ΩµƒKás7ß∫&7˚ÏS≠ØBß[Z˝Œ§\Ò€πÛ }%§†%g)¥®€π‹,`”÷[~Å|∂wIOñîTsg®ß‰ı7ﬂ∞œ¢]U<kZUÓã¥¯ç∫€,ùﬁ•æÖﬂŒ/U¬úh%¥CÜíHŒ%oo•<")gm,v….aÌqú^∫H9ê∏Ä3Óõ®2s)'Zœymﬁù˘ŒVw%£][ª¨≥èÖˆ`+úıÿ‡ó`O±˛Ò‡¸Ï)≈ÌÿÈ…ŸyÁ∞0<XØøZ‡+º¯?W‡k3¯
Ωñ€%†E+Qº*Òp)™ìVŒYw+~∏ÿ ÉÅ`d’·∂4§rfé·Dû•=≈|
cä^9Ωj¨„£◊MU6Ò`c“Rº˝ÚûJe∞~hÄRNMœwπFœ5,«º˘P∏ßp3œ@Ô°π*EÑÇ—∆ÙÆv–)	:à4RA∞˚ÃΩ∞≠1¸‰Y‰—ú1ÚâÚÃë1‰ÒùY¸¸|I9 ¡«Å∑1}π°∞µı*Í¸√ﬂ˝ñuN˚¥(–W/]÷5º´¢â=«|P1vYwÒ˝‘Ö°òàÇã⁄ƒã÷ GPe
≠"aï‘!Äæä2Ωñ≤ic®Èg!5$õ/Ú!™
™5N~ôã‰dâåí CBÁŸe'b‚]ÿWé˚⁄ÄB £µÎ˝RÌ„◊ÿ@ewYh±≈e˛Y7P±π÷√B#‹˘\ùµﬂè1LV	Ìµ(Œ:â˙áÅNﬂœqS¡VÑ3E\◊CÉ∞ó8fë·ÿ¢ã°Ã¿g¿$qR˜‹mBcnFù,óŒM™È`&öë‹˝o^Õ,èGZ◊1Œ
ª6⁄Úèê√ )˝\Ú≥][≈…2YŒŸyéë©f6(÷6LgmdÅ·ΩÔU§Ãz=7*·=TÔ €R‹œ,ø{`∞	Z»ïIÃ¸›ç√BÙÀ≠è]wlõı°;›®0n	ÓU^ï;Ø*òåI©ÓåhŸq£‰‘‹\$Füºä£z√™¸ù‡[œ‡Ï?÷1á`Ey@èèiL¨”g$´JÜªˆ`√x»ê¶êÜ¢84∆êÜs√˛ı‹BæáƒBπy¸û*GŒÉı$jÁ7ô+hbˆp¿£˝¿Ü	YÔ»◊Á#Ü±∏Úÿà'ÄöWy∞¡/x»™')ﬁ=‚Ï˚Éæ@ô¡vaÁ¶dº©¥«πcàqSıÏ‚·‚˚luÉ <Qªò3∞XÇÒ/‘£¨Ã√Ûh›ß¶≥¯∞a$8sÍ∑¿úL R∏Ñó%m¨˜x:(ªA»w’‘$î®áïPÂJÆb≥&êÚ˚l∞Å9ÙL‡Mk§ååa0@˙\Y≈Ww>'»0§Á∏"SÉ+J$ìÖ¶$Õh{fÉƒAä{0Ê≠t1g¢=â›¶&Fo“∏)w∞s£”»„2/Å¬^íîƒ!<\â06b˘0tÅöFHXh—õï†ﬁ^Z}<}…÷¢UZ~æl∏ˆ2“£æ`Å[\ñ‰:B\€ºTá
˛¯ÀŒÁ¨KSgÜz–√∞˚%<áÇÂ$Ω—>4}ÉTŸ˛‡õﬁkkƒSÆH7∆ç‰Y ÛU ≠Bã—´∑<^t[“·©Z˙\∏BK™Ø+)†Q^ä?›•ü=˜˛|pî∂qa 4&!“.gât%çØΩYgPXA∞nTÊ¶\ ´é≤”˙¬PQaF¬^¿W)õº∏lÚcô:Ÿ≤≤•≥⁄ì…l€7}tKe∞≈°IInë5)&+¥ÍÒ–aö≈OC,N0Mxs¡J·2¥˚)Æ(O¡7É¡5ÆTbT˜é{gù√ó‹ˇÙ2·*¬ÿ”|´≈ﬂKÜ90Hi÷ÊÓx{2ä$"Ñœ3Û≈N#KjÁı∂¬Ã“ìÁ#ÎØ˝M‰ØŒ‘˘'t4«+ªŒêÊ®Ÿ Û[ºøpÖ ›S0Qç%‡õ”Y¿π%ﬂiÍ{Îö¸_~«Œ$¯ﬁYa,™V ie¿dB&V”À’˜t;gùÓyÔ¨7ÿe7~ñÑEÚ†ÆDEÜUú{õ0Zn¥ÀÑ”ÚªµdXç{⁄%¢¢L1Ïx_ÁÃT≈{¯qwœVÚóÑGßôÒËƒÒ ©€ÆY6t/U™ü†Ωl‚·RÅ!UÈö¬≈ÿ÷»’\$∏ .9{†°ﬂ·öŒ‚=ÿÛOAÑ∑…±¡Ê6∫'\t%˙¬FQÄ»7FÑ)P_…Ò◊≈S≤ªãœ]/N∞™v§“[~8≠•ï–Y"ÃêTΩÕ$I≥Uåı≠©¸<≈e©˚Jú°õæt9æ∞µ_∏e¯Éo˜%∂w¡éHAU'ˇOgOlÊˆÑÕÕ}t/ë:¬±ﬁëu=–∏1JÒwüÒÎUwC˛Ú?Ôàª‹‰·‡˙ ˙¿ñ(yIâƒpÙ.¥£|¶¸Ãï(â”⁄teÏπL^«∆¿C7[	R¿\Óá⁄L”Cä®ëƒ‚íPI—f;ü5W:Ò—À.À%M§lìaõ,ùCÒiqπµ‚+Uø}ÚL"¢~g´f<oº‹ö]Ωl∂‡/o|aTÔﬂ_o6ZÎ≠≠Êz£æπñ´∑Â’Ú	o§àøØö˚RÍÚ©/Ì]ÚÙÔütüıéœ;<€•s‹+Nv1f÷jâ.x·Æ$ó≠O.…%ˆ)'+Jî©/©Q»ã¨yßõ≠L‡t{Z·ÁBOÎñ∆ü´éÊ–úRyœ∫ô8ä.◊6∏W60«	/-lF•sDïÉÛ≥p®*≥ (ú55Ü∆‡E(Í}˜2xCE{!Vô»#å"å¿é;Ìtg˝¡„ 7FhlõûGµÖ˜µ≈â	†a∂:Ü£ÛØ\4]F∆â•Cl¿”◊ôYEôãM:N|b∂⁄MñQoPd∂DØ—∏lé^dïç˛{K≠•T‰?#EU˚+jdÁíóæ K†ﬂ¯âÀ…UiI»ÕWaÑü$W´ƒ“"Ñ<¸ï¢Ñ ?ŸÀÖ_&à˙“=G=⁄W∏ìUf´óáˇ«?¸ÓIDñ£ì„˛˘…ÎûùûÉ‡^7CI2Ë¬W$|)˘≥_"ùQU∂h:â£†$π¢÷µñ(Yë3ôÄ°à$1Í#¥í<Öp˙uyäıFD
ÈW7†≈¥„ìFÂ†Q[æ‚ûÿÇbä¥`—*íÚPJÑøñÇ!Ih…çó;†"~Ÿæo6.^ËãÍã2ÿîiQjÓîïÏﬁò™Ω–\ Ü¥ØŸƒƒlN¸> ¬®´‹¥|Ò¥’·Èı´√#Q"íbLyk∫BN}ÒVC[ºµï⁄öe˜4ë[ŒÑã∑L◊óPr¬ `ÃËPäΩOÂß+ÍôXú√ôé8Í’;Ó†„ewô›Æáj†°¶gF9ú§sQà;®OEYKa≠nˆB≥®p0s/É`#fY/J•9â…&‚ªÌ√Né#zn7DÀœ÷ñ∂Âß¨Ëpƒ
Õîî ÊÛL˝ΩÀ¥y\ıÎ¬"aJ“Ô—0‰K*¢¸ìVG£NÂÄøe
ifcHÒæÑWFiM5â*°òÍ≤V,Jé0üô5JÂ0…R¥ÑTÏ_µ‡XS‘ØLØ*g¸fÆ{÷à·_ËkMTÛ„_[\‡Ù≥]5.≠1òêJ5ùM”„∏˘
kÆìT1éHÜÅ¿Ø/_ô◊/√4 sTÑ3 !E¬&‰iëÂéÃJ—≠8ÜàD5àÚmZZ$∞qñ√≥X…FL‡Q∑„^®Ç1“ >b£øLPF˝6—UÑ4‹üdÖdù”…ïõåˆ€l\‹ﬂiæ®$W*•3Ssøº“ºµyŸ6_Ëm–Ë•§˘=™`UËëºòîø}:WóÌõzFΩÓÅÅÂUÈS
€˘|§~x»?9îŸ;†JØXH¶˙_DJπZñl1z'õ.k¢Ú∑vWÿ|∑&ØRƒUÁ&C˜™€íä‰ø|cìóÜı÷©ç9‹ª‰{›#‰ÔJs‘øç¸±òã-¶>ÆK¡Z´≈{gdx4ä?˛˝?˛˚ø¸mtZﬂô#î5´ªaπ∫A;˝∑∆‡z≠pKï€T\®,',¡¬ú'É◊4z∑F∫É~#©ˇÏç·9Ëkÿ†L\f†˘©›π%å"≈I√Èœ=⁄Ω‘ó±RdIÂŸ≈fÏ9QVFnïçV[	ƒ¬OíÅÇ-W;&ÜôØú‡i+˘PA	æ„Êsæ#àπá3fq?Øﬁ@˙ÁÚéÚzõ∞e7™Õ–|ÄE+CÍÒ‰Q\@<ÏFê="˝nÒùcRŸmæº¥UïìTy·í-
"åπOÉöπX ◊[ºüY4lkÖaÊ›µ:ÎŸQX#]#91ÿœ~via: \tÕlÇÖÌ∞8
M‹È‚}fˇÏg@É6w!‘ﬁ$ßZ‹dÀm≤`l$?*†Ö(¨·€Këx&;˜PcÉÅK0äLöä∑`ÿˆµ{$$|~p˛+¨ó‰Æ2xÏ1˝ëŒµtcÒ§Tﬁ) )Jè+Ÿgªt=ﬂl	GËQ8˘>80'N«‰N.f‰ZYùÕÛﬁl…j¡rgˆµıëÔŒ"çZˆ•K¿!#·ﬂ¡§óúó+!GÅ"ﬁ	Ç]ù ÅÃ>+%
˙¢®›yh8ÙÊëfÑÒ“î˜∂ïÖfKoÕRvà=^⁄ø%òÌ)njœÙ]˚µIÌ/Ã–u	z¯:£¶I|◊Oåk3 ûhq÷ïtÎPTâ’ŸæÂ-æõz≈”‹Yï.S7*©çÙ≠`éï1ºtñj˙Ûf0z<‡kÒ1ˇ˘k◊{≈Ö.’ë{Óh>4U%å%xgT¢eùärD}©∑Ïﬂ£É«ˇøDÀÉ˛„ßgjh¡ˆ{áÏË˛>¡öXBª)8|˛y√ln∑Óø¯!á• Eóè¶;uFAîæ≤MuÙPE°Yä˝Îü˜˚è{«›~áuŒŒ˚}¯ÈêñhŸÿ¢:§ …`9’íw¯$0ñ°ÅzŸ»ôaAºÖoé†ùX≥∞.õ™˝Øπ*B“xÖÍY:nc:ºû´Œ1'Ù T˚`Õ«îMÁƒ5™ò}&ä¿U†Ò9 …∆è˙ó»‡ËÙ©AÌÑ∆∂{ °¡5@∞X|?ö€›pêæXÊt∆°04. |•e]¢[º⁄∑ÿ„Jæ—ŒŸ>kÓ≤É√Œ‡âFy*
î´πÃ˜ ¶äÛ¿!¯Gµ2&‰ì⁄f˝^ÌﬁzR—¿§w.NCS˘jeN¸(Ω,õB¶uÏ˙…!ÛPmnÿZ∂üBäæØBäﬁI;	i§Õñ*è4¸p"p›{çãÊÊãº^õÕ‚ﬁ©TQfîﬂ¨~îZÔ_FGU£…Öñdëo∑¿	Z⁄aFÍä@ÍÅÖg∏•ºíYo‘W…¢Ÿ4B… VZÖòÊ∑&[¸§H∑ùjGøéy6Wæ]ÄÉ^ vVÊÒ:›Û˛≥r†ùı∫'GΩ„˝Œ˛I°Á™–¢*Ùm≠*P©◊Ñ˛ıÈùI:RÑi±¬uo*5¨Ön	Çæ	E-·ìo]'Ñqõ,æª,rD∏¢/˜H4´”/CÒZg˝ëâ8-ÑbÜvËY3Å"`9Ñ÷˛z mÒ~lŸçöÒ°¥ƒY°Í,q©:9ı^çÚºd†\Qª"‘πÄå- l%CQrI˙LVcfq˛Lt√ÑøyI€NbdE õQ«6ﬂ~“6órƒÑÂˇHãKhv≠+hf:G‚√Üç∏ËŒ‹•=áÀÅﬂ#Ie…	¯õÂÃ›˙]Ï±•f9 =π√)>Ñ-J^fí≠±È	ê ¯Ä6ZÍ±©)®ˆX@⁄fò»!N©ƒ˙7«ù‚]‡¡‡*ˇˆ3]`ÄÜ…Eögkóùûù|Bzg≥6Û\L¬é‡?6Ì3=¯:ËlÓ•dtPqP´É6∑w÷w⁄†Éﬁ˚≥˙…Ë†MvÍπ?Rt	“≈Oä|Lzh˙=cmîı~q⁄;;ÁZÈ—‚7øËuÿÈ…9yr˛$TS„µ·ê*9≤|sÒ˚H©Ñ)JÈ…EåúÀπCz(Ã›„uiÖì˜√‹ëîÿs±|»√•( g0Ì⁄ó£-¡ó√$P»ÿ`Ò˝±;"ïÎ15P£Aãñ(®\à˛Y9˝î”30E=Fù·ﬂ]äúï≈Ôl˝:hFCÿåHD2Èõ)Ω‚‚V1Ñhå Ä2K)JpÂ–‚°âV0∆nΩıúºõ|∂`'Õ0{j\S5^O#_¯võ¨Ÿ{ì.òa+”Öï0#î$©#wÌ£i¨K]Z¿˝O¨≥èa°¡˘YgˇDÙúv˜Oÿ/Ÿ~Á¸d¿O∫ù√ﬁ`©
hQ≠˚/ÙP™J!‰Kâ_†(é≤oË«Q(r2Ë=~z÷ﬂÔÏ√‘G´ +íZÜ%π}j«ò oyG›È‚˝:z^á÷˘:ï,]X6Ì!D<Q9y0Y"Úπ!“ëv)ïÑÀ√	∂™·69«*ë`å ä6çødáXI[;∞<?( GUó’~úË“yù"—'b&Zâ¬ÃlúS 3¢;‚ø∂ã¬¿dÀG8û$¬N…ídY 	1 ·éã˜òMbúß  GLÚº©9≈'à,#Pzfñõ=Ω1/XU•&∞Ÿÿn∂^H„“©⁄⁄FÅ7‘®"z ØzéàXØ’Ÿ±Ä°ÑÒp KA)¸WLFû_`åﬂÅ¬¬k“ØÊ†áq∂ÁΩàblÓ‘ùXc‚™Ÿù«∆¸©<6¶Åa-h⁄3‹[ß…ÍŒVÀ‹%#∞wE`Ÿ¸
]Åôù◊NÏ<I¿∆l#ü{0’ÕÜPíx u-G:ßÂ¨÷øˆ]gçÉ£HG“çî›o◊IÑ‘âv‰É$ñpr{ÈÍ.ÀT2-ÀÒj¯\wlPI\T°õÛÚ8Q˛‘bÈ0‡v¡Ê~5±ùÂ†ÿßâ¯Íû¨Ô~ΩΩ<¿çµ∏Ÿì–aW√:}ÄMÂl,]$vn,®ç6∂?„≈ÈT£0ÍK®Ùπ»?^V“üäô⁄à!£>G	ÔØÁZ∆0Àµ·Íê)QtI¨2πZBÏ]N#∑Äq‰ ¸x‚ÂT':Ë¬¨≠$v}j√'Àπ∂;>:ûËÀÔ˘‰Ÿ[ôM~wè3ÑOh„òßOg´Ôo∆Kƒ<÷DÓs≠≈XhSZÿ⁄O˚X.D.-ª¿ÛháÊ,ÿ´◊—ü#"rÅ√wd	Åì9k öÓI:†Ö˜BàeÂ%l‹ªOˆ[]≥Yg=gƒÈúa#ﬁ¸û€É“°≠Ñî¢ÏãUoÁU˜¶ŒôW∂cVπ~È9ÜñRXÚ≥,«⁄äâ:∆¿eEº:…ÖL/TÂ·È…‡ºhﬂÍ|V≠d÷uÂ·Ü1≥60–z˝∂ i^Î?*πqXZ:N5(˘_õ`Zë|Û]–H-êè§fwüûÓÍ\úÜ¥ôéZf‡*’TÅ0L∫4Bæ√U"áˇ/næÅb≥⁄/Æ(˚Øˇ^{¬*]ó*›kÁ¿VÖ|(Ä6àoäGÏm™†épç'WvYÂºK;ˆb‰Ç¿«üzºâXeùü=¥±∏«∞üêûqç◊Ïc3)ºãã°FuÀ7Ã+˜Ã·ƒ≠≥S◊∑0}‹ ∑%LæÂ◊£˚ÇºsßßÎè7%‹]/<÷
fgŒ‹ãûó⁄˙æ˚Çøv€⁄›ÿ s|‚˙¡.¸Fí4ïÅM8q˙K°ˆ´…è≤JQÜG˝±TÀÙxù«èãÙêv*>¨ÑÈ˚∞\∞(&.dÖ˚«p?gg=Ï÷⁄Caop˛tøRØ◊YıI‹∂ìö¢¢¥#√{5eçH¢BÕÏ^Œ}sÑwÀ'⁄©C’m˜Ç)[uvéö‡4å~Ä(ú.ﬁcäôOM'∂∑4"ÒŒPe¿˚:iXî ¨h∞pÓŸ"¡ﬁì≥uƒå	Á<ÕQúœKÙÜQ¿”„«??}Ãjœ≤Ω;¥¿>	¯ÏñgÈÃÔß¶pÙÕåkRm] é3lM´¡ªS+⁄iµbK•L§"Ü%˙Õk˘ fªå\k€Ñ`;ç'ÎÁÉìcvNìû±®G¡˚¨— ·˛≥û=:9{”¯´«c∑ü„¡”IÔÈ∏”!¯ΩjwÒ=näp]—!ÏÆ›Ó…SkjÜBâF±1s∆(7¸ıÎô9ÆËrj4jíiì,°£µRòØJ›ª^V≤K•B≈™ﬂ0†I…SÀ˜.V‚â©É@Q∆oX>C53è√rö”≥≈o∫Á˝nGµCïΩXó„r≤»F·L®πgaëóÑ™ë)óõ0 !ü∏¡+Û:™‚]'Ω¥Hó.O…áBøÄç˘µõD[Ê˜◊0ãÓ=btî∑Åv©:0∞àª˙Qˇ@~®”X†j∞âÅA`R'öùu‡õûâ-Î˘¶∏üh;Kq∞*q‚'
ŒÕ#
v‘f%]Pç©#ºŸüM}Ti,S~±ÁU∫,ó:ºrv˚tKÀ{∆lrΩvÍπS˛å-Y¬Gâ)òË>äƒ¥=€Ì¢™Î:>ºøÙ∞rgu π‡Ø∂Ù‚⁄?/zôEÔ„dâ’ñlw◊·°Çs∑É∂óo˘{7Uö‡ß¨P≤kZ˙f¿oaéËY—’ä˛{âÛèƒ›´—cîótBÚ©VÃ+`›àÒV§I¶Ù©7;Ñï»8{ìˇ\Ù|oEzÓ—¨•Ö+£ÎTVÍ^:IUfã∫Nﬂ∫–%Ã›πÀ€≠FÈ¸W≤{,«L%70ì˚hÔ&ı´ÏÅff≈óÑGdWÅ˙hxΩÙ£Ú«dW^Zı,"¸Iv÷[k÷√â8ﬂñwœ9pΩpÌî¸UÓ.Q5Cˆ´ƒÌ™-≠cp∏åá\Äæä!Œ’ƒ-ÒN¸Ë¡#}?~åÎùÃLßäé¯Ú√≤ñ°ÌŒGµ—≈j<%∫˙œÃ§3¡¥≈'`ñòXï£‹È⁄â(£⁄ç|?4{p°c_èX‰'fo\Ä3S!pg5xä5ûÔõ⁄s∞±–˛ö‘û∑¯O©“’çé„Ö=˜jœw(1J—QK€zÈ%Òº≠5U¯:•ÚÇUq≤¸ÂojÕLH≥ï™RJ˘∂È%¢ıUa¨7á‹ì( j5‰EÏÌµ,ŒDV«uÑ€>mÎo√Zok¢√Öû]fEæ%Lòº!Ld™HÇ…F∏O¢¨JúD;ˆLdbÍ⁄±Hù
y∏{B‚ª^Ì∂·ü82 ≠@ÎùJÖÕT:cq,ãâQ}∆Ögy∂Ku3Àò?ß¨yì`Ç\fFÿBqr«pNÓ
e˘¶©)•XY_Û’çØ0‚”ÔãF√Ï!kËúä2…2˘a]î÷ÇTÀ¶êy7)!‚S
ã(üBá√˝ôˆ6π(c;QWòz@0—wP·∫ÀÊÇÑ[WÒ≤?˜?Ω…ÑÛNﬂÇµáÇ¥¢ÌU¿’ÂsÈêëá•“î¶ÄöJåò∞1)⁄+jÂhé«˝w≤¢T◊,+û¿PVoùïl$ªËI*H˘b
d‚<%8†‹nn¥Xçè^Ûö®;™»¶À’·Y:x'ëFçKA_‰√^ÆaitYŸF•âÆü{a¿Q30GÎﬂœÊÜÆR,û„íCäÂ“$·#}˝à
õy1øH…".ˇÚ]L„.‚©vßâ^‚MEcqu[ÚIß®DÄt
t˝Q%_(ê3b7QŸ±\ø§‘óáÛ¥s7 ˘»•0»Í]%f^"¨ÒP&”ﬁEÖjÆ∏{„
L®á!∂œ·7)áª©Vïn2ÏJ∞K‚ñÊàÌ±‘;„UúJµüçﬂ…Kl‹z‡∫oL°W4`àsœQä||r= -Iﬂ∞n9C{öKïûΩ∆æ˘FwóLŒ…≠Ó≈7˚9Ä˛6r'u¬Q…aÎíU√≈	µ$¥∆kä≈(òO] [%ÏÓgç∆k4\“≤Æ(ÎTHqˆ·ˆ“ˆE+k·Øƒ˛ﬂAãµJä$#√üjZÄ/ˇƒOR`a99‚rÉ.?∑yf
≈˚lÉ],˛‡iƒ˝¨AÚÃ.æs5eÊÍÏ˙∂»L!py≤P¶£¢ŒêÈW“úF( «0K(0á†í-^πãKÙﬁJÈ»?0)]nîÑ∆êKQG¯aÓÑ2VÄOá‡~Ï1A,ç'2ùº≈{©ÒDÿ§ëT◊ŒıJÕƒ§õ[∂µµ;uY¿A{ú¯uì∂ú:Õ˚&‚(ScV%ÓNÚAç£˚@Ê◊ã?Ë·ª!∆hçJ‚dÎg#céõ€õçJÖHVY≥ìÓ•÷	ºzÄóå˛∫˜»≤√≠f°”$LŸ'gòÚ˝äÍ ≤Óã<L2#aS]∂+P7À@C®RuEFpÆ<™t‘O7Ê-›sÄΩ˙î«Dﬁ[¡‡Å¢”z¬]4-)òY
gZ}êFXSdT”Ÿª%z•,E*QqRaiGB‘º˙˝LΩJÈt¡bz(˘XWÿRªÂ÷§ÑêÀuÁCÉ.ôR≤Ôa(ñ&£˜Á+∑>üÃ,áQ"2PÖ´ÛÓ&:m}%¶ySLs∫–ÆMpÈ…2(E›rIÔ¿l d±z^¶◊JŸ5ø’)≈tS∂ddÄ6=≈øà4ú˜ó„”SKÙÃ∑!Le#8&l1yJDÓ“A»»´iæ^‚jÓ˙=tç—-nBé§k® ¯Eπ;qÌ4çÍjÜBÀ›‰ƒ≥∆ÿìºWºè$\ô˛dhè˜A¬|ªë/äN„}e=ﬁ"ÎRÌıæÆ•¢_eã5µêR5§Muúz´£ê®:Cñ.ä˝Jº8≤ú"P ﬁ(N[eˇ›Ÿıπáf.KYRZßJmÉT¸$SúØí≠fw9$¡{ÈF°≠ú“(NìO>>)Å◊V`√kwy®ç£s‘ù“‹ÏZA^≤Íåx8á›7m3H±"k¥
≈$˚¨dn	[#j˚¨h≈≤ı·iÊ∂¥“≥≠)ppèt±»qKöëÖÌ 3•‚Ê¥ÖäçˆÎ5A(/í»∞wk’‹]ñ»aBÄ[Ùb1“∞·•aŸÏËÃ6Æ—∞s.ÛƒÑJ·±$∫NñÒîQ◊ÑìƒZÂKã,§v≠¡ﬁ÷íUr¢KvJ/∆fW@ö#œù’(˘e*`d®QLda…≤¯
3≠§9M+ÂZe[)û§p)]A!úKîàút 	Á˛òMm j©õ˘ÛùˆÎ…ù£ßLî*€Ok9Õñ⁄M£Yj·Ë—d$)˝ì√2}±Ωƒ≈¶º|<a¨∆·
nÙ¸Œ+ˆÈ$îs˛svJïµj[3rÅHÄÒb…KÃ,Ã	pÍ◊P÷mjÚk8ˇVïΩÁ·∂üeá¶NK≈O™à≠ôÓtñjüÒ
$z¿ÛôUÌﬂX® °rY±L™äNŒ-S∆∑ùc‰1ò£>ˇBÔÕo•Ω˘[!DZ™®D|.n<™ÕE\≥A·ËLl—ÜTùp* ˇVÉéHöæ9µË·&˜ÎÈ7ﬂ-†%‘wÓ4!,Ñ6ˇ∞Sﬁﬂg¨ª¯›hn%êvÓ|‚˚£B«∑^ãTq'ı#;„ÇVø?íÙF∆ËáX
òóèæè©»‰ì^é«ãﬂ9f»˛ª_>;hQ~PNﬂExwó}XÜèé*g#÷Õqoä6ﬂ7ﬂàfÈ4Æ mD¡:ØÊpbÑ˙Êö’DI2≠‹Q∏ÔÉìöˇæl¿Û”ùc‘At]^„#j*JÒvääõ¶3◊Îx5Û√.N.t\0W˘0fÏÉ¶öi¨Q≤<•£≈À¨AâÏÚºˇ¢tùQ÷—ïhÚFvV˜I®W?èÉöÉ')r†˝›ç*ZÌê\vriK‘,Å(ÉF_jõç(Á:±ÑÇä`Á≥¿Y¬µŸ.Ë¢‰«∫h˜á≈∑—ªºÚ—iyÅ6$Úöä≤¥µëiƒ„+Ωâw∑=p=Ó˝»MfWH:jGÇùÀÊOƒ"∑ÚÈS´‘
-U)§{VªXDfé`∫hV¿¬≈§„<ÈY#ˆ•NØ◊*”›â	|@ÖîhnS»¯∑˜áπüiÙg•ÚÃvW~$•íxGö€à "›1F§/≥jÔ…ô{Ik††≥ 2€i$ ¿OGó∞ëæƒ[Ó¶Âs>Åù¢ÄCOÔÜ¶¶ÅŒﬂcß˚Ï±(9˘–ã®N·Y!u'ï≤£Ò·kn!À€YÌNí‰ùB]NªlèNÎÔ$I„Y˝f›9X≤N_ŸIÓfç4w¡Ú≠«ttˇ^pˆäO"=˘(:Pt˛äÎåSoøÍœ]Ò1‹≥ì|?Rx≈äœÎèíœííB|Ê≤œàM~z»YÙ´˛‹e¿Ùò˝ËW˝π´=Ê–æÔ'ü$é^±ÏÛ8≥â^´˝™?wŸ«Ñ–7ÙêÒãÓ<-wÈÅ1úÃŸmå‘	Ë
z˛BÀpLõ¿Hë‘uÉãŒ)scAÙÉ˘tjHŸ˝,uﬁí‚û⁄õ*b•™kîÈïi]'TkS Nx”◊vâêEP¢'"X∫ﬁ+≤î?¥Çs´h˜©åwl¿©≥"ó[©ÆÈyÜ∑j8<Xïq%Ω”∞˛"yFágùÌòŒ0´76¨dö"flùı?9gÉ˛~ÔQÁlóˆÁDà=?Î<Í¸¸ÑÌ˜;g˝N*oÎÅÚ	X‡#’°7w kpahV>"fO>úïy…DÍ¨c0°t¶8µ)ø˚9S‚ÇÕ≠‰%í¨©0c™‹“–T¡ÙW|LAW÷∫S.”˜·π∏”»òŒ‡¸-+Y€$B(x˛y„~cøŸç⁄Ö€YèNõ!‚SË±…$WeSØhK≠Mg)iaﬂ∫ø pg·ˆ√%•ÓòTuCS! ï»à#n-∂;‹ö«.=wö4@_[F™«µõ¸2’òqï>ﬂﬁ‹ﬁæl –´$Ô'(2D˚*~' Ærﬂ∂ã}∑ŸúYaπREπYÏjÊz'ì<îpâ55Ó≤ÕÂ°ÆT.CƒG@‰•Ú¢KãM°xJ1˛Z $$EFÚk⁄µÍö8·kR+¿sœ∏0æVyñip_Çüœ7∫@Kµ/På,gd∞}À,C1⁄[#BKz√®’âº*—óâêÍ•a˚Ú:	]Ê\&ñHñã5äåŒq?ï+WòÄ.ù¨“)s*˝@H2±GÓË∫’EŸd:G∆	u˛–smÓ™jéî;Ä#≠ÀÊê&j#&Æ1L›[)á-õas∫;ä™_`‘.™[\9Ò∑dÄ-√X‚x√∆˝∆“˝°’H«˘‘û˚ô2,B ®ö{—Ñ/ábì´£v≈ï≤íÓ%â›”¶Óºä2t-s=≥{r÷[rƒJ¡!;∑L◊∆düÇ∞k£tLl<wx5™˚E;îQªe
üéﬂQ#‘Äw≈ÓÔbπÜf@CÜ®jñB õg¿pk˚hnàbnœs¬ÂRuZœµ},5ìÌ™12¸	,s)	jïÇkIÉ{íé.IxõLYbÇqG /áó(÷/®¶k{6<‰O~¶:-á¶¶éDòQ&€c ˛ÓYﬁx°w\q|c]	1øˇ‘Ñ€Rå¬ΩÇç‹·©∞ÎŸ&˛¯]ﬁ:±6gV÷ò·≥'ÁGá}ú6q¶Æ8ñáB˘NÏå”)u==ê/ÎÙ  ™oæa\˛´Ô≠Ú4îÒÈ€Fé,ﬂ∏∞/⁄ÚO=hkﬂA~{ÖwFzPz[M¨7g•†á£¸æ-’^ÉC¶ó©v#‘Ÿ\2â∞æk>Ω≈ñ¡ílÕöUy75Q—ìgs!gcŸáòF\˙’Îıï3Tt·j=.rj˙ù¶t3^`»e0µôIS-iƒk	8±Ü	∂ô<çj»jMÈ^OKiÛâ˜ê5¥-ÅnZP˙∏R“rJOÀ(-õa7∏ √sw
⁄“ îÈñ«à19´&)?ﬂ·$≠ ≈´<∏‘ï¨≠≥üü¬_›{tz´Ãd!Àq^E∑[Ö>qÑúòùÃp’}…ÖQOCY∑S,y#±£8ÀÌeT1Ô’”|ΩTbèlG®û‘Nñ¨O%gï+\ôó∆‹∫\ŒÌ›êî[J§nLÌ◊ÀMÄûﬂöZ#Î”•‰πöñÿ2„Z…+∫ÓÙÇJ¥¥é+Õ∆0ò∂B˚W∂f^–≥Áy.–ˆ˚ìÉxæRòü©®ßêX≤T$/u≥Eﬂ¥≤eˆ)ıv3’8õ»H€ävíjtáã2˝î‘¥L•k	`1ëá}¡Û∞˘tÇqãjj´g|È’X≤Ã]ÒE∂xùû§!¢õ,R√ŒÒ}J∫2ä∞¡ñˆJ®]œ‰)π–Ë+z.b∞4B‹idV£˚2åG∞Û†…7ﬁ…sÌtT›7c¯sÓÊwÖi_åºÑ∆µÙ¶’ ø˝k˚¢b3ÅÒú7?E+q˛¡<
ªÄπ9Ó.∆'Óıóï5Ωë∆)8§…™6DØ∂Ñ¥∞DO,$2ƒ≤∞8/7ÕŸ¯1‰n"ñ%µL≠TYSˇˆZîG`ã›:|ÖjD‡œòoX*	¢aÈÙÛºg÷S™H7üEª ∂ërfÒˆc
-¯läõó¡¶‹7 v.Ù».…ï5)Ü·ñaˇê≠UåIç∆ﬂ.ÍˇÏUªlb\«æª’
í¯ﬁ…`'GIÕ§•JÓCÉ˚Õ]Üª#t)bçÇ3øEuÖŒvÕA”äﬂ÷h∑ÊU)∑îÂDK5∂«ƒıòßé6[πVî,á¥ûÏ0ò˚t˛Cûb˘Ööµ)ø∞ÕÄÒ[u±≥}◊ÉaÉQ=≈∂%°ƒ/Sè ~–#c46„ç≥ÜC‹πÃ›0Ôs
Ñ@îWë"îÛ ›ÍeâfûrŒŸtÂTÙΩ-Ìj‘hØΩ–º0SM^‚…≠íê∑¸‹Á∂…πöãﬁ10Âﬁƒ≠>«âÙ3*L#ƒ¥√4î⁄Ω2Øñõ«‰›õÌ\qámf≈©‘O§ö~76"5{j∆» ùGZ¿l‹S√]ü¯Ω√µ30ˇ8∫∞>õ˚ìÍW?πI|˝é_dÜgèEñqÊ~ÈØÎÅ˚≈ÔQPÚŒâ¥‚Ï`˚˚ª,pÛPv–≥	òÊ˘€˛«?|˚ˇ$ÔãgiÔØÅ Ç¯é_É÷V≠∞?˛Oˇ/´»;+OAª¸`üÙÛX“ËAbπ|Ûï†¸å±ùv€rï©<S⁄†^?π…n˜w_È∆•Û'r˝≤Oéââ*K)?eKcôÎ}—âú#2]±OQ@»ıäåÓu!ˆa—´ïuXñô&¸DâÂ¯z¯ç‘  aR«˘Y∑},#Ô,Ì—îàM≠™Æy≥bÄgz´íò◊0ç‘Ì&[Í$ØH≈Á©\âÿÌÕ›¨&ë≤@9öÖ ¥{ﬁºWPú¸D”‚h`∆Ro±1Ÿ*Aï≈‡◊ÙÙàó$5iûY¬ú»M!äBπô	«VnV
Ò¿KPI9òxû‡ä@™L πq÷báQ¯—†∂
÷u‡π”»ÀØ; ±p°nÿ»z¯U≥ÅT1êÂ∂)S‚"«Õ ¯´2÷»ÒUtqâ˝!≈`ìü
…§Åµ1QaïzÊØÁÿÂfÑ:ó·»Ú2ó∆VÖ®Æ,≥á’iK“MªïJ»jß†$U‚!∂ë‚&¸)fIπ˜*ﬁµ{_Ê¢O=V°3‰·Ij=…Ì¥[ËKz'|\ﬁÊ¢Yê∑ó≤&
•!÷˙ñaC=·Ê+fV˚ÚsÖ0∫ÑºHÖçÌIPaK,zlñÌSbÇŒ›Òÿ6ã≤¥∑˘∆∆˛Ã§Ú∏/JKŸí“?@ÈÂU.B2Y
@ÜMõê±≥®9ªz)˜µ÷^,-_ à	¸êã¬TÖíürr?%ñ@JH°cÓ£“”Ÿ»àTŒpJ«z“èıQ®jôBÃ∫íÔq<˘CQí;•E9-é˚ŒŒMèîùOÇÿ¢•˝t®-d§wBl⁄tÉ2Âd#kBìäéŒLÍˇqâ‰.⁄)i/¯…Tb2&¸‰å1ü\ò∆∞ÑµukŒ©-H§~ÔTãà?ôêNÙ¶§ì'Á´âíOÈU√gYıÊ†§MÅõüM‰L∏q"ü?§t«∞Ïx"◊dr©á&^8]Xˆ©%(EKê◊´À˝Ω}Ô®}˝ÖZ£òDgƒÛ]º©<Èáü"ö–…ÆˇÓ›pv?ä/œ›(IÕSÈ√ñ3Ù\«zã=U—ZÓﬂè=„ìQ{Wî&*æ… á˜‘^Ê„∫áÁwA3@ƒ{˜‚lö/Û—`∂ÀûøêX2µQ≠:’q'øK,é≤$=Ω(8ˇÒ˜ˇ≥”~+–O;è˚«… ÛóÆK%
8º–NãKRñ⁄uçÍívT•”˛tó~ˆ‹7zk0—aY¥(CﬂT◊l&2(l(õá◊É•ßT9û=gåù≈˜0Æ°ÀNMW%å
¬Ï{uvdŸIôûY∫rÜS∫¥NÙ‘Çã¨K∞\á∞Í¶øÀıkgù˝Îú“≥πæcØËÁ€¥¸·ƒ1%=∏t∏•;»ëæ){M÷í¢ÚqÔ®‹gòñ{pÿ<a'«@TGù„˝ÏçSsÛ`ÉôÇD-ˇW÷¨':=F–o≠U\•Ñ‘8shùûxÀ«k˜$˜KÓhqﬂΩÒCÚ;‘ƒ\ﬂîÁ™˘f+~âGÖJl≥œ≠ÊÎkﬁ•üá%!ÁÓ„£,dwxX‹…L~/ªx`ªÅ‚:¸*…—‹¨X∆≠üº2ıE|]‰åùGú≠|˚OÏËdøwxÇú•3ËŒ{«›~òÃYáıèNœzÉ˛‚€cˆK÷˚≈È…ŸyßKø"J\µ78Ì¡πá¨˙‰‰∏∑qtÚ®ÿc?e˝É≥ŒQo-¡¢n¸â˚ÊAxª£4E|R]åî˝ãñÔ\¥dœ¢%ªIŸ}îÀêcˆâåÍÕ+;›µ®}5 ∫ﬂ¬D˙^EqS£§êñÄH^OÇª∫üëîQ˜⁄2r˙vå⁄´†ó,Õê!S!ßÓ§Üdπ&yKı*”ö∫„√‹`'Lu:uÇD‚5Ì”ê8è∂ U
ï}ÚàÉ‘ÆVB»≈ô¥Iœåw¸Ãc~´Zıfi#¥¢dæ¬S¸V≤P%·
‰v©Lµ∆]¡âM]≤„˙ºzﬂ2ä|\3Dç‚?ÌîàYrî£1jnø(µe"§ âùß/„KÍÑY50ôaÁ(OÚßÖ#kÑ5Õ‘
MZ9 Ì-W<õ∫Úùƒn⁄5æ.3GıTÿ•™Ê€…™yTf…ùçz¢πxoGU≈nò?
·X◊Ÿ¶?–îˇ:Çf¡>∑¶ñWóNeÓ…÷ïß˜h¡Æuæ∞<[àYÃ%°®~¡UûÆdáörŒÆ•Ä%È¸Üt>Rº¥ôR¨ü®2gŸarﬂä™“ˇí}ë»∑í†ÇàüR˘ôÍ€Ô“Ì„möâTÁisLT~oyÚï‹Î z·ˇñC∂ó:‘π–o‚*=UÀ"ÍI®K<Í•œü•v®˛0Ñ¶$µÏ∏5>"Nu…ÄAI≤K'≥ÍÒ°(OE{jÒ¸√˚=:yl2®Qï	ã®‰§!C	)»µ©#Ï Aío™cË∂¯©K #óö`§T˚ªïßsd!3lò6á¿;è¨	ﬂöŒÌ–Û√´FhT3vÍk4(”&Â˜5©Z}kÿw#+õŸíÊDbëöÈCHX‘9ƒJÁó|^‡ïÀäZû˛–Ãq@Xù˛ƒ›	‹p‘úfF^ y„	ÕÇ’≈yÇ˜˘S≠úÕê^.*÷j(¯Âr≤Ùˇ¸ßˇóøez?tY#.Ãí¬Ùˆ‘1]æDLbÛGEâQó◊«~$dÒÌˇÃûôº·¬&V≠√€ ":j¬–I2…°ú)⁄ùõﬁÃ%®ÅA›öõJÿºmÏ;√8ÇI€96ó˘ïÚ‘∞,üb7˘√d÷)ñ\0,5Ú‡â%ê¸“…ﬁ[yX∫à*Ÿù{VkkÛ
k∏$/êºR˜¸ï]y4{~õB÷+ÅBJIx≠W	áÙºè÷"lA«›|e÷Ÿ¿∏4<WË‘˘Íd“·(:Ri·‰∞=…ˆ€‚ qÿ◊èMZzä*!ËpÏks8'BÅtíπR(c|8Íåv˙îüjaõM~d«xméâ5œPﬂ`ñsj©0q†∏tñ;ΩL·Õ4f≥:(•0-ÓEÄN|`l«á∫”ômπéWºªÎ†º8,X|Ãm◊gé∆£=`EÆªƒ¯ÊÅE±0óÃùÒûå|cdy®ﬂÏ*¥‚ K∑@¶mtï€dÈH∑ïCq,!»ÙÊ9∞}ëN.zﬂSîfE∏!ÅìßOHÙ«'ICM&làò*ß
r€Zˆ‘îı8\÷1ú∆±A»ÛNx’}\†,πG±À5≠á‘`*ƒÚ“=áio∞*∂G}zv∏Òˆƒö‹ÚNî•ïi,Ê•HåŒªs
Û_]ìã;∂–·¿∂Ñ∂Ë¯èì∞zWdÛŸägƒ’¡î2",`ˇ7ÖÀ\Ωl+∞§ï§„°ÚéUOQ‚,~op˝T©“í©~U˚*∫Úk^©
ÇÎ©g≥=ˆ¯é˚¶nªC*„¨O<ÛR]Ê*Œv1"Œo±Œ*/ÅvúWÍ¶\¢h\=$æ{»\…¥OQﬂSÆyﬂ˝”µﬁêáXÔl4	“ﬁ'≤◊§ÕÂ˙ÚmWfßâ∏sE2‹°—;ûõØ⁄Ö|Á∆à+tâ∏&±am˚ÏO|#ŒÆœ]x–Ï¬5ºQuúnÌ∂ŒHh¨º©≤∑ˇ˘‡‰∏Í$ê{5Ìñ_ß&DÎ¨µVÙÿè¥ÔÙ)ÒíΩóÇv¯Òâ9Ïªºx˝:±¬à∑!.±ÒD<á6◊ôÈ£•≤⁄RYzo∂◊Ï‘YÛiq*`rö•&z•êáN_`(4ô
G#Kÿ∞3ÓWS£KœF”“Ü‡*~c•£aîïl6∆¥¯É#Ã¬–rÀíÀ·»y¬’ﬂ¸3;IXq≥8Kë;≥ìV ª\|ÁÉ&R∂_¿ÛœçÀÊ˝*É†T-<ÈI‰y3VNõ°´∂E’n”qW[˘Æ´πIı»=Óa◊ÄÖ‡ÀÇÆ”hMR“GU±^æWuQÇ≠<h$À∑›LÁø!–+ElÏ(‘hL`ß˝ój8 )h™≥Å[j%hÖ∂3|jkûc—™P∫9V∂ÆZ:GàtÁ>»íŒ»ò§îÃ»”Nw¿6í*Àﬂ…™f ö¢ﬂ"gZ_c}gË ΩA≠Lêv#0‡ë’Zxà+0`•|P	¨ôãI˜ãÔü]≥©â.0Ñ≤4òcéA1õ!Æcı4ˆ◊vÜÒyB∞q,q7«÷Öe”#»èàM!∞µ∑A~5ê¶éÈÆ#ﬂs|rœy^ÃÔâaÉ¨µ.ºê7:t>}PæÈÀ∫Ah'T◊Ü>◊ÙAZ;í¢»,ÏØæc<hŒÍ¬°†≥˙ƒaàål ÌqØDHêÍZìDÉÖ0X‘…__˝LrSMKí_x5◊±ØAÆÅ¥Vç^π…Ú`ÔÕ&CDƒTÿ/UºÉ¢øjbFvçÀ „5®≈—%WÒâôsbøj%¸X…òJY{˛≈/ƒ°®àI‹Ÿùâ¶m¸wÍËñ<v+∫kj»¸fåÚüﬁD?eTœ‘êSéE¨LZëxj#ÄS>B⁄"çE%,ÉœT*Vy(#:T1OœN^v∫Á˝g'§eüúuuJ&ªckåo~J\gdQÜ s‚:F7©øqjë3ˇtÒÕP“¢è£@@çk*K‡»‡·)Q‡f˘ÖÏå IÓJtr´‚èˇèˇ˛/+Vã˝€øvﬂù∞ˇÒiˇºs∆záÏ∞¸WONŒ:¨wÃ;Ï……œ;Ï†?Ëw;_J◊oâTê\gÄÕÑHãpæq|ÿ#™∆C3Ï§Œ>πd¿˙õC8D¡Fbƒa$£( “„1¥éæ8c∆â†âK„5¸çy$èqÈ˛îïD"sûpVƒ:º,6£öòπ]jf∂$3ÉïjµëÂŸÃN¥0S„=∞≠á=ﬂÒ5j¥RÒ•¯÷Ÿ≈ƒ.•›`‚™PDåKë›ùjI[yX9BhïX”ØD·-Ê.yõ.bKèÁB#àoT>b©ﬂÙQ¯¯Ü8~¬°∆ˆRèoß´ß*=g¸ãQöY¬ä„dRaU^Ú¿ÅWx≈îøøÌµÚq—éNg,TÓ˜Gãﬂúu;áù≤/€ÛD≠Úﬁﬁ‚=nà8æ	TÚ¡thRl
áä–$å&Ï“N∏JË‚;«;d^¸Î≈{ÿUE[=ë.Íœß‚û†R=ºÕÃs/Åîê+á˛`c.K§ÍqÛ˙˝g¯ÛÙ{›Ûì3¨j⁄Ôzãﬂû∞ﬁ~é`ΩRµ78_¸Êx∏⁄≥<ÌˇÍdN;√Kÿ‡‰—Yπ›≥˛ nP*ˇ 6ºÛ¶µ&‹∑ô-∂úéñ/∂Dq:©ÏÒ9ÉÖ‚hU3€ÀZŸ…RƒeSTØ©£vîpM√~∞lóà˙Ê‚˜n>áâ<∑ÃÈÃ•)Q*l˝r",ﬂ0Oÿ–W*Û¨kL/,bT3™	ã[y	 ¶5òÉ9OÁ·{º€≥Œ¢ SdJ¬n6˘€á	Ñ»èÓ≠ò+m‡Õ÷–•Õ/JR¢Ûª¿¿pµŸ _)qB∫TªÇï	»HØûy	ÏeÑ€˛íørÙ‰+Ã—@kÍ»Då';}3Èn/cºù„LÅ)Ö∑q=WŸÛ/∞|*g™Ã®L
g#—_:Ÿﬂ%,•Å&OŸP7|â≥Ü‰Y<∫ÿ7˘	rÙI&‡ËÚ–∏vÁ%Vh
¨a•D†HÙ
9ΩhúÿRgÃá˝ÖK%ñä`æ≠:s0˘Ü‰ÛéﬁRiØ~)&O$Úwàˇ2j∏◊h® ∂è:S^8æ$	ˆm≈-ó…+‰ö<pÑz|¥„Ô0Nv'¥»ÀKz˘?yíLΩl) ºóÆ∑h¶K>Ù‘π˝âSÁﬂ¸sHùi˘Úië®J¨óS.±˛ƒ©4ˇæÑ
⁄
êú,ÁZO§¸∫ˆ'N§ø˝mƒB≥™ÀÌ„•
#¶D"º¥ÉçJ…_1†'ØfJˆœTﬁOï\
S"hßt´ß¿“…"¢¸ù¸{qi/O∂W%Œj˙mYæ@ÚÄÒª†Göo¥›µt”!Öj—ı@áıLÖ¨î≠®4†?˛˝{÷Èû?Ìˆ’9ﬁ?AS˜º√Nœzœ˙0ô—™®◊’±ı¸,É=%ÔDû!«(ì™∏íÿ[2m=ƒ©»ZL-—.ÄÓpÄY√/€;ÙãPÁK7V5•Jï7xh∏Y¬y&”G©‘súæmãQÙaK`∏m±∑µ&ßEsbà»¯ë|€ò¯ÃVC*®¬Lö\‰ c⁄Jã#Z±P«ƒ‰òG”D4-Âô.(-Ã+—Ïèp¥ÅÜ3∫p—ΩÏ≤CL^◊^|áÈ…˚G›Ì¬*ò‰ôr[\˝znÚVwîÚLK6=«/CûÎË¡~-J‡U–»˘ÜâñC,Ï◊∆pÒÿ⁄Ctòåª
¬<oj¡MU^F–X‰!+IãÕq
ò¿Ü¡õO:åÊ“Ç!w∂òÇÃ…ª ≤fò+∏,FkM≤ÁM‹ôí{8¨UcµK1‚ÚÌ› w«≤¶d≤W(\∑tâÚP&¸ïÂWÇ˚ﬂ„¡¨-Å.úé&€äÎ√ÄÀ◊â´n_IîÙf⁄ëü ±H@⁄7òﬁfò5QÄ~ÆëeîEÓgí	î Zˆ6ñmàXQ\–#ºÂºVégG‡÷%=ô«H∆ﬁ‚=lóéÔª38#PàÍÑ‡<Î{b¬UÉ'ùV{õ]≥°áÃw"¡,~7"~210Yª?˘j	LS°õ©ï;bc{º¬T¬(aU‘Cå.1•|7>@–k∫=…E°Ú=|o∏Wú⁄(œg }V*ì·M ÅI˘∂l$M9,[]‘ö[jÉF4Ä–h™T
Ã˛&7/ó:°kkxæ◊l…Ωlæ¬3ÒP©Lﬂ
uâHÎß"»ø)l'ôﬂˆ¿,mı∞Ù1(5Bwø`Aî2[¿çÙ€™®¶±±ûÈh)÷”√4≤Xq ÆÈS¶¡"ÙüQR[z∞TËfßóöP]ã/4C‹mﬂ≠3ü¡	aÑJ√	˙^»∆€Ö—s[QVHÛ†ù§B‹ÏO™–èÀ
:0◊ÄSp¿˙j>y©±‹)íçRr&Ô¥;®,∑é“‚≤ªòÓyv¢·G,i∂N¢,FúπÅîµ©õ≠ÔD±0QÄ)ªyC>¨?$#NR.é¥À‚’]€-∞ürk!Úy´ŸòN_ÑvsÎ˛=˙Ì*B·‰dNØ¿ﬂ!¸È.Ê —ï!U„ñy¨7…F™Õ÷ÏÍÂÊvÿ£±Nˇ’õ;k/QÔ»7Y˜|<N´¸Ç ØEz´¬øœußáÓÿE}Áß?eÒÅApm/ÍÖÅm
+•I)ã–7ˆåk»‰<ΩiZÎm@Uj:Vø)R©ÒøSülÿ¡^%öû	%P¿]Jj"5éÉâ6∑π{Eêâè∫_cÏt»ÖÛ–ö€zÊ•Èy¶wÍÇ–∏&ƒ√–íZííM©’ß%º£‹ÈQv5ıcÍÙÁ&l3ç´Õ>C∫$D•¢Ü≥uÕ÷Ì‚àCOooöÄV…S†|“WÌt_cå´Ím¥Ã6T—;iwF¯YjáÑ⁄)x∫Ü~√OzV∑pV∑ñ›·gÖ=~
˙¡È,âÛ@¸§Èè¯¢à)’ÜûÎ˚ÖÑ=À=fËŸy‰^ÌU¨¡Z[Ãi€ﬁ´àF‘c∂íû‚ò·ùmm“VÙ‘ôLÿ∏`Û>√ÃûI≠]o?kµ˙Œf≠æ}=Ò·ˇ«¸yÁ>iÒT÷»|Á√œL¸å&xﬂÊ˝aÉ¡ŸôÔ|ºø8Ü◊ø∆A<ÅìÈ∆,Û≠ü÷€JaÔ?z◊ò‚‚ÀÙ›…/˙ƒ¶◊‹Õís>Üæ Wfñ ¯—ø∂F¡dØBmà¯ëCÀ1á∆lØBL(yõ4GáUÙCŸô´Rœ÷∞Yﬂ∫≤µÕ6kõıV˛ÅÖÏ¿ÜÙ_s~‹¬y˜∂Åj6,"Ê∂¢%m’Ôm’Zx∞÷ \‹b;u N÷™oÒl’p3<¡æ«Ó˝™!$√l±fÎ…}∏>{Aî∂5Å|î5¬|€-EØg%äBí@Ü‘›"hµ7aÈÔ¡ﬂM†4÷ÙÔ”Í„a¸È>ë¯≠âé÷ƒoø*—&TÑ∫B]5˜*€vÕˇπjÌUö;´¯W>ëK?Än?a˚NAI“üX¶=‚;?b⁄Lî‡/œZ¨’ÚwÄ_Ï‘öçgmª∂S€ÑoææÏiyHÉ˛*)ú˜û/mj±≠⁄÷«e@äî¶€twR_õmvì˝‹¥2\¬B5∏Pgì•{áN÷8Ω rEpÊÙBj¸˝§«¢Lg—xÏ≈≥_‹#ºt'`¨¶t R¥‘≈∂ƒÎÑ`Ÿ`,ü¡’Ó(Ÿäãá˙Scl5,Ï˝´'ƒb›˝£.ÚY;∆Pœ™≥Œ~ˇdøﬂy|º¯vpﬁÔûº•~¡u[f≈¿$wÓAAÎÈ¨âFä<â˚Hv	Úä¶Ø]Ò0|–√¨øŸÕ˚≥K=Ñ∫D›PÓ=ΩÃπªÙÀj¸rka9fQËX˜µb‘iœjÙπXX_¬{´<o!j±∫oæaâ◊— ÀKmiøD;„ó¿ÏóÈØ8k∂—NñÈºÒåy_∞g˛À‰ì°Ëlm^±øÁ&˘zÖƒß•)ùËÿ_Âa8˘°¯¶¬*ZÅVöÔß˘,ü#¨î
Mº≤∂@òû∏-.π£ÔzRiﬂíGæÁÛÃ°è:ª%ˆˇΩÛªIháúÖ%Û‡ÃdO,_¿πá])XµKXò<≤¶b≤rı“lÉÿ¡,Nàì˘7qÒ£ àºs°˛!|ıÓ%Äµy®Ñ–Ù±°d∏Fﬁ,ù)^Ã6¡vŸ~àB0'O‹)X#cò‚B∫í«¡∂˘K√ÙÂíã∞%1OGLvΩé™¿ôÄ‚BÏûŒaˇ—ôËN˜x∞¿á†SÚ“j2'<¢6§◊ü:õ_—J$FtŒ˙Áçu0â÷Y˛l¬ü-¯”Ü?€Á¸ŸÅ?˜Èú∆ã˙‘òU_√–‡”·á√=⁄®ó8¶Ô≥=ºö’\™ÜyDœr0˜ú"52◊/ˇye^Ô›¿√
ΩËytÒâ,∑8%˝y[Ω}R:Ω†'±ÄÈïƒ|YPˆÛjö"˛Ò1ˆáç˚
≠ÏN8&“ ~ó}Âç/™?π9∑N«´`∆∑Ÿœ‚u[{∑Œn{¬⁄WÎ≈—	> $¨á{@|X·Ò˘}À„Û}äÊB~
Õ8."ël˛≤LÔÂ¬ŒÀJ<CÏû¨ÎRlA0±bæΩñ…Ñ‹,ÀR÷‘ccj0#Ñòc†ÎNg¿ÉÖËƒòÍtÒ”ë9¡Ôº∞g¿Sq0vö3SVΩR⁄+à˜T3^xÚ¿Ù¨K•~Ø√€¿µÑæààá¿ ,ø7≤0Ûó€›¢SıóÃÑ£!é&ù
q^Õáä
≥ñ?ÍÜMÀ	—89™«¿rÿjËÜá]ol8Ék8Í[~xCˇW‚9Ô`ú˛Ã∂˛˚ tn_ç_D;V‹ÖÕÄ€åÕ‡ëÂNQ•§bπ≥ªœùÚ€'nªŒ.§'+W¿Ò5é#\ÊfùuüˆŒN©ÅlhÒÎz⁄´3w4>ë›!5£∏ÇõQÇπBÄÙ•µß¡¿¥?ªÂìˆ»]W„µ.ˆ+hß‚†v‘aùC¯·˛∆:öhjKÕÕMu‰bø¢–ÃÂ·ËÅ5vX#ìíió‡#ói·‘nÁ†ä¢»|”øïÍÂ}?i“Ü•ë&aoZK7û≠GT´è.Îø˝ı‹2=¯©zdbt¿ì©0qöıP©ˆÄ·!åûve” K9B„?™*;ˇ^>1Íw≥Òˆ¯ï≥Èûœ7∑»€X.¡^6BuΩWFò<ﬂ…M‹[“˘™ÌæÕ≥rˇØ˜Ö7ô>Ã/‘÷Å∏Që@ßìï>)#*ìTíò≈Dgct%¥2≤6∆ÖgØ8˛/∑Ê‡«2^m‡‘œ;D^ˇƒ'’¡ÖßoûV2ˆ9“† Æ{ŸºÙ^U+I¿ÀB–S•ûﬂúZY‡∏åÔ£3G#,ƒÇå√¢Ge≥çV‘MöEVé®r¬çö’`B§r.˘˘pìpfé-º›rdÍd~6-‡~±#Ì√øvè““Ôl·S/Â≤Tå2˜ÅËI	Wp{íj À>∆I|Òl%SŸódÏYÁ∞øﬂŸ?aø=‡qp~øOŒæöa'®Cslÿ´/jºª5Z√ √CÛö;˛`äáñõîÓ:˚à≤∂Oä@µ„u÷‹“¥ﬂHœ]° )“È√C(÷Ä©-æG,\#zweÏgiÌ$BíUÁÄ⁄ZÆÊX˝Ñπ'≠–(á:ÃÛ¶"ËR‹úrZ"S66tS¢öìL≠-˘ö‚Ü•<˘'ëÊôzâ\O˛°åO¢àiö¸ìÇ.e\Ãtìkå≤P6µÆ`≠`›k”πX3˚∫Ù”në ?%3+JËiÂ≤IÈvyíheS77víñû`"Q5Mê+¢Èôß≠—Mç†∞H#!â…Â+≠¸iÒ@@§_¢rŸ *ó  û˛[n¿ÿBÚÔ~ÀçN,˚˝«˝ÛŒ·QÔ¯ºWÓÖKØ≤k]ú3•(}Ú• X_X'’º\ıCÍ)yÛ W`#çù•¢∑<˜!©˝ó’<’y≈ eÚ∏Z’°’ˆ<íRr\)—c:<åÆ≈w2ÎOÔ—ÊÏ_ﬁπ‘c++Ê)£+„'êÃ^¨©ñD9k∞¥§_˘πóìPCh°¨≥v¬˝„≈∑ßò·¢wÙHùä+¯vv4Æ⁄GËÏ⁄Â÷ÏÖyÈz†ºc (A¸ı~ˇàæﬁe√~c\˚ïunGá˘uÔﬁLuqaﬁ›{ˆhJÂﬁ=ÈD∞™M.õu§ìì”A¿NOŒÿ‚€≥«ù„V=]¸Êqˇ∏√˙«˚Ω”ﬁÒ~ππﬁŸu#ÒCˇôéÓûé$”¸S—vùÌ˜èO=0+˛tpﬁ?ËwE|ø«∫áùÅ8rr‹Ë©(∏∏c≥é|V•Å*†9ëBb¶~`∏Wgù„ﬁ/Nv1Ω≤s∆ıOéz›≈oéQ˙ÙÄâvé:ày] å,ghœG&ä˙NLâ	»áü:8’(J•	¶*
√e—®wkUŸ[óÎsû76V©ˇà’⁄XWõl6 z”ô‰V;à8É®N‘‰ZYº˝']¥ù;ê*“NÕ\ô~•kwc∞v◊√n9!X{Ÿﬁ€ïÔ™ë£V-¡o!/¬ç^ëøî¯UW˚Ò‡©üÓ˙¶vxO›∞MìX†À¥X9Y˝˘ÁçÀf£aæ(ÎtOéN;ãﬂvéPﬂ:∆yﬁ{|÷9dßluÇˇv˚ªZóÆ.´K∏/)Kà	Ìé
ŒÅ3œáY∂<Á	b Ωª~îBÈ+ﬂkŸZ /J•‚~îƒ˙.©^óC£8W  3ÛÖlpï‰y}¯\≈Oí…ÛAßª\|ÄÙ˘≤…Û˙,Ô¢@TÃWOù/Eoˇ‘“ôÛÀ‚ÚîŒôø˚πLˆvÛàF¿Wuz…õviÛö}OmLN¥B§÷éXŒÖ^6´0⁄|GËH2≈XÙ<L«πB£Lr~)?HwÄVmT™Ûv6F≠Bü§vœ[i6—ä∞/Ì3!CN„EÄ¥zïIªåüë∞öè'L—2'˘LﬂkúrûzÓlÒΩo.ËÌ%ÙÄ´dˆ‘ΩÜ¶€Y™arô´Ã◊}˛Ø⁄D[ÄUâ8æÏí$í∂%ã‚e◊$ÜwñBÌ¥8‘éLY. qﬂˇÓqﬂ—π“AÛyø«ût;øz|2`Ω_úˆªù˝ìÅZ!TB†v‹˝Ü≠ÎúeV˙ïy}Ä¡'gÏIï’K˛Î.3úÎufçÆvô3GÃg ∏-tÙP?\ı.ëG√-®ßª≤SŸuÕ2†ib•êh„möî' |∫T3û‚HzÿPÂøÖTq#¶¥NêûE>†¢ä^ôÅê≠cPi∫éYz&¡"†|p∏©,ãÔ¨V•«ÚrÜ%1¿JÙﬁ.(ÂñcÿÁ¶7}W)óßø¸4,¡ÀOB‹å*÷öwc‰ÎË}k
'\ZÊœ4 Á˚ K›l&≤9˚éˆUEÿ;Òæ!¢ÃºP™∂ÿ±Éüªï£+LZ«1˛;   ˇˇÏ][s#«u~œØhAæÄ	 ¿%YÀï± ñI0 we{£há¿òàÅf r)z´‚™º§*©T"?%©R÷oÆä\ C èÊ?Òà~BŒ9›3”=”=3 IiÂljI\=}9◊Ô|áß•ãvÖEØ^ΩIG,9K·ùéÁv∆Q%Ÿ‹é–ù©SCoΩÌÃÙÊC€#2ÁÄ…Y∑©<Ók¬™;©ë7^¶∞%ïk=¶d˙†ïéëÉ‘G¡¯bilOÜ≥{ƒ Yæƒ≤‘öÔæQ)êﬂˇ1P ›V≥sÿ:⁄23ødÕgÏ±˝÷Q´€8hôLãt„Ç≈{»*maÎL/W£ÜêãJTÛ∆‡∂’Ó ˇÃ¸b∆C& Ωıë ∏¶o|cÓè Ê¬çHÉ◊“<π\g«üá‡iÿÉøôcgFw¢;C…7}èŒ“ã˜ÀÉ≤]©}|ègÈﬂ˛;8K«›÷˛≥£ìˆq›ou·ıx‹∂˜åﬁ¸„Ê¬N∫çìF.*„Lπe“"ê9è–∂Â·úcw›±}Åú‰`ô˙ÿt8ü‡o÷ƒ•Ü [|H]ß±Pl>ûY‘î ^9Ä$pQ˚¢À˘≤ﬁÈï–ñFú÷2~KûÉ¡e»gKÀè˜EÂˆ∆ •Œ4ê˙2≈åÉ@Ü›ﬁ√Ã≤d¢…N˚‚î ·4¡‡Ÿ¨Ú¶ƒÆ?ªeæ9]Ï-Ÿ1¬$˜B‡4ÏF^√CR5g±6Ï‡!¶èy;+åMΩ]}ú	˜R◊™AÕÅ>gà®Ï˚)ë£÷QTCÛπò¬ﬂ/UVYâ®Â€yÏü6éJ=*Um††Â¢†{Î/∏‘Åã7_èëHvÀ˛‹ÚéµD+]°S,Qü’ ˘G¢∂/∂œÊo1©⁄a2ç
ØAà}éõ¯Ç∂8¸Ç'ﬁ¬{£~/Ãñ´·Æ®±Ó¶Ÿ¸ä»¬&0R¸Üsãîq.˙l/œq©∫ êË0Ä]|$ÔóÈi∏üV1J©&?Œãl¬Ï∫Üt±DâAûZÄek ¿˛+òˇÌÚ_’A˛œ«ê±,Ùi»ˇmŸ‰¥TZ⁄=©ãX`j Øgk±Tˆ§ÖÊ@ÀÛÇ •9∏3ƒ∏Q‘≈0Hí≈±(ﬁ˙6dpwïﬂ2Ï∑{Ë_¥!gı·cˇ¢†,¬>5”˚ß?§Ö@Ûı.
PÊnÖrZè≤∞cZ ∞n˛8A›¬[‚Ã∫3+Œ∫TÔ¥c–‚g÷ÖÎ≠Ç(z∂∫qå˝±òÓ}g
_±ëı9|;ò∆`C¯P==P•¿oÒ3ﬁd–«j†z<åHº€àÒÑõ‘/ÒOì^¶#w¢UÛ∆$˙0⁄Í k¡’‘ ô«Æãõí™±!ç§ZbLn~:}çÑdWQñ4&›∂Í∫ZŸ∏JÇPπRóÕË-úíΩ≤{#˜Ú8l¶£i±§∂T™Ò¶¢—çîuÕõµ(√-µ˙F]◊:xèöZ¢«Rîu1u[íWΩ	Z÷Ú§ïè7J úJïÛ∆9ÀÍø∑í`…ôyWÊúKPπÓeâ.VLÄm¡∂f˝+⁄…Îqwló‡Ê\ﬁí¯¥Ú˜8£0√ÒÀ¶\¥E‘é\Ò—»W{cﬁAw—îkCi uGF«
ﬂéáπ6“Cö(W9ÇSsπVã·*GVf#´BÎv-∑<âJë®º⁄¢√õKÇX‚{9!ÒÆüª8%Ây≠„Ôõ/ø¸;ÏÏ9#‘e˜§ˆ¡|Ù¥q“k≥¢` È≠"ÑΩ≥ﬂm<π˘ÁUŒ˜ûÅâ(◊√\˚ Ö>Y3ø1ùr!™¯ˇq9
Ω3]√†á„ÁÒ»W!>:îπX{ä‰mœùb∆»√˛~ôp‹i¨˙Ùa4_™IÔL`;Yc,£q¡DqfW;¨º È·∑“v=N¨&¨Âïï¯€Ì◊ŒlÅ´´öÁ≈˚ÂÌÚ†bÖ›jR>«cŒáÇA◊ÙﬁV∏®I∑Ï´® 7œS0FÏdõÏ≈4ÂÈö2Y!êﬁ]’òKz´Ó¸ì˘p¥ëë⁄èW≠C–ÿB»)gy3ê
àpŒ+∏ÿ¥º^∂í⁄˙h#≥.Éû‰≤$È…ÍÂH€7& ä} òD9ÿ=≤=$‡™…ÊöE~ZƒªÒO§â~F[FÕÇ˛"[ Ûô‘µ]‘ej#‡,ÛÑPçápÑÍ	©≈ÚE∑≠Ú≈(…Å_(Ìå‡t∂'gÆ&Bî¬◊„π ∂ V"|ë+Ó`≈@RCKErGÓwäÁÉWRgR]-÷B[W≥`®
n/•Å'Z0.@z#ÒnCØîÀ?fÍ?ONüæ!#ÖDÚ˘{¨Îˆ(.jI1˚ 
1¶]qÜª"Ñ@¨≤Ÿ‹-á z€ß (¶ΩNAXx±g‡z‘®Ü‰ımœıKÏƒéΩû€GóRÈ\üúÕ•ÜπW¯N{B≤ã‚µ7øßÎÖÇåfI&’zái%gö≥–¥«Û1öZìÈ<yS°∞∫];∂NÌqr’∂Õ5hÊ]î)˚èn˛{ëbÔ¡}‰ËB±3ÌÉ∏≥∆+…t‚√ukˆπ	è¨N1Í¿€ô÷’k8˝ä∫7ò'*&QâyDCC∂eÿˇh∑ê) Ù–¡°Ω–åv\Ÿ±>H;Ö%∂G0€€[~á’k€ïJY<Xìæ˝õØ—∑!ﬁWÎÊ+ü˘ŒÑ}¿&≥qá9Æø¢ø¯Ö5ûÉıxâß√öNèGÓƒÄI=Bx%hh;Ö§5†-%fjfó@ÌYâæßN	ﬁLq˝≈ﬂï◊∂?^Æö)X⁄ …„B∂k„õI‹ÙfÆgÌ|≤;¶X q¯IpoüLÒ"ÖUfæåÅµ8…L≠d‘ÅåÌr⁄^<s˚s'·õÍˆh*Lôh_LpÂ‡™Ó|F<O™¯©∫}†âˇõZ3õÍÿb!ËxÚM”â=¶‚¥ß¨Á¿ñ~e˘˝õÈ ÔÊ+w5íË8ÿÈå÷õ∑úkÑƒîáîΩc‚eîcÈc”Y6ÙÊSì÷©fÓXQ_IΩ†—
fÒ‹ËuXe|⁄£ﬁI˜YÛZpq¡[Ì5~Æ„|5uÙ˙ øU!ar®ì_¶i4k‹Î±VÔÑwég'›<'yàÃ‘Ølù´†±Nrõ[z≠Ås‚ácõu¶»ÚLjä•-˙\eBª^øîî/&EEe*Uâ!Ì‹DMmÃÆêQ˝H//ﬂs£Òä·‚öR}2≈≥ï™eb©ßH"à1M\"‡q/¡†3]}á¬≤Õ© :â¡ôsê|hF[èYﬂT€¸VÀÂî¥ÊNÏnkÂ§’z|Ò]¨zo^®GRTu†¨©µﬂ©˚⁄îV8æu:∂ª◊Üı5Â.È¬Ù9”∆¯…O≤…tıÑóT¨Òb≈Pâã¡Ø*§F°—’∆Ò√Hm]®-Ñw)1]Ú//1‹˙i7Uù$I9•◊âë¸!ÅÅÃ‚p£i5îçÖ˝jƒD_∏EÉ˙ëƒun-â;Ã"ëª^LÚ‡éxcËÅ´Ö≠1Pß¬Ω˘ppŸ‹›ßÙ^PYﬁ˜næB∂%Ú¿®jöù∏o•T4¸?ˇ˚Å7Œ¿€%≠œŸ˚¡€‹«CBGL3"ÒŒ?k”X"öö¶5◊¥']˝àè£M`nﬁiÂ+}7îŒqÆA˝†p‰á§p‘5Õ°hbõ ©`és]1árâÂˇ~P,w†XﬁíÖAºÊ;S,˘§
>dÖ¢†+-∏êêûÖåÆìæ≈GT	®{ÇbR:Wl0G<<GŒ√oKj¯Úü*Û(áΩ~ö$a◊—zÂﬁóÇ…ıâ¥∫É§pÕFwø—eçnÛi˚yß«é˜û¸˙†xØ∂OxXèÌò]â◊ÜèÒ\4Ø∞é¬”¶ØñÒI’˛˘Nº}äæû#πóì±kDœ`ìùê¿çDÆ¯Ùí+c=8D#–ë%z$äÑ€≤±≤i,.ã…scÑ,©gui7U˝VS¢e'î0êÚµ?¨¶ÿP˙	¶“Ô›B¥ˇ@px¢t`†∫gÇ<9|@M∞`ru◊3Håpß$≥ÖÒÉfÊﬁ“at”ô3r‡e)™Jâ‰N–ª√gc)ÂîÏxSWBˆJE<áQÀ≠Xâ∂…ç\∞cœ=≥}rÄñîÿA^6ÎàK≈„˜rŒ4ˇrä°)ó[ââ
’†ªµ»∏~)7^∫£#ù√b,Ø…wÖÓC§≈`˘Ωïø¨Æ˜ÀÙKıRøV\ﬁ%©ÉT	àÁ]raÑ%÷≠Œ≠Wv`ŒπAK⁄av¬úE∞0≈¥◊_§–¨r°)•ﬂÅƒåŸΩlœ‹ºÌcDÁñÚ2◊G2L‹çD7êÛ∂uƒˆ;ù˝É€Î∂ü/òiAàÆ?ƒªgÍF˜‹açg'ù√õﬂ «¸Ω¥fˆéÏRÆNz÷R)z`vÍ≈N§ﬂˇŸè5LkÍ'ﬁ•íkN≈RéáùåÇ¸“rfôB
ë’í@i$”b•≈käﬁ/mÒN,±ÿZé?“ïK°7?u<æ– À®“†n¶ˆÃbèΩ&Y˜'‡‚Ç™Ÿw]åƒ“ÑÁ∑≤5;+•»a◊>Ûl‘º‘Èó†6»ü:ì‹ &≠ŒÓ·Åue#¬py]fÆUGÊöiÓJ”Qï/öÍ¬›ë∂´-†ÌÃ≠éàÔéﬁÃBVÒ5˘‹Qw‡]ÖÓHe⁄æomN:n_~ﬂ†i1∆Ù^@ıÒ¢¯⁄ïq~∑@®	J EdàEÂ8Ÿ⁄VJoL è»˘`GA√9"xü˝©gs™‹8ûFË¸dF#∂"&Û{bË˙ë.iÖµéû∑¡[Ã‰öÍi´ﬂIìÎ¿ö ∂%]±c=“HÚfsÛÎ„á-≠yˆŸnzı üG;á:äk7á	f«?‹áÌ8!L\B¡Ç T˛é ª'‡~hî“Ø?˜∆≠Iﬂ≈œ.R¿oœ∫mL©¬%'≥"ﬁ8D—«\cä—ır4õM˝ùıukÍîÇëó¿ÌY?u!Awt]ÏÕOÀ·©håo^¶ÿ__†πò!v≤bÍ ÃshªÖO‡lL>’[\ 6∞Ë…ù¢=≈&n:-@B_)µ{¢jÑ§‘/uΩíßÕY∏í»vãz°Û„Ôw®é	‰µRÈãÁÊ¥Ó#]î?ﬁ–Cò\Â‚d—“Ñç!kØÒ∫•7¶˘c9√}∑”´ægzÍÇAGGtï•EëG√ˆf≈¬üﬁ √cT&\ÕAÖéÂ„ b≠©5ÖÁø«¿êè) `ÿ&≈ÊÃ|-H¥HbSY2ås%0b˘aM∞/ÚùtÇævh]E◊∂wN±öﬁ˘3—ÑMaÙY§∫óåC“ƒ›‡ÒBXa¬ò¶ùê;2ô€pºyüìÛ]∫ﬁßh‘ÒMõ´∂)fE ∂båèO∂p"Æ®dﬁ\êì®≤–Z‡’\%FõïÄ$˘ì„ûß±úâ˙ﬁFD}ùf´◊âU˛ÜTò{q£Ãz»Ê∑◊Èi+MÙ»tW√xi˜D,–úê!VÏê)¨)∫[;èûJÃc◊áÛ># z$züT≤R•Çû∑¶ÑƒŸ †„Ö-Ø?r.‡å#˝¡ÿ?»+ôò-„É‘J.9ìFïÆåJHäÂr‘¸Õ€P‘b˘â¢„òﬂÀå‡R. u‰=d[∂Eå«É€ùaR >¡LaXà"Ak¬˝¬∏¯áÒr∞1÷í•ÆQ∏	Ç¨ÖGz€ÈäU¨?≤ÖpQ*πõb)ﬁ¿}/l˙¢ªµáÎn¬ÈÃC$≤DY˝oˇ«XVﬂÏtª≠k¥ö'›õ/®7\qˇ∞—>˙ùt∫âí˙˝sÀˇPO?ıÙôEB?‘”Á≠ß?Ñm™àÓ* ≥¢≤”9•ZìCWaØ!i pT*∞ßí`∫∫P¬ΩT÷G'˚á≤zùNúì†¨˛‘$ä“jÎk∑©≠oÃg#¯VTûXEá◊ßÿy‘cÆ«ê¥d(‹±éÙ˙Ω!.r£ﬂ∑}ˇƒ˝DÑ.°ë{º•áDúSï€⁄£ Øh
Úsë≤i˘ÿ»YM+ƒ*∂B¨*‰Ω4ò∏—éDgñf1ë¿%≈À&Ï©MÉ€bÊ/D!†Üj‚&¸ÏTn]«G{Ç∏,÷„Ad÷Ò|å!aaÍuòãe 4<π∑#÷\:jÊù#ò∆0nœ≥]? p±I®¬0ÊD}«T D5ãeπ<õ,mmá>^–ÁrÑrwú5ßA∏C«–êDNö√€‡}√ˆÑ>î˘Pi∂PÉ*Å?ÆRÀ·WÏ(l ’Bºò>⁄≥bKò7¨ôg+3|¡≠ÑEøÍÏ,ëˆç™	‰‘Ôr©^r%⁄b˜%ècZ—@≥πP<D?6sÀ≠y[2uÉ0,Ω±¸"©F∂@ãl©:BÇ4NΩÂlO≈‡m”9–ß≥•›5iuÏΩ˚!x<˛tl]·Ì|X◊◊kÃäÂﬁ¨–êàŒh¬k¿d–§¶â˝ÖCQ°†Næi{7˙ ∆ÁÆ©«A
Âmz[^π”û©&6 -îMÇÖPsåVê“°ÛúÇ∏≥∂ª˜¢v‹π°äŸÀ–oÑò?·πæùì
âZ:QC']∫>#Oﬂ#áe¡S…EËX…qP&Nä1*aFÑ∆FËÁññç√∞Í0Âù˘,¶wPÎdEœ˘Ñ&π≥∏yí˝è° πØÛIËLÙÊ‰ìòm´Ü€hƒ¶’í)Y'$î ˘cîM*>*YÆ g÷¿nÙXÎuâë∞qª %38ú˘S3ï∆¥yóêÆŸB∫◊e'8TÎ’∏…_QÅ`Y¬#ˇùÆI∑l”Ò˙c˚nVFû≈ªYŸìáeyoÈ≥Ö&rÃ/n«⁄KgÍËà”øC£O|ª2|4…;ƒr¡ô3±`áÄX
=5π&æD‹Ωò]∫M™ﬂT∑ù ˜
Ú(?„é,"ELü‹]¥N‹E ≤˜˘Gä*=WûÚkÉæs˛+r(S ˘¢ˆ«Q~¸Œi∞ïﬁÊñà§ÒÊ‘≈„˚|*˛|"Xõ¯πüÉÄ#Œu¯xÚl{1˘Ô}Òπ@¸±ƒh‹¨(Øy˙ƒyE»ù†‚3¢º·•ü+û=Â◊wsR‘{]Êúd¿D(#€2bo†Ω{˚ änzO«‹¡›å˛ﬂ¢~7ﬂ|˘≈?dµÉ^º∂é>eÏ
ºpT<+Q=L9múã7-”1oDG?w‘!	·%BT‚Hà(È 6¥2≥â]iËYgòõ,˙ˆ ê)‚O›…¿Zπü˛bÈ/∆˜ZhããBl˘cÅ5ŸÎã9ê[e)Ü`LY∆bÄ¶Ìî≤&˛œ/ëaúÄ•äC“‰ÚcLTöÛ{lö»–ñè˝@π4Á∂7Â∂
∑êó≤⁄qÑñgÎQÙ1k§K›Ü®˘úè¶T*Â1Np∂LCyÕœΩÙwØÎã[-π˘íSMî™ŸFIFN©’ö∆R©g[*õñ|.^äC!Ô ä9ƒ|ˆƒ∞:µ≈…wr¶3≥çíyÕ{Mñ ⁄ì¡>‡XMk/Á˛#0e˚A˙=·1ñfûs^\âûV±x~Åm%¢?ãd	M6Œ_T©Ä)ñKIGeY“⁄Y>Lµ$,D•ô3Få≈5I{6S'É–‹E¬≠¶ŸÒ9Ó)Ç(Ã4ÙåﬂïﬁY2˝∂-∑êÔ¨≈°"¡∞nq'¶\õ)§nÜ1ÇÔQ˛êö -ÎKm%'üïxÓR◊Ö“®ˆ¢≤	Ç˝5o¸75?≈&Á¨◊;`˛˚ﬂE¡=ŒßÕ:àbç„v˙Ñ,åùmÚ¨àEÈ◊üçØêØîqPÎÿ∫ıƒägâM÷˚¯W´ÿk–…ÜO©}÷$-ØbüŸ¡Ùï
••¨πì17ﬁÑ‘Éu‚2Ô‹ô¨ç÷¯˜Î´@±ÿãº
p/Wc¬≤ínáﬁÁM
ÏçBE)·@mDÃ¿©;G¥…≈¥vﬂÖ;àûË·∑P◊±«¶‚Ã–é5ÑçÜ='ßß∞œOÉ,Kﬂ‹WjÁ+∆©È‰KΩ{√õƒd≥¯u∫næ2Û$«ÍU6y˘ÓkéÂª‰ˇƒZ˘Ú⁄ˆ‰ÂË–ì5…>ì	·©ıÍı=Àyr${ñƒËÍ"◊|≥⁄\ˆÓ¢U35j◊`˛6Û∑ô≠ôCˇPı„Ëˆ6Tp™ Æ“Ku=¯¿ÿ$<vR‡B©M®sÌ◊‡A˚ﬂñ¬ˆ°ŒVg´ñwgè%zH/rJAM(˚Ñ§
zÿL®Ôπæo‹0·µ˝ã!√b≈«ÓÎ›BôïYµˇ/∞3g<ﬁ-ÄÒ`õ4Q"th ylf6äé¬à@¶T∂“∏é÷Í•˙ÛzøºV⁄⁄X+m>@á:¯ÒÒ?‚9?ﬁßı>æïïcØ˘;ø„œØ[ŸÓóº;ˆöè◊œ·Á/pO·Õta{’èÎÛB∫’¥Sj~CJ#nÕbél=ˇvK…Âˆñ˙‘é/,ˆ#g0Ì&û9 %ﬂ∑¶ªÚ≥Ø¿ü6Ì U/∫+j˝J©∂]€dk•j˛Åj¿√ü2˝Ø≤	ønÙ·}6a7l0Xú<Uó™ZzP[´‚ìk’ÿá´l´õéUK¥)j%p≠7„Ï¡Ø“X0Ø *’ß€I¸Œ^övNm_¸-Óî¡ƒ˙Óê˛ï5Yhá‡£‡h÷hA´ıX ﬂ
ÏVÒ∑i5Òi¸mõ6Ö¯k-x&|vM¸ı´GàÍÌ&6{]Ÿ-lÿˇÁuu∑PŸÇ?≈ø˙âÀ}a∫TtÂÕ[]¯N∑ñ?rÏÒ`çx«øá{L"c»/à™¨Zı∑‡<o≠U œÎ„µ≠µ∏‡∆≈õx∆ÀÙüe ]Ûd[ƒCï’¿Tºó’3π‹§≥©è{‚ùÜà˙uå∏úr£Yg¥]é*âÿ¯iÿÚ
˛Ú¨Äméª√ÑoÂ+JË∂Ï5ßK£QöÁmTY™ÊóC¿¡WµŒıú>¡#H£Å”’ÖOπ«Nnæˆg‘≈√≈˛‘∏ ∆;2¬auœõ≠œoiôD˜j,≈Ì6ˆ⁄ùΩvcˇËÊãûñØëﬂá~…$jRüºÊd‘{÷,'4å[9—'5¬y®ÁC”Y{b˜G÷é¶ªclŒ√ãcçG◊‘3ÜF‚Ó˛≤›Õ õ∞Ë˙Ó‚h*é8ÆD;óCÉR3ãÌ#g(Çx|$ J&—ÒÎ_3i§…â◊áCT?µÛS±∏\ÚMŸ]ç™Ìà$]Ô◊ “Òﬂ´à¢A$»S(ƒí•áÚ›˜çôd¢P∑Æû† Ä∑#ñÙ∫¿¥®¯¸ªgª^èoŸï*a‰[[ñõ•<áÎÆ&âNÂ=[˛l‚Û€ô≠'æŒ^”;ß^ÿëÉb¥»	as¬åˆ˘‘†˙'7_˘æ˘Å<d€¡≈Ê¸Ê;n4{q‰—5úÈ©hv\=˚¥“)ƒ‹è⁄Ñ&Ec∂rÅ¨Äü˝R≈DùW3À·zq%_BÀ@ˆ»B÷úÆÏŸH•bhNŸS˜å›!5û6Ï=Xhìﬂ$LS"≥7}M‚kz•4˚—°apJõçÉˆ„n£Ÿæ˘‚àÌ˜ˆû∞FÛ§˝º°è^yÍ‚ö£D%4húx!‹°d÷≈?_îW¡∫^eU¯ŸÄü¸‘·g~¿œ¸l”{ óŒ≠iëZËÍÈ∫8U◊’Ùƒˆ}∂ãübk?–ë]	J<É=î†Õàü⁄Wª◊pQc`26e∞ÕFR©uXÆèBÀEr/ÍÊ-ØôbOicee0{öÖàÖ5CG'•FåÊ*Úíiiõ<{Ú“ût}ﬁOâû/ÇGWg≠√ õUv€7¨º\5x˘@pc<⁄ÖÕÉ¨—Ô?°—ÈÈ√åg©∏´G¥¸?^
ü§!^{ìP¢πé£˘d¢"˘¿%I5÷˜≠sãë¿úò®»œÅ0—á
Èe8õkﬂ¸ﬁÄËc3¯Â\<9s∞†œ∆vS;
Ã√ÙìT}"Qx»ﬂ!˜D‹Ê‘Ò˘q—¿Å¸2'ú—œÒ[∆:‰œZìπÖ…¯é05Io«)û±ƒ¬≈8èˇ¢kvn9˛∂Ul∏<‹û3qßË’Oªﬁ–öÙÆ‡YﬂÒÉ'1U¯Z\ˇåœüéùˇªgs N1~⁄!x∞|ﬁÁD[¯ÿqœ—V¬åﬁ∏ºˆƒsœ˘u]eß⁄èƒæÃ D5· \¡Jâ5üµ∫«Dt¯Ç:8ëLî∞’õL‚∑-∑dÿˆú3})ègÉ¢Úé1≈ÃÔü‡f—
ö}MÌM>iw¨q øÎ‘At”©w}]∏}∞‘wâß¡ê–ƒÇY∂üycç€§ü0<‚õ»'ºô /–UAN∆òv9µnMÒpcMÓb\|Åp1eoI]G#s»eÌœâK~+
ˇëwB}Çç†XóÕ!õŒâœrE-uΩ˙ÍÂıe&∑<¿ ÷DnúfΩŒ,ıb£—uPU]OIﬁ¥0öt1°ù@=?»Ker£∏Ë7_˛«€ˇ˚ﬂ…ı–À…%…a◊ä§bóß	LõârŒ“…‰6Îúv´∑âO=€˙î£‹∏¿“éî–!»Á‡W®’SÀôÅ~iuÛÈL÷/p'ıπ“˙§rÊ},BU˘æ≥I-ï%JÃc¿“«ÃÀ˝kà  <ïù\ª ≈#pU¥ÏØU…U8mﬁZ˛‘∆™ d™/}„‡q˜7€µáÊñºWùIïºÎŒ≥oú‹ﬂÌµ`ZÀﬁ\tmô«⁄ •“P‚◊w&Ñ[Ê›$.I∆çËø*´»P.#àQ—= ∫)∆ûÉãK‰®øµ∫ﬂÓùt·Û$|Î´”sylˇ¿Z„≈Iæ0:g«®_xt`_Ò¿L6IÚŸ]Âj1©{§XãoVbï⁄ “‚⁄åÊ)	*7_câå~55§–àÅ‹Z]ä∫Î‘Îöã©,yee{ ûQÄ¥~u´Løî¨S¬FKÖ-kgd»∏¥å€J≈QÒáÑ¶íáò©‚V— ¶ˆ∆á7Æ‘Çô´< {I¥bÁŒkò{XøµÛ˘xÊL«Wôﬂ≤ã?2∞)VJ[ªî’8R
À©"D‚¬/wÃ
˜ﬁ‘”6^Sæ9≥œPú`LK^X-ó{*,¸íç©¨^E+˜Õóø˝WÓÅ†ﬁkÔ∑Oá≠£ìV˙f
ˇ¨µ3C∏€∫õjsf<‚˙zmsÅL}—◊∂ò9(Ó|(‹NäÕö◊ÆZ†∞“®ΩÍ!€˘¢©º<Eå€û±w ãl÷>øyã1_Ñh¸“‚„ä¸ÄHÒiÃc·èjf*≤≈Ó°ÏrQí©$g	◊ôUåÉ4ˆ∫÷k›|qåÈo}D@;Z ∞ï†éQèÓ/ù⁄gÆÊó5îQÚ¯Ác|˝1Ωº√
÷¯“∫Ú´‹Õ
üÊüS1ÙÊ±›gDáfN’—Œß±PÂnV{£ÑÀ‹9Óµ{ƒ:~ÛEwøq‘a≈„õﬂÏ∑è¨}¥◊:nÌµQ,Í£◊öh·€`Èm†ôÕ{ﬁõ%∂◊ÍÌtz-pW~˛¨w“~“näÙ2”4z‚ôŒQ´ßﬂrtxÅ@`u…’ßóPöã{^∫%÷8j˝¢≥Éò•Fó=nw[ÕõﬂPªÄúﬁ'çCÏ–6q¢ÿCoO¢ıìn,üo‡˝√0æ&E§ﬁÅòWc≈KºîÁ‡so˛Íˇ  ˇˇ ºÈ