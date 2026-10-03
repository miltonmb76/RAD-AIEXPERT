import { idbSaveUserSettings } from "../localDb";
import type { PersistBrandingOverrides } from "./brandingPersistence";

export type SettingsBackupSnapshot = {
  rad_local_studies: string | null;
  radiology_reports_history: string | null;
  rad_worklist_current: string | null;
  doctorName: string | null;
  doctorLicense: string | null;
  clinicName: string | null;
  customLogos: string;
  selectedLogo: string | null;
  selectedLogoRight: string | null;
  customLogoStyle: string | null;
  customSignature: string | null;
  pdfLayoutType: string | null;
  radiology_sys_inst: string | null;
  radiology_chat_inst: string | null;
  radiology_class_inst: string | null;
};

export type ExportBackupInput = {
  customLogos: Array<{ id: string; name: string; url: string }>;
  selectedLogo: string;
  selectedLogoRight: string;
  customLogoStyle: string;
  customSignatureUrl: string;
};

export function buildSettingsBackup(input: ExportBackupInput): SettingsBackupSnapshot {
  return {
    rad_local_studies: localStorage.getItem("rad_local_studies"),
    radiology_reports_history: localStorage.getItem("radiology_reports_history"),
    rad_worklist_current: localStorage.getItem("rad_worklist_current"),
    doctorName: localStorage.getItem("radiology_doctor_name"),
    doctorLicense: localStorage.getItem("radiology_doctor_license"),
    clinicName: localStorage.getItem("radiology_clinic_name"),
    // Prefer in-memory logos (IndexedDB-backed) — localStorage may be empty after quota overflow.
    customLogos: JSON.stringify(input.customLogos),
    selectedLogo: input.selectedLogo || localStorage.getItem("rad_selected_logo"),
    selectedLogoRight: input.selectedLogoRight || localStorage.getItem("rad_selected_logo_right"),
    customLogoStyle: input.customLogoStyle || localStorage.getItem("rad_custom_logo_style"),
    customSignature: input.customSignatureUrl || localStorage.getItem("rad_custom_signature"),
    pdfLayoutType: localStorage.getItem("radiology_pdf_layout"),
    radiology_sys_inst: localStorage.getItem("radiology_sys_inst"),
    radiology_chat_inst: localStorage.getItem("radiology_chat_inst"),
    radiology_class_inst: localStorage.getItem("radiology_class_inst"),
  };
}

