/** Multi-finding Explainer: stacked cards (eco + CGI + 3 bullets). */

export type FindingExplainerCard = {
  id: string;
  /** Short finding label, e.g. "Hemangioma hepatico" */
  label: string;
  /** Anatomic site / laterality, e.g. "Higado derecho, segmento VI" */
  site: string;
  /** Bullet 1 — what it is */
  whatIs: string;
  /** Bullet 2 — where */
  whereIs: string;
  /** Bullet 3 — clinical implication */
  implies: string;
  ecoImageUrl?: string | null;
  ecoCaption?: string | null;
  ecoImageId?: string | null;
  cgiImageUrl?: string | null;
  cgiCaption?: string | null;
  includeInReport?: boolean;
};

export type FindingExplainerData = {
  title?: string;
  studyRegion?: string;
  cards: FindingExplainerCard[];
  generatedAt?: string;
};

export const FINDING_EXPLAINER_MAX_CARDS = 4;
/** Max chars for image rotulo under eco/CGI (fits one line in UI + PDF). */
export const EXPLAINER_ROTULO_MAX = 42;

/** Fixed annotation slots shown in the Explainer UI (Hallazgo 1..N). */
export const FINDING_EXPLAINER_SLOT_COUNT = FINDING_EXPLAINER_MAX_CARDS;

export function emptyFindingExplainerSlots(): string[] {
  return Array.from({ length: FINDING_EXPLAINER_SLOT_COUNT }, () => "");
}

