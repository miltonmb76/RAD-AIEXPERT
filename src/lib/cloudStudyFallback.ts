import type { CloudStudy } from "../firebaseDb";
import type { SavedReport } from "./appLocalTypes";

export function convertLocalReportsToFallbackCloudStudies(
  uid: string,
  deps: { userEmail?: string; doctorName?: string; doctorLicense?: string; clinicName?: string }
): CloudStudy[] {
  try {
    const localKey = `fallback_studies_${uid}`;
    const cached = localStorage.getItem(localKey);
    let cachedStudies: CloudStudy[] = [];
    if (cached) {
      try { cachedStudies = JSON.parse(cached); } catch (e) {}
    }
    
    const storedReports = localStorage.getItem("radiology_reports_history");
    if (storedReports) {
      try {
        const localReports = JSON.parse(storedReports) as SavedReport[];
        let updated = [...cachedStudies];
        let changed = false;
        
        localReports.forEach(rep => {
          if (!updated.some(s => s.id === rep.id)) {
            const newCloudStudy: CloudStudy = {
              id: rep.id,
              userId: uid,
              userEmail: deps.userEmail || "anon@local.com",
              timestamp: rep.timestamp,
              patientName: "Paciente Local (Respaldo)",
              patientEmail: "No especificado",
              patientAge: "",
              patientGender: "",
              patientId: "",
              reportDate: new Date().toISOString().split('T')[0],
              doctorName: deps.doctorName || "Médico Radiólogo",
              doctorLicense: deps.doctorLicense || "",
              clinicName: deps.clinicName || "",
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
            updated.push(newCloudStudy);
            changed = true;
            localStorage.setItem(`fallback_single_study_${rep.id}`, JSON.stringify(newCloudStudy));
          }
        });
        
        if (changed) {
          localStorage.setItem(localKey, JSON.stringify(updated));
          return updated;
        }
      } catch (e) {
        console.error("Error parsing local reports history inside conversion:", e);
      }
    }
    return cachedStudies;
  } catch (err) {
    console.error("Failed to convert local reports:", err);
    return [];
  }
};

