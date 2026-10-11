import type { ClinicalScorecardData, UsPlaneSimulatorData } from "../types";
import { pickBridgeFocalPanel } from "./usPlaneBridge";

export type CaseStoryboardAudience = "clinician" | "patient";

export type CaseStoryboardRole =
  | "context"
  | "finding"
  | "anatomy3d"
  | "justification"
  | "impression"
  | "custom";

export interface CaseStoryboardFrame {
  id: string;
  role: CaseStoryboardRole;
  step: number;
  clinicianTitle: string;
  clinicianBody: string;
  patientTitle: string;
  patientBody: string;
  imageUrl?: string | null;
  imageCaption?: string | null;
}

export interface CaseStoryboardData {
  title: string;
  patientTitle?: string;
  studyRegion?: string;
  diagnosis?: string;
  patientDiagnosis?: string;
  frames: CaseStoryboardFrame[];
  activeAudience?: CaseStoryboardAudience;
  includeClinicianInPdf?: boolean;
  includePatientInPdf?: boolean;
  generatedAt?: string;
}

const ROLE_ORDER: CaseStoryboardRole[] = [
  "context",
  "finding",
  "anatomy3d",
  "justification",
  "impression",
];

const ROLE_FALLBACK: Record<
  CaseStoryboardRole,
  { clinicianTitle: string; patientTitle: string }
> = {
  context: { clinicianTitle: "Contexto clinico", patientTitle: "Por que se hizo el estudio" },
  finding: { clinicianTitle: "Hallazgo clave", patientTitle: "Lo que se vio" },
  anatomy3d: { clinicianTitle: "Anatomia 3D", patientTitle: "Donde esta" },
  justification: { clinicianTitle: "Justificacion", patientTitle: "Por que importa" },
  impression: { clinicianTitle: "Impresion", patientTitle: "En resumen" },
  custom: { clinicianTitle: "Nota", patientTitle: "Nota" },
};

function trim(s: unknown, max = 320): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function asRole(raw: unknown): CaseStoryboardRole {
  const r = String(raw || "").toLowerCase().trim();
  if (ROLE_ORDER.includes(r as CaseStoryboardRole)) return r as CaseStoryboardRole;
  if (r === "custom") return "custom";
  return "custom";
}

export function caseStoryboardIsRenderable(
  data: CaseStoryboardData | null | undefined
): data is CaseStoryboardData {
  if (!data?.frames?.length) return false;
  return data.frames.some(
    (f) => trim(f.clinicianTitle) || trim(f.clinicianBody) || trim(f.patientTitle)
  );
}

export function normalizeCaseStoryboardData(
  raw: any,
  opts?: { diagnosis?: string }
): CaseStoryboardData {
  const framesIn = Array.isArray(raw?.frames)
    ? raw.frames
    : Array.isArray(raw?.vinetas)
      ? raw.vinetas
      : Array.isArray(raw?.panels)
        ? raw.panels
        : [];

  const frames: CaseStoryboardFrame[] = framesIn
    .map((f: any, i: number) => {
      const role = asRole(f?.role || ROLE_ORDER[i] || "custom");
      const fb = ROLE_FALLBACK[role];
      return {
        id: trim(f?.id, 40) || `frame-${i + 1}`,
        role,
        step: Number(f?.step) > 0 ? Number(f.step) : i + 1,
        clinicianTitle: trim(f?.clinicianTitle || f?.title || fb.clinicianTitle, 80),
        clinicianBody: trim(f?.clinicianBody || f?.body || f?.detail, 280),
        patientTitle: trim(f?.patientTitle || fb.patientTitle, 80),
        patientBody: trim(f?.patientBody || f?.patientDetail || f?.clinicianBody, 280),
        imageUrl: f?.imageUrl ? String(f.imageUrl) : null,
        imageCaption: f?.imageCaption ? trim(f.imageCaption, 120) : null,
      };
    })
    .filter((f) => f.clinicianTitle || f.clinicianBody || f.patientTitle)
    .slice(0, 6);

  // Prefer canonical role order when possible
  frames.sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role);
    const bi = ROLE_ORDER.indexOf(b.role);
    if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi;
    return a.step - b.step;
  });
  frames.forEach((f, i) => {
    f.step = i + 1;
  });

  const dx = trim(opts?.diagnosis || raw?.diagnosis, 160);
  return {
    title: trim(raw?.title, 100) || "Storyboard del caso",
    patientTitle: trim(raw?.patientTitle, 100) || "La historia de su estudio",
    studyRegion: trim(raw?.studyRegion, 80) || undefined,
    diagnosis: dx || undefined,
    patientDiagnosis: trim(raw?.patientDiagnosis || dx, 160) || undefined,
    frames,
    activeAudience:
      raw?.activeAudience === "patient" ? "patient" : "clinician",
    includeClinicianInPdf: raw?.includeClinicianInPdf !== false,
    includePatientInPdf: raw?.includePatientInPdf !== false,
    generatedAt: raw?.generatedAt || new Date().toISOString(),
  };
}

