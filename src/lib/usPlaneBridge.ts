import type {
  UsPlaneBridgeLabel,
  UsPlaneBridgeRealImage,
  UsPlaneSimulatorData,
} from "../types";

export type GalleryImage = {
  id: string;
  url: string;
  label?: string;
  caption?: string;
  preview?: string;
  isSelected?: boolean;
};

/** Build bridge labels from plane data + optional gallery caption (no ML required). */
export function buildUsPlaneBridgeLabels(
  plane: Pick<
    UsPlaneSimulatorData,
    "targetStructure" | "structuresCrossed" | "keyPoints" | "planeLabelEs" | "detectedLaterality"
  > | null | undefined,
  realUs?: UsPlaneBridgeRealImage | null
): UsPlaneBridgeLabel[] {
  const out: UsPlaneBridgeLabel[] = [];
  const seen = new Set<string>();

  const push = (text: string, side: UsPlaneBridgeLabel["side"] = "both") => {
    const t = String(text || "").trim();
    if (!t) return;
    const key = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (seen.has(key) || out.length >= 8) return;
    seen.add(key);
    out.push({ id: `bridge-lbl-${out.length + 1}`, text: t, side });
  };

  if (realUs?.caption) push(realUs.caption, "us");
  else if (realUs?.label) push(realUs.label, "us");

  if (plane?.targetStructure) push(plane.targetStructure, "both");
  if (plane?.planeLabelEs) push(`Plano ${plane.planeLabelEs}`, "both");
  if (plane?.detectedLaterality) push(plane.detectedLaterality, "both");

  (plane?.structuresCrossed || []).slice(0, 5).forEach((s) => push(s, "anatomy"));
  (plane?.keyPoints || []).slice(0, 3).forEach((s) => push(s, "both"));

  return out;
}

/** Prefer a labeled/selected gallery image as default eco real. */
export function suggestRealUsFromGallery(
  gallery: GalleryImage[] | null | undefined
): UsPlaneBridgeRealImage | null {
  const list = (gallery || []).filter((g) => g?.url && g?.id);
  if (!list.length) return null;
  const scored = [...list].sort((a, b) => {
    const score = (g: GalleryImage) =>
      (g.isSelected ? 4 : 0) +
      (String(g.caption || "").trim() ? 3 : 0) +
      (String(g.label || "").trim() ? 1 : 0);
    return score(b) - score(a);
  });
  const hit = scored[0];
  return {
    id: hit.id,
    url: hit.url,
    caption: String(hit.caption || "").trim() || undefined,
    label: String(hit.label || "").trim() || undefined,
  };
}

export function galleryToRealUs(img: GalleryImage): UsPlaneBridgeRealImage {
  return {
    id: img.id,
    url: img.url,
    caption: String(img.caption || "").trim() || undefined,
    label: String(img.label || "").trim() || undefined,
  };
}

/** Primary 3D panel for the bridge pair (prefer anatomy_with_plane). */
export function pickBridgeAnatomyPanel(data: UsPlaneSimulatorData | null | undefined) {
  const panels = data?.panels || [];
  return (
    panels.find((p) => p.panelRole === "anatomy_with_plane" && p.imageUrl) ||
    panels.find((p) => p.imageUrl) ||
    null
  );
}
