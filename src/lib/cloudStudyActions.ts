import type { CloudStudy } from "../firebaseDb";
import { getStudiesFromCloud, saveStudyToCloud, deleteStudyFromCloud } from "../firebaseDb";
import type { SavedReport } from "./appLocalTypes";
import { idbGetAllStudies, idbSaveStudy, idbSaveHistory, idbDeleteStudy } from "../localDb";
import { downloadPdfFromBase64 } from "./downloadPdfFromBase64";

export type CloudStudyActionsDeps = {
  gmailUser: { uid?: string; email?: string } | null;
  doctorName: string;
  doctorLicense: string;
  clinicName: string;
  currentCloudStudyId: string;
  studyType: string;
  clinicalHistory: string;
  generatedReport: string;
  customLogoUrl: string;
  customLogoRightUrl: string;
  customSignatureUrl: string;
  customLogoStyle: string;
  patientName: string;
  patientEmail: string;
  patientAge: string;
  patientGender: string;
  patientId: string;
  reportDate: string;
  findings: string;
  operationalSummaryText: string;
  specificStudy: string;
  pdfLayoutType: string;
  selectedLogo: string;
  selectedLogoRight: string;
  attachedImages: any[];
  findings3dRenders: any[];
  patientSummary: any;
  compressImageBase64: (dataUrl: string, maxDim: number, quality: number) => Promise<string>;
  handleDownloadNativePDF: (...args: any[]) => Promise<any>;
  setIsLoadingCloudStudies: (v: boolean) => void;
  setCloudStudiesError: (v: string | null) => void;
  setCloudStudies: (v: CloudStudy[] | ((prev: CloudStudy[]) => CloudStudy[])) => void;
  setSavedReports: (v: SavedReport[] | ((prev: SavedReport[]) => SavedReport[])) => void;
  setMigrationProgress: (v: string) => void;
  setIsSavingToCloud: (v: boolean) => void;
  setCloudStudiesSuccess: (v: string | null) => void;
  setCurrentCloudStudyId: (v: string) => void;
  setCopiedEhrStudyId: (v: string | null) => void;
};