/** Attach eco real + corte 3D (bridge) onto finding / anatomy frames. */
export function attachStoryboardImages(
  data: CaseStoryboardData,
  opts: {
    usPlaneData?: UsPlaneSimulatorData | null;
    galleryUrl?: string | null;
    galleryCaption?: string | null;
    fallback3dUrl?: string | null;
    fallback3dCaption?: string | null;
  }
): CaseStoryboardData {
  const realUs =
    opts.usPlaneData?.realUsImage?.url ||
    opts.galleryUrl ||
    null;
  const realCaption =
    opts.usPlaneData?.realUsImage?.caption ||
    opts.usPlaneData?.lesionTarget ||
    opts.galleryCaption ||
    "Eco real";
  const focal = pickBridgeFocalPanel(opts.usPlaneData);
  const anatomyUrl = focal?.imageUrl || opts.fallback3dUrl || null;
  const anatomyCaption =
    opts.usPlaneData?.lesionTarget ||
    focal?.panelTitle ||
    focal?.anatomicalFocus ||
    opts.fallback3dCaption ||
    "Corte 3D focal";

  const frames = data.frames.map((f) => {
    if (f.role === "finding" && realUs && !f.imageUrl) {
      return { ...f, imageUrl: realUs, imageCaption: trim(realCaption, 120) };
    }
    if (f.role === "anatomy3d" && anatomyUrl && !f.imageUrl) {
      return {
        ...f,
        imageUrl: anatomyUrl,
        imageCaption: trim(anatomyCaption, 120),
      };
    }
    return f;
  });

  return { ...data, frames };
}

/** Soft client seed when API unavailable — still dual-tone, uses scorecard/report hints. */
export function seedCaseStoryboardFromContext(opts: {
  studyType?: string;
  clinicalHistory?: string;
  diagnosisAnchor?: string;
  scorecardData?: ClinicalScorecardData | null;
  reportSnippet?: string;
}): CaseStoryboardData {
  const dx =
    trim(opts.diagnosisAnchor) ||
    trim(opts.scorecardData?.categoryAssigned) ||
    "Hallazgo dominante";
  const history = trim(opts.clinicalHistory, 200);
  const summary = trim(opts.scorecardData?.clinicalSummary, 220);
  const reco = trim(opts.scorecardData?.recommendation, 200);
  const region = trim(opts.studyType || opts.scorecardData?.studyRegion, 80);

  return normalizeCaseStoryboardData({
    title: "Storyboard del caso",
    patientTitle: "La historia de su estudio",
    studyRegion: region,
    diagnosis: dx,
    patientDiagnosis: dx,
    frames: [
      {
        role: "context",
        clinicianTitle: "Contexto clinico",
        clinicianBody:
          history ||
          `Estudio ${region || "ecografico"} con sospecha orientada al hallazgo dominante.`,
        patientTitle: "Por que se hizo el estudio",
        patientBody:
          history ||
          "Su medico solicito esta ecografia para revisar la zona que le molesta.",
      },
      {
        role: "finding",
        clinicianTitle: "Hallazgo clave",
        clinicianBody: summary || `Hallazgo dominante: ${dx}.`,
        patientTitle: "Lo que se vio",
        patientBody: `En las imagenes destaca: ${dx}.`,
      },
      {
        role: "anatomy3d",
        clinicianTitle: "Anatomia 3D",
        clinicianBody: `Correlacion eco-anatomica del objetivo: ${dx}.`,
        patientTitle: "Donde esta",
        patientBody: "Esta vista 3D muestra la misma zona que la ecografia, para ubicarla mejor.",
      },
      {
        role: "justification",
        clinicianTitle: "Justificacion",
        clinicianBody:
          summary ||
          `Los signos del informe sostienen el diagnostico de «${dx}».`,
        patientTitle: "Por que importa",
        patientBody:
          "Ese hallazgo explica los sintomas y ayuda a decidir el siguiente paso con su medico.",
      },
      {
        role: "impression",
        clinicianTitle: "Impresion",
        clinicianBody: reco || `Impresion: ${dx}.`,
        patientTitle: "En resumen",
        patientBody: reco
          ? `Conclusion en palabras sencillas: ${reco}`
          : `Conclusion: ${dx}. Su medico le indicara la conducta.`,
      },
    ],
  });
}

export function storyboardFrameCopy(
  frame: CaseStoryboardFrame,
  audience: CaseStoryboardAudience
): { title: string; body: string } {
  if (audience === "patient") {
    return {
      title: frame.patientTitle || frame.clinicianTitle,
      body: frame.patientBody || frame.clinicianBody,
    };
  }
  return {
    title: frame.clinicianTitle,
    body: frame.clinicianBody,
  };
}
