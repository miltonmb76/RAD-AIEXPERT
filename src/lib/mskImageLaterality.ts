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
  format?: "atlas" | "infographic" | "anatomy";
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
For a unilateral study, illustrate ONLY the locked patient side in every anatomical close-up and inset. Do not add a drawing of the normal contralateral joint; mention it in text only if needed. Full-body orientation silhouettes may show both sides, but highlight only the documented side. Every magnified inset must preserve the locked side and its landmarks.
COMPOSITION OVERRIDE: these camera and orientation requirements override any earlier request for an isolated macro, lateral camera, extreme zoom or cropped cutaway. Keep the joint's medial AND lateral bony landmarks in the same image. For a tendon/bursa/meniscal detail, use a transparent window or enlarged cutaway connected to this oriented joint; do not crop away the orientation context. A small camera obliquity is acceptable only while the front/back view and both landmark positions remain unambiguous. Preserve the documented lesion size relative to anatomy; do not enlarge a small partial lesion into a large or full-thickness defect.
CLINICAL SOURCE IS CLOSED: unmentioned structures are anatomical context only, not diagnosed normal or abnormal. Never add reactive bursitis, effusion, biceps findings, dynamic signs, grades or recommendations absent from the source. Only clinical copy intended for the selected audience may be printed; camera/layout/production instructions are never visible text.
Do not mirror for layout. Do not replace anatomical correction with a different title. Do not print these camera instructions inside the image.`;
}

export class MskImageValidationError extends Error {
  constructor() {
    super("No se pudo confirmar el lado y la ubicación anatómica de la imagen. No se incorporó al informe. Intenta regenerar con una vista más amplia que muestre las referencias anatómicas.");
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
  if (contract.format === "anatomy" && (result?.visibleTextAbsent !== true || result?.noUnsupportedFindings !== true)) return false;
  if (contract.format === "infographic" &&
      (result?.textMatchesClinicalSource !== true || result?.productionInstructionsAbsent !== true)) return false;
  const lateral = (contract.side === "right") === (contract.view === "AP") ? "left" : "right";
  const medial = lateral === "left" ? "right" : "left";
  return result?.anatomicalSide === contract.side && result?.view === contract.view &&
    result?.lateralLandmarkPosition === lateral && result?.medialLandmarkPosition === medial &&
    result?.landmarksVisible === true && result?.clinicalSiteMatches === true && result?.allPanelsConsistent === true &&
    Array.isArray(result?.observations) && result.observations.some((x: unknown) => typeof x === "string" && x.trim().length > 10);
}

/** One visual check per candidate, at most one correction. No unbounded regeneration. */
export async function generateCheckedMskImage(args: {
  contract: MskImageContract;
  generate: (feedback: string) => Promise<string>;
  inspect: (imageUrl: string, instruction: string) => Promise<unknown>;
}): Promise<{ imageUrl: string; lateralityQa: { status: "ai_checked"; attempts: number } }> {
  const brief = buildMskLandmarkBrief(args.contract);
  let failedChecks: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const imageUrl = await args.generate(attempt === 1 ? brief : `${brief}\nCORRECTION: the previous candidate did not pass these checks: ${failedChecks.join(", ")}. Redraw with the full orientation context and only source-supported clinical copy; do not merely relabel it.`);
    if (!/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) throw new MskImageValidationError();
    let result: unknown;
    try {
      result = await args.inspect(imageUrl, `Audit the DRAWN ANATOMY, not the title or R/L labels. ${brief}
Classify the predominant front/back view as AP/PA. Small obliquity or a cutaway is not itself a failure when both medial/lateral bony landmarks remain clearly visible in their required positions and establish the side. If the drawing is a lateral view, an isolated ambiguous crop, or its landmarks do not establish the side, return unknown and false. For clinicalSiteMatches inspect the drawn lesion location and internal/external compartment and anterior/body/posterior position, not merely the caption. A regional overview need not show every finding; assess the site actually depicted against the clinical source. Inspect EVERY anatomical close-up/inset, including small comparison illustrations: allPanelsConsistent is false if any inset contradicts its side label, swaps the side/site, or cannot be oriented. Do not approve based only on the largest illustration. Full-body silhouettes are orientation references; check that their highlighted side agrees. Explain evidence for each inset in observations. ${args.contract.format === "infographic" ? 'Also read EVERY visible text line against the clinical source: textMatchesClinicalSource=false for any unsupported normal/abnormal finding, altered measurement, or omitted/changed qualifier (including partial vs complete or bursal vs articular). productionInstructionsAbsent=false if any camera/layout/prompt instruction is printed (for example "Dibujar a la derecha del cuadro"). These are checks of source fidelity, not independent diagnosis.' : args.contract.format === "anatomy" ? 'Inspect the entire image for text: visibleTextAbsent must be false if there are any letters, words, captions, measurements, numbers or labels anywhere. The application typesets all clinical copy separately. Set noUnsupportedFindings=false if any additional pathology is depicted without support in the source (including reactive bursal inflammation/thickening or effusion inferred merely from the word bursal). Normal surrounding anatomy as orientation context is allowed. No independent diagnosis is requested.' : 'The atlas image must remain unlabeled anatomical CGI. No diagnosis is requested.'}
Return ${args.contract.side === "bilateral" ? 'JSON {"panels":[one assessment object per anatomical panel]}. Both sides must be assessed separately. Assessment object schema:' : 'JSON with schema:'} {"anatomicalSide":"right|left|unknown","view":"AP|PA|unknown","lateralLandmarkPosition":"left|right|unknown","medialLandmarkPosition":"left|right|unknown","landmarksVisible":boolean,"clinicalSiteMatches":boolean,"allPanelsConsistent":boolean,${args.contract.format === "infographic" ? '"textMatchesClinicalSource":boolean,"productionInstructionsAbsent":boolean,' : args.contract.format === "anatomy" ? '"visibleTextAbsent":boolean,"noUnsupportedFindings":boolean,' : ''}"observations":["Visible anatomical evidence"]}.`);
      if (typeof result === "string") result = extractJsonObject(result);
    } catch {
      // Provider failure is not evidence that an image is correct.
      throw new MskImageValidationError();
    }
    if (acceptsMskVisualCheck(result, args.contract)) {
      return { imageUrl, lateralityQa: { status: "ai_checked", attempts: attempt } };
    }
    // Feed back only fixed check names, never model observations or clinical data.
    const checks = ["anatomicalSide", "view", "lateralLandmarkPosition", "medialLandmarkPosition", "landmarksVisible", "clinicalSiteMatches", "allPanelsConsistent"];
    if (args.contract.format === "anatomy") checks.push("visibleTextAbsent", "noUnsupportedFindings");
    if (args.contract.format === "infographic") checks.push("textMatchesClinicalSource", "productionInstructionsAbsent");
    const expected = { anatomicalSide: args.contract.side, view: args.contract.view,
      lateralLandmarkPosition: (args.contract.side === "right") === (args.contract.view === "AP") ? "left" : "right",
      medialLandmarkPosition: (args.contract.side === "right") === (args.contract.view === "AP") ? "right" : "left" };
    failedChecks = args.contract.side === "bilateral" ? ["independent orientation and source fidelity for each side"] :
      checks.filter((key) => (result as any)?.[key] !== ((expected as any)[key] ?? true));
    if (!failedChecks.length) failedChecks = ["visible anatomical evidence for every panel"];
  }
  throw new MskImageValidationError();
}
