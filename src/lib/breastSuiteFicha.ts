/**
 * Ensure Suite Mama ficha fields are never left blank after generation.
 * The model sometimes omits breastSummary/morphologyNotes/axillaryStatus/keyPoints
 * when the JSON schema example doesn't list them — fill from panels/table/synthesis.
 */

export type BreastFichaSource = {
  breastSummary?: string;
  morphologyNotes?: string;
  axillaryStatus?: string;
  keyPoints?: string[] | string;
  morphologicalSynthesis?: string;
  panels?: Array<{
    panelTitle?: string;
    anatomicalFocus?: string;
    panelRole?: string;
  }>;
  lesionTable?: Array<{
    location?: string;
    size?: string;
    composition?: string;
    biradsCategory?: string;
    clinicalImpact?: string;
  }>;
};

function trimStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeKeyPoints(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((k) => trimStr(k)).filter(Boolean);
  }
  const s = trimStr(raw);
  if (!s) return [];
  return s
    .split(/\n+|[•\-]\s+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Remap "Panel B" → "Panel A" etc. safely when panels are renumbered after delete. */
export function remapPanelLetterLabels(
  text: string,
  letterMap: Record<string, string>
): string {
  let out = String(text || "");
  if (!out) return out;
  const entries = Object.entries(letterMap).filter(([a, b]) => a && b && a !== b);
  if (!entries.length) return out;

  // Two-pass with placeholders so B→A and C→B don't collide.
  for (const [oldL] of entries) {
    out = out.replace(
      new RegExp(`\\bPanel(es)?\\s+${oldL}\\b`, "gi"),
      (_m, plural: string | undefined) =>
        plural ? `__PANELES_${oldL}__` : `__PANEL_${oldL}__`
    );
  }
  for (const [oldL, newL] of entries) {
    out = out.split(`__PANEL_${oldL}__`).join(`Panel ${newL}`);
    out = out.split(`__PANELES_${oldL}__`).join(`Paneles ${newL}`);
  }
  return out;
}

export function ensureBreastSuiteFichaFields<T extends BreastFichaSource>(data: T): T {
  const synth = trimStr(data.morphologicalSynthesis);
  const panels = Array.isArray(data.panels) ? data.panels : [];
  const rows = Array.isArray(data.lesionTable) ? data.lesionTable : [];

  let breastSummary = trimStr(data.breastSummary);
  let morphologyNotes = trimStr(data.morphologyNotes);
  let axillaryStatus = trimStr(data.axillaryStatus);
  let keyPoints = normalizeKeyPoints(data.keyPoints);

  if (!breastSummary) {
    const titles = panels
      .map((p) => trimStr(p.panelTitle))
      .filter(Boolean)
      .slice(0, 2);
    breastSummary =
      synth ||
      (titles.length ? titles.join(". ") : "") ||
      (rows[0]
        ? `Hallazgo dominante: ${[rows[0].location, rows[0].composition, rows[0].size, rows[0].biradsCategory]
            .filter(Boolean)
            .join(", ")}.`
        : "Hallazgos mamarios según el informe ecográfico.");
  }

  if (!morphologyNotes) {
    const lesionPanel = panels.find((p) =>
      /lesion|nodule|n[oó]dul|macro|galactocele|quist/i.test(
        `${p.panelRole || ""} ${p.panelTitle || ""} ${p.anatomicalFocus || ""}`
      )
    );
    const rowBits = rows
      .slice(0, 2)
      .map((r) =>
        [r.location, r.composition, r.size, r.biradsCategory, r.clinicalImpact]
          .filter(Boolean)
          .join(", ")
      )
      .filter(Boolean);
    morphologyNotes =
      trimStr(lesionPanel?.anatomicalFocus) ||
      rowBits.join(". ") ||
      synth ||
      "Ver caracterización en la tabla BI-RADS.";
  }

  if (!axillaryStatus) {
    const axPanel = panels.find((p) =>
      /axil|nodes|gangli|drenaje/i.test(
        `${p.panelRole || ""} ${p.panelTitle || ""} ${p.anatomicalFocus || ""}`
      )
    );
    axillaryStatus =
      trimStr(axPanel?.anatomicalFocus) ||
      (synth && /axil|gangli/i.test(synth)
        ? synth
        : "Axilas no detalladas en la ficha generada; revisar el informe.");
  }

  if (!keyPoints.length) {
    keyPoints = rows
      .slice(0, 5)
      .map((r) =>
        [r.location, r.size, r.biradsCategory || r.composition, r.clinicalImpact]
          .filter(Boolean)
          .join(" — ")
      )
      .filter(Boolean);
    if (!keyPoints.length && synth) {
      keyPoints = synth
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12)
        .slice(0, 4);
    }
    if (!keyPoints.length) {
      keyPoints = panels
        .map((p) => trimStr(p.anatomicalFocus) || trimStr(p.panelTitle))
        .filter(Boolean)
        .slice(0, 4);
    }
  }

  return {
    ...data,
    breastSummary,
    morphologyNotes,
    axillaryStatus,
    keyPoints,
  };
}
