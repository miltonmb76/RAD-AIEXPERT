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
  /** Manual override: attached image id chosen by the physician */
  selectedImageId?: string | null;
  /** 1–2 sentences for the referring clinician */
  clinicianPhrase: string;
  keyDescriptors?: string[];
  studyRegion?: string;
  priorInstructions?: string;
  generatedAt?: string;
};

export type DominantLesionPickedImage = {
  id?: string;
  url: string;
  caption: string;
  modality?: string;
  index: number;
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
  priorInstructions?: string,
  preserve?: Partial<Pick<DominantLesionCardData, "selectedImageId">>
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

  const selectedFromRaw = raw?.selectedImageId;
  const selectedImageId =
    preserve?.selectedImageId !== undefined
      ? preserve.selectedImageId
      : selectedFromRaw === null || selectedFromRaw === undefined || selectedFromRaw === ""
        ? null
        : String(selectedFromRaw);

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
    selectedImageId,
    clinicianPhrase,
    keyDescriptors: cleanList(raw?.keyDescriptors || raw?.descriptors || raw?.features, 6, 90),
    studyRegion: cleanText(raw?.studyRegion || raw?.region, 80) || undefined,
    priorInstructions: cleanText(priorInstructions || raw?.priorInstructions, 500) || undefined,
    generatedAt: new Date().toISOString(),
  };
}

type AttachedLike = {
  id?: string;
  url?: string;
  preview?: string;
  caption?: string;
  name?: string;
  modality?: string;
};

function listImagesWithUrl(attachedImages: AttachedLike[] | null | undefined) {
  if (!Array.isArray(attachedImages)) return [];
  return attachedImages
    .map((img, idx) => ({
      id: img.id ? String(img.id) : `idx-${idx}`,
      idx,
      url: String(img.url || img.preview || "").trim(),
      caption: String(img.caption || img.name || "").trim(),
      modality: String(img.modality || "").toUpperCase(),
    }))
    .filter((img) => img.url);
}

/** Pick best attached image for the card (manual id → figure → caption → modality). */
export function pickDominantLesionImage(
  attachedImages: AttachedLike[] | null | undefined,
  data: DominantLesionCardData | null
): DominantLesionPickedImage | null {
  const withUrl = listImagesWithUrl(attachedImages);
  if (!withUrl.length) return null;

  const toPicked = (hit: (typeof withUrl)[0]): DominantLesionPickedImage => ({
    id: hit.id,
    url: hit.url,
    caption: hit.caption || (hit.idx >= 0 ? `Figura ${hit.idx + 1}` : "Imagen adjunta"),
    modality: hit.modality || undefined,
    index: hit.idx,
  });

  // 0) Manual selection
  if (data?.selectedImageId) {
    const byId = withUrl.find((i) => i.id === data.selectedImageId);
    if (byId) return toPicked(byId);
  }

  if (!data) return toPicked(withUrl[0]);

  // 1) Explicit figure N → N-th image in report order
  if (data.figureRef && data.figureRef >= 1 && data.figureRef <= withUrl.length) {
    return toPicked(withUrl[data.figureRef - 1]);
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
    if (scored[0]?.score > 0) return toPicked(scored[0].img);
  }

  // 3) Modality preference
  const preferUs = data.modalityHint === "US" || data.modalityHint === "US+MMG";
  const preferMmg = data.modalityHint === "MMG";
  if (preferUs) {
    const us = withUrl.find((i) => i.modality === "US" || /eco|ultrason/i.test(i.caption));
    if (us) return toPicked(us);
  }
  if (preferMmg) {
    const mmg = withUrl.find((i) => i.modality === "MMG" || /mamograf/i.test(i.caption));
    if (mmg) return toPicked(mmg);
  }

  return toPicked(withUrl[0]);
}

export function listSelectableDominantImages(
  attachedImages: AttachedLike[] | null | undefined
): DominantLesionPickedImage[] {
  return listImagesWithUrl(attachedImages).map((hit) => ({
    id: hit.id,
    url: hit.url,
    caption: hit.caption || `Figura ${hit.idx + 1}`,
    modality: hit.modality || undefined,
    index: hit.idx,
  }));
}
