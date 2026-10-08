/**
 * Generic numbered findings map — organ-agnostic templates + normalizer.
 */

export type FindingsMapTemplateId =
  | "body_anterior"
  | "abdomen"
  | "chest"
  | "breast_bilateral"
  | "neck"
  | "msk_joint"
  | "scrotum"
  | "generic";

export type FindingsMapViewOrientation = "AP" | "PA";

export type FindingsMapItem = {
  n: number;
  label: string;
  detail?: string;
  side?: string;
  /** Slot key from the chosen template */
  regionKey: string;
  /** Linked figure number from report, if any */
  figureRef?: number | null;
  severity?: "primary" | "secondary";
  x?: number; // 0–100 override
  y?: number;
};

export type FindingsMapData = {
  title: string;
  studyRegion: string;
  templateId: FindingsMapTemplateId;
  viewOrientation: FindingsMapViewOrientation;
  items: FindingsMapItem[];
  /** Echo of physician prior instructions */
  priorInstructions?: string;
  generatedAt?: string;
};

export type FindingsMapSlot = {
  key: string;
  label: string;
  x: number; // percent 0–100
  y: number;
};

export type FindingsMapTemplate = {
  id: FindingsMapTemplateId;
  label: string;
  slots: FindingsMapSlot[];
  /** Simple SVG silhouette paths (viewBox 0 0 100 120) */
  silhouette: string;
};

