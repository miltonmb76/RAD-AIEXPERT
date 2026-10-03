/** Biomechanical radar PDF helpers extracted from App.tsx */
export const getRadarTitle = (modeOrData?: string | { radarMode?: string } | null): string => {
  const mode = typeof modeOrData === "string"
    ? modeOrData
    : (modeOrData?.radarMode || "");
  switch (mode) {
    case "rotator_cuff": return "RADAR BIOMECÁNICO: MANGUITO ROTADOR";
    case "knee_oa": return "RADAR BIOMECÁNICO: GONARTROSIS";
    case "cholecystitis": return "RADAR: COLECISTITIS / VÍA BILIAR";
    case "ankle_trauma": return "RADAR BIOMECÁNICO: TOBILLO";
    case "hepatic": return "RADAR: HEPATOPATÍA / HÍGADO";
    case "renal": return "RADAR: RIÑÓN INTEGRAL";
    case "scrotal": return "RADAR: ESCROTO";
    case "appendicitis": return "RADAR: APENDICITIS AGUDA";
    case "thyroid": return "RADAR: TIROIDES";
    case "knee_trauma": return "RADAR: TRAUMA DE RODILLA";
    case "muscle_injury": return "RADAR: LESIÓN MUSCULAR";
    case "visceral": return "RADAR: VISCERAL / INFLAMATORIO";
    case "oncology": return "RADAR: ONCOLÓGICO / ESTRUCTURAL";
    case "urinary_prostate": return "RADAR: VÍAS URINARIAS / PRÓSTATA";
    case "diverticulitis": return "RADAR: DIVERTICULITIS";
    case "msk": return "RADAR: MÚSCULO-ESQUELÉTICO";
    default: return "RADAR BIOMECÁNICO E INFLAMATORIO MULTIVECTOR";
  }
};

export const getShortRadarAxisLabel = (label: string, maxLen: number = 22): string => {
  const raw = (label || "").trim();
  if (!raw) return "";
  // Guard: if maxLen is accidentally a string (e.g. radarMode), ignore it
  const limit = typeof maxLen === "number" && Number.isFinite(maxLen) && maxLen > 0
    ? Math.floor(maxLen)
    : 22;
  if (raw.length <= limit) return raw;
  return raw.substring(0, Math.max(1, limit - 1)) + "...";
};

export const sanitizeRadarPdfText = (text: string): string => {
  if (!text) return "";
  return String(text)
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2260/g, "!=")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u2248/g, "~")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00D7/g, "x")
    // Mojibake of UTF-8 <= / >= when decoded incorrectly
    .replace(/\u00E2\u2030\u00A4/g, "<=")
    .replace(/\u00E2\u2030\u00A5/g, ">=")
    .replace(/\u00C2\u00B1/g, "+/-")
    .trim();
};

export const getBiomechanicalRadarDataFromReport = (reportText: string, radarData: any) => {
  return radarData || null;
};
