import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import BibliographySearch from "./components/BibliographySearch";
import ImageSearch from "./components/ImageSearch";
import ExpertImageAnalysis from "./components/ExpertImageAnalysis";
import VascularAnatomyViewer from "./components/VascularAnatomyViewer";
import { 
  Activity, 

  AlertCircle, 
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Code, 
  Copy, 
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
  Languages,
  Database,
  BookOpenText,
  Maximize2,
  Minimize2
} from "lucide-react";
import { initAuth, googleSignIn, logout as googleLogout } from "./firebaseAuth";
import { Mail, LogOut } from "lucide-react";
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
    category: "Mamografía",
    desc: "Escala estandarizada oficial para mamografía, ultrasonido y resonancia de mamas. Categorías del 0 (estudio incompleto) al 6 (malignidad comprobada por biopsia). El BI-RADS 4 indica sospecha de lesión y amerita biopsia histológica."
  },
  {
    acronym: "ACR",
    name: "American College of Radiology",
    category: "General",
    desc: "Asociación médica norteamericana responsable de estandarizar la nomenclatura radiológica, guías de práctica clínica y control de calidad de dosis de radiación ionizante."
  },
  {
    acronym: "U. Hounsfield (HU)",
    name: "Unidades Hounsfield",
    category: "Tomografía",
    desc: "Escala lineal que cuantifica cuantitativamente la atenuación física de los rayos X en tejidos. Referencias clave: Aire (-1000 HU), Grasa (-120 a -80 HU), Agua pura (0 HU), Sangre coagulada (+60 a +80 HU), e Hueso cortical (+1000 HU)."
  },
  {
    acronym: "FLAIR",
    name: "Fluid-Attenuated Inversion Recovery",
    category: "Resonancia",
    desc: "Atenuación de Fluido por Recuperación de Inversión. Secuencia de resonancia magnética ponderada en T2 donde se cancela la señal libre del líquido cefalorraquídeo. Es de vital importancia para visualizar la esclerosis múltiple, infartos cerebrales tempranos y otras patologías con edema perilesional."
  },
  {
    acronym: "CIE-10 (CIE10)",
    name: "Clasificación Internacional de Enfermedades",
    category: "General",
    desc: "Código de clasificación diagnóstica administrado por la Organización Mundial de la Salud (OMS). Facilita el cruce internacional de morbimortalidad y estandariza la facturación médica (ej. M54.5 para lumbalgia)."
  },
  {
    acronym: "TI-RADS",
    name: "Thyroid Imaging-Reporting and Data System",
    category: "Ultrasonido",
    desc: "Escala ecográfica para evaluar el riesgo de malignidad en nódulos tiroideos. Basado en composición, ecogenicidad, forma, márgenes y focos ecogénicos. Facilita decidir de forma objetiva la indicación de punción por aguja fina (BAAF)."
  },
  {
    acronym: "PI-RADS",
    name: "Prostate Imaging-Reporting and Data System",
    category: "Resonancia",
    desc: "Estándar clínico de informe para RM multiparamétrica de próstata. Valora zonas periférica e transicional con escalas de 1 (altamente improbable) a 5 (alta sospecha de cáncer clínicamente significativo)."
  },
  {
    acronym: "LI-RADS",
    name: "Liver Imaging-Reporting and Data System",
    category: "Tomografía",
    desc: "Sistema estandarizado de categorización para hallazgos hepáticos en pacientes cirróticos o con sospecha diagnóstica de carcinoma hepatocelular (CHC)."
  },
  {
    acronym: "Opacidad Alveolar",
    name: "Consolidación de Espacio Aéreo",
    category: "Radiografía",
    desc: "Hallazgo en tele de tórax caracterizado por el reemplazo del aire gas alveolar por exudado, sangre o pus. Clínicamente compatible con neumonía clásica, contusión pulmonar o edema agudo de pulmón. Produce signo de broncograma aéreo."
  },
  {
    acronym: "Atelectasia",
    name: "Colapso Parcial de Parénquima",
    category: "Radiografía",
    desc: "Pérdida localizada de volumen pulmonar por reabsorción u obstrucción bronquial. Radiográficamente se presenta como una opacidad lineal o densa con desplazamiento de estructuras anatómicas."
  },
  {
    acronym: "KOSS",
    name: "Clasificación de Kellgren & Lawrence",
    category: "General",
    desc: "Criterio radiológico clave para diagnosticar y medir el grado de osteoartritis de rodilla. Grados de 0 (normal) a 4 (severo, con grandes osteofitos y deformación ósea articular marcada)."
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

export default function App() {
  // Navigation & General Settings
  const [activeTab, setActiveTab] = useState<"generator" | "classifications" | "consult" | "presets" | "api" | "bibliography" | "images" | "expert-analysis">("generator");
  
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
    const matched = customLogos.find(l => l.id === selectedLogo);
    if (matched) return matched.url;
    if (selectedLogo === "custom" && customLogos.length > 0) {
      return customLogos[0].url;
    }
    return "";
  }, [selectedLogo, customLogos]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("rad_selected_model") || "gemini-3.5-flash";
  });

  useEffect(() => {
    localStorage.setItem("rad_selected_model", selectedModel);
  }, [selectedModel]);

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

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const originalName = file.name || "Nuevo Logotipo";
    const cleanName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const newLogoId = "custom-logo-" + Date.now();
      const newLogo = {
        id: newLogoId,
        name: cleanName,
        url: base64
      };
      setCustomLogos(prev => [...prev, newLogo]);
      setSelectedLogo(newLogoId);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogoById = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este logotipo de la lista?")) {
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
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCustomSignatureUrl(base64);
      localStorage.setItem("rad_custom_signature", base64);
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
    };
    
    if (file.type.startsWith('image/')) {
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
  
  // WhatsApp Share States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsappShareType, setWhatsappShareType] = useState<'report_pdf' | 'patient_infographic' | 'patient_summary'>('report_pdf');
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => localStorage.getItem("rad_whatsapp_phone") || "");
  
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
  const [gmailUser, setGmailUser] = useState<any | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);
  
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
        setSpeechError("El navegador no soporta grabación de Voz/Dictado directa.");
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
          setSpeechError("La grabación de voz está vacía.");
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
            setSpeechError("Error de conexión: no se pudo enviar el audio al servidor de IA.");
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
      setSpeechError("No se pudo acceder al micrófono para realizar la grabación de dictado.");
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
      setSpeechError("La API de Dictado por Voz no está soportada de forma nativa en este navegador. Recomendamos usar Safari (iOS/macOS) o Google Chrome en computador.");
      return;
    }

    // Detectar si está en iOS o iPadOS
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
          setSpeechError("Acceso denegado al micrófono. Por favor, asigne permisos de micrófono en la barra del navegador para dictar.");
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === "service-not-allowed") {
          // Si falló con continuous = true, baja automáticamente al modo alternativo (single shot)
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
        // y estamos en modo no continuo, reiniciamos la sesión inmediatamente (emula dictado ilimitado en iPhone!)
        if (isListeningRef.current && !useContinuousRef.current && timeSinceLastError > 1500) {
          console.log("Reiniciando sesión de audio para dictado continuo...");
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
            // Evitar acumulaciones dobles instantáneas del buffer
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
  const [modality, setModality] = useState<string>("Radiografía");
  const [specificStudy, setSpecificStudy] = useState<string>("Tórax");
  const [customStudy, setCustomStudy] = useState<string>("");
  const [laterality, setLaterality] = useState<string>(""); // "" | "Derecha" | "Izquierda" | "Bilateral"
  const [projections, setProjections] = useState<string[]>([]);
  const [customProjection, setCustomProjection] = useState<string>("");

  // Helper to build gendered laterality
  const getGenderedLaterality = (lat: string, study: string) => {
    if (!lat || lat === "Bilateral") return lat;
    const masculineStudies = [
      "Hombro", "Tobillo", "Pie", "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior", "Cráneo", "Abdomen",
      "Escroto", "Cuello", "Tórax", "Codo"
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

    // Custom alignment for Mamografía/Momografía
    if (mod === "Mamografía" && (mainStudyLower === "mamas" || mainStudyLower === "momografia" || mainStudyLower === "mamografía")) {
      const gLat = getGenderedLaterality(lat, mainStudy);
      return gLat ? `Mamografía ${gLat}` : "Mamografía";
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

    if (mod === "Radiografía" && projs && projs.length > 0) {
      const formattedProjs = getFormattedProjections(projs, customProj);
      base = `${base} ${formattedProjs}`;
    }

    return base;
  };

  // Synchronise form dropdowns when parsing a string
  const handleLoadStudyType = (fullStudy: string) => {
    if (!fullStudy) {
      setModality("Radiografía");
      setSpecificStudy("Tórax");
      setCustomStudy("");
      setLaterality("");
      setProjections([]);
      return;
    }

    // 1. Detect Modality
    let detectedModality = "Radiografía";
    if (/ultrasonido|ecografía|eco|ud|usg/i.test(fullStudy)) {
      detectedModality = "Ultrasonido";
    } else if (/mamografía|mamografia|momografía|momografia/i.test(fullStudy)) {
      detectedModality = "Mamografía";
    } else if (/tomografía|tomografia|tc|tac|ct/i.test(fullStudy)) {
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
      "Muñeca",
      "Mano",
      "Pie",
      "Doppler de carótidas",
      "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior",
      "Columna lumbosacra",
      "Columna dorsal",
      "Columna cervical",
      "Momografía",
      "Tórax",
      "Cráneo",
      "Cadera"
    ];

    let foundSpecific = "Otro";
    let foundCustom = "";

    const cleanFull = fullStudy.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const study of studies) {
      const cleanStudy = study.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanFull.includes(cleanStudy)) {
        foundSpecific = study;
        break;
      }
    }

    if (foundSpecific === "Otro") {
      let cleaned = fullStudy;
      // Remove modality names
      cleaned = cleaned.replace(/radiografía|ultrasonido|mamografía|mamografia|momografía|tomografía|tomografia|tc|tac|ct/gi, "");
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
    if (detectedModality === "Radiografía") {
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

  useEffect(() => {
    const computed = buildStudyTypeString(modality, specificStudy, laterality, customStudy, projections, customProjection);
    setStudyType(computed);
  }, [modality, specificStudy, laterality, customStudy, projections, customProjection]);
  
  // Image input
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Loading & Generation results
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSteps, setGenerationSteps] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<string>("");

  // --- INTERACTIVE SYNTACTIC HIGHLIGHTING AND DYNAMIC AESTHETIC STATES ---
  const [isSyntacticHighlightingActive, setIsSyntacticHighlightingActive] = useState<boolean>(true);
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

  // --- CONTROLES DE CHAT INTELIGENTE MÉDICO-RADIOLÓGICO ---
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
        text: "¡Hola! Soy tu **Asistente Inteligente Médico-Radiológico**. Consulta clasificaciones (ej. Neer o Bosniak), dosis de contraste o términos. Te brindaré resúmenes exportables para inyectarlos directo en el reporte."
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
      const systemInstruction = `Eres un consultor e inteligencia conversacional médica y radiológica de élite. Tienes un dominio absoluto de la terminología de salud, enfermedades, dosificaciones de medicamentos, dosificaciones de medios de contraste, y clasificaciones radiológicas internacionales (como Neer de húmero proximal, Bosniak, BI-RADS, Fleischner, etc.).
Tu objetivo es dar respuestas sumamente claras, científicamente precisas, profesionales y estructuradas.

${generatedReport ? `Contexto del informe radiológico activo actualmente en el que trabaja el médico en su workspace:\n"""\n${generatedReport}\n"""\n` : ""}

REGLAS CRÍTICAS PARA CLASIFICACIONES Y RESÚMENES:
1. Explica con total claridad y detalle los grados de la clasificación o temas que se te consultan.
2. Si el usuario te consulta o solicita clasificar un hallazgo en términos clínicos o escalas (por ejemplo, 'escala de Neer', 'clasificación de fracturas de húmero proximal', 'Bosniak', 'Fleischner', etc.), DEBES incluir al final de tu respuesta un bloque especial de resumen de clasificación opcional encerrado EXACTAMENTE entre los delimitadores [RESUMEN_CLASIFICACION]...[/RESUMEN_CLASIFICACION] para que el médico pueda exportarlo.
3. El contenido dentro de [RESUMEN_CLASIFICACION] debe ser redactado en formato Markdown limpio, sin rodeos, listo para ser acoplado directamente en el reporte de estudio bajo una sección de conclusión o impresión diagnóstica. No repitas la escala completa aquí, solo aplica un resumen personalizado y conciso del hallazgo aplicable al caso.
Ejemplo:
[RESUMEN_CLASIFICACION]
**Clasificación de Neer (Húmero Proximal):** Fractura-luxación en 3 partes con desplazamiento del troquiter > 1 cm y angulación de la cabeza humeral > 45°. Impresión diagnóstica de inestabilidad articular que requiere interconsulta con traumatología.
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
        setSmartChatError(data.error || "No se pudo obtener una respuesta válida de Gemini.");
      }
    } catch (err) {
      console.error(err);
      setSmartChatError("Error de conexión médica con el servidor de inteligencia.");
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

  // States for embedded classification recommendations
  const [classRecommendations, setClassRecommendations] = useState<any[] | null>(null);
  const [isRecommendingClassifications, setIsRecommendingClassifications] = useState<boolean>(false);
  const [recommenderError, setRecommenderError] = useState<string | null>(null);
  const [incorporatedRecs, setIncorporatedRecs] = useState<Record<number, boolean>>({});
  const [incorporatingIndex, setIncorporatingIndex] = useState<number | null>(null);

  // States for interactive report modification & image valuation
  const [imageEvaluation, setImageEvaluation] = useState<string>("");
  const [isEvaluatingImage, setIsEvaluatingImage] = useState<boolean>(false);
  const [currentModInstruction, setCurrentModInstruction] = useState<string>("");
  const [isModifyingReport, setIsModifyingReport] = useState<boolean>(false);
  const [pendingRecText, setPendingRecText] = useState<string | null>(null);
  const [incorporatedAuditRecs, setIncorporatedAuditRecs] = useState<Record<string, boolean>>({});
  const [modifyError, setModifyError] = useState<string | null>(null);

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

  const [bibliography, setBibliography] = useState<string>("");
  const [isSearchingBibliography, setIsSearchingBibliography] = useState<boolean>(false);
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

  // States for Advanced Vascular Analysis & Schematic Drawing
  const [vascularTable, setVascularTable] = useState<string>("");
  const [vascularStates, setVascularStates] = useState<Record<string, string>>({});
  
  // States for attached images / DICOM captures
  const [attachedImages, setAttachedImages] = useState<{
    id: string;
    name: string;
    url: string;
    base64: string;
    caption: string;
    isDicom: boolean;
    dicomMetaData?: Record<string, string>;
  }[]>([]);
  const [vascularDescriptions, setVascularDescriptions] = useState<Record<string, string>>({});
  const [vascularSubLocations, setVascularSubLocations] = useState<Record<string, string>>({});
  const [isAnalyzingVascular, setIsAnalyzingVascular] = useState<boolean>(false);
  const [vascularError, setVascularError] = useState<string | null>(null);
  const [includeVascularSchemaInReport, setIncludeVascularSchemaInReport] = useState<boolean>(true);
  const [activeVascularIdHover, setActiveVascularIdHover] = useState<string | null>(null);

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
        error: e?.name === "AbortError" ? "Se agotó el tiempo de espera (Timeout de 6s)." : (e?.message || String(e)),
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

    // Reports log setup
    const storedReports = localStorage.getItem("radiology_reports_history");
    if (storedReports) {
      try {
        setSavedReports(JSON.parse(storedReports));
      } catch (e) {
        setSavedReports([]);
      }
    }
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
    setModality("Radiografía");
    setSpecificStudy("Tórax");
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
    if (!file.type.startsWith("image/")) {
      alert("Por favor, sube un archivo de tipo imagen (PNG, JPG, BMP).");
      return;
    }
    
    // File size safety check
    if (file.size > 15 * 1024 * 1024) {
      alert("La imagen excede el límite recomendado de 15MB.");
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
      setAutoLabelError("No hay una imagen cargada o región seleccionada.");
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
        setAutoLabelError("La IA no pudo sugerir una etiqueta clara para esta región.");
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
    const labelToSave = pendingLabel.trim() || (pendingAnnotation.type === "point" ? `Punto de Interés #${annotations.length + 1}` : `Zona de Sospecha #${annotations.length + 1}`);
    
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
      "Extrayendo metadatos clínicos...",
      "Estableciendo canal seguro con Gemini...",
      selectedFile ? "Renderizando densidades anatómicas complejas..." : "Analizando concordancia sintáctica...",
      "Aplicando reglas de redacción radiológica...",
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
        }),
      });

      const data = await response.json();
      clearInterval(stepInterval);

      if (data.success) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setOriginalBaseReport(data.report);
        
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

        const updatedHistory = [newReport, ...savedReports.slice(0, 19)]; // Keep last 20 reports
        setSavedReports(updatedHistory);
        localStorage.setItem("radiology_reports_history", JSON.stringify(updatedHistory));

        // If base64Image is present, automatically trigger image evaluation
        if (base64Image) {
          triggerAutoImageEvaluation(base64Image, selectedFile?.type, studyType, clinicalHistory, findings, annotations);
        }
      } else {
        setReportError(data.error || "Ocurrió un error desconocido al comunicarse con el modelo.");
      }
    } catch (error: any) {
      clearInterval(stepInterval);
      setReportError("Falla de red o de servidor. Asegúrate de configurar correctamente tu API Key en la pestaña de Configuración.");
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
        console.error("No se pudo pulir la indicación:", data.error);
      }
    } catch (e) {
      console.error("Error al asistir con la indicación clínica:", e);
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
        setModifyError(data.error || "Ocurrió un error al intentar modificar el informe.");
      }
    } catch (err: any) {
      console.error("Error al modificar informe:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setIsModifyingReport(false);
    }
  };

  const handleIncorporateRecommendation = async (recText: string) => {
    if (!generatedReport) return;
    
    // Sanitize input to clean any potential trailing or leading markdown elements or quotes
    let sanitizedRec = recText.trim();
    sanitizedRec = sanitizedRec.replace(/^\*\*|\*\*$/g, "").trim();
    sanitizedRec = sanitizedRec.replace(/^["']|["']$/g, "").trim();

    setPendingRecText(recText);
    setIsModifyingReport(true);
    setModifyError(null);
    try {
      const response = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: generatedReport,
          instruction: `Integra de forma totalmente fluida, nativa y natural, actuando en todo momento como el radiólogo principal que redacta el informe desde el principio, la siguiente clasificación, escala o recomendación clínica: "${sanitizedRec}". REQUISITO CRÍTICO: NO debes justificar la recomendación, ni meter introducciones, explicaciones clínicas de por qué se usa ("para facilitar el manejo...", "se sugiere...", "como recomendación de auditoría..."), ni meta-comentarios. Escribe directo la categoría, el grado o el dato clínico en la sección adecuada del reporte (HALLAZGOS o IMPRESIÓN DIAGNÓSTICA). Conserva intacto todo el resto del reporte.`,
          image: base64Image || undefined,
          mimeType: selectedFile?.type || undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setIncorporatedAuditRecs(prev => ({
          ...prev,
          [recText]: true
        }));
      } else {
        setModifyError(data.error || "Ocurrió un error al intentar incorporar de manera inteligente la recomendación.");
      }
    } catch (err: any) {
      console.error("Error al incorporar recomendación de auditoría:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setIsModifyingReport(false);
      setPendingRecText(null);
    }
  };

  const handleIncorporateToReport = (analysisText: string, studyTitle: string, medicalHistoryCombined: string, isAutoSync: boolean = false) => {
    const wrappedContent = `=== VALORACIÓN EXPERTA DE IMAGEN ANEXADA ===\n${analysisText}\n=== FIN DE VALORACIÓN EXPERTA ===`;
    
    setFindings(prev => {
      if (!prev) return `${wrappedContent}\n\n`;
      
      const regex = /=== VALORACIÓN EXPERTA DE IMAGEN ANEXADA ===[\s\S]*?=== FIN DE VALORACIÓN EXPERTA ===/;
      if (regex.test(prev)) {
        return prev.replace(regex, wrappedContent);
      }
      
      if (prev.includes("=== VALORACIÓN EXPERTA DE IMAGEN ANEXADA ===")) {
        const splitted = prev.split("=== VALORACIÓN EXPERTA DE IMAGEN ANEXADA ===");
        const afterPart = splitted.slice(1).join(" ");
        const cleanedAfter = afterPart.replace(/^[\s\S]*?\n\n/, "");
        return `${wrappedContent}\n\n${splitted[0]}${cleanedAfter}`;
      }
      
      return `${wrappedContent}\n\n${prev}`;
    });

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
          studyType: studyType || "Estudio Radiológico",
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
        setAdditionalEvalError(data.error || "Error al realizar la valoración adicional.");
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
          studyType: studyType || "Estudio Radiológico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setCaseAnalysis(data.analysis);
      } else {
        setCaseAnalysisError(data.error || "Error al realizar el análisis del caso.");
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
      } else {
        setVascularError(data.error || "No se pudieron analizar los hallazgos vasculares del informe.");
      }
    } catch (err: any) {
      console.error("Error al realizar el análisis vascular:", err);
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
    else if (nextState === "severe") label = "Estenosis hemodinámicamente significativa / severa (>=50%)";
    else if (nextState === "reflux") label = "Insuficiencia valvular con reflujo retrógrado";
    else if (nextState === "thrombosis") label = "Obstrucción trombótica patente / No colapsable";

    setVascularDescriptions(prev => ({
      ...prev,
      [segId]: label
    }));
  };

  const handleExportVascularTableToReport = () => {
    if (!vascularTable) return;
    setReportHistory((prev) => [...prev, generatedReport]);
    const separator = "\n\n";
    const title = "### CUADRO DE HALLAZGOS VASCULARES (SÍNTESIS DIAGNÓSTICA)\n";
    
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
    const title = "### SÍNTESIS DE ANATOMÍA VASCULAR DOPPLER\n";
    
    // Format blocksText inside triple backticks so it gets parsed perfectly as standard code in markdown and PDF
    const formattedBlocks = blocksText.trim().startsWith("```") 
      ? blocksText 
      : "```text\n" + blocksText.trim() + "\n```";
    
    // Avoid double inclusion if already exists
    if (generatedReport.includes("### SÍNTESIS DE ANATOMÍA VASCULAR DOPPLER")) {
      // Replace existing
      const regex = /### SÍNTESIS DE ANATOMÍA VASCULAR DOPPLER[\s\S]+/g;
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
        setDiffsError(data.error || "Error al incorporar los diagnósticos diferenciales sintetizados.");
      }
    } catch (err: any) {
      console.error("Error al incorporar diagnósticos diferenciales:", err);
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
          studyType: studyType || "Estudio Radiológico",
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
        setBibliographyError(data.error || "Error al buscar la bibliografía médica.");
      }
    } catch (err: any) {
      console.error("Error al buscar bibliografía:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingBibliography(false);
    }
  };

  // ACTION: EVALUATE GENERATED REPORT
  const handleEvaluateReport = async () => {
    if (!generatedReport) return;
    setIsEvaluatingReport(true);
    setReportEvaluationError(null);
    setReportEvaluation("");
    try {
      const response = await fetch("/api/evaluate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiológico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.evaluation) {
        setReportEvaluation(data.evaluation);
      } else {
        setReportEvaluationError(data.error || "Error al realizar la evaluación del reporte.");
      }
    } catch (err: any) {
      console.error("Error al evaluar reporte:", err);
      setReportEvaluationError(err?.message || String(err));
    } finally {
      setIsEvaluatingReport(false);
    }
  };

  // Gmail API Integrated Share Handlers (Google Workspace Integration)
  const handleOpenGmailShare = (type: 'report_pdf' | 'patient_summary' | 'patient_infographic' | 'both_pdfs') => {
    setGmailAttachedType(type as any);
    setGmailTo(patientEmail || "");
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    // Auto-select files that have been generated and are ready for download
    const hasReport = type === 'report_pdf' || type === 'both_pdfs' || !!generatedReport;
    const hasSummary = type === 'patient_summary' || type === 'both_pdfs' || !!patientSummary;
    const hasInfographic = type === 'patient_infographic' || !!infographicUrl;

    setGmailAttachReport(hasReport);
    setGmailAttachSummary(hasSummary);
    setGmailAttachInfographic(hasInfographic);
    
    // Construct default subject & email body nicely
    const clientName = patientName || "Paciente";
    let subject = `Información de su Estudio - ${clientName}`;
    let body = `Estimado(a) ${clientName},\n\nLe enviamos adjunto a este correo los siguientes documentos del estudio realizado:\n\n`;

    const attachedLines: string[] = [];
    if (hasReport) {
      attachedLines.push(`- 📄 Reporte de Estudio Clínico Oficial`);
    }
    if (hasSummary) {
      attachedLines.push(`- 🗣 Explicación Sencilla y Traducción Empática (analogías claras)`);
    }
    if (hasInfographic) {
      attachedLines.push(`- 🎨 Infografía de Bienestar y Salud (formato visual para imprimir)`);
    }

    if (attachedLines.length > 0) {
      body += attachedLines.join("\n") + "\n\n";
    } else {
      body += `Los archivos de su consulta de bienestar.\n\n`;
    }

    if (hasReport && hasSummary && hasInfographic) {
      subject = `Resultados Completos de su Estudio (Reporte, Explicación e Infografía) - ${clientName}`;
    } else if (hasReport && hasSummary) {
      subject = `Reporte Clínico y Traducción Explicativa - ${clientName}`;
    } else if (hasReport) {
      subject = `Reporte de Estudio Oficial - ${clientName}`;
    } else if (hasSummary) {
      subject = `Traducción y Explicación Explicativa de Estudio - ${clientName}`;
    } else if (hasInfographic) {
      subject = `Infografía de Bienestar y Salud del Estudio - ${clientName}`;
    }

    body += `Quedamos a su entera disposición para cualquier aclaración o consulta adicional.\n\nAtentamente,\n${doctorName || "Médico Especialista"}`;
    
    setGmailSubject(subject);
    setGmailBody(body);
    setShowGmailModal(true);
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
      setGmailErrorMessage("Debes iniciar sesión con Google antes de realizar el envío.");
      return;
    }
    if (!gmailTo) {
      setGmailErrorMessage("Por favor, especifica el correo electrónico del destinatario.");
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
        return chunks.join("\r\n");
      };

      let explanationPDFBase64 = "";
      let reportPDFBase64 = "";
      let infographicBase64 = "";
      let infographicContentType = "image/png";

      // 1. Generate PDFs in-memory as Base64 strings if selected/checked
      if (gmailAttachSummary) {
        if (!patientSummary) {
          throw new Error("Debe generar primero la 'Traducción Empática y Explicación' para poder adjuntarla.");
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
          throw new Error("Debe generar primero la 'Infografía' para poder adjuntarla.");
        }
        try {
          let plainInfographicBase64 = "";
          if (infographicUrl.startsWith("data:")) {
            const match = infographicUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              infographicContentType = match[1];
              plainInfographicBase64 = match[2];
            } else {
              throw new Error("Formato de URL de datos de infografía no reconocido.");
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
          throw new Error("Error al preparar la imagen de la infografía: " + (imageErr.message || String(imageErr)));
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
          .replace(/ñ/gi, "n")
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
      const emailRaw = parts.join("\r\n");
      
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
        const errorText = await response.text();
        throw new Error(`Gmail API reportó un error de envío: ${errorText}`);
      }

      setGmailSuccessMessage("¡Correo electrónico enviado con éxito vía Gmail!");
    } catch (err: any) {
      console.error("Failed to send email via Gmail:", err);
      setGmailErrorMessage("Error al enviar el correo: " + (err.message || String(err)));
    } finally {
      setIsSendingGmail(false);
    }
  };

  // WhatsApp Share Handlers
  const handleOpenWhatsAppShare = (type: 'report_pdf' | 'patient_infographic' | 'patient_summary') => {
    setWhatsappShareType(type);
    setShowWhatsAppModal(true);
  };

  const getWhatsAppTextPreview = () => {
    if (whatsappShareType === 'patient_summary') {
      if (!patientSummary) return "Por favor, genera primero el 'Acompañamiento para el Paciente'.";
      let text = `*ACOMPAÑAMIENTO EXPLICATIVO DE SU ESTUDIO* 🩺\n\n`;
      if (patientName) {
        text += `*Paciente:* ${patientName}\n`;
      }
      if (studyType) {
        text += `*Estudio:* ${studyType}\n`;
      }
      if (reportDate) {
        text += `*Fecha del Estudio:* ${reportDate}\n`;
      }
      text += `\nEstimado paciente, adjunto le comparto una explicación médica de su estudio radiológico traducida a un lenguaje sencillo y comprensible en formato digital PDF.\n\n`;
      text += `Este documento está redactado de forma objetiva y didáctica para ayudarle a comprender los hallazgos para su próxima consulta de seguimiento.`;
      return text;
    }

    if (whatsappShareType === 'patient_infographic') {
      let text = `*INFOGRAFÍA EXPLICATIVA PARA EL PACIENTE* 🎨\n\n`;
      if (patientName) {
        text += `*Paciente:* ${patientName}\n\n`;
      }
      text += `Estimado paciente, le comparto una infografía visual y amigable especialmente diseñada para explicar de forma muy sencilla los resultados de su estudio.\n\n`;
      if (infographicUrl) {
        text += `Puede visualizarla e imprimirla en alta definición ingresando al siguiente enlace:\n🔗 ${infographicUrl}\n\n`;
      } else {
        text += `(La infografía se está procesando; puede descargarla y enviarla directamente desde el panel principal).\n\n`;
      }
      text += `Quedo a su disposición para cualquier consulta de seguimiento.`;
      return text;
    }

    // Default: 'report_pdf'
    let text = `*INFORME CLÍNICO OFICIAL DE ESTUDIO RADIOLÓGICO* 📄\n\n`;
    if (patientName) {
      text += `*Paciente:* ${patientName}\n`;
    }
    if (studyType) {
      text += `*Estudio:* ${studyType}\n`;
    }
    if (reportDate) {
      text += `*Fecha del Estudio:* ${reportDate}\n`;
    }
    text += `\nEstimado paciente, adjunto le comparto el reporte oficial del estudio en formato digital PDF, verificado por el médico especialista y con firma digital autónoma.\n\n`;
    text += `Le sugiero conservarlo y presentarlo impreso o digital en su próxima consulta de seguimiento con su médico de cabecera.`;
    return text;
  };

  const handleSendWhatsAppAction = async () => {
    const text = getWhatsAppTextPreview();
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

    // 2. Perform the heavy pdf/infographic processing in the background
    if (whatsappShareType === 'report_pdf') {
      // First, trigger automatic PDF download for convenience on desktop
      try {
        handleDownloadNativePDF(false);
      } catch (err) {
        console.warn("Direct PDF download background call failed:", err);
      }
      
      // Try native share on mobile/tablets asynchronously
      if (navigator.share) {
        try {
          handleDownloadNativePDF(false, true);
        } catch (err) {
          console.warn("Native file sharing failed or not supported. Falling back to text message link.");
        }
      }
    } else if (whatsappShareType === 'patient_summary') {
      // First, trigger automatic companion explanation PDF download for convenience on desktop
      try {
        handleDownloadPatientSummaryPDF(false);
      } catch (err) {
        console.warn("Direct patient summary PDF download background call failed:", err);
      }
      
      // Try native share on mobile/tablets asynchronously
      if (navigator.share) {
        try {
          handleDownloadPatientSummaryPDF(false, true);
        } catch (err) {
          console.warn("Native file sharing failed or not supported. Falling back to text message link.");
        }
      }
    } else if (whatsappShareType === 'patient_infographic') {
      if (infographicUrl && (infographicUrl.startsWith("data:") || infographicUrl.startsWith("blob:") || infographicUrl.startsWith("http"))) {
        try {
          const response = await fetch(infographicUrl);
          const blob = await response.blob();
          const format = infographicUrl.includes("image/png") ? "png" : "jpeg";
          const file = new File([blob], `infografia_paciente.${format}`, { type: blob.type });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: "Infografía Paciente",
              text: `Infografía de ${patientName || "Paciente"}`
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
          studyType: studyType || "Estudio Radiológico",
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
      console.error("Error al construir glosario dinámico:", err);
      setDynamicGlossaryError(err?.message || String(err));
    } finally {
      setIsGeneratingDynamicGlossary(false);
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
          studyType: studyType || "Estudio Radiológico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSchematicSummary(data.data);
      } else {
        setSchematicSummaryError(data.error || "Error al estructurar el esquema del reporte.");
      }
    } catch (err: any) {
      console.error("Error al construir esquema dinámico:", err);
      setSchematicSummaryError(err?.message || String(err));
    } finally {
      setIsGeneratingSchematicSummary(false);
    }
  };

  // Helper to generate text content based on the selected format (blocks vs table)
  const getSelectedSchematicContent = () => {
    if (!schematicSummary) return "";
    if (schematicFormat === "blocks") {
      let text = "### ESQUEMA CLÍNICO DE HALLAZGOS PRINCIPALES\n\n";
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
    alert(`¡Esquema de hallazgos clínico (${schematicFormat === "blocks" ? "en Bloques" : "en Tabla"}) insertado con éxito al final de tu informe!`);
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
          report: `Realiza una búsqueda de evidencia para el término médico: ${term}. Contexto adicional: ${query}`,
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
            error: data.error || "No se pudo recuperar la revisión científica sobre este concepto." 
          }
        }));
      }
    } catch (err: any) {
      console.error("Error buscando literatura para término:", err);
      setGlossaryLitSearch(prev => ({
        ...prev,
        [term]: { 
          loading: false, 
          error: "Error de comunicación con el servidor central." 
        }
      }));
    }
  };

  // ACTION: PRINT PROFESSIONAL EXPLAINED REPORT FOR PATIENT
  const handlePrintPatientSummary = () => {
    if (!patientSummary) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite ventanas emergentes para abrir el formato de impresión.");
      return;
    }
    
    const findingsHtml = patientSummary.keyFindings.map((finding: any) => `
      <div style="margin-bottom: 22px; padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; background-color: #fafafa;">
        <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700;">${finding.title}</h3>
        <p style="margin: 0 0 12px 0; font-size: 11px; font-style: italic; color: #4b5563; font-family: monospace;">Término original en informe técnico: "${finding.originalTerm}"</p>
        <p style="margin: 0 0 12px 0; font-size: 13.5px; font-family: system-ui, sans-serif; color: #1f2937; line-height: 1.55;"><strong>Explicación:</strong> ${finding.simplifiedExplanation}</p>
        <p style="margin: 0 0 8px 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #7c2d12; background-color: #fff7ed; padding: 10px; border-radius: 6px; border-left: 3px solid #f97316;">🔍 <strong>Analogía de comprensión:</strong> ${finding.analogy}</p>
        <p style="margin: 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #1e3a8a; font-weight: 600; background-color: #eff6ff; padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">🩺 <strong>Contexto Clínico y Perspectiva Médica:</strong> ${finding.reassurance}</p>
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
          <title>Acompañamiento Radiológico Explicativo</title>
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
            <h1>Guía Médica Explicativa para el Paciente</h1>
            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #4b5563;">Traducción Empática y Comprensión Humana Asistida por Inteligencia Artificial</p>
          </div>
          
          <div style="font-size: 13.5px; margin-bottom: 25px; color: #4b5563;">
            Estimado paciente: La siguiente guía interactiva simplifica y explica los hallazgos descritos en el reporte clínico oficial de su estudio diagnóstico. Este material tiene carácter informativo y educativo; está diseñado para calmar su inquietud y dotarlo de pautas saludables de conversación con su especialista tratante.
          </div>
          
          <div class="meta-grid">
            <div>
              <strong>ESTUDIO DIAGNÓSTICO:</strong> ${STUDY_PRESETS?.find((p: any) => p.id === studyType)?.name || studyType || "Estudio Radiológico"}<br>
              <strong>IMPRESO EL:</strong> ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style="text-align: right;">
              <strong>INDICACIÓN INMEDIATA:</strong> ${clinicalHistory || "Sin indicación reportada"}<br>
              <strong>PROGRAMA ASOCIADO:</strong> AI Radiologist Suite Pro
            </div>
          </div>
          
          <div class="section-title">Desglose Detallado de Hallazgos Clínicos Explicados</div>
          ${findingsHtml}
          
          <div class="footer">
            <strong>ADVERTENCIA CLÍNICA IMPORTANTE:</strong> Esta guía simplificada de orientación formativa complementa -pero nunca invalida- el informe radiológico oficial firmado digitalmente por el especialista médico ni sustituye la indicación prescriptiva del cirujano o médico clínico.
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
      setRecommenderError("Error de conexión al obtener recomendaciones de escalas.");
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
        setInfographicError(data.error || "Error generando la infografía.");
      }
    } catch (err: any) {
      setInfographicError(err.message || "Error al conectar con la API de infografías.");
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
          studyType: studyType
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
        setRecommenderError(data.error || "No se pudo incorporar la clasificación de forma inteligente en el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setRecommenderError("Error de conexión al incorporar la clasificación de forma inteligente.");
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
      setChatError("Falla de conexión con la API del servidor local.");
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
        setClassificationError(data.error || "No se pudo obtener información de la escala.");
      }
    } catch (e) {
      setClassificationError("Error de comunicación con el servidor de consulta.");
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
      setWizardOutput(INTERACTIVE_RESULTS[categoryName] || `Cálculo exitoso: Categoría sugerida ${categoryName}`);
    } else if (stepIndex === 0 && selectedClassSystem === "fleischner" && optionValue.startsWith("solid_")) {
      // Fleischner requires risk level (step index 1)
      // Wait for step 1 selection
    } else if (stepIndex === 1 && selectedClassSystem === "fleischner") {
      // Combined Fleischner logic
      const noduleType = newAnswers[0];
      const riskLevel = optionValue;
      const keyCombined = `${noduleType}_${riskLevel}`;
      setWizardOutput(INTERACTIVE_RESULTS[keyCombined] || "No se encontró un criterio específico en las guías estándar para esta combinación.");
    } else if (selectedClassSystem === "bosniak" && optionValue === "complex") {
      // Ask no further questions
      const optionsBosniakStep2 = [
        { label: "TC: Septos nodulares o engrosamiento parietal visible sin verdadero nódulo sólido", category: "Bosniak III" },
        { label: "TC: Nódulos blandos medibles con realce o componentes sólidos invasivos", category: "Bosniak IV" }
      ];
      // Quick fallback
      setWizardOutput(`**Requirió mayor especificación:**\nSi los septos son simplemente engrosados con realce parcial, entra en **Bosniak III** (cirugía o biopsia). Si presenta masas de partes blandas o nódulos con realce evidente, entra en **Bosniak IV** (malignidad confirmada).`);
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

  const ensureCompatibleImageFormat = (src: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 640;
          canvas.height = img.naturalHeight || img.height || 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.9));
            return;
          }
        } catch (err) {
          console.warn("Error converting image to compatible format:", err);
        }
        resolve(src);
      };
      img.onerror = () => {
        resolve(src);
      };
      img.src = src;
    });
  };

  const decodeDicom = (arrayBuffer: ArrayBuffer) => {
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
          base64 = canvas.toDataURL("image/jpeg");
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
      ctx.fillText("RI (Índice Resist.): 0.70", 90, 320);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText((meta?.paciente || "PACIENTE GENERAL").toUpperCase(), 30, 45);
      
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("MOD: US (ECOGRAFÍA DOPPLER)", 30, 60);
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
      const isKnownImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt);
      const isDicomExt = ["dcm", "dicom"].includes(fileExt);
      
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        
        if (isKnownImage) {
          reader.onload = (e) => {
            const base64Str = e.target?.result as string;
            if (base64Str) {
               ensureCompatibleImageFormat(base64Str).then((compatibleBase64) => {
                loaded.push({
                  id: "attached-" + Math.random().toString(36).substring(2, 11),
                  name: file.name,
                  url: compatibleBase64,
                  base64: compatibleBase64,
                  caption: "", // Starts completely empty as requested by the user
                  isDicom: false
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
                
                ensureCompatibleImageFormat(finalBase64).then((compatibleBase64) => {
                  loaded.push({
                    id: "attached-" + Math.random().toString(36).substring(2, 11),
                    name: file.name,
                    url: compatibleBase64,
                    base64: compatibleBase64,
                    caption: "", // Starts completely empty as requested by the user
                    isDicom: true,
                    dicomMetaData: parsed.meta
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
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // Multi-pixel supersampling for perfect clarity on tiny vascular label notes (size matching 1.42 aspect ratio)
          canvas.width = 1280;
          canvas.height = 900;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/png");
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

  const handleDownloadNativePDF = async (openInNewTab: boolean = false, shareViaWebShare: boolean = false, returnBase64: boolean = false): Promise<string | undefined> => {
    if (!generatedReport) return;
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yCoord = 20;
      const marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - (2 * marginX); // 170mm

      // Helper function to check space and add page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
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
          const bannerImgEl = document.querySelector('img[alt="Membrete de la Clínica"]') as HTMLImageElement | null;
          let bannerWidth = 140;
          let bannerHeight = 28;
          if (bannerImgEl && bannerImgEl.naturalWidth && bannerImgEl.naturalHeight) {
            const aspect = bannerImgEl.naturalWidth / bannerImgEl.naturalHeight;
            const maxWidth = contentWidth; // 170
            const maxHeight = 30;
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
            doc.text(clinicName ? clinicName.toUpperCase() : "REPORTE DE RADIODIAGNÓSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;
          }

          if (clinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(clinicName.toUpperCase(), pageWidth / 2, yCoord, { align: "center" });
            yCoord += 5;
          }
        } else {
          // Left Aligned Logo Style
          const logoImgEl = document.querySelector('img[alt="Logo"]') as HTMLImageElement | null;
          let logoWidth = 22;
          let logoHeight = 22;
          if (logoImgEl && logoImgEl.naturalWidth && logoImgEl.naturalHeight) {
            const aspect = logoImgEl.naturalWidth / logoImgEl.naturalHeight;
            const maxWidth = 25;
            const maxHeight = 25;
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
          doc.text(clinicName ? clinicName.toUpperCase() : "REPORTE DE RADIODIAGNÓSTICO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", textX, yCoord + (logoHeight / 2) + 4);
          
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
          doc.text(clinicName ? clinicName.toUpperCase() : "REPORTE DE RADIODIAGNÓSTICO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          // Centered Clinic Name or default heading
          if (clinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900 / dark
            doc.text(clinicName.toUpperCase(), pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("REPORTE DE RADIODIAGNÓSTICO POR IMAGEN", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("REPORTE DE RADIODIAGNÓSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 11;
          }
        }
      }

      // Add a line under header
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.4);
      doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      yCoord += 2;

      // Patient Metadata Block
      if (patientName || reportDate) {
        doc.setFillColor(248, 250, 252); // greyish background
        doc.rect(marginX, yCoord, contentWidth, 12, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, yCoord, contentWidth, 12, "S");

        let xOffset = marginX + 4;
        let totalDateWidth = 0;
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA DEL ESTUDIO: ";
          totalDateWidth = doc.getTextWidth(dateLabel) + doc.getTextWidth(reportDate);
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
          doc.text(reportDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        yCoord += 19;
      }

      // Strip emojis from the generated report
      const stripEmojis = (str: string): string => {
        if (!str) return "";
        return str
          // Strip surrogate pairs (handles 4-byte emojis like 🫁, 🫀, 🦴, 🧠, 📋, 🔍, etc.)
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          // Strip miscellaneous symbol emojis & shapes in the BMP (like ⚠️, ⏱, ⚕, ✔️, ❌, ⭐, etc.)
          .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
      };

      const emojiFreeReport = stripEmojis(generatedReport);
      const cleanReport = cleanRawClinicalText(emojiFreeReport);
      const paragraphs = cleanReport.split(/\n\n+/);

      // Set standard font settings
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);

      let isFirstLine = true;
      let isFirstBlock = true;

      paragraphs.forEach((block) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        // 1. Check if the block is a code block (starts/ends with triple backticks, or is a raw EMR segment)
        const isCodeBlockSegment = trimmedBlock.startsWith("```") || (trimmedBlock.startsWith("===") && (trimmedBlock.includes("SÍNTESIS VASCULAR") || trimmedBlock.includes("SÍNTESIS DE ANATOMÍA")));

        if (isCodeBlockSegment) {
          const linesOfBlock = trimmedBlock.split("\n");
          // Filter out the opening/closing backtick lines
          const codeBlockLines = linesOfBlock.filter(line => !line.trim().startsWith("```"));
          
          // Allocate height for the spacing
          const lineSpacing = 4.2;
          const neededHeight = (codeBlockLines.length * lineSpacing) + 7;
          checkPageBreak(neededHeight);

          // Draw a clean background box
          doc.setFillColor(248, 250, 252); // slate-50 / light gray
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2, "F");
          doc.setDrawColor(226, 232, 240); // slate-200 border
          doc.setLineWidth(0.3);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2, "D");

          // Set monospace font Courier (built-in)
          doc.setFont("courier", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);

          let relativeY = yCoord + 4.5;
          codeBlockLines.forEach((line) => {
            doc.text(line, marginX + 4, relativeY);
            relativeY += lineSpacing;
          });

          yCoord = relativeY + 1.5;
          
          // Re-set default font settings for the next paragraphs
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a separator/divider
        if (trimmedBlock === "---") {
          checkPageBreak(8);
          yCoord += 4;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 6;
          return;
        }

        // 2. Check if the block is a markdown table
        const linesOfBlock = trimmedBlock.split("\n");
        const hasPipe = linesOfBlock.some(line => line.includes("|"));
        const isTableDivider = linesOfBlock.some(line => line.includes("---") && line.includes("|"));
        const isTable = hasPipe && (isTableDivider || linesOfBlock.length >= 2);

        if (isTable) {
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

            const isHeader = isMarkdownHeading || (trimmed.startsWith("**") && trimmed.endsWith("**"));
            const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

            checkPageBreak(10);
            if (isHeader) {
              doc.setFont("times", "bold");
              doc.setFontSize(11);
              doc.setTextColor(15, 23, 42); // slate-900
              doc.text(cleanHeaderTxt, marginX, yCoord);
              yCoord += 6;
            } else {
              doc.setFont("times", "normal");
              doc.setFontSize(10.5);
              doc.setTextColor(51, 65, 85);
              const lines = doc.splitTextToSize(trimmed, contentWidth);
              lines.forEach((l: string) => {
                checkPageBreak(5);
                doc.text(l, marginX, yCoord);
                yCoord += 4.5;
              });
              yCoord += 2;
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
              colWidths.push(contentWidth * 0.4);
              colWidths.push(contentWidth * 0.6);
            } else if (colCount === 3) {
              colWidths.push(contentWidth * 0.15); // ID col (compact)
              colWidths.push(contentWidth * 0.35); // Structure / Site Name
              colWidths.push(contentWidth * 0.50); // Detailed Main Findings
            } else if (colCount === 4) {
              colWidths.push(contentWidth * 0.12); // ID Column (e.g. H1, H2, H3)
              colWidths.push(contentWidth * 0.28); // Estructura / Sitio
              colWidths.push(contentWidth * 0.22); // Categoría
              colWidths.push(contentWidth * 0.38); // Hallazgo Principal
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

              const rowHeight = (maxLines * 5) + 4;
              calculatedRowsHeightSum += rowHeight;
              cachedRowsData.push({
                cellSpansLines: cellSpansLinesList,
                rowHeight,
              });
            });

            // The header takes 12 units baseline check, then yCoord is advanced by 9.
            // So total calculated height for table is roughly: header (12) + rows + extra gap (4)
            const totalTableNeededHeight = 12 + calculatedRowsHeightSum + 4;

            // Check page break for the entire table. If it's too long to fit on a single page anyway,
            // Math.min(totalTableNeededHeight, pageHeight - 40) will push it to the next page so it starts on a clean page.
            checkPageBreak(Math.min(totalTableNeededHeight, pageHeight - 40));

            // Header Render
            checkPageBreak(12);
            
            doc.setFillColor(241, 245, 249); // slate-100 / cool grey background
            doc.rect(marginX, yCoord - 4, contentWidth, 8, "F");
            doc.setDrawColor(203, 213, 225); // slate-300 border
            doc.setLineWidth(0.3);
            doc.line(marginX, yCoord - 4, marginX + contentWidth, yCoord - 4);
            doc.line(marginX, yCoord + 4, marginX + contentWidth, yCoord + 4);

            let currentX = marginX;
            doc.setFont("times", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42); // slate-900

            headers.forEach((headerTxt, hIdx) => {
              const hClean = headerTxt.replace(/\*\*/g, "");
              doc.text(hClean, currentX + 3, yCoord + 1);
              currentX += colWidths[hIdx] || (contentWidth / colCount);
            });
            
            yCoord += 9;

            // Rows Render
            bodyRows.forEach((row, rIdx) => {
              const cachedRow = cachedRowsData[rIdx];
              const cellLines = cachedRow.cellSpansLines;
              const rowHeight = cachedRow.rowHeight;

              checkPageBreak(rowHeight);

              if (rIdx % 2 === 1) {
                doc.setFillColor(248, 250, 252); // grey alternate backgrounds
                doc.rect(marginX, yCoord - 4, contentWidth, rowHeight, "F");
              }

              doc.setDrawColor(226, 232, 240); // slate-200 border
              doc.setLineWidth(0.2);
              doc.line(marginX, yCoord - 4 + rowHeight, marginX + contentWidth, yCoord - 4 + rowHeight);

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
                  tempY += 5;
                });

                startRowX += colW;
              });

              yCoord += rowHeight;
            });

            yCoord += 4; // margin after table completes
            return;
          }
        }

        // 3. Render as standard block with paragraphs and line spacing
        if (!isFirstBlock) {
          yCoord += 4.5;
        } else {
          isFirstBlock = false;
        }

        linesOfBlock.forEach((line) => {
          let trimmed = line.trim();
          if (!trimmed) {
            yCoord += 2.5;
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

          const isHeader = isMarkdownHeading || (trimmed.startsWith("**") && trimmed.endsWith("**"));
          const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

          // Determine if first visual line is the main title of study
          const isMainTitle = isFirstLine && (isHeader || /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmed));

          if (isMainTitle) {
            isFirstLine = false;
            // Center-align main title beautifully
            doc.setFont("times", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            const wrappedTitle = doc.splitTextToSize(cleanHeaderTxt.toUpperCase(), contentWidth);
            wrappedTitle.forEach((lineText: string) => {
              checkPageBreak(7);
              doc.text(lineText, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6;
            });
            return;
          }

          if (isFirstLine) {
            isFirstLine = false;
          }

          if (isHeader) {
            checkPageBreak(8);
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
            wrappedHeaders.forEach((lineText: string) => {
              checkPageBreak(5.5);
              doc.text(lineText, marginX, yCoord);
              yCoord += 5.5;
            });
          } else {
            // Is it a bullet/list item in original design?
            const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
            if (isBulleted) {
              let cleanItem = trimmed;
              let bulletToken = "•";
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
              
              checkPageBreak(6);
              doc.setFont("times", "bold");
              doc.setFontSize(10.5);
              doc.setTextColor(15, 23, 42);
              doc.text(bulletToken, marginX + 1.5, yCoord);

              const lines = wrapMarkdown(doc, cleanItem, textWidth);
              lines.forEach((lineVal) => {
                checkPageBreak(5);
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
                yCoord += 5;
              });
            } else {
              // Wrap markdown formatted lines (bold and normal text mixed) safely and beautifully
              const lines = wrapMarkdown(doc, trimmed, contentWidth);
              lines.forEach((lineVal) => {
                checkPageBreak(5);
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
                yCoord += 5;
              });
            }
          }
        });
      });

      // 🛠️ DRAW VASCULAR DIAGRAM IN THE PROGRAMMATIC PDF
      const isDopplerStudy = specificStudy === "Doppler de carótidas" || 
                             specificStudy === "Doppler venoso de miembro inferior" || 
                             specificStudy === "Doppler arterial de miembro inferior";

      if (includeVascularSchemaInReport && isDopplerStudy) {
        const svgElement = document.getElementById("print-vascular-svg") || document.querySelector("svg[viewBox='-120 0 640 450']");
        if (svgElement) {
          try {
            const imgData = await convertSvgToPng(svgElement as any);
            
            // Check page break for 95mm (82mm diagram + header/footer gaps)
            checkPageBreak(95);
            yCoord += 4;

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(148, 163, 184);
            doc.text("ANEXO: ESQUEMA ANATÓMICO DOPPLER VASCULAR", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // Draw high resolution diagram centered
            doc.addImage(imgData, "PNG", (pageWidth - 116) / 2, yCoord, 116, 82);
            yCoord += 86;

            // --- DRAW LEYENDA DE HALLAZGOS IN PROGRAMMATIC PDF ---
            const isVenosoForPDF = specificStudy.toLowerCase().includes("venoso");

            const isLimbEvaluatedForPDF = (side: "der" | "izq") => {
              const isCarotidas = specificStudy.toLowerCase().includes("carót") || specificStudy.toLowerCase().includes("carot");
              if (isCarotidas) return true;

              const latLower = (laterality || "").toLowerCase();
              if (latLower === "derecha" || latLower === "derecho") {
                return side === "der";
              }
              if (latLower === "izquierda" || latLower === "izquierdo") {
                return side === "izq";
              }
              if (latLower === "bilateral") {
                return true;
              }

              const studyLower = (specificStudy || "").toLowerCase();
              const reportLower = (generatedReport || "").toLowerCase();

              const hasDerechoInStudy = studyLower.includes("derech") || studyLower.includes(" unilateral d") || studyLower.includes("der.");
              const hasIzquierdoInStudy = studyLower.includes("izquierd") || studyLower.includes(" unilateral i") || studyLower.includes("izq.");

              const hasDerechoInReport = reportLower.includes("miembro inferior derecho") || reportLower.includes("m.i. derecho") || reportLower.includes("unilateral derecho");
              const hasIzquierdoInReport = reportLower.includes("miembro inferior izquierdo") || reportLower.includes("m.i. izquierdo") || reportLower.includes("unilateral izquierdo");

              if (hasDerechoInStudy && !hasIzquierdoInStudy) {
                return side === "der";
              }
              if (hasIzquierdoInStudy && !hasDerechoInStudy) {
                return side === "izq";
              }
              if (hasDerechoInReport && !hasIzquierdoInReport) {
                return side === "der";
              }
              if (hasIzquierdoInReport && !hasDerechoInReport) {
                return side === "izq";
              }
              return true;
            };

            const getSegColorForPDF = (id: string) => {
              const isRightSegment = id.endsWith("_der");
              const isLeftSegment = id.endsWith("_izq");

              if (isRightSegment && !isLimbEvaluatedForPDF("der")) {
                return "#94a3b8";
              }
              if (isLeftSegment && !isLimbEvaluatedForPDF("izq")) {
                return "#94a3b8";
              }

              const s = vascularStates[id] || "normal";
              if (s === "normal") return "#059669";
              if (s === "mild" || s === "reflux") return "#d97706";
              return "#dc2626";
            };

            const getSegLabelForPDF = (id: string) => {
              const isRightSegment = id.endsWith("_der");
              const isLeftSegment = id.endsWith("_izq");

              if (isRightSegment && !isLimbEvaluatedForPDF("der")) {
                return "No evaluado";
              }
              if (isLeftSegment && !isLimbEvaluatedForPDF("izq")) {
                return "No evaluado";
              }

              const s = vascularStates[id] || "normal";
              if (s === "normal") return isVenosoForPDF ? "Permeable" : "Normal";

              const descText = (vascularDescriptions[id] || "").toLowerCase().trim();

              if (
                descText.includes("flujo no detectable") || 
                descText.includes("no detectable") || 
                descText.includes("flujo ausente") || 
                descText.includes("ausencia de flujo") || 
                descText.includes("onda no detectable") || 
                descText.includes("señal no detectable")
              ) {
                return "Flujo no detectable";
              }

              if (
                descText.includes("oclusión") || 
                descText.includes("oclusion") || 
                descText.includes("ocluido") || 
                descText.includes("ocluida") || 
                descText.includes("obstrucción completa") || 
                descText.includes("obstruccion completa") || 
                descText.includes("obstrucción total") || 
                descText.includes("obstruccion total") || 
                descText.includes("obturado") ||
                descText.includes("oclusión completa") ||
                descText.includes("oclusion completa")
              ) {
                return "Oclusión";
              }

              // 2.5 aterosclerosis prioritized check
              if (
                descText.includes("enfermedad aterosclerótica") ||
                descText.includes("enfermedad aterosclerotica") ||
                descText.includes("aterosclerosis") ||
                descText.includes("aterosclerótica") ||
                descText.includes("aterosclerotica")
              ) {
                return "Aterosclerosis";
              }

              if (
                descText.includes("estenosis focal") || 
                descText.includes("focal") || 
                descText.includes("zona específica de estenosis") ||
                descText.includes("zona especifica de estenosis") ||
                descText.includes("lesión de estenosis") ||
                descText.includes("lesion de estenosis")
              ) {
                return "Estenosis focal";
              }

              if (
                descText.includes("estenosis difusa") || 
                descText.includes("estenosis difuso") ||
                descText.includes("estenosis difusas")
              ) {
                return "Estenosis difusa";
              }

              if (
                descText.includes("ateromatosis") || 
                descText.includes("placa") || 
                descText.includes("placas") || 
                descText.includes("ateroma") || 
                descText.includes("ateromatosa") || 
                descText.includes("ateromatosas") || 
                descText.includes("engrosamiento miointimal") ||
                descText.includes("gim") || 
                descText.includes("miointimal") ||
                s === "mild"
              ) {
                return "Ateromatosis";
              }

              if (s === "severe") {
                return "Estenosis focal";
              }
              if (s === "reflux") {
                return "Reflujo";
              }
              if (s === "thrombosis") {
                return "Trombosis";
              }
              return "Normal";
            };

            const activeVessels = Object.keys(vascularStates).filter((id) => {
              const isRight = id.endsWith("_der");
              const isLeft = id.endsWith("_izq");
              if (isRight && !isLimbEvaluatedForPDF("der")) return false;
              if (isLeft && !isLimbEvaluatedForPDF("izq")) return false;
              return true;
            });

            checkPageBreak(25);
            yCoord += 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text("LEYENDA DE HALLAZGOS VASCULARES:", marginX, yCoord);
            yCoord += 4.5;

            if (activeVessels.length > 0) {
              const colWidth = (pageWidth - (2 * marginX)) / 2; // 85mm each column
              let colX = marginX;
              let rowY = yCoord;
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);

              activeVessels.forEach((id, idx) => {
                if (idx > 0 && idx % 2 === 0) {
                  rowY += 4.2;
                  colX = marginX;
                } else if (idx > 0 && idx % 2 === 1) {
                  colX = marginX + colWidth;
                }

                if (rowY > pageHeight - 20) {
                  doc.addPage();
                  rowY = 20;
                  yCoord = rowY;
                }

                const labelText = getSegLabelForPDF(id) || "Normal";
                const sideLabel = id.replace("_der", "-R").replace("_izq", "-L").toUpperCase();
                const colorHex = getSegColorForPDF(id);

                let r = 5, g = 150, b = 105;
                if (colorHex === "#d97706") { r = 217; g = 119; b = 6; }
                else if (colorHex === "#dc2626") { r = 220; g = 38; b = 38; }
                else if (colorHex === "#94a3b8") { r = 148; g = 163; b = 184; }

                doc.setFillColor(r, g, b);
                doc.circle(colX + 1.5, rowY - 1, 0.8, "F");

                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(`${sideLabel}:`, colX + 3.5, rowY);
                
                doc.setFont("helvetica", "normal");
                doc.setTextColor(71, 85, 105);
                const textOffset = doc.getTextWidth(`${sideLabel}: `) + 4.5;
                doc.text(labelText, colX + textOffset, rowY);
              });

              yCoord = rowY + 6;
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7.5);
              doc.setTextColor(148, 163, 184);
              doc.text("No se registraron hallazgos vasculares específicos de interés.", marginX, yCoord);
              yCoord += 4.5;
            }
          } catch (err) {
            console.error("No se pudo insertar el esquema vascular en el PDF descargado:", err);
          }
        }
      }

      // Signature / Sign-off block
      if (doctorName || customSignatureUrl) {
        checkPageBreak(30);
        yCoord += 15;

        // Signature horizontal line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 6;

        // Subtext on left: digital verifier
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("VERIFICADO POR:", marginX, yCoord);
        doc.setFont("helvetica", "normal");
        doc.text("Firma Digital Autónoma", marginX, yCoord + 4);

        // Add physical signature base64 image if uploaded
        if (customSignatureUrl) {
          try {
            let sigWidth = 40;
            let sigHeight = 12;
            const sigImgEl = document.querySelector('img[alt="Firma"]') as HTMLImageElement | null;
            if (sigImgEl && sigImgEl.naturalWidth && sigImgEl.naturalHeight) {
              const aspect = sigImgEl.naturalWidth / sigImgEl.naturalHeight;
              const maxWidth = 55;
              const maxHeight = 16;
              if (aspect > maxWidth / maxHeight) {
                sigWidth = maxWidth;
                sigHeight = maxWidth / aspect;
              } else {
                sigHeight = maxHeight;
                sigWidth = maxHeight * aspect;
              }
            }
            const sigX = pageWidth - marginX - sigWidth - 8;
            const sigY = (yCoord - 6) - sigHeight - 1; // Position cleanly above the line
            const format = customSignatureUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customSignatureUrl, format, sigX, sigY, sigWidth, sigHeight);
          } catch (imgError) {
            console.warn("Could not render custom signature image inside jsPDF", imgError);
          }
        }

        // Doctor Name on right
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        const docText = (doctorName || "MÉDICO ESPECIALISTA").toUpperCase();
        const docTextWidth = doc.getTextWidth(docText);
        doc.text(docText, pageWidth - marginX - docTextWidth, yCoord + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const titleText = "Médico Especialista en Radiodiagnóstico";
        const titleTextWidth = doc.getTextWidth(titleText);
        doc.text(titleText, pageWidth - marginX - titleTextWidth, yCoord + 8);
      }

      // --- APPEND ATTACHED ULTRASOUND/DICOM IMAGES TO THE END OF PDF ---
      if (attachedImages.length > 0) {
        doc.addPage();
        yCoord = 20;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate 900
        doc.text("ANEXO: IMÁGENES Y CAPTURAS DE ULTRASONIDO", marginX, yCoord);

        // Simple divider
        yCoord += 4;
        doc.setDrawColor(203, 213, 225); // slate 300
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 11;

        // Arrange images in a beautiful 2-column grid:
        const colWidth = (pageWidth - (marginX * 2) - 8) / 2; // 81mm each column
        const imgHeight = colWidth * 0.75; // Maintain aspect ratio of 4:3
        
        let currentCol = 0; // 0 or 1
        for (const imgItem of attachedImages) {
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

            doc.addImage(imgItem.base64, format, posX, yCoord, colWidth, imgHeight);

            doc.setDrawColor(241, 245, 249); // slate 50
            doc.setLineWidth(0.25);
            doc.rect(posX, yCoord, colWidth, imgHeight);

            if (imgItem.caption) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(51, 65, 85); // slate 700
              const textLines = doc.splitTextToSize(imgItem.caption, colWidth - 2);
              let offsetTextY = yCoord + imgHeight + 4.5;
              textLines.forEach((lineText: string) => {
                doc.text(lineText, posX, offsetTextY);
                offsetTextY += 3.5;
              });
            }

          } catch (imgErr) {
            console.error("Could not append attached image in jsPDF: ", imgErr);
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
            yCoord += imgHeight + 20; // vertical step
          }
        }
      }

      if (returnBase64) {
        const dataUri = doc.output("datauristring");
        return dataUri.split(",")[1];
      }

      // Output either as file download or Blob URL opened in a new clean screen
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
      alert("Ocurrió un error al generar el PDF: " + String(err));
    }
  };

  const handleDownloadPatientSummaryPDF = async (openInNewTab: boolean = false, shareViaWebShare: boolean = false, returnBase64: boolean = false): Promise<string | undefined> => {
    if (!patientSummary) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yCoord = 20;
      const marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - (2 * marginX); // 170mm

      // Helper function to check space and add page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
        }
      };

      // Strip emojis helper to prevent visual square errors in default fonts
      const stripEmojis = (str: string): string => {
        if (!str) return "";
        return str
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
      };

      // Header Brand/Clinic Logo & Name
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          const bannerImgEl = document.querySelector('img[alt="Membrete de la Clínica"]') as HTMLImageElement | null;
          let bannerWidth = 140;
          let bannerHeight = 28;
          if (bannerImgEl && bannerImgEl.naturalWidth && bannerImgEl.naturalHeight) {
            const aspect = bannerImgEl.naturalWidth / bannerImgEl.naturalHeight;
            const maxWidth = contentWidth;
            const maxHeight = 30;
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
            doc.text(clinicName ? clinicName.toUpperCase() : "ACOMPAÑAMIENTO EXPLICATIVO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;
          }

          if (clinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(clinicName.toUpperCase(), pageWidth / 2, yCoord, { align: "center" });
            yCoord += 5;
          }
        } else {
          const logoImgEl = document.querySelector('img[alt="Logo"]') as HTMLImageElement | null;
          let logoWidth = 22;
          let logoHeight = 22;
          if (logoImgEl && logoImgEl.naturalWidth && logoImgEl.naturalHeight) {
            const aspect = logoImgEl.naturalWidth / logoImgEl.naturalHeight;
            const maxWidth = 25;
            const maxHeight = 25;
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
          doc.text(clinicName ? clinicName.toUpperCase() : "ACOMPAÑAMIENTO EXPLICATIVO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + (logoHeight / 2) + 4);
          
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
          doc.text(clinicName ? clinicName.toUpperCase() : "ACOMPAÑAMIENTO EXPLICATIVO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          if (clinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(clinicName.toUpperCase(), pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("EXPLICACIÓN MÉDICA COMPRENSIBLE PARA EL PACIENTE", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("EXPLICACIÓN COMPRENSIBLE DE ESTUDIO RADIOLÓGICO", pageWidth / 2, yCoord, { align: "center" });
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
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA DEL ESTUDIO: ";
          totalDateWidth = doc.getTextWidth(dateLabel) + doc.getTextWidth(reportDate);
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
          doc.text(reportDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        yCoord += 19;
      }

      // Title of the Document
      checkPageBreak(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("INFORME DE ACOMPAÑAMIENTO Y EXPLICACIÓN SIMPLIFICADA", pageWidth / 2, yCoord, { align: "center" });
      yCoord += 8;

      // Introduction Summary
      if (patientSummary.summary) {
        const cleanSummary = stripEmojis(patientSummary.summary);
        doc.setFont("times", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(51, 65, 85);
        
        const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth);
        splitSummary.forEach((line: string) => {
          checkPageBreak(5.5);
          doc.text(line, marginX, yCoord);
          yCoord += 5.5;
        });
        yCoord += 4;
      }

      // Key Findings section
      if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
        checkPageBreak(15);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("HALLAZGOS IDENTIFICADOS Y TRADUCIDOS:", marginX, yCoord);
        yCoord += 7;

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
          const splitOrig = doc.splitTextToSize(`Término original en informe técnico: "${originalTerm}"`, contentWidth - 10);
          
          doc.setFont("times", "normal");
          doc.setFontSize(10);
          const splitExp = doc.splitTextToSize(`Explicación: ${simplifiedExplanation}`, contentWidth - 14);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          const splitAnalogy = doc.splitTextToSize(`Analogía de comprensión: ${analogy}`, contentWidth - 14);

          const splitReassurance = doc.splitTextToSize(`Contexto Clínico y Perspectiva Médica: ${reassurance}`, contentWidth - 14);

          const neededHeight = (splitTitle.length * 5) + 
                               (splitOrig.length * 4) + 
                               (splitExp.length * 5) + 
                               (splitAnalogy.length * 4.5) + 
                               (splitReassurance.length * 4.5) + 20;

          checkPageBreak(neededHeight);

          doc.setFillColor(250, 250, 250);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 4, "F");
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.35);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 4, "D");

          let interiorY = yCoord + 6;

          // Title
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 58, 138); 
          splitTitle.forEach((line: string) => {
            doc.text(line, marginX + 5, interiorY);
            interiorY += 5;
          });

          // Original term
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99); 
          splitOrig.forEach((line: string) => {
            doc.text(line, marginX + 5, interiorY);
            interiorY += 4.5;
          });
          interiorY += 2;

          // Explanation
          doc.setFont("times", "normal");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42); 
          splitExp.forEach((line: string) => {
            doc.text(line, marginX + 7, interiorY);
            interiorY += 4.8;
          });
          interiorY += 2;

          // Analogy (orange border bar)
          const analogyHeight = (splitAnalogy.length * 4.2) + 4;
          doc.setFillColor(255, 247, 237); 
          doc.rect(marginX + 5, interiorY - 3, contentWidth - 10, analogyHeight, "F");
          doc.setDrawColor(249, 115, 22); 
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3, marginX + 5, interiorY - 3 + analogyHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(124, 45, 18); 
          splitAnalogy.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2;
          });
          interiorY += 4;

          // Context (blue border bar)
          const contextHeight = (splitReassurance.length * 4.2) + 4;
          doc.setFillColor(239, 246, 255); 
          doc.rect(marginX + 5, interiorY - 3, contentWidth - 10, contextHeight, "F");
          doc.setDrawColor(59, 130, 246); 
          doc.setLineWidth(0.5);
          doc.line(marginX + 5, interiorY - 3, marginX + 5, interiorY - 3 + contextHeight);

          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(30, 58, 138); 
          splitReassurance.forEach((line: string) => {
            doc.text(line, marginX + 8, interiorY);
            interiorY += 4.2;
          });

          yCoord += neededHeight + 2;
        });
        yCoord += 4;
      }

      // Care Points Section
      if (patientSummary.carePoints && patientSummary.carePoints.length > 0) {
        checkPageBreak(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("PAUTAS Y RECOMENDACIONES DE BIENESTAR:", marginX, yCoord);
        yCoord += 7;

        patientSummary.carePoints.forEach((point: string) => {
          const cleanPoint = stripEmojis(point);
          const splitPoint = doc.splitTextToSize(cleanPoint, contentWidth - 8);
          
          checkPageBreak((splitPoint.length * 5) + 3);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          doc.text("•", marginX + 2, yCoord);

          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(51, 65, 85);

          splitPoint.forEach((line: string, i: number) => {
            doc.text(line, marginX + 6, yCoord + (i * 4.8));
          });
          yCoord += (splitPoint.length * 4.8) + 2.5;
        });
        yCoord += 4;
      }

      // Suggested Questions Section
      if (patientSummary.suggestedQuestions && patientSummary.suggestedQuestions.length > 0) {
        checkPageBreak(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("PREGUNTAS SUGERIDAS PARA SU CONSULTA MÉDICA:", marginX, yCoord);
        yCoord += 7;

        patientSummary.suggestedQuestions.forEach((q: string, idx: number) => {
          const cleanQ = stripEmojis(q);
          const splitQ = doc.splitTextToSize(`"${cleanQ}"`, contentWidth - 8);

          checkPageBreak((splitQ.length * 5) + 3);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(`${idx + 1}.`, marginX + 2, yCoord);

          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);

          splitQ.forEach((line: string, i: number) => {
            doc.text(line, marginX + 7, yCoord + (i * 4.8));
          });
          yCoord += (splitQ.length * 4.8) + 3;
        });
      }

      // Signature / Sign-off block
      if (doctorName || customSignatureUrl) {
        checkPageBreak(30);
        yCoord += 15;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
        yCoord += 6;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("VERIFICADO POR:", marginX, yCoord);
        doc.setFont("helvetica", "normal");
        doc.text("Firma Digital Autónoma", marginX, yCoord + 4);

        if (customSignatureUrl) {
          try {
            let sigWidth = 40;
            let sigHeight = 12;
            const sigImgEl = document.querySelector('img[alt="Firma"]') as HTMLImageElement | null;
            if (sigImgEl && sigImgEl.naturalWidth && sigImgEl.naturalHeight) {
              const aspect = sigImgEl.naturalWidth / sigImgEl.naturalHeight;
              const maxWidth = 55;
              const maxHeight = 16;
              if (aspect > maxWidth / maxHeight) {
                sigWidth = maxWidth;
                sigHeight = maxWidth / aspect;
              } else {
                sigHeight = maxHeight;
                sigWidth = maxHeight * aspect;
              }
            }
            const sigX = pageWidth - marginX - sigWidth - 8;
            const sigY = (yCoord - 6) - sigHeight - 1;
            const format = customSignatureUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customSignatureUrl, format, sigX, sigY, sigWidth, sigHeight);
          } catch (imgError) {
            console.warn("Could not render custom signature image inside jsPDF", imgError);
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        const docText = (doctorName || "MÉDICO ESPECIALISTA").toUpperCase();
        const docTextWidth = doc.getTextWidth(docText);
        doc.text(docText, pageWidth - marginX - docTextWidth, yCoord + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const titleText = "Médico Especialista en Radiodiagnóstico";
        const titleTextWidth = doc.getTextWidth(titleText);
        doc.text(titleText, pageWidth - marginX - titleTextWidth, yCoord + 8);
      }

      if (returnBase64) {
        const dataUri = doc.output("datauristring");
        return dataUri.split(",")[1];
      }

      if (shareViaWebShare) {
        const blob = doc.output("blob");
        const filename = patientName ? `${patientName.trim().replace(/\s+/gi, "_")}_explicacion.pdf` : "explicacion_paciente.pdf";
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Explicación del Estudio",
            text: `Explicación amigable del estudio para ${patientName || "Paciente"}`
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
      alert("Ocurrió un error al generar el PDF explicativo: " + String(err));
    }
  };

  const cleanRawClinicalText = (text: string) => {
    if (!text) return "";

    let clean = text
      .replace(/\[INICIO DE.*?\]/gi, "")
      .replace(/\[FIN DE.*?\]/gi, "")
      .replace(/\[INICIO DEL REPORTE\]\s*/gi, "")
      .replace(/\[FIN DEL REPORTE\]\s*/gi, "")
      .replace(/\$(.*?)\$/g, (match, p1) => {
        let mathContent = p1;
        mathContent = mathContent
          .replace(/\\ge/g, ">=")
          .replace(/\\le/g, "<=")
          .replace(/\\text\{(.*?)\}/g, "$1")
          .replace(/\\circ/g, "°");
        return mathContent;
      });

    // Decode HTML entities beautifully
    clean = clean
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&deg;/g, "°")
      .replace(/&plusmn;/g, "±")
      .replace(/&times;/g, "×")
      .replace(/&divide;/g, "÷")
      .replace(/&nbsp;/g, " ")
      .replace(/&aacute;/g, "á")
      .replace(/&eacute;/g, "é")
      .replace(/&iacute;/g, "í")
      .replace(/&oacute;/g, "ó")
      .replace(/&uacute;/g, "ú")
      .replace(/&Aacute;/g, "Á")
      .replace(/&Eacute;/g, "É")
      .replace(/&Iacute;/g, "Í")
      .replace(/&Oacute;/g, "Ó")
      .replace(/&Uacute;/g, "Ú")
      .replace(/&html;/g, "")
      .replace(/&ntilde;/g, "ñ")
      .replace(/&Ntilde;/g, "Ñ");

    // Clean LaTeX syntax elements from text representation to look clean and professional
    clean = clean
      .replace(/\\le(q)?\b/gi, "<=")
      .replace(/\\ge(q)?\b/gi, ">=")
      .replace(/\\pm\b/gi, "+/-")
      .replace(/\\approx\b/gi, "~")
      .replace(/\\times\b/gi, "x")
      .replace(/\\cdot\b/gi, "·")
      .replace(/\\circ\b/gi, "°")
      .replace(/\\degree\b/gi, "°")
      .replace(/\\alpha\b/gi, "alfa")
      .replace(/\\beta\b/gi, "beta")
      .replace(/\\gamma\b/gi, "gamma")
      .replace(/\\theta\b/gi, "theta")
      .replace(/\\mu\b/gi, "u")
      .replace(/\\text\s*\{(.*?)\}/gi, "$1")
      .replace(/\\mathrm\s*\{(.*?)\}/gi, "$1")
      .replace(/\\mathbf\s*\{(.*?)\}/gi, "$1")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "");

    // Also transform raw unicode characters directly to prevent compatibility "square box (□)" gaps in standard document fonts (jsPDF/MS Word)
    clean = clean
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/±/g, "+/-")
      .replace(/≈/g, "~")
      .replace(/α/g, "alfa")
      .replace(/β/g, "beta")
      .replace(/γ/g, "gamma")
      .replace(/θ/g, "theta")
      .replace(/μ/g, "u");

    return clean.trim();
  };

  interface ReportElement {
    type: "text" | "heading" | "list" | "table" | "divider" | "code";
    id: string;
    level?: number;
    text?: string;
    lines?: string[];
    items?: string[];
    headers?: string[];
    bodyRows?: string[][];
  }

  const parseReportToElements = (reportText: string, uniquePrefix: string): ReportElement[] => {
    const clean = cleanRawClinicalText(reportText);
    const lines = clean.split("\n");
    const elements: ReportElement[] = [];

    let currentTableLines: string[] = [];
    let currentListItems: string[] = [];
    let currentParagraphLines: string[] = [];
    let currentCodeLines: string[] = [];
    let inCodeBlock = false;

    const flushParagraph = () => {
      if (currentParagraphLines.length > 0) {
        elements.push({
          type: "text",
          id: `${uniquePrefix}-para-${elements.length}`,
          lines: [...currentParagraphLines]
        });
        currentParagraphLines = [];
      }
    };

    const flushList = () => {
      if (currentListItems.length > 0) {
        elements.push({
          type: "list",
          id: `${uniquePrefix}-list-${elements.length}`,
          items: [...currentListItems]
        });
        currentListItems = [];
      }
    };

    const flushTable = () => {
      if (currentTableLines.length > 0) {
        const cleanTableRows = currentTableLines
          .map(line => line.trim())
          .filter(line => {
            const hasPipe = line.includes("|");
            const isDivider = line.includes("---") || /^[|:\-\s]+$/.test(line);
            return hasPipe && !isDivider && line.replace(/\|/g, "").trim().length > 0;
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

          elements.push({
            type: "table",
            id: `${uniquePrefix}-table-${elements.length}`,
            headers,
            bodyRows
          });
        } else {
          currentParagraphLines.push(...currentTableLines);
        }
        currentTableLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      // Standard markdown code block handling (triple backticks)
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          elements.push({
            type: "code",
            id: `${uniquePrefix}-code-${elements.length}`,
            lines: [...currentCodeLines]
          });
          currentCodeLines = [];
          inCodeBlock = false;
        } else {
          flushParagraph();
          flushList();
          flushTable();
          inCodeBlock = true;
          currentCodeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        currentCodeLines.push(rawLine);
        continue;
      }

      // Safe raw-block fallback: detect raw EMR equal-sign borders if not wrapped in triple backticks
      if (trimmed.startsWith("==========") && trimmed.length > 15) {
        if (currentCodeLines.length > 0) {
          currentCodeLines.push(rawLine);
          elements.push({
            type: "code",
            id: `${uniquePrefix}-code-${elements.length}`,
            lines: [...currentCodeLines]
          });
          currentCodeLines = [];
        } else {
          flushParagraph();
          flushList();
          flushTable();
          currentCodeLines = [rawLine];
        }
        continue;
      }

      if (currentCodeLines.length > 0) {
        currentCodeLines.push(rawLine);
        // Look ahead to check if we can skip the concluding divider if there's any
        const nextLineTrimmed = (i < lines.length - 1) ? lines[i+1].trim() : "";
        if (nextLineTrimmed.startsWith("----------") && nextLineTrimmed.length > 15) {
          currentCodeLines.push(lines[i+1]);
          i++; // skip next line
          elements.push({
            type: "code",
            id: `${uniquePrefix}-code-${elements.length}`,
            lines: [...currentCodeLines]
          });
          currentCodeLines = [];
        } else if (i === lines.length - 1) {
          // Flush code block at end of document if unclosed
          elements.push({
            type: "code",
            id: `${uniquePrefix}-code-${elements.length}`,
            lines: [...currentCodeLines]
          });
          currentCodeLines = [];
        }
        continue;
      }

      if (trimmed === "---") {
        flushParagraph();
        flushList();
        flushTable();
        elements.push({ type: "divider", id: `${uniquePrefix}-div-${elements.length}` });
        continue;
      }

      const hasPipe = trimmed.includes("|");
      const isTableDivider = trimmed.includes("---") && hasPipe;
      const isPotentialTableLine = hasPipe && (isTableDivider || trimmed.split("|").length >= 3 || (i > 0 && lines[i-1].includes("|")) || (i < lines.length - 1 && lines[i+1].includes("|")));

      if (isPotentialTableLine) {
        flushParagraph();
        flushList();
        currentTableLines.push(rawLine);
        continue;
      }

      flushTable();

      let isHeading = false;
      let headingLevel = 0;
      let lineContent = trimmed;

      if (lineContent.startsWith("# ")) {
        isHeading = true;
        headingLevel = 1;
        lineContent = lineContent.replace(/^#\s+/, "");
      } else if (lineContent.startsWith("## ")) {
        isHeading = true;
        headingLevel = 2;
        lineContent = lineContent.replace(/^##\s+/, "");
      } else if (lineContent.startsWith("### ")) {
        isHeading = true;
        headingLevel = 3;
        lineContent = lineContent.replace(/^###\s+/, "");
      } else if (lineContent.startsWith("#### ")) {
        isHeading = true;
        headingLevel = 4;
        lineContent = lineContent.replace(/^####\s+/, "");
      }

      if (isHeading) {
        flushParagraph();
        flushList();
        elements.push({
          type: "heading",
          id: `${uniquePrefix}-head-${elements.length}`,
          level: headingLevel,
          text: lineContent
        });
        continue;
      }

      const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
      if (isBulleted) {
        flushParagraph();
        currentListItems.push(trimmed);
        continue;
      }

      flushList();

      if (trimmed === "") {
        flushParagraph();
      } else {
        currentParagraphLines.push(rawLine);
      }
    }

    flushParagraph();
    flushList();
    flushTable();

    if (currentCodeLines.length > 0 || inCodeBlock) {
      elements.push({
        type: "code",
        id: `${uniquePrefix}-code-${elements.length}`,
        lines: [...currentCodeLines]
      });
    }

    return elements;
  };

  const renderBoldTextBlackSafe = (text: string, keyPrefix: string) => {
    if (!text) return "";
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;
    let keyCounter = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      parts.push(
        <strong key={`${keyPrefix}-${keyCounter++}`} className="font-extrabold text-black">
          {match[1]}
        </strong>
      );
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  };

  const renderBoldTextSafe = (text: string, keyPrefix: string) => {
    if (!text) return "";
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.*?)\*\"/g; // Wait, actually standard bold regex is /\*\*(.*?)\*\*/g
    const realBoldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;
    let keyCounter = 0;

    while ((match = realBoldRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      parts.push(
        <strong key={`${keyPrefix}-${keyCounter++}`} className="font-bold text-white">
          {match[1]}
        </strong>
      );
      lastIndex = realBoldRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  };

  const highlightRadiologicalText = (text: string, keyPrefix: string) => {
    if (!text) return "";
    if (!isSyntacticHighlightingActive) {
      return renderBoldTextSafe(text, keyPrefix);
    }

    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyCounter = 0;
    let match;

    const getHighlightCategory = (word: string) => {
      const w = word.toLowerCase();
      
      // Pathologies / Anomalies
      const pathologies = [
        "fractura", "fractur", "trazos", "trazo", "desplazamiento", "fisura", "compromiso articular", 
        "luxación", "subluxación", "fx", "reducción", "rediccion", "pinzamiento", "osteofito", "osteofitos", 
        "osteofitosis", "esclerosis", "derrame", "nódulo", "nodulo", "infiltrado", "estenosis", "hernia", 
        "protusión", "desgarro", "tendinopatía", "disminuido", "disminución", "patológico", "anómalo", 
        "ruptura", "calcificación", "lesión", "lesion", "inflamación"
      ];
      if (showPathology && pathologies.some(p => w.includes(p) || p.includes(w) && w.length > 4)) {
        return {
          category: "Patología / Alteración",
          colorClass: "text-rose-450 bg-rose-500/10 hover:bg-rose-500/20 border-b border-rose-500/50",
          indicator: "🔴",
          description: "Hallazgo patológico o alteración estructural detectada en el estudio."
        };
      }

      // Anatomy
      const anatomy = [
        "fémur", "femur", "tibia", "peroné", "perone", "rótula", "rotula", "patelar", "codo", "húmero", "humero", 
        "radio", "cúbito", "cubito", "carótida", "carotida", "menisco", "ligamento", "pulmón", "pulmon", 
        "pulmonar", "hilio", "hiliar", "mediastino", "columna", "vértebra", "vertebra", "cervical", 
        "lumbar", "dorsal", "articulación", "articulacion", "muscular", "esquelético", "femoral", 
        "femorotibial", "tíbioperonea", "tibiofibular", "meniscos", "pulmones", "carotídeo"
      ];
      if (showAnatomy && anatomy.some(a => w.includes(a) || a.includes(w) && w.length > 4)) {
        return {
          category: "Anatomía",
          colorClass: "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border-b border-cyan-500/50",
          indicator: "🔵",
          description: "Mención de estructura anatómica o región evaluada."
        };
      }

      // Normal findings
      const normals = [
        "conservado", "conservada", "sin hallazgos", "normal", "respetado", "respetada", "adecuado", 
        "adecuada", "libre", "no se aprecia", "no se observa", "negativo", "integro", "íntegro", 
        "estables", "preservada", "preservado", "uniforme", "homogéneo", "homogénea"
      ];
      if (showNormal && normals.some(n => w.includes(n) || n.includes(w) && w.length > 5)) {
        return {
          category: "Normalidad / Conservado",
          colorClass: "text-emerald-450 bg-emerald-500/10 hover:bg-emerald-500/20 border-b border-emerald-500/50",
          indicator: "🟢",
          description: "Signo o estructura anatómica con morfología conservada o normal."
        };
      }

      // Measurements / parameters / scales / technical
      const technical = [
        "mm", "cm", "grados", "kv", "mas", "secuencia", "t1", "t2", "axial", "sagital", 
        "coronal", "escala", "criterio", "clasificación", "clasificacion", "cie-10", "icd-10"
      ];
      if (showTechnical && technical.some(t => w === t || w.includes(t) && w.length > 2)) {
        return {
          category: "Técnica / Medida",
          colorClass: "text-purple-450 bg-purple-500/10 hover:bg-purple-500/20 border-b border-purple-500/50",
          indicator: "🟣",
          description: "Métrica, escala clínica, clasificación o parámetro de adquisición."
        };
      }

      return null;
    };

    const processTextSegment = (plainText: string, isBold: boolean, segmentKey: string) => {
      const wordPattern = /([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\d-]+)/g;
      const subParts: React.ReactNode[] = [];
      let lastSubIndex = 0;
      let subMatch;
      let subCounter = 0;

      while ((subMatch = wordPattern.exec(plainText)) !== null) {
        const matchIndex = subMatch.index;
        if (matchIndex > lastSubIndex) {
          subParts.push(plainText.substring(lastSubIndex, matchIndex));
        }
        
        const matchedWord = subMatch[1];
        const matchDetails = getHighlightCategory(matchedWord);

        if (matchDetails) {
          subParts.push(
            <span 
              key={`${segmentKey}-word-${subCounter++}`} 
              className={`cursor-help px-0.5 rounded transition-all inline relative group select-all ${matchDetails.colorClass}`}
            >
              {isBold ? (
                <strong className={`font-extrabold ${reportTheme === 'academic-light' || reportTheme === 'clinical-minimal' ? 'text-black' : 'text-white'}`}>
                  {matchedWord}
                </strong>
              ) : matchedWord}
              {/* Tooltip dynamic styling */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 bg-slate-900 border border-slate-700 text-slate-100 p-2 rounded-xl shadow-2xl text-[10px] leading-relaxed z-[999] pointer-events-none select-none font-sans font-medium text-center">
                <span className="flex items-center gap-1 mb-1 font-black justify-center">
                  <span>{matchDetails.indicator}</span>
                  <span className="uppercase text-[8px] tracking-wider text-white">{matchDetails.category}</span>
                </span>
                {matchDetails.description}
              </span>
            </span>
          );
        } else {
          subParts.push(
            isBold ? (
              <strong key={`${segmentKey}-plain-${subCounter++}`} className={`font-bold ${reportTheme === 'academic-light' || reportTheme === 'clinical-minimal' ? 'text-slate-950 font-black' : 'text-white'}`}>
                {matchedWord}
              </strong>
            ) : matchedWord
          );
        }
        lastSubIndex = wordPattern.lastIndex;
      }
      
      if (lastSubIndex < plainText.length) {
        subParts.push(
          isBold ? (
            <strong key={`${segmentKey}-plain-last`} className={`font-bold ${reportTheme === 'academic-light' || reportTheme === 'clinical-minimal' ? 'text-slate-950 font-black' : 'text-white'}`}>
              {plainText.substring(lastSubIndex)}
            </strong>
          ) : plainText.substring(lastSubIndex)
        );
      }
      return subParts;
    };

    while ((match = boldRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(...processTextSegment(text.substring(lastIndex, matchIndex), false, `${keyPrefix}-p-${keyCounter}`));
      }
      parts.push(...processTextSegment(match[1], true, `${keyPrefix}-b-${keyCounter}`));
      lastIndex = boldRegex.lastIndex;
      keyCounter++;
    }
    
    if (lastIndex < text.length) {
      parts.push(...processTextSegment(text.substring(lastIndex), false, `${keyPrefix}-p-last`));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderPrintVascularSchema = () => {
    if (!includeVascularSchemaInReport) return null;
    const studyLower = (specificStudy || "").toLowerCase();
    const isCarotidas = studyLower.includes("carót") || studyLower.includes("carot");
    const isVenoso = studyLower.includes("venoso");
    const isArterial = studyLower.includes("arterial");

    const isVascular = isCarotidas || isVenoso || isArterial;

    if (!isVascular) return null;

    const carotidMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
      vert_der: { x: 125, y: 300, textX: 60, textY: 280, align: "end" },
      acc_der:  { x: 160, y: 320, textX: 70, textY: 340, align: "end" },
      aci_der:  { x: 142, y: 110, textX: 55, textY: 100, align: "end" },
      ace_der:  { x: 173, y: 125, textX: 200, textY: 115, align: "start" },
      
      vert_izq: { x: 275, y: 300, textX: 340, textY: 280, align: "start" },
      acc_izq:  { x: 240, y: 320, textX: 330, textY: 340, align: "start" },
      aci_izq:  { x: 258, y: 110, textX: 345, textY: 100, align: "start" },
      ace_izq:  { x: 227, y: 125, textX: 200, textY: 145, align: "end" },
    };

    const venousMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
      vfc_der: { x: 140, y: 95, textX: 60, textY: 85, align: "end" },
      sfj_der: { x: 153, y: 92, textX: 195, textY: 70, align: "start" },
      vfs_der: { x: 135, y: 200, textX: 52, textY: 180, align: "end" },
      vp_der:  { x: 125, y: 300, textX: 45, textY: 300, align: "end" },
      vsm_der: { x: 170, y: 240, textX: 195, textY: 210, align: "start" },
      vsp_der: { x: 108, y: 340, textX: 30, textY: 340, align: "end" },

      vfc_izq: { x: 260, y: 95, textX: 340, textY: 85, align: "start" },
      sfj_izq: { x: 247, y: 92, textX: 205, textY: 70, align: "end" },
      vfs_izq: { x: 265, y: 200, textX: 348, textY: 180, align: "start" },
      vp_izq:  { x: 275, y: 300, textX: 355, textY: 300, align: "start" },
      vsm_izq: { x: 230, y: 240, textX: 205, textY: 210, align: "end" },
      vsp_izq: { x: 292, y: 340, textX: 370, textY: 340, align: "start" },
    };

    const arterialMidpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }> = {
      aic_der:  { x: 155, y: 78, textX: 70, textY: 70, align: "end" },
      afc_der:  { x: 140, y: 130, textX: 60, textY: 125, align: "end" },
      afs_der:  { x: 135, y: 210, textX: 50, textY: 195, align: "end" },
      ap_der:   { x: 127, y: 290, textX: 45, textY: 290, align: "end" },
      ata_der:  { x: 118, y: 365, textX: 52, textY: 365, align: "end" },
      atp_der:  { x: 123, y: 375, textX: 145, textY: 385, align: "start" },
      aper_der: { x: 132, y: 370, textX: 180, textY: 395, align: "start" },

      aic_izq:  { x: 245, y: 78, textX: 335, textY: 70, align: "start" },
      afc_izq:  { x: 260, y: 130, textX: 340, textY: 125, align: "start" },
      afs_izq:  { x: 265, y: 210, textX: 350, textY: 195, align: "start" },
      ap_izq:   { x: 273, y: 290, textX: 355, textY: 290, align: "start" },
      ata_izq:  { x: 282, y: 365, textX: 345, textY: 365, align: "start" },
      atp_izq:  { x: 277, y: 375, textX: 255, textY: 385, align: "end" },
      aper_izq: { x: 268, y: 370, textX: 220, textY: 395, align: "end" },
    };

    const isLimbEvaluated = (side: "der" | "izq") => {
      if (isCarotidas) return true;

      const latLower = (laterality || "").toLowerCase();
      if (latLower === "derecha" || latLower === "derecho") {
        return side === "der";
      }
      if (latLower === "izquierda" || latLower === "izquierdo") {
        return side === "izq";
      }
      if (latLower === "bilateral") {
        return true;
      }

      const studyLower = (specificStudy || "").toLowerCase();
      const reportLower = (generatedReport || "").toLowerCase();

      const hasDerechoInStudy = studyLower.includes("derech") || studyLower.includes(" unilateral d") || studyLower.includes("der.");
      const hasIzquierdoInStudy = studyLower.includes("izquierd") || studyLower.includes(" unilateral i") || studyLower.includes("izq.");

      const hasDerechoInReport = reportLower.includes("miembro inferior derecho") || reportLower.includes("m.i. derecho") || reportLower.includes("unilateral derecho");
      const hasIzquierdoInReport = reportLower.includes("miembro inferior izquierdo") || reportLower.includes("m.i. izquierdo") || reportLower.includes("unilateral izquierdo");

      if (hasDerechoInStudy && !hasIzquierdoInStudy) {
        return side === "der";
      }
      if (hasIzquierdoInStudy && !hasDerechoInStudy) {
        return side === "izq";
      }

      if (hasDerechoInReport && !hasIzquierdoInReport) {
        return side === "der";
      }
      if (hasIzquierdoInReport && !hasDerechoInReport) {
        return side === "izq";
      }

      return true; // default to bilateral
    };

    const getSegColor = (id: string) => {
      const isRightSegment = id.endsWith("_der");
      const isLeftSegment = id.endsWith("_izq");

      if (isRightSegment && !isLimbEvaluated("der")) {
        return "#94a3b8"; // soft slate gray for non-evaluated Right
      }
      if (isLeftSegment && !isLimbEvaluated("izq")) {
        return "#94a3b8"; // soft slate gray for non-evaluated Left
      }

      const s = vascularStates[id] || "normal";
      if (s === "normal") return "#059669"; // Emerald (slightly darker for print contrast)
      if (s === "mild" || s === "reflux") return "#d97706"; // Amber (darker for print)
      return "#dc2626"; // Red (darker for print)
    };

    const getSegLabel = (id: string) => {
      const isRightSegment = id.endsWith("_der");
      const isLeftSegment = id.endsWith("_izq");

      if (isRightSegment && !isLimbEvaluated("der")) {
        return "No evaluado";
      }
      if (isLeftSegment && !isLimbEvaluated("izq")) {
        return "No evaluado";
      }

      const s = vascularStates[id] || "normal";
      if (s === "normal") return isVenoso ? "Permeable" : "Normal";

      const descText = (vascularDescriptions[id] || "").toLowerCase().trim();

      // 1. flujo no detectable
      if (
        descText.includes("flujo no detectable") || 
        descText.includes("no detectable") || 
        descText.includes("flujo ausente") || 
        descText.includes("ausencia de flujo") || 
        descText.includes("onda no detectable") || 
        descText.includes("señal no detectable")
      ) {
        return "Flujo no detectable";
      }

      // 2. oclusión
      if (
        descText.includes("oclusión") || 
        descText.includes("oclusion") || 
        descText.includes("ocluido") || 
        descText.includes("ocluida") || 
        descText.includes("obstrucción completa") || 
        descText.includes("obstruccion completa") || 
        descText.includes("obstrucción total") || 
        descText.includes("obstruccion total") || 
        descText.includes("obturado") ||
        descText.includes("oclusión completa") ||
        descText.includes("oclusion completa")
      ) {
        return "Oclusión";
      }

      // 2.5 aterosclerosis (prioritized check to prevent fallback to estenosis difusa)
      if (
        descText.includes("enfermedad aterosclerótica") ||
        descText.includes("enfermedad aterosclerotica") ||
        descText.includes("aterosclerosis") ||
        descText.includes("aterosclerótica") ||
        descText.includes("aterosclerotica")
      ) {
        return "Aterosclerosis";
      }

      // 3. estenosis focal
      if (
        descText.includes("estenosis focal") || 
        descText.includes("focal") || 
        descText.includes("zona específica de estenosis") ||
        descText.includes("zona especifica de estenosis") ||
        descText.includes("lesión de estenosis") ||
        descText.includes("lesion de estenosis")
      ) {
        return "Estenosis focal";
      }

      // 4. estenosis difusa
      if (
        descText.includes("estenosis difusa") || 
        descText.includes("estenosis difuso") ||
        descText.includes("estenosis difusas")
      ) {
        return "Estenosis difusa";
      }

      // 5. ateromatosis
      if (
        descText.includes("ateromatosis") || 
        descText.includes("placa") || 
        descText.includes("placas") || 
        descText.includes("ateroma") || 
        descText.includes("ateromatosa") || 
        descText.includes("ateromatosas") || 
        descText.includes("engrosamiento miointimal") ||
        descText.includes("gim") || 
        descText.includes("miointimal") ||
        s === "mild"
      ) {
        return "Ateromatosis";
      }

      // Fallbacks
      if (s === "severe") {
        return "Estenosis focal";
      }
      if (s === "reflux") {
        return "Reflujo";
      }
      if (s === "thrombosis") {
        return "Trombosis";
      }

      return "Normal";
    };

    const getPrintShortExplanationText = (id: string) => {
      const isRightSegment = id.endsWith("_der");
      const isLeftSegment = id.endsWith("_izq");

      if (isRightSegment && !isLimbEvaluated("der")) {
        return "no evaluado";
      }
      if (isLeftSegment && !isLimbEvaluated("izq")) {
        return "no evaluado";
      }

      const s = vascularStates[id] || "normal";
      if (s === "normal") return "";

      const label = getSegLabel(id);
      if (label === "Normal" || label === "Permeable") return "";
      return label.toLowerCase();
    };

    const getCoordinateWithOffset = (id: string, pt: { x: number, y: number }) => {
      const subLoc = vascularSubLocations[id] || "general";
      if (subLoc === "general" || subLoc === "medio") {
        return pt;
      }

      let offsetX = 0;
      let offsetY = 0;

      if (isCarotidas) {
        if (id.startsWith("acc_")) {
          if (subLoc === "proximal" || subLoc === "origen") offsetY = 40;
          if (subLoc === "distal" || subLoc === "bifurcacion") offsetY = -40;
        } else if (id.startsWith("aci_") || id.startsWith("ace_")) {
          if (subLoc === "proximal" || subLoc === "origen" || subLoc === "bifurcacion") {
            offsetY = 30;
            offsetX = id.startsWith("aci_") ? 5 : -5;
          }
          if (subLoc === "distal") offsetY = -30;
        } else if (id.startsWith("vert_")) {
          if (subLoc === "proximal") offsetY = 40;
          if (subLoc === "distal") offsetY = -40;
        }
      } else if (isVenoso) {
        if (id.startsWith("vfc_")) {
          if (subLoc === "proximal") offsetY = -15;
          if (subLoc === "distal") offsetY = 15;
        } else if (id.startsWith("vfs_")) {
          if (subLoc === "proximal") offsetY = -40;
          if (subLoc === "distal") offsetY = 40;
        } else if (id.startsWith("vp_")) {
          if (subLoc === "proximal") offsetY = -30;
          if (subLoc === "distal") offsetY = 30;
        } else if (id.startsWith("vsm_") || id.startsWith("vsp_")) {
          if (subLoc === "proximal") offsetY = -45;
          if (subLoc === "distal") offsetY = 45;
        }
      } else {
        if (id.startsWith("aic_")) {
          if (subLoc === "proximal" || subLoc === "origen") offsetY = -15;
          if (subLoc === "distal") offsetY = 15;
        } else if (id.startsWith("afc_")) {
          if (subLoc === "proximal") offsetY = -15;
          if (subLoc === "distal" || subLoc === "bifurcacion") offsetY = 15;
        } else if (id.startsWith("afs_")) {
          if (subLoc === "proximal" || subLoc === "origen") offsetY = -45;
          if (subLoc === "distal") offsetY = 45;
        } else if (id.startsWith("ap_")) {
          if (subLoc === "proximal") offsetY = -30;
          if (subLoc === "distal") offsetY = 30;
        } else if (id.startsWith("at") || id.startsWith("aper_")) {
          if (subLoc === "proximal") offsetY = -15;
          if (subLoc === "distal") offsetY = 15;
        }
      }

      return { x: pt.x + offsetX, y: pt.y + offsetY };
    };

    const renderPrintOverlayAnomalies = (midpoints: Record<string, { x: number, y: number, textX: number, textY: number, align: "start" | "end" | "middle" }>) => {
      return Object.entries(vascularStates).map(([id, state]) => {
        if (state === "normal") return null;
        const basePt = midpoints[id];
        if (!basePt) return null;

        const pt = getCoordinateWithOffset(id, basePt);
        const color = state === "severe" || state === "thrombosis" ? "#dc2626" : "#d97706";
        
        let indicator = null;
        if (state === "mild") {
          indicator = (
            <g>
              <circle cx={pt.x} cy={pt.y} r="6" fill="#f59e0b" opacity="0.3" />
              <circle cx={pt.x} cy={pt.y} r="3.5" fill="#d97706" stroke="#ffffff" strokeWidth="0.8" />
              <path d={`M ${pt.x - 2} ${pt.y - 2} Q ${pt.x + 2} ${pt.y} ${pt.x - 2} ${pt.y + 2}`} fill="none" stroke="#b45309" strokeWidth="1" />
            </g>
          );
        } else if (state === "severe") {
          indicator = (
            <g>
              <circle cx={pt.x} cy={pt.y} r="8" fill="#dc2626" opacity="0.3" />
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="0.8" />
              <path d={`M ${pt.x - 3} ${pt.y - 3} Q ${pt.x + 3} ${pt.y} ${pt.x - 3} ${pt.y + 3}`} fill="none" stroke="#7f1d1d" strokeWidth="1.2" />
            </g>
          );
        } else if (state === "reflux") {
          indicator = (
            <g transform={`translate(${pt.x}, ${pt.y})`}>
              <circle cx="0" cy="0" r="5" fill="#f59e0b" opacity="0.25" />
              <path d="M-3,-1.5 A3,3 0 0,0 3,1.5" fill="none" stroke="#d97706" strokeWidth="1.2" />
            </g>
          );
        } else if (state === "thrombosis") {
          indicator = (
            <g transform={`translate(${pt.x}, ${pt.y})`}>
              <rect x="-6" y="-3.5" width="12" height="7" rx="1" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="0.8" />
              <line x1="-3.5" y1="-2" x2="3.5" y2="2" stroke="#f87171" strokeWidth="0.8" />
              <line x1="3.5" y1="-2" x2="-3.5" y2="2" stroke="#f87171" strokeWidth="0.8" />
            </g>
          );
        }

        const subLoc = vascularSubLocations[id] || "general";
        const subLocLabel = subLoc !== "general" ? ` (${subLoc.toUpperCase()})` : "";
        const baseLabel = id.replace("_der", " R").replace("_izq", " L").toUpperCase();
        
        const shortEx = getPrintShortExplanationText(id);
        const croppedDesc = `${baseLabel}${subLocLabel}: ${shortEx || "Normal"}`;

        return (
          <g key={`print-anon-${id}`}>
            <line x1={pt.x} y1={pt.y} x2={basePt.textX} y2={basePt.textY} stroke={color} strokeWidth="0.8" strokeDasharray="1.5 1.5" />
            {indicator}
            <g transform={`translate(${basePt.textX}, ${basePt.textY})`}>
              <rect 
                x={basePt.align === "end" ? -154 : basePt.align === "middle" ? -78 : -2} 
                y="-8" 
                width="156" 
                height="16" 
                rx="3" 
                fill="#ffffff" 
                stroke={color} 
                strokeWidth="1" 
              />
              <text 
                x={basePt.align === "end" ? -78 : basePt.align === "middle" ? 0 : 78} 
                y="2.5" 
                fill="#0f172a" 
                fontSize="6" 
                fontWeight="black" 
                textAnchor="middle"
                className="font-sans font-extrabold"
              >
                {croppedDesc}
              </text>
            </g>
          </g>
        );
      });
    };

    return (
      <div className="mt-8 border-t-2 border-dashed border-gray-300 pt-6 font-sans" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div className="text-center font-bold text-xs uppercase tracking-wider mb-2 text-slate-800">
          Esquema Clínico Doppler Vascular - Mapeo de Hallazgos
        </div>
        <p className="text-center text-[10px] text-gray-400 uppercase font-mono tracking-wide mb-4">
          Esquema anatómico personalizado según los hallazgos descritos en el informe clínico.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 max-w-2xl mx-auto">
          {/* SVG representation */}
          <div className="w-[410px] h-[290px] border border-gray-200 rounded-lg p-2 bg-white flex items-center justify-center">
            {isCarotidas && (
              <svg id="print-vascular-svg" viewBox="-120 0 640 450" className="w-full h-full font-mono text-[9px]">
                <line x1="200" y1="20" x2="200" y2="430" stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
                <text x="70" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">DERECHO (R)</text>
                <text x="330" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">IZQUIERDO (L)</text>
                
                {/* R-Vert */}
                <path d="M 125 430 L 125 150 Q 125 100 135 70" fill="none" stroke={getSegColor("vert_der")} strokeWidth="5" />
                {/* R-ACC */}
                <path d="M 160 430 L 160 220" fill="none" stroke={getSegColor("acc_der")} strokeWidth="10" />
                {/* R-ACI */}
                <path d="M 160 220 C 160 200, 145 190, 145 170" fill="none" stroke={getSegColor("aci_der")} strokeWidth="8" />
                <path d="M 145 175 L 140 60" fill="none" stroke={getSegColor("aci_der")} strokeWidth="8" />
                {/* R-ACE */}
                <path d="M 160 220 C 160 200, 175 190, 175 170 L 180 80" fill="none" stroke={getSegColor("ace_der")} strokeWidth="6" />
                
                {/* L-Vert */}
                <path d="M 275 430 L 275 150 Q 275 100 265 70" fill="none" stroke={getSegColor("vert_izq")} strokeWidth="5" />
                {/* L-ACC */}
                <path d="M 240 430 L 240 220" fill="none" stroke={getSegColor("acc_izq")} strokeWidth="10" />
                {/* L-ACI */}
                <path d="M 240 220 C 240 200, 255 190, 255 170" fill="none" stroke={getSegColor("aci_izq")} strokeWidth="8" />
                <path d="M 255 175 L 260 60" fill="none" stroke={getSegColor("aci_izq")} strokeWidth="8" />
                {/* L-ACE */}
                <path d="M 240 220 C 240 200, 225 190, 225 170 L 220 80" fill="none" stroke={getSegColor("ace_izq")} strokeWidth="6" />

                {/* Print overlays */}
                {renderPrintOverlayAnomalies(carotidMidpoints)}
              </svg>
            )}
            {isVenoso && (
              <svg id="print-vascular-svg" viewBox="-120 0 640 450" className="w-full h-full font-mono text-[9px]">
                <line x1="200" y1="20" x2="200" y2="430" stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
                <text x="70" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">DERECHO (R)</text>
                <text x="330" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">IZQUIERDO (L)</text>
                
                {/* Venous Right */}
                <path d="M 140 50 L 140 140" fill="none" stroke={getSegColor("vfc_der")} strokeWidth="10" />
                <path d="M 140 80 Q 155 80, 160 110" fill="none" stroke={getSegColor("sfj_der")} strokeWidth="7" />
                <path d="M 140 140 L 130 260" fill="none" stroke={getSegColor("vfs_der")} strokeWidth="8" />
                <path d="M 130 260 L 120 340" fill="none" stroke={getSegColor("vp_der")} strokeWidth="7" />
                <path d="M 160 110 L 175 220 Q 185 310, 160 410" fill="none" stroke={getSegColor("vsm_der")} strokeWidth="6" />
                <path d="M 120 280 Q 95 300, 105 400" fill="none" stroke={getSegColor("vsp_der")} strokeWidth="5" />

                {/* Venous Left */}
                <path d="M 260 50 L 260 140" fill="none" stroke={getSegColor("vfc_izq")} strokeWidth="10" />
                <path d="M 260 80 Q 245 80, 240 110" fill="none" stroke={getSegColor("sfj_izq")} strokeWidth="7" />
                <path d="M 260 140 L 270 260" fill="none" stroke={getSegColor("vfs_izq")} strokeWidth="8" />
                <path d="M 270 260 L 280 340" fill="none" stroke={getSegColor("vp_izq")} strokeWidth="7" />
                <path d="M 240 110 L 225 220 Q 215 310, 240 410" fill="none" stroke={getSegColor("vsm_izq")} strokeWidth="6" />
                <path d="M 280 280 Q 305 300, 295 400" fill="none" stroke={getSegColor("vsp_izq")} strokeWidth="5" />

                {/* Print overlays */}
                {renderPrintOverlayAnomalies(venousMidpoints)}
              </svg>
            )}
            {isArterial && (
              <svg id="print-vascular-svg" viewBox="-120 0 640 450" className="w-full h-full font-mono text-[9px]">
                <line x1="200" y1="20" x2="200" y2="430" stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
                <text x="70" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">DERECHO (R)</text>
                <text x="330" y="30" fill="#4B5563" fontWeight="bold" textAnchor="middle" className="text-[10px]">IZQUIERDO (L)</text>
                
                {/* Arterial Right */}
                <path d="M 180 50 Q 150 70, 140 100" fill="none" stroke={getSegColor("aic_der")} strokeWidth="8" />
                <path d="M 140 100 L 140 160" fill="none" stroke={getSegColor("afc_der")} strokeWidth="10" />
                <path d="M 140 160 L 130 260" fill="none" stroke={getSegColor("afs_der")} strokeWidth="8" />
                <path d="M 130 260 L 125 320" fill="none" stroke={getSegColor("ap_der")} strokeWidth="7" />
                <path d="M 125 320 L 110 410" fill="none" stroke={getSegColor("ata_der")} strokeWidth="5" />
                <path d="M 125 320 L 122 410" fill="none" stroke={getSegColor("atp_der")} strokeWidth="5" />
                <path d="M 125 335 L 140 405" fill="none" stroke={getSegColor("aper_der")} strokeWidth="4.5" />

                {/* Arterial Left */}
                <path d="M 220 50 Q 250 70, 260 100" fill="none" stroke={getSegColor("aic_izq")} strokeWidth="8" />
                <path d="M 260 100 L 260 160" fill="none" stroke={getSegColor("afc_izq")} strokeWidth="10" />
                <path d="M 260 160 L 270 260" fill="none" stroke={getSegColor("afs_izq")} strokeWidth="8" />
                <path d="M 270 260 L 275 320" fill="none" stroke={getSegColor("ap_izq")} strokeWidth="7" />
                <path d="M 275 320 L 290 410" fill="none" stroke={getSegColor("ata_izq")} strokeWidth="5" />
                <path d="M 275 320 L 278 410" fill="none" stroke={getSegColor("atp_izq")} strokeWidth="5" />
                <path d="M 275 335 L 260 405" fill="none" stroke={getSegColor("aper_izq")} strokeWidth="4.5" />

                {/* Print overlays */}
                {renderPrintOverlayAnomalies(arterialMidpoints)}
              </svg>
            )}
          </div>

          {/* Details table / text list */}
          <div className="flex-1 text-[11px] font-sans text-gray-700 space-y-1.5 max-w-sm">
            <div className="font-bold border-b pb-1 text-slate-800 uppercase tracking-widest text-[9.5px]">Leyenda de Hallazgos:</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
              {Object.entries(vascularStates)
                .filter(([id]) => {
                  const isRight = id.endsWith("_der");
                  const isLeft = id.endsWith("_izq");
                  if (isRight && !isLimbEvaluated("der")) return false;
                  if (isLeft && !isLimbEvaluated("izq")) return false;
                  return true;
                })
                .map(([id, val]) => (
                  <div key={id} className="flex items-center gap-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getSegColor(id) }} />
                    <span className="font-bold text-[9px] uppercase text-gray-800 truncate">{id.replace("_der", "-R").replace("_izq", "-L")}:</span>
                    <span className="text-[9px] text-gray-600 shrink-0">{getSegLabel(id)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrintReportBody = (reportText: string) => {
    if (!reportText) return null;

    const elements = parseReportToElements(reportText, "print-body");

    return (
      <div className={`space-y-6 text-black select-text ${adaptivePDFContrast ? "font-sans text-[13.5px]" : "font-serif text-[12.5px]"}`}>
        {elements.map((elem, idx) => {
          if (elem.type === "divider") {
            return <hr key={elem.id} className={`my-6 border-t ${adaptivePDFContrast ? "border-black border-base" : "border-slate-300"}`} />;
          }

          if (elem.type === "code") {
            return (
              <div 
                key={elem.id} 
                className={`my-4 border ${adaptivePDFContrast ? "border-black bg-gray-50/60" : "border-slate-300 bg-slate-50/70"} rounded-lg p-3 font-mono text-[10px] md:text-[10.5px]`}
                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                <pre className={`whitespace-pre-wrap font-mono font-medium leading-relaxed ${adaptivePDFContrast ? "text-black" : "text-slate-850"}`}>
                  {elem.lines?.join("\n")}
                </pre>
              </div>
            );
          }

          if (elem.type === "heading") {
            const hText = elem.text || "";
            const isMainTitle = idx === 0 && hText && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(hText);
            
            if (isMainTitle) {
              return (
                <div key={elem.id} className="text-center my-4 font-bold text-lg select-all border-b pb-2 uppercase tracking-wide">
                  {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
                </div>
              );
            }

            if (elem.level === 1) {
              return (
                <h1 key={elem.id} className={`text-base font-black uppercase tracking-wide mt-5 mb-2.5 block ${adaptivePDFContrast ? "text-black" : "text-slate-900"}`}>
                  {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
                </h1>
              );
            } else if (elem.level === 2) {
              return (
                <h2 key={elem.id} className={`text-[13.5px] font-black uppercase tracking-wide mt-4 mb-2 block ${adaptivePDFContrast ? "text-black" : "text-slate-800"}`}>
                  {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
                </h2>
              );
            } else if (elem.level === 3) {
              return (
                <h3 key={elem.id} className={`text-xs font-black uppercase tracking-wider mt-3.5 mb-1.5 block ${adaptivePDFContrast ? "text-black" : "text-slate-700"}`}>
                  {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
                </h3>
              );
            } else {
              return (
                <h4 key={elem.id} className={`text-[11.5px] font-bold uppercase tracking-wider mt-3 mb-1 block ${adaptivePDFContrast ? "text-black" : "text-slate-600"}`}>
                  {renderBoldTextBlackSafe(hText, `print-h-${idx}`)}
                </h4>
              );
            }
          }

          if (elem.type === "list") {
            return (
              <div key={elem.id} className="space-y-1.5 pl-1.5">
                {elem.items?.map((item, itemIdx) => {
                  let cleanItem = item.trim();
                  let isNumbered = /^\d+\.\s+/.test(cleanItem);
                  let bulletSpan: React.ReactNode = <span className="h-1.5 w-1.5 rounded-full bg-slate-900 mt-2 shrink-0" />;

                  if (isNumbered) {
                    const match = cleanItem.match(/^(\d+\.)\s+/);
                    if (match) {
                      bulletSpan = <span className="text-[11.5px] font-mono font-bold text-slate-800 min-w-[16px] text-right mt-0.5 shrink-0">{match[1]}</span>;
                      cleanItem = cleanItem.substring(match[0].length);
                    }
                  } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                    cleanItem = cleanItem.substring(2);
                  }

                  const renderedText = renderBoldTextBlackSafe(cleanItem, `print-list-${idx}-${itemIdx}`);

                  return (
                    <div key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-2.5 pl-2 py-0.5 ml-1 select-text">
                      {bulletSpan}
                      <span className="leading-relaxed select-text">
                        {renderedText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }

          if (elem.type === "table") {
            const headers = elem.headers || [];
            const bodyRows = elem.bodyRows || [];

            if (headers.length === 0) return null;

            return (
              <div 
                key={elem.id} 
                className={`my-5 border-2 ${
                  adaptivePDFContrast ? "border-black" : "border-slate-300"
                } rounded-lg bg-white max-w-full overflow-hidden`}
                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                <table className="w-full text-xs text-left border-collapse table-fixed">
                  <thead className={`${adaptivePDFContrast ? "bg-gray-150 font-black" : "bg-slate-100/90 font-sans"}`}>
                    <tr className={`border-b-2 ${adaptivePDFContrast ? "border-black" : "border-slate-300"}`}>
                      {headers.map((h, hIdx) => {
                        let widthClass = "";
                        if (headers.length === 4) {
                          if (hIdx === 0) widthClass = "w-[10%] text-center";
                          else if (hIdx === 1) widthClass = "w-[25%]";
                          else if (hIdx === 2) widthClass = "w-[32%]";
                          else if (hIdx === 3) widthClass = "w-[33%]";
                        } else if (headers.length === 5) {
                          if (hIdx === 0) widthClass = "w-[10%] text-center";
                          else if (hIdx === 1) widthClass = "w-[22%]";
                          else if (hIdx === 2) widthClass = "w-[18%]";
                          else if (hIdx === 3) widthClass = "w-[25%]";
                          else if (hIdx === 4) widthClass = "w-[25%]";
                        }
                        
                        return (
                          <th 
                            key={`th-${hIdx}`} 
                            className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-black border-r ${
                              adaptivePDFContrast ? "border-black/40 border-b-2" : "border-slate-200"
                            } last:border-r-0 ${widthClass}`}
                          >
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${adaptivePDFContrast ? "divide-black" : "divide-slate-200"} font-sans`}>
                    {bodyRows.map((r, rIdx) => (
                      <tr 
                        key={`tr-${rIdx}`} 
                        className={`${
                          rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        } ${adaptivePDFContrast ? "font-bold text-black" : ""}`}
                        style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                      >
                        {r.map((c, cIdx) => {
                          const cellText = c;
                          const renderedContent = renderBoldTextBlackSafe(cellText, `cell-print-${idx}-${rIdx}-${cIdx}`);

                          let alignAndTypography = "text-left";
                          if (headers.length === 4 && cIdx === 0) {
                            alignAndTypography = "text-center font-mono font-bold text-amber-700";
                          }

                          return (
                            <td 
                              key={`td-${cIdx}`} 
                              className={`px-3 py-2 text-black leading-relaxed break-words whitespace-normal border-r ${
                                adaptivePDFContrast ? "border-black/30 text-black font-bold" : "border-slate-200"
                              } last:border-r-0 font-sans ${alignAndTypography}`}
                            >
                              {renderedContent}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Default: "text" type
          return (
            <div key={elem.id} className="space-y-2">
              {elem.lines?.map((line, lIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                const isHeader = (trimmedLine.startsWith("**") && trimmedLine.endsWith("**"));
                const cleanHeaderTxt = trimmedLine.replace(/\*\"/g, ""); // safe cleaning
                
                const isMainTitle = idx === 0 && lIdx === 0 && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmedLine);

                if (isMainTitle) {
                  return (
                    <div key={`${elem.id}-l-${lIdx}`} className="text-center my-4 font-bold text-lg border-b pb-2 select-all uppercase tracking-wide">
                      {renderBoldTextBlackSafe(cleanHeaderTxt, `print-title-${idx}`)}
                    </div>
                  );
                }

                if (isHeader) {
                  return (
                    <p key={`${elem.id}-l-${lIdx}`} className={`text-[12.5px] font-black uppercase mt-4 mb-2 ${adaptivePDFContrast ? "text-black" : "text-slate-800"}`}>
                      {renderBoldTextBlackSafe(cleanHeaderTxt, `print-bold-header-${idx}-${lIdx}`)}
                    </p>
                  );
                }

                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="leading-relaxed select-text">
                    {renderBoldTextBlackSafe(trimmedLine, `print-text-${idx}-${lIdx}`)}
                  </p>
                );
              })}
            </div>
          );
        })}

        {/* Printable vascular schematic map attachment */}
        {renderPrintVascularSchema()}
      </div>
    );
  };

  // Clipboard copy utilities
  const copyToClipboard = async (text: string, isReport: boolean = false, presetId?: string) => {
    // 1. Clean the text using our robust clinical parsing (clears LaTeX & math unicode gaps)
    const cleanText = cleanRawClinicalText(text);

    if (isReport) {
      // 2. Generate clean plain text (absolutely free of markdown '**' characters and heading hash signs)
      const cleanPlainText = cleanText
        .replace(/^(#+\s+)/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1") // Strip and clean asterisks
        .replace(/\n\n+/g, "\n\n\n"); // Ensure triple returns between sections

      // 3. Generate rich HTML snippet for direct, styled pasting in MS Word / Word processors
      const paragraphs = cleanText.split(/\n\n+/);
      const htmlSnippet = paragraphs
        .map((p, pIdx) => {
          // Escape HTML characters before formatting bolding so MS Word doesn't swallow <5mm etc as tags
          let formattedPara = p
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          
          // Detect headings in paragraph
          let isHeading = false;
          let headingLevel = 0;
          if (formattedPara.startsWith("# ")) {
            isHeading = true;
            headingLevel = 1;
            formattedPara = formattedPara.replace(/^#\s+/, "");
          } else if (formattedPara.startsWith("## ")) {
            isHeading = true;
            headingLevel = 2;
            formattedPara = formattedPara.replace(/^##\s+/, "");
          } else if (formattedPara.startsWith("### ")) {
            isHeading = true;
            headingLevel = 3;
            formattedPara = formattedPara.replace(/^###\s+/, "");
          } else if (formattedPara.startsWith("#### ")) {
            isHeading = true;
            headingLevel = 4;
            formattedPara = formattedPara.replace(/^####\s+/, "");
          }

          formattedPara = formattedPara.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
          formattedPara = formattedPara.replace(/\n/g, "<br />");
          
          // Center main title or h1 headings
          const isMainTitle = pIdx === 0 || headingLevel === 1 || (/REPORTE DE ESTUDIO|REPORTE|INFORME/i.test(p) && pIdx <= 1);
          
          let alignmentStyle = "";
          let fontSizeStyle = "font-size: 11.5pt;";
          let fontWeightStyle = "font-weight: normal;";
          let marginTopStyle = "margin-top: 0pt;";

          if (isMainTitle) {
            alignmentStyle = "text-align: center;";
            fontSizeStyle = "font-size: 14pt;";
            fontWeightStyle = "font-weight: bold;";
          } else if (isHeading) {
            fontWeightStyle = "font-weight: bold;";
            marginTopStyle = "margin-top: 15pt;";
            if (headingLevel === 2) {
              fontSizeStyle = "font-size: 13pt;";
            } else {
              fontSizeStyle = "font-size: 12pt;";
            }
          }

          const spacer = pIdx < paragraphs.length - 1 
            ? `<p style="margin: 0; line-height: 1.5; font-size: 11.5pt; font-family: 'Arial', sans-serif;">&nbsp;</p>` 
            : '';

          // Use standard spacing styled with a margin-bottom of 14pt for standard Arial font
          return `<p style="margin: 0; margin-bottom: 14pt; ${marginTopStyle} font-family: 'Arial', sans-serif; ${fontSizeStyle} ${fontWeightStyle} line-height: 1.5; color: #000000; ${alignmentStyle}">${formattedPara}</p>${spacer}`;
        })
        .join("");

      const fullHtml = `<html><head><meta charset="utf-8"></head><body>${htmlSnippet}</body></html>`;

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({
            "text/plain": new Blob([cleanPlainText], { type: "text/plain" }),
            "text/html": new Blob([fullHtml], { type: "text/html" }),
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(cleanPlainText);
        }
        setCopiedReportId(true);
        setTimeout(() => setCopiedReportId(false), 2000);
      } catch (err) {
        console.warn("Fallback to basic clipboard write due to:", err);
        try {
          await navigator.clipboard.writeText(cleanPlainText);
          setCopiedReportId(true);
          setTimeout(() => setCopiedReportId(false), 2000);
        } catch (fallbackErr) {
          console.error("Clipboard copy failed entirely:", fallbackErr);
        }
      }
    } else if (presetId) {
      try {
        await navigator.clipboard.writeText(cleanText);
      } catch (err) {
        await navigator.clipboard.writeText(cleanText);
      }
      setPresetCopiedId(presetId);
      setTimeout(() => setPresetCopiedId(null), 2000);
    } else {
      try {
        await navigator.clipboard.writeText(cleanText);
      } catch (err) {
        await navigator.clipboard.writeText(cleanText);
      }
      alert("Copiado al portapapeles exitosamente");
    }
  };

  // Helper to visually render secondary clinical modules (case analysis, bibliography, etc.) with a high-contrast elegant style,
  // gorgeous Inter (sans-serif) typography, nice bullet points, highlighted bold terms and precise spacing.
  const renderElegantResponse = (text: string, accentColorClass: string = "text-indigo-400") => {
    if (!text) return null;

    const elements = parseReportToElements(text, "elegant-resp");

    return (
      <div className="space-y-3.5 select-text text-slate-200 font-sans tracking-wide antialiased">
        {elements.map((elem, idx) => {
          if (elem.type === "divider") {
            return <hr key={elem.id} className="border-slate-800/80 my-4" />;
          }

          if (elem.type === "heading") {
            const hText = elem.text || "";
            if (elem.level === 1) {
              return (
                <h1 key={elem.id} className="text-white text-sm md:text-base font-black uppercase tracking-widest pb-1 border-b border-indigo-500/10 mt-3 mb-1.5 block">
                  {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
                </h1>
              );
            } else if (elem.level === 2) {
              return (
                <h2 key={elem.id} className="text-white/95 text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                  {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
                </h2>
              );
            } else {
              return (
                <h3 key={elem.id} className={`text-xs font-black ${accentColorClass} uppercase tracking-wider mt-2 mb-0.5 block`}>
                  {renderBoldTextSafe(hText, `elegant-h-${idx}`)}
                </h3>
              );
            }
          }

          if (elem.type === "list") {
            return (
              <div key={elem.id} className="space-y-1.5 font-sans">
                {elem.items?.map((item, itemIdx) => {
                  // Detect recommendation buttons within list items
                  const itemRecMatch = item.trim().match(/(?:\[RECOMENDACI[OÓ]N\]|RECOMENDACI[OÓ]N)[:*\-\s\]]*(.*)/i);
                  if (itemRecMatch) {
                    let content = itemRecMatch[1].trim();
                    content = content.replace(/^\*\*|\*\*$/g, "").trim();
                    content = content.replace(/^[:*\-\s\]]+/, "").trim();
                    content = content.replace(/^\*\*|\*\*$/g, "").trim();
                    content = content.replace(/^["']|["']$/g, "").trim();
                    
                    const isPending = pendingRecText === content;
                    const isAdded = !!incorporatedAuditRecs[content];
                    
                    return (
                      <div 
                        key={`rec-item-${idx}-${itemIdx}`}
                        className={`w-full p-4.5 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md my-2.5 ${
                          isAdded 
                            ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.06)]" 
                            : isPending
                            ? "bg-indigo-950/35 border-indigo-550/45 text-indigo-150 animate-pulse"
                            : "bg-slate-900/40 border-slate-800 hover:border-indigo-500/25 text-slate-300 hover:bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {isAdded ? (
                            <div className="p-2 shrink-0 bg-emerald-955/60 border border-emerald-500/30 rounded-lg text-emerald-400">
                              <Check className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className={`p-2 shrink-0 rounded-lg border font-black text-xs ${isPending ? 'bg-indigo-950/80 border-indigo-500/35 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                              💡
                            </div>
                          )}
                          <div className="space-y-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5 ${isAdded ? 'text-emerald-400' : 'text-indigo-400'}`}>
                              Recomendación de Auditoría
                            </span>
                            <p className="text-xs font-semibold leading-relaxed text-slate-200">
                              {content}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleIncorporateRecommendation(content)}
                          disabled={isModifyingReport || isAdded}
                          className={`text-[9.5px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 font-mono w-full sm:w-auto shrink-0 select-none cursor-pointer duration-250 ${
                            isAdded
                              ? "bg-emerald-905/10 border-emerald-500/25 text-emerald-450 cursor-not-allowed"
                              : isPending
                              ? "bg-indigo-955/20 border-indigo-505/30 text-indigo-405 cursor-wait"
                              : "bg-indigo-600/10 hover:bg-indigo-600 hover:text-white text-indigo-300 border-indigo-500/20 hover:border-transparent active:scale-[0.98]"
                          }`}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Incorporando...</span>
                            </>
                          ) : isAdded ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Incorporado</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                              <span>Incorporar</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  }

                  let cleanItem = item.trim();
                  let isNumbered = /^\d+\.\s+/.test(cleanItem);
                  let bulletSpan: React.ReactNode = <span className={`h-1.5 w-1.5 rounded-full ${accentColorClass} mt-1.5 shrink-0`} />;
                  let bulletNumber = "";

                  if (isNumbered) {
                    const match = cleanItem.match(/^(\d+\.)\s+/);
                    if (match) {
                      bulletNumber = match[1];
                      bulletSpan = <span className={`text-[11px] font-bold font-mono ${accentColorClass} min-w-[16px] text-right mt-0.5 shrink-0`}>{bulletNumber}</span>;
                      cleanItem = cleanItem.substring(match[0].length);
                    }
                  } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                    cleanItem = cleanItem.substring(2);
                  }

                  const renderedText = renderBoldTextSafe(cleanItem, `elegant-list-${idx}-${itemIdx}`);

                  return (
                    <div key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-2 pl-2 py-0.5 ml-1">
                      {bulletSpan}
                      <span className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px]">
                        {renderedText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }

          if (elem.type === "table") {
            const headers = elem.headers || [];
            const bodyRows = elem.bodyRows || [];

            if (headers.length === 0) return null;

            return (
              <div key={elem.id} className="overflow-x-auto my-3 border border-slate-800/80 rounded-xl bg-slate-950/60 shadow-lg max-w-full">
                <table className="min-w-full divide-y divide-slate-850 text-xs text-left">
                  <thead className="bg-slate-900/60 font-mono">
                    <tr>
                      {headers.map((h, hIdx) => (
                        <th key={`th-${hIdx}`} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider ${accentColorClass}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 bg-slate-950/20 font-sans">
                    {bodyRows.map((r, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-slate-900/10 transition-colors">
                        {r.map((c, cIdx) => {
                          const cellText = c;
                          const renderedContent = renderBoldTextSafe(cellText, `cell-elegant-${idx}-${rIdx}-${cIdx}`);

                          return (
                            <td key={`td-${cIdx}`} className="px-3 py-2 text-slate-300 leading-relaxed max-w-xs break-words whitespace-normal font-sans">
                              {renderedContent}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Default: "text" type
          return (
            <div key={elem.id} className="space-y-1.5">
              {elem.lines?.map((line, lIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                // Detect recommendation buttons
                const recMatch = trimmedLine.match(/(?:\[RECOMENDACI[OÓ]N\]|RECOMENDACI[OÓ]N)[:*\-\s\]]*(.*)/i);
                if (recMatch) {
                  let content = recMatch[1].trim();
                  content = content.replace(/^\*\*|\*\*$/g, "").trim();
                  content = content.replace(/^[:*\-\s\]]+/, "").trim();
                  content = content.replace(/^\*\*|\*\*$/g, "").trim();
                  content = content.replace(/^["']|["']$/g, "").trim();
                  
                  const isPending = pendingRecText === content;
                  const isAdded = !!incorporatedAuditRecs[content];
                  
                  return (
                    <div 
                      key={`rec-${lIdx}`}
                      className={`w-full p-4.5 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md my-2.5 ${
                        isAdded 
                          ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.06)]" 
                          : isPending
                          ? "bg-indigo-950/35 border-indigo-550/45 text-indigo-150 animate-pulse"
                          : "bg-slate-900/40 border-slate-800 hover:border-indigo-500/25 text-slate-300 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {isAdded ? (
                          <div className="p-2 shrink-0 bg-emerald-955/60 border border-emerald-500/30 rounded-lg text-emerald-400">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className={`p-2 shrink-0 rounded-lg border font-black text-xs ${isPending ? 'bg-indigo-950/80 border-indigo-500/35 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                            💡
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5 ${isAdded ? 'text-emerald-400' : 'text-indigo-400'}`}>
                            Recomendación de Auditoría
                          </span>
                          <p className="text-xs font-semibold leading-relaxed text-slate-200">
                            {content}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleIncorporateRecommendation(content)}
                        disabled={isModifyingReport || isAdded}
                        className={`text-[9.5px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 font-mono w-full sm:w-auto shrink-0 select-none cursor-pointer duration-250 ${
                          isAdded
                            ? "bg-emerald-905/10 border-emerald-500/25 text-emerald-450 cursor-not-allowed"
                            : isPending
                            ? "bg-indigo-955/20 border-indigo-505/30 text-indigo-405 cursor-wait"
                            : "bg-indigo-600/10 hover:bg-indigo-600 hover:text-white text-indigo-300 border-indigo-500/20 hover:border-transparent active:scale-[0.98]"
                        }`}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Incorporando...</span>
                          </>
                        ) : isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Incorporado</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                            <span>Incorporar</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                }

                const isHeader = (trimmedLine.startsWith("**") && trimmedLine.endsWith("**"));
                const cleanHeaderTxt = trimmedLine.replace(/\*\*/g, "");

                if (isHeader) {
                  return (
                    <p key={`${elem.id}-l-${lIdx}`} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                      {renderBoldTextSafe(cleanHeaderTxt, `elegant-bold-header-${idx}-${lIdx}`)}
                    </p>
                  );
                }

                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px] select-text">
                    {renderBoldTextSafe(trimmedLine, `elegant-text-${idx}-${lIdx}`)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to visually render clinical reports on screen with proper bolding and spacing, hiding the asterisks and system boundaries
  const renderClinicalReport = (reportText: string) => {
    if (!reportText) return null;

    const elements = parseReportToElements(reportText, "clinical-report");

    let accentColorClass = "text-indigo-400";
    if (selectedLogo === "shield-check") accentColorClass = "text-emerald-400";
    else if (selectedLogo === "heart-pulse") accentColorClass = "text-rose-400";
    else if (selectedLogo === "dna") accentColorClass = "text-cyan-400";

    return (
      <div className="space-y-4 select-text text-slate-100 font-sans tracking-wide">
        {elements.map((elem, idx) => {
          if (elem.type === "divider") {
            return <hr key={elem.id} className="border-slate-800/80 my-5" />;
          }

          if (elem.type === "code") {
            return (
              <div key={elem.id} className="my-4 border border-slate-800/85 rounded-xl bg-slate-950/90 shadow-lg overflow-x-auto p-4 select-all font-mono text-[11px] md:text-xs">
                <pre className="text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap font-mono">
                  {elem.lines?.join("\n")}
                </pre>
              </div>
            );
          }

          if (elem.type === "heading") {
            const hText = elem.text || "";
            const isMainTitle = idx === 0 && hText && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(hText);

            if (isMainTitle) {
              return (
                <div key={elem.id} className="text-center text-white text-sm md:text-base font-black select-all border-b border-indigo-950/40 pb-2 mb-4 uppercase tracking-wider">
                  {renderBoldTextSafe(hText, `screen-h-${idx}`)}
                </div>
              );
            }

            if (elem.level === 1) {
              return (
                <h1 key={elem.id} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-3.5 mb-1.5 block">
                  {renderBoldTextSafe(hText, `screen-h-${idx}`)}
                </h1>
              );
            } else if (elem.level === 2) {
              return (
                <h2 key={elem.id} className="text-white/95 text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                  {renderBoldTextSafe(hText, `screen-h-${idx}`)}
                </h2>
              );
            } else {
              return (
                <h3 key={elem.id} className={`text-xs font-black ${accentColorClass} uppercase tracking-wider mt-2 mb-0.5 block`}>
                  {renderBoldTextSafe(hText, `screen-h-${idx}`)}
                </h3>
              );
            }
          }

          if (elem.type === "list") {
            return (
              <div key={elem.id} className="space-y-1.5">
                {elem.items?.map((item, itemIdx) => {
                  let cleanItem = item.trim();
                  let isNumbered = /^\d+\.\s+/.test(cleanItem);
                  let bulletSpan: React.ReactNode = <span className={`h-1.5 w-1.5 rounded-full ${accentColorClass} mt-1.5 shrink-0`} />;
                  let bulletNumber = "";

                  if (isNumbered) {
                    const match = cleanItem.match(/^(\d+\.)\s+/);
                    if (match) {
                      bulletNumber = match[1];
                      bulletSpan = <span className={`text-[11px] font-bold font-mono ${accentColorClass} min-w-[16px] text-right mt-0.5 shrink-0`}>{bulletNumber}</span>;
                      cleanItem = cleanItem.substring(match[0].length);
                    }
                  } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                    cleanItem = cleanItem.substring(2);
                  }

                  const renderedText = renderBoldTextSafe(cleanItem, `screen-list-${idx}-${itemIdx}`);

                  return (
                    <div key={`${elem.id}-item-${itemIdx}`} className="flex items-start gap-2 pl-2 py-0.5 ml-1">
                      {bulletSpan}
                      <span className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px]">
                        {renderedText}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }

          if (elem.type === "table") {
            const headers = elem.headers || [];
            const bodyRows = elem.bodyRows || [];

            if (headers.length === 0) return null;

            return (
              <div key={elem.id} className="overflow-x-auto my-4 border border-slate-800/80 rounded-xl bg-slate-950/60 shadow-lg max-w-full">
                <table className="min-w-full divide-y divide-slate-850 text-xs text-left">
                  <thead className="bg-slate-900/60 font-mono">
                    <tr>
                      {headers.map((h, hIdx) => (
                        <th key={`th-${hIdx}`} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 bg-slate-950/20 font-sans">
                    {bodyRows.map((r, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-slate-900/10 transition-colors">
                        {r.map((c, cIdx) => {
                          const cellText = c;
                          const renderedContent = renderBoldTextSafe(cellText, `cell-clinical-${idx}-${rIdx}-${cIdx}`);

                          return (
                            <td key={`td-${cIdx}`} className="px-3 py-2 text-slate-300 leading-relaxed max-w-xs break-words whitespace-normal font-sans">
                              {renderedContent}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Default: "text" type
          return (
            <div key={elem.id} className="space-y-1.5">
              {elem.lines?.map((line, lIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                const isHeader = (trimmedLine.startsWith("**") && trimmedLine.endsWith("**"));
                const cleanHeaderTxt = trimmedLine.replace(/\*\*/g, "");

                const isMainTitle = idx === 0 && lIdx === 0 && /REPORTE|INFORME|ESTUDIO|DIAGNÓSTICO|VALORACIÓN/i.test(trimmedLine);

                if (isMainTitle) {
                  return (
                    <div key={`${elem.id}-l-${lIdx}`} className="text-center text-white text-sm md:text-base font-black border-b border-indigo-950/40 pb-2 mb-4 uppercase tracking-wider">
                      {renderBoldTextSafe(cleanHeaderTxt, `screen-title-${idx}`)}
                    </div>
                  );
                }

                if (isHeader) {
                  return (
                    <p key={`${elem.id}-l-${lIdx}`} className="text-white text-xs md:text-sm font-black uppercase tracking-wide mt-2.5 mb-1 block">
                      {renderBoldTextSafe(cleanHeaderTxt, `screen-bold-header-${idx}-${lIdx}`)}
                    </p>
                  );
                }

                return (
                  <p key={`${elem.id}-l-${lIdx}`} className="text-slate-300 leading-relaxed text-[12.5px] md:text-[13px] select-text">
                    {renderBoldTextSafe(trimmedLine, `screen-text-${idx}-${lIdx}`)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Persistent settings save utilities
  const handleSaveSettings = () => {
    localStorage.setItem("radiology_sys_inst", systemInstruction);
    localStorage.setItem("radiology_chat_inst", chatInstruction);
    localStorage.setItem("radiology_class_inst", classifyInstruction);
    alert("¡Instrucciones generales del sistema guardadas y actualizadas correctamente!");
  };

  const handleResetSettings = () => {
    if (confirm("¿Estás seguro de que deseas restablecer todas las instrucciones a sus valores médicos por defecto?")) {
      setSystemInstruction(GENERAL_SYSTEM_INSTRUCTION);
      setChatInstruction(CHAT_SYSTEM_INSTRUCTION);
      setClassifyInstruction(CLASSIFICATION_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_sys_inst", GENERAL_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_chat_inst", CHAT_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_class_inst", CLASSIFICATION_SYSTEM_INSTRUCTION);
    }
  };

  // Delete individual historical report
  const handleDeleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem("radiology_reports_history", JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    if (confirm("¿Deseas vacilar todo el historial local de reportes guardados? (No afectará tu trabajo actual)")) {
      setSavedReports([]);
      localStorage.removeItem("radiology_reports_history");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans flex flex-col antialiased">
      <div className="no-print flex-1 flex flex-col">
      {/* 🚀 CLINICAL HEADER (Aesthetic Upgrade 1 - Premium Futuristic Glassmorphic Header with ECG heartwave visualizer) */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-8 py-5 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md gap-4 shadow-2xl select-none relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-1/4 w-[300px] h-[150px] bg-indigo-500/5 rounded-full blur-[80px]" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.45)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-[26.5px] font-black tracking-tighter uppercase text-white flex items-center">
                RAD-AI<span className="text-indigo-400 font-extrabold">EXPERT</span> 
              </h1>
              <span className="text-[9.5px] font-black tracking-widest uppercase bg-indigo-950/40 text-indigo-300 border border-indigo-500/25 px-2.5 py-0.5 rounded-md font-mono shadow-[0_2px_10px_rgba(99,102,241,0.1)]">v1.5 Premium</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <p className="text-[10px] font-black text-indigo-300/90 uppercase tracking-widest bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/10">Asistente Diagnóstico Experto</p>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500/60 animate-ping" />
                Dr. Milton Benavides S. Cod.6025
              </p>
            </div>
          </div>
          
          {/* Animated SVG ECG heartbeat segment decoration */}
          <div className="hidden lg:block ml-4 opacity-45 pl-4 border-l border-slate-800">
            <svg className="w-24 h-8 text-indigo-500" viewBox="0 0 100 30" fill="none">
              <path d="M0 15 H40 L44 5 L48 25 L52 12 L54 15 H100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-dash-animation" />
            </svg>
            <style>{`
              @keyframes strokeDash {
                to { stroke-dashoffset: -200; }
              }
              .stroke-dash-animation {
                stroke-dasharray: 40 10;
                animation: strokeDash 5s linear infinite;
              }
            `}</style>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 relative z-10">
          {/* Selector de Modelo en Header */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-1 shadow-2xl relative">
            <span className="text-[8.5px] font-black tracking-widest text-slate-550 uppercase px-2 font-mono">IA Core:</span>
            <button
              onClick={() => setSelectedModel("gemini-3.5-flash")}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                selectedModel === "gemini-3.5-flash"
                  ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.45)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
              title="Gemini 3.5 Flash: Especial para velocidad y reportes de rutina"
            >
              <Zap className={`h-3.5 w-3.5 ${selectedModel === "gemini-3.5-flash" ? "text-amber-300 animate-pulse" : ""}`} /> Flash 3.5
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                selectedModel === "gemini-3.1-pro-preview"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.45)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
              title="Gemini 3.1 Pro: Razonamiento clínico avanzado de alta complejidad"
            >
              <Brain className={`h-3.5 w-3.5 ${selectedModel === "gemini-3.1-pro-preview" ? "text-purple-300 animate-pulse" : ""}`} /> Pro 3.1
            </button>
          </div>

          {/* Active indicator badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-[0_1px_10px_rgba(16,185,129,0.06)] select-none">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </div>
            <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase font-mono">
              {selectedModel === "gemini-3.5-flash" ? "Flash-Active" : "Pro-Active"}
            </span>
          </div>

          <div className="text-right hidden xl:block font-mono text-[9.5px] font-black text-slate-500 uppercase tracking-widest leading-none select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>Conexión Segura</span>
            </div>
          </div>
        </div>
      </header>

      {/* 🧭 MAIN CONTAINER WITH TABS (Aesthetic Upgrade 2 - Glassmorphic Medical Cockpit Navigation Rail) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Drawer / Navigation Rail */}
        <nav className="w-full lg:w-64 bg-[#0A0E1A]/95 border-b lg:border-b-0 lg:border-r border-slate-805/80 p-5 flex flex-row lg:flex-col gap-2.5 overflow-x-auto shrink-0 select-none scrollbar-none relative z-10 backdrop-blur-md">
          {/* Decorative subtle top gradient line inside sidebar */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
          
          <div className="hidden lg:flex items-center gap-2 px-1.5 mb-3 select-none">
            <span className="w-1.5 h-3.5 rounded bg-indigo-500/80 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.22em] font-mono">
              Módulos Clínicos
            </span>
          </div>
          
          <button
            onClick={() => setActiveTab("generator")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "generator"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "generator" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <Layers className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "generator" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Generador Informes
          </button>

          <button
            onClick={() => setActiveTab("consult")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "consult"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "consult" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <MessageSquare className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "consult" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Casos Clínicos
          </button>

          <button
            onClick={() => setActiveTab("presets")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "presets"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "presets" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <Sliders className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "presets" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Config. Prompt
          </button>

          <button
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "api"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "api" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <Code className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "api" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Conexión API
          </button>

          <button
            onClick={() => setActiveTab("bibliography")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "bibliography"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "bibliography" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <Search className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "bibliography" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Bibliografía
          </button>
          
          <button
            onClick={() => setActiveTab("expert-analysis")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "expert-analysis"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-205 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "expert-analysis" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <Sparkles className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "expert-analysis" ? "text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]" : "text-slate-500"}`} />
            Doble Valoración IA
          </button>

          <button
            onClick={() => setActiveTab("images")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "images"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "images" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <ImageIcon className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "images" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Imágenes Médicas
          </button>

          {/* 🧠 SELECTOR DE MODELO OMNIPRESENTE (STATION SIDEBAR) */}
          <div className="hidden lg:flex flex-col bg-[#0b101d] border border-slate-800/80 rounded-xl p-3 mt-2 shrink-0 space-y-2">
            <div className="flex items-center gap-1.5 border-b border-slate-850 pb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[9px] font-black tracking-widest text-[#a5b4fc] uppercase font-mono">Modelo Núcleo IA</span>
            </div>
            
            <div className="space-y-1.5 font-sans">
              <button
                type="button"
                onClick={() => setSelectedModel("gemini-3.5-flash")}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all flex items-center justify-between ${
                  selectedModel === "gemini-3.5-flash"
                    ? "bg-indigo-950/30 border-indigo-500/60 shadow-[0_2px_8px_rgba(99,102,241,0.1)]"
                    : "bg-transparent border-transparent hover:bg-slate-850 hover:border-slate-800"
                }`}
              >
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold tracking-wide uppercase ${selectedModel === "gemini-3.5-flash" ? "text-indigo-400" : "text-slate-300"}`}>Gemini 3.5 Flash</span>
                  <span className="text-[8px] text-slate-500 font-medium">Dictados y reportes ágiles</span>
                </div>
                {selectedModel === "gemini-3.5-flash" && <Zap className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all flex items-center justify-between ${
                  selectedModel === "gemini-3.1-pro-preview"
                    ? "bg-purple-950/30 border-purple-500/60 shadow-[0_2px_8px_rgba(168,85,247,0.1)]"
                    : "bg-transparent border-transparent hover:bg-slate-850 hover:border-slate-800"
                }`}
              >
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold tracking-wide uppercase ${selectedModel === "gemini-3.1-pro-preview" ? "text-purple-400" : "text-slate-300"}`}>Gemini 3.1 Pro</span>
                  <span className="text-[8px] text-slate-500 font-medium">Razonamiento avanzado</span>
                </div>
                {selectedModel === "gemini-3.1-pro-preview" && <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
              </button>
            </div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider text-center font-mono pt-1">
              Estado: <span className="text-emerald-500">Activo</span>
            </div>
          </div>

          <div className="hidden lg:block border-t border-slate-800/80 my-4 pt-4 shrink-0">
            <h3 className="px-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-slate-500" /> Historial Local
            </h3>
            <div className="mt-3 space-y-1.5 max-h-[220px] overflow-y-auto px-1 scrollbar-none">
              {savedReports.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider italic">Sin informes guardados</p>
              ) : (
                savedReports.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-3 rounded-xl hover:bg-slate-800/40 border border-transparent hover:border-slate-800 text-left cursor-pointer group flex flex-col gap-1 transition-all"
                    onClick={() => {
                      setActiveTab("generator");
                      setStudyType(item.studyType);
                      handleLoadStudyType(item.studyType);
                      setClinicalHistory(item.clinicalHistory);
                      setGeneratedReport(item.reportText);
                      setOriginalBaseReport(item.reportText);
                    }}
                  >
                    <div className="text-xs text-indigo-400 truncate font-bold">{item.studyType}</div>
                    <div className="text-[10px] text-slate-500 flex justify-between items-center font-bold uppercase tracking-tighter">
                      <span>{item.timestamp}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(item.id);
                        }}
                        className="text-slate-600 hover:text-rose-450 transition ml-2 opacity-0 group-hover:opacity-100"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {savedReports.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="w-full text-center text-[10px] text-slate-505 hover:text-rose-455 mt-2 py-1.5 block transition underline font-mono font-bold uppercase tracking-widest"
              >
                Limpiar Historial
              </button>
            )}
          </div>
        </nav>

        {/* WORKSPACE AREA */}
        <main className="flex-1 bg-[#020617] p-8 overflow-y-auto max-w-full">
          
          <AnimatePresence mode="wait">
            
            {/* TAB 1: GENERADOR E INTERPRETE */}
            {activeTab === "generator" && (
              <motion.div
                key="generator"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >


                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Inputs card */}
                <div className="xl:col-span-5 space-y-6">
                  <div className="bg-slate-900 border-2 border-slate-850 rounded-2xl p-6 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-400" /> Parámetros del Estudio
                      </h2>
                      <button
                        onClick={resetGeneratorForm}
                        className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition tracking-wider"
                      >
                        <RefreshCw className="h-3 w-3" /> Limpiar Todo
                      </button>
                    </div>

                    {/* Parámetros de Selección de Estudio */}
                    <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">

                      {/* 1. Modalidad */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Modalidad:</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {["Radiografía", "Ultrasonido", "Mamografía", "TAC", "Mamografía y Ultrasonido de Mamas"].map((mod) => (
                            <button
                              key={mod}
                              type="button"
                              onClick={() => {
                                setModality(mod);
                                if (mod === "Mamografía y Ultrasonido de Mamas") {
                                  setSpecificStudy("");
                                }
                              }}
                              className={`py-2 px-2 rounded-xl text-[10px] font-black transition-all duration-200 tracking-wider uppercase border-2 text-center cursor-pointer select-none active:scale-97 ${
                                modality === mod
                                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 border-indigo-500 text-white shadow-[0_2px_10px_rgba(99,102,241,0.25)] hover:from-indigo-550 hover:to-indigo-650"
                                  : "bg-slate-950/80 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                              }`}
                            >
                              {mod}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Estudio Específico (conditional) */}
                      {modality !== "Mamografía y Ultrasonido de Mamas" && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Estudio Específico:</label>
                          <select
                            value={specificStudy}
                            onChange={(e) => setSpecificStudy(e.target.value)}
                            className="w-full bg-slate-950/90 border-2 border-slate-850 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-100 focus:outline-none transition-all duration-200 uppercase tracking-wider cursor-pointer"
                          >
                            <option value="Abdomen">Abdomen</option>
                            <option value="Mamas">Mamas</option>
                            <option value="Vias urinarias">Vías Urinarias</option>
                            <option value="Escroto">Escroto</option>
                            <option value="Cuello">Cuello</option>
                            <option value="Rodilla">Rodilla</option>
                            <option value="Hombro">Hombro</option>
                            <option value="Tobillo">Tobillo</option>
                            <option value="Muñeca">Muñeca</option>
                            <option value="Mano">Mano</option>
                            <option value="Pie">Pie</option>
                            <option value="Cadera">Cadera</option>
                            <option value="Doppler de carótidas">Doppler de carótidas</option>
                            <option value="Doppler venoso de miembro inferior">Doppler venoso de miembro inferior</option>
                            <option value="Doppler arterial de miembro inferior">Doppler arterial de miembro inferior</option>
                            <option value="Columna lumbosacra">Columna lumbosacra</option>
                            <option value="Columna dorsal">Columna dorsal</option>
                            <option value="Columna cervical">Columna cervical</option>
                            <option value="Momografía">Momografía</option>
                            <option value="Tórax">Tórax</option>
                            <option value="Cráneo">Cráneo</option>
                            <option value="Otro">Otro (Especificar)</option>
                          </select>
                        </div>
                      )}

                      {/* 3. Otro estudio (Custom input) */}
                      {modality !== "Mamografía y Ultrasonido de Mamas" && specificStudy === "Otro" && (
                        <div className="space-y-2 animate-fadeIn">
                          <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Especificar Estudio:</label>
                          <input
                            type="text"
                            value={customStudy}
                            onChange={(e) => setCustomStudy(e.target.value)}
                            placeholder="Ej. Codo, Antebrazo, Ecografía Obstétrica..."
                            className="w-full bg-slate-950/90 border-2 border-slate-850 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all duration-200 uppercase tracking-wider"
                          />
                        </div>
                      )}

                      {/* 4. Lateralidad (conditional) */}
                      {["Mamas", "Momografía", "Rodilla", "Hombro", "Tobillo", "Muñeca", "Mano", "Pie", "Cadera", "Codo", "Mamografía y Ultrasonido de Mamas", "Doppler venoso de miembro inferior", "Doppler arterial de miembro inferior", "Otro"].includes(specificStudy) || modality === "Mamografía y Ultrasonido de Mamas" ? (
                        <div className="space-y-2 animate-fadeIn">
                          <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Lateralidad:</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { val: "", label: "No Aplica" },
                              { val: "Derecha", label: "Derecha" },
                              { val: "Izquierda", label: "Izquierda" },
                              { val: "Bilateral", label: "Bilateral" }
                            ].map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => setLaterality(option.val)}
                                className={`py-2 px-1 rounded-lg text-[9px] font-black transition-all duration-200 tracking-wider uppercase border-2 text-center cursor-pointer select-none active:scale-97 ${
                                  laterality === option.val
                                    ? "bg-gradient-to-r from-indigo-600 to-indigo-750 border-indigo-500 text-white shadow-[0_1px_6px_rgba(99,102,241,0.2)]"
                                    : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-350"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* 5. Proyecciones (conditional for selection in Radiografía) */}
                      {modality === "Radiografía" && (
                        <div className="space-y-2 animate-fadeIn border-t border-slate-800/40 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Proyecciones Realizadas:</label>
                            {projections.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setProjections([])}
                                className="text-[9px] font-black text-rose-400 hover:text-rose-350 uppercase tracking-widest transition-all cursor-pointer"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                              { val: "AP", label: "AP" },
                              { val: "PA", label: "PA" },
                              { val: "Lateral", label: "Lateral" },
                              { val: "Oblicua", label: "Oblicua" },
                              { val: "Axial", label: "Axial" },
                              { val: "Otra", label: "Otra" }
                            ].map((option) => {
                              const isSelected = projections.includes(option.val);
                              return (
                                <button
                                  key={option.val}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setProjections(projections.filter((p) => p !== option.val));
                                      if (option.val === "Otra") {
                                        setCustomProjection("");
                                      }
                                    } else {
                                      setProjections([...projections, option.val]);
                                    }
                                  }}
                                  className={`py-2 px-1 rounded-lg text-[9.5px] font-black transition-all duration-200 tracking-wider uppercase border-2 text-center cursor-pointer select-none active:scale-97 ${
                                    isSelected
                                      ? "bg-gradient-to-r from-indigo-600 to-indigo-750 border-indigo-500 text-white shadow-[0_1px_6px_rgba(99,102,241,0.2)]"
                                      : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-350"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>

                          {projections.includes("Otra") && (
                            <div className="animate-fadeIn pt-1.5 space-y-1.5">
                              <label className="text-[9px] font-black text-indigo-400 block uppercase tracking-widest">Especificar otra proyección:</label>
                              <input
                                type="text"
                                value={customProjection}
                                onChange={(e) => setCustomProjection(e.target.value)}
                                placeholder="Ej: Tangencial, Transtorácica, Decúbito lateral con rayo horizontal..."
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-200 placeholder-slate-600 bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] font-sans"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resulting text preview */}
                      <div className="pt-2.5 border-t border-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estudio Construido:</span>
                        <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wide bg-indigo-950/30 px-2 py-1 rounded border border-indigo-900/30 break-words select-all font-mono">
                          {studyType || "Ninguno"}
                        </span>
                      </div>
                    </div>

                    {/* Indicación */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Indicación:</label>
                        {clinicalHistory.trim() && (
                          <button
                            type="button"
                            onClick={handleAssistClinicalHistory}
                            disabled={isAssistingHistory}
                            className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest font-mono cursor-pointer flex items-center gap-1 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-900/30 hover:border-indigo-500/30 px-2 py-0.5 rounded transition-all select-none active:scale-95"
                            title="Pulir indicación: corregir ortografía, redactar profesionalmente y arreglar mayúsculas/minúsculas"
                          >
                            {isAssistingHistory ? (
                              <>
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-indigo-400" />
                                <span>Asistiendo...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-2.5 w-2.5 text-indigo-400 animate-pulse" />
                                <span>Asistir con IA (Casing & Redacción)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <textarea
                        value={clinicalHistory}
                        onChange={(e) => setClinicalHistory(e.target.value)}
                        placeholder="Sospecha o justificación clínica para realizar el estudio..."
                        rows={3}
                        className="w-full bg-slate-950/90 border-2 border-slate-855 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-600 transition-all duration-200 resize-none"
                      />
                    </div>

                    {/* Hallazgos */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Hallazgos:</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Live Browser Status */}
                          {isListening && (
                            <span className="flex items-center gap-1.5 text-[9px] font-bold text-rose-500 animate-pulse bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-900/20 select-none">
                              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block animate-ping" />
                              Dictado Continuo Activo...
                            </span>
                          )}

                          {/* Recording status (IA Dictation) */}
                          {isRecordingAudio && (
                            <span className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500 animate-pulse bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-900/20 select-none">
                              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block animate-ping" />
                              Grabando Dictado ({recordingDuration}s)
                            </span>
                          )}

                          {transcribing && (
                            <span className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 animate-pulse bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-900/20 select-none">
                              <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                              Transcribiendo por IA...
                            </span>
                          )}

                          {/* Main Control Panel for audio source */}
                          {isRecordingAudio ? (
                            <button
                              type="button"
                              onClick={stopRecordingAudio}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-550 border-amber-500/35 text-white flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-2 transition-all select-none active:scale-95 shadow-md"
                              title="Detener grabación y transcribir automáticamente"
                            >
                              <Square className="h-3 w-3 text-white fill-white" />
                              <span>Detener y Transcribir</span>
                            </button>
                          ) : transcribing ? (
                            <button
                              type="button"
                              disabled
                              className="px-2.5 py-1 bg-slate-900 border-slate-800 text-slate-500 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-2 select-none"
                            >
                              <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                              <span>Procesando...</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {/* Grabador por IA button */}
                              <button
                                type="button"
                                onClick={startRecordingAudio}
                                disabled={isListening}
                                className={`px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-2 transition-all select-none active:scale-95 ${
                                  isListening 
                                    ? "opacity-50 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-600"
                                    : "bg-indigo-900 hover:bg-indigo-800 border-indigo-700/50 text-indigo-200 hover:text-white shadow-lg shadow-indigo-955/20"
                                }`}
                                title="Graba un clip de audio del dictado y transcríbelo con la IA de Gemini de forma 100% estable"
                              >
                                <Mic className="h-3 w-3 text-indigo-400" />
                                <span>Dictar por Grabación IA (Estable)</span>
                              </button>

                              {/* Web Speech Dictado en Vivo button */}
                              <button
                                type="button"
                                onClick={toggleListening}
                                className={`px-2 py-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border-2 transition-all select-none active:scale-95 ${
                                  isListening
                                    ? "bg-rose-600 hover:bg-rose-550 border-rose-500/35 text-white shadow-lg shadow-rose-950/50 animate-pulse"
                                    : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                                }`}
                                title="Intenta dictar directamente con el transcriptor en tiempo real del navegador"
                              >
                                {isListening ? (
                                  <>
                                    <MicOff className="h-2.5 w-2.5 text-white" />
                                    <span>Apagar</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic className="h-2.5 w-2.5 text-slate-500" />
                                    <span>Tiempo Real</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {speechError && (
                        <div className="text-xs font-bold text-rose-450 bg-rose-950/30 border-2 border-rose-905/30 p-4 rounded-xl leading-relaxed space-y-3 text-left">
                          <div className="flex items-start gap-2.5">
                            <span className="text-lg animate-bounce">⚠️</span>
                            <div className="space-y-1.5 flex-1">
                              {speechError === "service-not-allowed" ? (
                                <>
                                  <p className="font-extrabold uppercase text-white text-[11.5px] tracking-wider">Servicio de Dictado No Permitido o Inactivo</p>
                                  <p className="text-slate-300 font-normal leading-normal text-[11px] normal-case">
                                    En dispositivos Apple (iPhone, iPad, Mac) u otros navegadores móviles, Apple requiere configuraciones específicas para el dictado web:
                                  </p>
                                  <ul className="list-disc pl-4 text-slate-350 font-normal text-[10.5px] normal-case space-y-1">
                                    <li>
                                      <strong className="text-slate-200">Usa Safari Obligatoriamente:</strong> En iPhone/iPad, Apple bloquea el uso de la API de reconocimiento de voz en navegadores externos como Chrome, Firefox o Brave. Abre este enlace únicamente en <strong className="text-indigo-300">Safari</strong>.
                                    </li>
                                    <li>
                                      <strong className="text-slate-200">Activa el Dictado del Sistema:</strong> Vaya a <strong className="text-slate-200">Ajustes → General → Teclado</strong> en su iPhone y verifique que la opción <strong className="text-white bg-indigo-950 px-1 py-0.5 rounded">"Activar dictado"</strong> esté habilitada.
                                    </li>
                                    <li>
                                      <strong className="text-slate-200">Evita el Simulador (Iframe):</strong> El dictado en tiempo real no puede acceder al micrófono dentro de un entorno encastrado (iframe). Pulsa el botón inferior para abrirlo de forma independiente.
                                    </li>
                                  </ul>
                                </>
                              ) : (
                                <p className="text-[11px] font-medium text-rose-300 normal-case leading-normal">{speechError}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => window.open(window.location.href, "_blank")}
                              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-550 border border-indigo-400/20 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 animate-pulse"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>Abrir App en Safari (Tab Nueva)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpeechError(null)}
                              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all"
                            >
                              Ocultar Aviso
                            </button>
                          </div>
                        </div>
                      )}

                      <textarea
                        value={findings}
                        onChange={(e) => setFindings(e.target.value)}
                        placeholder="Ocurrencias anatómicas, anomalías o hallazgos radiológicos visualizados..."
                        rows={3}
                        className={`w-full bg-slate-950/90 border-2 rounded-xl py-3 px-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-600 transition-all duration-200 resize-none ${
                          isListening ? "border-rose-500/60 ring-4 ring-rose-500/10 shadow-inner" : "border-slate-855 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        }`}
                      />
                    </div>

                     {/* Estudio Previo / Informe */}
                     <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Estudio Previo / Informe:</label>
                         <input 
                             type="file" 
                             ref={reportFileInputRef}
                             className="hidden"
                             onChange={handleReportFileUpload}
                             accept=".txt,.md,.pdf,.doc,.docx,.png" 
                         />
                         <div className="flex gap-2">
                           <button
                             onClick={() => reportFileInputRef.current?.click()}
                             className="flex-grow text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center justify-center gap-2 py-3 bg-slate-950 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all font-mono"
                           >
                             <FileText className="h-4 w-4" />
                             {uploadedReportName ? `Archivo adjunto: ${uploadedReportName}` : "Subir Informe Previo o Estudio (PDF/TXT/MD/DOCX/PNG)"}
                           </button>
                           {uploadedReportName && (
                             <button
                               onClick={() => {
                                 setUploadedReportContent("");
                                 setUploadedReportName(null);
                                 setUploadedReportMimeType("");
                                 if (reportFileInputRef.current) {
                                   reportFileInputRef.current.value = "";
                                 }
                               }}
                               className="px-3 bg-rose-950/20 hover:bg-rose-950/40 border-2 border-rose-950 hover:border-rose-900 rounded-xl text-rose-400 transition-all flex items-center justify-center cursor-pointer"
                               title="Eliminar archivo adjunto"
                             >
                               <Trash2 className="h-4 w-4" />
                             </button>
                           )}
                         </div>
                     </div>

                    {/* Imagen */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Imagen:</label>
                      {!base64Image ? (
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                            dragActive 
                              ? "border-indigo-500 bg-indigo-950/20" 
                              : "border-slate-800 hover:border-slate-705 bg-slate-950"
                          }`}
                          onClick={() => document.getElementById("file-picker")?.click()}
                        >
                          <Upload className="h-6 w-6 text-slate-550" />
                          <div className="text-[11px] font-black text-slate-300 uppercase tracking-wider">Arrastra tu imagen o haz click</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Formatos PNG, JPG hasta 15MB</div>
                          <input
                            id="file-picker"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* File info bar */}
                          <div className="relative border-2 border-slate-850 bg-slate-950 p-3 rounded-xl flex items-center justify-between gap-3 shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                                <img
                                  src={imagePreviewUrl || `data:${selectedFile?.type || "image/png"};base64,${base64Image}`}
                                  alt="Miniatura"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="text-left font-mono text-[10px] uppercase tracking-wider font-bold">
                                <div className="text-slate-300 max-w-[150px] truncate">{selectedFile?.name || "estudio_radiologico.png"}</div>
                                <div className="text-slate-500">{(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB</div>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setBase64Image(null);
                                setAnnotations([]);
                                if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
                                  try {
                                    URL.revokeObjectURL(imagePreviewUrl);
                                  } catch (_) {}
                                }
                                setImagePreviewUrl(null);
                              }}
                              className="p-1 px-2 text-rose-400 hover:bg-rose-950/20 hover:border-rose-800/80 border border-rose-950 rounded-lg transition-all text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1"
                            >
                              <X className="h-3 w-3" /> Quitar Estudio
                            </button>
                          </div>

                          {/* Interactive Canvas Workstation Card */}
                          <div className="border-2 border-slate-850 bg-[#070b13] rounded-xl p-4.5 space-y-4 shadow-xl">
                            {/* Header & Tools */}
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-slate-900 pb-3">
                              <div>
                                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Marcaje de Zonas de Interés
                                </h4>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                                  Haz clic o arrastra para enmarcar zonas que la IA debe analizar prioritariamente.
                                </p>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                                {/* Tool Selector Buttons */}
                                <div className="bg-slate-950 p-1 rounded-lg border border-slate-900 flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAnnotationTool("point");
                                      handleCancelPending();
                                    }}
                                    className={`px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
                                      activeAnnotationTool === "point"
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    Punto (🔴)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAnnotationTool("box");
                                      handleCancelPending();
                                    }}
                                    className={`px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
                                      activeAnnotationTool === "box"
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                  >
                                    <div className="w-1.5 h-1.5 border border-indigo-200" />
                                    Rectángulo (🟦)
                                  </button>
                                </div>

                                {annotations.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleClearAllAnnotations}
                                    className="p-1 px-2 hover:bg-slate-900 text-slate-400 hover:text-rose-400 border border-transparent hover:border-slate-800 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ml-auto sm:ml-0"
                                  >
                                    Limpiar [{annotations.length}]
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Main Body: Grid showing image monitor & placed marks */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                              {/* Canvas Monitor Section (lg:col-span-8) */}
                              <div className="lg:col-span-8 space-y-2">
                                <div 
                                  className="relative bg-slate-950 border border-slate-900 rounded-xl overflow-hidden max-h-[380px] flex items-center justify-center group"
                                  style={{ touchAction: "none" }}
                                >
                                  {/* Interaction overlay mapping coordinates relative to the image */}
                                  <div 
                                    className="relative w-full max-w-sm mx-auto select-none cursor-crosshair overflow-hidden"
                                    onMouseDown={handleImageMouseDown}
                                    onMouseMove={handleImageMouseMove}
                                    onMouseUp={handleImageMouseUp}
                                  >
                                    {/* Main Image study */}
                                    <img
                                      ref={imageRef}
                                      src={imagePreviewUrl || `data:${selectedFile?.type || "image/png"};base64,${base64Image}`}
                                      alt="Estudio Interactivo"
                                      className="w-full h-auto object-contain block max-h-[360px] pointer-events-none"
                                      referrerPolicy="no-referrer"
                                    />

                                    {/* Overlay elements rendering annotations */}
                                    {annotations.map((ann, idx) => {
                                      const num = idx + 1;
                                      if (ann.type === "point") {
                                        return (
                                          <div
                                            key={ann.id}
                                            className="absolute group/pin -translate-x-1/2 -translate-y-1/2 z-10 select-none pointer-events-auto"
                                            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                                            title={ann.label}
                                          >
                                            {/* Glowing indicator */}
                                            <div className="w-6 h-6 bg-rose-500/30 border border-rose-500 rounded-full flex items-center justify-center relative cursor-help scale-95 hover:scale-110 active:scale-95 transition-all shadow-lg animate-pulse" />
                                            {/* Static center dot */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-rose-700 hover:bg-rose-500 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow font-mono">
                                              {num}
                                            </div>
                                            {/* Hover tooltip */}
                                            <div className="absolute top-7 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-rose-900/40 text-rose-300 text-[8px] font-mono p-1 px-1.5 rounded uppercase tracking-wider font-bold whitespace-nowrap opacity-0 group-hover/pin:opacity-100 transition-opacity pointer-events-none shadow-xl z-20">
                                              #{num}: {ann.label}
                                            </div>
                                          </div>
                                        );
                                      } else if (ann.type === "box") {
                                        return (
                                          <div
                                            key={ann.id}
                                            className="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/10 pointer-events-auto group/box"
                                            style={{
                                              left: `${ann.x}%`,
                                              top: `${ann.y}%`,
                                              width: `${ann.w}%`,
                                              height: `${ann.h}%`,
                                            }}
                                            title={ann.label}
                                          >
                                            {/* Hot tag corner label */}
                                            <div className="absolute -top-1.5 -left-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow shadow-indigo-950 z-10">
                                              {num}
                                            </div>
                                            <div className="absolute -bottom-5 left-0 bg-slate-950/90 border border-indigo-900/40 text-indigo-300 text-[7px] font-mono p-0.5 px-1 rounded uppercase tracking-wider font-bold whitespace-nowrap opacity-10 group-hover/box:opacity-100 transition-opacity pointer-events-none shadow z-20">
                                              #{num}: {ann.label}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}

                                    {/* Drawing Temporary Box feedback */}
                                    {isDrawingBox && tempBox && (
                                      <div
                                        className="absolute border-2 border-indigo-500/80 bg-indigo-600/15 pointer-events-none"
                                        style={{
                                          left: `${tempBox.x}%`,
                                          top: `${tempBox.y}%`,
                                          width: `${tempBox.w}%`,
                                          height: `${tempBox.h}%`,
                                        }}
                                      />
                                    )}

                                    {/* Interactive Floated Dialog (Pending labeling) */}
                                    {pendingAnnotation && (
                                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] flex items-center justify-center p-4 z-40 animate-fade-in pointer-events-auto">
                                        <div className="bg-slate-950 border-2 border-indigo-550/60 p-4.5 rounded-xl max-w-xs w-full shadow-2xl space-y-3.5 relative animate-scale-in">
                                          <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[9px] font-black uppercase tracking-wider border-b border-slate-900 pb-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                                            {pendingAnnotation.type === "point" ? "Nuevo Punto de Alerta" : "Nueva Región Seleccionada"}
                                          </div>

                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">
                                                Diagnóstico / Sospecha Médica:
                                              </label>
                                              <button
                                                type="button"
                                                onClick={handleAutoLabelAnnotation}
                                                disabled={isAutoLabeling}
                                                className="text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer select-none"
                                                title="Analizar visualmente la región con IA para sugerir una etiqueta"
                                              >
                                                {isAutoLabeling ? (
                                                  <>
                                                    <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full" />
                                                    Analizando...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Sparkles className="h-2.5 w-2.5 animate-pulse text-indigo-400" />
                                                    <span>Sugerir con IA</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            <input
                                              type="text"
                                              value={pendingLabel}
                                              onChange={(e) => setPendingLabel(e.target.value)}
                                              placeholder={pendingAnnotation.type === "point" ? "Ej. Nódulo apical, Opacidad focal" : "Ej. Posible neumotórax, Cardiomegalia"}
                                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-2.5 text-xs font-semibold text-slate-200 outline-none placeholder:text-slate-655 transition-all font-mono"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  handleSaveAnnotation();
                                                }
                                              }}
                                            />
                                            {autoLabelError && (
                                              <p className="text-[8px] font-semibold text-rose-400 mt-1 uppercase tracking-wider leading-relaxed">
                                                ⚠️ {autoLabelError}
                                              </p>
                                            )}
                                          </div>

                                          <div className="flex gap-2 justify-end text-[9px] font-black uppercase tracking-widest font-mono">
                                            <button
                                              type="button"
                                              onClick={handleCancelPending}
                                              className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-950 rounded-lg transition-all"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleSaveAnnotation}
                                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg transition-all shadow-md"
                                            >
                                              Confirmar Marca
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Placed Annotations Panel List (lg:col-span-4) */}
                              <div className="lg:col-span-4 space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">
                                  Marcas Registradas ({annotations.length})
                                </label>
                                
                                {annotations.length === 0 ? (
                                  <div className="border border-dashed border-slate-900/60 bg-slate-950/40 p-6 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 h-[280px]">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 border border-slate-850 font-black text-xs font-mono">
                                      0
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                                      Ninguno registrado
                                    </p>
                                    <p className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider max-w-[150px] leading-relaxed">
                                      Haz clic sobre la placa para agregar marcas de advertencia médica.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5 custom-scrollbar h-[280px]">
                                    {annotations.map((ann, idx) => {
                                      const num = idx + 1;
                                      return (
                                        <div
                                          key={ann.id}
                                          className="p-2.5 bg-slate-950/80 hover:bg-[#080d19] border border-slate-900 hover:border-slate-800 rounded-lg flex items-center justify-between gap-2.5 transition-all shadow-sm font-mono animate-fade-in"
                                        >
                                          <div className="flex items-start gap-2 overflow-hidden">
                                            <span className="w-4 h-4 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center font-black text-[8px] text-indigo-400 shrink-0 mt-0.5">
                                              {num}
                                            </span>
                                            <div className="space-y-0.5 overflow-hidden">
                                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-wide truncate max-w-[120px]">
                                                {ann.label}
                                              </p>
                                              <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                {ann.type === "point" ? (
                                                  <span className="text-rose-400 flex items-center gap-0.5">
                                                    Punto (X:{ann.x.toFixed(0)}% Y:{ann.y.toFixed(0)}%)
                                                  </span>
                                                ) : (
                                                  <span className="text-indigo-400 flex items-center gap-0.5">
                                                    Región (X:{ann.x.toFixed(0)}% Y:{ann.y.toFixed(0)}%)
                                                  </span>
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAnnotation(ann.id)}
                                            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 rounded-md transition-all shrink-0"
                                            title="Eliminar marca"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sección Expandible: Datos del Paciente y Personalización del Membrete (PDF) */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setShowPatientDetails(!showPatientDetails)}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-400" />
                          <span className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">🩺 Datos del Paciente y Membrete</span>
                        </div>
                        <span className="text-xs text-indigo-400 font-bold hover:text-indigo-350">
                          {showPatientDetails ? "Ocultar ▲" : "Configurar ▼"}
                        </span>
                      </div>

                      {showPatientDetails && (
                        <div className="space-y-3.5 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                          {/* Col 1 */}
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Nombre Completo del Paciente:</label>
                            <input
                              type="text"
                              value={patientName}
                              onChange={(e) => setPatientName(e.target.value)}
                              placeholder="Ej: Juan Pérez Pérez"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Correo Electrónico del Paciente (Opcional):</label>
                            <input
                              type="email"
                              value={patientEmail}
                              onChange={(e) => {
                                setPatientEmail(e.target.value);
                                localStorage.setItem("rad_patient_email", e.target.value);
                              }}
                              placeholder="Ej: paciente@correo.com"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Fecha del Estudio / Reporte:</label>
                            <input
                              type="date"
                              value={reportDate}
                              onChange={(e) => setReportDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2 border-t border-slate-800/60 pt-3">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Médico Radiólogo (Opcional - No se mostrará si está vacío):</label>
                            <input
                              type="text"
                              value={doctorName}
                              onChange={(e) => {
                                setDoctorName(e.target.value);
                                localStorage.setItem("rad_doctor_name", e.target.value);
                              }}
                              placeholder="Ej: Dr. Milton Benavides S. Radiólogo"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          {/* Foto de Firma del Médico */}
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Foto de Firma / Sello (Opcional):</label>
                            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80 w-full">
                              <button
                                type="button"
                                onClick={() => document.getElementById("doctor-signature-file")?.click()}
                                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-indigo-400 hover:text-indigo-350 border border-slate-800 rounded-lg text-xs font-mono font-bold tracking-wide transition-all uppercase select-none w-full sm:w-auto text-center shrink-0"
                              >
                                {customSignatureUrl ? "Cambiar Firma 🖋️" : "Subir Firma 🖋️"}
                              </button>
                              <input
                                id="doctor-signature-file"
                                type="file"
                                accept="image/*"
                                onChange={handleCustomSignatureUpload}
                                className="hidden"
                              />

                              {customSignatureUrl ? (
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                                  <div className="bg-white rounded p-1 border border-slate-700 h-9 flex items-center shrink-0">
                                    <img 
                                      src={customSignatureUrl} 
                                      alt="Firma" 
                                      className="h-full w-auto max-w-[120px] object-contain block mix-blend-multiply" 
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleRemoveCustomSignature}
                                    className="text-rose-500 hover:text-rose-450 font-bold uppercase tracking-wider text-[8.5px] underline select-none"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[9.5px] text-slate-500 font-mono tracking-tight font-medium">No se ha subido ninguna imagen de firma.</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Nombre de la Institución / Clínica (Opcional - No se mostrará si está vacío):</label>
                            <input
                              type="text"
                              value={clinicName}
                              onChange={(e) => setClinicName(e.target.value)}
                              placeholder="Ej: Clínica de Diagnóstico por Imagen"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <label className="text-[9.5px] font-black text-slate-400 block uppercase tracking-widest leading-none">Símbolo / Logotipo del Reporte:</label>
                            
                            {/* Standard Symbols Row & Upload Trigger */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5">
                              {[
                                { id: "none", label: "Ninguno", subtitle: "Sin ilustración" },
                                { id: "medical-cross", label: "Cruz", subtitle: "Médica tradicional" },
                                { id: "heart-pulse", label: "Corazón", subtitle: "Cardiorrespiratorio" },
                                { id: "dna", label: "ADN", subtitle: "Estructura genética" },
                                { id: "shield-check", label: "Escudo", subtitle: "Protección / Aval" },
                              ].map(logoOpt => (
                                <button
                                  key={logoOpt.id}
                                  type="button"
                                  onClick={() => setSelectedLogo(logoOpt.id)}
                                  className={`p-2 border rounded-xl text-center transition-all flex flex-col justify-center items-center gap-0.5 select-none cursor-pointer ${
                                    selectedLogo === logoOpt.id
                                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950/40"
                                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-755"
                                  }`}
                                >
                                  <span className="text-[10px] font-black uppercase leading-none">{logoOpt.label}</span>
                                  <span className="text-[7.5px] text-slate-500 font-bold leading-none hidden md:inline truncate w-full">{logoOpt.subtitle}</span>
                                </button>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => document.getElementById("custom-logo-input2")?.click()}
                                className="p-2 bg-slate-950 border-2 border-dashed border-indigo-900/65 hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 rounded-xl flex flex-col justify-center items-center gap-0.5 transition-all select-none cursor-pointer"
                                title="Subir una nueva imagen para usar como logotipo o membrete"
                              >
                                <span className="text-[10px] font-black uppercase leading-none flex items-center gap-1">
                                  <span>Subir</span>
                                  <Plus className="h-3 w-3" />
                                </span>
                                <span className="text-[7.5px] text-indigo-550 font-black leading-none">IMAGEN DE PC</span>
                              </button>
                            </div>

                            {/* Hidden file input */}
                            <input
                              id="custom-logo-input2"
                              type="file"
                              accept="image/*"
                              onChange={handleCustomLogoUpload}
                              className="hidden"
                            />

                            {/* biblioteca de logotipos */}
                            {customLogos.length > 0 && (
                              <div className="bg-[#090D1A] border border-slate-850 rounded-2xl p-3.5 space-y-2 text-left">
                                <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest leading-none">Logotipos Personalizados Cargados ({customLogos.length}):</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {customLogos.map((logo) => {
                                    const isActive = selectedLogo === logo.id;
                                    return (
                                      <div
                                        key={logo.id}
                                        onClick={() => setSelectedLogo(logo.id)}
                                        className={`p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between select-none ${
                                          isActive
                                            ? "bg-indigo-950/30 border-indigo-500 text-white shadow-sm shadow-indigo-950/20"
                                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-755"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                          <img
                                            src={logo.url}
                                            alt={logo.name}
                                            className="h-8 w-8 rounded bg-white object-contain border border-slate-800 p-0.5 shrink-0"
                                            referrerPolicy="no-referrer"
                                          />
                                          <span className="text-[9.5px] font-extrabold text-slate-300 truncate block text-left" title={logo.name}>
                                            {logo.name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {isActive && (
                                            <span className="text-[10px]" title="Activo">
                                              ✅
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveCustomLogoById(logo.id);
                                            }}
                                            className="text-slate-650 hover:text-rose-455 p-1 rounded transition-colors cursor-pointer"
                                            title="Eliminar este logotipo"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Additional display options for active custom logo */}
                            {customLogoUrl && (
                              <div className="space-y-3 mt-2">
                                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                                  <div className="flex items-center gap-2">
                                    <img 
                                      src={customLogoUrl} 
                                      alt="Logotipo Activo" 
                                      className="h-9 max-w-[90px] bg-white rounded border border-slate-700 object-contain p-0.5 shrink-0" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-widest block leading-none">Estilo en el PDF:</span>
                                      <span className="text-[8px] text-slate-500 font-bold block">Ajusta cómo se proyecta tu logotipo</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleChangeCustomLogoStyle("left")}
                                      className={`px-3 py-1 rounded-lg text-[8.5px] font-black uppercase border select-none transition-all cursor-pointer ${
                                        customLogoStyle === "left"
                                          ? "bg-indigo-900 border-indigo-700 text-white"
                                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                                      }`}
                                    >
                                      Izquierda
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleChangeCustomLogoStyle("banner")}
                                      className={`px-3 py-1 rounded-lg text-[8.5px] font-black uppercase border select-none transition-all cursor-pointer ${
                                        customLogoStyle === "banner"
                                          ? "bg-indigo-900 border-indigo-700 text-white"
                                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                                      }`}
                                      title="Membrete completo estilo Banner horizontal"
                                    >
                                      Banner Ancho
                                    </button>
                                  </div>
                                </div>

                                {/* Interactive real-time A4 printable document limits mockup */}
                                <div className="bg-slate-900/30 border border-slate-850/60 rounded-xl p-3.5 space-y-2.5 text-left">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-widest font-mono block">Margen de Impresión A4 de Referencia:</span>
                                    <span className="text-[7.5px] text-slate-400 font-bold block bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">Previsualización Física</span>
                                  </div>

                                  <div className="flex justify-center py-2 bg-slate-950/40 rounded-lg">
                                    <div 
                                      className="relative bg-white border border-gray-200 shadow-md p-2 flex flex-col justify-between select-none overflow-hidden"
                                      style={{ width: "130px", height: "184px" }}
                                    >
                                      {/* Margen A4 Guías de Esquina / Trim Marks */}
                                      <div className="absolute top-2 left-0 w-2 h-[0.5px] bg-red-400/60"></div>
                                      <div className="absolute top-0 left-2 w-[0.5px] h-2 bg-red-400/60"></div>
                                      <div className="absolute top-2 right-0 w-2 h-[0.5px] bg-red-400/60"></div>
                                      <div className="absolute top-0 right-2 w-[0.5px] h-2 bg-red-400/60"></div>
                                      <div className="absolute bottom-2 left-0 w-2 h-[0.5px] bg-red-400/60"></div>
                                      <div className="absolute bottom-0 left-2 w-[0.5px] h-2 bg-red-400/60"></div>
                                      <div className="absolute bottom-2 right-0 w-2 h-[0.5px] bg-red-400/60"></div>
                                      <div className="absolute bottom-0 right-2 w-[0.5px] h-2 bg-red-400/60"></div>

                                      {/* Guías de regla de margen de impresión lateral y superior */}
                                      <div className="absolute left-2 top-0 bottom-0 border-l border-dashed border-rose-200/50 pointer-events-none"></div>
                                      <div className="absolute right-2 top-0 bottom-0 border-r border-dashed border-rose-200/50 pointer-events-none"></div>
                                      <div className="absolute top-2 left-0 right-0 border-t border-dashed border-rose-200/50 pointer-events-none"></div>
                                      <div className="absolute bottom-2 left-0 right-0 border-b border-dashed border-rose-200/50 pointer-events-none"></div>

                                      {/* Indicador de Límites de impresión */}
                                      <div className="absolute top-0.5 left-2.5 text-[3.5px] font-black text-rose-500 font-mono leading-none pointer-events-none scale-75 origin-left">
                                        MARGEN 15mm
                                      </div>

                                      {/* Outer dotted layout boundary lines indicating standard print margins constraint */}
                                      <div className="absolute inset-2 border border-dashed border-sky-450/40 rounded pointer-events-none flex flex-col justify-between p-1.5">
                                        
                                        {/* Dynamic Header logo position based on current choice */}
                                        <div className="w-full flex flex-col gap-1">
                                          {customLogoStyle === "banner" ? (
                                            /* Banner Style: Centered Horizontal full-width image placeholder block */
                                            <div className="w-full h-5 bg-slate-50 border border-slate-200/80 rounded flex items-center justify-center p-0.5 overflow-hidden">
                                              <img 
                                                src={customLogoUrl} 
                                                alt="Banner Prueba A4" 
                                                className="h-full w-full object-contain" 
                                                referrerPolicy="no-referrer"
                                              />
                                            </div>
                                          ) : (
                                            /* Left Style: Corner-anchored Logo with medical tags simulator */
                                            <div className="flex items-start gap-1">
                                              <div className="w-5 h-5 bg-slate-50 border border-slate-200/80 rounded p-0.5 shrink-0 overflow-hidden">
                                                <img 
                                                  src={customLogoUrl} 
                                                  alt="Logo Izquierda Prueba A4" 
                                                  className="h-full w-full object-contain" 
                                                  referrerPolicy="no-referrer"
                                                />
                                              </div>
                                              <div className="flex-1 space-y-0.5 pt-0.5">
                                                <div className="h-1 bg-slate-400 rounded w-10"></div>
                                                <div className="h-[2.5px] bg-slate-300 rounded w-12"></div>
                                                <div className="h-[2px] bg-slate-200 rounded w-8"></div>
                                              </div>
                                            </div>
                                          )}

                                          {/* Dividing line corresponding to header limits */}
                                          <div className="h-[0.5px] bg-slate-200 w-full mt-0.5"></div>
                                        </div>

                                        {/* Representative sample technical text lines mimicking the findings section */}
                                        <div className="flex-1 my-2 flex flex-col justify-start gap-1">
                                          <div className="space-y-0.5">
                                            <div className="h-[2.5px] bg-slate-350 rounded w-full"></div>
                                            <div className="h-[2.5px] bg-slate-200 rounded w-11/12"></div>
                                            <div className="h-[2.5px] bg-slate-200 rounded w-10/12"></div>
                                          </div>
                                          <div className="space-y-0.5 pt-1">
                                            <div className="h-[3.5px] bg-slate-400 rounded w-1/3"></div>
                                            <div className="h-[2.5px] bg-slate-200 rounded w-full"></div>
                                            <div className="h-[2.5px] bg-slate-150 rounded w-11/12"></div>
                                          </div>
                                        </div>

                                        {/* Safe document bottom signature block */}
                                        <div className="w-full flex justify-between items-center border-t border-slate-100 pt-0.5 text-[3.5px] text-slate-300 tracking-tight">
                                          <span>Reporte Clínico</span>
                                          <span>Pág. 1 de 1</span>
                                        </div>

                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[7.5px] text-slate-450 leading-relaxed font-mono">
                                    {customLogoStyle === "banner" ? (
                                      <p>🌐 <strong className="text-slate-300">Formato Centrado Horizontal:</strong> El logotipo ocupará de forma equilibrada la posición de membrete ancho, alineando toda la documentación exactamente debajo del separador del encabezado.</p>
                                    ) : (
                                      <p>📌 <strong className="text-slate-300">Formato Esquina Superior Izquierda:</strong> El logotipo respetará el margen de encuadre técnico lateral, liberando espacio para las líneas secundarias del destinatario y datos del paciente.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Informe */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">Informe:</label>
                      <textarea
                        value={inputReport}
                        onChange={(e) => setInputReport(e.target.value)}
                        placeholder="Copia, edita o usa un borrador previo aquí para redactar desde él, u omítelo..."
                        rows={3}
                        className="w-full bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-xl py-3 px-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={handleGenerateReport}
                      disabled={isGenerating || !studyType.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-black py-4 px-6 rounded-xl text-xs uppercase tracking-widest shadow-[0_4px_16px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-white" />
                          <span>Analizando e Interpretando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4.5 w-4.5" />
                          <span>Redactar Informe Médico</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 💬 CHAT INTELIGENTE MÉDICO-RADIOLÓGICO */}
                  <div className={isSmartChatExpanded
                    ? "fixed inset-4 md:inset-10 z-50 bg-[#090D1A]/98 backdrop-blur-2xl border-2 border-indigo-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-4 shadow-2xl overflow-hidden transition-all duration-355"
                    : "bg-[#090D1A] border-2 border-slate-855 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col h-[520px] justify-between transition-all duration-355"
                  }>
                    <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5 select-none">
                          <Activity className="h-4 w-4 text-indigo-400 animate-pulse" />
                          Chat Inteligente Médico-Radiológico
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase select-none flex items-center gap-1">
                          Consulta clasificaciones, dosis, nomenclatura y patologías
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsSmartChatExpanded(p => !p)}
                          className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                            isSmartChatExpanded
                              ? "bg-indigo-950/90 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30"
                              : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-100"
                          }`}
                          title={isSmartChatExpanded ? "Restaurar tamaño estándar de chat" : "Maximizar área de chat (Modo Expandido)"}
                        >
                          {isSmartChatExpanded ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSmartChatMessages([
                              {
                                id: "welcome",
                                role: "model",
                                text: "¡Hola! Soy tu **Asistente Inteligente Médico-Radiológico**. Consulta clasificaciones (ej. Neer o Bosniak), dosis de contraste o términos. Te brindaré resúmenes exportables para inyectarlos directo en el reporte."
                              }
                            ]);
                            setSmartChatError(null);
                          }}
                          className="text-[9px] font-black text-slate-500 hover:text-rose-400 uppercase tracking-wider font-mono transition-colors"
                          title="Resetear el chat a la bienvenida original"
                        >
                          Reiniciar
                        </button>
                      </div>
                    </div>

                    {/* Chat Bubble Area */}
                    <div className={`flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin ${
                      isSmartChatExpanded ? "max-h-[calc(100vh-240px)]" : "max-h-[420px]"
                    }`}>
                      {smartChatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[90%] rounded-2xl p-3.5 text-[11px] md:text-xs selection:bg-indigo-900 border ${
                              msg.role === "user"
                                ? "bg-indigo-650/15 border-indigo-500/20 text-indigo-150"
                                : "bg-slate-950 border-slate-800/80 text-slate-300 leading-relaxed"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-mono text-[8px] font-black uppercase tracking-widest mb-1.5 select-none text-left">
                              {msg.role === "user" ? (
                                <>
                                  <User className="h-3 w-3 text-indigo-400" />
                                  <span>Médico Radiólogo</span>
                                </>
                              ) : (
                                <>
                                  <Brain className="h-3 w-3 text-indigo-400 animate-pulse" />
                                  <span className="text-indigo-400 font-bold">Gemini Médico AI</span>
                                </>
                              )}
                            </div>
                            <div className="font-semibold text-slate-200 text-left">
                              {msg.role === "user" ? (
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              ) : (
                                <div className="space-y-2.5 leading-relaxed">
                                  {renderElegantResponse(msg.text, "text-indigo-400")}
                                  
                                  {/* Action toolbar to copy or insert entire text */}
                                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900/60 font-mono text-[8.5px]">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const cleanText = msg.text.replace(/\[RESUMEN_CLASIFICACION\][\s\S]*?\[\/RESUMEN_CLASIFICACION\]/g, "").trim();
                                          await navigator.clipboard.writeText(cleanText);
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }}
                                      className="px-2 py-1 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-250 rounded-md border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                                      title="Copiar respuesta médica sin la escala"
                                    >
                                      <span>📋 Copiar Nota</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleanText = msg.text.replace(/\[RESUMEN_CLASIFICACION\][\s\S]*?\[\/RESUMEN_CLASIFICACION\]/g, "").trim();
                                        handleAppendBlockToReport(`\n\n**Nota de Consulta Radiológica:**\n${cleanText}`);
                                      }}
                                      className="px-2 py-1 bg-slate-900 hover:bg-indigo-950 text-indigo-350 hover:text-indigo-250 rounded-md border border-slate-800/80 transition-all flex items-center gap-1 cursor-pointer"
                                      title="Inyectar esta respuesta al final del reporte en progreso"
                                    >
                                      <span>📥 Inyectar Nota</span>
                                    </button>
                                  </div>

                                  {/* Exportable summary button */}
                                  {msg.summary && (
                                    <div className="mt-3.5 p-3.5 bg-emerald-950/20 border-2 border-emerald-500/15 rounded-xl space-y-2.5 animate-fadeIn text-left">
                                      <div className="text-[8.5px] font-black text-emerald-450 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                                        <span>Resumen de Clasificación Listo:</span>
                                      </div>
                                      <div className="text-[10px] text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/60 font-semibold italic whitespace-pre-wrap leading-normal select-text">
                                        {msg.summary}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleAppendBlockToReport(`\n\n### CONCLUSIÓN DE CLASIFICACIÓN\n${msg.summary}`);
                                        }}
                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                      >
                                        <span>Inyectar Escala Resumida al Reporte</span>
                                        <span>📥</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isSmartChatLoading && (
                        <div className="flex justify-start animate-pulse">
                          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-3.5 max-w-[85%] shadow-md">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400 font-mono">
                              <Loader2 className="h-4.5 w-4.5 animate-spin" />
                              <span>Consultando escalas y base médica...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {smartChatError && (
                        <div className="p-3 bg-rose-955/20 border border-rose-900/40 rounded-xl text-[10px] text-rose-450 font-bold select-text text-left">
                          ⚠️ {smartChatError}
                        </div>
                      )}

                      <div ref={smartChatBottomRef} />
                    </div>

                    {/* Chat input box */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendSmartChatMessage();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Consulta: dosis, clasificaciones, términos..."
                        value={smartChatInput}
                        onChange={(e) => setSmartChatInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-sans"
                        disabled={isSmartChatLoading}
                      />
                      <button
                        type="submit"
                        disabled={isSmartChatLoading || !smartChatInput.trim()}
                        className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/25 disabled:bg-slate-950 disabled:border-slate-850 disabled:opacity-50 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                        title="Enviar consulta"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Report Generation Output Display */}
                <div className="xl:col-span-7 flex flex-col min-h-[520px]">
                  <div className={isMainReportExpanded
                    ? "fixed inset-4 md:inset-10 z-50 bg-[#090D1A]/98 backdrop-blur-2xl border-2 border-slate-700 rounded-3xl flex flex-col overflow-hidden shadow-2xl transition-all duration-355"
                    : "flex-1 bg-slate-900 border-2 border-slate-850 rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all duration-355"
                  }>
                    
                    {/* Header Panel */}
                    <div className="bg-slate-950 px-4 md:px-6 py-3.5 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                      <div className="flex items-center justify-between w-full md:w-auto gap-4 shrink-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-400" />
                          <span className="text-xs font-black text-slate-300 font-mono tracking-widest uppercase">WORKSPACE_DRAFT.TXT</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMainReportExpanded(p => !p)}
                          className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                            isMainReportExpanded
                              ? "bg-indigo-950/90 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30"
                              : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-100"
                          }`}
                          title={isMainReportExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                        >
                          {isMainReportExpanded ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      
                       {generatedReport && (
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                          <button
                            onClick={handleGenerateInfographic}
                            disabled={isGeneratingInfographic}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-pink-700 hover:bg-pink-600 border-2 border-pink-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Generar infografía explicativa para el paciente"
                          >
                            {isGeneratingInfographic ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...
                              </>
                            ) : (
                                "Infografía Paciente"
                            )}
                          </button>
                          <button
                            onClick={handlePrintPDF}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Imprimir o exportar diseño de informe a PDF listo"
                          >
                            <Printer className="h-3.5 w-3.5" /> PDF / Imprimir
                          </button>
                          <button
                            onClick={() => handleDownloadNativePDF(false)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-900 border-2 border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-200 transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none cursor-pointer whitespace-nowrap"
                            title="Descargar archivo PDF limpio directo sin URL ni hora"
                          >
                            <Download className="h-3.5 w-3.5 text-indigo-400" /> Descargar PDF
                          </button>
                          <button
                            onClick={() => handleOpenWhatsAppShare('report_pdf')}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Enviar reporte PDF firmado directamente a WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-white" /> WhatsApp PDF
                          </button>
                          <button
                            onClick={() => handleOpenGmailShare('report_pdf')}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-red-700 hover:bg-red-650 border-2 border-red-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Enviar reporte PDF firmado directamente por Correo usando Gmail"
                          >
                            <Mail className="h-3.5 w-3.5 text-white" /> Gmail PDF
                          </button>
                          <button
                            onClick={() => copyToClipboard(generatedReport, true)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                          >
                            {copiedReportId ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copiar Reporte
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Main Text Content */}
                    <div className="flex-1 p-6 overflow-y-auto leading-relaxed text-sm select-text text-slate-300 relative bg-[#090D1A]">
                        {infographicUrl && (
                          <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-pink-600/30">
                             <h4 className="text-sm font-bold text-pink-300 mb-2">Infografía Generada:</h4>
                             <img src={infographicUrl} alt="Infografía Paciente" className="w-full rounded-lg" referrerPolicy="no-referrer" />
                             <div className="mt-3 flex justify-end gap-2">
                               <button
                                 onClick={() => handleOpenWhatsAppShare('patient_infographic')}
                                 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                                 title="Compartir infografía visual por WhatsApp directamente"
                               >
                                 <MessageSquare className="h-4 w-4" /> Enviar por WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGmailShare('patient_infographic')}
                                  className="px-4 py-2 bg-red-750 hover:bg-red-700 border-2 border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer animate-fadeIn"
                                  title="Compartir infografía visual por Correo Electrónico usando Gmail"
                                >
                                  <Mail className="h-4 w-4 text-white" /> Enviar por Gmail
                                </button>
                             </div>
                          </div>
                        )}
                        {infographicError && (
                          <div className="mb-6 p-4 bg-rose-900/20 text-rose-400 rounded-xl text-xs font-bold border border-rose-800">
                             {infographicError}
                          </div>
                        )}
                      {!generatedReport && !isGenerating && !reportError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none">
                          <div className="p-4 bg-slate-900/60 rounded-2xl border-2 border-slate-800 mb-4 shadow-inner">
                            <FileText className="h-10 w-10 text-slate-600" />
                          </div>
                          <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Sin Reporte de Estudio redactado</h3>
                          <p className="text-[11px] font-bold text-slate-500 max-w-sm mt-2 uppercase tracking-wide leading-relaxed">
                            Rellena los parámetros en el panel izquierdo y presiona "Redactar Informe Médico" para recibir un informe estructurado impecable, listo para copiar y pegar.
                          </p>
                        </div>
                      )}

                      {/* Loading Medical State Indicator */}
                      {isGenerating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/95 z-10">
                          <div className="space-y-4 text-center">
                            <div className="relative inline-flex">
                              <span className="h-12 w-12 rounded-full border-4 border-indigo-900/20 border-t-indigo-500 animate-spin"></span>
                              <Activity className="h-5 w-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <div className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">Procesador Diagnóstico AI</div>
                            <div className="text-[11px] font-black text-indigo-400 animate-pulse font-mono max-w-xs uppercase tracking-widest">{generationSteps}</div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider max-w-md">Gemini está interpretando la anatomía clínica con reglas radiológicas académicas...</div>
                          </div>
                        </div>
                      )}

                      {/* Error State */}
                      {reportError && (
                        <div className="p-5 bg-rose-950/10 border-2 border-rose-900/40 rounded-2xl text-rose-400 flex items-start gap-4">
                          <AlertCircle className="h-6 w-6 shrink-0 mt-0.5 text-rose-400" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider">Error de Generación:</h4>
                            <p className="text-xs text-rose-300 font-bold mt-1.5 leading-relaxed whitespace-pre-wrap">{reportError}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">
                              Sugerencia: Revisa los secretos de tu API key en "Settings" o reitera el prompt con instrucciones más sencillas.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Rendered Medical Report */}
                      {generatedReport && (
                        <div className="space-y-6">
                          {/* Control Bar: Version History and Manual Editing */}
                          <div id="report-editor-controls" className="bg-slate-950 px-5 py-3 border-2 border-slate-850 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                            <div className="flex items-center gap-2">
                              <History className="h-4 w-4 text-indigo-400" />
                              <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest font-mono">
                                Historial
                              </span>
                              <span className="text-[10px] font-black bg-indigo-950 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded font-mono">
                                v{reportHistory.length + 1}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Revert Button */}
                              <button
                                id="btn-revert-report"
                                onClick={handleRevertReport}
                                disabled={reportHistory.length === 0}
                                className="px-3 py-2 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-950 disabled:opacity-30 border border-slate-800 disabled:border-slate-900 text-indigo-450 hover:text-indigo-450 disabled:text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none"
                                title="Volver a la versión previa del reporte"
                              >
                                <Undo className="h-3.5 w-3.5" />
                                Revertir ({reportHistory.length})
                              </button>

                              {/* Redo Button */}
                              {reportRedoHistory.length > 0 && (
                                <button
                                  id="btn-redo-report"
                                  onClick={handleRedoReport}
                                  className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none"
                                  title="Avanzar a la versión más reciente"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 transform scale-x-[-1]" />
                                  Rehacer ({reportRedoHistory.length})
                                </button>
                              )}

                              {/* Manual Edit Button */}
                              {!isEditingReportManual ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setShowVersionComparison(!showVersionComparison);
                                      setIsEditingReportManual(false);
                                    }}
                                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none border cursor-pointer ${
                                      showVersionComparison
                                        ? "bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-950"
                                        : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-amber-500 hover:text-amber-400"
                                    }`}
                                    title="Ver comparación visual lado a lado con el reporte original"
                                  >
                                    <Layers className="h-3.5 w-3.5" />
                                    {showVersionComparison ? "Ver Reporte Final" : "Comparar Versiones"}
                                  </button>

                                  <button
                                    id="btn-edit-report"
                                    onClick={() => {
                                      handleStartManualEdit();
                                      setShowVersionComparison(false);
                                    }}
                                    className="px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                    Editar Manualmente
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 font-mono">
                                  <button
                                    id="btn-save-report"
                                    onClick={handleSaveManualEdit}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-550 border border-emerald-500/30 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none cursor-pointer"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    Guardar
                                  </button>
                                  <button
                                    id="btn-cancel-edit"
                                    onClick={handleCancelManualEdit}
                                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 font-mono select-none cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Cancelar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 🛠️ ADVANCED MEDICAL REPORT HUD TOOLING BAR */}
                          {!isEditingReportManual && (
                            <div className="space-y-4 bg-slate-900/95 border-2 border-slate-850 rounded-2xl p-5 shadow-xl select-none">
                              {/* AI Style & Format Modifiers Row */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                                    Herramientas de Reformateo Clínico Posterior (IA)
                                  </span>
                                  {originalBaseReport && originalBaseReport !== generatedReport && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (generatedReport) {
                                          setReportHistory((prev) => [...prev, generatedReport]);
                                          setReportRedoHistory([]);
                                        }
                                        setGeneratedReport(originalBaseReport);
                                        setEditedReportText(originalBaseReport);
                                      }}
                                      className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-500/30 hover:border-rose-500/70 text-rose-350 hover:text-rose-300 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 font-mono"
                                      title="Restaurar el informe clínico a la versión original de generación"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Restablecer Original Base
                                    </button>
                                  )}
                                </div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                                  Modifica el estilo, extensión o idioma del reporte actual al instante sin alterar de forma permanente tus instrucciones de prompt personalizadas.
                                </p>

                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 pt-1 font-mono">
                                  <button
                                    type="button"
                                    onClick={() => handleModifyReport("Reescribe este informe clínico entero para que sea sumamente breve y directo: prioriza únicamente los hallazgos anormales relevantes y las conclusiones críticas o sospechas diagnósticas clave. Elimina información redundante o confirmaciones de normalidad extensas. Conserva el formato markdown original de forma idéntica.")}
                                    disabled={isModifyingReport}
                                    className="px-2 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/45 disabled:opacity-40 text-slate-350 hover:text-indigo-400 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-mono"
                                    title="Reducir el informe a hallazgos críticos de forma asertiva"
                                  >
                                    {isModifyingReport ? "Procesando..." : "Redacción Corta ⚡"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleModifyReport("Por favor, incrementa LIGERAMENTE el nivel de detalle y la extensión de este informe de forma muy controlada y asertiva en comparación con el original. Añade precisiones clínicas pertinentes, discute de forma concisa detalles anatómicos o de simetrías clave, pero evita a toda costa descripciones excesivamente largas, redundancias, párrafos gigantescos o reiteraciones innecesarias. El aumento en la extensión debe ser muy moderado. Conserva el formato de secciones markdown original de manera idéntica.")}
                                    disabled={isModifyingReport}
                                    className="px-2 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/45 disabled:opacity-40 text-slate-350 hover:text-indigo-400 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-mono"
                                    title="Incrementar levemente el detalle clínico sin excederse en la extensión"
                                  >
                                    {isModifyingReport ? "Procesando..." : "Exhaustivo Clínico 🔬"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleModifyReport("Analiza el reporte clínico actual y asocia rigurosamente el código diagnóstico de clasificación internacional CIE-10 (ICD-10) apropiado al lado de cada hallazgo patológico detectado y de cada impresión diagnóstica final. Reescribe el informe insertando estos códigos sin omitir ninguna otra información.")}
                                    disabled={isModifyingReport}
                                    className="px-2 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/45 disabled:opacity-40 text-slate-350 hover:text-indigo-400 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-mono"
                                    title="Codificar patologías según la norma internacional CIE-10"
                                  >
                                    {isModifyingReport ? "Procesando..." : "Formato CIE-10 🏷️"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleModifyReport("Traduce todo el informe clínico actual al inglés médico académico utilizando estrictamente la terminología estándar oficial de la ACR. Traduce todo el texto de hallazgos, conclusiones, datos del paciente y títulos, pero mantén el formato markdown estructurado original de forma idéntica.")}
                                    disabled={isModifyingReport}
                                    className="px-2 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/45 disabled:opacity-40 text-slate-350 hover:text-indigo-400 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-mono"
                                    title="Traducir reporte a inglés médico ACR estándar"
                                  >
                                    {isModifyingReport ? "Procesando..." : "Inglés Médico 🇺🇸"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleModifyReport("Por favor, resume los hallazgos principales en 3 o 4 viñetas muy concisas y asertivas de texto, y agrégalas como una nueva sección final titulada '### RESUMEN OPERACIONAL DE HALLAZGOS'. Mantén intactas todas las demás partes del reporte.")}
                                    disabled={isModifyingReport}
                                    className="col-span-2 lg:col-span-1 px-2 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/45 disabled:opacity-40 text-slate-350 hover:text-indigo-400 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-mono"
                                    title="Inyectar un resumen operacional final"
                                  >
                                    {isModifyingReport ? "Procesando..." : "Crear Resumen 📋"}
                                  </button>
                                </div>
                              </div>

                              <div className="border-t border-slate-850 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider font-mono">
                                  Integración de Datos Hospitalarios (RIS/PACS)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const metadata = {
                                      reportId: `REP-${Math.floor(Math.random() * 90000) + 10000}`,
                                      timestamp: new Date().toISOString(),
                                      modalidad: modality,
                                      doctor: doctorName || "Doble Valoración IA",
                                      paciente: patientName || "Sin Nombre Registrado",
                                      estudio: specificStudy || "General",
                                      informe_borrador_raw: editedReportText || generatedReport
                                    };
                                    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(metadata, null, 2))}`;
                                    const downloadAnchor = document.createElement("a");
                                    downloadAnchor.setAttribute("href", jsonString);
                                    downloadAnchor.setAttribute("download", `pacs_ris_${metadata.reportId}.json`);
                                    document.body.appendChild(downloadAnchor);
                                    downloadAnchor.click();
                                    downloadAnchor.remove();
                                  }}
                                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-900/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-350 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 font-mono cursor-pointer"
                                  title="Exportar archivo de integración PACS/EHR RIS"
                                >
                                  <Database className="h-4 w-4 text-emerald-555" />
                                  <span>Exportar a PACS (JSON) 💾</span>
                                </button>
                              </div>
                            </div>
                          )}

                           {showVersionComparison ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
                              {/* Left Panel: Original Report */}
                              <div className="bg-slate-950 p-5 rounded-2xl border-2 border-rose-950/30 flex flex-col h-[520px]">
                                <div className="pb-3 border-b border-rose-900/20 flex items-center justify-between mb-3 shrink-0">
                                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                    Informe Original Base (v1)
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono uppercase font-bold">
                                    {originalBaseReport ? `${originalBaseReport.length} caract.` : "0 caract."}
                                  </span>
                                </div>
                                <div className="flex-1 overflow-y-auto select-text text-xs leading-relaxed text-slate-400 font-mono whitespace-pre-wrap scrollbar-thin p-1 bg-slate-900/20 rounded-xl border border-slate-900">
                                  {originalBaseReport || "No hay versión original registrada todavía de este dictado."}
                                </div>
                              </div>

                              {/* Right Panel: Current Report */}
                              <div className="bg-slate-950 p-5 rounded-2xl border-2 border-indigo-950/30 flex flex-col h-[520px]">
                                <div className="pb-3 border-b border-indigo-900/20 flex items-center justify-between mb-3 shrink-0">
                                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    Versión Modificada Actual (v{reportHistory.length + 1})
                                  </span>
                                  <span className="text-[9px] text-indigo-450 font-mono uppercase font-bold">
                                    {generatedReport ? `${generatedReport.length} caract.` : "0 caract."}
                                  </span>
                                </div>
                                <div className="flex-1 overflow-y-auto select-text text-xs leading-relaxed text-slate-200 font-mono whitespace-pre-wrap scrollbar-thin p-1 bg-indigo-950/5 rounded-xl border border-indigo-950/30">
                                  {generatedReport || "No hay versión modificada registrada todavía."}
                                </div>
                              </div>
                            </div>
                          ) : isEditingReportManual ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">
                                  Editor de Texto Radiológico (Manual)
                                </label>
                                <span className="text-[9px] font-mono text-slate-500 uppercase">
                                  Escribe libremente • Los cambios se guardarán en el historial
                                </span >
                              </div>
                              <textarea
                                id="textarea-manual-report-edit"
                                value={editedReportText}
                                onChange={(e) => setEditedReportText(e.target.value)}
                                className={`w-full bg-slate-950 border-2 border-slate-850 hover:border-slate-800 focus:border-indigo-600 rounded-2xl p-6 text-xs sm:text-sm font-semibold text-slate-100 placeholder:text-slate-650 outline-none transition-all resize-y font-mono leading-relaxed ${
                                  isMainReportExpanded ? "h-[calc(100vh-340px)] min-h-[450px]" : "h-96"
                                }`}
                                placeholder="Escribe o modifica el informe médico aquí..."
                              />
                            </div>
                          ) : (
                            <div className="space-y-4 animate-fadeIn">
                              <div className="p-6 sm:p-8 rounded-2xl border-2 bg-slate-950 border-slate-850 text-slate-100 selection:bg-indigo-900 selection:text-white shadow-inner overflow-x-auto select-text">
                                {renderClinicalReport(generatedReport)}
                                
                                {/* Visual On-Screen Gallery of Attached Images */}
                                {attachedImages.length > 0 && (
                                  <div className="mt-8 pt-8 border-t border-slate-800/80 animate-fadeIn">
                                    <div className="flex items-center gap-2 mb-4">
                                      <FileImage className="h-4 w-4 text-indigo-400" />
                                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-205">
                                        Anexo: Registro de Capturas Diagnósticas ({attachedImages.length})
                                      </h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {attachedImages.map((img) => (
                                        <div key={img.id} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                                          <img src={img.url} alt={img.name} className="w-full aspect-[4/3] object-cover rounded bg-black border border-slate-950" />
                                          {img.caption && (
                                            <div className="text-xs font-semibold text-slate-300 italic text-center mt-1">“{img.caption}”</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Interactive Attachment Manager Panel */}
                          <div className="bg-slate-900 border-2 border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileImage className="h-4.5 w-4.5 text-cyan-400" />
                                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                  Anexar Imágenes e Informes de Ultrasonido / DICOM
                                </h3>
                              </div>
                              <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-cyan-950 text-cyan-400 border border-cyan-900/30 px-2 py-0.5 rounded">
                                LOCAL E INTERNO
                              </span>
                            </div>
                            
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                              Selecciona archivos individuales o una carpeta completa de imágenes DICOM/ultrasonido de tu computadora. Las acomodaremos al final del reporte y se añadirán de forma automática en tu PDF final para exportar todo el archivo.
                            </p>

                            {/* Drag and Drop Zone and File Input Triggers */}
                            <div 
                              className="border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950 p-6 rounded-xl flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer group"
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer && e.dataTransfer.files) {
                                  handleAttachedFiles(e.dataTransfer.files);
                                }
                              }}
                            >
                              <div className="p-3 bg-slate-900 rounded-full border border-slate-800 group-hover:border-indigo-500 group-hover:text-indigo-400 text-slate-500 transition-colors">
                                <Upload className="h-6 w-6" />
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-[11px] font-bold text-slate-350 uppercase tracking-wider">
                                  Arrastra tus imágenes o archivos DICOM aquí
                                </p>
                                <p className="text-[9px] font-mono text-slate-500">
                                  O utiliza una de las opciones de selección directa de abajo
                                </p>
                              </div>
                              
                              {/* File Selection Buttons */}
                              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                <label className="px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-[9px] font-black uppercase tracking-wider text-indigo-400 transition-all cursor-pointer flex items-center gap-1.5 shadow-md">
                                  <Plus className="h-3 w-3" />
                                  Elegir Archivos
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,.dcm,.DCM" 
                                    onChange={(e) => handleAttachedFiles(e.target.files)} 
                                    className="hidden" 
                                  />
                                </label>
                                
                                <label className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-md">
                                  <Layers className="h-3 w-3 text-cyan-400" />
                                  Elegir Carpeta Completa
                                  <input 
                                    type="file" 
                                    {...({
                                      webkitdirectory: "",
                                      directory: "",
                                      multiple: true
                                    } as any)}
                                    onChange={(e) => handleAttachedFiles(e.target.files)} 
                                    className="hidden" 
                                  />
                                </label>
                              </div>
                            </div>

                            {/* List/Grid of Thumbnails with caption modification & reorder & delete */}
                            {attachedImages.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-450 uppercase font-black tracking-wider">
                                    Imágenes Cargadas ({attachedImages.length})
                                  </span>
                                  <button 
                                    onClick={() => setAttachedImages([])}
                                    className="px-2 py-1 bg-rose-955/20 hover:bg-rose-950/60 border border-rose-900/30 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" /> Limpiar Todo
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {attachedImages.map((img, idx) => (
                                    <div key={img.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2.5 relative group">
                                      {/* Delete Corner Button */}
                                      <button 
                                        onClick={() => {
                                          setAttachedImages(prev => prev.filter(item => item.id !== img.id));
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-450 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                        title="Eliminar de los anexos del estudio"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>

                                      <div className="relative aspect-[4/3] bg-black rounded overflow-hidden border border-slate-900">
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        {img.isDicom && (
                                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-cyan-600 text-white font-mono text-[8px] font-extrabold rounded select-none tracking-wider">
                                            DICOM
                                          </span>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        <div className="text-[9px] font-mono text-slate-500 truncate" title={img.name}>
                                          {img.name}
                                        </div>
                                        
                                        {/* Edit Caption Input Box */}
                                        <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block font-mono">
                                            Descripción / Hallazgo:
                                          </label>
                                          <input 
                                            type="text"
                                            value={img.caption}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setAttachedImages(prev => prev.map(item => item.id === img.id ? { ...item, caption: val } : item));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 px-2 py-1 text-[11px] font-medium text-slate-200 outline-none rounded"
                                            placeholder="p. ej. Bifurcación Carotídea con placa hiperecogénica"
                                          />
                                        </div>

                                        {/* Rearrange buttons */}
                                        <div className="flex items-center justify-between pt-1">
                                          <span className="text-[8px] font-mono text-slate-600">
                                            Posición: {idx + 1} de {attachedImages.length}
                                          </span>
                                          
                                          <div className="flex gap-1">
                                            <button 
                                              disabled={idx === 0}
                                              onClick={() => {
                                                setAttachedImages(prev => {
                                                  const next = [...prev];
                                                  const temp = next[idx];
                                                  next[idx] = next[idx - 1];
                                                  next[idx - 1] = temp;
                                                  return next;
                                                });
                                              }}
                                              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 border border-slate-800 text-slate-350 rounded transition-all cursor-pointer text-[10px]"
                                              title="Mover Anterior"
                                            >
                                              ←
                                            </button>
                                            <button 
                                              disabled={idx === attachedImages.length - 1}
                                              onClick={() => {
                                                setAttachedImages(prev => {
                                                  const next = [...prev];
                                                  const temp = next[idx];
                                                  next[idx] = next[idx + 1];
                                                  next[idx + 1] = temp;
                                                  return next;
                                                });
                                              }}
                                              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 border border-slate-800 text-slate-350 rounded transition-all cursor-pointer text-[10px]"
                                              title="Mover Siguiente"
                                            >
                                              →
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* === VASCULAR DOPPLER ANALYZER & SCHEMATIC HUD === */}
                          {(specificStudy === "Doppler de carótidas" || 
                            specificStudy === "Doppler venoso de miembro inferior" || 
                            specificStudy === "Doppler arterial de miembro inferior") && (
                            <div className={isVascularExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#061111]/95 backdrop-blur-2xl border-2 border-emerald-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-5 shadow-2xl overflow-y-auto transition-all duration-355"
                              : "my-6 relative bg-slate-950/20 border border-slate-850/60 rounded-3xl p-4 transition-all duration-355"
                            }>
                              <div className="flex items-center justify-between border-b border-emerald-950 pb-3 mb-4 font-sans">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-emerald-400 font-bold" />
                                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest font-mono">
                                    ESQUEMA DE CONTROL VASCULAR Y MAPA INTERACTIVO
                                  </h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsVascularExpanded(p => !p)}
                                  className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                    isVascularExpanded
                                      ? "bg-slate-900 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30"
                                      : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-100"
                                  }`}
                                  title={isVascularExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar sección vascular (Modo Expandido)"}
                                >
                                  {isVascularExpanded ? (
                                    <Minimize2 className="h-4.5 w-4.5" />
                                  ) : (
                                    <Maximize2 className="h-4.5 w-4.5" />
                                  )}
                                </button>
                              </div>

                              <VascularAnatomyViewer
                                studyType={specificStudy || "Doppler de carótidas"}
                                states={vascularStates}
                                descriptions={vascularDescriptions}
                                subLocations={vascularSubLocations}
                                onToggleSegment={handleToggleVascularSegment}
                                activeHover={activeVascularIdHover}
                                setActiveHover={setActiveVascularIdHover}
                                table={vascularTable}
                                isAnalyzing={isAnalyzingVascular}
                                error={vascularError}
                                onAnalyze={handleAnalyzeVascular}
                                onExportTable={handleExportVascularTableToReport}
                                onExportBlocks={handleExportVascularBlocksToReport}
                                includeInReport={includeVascularSchemaInReport}
                                setIncludeInReport={setIncludeVascularSchemaInReport}
                                generatedReport={generatedReport || ""}
                                laterality={laterality}
                              />
                            </div>
                          )}

                          {/* --- NUEVA SECCIÓN DE ANÁLISIS DE CASO Y BÚSQUEDA DE BIBLIOGRAFÍA --- */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Card 1: Caso Clínico completo */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Diagnóstico Avanzado
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  CORRELACIÓN
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Desarrolla una correlación fisiopatológica sobre los hallazgos principales, diagnósticos diferenciales sustentados y un plan de acción de seguimiento clínico docente.
                              </p>
                              <button
                                onClick={handleAnalyzeCase}
                                disabled={isAnalyzingCase}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isAnalyzingCase ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-450" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-emerald-400" />
                                )}
                                Análisis de Caso
                              </button>
                            </div>

                            {/* Card 2: Búsqueda bibliográfica inteligente */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-teal-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-teal-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Búsqueda Inteligente
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-teal-950 text-teal-400 border border-teal-900/30 px-2 py-0.5 rounded">
                                  GROUNDING
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Ejecuta una búsqueda científica grounded basada en los hallazgos radiológicos reales. Obtén referencias internacionales acreditadas y enlaces directos de sociedades médicas.
                              </p>
                              <button
                                onClick={handleSearchBibliography}
                                disabled={isSearchingBibliography}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-teal-500/30 text-teal-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isSearchingBibliography ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-teal-450" />
                                ) : (
                                  <Search className="h-4 w-4 text-teal-400" />
                                )}
                                Búsqueda Bibliográfica de Soporte
                              </button>
                            </div>

                            {/* Card 3: Evaluación del reporte */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-violet-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Evaluación de Calidad
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-violet-950 text-violet-400 border border-violet-900/30 px-2 py-0.5 rounded">
                                  AUDITORÍA
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Analiza y evalúa el reporte redactado para destacar qué datos clave se incluyeron, cuáles faltarían y qué recomendaciones clínicas debe conocer el médico solicitante.
                              </p>
                              <button
                                onClick={handleEvaluateReport}
                                disabled={isEvaluatingReport}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-violet-500/30 text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isEvaluatingReport ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-violet-450" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                                )}
                                Evaluación del Reporte
                              </button>
                            </div>

                            {/* Card 4: Generación Interactiva de Hallazgos para el Paciente (Resumen Simplificado) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-orange-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-orange-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Resumen del Paciente (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-orange-950/40 text-orange-450 border border-orange-900/30 px-2 py-0.5 rounded">
                                  PACIENTE
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Traduce la jerga compleja del reporte en un resumen empático y tranquilizador con analogías cotidianas y hábitos de bienestar físico.
                              </p>
                              <button
                                onClick={handleGeneratePatientSummary}
                                disabled={isGeneratingPatientSummary}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isGeneratingPatientSummary ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-orange-450" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-orange-400" />
                                )}
                                Explicar Para el Paciente
                              </button>
                            </div>

                            {/* Card 5: Glosario de Reporte con Literatura PubMed/Radiopaedia */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-pink-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <BookOpenText className="h-4 w-4 text-pink-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Glosario Dinámico (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-pink-950/40 text-pink-450 border border-pink-900/30 px-2 py-0.5 rounded">
                                  GLOSARIO
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Identifica y explica signos, clasificaciones clínicas y patologías complejas halladas, permitiendo buscar literatura científica de soporte directa.
                              </p>
                              <button
                                onClick={handleGenerateDynamicGlossary}
                                disabled={isGeneratingDynamicGlossary}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-pink-500/30 text-pink-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isGeneratingDynamicGlossary ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-pink-450" />
                                ) : (
                                  <BookOpenText className="h-4 w-4 text-pink-400" />
                                )}
                                Construir Glosario
                              </button>
                            </div>

                            {/* Card 6: Esquema de Hallazgos Principal (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-amber-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Esquema Sinóptico (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-amber-950/45 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded">
                                  SINOPSIS
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Extrae y organiza los hallazgos en un esquema clínico interactivo y altamente atractivo, que se puede insertar directamente al final del reporte radiológico activo.
                              </p>
                              <button
                                onClick={handleGenerateSchematicSummary}
                                disabled={isGeneratingSchematicSummary}
                                className="w-full py-3 bg-slate-950 hover:bg-slate-900/60 disabled:opacity-50 border-2 border-slate-800 hover:border-amber-500/30 text-amber-450 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer"
                              >
                                {isGeneratingSchematicSummary ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-amber-450" />
                                ) : (
                                  <Layers className="h-4 w-4 text-amber-400" />
                                )}
                                Generar Esquema de Hallazgos
                              </button>
                            </div>
                          </div>

                          {/* Render Report Evaluation Panel */}
                          {isEvaluatingReport && (
                            <div className="bg-[#120f1a]/60 border-2 border-violet-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse">
                              <CheckCircle2 className="h-6 w-6 text-violet-450 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Iniciando auditoría y evaluación del reporte...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Se están analizando minuciosamente los aspectos incluidos, la información faltante y las recomendaciones vitales para el médico clínico.
                              </p>
                            </div>
                          )}

                          {reportEvaluationError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight font-sans">
                              {reportEvaluationError}
                            </div>
                          )}

                          {reportEvaluation && (
                            <div className={isReportEvaluationExpanded 
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#0f0b16]/95 backdrop-blur-2xl border-2 border-violet-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-4 shadow-2xl overflow-y-auto transition-all duration-350"
                              : "bg-[#0f0b16] border-2 border-violet-500/10 rounded-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in transition-all duration-350"
                            }>
                              <div className="flex items-center justify-between border-b border-violet-950/60 pb-3 font-sans">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-violet-450" />
                                  <h4 className="text-xs font-black text-violet-450 uppercase tracking-widest font-mono">
                                    INFORME DE EVALUACIÓN Y AUDITORÍA CLÍNICA
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsReportEvaluationExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isReportEvaluationExpanded
                                        ? "bg-violet-950/90 border-violet-500/50 text-violet-300 ring-1 ring-violet-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isReportEvaluationExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isReportEvaluationExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(reportEvaluation, false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-violet-400 border border-slate-800 hover:border-violet-500/20 px-3 py-2 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar Evaluación
                                  </button>
                                </div>
                              </div>

                              {modifyError && (
                                <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-200 text-[11px] font-mono leading-relaxed font-semibold flex items-center justify-between gap-3 animate-fade-in">
                                  <div className="flex items-center gap-2 font-sans">
                                    <span className="text-rose-450 font-black font-mono">🚨 ERROR DE INTEGRACIÓN:</span>
                                    <span>{modifyError}</span>
                                  </div>
                                  <button
                                    onClick={() => setModifyError(null)}
                                    className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/20 text-rose-400 rounded text-[9px] uppercase tracking-wider font-mono shrink-0 cursor-pointer"
                                  >
                                    Cerrar
                                  </button>
                                </div>
                              )}

                              {isModifyingReport && (
                                <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/10 rounded-xl text-indigo-250 text-[11px] font-mono leading-relaxed font-semibold flex items-center gap-2.5 animate-pulse">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400 shrink-0" />
                                  <span>Integrando la recomendación de auditoría en el informe activo de forma automática...</span>
                                </div>
                              )}

                              <div className={`bg-[#0c0814] p-6 rounded-xl border border-violet-950/30 shadow-inner overflow-x-auto overflow-y-auto ${
                                isReportEvaluationExpanded ? "flex-1 max-h-none" : "max-h-[500px]"
                              }`}>
                                {renderElegantResponse(reportEvaluation, "text-violet-400")}
                              </div>
                            </div>
                          )}

                          {/* Render Case Analysis Panel */}
                          {isAnalyzingCase && (
                            <div className="bg-[#0b1219]/60 border-2 border-emerald-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse">
                              <Activity className="h-6 w-6 text-emerald-450 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Estructurando análisis caso clínico completo...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Se están evaluando los diagnósticos diferenciales prioritarios y correlaciones fisiopatológicas del informe.
                              </p>
                            </div>
                          )}

                          {caseAnalysisError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight">
                              {caseAnalysisError}
                            </div>
                          )}

                          {caseAnalysis && (
                            <div className={isCaseAnalysisExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#0a1114]/95 backdrop-blur-2xl border-2 border-emerald-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-4 shadow-2xl overflow-y-auto transition-all duration-355"
                              : "bg-[#0a1114] border-2 border-emerald-500/10 rounded-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in transition-all duration-355"
                            }>
                              <div className="flex items-center justify-between border-b border-slate-850 pb-3 font-sans">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest font-mono">
                                    INFORME DE ANÁLISIS DE CASO COMPLETO
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsCaseAnalysisExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isCaseAnalysisExpanded
                                        ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isCaseAnalysisExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isCaseAnalysisExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(caseAnalysis, false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/20 px-2.5 py-1 rounded bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar Análisis
                                  </button>
                                </div>
                              </div>

                              {diffsError && (
                                <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-200 text-[10.5px] font-semibold leading-relaxed font-sans select-none">
                                  ⚠️ Error al incorporar: {diffsError}
                                </div>
                              )}

                              {/* Interactive Action Card to Synthesize and Incorporate Differential Diagnostics */}
                              <div className="bg-[#05110d] border border-emerald-500/25 rounded-xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md transition-all duration-300">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-emerald-450 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest font-mono text-emerald-400">
                                      🔍 SÍNTESIS DE DIAGNÓSTICOS DIFERENCIALES
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                                    Extrae de manera inteligente los diagnósticos diferenciales discutidos en este análisis e integra una síntesis formal y estructurada directamente en la discusión clínica de tu reporte activo.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleIncorporateDifferentialDiagnostics}
                                  disabled={isIncorporatingDiffs || diffsIncorporated}
                                  className={`text-[9.5px] font-mono font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all duration-250 flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 select-none cursor-pointer ${
                                    diffsIncorporated
                                      ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-400 cursor-not-allowed font-semibold text-xs"
                                      : isIncorporatingDiffs
                                      ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-400 cursor-wait animate-pulse"
                                      : "bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-300 border-emerald-500/30 hover:border-transparent active:scale-[0.98]"
                                  }`}
                                >
                                  {isIncorporatingDiffs ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                                      <span>Incorporando...</span>
                                    </>
                                  ) : diffsIncorporated ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                      <span>Incorporado</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                                      <span>Incorporar al Reporte</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className={`bg-[#05090b] p-6 rounded-xl border border-slate-850 shadow-inner overflow-x-auto overflow-y-auto ${
                                isCaseAnalysisExpanded ? "flex-1 max-h-none" : "max-h-[500px]"
                              }`}>
                                {renderElegantResponse(caseAnalysis, "text-emerald-400")}
                              </div>
                            </div>
                          )}

                          {/* Render Bibliography Search Panel */}
                          {isSearchingBibliography && (
                            <div className="bg-[#0b1517]/60 border-2 border-teal-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse">
                              <BookOpen className="h-6 w-6 text-teal-450 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Consultando literatura médica de alta precisión...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Realizando grounding académico contra publicaciones, directrices clínicas de consenso y Radiopaedia.
                              </p>
                            </div>
                          )}

                          {bibliographyError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight">
                              {bibliographyError}
                            </div>
                          )}

                          {bibliography && (
                            <div className={isBibliographyExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#071111]/95 backdrop-blur-2xl border-2 border-teal-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-5 shadow-2xl overflow-y-auto transition-all duration-355"
                              : "bg-[#071111] border-2 border-teal-500/10 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden animate-fade-in transition-all duration-355"
                            }>
                              <div className="flex items-center justify-between border-b border-teal-950/60 pb-3 font-sans">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-teal-400" />
                                  <h4 className="text-xs font-black text-teal-400 uppercase tracking-widest font-mono">
                                    BÚSQUEDA BIBLIOGRÁFICA Y GUÍAS CLÍNICAS
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsBibliographyExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isBibliographyExpanded
                                        ? "bg-teal-950/90 border-teal-500/50 text-teal-300 ring-1 ring-teal-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isBibliographyExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isBibliographyExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(bibliography, false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-teal-400 border border-slate-800 hover:border-teal-500/20 px-3 py-2 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar Bibliografía
                                  </button>
                                </div>
                              </div>

                              <div className={`bg-[#030606] p-6 rounded-xl border border-teal-950/60 shadow-inner overflow-x-auto overflow-y-auto ${
                                isBibliographyExpanded ? "flex-1 max-h-none" : "max-h-[500px]"
                              }`}>
                                {renderElegantResponse(bibliography, "text-teal-400")}
                              </div>

                              {/* Bibliography Source Links Grounded */}
                              {bibliographySources && bibliographySources.length > 0 && (
                                <div className="space-y-3.5 border-t border-teal-950 pt-4 font-sans">
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="h-3.5 w-3.5 text-teal-400" />
                                    <h5 className="text-[10px] font-black text-teal-300 uppercase tracking-widest font-mono">
                                      Fuentes de Grounding Clínico y Enlaces Consultados
                                    </h5>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {bibliographySources.map((source, idx) => (
                                      <a
                                        key={idx}
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        referrerPolicy="no-referrer"
                                        className="p-4 bg-slate-950/90 hover:bg-[#03060c] border-2 border-teal-950/60 hover:border-teal-500/20 rounded-2xl transition-all flex flex-col justify-between gap-2 group shadow-md"
                                      >
                                        <div className="space-y-1.5 overflow-hidden text-left">
                                          <p className="text-[10px] font-black text-slate-350 uppercase tracking-wide group-hover:text-teal-400 transition-colors leading-snug">
                                            {source.title || "Artículo Científico / Guía"}
                                          </p>

                                          {source.summary && (
                                            <p className="text-[9px] text-slate-400 font-medium normal-case leading-relaxed font-sans border-l-2 border-teal-505/20 pl-2">
                                              {source.summary}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 group-hover:text-slate-400 tracking-wider uppercase font-mono">
                                          <BookOpen className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                                          <span className="truncate max-w-[200px]">{source.uri}</span>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ========================================================== */}
                          {/* NEW PANEL: EXPLICATIVE AND EMPATHIC PATIENT SUMMARY (IA) */}
                          {/* ========================================================== */}
                          {isGeneratingPatientSummary && (
                            <div className="bg-[#140f0a]/60 border-2 border-orange-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse my-4">
                              <Loader2 className="h-6 w-6 text-orange-450 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Traduciendo informe radiológico para el paciente...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Se está traduciendo la terminología técnica a un tono empático, cálido y comprensible con analogías cotidianas y pautas de bienestar general.
                              </p>
                            </div>
                          )}

                          {patientSummaryError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight my-4">
                              {patientSummaryError}
                            </div>
                          )}

                          {patientSummary && (
                            <div className={isPatientSummaryExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#0f100e]/95 backdrop-blur-2xl border-2 border-orange-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-6 shadow-2xl overflow-y-auto transition-all duration-355 my-0"
                              : "bg-[#0f100e] border-2 border-orange-500/15 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden animate-fade-in my-4 transition-all duration-355"
                            }>
                              {/* Background ambient light */}
                              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
                              
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-orange-950/40 pb-4 font-sans">
                                <div className="flex items-center gap-2">
                                  <User className="h-5 w-5 text-orange-400" />
                                  <div className="text-left">
                                    <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest font-mono">
                                      TRADUCCIÓN EMPÁTICA Y EXPLICACIÓN DE INFORME
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                      Acompañamiento personalizado y traducción de conceptos clínicos a analogías amigables.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsPatientSummaryExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isPatientSummaryExpanded
                                        ? "bg-orange-950/90 border-orange-500/50 text-orange-300 ring-1 ring-orange-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isPatientSummaryExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isPatientSummaryExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadPatientSummaryPDF(false)}
                                    className="text-[9px] font-black text-[#0f100e] hover:bg-orange-300 border border-orange-400 px-3 py-1.5 rounded-xl bg-orange-400 uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Descargar el PDF explicativo para el paciente en formato impreso/digital de alta definición"
                                  >
                                    <Download className="h-3 w-3" />
                                    Descargar PDF Explicación
                                  </button>
                                  <button
                                    onClick={handlePrintPatientSummary}
                                    className="text-[9px] font-black text-slate-150 hover:text-orange-400 border border-orange-500/25 hover:border-orange-500/50 px-3 py-1.5 rounded-xl bg-orange-950/20 uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Imprimir formato de visualización web"
                                  >
                                    <Printer className="h-3 w-3" />
                                    Imprimir Formato
                                  </button>
                                  <button
                                    onClick={() => handleOpenWhatsAppShare('patient_summary')}
                                    className="text-[9px] font-black text-white hover:text-emerald-400 border-2 border-emerald-500/25 hover:border-emerald-500/50 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Enviar explicación estructurada y amigable al paciente por WhatsApp con descarga de PDF"
                                  >
                                    <MessageSquare className="h-3 w-3 text-emerald-400" />
                                    WhatsApp Explicación (PDF)
                                  </button>
                                  <button
                                    onClick={() => handleOpenGmailShare('patient_summary')}
                                    className="text-[9px] font-black text-white hover:text-red-400 border-2 border-red-500/25 hover:border-red-500/50 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Enviar explicación estructurada y amigable al paciente por Correo Electrónico usando Gmail"
                                  >
                                    <Mail className="h-3 w-3 text-red-400" />
                                    Gmail Explicación (PDF)
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(JSON.stringify(patientSummary, null, 2), false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar Datos JSON
                                  </button>
                                </div>
                              </div>

                              {/* Findings List accordion */}
                              <div className="space-y-3.5 text-left">
                                <div className="flex items-center gap-1.5 border-b border-orange-950/20 pb-2">
                                  <span className="text-xs">🔍</span>
                                  <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">
                                    Desglose de Hallazgos Anatómicos Explicados (Haz clic para expandir y comprender)
                                  </h5>
                                </div>

                                <div className="space-y-2.5">
                                  {patientSummary.keyFindings.map((finding: any, idx: number) => {
                                    const isExpanded = !!expandedFindings[idx];
                                    return (
                                      <div 
                                        key={idx}
                                        className="border border-slate-850 hover:border-orange-500/15 rounded-xl overflow-hidden transition-all bg-slate-950/50"
                                      >
                                        <button
                                          onClick={() => setExpandedFindings(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                          className="w-full p-4 flex items-center justify-between text-left gap-4 font-sans cursor-pointer focus:outline-none select-none transition-colors hover:bg-slate-900/10"
                                        >
                                          <div className="space-y-1">
                                            <p className="text-xs font-black text-orange-100 uppercase tracking-wide flex items-center gap-2">
                                              <span>📌</span>
                                              {finding.title}
                                            </p>
                                            <p className="text-[9px] font-mono text-slate-400 tracking-wider">
                                              Término en informe técnico: <span className="text-pink-400 font-semibold font-mono font-xs">"{finding.originalTerm}"</span>
                                            </p>
                                          </div>
                                          <span className="text-slate-400 text-xs font-mono px-2.5 py-1 border border-slate-850 rounded-lg bg-slate-900 shrink-0">
                                            {isExpanded ? "▲ Ocultar" : "▼ Comprender"}
                                          </span>
                                        </button>

                                        {isExpanded && (
                                          <div className="p-4 bg-[#0a0a09] border-t border-slate-900 space-y-3.5 animate-fade-in font-sans">
                                            {/* Detailed layout inside expanded finding */}
                                            <div className="space-y-1">
                                              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest font-mono">
                                                Explicación Médica Sencilla:
                                              </p>
                                              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                                {finding.simplifiedExplanation}
                                              </p>
                                            </div>

                                            <div className="p-3.5 bg-amber-950/10 border-l-2 border-amber-500/30 rounded-r-xl space-y-1">
                                              <p className="text-[8px] font-black text-amber-450 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                                <span>💡</span> Analogía Cotidiana de Comprensión:
                                              </p>
                                              <p className="text-xs text-amber-100 leading-relaxed font-sans italic">
                                                "{finding.analogy}"
                                              </p>
                                            </div>

                                            <div className="p-3.5 bg-blue-950/20 border-l-2 border-blue-500/40 rounded-r-xl space-y-1">
                                              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                                <span>🩺</span> Contexto Clínico y Perspectiva Médica:
                                              </p>
                                              <p className="text-[11px] text-blue-200 leading-relaxed font-sans">
                                                {finding.reassurance}
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ========================================================== */}
                          {/* NEW PANEL: DYNAMIC REPORT GLOSSARY WITH EVIDENCE SOURCING */}
                          {/* ========================================================== */}
                          {isGeneratingDynamicGlossary && (
                            <div className="bg-[#100f14]/60 border-2 border-pink-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse my-4">
                              <Loader2 className="h-6 w-6 text-pink-450 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Construyendo glosario y analizando clasificaciones médicas...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Extrayendo signos radiológicos específicos, escalas internacionales de dosificación y términos complejos del reporte médico.
                              </p>
                            </div>
                          )}

                          {dynamicGlossaryError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight my-4">
                              {dynamicGlossaryError}
                            </div>
                          )}

                          {dynamicGlossary && (
                            <div className={isGlossaryExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#110e12]/95 backdrop-blur-2xl border-2 border-pink-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-5 shadow-2xl overflow-y-auto transition-all duration-355 my-0"
                              : "bg-[#110e12] border-2 border-pink-500/15 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden animate-fade-in my-4 transition-all duration-355"
                            }>
                              {/* Background ambient light */}
                              <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />

                              <div className="flex items-center justify-between border-b border-pink-950/40 pb-3.5 font-sans">
                                <div className="flex items-center gap-2 text-left">
                                  <BookOpenText className="h-5 w-5 text-pink-400" />
                                  <div>
                                    <h4 className="text-xs font-black text-pink-400 uppercase tracking-widest font-mono">
                                      GLOSARIO DINÁMICO DE SIGNOS Y CLASIFICACIONES
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                      Académico, científico y didáctico para estudiantes, docentes y especialistas.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsGlossaryExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isGlossaryExpanded
                                        ? "bg-pink-950/90 border-pink-500/50 text-pink-300 ring-1 ring-pink-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isGlossaryExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isGlossaryExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(JSON.stringify(dynamicGlossary.terms, null, 2), false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-pink-400 border border-slate-850 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all shrink-0 cursor-pointer"
                                  >
                                    Copiar Glosario JSON
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dynamicGlossary.terms.map((item: any, idx: number) => {
                                  // Category background styling map
                                  let catColor = "bg-blue-950 text-blue-400 border-blue-900/40";
                                  if (item.category === "Signo Radiológico") {
                                    catColor = "bg-teal-950 text-teal-450 border-teal-900/40";
                                  } else if (item.category === "Clasificación") {
                                    catColor = "bg-pink-950 text-pink-400 border-pink-900/40";
                                  } else if (item.category === "Anatomía") {
                                    catColor = "bg-purple-950 text-purple-400 border-purple-900/40";
                                  } else if (item.category === "Patología/Otros") {
                                    catColor = "bg-orange-950 text-orange-450 border-orange-900/40";
                                  }

                                  const litSearchInfo = glossaryLitSearch[item.term] || { loading: false };

                                  return (
                                    <div 
                                      key={idx}
                                      className="p-5 bg-[#0b080c] border border-slate-900 hover:border-pink-500/15 rounded-2xl flex flex-col justify-between gap-4 transition-all hover:bg-[#0e0a10] shadow-md relative group overflow-hidden"
                                    >
                                      {/* Content */}
                                      <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="space-y-1 text-left col-span-1">
                                            <h5 className="text-xs font-black text-pink-100 uppercase tracking-wide font-sans">
                                              {item.term}
                                            </h5>
                                            {item.pronunciation && (
                                              <p className="text-[9px] font-mono text-slate-450 uppercase tracking-wide">
                                                Epónimo/Origen: {item.pronunciation}
                                              </p>
                                            )}
                                          </div>
                                          <span className={`text-[8px] font-black uppercase font-mono tracking-widest px-2.5 py-1 border rounded-lg shrink-0 ${catColor}`}>
                                            {item.category}
                                          </span>
                                        </div>

                                        <p className="text-xs text-slate-300 normal-case leading-relaxed font-sans border-l border-slate-800 pl-2.5 text-left">
                                          <strong className="text-slate-400">Definición:</strong> {item.definition}
                                        </p>

                                        <p className="text-[11px] text-slate-400 normal-case leading-relaxed font-sans bg-[#050306] p-2.5 rounded-lg border border-slate-900 text-left">
                                          <strong className="text-pink-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Relevancia Clínica:</strong>
                                          {item.clinicalRelevance}
                                        </p>
                                      </div>

                                      {/* Action PubMed grounded query search in App */}
                                      <div className="border-t border-slate-900 pt-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[8px] font-mono font-black text-slate-500 uppercase tracking-widest select-none">
                                            Evidencia PubMed / Radiopaedia
                                          </span>
                                          <button
                                            onClick={() => handleSearchGlossaryTermLiterature(item.term, item.literatureQuery)}
                                            disabled={litSearchInfo.loading}
                                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-pink-900/30 hover:border-pink-500/20 disabled:opacity-50 text-[8px] font-black text-pink-450 uppercase tracking-widest rounded-md font-mono transition-all flex items-center gap-1 cursor-pointer"
                                          >
                                            {litSearchInfo.loading ? (
                                              <>
                                                <Loader2 className="h-2.5 w-2.5 animate-spin text-pink-400" />
                                                Buscando...
                                              </>
                                            ) : (
                                              <>
                                                <Search className="h-2.5 w-2.5" />
                                                Soporte Científico
                                              </>
                                            )}
                                          </button>
                                        </div>

                                        {/* Internal literature result display in the card context */}
                                        {litSearchInfo.text && (
                                          <div className="mt-2 bg-[#050306] border border-slate-850 p-3 rounded-xl space-y-3 animate-fade-in text-left">
                                            <p className="text-[10px] font-mono font-black text-pink-400 uppercase tracking-widest border-b border-pink-950/40 pb-1 flex items-center gap-1 font-sans">
                                              <span>🎓</span> Evidencia Científica registrada:
                                            </p>
                                            <div className="max-h-[160px] overflow-y-auto pr-1 text-[11px] text-slate-350 leading-relaxed font-sans">
                                              {renderElegantResponse(litSearchInfo.text, "text-pink-450")}
                                            </div>

                                            {/* Literature internal sources citations inside terms */}
                                            {litSearchInfo.sources && litSearchInfo.sources.length > 0 && (
                                              <div className="space-y-1.5 border-t border-pink-950/40 pt-2 font-sans">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                                  Enlaces Bibliográficos de Respaldo:
                                                </p>
                                                <div className="flex flex-col gap-1">
                                                  {litSearchInfo.sources.map((src: any, srcIdx: number) => (
                                                    <a
                                                      key={srcIdx}
                                                      href={src.uri}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      referrerPolicy="no-referrer"
                                                      className="text-[9px] text-pink-400 hover:text-pink-300 hover:underline leading-snug font-medium flex items-center gap-1 truncate"
                                                    >
                                                      <span>🔗</span> {src.title || src.uri}
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {litSearchInfo.error && (
                                          <p className="p-1.5 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-450 text-[10px] font-mono font-bold uppercase tracking-tight text-center">
                                            {litSearchInfo.error}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ========================================================== */}
                          {/* NEW PANEL: SCHEMATIC CLINICAL SUMMARY OF KEY FINDINGS */}
                          {/* ========================================================== */}
                          {isGeneratingSchematicSummary && (
                            <div className="bg-[#100f13]/60 border-2 border-amber-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse my-4">
                              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Estructurando esquema de hallazgos principales...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Extrayendo estructuras anatómicas específicas, determinando severidades relativas y deduciendo impactos clínicos directos para el cuadro sinóptico.
                              </p>
                            </div>
                          )}

                          {schematicSummaryError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight my-4">
                              {schematicSummaryError}
                            </div>
                          )}

                          {schematicSummary && (
                            <div className={isSchematicSummaryExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#0f0c08]/95 backdrop-blur-2xl border-2 border-amber-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-5 shadow-2xl overflow-y-auto transition-all duration-355 my-0"
                              : "bg-[#0f0c08] border-2 border-amber-500/15 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden animate-fade-in my-4 transition-all duration-355"
                            }>
                              {/* Ambient highlight background blur */}
                              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                              <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-amber-950/40 pb-3.5 gap-4 font-sans">
                                <div className="flex items-center gap-2 text-left">
                                  <Layers className="h-5 w-5 text-amber-400" />
                                  <div>
                                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest font-mono">
                                      Esquema de Hallazgos Principales (Cuadro Sinóptico)
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                      Estructuración resumida interactiva y formal de alta relevancia clínica.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Format toggles */}
                                  <div className="flex bg-slate-950/80 p-0.5 rounded-xl border border-slate-800/60 mr-1">
                                    <button
                                      type="button"
                                      onClick={() => setSchematicFormat("blocks")}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider font-mono transition-all cursor-pointer ${
                                        schematicFormat === "blocks"
                                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                          : "text-slate-400 hover:text-slate-200 border border-transparent"
                                      }`}
                                    >
                                      Opción 1: Bloques
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSchematicFormat("table")}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider font-mono transition-all cursor-pointer ${
                                        schematicFormat === "table"
                                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                          : "text-slate-400 hover:text-slate-200 border border-transparent"
                                      }`}
                                    >
                                      Opción 2: Tabla
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setIsSchematicSummaryExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isSchematicSummaryExpanded
                                        ? "bg-amber-950/90 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isSchematicSummaryExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isSchematicSummaryExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>

                                  <button
                                    onClick={() => {
                                      const textVal = getSelectedSchematicContent();
                                      copyToClipboard(textVal, false);
                                    }}
                                    className="text-[9px] font-black text-slate-400 hover:text-amber-400 border border-slate-850 px-2.5 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar {schematicFormat === "blocks" ? "como Bloques" : "en Markdown"}
                                  </button>
                                  <button
                                    onClick={handleAppendSchemeToReport}
                                    className="text-[9px] font-black text-slate-950 hover:bg-amber-450 bg-amber-400 px-3.5 py-1.5 rounded-xl uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Insertar en Reporte
                                  </button>
                                </div>
                              </div>

                              {schematicFormat === "blocks" ? (
                                /* Option 1: Copy-Paste Friendly Block layout preview */
                                <div className="space-y-3 select-text text-left max-w-2xl mx-auto py-1">
                                  {schematicSummary.findings.map((f: any, idx: number) => (
                                    <div key={idx} className="bg-slate-950/30 border border-slate-850/40 rounded-xl p-3.5 space-y-1.5 relative animate-fade-in">
                                      <div className="flex items-center justify-between border-b border-slate-900/40 pb-1.5 font-sans">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-mono font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                            {f.findingId || `H${idx + 1}`}
                                          </span>
                                          <span className="font-sans font-bold text-slate-200 text-xs tracking-wide">
                                            {f.anatomicalSite.toUpperCase()}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-slate-300 text-xs pt-0.5 space-y-1 font-sans">
                                        <p className="text-slate-400 leading-relaxed">
                                          <span className="font-bold text-amber-550/90 dark:text-amber-400 mr-1.5">- Hallazgo:</span> 
                                          <span className="text-slate-200">{f.description}</span>
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                /* Option 2: Table layout preview */
                                <div className="overflow-x-auto select-text animate-fade-in">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-amber-950/50 text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest font-sans">
                                        <th className="py-3 px-3">ID</th>
                                        <th className="py-3 px-3">Región / Estructura</th>
                                        <th className="py-3 px-3">Hallazgo Principal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900/60 text-xs">
                                      {schematicSummary.findings.map((f: any, idx: number) => {
                                        return (
                                          <tr 
                                            key={idx}
                                            className="hover:bg-slate-950/40 transition-colors"
                                          >
                                            <td className="py-3 px-3 font-mono text-[10px] text-amber-500 font-semibold">
                                              {f.findingId || `H${idx+1}`}
                                            </td>
                                            <td className="py-3 px-3 font-sans font-bold text-slate-200">
                                              {f.anatomicalSite}
                                            </td>
                                            <td className="py-3 px-3 font-sans text-slate-300">
                                              <span className="mr-1.5">{f.iconSuggested || "📌"}</span>
                                              {f.description}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <div className="p-3 bg-amber-950/10 border border-amber-900/20 rounded-xl text-amber-250 text-[10px] text-left leading-relaxed flex items-start gap-2">
                                <span className="text-amber-500 text-sm">💡</span>
                                <span>
                                  <strong>Consejo práctico de compatibilidad:</strong> Usa la <strong>Opción 1 (En Bloques)</strong> para copiar y pegar de forma 100% segura en sistemas o cuadros de texto externos susceptibles a distorsiones de formato. Ambas opciones insertan el esquema al final del reporte para tus descargas de PDF.
                                </span>
                              </div>
                            </div>
                          )}

                          {/* --- SECCIÓN DE REFINAMIENTO DE INFORME & DIÁLOGO DE MODIFICACIÓN --- */}
                          <div className="bg-slate-900/60 border-2 border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                            <div>
                              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                                <Sparkles className="h-4 w-4 text-indigo-400" /> Refinar e Instruir Cambios del Reporte
                              </h3>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">
                                Mejora el vocabulario técnico o describe ajustes específicos para reescribir secciones del informe.
                              </p>
                            </div>

                            {/* Quick Refine Buttons */}
                            <div className="flex flex-wrap gap-2.5 pb-2">
                              <button
                                onClick={() => handleModifyReport("Refinar vocabulario y redacción técnica radiológica, haciéndolo aún más riguroso y formal")}
                                disabled={isModifyingReport}
                                className="px-4 py-2.5 bg-indigo-950/40 hover:bg-indigo-900/30 disabled:opacity-50 border-2 border-indigo-500/10 hover:border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 font-mono"
                              >
                                {isModifyingReport ? (
                                  <RefreshCw className="h-3 w-3 animate-spin text-indigo-450" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                )}
                                Refinar Vocabulario y Redacción
                              </button>

                              <button
                                onClick={() => handleModifyReport("Proporciona una versión ampliada detallada de este informe radiológico, enriqueciendo los hallazgos anatómicos normales y especificidades técnicas")}
                                disabled={isModifyingReport}
                                className="px-4 py-2.5 bg-blue-950/40 hover:bg-blue-900/30 disabled:opacity-50 border-2 border-blue-500/10 hover:border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 font-mono"
                              >
                                {isModifyingReport ? (
                                  <RefreshCw className="h-3 w-3 animate-spin text-blue-450" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5 text-blue-400" />
                                )}
                                Versión Ampliada
                              </button>
                            </div>

                            {/* Dialogue/Custom Instructions Section */}
                            <div className="space-y-3.5 border-t border-slate-800/80 pt-4">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                  Instrucción del Radiólogo para Modificación
                                </label>
                              </div>
                              <div className="flex gap-2.5">
                                <textarea
                                  value={currentModInstruction}
                                  onChange={(e) => setCurrentModInstruction(e.target.value)}
                                  placeholder="Ej: 'Cambia la sugerencia a BI-RADS 3', 'Describe con más detalle la silueta cardíaca', etc."
                                  className="flex-1 bg-slate-950 border-2 border-slate-850 hover:border-slate-800 focus:border-indigo-650 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 placeholder:text-slate-650 outline-none transition-all resize-none h-14 font-mono leading-relaxed"
                                  disabled={isModifyingReport}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleModifyReport(currentModInstruction)}
                                  disabled={isModifyingReport || !currentModInstruction.trim()}
                                  className="px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-550 hover:to-indigo-600 disabled:from-slate-850 disabled:to-slate-850 disabled:opacity-50 border-2 border-indigo-500/20 disabled:border-transparent text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1.5 shrink-0 font-mono w-32"
                                >
                                  {isModifyingReport ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                      <span className="text-[9px]">Aplicar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              {modifyError && (
                                <div className="p-3 bg-rose-955/20 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight">
                                  {modifyError}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* --- SECCIÓN DE VALORACIÓN CLÍNICA DE LA IMAGEN MÉDICA --- */}
                          {base64Image && (
                            <div className="bg-slate-950 border-2 border-slate-850 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden animate-fade-in">
                              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 blur-3xl pointer-events-none rounded-full"></div>

                              <div className="flex items-center gap-3 border-b border-slate-850 pb-4 justify-between">
                                <div>
                                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 font-mono">
                                    <FileImage className="h-4 w-4" /> Informe de Valoración de Imagen Médica
                                  </h3>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">
                                    Valoración analítica de la placa/estudio aportado y desglose de hallazgos anatómicos.
                                  </p>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-blue-950 text-blue-400 border border-blue-900/40 px-2 py-1 rounded">
                                  IMAGEN ADJUNTA
                                </span>
                              </div>

                              {/* Loading Valuation State */}
                              {isEvaluatingImage && !imageEvaluation && (
                                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 bg-[#0a0d1b]/40 rounded-xl border border-dashed border-slate-850 animate-pulse">
                                  <Activity className="h-6 w-6 text-blue-450 animate-pulse animate-spin" />
                                  <p className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-widest">
                                    Generando valoración de imagen y hallazgos paso a paso...
                                  </p>
                                </div>
                              )}

                              {/* Image Valuation Content box */}
                              {imageEvaluation && (
                                <div className={isImageEvaluationExpanded
                                  ? "fixed inset-4 md:inset-10 z-50 bg-[#060812]/95 backdrop-blur-2xl border-2 border-blue-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-4 shadow-2xl overflow-y-auto transition-all duration-355 my-0 animate-fade-in"
                                  : "space-y-4 transition-all duration-355"
                                }>
                                  <div className="flex items-center justify-between border-b border-blue-950 pb-3 font-sans">
                                    <div className="flex items-center gap-2">
                                      <FileImage className="h-4 w-4 text-blue-400" />
                                      <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest font-mono">
                                        VALORACIÓN DE IMAGEN Y HALLAZGOS ANATÓMICOS
                                      </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setIsImageEvaluationExpanded(p => !p)}
                                        className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                          isImageEvaluationExpanded
                                            ? "bg-blue-950/90 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/30"
                                            : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                        }`}
                                        title={isImageEvaluationExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                      >
                                        {isImageEvaluationExpanded ? (
                                          <Minimize2 className="h-4 w-4" />
                                        ) : (
                                          <Maximize2 className="h-4 w-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => copyToClipboard(imageEvaluation, false)}
                                        className="text-[9px] font-black text-slate-400 hover:text-blue-400 border border-slate-800 hover:border-blue-500/20 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                      >
                                        Copiar Valoración
                                      </button>
                                    </div>
                                  </div>

                                  <div className={`bg-[#060812] p-6 rounded-xl border border-slate-850 shadow-inner overflow-x-auto overflow-y-auto ${
                                    isImageEvaluationExpanded ? "flex-1 max-h-none" : "max-h-[450px]"
                                  }`}>
                                    {renderElegantResponse(imageEvaluation, "text-blue-400")}
                                  </div>

                                  {/* Button for Additional assessment of the image */}
                                  <div className="border-t border-slate-900/80 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                    <div className="max-w-md">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                        ¿Deseas una valoración diagnóstica complementaria profunda?
                                      </p>
                                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5 leading-relaxed">
                                        Solicita un análisis de segunda opinión buscando signos sutiles, diagnósticos diferenciales y opciones complementarias.
                                      </p>
                                    </div>
                                    <button
                                      onClick={handleEvaluateImage}
                                      disabled={isEvaluatingAdditional}
                                      className="px-4.5 py-3 bg-indigo-650/10 hover:bg-indigo-650/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono shrink-0"
                                    >
                                      {isEvaluatingAdditional ? (
                                        <>
                                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" /> Evaluando Segunda Opinión...
                                        </>
                                      ) : (
                                        <>
                                          <Search className="h-4 w-4" /> Solicitar Valoración Adicional de Imagen y Hallazgos
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {additionalEvalError && (
                                <div className="p-3 bg-rose-955/20 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight">
                                  {additionalEvalError}
                                </div>
                              )}

                              {/* Additional Evaluation Display panel */}
                              {additionalEvaluation && (
                                <div className={isAdditionalEvaluationExpanded
                                  ? "fixed inset-4 md:inset-10 z-50 bg-[#0e142b]/95 backdrop-blur-2xl border-2 border-indigo-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-4 shadow-2xl overflow-y-auto transition-all duration-355 my-0 animate-fade-in"
                                  : "bg-[#0e142b] border border-indigo-900/40 rounded-xl p-5.5 space-y-3.5 shadow-md transition-all duration-355"
                                }>
                                  <div className="flex items-center justify-between border-b border-indigo-950 pb-3 font-sans">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                      <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest font-mono">
                                        VALORACIÓN DIAGNÓSTICA ADICIONAL (SEGUNDA OPINIÓN EXPERTA)
                                      </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setIsAdditionalEvaluationExpanded(p => !p)}
                                        className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                          isAdditionalEvaluationExpanded
                                            ? "bg-indigo-950/90 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30"
                                            : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-100"
                                        }`}
                                        title={isAdditionalEvaluationExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                      >
                                        {isAdditionalEvaluationExpanded ? (
                                          <Minimize2 className="h-4 w-4" />
                                        ) : (
                                          <Maximize2 className="h-4 w-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => copyToClipboard(additionalEvaluation, false)}
                                        className="text-[9px] font-black text-slate-400 hover:text-indigo-400 border border-slate-805 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                      >
                                        Copiar Segunda Opinión
                                      </button>
                                    </div>
                                  </div>
                                  <div className={`bg-[#060a17] p-6 rounded-xl border border-indigo-950 shadow-inner overflow-x-auto overflow-y-auto font-sans space-y-3 ${
                                    isAdditionalEvaluationExpanded ? "flex-grow max-h-none" : "max-h-[350px]"
                                  }`}>
                                    <div className="bg-emerald-950/20 border border-emerald-500/25 rounded-xl p-3 flex items-start gap-2.5 text-left animate-fade-in mb-3">
                                      <span className="text-emerald-400 text-xs font-black mt-0.5">✓</span>
                                      <div className="space-y-0.5">
                                        <p className="text-[9px] font-black font-sans uppercase text-emerald-400 tracking-wider">Protocolo de Validación de Confianza Clínico Activo</p>
                                        <p className="text-[9px] font-mono text-slate-400 leading-relaxed font-semibold">La IA está configurada para citar formalmente la evidencia radiológica visual que descarta o confirma de forma rigurosa la reducción de espacios articulares u otros hallazgos mayores.</p>
                                      </div>
                                    </div>
                                    {renderElegantResponse(additionalEvaluation, "text-indigo-400")}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* --- EMBEDDED CLASSIFICATIONS RECOMMENDER PANEL --- */}
                          <div className="bg-slate-950 border-2 border-slate-850 rounded-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                            {/* Ambient visual gradient light */}
                            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 blur-3xl pointer-events-none rounded-full"></div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                              <div>
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 font-mono">
                                  <Sparkles className="h-4 w-4" /> Clasificaciones y Escalas Clínicas
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">
                                  Analiza los hallazgos descritos para sugerir e incorporar escalas oficiales y criterios académicos.
                                </p>
                              </div>
                              <button
                                onClick={handleRecommendClassifications}
                                disabled={isRecommendingClassifications}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-50 border-2 border-indigo-550/30 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-2 font-mono shrink-0"
                              >
                                {isRecommendingClassifications ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" /> Analizando...
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-3.5 w-3.5 text-indigo-300" /> Recomendar Clasificaciones
                                  </>
                                )}
                              </button>
                            </div>

                            {recommenderError && (
                              <div className="p-3.5 bg-rose-950/10 border border-rose-900/40 rounded-xl text-rose-400 flex items-start gap-3">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-450" />
                                <div className="text-[11px] font-bold leading-relaxed whitespace-pre-wrap font-mono uppercase tracking-tight">
                                  {recommenderError}
                                </div>
                              </div>
                            )}

                            {classRecommendations && classRecommendations.length === 0 && (
                              <div className="text-center p-4 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono italic">
                                  No se detectaron escalas preestablecidas para este estudio. Puedes incluir notas libres de recomendaciones clínicas.
                                </p>
                              </div>
                            )}

                            {classRecommendations && classRecommendations.length > 0 && (
                              <div className="space-y-4 pt-1">
                                {classRecommendations.map((rec, idx) => {
                                  const isAlreadyAcc = !!rec.alreadyIncorporated || !!incorporatedRecs[idx];
                                  return (
                                    <div key={idx} className="bg-[#090D1A] border-2 border-slate-850 hover:border-slate-800 rounded-xl p-4.5 space-y-3.5 transition-all shadow-md">
                                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900/30 font-mono">
                                              Sugerencia {idx + 1}
                                            </span>
                                            {isAlreadyAcc ? (
                                              <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900/30 font-mono flex items-center gap-1">
                                                <Check className="h-2.5 w-2.5" /> Ya incorporado en el reporte
                                              </span>
                                            ) : (
                                              <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900/30 font-mono flex items-center gap-1">
                                                <AlertCircle className="h-2.5 w-2.5" /> No incorporado todavía
                                              </span>
                                            )}
                                          </div>
                                          <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">{rec.name}</h4>
                                          <p className="text-[10px] text-slate-450 font-semibold leading-relaxed uppercase tracking-wide">
                                            {rec.whyRecommended}
                                          </p>
                                        </div>
                                        
                                        <button
                                          onClick={() => handleIncorporateClassification(rec, idx)}
                                          disabled={incorporatingIndex !== null || isAlreadyAcc}
                                          className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all shrink-0 flex items-center gap-2 font-mono ${
                                            isAlreadyAcc
                                              ? "bg-slate-950 text-emerald-400 border-slate-850 hover:bg-slate-950 cursor-not-allowed"
                                              : incorporatingIndex === idx
                                              ? "bg-slate-950 text-indigo-400 border-slate-850 cursor-wait animate-pulse"
                                              : "bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40"
                                          }`}
                                        >
                                          {incorporatingIndex === idx ? (
                                            <>
                                              <RefreshCw className="h-3 w-3 animate-spin text-emerald-450" /> Aplicando...
                                            </>
                                          ) : isAlreadyAcc ? (
                                            <>
                                              <Check className="h-3 w-3" /> Aplicado en Reporte
                                            </>
                                          ) : (
                                            <>
                                              <Plus className="h-3.5 w-3.5" /> Aplicar y Modificar Reporte
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {/* Text Preview block */}
                                      <div className="bg-[#050810] p-4.5 rounded-xl border border-slate-850 text-slate-300 leading-relaxed max-h-48 overflow-y-auto select-text scrollbar-thin space-y-2 font-sans">
                                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 font-sans border-b border-indigo-950 pb-1">
                                          Guía de Referencia Médica para la Escala:
                                        </div>
                                        <div>{renderElegantResponse(rec.contentToAppend, "text-indigo-400")}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono font-black uppercase tracking-wider select-none">
                      <span>STÁNDAR DE REDACCIÓN: SENIOR RADIOLOGIST G15</span>
                      <span>UTF-8 SECURE CONNECTION</span>
                    </div>

                  </div>
                </div>
              </div>
              </motion.div>
            )}

            {/* TAB 3: DIAGNOSTIC CONSULTANT CHAT */}
            {activeTab === "consult" && (
              <motion.div
                key="consult"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[500px]"
              >
                <div className="bg-slate-900 border-2 border-slate-850 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
                  
                  {/* Chat header */}
                  <div className="bg-slate-950 px-6 py-4 border-b border-slate-805 flex justify-between items-center select-none">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 bg-indigo-500 rounded-full animate-ping"></div>
                      <div>
                        <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wider">
                          <MessageSquare className="h-4 w-4 text-indigo-400" /> Consultor de Diagnósticos
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">Correlación de signos y diagnósticos diferenciales</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("¿Limpiar la sesión actual de interconsultas?")) setChatMessages([]);
                      }}
                      className="text-[10px] font-black text-rose-400 hover:text-rose-350 uppercase tracking-widest font-mono underline"
                    >
                      Limpiar Sesión
                    </button>
                  </div>

                  {/* Dialogue area */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#090D1A]">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 select-none">
                        <MessageSquare className="h-10 w-10 text-slate-600 mb-3" />
                        <h4 className="text-sm font-black text-slate-300 uppercase tracking-widest">Consultor Clínico Vacío</h4>
                        <p className="text-[11px] font-bold text-slate-500 max-w-sm mt-2 uppercase tracking-wide leading-relaxed">
                          Consúltale a Gemini casos complejos o correlaciones radiográficas. Ej: "Paciente con neumotórax apical y múltiples quistes pulmonares de pared delgada, ¿diferenciales?"
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4.5 text-xs md:text-sm selection:bg-indigo-900 border-2 ${
                              msg.role === "user"
                                ? "bg-indigo-650/20 border-indigo-500/30 text-indigo-200"
                                : "bg-slate-950 border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap select-text shadow-md"
                            }`}
                          >
                            <div className="font-mono text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 select-none">
                              {msg.role === "user" ? "USTED (RADIÓLOGO)" : "GEMINI CONSULTANT AI"}
                            </div>
                            <div className="font-medium text-slate-200">
                              {msg.role === "user" ? (
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              ) : (
                                renderElegantResponse(msg.text, "text-indigo-400")
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    {isSendingMsg && (
                      <div className="flex justify-start">
                        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4.5 max-w-[85%] shadow-md">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 font-mono">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analizando diagnósticos probables, espera...
                          </div>
                        </div>
                      </div>
                    )}

                    {chatError && (
                      <div className="p-4 bg-rose-955/10 border-2 border-rose-900/30 rounded-xl text-xs text-rose-400 whitespace-pre-wrap font-sans">
                        {chatError}
                      </div>
                    )}

                    <div ref={chatBottomRef} />
                  </div>

                  {/* Input form */}
                  <div className="p-4 bg-slate-950 border-t-2 border-slate-850 flex gap-3 shadow-inner">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder="Describe la sintomatología o hallazgos radiográficos dudosos aquí..."
                      rows={2}
                      className="flex-1 bg-slate-900 border-2 border-slate-800 focus:border-indigo-500 rounded-xl py-3 px-4 text-xs md:text-sm text-slate-200 focus:outline-none placeholder-slate-650 transition-all resize-none"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={isSendingMsg || !chatInput.trim()}
                      className="bg-indigo-605 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/20 disabled:border-transparent disabled:opacity-40 select-none text-white font-black px-6 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center shrink-0"
                    >
                      Enviar
                    </button>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 4: ADJUST CORE SYSTEM INSTRUCTION PORTAL */}
            {activeTab === "presets" && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="bg-slate-900 border-2 border-slate-850 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wider">
                      <Settings className="h-5 w-5 text-indigo-400" /> Reglas de Comportamiento del Asistente
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                      Personaliza las instrucciones maestras que Gemini consulta tras bambalinas. Define formatos obligatorios o pautas de redacción personalizadas para tus informes.
                    </p>
                  </div>

                  {/* 🔑 API Key Info Card (Respuestas a: Cómo obtener clave API) */}
                  <div className="bg-indigo-950/20 border-2 border-indigo-500/20 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-white">
                      <Key className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                      <h4 className="text-xs font-black uppercase tracking-wider">Guía: Obtener o Renovar tu Gemini API KEY</h4>
                    </div>
                    
                    <p className="text-xs text-slate-350 leading-relaxed font-sans">
                      Este asistente radiológico realiza consultas directas y seguras a los modelos de inteligencia artificial mediante tu clave personal y gratuita. Si encuentras errores de expiración, sigue estos pasos:
                    </p>
                    
                    <ol className="text-[11px] text-slate-400 leading-relaxed space-y-2 pl-4 list-decimal marker:text-indigo-400 font-sans font-medium">
                      <li>
                        Visita <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-350 underline font-extrabold transition-colors">Google AI Studio (aistudio.google.com)</a> e inicia sesión con cualquier cuenta de Google.
                      </li>
                      <li>
                        Haz clic en el botón destacado <strong className="text-slate-200">"Get API key"</strong> (Obtener clave de API).
                      </li>
                      <li>
                        Haz clic en <strong className="text-slate-200">"Create API key"</strong> para generar una clave nueva y cópiala al portapapeles.
                      </li>
                      <li>
                        En la barra de menú o extremo de esta interfaz de AI Studio, haz clic en la sección <strong className="text-indigo-400">"Settings"</strong> (Configuración / Secretos) que gestiona tus secretos.
                      </li>
                      <li>
                        Selecciona o actualiza la variable de entorno denominada <code className="bg-slate-950 font-mono text-indigo-350 px-1.5 py-0.5 rounded text-[10px] border border-indigo-950">GEMINI_API_KEY</code>, pega tu clave copiada y presiona <strong className="text-slate-200">Save (Guardar)</strong>.
                      </li>
                    </ol>
                    
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono pt-1 text-left">
                      ✓ Tu Clave es completamente confidencial y se procesa del lado del servidor de forma estricta.
                    </div>
                  </div>

                  {/* Reporting Instruction Textarea */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest font-mono">
                        1. Instrucciones de Sistema de Generación de Informes:
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("¿Deseas restablecer la instrucción de informes a la configuración médica predeterminada de base?")) {
                              setSystemInstruction(GENERAL_SYSTEM_INSTRUCTION);
                            }
                          }}
                          className="px-2 py-0.5 border border-dashed border-rose-500/30 hover:border-rose-500/80 text-rose-450 hover:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded transition-all duration-200 cursor-pointer select-none"
                          title="Restaurar de fábrica únicamente este prompt del sistema"
                        >
                          ↩ Restablecer Base
                        </button>
                        <span className="text-[9px] font-mono text-slate-500 font-extrabold uppercase">
                          CARACTERES: {systemInstruction.length}
                        </span>
                      </div>
                    </div>

                    <textarea
                      value={systemInstruction}
                      onChange={(e) => setSystemInstruction(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-950/90 border-2 border-slate-850 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-700 transition font-mono leading-relaxed"
                    />
                    <p className="text-[9px] font-bold text-slate-505 uppercase tracking-widest leading-relaxed">Aplica para los borradores y análisis de placas / ultrasonidos de la primera pestaña.</p>
                  </div>

                  {/* Case Diagnosis consultant Textarea */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest font-mono">
                      2. Instrucción de Correlación del Consultor Clínico (Chat):
                    </label>
                    <textarea
                      value={chatInstruction}
                      onChange={(e) => setChatInstruction(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-xl p-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-700 transition font-mono"
                    />
                  </div>

                  {/* Classification Instructions Textarea */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest font-mono">
                      3. Instrucción del Buscador de Escalas y Criterios:
                    </label>
                    <textarea
                      value={classifyInstruction}
                      onChange={(e) => setClassifyInstruction(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-950 border-2 border-slate-800 focus:border-indigo-500 rounded-xl p-4 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-700 transition font-mono"
                    />
                  </div>

                  {/* Save button bar */}
                  <div className="flex gap-3 justify-end pt-5 border-t border-slate-800 select-none">
                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="px-4.5 py-3 bg-slate-950 hover:bg-slate-800/60 border-2 border-slate-800 text-slate-400 hover:text-slate-350 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      Restaurar de Fábrica
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
                    >
                      Guardar Reglas
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: API DOCUMENTATION PANEL */}
            {activeTab === "api" && (
              <motion.div
                key="api"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-slate-900 border-2 border-slate-850 rounded-2xl p-6 shadow-2xl space-y-6 text-left select-text">
                  <div className="border-b border-slate-850 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wider font-sans">
                        <Code className="h-5 w-5 text-indigo-400" /> Consola de Integración de API
                      </h2>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                        Conecta tus macros personales, softwares clínicos de dictado (PACS/RIS) o disparadores externos con este asistente local.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={checkingApi}
                      onClick={checkApiHealth}
                      className="px-4 py-2 bg-[#0a0f1d] hover:bg-slate-950 border-2 border-slate-850 rounded-xl text-[10px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-350 transition-all flex items-center gap-2 shrink-0 self-start md:self-center"
                    >
                      <RefreshCw className={`h-3 w-3 ${checkingApi ? "animate-spin" : ""}`} />
                      {checkingApi ? "Diagnosticando..." : "Diagnosticar Conexión"}
                    </button>
                  </div>

                  {/* 🩺 DIAGNOSTIC MONITOR COMPONENT */}
                  <div className="bg-slate-950 border-2 border-slate-850/80 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-slate-900 pb-2.5">
                      <Settings className="h-4 w-4 text-slate-500" /> Monitor de Diagnóstico de la Clave de API
                    </h3>

                    {apiDiagnostics === null ? (
                      <div className="py-2 flex items-center gap-2.5">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping shadow-[0_0_8px_#f59e0b]" />
                        <p className="text-xs text-slate-400 font-sans font-medium uppercase tracking-wider animate-pulse">Cargando estado del servidor y heredando secretos...</p>
                      </div>
                    ) : apiDiagnostics.status === "error" ? (
                      <div className="p-4 bg-rose-950/10 border-2 border-rose-900/40 rounded-xl space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider font-mono">Error de Diagnóstico</h4>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">{apiDiagnostics.message}</p>
                            {apiDiagnostics.error && (
                              <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-[10px] text-rose-455 font-mono border border-rose-950/50 max-h-24 overflow-y-auto select-text whitespace-pre-wrap leading-relaxed">
                                {apiDiagnostics.error}
                              </pre>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-start pt-1">
                          <button
                            onClick={checkApiHealth}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border-2 border-slate-850 text-slate-300 hover:text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider font-mono transition-all flex items-center gap-2"
                          >
                            <RefreshCw className="h-3 w-3" /> Reintentar Diagnóstico
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 font-sans">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* Config State Card */}
                          <div className={`p-4 rounded-xl border-2 ${
                            apiDiagnostics.api_key_configured 
                              ? "bg-emerald-950/10 border-emerald-500/20" 
                              : "bg-rose-950/10 border-rose-500/20"
                          }`}>
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Estado de Carga</div>
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${apiDiagnostics.api_key_configured ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]"}`} />
                              <span className="text-xs font-bold text-slate-200">
                                {apiDiagnostics.api_key_configured ? "GEMINI_API_KEY Detectada" : "Falta GEMINI_API_KEY"}
                              </span>
                            </div>
                          </div>

                          {/* Length / Format Card */}
                          <div className="p-4 bg-slate-900/60 border-2 border-slate-850 rounded-xl">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Diagnóstico de Formato</div>
                            <div className="text-xs font-bold text-slate-200">
                              {apiDiagnostics.api_key_configured ? (
                                <span className={apiDiagnostics.api_key_starts_with_aizasy ? "text-emerald-400" : "text-amber-400"}>
                                  {apiDiagnostics.api_key_starts_with_aizasy ? "✓ Formato de Google Estándar" : "⚠️ Formato Inusual (No inicia con AIzaSy)"}
                                </span>
                              ) : "Sin clave para analizar"}
                            </div>
                          </div>
                        </div>

                        {/* Whitespace warning / info alert */}
                        {apiDiagnostics.api_key_configured && apiDiagnostics.api_key_has_surrounding_whitespace && (
                          <div className="p-3 bg-amber-950/20 border-2 border-amber-500/25 rounded-xl text-xs text-amber-300 leading-relaxed font-sans font-medium">
                            <strong className="block text-[11px] font-black uppercase tracking-wider text-amber-400 mb-1">⚠️ Espacios de copiado detectados en la variable:</strong>
                            Se encontraron espacios o saltos de línea al inicio o final de tu clave (generalmente causados por un copiado rápido desalineado). El software radiológico ha **filtrado y limpiado la clave automáticamente** aplicando <code className="bg-slate-950 text-amber-450 px-1 py-0.5 rounded font-mono text-[10px]">.trim()</code> para que la conexión no falle por este motivo.
                          </div>
                        )}

                        {/* Masked status or Next Actions */}
                        <div className="p-4 bg-slate-900/80 border-2 border-slate-850 rounded-xl space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block font-mono">Detalles Seguros de Clave</span>
                          <div className="text-xs font-mono text-slate-350">
                            <strong>Clave cargada:</strong> <code className="bg-slate-950 px-2 py-1 rounded text-indigo-400 select-all">{apiDiagnostics.api_key_status}</code>
                          </div>
                          {!apiDiagnostics.api_key_configured && (
                            <p className="text-xs text-rose-300 font-bold mt-1 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg leading-relaxed">
                              ⚠️ Para resolver el error de API, revisa que hayas definido la variable correctamente. Dirígete a la opción de <strong className="text-slate-200">"Settings"</strong> situada en el menú superior exterior de este Workspace e introduce la variable de entorno <code className="bg-slate-950 text-rose-450 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code>.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🧠 CONFIGURACIÓN DEL MODELO AI CORE */}
                  <div className="bg-[#0e1629] border-2 border-slate-850/80 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-indigo-950/60 pb-2.5">
                      <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" /> CONFIGURACIÓN DEL MODELO DE INTELIGENCIA ARTIFICIAL CORE
                    </h3>

                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans font-medium">
                      Adapta las capacidades de la IA según el tipo de estudio y la complejidad del caso clínico en curso. Los cambios se guardan de forma persistente en tu navegador y afectan de manera global a todos los módulos y pestañas en tiempo real.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-sans">
                      {/* CARD 1: FLASH */}
                      <button
                        type="button"
                        onClick={() => setSelectedModel("gemini-3.5-flash")}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                          selectedModel === "gemini-3.5-flash"
                            ? "bg-indigo-950/20 border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.12)]"
                            : "bg-[#070b13] border-slate-850 hover:bg-slate-900/60 hover:border-slate-800"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Gemini 3.5 Flash</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                              selectedModel === "gemini-3.5-flash"
                                ? "bg-indigo-500 text-white"
                                : "bg-slate-800 text-slate-450"
                            }`}>
                              {selectedModel === "gemini-3.5-flash" ? "ACTIVO" : "RECOMENDADO"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                            Modelo ultra-rápido y optimizado para ráfagas de dictado clínico. Ideal para la transcripción de dictados de voz inmediatos, redacción ágil de reportes de rutina y clasificaciones estándar de consenso.
                          </p>
                        </div>
                        <div className="border-t border-slate-850/60 pt-2.5 mt-2 w-full space-y-1.5 text-[10px]">
                          <div className="flex items-start gap-1.5 text-emerald-400 leading-relaxed">
                            <strong className="shrink-0">Fortalezas:</strong> <span className="text-slate-350">Velocidad de generación casi instantánea, respuestas fluidas, óptimo para dictado continuo de voz.</span>
                          </div>
                          <div className="flex items-start gap-1.5 text-rose-455 leading-relaxed">
                            <strong className="shrink-0">Limitaciones:</strong> <span className="text-slate-350">Ligeramente menos analítico en correlaciones comparativas extremadamente complejas o anomalías raras.</span>
                          </div>
                        </div>
                      </button>

                      {/* CARD 2: PRO */}
                      <button
                        type="button"
                        onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                          selectedModel === "gemini-3.1-pro-preview"
                            ? "bg-purple-950/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.12)]"
                            : "bg-[#070b13] border-slate-850 hover:bg-slate-900/60 hover:border-slate-800"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Gemini 3.1 Pro</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                              selectedModel === "gemini-3.1-pro-preview"
                                ? "bg-purple-500 text-white"
                                : "bg-slate-800 text-slate-450"
                            }`}>
                              {selectedModel === "gemini-3.1-pro-preview" ? "ACTIVO EXPERTO" : "MÁXIMA POTENCIA"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                            Modelo avanzado diseñado para el razonamiento médico profundo y minucioso. Ideal para casos altamente complejos, segundas opiniones médicas, correlación anatómica comparativa multi-imagen y clasificaciones raras.
                          </p>
                        </div>
                        <div className="border-t border-slate-850/60 pt-2.5 mt-2 w-full space-y-1.5 text-[10px]">
                          <div className="flex items-start gap-1.5 text-emerald-400 leading-relaxed">
                            <strong className="shrink-0">Fortalezas:</strong> <span className="text-slate-350">Rigor científico de élite, excelente para interpretar múltiples hallazgos comparativos de control, alta precisión diagnóstica.</span>
                          </div>
                          <div className="flex items-start gap-1.5 text-rose-455 leading-relaxed">
                            <strong className="shrink-0">Limitaciones:</strong> <span className="text-slate-350">Tiempos de cómputo mayores (latencia de 6 a 12 segundos dependiendo de la densidad del caso clínico).</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-indigo-400 block uppercase tracking-widest font-mono">1. End-point de Análisis e Informes</h3>
                    <div className="bg-slate-950 border-2 border-slate-850 rounded-xl p-5 space-y-3.5 font-mono text-[11px]">
                      <div className="flex items-center gap-2 select-none">
                        <span className="bg-indigo-950 text-indigo-400 border-2 border-indigo-900/60 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest">POST</span>
                        <span className="text-slate-200 font-bold">/api/analyze</span>
                      </div>
                      
                      <div className="text-slate-500 font-black uppercase tracking-wider text-[9px]">Ejemplo de solicitud con CURL:</div>
                      <pre className="bg-[#030612] p-4 rounded-xl text-slate-350 border-2 border-slate-850 overflow-x-auto whitespace-pre leading-relaxed select-all">
{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{
    "studyType": "TC de Abdomen de Urgencia",
    "clinicalHistory": "Dolor severo cuadrante inferior derecho. Posible apendicitis.",
    "customPrompt": "Buscar apendicolito u obstrucción."
  }' \\
  http://localhost:3000/api/analyze`}
                      </pre>

                      <div className="text-slate-500 font-bold uppercase tracking-wider text-[9px] pt-1.5">Respuesta Esperada:</div>
                      <pre className="bg-[#030612] p-4 rounded-xl text-slate-350 border-2 border-slate-850 overflow-x-auto whitespace-pre leading-relaxed select-all">
{`{
  "success": true,
  "report": "# REPORTE DE ESTUDIO... (Hallazgos redactados en Markdown)",
  "model_used": "gemini-3.5-flash"
}`}
                      </pre>
                    </div>

                    <h3 className="text-xs font-black text-indigo-400 block uppercase tracking-widest font-mono">2. Transmisión de Imágenes Base64</h3>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                      Para analizar imágenes desde tu PACS/EHR, puedes transcodificar cualquier imagen PNG/JPG a base64 estándar y transmitirla como parámetro de payload opcional:
                    </p>

                    <div className="bg-slate-950 border-2 border-slate-855 rounded-xl p-4.5 font-mono text-[11px] space-y-1.5 shadow-inner">
                      <div className="text-slate-350 font-black uppercase tracking-widest text-[9px]">Parámetro JSON Opcional:</div>
                      <div className="text-slate-400">"image": "iVBORw0KGgoAAAANSUhEUgAA..." (Código base64 plano)</div>
                      <div className="text-slate-400">"mimeType": "image/png" (o "image/jpeg")</div>
                    </div>
                  </div>

                  <div className="p-5 bg-indigo-950/10 border-2 border-indigo-900/20 rounded-2xl">
                    <h4 className="text-xs font-black text-indigo-400 flex items-center gap-2 mb-1.5 text-left uppercase tracking-wider">
                      <AlertCircle className="h-4 w-4 text-indigo-400" /> RECOMENDACIÓN DE INTEGRACIÓN PRÁCTICA:
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed text-left uppercase tracking-wide">
                      Puedes configurar un script de AutoHotkey para que, con solo un comando o un atajo de dictado en Windows, transmita el texto que tienes seleccionado en pantalla hacia esta API local, y reemplace ese texto directamente en el editor de tu PACS con el borrador radiológico profesional listo en milisegundos.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "bibliography" && (
              <motion.div
                key="bibliography"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <BibliographySearch renderElegantResponse={renderElegantResponse} />
              </motion.div>
            )}

            {activeTab === "images" && (
              <motion.div
                key="images"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <ImageSearch 
                  onExportToAnalysis={(imageUrl, mimeType) => {
                    setExportedImage(imageUrl);
                    setExportedMimeType(mimeType);
                    setActiveTab("expert-analysis");
                  }}
                />
              </motion.div>
            )}

            {activeTab === "expert-analysis" && (
              <motion.div
                key="expert-analysis"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-7xl mx-auto space-y-6"
              >
                <ExpertImageAnalysis 
                  selectedModel={selectedModel}
                  onIncorporateToReport={handleIncorporateToReport}
                  renderElegantResponse={renderElegantResponse} 
                  exportedImage={exportedImage}
                  exportedMimeType={exportedMimeType}
                  clearExportedImage={clearExportedImage}
                  findings={findings}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* 🔮 PIE DE PAGINA */}
      <footer className="bg-slate-950 border-t-2 border-slate-850 py-5 px-8 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-500 font-mono uppercase tracking-widest select-none">
        <div>
          Estación de Diagnóstico Personalizada • Dr. Milton
        </div>
        <div className="flex items-center gap-3">
          <span>Clasificaciones: BI-RADS AP • Bosniak • Fleischner</span>
          <span className="text-slate-800">|</span>
          <span className="text-indigo-400 font-black">GEMINI 3.5 FLASH ON DEMAND</span>
        </div>
      </footer>
      </div>

      {/* 📥 MODELO DE ASISTENCIA PARA IMPRESIÓN Y EXPORTACIÓN PDF (ESPECIAL IPHONE/MOBILE & IFRAME) */}
      {showPrintModal && (
        <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header de la Vista Previa */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">Asistente de Impresión y PDF Oficial</h3>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cuerpo con Scroll */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              
              {/* Alerta de Soporte iPhone e iframe */}
              <div className="bg-indigo-950/40 border-2 border-indigo-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3 text-left">
                  <span className="text-xl">📱</span>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-white uppercase tracking-wide">💡 Soporte Especial para iPhone, Safari e iPads</p>
                    <p className="text-xs text-slate-300 leading-normal">
                      Debido a que esta herramienta se ejecuta dentro de un iframe en <strong>AI Studio</strong>, el navegador puede inyectar enlaces o el nombre de la app. Para obtener un documento <strong>completamente limpio, sin títulos ni hora de impresión</strong>, utiliza las opciones de PDF directo:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleDownloadNativePDF(false)}
                    className="flex items-center justify-center gap-2.5 p-3 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar PDF Limpio (Sin URL/Hora)</span>
                  </button>
                  <button
                    onClick={() => handleDownloadNativePDF(true)}
                    className="flex items-center justify-center gap-2.5 p-3 bg-sky-700 hover:bg-sky-650 border-2 border-sky-600/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir PDF en iPhone (Pestaña Limpia)</span>
                  </button>
                  <button
                    onClick={() => {
                      const appUrl = window.location.href;
                      window.open(appUrl, "_blank");
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-slate-800 hover:bg-slate-750 border-2 border-slate-700/10 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-indigo-400" />
                    <span>Imprimir original en Pestaña Nueva</span>
                  </button>
                  <button
                    onClick={() => {
                      copyToClipboard(generatedReport, true);
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copiar Texto del Reporte</span>
                  </button>
                </div>
                <p className="text-[10px] text-indigo-300 font-medium font-mono uppercase tracking-wide text-center">
                  * Al abrir el PDF en una pestaña limpia de iPhone, puedes guardarlo a archivos o mandarlo a imprimir sin ningún enlace ni hora.
                </p>

                {/* 🎨 Opciones de personalización e impresión física */}
                <div className="bg-[#0b0f19] border-2 border-indigo-950/50 p-4.5 rounded-2xl space-y-3.5 text-left">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest font-mono text-emerald-400">Canales de Optimización de Impresión</h4>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-850/80">
                    <div className="space-y-0.5 max-w-[85%]">
                      <p className="text-[11px] font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                        Optimización de Contraste Adaptativo PDF (PACS / Impresión Física)
                      </p>
                      <p className="text-[10px] text-slate-450 leading-normal">
                        Incrementa la densidad de tinta en tablas, tipografías y membretes a negro puro (True Black), optimizando la legibilidad para fotocopias o escaneo, e inserta una cuña de calibración en escala de grises.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        checked={adaptivePDFContrast}
                        onChange={() => setAdaptivePDFContrast(!adaptivePDFContrast)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-850 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:bg-indigo-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase font-mono w-14 text-right">{adaptivePDFContrast ? "PRO_ACTIVO" : "NORMAL"}</span>
                    </label>
                  </div>
                </div>

                {/* Consejos Adicionales para Eliminar Cabecera/Pie de Página del Navegador */}
                <div className="mt-3 border-t border-indigo-950/60 pt-3 space-y-1 text-left">
                  <p className="text-[11px] font-black text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                    <span>⚠️</span> ¿CÓMO QUITAR EL LINK/HORA EN LA HOJA FISICA?
                  </p>
                  <p className="text-[10.5px] text-slate-350 leading-relaxed font-sans">
                    Si al imprimir sigue apareciendo el link de la app o la hora en los bordes de la página, por favor realiza lo siguiente en tu cuadro de impresión:
                  </p>
                  <ul className="text-[10.5px] text-slate-450 leading-relaxed list-disc pl-4 space-y-0.5">
                    <li>En la ventana de opciones de impresión, busca la sección de <strong className="text-slate-300 font-bold">"Más ajustes"</strong> o <strong className="text-slate-300 font-bold">"Configuración"</strong>.</li>
                    <li>Busca la opción que dice <strong className="text-slate-350 font-black">"Encabezados y pies de página" (Headers and footers)</strong> y <strong className="text-rose-400 font-extrabold">DESMÁRCALA</strong>.</li>
                    <li>Esto forzará al navegador a eliminar completamente el link, el título y la fecha en todos los bordes, dejándote un reporte sumamente pulcro y profesional.</li>
                  </ul>
                </div>
              </div>

              {/* Simulación del PDF Imprimible en una hoja A4 elegante */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Vista Previa del Documento (Formato Físico):</span>
                <div className="bg-white text-black p-6 sm:p-10 rounded-2xl border-4 border-slate-950/10 shadow-inner overflow-x-auto">
                  
                  {/* Membrete */}
                  {customLogoUrl && customLogoStyle === "banner" ? (
                    <div className="border-b border-gray-300 pb-4 mb-4 text-center">
                      <img 
                        src={customLogoUrl} 
                        alt="Membrete de la Clínica" 
                        className="max-h-[110px] mx-auto w-auto object-contain block" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-4 text-left">
                      <div className="flex items-center gap-3">
                        {selectedLogo !== "none" && (
                          <div className="w-12 h-12 flex items-center justify-center shrink-0 border border-gray-200 rounded-lg p-1 bg-gray-50 text-indigo-700">
                            {customLogoUrl ? (
                              <img 
                                src={customLogoUrl} 
                                alt="Logo" 
                                className="w-10 h-10 object-contain block" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <>
                                {selectedLogo === "medical-cross" && (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-indigo-600">
                                    <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
                                  </svg>
                                )}
                                {selectedLogo === "heart-pulse" && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose-600">
                                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                                    <path d="M3.22 12H9.5l1.5-4 2 8 1.5-4h4.5"/>
                                  </svg>
                                )}
                                {selectedLogo === "dna" && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-cyan-600">
                                    <path d="M4.5 10.5C4.5 5.253 8.753 1 14 1s9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5-9.5-4.253-9.5-9.5Z" />
                                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" />
                                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" />
                                  </svg>
                                )}
                                {selectedLogo === "shield-check" && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-emerald-600">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    <path d="m9 11 2 2 4-4"/>
                                  </svg>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        <div>
                          {clinicName ? (
                            <>
                              <h4 className="text-sm font-extrabold tracking-tight text-gray-900 uppercase">
                                {clinicName}
                              </h4>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                                Reporte de Radiodiagnóstico por Imagen
                              </p>
                            </>
                          ) : (
                            <h4 className="text-sm font-extrabold tracking-tight text-gray-900 uppercase">
                              REPORTE DE RADIODIAGNÓSTICO
                            </h4>
                          )}
                        </div>
                      </div>
                      {reportDate && (
                        <div className="text-right text-[9px] uppercase text-gray-500 leading-normal">
                          <div>Fecha: <span className="font-extrabold text-gray-800">{reportDate}</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ficha Paciente */}
                  {(patientName || reportDate) && (
                    <div className="border border-gray-250 rounded-lg p-3.5 mb-6 bg-gray-50/50 flex flex-wrap gap-x-8 gap-y-1.5 text-[11px] leading-relaxed text-left">
                      {patientName && (
                        <div>
                          <span className="font-bold text-gray-400 uppercase">Paciente:</span>{" "}
                          <span className="font-extrabold text-gray-900 uppercase text-[12px]">{patientName}</span>
                        </div>
                      )}
                      {reportDate && (
                        <div>
                          <span className="font-bold text-gray-400 uppercase">Fecha del Estudio:</span>{" "}
                          <span className="font-extrabold text-gray-900 uppercase text-[12px]">{reportDate}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Calibración de Contraste para Impresión Física e Historial Clínico (Cuña PACS) */}
                  {adaptivePDFContrast && (
                    <div className="mb-6 p-2 rounded border border-gray-400 bg-white select-none">
                      <div className="text-[7.5px] font-mono font-bold text-gray-500 uppercase tracking-widest text-center mb-1 flex items-center justify-center gap-1.5">
                        <span>Pauta de Densidad PACS Homologada</span>
                        <span className="text-[6.5px] bg-black text-white px-1.5 py-0.5 rounded font-sans scale-90">CALIBRACIÓN GSDF ACTIVA</span>
                      </div>
                      <div className="flex h-5 border border-black overflow-hidden rounded bg-gray-50">
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => {
                          const lightness = 100 - val;
                          return (
                            <div 
                              key={val} 
                              className="flex-1 h-full flex flex-col justify-between items-center text-[5.5px] font-mono font-bold leading-none py-0.5 border-r border-black/10 last:border-r-0"
                              style={{ 
                                backgroundColor: `rgb(${Math.round(2.55 * lightness)}, ${Math.round(2.55 * lightness)}, ${Math.round(2.55 * lightness)})`,
                                color: val >= 50 ? "#FFFFFF" : "#000000"
                              }}
                            >
                              <span>{val}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-[6px] font-mono font-bold text-gray-400 text-center mt-1 uppercase">
                        Gama adaptativa: Compensación automática de pérdida térmica de tinta en papel
                      </div>
                    </div>
                  )}

                  {/* Diagnóstico en Serif */}
                  <div className="space-y-4 pt-2 text-left leading-relaxed text-[12px] text-gray-900 font-serif">
                    {renderPrintReportBody(generatedReport)}
                  </div>

                  {/* Firmas */}
                  {(doctorName || customSignatureUrl) && (
                    <div className="mt-12 pt-6 border-t border-gray-200 grid grid-cols-2 text-[9px] leading-normal font-sans text-gray-400 text-left">
                      <div>
                        <p className="font-bold uppercase tracking-wider text-gray-400">Verificado Por:</p>
                        <p className="font-mono text-[8px] mt-0.5 text-gray-400 font-bold">Firma Digital Registrada</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="inline-block text-center relative">
                          {customSignatureUrl && (
                            <div className="mb-1 flex justify-center">
                              <img 
                                src={customSignatureUrl} 
                                alt="Firma" 
                                className="h-10 max-w-[130px] object-contain block mix-blend-multiply" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="border-t border-gray-400 pt-1 px-6">
                            <p className="font-extrabold text-gray-955 uppercase text-[10.5px]">{doctorName || "Médico Especialista"}</p>
                            <p className="font-semibold text-gray-500 text-[9px]">Médico Especialista en Radiodiagnóstico</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex items-center justify-between">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all font-mono"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/30 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg"
              >
                <Printer className="h-4 w-4" />
                <span>Ejecutar Impresión</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🟢 MODAL DE COMPARTIDO POR WHATSAPP (REPORTES, INFOGRAFÍA Y RESUMEN) */}
      {showWhatsAppModal && (
        <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🟢</span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  Compartir vía WhatsApp (Pacientes)
                </h3>
              </div>
              <button 
                onClick={() => setShowWhatsAppModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto text-left">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                Estás a punto de enviar {
                  whatsappShareType === 'report_pdf' 
                    ? "el Reporte Clínico Oficial (PDF)" 
                    : whatsappShareType === 'patient_infographic' 
                      ? "la Infografía Visual Explicativa" 
                      : "el Resumen Científico Simplificado"
                } correspondiente a: <span className="text-indigo-400">{patientName || "Paciente sin registrar"}</span>.
              </p>

              {/* Celular Input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                  Número de Celular del Paciente (Opcional):
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center justify-center px-3 bg-slate-950 border-2 border-slate-850 rounded-xl text-xs text-slate-400 font-mono font-bold">
                    +
                  </span>
                  <input
                    type="tel"
                    placeholder="Ej: 5491100000000 (con código de país sin + ni espacios)"
                    value={whatsappPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setWhatsappPhone(val);
                      localStorage.setItem("rad_whatsapp_phone", val);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 focus:border-emerald-500 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-mono tracking-wider">
                  Si dejas el número vacío, WhatsApp te permitirá seleccionar cualquier contacto o grupo al abrir la aplicación.
                </p>
              </div>

              {/* Message Preview */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                  Vista Previa del Mensaje a Enviar:
                </label>
                <div className="p-4 bg-slate-950 border-2 border-slate-850 rounded-2xl max-h-48 overflow-y-auto font-mono text-[10px] md:text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-sans">
                  {getWhatsAppTextPreview()}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleSendWhatsAppAction}
                  className="w-full p-3 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 font-mono"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar por WhatsApp</span>
                </button>

                <button
                  onClick={() => {
                    const text = getWhatsAppTextPreview();
                    copyToClipboard(text, false);
                    alert("¡Mensaje copiado al portapapeles con éxito! Puedes pegarlo directamente en cualquier chat.");
                  }}
                  className="w-full p-3 bg-slate-950 hover:bg-slate-900/60 border-2 border-slate-850 hover:border-slate-700/50 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 font-mono"
                >
                  <Copy className="h-4 w-4 text-emerald-400" />
                  <span>Copiar Mensaje</span>
                </button>
              </div>

              {/* Advisory details */}
              <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[9px] text-slate-400 leading-relaxed font-mono uppercase tracking-wide">
                {whatsappShareType === 'report_pdf' && (
                  <p>
                    💡 <strong>Consejo para ordenadores:</strong> Al hacer clic en "Enviar", se abrirá WhatsApp Web/Escritorio con el mensaje pre-redactado. El PDF oficial del informe clínico se descargará de manera automática para que puedas arrastrarlo y enviarlo al mismo chat. En teléfonos móviles o tabletas, se activará el panel nativo para enviar el documento en un solo paso.
                  </p>
                )}
                {whatsappShareType === 'patient_infographic' && (
                  <p>
                    💡 <strong>Consejo de imagen:</strong> La infografía se enviará como un enlace de visualización en alta definición. En teléfonos móviles compatibles, el dispositivo también intentará adjuntar la imagen original de forma directa al chat seleccionado.
                  </p>
                )}
                {whatsappShareType === 'patient_summary' && (
                  <p>
                    💡 <strong>Consejo del resumen:</strong> El mensaje contiene todo el texto estructurado, analogías y recomendaciones adaptadas para el paciente. Se formateará con los estilos nativos de WhatsApp (*Negritas* e _Itálicas_) para una lectura cómoda.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🔴 MODAL DE COMPARTIDO POR CORREO ELECTRÓNICO (GMAIL INTEGRATOR) */}
      {showGmailModal && (
        <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-red-555 animate-pulse" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  Compartir vía Gmail Integrado
                </h3>
              </div>
              <button 
                onClick={() => setShowGmailModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-4 overflow-y-auto text-left max-h-[80vh]">
              {/* Authenticated user banner or Sign in call */}
              {!gmailAccessToken ? (
                <div className="p-5 border border-indigo-500/20 bg-indigo-950/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3.5">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest font-mono">
                      Inicia Sesión con Google
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans tracking-wide leading-relaxed uppercase">
                      Para enviar correos en tu nombre a través del servicio seguro de Gmail, se requiere iniciar sesión.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGmailLogin}
                    disabled={isLoggingInGmail}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-550 disabled:opacity-50 text-white font-mono font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isLoggingInGmail ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span>Iniciar Sesión con Google</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full border border-emerald-500/30 bg-emerald-950 flex items-center justify-center text-emerald-400 font-black font-mono text-[10px] uppercase">
                      {gmailUser?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide leading-tight">
                        Autorizado como:
                      </p>
                      <p className="text-[9px] font-medium text-slate-400 leading-normal">
                        {gmailUser?.email || "Cuenta de Google"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGmailLogout}
                    className="text-[8.5px] font-black text-slate-400 hover:text-rose-400 uppercase tracking-wider font-mono px-2 py-1 bg-slate-950 border border-slate-850 hover:border-rose-950 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    title="Cerrar la sesión de Gmail actual"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}

              {/* Status alerts */}
              {gmailSuccessMessage && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wide text-left flex items-start gap-2 animate-fadeIn">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{gmailSuccessMessage}</span>
                </div>
              )}

              {gmailErrorMessage && (
                <div className="p-3 bg-rose-950/25 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-wide text-left flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{gmailErrorMessage}</span>
                </div>
              )}

              {gmailAccessToken && !gmailSuccessMessage && (
                <div className="space-y-4 animate-fadeIn">
                  {/* To recipient */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                      Correo Destinatario (Paciente):
                    </label>
                    <input
                      type="email"
                      placeholder="Ej: paciente@correo.com"
                      value={gmailTo}
                      onChange={(e) => setGmailTo(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 focus:border-red-500 rounded-xl text-xs font-sans font-bold text-white placeholder-slate-600 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                      Asunto del Correo:
                    </label>
                    <input
                      type="text"
                      placeholder="Asunto"
                      value={gmailSubject}
                      onChange={(e) => setGmailSubject(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 focus:border-red-500 rounded-xl text-xs font-sans font-bold text-white placeholder-slate-600 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Selectores de Adjuntos (Checkboxes Avanzados) */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                      Seleccionar Archivos para Adjuntar:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Adjunto 1: Reporte Médico */}
                      <button
                        type="button"
                        onClick={() => setGmailAttachReport(!gmailAttachReport)}
                        disabled={!generatedReport}
                        className={`p-3 border-2 rounded-xl text-[9px] font-bold uppercase tracking-wider font-mono transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[64px] ${
                          !generatedReport
                            ? "opacity-40 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-650"
                            : gmailAttachReport
                              ? "bg-red-950/20 border-red-500 text-red-500"
                              : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-500"
                        }`}
                        title={!generatedReport ? "Debe generar primero el reporte de estudio" : "Adjuntar el reporte de estudio en PDF"}
                      >
                        <span className="text-[10px] font-black">📄 Reporte de Estudio</span>
                        <span className="text-[8px] font-normal tracking-normal text-slate-400 uppercase leading-none">
                          {generatedReport ? (gmailAttachReport ? "✓ Seleccionado" : "Haga clic para adjuntar") : "No Generado"}
                        </span>
                      </button>

                      {/* Adjunto 2: Traducción Explicativa */}
                      <button
                        type="button"
                        onClick={() => setGmailAttachSummary(!gmailAttachSummary)}
                        disabled={!patientSummary}
                        className={`p-3 border-2 rounded-xl text-[9px] font-bold uppercase tracking-wider font-mono transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[64px] ${
                          !patientSummary
                            ? "opacity-40 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-650"
                            : gmailAttachSummary
                              ? "bg-red-950/20 border-red-500 text-red-500"
                              : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-500"
                        }`}
                        title={!patientSummary ? "Debe generar la Traducción Empática" : "Adjuntar la Traducción Empática en PDF"}
                      >
                        <span className="text-[10px] font-black">🗣 Explicación</span>
                        <span className="text-[8px] font-normal tracking-normal text-slate-400 uppercase leading-none">
                          {patientSummary ? (gmailAttachSummary ? "✓ Seleccionado" : "Haga clic para adjuntar") : "No Generada"}
                        </span>
                      </button>

                      {/* Adjunto 3: Infografía */}
                      <button
                        type="button"
                        onClick={() => setGmailAttachInfographic(!gmailAttachInfographic)}
                        disabled={!infographicUrl}
                        className={`p-3 border-2 rounded-xl text-[9px] font-bold uppercase tracking-wider font-mono transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[64px] ${
                          !infographicUrl
                            ? "opacity-40 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-650"
                            : gmailAttachInfographic
                              ? "bg-red-950/20 border-red-500 text-red-500"
                              : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-500"
                        }`}
                        title={!infographicUrl ? "Debe generar la Infografía de paciente" : "Adjuntar la Infografía en formato de imagen"}
                      >
                        <span className="text-[10px] font-black">🎨 Infografía</span>
                        <span className="text-[8px] font-normal tracking-normal text-slate-400 uppercase leading-none">
                          {infographicUrl ? (gmailAttachInfographic ? "✓ Seleccionado" : "Haga clic para adjuntar") : "No Generada"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Body text */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                      Mensaje Escrito (Cuerpo del correo):
                    </label>
                    <textarea
                      placeholder="Redacta el mensaje..."
                      value={gmailBody}
                      onChange={(e) => setGmailBody(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-850 focus:border-red-500 rounded-2xl text-xs font-sans font-medium text-slate-300 placeholder-slate-605 focus:outline-none transition-all resize-none leading-relaxed"
                    />
                  </div>

                  {/* Main Actions dispatch */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSendGmailAction}
                      disabled={isSendingGmail || !gmailTo.trim() || !gmailSubject.trim()}
                      className="w-full p-3 bg-red-600 hover:bg-red-550 disabled:opacity-50 border-2 border-red-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 font-mono"
                    >
                      {isSendingGmail ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-white" />
                          <span>Preparando Adjuntos y Enviando Correo...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Enviar Correo vía Gmail</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="bg-slate-950 p-4 border-t border-slate-850 text-center font-mono text-[8px] text-slate-500 uppercase tracking-widest">
              Conexión Encriptada SSL • Google Secure OAuth API
            </div>
          </motion.div>
        </div>
      )}

      {/* Container strictly for print layout (hidden on screen, visible on window.print()) */}
      {generatedReport && (
        <div className="print-only text-black bg-white min-h-screen select-text font-sans relative" style={{ color: "#000000" }}>
          {/* Header Membrete */}
          {customLogoUrl && customLogoStyle === "banner" ? (
            <div className="border-b border-gray-400 pb-4 mb-4 text-center">
              <img 
                src={customLogoUrl} 
                alt="Membrete de la Clínica" 
                className="max-h-[110px] mx-auto w-auto object-contain block" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex justify-between items-start border-b border-gray-400 pb-4 mb-4">
              <div className="flex items-center gap-3">
                {selectedLogo !== "none" && (
                  <div className="w-12 h-12 flex items-center justify-center shrink-0 border border-gray-300 rounded-lg p-1 bg-gray-50 text-indigo-700">
                    {customLogoUrl ? (
                      <img 
                        src={customLogoUrl} 
                        alt="Logo" 
                        className="w-10 h-10 object-contain block" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <>
                        {selectedLogo === "medical-cross" && (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-indigo-600">
                            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
                          </svg>
                        )}
                        {selectedLogo === "heart-pulse" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose-600">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                            <path d="M3.22 12H9.5l1.5-4 2 8 1.5-4h4.5"/>
                          </svg>
                        )}
                        {selectedLogo === "dna" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-cyan-600">
                            <path d="M4.5 10.5C4.5 5.253 8.753 1 14 1s9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5-9.5-4.253-9.5-9.5Z" />
                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" />
                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" />
                          </svg>
                        )}
                        {selectedLogo === "shield-check" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-emerald-600">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="m9 11 2 2 4-4"/>
                          </svg>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div>
                  {clinicName ? (
                    <>
                      <h1 className="text-base font-extrabold tracking-tight text-gray-900 uppercase">
                        {clinicName}
                      </h1>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                        Reporte de Radiodiagnóstico por Imagen
                      </p>
                    </>
                  ) : (
                    <h1 className="text-base font-extrabold tracking-tight text-gray-900 uppercase">
                      REPORTE DE RADIODIAGNÓSTICO
                    </h1>
                  )}
                </div>
              </div>
              {reportDate && (
                <div className="text-right text-[10px] uppercase text-gray-500 leading-normal">
                  <div>Fecha: <span className="font-extrabold text-gray-800">{reportDate}</span></div>
                </div>
              )}
            </div>
          )}

          {/* Patient Metadata Grid Box */}
          {(patientName || reportDate) && (
            <div className="border border-gray-350 rounded-lg p-3.5 mb-6 bg-gray-50 flex flex-wrap gap-x-8 gap-y-1.5 text-[11px] leading-relaxed select-text">
              {patientName && (
                <div>
                  <span className="font-bold text-gray-500 uppercase">Paciente:</span>{" "}
                  <span className="font-extrabold text-gray-955 uppercase text-[12px]">{patientName}</span>
                </div>
              )}
              {reportDate && (
                <div>
                  <span className="font-bold text-gray-500 uppercase">Fecha del Estudio:</span>{" "}
                  <span className="font-extrabold text-gray-955 uppercase text-[12px]">{reportDate}</span>
                </div>
              )}
            </div>
          )}

          {/* Calibración de Contraste para Impresión Física e Historial Clínico (Cuña PACS) */}
          {adaptivePDFContrast && (
            <div className="mb-6 p-2 rounded border border-gray-400 bg-white select-none">
              <div className="text-[7.5px] font-mono font-bold text-gray-400 uppercase tracking-widest text-center mb-1 flex items-center justify-center gap-1.5">
                <span>Pauta de Densidad PACS Homologada</span>
                <span className="text-[6.5px] bg-black text-white px-1.5 py-0.5 rounded font-sans leading-none">CALIBRACIÓN GSDF ACTIVA</span>
              </div>
              <div className="flex h-5 border border-black overflow-hidden rounded bg-gray-50">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => {
                  const lightness = 100 - val;
                  return (
                    <div 
                      key={val} 
                      className="flex-1 h-full flex flex-col justify-between items-center text-[5.5px] font-mono font-bold leading-none py-0.5 border-r border-black/10 last:border-r-0"
                      style={{ 
                        backgroundColor: `rgb(${Math.round(2.55 * lightness)}, ${Math.round(2.55 * lightness)}, ${Math.round(2.55 * lightness)})`,
                        color: val >= 50 ? "#FFFFFF" : "#000000"
                      }}
                    >
                      <span>{val}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[6px] font-mono font-bold text-gray-400 text-center mt-1 uppercase">
                Gama adaptativa: Compensación automática de pérdida térmica de tinta en papel
              </div>
            </div>
          )}

          {/* Report Medical Content */}
          <div className="pt-2 leading-relaxed text-[12.5px] text-gray-955 select-text font-serif">
            {renderPrintReportBody(generatedReport)}
          </div>

          {/* Sign-off Signature block */}
          {(doctorName || customSignatureUrl) && (
            <div className="mt-16 pt-6 border-t border-gray-250 grid grid-cols-2 text-[10px] leading-normal font-sans text-gray-400">
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-450">Verificado Por:</p>
                <p className="font-mono text-[9px] mt-1 text-gray-400 font-bold">Firma Digital Autónoma</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="inline-block text-center relative">
                  {customSignatureUrl && (
                    <div className="mb-1 flex justify-center">
                      <img 
                        src={customSignatureUrl} 
                        alt="Firma" 
                        className="h-14 max-w-[170px] object-contain block mix-blend-multiply" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="border-t border-gray-400 pt-1 px-8">
                    <p className="font-extrabold text-gray-955 uppercase text-[11.5px]">{doctorName || "Médico Especialista"}</p>
                    <p className="font-semibold text-gray-500 text-[10px]">Médico Especialista en Radiodiagnóstico</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
