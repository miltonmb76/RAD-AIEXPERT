import { extractJsonObject } from "./reasoningChain";

export type MskOrgan = "shoulder" | "knee";
export type MskSide = "right" | "left" | "bilateral" | "unspecified";
export type MskView = "AP" | "PA";

const normalize = (value: unknown) => String(value || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Inputs must be ordered clinical sources, never planner guesses before the report. */
export function resolveMskLaterality(...sources: unknown[]): MskSide {
  for (const source of sources) {
    const text = normalize(source);
    if (!text || /^(auto|automatic[oa]|detectar|none)$/.test(text.trim())) continue;
    // A layout correction such as "mover el texto a la izquierda" is not a
    // correction of the patient's side. Exact UI values remain valid.
    const exactSide = /^(derech[oa]|izquierd[oa]|right|left|der|izq|dcha|bilateral(?:es)?|ambos|ambas|both)$/.test(text.trim());
    if (!exactSide && /\b(texto|flecha|leyenda|etiqueta|columna|pantalla)\b/.test(text) && !/\b(hombro|rodilla|lateralidad|paciente)\b/.test(text)) continue;
    if (!exactSide && !/\b(hombros?|shoulders?|rodillas?|knees?|meniscos?|tendon|manguito|supraespinoso|infraespinoso|subescapular|lado|lateralidad|extremidad)\b/.test(text)) continue;
    const right = /\b(derech[oa]s?|right|dcha|der)\b/.test(text);
    const left = /\b(izquierd[oa]s?|left|izq)\b/.test(text);
    if (/\b(bilateral(?:es)?|ambos|ambas|both)\b/.test(text) || (right && left)) return "bilateral";
    if (right) return "right";
    if (left) return "left";
  }
  return "unspecified";
}

export function mskSideLabel(side: MskSide): string {
  return { right: "Derecha", left: "Izquierda", bilateral: "Bilateral", unspecified: "" }[side];
}

export function hasMskSideConflict(value: unknown, side: MskSide): boolean {
  if (side !== "right" && side !== "left") return false;
  const stated = resolveMskLaterality(value);
  return stated !== "unspecified" && stated !== side;
}

/** Regenerate an invalid/wrong-sided plan once; never invent a right-sided fallback. */
export async function generateMskPlan(side: MskSide, generate: (feedback: string) => Promise<string>): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generate(attempt ? `CORRECCIÓN OBLIGATORIA: el plan anterior era inválido o contradecía el lado clínico ${mskSideLabel(side)}. Corrige paneles, títulos y tabla; usa solo el informe.` : "");
    const plan = extractJsonObject(raw);
    if (!plan || !Array.isArray(plan.panels) || !plan.panels.length || plan.panels.some((p: any) => !p || typeof p !== "object")) continue;
    const labels = [plan.laterality, ...plan.panels.flatMap((p: any) =>
      [p.laterality, p.panelTitle, p.structureOrSite, p.tendonOrSite]),
      ...(Array.isArray(plan.findingTable) ? plan.findingTable.map((r: any) => r?.location) : [])];
    if (labels.some((value) => hasMskSideConflict(value, side))) continue;
    return plan;
  }
  throw new Error("No se pudo obtener un plan anatómico coherente con el lado seleccionado. No se generaron imágenes con un lado supuesto.");
}

export function detectMskOrgan(text: string): MskOrgan | null {
  const value = normalize(text);
  const shoulder = /\b(hombros?|shoulders?|manguito|supraespinoso|infraespinoso|subescapular)\b/.test(value);
  const knee = /\b(rodillas?|knees?|meniscos?|meniscal|rotula)\b/.test(value);
  return shoulder === knee ? null : shoulder ? "shoulder" : "knee";
}

/** Posterior lesion location alone is not a posterior camera view. */
export function detectMskView(prompt: string): MskView {
  return /\b(posterior|dorsal|back)\s+(view|vista)|\b(view|vista)\s+(posterior|dorsal)|\bfrom behind\b|\bPA\b/i.test(prompt)
    ? "PA" : "AP";
}

export type MskImageContract = {
  organ: MskOrgan;
  side: "right" | "left" | "bilateral";
  view: MskView;
  clinicalSite: string;
};

