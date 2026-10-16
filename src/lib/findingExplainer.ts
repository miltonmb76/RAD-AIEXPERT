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

export const FINDING_EXPLAINER_MAX_CARDS = 3;

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
      return {
        id: String(c?.id || `explainer-${i + 1}`),
        label: String(c?.label || c?.finding || `Hallazgo ${i + 1}`).trim(),
        site: String(c?.site || c?.location || "").trim(),
        whatIs: String(c?.whatIs || bullets[0] || "").trim(),
        whereIs: String(c?.whereIs || bullets[1] || "").trim(),
        implies: String(c?.implies || bullets[2] || "").trim(),
        ecoImageUrl: c?.ecoImageUrl || null,
        ecoCaption: c?.ecoCaption || null,
        ecoImageId: c?.ecoImageId || null,
        cgiImageUrl: c?.cgiImageUrl || null,
        cgiCaption: c?.cgiCaption || null,
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
      const caption =
        String(eco.caption || eco.label || "").trim() || "Captura del estudio";
      return {
        ...c,
        ecoImageUrl: eco.url,
        ecoImageId: eco.id || null,
        ecoCaption: caption,
      };
    }),
  };
}
