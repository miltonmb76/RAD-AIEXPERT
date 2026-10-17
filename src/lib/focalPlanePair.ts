/**
 * Orthogonal CGI plane pairs for Focal Lesion 3D.
 * MSK tendons (shoulder, etc.) → coronal + sagittal; visceral default → AP/coronal + LAT/sagittal.
 */

export type FocalPlaneId = "coronal" | "sagittal" | "axial" | "ap" | "lat";

export type FocalPlaneSpec = {
  id: FocalPlaneId;
  /** English camera/view string for spatialContract.view */
  view: string;
  /** Short Spanish label for UI badges */
  labelEs: string;
  /** Panel title in Spanish */
  titleEs: string;
};

export type FocalPlanePair = {
  /** Study family used for the choice */
  family:
    | "shoulder_tendon"
    | "msk_tendon"
    | "knee"
    | "ankle"
    | "wrist"
    | "breast"
    | "visceral"
    | "default";
  a: FocalPlaneSpec;
  b: FocalPlaneSpec;
  /** One-line Spanish hint for planner / UI */
  rationaleEs: string;
};

const CORONAL: FocalPlaneSpec = {
  id: "coronal",
  view: "coronal clinical cutaway (frontal / AP-equivalent anatomic plane)",
  labelEs: "Coronal",
  titleEs: "Plano coronal",
};

const SAGITTAL: FocalPlaneSpec = {
  id: "sagittal",
  view: "sagittal clinical cutaway (lateral anatomic plane, 90° from coronal)",
  labelEs: "Sagital",
  titleEs: "Plano sagital",
};

const AP: FocalPlaneSpec = {
  id: "ap",
  view: "AP / coronal clinical view (patient facing camera)",
  labelEs: "AP",
  titleEs: "Plano AP / coronal",
};

const LAT: FocalPlaneSpec = {
  id: "lat",
  view: "LAT / sagittal clinical view (true lateral, 90° from AP)",
  labelEs: "LAT",
  titleEs: "Plano lateral (LAT)",
};

const AXIAL: FocalPlaneSpec = {
  id: "axial",
  view: "axial / transverse clinical cutaway",
  labelEs: "Axial",
  titleEs: "Plano axial",
};

function hay(...parts: Array<string | undefined | null>): string {
  return parts.map((p) => String(p || "").toLowerCase()).join(" ");
}

/**
 * Pick the orthogonal plane pair for a study / lesion focus.
 * Shoulder cuff / tendons → coronal + sagittal (clinically useful for tears).
 */
export function resolveFocalPlanePair(opts: {
  organOrStudy?: string;
  reportText?: string;
  focusText?: string;
  lesionLabel?: string;
  lesionSite?: string;
}): FocalPlanePair {
  const t = hay(
    opts.organOrStudy,
    opts.focusText,
    opts.lesionLabel,
    opts.lesionSite,
    // Only a short head of the report — enough for region keywords, not full PHI dump cost
    String(opts.reportText || "").slice(0, 1200)
  );

  const shoulder =
    /hombro|shoulder|manguito|rotator|supraespin|infraespin|subescapul|redondo\s+menor|biceps\s+largo|porci[oó]n\s+larga|tend[oó]n.*hombro|hombro.*tend/.test(
      t
    );
  const knee = /rodilla|knee|menisc|lca|lcp|acl|pcl|colateral|patelar|cuadricip/.test(t);
  const ankle = /tobillo|ankle|aquiles|peroneo|tibial\s+post|fascia\s+plantar/.test(t);
  const wrist = /mu[nñ]eca|wrist|t[uú]nel\s+carpiano|extensor|flexor\s+dig/.test(t);
  const muscleTendon =
    /m[uú]sculo.?tend|tendinopat|tend[oó]n|rotura\s+parcial|rotura\s+completa|desgarro/.test(t);
  const breast = /mama|breast|birads|cuadrante|pez[oó]n/.test(t);
  const visceral =
    /abdomen|h[ií]gado|ves[ií]cula|p[aá]ncreas|bazo|ri[nñ][oó]n|v[ií]as\s+urin|pr[oó]stata|tiroides|escroto|test[ií]culo/.test(
      t
    );

  if (shoulder) {
    return {
      family: "shoulder_tendon",
      a: CORONAL,
      b: SAGITTAL,
      rationaleEs:
        "Hombro / manguito: coronal + sagital coherentes de la misma lesión tendinosa.",
    };
  }
  if (knee) {
    return {
      family: "knee",
      a: CORONAL,
      b: SAGITTAL,
      rationaleEs: "Rodilla: coronal + sagital de la misma lesión.",
    };
  }
  if (ankle) {
    return {
      family: "ankle",
      a: SAGITTAL,
      b: CORONAL,
      rationaleEs: "Tobillo / Aquiles: sagital + coronal de la misma lesión.",
    };
  }
  if (wrist) {
    return {
      family: "wrist",
      a: CORONAL,
      b: AXIAL,
      rationaleEs: "Muñeca: coronal + axial de la misma lesión.",
    };
  }
  if (muscleTendon) {
    return {
      family: "msk_tendon",
      a: CORONAL,
      b: SAGITTAL,
      rationaleEs: "MSK / tendón: coronal + sagital de la misma lesión.",
    };
  }
  if (breast) {
    return {
      family: "breast",
      a: AP,
      b: SAGITTAL,
      rationaleEs: "Mama: AP/coronal + sagital de la misma lesión (reloj AP en el primer plano).",
    };
  }
  if (visceral) {
    return {
      family: "visceral",
      a: AP,
      b: LAT,
      rationaleEs: "Visceral: AP/coronal + LAT/sagital de la misma lesión.",
    };
  }
  return {
    family: "default",
    a: CORONAL,
    b: SAGITTAL,
    rationaleEs: "Par por defecto: coronal + sagital de la misma lesión.",
  };
}

/** Badge / PDF short tag for a panel. */
export function focalPlaneBadge(panel: {
  panelRole?: string;
  panelTitle?: string;
  spatialContract?: { view?: string } | null;
}): string {
  const blob = `${panel.panelTitle || ""} ${panel.spatialContract?.view || ""}`.toLowerCase();
  if (/sagital|sagittal/.test(blob)) return "Sagital";
  if (/axial|transvers/.test(blob)) return "Axial";
  if (/\blat\b|lateral/.test(blob) && !/coronal/.test(blob)) return "LAT";
  if (/plano ap|ap\s*\/\s*coronal|\bap\b/.test(blob) && !/sagitt/.test(blob)) return "AP";
  if (/coronal|frontal/.test(blob)) return "Coronal";
  if (panel.panelRole === "plane_b" || panel.panelRole === "macro") return "Plano B";
  if (panel.panelRole === "plane_a") return "Plano A";
  return "Contexto";
}
