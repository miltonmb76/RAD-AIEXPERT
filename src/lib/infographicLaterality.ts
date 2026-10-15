/**
 * Laterality conventions for classic infographic figures.
 *
 * AP (de frente): patient faces the observer → patient's RIGHT is on the LEFT of the frame.
 * PA (de espaldas): patient back to observer → patient's RIGHT is on the RIGHT of the frame.
 */

export type InfographicViewOrientation = "AP" | "PA";
export type InfographicLateralitySide = "right" | "left" | "bilateral" | "unspecified";

export type InfographicLateralityMention = {
  structure: string;
  side: InfographicLateralitySide;
  snippet: string;
};

export type InfographicLateralityExtract = {
  side: InfographicLateralitySide;
  mentions: InfographicLateralityMention[];
  /** Human summary for prompts */
  summary: string;
  source: "study_field" | "report" | "mixed" | "none";
};

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sideFromWord(w: string): InfographicLateralitySide | null {
  const n = normalize(w);
  if (/^derech[oa]s?$/.test(n) || n === "right" || n === "rt" || n === "rd") return "right";
  if (/^izquierd[oa]s?$/.test(n) || n === "left" || n === "lt" || n === "ri") return "left";
  if (/^bilateral(es)?$/.test(n) || n === "ambos" || n === "ambas") return "bilateral";
  return null;
}

function sideLabelEs(side: InfographicLateralitySide): string {
  if (side === "right") return "DERECHO";
  if (side === "left") return "IZQUIERDO";
  if (side === "bilateral") return "BILATERAL";
  return "sin lateralidad clara";
}

/** Where the patient's anatomical side must appear in the frame. */
export function canvasSideForPatientSide(
  orientation: InfographicViewOrientation,
  patientSide: InfographicLateralitySide
): "left_of_frame" | "right_of_frame" | "both" | "unknown" {
  if (patientSide === "bilateral") return "both";
  if (patientSide !== "right" && patientSide !== "left") return "unknown";
  if (orientation === "PA") {
    return patientSide === "right" ? "right_of_frame" : "left_of_frame";
  }
  // AP mirror
  return patientSide === "right" ? "left_of_frame" : "right_of_frame";
}

function frameLabel(side: "left_of_frame" | "right_of_frame" | "both" | "unknown"): string {
  if (side === "left_of_frame") return "IZQUIERDA DEL CUADRO (tu izquierda al mirar la imagen)";
  if (side === "right_of_frame") return "DERECHA DEL CUADRO (tu derecha al mirar la imagen)";
  if (side === "both") return "AMBOS LADOS DEL CUADRO";
  return "según anatomía del informe";
}

/**
 * Detect whether the infographic body figure should be drawn AP or PA.
 * Explicit preferred wins; else projections / report cues; default AP.
 */
export function detectInfographicViewOrientation(args: {
  studyType?: string;
  projections?: string[] | string;
  report?: string;
  correctionNotes?: string;
  preferred?: InfographicViewOrientation | "" | null;
}): InfographicViewOrientation {
  if (args.preferred === "AP" || args.preferred === "PA") {
    return args.preferred;
  }

  const projs = Array.isArray(args.projections)
    ? args.projections.map((p) => normalize(p))
    : normalize(String(args.projections || ""))
        .split(/[,\s/]+/)
        .filter(Boolean);

  const hasPA = projs.some((p) => p === "pa" || p.includes("posteroanterior"));
  const hasAP = projs.some((p) => p === "ap" || p.includes("anteroposterior"));
  if (hasPA && !hasAP) return "PA";
  if (hasAP && !hasPA) return "AP";

  const blob = normalize(
    `${args.studyType || ""} ${args.report || ""} ${args.correctionNotes || ""} ${projs.join(" ")}`
  );

  if (
    /\bpa\b/.test(blob) ||
    blob.includes("posteroanterior") ||
    blob.includes("de espaldas") ||
    blob.includes("visto de espalda") ||
    blob.includes("vista posterior") ||
    blob.includes("espalda al observador")
  ) {
    if (!/\bap\b/.test(blob) && !blob.includes("anteroposterior") && !blob.includes("de frente")) {
      return "PA";
    }
    if (
      blob.includes("de espaldas") ||
      blob.includes("visto de espalda") ||
      blob.includes("espalda al observador") ||
      blob.includes("proyeccion pa") ||
      blob.includes("proyecciones pa") ||
      /\ben pa\b/.test(blob)
    ) {
      return "PA";
    }
  }

  return "AP";
}