const TEMPLATES: FindingsMapTemplate[] = [
  {
    id: "body_anterior",
    label: "Cuerpo (anterior)",
    silhouette: `
      <ellipse cx="50" cy="14" rx="8" ry="9" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <path d="M38 24 L62 24 L68 55 L60 88 L40 88 L32 55 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <path d="M32 30 L18 48 L22 52 L36 36" fill="#334155" stroke="#64748b" stroke-width="1"/>
      <path d="M68 30 L82 48 L78 52 L64 36" fill="#334155" stroke="#64748b" stroke-width="1"/>
      <path d="M42 88 L40 112 L46 112 L48 88" fill="#334155" stroke="#64748b" stroke-width="1"/>
      <path d="M58 88 L60 112 L54 112 L52 88" fill="#334155" stroke="#64748b" stroke-width="1"/>
    `,
    slots: [
      { key: "head", label: "Cabeza/cuello", x: 50, y: 14 },
      { key: "chest_r", label: "Hemitórax der.", x: 40, y: 36 },
      { key: "chest_l", label: "Hemitórax izq.", x: 60, y: 36 },
      { key: "abdomen", label: "Abdomen", x: 50, y: 52 },
      { key: "pelvis", label: "Pelvis", x: 50, y: 68 },
      { key: "arm_r", label: "Miembro sup. der.", x: 22, y: 44 },
      { key: "arm_l", label: "Miembro sup. izq.", x: 78, y: 44 },
      { key: "leg_r", label: "Miembro inf. der.", x: 42, y: 100 },
      { key: "leg_l", label: "Miembro inf. izq.", x: 58, y: 100 },
    ],
  },
  {
    id: "abdomen",
    label: "Abdomen",
    silhouette: `
      <rect x="22" y="18" width="56" height="84" rx="18" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <ellipse cx="38" cy="40" rx="10" ry="14" fill="#334155" opacity="0.7"/>
      <ellipse cx="62" cy="42" rx="9" ry="12" fill="#334155" opacity="0.55"/>
      <path d="M30 70 Q50 78 70 70" fill="none" stroke="#475569" stroke-width="1.2"/>
    `,
    slots: [
      { key: "ruq", label: "HCD / hígado", x: 38, y: 36 },
      { key: "luq", label: "HCI / bazo", x: 64, y: 36 },
      { key: "epigastrium", label: "Epigastrio", x: 50, y: 42 },
      { key: "rlq", label: "FID", x: 38, y: 72 },
      { key: "llq", label: "FII", x: 64, y: 72 },
      { key: "flank_r", label: "Flanco der.", x: 28, y: 54 },
      { key: "flank_l", label: "Flanco izq.", x: 72, y: 54 },
      { key: "pelvis", label: "Pelvis", x: 50, y: 88 },
      { key: "midline", label: "Línea media", x: 50, y: 58 },
    ],
  },
  {
    id: "chest",
    label: "Tórax",
    silhouette: `
      <path d="M28 20 Q50 10 72 20 L78 70 Q50 88 22 70 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <path d="M50 22 L50 78" stroke="#475569" stroke-width="1" stroke-dasharray="2 2"/>
      <ellipse cx="38" cy="48" rx="12" ry="22" fill="#334155" opacity="0.55"/>
      <ellipse cx="62" cy="48" rx="12" ry="22" fill="#334155" opacity="0.55"/>
    `,
    slots: [
      { key: "apex_r", label: "Ápex der.", x: 36, y: 28 },
      { key: "apex_l", label: "Ápex izq.", x: 64, y: 28 },
      { key: "mid_r", label: "Campo medio der.", x: 34, y: 48 },
      { key: "mid_l", label: "Campo medio izq.", x: 66, y: 48 },
      { key: "base_r", label: "Base der.", x: 36, y: 68 },
      { key: "base_l", label: "Base izq.", x: 64, y: 68 },
      { key: "hilum", label: "Hilios/mediastino", x: 50, y: 48 },
      { key: "pleura_r", label: "Pleura der.", x: 26, y: 50 },
      { key: "pleura_l", label: "Pleura izq.", x: 74, y: 50 },
    ],
  },
  {
    id: "breast_bilateral",
    label: "Mamas bilaterales",
    silhouette: `
      <circle cx="32" cy="55" r="22" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <circle cx="68" cy="55" r="22" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <circle cx="32" cy="55" r="3" fill="#94a3b8"/>
      <circle cx="68" cy="55" r="3" fill="#94a3b8"/>
      <text x="32" y="90" text-anchor="middle" fill="#64748b" font-size="5" font-family="sans-serif">DER</text>
      <text x="68" y="90" text-anchor="middle" fill="#64748b" font-size="5" font-family="sans-serif">IZQ</text>
    `,
    slots: [
      { key: "r_uoq", label: "CSE der.", x: 24, y: 42 },
      { key: "r_uiq", label: "CSI der.", x: 40, y: 42 },
      { key: "r_loq", label: "CIE der.", x: 24, y: 68 },
      { key: "r_liq", label: "CII der.", x: 40, y: 68 },
      { key: "r_retro", label: "Retroareolar der.", x: 32, y: 55 },
      { key: "r_axilla", label: "Axila der.", x: 12, y: 40 },
      { key: "l_uoq", label: "CSE izq.", x: 76, y: 42 },
      { key: "l_uiq", label: "CSI izq.", x: 60, y: 42 },
      { key: "l_loq", label: "CIE izq.", x: 76, y: 68 },
      { key: "l_liq", label: "CII izq.", x: 60, y: 68 },
      { key: "l_retro", label: "Retroareolar izq.", x: 68, y: 55 },
      { key: "l_axilla", label: "Axila izq.", x: 88, y: 40 },
    ],
  },
  {
    id: "neck",
    label: "Cuello / tiroides",
    silhouette: `
      <ellipse cx="50" cy="18" rx="14" ry="12" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <path d="M40 28 L60 28 L64 70 L36 70 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <path d="M42 48 Q50 40 58 48 Q50 58 42 48" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
    `,
    slots: [
      { key: "lobe_r", label: "Lóbulo der.", x: 42, y: 48 },
      { key: "lobe_l", label: "Lóbulo izq.", x: 58, y: 48 },
      { key: "isthmus", label: "Istmo", x: 50, y: 50 },
      { key: "node_r", label: "Ganglios der.", x: 30, y: 44 },
      { key: "node_l", label: "Ganglios izq.", x: 70, y: 44 },
      { key: "midline", label: "Línea media", x: 50, y: 36 },
    ],
  },
  {
    id: "msk_joint",
    label: "Articulación / MSK",
    silhouette: `
      <ellipse cx="50" cy="55" rx="28" ry="32" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <ellipse cx="50" cy="55" rx="10" ry="12" fill="#334155" opacity="0.8"/>
      <path d="M50 22 L50 88" stroke="#475569" stroke-width="1" stroke-dasharray="2 2"/>
    `,
    slots: [
      { key: "anterior", label: "Anterior", x: 50, y: 30 },
      { key: "posterior", label: "Posterior", x: 50, y: 80 },
      { key: "medial", label: "Medial", x: 28, y: 55 },
      { key: "lateral", label: "Lateral", x: 72, y: 55 },
      { key: "superior", label: "Superior", x: 50, y: 38 },
      { key: "inferior", label: "Inferior", x: 50, y: 72 },
      { key: "center", label: "Centro / articulación", x: 50, y: 55 },
    ],
  },
  {
    id: "scrotum",
    label: "Escroto",
    silhouette: `
      <ellipse cx="38" cy="55" rx="16" ry="22" fill="#1e293b" stroke="#64748b" stroke-width="1.3"/>
      <ellipse cx="62" cy="55" rx="16" ry="22" fill="#1e293b" stroke="#64748b" stroke-width="1.3"/>
      <text x="38" y="90" text-anchor="middle" fill="#64748b" font-size="5">DER</text>
      <text x="62" y="90" text-anchor="middle" fill="#64748b" font-size="5">IZQ</text>
    `,
    slots: [
      { key: "testis_r", label: "Testículo der.", x: 38, y: 52 },
      { key: "testis_l", label: "Testículo izq.", x: 62, y: 52 },
      { key: "epididymis_r", label: "Epidídimo der.", x: 38, y: 36 },
      { key: "epididymis_l", label: "Epidídimo izq.", x: 62, y: 36 },
      { key: "cord_r", label: "Cordón der.", x: 30, y: 28 },
      { key: "cord_l", label: "Cordón izq.", x: 70, y: 28 },
    ],
  },
  {
    id: "generic",
    label: "Genérico (rejilla)",
    silhouette: `
      <rect x="10" y="10" width="80" height="100" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
      <path d="M10 43 L90 43 M10 76 L90 76 M37 10 L37 110 M63 10 L63 110" stroke="#334155" stroke-width="0.8"/>
    `,
    slots: [
      { key: "tl", label: "Sup. izq. del cuadro", x: 24, y: 26 },
      { key: "tc", label: "Sup. centro", x: 50, y: 26 },
      { key: "tr", label: "Sup. der. del cuadro", x: 76, y: 26 },
      { key: "ml", label: "Medio izq.", x: 24, y: 55 },
      { key: "mc", label: "Centro", x: 50, y: 55 },
      { key: "mr", label: "Medio der.", x: 76, y: 55 },
      { key: "bl", label: "Inf. izq.", x: 24, y: 88 },
      { key: "bc", label: "Inf. centro", x: 50, y: 88 },
      { key: "br", label: "Inf. der.", x: 76, y: 88 },
    ],
  },
];

