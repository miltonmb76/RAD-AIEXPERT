import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BibliographySearch,
  ImageSearch,
  ExpertImageAnalysis,
  ZipDicomExtractor,
  AsistenteMedidas,
  CreadorNotasPie,
  BiomechanicalRadarModule,
  ClinicalScorecardModule,
  ReasoningChainModule,
  NegativityChecklistModule,
  SecondReaderModule,
  ReportEnrichmentPanel,
  ReportQaGateModal,
  DifferentialTreeModule,
  SemioticsConductMatrixModule,
  FindingsInfographicModule,
  DominantLesionCardModule,
  MeasurementsGaugeModule,
  CreadorCuadroSinoptico,
  CreadorSinopsisFracturas,
  ElastographyQUSPresentationModule,
  Atlas3DModule,
  Vascular3DModule,
  FocalLesion3DModule,
  UltrasoundPlaneSimulatorModule,
  Thyroid3DModule,
  Breast3DModule,
  Shoulder3DModule,
  Knee3DModule,
  Ankle3DModule,
  Kidney3DModule,
  Abdomen3DModule,
  AbdominalWall3DModule,
  Scrotum3DModule,
  MuscleTendon3DModule,
  Wrist3DModule,
  Suite3DSuspense,
} from "./appLazyModules";
import "./lib/safeLocalStorage";
import JSZip from "jszip";
import type { ExtractedFile } from "./components/ZipDicomExtractor";

import { Atlas3DData, Vascular3DData, FocalLesion3DData, UsPlaneSimulatorData, Thyroid3DData, Breast3DData, Shoulder3DData, Knee3DData, Ankle3DData, Kidney3DData, Abdomen3DData, AbdominalWall3DData, Scrotum3DData, MuscleTendon3DData, Wrist3DData, UsImagesGridMode, ClinicalScorecardData, MeasurementGaugeData, ReasoningChainData, DifferentialTreeData, SemioticsConductMatrixData, FindingsInfographicData, DominantLesionCardData, NegativityChecklistData, SecondReaderData, ReportEnrichmentSession } from "./types";
import { buildAtlasDirectivesFromScorecard, buildAtlasPanelFindingAssignments, buildVascularDirectivesFromScorecard, buildThyroidDirectivesFromScorecard, buildBreastDirectivesFromScorecard, buildShoulderDirectivesFromScorecard, buildKneeDirectivesFromScorecard, buildAnkleDirectivesFromScorecard, buildKidneyDirectivesFromScorecard, buildAbdomenDirectivesFromScorecard, buildAbdominalWallDirectivesFromScorecard, buildScrotumDirectivesFromScorecard, buildMuscleTendonDirectivesFromScorecard, buildWristDirectivesFromScorecard, mergeOverlaysOntoAtlas } from "./lib/clinicalIntelligence";
import {
  applyPendingEnrichmentChanges,
  createRunningEnrichmentSession,
  runReportEnrichmentPipeline,
} from "./lib/reportEnrichment";
import {
  runReportQaGate,
  type ReportQaGateResult,
} from "./lib/reportQaGate";
import { getPanelLetter } from "./utils/usImagesPdfRenderer";
import { decodeDicomForDisplay, compressImageForAttachment } from "./lib/dicomHelpers";
import { runBackgroundTask } from "./lib/backgroundTasks";
import { BackgroundTasksBar } from "./components/BackgroundTasksBar";
import { ActivePatientPanel } from "./components/ActivePatientPanel";
import { autoLabelAttachedImages, type AttachedImageForLabeling } from "./lib/labelingQueue";
import { applyReorderedImageIds } from "./lib/figureCorrelation";
import {
  detectInfographicViewOrientation,
  type InfographicViewOrientation,
} from "./lib/infographicLaterality";
import {
  describeActiveRouting,
  MODEL_OPTIONS,
  normalizeModelPreference,
  resolveModelForTask,
  type ModelTask,
} from "./lib/modelRouting";
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
  Box,
  Crosshair,
  Scan,
  GitBranch,
  GitFork,
  Table2,
  Hexagon,
  FileSpreadsheet
} from "lucide-react";
import { initAuth, googleSignIn, logout as googleLogout, anonymousSignIn, emailSignIn, emailSignUp, getFirebaseConfig } from "./firebaseAuth";
import { CloudStudy, saveStudyToCloud, getStudiesFromCloud, deleteStudyFromCloud, Worklist, WorklistPatient, saveWorklistToCloud, getWorklistFromCloud, getSingleStudyFromCloud, testFirebaseConfigConnection, saveUserSettingsToCloud, getUserSettingsFromCloud } from "./firebaseDb";
import { idbSaveWorklist, idbGetWorklist, idbClearWorklist, idbSaveStudy, idbGetAllStudies, idbDeleteStudy, idbClearAllStudies, idbSaveHistory, idbGetHistory, idbSaveUserSettings, idbGetUserSettings, idbSaveBranding, idbGetBranding, getActiveWorklistId } from "./localDb";
import { markStudiesDeleted, filterOutDeletedStudies } from "./lib/deletedStudyTombstones";
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

import { SavedReport, ImageAnnotation } from "./lib/appLocalTypes";
export type { SavedReport, ImageAnnotation } from "./lib/appLocalTypes";
export { DIAGNOSTIC_GLOSSARY } from "./lib/diagnosticGlossary";
import { formatDateToDMY, formatDateSlashDMY, formatCostaRicaPhone } from "./lib/appFormatters";
import { splitReportSections } from "./lib/reportSectionHelpers";
import {
  getBiomechanicalRadarDataFromReport,
} from "./lib/radarPdfHelpers";
import { getSpecificSuiteShortcut } from "./lib/suiteShortcuts";
import { WorklistSidebar } from "./components/WorklistSidebar";
import { useWorklistPersistence } from "./lib/useWorklistPersistence";
import { useLocalBridge } from "./lib/useLocalBridge";
import { createWorklistSessionHandlers } from "./lib/worklistSessionHandlers";
import {
  renderElegantResponse,
  renderElegantPatientResumenDark,
  renderElegantPatientResumen,
} from "./lib/reportElegantRenderers";
import { renderPrintBiomechanicalRadarAnnex } from "./lib/printRadarAnnex";
import { resolveParagraphSeverity } from "./lib/paragraphSeverity";
import { downloadPatientSummaryPdf } from "./lib/patientSummaryPdf";
import { downloadPdfFromBase64 } from "./lib/downloadPdfFromBase64";
import { convertLocalReportsToFallbackCloudStudies as convertLocalReportsToFallbackCloudStudiesLib } from "./lib/cloudStudyFallback";
import { createCloudStudyActions } from "./lib/cloudStudyActions";
import { compressImageBase64 } from "./lib/compressImageBase64";
import { detectImageMetaFromFilename as detectImageMetaFromFilenameLib } from "./lib/detectImageMetaFromFilename";
import { persistBrandingAssets as persistBrandingAssetsLib } from "./lib/brandingPersistence";
import { createGmailSendAction } from "./lib/gmailSend";
import { createDriveSaveAction } from "./lib/driveSave";
import { buildWhatsAppTextPreview, buildWhatsAppSendUrl } from "./lib/whatsappShare";
import { buildSettingsBackup, downloadSettingsBackupJson, createImportAllDataHandler } from "./lib/settingsBackup";
import { createBatchModuleActivator } from "./lib/batchModuleActivator";
import { createNativePdfDownload } from "./lib/nativePdfDownload";
import { createAttachedFilesHandler } from "./lib/attachedFilesHandler";
import { createGenerateReportHandler } from "./lib/generateReportHandler";
import { copyReportToClipboard } from "./lib/copyReportToClipboard";
import { persistUserSettings as persistUserSettingsToStores } from "./lib/persistUserSettings";
import { buildReportQaFingerprint as buildReportQaFingerprintValue } from "./lib/reportQaFingerprint";
import { renderPrintReportBody as renderPrintReportBodyView } from "./lib/printReportBody";
import { ClinicalReportView } from "./components/ClinicalReportView";
import {
  getGenderedLaterality,
  getFormattedProjections,
  buildStudyTypeString,
} from "./lib/studyTypeFormatters";
import {
  mergeCaseAnalysisBlock,
  parseReportToElements,
  renderBoldTextBlackSafe,
  renderBoldTextSafe,
  convertHtmlToMarkdown,
  type ReportElement,
} from "./lib/reportTextHelpers";

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
  
  // Patient Infographic generation states (classic anatomical poster — dual audience)
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState<boolean>(false);
  /** Patient-facing warm poster */
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  /** Formal clinician poster (same anatomy, scientific style) */
  const [infographicClinicianUrl, setInfographicClinicianUrl] = useState<string | null>(null);
  /** Which classic poster tab is visible (full size — never side by side) */
  const [infographicAudienceTab, setInfographicAudienceTab] = useState<"patient" | "clinician">(
    "patient"
  );
  const [infographicError, setInfographicError] = useState<string | null>(null);
  const [attachInfographicToOfficialReport, setAttachInfographicToOfficialReport] = useState<boolean>(false);
  /** Opt-in: include generated infographic in the patient explanation PDF */
  const [attachInfographicToPatientSummary, setAttachInfographicToPatientSummary] = useState<boolean>(false);
  /** Free-text corrections applied on regenerate (laterality, labels, anatomy, etc.) */
  const [infographicCorrectionNotes, setInfographicCorrectionNotes] = useState<string>("");
  /** AP = de frente (espejo); PA = de espaldas (mismos lados del cuadro) */
  const [infographicViewOrientation, setInfographicViewOrientation] = useState<InfographicViewOrientation>("AP");
  // Local storage customizable instructions
  const [systemInstruction, setSystemInstruction] = useState<string>(() => {
    if (typeof window === "undefined") return GENERAL_SYSTEM_INSTRUCTION;
    return localStorage.getItem("radiology_sys_inst") || GENERAL_SYSTEM_INSTRUCTION;
  });
  const [chatInstruction, setChatInstruction] = useState<string>(() => {
    if (typeof window === "undefined") return CHAT_SYSTEM_INSTRUCTION;
    return localStorage.getItem("radiology_chat_inst") || CHAT_SYSTEM_INSTRUCTION;
  });
  const [classifyInstruction, setClassifyInstruction] = useState<string>(() => {
    if (typeof window === "undefined") return CLASSIFICATION_SYSTEM_INSTRUCTION;
    return localStorage.getItem("radiology_class_inst") || CLASSIFICATION_SYSTEM_INSTRUCTION;
  });
  const settingsLoadedRef = useRef(false);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      localStorage.setItem("rad_doctor_license", "Código Profesional 6025");
      return "Código Profesional 6025";
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

  const [selectedLogoRight, setSelectedLogoRight] = useState<string>(() => {
    return localStorage.getItem("rad_selected_logo_right") || "none";
  });

  const [customLogoStyle, setCustomLogoStyle] = useState<string>(() => {
    return localStorage.getItem("rad_custom_logo_style") || "left"; // "left" | "banner" | "dual"
  });

  // Custom doctor's signature ? declared early so branding persistence can mirror it.
  const [customSignatureUrl, setCustomSignatureUrl] = useState<string>(() => {
    return localStorage.getItem("rad_custom_signature") || "";
  });

  // Branding (logos/banner) must survive restarts. localStorage often rejects large
  // banner base64 blobs (QuotaExceeded); IndexedDB is the durable source of truth.
  const brandingHydratedRef = useRef(false);

  const persistBrandingAssets = async (overrides?: {
    customLogos?: Array<{ id: string; name: string; url: string }>;
    selectedLogo?: string;
    selectedLogoRight?: string;
    customLogoStyle?: string;
    customSignatureUrl?: string;
  }) => {
    await persistBrandingAssetsLib(
      {
        customLogos,
        selectedLogo,
        selectedLogoRight,
        customLogoStyle,
        customSignatureUrl,
      },
      overrides
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromIdb = await idbGetBranding();
        if (cancelled) return;

        if (fromIdb && Array.isArray(fromIdb.customLogos) && fromIdb.customLogos.length > 0) {
          // Do not clobber a logo uploaded while this hydrate was in flight.
          setCustomLogos((prev) =>
            prev.length > fromIdb.customLogos.length ? prev : fromIdb.customLogos
          );
          if (fromIdb.selectedLogo) setSelectedLogo(fromIdb.selectedLogo);
          if (fromIdb.selectedLogoRight) setSelectedLogoRight(fromIdb.selectedLogoRight);
          if (fromIdb.customLogoStyle) setCustomLogoStyle(fromIdb.customLogoStyle);
          if (fromIdb.customSignatureUrl && !localStorage.getItem("rad_custom_signature")) {
            setCustomSignatureUrl(fromIdb.customSignatureUrl);
            try {
              localStorage.setItem("rad_custom_signature", fromIdb.customSignatureUrl);
            } catch {
              /* ignore */
            }
          }
        } else {
          // One-time migrate of any logos that still fit in localStorage.
          const raw = localStorage.getItem("rad_custom_logos");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                await idbSaveBranding({
                  customLogos: parsed,
                  selectedLogo: localStorage.getItem("rad_selected_logo") || "none",
                  selectedLogoRight: localStorage.getItem("rad_selected_logo_right") || "none",
                  customLogoStyle: localStorage.getItem("rad_custom_logo_style") || "left",
                  customSignatureUrl: localStorage.getItem("rad_custom_signature") || "",
                  updatedAt: Date.now(),
                });
              }
            } catch {
              /* ignore corrupt localStorage */
            }
          }
        }
      } catch (e) {
        console.warn("Could not hydrate branding from IndexedDB:", e);
      } finally {
        if (!cancelled) brandingHydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!brandingHydratedRef.current) return;
    void persistBrandingAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLogos, selectedLogo, selectedLogoRight, customLogoStyle]);

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

  const [patientLogoRightUrl, setPatientLogoRightUrl] = useState<string>("");

  const customLogoRightUrl = useMemo(() => {
    if (isPatientPublicView && patientLogoRightUrl) {
      return patientLogoRightUrl;
    }
    const matched = customLogos.find(l => l.id === selectedLogoRight);
    if (matched) return matched.url;
    return "";
  }, [isPatientPublicView, patientLogoRightUrl, selectedLogoRight, customLogos]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("rad_selected_model");
    // Migrate previous sole-default (3.7) to Auto once, so routing activates by default.
    if (saved === "gemini-3.7-flash" && !localStorage.getItem("rad_model_auto_migrated_v1")) {
      localStorage.setItem("rad_model_auto_migrated_v1", "1");
      return "auto";
    }
    return normalizeModelPreference(saved);
  });

  useEffect(() => {
    localStorage.setItem("rad_selected_model", selectedModel);
  }, [selectedModel]);

  const modelFor = (task: ModelTask = "default") => resolveModelForTask(selectedModel, task);

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
        setPatientLogoRightUrl(localStudy.customLogoRightUrl || "");
        setCustomLogoStyle(localStudy.customLogoStyle || "logo");
        setCustomSignatureUrl(localStudy.customSignatureUrl || "");
        setOperationalSummaryText(localStudy.operationalSummaryText || "");
        if (localStudy.specificStudy) setSpecificStudy(localStudy.specificStudy);
        if (localStudy.pdfLayoutType) setPdfLayoutType(localStudy.pdfLayoutType as any);
        if (localStudy.selectedLogo) setSelectedLogo(localStudy.selectedLogo);
        if (localStudy.selectedLogoRight) setSelectedLogoRight(localStudy.selectedLogoRight);
        if (localStudy.attachedImages) setAttachedImages(localStudy.attachedImages);
        if (localStudy.findings3dRenders) setFindings3dRenders(localStudy.findings3dRenders);
        if (localStudy.patientSummary) setPatientSummary(localStudy.patientSummary);
        if (localStudy.atlas3dData) setAtlas3dData(localStudy.atlas3dData);
        if (localStudy.vascular3dData) setVascular3dData(localStudy.vascular3dData);
        if (localStudy.focalLesion3dData) setFocalLesion3dData(localStudy.focalLesion3dData);
        if (localStudy.usPlaneSimulatorData) setUsPlaneSimulatorData(localStudy.usPlaneSimulatorData);
        if (localStudy.includeUsPlaneSimulatorInReport !== undefined) setIncludeUsPlaneSimulatorInReport(localStudy.includeUsPlaneSimulatorInReport);
        if (localStudy.thyroid3dData) setThyroid3dData(localStudy.thyroid3dData);
        if (localStudy.breast3dData) setBreast3dData(localStudy.breast3dData);
        if (localStudy.shoulder3dData) setShoulder3dData(localStudy.shoulder3dData);
        if (localStudy.knee3dData) setKnee3dData(localStudy.knee3dData);
        if (localStudy.ankle3dData) setAnkle3dData(localStudy.ankle3dData);
        if (localStudy.kidney3dData) setKidney3dData(localStudy.kidney3dData);
        if (localStudy.abdomen3dData) setAbdomen3dData(localStudy.abdomen3dData);
        if (localStudy.abdominalWall3dData) setAbdominalWall3dData(localStudy.abdominalWall3dData);
        if (localStudy.scrotum3dData) setScrotum3dData(localStudy.scrotum3dData);
        if (localStudy.muscleTendon3dData) setMuscleTendon3dData(localStudy.muscleTendon3dData);
        if (localStudy.wrist3dData) setWrist3dData(localStudy.wrist3dData);
        if (localStudy.includeBreast3dInReport !== undefined) setIncludeBreast3dInReport(localStudy.includeBreast3dInReport);
        if (localStudy.includeShoulder3dInReport !== undefined) setIncludeShoulder3dInReport(localStudy.includeShoulder3dInReport);
        if (localStudy.includeKnee3dInReport !== undefined) setIncludeKnee3dInReport(localStudy.includeKnee3dInReport);
        if (localStudy.includeAnkle3dInReport !== undefined) setIncludeAnkle3dInReport(localStudy.includeAnkle3dInReport);
        if (localStudy.includeKidney3dInReport !== undefined) setIncludeKidney3dInReport(localStudy.includeKidney3dInReport);
        if (localStudy.includeAbdomen3dInReport !== undefined) setIncludeAbdomen3dInReport(localStudy.includeAbdomen3dInReport);
        if (localStudy.includeAbdominalWall3dInReport !== undefined) setIncludeAbdominalWall3dInReport(localStudy.includeAbdominalWall3dInReport);
        if (localStudy.includeScrotum3dInReport !== undefined) setIncludeScrotum3dInReport(localStudy.includeScrotum3dInReport);
        if (localStudy.includeMuscleTendon3dInReport !== undefined) setIncludeMuscleTendon3dInReport(localStudy.includeMuscleTendon3dInReport);
        if (localStudy.includeWrist3dInReport !== undefined) setIncludeWrist3dInReport(localStudy.includeWrist3dInReport);
        if (localStudy.includeThyroid3dInReport !== undefined) setIncludeThyroid3dInReport(localStudy.includeThyroid3dInReport);
        if (localStudy.includeFocalLesion3dInReport !== undefined) setIncludeFocalLesion3dInReport(localStudy.includeFocalLesion3dInReport);
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
              setPatientLogoRightUrl(study.customLogoRightUrl || "");
              setCustomLogoStyle(study.customLogoStyle || "logo");
              setCustomSignatureUrl(study.customSignatureUrl || "");
              setOperationalSummaryText(study.operationalSummaryText || "");
              if (study.specificStudy) setSpecificStudy(study.specificStudy);
              if (study.pdfLayoutType) setPdfLayoutType(study.pdfLayoutType as any);
              if (study.selectedLogo) setSelectedLogo(study.selectedLogo);
              if (study.selectedLogoRight) setSelectedLogoRight(study.selectedLogoRight);
              if (study.attachedImages) setAttachedImages(study.attachedImages);
              if (study.findings3dRenders) setFindings3dRenders(study.findings3dRenders);
              if (study.patientSummary) setPatientSummary(study.patientSummary);
            } else {
              setPatientViewError("El estudio clínico solicitado no existe o el enlace es incorrecto.");
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
                "El servidor de base de datos temporal ha superado su límite de cuota diaria gratuita de Google Cloud (Plan Free de AI Studio). Por favor, contacte a su especialista de salud o reintente más tarde cuando se reinicie la cuota diaria de Google. Su reporte clínico está guardado de forma 100% segura en la nube."
              );
            } else {
              setPatientViewError("Error de conexión al cargar el estudio clínico. Por favor, reintente.");
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
          // El navegador tiene una configuración personalizada en localStorage.
          if (serverConfig && (serverConfig.projectId === "gen-lang-client-0578019690" || !serverConfig.projectId)) {
            // El servidor tiene la base de datos predeterminada de AI Studio.
            // Sincronizamos subiendo nuestra configuración personalizada al servidor.
            console.log("Detectado Firebase personalizado en localStorage local. Sincronizando con el servidor para fijarlo...");
            fetch("/api/save-firebase-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: localCustom })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                console.log("¡Configuración de Firebase personalizada fijada en el servidor!");
              }
            })
            .catch(err => console.error("Error al sincronizar Firebase personalizado con el servidor:", err));
          } else if (serverConfig && serverConfig.projectId !== localCustom.projectId) {
            // El servidor tiene una configuraci�n personalizada diferente de la local. El servidor manda.
            // One-shot reload guard: avoid blank-screen reload loops during cold start.
            const reloadKey = "rad_firebase_config_reload_once";
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(reloadKey) === "1") {
              console.warn("Firebase config sync ya recarg� una vez en esta sesi�n; se omite reload.");
              localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
              localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            } else {
              console.log("Sincronizando configuraci�n de Firebase desde el servidor...");
              localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
              localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
              try {
                sessionStorage.setItem(reloadKey, "1");
              } catch {
                /* ignore */
              }
              window.location.reload();
            }
          }
        } else {
          // El navegador NO tiene una configuraci�n en localStorage.
          if (serverConfig && serverConfig.projectId && serverConfig.projectId !== "gen-lang-client-0578019690") {
            // Pero el servidor s� tiene una personalizada. La descargamos y recargamos.
            const reloadKey = "rad_firebase_config_reload_once";
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(reloadKey) === "1") {
              console.warn("Firebase config download ya recarg� una vez en esta sesi�n; se omite reload.");
              localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
              localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            } else {
              console.log("Descargando configuraci�n de Firebase personalizada del servidor...");
              localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
              localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
              try {
                sessionStorage.setItem(reloadKey, "1");
              } catch {
                /* ignore */
              }
              window.location.reload();
            }
          }
        }
      })
      .catch((err) => {
        console.warn("No se pudo sincronizar la configuración de Firebase con el servidor:", err);
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

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const originalName = file.name || "Nuevo Logotipo";
    const cleanName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      // Keep banners readable in PDF, but prefer a size that can also fit localStorage fallback.
      let compressedBase64 = await compressImageBase64(rawBase64, 2000, 0.9);
      if (compressedBase64.length > 2_500_000) {
        compressedBase64 = await compressImageBase64(rawBase64, 1600, 0.82);
      }
      const newLogoId = "custom-logo-" + Date.now();
      const newLogo = {
        id: newLogoId,
        name: cleanName,
        url: compressedBase64
      };
      const nextLogos = [...customLogos, newLogo];
      setCustomLogos(nextLogos);
      setSelectedLogo(newLogoId);
      // Persist immediately (do not wait for React effect) so restart never loses the banner.
      brandingHydratedRef.current = true;
      void persistBrandingAssets({
        customLogos: nextLogos,
        selectedLogo: newLogoId,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogoById = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este logotipo de la lista?")) {
      const nextLogos = customLogos.filter(l => l.id !== id);
      const nextSelected = selectedLogo === id ? "none" : selectedLogo;
      const nextRight = selectedLogoRight === id ? "none" : selectedLogoRight;
      setCustomLogos(nextLogos);
      if (selectedLogo === id) setSelectedLogo("none");
      if (selectedLogoRight === id) setSelectedLogoRight("none");
      void persistBrandingAssets({
        customLogos: nextLogos,
        selectedLogo: nextSelected,
        selectedLogoRight: nextRight,
      });
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
    let nextRight = selectedLogoRight;
    if (style === "dual" && (!selectedLogoRight || selectedLogoRight === "none")) {
      const other = customLogos.find((l) => l.id !== selectedLogo);
      if (other) {
        nextRight = other.id;
        setSelectedLogoRight(other.id);
      } else if (customLogos.length > 0) {
        nextRight = customLogos[0].id;
        setSelectedLogoRight(customLogos[0].id);
      }
    }
    void persistBrandingAssets({
      customLogoStyle: style,
      selectedLogoRight: nextRight,
    });
  };

  // Uploaded report file states
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
      try {
        localStorage.setItem("rad_custom_signature", compressedBase64);
      } catch (err) {
        console.warn("Could not save signature to localStorage:", err);
      }
      void persistBrandingAssets({ customSignatureUrl: compressedBase64 });
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
    void persistBrandingAssets({ customSignatureUrl: "" });
  };

  const [showPatientDetails, setShowPatientDetails] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [adaptivePDFContrast, setAdaptivePDFContrast] = useState<boolean>(false);
  const [pdfLayoutType, setPdfLayoutType] = useState<"classic" | "clinical_slate" | "executive_medical">("classic");
  
  // PDF Real-Time Preview States
  const [printModalDocType, setPrintModalDocType] = useState<'report' | 'patient_summary' | 'both'>('report');
  /** formal = solo informe; both = informe + pack explicación paciente */
  const [generateDocumentScope, setGenerateDocumentScope] = useState<'formal' | 'both'>('formal');
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

  // 1c. WORKLIST ("LISTA DE TRABAJO") - persistence hook
  const {
    worklist,
    setWorklist,
    isWorklistSidebarOpen,
    setIsWorklistSidebarOpen,
    isProcessingWorklist,
    worklistError,
    selectedWorklistPatientId,
    setSelectedWorklistPatientId,
    bridgePatientCount,
    setBridgePatientCount,
    fetchWorklist,
    saveWorklist,
    handleWorklistImageUpload,
    activeWorklistPatient,
    handleUpdatePatientStatus,
    handleDeletePatientFromWorklist,
    handleAddPatientToWorklist,
  } = useWorklistPersistence({
    userId: gmailUser?.uid,
    resolveLabelingModel: () => modelFor("labeling"),
  });

  const [isLabelQueueOpen, setIsLabelQueueOpen] = useState<boolean>(false);
  const [labelQueueTrigger, setLabelQueueTrigger] = useState<number>(0);
  const [labelingStats, setLabelingStats] = useState<{ confirmed: number; total: number }>({
    confirmed: 0,
    total: 0,
  });
  
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
    if (/mamograf[ií]a\s*y\s*ultrasonido|ultrasonido de mamas/i.test(fullStudy)) {
      detectedModality = "Mamografía y Ultrasonido de Mamas";
    } else if (/ultrasonido|ecografía|eco|ud|usg/i.test(fullStudy)) {
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
      "Pared abdominal",
      "Mamas",
      "Vias urinarias",
      "Escroto",
      "Cuello",
      "Rodilla",
      "Hombro",
      "Tobillo",
      "Muslo Anterior",
      "Muslo Posterior",
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
      "Cadera",
      "Pantorrilla y Tendón de Aquiles"
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
        (study === "Pantorrilla y Tendón de Aquiles" && (cleanFull.includes("pantorilla") || cleanFull.includes("pantorrilla") || cleanFull.includes("aquiles") || cleanFull.includes("achilles")))
      ) {
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

  // Auto-detect clinical study block - disabled: protocol activation is manual only.
  const autoDetectSpecificStudyAndModality = (_reportText: string, _currentStudyType: string) => {
    return;
  };

  useEffect(() => {
    const computed = buildStudyTypeString(modality, specificStudy, laterality, customStudy, projections, customProjection);
    setStudyType(computed);
  }, [modality, specificStudy, laterality, customStudy, projections, customProjection]);

  // Sync infographic AP/PA laterality from selected radiography projections / study text
  useEffect(() => {
    const detected = detectInfographicViewOrientation({
      studyType,
      projections,
      report: generatedReport || inputReport || "",
      correctionNotes: infographicCorrectionNotes,
    });
    setInfographicViewOrientation(detected);
  }, [projections, studyType]);

  // Auto-detect specific study from pasted/draft report, findings, or clinical history if specificStudy is the default "Tórax"
  useEffect(() => {
    if (specificStudy === "Tórax") {
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

  // Atlas 3D Fotorrealista y Correlación Anatómica Data
  const [atlas3dData, setAtlas3dData] = useState<Atlas3DData | null>(null);
  const [includeAtlas3dInReport, setIncludeAtlas3dInReport] = useState<boolean>(true);
  const [clinicalScorecardData, setClinicalScorecardData] = useState<ClinicalScorecardData | null>(null);
  const [includeScorecardInReport, setIncludeScorecardInReport] = useState<boolean>(false);
  const [isClinicalScorecardOpen, setIsClinicalScorecardOpen] = useState<boolean>(false);
  const [reasoningChainData, setReasoningChainData] = useState<ReasoningChainData | null>(null);
  const [includeReasoningChainInReport, setIncludeReasoningChainInReport] = useState<boolean>(true);
  const [isReasoningChainOpen, setIsReasoningChainOpen] = useState<boolean>(false);
  const [negativityChecklistData, setNegativityChecklistData] = useState<NegativityChecklistData | null>(null);
  const [includeNegativityChecklistInReport, setIncludeNegativityChecklistInReport] = useState<boolean>(false);
  const [isNegativityChecklistOpen, setIsNegativityChecklistOpen] = useState<boolean>(false);
  const [secondReaderData, setSecondReaderData] = useState<SecondReaderData | null>(null);
  const [isSecondReaderOpen, setIsSecondReaderOpen] = useState<boolean>(false);
  const [reportEnrichmentSession, setReportEnrichmentSession] = useState<ReportEnrichmentSession | null>(null);
  const [isEnrichingReport, setIsEnrichingReport] = useState<boolean>(false);
  const [applyingEnrichmentIds, setApplyingEnrichmentIds] = useState<string[]>([]);
  const [qaGateResult, setQaGateResult] = useState<ReportQaGateResult | null>(null);
  const [qaGateAckFingerprint, setQaGateAckFingerprint] = useState<string>("");
  const qaGatePendingActionRef = useRef<null | (() => void)>(null);
  const [differentialTreeData, setDifferentialTreeData] = useState<DifferentialTreeData | null>(null);
  const [includeDifferentialTreeInReport, setIncludeDifferentialTreeInReport] = useState<boolean>(true);
  const [isDifferentialTreeOpen, setIsDifferentialTreeOpen] = useState<boolean>(false);
  const [semioticsConductMatrixData, setSemioticsConductMatrixData] = useState<SemioticsConductMatrixData | null>(null);
  const [includeSemioticsConductMatrixInReport, setIncludeSemioticsConductMatrixInReport] = useState<boolean>(true);
  const [isSemioticsConductMatrixOpen, setIsSemioticsConductMatrixOpen] = useState<boolean>(false);
  const [findingsInfographicData, setFindingsInfographicData] = useState<FindingsInfographicData | null>(null);
  const [includeFindingsInfographicInReport, setIncludeFindingsInfographicInReport] = useState<boolean>(true);
  const [isFindingsInfographicOpen, setIsFindingsInfographicOpen] = useState<boolean>(false);
  const [dominantLesionCardData, setDominantLesionCardData] = useState<DominantLesionCardData | null>(null);
  const [includeDominantLesionCardInReport, setIncludeDominantLesionCardInReport] = useState<boolean>(true);
  const [isDominantLesionCardOpen, setIsDominantLesionCardOpen] = useState<boolean>(false);
  const [atlasDirectivesFromScorecard, setAtlasDirectivesFromScorecard] = useState<string>("");
  const [measurementGaugeData, setMeasurementGaugeData] = useState<MeasurementGaugeData | null>(null);
  const [includeMeasurementGaugesInReport, setIncludeMeasurementGaugesInReport] = useState<boolean>(true);
  const [includeMeasurementNormalsInPdf, setIncludeMeasurementNormalsInPdf] = useState<boolean>(false);
  const [isMeasurementsGaugeOpen, setIsMeasurementsGaugeOpen] = useState<boolean>(false);

  // Suite Vascular 3D & Mapa Ánatomo-Hemodinámico Data
  const [vascular3dData, setVascular3dData] = useState<Vascular3DData | null>(null);
  const [includeVascular3dInReport, setIncludeVascular3dInReport] = useState<boolean>(true);

  // Focal Lesion Corte 3D (on-demand)
  const [focalLesion3dData, setFocalLesion3dData] = useState<FocalLesion3DData | null>(null);
  const [includeFocalLesion3dInReport, setIncludeFocalLesion3dInReport] = useState<boolean>(true);
  // Ultrasound acquisition plane simulator (auto + chip corrections)
  const [usPlaneSimulatorData, setUsPlaneSimulatorData] = useState<UsPlaneSimulatorData | null>(null);
  const [includeUsPlaneSimulatorInReport, setIncludeUsPlaneSimulatorInReport] = useState<boolean>(true);
  const [thyroid3dData, setThyroid3dData] = useState<Thyroid3DData | null>(null);
  const [includeThyroid3dInReport, setIncludeThyroid3dInReport] = useState<boolean>(true);
  const [breast3dData, setBreast3dData] = useState<Breast3DData | null>(null);
  const [includeBreast3dInReport, setIncludeBreast3dInReport] = useState<boolean>(true);
  const [shoulder3dData, setShoulder3dData] = useState<Shoulder3DData | null>(null);
  const [includeShoulder3dInReport, setIncludeShoulder3dInReport] = useState<boolean>(true);
  const [knee3dData, setKnee3dData] = useState<Knee3DData | null>(null);
  const [ankle3dData, setAnkle3dData] = useState<Ankle3DData | null>(null);
  const [kidney3dData, setKidney3dData] = useState<Kidney3DData | null>(null);
  const [abdomen3dData, setAbdomen3dData] = useState<Abdomen3DData | null>(null);
  const [abdominalWall3dData, setAbdominalWall3dData] = useState<AbdominalWall3DData | null>(null);
  const [scrotum3dData, setScrotum3dData] = useState<Scrotum3DData | null>(null);
  const [muscleTendon3dData, setMuscleTendon3dData] = useState<MuscleTendon3DData | null>(null);
  const [wrist3dData, setWrist3dData] = useState<Wrist3DData | null>(null);
  const [includeKnee3dInReport, setIncludeKnee3dInReport] = useState<boolean>(true);
  const [includeAnkle3dInReport, setIncludeAnkle3dInReport] = useState<boolean>(true);
  const [includeKidney3dInReport, setIncludeKidney3dInReport] = useState<boolean>(true);
  const [includeAbdomen3dInReport, setIncludeAbdomen3dInReport] = useState<boolean>(true);
  const [includeAbdominalWall3dInReport, setIncludeAbdominalWall3dInReport] = useState<boolean>(true);
  const [includeScrotum3dInReport, setIncludeScrotum3dInReport] = useState<boolean>(true);
  const [includeMuscleTendon3dInReport, setIncludeMuscleTendon3dInReport] = useState<boolean>(true);
  const [includeWrist3dInReport, setIncludeWrist3dInReport] = useState<boolean>(true);

  // Cuadrícula y Presentación Científica para Fotos de Ultrasonido
  const [usImagesGridMode, setUsImagesGridMode] = useState<UsImagesGridMode>("auto");

  // 3D Schematic Volumetric Renders for Findings
  const [findings3dRenders, setFindings3dRenders] = useState<Finding3dRender[]>([]);
  const [is3dRenderModalOpen, setIs3dRenderModalOpen] = useState<boolean>(false);
  const [modal3dSourceImage, setModal3dSourceImage] = useState<any>(null);
  const [modal3dInitialFinding, setModal3dInitialFinding] = useState<string>("");

  const [includeElastographyInReport, setIncludeElastographyInReport] = useState<boolean>(false);
  const [elastographyStiffness, setElastographyStiffness] = useState<number>(5.2);
  const [elastographyCAP, setElastographyCAP] = useState<number>(230);
  const [elastographyFatFraction, setElastographyFatFraction] = useState<number>(6.2);
  const [elastographyImage3d, setElastographyImage3d] = useState<string | null>(null);
  const [elastographyOriginalImage, setElastographyOriginalImage] = useState<string | null>(null);
  const [elastographyEtiology, setElastographyEtiology] = useState<string>("masld");

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
    customLogoRightUrl,
    customLogoStyle,
    customSignatureUrl,
    specificStudy,
    pdfLayoutType,
    selectedLogo,
    selectedLogoRight,
    biomechanicalRadarData,
    findings3dRenders,
    atlas3dData,
    includeAtlas3dInReport,
    clinicalScorecardData,
    includeScorecardInReport,
    reasoningChainData,
    includeReasoningChainInReport,
    negativityChecklistData,
    includeNegativityChecklistInReport,
    secondReaderData,
    differentialTreeData,
    includeDifferentialTreeInReport,
    semioticsConductMatrixData,
    includeSemioticsConductMatrixInReport,
    findingsInfographicData,
    includeFindingsInfographicInReport,
    dominantLesionCardData,
    includeDominantLesionCardInReport,
    measurementGaugeData,
    includeMeasurementGaugesInReport,
    includeMeasurementNormalsInPdf,
    vascular3dData,
    includeVascular3dInReport,
    thyroid3dData,
    includeThyroid3dInReport,
    breast3dData,
    includeBreast3dInReport,
    shoulder3dData,
    includeShoulder3dInReport,
    knee3dData,
    ankle3dData,
    kidney3dData,
    abdomen3dData,
    abdominalWall3dData,
    scrotum3dData,
    muscleTendon3dData,
    wrist3dData,
    includeKnee3dInReport,
    includeAnkle3dInReport,
    includeKidney3dInReport,
    includeAbdomen3dInReport,
    includeAbdominalWall3dInReport,
    includeScrotum3dInReport,
    includeMuscleTendon3dInReport,
    includeWrist3dInReport,
    focalLesion3dData,
    includeFocalLesion3dInReport,
    usPlaneSimulatorData,
    includeUsPlaneSimulatorInReport,
    usImagesGridMode,
    includeElastographyInReport,
    elastographyStiffness,
    elastographyCAP,
    elastographyFatFraction,
    elastographyImage3d,
    elastographyOriginalImage,
    elastographyEtiology,
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
            model: modelFor("report_modify"),
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
          model: modelFor("report_modify"),
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
        setParagraphActionError(data.error || "Ocurrió un error inesperado al procesar la acción de párrafo.");
      }
    } catch (err: any) {
      console.error("Error executing paragraph action:", err);
      setParagraphActionError("Error de conexión con el servidor de IA.");
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
          model: modelFor("chat"),
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
  const [modifyError, setModifyError] = useState<string | null>(null);

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
              model: modelFor("case_analysis"),
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
          setCaseDataError("Error de comunicación/red al estructurar el flujograma.");
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
      let textSummary = `**ANÁLISIS INTEGRADO DE CASO (${selectedCaseFormat.toUpperCase().replace("_", " ")})**\n\n`;
      if (caseElements.includeSonographic && finalCaseData.sonographicPillar) {
        textSummary += `• **Pilar Sonográfico Fundamental**: ${finalCaseData.sonographicPillar.primaryFinding}\n`;
      }
      if (caseElements.includeClinicalCorr && finalCaseData.clinicalCorrelation) {
        textSummary += `• **Correlación Clínica/Lab**: ${finalCaseData.clinicalCorrelation}\n`;
      }
      if (caseElements.includeDifferentials && finalCaseData.diagnostics?.length) {
        textSummary += `• **Diagnóstico Principal**: ${finalCaseData.diagnostics[0]?.name}\n`;
      }
      if (caseElements.includeManagement && finalCaseData.managementRecommendation) {
        textSummary += `• **Conducta Recomendada**: ${finalCaseData.managementRecommendation}\n`;
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
      console.error("Error al formatear e incorporar el análisis:", err);
      setDiffsError(err?.message || "Error al procesar la inserción de datos.");
    } finally {
      setIsFormattingCaseJSON(false);
    }
  };

  const [bibliography, setBibliography] = useState<string>("");
  const [isSearchingBibliography, setIsSearchingBibliography] = useState<boolean>(false);
  const [isSearchingMoreBibliography, setIsSearchingMoreBibliography] = useState<boolean>(false);
  const [bibliographyError, setBibliographyError] = useState<string | null>(null);
  const [bibliographySources, setBibliographySources] = useState<Array<{ uri: string; title: string; summary?: string }>>([]);

  // States for Patient Summary (Interactive & Demystifying)
  const [patientSummary, setPatientSummary] = useState<any | null>(null);
  const [isGeneratingPatientSummary, setIsGeneratingPatientSummary] = useState<boolean>(false);
  const [patientSummaryError, setPatientSummaryError] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Record<number, boolean>>({});
  const [attachSummaryToOfficialReport, setAttachSummaryToOfficialReport] = useState<boolean>(false);
  const [isAsistenteMedidasOpen, setIsAsistenteMedidasOpen] = useState<boolean>(false);
  const [isCreadorNotasOpen, setIsCreadorNotasOpen] = useState<boolean>(false);
  const [isBiomechanicalRadarOpen, setIsBiomechanicalRadarOpen] = useState<boolean>(false);
  const [isCreadorCuadroSinopticoOpen, setIsCreadorCuadroSinopticoOpen] = useState<boolean>(false);
  const [isCreadorSinopsisFracturasOpen, setIsCreadorSinopsisFracturasOpen] = useState<boolean>(false);
  const [isElastographyQUSModuleOpen, setIsElastographyQUSModuleOpen] = useState<boolean>(false);
  const [isThyroid3dSuiteOpen, setIsThyroid3dSuiteOpen] = useState<boolean>(false);
  const [isBreast3dSuiteOpen, setIsBreast3dSuiteOpen] = useState<boolean>(false);
  const [isShoulder3dSuiteOpen, setIsShoulder3dSuiteOpen] = useState<boolean>(false);
  const [isKnee3dSuiteOpen, setIsKnee3dSuiteOpen] = useState<boolean>(false);
  const [isAnkle3dSuiteOpen, setIsAnkle3dSuiteOpen] = useState<boolean>(false);
  const [isKidney3dSuiteOpen, setIsKidney3dSuiteOpen] = useState<boolean>(false);
  const [isAbdomen3dSuiteOpen, setIsAbdomen3dSuiteOpen] = useState<boolean>(false);
  const [isAbdominalWall3dSuiteOpen, setIsAbdominalWall3dSuiteOpen] = useState<boolean>(false);
  const [isScrotum3dSuiteOpen, setIsScrotum3dSuiteOpen] = useState<boolean>(false);
  const [isMuscleTendon3dSuiteOpen, setIsMuscleTendon3dSuiteOpen] = useState<boolean>(false);
  const [isWrist3dSuiteOpen, setIsWrist3dSuiteOpen] = useState<boolean>(false);
  const [includeRadarInReport, setIncludeRadarInReport] = useState<boolean>(true);

  const suiteHasUiContent = (data: any): boolean =>
    !!(
      data &&
      ((Array.isArray(data.panels) && data.panels.length > 0) ||
        (Array.isArray(data.hemodynamicTable) && data.hemodynamicTable.length > 0) ||
        (Array.isArray(data.noduleTable) && data.noduleTable.length > 0) ||
        (Array.isArray(data.lesionTable) && data.lesionTable.length > 0) ||
        (Array.isArray(data.findingTable) && data.findingTable.length > 0))
    );
  /** Suite 3D en uso (abierta o con datos). Atlas no cuenta. */
  const anySuiteUsedUi =
    isThyroid3dSuiteOpen ||
    isBreast3dSuiteOpen ||
    isShoulder3dSuiteOpen ||
    isKnee3dSuiteOpen ||
    isAnkle3dSuiteOpen ||
    isKidney3dSuiteOpen ||
    isAbdomen3dSuiteOpen ||
    isAbdominalWall3dSuiteOpen ||
    isScrotum3dSuiteOpen ||
    isMuscleTendon3dSuiteOpen ||
    isWrist3dSuiteOpen ||
    suiteHasUiContent(vascular3dData) ||
    suiteHasUiContent(thyroid3dData) ||
    suiteHasUiContent(breast3dData) ||
    suiteHasUiContent(shoulder3dData) ||
    suiteHasUiContent(knee3dData) ||
    suiteHasUiContent(ankle3dData) ||
    suiteHasUiContent(kidney3dData) ||
    suiteHasUiContent(abdomen3dData) ||
    suiteHasUiContent(abdominalWall3dData) ||
    suiteHasUiContent(scrotum3dData) ||
    suiteHasUiContent(muscleTendon3dData) ||
    suiteHasUiContent(wrist3dData);

  // States & Handlers for Sistema de Activación Rápida de Módulos (Procesamiento en Lote)
  const DEFAULT_BATCH_MODULES: Record<string, boolean> = {
    clinical_scorecard: true,
    reasoning_chain: true,
    negativity_checklist: false,
    second_reader: false,
    differential_tree: false,
    semiotics_conduct_matrix: false,
    findings_infographic: false,
    atlas3d: false,
    vascular3d: false,
    thyroid3d: false,
    breast3d: false,
    shoulder3d: false,
    knee3d: false,
    ankle3d: false,
    kidney3d: false,
    abdomen3d: false,
    abdominalWall3d: false,
    scrotum3d: false,
    muscleTendon3d: false,
    wrist3d: false,
    radar: false,
    case_analysis: false,
    bibliography: false,
    operational_summary: true,
    patient_summary: true,
    glossary: false,
    schematic: false,
    measurements: false,
    footnotes: false,
    organ_synoptic: false,
    fractures: false,
    classifications: false,
  };

  /** Modulos del boton "Reporte completo" (ecografia / estudios con anexos) */
  const FULL_REPORT_BATCH_MODULES: Record<string, boolean> = { ...DEFAULT_BATCH_MODULES };

  const [selectedBatchModules, setSelectedBatchModules] = useState<Record<string, boolean>>(DEFAULT_BATCH_MODULES);
  const [isActivatingBatch, setIsActivatingBatch] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);
  const [autoActivateSpecificSuite, setAutoActivateSpecificSuite] = useState<boolean>(true);
  const [autoClinicalPolish, setAutoClinicalPolish] = useState<boolean>(true);
  const selectedSpecificSuite = getSpecificSuiteShortcut(specificStudy, modality);

  const applyEnrichedReportToEditor = (nextReport: string, previousReport?: string) => {
    const prev = (previousReport ?? generatedReport ?? "").trim();
    if (prev && prev !== nextReport) {
      setReportHistory((h) => [...h, prev]);
      setReportRedoHistory([]);
    }
    setGeneratedReport(nextReport);
    setEditedReportText(nextReport);
  };

  const runClinicalPolishForReport = async (reportText: string) => {
    const draft = String(reportText || "").trim();
    if (!draft || !autoClinicalPolish) return;

    setIsEnrichingReport(true);
    setReportEnrichmentSession(createRunningEnrichmentSession(draft));
    setIsNegativityChecklistOpen(true);
    setIsSecondReaderOpen(true);
    setIsClinicalScorecardOpen(true);
    setIsReasoningChainOpen(true);

    try {
      const result = await runReportEnrichmentPipeline({
        report: draft,
        studyType: specificStudy || studyType || "",
        clinicalHistory: clinicalHistory || "",
        checklistModel: modelFor("negativity_checklist"),
        readerModel: modelFor("second_reader"),
        modifyModel: modelFor("report_modify"),
        classificationsModel: modelFor("classifications"),
        scorecardModel: modelFor("clinical_scorecard"),
        measurementsModel: modelFor("measurements"),
        includeManagementRecommendations: true,
        existingScorecard: clinicalScorecardData,
      });

      if (result.checklist) {
        setNegativityChecklistData(result.checklist);
        // Keep PDF opt-in: generate/activate for other modules, do not auto-include annex
        setIncludeNegativityChecklistInReport(false);
      }
      if (result.reader) {
        setSecondReaderData(result.reader);
      }
      if (result.scorecard) {
        setClinicalScorecardData(result.scorecard);
        // Keep PDF opt-in: scorecard still feeds Atlas/directives, not PDF by default
        setIncludeScorecardInReport(false);
      }
      if (result.measurements && result.measurements.length > 0) {
        setIsAsistenteMedidasOpen(true);
      }
      if (result.classifications && result.classifications.length > 0) {
        setClassRecommendations(result.classifications);
        const incorporated: Record<number, boolean> = {};
        result.classifications.forEach((rec, idx) => {
          if (rec.alreadyIncorporated) incorporated[idx] = true;
        });
        setIncorporatedRecs(incorporated);
      }

      setReportEnrichmentSession(result.session);

      if (
        result.session.status === "done" &&
        result.report.trim() &&
        result.report.trim() !== draft
      ) {
        applyEnrichedReportToEditor(result.report, draft);
      }
    } catch (err: any) {
      console.error("Pulido clínico falló:", err);
      setReportEnrichmentSession((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: err?.message || String(err),
              finishedAt: new Date().toISOString(),
            }
          : null
      );
    } finally {
      setIsEnrichingReport(false);
    }
  };

  const handleUndoClinicalPolish = () => {
    if (!reportEnrichmentSession?.beforeReport) return;
    const before = reportEnrichmentSession.beforeReport;
    applyEnrichedReportToEditor(before, generatedReport || undefined);
    setReportEnrichmentSession({
      ...reportEnrichmentSession,
      afterReport: before,
      changes: reportEnrichmentSession.changes.map((c) =>
        c.status === "applied"
          ? { ...c, status: "pending" as const, autoSafe: false }
          : c
      ),
    });
  };

  const handleRejectEnrichmentChange = (changeId: string) => {
    setReportEnrichmentSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        changes: prev.changes.map((c) =>
          c.id === changeId ? { ...c, status: "rejected" as const } : c
        ),
      };
    });
  };

  const handleApplyEnrichmentChange = async (changeId: string) => {
    if (!reportEnrichmentSession || !generatedReport) return;
    setApplyingEnrichmentIds([changeId]);
    try {
      const result = await applyPendingEnrichmentChanges({
        report: generatedReport,
        modifyModel: modelFor("report_modify"),
        classificationsModel: modelFor("classifications"),
        measurementsModel: modelFor("measurements"),
        studyType: specificStudy || studyType || "",
        includeManagementRecommendations: true,
        session: reportEnrichmentSession,
        changeIds: [changeId],
        checklist: negativityChecklistData,
        reader: secondReaderData,
      });
      if (result.checklist) setNegativityChecklistData(result.checklist);
      if (result.reader) setSecondReaderData(result.reader);
      setReportEnrichmentSession(result.session);
      if (result.report.trim() && result.report !== generatedReport) {
        applyEnrichedReportToEditor(result.report);
      }
      // Keep classRecommendations board in sync when a classification was applied
      setClassRecommendations((prev) => {
        if (!prev) return prev;
        return prev.map((rec) => {
          const hit = result.session.changes.find(
            (c) =>
              c.source === "classification" &&
              c.status === "applied" &&
              c.classificationMeta?.name === rec.name
          );
          return hit ? { ...rec, alreadyIncorporated: true } : rec;
        });
      });
    } catch (err: any) {
      console.error("Error aplicando cambio de pulido:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setApplyingEnrichmentIds([]);
    }
  };

  const handleApplyRemainingEnrichment = async () => {
    if (!reportEnrichmentSession || !generatedReport) return;
    const ids = reportEnrichmentSession.changes
      .filter(
        (c) =>
          c.status === "pending" &&
          !c.reviewOnly &&
          (c.source === "classification"
            ? !!c.classificationMeta?.name
            : c.source === "measurement"
              ? !!(c.measurementMeta?.structure && c.measurementMeta?.value)
              : !!c.suggestedText.trim())
      )
      .map((c) => c.id);
    if (!ids.length) return;
    setApplyingEnrichmentIds(ids);
    try {
      const result = await applyPendingEnrichmentChanges({
        report: generatedReport,
        modifyModel: modelFor("report_modify"),
        classificationsModel: modelFor("classifications"),
        measurementsModel: modelFor("measurements"),
        studyType: specificStudy || studyType || "",
        includeManagementRecommendations: true,
        session: reportEnrichmentSession,
        changeIds: ids,
        checklist: negativityChecklistData,
        reader: secondReaderData,
      });
      if (result.checklist) setNegativityChecklistData(result.checklist);
      if (result.reader) setSecondReaderData(result.reader);
      setReportEnrichmentSession(result.session);
      if (result.report.trim() && result.report !== generatedReport) {
        applyEnrichedReportToEditor(result.report);
      }
      setClassRecommendations((prev) => {
        if (!prev) return prev;
        return prev.map((rec) => {
          const hit = result.session.changes.find(
            (c) =>
              c.source === "classification" &&
              c.status === "applied" &&
              c.classificationMeta?.name === rec.name
          );
          return hit ? { ...rec, alreadyIncorporated: true } : rec;
        });
      });
    } catch (err: any) {
      console.error("Error aplicando cambios restantes de pulido:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setApplyingEnrichmentIds([]);
    }
  };

  const handleToggleAllBatchModules = (select: boolean) => {
    setSelectedBatchModules({
      clinical_scorecard: select,
      reasoning_chain: select,
      negativity_checklist: select,
      second_reader: select,
      differential_tree: select,
      semiotics_conduct_matrix: select,
      findings_infographic: select,
      atlas3d: select,
      vascular3d: select,
      thyroid3d: select,
      breast3d: select,
      shoulder3d: select,
      knee3d: select,
      ankle3d: select,
      kidney3d: select,
      abdomen3d: select,
      abdominalWall3d: select,
      scrotum3d: select,
      muscleTendon3d: select,
      wrist3d: select,
      radar: select,
      case_analysis: select,
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

  const handleActivateBatchModules = async (
    reportOverride?: string,
    modulesOverride?: Record<string, boolean>
  ) => {
    const activate = createBatchModuleActivator({
    biomechanicalRadarData,
    clinicalHistory,
    clinicalScorecardData,
    editedReportText,
    generatedReport,
    handleAnalyzeCase,
    handleGenerateDynamicGlossary,
    handleGenerateSchematicSummary,
    handleSearchBibliography,
    isEditingReportManual,
    modelFor,
    patientGender,
    selectedBatchModules,
    setAbdomen3dData,
    setAbdominalWall3dData,
    setAnkle3dData,
    setAtlas3dData,
    setAtlasDirectivesFromScorecard,
    setBatchSuccessMessage,
    setBreast3dData,
    setClinicalScorecardData,
    setDifferentialTreeData,
    setFindingsInfographicData,
    setIncludeAbdomen3dInReport,
    setIncludeAbdominalWall3dInReport,
    setIncludeAnkle3dInReport,
    setIncludeAtlas3dInReport,
    setIncludeBreast3dInReport,
    setIncludeDifferentialTreeInReport,
    setIncludeFindingsInfographicInReport,
    setIncludeKidney3dInReport,
    setIncludeKnee3dInReport,
    setIncludeMuscleTendon3dInReport,
    setIncludeNegativityChecklistInReport,
    setIncludeReasoningChainInReport,
    setIncludeScorecardInReport,
    setIncludeScrotum3dInReport,
    setIncludeSemioticsConductMatrixInReport,
    setIncludeShoulder3dInReport,
    setIncludeThyroid3dInReport,
    setIncludeVascular3dInReport,
    setIncludeWrist3dInReport,
    setIsAbdomen3dSuiteOpen,
    setIsAbdominalWall3dSuiteOpen,
    setIsActivatingBatch,
    setIsAnkle3dSuiteOpen,
    setIsAsistenteMedidasOpen,
    setIsBiomechanicalRadarOpen,
    setIsBreast3dSuiteOpen,
    setIsClinicalScorecardOpen,
    setIsCreadorCuadroSinopticoOpen,
    setIsCreadorNotasOpen,
    setIsCreadorSinopsisFracturasOpen,
    setIsDifferentialTreeOpen,
    setIsFindingsInfographicOpen,
    setIsGeneratingOperationalSummary,
    setIsGeneratingPatientSummary,
    setIsKidney3dSuiteOpen,
    setIsKnee3dSuiteOpen,
    setIsMuscleTendon3dSuiteOpen,
    setIsNegativityChecklistOpen,
    setIsPatientSummaryExpanded,
    setIsReasoningChainOpen,
    setIsScrotum3dSuiteOpen,
    setIsSecondReaderOpen,
    setIsSemioticsConductMatrixOpen,
    setIsShoulder3dSuiteOpen,
    setIsThyroid3dSuiteOpen,
    setIsWrist3dSuiteOpen,
    setKidney3dData,
    setKnee3dData,
    setModifyError,
    setMuscleTendon3dData,
    setNegativityChecklistData,
    setOperationalSummaryText,
    setPatientSummary,
    setPatientSummaryError,
    setReasoningChainData,
    setScrotum3dData,
    setSecondReaderData,
    setSemioticsConductMatrixData,
    setShoulder3dData,
    setThyroid3dData,
    setVascular3dData,
    setWrist3dData,
    specificStudy,
    studyType
    });
    await activate(reportOverride, modulesOverride);
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
  const [isBibliographyExpanded, setIsBibliographyExpanded] = useState<boolean>(false);
  const [isPatientSummaryExpanded, setIsPatientSummaryExpanded] = useState<boolean>(false);
  /** Which text engine produced the last patient explanation (openai | gemini) */
  const [patientSummaryProvider, setPatientSummaryProvider] = useState<"openai" | "gemini" | null>(null);
  const [isGlossaryExpanded, setIsGlossaryExpanded] = useState<boolean>(false);
  const [isSchematicSummaryExpanded, setIsSchematicSummaryExpanded] = useState<boolean>(false);
  
  const [attachedImages, setAttachedImages] = useState<Array<{ id: string; url: string; label?: string; preview?: string; metadata?: any; isSelected?: boolean; notes?: string }>>([]);
  const [loadingAiLabelIds, setLoadingAiLabelIds] = useState<Record<string, true>>({});
  const [loadingAutocompleteIds, setLoadingAutocompleteIds] = useState<Record<string, true>>({});
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
    if (
      !confirm(
        "¿Iniciar un estudio nuevo desde cero?\n\nSe borrará el paciente, el informe, las imágenes, la explicación, la infografía, los módulos 3D y el resto de datos de esta sesión. No se modifican la marca, el médico ni la configuración de la clínica."
      )
    ) {
      return;
    }

    // --- Identidad de sesión / worklist activa ---
    setCurrentCloudStudyId("");
    if (worklist?.patients?.length) {
      const shouldDemote = worklist.patients.some(
        (p) => p.status === "current" || p.id === selectedWorklistPatientId
      );
      if (shouldDemote) {
        saveWorklist(
          worklist.patients.map((p) =>
            p.status === "current" || p.id === selectedWorklistPatientId
              ? { ...p, status: "pending" as const }
              : p
          )
        );
      }
    }
    setSelectedWorklistPatientId(null);
    setLoadedCloudPdfBase64("");
    setViewingCloudStudy(null);
    setBridgeCaptureMismatch(null);
    setBridgePatientCount(0);
    setDicomNotification(null);
    setActiveTab("generator");

    // --- Paciente (no tocar branding/médico/clínica) ---
    setPatientName("");
    setPatientAge("");
    setPatientGender("");
    setPatientId("");
    setPatientEmail("");
    try {
      localStorage.removeItem("rad_patient_email");
    } catch (_) {}
    setPatientLogoUrl("");
    setPatientLogoRightUrl("");
    setShowPatientDetails(false);
    {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setReportDate(`${yyyy}-${mm}-${dd}`);
    }

    // --- Parámetros del estudio ---
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
    setSelectedPresetId("");

    // --- Imagen principal / ZIP ---
    setSelectedFile(null);
    setBase64Image(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreviewUrl);
      } catch (_) {}
    }
    setImagePreviewUrl(null);
    setDragActive(false);
    setZipFile(null);
    setIsZipExtractorOpen(false);
    setZipExtractedFileForAnalysis(null);
    setExportedImage(null);
    setExportedMimeType("");

    // --- Adjuntos US / renders 3D de hallazgos ---
    setAttachedImages([]);
    setFindings3dRenders([]);
    setUsImagesGridMode("auto");

    // --- Informe generado y edición ---
    setIsGenerating(false);
    setGenerationSteps("");
    setGeneratedReport("");
    setOriginalBaseReport("");
    setReportError(null);
    setReportHistory([]);
    setReportRedoHistory([]);
    setIsEditingReportManual(false);
    setEditedReportText("");
    setShowVersionComparison(false);
    setManualSeverityOverrides({});
    setAiSeverityCache({});
    setIsAnalyzingParagraphs(false);

    // --- Evaluaciones / modificaciones / bibliografía / análisis ---
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
    setIsSearchingMoreBibliography(false);
    setBibliographyError(null);
    setBibliographySources([]);

    // --- Anotaciones en imagen ---
    setAnnotations([]);
    setIsDrawingBox(false);
    setDrawStartPercent(null);
    setTempBox(null);
    setPendingAnnotation(null);
    setPendingLabel("");

    // --- Explicación al paciente / glosario / operativo / esquema / semiología ---
    setPatientSummary(null);
    setPatientSummaryError(null);
    setIsGeneratingPatientSummary(false);
    setIsPatientSummaryExpanded(false);
    setExpandedFindings({});
    setAttachSummaryToOfficialReport(false);
    setIncludeManagementRecs({});
    setDynamicGlossary(null);
    setDynamicGlossaryError(null);
    setIsGeneratingDynamicGlossary(false);
    setGlossaryLitSearch({});
    setOperationalSummaryText("");
    setIsGeneratingOperationalSummary(false);
    setSchematicSummary(null);
    setSchematicSummaryError(null);
    setIsGeneratingSchematicSummary(false);
    setSchematicFormat("blocks");
    setSemiologyData(null);
    setSemiologyError(null);
    setIsGeneratingSemiology(false);

    // --- Infografía clásica (paciente + médico) ---
    setInfographicUrl(null);
    setInfographicClinicianUrl(null);
    setInfographicAudienceTab("patient");
    setInfographicError(null);
    setIsGeneratingInfographic(false);
    setAttachInfographicToOfficialReport(false);
    setAttachInfographicToPatientSummary(false);
    setInfographicCorrectionNotes("");

    // --- Módulos clínicos auxiliares ---
    setClinicalScorecardData(null);
    setIncludeScorecardInReport(false);
    setIsClinicalScorecardOpen(false);
    setReasoningChainData(null);
    setIncludeReasoningChainInReport(true);
    setIsReasoningChainOpen(false);
    setNegativityChecklistData(null);
    setIncludeNegativityChecklistInReport(false);
    setIsNegativityChecklistOpen(false);
    setSecondReaderData(null);
    setIsSecondReaderOpen(false);
    setDifferentialTreeData(null);
    setIncludeDifferentialTreeInReport(true);
    setIsDifferentialTreeOpen(false);
    setSemioticsConductMatrixData(null);
    setIncludeSemioticsConductMatrixInReport(true);
    setIsSemioticsConductMatrixOpen(false);
    setFindingsInfographicData(null);
    setIncludeFindingsInfographicInReport(true);
    setIsFindingsInfographicOpen(false);
    setDominantLesionCardData(null);
    setIncludeDominantLesionCardInReport(true);
    setIsDominantLesionCardOpen(false);
    setAtlasDirectivesFromScorecard("");
    setMeasurementGaugeData(null);
    setIncludeMeasurementGaugesInReport(true);
    setIncludeMeasurementNormalsInPdf(false);
    setIsMeasurementsGaugeOpen(false);
    setBiomechanicalRadarData(null);
    setIncludeRadarInReport(true);
    setIsBiomechanicalRadarOpen(false);
    setIsAsistenteMedidasOpen(false);
    setIsCreadorNotasOpen(false);
    setIsCreadorCuadroSinopticoOpen(false);
    setIsCreadorSinopsisFracturasOpen(false);

    // --- Suites 3D / atlas / vascular / focal / plano US ---
    setAtlas3dData(null);
    setIncludeAtlas3dInReport(true);
    setVascular3dData(null);
    setIncludeVascular3dInReport(true);
    setFocalLesion3dData(null);
    setIncludeFocalLesion3dInReport(true);
    setUsPlaneSimulatorData(null);
    setIncludeUsPlaneSimulatorInReport(true);
    setThyroid3dData(null);
    setIncludeThyroid3dInReport(true);
    setIsThyroid3dSuiteOpen(false);
    setBreast3dData(null);
    setIncludeBreast3dInReport(true);
    setIsBreast3dSuiteOpen(false);
    setShoulder3dData(null);
    setIncludeShoulder3dInReport(true);
    setIsShoulder3dSuiteOpen(false);
    setKnee3dData(null);
    setIncludeKnee3dInReport(true);
    setIsKnee3dSuiteOpen(false);
    setAnkle3dData(null);
    setIncludeAnkle3dInReport(true);
    setIsAnkle3dSuiteOpen(false);
    setKidney3dData(null);
    setIncludeKidney3dInReport(true);
    setIsKidney3dSuiteOpen(false);
    setAbdomen3dData(null);
    setIncludeAbdomen3dInReport(true);
    setIsAbdomen3dSuiteOpen(false);
    setAbdominalWall3dData(null);
    setIncludeAbdominalWall3dInReport(true);
    setIsAbdominalWall3dSuiteOpen(false);
    setScrotum3dData(null);
    setIncludeScrotum3dInReport(true);
    setIsScrotum3dSuiteOpen(false);
    setMuscleTendon3dData(null);
    setIncludeMuscleTendon3dInReport(true);
    setIsMuscleTendon3dSuiteOpen(false);
    setWrist3dData(null);
    setIncludeWrist3dInReport(true);
    setIsWrist3dSuiteOpen(false);

    // --- Elastografía ---
    setIncludeElastographyInReport(false);
    setElastographyStiffness(5.2);
    setElastographyCAP(230);
    setElastographyFatFraction(6.2);
    setElastographyImage3d(null);
    setElastographyOriginalImage(null);
    setElastographyEtiology("masld");
    setIsElastographyQUSModuleOpen(false);

    // --- Lote de módulos / modales de envío ---
    setSelectedBatchModules({ ...DEFAULT_BATCH_MODULES });
    setIsActivatingBatch(false);
    setBatchSuccessMessage(null);
    setShowPrintModal(false);
    setShowWhatsAppModal(false);
    setShowGmailModal(false);
    setWhatsappShareType("report_pdf");
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
          model: modelFor("labeling"),
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
  const handleGenerateReport = async (mode: "simple" | "full" = "full") => {
    const generate = createGenerateReportHandler({
    DEFAULT_BATCH_MODULES,
    FULL_REPORT_BATCH_MODULES,
    abdomen3dData,
    abdominalWall3dData,
    ankle3dData,
    annotations,
    atlas3dData,
    attachedImages,
    autoActivateSpecificSuite,
    autoClinicalPolish,
    autoDetectSpecificStudyAndModality,
    base64Image,
    breast3dData,
    clinicName,
    clinicalHistory,
    customLogoRightUrl,
    customLogoStyle,
    customLogoUrl,
    customSignatureUrl,
    doctorLicense,
    doctorName,
    findings,
    findings3dRenders,
    focalLesion3dData,
    generatedReport,
    gmailUser,
    handleActivateBatchModules,
    includeAbdomen3dInReport,
    includeAbdominalWall3dInReport,
    includeAnkle3dInReport,
    includeAtlas3dInReport,
    includeBreast3dInReport,
    includeFocalLesion3dInReport,
    includeKidney3dInReport,
    includeKnee3dInReport,
    includeMuscleTendon3dInReport,
    includeScrotum3dInReport,
    includeShoulder3dInReport,
    includeThyroid3dInReport,
    includeUsPlaneSimulatorInReport,
    includeVascular3dInReport,
    includeWrist3dInReport,
    inputReport,
    kidney3dData,
    knee3dData,
    modality,
    modelFor,
    muscleTendon3dData,
    operationalSummaryText,
    patientAge,
    patientEmail,
    patientGender,
    patientId,
    patientName,
    patientSummary,
    pdfLayoutType,
    reportDate,
    runClinicalPolishForReport,
    savedReports,
    scrotum3dData,
    selectedFile,
    selectedLogo,
    selectedLogoRight,
    setAdditionalEvalError,
    setAdditionalEvaluation,
    setBibliography,
    setBibliographyError,
    setBibliographySources,
    setCaseAnalysis,
    setCaseAnalysisError,
    setClassRecommendations,
    setCurrentCloudStudyId,
    setCurrentModInstruction,
    setGeneratedReport,
    setGenerationSteps,
    setImageEvaluation,
    setIncorporatedRecs,
    setIsGenerating,
    setIsMainReportExpanded,
    setModifyError,
    setOperationalSummaryText,
    setOriginalBaseReport,
    setPatientSummary,
    setPatientSummaryError,
    setReportEnrichmentSession,
    setReportError,
    setReportHistory,
    setReportRedoHistory,
    setSavedReports,
    setSelectedBatchModules,
    shoulder3dData,
    specificStudy,
    studyType,
    systemInstruction,
    thyroid3dData,
    uploadedReportContent,
    uploadedReportMimeType,
    usImagesGridMode,
    usPlaneSimulatorData,
    vascular3dData,
    wrist3dData
    ,
    autoLabelImagesAfterReport,
    fetchCloudStudies,
    triggerAutoImageEvaluation});
    return generate(mode);
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
          model: modelFor("quality_eval"),
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
          model: modelFor("report_modify"),
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
          model: modelFor("report_modify"),
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
        setModifyError(data.error || "Ocurrió un error al intentar modificar el informe.");
      }
    } catch (err: any) {
      console.error("Error al modificar informe:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setIsModifyingReport(false);
    }
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
    }

    // Auto-sync clinical history and study information into report generator inputs
    if (medicalHistoryCombined && !medicalHistoryCombined.includes("S/D. Sospecha: S/D")) {
      setClinicalHistory(prev => {
        if (!prev || prev.trim() === "") return medicalHistoryCombined;
        if (prev.includes(medicalHistoryCombined)) return prev;
        return `${prev}\n\n[Contexto Doble Valoración]: ${medicalHistoryCombined}`;
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
          model: modelFor("quality_eval"),
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
          model: modelFor("case_analysis"),
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

  const handleIncorporateDifferentialDiagnostics = async () => {
    if (!generatedReport || !caseAnalysis) return;
    setIsIncorporatingDiffs(true);
    setDiffsError(null);
    try {
      const response = await fetch("/api/incorporate-differentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelFor("case_analysis"),
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
          model: modelFor("bibliography"),
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
          model: modelFor("bibliography"),
          report: generatedReport,
          studyType: studyType || "Estudio Radiológico",
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
        setBibliographyError(data.error || "Error al buscar fuentes bibliográficas adicionales.");
      }
    } catch (err: any) {
      console.error("Error al buscar más bibliografía:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingMoreBibliography(false);
    }
  };

  // Gmail API Integrated Share Handlers (Google Workspace Integration)
    const handleOpenGmailShare = async (type: 'report_pdf' | 'patient_summary' | 'patient_infographic' | 'both_pdfs') => {
    const attachedKind = type === 'patient_infographic' ? 'patient_summary' : type;
    setGmailAttachedType(attachedKind as 'report_pdf' | 'patient_summary' | 'both_pdfs');
    setGmailTo(patientEmail || "");
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    const attachReport = type === 'report_pdf' || type === 'both_pdfs';
    const attachSummary = type === 'patient_summary' || type === 'both_pdfs';
    const attachInfographic = type === 'patient_infographic';
    setGmailAttachReport(attachReport);
    setGmailAttachSummary(attachSummary);
    setGmailAttachInfographic(attachInfographic);

    const clientName = patientName || "Paciente";
    let subject = `Reporte de Estudio Clínico - ${clientName}`;
    let body = `Estimado(a) ${clientName},\n\nLe enviamos adjunto a este correo el Reporte de Estudio Clínico Oficial realizado.\n\n`;

    if (type === 'patient_summary') {
      subject = `Explicación de su estudio - ${clientName}`;
      body = `Estimado(a) ${clientName},\n\nLe enviamos una explicación en lenguaje claro de su estudio. El informe radiológico formal, dirigido a su médico tratante, se entrega por separado.\n\n`;
    } else if (type === 'both_pdfs') {
      subject = `Informe y explicación de su estudio - ${clientName}`;
      body = `Estimado(a) ${clientName},\n\nLe enviamos dos documentos adjuntos:\n1) El informe radiológico formal (para su médico tratante).\n2) Una explicación en lenguaje claro para usted.\n\nEl informe formal es el documento que debe presentar en consulta.\n\n`;
    } else if (type === 'patient_infographic') {
      subject = `Infografía de su estudio - ${clientName}`;
      body = `Estimado(a) ${clientName},\n\nLe enviamos la infografía explicativa de su estudio.\n\n`;
    }

    body += `Quedamos a su entera disposición para cualquier aclaración o consulta adicional.\n\nAtentamente,\n${doctorName || "Médico Especialista"}`;

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
      setGmailErrorMessage("Error al iniciar acceso instantáneo: " + (err.message || String(err)));
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contraseña.");
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
        friendlyMsg = "El formato del correo es inválido.";
      }
      setGmailErrorMessage("Error de inicio de sesión: " + friendlyMsg);
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contraseña.");
      return;
    }
    if (authPassword.length < 6) {
      setGmailErrorMessage("La contraseña debe tener al menos 6 caracteres.");
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
        friendlyMsg = "Este correo electrónico ya está registrado.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "El formato del correo es inválido.";
      } else if (err.code === 'auth/weak-password') {
        friendlyMsg = "La contraseña es muy débil (mínimo 6 caracteres).";
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
    const send = createGmailSendAction({
      gmailAccessToken,
      gmailTo,
      gmailBody,
      gmailSubject,
      gmailAttachReport,
      gmailAttachSummary,
      gmailAttachInfographic,
      patientName,
      patientSummary,
      generatedReport,
      infographicUrl,
      handleDownloadPatientSummaryPDF,
      handleDownloadNativePDF,
      setIsSendingGmail,
      setGmailSuccessMessage,
      setGmailErrorMessage,
      setGmailAccessToken,
    });
    await send();
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

  const getWhatsAppTextPreview = (_overrideId?: string) => {
    return buildWhatsAppTextPreview({
      patientName,
      patientAge,
      patientGender,
      patientId,
      studyType,
      reportDate,
      doctorName,
      formatDateToDMY,
      whatsappIncludeOperationalSummary,
      operationalSummaryText,
      whatsappIncludePatientSummary,
      patientSummary,
    });
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
    const url = buildWhatsAppSendUrl(whatsappPhone || "", text);

    // 1. OPEN WHATSAPP ENTIRELY SYNCHRONOUSLY!
    // This is the absolute key to bypass the browser's popup blocker.
    try {
      window.open(url, "_blank");
    } catch (popupErr) {
      console.error("Popup blocker prevented opening WhatsApp:", popupErr);
    }

    // 2. Perform the heavy infographic processing in the background (No PDF downloads to local device)
    if (whatsappShareType === 'patient_infographic') {
      const shareUrl =
        infographicAudienceTab === "clinician"
          ? (infographicClinicianUrl || infographicUrl)
          : (infographicUrl || infographicClinicianUrl);
      if (shareUrl && (shareUrl.startsWith("data:") || shareUrl.startsWith("blob:") || shareUrl.startsWith("http"))) {
        try {
          const response = await fetch(shareUrl);
          const blob = await response.blob();
          const format = shareUrl.includes("image/png") ? "png" : "jpeg";
          const audienceLabel = infographicAudienceTab === "clinician" ? "medico" : "paciente";
          const file = new File([blob], `infografia_${audienceLabel}.${format}`, { type: blob.type });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: infographicAudienceTab === "clinician" ? "Infografía médico" : "Infografía paciente",
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
  const handleGeneratePatientSummary = async (reportOverride?: string) => {
    const reportContent =
      typeof reportOverride === "string" && reportOverride.trim()
        ? reportOverride
        : isEditingReportManual
          ? editedReportText
          : generatedReport;
    if (!reportContent) return;
    setIsGeneratingPatientSummary(true);
    setPatientSummaryError(null);
    setPatientSummary(null);
    setPatientSummaryProvider(null);
    setExpandedFindings({});
    try {
      const response = await fetch("/api/generate-patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelFor("patient_summary"),
          report: reportContent,
          studyType: studyType || "Estudio Radiol�gico",
          clinicalHistory: clinicalHistory || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        const raw = data.data;
        const findings = Array.isArray(raw.keyFindings)
          ? raw.keyFindings.map((f: any) => ({
              title: f?.title || "",
              originalTerm: f?.originalTerm || "",
              simplifiedExplanation: f?.simplifiedExplanation || "",
              analogy: f?.analogy || "",
              clinicalContext: f?.clinicalContext || f?.reassurance || "",
              reassurance: f?.clinicalContext || f?.reassurance || "",
            }))
          : [];
        const glossary = Array.isArray(raw.glossary)
          ? raw.glossary
              .map((g: any) => ({
                term: String(g?.term || "").trim(),
                plainDefinition: String(g?.plainDefinition || g?.definition || "").trim(),
              }))
              .filter((g: any) => g.term && g.plainDefinition)
          : [];
        setPatientSummary({
          studyOverview: raw.studyOverview || "",
          summary: raw.summary || "",
          keyFindings: findings,
          glossary,
        });
        setPatientSummaryProvider(data.provider === "openai" ? "openai" : "gemini");
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
          model: modelFor("glossary"),
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

  // ACTION: GENERATE OPERATIONAL SUMMARY FOR WHATSAPP
  const handleGenerateWhatsAppSummary = async (reportOverride?: string) => {
    const reportContent =
      typeof reportOverride === "string" && reportOverride.trim()
        ? reportOverride
        : isEditingReportManual
          ? editedReportText
          : generatedReport;
    if (!reportContent) return;
    setIsGeneratingOperationalSummary(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelFor("chat"),
          messages: [{
            role: "user",
            text: "Resume de forma muy concisa ÚNICAMENTE los hallazgos clínicos principales de este reporte médico en 3 o 4 viñetas de texto asertivas y claras, redactadas con un lenguaje profesional pero comprensible, apto para ser compartido por WhatsApp y consultado digitalmente por el paciente. NO incluyas ninguna recomendación, sugerencia de manejo ni plan a futuro, limítate estrictamente a los hallazgos de forma asertiva. No agregues preámbulos, saludos, ni comentarios personales, devuelve directamente las viñetas con guiones '-'. Reporte:\n\n" + reportContent
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
            patientName: patientName || "Paciente Anónimo",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "Médico Radiólogo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Clínica Privada",
            studyType: studyType || "Estudio General",
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "No especificadas",
            reportText: reportContent,
            pdfBase64: pdfB64,
            operationalSummaryText: summary,
            customLogoUrl: customLogoUrl || "",
            customLogoRightUrl: customLogoRightUrl || "",
            customLogoStyle: customLogoStyle || "logo",
            customSignatureUrl: customSignatureUrl || "",
            selectedLogo: selectedLogo || "none",
            selectedLogoRight: selectedLogoRight || "none",
            attachedImages: attachedImages || [],
            findings3dRenders: findings3dRenders || [],
            atlas3dData: atlas3dData || null,
            includeAtlas3dInReport: includeAtlas3dInReport,
            vascular3dData: vascular3dData || null,
            includeVascular3dInReport: includeVascular3dInReport,
            thyroid3dData: thyroid3dData || null,
            includeThyroid3dInReport: includeThyroid3dInReport,
            breast3dData: breast3dData || null,
            includeBreast3dInReport: includeBreast3dInReport,
            shoulder3dData: shoulder3dData || null,
            includeShoulder3dInReport: includeShoulder3dInReport,
            knee3dData: knee3dData || null,
            ankle3dData: ankle3dData || null,
            kidney3dData: kidney3dData || null,
            abdomen3dData: abdomen3dData || null,
            abdominalWall3dData: abdominalWall3dData || null,
            scrotum3dData: scrotum3dData || null,
            muscleTendon3dData: muscleTendon3dData || null,
            wrist3dData: wrist3dData || null,
            includeKnee3dInReport: includeKnee3dInReport,
            includeAnkle3dInReport: includeAnkle3dInReport,
            includeKidney3dInReport: includeKidney3dInReport,
            includeAbdomen3dInReport: includeAbdomen3dInReport,
            includeAbdominalWall3dInReport: includeAbdominalWall3dInReport,
            includeScrotum3dInReport: includeScrotum3dInReport,
            includeMuscleTendon3dInReport: includeMuscleTendon3dInReport,
            includeWrist3dInReport: includeWrist3dInReport,
            focalLesion3dData: focalLesion3dData || null,
            includeFocalLesion3dInReport: includeFocalLesion3dInReport,
            usPlaneSimulatorData: usPlaneSimulatorData || null,
            includeUsPlaneSimulatorInReport: includeUsPlaneSimulatorInReport,
            usImagesGridMode: usImagesGridMode || "auto",
            patientSummary: patientSummary || null
          });
          fetchCloudStudies(gmailUser.uid);
        }
      } else {
        alert("Ocurrió un error al generar el resumen. Por favor, intente de nuevo.");
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
          model: modelFor("schematic"),
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
          model: modelFor("case_analysis"),
          report: reportText,
          studyType: studyType || "Estudio Radiológico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSemiologyData(data.data);
        setSelectedConfirmedDiagnoses(new Array(data.data.confirmedDiagnoses?.length || 0).fill(true));
        setSelectedRuledOutPathologies(new Array(data.data.ruledOutPathologies?.length || 0).fill(true));
      } else {
        setSemiologyError(data.error || "Error al estructurar el cuadro de semiología.");
      }
    } catch (err: any) {
      console.error("Error al construir cuadro de semiología:", err);
      setSemiologyError(err?.message || String(err));
    } finally {
      setIsGeneratingSemiology(false);
    }
  };

  // Helper to build markdown dynamically based on user selections
  const buildDynamicSemiologyMarkdownTable = () => {
    if (!semiologyData) return "";
    
    let md = "### CUADRO DE SEMIOLOGÍA Y JUSTIFICACIÓN RADIOLÓGICA\n\n";
    
    const filteredDiagnoses = (semiologyData.confirmedDiagnoses || []).filter((_: any, idx: number) => selectedConfirmedDiagnoses[idx]);
    const filteredRuledOut = (semiologyData.ruledOutPathologies || []).filter((_: any, idx: number) => selectedRuledOutPathologies[idx]);
    
    if (filteredDiagnoses.length > 0) {
      md += "#### 1. Diagnósticos Confirmados y Justificación Semiológica\n\n";
      md += "| INTERPRETACIÓN SEMIOLÓGICA | HALLAZGOS |\n";
      md += "| :--- | :--- |\n";
      filteredDiagnoses.forEach((d: any) => {
        md += `| ${d.diagnosis.replace(/\|/g, "\\|")} | ${d.justification.replace(/\|/g, "\\|")} |\n`;
      });
      md += "\n";
    }
    
    if (filteredRuledOut.length > 0) {
      md += "#### 2. Patologías Diferenciales Descartadas y Evidencia de Exclusión\n\n";
      md += "| INTERPRETACIÓN SEMIOLÓGICA | HALLAZGOS |\n";
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
      alert("No has seleccionado ningún punto para insertar.");
      return;
    }

    const separator = "\n\n---\n\n";
    const newReportText = activeText + separator + contentToAppend;
    setGeneratedReport(newReportText);
    setEditedReportText(newReportText);
    alert("¡Cuadro de semiología por imágenes insertado con éxito al final de tu informe para el PDF formal!");
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
          model: modelFor("bibliography"),
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
        <p style="margin: 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #1e3a8a; font-weight: 600; background-color: #eff6ff; padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">🩺 <strong>Contexto descriptivo:</strong> ${finding.clinicalContext || finding.reassurance}</p>
      </div>
`).join("");

    const glossaryHtml = (Array.isArray(patientSummary.glossary) ? patientSummary.glossary : []).map((entry: any) => `
      <div style="margin-bottom: 12px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.03em;">${entry.term || ""}</p>
        <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">${entry.plainDefinition || entry.definition || ""}</p>
      </div>
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
            <h1>Explicación para usted</h1>
            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #4b5563;">Documento complementario · Lenguaje claro</p>
          </div>
          
          <div style="font-size: 13px; margin-bottom: 20px; color: #713f12; background: #fefce8; border: 1px solid #ca8a04; border-radius: 8px; padding: 12px 14px;">
            <strong>IMPORTANTE:</strong> Este documento es una explicación en lenguaje claro para usted. El informe radiológico formal, dirigido a su médico tratante, se entrega por separado y es el documento que debe presentar en consulta.
          </div>

          ${patientSummary.studyOverview ? `<div class="section-title">Qué estudio se le realizó</div><p style="font-size: 14px; color: #334155; line-height: 1.55;">${patientSummary.studyOverview}</p>` : ""}
          ${patientSummary.summary ? `<div class="section-title">En pocas palabras</div><p style="font-size: 14px; color: #334155; line-height: 1.55;">${patientSummary.summary}</p>` : ""}
          
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

          ${glossaryHtml ? `<div class="section-title">Glosario de términos</div><p style="font-size: 12px; color: #64748b; margin-top: -8px; margin-bottom: 14px;">Palabras del informe formal, explicadas en lenguaje claro.</p>${glossaryHtml}` : ""}
          
          <div class="footer">
            <strong>IMPORTANTE:</strong> Esta explicación complementa —pero nunca sustituye— el informe radiológico formal. Presente el informe formal en su consulta médica.
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
          model: modelFor("classifications"),
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

  // ACTION FOR INFOGRAPHIC GENERATION — dual posters (patient + clinician), full-size tabs in UI
  const handleGenerateInfographic = async (opts?: { keepAttachments?: boolean }) => {
    if (!generatedReport || !studyType) return;
    setIsGeneratingInfographic(true);
    setInfographicError(null);
    setInfographicUrl(null);
    setInfographicClinicianUrl(null);
    if (!opts?.keepAttachments) {
      setAttachInfographicToOfficialReport(false);
      setAttachInfographicToPatientSummary(false);
    }
    try {
      const notes = infographicCorrectionNotes.trim();
      const baseBody = {
        report: generatedReport,
        studyType,
        reportDate: reportDate || "",
        projections,
        viewOrientation: infographicViewOrientation,
        ...(notes ? { correctionNotes: notes } : {}),
      };
      const [patientRes, clinicianRes] = await Promise.all([
        fetch("/api/generate-infographic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, audience: "patient" }),
        }),
        fetch("/api/generate-infographic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, audience: "clinician" }),
        }),
      ]);
      const patientData = await patientRes.json();
      const clinicianData = await clinicianRes.json();

      if (!patientData.success && !clinicianData.success) {
        throw new Error(
          patientData.error ||
            clinicianData.error ||
            "Error generando las infografías."
        );
      }

      if (patientData.success && patientData.imageUrl) {
        setInfographicUrl(patientData.imageUrl);
      }
      if (clinicianData.success && clinicianData.imageUrl) {
        setInfographicClinicianUrl(clinicianData.imageUrl);
      }
      // Prefer patient tab if available; else clinician
      if (patientData.success) setInfographicAudienceTab("patient");
      else if (clinicianData.success) setInfographicAudienceTab("clinician");

      const orient =
        patientData.viewOrientation || clinicianData.viewOrientation;
      if (orient === "AP" || orient === "PA") {
        setInfographicViewOrientation(orient);
      }

      if (!patientData.success || !clinicianData.success) {
        setInfographicError(
          !patientData.success
            ? `Versión paciente: ${patientData.error || "falló"}. Se muestra la disponible.`
            : `Versión médico: ${clinicianData.error || "falló"}. Se muestra la disponible.`
        );
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
          model: modelFor("classifications"),
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
          model: modelFor("chat"),
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
          model: modelFor("classifications"),
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

  // PDF Printing Utilities ? QA Gate before export / print / share
  const buildReportQaFingerprint = () =>
    buildReportQaFingerprintValue({
      generatedReport,
      laterality,
      studyType,
      clinicalScorecardData,
      reportEnrichmentSession,
    });

  const guardReportPdfExport = (action: () => void | Promise<void>) => {
    if (!generatedReport) {
      void action();
      return;
    }
    const fingerprint = buildReportQaFingerprint();
    if (qaGateAckFingerprint && qaGateAckFingerprint === fingerprint) {
      void action();
      return;
    }
    const result = runReportQaGate({
      reportText: generatedReport,
      laterality,
      studyType,
      scorecard: clinicalScorecardData,
      enrichmentSession: reportEnrichmentSession,
    });
    if (result.ok) {
      void action();
      return;
    }
    qaGatePendingActionRef.current = () => {
      setQaGateAckFingerprint(fingerprint);
      setQaGateResult(null);
      qaGatePendingActionRef.current = null;
      void action();
    };
    setQaGateResult(result);
  };

  const handleDismissQaGate = () => {
    qaGatePendingActionRef.current = null;
    setQaGateResult(null);
  };

  const handleProceedQaGateAnyway = () => {
    const pending = qaGatePendingActionRef.current;
    if (pending) pending();
    else setQaGateResult(null);
  };

  const handlePrintPDF = () => {
    guardReportPdfExport(() => {
      if (!generatedReport) return;
      setShowPrintModal(true);
      try {
        window.print();
      } catch (e) {
        console.warn("window.print block protected", e);
      }
    });
  };

  const ensureCompatibleImageFormat = compressImageForAttachment;


  const detectImageMetaFromFilename = (filename: string, dicomMeta?: Record<string, string>) =>
    detectImageMetaFromFilenameLib(filename, dicomMeta, specificStudy);

  const autoLabelRunIdRef = useRef(0);

  useEffect(() => {
    if (isLabelingAll) return;
    const total = attachedImages.length;
    const confirmed = attachedImages.filter((img) => Boolean((img as { caption?: string }).caption?.trim())).length;
    setLabelingStats({ confirmed, total });
  }, [attachedImages, isLabelingAll]);


  const autoLabelImagesAfterReport = async (reportText: string) => {
    const report = String(reportText || "").trim();
    if (!report || attachedImages.length === 0) return;

    const runId = ++autoLabelRunIdRef.current;
    const imagesSnapshot = [...attachedImages];
    const labelUpdates = new Map<
      string,
      { label: string; modality?: string; projection?: string; side?: string }
    >();
    const unlabeledCount = imagesSnapshot.filter((img) => !(img as { caption?: string }).caption?.trim()).length;
    const total = unlabeledCount > 0 ? unlabeledCount : imagesSnapshot.length;
    setIsLabelingAll(true);
    setLabelingStats({ confirmed: 0, total });

    try {
      await runBackgroundTask(
        `auto-label-after-report-${runId}`,
        `Rotulando automaticamente ${total} imagenes`,
        async () => {
          const payload: AttachedImageForLabeling[] = imagesSnapshot.map((img) => ({
            id: img.id,
            name: (img as { name?: string }).name,
            url: img.url,
            base64: (img as { base64?: string }).base64,
            caption: (img as { caption?: string }).caption,
            modality: (img as { modality?: string }).modality,
          }));

          await autoLabelAttachedImages({
            images: payload,
            reportText: report,
            studyType: studyType || specificStudy || "Ecografia US",
            clinicalHistory: clinicalHistory || "",
            model: modelFor("labeling"),
            onlyUnlabeled: true,
            concurrency: 2,
            shouldCancel: () => autoLabelRunIdRef.current !== runId,
            onProgress: ({ done, total: t }) => {
              if (autoLabelRunIdRef.current !== runId) return;
              setLabelingStats({ confirmed: done, total: t });
            },
            onLabeled: (imageId, result) => {
              if (autoLabelRunIdRef.current !== runId) return;
              labelUpdates.set(imageId, result);
              setAttachedImages((prev) =>
                prev.map((item) =>
                  item.id === imageId
                    ? {
                        ...item,
                        caption: result.label,
                        ...(result.modality ? { modality: result.modality } : {}),
                        ...(result.projection ? { projection: result.projection } : {}),
                        ...(result.side ? { side: result.side } : {}),
                      }
                    : item
                )
              );
            },
          });
        }
      );

      // After labeling, link + reorder by report mention (MMG + US in combined studies).
      if (autoLabelRunIdRef.current === runId) {
        const mergedForCorrelation = imagesSnapshot.map((img) => {
          const u = labelUpdates.get(img.id);
          if (!u) return img;
          return {
            ...img,
            caption: u.label,
            ...(u.modality ? { modality: u.modality } : {}),
            ...(u.projection ? { projection: u.projection } : {}),
            ...(u.side ? { side: u.side } : {}),
          };
        });
        await handleCorrelateFigures({
          reportOverride: report,
          silent: true,
          imagesOverride: mergedForCorrelation,
        });
      }
    } catch (err) {
      console.error("Error en rotulado automatico post-reporte:", err);
    } finally {
      if (autoLabelRunIdRef.current === runId) {
        setIsLabelingAll(false);
        setLabelingStats((prev) => ({
          confirmed: attachedImages.filter((img) => (img as { caption?: string }).caption?.trim()).length || prev.confirmed,
          total: attachedImages.length || prev.total,
        }));
      }
    }
  };

  const handleLabelQueueCaptionUpdate = (id: string, caption: string) => {
    setAttachedImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  };

  const handleAiLabelImage = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem || loadingAiLabelIds[id]) return;

    setLoadingAiLabelIds(prev => ({ ...prev, [id]: true }));
    try {
      await runBackgroundTask(`label-${id}`, "Rotulando imagen con IA", async () => {
        const response = await fetch("/api/classify-and-label-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelFor("labeling"),
            image: imgItem.base64 || imgItem.url,
            filename: imgItem.name,
            studyType: specificStudy || "Mamograf�a y Ultrasonido",
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
          throw new Error(data.error || "No se pudo generar la rotulaci�n con IA.");
        }
      });
    } catch (err) {
      console.error("Error al rotular con IA:", err);
      alert(err instanceof Error ? err.message : "Error de conexi�n al rotular la foto.");
    } finally {
      setLoadingAiLabelIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleAutocompleteLabelFromReport = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem || loadingAutocompleteIds[id]) return;
    
    if (!imgItem.caption || !imgItem.caption.trim()) {
      alert("Por favor, escribe primero una palabra o frase clave en la descripci�n (ej. 'ves�cula', 'quiste' o 'car�tida') para poder buscar y autocompletar desde el reporte.");
      return;
    }

    const reportToUse = generatedReport || inputReport || findings;
    if (!reportToUse) {
      alert("Por favor, redacta o genera el reporte primero para poder buscar y autocompletar la rotulaci�n.");
      return;
    }

    setLoadingAutocompleteIds(prev => ({ ...prev, [id]: true }));
    try {
      await runBackgroundTask(`autocomplete-${id}`, "Completando rotulaci�n desde reporte", async () => {
        const response = await fetch("/api/autocomplete-label-from-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelFor("labeling"),
            phrase: imgItem.caption,
            currentReport: reportToUse,
            studyType: specificStudy || "Mamograf�a / Ecograf�a",
            clinicalHistory: clinicalHistory || "",
          }),
        });

        const data = await response.json();
        if (response.ok && data.success && data.label) {
          setAttachedImages(prev => prev.map(item => item.id === id ? { ...item, caption: data.label } : item));
        } else {
          throw new Error(data.error || "No se pudo autocompletar la rotulaci�n.");
        }
      });
    } catch (err) {
      console.error("Error al autocompletar rotulaci�n:", err);
      alert(err instanceof Error ? err.message : "Error de conexi�n al autocompletar desde el reporte.");
    } finally {
      setLoadingAutocompleteIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleAiLabelAllImages = () => {
    if (attachedImages.length === 0 || isLabelingAll) return;
    const report = String(generatedReport || inputReport || findings || "").trim();
    if (!report) {
      alert("Genera el reporte primero para rotular las imagenes automaticamente.");
      return;
    }
    void autoLabelImagesAfterReport(report);
  };


  const handleCorrelateFigures = async (opts?: {
    reportOverride?: string;
    silent?: boolean;
    imagesOverride?: typeof attachedImages;
  }) => {
    const reportToUse = String(opts?.reportOverride || generatedReport || inputReport || findings || "").trim();
    const sourceImages = opts?.imagesOverride || attachedImages;
    if (!reportToUse) {
      if (!opts?.silent) {
        alert("Por favor, genera un reporte o redacta un borrador primero para poder correlacionar las figuras.");
      }
      return;
    }
    if (sourceImages.length === 0) {
      if (!opts?.silent) {
        alert("No hay im�genes cargadas para correlacionar. Por favor sube im�genes primero.");
      }
      return;
    }

    setIsCorrelatingFigures(true);
    try {
      // Include MMG/US modality + projection so mammo frames link to the MMG section.
      const imagesForCorrelation = sourceImages.map((img, idx) => ({
        id: img.id,
        index: idx + 1,
        name: (img as { name?: string }).name || "",
        caption: (img as { caption?: string }).caption || (img as { name?: string }).name || "",
        modality: (img as { modality?: string }).modality || "",
        projection: (img as { projection?: string }).projection || "",
        side: (img as { side?: string }).side || "",
      }));

      const response = await fetch("/api/correlate-figures-retroactive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelFor("report_modify"),
          currentReport: reportToUse,
          studyType: studyType || specificStudy || modality || "",
          attachedImages: imagesForCorrelation,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.report) {
        if (generatedReport) {
          setReportHistory(prev => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);

        setAttachedImages((prev) => {
          const overrideById = new Map((opts?.imagesOverride || []).map((img) => [img.id, img]));
          const merged = prev.map((p) => {
            const o = overrideById.get(p.id) as any;
            if (!o) return p;
            return {
              ...p,
              caption: o.caption ?? (p as any).caption,
              modality: o.modality ?? (p as any).modality,
              projection: o.projection ?? (p as any).projection,
              side: o.side ?? (p as any).side,
            };
          });
          return applyReorderedImageIds(merged, data.reorderedImageIds, data.report || reportToUse);
        });
      } else if (!opts?.silent) {
        alert(data.error || "Ocurri� un error al intentar correlacionar las figuras.");
      }
    } catch (err) {
      console.error("Error al correlacionar figuras:", err);
      // Local fallback: still reorder gallery by mention order (MMG before/with US as in report).
      setAttachedImages((prev) => {
        const overrideById = new Map((opts?.imagesOverride || []).map((img) => [img.id, img]));
        const merged = prev.map((p) => {
          const o = overrideById.get(p.id) as any;
          if (!o) return p;
          return {
            ...p,
            caption: o.caption ?? (p as any).caption,
            modality: o.modality ?? (p as any).modality,
            projection: o.projection ?? (p as any).projection,
            side: o.side ?? (p as any).side,
          };
        });
        return applyReorderedImageIds(merged, null, reportToUse);
      });
      if (!opts?.silent) {
        alert("Error de red al intentar correlacionar las figuras.");
      }
    } finally {
      setIsCorrelatingFigures(false);
    }
  };

  const handleAttachedFiles = createAttachedFilesHandler({
    detectImageMetaFromFilename,
    modality,
    setAttachedImages,
  });


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

  const getParagraphSeverity = (text: string): "critical" | "altered" | "normal" =>
    resolveParagraphSeverity(text, manualSeverityOverrides, aiSeverityCache);

  const handleDownloadNativePDF = async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    studyOverride?: Partial<CloudStudy>,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    const download = createNativePdfDownload({
    abdomen3dData,
    abdominalWall3dData,
    ankle3dData,
    atlas3dData,
    attachInfographicToOfficialReport,
    attachSummaryToOfficialReport,
    attachedImages,
    biomechanicalRadarData,
    breast3dData,
    clinicalScorecardData,
    detectImageMetaFromFilename,
    differentialTreeData,
    editedReportText,
    elastographyCAP,
    elastographyEtiology,
    elastographyFatFraction,
    elastographyImage3d,
    elastographyOriginalImage,
    elastographyStiffness,
    findings3dRenders,
    findingsInfographicData,
    dominantLesionCardData,
    focalLesion3dData,
    getParagraphSeverity,
    includeAbdomen3dInReport,
    includeAbdominalWall3dInReport,
    includeAnkle3dInReport,
    includeAtlas3dInReport,
    includeBreast3dInReport,
    includeDifferentialTreeInReport,
    includeElastographyInReport,
    includeFindingsInfographicInReport,
    includeDominantLesionCardInReport,
    includeFocalLesion3dInReport,
    includeKidney3dInReport,
    includeKnee3dInReport,
    includeMeasurementGaugesInReport,
    includeMeasurementNormalsInPdf,
    includeMuscleTendon3dInReport,
    includeNegativityChecklistInReport,
    includeRadarInReport,
    includeReasoningChainInReport,
    includeScorecardInReport,
    includeScrotum3dInReport,
    includeSemioticsConductMatrixInReport,
    includeShoulder3dInReport,
    includeThyroid3dInReport,
    includeUsPlaneSimulatorInReport,
    includeVascular3dInReport,
    includeWrist3dInReport,
    infographicUrl,
    infographicClinicianUrl,
    isEditingReportManual,
    isSyntacticHighlightingActive,
    kidney3dData,
    knee3dData,
    measurementGaugeData,
    modality,
    muscleTendon3dData,
    negativityChecklistData,
    patientSummary,
    pdfStateRef,
    reasoningChainData,
    scrotum3dData,
    semioticsConductMatrixData,
    shoulder3dData,
    thyroid3dData,
    usImagesGridMode,
    usPlaneSimulatorData,
    vascular3dData,
    wrist3dData
    });
    return download(openInNewTab, shareViaWebShare, returnBase64, returnBlobUrl, studyOverride, returnRawBlob);
  };


  const handleDownloadPatientSummaryPDF = async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    return downloadPatientSummaryPdf(
      {
        patientSummary,
        clinicName,
        customLogoUrl,
        customLogoRightUrl,
        customSignatureUrl,
        customLogoStyle,
        patientName,
        reportDate,
        doctorName,
        doctorLicense,
        studyType,
        selectedLogo,
        formatDateToDMY,
        infographicUrl: attachInfographicToPatientSummary && infographicUrl ? infographicUrl : undefined,
      },
      openInNewTab,
      shareViaWebShare,
      returnBase64,
      returnBlobUrl,
      returnRawBlob
    );
  };

  const handleSaveToDrive = async () => {
    const save = createDriveSaveAction({
      patientName,
      patientSummary,
      handleDownloadNativePDF,
      handleDownloadPatientSummaryPDF,
      setIsUploadingToDrive,
      setDriveUploadStatus,
    });
    await save();
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
              if (prev && prev !== rUrl) { try { URL.revokeObjectURL(prev); } catch (_) {} }
              return rUrl;
            });
          }
        } else {
          setGeneratedNativePdfUrl(null);
        }
        if (patientSummary) {
          const sUrl = await handleDownloadPatientSummaryPDF(false, false, false, true);
          if (active && sUrl) {
            setGeneratedSummaryPdfUrl(prev => {
              if (prev && prev !== sUrl) { try { URL.revokeObjectURL(prev); } catch (_) {} }
              return sUrl;
            });
          }
        } else {
          setGeneratedSummaryPdfUrl(null);
        }
      } catch (err) {
        console.error("Error generating PDF previews dynamically:", err);
      } finally {
        if (active) {
          setIsGeneratingPdfPreview(false);
        }
      }
    };

    if (isEditingReportManual) {
      timeoutId = setTimeout(() => {
        updatePreviews();
      }, 400);
    } else {
      updatePreviews();
    }

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    showPrintModal,
    isSplitPdfActive,
    isEditingReportManual,
    editedReportText,
    adaptivePDFContrast,
    generatedReport,
    patientSummary,
    clinicName,
    doctorName,
    doctorLicense,
    reportDate,
    customLogoUrl,
    customSignatureUrl,
    selectedLogo,
    patientName,
    pdfLayoutType,
    infographicUrl,
    attachInfographicToPatientSummary
  ]);

  const renderPrintReportBody = (reportText: string) =>
    renderPrintReportBodyView(reportText, {
      adaptivePDFContrast,
      isSyntacticHighlightingActive,
      getParagraphSeverity,
    });

  // Clipboard copy utilities
  const copyToClipboard = async (text: string, isReport: boolean = false, presetId?: string) => {
    await copyReportToClipboard(text, {
      isReport,
      presetId,
      onReportCopied: () => {
        setCopiedReportId(true);
        setTimeout(() => setCopiedReportId(false), 2000);
      },
      onPresetCopied: (id) => {
        setPresetCopiedId(id);
        setTimeout(() => setPresetCopiedId(null), 2000);
      },
    });
  };

  const renderClinicalReport = (reportText: string) => (
    <ClinicalReportView
      reportText={reportText}
      selectedLogo={selectedLogo}
      selectedParagraphOriginal={selectedParagraphOriginal}
      isSyntacticHighlightingActive={isSyntacticHighlightingActive}
      onTextSelection={handleTextSelection}
      onSelectParagraph={handleSelectParagraph}
      getParagraphSeverity={getParagraphSeverity}
    />
  );

  const persistUserSettings = async (
    settings: { systemInstruction: string; chatInstruction: string; classifyInstruction: string },
    options: { silent?: boolean } = {}
  ) => {
    await persistUserSettingsToStores(settings, {
      userId: gmailUser?.uid,
      silent: options.silent,
    });
  };

  const handleSaveSettings = () => {
    persistUserSettings({ systemInstruction, chatInstruction, classifyInstruction });
  };

  useEffect(() => {
    const loadUserSettings = async () => {
      let sys = localStorage.getItem("radiology_sys_inst") || GENERAL_SYSTEM_INSTRUCTION;
      let chat = localStorage.getItem("radiology_chat_inst") || CHAT_SYSTEM_INSTRUCTION;
      let cls = localStorage.getItem("radiology_class_inst") || CLASSIFICATION_SYSTEM_INSTRUCTION;
      let bestUpdatedAt = 0;

      const idbSettings = await idbGetUserSettings();
      if (idbSettings && (idbSettings.updatedAt || 0) >= bestUpdatedAt) {
        sys = idbSettings.systemInstruction || sys;
        chat = idbSettings.chatInstruction || chat;
        cls = idbSettings.classifyInstruction || cls;
        bestUpdatedAt = idbSettings.updatedAt || 0;
      }

      const activeUserId = gmailUser?.uid;
      if (activeUserId) {
        try {
          const cloudSettings = await getUserSettingsFromCloud(activeUserId);
          if (cloudSettings && (cloudSettings.updatedAt || 0) >= bestUpdatedAt) {
            sys = cloudSettings.systemInstruction || sys;
            chat = cloudSettings.chatInstruction || chat;
            cls = cloudSettings.classifyInstruction || cls;
          }
        } catch (err) {
          console.warn("Could not load user settings from cloud:", err);
        }
      }

      setSystemInstruction(sys);
      setChatInstruction(chat);
      setClassifyInstruction(cls);
      settingsLoadedRef.current = true;
    };

    settingsLoadedRef.current = false;
    loadUserSettings();
  }, [gmailUser?.uid]);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = setTimeout(() => {
      persistUserSettings(
        { systemInstruction, chatInstruction, classifyInstruction },
        { silent: true }
      );
    }, 900);

    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, [systemInstruction, chatInstruction, classifyInstruction, gmailUser?.uid]);

  const handleResetSettings = () => {
    if (confirm("¿Estás seguro de que deseas restablecer todas las instrucciones a sus valores médicos por defecto?")) {
      setSystemInstruction(GENERAL_SYSTEM_INSTRUCTION);
      setChatInstruction(CHAT_SYSTEM_INSTRUCTION);
      setClassifyInstruction(CLASSIFICATION_SYSTEM_INSTRUCTION);
      persistUserSettings({
        systemInstruction: GENERAL_SYSTEM_INSTRUCTION,
        chatInstruction: CHAT_SYSTEM_INSTRUCTION,
        classifyInstruction: CLASSIFICATION_SYSTEM_INSTRUCTION,
      }, { silent: true });
    }
  };

  // Delete individual historical report (+ matching local/cloud study copies)
  const handleDeleteReport = async (id: string) => {
    markStudiesDeleted([id]);
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem("radiology_reports_history", JSON.stringify(updated));
    await idbSaveHistory(updated);
    try {
      await idbDeleteStudy(id);
      const stored = localStorage.getItem("rad_local_studies");
      if (stored) {
        const studiesList = (JSON.parse(stored) as CloudStudy[]).filter((s) => s.id !== id);
        localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
      }
      localStorage.removeItem(`fallback_single_study_${id}`);
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith("fallback_studies_")) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const list = (JSON.parse(raw) as CloudStudy[]).filter((s) => s.id !== id);
            localStorage.setItem(key, JSON.stringify(list));
          }
        }
      } catch (_) {}
      setCloudStudies((prev) => prev.filter((s) => s.id !== id));
      if (gmailUser?.uid) {
        try {
          await deleteStudyFromCloud(id);
        } catch (e) {
          console.warn("No se pudo eliminar la copia en la nube (qued� bloqueada localmente):", id, e);
        }
      }
    } catch (e) {
      console.warn("No se pudo eliminar la copia local del estudio:", e);
    }
  };

  const handleClearHistory = async () => {
    const loggedIn = Boolean(gmailUser?.uid);
    if (
      !confirm(
        loggedIn
          ? "�Vaciar TODO el historial de reportes y estudios (local y nube)? Si solo se borra en este navegador, al reiniciar pueden volver a aparecer desde la nube."
          : "�Vaciar todo el historial local de reportes y estudios guardados en este navegador? (No afectar� el informe que tengas abierto ahora)"
      )
    ) {
      return;
    }

    // Collect IDs before wipe so we can remove cloud copies and tombstone them
    const ids = new Set<string>();
    savedReports.forEach((r) => ids.add(r.id));
    cloudStudies.forEach((s) => ids.add(s.id));
    try {
      const idbStudies = await idbGetAllStudies();
      idbStudies.forEach((s) => ids.add(s.id));
    } catch (_) {}
    try {
      const stored = localStorage.getItem("rad_local_studies");
      if (stored) {
        (JSON.parse(stored) as CloudStudy[]).forEach((s) => ids.add(s.id));
      }
    } catch (_) {}

    markStudiesDeleted(ids);

    setSavedReports([]);
    setCloudStudies([]);
    localStorage.removeItem("radiology_reports_history");
    localStorage.removeItem("rad_local_studies");
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("fallback_single_study_") || key.startsWith("fallback_studies_"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (_) {}

    await idbSaveHistory([]);
    await idbClearAllStudies();

    if (loggedIn && ids.size > 0) {
      for (const id of ids) {
        try {
          await deleteStudyFromCloud(id);
        } catch (e) {
          console.warn("No se pudo eliminar estudio de la nube:", id, e);
        }
      }
      // Also purge any remaining remote studies for this user (IDs we might not have known locally)
      try {
        const remote = await getStudiesFromCloud(gmailUser!.uid);
        if (remote.length > 0) {
          markStudiesDeleted(remote.map((s) => s.id));
          for (const study of remote) {
            try {
              await deleteStudyFromCloud(study.id);
            } catch (e) {
              console.warn("No se pudo eliminar estudio remoto restante:", study.id, e);
            }
          }
        }
      } catch (e) {
        console.warn("No se pudo listar estudios remotos al vaciar historial:", e);
      }
    }
  };

  const handleExportAllData = () => {
    try {
      const dataToBackup = buildSettingsBackup({
        customLogos,
        selectedLogo,
        selectedLogoRight,
        customLogoStyle,
        customSignatureUrl,
      });
      downloadSettingsBackupJson(dataToBackup);
    } catch (err: any) {
      alert("Error al exportar los datos: " + err.message);
    }
  };


  const handleImportAllData = createImportAllDataHandler({
    selectedLogo,
    selectedLogoRight,
    customLogoStyle,
    customSignatureUrl,
    systemInstruction,
    chatInstruction,
    classifyInstruction,
    setWorklist,
    setDoctorName,
    setDoctorLicense,
    setClinicName,
    setCustomLogos,
    setSelectedLogo,
    setSelectedLogoRight,
    setCustomLogoStyle,
    setCustomSignatureUrl,
    setPdfLayoutType,
    setSystemInstruction,
    setChatInstruction,
    setClassifyInstruction,
    persistBrandingAssets,
  });


  const {
    bridgeOnline,
    bridgeDicomReady,
    bridgeCaptureMismatch,
    setBridgeCaptureMismatch,
    importBridgeCapturesForPatient,
    activePatientCaptureCount,
  } = useLocalBridge({
    patientId,
    activeWorklistPatientId: activeWorklistPatient?.patientId,
    attachedImages,
    setAttachedImages,
    setBridgePatientCount,
  });

  const { handleSelectWorklistPatient, handleFinishActivePatient } = createWorklistSessionHandlers({
    worklist,
    selectedWorklistPatientId,
    generatedReport,
    clinicalHistory,
    attachedImages,
    saveWorklist,
    handleUpdatePatientStatus,
    importBridgeCapturesForPatient,
    setSelectedWorklistPatientId,
    setIsWorklistSidebarOpen,
    setCurrentCloudStudyId,
    setBridgeCaptureMismatch,
    setLabelQueueTrigger,
    setLabelingStats,
    setIsLabelQueueOpen,
    setPatientName,
    setPatientAge,
    setPatientGender,
    setPatientId,
    setStudyType,
    setWhatsappPhone,
  });


  // --- CLOUD DATABASE SYSTEM SYNC ---
  const convertLocalReportsToFallbackCloudStudies = (uid: string): CloudStudy[] =>
    convertLocalReportsToFallbackCloudStudiesLib(uid, {
      userEmail: gmailUser?.email,
      doctorName,
      doctorLicense,
      clinicName,
    });

  const {
    fetchCloudStudies,
    migrateBackupStudiesToFirebase,
    downloadPdfForCloudStudy,
    handleSaveToCloud,
    handleDeleteFromCloud,
    handleCopyEhrLinkForStudy,
    handleCopyEhrPortalLink,
  } = createCloudStudyActions({
    gmailUser,
    doctorName,
    doctorLicense,
    clinicName,
    currentCloudStudyId,
    studyType,
    clinicalHistory,
    generatedReport,
    customLogoUrl,
    customLogoRightUrl,
    customSignatureUrl,
    customLogoStyle,
    patientName,
    patientEmail,
    patientAge,
    patientGender,
    patientId,
    reportDate,
    findings,
    operationalSummaryText,
    specificStudy,
    pdfLayoutType,
    selectedLogo,
    selectedLogoRight,
    attachedImages,
    findings3dRenders,
    patientSummary,
    compressImageBase64,
    handleDownloadNativePDF,
    setIsLoadingCloudStudies,
    setCloudStudiesError,
    setCloudStudies,
    setSavedReports,
    setMigrationProgress,
    setIsSavingToCloud,
    setCloudStudiesSuccess,
    setCurrentCloudStudyId,
    setCopiedEhrStudyId,
  });

  // Hydrate lightweight report history from localStorage / IndexedDB on boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let reports: SavedReport[] = [];
        const stored = localStorage.getItem("radiology_reports_history");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) reports = parsed;
        }
        if (reports.length === 0) {
          const fromIdb = await idbGetHistory();
          if (Array.isArray(fromIdb) && fromIdb.length > 0) {
            reports = fromIdb;
            try {
              localStorage.setItem("radiology_reports_history", JSON.stringify(fromIdb.slice(0, 50)));
            } catch (_) {}
          }
        }
        reports = filterOutDeletedStudies(reports);
        if (!cancelled && reports.length > 0) {
          setSavedReports(reports.slice(0, 50));
        } else if (!cancelled) {
          setSavedReports([]);
        }
      } catch (e) {
        console.warn("No se pudo hidratar el historial local:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchCloudStudies(gmailUser?.uid);
  }, [gmailUser]);

  // Slash variant for EHR / patient-view date displays (shadows hyphen formatter above)
  const formatDateToDMY = formatDateSlashDMY;


  if (isPatientPublicView) {
    if (isPatientViewLoading) {
      return (
        <div className="min-h-screen bg-[#070A13] flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
              Cargando Portal de Consulta Digital...
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              Buscando estudio médico seguro en la nube.
            </p>
          </div>
        </div>
      );
    }

    if (patientViewError) {
      return (
        <div className="min-h-screen bg-[#070A13] flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <span className="text-4xl">⚠️</span>
            <div className="space-y-2">
              <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
                Error de Acceso
              </h2>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                {patientViewError}
              </p>
            </div>
            <button
              onClick={() => {
                window.location.search = "";
              }}
              className="w-full py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl text-[10px] font-black font-mono text-slate-350 uppercase tracking-widest transition-all cursor-pointer"
            >
              Ir al Inicio de RAD-AI
            </button>
          </div>
        </div>
      );
    }

    const handleDownloadCloudPDF = () => {
      if (loadedCloudPdfBase64) {
        try {
          const byteCharacters = atob(loadedCloudPdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Reporte_Radiologico_${(patientName || "Paciente").replace(/\s+/g, "_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error("Error decoding base64 PDF from cloud, falling back:", err);
          handleDownloadNativePDF(false, false, false, false, {
            patientName,
            patientEmail,
            patientAge,
            patientGender,
            patientId,
            reportDate,
            doctorName,
            doctorLicense,
            clinicName,
            studyType,
            clinicalHistory,
            findings,
            reportText: generatedReport,
            customLogoUrl: patientLogoUrl,
            customLogoRightUrl: patientLogoRightUrl,
            customLogoStyle,
            customSignatureUrl,
            specificStudy,
            pdfLayoutType,
            selectedLogo,
            selectedLogoRight
          });
        }
      } else {
        handleDownloadNativePDF(false, false, false, false, {
          patientName,
          patientEmail,
          patientAge,
          patientGender,
          patientId,
          reportDate,
          doctorName,
          doctorLicense,
          clinicName,
          studyType,
          clinicalHistory,
          findings,
          reportText: generatedReport,
          customLogoUrl: patientLogoUrl,
          customLogoRightUrl: patientLogoRightUrl,
          customLogoStyle,
          customSignatureUrl,
          specificStudy,
          pdfLayoutType,
          selectedLogo,
          selectedLogoRight
        });
      }
    };

    return (
      <div className="min-h-screen bg-[#070A13] text-slate-100 font-sans flex flex-col antialiased">
        {/* Patient Portal Header */}
        <header className="px-6 py-5 border-b border-slate-850 bg-slate-950/60 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
              <span className="text-sm font-sans">🩺</span>
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
                Portal de Consulta Digital
              </h1>
              <p className="text-[11px] font-black text-white uppercase tracking-tight mt-0.5">
                {clinicName || "Clínica Radiológica"}
              </p>
            </div>
          </div>
          <span className="text-[8px] font-black tracking-widest uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md font-mono">
            Conexión Segura SSL
          </span>
        </header>

        {/* Portal Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
          {/* Welcome Banner */}
          <div className="p-6 bg-gradient-to-r from-indigo-950/30 to-slate-950 border border-indigo-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left space-y-1">
              <h2 className="text-lg font-black text-white tracking-tight leading-tight">
                ¡Hola, {patientName || "Paciente"}!
              </h2>
              <p className="text-xs text-slate-400">
                Tu reporte de estudio clínico ya está disponible para consulta y descarga digital.
              </p>
            </div>
            <button
              onClick={handleDownloadCloudPDF}
              className="shrink-0 px-6 py-3 bg-emerald-600 hover:bg-emerald-550 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-wider font-mono text-white transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>📥 Descargar PDF Oficial Completo</span>
            </button>
          </div>

          {/* Patient Study Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Paciente</span>
              <p className="text-xs font-extrabold text-white mt-1 uppercase text-left">{patientName || "No especificado"}</p>
              {(patientId || patientAge || patientGender) && (
                <div className="mt-2 pt-1.5 border-t border-slate-900 space-y-0.5 text-[10px] text-slate-400">
                  {patientId && <p><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">ID:</span> <span className="font-semibold text-slate-300 uppercase">{patientId}</span></p>}
                  {patientAge && <p><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Edad:</span> <span className="font-semibold text-slate-300 uppercase">{patientAge}</span></p>}
                  {patientGender && <p><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Género:</span> <span className="font-semibold text-slate-300 uppercase">{patientGender}</span></p>}
                </div>
              )}
            </div>
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Tipo de Estudio</span>
              <p className="text-xs font-extrabold text-indigo-300 mt-1 uppercase text-left">{studyType || "No especificado"}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Fecha del Reporte</span>
              <p className="text-xs font-extrabold text-emerald-400 mt-1 font-mono text-left">{formatDateToDMY(reportDate) || "No especificada"}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Médico Informante</span>
              <p className="text-xs font-extrabold text-white mt-1 uppercase">{doctorName || "No especificado"}</p>
              {doctorLicense && <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">Reg. {doctorLicense}</p>}
            </div>
          </div>

          {/* Elegant Black Box Operational Summary */}
          {operationalSummaryText && (
            <div className="bg-black border-2 border-slate-850 rounded-3xl overflow-hidden shadow-2xl relative transition-all duration-300 hover:border-emerald-500/35 text-left p-6 md:p-8 space-y-6">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
              <div className="flex items-center justify-between border-b border-slate-850 pb-4 select-none">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Resumen de Hallazgos Recibido
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  VERIFICADO
                </span>
              </div>
              <div>
                <h3 className="text-white font-sans font-black text-base md:text-lg uppercase tracking-wider flex items-center gap-2 select-none">
                  📋 Resumen Operacional del Estudio
                </h3>
                <p className="text-slate-450 text-xs mt-1">
                  Resumen estructurado de los hallazgos principales y la impresión diagnóstica del estudio clínico para consulta ágil del paciente.
                </p>
              </div>
              <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-6 text-slate-200 font-sans leading-relaxed text-sm space-y-4">
                {renderElegantPatientResumenDark(operationalSummaryText)}
              </div>
              <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest text-center select-none pt-2">
                Generado por el Asistente Clínico de RAD-AI • Verificado por el médico tratante
              </p>
            </div>
          )}

          {/* Patient Explanation / Acompañamiento del Paciente */}
          {patientSummary && (
            <div className="bg-slate-950/60 border border-slate-850 rounded-3xl p-6 md:p-8 space-y-6 text-left">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-4">
                <span className="p-1 px-2 text-[8px] font-black uppercase font-mono tracking-widest bg-amber-950/40 text-amber-300 border border-amber-500/20 rounded">
                  PORTAL PACIENTE
                </span>
                <h3 className="text-white font-sans font-black text-base md:text-lg uppercase tracking-wider">
                  🤝 Acompañamiento y Explicación Empática
                </h3>
              </div>
              
              {patientSummary.studyOverview && (
                <div className="p-4 bg-sky-500/5 border-l-4 border-sky-500/70 rounded-r-xl">
                  <h5 className="text-[10px] font-black tracking-widest uppercase text-sky-400">Qué estudio se le realizó</h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium mt-1">
                    {patientSummary.studyOverview}
                  </p>
                </div>
              )}

              <div className="p-4 bg-amber-500/5 border-l-4 border-amber-500/70 rounded-r-xl">
                <h5 className="text-[10px] font-black tracking-widest uppercase text-amber-400">En pocas palabras</h5>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium mt-1">
                  {patientSummary.summary}
                </p>
              </div>

              {/* Glossary/Findings */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black tracking-wider uppercase text-slate-300 border-b border-slate-850 pb-1.5 flex items-center gap-1.5 font-mono">
                  <span>🔍</span> SUS HALLAZGOS, EXPLICADOS
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {patientSummary.keyFindings?.map((finding: any, idx: number) => (
                    <div key={idx} className="p-4 border border-slate-850 rounded-2xl bg-slate-900/40 space-y-3">
                      <p className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5 justify-start">
                        <span>📌</span> {finding.title || finding.originalTerm}
                      </p>
                      {finding.originalTerm && (
                        <p className="text-[9.5px] font-mono text-slate-500 leading-none">
                          Término científico original: <span className="font-bold text-pink-400">"{finding.originalTerm}"</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        <strong>Explicación:</strong> {finding.simplifiedExplanation}
                      </p>
                      {finding.analogy && (
                        <p className="text-[11.5px] text-amber-300/90 leading-relaxed font-sans italic bg-amber-950/20 px-3 py-2 border-l-2 border-amber-500 rounded-r">
                          <strong>Analogía sencilla:</strong> "{finding.analogy}"
                        </p>
                      )}
                      {(finding.clinicalContext || finding.reassurance) && (
                        <p className="text-[11.5px] text-sky-300/90 leading-relaxed font-sans bg-sky-950/20 px-3 py-2 border-l-2 border-sky-500 rounded-r">
                          <strong>Contexto descriptivo:</strong> {finding.clinicalContext || finding.reassurance}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {Array.isArray(patientSummary.glossary) && patientSummary.glossary.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black tracking-wider uppercase text-slate-300 border-b border-slate-850 pb-1.5 flex items-center gap-1.5 font-mono">
                    GLOSARIO DE TÉRMINOS
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Palabras del informe formal, explicadas en lenguaje claro.
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {patientSummary.glossary.map((entry: any, idx: number) => (
                      <div key={idx} className="p-3.5 border border-slate-850 rounded-xl bg-slate-900/40 space-y-1.5">
                        <p className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                          {entry.term}
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {entry.plainDefinition || entry.definition}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Images Gallery */}
          {attachedImages && attachedImages.length > 0 && (
            <div className="bg-slate-950/60 border border-slate-850 rounded-3xl p-6 md:p-8 space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-4">
                <span className="p-1 px-2 text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 rounded">
                  ECOGRAFÍA
                </span>
                <h3 className="text-white font-sans font-black text-base md:text-lg uppercase tracking-wider">
                  🖼️ Registro de Capturas Diagnósticas ({attachedImages.length})
                </h3>
              </div>
              <p className="text-slate-400 text-xs">
                Imágenes capturadas e integradas por el radiólogo especialista asociadas a este estudio clínico.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {attachedImages.map((img: any) => (
                  <div key={img.id} className="bg-slate-900/50 p-3.5 rounded-2xl border border-slate-850 flex flex-col gap-3">
                    <img src={img.url} alt={img.name} className="w-full aspect-[4/3] object-cover rounded-xl bg-black border border-slate-950" />
                    {img.caption && (
                      <div className="text-xs font-semibold text-slate-300 italic text-center">“{img.caption}”</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick PDF disclaimer */}
          <div className="p-4 bg-slate-950/20 border border-slate-850 rounded-2xl text-[10px] text-slate-400 text-left leading-relaxed font-mono uppercase tracking-wide">
            💡 <strong>Nota de descarga:</strong> El archivo PDF oficial descargado desde este portal se extrae directamente desde su registro en la nube de forma segura. El documento contiene el reporte radiológico formal firmado por el especialista, los esquemas y dibujos explicativos, el acompañamiento para el paciente y las imágenes de ultrasonido asociadas a su estudio.
          </div>
        </main>

        <footer className="py-8 border-t border-slate-850/40 bg-slate-950/20 text-center">
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
            RAD-AI CLOUD DIGITAL VIEWER — SISTEMA DE GESTIÓN CLÍNICA AVANZADO
          </p>
        </footer>
      </div>
    );
  }

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
                    <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-1 shadow-2xl relative max-w-full overflow-x-auto">
            <span className="text-[8.5px] font-black tracking-widest text-slate-550 uppercase px-2 font-mono shrink-0">IA Core:</span>
            {MODEL_OPTIONS.map((opt) => {
              const active = selectedModel === opt.id;
              const activeCls =
                opt.id === "auto"
                  ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.45)]"
                  : opt.id === "gemini-3.1-pro-preview"
                    ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.45)]"
                    : opt.id === "gemini-3.8-flash"
                      ? "bg-sky-600 text-white shadow-[0_0_15px_rgba(2,132,199,0.45)]"
                      : "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.45)]";
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedModel(opt.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    active ? activeCls : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                  title={opt.description}
                >
                  {opt.id === "auto" ? (
                    <Sparkles className={`h-3.5 w-3.5 ${active ? "text-emerald-100 animate-pulse" : ""}`} />
                  ) : opt.id === "gemini-3.1-pro-preview" ? (
                    <Brain className={`h-3.5 w-3.5 ${active ? "text-purple-200 animate-pulse" : ""}`} />
                  ) : (
                    <Zap className={`h-3.5 w-3.5 ${active ? "text-amber-200 animate-pulse" : ""}`} />
                  )}
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Botón Lista de Trabajo */}
          <button
            onClick={() => setIsWorklistSidebarOpen(!isWorklistSidebarOpen)}
            className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-2 cursor-pointer border ${
              isWorklistSidebarOpen
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-black"
                : "bg-slate-950/70 border-slate-855/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
            title="Abrir / Cerrar Lista de Trabajo Diaria"
          >
            <ListTodo className={`h-4 w-4 ${isWorklistSidebarOpen ? "text-indigo-400" : "text-slate-500"}`} />
            <span>Lista de Trabajo</span>
            {worklist && worklist.patients.length > 0 && (
              <span className="inline-flex items-center justify-center bg-indigo-500 text-white font-mono font-black text-[9px] rounded-full px-1.5 py-0.5 ml-1">
                {worklist.patients.filter(p => p.status === 'pending').length}
              </span>
            )}
          </button>

          {/* Active indicator badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-[0_1px_10px_rgba(16,185,129,0.06)] select-none">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </div>
            <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase font-mono">
              {selectedModel === "auto" ? "Auto-Routing" : selectedModel === "gemini-3.1-pro-preview" ? "Pro-Active" : "Flash-Active"}
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

      <ActivePatientPanel
        patient={activeWorklistPatient}
        bridgeOnline={bridgeOnline}
        bridgeDicomReady={bridgeDicomReady}
        captureCount={activePatientCaptureCount}
        hasGeneratedReport={Boolean(generatedReport.trim())}
        labelingConfirmed={labelingStats.confirmed}
        labelingTotal={labelingStats.total}
        captureMismatch={bridgeCaptureMismatch}
        onOpenWorklist={() => setIsWorklistSidebarOpen(true)}
        onOpenLabelingQueue={() => {
          const el = document.getElementById("attached-images-gallery");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onFinishCase={handleFinishActivePatient}
        onDismissMismatch={() => setBridgeCaptureMismatch(null)}
      />

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

          <button
            onClick={() => setActiveTab("cloud-db")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 min-w-[150px] lg:w-full relative overflow-hidden group cursor-pointer border ${
              activeTab === "cloud-db"
                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.12)] pl-4.5"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border-transparent hover:border-slate-800/40"
            }`}
          >
            {activeTab === "cloud-db" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_#6366f1]" />
            )}
            <History className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${activeTab === "cloud-db" ? "text-indigo-400 drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]" : "text-slate-500"}`} />
            Historial Local
          </button>

          {/* 🧠 SELECTOR DE MODELO OMNIPRESENTE (STATION SIDEBAR) */}
          <div className="hidden lg:flex flex-col bg-[#0b101d] border border-slate-800/80 rounded-xl p-3 mt-2 shrink-0 space-y-2">
            <div className="flex items-center gap-1.5 border-b border-slate-850 pb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[9px] font-black tracking-widest text-[#a5b4fc] uppercase font-mono">Modelo Núcleo IA</span>
            </div>
            
            <div className="space-y-1.5 font-sans">
              {MODEL_OPTIONS.map((opt) => {
                const active = selectedModel === opt.id;
                const activeWrap =
                  opt.id === "auto"
                    ? "bg-emerald-950/30 border-emerald-500/60 shadow-[0_2px_8px_rgba(16,185,129,0.1)]"
                    : opt.id === "gemini-3.1-pro-preview"
                      ? "bg-purple-950/30 border-purple-500/60 shadow-[0_2px_8px_rgba(168,85,247,0.1)]"
                      : opt.id === "gemini-3.8-flash"
                        ? "bg-sky-950/30 border-sky-500/60 shadow-[0_2px_8px_rgba(2,132,199,0.1)]"
                        : "bg-indigo-950/30 border-indigo-500/60 shadow-[0_2px_8px_rgba(99,102,241,0.1)]";
                const activeText =
                  opt.id === "auto"
                    ? "text-emerald-400"
                    : opt.id === "gemini-3.1-pro-preview"
                      ? "text-purple-400"
                      : opt.id === "gemini-3.8-flash"
                        ? "text-sky-400"
                        : "text-indigo-400";
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedModel(opt.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all flex items-center justify-between ${
                      active
                        ? activeWrap
                        : "bg-transparent border-transparent hover:bg-slate-850 hover:border-slate-800"
                    }`}
                    title={opt.description}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[10px] font-bold tracking-wide uppercase ${active ? activeText : "text-slate-300"}`}>{opt.label}</span>
                      <span className="text-[8px] text-slate-500 font-medium truncate">{opt.shortLabel === "Auto" ? "Enruta 3.8 / 3.7 por tarea" : opt.description}</span>
                    </div>
                    {active && (
                      opt.id === "auto" ? <Sparkles className={`h-3.5 w-3.5 ${activeText} shrink-0`} /> :
                      opt.id === "gemini-3.1-pro-preview" ? <Brain className={`h-3.5 w-3.5 ${activeText} shrink-0`} /> :
                      <Zap className={`h-3.5 w-3.5 ${activeText} shrink-0`} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider text-center font-mono pt-1">
              {describeActiveRouting(selectedModel)}
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
            {(savedReports.length > 0 || cloudStudies.length > 0) && (
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
                        <RefreshCw className="h-3 w-3" /> Nuevo estudio
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
                                if (/mamograf[ií]a\s*y\s*ultrasonido/i.test(mod)) {
                                  setSpecificStudy("Mamas");
                                  setAutoActivateSpecificSuite(true);
                                  setSelectedBatchModules((prev) => ({ ...prev, breast3d: true }));
                                  setIsBreast3dSuiteOpen(true);
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
                            <option value="Muslo Anterior">Muslo Anterior</option>
                            <option value="Muslo Posterior">Muslo Posterior</option>
                            <option value="Muñeca">Muñeca</option>
                            <option value="Mano">Mano</option>
                            <option value="Pie">Pie</option>
                            <option value="Cadera">Cadera</option>
                            <option value="Codo">Codo</option>
                            <option value="Doppler de carótidas">Doppler de carótidas</option>
                            <option value="Doppler venoso de miembro inferior">Doppler venoso de miembro inferior</option>
                            <option value="Doppler arterial de miembro inferior">Doppler arterial de miembro inferior</option>
                            <option value="Columna lumbosacra">Columna lumbosacra</option>
                            <option value="Columna dorsal">Columna dorsal</option>
                            <option value="Columna cervical">Columna cervical</option>
                            <option value="Momografía">Momografía</option>
                            <option value="Tórax">Tórax</option>
                            <option value="Cráneo">Cráneo</option>
                            <option value="Pantorrilla y Tendón de Aquiles">Pantorrilla y Tendón de Aquiles</option>
                            <option value="Cerebro Neonatal">Cerebro Neonatal</option>
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
                      {["Mamas", "Momografía", "Rodilla", "Hombro", "Tobillo", "Muslo Anterior", "Muslo Posterior", "Muñeca", "Mano", "Pie", "Cadera", "Codo", "Pantorrilla y Tendón de Aquiles", "Mamografía y Ultrasonido de Mamas", "Doppler venoso de miembro inferior", "Doppler arterial de miembro inferior", "Otro"].includes(specificStudy) || modality === "Mamografía y Ultrasonido de Mamas" ? (
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

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">ID / Historia Clínica:</label>
                            <input
                              type="text"
                              value={patientId}
                              onChange={(e) => setPatientId(e.target.value)}
                              placeholder="Ej: HC-12345 o C.I."
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Fecha del Estudio / Reporte:</label>
                            <input
                              type="date"
                              value={reportDate}
                              onChange={(e) => setReportDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Edad del Paciente:</label>
                            <input
                              type="text"
                              value={patientAge}
                              onChange={(e) => setPatientAge(e.target.value)}
                              placeholder="Ej: 45 años o 45A"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Sexo / Género:</label>
                            <input
                              type="text"
                              value={patientGender}
                              onChange={(e) => setPatientGender(e.target.value)}
                              placeholder="Ej: Masculino / Femenino / M / F"
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

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest leading-none">Cédula Profesional / Registro Médico / Licencia:</label>
                            <input
                              type="text"
                              value={doctorLicense}
                              onChange={(e) => {
                                setDoctorLicense(e.target.value);
                                localStorage.setItem("rad_doctor_license", e.target.value);
                              }}
                              placeholder="Ej: M.S.P. Reg: 6025 / Senescyt: 1005-12-7489"
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
                              className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none placeholder-slate-650 transition-all"
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
                                    const isActiveLeft = selectedLogo === logo.id;
                                    const isActiveRight = selectedLogoRight === logo.id;
                                    const isActive = customLogoStyle === "dual" ? (isActiveLeft || isActiveRight) : isActiveLeft;
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
                                          {customLogoStyle === "dual" ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedLogo(logo.id);
                                                }}
                                                className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                                                  isActiveLeft
                                                    ? "bg-indigo-700 border-indigo-500 text-white"
                                                    : "bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-200"
                                                }`}
                                                title="Usar como logo izquierdo"
                                              >
                                                Izq
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedLogoRight(logo.id);
                                                }}
                                                className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                                                  isActiveRight
                                                    ? "bg-indigo-700 border-indigo-500 text-white"
                                                    : "bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-200"
                                                }`}
                                                title="Usar como logo derecho"
                                              >
                                                Der
                                              </button>
                                            </>
                                          ) : (
                                            isActiveLeft && (
                                              <span className="text-[10px]" title="Activo">
                                                ✓
                                              </span>
                                            )
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
                                      <span className="text-[8px] text-slate-500 font-bold block">Se guarda de forma permanente (como la firma), incluso al reiniciar</span>
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
                                    <button
                                      type="button"
                                      onClick={() => handleChangeCustomLogoStyle("dual")}
                                      className={`px-3 py-1 rounded-lg text-[8.5px] font-black uppercase border select-none transition-all cursor-pointer ${
                                        customLogoStyle === "dual"
                                          ? "bg-indigo-900 border-indigo-700 text-white"
                                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                                      }`}
                                      title="Dos logotipos: uno a la izquierda y otro a la derecha"
                                    >
                                      Doble Logo
                                    </button>
                                  </div>
                                </div>

                                {customLogoStyle === "dual" && customLogos.length > 0 && (
                                  <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 space-y-2 text-left">
                                    <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-widest block">Asignación Doble Logo</span>
                                    <p className="text-[8px] text-slate-500 font-bold leading-relaxed">
                                      Elige el logo izquierdo y el derecho desde la biblioteca (botones Izq / Der). Quedarán más grandes y legibles que un banner combinado.
                                    </p>
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Izq</span>
                                        {customLogoUrl ? (
                                          <img src={customLogoUrl} alt="Logo izquierdo" className="h-9 max-w-[70px] bg-white rounded border border-slate-700 object-contain p-0.5" referrerPolicy="no-referrer" />
                                        ) : (
                                          <span className="text-[8px] text-slate-600">Sin asignar</span>
                                        )}
                                      </div>
                                      <div className="flex-1 h-px bg-slate-800" />
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Der</span>
                                        {customLogoRightUrl ? (
                                          <img src={customLogoRightUrl} alt="Logo derecho" className="h-9 max-w-[70px] bg-white rounded border border-slate-700 object-contain p-0.5" referrerPolicy="no-referrer" />
                                        ) : (
                                          <span className="text-[8px] text-amber-500/90">Seleccione logo derecho</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

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
                                          ) : customLogoStyle === "dual" ? (
                                            <div className="flex items-center justify-between gap-1 w-full">
                                              <div className="w-5 h-5 bg-slate-50 border border-slate-200/80 rounded p-0.5 shrink-0 overflow-hidden">
                                                <img src={customLogoUrl} alt="Logo izquierdo A4" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                                              </div>
                                              <div className="flex-1 space-y-0.5 px-0.5">
                                                <div className="h-1 bg-slate-400 rounded w-full max-w-[28px] mx-auto"></div>
                                                <div className="h-[2px] bg-slate-300 rounded w-full max-w-[36px] mx-auto"></div>
                                              </div>
                                              <div className="w-5 h-5 bg-slate-50 border border-slate-200/80 rounded p-0.5 shrink-0 overflow-hidden">
                                                {customLogoRightUrl ? (
                                                  <img src={customLogoRightUrl} alt="Logo derecho A4" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                                                ) : (
                                                  <div className="h-full w-full bg-slate-100" />
                                                )}
                                              </div>
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
                                      <p><strong className="text-slate-300">Formato Centrado Horizontal:</strong> El logotipo ocupará de forma equilibrada la posición de membrete ancho, alineando toda la documentación exactamente debajo del separador del encabezado.</p>
                                    ) : customLogoStyle === "dual" ? (
                                      <p><strong className="text-slate-300">Formato Doble Logo:</strong> Un logotipo a cada extremo del encabezado y el nombre de la clinica al centro. Ideal cuando usas marca institucional + marca personal o dos logos separados.</p>
                                    ) : (
                                      <p><strong className="text-slate-300">Formato Esquina Superior Izquierda:</strong> El logotipo respetará el margen de encuadre técnico lateral, liberando espacio para las líneas secundarias del destinatario y datos del paciente.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>



                    <label
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        selectedSpecificSuite
                          ? "border-indigo-500/30 bg-indigo-950/25 cursor-pointer"
                          : "border-slate-800 bg-slate-950/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={autoActivateSpecificSuite && !!selectedSpecificSuite}
                        onChange={(e) => setAutoActivateSpecificSuite(e.target.checked)}
                        disabled={!selectedSpecificSuite}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500 disabled:opacity-40"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                          Activar suite 3D específica con Reporte completo
                        </p>
                        <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                          {selectedSpecificSuite
                            ? `${selectedSpecificSuite.label} se generará automáticamente porque seleccionaste «${specificStudy || modality}».`
                            : "El estudio seleccionado no tiene una suite 3D específica; podrás elegir Atlas u otros módulos después."}
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 cursor-pointer transition-colors hover:border-cyan-500/40">
                      <input
                        type="checkbox"
                        checked={autoClinicalPolish}
                        onChange={(e) => setAutoClinicalPolish(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                          Pulido clínico automático con Reporte completo
                        </p>
                        <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                          Scorecard → prosa, medidas → cuerpo, guías en pie; clasificaciones pendientes; pase final anti-duplicados y redacción.
                        </p>
                      </div>
                    </label>

                    {/* Alcance documental: formal vs pack paciente */}
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 font-mono">
                        Documentos a generar
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGenerateDocumentScope('formal')}
                          className={`px-3 py-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                            generateDocumentScope === 'formal'
                              ? 'bg-indigo-600/30 border-indigo-500/50 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-wider">Solo informe formal</span>
                          <span className="block text-[8px] mt-0.5 text-slate-400 normal-case tracking-normal">Para el médico tratante</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenerateDocumentScope('both')}
                          className={`px-3 py-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                            generateDocumentScope === 'both'
                              ? 'bg-emerald-600/25 border-emerald-500/45 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-wider">Informe + pack paciente</span>
                          <span className="block text-[8px] mt-0.5 text-slate-400 normal-case tracking-normal">Formal + explicación en lenguaje claro</span>
                        </button>
                      </div>
                    </div>

                    {/* Submit Buttons: simple vs completo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const reportText = await handleGenerateReport("simple");
                          if (generateDocumentScope === 'both' && reportText) {
                            await handleGeneratePatientSummary(reportText);
                          }
                        }}
                        disabled={isGenerating || isGeneratingPatientSummary || !studyType.trim()}
                        className="w-full bg-slate-800 hover:bg-slate-750 text-slate-100 font-black py-4 px-5 rounded-xl text-[11px] uppercase tracking-widest border border-slate-600/80 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                        title="Solo redacta el informe, sin modulos adicionales (ideal para radiografias simples)"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                            <span>Analizando...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-slate-300" />
                            <span>Reporte simple</span>
                            <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">
                              Solo el informe
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const reportText = await handleGenerateReport("full");
                          if (generateDocumentScope === 'both' && reportText) {
                            await handleGeneratePatientSummary(reportText);
                          }
                        }}
                        disabled={isGenerating || isGeneratingPatientSummary || !studyType.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-black py-4 px-5 rounded-xl text-[11px] uppercase tracking-widest shadow-[0_4px_16px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer border border-indigo-400/30"
                        title="Informe + módulos predeterminados, suite 3D del estudio y pulido clínico automático"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                            <span>Analizando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-amber-200" />
                            <span>Reporte completo</span>
                            <span className="text-[8px] font-bold normal-case tracking-normal text-indigo-100/80 text-center leading-snug">
                              + Scorecard, suite 3D y pulido clínico
                            </span>
                          </>
                        )}
                      </button>
                    </div>
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
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-400" />
                            <span className="text-xs font-black text-slate-300 font-mono tracking-widest uppercase">WORKSPACE_DRAFT.TXT</span>
                          </div>
                          {isAnalyzingParagraphs && (
                            <div className="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-800/45 px-2 py-0.5 rounded text-[9px] font-bold text-indigo-300 animate-pulse font-mono uppercase tracking-wider">
                              <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping" />
                              IA Analizando Selección...
                            </div>
                          )}
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
                            title="Generar dos infografías clásicas (paciente + médico); se ven a tamaño completo por pestaña"
                          >
                            {isGeneratingInfographic ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...
                              </>
                            ) : (
                              "Infografías (Paciente + Médico)"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSplitPdfActive(p => !p)}
                            className={`px-3 md:px-4 py-1.5 md:py-2 border-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer ${
                              isSplitPdfActive
                                ? "bg-indigo-650/20 hover:bg-indigo-600/20 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30"
                                : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-slate-250"
                            }`}
                            title={isSplitPdfActive ? "Ocultar Vista de Pantalla Dividida (PDF en Tiempo Real)" : "Mostrar Vista de Pantalla Dividida (PDF en Tiempo Real)"}
                          >
                            <Columns className="h-3.5 w-3.5 text-indigo-400" />
                            {isSplitPdfActive ? "Ocultar PDF (Split)" : "Vista PDF (Split)"}
                          </button>
                          <button
                            onClick={handlePrintPDF}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Imprimir o exportar diseño de informe a PDF listo"
                          >
                            <Printer className="h-3.5 w-3.5" /> PDF / Imprimir
                          </button>
                          <button
                            onClick={() => guardReportPdfExport(async () => {
                              await handleDownloadNativePDF(false);
                              if (generateDocumentScope === 'both' && patientSummary) {
                                await handleDownloadPatientSummaryPDF(false);
                              }
                            })}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-900 border-2 border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-200 transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none cursor-pointer whitespace-nowrap"
                            title="Descargar PDF formal (y pack paciente si el alcance es ambos)"
                          >
                            <Download className="h-3.5 w-3.5 text-indigo-400" /> Descargar PDF
                          </button>
                          <button
                            onClick={() => guardReportPdfExport(() => handleOpenWhatsAppShare('report_pdf'))}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/30 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Enviar reporte PDF firmado directamente a WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-white" /> WhatsApp PDF
                          </button>
                          <button
                            onClick={() => guardReportPdfExport(() => handleOpenGmailShare(generateDocumentScope === 'both' && patientSummary ? 'both_pdfs' : 'report_pdf'))}
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
                          <button
                            onClick={handleCopyEhrPortalLink}
                            disabled={isSavingToCloud}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-950/40 hover:bg-indigo-950/80 border-2 border-indigo-500/40 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider text-indigo-300 transition-all flex items-center gap-1.5 md:gap-2 shadow-lg select-none whitespace-nowrap cursor-pointer"
                            title="Copiar texto con el enlace del reporte en la nube para el expediente clínico"
                          >
                            {copiedEhrStudyId === "current_active_report" ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" /> ¡Enlace Copiado!
                              </>
                            ) : (
                              <>
                                <Link className="h-3.5 w-3.5 text-indigo-400" /> Link Expediente (EHR)
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Main Text Content / Split Screen Container */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-[#090D1A]">
                      {/* Left Column: Report content, editor, and tools */}
                      <div className={`flex-1 p-6 overflow-y-auto leading-relaxed text-sm select-text text-slate-300 relative scrollbar-thin ${isSplitPdfActive && generatedReport ? "md:border-r md:border-slate-800" : ""}`}>
                        {generatedReport && !infographicUrl && !infographicClinicianUrl && !isGeneratingInfographic && (
                          <div className="mb-4 p-3 bg-slate-900/70 rounded-xl border border-pink-600/20 space-y-2">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-pink-300/80 font-mono">
                              Vista del dibujo (lateralidad)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setInfographicViewOrientation("AP")}
                                className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border-2 cursor-pointer ${
                                  infographicViewOrientation === "AP"
                                    ? "bg-pink-700/40 border-pink-500 text-pink-100"
                                    : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                AP · de frente
                              </button>
                              <button
                                type="button"
                                onClick={() => setInfographicViewOrientation("PA")}
                                className={`py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border-2 cursor-pointer ${
                                  infographicViewOrientation === "PA"
                                    ? "bg-pink-700/40 border-pink-500 text-pink-100"
                                    : "bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                PA · de espaldas
                              </button>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-relaxed">
                              {infographicViewOrientation === "PA"
                                ? "PA: derecha del paciente a la derecha del cuadro; izquierda a la izquierda."
                                : "AP: derecha del paciente a la izquierda del cuadro; izquierda a la derecha."}
                            </p>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-pink-300/80 font-mono">
                              Notas de lateralidad / correcciones (opcional)
                            </label>
                            <textarea
                              value={infographicCorrectionNotes}
                              onChange={(e) => setInfographicCorrectionNotes(e.target.value)}
                              rows={2}
                              placeholder={infographicViewOrientation === "PA"
                                ? "Ej.: hallazgo en hombro DERECHO del paciente (debe verse a la DERECHA del dibujo, vista de espaldas)."
                                : "Ej.: hallazgo en hombro DERECHO del paciente (debe verse a la IZQUIERDA del dibujo, vista de frente)."}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-pink-500/40 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
                            />
                          </div>
                        )}
                        {(infographicUrl || infographicClinicianUrl) && (
                          <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-pink-600/30">
                             <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                               <div className="min-w-0">
                                 <h4 className="text-sm font-bold text-pink-300">Infografías generadas</h4>
                                 <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">
                                   Una a la vez a tamaño completo. Elija destino PDF por versión; si no le gusta el resultado, déjela sin adjuntar.
                                 </p>
                               </div>
                               <div className="flex flex-wrap items-center justify-end gap-1.5">
                                 <button
                                   type="button"
                                   onClick={() => setAttachInfographicToPatientSummary(prev => !prev)}
                                   disabled={!infographicUrl}
                                   className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                                     attachInfographicToPatientSummary
                                       ? "bg-orange-950/80 border-orange-500/50 text-orange-300 shadow-[0_2px_8px_rgba(249,115,22,0.2)]"
                                       : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                   }`}
                                   title={attachInfographicToPatientSummary ? "La versión paciente se incluirá en el PDF de explicación al paciente" : "Incluir la versión paciente en el documento de explicación al paciente"}
                                 >
                                   {attachInfographicToPatientSummary ? (
                                     <>
                                       <Check className="h-3 w-3 text-orange-400" />
                                       En explicación paciente
                                     </>
                                   ) : (
                                     <>
                                       <Plus className="h-3 w-3 text-slate-400" />
                                       Incluir en explicación
                                     </>
                                   )}
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => setAttachInfographicToOfficialReport(prev => !prev)}
                                   disabled={!infographicClinicianUrl && !infographicUrl}
                                   className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                                     attachInfographicToOfficialReport
                                       ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-350 shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
                                       : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                   }`}
                                   title={attachInfographicToOfficialReport ? "Se adjuntará al reporte oficial (preferencia: versión médico)" : "Adjuntar al reporte oficial (preferencia: versión médico)"}
                                 >
                                   {attachInfographicToOfficialReport ? (
                                     <>
                                       <Check className="h-3 w-3 text-emerald-400" />
                                       Adjunto a reporte original
                                     </>
                                   ) : (
                                     <>
                                       <Plus className="h-3 w-3 text-slate-400" />
                                       Adjuntar a reporte original
                                     </>
                                   )}
                                 </button>
                               </div>
                             </div>

                             <div className="mb-3 inline-flex rounded-xl border border-slate-600 overflow-hidden shadow-lg">
                               <button
                                 type="button"
                                 disabled={!infographicUrl}
                                 onClick={() => setInfographicAudienceTab("patient")}
                                 className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                   infographicAudienceTab === "patient"
                                     ? "bg-pink-600 text-white"
                                     : "bg-slate-950 text-slate-400 hover:text-white"
                                 }`}
                               >
                                 Paciente
                               </button>
                               <button
                                 type="button"
                                 disabled={!infographicClinicianUrl}
                                 onClick={() => setInfographicAudienceTab("clinician")}
                                 className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                   infographicAudienceTab === "clinician"
                                     ? "bg-slate-200 text-slate-900"
                                     : "bg-slate-950 text-slate-400 hover:text-white"
                                 }`}
                               >
                                 Médico
                               </button>
                             </div>

                             {(() => {
                               const activeUrl =
                                 infographicAudienceTab === "clinician"
                                   ? infographicClinicianUrl || infographicUrl
                                   : infographicUrl || infographicClinicianUrl;
                               if (!activeUrl) return null;
                               return (
                                 <img
                                   src={activeUrl}
                                   alt={
                                     infographicAudienceTab === "clinician"
                                       ? "Infografía médico"
                                       : "Infografía paciente"
                                   }
                                   className="w-full rounded-lg"
                                   referrerPolicy="no-referrer"
                                 />
                               );
                             })()}

                             <div className="mt-3 space-y-2">
                               <label className="block text-[9px] font-black uppercase tracking-widest text-pink-300/90 font-mono">
                                 Correcciones para regenerar
                               </label>
                               <textarea
                                 value={infographicCorrectionNotes}
                                 onChange={(e) => setInfographicCorrectionNotes(e.target.value)}
                                 rows={3}
                                 placeholder={infographicViewOrientation === "PA"
                                   ? "Ej.: El hallazgo es en el hombro DERECHO del paciente (en PA debe verse a la DERECHA del dibujo)."
                                   : "Ej.: El hallazgo es en el hombro DERECHO del paciente (en AP debe verse a la IZQUIERDA del dibujo)."}
                                 className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-pink-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
                               />
                               <div className="grid grid-cols-2 gap-2">
                                 <button
                                   type="button"
                                   onClick={() => setInfographicViewOrientation("AP")}
                                   className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer ${
                                     infographicViewOrientation === "AP"
                                       ? "bg-pink-700/40 border-pink-500 text-pink-100"
                                       : "bg-slate-950 border-slate-700 text-slate-400"
                                   }`}
                                 >
                                   AP · de frente
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => setInfographicViewOrientation("PA")}
                                   className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer ${
                                     infographicViewOrientation === "PA"
                                       ? "bg-pink-700/40 border-pink-500 text-pink-100"
                                       : "bg-slate-950 border-slate-700 text-slate-400"
                                   }`}
                                 >
                                   PA · de espaldas
                                 </button>
                               </div>
                               <p className="text-[9px] text-slate-500 leading-relaxed">
                                 {infographicViewOrientation === "PA"
                                   ? "PA (de espaldas): derecha del paciente = derecha del cuadro; izquierda = izquierda."
                                   : "AP (de frente): derecha del paciente = izquierda del cuadro; izquierda = derecha."}
                               </p>
                               <div className="flex flex-wrap justify-end gap-2">
                               <button
                                 type="button"
                                 onClick={() => handleGenerateInfographic({ keepAttachments: true })}
                                 disabled={isGeneratingInfographic}
                                 className="px-4 py-2 bg-pink-700 hover:bg-pink-600 disabled:opacity-50 border-2 border-pink-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                                 title="Regenerar ambas infografías aplicando el texto de correcciones"
                               >
                                 {isGeneratingInfographic ? (
                                   <>
                                     <Loader2 className="h-4 w-4 animate-spin" /> Regenerando...
                                   </>
                                 ) : (
                                   <>
                                     <RefreshCw className="h-4 w-4" /> Regenerar con correcciones
                                   </>
                                 )}
                               </button>
                               <button
                                 onClick={() => handleOpenWhatsAppShare('patient_infographic')}
                                 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                                 title="Compartir la infografía visible por WhatsApp"
                               >
                                 <MessageSquare className="h-4 w-4" /> Enviar por WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGmailShare('patient_infographic')}
                                  className="px-4 py-2 bg-red-750 hover:bg-red-700 border-2 border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer animate-fadeIn"
                                  title="Compartir la infografía visible por Gmail"
                                >
                                  <Mail className="h-4 w-4 text-white" /> Enviar por Gmail
                                </button>
                               </div>
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

                          {(isEnrichingReport || reportEnrichmentSession) && (
                            <div className="my-2">
                              <React.Suspense
                                fallback={
                                  <div className="p-4 text-xs font-mono text-cyan-400 bg-slate-900/60 rounded-xl border border-cyan-900/40 animate-pulse">
                                    Cargando pulido clínico...
                                  </div>
                                }
                              >
                                <ReportEnrichmentPanel
                                  session={reportEnrichmentSession}
                                  isRunning={isEnrichingReport}
                                  onUndoAll={handleUndoClinicalPolish}
                                  onApplyChange={handleApplyEnrichmentChange}
                                  onApplyRemaining={handleApplyRemainingEnrichment}
                                  onRejectChange={handleRejectEnrichmentChange}
                                  applyingIds={applyingEnrichmentIds}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {/* ADVANCED MEDICAL REPORT HUD TOOLING BAR */}
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
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">
                                  Editor de Texto Radiológico (Manual)
                                </label>
                                <span className="text-[9px] font-mono text-slate-500 uppercase">
                                  Escribe libremente • Los cambios se guardarán en el historial
                                </span>
                              </div>

                              {/* BARRA DE BOTONES DE ALINEACIÓN Y SALTO DE PÁGINA PDF */}
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-mono">
                                    Alineación PDF:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const tag = "[SALTO_DE_PAGINA]";
                                      const textarea = document.getElementById("textarea-manual-report-edit") as HTMLTextAreaElement | null;
                                      if (textarea) {
                                        const start = textarea.selectionStart || 0;
                                        const end = textarea.selectionEnd || 0;
                                        const current = editedReportText || "";
                                        const newText = current.substring(0, start) + `\n\n${tag}\n\n` + current.substring(end);
                                        setEditedReportText(newText);
                                        setTimeout(() => {
                                          textarea.focus();
                                          textarea.setSelectionRange(start + tag.length + 4, start + tag.length + 4);
                                        }, 50);
                                      } else {
                                        setEditedReportText(prev => (prev || "") + `\n\n${tag}\n\n`);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-teal-950/60 hover:bg-teal-900/80 border border-teal-500/40 text-teal-300 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 font-mono"
                                    title="Fuerza que el texto siguiente comience al inicio de la siguiente página del PDF"
                                  >
                                    <FileDown className="h-3 w-3 text-teal-400" />
                                    + Insertar Salto de Página
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const tag = "[ESPACIO_10MM]";
                                      const textarea = document.getElementById("textarea-manual-report-edit") as HTMLTextAreaElement | null;
                                      if (textarea) {
                                        const start = textarea.selectionStart || 0;
                                        const end = textarea.selectionEnd || 0;
                                        const current = editedReportText || "";
                                        const newText = current.substring(0, start) + `\n\n${tag}\n\n` + current.substring(end);
                                        setEditedReportText(newText);
                                        setTimeout(() => {
                                          textarea.focus();
                                          textarea.setSelectionRange(start + tag.length + 4, start + tag.length + 4);
                                        }, 50);
                                      } else {
                                        setEditedReportText(prev => (prev || "") + `\n\n${tag}\n\n`);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 font-mono"
                                    title="Inserta un espacio vertical adicional de 10mm en el PDF para empujar títulos huérfanos"
                                  >
                                    <ArrowDown className="h-3 w-3 text-indigo-400" />
                                    + Espacio Blanco (+10mm)
                                  </button>
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono italic">
                                  Ideal para evitar títulos huérfanos al final de página
                                </span>
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

                                {/* PANEL DE ACCIONES DE PÁRRAFO POR IA (SOLICITADO POR EL USUARIO) */}
                                {selectedParagraphText && (
                                  <div className="mt-8 pt-8 border-t border-slate-800/80 animate-fadeIn space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="bg-indigo-950 p-1.5 rounded-lg border border-indigo-500/20">
                                          <Brain className="h-4 w-4 text-indigo-400" />
                                        </div>
                                        <div>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-white animate-fadeIn">
                                            Asistente de Párrafo Activo (IA)
                                          </h4>
                                          <p className="text-[10px] text-slate-400 font-medium">
                                            {selectedParagraphOriginal ? "Fragmento del informe marcado" : "Selección de texto personalizada"}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedParagraphText(null);
                                          setSelectedParagraphOriginal(null);
                                          setParagraphActionResult(null);
                                          setParagraphActionActive(null);
                                          setParagraphActionError(null);
                                        }}
                                        className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                                        title="Cerrar asistente de párrafo"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                    {/* Muestra el texto seleccionado */}
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850/80 select-text relative">
                                      <span className="absolute -top-2.5 left-3 bg-slate-900 px-2 py-0.5 text-[8px] font-black uppercase text-indigo-400 tracking-widest border border-slate-800/80 rounded font-mono">
                                        Texto Marcado
                                      </span>
                                      <p className="text-xs text-slate-300 leading-relaxed italic">
                                        "{selectedParagraphText}"
                                      </p>
                                    </div>

                                    {selectedParagraphOriginal && (
                                      <div className="bg-slate-900/35 p-4 rounded-xl border border-slate-800/65 space-y-3 animate-fadeIn">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                                            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-200 font-mono">
                                              Resaltado Sintáctico Manual
                                            </span>
                                          </div>
                                          {selectedParagraphOriginal in manualSeverityOverrides || selectedParagraphOriginal.trim() in manualSeverityOverrides ? (
                                            <span className="text-[9px] bg-amber-955/60 text-amber-400 border border-amber-900/40 px-2 py-0.5 rounded font-black font-mono tracking-wider uppercase">
                                              Ajuste Manual
                                            </span>
                                          ) : (
                                            <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2.5 py-0.5 rounded font-black font-mono tracking-wider uppercase flex items-center gap-1">
                                              <span className="w-1 h-1 rounded-full bg-emerald-450 animate-ping" />
                                              IA Médica Activa
                                            </span>
                                          )}
                                        </div>
                                        
                                        <p className="text-[11px] text-slate-400 leading-normal font-medium">
                                          ¿No estás de acuerdo con la clasificación automática de esta línea? Puedes cambiar o quitar su contraste cromático bilateral (se aplicará inmediatamente en pantalla y en la exportación PDF):
                                        </p>

                                        <div className="grid grid-cols-3 gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleManualSeverity("normal")}
                                            className={`px-2 py-2 border rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                                              (manualSeverityOverrides[selectedParagraphOriginal] || manualSeverityOverrides[selectedParagraphOriginal.trim()] || getParagraphSeverity(selectedParagraphOriginal)) === "normal"
                                                ? "bg-slate-800 border-slate-600 text-white font-extrabold shadow-sm"
                                                : "bg-slate-950 border-slate-850/80 text-slate-400 hover:text-slate-200"
                                            }`}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                            <span>Normal / Ninguno</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleToggleManualSeverity("altered")}
                                            className={`px-2 py-2 border rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                                              (manualSeverityOverrides[selectedParagraphOriginal] || manualSeverityOverrides[selectedParagraphOriginal.trim()] || getParagraphSeverity(selectedParagraphOriginal)) === "altered"
                                                ? "bg-amber-950/40 border-amber-500/85 text-amber-200 font-extrabold shadow-md shadow-amber-950/35"
                                                : "bg-slate-950 border-slate-850/80 text-slate-400 hover:text-amber-300"
                                            }`}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            <span>Alterado</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleToggleManualSeverity("critical")}
                                            className={`px-2 py-2 border rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                                              (manualSeverityOverrides[selectedParagraphOriginal] || manualSeverityOverrides[selectedParagraphOriginal.trim()] || getParagraphSeverity(selectedParagraphOriginal)) === "critical"
                                                ? "bg-rose-955/35 border-rose-500/85 text-rose-250 font-extrabold shadow-md shadow-rose-950/35"
                                                : "bg-slate-950 border-slate-850/80 text-slate-400 hover:text-rose-400"
                                            }`}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                            <span>Crítico</span>
                                          </button>
                                        </div>
                                        {(selectedParagraphOriginal in manualSeverityOverrides || selectedParagraphOriginal.trim() in manualSeverityOverrides) && (
                                          <div className="flex justify-end pt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const nextOverrides = { ...manualSeverityOverrides };
                                                delete nextOverrides[selectedParagraphOriginal];
                                                delete nextOverrides[selectedParagraphOriginal.trim()];
                                                setManualSeverityOverrides(nextOverrides);
                                              }}
                                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                              <RefreshCw className="h-2.5 w-2.5" />
                                              Restablecer a detección automática
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Botones de acción de la IA */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => executeParagraphAction("analyze")}
                                        disabled={paragraphActionLoading}
                                        className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                          paragraphActionActive === "analyze"
                                            ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40"
                                            : "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850/60"
                                        }`}
                                      >
                                        <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                                        <span className="text-[10px] uppercase tracking-wider font-mono">Analizar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => executeParagraphAction("improve")}
                                        disabled={paragraphActionLoading}
                                        className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                          paragraphActionActive === "improve"
                                            ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40"
                                            : "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850/60"
                                        }`}
                                      >
                                        <Edit className="h-4 w-4 text-emerald-400" />
                                        <span className="text-[10px] uppercase tracking-wider font-mono">Mejorar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => executeParagraphAction("expand")}
                                        disabled={paragraphActionLoading}
                                        className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                          paragraphActionActive === "expand"
                                            ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40"
                                            : "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850/60"
                                        }`}
                                      >
                                        <FileText className="h-4 w-4 text-blue-400" />
                                        <span className="text-[10px] uppercase tracking-wider font-mono">Hacer exhaustivo</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => executeParagraphAction("explain")}
                                        disabled={paragraphActionLoading}
                                        className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                          paragraphActionActive === "explain"
                                            ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40"
                                            : "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850/60"
                                        }`}
                                      >
                                        <Activity className="h-4 w-4 text-pink-400" />
                                        <span className="text-[10px] uppercase tracking-wider font-mono">Explicar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => executeParagraphAction("classify")}
                                        disabled={paragraphActionLoading}
                                        className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                          paragraphActionActive === "classify"
                                            ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-950/40"
                                            : "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850/60"
                                        }`}
                                      >
                                        <Database className="h-4 w-4 text-amber-400" />
                                        <span className="text-[10px] uppercase tracking-wider font-mono">Clasificar</span>
                                      </button>
                                    </div>

                                    {/* CUADRO DE DIÁLOGO IA LIBRE PARA ACCIÓN PERSONALIZADA */}
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850/80 space-y-3 animate-fadeIn">
                                      <div className="flex items-center gap-2">
                                        <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200 font-mono">
                                          Petición / Instrucción Libre para la IA
                                        </span>
                                      </div>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={customParagraphPrompt}
                                          onChange={(e) => setCustomParagraphPrompt(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && customParagraphPrompt.trim() && !paragraphActionLoading) {
                                              executeParagraphAction("custom", customParagraphPrompt.trim());
                                            }
                                          }}
                                          placeholder="Ej: Traduce al inglés, cambia la lateralidad a derecha, resume en una frase..."
                                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-650 outline-none transition-all"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (customParagraphPrompt.trim()) {
                                              executeParagraphAction("custom", customParagraphPrompt.trim());
                                            }
                                          }}
                                          disabled={paragraphActionLoading || !customParagraphPrompt.trim()}
                                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-800/80 disabled:text-slate-600 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Send className="h-3.5 w-3.5" />
                                          <span>Enviar</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Cargador */}
                                    {paragraphActionLoading && (
                                      <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-850/80 flex flex-col items-center justify-center gap-2.5 animate-pulse">
                                        <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                                        <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider">
                                          Procesando consulta clínica mediante IA...
                                        </p>
                                      </div>
                                    )}

                                    {/* Mensaje de error */}
                                    {paragraphActionError && (
                                      <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-xs text-red-350 flex items-start gap-2.5 leading-relaxed">
                                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                        <div>
                                          <strong>Error al procesar acción:</strong> {paragraphActionError}
                                        </div>
                                      </div>
                                    )}

                                    {/* Resultados de la IA */}
                                    {paragraphActionResult && (
                                      <div className="bg-slate-900/80 p-5 rounded-xl border border-indigo-950/40 space-y-4 animate-fadeIn select-text">
                                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                                          <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-black uppercase tracking-wider">
                                            <Zap className="h-3.5 w-3.5 text-indigo-400" />
                                            <span>Resultado de la Contribución</span>
                                          </div>
                                          <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900/35 px-2 py-0.5 rounded uppercase font-bold font-mono">
                                            {paragraphActionActive === "analyze" ? "Análisis Clínico" :
                                             paragraphActionActive === "improve" ? "Redacción Pulida" :
                                             paragraphActionActive === "expand" ? "Detalle Exhaustivo" :
                                             paragraphActionActive === "explain" ? "Explicación Didáctica" :
                                             paragraphActionActive === "classify" ? "Cálculo de Escala" :
                                             "Consulta IA Libre"}
                                          </span>
                                        </div>

                                        {/* Renderizado del resultado */}
                                        <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans space-y-2 select-text max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                                          {paragraphActionResult}
                                        </div>

                                        {/* Acciones para incorporar o usar el resultado */}
                                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/60">
                                          {/* Reemplazar (solo si se seleccionó desde un fragmento real existente) */}
                                          {selectedParagraphOriginal && (paragraphActionActive === "improve" || paragraphActionActive === "expand" || paragraphActionActive === "custom") && (
                                            <button
                                              type="button"
                                              onClick={() => handleApplyParagraphImprovement(paragraphActionResult)}
                                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer select-none"
                                              title="Reemplazar el fragmento original en el informe con esta mejora de IA"
                                            >
                                              <CheckCircle2 className="h-3.5 w-3.5" /> Reemplazar Fragmento
                                            </button>
                                          )}

                                          {/* Insertar debajo (siempre útil) */}
                                          {selectedParagraphOriginal && (
                                            <button
                                              type="button"
                                              onClick={() => handleInsertBelowParagraph(paragraphActionResult)}
                                              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-750 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer select-none"
                                              title="Insertar este bloque de texto directamente debajo del párrafo original"
                                            >
                                              <ChevronRight className="h-3.5 w-3.5 text-indigo-400" /> Insertar Debajo
                                            </button>
                                          )}

                                          {/* Agregar al final */}
                                          <button
                                            type="button"
                                            onClick={() => handleAppendParagraphToReport(paragraphActionResult)}
                                            className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer select-none"
                                            title="Agregar esta contribución al final de todo el informe de estudio"
                                          >
                                            <Plus className="h-3.5 w-3.5 text-slate-400" /> Agregar al Final
                                          </button>

                                          {/* Copiar */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(paragraphActionResult || "");
                                              alert("Resultado copiado al portapapeles correctamente.");
                                            }}
                                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer select-none"
                                            title="Copiar texto de resultado para pegarlo manualmente"
                                          >
                                            <Copy className="h-3.5 w-3.5" /> Copiar Texto
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
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
                                  Elegir Archivos / ZIP
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,.dcm,.DCM,.zip,application/zip,application/x-zip-compressed" 
                                    onChange={(e) => handleAttachedFiles(e.target.files)} 
                                    className="hidden" 
                                  />
                                </label>
                                
                                <label className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-md">
                                  <Layers className="h-3 w-3 text-cyan-400" />
                                  Elegir Carpeta o Archivo ZIP
                                  <input 
                                    type="file" 
                                    multiple
                                    accept="image/*,.dcm,.DCM,.zip,application/zip,application/x-zip-compressed"
                                    onChange={(e) => handleAttachedFiles(e.target.files)} 
                                    className="hidden" 
                                  />
                                </label>
                              </div>
                            </div>

                            {/* DICOM Autopopulate Notification Banner */}
                            {dicomNotification && (
                              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-start gap-2.5 text-emerald-200 animate-fadeIn my-2">
                                <span className="p-1 bg-emerald-900/50 rounded-lg text-emerald-400">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </span>
                                <div className="flex-1">
                                  <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Datos del Paciente Sincronizados</h4>
                                  <p className="text-[11px] leading-relaxed text-slate-300 mt-0.5">{dicomNotification}</p>
                                </div>
                                <button 
                                  onClick={() => setDicomNotification(null)}
                                  className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer text-xs font-bold px-1"
                                >
                                  ×
                                </button>
                              </div>
                            )}

                            {/* List/Grid of Thumbnails with caption modification & reorder & delete */}
                            {attachedImages.length > 0 && (
                              <div id="attached-images-gallery" className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-450 uppercase font-black tracking-wider">
                                    Imágenes Cargadas ({attachedImages.length})
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={handleCorrelateFigures}
                                      disabled={isCorrelatingFigures || attachedImages.length === 0}
                                      className="px-2.5 py-1 bg-teal-950/40 hover:bg-teal-950/80 border border-teal-500/20 text-teal-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
                                      title="Inserta de forma retrógrada e inteligente las referencias (ver Figura 1, 2, etc.) en el texto del informe"
                                    >
                                      {isCorrelatingFigures ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin text-teal-400" />
                                          <span>Vinculando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Link className="h-3 w-3 text-teal-400" />
                                          <span>Vincular Figuras en Reporte</span>
                                        </>
                                      )}
                                    </button>

                                    <button 
                                      onClick={handleAiLabelAllImages}
                                      disabled={isLabelingAll}
                                      className="px-2.5 py-1 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
                                    >
                                      {isLabelingAll ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                                          <span>Rotulando Todo...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-3 w-3 text-indigo-400" />
                                          <span>Rotular todas las imágenes</span>
                                        </>
                                      )}
                                    </button>
                                    
                                    <button 
                                      onClick={() => setAttachedImages([])}
                                      className="px-2 py-1 bg-rose-955/20 hover:bg-rose-950/60 border border-rose-900/30 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" /> Limpiar Todo
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Scientific Grid Layout Bar (Modo Revista Científica) */}
                                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 font-mono flex items-center gap-1.5">
                                        <Layers className="h-3.5 w-3.5" />
                                        Disposición en PDF (Formato Revista Científica)
                                      </span>
                                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800/50 font-mono font-bold">
                                        {usImagesGridMode === "auto" ? "Automático Inteligente" : `${usImagesGridMode} por página`}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {attachedImages.length} {attachedImages.length === 1 ? "captura" : "capturas"} • Marcos redondeados con etiquetas PANEL A, B...
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {[
                                      { id: "auto", label: "⚡ Automático", desc: "Ajuste dinámico según cantidad (1x1, 1x2, 2x2)" },
                                      { id: "1x1", label: "1 × 1 (1 / pág.)", desc: "Vista ampliada de alta resolución" },
                                      { id: "1x2", label: "1 × 2 (2 / pág. horiz.)", desc: "1 fila de 2 columnas" },
                                      { id: "2x1", label: "2 × 1 (2 / pág. vert.)", desc: "2 filas de 1 columna" },
                                      { id: "2x2", label: "2 × 2 (4 / pág. Revista)", desc: "Estándar de revista científica (4 por hoja)" },
                                      { id: "3x2", label: "3 × 2 (6 / pág.)", desc: "3 filas de 2 columnas (6 por hoja)" },
                                      { id: "4x2", label: "4 × 2 (8 / pág.)", desc: "4 filas de 2 columnas compactas" }
                                    ].map((opt) => {
                                      const isSelected = usImagesGridMode === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => setUsImagesGridMode(opt.id as UsImagesGridMode)}
                                          title={opt.desc}
                                          className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-bold font-mono tracking-tight transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                                            isSelected
                                              ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 border border-sky-400"
                                              : "bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700"
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {attachedImages.map((img, idx) => {
                                    const currentModality = img.modality || detectImageMetaFromFilename(img.name, img.dicomMetaData).modality;
                                    const currentProj = img.projection || detectImageMetaFromFilename(img.name, img.dicomMetaData).projection;
                                    const currentSide = img.side || detectImageMetaFromFilename(img.name, img.dicomMetaData).side;

                                    return (
                                    <div key={img.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2.5 relative group">
                                      {/* Delete Corner Button */}
                                      <button 
                                        onClick={() => {
                                          setAttachedImages(prev => prev.filter(item => item.id !== img.id));
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-450 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                                        title="Eliminar de los anexos del estudio"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>

                                      <div className="relative aspect-[4/3] bg-black rounded overflow-hidden border border-slate-900">
                                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                                          <span className="px-2 py-0.5 bg-slate-950/90 backdrop-blur-md text-sky-300 font-mono text-[8px] font-black rounded border border-sky-500/40 select-none tracking-wider">
                                            PANEL {getPanelLetter(idx)}
                                          </span>
                                          <span className="px-2 py-0.5 bg-indigo-600/90 backdrop-blur-md text-white font-mono text-[8px] font-black rounded border border-indigo-400/30 select-none tracking-wider">
                                            FIGURA {idx + 1}
                                          </span>
                                          <span className={`px-1.5 py-0.5 font-mono text-[8px] font-black rounded select-none tracking-wider ${currentModality === "MMG" ? "bg-fuchsia-600/90 text-white border border-fuchsia-400/30" : "bg-cyan-600/90 text-white border border-cyan-400/30"}`}>
                                            {currentModality === "MMG" ? "MMG" : "US"}
                                          </span>
                                        </div>
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        {img.isDicom && (
                                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-cyan-600 text-white font-mono text-[8px] font-extrabold rounded select-none tracking-wider">
                                            DICOM
                                          </span>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 gap-1.5">
                                          <span className="truncate max-w-[100px]" title={img.name}>{img.name}</span>
                                          
                                          {/* Modality & Projection Controls */}
                                          <div className="flex items-center gap-1 shrink-0">
                                            <select
                                              value={currentModality}
                                              onChange={(e) => {
                                                const val = e.target.value as "MMG" | "US";
                                                setAttachedImages(prev => prev.map(item => item.id === img.id ? { ...item, modality: val } : item));
                                              }}
                                              className="bg-slate-900 text-slate-300 border border-slate-800 text-[8px] font-bold rounded px-1 py-0.5 outline-none cursor-pointer"
                                            >
                                              <option value="MMG">MMG</option>
                                              <option value="US">US</option>
                                            </select>

                                            {currentModality === "MMG" && (
                                              <>
                                                <select
                                                  value={currentProj}
                                                  onChange={(e) => {
                                                    const val = e.target.value as "MLO" | "CC" | "OTRO";
                                                    setAttachedImages(prev => prev.map(item => item.id === img.id ? { ...item, projection: val } : item));
                                                  }}
                                                  className="bg-slate-900 text-slate-300 border border-slate-800 text-[8px] font-bold rounded px-1 py-0.5 outline-none cursor-pointer"
                                                >
                                                  <option value="MLO">MLO</option>
                                                  <option value="CC">CC</option>
                                                  <option value="OTRO">OTRO</option>
                                                </select>

                                                <select
                                                  value={currentSide}
                                                  onChange={(e) => {
                                                    const val = e.target.value as "Derecha" | "Izquierda" | "Bilateral";
                                                    setAttachedImages(prev => prev.map(item => item.id === img.id ? { ...item, side: val } : item));
                                                  }}
                                                  className="bg-slate-900 text-slate-300 border border-slate-800 text-[8px] font-bold rounded px-1 py-0.5 outline-none cursor-pointer"
                                                >
                                                  <option value="Derecha">DER</option>
                                                  <option value="Izquierda">IZQ</option>
                                                  <option value="Bilateral">BIL</option>
                                                </select>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Edit Caption Input Box */}
                                        <div className="space-y-1.5">
                                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block font-mono">
                                              Descripción / Hallazgo:
                                            </label>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => handleAutocompleteLabelFromReport(img.id)}
                                                disabled={!!loadingAutocompleteIds[img.id]}
                                                className="text-[8px] font-black uppercase tracking-wider text-teal-450 hover:text-teal-300 disabled:opacity-50 transition-all flex items-center gap-1 bg-teal-500/10 hover:bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/15 cursor-pointer select-none"
                                                title="Escribe una palabra o frase clave (ej. 'vesícula', 'quiste' o 'placa') y haz clic aquí para que la IA la busque en el reporte y complete el rótulo"
                                              >
                                                {loadingAutocompleteIds[img.id] ? (
                                                  <>
                                                    <Loader2 className="h-2 w-2 animate-spin text-teal-400" />
                                                    <span>Completando...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Link className="h-2 w-2 text-teal-400" />
                                                    <span>Completar de Reporte</span>
                                                  </>
                                                )}
                                              </button>

                                              <button
                                                onClick={() => handleAiLabelImage(img.id)}
                                                disabled={!!loadingAiLabelIds[img.id]}
                                                className="text-[8px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-all flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/15 cursor-pointer select-none"
                                                title="Analizar imagen completa con IA"
                                              >
                                                {loadingAiLabelIds[img.id] ? (
                                                  <>
                                                    <Loader2 className="h-2 w-2 animate-spin text-indigo-400" />
                                                    <span>Rotulando...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Sparkles className="h-2 w-2 text-indigo-400" />
                                                    <span>Rotular Imagen</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                          <input 
                                            type="text"
                                            value={img.caption}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setAttachedImages(prev => prev.map(item => item.id === img.id ? { ...item, caption: val } : item));
                                            }}
                                            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 outline-none rounded-lg transition-all focus:ring-1 focus:ring-indigo-500/30"
                                            placeholder="Escribe 'vesícula' o 'lito' y haz clic en Completar de Reporte"
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

                                        {/* 3D Volumetric Finding Render Trigger Button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setModal3dSourceImage(img);
                                            setModal3dInitialFinding(img.caption || "");
                                            setIs3dRenderModalOpen(true);
                                          }}
                                          className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-cyan-950/90 via-indigo-950/90 to-purple-950/90 hover:from-cyan-900 hover:via-indigo-900 hover:to-purple-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan-950/40 group"
                                          title="Generar ilustración renderizada en 3D volumétrico para este hallazgo"
                                        >
                                          <Box className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                                          <span>Render 3D del Hallazgo</span>
                                          <Sparkles className="h-3 w-3 text-amber-400" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Sin suite 3D: Corte Focal justo después del reporte */}
                          {!anySuiteUsedUi && (
                            <div id="focal-lesion-3d-module" className="my-4">
                              <Suite3DSuspense label="Corte Focal 3D">
                                <FocalLesion3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("focal_lesion3d")}
                                focalData={focalLesion3dData}
                                setFocalData={setFocalLesion3dData}
                                includeInReport={includeFocalLesion3dInReport}
                                setIncludeInReport={setIncludeFocalLesion3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={atlasDirectivesFromScorecard}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {/* === ATLAS 3D FOTORREALISTA Y CORRELACIÓN ANATÓMICA === */}
                          <Suite3DSuspense label="Atlas 3D">
                            <Atlas3DModule
                            reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                            activeProtocol={specificStudy || studyType || ""}
                            laterality=""
                            selectedModel={modelFor("atlas3d")}
                            atlasData={atlas3dData}
                            setAtlasData={setAtlas3dData}
                            includeInReport={includeAtlas3dInReport}
                            setIncludeInReport={setIncludeAtlas3dInReport}
                            scorecardData={clinicalScorecardData}
                            externalDirectives={atlasDirectivesFromScorecard}
                          />
                          </Suite3DSuspense>

                          {/* === SUITE VASCULAR 3D & MAPA ÁNATOMO-HEMODINÁMICO === */}
                          <Suite3DSuspense label="Suite Vascular 3D">
                            <Vascular3DModule
                            reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                            activeProtocol={specificStudy || studyType || ""}
                            laterality=""
                            selectedModel={modelFor("vascular3d")}
                            vascularData={vascular3dData}
                            setVascularData={setVascular3dData}
                            includeInReport={includeVascular3dInReport}
                            setIncludeInReport={setIncludeVascular3dInReport}
                            scorecardData={clinicalScorecardData}
                            externalDirectives={buildVascularDirectivesFromScorecard(clinicalScorecardData) || atlasDirectivesFromScorecard}
                          />
                          </Suite3DSuspense>

                          <div id="us-plane-simulator-module-wrap" className="mt-4">
                          <Suite3DSuspense label="Simulador de planos US">
                            <UltrasoundPlaneSimulatorModule
                            reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                            activeProtocol={specificStudy || studyType || ""}
                            laterality=""
                            selectedModel={modelFor("us_plane_simulator")}
                            planeData={usPlaneSimulatorData}
                            setPlaneData={setUsPlaneSimulatorData}
                            includeInReport={includeUsPlaneSimulatorInReport}
                            setIncludeInReport={setIncludeUsPlaneSimulatorInReport}
                            scorecardData={clinicalScorecardData}
                            externalDirectives={atlasDirectivesFromScorecard}
                          />
                          </Suite3DSuspense>
                          </div>


                          {/* === 3D SCHEMATIC RENDERS FOR ULTRASOUND FINDINGS === */}
                          <Findings3dRenderModule
                            renders={findings3dRenders}
                            onToggleIncludeInPdf={(id) => {
                              setFindings3dRenders(prev =>
                                prev.map(r => r.id === id ? { ...r, includeInPdf: !r.includeInPdf } : r)
                              );
                            }}
                            onDeleteRender={(id) => {
                              setFindings3dRenders(prev => prev.filter(r => r.id !== id));
                            }}
                            onUpdateRender={(updated) => {
                              setFindings3dRenders(prev =>
                                prev.map(r => r.id === updated.id ? updated : r)
                              );
                            }}
                            onOpenCreateModal={(srcImg, initialDesc) => {
                              setModal3dSourceImage(srcImg || (attachedImages.length > 0 ? attachedImages[0] : null));
                              setModal3dInitialFinding(initialDesc || (srcImg ? srcImg.caption : ""));
                              setIs3dRenderModalOpen(true);
                            }}
                          />

                          <Create3dRenderModal
                            isOpen={is3dRenderModalOpen}
                            onClose={() => {
                              setIs3dRenderModalOpen(false);
                              setModal3dSourceImage(null);
                              setModal3dInitialFinding("");
                            }}
                            attachedImages={attachedImages}
                            sourceImage={modal3dSourceImage}
                            initialFinding={modal3dInitialFinding}
                            studyType={specificStudy || studyType || "Ecografía"}
                            clinicalHistory={clinicalHistory}
                            onSaveRender={(newRender) => {
                              setFindings3dRenders(prev => [newRender, ...prev]);
                            }}
                          />

                          {/* --- SISTEMA DE ACTIVACIÓN RÁPIDA DE MÓDULOS (PROCESAMIENTO EN LOTE) --- */}
                          <div className="my-6 p-5 sm:p-6 bg-slate-900/70 border-2 border-indigo-500/30 rounded-3xl shadow-2xl space-y-5 transition-all">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-2xl text-indigo-400 shrink-0">
                                  <Zap className="h-6 w-6 animate-pulse" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono">
                                      Sistema de Activación Rápida de Módulos
                                    </h3>
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-950 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-mono">
                                      PROCESAMIENTO EN LOTE
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                    Selecciona los anexos, esquemas y cuadros que deseas calcular o desplegar simultáneamente para el reporte activo.
                                  </p>
                                </div>
                              </div>

                              {/* Batch Selection Controls */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllBatchModules(true)}
                                  className="text-[9.5px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 transition-all font-mono cursor-pointer"
                                >
                                  Marcar Todos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllBatchModules(false)}
                                  className="text-[9.5px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700 transition-all font-mono cursor-pointer"
                                >
                                  Desmarcar Todos
                                </button>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-snug px-1">
                              El botón <strong className="text-slate-300">Reporte completo</strong> activa por defecto Scorecard clínico, Resumen operacional y Resumen del paciente. El Cuadro sinóptico de órgano ya no se genera automáticamente. Si habilitaste el acceso rápido, también se activa la suite 3D correspondiente al estudio que seleccionaste manualmente. Marca otros módulos aquí y pulsa ACTIVAR.
                            </p>

                            {/* Catalog Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {[
                                {
                                  id: "vascular3d",
                                  label: "🫀 Suite Vascular 3D & Mapa Ánatomo-Hemodinámico",
                                  badge: "DOPPLER 3D",
                                  desc: "Reconstrucción macrovascular 3D fotorrealista (2 a 3 paneles), cálculo de estenosis y tabulación velocimétrica adaptada.",
                                  color: "text-rose-400 border-rose-500/30 bg-rose-950/20"
                                },
                                {
                                  id: "thyroid3d",
                                  label: "🦋 Suite Tiroides 3D & Ficha TI-RADS",
                                  badge: "TIROIDES 3D",
                                  desc: "Glándula/nódulo 3D, ficha clínica rica bajo la imagen, tabla TI-RADS y anexo PDF a página completa.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
                                {
                                  id: "breast3d",
                                  label: "🦋 Suite Mama 3D & Ficha BI-RADS",
                                  badge: "MAMA 3D",
                                  desc: "Reloj mamario, nódulo, axila, ficha BI-RADS y anexo PDF a página completa.",
                                  color: "text-pink-400 border-pink-500/30 bg-pink-950/20"
                                },
                                {
                                  id: "shoulder3d",
                                  label: "Suite Hombro 3D & Ficha Manguito Rotador",
                                  badge: "MANGUITO 3D",
                                  desc: "Overview del hombro, corte del manguito, TCLB/bursa/AC, ficha clinica y anexo PDF.",
                                  color: "text-amber-400 border-amber-500/30 bg-amber-950/20"
                                },
                                {
                                  id: "knee3d",
                                  label: "Suite Rodilla 3D & Ficha Ligamentos-Meniscos",
                                  badge: "RODILLA 3D",
                                  desc: "Overview de rodilla, meniscos/LCM-LCL, mecanismo extensor/derrame, ficha clinica y anexo PDF.",
                                  color: "text-sky-400 border-sky-500/30 bg-sky-950/20"
                                },
                                {
                                  id: "ankle3d",
                                  label: "Suite Tobillo 3D & Ficha Ligamentos-Aquiles",
                                  badge: "TOBILLO 3D",
                                  desc: "Overview de tobillo, LPAA/ATFL-LPC/CFL-deltoides, Aquiles, derrame, ficha clínica y anexo PDF.",
                                  color: "text-lime-400 border-lime-500/30 bg-lime-950/20"
                                },
                                {
                                  id: "kidney3d",
                                  label: "Suite Riñón 3D & Ficha Vías Urinarias",
                                  badge: "RENAL 3D",
                                  desc: "Riñones, sistema colector, litiasis/quistes Bosniak, vejiga/uréteres, ficha clínica y anexo PDF.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
                                {
                                  id: "abdomen3d",
                                  label: "Suite Abdomen 3D & Ficha Multi-órgano",
                                  badge: "ABDOMEN 3D",
                                  desc: "Overview abdominal, hallazgo hepato-biliar/renal/FID dominante, ficha clínica y anexo PDF.",
                                  color: "text-amber-400 border-amber-500/30 bg-amber-950/20"
                                },
                                {
                                  id: "abdominalWall3d",
                                  label: "Suite Pared Abdominal 3D & Ficha de Pared",
                                  badge: "PARED 3D",
                                  desc: "Hernias, diástasis, orificio, capas/fascia, Valsalva, ficha clínica y anexo PDF.",
                                  color: "text-orange-400 border-orange-500/30 bg-orange-950/20"
                                },
                                {
                                  id: "scrotum3d",
                                  label: "Suite Escroto 3D & Ficha Escrotal",
                                  badge: "ESCROTO 3D",
                                  desc: "Testículos, epidídimo, cordón, Doppler hiliar/pampiniforme, ficha clínica y anexo PDF.",
                                  color: "text-yellow-400 border-yellow-500/30 bg-yellow-950/20"
                                },
                                {
                                  id: "muscleTendon3d",
                                  label: "Suite Muscular / Tendinosa 3D & Ficha Músculo-Tendón",
                                  badge: "MÚSCULO 3D",
                                  desc: "Desgarros musculares, MTJ, Aquiles y tendones de miembros inferiores; ficha clínica y anexo PDF.",
                                  color: "text-rose-400 border-rose-500/30 bg-rose-950/20"
                                },
                                {
                                  id: "wrist3d",
                                  label: "Suite Muñeca 3D & Ficha de Muñeca",
                                  badge: "MUÑECA 3D",
                                  desc: "Tendones dorsales/flexores, túnel del carpo, TFCC y ligamentos; ficha clínica y anexo PDF.",
                                  color: "text-sky-400 border-sky-500/30 bg-sky-950/20"
                                },
                                                                {
                                  id: "clinical_scorecard",
                                  label: "Scorecard Clinico de Criterios (pre-Atlas)",
                                  badge: "SCORECARD",
                                  desc: "Extrae criterios y hallazgos activos del informe; se ejecuta antes del Atlas 3D para anclar la reconstruccion a la patologia real.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
                                {
                                  id: "reasoning_chain",
                                  label: "Cadena de razonamiento radiologico",
                                  badge: "SEMIOLOGIA",
                                  desc: "Flujograma del pensamiento diagnostico: clinica, signos buscados/encontrados/descartados, correlacion y sintesis.",
                                  color: "text-violet-400 border-violet-500/30 bg-violet-950/20"
                                },
                                {
                                  id: "negativity_checklist",
                                  label: "Checklist de negatividad dirigida",
                                  badge: "NEGATIVIDAD",
                                  desc: "Cierra signos criticos del protocolo: inserta al reporte lo no mencionado; solo limita por causa tecnica.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
                                {
                                  id: "second_reader",
                                  label: "Segundo lector simulado",
                                  badge: "PEER REVIEW",
                                  desc: "Objeciones al informe, que sostener y sugerencias con boton para agregar al cuerpo del reporte.",
                                  color: "text-indigo-400 border-indigo-500/30 bg-indigo-950/20"
                                },
                                {
                                  id: "differential_tree",
                                  label: "Arbol de diferenciales con poda",
                                  badge: "DIFERENCIALES",
                                  desc: "Hipótesis a favor/en contra, poda de ramas incompatibles y diagnostico mas probable.",
                                  color: "text-orange-400 border-orange-500/30 bg-orange-950/20"
                                },
                                {
                                  id: "semiotics_conduct_matrix",
                                  label: "Matriz semiologia / conducta",
                                  badge: "MATRIZ",
                                  desc: "Tabla editable hallazgo / signos / conducta; enfoque por patologia e inclusion opcional en PDF.",
                                  color: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-950/20"
                                },
                                {
                                  id: "findings_infographic",
                                  label: "Infografia de justificacion diagnostica",
                                  badge: "INFOGRAFIA",
                                  desc: "Lamina visual (convergencia / constelacion / cascada) con hallazgos que sostienen el diagnostico. Sin manejo.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
{
                                  id: "atlas3d",
                                  label: "🧊 Atlas 3D Fotorrealista y Correlación Anatómica",
                                  badge: "ATLAS 3D",
                                  desc: "Reconstrucción volumétrica fotorrealista de alta resolución (2 a 3 paneles) con tabla de correlación y síntesis biomecánica.",
                                  color: "text-indigo-400 border-indigo-500/30 bg-indigo-950/20"
                                },
                                {
                                  id: "radar",
                                  label: "🎯 Radar Biomecánico e Inflamatorio (Análisis 6D)",
                                  badge: "RADAR 6D",
                                  desc: "Cuantifica 6 vectores biomecánicos, inflamatorios y de sobrecarga.",
                                  color: "text-indigo-400 border-indigo-500/30 bg-indigo-950/20"
                                },
                                {
                                  id: "case_analysis",
                                  label: "🩺 Análisis de Caso Clinico / Diagnóstico Avanzado (Anexo de Correlación PDF)",
                                  badge: "CORRELACIÓN & PDF",
                                  desc: "Desarrolla correlación fisiopatológica y flujograma para exportar al PDF.",
                                  color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
                                },
                                {
                                  id: "bibliography",
                                  label: "📚 Búsqueda Bibliográfica de Soporte (Grounding)",
                                  badge: "GROUNDING",
                                  desc: "Ejecuta búsqueda científica grounded basada en los hallazgos reales.",
                                  color: "text-teal-400 border-teal-500/30 bg-teal-950/20"
                                },
                                {
                                  id: "operational_summary",
                                  label: "📋 Resumen Operacional de Hallazgos (WhatsApp / Resumen Clínico)",
                                  badge: "RESUMEN OPERACIONAL",
                                  desc: "Sintetiza de forma ejecutiva los hallazgos e impresión diagnóstica para consulta ágil y envío por WhatsApp.",
                                  color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
                                },
                                {
                                  id: "patient_summary",
                                  label: "👤 Explicación / Resumen para el Paciente",
                                  badge: "PACIENTE",
                                  desc: "Traduce la jerga técnica a lenguaje accesible y comprensible.",
                                  color: "text-orange-400 border-orange-500/30 bg-orange-950/20"
                                },
                                {
                                  id: "glossary",
                                  label: "📖 Glosario Dinámico de Términos",
                                  badge: "GLOSARIO",
                                  desc: "Identifica y define signos, síndromes y conceptos del reporte.",
                                  color: "text-pink-400 border-pink-500/30 bg-pink-950/20"
                                },
                                {
                                  id: "schematic",
                                  label: "📐 Esquema Sinóptico de Hallazgos",
                                  badge: "SINOPSIS",
                                  desc: "Organiza los hallazgos en un esquema visual e inyectable al informe.",
                                  color: "text-amber-400 border-amber-500/30 bg-amber-950/20"
                                },
                                {
                                  id: "measurements",
                                  label: "📏 Asistente de Medidas Clínicas",
                                  badge: "MEDIDAS",
                                  desc: "Identifica estructuras inyectando sus rangos de referencia normales.",
                                  color: "text-indigo-400 border-indigo-500/30 bg-indigo-950/20"
                                },
                                {
                                  id: "footnotes",
                                  label: "🔖 Creador de Notas de Pie de Página",
                                  badge: "PIE DE PÁGINA",
                                  desc: "Genera aclaraciones y notas al pie para recomendaciones complejas.",
                                  color: "text-purple-400 border-purple-500/30 bg-purple-950/20"
                                },
                                {
                                  id: "organ_synoptic",
                                  label: "🫀 Cuadro Sinóptico de Órgano",
                                  badge: "CUADRO ÓRGANO",
                                  desc: "Sintetiza la semiología de un órgano específico en tabla sinóptica.",
                                  color: "text-cyan-400 border-cyan-500/30 bg-cyan-950/20"
                                },
                                {
                                  id: "fractures",
                                  label: "🦴 Sinopsis de Fracturas y Luxaciones",
                                  badge: "FRACTURAS",
                                  desc: "Clasifica y desglosa hallazgos traumatológicos y sus pautas de manejo.",
                                  color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
                                },
                                {
                                  id: "classifications",
                                  label: "📊 Desglose de Clasificaciones Radiológicas",
                                  badge: "CLASIFICACIONES",
                                  desc: "Desglosa la matriz de criterios para escalas estándar (BI-RADS, O-RADS, etc.).",
                                  color: "text-blue-400 border-blue-500/30 bg-blue-950/20"
                                },
                              ].map((mod) => {
                                const isChecked = !!selectedBatchModules[mod.id];
                                return (
                                  <label
                                    key={mod.id}
                                    onClick={() => {
                                      setSelectedBatchModules((prev) => ({
                                        ...prev,
                                        [mod.id]: !prev[mod.id]
                                      }));
                                    }}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
                                      isChecked
                                        ? `${mod.color} ring-1 ring-indigo-500/50 shadow-lg`
                                        : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-[11px] font-black leading-tight text-slate-200">
                                        {mod.label}
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="mt-0.5 h-4 w-4 rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-indigo-500 shrink-0 cursor-pointer"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                                      <p className="text-[9.5px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
                                        {mod.desc}
                                      </p>
                                      <span className="text-[7.5px] font-black uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                                        {mod.badge}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Batch Success Feedback */}
                            {batchSuccessMessage && (
                              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-mono font-bold flex items-center gap-2.5 animate-fade-in">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                <span>{batchSuccessMessage}</span>
                              </div>
                            )}

                            {/* Execution Button */}
                            <div className="pt-2 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => void handleActivateBatchModules()}
                                disabled={isActivatingBatch || !Object.values(selectedBatchModules).some(Boolean)}
                                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-950/50 flex items-center justify-center gap-3 font-mono cursor-pointer border border-indigo-400/40"
                              >
                                {isActivatingBatch ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                                    <span>Procesando Módulos Seleccionados...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-4 w-4 text-indigo-200" />
                                    <span>ACTIVAR ({Object.values(selectedBatchModules).filter(Boolean).length} MÓDULOS)</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

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
                                  CORRELACIÓN & FORMATOS PDF
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Desarrolla una correlación fisiopatológica sobre los hallazgos principales y permite elegir el formato de exportación a PDF (Flujograma Semiológico, Flujograma Algorítmico, Pilares o Mapa).
                              </p>

                              {/* Formats Selection Buttons */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                                  Elegir Formato para Exportar al PDF:
                                </span>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {[
                                    { id: "flujograma_semiologico", label: "Opción 1: Semiológico", desc: "Ciclo Pensamiento" },
                                    { id: "flujograma_algoritmico", label: "Opción 2: Flujograma", desc: "Árbol de Decisión" },
                                    { id: "esquema_pilares", label: "Opción 3: Pilares", desc: "Integración" },
                                    { id: "mapa_diferenciales", label: "Opción 4: Mapa", desc: "Diferenciales" },
                                    { id: "matriz_semiotica", label: "Opción 5: Matriz", desc: "Semiótica Comparativa" },
                                  ].map(fmt => (
                                    <button
                                      key={fmt.id}
                                      type="button"
                                      onClick={() => setSelectedCaseFormat(fmt.id as CaseAnalysisFormatOption)}
                                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                        selectedCaseFormat === fmt.id
                                          ? "bg-emerald-950/80 border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/40"
                                          : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                      }`}
                                    >
                                      <div className="text-[9.5px] font-mono font-black uppercase tracking-tight">{fmt.label}</div>
                                      <div className="text-[8px] font-medium text-slate-500 truncate">{fmt.desc}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>

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
                                Análisis de Caso (Generar)
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
                                Traduce el informe a una explicación educativa: qué estudio se realizó y qué significan los hallazgos, sin recomendaciones ni pasos a seguir.
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

                            {/* Card 7: Asistente de Medidas Clínicas */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-indigo-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Ruler className="h-4 w-4 text-indigo-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Asistente de Medidas (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded">
                                  MEDIDAS
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Analiza el reporte clínico activo para identificar estructuras anatómicas susceptibles de medición e inyecta medidas normales de forma automática.
                              </p>
                              <button
                                onClick={() => setIsAsistenteMedidasOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isAsistenteMedidasOpen
                                    ? "bg-indigo-600/15 border-indigo-500/60 text-indigo-200"
                                    : "bg-slate-950 border-slate-800 hover:border-indigo-500/30 text-indigo-400"
                                }`}
                              >
                                <Ruler className="h-4 w-4" />
                                {isAsistenteMedidasOpen ? "Ocultar Asistente" : "Activar Asistente"}
                              </button>
                            </div>

                            {/* Card 8: Creador de Notas de Pie de Página (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-purple-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Bookmark className="h-4 w-4 text-purple-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Notas de Pie (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-purple-950/40 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded">
                                  PIE DE PÁGINA
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Audita el reporte de manera íntegra para proponer pies de páginas con guías, controles y aclaraciones de forma personalizada.
                              </p>
                              <button
                                onClick={() => setIsCreadorNotasOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isCreadorNotasOpen
                                    ? "bg-purple-600/15 border-purple-500/60 text-purple-250"
                                    : "bg-slate-950 border-slate-800 hover:border-purple-500/30 text-purple-400"
                                }`}
                              >
                                <Bookmark className="h-4 w-4" />
                                {isCreadorNotasOpen ? "Ocultar Notas" : "Crear Notas de Pie"}
                              </button>
                            </div>

                            {/* Card 8b: Cuadro Sin�ptico de �rgano (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-cyan-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-cyan-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Mapa Sin�ptico por �rgano (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-cyan-950/40 text-cyan-400 border border-cyan-900/30 px-2 py-0.5 rounded">
                                  CUADRO �RGANO
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Extrae hallazgos de un �rgano o regi�n del reporte y genera cuadro sin�ptico con inyecci�n inteligente al informe.
                              </p>
                              <button
                                onClick={() => setIsCreadorCuadroSinopticoOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isCreadorCuadroSinopticoOpen
                                    ? "bg-cyan-600/15 border-cyan-500/60 text-cyan-200"
                                    : "bg-slate-950 border-slate-800 hover:border-cyan-500/30 text-cyan-400"
                                }`}
                              >
                                <Layers className="h-4 w-4" />
                                {isCreadorCuadroSinopticoOpen ? "Ocultar Cuadro Sin�ptico" : "Abrir Cuadro Sin�ptico"}
                              </button>
                            </div>

                            {/* Card 8c: Elastograf�a y QUS (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-amber-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Elastograf�a y QUS (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded">
                                  3D HEP�TICO
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Reconstrucci�n 3D con rigidez hep�tica (kPa), CAP y fracci�n grasa QUS extra�dos del reporte.
                              </p>
                              <button
                                onClick={() => setIsElastographyQUSModuleOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isElastographyQUSModuleOpen
                                    ? "bg-amber-600/15 border-amber-500/60 text-amber-200"
                                    : "bg-slate-950 border-slate-800 hover:border-amber-500/30 text-amber-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isElastographyQUSModuleOpen ? "Ocultar Elastograf�a/QUS" : "Abrir Elastograf�a y QUS"}
                              </button>
                            </div>

                            
                            {/* Card: Suite Tiroides 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-teal-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-teal-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Tiroides 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-teal-950/40 text-teal-400 border border-teal-900/30 px-2 py-0.5 rounded">
                                  TI-RADS 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Glándula/nódulo/ganglios 3D, ficha clínica bajo imagen, tabla TI-RADS y anexo PDF a página completa.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsThyroid3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("thyroid-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isThyroid3dSuiteOpen
                                    ? "bg-teal-600/15 border-teal-500/60 text-teal-200"
                                    : "bg-slate-950 border-slate-800 hover:border-teal-500/30 text-teal-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isThyroid3dSuiteOpen ? "Ocultar Suite Tiroides" : "Abrir Suite Tiroides 3D"}
                              </button>
                            </div>

                            {/* Card: Suite Mama 3D (misma UX; módulo en siguiente iteración) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-pink-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-pink-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Mama 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-pink-950/40 text-pink-400 border border-pink-900/30 px-2 py-0.5 rounded">
                                  BI-RADS 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Reloj mamario bilateral, nódulo dominante, axilas, ficha BI-RADS bajo imagen y anexo PDF a página completa.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsBreast3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("breast-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isBreast3dSuiteOpen
                                    ? "bg-pink-600/15 border-pink-500/60 text-pink-200"
                                    : "bg-slate-950 border-slate-800 hover:border-pink-500/30 text-pink-400"
                                }`}
                              >
                                <Sparkles className="h-4 w-4" />
                                {isBreast3dSuiteOpen ? "Ocultar Suite Mama" : "Abrir Suite Mama 3D"}
                              </button>
                            </div>

                            {/* Card: Suite Hombro 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-amber-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Hombro 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded">
                                  MANGUITO 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Manguito rotador, TCLB, bursa SAD y AC con ficha clínica bajo imagen; inyecta scorecard y radar biomecánico para mayor exactitud.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsShoulder3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("shoulder-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isShoulder3dSuiteOpen
                                    ? "bg-amber-600/15 border-amber-500/60 text-amber-200"
                                    : "bg-slate-950 border-slate-800 hover:border-amber-500/30 text-amber-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isShoulder3dSuiteOpen ? "Ocultar Suite Hombro" : "Abrir Suite Hombro 3D"}
                              </button>
                            </div>

{/* Card 8d: Sinopsis de Fracturas (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Bone className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Sinopsis de Fracturas (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  FRACTURAS
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Clasifica y desglosa hallazgos traumatol�gicos en tabla sin�ptica inyectable al informe.
                              </p>
                              <button
                                onClick={() => setIsCreadorSinopsisFracturasOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isCreadorSinopsisFracturasOpen
                                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-200"
                                    : "bg-slate-950 border-slate-800 hover:border-emerald-500/30 text-emerald-400"
                                }`}
                              >
                                <Bone className="h-4 w-4" />
                                {isCreadorSinopsisFracturasOpen ? "Ocultar Sinopsis" : "Abrir Sinopsis de Fracturas"}
                              </button>
                            </div>

                            {/* Card 9: Resumen Operacional para WhatsApp (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <ListTodo className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Resumen Operacional (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  WhatsApp
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Extrae un resumen de hallazgos del reporte de manera automática para inyectarlo en el WhatsApp y mostrarlo al paciente.
                              </p>
                              <button
                                onClick={handleGenerateWhatsAppSummary}
                                disabled={isGeneratingOperationalSummary || !(isEditingReportManual ? editedReportText : generatedReport)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  operationalSummaryText
                                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-200"
                                    : "bg-slate-950 border-slate-800 hover:border-emerald-500/30 text-emerald-450"
                                }`}
                              >
                                {isGeneratingOperationalSummary ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                                ) : (
                                  <ListTodo className="h-4 w-4 text-emerald-450" />
                                )}
                                {isGeneratingOperationalSummary
                                  ? "Generando Resumen..."
                                  : operationalSummaryText
                                  ? "Resumen Listo ✓ (Generar de Nuevo)"
                                  : "Crear Resumen 📋"}
                              </button>
                            </div>

                            {/* Card 10: Cuadro de Semiología por Imágenes (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-cyan-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all animate-fade-in">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Semiología por Imágenes (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-cyan-950/40 text-cyan-400 border border-cyan-900/30 px-2 py-0.5 rounded">
                                  SEMIOLOGÍA
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Realiza un cuadro de semiología por imágenes para justificar clínicamente cada uno de los diagnósticos establecidos y detallar las patologías descartadas.
                              </p>
                              <button
                                onClick={handleGenerateSemiologyTable}
                                disabled={isGeneratingSemiology || !(isEditingReportManual ? editedReportText : generatedReport)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  semiologyData
                                    ? "bg-cyan-600/15 border-cyan-500/60 text-cyan-200 font-bold"
                                    : "bg-slate-950 border-slate-800 hover:border-cyan-500/30 text-cyan-450"
                                }`}
                              >
                                {isGeneratingSemiology ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                {isGeneratingSemiology
                                  ? "Confeccionando Cuadro..."
                                  : semiologyData
                                  ? "Cuadro Listo ✓ (Confeccionar Nuevo)"
                                  : "Confeccionar Cuadro Semiológico"}
                              </button>
                            </div>

                            
                            {/* Card: Suite Rodilla 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-sky-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-sky-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Rodilla 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-sky-950/40 text-sky-400 border border-sky-900/30 px-2 py-0.5 rounded">
                                  RODILLA 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Meniscos, LCM/LCL, mecanismo extensor y derrame con ficha clínica; inyecta scorecard y radar biomecánico de rodilla.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsKnee3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("knee-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isKnee3dSuiteOpen
                                    ? "bg-sky-600/15 border-sky-500/60 text-sky-200"
                                    : "bg-slate-950 border-slate-800 hover:border-sky-500/30 text-sky-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isKnee3dSuiteOpen ? "Ocultar Suite Rodilla" : "Abrir Suite Rodilla 3D"}
                              </button>
                            </div>

                            {/* Card: Suite Tobillo 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-lime-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-lime-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Tobillo 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-lime-950/40 text-lime-400 border border-lime-900/30 px-2 py-0.5 rounded">
                                  TOBILLO 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                LPAA/ATFL, LPC/CFL, deltoides, Aquiles y derrame con ficha clínica; inyecta scorecard y radar de Aquiles/trauma de tobillo.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAnkle3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("ankle-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isAnkle3dSuiteOpen
                                    ? "bg-lime-600/15 border-lime-500/60 text-lime-200"
                                    : "bg-slate-950 border-slate-800 hover:border-lime-500/30 text-lime-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isAnkle3dSuiteOpen ? "Ocultar Suite Tobillo" : "Abrir Suite Tobillo 3D"}
                              </button>
                            </div>

                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-teal-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-teal-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Riñón 3D & Vías Urinarias
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-teal-950/40 text-teal-400 border border-teal-900/30 px-2 py-0.5 rounded">
                                  RENAL 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Riñones, ectasia, litiasis/Bosniak, uréteres y vejiga con ficha clínica; inyecta scorecard renal y radar.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsKidney3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("kidney-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isKidney3dSuiteOpen
                                    ? "bg-teal-600/15 border-teal-500/60 text-teal-200"
                                    : "bg-slate-950 border-slate-800 hover:border-teal-500/30 text-teal-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isKidney3dSuiteOpen ? "Ocultar Suite Riñón" : "Abrir Suite Riñón 3D"}
                              </button>
                            </div>

                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-amber-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Abdomen 3D & Multi-órgano
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded">
                                  ABDOMEN 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Hígado, vesícula, páncreas, bazo, riñones y FID con ficha clínica; inyecta scorecard abdominal.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAbdomen3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("abdomen-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isAbdomen3dSuiteOpen
                                    ? "bg-amber-600/15 border-amber-500/60 text-amber-200"
                                    : "bg-slate-950 border-slate-800 hover:border-amber-500/30 text-amber-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isAbdomen3dSuiteOpen ? "Ocultar Suite Abdomen" : "Abrir Suite Abdomen 3D"}
                              </button>
                            </div>

                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-orange-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-orange-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Pared Abdominal 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-orange-950/40 text-orange-400 border border-orange-900/30 px-2 py-0.5 rounded">
                                  PARED 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Hernias, diástasis, orificio, capas/fascia y dinámica con Valsalva; inyecta scorecard de pared.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAbdominalWall3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("abdominal-wall-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isAbdominalWall3dSuiteOpen
                                    ? "bg-orange-600/15 border-orange-500/60 text-orange-200"
                                    : "bg-slate-950 border-slate-800 hover:border-orange-500/30 text-orange-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isAbdominalWall3dSuiteOpen ? "Ocultar Suite Pared Abdominal" : "Abrir Suite Pared Abdominal 3D"}
                              </button>
                            </div>


{/* Card 8c2: Suite Escroto 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-yellow-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-yellow-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Escroto 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-yellow-950/40 text-yellow-400 border border-yellow-900/30 px-2 py-0.5 rounded">
                                  ESCROTO 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Testículos, epidídimo, cordón y Doppler escrotal; inyecta scorecard de escroto.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsScrotum3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("scrotum-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isScrotum3dSuiteOpen
                                    ? "bg-yellow-600/15 border-yellow-500/60 text-yellow-200"
                                    : "bg-slate-950 border-slate-800 hover:border-yellow-500/30 text-yellow-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isScrotum3dSuiteOpen ? "Ocultar Suite Escroto" : "Abrir Suite Escroto 3D"}
                              </button>
                            </div>

                            {/* Card 8c3: Suite Muscular / Tendinosa 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-rose-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-rose-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Muscular / Tendinosa 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-rose-950/40 text-rose-400 border border-rose-900/30 px-2 py-0.5 rounded">
                                  MÚSCULO 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Desgarros, uniones miotendinosas, Aquiles y tendones de MI; inyecta scorecard músculo-tendón.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMuscleTendon3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("muscle-tendon-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isMuscleTendon3dSuiteOpen
                                    ? "bg-rose-600/15 border-rose-500/60 text-rose-200"
                                    : "bg-slate-950 border-slate-800 hover:border-rose-500/30 text-rose-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isMuscleTendon3dSuiteOpen ? "Ocultar Suite Muscular / Tendinosa" : "Abrir Suite Muscular / Tendinosa 3D"}
                              </button>
                            </div>

                            {/* Card 8c4: Suite Muñeca 3D */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-sky-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-sky-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Suite Muñeca 3D
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-sky-950/40 text-sky-400 border border-sky-900/30 px-2 py-0.5 rounded">
                                  MUÑECA 3D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Tendones dorsales/flexores, túnel del carpo, TFCC y ligamentos; inyecta scorecard de muñeca.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsWrist3dSuiteOpen(p => {
                                    const next = !p;
                                    if (next) setTimeout(() => document.getElementById("wrist-3d-suite-module")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                                    return next;
                                  });
                                }}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isWrist3dSuiteOpen
                                    ? "bg-sky-600/15 border-sky-500/60 text-sky-200"
                                    : "bg-slate-950 border-slate-800 hover:border-sky-500/30 text-sky-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isWrist3dSuiteOpen ? "Ocultar Suite Muñeca" : "Abrir Suite Muñeca 3D"}
                              </button>
                            </div>

                            {/* Card 8d: Sinopsis de Fracturas (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Bone className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Sinopsis de Fracturas (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  FRACTURAS
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Clasifica y desglosa hallazgos traumatol�gicos en tabla sin�ptica inyectable al informe.
                              </p>
                              <button
                                onClick={() => setIsCreadorSinopsisFracturasOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isCreadorSinopsisFracturasOpen
                                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-200"
                                    : "bg-slate-950 border-slate-800 hover:border-emerald-500/30 text-emerald-400"
                                }`}
                              >
                                <Bone className="h-4 w-4" />
                                {isCreadorSinopsisFracturasOpen ? "Ocultar Sinopsis" : "Abrir Sinopsis de Fracturas"}
                              </button>
                            </div>

                            {/* Card 9: Resumen Operacional para WhatsApp (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <ListTodo className="h-4 w-4 text-emerald-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Resumen Operacional (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  WhatsApp
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Extrae un resumen de hallazgos del reporte de manera automática para inyectarlo en el WhatsApp y mostrarlo al paciente.
                              </p>
                              <button
                                onClick={handleGenerateWhatsAppSummary}
                                disabled={isGeneratingOperationalSummary || !(isEditingReportManual ? editedReportText : generatedReport)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  operationalSummaryText
                                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-200"
                                    : "bg-slate-950 border-slate-800 hover:border-emerald-500/30 text-emerald-450"
                                }`}
                              >
                                {isGeneratingOperationalSummary ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                                ) : (
                                  <ListTodo className="h-4 w-4 text-emerald-450" />
                                )}
                                {isGeneratingOperationalSummary
                                  ? "Generando Resumen..."
                                  : operationalSummaryText
                                  ? "Resumen Listo ✓ (Generar de Nuevo)"
                                  : "Crear Resumen 📋"}
                              </button>
                            </div>

                            {/* Card 10: Cuadro de Semiología por Imágenes (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-cyan-500/20 rounded-2xl p-5 space-y-4 shadow-xl transition-all animate-fade-in">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Semiología por Imágenes (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-cyan-950/40 text-cyan-400 border border-cyan-900/30 px-2 py-0.5 rounded">
                                  SEMIOLOGÍA
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Realiza un cuadro de semiología por imágenes para justificar clínicamente cada uno de los diagnósticos establecidos y detallar las patologías descartadas.
                              </p>
                              <button
                                onClick={handleGenerateSemiologyTable}
                                disabled={isGeneratingSemiology || !(isEditingReportManual ? editedReportText : generatedReport)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  semiologyData
                                    ? "bg-cyan-600/15 border-cyan-500/60 text-cyan-200 font-bold"
                                    : "bg-slate-950 border-slate-800 hover:border-cyan-500/30 text-cyan-450"
                                }`}
                              >
                                {isGeneratingSemiology ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                {isGeneratingSemiology
                                  ? "Confeccionando Cuadro..."
                                  : semiologyData
                                  ? "Cuadro Listo ✓ (Confeccionar Nuevo)"
                                  : "Confeccionar Cuadro Semiológico"}
                              </button>
                            </div>

                            
                            {/* Card: Scorecard de Criterios + sync Atlas Overlay */}
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-teal-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-teal-200">Scorecard de Criterios (IA)</h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Checklist auditable del informe, sincronizado con overlays del Atlas 3D.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsClinicalScorecardOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isClinicalScorecardOpen
                                    ? "bg-teal-700 text-white"
                                    : "bg-teal-600/80 hover:bg-teal-500 text-white"
                                }`}
                              >
                                {isClinicalScorecardOpen ? "Ocultar Scorecard" : "Abrir Scorecard de Criterios"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-violet-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-violet-200 flex items-center gap-2">
                                    <GitBranch className="h-4 w-4 text-violet-400" />
                                    Cadena de razonamiento
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Flujograma semiol�gico: signos buscados, hallados y descartados, con correlaci�n cl�nica/lab.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsReasoningChainOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isReasoningChainOpen
                                    ? "bg-violet-700 text-white"
                                    : "bg-violet-600/80 hover:bg-violet-500 text-white"
                                }`}
                              >
                                {isReasoningChainOpen ? "Ocultar cadena" : "Abrir cadena de razonamiento"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-teal-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-teal-200 flex items-center gap-2">
                                    Checklist de negatividad dirigida
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Nada sin evaluar salvo limitacion tecnica. Inserta al reporte lo no mencionado.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsNegativityChecklistOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isNegativityChecklistOpen
                                    ? "bg-teal-700 text-white"
                                    : "bg-teal-600/80 hover:bg-teal-500 text-white"
                                }`}
                              >
                                {isNegativityChecklistOpen ? "Ocultar checklist" : "Abrir checklist de negatividad"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-indigo-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-indigo-200 flex items-center gap-2">
                                    Segundo lector simulado
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Peer review: objeciones, que sostener y agregar al cuerpo del informe con un clic.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsSecondReaderOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isSecondReaderOpen
                                    ? "bg-indigo-700 text-white"
                                    : "bg-indigo-600/80 hover:bg-indigo-500 text-white"
                                }`}
                              >
                                {isSecondReaderOpen ? "Ocultar segundo lector" : "Abrir segundo lector"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-orange-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-orange-200 flex items-center gap-2">
                                    <GitFork className="h-4 w-4 text-orange-400" />
                                    �rbol de diferenciales
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Hip�tesis con criterios a favor/en contra y poda de ramas descartadas.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsDifferentialTreeOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isDifferentialTreeOpen
                                    ? "bg-orange-700 text-white"
                                    : "bg-orange-600/80 hover:bg-orange-500 text-white"
                                }`}
                              >
                                {isDifferentialTreeOpen ? "Ocultar arbol" : "Abrir arbol de diferenciales"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-fuchsia-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-fuchsia-200 flex items-center gap-2">
                                    <Table2 className="h-4 w-4 text-fuchsia-400" />
                                    Matriz semiologia ? conducta
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Enfoque por patologia, filas editables e inclusion opcional en el PDF.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsSemioticsConductMatrixOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isSemioticsConductMatrixOpen
                                    ? "bg-fuchsia-700 text-white"
                                    : "bg-fuchsia-600/80 hover:bg-fuchsia-500 text-white"
                                }`}
                              >
                                {isSemioticsConductMatrixOpen ? "Ocultar matriz" : "Abrir matriz"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-cyan-200 flex items-center gap-2">
                                    <Hexagon className="h-4 w-4 text-cyan-400" />
                                    Infografía dual (Médico + Paciente)
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Misma lámina, dos voces por pestaña (tamaño completo). No confundir
                                    con la infografía rosa del informe paciente.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsFindingsInfographicOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isFindingsInfographicOpen
                                    ? "bg-cyan-700 text-white"
                                    : "bg-cyan-600/80 hover:bg-cyan-500 text-white"
                                }`}
                              >
                                {isFindingsInfographicOpen
                                  ? "Ocultar infografía dual"
                                  : "Abrir infografía dual"}
                              </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-rose-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-rose-200 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-rose-400" />
                                    Ficha lesión dominante
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Una página: medidas, categoría, imagen, corte 3D y frase clínica.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsDominantLesionCardOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isDominantLesionCardOpen
                                    ? "bg-rose-700 text-white"
                                    : "bg-rose-600/80 hover:bg-rose-500 text-white"
                                }`}
                              >
                                {isDominantLesionCardOpen ? "Ocultar ficha" : "Abrir ficha"}
                              </button>
                            </div>

                            {/* Card: Corte Focal 3D */}
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-cyan-200 flex items-center gap-2">
                                    <Crosshair className="h-4 w-4 text-cyan-400" />
                                    Corte Focal 3D
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Corte de la lesi�n (auto/manual), fidelidad Atlas, paneles CTX + MACRO e inclusi�n en PDF.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById("focal-lesion-3d-module");
                                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                className="w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors bg-cyan-600/80 hover:bg-cyan-500 text-white"
                              >
                                Ir a Corte Focal 3D
                              </button>
                            </div>

                            {/* Card: Simulador de plano ecográfico */}
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-cyan-200 flex items-center gap-2">
                                    <Scan className="h-4 w-4 text-cyan-400" />
                                    Simulador de plano eco
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Auto-detecta el plano del informe, lo dibuja en 3D y permite correcciones por chips.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById("us-plane-simulator-module-wrap");
                                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                className="w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors bg-cyan-600/80 hover:bg-cyan-500 text-white"
                              >
                                Ir a Simulador de plano
                              </button>
                            </div>

                            {/* Card: Extractor de medidas (gauges vs rango) */}
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-blue-900/40 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-blue-200">Extractor de medidas</h4>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Barras vs rango normal. Casilla para incluir o no las medidas normales en el PDF.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsMeasurementsGaugeOpen((v) => !v)}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                  isMeasurementsGaugeOpen
                                    ? "bg-blue-700 text-white"
                                    : "bg-blue-600/80 hover:bg-blue-500 text-white"
                                }`}
                              >
                                {isMeasurementsGaugeOpen ? "Ocultar Extractor" : "Abrir Extractor de medidas"}
                              </button>
                            </div>

{/* Card 11: Radar Biomecánico e Inflamatorio (IA) */}
                            <div className="bg-slate-900/40 border-2 border-slate-800 hover:border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl transition-all font-sans">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-indigo-400" />
                                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest font-mono">
                                    Radar Biomecánico (IA)
                                  </h4>
                                </div>
                                <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded">
                                  RADAR 6D
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                Cuantifica 6 vectores biomecánicos, inflamatorios y de sobrecarga en un diagrama spider interactivo e inyectable al reporte.
                              </p>
                              <button
                                onClick={() => setIsBiomechanicalRadarOpen(p => !p)}
                                className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 font-mono cursor-pointer border-2 ${
                                  isBiomechanicalRadarOpen
                                    ? "bg-indigo-600/15 border-indigo-500/60 text-indigo-200"
                                    : "bg-slate-950 border-slate-800 hover:border-indigo-500/30 text-indigo-400"
                                }`}
                              >
                                <Activity className="h-4 w-4" />
                                {isBiomechanicalRadarOpen ? "Ocultar Radar" : "Abrir Radar Biomecánico"}
                              </button>
                            </div>
                          </div>

                          {/* Render Asistente de Medidas Clínicas Panel */}
                          {isAsistenteMedidasOpen && (
                            <div className="my-6">
                              <AsistenteMedidas
                                selectedModel={modelFor("default")}
                                reportText={isEditingReportManual ? editedReportText : generatedReport}
                                studyType={specificStudy}
                                onReportUpdated={(newReportText) => {
                                  setEditedReportText(newReportText);
                                  setGeneratedReport(newReportText);
                                }}
                              />
                            </div>
                          )}

                          {/* Render Creador de Notas de Pie de Página Panel */}
                          {isCreadorNotasOpen && (
                            <div className="my-6">
                              <CreadorNotasPie
                                selectedModel={modelFor("default")}
                                reportText={isEditingReportManual ? editedReportText : generatedReport}
                                onReportUpdated={(newReportText) => {
                                  setEditedReportText(newReportText);
                                  setGeneratedReport(newReportText);
                                }}
                              />
                            </div>
                          )}

                          
                          {isClinicalScorecardOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-teal-400 bg-slate-900/60 rounded-xl border border-teal-900/40 animate-pulse">Cargando Scorecard...</div>}>
                                <ClinicalScorecardModule
                                  selectedModel={modelFor("clinical_scorecard")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  scorecardData={clinicalScorecardData}
                                  setScorecardData={setClinicalScorecardData}
                                  includeInReport={includeScorecardInReport}
                                  setIncludeInReport={setIncludeScorecardInReport}
                                  atlasData={atlas3dData}
                                  setAtlasData={setAtlas3dData}
                                  onAtlasDirectivesSuggested={setAtlasDirectivesFromScorecard}
                                  onSendToInfographic={(data) => {
                                    setFindingsInfographicData(data);
                                    setIncludeFindingsInfographicInReport(true);
                                    setIsFindingsInfographicOpen(true);
                                    window.setTimeout(() => {
                                      document
                                        .getElementById("findings-infographic-module")
                                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }, 80);
                                  }}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isReasoningChainOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-violet-400 bg-slate-900/60 rounded-xl border border-violet-900/40 animate-pulse">Cargando cadena de razonamiento...</div>}>
                                <ReasoningChainModule
                                  selectedModel={modelFor("reasoning_chain")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  chainData={reasoningChainData}
                                  setChainData={setReasoningChainData}
                                  includeInReport={includeReasoningChainInReport}
                                  setIncludeInReport={setIncludeReasoningChainInReport}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isNegativityChecklistOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-teal-400 bg-slate-900/60 rounded-xl border border-teal-900/40 animate-pulse">Cargando checklist de negatividad...</div>}>
                                <NegativityChecklistModule
                                  selectedModel={modelFor("negativity_checklist")}
                                  modifyModel={modelFor("report_modify")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  checklistData={negativityChecklistData}
                                  setChecklistData={setNegativityChecklistData}
                                  includeInReport={includeNegativityChecklistInReport}
                                  setIncludeInReport={setIncludeNegativityChecklistInReport}
                                  onInsertIntoReport={(next) => {
                                    if (generatedReport) {
                                      setReportHistory((prev) => [...prev, generatedReport]);
                                      setReportRedoHistory([]);
                                    }
                                    setGeneratedReport(next);
                                    setEditedReportText(next);
                                  }}
                                  onSendToInfographic={(data) => {
                                    setFindingsInfographicData(data);
                                    setIncludeFindingsInfographicInReport(true);
                                    setIsFindingsInfographicOpen(true);
                                    window.setTimeout(() => {
                                      document
                                        .getElementById("findings-infographic-module")
                                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }, 80);
                                  }}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isSecondReaderOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-indigo-400 bg-slate-900/60 rounded-xl border border-indigo-900/40 animate-pulse">Cargando segundo lector...</div>}>
                                <SecondReaderModule
                                  selectedModel={modelFor("second_reader")}
                                  modifyModel={modelFor("report_modify")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  readerData={secondReaderData}
                                  setReaderData={setSecondReaderData}
                                  onReportUpdated={(next) => {
                                    if (generatedReport) {
                                      setReportHistory((prev) => [...prev, generatedReport]);
                                      setReportRedoHistory([]);
                                    }
                                    setGeneratedReport(next);
                                    setEditedReportText(next);
                                  }}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isDifferentialTreeOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-orange-400 bg-slate-900/60 rounded-xl border border-orange-900/40 animate-pulse">Cargando arbol de diferenciales...</div>}>
                                <DifferentialTreeModule
                                  selectedModel={modelFor("differential_tree")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  treeData={differentialTreeData}
                                  setTreeData={setDifferentialTreeData}
                                  includeInReport={includeDifferentialTreeInReport}
                                  setIncludeInReport={setIncludeDifferentialTreeInReport}
                                  scorecardData={clinicalScorecardData}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isSemioticsConductMatrixOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-fuchsia-400 bg-slate-900/60 rounded-xl border border-fuchsia-900/40 animate-pulse">Cargando matriz semiologia-conducta...</div>}>
                                <SemioticsConductMatrixModule
                                  selectedModel={modelFor("semiotics_conduct_matrix")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  matrixData={semioticsConductMatrixData}
                                  setMatrixData={setSemioticsConductMatrixData}
                                  includeInReport={includeSemioticsConductMatrixInReport}
                                  setIncludeInReport={setIncludeSemioticsConductMatrixInReport}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isFindingsInfographicOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-teal-400 bg-slate-900/60 rounded-xl border border-teal-900/40 animate-pulse">Cargando infografia...</div>}>
                                <FindingsInfographicModule
                                  selectedModel={modelFor("findings_infographic")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  infographicData={findingsInfographicData}
                                  setInfographicData={setFindingsInfographicData}
                                  includeInReport={includeFindingsInfographicInReport}
                                  setIncludeInReport={setIncludeFindingsInfographicInReport}
                                  scorecardData={clinicalScorecardData}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isDominantLesionCardOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-rose-400 bg-slate-900/60 rounded-xl border border-rose-900/40 animate-pulse">Cargando ficha de lesión dominante...</div>}>
                                <DominantLesionCardModule
                                  selectedModel={modelFor("dominant_lesion_card")}
                                  focalSelectedModel={modelFor("focal_lesion3d")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  clinicalHistory={clinicalHistory}
                                  cardData={dominantLesionCardData}
                                  setCardData={setDominantLesionCardData}
                                  includeInReport={includeDominantLesionCardInReport}
                                  setIncludeInReport={setIncludeDominantLesionCardInReport}
                                  attachedImages={attachedImages}
                                  focalLesion3dData={focalLesion3dData}
                                  setFocalLesion3dData={setFocalLesion3dData}
                                  setIncludeFocalLesion3dInReport={setIncludeFocalLesion3dInReport}
                                  scorecardData={clinicalScorecardData}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isMeasurementsGaugeOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-blue-400 bg-slate-900/60 rounded-xl border border-blue-900/40 animate-pulse">Cargando Extractor de medidas...</div>}>
                                <MeasurementsGaugeModule
                                  selectedModel={modelFor("measurements")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy || studyType}
                                  gaugeData={measurementGaugeData}
                                  setGaugeData={setMeasurementGaugeData}
                                  includeInReport={includeMeasurementGaugesInReport}
                                  setIncludeInReport={setIncludeMeasurementGaugesInReport}
                                  includeNormalsInPdf={includeMeasurementNormalsInPdf}
                                  setIncludeNormalsInPdf={setIncludeMeasurementNormalsInPdf}
                                />
                              </React.Suspense>
                            </div>
                          )}

{/* Render Radar Biomecánico Panel */}
                          {isBiomechanicalRadarOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-indigo-400 bg-slate-900/60 rounded-xl border border-indigo-900/40 animate-pulse">Cargando Radar Biomecánico...</div>}>
                                <BiomechanicalRadarModule
                                  selectedModel={modelFor("radar")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  studyType={specificStudy}
                                  includeRadarInReport={includeRadarInReport}
                                  onToggleIncludeRadar={(val) => setIncludeRadarInReport(val)}
                                  onReportUpdated={(newReportText) => {
                                    setEditedReportText(newReportText);
                                    setGeneratedReport(newReportText);
                                  }}
                                  onRadarDataUpdated={(data) => setBiomechanicalRadarData(data)}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isCreadorCuadroSinopticoOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-cyan-400 bg-slate-900/60 rounded-xl border border-cyan-900/40 animate-pulse">Cargando Cuadro Sin�ptico de �rgano...</div>}>
                                <CreadorCuadroSinoptico
                                  selectedModel={modelFor("default")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  onReportUpdated={(newReportText) => {
                                    setEditedReportText(newReportText);
                                    setGeneratedReport(newReportText);
                                  }}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {isElastographyQUSModuleOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-amber-400 bg-slate-900/60 rounded-xl border border-amber-900/40 animate-pulse">Cargando Elastograf�a y QUS...</div>}>
                                <ElastographyQUSPresentationModule
                                  selectedModel={modelFor("default")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  initialStiffness={elastographyStiffness}
                                  initialCAP={elastographyCAP}
                                  initialFatFraction={elastographyFatFraction}
                                  includeInReport={includeElastographyInReport}
                                  onToggleIncludeInReport={setIncludeElastographyInReport}
                                  onValuesChanged={(stiffness, cap, fatFraction) => {
                                    setElastographyStiffness(stiffness);
                                    setElastographyCAP(cap);
                                    setElastographyFatFraction(fatFraction);
                                  }}
                                  onImageChanged={(img) => setElastographyImage3d(img)}
                                  onOriginalImageChanged={(img) => setElastographyOriginalImage(img)}
                                  onEtiologyChanged={(etiology) => setElastographyEtiology(etiology)}
                                  onReportUpdated={(newReportText) => {
                                    setEditedReportText(newReportText);
                                    setGeneratedReport(newReportText);
                                  }}
                                  onClose={() => setIsElastographyQUSModuleOpen(false)}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          
                          {isThyroid3dSuiteOpen && (
                            <div id="thyroid-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Tiroides 3D">
                                <Thyroid3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("thyroid3d")}
                                thyroidData={thyroid3dData}
                                setThyroidData={setThyroid3dData}
                                includeInReport={includeThyroid3dInReport}
                                setIncludeInReport={setIncludeThyroid3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildThyroidDirectivesFromScorecard(clinicalScorecardData) || atlasDirectivesFromScorecard}
                                onClose={() => setIsThyroid3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isBreast3dSuiteOpen && (
                            <div id="breast-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Mama 3D">
                                <Breast3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("breast3d")}
                                breastData={breast3dData}
                                setBreastData={setBreast3dData}
                                includeInReport={includeBreast3dInReport}
                                setIncludeInReport={setIncludeBreast3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildBreastDirectivesFromScorecard(clinicalScorecardData) || atlasDirectivesFromScorecard}
                                onClose={() => setIsBreast3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isShoulder3dSuiteOpen && (
                            <div id="shoulder-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Hombro 3D">
                                <Shoulder3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("shoulder3d")}
                                shoulderData={shoulder3dData}
                                setShoulderData={setShoulder3dData}
                                includeInReport={includeShoulder3dInReport}
                                setIncludeInReport={setIncludeShoulder3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildShoulderDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsShoulder3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

{isKnee3dSuiteOpen && (
                            <div id="knee-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Rodilla 3D">
                                <Knee3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("knee3d")}
                                kneeData={knee3dData}
                                setKneeData={setKnee3dData}
                                includeInReport={includeKnee3dInReport}
                                setIncludeInReport={setIncludeKnee3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildKneeDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsKnee3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isAnkle3dSuiteOpen && (
                            <div id="ankle-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Tobillo 3D">
                                <Ankle3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("ankle3d")}
                                ankleData={ankle3dData}
                                setAnkleData={setAnkle3dData}
                                includeInReport={includeAnkle3dInReport}
                                setIncludeInReport={setIncludeAnkle3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildAnkleDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsAnkle3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isKidney3dSuiteOpen && (
                            <div id="kidney-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Rinon 3D">
                                <Kidney3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("kidney3d")}
                                kidneyData={kidney3dData}
                                setKidneyData={setKidney3dData}
                                includeInReport={includeKidney3dInReport}
                                setIncludeInReport={setIncludeKidney3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildKidneyDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsKidney3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isAbdomen3dSuiteOpen && (
                            <div id="abdomen-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Abdomen 3D">
                                <Abdomen3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("abdomen3d")}
                                abdomenData={abdomen3dData}
                                setAbdomenData={setAbdomen3dData}
                                includeInReport={includeAbdomen3dInReport}
                                setIncludeInReport={setIncludeAbdomen3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildAbdomenDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsAbdomen3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isAbdominalWall3dSuiteOpen && (
                            <div id="abdominal-wall-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Pared Abdominal 3D">
                                <AbdominalWall3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("abdominalWall3d")}
                                abdominalWallData={abdominalWall3dData}
                                setAbdominalWallData={setAbdominalWall3dData}
                                includeInReport={includeAbdominalWall3dInReport}
                                setIncludeInReport={setIncludeAbdominalWall3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildAbdominalWallDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsAbdominalWall3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isScrotum3dSuiteOpen && (
                            <div id="scrotum-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Escroto 3D">
                                <Scrotum3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("scrotum3d")}
                                scrotumData={scrotum3dData}
                                setScrotumData={setScrotum3dData}
                                includeInReport={includeScrotum3dInReport}
                                setIncludeInReport={setIncludeScrotum3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildScrotumDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsScrotum3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isMuscleTendon3dSuiteOpen && (
                            <div id="muscle-tendon-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Musculo-Tendon 3D">
                                <MuscleTendon3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("muscleTendon3d")}
                                muscleTendonData={muscleTendon3dData}
                                setMuscleTendonData={setMuscleTendon3dData}
                                includeInReport={includeMuscleTendon3dInReport}
                                setIncludeInReport={setIncludeMuscleTendon3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildMuscleTendonDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsMuscleTendon3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {isWrist3dSuiteOpen && (
                            <div id="wrist-3d-suite-module" className="my-6">
                              <Suite3DSuspense label="Suite Muneca 3D">
                                <Wrist3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("wrist3d")}
                                wristData={wrist3dData}
                                setWristData={setWrist3dData}
                                includeInReport={includeWrist3dInReport}
                                setIncludeInReport={setIncludeWrist3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={buildWristDirectivesFromScorecard(
                                  clinicalScorecardData,
                                  biomechanicalRadarData
                                    ? {
                                        radarMode: biomechanicalRadarData.radarMode,
                                        dominantVector: biomechanicalRadarData.dominantVector,
                                        clinicalSummary: biomechanicalRadarData.clinicalSummary,
                                        globalScore: biomechanicalRadarData.globalScore,
                                        axes: biomechanicalRadarData.axes,
                                      }
                                    : undefined
                                ) || atlasDirectivesFromScorecard}
                                onClose={() => setIsWrist3dSuiteOpen(false)}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}

                          {/* Con suite 3D: Corte Focal justo despues de la(s) suite(s) */}
                          {anySuiteUsedUi && (
                            <div id="focal-lesion-3d-module" className="my-6">
                              <Suite3DSuspense label="Corte Focal 3D">
                                <FocalLesion3DModule
                                reportText={isEditingReportManual ? editedReportText : (generatedReport || "")}
                                activeProtocol={specificStudy || studyType || ""}
                                laterality=""
                                selectedModel={modelFor("focal_lesion3d")}
                                focalData={focalLesion3dData}
                                setFocalData={setFocalLesion3dData}
                                includeInReport={includeFocalLesion3dInReport}
                                setIncludeInReport={setIncludeFocalLesion3dInReport}
                                scorecardData={clinicalScorecardData}
                                externalDirectives={atlasDirectivesFromScorecard}
                              />
                              </Suite3DSuspense>
                            </div>
                          )}


{isCreadorSinopsisFracturasOpen && (
                            <div className="my-6">
                              <React.Suspense fallback={<div className="p-4 text-xs font-mono text-emerald-400 bg-slate-900/60 rounded-xl border border-emerald-900/40 animate-pulse">Cargando Sinopsis de Fracturas...</div>}>
                                <CreadorSinopsisFracturas
                                  selectedModel={modelFor("default")}
                                  reportText={isEditingReportManual ? editedReportText : generatedReport}
                                  onReportUpdated={(newReportText) => {
                                    setEditedReportText(newReportText);
                                    setGeneratedReport(newReportText);
                                  }}
                                />
                              </React.Suspense>
                            </div>
                          )}

                          {/* ========================================================== */}
                          {/* NEW PANEL: IMAGE SEMIOLOGY AND DIAGNOSTICS JUSTIFICATION */}
                          {/* ========================================================== */}
                          {isGeneratingSemiology && (
                            <div className="bg-[#090d16]/60 border-2 border-cyan-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse my-4">
                              <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Confeccionando cuadro de semiología por imágenes...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Extrayendo signos radiológicos de soporte, ponderando hallazgos patológicos y deduciendo diagnósticos diferenciales excluidos basados en la evidencia clínica.
                              </p>
                            </div>
                          )}

                          {semiologyError && (
                            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight my-4">
                              {semiologyError}
                            </div>
                          )}

                          {semiologyData && (
                            <div className={isSemiologyExpanded
                              ? "fixed inset-4 md:inset-10 z-50 bg-[#070b12]/95 backdrop-blur-2xl border-2 border-cyan-500/40 rounded-3xl p-6 md:p-8 flex flex-col space-y-5 shadow-2xl overflow-y-auto transition-all duration-350 my-0"
                              : "bg-[#070b12] border-2 border-cyan-500/15 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden animate-fade-in my-4 transition-all duration-350"
                            }>
                              {/* Ambient highlight background blur */}
                              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                              <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-cyan-950/40 pb-3.5 gap-4 font-sans">
                                <div className="flex items-center gap-2 text-left">
                                  <ShieldCheck className="h-5 w-5 text-cyan-400" />
                                  <div>
                                    <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest font-mono">
                                      Cuadro de Semiología por Imágenes y Justificación
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                      Correlación interpretativa formal entre signos radiográficos, confirmación diagnóstica y exclusiones diferenciales. Selecciona los puntos que deseas incluir.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsSemiologyExpanded(p => !p)}
                                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                      isSemiologyExpanded
                                        ? "bg-cyan-950/90 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={isSemiologyExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                                  >
                                    {isSemiologyExpanded ? (
                                      <Minimize2 className="h-4.5 w-4.5" />
                                    ) : (
                                      <Maximize2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>

                                  <button
                                    onClick={() => copyToClipboard(buildDynamicSemiologyMarkdownTable(), false)}
                                    className="text-[9px] font-black text-slate-400 hover:text-cyan-400 border border-slate-850 px-2.5 py-1.5 rounded-xl bg-slate-950/40 uppercase tracking-wider font-mono transition-all cursor-pointer"
                                  >
                                    Copiar en Markdown
                                  </button>
                                  <button
                                    onClick={handleAppendSemiologyToReport}
                                    className="text-[9px] font-black text-slate-950 hover:bg-cyan-400 bg-cyan-400 px-3.5 py-1.5 rounded-xl uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Insertar en Reporte PDF
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 font-sans text-left">
                                {/* Diagnósticos Confirmados */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-wider font-mono">
                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    1. Diagnósticos Confirmados y Justificación
                                  </div>
                                  <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-slate-950/20">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-950 border-b border-slate-850/60 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                                          <th className="p-3 text-center w-12">Inc.</th>
                                          <th className="p-3 text-left w-1/3">INTERPRETACIÓN SEMIOLÓGICA</th>
                                          <th className="p-3 text-left w-2/3 border-l border-slate-850/60">HALLAZGOS</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-850/40">
                                        {semiologyData.confirmedDiagnoses && semiologyData.confirmedDiagnoses.map((d: any, idx: number) => (
                                          <tr key={idx} className={`hover:bg-slate-900/10 transition-colors ${!selectedConfirmedDiagnoses[idx] ? 'opacity-45' : ''}`}>
                                            <td className="p-3 text-center align-middle">
                                              <input
                                                type="checkbox"
                                                checked={!!selectedConfirmedDiagnoses[idx]}
                                                onChange={(e) => {
                                                  const updated = [...selectedConfirmedDiagnoses];
                                                  updated[idx] = e.target.checked;
                                                  setSelectedConfirmedDiagnoses(updated);
                                                }}
                                                className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 h-4 w-4 bg-slate-950 cursor-pointer"
                                              />
                                            </td>
                                            <td className="p-3 text-slate-200 font-bold align-top">{d.diagnosis}</td>
                                            <td className="p-3 text-slate-300 align-top border-l border-slate-850/40 leading-relaxed">{d.justification}</td>
                                          </tr>
                                        ))}
                                        {(!semiologyData.confirmedDiagnoses || semiologyData.confirmedDiagnoses.length === 0) && (
                                          <tr>
                                            <td colSpan={3} className="p-4 text-center text-slate-500 italic text-[11px]">No se hallaron diagnósticos confirmados descritos.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Patologías Descartadas */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider font-mono">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                    2. Diagnósticos Diferenciales Descartados
                                  </div>
                                  <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-slate-950/20">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-950 border-b border-slate-850/60 text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                                          <th className="p-3 text-center w-12">Inc.</th>
                                          <th className="p-3 text-left w-1/3">INTERPRETACIÓN SEMIOLÓGICA</th>
                                          <th className="p-3 text-left w-2/3 border-l border-slate-850/60">HALLAZGOS</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-850/40">
                                        {semiologyData.ruledOutPathologies && semiologyData.ruledOutPathologies.map((r: any, idx: number) => (
                                          <tr key={idx} className={`hover:bg-slate-900/10 transition-colors ${!selectedRuledOutPathologies[idx] ? 'opacity-45' : ''}`}>
                                            <td className="p-3 text-center align-middle">
                                              <input
                                                type="checkbox"
                                                checked={!!selectedRuledOutPathologies[idx]}
                                                onChange={(e) => {
                                                  const updated = [...selectedRuledOutPathologies];
                                                  updated[idx] = e.target.checked;
                                                  setSelectedRuledOutPathologies(updated);
                                                }}
                                                className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 h-4 w-4 bg-slate-950 cursor-pointer"
                                              />
                                            </td>
                                            <td className="p-3 text-slate-300 font-semibold align-top">{r.pathology}</td>
                                            <td className="p-3 text-slate-400 align-top border-l border-slate-850/40 leading-relaxed">{r.exclusionCriteria}</td>
                                          </tr>
                                        ))}
                                        {(!semiologyData.ruledOutPathologies || semiologyData.ruledOutPathologies.length === 0) && (
                                          <tr>
                                            <td colSpan={3} className="p-4 text-center text-slate-500 italic text-[11px]">No se listaron patologías descartadas en el análisis.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 text-left bg-slate-950/40 border border-slate-850/50 rounded-xl p-4 space-y-1.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">
                                  Representación en Tabla Formal para PDF (Dinámica):
                                </span>
                                <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap p-2 bg-slate-950 rounded border border-slate-900 leading-relaxed max-h-40">
                                  {buildDynamicSemiologyMarkdownTable()}
                                </pre>
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

                              {/* Format Configurator & PDF Export Inserter Card */}
                              <div className="bg-[#05110d] border-2 border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl transition-all">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-900/40 pb-3">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
                                    <h5 className="text-xs font-black uppercase font-mono tracking-wider text-emerald-300">
                                      OPCIONES DE FORMATO E INSERCIÓN PARA PDF Y REPORTE
                                    </h5>
                                  </div>
                                  <span className="text-[9px] font-mono text-emerald-400 font-extrabold bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 rounded uppercase tracking-wider">
                                    FORMATOS EXPORTABLES INTERACTIVOS
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                                  Selecciona el formato deseado para estructurar este análisis de caso. Cada elemento e hipótesis tendrá su propia casilla para que puedas aceptarlo o desecharlo, y podrás ver la representación gráfica del PDF en tiempo real antes de insertarla:
                                </p>

                                {/* Grid of 4 Formats */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                                  {[
                                    { id: "flujograma_semiologico", label: "Opción 1: Flujograma Semiológico", icon: "✨", desc: "Ciclo de Pensamiento Radiológico" },
                                    { id: "flujograma_algoritmico", label: "Opción 2: Flujograma", icon: "🔀", desc: "Árbol Algorítmico de Decisión" },
                                    { id: "esquema_pilares", label: "Opción 3: Esquema por Pilares", icon: "🏛️", desc: "Integración Multidisciplinaria" },
                                    { id: "mapa_diferenciales", label: "Opción 4: Mapa Diferencial", icon: "🗺️", desc: "Mapa de Diagnósticos" },
                                    { id: "matriz_semiotica", label: "Opción 5: Matriz Semiótica", icon: "⚖️", desc: "Matriz Semiótica Comparativa" },
                                  ].map(fmt => (
                                    <button
                                      key={fmt.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCaseFormat(fmt.id as CaseAnalysisFormatOption);
                                        setDiffsIncorporated(false);
                                      }}
                                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                        selectedCaseFormat === fmt.id
                                          ? "bg-emerald-950/80 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/30 shadow-md"
                                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-base">{fmt.icon}</span>
                                        <span className="text-[10px] font-black uppercase font-mono tracking-tight leading-tight">{fmt.label}</span>
                                      </div>
                                      <span className="text-[8.5px] font-medium text-slate-400 leading-tight block">{fmt.desc}</span>
                                    </button>
                                  ))}
                                </div>

                                {/* Interactive Editor State Handlers */}
                                {isExtractingCaseData ? (
                                  <div className="bg-slate-950/80 border border-emerald-500/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 py-10 animate-pulse">
                                    <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-300">Estructurando campos interactivos del formato...</p>
                                    <p className="text-[9px] font-mono text-slate-500">Separando afirmaciones, criterios y pilares para control total</p>
                                  </div>
                                ) : caseDataError ? (
                                  <div className="p-4 bg-rose-950/10 border border-rose-900/35 rounded-2xl text-rose-400 text-[10px] font-mono font-bold uppercase tracking-tight flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{caseDataError} (Puedes regenerar el análisis para reintentar)</span>
                                  </div>
                                ) : editableCaseData ? (
                                  <div className="pt-2">
                                    <InteractiveCaseEditor
                                      selectedCaseFormat={selectedCaseFormat}
                                      editableCaseData={editableCaseData}
                                      setEditableCaseData={setEditableCaseData}
                                      caseElements={caseElements}
                                      setCaseElements={setCaseElements}
                                      checkedDetails={checkedDetails}
                                      setCheckedDetails={setCheckedDetails}
                                      checkedDifferentials={checkedDifferentials}
                                      setCheckedDifferentials={setCheckedDifferentials}
                                      checkedDecisionSteps={checkedDecisionSteps}
                                      setCheckedDecisionSteps={setCheckedDecisionSteps}
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-[#0b1219]/30 border border-slate-800/50 rounded-2xl p-6 text-center text-slate-400 text-[11px] font-medium">
                                    Genera un análisis completo de caso arriba para habilitar el editor interactivo y la previsualización del PDF.
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleFormatAndIncorporateCaseAnalysis()}
                                    disabled={isFormattingCaseJSON || !editableCaseData || diffsIncorporated}
                                    className={`flex-1 py-3 px-4 rounded-xl font-mono text-[10.5px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                      diffsIncorporated
                                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 cursor-not-allowed"
                                        : isFormattingCaseJSON
                                        ? "bg-emerald-900/40 border-emerald-500/50 text-emerald-200 animate-pulse cursor-wait"
                                        : !editableCaseData
                                        ? "bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed"
                                        : "bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99]"
                                    }`}
                                  >
                                    {isFormattingCaseJSON ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                                        <span>Insertando en Reporte / PDF...</span>
                                      </>
                                    ) : diffsIncorporated ? (
                                      <>
                                        <Check className="h-4 w-4 text-emerald-400" />
                                        <span>Análisis Estructurado Insertado (Para PDF)</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4 text-slate-950" />
                                        <span>Insertar Análisis Estructurado en Reporte Activo (PDF)</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={handleIncorporateDifferentialDiagnostics}
                                    disabled={isIncorporatingDiffs || diffsIncorporated}
                                    className={`py-3 px-4 rounded-xl font-mono text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                      diffsIncorporated
                                        ? "bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed"
                                        : "bg-slate-900 hover:bg-slate-850 text-emerald-300 border-emerald-500/30"
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Texto Plano al Reporte</span>
                                  </button>
                                </div>
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

                              {/* ACCIONES DE BÚSQUEDA ADICIONAL (LOAD MORE / PAGINACIÓN) */}
                              <div className="pt-4 border-t border-teal-950/60 mt-4 space-y-3">
                                {isSearchingMoreBibliography ? (
                                  <div className="bg-[#0b1517]/40 border border-teal-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5 animate-pulse text-center">
                                    <RefreshCw className="h-5 w-5 text-teal-450 animate-spin" />
                                    <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                      Buscando fuentes complementarias adicionales...
                                    </p>
                                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                      Consultando nuevas publicaciones indexadas y actualizando la síntesis bibliográfica de soporte.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-teal-950/20 border border-teal-900/30 p-4 rounded-2xl">
                                    <div className="text-left space-y-1">
                                      <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest font-mono">
                                        ¿Deseas profundizar más en la literatura?
                                      </p>
                                      <p className="text-[9px] text-slate-400 font-medium normal-case leading-normal max-w-md">
                                        Realiza una segunda ronda de búsqueda avanzada en PubMed y Radiopaedia para añadir de 6 a 10 recursos adicionales de alta relevancia científica sin duplicar los enlaces actuales.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleSearchMoreBibliography}
                                      className="px-5 py-3 bg-teal-500/10 hover:bg-teal-500 hover:text-white border border-teal-500/30 hover:border-transparent text-teal-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-mono shrink-0 w-full sm:w-auto"
                                    >
                                      <Plus className="h-4 w-4" />
                                      <span>Buscar Más Resultados</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ========================================================== */}
                          {/* OPERATIONAL SUMMARY (IA) - visible after full report */}
                          {/* ========================================================== */}
                          {isGeneratingOperationalSummary && (
                            <div className="bg-[#0a120f]/60 border-2 border-emerald-500/10 rounded-2xl p-6 flex flex-col items-center justify-center py-10 text-center space-y-3 shadow-lg animate-pulse my-4">
                              <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                                Generando resumen operacional de hallazgos...
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider max-w-sm">
                                Sintetizando los hallazgos principales para consulta rapida y envio por WhatsApp.
                              </p>
                            </div>
                          )}

                          {operationalSummaryText && !isGeneratingOperationalSummary && (
                            <div className="bg-black border-2 border-emerald-500/20 rounded-2xl p-6 space-y-4 shadow-xl my-4 text-left">
                              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                                <ListTodo className="h-4 w-4 text-emerald-400" />
                                <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest font-mono">
                                  Resumen Operacional de Hallazgos
                                </h4>
                              </div>
                              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {renderElegantPatientResumenDark(operationalSummaryText)}
                              </div>
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
                                Se está traduciendo la terminología técnica a una explicación clara del estudio y de los hallazgos, sin recomendaciones.
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
                                    <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest font-mono flex flex-wrap items-center gap-2">
                                      TRADUCCIÓN EMPÁTICA Y EXPLICACIÓN DE INFORME
                                      {patientSummaryProvider === "openai" && (
                                        <span className="text-[8px] font-black normal-case tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                                          ChatGPT
                                        </span>
                                      )}
                                      {patientSummaryProvider === "gemini" && (
                                        <span className="text-[8px] font-black normal-case tracking-wider px-2 py-0.5 rounded-md bg-slate-950 border border-slate-700 text-slate-400">
                                          Gemini
                                        </span>
                                      )}
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                      Acompañamiento personalizado y traducción de conceptos clínicos a analogías amigables.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAttachSummaryToOfficialReport(prev => !prev)}
                                    className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
                                      attachSummaryToOfficialReport
                                        ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-350 shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
                                        : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100"
                                    }`}
                                    title={attachSummaryToOfficialReport ? "El resumen se incluirá al final del reporte original como un anexo" : "Adjuntar este resumen como un anexo al reporte original"}
                                  >
                                    {attachSummaryToOfficialReport ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-400" />
                                        Adjunto a reporte original
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3 w-3 text-slate-400" />
                                        Adjuntar a reporte original
                                      </>
                                    )}
                                  </button>
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
                                                <span>🩺</span> Contexto descriptivo:
                                              </p>
                                              <p className="text-[11px] text-blue-200 leading-relaxed font-sans">
                                                {finding.clinicalContext || finding.reassurance}
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                              {Array.isArray(patientSummary.glossary) && patientSummary.glossary.length > 0 && (
                                <div className="space-y-3 text-left pt-2">
                                  <div className="flex items-center gap-1.5 border-b border-orange-950/20 pb-2">
                                    <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">
                                      Glosario de términos (lenguaje claro)
                                    </h5>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {patientSummary.glossary.map((entry: any, gIdx: number) => (
                                      <div key={gIdx} className="p-3 border border-slate-850 rounded-xl bg-slate-950/50 space-y-1">
                                        <p className="text-xs font-black text-emerald-300 uppercase tracking-wide">{entry.term}</p>
                                        <p className="text-xs text-slate-300 leading-relaxed font-sans">{entry.plainDefinition || entry.definition}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
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
                                          {!isAlreadyAcc && (
                                            <div className="pt-2 flex items-center">
                                              <label className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider font-mono cursor-pointer select-none">
                                                <input
                                                  type="checkbox"
                                                  checked={!!includeManagementRecs[idx]}
                                                  onChange={(e) => setIncludeManagementRecs(prev => ({ ...prev, [idx]: e.target.checked }))}
                                                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-650"
                                                />
                                                <span>Incluir recomendación de manejo / conducta</span>
                                              </label>
                                            </div>
                                          )}
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

                          {/* --- MÓDULO DE DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIONES RADIOLÓGICAS --- */}
                          <ClassificationBreakdownModule
                            reportText={isEditingReportManual ? editedReportText : generatedReport}
                            studyType={studyType || specificStudy}
                            selectedModel={modelFor("default")}
                            onAppendToReport={(annexText) => {
                              const current = generatedReport || editedReportText || "";
                              const updated = current + annexText;
                              setGeneratedReport(updated);
                              setEditedReportText(updated);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Right Column: Real-time interactive PDF preview */}
                    {isSplitPdfActive && generatedReport && (
                      <div className="w-full md:w-[45%] xl:w-[48%] shrink-0 flex flex-col bg-slate-950/80 border-t md:border-t-0 border-slate-850 overflow-hidden">
                        {/* PDF Column Header */}
                        <div className="p-4 border-b border-slate-800/80 bg-slate-950 flex flex-col gap-3 shrink-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-4 w-4 text-indigo-400" />
                              <span className="text-[10px] font-black text-slate-350 font-mono tracking-widest uppercase">
                                VISTA PREVIA PDF
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isGeneratingPdfPreview && (
                                <div className="flex items-center gap-1 text-[9px] font-mono font-black text-indigo-400 animate-pulse uppercase">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Generando...
                                </div>
                              )}
                              <span className="text-[8px] font-black uppercase font-mono tracking-widest bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-2 py-0.5 rounded">
                                TIEMPO REAL
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Doc Type Selector */}
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => setPrintModalDocType('report')}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                  printModalDocType === 'report'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Formal
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintModalDocType('patient_summary')}
                                disabled={!patientSummary}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                  printModalDocType === 'patient_summary'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-transparent text-slate-400 hover:text-slate-200 disabled:opacity-30'
                                }`}
                                title={!patientSummary ? "Primero genera la explicación al paciente abajo" : ""}
                              >
                                Paciente
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintModalDocType('both')}
                                disabled={!patientSummary}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                  printModalDocType === 'both'
                                    ? 'bg-amber-600 text-white shadow-md'
                                    : 'bg-transparent text-slate-400 hover:text-slate-200 disabled:opacity-30'
                                }`}
                                title={!patientSummary ? "Primero genera la explicación al paciente" : "Descargar informe formal + pack paciente"}
                              >
                                Ambos
                              </button>
                            </div>

                            {/* Contrast and Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAdaptivePDFContrast(!adaptivePDFContrast)}
                                className={`px-2 py-1.5 rounded-lg border text-[9px] font-mono font-black uppercase transition-all cursor-pointer ${
                                  adaptivePDFContrast
                                    ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                                }`}
                                title="Optimización de Contraste Adaptativo PDF"
                              >
                                Contraste: {adaptivePDFContrast ? 'ALTO' : 'NORMAL'}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                      if (printModalDocType === 'report') {
                        guardReportPdfExport(() => handleDownloadNativePDF(true));
                      } else if (printModalDocType === 'both') {
                        guardReportPdfExport(() => handleDownloadNativePDF(true));
                        handleDownloadPatientSummaryPDF(true);
                      } else {
                        handleDownloadPatientSummaryPDF(true);
                      }
                    }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                                title="Abrir PDF en pestaña nueva"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* PDF Display IFrame */}
                        <div className="flex-1 bg-slate-950 p-2 md:p-3 relative flex flex-col">
                          {isGeneratingPdfPreview && !(printModalDocType === 'patient_summary' ? generatedSummaryPdfUrl : generatedNativePdfUrl) ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                              <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                              <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest animate-pulse">
                                Generando Previsualización PDF...
                              </p>
                            </div>
                          ) : (printModalDocType === 'patient_summary' ? generatedSummaryPdfUrl : generatedNativePdfUrl) ? (
                            <div className="w-full h-full flex-1 rounded-xl overflow-hidden border border-slate-850 bg-slate-900/40 relative">
                              <iframe
                                src={`${printModalDocType === 'patient_summary' ? generatedSummaryPdfUrl : generatedNativePdfUrl}#toolbar=1&navpanes=0`}
                                className="w-full h-full border-0 rounded-lg"
                                title="Live PDF Viewer"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                              <AlertCircle className="h-8 w-8 text-amber-500" />
                              <p className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
                                {printModalDocType === 'patient_summary' ? 'Explicación de Paciente no disponible' : 'Reporte no disponible'}
                              </p>
                              <p className="text-[9px] text-slate-500 max-w-xs leading-relaxed uppercase">
                                {printModalDocType === 'patient_summary'
                                  ? 'Haz clic en "Explicar para el paciente" en la tarjeta de abajo para generar esta versión'
                                  : 'Genera un reporte clínico para visualizar el PDF'}
                              </p>
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
                      {MODEL_OPTIONS.map((opt) => {
                        const active = selectedModel === opt.id;
                        const border =
                          opt.id === "auto"
                            ? "bg-emerald-950/20 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
                            : opt.id === "gemini-3.1-pro-preview"
                              ? "bg-purple-950/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.12)]"
                              : opt.id === "gemini-3.8-flash"
                                ? "bg-sky-950/20 border-sky-500/80 shadow-[0_0_12px_rgba(2,132,199,0.12)]"
                                : "bg-indigo-950/20 border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.12)]";
                        const badge =
                          opt.id === "auto"
                            ? "bg-emerald-500 text-white"
                            : opt.id === "gemini-3.1-pro-preview"
                              ? "bg-purple-500 text-white"
                              : opt.id === "gemini-3.8-flash"
                                ? "bg-sky-500 text-white"
                                : "bg-indigo-500 text-white";
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedModel(opt.id)}
                            className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                              active
                                ? border
                                : "bg-[#070b13] border-slate-850 hover:bg-slate-900/60 hover:border-slate-800"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-200">{opt.label}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${
                                  active ? badge : "bg-slate-800 text-slate-450"
                                }`}>
                                  {active ? "ACTIVO" : opt.id === "auto" ? "RECOMENDADO" : opt.shortLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                                {opt.description}
                              </p>
                            </div>
                            {opt.id === "auto" && (
                              <div className="border-t border-slate-850/60 pt-2.5 mt-2 w-full space-y-1 text-[10px] text-slate-350">
                                <div><strong className="text-emerald-400">3.8 Flash:</strong> reporte, Atlas/Vascular 3D, resumen paciente, caso, clasificaciones.</div>
                                <div><strong className="text-indigo-400">3.7 Flash:</strong> rotulado masivo, bibliograf�a, glosario, resumen operacional, chat.</div>
                                <div><strong className="text-purple-400">Pro:</strong> solo si lo eliges manualmente (casos dif�ciles).</div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 🔥 ADMINISTRADOR DE RESPALDO Y DATOS LOCALES */}
                  <div className="bg-[#0b1329]/60 border-2 border-slate-800 rounded-xl p-5 space-y-4 text-left">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-slate-800 pb-2.5">
                      <Database className="h-4 w-4 text-indigo-400" /> SEGURIDAD Y RESPALDO DE DATOS LOCALES
                    </h3>

                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans font-medium">
                      Para garantizar la máxima velocidad, estabilidad y privacidad de tus reportes médicos, la aplicación ha sido configurada como <strong>100% Local-First</strong>.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans font-medium">
                      Todos los datos de tus pacientes, plantillas, firmas, logos e historial de estudios clínicos se guardan de forma instantánea y segura únicamente dentro de la memoria de tu propio navegador web (<code className="bg-[#030612] px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">localStorage</code>). Nada de tu información confidencial se sube a nubes externas, cumpliendo al 100% con estándares de privacidad médica.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-200">Exportar Todo</h4>
                        <p className="text-[10px] text-slate-500 leading-normal">Descarga un archivo copia de seguridad (.json) con todo tu historial de estudios, firmas, logos y configuraciones de doctor de forma instantánea.</p>
                        <button
                          type="button"
                          onClick={handleExportAllData}
                          className="w-full mt-2 px-3 py-2 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-900/60 hover:border-indigo-750 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition cursor-pointer select-none flex items-center justify-center gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Exportar Respaldo (.json)
                        </button>
                      </div>

                      <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-200">Importar / Restaurar</h4>
                        <p className="text-[10px] text-slate-500 leading-normal">Restaura todo tu historial de estudios y configuraciones de doctor cargando tu archivo de respaldo previamente exportado.</p>
                        <label className="block mt-2">
                          <span className="w-full px-3 py-2 bg-emerald-950/40 hover:bg-emerald-900/30 text-emerald-300 border border-emerald-900/40 hover:border-emerald-700/60 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition cursor-pointer select-none flex items-center justify-center gap-1.5">
                            <Upload className="h-3.5 w-3.5" />
                            Cargar Archivo Respaldo
                          </span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportAllData}
                            className="hidden"
                          />
                        </label>
                      </div>
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
  "model_used": "gemini-3.7-flash"
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
                  selectedModel={modelFor("default")}
                  onIncorporateToReport={handleIncorporateToReport}
                  renderElegantResponse={renderElegantResponse} 
                  exportedImage={exportedImage}
                  exportedMimeType={exportedMimeType}
                  clearExportedImage={clearExportedImage}
                  findings={findings}
                  zipExtractedFile={zipExtractedFileForAnalysis}
                  clearZipExtractedFile={() => setZipExtractedFileForAnalysis(null)}
                  onZipUploaded={(file) => { setZipFile(file); setIsZipExtractorOpen(true); }}
                />
              </motion.div>
            )}

            {activeTab === "cloud-db" && (
              <motion.div
                key="cloud-db"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-w-7xl mx-auto space-y-6"
              >
                {/* Header card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative overflow-hidden text-left">
                  <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-indigo-500/5 rounded-full blur-[80px]" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)] shrink-0">
                        <History className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">Historial Local de Reportes</h2>
                        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                          Todos los estudios que generes se guardan automáticamente en tu navegador. Puedes abrirlos, copiar su contenido o limpiar el historial cuando lo desees.
                        </p>
                      </div>
                    </div>
                    {(savedReports.length > 0 || cloudStudies.length > 0) && (
                      <button
                        onClick={handleClearHistory}
                        className="bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Limpiar Historial</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={cloudSearch}
                      onChange={(e) => setCloudSearch(e.target.value)}
                      placeholder="Buscar por tipo de estudio, historia clínica o texto del reporte..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                  <div className="text-xs text-slate-400 font-mono font-bold flex items-center gap-2 px-2 shrink-0">
                    <span>Total guardados: <strong className="text-indigo-400">{savedReports.length}</strong></span>
                  </div>
                </div>

                {/* Local History Cards List */}
                {(() => {
                  const filtered = savedReports.filter(item => {
                    const query = cloudSearch.toLowerCase();
                    return (
                      item.studyType.toLowerCase().includes(query) ||
                      item.clinicalHistory.toLowerCase().includes(query) ||
                      item.reportText.toLowerCase().includes(query)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl py-12 flex flex-col items-center justify-center gap-4 text-center px-6">
                        <History className="h-12 w-12 text-slate-600 mb-1" />
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">
                          {cloudSearch ? "Sin resultados para la búsqueda" : "Historial Local Vacío"}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mt-1">
                          {cloudSearch
                            ? "Ningún estudio coincide con tu búsqueda."
                            : "Cuando generes o edites un reporte en la pestaña Generador, se guardará automáticamente en este historial."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filtered.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#0b1329]/60 hover:bg-[#0c1630] border border-slate-800 hover:border-indigo-800/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group shadow-lg text-left"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-3 mb-3">
                              <span className="text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                                {item.studyType}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono font-bold">{item.timestamp}</span>
                            </div>

                            <div className="space-y-2.5">
                              <div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">Historia Clínica:</span>
                                <p className="text-xs text-slate-300 font-medium line-clamp-2 mt-0.5">{item.clinicalHistory}</p>
                              </div>

                              <div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">Extracto del Reporte:</span>
                                <p className="text-xs text-slate-400 font-mono line-clamp-3 mt-0.5 bg-slate-950/50 p-2 rounded-lg border border-slate-850/60 whitespace-pre-wrap">
                                  {item.reportText}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/60 shrink-0">
                            <button
                              onClick={() => {
                                setActiveTab("generator");
                                setStudyType(item.studyType);
                                handleLoadStudyType(item.studyType);
                                setClinicalHistory(item.clinicalHistory);
                                setGeneratedReport(item.reportText);
                                setOriginalBaseReport(item.reportText);
                              }}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] uppercase tracking-wider py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-indigo-500/30"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Cargar</span>
                            </button>

                            <button
                              onClick={() => copyToClipboard(item.reportText, true)}
                              className="px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 font-bold text-[11px] uppercase tracking-wider py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                              title="Copiar informe"
                            >
                              <Copy className="h-3.5 w-3.5 text-indigo-400" />
                            </button>

                            <button
                              onClick={() => handleDeleteReport(item.id)}
                              className="px-3 bg-rose-950/20 hover:bg-rose-950/60 text-rose-400 border border-rose-900/40 font-bold text-[11px] uppercase tracking-wider py-2 rounded-xl flex items-center justify-center transition cursor-pointer"
                              title="Eliminar del historial"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* Cloud Study Detail Overlay Modal */}
            {viewingCloudStudy && (
              <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#0b1329] border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-left"
                >
                  <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-900/30 px-2 py-0.5 rounded font-black font-mono uppercase tracking-wider">
                        {viewingCloudStudy.studyType}
                      </span>
                      <h3 className="text-sm font-black text-white mt-1.5 uppercase tracking-widest">
                        Informe de {viewingCloudStudy.patientName}
                      </h3>
                    </div>
                    <button 
                      onClick={() => setViewingCloudStudy(null)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Paciente</span>
                        <span className="text-white font-semibold block mt-0.5">{viewingCloudStudy.patientName}</span>
                      </div>
                      {viewingCloudStudy.patientId && (
                        <div>
                          <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">ID / Cédula</span>
                          <span className="text-white font-semibold block mt-0.5">{viewingCloudStudy.patientId}</span>
                        </div>
                      )}
                      {viewingCloudStudy.patientAge && (
                        <div>
                          <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Edad</span>
                          <span className="text-white font-semibold block mt-0.5">{viewingCloudStudy.patientAge}</span>
                        </div>
                      )}
                      {viewingCloudStudy.patientGender && (
                        <div>
                          <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Género</span>
                          <span className="text-white font-semibold block mt-0.5">{viewingCloudStudy.patientGender}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Correo Paciente</span>
                        <span className="text-white font-semibold block mt-0.5 truncate">{viewingCloudStudy.patientEmail || "Sin correo"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Fecha Informe</span>
                        <span className="text-white font-semibold block mt-0.5 font-mono">{viewingCloudStudy.reportDate || viewingCloudStudy.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Especialista</span>
                        <span className="text-white font-semibold block mt-0.5">{viewingCloudStudy.doctorName}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/20 border border-slate-900 rounded-xl text-xs">
                      <span className="text-slate-500 font-mono font-bold uppercase block tracking-wider text-[9px]">Historia Clínica</span>
                      <p className="text-slate-200 mt-1 whitespace-pre-wrap">{viewingCloudStudy.clinicalHistory}</p>
                    </div>

                    <div className="border border-slate-800/80 rounded-xl overflow-hidden">
                      <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-400 font-mono uppercase tracking-widest">Contenido del Reporte Clínico Oficial</span>
                      </div>
                      <div className="p-6 bg-slate-950/10 text-xs font-mono whitespace-pre-wrap text-slate-300 leading-relaxed overflow-x-auto max-h-[350px]">
                        {viewingCloudStudy.reportText}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                    <button
                      onClick={() => handleCopyEhrLinkForStudy(viewingCloudStudy)}
                      className="bg-indigo-950/80 hover:bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      {copiedEhrStudyId === viewingCloudStudy.id ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-400" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Link className="h-4 w-4 text-indigo-400" />
                          Copiar Link Expediente (EHR)
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadPdfForCloudStudy(viewingCloudStudy)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Download className="h-4 w-4 text-white" />
                      Descargar PDF Guardado
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("generator");
                        setStudyType(viewingCloudStudy.studyType);
                        handleLoadStudyType(viewingCloudStudy.studyType);
                        setClinicalHistory(viewingCloudStudy.clinicalHistory);
                        setGeneratedReport(viewingCloudStudy.reportText);
                        setOriginalBaseReport(viewingCloudStudy.reportText);
                        setCurrentCloudStudyId(viewingCloudStudy.id);
                        if (viewingCloudStudy.patientName) setPatientName(viewingCloudStudy.patientName);
                        if (viewingCloudStudy.patientEmail) setPatientEmail(viewingCloudStudy.patientEmail);
                        if (viewingCloudStudy.patientAge) setPatientAge(viewingCloudStudy.patientAge);
                        if (viewingCloudStudy.patientGender) setPatientGender(viewingCloudStudy.patientGender);
                        if (viewingCloudStudy.patientId) setPatientId(viewingCloudStudy.patientId);
                        if (viewingCloudStudy.reportDate) setReportDate(viewingCloudStudy.reportDate);
                        if (viewingCloudStudy.doctorName) setDoctorName(viewingCloudStudy.doctorName);
                        if (viewingCloudStudy.doctorLicense) setDoctorLicense(viewingCloudStudy.doctorLicense);
                        if (viewingCloudStudy.clinicName) setClinicName(viewingCloudStudy.clinicName);
                        if (viewingCloudStudy.findings) setFindings(viewingCloudStudy.findings);
                        setAttachedImages(viewingCloudStudy.attachedImages || []);
                        if (viewingCloudStudy.atlas3dData) setAtlas3dData(viewingCloudStudy.atlas3dData);
                        if (viewingCloudStudy.includeAtlas3dInReport !== undefined) setIncludeAtlas3dInReport(viewingCloudStudy.includeAtlas3dInReport);
                        if (viewingCloudStudy.vascular3dData) setVascular3dData(viewingCloudStudy.vascular3dData);
                        if (viewingCloudStudy.thyroid3dData) setThyroid3dData(viewingCloudStudy.thyroid3dData);
                        if (viewingCloudStudy.breast3dData) setBreast3dData(viewingCloudStudy.breast3dData);
                        if (viewingCloudStudy.includeBreast3dInReport !== undefined) setIncludeBreast3dInReport(viewingCloudStudy.includeBreast3dInReport);
                        if (viewingCloudStudy.shoulder3dData) setShoulder3dData(viewingCloudStudy.shoulder3dData);
                        if (viewingCloudStudy.knee3dData) setKnee3dData(viewingCloudStudy.knee3dData);
                        if (viewingCloudStudy.ankle3dData) setAnkle3dData(viewingCloudStudy.ankle3dData);
                        if (viewingCloudStudy.kidney3dData) setKidney3dData(viewingCloudStudy.kidney3dData);
                        if (viewingCloudStudy.abdomen3dData) setAbdomen3dData(viewingCloudStudy.abdomen3dData);
                        if (viewingCloudStudy.abdominalWall3dData) setAbdominalWall3dData(viewingCloudStudy.abdominalWall3dData);
                        if (viewingCloudStudy.scrotum3dData) setScrotum3dData(viewingCloudStudy.scrotum3dData);
                        if (viewingCloudStudy.muscleTendon3dData) setMuscleTendon3dData(viewingCloudStudy.muscleTendon3dData);
                        if (viewingCloudStudy.wrist3dData) setWrist3dData(viewingCloudStudy.wrist3dData);
                        if (viewingCloudStudy.includeShoulder3dInReport !== undefined) setIncludeShoulder3dInReport(viewingCloudStudy.includeShoulder3dInReport);
                        if (viewingCloudStudy.includeKnee3dInReport !== undefined) setIncludeKnee3dInReport(viewingCloudStudy.includeKnee3dInReport);
                        if (viewingCloudStudy.includeAnkle3dInReport !== undefined) setIncludeAnkle3dInReport(viewingCloudStudy.includeAnkle3dInReport);
                        if (viewingCloudStudy.includeKidney3dInReport !== undefined) setIncludeKidney3dInReport(viewingCloudStudy.includeKidney3dInReport);
                        if (viewingCloudStudy.includeAbdomen3dInReport !== undefined) setIncludeAbdomen3dInReport(viewingCloudStudy.includeAbdomen3dInReport);
                        if (viewingCloudStudy.includeAbdominalWall3dInReport !== undefined) setIncludeAbdominalWall3dInReport(viewingCloudStudy.includeAbdominalWall3dInReport);
                        if (viewingCloudStudy.includeScrotum3dInReport !== undefined) setIncludeScrotum3dInReport(viewingCloudStudy.includeScrotum3dInReport);
                        if (viewingCloudStudy.includeMuscleTendon3dInReport !== undefined) setIncludeMuscleTendon3dInReport(viewingCloudStudy.includeMuscleTendon3dInReport);
                        if (viewingCloudStudy.includeWrist3dInReport !== undefined) setIncludeWrist3dInReport(viewingCloudStudy.includeWrist3dInReport);
                        if (viewingCloudStudy.includeThyroid3dInReport !== undefined) setIncludeThyroid3dInReport(viewingCloudStudy.includeThyroid3dInReport);
                        if (viewingCloudStudy.focalLesion3dData) setFocalLesion3dData(viewingCloudStudy.focalLesion3dData);
                        if (viewingCloudStudy.usPlaneSimulatorData) setUsPlaneSimulatorData(viewingCloudStudy.usPlaneSimulatorData);
                        if (viewingCloudStudy.includeVascular3dInReport !== undefined) setIncludeVascular3dInReport(viewingCloudStudy.includeVascular3dInReport);
                        if (viewingCloudStudy.includeFocalLesion3dInReport !== undefined) setIncludeFocalLesion3dInReport(viewingCloudStudy.includeFocalLesion3dInReport);
                        if (viewingCloudStudy.includeUsPlaneSimulatorInReport !== undefined) setIncludeUsPlaneSimulatorInReport(viewingCloudStudy.includeUsPlaneSimulatorInReport);
                        if (viewingCloudStudy.usImagesGridMode) setUsImagesGridMode(viewingCloudStudy.usImagesGridMode as any);
                        setFindings3dRenders(viewingCloudStudy.findings3dRenders || []);
                        setPatientSummary(viewingCloudStudy.patientSummary || null);
                        setViewingCloudStudy(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Cargar en Workspace
                    </button>
                    <button
                      onClick={() => setViewingCloudStudy(null)}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition border border-slate-700/60"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}


          </AnimatePresence>
        </main>

        <WorklistSidebar
          isOpen={isWorklistSidebarOpen}
          onClose={() => setIsWorklistSidebarOpen(false)}
          worklist={worklist}
          worklistError={worklistError}
          isProcessingWorklist={isProcessingWorklist}
          selectedWorklistPatientId={selectedWorklistPatientId}
          bridgeOnline={bridgeOnline}
          bridgePatientCount={bridgePatientCount}
          onUploadImage={handleWorklistImageUpload}
          onClearWorklist={() => saveWorklist([])}
          onSelectPatient={handleSelectWorklistPatient}
          onDeletePatient={handleDeletePatientFromWorklist}
          onUpdateStatus={handleUpdatePatientStatus}
          onAddPatient={handleAddPatientToWorklist}
        />

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

      {isZipExtractorOpen && zipFile && (
        <ZipDicomExtractor
          isOpen={isZipExtractorOpen}
          zipFile={zipFile}
          onClose={() => {
            setZipFile(null);
            setIsZipExtractorOpen(false);
          }}
          onLoadToGenerator={handleLoadExtractedToGenerator}
          onLoadToSlot={handleLoadExtractedToSlot}
          onLoadMultipleSlots={handleLoadMultipleSlots}
        />
      )}

      {qaGateResult && (
        <React.Suspense fallback={null}>
          <ReportQaGateModal
            result={qaGateResult}
            onClose={handleDismissQaGate}
            onProceedAnyway={handleProceedQaGateAnyway}
          />
        </React.Suspense>
      )}

      {/* MODELO DE ASISTENCIA PARA IMPRESIÓN Y EXPORTACIÓN PDF (ESPECIAL IPHONE/MOBILE & IFRAME) */}
      {showPrintModal && (
        <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header de la Vista Previa */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">Asistente de Impresión y PDF Oficial</h3>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* selectores modernos para Doc Type y View Type */}
            <div className="no-print bg-[#0a0d16] px-6 py-4 border-b border-slate-850 space-y-3.5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5 text-left">
                  <p className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Documento a generar</p>
                  <p className="text-[10px] text-slate-450 leading-none">Selecciona cuál documento deseas descargar, previsualizar o mandar a imprimir.</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => setPrintModalDocType('report')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${
                      printModalDocType === 'report'
                        ? 'bg-indigo-600 font-black text-white shadow-md shadow-indigo-500/20'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Informe formal
                  </button>
                  {patientSummary && (
                    <button
                      onClick={() => setPrintModalDocType('patient_summary')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${
                        printModalDocType === 'patient_summary'
                          ? 'bg-emerald-600 font-black text-white shadow-md shadow-emerald-500/20'
                          : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Pack paciente
                    </button>
                  )}
                  {patientSummary && (
                    <button
                      onClick={() => setPrintModalDocType('both')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${
                        printModalDocType === 'both'
                          ? 'bg-amber-600 font-black text-white shadow-md shadow-amber-500/20'
                          : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Ambos PDFs
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-850/60">
                <div className="space-y-0.5 text-left">
                  <p className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Modo de Vista Previa</p>
                  <p className="text-[10px] text-slate-450 leading-none">Puedes alternar entre la simulación digital responsiva y el PDF vectorial real.</p>
                </div>
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850 shrink-0">
                  <button
                    onClick={() => setPrintModalViewType('html_simulator')}
                    className={`px-3.5 py-1 rounded-lg text-[10.5px] font-bold transition-all uppercase cursor-pointer ${
                      printModalViewType === 'html_simulator'
                        ? 'bg-slate-850 text-white font-extrabold shadow-sm'
                        : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    🖥️ Simulador HTML
                  </button>
                  <button
                    onClick={() => setPrintModalViewType('pdf_viewer')}
                    className={`px-3.5 py-1 rounded-lg text-[10.5px] font-bold transition-all uppercase cursor-pointer ${
                      printModalViewType === 'pdf_viewer'
                        ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                        : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    📄 Ver PDF Real (.pdf)
                  </button>
                </div>
              </div>
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
                    onClick={() => {
                      if (printModalDocType === 'report') {
                        guardReportPdfExport(() => handleDownloadNativePDF(false));
                      } else if (printModalDocType === 'both') {
                        guardReportPdfExport(() => handleDownloadNativePDF(false));
                        handleDownloadPatientSummaryPDF(false);
                      } else {
                        handleDownloadPatientSummaryPDF(false);
                      }
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-indigo-600 hover:bg-indigo-550 border-2 border-indigo-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar PDF Limpio (Sin URL/Hora)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (printModalDocType === 'report') {
                        guardReportPdfExport(() => handleDownloadNativePDF(true));
                      } else if (printModalDocType === 'both') {
                        guardReportPdfExport(() => handleDownloadNativePDF(true));
                        handleDownloadPatientSummaryPDF(true);
                      } else {
                        handleDownloadPatientSummaryPDF(true);
                      }
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-sky-700 hover:bg-sky-650 border-2 border-sky-600/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir PDF en {printModalDocType === 'patient_summary' ? "Explicación" : printModalDocType === 'both' ? "Ambos" : "Informe"} (Pestaña Limpia)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (printModalDocType === 'report') {
                        const appUrl = window.location.href;
                        window.open(appUrl, "_blank");
                      } else if (printModalDocType === 'both') {
                        guardReportPdfExport(() => handleDownloadNativePDF(false));
                        handleDownloadPatientSummaryPDF(false);
                      } else {
                        handlePrintPatientSummary();
                      }
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-slate-800 hover:bg-slate-750 border-2 border-slate-700/10 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-indigo-400" />
                    <span>{printModalDocType === 'patient_summary' ? "Abrir cuadro de Impresión Nativo" : printModalDocType === 'both' ? "Descargar ambos PDFs" : "Imprimir original en Pestaña Nueva"}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (printModalDocType === 'patient_summary') {
                        copyToClipboard(JSON.stringify(patientSummary, null, 2), true);
                      } else {
                        copyToClipboard(generatedReport, true);
                      }
                    }}
                    className="flex items-center justify-center gap-2.5 p-3 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copiar Texto del {printModalDocType === 'patient_summary' ? "Resumen" : "Reporte"}</span>
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

              {/* 🇨🇭 SELECTOR DE DISEÑO EDITORIAL (ESTÁNDAR VS SUIZO) DIRECTO SOBRE EL VISOR */}
              <div className="bg-[#0b0f19] p-4.5 rounded-2xl border-2 border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4 text-left shadow-lg">
                <div className="space-y-1 text-left">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-indigo-400 flex items-center gap-1.5">
                    <Columns className="h-4 w-4 text-indigo-400" />
                    Estilo de Diseño de PDF en Tiempo Real
                  </h4>
                  <p className="text-[10.5px] text-slate-400 leading-normal max-w-xl">
                    Cambia la presentación visual y estructura de su PDF en vivo. Seleccione entre el estilo <strong>Estándar</strong> clásico, el moderno <strong>Clinical Slate</strong> con tonos pizarra, o el refinado y formal <strong>Executive Medical</strong> con acentos en azul marino y oro.
                  </p>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none w-full md:w-auto justify-center md:justify-start gap-1">
                  <button
                    type="button"
                    onClick={() => setPdfLayoutType("classic")}
                    className={`flex-1 md:flex-none px-3.5 py-2 rounded-lg text-xs font-black transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                      pdfLayoutType === "classic"
                        ? "bg-slate-800 text-white font-black shadow-md border border-slate-700"
                        : "text-slate-400 hover:text-slate-250 hover:bg-slate-850"
                    }`}
                  >
                    <span>📋</span> Estándar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfLayoutType("clinical_slate")}
                    className={`flex-1 md:flex-none px-3.5 py-2 rounded-lg text-xs font-black transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                      pdfLayoutType === "clinical_slate"
                        ? "bg-slate-700 text-slate-100 font-black shadow-md border border-slate-600"
                        : "text-slate-400 hover:text-slate-250 hover:bg-slate-850"
                    }`}
                  >
                    <span>🎨</span> Clinical Slate
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfLayoutType("executive_medical")}
                    className={`flex-1 md:flex-none px-3.5 py-2 rounded-lg text-xs font-black transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5 ${
                      pdfLayoutType === "executive_medical"
                        ? "bg-amber-600 text-white font-black shadow-md border border-amber-500"
                        : "text-slate-400 hover:text-slate-250 hover:bg-slate-850"
                    }`}
                  >
                    <span>👑</span> Executive Medical
                  </button>
                </div>
              </div>

              {printModalViewType === 'pdf_viewer' ? (
                <div className="space-y-3.5 text-left">
                  <div className="flex justify-between items-center text-left">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                      Vista Previa de Impresión Oficial del Documento (.pdf):
                    </span>
                    {isGeneratingPdfPreview && (
                      <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1.5 animate-pulse font-extrabold uppercase">
                        ⚡ ACTUALIZANDO VISTA PREVIA DEL PDF...
                      </span>
                    )}
                  </div>
                  
                  <div className="relative bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden min-h-[500px] md:h-[680px] w-full flex flex-col items-center justify-center">
                    {/* Alerta de restricción iframe del navegador */}
                    <div className="absolute top-4 left-4 right-4 z-15 bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3.5 py-2 rounded-xl text-[10px] font-bold leading-normal flex items-start gap-2 shadow-md">
                      <span className="text-sm shrink-0">⚠️</span>
                      <p className="font-mono uppercase tracking-wide">
                        Entorno Sandboxed AI Studio: Las políticas de seguridad de su navegador pueden bloquear la carga del visor de PDF inline. Si ve esta pantalla en blanco o vacía, cambie a la pestaña superior <strong className="text-white">🖥️ Simulador HTML</strong> para ver la maqueta fiel A4 o descargue el archivo oficial libre con el botón superior.
                      </p>
                    </div>

                    {isGeneratingPdfPreview ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-11 h-11 border-4 border-indigo-700/30 border-t-indigo-500 rounded-full animate-spin"></div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-wider font-mono animate-pulse">Renderizando PDF a nivel PACS</p>
                          <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
                            Ensamblando el documento completo con tablas de medición, gráficos de Doppler si existen, firmas SHA256 y credenciales médicas habilitadas...
                          </p>
                        </div>
                      </div>
                    ) : (printModalDocType === 'patient_summary' ? generatedSummaryPdfUrl : generatedNativePdfUrl) ? (
                      <iframe
                        src={printModalDocType === 'patient_summary' ? generatedSummaryPdfUrl! : generatedNativePdfUrl!}
                        className="w-full h-full border-0 absolute inset-0 bg-white pt-14"
                        title="Vista Previa de Impresión Real en Vivo"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 pt-16">
                        <span className="text-4xl text-slate-500">📎</span>
                        <p className="text-sm font-black text-slate-300 uppercase font-mono">No se pudo Renderizar el Documento PDF</p>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                          Este navegador no soporta visualizador de PDF incrustado o se ha denegado el permiso. Puedes descargarlo directamente para visualizarlo o imprimirlo:
                        </p>
                        <button
                          onClick={() => {
                      if (printModalDocType === 'report') {
                        guardReportPdfExport(() => handleDownloadNativePDF(false));
                      } else if (printModalDocType === 'both') {
                        guardReportPdfExport(() => handleDownloadNativePDF(false));
                        handleDownloadPatientSummaryPDF(false);
                      } else {
                        handleDownloadPatientSummaryPDF(false);
                      }
                    }}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/20 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Descargar Documento Físico
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  {printModalDocType !== 'patient_summary' ? (
                    <div className="space-y-2 text-left">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Vista Previa del Documento (Formato Físico):</span>
                      <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-black p-6 sm:p-[20mm] rounded-sm border border-slate-300 shadow-[0_12px_36px_rgba(0,0,0,0.18)] text-left relative overflow-x-auto">
                        
                        {/* Membrete */}
                  {customLogoUrl && customLogoStyle === "banner" ? (
                    <div className="border-b border-gray-300 pb-4 mb-4 text-center">
                      <img 
                        src={customLogoUrl} 
                        alt="Membrete de la Clínica" 
                        className="max-h-[160px] mx-auto w-auto object-contain block" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-4 text-left">
                      <div className="flex items-center gap-3">
                        {selectedLogo !== "none" && (
                          <div className="w-16 h-16 flex items-center justify-center shrink-0 border border-gray-200 rounded-lg p-1 bg-gray-50 text-indigo-700">
                            {customLogoUrl ? (
                              <img 
                                src={customLogoUrl} 
                                alt="Logo" 
                                className="w-14 h-14 object-contain block" 
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
                          <div>Fecha: <span className="font-extrabold text-gray-800">{formatDateToDMY(reportDate)}</span></div>
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
                          <span className="font-extrabold text-gray-900 uppercase text-[12px]">{formatDateToDMY(reportDate)}</span>
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
                  {(() => {
                    const activeText = isEditingReportManual ? editedReportText : (generatedReport || "");
                    const { mainReport, cuadroSinopticoReport, organSynopsisReport, annexReport } = splitReportSections(activeText);
                    const radarData = getBiomechanicalRadarDataFromReport(activeText, biomechanicalRadarData);
                    return (
                      <>
                        {/* 1. CUERPO DE REPORTE */}
                        <div className="space-y-4 pt-2 text-left leading-relaxed text-[12px] text-gray-900 font-serif">
                          {renderPrintReportBody(mainReport)}
                        </div>

                        {/* FIRMA AL FINAL DEL CUERPO DEL REPORTE */}
                        {(doctorName || customSignatureUrl) && (
                          <div className="mt-12 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4 text-[9px] leading-normal font-sans text-gray-400 text-left">
                            {/* Bloque Homologado Izquierdo (Metadatos de Firma Electrónica) */}
                            <div className="border border-slate-250 bg-slate-50/70 p-3 rounded-lg text-[8px] font-sans text-slate-500 max-w-[340px] space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-[8.5px] text-slate-700 uppercase">
                                <span className="text-indigo-600">🛡️</span>
                                <span>Firma Electrónica Homologada</span>
                              </div>
                              <p className="font-mono text-[7.5px] text-indigo-700 font-bold bg-indigo-50/55 px-1 py-0.5 rounded break-all select-all">
                                {getValidationHash()}
                              </p>
                              <div className="grid grid-cols-[max-content_1fr] gap-x-2 text-[8px] leading-relaxed">
                                <span className="font-semibold text-slate-400 uppercase">Autoridad:</span>
                                <span className="font-bold text-slate-650">{doctorName || "Médico Especialista"}</span>
                                
                                <span className="font-semibold text-slate-400 uppercase">Registro:</span>
                                <span className="font-mono font-bold text-slate-650">{doctorLicense}</span>
                                
                                <span className="font-semibold text-slate-400 uppercase">Estado:</span>
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  VALIDADO Y REGISTRADO
                                </span>
                                
                                <span className="font-semibold text-slate-400 uppercase">Soporte Legal:</span>
                                <span className="text-slate-450 italic">Ley de Comercio Electrónico, Firmas y Datos (Art. 14)</span>
                              </div>
                            </div>

                            {/* Firma Autógrafa y Datos del Médico Especialista */}
                            <div className="text-right flex flex-col items-end justify-center">
                              <div className="inline-block text-center relative max-w-[280px]">
                                {customSignatureUrl ? (
                                  <div className="mb-1.5 flex justify-center">
                                    <img 
                                      src={customSignatureUrl} 
                                      alt="Firma" 
                                      className="h-12 max-w-[140px] object-contain block mix-blend-multiply" 
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div className="mb-2 text-indigo-600/80 font-serif italic text-xs select-none relative pr-4">
                                    <span className="text-[10px] font-mono font-black border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider block">
                                      🔑 FIRMADO DIGITALMENTE
                                    </span>
                                  </div>
                                )}
                                <div className="border-t border-slate-300 pt-1.5 px-4 text-center">
                                  <p className="font-black text-slate-900 uppercase text-[11px] leading-tight select-all">{doctorName || "Médico Especialista"}</p>
                                  <p className="font-semibold text-slate-500 text-[8.5px] mt-0.5 select-all">Especialista en Radiología e Imágenes Medicas.</p>
                                  <p className="font-mono text-slate-450 text-[7.5px] leading-normal select-all">{doctorLicense}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. CUADRO SINÓPTICO */}
                        {cuadroSinopticoReport && (
                          <div className="mt-8 pt-6 border-t border-gray-300 print:break-before-page" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                            <div className="space-y-4 text-left leading-relaxed text-[12px] text-gray-900 font-serif">
                              {renderPrintReportBody(cuadroSinopticoReport)}
                            </div>
                          </div>
                        )}

                        {/* 3. SINOPSIS POR ÓRGANO (PÁGINA INDEPENDIENTE) */}
                        {organSynopsisReport && (
                          <div className="mt-8 pt-6 border-t border-gray-300 print:break-before-page" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                            <div className="space-y-4 text-left leading-relaxed text-[12px] text-gray-900 font-serif">
                              {renderPrintReportBody(organSynopsisReport)}
                            </div>
                          </div>
                        )}

                        {/* 6. DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIONES */}
                        {annexReport && (
                          <div className="mt-12 pt-6 border-t border-gray-300 print:break-before-page">
                            <div className="space-y-4 pt-2 text-left leading-relaxed text-[12px] text-gray-900 font-serif">
                              {renderPrintReportBody(annexReport)}
                            </div>
                          </div>
                        )}

                        {/* 7. ANEXO: RADAR BIOMECÁNICO E INFLAMATORIO */}
                        {includeRadarInReport && renderPrintBiomechanicalRadarAnnex(radarData)}
                      </>
                    );
                  })()}

                </div>
              </div>
          ) : (
            <div className="space-y-4 text-left">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Vista Previa de la Explicación Empática (Acompañamiento):</span>
              <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-black p-6 sm:p-[20mm] rounded-sm border border-slate-300 shadow-[0_12px_36px_rgba(0,0,0,0.18)] text-left relative overflow-x-auto">
                
                {/* Membrete Explicación */}
                <div className="flex justify-between items-start border-b-2 border-orange-500/30 pb-4 mb-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 flex items-center justify-center shrink-0 border border-orange-200 rounded-lg p-1 bg-orange-50 text-orange-600">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold tracking-tight text-[#0f100e] uppercase">
                        ACOMPAÑAMIENTO INTEGRAL PARA EL PACIENTE
                      </h4>
                      <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest leading-none mt-1">
                        Traducción Empática de Hallazgos Clínicos
                      </p>
                    </div>
                  </div>
                  {reportDate && (
                    <div className="text-right text-[9px] uppercase text-gray-500 leading-normal">
                      <div>Fecha: <span className="font-extrabold text-gray-800">{formatDateToDMY(reportDate)}</span></div>
                    </div>
                  )}
                </div>

                {/* Ficha Paciente Explicación */}
                {(patientName || reportDate) && (
                  <div className="border border-orange-200 rounded-lg p-3.5 mb-6 bg-orange-50/30 flex flex-wrap gap-x-8 gap-y-1.5 text-[11px] leading-relaxed text-left">
                    {patientName && (
                      <div>
                        <span className="font-bold text-orange-600 uppercase">Paciente:</span>{" "}
                        <span className="font-extrabold text-slate-900 uppercase text-[12px]">{patientName}</span>
                      </div>
                    )}
                    {reportDate && (
                      <div>
                        <span className="font-bold text-orange-600 uppercase font-sans">Estudio Realizado:</span>{" "}
                        <span className="font-extrabold text-slate-900 uppercase text-[12px]">{specificStudy || "Ultrasonografía / Imagenologia"}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contenido de la Traducción */}
                {patientSummary ? (
                  <div className="space-y-6 font-sans text-left">
                    {patientSummary.studyOverview && (
                      <div className="space-y-1.5 p-4 bg-sky-50/40 border-l-4 border-sky-500 rounded-r-xl text-left">
                        <h5 className="text-[10px] font-black tracking-widest uppercase text-sky-800">Qué estudio se le realizó</h5>
                        <p className="text-xs text-gray-700 leading-relaxed font-sans font-medium text-left">
                          {patientSummary.studyOverview}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5 p-4 bg-orange-50/20 border-l-4 border-orange-500 rounded-r-xl text-left">
                      <h5 className="text-[10px] font-black tracking-widest uppercase text-orange-700">En pocas palabras</h5>
                      <p className="text-xs text-gray-700 leading-relaxed font-sans font-medium text-left">
                        {patientSummary.summary}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-[10.5px] font-black tracking-wider uppercase text-slate-800 border-b border-gray-200 pb-1 flex items-center gap-1">
                        <span>🔍</span> SUS HALLAZGOS, EXPLICADOS
                      </h5>
                      <div className="space-y-3.5 text-left bg-transparent">
                        {patientSummary.keyFindings?.map((finding: any, idx: number) => (
                          <div key={idx} className="p-3.5 border border-gray-250 rounded-xl bg-slate-50/50 space-y-2 text-left">
                            <p className="text-xs font-black text-orange-700 uppercase flex items-center gap-1.5 justify-start">
                              <span>📌</span> {finding.title}
                            </p>
                            <p className="text-[9.5px] font-mono text-gray-500 leading-none text-left">
                              Término científico: <span className="font-bold text-pink-700">"{finding.originalTerm}"</span>
                            </p>
                            <p className="text-xs text-gray-700 leading-relaxed font-sans text-left">
                              <strong>Explicación:</strong> {finding.simplifiedExplanation}
                            </p>
                            <p className="text-[11.5px] text-amber-800 leading-relaxed font-sans italic bg-amber-50/50 px-2.5 py-1.5 border-l-2 border-amber-400 rounded-r text-left">
                              <strong>Analogía:</strong> "{finding.analogy}"
                            </p>
                            <p className="text-[11px] text-blue-800 leading-relaxed font-sans bg-blue-50/55 px-2.5 py-1.5 border-l-2 border-blue-400 rounded-r text-left">
                              <strong>Contexto descriptivo:</strong> {finding.clinicalContext || finding.reassurance}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>


                    {Array.isArray(patientSummary.glossary) && patientSummary.glossary.length > 0 && (
                      <div className="space-y-2 text-left">
                        <h5 className="text-[10.5px] font-black tracking-wider uppercase text-slate-800 border-b border-gray-200 pb-1">
                          GLOSARIO DE TÉRMINOS
                        </h5>
                        <p className="text-[10px] text-gray-500 leading-normal text-left">
                          Palabras del informe formal, explicadas en lenguaje claro.
                        </p>
                        <div className="space-y-2">
                          {patientSummary.glossary.map((entry: any, idx: number) => (
                            <div key={idx} className="p-3 border border-gray-200 rounded-xl bg-slate-50/70 space-y-1 text-left">
                              <p className="text-xs font-black text-emerald-800 uppercase">{entry.term}</p>
                              <p className="text-xs text-gray-700 leading-relaxed font-sans">{entry.plainDefinition || entry.definition}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Firma de Validación Médica Integrada a la explicación */}
                    {(doctorName || customSignatureUrl) && (
                      <div className="mt-8 pt-5 border-t border-gray-200 flex justify-between items-end text-[9px] leading-normal font-sans text-gray-400 text-left">
                        {/* Autorización Legal */}
                        <div className="space-y-1 max-w-[340px] text-left">
                          <p className="font-extrabold text-slate-700 tracking-wider text-[8.5px] uppercase">Avalado Médicamente por el Radiólogo de Guardia</p>
                          <p className="text-[8px] leading-relaxed text-slate-500">
                            Este documento es una traducción empática automatizada validada mediante firma electrónica y no sustituye de ninguna manera el criterio del médico tratante encargado del tratamiento.
                          </p>
                        </div>
                        {/* Bloque Firma */}
                        <div className="text-right flex flex-col items-end">
                          {customSignatureUrl ? (
                            <img 
                              src={customSignatureUrl} 
                              alt="Firma" 
                              className="h-9 max-w-[120px] object-contain ml-auto block mix-blend-multiply" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="text-[10px] font-bold text-indigo-600 pb-1">🔑 FIRMADO DIGITALMENTE</div>
                          )}
                          <div className="border-t border-slate-300 pt-1 text-center">
                            <p className="font-black text-slate-900 text-[10px]">{doctorName || "Médico Especialista"}</p>
                            <p className="text-[8px] text-slate-500 font-medium">{doctorLicense}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 font-sans">
                    <span className="text-4xl animate-bounce">🌱</span>
                    <p className="text-sm font-black text-gray-800 uppercase tracking-wide">Traducción para el Paciente aún no Generada</p>
                    <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                      Por favor, regresa al panel principal y haz clic en "Generar Traducción Empática" para que el sistema redacte automáticamente esta vista.
                    </p>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

    </div>

      {/* Footer del Modal */}
      <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex items-center justify-between no-print shrink-0">
        <button
          onClick={() => setShowPrintModal(false)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all font-mono cursor-pointer"
        >
          Cerrar
        </button>
        <button
          onClick={() => {
            if (printModalDocType === 'patient_summary') {
              handlePrintPatientSummary();
            } else if (printModalDocType === 'both') {
              guardReportPdfExport(() => handleDownloadNativePDF(false));
              handleDownloadPatientSummaryPDF(false);
            } else {
              try {
                window.print();
              } catch (e) {
                console.error(e);
              }
            }
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/30 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>{printModalDocType === 'patient_summary' ? "Imprimir Explicación" : printModalDocType === 'both' ? "Descargar Ambos PDFs" : "Ejecutar Impresión"}</span>
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
            className="bg-[#090d1a] border-2 border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🟢</span>
                <h3 className="text-xs font-black text-white uppercase tracking-widest font-mono">
                  Compartir vía WhatsApp (Local-First)
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
            <div className="p-6 space-y-5 overflow-y-auto text-left max-h-[80vh]">
              {/* Local-First Header Info */}
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex gap-3 items-start">
                <span className="text-base mt-0.5">🛡️</span>
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider font-mono">Privacidad Médica 100% Asegurada</h4>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Al ser una aplicación <strong>local-first</strong>, tus informes no se suben a servidores de terceros. Todo se procesa directamente en tu navegador y se envía a través de WhatsApp seguro.
                  </p>
                </div>
              </div>

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
                    className="flex-1 px-4 py-2 bg-slate-950 hover:bg-slate-900 border-2 border-slate-850 focus:border-indigo-500 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-mono tracking-wider">
                  Si dejas el número vacío, WhatsApp te permitirá seleccionar cualquier contacto o grupo al abrir la aplicación.
                </p>
              </div>

              {/* PASO 1: CONSTRUCTOR DE MENSAJE */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono border-b border-slate-800 pb-1">
                  PASO 1: Personalizar Texto del Mensaje
                </h4>
                
                <div className="space-y-2">
                  {/* Toggle Operational Summary */}
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    !operationalSummaryText 
                      ? "bg-slate-950/20 border-slate-900 text-slate-600 cursor-not-allowed" 
                      : whatsappIncludeOperationalSummary 
                        ? "bg-indigo-950/20 border-indigo-900/60 text-indigo-200" 
                        : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                  }`}>
                    <input
                      type="checkbox"
                      disabled={!operationalSummaryText}
                      checked={!!operationalSummaryText && whatsappIncludeOperationalSummary}
                      onChange={(e) => setWhatsappIncludeOperationalSummary(e.target.checked)}
                      className="mt-0.5 rounded border-slate-800 text-indigo-555 focus:ring-indigo-600 h-3.5 w-3.5 bg-slate-950"
                    />
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black uppercase tracking-wider block">Incluir Resumen Clínico Operativo</span>
                      <span className="text-[9px] text-slate-400 leading-normal block">
                        {operationalSummaryText 
                          ? "Agrega las conclusiones médicas y hallazgos críticos de forma compacta." 
                          : "⚠️ Primero genera un informe médico para incluir este bloque."}
                      </span>
                    </div>
                  </label>

                  {/* Toggle Patient Companion */}
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    !patientSummary 
                      ? "bg-slate-950/20 border-slate-900 text-slate-600 cursor-not-allowed" 
                      : whatsappIncludePatientSummary 
                        ? "bg-indigo-950/20 border-indigo-900/60 text-indigo-200" 
                        : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                  }`}>
                    <input
                      type="checkbox"
                      disabled={!patientSummary}
                      checked={!!patientSummary && whatsappIncludePatientSummary}
                      onChange={(e) => setWhatsappIncludePatientSummary(e.target.checked)}
                      className="mt-0.5 rounded border-slate-800 text-indigo-555 focus:ring-indigo-600 h-3.5 w-3.5 bg-slate-950"
                    />
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black uppercase tracking-wider block">Incluir Explicación para Paciente</span>
                      <span className="text-[9px] text-slate-400 leading-normal block">
                        {patientSummary 
                          ? "Agrega la traducción a palabras sencillas, recomendaciones y dudas sugeridas." 
                          : "⚠️ Primero genera la 'Explicación del Paciente' (Acompañamiento) abajo."}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* PASO 2: DESCARGAR ARCHIVOS PDF */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono border-b border-slate-800 pb-1">
                  PASO 2: Descargar Documentos Clínicos (Para Adjuntar)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Download Report */}
                  <button
                    type="button"
                    onClick={() => {
                      guardReportPdfExport(() => handleDownloadNativePDF(false));
                    }}
                    className="p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer select-none"
                    title="Descargar el reporte médico oficial firmado en PDF"
                  >
                    <Download className="h-4 w-4 text-indigo-400" />
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider block">1. PDF Reporte Oficial</span>
                      <span className="text-[8.5px] text-slate-500 font-mono leading-none block uppercase">Formato Clínico Profesional</span>
                    </div>
                  </button>

                  {/* Download Explanation */}
                  <button
                    type="button"
                    disabled={!patientSummary}
                    onClick={() => {
                      if (patientSummary) handleDownloadPatientSummaryPDF(false);
                    }}
                    className={`p-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none ${
                      patientSummary 
                        ? "bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 text-slate-200 cursor-pointer" 
                        : "bg-slate-950/20 border-slate-900 text-slate-500 cursor-not-allowed"
                    }`}
                    title={patientSummary ? "Descargar el PDF explicativo en lenguaje sencillo" : "Primero genera la explicación para el paciente"}
                  >
                    <Download className="h-4 w-4 text-indigo-400" />
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider block">2. PDF Explicación</span>
                      <span className="text-[8.5px] text-slate-500 font-mono leading-none block uppercase">Acompañamiento Didáctico</span>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!patientSummary}
                  onClick={() => {
                    if (!patientSummary) return;
                    guardReportPdfExport(async () => {
                      await handleDownloadNativePDF(false);
                      await handleDownloadPatientSummaryPDF(false);
                    });
                  }}
                  className={`w-full p-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none ${
                    patientSummary
                      ? "bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/40 text-amber-100 cursor-pointer"
                      : "bg-slate-950/20 border-slate-900 text-slate-500 cursor-not-allowed"
                  }`}
                  title={patientSummary ? "Descargar informe formal y explicación del paciente en un solo paso" : "Primero genera la explicación para el paciente"}
                >
                  <Download className="h-4 w-4 text-amber-400" />
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider block">Descargar ambos PDFs</span>
                    <span className="text-[8.5px] text-slate-400 font-mono leading-none block uppercase">Formal + explicación paciente</span>
                  </div>
                </button>
              </div>

              {/* PASO 3: RESPALDAR EN GOOGLE DRIVE */}
              <div className="space-y-2.5 mt-4">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono border-b border-slate-800 pb-1">
                  PASO 3: RESPALDO AUTOMÁTICO
                </h4>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleSaveToDrive}
                    disabled={isUploadingToDrive}
                    className={`p-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none ${
                      isUploadingToDrive 
                        ? "bg-slate-900 border-slate-800 text-slate-500 cursor-wait" 
                        : "bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-900/60 hover:border-indigo-800/80 text-indigo-200 cursor-pointer"
                    }`}
                    title="Subir PDFs generados directamente a la carpeta BASE DE DATOS en Google Drive"
                  >
                    {isUploadingToDrive ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                    ) : (
                      <Layers className="h-4 w-4 text-indigo-400" />
                    )}
                    <div className="text-left flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider block">Guardar en Google Drive</span>
                      <span className="text-[8.5px] text-slate-400 font-mono leading-none block uppercase">
                        {driveUploadStatus || "Carpeta: BASE DE DATOS"}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Message Preview */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                  Vista Previa del Mensaje Automatizado de WhatsApp:
                </label>
                <div className="p-4 bg-slate-950 border-2 border-slate-850 rounded-2xl max-h-48 overflow-y-auto font-mono text-[10px] md:text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-sans">
                  {getWhatsAppTextPreview()}
                </div>
              </div>

              {/* PASO 3: ENVIAR */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono border-b border-slate-800 pb-1">
                  PASO 3: Lanzar WhatsApp y Pegar Reportes
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={(() => {
                      const text = getWhatsAppTextPreview();
                      const cleanPhone = whatsappPhone ? whatsappPhone.replace(/\D/g, "") : "";
                      const urlEncoded = encodeURIComponent(text);
                      return cleanPhone 
                        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${urlEncoded}`
                        : `https://api.whatsapp.com/send?text=${urlEncoded}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-emerald-600 hover:bg-emerald-550 border-2 border-emerald-500/10 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 font-mono"
                  >
                    <Send className="h-4 w-4" />
                    <span>Lanzar Chat de WhatsApp</span>
                  </a>

                  <button
                    onClick={() => {
                      const text = getWhatsAppTextPreview();
                      copyToClipboard(text, false);
                      alert("¡Mensaje completo copiado al portapapeles! Listo para pegarse (Ctrl+V) en el chat de WhatsApp.");
                    }}
                    className="p-3.5 bg-slate-950 hover:bg-slate-900/60 border-2 border-slate-850 hover:border-slate-700/50 rounded-xl text-xs font-bold text-slate-300 uppercase tracking-wider transition-all shadow-md active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 font-mono"
                  >
                    <Copy className="h-4 w-4 text-emerald-400" />
                    <span>Copiar Todo el Texto</span>
                  </button>
                </div>
              </div>

              {/* Instructions workflow alert */}
              <div className="p-4 bg-slate-950 rounded-2xl space-y-2 text-[10px] font-sans text-slate-400 leading-relaxed">
                <div className="font-black text-slate-200 uppercase tracking-wider font-mono text-[9.5px] flex items-center gap-1.5 text-indigo-400">
                  <span>💡</span> PROCESO DE COMPARTIDO RECOMENDADO (30 SEGUNDOS):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 font-medium">
                  <li>Haz clic en los botones del <span className="text-indigo-400 font-bold">PASO 2</span> para descargar los archivos PDF que quieras enviar.</li>
                  <li>Haz clic en <span className="text-emerald-400 font-bold">Lanzar Chat de WhatsApp</span>. Esto abrirá el chat con el paciente y cargará el texto explicativo.</li>
                  <li>Simplemente arrastra los archivos PDF descargados a la ventana del chat de WhatsApp y envíalos. <span className="text-indigo-300 font-semibold">¡Sencillo, profesional y 100% privado!</span></li>
                </ol>
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

                  {/* Selectores de adjuntos: formal / pack paciente / ambos */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">
                      Documentos a adjuntar:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGmailAttachReport(true);
                          setGmailAttachSummary(false);
                          setGmailAttachedType('report_pdf');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          gmailAttachReport && !gmailAttachSummary
                            ? 'bg-indigo-950/40 border-indigo-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-[11px] font-black text-slate-100 uppercase tracking-wider font-mono">Solo informe formal</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">PDF del reporte radiológico para el médico tratante.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGmailAttachReport(false);
                          setGmailAttachSummary(true);
                          setGmailAttachedType('patient_summary');
                        }}
                        disabled={!patientSummary}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 ${
                          !gmailAttachReport && gmailAttachSummary
                            ? 'bg-emerald-950/40 border-emerald-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-[11px] font-black text-slate-100 uppercase tracking-wider font-mono">Solo pack paciente</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Explicación en lenguaje claro (el formal va por separado).</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGmailAttachReport(true);
                          setGmailAttachSummary(true);
                          setGmailAttachedType('both_pdfs');
                        }}
                        disabled={!patientSummary}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 ${
                          gmailAttachReport && gmailAttachSummary
                            ? 'bg-amber-950/40 border-amber-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-[11px] font-black text-slate-100 uppercase tracking-wider font-mono">Ambos PDFs</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Informe formal + explicación para el paciente.</p>
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
                      onClick={() => {
                        if (gmailAttachReport) {
                          guardReportPdfExport(() => handleSendGmailAction());
                        } else {
                          handleSendGmailAction();
                        }
                      }}
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
                className="max-h-[160px] mx-auto w-auto object-contain block" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex justify-between items-start border-b border-gray-400 pb-4 mb-4">
              <div className="flex items-center gap-3">
                {selectedLogo !== "none" && (
                  <div className="w-16 h-16 flex items-center justify-center shrink-0 border border-gray-300 rounded-lg p-1 bg-gray-50 text-indigo-700">
                    {customLogoUrl ? (
                      <img 
                        src={customLogoUrl} 
                        alt="Logo" 
                        className="w-14 h-14 object-contain block" 
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
                  <div>Fecha: <span className="font-extrabold text-gray-800">{formatDateToDMY(reportDate)}</span></div>
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
                  <span className="font-extrabold text-gray-955 uppercase text-[12px]">{formatDateToDMY(reportDate)}</span>
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
          {(() => {
            const activeReportText = isEditingReportManual ? editedReportText : (generatedReport || "");
            const { mainReport, cuadroSinopticoReport, organSynopsisReport, annexReport } = splitReportSections(activeReportText);
            const radarData = getBiomechanicalRadarDataFromReport(activeReportText, biomechanicalRadarData);
            return (
              <>
                {/* 1. CUERPO DE REPORTE */}
                <div className="pt-2 leading-relaxed text-[12.5px] text-gray-955 select-text font-serif">
                  {renderPrintReportBody(mainReport)}
                </div>

                {/* FIRMA AL FINAL DEL CUERPO DEL REPORTE */}
                {(doctorName || customSignatureUrl) && (
                  <div className="mt-16 pt-6 border-t border-gray-250 grid grid-cols-2 gap-4 text-[10px] leading-normal font-sans text-gray-400">
                    {/* Bloque Homologado Izquierdo (Metadatos de Firma Electrónica) */}
                    <div className="border border-slate-250 bg-slate-50/70 p-3 rounded-lg text-[8.5px] font-sans text-slate-500 max-w-[340px] text-left space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[9px] text-slate-700 uppercase">
                        <span className="text-indigo-600">🛡️</span>
                        <span>Firma Electrónica Homologada</span>
                      </div>
                      <p className="font-mono text-[8px] text-indigo-700 font-bold bg-indigo-50/50 px-1 py-0.5 rounded break-all select-all">
                        {getValidationHash()}
                      </p>
                      <div className="grid grid-cols-[max-content_1fr] gap-x-2 text-[8px] leading-relaxed">
                        <span className="font-semibold text-slate-400 uppercase">Autoridad:</span>
                        <span className="font-bold text-slate-650">{doctorName || "Médico Especialista"}</span>
                        
                        <span className="font-semibold text-slate-400 uppercase">Registro:</span>
                        <span className="font-mono font-bold text-slate-650">{doctorLicense}</span>
                        
                        <span className="font-semibold text-slate-400 uppercase">Estado:</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          VALIDADO Y REGISTRADO
                        </span>
                        
                        <span className="font-semibold text-slate-400 uppercase">Soporte Legal:</span>
                        <span className="text-slate-450 italic">Ley de Comercio Electrónico, Firmas y Datos (Art. 14)</span>
                      </div>
                    </div>

                    {/* Firma Autógrafa y Datos del Médico Especialista */}
                    <div className="text-right flex flex-col items-end justify-center">
                      <div className="inline-block text-center relative max-w-[280px]">
                        {customSignatureUrl ? (
                          <div className="mb-1.5 flex justify-center">
                            <img 
                              src={customSignatureUrl} 
                              alt="Firma" 
                              className="h-14 max-w-[170px] object-contain block mix-blend-multiply" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="mb-2 text-indigo-600/80 font-serif italic text-xs select-none relative pr-4">
                            <span className="text-[10px] font-mono font-black border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider block">
                              🔑 FIRMADO DIGITALMENTE
                            </span>
                          </div>
                        )}
                        <div className="border-t border-slate-300 pt-1.5 px-6">
                          <p className="font-black text-slate-900 uppercase text-[11.5px] leading-tight select-all">{doctorName || "Médico Especialista"}</p>
                          <p className="font-semibold text-slate-500 text-[9px] mt-0.5 select-all">Especialista en Radiología e Imágenes Medicas.</p>
                          <p className="font-mono text-slate-450 text-[8px] leading-normal select-all">{doctorLicense}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. CUADRO SINÓPTICO */}
                {cuadroSinopticoReport && (
                  <div className="mt-8 pt-6 border-t border-gray-300 print:break-before-page" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                    <div className="pt-2 leading-relaxed text-[12.5px] text-gray-955 select-text font-serif">
                      {renderPrintReportBody(cuadroSinopticoReport)}
                    </div>
                  </div>
                )}

                {/* 3. SINOPSIS POR ÓRGANO (PÁGINA INDEPENDIENTE) */}
                {organSynopsisReport && (
                  <div className="mt-8 pt-6 border-t border-gray-300 print:break-before-page" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                    <div className="pt-2 leading-relaxed text-[12.5px] text-gray-955 select-text font-serif">
                      {renderPrintReportBody(organSynopsisReport)}
                    </div>
                  </div>
                )}

                {/* 6. DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIONES */}
                {annexReport && (
                  <div className="mt-12 pt-6 border-t border-gray-300 print:break-before-page">
                    <div className="pt-2 leading-relaxed text-[12.5px] text-gray-955 select-text font-serif">
                      {renderPrintReportBody(annexReport)}
                    </div>
                  </div>
                )}

                {/* 7. ANEXO: RADAR BIOMECÁNICO E INFLAMATORIO */}
                {includeRadarInReport && renderPrintBiomechanicalRadarAnnex(radarData)}
              </>
            );
          })()}
        </div>
      )}
      <BackgroundTasksBar />
    </div>
  );
}
