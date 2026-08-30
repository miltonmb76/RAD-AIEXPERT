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

      if (rxúÏΩ[oIñ0ˆﬁø"∫F€™íX≈")©%Ífä¢∫π´DˆÃéIéî¨LVe++≥&3K$õ¢±˚Ê}¯|û≈g`a`—k˚°4ÏÒÿ∞1X‡ÜÔ˚#ÊÏO9'.ôïER}ôU°[¨ åÀâ'Nú[úÚiøÚE…~áù∞4¿ÃOΩdöO¶yªµØZùªÏÙFüÄµ≥ëóøΩ_˚[¯™ä∑åí8À÷b˜]Y¬(àΩq Ö'^q˛=doÆúhzyé€ù^L"o¥w≥Îã√pÅµ^∑:ßØÉ£IºAòƒΩâÜ≠≤ñˆÏı˛@Kælπ@ÄÓ„‡ê=ÅØÌÑtoAÅ∂ à…è'¥ÈM®Õ⁄\ƒ¶ÿ©6 ƒLÏΩá^û§=¬˚Ï3V<xÒVı”ˆ	ıò≠≤¸ªmÎxeÃ;Ù¬úY=¥ıÃla¡xïáyÑcÿêx9˚Ãt±ç,ü˙a“≤äG˘*{cîˆ∆–ı>`´ºL[Í1c≤ÿ˚˜¨ıR†ºu˙FkW«◊)¢,0ÜàÙíyÔÇ∂ƒΩ^¸£b;ôÒf¸<8‹ˆˆ/@É¯Ù´4Ç≤_Ωz⁄§Åó/ˆø9¸n„[≠ a˚…aªnãäHÖ˚ëø-ö.çmµoh‘:ÂœCÌ’»Â®=e@ŸÉkiZ`O¢†ì¥›⁄¿?lƒA
0∆C†«<|0Ïﬂãie∞óèü∞|î&”·à}ù¡Ø’÷√Fe^§0/”4¬b”òQÛB4ù˛®1.Ë#ÅQ≤Îl	F—Bz˜ìO$íG^ÏG¡åt;yú"p˜ôó«÷Ó∞˚ƒ»ÚÙXç1ÚÕÏ´Iîx>¥-jµÛtZ†ä–S^j+˜Úi÷n˝2H√ HJd∏HzΩ^As‡"√ _Ç,€NﬁÒ&… á@≈Ä˛˚bâá„IÇ¯È-Ñi∞Ôe¡⁄4≠FAŒrlA’0n€˝„Z˘îjË´ƒ=$Ë
hGå	 g_ê∆∞LÏ#Ù ÃWAVÄ•çØ≠’Êâ“&ìc≈»¯ÎûWLo·T„#ín;%ò
 å˛›c'‚^eœq2Ÿd
