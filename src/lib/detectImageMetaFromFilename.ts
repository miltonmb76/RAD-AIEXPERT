export type DetectedImageMeta = {
  modality: "MMG" | "US";
  projection: "MLO" | "CC" | "OTRO";
  side: "Derecha" | "Izquierda" | "Bilateral";
};

/** Infer MMG/US modality, projection, and laterality from filename + DICOM tags. */
export function detectImageMetaFromFilename(
  filename: string,
  dicomMeta?: Record<string, string>,
  specificStudy?: string
): DetectedImageMeta {
  const upper = (
    filename +
    " " +
    JSON.stringify(dicomMeta || {}) +
    " " +
    (specificStudy || "")
  ).toUpperCase();
  let modality: DetectedImageMeta["modality"] = "US";
  let projection: DetectedImageMeta["projection"] = "OTRO";
  let side: DetectedImageMeta["side"] = "Bilateral";

  if (
    upper.includes("MMG") ||
    upper.includes("MAMO") ||
    upper.includes("MX") ||
    upper.includes("MLO") ||
    upper.includes("CC") ||
    upper.includes("MAMOGRAFIA") ||
    upper.includes("MAMMO") ||
    dicomMeta?.Modality === "MG"
  ) {
    modality = "MMG";
  }

  if (upper.includes("MLO") || upper.includes("OBLIQ") || upper.includes("OBLIU")) {
    projection = "MLO";
  } else if (upper.includes("CC") || upper.includes("CRANEO") || upper.includes("CAUDAL")) {
    projection = "CC";
  }

  if (
    upper.includes("IZQ") ||
    upper.includes("LEFT") ||
    upper.includes("LCC") ||
    upper.includes("LMLO") ||
    upper.includes("L-CC") ||
    upper.includes("L-MLO")
  ) {
    side = "Izquierda";
  } else if (
    upper.includes("DER") ||
    upper.includes("RIGHT") ||
    upper.includes("RCC") ||
    upper.includes("RMLO") ||
    upper.includes("R-CC") ||
    upper.includes("R-MLO")
  ) {
    side = "Derecha";
  } else {
    side = "Bilateral";
  }

  return { modality, projection, side };
}
