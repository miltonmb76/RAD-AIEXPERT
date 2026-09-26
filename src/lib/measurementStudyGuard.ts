/**
 * Guard: keep measurement protocols aligned with the user-selected study type.
 * Prevents abdomen (etc.) from receiving lower-limb arterial / venous vessel lists.
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
  if (
    t.includes("vias urinarias") ||
    t.includes("via urinaria") ||
    (t.includes("renal") && t.includes("doppler"))
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

/**
 * Drop structures that are incompatible with the declared study family.
 * When studyType is empty/other, keep everything (legacy behaviour).
 */
export function filterStructuresForStudyType<T extends { structure: string }>(
  structures: T[],
  studyType: string
): T[] {
  const family = classifyMeasurementStudyFamily(studyType);
  if (family === "other" || !Array.isArray(structures)) return structures || [];

  return structures.filter((s) => {
    const name = String(s?.structure || "");
    switch (family) {
      case "abdomen":
      case "renal_vias":
        return (
          !isPeripheralArterialStructure(name) &&
          !isPeripheralVenousStructure(name) &&
          !isCarotidStructure(name)
        );
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

export function shouldEnforceAbdomenProtocol(opts: {
  studyType?: string;
  detectedStudyType?: string;
  report?: string;
}): boolean {
  const input = classifyMeasurementStudyFamily(opts.studyType || "");
  if (input === "arterial_mmii" || input === "venoso_mmii" || input === "carotidas") {
    return false;
  }
  if (input === "abdomen" || input === "renal_vias") return true;

  const detected = classifyMeasurementStudyFamily(opts.detectedStudyType || "");
  if (detected === "abdomen" || detected === "renal_vias") return true;

  const r = norm(opts.report || "");
  return (
    r.includes("abdomen") ||
    r.includes("abdominal") ||
    r.includes("higado") ||
    r.includes("esteatosis") ||
    r.includes("bazo") ||
    (r.includes("rinon") && !r.includes("miembro"))
  );
}