/** Build ordered server hints from filled Hallazgo 1..N slots. */
export function buildFindingExplainerSlotHints(
  slots: string[],
  opts?: { diagnosisAnchor?: string }
): { findingHints: string; maxFindings: number; filledSlots: string[] } {
  const filledSlots = (slots || [])
    .slice(0, FINDING_EXPLAINER_SLOT_COUNT)
    .map((s) => String(s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines = filledSlots.map((text, i) => `Hallazgo ${i + 1}: ${text}`);
  const anchor = String(opts?.diagnosisAnchor || "").trim();
  const parts = [
    anchor ? `Ancla diagnostica: ${anchor}` : "",
    filledSlots.length
      ? [
          "SLOTS OBLIGATORIOS (orden fijo; genera EXACTAMENTE estos hallazgos, uno por slot relleno; no inventes extras ni omitas slots rellenos):",
          ...lines,
        ].join("\n")
      : "",
  ].filter(Boolean);
  return {
    findingHints: parts.join("\n\n"),
    maxFindings: filledSlots.length
      ? Math.min(FINDING_EXPLAINER_MAX_CARDS, filledSlots.length)
      : 2,
    filledSlots,
  };
}

/**
 * Short image caption for Explainer cards.
 * Prefer a short gallery label or finding name ("Colelitiasis") over long
 * prose captions that get clipped in the layout.
 */
export function shortExplainerRotulo(opts: {
  findingLabel?: string | null;
  galleryLabel?: string | null;
  galleryCaption?: string | null;
  fallback?: string;
  maxLen?: number;
}): string {
  const max = opts.maxLen ?? EXPLAINER_ROTULO_MAX;
  const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
  const soft = (s: string) => {
    if (!s) return "";
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1);
    const sp = cut.lastIndexOf(" ");
    return `${(sp > 12 ? cut.slice(0, sp) : cut).trimEnd()}…`;
  };

  const galLabel = clean(opts.galleryLabel || "");
  const finding = clean(opts.findingLabel || "");
  const galCap = clean(opts.galleryCaption || "");

  // Full short gallery rotulo when it already fits
  if (galLabel && galLabel.length <= max) return galLabel;
  // Finding name: "Colelitiasis", "Congestión venosa hepática"
  if (finding && finding.length <= max) return finding;
  // Full gallery caption only when short enough
  if (galCap && galCap.length <= max) return galCap;

  if (galLabel) return soft(galLabel);
  if (finding) return soft(finding);
  if (galCap) {
    const clause = (galCap.split(/[.;:—–\n]/)[0] || galCap).trim();
    return clause.length <= max ? clause : soft(clause);
  }
  return opts.fallback || "Captura del estudio";
}

export function findingExplainerIsRenderable(
  data: FindingExplainerData | null | undefined
): boolean {
  if (!data?.cards?.length) return false;
  return data.cards.some(
    (c) =>
      c &&
      c.includeInReport !== false &&
      String(c.label || "").trim() &&
      (String(c.whatIs || "").trim() ||
        String(c.cgiImageUrl || "").trim() ||
        String(c.ecoImageUrl || "").trim())
  );
}

export function normalizeFindingExplainerData(
  raw: any,
  opts?: { maxCards?: number }
): FindingExplainerData {
  const max = Math.min(
    FINDING_EXPLAINER_MAX_CARDS,
    Math.max(1, Number(opts?.maxCards) || FINDING_EXPLAINER_MAX_CARDS)
  );
  const cardsIn = Array.isArray(raw?.cards) ? raw.cards : [];
  const cards: FindingExplainerCard[] = cardsIn
    .slice(0, max)
    .map((c: any, i: number) => {
      const bullets = Array.isArray(c?.bullets) ? c.bullets.map(String) : [];
      const label = String(c?.label || c?.finding || `Hallazgo ${i + 1}`).trim();
      const ecoCaptionRaw = c?.ecoCaption != null ? String(c.ecoCaption) : "";
      const cgiCaptionRaw = c?.cgiCaption != null ? String(c.cgiCaption) : "";
      return {
        id: String(c?.id || `explainer-${i + 1}`),
        label,
        site: String(c?.site || c?.location || "").trim(),
        whatIs: String(c?.whatIs || bullets[0] || "").trim(),
        whereIs: String(c?.whereIs || bullets[1] || "").trim(),
        implies: String(c?.implies || bullets[2] || "").trim(),
        ecoImageUrl: c?.ecoImageUrl || null,
        ecoCaption: ecoCaptionRaw
          ? shortExplainerRotulo({
              findingLabel: label,
              galleryCaption: ecoCaptionRaw,
              fallback: label,
            })
          : null,
        ecoImageId: c?.ecoImageId || null,
        cgiImageUrl: c?.cgiImageUrl || null,
        cgiCaption: shortExplainerRotulo({
          findingLabel: label,
          galleryCaption: cgiCaptionRaw || label,
          fallback: label,
        }),
        includeInReport: c?.includeInReport !== false,
      };
    })
    .filter((c: FindingExplainerCard) => c.label);

  return {
    title: String(raw?.title || "Explainer de hallazgos").trim(),
    studyRegion: String(raw?.studyRegion || "").trim() || undefined,
    cards,
    generatedAt: raw?.generatedAt || new Date().toISOString(),
  };
}

export function explainerCardsForPdf(
  data: FindingExplainerData | null | undefined
): FindingExplainerCard[] {
  if (!data?.cards?.length) return [];
  return data.cards.filter((c) => c && c.includeInReport !== false);
}

/** Assign (or clear) the US capture on one explainer card. */
export function assignEcoToExplainerCard(
  data: FindingExplainerData,
  cardId: string,
  eco: {
    id?: string | null;
    url?: string | null;
    caption?: string | null;
    label?: string | null;
  } | null
): FindingExplainerData {
  return {
    ...data,
    cards: data.cards.map((c) => {
      if (c.id !== cardId) return c;
      if (!eco?.url) {
        return {
          ...c,
          ecoImageUrl: null,
          ecoImageId: null,
          ecoCaption: null,
        };
      }
      return {
        ...c,
        ecoImageUrl: eco.url,
        ecoImageId: eco.id || null,
        ecoCaption: shortExplainerRotulo({
          findingLabel: c.label,
          galleryLabel: eco.label,
          galleryCaption: eco.caption,
          fallback: c.label || "Captura del estudio",
        }),
      };
    }),
  };
}
