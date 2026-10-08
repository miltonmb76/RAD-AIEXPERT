/**
 * Laterality conventions for patient infographic figures.
 *
 * AP (de frente): patient faces the observer → patient's RIGHT is on the LEFT of the frame.
 * PA (de espaldas): patient back to observer → patient's RIGHT is on the RIGHT of the frame.
 */

export type InfographicViewOrientation = "AP" | "PA";

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Detect whether the infographic body figure should be drawn AP or PA.
 * Explicit PA beats AP when both appear; otherwise defaults to AP (most educational figures).
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

  // Strong PA cues in notes/report/study
  if (
    /\bpa\b/.test(blob) ||
    blob.includes("posteroanterior") ||
    blob.includes("de espaldas") ||
    blob.includes("visto de espalda") ||
    blob.includes("vista posterior") ||
    blob.includes("espalda al observador")
  ) {
    // If both AP and PA mentioned equally, prefer PA only when PA is clearly asserted
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

/** Prompt block injected into /api/generate-infographic */
export function buildInfographicLateralityPromptBlock(
  orientation: InfographicViewOrientation
): string {
  if (orientation === "PA") {
    return `
REGLA CRÍTICA DE LATERALIDAD — PACIENTE VISTO DE ESPALDAS (vista PA / posteroanterior / posterior):
- La figura muestra al paciente DE ESPALDAS al observador (no mira a la cámara; se ve la espalda).
- "Derecha" / "Izquierda" = lado ANATÓMICO DEL PACIENTE (su mano derecha, su hombro derecho, etc.).
- Como está de espaldas: el LADO DERECHO DEL PACIENTE queda a la DERECHA DEL CUADRO; el LADO IZQUIERDO DEL PACIENTE queda a la IZQUIERDA DEL CUADRO.
- Ejemplo: lesión en hombro DERECHO → dibújala en el hombro que aparece a la DERECHA de la imagen y etiquétalo "Hombro derecho (del paciente)".
- Ejemplo: rodilla IZQUIERDA → a la IZQUIERDA del cuadro, etiqueta "Rodilla izquierda (del paciente)".
- NO uses la regla de espejo de la vista de frente. En PA NO se invierten los lados.
- Etiqueta siempre con el lado del paciente. Una imagen bella con lateralidad incorrecta es un FALLO CRÍTICO.
`;
  }

  return `
REGLA CRÍTICA DE LATERALIDAD — PACIENTE VISTO DE FRENTE (vista AP / anteroposterior / coronal / anterior):
- La figura muestra al paciente MIRANDO HACIA EL OBSERVADOR (de frente).
- "Derecha" / "Izquierda" = lado ANATÓMICO DEL PACIENTE.
- Como está de frente (regla de espejo): el LADO DERECHO DEL PACIENTE queda a la IZQUIERDA DEL CUADRO; el LADO IZQUIERDO DEL PACIENTE queda a la DERECHA DEL CUADRO.
- Ejemplo: lesión en hombro DERECHO → dibújala en el hombro que aparece a la IZQUIERDA de la imagen y etiquétalo "Hombro derecho (del paciente)".
- Ejemplo: rodilla IZQUIERDA → a la DERECHA del cuadro, etiqueta "Rodilla izquierda (del paciente)".
- Etiqueta siempre con el lado del paciente. PROHIBIDO espejar anatomía "para que quede bonito".
- Una imagen bella con lateralidad incorrecta es un FALLO CRÍTICO.
`;
}
