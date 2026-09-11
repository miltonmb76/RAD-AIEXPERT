import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Lazy-loaded GenAI client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;
let lastUsedKey: string | undefined = undefined;

function cleanGeminiKey(key: string): string {
  if (!key) return "";
  let clean = key.trim();
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, "");
  clean = clean.replace(/\\"/g, '"').replace(/\\'/g, "'");

  if (clean.includes("=")) {
    const parts = clean.split("=");
    const prefix = parts[0].toLowerCase();
    if (prefix.includes("gemini") || prefix.includes("key") || prefix.includes("export") || prefix.includes("env")) {
      clean = parts.slice(1).join("=").trim();
    }
  }

  if (clean.toLowerCase().startsWith("key:") || clean.toLowerCase().startsWith("apikey:") || clean.toLowerCase().startsWith("api_key:")) {
    clean = clean.substring(clean.indexOf(":") + 1).trim();
  }
  
  const quoteChars = ['"', "'", '“', '”', '‘', '’', '„', '`', '\\'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const char of quoteChars) {
      if (clean.startsWith(char)) {
        clean = clean.slice(1);
        changed = true;
      }
      if (clean.endsWith(char)) {
        clean = clean.slice(0, -1);
        changed = true;
      }
    }
    const beforeTrim = clean;
    clean = clean.trim();
    if (clean !== beforeTrim) {
      changed = true;
    }
  }
  return clean;
}

function getGeminiClient(): GoogleGenAI {
  try {
    dotenv.config({ override: true });
  } catch (e) {
    console.warn("No se pudo recargar el archivo .env:", e);
  }

  const rawKey = process.env.GEMINI_API_KEY || "";
  const apiKey = cleanGeminiKey(rawKey);
  
  if (!apiKey) {
    throw new Error("La variable de entorno GEMINI_API_KEY no está configurada, está vacía o solo contiene comillas. Por favor, añádela en la sección de Secretos de AI Studio.");
  }

  process.env.GEMINI_API_KEY = apiKey;
  
  if (!aiClient || lastUsedKey !== apiKey) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    lastUsedKey = apiKey;
  }
  return aiClient;
}

function getModelName(requestedModel?: string): string {
  if (requestedModel === "gemini-3.1-pro-preview" || requestedModel === "gemini-3.1-pro") {
    return "gemini-3.1-pro-preview";
  }
  if (requestedModel === "gemini-3.8-flash") {
    return "gemini-3.8-flash";
  }
  if (requestedModel === "gemini-3.7-flash") {
    return "gemini-3.7-flash";
  }
  return "gemini-3.8-flash";
}

function handleGeminiError(error: any): string {
  const errorMsg = error?.message || "";
  const fullErrorStr = `${errorMsg} ${String(error)}`.toLowerCase();
  
  if (
    fullErrorStr.includes("expired") ||
    fullErrorStr.includes("api_key_invalid") ||
    fullErrorStr.includes("api key not found") ||
    fullErrorStr.includes("key not found") ||
    fullErrorStr.includes("403") ||
    fullErrorStr.includes("unauthenticated")
  ) {
    return "Error de autenticación con la API de Gemini. Por favor verifica tu GEMINI_API_KEY en la configuración.";
  }
  return `Error en la generación con IA: ${errorMsg || "Comprueba la conexión y vuelve a intentar."}`;
}


const FAITHFUL_STYLE =
  "High-fidelity photorealistic 3D medical anatomical render, volumetric surgical cutaway, accurate topographic relationships and true anatomical scale. Premium tissue materials: realistic fascia, muscle fiber microtexture, visceral parenchyma, periosteum and serosa with physically based subsurface scattering. Soft cinematic clinical studio lighting with gentle rim light and shallow depth cues for clarity—NOT neon, NOT bioluminescent, NOT exaggerated glow. Pathology highlighted with restrained chromatic accent ONLY where the report describes it. No invented lesions. Pure clean background. STRICTLY NO text, NO letters, NO numbers, NO arrows, NO labels inside the image.";

/**
 * Radiographic AP laterality (shared by Atlas / Focal / Vascular).
 * "Derecha" = patient's anatomical right when facing the camera (radiografía AP),
 * which appears on the VIEWER'S LEFT of the frame — never the observer's right hand.
 */
const LATERALITY_HARD_RULES =
  "LATERALITY HARD RULES (never violate — radiografía AP / patient facing camera): " +
  "(0) 'Derecha/Right' ALWAYS means the PATIENT'S anatomical right, NEVER the viewer's right-hand side of the screen. " +
  "(1) DEFAULT VIEW = AP / coronal / anterior / frontal (patient faces observer, like a frontal AP radiograph): " +
  "PATIENT'S RIGHT anatomy and pathology MUST appear on the VIEWER'S LEFT of the image frame; " +
  "PATIENT'S LEFT anatomy and pathology MUST appear on the VIEWER'S RIGHT of the image frame. " +
  "(2) POSTERIOR / DORSAL view only (explicit): patient right → viewer right; patient left → viewer left. " +
  "(3) imageLeftStructure / imageRightStructure are VIEWER-left / VIEWER-right anchors and MUST obey (1) or (2) for the chosen view. " +
  "(4) Do NOT mirror anatomy for aesthetics; bilateral: never swap sides between panels. " +
  "(5) A beautiful but laterality-wrong image is a CRITICAL FAIL.";

/** Spanish planning block for Atlas / Focal planners. */
const LATERALITY_PLAN_RULES_ES =
  "REGLA SUPREMA DE LATERALIDAD (como radiografía AP / paciente visto de frente):\n" +
  "- \"Derecha\" / \"Izquierda\" = lado ANATÓMICO DEL PACIENTE, NUNCA el lado de la mano del observador.\n" +
  "- Vista AP / coronal / anterior / frontal (por defecto): el LADO DERECHO DEL PACIENTE queda a la IZQUIERDA DEL CUADRO; " +
  "el LADO IZQUIERDO DEL PACIENTE queda a la DERECHA DEL CUADRO.\n" +
  "- Vista posterior / dorsal (solo si se declara explícitamente): lado derecho del paciente a la derecha del cuadro; izquierdo a la izquierda.\n" +
  "- imageLeftStructure / imageRightStructure = anclas del OBSERVADOR coherentes con esa convención " +
  "(ej. rodilla derecha AP: compartimento lateral/peroné a la IZQUIERDA del cuadro; medial a la DERECHA).\n" +
  "- pathologySite debe nombrar el lado del paciente. PROHIBIDO espejar \"para que quede bonito\".\n" +
  "- doNotInvent DEBE incluir: \"mirrored laterality\", \"contralateral side swap\", \"patient-right drawn on viewer-right in AP\".";

function classifyViewOrientation(view?: string): "anterior" | "posterior" | "other" {
  const v = String(view || "").toLowerCase();
  if (/posterior|dorsal|espalda|back view|from behind|viewed from behind/.test(v)) return "posterior";
  if (/ap\b|pa\b|coronal|anterior|frontal|frente|palmar|ventral|face[- ]?on|facing/.test(v)) return "anterior";
  // Atlas / Focal clinical default is AP-like (patient facing observer).
  return "anterior";
}

/** Explicit screen placement constraint for image prompts. */
function buildScreenLateralityConstraint(laterality?: string, view?: string): string {
  const lat = String(laterality || "").toLowerCase();
  const orient = classifyViewOrientation(view);
  const isBilateral = /bilateral|ambos|both/.test(lat);
  const isRight =
    (/derech|right|\bdcha\b/.test(lat) || /\bright\b/.test(lat)) &&
    !/izquier|left|bilateral|ambos/.test(lat);
  const isLeft =
    (/izquier|left|\bizq\b/.test(lat) || /\bleft\b/.test(lat)) &&
    !/derech|right|bilateral|ambos/.test(lat);

  if (isBilateral) {
    return (
      "SCREEN MAP (AP radiographic): patient's RIGHT half of anatomy on VIEWER'S LEFT of frame; " +
      "patient's LEFT half on VIEWER'S RIGHT. Never swap halves."
    );
  }

  if (orient === "posterior") {
    if (isRight) {
      return "SCREEN MAP (posterior/dorsal): PATIENT'S RIGHT pathology MUST be on VIEWER'S RIGHT of the frame. Do NOT apply AP mirroring.";
    }
    if (isLeft) {
      return "SCREEN MAP (posterior/dorsal): PATIENT'S LEFT pathology MUST be on VIEWER'S LEFT of the frame. Do NOT apply AP mirroring.";
    }
    return "SCREEN MAP (posterior/dorsal): patient right→viewer right; patient left→viewer left.";
  }

  if (isRight) {
    return (
      "SCREEN MAP (AP / patient facing camera, like radiografía AP): PATIENT'S RIGHT pathology MUST be drawn on the VIEWER'S LEFT side of the frame. " +
      "Patient's left anatomy stays on viewer-right. Drawing patient's right on viewer-right is a CRITICAL FAIL."
    );
  }
  if (isLeft) {
    return (
      "SCREEN MAP (AP / patient facing camera, like radiografía AP): PATIENT'S LEFT pathology MUST be drawn on the VIEWER'S RIGHT side of the frame. " +
      "Patient's right anatomy stays on viewer-left. Drawing patient's left on viewer-left is a CRITICAL FAIL."
    );
  }
  return (
    "SCREEN MAP (AP default): patient's anatomical RIGHT = VIEWER'S LEFT of frame; " +
    "patient's anatomical LEFT = VIEWER'S RIGHT of frame (radiografía AP convention)."
  );
}


/** Detect breast / mama context from free text. */
function isBreastContext(...parts: Array<string | undefined | null>): boolean {
  const t = parts.map((p) => String(p || "").toLowerCase()).join(" ");
  return /mama|mamari|breast|mamograf|birads|bi-rads|cuadrante|csi|cse|cii|cie|axila mam/.test(t);
}

