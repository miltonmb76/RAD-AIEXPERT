/**
 * Dominant lesion card — one-page clinical sheet for the key finding.
 */

export type DominantLesionMeasurement = {
  label: string;
  value: string;
};

/** How clinical / 3D images are arranged on the card + PDF. */
export type DominantLesionImageLayout = "single" | "clinical_3d" | "mmg_us";

export const DOMINANT_LESION_LAYOUT_OPTIONS: Array<{
  id: DominantLesionImageLayout;
  label: string;
  hint: string;
}> = [
  { id: "single", label: "1 imagen", hint: "US o MMG sola" },
  { id: "clinical_3d", label: "Clínica + 3D", hint: "US/MMG + corte 3D" },
  { id: "mmg_us", label: "MMG + US", hint: "Mamografía y ecografía" },
];

export type DominantLesionCardData = {
  title: string;
  lesionLabel: string;
  site: string;
  laterality?: string;
  sizeSummary?: string;
  measurements: DominantLesionMeasurement[];
  categorySystem?: string;
  categoryValue?: string;
  categoryRationale?: string;
  modalityHint?: "US" | "MMG" | "US+MMG" | "CT" | "MR" | "other";
  figureRef?: number | null;
  figureCaptionHint?: string;
  /** Slot A — primary clinical image (US or MMG) */
  selectedImageId?: string | null;
  /** Slot B — second clinical image when layout is mmg_us */
  selectedImageIdB?: string | null;
  imageLayout?: DominantLesionImageLayout;
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

function normalizeLayout(raw: unknown): DominantLesionImageLayout {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "clinical_3d" || v === "us_3d" || v === "us+3d") return "clinical_3d";
  if (v === "mmg_us" || v === "mmg+us" || v === "us_mmg") return "mmg_us";
  return "single";
}

export function normalizeDominantLesionCardData(
  raw: any,
  priorInstructions?: string,
  preserve?: Partial<
    Pick<DominantLesionCardData, "selectedImageId" | "selectedImageIdB" | "imageLayout">
  >
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

  const pickId = (v: unknown): string | null =>
    v === null || v === undefined || v === "" ? null : String(v);

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
    selectedImageId:
      preserve?.selectedImageId !== undefined
        ? preserve.selectedImageId
        : pickId(raw?.selectedImageId),
    selectedImageIdB:
      preserve?.selectedImageIdB !== undefined
        ? preserve.selectedImageIdB
        : pickId(raw?.selectedImageIdB),
    imageLayout:
      preserve?.imageLayout !== undefined
        ? preserve.imageLayout
        : normalizeLayout(raw?.imageLayout),
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

function toPicked(hit: ReturnType<typeof listImagesWithUrl>[0]): DominantLesionPickedImage {
  return {
    id: hit.id,
    url: hit.url,
    caption: hit.caption || `Figura ${hit.idx + 1}`,
    modality: hit.modality || undefined,
    index: hit.idx,
  };
}

function isUs(img: { modality?: string; caption?: string }) {
  return img.modality === "US" || /eco|ultrason/i.test(img.caption || "");
}
function isMmg(img: { modality?: string; caption?: string }) {
  return img.modality === "MMG" || /mamograf|mmg|\bcc\b|\bmlo\b/i.test(img.caption || "");
}

export function listSelectableDominantImages(
  attachedImages: AttachedLike[] | null | undefined
): DominantLesionPickedImage[] {
  return listImagesWithUrl(attachedImages).map(toPicked);
}

/** Resolve one image by explicit id, else heuristics. */
export function resolveDominantImage(
  attachedImages: AttachedLike[] | null | undefined,
  opts: {
    selectedId?: string | null;
    figureRef?: number | null;
    captionHint?: string;
    prefer?: "US" | "MMG" | "any";
    excludeId?: string | null;
  }
): DominantLesionPickedImage | null {
  let withUrl = listImagesWithUrl(attachedImages);
  if (opts.excludeId) withUrl = withUrl.filter((i) => i.id !== opts.excludeId);
  if (!withUrl.length) return null;

  if (opts.selectedId) {
    const byId = withUrl.find((i) => i.id === opts.selectedId);
    if (byId) return toPicked(byId);
  }

  if (opts.figureRef && opts.figureRef >= 1 && opts.figureRef <= withUrl.length) {
    return toPicked(withUrl[opts.figureRef - 1]);
  }

  const hint = (opts.captionHint || "").toLowerCase();
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

  if (opts.prefer === "US") {
    const us = withUrl.find(isUs);
    if (us) return toPicked(us);
  }
  if (opts.prefer === "MMG") {
    const mmg = withUrl.find(isMmg);
    if (mmg) return toPicked(mmg);
  }

  return toPicked(withUrl[0]);
}

/** Back-compat helper used by PDF download. */
export function pickDominantLesionImage(
  attachedImages: AttachedLike[] | null | undefined,
  data: DominantLesionCardData | null
): DominantLesionPickedImage | null {
  if (!data) {
    const list = listImagesWithUrl(attachedImages);
    return list[0] ? toPicked(list[0]) : null;
  }
  const prefer: "US" | "MMG" | "any" =
    data.imageLayout === "mmg_us"
      ? "MMG"
      : data.modalityHint === "MMG"
        ? "MMG"
        : data.modalityHint === "US" || data.modalityHint === "US+MMG"
          ? "US"
          : "any";
  return resolveDominantImage(attachedImages, {
    selectedId: data.selectedImageId,
    figureRef: data.figureRef,
    captionHint: data.figureCaptionHint,
    prefer,
  });
}

export function pickDominantLesionImageB(
  attachedImages: AttachedLike[] | null | undefined,
  data: DominantLesionCardData | null
): DominantLesionPickedImage | null {
  if (!data || data.imageLayout !== "mmg_us") return null;
  return resolveDominantImage(attachedImages, {
    selectedId: data.selectedImageIdB,
    prefer: "US",
    excludeId: data.selectedImageId,
  });
}

export function buildFocalFocusFromCard(data: DominantLesionCardData | null, fallback = ""): string {
  if (!data) return fallback;
  return [data.lesionLabel, data.site, data.sizeSummary, data.laterality]
    .filter(Boolean)
    .join(" — ");
}