export function downloadSettingsBackupJson(data: SettingsBackupSnapshot): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `respaldo_radiologia_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportAllDataDeps = {
  selectedLogo: string;
  selectedLogoRight: string;
  customLogoStyle: string;
  customSignatureUrl: string;
  systemInstruction: string;
  chatInstruction: string;
  classifyInstruction: string;
  setWorklist: (v: any) => void;
  setDoctorName: (v: string) => void;
  setDoctorLicense: (v: string) => void;
  setClinicName: (v: string) => void;
  setCustomLogos: (v: any) => void;
  setSelectedLogo: (v: string) => void;
  setSelectedLogoRight: (v: string) => void;
  setCustomLogoStyle: (v: string) => void;
  setCustomSignatureUrl: (v: string) => void;
  setPdfLayoutType: (v: any) => void;
  setSystemInstruction: (v: string) => void;
  setChatInstruction: (v: string) => void;
  setClassifyInstruction: (v: string) => void;
  persistBrandingAssets: (overrides?: PersistBrandingOverrides) => void | Promise<void>;
};

export function createImportAllDataHandler(d: ImportAllDataDeps) {
  return (event: { target: HTMLInputElement | EventTarget | null }) => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content) as Partial<SettingsBackupSnapshot>;

        if (backup.rad_local_studies) {
          localStorage.setItem("rad_local_studies", backup.rad_local_studies);
        }
        if (backup.radiology_reports_history) {
          localStorage.setItem("radiology_reports_history", backup.radiology_reports_history);
        }
        if (backup.rad_worklist_current) {
          localStorage.setItem("rad_worklist_current", backup.rad_worklist_current);
          try {
            d.setWorklist(JSON.parse(backup.rad_worklist_current));
          } catch {
            /* ignore */
          }
        }
        if (backup.doctorName) {
          localStorage.setItem("radiology_doctor_name", backup.doctorName);
          d.setDoctorName(backup.doctorName);
        }
        if (backup.doctorLicense) {
          localStorage.setItem("radiology_doctor_license", backup.doctorLicense);
          d.setDoctorLicense(backup.doctorLicense);
        }
        if (backup.clinicName) {
          localStorage.setItem("radiology_clinic_name", backup.clinicName);
          d.setClinicName(backup.clinicName);
        }
        if (backup.customLogos) {
          try {
            localStorage.setItem("rad_custom_logos", backup.customLogos);
          } catch (err) {
            console.warn("Backup logos too large for localStorage; restoring via IndexedDB only:", err);
          }
          try {
            const parsedLogos = JSON.parse(backup.customLogos);
            d.setCustomLogos(parsedLogos);
            void d.persistBrandingAssets({
              customLogos: parsedLogos,
              selectedLogo: backup.selectedLogo || d.selectedLogo,
              selectedLogoRight: backup.selectedLogoRight || d.selectedLogoRight,
              customLogoStyle: backup.customLogoStyle || d.customLogoStyle,
              customSignatureUrl: backup.customSignature || d.customSignatureUrl,
            });
          } catch {
            /* ignore */
          }
        }
        if (backup.selectedLogo) {
          try {
            localStorage.setItem("rad_selected_logo", backup.selectedLogo);
          } catch {
            /* ignore */
          }
          d.setSelectedLogo(backup.selectedLogo);
        }
        if (backup.selectedLogoRight) {
          try {
            localStorage.setItem("rad_selected_logo_right", backup.selectedLogoRight);
          } catch {
            /* ignore */
          }
          d.setSelectedLogoRight(backup.selectedLogoRight);
        }
        if (backup.customLogoStyle) {
          try {
            localStorage.setItem("rad_custom_logo_style", backup.customLogoStyle);
          } catch {
            /* ignore */
          }
          d.setCustomLogoStyle(backup.customLogoStyle);
        }
        if (backup.customSignature) {
          try {
            localStorage.setItem("rad_custom_signature", backup.customSignature);
          } catch {
            /* ignore */
          }
          d.setCustomSignatureUrl(backup.customSignature);
          void d.persistBrandingAssets({ customSignatureUrl: backup.customSignature });
        }
        if (backup.pdfLayoutType) {
          localStorage.setItem("radiology_pdf_layout", backup.pdfLayoutType);
          d.setPdfLayoutType(backup.pdfLayoutType as any);
        }
        if (backup.radiology_sys_inst) {
          localStorage.setItem("radiology_sys_inst", backup.radiology_sys_inst);
          d.setSystemInstruction(backup.radiology_sys_inst);
        }
        if (backup.radiology_chat_inst) {
          localStorage.setItem("radiology_chat_inst", backup.radiology_chat_inst);
          d.setChatInstruction(backup.radiology_chat_inst);
        }
        if (backup.radiology_class_inst) {
          localStorage.setItem("radiology_class_inst", backup.radiology_class_inst);
          d.setClassifyInstruction(backup.radiology_class_inst);
        }
        if (backup.radiology_sys_inst || backup.radiology_chat_inst || backup.radiology_class_inst) {
          void idbSaveUserSettings({
            systemInstruction: backup.radiology_sys_inst || d.systemInstruction,
            chatInstruction: backup.radiology_chat_inst || d.chatInstruction,
            classifyInstruction: backup.radiology_class_inst || d.classifyInstruction,
            updatedAt: Date.now(),
          });
        }

        alert("¡Éxito! Respaldo de datos importado y restaurado correctamente.");
        window.location.reload();
      } catch (err: any) {
        alert("El archivo de respaldo no es válido o está corrupto: " + err.message);
      }
    };
    reader.readAsText(file);
  };
}
