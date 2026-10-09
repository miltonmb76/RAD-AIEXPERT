/**
 * Dominant lesion card — one-page clinical sheet for the key finding.
 */

export type DominantLesionMeasurement = {
  label: string;
  value: string;
};

export type DominantLesionCardData = {
  title: string;
  lesionLabel: string;
  site: string;
  laterality?: string;
  /** Short size string, e.g. "18 × 12 × 10 mm" */
  sizeSummary?: string;
  measurements: DominantLesionMeasurement[];
  /** e.g. BI-RADS, TI-RADS, LI-RADS, Bosniak */
  categorySystem?: string;
  /** e.g. 4A, TR4, LR-4 */
  categoryValue?: string;
  categoryRationale?: string;
  modalityHint?: "US" | "MMG" | "US+MMG" | "CT" | "MR" | "other";
  /** Linked figure number from report, if any */
  figureRef?: number | null;
  /** Hint to match attached image caption */
  figureCaptionHint?: string;
  /** 1–2 sentences for the referring clinician */
  clinicianPhrase: string;
  keyDescriptors?: string[];
  studyRegion?: string;
  priorInstructions?: string;
  generatedAt?: string;
};

function cleanText(v: unknown, max = 220): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanList(v: unknown, maxItems = 6, maxLen = 80): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => cleanText(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeDominantLesionCardData(
  raw: any,
  priorInstructions?: string
): DominantLesionCardData {
  const measurementsRaw = Array.isArray(raw?.measurements)
    ? raw.measurements
    : Array.isArray(raw?.medidas)
      ? raw.medidas
      : [];

  const measurements: DominantLesionMeasurement[] = measurementsRaw
    .map((m: any) => {
      const label = cleanText(m?.label || m?.name || m?.axis, 40);
      const value = cleanText(m?.value || m?.valor || m?.size, 40);
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean) as DominantLesionMeasurement[];

  const fig = raw?.figureRef ?? raw?.figura ?? null;
  const figureRef =
    fig === null || fig === undefined || fig === "" ? null : Number(fig) || null;

  const modalityRaw = cleanText(raw?.modalityHint || raw?.modality, 20).toUpperCase();
  let modalityHint: DominantLesionCardData["modalityHint"] = "other";
  if (modalityRaw.includes("US") && modalityRaw.includes("MMG")) modalityHint = "US+MMG";
  else if (modalityRaw.includes("MMG") || modalityRaw.includes("MAMO")) modalityHint = "MMG";
  else if (modalityRaw.includes("US") || modalityRaw.includes("ECO")) modalityHint = "US";
  else if (modalityRaw.includes("CT") || modalityRaw.includes("TC")) modalityHint = "CT";
  else if (modalityRaw.includes("MR") || modalityRaw.includes("RM")) modalityHint = "MR";

  const lesionLabel =
    cleanText(raw?.lesionLabel || raw?.lesion || raw?.label || raw?.title, 80) ||
    "Lesión dominante";

  const clinicianPhrase =
    cleanText(
      raw?.clinicianPhrase || raw?.fraseClinico || raw?.summaryForClinician || raw?.clinicalPhrase,
      320
    ) || `Hallazgo dominante: ${lesionLabel}.`;

  return {
    title: cleanText(raw?.title, 80) || "Ficha de lesión dominante",
    lesionLabel,
    site: cleanText(raw?.site || raw?.location || raw?.lesionSite, 100) || "Sitio no especificado",
    laterality: cleanText(raw?.laterality || raw?.side, 40) || undefined,
    sizeSummary: cleanText(raw?.sizeSummary || raw?.size || raw?.lesionSize, 60) || undefined,
    measurements: measurements.slice(0, 6),
    categorySystem: cleanText(raw?.categorySystem || raw?.system || raw?.scoreSystem, 40) || undefined,
    categoryValue: cleanText(raw?.categoryValue || raw?.category || raw?.score, 40) || undefined,
    categoryRationale: cleanText(raw?.categoryRationale || raw?.rationale, 200) || undefined,
    modalityHint,
    figureRef,
    figureCaptionHint: cleanText(raw?.figureCaptionHint || raw?.imageHint, 120) || undefined,
    clinicianPhrase,
    keyDescriptors: cleanList(raw?.keyDescriptors || raw?.descriptors || raw?.features, 6, 90),
    studyRegion: cleanText(raw?.studyRegion || raw?.region, 80) || undefined,
    priorInstructions: cleanText(priorInstructions || raw?.priorInstructions, 500) || undefined,
    generatedAt: new Date().toISOString(),
  };
}

/** Pick best attached image for the card (by figure order / caption / modality). */
export function pickDominantLesionImage(
  attachedImages: Array<{
    id?: string;
    url?: string;
    preview?: string;
    caption?: string;
    name?: string;
    modality?: string;
  }> | null | undefined,
  data: DominantLesionCardData | null
): { url: string; caption: string; modality?: string } | null {
  if (!data || !Array.isArray(attachedImages) || !attachedImages.length) return null;

  const withUrl = attachedImages
    .map((img, idx) => ({
      idx,
      url: String(img.url || img.preview || "").trim(),
      caption: String(img.caption || img.name || "").trim(),
      modality: String(img.modality || "").toUpperCase(),
    }))
    .filter((img) => img.url);

  if (!withUrl.length) return null;

  // 1) Explicit figure N → N-th image in report order (0-based: figure 1 = index 0)
  if (data.figureRef && data.figureRef >= 1 && data.figureRef <= withUrl.length) {
    const hit = withUrl[data.figureRef - 1];
    return { url: hit.url, caption: hit.caption || `Figura ${data.figureRef}`, modality: hit.modality };
  }

  // 2) Caption hint overlap
  const hint = (data.figureCaptionHint || "").toLowerCase();
  if (hint.length >= 4) {
    const tokens = hint.split(/\s+/).filter((t) => t.length > 3);
    const scored = withUrl
      .map((img) => {
        const c = img.caption.toLowerCase();
        const score = tokens.reduce((s, t) => (c.includes(t) ? s + 1 : s), 0);
        return { img, score };
      })
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) {
      const hit = scored[0].img;
      return { url: hit.url, caption: hit.caption, modality: hit.modality };
    }
  }

  // 3) Modality preference
  const preferUs = data.modalityHint === "US" || data.modalityHint === "US+MMG";
  const preferMmg = data.modalityHint === "MMG";
  if (preferUs) {
    const us = withUrl.find((i) => i.modality === "US" || /eco|ultrason/i.test(i.caption));
    if (us) return { url: us.url, caption: us.caption, modality: us.modality };
  }
  if (preferMmg) {
    const mmg = withUrl.find((i) => i.modality === "MMG" || /mamograf/i.test(i.caption));
    if (mmg) return { url: mmg.url, caption: mmg.caption, modality: mmg.modality };
  }

  // 4) First image
  const first = withUrl[0];
  return { url: first.url, caption: first.caption || "Imagen adjunta", modality: first.modality };
}
