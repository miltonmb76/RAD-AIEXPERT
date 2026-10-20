import { triggerBrowserDownload } from "./triggerBrowserDownload";

/** Trigger a browser download from a base64 PDF payload */
export function downloadPdfFromBase64(base64: string, filename: string) {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const result = triggerBrowserDownload(blob, filename || "reporte.pdf");
    if (!result.ok) {
      throw new Error(result.error || "No se pudo iniciar la descarga del PDF.");
    }
  } catch (err) {
    console.error("Error downloading PDF from base64:", err);
    alert("Error al descargar el PDF guardado. Intente de nuevo.");
  }
}
