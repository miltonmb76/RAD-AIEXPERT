/**
 * Bake a horizontal mirror into a data-URL image so PDF/export see the flip
 * (CSS scale-x alone does not affect jsPDF).
 */
export function flipImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!dataUrl || typeof dataUrl !== "string") {
      reject(new Error("No image to flip"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D unavailable"));
          return;
        }
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        // Prefer PNG to keep quality after flip
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for flip"));
    img.src = dataUrl;
  });
}

/** Swap common Spanish laterality labels after a corrective mirror flip. */
export function swapLateralityLabel(laterality?: string): string | undefined {
  if (!laterality) return laterality;
  const t = laterality.trim();
  const lower = t.toLowerCase();
  if (lower.includes("bilateral") || lower.includes("ambos") || lower.includes("línea") || lower.includes("linea")) {
    return t;
  }
  if (lower.includes("izq")) {
    return t.replace(/izquierda/gi, "Derecha").replace(/izquierdo/gi, "Derecho").replace(/izq\.?/gi, "Der.");
  }
  if (lower.includes("der")) {
    return t.replace(/derecha/gi, "Izquierda").replace(/derecho/gi, "Izquierdo").replace(/der\.?/gi, "Izq.");
  }
  return t;
}
