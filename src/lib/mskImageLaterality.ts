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
  format?: "atlas" | "infographic";
  expectedCopy?: string;
};

export function buildMskLandmarkBrief(contract: MskImageContract): string {
  if (contract.side === "bilateral") {
    return `BILATERAL STUDY: show both documented sides in separate, explicitly identified anatomical panels. Never transfer a lesion to the other side. Connect each magnification to its own side's oriented overview.\n${buildMskLandmarkBrief({ ...contract, side: "right" })}\n${buildMskLandmarkBrief({ ...contract, side: "left" })}`;
  }
  const lateralLeft = (contract.side === "right") === (contract.view === "AP");
  const lateral = lateralLeft ? "LEFT" : "RIGHT";
  const medial = lateralLeft ? "RIGHT" : "LEFT";
  const landmarks = contract.organ === "knee"
    ? `Fibular head and fibula = LATERAL, on viewer ${lateral}; medial tibial compartment on viewer ${medial}. LATERAL/EXTERNAL meniscus is adjacent to the fibula; MEDIAL/INTERNAL meniscus is opposite the fibula. Anterior horn, body and posterior horn are different sites.`
    : `Humeral greater tuberosity / lateral arm on viewer ${lateral}; medial clavicle toward sternum on viewer ${medial}. Acromion is lateral; do not exchange subscapularis (anterior) with infraspinatus (posterior).`;
  return `LOCKED MSK ANATOMY: PATIENT ${contract.side.toUpperCase()} ${contract.organ.toUpperCase()}, ${contract.view === "AP" ? "ANTERIOR / AP view" : "POSTERIOR / PA view"}. ${landmarks}
This is the orientation WITHIN the anatomical close-up, independent of where the panel is placed on the page. Show enough landmarks to establish the side. Preserve the exact documented clinical site: ${contract.clinicalSite || "Use only the report; do not invent a lesion or compartment"}.
For a unilateral study, illustrate ONLY the locked patient side. Do not add a drawing of the normal contralateral joint; mention it in text only if needed. Full-body orientation silhouettes may show both sides, but highlight only the documented side.
ORIENTATION CONTEXT: the main anatomical overview must establish the locked side and front/back view through recognizable bony landmarks. A magnified tendon/bursa/meniscal detail may omit distant bones when an explicit connector or transparent window locates it in that oriented overview. Do NOT require a sternum, clavicle or both knee compartments inside a tiny tissue magnification. Check the detail's local structure, lesion surface/compartment and connection to the overview; never infer its side from its caption alone. Independent anatomical drawings still need their own orientation evidence. Prefer one clear overview with only the necessary connected details, rather than extra unconnected views. Preserve the documented lesion size relative to anatomy; do not enlarge a small partial lesion into a large or full-thickness defect.
CLINICAL SOURCE IS CLOSED: unmentioned structures are anatomical context only, not diagnosed normal or abnormal. Never add reactive bursitis, effusion, biceps findings, dynamic signs, grades or recommendations absent from the source. Only clinical copy intended for the selected audience may be printed; camera/layout/production instructions are never visible text.
Do not mirror for layout. Do not replace anatomical correction with a different title. Do not print these camera instructions inside the image.`;
}

