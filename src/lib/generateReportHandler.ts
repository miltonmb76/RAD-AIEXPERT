import { CloudStudy, saveStudyToCloud } from "../firebaseDb";
import { idbSaveHistory, idbSaveStudy } from "../localDb";
import { SavedReport } from "./appLocalTypes";
import { getSpecificSuiteShortcut } from "./suiteShortcuts";

export type GenerateReportHandlerDeps = {
  triggerAutoImageEvaluation: any;
  fetchCloudStudies: any;
  autoLabelImagesAfterReport: any;
  DEFAULT_BATCH_MODULES: any;
  FULL_REPORT_BATCH_MODULES: any;
  abdomen3dData: any;
  abdominalWall3dData: any;
  ankle3dData: any;
  annotations: any;
  atlas3dData: any;
  attachedImages: any;
  autoActivateSpecificSuite: any;
  autoClinicalPolish: any;
  autoDetectSpecificStudyAndModality: any;
  base64Image: any;
  breast3dData: any;
  clinicName: any;
  clinicalHistory: any;
  customLogoRightUrl: any;
  customLogoStyle: any;
  customLogoUrl: any;
  customSignatureUrl: any;
  doctorLicense: any;
  doctorName: any;
  findings: any;
  findings3dRenders: any;
  focalLesion3dData: any;
  generatedReport: any;
  gmailUser: any;
  handleActivateBatchModules: any;
  includeAbdomen3dInReport: boolean;
  includeAbdominalWall3dInReport: boolean;
  includeAnkle3dInReport: boolean;
  includeAtlas3dInReport: boolean;
  includeBreast3dInReport: boolean;
  includeFocalLesion3dInReport: boolean;
  includeKidney3dInReport: boolean;
  includeKnee3dInReport: boolean;
  includeMuscleTendon3dInReport: boolean;
  includeScrotum3dInReport: boolean;
  includeShoulder3dInReport: boolean;
  includeThyroid3dInReport: boolean;
  includeUsPlaneSimulatorInReport: boolean;
  includeVascular3dInReport: boolean;
  includeWrist3dInReport: boolean;
  inputReport: any;
  kidney3dData: any;
  knee3dData: any;
  modality: any;
  modelFor: any;
  muscleTendon3dData: any;
  operationalSummaryText: any;
  patientAge: any;
  patientEmail: any;
  patientGender: any;
  patientId: any;
  patientName: any;
  patientSummary: any;
  pdfLayoutType: any;
  reportDate: any;
  runClinicalPolishForReport: any;
  savedReports: any;
  scrotum3dData: any;
  selectedFile: any;
  selectedLogo: any;
  selectedLogoRight: any;
  setAdditionalEvalError: (...args: any[]) => void;
  setAdditionalEvaluation: (...args: any[]) => void;
  setBibliography: (...args: any[]) => void;
  setBibliographyError: (...args: any[]) => void;
  setBibliographySources: (...args: any[]) => void;
  setCaseAnalysis: (...args: any[]) => void;
  setCaseAnalysisError: (...args: any[]) => void;
  setClassRecommendations: (...args: any[]) => void;
  setCurrentCloudStudyId: (...args: any[]) => void;
  setCurrentModInstruction: (...args: any[]) => void;
  setGeneratedReport: (...args: any[]) => void;
  setGenerationSteps: (...args: any[]) => void;
  setImageEvaluation: (...args: any[]) => void;
  setIncorporatedRecs: (...args: any[]) => void;
  setIsGenerating: (...args: any[]) => void;
  setIsMainReportExpanded: (...args: any[]) => void;
  setModifyError: (...args: any[]) => void;
  setOperationalSummaryText: (...args: any[]) => void;
  setOriginalBaseReport: (...args: any[]) => void;
  setPatientSummary: (...args: any[]) => void;
  setPatientSummaryError: (...args: any[]) => void;
  setReportEnrichmentSession: (...args: any[]) => void;
  setReportError: (...args: any[]) => void;
  setReportHistory: (...args: any[]) => void;
  setReportRedoHistory: (...args: any[]) => void;
  setSavedReports: (...args: any[]) => void;
  setSelectedBatchModules: (...args: any[]) => void;
  shoulder3dData: any;
  specificStudy: any;
  studyType: any;
  systemInstruction: any;
  thyroid3dData: any;
  uploadedReportContent: any;
  uploadedReportMimeType: any;
  usImagesGridMode: any;
  usPlaneSimulatorData: any;
  vascular3dData: any;
  wrist3dData: any;
};

