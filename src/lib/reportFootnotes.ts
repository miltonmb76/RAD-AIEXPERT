/**
 * Shared helpers to keep footnotes in the main report body (before annexes).
 */

/**
 * Split full report text into:
 * 1. bodyText: main report (+ optional footnote section)
 * 2. annexesText: annexes appended after the body
 */
export function separateReportBodyAndAnnexes(
  fullText: string
): { bodyText: string; annexesText: string } {
  if (!fullText) return { bodyText: "", annexesText: "" };

  const annexPattern =
    /(?:\n\s*---\s*)?\n(?:\s*(?:#{1,6}\s+|\*\*\s*)(?:ANEXO|DESGLOSE Y JUSTIFICACIÓN|CLASIFICACIÓN DE|ESQUEMA CLÍNICO DE HALLAZGOS|CUADRO SINÓPTICO|MATRIZ SEMIÓTICA|SINOPSIS CLÍNICA|SINOPSIS POR ÓRGANO|SINOPSIS DE ÓRGANO|ASISTENTE DE MEDIDAS|TABLA DE MEDIDAS|MEDICIONES Y PARÁMETROS|PARÁMETROS Y MEDIDAS|SÍNTESIS VASCULAR|SÍNTESIS DE ANATOMÍA|SINOPSIS DE FRACTURAS|EXPLICACIÓN DE INFORME|INFOGRAFÍA EXPLICATIVA)|(?:\s*ANEXO\s*:|\s*ANEXO DIAGNÓSTICO|\s*DESGLOSE Y JUSTIFICACIÓN DE CLASIFICACIÓN))\b/i;

  const match = fullText.match(annexPattern);
  if (match && match.index !== undefined) {
    const bodyText = fullText.substring(0, match.index).trimEnd();
    let annexesText = fullText.substring(match.index);
    if (!annexesText.startsWith("\n")) {
      annexesText = "\n\n" + annexesText.trimStart();
    }
    return { bodyText, annexesText };
  }

  return { bodyText: fullText.trimEnd(), annexesText: "" };
}

/** Insert or remove footnote lines in the main report body (section after ---). */
export function updateFootnotesInReport(
  fullText: string,
  linesToAdd: string[],
  linesToRemove: string[] = []
): string {
  const { bodyText, annexesText } = separateReportBodyAndAnnexes(fullText);

  let mainContent = bodyText;
  let existingFootnotes: string[] = [];

  const dashParts = bodyText.split(/\n\s*---\s*\n/);
  if (dashParts.length > 1) {
    mainContent = dashParts[0].trimEnd();
    const footnoteSectionRaw = dashParts.slice(1).join("\n\n");
    existingFootnotes = footnoteSectionRaw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else {
    mainContent = bodyText.trimEnd();
  }

  let updatedFootnotes = existingFootnotes.filter((fn) => {
    return !linesToRemove.some(
      (rem) => fn.includes(rem.trim()) || rem.trim().includes(fn)
    );
  });

  linesToAdd.forEach((line) => {
    const trimmed = line.trim();
    if (
      trimmed &&
      !updatedFootnotes.some((fn) => fn.includes(trimmed) || trimmed.includes(fn))
    ) {
      updatedFootnotes.push(trimmed);
    }
  });

  let newBodyText = mainContent;
  if (updatedFootnotes.length > 0) {
    newBodyText += `\n\n---\n\n${updatedFootnotes.join("\n\n")}`;
  }

  return newBodyText + annexesText;
}
