import { VascularStudyType } from "../types";

/** Modality-aware labels for the Vascular page-1 clinical dossier. */
export function vascularDossierLabels(studyType?: VascularStudyType | string | null): {
  fichaTitle: string;
  summary: string;
  wallPlaque: string;
  velocity: string;
  keyPoints: string;
} {
  const t = String(studyType || "").toLowerCase();

  if (t.includes("venoso")) {
    return {
      fichaTitle: "FICHA CLÍNICA VENOSA (CORRELACIÓN CON LA FIGURA 3D)",
      summary: "RESUMEN VENOSO",
      wallPlaque: "COMPRESIBILIDAD / TROMBO",
      velocity: "FLUJO / REFLUJO / COMPETENCIA",
      keyPoints: "PUNTOS CLAVE",
    };
  }

  if (t.includes("arterial_mmii") || (t.includes("arterial") && !t.includes("carotid"))) {
    return {
      fichaTitle: "FICHA CLÍNICA ARTERIAL (CORRELACIÓN CON LA FIGURA 3D)",
      summary: "RESUMEN ARTERIAL",
      wallPlaque: "PARED / PLACA / OCLUSIÓN",
      velocity: "ONDA / PSV / RELACIÓN DE VELOCIDAD",
      keyPoints: "PUNTOS CLAVE",
    };
  }

  if (t.includes("renal")) {
    return {
      fichaTitle: "FICHA CLÍNICA RENAL (CORRELACIÓN CON LA FIGURA 3D)",
      summary: "RESUMEN DE ARTERIAS RENALES",
      wallPlaque: "PARED / HALLAZGO LUMINAL",
      velocity: "PSV / RAR / ÍNDICE DE RESISTIVIDAD",
      keyPoints: "PUNTOS CLAVE",
    };
  }

  if (t.includes("aorto") || t.includes("iliac")) {
    return {
      fichaTitle: "FICHA CLÍNICA AORTO-ILÍACA (CORRELACIÓN CON LA FIGURA 3D)",
      summary: "RESUMEN AORTO-ILÍACO",
      wallPlaque: "PARED / CALCIFICACIÓN / ANEURISMA",
      velocity: "DIÁMETRO / PSV / PATRÓN",
      keyPoints: "PUNTOS CLAVE",
    };
  }

  // Default: carotid / vertebral / general vascular
  return {
    fichaTitle: "FICHA CLÍNICA HEMODINÁMICA (CORRELACIÓN CON LA FIGURA 3D)",
    summary: "SÍNTESIS HEMODINÁMICA",
    wallPlaque: "PARED / PLACA / CIMT",
    velocity: "VELOCIDADES / ÍNDICES (PSV·EDV·RAR)",
    keyPoints: "PUNTOS CLAVE",
  };
}
