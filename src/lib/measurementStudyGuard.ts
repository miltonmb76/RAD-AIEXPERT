/**
 * Guard: keep measurement protocols aligned with the user-selected study type.
 * Prevents abdomen (etc.) from receiving lower-limb arterial / venous vessel lists,
 * and prevents vías urinarias from receiving hígado/bazo unless the report asks for them.
 */

export type MeasurementStudyFamily =
  | "abdomen"
  | "arterial_mmii"
  | "venoso_mmii"
  | "carotidas"
  | "tiroides_cuello"
  | "mama"
  | "pelvico"
  | "renal_vias"
  | "other";

function norm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify the declared study type (UI selection / API studyType). */
export function classifyMeasurementStudyFamily(studyType: string): MeasurementStudyFamily {
  const t = norm(studyType);
  if (!t) return "other";

  if (
    (t.includes("arterial") &&
      (t.includes("miembro") || t.includes("pierna") || t.includes("extrem"))) ||
    t.includes("doppler arterial")
  ) {
    return "arterial_mmii";
  }
  if (
    (t.includes("venoso") &&
      (t.includes("miembro") || t.includes("pierna") || t.includes("extrem"))) ||
    t.includes("doppler venoso")
  ) {
    return "venoso_mmii";
  }
  if (t.includes("carotid") || t.includes("carotida")) return "carotidas";
  if (t.includes("mama") || t.includes("mamograf") || t.includes("bi-rads") || t.includes("birads")) {
    return "mama";
  }
  if (t.includes("tiroides") || (t.includes("cuello") && !t.includes("carotid"))) {
    return "tiroides_cuello";
  }
  if (
    t.includes("pelvi") ||
    t.includes("ginec") ||
    t.includes("utero") ||
    t.includes("ovario") ||
    t.includes("obstetr")
  ) {
    return "pelvico";
  }
  // Vías urinarias / renal (isolated) — NOT full abdomen
  if (
    t.includes("vias urinarias") ||
    t.includes("via urinaria") ||
    t.includes("urinari") ||
    (t.includes("renal") && !t.includes("abdomen")) ||
    (t.includes("rinon") && !t.includes("abdomen"))
  ) {
    return "renal_vias";
  }
  if (
    t.includes("abdomen") ||
    t.includes("abdominal") ||
    t === "higado" ||
    t.includes("hepat")
  ) {
    return "abdomen";
  }
  return "other";
}

const PERIPHERAL_ARTERIAL_RE =
  /\b(iliaca|iliaco|femoral|poplitea|tibial|peronea|pedia|pedio|aic|afc|\baf\b|ata|atp|aper|aped)\b|arteria (iliaca|femoral|poplitea|tibial|peronea|pedia)/i;

const PERIPHERAL_VENOUS_RE =
  /\b(safena|tvp|vena femoral|vena poplitea|vena tibial|vena iliaca)\b/i;

const CAROTID_RE =
  /\b(carotida|carotideo|vertebral|miointimal|\bgim\b|acc\/aci|\bacc\b|\baci\b|\bace\b)\b/i;

const ABDOMEN_ORGAN_RE =
  /\b(higado|bazo|vesicula|pancreas|rinon|renal|coledoco|porta|esplen|elastograf|rigidez hepat)\b/i;

/** Organs that belong to full abdomen but NOT to isolated vías urinarias / renal US. */
const EXTRA_ABDOMEN_OUTSIDE_RENAL_RE =
  /\b(higado|bazo|vesicula|pancreas|coledoco|porta|esplen\w*|elastograf\w*|rigidez\s*hepat\w*|esteatos\w*|suprahepat\w*)\b/i;

const RENAL_VIAS_ANCHOR_RE =
  /\b(rinon|renal|vejiga|prostata|ureter|pelvis renal|calic|urinar|residuo|premiccional|postmiccional|pielocalic)\b/i;

/** True when a structure name belongs to lower-limb arterial Doppler. */
export function isPeripheralArterialStructure(structure: string): boolean {
  const n = norm(structure);
  if (!n) return false;
  // Renal arteries are abdominal / renal Doppler — not MMII
  if (n.includes("renal") || n.includes("aorta") || n.includes("mesenteric")) return false;
  return PERIPHERAL_ARTERIAL_RE.test(n);
}

export function isPeripheralVenousStructure(structure: string): boolean {
  return PERIPHERAL_VENOUS_RE.test(norm(structure));
}

export function isCarotidStructure(structure: string): boolean {
  return CAROTID_RE.test(norm(structure));
}

/** Hígado / bazo / vesícula / páncreas / elastografía — out of scope for vías urinarias. */
export function isExtraAbdomenOrganOutsideRenalVias(structure: string): boolean {
  const n = norm(structure);
  if (!n) return false;
  return EXTRA_ABDOMEN_OUTSIDE_RENAL_RE.test(n);
}

