/**
 * Breast clock-hands for classic infographic (AP, facing patient).
 * Identical dial on BOTH breasts: 12 up, 3 = viewer's RIGHT of nipple, 9 = viewer's LEFT.
 */

export type BreastClockSide = "left" | "right" | "unknown";

const WORD_HOUR: Record<string, number> = {
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isBreastInfographicContext(...parts: Array<string | undefined | null>): boolean {
  const t = normalize(parts.filter(Boolean).join(" "));
  if (!t.trim()) return false;
  if (
    /mama|mamari|breast|mamograf|birads|bi-rads|cuadrante|csi|cse|cii|cie|axila mam|pectoral/.test(
      t
    )
  ) {
    return true;
  }
  if (
    /\b(?:eje|hora|radio|o['']?clock)\s*[:\-]?\s*(1[0-2]|[1-9]|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/.test(
      t
    ) &&
    /izquier|derech|left|right|bilateral|ambos/.test(t)
  ) {
    return true;
  }
  return false;
}

function parseHourToken(raw: string): number | null {
  const s = normalize(raw).trim();
  if (!s) return null;
  if (WORD_HOUR[s] != null) return WORD_HOUR[s];
  const n = Number(s);
  if (n >= 1 && n <= 12) return n;
  return null;
}

/** Extract clock hour 1–12 from clinical Spanish/English. */
export function extractBreastClockHourFromText(text: string): number | null {
  const t = String(text || "");
  if (!t.trim()) return null;
  const nrm = normalize(t);

  // Ignore pure geometry boilerplate
  if (
    /breast clock geometry|ascii dial|degreesfrom12|lesion clock pin/.test(nrm) &&
    !/\beje\b|\bhora\b|\bradio\b|\b\d{1,2}\s*h\b/.test(nrm)
  ) {
    return null;
  }

  const clinicalPatterns: RegExp[] = [
    /\beje\s+(?:de\s+)?(?:las?\s+)?(1[0-2]|[1-9]|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
    /\b(?:a\s+las|en\s+las|de\s+las)\s+(1[0-2]|[1-9]|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
    /\bhora\s*[:\-]?\s*(1[0-2]|[1-9])\b/i,
    /\b(1[0-2]|[1-9])\s*h(?:oras?)?\b(?!\s*o['']?clock)/i,
    /\bradio\s*(?:de\s+las?\s+)?(1[0-2]|[1-9]|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
    /\b(?:en|a)\s+(1[0-2]|[1-9])\s*(?:h|horas?|:00)\b/i,
  ];
  for (const re of clinicalPatterns) {
    const m = nrm.match(re) || t.match(re);
    if (m) {
      const h = parseHourToken(m[1]);
      if (h != null) return h;
    }
  }

  const en = t.match(
    /\b(?:lesion|finding|nodule|mass|target|at|placed?(?:\s+at)?)\s+[^\n.]{0,40}?\b(1[0-2]|[1-9])\s*o['']?clock\b/i
  );
  if (en) {
    const h = parseHourToken(en[1]);
    if (h != null) return h;
  }
  return null;
}

export function extractBreastClockHour(
  ...parts: Array<string | undefined | null>
): number | null {
  for (const p of parts) {
    const n = extractBreastClockHourFromText(String(p || ""));
    if (n != null) return n;
  }
  return null;
}

export function detectBreastClockSide(
  ...parts: Array<string | undefined | null>
): BreastClockSide {
  const lat = normalize(parts.filter(Boolean).join(" "));
  const isRight =
    (/mama\s*derech|breast\s*right|right\s*breast|\bderech/.test(lat) ||
      /\bright\b/.test(lat)) &&
    !/izquier|left|bilateral|ambos/.test(lat);
  const isLeft =
    (/mama\s*izquier|breast\s*left|left\s*breast|\bizquier/.test(lat) ||
      /\bleft\b/.test(lat)) &&
    !/derech|right|bilateral|ambos/.test(lat);
  if (isLeft) return "left";
  if (isRight) return "right";
  return "unknown";
}

type BreastClockGeo = {
  hour: number;
  degreesFrom12: number;
  viewerHalf: "left" | "right" | "midline";
  vertical: "superior" | "inferior" | "horizontal";
  mirrorHour: number | null;
  anatomyRightBreast: string;
  anatomyLeftBreast: string;
  quadrantHintRight: string;
  quadrantHintLeft: string;
};

function mirrorHour(hour: number): number | null {
  if (hour === 12 || hour === 6) return null;
  return (12 - (hour % 12)) || 12;
}

/** Identical dial both breasts: 12 up, 3 viewer-right, 9 viewer-left. */
export function getBreastClockGeometry(hour: number): BreastClockGeo {
  const h = Math.min(12, Math.max(1, Math.round(hour)));
  const degreesFrom12 = (h % 12) * 30;
  const rad = (degreesFrom12 * Math.PI) / 180;
  const nx = Math.sin(rad);
  const ny = -Math.cos(rad);
  const viewerHalf: BreastClockGeo["viewerHalf"] =
    Math.abs(nx) < 0.2 ? "midline" : nx > 0 ? "right" : "left";
  const vertical: BreastClockGeo["vertical"] =
    Math.abs(ny) < 0.2 ? "horizontal" : ny < 0 ? "superior" : "inferior";
  const medialLateralRight =
    viewerHalf === "midline"
      ? "midline"
      : viewerHalf === "right"
        ? "MEDIAL / STERNAL / INNER"
        : "LATERAL / AXILLARY / OUTER";
  const medialLateralLeft =
    viewerHalf === "midline"
      ? "midline"
      : viewerHalf === "right"
        ? "LATERAL / AXILLARY / OUTER"
        : "MEDIAL / STERNAL / INNER";

  const quad = (vert: string, ml: string) => {
    if (ml === "midline") {
      if (vert === "superior") return "12h meridian (superior)";
      if (vert === "inferior") return "6h meridian (inferior)";
      return "nipple height midline";
    }
    const uo = vert === "superior" && ml.includes("LATERAL");
    const ui = vert === "superior" && ml.includes("MEDIAL");
    const lo = vert === "inferior" && ml.includes("LATERAL");
    const li = vert === "inferior" && ml.includes("MEDIAL");
    if (uo) return "CSE / UO (upper OUTER)";
    if (ui) return "CSI / UI (upper INNER)";
    if (lo) return "CIE / LO (lower OUTER)";
    if (li) return "CII / LI (lower INNER)";
    if (ml.includes("LATERAL")) return "OUTER / lateral half";
    if (ml.includes("MEDIAL")) return "INNER / medial half";
    return ml;
  };

  return {
    hour: h,
    degreesFrom12,
    viewerHalf,
    vertical,
    mirrorHour: mirrorHour(h),
    anatomyRightBreast: medialLateralRight,
    anatomyLeftBreast: medialLateralLeft,
    quadrantHintRight: quad(vertical, medialLateralRight),
    quadrantHintLeft: quad(vertical, medialLateralLeft),
  };
}

/** Full 1–12 anatomy table for prompts (Spanish, AP / manecillas idénticas). */
export function buildBreastClockHourTableEs(): string {
  const rows: string[] = [];
  for (let h = 1; h <= 12; h++) {
    const g = getBreastClockGeometry(h);
    const viewer =
      g.viewerHalf === "midline"
        ? "sobre meridiano vertical del pezón"
        : g.viewerHalf === "right"
          ? "a la DERECHA del pezón (derecha del observador)"
          : "a la IZQUIERDA del pezón (izquierda del observador)";
    const vert =
      g.vertical === "horizontal"
        ? "altura del pezón"
        : g.vertical === "superior"
          ? "SUPERIOR al pezón"
          : "INFERIOR al pezón";
    rows.push(
      `  · ${h}h: ${vert}, ${viewer}. Mama IZQ → ${g.anatomyLeftBreast} (${g.quadrantHintLeft}). Mama DER → ${g.anatomyRightBreast} (${g.quadrantHintRight}).` +
        (g.mirrorHour != null ? ` PROHIBIDO espejo ${g.mirrorHour}h.` : "")
    );
  }
  return rows.join("\n");
}

/**
 * Prompt block for classic infographic when breast + clock hour are present.
 * Returns "" if not a breast study / no useful clock context.
 */
export function buildInfographicBreastClockBrief(args: {
  report?: string;
  studyType?: string;
  studyLaterality?: string;
  diagnosisAnchor?: string;
  correctionNotes?: string;
  topic?: string;
}): string {
  const blob = [
    args.studyType,
    args.studyLaterality,
    args.diagnosisAnchor,
    args.topic,
    args.correctionNotes,
    args.report,
  ]
    .filter(Boolean)
    .join("\n");

  if (!isBreastInfographicContext(blob)) return "";

  const side = detectBreastClockSide(
    args.studyLaterality,
    args.diagnosisAnchor,
    args.topic,
    args.correctionNotes,
    String(args.report || "").slice(0, 2500)
  );
  const hour = extractBreastClockHour(
    args.correctionNotes,
    args.diagnosisAnchor,
    args.topic,
    String(args.report || "").slice(0, 2500),
    args.studyType
  );

  const sideEs =
    side === "right"
      ? "MAMA DERECHA (del paciente)"
      : side === "left"
        ? "MAMA IZQUIERDA (del paciente)"
        : "mama (lado según informe)";

  const lines: string[] = [
    "RELOJ / EJES DE MAMA — MANECILLAS IDÉNTICAS (prioridad máxima; fallar esto invalida la imagen):",
    "- Vista AP (paciente DE FRENTE). Imagina un reloj dibujado SOBRE la mama: 12 = ARRIBA (superior), 6 = ABAJO (inferior).",
    "- El 3 queda SIEMPRE a la DERECHA del pezón (derecha del observador). El 9 SIEMPRE a la IZQUIERDA del pezón.",
    "- Esta dial es LA MISMA en mama izquierda y derecha. NO espejes el mapa entre lados.",
    "- Mama IZQUIERDA: 3h = LATERAL/axila (derecha del pezón en la imagen); 9h = MEDIAL/esternón (izquierda del pezón).",
    "- Mama DERECHA: 3h = MEDIAL/esternón (derecha del pezón en la imagen); 9h = LATERAL/axila (izquierda del pezón).",
    "- CSE = superior EXTERNO/lateral; CSI = superior INTERNO/medial (anatomía, no espejar).",
    "- NUNCA espejar horas: 10≠2, 1≠11, 4≠8, 5≠7, 3≠9.",
    `- Lateralidad del hallazgo: ${sideEs}.`,
  ];

  if (hour != null) {
    const g = getBreastClockGeometry(hour);
    const anatomy =
      side === "right"
        ? g.anatomyRightBreast
        : side === "left"
          ? g.anatomyLeftBreast
          : "según dial idéntico";
    const quad =
      side === "right"
        ? g.quadrantHintRight
        : side === "left"
          ? g.quadrantHintLeft
          : "";
    const viewer =
      g.viewerHalf === "midline"
        ? "sobre el meridiano vertical del pezón"
        : g.viewerHalf === "right"
          ? "a la DERECHA del pezón en la imagen (derecha del observador)"
          : "a la IZQUIERDA del pezón en la imagen (izquierda del observador)";
    const vert =
      g.vertical === "horizontal"
        ? "a la altura del pezón"
        : g.vertical === "superior"
          ? "SUPERIOR al pezón (hacia las 12)"
          : "INFERIOR al pezón (hacia las 6)";

    lines.push(
      `- OBJETIVO BLOQUEADO: lesión en ${sideEs} a las ${hour}h exactamente (${g.degreesFrom12}° en sentido horario desde las 12).`,
      `- Desde el pezón: coloca el centro de la lesión ${vert} y ${viewer}.`,
      `- Anatomía en ese eje: ${anatomy}${quad ? ` · ${quad}` : ""}.`,
      g.mirrorHour != null
        ? `- PROHIBIDO colocarla a las ${g.mirrorHour}h (espejo izquierda↔derecha de ${hour}h).`
        : `- Mantén el meridiano vertical (12/6).`,
      `- En etiquetas usa «eje ${hour}h» / «${hour}h» y el lado del paciente; no inventes otra hora.`
    );
  } else {
    lines.push(
      "- Si el informe indica un eje/hora (p. ej. «eje 10», «7h»), sitúa la lesión EXACTAMENTE en ese radio del reloj sobre la mama correcta."
    );
  }

  lines.push("", "TABLA RÁPIDA 1h–12h (misma dial ambas mamas):", buildBreastClockHourTableEs());

  return lines.join("\n");
}