/** Extract clock-face hour (1-12) from Spanish/English report phrasing. */
function extractBreastClockHour(...parts: Array<string | undefined | null>): number | null {
  const t = parts.map((p) => String(p || "")).join(" ");
  const patterns = [
    /\b(?:eje|hora|hours?|o['’]?clock|h)\s*[:\-]?\s*(1[0-2]|[1-9])\b/i,
    /\b(1[0-2]|[1-9])\s*(?:h|hrs?|horas?|o['’]?clock)\b/i,
    /\bradio\s*(1[0-2]|[1-9])\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) return n;
    }
  }
  return null;
}

/**
 * Breast clock-face + laterality rules (AP / patient facing examiner).
 * RIGHT breast: 3 = LATERAL (axilla), 9 = MEDIAL (sternum).
 * LEFT breast: 3 = MEDIAL (sternum), 9 = LATERAL (axilla).
 * Never swap 3↔9 (classic laterality mirror error).
 */
function buildBreastClockConstraint(opts: {
  laterality?: string;
  view?: string;
  pathologySite?: string;
  anatomicalFocus?: string;
  studyRegion?: string;
  panelTitle?: string;
}): string {
  if (!isBreastContext(opts.laterality, opts.pathologySite, opts.anatomicalFocus, opts.studyRegion, opts.panelTitle)) {
    return "";
  }

  const lat = String(opts.laterality || opts.pathologySite || opts.anatomicalFocus || "").toLowerCase();
  const isRight =
    (/mama\s*derech|breast\s*right|right\s*breast|derech/.test(lat) || /\bright\b/.test(lat)) &&
    !/izquier|left|bilateral|ambos/.test(lat);
  const isLeft =
    (/mama\s*izquier|breast\s*left|left\s*breast|izquier/.test(lat) || /\bleft\b/.test(lat)) &&
    !/derech|right|bilateral|ambos/.test(lat);

  const hour = extractBreastClockHour(opts.pathologySite, opts.anatomicalFocus, opts.panelTitle, opts.studyRegion);

  const common =
    "BREAST CLOCK-FACE HARD RULES (AP / patient facing examiner — never violate): " +
    "(B0) Clock positions are clinical breast-clock, NOT a mirrored UI decoration. " +
    "(B1) 12 o'clock = SUPERIOR (cephalad); 6 o'clock = INFERIOR (caudal). " +
    "(B2) NEVER swap 3 o'clock with 9 o'clock. Confusing eje/hora 3 with 9 is a CRITICAL LATERALITY FAIL. " +
    "(B3) Quadrants: CSE/UO = upper OUTER (lateral); CSI/UI = upper INNER (medial); " +
    "CIE/LO = lower OUTER; CII/LI = lower INNER. Do NOT swap outer↔inner. ";

  let sideRules = "";
  if (isRight) {
    sideRules =
      "RIGHT BREAST (patient's right; in AP appears on VIEWER'S LEFT of a bilateral figure): " +
      "3 o'clock = LATERAL / axilla / OUTER (VIEWER'S LEFT of the nipple); " +
      "9 o'clock = MEDIAL / sternum / INNER (VIEWER'S RIGHT of the nipple). " +
      "CSE (upper outer) sits toward the axillary/lateral side (near 12→3). " +
      "CSI (upper inner) sits toward the sternal/medial side (near 9→12). " +
      "imageLeftStructure should anchor LATERAL/axillary landmarks; imageRightStructure should anchor MEDIAL/sternal landmarks. ";
  } else if (isLeft) {
    sideRules =
      "LEFT BREAST (patient's left; in AP appears on VIEWER'S RIGHT of a bilateral figure): " +
      "3 o'clock = MEDIAL / sternum / INNER (VIEWER'S LEFT of the nipple); " +
      "9 o'clock = LATERAL / axilla / OUTER (VIEWER'S RIGHT of the nipple). " +
      "CSE (upper outer) sits toward the axillary/lateral side (near 9→12). " +
      "CSI (upper inner) sits toward the sternal/medial side (near 12→3). " +
      "imageLeftStructure should anchor MEDIAL/sternal landmarks; imageRightStructure should anchor LATERAL/axillary landmarks. ";
  } else {
    sideRules =
      "If side is unknown, still obey: RIGHT breast 3=LATERAL / 9=MEDIAL; LEFT breast 3=MEDIAL / 9=LATERAL. Never mirror. ";
  }

  let hourRule = "";
  if (hour != null) {
    if (isRight) {
      if (hour === 3) {
        hourRule = `MANDATORY TARGET CLOCK: ${hour} o'clock on RIGHT breast = LATERAL/axillary side of the nipple (VIEWER'S LEFT of nipple). Do NOT place at 9. `;
      } else if (hour === 9) {
        hourRule = `MANDATORY TARGET CLOCK: ${hour} o'clock on RIGHT breast = MEDIAL/sternal side of the nipple (VIEWER'S RIGHT of nipple). Do NOT place at 3. `;
      } else {
        hourRule = `MANDATORY TARGET CLOCK: place the lesion at ${hour} o'clock on the RIGHT breast using the RIGHT-breast map (3=lateral/viewer-left of nipple; 9=medial/viewer-right of nipple). `;
      }
    } else if (isLeft) {
      if (hour === 3) {
        hourRule = `MANDATORY TARGET CLOCK: ${hour} o'clock on LEFT breast = MEDIAL/sternal side of the nipple (VIEWER'S LEFT of nipple). Do NOT place at 9. `;
      } else if (hour === 9) {
        hourRule = `MANDATORY TARGET CLOCK: ${hour} o'clock on LEFT breast = LATERAL/axillary side of the nipple (VIEWER'S RIGHT of nipple). Do NOT place at 3. `;
      } else {
        hourRule = `MANDATORY TARGET CLOCK: place the lesion at ${hour} o'clock on the LEFT breast using the LEFT-breast map (3=medial/viewer-left of nipple; 9=lateral/viewer-right of nipple). `;
      }
    } else {
      hourRule = `MANDATORY TARGET CLOCK: lesion at ${hour} o'clock — apply the correct side map; never swap 3↔9. `;
    }
  }

  return common + sideRules + hourRule;
}

const BREAST_CLOCK_PLAN_RULES_ES =
  "REGLAS DE RELOJ / EJES EN MAMA (AP, paciente de frente al examinador):\n" +
  "- Mama DERECHA: 12 superior; 3 = LATERAL/axila (exterior); 6 inferior; 9 = MEDIAL/esternón (interior).\n" +
  "- Mama IZQUIERDA: 12 superior; 3 = MEDIAL/esternón (interior); 6 inferior; 9 = LATERAL/axila (exterior).\n" +
  "- NUNCA intercambiar eje/hora 3 con 9 (error clásico de espejo). CSE≠CSI; externo≠interno.\n" +
  "- En el contrato espacial AP de mama derecha: izquierda del cuadro = lateral/axila; derecha del cuadro = medial/esternón.\n" +
  "- En mama izquierda AP: izquierda del cuadro = medial/esternón; derecha del cuadro = lateral/axila.\n" +
  "- pathologySite debe incluir lado + eje/hora o cuadrante exactos del informe.\n" +
  "- doNotInvent DEBE incluir: \"clock 3/9 swap\", \"CSE/CSI swap\", \"outer/inner quadrant swap\".";

function reinforceLateralityCorrection(
  surgicalCorrection: string,
  laterality?: string,
  view?: string,
  lateralityFailed?: boolean,
  extraContext?: string
): string {
  const base = String(surgicalCorrection || "").trim() ||
    "Fix laterality landmarks and depict only reported pathology.";
  const clockFail = /clock|eje|hora|cse|csi|3\/9|9\/3|cuadrante|breast|mama/i.test(
    base + " " + String(extraContext || "")
  );
  if (!lateralityFailed && !clockFail && !/lateral|lado|right|left|derech|izquier|mirror|espej/i.test(base)) {
    return base;
  }
  const screen = buildScreenLateralityConstraint(laterality, view);
  const breast = buildBreastClockConstraint({
    laterality,
    view,
    pathologySite: extraContext,
    anatomicalFocus: base,
  });
  if (base.toLowerCase().includes("screen map") && (!breast || base.toLowerCase().includes("breast clock"))) {
    return base;
  }
  return [screen, breast, base].filter(Boolean).join(" ");
}


function normalizeSpatialContract(raw: any, fallbackLaterality?: string): SpatialContract {
  const landmarks = Array.isArray(raw?.mustShowLandmarks)
    ? raw.mustShowLandmarks.map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6)
    : [];
  const doNotInvent = Array.isArray(raw?.doNotInvent)
    ? raw.doNotInvent.map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6)
    : [];
  const lateralityGuards = [
    "mirrored laterality",
    "contralateral side swap",
    "patient-right drawn on viewer-right in AP",
    "patient-left drawn on viewer-left in AP",
    "clock 3/9 swap",
    "CSE/CSI swap",
    "outer/inner quadrant swap"
  ];
  for (const g of lateralityGuards) {
    if (!doNotInvent.some((x) => x.toLowerCase().includes(g.toLowerCase()))) {
      doNotInvent.push(g);
    }
  }
  return {
    view: raw?.view ? String(raw.view) : "AP / coronal clinical view",
    laterality: raw?.laterality ? String(raw.laterality) : (fallbackLaterality || ""),
    imageLeftStructure: raw?.imageLeftStructure ? String(raw.imageLeftStructure) : "",
    imageRightStructure: raw?.imageRightStructure ? String(raw.imageRightStructure) : "",
    superiorStructure: raw?.superiorStructure ? String(raw.superiorStructure) : "",
    inferiorStructure: raw?.inferiorStructure ? String(raw.inferiorStructure) : "",
    mustShowLandmarks: landmarks,
    pathologySite: raw?.pathologySite ? String(raw.pathologySite) : "",
    pathologyAppearance: raw?.pathologyAppearance ? String(raw.pathologyAppearance) : "",
    doNotInvent: doNotInvent.slice(0, 10)
  };
}

function buildImagePromptFromContract(args: {
  panelTitle: string;
  anatomicalFocus: string;
  studyRegion: string;
  contract: SpatialContract;
  customDirectives?: string;
  forcedLaterality?: string;
  surgicalCorrection?: string;
}): string {
  const c = args.contract;
  const laterality = (args.forcedLaterality && args.forcedLaterality !== "auto"
    ? args.forcedLaterality
    : c.laterality) || "as in report";
  const landmarks = (c.mustShowLandmarks || []).length
    ? c.mustShowLandmarks!.join(", ")
    : "key osseous and soft-tissue landmarks for orientation";
  const left = c.imageLeftStructure || "anatomically correct left-of-frame structure";
  const right = c.imageRightStructure || "anatomically correct right-of-frame structure";
  const patho = c.pathologySite
    ? `Show ONLY the reported finding at: ${c.pathologySite}. Appearance: ${c.pathologyAppearance || args.anatomicalFocus}.`
    : `If a finding is described, depict it faithfully at the reported site; otherwise show normal anatomy.`;
  const forbid = (c.doNotInvent || []).length
    ? `Do NOT invent: ${c.doNotInvent!.join("; ")}.`
    : "Do NOT invent pathology not present in the report.";

  const breastClock = buildBreastClockConstraint({
    laterality,
    view: c.view,
    pathologySite: c.pathologySite,
    anatomicalFocus: args.anatomicalFocus,
    studyRegion: args.studyRegion,
    panelTitle: args.panelTitle,
  });

  const parts = [
    FAITHFUL_STYLE,
    LATERALITY_HARD_RULES,
    buildScreenLateralityConstraint(laterality, c.view),
    breastClock,
    `Subject: ${args.studyRegion}. Panel: ${args.panelTitle}.`,
    `Focus: ${args.anatomicalFocus}.`,
    `Camera/view: ${c.view || "AP / coronal clinical view (patient facing observer)"}.`,
    `Patient laterality (anatomical side of the PATIENT, not the viewer): ${laterality}.`,
    `SPATIAL CANVAS CONTRACT (mandatory, viewer-left / viewer-right): LEFT OF FRAME = ${left}; RIGHT OF FRAME = ${right}.`,
    c.superiorStructure ? `SUPERIOR = ${c.superiorStructure}.` : "",
    c.inferiorStructure ? `INFERIOR = ${c.inferiorStructure}.` : "",
    `Must-show landmarks: ${landmarks}.`,
    patho,
    forbid,
    "Preserve true anatomical relationships and scale; never mirror anatomy to make the image prettier.",
    "Visual beauty is secondary: never invent structures, never move pathology, never break laterality or the spatial contract for aesthetics.",
    args.customDirectives ? `[MANDATORY CLINICAL DIRECTIVE: ${args.customDirectives}]` : "",
    args.surgicalCorrection ? `[MANDATORY SURGICAL CORRECTION: ${args.surgicalCorrection}]` : ""
  ].filter(Boolean);

  return parts.join(" ");
}