/**
 * True if the report (or free-text request) explicitly mentions the organ behind a structure name.
 * Used so vías urinarias can keep hígado/bazo only when the user/report asked for them.
 */
export function reportExplicitlyMentionsOrgan(report: string, structure: string): boolean {
  const r = norm(report);
  const n = norm(structure);
  if (!r || !n) return false;

  // Elastografía / rigidez: only if the report mentions elastography or stiffness (not mere "hígado")
  if (/elastograf/.test(n) || /rigidez\s*hepat/.test(n) || (/rigidez/.test(n) && /hepat/.test(n))) {
    return /elastograf/.test(r) || /rigidez/.test(r) || /\bqus\b/.test(r);
  }
  if (/\bhigado\b/.test(n)) {
    return (
      /\bhigado\b/.test(r) ||
      /\besteatos/.test(r) ||
      /\bhepatomegalia\b/.test(r) ||
      /\bhepatico\b/.test(r)
    );
  }
  if (/\bbazo\b/.test(n) || /\besplen/.test(n)) {
    return /\bbazo\b/.test(r) || /\besplen/.test(r);
  }
  if (/\bvesicula\b/.test(n)) {
    return /\bvesicula\b/.test(r) || /\bcolecist/.test(r);
  }
  if (/\bpancreas\b/.test(n)) {
    return /\bpancreas\b/.test(r) || /\bpancreat/.test(r);
  }
  if (/\bcoledoco\b/.test(n) || /\bporta\b/.test(n)) {
    return /\bcoledoco\b/.test(r) || /\bvia biliar/.test(r) || /\bporta\b/.test(r);
  }
  // Fallback: first meaningful token of the structure appears in the report
  const token = n.split(/[^a-z0-9]+/).find((t) => t.length >= 4);
  return token ? r.includes(token) : false;
}

export type FilterStructuresOpts = {
  /** When set, out-of-scope organs for renal_vias are kept only if mentioned here. */
  report?: string;
};

/**
 * Drop structures that are incompatible with the declared study family.
 * When studyType is empty/other, keep everything (legacy behaviour).
 */
export function filterStructuresForStudyType<T extends { structure: string }>(
  structures: T[],
  studyType: string,
  opts?: FilterStructuresOpts
): T[] {
  const family = classifyMeasurementStudyFamily(studyType);
  if (family === "other" || !Array.isArray(structures)) return structures || [];
  const report = opts?.report || "";

  return structures.filter((s) => {
    const name = String(s?.structure || "");
    switch (family) {
      case "abdomen":
        return (
          !isPeripheralArterialStructure(name) &&
          !isPeripheralVenousStructure(name) &&
          !isCarotidStructure(name)
        );
      case "renal_vias": {
        if (
          isPeripheralArterialStructure(name) ||
          isPeripheralVenousStructure(name) ||
          isCarotidStructure(name)
        ) {
          return false;
        }
        if (isExtraAbdomenOrganOutsideRenalVias(name)) {
          // Keep only if the report/user explicitly mentioned that organ
          return reportExplicitlyMentionsOrgan(report, name);
        }
        return true;
      }
      case "tiroides_cuello":
        return !isPeripheralArterialStructure(name) && !isCarotidStructure(name);
      case "mama":
      case "pelvico":
        return (
          !isPeripheralArterialStructure(name) &&
          !isPeripheralVenousStructure(name) &&
          !isCarotidStructure(name)
        );
      case "arterial_mmii":
        // Keep arterial MMII (+ generic); drop pure abdomen organs if they slipped in
        if (ABDOMEN_ORGAN_RE.test(norm(name)) && !isPeripheralArterialStructure(name)) {
          return false;
        }
        return !isPeripheralVenousStructure(name) && !isCarotidStructure(name);
      case "venoso_mmii":
        if (ABDOMEN_ORGAN_RE.test(norm(name)) && !isPeripheralVenousStructure(name)) {
          return false;
        }
        return !isPeripheralArterialStructure(name) && !isCarotidStructure(name);
      case "carotidas":
        return !isPeripheralArterialStructure(name) && !isPeripheralVenousStructure(name);
      default:
        return true;
    }
  });
}

/**
 * Server-side: should we treat this request as arterial MMII?
 * Requires explicit studyType OR strong report cues — never bare "inferior".
 */
