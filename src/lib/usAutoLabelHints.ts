/**
 * Shared anatomy / capture-pattern hints for US auto-labeling prompts.
 * Keeps frequent clinic captures (esp. dual-kidney split screen) from being misread.
 */

export function isAbdomenOrRenalStudyContext(
  studyType?: string,
  clinicalHistory?: string,
  findings?: string
): boolean {
  const ctx = `${studyType || ""} ${clinicalHistory || ""} ${findings || ""}`.toLowerCase();
  return /abdom|renal|ri[nñ]on|urinari|ves[ií]cula|h[ií]gado|higado|hepato|bazo|p[aá]ncrea|v[ií]as?\s*biliar|coledoco|col[eé]doco/.test(
    ctx
  );
}

/** Prompt block injected into classify / auto-label US endpoints. */
export function buildUsAutoLabelAnatomyHints(
  studyType?: string,
  clinicalHistory?: string,
  findings?: string
): string {
  const abdomenish = isAbdomenOrRenalStudyContext(studyType, clinicalHistory, findings);

  let block = `
PATRONES DE CAPTURA FRECUENTES (prioridad alta — no confundir):
1) PANTALLA PARTIDA / DUAL VIEW DE AMBOS RIÑONES (muy habitual en ecografía de abdomen):
   - Hay un DIVISOR vertical u horizontal que parte la pantalla en DOS paneles simétricos.
   - Cada panel muestra un órgano reniforme (corteza hipoecogénica, seno central ecogénico, a veces medidas).
   - Textos quemados frecuentes: RT/LT, R/L, RD/RI, KD, KIDNEY, RIÑÓN, RENAL.
   - NO es hígado, bazo, páncreas ni "corte abdominal inespecífico".
   - NO rotules un solo riñón si hay dos paneles renales.
   - Rótulo preferido (adapta con hallazgos del informe si aplican; 12–22 palabras):
     "Comparativa renal bilateral en pantalla partida: riñones derecho e izquierdo en corte longitudinal, [hallazgo breve o morfología conservada]."
2) Otras pantallas partidas (p. ej. B-mode + Doppler del mismo órgano, o dos cortes del mismo riñón): nombra ambos paneles con claridad.
3) Si solo hay UN riñón a pantalla completa, indica laterality (derecho/izquierdo) y el corte (longitudinal/transversal).
`;

  if (abdomenish) {
    block += `
CONTEXTO ABDOMEN / RENAL / VÍAS URINARIAS:
- Ante una captura dual con dos órganos reniformes, PRIORIZA "comparativa renal bilateral en pantalla partida" antes que hígado, bazo o abdomen genérico.
- Correlaciona con el informe (litiasis, ectasia, quistes, morfología) solo si está documentado; no inventes patología.
`;
  }

  return block.trim();
}

/** One-click correction chips for the labeling queue (abdomen-heavy workflows). */
export const US_LABEL_QUICK_CHIPS: { id: string; label: string; caption: string; abdomenOnly?: boolean }[] = [
  {
    id: "dual-kidney",
    label: "Comparativa renal",
    caption:
      "Comparativa renal bilateral en pantalla partida: riñones derecho e izquierdo en corte longitudinal",
    abdomenOnly: true,
  },
  {
    id: "liver",
    label: "Hígado",
    caption: "Parénquima hepático en corte oblicuo subcostal",
    abdomenOnly: true,
  },
  {
    id: "gb",
    label: "Vesícula",
    caption: "Vesícula biliar en corte longitudinal",
    abdomenOnly: true,
  },
  {
    id: "spleen",
    label: "Bazo",
    caption: "Bazo en corte longitudinal por flanco izquierdo",
    abdomenOnly: true,
  },
];

export function quickChipsForStudy(studyType?: string, clinicalHistory?: string, findings?: string) {
  const abdomenish = isAbdomenOrRenalStudyContext(studyType, clinicalHistory, findings);
  return US_LABEL_QUICK_CHIPS.filter((c) => !c.abdomenOnly || abdomenish);
}