export type MskValidationReason = "laterality" | "orientation" | "clinical_site" | "clinical_text" | "spelling" | "instructions" | "review_unavailable" | "review_incomplete" | "invalid_image";
export class MskImageValidationError extends Error {
  readonly validation: { reasons: MskValidationReason[]; generated: number; inspected: number; failedChecks: string[]; stopReason: string };
  constructor(reasons: MskValidationReason[] = ["orientation"], generated = 0, inspected = 0,
    failedChecks: string[] = [], stopReason: "attempt_limit" | "insufficient_evidence" | "review_failed" | "invalid_image" = "attempt_limit") {
    const labels: Record<MskValidationReason, string> = {
      laterality: "el lado anatómico", orientation: "la vista o las referencias anatómicas",
      clinical_site: "la ubicación del hallazgo", clinical_text: "la fidelidad del texto al informe",
      spelling: "la escritura o legibilidad del texto", instructions: "la ausencia de instrucciones de dibujo en la imagen",
      review_unavailable: "la revisión automática, por un fallo de comunicación",
      review_incomplete: "la revisión automática, porque su respuesta llegó incompleta",
      invalid_image: "el formato de la imagen generada",
    };
    const unique = [...new Set(reasons)];
    super(`No se pudo confirmar ${unique.map(reason => labels[reason]).join(" y ")}. No se incorporó la imagen al informe.${generated > 1 ? ` Se intentó corregir automáticamente ${generated - 1} ${generated === 2 ? "vez" : "veces"}.` : ""}${stopReason === "insufficient_evidence" ? " La revisión no obtuvo referencias suficientes; se detuvo para evitar repetir generaciones sin una corrección concreta." : ""}`);
    this.name = "MskImageValidationError";
    this.validation = { reasons: unique, generated, inspected,
      failedChecks: [...new Set(failedChecks.filter(key => Object.hasOwn(reasonForCheck, key)))], stopReason };
  }
}

const anatomyChecks = ["anatomicalSide", "view", "lateralLandmarkPosition", "medialLandmarkPosition", "landmarksVisible", "clinicalSiteMatches", "allPanelsConsistent"];
const textChecks = ["textMatchesClinicalSource", "productionInstructionsAbsent", "textLegibleAndCorrect"];
const reasonForCheck: Record<string, MskValidationReason> = {
  anatomicalSide: "laterality", view: "orientation", lateralLandmarkPosition: "orientation", medialLandmarkPosition: "orientation",
  landmarksVisible: "orientation", clinicalSiteMatches: "clinical_site", allPanelsConsistent: "orientation",
  textMatchesClinicalSource: "clinical_text", productionInstructionsAbsent: "instructions", textLegibleAndCorrect: "spelling",
};
const correctionHints: Record<string, string> = {
  wrong_structure: "Relocate the documented lesion to the exact source structure; do not change the diagnosis or measurements.",
  wrong_meniscal_compartment: "The lesion is in the wrong meniscus. External/lateral meniscus is adjacent to the fibula; internal/medial is opposite. Use the source compartment, never swap them.",
  wrong_meniscal_horn: "The lesion is in the wrong meniscal part. Restore the source anterior horn, body or posterior horn; these are different sites.",
  contradictory_inset: "Correct every contradictory inset as well as the main joint; keep the locked side in all of them.",
  altered_measurement: "Restore the exact source measurements and units; never invent new numbers.",
};

function assessments(result: any, contract: MskImageContract): any[] {
  return contract.side === "bilateral" ? (Array.isArray(result?.panels) ? result.panels : []) : [result];
}
function completeAssessment(result: any, contract: MskImageContract): boolean {
  const panels = assessments(result, contract);
  return panels.length >= (contract.side === "bilateral" ? 2 : 1) && panels.every(panel => panel &&
    ["right", "left", "unknown"].includes(panel.anatomicalSide) && ["AP", "PA", "unknown"].includes(panel.view) &&
    ["left", "right", "unknown"].includes(panel.lateralLandmarkPosition) && ["left", "right", "unknown"].includes(panel.medialLandmarkPosition) &&
    ["landmarksVisible", "clinicalSiteMatches", "allPanelsConsistent", ...(contract.format === "infographic" ? textChecks : [])]
      .every(key => typeof panel[key] === "boolean") &&
    Array.isArray(panel.observations) && panel.observations.some((x: unknown) => typeof x === "string" && x.trim().length > 10));
}
function failedAssessmentChecks(result: any, contract: MskImageContract): string[] {
  if (contract.side === "bilateral") {
    const panels = assessments(result, contract);
    const failed = panels.flatMap(panel => panel.anatomicalSide === "right" || panel.anatomicalSide === "left"
      ? failedAssessmentChecks(panel, { ...contract, side: panel.anatomicalSide }) : ["anatomicalSide"]);
    if (!["right", "left"].every(side => panels.some(panel => panel.anatomicalSide === side))) failed.push("anatomicalSide");
    return [...new Set(failed)];
  }
  const lateral = (contract.side === "right") === (contract.view === "AP") ? "left" : "right";
  const expected: Record<string, unknown> = { anatomicalSide: contract.side, view: contract.view,
    lateralLandmarkPosition: lateral, medialLandmarkPosition: lateral === "left" ? "right" : "left" };
  return [...anatomyChecks, ...(contract.format === "infographic" ? textChecks : [])]
    .filter(key => result?.[key] !== (expected[key] ?? true));
}