export function listFindingsMapTemplates(): FindingsMapTemplate[] {
  return TEMPLATES;
}

export function getFindingsMapTemplate(id: string | undefined): FindingsMapTemplate {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === "generic")!;
}

export function templateCatalogForPrompt(): string {
  return TEMPLATES.map(
    (t) =>
      `- "${t.id}" (${t.label}): slots = ${t.slots.map((s) => s.key).join(", ")}`
  ).join("\n");
}

function cleanText(v: unknown, max = 180): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function resolveSlot(
  template: FindingsMapTemplate,
  regionKey: string,
  side?: string
): FindingsMapSlot {
  const key = String(regionKey || "").trim().toLowerCase();
  const direct = template.slots.find((s) => s.key === key);
  if (direct) return direct;

  // Fuzzy helpers
  const sideNorm = String(side || "").toLowerCase();
  const preferRight = /derech/.test(sideNorm) || key.includes("_r") || key.endsWith("r");
  const preferLeft = /izquier/.test(sideNorm) || key.includes("_l") || key.endsWith("l");

  if (preferRight) {
    const hit = template.slots.find((s) => /_r$|right|der|medial/.test(s.key) === false && /_r|der|right/.test(s.key));
    if (hit) return hit;
  }
  if (preferLeft) {
    const hit = template.slots.find((s) => /_l|izq|left/.test(s.key));
    if (hit) return hit;
  }

  return template.slots.find((s) => s.key === "center" || s.key === "mc" || s.key === "midline") || template.slots[0];
}

