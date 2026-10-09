/**
 * Keep classic / findings infographics free of patient identifiers (PHI).
 */

/** Strip common identity header lines before sending report text to image/LLM prompts. */
export function redactPatientIdentifiersForInfographic(text: string): string {
  return String(text || "")
    .replace(
      /^\s*(?:paciente|nombre(?:\s+del\s+paciente)?|patient(?:\s+name)?|id(?:entificaci[oó]n)?(?:\s+del\s+paciente)?|n[uú]mero\s+de\s+historia|historia\s*cl[ií]nica|h\.?\s*c\.?|mrn|c[eé]dula|dpi|documento(?:\s+de\s+identidad)?)\s*[:：].*$/gim,
      ""
    )
    .replace(/\bPACIENTE\s*:\s*[^\n|]*/gi, "")
    .replace(/\bPatient\s*:\s*[^\n|]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Hard ban for Gemini image / dual findings copy — no name, ID, or identity placeholders. */
export const INFOGRAPHIC_PRIVACY_PROMPT_BLOCK = `
PRIVACIDAD Y ANONIMATO (OBLIGATORIO — si se incumple la imagen no sirve):
- PROHIBIDO incluir nombre del paciente, apellidos, iniciales (p. ej. "M. García"), ID, cédula, HC/MRN, fecha de nacimiento, teléfono, correo, dirección u otro dato identificable.
- PROHIBIDO dibujar campos o etiquetas tipo "PACIENTE:", "Nombre:", "Patient:", placeholders "[Nombre/ID del Paciente…]" o ejemplos inventados de identidad.
- La infografía es ANÓNIMA: solo título del estudio/hallazgos, fecha del examen si aplica, anatomía y hallazgos clínicos.
- No copies del reporte ninguna línea de identificación del paciente aunque aparezca en el texto fuente.
`.trim();
