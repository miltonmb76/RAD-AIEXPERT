import type { Worklist, WorklistPatient } from "../firebaseDb";
import { formatCostaRicaPhone } from "./appFormatters";
import { setBridgeActivePatient } from "./localBridge";

export interface WorklistSessionDeps {
  worklist: Worklist | null;
  selectedWorklistPatientId: string | null;
  generatedReport: string;
  clinicalHistory: string;
  attachedImages: Array<unknown>;
  saveWorklist: (patients: WorklistPatient[]) => void | Promise<void>;
  handleUpdatePatientStatus: (patientId: string, status: "pending" | "attended" | "current") => void;
  importBridgeCapturesForPatient: (patientId: string) => void | Promise<void>;
  setSelectedWorklistPatientId: (id: string | null) => void;
  setIsWorklistSidebarOpen: (open: boolean) => void;
  setCurrentCloudStudyId: (id: string) => void;
  setBridgeCaptureMismatch: (v: any) => void;
  setLabelQueueTrigger: (n: number) => void;
  setLabelingStats: (s: { confirmed: number; total: number }) => void;
  setIsLabelQueueOpen: (open: boolean) => void;
  setPatientName: (v: string) => void;
  setPatientAge: (v: string) => void;
  setPatientGender: (v: string) => void;
  setPatientId: (v: string) => void;
  setStudyType: (v: string) => void;
  setWhatsappPhone: (v: string) => void;
}

export function createWorklistSessionHandlers(d: WorklistSessionDeps) {
  const handleSelectWorklistPatient = (patient: WorklistPatient) => {
    if (!d.worklist) return;

    const hasSessionContent = Boolean(
      d.generatedReport.trim() ||
        d.clinicalHistory.trim() ||
        d.attachedImages.length > 0
    );
    const switchingPatient =
      d.selectedWorklistPatientId &&
      patient.id !== d.selectedWorklistPatientId &&
      hasSessionContent;
    const currentPatientName =
      d.worklist.patients.find((p) => p.id === d.selectedWorklistPatientId)?.name || "el paciente actual";

    if (
      switchingPatient &&
      !window.confirm(
        `�Cambiar al paciente ${patient.name}? Tienes datos del reporte o im�genes de ${currentPatientName} sin finalizar.`
      )
    ) {
      return;
    }

    // Reset current cloud study ID for a new patient
    d.setCurrentCloudStudyId("");
    d.setBridgeCaptureMismatch(null);
    d.setLabelQueueTrigger(0);
    d.setLabelingStats({ confirmed: 0, total: 0 });
    d.setIsLabelQueueOpen(false);

    // Update states in the main report generator form
    d.setPatientName(patient.name);
    d.setPatientAge(patient.age);
    d.setPatientGender(patient.gender);
    d.setPatientId(patient.patientId);
    if (patient.studyType) {
      d.setStudyType(patient.studyType);
    }
    if (patient.phone) {
      const formatted = formatCostaRicaPhone(patient.phone);
      d.setWhatsappPhone(formatted);
      localStorage.setItem("rad_whatsapp_phone", formatted);
    }

    // Update statuses
    const updatedPatients = d.worklist.patients.map(p => {
      if (p.id === patient.id) {
        return { ...p, status: 'current' as const };
      } else if (p.status === 'current') {
        return { ...p, status: 'attended' as const };
      }
      return p;
    });

    d.setSelectedWorklistPatientId(patient.id);
    d.saveWorklist(updatedPatients);

    const dicomPatientId = patient.patientId || "";
    if (dicomPatientId) {
      setBridgeActivePatient({
        patientId: dicomPatientId,
        internalId: patient.id,
        name: patient.name,
      });
      void d.importBridgeCapturesForPatient(dicomPatientId);
    }
  };


  const handleFinishActivePatient = () => {
    if (!d.worklist || !d.selectedWorklistPatientId) {
      d.setIsWorklistSidebarOpen(true);
      return;
    }

    const activePatient = d.worklist.patients.find((p) => p.id === d.selectedWorklistPatientId);
    const activeName = activePatient?.name || "este paciente";
    const hasSessionContent = Boolean(
      d.generatedReport.trim() ||
        d.clinicalHistory.trim() ||
        d.attachedImages.length > 0
    );

    if (
      hasSessionContent &&
      !window.confirm(`�Finalizar caso de ${activeName}? El paciente quedar� marcado como atendido.`)
    ) {
      return;
    }

    d.handleUpdatePatientStatus(d.selectedWorklistPatientId, "attended");
    d.setSelectedWorklistPatientId(null);
    d.setBridgeCaptureMismatch(null);
    d.setLabelQueueTrigger(0);
    d.setLabelingStats({ confirmed: 0, total: 0 });
    d.setIsLabelQueueOpen(false);
  };


  return { handleSelectWorklistPatient, handleFinishActivePatient };
}