export function buildMskLandmarkBrief(contract: MskImageContract): string {
  if (contract.side === "bilateral") {
    return `BILATERAL STUDY: show both documented sides in separate, explicitly identified anatomical panels. Never transfer a lesion to the other side. Each close-up must have its own orientation landmarks.\n${buildMskLandmarkBrief({ ...contract, side: "right" })}\n${buildMskLandmarkBrief({ ...contract, side: "left" })}`;
  }
  const lateralLeft = (contract.side === "right") === (contract.view === "AP");
  const lateral = lateralLeft ? "LEFT" : "RIGHT";
  const medial = lateralLeft ? "RIGHT" : "LEFT";
  const landmarks = contract.organ === "knee"
    ? `Fibular head and fibula = LATERAL, on viewer ${lateral}; medial tibial compartment on viewer ${medial}. LATERAL/EXTERNAL meniscus is adjacent to the fibula; MEDIAL/INTERNAL meniscus is opposite the fibula. Anterior horn, body and posterior horn are different sites.`
    : `Humeral greater tuberosity / lateral arm on viewer ${lateral}; medial clavicle toward sternum on viewer ${medial}. Acromion is lateral; do not exchange subscapularis (anterior) with infraspinatus (posterior).`;
  return `LOCKED MSK ANATOMY: PATIENT ${contract.side.toUpperCase()} ${contract.organ.toUpperCase()}, ${contract.view === "AP" ? "ANTERIOR / AP view" : "POSTERIOR / PA view"}. ${landmarks}
This is the orientation WITHIN the anatomical close-up, independent of where the panel is placed on the page. Show enough landmarks to establish the side. Preserve the exact documented clinical site: ${contract.clinicalSite || "Use only the report; do not invent a lesion or compartment"}.
Do not mirror for layout. Do not replace anatomical correction with a different title. Do not print these camera instructions inside the image.`;
}

export class MskImageValidationError extends Error {
  constructor() {
    super("No se pudo confirmar el lado y la ubicación anatómica de la imagen. No se incorporó al informe. Revisa el lado seleccionado y vuelve a generar.");
    this.name = "MskImageValidationError";
  }
}

/** Strict result schema: labels alone and missing/ambiguous landmarks never count as evidence. */
export function acceptsMskVisualCheck(result: any, contract: MskImageContract): boolean {
  if (contract.side === "bilateral") {
    if (!Array.isArray(result?.panels) || result.panels.length < 2) return false;
    return ["right", "left"].every((side) => result.panels.some((panel: any) =>
      acceptsMskVisualCheck(panel, { ...contract, side: side as "right" | "left" }))) &&
      result.panels.every((panel: any) => (panel?.anatomicalSide === "right" || panel?.anatomicalSide === "left") &&
        acceptsMskVisualCheck(panel, { ...contract, side: panel.anatomicalSide }));
  }
  const lateral = (contract.side === "right") === (contract.view === "AP") ? "left" : "right";
  const medial = lateral === "left" ? "right" : "left";
  return result?.anatomicalSide === contract.side && result?.view === contract.view &&
    result?.lateralLandmarkPosition === lateral && result?.medialLandmarkPosition === medial &&
    result?.landmarksVisible === true && result?.clinicalSiteMatches === true &&
    Array.isArray(result?.observations) && result.observations.some((x: unknown) => typeof x === "string" && x.trim().length > 10);
}

/** One visual check per candidate, at most one correction. No unbounded regeneration. */
export async function generateCheckedMskImage(args: {
  contract: MskImageContract;
  generate: (feedback: string) => Promise<string>;
  inspect: (imageUrl: string, instruction: string) => Promise<unknown>;
}): Promise<{ imageUrl: string; lateralityQa: { status: "ai_checked"; attempts: number } }> {
  const brief = buildMskLandmarkBrief(args.contract);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const imageUrl = await args.generate(attempt === 1 ? brief : `${brief}\nCORRECTION: the previous candidate could not establish the required side/site. Regenerate with clear orientation landmarks; do not merely relabel it.`);
    if (!/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) throw new MskImageValidationError();
    let result: unknown;
    try {
      result = await args.inspect(imageUrl, `Audit the DRAWN ANATOMY, not the title or R/L labels. ${brief}
If the camera is lateral/oblique or landmarks do not establish the side, return unknown and false. For clinicalSiteMatches inspect the drawn lesion location and internal/external compartment and anterior/body/posterior position, not merely the caption. A regional overview need not show every finding; assess the site actually depicted against the clinical source. No diagnosis is requested.
Return ${args.contract.side === "bilateral" ? 'JSON {"panels":[one assessment object per anatomical panel]}. Both sides must be assessed separately. Assessment object schema:' : 'JSON with schema:'} {"anatomicalSide":"right|left|unknown","view":"AP|PA|unknown","lateralLandmarkPosition":"left|right|unknown","medialLandmarkPosition":"left|right|unknown","landmarksVisible":boolean,"clinicalSiteMatches":boolean,"observations":["Visible anatomical evidence"]}.`);
      if (typeof result === "string") result = extractJsonObject(result);
    } catch {
      // Provider failure is not evidence that an image is correct.
      throw new MskImageValidationError();
    }
    if (acceptsMskVisualCheck(result, args.contract)) {
      return { imageUrl, lateralityQa: { status: "ai_checked", attempts: attempt } };
    }
  }
  throw new MskImageValidationError();
}