export function createCloudStudyActions(d: CloudStudyActionsDeps) {
  const fetchCloudStudies = async (uid?: string) => {
    d.setIsLoadingCloudStudies(true);
    d.setCloudStudiesError(null);
    try {
      // 1. Fetch from IndexedDB persistent storage
      const idbStudies = await idbGetAllStudies();

      // 2. Fetch from LocalStorage fallback
      let stored = localStorage.getItem("rad_local_studies");
      let localStudies: CloudStudy[] = stored ? JSON.parse(stored) : [];

      // Merge IDB studies and LocalStorage studies without duplicates (IDB has rich full data)
      const studyMap = new Map<string, CloudStudy>();
      localStudies.forEach(s => studyMap.set(s.id, s));
      idbStudies.forEach(s => studyMap.set(s.id, s));

      let studies: CloudStudy[] = Array.from(studyMap.values());

      // Continuous sync from radiology_reports_history so no generated study is ever lost
      const storedReports = localStorage.getItem("radiology_reports_history");
      if (storedReports) {
        try {
          const oldReports = JSON.parse(storedReports) as SavedReport[];
          if (Array.isArray(oldReports) && oldReports.length > 0) {
            oldReports.forEach(rep => {
              if (!studies.some(s => s.id === rep.id)) {
                const syncedStudy: CloudStudy = {
                  id: rep.id,
                  userId: "local",
                  userEmail: "anon@local.com",
                  timestamp: rep.timestamp,
                  patientName: "Paciente Local",
                  patientEmail: "No especificado",
                  patientAge: "",
                  patientGender: "",
                  patientId: "",
                  reportDate: new Date().toISOString().split('T')[0],
                  doctorName: d.doctorName || "Médico Radiólogo",
                  doctorLicense: d.doctorLicense || "No especificada",
                  clinicName: d.clinicName || "Clínica Privada",
                  studyType: rep.studyType,
                  clinicalHistory: rep.clinicalHistory,
                  findings: "Hallazgos guardados localmente.",
                  reportText: rep.reportText,
                  attachedImages: [],
                  operationalSummaryText: "",
                  pdfBase64: "",
                  patientSummary: null,
                  createdAt: new Date().toISOString()
                };
                studies.unshift(syncedStudy);
                idbSaveStudy(syncedStudy);
              }
            });
          }
        } catch (e) {
          console.error("Error migrating old reports:", e);
        }
      }

      // Merge the authenticated user's Firestore studies. Local copies win
      // when they contain richer browser-only data such as source images.
      if (uid && uid !== "local") {
        try {
          const remoteStudies = await getStudiesFromCloud(uid);
          remoteStudies.forEach((study) => {
            if (!studyMap.has(study.id)) {
              studyMap.set(study.id, study);
            }
          });
          studies = Array.from(studyMap.values());

          // Make synchronized text reports visible in the existing History UI
          // on every computer without duplicating locally generated entries.
          d.setSavedReports((currentReports) => {
            const mergedReports = new Map<string, SavedReport>();
            remoteStudies.forEach((study) => {
              mergedReports.set(study.id, {
                id: study.id,
                timestamp: study.timestamp,
                studyType: study.studyType,
                clinicalHistory: study.clinicalHistory,
                reportText: study.reportText,
              });
            });
            currentReports.forEach((report) => mergedReports.set(report.id, report));
            const synchronizedReports = Array.from(mergedReports.values()).slice(0, 50);
            localStorage.setItem("radiology_reports_history", JSON.stringify(synchronizedReports));
            idbSaveHistory(synchronizedReports);
            return synchronizedReports;
          });
        } catch (cloudError) {
          console.warn("No se pudo sincronizar Firestore; se conserva el archivo local:", cloudError);
          d.setCloudStudiesError("No se pudo sincronizar con la nube. Tus estudios locales siguen disponibles.");
        }
      }

      studies.sort((a, b) => {
        const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return tB - tA;
      });

      d.setCloudStudies(studies);
    } catch (e: any) {
      console.error("Error fetching local studies:", e);
      d.setCloudStudies([]);
    } finally {
      d.setIsLoadingCloudStudies(false);
    }
  };

  const migrateBackupStudiesToFirebase = async () => {
    d.setMigrationProgress("Sincronización Cloud desactivada. Tus estudios ya están respaldados localmente de forma segura.");
  };

  const downloadPdfForCloudStudy = async (item: CloudStudy) => {
    try {
      if (item.pdfBase64) {
        const cleanName = (item.patientName || "estudio").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadPdfFromBase64(item.pdfBase64, `informe_${cleanName}_${item.id}.pdf`);
        return;
      }

      // No pdfBase64, generate it on-the-fly using d.handleDownloadNativePDF with override!
      await d.handleDownloadNativePDF(false, false, false, false, item);
    } catch (err) {
      console.error("Error al generar PDF de la nube:", err);
      alert("Error al generar el PDF para este estudio.");
    }
  };

  const handleSaveToCloud = async (customReport?: SavedReport) => {
    d.setIsSavingToCloud(true);
    d.setCloudStudiesError(null);
    d.setCloudStudiesSuccess(null);

    try {
      const idToSave = customReport?.id || d.currentCloudStudyId || Math.random().toString(36).substring(2, 11);
      const studyTypeToSave = customReport?.studyType || d.studyType || "Estudio General";
      const clinicalHistoryToSave = customReport?.clinicalHistory || d.clinicalHistory || "No especificada";
      const reportTextToSave = customReport?.reportText || d.generatedReport;

      if (!reportTextToSave) {
        throw new Error("No hay contenido de reporte para guardar. Primero genera o redacta un reporte.");
      }

      let pdfB64 = "";

      let compressedLogo = d.customLogoUrl || "";
      let compressedLogoRight = d.customLogoRightUrl || "";
      let compressedSignature = d.customSignatureUrl || "";
      if (compressedLogo && compressedLogo.startsWith("data:image")) {
        try {
          compressedLogo = await d.compressImageBase64(compressedLogo, 2400, 0.95);
        } catch (compErr) {
          console.error("Error compressing logo inside save to cloud:", compErr);
        }
      }
      if (compressedLogoRight && compressedLogoRight.startsWith("data:image")) {
        try {
          compressedLogoRight = await d.compressImageBase64(compressedLogoRight, 2400, 0.95);
        } catch (compErr) {
          console.error("Error compressing right logo inside save to cloud:", compErr);
        }
      }
      if (compressedSignature && compressedSignature.startsWith("data:image")) {
        try {
          compressedSignature = await d.compressImageBase64(compressedSignature, 1600, 0.95);
        } catch (compErr) {
          console.error("Error compressing signature inside save to cloud:", compErr);
        }
      }

      const newStudy: CloudStudy = {
        id: idToSave,
        userId: d.gmailUser?.uid || "local",
        userEmail: d.gmailUser?.email || "anon@local.com",
        timestamp: customReport?.timestamp || new Date().toLocaleString("es-ES", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        patientName: d.patientName || "Paciente Anónimo",
        patientEmail: d.patientEmail || "No especificado",
        patientAge: d.patientAge || "",
        patientGender: d.patientGender || "",
        patientId: d.patientId || "",
        reportDate: d.reportDate || new Date().toISOString().split('T')[0],
        doctorName: d.doctorName || "Médico Radiólogo",
        doctorLicense: d.doctorLicense || "No especificada",
        clinicName: d.clinicName || "Clínica Privada",
        studyType: studyTypeToSave,
        clinicalHistory: clinicalHistoryToSave,
        findings: d.findings || "No especificadas",
        reportText: reportTextToSave,
        pdfBase64: pdfB64,
        operationalSummaryText: d.operationalSummaryText,
        customLogoUrl: compressedLogo,
        customLogoRightUrl: compressedLogoRight,
        customLogoStyle: d.customLogoStyle || "logo",
        customSignatureUrl: compressedSignature,
        specificStudy: d.specificStudy || "Tórax",
        pdfLayoutType: d.pdfLayoutType || "classic",
        selectedLogo: d.selectedLogo || "none",
        selectedLogoRight: d.selectedLogoRight || "none",
        attachedImages: d.attachedImages || [],
        findings3dRenders: d.findings3dRenders || [],
        patientSummary: d.patientSummary || null
      };

      // Save full study object into IndexedDB persistent storage
      await idbSaveStudy(newStudy);

      // Save lightweight copy to LocalStorage fallback
      try {
        const stored = localStorage.getItem("rad_local_studies");
        let studiesList: CloudStudy[] = stored ? JSON.parse(stored) : [];
        const lightStudy = { ...newStudy, pdfBase64: "", attachedImages: [] };
        const index = studiesList.findIndex(s => s.id === idToSave);
        if (index >= 0) {
          studiesList[index] = lightStudy;
        } else {
          studiesList = [lightStudy, ...studiesList];
        }
        localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
      } catch (lsErr) {
        console.warn("LocalStorage lleno, estudio completo guardado de forma segura en IndexedDB:", lsErr);
      }

      let synchronizedToCloud = false;
      if (d.gmailUser?.uid) {
        try {
          // Firestore documents must remain below 1 MiB. Images, signatures
          // and generated PDFs stay in IndexedDB; the clinical text and
          // metadata synchronize across the owner's computers.
          const cloudStudy = {
            ...newStudy,
            pdfBase64: "",
            attachedImages: [],
            findings3dRenders: [],
            customLogoUrl: "",
            customLogoRightUrl: "",
            customSignatureUrl: "",
          };
          const { userId: _userId, userEmail: _userEmail, ...studyPayload } = cloudStudy;
          await saveStudyToCloud(d.gmailUser.uid, d.gmailUser.email || "", studyPayload);
          synchronizedToCloud = true;
        } catch (cloudError) {
          console.error("Error synchronizing study with Firestore:", cloudError);
          d.setCloudStudiesError("El estudio se guardó localmente, pero no pudo sincronizarse con la nube.");
        }
      }

      d.setCurrentCloudStudyId(idToSave);
      d.setCloudStudiesSuccess(
        synchronizedToCloud
          ? "¡Estudio guardado y sincronizado con tu nube privada!"
          : "¡Estudio guardado con éxito en tu Archivo Local!"
      );
      fetchCloudStudies(d.gmailUser?.uid);
      setTimeout(() => d.setCloudStudiesSuccess(null), 4500);
      return idToSave;
    } catch (e: any) {
      console.error("Error saving to local storage:", e);
      d.setCloudStudiesError("No se pudo guardar localmente: " + (e.message || String(e)));
    } finally {
      d.setIsSavingToCloud(false);
    }
  };

  const handleDeleteFromCloud = async (studyId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este estudio de tu archivo local? Esta acción no se puede deshacer.")) return;

    d.setCloudStudiesError(null);
    d.setCloudStudiesSuccess(null);
    try {
      await idbDeleteStudy(studyId);
      const stored = localStorage.getItem("rad_local_studies");
      if (stored) {
        let studiesList: CloudStudy[] = JSON.parse(stored);
        studiesList = studiesList.filter(s => s.id !== studyId);
        try {
          localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
        } catch (e) {}
      }
      if (d.gmailUser?.uid) {
        try {
          await deleteStudyFromCloud(studyId);
        } catch (cloudError) {
          console.warn("No se pudo eliminar la copia de Firestore:", cloudError);
          d.setCloudStudiesError("Se eliminó la copia local, pero no la copia sincronizada.");
        }
      }
      d.setCloudStudiesSuccess("Estudio eliminado de tu archivo.");
      fetchCloudStudies(d.gmailUser?.uid);
      setTimeout(() => d.setCloudStudiesSuccess(null), 3000);
    } catch (e: any) {
      console.error("Error deleting local study:", e);
      d.setCloudStudiesError("No se pudo eliminar el estudio: " + (e.message || String(e)));
    }
  };

  const handleCopyEhrLinkForStudy = async (item: CloudStudy) => {
    const shareUrl = `${window.location.origin}/?view_study=${item.id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      d.setCopiedEhrStudyId(item.id);
      setTimeout(() => d.setCopiedEhrStudyId(null), 2500);
    } catch (err) {
      console.error("Failed to copy EHR link text:", err);
      alert("No se pudo copiar el enlace automáticamente: " + shareUrl);
    }
  };

  const handleCopyEhrPortalLink = async () => {
    if (!d.gmailUser) {
      alert("Debe iniciar sesión con Google para usar el archivo en la nube y generar enlaces.");
      return;
    }

    let activeStudyId = d.currentCloudStudyId;

    // If not saved to cloud yet, automatically save it first!
    if (!activeStudyId) {
      if (!confirm("El reporte aún no se ha guardado en la nube. ¿Deseas guardarlo automáticamente ahora en tu Archivo Cloud para poder generar su enlace de expediente?")) {
        return;
      }
      try {
        const savedId = await handleSaveToCloud();
        if (savedId) {
          activeStudyId = savedId;
        } else {
          return; // failed or canceled
        }
      } catch (err) {
        console.error("Auto-save failed inside EHR copy link:", err);
        alert("Ocurrió un error al intentar guardar el estudio automáticamente.");
        return;
      }
    }

    if (!activeStudyId) return;

    const shareUrl = `${window.location.origin}/?view_study=${activeStudyId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      d.setCopiedEhrStudyId("current_active_report");
      setTimeout(() => d.setCopiedEhrStudyId(null), 2500);
    } catch (err) {
      console.error("Failed to copy EHR link text:", err);
      alert("No se pudo copiar el enlace automáticamente. El enlace es: " + shareUrl);
    }
  };

  return {
    fetchCloudStudies,
    migrateBackupStudiesToFirebase,
    downloadPdfForCloudStudy,
    handleSaveToCloud,
    handleDeleteFromCloud,
    handleCopyEhrLinkForStudy,
    handleCopyEhrPortalLink,
  };
}