export function normalizeFindingsMapData(raw: any, priorInstructions?: string): FindingsMapData {
  const templateId = (TEMPLATES.find((t) => t.id === raw?.templateId)?.id ||
    TEMPLATES.find((t) => t.id === raw?.template)?.id ||
    "generic") as FindingsMapTemplateId;
  const template = getFindingsMapTemplate(templateId);
  const viewOrientation: FindingsMapViewOrientation =
    String(raw?.viewOrientation || raw?.orientation || "AP").toUpperCase() === "PA" ? "PA" : "AP";

  const list = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.findings)
      ? raw.findings
      : Array.isArray(raw?.hallazgos)
        ? raw.hallazgos
        : [];

  const items: FindingsMapItem[] = list
    .map((it: any, idx: number) => {
      const label = cleanText(it?.label || it?.title || it?.name, 80);
      if (!label) return null;
      const slot = resolveSlot(template, it?.regionKey || it?.slot || it?.region || "", it?.side);
      const n = Number(it?.n || it?.figureRef || idx + 1) || idx + 1;
      const fig = it?.figureRef ?? it?.figura ?? null;
      const figureRef =
        fig === null || fig === undefined || fig === ""
          ? null
          : Number(fig) || null;
      const x = Number(it?.x);
      const y = Number(it?.y);
      return {
        n,
        label,
        detail: cleanText(it?.detail || it?.description || "", 200) || undefined,
        side: cleanText(it?.side || "", 40) || undefined,
        regionKey: slot.key,
        figureRef,
        severity: String(it?.severity || "").toLowerCase() === "primary" ? "primary" : "secondary",
        x: Number.isFinite(x) && x >= 0 && x <= 100 ? x : slot.x,
        y: Number.isFinite(y) && y >= 0 && y <= 100 ? y : slot.y,
      } as FindingsMapItem;
    })
    .filter(Boolean) as FindingsMapItem[];

  // Re-number 1..n in list order (stable for legend)
  items.forEach((it, i) => {
    it.n = i + 1;
  });

  return {
    title: cleanText(raw?.title, 80) || "Mapa de hallazgos",
    studyRegion: cleanText(raw?.studyRegion || raw?.region, 80) || template.label,
    templateId,
    viewOrientation,
    items: items.slice(0, 12),
    priorInstructions: cleanText(priorInstructions || raw?.priorInstructions, 500) || undefined,
    generatedAt: new Date().toISOString(),
  };
}

export function positionedItems(data: FindingsMapData): Array<FindingsMapItem & { slotLabel: string }> {
  const template = getFindingsMapTemplate(data.templateId);
  return data.items.map((it) => {
    const slot = template.slots.find((s) => s.key === it.regionKey) || template.slots[0];
    return {
      ...it,
      x: it.x ?? slot.x,
      y: it.y ?? slot.y,
      slotLabel: slot.label,
    };
  });
}