function stripDataUrl(imageUrl: string): { mime: string; data: string } | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const m = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}


export function registerAtlas3DRoutes(app: express.Express) {
  // Helper to generate a medical image using gemini-3.1-flash-image-preview or imagen-3.0
  async function generateMedicalImage(ai: any, prompt: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: prompt,
        config: {
          imageConfig: { aspectRatio: "4:3", imageSize: "2K" }
        }
      });

      let base64Image = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Image) {
        throw new Error("No inlineData image returned from gemini-3.1-flash-image-preview");
      }
      return `data:image/jpeg;base64,${base64Image}`;
    } catch (err: any) {
      console.warn("Error con gemini-3.1-flash-image-preview en generateMedicalImage, reintentando con fallback:", err?.message || err);
      // Fallback
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "4:3"
        }
      });
      const b64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (!b64) throw new Error("Fallback imagen-3.0 no devolvió imagen.");
      return `data:image/jpeg;base64,${b64}`;
    }
  }

  // 1. Full 3D Atlas Generation (2 to 3 panels + Synoptic Correlation + Biomechanical Synthesis)
  app.post("/api/generate-3d-atlas", async (req: express.Request, res: express.Response) => {
    try {
      const { reportText, organOrStudy, laterality, requestedModel, customDirectives, panelAssignments } = req.body;

      if (!reportText || !reportText.trim()) {
        return res.status(400).json({ success: false, error: "Se requiere el texto del informe radiológico." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");
      const assignments: any[] = Array.isArray(panelAssignments) ? panelAssignments : [];
      const assignmentPlanText = assignments.length
        ? assignments
            .map((a: any) => {
              const letter = String(a.panelLetter || "").toUpperCase();
              const structure = a.structure || a.label || "";
              const mode = a.mode || "dedicated";
              return [
                `PANEL ${letter} [${mode}] → «${structure}»`,
                `  Criterio: ${a.label || structure}`,
                a.value ? `  Valor: ${a.value}` : null,
                `  Evidencia: ${a.evidence || "n/d"}`,
                `  pathologySite DEBE ser: ${structure}`,
                a.directive ? `  Directiva acotada:\n${a.directive}` : null,
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "";

      const modeHint = !assignments.length
        ? "Sin asignación Scorecard por panel: diseña 2–3 paneles complementarios según el informe."
        : assignments[0]?.mode === "shared_single"
          ? "MODO 1 HALLAZGO: genera 2 o 3 paneles como vistas complementarias del MISMO hallazgo asignado (distinto ángulo/cutaway; misma lesión)."
          : `MODO ${assignments.length} HALLAZGOS: genera exactamente ${assignments.length} paneles, UNO por hallazgo asignado. Cada panel dedicado a su hallazgo (no mezclar focos).`;

      const promptPlan = `Eres un Médico Radiólogo Especialista en Diagnóstico por Imágenes y Anatomía Quirúrgica Aplicada.
Tu objetivo es planificar un ATLAS 3D con MÁXIMA FIDELIDAD anatómica y patológica al informe (no arte ornamental).

========================================================================
INFORMACIÓN DEL ESTUDIO:
========================================================================
- Región / Protocolo: "${organOrStudy || "Estudio General"}"
- Lateralidad Solicitada/Forzada: "${laterality || "Detectar del texto"}"
- Directiva clínica adicional (médico): "${customDirectives || "Ninguna"}"
- ${modeHint}
${assignmentPlanText ? `\nASIGNACIÓN OBLIGATORIA SCORECARD → PANELES:\n${assignmentPlanText}\n` : ""}
- INFORME RADIOLÓGICO:
"""
${reportText}
"""

========================================================================
TAREA:
========================================================================
1. Identifica región y lateralidad exactas.
2. Diseña paneles según la asignación Scorecard (si existe). Si hay 1 hallazgo → 2–3 vistas del mismo; si 2 → 2 paneles (1 cada uno); si 3 → 3 paneles (1 cada uno).
3. Para CADA panel define un CONTRATO ESPACIAL (spatialContract) obligatorio:
   - view (AP/coronal/sagittal/axial/oblique)
   - laterality
   - imageLeftStructure / imageRightStructure (qué debe verse a la IZQUIERDA y DERECHA del cuadro)
   - superiorStructure / inferiorStructure si aplica
   - mustShowLandmarks[] (hitos óseos/blandos de orientación)
   - pathologySite + pathologyAppearance (DEBE coincidir con el hallazgo asignado al panel si hay asignación)
   - doNotInvent[] (errores típicos a evitar, p.ej. invertir medial/lateral)
3b. ${LATERALITY_PLAN_RULES_ES}
3b2. ${BREAST_CLOCK_PLAN_RULES_ES}
3c. Si hay asignación por panel: anatomicalFocus y pathologySite deben nombrar EXPLÍCITAMENTE el hallazgo de ese panel. PROHIBIDO que un panel dedicado dibuje el hallazgo de otro panel como foco.
4. "structure" en synopticExplanation = NOMBRE CORTO de estructura (NO el pie "Foco: ...").
5. NO inventes lesiones. Si el informe es normal, paneles de anatomía preservada.
6. Estilo deseado: fotorrealismo clínico de alta calidad (textura tisular rica, iluminación de estudio suave); SIN bioluminiscencia ni glow ornamental. La fidelidad anatómica/patológica manda sobre el efecto visual.

RESPONDE SOLO JSON VÁLIDO:
{
  "studyRegion": "string",
  "figureTitle": "FIGURA 1. ...",
  "detectedLaterality": "Izquierda|Derecha|Bilateral|Línea media",
  "panels": [
    {
      "panelLetter": "A",
      "panelTitle": "Título corto",
      "anatomicalFocus": "Foco: hallazgo en 1 línea",
      "laterality": "Izquierda|Derecha",
      "spatialContract": {
        "view": "string",
        "laterality": "string",
        "imageLeftStructure": "string",
        "imageRightStructure": "string",
        "superiorStructure": "string",
        "inferiorStructure": "string",
        "mustShowLandmarks": ["string"],
        "pathologySite": "string",
        "pathologyAppearance": "string",
        "doNotInvent": ["string"]
      }
    }
  ],
  "synopticExplanation": [
    { "structure": "Nombre corto de estructura", "panelRef": "(Panel A)", "findingDetail": "Correlación fiel al informe..." }
  ],
  "biomechanicalSynthesis": "2-3 líneas de síntesis funcional/diagnóstica fiel al informe"
}`;

      const planResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: promptPlan }],
        config: { responseMimeType: "application/json" }
      });

      let planJson: any = {};
      try {
        planJson = JSON.parse(planResponse.text || "{}");
      } catch (parseErr) {
        console.error("Error parseando plan JSON de Atlas 3D:", parseErr);
        planJson = {
          studyRegion: organOrStudy || "Región Anatómica Evaluada",
          figureTitle: `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN DE ${organOrStudy?.toUpperCase() || "HALLAZGOS"}`,
          detectedLaterality: laterality || "No especificada",
          panels: [
            {
              panelLetter: "A",
              panelTitle: "Reconstrucción Volumétrica Principal",
              anatomicalFocus: "Foco: Hallazgo anatómico correlacionado",
              laterality: laterality || "No especificada",
              spatialContract: {
                view: "coronal/AP",
                laterality: laterality || "",
                imageLeftStructure: "anatomically correct left side",
                imageRightStructure: "anatomically correct right side",
                mustShowLandmarks: [],
                pathologySite: "",
                pathologyAppearance: "",
                doNotInvent: ["mirrored laterality", "invented tears"]
              }
            },
            {
              panelLetter: "B",
              panelTitle: "Perspectiva Regional y Relación Tisular",
              anatomicalFocus: "Foco: Relación topográfica y estructuras adyacentes",
              laterality: laterality || "No especificada",
              spatialContract: {
                view: "sagittal/oblique",
                laterality: laterality || "",
                imageLeftStructure: "anatomically correct left side",
                imageRightStructure: "anatomically correct right side",
                mustShowLandmarks: [],
                pathologySite: "",
                pathologyAppearance: "",
                doNotInvent: ["invented masses"]
              }
            }
          ],
          synopticExplanation: [
            { structure: "Estructura Principal", panelRef: "(Panel A)", findingDetail: "Correlación con los hallazgos del informe." },
            { structure: "Estructuras Vecinas", panelRef: "(Panel B)", findingDetail: "Relación tisular regional." }
          ],
          biomechanicalSynthesis: "La correlación volumétrica resume la localización y repercusión de los hallazgos del estudio."
        };
      }

      const forcedLaterality = laterality && laterality !== "auto" ? laterality : "";

      const resolveAssignment = (panel: any, idx: number) => {
        const letter = String(panel?.panelLetter || String.fromCharCode(65 + idx)).toUpperCase();
        return (
          assignments.find((a: any) => String(a.panelLetter || "").toUpperCase() === letter) ||
          assignments[idx] ||
          null
        );
      };

      // If dedicated multi-finding mode, keep panel count aligned to assignments
      if (assignments.length && assignments[0]?.mode === "dedicated") {
        const wanted = assignments.length;
        if (Array.isArray(planJson.panels) && planJson.panels.length > wanted) {
          planJson.panels = planJson.panels.slice(0, wanted);
        }
        // Ensure letters A.. match assignments
        planJson.panels = (planJson.panels || []).map((p: any, i: number) => ({
          ...p,
          panelLetter: assignments[i]?.panelLetter || p.panelLetter || String.fromCharCode(65 + i),
        }));
      }

      const buildPanelFromPlan = async (panel: any, idx: number, surgicalCorrection?: string) => {
        const assignment = resolveAssignment(panel, idx);
        let contract = normalizeSpatialContract(
          panel.spatialContract,
          panel.laterality || planJson.detectedLaterality || forcedLaterality
        );
        if (assignment?.structure) {
          contract = {
            ...contract,
            pathologySite: String(assignment.structure),
            pathologyAppearance:
              [assignment.value, assignment.evidence].filter(Boolean).join(" — ") ||
              contract.pathologyAppearance,
          };
        }
        const panelDirective = [assignment?.directive, customDirectives]
          .filter((x: any) => typeof x === "string" && x.trim())
          .join("\n\n");
        const focusFromAssignment = assignment?.structure
          ? `Foco: ${assignment.structure}${assignment.value ? ` (${assignment.value})` : ""}`
          : null;
        const promptToUse = buildImagePromptFromContract({
          panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
          anatomicalFocus:
            panel.anatomicalFocus || focusFromAssignment || "Foco anatómico correlacionado",
          studyRegion: planJson.studyRegion || organOrStudy || "anatomy",
          contract,
          customDirectives: panelDirective || undefined,
          forcedLaterality,
          surgicalCorrection
        });
        try {
          const imageUrl = await generateMedicalImage(ai, promptToUse);
          return {
            id: `panel-${idx}-${Date.now()}`,
            panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
            panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
            anatomicalFocus:
              panel.anatomicalFocus || focusFromAssignment || "Foco anatómico correlacionado",
            laterality: panel.laterality || planJson.detectedLaterality || laterality || "",
            spatialContract: contract,
            imageUrl,
            promptUsed: promptToUse,
            isCustomFlipped: false,
            assignedFindingId: assignment?.findingId || undefined,
            assignedFindingLabel: assignment?.structure || assignment?.label || undefined
          };
        } catch (imgErr) {
          console.error(`Error generando imagen para panel ${panel.panelLetter}:`, imgErr);
          return {
            id: `panel-${idx}-${Date.now()}`,
            panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
            panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
            anatomicalFocus:
              panel.anatomicalFocus || focusFromAssignment || "Foco anatómico correlacionado",
            laterality: panel.laterality || planJson.detectedLaterality || laterality || "",
            spatialContract: contract,
            imageUrl: "",
            promptUsed: promptToUse,
            isCustomFlipped: false,
            assignedFindingId: assignment?.findingId || undefined,
            assignedFindingLabel: assignment?.structure || assignment?.label || undefined
          };
        }
      };

      let panelsWithImages = await Promise.all(
        (planJson.panels || []).map((panel: any, idx: number) => buildPanelFromPlan(panel, idx))
      );

      // Vision verification pass: check anatomy/pathology fidelity and auto-correct once if needed
      let qualityAudit: any = { verified: false, panelNotes: [], synopticRewritten: false };
      try {
        const verifiable = panelsWithImages.filter((p: any) => p.imageUrl && stripDataUrl(p.imageUrl));
        if (verifiable.length > 0) {
          const verifyParts: any[] = [
            {
              text: `Eres un radiólogo revisor de calidad de atlas 3D.
Compara CADA imagen con el informe y el contrato espacial.
PRIORIDAD #1: LATERALIDAD CON CONVENCIÓN AP (paciente de frente / radiografía AP).
- "Derecha/Izquierda" = lado ANATÓMICO DEL PACIENTE, no el lado de la mano del observador.
- En vistas AP/coronal/anterior/frontal: el lado DERECHO del paciente debe verse a la IZQUIERDA del cuadro; el lado IZQUIERDO del paciente a la DERECHA del cuadro.
- Si el lado del paciente o imageLeft/imageRight del contrato no coinciden con lo visible (o se violó la convención AP) => lateralityOk=false y pass=false.
- MAMA / BREAST CLOCK: mama derecha → 3=LATERAL/axila, 9=MEDIAL/esternón; mama izquierda → 3=MEDIAL/esternón, 9=LATERAL/axila. Si confunde eje 3 con 9 o CSE con CSI => lateralityOk=false y pass=false.
- En surgicalCorrection (inglés) indica explícitamente viewer-left / viewer-right y, si aplica, el clock-hour correcto (3≠9).
Devuelve JSON:
{
  "panels": [
    {
      "panelLetter": "A",
      "pass": true/false,
      "lateralityOk": true/false,
      "pathologyOk": true/false,
      "landmarksOk": true/false,
      "issues": ["..."],
      "surgicalCorrection": "instrucción EN INGLÉS para regenerar si pass=false, vacía si pass=true"
    }
  ],
  "synopticExplanation": [
    { "structure": "nombre corto", "panelRef": "(Panel A)", "findingDetail": "texto fiel al informe y a lo visible" }
  ],
  "biomechanicalSynthesis": "síntesis breve fiel"
}
Reglas: structure corto (sin 'Foco:'); no inventes hallazgos; si la imagen falla lateralidad/hallazgo, pass=false y da surgicalCorrection concreta.
INFORME:
"""
${reportText}
"""
PLAN/CONTRATOS:
${JSON.stringify((planJson.panels || []).map((p: any, i: number) => ({
  panelLetter: panelsWithImages[i]?.panelLetter || p.panelLetter,
  panelTitle: p.panelTitle,
  anatomicalFocus: p.anatomicalFocus,
  spatialContract: panelsWithImages[i]?.spatialContract || p.spatialContract
})), null, 2)}
SYNOPTIC ACTUAL:
${JSON.stringify(planJson.synopticExplanation || [], null, 2)}
`
            }
          ];
          for (const p of verifiable) {
            const parsedImg = stripDataUrl(p.imageUrl);
            if (!parsedImg) continue;
            verifyParts.push({ text: `PANEL ${p.panelLetter} — ${p.panelTitle}` });
            verifyParts.push({ inlineData: { mimeType: parsedImg.mime, data: parsedImg.data } });
          }

          const verifyResp = await ai.models.generateContent({
            model,
            contents: { parts: verifyParts },
            config: { responseMimeType: "application/json" }
          });

          let verifyJson: any = {};
          try {
            verifyJson = JSON.parse(verifyResp.text || "{}");
          } catch {
            verifyJson = {};
          }

          qualityAudit.verified = true;
          qualityAudit.panelNotes = Array.isArray(verifyJson.panels) ? verifyJson.panels : [];

          // Auto-regenerate failing panels once
          if (Array.isArray(verifyJson.panels)) {
            const regenJobs: Promise<any>[] = [];
            for (const note of verifyJson.panels) {
              if (note?.pass !== false) continue;
              const letter = String(note.panelLetter || "").toUpperCase();
              const idx = panelsWithImages.findIndex((p: any) => String(p.panelLetter).toUpperCase() === letter);
              if (idx < 0) continue;
              const originalPlan = (planJson.panels || [])[idx] || panelsWithImages[idx];
              const contract = panelsWithImages[idx]?.spatialContract || originalPlan?.spatialContract || {};
              const latFail = note?.lateralityOk !== true;
              const correction = reinforceLateralityCorrection(
                String(note.surgicalCorrection || "Fix laterality landmarks and depict only reported pathology."),
                contract.laterality || panelsWithImages[idx]?.laterality || planJson.detectedLaterality || laterality,
                contract.view,
                latFail
              );
              regenJobs.push(
                buildPanelFromPlan(originalPlan, idx, correction).then((newPanel) => ({ idx, newPanel, note }))
              );
            }
            const regenResults = await Promise.all(regenJobs);
            for (const r of regenResults) {
              panelsWithImages[r.idx] = {
                ...r.newPanel,
                qualityFlags: {
                  regenerated: true,
                  issues: r.note.issues || [],
                  lateralityOk: false,
                  pathologyOk: false
                }
              };
            }
          }

          if (Array.isArray(verifyJson.synopticExplanation) && verifyJson.synopticExplanation.length) {
            planJson.synopticExplanation = verifyJson.synopticExplanation.map((row: any) => ({
              structure: String(row.structure || "").replace(/^foco\s*:\s*/i, "").trim() || "Estructura",
              panelRef: row.panelRef || "(Panel A)",
              findingDetail: String(row.findingDetail || "").trim()
            }));
            qualityAudit.synopticRewritten = true;
          }
          if (typeof verifyJson.biomechanicalSynthesis === "string" && verifyJson.biomechanicalSynthesis.trim()) {
            planJson.biomechanicalSynthesis = verifyJson.biomechanicalSynthesis.trim();
          }
        }
      } catch (verifyErr: any) {
        console.warn("Verificación visual Atlas 3D omitida/fallida:", verifyErr?.message || verifyErr);
        qualityAudit.error = String(verifyErr?.message || verifyErr);
      }

      const finalAtlasData = {
        studyRegion: planJson.studyRegion || organOrStudy || "Estudio Actual",
        figureTitle: planJson.figureTitle || `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN DE ${organOrStudy?.toUpperCase() || "HALLAZGOS"}`,
        detectedLaterality: planJson.detectedLaterality || laterality || "",
        panels: panelsWithImages,
        synopticExplanation: planJson.synopticExplanation || [],
        synopticTable: planJson.synopticExplanation || [],
        biomechanicalSynthesis: planJson.biomechanicalSynthesis || "",
        synthesis: planJson.biomechanicalSynthesis || "",
        qualityAudit,
        panelFindingAssignments: assignments.length ? assignments : undefined
      };

      res.json({
        success: true,
        data: finalAtlasData
      });

    } catch (error: any) {
      console.error("Error en /api/generate-3d-atlas:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  // 2. Single Panel Regeneration with spatial contract + faithful clinical style
  app.post("/api/regenerate-3d-panel", async (req: express.Request, res: express.Response) => {
    try {
      const {
        reportText,
        studyRegion,
        panel,
        laterality,
        userDirective,
        requestedModel,
        customDirectives,
        panelAssignment
      } = req.body;

      if (!panel) {
        return res.status(400).json({ success: false, error: "Se requiere el objeto de panel a regenerar." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");
      const forcedLaterality = laterality && laterality !== "auto" ? laterality : "";
      const fullReport = typeof reportText === "string" ? reportText : "";
      const scopedDirective = [
        panelAssignment?.directive,
        customDirectives
      ]
        .filter((x: any) => typeof x === "string" && String(x).trim())
        .join("\n\n");
      const lockedFinding =
        panelAssignment?.structure ||
        panel.assignedFindingLabel ||
        "";

      const refinementPrompt = `Eres un Radiólogo y Anatomista Quirúrgico. Refina el CONTRATO ESPACIAL para regenerar el PANEL ${panel.panelLetter || "A"} con máxima fidelidad al informe (fotorrealismo clínico de alta calidad: textura e iluminación premium, sin arte bioluminiscente).

DATOS DEL CASO:
- Región: "${studyRegion || "Anatomía médica"}"
- Título actual: "${panel.panelTitle || ""}"
- Foco actual: "${panel.anatomicalFocus || ""}"
- Lateralidad requerida: "${forcedLaterality || panel.laterality || ""}"
- Contrato espacial previo: ${JSON.stringify(panel.spatialContract || {})}
- Hallazgo BLOQUEADO para este panel (Scorecard): "${lockedFinding || "Ninguno"}"
- Directiva clínica ACOTADA a este panel: "${scopedDirective || "Ninguna"}"
- Corrección quirúrgica del médico: "${userDirective || "Mejorar precisión anatómica y patológica"}"
- INFORME COMPLETO:
"""
${fullReport}
"""

REGLA: Si hay hallazgo bloqueado, pathologySite/pathologyAppearance DEBEN describirlo. No cambies el foco a otra lesión del scorecard.

RESPONDE SOLO JSON:
{
  "panelTitle": "string",
  "anatomicalFocus": "Foco: 1 línea fiel al informe",
  "spatialContract": {
    "view": "string",
    "laterality": "string",
    "imageLeftStructure": "string",
    "imageRightStructure": "string",
    "superiorStructure": "string",
    "inferiorStructure": "string",
    "mustShowLandmarks": ["string"],
    "pathologySite": "string",
    "pathologyAppearance": "string",
    "doNotInvent": ["string"]
  }
}`;

      const refineResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: refinementPrompt }],
        config: { responseMimeType: "application/json" }
      });

      let refineJson: any = {};
      try {
        refineJson = JSON.parse(refineResponse.text || "{}");
      } catch (e) {
        refineJson = {
          panelTitle: panel.panelTitle,
          anatomicalFocus: panel.anatomicalFocus,
          spatialContract: panel.spatialContract || {}
        };
      }

      const contract = normalizeSpatialContract(
        refineJson.spatialContract || panel.spatialContract,
        forcedLaterality || panel.laterality
      );
      if (lockedFinding) {
        contract.pathologySite = lockedFinding;
        if (panelAssignment?.evidence || panelAssignment?.value) {
          contract.pathologyAppearance = [panelAssignment.value, panelAssignment.evidence]
            .filter(Boolean)
            .join(" — ") || contract.pathologyAppearance;
        }
      }

      const finalPrompt = buildImagePromptFromContract({
        panelTitle: refineJson.panelTitle || panel.panelTitle || `Panel ${panel.panelLetter || ""}`,
        anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus || "Foco anatómico correlacionado",
        studyRegion: studyRegion || "anatomy",
        contract,
        customDirectives: scopedDirective || undefined,
        forcedLaterality,
        surgicalCorrection: userDirective
      });

      const imageUrl = await generateMedicalImage(ai, finalPrompt);

      const updatedPanel = {
        ...panel,
        panelTitle: refineJson.panelTitle || panel.panelTitle,
        anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus,
        laterality: forcedLaterality || panel.laterality,
        spatialContract: contract,
        imageUrl: imageUrl,
        promptUsed: finalPrompt,
        isCustomFlipped: false,
        qualityFlags: undefined,
        assignedFindingId: panelAssignment?.findingId || panel.assignedFindingId,
        assignedFindingLabel:
          panelAssignment?.structure ||
          panelAssignment?.label ||
          panel.assignedFindingLabel,
      };

      res.json({
        success: true,
        panel: updatedPanel
      });

    } catch (error: any) {
      console.error("Error en /api/regenerate-3d-panel:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  // 3. FULL 3D VASCULAR SUITE GENERATION (2 to 3 panels + Tailored Hemodynamic Table + Morphological Synthesis)
  app.post("/api/generate-3d-vascular", async (req: express.Request, res: express.Response) => {
    try {
      const { reportText, vascularType, laterality, requestedModel, customDirectives } = req.body;

      if (!reportText || !reportText.trim()) {
        return res.status(400).json({ success: false, error: "Se requiere el texto del informe Doppler vascular." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");

      const vascularPrompt = `Eres un Cirujano Vascular, Médico Especialista en Ecografía Doppler Vascular de Alta Resolución y Director de Arte Médico 3D.
Tu misión es analizar el informe Doppler ecográfico adjunto para estructurar la "SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO" con máxima fidelidad anatomopatológica y hemodinámica.

========================================================================
INFORMACIÓN DEL ESTUDIO VASCULAR:
========================================================================
- Tipo de Estudio Sugerido / Seleccionado: "${vascularType || "Detectar automáticamente del informe"}"
- Lateralidad Solicitada: "${laterality || "Detectar del informe"}"
- DIRECTIVA CLÍNICA OBLIGATORIA (Scorecard vascular / médico — MANDATORY, no omitir): "${customDirectives || "Ninguna"}"
IMPORTANTE: Si hay directiva clínica, DEBE gobernar la anatomía 3D, la morfología de placa/trombo, el grado de estenosis, la lateralidad y la tabla hemodinámica. No inventes lesiones ni grados ausentes en la directiva/informe.
- INFORME DOPPLER VASCULAR:
"""
${reportText}
"""

========================================================================
REGLA DE SCORECARD / DIRECTIVA OBLIGATORIA:
========================================================================
Si "DIRECTIVA CLÍNICA OBLIGATORIA" no es "Ninguna", trátela como contrato clínico vinculante:
- Los paneles 3D y la tabla hemodinámica DEBEN reflejar esos hallazgos (estenosis, placa/trombo, flujo, índices, lado).
- Prohibido inventar lesiones o grados no respaldados por la directiva o el informe.

========================================================================
DIRECTIVAS CLÍNICAS Y TIPOS DE ESTUDIO:
========================================================================
Clasifica el estudio en uno de los 5 tipos canónicos y genera la tabla hemodinámica correspondiente:
1. "carotideo_vertebral": Doppler Carotídeo y Vertebral (ACC, Bulbo, ACI proximal/media, ACE, Arteria Vertebral V1/V2 bilateral o unilateral).
   - Encabezados: VASO / SEGMENTO | PLACA / TROMBO | % ESTENOSIS | PATRÓN (PSV/EDV) | REL. ACC/ACI | IMPACTO HEMODIN.
2. "arterial_mmii": Doppler Arterial de Miembros Inferiores (AFC, AFP, AFS proximal/media/distal, A. Poplítea, ATA, ATP, A. Peronea, Pedial).
   - Encabezados: VASO / SEGMENTO | PLACA / MORFOLOGÍA | % ESTENOSIS | ONDA / PSV (cm/s) | REL. VELOCIDAD (VR) | IMPACTO HEMODIN.
3. "venoso_mmii": Doppler Venoso de Miembros Inferiores (VFC, VF, VFP, V. Poplítea, V. Tibiales, Safena Mayor, Safena Menor).
   - Encabezados: SEGMENTO VENOSO | COMPRESIBILIDAD / TROMBO | FLUJO ESPONTÁNEO / FÁSICO | MANIOBRA DE AUMENTO | REFLUJO / COMPETENCIA | ESTADO CLÍNICO
4. "arterias_renales": Doppler de Arterias Renales (Aorta Abdominal, A. Renal Principal Derecha/Izquierda ostium/cuerpo/hilio, Ramas Interlobares).
   - Encabezados: VASO / SEGMENTO EVALUADO | PLACA / HALLAZGO LUMINAL | PSV (cm/s) / EDV | ÍNDICE RENOAÓRTICO (RAR) | ÍNDICE DE RESISTIVIDAD (RI) | INTERPRETACIÓN
5. "aorto_iliaco": Doppler Aorto-Ilíaco (Aorta Suprarrenal, Infrarrenal, Bifurcación, A. Ilíaca Común Derecha/Izquierda, Ilíaca Externa/Interna).
   - Encabezados: SEGMENTO VASCULAR | PLACA / CALCIFICACIÓN / TROMBO | DIÁMETRO / ECTASIA / ANEURISMA | % ESTENOSIS | PSV (cm/s) / PATRÓN | IMPACTO HEMODIN.

========================================================================
DISEÑO DE PANELES 3D VASCULARES (Generar 2 o 3 Paneles):
========================================================================
- Panel A: Vaso o bifurcación principal con la lesión más significativa (ej: Bulbo Carotídeo con placa mixta Gray-Weale Tipo II y reducción luminal, o AFS con estenosis/oclusión, o Vaso con trombo endoluminal).
- Panel B: Vaso contralateral o segmento complementario (ej: Eje carotídeo contralateral o lecho distal).
- Panel C (opcional, si el estudio involucra patología bilateral compleja o tercer territorio crítico).
- LATERALIDAD OBLIGATORIA POR PANEL (convención radiografía AP / paciente de frente):
  - Cada panel DEBE declarar "laterality" exacta (Derecha|Izquierda|Bilateral|Línea media) = lado ANATÓMICO DEL PACIENTE.
  - Vista AP/frontal por defecto: lado DERECHO del paciente a la IZQUIERDA del cuadro; lado IZQUIERDO del paciente a la DERECHA del cuadro.
  - El imagePrompt DEBE empezar con el lado del paciente y anclas de pantalla (ej. "Patient RIGHT carotid bifurcation on VIEWER'S LEFT of frame (AP convention); viewer-right = contralateral/left side landmarks...").
  - NUNCA intercambiar lados entre paneles ni espejar por estética. Si hay contralateral sano, márcalo explícitamente como el lado opuesto correcto.
  - doNotInvent implícito: mirrored laterality, side swap, patient-right on viewer-right in AP, inventing contralateral disease.
- PROMPT EN INGLÉS para cada panel:
  "Ultra-realistic 3D medical macro vascular cross-section render of [PATIENT SIDE + detailed vessel name], exact wall layer cutaway, exact plaque/thrombus morphology (lipid core, fibrous cap, calcifications, ulceration, or clean healthy intima), intraluminal lumen opening with glowing chromatic laminar blood flow vectors, anatomical bone/soft tissue landmark background that locks laterality, cinema 4D octane render style, soft surgical studio lighting, clean background, strictly NO text, NO numbers, NO arrows, NO letters inside the image. Do NOT mirror anatomy."

========================================================================
SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:
========================================================================
Redacta un texto integrador de 3 a 5 líneas con las conclusiones del estudio, consensos (SRU/NASCET/Intersocietal), repercusión hemodinámica y permeabilidad.

RESPONDE ESTRICTAMENTE EN FORMATO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "studyTypeCategory": "carotideo_vertebral" | "arterial_mmii" | "venoso_mmii" | "arterias_renales" | "aorto_iliaco" | "general_vascular",
  "territoryLabel": "DOPPLER CAROTÍDEO Y VERTEBRAL" | "DOPPLER ARTERIAL DE MIEMBRO INFERIOR" | "DOPPLER VENOSO DE MIEMBRO INFERIOR" | "DOPPLER DE ARTERIAS RENALES" | "DOPPLER AORTO-ILÍACO",
  "laterality": "Bilateral" | "Derecha" | "Izquierda" | "Línea media",
  "figureTitle": "FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA [TERRITORIO]",
  "tableTitle": "TABLA HEMODINÁMICA Y CARACTERIZACIÓN DE LESIONES [TERRITORIO]:",
  "tableHeaders": {
    "col1": "VASO / SEGMENTO",
    "col2": "PLACA / TROMBO",
    "col3": "% ESTENOSIS",
    "col4": "PATRÓN (PSV/EDV)",
    "col5": "REL. ACC/ACI",
    "col6": "IMPACTO HEMODIN."
  },
  "panels": [
    {
      "panelLetter": "A",
      "panelTitle": "Panel A: Bifurcación Carotídea Derecha: Ateromatosis Mixta Tipo II (Bulbo y ACI Proximal)",
      "vesselName": "Bifurcación Carotídea Derecha",
      "anatomicalFocus": "Placas de ateroma Gray-Weale Tipo II en pared anterior de bulbo...",
      "laterality": "Derecha",
      "imagePrompt": "Ultra-realistic 3D medical macro vascular render..."
    },
    {
      "panelLetter": "B",
      "panelTitle": "Panel B: Arteria Carótida Común Izquierda: Engrosamiento Miointimal Difuso",
      "vesselName": "Arteria Carótida Común Izquierda",
      "anatomicalFocus": "Corte longitudinal macro del eje carotídeo común izquierdo...",
      "laterality": "Izquierda",
      "imagePrompt": "Ultra-realistic 3D medical macro vascular render..."
    }
  ],
  "hemodynamicTable": [
    {
      "vessel": "Arteria Carótida Común Derecha",
      "plaqueOrThrombus": "Sin placas",
      "stenosisPercent": "< 50%",
      "patternOrVelocity": "Flujo laminar de resistencia intermedia",
      "hemodynamicIndex": "N/A",
      "clinicalImpact": "Normal"
    }
  ],
  "synthesisTitle": "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:",
  "morphologicalSynthesis": "El estudio Doppler carotídeo y vertebral bilateral evidencia..."
}`;

      const planResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: vascularPrompt }],
        config: { responseMimeType: "application/json" }
      });

      let planJson: any = {};
      try {
        planJson = JSON.parse(planResponse.text || "{}");
      } catch (parseErr) {
        console.error("Error parseando plan JSON Vascular 3D:", parseErr);
        planJson = {
          studyTypeCategory: vascularType || "carotideo_vertebral",
          territoryLabel: "DOPPLER VASCULAR",
          laterality: laterality || "Bilateral",
          figureTitle: "FIGURA 1. ATLAS 3D DE CORRELACIÓN VASCULAR Y HEMODINÁMICA",
          tableTitle: "TABLA HEMODINÁMICA Y CARACTERIZACIÓN VASCULAR:",
          tableHeaders: {
            col1: "VASO / SEGMENTO",
            col2: "PLACA / TROMBO",
            col3: "% ESTENOSIS",
            col4: "PATRÓN (PSV/EDV)",
            col5: "REL. / ÍNDICE",
            col6: "IMPACTO HEMODIN."
          },
          panels: [
            {
              panelLetter: "A",
              panelTitle: "Panel A: Reconstrucción Vascular de Alta Resolución",
              anatomicalFocus: "Evaluación morfológica parietal y luminal del eje vascular principal.",
              laterality: "Derecha",
              imagePrompt: "Ultra-realistic 3D medical macro vascular cross-section render showing blood vessel wall, translucent lumen with chromatic laminar flow vectors, studio lighting, octane render, no text."
            },
            {
              panelLetter: "B",
              panelTitle: "Panel B: Eje Complementario / Contralateral",
              anatomicalFocus: "Permeabilidad y morfología parietal del vaso complementario.",
              laterality: "Izquierda",
              imagePrompt: "Ultra-realistic 3D medical macro vascular render of contralateral blood vessel, smooth endothelial intima, clean studio background, octane render, no text."
            }
          ],
          hemodynamicTable: [
            {
              vessel: "Eje Vascular Principal",
              plaqueOrThrombus: "Morfología evaluada",
              stenosisPercent: "0%",
              patternOrVelocity: "Flujo laminar normal",
              hemodynamicIndex: "Normal",
              clinicalImpact: "Sin repercusión hemodinámica"
            }
          ],
          synthesisTitle: "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:",
          morphologicalSynthesis: "La correlación anatomopatológica y velocimétrica confirma la permeabilidad y características hemodinámicas descriptas en el estudio."
        };
      }

      // Generate images in parallel for each vascular panel
      const panelsWithImages = await Promise.all(
        (planJson.panels || []).map(async (panel: any, idx: number) => {
          let promptToUse = panel.imagePrompt || `Ultra-realistic 3D medical macro vascular render of ${panel.vesselName || panel.panelTitle}, octane render, no text.`;
          if (customDirectives && customDirectives.trim()) {
            promptToUse = `${promptToUse} [MANDATORY CLINICAL DIRECTIVE: ${customDirectives.trim()}].`;
          }
          {
            const screenMap = buildScreenLateralityConstraint(panel.laterality || planJson.laterality || laterality, "AP / coronal");
            if (panel.laterality && panel.laterality !== "auto") {
              promptToUse = `[MANDATORY PATIENT LATERALITY: ${panel.laterality.toUpperCase()}]. ${LATERALITY_HARD_RULES} ${screenMap} ${promptToUse}`;
            } else {
              promptToUse = `${LATERALITY_HARD_RULES} ${screenMap} ${promptToUse}`;
            }
          }

          try {
            const imageUrl = await generateMedicalImage(ai, promptToUse);
            return {
              id: `vasc-panel-${idx}-${Date.now()}`,
              panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
              panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
              vesselName: panel.vesselName || panel.panelTitle || "",
              anatomicalFocus: panel.anatomicalFocus || "Evaluación vascular anatómica y hemodinámica",
              laterality: panel.laterality || planJson.laterality || laterality || "",
              imageUrl: imageUrl,
              promptUsed: promptToUse,
              isCustomFlipped: false
            };
          } catch (imgErr) {
            console.error(`Error generando imagen para panel vascular ${panel.panelLetter}:`, imgErr);
            return {
              id: `vasc-panel-${idx}-${Date.now()}`,
              panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
              panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
              vesselName: panel.vesselName || panel.panelTitle || "",
              anatomicalFocus: panel.anatomicalFocus || "Evaluación vascular anatómica y hemodinámica",
              laterality: panel.laterality || planJson.laterality || laterality || "",
              imageUrl: "",
              promptUsed: promptToUse,
              isCustomFlipped: false
            };
          }
        })
      );

      const finalVascularData = {
        studyTypeCategory: planJson.studyTypeCategory || vascularType || "carotideo_vertebral",
        territoryLabel: planJson.territoryLabel || "DOPPLER VASCULAR",
        laterality: planJson.laterality || laterality || "Bilateral",
        figureTitle: planJson.figureTitle || `FIGURA 1. ATLAS 3D DE CORRELACIÓN VASCULAR Y HEMODINÁMICA`,
        tableTitle: planJson.tableTitle || `TABLA HEMODINÁMICA Y CARACTERIZACIÓN DE LESIONES:`,
        tableHeaders: planJson.tableHeaders || {
          col1: "VASO / SEGMENTO",
          col2: "PLACA / TROMBO",
          col3: "% ESTENOSIS",
          col4: "PATRÓN (PSV/EDV)",
          col5: "REL. ACC/ACI",
          col6: "IMPACTO HEMODIN."
        },
        panels: panelsWithImages,
        hemodynamicTable: planJson.hemodynamicTable || [],
        synthesisTitle: planJson.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:",
        morphologicalSynthesis: planJson.morphologicalSynthesis || planJson.biomechanicalSynthesis || ""
      };

      res.json({
        success: true,
        data: finalVascularData
      });

    } catch (error: any) {
      console.error("Error en /api/generate-3d-vascular:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  // 4. REGENERATE INDIVIDUAL VASCULAR 3D PANEL
  app.post("/api/regenerate-3d-vascular-panel", async (req: express.Request, res: express.Response) => {
    try {
      const { reportText, vascularType, panel, laterality, userDirective, requestedModel, customDirectives } = req.body;

      if (!panel) {
        return res.status(400).json({ success: false, error: "Se requiere el panel vascular a regenerar." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");

      const refinePrompt = `Eres un Cirujano Vascular y Director de Arte Médico 3D.
Diseña un prompt en inglés superdetallado para re-generar una única imagen vascular macrofotorrealista 3D correspondiente al PANEL ${panel.panelLetter}.

DATOS DEL CASO:
- Territorio: "${vascularType || "Doppler Vascular"}"
- Vaso: "${panel.vesselName || panel.panelTitle || ""}"
- Foco actual: "${panel.anatomicalFocus || ""}"
- Lateralidad requerida: "${laterality || panel.laterality || ""}"
- Instrucción / Corrección del médico: "${userDirective || "Mejorar precisión anatomopatológica y hemodinámica"}"
- DIRECTIVA CLÍNICA OBLIGATORIA (Scorecard / médico): "${customDirectives || "Ninguna"}"
- Contexto del informe: """${(reportText || "").slice(0, 800)}"""

REGLAS DE ESTILO:
- Ultra-realistic 3D medical macro vascular cross-section render, cinema 4D octane render style, accurate vascular wall layers (intima, media, adventitia), realistic plaque/thrombus (lipid core, fibrous cap, calcium) or smooth clean lumen, glowing chromatic laminar blood flow vectors, soft surgical studio lighting, pure clean background.
- STRICTLY NO text, NO numbers, NO letters, NO arrows inside the image.

RESPONDE EN JSON:
{
  "panelTitle": "Título actualizado o confirmado para el panel",
  "vesselName": "Nombre del vaso",
  "anatomicalFocus": "Foco anatomopatológico y hemodinámico de 1 a 2 líneas",
  "imagePrompt": "Detailed English image generation prompt..."
}`;

      const refineResponse = await ai.models.generateContent({
        model: model,
        contents: [{ text: refinePrompt }],
        config: { responseMimeType: "application/json" }
      });

      let refineJson: any = {};
      try {
        refineJson = JSON.parse(refineResponse.text || "{}");
      } catch (e) {
        refineJson = {
          panelTitle: panel.panelTitle,
          vesselName: panel.vesselName || panel.panelTitle,
          anatomicalFocus: panel.anatomicalFocus,
          imagePrompt: `Ultra-realistic 3D medical macro vascular render of ${panel.vesselName || panel.panelTitle}, octane render, studio lighting, no text.`
        };
      }

      let finalPrompt = refineJson.imagePrompt || panel.promptUsed || `3D macro vascular render of ${panel.panelTitle}, no text.`;
      if (customDirectives && String(customDirectives).trim()) {
        finalPrompt = `${finalPrompt} [MANDATORY CLINICAL DIRECTIVE: ${String(customDirectives).trim()}].`;
      }
      if (userDirective && userDirective.trim()) {
        finalPrompt = `${finalPrompt} [MANDATORY SURGICAL CORRECTION: ${userDirective.trim()}].`;
      }
      if (laterality && laterality !== "auto") {
        const screenMap = buildScreenLateralityConstraint(laterality, "AP / coronal");
        finalPrompt = `[MANDATORY PATIENT LATERALITY: ${laterality.toUpperCase()}]. ${LATERALITY_HARD_RULES} ${screenMap} ${finalPrompt}`;
      } else {
        const screenMap = buildScreenLateralityConstraint(laterality, "AP / coronal");
        finalPrompt = `${LATERALITY_HARD_RULES} ${screenMap} ${finalPrompt}`;
      }

      const imageUrl = await generateMedicalImage(ai, finalPrompt);

      const updatedPanel = {
        ...panel,
        panelTitle: refineJson.panelTitle || panel.panelTitle,
        vesselName: refineJson.vesselName || panel.vesselName,
        anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus,
        laterality: laterality || panel.laterality,
        imageUrl: imageUrl,
        promptUsed: finalPrompt,
        isCustomFlipped: false
      };

      res.json({
        success: true,
        panel: updatedPanel
      });

    } catch (error: any) {
      console.error("Error en /api/regenerate-3d-vascular-panel:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  // 5. Focal Lesion Cutaway 3D (on-demand: auto-detect or manual focus, 1–2 panels)
  app.post("/api/generate-focal-lesion-3d", async (req: express.Request, res: express.Response) => {
    try {
      const {
        reportText,
        organOrStudy,
        laterality,
        requestedModel,
        customDirectives,
        focusMode,
        focusText,
        includeMacroPanel
      } = req.body;

      if (!reportText || !reportText.trim()) {
        return res.status(400).json({ success: false, error: "Se requiere el texto del informe radiológico." });
      }

      const mode = focusMode === "manual" ? "manual" : "auto";
      if (mode === "manual" && !(typeof focusText === "string" && focusText.trim())) {
        return res.status(400).json({ success: false, error: "Indica la lesión o foco manual a reconstruir." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");
      const wantMacro = includeMacroPanel !== false;
      const focusInstruction = mode === "manual"
        ? `MODO MANUAL: la lesión/foco a reconstruir es exactamente: "${String(focusText).trim()}". Ignora otras lesiones salvo como contexto anatómico mínimo.`
        : `MODO AUTO: identifica la LESIÓN DOMINANTE del informe (la de mayor relevancia diagnóstica). Si hay empate, prioriza la más específica/medible.`;

      const promptPlan = `Eres un Radiólogo y Anatomista Quirúrgico. Planifica un CORTE FOCAL 3D de UNA lesión (no un atlas regional completo).

========================================================================
DATOS:
========================================================================
- Región / Protocolo: "${organOrStudy || "Estudio General"}"
- Lateralidad: "${laterality || "Detectar del texto"}"
- Directiva clínica (Scorecard / médico): "${customDirectives || "Ninguna"}"
- ${focusInstruction}
- INFORME:
"""
${reportText}
"""

========================================================================
TAREA:
========================================================================
1. Define la lesión objetivo (label, sitio exacto, morfología, tamaño si consta, relaciones).
2. Diseña ${wantMacro ? "2 paneles" : "1 panel"}:
   - Panel A = CONTEXTO REGIONAL con la lesión visible y anclada (cutaway anatómico).
   ${wantMacro ? "- Panel B = MACRO / ZOOM cutaway de la lesión (detalle morfológico fiel; conserva hitos de orientación para no perder lateralidad)." : ""}
3. Cada panel DEBE incluir spatialContract (view, laterality, imageLeftStructure, imageRightStructure, superiorStructure/inferiorStructure, mustShowLandmarks, pathologySite, pathologyAppearance, doNotInvent).
3b. ${LATERALITY_PLAN_RULES_ES}
3b2. ${BREAST_CLOCK_PLAN_RULES_ES}
   Si el foco es unilateral, pathologySite debe nombrar el lado correcto en ambos paneles (contexto y macro).
4. NO inventes hallazgos. Si el informe es normal y no hay foco manual, responde lesionFound=false.
5. Estilo: fotorrealismo clínico premium (igual o superior al Atlas 3D); SIN bioluminiscencia.

RESPONDE SOLO JSON:
{
  "lesionFound": true,
  "lesionLabel": "string corto",
  "lesionSite": "string",
  "lesionSummary": "1-2 frases fieles al informe",
  "lesionSize": "string o vacío",
  "lesionMorphology": "string",
  "lesionRelations": "string",
  "keyPoints": ["string"],
  "studyRegion": "string",
  "figureTitle": "FIGURA. DETALLE 3D DEL HALLAZGO: ...",
  "detectedLaterality": "Izquierda|Derecha|Bilateral|Línea media",
  "panels": [
    {
      "panelLetter": "A",
      "panelTitle": "Contexto regional",
      "anatomicalFocus": "Foco: ...",
      "laterality": "string",
      "panelRole": "context|macro",
      "spatialContract": {
        "view": "string",
        "laterality": "string",
        "imageLeftStructure": "string",
        "imageRightStructure": "string",
        "superiorStructure": "string",
        "inferiorStructure": "string",
        "mustShowLandmarks": ["string"],
        "pathologySite": "string",
        "pathologyAppearance": "string",
        "doNotInvent": ["string"]
      }
    }
  ]
}`;

      const planResponse = await ai.models.generateContent({
        model,
        contents: [{ text: promptPlan }],
        config: { responseMimeType: "application/json" }
      });

      let planJson: any = {};
      try {
        planJson = JSON.parse(planResponse.text || "{}");
      } catch {
        planJson = {};
      }

      if (planJson.lesionFound === false) {
        return res.json({
          success: false,
          error: "No se identificó una lesión focal clara en el informe. Prueba modo manual indicando el foco."
        });
      }

      let panelsPlan = Array.isArray(planJson.panels) ? planJson.panels.slice(0, wantMacro ? 2 : 1) : [];
      if (!panelsPlan.length) {
        panelsPlan = [{
          panelLetter: "A",
          panelTitle: "Contexto regional de la lesión",
          anatomicalFocus: `Foco: ${focusText || planJson.lesionLabel || "lesión reportada"}`,
          laterality: laterality || planJson.detectedLaterality || "",
          panelRole: "context",
          spatialContract: {
            view: "oblique clinical cutaway",
            laterality: laterality || "",
            imageLeftStructure: "anatomically correct left-of-frame structure",
            imageRightStructure: "anatomically correct right-of-frame structure",
            mustShowLandmarks: [],
            pathologySite: String(focusText || planJson.lesionSite || ""),
            pathologyAppearance: String(planJson.lesionMorphology || ""),
            doNotInvent: ["invented satellite lesions", "mirrored laterality"]
          }
        }];
      }

      const forcedLaterality = laterality && laterality !== "auto" ? laterality : "";
      const lesionDirective = [
        `FOCAL LESION TARGET: ${planJson.lesionLabel || focusText || "reported lesion"}`,
        planJson.lesionSite ? `Site: ${planJson.lesionSite}` : "",
        planJson.lesionMorphology ? `Morphology: ${planJson.lesionMorphology}` : "",
        planJson.lesionSize ? `Size: ${planJson.lesionSize}` : "",
        "Keep orientation landmarks visible; do not invent secondary pathology."
      ].filter(Boolean).join(". ");

      const mergedDirectives = [lesionDirective, customDirectives].filter(Boolean).join("\n");

      const buildPanelFromPlan = async (panel: any, idx: number, surgicalCorrection?: string) => {
        const contract = normalizeSpatialContract(
          panel.spatialContract,
          panel.laterality || planJson.detectedLaterality || forcedLaterality
        );
        if (!contract.pathologySite && (planJson.lesionSite || focusText)) {
          contract.pathologySite = String(planJson.lesionSite || focusText);
        }
        if (!contract.pathologyAppearance && planJson.lesionMorphology) {
          contract.pathologyAppearance = String(planJson.lesionMorphology);
        }
        const role = panel.panelRole === "macro" || idx === 1 ? "macro" : "context";
        const promptToUse = buildImagePromptFromContract({
          panelTitle: panel.panelTitle || (role === "macro" ? "Macro de la lesión" : "Contexto regional"),
          anatomicalFocus: panel.anatomicalFocus || `Foco: ${planJson.lesionLabel || "lesión"}`,
          studyRegion: planJson.studyRegion || organOrStudy || "anatomy",
          contract,
          customDirectives: mergedDirectives,
          forcedLaterality,
          surgicalCorrection: [
            role === "macro"
              ? "MACRO CUTAWAY: fill most of the frame with the lesion and immediate adjacent tissue; keep 1-2 orientation landmarks."
              : "REGIONAL CONTEXT: show the lesion in situ within the correct anatomical compartment.",
            surgicalCorrection || ""
          ].filter(Boolean).join(" ")
        });
        try {
          const imageUrl = await generateMedicalImage(ai, promptToUse);
          return {
            id: `focal-${idx}-${Date.now()}`,
            panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
            panelTitle: panel.panelTitle || (role === "macro" ? "Macro de la lesión" : "Contexto regional"),
            anatomicalFocus: panel.anatomicalFocus || `Foco: ${planJson.lesionLabel || "lesión"}`,
            laterality: panel.laterality || planJson.detectedLaterality || laterality || "",
            spatialContract: contract,
            imageUrl,
            promptUsed: promptToUse,
            isCustomFlipped: false,
            panelRole: role
          };
        } catch (imgErr) {
          console.error("Error imagen corte focal:", imgErr);
          return {
            id: `focal-${idx}-${Date.now()}`,
            panelLetter: panel.panelLetter || String.fromCharCode(65 + idx),
            panelTitle: panel.panelTitle || `Panel ${String.fromCharCode(65 + idx)}`,
            anatomicalFocus: panel.anatomicalFocus || "",
            laterality: panel.laterality || "",
            spatialContract: contract,
            imageUrl: "",
            promptUsed: promptToUse,
            isCustomFlipped: false,
            panelRole: role
          };
        }
      };

      let panelsWithImages = await Promise.all(
        panelsPlan.map((panel: any, idx: number) => buildPanelFromPlan(panel, idx))
      );

      let qualityAudit: any = { verified: false, panelNotes: [], synopticRewritten: false };
      try {
        const verifiable = panelsWithImages.filter((p: any) => p.imageUrl && stripDataUrl(p.imageUrl));
        if (verifiable.length > 0) {
          const verifyParts: any[] = [{
            text: `Eres un radiólogo revisor de calidad de CORTE FOCAL 3D.
Compara CADA imagen con el informe y el contrato espacial de la lesión objetivo "${planJson.lesionLabel || focusText || ""}" en "${planJson.lesionSite || ""}".
PRIORIDAD #1: LATERALIDAD CON CONVENCIÓN AP (paciente de frente / radiografía AP).
- Lado del paciente ≠ lado de la mano del observador.
- AP/coronal/anterior: paciente-derecha → izquierda del cuadro; paciente-izquierda → derecha del cuadro.
- Si fallan lateralidad o anclas izquierda/derecha del cuadro => lateralityOk=false y pass=false.
- Si es mama: no confundir eje 3 con 9 ni CSE con CSI (derecha: 3 lateral / 9 medial; izquierda: 3 medial / 9 lateral).
- surgicalCorrection debe mandar explícitamente viewer-left / viewer-right y clock-hour si aplica.
Devuelve JSON:
{
  "panels": [
    {
      "panelLetter": "A",
      "pass": true/false,
      "lateralityOk": true/false,
      "pathologyOk": true/false,
      "landmarksOk": true/false,
      "issues": ["..."],
      "surgicalCorrection": "English instruction if pass=false, else empty"
    }
  ],
  "lesionSummary": "optional refined 1-2 sentence summary in Spanish"
}
Reglas: no inventes; si lateralidad/sitio/morfología fallan => pass=false.
INFORME:
"""
${reportText}
"""
PLAN:
${JSON.stringify(panelsPlan.map((p: any, i: number) => ({
  panelLetter: panelsWithImages[i]?.panelLetter || p.panelLetter,
  panelTitle: p.panelTitle,
  panelRole: panelsWithImages[i]?.panelRole || p.panelRole,
  anatomicalFocus: p.anatomicalFocus,
  spatialContract: panelsWithImages[i]?.spatialContract || p.spatialContract
})), null, 2)}
`
          }];
          for (const p of verifiable) {
            const parsedImg = stripDataUrl(p.imageUrl);
            if (!parsedImg) continue;
            verifyParts.push({ text: `PANEL ${p.panelLetter} (${p.panelRole || "context"}) — ${p.panelTitle}` });
            verifyParts.push({ inlineData: { mimeType: parsedImg.mime, data: parsedImg.data } });
          }

          const verifyResp = await ai.models.generateContent({
            model,
            contents: { parts: verifyParts },
            config: { responseMimeType: "application/json" }
          });
          let verifyJson: any = {};
          try {
            verifyJson = JSON.parse(verifyResp.text || "{}");
          } catch {
            verifyJson = {};
          }

          qualityAudit.verified = true;
          qualityAudit.panelNotes = Array.isArray(verifyJson.panels) ? verifyJson.panels : [];

          if (Array.isArray(verifyJson.panels)) {
            const regenJobs: Promise<any>[] = [];
            for (const note of verifyJson.panels) {
              if (note?.pass !== false) continue;
              const letter = String(note.panelLetter || "").toUpperCase();
              const idx = panelsWithImages.findIndex((p: any) => String(p.panelLetter).toUpperCase() === letter);
              if (idx < 0) continue;
              const originalPlan = panelsPlan[idx] || panelsWithImages[idx];
              const contract = panelsWithImages[idx]?.spatialContract || originalPlan?.spatialContract || {};
              const latFail = note?.lateralityOk !== true;
              const correction = reinforceLateralityCorrection(
                String(note.surgicalCorrection || "Fix laterality landmarks and depict only the target lesion faithfully."),
                contract.laterality || panelsWithImages[idx]?.laterality || planJson.detectedLaterality || laterality,
                contract.view,
                latFail
              );
              regenJobs.push(
                buildPanelFromPlan(originalPlan, idx, correction).then((newPanel) => ({ idx, newPanel, note }))
              );
            }
            const regenResults = await Promise.all(regenJobs);
            for (const r of regenResults) {
              panelsWithImages[r.idx] = {
                ...r.newPanel,
                qualityFlags: {
                  regenerated: true,
                  issues: r.note.issues || [],
                  lateralityOk: false,
                  pathologyOk: false
                }
              };
            }
          }

          if (typeof verifyJson.lesionSummary === "string" && verifyJson.lesionSummary.trim()) {
            planJson.lesionSummary = verifyJson.lesionSummary.trim();
          }
        }
      } catch (verifyErr: any) {
        console.warn("Verificación visual corte focal omitida/fallida:", verifyErr?.message || verifyErr);
        qualityAudit.error = String(verifyErr?.message || verifyErr);
      }

      const data = {
        lesionLabel: String(planJson.lesionLabel || focusText || "Lesión focal").trim(),
        lesionSite: String(planJson.lesionSite || "").trim(),
        lesionSummary: String(planJson.lesionSummary || "").trim(),
        lesionSize: String(planJson.lesionSize || "").trim(),
        lesionMorphology: String(planJson.lesionMorphology || "").trim(),
        lesionRelations: String(planJson.lesionRelations || "").trim(),
        keyPoints: Array.isArray(planJson.keyPoints)
          ? planJson.keyPoints.map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6)
          : [],
        detectionMode: mode,
        focusText: mode === "manual" ? String(focusText).trim() : "",
        studyRegion: planJson.studyRegion || organOrStudy || "Estudio Actual",
        figureTitle: planJson.figureTitle || `FIGURA. DETALLE 3D DEL HALLAZGO: ${planJson.lesionLabel || "LESIÓN FOCAL"}`,
        detectedLaterality: planJson.detectedLaterality || laterality || "",
        panels: panelsWithImages,
        qualityAudit
      };

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Error en /api/generate-focal-lesion-3d:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });

  app.post("/api/regenerate-focal-lesion-panel", async (req: express.Request, res: express.Response) => {
    try {
      const {
        reportText,
        studyRegion,
        panel,
        laterality,
        userDirective,
        requestedModel,
        customDirectives,
        lesionLabel,
        lesionSite,
        lesionMorphology
      } = req.body;

      if (!panel) {
        return res.status(400).json({ success: false, error: "Se requiere el panel a regenerar." });
      }

      const ai = getGeminiClient();
      const model = getModelName(requestedModel || "gemini-3.7-flash");
      const forcedLaterality = laterality && laterality !== "auto" ? laterality : "";
      const fullReport = typeof reportText === "string" ? reportText : "";
      const role = panel.panelRole === "macro" ? "macro" : "context";

      const refinementPrompt = `Eres un Radiólogo y Anatomista Quirúrgico. Refina el CONTRATO ESPACIAL para regenerar el PANEL ${panel.panelLetter || "A"} de un CORTE FOCAL 3D.

DATOS:
- Región: "${studyRegion || "Anatomía médica"}"
- Lesión objetivo: "${lesionLabel || ""}" en "${lesionSite || ""}"
- Morfología: "${lesionMorphology || ""}"
- Título panel: "${panel.panelTitle || ""}"
- Foco: "${panel.anatomicalFocus || ""}"
- Rol: "${role}"
- Lateralidad: "${forcedLaterality || panel.laterality || ""}"
- Contrato previo: ${JSON.stringify(panel.spatialContract || {})}
- Directiva clínica: "${customDirectives || "Ninguna"}"
- Corrección del médico: "${userDirective || "Mejorar precisión del sitio y morfología de la lesión"}"
- INFORME:
"""
${fullReport}
"""

RESPONDE SOLO JSON:
{
  "panelTitle": "string",
  "anatomicalFocus": "Foco: ...",
  "spatialContract": {
    "view": "string",
    "laterality": "string",
    "imageLeftStructure": "string",
    "imageRightStructure": "string",
    "superiorStructure": "string",
    "inferiorStructure": "string",
    "mustShowLandmarks": ["string"],
    "pathologySite": "string",
    "pathologyAppearance": "string",
    "doNotInvent": ["string"]
  }
}`;

      const refineResponse = await ai.models.generateContent({
        model,
        contents: [{ text: refinementPrompt }],
        config: { responseMimeType: "application/json" }
      });

      let refineJson: any = {};
      try {
        refineJson = JSON.parse(refineResponse.text || "{}");
      } catch {
        refineJson = {
          panelTitle: panel.panelTitle,
          anatomicalFocus: panel.anatomicalFocus,
          spatialContract: panel.spatialContract || {}
        };
      }

      const contract = normalizeSpatialContract(
        refineJson.spatialContract || panel.spatialContract,
        forcedLaterality || panel.laterality
      );

      const finalPrompt = buildImagePromptFromContract({
        panelTitle: refineJson.panelTitle || panel.panelTitle || `Panel ${panel.panelLetter || ""}`,
        anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus || "Foco lesion",
        studyRegion: studyRegion || "anatomy",
        contract,
        customDirectives: [
          lesionLabel ? `FOCAL LESION TARGET: ${lesionLabel}${lesionSite ? ` at ${lesionSite}` : ""}` : "",
          customDirectives || ""
        ].filter(Boolean).join("\n"),
        forcedLaterality,
        surgicalCorrection: [
          role === "macro"
            ? "MACRO CUTAWAY of the target lesion with orientation landmarks."
            : "Regional context with lesion in correct compartment.",
          userDirective || ""
        ].filter(Boolean).join(" ")
      });

      const imageUrl = await generateMedicalImage(ai, finalPrompt);

      res.json({
        success: true,
        panel: {
          ...panel,
          panelTitle: refineJson.panelTitle || panel.panelTitle,
          anatomicalFocus: refineJson.anatomicalFocus || panel.anatomicalFocus,
          laterality: forcedLaterality || panel.laterality,
          spatialContract: contract,
          imageUrl,
          promptUsed: finalPrompt,
          isCustomFlipped: false,
          qualityFlags: undefined,
          panelRole: role
        }
      });
    } catch (error: any) {
      console.error("Error en /api/regenerate-focal-lesion-panel:", error);
      res.status(500).json({ success: false, error: handleGeminiError(error) });
    }
  });


}