export function shouldEnforceArterialMmiiProtocol(opts: {
  studyType?: string;
  detectedStudyType?: string;
  report?: string;
}): boolean {
  const input = classifyMeasurementStudyFamily(opts.studyType || "");
  if (input === "abdomen" || input === "renal_vias" || input === "tiroides_cuello" || input === "mama" || input === "pelvico") {
    return false;
  }
  if (input === "arterial_mmii") return true;

  const detected = classifyMeasurementStudyFamily(opts.detectedStudyType || "");
  if (detected === "arterial_mmii") return true;

  const r = norm(opts.report || "");
  if (!r) return false;

  // Strong cues only — do NOT match bare "inferior" (vena cava inferior / polo inferior)
  const hasDopplerOrArterial = r.includes("doppler") || r.includes("arterial");
  const hasMmiiAnchor =
    r.includes("miembro inferior") ||
    r.includes("miembros inferiores") ||
    r.includes("extremidad inferior") ||
    r.includes("extremidades inferiores") ||
    /\b(femoral comun|femoral superficial|arteria femoral|poplitea|tibial anterior|tibial posterior|arteria peronea|arteria pedia|pedio)\b/.test(
      r
    );

  return hasDopplerOrArterial && hasMmiiAnchor;
}

/**
 * Full abdomen protocol (hígado / bazo / elastografía mandatory).
 * NEVER true for declared vías urinarias / renal — those use renal_vias scope.
 */
export function shouldEnforceAbdomenProtocol(opts: {
  studyType?: string;
  detectedStudyType?: string;
  report?: string;
}): boolean {
  const input = classifyMeasurementStudyFamily(opts.studyType || "");
  if (
    input === "arterial_mmii" ||
    input === "venoso_mmii" ||
    input === "carotidas" ||
    input === "renal_vias" ||
    input === "tiroides_cuello" ||
    input === "mama" ||
    input === "pelvico"
  ) {
    return false;
  }
  if (input === "abdomen") return true;

  const detected = classifyMeasurementStudyFamily(opts.detectedStudyType || "");
  if (detected === "renal_vias") return false;
  if (detected === "abdomen") return true;

  const r = norm(opts.report || "");
  // Riñón solo NO implica abdomen completo (evita inyectar hígado/bazo en vías urinarias)
  return (
    r.includes("abdomen") ||
    r.includes("abdominal") ||
    r.includes("higado") ||
    r.includes("esteatosis") ||
    r.includes("bazo") ||
    r.includes("vesicula") ||
    r.includes("pancreas")
  );
}

/** Isolated vías urinarias / renal US — kidneys, bladder, prostate; not full abdomen. */
export function shouldEnforceRenalViasProtocol(opts: {
  studyType?: string;
  detectedStudyType?: string;
  report?: string;
}): boolean {
  const input = classifyMeasurementStudyFamily(opts.studyType || "");
  if (input === "renal_vias") return true;
  if (
    input === "abdomen" ||
    input === "arterial_mmii" ||
    input === "venoso_mmii" ||
    input === "carotidas" ||
    input === "tiroides_cuello" ||
    input === "mama" ||
    input === "pelvico"
  ) {
    return false;
  }

  const detected = classifyMeasurementStudyFamily(opts.detectedStudyType || "");
  if (detected === "renal_vias") return true;

  const r = norm(opts.report || "");
  if (!r) return false;
  const looksUrinary =
    r.includes("vias urinarias") ||
    r.includes("via urinaria") ||
    r.includes("urinari") ||
    (RENAL_VIAS_ANCHOR_RE.test(r) &&
      !r.includes("abdomen") &&
      !r.includes("higado") &&
      !r.includes("bazo") &&
      !r.includes("vesicula") &&
      !r.includes("pancreas"));
  return looksUrinary;
}

/** Short prompt clause: respect declared study scope (for checklist / second reader / scorecard). */
export function studyScopePromptClause(studyType: string): string {
  const family = classifyMeasurementStudyFamily(studyType);
  if (family === "renal_vias") {
    return (
      "ALCANCE DEL ESTUDIO (OBLIGATORIO): el tipo declarado es VÍAS URINARIAS / RENAL. " +
      "Limita TODO a riñones, uréteres, vejiga y próstata/útero solo si el informe lo menciona. " +
      "PROHIBIDO proponer, inventar o completar hallazgos de hígado, bazo, vesícula, páncreas, " +
      "vías biliares, elastografía hepática u otros órganos abdominales, SALVO que el informe " +
      "o el usuario los mencionen explícitamente."
    );
  }
  if (family === "abdomen") {
    return (
      "ALCANCE DEL ESTUDIO: ultrasonido de abdomen — cubre órganos abdominales pertinentes " +
      "(hígado, vesícula, páncreas, bazo, riñones, etc.) según el informe."
    );
  }
  if (studyType && studyType.trim()) {
    return (
      `ALCANCE DEL ESTUDIO (OBLIGATORIO): respeta el tipo declarado "${studyType.trim()}". ` +
      "No inventes órganos ni protocolos de otras regiones salvo mención explícita en el informe."
    );
  }
  return "";
}