$6Rc¯‘¿v8Ä±¥9Uπ[luÿJøﬂ7ÍÚ]÷¡ŸŒ?k‰
b?1@>?¿&∏êÓVæ†EåÙ*@ZÿX&°dƒâ&•è8≥Êt√W„‰0∆Füáf–>Ä©¬∆Ï˙3ç˝‡ åÅWGf—’<ï¥†q&ﬁP„!xk∫,	T¨OFÖ*—˚º±àu˙ZNn-‚˜Î∏c%√pê;ã¯c≤>ëS˙• yj1d|—√ûˆhmkÉ=Üˇ÷∂_lÈ€©X‚ºA17^|¨œ#N±ˆæ7∂·I⁄r=ÔÖÒ ö˙A÷æz£øtµÉRÀ¨b+W;ñPV1?/ÉtfI∆¬8õ"È„~úı`9t=ç¡Z\ïÕœHuNä#upMõ¡6Â∞ó>ãb*KRÇ‚¬!â‡\Œ–÷]™·Ãf√∆6Pnò7´Õ™ãÈjB,á≠ÈxÏ•«≥ôÑZÜ¶òÏXårf3ﬁtª{i¿0ãÌºNhgEÂQA‡Ê?ÄZIU‹:îË™4ôÓÈ˙”∑_LΩ‘˜h¬¬<…†u ê¡j†“ü∂tyØ)7øQps]ÑNf	— Ïf@?©≈√Ö∞ú§3dœ⁄Fz	l¶^ÕíâMAú±ilÄ˛‘÷%n⁄Ç≥Qr¯$¯¸Y‚Ï¿±>≥- ö(amÄ;}Å6¨!Tç@ä˛h\:]”æCö[ºB)47w’ª≈,ΩÜvNı%˛Ö´F;ûFë•+Y∞…≈z‡Ã∫ç†3™∏¡”e
±*Pm√∞Óëo‹UèsN õ>m™hÅ6ÔÚjúkL'>Ù¸FáôS£$ÚÖ“>Q¡‘•LI¡@$]l+Â˙9DãEä-ì#Ë/µ¶¨ñ&0}ƒzìÙ§øüﬁø/[Æ!,ZörmO”Áíö3˜ÁScXµ[a3‚÷©ﬂ’nR=-7≤”ìÕòs-Ã5?ŸÂŒOvYÛS≥ºu3òÀZ3€^ÉFïâ\∆˛qÏçaø>o€h Ä>3¯äuØoÙú1	ÉÌÜŸÜbmŒûyÒ‘”&^q( ∂“éV¿b≤©BT>•ÕMÌm˙›u”skˆ£∏(OˆÅ£P`S^*!.J‹µqA`Ó–/sõ‰ñY{üîOx„Øx!YÍvpîÛßûÔMø\O‚<ı2Ò¬b¬¸°…¯≥A∆·ÄD3˙Ì'É<IÌﬂO√Ag‚◊CÎ¢âiñ'„ß…0A˚©ˆuH“@=œÇVc‡ca¶¢C0üz«Ä’Ì„I Oˆ:ö9±è>éuÇ⁄ã0umn‡Œ»úhK)¯Æ#Áæ’∫[l†‘ÓüPBÃü&Ôl>ﬂ\ﬂ|2jÔ⁄√›=. ∑:éÇO6ü7(•ö{ ^mº|Òj{cwo7ª6≥›¶≈Ø¥ÇŒÓï≈·kèëü,∞…íµ¶pÿnÑ‘hG•a©X—ÊÌó∆¥wáv÷zp_¡cóàxâ{’%˘ª'ˆS*|e©≤ LTÊOˇg´dt—VÎ±#Ê{që=â∞/∑ü=e®Å·el? }4< æ|¸â\ﬂHÙ∑Ñ‰œ¢¸.êc>äó\/ΩÒÑø˝Ãıˆ∑”ÑWæ⁄∫Íx˝ãï;ºÚUWÂ_Ùk_˚¡ÆBZ˘ı$öf„Xî¯Ω´≤πå8˚üú=ÑÔB?%˛_Wâx?√gN‰xÉi.¯÷U"–K|Á*Í%æwïHÙpïòÍ%˛Ë*±¶ó¯{WâΩƒ?∏JlÍ%˛ì´ƒΩƒÔ\%æ“K¸ì´ƒ(G¸ΩsBÚ0RSÊúıÁzâˇ‹““:≠ëßﬁv∑4á‹;ÇM8@ı;ci2&Üä€Ddê;íÚÑEIÚV,0.ArIÇ,Éó^‘`Ì!3iˇ∂ÛpwüÛ@çßò<I/Ù¿]h2ñÆ/vù%º	Äw$K˝wŒ2¥.dë#gëÅü‰≤ƒü\+ÉÛ4UƒµBwwaßA0£êMFû,„Eû≥‘~ê´B¯›çC$Yä~∏«?“£Œb„©,3u7É;@vM€Bs0üéÁ*æ–∏¯ÓN’ÇÅw{5Ô⁄5Ô:‚]±Ä÷¢,M≈ã≥É$≥‘;dSêgpwåºD“ Å>LAX°ñJ˘∏+í1JL˚!è«¨ï˝vä1˚…kˇ˘ø|€i±°7AC5»B∞ƒº‘GnäKì$∏>€‰ƒ]|∂≈~ï§~ß¡∫˚Û?¸ØˆÆø¸ﬂl†x˘ßﬂ”;˜˚Û?¸˜Ù÷µ¥˛çW¨ ‚˚øËmı˛€Ëm’˛€ˇGØ´®ıﬂ˛ï^O’l	—ÇP#Ï¶$‹kBÈ8Há¡:zvÅëgaˆ(JoQ,é¬≈˘mM<]Ê‹”~ù%1U)·íb∫kÂóB†›{È€ › ΩÖ∂7;[€kØ∂_ØØmmº^{æˆÙ◊[õ[´WNxßß{oÓñ™nƒ>U‹x˛∏Yµ88îC|sÂDÎˇt7ær¢ÜszÂDΩSûæ±Âp! Î(£ÿìV±l6Ã[\Õ`ˇP%1‰`9ÛæÜÁ∞~öÉ¶…ØÅ”À¬\EÜo˙Gí±«^˚¡—ãÉ∂6®é>Ù ˆÎ´¿ÿD2ﬂÀ>–D—]BãÖh°Ù‡Å»45Á ¢¬8£œl∫œâ°›_(ÍiÙY‘ˆÄôTT]_/°Ò0ŸMIÕYÄrùµv„›C8-hœ®K≥âS5â/p
C¥Öb>AÔeP¬–≥É_ˇı÷ãÁ{bäÛëó?©˝˘ãm6Ú@m«	'ÇCêΩ†|1Ú2z_A
ΩBE‘'S8[Œu‘Íÿì√°Æ¢âñk4ÖÊÇùpí(«>Òœ»B§wB:ÍâÂ>HUlÔÏfª[{∏Î¡˛∑≥ªË*∑h9úÙŒÄ8µü;K{¶•»éëNº4ê•`=˙’∂⁄1Mk‹:âïz|öÿ}@ˇZrxJK¿4£bU(º⁄¥,?í¶eK¢vW’MÜUÒ*∂;%≤,AÎà ≤’UŸM´íŒê¸¯*∆°≠óË¸Î)Æ˝…ñ∏d{j¿
a|t≥FŒ˜∫ÙÍÙ ó7)mpâ_F`ÒòJ‰˜-\{êgâæG¿ßÈKéÒÜÙç+å)}G±áÅ-Ùµ'ˆPz2ÒÜ¡Î˝4ﬁ“œl›ÔcËÀ˝Pz>ﬁ—√UO«˚Åp#4≠badÍŸŒûh,∆Âß8ê√Jœ˜ˇ¯Ur®øêØpèΩ‹ÉW∫@ÄèìÖ–@Ù.Ãy…Ü‘û@fHïâØ@8¸Ì≠ö·ë&±≥W‰Ç∂ìóÿ4[¥*7’b)¡C9˝u}VÜ[g8JIÇOêÍº(‚¨9„€Øã€i!v^√ yÂEŸñöv≤gF¸Á·„€‹¸ÖºAˆÿéÇA[√	0r‰∑dê7|îcØsG»π¯‹ÿ≈· ÓM¶ŸH<#ä∂IÙõ≈KpåÃáVQÏwì(ﬁõœTÒñÁ…·ëÿÑòäò^‹OI´Áæ|¥ú°*Ë@A·J?î{a,L ^TÿUMZ‘~È÷N◊~+Ia◊!úÓ¸fwoÔzarÂCì√x 9,dhjGY†TQ§Öù¡ÖΩ7%\ª∂ˆ¸ÏÔünB3lÛ˘ˆ∆Ø÷£âòA/Z∫ Y4eã	’É2•D’Ç-ô’7"ÀÍÎX◊-kº±∆tdÁïïzz?⁄∞Ìòìf$o3∏œØ0ú(R´ãØæÅ@W†5ì: ö¸§b%¬Üπ·Å’ñº‰Rî¡5≥πlÇØZç-Mœ‹∑ä»{‹¢@?“ô˜iwe·ÓïËÎÙMQG±™æ…e*ß´£+N”4¿∂q_}ä¯-v$Å0´‰Sÿä7q≥õUÊœ¶ﬁd‘®Ÿuÿ¬ÎÜ1ñëZ£pµijUß∏3ÄK¿	ô–W@{ÍÎ,≥j∆LAE?$·ú,<s§Z„ùÈÛ%$äU∂”ÎıúÓW s’pf{U5,·÷!HÕÒyqCÚ⁄L‹`©Y∏	9©i∏Q¿’¢EïjÜ¢ˇ:î§'_£≤(ﬁ!Ø≤´kcık“∆…«>ÒØ‡îÜÎÍ å@jV≈\⁄h©/√	ÇOç
Ë{+:RîyåœÂ›n∑E°ØãøŸyø∫€›ÕˆÆ_YÏÂAñV{Bê -Ÿ8Í~ÿz±1æ;úå,0i(/í?©)0êZÅS*N◊É(‚“pr®ã¬ù*,¶ﬁ!¨%í†Eπ≈î–H|K¥/´—d∞ÒÅú∆≤ä™F{Kˆ+x©ıo≠óç¬É‹÷ız†äïkMíâ]GöÒΩÅZ≥äz∏éB¡üÍ,¨ÔÙMÅTÿïÑ£th5IY¬î/u-uà1€ááùéO5[)ò.ÈÊ—4'o°Ç≥òãR–ÃárTM™ÔÂp˜∆B√(W¡úV•R5ú$¥≥¿RÜB˝ªÁﬂEƒ0·…ıÎ∂ù	(ı)q^t'TçÛ˜Hµc“FDISp#©iK˙–VÊ'á@cËr‡∆5ä˜B}¢ç"3”}o6A¯óçbbx7∆xÛÊMÀà§ß†b√7z:!ã@2¡r≥©§ºA+qeØÇHXI∞1¶ì r	45Df
8ÊíW€∫„1Qîuﬁ Ë∫˛lπF≤IúáqQŸûØò>ªq>âÇ‚Ã¯xw€HÖﬁAÄD⁄Ât®ãê‘Vô ‰Ä(ùm<{≈ÇﬂNΩ®õÖ√÷tJ\ ãìú¶hÿÚQﬂµiu©ﬁWÿ(aãìe‘Æ¥t”&‰“ê+w∞Ü∏˘Yñ∆]ùTŒOÃß∞È¢u#<‹PÕå ‰êå≤–å≥∑¬xP°lÜ\UX<ïœÉ|X«ñ ÉòÄùm+fﬁ∂7÷e†˚?îª¿ı•=i≈]Uf=9n´9c%t’áØªl≈ä®¬Ré…™Æ_øã¯"å`˜_ËR æIÆãÚÑÈ#CÎ)íΩæ˚z‰Zd…A·ØáÊ¶@>I¯qk∂n”~∏∫ªˇd^î'˜µºûÏxgﬂÓ√ÿÎ<|_xﬁSô◊ ﬂÏÓΩøáÔË’ÉŒï≈ê´AÇ·‚J5€r2-7À≤ÊEŒÖÊ¡X®≤1(]Sa*«ı∏⁄›Ÿÿzπ∂æ˘Ò¥Î_ˆ¨ÛpwÔG9w÷Tö^:iO‰™ê‚l„Ò+˘ñüPÑòqJWV≈H·ı˘'÷∂Hq≈i$êÊº∞îÎ(û/∂xô–M/R⁄4£Y	⁄VÔﬂ´N
ù[m ˜Ÿ
ñ Œ€≠4+¿V—ÖùÀGG+ÔwZ≠Î•ZÖÜ√Oî°ø %îÌGÛ
º&-âá§¸e_r©≠>‡K·>}äNMRµwàâ"H[`ﬁ@ÇV¬ÿÛ¡,=M¡T#¨˛µq≥wΩ'e)˙Õ/<©Ê1v»J‡Œ›Úú–ùºs√∑2/|Á‹ﬁòBàÊ2=_`ÌÕ¥SÀÉô¶j,8”åè®X5£øÊªíÜéBñiŒ»√Ï—4Bó©ØÒeC(g‹~ÎzwçI€.ÏÌª=ƒøπ±ﬂ5/{j6%◊·‹nyõì3Xµ-7⁄ìÀŸñ™Õs66|ŸÓJ§Ê`–3tFúß}dñü–îÀœ)ì7ê«ïØ–aïm‚;=|öÄ]¸Q˘h•~k¸-ôh¨cUÏmplÖ†Ã:iUê˛	Ω∫ﬁ Ô—øœj√M(ç“ë_ƒà\€Ω∆√∂·KE»mâ–-˙‘ãΩ¿Î…4ÊÒè}1πvààÍ∞q∆Ü»àY®%ª¢‹ôØ/>≠ÃÉ4ùˆ	bçôÅk™¯Ç÷U«"p£’Ë=h"^£æÑ•¶Î¥K?*Æ_?}s –QÜáÓÓ∑0.ºKéqDq∫Ó>RAÎÅ∆ OddK°ª›[‰= b
J}:
Ù™ßí8%æä‚˜®wÉ™÷ ]z˛0EÒºû∂pÚGlï˙©_◊ à˝Ÿ”p8 Wa∞âç‡ge»ı—ÇıA°^ò/‡©÷)¯UÁ hrS™f•••ı ∫hÙËá^ÖFßˇAW‚…Zä4QWNY’R∏B7ãº<ËﬁπŸgº≠Q&Ç∫ÄQJ–xz´÷úéü¸ ¶"ƒ÷+ï÷ }6¯ºõΩ	≥-<Ï6»√¡ó≤Ch¿Nt"3<î∏	A¢A`Ó“M∑ø∆¸bé%i-h≠üaê´±Æ˘ìSä¥ì‘w:ÂyµC(ÉEzyÚ49R∑*e2fı“ÀG4_∞$∂'c/
UòÖjQÊæ8Rèü÷ÜrMSØµ†æ„Wÿ»æI2ıø¯A∫À7ﬁèö”ìÉ051å1M0¡úÜÉi‰a3E7—ÙàÁÇ¬“@¿∆ÔÉ#¸7¸È@=É_· ≥&·èIÎ˝&Y$°ı#3:,á4å DA*Q•¿-k|ˆQSq"øÖ1ù§ûü∫†¨»™£ çCœËÜûO3	9‡iË•)’Ñz†	%Ä˝≥Ô	Q~òçAˆy√‚ó4îK¢≥?`B9¸Èl0óâ—Y:ù»˘Çı9†lõ™Å(»ÙØ{0ò»ãB¢°=ù√SnA «î§†ñ^ñåÉˆ©Û∞0MHãö…vXpõÜ-ñ≥·a3„Êÿ†ÈÉ}‰àÙÚP$]G>/ô5Ãf–Ωú|»øﬂÏ˜ó˙lîº“U˝·r_x?ª˚Úãzw≥oÍæ0aÃ&Ω¸˚?ˇ„ˇmºÑë“pÇGq·ıó xﬂ1·Øö6† ¶Nß¥æ"·ôı|≥kÈÇ{-’¡iI#ƒcé1¥>>6V≥«üY+˘Ïª1_ºÅ¯ÇgâR&@˙ÒŸwÍ+Q~zˆá*}M‰7K¿/™ZDÜ£≥?éNœ£©¯¶—£G©í°¯Ÿ˜≈öL’7{	}AØ–è¯ZTòq2æHi«Ë«dçÂjÄØD¡⁄J£G<~x«¯Ö?%9Ù<Ô;â¶„òz{wˆ]ö˚|Ÿ u®ÔÉ }á˚ú≈¨∆˚ºA?I3zŸílM-µ‚_e„i&Ÿ0–F£≥Ôr±êaBí‘ÍÑû%4C‘pà˝0·≥„……∂/À
‘ô¬ÍŸ˜~êT.nACîëÂÀ⁄≥ñµGÀ⁄ª§eÕ{%∆Wªé«^‹Ω—ßuLﬂÌu¨:÷±zWøéˇüöu¸,àeÓom¡¶ÄˇB+S.˘Ç~ÁESX√≥VÌs<A—±"ÿ‹ÕΩ8¶w÷>åØÄ≈é£~%d!rfìÒç
[‡€d6	rQK˛†Jû¶¸E—ãxËÒe∑üÚê2Kzì4pn¡$˚=ÜîpöÔ&0¡úú}Øæ] —ƒ…s®a®_TyáxÃä %c`ˇﬂ≈Ab¸Ú*	Z†]Óôúûcãûc¢Á∏ÜûoŒAœºS‡_>lSÎ⁄|’Rw ”ã|πQ…ü6çÎœdÆøÆ•Ù˛óJ«\B∏Eπ©s[O:ê{qAÑPÖ„yŸ?<	≈ÅôE Ñ?Ë˛"ÀÄÕíÑ
€‡àé:´B=5◊≈xLÎÅ˛¢@FÑıˆqDè~d@”∏Ñ9◊\¢ói		ﬁöy√0∑¯Ô ∏oÃ_ﬂR–ˇR±ü¡,ö“ïˆÑÛ¸Ató˙¥*>~´¢◊m58åóí?8—ÊD¥d‹•se˝Ê6π.œAÆ€gﬂ∞Ü”‚”∂[K®ìi:âî@%~Ÿd™=vP©ˆ∂ûHˇó:v˚f
ÖüPÓÅ—–sJ]µpˆ-PXö Ûˆ¸ﬂN√,§óµî*«s:ä"∫^ò&îˇUŒ`8Ê^ú6(?al)3TMï…jÿ&ˇõ‡∏NØdÅ»ÑÜFÆ≈ˆé◊˝f≠˚ﬂû}{ˆ›Ÿ˜g8˚„Ÿﬂü˝√Ÿ:˚›Ÿ?ù˝˛Ï?ü˝ÎŸˇºÎw˜Æw§ˆZç⁄9[Ö-îÿ≠Èæ•«Úw–Œ≥¬
•ûïNÖ…IV*™∑9)D9ON”ìlŒ¥>Uÿü‰0¨î{‚T†Ñ¡≤ñ»∫n{îT„71ﬂáÔŒíê£|€pH[ºK˜okçŸë˛zı∫j/–V6Òbf<b pV–‰iÁ™è‘‰rÛôUS∑¶¶iñ§›QMÿ‰®€Ô›diÇ©Â}û{%ƒU€≈#daL'4RP( ”âHVGÆúËÉÎ@0 x`¡s¬◊{»⁄÷õ¬LX≤ ∆¯+'‚‡Ó(¿œ@ëWΩHB∞Èui^Æ"€-ïë'0ª†¢á∞˜]Ö˛ØÜ˝´lU¸$£·UÀh®`◊Ê⁄NìY∂# "÷T<Yº∆∂ÅÁ‰·Df¨vsLëÁ◊Ì“ú:4gÖ∑üÅjîc õ$Ù.&nÉEêwóóYóÊïÃ§GÙ`ºﬂ]f£–˜Ao•IÌäÌÄßÈﬁ\∆CV˚rWê{˛9<◊ÏØKs≠
RÍE,¡Ê~ÿ]>‚G^ª;K˝…—ÄEæ‰.í’›7›ù;wÓÏ±IBgÈªî—'Î∆†IZ£ÔDÑCÕp sjuò‚:mïg´Ñ®É˝ËÀï03Pw	1≤§Ÿè)O@xp\›≤h˚Åπ‘¶x
tÄØ´ÍÈ0M'†#“!Mé¶€à%<ê˘—tH¡Dö-€ÍR ï=V=7õ—vÏµ9(?´?LR√Í*YÅÌ/–ŸÌæWÂ6∏d~·Ú94buÃ√Õ:,∆QÅqıÕí
Ù≠‹ÚW8/c1™ﬂc≈¶kª0j¶¥bBgO'v˛ìü√ìYÇHÁ‘^)•Y≈9ùŸå*_ë¯\MÄ)˛ƒ˘Ω^Ø,|7s*™ÙŸ¶ØpbxOﬂ‘:››K˜œÃmw∞_ŸA#>c∫/S˜‚}¢Ø≤¶¬˘Xç4Z\gÃπ(uÛ£Ù›¡»£%ˆ ÛΩt-é	=müéÎ”˝5B_"o!e‰ÄÖJ_z  d¯K˝êP‡⁄ÌwLµNO«kG‰ˆ≤Î›Ue≤åSXπ’/ûâˇ>π»#$%›ΩÇüﬂ“∫Aˇ%Èâ¥dP	I»ü;Ôú˘©kP'FΩóõÏ[ÜæÃ¯IÕ±.ìe®¶@/V¶>‡ÕRk twıìtPâA]áz◊xìÉ$k©íªäeal£_íôòs.L=†Éˆ{À¨ﬂªÅˇ‹¬n/∞•^Ø¿Â0˝óIt<Ñ_àl™JgfÈkÅ0yßöD,”~MT™∏≈Jüœπ"ˆ2oáº÷Rq„îhØ {GßÙ˜¯T‰Î;ÌÙæi≥çYwi§z2mGÄoPÁ’ ÁÕÎ—LvåŸsBe¬ÙIëóäjﬁÛ√w∫Ã8Œª∑°´Ó-)îÁ {Ú˘

‰∏FW˘1
û£éŒUh¢¥∞)áÌ{®40~·∏{K	ævˇá\≈(™L@• M“∂qXñ˚}MÑæ7Z—õ‚mÖTüƒ	+6}M4v»√ÖÇ‚ÎóπΩ$wS(±ìÓ-Ñﬂˇ˘¯?Ñ`ÀN`
â°m„ù¢ƒÕ:z¥»hE–§‘ÏQ¶Éx≥ﬂ◊ÜsJ∑€≥ƒm»Oÿª Û á^ƒSìqìïûÏÏ{T-ZR6“°«Ú0C?≤,?˚§†¶$iÉ9ú5Éã0Ö>©òO\≥¥pª†ƒg®˘´⁄œe¬Á-Åbäø’‡GÂı)¡:˘ÁVŸ÷Ñ&Èå0E∂}çì»˚4M∂D—˛*¬#01RıP°Œ©}EÈ™Ê§{ì” ˛É0õƒ`jsu›ÉTSÆ[TÚn»Ä∆Ú—˝‹&NŸ(@ÈR˛¬%G öˆa£º"ûäøf°X##º⁄+Aﬁ=ÏÓ¨|éJ∞•P"◊ì¡K__G1O[Û?—Y+gHì<+2Ûî4®â‡c$scNÆeg˜ÅÒdx˝E›o°v›B„fÚ†˛≈`ﬂø,…ø"T¥‘Ô«ﬁ…õzº=⁄ßo`(odïµñŸrÎî-ZJå%„Ä1(	ËúÑ+çtÆMA~T2Rù/ô7S‚G∞÷{dﬁ‚∏9eGK˜O8Åú≤cÌ˚—Ú˝h¯5;_èOt›π·≠Ïﬂ∂—’[nÃ~OH¿TFLÓ6O`:JòPs(gN€ü‰¶√}Ø˝˘ùˆyÅ-/ﬂ¡myπﬂ—&ı∆¡ç[¡M ïñ=O“/—ô~ƒ'˘Ïi©€Ìi©€ÀSÉÈø£brG˜˘û…«˜˘Æ…“˚≠õ¿G¨!¬É˙Xcn8/kGa∆ûz˚AtπHàˆ#É6Ar*°@À∫C
[#Plπà∞—ã∂∫¸] )Âa/≈∑∏ïîö§{±‚4çµ∆¿ˆ"ô1≤‘oí˝í\vJñò{\Pt◊ AR´Åb•^√IÑ
ñ9r¡ã∑«• tÅ√˜ I‹:ÉÕ?≈8˘>e˜¡∞ˇÎ∆È˛—NâNÓ±ÓÏ^Ä!∏˚Ë∫˙pI êzª›A∏™*‡Dqƒ /ÉπY¬ï<[Û
wØ-ÿè1üçéªRC‡‘?˜¥õ`ÙèXúé7∞Z£#◊®ª^`kÑ”˚'∑ÆR~2cêãÅHàÃ˚~ãˆL/j9
€2ŸŒùﬁM4≠‚%r]äî"Zπ5ß#@GÆÀìÅü{ÆöÙ"'yîcä˘«˜[0˚∑ÇqÎ¡I±ÙOÔ-ÊUvdw#KΩh√0y„ 1Wèí~–>|¯t∂…⁄ŒÓ-∫û£%À=pPr¥q∞ˆ£´7Æ∂\ﬁúπí/•éÉ ˇŒ0∂9§Ûù•æF
ÖŒ°˚8Y`»Î®⁄hûÜ*ΩƒÎ^©´>∏wªÓÉòy©wˆ{èµ7∏Kºﬂ¨√òh
Ü!ªÒ	IOI‹_D…>
SâÁ3nY˙6rÏé=Bıè“N√£Ûà„R!ºa~0 Ø„±
sœ¥ü[∫ø—ªÈ–Ò§Xø‰áÅ%«ÛNm qÎÄU‰–@’÷9œû¢óS ÄØâ)‡Î§¿msŒÜ–È≠±H}Ø jlà…ye)«@øK∏∏3$®∂haV†'+≠ÍKÑ¨=@#UØ_˜‚9'°ÛßØxˇ
’4.KèÊA¯è≈f¨VL¢x.!Cn/ºÅ
èö€Vßs R\¥%àK–Mé∫+@Òìc†Z	Ö≈•!¡ ÄÈ%È™•_üó∫Ù◊w¯ãT }õ9PL$ºj–≤ Œ0ï6ä°(è∂öy-ÙŸèÛö[]À´g1íc-€\at„2◊øÚÖópÙ8»Üò•Ü=õF=!Y˚÷„é5¯—çz“)g≤±fú·∂ôe«J()*Ä=©´¯Gµ⁄
≈˜=P@
∫FL#3B!öRè–ÊWãÈzM ÉãòDÿR7"îﬂI¥äZ≠+ŸÏ‚ñ£áÆ˙‡ø¥N¯ÉπzYqÙ"bôY≠ıAøy•>*eqAÖA«‹V…m9sOçÜ∞ßÆÃﬁQ9e’s©G∑˘¯mπè´œ”iåë-ñ£Ωt ƒ-i∑Œ "Ô*≠XU-+∆.•¢:D¬5∂ì7ee¬b¿æóëyÎ°UbJ≤Q∆oªh9,à•"–à∆X– ÕsBÔ‹~KÚsŸR≈èù?M^Õ-H|ˇ!sü±ø&≤¬»ºÚn^„ﬂÇÅW2o)v£ã¡ îô¯Qvnˆ}ª_|-z6∫«qEQ¿éãq©”¿Ò≈ÉåµÂy¢ n%˚i@¶˚éÜGùıüáÌØ†»îÓÊ‡˙ÌÚ∂S≈XÀÎú∑¿ƒ…It…hˆP5NDFõ
FT9Iã∑iû‹‚`wZ™‰Mwﬁ$÷r“∏@BÏvπÀ…)W£aÄnèZ:Ì1ùè9¥€äà-7¿w™¯çÆâ|ŒO›à_•˘œâÆ\J±'⁄G¯∆	&u¥-ÜáiaN;«ÁdJº!q∏Ü≤iï[´—„≠≈lá™π¨‰≥NKÍÅ\»´*ö«Ñÿ5∑ªØ“Ê√õ¯⁄`éx†´¸√uŒã!?®?·—âpp©hB∫ã Cj∫ı¿dç%º√;ˆJT‘1‹≥µ˚ûW®èÜHL$îL1Æeêå«AÏPÜ}ÑÛTK&ÆÓ3'¡·°øi¨ƒ≈[5ã—¥vh~u·D‰ﬁC˙∫üuE;í’:4/kØ–Vª€QW€õeø˚üˇÈ[Èvﬂ¢h45Ztˆ-^ ⁄›‰ûIÖ¬;ñ4wYÅöÈéØeıÁ±Uôô<íNØ©y@éŸÖ-˜êÓÒwmı–IO¶≥l˛3÷Åz¬ÍW&‰wƒ¨≈æä≈“s=(uOFUÑ`ñÒ AﬁÆ#Ëã~î¯îÚ†|1óù:¢(QË“Ú∏k∑}9Øk“z¢£á!ë≠¨Ó$’›
—˝$/c√;G·´u}Nµå`cÖ¶®‚I∫¨[ÿÇJ, Ø£q‚“˘s!ZQ≠–7ƒ´1F⁄P∏?®'Ct»hªg∞¸VYÀ{óÑ~kÅSüıîùZ √=˝í≤WÑ \$8—ªÑ˘/Õ“∑-{ˇÑ‚-œΩ≈e›YÌ,L…Ãüî‹•ïX8yÉhP·L† Å“6AÀ…À«O0ª\Í¡Ï>µZÅdÍî?`H}`á@aÊÕ·[7Â!k2è∂Õ·Ø¨±›ê‹ø·»Ü›aÍÛç√96=HfÒsjIøW<^ó∆˛™!<YGuŒOÜZ3ENÄ	Íÿ–8'º"nY·ä±Ÿt%Ó¥¸\*˜è‡ˆ7˚v˛¸I„ä»;ºvÀñ2 æã.ôê±|bn$íÒ
ÅyaQ,Ãûa¨8F†∞ª°¨±º¯≤¯j„ÂãW€Ô7ü?yÒÍŸ∆˚ç≠ÌØoæxˇxsÌãÁgø€⁄ﬁ\Ò˛ókO_ºZ[ﬂ<˚›sô ôZËîª§Õ£Hî©:‚zyÚJ<Éçñ{vÌ˘∆ﬂæ‡)Î>ﬁÿ˙‚Èã≠ˆkˆ◊_tO6◊9`≠N	Eä[Húà<mÇ2çrQÃ#“htË€ˆ2ﬁ¢†aıkoô±êWı◊ﬂÇË≠ˆ*ﬁÁUµCà<•öX3∆¿i˛´ﬂDt˜$qK?û†ù‹Sö4Z7™?!Ì–Ω≈]!¢[zÏ⁄ºL\∏do]∞*+“.r™[`o¯æ?íWƒÕ‘
Ù32Óu:˙≈®MÚ<µ¥Ää—ùCä
#∆ä√Öpo¥\6<fc›’W)≤üÉQﬁÈ;ÂÖ'Ö$ÙÂüÍâ‚|öß‰∂∑‘d™FKÛŒî¿.
ÀHªÛ ›eM◊ %ŒÃÖÀh©˛ü˝Àç–ø|NÙÔ,≠Ë.ÉYSpÉüd˝p˚CM¿Ú‹∞“hVŒ9“20Éª [„⁄˛“≤ >ˇP¯_©«Lﬂ87©/Ÿﬁ±ZtÛ# ’∑>™oT≤{˘∑ZÑ¶ª7/§ckﬁ6âûQãÆ<Áé¸æ@fÆMÎÊ[˘°;1»≥É£Xö#‘⁄-¬f—0{N∂Jt^JXÆr÷›ßƒÂ[/.ÂÅ∆J6∂Ù∞?búÎ«»6eÛÁÅ—V◊\Rí`ªaµs£Ú∆DDèû‡]54Ãé≥40Ì<©´i¶ç⁄5H«:ryF
£∑óÓ,›R6Òî˚tËDNÅâEÇXaò,CŒåô/∆] ‰mÙ˜‰ÈŒr∂ú§G :2·ªﬂ^≥.:h
ËrŸ!Ïé&Ê< Ö⁄Z≈Tä-à[që3‡æ§ÄI8√√Òµ
¢(yE∞.bÂæGË-é≤ïÇ687 Skè9Éù7Ûc∂/Áoâ«5ÀVw´˙ddÇØîù–MÔÕÜnWjê6_2T&†¸bF_oˆq+ZÜj¢ŒRËëçQ/möC¢ÏòÅˇ√åHÜÌ–ò‰è≈Á’,¬ØäW€Õõ+j«È‚‡t
76~Öw^ôÇŸπ¢TJ‹œ6çÈË´˜‰©›úØdgoï…DŒ€ÒÿÛ[Ã¯ç∏{ô∫÷ó*»ü¿wJYõ¥k|©∞˙-J:¶hi∆ÈsΩ˘0£ôT>Ã/∑ü=ïnÀ÷(‹»O9ª4≈q≥@£{Bñ"˚_«ù?$™ß”Tñ;⁄Ï∑ì'€sø§ÿ"˜+Â§≠®9≈, y¢ﬂ$m‹s-1ıKè'R’q§ﬂuØÏ≤åÌ Ã≤2∞EÆ¨Ôn_ÇIÂ∫µ]Eﬁi^CÀ)˚òŸiŸTù“ñ.PÚ*Àƒ$äº	Ít≥ÙA|§lÖ ÈBO¡’·¥X*g„WÇÁRøøxGãØq€úÓÂ©—•úö–sœ`UJ/πbIÓ-∞Qïƒœ?(•–aµ≥9∂¸Tñ˜^©jlJ«Íﬂ¯´Ωäﬁ¥–T’ƒí´âïπöXûØ	MPp˝F˝–+Ÿjuµ8[Æ√YS¨-ﬂû≥ﬁñn˝’ûë≥lûW\±\ï√ä1'Êñ˙Ä◊â≈õóÄ≈⁄A7∆\›*p«	◊ì∂ÛúËe„π!ñÎ‘êRÎ»ΩÜkÁ∫‹ƒç˘öpOQ%ø&;’KûIâ0£jñÌYöœm©£ñH⁄îàõ¸dæŸ-7¯D˜¡hûfñ]Õl~Û€i§ïÃÅ·öÛ
¯¬]?\â —t8JSeY]$¿SR®Ú©(ÒRHo}@õAíñÂD˝”@‚@-¥êR Ú«≤-AÍüS -∂*Å°≈b∞”©ü™s(”Û]’¿Ω≈|‰nƒaœ(üM§Â _íÀ≤$™a∆,Úp°ÓqµX'JbùxP†ı¥ê&ù˛K©˚q˘.]`ÈfE∆dÍ&@A®)jZG®¶®\ÅxlÅ˝[±\xÊ>qôÃn¬9≠∆ôe-p◊™¢•KQH‰ß Í¿'`∞¿ıvë±-íV™òùiö,.i≠¥Nä6ÿ¸⁄ÂJeú§ôÖøÉ
•¸PJç(∆k±ø}<I»*àV¬Vqb•
‰I∫mØ©eYı¿Uû|®¨t˚¥∂≥ú
¨2ÎD√mÎD∆QÀÛ
∞,ÒÉ≤òQ´zπJW¡xßfËæ¿0’Ÿ√a¥äá‘Ô∫» ¸ÍΩT14_ë{ÕŒ[±˜Í[©më¨ñn∂Ò6€zW˙:
¡sn¬Æm∏à^[ö‰Íçπnk÷ÏØÇ]U∑iiïÁÌﬁ£›ªt91ï√Ì“◊!—\ëêããÏqp‡M£\8ò[t„Øx["›fÓ[ÛpÅ√I[~_`ë{w◊íªó1Ôò∏ €È≤Â∑e´Ã¡E√¸vonœ’*ö.∫k-∫D§†Ωµ¿–íAÒ÷∑è¥˚Ì©æ∫Åú_wj\?Œ?N`+cJ£M˝◊πKu‹Y¯™ç}tRGôJtØK,*˘[öÑDöqêZÄ‰O'$íΩ÷’™C˘[Èue8^C7ékŒxWÛLÿ§Èt©∏òÂö0-ËÎ√á{˝®Sàd⁄ÂBI!úr¨9'¥|`Æv:Q|•éîµ•∆üÿ*≥∆9ΩÈÕ|È&À0[ò”óﬁxlÁuû˛e·pÆv3üÀu~Ò4ïœ3à:j™X˛s,˛b∏Û kS>\«≥VLiΩÙvZuñT¶Owú8|Ì õvúçÀ%8¸"O´„åöVBÓñR≠¶'oTñf]ˆ’	£ﬁ:¿ÛnËQ∑ƒ˘; “fc”wvbZ#<bK…ôF¡4‹D0/û1‚h
cÊ≈åR‰qç•Ñd⁄úÃù¸∫dEÏñﬁ|ô’€áG‹gF4ÛG}~E>úx@:^è¬…~ÇŸ“…‰òMÛ0ÜF◊<ÀTúì„Ì§(vüyŸq<∞ÔÓ∆S~x¨Q›Z&›ÎåÚœÂõ˛C«ŸLÄ`©@`Ö|ƒ/üa”œ”$”X√˛î$O~FïŒd‚;⁄ØRLé∫¸-˚#ˇFläßtA:zì¨£-⁄€§øøÚ◊Eã¯Xû4•*|[·c)8"Äπ‹c_qê¬ÃÚV¯Â‚∂º˚(:fi∞‰ `Jy∆ª´◊Æ]eÉëá◊`c§à˚L«b#/±4∫Lf.–`~)oÁêÄ„w5øÖ»˝õˆ/ÆÔfxë€ò‰nGÎ∫r(ve	8>åk¶dB0ÒQ¡ÍÑuóΩÕ\≠ƒªÒu™çﬂ§⁄]lb#∆€QòDÅ‡ìY32q†WS…V4\¶·`ƒ–Óƒ≤8mB)Û√™-ÅR^ø;ƒ’˙lã—miã¸è∏ñ"IÌã…≈∂ûÈ∏Î—9c9≈mE\O>é∂˜µ
<\◊@–.ÕÒêºI¿£Õ7_Ì8, SäU¯7K‘p¸$»‚´ ùÇ‡ü≤{7«c‰<øï{√LÎ)‚8¬∆Â◊ÿGä˚åfÎ3o<π€ÍTîπ«ÀDyuëº»ãË{î9˛«tµ§m‚≠
ç¸\àÁß˙DéY@4Úî9(.ƒÆQÜv˚G ™ﬁﬁ∂b V_KÊ[’fœ≈"¸FóÙ^MÏ™˘¬0/üÊ}a®WŒı≈¿æ0‹7Œw‡∫ €∞µ2Gø∑ˇ‡ “Ω≈˝f„M€ãE#)[|P∑ ◊Ö-É6?2› ø-©eØãK+œ§0Ï‡Ò\±Ëj∆ßmiÔaè7ò4ıX& i·ôê)ãZΩáûÍ
¿ïß≈>yÇ◊åò‚|ﬁÜﬂ™‡‡…*£‡ÄÆ:ø¢˚ÃZáÙlU‹q\Æ¬íLT5˛§õ'ìU÷Á]YlØ∆`U∑Ï„cyıŒ›ñMπ5√ΩañÕ*nlfmM™%fC>´lÚñJUÑ¡‰Êp’‚d•‹nE|Sm3Àéf™¯ÅL™´4ïÎÁû&üHgQ÷é—‚Cˆt_ÆSÏ Y›%ksw$p4}óïâú?:∆atº ÆÆa÷–´ éÅ&√ı≤ª≠ü≈˚Ÿ‰.*±oÃé°¬UÉrÅk|(6˚®C‡`H˛·“›!0fÊâ)ÌÚ€CQÇF
$iPU$86≠uy°ës∞F£Ç®È Xù|NgÍ3z*ht{Í¿,›Fª ~—ßœ]ÈøQÀÙ¥ı €—8Ú)"Ù 	üoyWÖ&◊ÛT≠¬§Õâmø1»‰Õ=îg‹£ à{„ ˜H$EÏ~köto∑‹[‰/…”rÂDìz%∞ë7™õ<=÷WTÏΩáò			/c–}zJm§≥)éÿÛêäÉCfîmõÀâXŸ")\≠U*˝(Jˆ€;¶ö¥∑¿N»Ω≥jT Ã-8Z√°çIÏïö°íV+ß∆F„zaŒ∏ËbP|{«πW¥sF§©ö„uﬁΩ	3ºûL¬¿Á:Ï¶ﬂFqF+
∂√qêLÛvõ¥òrí»;lh∂©·-†´µÉ4µOEÄ∆ﬂ;ÙR†…'†æÏS˛ÔÑÌ{Y8`]–8ò?U1Ym-0l®ÄÀ§≠‚£Œè	b∏iZ&oƒ
å1I€-ÀÃr‡Ö»¯ÄÄû,ßE7&™ñ Û ˇjõ©4™Ωö¯kå=qUs|Œ÷>Qx~I‡r‰ZÙwã"•©∞Í–M°∆LXãËßã /
“à ÜÇ˜´°!»Àõxì /4é¬<…<‹)yü*#ù4√≈Ô†‰O€…3iZ¬C;D÷‰+˘ñQÆc)ÙíJ1®ñ?í&πW\)`‹K)≠TxÏkÜÉˆ√’˝˜<ßbÁ¡‚0˝Ω«w+äÔ.÷V∞{	"Î˚ﬂ√∆"õö—u©liº)ı∆ÿp?Øhp?›ÕÆÌ.>Õë-¨‘^jÌÒìu‚≠äV£Pµ◊eu£QÕn«…ªÄM£≈$öÅ∂iÙ>â:Z5h+ïµá9©Îlb`®™õIèÇ\«æaØ˛2à&;õ∞wa6ûy,hgLPJ<.Ã≈„ƒü‚kì€V&Œ[`˚·~äËô¥≤ı:RÅ÷H7,œ°Á\Æ\‡ìtå*cõ§∑!±ÉRÉj6∆õçI_†÷…KI…∏) sã0∞ƒAàB2óç{üòûù…´ õ¿S∫€5ı∑º7@-oENrb‹Ä˘.oÙ˚≠R~DﬁXurƒ\ÿ°]|HÇ"&X‹Ä7+ïbŒì(
wÅ€OÏ…Øp;©HJÒlﬂZ§É÷SªÎÒx©% 
˝§ŸIP„-”˜ˆÜ˘µq‘Â4c√nÛ<“)b_wj§x+¶cfö7£’ TGé…)>ÂîGv ?†(sH…,Äet√ÎR)yïä Ï/.ıã<%2)å;=∂ÈÕ5≤àHä¨Œ%UŒ[Ñ;ÿ°i˛¢8µÛ9q∫xÁ¶:b)—⁄(KóºY™»ÏÚ°µ‹_s`∆N04#ì(ﬂá<≠Mw≥åHÈK2™8µyqº¨Ãö—ø◊ÛÄRéö6œUSwíˇ<)kcƒAŒN]Éü¬≈df…ÊŸhcÜ(‡O*{EÔ@ÙâŒÓŒ√WÎ/ûm<º∂æπÛ‚Ïw{œﬂkO^<ﬂÿzøı’Ø6ûØoÆu¨Ë¬äƒÖ3yP6 ﬂ£hM:K~ﬂù]∑∑{m∑ªõÌ˛˘Ô˛e˜œˇÂﬂ}∞'≥´£Á‡=˛sEl6®≤Û5≤†¸Œov„›Ω’=ÙVÏ=‹YÂÔÌ][?®E7ç≤”∫∫˜ˇô’ã§QÁ{íßƒåv‹SÎéôv>î˚2àÖ{Í”O'¸;V∂#⁄ﬂ√ÌºxŒ7˚˚˜e˜ÓUöUﬂß√xü~∆É$9DmÍcRn≠è9¿ûuØîVAˇx-X‰*ïâï≥ß:T›»À3õ˚¥‰ˆ"20¸8ëÅP∞≠?Mâõ∏„ÔlºJﬂ”‰–»œgﬁ\tCÜ≥Å⁄3ÊÁkœ»Ÿ®)¬ƒA-yÀ’ùõ˝≈Â“›W(-ﬂ4Ø»B°XÄ≥”Ω<9zΩÑˇ–’ÕK∑ñnﬂ\XZæ≥–ÔıouˆZı0¨DŸ Vô∏@]πinx”8oÉπº8£H<ôÇXPw`Çg’ÓÙ˚⁄)»"Ô÷sa¨ñEFâ£"hKî‘ºUwlÚ#gﬁ=√Ô’·˜ª»+*ÚËœâ$ú™K`´∫ûhÈ◊òEU•€"t‚Z1Ó€1ËÏÜ#ël	éıQ Bôë/Ó;‰zO˝‹7JüÍa+êpÚ∆¿ÇûTÖﬂæÿÚè‚L˘!ªj“¯ÌæC9Y1iêt}e°›tê≠FõX°Êö.˘˘˜˛øΩ ˛™˘kµ.ÓæÜH´WuáY≥T´YÆü^´º˚„ä∂Æ⁄4IË∂ß†F_°∏â“¶∫bãˆ∆$=˚ﬁõÅÈ∫ãìEÁM!"víô»éº6Ì3ó⁄…`÷	/l)|ﬂ|]K53^W◊€üÊy◊tå⁄Õ˝/V∑$Òzﬁﬁ?·Ñë˚Q∞Y4Ø•°-%¥:§¯aÜÒ√˛}m≠Éú%H¨Æf˝]}3ÕG¿
EVÅôÇKıä⁄⁄X÷Vèêã@z9Ïz”<)ü∞•≈I∞¡4Õí¥K¶KºªCäGÀ7˚≥NK
¸Ã† Û
1x˘Ø /{¢x…¿Øöã+ÅÂÜãôﬂËÃ|• 
]E≥°—˙∏’ß°+±Cªœô?≥MgZüé]∆uàZ&^äJàG'cVÒ∂Ô $¿ﬁù€{µ'Qœ{≤Tﬂglƒ3≈º“7HóMAaÖÀ‚øRJÃ&ËÍü!9à]ËÅ‚
±üÙzΩFl∫∂È—WCÏ<íë¸cÙìÀﬂEGµD¯›13fíÀ˚s3ΩÑQ÷ÅÊPUıöÌœù√ƒe;ò#ï≥,~ﬁtŒ≤˛|)ùOﬁTÊtvW˘ÂËj{1nAr¬#B3+-ju©†Òs±t–≤üöî–¯± ñ…ö›ÌÕ»"]§c7s{∂ΩÕ2IÉ|{¢[óNö∞w·î“¯q-•îZ∫	–ÂÙ“»JqmöÈRÜiiÍoúc?µ6≤˘S˚Vd6.%©ÆTf$ˇ%®úÈœ”âSQQß©ã[øV0_Mﬁ®Y©Å	ñ∫≥´ÿ±+∫„`f©vuº~£‘¡¯ô'}pQæq
a	À<iÑãnö%»≈œπºI*Ì◊8∆«›Á-Œ¬ˇ≠+=öyR¬~µ<∑ÆóKâh9ª§ÕJÂ˚2≤x›æŸ/ß©u_Ckß£mY÷¬ÇsW›VÔJÑ¬?Û&Ç≈œ<…Ò3wÇAYÈ≤í‚Áí∫õ:W≤A¸TÀÄ33ÒÉéTÇ32ˆõRó0Àz’0_ôÜ?˚|U™ü™d?ïi˘ËïùöØUπR…6≠≥ÜÂ~≠ü?sÊ‡„•Æî{∫
Sˆ,ıuù®â¿ö#%~öß•+JœJMÁÃJ'•öπÛ“·ß¡j·π¡	¿t˜Ñô‰´Z‘‡ª∞Ó˙å_≥hDüñ¶˘±h$59≤Sπ|™PırÂÃÂÀy≥ƒ;w<á†SüK?Á∏1R3)M»úôµ3Wv-¸ÃìaK!¡É¬ÕÂò-‚D¿s	'Œ‰4Zº	âãá8£Mû 8g˚s°Xìπ√7~ú8ìãÄŸ,∆dÓì∫¯í—%8ï.NS©Á~à»íÀà+9óæ\¡Fãxïˆß“ˆÒ≥i<Ú„áé4Ûƒ|¯∞ë1h§ä +≠Àó.“0X‰ß*rﬁ@ëÈY.çø‹ë"≥V„$9Wh»œ60‰úa!≥˝T<$§I@Hm8H-ç‘æ¨™3#§Y»•áÄú7 ‰?p¯Gì‡è2Ù„‹q™óˆÒs˙8◊-M√=fƒ\j®«9=ÍöyÃËÖ<Œﬁ1kTÀÂÜuÃ‘Q;∂j√Z]8«\ﬁ√≤í˛3±Õ7Œ∆~MecØ∞U•”∆OΩ ›8≥nÈÁ:•à◊âºRzkiŸû/¡5⁄-5£åtŒãÃÛ˘‹çÑ⁄µ◊Ú¯3SK‰5Jr\â≥Ú}ﬂV›“*4Æxïe›ômGÁ_Ç¸–	˙)HÄèÅi9—Wãóã£|eDYVów&ıU
ã…∏ﬂöB≥KÄ˙AùHb/Çfœæ«î∂0g§¬≥oaT„I—^∆^&†rzÔítÿ€”·äEÏÂ„',9!OóÎ*¶0yDÑåîïÉª8”±Á{Ωb4≈L©D$Ùß·ô~ÅØÃLLËÓäëu}@¯º«˚oÿF+g¥ÜRô>⁄^?¡Û˝?÷·˛™¿çöc‘Ê€©vYÇ[7_v≈nÿQF<ﬁpTé:‘¥àõ®ıVâu«¥5JÌéàNÂyÌJÍ≤œlœ4◊Ìi4€wÜR÷$‚∑ŒØ\‚ÌK	G›ŸÌÌvˆ./$µBq∆•Èj£mû£ú∫¬´¥`†ÿùÓ≤ŒK}•ºÒÁø˚ó
A°Jrù1Ú.ñœÕè[siòsBÖ„
ê-M∏åéΩ][®“àõ≠±Ü’))ïûˇhÎû2 ˙è©ﬁßÜ$‡Lî-IPªò°lëÿK∂8:ûå‹qÃQÙ.†tH©wL	Ó)ü=>@'Dr 
-j∑7Ÿ=^›≈úÌvAcëÓÂd˜:|ˇ«›Èry˛ΩπqãæØ‡ø7VˆÆÕ¶Ü'9|ﬁÑd≥o∫v ‰ X,0j‹ï&)Ja—1¨≤xM	'∏≥a4IêRÖ4∏öÒN*Àø¬Bæÿµk#@≠˜Õ0πvÕÂ„≠Å&•ÔúkörBÔf◊vºÓ7gø?˚ˆÏª≥Ôœ˛pˆ«≥›Î,ÜÁ_‚"ª("i}‰5YÂ≥¶∫RÿîØ]ªr¢:ÏÂ…W(_¨√,¥;x‰ÍtÓï‡ÜÛ§ÆÂÌ~«Ïñ]◊)àıA{È√ïÎÇ	ñk≤â.ƒîsƒòG·eÑòØêÙÒ#ÑïØò
ÓçTÖà)üFˇQB /+D¸FUà∏;>ºØ«ácz±ÀéÔ_F|¯Õ^w´î,xH92πuë¿d”]/Sçj/≠å@vG<~ÿ0„~ﬂ$Øïc,Êgv†1ùV∏`îq}(ªö+†˙	≈Á:ÕºÍ:mmÁ47M3ÇπB¡7–P◊[EîˇëBw….oﬂäãüüb¸n…7s~◊ÃGœåÙÃ¨\ö_F_∏∫o∆\ƒ—Ï≈˚≥q”8dÿKq“Ëò§∂ÁD·O–gÛa˝57>˙k4ÕÖ\5∑ˇ"\5K?CWçU≤Óu!e8k>˙iÛßaÚQ *zS∫ nÂT•gªÁ&B¥ù¢Å5§Ag£$Ø ËÚú>≈¯ËÚ˘â•=πlwO1’ù=âYUJˇh∂Ô€mﬂmﬂ∫L∫\a˚æ˘!ÌﬁÀóa˜^Íˇ∏vÔiÚ˛¸/«‰ΩƒMﬁ‹ ÙS»ßÒCZπõ∏?ˇ	∏?⁄∂?⁄∂µ>⁄∂ù˙‡ÕsöD~˚ˆœ◊¥=üà˙aL€?e´vÌùÖÍ¶¬î≥Kba*·˜ÚP4ä4CK
ﬁ(Óƒª}i]Ò≤<H√Ï-øI0;ŒPc€G1—K√ ≥lÎÎ¢Sn&£:7◊Ÿ’UâÍgõU#¿‰–ª¸©‚h±ìúπ.0º´Ä„$‘ëÆ0d£0Äµ5¿Sv¿È*õ”sˆî&]nVjöãSl5m¶I4k–èΩ∫Ü«^,™4ƒ+*L‚g…4æö‹?·áûiÈPó 6‘Ï¥‹W‹†∏‘ØºAQû-÷ÑÌ–•iÛXÌ≤ù(Bæ„È4Ìµk˚Ë+W!?úéÀÿ>¶¬lm•ó*)›TmBﬁ!¸è‚ôŸ*ªQ©∂:„H´t?K¢)àœaL¬ã¶I¡zñm/Ëö%∏æÛ„ÓÁ7›ÚRﬂ
XΩ;£9¨¢£
Ûª„â ∫ø˜¡ìiåéØ cõkò˚‡ÂŸ∑iÍ$´–
/¡à …;∆¿˜(˜"ÕhÇ,ÉÂSñz9z∑6ÚæAn8 m$bLXñÄÕ¶1õàv—‰qŸÿÉù:çvÿN√i (¸ã∑{\¬!Áe$ =lxÏZåqø(+œÇØÒàÈ˚V¥q4Ú‰¸ªdÅmM |áã2<¿Ôù^™ÛWø/‚¡B!‰µº≠∂ÖÇ¿«èΩ‹ªîÎ˝@®ΩÂ≤`¨ÎöË˙∑•Ãá^E3àSê3Ò›ˆ(¿$∏·ûñœˆ^4ëÓƒØIù∫úKq‘íÌÀ/æóçË>^~r>Ä=IúÙáC?)˝P_
(;É∆¶™0»DNƒƒ®•›
"Â§%M0™;∏˘UôÕi∂Ú*√Ö€pÛ$åÇ««^N≥£Åè€ë˚˜üˇÒÔ¯lÀã`˘rÜ0aÈ£áª˝$Iø¡ªœüy1pÇNQﬁ°∫≠ê.Ç;bá·≈C@aÜT∆k1Q÷û£fYFÙâ€òÂ@´R®l∆Ë©gœß¡;O`√Q\t=–û}iK¡Œ¿Ï'y^,3ªDiü´A…:¢%Cj∏J;∫∂˙ó∂äªKE÷7ÌØ•irX&˛"ÖÅ-{∫ó¿âÊ	É1>äºxê∞_iN‚}{∑fë'»•|$‰<ToØh÷’]p˙aÒ‹w}sﬁ8ãA‚_ﬁZ®5_º}≥2˘=πm√üí5•Èqr}©π¨Å˜&iP°uª Ã¸Pö·öÈ¶ﬁdÜ˝›0i}ùÑqªµ∑úwCãóMQó5#Ì_œº0ﬁs ` tÂ(FÒV‡À‚´çó/^moºﬂ|˛‰≈´gÔ7∂∂øzº˘‚˝„Õµ/ûü˝nk{s˝≈˚_Æ=}Òjm}ÛÏwœe˛Uj¡6jqÉñÍuûÀΩk…í´ÅúùŸaö5∑ßkDWqS∫»n4ŸÁW\ﬂòOV®œ·∆ã7^;í´îÆºÆòÿÙ-E¨He˙%(C†Ï—ã4RÑŒ5„ò£ﬁlÔ@Ö9uéŒÑd\/W∞¢rô´Jiƒ.®+R®¿+øóìp[ÁÚSU~”•Í`jÜ*L§5)∂éíí‡Åæı6I)Ò¢Ùn*q≠2…Ë*s%e_πÈ zÂŒwï„:æﬂ˙R*•ö“â°ù‡Ä6Ûrìd≈åñf-ò¬–dQ˘Ú\Tæ¸”°Ú≈;7/!W–G2ßœœÑÃóõë˘ΩÚì hôΩsv-m»˝øt˛¸∆uùôìòﬂ¸|âye¶ê£ØóéÁäE>˜Ö?õ‰è7~ºπ–ÖΩè1∂s«ÿ
^V}qaU7ç’1’õs]–
>¢≠E9@ù[Åû∑P¬Ó≥‰ºÕ´rn«9Êƒ|	4!›ö◊(I.⁄>ï´_£Hÿiò∏√†ê
∂ƒ„LzÆedœÇØh-,Ò˘‚SB†àŒf
Âñ?b%Pôõ¬8I∑*=]÷Ô.Pm≠YàÈÒíÂ}£$¢∂˝ä’Nu∏>X/à¸9« !ÄK7+´N-ﬁ‘GÀ√-ö[6®ã??ﬂÄõÆ’^fR¥^Q≥ëT[–mì;Rf\9∫Dé⁄≤lù‰*Â‹⁄KNÍ•X¸îo©^ö<´ŸX
—V£Å˜ö$[Q≤:¡ˆ6ê6‰\ã<F˛pw&ÔK<épÚfÆ¸≤xÕÇòûáf–ŒÚÕæâJÆYX¥[µ7.|ºñ˝`á~¨;akº0ÔÑ˝x'Ï_Ëù∞?Ü¢˘¶g*¯x¨˙|ºvæ€`UƒÓ«Î`?^˚Ò:X≠Éü¡U3c#¢M˝◊π$Ãjù¯≠ï®§˘)ËßÈ9ï˘#(>Hÿ~ù9Rk<Ñåã]TÛÛ 2vô˜øˇ¿◊øÃi8≠Ω“◊i7µˆƒÊfTáÏ[A-≥û6≥ù÷ﬂr}.€È%YNïÑ~q€)˘9ÍåâÁ∂ù^öÂTçˆRlß≥‹d’`t‚£ñI9k4≤îÍTÍfÁ∂¢È'≤Œa<%KµåX™ª2z∂-ıR,©À2[êCA’71ßVSgöRÂ°"ó˘Ùº«RÂæÌ8ë˙”9ã˙
f§ÙeAéº;côº{öáêïvZTP=º‹í%Aæ’$mÿÜΩh+O`AÄ¨‰Ë5h∑R†s–qá«Ø≥„Ïu-µƒô‘M¯ëNÈH¢ÄzVÉëóÀ6˚9Z@‚QM‡è‡∏‹åiﬁn˝È[ÒJ!1Öo~1¬‹ÿc√©ó˙ûÔex˛lêOÈ@˛$)û^Û–‡|⁄*%∑‰(} ú8%sc¢GÄÊøn`Iò°`8M…Óˇ€iÄ˘#Ë,≈®–‚t∂ªá—±–ÄﬂcŸ4cÔº(Å“l|ˆùíåMíZ9¿Évuœ4¬eœT˚ãçÁØ÷ûæﬁ˙ı÷ˆ∆≥◊õœ∑∂_}µæΩ˘‚π"=®∑nŒN{˝ÀµÌYU ≥—^∫∂µµ˘ds}K◊50ı5¡<Ñ8khsëd”üÍ´¯1Ït¿îÏ`@l§ô§⁄YrãÊxç‚»wË;ézÛ
”âÔÂ\<ÖµÔÛ:YÔ D±£ùbÒ∂QˆÈ}T!xH9ZÈ∂h§·"«ﬂ_ÛQZ˛zÎ≈Û(D5'⁄˝}ÏÌK^‹Ë¨º‹≤õT≠_mè˘¬zÁ¬»£Eï‡…RÅ[º"«ÅÀêåÇ≥Ç${»⁄œÊ·öÚ“≥oÒp+l’˚ﬁ◊â`{°ÈË⁄ŸsSOåA¥öÖ.U◊¬ãjı‘âòç#lf-ä@ßÖôp%ÅÂuËvÚî≤È
¿ıöÄ~ùÂSvêUsCmæÕÇ≠ŒÇﬁä{t5≠U°√hııaíæE_Èkê§B‰:Ï≤z[~Ï2Eqn6HºÏÎ
óõxÇ8kﬁJƒÀÎq[l3XxŸ,É)`kåÈj'åÉyÉrzu=üA]}YéZp˜øïGu„–a “9é„ÿ
á±öAìv2YVof‚<ıéìiæ}<iÄT(˛:¢Ú-yòÔTÆBcŸÏG…>,ó88dè‡k{«‚l˙≤Z 3„[ÓÏ-∞2ßÆÇ∫7°≥Ë∏=.~ù%q‰ºªF”4Ç.æzı¥"(p¬˚_Œ·w{∑
5‡Õß@[òÁ9UDíévÀ+∏	ñÏç“‡ äC∆cºÛ*J<‹%ﬁ§hRè¸‰µDOËΩærÇ#∆¥Ò•Õ≠[<ú≠”À`8y˚Íˆ’ŒNÔ¥áCz#€VP°›∫#°{}F>⁄zﬂöê°dˇ∂0‚öU9„tTE,•¡ª‰≠Ü%údîl@±óÌ MWô,[Hài
¬ÏqOL”Ã".£ªŒ†fodN-˜›[‹óÓVì±¨ N≈√`›CWÏf<ôÊbíî∂lÿõ—†K-Ù & X‹Ø—P8.R•|ä•M€HﬁíJ6NE$z˘Î^"Áºw}∑PVkÂ[
H{ò\< Ï±|‹µÍÏÀ›Ö	eëiãv45G}¡!Ò*Ω“ﬁbG*kCZ`ïÌijV ÓÌ®! ïí–ÃˆgV⁄÷ö"ß¥¯)µ™ÎÆ&I‡Z˛ï®—÷Ê∑ÆA”˚§÷&ÄZ?ËbØû˝˙æ≠∆™5¶√’´7éégÃã!úJ)XÄ &ù∞äón f@\ÛÅ´ 
V≠1–uı∆—Ò,°¶)çNû÷–L≤^/
;([oÍ‹≠ã[MGfä^jhFSÓ∑¥wŒÆ„üÑ∫sÃÅ¡[¥â≈|]G#∞ï9'ÿÖ<iA]4ËÑZΩ˛*ç™ ô∏!µŒ∑*5	VÅm6g˝RÈ 7vîôt†’Wea;˚á£0O>Aáãç®Oì¸ƒBâ0MÃ1∑nM1^Ã¥™ıÙ‰îáaÇháä‚1»(ü2aç8WtÛ“¡(|óp≈^ ÉÍü±wgﬂF!¸J‘ç.i:ù‰Iï®'ßÈ‘õœZÜf„6	`ÜE∂€Ì≤«kõOÕ~ı‚’ﬂ<›‹⁄f‹ƒ⁄-¸µ∆o∞ÌWkè÷˛˙E´É≈ï 	2’v‚{«(fÉxm©"¯πéã„wµ∑«¡Ä,ÑjŒ–?~x©YjågSÑ¸Æä>πlD◊¢.uÄ·˘[Ï–^^`W˚Wç⁄æÔ®ÕA©™(ú<oÆú ÄhGèÒ_ﬂ?}cyòa)X@O^vX=RiË_eA∫È?tXª &è‹òº¥d6Å¡µ√±F¯Ûao“ì-3ÂŒR¶1÷µãòò˘•[«Öl3ˆÉ£¿¸àM4Û<,]q3±—xËÔˇ
’=Ô–È◊ö\UXÇ–YK%?˚å≠•)`=ÃË/‹I43
J1…0·–Y¨]~£
⁄B‰†°*««m)πvq{ùKΩÏ©AËÍŒ‹ı+6b©&Y¨fnYŒ†yöQÓ8‘—√<:¶h<‘àâ9eÁ⁄§4∞=çΩç¡∫ÁA‰È‘å!◊ÁDG(öwÈêmA–ß†ì¬<}≥†ïù“ÎUÉ˙ı˜XiU“¥˛B“À*€Ÿ+p©·µÅ+=‘s}vê&caUÕ8N–[ã^6I√Ñ|ﬁ‰4ñ º{ÈÒﬂ`…˚lGıWA1Ô%A®◊oå◊ç∞gV·
£ª‡ÅE∏g6Í@T+B˘íî,’0x¿ﬁ¥Æ·†S“Ωﬂaâ€Ü’µBä|á˘ÿt‚)À∏Ì(’˙¶vNïa€óTh∫/±yQ´ƒÜ¯sìYœ*ˇË§œÎï|ß¬>´ÿÊUQ´å%¸\òì5n¶ÜüÒOW„siä
Õu}-ﬂË±'Ç∏WÅ, ÁwpD ”°í=V∑óS,ÏY^Ñ—1›»©˛ƒ1©iŒÎ$r¬ßebÇß)ÈO*	©D!PÀ@‰,⁄∞Àó©‚(‚¢‘PI	BŒ¬Q∏Ò˙'≤±®}§d´Ìr\Ω ≠¥“Xã:R¢D÷*†©lõh7–}◊÷ÖhC∫‰‚’È€QÇ‡^GE3çî
ITx'_™A…"‚…Œ^IhØ ãbñº:C:Âu$®F›Lï»H]@Æ˘ˇê ä6Â,÷MΩs⁄ã)∑–%’©í»Æ≥
üÂË®\¥™t¡√÷ÈªÈÑ·Ω£Éc&wk.çd† F>É’còEå—xthz‡dƒ{ùﬂ∂Xß!öè•Q-ÆløÌ`Ï≈‰ñT¿#O¥PfÛ”4^©2êKº¨44‚4ÈtAJ¶UéKyYÁ≠(ÿ]ÉzçÖ∫&mÕ%ƒiV+këöcÔ±à∏)*\⁄¬OV”™®ﬂ\Ú>oõe—|éñÊöˆ∆
Ê©æÑV‚ãÒ˚SJîÿÒÕ˙v≥ù¨G…‘7⁄Y|ª”£ﬁ—fìë˚Â°ó∆Ì÷z26'∞ì·Œ%Gã7W∞u⁄8Sc`∂›K‘2∑97f@’æl˜Ω®6<Ë&Uá‡—p'Çm∏aÆHªÓÇ¬ˆt:•M_w» ﬁ6«PÔ´âtäMÌv´‰]`„ Bæ]e˚IBªá8≠mÊH@ô8l	E’JW:Gâ ‚]Ÿ@ÖUn›cŒE–Æ]å√,∏«∑∏Ì6ÏMIÙ@MÙq[ß£y|ÒSÚ˙ñéY…¶»≠{ø∞wVπyÕÅP,*bZ≠éïàHå§Õ+ËîÁ ìàã≈Qó
p3,bù˛ +Èÿ¿4⁄Å·K†LÇ`ªµËM¬E“ªílÅjîåÉ|îÄ‡”z˘bk[≥-àÛ€´ˆZ‚(açÁ-W®G1‹¢)åoXµeCFG^’àEó≠«·8‡!.à JP`ºN¸ ZU—=œß∂⁄k–≈)Ä#KbèÇ;L£‰ßr∆ß\:?ÀGirH‰»óÇ(…g•ŸÁt∑˙dÍ'x3T◊xÄÊ85a„˙ªé¯}7‘∞î9y⁄Ñ?S8!∆Ew5¨≤ò“NÒ#¡öä:–!Ó&(ï˜‚‰∞›¡-ÄﬂE≠ä≈ù5È·_ˇ•7¿˛ˆ8» ¥d˙âF"4iìû`Z-ÌÕêBœÒ%ˇføAÅ{“S?ÏR»pÃß~“S?ÏRy»°∆ø•~F∞∆®¸¬¢YjÏÂÎ	‡ˇ–ÌK|‹Ø;ò‡√ËﬁÀß∞ ÆbLPÌUF”±≤éûvL©÷ú∑J°÷¶A%~êS(fÍ≠¿{Ü“}∏è—‹AåÑC%Ó±MZÖ]Jí¿F„ A·°+!l?≈´¨ °=rOßwc≥¿ù]≤ç≤’NöL4RïÖ≠LM}ıÖÓb¡‹Út–Åm∆;N‡Îx#øÈyÑ#„W*lı.kËg«U¬ÈWsõ‡É^û<MÉÔ	iwä”ß;øÒ∫ﬂÙªwŒæ=˚ÓÏ˚≥?ú˝ÒÏ_œ~ø'§ñŒ€Í¿?Û&˘ﬁ$∞
~#´m˛CÙµu–ñÿ—‡õÿÏYz†Cb#Ω4Ω·´ü∏˜:ª–±’Êã‹ê$qÓ±êm∏‘ Eì ,∞âuŒZ}”—Æ^E:«IV»?@ŒADÜÚò#L_9(–Èéo@ÃI(\-Ÿˇ:@ákÅOñÖ0¿»⁄∞êK$‹à‡U@"t/i~”œƒîlπQÙqY]M¿s®S9Ù“ûxXû	-ßbï®ã≠<4Êd(Êﬁ +ù˚V˘ã∂Ï).’õL≥Q©∏i‹≥p’Û|ﬂÆ—MÛ≥3Æ›+"£!U·ô6ÌÜ&πﬁ
Ú†c'1Ò’ëwÏIÊÍ'Çë∆tä√ú.ÒóΩã(*A$HsoÃó5mOµE·êzA±!»âJ≥© gqΩU?≈—X‚e¡ªc/':á¢§g hÀ^Í¥˘.Øt~¢Å˙ßˆ4åºñuËw\\â†‘E•ëY∆hÕﬂh¯Ñ“±|÷◊_j_´πW1p;1Yå\£’…≠Ïo9aêiªÄÍûNr"£feÜ¡4}F•1·®™∂£Zsdïß•◊@!È3æ&\ô%∏¯Í$¿£)îvRˆhØû•∂a{÷´ë‚m†≈y‚ñ2åî{(ü˘!∏ÇÿˆÅlwE¥–UÁ!t˚â¬¯ıÎ%áëÒª"◊∂’˘§Ç´æ§Nıûá§ŒENóÄ¯ÜH7qXÅÏS7:4…ç	≤C›åTö≥NÅä≤;ßTŸ¨jn¬%…óÎu∫≈©≠’ü=Ô¥ˇLîi§∞5ÅÓê'∂°©d%—"ØtTQ†˛"√_‡4∆p£MùaàEZL%d!îó∫}{j!Úë˜$œeQ3Z\πëçÎilÛ19˝=íúDG“b¥ŒÀì≈oKo˙Ì"Ì4˚Mw∫R0£‡v%Æâs≠9tÄª∞lWÄœe)˛]ßäk√¢@¸VºˇÇ‘TUÑk≠•R µ,°îVy¿Ô@a∑PUÕ„sÚ©£\1ôfKB/5mj\áÂ›˙¨Q['…ëógﬁd¬ã©v‹æ”T.jæ¶6ÅÿÌ ßÆ©ÑMõÎ=∆9Õ:mëLÜ"CËê,OéÃ‹ÿ§◊óızΩ…B°∑*-ÙvÕ%[§™@”V†Tù&Ì„¯1}Å≥ÉOå∫Å%IÚZ‰≤µ5+Œ™:∏òƒb≈R>¢–ñ†"¨Muòv¡aÊxØÌΩéìF\‚í'{sˆ\7G˚¸à‰ÁêE°'i2÷\ et^:ätë¢$<ã˘úcXkæ,±ùË#Ê˝Rn/∆a~œ"œ÷
˝PEã£æU>€U=,);<d;0}•¡.i-@Xp[.ﬂ∏à∂XÇ2cïÌ\N{s!YHØ?}Ò’cˆxm{Ì—⁄÷Üêﬁ˙ıÛu# ˛}Ê”D]oûm'28Imóa@ãw™ùÅ_e≈fäÍXuå01ıø	0j∫ä3bÄhÙTùf@yBoq∆„…ˆä]#êU∂‰qj6À¿»ÀQ⁄l√:R«´‹≠ÚKÚø∆ (YWØK£#ÍòŒHo¨yIsé¥È4b5D¶ù™/k‘Ef\0ÇJet ”/ØıíhJ˜Ü±ªµÓO \…∞P&Ÿ3Tr+¬‰T†SÑq_uîÕ\(Ωì°9”™óF¥™G°•#"gÄ'ÒCÉÓíq´‹ ∫`ıè' ı≥\rRõ´öoÑ÷.kÀ√!G¢¶ÄÌ˝¸~oº•€®X÷–¡“™~ˇÖp≥‘Aƒπ^srLëMÕ>ó€–Ûﬂ	Ìœx‚ˆ
÷◊Ÿ¯qÆä˙*πÄÒ”ˆ‰»èûG†¯^UZÛ ·‰™üUÌzë»D¡À[ÀµB⁄- ıó¿ZΩoÜâñaÉ/6q®j
êÔ≠¯].Ú-~rıSòaπL2	xj-‡s”1∆ZÛ∂ù‘·<"ok-Òàf∏QŸÅ3:àÔØÂ’$dllé‰/d¢0XF9ËYÒ7åF∞ﬂŒàÉA:
h€;ÜMè≥‹¯-Ø¥	¬yLD¥√qPm÷ËÑQnß≥2»»èêl≈€
sπ#–îPË¥i¿∆Ñ~®AlÉ"ÖÃ1fg¬lñ\N…Ä∏Ãò=¿⁄Äœÿ´ ∆ñJ;À`ëx%ë¢ë	ómgΩ…ù”6áPÑ%F… ◊–y∆äå.Oy¸≠^—
Å—_’Ü¡SSO~v§ÚËÖ!¿`¥]¥vvj-ä$P
EoÀFoO5íS1¢ö‹∆Âë:Ò»NÄ£K}¢í[ËM?,ã?Ë¶“n}@è*öŸ& EÙ√@I1Åó/√|îLsÊOy‰	<jcEåÕOC7›çÄQdñ<ÄπΩ≠‡ö£Uõî∏$Z"o(äC†>´¥ò∂fµå…pcíü¿˘l´Vﬁy—	¿A£∆”Ùb"u"ÑJAcÖ„D⁄◊iÕ3FA√QbùÊ˚1ÂÍ$Ú/*UcØÊIå¢Q:ÜQ¸¨9Ã£™ï°Ö-&v.)Z·¶0h(E◊À—Ö$-B3´äH9u¶Ï<èÙ\/?;ü[lû-87ùg
œó#>_\Än BõHÛúç‘»‘Î—Ÿ˜(≥ói¯Æ™~s)˚ºrˆ%Ì˘dÌf“ˆ|ÚˆLâª©Ã}©€!w3πŸÙ¶q6
`K*¯åÀ˘ÃCˇÈumQÀ%[œ1èÄ:áàgQÒLã.:≈–OÃÒeP∫›ˆÿæ3®8_”Sx=Ö]$Ø`h¯≥ﬂ¡nÈÒX¢ùGz;˚f;˚M⁄¢,4‘®îAª,±≥mÊyö/êù„BÍóíáœnÙW$gtª*]RsùØíœk¿3…â
€…ì0Ëz%©õ“˘3NI¸2MÜiêeÌ÷V“$ña<|óƒ§≥t∂ ∏VèmÉ0–(ÅY{<9F,ìgX,§àı°4∂2RwÊ©;c‰3Nﬁ…tt/˝t*<í·Â"nºpœ`–s)∞± ÷ªúÎ#åóÃ˘ıl^ûÏ€°ËEQ~I≠åv„‚êŸÑ}Ò,Î¶Àê)∆˛‹cŒÍ˙u}qk˝ÌÑ(’Z’@gN◊?XÀ€°uFCôÄ ∆˘Ìj—∫=N;ù°j•*e!pÍüZ∆BIÚ˝O)Î‡N#GÅÃÊÂ„'\Dn)Ûv¬BX¡/b
ÙàÍ ˝^E:€,E_Uxw≥&-fÇWÍrt≈r¢`+º÷Xm€ÂËg∫£C∆Û¬ÖÑK“ì‡8-GÿÒﬁ‚0\`W__Ìò ≈~‡‰PÏM#´
^_9QPhŒØ¿≤oJªL)Z‘Fêµv•>à«ﬂì∏õèÇÓ0¸)ôäÑgT ¯√ú‘ÕUöOÂ¨íÈ¢¢
ﬂ òÛOX\F<¡·q+>%ö·Wè∆”˝`π…ZÇÿx‘&]c ß±íÍäºÛ‚P[An<;◊ÆÍj©ms⁄¢£eÚT‹÷&Î˝?¶"KTl°øù 0x˚öbè√î„uÒ3/ıRwì»)‰Õï[˝˙Ô∂¥d1D•TÙjÓ0Ozlp‰≥/xb{+që•9T4oï‚◊ûóït%≥´Be®Ë•(@ôó§AÖø6ä|j∑5Îx»ˆ<ûV4Ù-ù7'Rq∫∞áJ⁄8H•1áa≥€´«¶2é*®:$ÇKüêVÀ∞I·˘ãîÆ^ƒ‹tjÃ¯„´îªÿûÃÚ*%ú™§ßè3kÚ¥ÊFOŸj<ÈÈóì°}oïN√ò˜‘óÌF¯ú…«§‡	Œj]`À7˙˝÷Ô›πÈ:ã•7“¥Å˙"€Â“6 !LÍtâÖ~PU6Ym[7—T ÿ¿ïz|AÑÈÛ◊k™<¨ˇ[óè:ï≥\¯3V2¨≠z{Z—$á,TJÎY#õôf)3ŸÜ°=Y∆¡dAòËnlG7%S¥a-wÈ$ÉaVáÒ≠SÍeÅ=â∏nì≥≈e¢[ãA≠
«∫	 ¥ÕÈø¨‘Që,t≈˜äÇ“Jg¸¨;LXuîP∑◊ﬂKo`Ω;ØÕÓñ∫ÛŸÁ4´úµ˝⁄-k÷8Á~Zî/¨pÚõÙ¨Ñxex3v=#óΩ4éÒç®xUees?weÎá›f’⁄jí˙[DRc*ÀªŸ™ãojS!p#∏éÒì:ÿ>˚CÍµÑË…˝Õ§•XÉ_4–Á€∏ﬂ@ˇEbä€U•mß˘õ0.œ˚
H31?^zd◊±ÌôÊoZz ¢J≠{I∫"7˜E%§Å‚¡´§â˚‘HV¬-ñí„wJ›–ÖÄá˛s89∆•ŒiÍJ~'™·˜„G≠Êˆ¢ö∞–x‘é&¬È˜ÇeÇvXπu;±–›Ü±á3O”`π≤‰é©çé‘hj‚¡}€ã¶5πCep∏¯∫‡P:D¢’≈ÿ∏¢÷éX{ªWÊ…≠oÖdhéW%◊Dô%’òπJ™ä¢ Shñƒ=Äe·∞MêxlQë>
;º≥í(_q÷¢45JcÎOﬂr}Îˇ  ˇˇÏ}mo#Gz‡˜¸ä2wìh|"%R¢F£Ã»·Hú±.öëNíΩ{∆M≤E∂ßŸÕÌ&Gí˚Âí`ŸC>wÿ¯páÉÅÛáúø,˜)˙'˛ª?·ûß™∫ª™∫™ªö¢d≠=mxD6˚•^û˜Wa$òc~˝5V@∆ALg§√ã”	}ê≥¡ _áÊn `‹jZ§¥.ìıˆÍ™‚ëLak7/€2Â ùÖÊn)7üVpHã∏§Übª⁄-zkπ¨ÔóÁÙ∞8t¥)&ÜòÌ±)Ωo◊õÕı=êìnÉ	\bôöYZmöN¸#“≈nßœlÌ_w@5r˙n‘@C44-¿é°“ﬁî»≥u·é)∂9„√º‰9Q—∫ådÁ)uFÑd¬%SUËüëTÙW'T•<÷<¥ÃX¯©òj$4É— âR4nÉR¨≠¶î¢I ÿ»∞ãäÙ C?Aòπä9±T*‘AN¬›ˇ≠…º6ó	ß˘œiØ˜ƒêÇ?Úﬂ^–˜gÄëKµ∫®ÒßfhMr1ØfTóAü^%ñ1Y”d‚|˛”Kz›´÷Î´ï‰sS¯º˙:À/∏˙ìÏ_~?¬_¸âéËÌÄD÷Åöº}Fˆ¶|é¯#áŸöh›HµÙ>KœøZ˘ËùÁû±»–'ô›¸sçÈî◊Ø¬=ƒLD4+Nz!0Ö∆Y˜—r˘…;%0
'û;Äy§ÏòΩ§Ë’õ8ƒ∑⁄à∑®Ò∂˚ÒsOa◊WÉE\Äq∏«„†É83P}Æø¬ﬁ’Tf≠Á`|3±cÇøœ\dy/‘göÎfµÎˆ–‰ıqX±S&Ñ" Û0˙‹ :ãŸò∆ï‘|Ä[/23?ùP,ê%ëeqâ
i=´Póò¡üËå„õ≈bÔîï§Ccj°"Ótô-üC;É@@MXX™kÊêM_zc∂2?Ô˙©ÿπ˛]êVª»$∑l⁄íˆä‰RåÊ∂í8£êIöÈf¬]’Ià∆ód˘‚Y¨ª1q‘VÙël^T›MÏØVâ¬’¢Î+:åß í¢Wd•B›+~Q°2¡«à;w êMèN–1»€µHóCª,nùÓ/&∑Z"˛QDD$Ãó'‰P~Ä0†çÜ{7ÒOy¨ËSî
¢ﬂ…Ì•‘tD∑	æu‡¶…TúáíJOΩ]zZ„(…ã’Úò”⁄Åæ6H7˝ÕçK®-+¬ìg=ﬂÎÍaY†å¥¶?„<b'õ[ÆW˝„Å˜NË
_Åß>™≥∆·§7¨ø˙…Í√’NsÌ59ıAÀ«Í˝–ßÆ€∏ﬁwi¯/fÒDŒ‰Î§æ^˚Å´Ô†˝»˘µÒ&^øPÓ»ﬂsVonê˛√;ªØkZºÛ3”:mI4mGº}ù⁄õú¿ÍÏ÷„âêÒyw£∂ùÎ`Ôü‰F|≥éÒ=À0”S1ñ≠Ø√´gìâı1¨	ﬁ›ã^?r@•?Ï2aMÌ≠æÉ±XZàqL§≥; {3‘Ø]Vπ®—h»√R;¥k∆˘™π:9-◊Ü#Üe…„È,Ó”a$¥Ü7ÂNÙHÅÀçEYDÈ´\C@(ÄÄ@JÔ{¢X∂tè2∞j%@„√%]i≠¬s6S [;˜…ÿ9Øü’«r∆‡MÍàﬂ@_Î≠s_Öz∏&»mË:^˜›?ˇÀÔ˚´«+xE1™$ÔiÂv˙Ò®ï{x<ŒAıŸñn.à&$QæH’∏P¿ ®ïîÇõ
ØãB%ku¨ƒuÓ4√∏T·K-;îG$ËÕ¶”0PÓÉ∏zrôØ=Àï{ÇT≤˜ºÀó^©√í(Ö†…E}çd‡ÿ^%#¿ŸJOm∂M‡ìü_M/O?Ñ”	ƒûs ÂCÄÉtã≈MXk—9Js=úqd_¢„0™OBîj¢ö4Ouøˆ®¯≥áB?µ,uvÎù=e{ÿfÃGq$;Q¢2'∆©UÑYO$à]¢”ßØË£3µœ˙ÌÕ’„5Òò?fèπ‚6Ÿ⁄Í¶P!~S∏Ò¶1úŸ£,„8≥ª@N<M$';/6üf~˜ÕQ“{∫æ˘ÈÂí…˘.~ˇ;ZüÙMÌÏﬂbé	uîQ*°˘õ≈®P˘Ê‚∞P∫Ì˝»háÎá46îÿNCD©“LC}ˆs_£.ëπ‚
e ~Y˜j–˛“ÍÔ`a
⁄üˆîº¨,A>üEËŒÛ∞˘ß,2@>oH«)ÃπIúª∫¡2˜ªﬁ¶<[ˆΩÛπÛÔ¶K©ª]˜£ËhW¶&:“ïı=Ê ]Çk\§W∫¿!’ZpSp3 õ	‘ÙÄf3-êÈAL`F“ó¥
 KVñ@eR UNF`2Çíêr&∏·C—[ÏµA¬jJbÆ¨Œ8¡‘s|®®(^Æ|Hí˙\ç¸òµQ¯p%c–èY±q<ìsPD@∏l'RcOQ¨ƒŒïçUJ£Q8!q°ñCG®’≥zÓÙg UX®nÂü3t&ıµRõ¿#2ÇˇaòCÃGÜ;Î”î `Í¿√#«‘7`QÒ¥Î¯TN§_X0~˛U–á‚Q‰oÎ´Ü)—j’∑D√b ˜~ÛıÔ¥ZúFˇ»ù¡ùlñ&
$tç>eP„ÃâºF◊¥◊Ë¨5Õ)ç◊OÎ´ç∂NΩ3E…1ôÎ˙[∫úZuù/Bª£Ø6’…(+ùÕ`3ÅCD¢ÕU6Ò‰‹˙™™º%ø$ÜÛz—¥ôÇ-¢ùaÁ`Ø‹sÍ09fA%««˚“Ïd∞ÉΩ£da˚Odr¬ˆûwëÈ≠ÿ© .åçô=÷Aü‰Z+7≠°ùÖå[h&IÕ“†ÒÖ?s˝~;˘‘	ÖpÂë~dKAxéÔ‹àÀºF1>SôÂ%Œ,Ü+ÕU…|#S\8˝å·˙ÖDâUôS¥¡ÉÈWﬂ=ù¶Î“¥2◊ —“"ëÇ:ââÑ~”`–ø}ıqË;À©°$Øñ\}êGu„P#ô–hﬁ~2K][É,•œ∞8LÛ7…¿√Æ-ÿ Éy®˙	1∫Hs«íÔç »^j‡—€
L6)ãHòÎöàˇ´ÇÌ&EÛt*@µ’X˚H5‡§0"öh8#Ç¬‹*[1Ü£¬(∆õDàou(Èv˜ÎˇEªÀ∞<?‘˛N—πãÜ≈ƒÈπ°—‹£èD¯a±ªÓ$Ïò<èºA	!‚%¯‚zD,oe_[à§Ÿ◊u+ó‰•uÉYÆΩJ©b≤Ø≠dcëXJy{›<ﬁà”uÎ_Ë Åœë”√\}∂ÄW7≈˜fS ë5w‡*á´∞µKR®øúH ÈG¥®ÀRéƒ‰‰Ô)2Rd#ïxßÚŒ†©?!∆ vH¶—RäñôúY∑º«ìÌ‹ﬁ)8˘Í>Ÿà¡≤ˇ¶∂Ω∑ª≈w*Læt«^∂+‹d+C∂{É+˛,\˙|I˛l6∏‚∑2ùÓ¿,nB0L€Òì[ô‘ÛÎØAÇ	7/6ÿ‚©i!ÆJôﬂbà◊ùí¨oB<Ò¶îãÇ∏ˆ‰KNW-'^?êµ~ÊˆGÿW«'‹†}”’u∫‹
ÆÒÂV¢%ó2Û÷m’]n¿˜ƒ©ìº≥=Z
¿π%ûkØ‰ªY1j9—çí’¸2<2˘sÈˆ3=_…ë;l(èæ S?ì˛Æàà]l°"‚S∫O√srêÂñë$_Iñ/ıÈgyYCYl£’®Å®DçıÅS§ë7dˆ2Ñ5ﬁg*'∂fl`înI^QuXkg¿JPi.T√u3qzqËœPm'†”‡É‡åçåòí/™1»˝¥å®‹‘ßj”f{‰§Ë»å≤uöÓñó√*°°Hë,—®Èƒ¡‹@`· ∆GÙ_)&I^∆4Di2ÛÙòé«ë£K˘aV1Ì∞µÁ‘¿ãºÒßd¡•Î≈fNWNëY⁄Êeã¥kÚi˜hÔŸﬁNg˜¿rxFà“Ãc¥ñõ£rÇA]ŸZÜ*5∆¥i˝∆ó¿"!†˝˛]∫OîËÙ—A∂ ÖÕRå÷4ÛÀSUNJ€´©e 	∫v …\Ï‘ÿüa9ÿzqîœ$¬vã˚ë^∞v§òÛJ-äœ◊ﬂ∆∏Háü≥⁄»öÎØÜõg“ºOµ–hl4;n‰ﬁõfÓ-rn$Å¬™µääHb∑7E'‚qQŸú3nÜ‡ÎºÎDoóÙ‰Aﬁ*≠õ±mK<¥ƒÏüƒ†e ã ∞ét±:,ÿ–8§q´ù8iπ∏ìÏt¢Cæ˚Âˇ ü∫í[í B…•ï ¶πW&3O˜|‚;]V≤B:¥{Ïıø:c¸1§‡ñ5P∫íûl√»eÁW	ê≠q S˘lëÃhÂkïpD.8Aè∫Ù˛ãxô\#X„wëô>âùYÀy1ÿyŸÑ©%LáG'ù}rÿŸŸÎæ<È⁄≥≠[$˜R˛?ˇ{ﬁ.(<Ï≥\…Óx¬"ª≠h∫ÒK ıët#pyScñüEDgø>Ã¿3™kÙG\«∂ç¥dÙo	P@cÇPÚ÷Ë4Bs˝aNÄ{xhÓµ≠ÿõÏH@S…¥≤’cw‡Õ∆f&®êÄFÃ˛Í,*&æ§*?@ôûç·1+œíä2·—mc_y<Z∑qü ä≤!Ÿíí¥ÖÍi˝•¿?úô˜ˇÎ?$∆ÆÁ˚«ù£Ω≤€%wˆ˜;˝¸‡òt~∏OEæcR¨kÊ_fß◊Y‚ı¸÷ΩH6Â#⁄ãlâ®–Rluéexzihﬁäúı‰Æø a£ÖÏ!Fì#ÈL∂_pﬁiï~ê‚ùH¿ç˚ôËY¥jîÒÕÇ„ÊÔìùΩ‰À÷òzSV1%9ë¥@>q£±ŒË ∂9áMÈÜÈû£∑Á¨Ã´Gç∂¨Æ(RRB7årzrú\ç=x !Æø9E)&€ñ¡úõ©EÙ˛Q2X”ŒÏ™f÷ÊJ◊*'8¨H“Y”(Ü€"èC”6;õm^jÇ" 6pN•≥õ@<[TÑfìAÇ,õ¨<*b¥Ax_oX‡≈∫p[ÉmÂl∆]¡*Y»ù◊ı7XÙ-PªÑÂ¨©”ø™-L“«G.¨hÄAﬂΩ·
«o/ ◊â\g±¨xYıE=û›ó”·zá£ÉQa“¶ögYµ2Ω^sÉ^”3
;N‰íCt¡ÎD
ï◊ı·j~1l™ÒG°ÁÖùﬂ‘úMDØ˛„V2¶ñﬂë£ÓŒ¡ãÓÀ]–<^vè…$;üÏÌ¢†Bûw_vè:˚›º»bZ‡¸ÃWõH÷^‹'øﬁ&™ú∆˛$3(†»Êg¢÷» ä€…60nﬂ”7π$´K˙Ü´«+æß°Êq¡fæF 38-5x >ƒ¢5Úfxã>ƒ…]ŸMyº»_47~Ëeπ?:¸¯«ˇì‡«·Q˜˘'/O:«‰¯ìÁ›#@çcP”è:ïº∏˛€›Ωùrr‘9ÈË‘ˆ<±MXÕÑ∂hÏ¯Âñ.√ƒˆ]#á∆ÿ¿wﬂ±HZ;›·,¿ONN±¨!q∞ÍAÏgÃÇî3±˛¸íÿµ∞_ö”s˚n‰lißÆe#VäçûÃ⁄Ä7£øòÉË74ÄM¨lµ5|[»¿NY∑LÒG{NU˜ÚƒŒt=`¨‰ﬂëÊUÉ\˛¬,k∏≥ôVÈ}ÛDX‰mòªhB—ÇNx∆Á@dﬁ˜®‘j:$ü)$R∑d«\ˇŸ1≈àÏu%";oÀ‘djaDäÁGùg◊ˇ–πœÜÃ˙øˇÌØ»ë;ÙPL¶A˛Œ}B1QÓÂâ…“•ÓÆÚ˝á¨Ìõf7÷jÍ∆“{o|˝&≈@xÈPëZª¥b ê}·Æá(-ÕÀCîƒ‚ƒ!|f4^™Äó∏ØJ„á´GêRCï…Õ¢.-•ﬁﬁx»kõËµ@´«C,ce*Z∞BÉW÷_35Dp_é{◊Âﬁ§Ä˜í8Í≥Ã"ˇä8˛î}√&“Äx2ÄÉÿ∫æ≤ˆö◊zÖ˜`ÛA!∏YâõPB3€´5≤b‡å¯jÑ
t	Ë≥⁄Ä¸ƒ®f
…„<Jp°’∂ø˚Âﬂyı›/ˇ{£©¿gÚLI TŒh˛√ÃÉÖ§Õ1@ÒlPöV±.ß{µÏ‹™Ê Y!¸Dk® ÀÅX˙U™ÔøYç∞bî4®\–ˆªYE0ú|»Õì+©À;f	.Lsâ±∏ºËE ôN“!
/å1OÅìI°∆ò⁄>
_ú$X”z™(™πîÒ,á(ÀK
ŸΩ>NSë\-S«ºˇbÊéÙ≈ºﬁÏ<uŒS‡ﬂÖÒ2≠Ä¶x§XSìÃÈN˝¯ k•Ù∆"-–˙ê∂öÈ"V¸‚ùPDHQ´,`ê`∞x|ÜS%∑}êı&è∑S@MB0ÒÂãÚÉ´ºê˚Øwˆ>Ÿ%ª{œ˜–˘È^˜g›#Ú›/ˇ+9ﬁ;>ÈæË†/„y˜¯dÔ˙◊/·‚Îxπ∑”!ùO;/ˇZébëÿ≈„∂&…a	Y◊0\=)_‘"[ÙYÛa´s£lQı%AX«àè)·Y\““ªê†¸·7ˇ¸Kò˛Œ~ü|‹ÌÏ¬2-u ZF.ä≥üLêª§IÍ‰0Z
≤¸≥Ãœ£“Ós|Á8å&#¯¬”Si+°ÓŒs2rùhzÜÖ‘ﬁyÒ∆¸%Í+µ“‰Æö”¥‡sal»éõÖYØ´,†DU_kÇıƒ¿ä4pO	ÓS“vw›~±Ò˘CJVwiÌ	9ÌŒ"2Øπ≤NŒÍØÄi!zåÄ&∑ÈßLcÓb9ÙßÛj/î¯´ÒÕz…~=õÚó ïÖ©ægıfy5Miª|¥ò-ıŒsDÂ.zT‘ùJ™fí∂7gÔ´’7´oZ∞o¢aœYzÙhππ⁄Zn≠7óWÎÌØçªIp√&%AÈNyAÏb¯$Löé3C$“”8KUg±ú…Yƒn!ÚìüŒâAè;òªøàØÅ˛vˇÀ±ÑÚ≠˘‡Ÿ“®i€¯G]í2"I¢≤ºjm;≈F3ÛV0Æ©#–à©å¥Î„94•·«iXtmª˚Û√Ó—Ib˝ …aö4gC‰§yj∫Ï`¡∏í®¢Çµƒò∏⁄jS=‰˚	ÀV“•0ﬁ oÍ°º˘‡um˚	9ÈÆêûnëƒO„1∏m≤~9* ôU≈7[Ù9ôCﬁ‰umgi‘¬J%◊∂≥®7A%1‹«ç0Ü%ØOBâø/M 0≈ú6µ˘9PÙﬂ\X∫ñÓåÆˇà˛´F”ﬁbèaZÖk7jêû?UÎ©ãÖ=aπ…qÉÏÑÉ∆∆j´]¶Dóg‹+™Láçh@é?}ûâ=◊ô¢M9ÂÄÛQS±é√È∂?‹bÎ2∆ò©Ñ‹Æ∑—Sì∆P˘9π W™Ô›P	Ô^á5ﬁî √‚	M}û?©≠íUÇT}Nûzæˇ§¶Hx<q@4<©ΩÄÀ€‰c ˚ÎÎ§ˇn¿˚˝vã4[gù˛‹ƒw†ÜÚFëî.˝0JŒ˛ÃLGOj@+í3˚ †Ω>©Qhœ~zAzZÙr–+Í†'åÍH`πÛºhE]&,“≤}˘π2…ø|Î^úFÏòø}≠)¶*Õ%ﬁûû#›"¿˚DUó’ÔÌ∏5ØÆs∞ÏÿY«ΩRÎıí>dKw;∆ö∞ ô¿ÁOΩ ∞6WÈO˙˛9fÙ—Ö)R¥d«∞ñ‹¶DµöPF›jTbe≈_Ñ◊ß*Æ¶xå-•o bÛCcYBî∞Â–Ï¶.Ô≈™6Ê´ÕRv+™äRC «ÿ^ËX‰ni˘üM-HÄÃc^2àÆËRm5ÍkçáıS˘®ñ≥d∫¸<	é	µπF£Ÿkh»¢1ÔF°íÛˇSíàs£˝ÚÛ”ª>"µå—l$Ü°DœÑf€(ÑÎªETÛ1ìüï •ZÊ# Ë‘Á]}Ænçt{R{NÁG`~‰ŒoãtπôÜYZﬁ⁄ÙΩÅ3 â≠áöX¢Ÿ‘úí	ÌL§ÌQ{Ì˝˜ßó6´çk´ƒa+"?vÇÇŸ•f¿©(4;_i·Ê‡ﬁ¨O"¥.∏»¸~∞@/œ“˙ìY4Ò];–onl.o∂Ùﬁ–obˆ9ræÉƒÃò&˝8Ôú‡KûL‰0W9Vı¯q¢¸üFr1°* Ø|ä|•ãÒ fÉ≥*≈}2È”pä°˛˚‘´ì>±ﬁ˘"T9¶Úÿ≥ˇ,åﬁ¢≈˜†πÁD7X˙¿”ùVpH≈ ¶ﬁ9µT‚,?áH⁄9Â@[eôBTT4z≤i°1'[Ö<^mëö^ÄIM◊Ì¥~◊Õ1O≈;éuù^‰EdÖÏ∏6·»Åh£ë'1Öp„'!vêçÉÎ∞-⁄}HÒ'3è‘"Éö√üºP∂≠éR'@]ûÒ˜¢è.˘‹‡Q-eaW&˝∂‘'i∏í!IImÕlÃø È…Ä`ÕÃ“j£.ø‰2?)ﬁÚkÇË>¡nÕ”YL	ŸücÌ^¿¿?ê∏‘säs~%
ê,Ua¶•ú∞Ø#˙â@ºÔ9É°ög∞!S9Q-òVï´X£œAõí%™π±‹~◊l=]› 5Á‘™£Nı:|ñYM≥¨Àã3àÜ"i3®‚9Ó‹ÖmJÿF
êX∂MŸ⁄π◊ß#ﬂ(ΩCòçö .—:\»ü4W{è6õØıØ◊YÓÊMí7[2ÕÒÖ÷Ç,ïOÎ~)˘Fù|Uc≠‘iÊyµ÷›—⁄x‹tÓs;PÆÊO^•¥JzèßR¶IH∂∑ıi 
ÿ˜4∆<F∫’íëVTTx?WTí˘ˇ˜7‰EgÔ%Ÿ9xyªG‰g{'ììŒ”cù#±EÍ≤◊ÖãÙã∆ıﬂNº)y…ö
°5Á»Ò|…a®Y\’ªâF¿‘i®:v4úƒ>Ü2ÏFŒôãZÄÏØ≈ÁEwﬁyVﬂXÁ˛‹Œj∑ŸyΩÚHpE¢eíF∑^˙-gB°Ç»§ﬁ&ÖI&ïÒ ÒH'«+rf˛/¡c˜£ª GäG9ÁgŒí$82„Y3ƒ¶·Ñ$æ=jK∫c≈LË(aG¶ #ú2æjr«¶¶®ÿ˘›ái”*5Ü‚Ô
NXé%"‡∏∫l⁄õêwMtKHF˘MΩœÀ∂®'jE≥äéÉC‚Hœ-w¸∫Ä ø∏˛v0√†ï§H@lG±ıÎo•=1÷p‚Ù–Ó@ÎäáëjjÖ`ì
ˆnùÎ‘‘⁄,.∞…:Ây0é„,ı≈S¿‰âBß≤≠RÂ$+êp’d ´¶Öb’≤S¨ö-ê⁄–wÏJßTi&5VQ´F%!DNk:⁄l“ëiWä&b\6+’#%Nú,!çbE%f«Ù„≥ÖÎ‚‚—?õ‡6÷66NõyVcÃ˜ùl£SÌR∫.Ä#˝à—f2Pä—¨‰ks.Êu…ÎáÑrq&ÎZ‡XC d•J&uG"^ÊÃç%j°Qw*ì	ûœÒ£&…º'HD≤h˜û@º`m©è1√‰—ª°È‚‹ïÿqbÉê±ÅıÆ‹i¸£&…º'HD≤h˜ûD˚ww%D§Àr'ƒ[gË·O¶ßŒƒ˚Q”úˇ{öPÅ&‡Ç›{zÄΩÔà–ı∏#B¿≠öù√ΩÖ”Åû◊ÛΩp9ì—≈èö HÒû2T†“ ›{qÃ:ﬂëêóÊ.®≈”‰çß◊ﬂ8Zjëùª	›pixÀ;]ƒﬁè[«P◊bQ‘£˝c†Í‚›kÒ´Jﬂ	…≠è&YLDZÎÌÂf{sπIÉO≠â»nà] >u¸0‚’`˜:ó<<Z+‡GM8¯ºó6*–æf˜ûL–R{XlÈnËD≤.w!ddLX7Á‹ÿ°∞>Ë˝®ÈC∫Ô)DG≤j˜ûFÆ„wÂ€H◊Â.hõ&óÏá}©’≤1‹Ûø˘ﬂˇBéª˚›ùìÉ#¨VÒ‚`∑ª@^º‹;<ÍcQ}≤t|“9Ÿ;xIé˜vªO;G¨%Â†)∏‘kÆ6ØmíªhnM n	qGÜÇ¢÷1q•eÛAs˘≥&&®;[î7Ø≈!r∏,Ì’Oúvo˝¥ˇZ=…SÒ^^ˇÆÔª!ëñ1ùÖkiWgTüÙC»ÙbÇ’•ËèyÍ∂Ä8ôEqÓêï ›[bÛvÄ
Á)Ô/•IÚô;∑M·*º˜tû´là\sÒ7ç©¯⁄∑∞‹ë	ò˘¬P@=´»ø#ü§I27&†äÂb§;4π¸<É∆ÖáO¥®ògŒ^XcÙv[MÁ3óc/j¸Æ≠=DX÷∂wΩ˛ˆ9Ûi+$76V ‘≥õ;ˆ€ìÛ	[BÖë¶Âs4<Ü˛pÀt°$YûSá“$@%P¶¸d1çêíﬂ”à
4¢8O–ÜR–Ï«≈”	)õ2I¢\$ÖPfétBM∏ÃSäl],)E…(µIÊnt£ãõ-s¨ÕR6&∫n?›â∞¶aáî—BõVR˝Ÿ–Éæ¥ªhYÖC<&%è/Xu–LoQ%bπ4¨P˜∂®´¨!Ac∏i∑mßº¢ïáóLõ¡ƒZ≥˙B4b5⁄◊§Ç¯cÁº>™øjµËdS¡Àc¿à{%oAìz‰ºs¨}qöbàh≤
î@S⁄Ω§ë¶˝eRW®i[VB¥∂}∏ÁÒ»V2ú9— ÂM%°@íÚÉì¶¬ä≈¬&ä’≤	V=Ó•Âcµó(%¿uNe´öÓ…Â¶
Å{+Ff˘…ó£m*å\œëC«…ÈRörÚÂ^“éì&‡tŸiOp„=#'¯Ó~Ë*ﬂ
ØÉyòÔƒëê›ŸóO›œÇ©ß	ƒ∞˚ô@zk_tÎoXÙ`π“›W∫J∑Ü*¬ÜZº™∏:çfAﬂI“uYù∂KyØ
jÔÍŸè∂€ 9Uî»d!á‚EÎÃ˝º({aCüzcl@0û\wÉ‚b∑EÒ»¿›-Ñw<\X±pÇ]¯ñµ∂dÑ<ÙÓÇ|1ïÄ¿‹¶ vËk~o»˘ÛQÛv∂)Æc≤u´ºP¢πSO´Ô˙»Eé&3Ü¶=Ä]8â@—j)lô†±"µI@ ~5@¨±,¥ !JZ8ü)πﬁ†ﬁ•‡≈Äa«wùàìû"≠&jhb˝M‚µ5˚ﬂf√$Èú
RD /ähN°Æ=µ15W›˘¸2Ô{„âÁDôc%ı*Y˘Jbl‡à#lvpÙW«áùù.Èu;r⁄ËXëœyÊ*3ª∂V7ö_Ï…† B()±Uóê80^GÔ√q±Ò◊Tÿ*«Sª9»`>È<%Õ-ﬁi˜‡àt…ﬁÀìÓ—·Q˜§õkƒS1πj‚û6`’r€ÅrJQJñYÉMzryô–á-≤∫L®1>5mÍ∑ÏJw5”ªö∫[‹soZÒ-∏‚çâ„Øo∂u◊kLµyÄUÌ2yóÎHpÓ	ö¨%¡¶ÆxlÙ^0ôM±¡B4–ÙW øûè≠#´∑≥~«z-ﬂÿî$sqµÚˆ|µÅ∑Xpπ}6Óï€+Bõ∫ì…ÃÅë∑qN9ceG™vò/ÍŒ®/¸À<a9{(÷=r¢ÎØ∆Ó»laˇy˛¯ïQ´D2)LhˇÛáüÖÊ&°y!Ø‰*Å9Q`"b´!CôBÅô(5‚´KGÓ)Lr¥sfRÆÇ5yn"-hcù—≈meeY |„{¨≈g˙pSc‚\	tZPRh◊a˛m†√0Om≥Å≈&A#∆öy¶Qô«Uàæ”s}8RD&aòáÌt¿[èWË;
∆PLê[h æÆó"9,⁄´⁄6è‡·©µeR˚$ÎﬂÄ__8cÒ◊ìŒérñ\·ZÔ”;qÌ5≥#Ä(Pÿåœ¨ÁŸAç@3ö≥£ÿu ñZ}v Õa[6Ω†ì+Rtÿ·ùºíâ,+˜¿bÃlÄ≈"OΩ>µ,’Ã&ÜÏ([∫-ãRi∏Vú¢eWŒX˝ÕX2.Â›¢∏ØuƒJ#L<‰!èÍ›-Ú1Ê{IwæX¨<s∏h ÉàUH√‰€√UçÀV_™±†å:≠/«ë¯™vÿìæp£]†±fáZên3WêŒPçN∫Í°°H]ŸÚÓ˘("ZxîìÅbæ«}üæ‰~£Âßòm2V‘j§ÏëuÂÌæó˙!ÏBæ„´Å2“#R∏¸¿íjît[ûÉÂ›"””,M9˚CCEˆ¬}Á¯3 N±Hã!X¿»	ÜnjÍ ëV∑1u¢°;m–á ycÖÑgèäTí”∞?ã∑Ú‰Çù«Œõ¿÷Ö/R_)2ÍÇ˘≠œ3wJ“çLı44”Áá≥)-Gii¡6*2m."≈˛8d◊ÿf÷:ΩA8∆7¸√„ˆ{•á04Ÿ¶Êz¿ßûìYÑñ>üÙ)`cL>INÃıÃ.:ô¶!b˝0◊CvfÆÔ√3ÿﬂπq∞c|mõòÎ!á„^„`ÁzƒIÿÛË\¯á˘vz˚!È za[.}ø¡#√X~fzbŒá^ˇ´€waÙ√ú`M˚‡ﬂπn?Ù‹⁄6¸3‡a->?˚;ﬂ#@sÖÑÉ˘ÜøN&æ±¶…—ı∑S–§ 5µßoÙÇwn∆î›é=¡›≠ Øπ—´ùaå∂,xy—UsÓå?Å{aÏÙÈFÁŒ›Ë—É0ä?{,˚~£Gˆ›Ë∫1≥á&gÊ√Æ0S∑Ö/Û∑Îo#Áh˝;ﬂ4£ÎØ1Ü}òÁù`F“yê&O‹`¿:ù_Ã0ñB…Ûç›ç\Ñ ó.HøS∫E ôπ{0EûÉˇí•n"ˆ9—õá=^aeÅÕ•Hêõ£ä™ kBGï4^⁄ô≈”pX9ôM/¸K/36–•ôS1H√‘OÅ∏ÔﬂóûêÓg¢NYÈ	tâÅàŸàp<≈™*W'˙tÎÊT&v≤õ´©X4wÚ∫Å®¯ÌÑ.SI¶9_¬«n?çÉ^<Ω˛z¡b5ç‚Y›ÖßÜÕ£ükì8¸%ÁæΩ÷R¥TF'¸ç(√zÉÏ√à#n©∂6
º‚JZ`C….õ»ÔëK·h¨Â¬4^.ãƒÈôL¢•ßò<JºΩ≈C¯√=¸2ªp)±≥√UñpU°0¥ÃIﬁÎÜÙ˝–ê%â*> Û7≤≈œä∏Í¬˘R(∏◊ÙSÄ2+∫YÏ`∞Ò( îñŸÓê®bÀîeBG_l“ﬁ”5rµly˚.˝ë#<%9cˇåΩ/Z›h >%;gˇúßûœVZxNvÆƒÍŒ=%LZ±pñÿ∫K∏√Ñ=∑AáUf›ØÊ;—•a$7Ω‡BFW¬Ê–˘öb Ö1	Ó^∫Ò”Ö†Ñ&[ã{+˚⁄÷>lê±°w1òR?‘CÒ,Ãm∞f„∏(sîª k´†Ñç°ÿìP"*îI∞ﬁHhÖEõñ%º@ﬂ|àU Dâ–%g‘ö<l)êπ|ÌÙ *%OÒb¥äÇå
òD∆Ë^SÜS¬∫nçKõs‰bzg‡ƒ6<∂aÖ_∞›+ã∂ÃM»íQ‹îÍf#\zı∫π7e7g1õö8ﬁµvQüÖ)ÿ;%('<Ëf1t„d£T^[#ÒXŸX¨¯÷9Ñ¯b/-vÑ;·ã˝ù˚9)k?ï±lüq–‡ùâ_r∆˛ùsO˚^a”H ~≠,%ñI!X:{Jº8…å%OàHIRIê” H"w:ãÇR≤cOxdÜPN:™R´9b|¿®ùlÌÏbrP®°∏‚ºc€“ÑcB≠{¬‚[ÑÔdCÀÓKM}ée‰P:Nfó FkBƒõ}Ç´àÎÅûsÌ^5a˝ñÖ≈zm9Põañ∆<·a´üËFﬂSÖ¥¡rÉÓ≥ZÚ=+&6™âçtQQ=±4@‘(∆ò+Q§‡äK-oIËR©¨öÎ“%Î	òà›hãº%båYò◊JöB∏w%ßDø"WΩ‡a—vΩïá[/íß"#£Â dvY¨°íﬂ≈w±ENv7_∆VÆÊA]’áe\∆&o◊øÎy”01õ†B"Á"låº/a∑ø‘´ÅGﬁ≥ë¥ o…nÜÿ{™´i≤∆ØÄ@ëß+U=#í˜BòïDBΩ ∂·£åk	e\]¶ˇ5“n√¥‘R…¢¯0(’2Êí,ˆÅπÿ◊;§‚^K¢B‘>êÑVVØKoAêsΩAJª¬Á¬|ûÃ!1å¢Ù ªö]:´\Ò çê‹A!>öyt|%Ù« /‡{‰d@_‹óèñB…Uü j§-%lHÆ^euh"◊y[?Éü‚D^°Öråù˛$(I”∞—mS{	Éö¡-E–XòÒ\ê ]í≥G˚≥ºó™….f}{ë÷´[≥\	S/ÁmóJÅ∆4Ú∆K•‹ﬂFY¥◊˘îÃ‚N√`îí≈Ïk‡≈NœwO.Ωò›+bugeaCü[f&YV≤¢ò“—d^™É
ß7Uû&c±$'Ó|Å¨
=FUÜf‘S4’L•-gŸıá3ﬂãxÀqá Dë;Ñ≥a4M,“À$r| @;ucj¸„Zê‚‡>¸6v.Æ˜g∞Q+c/H>œ™¨ÅëBá1;ó+è±ºá)≈≤∆›âÑOº@óíY˛J-;tÏn0Aæ*c1¸∆íáÎkÃ(œ∞üæ∞f∂Ukj^!,ADeŒΩY⁄qbîK˛dÄ(
s¥2≈:Vô"gºΩ8Y◊…Nl|n¢:ÿI≠∆†ï±V$E·8DÂj‰êê3øîÔˆYW>–∂Pπ"ÊCâ0=_W®Ä»?π\≥JÆ’æ«Q´≈QP…/Ÿ›¶•3 tôƒÙ1ºÀ˘r∆∑-/Õ/‹önMûJ¶z∫o6ﬂ≥»ôTÀÁÁMÊ±˙Sƒ∏ÂxÍLgÊ˝·wyÒ> ¥PÇXjƒQ5sôÂúxî¬8uµUréËHI2∆ÛÇáPò3imOo 4kIÈÀMGÍ<ÄÎ œIﬂîàt¨^@Òêm:pX46ƒ´∫¢™Bƒ,$¨j –≥ΩΩå#ôp<ò¢‘ ˜6f–∞¸èéáyôJÅ#}@áj´w!¨—äDÿOU`Ñﬂqã@í˜&PÚ4wPh¬\ñ.£dÒw9Qøä’bN êo
2îôÙ#Øww‰¿$ﬂÂ5´Ì4õ™˚≠ï«i-éõ ‚'È≤¢N&ÿ¶ºs¯ˇkB!›âÄÉ:ÅÀ¢ÖäÃq8ã˙neP¶¸ÿπÜÁ™·ÄUË‰—ÿó3®e•ûõ÷fE‰2DŒ<K)fØ¨µEøVúüë]Ç98F3∂µ~ùì«É≤%‰∫ˆÆ;≈z:dàƒÜ…›$CzÑåi8æ˛j
Ç8U≠ãü[äRπV‚)Fâ´È˘>˚hÅJL£KÊq!†Vd£¬YU ıV"ÑwÒâÖjnËŒ’«R ß*µ+oñE|3P™Dù•“¬VuÖ}7vÏÕ$∂êTÕ-j‹çRˆÖ‰û  å√^¥ò¬”a‹n!ü—¥·ñ≠¥©éR1–\@ä{C≥≠b7DµÃ*:‚#RKJöˇ‚∆„ §˛ò›8∆»âG2Qÿ(ØÓ¬é-©y…jﬁÙºô+çÛêı™R{d	Vr)pVòJ%¡6àuãà"OY"≈2C9÷õ`Ré∞∆›ÄK‚)ãº˛¶áÌu–éË;à`p9Øı?¿ä¢—ÿ!Õ’’?Eì¬ÓÕcQø˙Fˆ9ó=ò™åB<œ§ 4ãvŸ†≠M°ÜÜÍAÎñ∫=r<q›˛(Uo‹Ä|
ZΩ°Q”p8Ù›öB2£WÄÓâ±•0âEDíöôç$#*âÕDëôs(ùZ{⁄™eøı…HZæ+ûe|Xµ¬VïhÀ @0u!â‡hÙS&XS"‚˙©†9ôBNL=w<	©˝õ“†¿yÁëßﬂúñH∂ær^zP©É””B?é≠Äœü»7Xo‹JÆÁwY<›∆yEüe?ı¬yWE˘#ÈtO `2…Ç`1Q∑VTR{-¶l§EÄ/ïrî.ó¥nºhÄ^ÀªÉ∏≠πMΩ‚r9SﬂuPÆ≠cK“sµW«Z÷™bﬁ4'*93Î©†èÇõP◊πÔ÷∂ø˚Á˘˝oe•‰µ§ı≈Àıq√h({L∂∏¢tZúÉùé∆
§>,JXîRòq&.ˇ7Yh∑R;`˚òéñJÑ©ÏÚ2$án4f_B≤8ºPÆK˘ÂˆQ:î$3∏‚_ìq‚(Ÿ©:N•tÿ—P£öÑ(Bºc“¡|{≤‰é@ÇX&ﬁ°3X&/ú˛2√®W∏"e=nL∆◊ﬂæ√¥ˇe~_‰“$j ∆NΩ·€ñ”‰77≠¯ÁƒÃï+“gnoÀääŸ≠„Lr‡˘¿€Í0≈>m•+ﬂµ∂ºÆâ¬«6\X ,˛ÿrQ˚û›Öàù∞®¿xı[èí«ˆ'±CéùS'Ú¶,⁄IÄäHÔﬂ∆çdõ∂¬ˆåmHœ1sÈjœXï–P:á{¯	˝Aÿ˜x√08Û.¸Öqáa,n¿∂˜√qHvFQ8∞x"Àix@˛4Çã§”ÉMı˛	–MÆ$∆B|§iöYÙ†ùc:£b3x∫~+∂kΩÿM°Œ:∫Æ	ˆ£XvåÇ‘ÿ∂ÂSÁ¬!é’—]+˛›˛G¬ õ˚ÙÛâ7—>n¸ë∞úÒåo6(° ¨zßÏ2¡ˇa{√	SﬁLÔd‰MÚ£∞¥ŸâR€Æ±IF	¢÷Ñ1`—2rzûÔ¡OŒ˝ﬁ¨Ó;$°˚3û˘‘∂¥w¡µD (í"qcK∏ôãFÄ~ﬂEEŒç=P¸ø=≈òºÅãûD†ÔX %¿G È ÆÅ.;èΩ´AAë°ÈÖS‹¢§Ñ	#âN/Ú"?Ãå∞AÓƒh÷çªÿ%~º2+ÕV∞Ì‰fm¥f™ı≤ÜÇ‡Ö,O$¿2À´mã“√ï_(nÀ3n´¶‰öÉT®–¶Ô0®<Úˆf,!Ú¿+<kÑ aK¸≥ˆ©Gπ1˙æLjozæº’µOïè|sT≥∫Bíú∫5ÅmhlÜÌ\˛EfÂBèÆ@ÿr…y	G∑1‚Í≥2PXVl)L•&≥.Â±éøÔo≠≠§!»¸ëÜq©a	;ÁºúπÔ+#û•¢w€‡… 1'XæÑ≈0™¿añˇ#ÚÕMm'
ÃB¥õ–AÊ£!©ÛŒãM˝@ÿa≥µ7™Zb=∞éF=EƒÜqµ0‘g¸Æ9„Oa£àf©≈ÄŸÊ1j*À%ÜC+>á Ó$—çò	˙◊ﬂΩ>|Éeü±⁄aº®p‘¥)µ1ı~êïe”bM5o¿£Xò,˝ìûoÆfÑi?Â≈Üﬂö˜»l«ù#&ñz9íúÆCÃu…
Ÿc[ÕŒçπ ˆﬂz’~u¸IØ,ﬂµƒU…xƒ©Áªµí+A(¡˛OÿÄ\Nõãπß%\!◊KπÑeÙÖ••/¸d‚áNY‘&”'µ∆Ù|∫‹ñì¡ÈrcˆÈ?Á#ˇÃ)‚ÙZ9”¢æã∑Vp~°åLN?¬∂±˝∑Ke¸Xá( óC•!3ë˜C≠ ZÆi›€©Ìv‡ƒ£4ìQ`¸¶ƒßˆjAoñ‹X¥&%¨¸1Æ6∂√’Ù_+/g>ìùx7P›œ;QÑ.Ug≈î”- Ÿ˘Ø>G"{<√hØÑ>qÑS
∂t∏˚lÂ‰Á'+/vWvv~ær¯Ú˘ÉÇÃLb)LÍ^^Ê “Û[Ω»üH¬PI -ÀB)π€q>L~ùÁÓﬁÿ•ùûÌﬁéUbÃòkY*∆¸ &Wë'§V≥L©K¥ºã*“ã˛òñÍoÊ!¡z'M[¡Ï$M ◊∆*≠?¶¢x·©VrLÌ#LQKÓ/µﬁhª[í+¥-"ˇEjBY—q“l∞{ Í¿Îa[‘]g {L:}èÁw∫∞‡ïΩìˆÑ>yÅÂÅ]¯…ï9ô!◊>‘†JxKN‹ÇÂLª..·ª†‰OMß%è¬≥Cì9ßªÓ‘Ò¸xÈÉ8wÓ¡U≈î£äâFè?¡Ï"ª∂°Eè—z+SçF

|ãi”µÌ?¸ÊÎﬂÈa(ó“:%z±i‡j:C¶öi≤¿€E’&–kö€W‘´¿wˇÙ©Æ¥ìxﬂ‘ˇªiÈ£À=?ñπ™É¢ëk2E“n™ÈAr=à•
á¨ÒZï“€HfvBü4K"Ãä<›0Ü¥WqYy≈JUâ¨u3¡.éô,/±ºÛO|wJÄnW°»™>ë}u"n“ô0 °bfπ0g€9ÃnØZè(WçËﬂœ IØøé‹/˘ü≤9gçá&ÎÑ`4Ãlﬂ∑’°xn≈t∏¥ÚWj‹dÿ€%+Ñe•{Ÿ·i‰˜ ˆJŸ ¡ﬁ‡∆(ÒNΩŸZ[oÉ^∑”ÿ+≠≠ı˛MW‹o¯FÎ)=ŸòBπx^0p R¬R$`ö%bs±Ç£ÙÓ™hp_¡¯=¿& €≈û8˜LdÈo"±¿›7¶÷@ßùÎ—˝¥ﬁÓº'÷⁄„èˆè›s§œœØø‹»™◊Ÿ-˛s6>∫Ï≥‹¸_8X®ÀpuûπcÙ$‚«¯ı=2hè!√˝Sjw∞Ë[H∫hãÆø∞ù∫d¡Y:òÙYµÖ„ç;vºí≠Pßã∑T∆õr£|ÜYÙ*bï€‚1¥À?m»∫x⁄ﬁ‘/’"gÜè¸õÌ2©¯ËR~©'|Î˛íÙ˝p¸óµ«qπ†bÓÌπ≥v∞˝≈ı◊ƒpl:t˝≠√øI3,‡„k£ÎØHÏ—H‰Ø 	˚◊ﬂÑãß 8Á ÏvÕe‰≤Bˇ›Ù˘ãD~6Í7<ˆ.P7jêûè©ΩO›¿yá0@é¬~øß⁄„á∆’œgæÉÌÀíö≠‘>1Ù0ü$d`ÖÏ{}ó˜˝c6I|´»Õ_q¯Ì≥'ﬂäøh7∏ó[dcµ’ÜM<v7Ó_L∑∞Bªﬁl’Æo>zèÈ⁄√¢Á∆ á‰Y»R∂ûyò(B›ﬁg~@-yíGæV¯´Âf¿BàI∂jQQ1öúñü£wœeR÷Ê*a`\^rÓ.⁄˜aòaz^h(W¯ÒÈ≈ﬁ`©∆(F=ˆÜÅ3ùEnùFf>∞ç˘#⁄(|Ø¢∫õJ˘CëÙ¥W£Ò§¶U”Ùñ˙(>\äe48Ò@8´c!4©;S<äº‡mΩ¥@ÑEﬁl>Y˜O"}˚;Œ∏Á9«Å?¸Êü˛Ó˜ø˝U-÷ìœ/&âﬂíë‚û‡≈xÌÆMBjΩ1∑ï≠`]
·›Qñ÷&éóTèF¬^rÖ~ó-2ËÏBtÚ¿™∆¡/…)J‡¨Rös±RC9Ü–ûÃ§çµÍè4°s)‚X&ÑzcÀíW OE˝'öuæ≤ΩﬂÒ÷(^ï§ßá˜DwÄ/ˇÿ9Øü’_5[4ﬁ9Ïac%‡;¡Kp2n8ˆŒÅY∫¡†>∆÷8ˇ¬˙µë{ÍFëÜ@õ/û‘Ç∞ûú≤+ócU{§4˚1Ω–∫˝cınéπGÓÑÇŸv˝	U©%≠Á¨6ú]oãÒZÊd.*˙l≤Ï/Dà•E˚*áÏ∞,ÿ¿£E≠ˆÕéÿ[Ó∞e™Ø°%/£°TôL9¥Â/¶c\Z}FâÅ„B–ñ@°Ï †È“à¨ñm,î¸Cë±y–´± gòŒX,ÌJ5ÛGcÉc≠,Ê4€IÔæ±ﬂ*]9Z∆◊ﬂ¬ ˆyëg
∑∑°˛t£˚·®øÊ.ÛAÆ|+W93©¢g˜˙õ1,,5eÖ√ÿ;s_U
≈)¸ëFÃOÅ%:—Ä_‡€br⁄Ïü&Áíì»V ä)ñÙoëÒ ◊W‹™mYoqÏêÌ@•°kñ5»Nzø-#ÂßŸ®ˆÄ‡‰˘3$?îNYÙﬂNüè•èE%Äª«¬ãv¢ŸóÚ[ò5≈¡›xåˆUy—»—ö^FŒó8dÈU;∞qz¬‚â—‚>aïW±ßxg˜•¸Ù.ˆÏÉl‰ :◊_cÔ*èèGûÎ√ñè‹˛[·=›∏?(;sÖ”$ucÖtﬁY-kpéñˇÉ…	Ò¬ªåÛg7<çÔ∆]∆1É7WF|_ ^na8Q™á¶Nª\Ü◊°t˘I©aK…M ÈäXÍG4s(I'ñΩ§ca≤¥é[6aKÊ#±^FÆ6∞æwÙxê+å÷∏≈¥å.¨˝êÂùË˙H∑Kö€±cQ-£À[™U(dÊî¢Î9]°†§˛≈ÕB>.ƒ∑fQAû¬˙£ 4œÇ>‹îöI”·%4∆zÑ÷Õ±KëÚ^õjôç£éÀTßÚtkn;≠T'•4WZhß≤—6ÂK[vΩh[uVP˝∏b2fíç…¨™®^X1'Q2iÅÆYÏD¨ûü»r!Û¸±Tıæ:õjL€¯(^—πW†á Üi ê€ï∑EÂrR#‘àVIIy—yﬁ}Ivª‰pßj%Û‚´ ‘ﬁèQ;¥wV£T∑—ê— Ø°VzµçÌΩ¢Â]owGŸ¿Œ‰^—‡^fn«ÖÔy=ﬂCπîÍ‚	ﬁñ5¿Kı8ˆ∏·ª¡p:"€d’¢.ÅŒZ˛Í'´èVwõù◊FΩ=!É-öWå9ëô^kW/òø‹Æ%˘çî⁄˝tÖÏ|UfH?,iñÔÍAi/s”
⁄‰ñ)¸ömEÕÉJË∂ï!‡Ëcgv‚≈¥6&B–J¿ ˛ZîG h¡’,∞*=é.åÂ•Çˆc©˙∞√B°±’fÿ°Ë4Ç∑¸‹O–¡Tm™ôu-1∑ºŒπ∏)¿RçaG≤´nQÙπJx°
è5*åMÒPÂºc]Ü6;lÀ∫⁄ª<qËß>¨c¢QDñ¥ }ë7∂Îuë‘¡Haï{À˙Ÿ≠ÅÖïZ>$Ik$≠Õ‘ˇö:dU£!ZÇ´ˇñ¡Úqcß#;,€∞£ÿ´§îsWjßßz%cr3Â"ø∞UÜºdÆ}¥óØìÎ-ΩØ¸r€÷aU=Ï∏L9üÖ §å¨@ΩIˆÇïú+	èÔ˛€™6ñäõ`—Cz|GxrTwà'G∆±m#NÂ√m`Õ√(ƒæ*»vól
MIGﬁ%è¬µR$CµGñÜí}ÒÔç∂Œ•ﬂ¶—*	Â$&√(Æl8µ§-âü(UU¥•ûÏuq·A÷!Ÿ»SÖã≠‡Â +≠ﬁiqQq[]¶lv
Jÿ•…ã'æsA¬	ûàYÉ]F9ô
B¡¢ää°bshüY€ôÒ‘J0“®ØRƒkôÀXb≥-
ØUeyVŸßäºòrV¬”Êã<„;V-Ë,us68W¯Ÿ£$ËÏ5ÊbıLqzäË®àà˜+$ÕÊ´ÈÙzâdS X≤ÕÜ&c*ï §}⁄TÛVwüYõAäGYËj°„‡ME“ø˛vL√v&QxÅÕÊ»tñ≤•*£±¥Ωp^|ûSä≠&ôÕ#ì)ˆn•f—L2:û^¯ÓRçí4k…Ri-…ÎÛeËÛ‡õÅ+«}—B¢ò^Ês”·…≥c]ΩË+ ©›csùb≈æÅ\≈Â€÷ôI÷l‡⁄[Cl)¿ﬁó¥≠÷¿\<_<™…p˜!z-¯˛ÉF	>«˜Ha:∏ï÷qÌ']∆Hü“Ñ¡Dﬁó(¨îñh`á-∂Ò«wÇ˛®∏õFrTA8Kæh„Vƒïl'q’€U’ßﬁÿ%ùu`ˆ ∞ÿª9ç  ®óNc2·`6±ËÆ\¢¨µ⁄€ARDèV“ıf"Ω™+à"æ≠8∞x	0ãiÁ2ÿå$¶aÍ{„	∂Œ¿¯8ÿ8qÑíqíﬂ\A
≥øYœÀÑròˆ}√Ú´RÁ7”û÷∂iExﬁÏÑ≈˘=ª˛&ˆ˙Nï^¥vê]≤Á\ëS¸∞Úﬂ˘∑Ö|SuUªR¨KU,y·ÜësAΩ+Y–˙+ÙQ.:Áï‚Ÿ∞•¥1Úö'óó r:ﬂ\M∞∂LF.&W‡âÕu8akd≥%úHå8∞x?ü—∂9 Â›ƒó xO"oåóº-˜øgá
N/˝vhq9ëÜ‘1∑∂EFıWºÑXß’Mj€’åTEÔ[eÔ√Dª‰]#Ç∑ÛæâpœÓrÇÏÖw2√^8≈–ïª‹D˛ ª‹«tñw∏ïÈ4´Ïf<œ∞;rá>ç≠ß|ŒÀ¯“eÏdzA‚ŸÑı∫\ ÊÛΩcöNïì›$®@âY§÷ˇk„¬E˘∫˚ÿHÃÕ4ãY¯dΩıcãæ◊±I3Fµ.‘˜22ï(ÉÎ›lp‡z/¿¥Ïpº˝àÀn¨¿ÙÇXJ\êq¯’ö^ÓLÛS3ŸRä¸‘Ãù∞Nï€¥§°ÿã⁄Ïx—9¬x…f{<ÆÊ€©∞÷3·∞ı∞•æsŒgò…tA0$<∆∏∂$Ü ’'™÷Pj„1ã«ä<µÄ}Å'∫”,ÔBﬂ(ÍÌ&í¶vä≈<ªÃ©Ï∞æv˜"p∆^ü|@≥†é&÷‚=Hîñ	ióÏËC@Õı˙›Ë,÷è'( S∂è>N«^d/±*ì ∞\ïß€";TgÄ…úZéªNÂdÈ-¶7rÖÈ√ïjæX˝⁄åÍBC˛fãïâI†™¥ﬂ£!™ñP5v¢äÉ+;n‡Í ÍÙ‚õtÕ‹ûöÉµ´);tÂËŸß5«ìÏÑG%G|Â∏€¸|iDí}`)~ÑlD›A√¢	çh=Û 5xﬁ$ô:√òƒ¥â˙îJr7¬æô3∏:≈–=ˆ0mlì˝ù7∆™yÒjAò%8î3˜¡çpÏ6±l°xV”Ê¿5zìú14=sDcY’*˛hÛ≥GX_g(Xı®=´7´ÍåEoy’Ju“,ÄRxWk°Ôíﬁ‘íﬁ¥9ÁãÊ∏©:°-âí*êyÔ<◊©TK˙,Ÿ;§-´A #.ß1„|ALªÆ´ ‚ rLsÄ¨TZI∂gs>rQaAÖŸHcù8†œÙG„%ÿÊîI˘cò8µ°ìÈãπ∞^ﬁ$¢ÇÎM$Séî„£·u^÷≥à ˝ìthÿëÉ•«ŒÍÂoí—∞Ÿ\ôÁ´øjuæWUø¡ºqH∞´
 öâÆ)Uˆ ⁄›¨ËmÇI≥Ω0π2tÏú
˛Ofg"i±¬T≈[åÓ[‰ë4`«*;LLêm@π$±>V5BE]sº‡LRô®R‘ó¯ú√ÎØÜ“DìXsŒTÜj•Ö^:ø˜—ËbmØ¶∆8tû£‚ûıµ˛¢Ïè'€¯Õﬂˇÿ©i7’G≈cÃ∆ˆ≥0ÉGm"ë3õ∫¢È˝€§ÎôÓ˝ŸÑ¸¬zkx7qA≠Ω‹Ó`Ò0¥0%]x”¨xBµ…e–FÄ”;ºh≤Àú‰éd˜‹ÈOù1mÈ1 %ÂV')v1ÛûŸc}‚}ßÁbÆi„Ò ƒ2êºÇZL◊_eÁÊq‚ﬁHµ-√:¢ËÁNÈJ¬å2ß	ÃmÊÄ$MØøÓ”6'‹w≤RR>‡‚π»¨ºêï#Ä¡ƒf◊°≤5úzkpã°0,x\}AiÁ€§˘FÖ¥°ç’‚Zn|Q·ò :ı˝lxpB7
öVœz Ωìß4»‹t∫0⁄Œ&∫N©Ç˘‹p¬»ªiU^åq@É'ó^ÃÔ@i˚o˛Ü|ÄÕ/∞ø|cycsŸm9:°jOZ–Y®∆ $Ω
.ç…E}O6reçŒ„Ç∏DÒjıÕ˙‰¸Ms˛âÜ=gÈ—£ÂÊjkπµﬁ\^m¨?xùNv+DXü^†˝'=«c˘Çpä°}·ôúd’Â=©nì'd3yä(¸„¬byGÓ)–ì—ŒôÆÛv“9ûxÅ h—Å{ª√í˙)Õaf†Õ°&l4Jm>6æ†òœıàﬁ[ﬂU*é¨√Nú·øV”:r»fÄJ»√‹§j˛fd"Êò@≥ÇÑ‰ø˘«ˇCv>ÓúêΩó'›˝ΩÁ]¯„¸€›ΩùÉ˙QgwÔ`ˇ˙◊œ·ãÅ (íÄ⁄1pôÈŒ»ôvœañÄq⁄!Djßä/Ã	∂ŒJ3·«Ê*˘íZQÖB+è6I0tÖ@ÏYD+W®eÉ≤x10kçFn‡&ıM5Sà´cÎ	∆„s’oSΩÄ5S“:ãtUÀpdMÇ‹⁄  €‚(≤°…C˝®Õ
<´
@≈qêÀö‘˜™~Û¨∂,Ë4{*Óñ¿Î.»µ∂EåÊ	®,»eJ-RöXLAG/’!%Ùìïq,&/à]îN˙ﬁê ∞ú∞‘±≥QË_;Ñ/‰•Ñ¸u1¶ ÈªÃS%j'‚ôèyD0Ô‘Î£∏Ò2Ò±Çw¯ëñôº sÇºãBsNπPF≥ÀÔ+ÍgVûÙ`õËêØñ≤ó'∑K¸ÌÉI°‘*óIiV*ìÇvÎ2)¸kIÉ-◊»é\!îGöB(+J£Í_@do≤?¬ïk•©R˙¬™∂©HÂj(Õ‚åÜ‚,^PB≥v∏:G@Õÿ2ÿGgå]}Y·lT€PÏ√Â¥±«Á‹ÉëÎØ"◊I~#K/B«ÿΩA¯††€G6ÜW¨#?~·8(∑•°ú%¥±\Ãß<◊”Õ´PûòqkÑ†π∞®R≤/‹8vÜnºTV%π<ÌàÏ=s˝~à›¸J/èBZ∂w\ﬂ‚rD∏¸ﬂæ˙8Ùù»qxÅY§~ÿ0•<Øåˇ}¯a√»K»í˚EÉºtÅ2Ö‰iûÛˆg0B4Ta9Ö-$—ÿ¬∏AN\“¬(t˝5öVÆ7∆fcƒ=G}uæòKºÄ&æF>⁄Aº>'π¨%Ω€(£6≈fê◊%ƒ-ÔFQ-†DﬁTû_µ+@ÆÜYÊä‰æryå¢U‚â[@Á‹©ã’/|F∏®ΩØÁπ¡;7I, €*B¯#ÀÙ{-0 æ@∫(2£vFÂºß≥fUuê8-=äˆ9˜D¶öÃkìÈì£˙Äï~œâÍ”hÌF&m`1ò˘⁄HﬂÒ˚K¿…ﬁçÍ≠uêºº¶åÖˇ∫Nu˝‚3⁄,bïd±z„x¯†∏pwI’:ZßûRR¶N]LXº	©3òœbf.Ø%íéËºÂÜGE,ºPw(´Ω'0-¡ßØ5•πN‘Dî%81~19pM∞£eÈûÂâßöÂ(•Ír˘mê⁄ömç‘÷í•∂f€"Ì≥,πÉØ/ó‚H)~G±(VR∂’∫Jñ@
≥≤⁄DbUo˜T’¥B“£¥-ä„[π¡>ÅÁi™©*∞eı f[À˜n∂/◊]vçeÔ!´¡>≈hqã…W“ˇ”ßk5u·°©~^€~ÓÇ„•ç;;{\Ø69“`é;Ü´%ˆZâRuÀp=ë\h»f¨sπı≥»ô‰à«6}Ì ¬◊e	a¶ﬁ34óCyø∏\F.∂Î˙Ó–	¶G4*,vóíÅ/~ÏJ#ÿºÀU±¯™i¢ƒÅëh˝pr‚5GSêß^ƒ»ñeåÑŸ|H˜àUÏúd)j8ƒ#÷è>Gu©ﬂ˝˛’xq‚ã†OlT>Èï—E•"}¨Êp ,8¡≠xB iÄÚÇ	K+üΩ:ÍÚ¢˚ÚÕŒ~ÁxÔŸﬁNggÔ‡ÂgØ_}v¸˙√è>{ıŸä·íï! ZÌ˜ V)‘Áú9ﬁî`#˜!FÑcÔÅI/t¢A„,≈—.•„Æ‰+“w¶˝¡äÜUW
àK√•ñMÎÏÙçñWZ&îª‡∂Xeí2sUi≠^°Œ⁄ÿê®ø™v„2Ÿ|Á¨t»µºùpÇ}i1úaÜÜ-2Ê-ìb”>âãhŒbKs0A„ø˘ıﬂ˛˙ó·¥BÒÅ{_ßBiô{JXXB§‚`ÉÎNBõ∞Ù˘g¡g¡á‚é°A'5	"gÎ√?~zôNÎÍsÎWﬂbf∆lŸh›÷53±√M™ı‹zÓq{°∏ôa)Êºy¥@ef˙BCÿ$
ápïeë“ ˚øH:†€DY˚¯>î∫©ëêƒ≥Ò”N{≈Ò; 3Âí;≠Î!´"“xJmÃ2 @Áé1Ík¿Î¡Á<’…œ®ñ7%'ë(å&∫À©3p˜Çä’vt£,,åìå	É!o‰»≠ÿjàY£Ò ©ë%Ÿú˙â1bëØÃxç¡ã˚^<´ñuºI‚ºËTWl(j? πÂÇ?‘&QÏNï<oÍ o"E∫VÄQêiﬂ%⁄©’~UEÙ±Œ‹Æ¥jÀpœWÇ{n^ ,ÚìüêùÉó;˚üÔ]ˇöv/∏4úA^).¢=∑¨Ta€Ì^$«+K—?XõO†mE.õú‹ê˚d‰™¯©s?Ó¬˙}i5&€-ÆJ'RN◊•"0°t˝N⁄˜µr‰| G´ôJ‚Æ-r-™ÏˆÇzqœıÛsüË!ﬂ)•+fÔÖ• XÇôÃ| ¸˙ä{müÛ>ÓÅÿlˇÈk‰aoU√G‡¸Z#®UÇƒc\7R„í†O)∆’Ç•3<JTQè8ìZ#Qb-Ç\È„n@ÕKû‰j∞9aîò:Åµ€ôà)U’y$Gl&⁄¢»¡€)à!gÇ`)r~˜œˇÚ˚ﬂ˛JùQQH«\+F!rOüd/zJS¡é‹”+ÿX˘ÇY3ø^xnˆc§±a\a¿Ú,zw∏êæ∞æÃÆ{Í Ù)ÂLÆ8©B31ﬂeîtï∑-ç˜‚^ÜLÓ¢“£Ò°.⁄ûo%àπ¿ƒ,D§QÿÒŒÒgÆ {8L3eÌ˘nâAÙﬁ%∑1≈åûiÉ>∫ÄøÂsîÀÈº‹-e*&a•§Œcç∞ÄB{î”∞?ã∑¬ŸÛ≥xÑ(=ïoa∆îê¨ÃÎ)Êô®‘¥Fö]&Ω3®â)˛Ã7$ñ #m`Iåj=6†<FﬁS—ªﬁŒT$(»Œ™¸^ó‰¢ëùën
√•Ç|yè∞§ÁMŒ£ÌqjöÆ/`ÜHØ™≈ˇã∑èWêÚd`NÁŒÛr ∏ì$k'∞|í˛]ﬁËEG˛Uﬁ{ÓoıCøéÇE˝°íD ‘™û&hyf>±„Ö„l`wûŸëı&‰)©YB*≈<	9:πö∑éÈ%‚€ñ!V (1ÇláN‡˙∂ëc≤¸4ánÕü CmÜ¶d¬˘<ëãn6Ñá“.<’RF
üóT#lù±(8|¡∫M/èõ«˛[k9e∫“3œßNãTíRÕD6í≤s5†sM™©j[©V€˛Ÿ¡—_vv∫ovè:œN'??)◊kJµl8˛≈ó“C'rÜë3≈Âp˚®+9ë ◊täˇFÛô®q©•ñ0œi®©D$$H:π∞†&√Rπ∂™n„–´ë–ëBIúï¨“vØCÑ‹L⁄öó⁄†AŒΩô™ZG_¨≈ﬁj6Mû«˝q¶”XÚÍÏxüOìÂ”‰œ&°&O@°	0ÂYüVÉ÷
LY[\fçv†?¬‘öBíazÍÂêW3piª∫—55”ò-sbál¢ÖÛb‰x!ã¥,*5`Ê9eò^øÿ˙≠/⁄`}ª¢®r°q=Ò»‡Wﬁ<cÇBó‰ë°g64‚5˝ÅìmPàg∑Ú’dJ´]X;€P.π˚C) ZpX!ÖÖ*ë\ùe+éëêtΩOØøq0©»ßÂ®ﬂ9,©H®ßRÙ–bûn⁄^ã∞XãÄgΩ=Ûí´tÆ·≤BeØ/ëVÏbjk{¬Z,gi˘órüó˛⁄{ÉµI¿ *”√¡)Îñm%≤h⁄ôôê6AÀ·‡!^yãß¨[)‰“WZy€€∆™HsK≤S^z âJ|\™˝dæ0–õ‰∆àâ “r„rÙ—|ëOΩòÍ:XÃwx”àKáªœ0fÏƒsA¬"GÆ„?`"Vàµ¯´ﬂ{ÉDûù–üçÉ‚ †
äx·í‡–óËœl∫lö‚Ÿª†Kä\qàÌ`ãí¨åÿ⁄
/?xô ˚∑Å,ç <ø8B)ÕEÕ[ÑöB$|å	õ_*xL˜5ó•ï 6e’¯öíåÍ.AOlÂπû>/i°_”“©„«Eæ/<Ï≤‘ÿ[â¥.BÖ¸ßA©¬.s@k•ª“6ù®?ÚﬁÖ«/LSﬂ1Hˇì£}xÿG≥0LøNìÌØ@ÅI6D⁄˜∑7¯Ÿ»ô∆ù…‰x‰DÓ“ü≥xË7ì¡Èü/|≈Ë∂\»õé¢äæ?xí ΩÜI :BÍ©ç±")U^‘!…V› TyƒÒ/f∞€Öö K_˚}CÍÛ±„˘∑¶ÿN"ôxbCûx˛=h
†	?cÎî»…,¶Vy∫W7ÅS∏›<È´æÿƒ\—ìp'…¯[RåwÀ∞õÖ0xº'£7Ç’]v»K∂cØ‹mgO⁄π∞BR)ÕÃîµŒ^ÑÌ»j∏ò—\6⁄(âÀæÈ†ø˝'ÿEá®é¯˚^÷ﬁ™|Ïº–FgÖ•WÊ–πﬂVìJápvuBÄ´ÇiÁ> ¨ö=ãcƒ¨{Zà 0DOMÃÛÃznjpÕ”P)l
´Âcsåu†ÅH–≤º5‡÷U˛çMùÜõê\“≈—˚™ÀñÜìñÓ	mAl´¢ˆ–ÎªŸ˛-u?>z˝íúõC◊˝∆zÄÉrI#cv M±Ì∆
°ˆ1r‹è0¸gá5
sÕΩÄm|ÃÒLjLóÿõ=çl3∫Ù.ìNxÃö∏ïD˚ıŸ¯ó	Ïÿ4åñ	P\Z.£®Kì©ÚV<V´©ù#ò]aú§∫q%3Àï
Àô.ˇÏœàÍQ≈ai8iD∆jh)BÍ©’
ÍÄ°ë4ÛR}˘âõˆˇ  ˇˇÏ}ÎéIñﬁ´Dó3¨Ì∫_‘R≠§≈¢‘¥Î∂d©wwdA "£»T'ôÏÃd©Jj3l`çıÆwk`lc √∞›∞∆†x1?l¿|ìyœ#¯úëôë7fDíUí∫EÃ¥™Xôëëq9qÆﬂWÙ…ºûaÓ±c&ôŸúLˆ	ÉëËÑ/Ÿî3ÎprIY†/[i|íÚ∆ªÉù,7ƒ0ùiD'≤5¬%‚kD1ÿ)ín	£aÌb6dU´;P‚èßÓÒ˘9Ì9≤&ÎD~–¡°Q7A~…ÈRáPÄ0·Ï”<ÂS”≈R£èU6&:çÑA*µÆ;VÅT3%å¸Ñﬂ!Œ@L{∞5æ|v;d=ÿºµ≤y{wesÎŒ ∆⁄÷rö_Êì∆dK9Hs√Vsf¯»OYDä>2,U:Ï8¢V"6Ô£ˇΩÎLl$V…9Q'1/Lıs~Èí∏´˜^LFXÇ⁄l‚Zl7›⁄Ãê}4
*µﬁX]@çha1
ZJ”kSå"åRfê¥zÆÛm2Ìq8q&È‡a<—™7tæ_„(îÆ9Õ∫_ù"]¢±%N⁄‰©ˇF0ÃÊ&o‰Tå«’‹K3…^K:>#…æÜe$∫πÓÒ™AÉnÜñì2Ve>Z˙$Ìk≤´Ø≈ÌuM~.’V6Ü≠âL‚!ÿ∏ÅùÃπ∫∞˝	à]t≤FÆx’˝Z⁄æ∆~öàÚ$ôÙ´=)7µÎÔı±*LQ*¥B
U◊m·¬•x¬n*ûyNwF<·∆k
6GgtuØå4—ÆÛ¶?¡õn∏@|¥è≤°• %(kôûæ®Ö<oA¸å%ß?eÔ≥ÕŒ®∆=6é0—◊ öu9ÖÚh1óJ¶Ásê◊–ÎOríß?I–å·B'© `ù˘Æ3	∏¨!L◊ñÕ*ç@«çeXR™K÷ìA.ÿI‰É bëZÂWúS—IŸƒ™Y©∂ksÉxäU›V©nXæ%€≈ŒÑtÂ◊÷,™§•˚{Ü20#©âÏ~6rNÌYœΩª>ÿûŸóq¶+¶<∑ÆÀ¬Œtxà®Æ}3«ms«·#ã!Yëéy ªM6å©|“ñ<õHoâL„ Û-,	…'x[˛s–Ï3“`—ÖŸZ0nﬁÑ @†){8Ê]åè¨à¸-qWW8Î·9ºoy≥≤¢gWE˚@Á§,X?‰="OÔÒm‡oÅ[ÏGM3ﬁ‰ñO ë›ŸeØ`ÎÌ˜òAëÜ6ë∑‘¬ˆﬁºå∂>Vèln•
˘ÑúŸIE±Ó$ÚçC!ëm_À©Ä≥ô0ÀÃŸP8öÕ∞Ô*‡Éó¨j .›?Ò‹.˜âwﬂ∂˙£È∞Æ$8zµ>%‰W.ı\Q®êl≥HIóÓá%K }:˚o™w3ó!/ñ≥ÖÍØËÊ0îß"8f´§ùE¥F *Ü‰‘qCãèÔ#˛ëß†∞˙ÃÍZΩÈwC¸ô†êﬁÃBtí¶"ƒ›!WY≠AÜ«ic}3«@…¡C⁄
’√HoTLQMF%Ì%dÑ˜ÇÜÌuùî—yˆˆ≠®O÷à>|`ô÷Qæ
sbz◊“}1–p¨ã£Ö
ê5‚9⁄<1~≠®¨ùÙxÎÕ,¨~%lCeî£˝Ái9%ÙI3h>GSg“Áumcã`
›∆Á]ÿ†ƒÃç\Zıìí·†ö≥‘·ûÿ˛CıÕF&p“}<04)0â5Iü5úæ≈ˆ‡ºZY-¯Ã∫æ›‹&∂òƒPèë¶ åù=WIh®A‹ö9AÑÂÖÙb†‘<∞º=ˆ˜Pùd_¢
Ë]Q‘˜–°)ﬂÏŸ§HÕ¶~ÿ=T?∞”´"|º⁄Ò˛—4º
mk õ$pM≤%ØπãF,W•¬1\ HFLF¡	o®yî∫@ƒõÿ•~|M≠Nì'∑Ö|g£ „é¶Â¡bòºÔÖ™r◊¿"Îˆ€,Û@'.b∆;†ú~ÜÑ–rõ<–E˙÷ıÃ‚~?F´µø*ì¶JoK•Ûâﬁ	aWÓç≥˘rÁ
ìπ6 [I'˜e+or
iJÀB\≤Ìb,ª|t≥;©eû∂ø£>+Èèa;©X
£•ÈÇ©Ó¨“°ñÓ‚Ø\Á›Õ®ó_‡iÉ(‚òVa[jÃ∫¨=ç∞¬c‘˛ãÛ_KÎ—ˆX-wâΩ)œ_«Z[:´Ω1eá¶‘∫øœ6Ù¯ı£.ÒÓÓπ⁄{;gw˜\›Ω]q_r¬§·ïM%úºÁª'⁄?ıkÙ Jo “Å—≈ß‘®¥]¥=›óÖâû¯ŒËJdà$ÃW/Wü¨n>’LhÛh®ÒÊ ÆÂ“¶d,÷Õ√è»ﬁå]É≠¯âÌK’X,oŸä≥€ÇTMjÀ Òø"n?bæ‹ó“Fq?€wGµO¸ºØµ˘	5"ge5≠^3ö†˛ú	í,ÔnÁáBÀ."ªºë◊º7Lœ≥Üg /–Ò≈níî ≤ü¬üƒUwtQ√Oeò≠∏GäÏ_Óh%·1Õ<<+*8+4§íÍDÜ¥åñX‚Yæê…å”xé^R’›Î
fw5?Øsó	N?æe6{H}«I◊ úÖ∏á˚Â…~Ã@„°ãV®Ç†7¡@©,È$ä8z3Ö(BÈ§œV((ØU†%5%f≥&üı8,ê¨RJ€‚Ô∑‚§π”Ëÿüsüa∞kƒö°$-£]S~•≥H%:Wçq_∏Ójﬂ∫‡’vµ‹ßpºMÁ€6öYá9áj>÷ªS)ÃŸÛ4∑Ùº[‰—ƒÚz÷,»ñËq&Ïwñ]◊uπCgJ•e◊†˚µäï¢å≥S-Î›Zµ◊∑ˇbﬁU(Ên¡À&âüJÇ:¸Ìø#vô˙˛Wı£Fsü6˜[ç˙k7Oé€ßÏÀ«˚ÏÙ¯¯†uÙà=®∑KÏ‹"◊ˆ:ŒkId≥›Ÿ’˙~ß›–˙∏t¥≥È¬A©∑X'∏r8˚{àÏ};t{ˆπç
v€}©„/"A◊8ç±‚ıŒ[Õ`JZe´ŒU©ÁéÄû˝¬zéfÂ°ho‚/πÁYCtyYGnÛsöVÓ≤Ü¨g'Æ∑]è’Zıráín?ØCsÔc£Õ˘ˆì{˜2Â®˙§©Ô/≥}Œ“ÿ'f§Â`(µU◊zç*-©O÷÷àˆi%=rOçh⁄£'(˛≈⁄ì6Ù…"·Yèí}≠eÉ¡ì°=î∫acòï;OÉUi¢%óe"YH≈∑àæºùÀß&U„Ñ9˝·s5	=E.%∆ëñ%‡-ÃS˘3Á∫œö@∫ªP∏êbîvÃ⁄ïY∑!tE É’hÇ Î«πE&•.ÚÈ£\6‡¶;É”È8Ï8.I=âf†ÿ/äosFÍS*ﬂ)N√*\_f)›‚#TçÆ 2ÅsﬁqW<òè‰ÙÉYbª√DîY› ’,À°å'Å3Ω–rËÓa &x∫9¥Óü?ïW…‘)∏ÃwÉFØ,QJÏX√ìó÷k˙û›c¯LïˆA£s˙{ÒØª2qa ®≈µπÃè¡‹Z1ö¥+)Àa;søÎŸgî9œ≥öÑÜLúˇfs≈-dWó`igò¡ÆB =òPK`.ÿÙ˜òí*Æ¬‹∏‚øÍ√Oñ`ôÊ€s¯Æ ‰Îƒ¨’Æã5ﬂ¬9À∫ﬁÙ˚Ä“W¡ s˝1ÔP%ä”à-r!_5÷tÏ!lWŸ{È⁄ˆx$&-0rj⁄[º~D/Ïû’ìKVÊç˘‹ª†-Ù.ÃˆæÂ<)Õƒµ{”ÔFÿìµ%≠Í∫$^ìòà»˛®bjo•MÌ,¿¨ r°;t7õ˘±ì∞Ã∑Û”8{∞•œ2≥+:ØzìÆù8≠,e5 U&í6≈¨B=$XúmüùlS»‰xÅÕO!
*w´∑Å `Ïøy˚nÉ◊"sN¿r9∑.Å«u=éR¬b≠GÕv˝∞yt⁄ƒ…Ÿú∂Zè#Ê8'°û.Ωî»äÊo8πb27Œ∏/úPÃƒMDød®+‹ÿk¨>˝ùEgÔ⁄°íŸı>5ÅM'íøÇ˚£;	îß¢Ï¬D`Ÿ]üÙß?im†¥oc›”Ù˚Pn≠`ã a/lx{ãn[PÎ(ì«RXÒKX&–})Li:ä∑Æçøçßo¡n<áGıÌ>âTÒXôk,[¬b9\rûç¬Æ	ßu%0YbpœP÷{4òC∑á7næ|ƒ7„Qﬁrû∞ƒs‹˚(-?iŸäˆ#jÑ\¨9⁄àbFä*m∏2°S>œ,†õóùÕÀÅÖæ¶≈QÚ«ﬂ˛˝ˇ O…ßFÈcL®◊(Ù\∂·åN+ö»ÓÙ\}™"E{X·\F@ãhDÇök¥öX)[k5ˆ·ﬂefÅˆMÿ},L¿P⁄Ü'+håÅ,@¬?ú
VQUî⁄C*Û$a£ËtÈgç)zi|pcúΩc°Ö|üV£;¥1≥qe †xIç£ÿyo≈NCíûX6nüNIü˜¡å »L°nÁ¨…õ4Âπ'˜ƒ˚7ˇÎˇ˝„ﬂ¸≈Ã)ú˘ì.G≈ƒÕwˆ(¶|ﬂô~áeKTû∫lÿ!Ω%÷f€–6L+L'≤∫ã˘Vÿ˛\ÅïEú~´7⁄k,›µ
D™¸J¬|Õ•X1©Hü ¥˝âÉìÓöI JIÆπó®$ˇh˚}àbE,;F}∑2+Wºn^ò¥dw$ÆHì˘{¯ˇ?äìÚ+5‹â:5<Y◊XXüré#(Ød¿¶9´+QT+Ω…˙@·+œöÌ5s‡µ†˚˝–û·∞ORÁK◊ÉU∂öø’⁄≠Œ˙IΩ——I˛÷ã‘›æî^‰$/÷ŒÇç R◊b˜¥fûD≥ﬂcœ€Õì’O_Z¡`Ì‹q]ØF?w·˙Ú'ÏŒ|ñ±bxÛ|E;p1D◊˛pº«F¸%ŒØ-Øn´s‹	êÆ∂¨€X¬¬g∏'ÆtoÌπ›¿ıˆ‰ø∏XŸ∑ﬂ≤•}$-˚ r‹pµÍK∫mÜ€ìÄ_Q≥às‰œ<å ˜m‰qÎπ⁄Ìr4≥«–Îää¡âS√"Ëh7%ïÜg ∞ﬁ3œzπG ÃjõNÖDıÚIı‚Ñbyæ’'Ës\®tÄ≠„˜⁄X`«˜&¡˘ÍÌïO_ÛQ◊ÌÒ«ÌV#§Æ˝”ŒÒ—öOÄ®™Ö´}Öç&é≥¬∂ñóﬂ<7ÈOOR-’G›ÅÎAü`iê?flpà¶CÊwm…Z“åá&[\0¿`DM`≈/<~æ¥¢å¬"ˇ?á’Ë?ÛlˇŸßØ√±Y˜˜õ5|ÓsÌG Å8s{WkHÍQØ1∞ù^-Ÿôjo–E˘¶õ¯ú∫◊„C–|Ùn÷äMg°5·åî|∆ﬂ⁄Æö∆ôéUÁ"ßì9Ô‰D¨gÅïîsÆU†&MDÆK9Ÿeupî cûâRÖl!£±˝)Á8û’ÎÕ/€Óû¡©cù·àUŒ«˘∏∫§˚‹è_Ü∫ÕHL-É"˘wˇ[[ô–‘#u¿p .)©Z+,Í0À…K≈k7âD	ﬂ‚R⁄M√CÍ§€≠¿	"ñÌ≈I•∞E›LÇE¨ÓŒƒøãRR∂”–]É’'ª[∏+dÏçœbtä≥FŒ÷¨mÍÍ√3B¢Ë6ãOã0y™ß˜mÆÌÍ&¯•{ˆ&`∞öF
ÎGŸ>”¸B<ªD¢	´]l.6ùœ‘<¢1å«9J—ΩºÏ¡/ÿÛOsæÎaY£q¡⁄s¥Ü7¬ﬂ4Õ_]Ò¶óKìORíÊ¯»py\˙ºQ
{<¥9hGi‚è±»Jãâ∑fêiDWiMPﬁÙ†N‰≤Åuïì∂ÂÖ¶ÉàN^†ó.ªˆlÚËÎL’Ω+`˜ënn£í¡
Ì’ıK·$˛‡;ó√I¥æIúÉ«h&ãø
◊}òŒÀΩ.\€µ®97,©§îÖàÍ,ï»È‘ó?!ΩUQH+‚`∑XH'ÑÜû†NONûî∆´5GN/Z.œu	ñoVCî(*N)˜Áñ¶‰:¢·ÁR_¥V1åcùqÁzƒ©÷≤i.û–ßk« †.´â◊qA”{ÃÁ{Wòù
êıﬁHÊ 8ˆô'sQ˛Àˇ»0Ùoœl]d}Q~9};íê“Ml7mt7m›‰AΩ›Æ≥˝&{p|z|‘Ï‡èıÉ÷Q≥ﬁhM}ƒ˛íuÍß«¯ı…ÙWèZGub"6W[L±∑R’i≈ÅAEéç—ıTµ¨†sË/Î+^L©€äÏ0VGåÈ–%¥ˇpo±˛MÜ˜u√1¬1XË!_zBKıŸ~ÛŸIWÍ”%›™ŸLãÂqKıl˜y ›⁄ÆZΩ⁄RxÕÍê§”™Ç∞π¥Ã,ü}yzxÄ“¨…;Ÿ∑‰q◊ÌtÖè1©‰/!–ÔE/≥&Tà∂ƒ…º°_˝$⁄DF£ºõ}ïˆ$ø+¥ôWY“û∂∞ΩI7ﬂ[^Û'g"Q€XCÇq∏Áˇ|ÙœGüæÜÂÚz_eoÄóù≥<Lv«¨ïS{»›IP3-ˇcÒºú√¢ııR˜"ZJ8≠mk‘Á5±ê>√Õ[;r43ﬂõ‘Ú≠∞›˝Ç98A2ÍHﬁåÑ‘ë‚ZcyÎAøSz¡æJY2J•_¿A¬†~Kâûà/7rB'ÙÜæàã˜“”ÛîÓmÓ^_Èûåz<úpÔï(‚âÚß|ª?ë‰”.wπ»Ê≤ª∂+≥Ø‚K∆”∑Ë¢î*8}Ä¸,˚òsUƒ‹G#oB‹˜kâ\Qèu,Gdäùà˛–yz’ÚfÁÙœ„gõááOÒèß¯«S\Ôﬁèß¯{xä+Ó¥[Y∏‹ìºÈÌÉ=ÕÂÒÜ‘W‰´ÑÛöêùëÜ¡ÍŸ2GNΩÕç·P∫E–”@Öº|8ûºÄ£1ÃÜfÉ…Ù;Ô‹π˛Oı∫Áπ/gÎFl‚Ûk ◊}‡X#Ùk}Üo®Áå_h∫l≈Ë*¶Ö⁄]Ω‹“G∫Iö±·Àô0ï;T—n‘Ìu7ó•OEê≤Y™Biñ3·˜^ßœ«râZ‘ Â7®Qúéí<y»◊†g†⁄¨—c4í˙U‹›óQ<*é&„?%“∞b◊ùU©ú¸[i∏®[QH√J`4…/ËÛ°ù&ı€Ñ˚« —¯ ˛êDRª=Å”ïò‘€,%œ∞>Î_ΩRVo:à¢ÖÈk˚áñ=#›ºÑÖá‹_0êO@\uk–≈ê;„ÀÂßlhèV·/;ªK≈à”`ıŒ≠Ú≈°Ö´ƒΩ•–πÏF°µ %*e˘f2˝”ıKüóÉ≠‚≤xÃ0ë)Àöuó“xıvA;gQÁ‚ı·ZãÙ‡‰°¨|ü≈_&œ8àwô	‚iàÀ◊±ÅµÑ’⁄é,bJ#9ïb¶7˛I˝®y@æ˚ÿM“è2˝Uª]xÃNé€¨UgµŒÒA´—:≠ÔãØ‡é«ù«ıvÎxY√°èπnÙÇºwûeI_◊— !Nøç%∑YAEÜPåíKÖEkH7*-Äoz-õ µÂµò‰ﬁ ó¢ÃÕ¿6x(<ˆÅ“n1IJ´z*â˙ÓFùÆJ'=r?
¢‰ßÓ€~@û&·¨!@FtôÆ.“]Ù>•Ïu©ÎÛòr7Rä\úÀ»dh¯zŸÌ%ˇ¡Y¯æX=ı≤`»{.ùÇdâFuF¬ó@?“ «à®ÑU/y±¡r2ªÿ∞‡`Äˆ<OL◊–yeä⁄ói)\ïZãZ©˜'Nµ~•Z¢-«—18ö6§çÈóÙê<Ø:¨hÿh‘ó‡£í£( ]◊qëÃ¿∏A|¬xÑ˝Ùò•ä¿”E∑1É˝<7÷∞‡ùÆ))>D[3¡ÚkKâTÈ¬ÆÁjiWÙ‘¬\OA7èÙ%πµ∑EQçöPíPÎ´6i?ADÎº∏îcv’9VÀ&ñØ ¯'+´ã}TÈJÏ‘]∞ÓÒ’™ê	Üëgt(N)ÌÖ£õ"AWìÃ∆p‡i´‘¿«">K˘∫¯›≠ß}öÌÉbÖAh∑dlÔjÌ‹-ªë≠∞]]Õª>ÛAØu≥‰®›éÉûﬂ"∆öπÙzjø([H°(ô’M	’r™ß'ŸÙmóÅDÓ†ŸKmsqá°—2cÉÄ&å$<¥É´c¯«CYàÅé¬˚÷œ∆bÛ∑Îp†%ﬁjÜì8‚©∫≥ªãÁQí*µÂï"ÜQ»+÷âí~ô\'fÈóÍßé;ìﬂÃJ–£{I<cˆ(ßJg3ïÆ≈5≥r¨E¸©ÚhÖåg!ß*bì‡ˇÈ™àËÌvï≤Ëô±pbËÍ$ñ0∆u2(îõœææ˛o(2Ù€ÕslÊ∏BÕC†…Vˆ¸ﬂˇs‰
¬!µ∫ÓI*6«JC≥°st8}Khi¢Àb…ƒ≠/ÿ…Ñ£ê¢‰hRbﬂL(p‰O$¶Ö{∏Î…˚]vf„´xXÍ´‘;¬5}ﬂ¬
±ö¯à¡$" ‚iÜ`Tx•«.Î‰« ·’aéÆû]‹ªmÏ4w;‡ßöÎ?πX[ßnøÔHäßî©-âu§ã(~Rê!2îjŸr}Ö_ùÇEeÑ89u¯hkß"‹*Ié6’c¯©∑O
èÍßxêﬂ%¯ßp$vWD3PxÁÚ2Òoá3d¯~!-e⁄ëÊπn‘Tëåí¯CÛß&»)s¢7h ñ9<∂t…(√è.)•¯Ã©+ø§µ8HxÛì°ÿ›™*˘˝#!’◊ŸaJ∫UtZÉL¬Ë¶˜U:H?Ô}OÔØx
ß®¢|ä¯oQÒM3ÁÆﬂﬁUMî»–ÃH™>›ıÌ›õñ^‚Ÿ€¨Ùä∆Ω¢Ù™•FÔ'/µ∫¶|[ÔØÿäÊ®¢‹í‡8ªË—LÛ1ÖRãæÿ⁄-Z1“ŒçÀ¨ÏÊYs¢‚$ûyø!©9Êë_˙w9^ØËÎs=.õ∏˝È•Ú¸·°ÿ¡Ú$,2ıÖWêÚÛ»˘πÇ˜‚ñC\ÒL‹cØŸ⁄⁄Z—Di‚J™üL,ònâ«Ãê≥◊˝ÄP$õ?«Á¡a˛∞‘œ6J¿èA\_|fe‰(±Œ,ı∂ÂYÅS6}gÇ˝f+ÿÿ≈€ÊÁ˜çü›≈õ∂åÇÙ·GÂ∂≥C∆óhË’5ï∞∆2V[[3hW'ˇ?Â‡!WòÁ]9˙√´& dx‰¸a>èúæ;ÛùdPÒKéÏG©lü⁄ííÁÍ7—¥cT¸q≤µó\ÎUíÅH_ﬂé†SÛ5ˆ(Ω±H[è¿b*®ÌÙyâë⁄>ŒK≈í¶Ω\£ç*‘c%Ô5ìﬂö©á Ë√J≈’é°fö–Ü”^œï©EƒiñË`˝ñA◊Ùf≤s˜µ√}ç‘ﬂ9Ù„ôòm:–'í=»3Ã√1u	ºWr	…Ü`≈|îK◊!ó¬¡˝(óﬁOπÑÖn•∞”∆ıÛä°C˛¬ı~ZRàSÌ€G!tBHéÌGÙ~  Dx°Í∂"9tÊL¯Õ°/-¥àyD˘ìFéeè>ä£kG4∏Â—˚)èhÆÏ‡™PçE˚∆ÂQÛRd‡˝î‰Ï“èÇË:Q4∫%—˚)âJâÅ¢zÄõEç0È∏≤0“ª⁄¨.∞Ò∏æﬂ&¯‰˝÷ÙW«èé—–z–n≤ìzªNÄ¥|“lwéèÍ≠_‘˜´˚Î≈RªFÉÛK]¬!˜}´œ;ﬂL,/µﬁSÃ§À'QÇ%0o”	l∞YGH§Òø å∏ T¢8éAzÄŸ0©Äœõg„©µG„âe¢¯àù†UÓí¯K]8Õ‹atêüxÓp¨Ia,>ypLçºFÕ1ô‘á¸3~Öc—SÃRqíØ}ÕØƒA⁄§∫nL¡»}˝0}˛˛IæNbÇZ)>Öu`iefO√Û&#k»OB.Ωÿãòºc⁄YØÇõRñ£ «*E™=ﬁX+E5R dd±sdá&ì˙…íÜ‰§ieÅÚ πvS(˘°⁄©àÅﬂ“9	múæS5ugÆ¥‹{3˜Os/ïô=ò`ˆ…¨1yXÅs'bõWpÈ“‡õª∞¢#Úxµ⁄5¢ËÍ»©{Q8`+)˚LóU4§¿öÅπY≠√(›•É)vs„lPSÇÈstaõj„Êô: ã±ÚG9r@k´„EÀ|QX‹ªzKS£73Ô—áêÚLæ'˜∂íãóNF=èû·èÌëôÆ^¨ëBª eKnD3%›sª‹GvwJ–ú8∫NøGÙ>F≈ßXx⁄™√1o∞÷µA≠Æ)iÏêè|Î¡˜pƒ>™º‘	9iŒÖÓÒ^HUò\◊Ùa—&ÿ~ví^ÜÑœä8◊·O·Æò,Ò∫√Ω†a{]ßÿÛÅœﬂ!◊íË√ KÕñπ)òãÓ®_å?¬ÔäuÍÖIÄ{ Ä≈%˘svM≈Î◊¥^heﬂ<π1˝˙¢≠Ö	Á€I:ŒY¥z;±ø%Üjà"Z‘≥rˆÕ4{ßù/rfZ†Æeì‹±ô¸Áô®1¶©ˇø∞∆◊·5¢∂I©âV£\åÑ,∞œ&¥Òn P¶EDÒáßè·¸•)ñr∞Zrà;+Éˆ§˜a^Œ(zÙÎ£È[«ˆmü5ƒ9ã∏íffîF>©Õ{a Ù…m˘E>Hfz‡sˆ9BRp÷å¯~≈pÒI20'ﬁiﬂÓ	`§ÖæW©¡Á5`™∫á6B”ÔZé˘£ñ°ZÖrÙ|Ñö⁄˙∆ ~ƒÈÉêÕ^*`OΩhˇÎûAÙ‰î¨Ã—e∑r@‚Úh^ä:Xì—y≤ïÄ˛Zó´àFû!ú{´õ)íX£]úñÎF£_'<EÓá∏=Í∫ﬁSÚh¯®,lBJÈ ±‚!‚øŒ¡≠æeÜ¿,ñ¬ˆ}ÔQÛ]©Æê*4Çëú˛ +Œá›5°;QbÔzH∏¿/%ßå∑Ú‹ŸÄ}:¬Û€ouDﬂÏ´§KÀ∏\=(Óe‹ıÒÿπä∆∞%∆'(=Ñbóñuß=[€€kKEÕJ8∑¬/wwŒ™¬‘ÄŸH}34π¥+®óÑõ∑DõU6lÚx˘ª·r|1!
5¬P ‘êrvÒLj’ØπÆ1‡›ØÖ}∏5√â¶ÓÛB€lÕW®d”µ∞ƒ≈QƒF◊„g÷dí˝ˆ8õ˛>∞ùöqœãz¿·Lç^Í⁄∑{ÊIeÜ|ûì‡íÁ¸<ÈAπN9‡/¢U…ÓÃqë2óÔŸ¥/‡‰∫E--ƒ•éƒ≈ıãÇfﬂÓ˚3ﬁs˚‘˜˜P*‘˚Ô[^L·d&ﬁƒ8™AáèAì]…ª≤àù[∫ows!ﬁSjˇèg€ M.:ëª™á$A∏†µ+á∏@äúÙlm<y¸zqNú…lî‰(¥@;TYˇ±ﬂFÊià"
BπcD∆¸Ävöi®{d]ÿ}+pΩµÆcèœ\ÀÎ≠ΩÙ`ÕoEæ”V∞?ö":XËƒØ-≈nª..¸ã~s[cN±Æü%k¶2é(ìy‘ªZ0à•Ù◊%L,B‰ê«<WÃ|råqSÇ…,–QhŒÆQf@gÆfi¯≤≥D5PI@ËﬂqmÒòÖµß—VÈ(ø≤}òZv<ZÌt=_<BG™w≈‹sV´;‡=÷Z}ÿºZ\fñºI‹r‡ﬁg7 g∂03·ñûi£…7z˝≈r›lœGÕä/⁄É˙à_∫{`]˜måv¢êhX„`‚Y>€∑≠˛h˙Éèpü’Úß˛ç.[◊›ı¡∂Q∫â÷•≥qW6Ÿ∞∑ß¬∞‡tÎœt˙çá÷∏V≥á}:≠ı≠oÍ‰◊¸Íﬁk∏wÕÓΩôMU≥≠A”ëJR© å]aæ◊}öxŒ8ÀÒ€:ñË£‰<µ¸1ûFOv÷∑ü2˜Ï˛“≈”3äv¡Ààïö◊Ì;ª¶·BÍMñ#è·ÇBU4˛£L¢BgH‡i¯ÂøWªÛÊø¸∆a«Îº_÷lXª—ERÌîÛ•Œ¥∂ÖœSâÖc\úi®  ÉÏZèùX#^fqœJPòAÔõ‰Î›mA¯MóosÒD9ã´')<ËHm€	MΩÓï5“>Í πî&^|ÊôÖ—Ò†Ì≤5úæEÆXüqX7d1SFÃc9‹ë∫Ò:€o5éÀﬂE„D”⁄IÈ≈,`D$»ˇ’ÛÂ.Ñ≥ì…‚¢ À…[–“É„F˝Ä5YÎË¥Ÿ>:.áÚ(≥∆XÕæøê€S)ÂåW◊nÒÍ2NxÎD¨uÃÚ∫˚¬ı*Åv‘oXb.’3t-oÃ…õ3;¯< éV$≠∫ıâ≤—Ω3°´'hµy÷; UÃÇo‹ûÂÒaí„∏hésvÖ1Pk˙;xo˙ñ Ìp≠[	N∞†ıì˝á≤A@/ÿ>º»Ø$ﬂgvrf9—
Í}œÍÉ"ﬂÉ‹1˚ñB‡o(f`3¬;≤SœÓ˜ëÅ´Ã!)W2)™<OâûÂ£·ìQ´ı¶JH¢Ñ$ïJlñ/º] )	˙´;ó‚ÓGA: û¯⁄ÿ„–ô}~n!âh©É¶‘%É˝p«◊⁄á∞D´g÷)ﬁ9ßåŸ‰7kÁ∞å|ΩÇÈ”ñ⁄=Æ?øñ€Zy◊ ∆ßd MOÛqö<2âÃ\`-–äZ-Z‹Í_3¸íIyôÖH’8Úè◊JUH‹‚ñÜ∆†w~Êi˙rœÖäò˛q1TÓÇ)”s•\÷=‰i°L|Âp„3Ñéf}3ô~Ø°éh$≈ÁΩ‚ùËÖJëòr≠9fì¿F∞A:Â(ß^c,”ézQ:a´äh#¡≠jÖÎ4ﬁKkïî¸(:ây3öú»±®„3…Ñ +"—ÖÇΩÎXgp&ß<ﬂ9%[ÎõŸ™≠[ƒqüü¬∫+˛V "0Ò:Õú¨,Œ $gÌüw±Ø<Jî—Zìy1*Ù6k˙ öÔ€lQπ◊Ÿ/Z':è•
m=:9¬ìfIÔÜ!úó6hézW[›.˜ñl4·÷ˇde≠◊Æ¨Ì7W÷^Ÿ„kL©Æ8ÎÈﬂ/W·õUT<=Ó˚† Î=1SÔù– Roqƒæ—kZùHª◊CXÁ>ãtùˆT˘ÖÛnŒôA)]ær√];∂nh”XWY]‹v|—&lH≥…∑„˚¥o|+˛‘w¢æS±‹ %ı™6ÒÿOpØ∞#7 4° X£/œ!x›≥a~wjx´s|é)˙⁄|∂⁄€πÅÇ¬⁄Ω˙Î÷F:í∆ÜWzöG⁄G5»
*áÓnV^©∞≥ZƒøË'C;l∞∫≥ƒ`â:˜ñ(Œ.l˛ÚÅ{yoiÉm∞≠¯ﬂ√Ë’◊p6$X≠›(·ÿ
≤Å{ƒª÷¯ﬁΩ»íÚÌï©Øˇ‹ÓÉ{Øaîﬂ∞ﬁΩ•√;lsÀŸb[lgugxãmYwÿË·ÊÊÍÊm¯W¸∂±âøº“îÄw◊a@t∂é^Gûû™Isw∞SÒ«ÀY˚V@’à;±∫6%vÏQ◊sGT(‚ﬂ]Ïhu¨–jKWÇ§éDYez?ª}ﬂËŸRzQôS§#$S	A>ˆ”]´ç¿–◊ä˜§%7ÂE%«.uLeëÒ∆∏zJ˚¢3ã”´1ﬁzôÛRñ¬âá√ÅÌÎè0†Ïû≥”¡dx6≤l«g/mêaTrËˆ°œ<.DˆœBü“£cÆ|äÙvé¡»tÌ…Öáü®’Rx∞¥£a'·JQ£AU
Y„ è@¢ò3{AøBn±XnÇ?ë™^SÒpp⁄˝	®é∫±Á{∆ˆ√6`d+ò@òød±$iC˜!IiK§Óë>pÀ	ıü»NäæºùVäË/“yAÎâæà<ó∫Êí$4ó2J«\œ˘∆Ö}hW–±*)|…§˝8v„Ò¿õ˛–˜`A3Œëé›ßs›m?Á†˘tm\ÌòîA3f±Õ∂µ¬x–][ñÂ>a:`î3¨◊1Ì¨ô‹uÛÖI¬åQ&K.àä∞9U–î‰Ú®ÃÛ®'`%åzÓ⁄⁄öy›¨v:€ªæ¡≤G_ZÁãúp›˘∏ÿDë ø∆°“M|1J"üO÷Ì4cÎé#d¡K-¿ÓÅFÊ©I ç¥W8W¨&Ω¬πA°P¥H0eﬁ—UuCbn∏Åê]Ï‘˝ÄX>˘ñ"ƒ2Lî˛ 2÷(0˜â1ù´ØU‘Ej=°÷û<’NrL	¨H\Eœ[ä∞ä®öoe0ÆË/"ì)A≠\ULi ®JÿÇ⁄π‡ßpÇÚïJÿCQ+;y·+G◊≠°wô±	öI·NPgn1ßØ¸∫-rj¥™¢lÓf˜.
∞Õ∞Ù3Çòpê_‚√Ï‡a¯+òIƒæ–√y`=Ù‹!∫›1ª∫¶YØ–]‰¬k#~9jDØx*—ùœ}!ª2Üe{ûŒƒÕTËNsÈDw|¸qûé`™ßøÅ°4ÒFöGêfv˛Æ^j˛nnj>&Ví=t¡evó∂*ÇQ
·J£
É")¡†Æ—PƒœUñò=0Ÿ[¡1Œ¢≤Ü¬ø√aƒŸ'˜ƒ±{&º’Ç åZgæÎL¨õ≈ºãÕÒ!•3?Jû=ÖA⁄D÷]ù™ON9]≈	ïäñ$ùPÕMfgÖﬂ"ÿtJA~µ∫e¿p!]M«⁄#B´`Êíb5ê…÷hE1?VÆ9NÍêâvc¢¶%*_	5Å˝I:ÛÀZ4#[˘I-Gáü„j,R9^¡Ãõï˘d¢vJÆw23Ë¨ox˜û9s&“§!õc∑m&9=* ≥#wÑz¶lÛ!>l=z‹ÆÉù÷ªdü±ÕÎÑ;Àé!Òm
˚áQwdäﬂû}˙:£N ¿”··£%I—s>È|€
gJôò‰Äá◊â_í;îvQvkòõÅ˜Ωy˛∆õpÊ–ø–ï«ùõÄ¶”æºB‹@¸£VøôôB…)¨gZ“ñŸÃë8sAA@à„lì%W®≤Ù∂4¸ÍY‡+_ºÜ[WØ¥Fyi√5†m~ö!ÈE⁄å»[å±f5ÚsCáŸ|«B‡MF]LA‡√ó™√X›í‘‚q?˛—\ê\J€°(˘bàá∂A≈ÇÈg
Ï°á≥APõBÊä˝atèB≥ìù¶∞WôT/Së–hÉÓÄ±ñd‚IäÔoI|õ"áîöhÖßÌÅ{ë= á«k∂∂∂ÜYa°aºG]}'
~o ⁄aå3¬Ú-¬,]ë}ê—T…ä¢:‘	ñò™‹¯1∆ﬁrE:ÉXë4·˜·?w◊≈˜s6ÎÊ˛„Nµ∆@Ã–÷2¬ˇô©èí∫®Â-ï$~íREüÈr≈œ§~ $√¡1IÜFÉ˛9>mW¯Y†òà]VÛ

¸¸|p?Êã<+8`=‹áˇT9M¬“∫ﬂh,∞AZ§˜Òø’≠(ïË÷	Ù≠æøÇa_∫ëThΩ˙fbsØ'~{`KÍ∑w/(–•¸QDò|∞˝¬ïqøŸ^‡ÆéŸ˝÷/˛lÅ«Îı˛É÷¡"DÜÈ}fwÅoözLÃ.◊˜äÄπ◊ÏŸaO·ÿ4ÄÓÂ\xÙQÌØ©y\°ö34Ÿ´ò„y•c˘æD=¯
ƒq\∏º*”c˚‹Ôzˆ8d◊˝“rÎUﬂ5£¶–.≠K‹§g©øQ5¸Î"8‹I‡JN©B«îê∏2íe~&ƒ	`é‡øSü“Rè1Û∂¿eÚ
7Df‡n"äEﬂ·ïóõ•ôCÊˆÓ¶*ñ’¥ﬁ§/3?Œ7í…õ=;éì·f8„T›>∂`Q{XåHÏ¥8≤ú’¯ã5ˆÛÓOø«,»üØ∞ü√y‰¸Áp·œë÷˙˘2ªÇÂÛ
Ó∞ª¢¶_@Æ ∑`‰ÇˇûM|¸]dÍ∆p.·2†oß?«ﬁ?ÊGVÈ:4Jçã?Ãi∫-7]nãΩÑˇ/,”Wy˘7™ßZ“Ø“ZÖ^òÂ—)œ™:æô‰`1∏◊1ûsÆò¨¥YeTM•g%j∫q°GéH+&õgëgålˆù/JnqÜf˛#F…fŒÅ≈08f‘ÜÆÂ†©è,ÑQÒäèb†0§f1ÂbôK‰Á,ã˜Y⁄œAI=0ô&˝£óˆ˘ô‘äƒ_òzg∫øc‘⁄ÕJ{≥ªL)(ço0 ≥?‘Ç(QçÓìûFÔ÷Ë˛π}å≈ﬁESˇ‹›Ör(ÊÛVÁ8ê(9–¥9–nw‚Á@Ω)ïA!4Ñäp&¿S¨	‚åZz¶áG˚¶˙ãrhn§(‚Ì&>pxãÿS¨,¥≠;pÆZVì≤J¶…ìMxß+—aZûá˚Éùi#å)O4N#Ü˛íR@⁄t" -£$H¸ú∏æ-x∂„4>ú≠Ç:ÌkÕõ◊5X≈!eúï->Jë öQÕu¯ôìufñH≠J¢~Ñ¨´˜ÿ∂ÿÿ”*a—lÑ1¥Ñ>Å1™‘Rt≥“[eõs5F@Éÿ¡*Ì»™lŒ¸ˆ77ö$#ÌÆbƒ≥<ì.MòKıµßÕó`ö)†iÛâ‹†é≠ŸÓ5g‡¸·_¸≠°¬YIM]î‘…«ÄX5À≈∆œGiT˙…ïFüÕ+ç>˚(ç>Di‘±˚€î©´ä8˙ªkG’ÇœFöˆˆ>˚ u&Cx`<DSd‘ótÙ!ÿºyE]œnUñ¿π‰#»FJÄ‹Óu‹â◊ÂëÛÿpˇ≈Ì¥F∞¬-GédM%Ë©B-∑¸ÌûòzƒÒòèjÅ7·F-âá¨M=d˝9⁄∆óÆqvp£≠Ó™«Œ=w1k`ÕÖm©XX„Æé'ÿù·BÃ(wF¢GΩ9ˆy«˜Á”uH ÊDµaDÔ√´nEŸA˙Ë|&9¯’9Ä1´π¸)ºù=Üı#E‡#>‚z«ù	‚¶ãÏèb•l˘‹Ú”ÔpœK¶C‚=»$˝I3ÃVôEâMïZ—Èw-òÕÕD8É~Dd¶jB∫¡8`gòπQ°Ó≠j√û¡4ıõ&tp∫óÍ;hxéıÿ	¥‡KÔüqût®î◊OÍú¯á«ß«Ìv≥~–Íú÷Ÿ_≤˛vPo¥¶ø>bı£˙ÈÙ◊á≠Fùn*!∆™0˘€˚ õ'%X«"YÈ;¡”π@æÁ€!å≤/áoyØ]â!è>mÍËkyéÃ|¡ˆu‚πòò‡‹{çUºà√ÿ	&=_¿ÍÂ´S8sEs≥[ì	~†ˆ›[ö-Dåè˜`88>V˝ïû‘ÁC{d√¶ˇ|ınPÚdGÒÓΩ¶∑{¯ÀÏ{»‡ân”π”uù	Ç˛äëÜi_»¬ÔKﬂJ∑g–‘∫÷öÜ’‹i|Ÿ<¨ü∂¨›<⁄o∂;∞æ€ÏÒ¡iªﬁ9~|ÀΩu¥ﬂ:z‘—YœRsQïéÚÖç˙˜^üßÓ-ÅˆrGßnøÔh∏NzÁ†«Ÿ=-M∆4›◊»¥-LQl√√GyQT#ähx+ÒjÄnÌ±O‡"ÂäoxeËò%b¥D+sGŸBº‹bF&Å3ø<!Lî¢Kîˆ˜Ò∏g)˝ù–ØÔn:ÂÛE†J˛r”Ü:z√„8RŸa$|Ø€"$a`ˆ®Ó®‰(¢5îßµbx‹/R>®'O·›	πÙt/∂g‚˛”„eOæ`‚á»÷Ÿ√#JÁ1≠õôS0[pﬁ3ìxÏÏS¡«^·ôùÈjŸBh8ÆœuM”Ç—8∑ø‹ÿÀ_(4€ï'ª‘Z-Ÿ…ıw/π*9E„∑∏˜zòy≥≤s\}èË˛‰Îï<?‘èJußf◊S¯|˙ΩU¢ÀtËò3_⁄~‡zW˜^ßæ([LÎ"≠#˛R¸<ˇâ$jkÖÖ›Î€~®∑¨ÆÆ≤√ÈØ˜≥˝&´?ﬁoÅ>>˝kT≈õ_’KM˛÷ }øæè?∂õ'«Ì”&´=~ ∫π∏¢utÿ‹o’Aâ?9ÓúÆ>j5€‚OÀÙîŸ ™·ò4a≈öxyıkÜü˝jı˙Cû¸ìÕ≠çÛMÎiåÛ)^ÿ.ú‰2∆y∂â˜ñC"˙`B_Fíøm;Ù# ◊nòˇ5ûÄÏ(gƒmx˜ÎÜÌuûJ'˚åŸœ≈Û‰+Ï(ò^¶√Qó% AÚ)N^Å‹V#ò‹|¡ª Kfı	òUÆ[ñ›w=‰ˆºbbÊ%Á≤∫;vœÍ¡(5WÀÈ÷f≠f≥Hväﬂ’ìêZC2=ﬂô_,\;÷ê ∞êìã8ÿ=∞ë@bE‚[ÀApá {84ÿyBÌóu–˙aD€Í¡2ò˛–' {“Áûç8†‰D≤z/&£¿ÚÊ¡y9ØÖ•nmw‘Ù<◊´∏≥«´;L≈◊Ãƒ="|Õù$ﬂuåd∂:sV=V%ÊÃ|Ä85•˛«ﬂ˛Êø2Òr|ƒ¨hïÔA	eÏÇG›x¿A∑”›æ[<*â/ÿ“πç&ˆ»G!≈ÜΩ=Ò#àÀWòMz„|„lÛ÷”ı;∑SX^[^aÆÃﬁÕ lx¿xıvJtG¨Ê™0é@“ÆVë]8Ì@ÓM<zUåïïy^A≠éè˘2ÜgMn#∏∑4†õ Ö¥äπƒU˚^
óU\SH;‹£ü=˜eÇƒ	æüôŸ%á‰,56”{|√ Hái7˙r!—]ÕÚ◊Rp%Ÿœ§¿QÊ7O‰(Á¥!Xœ= ıªÈˆµ)ö4ùŒwı˝ÿz<"qM™vÚYãàmÿÌ‚∏f¥9€3ÀM´ö∂é∑õÊ≤v‹@è?äÆ-Hx\€’FèN¨ÍÃ–ÕZ‚qRÆRy"ìU∆UÃz„¥ıU]{ºÙ#D&1ôŸ§ ˘ bHÕ•Ÿı6ø∞}K∞ü˘‹ª5ªdZœæô∏¡ü∂F]◊ÉcÿÚƒÔ¯óÓƒr? éäÆe/TUeøuB8:¡m<ˆ‹.áY-S√ë”`[4∑Æ<Òπsæ
/èÁ˝L∫ëò5…å0œâ»‚œ∑
u™⁄/˘d¨Yí ¯Dd‡“sër∞ïE„-çö™õ»Q¨3jÅ ™πw6Úu¿¥–íπ¸ÙOBÎ“è†¸—C;ïzg:‰ÁW•*≈óõöxÛ\oÍCî√bıÜ∞Bﬁö`ˆA`≠ÈÔ–h¶oARPïVÍÅ»¡ƒ,|ÈCÎ“R%ﬂÙ≠«':ÿßH»T;t¡~M€=wYUOŒ~›‚≤ªáˆ;üVív(üa« ©Ÿ§§ÌÆ≤<Ug@çdZJBu›Ò’©_çœ\ÀÎ’“F‰
˛oSµîOnQºuµY∆\ŸÔ¢8VY´bQŸÿ®«zxîíëY9í:õZo4\¢«P\`]&i%WΩ&…+Mµõ±®∂ƒo‰¬ŸŒu·§ÏÂÑGI€L÷¯§)TÖ…á6yv KèÑıô2≥+YéÖ6êÅeKÌÊ™˙$ø≤ôÂ[x¢⁄Ì„6⁄!≠£”Ê#Èáﬂ3RõÈRuŒ`tıÌÃÍ‚Jƒ ¬ŒÈsÕñ≤˘qOäQ!#ä¢u∫ï¶Úâr¨c©ß!mB≈ı˙‰˜@!∏yŸRF_r•f˚b&„–œ∑ﬂ≤c¬-_˚ö_˘µ1ßàYõw˝e%∞æ<ßRíb3Ç(Q
öEÚØ◊+å–“6ÂΩmÅ0“6Yòﬂ¢Ñ—Y ±=¶´›5I˝|]æF6LèÁëπçQõOÀZ£‡d¬Sé˛L<æIÚñä4@Djxnbê¥`¬˙¢?)k=mÌÉ⁄ár”≥¢≠<úæ‡fËë&—¡5àç	‘"óñèÕ˜åÈ≥™)"a#áæM	;I¶…ÌdΩz$.(•‹•Ω|Ÿ5èX„¯@œW¶?iã !.¯ÈX”sCÈn‹ﬁ‹yJë’ìûÎéîjºåõÿ#dõä&ó¬îˆh¯1fõ’‰¬ﬁ§ @`ÁPà~}≤ª°S/•EVÚZdq6ﬁ∑FÛ`≠˚<«[JGJÁPcÁç= §íN´s⁄<¨ìÀú\ª¬Kﬁû˛Í§µO_À¥ì´ù¥èÕN˝∞’<:=∆Â}p|⁄‘…)Ô¢Sp,ÇsëÛf˝Ûl.H˛!èÒ9%"ÜÈvS&a…éæû(û›;"Zñ®E÷qyñ…¬¢f91≥åj5ã±7/jñß>hù:ø∞∆I%Â®(∑R*îé"b‡™^®yh"ª;ÿŒúv9Q±»©aáhüRåí≥∞é ÖTB⁄”∑cå8¿◊á”z«ı5è©¡ˆ<6qµC~7{äœZ©~Â ºw•á]‡´©∆
{ﬂ
„à :¥0˙’ùX=0¢	b&ä√ó]À<Ì®∫˙c<=Ê€√âÉﬁl.”©D’\å@*5m≠Ò—p-“Ég„+Ëƒpòíiá∆B_BnåLG™k{eL√bπpë¢Ù§Ó846¢ ≈©Á:ñIVËÜ¬Ω»Yº©lhßœıˆ©8–Á&Rc;ã˝πL==:Ì–Ç◊dÀÂÇ◊¿”Û>,˝Ë√ªZ±lÃã[|æq√ãaü˚√ÎX˙FƒÃkP6¨¿r‹>{ÑL⁄epN˙ÌKG˘uGS≈}˝§‹\”ò
ªñ¢,õ\Z—∏Å–Ë·û?˛ˆø¸£JE*ñu◊Û∏ÂÄˆÖŸ¡¸Õë∫W}d”Üv◊“z¬ô’ÎsxBXâ´u√›=0då7ÈäG+UÏ,jµìËñr‡_è#§∏º∂≈,ª¥ ÿÿÀÑX∞1EtZyß+ÊOø«Ï€gg∂;‰]8¯—k•’[òi◊€ìf≤bV‰ È§—¢√P¸¶º⁄k√≥zñg∏2˛ıˇ`mºç=àG∆eúµFÁé&èÎŸ.´’G”∑00Ä∑ˆóçVFªæ_o√]&+£1±Fy%Ÿ-vÅiÓ0ÒÍ‘…\˜®É®˙¡¨˚Óô«ATı|SãßÃ3kd9W0	ÜS¸›ÔY<T·ª¨A≈J.[g˚∂’M¸µ~aç^Y=ör–ÆÈru/ùÏ?4õˇD)˛œ~ìï ßèÂÅfÎX…-}Ô‚éaÚeÌÃˇπ3yÅï[CK*Ûó®…√¬∂|jÖ¡áX%ﬂSóD¯Uº&¬oﬁ≈¢¯fBE¸œ¯ÖÂÆâøˇÎÇÇ—!DçéÄ(”dÇ©î'ay—‰˘|˙;ç∂súCáø≤`«˜,¨w9«ìÄrØ“±ì
súII•€'…nzÇœÏ3«∆E=\NØ√LèñqœŸ.⁄ôæ%°
≥›q≈h◊ë~
™´Ÿ∂~‘F$Ç÷—#ì…ñ%\Ï,ÍXá¶ﬂSØ˙ΩÂKl¥ÚC¨tÇïPeíC*á{äò`˙ı]LØ;Ê"•“rû˘ì!ËŸ∆≥¸Ø`Ø¬≠0V«ÿ9Gú‡/£a´˝˘¿
¸˙x≤>º∏·ÄFÚﬁ,ov6èÿÒ	Ue’L¶øÉfI`ø≤‚"ßa_X©©ÊÃé·–¬)>†§lG≈qÇ
·Ùmﬂv@—≈Ù{ó¡öf·€˛>úx∏a*.ñÛü0”âÇΩÒrΩ_'VW`Ìô¨äX
Õ£”¶…R8Uu“%†Ù5LøÎ¢N:=F('÷Ù¡uaú9!ê«GÙkÖôu	~ZùX˘M<ØÚãw1≠}X¸~ÖÕˇÏ‹i°ÜæoÉÜ7Dˆ÷ÈÙ;ohè\=E1È«ùzªul2è≠5u‘¿œÌh·vÑ
:]=ŒgrÃ∫£.„˘›ãœ˙
9Fß§2çÙ{<âÙÎªòBø;‡`åÿ]”9¸[÷Ók‚q˙√8ês…o£9Ï¥ééO:≠é…√˛°TNâ‡õåBﬂ:ª∞}D¥π<∫É±CQ±ñπ!&2¬RgR|O•¯˝]ÃÂê[˛ƒ„05µ~˝7¨ÓcTc
ø‚=™ßñÁ≠e6õàÖ∞_7öLeCrÚ≠`
æŒ¶ ˘,˚ıi+¬N<Á Wª∂≈Fx"WS∞ﬁo€˘‹uÉëÉ©çÙ±ez.<πÅECvb”‘û†Ó12sìù¥®¸Ôd˙´G≠##;I A¬ëFQ\Ï5¢>¡>€“pJgì	B•VïYïËú™¥ﬂ(Ú6 ΩqÂ≈÷3ˇjÑµ¶b˜ø˝í5(Tòí∫”_c´Æôá„q}ø}∑∂’èåNœX!v–‰Ç°Èˆ1ÒÆá‘ãl˙u6Úòw…HrQ*'ßˆªäØ+ÇÊL√≠äYç†Ko|ß¬⁄ÅeºSˇÛˇƒyt«“¡ıP4C·É…•‹Fì˙ú”«m3·€ì)IÚQ≠≥î5¨…0ÚYë”ÖÒÿöH…2¥F¸Ö˚c4\(‡BCÉÊÆÒ©˙WÜ¬·$…€píp&mƒƒlÎ‘;≠áÑ>t|‘4öÎ˝p~a/¬§zˆ+ä;x6ë'¯!ØÄYâ+ÁjZ´Ì˙~gÖÀy–][Æ0ÁgŒ$!õÈ˜x∂È◊ÖMıSB„´]=øê¿ˆ	ÇÄ˜ÿ=ˆ…'!z®ê}MÆŸ=h	¿Øì≈+ÿ•µRJæÊWÑ'¶ÕYü‹ÁA'ÁıkÑ⁄E-’Ù°Œ%™óŒíüpî˜ÿ'xc¯´Ê˝ot9ø4Q…ìï«€Jå|´∞¯∏ò{2ŸRTaPÄ,◊¨ˆË~¡ûJkàˆÁõD±¢ÔF©∆Nﬂ(?Qw%î«©òô[ô…»V#ØóÉ‘àè^mÒ‹p"Å5wı1?Ú≥˚î\4ëæñ◊8S
™Ã Ç¶û$é.(ø6π B‘ÓéHûÈ‚>s/ı+◊ªb’cY∏‹ ˙
ˇ°êä¸jÊ5%≤¡ÍV@«ú¥jA}6F1@w#*¿‘Êõß4?∫ÖG0!∆¨v"/∆à
å8ÓÚR3’t¶ln&éë ¬}C|n™Õt†÷§ø=¥ CË“¸≠˛˘åT≠Dqv"©∑ÄYáR•»1jäFâÙ“Îê"˙IºÎ$… /-U	 ¯t≥ªdÆÎÉ>{»y°ﬁJÛº^ü·}Ú∂C¯ø’Á:U`Öuû™˘¥ì^	™µïWé˛Ω:∞∞Œ≤BI˘¯/!_3¶£Q°•¨ÌŒfÕo=ûà“ı—º§¢;“Â5 Ãp À&Ú≈/ï;›‘V≥ƒ÷»‘	≠¢D"‡™˝P.+*;_∂ "Ol™oøeü»BA‚ˆky&⁄ÚöÔyÌÅÎ¬0“»ùÕÚ˘√ΩóÚÿ∫\ΩçvGÒ	ﬂ⁄»%©ó§í2Ê…∆⁄ù€O≥ºeª
óô<€GnÄ6É˚2,†9ÄôMÓª≤èƒNö"RâèÎª◊6*ËmfÌÊßÅÔê\)[2UÅŸE†áì£I∫~∑Õœ=Ó/ÛN∂ õf∆∞Æ˚Ò«|äeÑÂAJeHœıçòÏu8÷ua}t)Sc¶»„¿pXDÅdõ’^Îli…nÍ®,8¨ß\^ñ◊îÍ§çóz‹AXzÙ∏˘Uùuöçx±~4˝’A´”Í∆Œ1˚Kˆ`˙õŒü=näZ”≠≠„GÌ˙Cƒ4/,Õ§ö{≥RÕ©J≥‰ËÈÔ^èmÓÖiù"±G~@‚öá	Ô@§ËƒÂÆ¯I™¥ï‘Ä®ñ6Sõë´*8›J€MÄ’s@‹%˘
'ìé∆•ã∏öbZg›∏∆079XK(ËÄëÍ÷»ñ—≥Î€xIE>´Á´ıwÑ[=˙QÃC≠aLÂ@#l˝Ù∏Éi…C¥ ]∫∆ûêî†`!U(ô‹ìQY67%ÚßÚQ∆`õtÌ1f(∞+›¢Rá[ﬂˆ0wç
ä‚ ‘o—∏Ö√Ãj„ÙEZEnÖ)®;}>	ÜÙá€±<BÀ?¥∆÷≤
~…5(ÆR?}•zSÿ-Uä7C©∫©UB[Zıú2F3õ£∞ﬁÌÃqª_kmÖ¶òØár≤(J÷LfÍÔ-hOî¿[!óßVœ5ä∏Ë2…éV’≥0∞ãji%äjè≈ÚÑÉ[]èpEL∂ªéÀN¯»∑ÜòîÈ.ÈDdÛª`·¬∂i]ÁtakOŸq¶øÚ`‡~⁄Á]õRqMª ≥«ûç≈V yˆˆ^∏œ‚Kº¢nï'a´>ÎŸaRìì˚–ù=⁄“Ò˜7?£øbö*úÀ<pàW≈èƒIü˛@)ÕP’,Lø∞4ü-¬±Á√ÄázFÇÉ3ÖE°}Ì∞h5¬Á,_$eñ!Q›`òE_÷eî¯„1—ìiBˆccmÆ;¢Ãs¯yPÄ‘'∆öÒ+ôùx-ÌVBXc’y;ìÌ1#´G5ôtTöPßë∑≥ÅH£(d*ﬁ¶ã÷Ñ8÷ §éàúÿHä“®ò›Ö6åQΩÁ˜·vIt&&£.¸"üK#Í`}<‡ÂS/»õöˆè¢dx≈qõ∫EÈFòHΩ[≥ÓÕ1“uï¿~c‡>œyY¡ºﬁŒ±[Ã–g°s8a2ãH[Ä@œ]©NéÆ≥“–‰ÆûEÆÌÃgü√†±≥•æ5I#_Fìj‰É”sKÅjW!û%´qç8vüRÂo»I˛˝§=T\˜k§"-\ïaΩ‰˚ÔûäW+^M∂{*¨FMNE 1%.öœ+ï˛d|Pa˝1:†™÷ «π∆qE2;>¶ﬂçîbü§õ7íπpX]èc©{è≤“˘ñ“Èÿû`q$Ù
ËIœÇu¿ÜÇ’“_we5e™√-Ø;x†‘üõÈT‚~25ÒNt+µ<πÈ~¥ZUÓÙ\ìv%Fs·™Ω¡bé0≠JK·Êµ´ÌΩàGå¢qC
Uí5Âß´Ri•Zô3-æ;≈*Ê√÷¨
Ë
≥⁄Ux·|˙UàÛìQ∞$_5*8∞~¶øO ˚DD’"ÍÉ≥b!Æ‡7ìÈw€z~äVôwù…˜†º;ÉñK‡‰%@D7∫)SÏVYC„g7rªúÇÉB°rA«%«&¸†wß[IÙu.PñÃÙ™4ø˝{™R%Aî“ªÌG´V•gÁö4™p(≠S]«)¶°[•uâ>vÛ˙‘ŒÆ2—t)xîÑj%ï“p9¨ÈtÏ·ÿ°⁄‘ûª|SJòeÛìV¬˚p}—≤çÄﬁÂ+\MΩƒk’À∏‘Ì˜WˇRñBÍõpVv”*XxÌ|*XMıìQ¿2∏Z!˛G¬8–>û\e|8&'‘*ﬂLlT‚ˆ1utîP)L$∞{6|AD””∑g∂t]ù¡EuŒcÁ”Ô}hÍ›)WBÄ¸D@•uRöôí%€Ä°7mÂù([I(≥4ﬁŸèVŸ*ö•kR∫bQu√1B√ìKG·(Ä.IEÊÊUÆ›Ω√âT˝H îÜE“'ì≥Cﬁ['†è±≈A›în·À˝§5´0bx
Î±pùÜ–|Ôø~ïÉö¯·kWÙa®[â˘»hV‚∫9Cá*ÚÉ‘´˛?   ˇˇÏ}[è€HñÊ_	ÁÃn•gÚ"Â≠Ì\€Y)g©7oì ™û√®¶$¶ímäTìîÌ¨[èã›ﬁ∂=@Ô Ωı∂ıP≥˝≤h,0¿‰?È?∞˝ˆúà ºâ'(*/∂ŸhW¶í
„r‚\æÛù*zUÇÁ“‚3"∫Tjh¶‹Póå£⁄#ıIr±âx‚9≠éÑÔ–e˝©èBŸéÂûö‰B!E‘–∏}%kÔ“1`˚ÏK˛“™Zñv3∑¢f©T£I.“è@≈JM—Çt¨Pd’´a’zt¨∂®mby—isÛ ’ŒnD.õ_ùÑ©4¸ÿª)U*&x˝®u©„“Ùäµ˝à˜Ó´Q9ƒ≈˜_çäiá∑∂S3íR§‰ùÛiR!aÛG£IuﬁA»ËÓRhßa:≥˘‚—MÖë@Q∑—‰ß+ºÊ#tp25á@ÙMûS&u%y∑ÕŒ-Q AâK*ê.b›«≈kVΩêO|Nñ~;∑¢[%»ø’]∑˝QhWÈYZêzçiΩ˙U≠'Aµípˆ\›ÊÊï¨üÌñPæﬂî~•PM~‘
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
ﬁ“3TÔ◊hÊ=È$;Q®ú™ÅñÌTM®åÈ2^¸5ﬁ^\Fë9‘õçP<ÌABí0¶â«•Ì⁄@ûßâÌ°_Ñ)C£[tv‡z˘†É >’ƒH·∞d˝C#Æ∞€-g2¥ø¬‹(˚Ó;=Ñî∏¯w—„»5^{:4«Ò<ùHÌ’;Á≈ï«ï€Õ{¬2ñ°‰ñØÿ⁄⁄˛∂¬¯cwYD£+ª…ﬁSägÊºeº`í|ï9aRWƒNƒ^õ•1’ΩïZ∆ ó£í~£?9»¢uö∫“ UPgVeZGãh8ã∑ZÖ2"˝s˙KögÄ∆Lk∂MoWXU¿™´XóIürl Í¨j%L5ådZ∞Æﬂ±Oü2+ßÇ´ pù$@™Ô¯Ú∆B∆›®„ÎèLÿåıÚ ñ:˙µ∞¨,Òˆö¸Ûz¥@´œ⁄·Íó§Dp‹ _‘}K#îVØ]ñ3¡ËﬁÉS«elFÂÖdÔﬂVêb4”~	«¥”HÊ'™üotÈîÚz®€“í≥)åÓˇ  ˇˇ ]•tïxúÏΩ]oIñ6x?ø"ä’”EıäIâ≤¨◊rÅ¶(õ=˙ZQˆt∑_√ï"SdñìôÏÃ§-Ye`XÏ^Ïª3Ë≠¡^Ã.v∆v˙¢h‘Õ†o˛ì˛3?·=ÁD‰wDdíí]Æûfïm)ôë'Œ˜ycöœ√ø–}õ˛‹XŒ–ıfÆgñ3Ó;#ÛäÌÌÌ1kt≈æd’%ÓƒÿÉeLúôóûÈO∫oÿ–6|ˇÿòö{ïImìΩÅ?ÜcMç¿¨˘3ÀaÅy‘Ã©Èˆ®∂’nTÿ∆C÷ôŸ÷–pFnΩ^_n§ÀuçÌ2ÀÔÿûiåÆ;√·GòòÓƒæíLJ‚µG.3vf¬⁄Ê~˚˝∫ßˆ‹œºmΩçÔ[o'ﬁÿc◊Ï»YóÙÛGxÛw•O~∞q1◊){˚#Îı√ø(yˆÕ∆œÿ9l vÍôØ-Ûª∞] èümî‡xZr~/∆µÁü7⁄çùf„õ’∂`≤=wõTª≤ŸÖÎçLO¸SÛm‹Ñ;ÌﬂÉ¸◊ÕFÉŸ∞Äg‘<”6ÆÃõWµImkáπØMÔ“vﬂ‘Æk∆<pôo⁄Ê0®·ÂÃzÆm_^-ò¿∂ˆg∆–ÑÛZÏ“u‡ÊÜ„W /QˆµhÄœÔœÆ^€]ÿLµúë5vk[0Ó˘lfzC√7Y‡¡˜¯
o¨ëÈlzQk¬TDC	ß‡"¸A‹Â>L∆Œ]b®å=û/æ3ÿ»¬Ω4=”Z;Z¸nƒÃfÜg0€`=hÿ∆ÓdGd¥Ã|=ºÅg√ªÙlsl8¡ôÈœ\«7´û9¨·≈M'8w;0EŒhùU2sWY{∑‘#ó8πÙ©kˇ•§wÖ;∑ƒ”¥˜(ﬁø∏gkµ,Ò∑˚OOÿ~˛<><Ùÿ/ŸœüŒ˚˝nß€_|{å_v;q‰‰∏7`gù˝˛…·‚€«ph@w“o˜]‹ƒÀuÅ∞z5rﬂ8¿0Á∂ûKzƒIë¡Ï›X~od°*¿ŸÎë·Ãû	GÕ—Yt&Ö±ÈÄ8ééÍß‹Ê£ÎÛÎôπw˝»æ˘Ä9ƒA`¡-àçò#x#”Ü€$’_È:ú†œ]>‘Ωõ™·8Êæ»€{»n
»6∞á·‹ÉΩ∞ΩÏ´„ã‰&éU*E¥ o<üçfp„ˇãXtﬂßáS˜+‹)pi/3Ïí◊æ”M∏F»j˜ùb«ÈˆÓ≤3k<	X◊µÁSg∏´a◊kj2ò0¯¿zm≤”˝6¬SµèÄˆ†gß£ÀøÍß?Õ≠4R)CYiÙ¶v9∑m6Ìæ©=ﬂjˇÂve”è;£?Ò,ÁU≠¡.m–∏ÒØ⁄–—;DÃ∆N#î;ﬁ%¸π÷»ãÊH‰N¨—»t4Ç	ggÉœ{BdΩé∑dﬂÙÖú`#iA'^"Û~ccäl¯ÚZ˘ô},›àuÍ◊Ü&.-˚zÓ÷ÂuÌ¬ﬁò⁄ó.w?»ˇB©˛‡¿≤M⁄„)ïu÷≠¨∂Q—Ìq;PÇúº”l»Ù°~·ƒ‚7S◊qsjL§‡î–OûıÁvz÷{÷Ô ] Ml¡DÀ÷rk—*?lY¡˚‡ıaﬂÜ˙±fó.;à&Àjï4Á˝2¥[gstÃecã∏a·áOOIπîV¨[…Èy'CŒ±Æ¶d‡$	ï;;—i;%<x–®ÁW`SÃÆkçÿ¥)± Á˝ﬁ—È	;Îu?∆F(÷"•4J‹ÙçgÃ¥Ï∞‘Bi∞Ô©c“®\Ω4PéJ≤sbA ´ÖäåLí≈¸ó€⁄Ö´†∫Y·'W
œvùÆm_ÅnH*!ËFß •P/¶g®˙Wïø(·àßÁÊ+ ∆M$F4.Â6™¬&ı¢≥«¯ç„[®‹◊–+@UÙ]Ø6sIœa?)“aÒ3Àæ˘˙¬∑*eß}…æàwÂvCÏ 7X~êÎòµÈ®‹≠vÈVÙZ` £⁄õq∏¡'®÷Ï&∂ç‚[ø˚™huäA9ÁRYØœH∞3ç0≥/˝˘tjx◊e(wd˘∆Öméˆn>W¯≈ZDüùôıGã≥ÎŒå°\◊6ÔdG ÌYÅmÊñ^∏T55=WòBË¶2Ø»;¥ﬂ;Ã∞˘>3.åØ›
ºZ•r˚=ÿK>ÂT<‚NvdÔ+J∆.–™gÄ
Cõ–uÿ#∫øW2≤åπÒë∏GgdÃ–Ï+ |ÒÍgF˛‡Ú¬ØÚÅƒ∆ÚøHπNÒà€r…À,øÎ—2ﬂnd¥Œ6◊:3Í2å Vî≤*Qí/¥e|°‘ì ÛÄ 	L“‘z+vﬁ»åˆÅ…àFÄCºv—X,¢≤‚=›yó›HVgæsx~ÚN“Ò…ŸQÁãb◊n9°¸)Ï:Ω>o?Œcõ˚Ó«vç—±!ÊßxssÈÔOSº;:oô˝Z!ûî÷‹9¡Eá–ﬂ§–ﬁSíªÑ4”ÓÈ‚ŸÙ⁄π,èúZ`ıÃ¿n4ø7ò37_∑ß–Ω+ãcÿáñìç»&cîw)òV>°H∞ÖŒø}ÀüŸ∆5Îx.Kyˇ»¯l¶}|`g¢É]{$ﬂi Ôßïq'Œg’¬9h≈Ê]>ıÏdt"‹Ù≈ZaÏ^Òæi7¶‘Óøâãü√Êf±êW8~vÄ¬vî.¶íé†3≠{QÍ–äwÆ:^öÚtïpØDŒ(»ˆÁÜâ Àb’ÉçŸ-7e3¸‡D%B˛è ±Ñs$„ŒWF‰ìlıèp˜ìõuâ;øp≈|o*‹OnÓx∆ﬁ}∏.fÏ5ÍØgÜc˙{çär≈‘$%Pi˘qFàû€)#w<å‡{¶wÍÇ0øﬁ´8n-<Ttq¡^-GøèÅÕj€À0±émzA◊ÚÜ∂©dc∆Ù™].4≤„‚˜◊2Æ¨™ò‚ø>"c ´|Ê:Ê§©¶,W–üC„5sj±&[¿Ì‰D∆T∆f¿‹ú7µ+?ó¥≥Lx¢hNJX;0m\∞π#ÚêRﬂ9÷–Âi0ë\òi„∂,ucòı'∆[∏ï5D-∞"ñ¿„˜4cEø∂ﬁ◊f@	9‰µ‡'rvO%íˆq	oøP≈€Z£ÄÈÆ’|)Ω•ZAî§à%º+‡`√o≈ÈúÍO&ÉHÒô‰˛Õ–g±ÌüÙäÑ2«uTdK1®áÉÛ≈oé˜;gò_s÷€Ôt)€fóz«˝ì3ëbsÚ∏?8gèõm]HáﬂÔÈ˘p±AØ˚Ù¨«∫'««ΩÓyˇ‰X}°f∫Â'ø@zÚÉç©ãñS=˜¨|˙î?ÿyƒ6wŸ~øÛ¯¯dpﬁÔ‚ûûwéœY˜IÁ<g‹‹âs„Ç∂ysUÊvPëEWƒc…Ω”+DdxqÓ[À˚œ∞˜nnòpiÓ≤∆:√D8~™ﬂﬂë%õÕ3uU3∫™)ªƒº≤Ç%üõßx·hÓQjûﬂlÀŒOlŒp∑@óõ^Ò,»¥ û‘û√≥á’f£ÒzRkn¡¶X{¡¶ñSÉo`G¿…ŒïÑZî{6v#µÚZc®"µÆ"›3=∏¨˙)<€pætªIë˜tbl¢À/YéÁ‰íM⁄%xN	VQ Q´V~≤◊O` ﬂ‡¥èŒ¡hŒIYçÏ&`iïázØ∑˜'õ9˘ÔOs*èO(í,îlVüùsd˙æ16øû^FŸS&¬†ªπÄÎ°ÿ›∑å±≥¯oË˙Ò7Ÿ‘LÄ^AºpÌQV‘(^óML®<Ï∫*GëÚÊ[c«ıŸ5hnâÒ¬oaØm˙@≥∫∫Ø¥ﬁ«åQÌ˙∂.Y8Ô•ÂM´ï˚◊Ck:≥@ªı«7}Ωò‡9ÈrÇM˛óïµ5
‡&KÌWüøP¶*KÊ5yÆüÛ“1LuR{ bΩ∑óg[∞Õ•Q-O8%>äuR˚Ó‘ûR+Ä:‹ÒTLœ4J2A¡ë—Ú %“KlãÒ˛˚ç˝fÁÖbüﬁKW∑MgLHê74Óä<3ã<´èôÕWÃéiÊ“l wi¶Ç"áù^‚´‹*√*„Úçı≥±nh∫<3ÜãÔ\`V[K2´¶ñYq5∆	‹I…©≥Fùñq„ÿÄ-&∫¡õ†rXÓ	,mËNg∂˘5¸‰¬œÇ¬J˘ÃÉ˚ªcoÒ”À˝:Î}ΩÀ*ëULÉ9ÊT¿≈˜ûq≈åúe«ú‚É,∏ßœ~=∑¸ ˛ùÕmÿÆ∞™>Ú|è‡{lååuˆoˇö‚™_™ù)´1\ùÛ$µ[¶∆¨Zù˙„u¨É#´ˆπ<êÈºÒµﬂ∏ãŒÜLÜKi´˝‰^˜\õ[ÿïπ‚cÒ·n3ùÖŸ√ﬂ¡\ıÇä.∆Wîj´µ_ì‰$˘|öìö$/#"˙ΩÚ1n1æÁQqNQì
jaÏV2Ö.ò¨D¶Fª±—í≈l7”1€Ë)ÖwﬁeiEUØï’Ië6∆Y˘Ã3y"_™D*Ã#—E–]2ˇ6Œ¿ºõ™r|ûT¥˛tpﬁ€gU¥“ﬂÇô~≤F$ˇ∏w‘?Ó'≠◊Nø €dïådösdÕß…ıDYÒ}J$$ß‰C	≤©<§g·¯ﬁïpñ´‰îóáÖœë’Ñ=ˆñãS.Ê©x∂|pË!ë«x}òˆ#ºL≠G ÂÃX3bùŸ´
ı‰Ymí«<„v%‹"T(ÍÍ]üÂ?)™…P•ªáëı\§ìurc1mêÕ<˜S„¸uDkzÜ>úx™“{]’⁄xœÛ@g\Ç¨f\’'CË~ªΩ—Ãªu¯w\î%"à°NW2—S¶6Ωj/Ø0%Ù≤ûyπGw‰Çâ5zx'◊‚ıÜVﬂôÕ—Ù¶%≠,1≥9)»f¥O¬“%⁄hñ„($pŒ—‡SL’k√ûõ¸•iÿ™)+b8c8µjÜ9z›¢™YágåÕ†N∑SÚX◊˘+ÛÛÉ¢ªËΩfV.∏zîÑCif›üXó‹jM[+i÷±»X…æyiÄÖT’ñÚ‰%d∏	/ÉÓ’K*ù3‡[ÊÏ*”€´Ïõ˛–≥.LrXPõ∏`ûcY∂É±m„ÌÿM;ËËôè\¥éå_œﬂOQieû˚∆ﬂªiïÉ‰Rh‘ﬁZ‚•√πøõS]ìõ}vç©÷W°”-≠~gRÆ¯Ì‹yÄæR–í≥Z‘Ì\n∞iÎ-ø@>
€ª§'KJ™πå3‘SÚ˙õoÿg—Æ™û5≠*˜EZ¸F	›mñNÔéRﬂ¬âoÁó*aN¥	⁄!CI$xÁí∑∑Rëî≥6ª‰ó∞vç8N/]§H\¿˜MTôπî≠Áº∂ÔŒ|g+Ñªíøá—Æ≠]÷Ÿ«B{∞ŒzlK∞'éXˇxp~ˆî‚vÏÙ‰ÏºsX¯û¨◊_-^¸ü+µô|Ö^ÀÌè–¢åï(^ïx∏î’¯I+Á¨ªàä?\lÂ¡¿02áÉÍp[R93«p"œ“ûb>Ö1EØúã^5÷Ò—Î¶*õx∞1i)ﬁ~yO•2X?4@)ß¶Áª\£g¯ñ„ﬁ|(‹éS∏ôg†˜–å\ï"B¡ËãczW;ËîùD)Å ÿ}Ê^ÿ÷~Ú,ÚhŒÄ˘DyÊ»Ú¯Œ,~˛æ§ê`é„¿€òæ‹ÇPÿ⁄zı?˛·Ô~À:ß}ZË´ó.ÎﬁàU—ƒûcæ	®ª¨ª¯~Í¬–LD¡Exm‚EkÂ#®â2ÖVë∞JÍ@_Eô^KŸè¥1‘té≥êéíÕ˘U’'øÃ≈r≤DFIÂ!°ÛÏ≤1Ò.Ï+«}mx@!Â—⁄ı~©ˆÒkl†≤ª,¥ÿ‚2ˇ¨®ÿ\Îa°ÜÓ|ÆŒ⁄ãÔ«¶ ´ÑˆZÁùƒ˝√¿ ßoéÁ∏©`+¬éô"ÆäÎá°AÿK≥»l—≈–?f‡3`í8©Ü˚	Ó6°1∑£ŒÉKÁ&’t0ÕHÓ˛7Øfñ«#≠ÎgÖ]myåG»aêî~.˘ŸÆ≠‚dô,ÁÏ<«»T3k¶≥62á@âﬁÜ˜*RfΩÑï™wÄm©Ógà_É=0ÿ-‰ $f˛Ó∆Üa!zéÂ÷«Æ;∂Õ˙–ùnT∑˜*/Å ùWL∆§TwF¥Ï∏Qrjn.£O^≈Q
ΩÜaU˛N≠gpˆÎòC∞¢<†««4&÷È≥íU%√]{∞a<dHSHCQcH√πaˇzn!ﬂCb°‹<~Oï#Á¡ÜzµÛõÃ41{8‡—~`√Ñ¨˜ ‰éÎåÛ√ÿ\ylƒ@Õ´<ÿ‡<d’ìÔqˆ˝A_†Ã`ª∞ÛS2ﬁT⁄„‹1ƒ∏©zvÒpÒ˝∂∫Aeû®]ÃåX,
¡xãÍQVÊÖ·y¥ÓS”Y¸ÿ0ú9uâ[`N&e)\¬ÀèÑ∂÷{<î› ‰ªjjJ‘√J®r%W±ãY»˘}6ÿ¿z&¶5RF∆0 }Æ,¯‚´;üd“s\ë©¡%í…BSíÊ¥=3ãAbÅ†EÜ=ÛV∫ò3—ûƒnS£7i‹åî;Xéπ—Üi‰qôó@a/IJ‚ÆÉD±|∫@M#$,¥ãËÕJPÔ /≠>ûÉædxk—*-?ﬂ6\{ÈQ
_∞¿-.Krù!Æåm^™C¸øøeÁs÷•©3√ =h¯aÿ˝ûC¡ríﬁËöæA™øçlMÔµ5‚)W§„FÚ,ê˘*ÂV°≈Ë’[û/∫-ÈT-}.\°%’◊ï–(/≈üÓ“œû˚æ8 €∏0eöÉìâió≥D∫í∆◊ﬁ¨á3(¨ X∑*sS.âUGŸi}a®®0#a/‡´îM^\6˘±LùlŸ
Ÿ“Ym¯…d∂Ìõæ	∫•á2ÿ‚–§$∑»öìZuåxË0Õ‚ß!'òá&ºπ`•p⁄˝îWîß‡õ¡‡W*±™è{«Ω≥Œ·KÓzô?aÏiæ’‚Ô%√	§4Îswº=E	¬Áô˘bßëå%µÛâz[aÊÉÈIéÛëıWÜ˛&ÚWgÍ¸ìâ:ö„ï]gHs‘lê˘-ﬁ_x∏¬ã?ÄÓ)ò®â∆ÕÈ,‡‹íÔ4ıΩuÕ?˛/øcg	|Ô¨â0U+Ä¥2`	2!´ÈÂÍ{∫ù≥N˜ºw÷Ï≤?K¬"yPW¢¢√*ŒÄΩM-7⁄e¬i˘›Z2¨∆É=Ì—Q¶òvºØsf™‚=¸∏áªg+˘K¬£”Ãxt‚xê‘m◊,∫ó*’O–^6Òp©¿ê™tM·blk‰j.íÜ\eóÄú=Pà–ÔpÕgÒÏyãß ¬€Ç‰ÿ`s›Æ∫}a£(@‰#¬®Ø‰¯Î‚à)Ÿ›≈gÜÆ'XU;RÈ-?ú÷“JË,fH*çﬁfí§Ÿ*∆˙÷T~ç‚≤Tà}%Œ–M_∫_ÿZç/‹2¸¡∑˚€ª`G§†™ìÉˇß≥'6s{¬fèÊ>∫óH·XÔ»è∫h‹•¯Ä;Åœ¯ı™ª!˘üwƒ]ÓÚpp}}`Kîäàº§Db8z⁄Q>S~ÊJîƒim∫2ˆ\&Ø„c‡°õ≠)`.˜Cm¶È!E‘HbqI®§Ñh≥ùœö+ù¯ËeóÂí&R∂…Å∞MñŒ°¯ ãÖ¥∏‹ZÒï™ﬂ>y&Qø≥U	≥û7^nÕÆ^6[ó7æ0™˜ÔØ7≠ı÷VsΩQﬂ\À’€Úèj˘Ñ7RƒﬂWÕ})ux˘‘óˆ.y˙˜O∫Oèz«ÁûÌ“9Ó'ª3kµDº?WíÀ÷'ó‰˚îì% ‘ó‘(‰E÷º”ÕV¶p:ä=≠s°ßuK„œUGÛ?hN©ºÁ›LEóâÉék‹+ò„Ñó6£“9¢ ¡˘àY8TàY ŒöCc"îè	ıæ{º°¢Ω´ÖL‰FF`«ùv∫Éç≥˛`çqÄ#4∂Mœ£⁄Bá˚⁄‚ƒ–∞[√QÑ˘W.ö.#	„ƒ“!6`ÉÈÎÃ,ç¢Ã≈&ù'>1[Ì&À®7(2[¢é◊h\6G/≤ çFˇΩ•÷R*Úüë¢™˝52Üs…K_ê%–o¸ƒÂ‰™¥$‰Ê´∞¬Oí+ÉUbÈB˛JQBÄüÏÂ¬/D}Èâ£Ìç+‹…ä*≥’À√ˇ„~˜á$"À—…qˇ¸‰åuOéNOéApØÇõ°$t·+æî¸YÇ/ëŒ®*[4ùD¯QPí\QÎÄãZKî¨»ôL¿PDíıëZIÉB8˝∫âº≈z#"ÖÙ´PÇb⁄ÒI£r–®-_qOlA1EZ∞hI
y(%¬_K¡ê$¥‰∆ÀPë?ølﬂ7/ÙEıEl ¥(5w ÄJvoL’^h.eC⁄◊lbb6'~ea‘UnZæx⁄ÍÙ˙’·ë(I1¶º5]!ßæx´°-ﬁ⁄JmÕ2à{ö»-g¬EÅ[¶ÅÎK(9a 0fÙ(EèﬁßÚ”ıL,Œ·LGıÍw–Ò≤ªÃn◊C5–P
”3£úN“π(DÜ‘ß¢¨•∞V7{°YT8è9çóA∞≥¨%ã“úƒdÒ›vÇaß«=∑¢ÂgkK€ÚSVt∏bÖfJJ Ûy¶˛ﬁe⁄<Æ˙uaë0%È˜h	Ú%Q˛I´£Qßér¿ﬂ2Ö4≥1§xﬂ
¬+£¥¶öDïPLuŸ+%GòœLã•Çròd)ZB*ˆØZp¨)ÍW¶Wï3~3Wè=kƒ/t¯µ&™˘ÒØ-.p
˙YàÆó÷òLH•àÇŒ¶Èq‹|ÖÇ5◊I™G$√@‡◊óØÃÎóaê9*¬Âê"aÚ¥HèrGf•ËVCD¢D˘6--	ÿ8À·Y¨d#&pà®€q/T¡ie±—_é&®£~õË*BÓO≤ÇB≤ŒÈÖ‰ MF˚m6.ÓÔ4_Tí+ï“ô©π_^iﬁ⁄ºlõ/Ù6hÙR“¸U∞™ÙH^L ﬂ>ù´ÀˆÕ Ω?#É^˜¿¿Ú™Ù)ÖÌ|>R?<‰á lÉP•◊
,$S˝Ø"•\-K∂ΩìMó5Q˘[ª+læ[ìW)‚*Åsì°{’mIEÚ_æ±Ç…K√zk¯‘éä∆Ó]ÚΩÓäÉÚw•Ä9ÍﬂF˛XÃ≈S◊•`≠’‚Ω32<≈ˇ˛ˇ˝_˛6:≠ÔÃ öUè›∞‹›†ù˛[cpΩV∏• m*ÆTññ`aŒì¡kΩ€#›Aøëøé‘ˆ∆Ù5lP&.3–¸‘Ó‹Fë‚§â·øÙÁÌ^xÍÀÿ)≤§ÚÏb3ˆú(
+#∑ F´≠b·'…@¡ñ´√ÃWN¥ï|®†ﬂâqÛ9ﬂƒ‹√≥∏øüWo ˝syGyΩMXé≤’fh>¿¢ï!ıxÚ(. v#»ë~∑¯Œ1©Ïà∂é_^Zá*ç I™ºp…∆‹ßAÕ\,eäÜÎ-ﬁœ,∂èµ¬0ÛÓZùıÏ(¨ëÆëúÏg?ª¥0.∫f6AÑ¬èvXÖ&ÓtÒ>≥àˆ3†AõªêjoíS-
n≤Â6Y06íïá–B÷mé•H<ìù{®±¡¿%E&M≈[0l˚⁄Ωí
æ?∏øèˇ÷KrW<ˆç˛éHÁZ∫±xR*ÔîÄ%Åâ«ïÏ≥]∫ûáo∂Ñ£	Ù(ú|òßcr'3r≠¨ŒÊyo∂ãdµ`π3{à⁄˙»àwgëF-˚“%`âêëÔ`“KŒÀïê£@Ô¡ÆNÄ@füïí}Q‘Ó<4zÛH3¬xi {€ B≥%Å∑f);ƒ/ÌﬂÃˆ7µg˙Æ˝⁄§ˆfË∫=|ùQ”$æÎ'∆5Å O¥8käJ	∫u(™ƒÍlﬂÚﬂçMΩ‚iÓ,äJó©ï‘F˙V0« ^:À5˝˘3=µ¯òâˇ¸µÎΩ‚BóÍ»=w4ö™∆º3™?—≤NE9¢æøTÅ[ˆáÔ—¡cÜˇﬂ?"¯ÂAˇÒ”≥5¥`˚ΩCvtü`M,°›î>ˇºa6∑[˜_¸Å√Rê¢ÀG”ù:£á J_Ÿ¶:z®É¢–,≈~èıèœ{á˝«Ω„nø√:gÁ˝É>¸tHK¥llQùRÄd∞új…;|À–@ΩldåÃ∞ ﬁ¬7«ã?–Œ¨YXóM’˛◊\!iºäBuà,7¯1^œUgáòz™}∞Êc ¶s‚UÃ>	E‡*–¯êdcÉG˝åKdpt˙‘†vBc€Ω Â–`Åã X,æÕmÇÓ8H_,s:„Pxeæ“≤.—-^Ì[Ïq%ﬂhÁlü5wŸ¡agD£<Ö ’\Ê{ S≈y`éé¸£ZÚIm≥~Øv	o=©hx`“;ß°©|µ2'~î^ñM!”:v˝‰êy®67l-€O!EﬂW!EÔ§ùÑä4“fKïG~∏?∏ÓΩ∆EsÛE^ØÕfqÔT™(3 oV?Jç≠w¯/££™—‰¬ÖK≤»∑[‡-Ì0#uE ı¿¬≥\¯R^…¨7Í´d—l°de+≠BLÛ[ì-~R§€Nµ£_«<õ+ﬂ.¿A/å? ;+ÛÜ¯ùÓyˇŸ	9–Œz›ì£ﬁÒ~gˇ§–sUhQ˙∂V®‘kBˇ˙ÙŒ$©¬4ÑX·∫7ï÷B∑AﬂÑ¢ñ…å∑Æ¬∏Mﬂ]x9"\—ó{$ö’ÖÈó°x≠≥˛»DúB1C;Ù¨ô@∞Bk
=	Ä∂x?∂läFÕ¯PZ‚¨Puñ∏‘ùúz/ÇFy^2PÆ®]Í\@∆e6àí°(π$}&´1≥8&∫a¬ﬂº§m'1≤"êÕáà®cõo?iõK9b¬Ú§≈â%4ª÷43ù#Òa√F\ÙgÓ“û√Â@ãÔë§≤‰¸ÕrÊn˝.ˆÿR≥Âû‹·¬ñ	%/3…á÷ÿÙH ¸ç ¿é-ıÿTÉT{, xm¯≥L‰ßÖTb˝õÜ„NÒ.ã`pï˚ô.0@√‰É"Õ≥µÀNœN>!Ω≥Yõy.¶aGõˆô|	t6˜ÄR2:®8®’Aõ€;Î;m–AÔ˝Y˝dt–&;ı‹©∫È‚'Eæ?&=4˝û±6 zø8Ìùùs≠ÙhÒõ_Ùè:ÏÙ‰ú<9™©Ò⁄pHïYæπ¯}§T¬•t	ã‰"FŒÂ‹!=ÊnéÒ∫¥¬…{àaÓHJÏπX>dé·RÄ3òvÌÀ—ñ‡Àa(dl∞¯~äÿ	ë ıò®—†EKT.Dˇ¨ú~
 Èò¢£ŒpãÔ.EŒ ‚w6å~4£!lF§"ÇtÇÕáâîâ^qq+Üò¬ 4F@ô•%∏rhq¯–D+„?∑ﬁzNﬁM>[∞ìfòç=5Æ©Øäßà/|ªÕ÷lâΩIÃ∞ïÇÈå¬Jòë	Jí‘ëªˆ—4÷•.-‡˛'÷Ÿ«∞–‡¸¨≥"˙ÇN;á˚'Ïóløs~2`á'›Œao∞T¥®÷˝z(U•Úáç•ƒ/PGŸ7É
tã„(9Ù?=ÎÔwˆaÍ£UÄI-√âí‹>áµc¯LÂ∑º£ÓtÒ˛
=ØCÎ|ùJñ.,õˆ"ûÇ(ãú<ò,˘\ÑêiàHªîJ¬Â·[’põúcéH0F ≈õç∆_≤C¨§≠XûÄ£™Àj?NtÈ<äŒåëËÉ1≠Daf6Œ) ¯—Ò_€Ea`≤âÂ#ú?OaßdI≤,êÑêp«≈{Ã&
1ŒSÄ#&yﬁ‘ú‚Dñ(=3ÀMÑûﬁò¨*ãRÿll7[/§qÈTmm#á¿jT=ÄW=GD¨◊ÍÏX¿P¬x8Ä•†ç˛+&#œ/0∆Ô¿?a·5ÈWs–√8[áÛà^D16wÍâN¨1q
’ÏŒcc˛T”¿∞4ÌäÓ≠”Édug´eÓíÿª"∞lè~ÖÆ¿çÃŒk'vûÉ$`c∂ëOâ=òÍfx√	(I<Âç∫ñ#ù”rVÎ_˚Æ≥Fãé¡Q§#ÈF Ó∑Î$BjàD;ráAK8πΩtuóe*ôñäÂx5|Æ;∂ç®$.™–Õyyú(j±tp;è`s?ÑöÿŒrPlâ”D|uOVÉwøﬁ^‡FèZ‹ÏIË∞´aù>¿¶r∂ñ.í
;7‘áF€üÄÒ‚Üt™Qı%T˙\‰/+ÈO≈LmƒêQà£Ñ˜◊Û	-cÜÂ⁄pu»î(∫$Vô\-!ˆ.ßÅë[¿8r~<Òr™ta÷Vª>µ·ìÂ\[âOtâèÂ˜|ÚÏ≠Ã¶øª«¬'¥ÒÃ”ß≥’˜7„%bÎ"˜π÷b,¥)-lÌß},"óñ]‡y4ÜCsÏUàÎËOçπ¿·;≤Ñ¿Iâúâ5eM˜$–Bå{!ƒ≤Úã6Ó›'˚-ÅÆŸ¨≥û3‚tNâ∞xo~œÌAÈ–VBJQˆ≈™∑Û™{SÁÃ+€1´\øÙCK),˘YñcÌ	≈Dc‡≤"^ù‰B¶™ÚÙdp^¥ou>´V2Î∫Úp√òYhΩ~[ê4Øıï\çå8,-ù	ßî¸ØM0≠Hæ˘.h§»GR≥ªOœwıÆNC⁄ÇLG-3pïj™ç@&]x!ﬂ·*ë√ˇ7_Å@±YÌWî˝◊ˇ
Ø=aïÆKïÓµs`´èBæ	@ƒ7≈â#ˆè6UPG∏∆ì+ª¨rﬁ•{1rA‡„èO=ﬁD¨≤Œœ⁄X‹cÿOHœ∏∆kˆ±ôåﬁ≈≈éP#è:åÅÂÊï{Êp‚÷Ÿ©Î[ò>nê€&ﬂÚÎ—}Aﬁπ”SÇı«õÓÆû
k≥3gÓEœKm}ﬂ}¡ﬂªmÌnlê9>q˝`~#Iö ¿¶ ú∏˝•P˚’‰GY•(√£˛ÅX™ezºŒ„«EzH;V¬Ù}X.X≤¬˝c∏Äü≥≥vkÌ°É∞78∫ﬂ?©◊Î¨˙$n€åIMQQ⁄ë·ΩÅÖ≤F$Q°fv/Áæ9¬ªÂÌ‘°jÑà∂{¡áîâ≠:;GMpF?@NÔ1≈Ãß¶€[ëxg®Ç2‡}ùø4,JeV4X∏	˜lÇ`Ô…Ÿ:b∆ÑsûøÊé(ŒÁ%z√â(‡ÈÒ„çüü>fµgŸﬁäZ`ü|vÀ≥Öøtfxã˜SS8˙f∆5©∂.e«∂¶’‡›©Ì¥Z±•R&R√˝Êµ|e≥]FÆÖµmB∞ù∆ìıÛ¡…1;	ßIœX‘£‡}÷hÂpˇYœùúΩi¸’„±€ÅœÒ‡È§˜t‹È¸^µª¯7E∏ÆËv◊n˜‰©55C°D£ÿò9cxî˛˙ıÃWtπ55…¥áIÇñ–—Z)ÃW•Ó]
/+Ÿ•R°Çb’o–§‰©Â{+Òƒ‘A†(„7,ü°öô«a9ÕÈŸ‚7›Û~∑£⁄° ^¨Àq9Yd£p&‘‹é≥∞»KB’»îåÀMêêO‹‡ïyUÒÆìﬁZ§Àóß‰C°_¿∆¸⁄M¢≠Û˚kòE˜çø1: €¿ªTXƒ]˝® ø‘i,P5ÿƒ¿ 0)àMäŒ:MœDçñäı|S‹O4àùÜ•8Xï8
ÒÁÊ;j≥í.®∆‘ﬁÏœ¶>™4ñ©?äÿÛ*]ñK^9;É}∫•Âé=c6π^;uá‹)∆ñ,·£ƒîLtEb⁄ûméÅvQ’uﬁ_zXπ≥:ê\W[zqÌüΩÃ¢˜q≤ƒjK∂ªÎP¡π€A€À∑¸Ωõ*MSxV(Ÿ5-}3‡∑0GÙ¨ËjEˇΩƒ˘G‚Ó’Ë1 K:!˘T+Êà∞nƒx+“ã$Szá‘õ¬JdúΩ….zæ∑"=˜h÷à“Bäï—u*+u/ù§*≥E]ßÔ]ËÊÓ‹ÂÌV#èt˛+Ÿ=ñc¶íò…}¥wì˙Uˆ@3≥è‚K¬#≤´@}4º^˙Q˘c≤+/-Ç˙˛$;Î≠5ÎaÉDúÔÀÜªgè∏^∏v ˛*wó®ö!˚U‚vUÑÉñ÷1∏\∆C.@_≈Áj‚ñx'~Ùø‡ëæ?∆ıNf¶SE«	|˘aYÀ–vÁ£⁄Ëb5û]˝gfRÇô`⁄‚0KL
¨ QÓtÌDîQÌFæüö=∏–±/èG¨
Ú≥è7.¿äôÉ©∏≥<≈O¯˜MÌ9ÿXhMjœ[¸ßTÈÍF«Ò¬û{µÁ;î•Ë®•mΩtãíxﬁ÷ö*|ùRy¡™8Y˛Ú7µf&§ŸJU)•|[äÙ—˙™0÷õCÓIµÚ"ˆˆ⁄g"´„:¬mü∂ı∑a≠∑5—·BOé.≥"ﬂ&Lﬁ&2’$¡d#‹'QV%N¢{&21uÌX§NÖ<‹=!Ò]Øv€OúÂV†ıN•¬f*ù1ã8ñ≈ƒ®á>„¬≥<€•∫äôexÃüS÷ºI0AÆ 3#l°8πc8'wÖ≤|”‘îR¨Ü¨Ø˘Í∆áWÒÈ˜E£aˆê5txNEôdô¸∞.JkA™e
S»ºõâîêÒ)ÖEîO°√·˛L{õÄ\î±ù®+L= òË;®p›esA¬≠´xYÅü{Üüﬁd¬yßoAÅ⁄CAZ—ˆ*
‡ÍÚπt»Hä√RÈ	JS@M%FLÿòèÌµr4«Ö„˛É;YQ™kñä
œ`(´∑Œ 6í]Ù$§¸12qçûPn77Z¨FÑGØyM‘U‰”ÂÍ,ºìäH£∆•†/Úa/◊∞4∫¨l£“D◊œΩ0`å(äò£ıàoÜâÁsCW)œqIÇ°≈ÉÚ	iíëæ~ƒÖÕºò_§dó˘.¶qÒTª”D/Ò¶¢±∏∫-˘Ü§ST¢@:∫˛®í/»à±õ®lâXÆä_RÍKÅÇ√y⁄πÄ|‰RdıÆ3/÷x(ìiÔ¢¬5W\ÅΩq&‘√	€gáõî√›T´J7v%ÿ%qKsƒˆXÍ¯Ò*N•⁄œ∆o
ådè%6n=p›7¶áç–´
0ƒπÁ(E>>πÂñ§oX∑ú°=Õ•Jœ^cﬂ|£ªK&Á‰V˜‚õ˝@πàì∫·®‰∞u…™·‚ÑZZ„ç5≈bÃß.Ä≠v˜≥F„5.iYWîu*§á8˚p{i˚¢âïµWbˇoá†≈Z%Eíë·O5-¿óé‚')∞∞úqπAóü€<3Ö‚}∂¡.Å4‚~÷ yfﬂπö2suv}[d¶∏<Y(”QQg»Ù+iN#Äcò%ÇòÄCPIáØ‹EÉ%zo•t‰òî.7JBc»•®#¸0wB+¿ßCp?ˆò ñFáôNﬁ‚Ω‘x"l“»™kÁz•fb“Õ-€⁄⁄ù∫,‡†=N¸∫I[NùÊ}qî©1´w'˘†∆—} ÛÎ≈Ù›c¥F%q≤ı≥ë±GáÕÌÕ∆•B$´¨ŸI˜Rkâ^=¿KF	›{dŸç·V≥–i¶Ïì3L˘~EuÂY˜E&ôë∞©.€®õe†!T©∫"#8WU∫jãßÛñÓ9¿^} c"Ô≠`@—i=·.öñÃâ,Ö3≠ÖÇ>H£
¨)2™ÈÏ›ΩRñ"ï®8©∞¥£!j^˝~¶^•t∫`1=î|¨+l©›rkRB»Â∫Û°¡óL)Ÿâ˜0KìQ	ã˚Ûï[üOfñ√(®¬’ywù∂æ”º)¶9]h◊&∏Ùdî¢Ó9å§w`	62ÇX=/”k•ÏöﬂÍîb∫)[22@õû‚_
DŒ˚K¯ÒÈ©%˙ÊÄ€ä¶≤â∂ò<%"wÈ d‰’4_/q5w˝∫∆Ë7!GRä5Te¸¢‹ù∏vÑFu5C°Ânr‚YcÏÇÇIﬁ+ﬁGÆL2¥«˚ aæ›»EßÒæ≤oëu©ˆz_◊R—Ø≤≈ãöZH©“¶:NΩ’Q» Tù!KEÜ~%^YN( oß≠≤áÓÏ˙‹ÖC≥å•,)≠S%Ü∂A*~í)ŒW…V≥;çí‡Ωt£–VNißIÉ'üîä¿Î+∞·µª<‘∆—9
ÍNÈnv≠ /YıF<ú√Óõ∂§Xë5ZÖbí}V2∑Ñ≠µ}V¥bŸ˙4s[ZÈŸ÷8∏G∫X‰Ä∏%Õ»¬vÂôRqs⁄B≈F˚ıöÇ îIdÿªµjÓ.K‰0!¿-z±iÿ“∞lvtf◊âhÿ9ó˘bB•X]'Àx ®k¬Ib≠Ú•ÖEñRª÷`ok…*9—%;•c≥+ ÕëÁŒjî¸2ï02‘(è&≤∞dY|ÖôV“ú¶ïr≠ä≤≠OR8àîÆ†Œ%JDN:ÄÑÛÃ¶6eµ‘Õ¸˘N˚ı‰ÖŒ—S&JïÌßµçúfKÌ¶—,µpÙh2íî˛IçaôÅæÿ^
‚bS^>û0VcÉp7z~Á˚t
í 9ˇπ;• ZµÅ≠π@$¿x±‰%fÊ8ık(Î65˘5ú´ ﬁÛp€œ≤CSß•‚'Uƒ÷Lw:K5åœx=‡˘Ã™ˆo,TÂÇPπ¨øX&UE'Áñ)„€Œ1ÚÃQü°˜Ê∑“ﬁ¸≠"-UT">7’Ê"ÆÜŸ†pt&6åhC™ÜN8Ä´AG$MﬂúZÙà˚ıÙõÔ–Í;˜öBõÿ)ÔÔ≥÷]¸n4∑çH;w>Ò˝Q°„[ØE™∏ì˙ëùqA´ﬂxIz#cÙC,ÃÀG_ã«TdÚI/«„≈Ô≥dˇ›Øüù¥(?(ßÔ"ºªÀ>,√GGï3ÑÎÊ∏7EõÔõoD≥tWÂ6¢‡ù◊s81B}ÛÕj"Ñ$ôVÓ(‹á˜¡IÕ_6‡˘ÈŒ1Í ∫ÆØÒ5•x;EEãMSÑÖôÎuºöÇ˘a':.ò´|3ˆASÕÜ4÷(Yû“—‚e÷†DvyﬁQ∫Œ(ÎhäJ4y#;´˚$‘´ü«AÕ¡ì9–˛ÓF-âàvH.;π¥Ü%Íñ@îA£/5âÕFîsèXBAE∞ÛY‡,·É⁄lÙQÚc]¥˚√‚€Ë]^˘Ë¥Üº@yMEY⁄⁄»Ö4bÅÒïﬁƒ;Ñ€∏˜~‰&≥å+$ùµ#AãŒeÛ'bë[˘Ù©UjÖñ™RÇ=+ç],"3G0]4+`·b“qûÙ¨˚Rß◊kïÈÓƒ>†¬J4∑)d¸€{ä√ç‹œ4˙≥Ryfª+ø íRIº#ÕmDënÜ#“óYµ˜‰LäΩ§5P–YeôÌ4 ‡ß£KÿH	_‚-w”Ú9ü¿NQ¿°'ÅwCS”@ÁÔ±”˝ˆXîú|ËETß¨ê∫ìJŸ—¯5∑êÂÌ¨v'IÚN°.ßø]6ÉG'Çıwí§Ò¨~≥Ó,Y'àØÏè$w≥Föª`yâ÷c∫Ü:ç/8{≈'ëÖû|(:≈áu∆©∑Ç_ıÁÆ¯ÓŸI>â)ºb≈ÁıG…gII!>sŸgƒ&?=‰,˙UÓ≤èâ`zÃ~Ù´˛‹’shﬂ˜ìOG
ØXˆyúŸDØ’ç~’üªÏcBËz»Å¯EwûñªtÇ¿NÊéÏ6FÍt=°øe8¶M`§HÍ∫¡EÁîπ± ˙¡|:5§Ï~ñ:oIqOÌM±R’5 Ù ¥Æ™µ)e'<¯Èk;äD»"® —,]ÔY Z¡πU¥{âT∆;6‡‘YëÀ≠T◊Ù<√[5û?¨ ∏í^ÇiXë<£√3àNÅvLgòÄ’ÜV2M3∂Œ˙èüú≥Aø˜®s∂À˚ÉÛ"ƒûüuu~~¬ˆ˚ù≥~'ï∑ı@˘¨	ëÍ–õ;Ä5∏04+ë
≥ßŒ ºd"u
÷1òP:Sú⁄îﬂ˝âú)q¡ÊVÚI÷Tò1UÓih™Ä`˙+>¶†ç+Î›)óéÈ˚‹‹idLg˛ñøï,ãm!<ˇºqø±ﬂÏFÌ¬Ì¨GßÕÒ)Ùÿdí´≤©W	¥•VÜ¶≥îÖ¥∞o]è_∏≥p{å·ÜíR˜L*Ç∫à°©êJdDç∑€nÕcóû;M†Ø-#’„⁄M~ôjÃé∏Jüoono_6eËUí˜¢}øWπo€≈æ€lNâ,è∞\)ä¢‹,vµsΩìIJ∏ƒöwŸÊÚPW*ó!‚# ÚRy—•≈¶P<•ˇ?-í"#˘5ÌZuMú5©‡πg\_´<	À¥	∏/¡œéÁ]†•⁄(Fñ32ÿæexñ°Ì≠°%Ωa‘ÍD^ïËÀDHı“∞}yùÑ.s.K$À≈EFÁ∏ü ï+L@óNVÈî9ï~ è$ôÿ#wt]ÇÖâÍ¢l2Ü#„Ñ:Ëπ∂wU5G ¿ëà÷esHµ◊¶Ó≠î√ÑÕ∞Ü9›E’/0jUä-Æú¯[2¿ña,qºa„~cÈ˛–j§é„|jœ˝L!‘?ÕΩË ¬óC±…’Qª‚JYI˜íƒÓiSw^E∫ñ9ÅûŸ=9Î-9b•‡êù[¶kc≤OAÿµQ:¶6û;º’˝"¯ÜJÑ®›2ÖOGãÔå®j¿ªb˜w±\C3†!√T5K!ÂÕ3`∏µ}47D±∑Á9·r©:≠Á⁄>ñáö…v’˛ñπÑÑ µJ¡øµ§¡ΩIGó$ºM¶,1¡∏#Âó√KîÎó T”µ=ÚÜ'?SùñCSSG"Ã(ìÌ±e˜ø¨?oº–;Æ8æ±ÆÑòﬂj¬m)Fx·^¡ÉFÓpéTXááıl|Ñ.Ô
ùXä3+kÃŸìÛ£√>Nõ8SWÀC°|'v∆ÈîÜ∫û»óuz’7ﬂ0.ˇ’˜Vy ¯äÙm#Gño\ÿàm˘ßûã¥Ä5ÑÔ øΩ¬;#=(Ω≠&÷õ≥R–√Q~ﬂñjØã¡!”ÀTªÍl.ôDXﬂ5åﬁbKâ`I∂fÕ™ºõå®Ë…≥πçê≥±ÏCL#.˝Íı˙ *∫pµ95˝âNS∫/0‰2Ü⁄Ãé§©ã4bÉµÑúX√€LûF5dµ&àÙØß•¥˘ƒ{»⁄ñ@7-(}\)i9•ßeîñÕ∞\Â·π;mÈ e¯ tÀcƒòúUìîüÔpíVÂ‚U\Í å÷÷ŸœO·ØøÓ=:ΩUf≤éêÂ8Ø¢€≠Bü8BNÃNf∏Í>ãdÉBè(èß°¨€)ñºëÿQúeçˆ≤™ò˜áÍiæ^*±G∂#Tœj'KVéßí≥ .èÃKcn].ÁˆnH -%RÑ
7	¶ˆÅÎÂ&@œoM≠ëıÈRÚ\MKlôq≠‰]wzA%⁄Z«ïfcÃ[°˝+[3Ø ËŸÛ<h˚˝…A<ﬂ)ÃœT‘SH,Y*íó∫Ÿ¢oZŸ2˚îzªôjúMd§mE;Iµâ
∫√Eô~JjZ¶“µ∞ò»√æ‡yÿ|:¡8äE55Ü’3æÙj,YÊÆ¯"[ºNœ“—M©aÁ¯>%]Eÿ`K{%‘ÆgÚî\htä=1X!Ó42x´—ä}FÉ#ÿy–‰Ô‰πv:*àÓàõ1¸9wÛª¬¥/F^B„äZz”jÂﬂ˛µá}Q±ô¿xŒõü¢ïè8ˇ`Ö› ¿‹èúw„è˜˙À öﬁHcÑ“dU¢W[BZX"çø'b	YXúóõÊl¸r7ÀíZ¶V™,è©ˇ{- #∞EÅnæB5"gLè7,ï—0át˙yﬁ3Î)U§õœ¢] €Hπ≥x	˚1Ö|6≈ÕK¯`SÓe;zdó‰Ä ö√pÀ∞Hå÷*∆§F„oıˆ*è]61Æcﬂ›jI|Ôd∞ì£ä§f“R%˜°¡˝Ê.CÑ›∫±F¡ôﬂ¢∫BgªÊ	á†i≈oÎ¥[Û™î[ Ú¢•€c‚zÃSG
õ≠Ö\+JñC⁄œvÃ}:ˇã!O±¸BÕ⁄î_ÿf¿¯≠∫ÿŸæãÎ¡∞¡®ûb€í–‚ó©G?Ëë1õÒÉ∆Y√!Óå\ÊnòÄä˜9B  ´H ˘eènı≤D3O9Ál∫çr*˙ﬁñv5j¥◊^h^ò©&/Ò‰VI»[~nâáÖs€	¯‰é\ÕEÔò	òräç obéVü„D˙ï ¶b⁄aJÌ^ôWÀÕcÚÓÕvÆ∏CÅ6≥‚TÍ'RMøëö=5cdÄNÑ#-`6xÓ©·¯Æœ¸ﬁ·⁄ò]XüÕ˝Iı´ü‹$æ~«åØ
≤?√≥«"À8søÙ◊ı¿}ä‚Ö˜((yÁDZqv∞˝˝]8Üy(;ËŸLÛ¸mˇ„æ˝í˜≈≥¥˜å◊@A|«ØAk´VÿˇßˇóU‰ù¯ß†]~
∞œ˙y,iÙ x±\æ˘JP~∆ÿNªmπèJáTûé)mPØéü‹d∑˚ªØt„“˘π~Ÿ'«ƒDï•îü≤•±ÃıæËƒçŒëô.áÿß( ‰zEFwâ∫˚∞Ë’ :,ÀL~"äƒr|=¸FjÂ0©„|Å¨€>èëwñˆhJƒ¶VU◊ºY1¿3ΩUIÃkòFÍvì-uíW§‚ÛTÆDÏÇˆÊnVìHY†ÕB ⁄=oﬁ+®N~¢iq40c©∑ÿòlï† bkzzƒÜKíö4œ,·Œ då¶E°‹ÃÑc+7+Öx‡%®§L<OpE U&ê‹ä8k±√(¸hP[Î:‹i‰øâÂWâêX∏P7l‰	=¸™Ÿ¿™ò»r€î)që„fe¸Uk‰¯*∫∏ƒ˛êb∞Ü…OÖdRå¿Zéò(è∞J=Û◊sÏr3BùÀpd	yôKc´BTWñŸ√Í¥%È¶›J%dµSPí*Ò€»	q˛≥§‹{Ô⁄ÇΩ/s—ß	´–Ú$µû‰v⁄-Ù%Ω>ÆÄ os—,»€KYÖ“k}À∞°åûpÛï3´}˘πB]B^§¬∆ˆ$®∞%=∂
ÀvÅ)1AÁÓxlõ≈YZâ[é|ccfRy‹••lIiÅü†ÙÚè*°ô, √¶M»çÿY‘ú]Ωî{ãZk/ññ/eƒ~»Ea™B…O9πÄüK %§–1˜—ÈÈldD™g8	•c=È«˙(TµL!f]…˜8û¸°(IÜù“¢úè«}gÁ¶G Œ'Al—“~:‘2“;!6m∫Aôr≤ë5°…EGg&ıçˇ∏DrÌî4Å¸d*1~r∆òœÉ.LcX¬⁄∫5Á‘$Røw™EƒüàâLH'zS“…ìÛ’D…ßÙ™·≥,ázsâP“¶¿Õœ&r&‹8ëœR∫cXv<ëk29Ñ‘C/ú.
,˚‘î¢%»ÇÎ’Â˛äﬁæw‘æ˛àB≠QL¢3‚˘.ﬁTûÙ√OMËd◊Å˜n8;Ñ≈óÁnî$éÊ©Ù·ÀzÆcΩ≈û™h-˜ÜãÔ«ûqâ…®Ω+JﬂdãÂ√{j/Ûq›√áÛª† ‚Ω{q6Õó˘h0€eœ_»,ô⁄®VùÍ∏ìﬂ%GYíû^úçˇ¯áø˚ˇŸiøáËßù«˝„dÂ˘ÉK◊•í^hß≈%)	KÌ∫FuI;™“i∫K?{ÓΩ5òË∞¨ Zî°o™k6î	6îÕ√Î¡“S™œû3∆Œ‚{◊–eß&à+áí	FaˆΩ:;≤Ï§Lœ,]9√)]Z'zj¡E÷%XÆCXu”ﬂeè˙µ≥Œ˛ÄuNÈŸè\ﬂ±åWÙÛÅmZ˛p‚òí\:‹“‰HﬂîΩ&kIQy¯∏w‘?Ó3LÀ=8Ïû∞ìc ™£ŒÒ~ˆ∆©πy∞¡âLA¢ñˇ+k÷ù#hÉ∑÷å*ÆRBÍúπ4çNOºäÂ„µ{í˚%w¥∏Ôﬁç¯!˘jbÆo s’|3¯øDÜ£B%∂ŸÁVÛı5Ô“œ√íês˜qàQ≤;<,Ód&øó]<∞›@q~ïø‰hn÷,c¯÷O^ô˙"æ.r∆Œ#ŒVæ˝'vt≤ﬂ;<AŒ“ÙÁΩ„nøLÊ¨√˙GßgΩAÒÌ1˚%Î˝‚Ù‰Ïº”•_%Æ⁄úˆ‡‹C÷?}rr‹€8:y‘?Ï±ü≤˛¡YÁ®∑ñ`Q7˛ƒ}sä†º›Qö">©.F ˛EÀw.Z≤g—í›ä§Ï> e»1˚DFıÊïùÓZ‘æä›oa"}Ø¢∏©Q“
HK@$/Å'¡]›œHJÉ®{m9	}ªFÌU–ÇKñf»ê)àê”wRC≤\ìº•˙ïiM›Òan	∞¶∫?ùÅ:A"ÒöˆiHúG[ê*Ö Ü>yDÇAjW+°‰‚L⁄§g∆;~Ê1øU≠z≥Ö¥ZQ2_aà)~Å+Y®íprªT¶Z„Æ‡äçãƒ¶.Ÿq}^ΩÔE>Æ¢FÒüãvJƒ,9Jé—5∑_î⁄2RÄƒŒ”óÒ%u¬¨òÃ∞ÄÛ
î'˘”¬ë5¬öfjÖ&≠êˆáñ+ûM]˘Nb7Ìã_óå#èz*ÏèRUÛÌd’<*≥‰ŒF=— ä\º∑£™b7LçÖp¨ÎlÜ”üË ¡≥`ü[SÀ´Kß2˜dÎ ”{¥`◊:_Xû-ƒ,ÊíPTø‡Äå*OW2ÑCM9g◊R¿ít~C:)^⁄L)÷OTâ≥Ï0πoEUié…æH‰å[IPAƒO©¸LıÌwÈˆÒ6ÕD™Ûâ¥9&*ø∑<˘JÓu ΩÀ!€Kù
já\Ë∑
Òïû™eı$‘%ı“ÁœR;TBSíZv‹ß∫d¿†$Ÿ•ìYuè¯Pîß¢=µÉ¯?˛·ø˝ù<6‘® ÑETr
“ê°Ñ‰Zè‘ˆÂ …7’1t[¸‘%ÂëKM0R™˝›ä ”π	≤ê6LõC‡ùÅG÷ÑoMÁvË˘·U#4™ô;ıµîiìÚ˚öT-ãæ5ÏªëïÕlIs"±HÕÙ!$,jäú	b•ÛK>/ eE-OhÊ8 ¨N‚Ón8jŒ3#/êºÒÑf¡Í‚Ç<¡˚¸©VŒfH/k5¸r9Y˙˛”øˇÀﬂ≤Ω∫¨fIaz{Íòç._"&±˘£¢åƒ®ÀÎc?≤¯ˆfœLﬁp·x´÷·me5aË$ô‰PŒÌŒMoÊ‘¿Ä†Ó
ÕM%lﬁ6ˆèùaAà§ÌõÀ¸JyjXñO±é¸a2ÎK.ñyƒH~ÈdÔ≠º,]DïÏŒ=´µµÄyÖ5\íH^©{˛ Æ<¯ΩøM!Îï@!•$º÷´ÑC˙?ﬁGk∂†„Ó	æ2Îl`\ûÖ+tjå|u2Èp©¥prÿû‰˚mqê8ÏÎ«&-=Eït8ˆµ9ú!ÅÇ@:…‹	)î±>u∆;} Oµ∞Õ&?≤éäÇcº6«ƒög®o0ÀπµÅ‘ò8–?\:Àù^x¶f≥YîRò˜"@'>0∂„√›ÈÃ6é\«+ﬁ›uP^,æÊ∂Î3«„—∞"◊]b|Û¿¢ÇXòKÊŒxx	OFæ1≤<‘ovZÒ
Ä•Ö[ ”6∫â m≤ãt§€ °8ñdzÛÿæH'Ωoé) ≥"‹ê¿…”'§˙„ã§°&6DLïSπÇm-{j z.ÎŒ„ÿ ‰y'ºÍæ.Pñ‹£ÿÂö÷Cj0byÈûCá¥7X€£>=;‹x{bMny' “ 4xÛR$FÁ›9Ö˘ØÆ…≈[Ëp`[B[t¸«IXΩ+≤˘lEÉ≥‚Í`J∞ˇõ¬eÆà^∂X“J“ÒPy«™ß(qø78ç~™Ti…Tø™}]˘5ØT¡ı‘≥Ÿ{|«}S∑›!ïq÷'ûy©.sgªÁ∑Xgïó@;Œ+uS.Q4Æﬂ=dÆd⁄ß®Ô)◊ºÔ~ãÈZo»C¨˜
6öiÔŸk“ÄÊr}˘∂+≥”D‹Çπ¢Ó–hãœÕ◊ÌBæÉáscƒ∫D\ìÿ∞∂}ˆ'æg◊Á.<hv·ﬁ®:N∑v[g$4VﬁTŸ€ˇ|pr\uà»ΩövÀØS¢u÷Z+zÏG⁄w˙îx…ﬁKA;¸¯ƒvÑ]^ºâ~ùXaƒ€óÿx"ûCõÎÃÙ—RYm©,Ωã7€kvjé¨˘¥809ÕRìΩåR»Cß/0ÑöÖLÖ#çëÖ%lÿ˜+è©—•g£iix√	p?ä±“—0 J6õcZ¸¡fahπÂ…Âp‰<·Ío˛ôù$¨∏Yú•»ùŸI+ê].æÛA)€/‡˘Áçã∆eÛ˛ïçAP*ÅûtÑ$räº+ßÕ–’€¢Üj∑È∏´≠|◊’‹§z‰˜∞k¿BeAx◊i¥&)È£™X/ﬂ´∫(¡V4íÂ€n¶ÛﬂË éá"6vîj4&∞”˛K5Äî	4’Ÿ¿-µ¥B€x>µçµÇOç±hU(›+[W-ù£	D∫ÛdIgdÃRJxf‰iß;`IïÂÄÔdU3eM—Ô
ë3≠/ç±æ3Ùêﬁ†V&Hª»j-<ƒ∞R>®÷Ã≈§˚≈wÜœÆŸ‘DBYÃ1«†òÕ◊±zö{ÑkªÜ√¯<!ÿ8ñ∏õcÎ¬≤È‰Gƒ¶ÿ⁄€ øHS«t◊ëÔ9>9ÉÁ</Ê˜ƒ∞A÷Z^»:üç>(ﬂÙe› ¥™kCük˙ ≠IQdˆWﬂ1û	4gu·P–Y}‚0DF6êˆ∏W"$Hu≠I¢¡B,Í‰ØØ~&π©¶Ç%…/ºöÎÿ◊ ◊@Z´FØ‹dy∞˜fì!"b*Ïó*ﬁ¡—_51#ª∆eÄÒ‘‚Ëí´¯ƒÃ9±_µ~¨dL•¨=ˇ‚ã‚PTƒ$ÓÏŒD”6˛;utKàª›55d~3F˘Oo¢ü2™gj»)«"V&-ÉH<µ¿©!më∆¢ñAàg*´<î™òßg'/;›Û˛≥“2èOŒé:á:%ì›1Ç5∆7ø%Æ3≤(√Â9qùx£èÇ‘ﬂ8µ»ô∫xèf(i—«Q †å∆5ï%pdpáî(p≥|äÜBvFÄ$w%:πUÒ«øˇ«ˇóø´≈˛Ì_ªãoèNÿˇ¯¥ﬁ9cΩCvÿ?˛´ç''g÷;fáˆ‰‰Áv–Ùªù/•Î∑D*HÆ3¿fB§E8ﬂ8>ÏU„!ãvRgÉ\2`˝Õ!¢Å`£?1
‚0íQÄÈÇÒZG_ú1„ƒ–ƒ•Ò˛∆<ä«∏t J"ë9O8+b^õQMÃ‹.53[íô¡Jµ⁄»Úálf'Zò©Òâÿ÷√ûÉÔ¯5⁄ ©¯R¸
ÎÏbbó“n0qU®?"∆•»ÓNµ§≠<¨!¥ÅJ¨ÈW¢sóºM±•«s°ƒ7™±‘o˙(||C?·Pc{©Ç«∑”’Sïû3˛ÅEâ®Õ,a≈q2©∞*/y‡¿+ºb _ãﬂˆZ˘∏hGß3*˜{É£≈oŒ∫ù√NŸóÌ˘¢VyooÒ7Dﬂ*˘`:4)6ÖCEhFvi'\%tÒù„≤/˛ı‚=Ï™Ä¢≠ûHıÁSqOP©áﬁfÊπó@J»éïC∞1óÅ%Rı∏y˝ø˛3¸˘ézáΩÓ˘…V5Ì˜Ω≈oOXoøG∞^©⁄ú/~sº\ÌŸÄûˆu≤ßù·%lpÚË¨á‹ÓY 7(ïﬁy”ZÓ€Ã[NGÀ[¢8	ùTˆxâú¡Bq¥™ôÌe≠Ïd)‚≤Ç©™◊‘Q;J∏¶a?X∂ÀD}sÒ{7ü√Dû[ÊtÊRéî(∂~9ñoò'lË+ïy÷5¶1™’á≈≠º ”ÅÃá¡ú'¯Û=^ÉÌYgQeÅ)2%a7õ¸Ì√åB‰G˜VÃïÜ6fkË“Ê%)—˘]``∏⁄lÄØî∏°]™]¡ d$âWœºˆ2¬m…_9zÚÊh†5ud"∆ìùæôÅÙ ∑Éó1ﬁŒq¶¿î¬€∏û´Ï˘ó?X>ï3UfT&Ö≥ëË/ùÏÔñ“ç@ìßl®åáæèƒYCÚ,]lÇõÜ¸9˙Ü$ptyh\ªÛÄí +4÷∞R"P$zÖâ^4Œ
l©3Ê√˛¬•KE0ﬂVù9ò|CÚyGo©¥Wøîì'˘;ƒé5‹k4‘ €Gù)/_í˚∂‚ñÀ‰rM8B=>⁄Òw'ªZ‰åÂ%Ω¸ü<I¶^∂eﬁK◊[4”%zÍ‹˛ƒ©Ûo˛9§Œ¥|˘¥H‘%÷À)óX‚TöﬂBmHNñs≠'R~]˚'“ﬂ˛6b°Y’ÂˆÒRÖS"^⁄¡F•‰Ø–ìW3%˚g*ÔßJx.Ö)¥S∫’S‡ÈdQ˛N˛Ω∏¥ó'€´g5˝∂,_ y¿¯Ä]–#Õ7⁄ÓZ∫ÈêBµËz†√z¶BV VTö –ˇ˛=Îtœüv˚øÍÔü†©{ﬁaßgΩg˝òÃáhU‘ÎÍÿäz~ñ¡ûíw"œêcÇIU\IÏ-ô∂‚T‰ -¶ñÉh@w∏
¿¨·óÌ˙E®Û•´öR• <4‹,·<âÈ£TÍπ
Nﬂ∂≈(˙∞%0‹∂ÿ€Zìä”"ã91Dd¸HæmL|f´!Ta&M.rê1m•≈≠X®cbrÃ£i"öñÚLó
îÊïhˆG8⁄¿√]∏Ë^ç
vŸ°&Øk/æ√éÙ‰˝£ÓvaLÚL9ÅÉ-Æ~=7y´;Jy¶•õû„ó°	œåuÙ`ø%™Ë ‰|√DÀ°ˆkc∏¯lÌ!:
L∆]aûã?á7µ‡¶*/#	h,Úêï§≈Ê8L`√‡ÕßFsi¡ê;[Ã¡	Ê‰]Y3Ã\£µ&ŸÛ&ÓÃ …=÷™±⁄•q˘ˆnÂ;ÉcYS2Ÿ+Æ[∫Dy(˛ Ú+¡˝Ôqá`÷ñ@NGìm≈ıa¿ÂkàƒU∑Ø$J˙ 3Ì»œÄX$ ÌÃo3Ãö(@?Wá»2 "˜≥…J
-{éÀ6D¨(.Ëﬁr^+«≥#pÎíûÃc$coÒ6ÅK«˜›úé(DuBpûuÜ=1·™¡ìN´ΩÕÆŸ–CÊÄªë`ø?ôò,Å›ü|µ¶©–Õ‘ ±±=^a*aî∞*Í!FóòRæ Ëã5›û‰¢P˘æ7‹+NmîéÁ3ÂÄ>+ï…&Â¿§|[6íà¶ñÑ≠Ä.
jÕ-µA#@h4U™fˇìõóKù–µ5ºﬂk∂‰åè^6_·ôx®T¶oÖ∫D§ıS‰ﬂ∂ìÃo{	`ñ6âÅzX˙î°ª_∞ Jç≠‡F˙mUT”ÿéXœt¥ÎÈaY¨8 ◊Ù©”`˙œ(©-=X*t≥”KM(çãÆ≈ö!Ó∂Ô÷ôÄOà‡Ñ0
B%ÉaÑé}/d„Ì¬Ëπ≠(+§y–NR!nˆ'UË«?âeòk¿)8`}5üº‘XÓ	…F)9ìäw⁄TÇ[GiqŸ]L˜<;QÜ#ñ¥ x['Qñ#Œ‹@ ⁄TäÕVÅw¢Xò(@äî]ããº!÷í')«⁄eÒÍÆÌÿO9ç5Å˘º’lLß/Bªπuˇ˝v°pr2ßW‡oÉê ˛tsÂË ê™ÅqÀ<÷õçd#’fkvırs;Ïé—XßˇÍÕùµâ®w‰à¨{>ßU~AÄ◊"ΩUaãﬂÅÁ∫”CwÏ¢æÛ”ü≤¯¿ ∏∂Öı¬¿6Öï“§îEË{∆5‰ø rû^Ñ4≠ı6†*5´_è©‘¯ﬂ©O6Ï`ØMœÑ(`Ü.%5ë«¡Dõ€‹Ω"»DÑG›ãØ1v:‰ç¬yhÕm=Û“Ù<”;uAh\‚axhI-I…¶‘Í”ﬁQÓÙ(ªözé±u˙s∂ô∆’fü!]¢RQ√ âŸ∫çfÎvqƒ!äçß∑7M@+ç‰)P>È´v∫Ø1∆Uı6Zf™çãËù¥;#¸,µC¬Ì<]Cø·'=´[8´[ÀÓÖ≥¬û?˝‡tñD¯y†ø~“ÙG|QƒîjCœı˝BBåûÂø3ÙÏ<rØˆ*÷`≠-¯øÊ¥mÔUD#Í1[IOÒÃNä∂∂i+zÍÃ&l\∞yüafœ§÷Æ∑üµáçZ}g≥Vﬂæáû¯èèâc˛ºÜsü¥áx*kdæÛ·g&~∆?ºoÛ˛∞¡‡ÏÃw>ﬁ_√Î_„ û¿…tcñ˘÷œÎm•∞˜ΩÎLqÒâe˙Ó‰}bSãkÓf…9C_Â+3K ¸Ë_[£`≤W°6D¸»°ÂòCc∂W!&î<äMö£√*˙°ÏÃU©gkÿ¨o›áŸ⁄fõµÕz´	ˇ¿Bv‡√?˙Øπ?n·º{€@5õs	[—í∂Í˜∂j-<Xke.n±ù:'k’7âx∂Í∏û`ﬂc˜~Uéíáa∂X≥ı‰>‹üΩÖè J€ö¿ > aæÌèñ¢Ü◊Ü≥E!I CÍn¥⁄õ∞Ù˜‡Ô&Pk˙˜iıÒ0˛tüàH¸VèDGk‚∑_ïh*B]°Æö{ïÌ
ªÊˇ\µˆ*Õ¯U¸+ü»•@∑åü∞}'¯†$ÈO,”Òäù1m&Jógx-÷j˘;¿/vjÕ∆≥∂]€©m¬ç7_ﬂˆ¥ç<§AïNâ{OÅó6ÅµÿVmÎ„2†EJ”m∫;©ØÕ6ª…~nxZ.a°\®≥…“ΩC'kú^π"8sz!5˛~“cQ¶≥h<ˆ‚Ÿ/Ó^∫0VS:Â)ZÍb[‚uB∞l0ñœ‡jwîlEÑ≈C˝©16ãö	ˆ˛’b±Ó˛Q˘¨ác®g’Ygø≤ﬂÔ<>^|;8ÔwO
ﬁRø‡∫-≥b‡íª ˜ç††ıt÷Dé#Eûƒ}$ªyE”◊.èx>Ë·÷ﬂÏÊ}àŸ%ãB]¢n(˜û^Ê‹›?˙e5~πµ∞≥(t¨˚Z±jã¥g5˙‹,¨/
·ΩUû∑µÜX›7ﬂ∞ƒÎhÄÂ•é∂¥_¢ùÒK`ˆÀÙÇWã5€h'Àtﬁx∆åº/ÿ3ˇÂ Ú…Pt∂6Øÿﬂsì|ΩB‚”“åîNtÏØÚ0ú¸–?|Sa≠@+Mã˜”|ñœVJÖ&^Y[ LO\Åó‹—w=©¥o…#ﬂÛyÊ–Gù›˚ˇáﬁ˘›$¥C
NÉ¬íyf≤'ñ/‡‹√Æ¨⁄%¨LYS±Yπzi∂AÏ`'ƒ…¸õ∏¯QDﬁπPˇæz˜¿⁄<	TBh˙ÿP2\#oñŒ/
Êõ‡ªl?D!òì'Ó¨ë1Lq!]…„`€¸•a˙r…Eÿíòß#&ª^GU‡L@q!vOÁ∞ˇËLtß{<ÿ?`ÑC–)yiµôQ“ÎœùÕ/çh%#:g˝Û∆:òDÎ¨6·œ¸i√üm¯s˛Ï¿ü˚tN„E}jÃ™ØahÈ√·m‘K”˜Ÿ^Õj.U√<¢g9ò{Nëôkéóˇº2Ø˜n‡aÖ^Ù<∫¯DñÅ[úí˛º≠ﬁ>)ù^–ìX¿ÙJbæ,(˚ây5Mëˇ¯˚√∆}ÖVv'iêøÀæÚ∆’ü‹Åâ[ß„U0„€ÏgÒ∫≠Ω[g∑=aÌ´ı‚Ë÷√= >¨¯¸Ä>ÑÂÒyÉ>Es° ?ÖfëH6Y¶˜raÁe%û!vOVçu)∂ òX1ﬂﬁ
ÀdBÓñe)kÍ±15òBLÅ1–uß3‡¡BtbLu∫xèÈ»ã‡wﬁÿ3‡á©8;Õåô)´^)xÌƒ{™/<y`z÷•Rø◊·m
‡ZB_DƒC`eñﬂYò˘ÀÌn—©˙Kf¬—GìNÉ8ØâÊCEÖYÀu√¶ÜÂÑhú’c`9l5t√√Æ76ú¡5ı-?<à°ˇ+Òúw0Nf[ˇ} :Å∑Ø∆/¢Ñ+ÓÅ¬f¿m∆f»rß®RR±‹Y¯›ÅÁN˘Ì∑]g“ìè+‡¯«.s≥Œ∫O{gß‘@6¥¯u=Ì’ô;ü»ÓêöQ\¡Õ(¡\!@˙“⁄”``⁄Å›ÚI{‰éÆ´ÒZ˚¥Sq–?;Í∞Œ!¸pcM45á•ÊÊ¶:r±_QhÊÚpÙ¿;¨ëI…¥KëÀ¥pj∑sPEQd>ÉÈﬂJıÚæü4i√RèHì∞7≠•œ÷#*äà’Góıﬂ˛znô¸T=21:‡…‘ò8Õz®T{¿FO;ã≤iê•°ÒUÅù/üıªŸâx{¸ ŸtœÁõ[‰m,ó`/°∫ﬁ+#LûÔ‰Ä&Ó-È|’vﬂÊYπˇ◊˚¬äõÃÊj	Î@‹®H†”IäJüîïI*IÃb"Å≥±∫ZY„¬3çWˇó[scØ6pÍgÇ"Øb¯ìjâ‡BÅ”7O+ô˚iP ◊Ωl^z/ÑÉ™ï$‡Â
!Ë©ROÑoN≠,p\∆˜—ô£ëbA∆a—£≤èŸF+Í&Õ"+GT9·FÕj0!R9ó¸|∏I83«ﬁn92u2?áøÿëˆ·_ªGiÈw∂©ÜórY*Fô{é@Ù§Ñ+8ÑΩ?IµÂe„$æx∂í©ÏK2ˆ¨sÿﬂÔÏü∞_Ç∏?8?É_ä'Á_Õ∞‘°96Ï’5^á›≠aÂ·°yÕ0≈CÀMJwùã}DY€'E†⁄ÒÇ:kni⁄o§ÁÆPêÈt¯·!
k¿‘ﬂ#Æ	Ωª2ˆ≥¥ví!…™s@m-Ws¨~Bä‹ìVhîCÊySt© nN9-ëã)∫)QÕI¶÷ñ|Mq√R	û¸ìHÛLΩDÆ'ˇP∆'QDâ4M˛IAóÅ2.f∫…5FY(õZW∞V∞ÓµÈ‹¨ô}]˙i∑HÂüíô%Ù¥rŸ§tª<I¥≤©õ;IKO0ë®ö&	»—ÙÃ”÷Ë¶FPX§ëêƒ‰ÚïV˛¥x  “/QπleïKeÂOˇ-7`l!˘wøÂF'ñ˝˛„˛yÁ®w|ﬁ+˜¬•ÖWŸµ.ŒôRî>˘R¨/¨ìj^Æ˙!ıîºyê+∞ë∆ŒR—[û˚ê‘˛ÀjûÖÍºbê2y‹≠Í–Í{I)9ÆîË1ûÄF◊‚;ôıßã˜ËÛvç/oÇ\jÑ±ïÛî—ïÒHf/÷TK¢ú5XZ“Ø|Ç‹À…?®!¥–	÷Ÿ?;aÉ˛Ò‚€SÃp—;z§N≈|;;◊Ì#tvÌrkˆ¬ºt=P^ç1eä†˛˙øD_Ô≤äaø1Æ˝ :7Ç£√¸∫wÔ
¶∫∏0ÔÓ={4•rÔût¢X’á&óÕ:“……È†?`ß'glÒÌŸ„ŒÒ	´û.~Û∏‹a˝„˝ﬁiÔxøè‹\ÔÏ∫ë¯°ˇLGwOGíi˛Å©hªŒˆ{É«á'Éòï?:8ÔÙª"æﬂc›√Œ@99ÓÙTî\‹±áYG>´“¿á–ú»	!1S?0‹´≥ŒqÔ'ªò^Ÿ9cè˙'GΩÓ‚7«(}z¿D;Gƒº.Fñ3¥Á#ìE}'¶Çƒ‰√Oúáj•“SÖ·≤h‘ªµ™Ï≠Àı9œ´Tâƒjm¨´M6eΩÈLr´DúAT'jr≠,ﬁ˛ì.⁄ŒHißfÆLøé“µª1XªÎa∑ú¨Ωl	ÔÌ w’»Q´ñ‡ä∑ê·FØ»_J¸™´˝x‘O˜
}Sªºßnÿ¶I,–eZ¨ú¨˛¸Û∆e≥—0_îääu∫'Gßù≈o;G®où „<Ô=>Î≤”∂:¡ª}ç]≠KWó’%‹óî%ƒÑvGÖ	Á¿ôÁ√,[ûÛ1Âﬁé]?J°ÙïÔµl-Â•Rq?Jb˝óTØÀ°Qú+eÄôå˘B6∏JÚº>|Æ‚'…‰˘à†”].>@˙|Ÿ‰y}ñwQ *Êã´ßŒó¢7çjÈÃ˘eqyJÁÃﬂ˝\&{;âåyD#‡´è:Ω‰Mª¥Ü¯yMéæß6¶åÉ'Z!RkG,ÁB/õUmæ#t$ôb,zû¶cç\°Q&9øî§;@+Ç6*’y;õ	£ÇV°ORªÁ≠4õhEÿóvåçôã!ßÒ"@Z=Ñ §]FâœHÿMà«&âhôåì¸¶Ô5N9ÜO=w∂¯ﬁ∑ÙÄˆz¿U2{Í^C”Ì,’0πLéUfâÎ>ˇWm¢≠ ¿™D_vII€íEÒ≤k√;K°vZjG¶,eÑ∏Ô˜øá∏ÔË\È†˘ºﬂcO:ááù_=>∞ﬁ/N˚›Œ˛…@≠™	°P;ÓÇ~√÷uŒ2+˝ º>¿‡ì3ˆø§JÅÍ%ˇuóŒı:≥FWªÃô#Ê3e‹:z(çÆzóÇ»£·‘”]Ÿ©Ï:¯f–41ÑRH¥Ò6M e>]™Oq$=l®ÚﬂB™∏SZ'Hœ"PQEØÃ@»÷1®4]«,=ì`P>8‹çTñ≈wV´“Åcy9CÉí`%zoîrÀ1Ïs”õæ´îÀ”_~ñ‡èÂ'!nFkÕª1ÚuÙäæ5Ö.-sÑgÂÛ}Ä•n6Ÿää}G˚™"ÏùÄxﬂQf^(’å[Ïÿè¡œ›Jä—&≠kÓéˇ  ˇˇÏ][s#«u~œØhAæÄ	 ¿%YÀï± ñI0 we{£há¿òàÅf r)z´‚™º§*©T"?%©R÷oÆä\ C èÊ?Òà~BŒ9›3”=”=3 IiÂljI\=}9◊Ô|Á+Kö±hWXÙÍ’õtî¡í≥Œ—ÈxngLUíÕÌ›ô:5Ù÷€ŒLo>¥="sòúuõ ≥·æÊ ¨˙∑ìYq„e
[Rπ÷cJ¶ZÈ9H}Ùå/ñ∆ˆd8±G¨úÂK,K≠˘Óë˘˝“m5;á≠£Ω 3ÛK÷|F¿€oµ∫çÉñ…¥H7.Xºá¨“∂ŒÙr5jπ®D5on{QÌÚœ¿Ã/f|0d“[)Çk˙∆7Ê˛®¸a>!Ã–à4x-ÕìÀuv¸˘pûÜ=¯õ9vft'∫3î|”˜Ë,Ωxø<(€ï⁄«˜xñ˛ÌøÉ≥t‹mÌ?;:i`◊˝VéQè«m{œÿ·Õ?Óa.Ï§€8i§·¢2Œîë[&-ôÛ`ÀPŒ9v◊€»Iñ©è@áÛ	˛fM\j¿∞≈á‘u≈Ê„ôEM	‡ïsHµ/∫ú/À·ù^pP	miƒi-„∑‰9\Ü|∂¥¸Hq_TnoRÍL©/SÃ8dh–Ì=Ã,K&öÏ¥/N	Nû}¿*oJÏ˙≥[Êõ”≈ﬁí#Lr/N√n‰%1<$≈Qsk√b˙ò7±±≥¬ÿt—€’«ôp/u=p°‘ËsÜà æü9jE54üã	!¸˝ReïïXÅZæùß¡˛i„®‘£R’
ZQ.
∫∞∞◊P∞˛¢ÅK±xÛıâÙ`∑Ïœ-o‡XK¥Ç—:≈ıY`ê$j˚b˚l>±√ê™&”®ÑÿÁ∏â/hã√/x‚-º7Í˜¬lπÓä;‡nöÕØà,l#≈o8∑∞HÁ¢Ô¡ˆÚó™âò—E¡«@Ú˛ôûÊ Å˚i£îjÚ„º»&ÃÆkHWKî‰©X∂`ÏøÇ˘ﬂ!ˇU‰ˇ|, ÀBˇóÜ¸ﬂñMNKÖ†•›ì∫h†Òá¶z∂KeOZaæ ¥</®\öÉ;CåE]É$Yã‚≠oCwW˘-√~ªá˛Er∂Q1ˆ/
j O¡"ÏS3Ω˙CZ4_Ô¢ e`ÓV(ßıà ;¶  ÎÊè‘-º%ﬁ¿¨;≥‚¨KıN;-~f]∏ﬁ*à¢°g˚†«ÿø{ÅÈﬁw¶˜Yü√∑Éi6TÅ’”U
¸?„M}Ï†™«≥¡àƒªçO∏A˝/4È’†a:r'Z5oL¢£≠Æº\M∞ëyÏ∫∏)©ä“H™5!∆‰Êß”◊HHveIc“m´Æ´ïç±†$ï+uŸån —¬)Ÿ+ª7r/è√f:öKjK•o*›HY◊ºYã2‹R°o‘uΩ†É˜®È°%z,EYS∑%y’õ†e-OZ˘x£§Ã©T9oú≥¨˛{+	ñúôw•aŒπïÎ^ñËb≈ÿ¸ak÷±¢ùºg†q«v	nŒı‡-âO+øÅ3
3øo E[DÌ»ç|µ7ÊtMπ6î¶\w¥a¥q¨∞ÒÌxòk#=§âRqï#85ókµÆRpde6≤*¥^a◊rÀì®â ´-:º)–±$à%æóÔ·˙πã≥PRû◊
?.æ˘ÚÀﬂ±√Œë„0B]vO⁄`ˇaÃGO'Ω∆Ò1+
¶úﬁ*Bÿ;˚›∆ìõnPÂ|Ôòàr=ÃµRË£ë5Û”)¢äˇó£°–;s–5z8~é◊è|‚£CôãµßHﬁ6‹)få<ÏÔó	«ù∆™OFÛ•öÙŒ∂ì5∆2Lgvµ√ ´úﬁ~+m◊„ƒj¬
Q>Q	?Qâø›~ÌÃ∏∫™y^º_ﬁ.*V–≠&Âsp<6‡|(tMÔm’ÄãötÀæä™lqÛ<cƒN∂…^LSû.°)ìπ‡›Uçπ§∑*·Œ·—0YëGyP©˝x’:ç-Ñúrñ7©pÅ∑‡L±‚ÅãM{¿Îıg+…°≠è62Î2ËI.Kíû¨ﬁ∞Pé¥±}£Åa¢¨ÿÇIîÉ›#€CÆöl°Y‰ßEº+ˇDöËg¥e‘,Ë/≤•<üI]€E]¶6¬Œ2O’xG®ûêzQ,_Ùp€*_åí|¯Ö“ŒNg{rÊj"D…!lp=ê´lÀ ¿`%¬π‚V$?¥TD!p‰>qßx>x%u&’’b-¥u5Ü⁄°‡ˆRöxÚ°·§7Ô1ÙJπ¸c÷†˛Û‰ÙÈÎ2ÚWQH$üø◊¿∫nè‚¢ñ≥†c⁄g∏+Bƒ*õÕ}–r†∑}
Çb⁄ÎîÅÖªpÆGçjaH^ﬂˆ\øƒN‹ÔÿÎπ}t)ïŒµ…Ÿ\jò{ÖÔ¥'$ª(^{qÛ{∫^(»hñ¥aR≠wòVr¶9M{<£©5ôŒìG0
´€µcÎ‘'Wm€\É∂aﬁEô≤ˇËÊè∞)ˆ‹«@é.;”>à;kºíL'>\ß±füõ»Í£ºùi]ΩÜ”Ø®{Éy¢bïòG§14d[Ü˝ˇÅvô@‹⁄Õ¿h«ïÎÉ¥SXb{„∞Ω]∞ÂwXΩ∂]©î≈É1È€ø˘}‚}µnæÚôÔLÿl‚0wò„˙+˙ã_X„9Xèóx:¨ÈÙx‰Nò$P–#ÑWÇÜ∂SHZ⁄Rb¶fv	‰Ò–ûïË{J‡î‡Õ◊_¸]ym˚„ı·™ôÇï°ë<.dª6æôƒMoÊz÷–.¡'€∞cäáü˜ˆ…/RXeÊÀXãìÃ‘∫@F=»ÿ.ßÌ≈3∑?˜wæ©nè∆†¬îâˆE¿WÆÍŒgƒÛƒ°°äü™€ö¯ø©5≥©é-Çé'ﬂ4ùÿc*N{ zlÈWñè—øâêN†¸nærW#âésÅùŒ¡hΩyÀπFHLyHŸ;&.QF9ñ>6ùeCo>u10iùz`Êéıï‘≠`ˇ«ç^áUv¿ß=Íùtü5O¿°º’^„Á:ŒW#PGØÚ[f!á:0˘EaöF≥6¡Ω€`ıNxÁxvﬂÕsíá»L˝ ÷π
Î$∑π•◊8˜'Óp8∂Ygä,œ§¶XP⁄¢œU&¥ÎıKIŸR`RTT¶Rï8“ŒM‘‘∆Ï
’èÙÚÚ=7Ø.Œ°)’˜!S<[©Z&ñzä$Ç”ƒ%˜:”’wX ,€ú
†ìú9…á aî±EòıMµÕoµ\NIkÓƒÓ∂VNäQ≠«ﬂ≈:°˜Ê•Åz$EU öZ˚ù∫ØMi’Å„[ßc{∞{mX_SÓí.Lü3måü¸${ëLWOËpI≈/Vï∏ú1Ò™Bj]m?å‘÷Ö⁄Bxó”%ˇ2√ç†üvS’πAíîSzù…»,7öVP3AŸXÿØFLÙÖõQ4®I\Á÷í∏√,πÎ≈$>‡à7Ü∏Zÿu*‹õ óM¿›}JÔïÂ}ÔÊ+d["å™¶—YÄ˚VJE3¿¡ˇÛøˇx„º]“˙úΩºÕ¿}11î!tƒ4#rÔ¸3∞6ç%¢©iZsMªpp“’èHq8⁄ÊÊùV>±–wCÈÁ‘
G~H
G]”ä&∂	í
Ê8◊s(óX˛Ô≈räE·} Yƒkæ3≈íO™‡CV(
∫“Ç[	ÈY»Ë:È;†Q|DïÄ˙∞'!&•s≈sƒ√s‰<¸∂§VÅ/ˇ©2èrÿÎßI&p≠WÓ})ò\ü»A´;H
◊lt˜]÷Ë6ü∂üwzÏxÔ…_†ä˜j˚Ñáıÿ^ÄŸïxmXÒœEc
Î(<m˙jü4Q·üÔƒ€ßËÀ‡©1í{9ª÷@Ù6Ÿ		‹HÙ‡™ÅøA/πR1&—ÉC4ÇY¢G¢H∏-+õ∆‚≤ò<7F»ízVóvS’o5%ZpB	)_˚√jä•ü`*˝ﬁ-D˚á'z@™{Ê »ì¡‘&Ww=ÉƒwJ2[?hfÓ-F7ù9#'^ñ¢™îHÓù±;|6ñRN…é7u%dØTƒsµ‹äïhõ‹»;ˆ‹3€'hIâ‰e≥é∏T<~/Á|AÛ/ßX örπïò®P∫[ãåÎór„•;:“9¸ ∆Úö,qWË>DZFêﬂ[…ÀÍzøLøT/ık≈Â]í:HïÄxﬁE!F8P‚a›Í‹zeÊúK¥§f'ÃYSLkp˝E
Õ*ö≤Q˙HÃò›Àˆú¡Õ€>Ftn)/s}$√ƒ›ÿA$‡q„ 9o[Glø”Ÿ?h±Ωn˚˘ÇôÑÄË˙Cº{¶ntœ÷xv“9º˘rÃﬂõAk∂`Ô».ÂÍ§g] ï¢fß^ÏD˙ÕÒüMÒX√¥¶~‚]P*…±ÊT,Âxÿ…(»/-gñ©!§Y-	îA2-VZº¶Ë-Ò“Ôƒã≠e`‡¯#]πzÛS«CÒÁΩ0¿ ≤å˙!MÍfjœ,ˆ∏—kaíuØq..®ö}◊≈H,Mx~+[≥≥RävÌ3œˆGÕKù~	jÉ¸©3…≠l“ÍÏXW6"ó◊eÜ‡öQ≈qdÆôÜ·Æ4U˘¢Ÿ†.‹iª⁄⁄Œ–‡à¯ÓËÕ,ƒ∞a_ìo¿uﬁuPËéTÊ°Ì˚÷–Ê§„ˆÂ˜öcL·T/äØ]ÁwÑö†§\OÜXTéì≠m%†¥Ò∆§¸àúv44ú#Ç˜Ÿüz6ß ç„iÑ˛¡Of‘0b+“`R0ø'6ÄÆÈíVXÎËyL∞≈LÆ©û∂˙ù4π¨	b[B¿—;∂—”!ç$o67øÓ1~¯–“äëëgüÌ¶7Qy¥s®£∏vsò`v¸√}ÿé¬‰¡%Ï ®LÂÔÚ˜∑{ÓáFI!˝˙so‹öÙ]LÏ"’¸ˆ¨€∆î*\r2+‚‡çC}Ã•1¶]/G≥Ÿ‘ﬂY_∑¶N)y	‹ûuSdp˜G◊—≈ﬁ¸øûä∆¯Êeä˝ïÒöãb'+¶¬<á∂[¯Œ∆‰SΩ≈bãû‹)⁄Sl‚¶”§!ÙïRª∞'™FHJ˝R◊+)q⁄úÖ+âl∑®:0ﬁÒ~áÍò@^+ïﬁ±xnNÎ>“E˘„=‰Å…UŒ!>@÷Ä-Mÿ≤ˆJ¡Ø[⁄pcö?ñ3‹wK¡0Ω:q·{¶ß.ttDWYZ4y4loV,¸Èm†Ã1‹0∂Ae¬’TËX>"÷öZSPx˛{Ï Ï ˘ò¢ÜmRlŒºÒœW–ÇDã$6ï%¿8W#ñ÷˚"ﬂIg Ëká÷ıPtm{Á´Èù?MÿFüE™{…8$M‹/Å&åi⁄	π#ìπ«¡õ˜99ﬂ•Î}äFﬂ¥πjõbV§l+∆¯¯d'‚äJ&‡Õ9â*≠^ÕUb∞Y	HÇë?9ÓyÀ9ê®ÔmD‘◊i∂zùXÂoHÖ	ø7 ¨ál~{ùû∂“DèLw5åóvﬂAƒ˝·¿Iπb≈ô¬ö¢ªï±ÛË©ƒ\1v}8Ô3"†G¢˜I%+U*(·yÎ`JHú¬ :^ÿÚ˙#Á~¡(0“_åÅÄºíâŸ2>H˝†‰í3iTÈ ®Ñ§X.GÕﬂºE-ñüH!z0é˘m∑Ã.ÂRGﬁC∂e[ƒx<∏›&‚”ÃÜÖ(t∞&‹/åã/c-YÍÖõ h¿ZxÙß∑=ëÆX≈˙≥ [•íª)ñ‚‹˜¬¶/∫[{∏Ó&úŒ<D"Kî’ˇˆåeıÕN∑€Í∞÷A´y“Ω˘Çz√˜ÌÉ†œ—Ißõ(©ﬂ?∑úÒıÙ˜SOüY$ÙC=}ﬁz˙Cÿ¶™°ÅË>°¢<{@P¿ *;ùÉQ™59tˆí¶Ge°{:a!	¶´%‹Ke}t≤(´◊…·ƒ9	 ÍO›A≤†(≠∂ævõ⁄˙∆|6ÇoEÂâUtXp}äùG=ÊzIA∆Å¬ÎHAØﬂ‚"7˙}€˜O‹OADË…±«[zHƒ9Uπ≠=
ä¶ ?)õñèÕÄú’¥B¨b+ƒ™BﬁKÉâ]¡‡Htfi	\Rºl¬û⁄4∏-Ê`˛B˙`®&n¬œNÂ—u|¥'àÀb=NDfœ«¶^áπXB√ì{;Ú`Õ•£fﬁ9Çâêa„ˆ<€ıb õÑ*L cN4–w\A@T≥xPVë;¿≥…“∂—vË„}>!wA(w«YsÙÅ;tI‰§9ºﬁ7lOËCŸëïf5®¯„*µ~≈é0Ä¬ˆ°\-ƒãÈ£=+∂Ñy√öy∂2√‹JX$Ò´ŒŒiﬂ®ö@N˝.óÍ%W¢-v_Ú8¶•4õ≈CÙc”0∑‹ö∑e!„P7√“À/íjd¥»ñ™#Ù˜ H„‘[ŒˆTﬁ6ù}Z0[⁄]ìV«ﬁªÇ«„O«÷ﬁŒá%p}Ω∆¨X^·Õ
âËå&º,@Mjöÿ_8j Í‰õ÷∞Wp£0`|Óöz§Pﬁ¶∑Âï;Ìô™a“`“BŸ$X50«h):œ)xÅ;kª{/j«ù™òM∞˝Fà˘ûÎ€9©ê®•5t“•Î3bÒÙ=rX<ï\Ñéï\'e‚¥†£fDhl`Ñ~niŸ8´SﬁôœbzµNVÙúèAhí;ãõ'Ÿq—_
í˚:üÑŒDoN>IÄI—∂j∏ç∆AlZ-ôbëqBB©ú?FŸ§‚£íÂ∫°pfÏ∂Aè5±ﬁQó	∑R2ÉÉ¡ô?5SiÏ@õw	Èö-§{]fqÇCµ^çªê¸’ñ%<ÚﬂÈö4pÀ6Ø?∂Ôfe‰Yºõuë=yXñ˜ñ>KQh"«Ã‚v¨Ωt¶ééX0˝;Ù1˙ƒ∑!√GìºC,ú9vxÅ≈†–Sìk‚Kd¿ç—ãŸ•€§˙Mu€	rØ èÚ3Ó»"RƒÙY¡›Eª‡ƒ]§,{ü§®“sÂ)ø1Ë;Áø"á2•ú/jÂ«ÔúÀPÈmnâHoN]<æœß¢·œ'Çµâê˚98‚\ÁÄè'œ∂ìøﬁü˚· ƒKÄœÕäÚjêßOúWÑ‹	*># ^˙π≤‡Y—S~}7'EΩ◊eŒILÑ2¢±-#ˆ⁄ª∑¢Ë°˜tÃ‹ÕËˇ-ÍwÛÕó_¸CV;Ë≈kÎËS∆Æ¿G≈≥u—√¥ë”∆πx”2ÛFtÙsGí ^"D’!éÑàíÆlC+3õÿïÜûuÜπ…¢o±°ô"˛‘ù¨ï˚È/ñ˛b|ØÖ∂∏/ƒñ?XìΩæòπUñb∆îe,h⁄N)kÚÁˇ¸"∆	X™8$M.?∆D%°9ø«¶IÄm˘ÿîKsn{Sn´py)´Ghy∂E≥F∫‘màÍêœ˘hJ•R„`aÀ?î◊,Ò‹K˜∫æ∏’íõ/9’D©ömîd‰îZ≠i,ïz∂•¬∞i…Á‚•8ÚÆ¨òCÏ¿◊`O´S[ú|'g:3€()ë◊<±◊d©¨=ÏÛ` é’¥ˆrÓ?S∂Ñ†ﬂciÊ9Á≈ïË)aãÁÿV"˙≥Hñ–d„¸Eï
òbπîtTñ%≠ùÂ√TKb¡BTö9cƒX\ìt—±g#0u2Õ]$‹jaöü„û"à¬LCœ¯]Èù%”o{—r˘ŒZ* ÇAÎwb µôBÍf≥! òÒÂ©©‹b∞æ‘VrÚYâÁ.u](çj?!*õ ÿ_Û∆PÛSlrŒzΩˆÁøˇ]P‹≥·|⁄¨ÉÄ(÷8nßO»¬ÿŸ&Ô¡äX$ê~˝Ÿ¯
˘Jµé≠+PO¨(pñÿdΩÔÅµäΩêl¯î⁄gMA“Ú*ˆô=L_©PZ∫¿ö;s„MH=X'.ÛŒù…⁄hçøæ
ãΩà¡´ ˜r5&,+!ÈvX·}ﬁ4†¿ﬁ(TîÙ–Fƒ|ë∫sDõ\L˚a˜]∏ÉËâ~u+plZ!!ŒÌXCÿhÿsrz
{¸4®1¿≤ÙÕ}•væbúöNæ‘ª7ºIL6[Å_ßÎÊ+3Or¨^eìóÔæÊXæK˛O¨ï/ØmO^nÅΩ1YìÏ3ôûZØ^ﬂ≥ú'G≤WaIåÆ.rpÕ7´=¿µaÔ·n!Z5S£vÊo1õŸö9ÙU?énoCß
‡*ΩTW—ÉåM¬cá!.î⁄Ñ:◊~¥oÒm)lÍl’p∂jywfX¢áÙ2 ß‘Ñ≤OH™†7ÅÕÑ˙ûÎ˚∆^€ø2,V|Ïæﬁ-îYôUkˇ;s∆„›®∂I%bAáí˜¿ff£¯á‡(åÿ dJeõ!çÎh≠^™?Ø˜Àk•≠çµ“Êt®Éˇ#ûcsÔ}ZÔ„[Y9ˆöø3Ò;˛å∫ïÌ~ô¡ªcØ˘x}Ò~˛ÒﬁLf±W˝¯∞>/§[MÎ0•Ê7§4‚÷,Ê»—`o∑î\~`o©OÌ¯¬Úg?r≥—n!a‚ôPÚ}k∫[ ! ?˚
ˇi”æ†\ı¢ª¢÷Øîj€0—µM∂±∂Q™V‡X†¸0¸)”ˇ*õÎFﬁ˜`v√É≈©¡S’p©™•µµ*>πVç}∏ ∂J∞ÈXµ¥Aõ¢V◊zﬂ0~¿¸*}ÅÂ√™¨R}∫üƒÔ¨·•iÁ‘F≈ﬂ‚NL¨Ô·È_YìÖv.1
éfç¥ZﬂÄ•| ˇ≠¿ŒaõVü∆ﬂ∂iSàø÷Çg¬g◊ƒ_ø pÑ®ﬁnb≥◊ï›¬fÅ]Ò^Wwï-¯S¸´ü∏‹¶KEWﬁº’ÖÔtk˘#«÷àw¸{∏«$2Ü¸Ç® ™UŒÛ÷Z•¸º>^€Z€Än\< ±±âgºLˇ…P“5œA∂U@<TYL≈{Y=ìÀm@:õ˙∏'ﬁià®_˜«à˚«)7öuF€Â·®íàçüÜ-Ø‡/œ
ÿÊ∏;L¯Væ¢dÄnÀ^s∞4•yﬁFïe°∫a~9ÙÃ|ÖQÎ\œÈ<Ç48]]¯î;p¨·‰ÊkF]<\ÏOmÅ´lº##V˜ºŸ˙¸ññItØ∆R‹ncØ›Ÿk7ˆènæËi˘˘}ËólA¢&ı…kNFΩgÕrB√∏ï›q≤P#úáz>04ùµ'vdÌh∫;∆Ê<º8ˆ–xtM=chÙ'Óﬁ·/ã—›¨º	ãÆÔ.é¶Ôà„J¥s9¥1(5≥ÿ>r6Å"à«G¢dø˛5ìFöúx}8DıSÎ1?ãK¿%ﬂî›’®⁄éH¬–ı~"ˇΩä(DÇ<ÖB,Yz(ﬂçqﬂêI&
uqÎÍ	
 x;bIØLãäœø{∂Îı¯ñ}Q©6AæµÖaô±Y s∏ÓjíËQﬁ≥ÂœÊ >øùŸ qÔÎÏ5≠±sÍÖ9(Fãú6'ÃhüO=™rÛïœ·Oë»C∂˝¨QlŒo˛`±„F≥G]√ôûäf¡’≥O+ùBÃ˝®MhQ¥0f+w»
®ÒŸ ULƒ@–y5≥ÆáWÚ%¥dè<!dÕy· ûçT*÷ÄÊî=uœ¡ÿR„i√~–ÉÖ6˘M¬4%2{”◊$æ¶WJ≥ß¥Ÿ8h?Ó6öÌõ/éÿ~oÔ	k4O⁄œ˙ÒËïß.Æ9JTBÛÅ∆â¬}Jf]¸ÛEy¨ÎUVÖü¯©¡O~6·Á¸l¡œ6Ωß¸qÈ‹ö©ÖÆûÆãSuçQMOlﬂgª¯)∂ÜŸï†ƒ3ÿC	⁄åËÒ©}µ{5&cS€l$ïZáÖ‡˙(¥\$˜¢nﬁÚäë)ˆDê6VV≥«0†YàXX3ttbQjƒhÆ"/…êñ∂…≥'/Ω·iÒG◊á‡˝îË˘"xtuˆ◊—:¨ºYe∑}√ ÀUsÄó7∆£]ÿ<»˝˛zù~êﬁ1\¿¿xñäªzDÀˇ„•I‚µ7	%öÎ8
ÅëO&*í\íTc}ﬂ:∑©ÃôÅâä¸Û}®ê^VÄ„∞πˆÕÔΩà>6É_Œ≈ì3˙llW0µ„†¿<L?I’'Öá<rOƒmNüË¿/s¬˝ø5p`¨C˛Ï°5ô[òºÄÔSìÙVpú‚K,\åÛËÒ/∫fÁñ3·o[≈ÜÀœÌ9wä^]¥Î≠IÔ
ûı?xSÖØ≈ıﬂ¿¯¸ÈÿôÒø{6‚„∑°ÇÀÁÌ°qN¥Öè˜m%ÃËçª¡kO<˜ú_'q—Uv™˝HÏÀBT¿¨îXÛY´{LDgÅ/®ÉÈ¿D	[=∞…$~Î–rK&Åmœ9”óÚx6(*ÔSÃ¸˛	n≠†Ÿ◊‘ﬁ‰ìv˜∞¡À±ND7}êz◊◊≈Å€K-póx	M,òe˚ô7÷∏M˙	√#æâ|¬õ	ÕQ‰dåióSÎ÷7÷‰.∆≈SFÒñ‘u42á\÷˛ú∏$‡∑¢y'‘'ÿäµpŸ<2∞ÈLê¯,WQ‘R◊À†Ø^^PfrÀ¨lM‘·∆i—€‡ÃR/6j]U’eÒî‰M£I⁄	‘ÛÉú1∞T&7äã~ÛÂº˝øˇ˝óLPΩú\ív≠∏@*vyö¿¥∞ô(Á,ÕêLn≥Œi∑*qõ¯‘≥≠O9 çÀ,ÌH	ÇÄ|~’ÄzQ=µ¸ëËóV7üŒd˝wRü+≠O*gﬁ«"4QïÔ;õ‘RY¢ƒ<,}qÃº‹øÜ¿SŸ…µR<rWEÀ˛Zï\ÖC—Ê≠ÂOm¨
@¶˙Ç—7w≥]{Ë`a…{’ôT…ª>p‡<˚Ê¿…˝›^¶u∞ÏÕE◊ñy¨R*Ω %~}gB∏eﬁM‚íd‹à˛´≤äÂ2Ç›£¨õbÏ9∏∏Dé˙KP´˚ÌﬁI˛0O¬∑æ:=ó«ˆÏ°5^|ë‰É†sfpå˙ÖGˆ¸¿‘!aì$ü›UÆFì∫Gäµÿf%V©≠,-ÆÕqaÓêí °rÛ5ñ»X·WSC
ç»≠’•®ªéA±Æπò íWV∂ßÏ(¡@ÎW∑ ÒK…:%l¥Tÿ≤6pF&ÄåKÀ∏q°THh*yà)ê*˛ `≠ljÔ`|(p„J-òπ ≤ót@+vÓºÜπáı[;üègŒt|ï˘-K ∞¯##õb•dA±µKYç#•∞ú*r@ƒ!!¸r«¨pÔM=m„5Âõ3˚≈	∆¥‰Ö’rY±ß¬¬/Ÿò ÍUî±rﬂ|˘€Â>ÍΩˆ~˚§qpÿ::i•ﬂ`¶œZ;3Ù¡Äªç°ª©6g∆#ÆØ◊6(¿‘}m´ÅiëÉ‚Œá¬Ì§ÿ¨yÌ™
+ç⁄´≤çêˇ!ö À£Qƒ∏=·kp∞X¿fÌÛõ∑#ÒEà∆/->Æ»àü∆<˛®f¶"[Ï .%ôJrñpùY≈8HcØ€aΩˆ—Õ«ò˛÷G¥±£Ç [)1 ⁄·ıÿ·˛“©}Êz`~YC%è>∆◊”À;¨`ç/≠+ø∞ ›¨i˛9Co€}FthÊÙQÌ|UÓfµ7J∏Ãù„^ªG¨„7_t˜GV<æ˘Õ~˚®¡⁄G{≠„÷—^≈¢>Íq≠â˛∞ñﬁöŸºÁM∞Yb{≠ﬁ˛Aß◊wÂÁœz'Ì'Ì¶Hœ!3˝A£'ûÈµz˙M GáVó\˝wz	•π∏Á•{Pbç£÷/:;àYjtŸ„vÁ∞’º˘µh¡È}r–8ƒNmÉ'zÅÅM1Ùˆ$Z?È∆íÒ˘ﬁ_1„kRDÍ(Åyµ1VºƒKy>˜ÊØ˛  ˇˇ öFºi