/** Feedback is constructed from structured reviewer fields, never free-form model
 * observations. The clinical source remains the authority for all corrections. */
export function buildMskCorrectionBrief(contract: MskImageContract, result: any): string {
  const checks = failedAssessmentChecks(result, contract);
  const steps = [`CORRECTION: failed checks: ${checks.join(", ")}. The attached image is a REJECTED candidate, not an anatomical reference to imitate.`];
  for (const panel of assessments(result, contract)) {
    const lockedSide = contract.side === "bilateral" ? "the source side for this panel" : contract.side;
    if (checks.includes("anatomicalSide")) steps.push(`Reviewer observed patient side ${["right", "left", "unknown"].includes(panel?.anatomicalSide) ? panel.anatomicalSide : "unknown"}; required patient side is ${lockedSide}. Rebuild the anatomy for the required side; changing only its caption is not a correction.`);
    if (checks.some(key => ["view", "lateralLandmarkPosition", "medialLandmarkPosition", "landmarksVisible"].includes(key))) {
      const expected = contract.side === "bilateral" ? "as specified separately for each side" : ((contract.side === "right") === (contract.view === "AP") ? "left" : "right");
      steps.push(`Required view is ${contract.view}. Observed lateral landmark position: ${["left", "right", "unknown"].includes(panel?.lateralLandmarkPosition) ? panel.lateralLandmarkPosition : "unknown"}; required viewer position: ${expected}. Redraw with both medial and lateral bony landmarks visible in this same joint.`);
    }
    for (const code of Array.isArray(panel?.correctionCodes) ? panel.correctionCodes : []) {
      const relevant = code === "contradictory_inset" ? checks.includes("allPanelsConsistent")
        : code === "altered_measurement" ? checks.some(key => key === "clinicalSiteMatches" || key === "textMatchesClinicalSource")
        : checks.includes("clinicalSiteMatches");
      if (relevant && typeof code === "string" && Object.hasOwn(correctionHints, code)) steps.push(correctionHints[code]);
    }
  }
  if (checks.includes("clinicalSiteMatches")) steps.push("Restore the precise documented structure, compartment and lesion part from the clinical source; preserve partial/complete and bursal/articular qualifiers.");
  if (checks.includes("allPanelsConsistent")) steps.push(correctionHints.contradictory_inset);
  if (checks.includes("textMatchesClinicalSource")) steps.push("Remove unsupported findings. Restore exact source measurements and clinical qualifiers; do not infer associated pathology.");
  if (checks.includes("textLegibleAndCorrect")) steps.push("Rewrite the planned short visible strings in correct, fully legible Spanish. Preserve measurements; do not truncate words.");
  if (checks.includes("productionInstructionsAbsent")) steps.push("Remove all visible camera, layout or production instructions; only clinical labels belong in the poster.");
  steps.push(checks.some(key => anatomyChecks.includes(key))
    ? "Correct the anatomical drawing itself, not merely its caption. Do not mirror the complete poster or its text."
    : "The anatomy passed its checks: keep it unchanged and correct only the failed visible text.");
  steps.push("Preserve all aspects that passed, the elegant schematic design and correct clinical copy. Re-evaluate the result against the locked source before returning it.");
  return steps.join("\n");
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
  if (contract.format === "infographic" &&
      (result?.textMatchesClinicalSource !== true || result?.productionInstructionsAbsent !== true ||
        result?.textLegibleAndCorrect !== true)) return false;
  const lateral = (contract.side === "right") === (contract.view === "AP") ? "left" : "right";
  const medial = lateral === "left" ? "right" : "left";
  return result?.anatomicalSide === contract.side && result?.view === contract.view &&
    result?.lateralLandmarkPosition === lateral && result?.medialLandmarkPosition === medial &&
    result?.landmarksVisible === true && result?.clinicalSiteMatches === true && result?.allPanelsConsistent === true &&
    Array.isArray(result?.observations) && result.observations.some((x: unknown) => typeof x === "string" && x.trim().length > 10);
}

