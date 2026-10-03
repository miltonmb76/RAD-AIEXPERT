import { uploadPdfToDrive } from "./googleDrive";

export type DriveSaveDeps = {
  patientName: string;
  patientSummary: any;
  handleDownloadNativePDF: (...args: any[]) => Promise<any>;
  handleDownloadPatientSummaryPDF: (...args: any[]) => Promise<any>;
  setIsUploadingToDrive: (v: boolean) => void;
  setDriveUploadStatus: (v: string) => void;
};

export function createDriveSaveAction(d: DriveSaveDeps) {
  return async () => {
    try {
      d.setIsUploadingToDrive(true);
      d.setDriveUploadStatus("Verificando sesión...");

      const { getAccessToken, googleSignIn } = await import("../firebaseAuth");
      let token = await getAccessToken();

      if (!token) {
        d.setDriveUploadStatus("Autenticando con Google...");
        try {
          const authRes = await googleSignIn();
          if (authRes) {
            token = authRes.accessToken;
          }
        } catch (e) {
          console.error(e);
          d.setDriveUploadStatus("Error: No se pudo autenticar.");
          setTimeout(() => d.setDriveUploadStatus(""), 3000);
          return;
        }
      }

      if (!token) {
        d.setDriveUploadStatus("Error: No autenticado.");
        setTimeout(() => d.setDriveUploadStatus(""), 3000);
        return;
      }

      d.setDriveUploadStatus("Generando Reporte Oficial...");
      const reportBlob = await d.handleDownloadNativePDF(
        false,
        false,
        false,
        false,
        undefined,
        true
      );

      if (!reportBlob) {
        d.setDriveUploadStatus("Error: No se pudo generar el reporte.");
        setTimeout(() => d.setDriveUploadStatus(""), 3000);
        return;
      }

      d.setDriveUploadStatus("Subiendo a Google Drive...");
      const reportName = d.patientName
        ? `${d.patientName.trim()}_reporte.pdf`
        : "reporte_radiologico.pdf";

      try {
        await uploadPdfToDrive(reportBlob, reportName, token, "BASE DE DATOS");
      } catch (uploadError: any) {
        if (
          uploadError.message &&
          (uploadError.message.includes("401") || uploadError.message.includes("403"))
        ) {
          d.setDriveUploadStatus("Permisos insuficientes. Re-autenticando...");
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

      if (d.patientSummary) {
        d.setDriveUploadStatus("Subiendo Explicación a Drive...");
        const summaryBlob = await d.handleDownloadPatientSummaryPDF(
          false,
          false,
          false,
          false,
          true
        );
        if (summaryBlob) {
          const summaryName = d.patientName
            ? `Explicacion_${d.patientName.trim().replace(/\s+/gi, "_")}.pdf`
            : "explicacion_paciente.pdf";
          await uploadPdfToDrive(summaryBlob, summaryName, token, "BASE DE DATOS");
        }
      }

      d.setDriveUploadStatus("¡Guardado Exitosamente en Drive!");
      setTimeout(() => d.setDriveUploadStatus(""), 4000);
    } catch (error) {
      console.error("Error al subir a Google Drive:", error);
      d.setDriveUploadStatus("Error al subir a Google Drive.");
      setTimeout(() => d.setDriveUploadStatus(""), 4000);
    } finally {
      d.setIsUploadingToDrive(false);
    }
  };
}