export function createGenerateReportHandler(d: GenerateReportHandlerDeps) {
  return async (mode: "simple" | "full" = "full") => {
    const {
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
      triggerAutoImageEvaluation} = d;

    if (!studyType.trim()) {
      setReportError("Por favor, especifica el Tipo de Estudio solicitado.");
      return;
    }

    // Reset current cloud study ID for the newly generated report
    setCurrentCloudStudyId("");

    // Open the report workspace immediately so generation progress and the result stay in focus.
    setIsMainReportExpanded(true);
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
    setOperationalSummaryText("");
    setPatientSummary(null);
    setPatientSummaryError(null);

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
          model: modelFor("report"),
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
            caption: img.caption || "",
            modality: img.modality || "",
            projection: img.projection || "",
            side: img.side || "",
          })) : undefined,
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        const textResponse = await response.text().catch(() => "");
        throw new Error(`La respuesta del servidor no es JSON válido (Código HTTP ${response.status}). Detalle: ${textResponse.slice(0, 200) || "Sin respuesta del servidor"}`);
      }

      clearInterval(stepInterval);

      if (response.ok && data.success) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setOriginalBaseReport(data.report);
        setReportEnrichmentSession(null);

        if (attachedImages.length > 0) {
          void autoLabelImagesAfterReport(String(data.report || ""));
          // Lleva al usuario a la galeria donde veran las fotos ya rotuladas.
          window.setTimeout(() => {
            document.getElementById("attached-images-gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 250);
        }

        if (mode === "full") {
          const batchSelection = { ...FULL_REPORT_BATCH_MODULES };
          const suiteShortcut = autoActivateSpecificSuite
            ? getSpecificSuiteShortcut(specificStudy, modality) ||
              getSpecificSuiteShortcut(studyType || "", "")
            : null;
          if (suiteShortcut) {
            batchSelection[suiteShortcut.id] = true;
          }
          const reportText = String(data.report || "").trim();
          setSelectedBatchModules(batchSelection);
          void handleActivateBatchModules(reportText, batchSelection);
          if (autoClinicalPolish) {
            void runClinicalPolishForReport(reportText);
          }
        } else {
          setSelectedBatchModules({ ...DEFAULT_BATCH_MODULES });
        }

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
            userId: gmailUser?.uid || "local",
            userEmail: gmailUser?.email || "anon@local.com",
            timestamp: newReport.timestamp,
            patientName: patientName || "Paciente Local",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "Médico Radiólogo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Clínica Privada",
            studyType,
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "Hallazgos guardados automáticamente.",
            reportText: data.report,
            attachedImages: attachedImages || [],
            operationalSummaryText: "",
            pdfBase64: "",
            patientSummary: null,
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
            createdAt: new Date().toISOString(),
            specificStudy: specificStudy || "General",
            pdfLayoutType: pdfLayoutType || "classic",
            selectedLogo: selectedLogo || "none",
            selectedLogoRight: selectedLogoRight || "none",
            customLogoStyle: customLogoStyle || "left",
            customLogoUrl: customLogoUrl || "",
            customLogoRightUrl: customLogoRightUrl || "",
          };

          // Save into IndexedDB reliably
          await idbSaveStudy(autoStudy);

          const storedStudies = localStorage.getItem("rad_local_studies");
          let studiesList: CloudStudy[] = storedStudies ? JSON.parse(storedStudies) : [];
          studiesList = [autoStudy, ...studiesList.filter(s => s.id !== autoStudy.id)];
          try {
            localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
          } catch (e) {}

          if (gmailUser?.uid) {
            try {
              const cloudStudy = {
                ...autoStudy,
                attachedImages: [],
                findings3dRenders: [],
                atlas3dData: null,
                vascular3dData: null,
                thyroid3dData: null,
                breast3dData: null,
                shoulder3dData: null,
                knee3dData: null,
                ankle3dData: null,
                kidney3dData: null,
                abdomen3dData: null,
                abdominalWall3dData: null,
                scrotum3dData: null,
                muscleTendon3dData: null,
                wrist3dData: null,
                focalLesion3dData: null,
                usPlaneSimulatorData: null,
                customLogoUrl: "",
                customSignatureUrl: "",
              };
              const { userId: _userId, userEmail: _userEmail, ...studyPayload } = cloudStudy;
              await saveStudyToCloud(gmailUser.uid, gmailUser.email || "", studyPayload);
            } catch (cloudError) {
              console.warn("El reporte se guard� localmente pero no pudo sincronizarse:", cloudError);
            }
          }

          // Re-fetch cloud/local studies to update UI
          fetchCloudStudies(gmailUser?.uid);
        } catch (autoErr) {
          console.warn("Error auto-saving study to local archive:", autoErr);
        }

        // If base64Image is present, automatically trigger image evaluation
        if (base64Image) {
          triggerAutoImageEvaluation(base64Image, selectedFile?.type, studyType, clinicalHistory, findings, annotations);
        }
        return String(data.report || "");
      } else {
        setReportError(data.error || `Error del servidor (Código ${response.status}): ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      clearInterval(stepInterval);
      setReportError(`Falla de red o de servidor: ${error?.message || String(error)}. Asegúrate de que el servidor está encendido y que tu API Key en la pestaña de Configuración es correcta.`);
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
    return undefined;
  };
}