const STRUCTURE =
  "(hombro|rodilla|cadera|codo|muneca|tobillo|mano|pie|mama|cuadrante|rinon|rinones|testiculo|hemitorax|pulmon|lobulo|tiroides|lobulo\\s+tiroideo|muslo|pantorrilla|brazo|antebrazo|axila|ingle|fosa\\s+iliaca|hemiabdomen|ovario|anexo|vesicula(?:\\s+biliar)?|tendon|manguito|supraespinoso|infraespinoso|subescapular|bursa|menisco|ligamento)";

/**
 * Pull laterality from study field + report text (determinístico).
 */
export function extractInfographicLaterality(args: {
  report?: string;
  studyType?: string;
  studyLaterality?: string;
  diagnosisAnchor?: string;
  correctionNotes?: string;
}): InfographicLateralityExtract {
  const mentions: InfographicLateralityMention[] = [];
  const fieldSide = sideFromWord(String(args.studyLaterality || "").trim());
  let source: InfographicLateralityExtract["source"] = "none";

  if (fieldSide && fieldSide !== "unspecified") {
    mentions.push({
      structure: "estudio",
      side: fieldSide,
      snippet: `Campo de lateralidad del estudio: ${args.studyLaterality}`,
    });
    source = "study_field";
  }

  const blob = `${args.diagnosisAnchor || ""}\n${args.studyType || ""}\n${args.correctionNotes || ""}\n${args.report || ""}`;
  // Match on accent-stripped text so muñeca/riñón/etc. still hit.
  const text = normalize(blob);

  if (/\bbilateral(es)?\b|\bamb(os|as)\s+lados\b/.test(text)) {
    mentions.push({
      structure: "hallazgos",
      side: "bilateral",
      snippet: "bilateral",
    });
  }

  const patterns: RegExp[] = [
    new RegExp(`${STRUCTURE}\\s+(derech[oa]|izquierd[oa])\\b`, "gi"),
    new RegExp(`\\b(derech[oa]|izquierd[oa])\\s+${STRUCTURE}\\b`, "gi"),
    /\blado\s+(derecho|izquierdo)\b/gi,
    /\b(rt|lt|rd|ri)\s*[-:]?\s*(hombro|rodilla|mama|rinon|cadera|codo|tobillo)/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const local = new RegExp(re.source, re.flags);
    while ((m = local.exec(text)) != null) {
      const full = m[0];
      const parts = full.split(/\s+/);
      let side: InfographicLateralitySide | null = null;
      let structure = full;
      for (const p of parts) {
        const s = sideFromWord(p);
        if (s && s !== "bilateral") {
          side = s;
          break;
        }
      }
      if (!side) {
        const abbr = normalize(parts[0] || "");
        if (abbr === "rt" || abbr === "rd") side = "right";
        if (abbr === "lt" || abbr === "ri") side = "left";
      }
      if (!side) continue;
      structure = parts
        .filter((p) => !sideFromWord(p) && !/^(rt|lt|rd|ri|lado)$/i.test(p))
        .join(" ")
        .trim() || "hallazgo";
      mentions.push({
        structure,
        side,
        snippet: full.replace(/\s+/g, " ").trim(),
      });
      if (mentions.length >= 12) break;
    }
  }

  // Deduplicate by structure+side
  const uniq: InfographicLateralityMention[] = [];
  const seen = new Set<string>();
  for (const m of mentions) {
    const k = `${normalize(m.structure)}|${m.side}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(m);
  }

  const sides = uniq.map((m) => m.side).filter((s) => s === "right" || s === "left" || s === "bilateral");
  let side: InfographicLateralitySide = "unspecified";
  if (fieldSide) {
    side = fieldSide;
  } else if (sides.includes("bilateral") && !sides.includes("right") && !sides.includes("left")) {
    side = "bilateral";
  } else if (sides.includes("right") && sides.includes("left")) {
    side = "bilateral";
  } else if (sides.includes("right")) {
    side = "right";
  } else if (sides.includes("left")) {
    side = "left";
  } else if (sides.includes("bilateral")) {
    side = "bilateral";
  }

  if (uniq.length && source === "study_field") source = "mixed";
  else if (uniq.length && source === "none") source = "report";

  const summaryParts = uniq
    .filter((m) => m.side === "right" || m.side === "left" || m.side === "bilateral")
    .slice(0, 6)
    .map((m) => `${m.structure} ${sideLabelEs(m.side).toLowerCase()}`);

  const summary =
    side === "unspecified"
      ? "El informe no fija una lateralidad única clara; no inventes lado."
      : `Lateralidad dominante: ${sideLabelEs(side)} del paciente` +
        (summaryParts.length ? ` (${summaryParts.join("; ")})` : "") +
        ".";

  return { side, mentions: uniq.slice(0, 8), summary, source };
}

/**
 * Locked placement instructions for the image model (character-level clarity).
 */
export function buildLateralityPlacementBrief(
  orientation: InfographicViewOrientation,
  extracted: InfographicLateralityExtract
): string {
  const orientLabel =
    orientation === "PA"
      ? "PA — paciente DE ESPALDAS (se ve la espalda)"
      : "AP — paciente DE FRENTE (mira al observador)";

  const lines: string[] = [
    "GUION DE LATERALIDAD BLOQUEADO (prioridad máxima — fallar esto invalida la imagen):",
    `- Orientación de la figura: ${orientLabel}.`,
    `- ${extracted.summary}`,
  ];

  const focusSides =
    extracted.side === "right" || extracted.side === "left" || extracted.side === "bilateral"
      ? [extracted.side]
      : extracted.mentions
          .map((m) => m.side)
          .filter((s): s is "right" | "left" | "bilateral" =>
            s === "right" || s === "left" || s === "bilateral"
          );

  const uniqueSides = Array.from(new Set(focusSides));
  for (const s of uniqueSides) {
    const canvas = canvasSideForPatientSide(orientation, s);
    if (s === "bilateral") {
      lines.push(
        `- Hallazgos BILATERALES: represéntalos en AMBOS lados; etiquetas «derecho (del paciente)» e «izquierdo (del paciente)» en el lado anatómico correcto según la orientación.`
      );
      continue;
    }
    lines.push(
      `- Hallazgo del lado ${sideLabelEs(s)} DEL PACIENTE → dibújalo y etiquétalo en la ${frameLabel(canvas)}.`
    );
    if (orientation === "AP" && s === "right") {
      lines.push(
        `  · Recordatorio AP: DERECHO del paciente ≠ derecha de la imagen. Va a la IZQUIERDA del cuadro.`
      );
    }
    if (orientation === "AP" && s === "left") {
      lines.push(
        `  · Recordatorio AP: IZQUIERDO del paciente ≠ izquierda de la imagen. Va a la DERECHA del cuadro.`
      );
    }
    if (orientation === "PA") {
      lines.push(
        `  · Recordatorio PA: mismo lado que el cuadro (sin espejo). ${sideLabelEs(s)} del paciente = ${frameLabel(canvas)}.`
      );
    }
  }

  for (const m of extracted.mentions.slice(0, 5)) {
    if (m.side !== "right" && m.side !== "left") continue;
    const canvas = canvasSideForPatientSide(orientation, m.side);
    lines.push(
      `- Estructura «${m.structure}» (${sideLabelEs(m.side)} del paciente) → ${frameLabel(canvas)}. Etiqueta: «${m.structure} ${sideLabelEs(m.side).toLowerCase()} (del paciente)».`
    );
  }

  lines.push(
    "- PROHIBIDO: invertir el lado «para que se vea mejor», poner la lesión en el lado contrario, o etiquetar D/I del observador en vez del paciente.",
    "- Si no hay lateralidad en el informe, NO inventes derecha/izquierda."
  );

  return lines.join("\n");
}

/** Short UI line: where the finding must appear for current AP/PA + side. */
export function describeLateralityPlacementForUi(
  orientation: InfographicViewOrientation,
  studyLaterality?: string,
  reportHint?: string
): string {
  const extracted = extractInfographicLaterality({
    studyLaterality,
    report: reportHint,
  });
  if (extracted.side === "unspecified") {
    return orientation === "PA"
      ? "PA (de espaldas): derecha del paciente = derecha del cuadro."
      : "AP (de frente): derecha del paciente = izquierda del cuadro.";
  }
  if (extracted.side === "bilateral") {
    return `${orientation}: hallazgos bilaterales — ambos lados del cuadro, etiquetados derecho/izquierdo del paciente.`;
  }
  const canvas = canvasSideForPatientSide(orientation, extracted.side);
  const patient = extracted.side === "right" ? "DERECHO" : "IZQUIERDO";
  const frame =
    canvas === "left_of_frame"
      ? "IZQUIERDA del cuadro"
      : canvas === "right_of_frame"
        ? "DERECHA del cuadro"
        : "ambos lados";
  return `${orientation}: lado ${patient} del paciente → ${frame}.`;
}

/** Merge forced laterality labels into an existing copy plan. */
export function mergeLateralityIntoCopyPlan<T extends {
  title: string;
  callouts: Array<{ label: string; detail?: string }>;
  mustSpellExactly: string[];
}>(
  plan: T | null,
  orientation: InfographicViewOrientation,
  extracted: InfographicLateralityExtract
): T | null {
  if (!plan) return plan;
  const must = [...(plan.mustSpellExactly || [])];
  const callouts = [...(plan.callouts || [])];
  const pushMust = (s: string) => {
    const t = String(s || "").trim();
    if (!t) return;
    if (must.some((m) => m.toLowerCase() === t.toLowerCase())) return;
    must.push(t);
  };

  if (extracted.side === "right") {
    pushMust("derecho");
    pushMust("derecha");
    pushMust("(del paciente)");
  } else if (extracted.side === "left") {
    pushMust("izquierdo");
    pushMust("izquierda");
    pushMust("(del paciente)");
  } else if (extracted.side === "bilateral") {
    pushMust("bilateral");
    pushMust("derecho");
    pushMust("izquierdo");
  }

  for (const m of extracted.mentions.slice(0, 4)) {
    if (m.side !== "right" && m.side !== "left") continue;
    const struct = normalize(m.structure);
    // Skip generic study-field placeholders — only anatomical labels help the image model.
    if (!struct || struct === "estudio" || struct === "hallazgos" || struct === "hallazgo") continue;
    const label = `${m.structure} ${sideLabelEs(m.side).toLowerCase()} (del paciente)`;
    pushMust(label);
    if (!callouts.some((c) => c.label.toLowerCase().includes(struct))) {
      const canvas = canvasSideForPatientSide(orientation, m.side);
      callouts.unshift({
        label,
        detail:
          canvas === "left_of_frame"
            ? "Dibujar a la izquierda del cuadro"
            : canvas === "right_of_frame"
              ? "Dibujar a la derecha del cuadro"
              : undefined,
      });
    }
  }

  let title = plan.title;
  if (
    extracted.side === "right" &&
    !/derech/i.test(title) &&
    !/bilateral/i.test(title)
  ) {
    title = `${title} (lado derecho)`.slice(0, 90);
  } else if (
    extracted.side === "left" &&
    !/izquierd/i.test(title) &&
    !/bilateral/i.test(title)
  ) {
    title = `${title} (lado izquierdo)`.slice(0, 90);
  }

  return {
    ...plan,
    title,
    callouts: callouts.slice(0, 6),
    mustSpellExactly: must.slice(0, 16),
  };
}

/** Prompt block injected into /api/generate-infographic */
export function buildInfographicLateralityPromptBlock(
  orientation: InfographicViewOrientation,
  extracted?: InfographicLateralityExtract | null
): string {
  const base =
    orientation === "PA"
      ? `
REGLA CRÍTICA DE LATERALIDAD — PACIENTE VISTO DE ESPALDAS (vista PA / posteroanterior / posterior):
- La figura muestra al paciente DE ESPALDAS al observador (no mira a la cámara; se ve la espalda).
- "Derecha" / "Izquierda" = lado ANATÓMICO DEL PACIENTE (su mano derecha, su hombro derecho, etc.).
- Como está de espaldas: el LADO DERECHO DEL PACIENTE queda a la DERECHA DEL CUADRO; el LADO IZQUIERDO DEL PACIENTE queda a la IZQUIERDA DEL CUADRO.
- Ejemplo: lesión en hombro DERECHO → dibújala en el hombro que aparece a la DERECHA de la imagen y etiquétalo "Hombro derecho (del paciente)".
- Ejemplo: rodilla IZQUIERDA → a la IZQUIERDA del cuadro, etiqueta "Rodilla izquierda (del paciente)".
- NO uses la regla de espejo de la vista de frente. En PA NO se invierten los lados.
- Etiqueta siempre con el lado del paciente. Una imagen bella con lateralidad incorrecta es un FALLO CRÍTICO.
`
      : `
REGLA CRÍTICA DE LATERALIDAD — PACIENTE VISTO DE FRENTE (vista AP / anteroposterior / coronal / anterior):
- La figura muestra al paciente MIRANDO HACIA EL OBSERVADOR (de frente).
- "Derecha" / "Izquierda" = lado ANATÓMICO DEL PACIENTE.
- Como está de frente (regla de espejo): el LADO DERECHO DEL PACIENTE queda a la IZQUIERDA DEL CUADRO; el LADO IZQUIERDO DEL PACIENTE queda a la DERECHA DEL CUADRO.
- Ejemplo: lesión en hombro DERECHO → dibújala en el hombro que aparece a la IZQUIERDA de la imagen y etiquétalo "Hombro derecho (del paciente)".
- Ejemplo: rodilla IZQUIERDA → a la DERECHA del cuadro, etiqueta "Rodilla izquierda (del paciente)".
- Etiqueta siempre con el lado del paciente. PROHIBIDO espejar anatomía "para que quede bonito".
- Una imagen bella con lateralidad incorrecta es un FALLO CRÍTICO.
`;

  if (!extracted || extracted.side === "unspecified" && !extracted.mentions.length) {
    return base.trim();
  }
  return `${base.trim()}

${buildLateralityPlacementBrief(orientation, extracted)}`;
}