/** One targeted correction at most. Uncertain orientation is not a known drawing
 * error and must not trigger repeated, expensive edits based on a guess. */
export async function generateCheckedMskImage(args: {
  contract: MskImageContract;
  /** Infographics may be returned for physician review; PDF inclusion is opt-in.
   * Atlas callers keep the existing strict behavior by default. */
  policy?: "strict" | "preview";
  generate: (feedback: string, rejectedImage?: string) => Promise<string>;
  inspect: (imageUrl: string, instruction: string) => Promise<unknown>;
}): Promise<{ imageUrl: string; lateralityQa: { status: "ai_checked" | "needs_review"; attempts: number; reasons?: MskValidationReason[] } }> {
  const preview = args.policy === "preview" && args.contract.format === "infographic";
  const draft = (imageUrl: string, reasons: MskValidationReason[], attempts: number) => ({
    imageUrl, lateralityQa: { status: "needs_review" as const, attempts, reasons: [...new Set(reasons)] },
  });
  const brief = buildMskLandmarkBrief(args.contract);
  let correction = "";
  let previousImage: string | undefined;
  let lastReasons: MskValidationReason[] = ["orientation"];
  let generated = 0, inspected = 0;
  let lastChecks: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let imageUrl: string;
    try { imageUrl = await args.generate(`${brief}\n${correction}`, previousImage); }
    catch (error) {
      if (preview && previousImage) return draft(previousImage, lastReasons, generated);
      throw error;
    }
    generated++;
    if (!/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) {
      if (preview && previousImage) return draft(previousImage, lastReasons, generated);
      throw new MskImageValidationError(["invalid_image"], generated, inspected, [], "invalid_image");
    }
    let result: unknown;
    let reviewFailure: MskValidationReason = "review_incomplete";
    for (let reviewAttempt = 0; reviewAttempt < (preview ? 1 : 2); reviewAttempt++) {
      try {
        inspected++;
        result = await args.inspect(imageUrl, `Audit the DRAWN ANATOMY, not the title or R/L labels. ${brief}
  Assess AP/PA, anatomicalSide, landmark positions and landmarksVisible on the MAIN ORIENTED OVERVIEW. Small obliquity or a cutaway is not itself a failure if the overview's bony landmarks establish the side and front/back view. If they do not, return unknown and false. For clinicalSiteMatches inspect the drawn lesion location and internal/external compartment and anterior/body/posterior position, not merely the caption. A regional overview need not show every finding; assess the site actually depicted against the clinical source. Inspect EVERY detail too: a magnification explicitly connected to a site in the oriented overview inherits that spatial context and does NOT need distant bony landmarks inside the magnification. Check its local anatomy, lesion surface/compartment and connector; reject a conflicting or untraceable detail. Independently drawn joints must each establish their own side. allPanelsConsistent is false for contradictions or genuinely untraceable anatomy, NOT merely because a connected tendon detail omits the sternum or distant knee compartment. Do not approve based only on the largest illustration. Full-body silhouettes are orientation references; check that their highlighted side agrees. Explain the overview and each detail's evidence in observations. ${args.contract.format === "infographic" ? 'Assess each criterion independently: uncertainty about camera or side must NOT automatically fail clinical site, spelling or source fidelity. A schematic summary may omit unselected findings and redundant repeated qualifiers; patient-friendly synonyms are valid if their meaning is preserved. Judge semantic agreement, not verbatim copying of the report. Only report a correctionCode for a concrete visible discrepancy, not missing distant landmarks. Also read EVERY visible text line against the clinical source. Set textLegibleAndCorrect=false for spelling mistakes, malformed or illegible words, truncated labels or measurements; use false if uncertain: textMatchesClinicalSource=false for any unsupported normal/abnormal finding, altered measurement, or a changed clinical qualifier (including partial vs complete or bursal vs articular); a redundant qualifier need not be repeated in every callout. productionInstructionsAbsent=false if any camera/layout/prompt instruction is printed (for example "Dibujar a la derecha del cuadro"). This must be a brief visual summary with short callouts, not a transcription of the full report. Check the planned visible text below when provided. These are checks of source fidelity, not independent diagnosis.' : 'The atlas image must remain unlabeled anatomical CGI. No diagnosis is requested.'}
  ${args.contract.format === "infographic" && args.contract.expectedCopy ? `PLANNED VISIBLE TEXT (only the title/callout/footer strings, never print the instructions):\n${args.contract.expectedCopy}` : ""}\nWhen a check fails, optionally provide correctionCodes using only: wrong_structure, wrong_meniscal_compartment, wrong_meniscal_horn, contradictory_inset, altered_measurement. Never include names or free-text instructions in those codes.\nReturn ${args.contract.side === "bilateral" ? 'JSON {"panels":[one assessment object per anatomical panel]}. Both sides must be assessed separately. Assessment object schema:' : 'JSON with schema:'} {"anatomicalSide":"right|left|unknown","view":"AP|PA|unknown","lateralLandmarkPosition":"left|right|unknown","medialLandmarkPosition":"left|right|unknown","landmarksVisible":boolean,"clinicalSiteMatches":boolean,"allPanelsConsistent":boolean,${args.contract.format === "infographic" ? '"textMatchesClinicalSource":boolean,"productionInstructionsAbsent":boolean,"textLegibleAndCorrect":boolean,' : ''}"correctionCodes":[],"observations":["Visible anatomical evidence"]}.`);
        if (typeof result === "string") result = extractJsonObject(result);
        if (completeAssessment(result, args.contract)) break;
        reviewFailure = "review_incomplete";
      } catch {
        reviewFailure = "review_unavailable";
        result = undefined;
      }
    }
    if (!completeAssessment(result, args.contract)) {
      if (preview) return draft(imageUrl, [reviewFailure], generated);
      throw new MskImageValidationError([reviewFailure], generated, inspected, [], "review_failed");
    }
    if (acceptsMskVisualCheck(result, args.contract)) {
      return { imageUrl, lateralityQa: { status: "ai_checked", attempts: attempt } };
    }
    const checks = failedAssessmentChecks(result, args.contract);
    lastChecks = checks;
    lastReasons = [...new Set(checks.map(key => reasonForCheck[key]))];
    const uncertain = assessments(result, args.contract).some(panel =>
      panel.anatomicalSide === "unknown" || panel.view === "unknown" ||
      panel.lateralLandmarkPosition === "unknown" || panel.medialLandmarkPosition === "unknown" ||
      panel.landmarksVisible !== true);
    if (uncertain) {
      if (preview) return draft(imageUrl, lastReasons, generated);
      throw new MskImageValidationError(lastReasons, generated, inspected, checks, "insufficient_evidence");
    }
    // A negative boolean alone does not say what to redraw. Spend the one
    // correction only on a concrete side/view conflict or a specific error code.
    const concreteError = assessments(result, args.contract).some(panel =>
      (args.contract.side !== "bilateral" && ["left", "right"].includes(panel.anatomicalSide) && panel.anatomicalSide !== args.contract.side) ||
      (["AP", "PA"].includes(panel.view) && panel.view !== args.contract.view) ||
      (Array.isArray(panel.correctionCodes) && panel.correctionCodes.some((code: string) => Object.hasOwn(correctionHints, code))));
    if (preview && (attempt === 2 || !concreteError)) return draft(imageUrl, lastReasons, generated);
    correction = buildMskCorrectionBrief(args.contract, result);
    previousImage = imageUrl;
  }
  throw new MskImageValidationError(lastReasons, generated, inspected, lastChecks);
}
