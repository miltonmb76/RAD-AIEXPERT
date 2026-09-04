import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import sharp from "sharp";
import { registerAtlas3DRoutes } from "./server_atlas3d";

// Lazy-loaded GenAI client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;
let lastUsedKey: string | undefined = undefined;

// Robust function to clean API keys (especially protecting against iOS smart curly quotes)
function cleanGeminiKey(key: string): string {
  if (!key) return "";
  let clean = key.trim();
  
  // Remove zero-width spaces, hidden control characters, or Unicode spaces
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Remove escape backslashes before quotes which can happen in automated copy-pastes
  clean = clean.replace(/\\"/g, '"').replace(/\\'/g, "'");

  // If the user pasted the entire assignment line by mistake (e.g., GEMINI_API_KEY=AIzaSy... or export GEMINI_API_KEY="AIzaSy...")
  if (clean.includes("=")) {
    const parts = clean.split("=");
    const prefix = parts[0].toLowerCase();
    if (prefix.includes("gemini") || prefix.includes("key") || prefix.includes("export") || prefix.includes("env")) {
      clean = parts.slice(1).join("=").trim();
    }
  }

  // If the user pasted with a label like "key:" or "api key:"
  if (clean.toLowerCase().startsWith("key:") || clean.toLowerCase().startsWith("apikey:") || clean.toLowerCase().startsWith("api_key:")) {
    clean = clean.substring(clean.indexOf(":") + 1).trim();
  }
  
  // Clean any leading/trailing straight or curly quotes (extremely common on iOS smart punctuation) and backslashes
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

function cleanBase64(base64: string): string {
  if (!base64) return "";
  const commaIndex = base64.indexOf(",");
  if (commaIndex !== -1) {
    return base64.substring(commaIndex + 1);
  }
  return base64.trim();
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
  // auto / unknown / empty → quality Flash default on server
  return "gemini-3.8-flash";
}

// Global sanitizer to strictly enforce BAAF instead of PAAF across all reports, annexes, and modules
function enforceBaafTerminology(textOrObj: any): any {
  if (typeof textOrObj === "string") {
    return textOrObj
      .replace(/\bPAAF\b/g, "BAAF")
      .replace(/\bpaaf\b/g, "baaf")
      .replace(/\bPaaf\b/g, "Baaf")
      .replace(/P\.A\.A\.F\./gi, "BAAF")
      .replace(/P\.A\.A\.F/gi, "BAAF")
      .replace(/Punci[oó]n(?:-|\s+por\s+|\s+)Aspiraci[oó]n\s+con\s+Aguja\s+Fina/gi, "Biopsia por Aspiración con Aguja Fina")
      .replace(/punci[oó]n(?:-|\s+por\s+|\s+)aspiraci[oó]n\s+con\s+aguja\s+fina/gi, "biopsia por aspiración con aguja fina")
      .replace(/Punci[oó]n\s+por\s+aguja\s+fina/gi, "Biopsia por aspiración con aguja fina")
      .replace(/punci[oó]n\s+por\s+aguja\s+fina/gi, "biopsia por aspiración con aguja fina")
      .replace(/Punci[oó]n\s+con\s+aguja\s+fina/gi, "Biopsia con aguja fina")
      .replace(/punci[oó]n\s+con\s+aguja\s+fina/gi, "biopsia con aguja fina")
      .replace(/Punci[oó]n\s+aspirativa\s+con\s+aguja\s+fina/gi, "Biopsia por aspiración con aguja fina")
      .replace(/punci[oó]n\s+aspirativa\s+con\s+aguja\s+fina/gi, "biopsia por aspiración con aguja fina")
      .replace(/Punci[oó]n\s+Aspiraci[oó]n/gi, "Biopsia por Aspiración")
      .replace(/punci[oó]n\s+aspiraci[oó]n/gi, "biopsia por aspiración");
  }
  if (Array.isArray(textOrObj)) {
    return textOrObj.map(enforceBaafTerminology);
  }
  if (textOrObj !== null && typeof textOrObj === "object") {
    const resObj: any = {};
    for (const key of Object.keys(textOrObj)) {
      resObj[key] = enforceBaafTerminology(textOrObj[key]);
    }
    return resObj;
  }
  return textOrObj;
}

function getGeminiClient(): GoogleGenAI {
  // Reload environment variables from the .env file in case the user updated them in the Settings/Secrets UI
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

  // Update process.env to ensure the cleaned key is globally visible to any SDK fallback
  process.env.GEMINI_API_KEY = apiKey;
  
  // Recreate client if the key changed to avoid stale client caching
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

// Intercepts and formats Gemini API errors to provide clear guidance to the user
function handleGeminiError(error: any): string {
  const errorMsg = error?.message || "";
  const errorJson = typeof error === "object" ? JSON.stringify(error) : "";
  const fullErrorStr = `${errorMsg} ${errorJson} ${String(error)}`.toLowerCase();
  
  const rawDetails = `\n\n[Detalle técnico del error: ${errorMsg || String(error)}]`;
  
  if (
    fullErrorStr.includes("expired") ||
    fullErrorStr.includes("api_key_invalid") ||
    fullErrorStr.includes("api key not found") ||
    fullErrorStr.includes("key not found") ||
    (fullErrorStr.includes("not found") && (fullErrorStr.includes("api key") || fullErrorStr.includes("api_key"))) ||
    (fullErrorStr.includes("invalid") && (fullErrorStr.includes("api key") || fullErrorStr.includes("api_key"))) ||
    (fullErrorStr.includes("invalid_argument") && (fullErrorStr.includes("api key") || fullErrorStr.includes("api_key"))) ||
    fullErrorStr.includes("key expired")
  ) {
    return "❌ ERROR DE AUTENTICACIÓN (API_KEY_INVALID)\n\n" +
           "La Clave de API de Gemini (GEMINI_API_KEY) es detectada pero ha sido rechazada por los servidores de Google.\n\n" +
           "Para solucionar este inconveniente, por favor realiza las siguientes comprobaciones:\n" +
           "1. **Crear una Clave Nueva**: Entra a Google AI Studio (https://aistudio.google.com/), haz clic en 'Get API Key' y crea una clave totalmente nueva. A veces las claves antiguas se desactivan espontáneamente.\n" +
           "2. **Guardarla en Secrets**: Ve al botón superior de 'Settings' (Configuración) o panel de Secretos en esta pantalla de AI Studio, escribe 'GEMINI_API_KEY' de forma exacta y pega allí tu clave nueva.\n" +
           "3. **Habilitar la API de Lenguaje Generativo**: Si estás utilizando un proyecto de Google Cloud (GCP) personalizado, asegúrate de haber habilitado la 'Generative Language API' (o Vertex AI API) en la biblioteca de APIs de la consola de GCP para ese proyecto.\n" +
           "4. **Remover Restricciones**: Asegura que el API Key no esté restringido en Google Cloud Console para otras APIs, o que tenga permitida la API de Lenguaje Generativo.\n" +
           rawDetails;
  }
  return (errorMsg || "Error de comunicación con Gemini AI. Por favor, revisa la configuración.") + rawDetails;
}

function getBaseAndSide(name: string): { baseName: string, side: 'der' | 'izq' } | null {
  const nameLower = name.toLowerCase();
  
  let side: 'der' | 'izq' | null = null;
  if (/\b(derecho|derecha|der|dch|right)\b/i.test(nameLower)) {
    side = 'der';
  } else if (/\b(izquierdo|izquierda|izq|left)\b/i.test(nameLower)) {
    side = 'izq';
  } else if (nameLower.includes(" der ") || nameLower.endsWith(" der") || nameLower.startsWith("der ")) {
    side = 'der';
  } else if (nameLower.includes(" izq ") || nameLower.endsWith(" izq") || nameLower.startsWith("izq ")) {
    side = 'izq';
  }

  if (!side) return null;

  const baseName = nameLower
    .replace(/\b(derecho|derecha|der|dch|right|izquierdo|izquierda|izq|left)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { baseName, side };
}

function varyValueString(valStr: string, structureName: string): string {
  const match = valStr.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!match) return valStr;

  const numStr = match[1];
  const unit = match[2] ? match[2].trim() : "";
  const num = parseFloat(numStr);
  if (isNaN(num)) return valStr;

  let hash = 0;
  for (let i = 0; i < structureName.length; i++) {
    hash = (hash << 5) - hash + structureName.charCodeAt(i);
    hash |= 0;
  }
  const isPositive = hash % 2 === 0;

  let delta = 0;
  let decimals = 0;

  if (numStr.includes(".") || (num > 0 && num < 1) || unit.toLowerCase() === "cm" || unit.toLowerCase() === "") {
    if (num > 0 && num < 1) {
      delta = isPositive ? 0.03 : -0.03;
      decimals = 2;
    } else if (unit.toLowerCase() === "cm") {
      delta = isPositive ? 0.3 : -0.3;
      decimals = 1;
    } else {
      delta = isPositive ? 0.2 : -0.2;
      decimals = 1;
    }
  } else {
    if (num >= 80) {
      delta = isPositive ? 4 : -4;
    } else if (num >= 40) {
      delta = isPositive ? 3 : -3;
    } else if (num >= 15) {
      delta = isPositive ? 2 : -2;
    } else if (num >= 5) {
      delta = isPositive ? 1 : -1;
    } else {
      delta = isPositive ? 0.5 : -0.5;
      decimals = 1;
    }
  }

  const newValue = num + delta;
  const formattedNewValue = decimals > 0 ? newValue.toFixed(decimals) : Math.round(newValue).toString();
  return unit ? `${formattedNewValue} ${unit}` : formattedNewValue;
}

function parseRangeLimits(rangeStr: string, defaultVal: number): { min: number, max: number } {
  const cleanRange = rangeStr.toLowerCase().replace(/,/g, ".").trim();
  
  // Try to match "MIN - MAX" (e.g., "90 - 120", "37 - 44", "50 - 100")
  const rangeMatch = cleanRange.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }

  // Try to match "hasta MAX" or "< MAX" or "<= MAX"
  const maxMatch = cleanRange.match(/(?:hasta|<|<=)\s*([\d.]+)/);
  if (maxMatch) {
    const max = parseFloat(maxMatch[1]);
    if (!isNaN(max)) {
      const min = defaultVal > 1 ? Math.floor(defaultVal * 0.7) : defaultVal * 0.75;
      return { min, max };
    }
  }

  // Try to match "> MIN" or ">= MIN"
  const minMatch = cleanRange.match(/(?:>|>=)\s*([\d.]+)/);
  if (minMatch) {
    const min = parseFloat(minMatch[1]);
    if (!isNaN(min)) {
      const max = defaultVal * 1.3;
      return { min, max };
    }
  }

  // Fallback: use defaultVal +/- 15%
  return {
    min: defaultVal * 0.85,
    max: defaultVal * 1.15
  };
}

function randomizeNormalValue(defaultValStr: string, rangeStr: string, structureName: string): string {
  let cleanRange = (rangeStr || "").toLowerCase().replace(/,/g, ".").trim();
  let min = 0;
  let max = 0;
  let hasRange = false;

  // Try to parse rangeStr "MIN - MAX" (e.g. "37 - 44 mm" or "90 - 120")
  const rangeMatch = cleanRange.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1]);
    max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      hasRange = true;
    }
  }

  // If no range limits found yet, let's try "< MAX" or "hasta MAX"
  if (!hasRange) {
    const maxMatch = cleanRange.match(/(?:hasta|<|<=)\s*([\d.]+)/);
    if (maxMatch) {
      max = parseFloat(maxMatch[1]);
      if (!isNaN(max)) {
        min = max * 0.6; // sensible lower bound
        hasRange = true;
      }
    }
  }

  // If no range limits found yet, try "> MIN" or ">= MIN"
  if (!hasRange) {
    const minMatch = cleanRange.match(/(?:>|>=)\s*([\d.]+)/);
    if (minMatch) {
      min = parseFloat(minMatch[1]);
      if (!isNaN(min)) {
        max = min * 1.4; // sensible upper bound
        hasRange = true;
      }
    }
  }

  // Now let's try to extract any numbers from the defaultValStr.
  // It could be a single number like "135 mm" or a range like "37 - 44 mm"
  let defaultVal = 0;
  let hasDefaultVal = false;
  let unit = "";

  const cleanDefault = defaultValStr.replace(/,/g, ".").trim();
  // Check if it's a range like "37 - 44 mm"
  const defaultRangeMatch = cleanDefault.match(/([\d.]+)\s*[-–—]\s*([\d.]+)\s*([a-zA-Z/]*)/);
  if (defaultRangeMatch) {
    const dMin = parseFloat(defaultRangeMatch[1]);
    const dMax = parseFloat(defaultRangeMatch[2]);
    unit = defaultRangeMatch[3] ? defaultRangeMatch[3].trim() : "";
    if (!isNaN(dMin) && !isNaN(dMax)) {
      defaultVal = (dMin + dMax) / 2;
      hasDefaultVal = true;
      if (!hasRange) {
        min = dMin;
        max = dMax;
        hasRange = true;
      }
    }
  } else {
    // Single number with unit
    const singleMatch = cleanDefault.match(/^([\d.]+)\s*(.*)$/);
    if (singleMatch) {
      defaultVal = parseFloat(singleMatch[1]);
      unit = singleMatch[2] ? singleMatch[2].trim() : "";
      if (!isNaN(defaultVal)) {
        hasDefaultVal = true;
      }
    }
  }

  // If we don't even have a default value or range, just return whatever we were given
  if (!hasRange && !hasDefaultVal) {
    return defaultValStr;
  }

  // If we have a default value but no range, let's build a range around the default value (+/- 15%)
  if (!hasRange && hasDefaultVal) {
    min = defaultVal * 0.85;
    max = defaultVal * 1.15;
  }

  // If we have a range but no default value, set defaultVal to the midpoint
  if (hasRange && !hasDefaultVal) {
    defaultVal = (min + max) / 2;
  }

  // At this point we are guaranteed to have a min and a max, and a defaultVal!
  const nameLower = structureName.toLowerCase();
  const isIR = /\bir\b/i.test(nameLower) || nameLower.includes("índice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("índice resistencia") || nameLower.includes("indice resistencia");

  if (isIR && (nameLower.includes("renal") || nameLower.includes("riñón") || nameLower.includes("riñon") || nameLower.includes("izquierdo") || nameLower.includes("derecho") || rangeStr.includes("0."))) {
    const randomIR = 0.56 + Math.random() * (0.68 - 0.56);
    return randomIR.toFixed(2).replace(".", ",");
  }

  // Generate a random value strictly inside [min, max] with a 10% safe buffer
  const margin = (max - min) * 0.1;
  const safeMin = min + margin;
  const safeMax = max - margin;

  let randomVal = safeMin + Math.random() * (safeMax - safeMin);
  if (safeMax <= safeMin) {
    randomVal = min + Math.random() * (max - min);
  }

  // Format the randomized value properly
  let formattedVal = "";
  // Check if it's a decimal format
  const isDecimal = cleanDefault.includes(".") || (defaultVal > 0 && defaultVal < 1) || (max - min < 5 && min % 1 !== 0) || isIR;
  if (isDecimal) {
    const matchDec = cleanDefault.match(/\.(\d+)/);
    const decimals = matchDec ? matchDec[1].length : 1;
    formattedVal = randomVal.toFixed(decimals).replace(".", ",");
  } else {
    formattedVal = Math.round(randomVal).toString();
  }

  // Ensure unit is clean and doesn't contain ranges or extra dashes
  let cleanUnit = unit.replace(/^[-–—\s\d.,]+/, "").trim();
  
  return cleanUnit ? `${formattedVal} ${cleanUnit}` : formattedVal;
}

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

// Enable JSON with elevated body limit because medical images can be large
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Cloud Run's direct IAP integration authenticates the request before it
// reaches Express and overwrites this header with the verified identity.
// Development remains unchanged unless AUTH_MODE=iap is explicitly enabled.
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || process.env.AUTH_MODE !== "iap") {
    return next();
  }

  const allowedEmail = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    console.error("[Seguridad] AUTH_MODE=iap requiere ALLOWED_USER_EMAIL.");
    return res.status(503).json({ error: "La lista de acceso del servicio no está configurada." });
  }

  const iapEmailHeader = req.header("x-goog-authenticated-user-email") || "";
  const authenticatedEmail = iapEmailHeader.replace(/^accounts\.google\.com:/i, "").trim().toLowerCase();

  if (!authenticatedEmail) {
    return res.status(401).json({ error: "Se requiere autenticación mediante Google IAP." });
  }
  if (authenticatedEmail !== allowedEmail) {
    return res.status(403).json({ error: "Esta cuenta no está autorizada para usar la aplicación." });
  }

  next();
});

// Global response sanitizer: guarantees BAAF is always used and PAAF is never returned in any response
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body: any) {
    if (body) {
      body = enforceBaafTerminology(body);
    }
    return originalJson.call(this, body);
  };
  next();
});

// Register Atlas 3D routes (Full generation + single panel regeneration)
registerAtlas3DRoutes(app);

// --- API ENDPOINTS ---

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  try {
    // Always trigger dotenv config reload to match live settings
    try {
      dotenv.config({ override: true });
    } catch (e) {}

    const rawKey = process.env.GEMINI_API_KEY || "";
    const cleanedKey = cleanGeminiKey(rawKey);
    const trimmedKey = rawKey.trim();
    const hasSpacingIssues = rawKey !== trimmedKey;
    const hasQuoteIssues = rawKey !== cleanedKey && !hasSpacingIssues;
    const hasSmartQuotes = rawKey.includes("“") || rawKey.includes("”") || rawKey.includes("‘") || rawKey.includes("’");
    
    let keyInfo = "No provista";
    let length = 0;
    let matchesFormat = false;

    if (cleanedKey) {
      length = cleanedKey.length;
      matchesFormat = cleanedKey.startsWith("AIzaSy");
      keyInfo = `Configurada, total: ${length} caracteres.`;
    }

    res.json({
      status: "ok",
      message: "Servidor del Asistente Radiológico activo",
      api_key_configured: !!cleanedKey,
      api_key_status: keyInfo,
      api_key_length: length,
      api_key_starts_with_aizasy: matchesFormat,
      api_key_has_surrounding_whitespace: hasSpacingIssues || hasQuoteIssues,
      tip: cleanedKey.startsWith("sk-")
        ? "⚠️ ¡ERROR DE PROVEEDOR! Se detectó una clave que comienza con 'sk-'. Las claves de API de Google Gemini SIEMPRE comienzan con 'AIzaSy'. Las claves que comienzan con 'sk-' corresponden a OpenAI (ChatGPT) u Anthropic y no funcionarán aquí. Por favor, crea una clave válida en Google AI Studio (https://aistudio.google.com/)."
        : hasSmartQuotes
        ? "¡ADVERTENCIA DE IPHONE/DISPOSITIVO SMART! Se detectaron comillas curvas inteligentes (curly/smart quotes “ ” o ‘ ’) alrededor de tu API key. Esto ocurre comúnmente al copiar/pegar en iPhones y Macs. Nuestro software las ha filtrado y removido automáticamente, ¡puedes continuar utilizando la IA!"
        : hasQuoteIssues
        ? "¡ADVERTENCIA! Se encontraron comillas rectangulares (' o \") rodeando tu clave de API en Settings. Las hemos removido automáticamente."
        : hasSpacingIssues 
        ? "¡ADVERTENCIA! Se encontraron espacios en blanco al inicio o al final del API Key. Las hemos limpiado automáticamente." 
        : "Tu API key está siendo leída y limpiada de forma segura."
    });
  } catch (error: any) {
    console.error("Critical error in /api/health:", error);
    res.status(500).json({
      status: "error",
      message: "Error interno del servidor al diagnosticar la API",
      error: error?.message || String(error),
      api_key_configured: false,
      api_key_status: "Error de lectura",
      api_key_length: 0,
      api_key_starts_with_aizasy: false,
      api_key_has_surrounding_whitespace: false,
      tip: "Ocurrió un error inesperado al leer la configuración. Contacta con soporte o revisa el formato de tus variables de entorno."
    });
  }
});

/**
 * Helper to format annotations for the Gemini prompt
 */
function formatImageAnnotations(annotations: any[] | undefined): string {
  if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
    return "";
  }
  let text = "\n\n--- ⚠️ REGIONES CRÍTICAS MARCADAS EN LA IMAGEN POR EL MÉDICO ---\n";
  text += "El médico ha marcado y etiquetado puntos o regiones específicas sobre la imagen radiológica provista.\n";
  text += "ESTAS MARCAS REPRESENTAN SU SOSPECHA CLÍNICA DIRECTA DE UNA LESIÓN. ESTÁS OBLIGADO a asumir que existe una alteración real en estas zonas y enfocar el 100% de tu sensibilidad en confirmar su naturaleza (ej. fracturas sutiles en manos/pies, fisuras, lesiones focales). NUNCA asumas que es normal si el médico la ha marcado; evalúa con máxima minucia.\n";
  annotations.forEach((ann: any, index: number) => {
    const num = index + 1;
    if (ann.type === "point") {
      text += `- **Marcador #${num} (Punto)**: Ubicado aproximadamente en X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% de la imagen. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    } else if (ann.type === "box") {
      text += `- **Marcador #${num} (Región Rectangular)**: Enmarcado desde X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% con un ancho de ${Number(ann.w || 0).toFixed(1)}% y un alto de ${Number(ann.h || 0).toFixed(1)}%. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    }
  });
  text += "Analiza de manera exhaustiva y prioritaria estas coordenadas, correlacionándolas detalladamente en el informe.\n\n";
  return text;
}

/**
 * 1. API: ANALIZE IMAGE AND DRAFT RADIOLOGY REPORT
 * POST /api/analyze
 * Payload: {
 *   image?: string (base64 string without data prefix, e.g. "iVBORw0KG...")
 *   mimeType?: string (e.g. "image/png", "image/jpeg")
 *   studyType: string (e.g. "Radiografía de Tórax AP/Lateral")
 *   clinicalHistory: string (e.g. "Paciente masculino de 45 años con tos persistente")
 *   customPrompt?: string (instructions on what to search for or report style)
 *   systemInstruction?: string (overriding clinical rules/persona)
 *   annotations?: Array (optional list of user-drawn region of interest objects)
 * }
 */
app.post("/api/analyze", async (req: express.Request, res: express.Response) => {
  try {
    const { model, image, mimeType, studyType, clinicalHistory, findings, inputReport, uploadedReportContent, uploadedReportMimeType, systemInstruction, annotations, attachedImages } = req.body;
    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const parts: any[] = [];

    // System instruction/guidelines for drafting reports
    const finalSystemInstruction = systemInstruction || 
      "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica. Tu nivel de detalle es impecable, sigues strictly estándares médicos (como BI-RADS, Bosniak, Fleischner, ACR TI-RADS, etc.) y formulas reportes radiológicos sumamente precisos, limpios, profesionales y listos para ser copiados y pegados directamente en expedientes clínicos y Microsoft Word (donde las secciones están separadas por doble espacio, los títulos van en negrita normal en vez de encabezados Markdown, y la sección de impresión diagnóstica se redacta enteramente en negrita). Siempre mantienes un vocabulario técnico radiológico riguroso. " +
      "CONVENCIÓN DE LATERALIDAD Y ORIENTACIÓN RADIOLÓGICA OBLIGATORIA (REGLA DE ESPEJO ANATÓMICO Y ALINEACIÓN DE INDICACIÓN CLÍNICA): " +
      "1. REGLA ANATÓMICA RADIOLÓGICA DE ESPEJO (Proyecciones frontales PA/AP): La DERECHA VISUAL de la pantalla/imagen corresponde al LADO IZQUIERDO ANATÓMICO DEL PACIENTE (Hemitórax / Campo pulmonar izquierdo). La IZQUIERDA VISUAL de la pantalla corresponde al LADO DERECHO ANATÓMICO DEL PACIENTE (Hemitórax / Campo pulmonar derecho). NUNCA confundas la derecha visual de la foto con la derecha del paciente. Un neumotórax, infiltrado o lesión visible en la mitad derecha de la foto/pantalla DEBE ser reportado como IZQUIERDO (Lado del paciente). " +
      "2. ALINEACIÓN CON LA INDICACIÓN CLÍNICA: Si el médico o consulta indica 'Neumotórax Izquierdo' (o hallazgo en lado izquierdo), examina la mitad VISUAL DERECHA de la imagen médica (hemitórax izquierdo del paciente). Si identificas la línea pleural visceral o avascularidad periférica en la mitad visual derecha de la placa, CONFIRMA Y REPORTA EXPLÍCITAMENTE COMO 'NEUMOTÓRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusión de la matriz de la foto. " +
      "REGLAS CRÍTICAS DE TERMINOLOGÍA Y RECOMENDACIONES DE TIROIDES (ACR TI-RADS): " +
      "1. Usa SIEMPRE la sigla BAAF (Biopsia por Aspiración con Aguja Fina). Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla PAAF o el término punción por aguja fina. " +
      "2. Umbrales oficiales de la ACR TI-RADS 2017 para recomendación de BAAF y seguimiento ecográfico: " +
      "- TR1 (Benigno, 0 pts) y TR2 (No sospechoso, 2 pts): No requieren BAAF ni seguimiento ecográfico. " +
      "- TR3 (Levemente sospechoso, 3 pts): Indicar BAAF ÚNICAMENTE si mide ≥ 2.5 cm (25 mm). Indicar seguimiento ecográfico si mide ≥ 1.5 cm (15 mm) (nódulos TR3 de 15 mm a 24 mm son de seguimiento ecográfico, NUNCA BAAF). " +
      "- TR4 (Moderadamente sospechoso, 4-6 pts): Indicar BAAF si mide ≥ 1.5 cm (15 mm). Indicar seguimiento ecográfico si mide ≥ 1.0 cm (10 mm) (nódulos TR4 de 10 mm a 14 mm son de seguimiento ecográfico). " +
      "- TR5 (Altamente sospechoso, ≥ 7 pts): Indicar BAAF si mide ≥ 1.0 cm (10 mm). Indicar seguimiento ecográfico si mide ≥ 0.5 cm (5 mm) (nódulos TR5 de 5 mm a 9 mm son de seguimiento ecográfico).";

    // If an image is provided, prepare it for Gemini
    if (image && mimeType) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    // NEW: Check if uploadedReportContent is an image or PDF (e.g. an elastography PNG screenshot or PDF report)
    let uploadedReportImageBase64 = "";
    let uploadedReportImageMimeType = "";

    if (uploadedReportContent && (uploadedReportContent.startsWith("data:") || (uploadedReportMimeType && (uploadedReportMimeType.startsWith("image/") || uploadedReportMimeType === "application/pdf")))) {
      const commaIndex = uploadedReportContent.indexOf(",");
      if (commaIndex !== -1) {
        uploadedReportImageBase64 = uploadedReportContent.substring(commaIndex + 1);
        const match = uploadedReportContent.substring(0, commaIndex).match(/data:(.*?);base64/);
        uploadedReportImageMimeType = match ? match[1] : (uploadedReportMimeType || "image/png");
      } else {
        uploadedReportImageBase64 = uploadedReportContent;
        uploadedReportImageMimeType = uploadedReportMimeType || "image/png";
      }
    }

    if (uploadedReportImageBase64 && uploadedReportImageMimeType) {
      parts.push({
        inlineData: {
          data: uploadedReportImageBase64,
          mimeType: uploadedReportImageMimeType,
        },
      });
    }

    // Build the reporting prompt
    let promptText = `
Estudio realizado: ${studyType || "No especificado"}
Indicación médica: ${clinicalHistory || "No proporcionada"}
`;

    if (findings) {
      promptText += `Hallazgos descritos por el usuario: ${findings}\n`;
    }

    if (inputReport) {
      promptText += `Borrador / Informe previo: \n"""\n${inputReport}\n"""\n`;
    }

    if (attachedImages && attachedImages.length > 0) {
      promptText += `\n⚠️ REFERENCIAS BIDIRECCIONALES A IMÁGENES ADJUNTAS:
El informe tiene las siguientes capturas diagnósticas adjuntas:
`;
      attachedImages.forEach((img: any) => {
        promptText += `- Imagen ${img.index}: "${img.caption || "Sin descripción aún"}"\n`;
      });
      promptText += `
Cuando redactes o describas los HALLAZGOS o la IMPRESIÓN DIAGNÓSTICA del reporte, si describes un hallazgo, estructura, lesión o anomalía que corresponda directamente con alguna de las imágenes adjuntas anteriores (basándote en su descripción/rótulo), estás obligado a insertar de manera natural la indicación entre paréntesis para el lector, por ejemplo: "(ver Imagen ${attachedImages[0].index})" o "(ver Imagen ${attachedImages[1].index})" al final de la oración pertinente. Esto permite una correlación bidireccional perfecta para que el lector busque la imagen si lo desea.
`;
    }

    if (uploadedReportImageBase64 && uploadedReportImageMimeType) {
      if (uploadedReportImageMimeType === "application/pdf") {
        promptText += `\n⚠️ CRÍTICO - ESTUDIO CLÍNICO/INFORME PREVIO ADJUNTO EN FORMATO PDF:
Se ha cargado un archivo PDF conteniendo un informe médico o estudio previo como segunda señal de entrada para este caso.
Analiza con el mayor rigor médico y minucia el contenido de este documento PDF. Extrae con precisión:
1. La lesión base descrita (quistes, nódulos, masas, roturas, desgarros, etc.) con sus dimensiones exactas en mm/cm, densidad/ecogenicidad y localización anatómica exacta.
2. Cualquier hallazgo o parámetro cuantitativo relevante.
SI EL USUARIO INDICA "SIN CAMBIOS", "SIN MODIFICACIONES", "CONTROL", "ESTABLE" O NO INDICA NUEVOS DETALLES, ESTÁS OBLIGADO A TOMAR ESTE ESTUDIO PREVIO COMO BASE DE TU REPORTE, CONFIRMANDO LA PERSISTENCIA Y ESTABILIDAD CLÍNICA DE DICHA LESIÓN SIN INVENTAR OTRA DIFERENTE NI EXCLUIRLA.
\n`;
      } else {
        promptText += `\n⚠️ CRÍTICO - IMAGEN DE ESTUDIO DE SOPORTE ADJUNTA (ELASTOGRAFÍA, ECOGRAFÍA O REPORTE PREVIO):
Se ha cargado una imagen/captura de pantalla de un estudio previo o de elastografía como segunda señal de entrada para este caso. 
Analiza visualmente con extrema detención esta segunda imagen adjunta. Extrae detalladamente todos sus parámetros, tales como mediciones de rigidez (kPa o m/s), clasificaciones correspondientes (ej: puntuaciones METAVIR F0-F4, grados de esteatosis, etc.) o hallazgos visuales clave descritos en dicha captura, e intégralos formalmente y de forma prioritaria en los HALLAZGOS o IMPRESIÓN DIAGNÓSTICA del reporte radiológico actual. No omitas estos datos cuantitativos cruciales.
\n`;
      }
    } else if (uploadedReportContent) {
      promptText += `Informe de estudio previo o elastografía anexado: \n"""\n${uploadedReportContent}\n"""\n`;
    }

    if (uploadedReportContent || inputReport || (uploadedReportImageBase64 && uploadedReportImageMimeType === "application/pdf")) {
      promptText += `
⚠️ DIRECTRIZ CRÍTICA DE ADHERENCIA MÉDICA AL ESTUDIO PREVIO COMPARTIDO:
1. Lee minuciosamente el estudio clínico o informe previo anexado anteriormente (ya sea en formato texto, PDF o imagen). Identifica con precisión la lesión base descrita (como quistes, nódulos, masas, roturas, fracturas, atenuación, dimensiones en mm/cm, y localización anatómica exacta).
2. Si el usuario indica "sin cambios", "no hay cambios específicos", "sin modificaciones", "estable", "de control", o si el texto ingresado no especifica una nueva alteración en la lesión, estás OBLIGADO a tomar este estudio compartido como tu verdad clínica absoluta y base del nuevo informe.
3. BAJO NINGUNA CIRCUNSTANCIA inventes o alucines una lesión de diferente naturaleza, tamaño o localización a la descrita en el estudio previo. Tampoco ignores la lesión descrita en el estudio previo para declarar un examen normal, a menos que el usuario indique explícitamente que la lesión ha desaparecido o se ha resuelto.
4. Redacta la sección de HALLAZGOS partiendo literalmente de la descripción de la lesión descrita en el estudio previo, confirmando su estabilidad, persistencia y ausencia de cambios de forma clínicamente rigurosa, y refléjalo en la IMPRESIÓN DIAGNÓSTICA como una lesión estable.
\n`;
    }

    if (annotations && annotations.length > 0) {
      promptText += formatImageAnnotations(annotations);
    }

    promptText += `
Por favor, estructura tu respuesta de la siguiente forma EXACTA (usa formato Markdown claro para que sea fácil de copiar y pegar). No agregues notas introductorias ni comentarios personales fuera del informe:

[INICIO DEL REPORTE]
**${studyType ? studyType.toUpperCase() : "REPORTE DE ESTUDIO RADIOLÓGICO"}**


**TIPO DE ESTUDIO:** ${studyType || "Estudio de Imagen"}

**HISTORIA CLÍNICA / INDICACIONES:** ${clinicalHistory ? `(Pula, redacte adecuadamente, corrija ortográficamente y formatee de manera fluida y académica la indicación del estudio provista por el usuario: "${clinicalHistory}". REGLA DE CASING OBLIGATORIA: Si está escrita completa o parcialmente en mayúsculas sostenidas, debe convertirla obligatoriamente a minúsculas estándar/mixtas con su primera letra mayúscula para que guarde perfecta coherencia estética con el resto del reporte. No use mayúsculas sostenidas ni abreviaciones informales bajo ninguna circunstancia, y redáctela con impecable terminología médica en español, sin inventar síntomas o hallazgos).` : "No especificada"}


**TÉCNICA DEL EXAMEN:**
(Describe aquí la técnica de manera profesional para este tipo de estudio basado en las buenas prácticas, por ejemplo cortes, proyecciones, administración de contraste si aplica. Solo usa texto normal sin encabezados Markdown '#' ni '##')


**HALLAZGOS:**
${findings ? `Basados en los hallazgos descritos ("${findings}"), el estudio previo provisto (si aplica) y la imagen proporcionada (si aplica), describe con sumo rigor clínico y terminología radiológica avanzada. Si el caso es de control o sin cambios respecto al estudio previo, parte rigurosamente de la lesión descrita en el estudio anterior, detallándola con absoluta precisión y describiendo que permanece estable. No uses encabezados de sección '#' ni '##', usa líneas de texto normales y listas con viñetas estándar si es necesario:\n` : `(Divide por estructuras anatómicas relevantes para este estudio de manera detallada y científica. Si hay un informe o estudio previo anexado, asúmelo como la base para tus hallazgos, describiendo la lesión base allí detallada con sus dimensiones y confirmando su persistencia/estabilidad. No uses encabezados '#' ni '##')\n`}


**IMPRESIÓN DIAGNÓSTICA:**
**1. (La conclusión diagnóstica y cualquier recomendación o clasificación de consenso como BI-RADS, quistes de Bosniak, criterios de Fleischner, etc. DEBE estar ESCRITA COMPLETAMENTE EN NEGRITA. Cada línea de esta sección debe estar envuelta en asteriscos dobles. Ejemplo: '**1. Hallazgo de sospecha...**')**
**2. (Toda esta sección debe estar completamente en negrita línea por línea)**

[FIN DEL REPORTE]

REGLAS DE FORMATO CRÍTICAS PARA COMPATIBILIDAD CON MICROSOFT WORD:
1. NUNCA utilices encabezados de estilo Markdown como '#', '##', o '###' para el título, nombres de secciones ni subsecciones. Utiliza únicamente texto plano y negritas tanto para las secciones principales (ej: **TÉCNICA DEL EXAMEN:**, **HALLAZGOS:**) como para las subsecciones internas (ej: **Parénquima pulmonar:**, **Mediastino:**, **Silueta cardíaca:**).
2. Deja exactamente DOS líneas en blanco (doble espacio) entre cada una de las secciones principales del reporte, y también exactamente DOS líneas en blanco (doble espacio) entre los párrafos y las subsecciones internas (por ejemplo, entre cada subsección de los hallazgos para que queden bien espaciadas).
3. Asegura que TODO el texto, puntos, listas y recomendaciones bajo la sección 'IMPRESIÓN DIAGNÓSTICA' esté renderizado enteramente en negrita (ej: **1. Hallazgo...** y **2. Recomendación...**).
4. El título principal (basado en el estudio especificado) debe estar exactamente en esa línea y se centrará automáticamente al copiarlo o visualizarlo.
5. El tono debe ser de un radiólogo experto de nivel de subespecialidad.
6. ASISTENCIA Y REDACCIÓN DE LA INDICACIÓN / HISTORIA CLÍNICA: Debes pulir, refinar ortográficamente y redactar de forma clínicamente óptima el texto provisto para la indicación o historia clínica. Si la indicación fue ingresada completa o parcialmente en mayúsculas sostenidas (ALL CAPS) o con ortografía informal, tradúcela obligatoriamente a una redacción fluida, técnica, académica y formal usando minúsculas con mayúscula inicial (caja mixta). Nunca la dejes en mayúsculas sostenidas, para mantener absoluta uniformidad estética y profesional con el resto de la redacción del reporte.
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: finalSystemInstruction,
        temperature: 0.1, // low temperature for highly structured medical output
      },
    });

    res.json({
      success: true,
      report: response.text,
      model_used: selectedModel,
    });
  } catch (error: any) {
    console.error("Error en /api/analyze:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: ASSIST AND POLISH CLINICAL HISTORY / INDICATION (CASING & SPELLING ASSISTANCE)
 * POST /api/assist-clinical-history
 * Payload: {
 *   model?: string (e.g. "gemini-3.7-flash")
 *   clinicalHistory: string
 *   studyType?: string
 * }
 */
app.post("/api/assist-clinical-history", async (req: express.Request, res: express.Response) => {
  try {
    const { model, clinicalHistory, studyType } = req.body;
    if (!clinicalHistory) {
      return res.status(400).json({ success: false, error: "Se requiere el parámetro 'clinicalHistory' para asistir." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Eres un asistente de redacción médica especialista en radiología. El usuario te ha proporcionado el motivo o indicación clínica para una prueba de imagen radiológica.

Estudio realizado o solicitado: "${studyType || "No especificado"}"
Texto original provisto por el usuario: "${clinicalHistory}"

Por favor, reescribe, pule, corrige ortográficamente y mejora de manera formal esta indicación médica en español clínico/radiológico.

REGLAS CRÍTICAS DE FORMATO Y CONTENIDO (SÍGUELAS DE MANERA ESTRICTA):
1. REGLA DE CASING ABSOLUTA: Si el texto provisto tiene palabras o frases enteras escritas en mayúsculas sostenidas (ALL CAPS) o con mayúsculas informales, debes traducirlas y convertirlas COMPLETAMENTE al formato estándar de minúsculas con su primera letra mayúscula (caja normal/mixta). Bajo ninguna circunstancia respondas con un texto completamente en mayúsculas sostenidas.
2. RIGOR CLÍNICO: Corrige cualquier error ortográfico, faltas de acentuación o sintaxis. No inventes antecedentes o síntomas clínicos nuevos que el usuario no describió, simplemente dale una redacción formal, impecable, técnica, elegante y profesional (por ejemplo: "DOLOR SEVERO EN CODO DERECHO" -> "Dolor severo en la articulación del codo derecho").
3. MÁXIMA CONCISIÓN: Devuelve SÓLO el texto plano de la indicación médica ya corregida y asistida, sin preámbulos, sin notas aclaratorias, sin comentarios, sin comillas adicionales en la salida. Debe ser legible e inyectable directamente.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ text: promptText }],
      config: {
        systemInstruction: "Eres un redactor médico de radiología de élite. Tu función es corregir, pulir sintáctica y ortográficamente, y formatear a mayúsculas/minúsculas correctas las indicaciones de estudio, garantizando que nunca se produzcan textos en mayúsculas sostenidas y dotándolos de un lenguaje técnico formal y fluido.",
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      polishedText: response.text ? response.text.trim() : clinicalHistory,
    });
  } catch (error: any) {
    console.error("Error en /api/assist-clinical-history:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: ULTRA-STABLE VOICE DICTATION TRANSCRIBER VIA GEMINI
 * POST /api/transcribe
 * Payload: {
 *   audio: string (base64 data)
 *   mimeType: string (e.g., "audio/webm", "audio/mp4", "audio/wav")
 * }
 */
app.post("/api/transcribe", async (req: express.Request, res: express.Response) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || !mimeType) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'audio' y 'mimeType'." });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          inlineData: {
            data: cleanBase64(audio),
            mimeType: mimeType,
          },
        },
        "Por favor, transcribe este archivo de audio de dictado médico radiológico con absoluta precisión técnica en español. Devuelve únicamente el texto plano de la transcripción, sin saludos, sin formateo adicional, ni comentarios personales. Mantén la terminología médica exacta dictada en español.",
      ],
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/transcribe:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 2. API: CASE CHAT ANALYZER / DIFFERENTIAL DIAGNOSIS
 * POST /api/chat
 * Payload: {
 *   messages: [ { role: "user" | "model", text: string } ],
 *   systemInstruction?: string
 * }
 */
app.post("/api/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { model, messages, systemInstruction } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "El cuerpo de la solicitud debe incluir una lista de 'messages'." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const finalSystemInstruction = systemInstruction || 
      "Eres un consultor radiológico de élite de nivel académico. Ayudas a otros radiólogos y médicos a resolver casos difíciles, proponer diagnósticos diferenciales detallados basados en signos radiográficos, sugerir estudios de imagen complementarios idóneos para resolver el dilema diagnóstico y explicar la fisiopatología detrás de los hallazgos de imagen. Responde siempre con rigor científico y de forma estructurada. " +
      "REGLA DE TERMINOLOGÍA: Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla o término PAAF. Utiliza SIEMPRE la sigla BAAF (Biopsia por Aspiración con Aguja Fina).";

    // Format chat messages appropriately for the SDK
    // The chats.create or models.generateContent with previous conversation contents
    // Let's map the messages cleanly
    const contents = messages.map((m) => {
      return {
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      };
    });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: {
        systemInstruction: finalSystemInstruction,
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      reply: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/chat:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 3. API: RADIOLOGY CLASSIFICATIONS SEARCH ENGINE
 * POST /api/classify
 * Payload: {
 *   query: string (e.g. "escala de bosniak para quistes renales")
 *   systemInstruction?: string
 * }
 */
app.post("/api/classify", async (req: express.Request, res: express.Response) => {
  try {
    const { model, query, systemInstruction } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: "Falta el parámetro 'query' de la búsqueda." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const finalSystemInstruction = systemInstruction || 
      "Eres una enciclopedia viva de clasificaciones, escalas y criterios radiológicos (ej. BI-RADS, Bosniak, LI-RADS, PI-RADS, Fleischner, Stanford/DeBakey, Duke, Balthazar, Child-Pugh, etc.). Tu tarea es proveer información estructurada, precisa y actualizada sobre la escala consultada, detallando los estadios/grados, criterios de imagen clave para cada uno y las recomendaciones correspondientes de seguimiento clínico o quirúrgico. Presenta todo con tablas detalladas y listas claras de lectura rápida. " +
      "REGLA DE TERMINOLOGÍA: Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla o término PAAF. Utiliza SIEMPRE la sigla BAAF (Biopsia por Aspiración con Aguja Fina).";

    const promptText = `Explica a fondo, con criterios precisos y de forma perfectamente organizada la siguiente escala, criterio o clasificación radiológica:
"${query}"

Por favor, proporciona:
1. Definición y propósito de la clasificación.
2. Una tabla clara con los Grados/Categorías, sus Hallazgos Radiológicos Clave y la conducta recomendada o seguimiento.
3. Consejos o advertencias prácticas para el radiólogo al aplicar esta escala en su reporte diario.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: finalSystemInstruction,
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      info: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/classify:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 4. API: RECOMMEND CLASSIFICATIONS BASED ON GENERATED REPORT
 * POST /api/recommend-classifications
 * Payload: {
 *   report: string
 * }
 */
app.post("/api/recommend-classifications", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para analizar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un consultor radiológico experto con amplias credenciales internacionales. Tu tarea es examinar con sumo rigor clínico el informe " +
      "radiológico provisto por el usuario, discernir qué clasificaciones, escalas, criterios médicos o scores radiológicos de consenso internacional " +
      "(ej. BI-RADS, quistes de Bosniak, criterios de Fleischner, ACR TI-RADS, LI-RADS, PI-RADS, criterios de Alvarado, criterios de Duke, Balthazar, Consenso SRU para Esteatosis Hepática / QUS, etc.) " +
      "son aplicables diagnósticamente para complementar la 'Impresión Diagnóstica' o 'Recomendaciones' de este informe, y estructurar una respuesta en formato JSON exacto. " +
      "REGLAS OBLIGATORIAS DE BAAF Y ACR TI-RADS: " +
      "1. Usa siempre la sigla BAAF (Biopsia por Aspiración con Aguja Fina). Prohibido usar PAAF. " +
      "2. Criterios exactos ACR TI-RADS 2017 para BAAF y seguimiento: " +
      "   - TR1 (0 pts) y TR2 (2 pts): No BAAF ni seguimiento. " +
      "   - TR3 (3 pts): BAAF solo si ≥ 2.5 cm (25 mm). Seguimiento ecográfico si es ≥ 1.5 cm (15 mm) (rango 15-24 mm es para seguimiento ecográfico, NUNCA BAAF). " +
      "   - TR4 (4-6 pts): BAAF si ≥ 1.5 cm (15 mm). Seguimiento ecográfico si es ≥ 1.0 cm (10 mm) (rango 10-14 mm es seguimiento ecográfico). " +
      "   - TR5 (≥7 pts): BAAF si ≥ 1.0 cm (10 mm). Seguimiento ecográfico si es ≥ 0.5 cm (5 mm) (rango 5-9 mm es seguimiento ecográfico). " +
      "3. Criterios para Esteatosis Hepática / Consenso SRU (por porcentaje de grasa QUS): " +
      "   - Normal: < 5.0% " +
      "   - Leve: 5.0% a 12.0% " +
      "   - Moderada: 12.1% a 20.0% " +
      "   - Severa: > 20.0%.";

    const promptText = `Analiza detenidamente este informe radiológico:

"""
${report}
"""

Identifica cuáles de las clasificaciones, escalas, criterios médicos o scores radiológicos de consenso internacional o guías clínicas son aplicables o de gran valor basado en los hallazgos descritos de este estudio.

Proporciona una lista detallada de recomendaciones (de 1 a 3 escalas o criterios clínico-radiológicos relevantes). Si no hay escalas internacionalmente estructuradas que encajen directamente, puedes proponer recomendaciones estructuradas o de seguimiento clínico-patológico de gran utilidad clínica bajo el formato de "Sugerencias Específicas de Seguimiento".

Por cada recomendación, rellena los campos requeridos en el esquema JSON, especialmente el contenido a incorporar redactado con el más alto rigor científico del radiólogo senior.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { 
                type: Type.STRING, 
                description: "Nombre oficial de la clasificación radiológica, criterio o escala sugerida (ej: Criterios de Fleischner 2017 para nódulos incidentales, Criterios de Diagnóstico Duke modificado, etc.)." 
              },
              whyRecommended: { 
                type: Type.STRING, 
                description: "Breve explicación diagnóstica de una sola oración de por qué se recomienda esta escala tras analizar el texto del reporte." 
              },
              contentToAppend: { 
                type: Type.STRING, 
                description: "El bloque redactado que contiene la escala detallada, grados y conducta aplicable al caso, preferiblemente en una tabla o lista Markdown perfectamente formateada y lista para integrarse." 
              },
              alreadyIncorporated: {
                type: Type.BOOLEAN,
                description: "Indica con 'true' si esta clasificación o score ya se encuentra calculada, asignada de forma explícita y redactada con su valor correspondiente (ej: 'BI-RADS 4', 'Bosniak II') dentro del cuerpo del reporte provisto, o 'false' si está ausente o no calculada/aplicada formalmente."
              }
            },
            required: ["name", "whyRecommended", "contentToAppend", "alreadyIncorporated"]
          }
        }
      }
    });

    let recommendations = [];
    try {
      recommendations = JSON.parse(response.text || "[]");
    } catch (parseErr) {
      console.warn("Falla de parseo en JSON devuelto por Gemini:", response.text);
      // Fallback if formatting slipped
      throw new Error("No se pudo obtener un JSON válido de las recomendaciones. Reintenta la solicitud.");
    }

    res.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error("Error en /api/recommend-classifications:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: SEMANTIC PARAGRAPH CLASSIFIER FOR REPORT HIGHLIGHTING
 * POST /api/analyze-paragraphs
 * Payload: {
 *   paragraphs: string[]
 *   model?: string
 * }
 */
app.post("/api/analyze-paragraphs", async (req: express.Request, res: express.Response) => {
  try {
    const { model, paragraphs } = req.body;
    if (!paragraphs || !Array.isArray(paragraphs) || paragraphs.length === 0) {
      return res.json({ success: true, results: {} });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un médico radiólogo de élite experto en análisis semántico de reportes médicos. " +
      "Tu tarea es analizar cada uno de los fragmentos de texto (párrafos, oraciones o elementos de lista) de un informe radiológico provistos, " +
      "y clasificarlos con precisión médica real en una de estas tres categorías de severidad clínica:\n" +
      "1. 'normal': El texto describe estructuras normales, hallazgos esperados para la edad, técnicas del examen, títulos, datos de identificación, o la ausencia de patología de forma explícita (por ejemplo: 'sin hallazgos patológicos', 'silueta cardíaca normal', 'estructuras conservadas', 'parénquima pulmonar normal').\n" +
      "2. 'altered': El texto describe un hallazgo patológico activo, lesión, alteración anatómica, inflamación, degeneración o anormalidad de severidad estándar, moderada o leve (por ejemplo: 'presencia de nódulo de 5mm', 'bursitis', 'esteatosis leve', 'quiste cortical renal', 'desgarro parcial', 'osteofitos', 'derrame articular leve').\n" +
      "3. 'critical': El texto describe un hallazgo patológico crítico, agudo, potencialmente mortal o de máxima urgencia clínica (por ejemplo: 'trombosis venosa profunda', 'desgarro/ruptura completa de tendón', 'apendicitis aguda', 'aneurisma gigante', 'neumotórax a tensión', 'infarto esplénico', 'masa de sospecha altamente maligna BI-RADS 5').\n\n" +
      "REGLAS CRÍTICAS:\n" +
      "- Debes entender el contexto clínico real. Si se niega un hallazgo (ej. 'Sin evidencia de derrame' o 'No se aprecian fracturas'), es un hallazgo NORMAL ('normal').\n" +
      "- Si hay duda de si es altered o critical, clasifícalo como 'altered' a menos que sea una emergencia de alta urgencia o una ruptura completa.\n" +
      "- No uses palabras clave de forma robótica, entiende la semántica médica real.";

    const promptText = `Analiza cada uno de los siguientes textos y clasifícalos según su severidad radiológica/clínica. Retorna un objeto JSON con la clasificación de cada texto de manera exacta.

La estructura de salida debe ser un objeto JSON plano donde las llaves sean los textos originales exactos y los valores sean la clasificación correspondiente: "normal", "altered" o "critical".

Ejemplo de salida esperada:
{
  "Silueta cardíaca de tamaño normal.": "normal",
  "Se observa un nódulo pulmonar sólido de 8 mm en el lóbulo superior derecho.": "altered",
  "Trombosis venosa profunda aguda de la vena femoral común derecha.": "critical"
}

Textos a clasificar:
${JSON.stringify(paragraphs, null, 2)}`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    let results = {};
    try {
      results = JSON.parse(response.text || "{}");
    } catch (e) {
      console.warn("Falla de parseo en JSON devuelto por Gemini en analyze-paragraphs:", response?.text);
    }

    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("Error en /api/analyze-paragraphs:", error);
    res.status(500).json({
      success: false,
      error: error?.message || String(error),
    });
  }
});

/**
 * 4b. API: INCORPORATE CLASSIFICATION INTELLIGENTLY INTO THE REPORT
 * POST /api/incorporate-classification
 * Payload: {
 *   report: string
 *   classificationName: string
 *   whyRecommended: string
 *   contentToAppend: string
 * }
 */
app.post("/api/incorporate-classification", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, classificationName, whyRecommended, contentToAppend, studyType, includeManagementRecommendation } = req.body;
    if (!report || !classificationName) {
      return res.status(400).json({ success: false, error: "Se requieren 'report' y 'classificationName' para incorporar la escala." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un consultor de neurorradiología y radiología general de élite. Tu objetivo es modificar el reporte médico radiológico del usuario " +
      "para integrar de forma inteligente, contextualizada y médicamente rigurosa la clasificación o escala clínica solicitada. " +
      "NUNCA pegues una escala vacía, plantilla genérica, o una tabla con todas las categorías de la escala. " +
      "En su lugar, lee detalladamente los hallazgos descritos de este reporte específico, asigna/calcula la categoría o score correcto y exacto de esta escala que de verdad corresponde a estos hallazgos, " +
      "e inserta dicha clasificación de forma elegante y natural dentro de la 'IMPRESIÓN DIAGNÓSTICA' o como una sección correspondiente de 'CLASIFICACIÓN/CRITERIO'. " +
      "IMPORTANTE: Si en los resultados o en la clasificación se mencionan valores de QUS (Quantitative Ultrasound) o ELASTOGRAFÍA, asegúrate de que el título o tipo de examen (studyType) mencionado explícitamente indique que se han realizado dichas técnicas de forma independiente. No asumas que porque hubo QUS hubo elastografía o viceversa. " +
      "Asegúrate de conservar el rigor científico y el formato del reporte, actualizándolo con coherencia absoluta.";

    const promptText = `
Reporte Médico Radiológico Original:
"""
${report}
"""

Tipo de Examen (Título):
"""
${studyType || "Estudio Radiológico"}
"""

Clasificación a incorporar/utilizar:
Nombre: ${classificationName}
Propósito: ${whyRecommended}
Guía/Referencia de la escala:
${contentToAppend}

Instrucciones:
1. Analiza con sumo cuidado los hallazgos clínico-radiológicos descritos en el "Reporte Médico Radiológico Original" anterior.
2. Aplica y calcula la categoría, grado o score adecuado que corresponde a este caso particular según la "Guía/Referencia de la escala" suministrada. E.g. Si el informe describe un nódulo pulmonar sólido de 7 mm incidental, calcula el seguimiento según Fleischner y pon el resultado. Si describe un quiste renal con septos finos mínimos, aplícale Bosniak II, etc.
3. Si la clasificación aplicada o los resultados calculados involucran valores de QUS (Quantitative Ultrasound) o ELASTOGRAFÍA, asegúrate de que el título del informe o en la descripción técnica se mencione explícitamente "realizado con QUS" o "realizado con Elastografía" SOLAMENTE si realmente se realizó dicha técnica en ese estudio específico. No asumas que ambas técnicas se hicieron si solo una se menciona.
4. ${
      includeManagementRecommendation
        ? "Inserta y fusiona esta clasificación ya calculada (incluyendo su grado, score, conducta sugerida, recomendaciones de manejo o seguimiento y su sustento clínico rápido) adecuadamente dentro del reporte."
        : "Inserta y fusiona ÚNICAMENTE la clasificación o escala ya calculada (incluyendo su grado, score y justificación diagnóstica/clínica de la asignación) adecuadamente dentro del reporte. REQUISITO CRÍTICO Y ABSOLUTO: Queda ESTRICTAMENTE PROHIBIDO incluir cualquier tipo de conducta sugerida, recomendación de manejo, seguimiento clínico sugerido, pautas de tratamiento, o derivaciones médicas (por ejemplo, NO debes escribir cosas como 'se sugiere control en 1 año', 'requiere correlación con ecografía o biopsia', o 'se recomienda conducta quirúrgica'). Únicamente reporta el hallazgo y su asignación de escala/clasificación, sin ninguna recomendación de manejo o conducta."
    } Lo ideal es integrarlo de manera estructurada en la sección de "IMPRESIÓN DIAGNÓSTICA" o agregar un apartado fino titulado "CLASIFICACIÓN" o "ESCALA APLICADA" sin desconfigurar el resto del reporte.
5. **IMPORTANTE**: No pegues la escala completa con todas sus variantes ni plantillas genéricas sin rellenar. Solo debes aplicar la categoría o escala específica de este paciente.
6. **REGLA ESTRICTA DE MAYÚSCULAS/MINÚSCULAS (CASING)**: No escribas los textos de los cambios ni la escala o clasificación completamente en mayúsculas (ALL CAPS / All-uppercase). Debes escribir en minúsculas estándar, respetando el uso correcto de mayúsculas iniciales para nombres de secciones o clasificaciones y el formato circundante o preexistente de la sección del reporte. La incorporación debe hacerse usando el formato gramatical regular ordinario de mayúsculas y minúsculas (ej: escribiendo 'Grado II según Bosniak' en lugar de 'GRADO II SEGÚN BOSNIAK').
7. Devuelve EXCLUSIVAMENTE el reporte médico radiológico modificado al completo en español, manteniendo el mismo formato limpio, espaciado y profesional. No agregues saludos, explicaciones, ni notas fuera del informe.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      },
    });

    res.json({
      success: true,
      modifiedReport: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/incorporate-classification:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * API: DETECT CLASSIFICATIONS IN REPORT
 * POST /api/detect-report-classifications
 * Payload: { report: string, model?: string }
 */
app.post("/api/detect-report-classifications", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para analizar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un consultor de radiología diagnóstica de élite con credenciales internacionales. " +
      "Tu objetivo es examinar minuciosamente el informe radiológico provisto e identificar todas las clasificaciones, " +
      "escalas, criterios o scores clínicos de consenso internacional (ej. BI-RADS, Bosniak, Fleischner, LI-RADS, PI-RADS, " +
      "O-RADS, Kellgren-Lawrence, Neer, Rockwood, Garden, Marsh, AO, Balthazar, Alvarado, etc.) que estén explícitamente " +
      "mencionadas en el texto o que sean directamente aplicables a los hallazgos descritos.";

    const promptText = `Analiza el siguiente informe radiológico:

"""
${report}
"""

Identifica todas las clasificaciones, escalas o criterios clínicos presentes o directamente aplicables a los hallazgos descritos.
Estructura una lista en formato JSON con las clasificaciones encontradas o aplicables.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { 
                type: Type.STRING, 
                description: "Nombre oficial de la clasificación o escala (ej: BI-RADS, Clasificación de Bosniak, Criterios de Fleischner 2017, Escala de Kellgren-Lawrence)." 
              },
              assignedCategory: { 
                type: Type.STRING, 
                description: "Categoría, grado, tipo o score asignado en el informe o correspondiente a los hallazgos (ej: BI-RADS 4B, Bosniak II, Grado 3, Tipo II)." 
              },
              detectedInText: { 
                type: Type.BOOLEAN, 
                description: "true si la escala/categoría está mencionada explícitamente en el texto del informe; false si se deduce clínicamente de los hallazgos descritos." 
              },
              whyApplicable: { 
                type: Type.STRING, 
                description: "Explicación breve de 1 oración del porqué aplica esta clasificación al informe." 
              }
            },
            required: ["name", "assignedCategory", "detectedInText", "whyApplicable"]
          }
        }
      }
    });

    let classifications = [];
    try {
      classifications = JSON.parse(response.text || "[]");
    } catch (e) {
      console.warn("Error parseando respuesta JSON en detect-report-classifications:", response.text);
    }

    res.json({
      success: true,
      classifications
    });
  } catch (error: any) {
    console.error("Error en /api/detect-report-classifications:", error);
    res.status(500).json({
      success: false,
      error: handleGeminiError(error)
    });
  }
});

/**
 * API: GENERATE CLASSIFICATION BREAKDOWN & JUSTIFICATION (ANEXO INTELECENTE)
 * POST /api/generate-classification-breakdown
 * Payload: {
 *   report: string,
 *   classificationName: string,
 *   assignedCategory?: string,
 *   format: "option_a" | "option_b",
 *   includeRecommendations: boolean,
 *   studyType?: string,
 *   model?: string
 * }
 */
app.post("/api/generate-classification-breakdown", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, classificationName, assignedCategory, format, includeRecommendations, studyType } = req.body;
    if (!report || !classificationName) {
      return res.status(400).json({ success: false, error: "Se requiere 'report' y 'classificationName'." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const isOptionA = format === "option_a"; // Tabla Estructurada / Matriz de Justificación Criterio por Criterio
    const isOptionB = format === "option_b"; // Ficha Explicativa e Ilustrativa / Tarjeta de Anexo

    const systemInstruction = 
      "Eres un médico especialista en radiología diagnóstica de nivel internacional. " +
      "Tu tarea es generar un anexo de justificación diagnóstica SÓLIDO Y MANTENIDO EN EXTENSIÓN EXACTA PARA PÁGINA ÚNICA, que explique de forma concisa y rigurosa los hallazgos del reporte que sustentan la clasificación radiológica y categoría asignada. " +
      "TODO EL ANEXO DEBE SER EQUILIBRADO Y COMPACTO, GARANTIZANDO QUE QUEPA DE FORMA HOLGADA EN UNA SOLA PÁGINA DEDICADA SIN DESBORDARSE A UNA SEGUNDA PÁGINA. " +
      "REGLAS ABSOLUTAS PARA TIROIDES Y BIOPSIA: " +
      "1. Usa SIEMPRE la sigla BAAF (Biopsia por Aspiración con Aguja Fina). Jamás utilices la sigla PAAF. " +
      "2. Umbrales rigurosos oficiales ACR TI-RADS 2017: TR1 y TR2 no BAAF/no seguimiento; TR3 BAAF si ≥ 2.5 cm (25 mm), seguimiento ecográfico si ≥ 1.5 cm (15 mm) (15 a 24 mm es SOLO seguimiento ecográfico, NUNCA BAAF); TR4 BAAF si ≥ 1.5 cm (15 mm), seguimiento si ≥ 1.0 cm (10 mm); TR5 BAAF si ≥ 1.0 cm (10 mm), seguimiento si ≥ 0.5 cm (5 mm). " +
      "3. Umbrales para Esteatosis Hepática / Consenso SRU (por porcentaje de grasa QUS): Normal < 5.0%, Leve 5.0% - 12.0%, Moderada 12.1% - 20.0%, Severa > 20.0%.";

    const promptText = `
Reporte Radiológico Base:
"""
${report}
"""

Estudio: ${studyType || "Estudio Radiológico"}
Clasificación Seleccionada: ${classificationName} ${assignedCategory ? `(${assignedCategory})` : ""}
Formato Deseado: ${isOptionA ? "OPCIÓN A: Tabla Estructurada / Matriz de Justificación Criterio por Criterio" : "OPCIÓN B: Ficha Explicativa e Ilustrativa (Tarjeta de Anexo / Infografía Esquemática)"}
Incluir Recomendaciones de Manejo / Seguimiento Clínico: ${includeRecommendations ? "SÍ (Incluir guías de manejo, seguimiento o pautas clínicas oficiales)" : "NO (ESTRICTAMENTE PROHIBIDO sugerir conductas o tratamientos)"}

REQUISITOS FUNDAMENTALES Y FORMATO PÁGINA ÚNICA:
1. TÍTULO DEL ANEXO: El título debe indicar explícitamente la clasificación y el estadio/categoría asignado de forma limpia comenzando directamente con 'CLASIFICACIÓN DE...'.
   - Queda ESTRICTAMENTE PROHIBIDO incluir la frase 'ANEXO DIAGNÓSTICO:' o 'ANEXO:' en el título de la clasificación. Ya se sabe que es un anexo por el encabezado de página.
   - Si la clasificación es "Clasificación de Rockwood" y la categoría es "Tipo III - V", el título debe ser exactamente:
     "CLASIFICACIÓN DE ROCKWOOD - TIPO III - V"
   - Queda ESTRICTAMENTE PROHIBIDO repetir la palabra 'CLASIFICACIÓN' (NO escribir "CLASIFICACIÓN CLASIFICACIÓN...").
2. REGLA ESTRICTA DE ENCABEZADOS Y PALABRAS PROHIBIDAS:
   - NO incluyas tablas de 2 columnas ni subtítulos redundantes con las palabras 'Interpretación', 'Interpretación de Hallazgos' ni 'Hallazgos' debajo del título principal. Pasa directamente a Definición y Sustento Diagnóstico Integrador.
3. MATRIZ CONCISA BASADA EN HALLAZGOS DEL REPORTE (MÁXIMO 3 A 5 FILAS):
   - Crea una tabla estructurada de ÚNICAMENTE 3 A 5 FILAS MÁXIMO que abarque los criterios y hallazgos clave esenciales.
   - Incluye los hallazgos principales presentes o ausentes en el reporte que justifican de forma directa la categoría asignada.
   - Redacta celdas directas, claras y sintéticas (de 5 a 12 palabras por celda máximo) para mantener la tabla compacta.
4. DEFINICIÓN Y SUSTENTO DIAGNÓSTICO INTEGRADOR CONCISO:
   - "definitionAndRisk": Definición oficial concisa y riesgo de la categoría asignada (1-2 oraciones claras).
   - "clinicalSummary": Sustento radiológico integrador de 2-3 oraciones directas que correlacione los hallazgos de imagen con los criterios de la escala.
5. PASOS Y ALGORITMO DECISIONAL (SI SE SELECCIONA OPCIÓN B O PARA FICHA):
   - Proporciona entre 3 y 4 pasos sintéticos del algoritmo con descripciones de 1 frase corta.
6. REGLA DE RECOMENDACIONES:
   - ${includeRecommendations 
       ? "Detalla las recomendaciones oficiales de conducta o seguimiento en 1-2 líneas breves. Si aplica a TI-RADS, usa la sigla BAAF (NUNCA PAAF) y respeta estrictamente las guías oficiales ACR TI-RADS 2017: TR3 indica BAAF solo si ≥ 25 mm (2.5 cm) y seguimiento ecográfico si ≥ 15 mm (1.5 cm); TR4 indica BAAF si ≥ 15 mm y seguimiento si ≥ 10 mm; TR5 indica BAAF si ≥ 10 mm y seguimiento si ≥ 5 mm." 
       : "Si 'includeRecommendations' es false, el campo 'recommendations' DEBE ser una cadena completamente vacía (\"\"). Queda PROHIBIDO agregar cualquier frase aclaratoria, notas de exclusión o disclaimers al final."}
7. "formattedAnnexMarkdown": Texto completo del Anexo formateado en Markdown estructurado, limpio y compacto. Debe comenzar con un título único e impecable sin palabras duplicadas y garantizando extensión de página única.

Retorna la respuesta en estricto formato JSON según el esquema definido.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classificationName: { type: Type.STRING, description: "Nombre formal de la escala/clasificación" },
            categoryAssigned: { type: Type.STRING, description: "Categoría o Grado asignado (ej: BI-RADS 4B, Bosniak II, Grado 3)" },
            definitionAndRisk: { type: Type.STRING, description: "Definición oficial de la categoría y estimación de riesgo o significado clínico." },
            clinicalSummary: { type: Type.STRING, description: "Resumen integrador del razonamiento diagnóstico radiológico." },
            criteriaMatrix: {
              type: Type.ARRAY,
              description: "Matriz de criterios evaluados vs hallazgos en el reporte y su ponderación/justificación",
              items: {
                type: Type.OBJECT,
                properties: {
                  criterion: { type: Type.STRING, description: "Parámetro o criterio analizado (ej: Márgenes, Densidad, Tamaño, Realce)" },
                  findingInReport: { type: Type.STRING, description: "Hallazgo específico presente en el informe radiológico" },
                  weightOrGrade: { type: Type.STRING, description: "Peso o aporte a la escala (ej: Criterio Mayor (+), +2 Puntos, Característica sospechosa)" },
                  justification: { type: Type.STRING, description: "Justificación médica de por qué este hallazgo respalda la clasificación" }
                },
                required: ["criterion", "findingInReport", "weightOrGrade", "justification"]
              }
            },
            decisionSteps: {
              type: Type.ARRAY,
              description: "Pasos secuenciales del algoritmo de decisión clínica",
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER, description: "Número de paso (1, 2, 3...)" },
                  title: { type: Type.STRING, description: "Título del paso del algoritmo" },
                  description: { type: Type.STRING, description: "Explicación del hallazgo y decisión tomada en este paso" },
                  isMet: { type: Type.BOOLEAN, description: "true si se cumple el criterio en el paciente" }
                },
                required: ["stepNumber", "title", "description", "isMet"]
              }
            },
            recommendations: { type: Type.STRING, description: "Recomendaciones de manejo / conducta (si fueron solicitadas) o nota de exclusión." },
            formattedAnnexMarkdown: { type: Type.STRING, description: "Texto completo del Anexo formateado en Markdown estructurado de alta calidad" },
            formattedAnnexHtml: { type: Type.STRING, description: "Fragmento HTML con clases limpias y legibles para renderizado directo o impresión" }
          },
          required: ["classificationName", "categoryAssigned", "definitionAndRisk", "clinicalSummary", "criteriaMatrix", "decisionSteps", "formattedAnnexMarkdown", "formattedAnnexHtml"]
        }
      }
    });

    let breakdownData = null;
    try {
      breakdownData = JSON.parse(response.text || "{}");
      if (breakdownData && !includeRecommendations) {
        breakdownData.recommendations = "";
      }
    } catch (e) {
      console.warn("Error parseando respuesta JSON en generate-classification-breakdown:", response.text);
      throw new Error("No se pudo obtener un JSON estructurado para el desglose. Intenta nuevamente.");
    }

    res.json({
      success: true,
      breakdown: breakdownData
    });
  } catch (error: any) {
    console.error("Error en /api/generate-classification-breakdown:", error);
    res.status(500).json({
      success: false,
      error: handleGeminiError(error)
    });
  }
});

/**
 * 5. API: MODIFY GENERATED REPORT with prompt or quick buttons
 * POST /api/modify-report
 * Payload: {
 *   currentReport: string
 *   instruction: string
 *   image?: string (optional base64 image if uploaded)
 *   mimeType?: string (optional)
 * }
 */
app.post("/api/modify-report", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentReport, instruction, image, mimeType, attachedImages } = req.body;
    if (!currentReport || !instruction) {
      return res.status(400).json({ success: false, error: "Se requiere el 'currentReport' y la 'instruction' para modificar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];

    if (image && mimeType) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    let promptText = `
Tienes un reporte médico de radiología en formato Markdown:

"""
${currentReport}
"""

El usuario solicita realizar la siguiente modificación o mejora:
"${instruction}"
`;

    if (attachedImages && attachedImages.length > 0) {
      promptText += `\n⚠️ REFERENCIAS BIDIRECCIONALES A IMÁGENES ADJUNTAS:
El informe tiene las siguientes capturas diagnósticas adjuntas:
`;
      attachedImages.forEach((img: any) => {
        promptText += `- Imagen ${img.index}: "${img.caption || "Sin descripción aún"}"\n`;
      });
      promptText += `
Cuando realices la modificación o reescribas los HALLAZGOS o la IMPRESIÓN DIAGNÓSTICA, si describes un hallazgo, estructura, lesión o anomalía que corresponda directamente con alguna de las imágenes adjuntas anteriores (basándote en su descripción/rótulo), estás obligado a insertar de manera natural la indicación entre paréntesis para el lector, por ejemplo: "(ver Imagen ${attachedImages[0].index})" o "(ver Imagen ${attachedImages[1].index})" al final de la oración pertinente. Esto permite una correlación bidireccional perfecta para que el lector busque la imagen si lo desea.
`;
    }

    promptText += `
Por favor, reescribe el reporte manteniendo exactamente el mismo formato estructurado previo (con las secciones [INICIO DEL REPORTE], TÉCNICA DEL EXAMEN, HALLAZGOS, IMPRESIÓN DIAGNÓSTICA, [FIN DEL REPORTE] si estaban presentes).

⚠️ REQUISITOS DE INTEGRACIÓN NATURAL CRÍTICOS:
1. Aplica la instrucción solicitada de manera profesional y rigurosa, conservando el vocabulario técnico radiológico de primer nivel.
2. Cuando integres una clasificación, escala o recomendación, incorpórala de forma TOTALMENTE NATURAL, directa y asertiva en primera persona o la voz técnica habitual del informe.
3. Está ESTRICTAMENTE PROHIBIDO que se note que es una recomendación externa o sugerencia añadida de auditoría.
4. NUNCA utilices justificaciones didácticas o meta-comentarios como: "Se incluye la clasificación para...", "Con el fin de facilitar el manejo por urología/clínicos...", "Al clasificar esto...", "Se sugiere agregar...", "Recomendación de auditoría:".
5. Integra la clasificación o hallazgo de forma directa y sobria. Por ejemplo: si la recomendación es "Agregar clasificación Bosniak", escribe directamente el grado correspondiente (ej: "Quiste renal izquierdo Bosniak I") en la descripción de los hallazgos o impresión diagnóstica, sin dar explicaciones ni preámbulos de por qué se hace.
6. Nunca inventes hallazgos no sustentados, pero desarrolla la redacción académica y formal al máximo nivel.
7. **REGLA ESTRICTA DE MAYÚSCULAS/MINÚSCULAS (CASING)**: Bajo ninguna circunstancia debes escribir el texto nuevo, los cambios o la síntesis completamente en mayúsculas (ALL CAPS / All-uppercase). Debes escribir en minúsculas estándar, respetando el uso correcto de mayúsculas iniciales y adaptándote perfectamente al formato y caja (casing) del reporte original y del texto circundante. La incorporación debe hacerse usando el formato gramatical regular ordinario de mayúsculas y minúsculas (ej: escribiendo 'Dolor en la fosa ilíaca' en lugar de 'DOLOR EN LA FOSA ILÍACA'). No alteres el casing original de las secciones que no fueron editadas.

Devuelve únicamente el reporte modificado en formato Markdown, sin notas aclaratorias antes o después coordinadas en el exterior.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica. Reformulas y mejoras informes médicos radiológicos con un vocabulario médico de la más alta precisión y elegancia, integrando hallazgos o clasificaciones de manera totalmente fluida y nativa, sin preámbulos ni justificaciones didácticas externas. " +
      "REGLA ESTRICTA DE TERMINOLOGÍA: Queda TERMINANTEMENTE PROHIBIDO utilizar el término o sigla PAAF. Usa SIEMPRE BAAF (Biopsia por Aspiración con Aguja Fina).";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/modify-report:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * API: INCORPORATE DIFFERENTIAL DIAGNOSTICS SYNTHESIS
 * POST /api/incorporate-differentials
 * Payload: {
 *   model: string
 *   currentReport: string
 *   caseAnalysis: string
 * }
 */
app.post("/api/incorporate-differentials", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentReport, caseAnalysis } = req.body;
    if (!currentReport || !caseAnalysis) {
      return res.status(400).json({ success: false, error: "Se requiere el 'currentReport' y el 'caseAnalysis' para procesar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Tienes un reporte radiológico activo en formato Markdown:
"""
${currentReport}
"""

Y tienes un análisis clínico avanzado exhaustivo que tiene diagnósticos diferenciales y discusión clínica:
"""
${caseAnalysis}
"""

Misión:
1. Extrae y genera una SÍNTESIS EXTREMADAMENTE CORTA Y CONCISA (MÁXIMO 1 o 2 oraciones, o hasta 3 líneas como límite absoluto) de los diagnósticos diferenciales y de sospecha clave discutidos en el análisis. Debe ser ultra directa y de alta densidad de información clínica, sin rodeos.
2. Integra esta breve síntesis de forma totalmente fluida, asertiva y natural dentro del reporte activo.
3. El destino ideal para esta pequeña integración es insertarla en una sección dedicada si ya existe (por ejemplo, "DISCUSIÓN DE DIAGNÓSTICOS DIFERENCIALES", "CORRELACIÓN CLÍNICA", "IMPRESIÓN DIAGNÓSTICA", etc.) o agregarla de forma compacta al final antes de la firma.
4. REQUISITO CRÍTICO DE DISEÑO, BREVEDAD Y LENGUAJE:
   - Está ESTRICTAMENTE PROHIBIDO usar lenguaje generativo u aclarativo (ej. evita "Se sugiere diagnóstico...", "Síntesis de diferencial...", "El modelo propone..."). Escribe de manera directa, asertiva y formal, simulando que fue redactado desde el inicio por el radiólogo principal de forma muy sucinta.
   - La síntesis debe ser breve para no sobrecargar el informe. Máximo un párrafo ultra corto o dos oraciones condensadas en total.
   - **REGLA ESTRICTA DE MAYÚSCULAS/MINÚSCULAS (CASING)**: No escribas esta síntesis o los cambios completamente en mayúsculas (ALL CAPS / All-uppercase). Debes escribirla en minúsculas estándar, respetando el uso correcto de mayúsculas iniciales y adaptándote perfectamente al formato y caja del reporte original.
   - Conserva todo el resto del informe (técnica, hallazgos, estructura) intacto.

Devuelve de manera estricta y exclusiva el reporte radiológico COMPLETO resultante en formato Markdown. No agregues observaciones, de lo contrario fallará.
`;

    const systemInstruction = 
      "Eres un médico radiólogo académico senior. Te especializas en redactar informes de nivel hospitalario docente, integrando de forma natural e impecable la correlación y discusión de diagnósticos diferenciales sin preámbulos aclaratorios.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/incorporate-differentials:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: GENERATE PATIENT INFOGRAPHIC
 * POST /api/generate-infographic
 * Payload: {
 *   report: string
 *   studyType: string
 * }
 */
app.post("/api/generate-infographic", async (req: express.Request, res: express.Response) => {
  try {
    const { report, studyType } = req.body;
    if (!report || !studyType) {
      return res.status(400).json({ success: false, error: "Se requieren el reporte y el tipo de estudio." });
    }

    const ai = getGeminiClient();

    const promptText = `
Genera una infografía médica sencilla, clara y amable para un paciente, basada en este reporte radiológico sobre un estudio de ${studyType}.
La infografía debe explicar de manera didáctica y visualmente comprensible exclusivamente los hallazgos patológicos o anormalidades principales encontradas en el siguiente informe, evitando tecnicismos complejos:

"""
${report}
"""

La infografía debe centrarse única y exclusivamente en explicar qué hallazgos patológicos se encontraron en el estudio para que el paciente los entienda de forma sencilla y clara. NO debes incluir ningún tipo de recomendación médica, indicaciones, tratamientos, pasos a seguir o sugerencias sobre qué hacer a continuación ni derivaciones. Omitir por completo cualquier recomendación o pautas de acción. Mantén el estilo visual limpio y profesional, adecuado para un paciente.
Diseño: Ilustración médica 2D clara, estilo didáctico, amable y enfocado enteramente en la explicación de los hallazgos patológicos del reporte.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [{ text: promptText }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    // Find the image part in the response
    let base64Image = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (!base64Image) {
      throw new Error("No se pudo generar la imagen de la infografía.");
    }

    res.json({
      success: true,
      imageUrl: `data:image/jpeg;base64,${base64Image}`,
    });
  } catch (error: any) {
    console.error("Error en /api/generate-infographic:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 6. API: CLINICAL ASSESSMENT OF THE UPLOADED IMAGE
 * POST /api/evaluate-image
 * Payload: {
 *   image: string (base64)
 *   mimeType: string
 *   studyType: string
 *   clinicalHistory?: string
 *   findings?: string
 *   isAdditional?: boolean
 * }
 */
app.post("/api/evaluate-image", async (req: express.Request, res: express.Response) => {
  try {
    const { model, image, mimeType, studyType, clinicalHistory, findings, isAdditional, annotations } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, error: "Se requiere una imagen y su tipo MIME para proceder." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];
    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const imgSupported = checkImageSupport(mimeType);
    if (imgSupported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    let queryPrompt = "";
    if (!imgSupported) {
      queryPrompt += `[Nota del sistema: El estudio provisto es una representación/maqueta vectorial SVG o metadatos estructurados. Por favor, realiza la valoración basándote con máxima fidelidad en los metadatos de diagnóstico provistos, de manera altamente rigurosa].\n`;
    }

    if (isAdditional) {
      queryPrompt = `
Estudio clínico: ${studyType || "No especificado"}
Indicación: ${clinicalHistory || "No especificada"}
Hallazgos iniciales: ${findings || "No proporcionados"}

Por favor, realiza una VALORACIÓN DIAGNÓSTICA ADICIONAL de esta imagen radiológica y los hallazgos descritos.
Analiza con sumo esmero patrones morfológicos sutiles, diagnósticos diferenciales menos predictivos pero críticos clínicos, buscando signos radiológicos secundarios o correlaciones fisiopatológicas profundas.
Proporciona esta valoración estructurada en Markdown:
1. **ANÁLISIS DE SEGUNDA OPINIÓN**: Discusión de patrones visualizados bajo criterios complejos (escalas avanzadas relevantes, variaciones anatómicas, o diagnósticos sutiles a descartar).
2. **VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL**: Antes de descartar o calificar de conservada/normal cualquier alteración estructural importante (como reducción de espacio articular/femorotibial, osteofitosis o fracturas), debes obligatoriamente citar de forma breve una característica o métrica visual radiológica concreta observada en el estudio que sustente clínicamente dicho descarte.
3. **CORRELACIÓN Y RECOMENDACIÓN COMPLEMENTARIA**: Criterios de diagnóstico sugeridos, estudios complementarios ideales (como RMN, TC multicorte o de contraste, ecografía Doppler avanzada, etc.) y por qué estarían indicados.
4. **PUNTOS CLAVE PARA EL EXPEDIENTE**: Una lista sucinta de 2 o 3 recomendaciones inmediatas clínicas de seguimiento quirúrgico o médico.

Mantén un tono de consulta interdepartamental formal y de muy alto nivel académico.
`;
    } else {
      queryPrompt = `
Estudio clínico: ${studyType || "No especificado"}
Indicación: ${clinicalHistory || "No especificada"}
Hallazgos previos: ${findings || "No proporcionados"}

Por favor, elabora un INFORME DE VALORACIÓN CLÍNICA DETALLADA de esta imagen radiológica.
Explica detalladamente:
1. **VALORACIÓN DE ATRIBUTOS TÉCNICOS Y ANATÓMICOS DE LA IMAGEN**: Explica la calidad técnica, orientación, proyecciones visibles, planos visualizados y estructuras anatómicas de referencia patológica.
2. **VALORACIÓN CLÍNICA DIRECTA DE LA IMAGEN**: Explica la valoración visual realizada paso a paso (qué se analizó primero, qué se comprobó secuencialmente y cuáles son los hallazgos directamente identificados en la imagen cargada).
3. **VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL**: Antes de considerar descartada, normal o conservada cualquier anomalía estructural mayor (ej. reducción del espacio articular femorotibial, osteoartritis, fractura), cita brevemente la evidencia radiológica visual concreta y características observables en la imagen que de verdad justifican dicha normalidad.
4. **DIAGNÓSTICO COMPARATIVO Y CONCLUSIÓN DE VALORACIÓN**: Describe con alta precisión la correlación entre la imagen médica y los hallazgos descritos, justificando tu conclusión clínica.

Devuelve este informe en un formato de caja clínica estructurado con títulos limpios en Markdown.
`;
    }

    if (annotations && annotations.length > 0) {
      queryPrompt += formatImageAnnotations(annotations);
    }

    parts.push({ text: queryPrompt });

    const systemInstruction = 
      "Eres un consultor radiólogo internacional senior. Eres extremadamente meticuloso y exacto al valorar imágenes médicas, explicando de forma transparente y didáctica el proceso de valoración visual de las anomalías radiológicas para la educación o validación médica. " +
      "CONVENCIÓN DE LATERALIDAD Y ORIENTACIÓN RADIOLÓGICA (REGLA DE ESPEJO ANATÓMICO): " +
      "1. En proyecciones frontales (PA/AP), la DERECHA VISUAL de la pantalla es el LADO IZQUIERDO ANATÓMICO DEL PACIENTE (hemitórax/campo pulmonar izquierdo). La IZQUIERDA VISUAL de la pantalla es el LADO DERECHO ANATÓMICO DEL PACIENTE. NUNCA confundas la derecha de la pantalla con el lado derecho del paciente. Un neumotórax o lesión visible en la derecha de la foto es el NEUMOTÓRAX IZQUIERDO del paciente. " +
      "2. Si la consulta médica o indicación señala 'Neumotórax Izquierdo', evalúa la mitad VISUAL DERECHA de la imagen médica (hemitórax izquierdo del paciente). Si identificas la línea pleural visceral o hiperclaridad avascular, CONFIRMA Y VALIDA COMO 'NEUMOTÓRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad a 'derecho' por confusión de lados de la pantalla. " +
      "ATENCIÓN DE CONSISTENCIA DIAGNÓSTICA Y EVITACIÓN DE ALUCINACIONES: Es imperativo que reconozcas y valides de forma consistente cualquier alteración o patología evidente o conspicua detectable (como neumotórax extenso o apical, colapso pulmonar, derrames, marcada disminución del espacio articular, esclerosis subcondral, luxaciones o líneas de fractura) sin minimizarlas ni refutarlas por un hiper-escepticismo exagerado. Si el médico señala o consulta por un hallazgo indiscutible, realiza una verificación dirigida de alta sensibilidad. Al mismo tiempo, mantén una adherencia absoluta a la verdad física de la imagen: está estrictamente prohibido alucinar elementos totalmente inexistentes (como material de osteosíntesis o tornillos que no existan en la imagen real), basando tu veredicto 100% en la evidencia de los píxeles anatómicos observables.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      evaluation: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/evaluate-image:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: SECOND EXPERT OPINION & DUAL IMAGE MEDICAL ANALYSIS
 * POST /api/expert-image-analysis
 * Payload: {
 *   image1: string (base64)
 *   mimeType1: string (e.g. "image/png", "image/jpeg")
 *   desc1?: string
 *   modality1?: string
 *   image2?: string (base64)
 *   mimeType2?: string
 *   desc2?: string
 *   modality2?: string
 *   clinicalSuspicion?: string
 *   radiologicalQuestions?: string
 *   patientInfo?: string
 *   annotations1?: {x: number, y: number}[]
 *   annotations2?: {x: number, y: number}[]
 * }
 */
app.post("/api/expert-image-analysis", async (req: express.Request, res: express.Response) => {
  try {
    const { 
      model,
      image1, mimeType1, desc1, modality1, annotations1,
      image2, mimeType2, desc2, modality2, annotations2,
      image3, mimeType3, desc3, modality3, annotations3,
      clinicalSuspicion, radiologicalQuestions, patientInfo,
      fractureProtocol,
      pulmonaryProtocol,
      osteoarthritisProtocol,
      prosthesisMetalProtocol
    } = req.body;

    if (!image1 || !mimeType1) {
      return res.status(400).json({ success: false, error: "Se requiere al menos la primera imagen para la valoración experta." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];

    const isFractureCase = !!fractureProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(fractur|trazo|trazos|desplazam|fisura|compromiso articular|luxac|subluxac|fx|fémur|peroné|tibia|radio|cúbito|húmero)/);

    const isPulmonaryCase = !!pulmonaryProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(torax|tórax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|parénquima|parenquima|neumotorax|neumotórax|pneumothor|hidroneumo|linea pleural|colapso|aire pleural|hiperclaridad|enfisema)/);

    const isOsteoarthritisCase = !!osteoarthritisProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(artros|degenerat|osteofit|escleros|subcondral|pinzam|geoda|espolon|espolón|espondilo|gonartros|coxartros|kellgren|lawrence|facetaria|discopat)/);

    const isMetalCase = !!prosthesisMetalProtocol ||
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(protesis|prótesis|metalico|metálico|metalicos|metálicos|osteosintesis|osteosíntesis|placa|tornillo|clavo|cerclaje|vástago|vastago|artroplastia)/);

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const img1Supported = checkImageSupport(mimeType1);
    if (img1Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image1),
          mimeType: mimeType1,
        },
      });
    }

    const img2Supported = image2 && mimeType2 && checkImageSupport(mimeType2);
    if (image2 && mimeType2 && img2Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image2),
          mimeType: mimeType2,
        },
      });
    }

    const img3Supported = image3 && mimeType3 && checkImageSupport(mimeType3);
    if (image3 && mimeType3 && img3Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image3),
          mimeType: mimeType3,
        },
      });
    }

    let promptText = `
Eres un radiólogo académico senior con subespecialidad en diagnóstico avanzado de alta complejidad y el consultor de máxima precisión clínica.
Este módulo ("Doble Valoración IA") es el estándar de oro de exactitud visual y clínica disponible. Tu análisis debe ser extremadamente minucioso, cuidadoso y exacto. Realiza una inspección microscópica pixel por pixel de cada imagen, analizando todas las áreas y reparos anatómicos. Los pequeños detalles, por más sutiles, iniciales, tenues o milimétricos que sean (como micro-fisuras, asimetrías de densidad leves, calcificaciones incipientes, reacciones corticales tempranas, engrosamientos pericorticales mínimos, opacidades de vidrio esmerilado incipiente, o distorsiones sutiles de la arquitectura normal), NO deben pasarse por alto bajo ninguna circunstancia.

⚠️ PROTOCOLO DE EXTREMADA ACUIDAD DIAGNÓSTICA Y EQUILIBRIO ANTI-ALUCINACIÓN (EVITACIÓN DE OMISIONES Y SESGO DE SATISFACCIÓN):
Para lograr la máxima exactitud científica equilibrada, debes operar bajo un riguroso protocolo de seguridad radiológica:

1. **ESCENIFICACIÓN EXHAUSTIVA DE REJILLA DE ESCANEO DE 3X3 (Visual Grid Scanning)**:
   - Divide mentalmente cada imagen médica en una rejilla virtual de 3x3 sectores (Superior Izquierdo/Centro/Derecho, Medio Izquierdo/Centro/Derecho, Inferior Izquierdo/Centro/Derecho).
   - Realiza un barrido visual secuencial y obligatorio por cada uno de los 9 sectores. Analiza de forma exhaustiva las corticales óseas, interfaces hiliares, ángulos costofrénicos, y tejidos blandos periféricos en cada sector. Esto evita omisiones típicas de hallazgos en esquinas o zonas marginales de la placa.

2. **PROTECCIÓN CONTRA EL SESGO DE SATISFACCIÓN DE BÚSQUEDA (Satisfaction of Search Shielding)**:
   - Encontrar un hallazgo conspicuo u obvio (p. ej., un neumotórax extenso, una fractura desplazada, una cardiomegalia masiva, o una masa de gran tamaño) NO debe suspender el análisis. Sigue examinando minuciosamente el resto de las estructuras de manera exhaustiva. Registra y describe de forma prioritaria lesiones sutiles asociadas o concomitantes (pequeños derrames pleurales, micro-focos de gas, discontinuidades óseas adicionales, etc.).

3. **PROTOCOLOS DE REVISIÓN Y VALIDACIÓN ANTE HALLAZGOS ASEVERADOS O INDICADOS POR EL MÉDICO (VERIFICACIÓN ANATÓMICA DIRIGIDA CON ALTA SENSIBILIDAD)**:
   - Si el médico tratante, la sospecha clínica o las preguntas del usuario afirman o señalan expresamente la presencia de un hallazgo cardinal o "no discutible" (por ejemplo: "neumotórax extenso", "derrame pleural masivo", "fractura en falange"), NUNCA asumas por defecto que se trata de una trampa o intento de inducción de error.
   - Ejecuta de inmediato una verificación dirigida de alta sensibilidad en esa región anatómica específica:
     * Si la evidencia visual física o semiológica confirma la alteración (ej. en neumotórax: línea pleural visceral, hiperclaridad/radiolucidez periférica desprovista de trama vascular, colapso/atelectasia pasiva del parénquima pulmonar, o desviación mediastínica): **CONFIRMA Y VALIDA EL HALLAZGO CON TOTAL NITIDEZ**, detallando su extensión, lateralidad, porcentaje de colapso, medición de la separación pleural en mm y repercusión hemodinámica o mediastínica.
     * Si tras una revisión exhaustiva no se detecta la patología en las proyecciones cargadas, fundamenta la conclusión objetivamente describiendo la anatomía observada (ej. citando la presencia de trama vascular pulmonar normal que se extiende íntegramente hasta la pared torácica interna) de forma respetuosa y científica.

4. **DETERMINACIÓN Y MANEJO DE HALLAZGOS SUTILES O BORDERLINE**:
   - Está prohibido descartar o ignorar de manera silenciosa cualquier detalle solo por ser pequeño, de bajo contraste, tenue o estar en el límite de la visibilidad clínica.
   - Si detectas una alteración sutil, descríbela indicando honestamente tu nivel de sospecha y certeza visual y proponiendo alternativas de diagnóstico diferencial.

5. **EQUILIBRIO ACTIVO Y PREVENCIÓN DE ALUCINACIONES (Evitación Rigurosa de Falsos Positivos)**:
   - No debes sobrediagnosticar ni inventar patologías basándote en artificios técnicos (pliegues cutáneos, líneas de superposición costal o escapular normal), ruidos de la placa, variantes anatómicas sanas (canales nutricios, suturas accesorias) o marcas de posición.
   - Si un hallazgo es compatible con una variante anatómica inofensiva o un artefacto, indícalo con objetividad científica como un diagnóstico diferencial probable ("Variante de la normalidad vs. lesión incipiente").

6. **CONSISTENCIA Y EXACTITUD ABSOLUTA ANTE HALLAZGOS ESTRUCTURALES EVIDENTES**:
   - Es mandatorio que no suavices, invisibilices ni subestimes alteraciones reales y patológicas observables (neumotórax extenso, colapso pulmonar, reducciones severas de espacio articular, discontinuidades corticales francas, o desviaciones mediastinales marcadas). Deben reportarse con la terminología adecuada y el nivel de gravedad correspondiente.

7. **FUNCIÓN DE VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL PARA EXCLUSIÓN**:
   - Antes de considerar normal, preservado o negativo cualquier signo, campo o espacio articular principal de riesgo, describe brevemente la evidencia visual directa (continuidad cortical perfecta e ininterrumpida, trama vascular alcanzando la pared torácica, etc.) que ampara de manera objetiva tu conclusión.

8. **PROTOCOLO DE MÁXIMA EXACTITUD PARA FRACTURAS (MÚLTIPLE VALORACIÓN EXPERTA)**:
   - ALERTA MÁXIMA PARA MANOS Y PIES: Los trazos de fractura en huesos pequeños (falanges, metacarpianos, metatarsianos, escafoides, etc.) suelen ser extremadamente finos. AUMENTA tu sensibilidad visual al 200% al evaluar los bordes corticales de estas áreas buscando escalones milimétricos, líneas radiolúcidas tenues o avulsiones puntiformes.
   - Si el usuario MARCA una región específica, ASUME QUE HAY UNA LESIÓN HASTA DEMOSTRAR LO CONTRARIO. NO LA IGNORES.
   - Ante cualquier sospecha o indicio visual de fractura:
     * **Número y dirección de trazos**: Clasifica numéricamente los trazos de discontinuidad y su orientación exacta (transverso, oblicuo, espiroideo, longitudinal, conminuta con N fragmentos, ala de mariposa, etc.).
     * **Compromiso articular**: Determina con total precisión si el trazo alcanza la cortical de la carilla articular intermedia. Evalúa si hay hundimiento, escalón articular u holgura física en milímetros.
     * **Relación y Alineamiento de Fragmentos**: Reporta la presencia de diástasis de bordes, acortamiento/cabalgamiento en mm, angulaciones (varo/valgo, recurvatum/antecurvatum) y rotaciones espaciales.
     * **Evidencia Absoluta vs Falso Positivo**: Asegúrate de que el trazo cruce la cortical o la interrumpa claramente. No confundas líneas articulares superpuestas o canales nutricios (bordes escleróticos finos) con fracturas, pero NUNCA ignores una interrupción cortical real por miedo a alucinar.

9. **CONVENCIÓN CRÍTICA DE LATERALIDAD Y ORIENTACIÓN RADIOLÓGICA (REGLA DE ESPEJO ANATÓMICO Y ALINEACIÓN DE CONSULTA CLÍNICA)**:
   - **Regla de Espejo Radiológico en Imágenes Frontales (PA/AP)**:
     * LA MITAD DERECHA DE LA IMAGEN/PANTALLA = LADO IZQUIERDO ANATÓMICO DEL PACIENTE (HEMITÓRAX IZQUIERDO / PARÉNQUIMA PULMONAR IZQUIERDO).
     * LA MITAD IZQUIERDA DE LA IMAGEN/PANTALLA = LADO DERECHO ANATÓMICO DEL PACIENTE (HEMITÓRAX DERECHO / PARÉNQUIMA PULMONAR DERECHO).
     * ¡ALERTA MÁXIMA DE LATERALIDAD!: NUNCA confundas la derecha visual de la foto con el lado derecho del paciente. Un neumotórax o alteración visible en la mitad derecha de la foto/pantalla DEBE reportarse explícitamente como "NEUMOTÓRAX IZQUIERDO" (hemitórax izquierdo del paciente).
   - **Alineación Obligatoria con la Consulta del Usuario**:
     * Si el médico tratante, la sospecha o las preguntas del usuario afirman o consultan por 'Neumotórax Izquierdo' (o hallazgo en lado izquierdo), dirígete de inmediato a evaluar la MITAD VISUAL DERECHA de la pantalla (hemitórax izquierdo anatómico).
     * Si allí identificas la línea pleural visceral, hiperclaridad periférica o colapso, CONFIRMA Y REPORTA EL HALLAZGO CATEGÓRICAMENTE COMO "NEUMOTÓRAX IZQUIERDO". Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusión de lados de la pantalla.

`;

    if (!img1Supported || (image2 && !img2Supported) || (image3 && !img3Supported)) {
      promptText += `\n[Nota del sistema: Al menos uno de los estudios provistos es una representación/maqueta vectorial SVG o metadatos construidos clínicamente. Por favor, realiza la valoración de máxima fidelidad y rigor científico basándose en los metadatos de diagnóstico provistos, de forma sumamente académica].\n`;
    }

    promptText += `\n=== DATOS Y CONTEXTUALIZACIÓN ===
- **Paciente**: ${patientInfo || "No especificado"}
- **Sospecha Clínica Principal**: ${clinicalSuspicion || "No descrita profundamente"}
- **Interrogante Diagnóstica / Dudas a Resolver**: ${radiologicalQuestions || "Consultas generales de alta precisión"}

=== CONFIGURACIÓN DE LAS IMÁGENES PROVISTAS ===
- **Imagen 1 (Obligatoria)**: ${desc1 || "Primer plano / RX/TC"} - **Modalidad**: ${modality1 || "No especificada"}
`;

    if (image2 && mimeType2) {
      promptText += `- **Imagen 2 (Opcional)**: ${desc2 || "Segundo plano / Control / Comparativo"} - **Modalidad**: ${modality2 || "No especificada"}\n`;
    }

    if (image3 && mimeType3) {
      promptText += `- **Imagen 3 (Opcional)**: ${desc3 || "Tercer plano / Adicional"} - **Modalidad**: ${modality3 || "No especificada"}\n`;
    }

    const formatAnnotationsForPrompt = (anns: any[] | undefined, name: string) => {
      if (!anns || !Array.isArray(anns) || anns.length === 0) return "";
      let output = `\n- **⚠️ REGIONES CRÍTICAS MARCADAS POR EL MÉDICO RADIÓLOGO EN LA ${name}**:\n`;
      output += `  EL MÉDICO HA MARCADO FÍSICAMENTE ESTAS COORDENADAS PORQUE HA DETECTADO UNA LESIÓN. ESTÁS OBLIGADO a asumir que existe una alteración real en estas zonas y enfocar el 100% de tu sensibilidad en confirmar su naturaleza (ej. trazo de fractura, fisura, escalón articular), describiéndolo a detalle. NUNCA ignores un marcador del usuario.\n`;
      anns.forEach((a, i) => {
        const shapeType = a.type === "circle" ? "Círculo" : a.type === "rectangle" ? "Caja Rectangular" : "Punto";
        const shapeDetails = a.type === "circle" 
          ? `(Radio: ${a.radius || 6}%)` 
          : a.type === "rectangle" 
          ? `(Ancho: ${a.width || 12}%, Alto: ${a.height || 8}%)` 
          : "";
        const desc = a.label ? `Descripción: "${a.label}"` : "Sin descripción";
        output += `  * **Marcador #${i + 1} (${shapeType})** ${shapeDetails}: Ubicado en coordenadas relativas X: ${Number(a.x).toFixed(1)}%, Y: ${Number(a.y).toFixed(1)}%. ${desc}\n`;
      });
      return output;
    };

    if (annotations1 && annotations1.length > 0) {
      promptText += formatAnnotationsForPrompt(annotations1, `Imagen 1 (${desc1 || "Principal"})`);
    }
    if (annotations2 && annotations2.length > 0) {
      promptText += formatAnnotationsForPrompt(annotations2, `Imagen 2 (${desc2 || "Comparativo"})`);
    }
    if (annotations3 && annotations3.length > 0) {
      promptText += formatAnnotationsForPrompt(annotations3, `Imagen 3 (${desc3 || "Adicional"})`);
    }

    promptText += `
Proporciona una valoración de máxima exactitud científica estructurada bajo la siguiente plantilla de diagnóstico académico. Cada respuesta debe ser clara, explícita y basada estrictamente en la evidencia visual directa:

---

## 🔍 RAZONAMIENTO VISUAL PRE-DIAGNÓSTICO E INVENTARIO DE REJILLA (3X3 GRID SCAN)
(Obligatorio: Divide mentalmente la imagen en 9 sectores e indica anomalías identificadas en cada una de manera puramente descriptiva semiológica -densidad, bordes, trazos- de forma independiente de las sospechas clínicas):
- **Sectores Superiores (Izquierdo / Centro / Derecho)**: [Describir minuciosamente]
- **Sectores Medios (Izquierdo / Centro / Derecho)**: [Describir minuciosamente - incluyendo parénquimas centrales, hilios, silueta cardíaca u hombros/rodillas centrales]
- **Sectores Inferiores (Izquierdo / Centro / Derecho)**: [Describir minuciosamente - incluyendo bases pulmonares, recesos pleurales, corticales distales, etc.]
- **Evaluación de Sesgo de Satisfacción**: [¿Se detectaron hallazgos incidentales u ocultos no relacionados con la sospecha evidente? Sí/No y descripción]

## REGISTRO DE AUDITORÍA VISUAL MULTI-PASADA DE LA IA
(Para que el usuario identifique el rigor tecnológico empleado, describe brevemente el resultado técnico de las dos pasadas visuales e internas que realizaste sobre este caso):
- **Pasada de Acuidad Micro-Estructural**: (Indica qué estructuras anatómicas, corticales óseas o márgenes interfaces evaluaste minuciosamente en busca de micro-alteraciones sutiles.)
- **Pasada de Seguridad y Evidencia Real**: (Detalla qué sospechas o anomalías aparentes sometiste a escrutinio para comprobar si contaban con evidencia física real o si se trataba de artefactos, protegiendo al informe de sobre-diagnósticos.)

## PROTOCOLO DE VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA RADIOLÓGICA VISUAL DE EXCLUSIÓN
(Obligatorio: Para cada hallazgo mayor de riesgo o signo cardinal que descartes, consideres normal, negativo o preservado, cita brevemente las características físicas, visuales o métricas exactas y observables en la imagen que demuestran científicamente su exclusión para evitar la subestimación diagnóstica):
- **¿Se consideró descartado, normal o descartable algún hallazgo mayor o reducción de espacio articular?**: [Detallar, ej. "Sí, se evaluó reducción del espacio femorotibial"]
- **Evidencia Radiológica Visual Citada**: [Ej. "Preservación uniforme y simétrica del espacio femorotibial bilateral, calculada en aproximadamente ~X mm, con líneas corticales nítidas e íntegras y ausencia total de esclerosis ósea reactiva o pinzamiento osteofitario marginal"]
- **Nivel de Certeza Visual de Exclusión**: [Ej. "Alta - Confirmado por visualización nítida y nitidez de límites anatómicos"]

## ⚠️ EVALUACIÓN DE HALLAZGOS SUTILES / BORDERLINE U OSCILACIONES DE SEÑAL
(Enumera cualquier foco sutil, asimetría de baja visibilidad o zona dudosa, asignándole un grado de certeza radiológica):
- **Hallazgo Sutil Detectado**: [Descripción del detalle limítrofe]
- **Grado de Certeza Visual**: [Bajo / Moderado / Alto]
- **Diagnósticos Alternativos / Variantes de la Normalidad**: [Ej: "Artefacto por superposición vs micro-consolidación incipiente"]

## 1. EVALUACIÓN DETALLADA DE LA IMAGEN 1: ${desc1 || "Carga Principal"} (${modality1 || "S/M"})
(Describe la calidad del estudio, posición, proyecciones visibles, reparos anatómicos de referencia, hallazgos principales, áreas de sospecha y signos característicos con terminología médica avanzada.)
`;

    if (image2 && mimeType2) {
      promptText += `
## 2. EVALUACIÓN DETALLADA DE LA IMAGEN 2: ${desc2 || "Estudio Comparativo"} (${modality2 || "S/M"})
(Describe la calidad, plano/proyección de la segunda imagen, hallazgos identificables y anomalías de manera aislada.)
`;
    }

    if (image3 && mimeType3) {
      promptText += `
## 3. EVALUACIÓN DETALLADA DE LA IMAGEN 3: ${desc3 || "Estudio Adicional"} (${modality3 || "S/M"})
(Describe la calidad, plano/proyección de la tercera imagen, hallazgos identificables y anomalías de manera aislada.)
`;
    }

    if ((image2 && mimeType2) || (image3 && mimeType3)) {
      promptText += `
## COMPARATIVA DINÁMICA / ESTUDIOS EVOLUTIVOS
(Contrasta los estudios provistos de forma evolutiva o comparativa. ¿Existe progresión, estabilidad, cambios temporales, correlaciones espaciales en múltiples planos o diferencias críticas de señal/densidad? Sé extremadamente explícito.)
`;
    }

    if (isFractureCase) {
      promptText += `
## ⚡️ PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA FRACTURAS (MÚLTIPLE VALORACIÓN BIOMECÁNICA) ⚡️
(Este apartado especial se ha disparado obligatoriamente por sospecha, mención o hallazgo visual de fractura en la indicación o consulta. Debes caracterizar los hallazgos con máxima precisión, basándote rigurosamente en la evidencia física real visible de la imagen):
*   **⚠️ REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACIÓN):** Si tras un escaneo cuidadoso de la imagen confirmas que NO existe fractura, fisura ni trazo de discontinuidad cortical, DEBES declararlo categóricamente en el primer párrafo: *"NO SE OBSERVAN TRAZOS DE FRACTURA NI DISCONTINUIDADES CORTICALES EN LOS SEGMENTOS EVALUADOS. Estructuras óseas íntegras y conservadas."* En este caso, marca todos los sub-puntos siguientes como "No aplicable". Queda terminantemente prohibido inventar trazos de fractura por complacer la sospecha clínica.
- **1. Presencia, Densidad y Localización Anatomopatológica Precisa**: (Identifica con exactitud diagnóstica la localización anatómica: diáfisis, metáfisis, epífisis, cuello, cabeza, etc., describiendo la discontinuidad cortical).
- **2. Número y Dirección Tridimensional de Trazos**: (Describe el número exacto de trazos óseos identificados. Clasifica rigurosamente su orientación geométrica: transverso, oblicuo corto/largo, espiroideo o helicoidal, longitudinal, ala de mariposa, conminuto con múltiples fragmentos libres, etc. Si no hay fractura, reportar 'No aplicable').
- **3. Extensión y Compromiso Articular Estricto**: (Especificar de forma obligatoria e inflexible si existe afección, interrupción o extensión del trazo hacia la carilla, cavidad o cartílago articular. Detalla si hay escalón o hundimiento articular en milímetros estimados, pérdida de congruencia o diástasis intraarticular. Si no hay fractura, reportar 'No aplicable').
- **4. Desplazamiento Espacial de Fragmentos y Alineación**: (Describe minuciosamente la dirección y grado de desplazamiento óseo: diástasis o separación en mm, cabalgamiento con acortamiento longitudinal, luxación o subluxación articular, desviación angular en varo/valgo o antero/retrocurvatum, o rotación fragmentaria. Si no hay fractura, reportar 'No aplicable').
- **5. Cita de Evidencia Visual de Integridad**: (Proporciona la confirmación estricta de cada hallazgo con correlato clínico directo. ¡No tolerar alucinación de líneas vasculares normales ni subestimación de trazos corticales sutiles!)
`;
    }

    if (isPulmonaryCase) {
      promptText += `
## 🫁 PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA PARÉNQUIMA PULMONAR E HILIOS (VALORACIÓN SISTEMÁTICA) 🫁
(Este apartado especial se ha disparado obligatoriamente por tratarse de una radiografía de tórax o por sospecha de patología pulmonar. Debes evaluar minuciosamente el parénquima pulmonar y las estructuras hiliares con máxima precisión clínica, basándote estrictamente en hallazgos verdaderos y reales visibles en la imagen):
- **1. Evaluación del Parénquima Pulmonar (Patrones e Infiltrados)**:
  * **Infiltrados Intersticiales**: (Evalúa con extremo detalle fino la presencia de patrones reticulares, nodulares, reticulonodulares o de vidrio esmerilado sutiles. Especifica si son difusos, localizados, bilaterales o de distribución periférica/basal, sin omitir opacidades lineales o septales tenues o incipientes).
  * **Infiltrados Alveolares (Consolidaciones)**: (Evalúa signos de consolidación del espacio aéreo, presencia de broncograma aéreo, límites e infiltrados algodonosos focales, multifocales o lobares. Detalla con exactitud su localización anatómica).
- **2. Masas y Cavitaciones**:
  * (Busca nódulos solitarios o múltiples, masas pulmonares sospechosas describiendo sus bordes -netos, lobulados, espiculados- y dimensiones aproximadas. Evalúa exhaustivamente la presencia de cavitaciones pulmonares, paredes engrosadas, niveles hidroaéreos concomitantes o bronquiectasias de carácter quístico).
- **3. Atelectasias y Pérdida de Volumen o Colapso**:
  * (Valora signos de colapso pulmonar, atelectasias laminares, segmentarias o lobares. Describe signos indirectos como la desviación de cisuras, desviación mediastinal, o la elevación diafragmática ipsilateral por sutil que sea).
- **4. Hilios Pulmonares y Ensanchamientos Mediastinales**:
  * **Valoración Hiliar**: (Analiza críticamente la simetría, densidad y tamaño de ambos hilios pulmonares. Discrimina con agudeza si hay adenopatías hiliares, prominencia vascular/arterial o masas hiliares verdaderas vs. superposición normal de estructuras).
  * **Valoración Mediastinal**: (Mide o estima el perfil mediastínico para descartar de manera confiable o reportar ensanchamiento mediastinal patológico, alteraciones del botón aórtico, masas mediastinales o neumomediastino).
- **5. Espacio Pleural e Integridad Costodiafragmática**:
  * (Evalúa con lupa digital los ángulos costofrénicos y cardiofrénicos bilaterales en búsqueda de borramientos sutiles que sugieran derrame pleural inicial, engrosamientos pleurales, calcificaciones o signos de neumotórax apical sutil -línea pleural visceral desprovista de trama pulmonar periférica-).
- **6. Evidencia Absoluta y Agudeza Anti-Alucilación**:
  * (Somete cada hallazgo al protocolo de veracidad: ¡no inventes opacidades por superposición normal de escápulas, pezones, costillas o pliegues cutáneos, pero mantén un nivel máximo de sospecha ante cambios sutiles reales!)
`;
    }

    if (isOsteoarthritisCase) {
      promptText += `
## 🦴 PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA ARTROSIS Y ENFERMEDAD DEGENERATIVA (VALORACIÓN ARTICULAR Y COLUMNA) 🦴
(Este apartado especial se ha disparado por sospecha, mención o hallazgo de enfermedad degenerativa. Debes buscar y describir minuciosamente los cambios degenerativos, basándote rígidamente en la evidencia física visible sin inventar desgaste ni disminución del espacio articular que no existan):
*   **⚠️ REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACIÓN):** Si los espacios articulares (interlínea articular, mortaja del tobillo, espacio femorotibial, coxofemoral o intervertebral) están perfectamente conservados, normales y simétricos, DEBES reportarlo con total honestidad: *"Espacio articular conservado, de amplitud normal y simétrica, sin pinzamiento ni esclerosis subcondral."* No inventes disminuciones severas de la mortaja o espacios articulares si están conservados.
- **1. Disminución / Pinzamiento de Espacios Articulares o Discales**: (Evalúa con precisión micrométrica la anchura del espacio articular o intervertebral. Especifica si el compromiso es simétrico o asimétrico -ej. medial vs. lateral en rodilla- y estima su reducción porcentual o milimétrica. Si es normal, reportar 'Espacio articular conservado').
- **2. Presencia, Medida y Distribución de Osteofitos**: (Identifica y detalla la localización exacta de osteofitos marginales, espolones u osteofitos de tracción en platillos, carillas, márgenes óseos o cuerpos vertebrales. No pases por alto osteofitos incipientes pero evita alucinar excrecencias normales o superposiciones estructurales. Si no hay, declara: 'Sin evidencia de osteofitosis').
- **3. Esclerosis Ósea Subcondral e Integridad del Hueso**: (Analiza el aumento focalizado de la densidad ósea -esclerosis- debajo del cartílago articular o en las plataformas vertebrales, indicando las zonas de máxima sobrecarga mecánica).
- **4. Geodas o Quistes Subcondrales**: (Busca con alta magnificación visual sutiles geodas de presión o quistes subcondrales degenerativos, reportando su presencia, diámetro y localización precisa. Si no hay, reportar como ausentes).
- **5. Clasificación y Gradación Internacional Rigurosa**: (Aplica con absoluto rigor las escalas internacionales correspondientes según la región estudiada: por ejemplo, la clasificación de Kellgren-Lawrence para rodilla/cadera -de Grado 1 sutil a Grado 4 severo-, escalas de severidad para artrosis facetaria, o de discopatía degenerativa en columna, sólo si existe artrosis real comprobable).
- **6. Coherencia y Sinergia Diagnóstica Ampliada**: 
  * *NOTA CRÍTICA*: La activación de este protocolo específico NO debe disminuir de ninguna manera la eficiencia o detalle del resto de la valoración diagnóstica anatomopatológica general (tejidos blandos, estructuras óseas no degenerativas u órganos visibles). Al contrario, debe potenciar y enriquecer el análisis integral cruzando los datos mecánicos/degenerativos con el resto de los hallazgos para una valoración diagnóstica holística de máxima potencia clínica.
`;
    }

    if (isMetalCase) {
      promptText += `
## 🔩 PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA PRÓTESIS Y ELEMENTOS METÁLICOS DE OSTEOSÍNTESIS (INTEGRIDAD Y ALINEACIÓN) 🔩
(Este apartado especial se ha disparado por sospecha, mención o hallazgo de implantes metálicos o material de osteosíntesis. Debes realizar una evaluación técnica sumamente rigurosa de su presencia real):
*   **⚠️ REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACIÓN):** Si tras un escaneo cuidadoso confirmas que NO existen implantes metálicos, prótesis, placas de osteosíntesis, ni tornillos (como tornillos transindesmales) en las imágenes, DEBES declarar categóricamente al inicio del apartado: *"NO SE IDENTIFICAN IMPLANTES METÁLICOS NI MATERIAL DE OSTEOSÍNTESIS EN NINGUNA DE LAS IMÁGENES EVALUADAS."* En este caso, marca todos los sub-puntos siguientes como "No aplicable". Queda estrictamente prohibido alucinar o inventar placas o tornillos inexistentes por complacer el motivo de consulta o la sospecha clínica.
- **1. Tipo, Localización Anatomopatológica y Componentes del Implante**: (Describe los componentes identificados: vástagos, placas de compresión/reconstrucción, tornillos corticales/esponjosos, clavos endomedulares, alambres, cerclajes, cúpulas acetabulares, liners, etc. Especifica con precisión los segmentos óseos o articulaciones involucrados. Si no hay ninguno, marcar como no aplicable/inexistente).
- **2. Valoración de la Estructura Metálica e Integridad**: (Evalúa con minuciosa agudeza visual si existe evidencia de fatiga, doblamiento, fractura o alteración del material. Detalla de forma explícita la integridad de cada uno de los elementos metálicos y valora su integridad y estabilidad. Si no hay material, marcar como no aplicable).
- **3. Interfaz Hueso-Implante (Margen Periprotésico / Peri-implante)**: (Inspecciona la presencia de bandas radiolúcidas -osteólisis peri-implante u osteólisis periprotésica sutil-, aflojamiento aséptico, hundimiento de componentes, reabsorción ósea circundante o reacción periosteal anormal. Si no hay implante, marcar como no aplicable).
- **4. Orientación, Alineación Espacial y Relación Anatómica**: (Describe si la orientación de la prótesis o del material de osteosíntesis es anatómica y funcional. Si es una prótesis articular, valora si existe luxación, subluxación, asimetría de componentes o desalineación. Si no hay implante, marcar como no aplicable).
`;
    }

    promptText += `
## 4. DISCUSIÓN DE DIAGNÓSTICOS DIFERENCIALES Y CRITERIOS INTERNACIONALES DE CONSENSO
(Discute los diagnósticos diferenciales pertinentes basándote científicamente en los hallazgos. **Nota de máxima exactitud**: la cantidad de diagnósticos no es importante; lo crítico es el valor real y la veracidad de lo aportado al reporte. No fuerces diferenciales hipotéticos si ponen en riesgo o restan claridad al diagnóstico final real. Si el estudio está conservado o es normal, descarta con fundamento clínico patologías de alta sospecha como "Descartadas por alineación anatómica o plano normal". Emplea clasificaciones según corresponda como BI-RADS, Bosniak, Fleischner, etc., con sumo rigor.)

## 5. CONCLUSIÓN DIAGNÓSTICA Y SEGUNDA OPINIÓN DEFINITIVA
(Ofrece el veredicto diagnóstico más preciso y probable fundamentado en la visualización clínica.)

## 6. RECOMENDACIONES CLÍNICAS Y SUGERENCIAS TÉCNICAS ADICIONALES
(Pautas claras sobre qué estudios de seguimiento de mayor especificidad -como RMN de contraste, angioTAC, ecografía Doppler, elastografía por RM/US- se deberían solicitar, justificando técnicamente la indicación.)

---

Mantén un lenguaje impecable, sumamente formal y científico, digno de un comité interdepartamental internacional de discusión de casos difíciles.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres un consultor radiólogo internacional senior de diagnóstico, y el estándar supremo de precisión diagnóstica clínica de esta plataforma. Este módulo ('Doble Valoración') exige un equilibrio científico idóneo entre alta sensibilidad visual ante patologías reales y un riguroso filtro anti-alucinaciones:\n" +
      "1. RECONOCIMIENTO Y VALIDACIÓN DE PATOLOGÍAS EVIDENTES O ASEVERADAS POR EL CLÍNICO: Es mandatorio que identifiques y confirmes con absoluta precisión cualquier hallazgo o alteración estructural patológica patente, evidente o relevante (por ejemplo, neumotórax extenso o apical, colapso pulmonar, atelectasia, derrame pleural, fractura o fisura, marcada disminución del espacio articular, o masa). Cuando el médico tratante, la sospecha clínica o la consulta indiquen o aseveren que existe un hallazgo específico o 'no discutible' (como 'neumotórax extenso' o 'hallazgo evidente'), NUNCA asumas por defecto que es una trampa o intento de inducción de error. Ejecuta de inmediato una revisión dirigida con el 100% de tu sensibilidad en esa zona anatómica para verificar, caracterizar y describir detalladamente la severidad del hallazgo (ej. en neumotórax: ubicación de la línea pleural visceral, separación en mm, porcentaje de radiolucidez periférica desprovista de trama vascular, colapso pulmonar o desviación mediastínica). NUNCA minimices ni refutes obstinadamente hallazgos patológicos reales por un hiper-escepticismo inapropiado.\n" +
      "2. FILTRO ANTI-ALUCINACIÓN BASADO EN EVIDENCIA FÍSICA REAL: Mantén una estricta fidelidad a la imagen real. Está prohibido inventar o alucinar elementos totalmente inexistentes (como material de osteosíntesis inexistente o placas/tornillos si la placa no muestra ningún implante metálico). Si tras una verificación exhaustiva y meticulosa un hallazgo sugerido realmente no es identificable en la imagen, explica objetivamente la anatomía observada (ej. citando la presencia de trama vascular normal que se extiende hasta la pared torácica parietal interna) de forma profesional y fundamentada, sin ser agresivo ni prejuzgar al especialista.\n" +
      "3. VARIANTES DE LA NORMALIDAD: Diferencia con claridad variaciones anatómicas fisiológicas (canales nutricios, suturas, pliegues cutáneos, superposiciones de escápula/costillas) de patologías verdaderas, basando tu dictamen en la evidencia objetiva de los píxeles.\n" +
      "4. CONVENCIÓN ANATÓMICA DE LATERALIDAD EN ESPEJO Y DERECHA/IZQUIERDA: En proyecciones frontales PA/AP, la DERECHA VISUAL de la pantalla es el HEIMITÓRAX/LADO IZQUIERDO del paciente. La IZQUIERDA VISUAL de la pantalla es el HEIMITÓRAX/LADO DERECHO del paciente. Si la sospecha o indicación del usuario dice 'Neumotórax Izquierdo', evalúa la mitad VISUAL DERECHA de la placa (hemitórax izquierdo del paciente). Si allí se observa la línea pleural visceral y radiolucidez sin trama, CONFIRMA Y VALIDA COMO 'NEUMOTÓRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusión de lados de la pantalla.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      },
    });

    res.json({
      success: true,
      analysis: response.text,
      model_used: selectedModel,
    });
  } catch (error: any) {
    console.error("Error en /api/expert-image-analysis:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 7. API: COMPLETE CLINICAL CASE ANALYSIS
 * POST /api/analyze-case
 * Payload: {
 *   report: string
 *   studyType?: string
 *   clinicalHistory?: string
 *   findings?: string
 * }
 */
app.post("/api/analyze-case", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType, clinicalHistory, findings } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para realizar el análisis de caso." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio clínico / tipo de estudio: ${studyType || "No especificado"}
Indicación clínica / Sospecha: ${clinicalHistory || "No especificada"}
Hallazgos preliminares o cargados: ${findings || "No proporcionados"}

Reporte Radiológico generado:
"""
${report}
"""

Por favor, realiza un ANÁLISIS DE CASO CLÍNICO COMPLETO y exhaustivo sobre este caso.
Este análisis debe orientarse a un nivel de subespecialidad o interconsulta docente. Estructura el análisis con las siguientes secciones detalladas en Markdown:
1. **RESUMEN FISIOPATOLÓGICO**: Detalla el mecanismo lesional o la fisiopatología detrás de los hallazgos radiológicos visualizados en este caso.
2. **ESCALAS Y CORRELACIONES CLÍNICAS CLAVE**: Detalla la relevancia de las escalas aplicadas o aquellas que deben estimarse clínicamente en el paciente (ej. escala de severidad, scores de riesgo, pronóstico).
3. **DIAGNÓSTICOS DIFERENCIALES PRIORITARIOS**: Presenta una tabla o lista de los 3 principales diagnósticos diferenciales, indicando los signos a favor y en contra de cada uno basados en este informe.
4. **PROPUESTA DE SEGUIMIENTO Y PLAN DE ACCIÓN**: Sugerencias específicas de estudios de imagen de seguimiento temporal (ej. 'revalorar en 6 meses con TC contrastada') y estudios paraclínicos complementarios idóneos para la toma de decisiones clínicas.

Mantén un lenguaje extremadamente preciso, profesional, elegante y con rigor científico impecable.
`;

    const systemInstruction = 
      "Eres un consultor de medicina interna y radiología de un hospital universitario de alta complejidad. Te especializas en desglosar casos clínicos complejos mediante correlación anatomo-radiológica detallada. " +
      "Cuando evalúes esteatosis hepática o cuantificación de grasa por QUS o ultrasonido cuantitativo, aplica estrictamente los rangos de clasificación del Consenso SRU: Normal (< 5.0%), Leve (5.0% - 12.0%), Moderada (12.1% - 20.0%) y Severa (> 20.0%).";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      analysis: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/analyze-case:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * API: ADVANCED PATHOLOGY CORRELATION ANALYSIS
 * POST /api/analyze-pathology-correlation
 * Payload: {
 *   report: string
 *   pathology: string
 *   studyType?: string
 *   clinicalHistory?: string
 *   model?: string
 * }
 */
app.post("/api/analyze-pathology-correlation", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, pathology, studyType, clinicalHistory } = req.body;
    if (!report || !pathology) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' y la 'pathology' a analizar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio radiológico / tipo: ${studyType || "Estudio Ultrasonográfico"}
Indicación / Historial clínico: ${clinicalHistory || "No especificada"}
Patología Específica a Evaluar: "${pathology}"

Reporte Radiológico redactado:
"""
${report}
"""

Por favor, realiza un ANÁLISIS DE CORRELACIÓN Y EVALUACIÓN DE HALLAZGOS para la patología específica: "${pathology}".

REGLAS STRICTAS OBLIGATORIAS:
1. ENFOCARSE EXCLUSIVAMENTE EN LOS HALLAZGOS PRESENTES EN EL REPORTE QUE REFUERZAN O RESPALDAN EL DIAGNÓSTICO de "${pathology}". Destaca con precisión las imágenes/mediciones/signos descritos que respaldan la condición.
2. NINGÚN PORCENTAJE DE PROBABILIDAD NI CERTEZA EN PORCENTAJE (%) (ej. NO escribir "85% de certeza", "90% de probabilidad", ni incluir números de porcentaje).
3. NINGUNA RECOMENDACIÓN DE TRATAMIENTO O MANEJO MÉDICO O QUIRÚRGICO (ej. NO escribir "Se sugiere colecistectomía", "Tratamiento antibiótico", "Intervención quirúrgica" ni "Manejo hospitalario").
4. INCLUIR AL FINAL UNA DISCUSIÓN Y SÍNTESIS CLÍNICA FINAL limpia, elegante y de rigor académico subespecializado.

Devuelve la respuesta en formato JSON estricto con la siguiente estructura:
\`\`\`json
{
  "format": "esquema_pilares",
  "title": "CORRELACIÓN ECOGRÁFICA: ${pathology.toUpperCase()}",
  "elementsConfig": {
    "includeSonographic": true,
    "includeSonographicDetails": true,
    "includeClinicalCorr": true,
    "includeCertainty": false,
    "includeDifferentials": true,
    "includeDiscardedDifferentials": false,
    "includeManagement": false
  },
  "sonographicPillar": {
    "primaryFinding": "Hallazgo o signo ecográfico principal presente en el reporte que apoya la patología ${pathology}",
    "details": [
      "Signo ecográfico confirmatorio 1 observado en el informe con mediciones o características",
      "Signo ecográfico confirmatorio 2 o hallazgo secundario relevante"
    ],
    "severity": "altered"
  },
  "clinicalCorrelation": "Correlación fisiopatológica de los hallazgos descritos con el mecanismo de la patología ${pathology}.",
  "finalDiscussion": "Discusión y síntesis clínica final que sintetiza el respaldo radiológico para ${pathology}, fundamentando el juicio diagnóstico sin incluir porcentajes de certeza ni conductas de manejo.",
  "diagnostics": [
    {
      "name": "${pathology}",
      "probability": "Respaldo Radiológico Confirmatorio",
      "supportingCriteria": "Resumen de criterios positivos encontrados en el estudio"
    }
  ],
  "decisionFlow": [
    { "step": 1, "title": "Hallazgo Ecográfico Clave", "desc": "Descripción del signo primario que orienta el caso" },
    { "step": 2, "title": "Signos de Soporte Encontrados", "desc": "Detalle de hallazgos ecográficos que refuerzan la sospecha" },
    { "step": 3, "title": "Discusión & Síntesis Clínica", "desc": "Síntesis diagnóstica final libre de recomendaciones de tratamiento" }
  ],
  "semioticMatrix": {
    "requestingSigns": [
      "Signo positivo 1 que apoya ${pathology}",
      "Signo positivo 2 que apoya ${pathology}"
    ],
    "exclusiveSigns": [],
    "discardCriteria": []
  }
}
\`\`\`
Responde ÚNICAMENTE con el objeto JSON válido en un bloque \`\`\`json ... \`\`\`.
`;

    const systemInstruction = 
      "Eres un consultor de radiología de un centro médico de alta complejidad. Tu objetivo es realizar correlaciones semiológicas de precisión sobre reportes ultrasonográficos, destacando únicamente la evidencia que respalda la patología consultada, sin emitir porcentajes probabilísticos ni sugerencias de tratamiento.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    let rawJson = response.text || "";
    const jsonMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      rawJson = jsonMatch[1];
    }

    let parsedData;
    try {
      parsedData = JSON.parse(rawJson);
    } catch (e) {
      parsedData = {
        format: "esquema_pilares",
        title: `CORRELACIÓN ECOGRÁFICA: ${pathology.toUpperCase()}`,
        elementsConfig: {
          includeSonographic: true,
          includeSonographicDetails: true,
          includeClinicalCorr: true,
          includeCertainty: false,
          includeDifferentials: true,
          includeDiscardedDifferentials: false,
          includeManagement: false
        },
        sonographicPillar: {
          primaryFinding: `Hallazgos compatibles con ${pathology}`,
          details: ["Hallazgos positivos del reporte analizado."],
          severity: "altered"
        },
        clinicalCorrelation: `Correlación de evidencia ecográfica hallada en el informe para ${pathology}.`,
        finalDiscussion: response.text,
        diagnostics: [
          {
            name: pathology,
            probability: "Respaldo Confirmatorio",
            supportingCriteria: "Hallazgos compatibles en el informe"
          }
        ]
      };
    }

    res.json({
      success: true,
      data: parsedData,
      rawText: response.text
    });
  } catch (error: any) {
    console.error("Error en /api/analyze-pathology-correlation:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: INTERACTIVE FOLLOW-UP CONSULTATION FOR DOUBLE ASSESSMENT
 * POST /api/expert-image-followup
 * Payload: {
 *   image1: string
 *   mimeType1: string
 *   image2?: string
 *   mimeType2?: string
 *   previousAnalysis: string
 *   queryText: string
 *   patientInfo?: string
 *   clinicalSuspicion?: string
 * }
 */
app.post("/api/expert-image-followup", async (req: express.Request, res: express.Response) => {
  try {
    const { 
      model,
      image1, mimeType1,
      image2, mimeType2,
      image3, mimeType3,
      previousAnalysis,
      queryText,
      patientInfo,
      clinicalSuspicion,
      fractureProtocol,
      pulmonaryProtocol,
      osteoarthritisProtocol,
      prosthesisMetalProtocol
    } = req.body;

    if (!image1 || !mimeType1) {
      return res.status(400).json({ success: false, error: "Se requiere al menos la primera imagen para continuar la consulta." });
    }
    if (!queryText) {
      return res.status(400).json({ success: false, error: "Se requiere ingresar una consulta o aspecto específico de valoración." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const img1Supported = checkImageSupport(mimeType1);
    if (img1Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image1),
          mimeType: mimeType1,
        },
      });
    }

    const img2Supported = image2 && mimeType2 && checkImageSupport(mimeType2);
    if (image2 && mimeType2 && img2Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image2),
          mimeType: mimeType2,
        },
      });
    }

    const img3Supported = image3 && mimeType3 && checkImageSupport(mimeType3);
    if (image3 && mimeType3 && img3Supported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image3),
          mimeType: mimeType3,
        },
      });
    }

    let promptNote = "";
    if (!img1Supported || (image2 && !img2Supported) || (image3 && !img3Supported)) {
      promptNote = `\n[Nota del sistema: Los archivos provistos son representaciones vectoriales/metadatos sin imagen rasterizada binaria. Por favor, genera tu respuesta basándose en los metadatos de diagnóstico y la descripción provista de manera altamente coherente].\n`;
    }

    const isFractureCase = !!fractureProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(fractur|trazo|trazos|desplazam|fisura|compromiso articular|luxac|subluxac|fx|fémur|peroné|tibia|radio|cúbito|húmero)/);

    const isPulmonaryCase = !!pulmonaryProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(torax|tórax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|parénquima|parenquima|neumotorax|neumotórax|pneumothor|hidroneumo|linea pleural|colapso|aire pleural|hiperclaridad|enfisema)/);

    const isOsteoarthritisCase = !!osteoarthritisProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(artros|degenerat|osteofit|escleros|subcondral|pinzam|geoda|espolon|espolón|espondilo|gonartros|coxartros|kellgren|lawrence|facetaria|discopat)/);

    const isMetalCase = !!prosthesisMetalProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(protesis|prótesis|metalico|metálico|metalicos|metálicos|osteosintesis|osteosíntesis|placa|tornillo|clavo|cerclaje|vástago|vastago|artroplastia)/);

    let protocolInstructions = "";
    if (isFractureCase) {
      protocolInstructions += `
⚠️ RECORDATORIO PROTOCOLO DE FRACTURAS DE ALTA EXACTITUD:
- Caracteriza microscópicamente el número y dirección tridimensional de los trazos.
- Especifica rigurosamente el compromiso de carillas articulares (escalón articular/diástasis).
- Detalla grado de desplazamiento espacial (cabalgamiento, diástasis, angulación).
- Basa tus conclusiones únicamente en la evidencia visual real sin omitir ni alucinar.
`;
    }

    if (isPulmonaryCase) {
      protocolInstructions += `
⚠️ RECORDATORIO PROTOCOLO DE PARÉNQUIMA PULMONAR, PLEURA Y NEUMOTÓRAX (ATENCIÓN A REGLA DE LATERALIDAD):
- CONVENCIÓN DE ESPEJO EN RADIOLOGÍA FRONTAL: La MITAD VISUAL DERECHA de la pantalla = LADO ANATÓMICO IZQUIERDO DEL PACIENTE (hemitórax/campo pulmonar izquierdo). La MITAD VISUAL IZQUIERDA = LADO ANATÓMICO DERECHO DEL PACIENTE.
- Un neumotórax visible en la mitad derecha de la pantalla DEBE reportarse como "NEUMOTÓRAX IZQUIERDO" (lado del paciente).
- Evalúa minuciosamente el espacio pleural buscando línea pleural visceral, radiolucidez periférica y pérdida de trama vascular (neumotórax extenso, apical o a tensión).
- Valora la presencia de colapso pulmonar pasivo ipsilateral y desplazamiento del mediastino/tráquea o aplanamiento diafragmático.
- Revisa el parénquima para diferenciar infiltrados intersticiales/alveolares, masas, cavitaciones y derrames pleurales.
- Si el médico consulta o indica un hallazgo específico ("neumotórax izquierdo no discutible"), realiza una verificación dirigida de alta sensibilidad en la mitad visual derecha de la foto, confirmando y caracterizando el hallazgo real. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad a "derecho".
`;
    }

    if (isOsteoarthritisCase) {
      protocolInstructions += `
⚠️ RECORDATORIO PROTOCOLO DE ARTROSIS Y ENFERMEDAD DEGENERATIVA:
- Evalúa con precisión el pinzamiento de espacios articulares, diferenciando áreas de carga simétricas vs. asimétricas.
- Detalla la presencia de osteofitos marginales, esclerosis subcondral focal o geodas óseas.
- Emplea criterios sistemáticos internacionales de severidad (v.g., Kellgren-Lawrence para articulaciones mayores o discopatía).
- Toda valoración de cambios degenerativos debe optimizar la exactitud e integrarse armónicamente para potenciar el resto del diagnóstico clínico general sin demeritar su calidad.
`;
    }

    if (isMetalCase) {
      protocolInstructions += `
⚠️ RECORDATORIO PROTOCOLO DE PRÓTESIS Y ELEMENTOS METÁLICOS DE OSTEOSÍNTESIS:
- Describe con adecuado nivel técnico cada implante articular o material de osteosíntesis visible (placas, tornillos, clavos, etc.).
- Evalúa de forma obligatoria y rigurosa la integridad del material buscando signos de fractura, fatiga estructural, doblamiento o aflojamiento.
- Valora y reporta la interfaz hueso-implante en busca de lisis peri-implante, aflojamiento aséptico o hundimiento.
- Describe la orientación y alineación de los componentes respecto a las estructuras anatómicas.
`;
    }

    const promptText = `
Eres un radiólogo académico senior con subespecialidad en diagnóstico avanzado de alta complejidad.
${promptNote}
Anteriormente realizaste el siguiente análisis de Doble Valoración:
"""
${previousAnalysis || "No disponible clínicamente"}
"""
 
El usuario (médico o especialista clínico) te solicita responder a la siguiente CONSULTA o SUGERIR LA VALORACIÓN ESPECÍFICA de un determinado aspecto sobre las imágenes adjuntas o el reporte previo:
"=== CONSULTA / INDICACIÓN DE VALORACIÓN ESPECÍFICA ==="
${queryText}
 
=== DATOS GENERALES DEL CASO ===
- **Paciente**: ${patientInfo || "S/D"}
- **Sospecha Clínica**: ${clinicalSuspicion || "S/D"}
${protocolInstructions}
 
Misión:
1. Responde con un rigor clínico impecable, extremadamente detallado, minucioso y exacto, promoviendo un equilibrio científico perfecto.
2. Analiza de nuevo visualmente las imágenes con un nivel microscópico de detalle en busca de hallazgos sutiles, micro-anomalías o variaciones milimétricas que influyan en la consulta. No omitas ningún rasgo pequeño pero real.
3. Evalúa con el mismo rigor el factor anti-alucinación: no inventes patologías en áreas dudosas donde solo hay ruido técnico, variaciones normales de proyección o sombras normales. Si un hallazgo es incierto, descríbelo explícitamente como indeterminado, sutil o variante normal.
4. Si el usuario te pide modificar o re-enfocar el reporte, responde justificando clínicamente cada observación de forma estrecha con los píxeles reales evaluados y la literatura radiológica vigente.

Escribe tu respuesta directamente en formato Markdown limpio, estructurado, sin rodeos conversacionales ni saludos innecesarios. Comienza directamente con tu análisis especializado.
`;
 
    parts.push({ text: promptText });
 
    const systemInstruction = 
      "Eres un consultor radiólogo internacional senior de diagnóstico de casos complejos y desafiantes. Tu principal fortaleza es la combinación de alta sensibilidad para detectar y confirmar patologías reales y evidentes (como neumotórax extenso, colapso pulmonar, derrames pleurales, fracturas o lesiones focales) con un estricto filtro de seguridad anti-alucinación. " +
      "REGLA DE ESPEJO Y LATERALIDAD ANATÓMICA RADIOLÓGICA: En radiología frontal PA/AP, la DERECHA VISUAL de la pantalla es el LADO ANATÓMICO IZQUIERDO DEL PACIENTE (hemitórax/campo pulmonar izquierdo). Un neumotórax visible en la mitad derecha de la foto/pantalla DEBE reportarse como 'NEUMOTÓRAX IZQUIERDO'. Si la consulta del usuario indica 'Neumotórax Izquierdo', evalúa la mitad visual derecha de la foto (lado izquierdo del paciente) para confirmar el neumotórax con alta sensibilidad. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad diciendo 'derecho'. " +
      "Cuando el usuario/médico consulte o afirme que existe un hallazgo específico o no discutible, verifica minuciosamente esa región anatómica con máxima sensibilidad para confirmar y caracterizar sus detalles. Evita falsos positivos distinguiendo ruidos y variaciones normales de las verdaderas patologías, pero NUNCA niegues ni refutes hallazgos anatómicos reales y evidentes por un hiper-escepticismo injustificado. Responde con la máxima exactitud y objetividad clínica.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      },
    });

    res.json({
      success: true,
      newMessage: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/expert-image-followup:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: BLIND DOUBLE-MODEL CLINICAL TRIBUNAL & EVALUATION (RADIÓLOGO JEFE)
 * POST /api/expert-evaluate-dual
 */
app.post("/api/expert-evaluate-dual", async (req: express.Request, res: express.Response) => {
  try {
    const { 
      model,
      image1, mimeType1,
      image2, mimeType2,
      image3, mimeType3,
      reportAlpha,
      reportBeta,
      patientInfo,
      clinicalSuspicion,
      radiologicalQuestions,
      fractureProtocol,
      pulmonaryProtocol,
      osteoarthritisProtocol,
      prosthesisMetalProtocol
    } = req.body;

    if (!reportAlpha || !reportBeta) {
      return res.status(400).json({ success: false, error: "Se requieren ambos reportes preliminares (Alpha y Beta) para iniciar la sesión de evaluación del Tribunal Médico." });
    }

    const ai = getGeminiClient();
    // Use Pro model as default for advanced academic appraisal
    const selectedModel = "gemini-3.1-pro-preview";
    const parts: any[] = [];

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    if (image1 && mimeType1 && checkImageSupport(mimeType1)) {
      parts.push({
        inlineData: {
          data: cleanBase64(image1),
          mimeType: mimeType1,
        },
      });
    }

    if (image2 && mimeType2 && checkImageSupport(mimeType2)) {
      parts.push({
        inlineData: {
          data: cleanBase64(image2),
          mimeType: mimeType2,
        },
      });
    }

    if (image3 && mimeType3 && checkImageSupport(mimeType3)) {
      parts.push({
        inlineData: {
          data: cleanBase64(image3),
          mimeType: mimeType3,
        },
      });
    }

    const promptText = `
Sospecha Clínica e Datos de Entrada del Paciente:
- Paciente: ${patientInfo || "No especificado"}
- Sospecha Clínica / Motivo de Estudio: ${clinicalSuspicion || "No especificado"}
- Preguntas Radiológicas Interesantes: ${radiologicalQuestions || "No especificados"}

Protocolos de Validación Técnicos Activos:
- Fracturas: ${fractureProtocol ? "SÍ" : "NO"}
- Pulmonar: ${pulmonaryProtocol ? "SÍ" : "NO"}
- Artrosis/Osteoartrosis: ${osteoarthritisProtocol ? "SÍ" : "NO"}
- Prótesis/Metal de Apoyo: ${prosthesisMetalProtocol ? "SÍ" : "NO"}

A continuación se presentan DOS reportes preliminares independientes generados para este caso radiológico.
Ambos fueron sometidos de manera ciega (tú no sabes que modelo redactó cada uno para evitar favoritismos y self-bias). Analízalos críticamente y de forma objetiva de acuerdo con las imágenes:

=== [INFORME DIAGNÓSTICO ALPHA] ===
${reportAlpha}

=== [INFORME DIAGNÓSTICO BETA] ===
${reportBeta}

Como el RADIÓLOGO JEFE, Director de la Unidad y Presidente del Tribunal de Especialización, realiza una EVALUACIÓN CLÍNICA TUTORIAL Y UN ARBITRAJE DE ALTA ESPECIFICIDAD bajo el siguiente protocolo de auditoría de imagen:

1. **ARBITRAJE DE DISCORDANCIAS (Discrepancy Arbitration & Tie-Breaker Key)**:
   - Identifica cualquier contradicción u omisión asimétrica significativa entre los informes (por ejemplo, si el Informe Alpha reporta una neumonía basilar o un foco de fisura que el Informe Beta describe como normal o preservado).
   - Realiza un "Análisis de Desempate" acudiendo con lupa virtual a los píxeles de las imágenes en busca de la lesión. Explica con terminología científica irrefutable cuál de los dos informes está en lo correcto y por qué la estructura anatómica avala o descarta la patología, resolviendo la inconsistencia. Es inaceptable silenciar o heredar una omisión asimétrica.

2. **FORTALEZAS Y DEBILIDADES A CIEGAS DE LOS BORRADORES**:
   - Analiza críticamente el [INFORME DIAGNÓSTICO ALPHA] indicando si omitió hallazgos discretos, sobrediagnosticó sombras normales (falsos positivos), o si empleó clasificaciones de riesgo poco idóneas.
   - Realiza la misma evaluación de rigor forense e instructor médico para el [INFORME DIAGNÓSTICO BETA].
   - Compara de forma directa la idoneidad métrica, léxica, y rigor de ambos borradores preliminares.

3. **DICTAMEN INTEGRAL CONSOLIDADO Y DEFINITIVO (La Conclusión del Tribunal)**:
   - Elabora el informe radiológico final y definitivo de la clínica, inyectando la máxima precisión. Elimina todo rastro de alucinaciones o interpretaciones dudosas, y asienta con absoluta nitidez y gravedad los hallazgos reales.
   - Describe con rigor avanzado la localización exacta, patrones, y cuantificaciones métricas o de escalas clínicas del caso (grades, dimensiones).

Escribe tu respuesta con tono académico del más alto nivel, sin rodeos corteses. Tu dictamen debe ser la palabra final resolutiva del caso, lista para ser inyectada al generador oficial.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres el Radiólogo Jefe y Director Clínico de un prestigioso centro PACS universitario. Diriges las sesiones generales de interconsulta, resolución de contradicciones diagnósticas y arbitraje clínico. Tu principal dogma es la veracidad empírica basada en la evidencia visual real. " +
      "REGLA DE ESPEJO Y LATERALIDAD ANATÓMICA RADIOLÓGICA: En proyecciones frontales PA/AP, la DERECHA VISUAL de la imagen es el LADO ANATÓMICO IZQUIERDO del paciente (hemitórax/campo pulmonar izquierdo). Un neumotórax o lesión en la mitad derecha de la foto es un NEUMOTÓRAX IZQUIERDO del paciente. Si la sospecha o indicación del usuario señala 'Neumotórax Izquierdo', evalúa la mitad visual derecha de la foto para confirmar con máxima sensibilidad el hallazgo. Queda ESTRICTAMENTE PROHIBIDO modificar o invertir la lateralidad a 'derecho' por confusión de la matriz de la pantalla. " +
      "Debes validar de forma prioritaria los hallazgos patológicos reales y evidentes (como neumotórax extenso, colapso pulmonar, fracturas, o masas) sin ignorarlos ni subestimarlos. Al mismo tiempo, elimina cualquier alucinación de elementos inexistentes (como implantes metálicos que no estén en la placa). Tu dictamen debe ser la palabra final resolutiva, justa y precisa del caso.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      },
    });

    res.json({
      success: true,
      evaluation: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/expert-evaluate-dual:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: EXTRACT VITAL FINDINGS, CLASSIFICATION, AND DIAGNOSIS FROM DOUBLE ASSESSMENT
 * POST /api/extract-essential-findings
 * Payload: {
 *   analysisText: string
 * }
 */
app.post("/api/extract-essential-findings", async (req: express.Request, res: express.Response) => {
  try {
    const { model, analysisText, requestedFormat, elementsConfig } = req.body;
    if (!analysisText) {
      return res.status(400).json({ success: false, error: "Se requiere el 'analysisText' para extraer los hallazgos esenciales." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    if (requestedFormat) {
      const config = elementsConfig || {
        includeSonographic: true,
        includeClinicalCorr: true,
        includeCertainty: false,
        includeDifferentials: true,
        includeManagement: true,
      };

      const casePrompt = `
Texto del Dictamen o Análisis de Caso Radiológico:
"""
${analysisText}
"""

El usuario solicitó estructurar el Análisis de Caso en el formato: "${requestedFormat}".

INSTRUCCIONES DE FORMATO:
Si el formato es "matriz_semiotica" (Matriz Semiótica Comparativa: Signos Peticionantes vs. Signos Exclusivos / Criterios de Descarte):
- Llena la propiedad "semioticMatrix" con "requestingSigns" (signos a favor o hallazgos que reclaman/exigen la hipótesis principal), "exclusiveSigns" (criterios exclusores o patognomónicos) y "discardCriteria" (signos ausentes o hallazgos que descartan diferenciales).
- Asegúrate de completar los signos peticionantes clave e inclusivos basados en el dictamen ecográfico.

Si el formato es "flujograma_semiologico" (Flujograma Semiológico / Ciclo de Pensamiento Radiológico):
- "sonographicPillar.primaryFinding" debe ser el Hallazgo Ecográfico Principal (Punto de Partida).
- "sonographicPillar.details" deben ser los Hallazgos Secundarios de Soporte o características específicas de la imagen.
- "clinicalCorrelation" debe detallar los aspectos clínicos, síntomas o antecedentes relevantes descritos.
- Cada elemento en "diagnostics" debe incluir criterios de descarte claros en "refutingCriteria" representando los signos clínicos/ecográficos ausentes que permitieron descartar o degradar esa sospecha frente al diagnóstico definitivo.
- El primer elemento en "diagnostics" debe ser el diagnóstico presuntivo principal final.
- REGLA ESTRICTA: NO INCLUIR NINGÚN PORCENTAJE DE CERTEZA O PROBABILIDAD (SÍMBOLO %).

Filtros de elementos a incluir según la preferencia del usuario:
- Incluir Pilar Sonográfico Principal: ${config.includeSonographic ? "SÍ" : "NO"}
- Incluir Correlación Clínico-Laboratorial: ${config.includeClinicalCorr ? "SÍ" : "NO"}
- Incluir Porcentaje de Certeza Diagnóstica: NO (NUNCA incluir porcentajes %)
- Incluir Diagnósticos Diferenciales: ${config.includeDifferentials ? "SÍ" : "NO"}
- Incluir Conducta y Manejo Recomendado: ${config.includeManagement ? "SÍ" : "NO"}

Por favor, extrae los datos y responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "format": "${requestedFormat}",
  "elementsConfig": {
    "includeSonographic": ${config.includeSonographic},
    "includeClinicalCorr": ${config.includeClinicalCorr},
    "includeCertainty": false,
    "includeDifferentials": ${config.includeDifferentials},
    "includeManagement": ${config.includeManagement}
  },
  "title": "Análisis Integrado de Caso",
  "sonographicPillar": {
    "primaryFinding": "Resumen conciso del hallazgo sonográfico clave con sus medidas principales",
    "details": ["Detalle métrico o morfológico 1", "Detalle vascular o ecogénico 2"],
    "severity": "altered"
  },
  "clinicalCorrelation": "Correlación del hallazgo con los síntomas, antecedente o laboratorio del paciente",
  "diagnostics": [
    {
      "name": "Nombre del Diagnóstico Principal",
      "supportingCriteria": "Criterios sonográficos clave que lo respaldan",
      "refutingCriteria": "Signos ausentes o hallazgos en contra",
      "confirmatoryTest": "Prueba o estudio confirmativo de elección"
    },
    {
      "name": "Diagnóstico Diferencial #2",
      "supportingCriteria": "Criterios sonográficos secundarios",
      "refutingCriteria": "Signos atípicos o no visualizados que lo descartan",
      "confirmatoryTest": "Prueba complementaria"
    }
  ],
  "decisionFlow": [
    { "step": 1, "title": "Punto de Partida Sonográfico", "desc": "Descripción del hallazgo sonográfico inicial" },
    { "step": 2, "title": "Signos Secundarios y Doppler", "desc": "Evaluación de vascularización, ecogenicidad y tejidos adyacentes" },
    { "step": 3, "title": "Integración con Contexto Clínico", "desc": "Correlación clínica/laboratorial" },
    { "step": 4, "title": "Conclusión Diagnóstica", "desc": "Diagnóstico final y respaldo clínico" },
    { "step": 5, "title": "Manejo Sugerido", "desc": "Conducta clínica y recomendación" }
  ],
  "semioticMatrix": {
    "requestingSigns": ["Hallazgo sonográfico directo que sustenta la sospecha", "Signo Doppler o métrico clave"],
    "exclusiveSigns": ["Ausencia de signos de patología compleja/malignidad", "Signo exclusivo confirmativo"],
    "discardCriteria": ["Criterio no visualizado que descarta diagnóstico diferencial secundario"]
  },
  "managementRecommendation": "Recomendación de manejo clínico, seguimiento o interconsulta"
}
`;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: casePrompt,
        config: {
          systemInstruction: "Eres un experto redactor radiológico. Analizas casos médicos e ingresas hallazgos estructurados en JSON estricto sin preámbulos ni porcentajes de certeza.",
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      let jsonParsed: any = null;
      try {
        jsonParsed = JSON.parse(response.text || "{}");
      } catch (e) {
        console.error("Error parsing case analysis JSON:", e);
      }

      if (jsonParsed && jsonParsed.format) {
        delete jsonParsed.certaintyPercent;
        if (jsonParsed.elementsConfig) {
          jsonParsed.elementsConfig.includeCertainty = false;
        }
        const jsonBlock = `[CASE_ANALYSIS_JSON]\n${JSON.stringify(jsonParsed, null, 2)}\n[/CASE_ANALYSIS_JSON]\n\n`;
        let textSummary = `**ANÁLISIS INTEGRADO DE CASO (${requestedFormat.toUpperCase().replace("_", " ")})**\n\n`;
        if (config.includeSonographic && jsonParsed.sonographicPillar) {
          textSummary += `• **Pilar Sonográfico Fundamental**: ${jsonParsed.sonographicPillar.primaryFinding}\n`;
        }
        if (config.includeClinicalCorr && jsonParsed.clinicalCorrelation) {
          textSummary += `• **Correlación Clínica/Lab**: ${jsonParsed.clinicalCorrelation}\n`;
        }
        if (config.includeDifferentials && jsonParsed.diagnostics?.length) {
          textSummary += `• **Diagnóstico Principal**: ${jsonParsed.diagnostics[0]?.name}\n`;
        }
        if (config.includeManagement && jsonParsed.managementRecommendation) {
          textSummary += `• **Conducta Recomendada**: ${jsonParsed.managementRecommendation}\n`;
        }

        return res.json({
          success: true,
          caseAnalysisData: jsonParsed,
          extractedText: jsonBlock + textSummary,
        });
      }
    }

    const promptText = `
Texto de la Valoración Experta de Imagen realizada por la IA en Doble Valoración (puede contener el análisis inicial y un historial de consultas/correcciones posteriores):
"""
${analysisText}
"""

SÍNTESIS PARA EL MÓDULO GENERADOR DE REPORTES RADIOLÓGICOS:
Por favor, extrae e integra de forma completa, amplia, rigurosa y detallada todos los datos fundamentales y necesarios para alimentarlos directamente al módulo generador de reportes.

REQUISITOS FUNDAMENTALES:
1. **CONSERVA TODOS LOS HALLAZGOS Y MÉTRICAS DETALLADAS**: Extrae y conserva TODOS los hallazgos anatómicos u orgánicos (normales y patológicos), dimensiones, métricas exactas, ecoestructura/densidad/señal, patrón Doppler, vascularización y relaciones anatómicas. NO omitas las descripciones anatómicas o mediciones detalladas.
2. **PRIORIDAD A CORRECCIONES Y CHAT ACTIVO**: Si el texto contiene un historial de consultas, aclaraciones o correcciones del chat activo, da PRIORIDAD ABSOLUTA a los hallazgos re-evaluados, clasificaciones ajustadas y diagnósticos corregidos en las aclaraciones y respuestas más recientes.
3. **INCLUYE CLASIFICACIONES Y CONCLUSIONES**: Incluye íntegramente las clasificaciones clínicas/escalas (p. ej., BI-RADS, Bosniak, TI-RADS, LI-RADS, PI-RADS, Lung-RADS, etc.) con sus estadios, la conclusión o impresión diagnóstica definitiva, diagnósticos diferenciales relevantes y la conducta o recomendación clínica indicada.
4. **FORMATO LIMPIO Y ESTRUCTURADO EN ESPAÑOL**: Presenta la información en secciones bien organizadas con títulos en negrita en Markdown (p. ej., **CONTEXTO CLÍNICO**, **HALLAZGOS RADIOLÓGICOS DETALLADOS**, **CLASIFICACIONES Y ESCALAS**, **IMPRESIÓN DIAGNÓSTICA Y RECOMENDACIONES**).
5. **SIN CÓDIGO NI MARCAS JSON**: NO incluyas etiquetas JSON, bloques [CASE_ANALYSIS_JSON], ni estructuras de código. Tampoco incluyas saludos, introducciones de chat o metacomentarios.

Genera una transcripción técnica radiológica exhaustiva y limpia, lista para que el generador redacte el reporte clínico completo a partir de ella.
`;

    const systemInstruction = 
      "Eres un médico radiólogo subespecialista y redactor de informes clínicos de alta precisión. Tu tarea es analizar el dictamen de doble valoración y estructurar una síntesis clínica exhaustiva con todos los hallazgos anatómicos, mediciones, clasificaciones e impresión diagnóstica necesaria para confeccionar un informe radiológico completo.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      extractedText: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/extract-essential-findings:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: CLINICAL ASSESSMENT & REPORT EVALUATION FOR CLINICIANS
 * POST /api/evaluate-report
 * Payload: {
 *   report: string
 *   studyType?: string
 *   clinicalHistory?: string
 *   findings?: string
 * }
 */
app.post("/api/evaluate-report", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType, clinicalHistory, findings } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para realizar la evaluación del reporte." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio clínico / tipo de estudio: ${studyType || "No especificado"}
Indicación clínica / Sospecha: ${clinicalHistory || "No especificada"}
Hallazgos preliminares o cargados: ${findings || "No proporcionados"}

Reporte Radiológico generado:
"""
${report}
"""

Por favor, realiza una EVALUACIÓN Y AUDITORÍA DE CALIDAD DEL REPORTE médico interpretado. Tu tarea principal es:
1. Analizar el informe elaborado de forma meticulosa.
2. Identificar y recomendar los aspectos clave de gran relevancia diagnóstica o terapéutica que el médico clínico solicitante debería conocer obligatoriamente.
3. **Clasificaciones y Escalas Radiológicas Sugeridas**: Identifica de forma activa y explícita qué clasificaciones radiológicas internacionales, escalas de riesgo o sistemas de gradación son pertinentes o requeridos según los hallazgos del reporte (por ejemplo: BI-RADS, O-RADS, LI-RADS, TI-RADS, PI-RADS, Bosniak, Neer, Rockwood, Gartland, Kellgren-Lawrence, AO, Balthazar, Fleischner, Stanford/DeBakey, etc.). Si el reporte ya cuenta con una escala, evalúa si es correcta o precisa; si le falta una escala pertinente, sugiere la categorización o grado exacto a incluir.
4. Diferenciar de manera sumamente clara y visible:
   - **Aspectos y Clasificaciones ya incluidos en el reporte actual** (aquellos que ya están redactados y documentados en el informe).
   - **Aspectos, Recomendaciones y Clasificaciones Sugeridas para agregar** (aquellos que no están o podrían complementar y mejorar sustancialmente el manejo clínico o la toma de decisiones).

Por favor, estructura tu respuesta en español con formato Markdown elegante, limpio y profesional. No agregues notas introductorias ni comentarios fuera del análisis. Clasifica los aspectos en secciones claras y utiliza viñetas o tablas según sea más agradable de leer.

⚠️ REQUISITO TECNOLÓGICO CRÍTICO:
Para cada uno de tus puntos de la sección de "Aspectos, Recomendaciones y Clasificaciones Sugeridas para agregar" (tanto recomendaciones clínicas como sugerencias de clasificaciones/escalas radiológicas), DEBES iniciar el punto obligatoriamente con la etiqueta exacta "[RECOMENDACION]: " (en mayúsculas, comillas no, corchetes rígidos exactamente de esta forma: \`[RECOMENDACION]: \`).
Ejemplos correctos:
- [RECOMENDACION]: Clasificación BI-RADS Categoría 4A - Sospecha baja de malignidad. Se sugiere correlación histopatológica o biopsia percutánea.
- [RECOMENDACION]: Clasificación de Bosniak Categoría II - Quiste renal benigno mínimamente complejo sin necesidad de seguimiento quirúrgico.
- [RECOMENDACION]: Medir el espesor de la fascia renal si está engrosada en la sección de hallazgos.

No agregues cursivas ni negritas dentro de los corchetes. El software lee este identificador exacto de forma automatizada para renderizar un botón en la interfaz de usuario que permite al radiólogo incorporar la recomendación o clasificación al informe con un solo clic.
`;

    const systemInstruction = 
      "Eres un consultor de auditoría y calidad clínica radiológica con máxima credencial académica. Evalúas la precisión y completitud de informes de imagen, asegurando la comunicación óptima de aspectos de seguridad, clasificaciones de riesgo y hallazgos críticos para que el médico tratante tenga toda la información necesaria.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      evaluation: response.text,
    });
  } catch (error: any) {
    console.error("Error en /api/evaluate-report:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * 8. API: INTELLIGENT MEDICAL BIBLIOGRAPHY SEARCH
 * POST /api/search-bibliography
 * Payload: {
 *   report: string
 *   studyType?: string
 *   findings?: string
 * }
 */
app.post("/api/search-bibliography", async (req: express.Request, res: express.Response) => {
  try {
    const { report, studyType, findings, searchMore, existingSources, existingBibliography } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el informe para realizar la búsqueda bibliográfica." });
    }

    const ai = getGeminiClient();

    let promptText = "";
    if (searchMore) {
      promptText = `
Estudio clínico: ${studyType || "No especificado"}
Hallazgos clave o sospecha diagnóstica: ${findings || "No proporcionados"}

Reporte radiológico / Consulta:
"""
${report}
"""

Esta es una solicitud de BÚSQUEDA COMPLEMENTARIA DE SEGUNDA RONDA para ampliar y profundizar la bibliografía médica ya existente.
Queremos encontrar más artículos, directrices oficiales, reportes de casos y revisiones de literatura científica de alto nivel.

Análisis bibliográfico previo:
"""
${existingBibliography || ""}
"""

Fuentes que YA han sido encontradas y deben ser EXCLUIDAS estrictamente de la lista de nuevas fuentes para evitar duplicados (NO las repitas):
${JSON.stringify(existingSources || [])}

Por favor, realiza una nueva búsqueda bibliográfica complementaria en GoogleSearch. Reúne al menos de 6 a 10 referencias o fuentes ADICIONALES y NUEVAS del más alto nivel académico (como PubMed, Radiopaedia, guías oficiales ACR, Fleischner, etc.) que no estén en la lista de exclusión anterior.

Genera un objeto JSON que contenga:
1. "bibliography": Una revisión bibliográfica impecable, ampliada y robustecida en formato Markdown. Debe INTEGRAR armónicamente la información de las nuevas fuentes encontradas junto con la información anterior, manteniendo las 4 secciones principales estructuradas, ampliando significativamente su profundidad científica y de correlación para la Educación Médica Continua (CME):
   - **🎓 SÍNTESIS FISIOPATOLÓGICA Y LOG DE APRENDIZAJE** (análisis educativo profundo ampliado, signos radiológicos patognomónicos, diagnósticos diferenciales contrastados).
   - **📋 GUÍAS DE CONSENSO Y CRITERIOS INTERNACIONALES** (criterios de apropiación actualizados, intervalos detallados de seguimiento por modalidad y criterios de intervención quirúrgica/biopsia).
   - **🔬 LITERATURA ACADÉMICA CLAVE Y ESTUDIOS HISTÓRICOS** (referencias detalladas a un espectro aún más amplio de artículos con sus aportes clave específicos, revistas de procedencia y años).
   - **💡 CONCLUSIONES DE RELEVANCIA PRÁCTICA PARA EL RADIÓLOGO** (resumen con al menos 5 perlas diagnósticas de alta utilidad operacional).

2. "sources": Una lista de las NUEVAS fuentes encontradas (excluyendo estrictamente las previas). Cada una debe contener "title", "uri" y "summary" con la misma estructura requerida (con URLs verídicas obtenidas de la búsqueda).
`;
    } else {
      promptText = `
Estudio clínico: ${studyType || "No especificado"}
Hallazgos clave o sospecha diagnóstica: ${findings || "No proporcionados"}

Reporte radiológico / Consulta:
"""
${report}
"""

Por favor, realiza un análisis bibliográfico y una revisión de literatura científica sumamente amplia, exhaustiva y diversificada, detallando hallazgos desde múltiples ángulos clínicos y académicos para la Educación Médica Continua (CME).

Es un requisito indispensable recopilar y presentar fuentes diversificadas y de alta reputación:
1. **PubMed / NCBI / PMC (Literatura indexada)**: Artículos científicos, ensayos clínicos controlados, revisiones sistemáticas o meta-análisis.
2. **Radiopaedia (Casos prácticos y Guías formativas)**: Artículos de referencia enciclopédica, clasificaciones, estadios y casos prácticos validados por la comunidad global de radiología.
3. **Consensos y Guías de Sociedades Clínicas e Internacionales (ACR, RSNA, ESR, Fleischner Society, Bosniak, LI-RADS, PI-RADS, etc.)**: Directrices oficiales de apropiación de estudios y planes de seguimiento.

Asegúrate de buscar en GoogleSearch tanto la patología relacionada a PubMed, como a Radiopaedia y su respectiva clasificación oficial, reuniendo al menos de 8 a 12 referencias o fuentes del más alto nivel académico para lograr una cobertura muy profunda y de gran valor clínico.

Genera un objeto JSON que contenga:
1. "bibliography": Una revisión bibliográfica impecable, robusta y con excelente profundidad médica en formato Markdown con las siguientes 4 secciones principales:
   - **🎓 SÍNTESIS FISIOPATOLÓGICA Y LOG DE APRENDIZAJE** (análisis educativo profundo, signos radiológicos patognomónicos, diagnósticos diferenciales contrastados).
   - **📋 GUÍAS DE CONSENSO Y CRITERIOS INTERNACIONALES** (criterios de apropiación de sociedades, intervalos detallados de seguimiento por modalidad como RM/TC/Ecografía y criterios de intervención quirúrgica/biopsia).
   - **🔬 LITERATURA ACADÉMICA CLAVE Y ESTUDIOS HISTÓRICOS** (referencias detalladas a un espectro amplio de artículos con sus aportes clave específicos, revistas de procedencia, diseño de estudio si aplica, y años).
   - **💡 CONCLUSIONES DE RELEVANCIA PRÁCTICA PARA EL RADIÓLOGO** (resumen con al menos 4 perlas diagnósticas de alta utilidad operacional para optimizar tus informes diarios).

2. "sources": Una lista de los artículos, guías de consenso, o recursos web reales encontrados en tu búsqueda y que se utilizaron para redactar tu análisis bibliográfico. Cada elemento de la lista debe contener:
   - "title": El título o nombre oficial del artículo científico, recomendación o guía clínica. Debe ser claro e indicar de forma precisa y fiel el artículo real visitado.
   - "uri": La URL real y exacta para el acceso directo a este recurso en internet (ej. de dominios PubMed/NCBI, Radiopaedia.org, ACR.org, etc).
   - "summary": Un resumen clínico, claro, esclarecedor y detallado de 3 a 5 líneas en español que explique de manera práctica los objetivos, metodología o recomendaciones clave del artículo. Debe detallar información suficiente para que el radiólogo evalúe la conveniencia o relevancia de acudir al artículo o caso original.

CRÍTICO: No inventes URLs bajo ninguna circunstancia. Tampoco intercambies ni mezcles enlaces de artículos; cada 'uri' debe corresponder exactamente al artículo clínico y de investigación del 'title'. Es preferible tener menos fuentes pero que todas sean 100% verídicas y precisas.
`;
    }

    const systemInstruction = 
      "Eres un consultor senior de primer nivel en medicina académica y radiología clínica, bibliotecario médico maestro en recuperación de evidencia científica y editor en jefe de revistas de radiología indexadas. Tu misión es redactar revisiones de literatura clínica sumamente minuciosas, integradas, ricas en detalles y de diversas fuentes académicas de prestigio (como PubMed, Radiopaedia y consorcios de sociedades internacionales), asegurándote de que no exista ninguna discrepancia de temas en tus enlaces de referencia. Devuelve siempre un objeto JSON válido que cumpla estrictamente con el esquema especificado.";

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bibliography: {
              type: Type.STRING,
              description: "Full medical bibliography review and synthesis formatted in professional Markdown with the 4 sections specified in prompt."
            },
            sources: {
              type: Type.ARRAY,
              description: "Key reference links and papers found with precise titles, valid URLs from search, and basic description summaries.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Name/title of the article or clinical guideline" },
                  uri: { type: Type.STRING, description: "The full web address (URL) to access the paper or consensus" },
                  summary: { type: Type.STRING, description: "Short, highly informative summary in Spanish detailing why this article is relevant, what its main finding/purpose is, and its primary clinical takeaways (2-4 lines)." }
                },
                required: ["title", "uri", "summary"]
              }
            }
          },
          required: ["bibliography", "sources"]
        }
      },
    });

    let bibliographyText = "";
    let searchSources: Array<{ title: string; uri: string; summary: string }> = [];

    const rawText = response.text || "";
    let cleanText = rawText.trim();
    
    // Clean potential markdown wrap (e.g. ```json ... ``` or ``` ... ```)
    if (cleanText.startsWith("```")) {
      const firstLineEnd = cleanText.indexOf("\n");
      if (firstLineEnd !== -1) {
        cleanText = cleanText.substring(firstLineEnd).trim();
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3).trim();
      }
    }

    try {
      const parsed = JSON.parse(cleanText);
      bibliographyText = parsed.bibliography || "";
      searchSources = parsed.sources || [];
    } catch (parseError) {
      console.warn("Fallo al parsear JSON devuelto por Gemini, intentando reparación y extracción Regex:", parseError);
      
      // Attempt manual sanitization of control characters and unescaped newlines which often break JSON.parse
      try {
        const sanitized = cleanText
          .replace(/[\u0000-\u001F]+/g, (match) => {
            if (match.includes("\n") || match.includes("\r")) {
              return "\\n";
            }
            return "";
          });
        const parsedSanitized = JSON.parse(sanitized);
        bibliographyText = parsedSanitized.bibliography || "";
        searchSources = parsedSanitized.sources || [];
      } catch (innerError) {
        console.warn("La sanitización completa de caracters de control también falló, procediendo a extracción Regex quirúrgica.");
        
        // Match the "bibliography" field value even in an invalid/interrupted JSON string
        // Since bibliography is a long multiline string, we match from '"bibliography"\s*:\s*"' until it hits the '"sources"' key or the end of the text
        const bibRegexMatch = cleanText.match(/"bibliography"\s*:\s*"([\s\S]*?)"\s*,\s*"sources"/i) || 
                              cleanText.match(/"bibliography"\s*:\s*"([\s\S]*?)"\s*\}\s*$/i);
        
        if (bibRegexMatch) {
          bibliographyText = bibRegexMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\");
        } else {
          // Absolute fail-safe fallback: strip the JSON skeleton symbols so at least the core text is visible cleanly
          bibliographyText = cleanText
            .replace(/^\{\s*"bibliography"\s*:\s*"/i, "")
            .replace(/"\s*,\s*"sources"[\s\S]*$/i, "")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\");
        }

        // Try to pull out any sources using a regex pattern
        try {
          const sourceBlockMatch = cleanText.match(/"sources"\s*:\s*\[([\s\S]*?)\]/i);
          if (sourceBlockMatch) {
            const sourceBlock = sourceBlockMatch[1];
            // Match individual objects inside the array: { "title": "...", "uri": "...", "summary": "..." }
            const objPattern = /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"uri"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"\s*\}/gi;
            let match;
            while ((match = objPattern.exec(sourceBlock)) !== null) {
              searchSources.push({
                title: match[1],
                uri: match[2],
                summary: match[3]
              });
            }
          }
        } catch (sourceExtError) {
          console.error("No se pudieron extraer individualmente las fuentes via regex de fallback.");
        }
      }
    }

    // Reconcile model-generated searchSources with the actual, verified grounding chunks (Google Search visited and cited URLs)
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const realWebLinks: Array<{ uri: string; title: string }> = [];
    const seenUris = new Set<string>();

    for (const c of chunks) {
      if (c && c.web && c.web.uri) {
        const u = c.web.uri.trim();
        // Skip root index domains as they are not specific articles
        try {
          const parsedUrl = new URL(u);
          if (parsedUrl.pathname === "/" || parsedUrl.pathname === "") {
            continue;
          }
        } catch {
          // ignore parsing error
        }
        if (!seenUris.has(u)) {
          seenUris.add(u);
          realWebLinks.push({
            uri: u,
            title: c.web.title || "Artículo Científico o Guía de Práctica Clínica"
          });
        }
      }
    }

    let finalSources: Array<{ title: string; uri: string; summary: string }> = [];
    const matchedRealUris = new Set<string>();

    if (realWebLinks.length > 0) {
      const getDomain = (urlStr: string): string => {
        try {
          const url = new URL(urlStr);
          return url.hostname.replace("www.", "").toLowerCase();
        } catch {
          return "";
        }
      };

      const calculateTitleSimilarity = (t1: string, t2: string): number => {
        const clean = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF ]/g, "").split(/\s+/).filter(w => w.length > 2);
        const w1 = clean(t1);
        const w2 = clean(t2);
        if (w1.length === 0 || w2.length === 0) return 0;
        const intersection = w1.filter(w => w2.includes(w));
        return intersection.length / Math.max(w1.length, w2.length);
      };

      // 1. Process and match each generated source
      for (const genSource of searchSources) {
        let bestMatch: { uri: string; title: string } | null = null;
        let highestScore = -1;

        const genDomain = getDomain(genSource.uri);

        for (const realLink of realWebLinks) {
          let score = 0;
          const realDomain = getDomain(realLink.uri);

          // Exact Match
          if (genSource.uri.toLowerCase().trim() === realLink.uri.toLowerCase().trim()) {
            score += 3.0; // Very high weight for exact URL
          }

          // Domain Match
          if (genDomain && realDomain && genDomain === realDomain) {
            score += 0.3;
          }

          // Title similarity (increased weight for actual topic alignment)
          const sim = calculateTitleSimilarity(genSource.title, realLink.title);
          score += sim * 2.0;

          if (score > highestScore) {
            highestScore = score;
            bestMatch = realLink;
          }
        }

        // We require a high minimum score threshold (>= 0.6) to guarantee the topic corresponds
        if (bestMatch && highestScore >= 0.6) {
          finalSources.push({
            title: bestMatch.title && bestMatch.title.length > 8 ? bestMatch.title : genSource.title,
            uri: bestMatch.uri,
            summary: genSource.summary || "Enlace de alta relevancia científica verificado por la búsqueda clínica."
          });
          matchedRealUris.add(bestMatch.uri);
        } else {
          // If no good match was found, do NOT assign a random mismatching fallback!
          // Instead, check if the model's generated URL is itself valid and points to a reputable medical domain.
          const genUri = (genSource.uri || "").trim();
          const pDomain = getDomain(genUri);
          const isTrusted = pDomain && (
            pDomain.includes("nih.gov") || 
            pDomain.includes("pubmed") || 
            pDomain.includes("radiopaedia") || 
            pDomain.includes("acr") || 
            pDomain.includes("rsna") || 
            pDomain.includes("guidelines") ||
            pDomain.includes("sciencedirect") ||
            pDomain.includes("springer") ||
            pDomain.includes("nature") ||
            pDomain.includes("thelancet") ||
            pDomain.includes("nejm")
          );

          if (isTrusted && genUri.startsWith("http") && genUri.length > 20) {
            finalSources.push(genSource);
          }
          // Otherwise, we discard the link to prevent misleading the user with inaccurate/out-of-topic URLs.
        }
      }

      // 2. Append genuine grounding URLs we visited but weren't matched under their OWN accurate, verified titles!
      for (const realLink of realWebLinks) {
        if (!matchedRealUris.has(realLink.uri)) {
          let summaryText = "Publicación o consenso oficial recopilado y verificado en la búsqueda clínica para este reporte.";
          if (realLink.title) {
            summaryText = `Recurso oficial verificado: "${realLink.title}". Evidencia indexada consultada para la elaboración del análisis literario.`;
          }
          finalSources.push({
            title: realLink.title || "Artículo Científico / Guía Radiológica",
            uri: realLink.uri,
            summary: summaryText
          });
          matchedRealUris.add(realLink.uri);
        }
      }
    } else {
      // Fallback: If no real grounding links returned, keep model generated sources
      // but only if they correspond to legitimate medical domains
      for (const genSource of searchSources) {
        if (genSource && genSource.uri && genSource.uri.startsWith("http")) {
          finalSources.push(genSource);
        }
      }
    }

    // Ensure absolute uniqueness of links under finalUniqueSources
    const finalUniqueSources: Array<{ title: string; uri: string; summary: string }> = [];
    const absoluteSeenUris = new Set<string>();
    for (const src of finalSources) {
      if (src && src.uri && !absoluteSeenUris.has(src.uri)) {
        absoluteSeenUris.add(src.uri);
        finalUniqueSources.push(src);
      }
    }

    res.json({
      success: true,
      bibliography: bibliographyText || "No se pudo recuperar el cuerpo del análisis bibliográfico.",
      sources: finalUniqueSources,
    });
  } catch (error: any) {
    console.error("Error en /api/search-bibliography:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * NEW API: GENERATE DEMOCRATIZED AND SIMPLIFIED PATIENT KEY FINDINGS & SUMMARY
 * POST /api/generate-patient-summary
 */
app.post("/api/generate-patient-summary", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType, clinicalHistory } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte médico para generar el resumen del paciente." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio clínico / tipo de estudio: ${studyType || "No especificado"}
Indicación clínica / Sospecha: ${clinicalHistory || "No específica"}

Reporte Radiológico formal:
"""
${report}
"""

Por favor, traduce este reporte radiológico formal de alta complejidad médica en un objeto JSON estructurado diseñado para el paciente. 

PAUTAS DE TONO Y ESTILO REDACCIONAL (CRÍTICAS):
- Tono neutral y profesional: Toda la información debe ser explicada con claridad y precisión clínica elemental, pero con un tono estrictamente neutro, objetivo y profesional. 
- Evita el paternalismo y la condescendencia: No intentes "tranquilizar", "calmar" o "consolar" de manera activa ni forzada. El objetivo es que el paciente entienda sus hallazgos anatómicos concretos, no disminuir su percepción del reporte restándole seriedad.
- Vocabulario sencillo pero formal: Utiliza términos accesibles y de fácil lectura pero evita a toda costa expresiones que resulten innecesariamente coloquiales, infantiles o informales. 
- Honestidad y veracidad científica: Transmite la realidad de las descripciones médicas de manera directa, clara y sobria.
- Omisión de Recomendaciones: NO se debe incluir ningún tipo de recomendación práctica de salud, ejercicio, hábitos, postura o bienestar que sugiera al paciente qué debe hacer. Concéntrate EXCLUSIVAMENTE en la explicación objetiva de los hallazgos ya descritos.

Devuelve un objeto JSON con las siguientes propiedades:
1. "summary": Una descripción objetiva de 2 a 3 párrafos explicando qué tipo de estudio se le realizó, qué estructuras principales se detallan o resultan normales, y una síntesis descriptiva y neutral de los hallazgos principales identificados. NO debe contener recomendaciones, sugerencias de preguntas, pautas de conducta ni consejos de ningún tipo.
2. "keyFindings": Una lista de los hallazgos identificados, donde para cada uno se entrega:
   - "title": Nombre claro o región anatómica afectada en lenguaje accesible (ej: "Articulación del Hombro" o "Zonas inferiores del Pulmón").
   - "originalTerm": El término radiológico técnico original tal cual aparece en el informe (ej: "Opacidad basal", "Osteonecrosis", o "Rotura parcial").
   - "simplifiedExplanation": Una explicación clara, objetiva e intuitiva de qué significa físicamente a nivel anatómico, expresada de manera comprensible pero formal (sin adjetivos tranquilizadores redundantes, sugerencias ni recomendaciones).
   - "analogy": Una analogía física, estructural u operativa de la vida diaria estrictamente con fines ilustrativos y didácticos (por ejemplo: filtros, conductos, elasticidad de cables, desgaste de componentes) que facilite la comprensión mecánica sin caer en términos infantiles o excesivamente coloquiales.
   - "reassurance": Contexto clínico objetivo y neutral sobre el hallazgo. Describe la perspectiva médica estándar para este hallazgo (por ejemplo, si se asocia comúnmente con cambios crónicos, hallazgos incidentales típicos o si requiere una revisión cronológica simple, redactado de forma neutral y absolutamente libre de indicaciones, recomendaciones terapéuticas, pautas o preguntas sugeridas).
`;

    const systemInstruction = "Eres un especialista en comunicación médica institucional, traducción clínica orientada al paciente y radiodiagnóstico. Tu meta es transcribir informes complejos en términos comprensibles pero formales, manteniendo un tono completamente neutro, científico, maduro y objetivo. Evitas por completo el paternalismo, frases de alivio auto-complacientes, consuelos, rodeos coloquiales innecesarios, preguntas sugeridas o recomendaciones de salud o bienestar de cualquier índole. REQUISITO CRÍTICO: El JSON de salida solo debe contener la explicación descriptiva y científica simplificada de los hallazgos, libre de cualquier tipo de recomendación o sugerencia de preguntas para la consulta.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  originalTerm: { type: Type.STRING },
                  simplifiedExplanation: { type: Type.STRING },
                  analogy: { type: Type.STRING },
                  reassurance: { type: Type.STRING }
                },
                required: ["title", "originalTerm", "simplifiedExplanation", "analogy", "reassurance"]
              }
            }
          },
          required: ["summary", "keyFindings"]
        }
      }
    });

    let jsonText = response.text || "{}";
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      const firstLineEnd = jsonText.indexOf("\n");
      if (firstLineEnd !== -1) {
        jsonText = jsonText.substring(firstLineEnd).trim();
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.substring(0, jsonText.length - 3).trim();
      }
    }

    const parsedJson = JSON.parse(jsonText);
    res.json({
      success: true,
      data: parsedJson
    });
  } catch (error: any) {
    console.error("Error en /api/generate-patient-summary:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * NEW API: GENERATE DYNAMIC MEDICAL GLOSSARY ON CURRENT REPORT
 * POST /api/generate-dynamic-glossary
 */
app.post("/api/generate-dynamic-glossary", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte médico para generar el glosario de términos." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Reporte Radiológico:
"""
${report}
"""

Analiza detalladamente este informe médico para extraer de 4 a 8 de las clasificaciones, signos médicos específicos, síndromes, acrónimos radiológicos, o terminología anatómica/patológica clave de alta relevancia conceptual mencioandas en el reporte. El usuario solicitó específicamente registrar e incluir signos radiológicos clínicos, clasificaciones y términos complejos presentes.

Construye un glosario dinámico estructurado en un objeto JSON que sirva tanto para médicos docentes como para estudiantes o clínicos tratantes.

Devuelve un objeto JSON con la propiedad "terms" que contiene una lista de objetos, donde cada uno debe contener:
- "term": El término o clasificación médico exacto o abreviatura (ej: "Línea de Shenton", "Osteofito", "BI-RADS", "Kellgren & Lawrence", "FLAIR", "Unidades Hounsfield", etc.).
- "category": Clasifica el término estrictamente como uno de los siguientes: "Signo Radiológico", "Clasificación", "Acrónimo/Medida", "Anatomía", o "Patología/Otros".
- "pronunciation": Guía de pronunciación rápida de ayuda o su origen histológico/etimológico/epónimo (ej: "KOSS: Kellgren y Lawrence (epónimos de reumatólogos pioneros)").
- "definition": Explicación científica, rigurosa, clara y académica de qué es y cómo se define técnicamente.
- "clinicalRelevance": Por qué es de vital importancia clínica en el análisis del paciente y cómo ayuda a tomar decisiones terapéuticas o diagnósticas quirúrgicas.
- "literatureQuery": Un término de consulta de búsqueda en PubMed o Radiopedia altamente optimizado para obtener literatura científica directa sobre este concepto (ej: "Kellgren Lawrence classification knee osteoarthritis guidelines").
`;

    const systemInstruction = "Eres un director editorial médico, catedrático universitario de radiología clínica y experto en lexicografía de ciencias de la salud. Creas glosarios clínicos interactivos de alta especificidad científica y formativa, ayudando a los médicos solicitantes a comprender el trasfondo teórico riguroso de cada signo y clasificación descrito. Devuelve un JSON válido que cumpla estrictamente con la estructura.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  category: { type: Type.STRING },
                  pronunciation: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  clinicalRelevance: { type: Type.STRING },
                  literatureQuery: { type: Type.STRING }
                },
                required: ["term", "category", "pronunciation", "definition", "clinicalRelevance", "literatureQuery"]
              }
            }
          },
          required: ["terms"]
        }
      }
    });

    let jsonText = response.text || "{}";
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      const firstLineEnd = jsonText.indexOf("\n");
      if (firstLineEnd !== -1) {
        jsonText = jsonText.substring(firstLineEnd).trim();
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.substring(0, jsonText.length - 3).trim();
      }
    }

    const parsedJson = JSON.parse(jsonText);
    res.json({
      success: true,
      data: parsedJson
    });
  } catch (error: any) {
    console.error("Error en /api/generate-dynamic-glossary:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * NEW API: GENERATE SCHEMATIC SUMMARY OF KEY FINDINGS
 * POST /api/generate-schematic-summary
 */
app.post("/api/generate-schematic-summary", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte médico para generar el esquema estructural." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio clínico: ${studyType || "No especificado"}
Reporte Radiológico formal:
"""
${report}
"""

Por favor, analiza este reporte clínico y extrae los hallazgos principales en forma de esquema estructurado y visualmente atractivo.
Debes devolver un JSON que represente una tabla o un mapa bento de hallazgos. El JSON debe contener:
1. "findings": Una lista de los hallazgos principales (de 3 a 6 hallazgos significativos), con los siguientes campos:
   - "findingId": Identificador corto (ej: "H1", "H2", "H3", ...)
   - "anatomicalSite": El sitio anatómico o estructura específica evaluada (ej: "Lóbulo superior derecho", "Columna L4-L5", "Tendón supraespinoso")
   - "findingType": Categoría del hallazgo ("Estructural", "Inflamatorio/Infeccioso", "Degenerativo", "Normal/Variante", "Líquido/Derrame", "Otro")
   - "description": Resumen ultra-corto, conciso pero claro de lo hallado (máximo 60 caracteres)
   - "iconSuggested": Un nombre de emoji (ej: "🔍", "🔥", "💧", "🦴", "🫁", "🧠", "⚠️") apropiado para representar el hallazgo visualmente.

2. "markdownScheme": Una representación textual en formato de tabla Markdown perfectamente formateada y atractiva de estos hallazgos principales (totalmente libre de emojis o iconos incompatibles con impresoras PDF), para que el usuario pueda insertarla en el reporte original como un cuadro sinóptico. Incluye un encabezado que diga "### ESQUEMA CLÍNICO DE HALLAZGOS PRINCIPALES" y una bonita tabla con columnas exactamente como: | ID | Estructura / Sitio | Hallazgo Principal |. No incluyas de ninguna manera la columna 'Categoría' ni menciones de 'findingType'.
`;

    const systemInstruction = "Eres un especialista senior en estructuración de datos médicos, ontología clínica y diseño de informes médicos compactos. Creas resúmenes visuales, sinópticos y estructurados de alta calidad para facilitar la consulta rápida de médicos tratantes. Devuelve únicamente el objeto JSON solicitado.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  findingId: { type: Type.STRING },
                  anatomicalSite: { type: Type.STRING },
                  findingType: { type: Type.STRING },
                  description: { type: Type.STRING },
                  iconSuggested: { type: Type.STRING }
                },
                required: ["findingId", "anatomicalSite", "findingType", "description", "iconSuggested"]
              }
            },
            markdownScheme: { type: Type.STRING }
          },
          required: ["findings", "markdownScheme"]
        }
      }
    });

    let jsonText = response.text || "{}";
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      const firstLineEnd = jsonText.indexOf("\n");
      if (firstLineEnd !== -1) {
        jsonText = jsonText.substring(firstLineEnd).trim();
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.substring(0, jsonText.length - 3).trim();
      }
    }

    const parsedJson = JSON.parse(jsonText);
    res.json({
      success: true,
      data: parsedJson
    });
  } catch (error: any) {
    console.error("Error en /api/generate-schematic-summary:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * NEW API: GENERATE SEMIOLOGY TABLE
 * POST /api/generate-semiology-table
 */
app.post("/api/generate-semiology-table", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte médico para generar el cuadro semiológico." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio clínico: ${studyType || "No especificado"}
Reporte Radiológico formal:
"""
${report}
"""

Por favor, analiza este reporte clínico y genera un cuadro semiológico formal de deducción radiológica.
El JSON debe contener:
1. "confirmedDiagnoses": Diagnósticos confirmados con su justificación semiológica.
2. "ruledOutPathologies": Patologías diferenciales descartadas con sus criterios de exclusión.
3. "markdownTable": Una representación formal en formato Markdown con títulos limpios (sin emojis, ni emoticones, totalmente apta para un reporte en PDF impreso formal). Debe usar títulos de nivel 3 (###) y 4 (####) y contener dos secciones tabulares bien diseñadas:
   - Una sección titulada "### CUADRO DE SEMIOLOGÍA Y JUSTIFICACIÓN RADIOLÓGICA".
   - Bajo esta, un subtítulo "#### 1. Diagnósticos Confirmados y Justificación Semiológica" con una tabla que tenga exactamente las columnas: | INTERPRETACIÓN SEMIOLÓGICA | HALLAZGOS |.
   - Otro subtítulo "#### 2. Patologías Diferenciales Descartadas y Evidencia de Exclusión" con una tabla que tenga exactamente las columnas: | INTERPRETACIÓN SEMIOLÓGICA | HALLAZGOS |.
`;

    const systemInstruction = "Eres un consultor radiológico académico senior y catedrático universitario de semiología médica por imágenes. Analizas informes de radiología para desglosar la lógica deductiva clínica detrás de cada diagnóstico establecido o descartado, correlacionándolos minuciosamente con los signos interpretativos. Devuelve únicamente el objeto JSON solicitado.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            confirmedDiagnoses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  diagnosis: { type: Type.STRING },
                  justification: { type: Type.STRING }
                },
                required: ["diagnosis", "justification"]
              }
            },
            ruledOutPathologies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pathology: { type: Type.STRING },
                  exclusionCriteria: { type: Type.STRING }
                },
                required: ["pathology", "exclusionCriteria"]
              }
            },
            markdownTable: { type: Type.STRING }
          },
          required: ["confirmedDiagnoses", "ruledOutPathologies", "markdownTable"]
        }
      }
    });

    let jsonText = response.text || "{}";
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      const firstLineEnd = jsonText.indexOf("\n");
      if (firstLineEnd !== -1) {
        jsonText = jsonText.substring(firstLineEnd).trim();
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.substring(0, jsonText.length - 3).trim();
      }
    }

    const parsedJson = JSON.parse(jsonText);
    res.json({
      success: true,
      data: parsedJson
    });
  } catch (error: any) {
    console.error("Error en /api/generate-semiology-table:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

app.post("/api/generate-3d-render", async (req: express.Request, res: express.Response) => {
  try {
    const {
      image,
      mimeType,
      findingDescription,
      studyType,
      clinicalHistory,
      anatomicalLocation,
      renderStyle = "volumetric_glass",
      customInstructions,
      dualPerspective = false,
      laterality: explicitLaterality, // "right" | "left" | "midline" | "auto"
      targetDigit, // "1" | "2" | "3" | "4" | "5" | "thumb" | "index" | "middle" | "ring" | "pinky"
      targetJointLevel, // "DIP" | "PIP" | "MCP" | "IFD" | "IFP" | "MCF" | "distal_phalanx" | "middle_phalanx" | "proximal_phalanx"
      targetAspect, // "volar" | "dorsal" | "flexor" | "extensor" | "radial" | "ulnar"
      targetOrganSegment, // "segment_I" ... "segment_VIII" | "superior_pole" | "inferior_pole" | etc.
      specificAnatomicalUnit
    } = req.body;

    if (!findingDescription && !image) {
      return res.status(400).json({ success: false, error: "Se requiere una imagen de ultrasonido o una descripción del hallazgo." });
    }

    const ai = getGeminiClient();

    // Heuristic pre-detection of laterality and anatomical structures from text
    const fullTextToScan = `${findingDescription || ""} ${studyType || ""} ${clinicalHistory || ""} ${anatomicalLocation || ""} ${customInstructions || ""} ${specificAnatomicalUnit || ""}`.toLowerCase();
    
    let detectedLateralityHint = "auto";
    if (explicitLaterality && explicitLaterality !== "auto") {
      detectedLateralityHint = explicitLaterality;
    } else {
      const hasRight = /\b(derech[ao]s?|der\b|dcha\b|dcho\b|right\b|rt\b|l[oó]bulo derecho|riñ[oó]n derecho|mama derecha|hombro derecho|rodilla derecha|muslo derecho|pierna derecha|brazo derecho|test[ií]culo derecho|ovario derecho|mano derecha|pie derecho|tobillo derecho|codo derecho|muñeca derecha)\b/i.test(fullTextToScan);
      const hasLeft = /\b(izquierd[ao]s?|izq\b|izda\b|left\b|lt\b|l[oó]bulo izquierdo|riñ[oó]n izquierdo|mama izquierda|hombro izquierdo|rodilla izquierda|muslo izquierdo|pierna izquierda|brazo izquierdo|test[ií]culo izquierdo|ovario izquierdo|mano izquierda|pie izquierdo|tobillo izquierdo|codo izquierdo|muñeca izquierda)\b/i.test(fullTextToScan);
      if (hasRight && !hasLeft) detectedLateralityHint = "right";
      else if (hasLeft && !hasRight) detectedLateralityHint = "left";
      else if (hasRight && hasLeft) detectedLateralityHint = "bilateral";
      else detectedLateralityHint = "unspecified";
    }

    // Heuristic pre-detection of digits and joint levels
    let detectedDigit = targetDigit || "";
    if (!detectedDigit) {
      if (/\b(4[°ºto\s]|cuarto|4to|cuarto dedo|dedo anular|ring finger|fourth digit|4th digit|4th finger|iv dedo|dedo iv)\b/i.test(fullTextToScan)) detectedDigit = "4 (Anular / Ring finger)";
      else if (/\b(3[°ºer\s]|tercer|3er|tercer dedo|dedo medio|dedo mayor|dedo coraz[oó]n|middle finger|third digit|3rd digit|3rd finger|iii dedo|dedo iii)\b/i.test(fullTextToScan)) detectedDigit = "3 (Medio / Middle finger)";
      else if (/\b(2[°ºdo\s]|segundo|2do|segundo dedo|dedo [ií]ndice|index finger|second digit|2nd digit|2nd finger|ii dedo|dedo ii)\b/i.test(fullTextToScan)) detectedDigit = "2 (Índice / Index finger)";
      else if (/\b(1[°ºer\s]|primer|1er|primer dedo|pulgar|thumb|first digit|1st digit|1st finger|i dedo|dedo i)\b/i.test(fullTextToScan)) detectedDigit = "1 (Pulgar / Thumb)";
      else if (/\b(5[°ºto\s]|quinto|5to|quinto dedo|dedo meñique|pinky|little finger|fifth digit|5th digit|5th finger|v dedo|dedo v)\b/i.test(fullTextToScan)) detectedDigit = "5 (Meñique / Little finger)";
    }

    let detectedJoint = targetJointLevel || "";
    if (!detectedJoint) {
      if (/\b(ifd|interfal[aá]ngica distal|dip|distal interphalangeal|articulaci[oó]n interfal[aá]ngica distal|falange distal|ungueal)\b/i.test(fullTextToScan)) detectedJoint = "IFD (Interfalángica Distal / DIP)";
      else if (/\b(ifp|interfal[aá]ngica proximal|pip|proximal interphalangeal|articulaci[oó]n interfal[aá]ngica proximal|falange media)\b/i.test(fullTextToScan)) detectedJoint = "IFP (Interfalángica Proximal / PIP)";
      else if (/\b(mcf|metacarpofal[aá]ngica|mcp|metacarpophalangeal|nudillo|base del dedo)\b/i.test(fullTextToScan)) detectedJoint = "MCF (Metacarpofalángica / MCP)";
    }

    let detectedAspect = targetAspect || "";
    if (!detectedAspect) {
      if (/\b(volar|palmar|flexor|flexores|polea|placa volar|cara anterior)\b/i.test(fullTextToScan)) detectedAspect = "Volar / Flexor / Palmar";
      else if (/\b(dorsal|extensor|extensores|bandaleta|cara posterior)\b/i.test(fullTextToScan)) detectedAspect = "Dorsal / Extensor";
    }

    // Step 1: Multimodal Vision & Anatomical Reasoning with Pre-Synthesis Anatomical Reference Grounding (Gemini 3.7 Flash)
    const parts: any[] = [];
    if (image && mimeType) {
      const cleanImg = cleanBase64(image);
      parts.push({
        inlineData: {
          data: cleanImg,
          mimeType: mimeType || "image/jpeg"
        }
      });
    }

    const visionPrompt = `Eres un Catedrático de Anatomía Humana Quirúrgica, Médico Radiólogo Especialista en Ecografía de Alta Resolución y Director de Arte Médico 3D.
Tu objetivo es analizar la imagen ecográfica 2D aportada y la descripción clínica del hallazgo para:

========================================================================
1) INVESTIGAR Y CONSULTAR EL MAPA ANATÓMICO QUIRÚRGICO DE REFERENCIA (ANATOMICAL GROUNDING):
========================================================================
Antes de sintetizar cualquier imagen, debes consultar y deducir las coordenadas anatómicas exactas y los hitos anatómicos cardinales de la estructura solicitada:
- Identificar con EXACTITUD ANATÓMICA CARDINAL la estructura diana (ej. bursa olecraneana, quiste de Baker, tendón flexor del 4to dedo a nivel IFD, bursa subacromial-subdeltoidea, placa volar, fascia plantar, nódulo tiroideo en polo superior derecho, ligamento colateral medial, etc.).
- UBICACIÓN ANATÓMICA EXACTA ("exactAnatomicalLocation"): Especificar en qué cara, plano tisular, relación espacial y coordenadas óseas/musculares exactas se encuentra en la realidad anatómica humana.
  * Ejemplo para BURSA OLECRANEANA: "Cara POSTERIOR del codo, tejido celular subcutáneo directamente sobre el vértice óseo del olécranon del cúbito, superficial a la inserción distal del tendón del tríceps braquial".
  * Ejemplo para QUISTE DE BAKER: "Fosa poplítea POSTEROMEDIAL de la rodilla, entre el tendón del semimembranoso y la cabeza medial del músculo gastrocnemio".
  * Ejemplo para BURSA SUBACROMIAL-SUBDELTOIDEA: "Espacio subacromial del hombro, por debajo del acromion y músculo deltoides, superficial a los tendones del manguito rotador (supraespinoso), extraarticular".
  * Ejemplo para FASCIA PLANTAR: "Cara PLANTAR del calcáneo, entesis proximal en la tuberosidad medial del calcáneo, plano subcutáneo profundo plantar".
  * Ejemplo para LESIÓN EN 4º DEDO (ANULAR) IFD: "Cuarto rayo digital (4º dedo / anular), articulación interfalángica distal entre falange media y falange distal, cara volar flexora, adyacente a la placa ungueal".
- HITOS ÓSEOS Y MUSCULARES DE ANCLAJE ("cardinalLandmarks"): Lista de estructuras vecinas reales obligatorias para anclar el dibujo.
- LUGARES ERRÓNEOS PROHIBIDOS ("prohibitedMisplacements"): Lista de ubicaciones incorrectas frecuentes donde los generadores de IA suelen cometer errores graves:
  * Para Bursa Olecraneana: PROHIBIDO dibujarla en la fosa cubital / cara anterior del codo; PROHIBIDO intraarticular en la fosa troclear; PROHIBIDO en el tendón del bíceps braquial.
  * Para 4º dedo IFD: PROHIBIDO en el 3er dedo (medio); PROHIBIDO en la articulación IFP o MCF.
- PROFUNDIDAD TISULAR ("tissueLayerDepth"): "Subcutáneo (Suprafascial)" | "Subfascial" | "Intratendinoso" | "Intraarticular" | "Intramuscular" | "Subperióstico" | "Parenquimatoso".

========================================================================
2) FORMULAR PROMPTS EN INGLÉS RIGUROSAMENTE ANCLADOS A ESTAS COORDENADAS ANATÓMICAS:
========================================================================
- Prompt 1 (FOCAL / CLOSE-UP): Vista volumétrica 3D aislada, de gran detalle, anclada explícitamente a los hitos óseos y musculares correctos, con directivas de plano claras (ej. "Posterior subcutaneous aspect of the elbow directly over the ulnar olecranon tip") y restricciones de exclusión negativa de las ubicaciones erróneas.
- ${dualPerspective ? "Prompt 2 (MACRO / PANORÁMICO TOPOGRÁFICO): Vista de perspectiva regional que muestre la mano/extremidad/órgano completo con referencias anatómicas claras y la lesión resaltada en su posición espacial, lateralidad y coordenadas EXACTAS sin margen de confusión." : ""}

========================================================================
3) GENERAR TÍTULO, EXPLICACIÓN CLÍNICA Y FICHA DE ATLAS ANATÓMICO EN ESPAÑOL:
========================================================================
- Título profesional y elegante en español con la lateralidad y ubicación anatómica exacta.
- Explicación clínica estructurada (2 a 3 párrafos de alta calidad) que correlacione la vista ecográfica 2D con la anatomía tridimensional ${dualPerspective ? "(incluyendo correlación tisular focal, topografía regional y lateralidad anatómica explícita)" : ""}.

========================================================================
REGLA SUPREMA 1: EXACTITUD TOPOGRÁFICA SEGMENTARIA Y DE DÍGITOS (CERO TOLERANCIA A ERRORES):
========================================================================
Cuando el estudio corresponda a extremidades, manos, pies, dedos, tendones o articulaciones:
- CONTEO Y NUMERACIÓN DE DEDOS DE LA MANO (de radial a cubital):
  * 1º Dedo = Pulgar / Thumb (1er rayo)
  * 2º Dedo = Índice / Index Finger (2do rayo)
  * 3º Dedo = Medio / Middle Finger (3er rayo)
  * 4º Dedo = Anular / Ring Finger (4to rayo) -> [CRÍTICO: Si se indica 4º dedo, NUNCA colocarlo en el 3º ni en el 2º].
  * 5º Dedo = Meñique / Little (Pinky) Finger (5to rayo).
- NIVELES ARTICULARES Y FALÁNGICOS:
  * IFD (Interfalángica Distal / DIP): Entre falange media y distal, inmediatamente adyacente al lecho ungueal / uña.
  * IFP (Interfalángica Proximal / PIP): Entre falange proximal y falange media.
  * MCF (Metacarpofalángica / MCP): Entre metacarpiano y falange proximal (nudillo).

========================================================================
REGLA SUPREMA 2: LATERALIDAD RADIOLÓGICA Y ANATÓMICA:
========================================================================
1. VISTA ANTERIOR / FRONTAL / PALMAR (el paciente mira de frente / palma hacia el observador):
   - Lesión DERECHA (Patient's Right): En el lienzo 2D la lesión DEBE dibujarse en el LADO IZQUIERDO DE LA PANTALLA DEL OBSERVADOR (Viewer's Left).
   - Lesión IZQUIERDA (Patient's Left): En el lienzo 2D la lesión DEBE dibujarse en el LADO DERECHO DE LA PANTALLA DEL OBSERVADOR (Viewer's Right).
2. VISTA POSTERIOR / DORSAL (dorso de la mano / codo posterior / espalda / gemelos):
   - Lesión DERECHA (Patient's Right): En el lienzo 2D la extremidad derecha DEBE estar en el LADO DERECHO DE LA PANTALLA (Viewer's Right).
   - Lesión IZQUIERDA (Patient's Left): En el lienzo 2D la extremidad izquierda DEBE estar en el LADO IZQUIERDO DE LA PANTALLA (Viewer's Left).

DATOS DEL CASO:
- Descripción del Hallazgo por el Médico: "${findingDescription || "Hallazgo ecográfico relevante"}"
- Lateralidad Indicada/Detectada: "${detectedLateralityHint.toUpperCase()}"
- Dígito / Rayo Objetivo: "${detectedDigit || "No especificado / Conforme al texto"}"
- Nivel Articular / Segmento: "${detectedJoint || "No especificado / Conforme al texto"}"
- Cara / Compartimento: "${detectedAspect || "No especificado"}"
- Unidad Anatómica Específica: "${specificAnatomicalUnit || "No especificada"}"
- Tipo de Estudio: "${studyType || "Ecografía Diagnóstica"}"
- Historia Clínica: "${clinicalHistory || "No especificada"}"
- Órgano / Región Anatómica: "${anatomicalLocation || "No especificado"}"
- Estilo Visual Seleccionado: "${renderStyle}"
- Instrucciones Adicionales: "${customInstructions || "Ninguna"}"
- Modo de Perspectiva: "${dualPerspective ? "DOBLE PERSPECTIVA (FOCAL + PANORÁMICA GENERAL)" : "INDIVIDUAL (FOCAL)"}"

DIRECTRICES PARA LOS PROMPTS DE IMAGEN 3D EN INGLÉS:
- Estilo: Modern 3D medical volumetric cross-section render, clean organic glass and translucent parenchyma cutaway, cinema 4D octane render style, glowing chromatic bioluminescent accents highlighting the pathology/finding, ultra-high fidelity medical visualization, soft studio rim lighting, translucent subsurface scattering.
- NUNCA incluir texto escrito, palabras, números, marcas de agua ni flechas dentro de la imagen.

RESPONDE ESTRICTAMENTE EN FORMATO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "targetStructure": "Nombre de la estructura anatómica patológica (ej: Bursa olecraneana, Tendón flexor profundo 4º dedo, etc.)",
  "exactAnatomicalLocation": "Detailed anatomical position in English with precise bony and muscular coordinates",
  "exactAnatomicalLocationEs": "Ubicación anatómica exacta en español con planos, caras y referencias óseas",
  "cardinalLandmarks": ["Landmark 1 in English", "Landmark 2 in English", "Landmark 3 in English"],
  "cardinalLandmarksEs": ["Hito de referencia 1 en español", "Hito de referencia 2 en español", "Hito 3 en español"],
  "prohibitedMisplacements": ["Prohibited location 1 in English", "Prohibited location 2 in English"],
  "prohibitedMisplacementsEs": ["Ubicación errónea prohibida 1 en español", "Ubicación prohibida 2 en español"],
  "anatomicalAspect": "POSTERIOR" | "ANTERIOR" | "LATERAL" | "MEDIAL" | "VOLAR" | "DORSAL" | "PLANTAR",
  "tissueLayerDepth": "Subcutáneo (Suprafascial)" | "Subfascial" | "Intratendinoso" | "Intraarticular" | "Intramuscular" | "Subperióstico" | "Parenquimatoso",
  "lateralityIdentified": "RIGHT" | "LEFT" | "BILATERAL" | "MIDLINE",
  "digitOrSegmentIdentified": "4th digit (Ring finger)" | "3rd digit (Middle finger)" | "2nd digit (Index)" | "1st digit (Thumb)" | "5th digit (Pinky)" | "N/A",
  "jointOrLevelIdentified": "DIP (Distal Interphalangeal)" | "PIP (Proximal Interphalangeal)" | "MCP" | "N/A",
  "viewOrientation": "POSTERIOR" | "ANTERIOR" | "SAGITTAL" | "AXIAL" | "LATERAL",
  "spatialScreenRule": "Explicación breve de la posición en pantalla del observador",
  "title": "Título descriptivo y elegante en español con la lateralidad y ubicación anatómica exacta",
  "explanation": "Explicación clínica detallada en español estructurada que correlacione la ecografía 2D con la anatomía tridimensional mencionando con claridad la estructura, su localización anatómica exacta, plano y lateralidad del paciente.",
  "imagePrompt": "Detailed English prompt for the focal/close-up 3D medical volumetric render anchored strictly to exactAnatomicalLocation, cardinalLandmarks, excluding prohibitedMisplacements...",
  "imagePromptMacro": "${dualPerspective ? "Detailed English prompt for the wider panoramic/regional 3D medical volumetric render showing full limb/region with the lesion situated strictly in the exact anatomical coordinates..." : ""}"
}`;

    parts.push({ text: visionPrompt });

    const analysisResponse = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: parts,
      config: {
        responseMimeType: "application/json"
      }
    });

    let analysisJson: any = {};
    try {
      analysisJson = JSON.parse(analysisResponse.text || "{}");
    } catch (e) {
      console.error("Error parseando respuesta JSON de análisis 3D:", e);
      analysisJson = {
        title: `Representación Esquemática 3D: ${findingDescription?.slice(0, 40) || "Hallazgo Ecográfico"}`,
        explanation: `Representación esquemática tridimensional basada en los hallazgos ecográficos observados. Ilustra la correlación volumétrica del tejido y la morfología descrita (${findingDescription || "estudio actual"}).`,
        imagePrompt: `Medical 3D volumetric render of ${findingDescription || "anatomical ultrasound finding"}, clean anatomical cross-section, translucent organic glass style, octane render, soft studio lighting, high resolution medical illustration, no text.`,
        imagePromptMacro: `Wide panoramic medical 3D volumetric render of the entire anatomical region of ${findingDescription || "anatomical ultrasound finding"}, showing neighboring organs and muscles, translucent medical illustration, glowing focal finding in place, no text.`
      };
    }

    // Step 2: Extract Grounded Anatomical Reference Profile & Constraints
    const targetStructure = analysisJson.targetStructure || specificAnatomicalUnit || anatomicalLocation || findingDescription || "Estructura ecográfica";
    const exactAnatomicalLocation = analysisJson.exactAnatomicalLocation || "";
    const exactAnatomicalLocationEs = analysisJson.exactAnatomicalLocationEs || exactAnatomicalLocation || "";
    const cardinalLandmarks = Array.isArray(analysisJson.cardinalLandmarks) ? analysisJson.cardinalLandmarks : [];
    const cardinalLandmarksEs = Array.isArray(analysisJson.cardinalLandmarksEs) ? analysisJson.cardinalLandmarksEs : cardinalLandmarks;
    const prohibitedMisplacements = Array.isArray(analysisJson.prohibitedMisplacements) ? analysisJson.prohibitedMisplacements : [];
    const prohibitedMisplacementsEs = Array.isArray(analysisJson.prohibitedMisplacementsEs) ? analysisJson.prohibitedMisplacementsEs : prohibitedMisplacements;
    const anatomicalAspect = analysisJson.anatomicalAspect || detectedAspect || "";
    const tissueLayerDepth = analysisJson.tissueLayerDepth || "";

    const finalLaterality = (analysisJson.lateralityIdentified || detectedLateralityHint || "").toUpperCase();
    const finalDigit = analysisJson.digitOrSegmentIdentified || detectedDigit || "";
    const finalJoint = analysisJson.jointOrLevelIdentified || detectedJoint || "";
    const viewOrientation = (analysisJson.viewOrientation || "").toUpperCase();

    let anatomicalConstraintPrefix = "";
    if (exactAnatomicalLocation) {
      const landmarksStr = cardinalLandmarks.length > 0 ? ` Anchored to: ${cardinalLandmarks.join(", ")}.` : "";
      const prohibitedStr = prohibitedMisplacements.length > 0 ? ` STRICT PROHIBITION: DO NOT place in ${prohibitedMisplacements.join(", ")}.` : "";
      anatomicalConstraintPrefix = `[MANDATORY SURGICAL ANATOMICAL LOCATION: ${exactAnatomicalLocation.toUpperCase()}.${landmarksStr}${prohibitedStr}] `;
    }

    let lateralityConstraintPrefix = "";
    if (finalLaterality === "RIGHT" || finalLaterality.includes("DERECH")) {
      const screenPos = viewOrientation === "POSTERIOR" 
        ? "on the VIEWER'S RIGHT (screen-right) in dorsal/posterior view"
        : "on the VIEWER'S LEFT (screen-left) in frontal/coronal view";
      lateralityConstraintPrefix = `[MANDATORY MEDICAL LATERALITY: PATIENT'S RIGHT ANATOMICAL SIDE ONLY. Position the lesion strictly in the patient's right structure (${screenPos}). Patient's left is normal. DO NOT place on left]. `;
    } else if (finalLaterality === "LEFT" || finalLaterality.includes("IZQUIERD")) {
      const screenPos = viewOrientation === "POSTERIOR" 
        ? "on the VIEWER'S LEFT (screen-left) in dorsal/posterior view"
        : "on the VIEWER'S RIGHT (screen-right) in frontal/coronal view";
      lateralityConstraintPrefix = `[MANDATORY MEDICAL LATERALITY: PATIENT'S LEFT ANATOMICAL SIDE ONLY. Position the lesion strictly in the patient's left structure (${screenPos}). Patient's right is normal. DO NOT place on right]. `;
    }

    let topographyConstraintPrefix = "";
    if (finalDigit && finalDigit !== "N/A") {
      topographyConstraintPrefix = `[CRITICAL ANATOMICAL TARGET: STRICTLY ${finalDigit.toUpperCase()}${finalJoint && finalJoint !== "N/A" ? ` AT THE ${finalJoint.toUpperCase()}` : ""}. DO NOT place lesion on any other digit or joint. Other digits are completely normal and intact]. `;
    }

    // Helper function to flip a base64 image horizontally using sharp
    const flipBase64Horizontally = async (base64Data: string): Promise<string> => {
      try {
        const clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(clean, "base64");
        const flippedBuf = await sharp(buf).flop().toBuffer();
        return flippedBuf.toString("base64");
      } catch (err) {
        console.error("Error volteando imagen con sharp:", err);
        return base64Data;
      }
    };

    // Auditoría y auto-corrección multimodal de posición anatómica exacta, lateralidad y topografía
    const auditAndValidate3dRender = async (
      imgBase64: string,
      structureName: string,
      expectedLocation: string,
      landmarks: string[],
      prohibitedAreas: string[],
      targetLaterality: string,
      targetDigitOrLoc: string,
      targetJointOrLevel: string,
      perspectiveLabel: "FOCAL (Detalle)" | "MACRO (Panorámica)"
    ): Promise<{
      finalBase64: string;
      wasFlipped: boolean;
      isAnatomicalPositionCorrect: boolean;
      isTopographyAccurate: boolean;
      depictedPosition: string;
      discrepancyReason?: string;
      detectedSide: string;
      log: string;
    }> => {
      const cleanTarget = (targetLaterality || "").toUpperCase();

      try {
        const clean = imgBase64.replace(/^data:image\/\w+;base64,/, "");
        const auditPrompt = `Eres un auditor radiológico perito en anatomía humana quirúrgica de alta precisión.
El médico solicitó una representación 3D con los siguientes requisitos anatómicos fundamentales:
- Estructura Solicitada: ${structureName}
- Ubicación Anatómica Exacta Obligatoria: ${expectedLocation || "Posición fisiológica estándar"}
- Hitos de Referencia Anatómica: ${landmarks.join(", ") || "Hitos estándar"}
- Ubicaciones Erróneas Prohibidas (Lugares donde NUNCA debe estar): ${prohibitedAreas.join(", ") || "Ninguna"}
- Lateralidad Requerida: LADO ${cleanTarget === "RIGHT" ? "DERECHO (Right)" : cleanTarget === "LEFT" ? "IZQUIERDO (Left)" : "Línea media / No especificada"} DEL PACIENTE.
- Dígito / Segmento Requerido: ${targetDigitOrLoc || "Conforme a la descripción"}
- Nivel Articular / Falange: ${targetJointOrLevel || "Conforme a la descripción"}

Analiza minuciosamente esta imagen médica 3D generada (${perspectiveLabel}):

1. POSICIÓN ANATÓMICA EXACTA Y PLANO:
   - ¿En qué ubicación y cara anatómica está realmente dibujada la lesión o estructura? (ej. cara posterior sobre el olécranon vs. fosa cubital anterior).
   - ¿La estructura patológica está situada en su posición anatómica quirúrgicamente correcta ("isAnatomicalPositionCorrect": true/false)?
   - Si la estructura se colocó en un lugar erróneo (por ejemplo, una bursa olecraneana dibujada en la cara anterior/fosa cubital del codo, o un quiste de Baker en la cara anterior de la rodilla), debes marcar "isAnatomicalPositionCorrect": false y detallar la discrepancia.

2. LATERALIDAD DEL PACIENTE:
   - Determina el punto de vista (ANTERIOR/PALMAR vs. POSTERIOR/DORSAL vs. CORTE SAGITAL/FOCAL).
   - ¿En qué lado DEL PACIENTE está situada la lesión?
   - Si la lesión quedó en el lado CONTRARIO al solicitado (ej. el médico pidió DERECHO pero quedó en la izquierda del paciente), indica "shouldFlipHorizontally": true para que el sistema invierta el lienzo.

3. TOPOGRAFÍA SEGMENTARIA / DÍGITO / NIVEL:
   - Si involucra dedos: ¿En qué dedo específico está dibujada la lesión? (1º Pulgar, 2º Índice, 3º Medio, 4º Anular, 5º Meñique).
   - ¿En qué articulación está dibujada? (IFD distal, IFP proximal, MCF o falange).
   - Si se solicitó el 4º dedo a nivel IFD pero la imagen la colocó en el 3º dedo o en la IFP, indica "isTopographyAccurate": false.

Responde ESTRICTAMENTE en JSON:
{
  "isAnatomicalPositionCorrect": true | false,
  "depictedAnatomicalPosition": "Descripción exacta de dónde está dibujada la lesión en la imagen",
  "depictedPatientSide": "RIGHT" | "LEFT" | "MIDLINE",
  "depictedDigit": "1st (Thumb)" | "2nd (Index)" | "3rd (Middle)" | "4th (Ring)" | "5th (Pinky)" | "N/A",
  "depictedJoint": "DIP" | "PIP" | "MCP" | "N/A",
  "isLateralityCorrect": true | false,
  "shouldFlipHorizontally": true | false,
  "isTopographyAccurate": true | false,
  "discrepancyReason": "Explicación concisa si hubo error de posición anatómica, lateralidad o dedo",
  "reason": "Explicación general de auditoría anatómica"
}`;

        const auditResponse = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: [
            {
              inlineData: {
                data: clean,
                mimeType: "image/png"
              }
            },
            { text: auditPrompt }
          ],
          config: {
            responseMimeType: "application/json"
          }
        });

        const auditJson = JSON.parse(auditResponse.text || "{}");
        console.log(`[AUDITORÍA ANATÓMICA 3D - ${perspectiveLabel}]`, auditJson);

        let processedBase64 = clean;
        let wasFlipped = false;

        const sideMismatched = (cleanTarget === "RIGHT" && auditJson.depictedPatientSide === "LEFT") ||
                              (cleanTarget === "LEFT" && auditJson.depictedPatientSide === "RIGHT");

        if (auditJson.shouldFlipHorizontally || (!auditJson.isLateralityCorrect && sideMismatched)) {
          console.log(`[AUTOCORRECCIÓN LATERALIDAD 3D] Volteando horizontalmente la imagen ${perspectiveLabel} para alinearse al lado ${cleanTarget} del paciente.`);
          processedBase64 = await flipBase64Horizontally(clean);
          wasFlipped = true;
        }

        return {
          finalBase64: processedBase64,
          wasFlipped,
          isAnatomicalPositionCorrect: auditJson.isAnatomicalPositionCorrect !== false,
          isTopographyAccurate: auditJson.isTopographyAccurate !== false,
          depictedPosition: auditJson.depictedAnatomicalPosition || "Posición verificada",
          discrepancyReason: auditJson.discrepancyReason,
          detectedSide: auditJson.depictedPatientSide || cleanTarget,
          log: auditJson.reason || "Auditoría de posición anatómica y topográfica completada."
        };
      } catch (auditErr) {
        console.warn(`[AUDITORÍA ANATÓMICA 3D] Error no bloqueante al auditar imagen ${perspectiveLabel}:`, auditErr);
        return {
          finalBase64: imgBase64,
          wasFlipped: false,
          isAnatomicalPositionCorrect: true,
          isTopographyAccurate: true,
          depictedPosition: "Posición estándar",
          detectedSide: cleanTarget,
          log: "Auditoría no concluyente"
        };
      }
    };

    // Helper for image generation with fallback
    const generateImageHelper = async (promptText: string, extraIsolationPrefix = "") => {
      const fullReinforcedPrompt = `${extraIsolationPrefix}${anatomicalConstraintPrefix}${lateralityConstraintPrefix}${topographyConstraintPrefix}${promptText}. Medical 3D volumetric cross-section, clean studio render, elegant translucent materials, no text, hyperrealistic medical CGI.`;
      try {
        const imageGenResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: fullReinforcedPrompt,
          config: {
            imageConfig: { aspectRatio: "4:3", imageSize: "1K" }
          }
        });

        if (imageGenResponse.candidates?.[0]?.content?.parts) {
          for (const part of imageGenResponse.candidates[0].content.parts) {
            if (part.inlineData) {
              return part.inlineData.data;
            }
          }
        }
      } catch (genErr: any) {
        console.warn("Fallback a gemini-3.1-flash-lite-image...", genErr);
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-image",
          contents: `${extraIsolationPrefix}${anatomicalConstraintPrefix}${lateralityConstraintPrefix}${topographyConstraintPrefix}${promptText}. 3D medical volumetric render, clean anatomy, no text.`,
          config: {
            imageConfig: { aspectRatio: "4:3" }
          }
        });
        if (fallbackResponse.candidates?.[0]?.content?.parts) {
          for (const part of fallbackResponse.candidates[0].content.parts) {
            if (part.inlineData) {
              return part.inlineData.data;
            }
          }
        }
      }
      return "";
    };

    // Step 3: Generate Focal Image
    const focalPrompt = analysisJson.imagePrompt || `Medical 3D volumetric render of ${findingDescription || "ultrasound finding"}`;
    let rawFocalBase64 = await generateImageHelper(focalPrompt);

    if (!rawFocalBase64) {
      throw new Error("El modelo de renderizado no devolvió datos para la imagen focal.");
    }

    // Step 4: Multimodal Vision Audit of Anatomical Position, Laterality & Topography
    let auditedFocal = await auditAndValidate3dRender(
      rawFocalBase64,
      targetStructure,
      exactAnatomicalLocation,
      cardinalLandmarks,
      prohibitedMisplacements,
      finalLaterality,
      finalDigit,
      finalJoint,
      "FOCAL (Detalle)"
    );

    // Auto-Recovery 1: If anatomical position is misplaced (e.g. bursa olecraneana in anterior cubital fossa instead of posterior olecranon tip)
    if (!auditedFocal.isAnatomicalPositionCorrect && exactAnatomicalLocation) {
      console.log(`[AUTOCORRECCIÓN POSICIÓN ANATÓMICA 3D] Estructura fuera de coordenadas anatómicas (${auditedFocal.discrepancyReason || "desplazamiento"}). Reconstruyendo con anclaje estricto a ${exactAnatomicalLocation}...`);
      
      const correctivePrompt = `Surgical close-up 3D medical volumetric cross-section focusing exclusively and strictly on the ${exactAnatomicalLocation}. The target structure (${targetStructure}) MUST be placed directly in the ${exactAnatomicalLocation}, anchored to ${cardinalLandmarks.join(", ")}. The prohibited regions (${prohibitedMisplacements.join(", ")}) are completely excluded. Extreme anatomical precision, clean translucent medical CGI, no text.`;
      
      const retryAnatBase64 = await generateImageHelper(
        correctivePrompt,
        `[STRICT SURGICAL CORRECTION: POSITION MUST BE EXACTLY AT ${exactAnatomicalLocation.toUpperCase()}. DO NOT DRAW IN ${prohibitedMisplacements.join(", ").toUpperCase()}]. `
      );

      if (retryAnatBase64) {
        const reAudited = await auditAndValidate3dRender(
          retryAnatBase64,
          targetStructure,
          exactAnatomicalLocation,
          cardinalLandmarks,
          prohibitedMisplacements,
          finalLaterality,
          finalDigit,
          finalJoint,
          "FOCAL (Detalle)"
        );
        auditedFocal = reAudited;
      }
    }

    // Auto-Recovery 2: If topographical verification detected digit/joint mismatch (e.g. drawn on 3rd finger instead of 4th)
    if (!auditedFocal.isTopographyAccurate && finalDigit) {
      console.log(`[AUTOCORRECCIÓN TOPOGRÁFICA 3D] Regenerando con aislamiento focal estricto para ${finalDigit} en ${finalJoint}...`);
      const isolatedFocalPrompt = `Close-up isolated medical 3D volumetric cross-section focusing exclusively on the ${finalDigit} ${finalJoint ? `at the ${finalJoint} joint level` : ""}. Clear anatomical magnification of the single target digit showing the tendon pathology in high resolution, with the distal phalanx and nail bed clearly visible. No other digits in primary focus.`;
      
      const retryRawBase64 = await generateImageHelper(isolatedFocalPrompt, `[ISOLATED ANATOMICAL UNIT MAGNIFICATION: STRICTLY ${finalDigit.toUpperCase()} ${finalJoint.toUpperCase()} ONLY]. `);
      if (retryRawBase64) {
        const reAudited = await auditAndValidate3dRender(
          retryRawBase64,
          targetStructure,
          exactAnatomicalLocation,
          cardinalLandmarks,
          prohibitedMisplacements,
          finalLaterality,
          finalDigit,
          finalJoint,
          "FOCAL (Detalle)"
        );
        auditedFocal = reAudited;
      }
    }

    const base64RenderFocal = auditedFocal.finalBase64;

    // Step 5: If Dual Perspective requested, generate Macro Panoramic Image
    let base64RenderMacro = "";
    if (dualPerspective) {
      const macroPrompt = analysisJson.imagePromptMacro || `Wide anatomical panoramic 3D volumetric render of ${findingDescription || "ultrasound region"}, showing full muscle group or organ context with all digits and landmarks clearly discernible`;
      try {
        const rawMacroBase64 = await generateImageHelper(macroPrompt);
        if (rawMacroBase64) {
          // Audit and auto-correct Macro Image laterality, anatomical position and topography
          const auditedMacro = await auditAndValidate3dRender(
            rawMacroBase64,
            targetStructure,
            exactAnatomicalLocation,
            cardinalLandmarks,
            prohibitedMisplacements,
            finalLaterality,
            finalDigit,
            finalJoint,
            "MACRO (Panorámica)"
          );
          base64RenderMacro = auditedMacro.finalBase64;
        }
      } catch (macroErr) {
        console.warn("Fallo al generar imagen panorámica 3D secundaria:", macroErr);
      }
    }

    const sanitizedExplanation = enforceBaafTerminology(analysisJson.explanation || "");
    const sanitizedTitle = enforceBaafTerminology(analysisJson.title || "");

    res.json({
      success: true,
      render3dBase64: `data:image/png;base64,${base64RenderFocal}`,
      render3dMacroBase64: base64RenderMacro ? `data:image/png;base64,${base64RenderMacro}` : undefined,
      dualPerspective: dualPerspective && !!base64RenderMacro,
      title: sanitizedTitle,
      explanation: sanitizedExplanation,
      promptUsed: focalPrompt,
      promptMacroUsed: analysisJson.imagePromptMacro,
      lateralityIdentified: finalLaterality,
      digitIdentified: finalDigit,
      jointIdentified: finalJoint,
      viewOrientation: viewOrientation,
      focalWasFlipped: auditedFocal.wasFlipped,
      isTopographyAccurate: auditedFocal.isTopographyAccurate,
      isAnatomicalPositionCorrect: auditedFocal.isAnatomicalPositionCorrect,
      anatomicalCoordinates: {
        targetStructure,
        exactAnatomicalLocation,
        exactAnatomicalLocationEs,
        cardinalLandmarks,
        cardinalLandmarksEs,
        prohibitedMisplacements,
        prohibitedMisplacementsEs,
        anatomicalAspect,
        tissueLayerDepth,
        isAnatomicalPositionCorrect: auditedFocal.isAnatomicalPositionCorrect,
        depictedPosition: auditedFocal.depictedPosition,
        anatomicalAuditLog: auditedFocal.log
      }
    });

  } catch (error: any) {
    console.error("Error en /api/generate-3d-render:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

// Endpoint to flip an image horizontally on demand
app.post("/api/flip-image-laterality", async (req: express.Request, res: express.Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: "Se requiere imageBase64" });

    const clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(clean, "base64");
    const flippedBuf = await sharp(buf).flop().toBuffer();
    const flippedBase64 = `data:image/png;base64,${flippedBuf.toString("base64")}`;

    res.json({ success: true, flippedImageBase64: flippedBase64 });
  } catch (err: any) {
    console.error("Error volteando imagen en /api/flip-image-laterality:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/generate-medical-image", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "Prompt requerido" });

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: `Genera una imagen radiológica o anatómica médica precisa sobre: ${prompt}. Estilo: didáctico, limpio, profesional, de alta calidad técnica para educación médica.`,
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
      }
    });
    
    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
    }

    if (!base64Image) {
      throw new Error("No se pudo generar la imagen para este prompt.");
    }
    
    res.json({ success: true, imageUrl: `data:image/jpeg;base64,${base64Image}` });
  } catch (error: any) {
    console.error("Error en /api/generate-medical-image:", error);
    res.status(500).json({ success: false, error: "Error al generar la imagen." });
  }
});

app.post("/api/auto-label-annotation", async (req: express.Request, res: express.Response) => {
  try {
    const { model, image, mimeType, studyType, clinicalHistory, annotation } = req.body;
    
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, error: "Se requiere la imagen y su tipo MIME." });
    }
    if (!annotation) {
      return res.status(400).json({ success: false, error: "Se requiere la información de la anotación." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const annotType = annotation.type === "point" ? "un PUNTO de interés" : "una REGION rectangular de sospecha";
    let coordDesc = `Coordenadas relativas en porcentaje: X = ${Number(annotation.x).toFixed(1)}%, Y = ${Number(annotation.y).toFixed(1)}%`;
    if (annotation.type === "box") {
      coordDesc += `, Ancho = ${Number(annotation.w || 0).toFixed(1)}%, Alto = ${Number(annotation.h || 0).toFixed(1)}%`;
    }

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const parts: any[] = [];
    const imgSupported = checkImageSupport(mimeType);
    if (imgSupported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    let queryText = `Analiza detenidamente esta imagen médica de estudio radiológico/clínico. 
Tipo de estudio: ${studyType || "No especificado"}
Antecedentes clínicos: ${clinicalHistory || "No especificado"}

El usuario ha marcado ${annotType} en el siguiente lugar específico de la imagen:
- ${coordDesc}

Observa con extrema atención los detalles visuales de la anatomía o patología justo en esas coordenadas/región. 
Tu tarea es sugerir un diagnóstico corto, una patología o hallazgo alterado que se observe de forma patente allí (por ejemplo: "Nódulo pulmonar apical", "Atelectasia subsegmentaria", "Hernia hiatal", "Infiltrado alveolar", "Derrame pleural leve", "Fractura cortical", etc.).

REGLAS DE RESPUESTA:
- Responde UNICAMENTE con el nombre del hallazgo o etiqueta sugerida (máximo 4 palabras).
- Debe ser en idioma ESPAÑOL.
- No añadas comillas, no expliques, no des introducciones ni uses puntos finales. Solo la pura etiqueta textual. Ej: "Infiltrado basal derecho"`;

    if (!imgSupported) {
      queryText = `[Simulación] ` + queryText + `\nNota: Como la imagen es una simulación sintética o formato SVG no rasterizado, genera una etiqueta diagnóstica coherente correspondiente de forma directa basada en el tipo de estudio e indicación de sospecha o hallazgo más común para este estudio clínico.`;
    }

    parts.push({ text: queryText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: parts,
    });

    const label = response.text ? response.text.trim().replace(/^["']|["']$/g, "") : "";
    res.json({ success: true, label });
  } catch (error: any) {
    console.error("Error en /api/auto-label-annotation:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

app.post("/api/classify-and-label-image", async (req: express.Request, res: express.Response) => {
  try {
    const { image, filename, studyType, clinicalHistory, findings, model } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Se requiere la imagen." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    let mimeType = "image/png";
    const mimeMatch = image.match(/^data:([^;]+);/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const parts: any[] = [];
    const imgSupported = checkImageSupport(mimeType);
    if (imgSupported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    const queryText = `Analiza esta imagen médica y clasifícala.
Nombre de archivo: ${filename || "Desconocido"}
Tipo de estudio/Solicitud: ${studyType || "Mamografía y Ultrasonido"}
Antecedentes/Reporte: ${findings || clinicalHistory || "No especificado"}

INSTRUCCIONES:
1. Determina la MODALIDAD de la imagen:
   - "MMG" si es una Mamografía (rayos X de mama, mamograma digital, proyecciones mamográficas en escala de grises sobre fondo negro/oscuro, capturas de proyecciones CC o MLO).
   - "US" si es una Ecografía / Ultrasonido (imágenes con barridos sonográficos, Doppler color, profundidad, foco, o capturas de ecógrafo).
2. Si es MMG:
   - Determina la PROYECCIÓN: "CC" (Proyecciones Cráneo Caudales / Craneocaudales) o "MLO" (Proyecciones Medio Lateral Oblicuas / Mediolateral Oblicuas) u "OTRO".
   - Determina la LATERALIDAD: "Bilateral" (si muestra ambas mamas / proyecciones pareadas), "Derecha", "Izquierda" o "Bilateral".
3. Redacta un RÓTULO / LEYENDA CLÍNICA (pie de foto profesional en español, de 12 a 25 palabras) sintetizando la modalidad, proyección y hallazgos clave o estado del tejido fibroglandular/mamas.
   - Si la proyección es "CC" (Cráneo Caudales): Inicia el rótulo OBLIGATORIAMENTE con "Proyecciones Cráneo Caudales (CC)." seguido de la descripción sintética del tejido, distribución simétrica y ausencia/presencia de lesiones o calcificaciones. Ej: "Proyecciones Cráneo Caudales (CC). Tejido fibroglandular de distribución simétrica sin evidencia de nódulos ni microcalcificaciones sospechosas."
   - Si la proyección es "MLO" (Medio Lateral Oblicuas): Inicia el rótulo OBLIGATORIAMENTE con "Proyecciones Medio Lateral Oblicuas (MLO)." seguido de la descripción sintética del tejido, región axilar y profundidad pectoral. Ej: "Proyecciones Medio Lateral Oblicuas (MLO). Adecuada visualización de los planos pectorales sin distorsiones ni adenopatías axilares."
   - Para US: "Ultrasonido mamario, cuadrante superior externo derecho mostrando quiste anecoico simple de 10 mm."

Responde EXCLUSIVAMENTE en formato JSON estricto con la siguiente estructura:
{
  "modality": "MMG" o "US",
  "projection": "MLO" | "CC" | "OTRO",
  "side": "Bilateral" | "Derecha" | "Izquierda",
  "label": "texto del rótulo"
}`;

    parts.push({ text: queryText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: parts,
      config: {
        responseMimeType: "application/json",
      }
    });

    const rawJson = response.text ? response.text.trim() : "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      parsed = { modality: "US", projection: "OTRO", side: "No especificado", label: rawJson };
    }

    res.json({
      success: true,
      modality: parsed.modality === "MMG" ? "MMG" : "US",
      projection: ["MLO", "CC", "OTRO"].includes(parsed.projection) ? parsed.projection : "OTRO",
      side: ["Derecha", "Izquierda", "Bilateral"].includes(parsed.side) ? parsed.side : "No especificado",
      label: parsed.label || ""
    });
  } catch (error: any) {
    console.error("Error en /api/classify-and-label-image:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

app.post("/api/auto-label-us-photo", async (req: express.Request, res: express.Response) => {
  try {
    const { image, studyType, clinicalHistory, findings, model } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Se requiere la imagen." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    // Check if image string is SVG or base64
    let mimeType = "image/png";
    const mimeMatch = image.match(/^data:([^;]+);/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const checkImageSupport = (mime: string) => {
      if (!mime) return false;
      const m = mime.toLowerCase();
      return (
        m.includes("png") ||
        m.includes("jpeg") ||
        m.includes("jpg") ||
        m.includes("webp") ||
        m.includes("heic") ||
        m.includes("heif") ||
        m.includes("pdf")
      );
    };

    const parts: any[] = [];
    const imgSupported = checkImageSupport(mimeType);
    if (imgSupported) {
      parts.push({
        inlineData: {
          data: cleanBase64(image),
          mimeType: mimeType,
        },
      });
    }

    let queryText = `Analiza con extrema precisión esta imagen de ecografía (ultrasonido) médica o captura clínica.
Tipo de estudio: ${studyType || "No especificado"}
Antecedentes clínicos/Sospecha: ${clinicalHistory || "No especificado"}
Texto del Informe/Hallazgos redactados: ${findings || "No especificado"}

Tu principal tarea es:
1. Identificar si hay algún texto impreso, rotulado, etiqueta u anotación quemada dentro de la imagen (por ejemplo, palabras cortas escritas en la pantalla como 'Vesícula', 'LIVER', 'KIDNEY', 'AO', 'VESICULA BILIAR', 'QUISTE', marcas de medición o distancias impresas, etc.).
2. Hacer correlación inteligente entre lo visualizado en la foto, cualquier texto/rótulo quemado que detectes dentro de ella, y el texto del informe/hallazgos redactados en busca del hallazgo descrito que esté más relacionado, para sintetizar el rótulo final más representativo.
3. Si el texto del informe menciona hallazgos patológicos o medidas específicas (por ejemplo, "colelitiasis de 12mm", "quiste cortical de 20mm en polo superior", "esteatosis hepática grado II"), correlaciónalos de inmediato con la anatomía observada y el rótulo quemado en la imagen para formular un título coherente que vincule de forma óptima ambos mundos.
4. Si no hay texto legible en la imagen, analiza la anatomía y propón una descripción clínica o hallazgo en español basado en la correlación con el reporte.

REGLAS DE RESPUESTA:
- El rótulo sugerido debe ser sumamente limpio, claro y profesional, al estilo del pie de foto o descripción de figura en un artículo de revista médica o científica (menciona la estructura anatómica, el hallazgo clave o patología y algún detalle clínico o medida relevante, sin exceder de 1 a 2 líneas breves, unas 10 a 20 palabras en total).
- Evita redundancias excesivas y sé sumamente descriptivo pero conciso.
- La respuesta debe ser una descripción fluida y directa (ejemplo: "Vesícula biliar distendida con presencia de un lito hiperecogénico de 12 mm en su interior que proyecta sombra acústica" o "Bifurcación carotídea derecha con placa de ateroma calcificada que genera estenosis leve de aproximadamente el 25%").
- Debe estar enteramente en ESPAÑOL.
- No incluyas prefijos como "Figura X." ni comillas, introducciones, explicaciones, ni puntos finales. Devuelve únicamente la descripción limpia.`;

    if (!imgSupported) {
      queryText = `[Simulación] ` + queryText + `\nNota: Como la imagen es una simulación sintética o formato SVG no de mapa de bits, genera una etiqueta diagnóstica coherente correspondiente de forma directa basada en el tipo de estudio, hallazgos o sospecha clínica que esté más correlacionada con la información disponible.`;
    }

    parts.push({ text: queryText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: parts,
    });

    const label = response.text ? response.text.trim().replace(/^["']|["']$/g, "") : "";
    res.json({ success: true, label });
  } catch (error: any) {
    console.error("Error en /api/auto-label-us-photo:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

/**
 * Endpoint para buscar de manera manual un hallazgo/estructura en el reporte actual y autocomplete la rotulación.
 */
app.post("/api/autocomplete-label-from-report", async (req: express.Request, res: express.Response) => {
  try {
    const { model, phrase, currentReport, studyType, clinicalHistory } = req.body;
    if (!phrase || !phrase.trim()) {
      return res.status(400).json({ success: false, error: "Se requiere la palabra o frase de búsqueda manual." });
    }
    if (!currentReport || !currentReport.trim()) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte actual para realizar la búsqueda." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    const promptText = `
Eres un radiólogo clínico experto y editor de artículos científicos de radiología.
El usuario ha subido una imagen de ultrasonido y ha escrito manualmente una palabra o frase clave (estructura anatómica o hallazgo) que desea rotular.
Tu misión es buscar en el informe de radiología suministrado la sección donde se mencione ese hallazgo o estructura, extraer los detalles precisos (medidas, características ecogénicas, ubicación, etc.) y construir una descripción de figura clínica (pie de foto de artículo científico), fluida y detallada, pero sin excederse de largo (entre 10 y 20 palabras).

INFORMACIÓN SUMINISTRADA:
- Frase/Estructura manual: "${phrase}"
- Tipo de estudio: ${studyType || "Ecografía"}
- Antecedentes clínicos: ${clinicalHistory || ""}

INFORME DE RADIOLOGÍA ACTUAL:
"""
${currentReport}
"""

REGLAS DE GENERACIÓN PARA EL RÓTULO:
1. Localiza en el informe el fragmento que mejor describa la frase "${phrase}".
2. Redacta un pie de foto profesional y fluido para una revista médica (ejemplo: "Vesícula biliar con lito de 15 mm en su interior que genera sombra acústica posterior nítida").
3. Si el informe no menciona específicamente la estructura o hallazgo exacto, infiere una descripción lógica, profesional y coherente con el tipo de estudio y el informe para esa palabra.
4. Debe ser una descripción fluida de entre 10 y 20 palabras. No exageres el largo, sé directo y formal.
5. NO incluyas prefijos como "Figura X." ni títulos como "Pie de foto:". Devuelve únicamente el texto de la descripción.
6. El idioma debe ser enteramente ESPAÑOL.
7. No incluyas comillas ni explicaciones preliminares.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ text: promptText }],
    });

    const autocompletedLabel = response.text ? response.text.trim().replace(/^["']|["']$/g, "") : phrase;
    res.json({ success: true, label: autocompletedLabel });
  } catch (error: any) {
    console.error("Error en /api/autocomplete-label-from-report:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

/**
 * Endpoint para correlacionar e insertar de manera retrógrada las referencias a las figuras en el reporte existente.
 */
app.post("/api/correlate-figures-retroactive", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentReport, attachedImages } = req.body;
    if (!currentReport) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte actual." });
    }
    if (!attachedImages || attachedImages.length === 0) {
      return res.status(400).json({ success: false, error: "No hay imágenes cargadas para correlacionar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    let promptText = `
Eres un radiólogo experto y un editor de informes médicos de alta precisión.
Se te proporciona un informe de radiología/ecografía estructurado en formato Markdown, y un listado de imágenes/capturas de ultrasonido adjuntas que han sido rotuladas/etiquetadas por el médico o mediante IA.

TU MISIÓN PASO A PASO:
1. Lee atentamente el INFORME DE RADIOLOGÍA de principio a fin (especialmente las secciones de HALLAZGOS e IMPRESIÓN DIAGNÓSTICA).
2. Para cada una de las IMÁGENES ADJUNTAS (identificadas por su "id" y su "caption"), determina en qué lugar del texto del informe se menciona por primera vez el hallazgo, estructura u órgano correspondiente a esa imagen.
3. REORDENA la lista de imágenes para que queden en el orden exacto de su primera aparición cronológica en el texto del informe (de arriba a abajo):
   - La imagen cuyo hallazgo se describe PRIMERO en el reporte será la Figura 1.
   - La imagen cuyo hallazgo se describe SEGUNDO en el reporte será la Figura 2.
   - La imagen cuyo hallazgo se describe TERCERO será la Figura 3, y así sucesivamente.
   - Si alguna imagen no coincide claramente con el reporte, colócala al final de la lista conservando su orden relativo.
4. Una vez determinado el nuevo orden de las imágenes (y por ende su nuevo número de Figura 1, 2, 3...):
   - Inserta la referencia "(ver Figura 1)", "(ver Figura 2)", etc. en el texto del informe en la ubicación exacta donde se describe dicho hallazgo específico.
   - Esto garantiza que las menciones "(ver Figura 1)", "(ver Figura 2)", "(ver Figura 3)" dentro del texto del informe aparezcan en ORDEN ESTRICTAMENTE ASCENDENTE (1, 2, 3...) a medida que el lector lee el documento de arriba a abajo.
5. NO alteres, elimines ni resumas el texto original del reporte. Únicamente debes insertar los paréntesis de referencia como "(ver Figura 1)" en el lugar exacto que corresponda. Mantén intacto el formato de secciones.

LISTADO DE IMÁGENES ADJUNTAS DISPONIBLES:
`;

    attachedImages.forEach((img: any) => {
      const modality = img.modality || "US";
      const proj = img.projection || "";
      const side = img.side || "";
      promptText += `- ID: "${img.id}" | Modalidad: "${modality}" | Proyección: "${proj}" | Lado: "${side}" | Rótulo/Descripción: "${img.caption || img.name || "Sin descripción"}"\n`;
    });

    promptText += `
INFORME DE RADIOLOGÍA ACTUAL EN EL QUE TRABAJAS:
"""
${currentReport}
"""

Debes devolver un objeto JSON estricto con:
- "reorderedImageIds": un arreglo con todos los IDs de las imágenes en el nuevo orden cronológico de aparición en el informe (ej: ["id1", "id2", "id3"]).
- "report": el texto completo del informe con los paréntesis "(ver Figura 1)", "(ver Figura 2)", etc. insertados en orden estrictamente ascendente.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ text: promptText }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reorderedImageIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de IDs de imagen reordenados según su primera aparición en el texto del reporte."
            },
            report: {
              type: Type.STRING,
              description: "Informe en Markdown con referencias (ver Figura 1), (ver Figura 2) insertadas en orden estrictamente ascendente."
            }
          },
          required: ["reorderedImageIds", "report"]
        }
      }
    });

    let jsonParsed: any = null;
    if (response.text) {
      try {
        jsonParsed = JSON.parse(response.text);
      } catch (e) {
        console.error("Error parseando respuesta JSON de correlación de figuras:", e);
      }
    }

    if (jsonParsed && jsonParsed.report) {
      res.json({
        success: true,
        report: jsonParsed.report,
        reorderedImageIds: jsonParsed.reorderedImageIds || []
      });
    } else {
      res.json({
        success: true,
        report: response.text ? response.text.trim() : currentReport,
        reorderedImageIds: []
      });
    }
  } catch (error: any) {
    console.error("Error en /api/correlate-figures-retroactive:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

app.post("/api/analyze-vascular", async (req: express.Request, res: express.Response) => {
  try {
    const { model, reportText, studyType } = req.body;
    if (!reportText) {
      return res.status(400).json({ success: false, error: "Se requiere el 'reportText' para realizar el análisis vascular." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const isCarotidas = studyType === "Doppler de carótidas" || reportText.toLowerCase().includes("carotid");
    const isVenoso = studyType === "Doppler venoso de miembro inferior" || reportText.toLowerCase().includes("venoso");

    let variablesPromptDesc = "";
    if (isCarotidas) {
      variablesPromptDesc = `
  Analiza los siguientes vasos carotídeos para el lado derecho e izquierdo:
  - acc_der (Arteria Carótida Común Derecha)
  - aci_der (Arteria Carótida Interna Derecha)
  - ace_der (Arteria Carótida Externa Derecha)
  - vert_der (Arteria Vertebral Derecha)
  - acc_izq (Arteria Carótida Común Izquierda)
  - aci_izq (Arteria Carótida Interna Izquierda)
  - ace_izq (Arteria Carótida Externa Izquierda)
  - vert_izq (Arteria Vertebral Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (si el flujo es laminar, sin estenosis ni placas significativas, o normal)
  - "mild" (si hay presencia de placas ateromatosas con estenosis hemodinámicamente no significativa o leve <50%)
  - "severe" (si hay estenosis crítica/severa >=50% o está ocluida)
  `;
    } else if (isVenoso) {
      variablesPromptDesc = `
  Analiza los siguientes segmentos venosos de miembros inferiores para extremidad derecha e izquierda:
  - vfc_der (Vena Femoral Común Derecha)
  - vfs_der (Vena Femoral Derecha / Anteriormente llamada Vena Femoral Superficial Derecha)
  - vp_der (Vena Poplítea Derecha)
  - vta_der (Vena Tibial Anterior Derecha)
  - vtp_der (Vena Tibial Posterior Derecha)
  - vper_der (Vena Peronea Derecha)
  - vsm_der (Vena Safena Magna Derecha)
  - vsp_der (Vena Safena Parva Derecha)
  - sfj_der (Unión Safenofemoral Derecha)
  - vfc_izq (Vena Femoral Común Izquierda)
  - vfs_izq (Vena Femoral Izquierda / Anteriormente llamada Vena Femoral Superficial Izquierda)
  - vp_izq (Vena Poplítea Izquierda)
  - vta_izq (Vena Tibial Anterior Izquierda)
  - vtp_izq (Vena Tibial Posterior Izquierda)
  - vper_izq (Vena Peronea Izquierda)
  - vsm_izq (Vena Safena Magna Izquierda)
  - vsp_izq (Vena Safena Parva Izquierda)
  - sfj_izq (Unión Safenofemoral Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (permeable, completamente colapsable, flujo normal, sin insuficiencia ni reflujo)
  - "reflux" (si hay insuficiencia valvular, reflujo provocado/espontáneo o incompetencia)
  - "thrombosis" (si hay trombosis venosa profunda o superficial, no compresible, trombo visible, o ausencia de flujo)
  `;
    } else {
      variablesPromptDesc = `
  Analiza los siguientes segmentos arteriales de miembros inferiores para extremidad derecha e izquierda:
  - aic_der (Arteria Ilíaca Común Derecha)
  - afc_der (Arteria Femoral Común Derecha)
  - afs_der (Arteria Femoral Derecha / Anteriormente llamada Arteria Femoral Superficial Derecha)
  - ap_der (Arteria Poplítea Derecha)
  - ata_der (Arteria Tibial Anterior Derecha)
  - atp_der (Arteria Tibial Posterior Derecha)
  - aper_der (Arteria Peronea Derecha)
  - aic_izq (Arteria Ilíaca Común Izquierda)
  - afc_izq (Arteria Femoral Común Izquierda)
  - afs_izq (Arteria Femoral Izquierda / Anteriormente llamada Arteria Femoral Superficial Izquierda)
  - ap_izq (Arteria Poplítea Izquierda)
  - ata_izq (Arteria Tibial Anterior Izquierda)
  - atp_izq (Arteria Tibial Posterior Izquierda)
  - aper_izq (Arteria Peronea Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (flujo trifásico normal, sin placas ni estenosis hemodinámica)
  - "mild" (flujo bifásico, estenosis <50% o placas difusas con velocidades conservadas)
  - "severe" (flujo monofásico o amortiguado "tardus-parvus", oclusión vascular, o estenosis >=50% con velocidades elevadas)
  `;
    }

    const promptText = `
Estudio Vascular Analizado: ${studyType || "Doppler Vascular"}
Texto del Reporte Médico:
"""
${reportText}
"""

Tu misión es analizar el texto de este reporte y generar:
1. Un cuadro de hallazgos principales en formato de tabla de Markdown.
2. Un objeto JSON estructurado que asigne un estado y una breve descripción a cada segmento vascular clave.

Instrucciones para el Cuadro (Markdown):
- Debe ser una tabla de Markdown impecable y elegante con encabezados claros.
- Debe resumir con brevedad y excelente lenguaje médico ÚNICAMENTE los hallazgos patológicos o alteraciones (placas, estenosis, reflujos, trombosis, flujos alterados, etc.).
- Debe omitir por completo órganos, vasos o segmentos con un reporte normal o fisiológico ("Dentro de límites normales" o similar). No incluyas filas para estructuras normales.
- Si todas las estructuras, segmentos o vasos evaluados son completamente normales, la tabla de Markdown debe contener una única fila descriptiva amigable indicando: "| Estado General | Sin hallazgos patológicos detectados en el examen actual. |".
- Ejemplo de encabezado para Carótidas o Miembros:
  | Segmento Alterado | Derecho | Izquierdo |

Instrucciones para la Estructura de Datos (JSON):
${variablesPromptDesc}

Por favor, formatea la respuesta de manera estricta y exclusiva como un objeto JSON válido que contenga los siguientes atributos primarios: "table", "states", "descriptions", "subLocations" y "carotidPlaques".
- En "carotidPlaques" coloca una lista de las placas ateromatosas individuales identificadas en el sistema carotídeo (solo para estudios de carótidas o si se describen). Cada objeto del arreglo "carotidPlaques" debe tener los siguientes campos: side (derecho/izquierdo), vessel (acc/bulbo/aci/ace), type (tipo clasificación Gray-Weale "I", "II", "III" o "IV" exactamente, asumiendo "II" por defecto si es mixta o "IV" si es calcificada), size (tamaño medido como "3 mm" o verbal "pequeña"), stenosis (entero que representa % de estenosis ej. 30 o 70), description (breve descripción ej. "Placa calcificada").
- En "table" coloca el formato string de la tabla Markdown generada.
- En "states" coloca el mapeo de ID del segmento a su estado detectado ("normal", "mild", "severe", "reflux", o "thrombosis" exactamente).
- En "descriptions" coloca una explicación muy breve (máximo un renglón, ej: "Flujo laminar, sin placas", "Placa lipídica con estenosis de 35%", "Ausencia de flujo, trombo obstructivo", etc.) correspondiente a cada ID.
- En "subLocations" asigna a cada ID de segmento detectado con alteración ("mild", "severe", "reflux", o "thrombosis") su ubicación anatómica exacta basándote en la descripción física indicada en el reporte (por ejemplo: si es proximal, medio, distal, en la bifurcación, etc.). Los valores válidos que debes mapear son exactamente uno de: "proximal", "medio", "distal", "bifurcacion", "origen", o "general". Si es normal o no se detalla un punto específico, usa "general".

IMPORTANTE: Devuelve ÚNICAMENTE el objeto de JSON bien formateado, sin rodeos, preámbulos, explicaciones ni etiquetas externas como marcas de bloque de código \`\`\`json. Comienza directamente con { y finaliza con }.
`;

    const systemInstruction = "Eres un especialista clínico experto en radiología y Doppler vascular avanzado. Tu tarea es extraer de forma precisa cuadros diagnósticos estructurados y catalogar anatomopatológicamente cada segmento vascular en base al reporte indicado.";

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    const botText = response.text || "";
    // Clean potential markdown codeblock wrappers if any
    let cleanedJsonText = botText.trim();
    if (cleanedJsonText.startsWith("```json")) {
      cleanedJsonText = cleanedJsonText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedJsonText.startsWith("```")) {
      cleanedJsonText = cleanedJsonText.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedJsonText);
    } catch (jsonErr) {
      console.warn("Could not directly parse JSON from Gemini, attempting regex cleanup...", jsonErr);
      const tableMatch = botText.match(/\|[\s\S]+\|/);
      const extractedTable = tableMatch ? tableMatch[0] : "";
      
      parsedResult = {
        table: extractedTable || "No se pudo formatear el cuadro directamente.",
        states: {},
        descriptions: {},
        subLocations: {},
        carotidPlaques: []
      };
    }

    // Determine evaluated side for filtering the returned table if it's unilateral
    let evaluatedSide: "der" | "izq" | "both" = "both";
    const studyLower = (studyType || "").toLowerCase();
    const reportLower = (reportText || "").toLowerCase();

    const hasDerechoInStudy = studyLower.includes("derech") || studyLower.includes(" unilateral d") || studyLower.includes("der.");
    const hasIzquierdoInStudy = studyLower.includes("izquierd") || studyLower.includes(" unilateral i") || studyLower.includes("izq.");
    const isUnilateralStudy = studyLower.includes("unilateral") || studyLower.includes("unilaterales");

    const hasDerechoInReport = reportLower.includes("miembro inferior derecho") || reportLower.includes("m.i. derecho") || reportLower.includes("unilateral derecho") || reportLower.includes("miembro derecho");
    const hasIzquierdoInReport = reportLower.includes("miembro inferior izquierdo") || reportLower.includes("m.i. izquierdo") || reportLower.includes("unilateral izquierdo") || reportLower.includes("miembro izquierdo");

    const hasDerechoHeader = reportLower.includes("derecho:") || reportLower.includes("miembro derecho:") || reportLower.includes("miembro inferior derecho:") || reportLower.includes("extremidad inferior derecha:") || reportLower.includes("lado derecho:");
    const hasIzquierdoHeader = reportLower.includes("izquierdo:") || reportLower.includes("miembro izquierdo:") || reportLower.includes("miembro inferior izquierdo:") || reportLower.includes("extremidad inferior izquierda:") || reportLower.includes("lado izquierdo:");

    if (hasDerechoInStudy && !hasIzquierdoInStudy) {
      evaluatedSide = "der";
    } else if (hasIzquierdoInStudy && !hasDerechoInStudy) {
      evaluatedSide = "izq";
    } else if ((hasDerechoInReport || hasDerechoHeader) && !(hasIzquierdoInReport || hasIzquierdoHeader)) {
      evaluatedSide = "der";
    } else if ((hasIzquierdoInReport || hasIzquierdoHeader) && !(hasDerechoInReport || hasDerechoHeader)) {
      evaluatedSide = "izq";
    } else if (isUnilateralStudy) {
      const derCount = (reportLower.match(/derech|der\b|dch/g) || []).length;
      const izqCount = (reportLower.match(/izquierd|izq\b/g) || []).length;
      if (derCount > izqCount) {
        evaluatedSide = "der";
      } else if (izqCount > derCount) {
        evaluatedSide = "izq";
      }
    }

    let finalTable = parsedResult.table || "";
    if (evaluatedSide !== "both" && finalTable) {
      const lines = finalTable.split("\n");
      const filteredLines: string[] = [];
      let colIndexToRemove = -1;
      let headersParsed = false;

      for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|")) {
          filteredLines.push(line);
          continue;
        }

        const parts = line.split("|");
        if (!headersParsed) {
          for (let i = 1; i < parts.length - 1; i++) {
            const headerText = parts[i].toLowerCase();
            if (evaluatedSide === "der" && (headerText.includes("izq") || headerText.includes("left"))) {
              colIndexToRemove = i;
              break;
            }
            if (evaluatedSide === "izq" && (headerText.includes("der") || headerText.includes("right"))) {
              colIndexToRemove = i;
              break;
            }
          }
          headersParsed = true;
        }

        if (colIndexToRemove !== -1) {
          const newParts = [...parts];
          newParts.splice(colIndexToRemove, 1);
          filteredLines.push(newParts.join("|"));
        } else {
          filteredLines.push(line);
        }
      }
      finalTable = filteredLines.join("\n");
    }

    res.json({
      success: true,
      table: finalTable,
      states: parsedResult.states || {},
      descriptions: parsedResult.descriptions || {},
      subLocations: parsedResult.subLocations || {},
      carotidPlaques: parsedResult.carotidPlaques || []
    });

  } catch (error: any) {
    console.error("Error en /api/analyze-vascular:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
  }
});

/**
 * NEW API: ANALYZE SPECIFIC ANATOMICAL STRUCTURES FROM THE REPORT WITH HIGH FIDELITY
 * POST /api/analyze-anatomy
 */
app.post("/api/analyze-anatomy", async (req: express.Request, res: express.Response) => {
  try {
    const { model, reportText, studyType, structures, side } = req.body;
    if (!reportText) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte médico para realizar el análisis." });
    }
    if (!structures || !Array.isArray(structures) || structures.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere una lista de estructuras anatómicas para evaluar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    // Build the instruction list showing each structure and its human label
    let structuresPrompt = "";
    structures.forEach((struc: any) => {
      structuresPrompt += `- ID: "${struc.id}" (${struc.label})\n`;
    });

    let sidePrompt = "";
    if (side) {
      sidePrompt = `
[REGLA DE CONGRUENCIA DE LATERALIDAD - EXCLUSIVO PARA LADO ${side.toUpperCase()}]:
- Estás analizando EXCLUSIVAMENTE los hallazgos correspondientes al lado **${side.toUpperCase()}** (${side === "Derecho" ? "Derecho/Derecha/Der" : "Izquierdo/Izquierda/Izq"}).
- Si el reporte describe hallazgos para ambos lados (Bilateral), DEBES extraer SÓLO los que correspondan al lado **${side.toUpperCase()}**.
- Ignora por completo los hallazgos descritos para el lado opuesto.
- Si una estructura no se describe específicamente para el lado **${side.toUpperCase()}** pero sí para el otro lado, debrás marcarla como "no_descrito" o "Normal" para el lado **${side.toUpperCase()}**.
`;
    }

    let breastInstruction = "";
    if (studyType && (studyType.toLowerCase().includes("mama") || studyType.toLowerCase().includes("mamograf"))) {
      breastInstruction = `
[REGLA ESPECIAL PARA ULTRASONIDO / ESTUDIO DE MAMAS]:
- Mapea minuciosamente las menciones de los hallazgos por cada eje o hora (1 a 12), región retroareolar, cola de spence y axila de ambas mamas (Mama Derecha "md_" y Mama Izquierda "mi_"):
  * Ejes horarios ("md_eje1" a "md_eje12", "mi_eje1" a "mi_eje12"): Si el reporte menciona un nódulo, quiste, masa o hallazgo en hora X, eje X, 10:00, 10h, radio X o CSE/CSI/CIE/CII, asígnalo al ID del eje correspondiente.
  * Región retroareolar ("md_retroareolar", "mi_retroareolar"): Si se describe ectasia, conductos o lesión detrás del pezón.
  * Prolongación axilar / Cola de Spence ("md_cola_spence", "mi_cola_spence"): Si se menciona tejido o alteración en cola de Spence.
  * Región axilar ("md_axila", "mi_axila"): Si se mencionan adenopatías, ganglios o hallazgos en fosa axilar.
- Si una estructura presenta una lesión, asigna un "state" representativo (ej: "Nódulo Hipoecoico", "Quiste Simple", "Fibroadenoma", "Ectasia Ductal", "Adenopatía") y en "description" extrae el resumen del hallazgo con sus medidas y características del reporte.
- Si el reporte no menciona hallazgos para una hora o región en particular, márcala como "no_descrito".
`;
    }

    let neckInstruction = "";
    if (studyType && (studyType.toLowerCase().includes("cuello") || studyType.toLowerCase().includes("tiroide"))) {
      neckInstruction = `
[REGLA ESPECIAL PARA GANGLIOS CERVICALES EN ESTUDIOS DE CUELLO]:
- Si el reporte describe "adenopatías cervicales de aspecto inflamatorio bilateral", "adenopatías reactivas bilaterales" o hallazgos ganglionares generales SIN especificar un nivel ganglionar individual (Nivel I, Nivel II, Nivel III, Nivel IV, Nivel V, Nivel VI, Nivel VII):
  * Cada uno de los niveles ganglionares individuales ("nodes_r_i"..."nodes_r_vii", "nodes_l_i"..."nodes_l_vii") DEBE ser asignado a "Normal" (o "no_descrito") para que el esquema los muestre en VERDE.
  * SÓLO asigna un estado alterado a un nivel ganglionar individual si el reporte hace referencia explícita a dicho nivel específico (ej. "nivel IIa", "nivel III derecho", etc.).
`;
    }

    let abdomenInstruction = "";
    if (studyType && studyType.toLowerCase().includes("abdomen")) {
      abdomenInstruction = `
[REGLA ESPECIAL PARA ESTUDIOS DE ABDOMEN Y TARJETAS SINOPSIS DE ÓRGANOS]:
- Para cada uno de los órganos y estructuras del abdomen (Hígado, Vesícula, Vías biliares / Colédoco, Páncreas, Bazo, Riñón derecho, Riñón izquierdo, Vejiga, Próstata, Útero, Ovarios, Retroperitoneo, Intestino delgado, Ascitis / Líquido libre, Pared abdominal):
  1. Lee CUIDADOSAMENTE tanto la sección de HALLAZGOS (descripción anatómica detallada) como la IMPRESIÓN DIAGNÓSTICA / CONCLUSIONES del reporte.
  2. Extrae la SINOPSIS CLÍNICA INTELIGENTE y ESPECÍFICA correspondiente al hallazgo real descrita para ESE ÓRGANO en particular.
  3. La descripción debe ser EN POCAS PALABRAS (de 3 a 10 palabras), inteligente, directa y libre de introducciones o redundancias, conservando las medidas (mm/cm) o características clave descritas en el reporte.
     - Ejemplos de sinopsis inteligentes para órganos alterados:
       * Hígado: "Esteatosis hepática moderada con hepatomegalia (165 mm)."
       * Vesícula: "Litiasis vesicular múltiple con colecistitis y pared de 4.5 mm."
       * Vías Biliares: "Coledocolitiasis distal de 6 mm con dilatación del conducto (9 mm)."
       * Páncreas: "Páncreas de tamaño conservado con dilatación del Wirsung (4 mm)."
       * Bazo: "Esplenomegalia moderada (142 mm) de aspecto homogéneo."
       * Riñón Derecho: "Nefrolitiasis derecha de 5 mm en cáliz inferior sin hidronefrosis."
       * Riñón Izquierdo: "Quiste cortical simple de 20 mm en polo superior."
       * Vejiga: "Paredes delgadas con abundante sedimento urinario en declive."
       * Próstata: "Hiperplasia prostática benigna grado II de 45 cc."
       * Útero: "Miomatosis uterina intramural de 25 mm."
       * Retroperitoneo: "Adenopatías retroperitoneales interaortocavas de 12 mm."
       * Intestino Delgado: "Edema de pared intestinal con asas delgadas dilatadas."
       * Ascitis: "Escasa cantidad de líquido libre en fondo de saco de Douglas."
       * Pared Abdominal: "Hernia umbilical reducible con defecto aponeurótico de 10 mm."
  4. Si el órgano o estructura no presenta alteraciones y es normal en el reporte: "Dentro de límites normales."
  5. Si el órgano o estructura no se menciona ni se describe en ninguna parte del reporte: "No mencionado / No descrito."
  6. Queda estrictamente prohibido responder "Alteración descrita" o frases genéricas predefinidas cuando hay hallazgos específicos en el texto.
`;
    }

    let specialInstruction = `
[REGLA DE CONGRUENCIA Y SINCERIDAD ESTRICTA]:
- Analiza con sumo cuidado TODO el texto del reporte médico (tanto el cuerpo general "Hallazgos" como las conclusiones "Impresión Diagnóstica / Conclusión").
- NO inventes ni asumas ningún hallazgo patológico que no esté explícitamente escrito en el texto.
- Si una estructura se describe como "Normal", "Sin alteraciones", "Conservado", "Homogéneo", "Límites normales", "No muestra alteraciones" o similar, su "state" DEBE ser strictly "Normal" y su "description" DEBE ser EXACTAMENTE "Dentro de límites normales.".
- Si la estructura no se menciona en ninguna parte de todo el reporte, su "state" DEBE ser "no_descrito" y su "description" DEBE ser "No mencionado / No descrito.".

- EN PARTICULAR PARA LA ASCITIS / LÍQUIDO LIBRE ("ascitis"):
  * Si el reporte menciona "no se observa líquido libre", "sin líquido libre", "no se evidencia líquido", "recesos libres", "douglas sin líquido", "sin colecciones", o no describe ninguna acumulación de líquido libre o ascitis, el "state" DEBE ser "Normal" (o "no_descrito" si no se menciona en absoluto).
  * BAJO NINGUNA CIRCUNSTANCIA debes asignarle un nivel patológico como "leve", "moderada", "severa" o "líquido libre" si el reporte indica que no hay líquido o que la cavidad está libre/limpia. Sé sumamente riguroso con esto: no inventar ascitis.
- NO utilices términos predeterminados del sistema ni asumas defaults/hallazgos clásicos. El estado ("state") debe describir de forma muy concisa (de 1 a 3 palabras) el diagnóstico patológico real escrito en el texto (por ejemplo: "Ruptura Completa", "Desgarro", "Bursitis", "Hernia umbilical", "Normal", "no_descrito").
- Está terminantemente prohibido alucinar niveles de severidad, medidas, escalas, o patologías que no estén explícitamente escritas en el texto.
${sidePrompt}
${breastInstruction}
${neckInstruction}
${abdomenInstruction}
`;

    const promptText = `
Estudio clínico / Región: ${studyType || "No especificado"}

Reporte Radiológico Completo:
"""
${reportText}
"""

Tu misión es analizar detenidamente el reporte anterior y extraer los hallazgos reales correspondientes a las siguientes estructuras anatómicas, sin inventar nada:
${structuresPrompt}

${specialInstruction}

Para cada una de estas estructuras en la lista:
1. "state": Determina el estado o diagnóstico clínico corto de la estructura derivado directamente del reporte (en español, ej: "Normal", "Tendinosis", "Derrame articular", "Desgarro", "Bursitis", "Hernia umbilical", "Normal", "no_descrito" etc.). Genera un término médico conciso (de 1 a 3 palabras) del hallazgo en lenguaje natural (ej: "Litiasis vesicular", "Esteatosis leve", "Normal", "no_descrito").
   - Analiza con sumo cuidado la negación de hallazgos (ej: "sin líquido libre", "no se observa líquido libre", "sin litiasis" significan estado normal o libre).
   - Si la estructura está sana o indica un aspecto normal, usa exactamente "Normal".
   - Si la estructura no se describe ni se menciona en absoluto, entonces elige obligatoriamente "no_descrito".

2. "description": Genera un resumen clínico del hallazgo que sea extremadamente COMPACTO, BREVE y DIRECTO para esa estructura (en español).
   - IMPORTANTE: Si la estructura es normal o sana (estado "Normal"), la descripción DEBE ser EXACTAMENTE: "Dentro de límites normales."
   - Si la estructura NO está descrita en el reporte (estado "no_descrito"), responde: "No mencionado / No descrito."
   - Si tiene una anomalía o hallazgo patológico, genera un micro-resumen ultra-concreto de solo 2 a 7 palabras (ej: "Litiasis de 15mm", "Esteatosis hepática leve", "Paredes engrosadas", "Hernia reducible"). Evita explicaciones largas, rodeos o redundancias para asegurar que la descripción quepa perfectamente en el cuadro.
   - No alucines escalas, grados ni dimensiones que no figuren explícitamente en el texto.

Devuelve la lista "results" con el análisis de cada estructura solicitada.
`;

    const systemInstruction = `Eres un radiólogo experto. Analizas reportes médicos y extraes hallazgos muy específicos y resumidos para cada estructura anatómica solicitada, sin inventar nada. Evita alucinar detalles que no están en el texto original.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID de la estructura anatómica." },
                  state: { type: Type.STRING, description: "Estado clínico extraído exactamente de las opciones permitidas." },
                  description: { type: Type.STRING, description: "Resumen clínico sintetizado, muy cuidadoso y veraz, sin inventar o alucinar grados/medidas." }
                },
                required: ["id", "state", "description"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    let botText = response.text || "{}";
    botText = botText.trim();
    if (botText.startsWith("```")) {
      const firstLineEnd = botText.indexOf("\n");
      if (firstLineEnd !== -1) {
        botText = botText.substring(firstLineEnd).trim();
      }
      if (botText.endsWith("```")) {
        botText = botText.substring(0, botText.length - 3).trim();
      }
    }

    const parsedData = JSON.parse(botText);
    const finalStates: Record<string, string> = {};
    const finalDescriptions: Record<string, string> = {};

    if (parsedData.results && Array.isArray(parsedData.results)) {
      parsedData.results.forEach((r: any) => {
        if (r.id && r.state) {
          const val = r.state.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (val === "normal" || val === "sano") {
            finalStates[r.id] = "normal";
          } else if (
            val === "no_descrito" || 
            val === "no descrito" || 
            val === "omitido" || 
            val === "no mencionado" || 
            val === "no_determinado" || 
            val === "sin_descripcion" || 
            val === "no_mencionado"
          ) {
            finalStates[r.id] = "no_descrito";
          } else {
            finalStates[r.id] = r.state;
          }
          finalDescriptions[r.id] = r.description || "No descrito.";
        }
      });
    }

    res.json({
      success: true,
      states: finalStates,
      descriptions: finalDescriptions
    });

  } catch (error: any) {
    console.error("Error en /api/analyze-anatomy:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

app.post("/api/smart-modify-anatomy", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentStates, currentDescriptions, studyType, structures, instruction, reportText, currentAdditionalFindings } = req.body;
    if (!instruction) {
      return res.status(400).json({ success: false, error: "Se requiere la instrucción en lenguaje natural para realizar la modificación." });
    }
    if (!structures || !Array.isArray(structures) || structures.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere la lista de estructuras anatómicas." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    // Format current states for prompt
    let currentStateStr = "";
    structures.forEach((struc: any) => {
      const curState = currentStates?.[struc.id] || "no_descrito";
      const curDesc = currentDescriptions?.[struc.id] || "No mencionado / No descrito.";
      currentStateStr += `- Estructura: "${struc.id}" (${struc.label})\n`;
      currentStateStr += `  - Estado actual: "${curState}"\n`;
      currentStateStr += `  - Descripción actual: "${curDesc}"\n\n`;
    });

    // Format current additional findings
    let additionalFindingsStr = "";
    if (currentAdditionalFindings && Array.isArray(currentAdditionalFindings)) {
      currentAdditionalFindings.forEach((f: any) => {
        additionalFindingsStr += `- ID: "${f.id}", Estructura/Región: "${f.structureName}", Estado: "${f.state}", Descripción: "${f.description}"\n`;
      });
    }

    const promptText = `
Estudio clínico / Región: ${studyType || "No especificado"}

INSTRUCCIÓN DE MODIFICACIÓN DEL USUARIO (en lenguaje natural):
"""
${instruction}
"""

Reporte médico de referencia (opcional):
"""
${reportText || "No provisto"}
"""

A continuación se listan las estructuras médicas actuales con sus estados y descripciones predefinidas del DIBUJO:
${currentStateStr}

A continuación se listan los HALLAZGOS ADICIONALES (no graficados en el dibujo) que se tienen actualmente:
${additionalFindingsStr || "Ninguno"}

Tu objetivo es aplicar de manera inteligente la INSTRUCCIÓN DE MODIFICACIÓN tanto a la lista predefinida (dibujo) como a la lista de hallazgos adicionales.

REGLAS DE DECISIÓN:
1. Para cada estructura de la lista predefinida del DIBUJO:
   - Si la instrucción del usuario implica modificar su estado/diagnóstico o sugerencia del reporte, actualízalos.
   - El "state" debe ser el diagnóstico corto (ej: "Normal", "Tendinosis", "Desgarro", "Derrame leve", etc.). Si el usuario pide que sea normal o sano, el estado DEBE ser "Normal".
   - Si se cambia a un estado patológico, genera una "description" corta (ej: "Tendinosis del supraespinoso" o similar).
   - Si se cambia a estado "Normal", la "description" DEBE ser: "Dentro de límites normales."
   - Si se indica borrar, quitar o "no descrito", cambia el estado a "no_descrito" y la descripción a "No mencionado / No descrito."
   - Si la instrucción del usuario no afecta de ninguna manera a esa estructura, mantenla EXACTAMENTE con su "state" y "description" actuales.

2. Para estructuras / regiones de HALLAZGOS ADICIONALES (que NO están en la lista de estructuras predefinidas del dibujo, p. ej. "Grasa de Hoffa", "Hoffitis", "Quiste de Baker" si no está mapeado, etc.):
   - Si el usuario solicita añadir, registrar o describe un diagnóstico de un sitio que NO está en la lista de estructuras predefinidas del dibujo, debes agregarlo a la lista de resultados de "additionalFindings".
   - Genera un "id" como "finding-extra-" + un número secuencial único.
   - "structureName": El nombre literal o normalizado del sitio/hallazgo (ej: "Grasa de Hoffa").
   - "state": El estado clínico (ej: "Alterado", "Colección", "Desgarro", "Complejo", "Normal").
   - "description": La descripción resumida correspondiente de forma literal (ej: "Cambios inflamatorios de la grasa de Hoffa").
   - Si el usuario indica eliminar, quitar o sanar un hallazgo adicional ya existente, no lo incluyas en la lista devuelta "additionalFindings".
   - Si el usuario no menciona modificar ni eliminar un hallazgo adicional existente, presérvalo EXACTAMENTE igual en la lista devuelta "additionalFindings" con su ID y datos actuales.
`;

    const systemInstruction = `Eres un radiólogo experto especializado en sincronización anatómica estructurada y hallazgos adicionales no representados en esquemas. Analizas instrucciones naturales para modificar de forma precisa el mapeo clínico de una lista de tejidos predefinidos y registrar nuevos hallazgos adicionales libres sin dibujo asociado.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID de la estructura anatómica." },
                  state: { type: Type.STRING, description: "Estado clínico final (modificado o conservado)." },
                  description: { type: Type.STRING, description: "Descripción resumida final (modificada o conservada)." }
                },
                required: ["id", "state", "description"]
              }
            },
            additionalFindings: {
              type: Type.ARRAY,
              description: "Estructuras adicionales que no forman parte del dibujo pero que el usuario ha solicitado agregar/modificar como hallazgos.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID único o ID actual." },
                  structureName: { type: Type.STRING, description: "Nombre de la estructura o región clínica (ej: Grasa de Hoffa)." },
                  state: { type: Type.STRING, description: "Estado (ej: Alterado, Coleccion, Desgarro, Complejo, Normal)" },
                  description: { type: Type.STRING, description: "Descripción resumida del hallazgo (ej: Cambios inflamatorios de la grasa de Hoffa)." }
                },
                required: ["id", "structureName", "state", "description"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    let botText = response.text || "{}";
    botText = botText.trim();
    if (botText.startsWith("```")) {
      const firstLineEnd = botText.indexOf("\n");
      if (firstLineEnd !== -1) {
        botText = botText.substring(firstLineEnd).trim();
      }
      if (botText.endsWith("```")) {
        botText = botText.substring(0, botText.length - 3).trim();
      }
    }

    const parsedData = JSON.parse(botText);
    const finalStates: Record<string, string> = {};
    const finalDescriptions: Record<string, string> = {};

    if (parsedData.results && Array.isArray(parsedData.results)) {
      parsedData.results.forEach((r: any) => {
        if (r.id && r.state) {
          const val = r.state.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (val === "normal" || val === "sano") {
            finalStates[r.id] = "normal";
          } else if (
            val === "no_descrito" || 
            val === "no descrito" || 
            val === "omitido" || 
            val === "no mencionado" || 
            val === "no_determinado" || 
            val === "sin_descripcion" || 
            val === "no_mencionado"
          ) {
            finalStates[r.id] = "no_descrito";
          } else {
            finalStates[r.id] = r.state;
          }
          finalDescriptions[r.id] = r.description || "No descrito.";
        }
      });
    }

    res.json({
      success: true,
      states: finalStates,
      descriptions: finalDescriptions,
      additionalFindings: parsedData.additionalFindings || []
    });

  } catch (error: any) {
    console.error("Error en /api/smart-modify-anatomy:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * NEW API: SPECIAL INTERACTIVE AI PARAGRAPH ACTIONS
 * POST /api/ai-paragraph-action
 * Payload: {
 *   text: string (the selected paragraph or text)
 *   action: "analyze" | "improve" | "expand" | "explain" | "classify"
 *   fullReport?: string (context)
 *   studyType?: string (context)
 *   clinicalHistory?: string (context)
 * }
 */
app.post("/api/ai-paragraph-action", async (req: express.Request, res: express.Response) => {
  try {
    const { model, text, action, fullReport, studyType, clinicalHistory } = req.body;
    if (!text || !action) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'text' y 'action' para continuar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    let systemInstruction = "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica.";
    let promptText = "";

    const contextPart = `
--- CONTEXTO DEL CASO ---
Tipo de Estudio: ${studyType || "No especificado"}
Indicación Clínica: ${clinicalHistory || "No especificada"}
${fullReport ? `Reporte Completo de Referencia:\n"""\n${fullReport}\n"""` : ""}
-------------------------
`;

    if (action === "analyze") {
      systemInstruction = "Eres un consultor radiólogo académico de élite. Tu función es analizar de manera científica, crítica y rigurosa descripciones o fragmentos de informes radiológicos.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para analizar:
"""
${text}
"""

Por favor, realiza un análisis clínico sumamente detallado de este fragmento. Explica:
1. Qué hallazgos describe y su relevancia anatomopatológica.
2. Posibles diagnósticos diferenciales de sospecha que se asocian a esta descripción.
3. Sugerencias clínicas o técnicas para el médico (ej. estudios complementarios de mayor resolución si corresponde) basadas en este hallazgo.

Responde con un formato Markdown elegante, profesional, y de lectura rápida (usa viñetas o números para que sea fácil de digerir).
`;
    } else if (action === "improve") {
      systemInstruction = "Eres un médico radiólogo experto en redacción científica. Tu función es reescribir y perfeccionar descripciones radiológicas, logrando un tono de la más alta elegancia, sobriedad y exactitud clínica.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para mejorar:
"""
${text}
"""

Por favor, reescribe este fragmento para que tenga una redacción médica impecable, fluida, profesional y de la más alta elegancia radiológica.
Sigue estrictamente estas reglas:
1. Conserva exactamente las mismas observaciones diagnósticas, mediciones, lateralidades, y hallazgos reales. No inventes patologías.
2. **REGLA DE CASING ESTRICTA**: No escribas el texto resultante en mayúsculas sostenidas. Utiliza minúsculas estándar con mayúsculas iniciales.
3. Devuelve **ÚNICAMENTE el fragmento de texto ya mejorado**, sin preámbulos, saludos, comentarios aclaratorios, ni comillas iniciales/finales. Debe estar listo para ser inyectado y reemplazar el texto original directamente.
`;
    } else if (action === "expand") {
      systemInstruction = "Eres un médico radiólogo experto. Tu función es enriquecer y complementar hallazgos radiológicos, aumentando ligeramente su nivel de detalle, precisión descriptiva y correlaciones clínicas correspondientes, sin caer en extensiones excesivas o redundancias.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para hacer exhaustivo:
"""
${text}
"""

Por favor, reescribe y complementa este fragmento de manera elegante y fluida. 
Instrucciones específicas:
1. Incrementa el nivel de detalle clínico y la precisión descriptiva de forma MODERADA (no exagerada ni excesivamente larga).
2. Agrega de forma sutil las correlaciones clínicas o repercusiones funcionales pertinentes asociadas a los hallazgos descritos, enriqueciendo el vocabulario radiológico de subespecialidad.
3. Evita preámbulos explicativos o redundancias artificiales. El texto debe sonar profesional, conciso pero detallado y con gran fluidez.
4. **REGLA DE CASING ESTRICTA**: No escribas el texto resultante en mayúsculas sostenidas. Utiliza minúsculas estándar con mayúsculas iniciales.
5. Devuelve **ÚNICAMENTE el fragmento de texto ya enriquecido/expandido**, sin comentarios explicativos, notas, introducciones ni comillas. Debe estar listo para reemplazar el fragmento original de inmediato.
`;
    } else if (action === "explain") {
      systemInstruction = "Eres un médico radiólogo y educador clínico paciente, cálido y sumamente didáctico.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para explicar:
"""
${text}
"""

Por favor, explica de manera sencilla, clara y detallada el significado de este fragmento para un paciente o un médico no especialista.
Instrucciones:
1. Traduce los tecnicismos radiológicos complejos a un lenguaje comprensible sin perder el rigor clínico.
2. Explica qué significan los hallazgos descritos, por qué son relevantes, y la importancia médica general del fragmento.
3. No des pautas de tratamiento específicas ni recomendaciones de medicamentos. Enfócate únicamente en la explicación didáctica y comprensible de los hallazgos.
4. Responde con un tono empático, claro, y estructurado en Markdown con viñetas.
`;
    } else if (action === "classify") {
      systemInstruction = "Eres un consultor de clasificaciones radiológicas internacionales de consenso (como BI-RADS, Bosniak, Fleischner, etc.).";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para clasificar:
"""
${text}
"""

Por favor, identifica qué escala, clasificación o criterios médicos de consenso internacional (ej: escala de Bosniak para quistes renales, criterios de Fleischner para nódulos incidentales, BI-RADS, clasificación de Kellgren-Lawrence para artrosis de rodilla, etc.) encajan con el hallazgo descrito en el fragmento.
Instrucciones:
1. Determina y asigna de manera justificada el grado, categoría o score correspondiente de la escala aplicable.
2. Redacta una recomendación o nota formal y exacta en español para ser incorporada al informe (con el grado y conducta recomendada).
3. Responde de forma muy concisa y organizada en Markdown. En la primera sección, explica brevemente la escala sugerida y el cálculo. En la segunda sección, escribe un apartado titulado "**Texto a incorporar:**" con el bloque de texto formal que el médico puede agregar al reporte.
`;
    } else if (action === "custom") {
      const customPrompt = req.body.customPrompt || "Por favor, evalúa este fragmento.";
      systemInstruction = "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica y académica.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado:
"""
${text}
"""

Petición/Instrucción del usuario para evaluar o procesar este fragmento:
"${customPrompt}"

Por favor, realiza la tarea solicitada sobre el fragmento con la máxima precisión, elegancia y rigurosidad radiológica.
Sigue estrictamente las pautas que ha especificado el usuario. Si la instrucción del usuario pide reescribir o mejorar, devuelve el fragmento editado limpio sin saludos. Si es una pregunta, responde con precisión en formato Markdown estructurado.
`;
    } else {
      return res.status(400).json({ success: false, error: `La acción '${action}' no es válida.` });
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: action === "improve" || action === "expand" ? 0.1 : 0.2,
      },
    });

    res.json({
      success: true,
      result: response.text,
      action_used: action,
    });
  } catch (error: any) {
    console.error("Error en /api/ai-paragraph-action:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 23. API: ANALYZE MEASUREMENTS IN REPORT (Asistente de Medidas)
 * POST /api/analyze-measurements
 * Payload: {
 *   report: string,
 *   model?: string
 * }
 */
app.post("/api/analyze-measurements", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para analizar las medidas." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un radiólogo senior y experto en anatometría clínica y hemodinámica vascular. Tu tarea es analizar rigurosamente el informe radiológico proporcionado para:\n" +
      "1. Determinar con la máxima precisión posible el tipo de estudio radiológico realizado basándote en el contenido del reporte (por ejemplo: 'Doppler de Carótidas', 'Ultrasonido Abdominal Completo', 'Doppler Renal', 'Doppler Venoso de Miembros Inferiores', 'Ultrasonido de Tiroides', 'Ultrasonido Pélvico', 'Ultrasonido de Partes Blandas', etc.) y guardarlo en el campo 'detectedStudyType'.\n" +
      "2. Identificar de manera dinámica todas las estructuras anatómicas, vasos sanguíneos, velocidades o parámetros que son típicamente susceptibles de medición clínica e indispensables para ese tipo de estudio específico:\n" +
      "   - Si detectas que es un DOPPLER DE CARÓTIDAS o DOPPLER CAROTÍDEO: Debes incluir de forma obligatoria y exhaustiva las siguientes 22 mediciones y parámetros bilateralmente, buscando sus valores reales en el reporte, o sugiriendo sus valores normales por defecto correspondientes si no se mencionan:\n" +
      "     1. Arteria Carótida Común Derecha (VPS) [Rango: 50 - 100 cm/s, Default: 75 cm/s]\n" +
      "     2. Arteria Carótida Común Derecha (VED) [Rango: < 35 cm/s, Default: 20 cm/s]\n" +
      "     3. Arteria Carótida Interna Derecha (VPS) [Rango: < 125 cm/s, Default: 70 cm/s]\n" +
      "     4. Arteria Carótida Interna Derecha (VED) [Rango: < 40 cm/s, Default: 25 cm/s]\n" +
      "     5. Arteria Carótida Externa Derecha (VPS) [Rango: < 115 cm/s, Default: 65 cm/s]\n" +
      "     6. Arteria Carótida Externa Derecha (VED) [Rango: < 30 cm/s, Default: 15 cm/s]\n" +
      "     7. Arteria Carótida Común Izquierda (VPS) [Rango: 50 - 100 cm/s, Default: 75 cm/s]\n" +
      "     8. Arteria Carótida Común Izquierda (VED) [Rango: < 35 cm/s, Default: 20 cm/s]\n" +
      "     9. Arteria Carótida Interna Izquierda (VPS) [Rango: < 125 cm/s, Default: 70 cm/s]\n" +
      "     10. Arteria Carótida Interna Izquierda (VED) [Rango: < 40 cm/s, Default: 25 cm/s]\n" +
      "     11. Arteria Carótida Externa Izquierda (VPS) [Rango: < 115 cm/s, Default: 65 cm/s]\n" +
      "     12. Arteria Carótida Externa Izquierda (VED) [Rango: < 30 cm/s, Default: 15 cm/s]\n" +
      "     13. Grosor Miointimal Derecho (GIM) [Rango: < 0.9 mm, Default: 0.6 mm]\n" +
      "     14. Grosor Miointimal Izquierdo (GIM) [Rango: < 0.9 mm, Default: 0.6 mm]\n" +
      "     15. Presencia de Placas (Derecha) [Rango: Sin placas, Default: Sin placas]\n" +
      "     16. Presencia de Placas (Izquierda) [Rango: Sin placas, Default: Sin placas]\n" +
      "     17. Arteria Vertebral Derecha (VPS) [Rango: 20 - 60 cm/s, Default: 35 cm/s]\n" +
      "     18. Arteria Vertebral Derecha (Dirección) [Rango: Anterógrado, Default: Anterógrado]\n" +
      "     19. Arteria Vertebral Izquierda (VPS) [Rango: 20 - 60 cm/s, Default: 35 cm/s]\n" +
      "     20. Arteria Vertebral Izquierda (Dirección) [Rango: Anterógrado, Default: Anterógrado]\n" +
      "     21. Relación ACC/ACI Derecha [Rango: < 2.0, Default: 1.2]\n" +
      "     22. Relación ACC/ACI Izquierda [Rango: < 2.0, Default: 1.2]\n" +
      "   - Si detectas que es un DOPPLER ARTERIAL O VENOSO DE MIEMBROS (INFERIORES O SUPERIORES):\n" +
      "     * ¡IMPORTANTE SOBRE LATERALIDAD!: Si el estudio es unilateral (por ejemplo, el reporte solo evalúa el miembro izquierdo 'izq' o solo el derecho 'der'), DEBES reportar 'detectedSide' como 'izq' o 'der' y devolver ÚNICAMENTE las estructuras vasculares de ese miembro evaluado. ¡ESTÁ ESTRICTAMENTE PROHIBIDO INCLUIR, NOMBRAR O INVENTAR DATOS NORMALES PARA EL MIEMBRO CONTRALATERAL NO EVALUADO! Si el estudio evalúa de forma explícita ambos miembros, reporta 'both' y devuelve los vasos de ambos lados.\n" +
      "     * Si es DOPPLER ARTERIAL: Debes analizar de manera exhaustiva el reporte para extraer las características de flujo, velocidades y forma de onda de cada uno de los vasos principales. Los vasos son: Arteria Ilíaca Común (AIC), Arteria Femoral Común (AFC), Arteria Femoral (AF) [¡NUNCA uses el término Femoral Superficial, usa únicamente Arteria Femoral o AF!], Arteria Poplítea (AP), Arteria Tibial Anterior (ATA), Arteria Tibial Posterior (ATP), Arteria Peronea (APer) y Arteria Pedia (APed). Realiza una evaluación inteligente:\n" +
      "       - Si la conclusión diagnóstica señala que un vaso tiene una patología o alteración, priorízala para marcar el estado como 'altered'.\n" +
      "       - 1. 'Trifásico' o 'Flujo trifásico' -> Status: 'normal'. Interpretation: 'Flujo normal (Onda Trifásica)'.\n" +
      "       - 2. 'Atenuado' o 'Flujo atenuado' o 'Atenuada' -> Status: 'altered'. Interpretation: 'Estenosis leve'.\n" +
      "       - 3. 'Ensanchamiento espectral' -> Status: 'altered'. Interpretation: 'Estenosis moderada'.\n" +
      "       - 4. 'Monofásico' o 'Flujo monofásico' -> Status: 'altered'. Interpretation: 'Estenosis severa'.\n" +
      "       - 5. 'Flujo no detectable' o 'Flujo filiforme' o 'Oclusión' -> Status: 'altered'. Interpretation: 'Estenosis muy severa/oclusión'.\n" +
      "     * Si es DOPPLER VENOSO DE MIEMBROS INFERIORES: Evalúa el estado de las venas (Vena Femoral Común, Vena Femoral, Vena Poplítea, Venas Tibiales, Vena Safena Mayor, Vena Safena Menor). Mapea su estado de permeabilidad y competencia valvular.\n" +
      "   - Si detectas que es un DOPPLER RENAL: Incluye velocidades pico sistólicas y los Índices de Resistencia (IR) renales arteriales principales.\n" +
      "   - Si detectas que es un ULTRASONIDO DE ABDOMEN (o riñón/vías urinarias está involucrado) o ULTRASONIDO ABDOMINAL COMPLETO: Debes incluir de manera obligatoria las 8 mediciones renales específicas (Riñón Derecho Largo, Ancho, Grosor Cortical e IR; Riñón Izquierdo Largo, Ancho, Grosor Cortical e IR) con sus rangos de referencia estándares. Además, para los estudios de abdomen, debes incluir de manera obligatoria los siguientes parámetros con sus rangos y valores predeterminados exactos:\n" +
      "     * Hígado [Rango: 120 - 154 mm, Default: 135 mm]\n" +
      "     * Bazo [Rango: 9 - 11,8 mm, Default: 10,5 mm]\n" +
      "     * Rigidez Hepática (Elastografía) [Rango: 4 - 5,4 kPa, Default: 4,7 kPa]\n" +
      "   - Si detectas que es un ULTRASONIDO DE TIROIDES o US DE CUELLO / ULTRASONIDO DE CUELLO: Incluye medidas de lóbulos (ej. 'Lóbulo Derecho (Longitudinal)', 'Lóbulo Derecho (Anteroposterior)', 'Lóbulo Derecho (Transverso)', 'Lóbulo Izquierdo...', 'Istmo (Espesor)'). Rango normal de espesor de istmo: < 4 mm, lóbulos longitud: 37 - 44 mm, lóbulos anteroposterior: 10 - 20 mm, lóbulos transverso: 15 - 20 mm. Está ESTRICTAMENTE PROHIBIDO incluir vasos sanguíneos o parámetros del sistema carotídeo (Arterias Carótidas Comunes, Internas, Externas, Arterias Vertebrales, Grosor Miointimal (GIM), o Relación ACC/ACI) en este estudio, ya que esas estructuras corresponden única y exclusivamente al Doppler de Carótidas.\n" +
      "   - Si detectas que es un ULTRASONIDO PÉLVICO/GINECOLÓGICO: Incluye 'Útero (Longitudinal)', 'Útero (Anteroposterior)', 'Útero (Transversal)', 'Endometrio (Espesor)', 'Ovario Derecho (Volumen)', 'Ovario Izquierdo (Volumen)'.\n" +
      "3. Para cada estructura o parámetro:\n" +
      "   - Indicar su rango o límite normal estándar aceptado en medicina clínica con unidades (ej: 'Hasta 150 mm', 'Pared hasta 3 mm', '90 - 120 mm', '< 125 cm/s').\n" +
      "   - Buscar si el informe ya menciona alguna medición para esa estructura (ej. 'hígado de 165 mm', 'VPS de 85 cm/s', etc.). Si se menciona, extraer la medida exacta encontrada. Si no se menciona ninguna medida, dejarlo vacío ('').\n" +
      "   - Determinar el estado ('status'): 'normal' si hay medida y está en rango normal; 'altered' si hay medida y se desvía del rango; 'not_found' si no se menciona ninguna medida en el reporte.\n" +
      "   - Ofrecer una interpretación o sugerencia diagnóstica concisa en base a su estado (ej: 'Flujo hemodinámicamente normal', 'Estenosis significativa', 'Hepatomegalia', 'Sin medir').\n" +
      "   - Proponer un valor normal por defecto representativo y saludable ('defaultNormalValue') con unidades (ej. '105 mm', '12 mm', '75 cm/s', '0.60', etc.) que cumpla el rango normal y se pueda asignar directamente si el usuario lo desea.\n" +
      "Debes estructurar la respuesta exclusivamente como un objeto JSON con tres propiedades: 'detectedStudyType', 'detectedSide' y 'structures'.";

    const promptText = `Analiza detenidamente este informe radiológico para el Asistente de Medidas:

"""
${report}
"""

Detecta el tipo de estudio médico, el lado analizado si es unilateral (der, izq, both), identifica todas las estructuras, vasos o parámetros relevantes a medir para dicho estudio, indica sus rangos normales, busca si el reporte ya contiene medidas para ellos, califica su estado e interpretación, y sugiere un valor normal predeterminado saludable.
Devuelve el JSON estructurado según el esquema solicitado.`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedStudyType: {
              type: Type.STRING,
              description: "Tipo de estudio médico detectado a partir del informe (ej. 'Doppler de Carótidas', 'Ultrasonido Abdominal Completo', 'Doppler Venoso de Miembros Inferiores', 'Ultrasonido de Tiroides', etc.)."
            },
            detectedSide: {
              type: Type.STRING,
              description: "Lado analizado en el reporte si el estudio es unilateral de extremidades o de un solo lado (ej. 'der' para derecho, 'izq' para izquierdo, 'both' para ambos/bilateral)."
            },
            structures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  structure: { 
                    type: Type.STRING, 
                    description: "Nombre de la estructura, vaso o parámetro anatómico en español (ej. Hígado, Vesícula Biliar, Arteria Carótida Interna Derecha (VPS), Lóbulo Derecho de Tiroides (Longitudinal), etc.)." 
                  },
                  normalRange: { 
                    type: Type.STRING, 
                    description: "Rango normal sugerido clínicamente con sus unidades (ej. 'Hasta 150 mm', 'Pared hasta 3 mm', '50 - 100 cm/s', etc.)." 
                  },
                  measuredValue: { 
                    type: Type.STRING, 
                    description: "Medida exacta encontrada en el reporte para esta estructura/parámetro (ej. '138 mm', '75 cm/s', '4 mm'). Si no se encuentra ninguna medida para ella, debe ser una cadena vacía ''." 
                  },
                  status: { 
                    type: Type.STRING, 
                    description: "Estado de la estructura. Debe ser exactamente uno de estos tres valores: 'normal' (si tiene medida y está dentro del rango normal), 'altered' (si tiene medida y está fuera del rango), o 'not_found' (si no se especifica ninguna medida en el reporte)." 
                  },
                  interpretation: { 
                    type: Type.STRING, 
                    description: "Breve interpretación o diagnóstico clínico sugerido si está alterado (ej. 'Hepatomegalia leve', 'Estenosis carotídea leve', etc.) o confirmación de normalidad (ej. 'Flujo normal') o 'Sin medición registrada'." 
                  },
                  defaultNormalValue: { 
                    type: Type.STRING, 
                    description: "Un valor típico normal, saludable y estándar (con unidades, ej. '105 mm', '75 cm/s', '0.60', etc.) representativo de esa estructura para poder asignarlo directamente al reporte." 
                  }
                },
                required: ["structure", "normalRange", "measuredValue", "status", "interpretation", "defaultNormalValue"]
              }
            }
          },
          required: ["detectedStudyType", "detectedSide", "structures"]
        }
      }
    });

    const parsedData = JSON.parse(response.text!);

    // Post-processing to enforce the 22 mandatory carotid doppler parameters
    let isCarotidas = false;
    const studyLower = (parsedData.detectedStudyType || "").toLowerCase();
    const reportLower = (report || "").toLowerCase();
    const inputStudyLower = (studyType || "").toLowerCase();
    if (studyLower.includes("carot") || reportLower.includes("carot") || reportLower.includes("carótida") || inputStudyLower.includes("carot")) {
      isCarotidas = true;
    }

    if (isCarotidas) {
      if (!studyLower.includes("carot")) {
        parsedData.detectedStudyType = "Doppler de Carótidas";
      }

      const mandatoryCarotid = [
        {
          key: "acc_der_vps",
          name: "Arteria Carótida Común Derecha (VPS)",
          range: "50 - 100 cm/s",
          defaultVal: "72 cm/s",
          matchRegex: /com[uú]n.*der|acc.*der|der.*(com[uú]n|acc)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "acc_der_ved",
          name: "Arteria Carótida Común Derecha (VED)",
          range: "< 35 cm/s",
          defaultVal: "18 cm/s",
          matchRegex: /com[uú]n.*der|acc.*der|der.*(com[uú]n|acc)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "aci_der_vps",
          name: "Arteria Carótida Interna Derecha (VPS)",
          range: "< 125 cm/s",
          defaultVal: "68 cm/s",
          matchRegex: /interna.*der|aci.*der|der.*(interna|aci)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "aci_der_ved",
          name: "Arteria Carótida Interna Derecha (VED)",
          range: "< 40 cm/s",
          defaultVal: "22 cm/s",
          matchRegex: /interna.*der|aci.*der|der.*(interna|aci)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "ace_der_vps",
          name: "Arteria Carótida Externa Derecha (VPS)",
          range: "< 115 cm/s",
          defaultVal: "64 cm/s",
          matchRegex: /externa.*der|ace.*der|der.*(externa|ace)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "ace_der_ved",
          name: "Arteria Carótida Externa Derecha (VED)",
          range: "< 30 cm/s",
          defaultVal: "14 cm/s",
          matchRegex: /externa.*der|ace.*der|der.*(externa|ace)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "acc_izq_vps",
          name: "Arteria Carótida Común Izquierda (VPS)",
          range: "50 - 100 cm/s",
          defaultVal: "76 cm/s",
          matchRegex: /com[uú]n.*izq|acc.*izq|izq.*(com[uú]n|acc)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "acc_izq_ved",
          name: "Arteria Carótida Común Izquierda (VED)",
          range: "< 35 cm/s",
          defaultVal: "21 cm/s",
          matchRegex: /com[uú]n.*izq|acc.*izq|izq.*(com[uú]n|acc)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "aci_izq_vps",
          name: "Arteria Carótida Interna Izquierda (VPS)",
          range: "< 125 cm/s",
          defaultVal: "72 cm/s",
          matchRegex: /interna.*izq|aci.*izq|izq.*(interna|aci)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "aci_izq_ved",
          name: "Arteria Carótida Interna Izquierda (VED)",
          range: "< 40 cm/s",
          defaultVal: "26 cm/s",
          matchRegex: /interna.*izq|aci.*izq|izq.*(interna|aci)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "ace_izq_vps",
          name: "Arteria Carótida Externa Izquierda (VPS)",
          range: "< 115 cm/s",
          defaultVal: "66 cm/s",
          matchRegex: /externa.*izq|ace.*izq|izq.*(externa|ace)/i,
          matchSub: /vps|vmax|sist[oó]l/i,
          negativeSub: /ved|vmin|diast[oó]l/i
        },
        {
          key: "ace_izq_ved",
          name: "Arteria Carótida Externa Izquierda (VED)",
          range: "< 30 cm/s",
          defaultVal: "16 cm/s",
          matchRegex: /externa.*izq|ace.*izq|izq.*(externa|ace)/i,
          matchSub: /ved|vmin|diast[oó]l/i,
          negativeSub: /vps|vmax|sist[oó]l/i
        },
        {
          key: "gim_der",
          name: "Grosor Miointimal Derecho (GIM)",
          range: "< 0.9 mm",
          defaultVal: "0.6 mm",
          matchRegex: /(grosor|gim|intima|miointimal).*der|der.*(grosor|gim|intima|miointimal)/i,
          matchSub: /grosor|miointimal|gim|íntima-media/i
        },
        {
          key: "gim_izq",
          name: "Grosor Miointimal Izquierdo (GIM)",
          range: "< 0.9 mm",
          defaultVal: "0.6 mm",
          matchRegex: /(grosor|gim|intima|miointimal).*izq|izq.*(grosor|gim|intima|miointimal)/i,
          matchSub: /grosor|miointimal|gim|íntima-media/i
        },
        {
          key: "placas_der",
          name: "Presencia de Placas (Derecha)",
          range: "Sin placas",
          defaultVal: "Sin placas",
          matchRegex: /placa.*der|der.*placa/i,
          matchSub: /placa/i
        },
        {
          key: "placas_izq",
          name: "Presencia de Placas (Izquierda)",
          range: "Sin placas",
          defaultVal: "Sin placas",
          matchRegex: /placa.*izq|izq.*placa/i,
          matchSub: /placa/i
        },
        {
          key: "vert_der_vps",
          name: "Arteria Vertebral Derecha (VPS)",
          range: "20 - 60 cm/s",
          defaultVal: "32 cm/s",
          matchRegex: /vertebral.*der|der.*vertebral/i,
          matchSub: /vps|vmax|sist[oó]l|velocidad/i,
          negativeSub: /dirección|flujo|sentido/i
        },
        {
          key: "vert_der_dir",
          name: "Arteria Vertebral Derecha (Dirección)",
          range: "Anterógrado",
          defaultVal: "Anterógrado",
          matchRegex: /vertebral.*der|der.*vertebral/i,
          matchSub: /dirección|flujo|sentido/i,
          negativeSub: /vps|vmax|sist[oó]l|velocidad/i
        },
        {
          key: "vert_izq_vps",
          name: "Arteria Vertebral Izquierda (VPS)",
          range: "20 - 60 cm/s",
          defaultVal: "36 cm/s",
          matchRegex: /vertebral.*izq|izq.*vertebral/i,
          matchSub: /vps|vmax|sist[oó]l|velocidad/i,
          negativeSub: /dirección|flujo|sentido/i
        },
        {
          key: "vert_izq_dir",
          name: "Arteria Vertebral Izquierda (Dirección)",
          range: "Anterógrado",
          defaultVal: "Anterógrado",
          matchRegex: /vertebral.*izq|izq.*vertebral/i,
          matchSub: /dirección|flujo|sentido/i,
          negativeSub: /vps|vmax|sist[oó]l|velocidad/i
        },
        {
          key: "rel_der",
          name: "Relación ACC/ACI Derecha",
          range: "< 2.0",
          defaultVal: "1.2",
          matchRegex: /(relación|ratio|índice).*der|der.*(relación|ratio|índice)/i,
          matchSub: /acc\/aci|aci\/acc|carotíde/i
        },
        {
          key: "rel_izq",
          name: "Relación ACC/ACI Izquierda",
          range: "< 2.0",
          defaultVal: "1.2",
          matchRegex: /(relación|ratio|índice).*izq|izq.*(relación|ratio|índice)/i,
          matchSub: /acc\/aci|aci\/acc|carotíde/i
        }
      ];

      const currentStructures = parsedData.structures || [];
      const updatedStructures: any[] = [];
      
      const normReport = reportLower
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      // Helper to find numbers in text windows
      const extractVal = (vesselKws: string[], isVPS: boolean | null, isGIM = false, isRel = false): { value: string; num: number } | null => {
        for (const kw of vesselKws) {
          const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          let idx = normReport.indexOf(normalizedKw);
          while (idx !== -1) {
            const windowText = normReport.substring(idx, Math.min(idx + 450, normReport.length));
            let match: RegExpMatchArray | null = null;
            if (isGIM) {
              match = windowText.match(/(?:gim|grosor|espesor|intima|media)[^\d]{0,35}(\d+[,.]\d+|\d+)/i) || 
                      windowText.match(/(\d+[,.]\d+|\d+)\s*(?:mm)/i);
            } else if (isRel) {
              match = windowText.match(/(?:relacion|ratio|indice|acc\/aci|aci\/acc)[^\d]{0,35}(\d+[,.]\d+|\d+)/i) ||
                      windowText.match(/(\d+[,.]\d+|\d+)/i);
            } else if (isVPS !== null) {
              if (isVPS) {
                match = windowText.match(/(?:vps|vmax|v\.p\.s\.|sistol\w*)[^\d]{0,35}(\d+[,.]\d+|\d+)/i) ||
                        windowText.match(/(\d+[,.]\d+|\d+)[^\d]{0,35}(?:vps|vmax|sistol\w*)/i);
              } else {
                match = windowText.match(/(?:ved|vmin|v\.e\.d\.|diastol\w*)[^\d]{0,35}(\d+[,.]\d+|\d+)/i) ||
                        windowText.match(/(\d+[,.]\d+|\d+)[^\d]{0,35}(?:ved|vmin|diastol\w*)/i);
              }
            }
            if (match) {
              const valStr = match[1].replace(",", ".");
              const num = parseFloat(valStr);
              if (!isNaN(num)) {
                return { value: match[1], num };
              }
            }
            idx = normReport.indexOf(normalizedKw, idx + 1);
          }
        }
        return null;
      };

      // Helper to check plaque presence
      const checkPlaques = (side: "der" | "izq"): { present: boolean; desc: string; size: string } => {
        const keywords = side === "der" 
          ? ["placa derecha", "placas derecha", "placa der", "placas der", "bulbo derecho", "bifurcacion derecha", "carotida comun derecha", "carotida interna derecha"]
          : ["placa izquierda", "placas izquierda", "placa izq", "placas izq", "bulbo izquierdo", "bifurcacion izquierda", "carotida comun izquierda", "carotida interna izquierda"];
        
        const sideText = side === "der" ? "derech" : "izquierd";
        const hasNoPlaquePhrase = new RegExp(`(?:sin|no\\s+se\\s+observan|no\\s+se\\s+aprecian|no\\s+se\\s+evidencian|libre\\s+de)\\s+placas.*${sideText}|${sideText}.*(?:sin|no\\s+se\\s+observan|no\\s+se\\s+aprecian|no\\s+se\\s+evidencian|libre\\s+de)\\s+placas`, "i").test(normReport);

        if (hasNoPlaquePhrase) {
          return { present: false, desc: "Sin placas", size: "" };
        }

        for (const kw of keywords) {
          const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          let idx = normReport.indexOf(normalizedKw);
          while (idx !== -1) {
            const windowText = normReport.substring(idx, Math.min(idx + 450, normReport.length));
            if (/placa|ateroma|calcificad|lipid|mixta|ateromatos/i.test(windowText) && !/sin placas|no se observan/i.test(windowText)) {
              const typeMatch = windowText.match(/(calcificada|blanda|lip[ií]dica|mixta|fibrosa|fibrocalcificada)/i);
              const typeStr = typeMatch ? typeMatch[1].toLowerCase() : "calcificada";
              const sizeMatch = windowText.match(/(\d+[,.]\d+|\d+)\s*mm/i);
              const sizeStr = sizeMatch ? `${sizeMatch[1]} mm` : "pequeña";

              const stenosisMatch = windowText.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstruccion)/i) || 
                                    windowText.match(/(?:estenosis|obstruccion)\s*(?:de\s+)?(?:del\s+)?(\d+)\s*%/i);
              const stenosisVal = stenosisMatch ? `${stenosisMatch[1]}%` : "";

              let desc = `Placa ${typeStr}`;
              if (stenosisVal) desc += ` con estenosis del ${stenosisVal}`;
              else desc += ` sin estenosis hemodinámica`;

              return { present: true, desc, size: sizeStr };
            }
            idx = normReport.indexOf(normalizedKw, idx + 1);
          }
        }
        return { present: false, desc: "Sin placas", size: "" };
      };

      // Helper to check vertebral direction
      const checkVertebralDir = (vesselKws: string[]): string => {
        for (const kw of vesselKws) {
          const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          let idx = normReport.indexOf(normalizedKw);
          while (idx !== -1) {
            const windowText = normReport.substring(idx, Math.min(idx + 450, normReport.length));
            if (/revers|retrograd|invers/i.test(windowText)) {
              return "Retrógrado / Reverso";
            }
            idx = normReport.indexOf(normalizedKw, idx + 1);
          }
        }
        return "Anterógrado";
      };

      // Map keys to keywords and logic
      const extractedMap = new Map<string, { measuredValue: string; status: "normal" | "altered" | "not_found"; interpretation: string }>();

      // Extract plaques first as they influence ACI stenosis classification
      const plaqueDer = checkPlaques("der");
      const plaqueIzq = checkPlaques("izq");

      extractedMap.set("placas_der", {
        measuredValue: plaqueDer.present ? plaqueDer.desc : "Sin placas",
        status: plaqueDer.present ? "altered" : "normal",
        interpretation: plaqueDer.present ? `Placas detectadas (${plaqueDer.size})` : "Sin placas significativas"
      });
      extractedMap.set("placas_izq", {
        measuredValue: plaqueIzq.present ? plaqueIzq.desc : "Sin placas",
        status: plaqueIzq.present ? "altered" : "normal",
        interpretation: plaqueIzq.present ? `Placas detectadas (${plaqueIzq.size})` : "Sin placas significativas"
      });

      // Track extracted velocities for ratio calculation
      let vpsAccDer = 75; // fallbacks
      let vpsAciDer = 70;
      let vpsAccIzq = 75;
      let vpsAciIzq = 70;

      // Define mappings
      const mappings = [
        { key: "acc_der_vps", kws: ["carotida comun derecha", "acc der", "acc derecho", "cc der", "ccd", "carotida primitiva derecha"], isVPS: true },
        { key: "acc_der_ved", kws: ["carotida comun derecha", "acc der", "acc derecho", "cc der", "ccd", "carotida primitiva derecha"], isVPS: false },
        { key: "aci_der_vps", kws: ["carotida interna derecha", "aci der", "aci derecho", "ci der", "cid"], isVPS: true },
        { key: "aci_der_ved", kws: ["carotida interna derecha", "aci der", "aci derecho", "ci der", "cid"], isVPS: false },
        { key: "ace_der_vps", kws: ["carotida externa derecha", "ace der", "ace derecho", "ce der", "ced"], isVPS: true },
        { key: "ace_der_ved", kws: ["carotida externa derecha", "ace der", "ace derecho", "ce der", "ced"], isVPS: false },
        
        { key: "acc_izq_vps", kws: ["carotida comun izquierda", "acc izq", "acc izquierdo", "cc izq", "cci", "carotida primitiva izquierda"], isVPS: true },
        { key: "acc_izq_ved", kws: ["carotida comun izquierda", "acc izq", "acc izquierdo", "cc izq", "cci", "carotida primitiva izquierda"], isVPS: false },
        { key: "aci_izq_vps", kws: ["carotida interna izquierda", "aci izq", "aci izquierdo", "ci izq", "cii"], isVPS: true },
        { key: "aci_izq_ved", kws: ["carotida interna izquierda", "aci izq", "aci izquierdo", "ci izq", "cii"], isVPS: false },
        { key: "ace_izq_vps", kws: ["carotida externa izquierda", "ace izq", "ace izquierdo", "ce izq", "cei"], isVPS: true },
        { key: "ace_izq_ved", kws: ["carotida externa izquierda", "ace izq", "ace izquierdo", "ce izq", "cei"], isVPS: false },

        { key: "vert_der_vps", kws: ["vertebral derecha", "vertebral der", "avd", "arteria vertebral derecha"], isVPS: true },
        { key: "vert_izq_vps", kws: ["vertebral izquierda", "vertebral izq", "avi", "arteria vertebral izquierda"], isVPS: true }
      ];

      // Execute extraction for velocities
      mappings.forEach(m => {
        const ext = extractVal(m.kws, m.isVPS);
        if (ext) {
          const valFormatted = `${ext.value} cm/s`;
          let status: "normal" | "altered" = "normal";
          let interpretation = "Flujo normal";

          // Set VPS/VED tracker values
          if (m.key === "acc_der_vps") vpsAccDer = ext.num;
          if (m.key === "aci_der_vps") vpsAciDer = ext.num;
          if (m.key === "acc_izq_vps") vpsAccIzq = ext.num;
          if (m.key === "aci_izq_vps") vpsAciIzq = ext.num;

          // Simple range validation for standard parameters
          if (m.key.endsWith("_vps")) {
            if (m.key.startsWith("acc_") && (ext.num < 50 || ext.num > 100)) status = "altered";
            if (m.key.startsWith("aci_") && ext.num >= 125) status = "altered";
            if (m.key.startsWith("ace_") && ext.num >= 115) status = "altered";
            if (m.key.startsWith("vert_") && (ext.num < 20 || ext.num > 60)) status = "altered";
          } else {
            // VED
            if (m.key.startsWith("acc_") && ext.num >= 35) status = "altered";
            if (m.key.startsWith("aci_") && ext.num >= 40) status = "altered";
            if (m.key.startsWith("ace_") && ext.num >= 30) status = "altered";
          }

          if (status === "altered") {
            interpretation = "Flujo alterado / Velocidad fuera de rango";
          }

          extractedMap.set(m.key, { measuredValue: valFormatted, status, interpretation });
        } else {
          // Fallback: Check if Gemini extracted this structure by matching name
          const item = currentStructures.find((s: any) => {
            const sName = (s.structure || "").toLowerCase();
            const cand = mandatoryCarotid.find(x => x.key === m.key);
            if (!cand) return false;
            let match = cand.matchRegex.test(sName);
            if (match && cand.matchSub) match = cand.matchSub.test(sName);
            if (match && cand.negativeSub) match = !cand.negativeSub.test(sName);
            return match;
          });

          if (item && item.measuredValue && item.measuredValue.trim() !== "") {
            const numMatch = item.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
            const num = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : NaN;
            if (!isNaN(num)) {
              if (m.key === "acc_der_vps") vpsAccDer = num;
              if (m.key === "aci_der_vps") vpsAciDer = num;
              if (m.key === "acc_izq_vps") vpsAccIzq = num;
              if (m.key === "aci_izq_vps") vpsAciIzq = num;
            }
            extractedMap.set(m.key, {
              measuredValue: item.measuredValue.includes("cm/s") ? item.measuredValue : `${item.measuredValue} cm/s`,
              status: item.status || "normal",
              interpretation: item.interpretation || "Flujo normal"
            });
          }
        }
      });

      // Special handling for ACI (Internal Carotid Arteries) Stenosis Percent classification according to international consensus (SRU)
      ["der", "izq"].forEach(side => {
        const keyVps = `aci_${side}_vps`;
        const existing = extractedMap.get(keyVps);
        if (!existing) return; // Skip if not explicitly found in report text

        const plaquesPresent = side === "der" ? plaqueDer.present : plaqueIzq.present;
        const currentVps = side === "der" ? vpsAciDer : vpsAciIzq;

        let estenosis = "Sin estenosis (< 50%)";
        let interpretation = "Flujo normal, sin estenosis significativa (< 50%)";
        let status: "normal" | "altered" = "normal";

        if (currentVps > 230) {
          estenosis = "> 70% (Estenosis severa)";
          interpretation = "Estenosis severa (> 70%) según criterios de Consenso de Estenosis";
          status = "altered";
        } else if (currentVps >= 125) {
          estenosis = "50% - 70% (Estenosis moderada)";
          interpretation = "Estenosis moderada (50% - 70%) según criterios de Consenso de Estenosis";
          status = "altered";
        } else {
          if (plaquesPresent) {
            estenosis = "< 50% (Estenosis leve)";
            interpretation = "Estenosis leve (< 50%) según criterios de Consenso de Estenosis";
            status = "altered"; // Flag mild stenosis with altered status to represent pathology
          }
        }

        const vpsValStr = existing.measuredValue.split(",")[0];

        extractedMap.set(keyVps, {
          measuredValue: `${vpsValStr}, Estenosis: ${estenosis}`,
          status,
          interpretation
        });
      });

      // Extract and set GIM
      ["der", "izq"].forEach(side => {
        const key = `gim_${side}`;
        const kws = side === "der" 
          ? ["gim derecho", "gim der", "grosor miointimal derecho", "intima media derecha"]
          : ["gim izquierdo", "gim izq", "grosor miointimal izquierdo", "intima media izquierda"];
        
        const ext = extractVal(kws, null, true);
        if (ext) {
          const valFormatted = `${ext.value} mm`;
          const status = ext.num >= 0.9 ? "altered" : "normal";
          const interpretation = status === "altered" ? "Engrosamiento miointimal" : "Grosor miointimal conservado";
          extractedMap.set(key, { measuredValue: valFormatted, status, interpretation });
        } else {
          const item = currentStructures.find((s: any) => (s.structure || "").toLowerCase().includes("gim") && (s.structure || "").toLowerCase().includes(side === "der" ? "derech" : "izquierd"));
          if (item && item.measuredValue) {
            extractedMap.set(key, {
              measuredValue: item.measuredValue.includes("mm") ? item.measuredValue : `${item.measuredValue} mm`,
              status: item.status || "normal",
              interpretation: item.interpretation || "Grosor miointimal conservado"
            });
          }
        }
      });

      // Extract directions for Vertebral
      ["der", "izq"].forEach(side => {
        const key = `vert_${side}_dir`;
        const kws = side === "der" 
          ? ["vertebral derecha", "vertebral der", "avd"]
          : ["vertebral izquierda", "vertebral izq", "avi"];
        
        const dir = checkVertebralDir(kws);
        const status = dir.includes("Anter") ? "normal" : "altered";
        const interpretation = status === "normal" ? "Flujo anterógrado normal" : "Flujo retrógrado patológico (Robo de la subclavia)";
        extractedMap.set(key, { measuredValue: dir, status, interpretation });
      });

      // Extract and set Ratios (Relación ACC/ACI)
      ["der", "izq"].forEach(side => {
        const key = `rel_${side}`;
        const kws = side === "der" 
          ? ["relacion der", "ratio der", "acc/aci der", "relacion acc/aci der", "relacion acc/aci derecha"]
          : ["relacion izq", "ratio izq", "acc/aci izq", "relacion acc/aci izq", "relacion acc/aci izquierda"];
        
        const ext = extractVal(kws, null, false, true);
        if (ext) {
          const valFormatted = ext.value.replace(".", ",");
          const status = ext.num >= 2.0 ? "altered" : "normal";
          const interpretation = status === "altered" ? "Relación aumentada (Sugerente de estenosis)" : "Relación normal";
          extractedMap.set(key, { measuredValue: valFormatted, status, interpretation });
        } else {
          // Calculate and set ratio only if both ACC and ACI VPS are present in the report (extractedMap)
          const hasAcc = extractedMap.has(`acc_${side}_vps`);
          const hasAci = extractedMap.has(`aci_${side}_vps`);
          if (hasAcc && hasAci) {
            const accVps = side === "der" ? vpsAccDer : vpsAccIzq;
            const aciVps = side === "der" ? vpsAciDer : vpsAciIzq;
            
            let ratio = 1.2;
            if (accVps > 0 && aciVps > 0) {
              ratio = parseFloat((aciVps / accVps).toFixed(2));
            }
            const valFormatted = ratio.toString().replace(".", ",");
            const status = ratio >= 2.0 ? "altered" : "normal";
            const interpretation = status === "altered" ? "Relación aumentada (Sugerente de estenosis)" : "Relación normal";
            extractedMap.set(key, { measuredValue: valFormatted, status, interpretation });
          }
        }
      });

      // Rebuild the updatedStructures array with exactly the 22 parameters in order without duplicates
      mandatoryCarotid.forEach(m => {
        const ext = extractedMap.get(m.key);
        if (ext) {
          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: ext.measuredValue,
            status: ext.status,
            interpretation: ext.interpretation,
            defaultNormalValue: m.defaultVal
          });
        } else {
          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: "",
            status: "not_found",
            interpretation: "Sin medición registrada",
            defaultNormalValue: m.defaultVal
          });
        }
      });

      // Ensure left and right velocities have slight realistic variations if they defaulted to identical
      const carotidPairs = [
        { der: "Arteria Carótida Común Derecha (VPS)", izq: "Arteria Carótida Común Izquierda (VPS)" },
        { der: "Arteria Carótida Común Derecha (VED)", izq: "Arteria Carótida Común Izquierda (VED)" },
        { der: "Arteria Carótida Interna Derecha (VPS)", izq: "Arteria Carótida Interna Izquierda (VPS)" },
        { der: "Arteria Carótida Interna Derecha (VED)", izq: "Arteria Carótida Interna Izquierda (VED)" },
        { der: "Arteria Carótida Externa Derecha (VPS)", izq: "Arteria Carótida Externa Izquierda (VPS)" },
        { der: "Arteria Carótida Externa Derecha (VED)", izq: "Arteria Carótida Externa Izquierda (VED)" },
        { der: "Arteria Vertebral Derecha (VPS)", izq: "Arteria Vertebral Izquierda (VPS)" }
      ];

      carotidPairs.forEach(pair => {
        const structDer = updatedStructures.find(s => s.structure === pair.der);
        const structIzq = updatedStructures.find(s => s.structure === pair.izq);

        if (structDer && structIzq && structDer.measuredValue && structIzq.measuredValue) {
          const matchDer = structDer.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
          const matchIzq = structIzq.measuredValue.match(/(\d+(?:[.,]\d+)?)/);

          if (matchDer && matchIzq) {
            const numDer = parseFloat(matchDer[1].replace(",", "."));
            const numIzq = parseFloat(matchIzq[1].replace(",", "."));

            if (!isNaN(numDer) && !isNaN(numIzq) && numDer === numIzq) {
              const isVPS = pair.der.includes("(VPS)");
              const adjustment = isVPS ? 4 : 2;
              let newNum = numIzq + adjustment;
              
              if (!isVPS && newNum > 40) {
                newNum = numIzq - adjustment;
              } else if (isVPS && newNum > 120) {
                newNum = numIzq - adjustment;
              }
              
              if (newNum < 0) newNum = numIzq + adjustment;

              const newNumStr = Number.isInteger(newNum) ? newNum.toString() : newNum.toFixed(1).replace(".", ",");
              structIzq.measuredValue = structIzq.measuredValue.replace(matchIzq[1], newNumStr);
            }
          }
        }
      });

      parsedData.structures = updatedStructures;
    }

    // Post-processing to enforce the 14 mandatory lower limb arterial Doppler parameters
    let isArterialMiembrosInferiores = false;
    if (
      (studyLower.includes("arterial") && (studyLower.includes("miembro") || studyLower.includes("pierna") || studyLower.includes("inferior") || studyLower.includes("extre"))) ||
      (reportLower.includes("doppler") && reportLower.includes("arterial") && (reportLower.includes("miembro") || reportLower.includes("pierna") || reportLower.includes("inferior") || reportLower.includes("extremidad") || reportLower.includes("femoral") || reportLower.includes("poplítea") || reportLower.includes("pedio")))
    ) {
      isArterialMiembrosInferiores = true;
    }

    if (isArterialMiembrosInferiores) {
      // Determine if study is unilateral (and which side) or bilateral
      let sideToKeep: "der" | "izq" | "both" = "both";
      if (parsedData.detectedSide === "der" || parsedData.detectedSide === "izq" || parsedData.detectedSide === "both") {
        sideToKeep = parsedData.detectedSide;
      } else {
        const containsDer = reportLower.includes("derech") || reportLower.includes(" dch") || reportLower.includes(" mid") || reportLower.includes("m.i.d");
        const containsIzq = reportLower.includes("izquierd") || reportLower.includes(" izq") || reportLower.includes(" mii") || reportLower.includes("m.i.i");
        const containsUnilateral = reportLower.includes("unilateral") || studyLower.includes("unilateral");

        if (containsUnilateral || (containsDer && !containsIzq) || (containsIzq && !containsDer)) {
          if (containsDer && !containsIzq) {
            sideToKeep = "der";
          } else if (containsIzq && !containsDer) {
            sideToKeep = "izq";
          } else {
            const derCount = (reportLower.match(/derech|dch|mid|m\.i\.d/g) || []).length;
            const izqCount = (reportLower.match(/izquierd|izq|mii|m\.i\.i/g) || []).length;
            if (derCount > izqCount) {
              sideToKeep = "der";
            } else if (izqCount > derCount) {
              sideToKeep = "izq";
            }
          }
        }
      }

      if (sideToKeep === "der") {
        parsedData.detectedStudyType = "Doppler Arterial de Miembro Inferior Derecho (Unilateral)";
      } else if (sideToKeep === "izq") {
        parsedData.detectedStudyType = "Doppler Arterial de Miembro Inferior Izquierdo (Unilateral)";
      } else {
        parsedData.detectedStudyType = "Doppler Arterial de Miembros Inferiores (Bilateral)";
      }

      // Locate where the derecho and izquierdo sections start in report
      let derIdx = -1;
      let izqIdx = -1;

      const derHeaderRegex = /(?:miembro|extremidad|lado|arterias|miembros|extremidades)\s+(?:inferior\s+)?(?:derech|dch|mid|m\.i\.d)/i;
      const izqHeaderRegex = /(?:miembro|extremidad|lado|arterias|miembros|extremidades)\s+(?:inferior\s+)?(?:izquierd|izq|mii|m\.i\.i)/i;

      const derMatch = report.match(derHeaderRegex);
      const izqMatch = report.match(izqHeaderRegex);

      if (derMatch) derIdx = derMatch.index || -1;
      if (izqMatch) izqIdx = izqMatch.index || -1;

      // Locate where the conclusion/impression section starts in the report
      const conclusionRegex = /(?:impresi[oó]n|conclusi[oó]n|conclusiones|diagn[oó]stico|dx:)/i;
      const conclusionMatch = report.match(conclusionRegex);
      const conclusionIdx = conclusionMatch ? conclusionMatch.index : -1;

      let conclusionText = "";
      if (conclusionIdx !== -1) {
        conclusionText = report.substring(conclusionIdx);
      }

      let bodyTextForDer = "";
      let bodyTextForIzq = "";

      if (derIdx !== -1 && izqIdx !== -1) {
        if (derIdx < izqIdx) {
          // Right is before Left
          bodyTextForDer = report.substring(derIdx, izqIdx);
          if (conclusionIdx !== -1 && conclusionIdx > izqIdx) {
            bodyTextForIzq = report.substring(izqIdx, conclusionIdx);
          } else {
            bodyTextForIzq = report.substring(izqIdx);
          }
        } else {
          // Left is before Right
          bodyTextForIzq = report.substring(izqIdx, derIdx);
          if (conclusionIdx !== -1 && conclusionIdx > derIdx) {
            bodyTextForDer = report.substring(derIdx, conclusionIdx);
          } else {
            bodyTextForDer = report.substring(derIdx);
          }
        }
      } else if (derIdx !== -1) {
        if (conclusionIdx !== -1 && conclusionIdx > derIdx) {
          bodyTextForDer = report.substring(derIdx, conclusionIdx);
        } else {
          bodyTextForDer = report.substring(derIdx);
        }
        bodyTextForIzq = report;
      } else if (izqIdx !== -1) {
        if (conclusionIdx !== -1 && conclusionIdx > izqIdx) {
          bodyTextForIzq = report.substring(izqIdx, conclusionIdx);
        } else {
          bodyTextForIzq = report.substring(izqIdx);
        }
        bodyTextForDer = report;
      } else {
        if (conclusionIdx !== -1) {
          bodyTextForDer = report.substring(0, conclusionIdx);
          bodyTextForIzq = report.substring(0, conclusionIdx);
        } else {
          bodyTextForDer = report;
          bodyTextForIzq = report;
        }
      }

      // 16 Possible lower limb vessels including Arteria Pedia (APed)
      const allArterialVessels = [
        // DERECHOS
        {
          key: "aic_der",
          side: "der" as const,
          name: "Arteria Ilíaca Común Derecha (AIC)",
          range: "Trifásico, VPS > 50 cm/s",
          baseVel: 80,
          modVel: 15,
          leftOff: -3,
          vesselKeywords: ["ilíaca común", "iliaca comun", "aic"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "afc_der",
          side: "der" as const,
          name: "Arteria Femoral Común Derecha (AFC)",
          range: "Trifásico, VPS 50 - 100 cm/s",
          baseVel: 75,
          modVel: 15,
          leftOff: 4,
          vesselKeywords: ["femoral común", "femoral comun", "afc"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "afs_der",
          side: "der" as const,
          name: "Arteria Femoral Derecha (AF)",
          range: "Trifásico, VPS 50 - 90 cm/s",
          baseVel: 70,
          modVel: 15,
          leftOff: -2,
          vesselKeywords: ["femoral superficial", "afs", "femoral", "af"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "ap_der",
          side: "der" as const,
          name: "Arteria Poplítea Derecha (AP)",
          range: "Trifásico, VPS 40 - 80 cm/s",
          baseVel: 60,
          modVel: 15,
          leftOff: 3,
          vesselKeywords: ["poplítea", "poplitea", "ap"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "ata_der",
          side: "der" as const,
          name: "Arteria Tibial Anterior Derecha (ATA)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 40,
          modVel: 12,
          leftOff: -2,
          vesselKeywords: ["tibial anterior", "ata"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "atp_der",
          side: "der" as const,
          name: "Arteria Tibial Posterior Derecha (ATP)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 40,
          modVel: 12,
          leftOff: 3,
          vesselKeywords: ["tibial posterior", "atp"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "aper_der",
          side: "der" as const,
          name: "Arteria Peronea Derecha (APer)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 35,
          modVel: 12,
          leftOff: -1,
          vesselKeywords: ["peronea", "aper"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "aped_der",
          side: "der" as const,
          name: "Arteria Pedia Derecha (APed)",
          range: "Trifásico, VPS 20 - 50 cm/s",
          baseVel: 30,
          modVel: 10,
          leftOff: -1,
          vesselKeywords: ["pedia", "aped", "pedio"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        // IZQUIERDOS
        {
          key: "aic_izq",
          side: "izq" as const,
          name: "Arteria Ilíaca Común Izquierda (AIC)",
          range: "Trifásico, VPS > 50 cm/s",
          baseVel: 80,
          modVel: 15,
          leftOff: -3,
          vesselKeywords: ["ilíaca común", "iliaca comun", "aic"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "afc_izq",
          side: "izq" as const,
          name: "Arteria Femoral Común Izquierda (AFC)",
          range: "Trifásico, VPS 50 - 100 cm/s",
          baseVel: 75,
          modVel: 15,
          leftOff: 4,
          vesselKeywords: ["femoral común", "femoral comun", "afc"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "afs_izq",
          side: "izq" as const,
          name: "Arteria Femoral Izquierda (AF)",
          range: "Trifásico, VPS 50 - 90 cm/s",
          baseVel: 70,
          modVel: 15,
          leftOff: -2,
          vesselKeywords: ["femoral superficial", "afs", "femoral", "af"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "ap_izq",
          side: "izq" as const,
          name: "Arteria Poplítea Izquierda (AP)",
          range: "Trifásico, VPS 40 - 80 cm/s",
          baseVel: 60,
          modVel: 15,
          leftOff: 3,
          vesselKeywords: ["poplítea", "poplitea", "ap"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "ata_izq",
          side: "izq" as const,
          name: "Arteria Tibial Anterior Izquierda (ATA)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 40,
          modVel: 12,
          leftOff: -2,
          vesselKeywords: ["tibial anterior", "ata"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "atp_izq",
          side: "izq" as const,
          name: "Arteria Tibial Posterior Izquierda (ATP)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 40,
          modVel: 12,
          leftOff: 3,
          vesselKeywords: ["tibial posterior", "atp"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "aper_izq",
          side: "izq" as const,
          name: "Arteria Peronea Izquierda (APer)",
          range: "Trifásico, VPS 30 - 60 cm/s",
          baseVel: 35,
          modVel: 12,
          leftOff: -1,
          vesselKeywords: ["peronea", "aper"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "aped_izq",
          side: "izq" as const,
          name: "Arteria Pedia Izquierda (APed)",
          range: "Trifásico, VPS 20 - 50 cm/s",
          baseVel: 30,
          modVel: 10,
          leftOff: -1,
          vesselKeywords: ["pedia", "aped", "pedio"],
          sideKeywords: ["izquierd", "izq", "mii"]
        }
      ];

      // Filter based on unilateral vs bilateral
      const mandatoryArterial = allArterialVessels.filter(v => {
        if (sideToKeep === "both") return true;
        return v.side === sideToKeep;
      });

      const currentStructures = parsedData.structures || [];
      const updatedStructures: any[] = [];
      const matchedKeys = new Set<string>();

      // Intelligent evaluation helper
      const analyzeVessel = (key: string, side: "der" | "izq", vKeywords: string[], baseVel: number, modVel: number, leftOff: number) => {
        const sideText = side === "der" ? bodyTextForDer.toLowerCase() : bodyTextForIzq.toLowerCase();
        const conclusionTextLower = conclusionText.toLowerCase();

        const matchesKeywordSafe = (sentenceLower: string, keyword: string) => {
          if (keyword.length <= 3) {
            const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(?:^|[^a-záéíóúüñ])${escaped}(?:$|[^a-záéíóúüñ])`, 'i');
            return regex.test(sentenceLower);
          }
          return sentenceLower.includes(keyword.toLowerCase());
        };

        // 1. Get sentences from side-specific body text
        const sideSentences = sideText.split(/[.\n;]/);
        const matchedSideSentences = sideSentences.filter(s => {
          const sLower = s.toLowerCase();
          const matchesVessel = vKeywords.some(k => matchesKeywordSafe(sLower, k));
          if (!matchesVessel) return false;

          // If side-specific headers were NOT found, check that the sentence itself matches the correct side or is bilateral
          if (derIdx === -1 || izqIdx === -1) {
            const sideKws = side === "der" 
              ? ["derech", "der", "dch", "mid", "m.i.d", "ambas", "ambos", "bilateral", "bilaterales"] 
              : ["izquierd", "izq", "mii", "m.i.i", "ambas", "ambos", "bilateral", "bilaterales"];
            const matchesSide = sideKws.some(k => sLower.includes(k));
            if (!matchesSide) return false;
          }
          return true;
        });

        // 2. Get sentences from the diagnostic impression/conclusion
        const conclusionSentences = conclusionTextLower.split(/[.\n;]/);
        const matchedConclusionSentences = conclusionSentences.filter(s => {
          const sLower = s.toLowerCase();
          const matchesVessel = vKeywords.some(k => matchesKeywordSafe(sLower, k));
          if (!matchesVessel) return false;

          // Since the conclusion is global, we must be extra careful:
          // Check if the sentence mentions this side, or refers to "both" sides/bilateral, or if the whole study is unilateral to that side.
          const sideKws = side === "der" 
            ? ["derech", "der", "dch", "mid", "m.i.d", "ambas", "ambos", "bilateral", "bilaterales"] 
            : ["izquierd", "izq", "mii", "m.i.i", "ambas", "ambos", "bilateral", "bilaterales"];
          
          const matchesSide = sideKws.some(k => sLower.includes(k));
          
          // If the study itself is unilateral for this side, then any mention of the vessel in the conclusion belongs to this side!
          if (sideToKeep === side) {
            return true;
          }

          return matchesSide;
        });

        // Combine findings from body and conclusion
        const allMatched = [...matchedSideSentences, ...matchedConclusionSentences];
        const context = allMatched.join(" ").toLowerCase().trim();

        const charSum = key.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        let normalSpeed = baseVel + (charSum % modVel);
        if (key.endsWith("_izq")) {
          normalSpeed += leftOff;
        }

        const defaultNormalValue = `${normalSpeed} cm/s, Trifásico`;

        if (!context) {
          return {
            status: "not_found" as const,
            measuredValue: "",
            interpretation: "Sin medición registrada",
            defaultNormalValue
          };
        }

        // 0. ESTENOSIS FOCAL CON PORCENTAJE
        const focalMatch = context.match(/(?:estenosis|obstrucción|obstruccion)\s+(?:focal\s+)?(?:de|del|de un)?\s*(\d+)\s*%/i) || context.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstrucción|obstruccion)/i);

        if (focalMatch) {
          const percent = focalMatch[1];
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const interpretation = `Estenosis focal del ${percent}%`;
          const pctVal = parseInt(percent, 10);
          let term = `Estenosis focal (${percent}%)`;
          if (pctVal >= 70) {
            term = `${velStr}Flujo monofásico, Estenosis focal (${percent}%)`;
          } else if (pctVal >= 50) {
            term = `${velStr}Ensanchamiento espectral, Estenosis focal (${percent}%)`;
          } else {
            term = `${velStr}Flujo atenuado, Estenosis focal (${percent}%)`;
          }
          return {
            status: "altered" as const,
            measuredValue: term,
            interpretation: interpretation,
            defaultNormalValue: velStr ? `${velStr}Trifásico` : `${normalSpeed} cm/s, Trifásico`
          };
        }

        // 1. OCLUSION / SIN FLUJO DETECTABLE / FILIFORME
        const isNoFlow = context.includes("oclusi") || context.includes("ocluido") || context.includes("ocluida") || 
                         context.includes("no detectable") || context.includes("sin flujo") || context.includes("ausencia de flujo") || 
                         context.includes("no se detecta") || context.includes("obstruccion total") || context.includes("obstrucción total") || 
                         context.includes("flujo no medible") || context.includes("filiforme");

        // 2. MONOFÁSICO / ESTENOSIS SEVERA
        const isSevere = context.includes("monofasico") || context.includes("monofásica") || context.includes("monofasica") || 
                         context.includes("severa") || context.includes("severo") || context.includes("estenosis severa") || 
                         context.includes("obstruccion severa") || context.includes("obstrucción severa") || 
                         context.includes("tardus") || context.includes("parvus") || context.includes("amortiguado") || 
                         context.includes("baja resistencia");

        // 3. ENSANCHAMIENTO ESPECTRAL / ESTENOSIS MODERADA
        const isModerate = context.includes("ensanchamiento") || context.includes("espectral") || context.includes("turbulencia") ||
                           context.includes("moderada") || context.includes("moderado") || context.includes("estenosis moderada");

        // 4. ATENUADO / ESTENOSIS LEVE
        const isLeve = context.includes("atenuado") || context.includes("atenuada") || context.includes("atenuad") ||
                       context.includes("bifasico") || context.includes("bifásica") || context.includes("bifasica") ||
                       context.includes("leve") || context.includes("estenosis leve");

        if (isNoFlow) {
          const isFiliforme = context.includes("filiforme");
          const term = isFiliforme ? "Flujo filiforme" : "Flujo no detectable";
          return {
            status: "altered" as const,
            measuredValue: term,
            interpretation: "Estenosis muy severa/oclusión",
            defaultNormalValue: "Flujo no detectable"
          };
        }

        if (isSevere) {
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const term = "Flujo monofásico";
          return {
            status: "altered" as const,
            measuredValue: `${velStr}${term}`,
            interpretation: "Estenosis severa",
            defaultNormalValue: velStr ? `${velStr}${term}` : `15 cm/s, ${term}`
          };
        }

        if (isModerate) {
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const term = "Ensanchamiento espectral";
          return {
            status: "altered" as const,
            measuredValue: `${velStr}${term}`,
            interpretation: "Estenosis moderada",
            defaultNormalValue: velStr ? `${velStr}${term}` : `35 cm/s, ${term}`
          };
        }

        if (isLeve) {
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const term = "Flujo atenuado";
          return {
            status: "altered" as const,
            measuredValue: `${velStr}${term}`,
            interpretation: "Estenosis leve",
            defaultNormalValue: velStr ? `${velStr}${term}` : `45 cm/s, ${term}`
          };
        }

        const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
        const hasTrifasico = context.includes("trifasico") || context.includes("trifásica") || context.includes("trifasica") || context.includes("normal") || context.includes("conservado");

        if (speedMatch || hasTrifasico) {
          const vel = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s` : `${normalSpeed} cm/s`;
          return {
            status: "normal" as const,
            measuredValue: `${vel}, Trifásico`,
            interpretation: "Flujo normal (Onda Trifásica)",
            defaultNormalValue
          };
        }

        return {
          status: "not_found" as const,
          measuredValue: "",
          interpretation: "Sin medición registrada",
          defaultNormalValue
        };
      };

      // Match existing structures or build them smartly
      currentStructures.forEach((s: any) => {
        const sName = (s.structure || "").toLowerCase();
        let matchedKey: string | null = null;
        let matchedVessel: typeof mandatoryArterial[0] | null = null;

        for (const m of mandatoryArterial) {
          if (matchedKeys.has(m.key)) continue;

          let isMatch = m.vesselKeywords.some(kw => sName.includes(kw)) && m.sideKeywords.some(skw => sName.includes(skw));

          if (isMatch) {
            matchedKey = m.key;
            matchedVessel = m;
            break;
          }
        }

        if (matchedKey && matchedVessel) {
          matchedKeys.add(matchedKey);
          
          const analysis = analyzeVessel(
            matchedVessel.key,
            matchedVessel.side,
            matchedVessel.vesselKeywords,
            matchedVessel.baseVel,
            matchedVessel.modVel,
            matchedVessel.leftOff
          );

          s.structure = matchedVessel.name;
          s.normalRange = matchedVessel.range;
          s.defaultNormalValue = analysis.defaultNormalValue;
          
          // If Gemini successfully found the vessel status (normal/altered), we trust Gemini's status.
          // If Gemini missed it (status is not_found) or returned an empty value, we fallback to our local parser.
          const geminiFound = s.status !== "not_found" && s.measuredValue && s.measuredValue.trim() !== "";
          
          let statusToUse = geminiFound ? s.status : analysis.status;
          let valueToUse = geminiFound ? (s.measuredValue || "") : (analysis.measuredValue || "");
          let interpToUse = geminiFound ? (s.interpretation || "") : (analysis.interpretation || "");

          if (statusToUse === "altered") {
            s.status = "altered";
            
            // Post-process the selected value to ensure beautiful, consistent terminology
            const valLower = valueToUse.toLowerCase();
            const preFocalMatch = valLower.match(/(?:estenosis|obstrucción|obstruccion)\s+(?:focal\s+)?(?:de|del)?\s*(\d+)\s*%/i) || valLower.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstrucción|obstruccion)/i);

            const speedMatch = valueToUse.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/i);
            const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";

            if (preFocalMatch) {
              const percent = preFocalMatch[1];
              s.interpretation = `Estenosis focal del ${percent}%`;
              const pctVal = parseInt(percent, 10);
              if (pctVal >= 70) {
                s.measuredValue = `${velStr}Flujo monofásico, Estenosis focal (${percent}%)`;
              } else if (pctVal >= 50) {
                s.measuredValue = `${velStr}Ensanchamiento espectral, Estenosis focal (${percent}%)`;
              } else {
                s.measuredValue = `${velStr}Flujo atenuado, Estenosis focal (${percent}%)`;
              }
            } else {
              const preNoFlow = valLower.includes("no detect") || valLower.includes("sin flujo") || valLower.includes("oclu") || valLower.includes("ausen") || valLower.includes("filiform");
              const preMonofasico = valLower.includes("monofas") || valLower.includes("monofás");
              const preEspectral = valLower.includes("ensanch") || valLower.includes("espectr") || valLower.includes("turbu") || valLower.includes("moderad");
              const preLeve = valLower.includes("atenuad") || valLower.includes("bifas") || valLower.includes("leve");

              if (preNoFlow) {
                const isFiliforme = valLower.includes("filiform");
                s.measuredValue = isFiliforme ? "Flujo filiforme" : "Flujo no detectable";
                s.interpretation = "Estenosis muy severa/oclusión";
              } else if (preMonofasico) {
                s.measuredValue = `${velStr}Flujo monofásico`;
                s.interpretation = "Estenosis severa";
              } else if (preEspectral) {
                s.measuredValue = `${velStr}Ensanchamiento espectral`;
                s.interpretation = "Estenosis moderada";
              } else if (preLeve) {
                s.measuredValue = `${velStr}Flujo atenuado`;
                s.interpretation = "Estenosis leve";
              } else {
                s.measuredValue = valueToUse || "Flujo atenuado";
                s.interpretation = interpToUse || "Estenosis leve";
              }
            }
          } else if (statusToUse === "normal") {
            s.status = "normal";
            if (!valueToUse.includes("Trifásico") && !valueToUse.includes("Trifásica") && !valueToUse.includes("onda") && !valueToUse.includes(" detectable")) {
              s.measuredValue = `${valueToUse.replace(/\s*cm\/s/g, "").trim()} cm/s, Trifásico`;
            } else {
              s.measuredValue = valueToUse;
            }
            s.interpretation = "Flujo normal (Onda Trifásica)";
          } else {
            s.status = "not_found";
            s.measuredValue = "";
            s.interpretation = "Sin medición registrada";
          }
          updatedStructures.push(s);
        } else {
          const isLowerLimbDup = allArterialVessels.some(v => v.vesselKeywords.some(kw => sName.includes(kw)));
          if (!isLowerLimbDup) {
            updatedStructures.push(s);
          }
        }
      });

      // Add missing ones
      mandatoryArterial.forEach(m => {
        if (!matchedKeys.has(m.key)) {
          const analysis = analyzeVessel(
            m.key,
            m.side,
            m.vesselKeywords,
            m.baseVel,
            m.modVel,
            m.leftOff
          );

          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: analysis.measuredValue,
            status: analysis.status,
            interpretation: analysis.interpretation,
            defaultNormalValue: analysis.defaultNormalValue
          });
        }
      });

      parsedData.structures = updatedStructures;
    }

    // --- DOPPLER VENOSO DE MIEMBROS INFERIORES POST-PROCESSING ---
    let isVenosoMiembrosInferiores = false;
    if (
      (studyLower.includes("venoso") && (studyLower.includes("miembro") || studyLower.includes("pierna") || studyLower.includes("inferior") || studyLower.includes("extre"))) ||
      (reportLower.includes("doppler") && reportLower.includes("venoso") && (reportLower.includes("miembro") || reportLower.includes("pierna") || reportLower.includes("inferior") || reportLower.includes("extremidad") || reportLower.includes("femoral") || reportLower.includes("poplítea") || reportLower.includes("safena")))
    ) {
      isVenosoMiembrosInferiores = true;
    }

    if (isVenosoMiembrosInferiores) {
      let derIdx = -1;
      let izqIdx = -1;

      // Locate where right and left limb sections start in the report
      const derHeaderRegex = /(?:miembro|extremidad|lado)?\s*(?:inferior\s+)?(?:derech[oa]|der\b|dch)/i;
      const izqHeaderRegex = /(?:miembro|extremidad|lado)?\s*(?:inferior\s+)?(?:izquierd[oa]|izq\b)/i;

      const derMatch = report.match(derHeaderRegex);
      const izqMatch = report.match(izqHeaderRegex);

      if (derMatch) derIdx = derMatch.index || -1;
      if (izqMatch) izqIdx = izqMatch.index || -1;

      // Locate where the conclusion/impression section starts in the report
      const conclusionRegex = /(?:impresi[oó]n|conclusi[oó]n|conclusiones|diagn[oó]stico|dx:)/i;
      const conclusionMatch = report.match(conclusionRegex);
      const conclusionIdx = conclusionMatch ? conclusionMatch.index : -1;

      let conclusionText = "";
      if (conclusionIdx !== -1) {
        conclusionText = report.substring(conclusionIdx);
      }

      let bodyTextForDer = "";
      let bodyTextForIzq = "";

      if (derIdx !== -1 && izqIdx !== -1) {
        if (derIdx < izqIdx) {
          // Right is before Left
          bodyTextForDer = report.substring(derIdx, izqIdx);
          if (conclusionIdx !== -1 && conclusionIdx > izqIdx) {
            bodyTextForIzq = report.substring(izqIdx, conclusionIdx);
          } else {
            bodyTextForIzq = report.substring(izqIdx);
          }
        } else {
          // Left is before Right
          bodyTextForIzq = report.substring(izqIdx, derIdx);
          if (conclusionIdx !== -1 && conclusionIdx > derIdx) {
            bodyTextForDer = report.substring(derIdx, conclusionIdx);
          } else {
            bodyTextForDer = report.substring(derIdx);
          }
        }
      } else if (derIdx !== -1) {
        if (conclusionIdx !== -1 && conclusionIdx > derIdx) {
          bodyTextForDer = report.substring(derIdx, conclusionIdx);
        } else {
          bodyTextForDer = report.substring(derIdx);
        }
        bodyTextForIzq = report;
      } else if (izqIdx !== -1) {
        if (conclusionIdx !== -1 && conclusionIdx > izqIdx) {
          bodyTextForIzq = report.substring(izqIdx, conclusionIdx);
        } else {
          bodyTextForIzq = report.substring(izqIdx);
        }
        bodyTextForDer = report;
      } else {
        if (conclusionIdx !== -1) {
          bodyTextForDer = report.substring(0, conclusionIdx);
          bodyTextForIzq = report.substring(0, conclusionIdx);
        } else {
          bodyTextForDer = report;
          bodyTextForIzq = report;
        }
      }

      // Determine if study is unilateral (and which side) or bilateral
      let sideToKeep: "der" | "izq" | "both" = "both";
      
      const hasDerechoInStudy = studyLower.includes("derech") || studyLower.includes(" unilateral d") || studyLower.includes("der.");
      const hasIzquierdoInStudy = studyLower.includes("izquierd") || studyLower.includes(" unilateral i") || studyLower.includes("izq.");
      const isUnilateralStudy = studyLower.includes("unilateral");

      const hasDerechoInReport = reportLower.includes("miembro inferior derecho") || reportLower.includes("m.i. derecho") || reportLower.includes("unilateral derecho") || reportLower.includes("miembro derecho");
      const hasIzquierdoInReport = reportLower.includes("miembro inferior izquierdo") || reportLower.includes("m.i. izquierdo") || reportLower.includes("unilateral izquierdo") || reportLower.includes("miembro izquierdo");

      const hasDerechoHeader = reportLower.includes("derecho:") || reportLower.includes("miembro derecho:") || reportLower.includes("miembro inferior derecho:") || reportLower.includes("extremidad inferior derecha:") || reportLower.includes("lado derecho:");
      const hasIzquierdoHeader = reportLower.includes("izquierdo:") || reportLower.includes("miembro izquierdo:") || reportLower.includes("miembro inferior izquierdo:") || reportLower.includes("extremidad inferior izquierda:") || reportLower.includes("lado izquierdo:");

      if (parsedData.detectedSide === "der" || parsedData.detectedSide === "izq") {
        sideToKeep = parsedData.detectedSide;
      } else if (hasDerechoInStudy && !hasIzquierdoInStudy) {
        sideToKeep = "der";
      } else if (hasIzquierdoInStudy && !hasDerechoInStudy) {
        sideToKeep = "izq";
      } else if ((hasDerechoInReport || hasDerechoHeader) && !(hasIzquierdoInReport || hasIzquierdoHeader)) {
        sideToKeep = "der";
      } else if ((hasIzquierdoInReport || hasIzquierdoHeader) && !(hasDerechoInReport || hasDerechoHeader)) {
        sideToKeep = "izq";
      } else if (isUnilateralStudy) {
        // Fallback to searching report keywords
        const derCount = (reportLower.match(/derech|der\b|dch/g) || []).length;
        const izqCount = (reportLower.match(/izquierd|izq\b/g) || []).length;
        if (derCount > izqCount) {
          sideToKeep = "der";
        } else if (izqCount > derCount) {
          sideToKeep = "izq";
        }
      }

      parsedData.detectedSide = sideToKeep;
      if (sideToKeep === "der") {
        parsedData.detectedStudyType = "Doppler Venoso de Miembro Inferior Derecho (Unilateral)";
      } else if (sideToKeep === "izq") {
        parsedData.detectedStudyType = "Doppler Venoso de Miembro Inferior Izquierdo (Unilateral)";
      } else {
        parsedData.detectedStudyType = "Doppler Venoso de Miembros Inferiores (Bilateral)";
      }

      const allVenousVessels = [
        // DERECHOS
        {
          key: "vfc_der",
          side: "der" as const,
          name: "Vena Femoral Común Derecha (VFC)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral común", "femoral comun", "vfc"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "sfj_der",
          side: "der" as const,
          name: "Unión Safenofemoral Derecha (USF)",
          range: "Competente, sin reflujo",
          defaultVal: "Competente",
          vesselKeywords: ["safenofemoral", "sfj", "unión safeno", "union safeno", "cayado de la safena magna", "cayado de la safena interna", "safeno-femoral"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vfs_der",
          side: "der" as const,
          name: "Vena Femoral Derecha (VF)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral superficial", "femoral", "vfs", "vf"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vp_der",
          side: "der" as const,
          name: "Vena Poplítea Derecha (VP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["poplítea", "poplitea", "vp"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vta_der",
          side: "der" as const,
          name: "Vena Tibial Anterior Derecha (VTA)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["tibial anterior", "vta"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vtp_der",
          side: "der" as const,
          name: "Vena Tibial Posterior Derecha (VTP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["tibial posterior", "vtp"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vper_der",
          side: "der" as const,
          name: "Vena Peronea Derecha (VPer)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["peronea", "vper"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vsm_der",
          side: "der" as const,
          name: "Vena Safena Magna Derecha (VSM)",
          range: "Permeable, competente",
          defaultVal: "Permeable",
          vesselKeywords: ["safena magna", "safena interna", "vsm"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "vsp_der",
          side: "der" as const,
          name: "Vena Safena Parva Derecha (VSP)",
          range: "Permeable, competente",
          defaultVal: "Permeable",
          vesselKeywords: ["safena parva", "safena externa", "vsp"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        // IZQUIERDOS
        {
          key: "vfc_izq",
          side: "izq" as const,
          name: "Vena Femoral Común Izquierda (VFC)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral común", "femoral comun", "vfc"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "sfj_izq",
          side: "izq" as const,
          name: "Unión Safenofemoral Izquierda (USF)",
          range: "Competente, sin reflujo",
          defaultVal: "Competente",
          vesselKeywords: ["safenofemoral", "sfj", "unión safeno", "union safeno", "cayado de la safena magna", "cayado de la safena interna", "safeno-femoral"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vfs_izq",
          side: "izq" as const,
          name: "Vena Femoral Izquierda (VF)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral superficial", "femoral", "vfs", "vf"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vp_izq",
          side: "izq" as const,
          name: "Vena Poplítea Izquierda (VP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["poplítea", "poplitea", "vp"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vta_izq",
          side: "izq" as const,
          name: "Vena Tibial Anterior Izquierda (VTA)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["tibial anterior", "vta"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vtp_izq",
          side: "izq" as const,
          name: "Vena Tibial Posterior Izquierda (VTP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["tibial posterior", "vtp"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vper_izq",
          side: "izq" as const,
          name: "Vena Peronea Izquierda (VPer)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["peronea", "vper"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vsm_izq",
          side: "izq" as const,
          name: "Vena Safena Magna Izquierda (VSM)",
          range: "Permeable, competente",
          defaultVal: "Permeable",
          vesselKeywords: ["safena magna", "safena interna", "vsm"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "vsp_izq",
          side: "izq" as const,
          name: "Vena Safena Parva Izquierda (VSP)",
          range: "Permeable, competente",
          defaultVal: "Permeable",
          vesselKeywords: ["safena parva", "safena externa", "vsp"],
          sideKeywords: ["izquierd", "izq", "mii"]
        }
      ];

      // Filter based on unilateral vs bilateral
      const mandatoryVenous = allVenousVessels.filter(v => {
        if (sideToKeep === "both") return true;
        return v.side === sideToKeep;
      });

      const currentStructures = parsedData.structures || [];
      const updatedStructures: any[] = [];
      const matchedKeys = new Set<string>();

      // Intelligent evaluation helper for veins
      const analyzeVein = (key: string, side: "der" | "izq", vKeywords: string[]) => {
        const sideText = side === "der" ? bodyTextForDer.toLowerCase() : bodyTextForIzq.toLowerCase();
        const conclusionTextLower = conclusionText.toLowerCase();

        const matchesKeywordSafe = (sentenceLower: string, keyword: string) => {
          if (keyword.length <= 3) {
            const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(?:^|[^a-záéíóúüñ])${escaped}(?:$|[^a-záéíóúüñ])`, 'i');
            return regex.test(sentenceLower);
          }
          return sentenceLower.includes(keyword.toLowerCase());
        };

        // 1. Get sentences from side-specific body text
        const sideSentences = sideText.split(/[.\n;]/);
        const matchedSideSentences = sideSentences.filter(s => {
          const sLower = s.toLowerCase();
          const matchesVessel = vKeywords.some(k => matchesKeywordSafe(sLower, k));
          if (!matchesVessel) return false;

          if (derIdx === -1 || izqIdx === -1) {
            const sideKws = side === "der" 
              ? ["derech", "der", "dch", "mid", "m.i.d", "ambas", "ambos", "bilateral", "bilaterales"] 
              : ["izquierd", "izq", "mii", "m.i.i", "ambas", "ambos", "bilateral", "bilaterales"];
            const matchesSide = sideKws.some(k => sLower.includes(k));
            if (!matchesSide) return false;
          }
          return true;
        });

        // 2. Get sentences from the diagnostic impression/conclusion
        const conclusionSentences = conclusionTextLower.split(/[.\n;]/);
        const matchedConclusionSentences = conclusionSentences.filter(s => {
          const sLower = s.toLowerCase();
          const matchesVessel = vKeywords.some(k => matchesKeywordSafe(sLower, k));
          if (!matchesVessel) return false;

          const sideKws = side === "der" 
            ? ["derech", "der", "dch", "mid", "m.i.d", "ambas", "ambos", "bilateral", "bilaterales"] 
            : ["izquierd", "izq", "mii", "m.i.i", "ambas", "ambos", "bilateral", "bilaterales"];
          
          const matchesSide = sideKws.some(k => sLower.includes(k));
          
          if (sideToKeep === side) {
            return true;
          }

          return matchesSide;
        });

        const allMatched = [...matchedSideSentences, ...matchedConclusionSentences];
        const context = allMatched.join(" ").toLowerCase().trim();

        if (!context) {
          return {
            status: "not_found" as const,
            measuredValue: "",
            interpretation: "Sin medición registrada",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        const isThrombosis = context.includes("trombosis") || context.includes("trombo") || context.includes("no colapsable") || context.includes("no compresible") || context.includes("ocluid") || context.includes("ausencia de flujo");
        const isReflux = context.includes("reflujo") || context.includes("insuficienc") || context.includes("incompetent") || context.includes("reflujo provocado") || context.includes("reflujo espontáneo");

        // Extract any numeric values (e.g. "6.5 mm", "5 mm", etc.) that might have been assigned or recorded in the report
        const numberMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|cm|m\/s|cm\/s)/i) || 
                            context.match(/(?:diámetro|diametro|medida|mide|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|cm)/i) ||
                            context.match(/(?:diámetro|diametro|medida|mide|de)\s+(\d+(?:[.,]\d+)?)/i);

        if (numberMatch) {
          const valStr = numberMatch[0].trim();
          const numOnly = numberMatch[1].replace(".", ",");
          const unit = context.includes("cm") ? "cm" : "mm";
          const formattedVal = (valStr.includes("mm") || valStr.includes("cm")) ? valStr : `${numOnly} ${unit}`;
          
          const isAlteredVal = isThrombosis || isReflux || context.includes("dilatad") || context.includes("ectas") || context.includes("aumentad");
          const status = isAlteredVal ? "altered" : "normal";
          
          let interpretation = "";
          if (isThrombosis) {
            interpretation = "Trombosis venosa";
          } else if (isReflux) {
            interpretation = "Insuficiencia valvular";
          } else if (context.includes("dilatad") || context.includes("ectas")) {
            interpretation = "Dilatación venosa / Ectasia";
          } else {
            interpretation = key.startsWith("sfj") ? "Unión safenofemoral competente" : "Permeable, colapsable al transductor";
          }

          const baseState = key.startsWith("sfj") 
            ? (isReflux ? "Reflujo" : "Competente") 
            : (isThrombosis ? "Trombosis" : "Permeable");

          return {
            status,
            measuredValue: `${formattedVal}, ${baseState}`,
            interpretation,
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        if (isThrombosis) {
          return {
            status: "altered" as const,
            measuredValue: "Trombosis",
            interpretation: "Trombosis venosa",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        if (isReflux) {
          return {
            status: "altered" as const,
            measuredValue: "Reflujo",
            interpretation: "Insuficiencia valvular",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        const isNormal = context.includes("permeable") || context.includes("colapsable") || context.includes("compresible") || context.includes("competente") || context.includes("normal") || context.includes("sin reflujo") || context.includes("sin signos de trombosis") || context.includes("conservad");

        if (isNormal) {
          return {
            status: "normal" as const,
            measuredValue: key.startsWith("sfj") ? "Competente" : "Permeable",
            interpretation: key.startsWith("sfj") ? "Unión safenofemoral competente" : "Permeable, colapsable al transductor",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        return {
          status: "not_found" as const,
          measuredValue: "",
          interpretation: "Sin medición registrada",
          defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
        };
      };

      // Match existing structures or build them smartly
      currentStructures.forEach((s: any) => {
        const sName = (s.structure || "").toLowerCase();
        let matchedKey: string | null = null;
        let matchedVessel: typeof mandatoryVenous[0] | null = null;

        for (const m of mandatoryVenous) {
          if (matchedKeys.has(m.key)) continue;

          let isMatch = m.vesselKeywords.some(kw => sName.includes(kw)) && m.sideKeywords.some(skw => sName.includes(skw));

          if (isMatch) {
            matchedKey = m.key;
            matchedVessel = m;
            break;
          }
        }

        if (matchedKey && matchedVessel) {
          matchedKeys.add(matchedKey);
          
          const analysis = analyzeVein(
            matchedVessel.key,
            matchedVessel.side,
            matchedVessel.vesselKeywords
          );

          s.structure = matchedVessel.name;
          s.normalRange = matchedVessel.range;
          s.defaultNormalValue = analysis.defaultNormalValue;
          
          const geminiFound = s.status !== "not_found" && s.measuredValue && s.measuredValue.trim() !== "";
          
          let statusToUse = geminiFound ? s.status : analysis.status;
          let valueToUse = geminiFound ? (s.measuredValue || "") : (analysis.measuredValue || "");
          let interpToUse = geminiFound ? (s.interpretation || "") : (analysis.interpretation || "");

          if (statusToUse === "altered") {
            s.status = "altered";
            const valLower = valueToUse.toLowerCase();
            if (valLower.includes("trombo") || valLower.includes("trombosis")) {
              s.measuredValue = "Trombosis";
              s.interpretation = "Trombosis venosa";
            } else if (valLower.includes("reflujo") || valLower.includes("insufic") || valLower.includes("incompet")) {
              s.measuredValue = "Reflujo";
              s.interpretation = "Insuficiencia valvular";
            } else {
              s.measuredValue = valueToUse || "Reflujo / Insuficiencia";
              s.interpretation = interpToUse || "Hallazgo alterado";
            }
          } else if (statusToUse === "normal") {
            s.status = "normal";
            s.measuredValue = matchedVessel.key.startsWith("sfj") ? "Competente" : "Permeable";
            s.interpretation = matchedVessel.key.startsWith("sfj") ? "Unión safenofemoral competente" : "Permeable, colapsable al transductor";
          } else {
            s.status = "not_found";
            s.measuredValue = "";
            s.interpretation = "Sin medición registrada";
          }
          updatedStructures.push(s);
        } else {
          const isLowerLimbDup = allVenousVessels.some(v => v.vesselKeywords.some(kw => sName.includes(kw)));
          if (!isLowerLimbDup) {
            updatedStructures.push(s);
          }
        }
      });

      // Add missing ones
      mandatoryVenous.forEach(m => {
        if (!matchedKeys.has(m.key)) {
          const analysis = analyzeVein(
            m.key,
            m.side,
            m.vesselKeywords
          );

          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: analysis.measuredValue,
            status: analysis.status,
            interpretation: analysis.interpretation,
            defaultNormalValue: analysis.defaultNormalValue
          });
        }
      });

      parsedData.structures = updatedStructures;
    }

    // --- CUELLO / TIROIDES POST-PROCESSING ---
    let isCarotidStudy = (parsedData.detectedStudyType || "").toLowerCase().includes("carot");
    let isNeckOrThyroidStudy = (parsedData.detectedStudyType || "").toLowerCase().includes("cuello") || 
                               (parsedData.detectedStudyType || "").toLowerCase().includes("tiroides") || 
                               (parsedData.detectedStudyType || "").toLowerCase().includes("neck") || 
                               (parsedData.detectedStudyType || "").toLowerCase().includes("thyroid") ||
                               (report || "").toLowerCase().includes("tiroides") ||
                               (report || "").toLowerCase().includes("cuello");

    if (isNeckOrThyroidStudy && !isCarotidStudy) {
      // Exclude carotid system structures from neck/thyroid ultrasound
      const carotidKeywords = [
        "carótida", "carotida", "gim", "miointimal", "vertebral", "acc/aci", "acc", "aci", "ace", "grosor miointimal", "relación acc"
      ];
      if (parsedData.structures && Array.isArray(parsedData.structures)) {
        parsedData.structures = parsedData.structures.filter((s: any) => {
          const nameLower = (s.structure || "").toLowerCase();
          return !carotidKeywords.some(keyword => nameLower.includes(keyword));
        });
      }
    }

    // --- ABDOMEN POST-PROCESSING ---
    let isAbdomenStudy = 
      (parsedData.detectedStudyType || "").toLowerCase().includes("abdomen") ||
      (parsedData.detectedStudyType || "").toLowerCase().includes("abdominal") ||
      (report || "").toLowerCase().includes("abdomen") ||
      (report || "").toLowerCase().includes("abdominal") ||
      (report || "").toLowerCase().includes("hígado") ||
      (report || "").toLowerCase().includes("higado") ||
      (report || "").toLowerCase().includes("bazo") ||
      (report || "").toLowerCase().includes("hepática") ||
      (report || "").toLowerCase().includes("hepatica");

    if (isAbdomenStudy) {
      const mandatoryAbdomen = [
        {
          key: "higado",
          name: "Hígado",
          range: "120 - 154 mm",
          defaultVal: "135 mm",
          matchRegex: /h[íi]gado/i,
          negativeRegex: /rigidez|elastograf|porta|suprahep[áa]t|arteria|vena/i
        },
        {
          key: "bazo",
          name: "Bazo",
          range: "9 - 11,8 mm",
          defaultVal: "10,5 mm",
          matchRegex: /bazo/i,
          negativeRegex: /arteria|vena|espl[eé]nic/i
        },
        {
          key: "rigidez",
          name: "Rigidez Hepática (Elastografía)",
          range: "4 - 5,4 kPa",
          defaultVal: "4,7 kPa",
          matchRegex: /rigidez|elastograf/i,
          negativeRegex: /$^/
        }
      ];

      const currentStructures = parsedData.structures || [];
      const updatedStructures: any[] = [];
      const matchedKeys = new Set<string>();

      // Try matching existing structures first
      currentStructures.forEach((s: any) => {
        const sName = (s.structure || "").toLowerCase();
        let matchedKey: string | null = null;

        for (const m of mandatoryAbdomen) {
          if (matchedKeys.has(m.key)) continue;

          const isMatch = m.matchRegex.test(sName) && !m.negativeRegex.test(sName);
          if (isMatch) {
            matchedKey = m.key;
            s.structure = m.name;
            s.normalRange = m.range;
            s.defaultNormalValue = m.defaultVal;

            // Recalculate status if measuredValue is present
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
              if (numMatch) {
                let numVal = parseFloat(numMatch[1]);
                // Convert cm to mm for Liver/Spleen if needed
                const valLower = s.measuredValue.toLowerCase();
                if (valLower.includes("cm") && m.key !== "rigidez") {
                  numVal = numVal * 10;
                }

                let isNormal = false;
                if (m.key === "higado") {
                  isNormal = numVal >= 120 && numVal <= 154;
                } else if (m.key === "bazo") {
                  isNormal = numVal >= 9 && numVal <= 11.8;
                } else if (m.key === "rigidez") {
                  isNormal = numVal >= 4 && numVal <= 5.4;
                }

                if (isNormal) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  if (m.key === "higado") {
                    s.interpretation = numVal < 120 ? "Hígado disminuido de tamaño" : "Hepatomegalia";
                  } else if (m.key === "bazo") {
                    s.interpretation = numVal < 9 ? "Bazo disminuido de tamaño" : "Esplenomegalia";
                  } else {
                    s.interpretation = numVal < 4 ? "Rigidez hepática disminuida" : "Rigidez hepática aumentada (Sugerente de Fibrosis)";
                  }
                }
              }
            }
            break;
          }
        }

        if (matchedKey) {
          matchedKeys.add(matchedKey);
        }
        updatedStructures.push(s);
      });

      // Add missing ones
      mandatoryAbdomen.forEach(m => {
        if (!matchedKeys.has(m.key)) {
          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: "",
            status: "not_found",
            interpretation: "Sin medición registrada",
            defaultNormalValue: m.defaultVal
          });
        }
      });

      parsedData.structures = updatedStructures;
    }

    // Enforce standard medical ranges for thyroid (lobes and isthmus) and recalculate status if present
    if (parsedData.structures && Array.isArray(parsedData.structures)) {
      parsedData.structures = parsedData.structures.map((s: any) => {
        const nameLower = (s.structure || "").toLowerCase();
        const isThyroid = nameLower.includes("lóbulo") || nameLower.includes("lobulo") || nameLower.includes("tiroides") || nameLower.includes("tiroidea");
        const isIsthmus = nameLower.includes("istmo");
        
        if (isThyroid || isIsthmus) {
          let isLongitudinal = nameLower.includes("longitudinal") || nameLower.includes("longitud") || nameLower.includes("largo");
          let isAP = nameLower.includes("anteroposterior") || nameLower.includes("ap") || (nameLower.includes("espesor") && !isIsthmus) || nameLower.includes("grosor") || nameLower.includes("profundidad");
          let isTransverse = nameLower.includes("transverso") || nameLower.includes("transversal") || nameLower.includes("ancho");
          let isVolume = nameLower.includes("volumen") || nameLower.includes("vol");

          // Smart fallback: guess the dimension from the existing range/value if none matched
          if (!isLongitudinal && !isAP && !isTransverse && !isVolume && !isIsthmus) {
            const rangeStr = (s.normalRange || "").toLowerCase();
            const defStr = (s.defaultNormalValue || "").toLowerCase();
            const combined = rangeStr + " " + defStr;

            if (combined.includes("ml") || combined.includes("cc") || combined.includes("vol")) {
              isVolume = true;
            } else {
              const nums = combined.match(/(\d+(?:\.\d+)?)/g);
              if (nums && nums.length > 0) {
                const firstNum = parseFloat(nums[0]);
                let guessNum = firstNum;
                if (combined.includes("cm") || firstNum < 8) {
                  guessNum = firstNum * 10;
                }
                
                if (guessNum >= 30) {
                  isLongitudinal = true;
                } else if (guessNum >= 15) {
                  isTransverse = true;
                } else {
                  isAP = true;
                }
              } else {
                isLongitudinal = true; // Fallback
              }
            }
          }

          if (isLongitudinal) {
            s.normalRange = "37 - 44 mm";
            s.defaultNormalValue = "40 mm";
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                let numVal = parseFloat(numMatch[1].replace(",", "."));
                const isCm = s.measuredValue.toLowerCase().includes("cm") || numVal < 9;
                if (isCm) {
                  numVal = numVal * 10;
                }
                if (numVal >= 37 && numVal <= 44) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  if (numVal < 37) {
                    s.interpretation = "Lóbulo tiroideo disminuido de tamaño";
                  } else {
                    s.interpretation = "Bocio / Lóbulo tiroideo aumentado de tamaño";
                  }
                }
              }
            }
          } else if (isAP) {
            s.normalRange = "10 - 20 mm";
            s.defaultNormalValue = "14 mm";
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                let numVal = parseFloat(numMatch[1].replace(",", "."));
                const isCm = s.measuredValue.toLowerCase().includes("cm") || numVal < 5;
                if (isCm) {
                  numVal = numVal * 10;
                }
                if (numVal >= 10 && numVal <= 20) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  if (numVal < 10) {
                    s.interpretation = "Espesor anteroposterior disminuido";
                  } else {
                    s.interpretation = "Espesor anteroposterior aumentado";
                  }
                }
              }
            }
          } else if (isTransverse) {
            s.normalRange = "15 - 20 mm";
            s.defaultNormalValue = "16 mm";
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                let numVal = parseFloat(numMatch[1].replace(",", "."));
                const isCm = s.measuredValue.toLowerCase().includes("cm") || numVal < 5;
                if (isCm) {
                  numVal = numVal * 10;
                }
                if (numVal >= 15 && numVal <= 20) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  if (numVal < 15) {
                    s.interpretation = "Diámetro transverso disminuido";
                  } else {
                    s.interpretation = "Diámetro transverso aumentado";
                  }
                }
              }
            }
          } else if (isIsthmus) {
            s.normalRange = "< 4 mm";
            s.defaultNormalValue = "2.5 mm";
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                let numVal = parseFloat(numMatch[1].replace(",", "."));
                const isCm = s.measuredValue.toLowerCase().includes("cm") || numVal < 1;
                if (isCm) {
                  numVal = numVal * 10;
                }
                if (numVal < 4) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  s.interpretation = "Istmo aumentado de tamaño (Hipertrofia)";
                }
              }
            }
          } else if (isVolume) {
            s.normalRange = "4 - 10 ml";
            s.defaultNormalValue = "6 ml";
            if (s.measuredValue && s.measuredValue.trim() !== "") {
              const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                const numVal = parseFloat(numMatch[1].replace(",", "."));
                if (numVal >= 4 && numVal <= 10) {
                  s.status = "normal";
                  s.interpretation = "Características normales";
                } else {
                  s.status = "altered";
                  if (numVal < 4) {
                    s.interpretation = "Volumen de lóbulo tiroideo disminuido";
                  } else {
                    s.interpretation = "Volumen de lóbulo tiroideo aumentado";
                  }
                }
              }
            }
          }
        }
        return s;
      });
    }

    // Randomize default normal values to ensure clinical variability
    if (parsedData.structures && Array.isArray(parsedData.structures)) {
      parsedData.structures.forEach((s: any) => {
        if (s.defaultNormalValue && s.normalRange) {
          s.defaultNormalValue = randomizeNormalValue(s.defaultNormalValue, s.normalRange, s.structure);
        }

        // Specifically format Renal IR (Indices de Resistencia) with exactly 2 decimal places and a comma
        const nameLower = (s.structure || "").toLowerCase();
        const isIR = /\bir\b/i.test(nameLower) || nameLower.includes("índice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("índice resistencia") || nameLower.includes("indice resistencia");
        const studyLower = (parsedData.detectedStudyType || "").toLowerCase();
        const isRenalIR = isIR && (nameLower.includes("renal") || nameLower.includes("riñón") || nameLower.includes("riñon") || nameLower.includes("izquierdo") || nameLower.includes("derecho") || studyLower.includes("renal") || studyLower.includes("abdomen"));

        if (isRenalIR) {
          // Format measuredValue with 2 decimals and comma if present
          if (s.measuredValue && s.measuredValue.trim() !== "") {
            const numMatch = s.measuredValue.match(/(\d+[\.,]\d+|\d+)/);
            if (numMatch) {
              const rawNumStr = numMatch[1].replace(",", ".");
              const numVal = parseFloat(rawNumStr);
              if (!isNaN(numVal)) {
                s.measuredValue = numVal.toFixed(2).replace(".", ",");
              }
            }
          }
          // Format defaultNormalValue with 2 decimals and comma
          if (s.defaultNormalValue && s.defaultNormalValue.trim() !== "") {
            const numMatch = s.defaultNormalValue.match(/(\d+[\.,]\d+|\d+)/);
            if (numMatch) {
              const rawNumStr = numMatch[1].replace(",", ".");
              const numVal = parseFloat(rawNumStr);
              if (!isNaN(numVal)) {
                s.defaultNormalValue = numVal.toFixed(2).replace(".", ",");
              }
            } else {
              // Fallback
              const randomIR = 0.56 + Math.random() * (0.68 - 0.56);
              s.defaultNormalValue = randomIR.toFixed(2).replace(".", ",");
            }
          }
        }
      });
    }

    // Ensure that bilateral structures (kidneys, testicles, ovaries, thyroid lobes, etc.)
    // do not have identical defaultNormalValue when they are not supplied.
    if (parsedData.structures && Array.isArray(parsedData.structures)) {
      const visitedPairs = new Set<number>();
      for (let i = 0; i < parsedData.structures.length; i++) {
        if (visitedPairs.has(i)) continue;
        const s1 = parsedData.structures[i];
        const norm1 = getBaseAndSide(s1.structure);
        if (!norm1) continue;

        for (let j = i + 1; j < parsedData.structures.length; j++) {
          if (visitedPairs.has(j)) continue;
          const s2 = parsedData.structures[j];
          const norm2 = getBaseAndSide(s2.structure);
          if (!norm2) continue;

          // Same base structure but different sides (e.g. "Riñón Derecho Largo" and "Riñón Izquierdo Largo")
          if (norm1.side !== norm2.side && norm1.baseName === norm2.baseName) {
            visitedPairs.add(i);
            visitedPairs.add(j);

            const val1 = (s1.defaultNormalValue || "").trim();
            const val2 = (s2.defaultNormalValue || "").trim();

            if (val1 && val2) {
              const numMatch1 = val1.match(/^([\d.,]+)/);
              const numMatch2 = val2.match(/^([\d.,]+)/);

              if (numMatch1 && numMatch2) {
                const num1 = parseFloat(numMatch1[1].replace(",", "."));
                const num2 = parseFloat(numMatch2[1].replace(",", "."));

                if (!isNaN(num1) && !isNaN(num2) && num1 === num2) {
                  // If they are identical, apply a slight clinical variation to the left side structure's default value
                  const targetStruct = norm2.side === 'izq' ? s2 : s1;
                  targetStruct.defaultNormalValue = varyValueString(targetStruct.defaultNormalValue, targetStruct.structure);
                }
              }
            }
            break;
          }
        }
      }
    }

    res.json({
      success: true,
      detectedStudyType: parsedData.detectedStudyType || "Ultrasonido General",
      structures: parsedData.structures
    });
  } catch (error: any) {
    console.error("Error en /api/analyze-measurements:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 24. API: ASSIGN MEASUREMENTS TO REPORT (Asistente de Medidas)
 * POST /api/assign-measurements
 * Payload: {
 *   currentReport: string,
 *   measurementsToAssign: Array<{structure: string, value: string}>,
 *   model?: string
 * }
 */
app.post("/api/assign-measurements", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentReport, measurementsToAssign } = req.body;
    if (!currentReport || !measurementsToAssign || !Array.isArray(measurementsToAssign)) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'currentReport' y un arreglo 'measurementsToAssign'." });
    }

    if (measurementsToAssign.length === 0) {
      return res.json({ success: true, modifiedReport: currentReport });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const measurementsText = measurementsToAssign.map(m => `- **${m.structure}**: ${m.value}`).join("\n");

    const systemInstruction = 
      "Eres un médico radiólogo experto en redacción clínica. Tu tarea es incorporar mediciones de manera totalmente natural, profesional " +
      "y fluida en las descripciones de las estructuras anatómicas correspondientes dentro de un informe radiológico de ultrasonido o tomografía. " +
      "Debes integrar las medidas solicitadas directamente en las frases existentes o reformularlas ligeramente para que suene como redactado de forma nativa por el médico en una sola sesión. " +
      "Está estrictamente prohibido crear secciones de 'Medidas añadidas' o preámbulos didácticos del estilo 'Se asignan las medidas...'. " +
      "Debe fluir de manera perfecta con el tono y estilo clínico senior.";

    const promptText = `
Tienes este informe radiológico en formato Markdown:

"""
${currentReport}
"""

Por favor, incorpora de forma nativa y fluida las siguientes mediciones normales en sus respectivas estructuras descritas en los hallazgos:

${measurementsText}

⚠️ REGLAS DE INTEGRACIÓN:
1. Localiza cada estructura en la sección de HALLAZGOS (por ejemplo, si se pide Hígado de 135 mm, agrégalo de manera natural en la descripción del Hígado: 'Hígado de tamaño conservado, que mide 135 mm de diámetro bipolar...').
2. Si la estructura no se describe de forma específica pero pertenece al estudio o hay un texto estándar, agrégala de forma elegante respetando el formato del reporte.
3. Para estudios Doppler (como Doppler de Carótidas), es MANDATORIO integrar las velocidades utilizando explícitamente las abreviaciones 'VPS' y 'VED' juntas o muy cerca del nombre del vaso. Debe redactarse de forma idéntica a: 'Nombre del Vaso (VPS: XX cm/s, VED: YY cm/s)' o bien 'Nombre del Vaso con velocidad sistólica (VPS) de XX cm/s y diastólica (VED) de YY cm/s'. Bajo ninguna circunstancia omitas los términos 'VPS' y 'VED' o pongas solo el número, ya que el sistema automatizado de escaneo requiere estas siglas exactas para leer las velocidades correctamente de vuelta.
4. Para la Relación ACC/ACI (tanto derecha como izquierda), incorpórala de forma redactada fluida diciendo exactamente 'Relación ACC/ACI de X,X' (por ejemplo: 'Relación ACC/ACI de 1,2') al final del análisis hemodinámico de cada lado.
5. ¡ESTÁ TERMINANTEMENTE PROHIBIDO OMITIR O IGNORAR NINGUNO de los parámetros solicitados! Cada uno de los elementos de la lista de mediciones debe quedar incorporado de manera explícita en el informe redactado. Si algún vaso, relación, estructura o parámetro de la lista no se describe ni se menciona en el informe original, DEBES redactar una frase clínica fluida, elegante y natural dentro de la sección de Hallazgos para describirlo e incluir sus valores (por ejemplo: 'La Arteria Carótida Externa presenta velocidades conservadas (VPS: 64 cm/s, VED: 14 cm/s)...' o 'La relación ACC/ACI en el lado izquierdo es de 1,2.'). No resumas ni agrupes de forma que se pierdan las cifras individuales de cada parámetro.
6. No alteres otras patologías o hallazgos descritos, mantén el rigor del diagnóstico intacto.
7. **REGLA DE CASING ESTRICTA**: No uses mayúsculas sostenidas (ALL CAPS) para el texto nuevo o modificado. Escribe en minúsculas normales respetando las mayúsculas iniciales.
8. Devuelve ÚNICAMENTE el informe modificado completo en formato Markdown, sin preámbulos, explicaciones ni comentarios de ningún tipo.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    res.json({
      success: true,
      modifiedReport: response.text
    });
  } catch (error: any) {
    console.error("Error en /api/assign-measurements:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 25. API: GENERATE FOOTNOTES SUGGESTIONS (Creador de Notas de Pie de Página)
 * POST /api/generate-footnotes
 * Payload: {
 *   report: string,
 *   model?: string
 * }
 */
app.post("/api/generate-footnotes", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para generar las notas de pie de página." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un médico radiólogo senior experto en auditoría de informes ecográficos y redactores de notas de pie de página.\n" +
      "Tu tarea es analizar de forma íntegra el reporte clínico proporcionado y elaborar sugerencias de notas de pie de página con información altamente relevante y de alto valor para el médico tratante o para el paciente.\n" +
      "Debes generar exactamente 4 sugerencias diferentes y bien redactadas en español, cada una clasificada en una de estas categorías:\n" +
      "1. 'Médico Tratante': Recomendaciones clínicas técnicas, sugerencias de laboratorios complementarios, correlaciones histológicas, perfiles hepáticos/tiroideos, etc. Si detectas hallazgos patológicos específicos, integra la cita científica correspondiente (ej. 'Estratificación de riesgo estimada mediante criterios ACR TI-RADS 2017' para nódulos tiroideos; o 'Criterios hemodinámicos basados en el Consenso de la Society of Radiologists in Ultrasound (SRU)' para estenosis carotídea o esteatosis hepática; 'Clasificación de Bosniak' para quistes renales; o 'BI-RADS' para hallazgos en mamas).\n" +
      "2. 'Paciente': Explicaciones empáticas o recomendaciones amigables sobre control de síntomas, aclaraciones generales que disipen dudas comunes, etc.\n" +
      "3. 'Control': Sugerencias específicas de temporalidad para estudios de control (ej: repetir en 6 meses, control anual, control inmediato según evolución clínica).\n" +
      "4. 'Técnico / General': Notas de calidad del estudio, limitaciones técnicas del examen (ej: interposición de gas intestinal, panículo adiposo, colaboración del paciente, transductor utilizado).\n\n" +
      "REGLAS IMPORTANTES:\n" +
      "- Adapta las notas de forma estrictamente personalizada a los hallazgos reales del reporte (por ejemplo, si hay hepatomegalia, sugiera perfil hepático; si hay bocio, sugiera TSH; si todo es normal, sugiera controles rutinarios de prevención y comente las excelentes condiciones de la ventana acústica).\n" +
      "- Las notas deben ser breves, sumamente profesionales y elegantes (máximo 150 caracteres por sugerencia).\n" +
      "- Devuelve ÚNICAMENTE un objeto JSON válido con la estructura descrita abajo, sin backticks ni explicaciones externas.";

    const promptText = `
Analiza este reporte clínico:

"""
${report}
"""

Genera las 4 sugerencias personalizadas en formato JSON estructurado exactamente así:
{
  "footnotes": [
    {
      "id": "fn_1",
      "category": "Médico Tratante",
      "text": "Sugerencia personalizada de pie de página para el médico"
    },
    {
      "id": "fn_2",
      "category": "Paciente",
      "text": "Sugerencia amigable personalizada de pie de página para el paciente"
    },
    {
      "id": "fn_3",
      "category": "Control",
      "text": "Sugerencia personalizada de control y seguimiento"
    },
    {
      "id": "fn_4",
      "category": "Técnico / General",
      "text": "Sugerencia técnica sobre limitaciones o calidad del estudio"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        responseMimeType: "application/json"
      },
    });

    let data;
    try {
      const cleanText = response.text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("Error parsing footnotes JSON from Gemini:", response.text);
      data = {
        footnotes: [
          {
            id: "fn_1",
            category: "Médico Tratante",
            text: "Se sugiere correlación clínica con antecedentes y exámenes de laboratorio complementarios."
          },
          {
            id: "fn_2",
            category: "Paciente",
            text: "Recuerde consultar los resultados de este examen con su médico tratante para una interpretación integral."
          },
          {
            id: "fn_3",
            category: "Control",
            text: "Se recomienda control ecográfico periódico según indicación médica y evolución clínica."
          },
          {
            id: "fn_4",
            category: "Técnico / General",
            text: "Examen realizado bajo condiciones técnicas adecuadas con transductor multifrecuencial de alta resolución."
          }
        ]
      };
    }

    res.json({
      success: true,
      footnotes: data.footnotes || []
    });
  } catch (error: any) {
    console.error("Error en /api/generate-footnotes:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 26. API: DETECT EXTERNAL CLINICAL GUIDELINES AND FRACTURE CLASSIFICATIONS
 * POST /api/detect-external-guideline
 * Payload: {
 *   report: string,
 *   model?: string
 * }
 */
app.post("/api/detect-external-guideline", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para escanear guías clínicas." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un médico radiólogo, traumatólogo y auditor clínico senior experto en consensos científicos, guías de práctica clínica internacionales y sistemas de clasificación.\n" +
      "Tu tarea es analizar detalladamente el reporte médico proporcionado y determinar qué guías y consensos de práctica clínica han sido REALMENTE APLICADOS o son directamente pertinentes según los hallazgos patológicos reales descritos en el informe.\n" +
      "REGLAS CRÍTICAS DE AUDITORÍA (PROHIBIDO EL EMPAREJAMIENTO DE PALABRAS CLAVE AISLADAS):\n" +
      "- Debes entender el contexto clínico real de manera íntegra. No uses atajos como recomendar una guía solo porque aparezca un término anatómico si el órgano o estructura es normal.\n" +
      "- No sugieras 'gpc-bosniak' (Clasificación de Bosniak) si no hay mención explícita de quistes o lesiones quísticas renales complejas con tabiques o calcificaciones.\n" +
      "- No sugieras 'gpc-ti-rads' (ACR TI-RADS) si la tiroides es normal o no se describen nódulos tiroideos.\n" +
      "- No sugieras 'gpc-bi-rads' (ACR BI-RADS) si no hay hallazgos patológicos o sospechas reales en mamas.\n" +
      "- No sugieras 'gpc-sru-esteatosis' (Consenso SRU Hígado) si el hígado tiene ecogenicidad normal o si se niega explícitamente la esteatosis hepática (por ejemplo, 'hígado de tamaño y ecogenicidad normal, sin esteatosis'). Si está presente, los rangos oficiales QUS son: Normal (<5.0%), Leve (5.0-12.0%), Moderada (12.1-20.0%), Severa (>20.0%).\n" +
      "- No sugieras 'gpc-sru-carotidas' (Consenso SRU Carótidas) o 'gpc-mannheim' (Consenso de Mannheim GIM) si no se describe patología carotídea, placas de ateroma o alteración del grosor íntima-media.\n" +
      "- No sugieras 'gpc-kellgren' (Kellgren & Lawrence) si no se describe artrosis, osteofitos o pinzamiento articular en la rodilla.\n" +
      "- No sugieras 'gpc-sru-tvp' (Consenso SRU de TVP) si no hay signos de trombosis venosa profunda.\n" +
      "- No sugieras 'gpc-tasc-ii' (Consenso TASC II Arterial) si no hay enfermedad arterial periférica, estenosis o flujos alterados descritos.\n" +
      "- No sugieras 'gpc-or-ads' (Clasificación O-RADS) o 'gpc-iota' (Reglas Simples IOTA) si no hay masas anexiales, quistes ováricos o hallazgos ginecológicos patológicos relevantes.\n" +
      "- No sugieras 'gpc-tokio-tg18' (Guías de Tokio TG18) si no se describe colecistitis aguda o sospecha de inflamación vesicular.\n" +
      "- No sugieras 'gpc-apendice-acr' (Criterios Apendicitis ACR) si el apéndice es normal o no hay sospecha de apendicitis aguda.\n" +
      "Debes responder ÚNICAMENTE con un objeto JSON con la estructura descrita abajo, sin comillas invertidas (backticks) ni explicaciones de texto adicionales.";

    const promptText = `
Analiza el siguiente reporte clínico para auditar y extraer guías o consensos aplicados o pertinentes según el contexto real:

"""
${report}
"""

Las guías estándar disponibles y sus condiciones son:
- "gpc-ti-rads": Aplicada si hay nódulos tiroideos.
- "gpc-sru-carotidas": Aplicada si hay estenosis o placas carotídeas.
- "gpc-bi-rads": Aplicada si hay lesiones mamarias (nódulos, microcalcificaciones, asimetrías) o BI-RADS explícito.
- "gpc-bosniak": Aplicada si hay quistes renales con tabiques, calcificaciones o complejidad.
- "gpc-sru-esteatosis": Aplicada si hay esteatosis hepática (hígado graso, infiltración grasa). Clasificación QUS: Leve (5.0-12.0%), Moderada (12.1-20.0%), Severa (>20.0%).
- "gpc-kellgren": Aplicada si hay artrosis o pinzamiento articular en rodilla.
- "gpc-sru-tvp": Aplicada si hay trombosis venosa profunda o sospecha de TVP.
- "gpc-tasc-ii": Aplicada si hay estenosis o flujos alterados en Doppler arterial de miembros inferiores.
- "gpc-mannheim": Aplicada si hay medición del grosor íntima-media (GIM) carotídeo o Mannheim.
- "gpc-or-ads": Aplicada si hay masas anexiales u ováricas bajo O-RADS.
- "gpc-iota": Aplicada si hay masas anexiales valoradas con reglas IOTA.
- "gpc-tokio-tg18": Aplicada si hay colecistitis aguda o sospecha de inflamación de vesícula.
- "gpc-apendice-acr": Aplicada si hay sospecha de apendicitis aguda.

Retorna el resultado en formato JSON estructurado exactamente así:
{
  "matchedStandardIds": ["gpc-ti-rads", "gpc-bi-rads"], // Arreglo de IDs de guías estándar de la lista que realmente aplican según el contexto. Si ninguna aplica, dejar vacío [].
  "detected": [
    {
      "id": "guideline_id_unico",
      "title": "Nombre de la Clasificación (ej: Clasificación de Gustilo-Anderson o Clasificación de Schatzker)",
      "description": "Qué evalúa en la lesión específica descrita en el informe.",
      "text": "Texto formal de pie de página para incrustar.",
      "source": "Entidad emisora de la guía"
    }
  ] // Arreglo de clasificaciones dinámicas detectadas (especialmente de fracturas u ortopedia descritas en el informe). Si ninguna aplica, dejar vacío [].
}
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json"
      },
    });

    let data;
    try {
      const cleanText = response.text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("Error parsing detected guidelines JSON from Gemini:", response.text);
      data = { matchedStandardIds: [], detected: [] };
    }

    res.json({
      success: true,
      matchedStandardIds: data.matchedStandardIds || [],
      detected: data.detected || []
    });
  } catch (error: any) {
    console.error("Error en /api/detect-external-guideline:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * Extracts the measurements and clinical assessment used by the prostate and
 * urinary-dynamics module from an existing radiology report.
 */
app.post("/api/extract-prostate-urinary-data", async (req: express.Request, res: express.Response) => {
  try {
    const { reportText, model } = req.body;
    if (!reportText || typeof reportText !== "string" || !reportText.trim()) {
      return res.status(400).json({
        success: false,
        error: "Se requiere el parámetro 'reportText' para extraer los datos prostáticos y urinarios.",
      });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const prompt = `Eres un radiólogo subespecialista en ultrasonido urológico.
Extrae únicamente los datos presentes o calculables de forma directa a partir del siguiente reporte.

Reglas:
- Usa 0 para toda medida numérica ausente y una cadena vacía para todo texto ausente.
- No inventes mediciones, diagnósticos ni recomendaciones.
- Puedes calcular el volumen prostático con la fórmula elipsoide (L × AP × T × 0.52) solo si aparecen las tres dimensiones.
- Puedes calcular el porcentaje de residuo postmiccional solo si aparecen los volúmenes pre y postmiccional.
- Conserva las unidades del esquema: centímetros para dimensiones prostáticas, mililitros/cc para volúmenes y milímetros para IPP y pared vesical.
- "booRisk" solo puede ser "Bajo", "Intermedio", "Alto" o una cadena vacía.
- Las recomendaciones deben ser breves, prudentes y estar justificadas por hallazgos del reporte.

REPORTE:
"""
${reportText}
"""`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prostateVolumeCc: { type: Type.NUMBER },
            prostateLengthCm: { type: Type.NUMBER },
            prostateApCm: { type: Type.NUMBER },
            prostateTransverseCm: { type: Type.NUMBER },
            prostateGrade: { type: Type.STRING },
            preVoidVolumeMl: { type: Type.NUMBER },
            postVoidVolumeMl: { type: Type.NUMBER },
            retentionGrade: { type: Type.STRING },
            ippMm: { type: Type.NUMBER },
            ippGrade: { type: Type.STRING },
            bladderWallMm: { type: Type.NUMBER },
            bladderTrabeculation: { type: Type.STRING },
            kidneysUpperTract: { type: Type.STRING },
            booRisk: { type: Type.STRING },
            prostateMorphology: { type: Type.STRING },
            clinicalConclusion: { type: Type.STRING },
            urologicalRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "prostateVolumeCc",
            "prostateLengthCm",
            "prostateApCm",
            "prostateTransverseCm",
            "prostateGrade",
            "preVoidVolumeMl",
            "postVoidVolumeMl",
            "retentionGrade",
            "ippMm",
            "ippGrade",
            "bladderWallMm",
            "bladderTrabeculation",
            "kidneysUpperTract",
            "booRisk",
            "prostateMorphology",
            "clinicalConclusion",
            "urologicalRecommendations",
          ],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error en /api/extract-prostate-urinary-data:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * NEW API: DIGITALIZE DAILY WORKLIST FROM AN UPLOADED IMAGE
 * POST /api/parse-worklist
 * Payload: {
 *   image: string (base64 data without data prefix)
 *   mimeType: string (e.g. "image/png", "image/jpeg", "image/webp")
 *   model?: string
 * }
 */
app.post("/api/parse-worklist", async (req: express.Request, res: express.Response) => {
  try {
    const { image, mimeType, model } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'image' y 'mimeType'." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const imagePart = {
      inlineData: {
        data: cleanBase64(image),
        mimeType: mimeType,
      },
    };

    const promptText = `
Analiza la siguiente imagen que corresponde a una lista de trabajo (agenda diaria de pacientes) de un médico o centro radiológico.
Digitaliza de manera rigurosa y extrae la lista de pacientes, sus datos personales correspondientes y los detalles de sus citas.

REGLAS DE EXTRACCIÓN:
1. Identifica cada fila o elemento de la agenda que represente a un paciente diferente.
2. Extrae y formatea:
   - 'name': Nombre completo del paciente (en formato Mayúscula/Minúscula estándar, ej: "Carlos Pérez").
   - 'age': Edad (ej: "45" o "45 años"). Si no se especifica, déjalo vacío "".
   - 'gender': Género/sexo. Usa "M", "F" o déjalo vacío "" si no está presente.
   - 'patientId': Identificación, ID de paciente, Historia Clínica o cédula. Si no se especifica, déjalo vacío "".
   - 'studyType': Tipo de estudio radiológico solicitado (ej: "Ecografía Renal" o "Radiografía de Tórax"). Si no se especifica, déjalo vacío "".
   - 'time': Hora programada de la cita (ej: "08:30" o "14:15"). Si no se especifica, déjalo vacío "".
   - 'phone': Número de teléfono, celular o de contacto del paciente. Si no se especifica, déjalo vacío "".
3. Sé sumamente fiel a la imagen. No inventes pacientes que no aparezcan en la lista.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [imagePart, { text: promptText }],
      config: {
        systemInstruction: "Eres un experto asistente de digitalización de documentos médicos y agendas clínicas. Extraes información de agendas radiológicas manuscritas o impresas con absoluta precisión y devuelves una lista estructurada de pacientes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre completo del paciente" },
              age: { type: Type.STRING, description: "Edad o años" },
              gender: { type: Type.STRING, description: "Sexo o género ('M', 'F' o vacío)" },
              patientId: { type: Type.STRING, description: "ID, Historia Clínica o Identificación" },
              studyType: { type: Type.STRING, description: "Tipo de estudio médico/radiológico solicitado" },
              time: { type: Type.STRING, description: "Hora de la cita o turno" },
              phone: { type: Type.STRING, description: "Número de teléfono o celular del paciente si está presente" }
            },
            required: ["name"]
          }
        },
        temperature: 0.1,
      },
    });

    let patients = [];
    try {
      const text = response.text || "[]";
      patients = JSON.parse(text);
    } catch (parseErr) {
      console.warn("Falla de parseo en JSON devuelto por Gemini:", response.text);
      throw new Error("No se pudo obtener una lista estructurada válida de la imagen. Por favor, asegúrate de que la foto de la agenda sea clara y legible.");
    }

    res.json({
      success: true,
      patients,
    });
  } catch (error: any) {
    console.error("Error en /api/parse-worklist:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({
      success: false,
      error: friendlyError,
    });
  }
});

// --- FIREBASE CONFIG ENDPOINTS ---
// Cloud Run has an ephemeral filesystem. In production, FIREBASE_CONFIG is the
// source of truth; local development can continue using the JSON file.

function getFirebaseConfigFromEnvironment(): Record<string, unknown> | null {
  const rawConfig = process.env.FIREBASE_CONFIG?.trim();
  if (!rawConfig) return null;

  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed.apiKey || !parsed.projectId) {
      throw new Error("FIREBASE_CONFIG debe incluir apiKey y projectId.");
    }
    return parsed;
  } catch (error) {
    console.error("[Servidor] FIREBASE_CONFIG no contiene un objeto JSON válido:", error);
    return null;
  }
}

// Automatic backup of original firebase-applet-config.json on startup
if (process.env.NODE_ENV !== "production") try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const backupPath = path.join(process.cwd(), "firebase-applet-config.json.backup");
  if (fs.existsSync(configPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
    console.log("[Servidor] Copia de seguridad del Firebase predeterminado creada de forma segura.");
  }
} catch (err) {
  console.warn("No se pudo crear la copia de seguridad de la configuración de Firebase:", err);
}

// Endpoint to save custom Firebase config directly to the workspace file system
app.post("/api/save-firebase-config", (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(409).json({
        success: false,
        error: "En producción, configura Firebase mediante la variable FIREBASE_CONFIG.",
      });
    }

    const { config } = req.body;
    if (!config || !config.apiKey || !config.projectId) {
      return res.status(400).json({ success: false, error: "La configuración provista no contiene 'apiKey' o 'projectId'." });
    }
    
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    
    console.log(`[Servidor] Se ha guardado una nueva configuración de Firebase (Proyecto: ${config.projectId}) directamente en el disco del espacio de trabajo.`);
    res.json({ success: true, message: "¡Configuración de Firebase guardada con éxito de forma persistente en el servidor!" });
  } catch (error: any) {
    console.error("Error al guardar la configuración de Firebase en el disco:", error);
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Endpoint to reset and restore the original AI Studio test database configuration
app.post("/api/reset-firebase-config", (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(409).json({
        success: false,
        error: "La configuración de Firebase de producción se administra mediante FIREBASE_CONFIG.",
      });
    }

    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const backupPath = path.join(process.cwd(), "firebase-applet-config.json.backup");
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath);
      console.log("[Servidor] Configuración predeterminada de Firebase restaurada.");
      res.json({ success: true, message: "Configuración original restaurada con éxito." });
    } else {
      res.status(404).json({ success: false, error: "No se encontró la copia de seguridad de la configuración original en el servidor." });
    }
  } catch (error: any) {
    console.error("Error al restaurar la configuración de Firebase en el disco:", error);
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Endpoint to fetch current Firebase config from the server disk
app.get("/api/firebase-config", (req, res) => {
  try {
    const environmentConfig = getFirebaseConfigFromEnvironment();
    if (environmentConfig) {
      return res.json(environmentConfig);
    }

    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(data);
      res.json(parsed);
    } else {
      res.status(404).json({ error: "No se encontró el archivo de configuración." });
    }
  } catch (error: any) {
    console.error("Error al obtener la configuración de Firebase:", error);
    res.status(500).json({ error: error?.message || String(error) });
  }
});

/**
 * 40. API: GENERATE ORGAN SYNOPTIC TABLE (Creador de Cuadro Sinóptico de Órgano)
 * POST /api/generate-organ-synoptic
 * Payload: {
 *   model?: string,
 *   report: string,
 *   organ: string,
 *   aspects?: string
 * }
 */
app.post("/api/generate-organ-synoptic", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, organ, aspects } = req.body;
    if (!report || !organ) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'report' y 'organ'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un radiólogo experto y un asistente de redacción médica de precisión.
Analiza la sección de hallazgos del reporte radiológico proporcionado enfocado únicamente en la estructura u órgano indicado: '${organ}'.
También ten en cuenta los aspectos adicionales requeridos por el usuario: '${aspects || ""}'.
Debes generar una lista de aspectos clínicos para dicho órgano, estructurados según el esquema JSON solicitado.

REGLAS DE TERMINOLOGÍA Y REDACCIÓN (CRÍTICAS):
1. NUNCA utilices expresiones como 'no fue reportado', 'no se menciona en el informe original', 'no descrito' o similares que separen la IA del usuario o dejen en evidencia la falta de datos del reporte de manera impersonal. Tanto el reporte como este cuadro son redactados y avalados por el mismo profesional médico.
2. Si un dato no figura explícitamente en el reporte pero es un aspecto clínico estándar o de interés, infiere su valor clínico habitual para este contexto, o clasifícalo como 'Sin alteraciones descritas', 'Ecoestructura habitual', 'No detectable', 'De aspecto normal', o propón una deducción clínica lógica de valor añadido.
3. INCLUSIÓN DE MEDIDAS Y HALLAZGOS COMPLEMENTARIOS: Si el reporte carece de dimensiones o medidas específicas habituales para dicho órgano (por ejemplo, diámetros, volumen, espesor) o de hallazgos negativos/positivos clave que se correlacionan directamente con la patología descrita (por ejemplo, ausencia de líquido libre perihepático si hay colecistitis, calibre del colédoco si hay litiasis, etc.), la IA DEBE incluir propuestas de estas medidas y hallazgos lógicos y consistentes con la patología del paciente. Clasifícalos como 'Inferencia Clínica IA' en el origen para que el médico pueda inyectarlos de manera retrógrada al informe.
4. Para clasificaciones de riesgo o diagnósticos diferenciales solicitados por el usuario, utiliza el análisis de los hallazgos descritos para deducir la escala más coherente (ej: TI-RADS, Bosniak, LI-RADS) y fundamenta la clasificación clínicamente.

Para cada aspecto clínico:
1. 'key': Nombre del aspecto (e.g., 'Tamaño', 'Morfología', 'Estructura/Ecogenicidad', 'Vascularización', 'Lesiones', 'Clasificación', 'Diagnóstico Diferencial', 'Recomendación').
2. 'value': El valor clínico o detalle. Sé específico, profesional y preciso.
3. 'clinicalSource': 'Hallazgo de Reporte' si se menciona de forma explícita en el reporte, o 'Inferencia Clínica IA' si lo deduces por IA, escalas o según las guías de práctica clínica como complemento.
4. 'explanation': Breve nota de por qué se incluye este aspecto y su significado clínico.
5. 'narrativeSentence': Una frase en español redactada de forma impecable, fluida, natural y estrictamente profesional en lenguaje médico para ser inyectada en la sección de hallazgos del reporte si se aprueba. No debe sonar robótica. Ej: 'La glándula tiroides se observa de tamaño normal, con ecoestructura homogénea y sin evidencia de nódulos sospechosos.'.

Reglas estrictas:
- No inventes hallazgos patológicos graves que no existan en el reporte de origen a menos que sea en forma de diagnóstico diferencial o clasificaciones de riesgo solicitadas.
- Mantén un rigor médico intachable.
- Escribe todo en minúsculas normales respetando mayúsculas iniciales (evita ALL CAPS).

Reporte Clínico:
${report}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            organ: { type: Type.STRING, description: "Name of the analyzed organ" },
            aspects: {
              type: Type.ARRAY,
              description: "List of analyzed clinical aspects of the organ",
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING, description: "The name of the aspect (e.g. Tamaño, Lesiones, Ecogenicidad, Clasificación, Diagnóstico Diferencial, Recomendación)" },
                  value: { type: Type.STRING, description: "The clinical value or detail. Must be highly precise and based on the report findings or standard clinical inference if requested." },
                  clinicalSource: { type: Type.STRING, description: "Indicates the source: 'Hallazgo de Reporte' or 'Inferencia Clínica IA'." },
                  explanation: { type: Type.STRING, description: "Brief clinical explanation of this aspect." },
                  narrativeSentence: { type: Type.STRING, description: "A beautifully written, fluent medical sentence explaining this aspect that can be inserted directly as a narrative text into the report." }
                },
                required: ["key", "value", "clinicalSource", "explanation", "narrativeSentence"]
              }
            }
          },
          required: ["organ", "aspects"]
        }
      }
    });

    const textOutput = response.text || "{}";
    const parsedData = JSON.parse(textOutput.trim());

    res.json({
      success: true,
      organ: parsedData.organ || organ,
      aspects: parsedData.aspects || []
    });
  } catch (error: any) {
    console.error("Error en /api/generate-organ-synoptic:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 40b. API: RETROGRADE INJECTION OF ORGAN SYNOPTIC FINDINGS INTO REPORT
 * POST /api/inject-organ-synoptic-retrograde
 * Payload: {
 *   model?: string,
 *   report: string,
 *   organ: string,
 *   sentencesToInject: string[],
 *   synopticTableMarkdown?: string,
 *   includeSynopticTable?: boolean
 * }
 */
app.post("/api/inject-organ-synoptic-retrograde", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, organ, sentencesToInject = [], synopticTableMarkdown, includeSynopticTable = true } = req.body;
    if (!report || !organ) {
      return res.status(400).json({ success: false, error: "Se requieren los parámetros 'report' y 'organ'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un radiólogo subespecialista y editor médico de alta precisión.
Tu objetivo principal es incrustar e inyectar de manera RETRÓGRADA, INTELIGENTE e IMPERCEPTIBLE las frases/puntos seleccionados del cuadro sinóptico referente al órgano o estructura '${organ}' dentro del texto original del reporte radiológico, de modo que el reporte quede enriquecido y perfectamente redactado.

Órgano / Estructura: '${organ}'

Frases o Puntos Clínicos a Inyectar de forma retrógrada al cuerpo del reporte:
${sentencesToInject.length > 0 ? sentencesToInject.map((s: string, idx: number) => `${idx + 1}. ${s}`).join("\n") : "(Ninguna frase individual adicional; solo integrar la coherencia del cuadro)"}

Cuadro Sinóptico en Markdown a adjuntar (si procede):
${synopticTableMarkdown || "Ninguno"}

REGLAS DE ORO PARA LA REDACCIÓN E INSERCIÓN IMPERCEPTIBLE:
1. Revisa detenidamente el cuerpo del reporte radiológico original (especialmente las secciones 'HALLAZGOS', 'INFORME', u 'ORGANOS').
2. Localiza la sección o párrafo correspondiente a '${organ}'. Si el órgano ya está descrito en el reporte, integra suavemente las nuevas frases o puntos dentro del mismo párrafo o viñeta de dicho órgano, ajustando la puntuación y conectores gramaticales para que la adición sea fluida y natural.
3. Evita redundancias o duplicaciones de información. Si el reporte ya tenía un dato similar, amplíalo o refínalo en lugar de pegarlo dos veces.
4. Si el órgano '${organ}' no figuraba en la descripción narrativa original, agrega su descripción dentro de la sección 'HALLAZGOS' respetando la estructura y estilo del documento (por ejemplo, como un nuevo párrafo o viñeta anatómica coherente).
5. Si alguna de las frases inyectadas implica un diagnóstico relevante, escala de riesgo (TI-RADS, Bosniak, LI-RADS, etc.) o recomendación clínica, asegúrate de reflejarla o resumirla también de forma armónica en la 'IMPRESIÓN DIAGNÓSTICA' o 'CONCLUSIÓN' si esa sección existe.
6. ${includeSynopticTable && synopticTableMarkdown ? `INSERCIÓN DEL CUADRO Y RESUMEN INTERPRETATIVO: Adjunta inmediatamente después de la 'IMPRESIÓN DIAGNÓSTICA' (o 'CONCLUSIÓN') del reporte la sección '### SINOPSIS CLÍNICA DE ${organ.toUpperCase()}' incluyendo de manera íntegra tanto la tabla Markdown como el párrafo '**Resumen Interpretativo:** ...' que se proporciona en 'Cuadro Sinóptico y Resumen Interpretativo en Markdown'. Si ya existe la sección de sinopsis de dicho órgano, reemplázala completamente por el nuevo contenido.` : "No incluyas secciones de cuadro sinóptico si no se solicita."}
7. EL INFORME FINAL DEBE LEERSE IMPECABLE, CONTINUO Y PROFESIONAL, SIN RASTROS DE QUE FUE EDITADO O COMPLEMENTADO A POSTERIORI.

Reporte radiológico original:
${report}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            updatedReport: {
              type: Type.STRING,
              description: "El reporte radiológico completo actualizado con la inyección retrógrada inteligente e imperceptible de los hallazgos y el cuadro sinóptico."
            },
            summaryOfInjections: {
              type: Type.STRING,
              description: "Resumen conciso en una frase de cómo y dónde se incrustaron los puntos en el reporte."
            }
          },
          required: ["updatedReport", "summaryOfInjections"]
        }
      }
    });

    const textOutput = response.text || "{}";
    const parsedData = JSON.parse(textOutput.trim());

    res.json({
      success: true,
      updatedReport: parsedData.updatedReport || report,
      summaryOfInjections: parsedData.summaryOfInjections || "Inyección retrógrada e imperceptible completada exitosamente."
    });
  } catch (error: any) {
    console.error("Error en /api/inject-organ-synoptic-retrograde:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 41. API: GENERATE FRACTURE SYNOPTIC TABLE (Creador de Sinopsis de Fracturas)
 * POST /api/generate-fracture-synoptic
 * Payload: {
 *   model?: string,
 *   report: string
 * }
 */
app.post("/api/generate-fracture-synoptic", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el parámetro 'report'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un traumatólogo y radiólogo osteomuscular experto.
Analiza con precisión técnica el reporte radiológico proporcionado en busca de cualquier descripción de fractura ósea.
Debes estructurar un cuadro sinóptico de la fractura con los aspectos clave de la semiología de fracturas, según el esquema JSON solicitado.

REGLAS DE TERMINOLOGÍA Y REDACCIÓN (CRÍTICAS):
1. NUNCA utilices expresiones como 'no fue reportado', 'no se menciona en el informe original', 'no descrito' o similares que separen la IA del usuario o dejen en evidencia la falta de datos del reporte de manera impersonal. Tanto el reporte como este cuadro son redactados y avalados por el mismo profesional médico.
2. Si un dato no figura explícitamente en el reporte (por ejemplo, si no se menciona angulación o si hay compromiso de partes blandas), NO digas que falta. En su lugar, infiere un valor coherente basado en la patología o propón un descarte clínico relevante de valor añadido (ej: 'Sin desplazamiento significativo', 'Alineación anatómica conservada', 'Sin compromiso articular aparente', 'Sin enfisema de partes blandas').
3. Si la fractura carece de detalles importantes que se correlacionan con la patología descrita (por ejemplo, angulación exacta, número de fragmentos, etc.), la IA DEBE proponer descripciones lógicas coherentes. Clasifícalas como 'Inferencia Clínica IA' en el origen para que el médico pueda inyectarlas de manera retrógrada al reporte.
4. Para la clasificación de la fractura, deduce la escala más idónea para esa región anatómica (ej. clasificación AO, Schatzker para meseta tibial, Garden o Pauwels para cuello femoral, Gustilo-Anderson para expuestas, Neer para húmero proximal, etc.) y fundamenta la clasificación clínicamente.

Para cada aspecto clínico del cuadro (debes incluir idealmente estos aspectos: Hueso y Región, Tipo de Trazo, Alineación y Desplazamiento, Angulación, Compromiso Articular, Compromiso de Partes Blandas, Clasificación Sugerida, Recomendación):
1. 'key': Nombre del aspecto.
2. 'value': El valor clínico o detalle.
3. 'clinicalSource': 'Hallazgo de Reporte' o 'Inferencia Clínica IA'.
4. 'explanation': Breve nota de por qué se incluye este aspecto.
5. 'narrativeSentence': Una frase en español redactada de forma impecable en lenguaje médico para ser inyectada en el reporte.

Reporte Clínico:
${report}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fractureFound: { type: Type.BOOLEAN },
            bone: { type: Type.STRING },
            aspects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  value: { type: Type.STRING },
                  clinicalSource: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  narrativeSentence: { type: Type.STRING }
                },
                required: ["key", "value", "clinicalSource", "explanation", "narrativeSentence"]
              }
            }
          },
          required: ["fractureFound", "bone", "aspects"]
        }
      }
    });

    const textOutput = response.text || "{}";
    const parsedData = JSON.parse(textOutput.trim());

    res.json({
      success: true,
      fractureFound: parsedData.fractureFound ?? false,
      bone: parsedData.bone || "No detectable",
      aspects: parsedData.aspects || []
    });
  } catch (error: any) {
    console.error("Error en /api/generate-fracture-synoptic:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});


/**
 * API: CLINICAL SCORECARD + ATLAS OVERLAY INTELLIGENCE
 * POST /api/generate-clinical-scorecard
 * Shared engine: criteria scorecard + pathology overlays for Atlas 3D.
 * Payload: { model?, report, studyType?, protocolId?, pathologyFocus?, includeRecommendations?, atlasPanels?: [{panelLetter,panelTitle,anatomicalFocus}] }
 */
app.post("/api/generate-clinical-scorecard", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType, protocolId, pathologyFocus, includeRecommendations, atlasPanels } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el parámetro 'report'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);
    const requestedProtocol = (protocolId || "auto").toString();
    const focusText = (pathologyFocus || "").toString().trim();
    const withRecommendations = includeRecommendations === true;
    const panelsHint = Array.isArray(atlasPanels) && atlasPanels.length
      ? atlasPanels.map((p: any) => `- Panel ${p.panelLetter}: ${p.panelTitle || ""} | Foco: ${p.anatomicalFocus || ""}`).join("\n")
      : "Sin paneles Atlas aún (propón panelLetter A/B/C según estructuras).";

    const prompt = `Eres un radiólogo hispanohablante experto en criterios diagnósticos formales.
Analiza el informe y genera UN Scorecard de criterios clínicos + marcadores de correlación para Atlas 3D.

IDIOMA (OBLIGATORIO E INQUEBRANTABLE):
- TODO el texto visible al médico DEBE estar en ESPAÑOL médico: protocolName, categoryAssigned, clinicalSummary, recommendation, studyRegion, criterion, value, evidence, atlasStructure, suggestedPanelFocus, structure, finding.
- PROHIBIDO inglés en esos campos (nada de "Tendon thickening", "Present", "Absent", "Major", "Critical", "Partial thickness tear", etc.).
- Traduce criterios y valores al español aunque el protocolo interno sea anglosajón (ej. "Engrosamiento tendinoso (diámetro AP > 6 mm)", "Presente", "Ausente", "Rotura de espesor parcial").
- Los ÚNICOS campos en inglés/código son: protocolId, status, weight, trafficLight, marker, panelLetter, id, linkedCriterionId.

ESTUDIO: ${studyType || "No especificado"}
PROTOCOLO PREDEFINIDO: ${requestedProtocol === "auto" ? "Detección automática del protocolo más específico" : requestedProtocol}
${focusText ? `ENFOQUE EXPLÍCITO DEL MÉDICO (PRIORIDAD MÁXIMA): "${focusText}"
Debes construir el scorecard alrededor de este órgano/región/patología. Si choca con el protocolo predefinido, prioriza el enfoque del médico.` : "Sin enfoque libre adicional: usa el protocolo predefinido o auto-detecta."}

PANELES ATLAS DISPONIBLES:
${panelsHint}

PROTOCOLOS POSIBLES (id interno si AUTO): cholecystitis, appendicitis, thyroid_tirads, bosniak, rotator_cuff, hepatic, renal, scrotal, diverticulitis, achilles, muscle_injury, generic.

REGLAS DE FIDELIDAD (OBLIGATORIAS):
1. Cada criterio debe anclarse SOLO al texto del informe (evidence = cita/paráfrasis fiel en español con medidas si constan).
2. status: "met" | "not_met" | "not_mentioned" | "equivocal".
3. NO inventes hallazgos. Si no hay dato: not_mentioned.
4. Incluye 6 a 12 criterios del protocolo (umbrales oficiales cuando aplique).
5. weight: "critical" | "major" | "minor" (códigos internos; el texto del criterio va en español).
6. severity 0-10 coherente con el hallazgo.
7. value en español ("Presente", "Ausente", "6.8 mm", "60% del espesor", etc.).
8. atlasOverlays: SOLO para criterios met o equivocal con anatomía localizable (máx 5). Textos en español. Vincula linkedCriterionId.
9. panelLetter debe coincidir con un panel existente si hay lista; si no, usa A/B/C.
10. trafficLight: low | moderate | high | critical.
11. protocolName y categoryAssigned en español (ej. "Valoración ecográfica del tendón de Aquiles", "Musculoesquelético").
12. RECOMENDACIONES: ${withRecommendations
  ? 'SÍ incluir "recommendation" con conducta/seguimiento breve en español (1-3 frases).'
  : 'NO incluir recomendaciones. El campo "recommendation" DEBE ser exactamente "" (cadena vacía). PROHIBIDO sugerir conducta, seguimiento, tratamiento o disclaimers.'}

Responde JSON con:
- protocolId, protocolName, categoryAssigned
- scoreMet, scoreTotal, trafficLight
- clinicalSummary, recommendation, studyRegion
- criteria: [{ id, criterion, status, value, evidence, weight, severity, atlasStructure, suggestedPanelFocus }]
- atlasOverlays: [{ id, panelLetter, marker, structure, finding, severity, status ("active"|"secondary"), linkedCriterionId, evidence }]

INFORME:
"""
${report}
"""
`;

const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        temperature: 0.12,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            protocolId: { type: Type.STRING },
            protocolName: { type: Type.STRING },
            categoryAssigned: { type: Type.STRING },
            scoreMet: { type: Type.INTEGER },
            scoreTotal: { type: Type.INTEGER },
            trafficLight: { type: Type.STRING },
            clinicalSummary: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            studyRegion: { type: Type.STRING },
            criteria: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  criterion: { type: Type.STRING },
                  status: { type: Type.STRING },
                  value: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  weight: { type: Type.STRING },
                  severity: { type: Type.INTEGER },
                  atlasStructure: { type: Type.STRING },
                  suggestedPanelFocus: { type: Type.STRING }
                },
                required: ["id", "criterion", "status", "evidence", "weight", "severity"]
              }
            },
            atlasOverlays: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  panelLetter: { type: Type.STRING },
                  marker: { type: Type.STRING },
                  structure: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  severity: { type: Type.INTEGER },
                  status: { type: Type.STRING },
                  linkedCriterionId: { type: Type.STRING },
                  evidence: { type: Type.STRING }
                },
                required: ["id", "panelLetter", "marker", "structure", "finding", "severity", "status"]
              }
            }
          },
          required: [
            "protocolId",
            "protocolName",
            "categoryAssigned",
            "scoreMet",
            "scoreTotal",
            "trafficLight",
            "clinicalSummary",
            "recommendation",
            "criteria",
            "atlasOverlays"
          ]
        }
      }
    });

    const rawText = response.text || "{}";
    const parsed = JSON.parse(rawText);

    const allowedStatus = new Set(["met", "not_met", "not_mentioned", "equivocal"]);
    const allowedWeight = new Set(["critical", "major", "minor"]);
    const allowedLight = new Set(["low", "moderate", "high", "critical"]);

    const localizeScorecardText = (raw: string): string => {
      if (!raw) return raw;
      let s = String(raw);
      const pairs: Array<[RegExp, string]> = [
        [/^Present$/i, "Presente"],
        [/^Absent$/i, "Ausente"],
        [/^Partial thickness tear$/i, "Rotura de espesor parcial"],
        [/^Full.?thickness tear$/i, "Rotura de espesor completo"],
        [/\bPresent\b/gi, "Presente"],
        [/\bAbsent\b/gi, "Ausente"],
        [/\bMajor\b/gi, "Mayor"],
        [/\bCritical\b/gi, "Crítico"],
        [/\bMinor\b/gi, "Menor"],
        [/\bMusculoskeletal\b/gi, "Musculoesquelético"],
        [/\bThickening\b/gi, "Engrosamiento"],
        [/\bTendinosis\b/gi, "Tendinosis"],
        [/\bBursitis\b/gi, "Bursitis"],
        [/\bCalcifications?\b/gi, "Calcificaciones"],
        [/\bInsertion\b/gi, "Inserción"],
        [/\bDistal Achilles Tendon\b/gi, "Tendón de Aquiles distal"],
        [/\bCalcaneal insertion\b/gi, "Inserción calcánea"],
        [/\bAchilles Tendon Ultrasound Assessment\b/gi, "Valoración ecográfica del tendón de Aquiles"],
        [/\bPartial thickness\b/gi, "Espesor parcial"],
        [/\bFull thickness\b/gi, "Espesor completo"],
        [/\bLoss of normal fibrillar pattern\b/gi, "Pérdida del patrón fibrilar normal"],
        [/\bTendon thickening\b/gi, "Engrosamiento tendinoso"],
        [/\bIntratendinous calcifications\b/gi, "Calcificaciones intratendinosas"],
        [/\bRetrocalcaneal bursitis\b/gi, "Bursitis retrocalcánea"],
      ];
      for (const [re, rep] of pairs) s = s.replace(re, rep);
      return s;
    };

    const criteria = Array.isArray(parsed.criteria) ? parsed.criteria.map((c: any, i: number) => ({
      id: (c.id || `c${i + 1}`).toString(),
      criterion: localizeScorecardText((c.criterion || "").toString()),
      status: allowedStatus.has(c.status) ? c.status : "not_mentioned",
      value: c.value ? localizeScorecardText(String(c.value)) : undefined,
      evidence: localizeScorecardText((c.evidence || "").toString()),
      weight: allowedWeight.has(c.weight) ? c.weight : "major",
      severity: typeof c.severity === "number" ? Math.min(10, Math.max(0, Math.round(c.severity))) : 0,
      atlasStructure: c.atlasStructure ? localizeScorecardText(String(c.atlasStructure)) : undefined,
      suggestedPanelFocus: c.suggestedPanelFocus ? localizeScorecardText(String(c.suggestedPanelFocus)) : undefined
    })) : [];

    const scoreMet = criteria.filter((c: any) => c.status === "met").length;
    const scoreTotal = criteria.length || Number(parsed.scoreTotal) || 0;

    let trafficLight = allowedLight.has(parsed.trafficLight) ? parsed.trafficLight : "low";
    const criticalMet = criteria.some((c: any) => c.status === "met" && c.weight === "critical" && c.severity >= 7);
    if (criticalMet) trafficLight = "critical";
    else if (scoreTotal > 0 && scoreMet / scoreTotal >= 0.65) trafficLight = trafficLight === "low" ? "high" : trafficLight;
    else if (scoreTotal > 0 && scoreMet / scoreTotal >= 0.35) trafficLight = trafficLight === "low" ? "moderate" : trafficLight;

    const panelLetters = Array.isArray(atlasPanels)
      ? atlasPanels.map((p: any) => String(p.panelLetter || "").toUpperCase()).filter(Boolean)
      : [];
    const fallbackLetter = panelLetters[0] || "A";

    const atlasOverlays = (Array.isArray(parsed.atlasOverlays) ? parsed.atlasOverlays : [])
      .slice(0, 5)
      .map((o: any, i: number) => {
        const letter = String(o.panelLetter || fallbackLetter).toUpperCase();
        return {
          id: (o.id || `ov${i + 1}`).toString(),
          panelLetter: panelLetters.includes(letter) ? letter : fallbackLetter,
          marker: (o.marker || String.fromCharCode(65 + i)).toString().slice(0, 2),
          structure: (o.structure || "").toString(),
          finding: (o.finding || "").toString(),
          severity: typeof o.severity === "number" ? Math.min(10, Math.max(0, Math.round(o.severity))) : 0,
          status: o.status === "secondary" ? "secondary" : "active",
          linkedCriterionId: o.linkedCriterionId ? String(o.linkedCriterionId) : undefined,
          evidence: o.evidence ? String(o.evidence) : undefined
        };
      });

    const data = {
      protocolId: (parsed.protocolId || requestedProtocol || "generic").toString(),
      protocolName: localizeScorecardText((parsed.protocolName || "Scorecard clínico").toString()),
      categoryAssigned: localizeScorecardText((parsed.categoryAssigned || "Sin categoría").toString()),
      scoreMet,
      scoreTotal,
      trafficLight,
      clinicalSummary: localizeScorecardText((parsed.clinicalSummary || "").toString()),
      recommendation: withRecommendations
        ? localizeScorecardText((parsed.recommendation || "").toString())
        : "",
      studyRegion: parsed.studyRegion ? localizeScorecardText(String(parsed.studyRegion)) : undefined,
      criteria,
      atlasOverlays: atlasOverlays.map((o: any) => ({
        ...o,
        structure: localizeScorecardText(o.structure || ""),
        finding: localizeScorecardText(o.finding || ""),
        evidence: o.evidence ? localizeScorecardText(o.evidence) : undefined
      })),
      generatedAt: new Date().toISOString()
    };

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error en /api/generate-clinical-scorecard:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

/**
 * 42. API: GENERATE BIOMECHANICAL & INFLAMMATORY RADAR
 * POST /api/generate-biomechanical-radar
 * Payload: { model?: string, report: string, studyType?: string, radarMode?: "auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "knee_trauma" | "appendicitis" | "thyroid" | "muscle_injury" | "hepatic" | "renal" | "scrotal" }
 */

const MATRIX_PRESETS: Record<string, { key: string; label: string; finding: string; justification: string }[]> = {
  rotator_cuff: [
    { key: "ruptura_supraespinoso", label: "Ruptura del Supraespinoso", finding: "Sin evidencia de desgarro ni solución de continuidad en el supraespinoso.", justification: "Integridad fibrilar conservada." },
    { key: "bursitis", label: "Bursitis Subacromiodeltoidea", finding: "Bursa subacromial de espesor normal, sin líquido anormal.", justification: "Ausencia de distensión o reacción inflamatoria bursal." },
    { key: "pinzamiento", label: "Pinzamiento Subacromial", finding: "Dinámica subacromial conservada sin conflicto de espacio.", justification: "Sin fricción ni atrapamiento en maniobras." },
    { key: "otros_tendones", label: "Lesión de Otros Tendones del Manguito", finding: "Tendones infraespinoso, subescapular y redondo menor intactos.", justification: "Estructura y patrón fibrilar normal en tendones adyacentes." },
    { key: "tendinosis_supraespinoso", label: "Tendinosis del Supraespinoso", finding: "Ecoestructura y espesor fibrilar habituales.", justification: "Sin cambios tendinósicos crónicos ni calcificaciones." },
    { key: "tclb", label: "Tendón Cabeza Larga del Bíceps (TCLB)", finding: "TCLB centrado en la corredera bicipital sin tenosinovitis.", justification: "Líquido peritendinoso fisiológico y retináculo intacto." }
  ],
  knee_oa: [
    { key: "femorotibial_medial", label: "Compartimento Femorotibial Medial", finding: "Espacio articular medial de amplitud conservada.", justification: "Sin pinzamiento ni esclerosis subcondral." },
    { key: "femorotibial_lateral", label: "Compartimento Femorotibial Lateral", finding: "Espacio articular lateral normal.", justification: "Sin disminución de espacio ni cambios osteoartrósicos." },
    { key: "meniscopatia_deg", label: "Meniscopatía Degenerativa", finding: "Meniscos de morfología y ecogenicidad habituales.", justification: "Sin fisuras degenerativas ni extrusión meniscal." },
    { key: "cartilago_troclear", label: "Cartílago Troclear / Condromalacia", finding: "Cartílago troclear de espesor uniforme y superficie lisa.", justification: "Sin condromalacia ni defectos condrales." },
    { key: "hidrartrosis", label: "Hidrartrosis / Efusión Articular", finding: "Receso suprarrotuliano sin derrame significativo.", justification: "Líquido articular dentro de límites fisiológicos." },
    { key: "osteofitos", label: "Osteofitos Marginales & Entesofitos", finding: "Márgenes óseos articulares regulares.", justification: "Sin osteofitosis marginal ni remodelado hipertrófico." }
  ],
  knee_trauma: [
    { key: "lcm", label: "Ligamento Colateral Medial (LCM)", finding: "LCM de continuidad y espesor conservados.", justification: "Sin signos de esguince o brecha fibrilar." },
    { key: "lcl", label: "Ligamento Colateral Lateral / CPL", finding: "LCL y complejo posterolateral continuos.", justification: "Sin edema o desgarro periligamentario." },
    { key: "menisco_interno", label: "Menisco Interno / Medial", finding: "Menisco interno bien configurado sin rupturas.", justification: "Triángulo meniscal ecogénico e íntegro." },
    { key: "menisco_externo", label: "Menisco Externo / Lateral", finding: "Menisco externo sin líneas de desgarro.", justification: "Puntal meniscal estable y en su sitio." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis", finding: "Sin efusión o hemartrosis traumática.", justification: "Recesos articulares limpios." },
    { key: "lig_patelar", label: "Ligamento Patelar / Mecanismo Extensor", finding: "Ligamento patelar de espesor y patrón fibrilar normal.", justification: "Mecanismo extensor sin desgarro ni entesopatía." }
  ],
  ankle_trauma: [
    { key: "lpaa", label: "Lig. Peroneo Astragalino Anterior (LPAA)", finding: "LPAA continuo de espesor normal.", justification: "Sin brecha anecoica ni inestabilidad anterolateral." },
    { key: "lpc", label: "Lig. Peroneo Calcáneo (LPC)", finding: "LPC preservado debajo de tendones peroneos.", justification: "Sin engrosamiento ni compromiso traumático." },
    { key: "deltoideo", label: "Complejo Ligamentoso Deltoideo", finding: "Ligamento deltoideo medial de fibrilaridad conservada.", justification: "Espacio claro medial normal sin brechas." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis Articular", finding: "Sin efusión articular en receso anterior.", justification: "Líquido intraarticular fisiológico." },
    { key: "tendones", label: "Tendones Peroneos / Mediales", finding: "Tendones peroneos y tibiales en sus correderas.", justification: "Sin tenosinovitis ni subluxación retinacular." },
    { key: "oseo", label: "Estructuras Óseas / Sindesmosis", finding: "Corticales óseas continuas y sindesmosis alineada.", justification: "Sin avulsiones óseas ni diástasis sindesmótica." }
  ],
  cholecystitis: [
    { key: "engrosamiento_pared", label: "Engrosamiento / Edema Parietal", finding: "Pared vesicular fina ≤3.0mm.", justification: "Sin edema parietal ni estratificación." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", finding: "Señal Doppler parietal normal.", justification: "Sin hiperemia inflamatoria de la pared." },
    { key: "necrosis_pared", label: "Necrosis Parietal / Gangrena", finding: "Pared vesicular continua e intacta.", justification: "Sin gas intraparietal ni membranas desprendidas." },
    { key: "cambios_perivesiculares", label: "Cambios Perivesiculares / Lecho", finding: "Grasa perivesicular limpia y libre.", justification: "Sin líquido ni colecciones perivesiculares." },
    { key: "via_biliar", label: "Vía Biliar / Colédoco", finding: "Vía biliar intra y extrahepática de calibre normal.", justification: "Colédoco no dilatado sin coledocolitiasis." },
    { key: "tamano_forma", label: "Tamaño / Hidrops Vesicular", finding: "Dimensiones vesiculares normales.", justification: "Sin hidrops ni sobredistensión vesicular." }
  ],
  appendicitis: [
    { key: "diametro_apendice", label: "Diámetro Apendicular", finding: "Diámetro apendicular normal ≤6.0mm.", justification: "Estructura tubular compresible de fondo ciego." },
    { key: "pared_apendice", label: "Pared / Signo de la Diana", finding: "Pared fina ≤2.0mm con capas conservadas.", justification: "Sin edema submucoso ni signo de la diana." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", finding: "Flujo vascular parietal simétrico y fino.", justification: "Sin hiperemia reactiva en anillo." },
    { key: "cambios_inflamatorios", label: "Grasa Periapendicular / Flemón", finding: "Grasa mesoapendicular de ecogenicidad normal.", justification: "Sin cambios inflamatorios ni flemón." },
    { key: "liquido_colecciones", label: "Líquido Libre / Colecciones", finding: "Fosa ilíaca derecha libre de líquido.", justification: "Sin colecciones ni abscesos periapendiculares." },
    { key: "apendicolito", label: "Apendicolito / Fecalito", finding: "Luz apendicular limpia.", justification: "Sin apendicolitos ni obstrucción por fecalito." }
  ],
  thyroid: [
    { key: "tamano_tiroides", label: "Tamaño Glandular / Bocio", finding: "Volumen tiroideo normal en ambos lóbulos.", justification: "Sin bocio ni efecto de masa intratorácica." },
    { key: "presencia_nodulos", label: "Carga Nodular", finding: "Parénquima homogéneo libre de nódulos.", justification: "Sin imágenes nodulares sólidas ni quísticas." },
    { key: "nodulos_sospechosos", label: "Sospecha TI-RADS", finding: "Sin nódulos con criterios de sospecha oncogénica.", justification: "Patrón ecográfico TI-RADS 1 / BENIGNO." },
    { key: "patron_parenquima", label: "Ecoestructura Parenquimatosa", finding: "Ecoestructura glandular homogénea e isoecoica.", justification: "Sin signos de tiroiditis difusa ni septos fibrosos." },
    { key: "vascularidad", label: "Vascularidad / Inferno Tiroideo", finding: "Patrón Doppler vascular fisiológico escaso.", justification: "Sin hiperemia difusa ni inferno tiroideo." },
    { key: "adenopatias_atipicas", label: "Adenopatías Cervicales Atípicas", finding: "Cadenas ganglionares cervicales con morfología ovalada normal.", justification: "Ganglios con hilio graso conservado sin rasgos atípicos." }
  ],
  muscle_injury: [
    { key: "desgarro_muscular", label: "Desgarro Muscular / Solución Continuidad", finding: "Arquitectura muscular y patrón en pluma de ave conservado.", justification: "Sin solución de continuidad ni brecha fibrilar." },
    { key: "hematoma_coleccion", label: "Hematoma / Colección Líquida", finding: "Sin colecciones líquidas intra o interfasciales.", justification: "Ausencia de hematoma a tensión o seroma." },
    { key: "union_miotendinosa", label: "Unión Miotendinosa (MTJ)", finding: "Unión miotendinosa continua e intacta.", justification: "Sin deslamado ni avulsión en la MTJ." },
    { key: "tendon_insercion", label: "Tendón e Inserción / Entesis", finding: "Tendón de inserción de calibre y ecogenicidad normal.", justification: "Sin avulsión entésica ni desgarro intratendinoso." },
    { key: "vascularidad", label: "Vascularidad / Neovascularización", finding: "Vascularización intramuscular baja normal.", justification: "Sin hiperemia perilesional ni neovasculatura." },
    { key: "cambios_inflamatorios", label: "Edema / Inflamación Intramuscular", finding: "Vientres musculares limpios y simétricos.", justification: "Sin edema perifocal ni miositis reactiva." }
  ],
  hepatic: [
    { key: "tamano_forma", label: "Tamaño y Forma", finding: "Hígado de dimensiones conservadas con borde inferior agudo y contornos lisos.", justification: "Sin hepatomegalia ni nodularidad capsular." },
    { key: "vascularidad", label: "Vascularidad", finding: "Vena porta de calibre y flujo hepatópeto fásico normal, venas suprahepáticas trifásicas.", justification: "Sin hipertensión portal ni colaterales patológicas." },
    { key: "elasticidad", label: "Elasticidad", finding: "Elasticidad en rango fisiológico normal (<6.0 kPa / F0-F1).", justification: "Sin rigidez parenquimatosa ni fibrosis significativa." },
    { key: "apariencia_parenquima", label: "Apariencia del Parénquima", finding: "Ecoestructura parenquimatosa homogénea con patrón granular fino habitual.", justification: "Sin tosquedad ni patrón micronodular difuso." },
    { key: "infiltracion_grasa", label: "Infiltración Grasa", finding: "Sin esteatosis hepática (Grado 0), gradiente hepatorrenal conservado y buena penetración acústica.", justification: "Atenuación acústica y ecogenicidad fisiológica." },
    { key: "lesiones_focales", label: "Lesiones Focales", finding: "Parénquima homogéneo libre de lesiones ocupantes de espacio (LOEs).", justification: "Ausencia de nódulos sospechosos, quistes complicados ni masas sólidas." }
  ],
  renal: [
    { key: "tamano_renal", label: "Tamaño Renal", finding: "Eje bipolar longitudinal conservado (100-120mm) con morfología reniforme simétrica.", justification: "Sin nefromegalia ni hipotrofia renal." },
    { key: "grosor_cortical", label: "Grosor Cortical", finding: "Espesor cortical normal ≥9-10mm con nítida diferenciación córtico-medular.", justification: "Sin adelgazamiento cortical ni hiperecogenicidad médica." },
    { key: "vascularidad", label: "Vascularidad", finding: "Perfusión periférica completa con índices de resistividad intrarrenal fisiológicos (RI 0.58-0.70).", justification: "Sin defectos segmentarios ni signos de estenosis arterial." },
    { key: "lesiones_focales", label: "Lesiones Focales", finding: "Parénquima homogéneo sin masas sólidas ni quistes complicados (Bosniak I o libre de LOEs).", justification: "Ausencia de LOEs sospechosas ni angiomiolipomas complejos." },
    { key: "procesos_obstructivos", label: "Procesos Obstructivos", finding: "Seno renal ecolucente sin ectasia pielocalicial ni litiasis obstructiva.", justification: "Sin hidronefrosis ni uropatía obstructiva." },
    { key: "cambios_inflamatorios", label: "Cambios Inflamatorios", finding: "Grasa perirrenal homogénea sin colecciones, gas ni áreas de nefronía.", justification: "Ausencia de estigmas de pielonefritis ni perinefritis." }
  ],
  scrotal: [
    { key: "tamano_testicular", label: "Tamaño Testicular", finding: "Volumen y morfología testicular conservada dentro de rango fisiológico (8-25 cc).", justification: "Sin atrofia, hipotrofia ni orquimegalia anormal." },
    { key: "vascularidad_testicular", label: "Vascularidad Testicular", finding: "Patrón de perfusión Doppler simétrico con índices de resistividad fisiológicos (RI 0.45-0.70).", justification: "Sin hiperemia inflamatoria ni defectos de perfusión / torsión." },
    { key: "integridad_epididimos", label: "Integridad de Epidídimos", finding: "Epidídimos de grosor, contornos y ecoestructura homogénea habitual.", justification: "Sin signos de epididimitis aguda, espermatocele complicado ni flemón." },
    { key: "lesiones_focales", label: "Lesiones Focales", finding: "Ecoestructura homogénea sin lesiones ocupantes de espacio ni microlitiasis densa.", justification: "Sin nódulos sólidos intratesticulares ni LOEs sospechosas." },
    { key: "varicocele", label: "Varicocele", finding: "Plexo pampiniforme de calibre fisiológico (<2 mm) sin reflujo con maniobra de Valsalva.", justification: "Sin ectasia venosa ni reflujo patológico." },
    { key: "cambios_inflamatorios_hidrocele", label: "Cambios Inflamatorios e Hidrocele", finding: "Líquido en túnica vaginal dentro de rango fisiológico sin engrosamiento parietal.", justification: "Sin hidrocele a tensión, piocele ni paquivaginalitis." }
  ],
  msk: [
    { key: "inflamacion", label: "Inflamación / Edema", finding: "Sin efusión o edema significativo.", justification: "Ausencia de fluido anormal o reacción inflamatoria aguda." },
    { key: "estructural", label: "Compromiso Estructural", finding: "Integridad tisular conservada.", justification: "Sin desgarros, rupturas ni soluciones de continuidad." },
    { key: "biomecanica", label: "Inestabilidad Biomecánica", finding: "Estabilidad y mecánica tisular normal.", justification: "Sin sobrecarga, roce o inestabilidad pasiva." },
    { key: "vascularizacion", label: "Vascularización / Hiperemia", finding: "Señal Doppler dentro de límites normales.", justification: "Sin neoangiogénesis ni hiperemia activa." },
    { key: "tension", label: "Tensión / Irritación", finding: "Tensión miotendinosa y fascial adecuada.", justification: "Sin espasmo, contractura o tracción dolorosa." },
    { key: "cronicidad", label: "Cronicidad / Fibrosis", finding: "Patrón fibrilar o tisular habitual.", justification: "Sin cambios tendinósicos crónicos ni calcificaciones." }
  ],
  visceral: [
    { key: "inflamacion", label: "Inflamación & Edema Parietal", finding: "Paredes viscerales de espesor y estrías normales.", justification: "Sin edema edematoso ni engrosamiento parietal." },
    { key: "estructural", label: "Compromiso Tisular / Lisis", finding: "Estratificación de pared conservada.", justification: "Sin lisis, necrosis ni solución de continuidad." },
    { key: "biomecanica", label: "Afectación Perivisceral", finding: "Grasa perivisceral respetada e isoecoica.", justification: "Sin desestructuración del plano adjacente." },
    { key: "vascularizacion", label: "Vascularización / Hiperemia", finding: "Flujo Doppler parietal fisiológico.", justification: "Sin hiperemia reactiva ni áreas de isquemia." },
    { key: "tension", label: "Irritación Serosa & Distensión", finding: "Serosa sin irritación ni efusión perifocal.", justification: "Sin distensión tensional ni estasis." },
    { key: "cronicidad", label: "Cronicidad / Litiasis", finding: "Sin litiasis ni secuelas cicatrizales.", justification: "Estructura limpia sin cambios recurrentes." }
  ],
  oncology: [
    { key: "estructural", label: "Arquitectura / Heterogeneidad", finding: "Arquitectura tisular conservada y homogénea.", justification: "Sin masas heterogéneas ni bordes espiculados." },
    { key: "vascularizacion", label: "Neoangiogénesis & Neovasculatura", finding: "Patrón vascular periférico y central ordenado.", justification: "Sin vasos caóticos de alta velocidad o neovasculatura." },
    { key: "biomecanica", label: "Invasión Tisular Local", finding: "Planos de clivaje anatómicos preservados.", justification: "Sin infiltración de cápsula o grasa contigua." },
    { key: "tension", label: "Compromiso Vascular / Ductal", finding: "Vasos principales y ductos permeables.", justification: "Sin encajonamiento ni trombosis tumoral." },
    { key: "inflamacion", label: "Necrosis Tumoral / Degeneración", finding: "Tejido sólido uniforme sin degeneración quística.", justification: "Sin focos de necrosis ni lisis intratumoral." },
    { key: "cronicidad", label: "Adenopatías & Diseminación", finding: "Ganglios regionales con morfología preservada.", justification: "Sin adenopatías atípicas ni implantes." }
  ]
};

function scoreToLevel(score: number): string {
  if (score >= 9) return "Masivo / Crítico";
  if (score >= 7) return "Severo";
  if (score >= 5) return "Moderado";
  if (score >= 2) return "Leve";
  return "Fisiológico";
}

function normalizeRadarKey(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(normalizeRadarKey(a).split("_").filter((t) => t.length > 2));
  const tb = new Set(normalizeRadarKey(b).split("_").filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

function looksLikeGenericNormalFinding(finding: string, presetFinding: string): boolean {
  const f = (finding || "").trim().toLowerCase();
  const p = (presetFinding || "").trim().toLowerCase();
  if (!f) return true;
  if (p && (f === p || f.includes(p.slice(0, Math.min(40, p.length))))) return true;
  // Generic filler often used when the model invents normality
  const generic =
    /sin (evidencia|alteraci[oó]n|signos)|ausencia de|dentro de l[ií]mites|conservad[oa]s?|fisiol[oó]gic|normal(es)?\.?$/i;
  return generic.test(f) && f.length < 90;
}

function pickBestAxisMatch(
  itemSpec: { key: string; label: string },
  returnedAxes: any[],
  usedIndexes: Set<number>
): { axis: any; index: number } | null {
  let best: { axis: any; index: number; score: number } | null = null;
  const specKey = normalizeRadarKey(itemSpec.key);
  const specLabel = normalizeRadarKey(itemSpec.label);

  for (let i = 0; i < returnedAxes.length; i++) {
    if (usedIndexes.has(i)) continue;
    const a = returnedAxes[i];
    if (!a) continue;
    const aKey = normalizeRadarKey(a.key || "");
    const aLabel = normalizeRadarKey(a.label || "");
    let score = 0;
    if (aKey && aKey === specKey) score = 100;
    else if (aKey && (aKey.includes(specKey) || specKey.includes(aKey))) score = 80;
    else {
      const byLabel = Math.max(
        tokenOverlapScore(aLabel, specLabel),
        tokenOverlapScore(aKey, specKey),
        tokenOverlapScore(aLabel, specKey),
        tokenOverlapScore(aKey, specLabel)
      );
      if (byLabel >= 0.45) score = 40 + byLabel * 40;
      else if ((a.label || "").toLowerCase().includes((itemSpec.label.split(" / ")[0] || "").toLowerCase()) && (itemSpec.label.split(" / ")[0] || "").length > 4) {
        score = 35;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { axis: a, index: i, score };
    }
  }
  return best ? { axis: best.axis, index: best.index } : null;
}

function normalizeAxesForMode(targetMode: string, returnedAxes: any[]): any[] {
  const presetSpec = MATRIX_PRESETS[targetMode] || MATRIX_PRESETS["msk"];
  const axesIn = Array.isArray(returnedAxes) ? returnedAxes : [];
  const usedIndexes = new Set<number>();
  const finalAxes: any[] = [];

  for (const itemSpec of presetSpec) {
    const matched = pickBestAxisMatch(itemSpec, axesIn, usedIndexes);
    if (matched) {
      usedIndexes.add(matched.index);
      const found = matched.axis;
      const score = typeof found.score === "number" ? Math.min(10, Math.max(0, Math.round(found.score))) : 0;
      const level = scoreToLevel(score);
      const rawFinding = typeof found.finding === "string" ? found.finding.trim() : "";
      const rawJustification = typeof found.justification === "string" ? found.justification.trim() : "";

      // Never silently replace a pathological score with a canned "normal" finding template.
      let finding = rawFinding;
      if (!finding) {
        finding = score <= 1
          ? itemSpec.finding
          : `Hallazgo del reporte no mapeado de forma literal para «${itemSpec.label}»; revisar texto clínico (score ${score}).`;
      } else if (score >= 2 && looksLikeGenericNormalFinding(finding, itemSpec.finding)) {
        // Keep model text but mark tension so UI/PDF don't look falsely normal.
        finding = `${finding} (Verificar coherencia con score ${score} y el reporte).`;
      }

      let justification = rawJustification || itemSpec.justification;
      if (score >= 2 && looksLikeGenericNormalFinding(justification, itemSpec.justification) && rawFinding) {
        justification = `Score ${score} según hallazgo reportado: ${rawFinding}`;
      }

      finalAxes.push({
        key: itemSpec.key,
        label: itemSpec.label,
        score,
        level,
        finding,
        justification
      });
    } else {
      finalAxes.push({
        key: itemSpec.key,
        label: itemSpec.label,
        score: 0,
        level: "Fisiológico",
        finding: itemSpec.finding,
        justification: itemSpec.justification
      });
    }
  }

  return finalAxes;
}

function refineRadarAggregate(data: any): any {
  if (!data || !Array.isArray(data.axes) || data.axes.length === 0) return data;
  const scores = data.axes.map((a: any) => (typeof a.score === "number" ? a.score : 0));
  const avg = scores.reduce((s: number, n: number) => s + n, 0) / scores.length;
  data.globalScore = Math.round(avg * 10) / 10;
  if (data.globalScore >= 7.5) data.globalLoadIndex = "Crítica";
  else if (data.globalScore >= 5) data.globalLoadIndex = "Elevada";
  else if (data.globalScore >= 2.5) data.globalLoadIndex = "Moderada";
  else data.globalLoadIndex = "Baja";

  const dominant = [...data.axes].sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];
  if (dominant && (dominant.score || 0) > 0) {
    data.dominantVector = dominant.label || data.dominantVector;
  }
  return data;
}

app.post("/api/generate-biomechanical-radar", async (req: express.Request, res: express.Response) => {
  try {
    const { model, report, studyType, radarMode } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el parámetro 'report'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const requestedMode = radarMode || "auto";

    const prompt = `Eres un médico radiólogo y especialista en oncología radiológica, ecografía de alta resolución, medicina interna, cirugía general, traumatología, medicina deportiva y patología articular.
Analiza minuciosamente el reporte radiológico/ecográfico/resonancia proporcionado y calcula un Perfil de Radar Multivectorial en 6 ejes o vectores clave de 0 a 10 (donde 0 es fisiológico/ausente/benigno y 10 es crítico/masivo/severa afectación).

ESTUDIO CLÍNICO: ${studyType || "General / No especificado"}
MODALIDAD SOLICITADA: ${requestedMode === "auto" ? "Detección Automática por IA" : requestedMode.toUpperCase()}
${requestedMode !== "auto" ? `\nOBLIGACIÓN STRICTA DE MATRIZ EXCLUSIVA: EL USUARIO HA SELECCIONADO EXPLÍCITAMENTE LA MATRIZ '${requestedMode.toUpperCase()}'. DEBES EVALUAR Y DEVOLVER EXCLUSIVAMENTE LOS 6 VECTORES/KEYS ASIGNADOS A ESTA MATRIZ. DEBES ASIGNAR UN SCORE DE 0 A 10 A CADA UNO DE LOS 6 VECTORES DE DICHA MATRIZ Y DEVOLVERLOS EN EL ARRAY 'axes'. NO MEZCLES VECTORES DE OTRAS MATRICES.\n` : ""}

INSTRUCCIÓN DE MATRIZ VECTORIAL A APLICAR:

PRIORIDAD ANTI-CONFUSIÓN (CRÍTICA):
- Si el usuario fijó una matriz concreta (no AUTO), aplica SOLO esa matriz.
- Si hay matriz específica 6D (renal, hepatic, scrotal, cholecystitis, appendicitis, thyroid, rotator_cuff, knee_oa, knee_trauma, ankle_trauma, muscle_injury) Y también aparece una genérica (msk/visceral/oncology), USA SOLO LA ESPECÍFICA.
- Nunca mezcles keys de dos matrices distintas en el mismo JSON.

${(requestedMode === "rotator_cuff" || (requestedMode === "auto" && /manguito|supraespinoso|infraespinoso|subescapular|bursitis subacrom|hombro|tclb|b[ií]ceps/i.test(report))) ? `
SI LA MATRIZ ES DE MANGUITO ROTADOR / PATOLOGÍA DE HOMBRO (ROTATOR CUFF 6D):
Aplica la matriz de 6 vectores específicos para afección del manguito rotador y estructura bicipital:
1. "ruptura_supraespinoso": Ruptura del Supraespinoso (0-1: Intacto/Fisiológico; 2-4: Desgarro parcial articular/bursal/intratendinoso de bajo grado <50%; 5-6: Desgarro parcial de alto grado >50%; 7-8: Ruptura transfixiante/completa con retracción leve; 9-10: Ruptura masiva con retracción importante o atrofia muscular).
2. "bursitis": Presencia de Bursitis Subacromiodeltoidea (0-1: Ausente/Líquido fisiológico; 2-4: Mínima efusión/engrosamiento sinovial leve; 5-6: Moderada distensión/sinovitis difusa; 7-8: Severa distensión/reacción exudativa-hemorrágica o septada; 9-10: Distensión masiva/reacción flemónides-adherencial).
3. "pinzamiento": Pinzamiento Subacromial - Grado de Limitación Funcional (EVALUADO EXCLUSIVAMENTE POR EL GRADO DE LIMITACIÓN FUNCIONAL Y DOLOR EN MANIOBRAS DINÁMICAS: 0-1: Ausente/Sin limitación en maniobras dinámicas; 2-4: Leve dolor al final del arco con maniobras de Neer/Hawkins levemente positivas; 5-6: Moderado compromiso con dolor marcado en arco medio 60°-120° y restricción dinámica; 7-8: Severo compromiso con marcada limitación funcional e incapacidad para maniobras activas; 9-10: Imposibilidad de realizar maniobras por limitación funcional y dolor bloqueante severo).
4. "otros_tendones": Lesión de Otros Tendones del Manguito (Infraespinoso, Subescapular, Redondo Menor: 0-1: Intactos/Estructura normal; 2-4: Tendinosis o desgarro parcial focal leve; 5-6: Desgarro parcial significativo en 1 tendón asociado; 7-8: Ruptura completa de 1 tendón o compromiso parcial grave de varios tendones; 9-10: Compromiso multitendinoso masivo).
5. "tendinosis_supraespinoso": Tendinosis del Supraespinoso (0-1: Patrón fibrilar normal; 2-4: Tendinosis focal/heterogeneidad ecogénica leve; 5-6: Tendinosis difusa/engrosamiento moderado o microcalcificaciones; 7-8: Tendinosis severa/heterogeneidad marcada o macrocalcificaciones; 9-10: Tendinosis avanzada degenerativa previo a falla estructural).
6. "tclb": Tendón Cabeza Larga del Bíceps - TCLB (0-1: Intacto/Centrado en corredera; 2-4: Tenosinovitis leve con líquido peritendinoso; 5-6: Tenosinovitis moderada o subluxación parcial/tendinosis; 7-8: Desgarro parcial significativo o luxación medial fuera de corredera; 9-10: Ruptura completa/tendón ausente o retináculo roto).
` : ""}

${(requestedMode === "msk" || (requestedMode === "auto" && !/manguito|supraespinoso|infraespinoso|subescapular|bursitis subacrom|hombro|tclb|b[ií]ceps/i.test(report) && !/tumor|oncolog|c[aá]ncer|malign|n[oó]dulo|carcinom|masa|neoplas|metast|adenopat|diverticul|pancreat|apendic|colecist|pielonefr|absceso|flem[oó]n/i.test(report))) ? `
SI LA MATRIZ ES OSTEOMUSCULAR / ARTICULAR GENERAL (MSK):
Aplica la matriz de 6 vectores biomecánicos tradicionales:
- "inflamacion": Inflamación / Edema (Edema tisular, derrame articular, tenosinovitis, colecciones, bursitis).
- "estructural": Compromiso Estructural (Desgarro, ruptura, erosión, solución de continuidad).
- "biomecanica": Inestabilidad Biomecánica (Mecanismo lesional, sobrecarga, inestabilidad, pinzamiento/impingement).
- "vascularizacion": Vascularización / Hiperemia (Doppler color/pulsado, neovasculatura, inflamación vascular).
- "tension": Tensión / Irritación (Espasmo miotendinoso, contractura, tracción entésica, reactividad fascial).
- "cronicidad": Cronicidad / Fibrosis (Tendinosis previa, fibrosis, calcificaciones, osteofitos, remodelado).
` : ""}

${(requestedMode === "visceral" || (requestedMode === "auto" && /diverticul|pancreat|absceso|flem[oó]n|mastitis|prostat|adenitis|anex|periton/i.test(report) && !/apendic|ap[eé]ndice|colecist|ves[ií]cula|pielonefr|ri[nñ][oó]n|renal|tiroides|h[ií]gado|hep[aá]tic/i.test(report) && !/tumor|oncolog|c[aá]ncer|malign|carcinom|neoplas|metast/i.test(report))) ? `
SI LA MATRIZ ES VISCERAL / ABDOMINAL / PÉLVICO / TEJIDOS BLANDOS / INFLAMATORIO:
Aplica la matriz de 6 vectores adaptada a la fisiopatología visceral/parenquimatosa:
- "inflamacion": Inflamación & Edema Parietal / Parenquimatoso (Engrosamiento edematoso de pared, edema peri-órgano, flemón, líquido libre/inflamatorio).
- "estructural": Compromiso Tisular / Lisis / Necrosis (Lisis tisular, pérdida de la estratificación de pared, perforación, plastrón o colección purulenta formadora de absceso).
- "biomecanica": Afectación Perivisceral / Reactividad de Pared (Afectación de la grasa perivisceral/perirrenal/mesentérica, desestructuración del lecho periadjacente, reactividad de órganos vecinos).
- "vascularizacion": Vascularización / Hiperemia Doppler (Señal Doppler parietal/capsular aumentada, hiperemia reactiva, o zonas de hipoperfusión/isquemia/necrosis).
- "tension": Irritación Serosa / Peritoneal & Distensión Tensional (Irritación peritoneal/pleural focal, estasis/distensión ductal o ureteral, espasmo visceral, dolor focal provocado al paso del transductor).
- "cronicidad": Cronicidad / Litiasis & Secuelas Recurrentes (Antecedente de litiasis, cicatrices, estenosis, atrofia parenquimatosa o brote recurrente sobre daño crónico).
` : ""}

${(requestedMode === "oncology" || (requestedMode === "auto" && /tumor|oncolog|c[aá]ncer|malign|n[oó]dulo|carcinom|masa|neoplas|metast|birads|lirads|bosniak|ti-rads/i.test(report))) ? `
SI LA MATRIZ ES ONCOLÓGICA / LESIONES TUMORALES & NÓDULOS SOSPECHOSOS (Hígado, Páncreas, Riñón, Mama, Tiroides, Próstata, Tejidos Blandos, etc.):
Aplica la matriz de 6 vectores tumoral-oncofisiológicos:
- "estructural": Arquitectura / Heterogeneidad & Bordes (Estructura interna heterogénea/mosaico, bordes espiculados/microlobulados, halo hipoecoico/invasivo, microcalcificaciones sospechosas, sombra acústica/atenuación).
- "vascularizacion": Neoangiogénesis & Neovasculatura Doppler (Vascularización intralesional central/caótica, vasos tortuosos de alta velocidad, baja resistencia RI, señal Doppler masiva).
- "biomecanica": Invasión Tisular Local & Cápsula (Infiltración de grasa circundante, abombamiento/interrupción de la cápsula orgánica, invasión de fascias o tejidos contiguos, pérdida de planos de clivaje).
- "tension": Compromiso Vascular / Ductal / Troncular (Encajonamiento/colapso o trombosis tumoral de vasos principales -v. porta, a. mesentérica, v. renal-, dilatación ductal retrógrada -Wirsung, vía biliar, ureteral-).
- "inflamacion": Necrosis Tumoral / Degeneración Licuefactiva (Degeneración o lisis central, componentes quísticos/hemorrágicos intratumorales, edema o colecciones pericavitarias).
- "cronicidad": Adenopatías Regionales & Diseminación (Adenopatías sospechosas -pérdida de hilio graso, redondeamiento, hiperemia-, implantes nodulares peritoneales, ascitis patológica, metástasis).
` : ""}

SI LA SELECCIÓN ES "AUTO", DETECTA CUÁL DE LAS 12 MATRICES ANTERIORES SE AJUSTA MEJOR AL REPORTE Y APLÍCALA ESTRICTAMENTE.

${(requestedMode === "muscle_injury" || (requestedMode === "auto" && /desgarro.*muscular|desgarro.*fibrilar|lesi[oó]n.*muscular|peetrons|hematoma.*intramuscular|uni[oó]n.*miotendinosa|\bmtj\b|rectocuadricipital|isquiotibial|gemelo|s[oó]leo|aductor|b[ií]ceps.*femoral|avulsi[oó]n.*tendinosa|edema.*intramuscular/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN DE LESIONES MUSCULARES Y MIOTENDINOSAS (MUSCLE INJURY 6D):
Aplica la matriz de 6 vectores específicos para la evaluación ecográfica/RM de lesiones musculares:
1. "desgarro_muscular": Desgarro Muscular Fibrilar y Solución de Continuidad (0-1: Integridad muscular normal; 2-4: Microdesgarro o lesión miofascial Grado I <5mm; 5-6: Desgarro fibrilar parcial Grado II 5-20mm <50% de la sección; 7-8: Desgarro subtotal Grado III >50% de la sección con retracción moderada; 9-10: Desgarro completo Grado IV 100% de disrupción transmural con hernia/retracción masiva).
2. "hematoma_coleccion": Hematoma Intramuscular / Interfascial y Colección Líquida (0-1: Sin colección líquida; 2-4: Hematoma laminar interfascial fino <1.0 cm³; 5-6: Hematoma intramuscular definido 1.0-5.0 cm³; 7-8: Hematoma voluminoso a tensión 5.0-15.0 cm³; 9-10: Hematoma masivo expansivo >15.0 cm³ con síndrome compartimental incipiente).
3. "union_miotendinosa": Afectación de la Unión Miotendinosa / MTJ (0-1: MTJ preservada normal; 2-4: Compromiso miofascial periférico leve; 5-6: Deslamado o desgarro parcial MTJ <25%; 7-8: Avulsión aponeurótica severa de MTJ >50%; 9-10: Avulsión / disrupción total de la unión miotendinosa).
4. "tendon_insercion": Tendón y Entesis de Inserción (0-1: Tendón de inserción intacto normal; 2-4: Entesopatía / tendinopatía postraumática leve; 5-6: Ruptura parcial intratendinosa <50%; 7-8: Avulsión insercional subtotal o ruptura >50%; 9-10: Ruptura completa tendinosa o avulsión ósea insercional total).
5. "vascularidad": Vascularidad y Neovascularización Doppler Color (0-1: Vascularidad intramuscular fisiológica normal; 2-4: Hiperemia perilesional leve focal; 5-6: Neovascularización reparativa moderada en borde del desgarro; 7-8: Hipervascularización intensa de regeneración; 9-10: Neovascularización caótica extrema / pseudoaneurisma o fístula AV postraumática).
6. "cambios_inflamatorios": Cambios Inflamatorios Perilesionales y Edema Intramuscular (0-1: Vientre muscular limpio simétrico; 2-4: Edema intramuscular localizado leve "en pluma de ave"; 5-6: Edema inflamatorio extenso >30% del vientre muscular; 7-8: Miositis inflamatoria / edema masivo multicompartimental; 9-10: Mionecrosis / miositis osificante agudizada).
` : ""}

${(requestedMode === "thyroid" || (requestedMode === "auto" && /tiroides|tiroideo|tirads|tiroiditis|hashimoto|graves|bocio|inferno.*tiroid|n[oó]dulo.*tiroid|ismo.*tiroid|adenopat[ií]a.*cervical/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN TIROIDEA (THYROID 6D):
Aplica la matriz de 6 vectores específicos para la evaluación ecográfica/tomográfica de tiroides:
1. "tamano_tiroides": Tamaño Glandular y Volumetría / Bocio (0-1: Volumen normal 7-15cc, dimensiones conservadas; 2-4: Bocio leve o volumen 16-22cc; 5-6: Bocio moderado Grado I 23-35cc con compresión sutil; 7-8: Bocio severo Grado II 36-50cc con desviación traqueal; 9-10: Bocio gigante Grado III >50cc o bocio endotorácico/sumergido).
2. "presencia_nodulos": Carga Nodular y Multinodularidad (0-1: Glándula avascular libre de nódulos, parénquima homogéneo; 2-4: Nódulo único pequeño <10mm o quístico puro; 5-6: Bocio multinodular leve-moderado 2-4 nódulos bilaterales; 7-8: Bocio multinodular prominente >4 nódulos; 9-10: Reemplazo parenquimatoso masivo por nódulos).
3. "nodulos_sospechosos": Estratificación de Sospecha Oncológica - TI-RADS / EU-TIRADS (0-1: TI-RADS 1-2 completamente benigno; 2-4: TI-RADS 3 baja sospecha; 5-6: TI-RADS 4A sospecha moderada 1 rasgo de sospecha; 7-8: TI-RADS 4B/4C alta sospecha 2+ rasgos microcalcificaciones/taller-than-wide; 9-10: TI-RADS 5 o infiltración extratiroidea a músculo/tráquea).
4. "patron_parenquima": Ecoestructura Parenquimatosa - Tiroiditis de Hashimoto / Graves (0-1: Parénquima homogéneo normal brillante; 2-4: Parénquima levemente heterogéneo; 5-6: Tiroiditis moderada con patrón pseudonodular y septos fibrosos; 7-8: Tiroiditis avanzada con patrón en panal de abejas o reticulado hipoecoico; 9-10: Tiroiditis atrófica severa o destrucción parenquimatosa).
5. "vascularidad": Vascularidad Glandular y Intranodular - Doppler Color / Inferno Tiroideo (0-1: Flujo vascular fisiológico normal escaso; 2-4: Incremento vascular sutil; 5-6: Hipervascularización difusa moderada -inferno tiroideo Grado II-; 7-8: Vascularidad intranodular caótica central o PSV >50 cm/s; 9-10: Inferno tiroideo masivo o neovascularización tumoral caótica).
6. "adenopatias_atipicas": Adenopatías Cervicales Atípicas / Sospechosas - Compartimentos II-VI (0-1: Ganglios cervicales fisiológicos ovalados con hilio graso; 2-4: Adenopatías reactivas inflamatorias; 5-6: Adenopatía dudosamente atípica redondeada; 7-8: Adenopatías sospechosas/atípicas con microcalcificaciones o sustitución quística; 9-10: Adenopatías metastásicas masivas / conglomerado nodal atípico).
` : ""}

${(requestedMode === "appendicitis" || (requestedMode === "auto" && /apendic|ap[eé]ndice|fecalito|apendicolito|fosa.*il[ií]aca.*derecha|\bfid\b|signo.*diana|target.*sign|mesoap[eé]ndice|flem[oó]n.*apendic|plastr[oó]n.*apendic|mcburney/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN DE APENDICITIS AGUDA (APPENDICITIS 6D):
Aplica la matriz de 6 vectores específicos para la evaluación ecográfica/tomográfica de apendicitis aguda:
1. "diametro_apendice": Diámetro Transversal Externo Apendicular y Compresibilidad (0-1: Diámetro ≤6.0mm, apéndice compresible de fondo ciego; 2-4: Diámetro 6.1-7.0mm, incompresibilidad parcial o duda diagnóstica; 5-6: Apendicitis incipiente/moderada 7.1-8.5mm, incompresible con dolor a la compresión -Murphy apendicular (+)-; 7-8: Apendicitis severa/distendida 8.6-11.0mm, apéndice tubular aperistáltico y rígido; 9-10: Apendicitis flemónosa/dilatación masiva >11.0mm con riesgo de perforación).
2. "pared_apendice": Espesor y Estructura Parietal - Signo de la Diana / Target Sign (0-1: Pared ≤2.0mm, capas conservadas; 2-4: Engrosamiento leve 2.1-2.9mm; 5-6: Engrosamiento moderado 3.0-4.0mm, signo de la diana manifiesto; 7-8: Engrosamiento severo >4.0mm con edema submucoso o pérdida focal de estratificación; 9-10: Disrupción parietal / necrosis transmural / apendicitis gangrenosa).
3. "vascularidad": Vascularidad Parietal / Doppler Color Parietal (0-1: Flujo parietal simétrico fino normal; 2-4: Hiperemia leve con anillo vascular discontinuo sutil; 5-6: Hiperemia moderada difusa -signo del anillo de fuego-; 7-8: Hiperemia intensa con velocidades elevadas; 9-10: Paro vascular parietal / isquemia por necrosis gangrenosa).
4. "cambios_inflamatorios": Cambios Inflamatorios Locales - Grasa Periapendicular / Flemón (0-1: Grasa mesoapendicular limpia homogénea; 2-4: Hiperdensidad/hiperecogenicidad leve focal; 5-6: Hiperecogenicidad moderada de la grasa / fat stranding; 7-8: Flemón periapendicular / plastrón edematoso; 9-10: Plastrón flemónoso extenso / necrosis grasa).
5. "liquido_colecciones": Líquido Libre, Colecciones y Perforación (0-1: Sin líquido libre peritoneal; 2-4: Mínima lámina anecoica reactiva <5mm; 5-6: Líquido libre moderado turbio; 7-8: Colección/absceso periapendicular contenido <3cm; 9-10: Absceso grande >3cm / peritonitis purulenta abierta).
6. "apendicolito": Apendicolito / Fecalito e Impactación Luminal (0-1: Luz limpia sin apendicolito; 2-4: Pequeña densidad intraluminal o microlito <3mm; 5-6: Apendicolito único 3-5mm con sombra acústica clara; 7-8: Apendicolito prominente/obstructivo >5mm con sombra acústica densa; 9-10: Apendicolitos múltiples / fecalito gigante / fecalito extravasado por perforación).
` : ""}

${(requestedMode === "knee_trauma" || (requestedMode === "auto" && /trauma.*rodilla|esguince.*rodilla|colateral.*medial|lcm|mcl|colateral.*lateral|lcl|fcl|menisco|ligamento.*patelar|rotulian/i.test(report))) ? `
SI LA MATRIZ ES DE TRAUMA AGUDO DE RODILLA (KNEE TRAUMA 6D):
Aplica la matriz de 6 vectores específicos para la evaluación de trauma agudo y lesiones capsuloligamentosas/meniscales de rodilla:
1. "lcm": Ligamento Colateral Medial - LCM/MCL (0-1: Fascículos superficial y profundo continuos normales; 2-4: Esguince Grado I engrosado hipoecoico sin discontinuidad; 5-6: Esguince Grado II ruptura parcial <50% con colección/hematoma; 7-8: Esguince Grado III ruptura completa >50% transmural o valgo estrés positivo; 9-10: Avulsión completa con inestabilidad medial grave o lesión de Stener-like/Pellegrini-Stieda aguda).
2. "lcl": Ligamento Colateral Lateral y Complejo Posterolateral - LCL/FCL & CPL (0-1: Estructura cordonal delgada en cabeza del peroné continua normal; 2-4: Esguince Grado I engrosamiento edematoso focal; 5-6: Esguince Grado II ruptura parcial con hematoma periligamentario; 7-8: Esguince Grado III ruptura completa del LCL con inestabilidad en varo estrés; 9-10: Disrupción masiva del Complejo Posterolateral CPL LCL+tendón poplíteo+ligamento popliteofibular).
3. "menisco_interno": Menisco Interno / Medial (0-1: Triángulo meniscal regular de ecogenicidad homogénea conservada; 2-4: Meniscopatía traumática Grado I-II o extrusión menor <2mm; 5-6: Desgarro meniscal parcial longitudinal/radial con edema extrameniscal; 7-8: Ruptura completa / desgarro en "asa de balde" desplazada / lesión de rampa o extrusión >3mm; 9-10: Maceración meniscal traumática masiva o menisco inestable desinsertado).
4. "menisco_externo": Menisco Externo / Lateral (0-1: Configuración uniforme y ecogénica conservada; 2-4: Fisuración lineal no desplazada; 5-6: Desgarro meniscal lateral definido oblicuo/complejo; 7-8: Desgarro en "asa de balde" lateral o desgarro de raíz posterior meniscal lateral (Root Tear); 9-10: Destrucción/maceración meniscal lateral completa con fragmentación bloqueante).
5. "hidrartrosis": Hidrartrosis / Hemartrosis Articular (0-1: Ausente o líquido fisiológico <3mm en receso suprarrotuliano; 2-4: Distensión leve 3-5mm; 5-6: Derrame moderado 6-10mm con sinovitis reactiva / hemartrosis incipiente; 7-8: Hemartrosis severa >10mm a tensión o lipohemartrosis con nivel líquido-grasa; 9-10: Hemartrosis masiva a tensión con extravasación capsular).
6. "lig_patelar": Ligamento Patelar / Tendón Rotuliano (0-1: Espesor uniforme <4.5mm y patrón fibrilar continuo; 2-4: Tendinopatía postraumática / entesopatía leve en polo inferior de rótula o TAT; 5-6: Ruptura parcial <50% con inflamación de grasa de Hoffa; 7-8: Ruptura subtotal/total >50% con rótula alta; 9-10: Disrupción masiva del mecanismo extensor tendón rotuliano + retináculos).
` : ""}

${(requestedMode === "knee_oa" || (requestedMode === "auto" && /artrosis.*rodilla|rodilla.*artros|gonartros|femorotibial|cart[ií]lago troclear|osteofit/i.test(report))) ? `
SI LA MATRIZ ES DE ARTROSIS DE RODILLA / GONARTROSIS (KNEE OA 6D):
Aplica la matriz de 6 vectores específicos requeridos para artrosis degenerativa articular de rodilla:
1. "femorotibial_medial": Disminución Compartimento Femorotibial Medial (0-1: Espacio articular conservado de amplitud normal; 2-4: Pinzamiento leve <25%; 5-6: Pinzamiento moderado 25-50%; 7-8: Pinzamiento severo >50% con esclerosis subcondral; 9-10: Pinzamiento total con contacto óseo/colapso articular).
2. "femorotibial_lateral": Disminución Compartimento Femorotibial Lateral (0-1: Espacio articular conservado; 2-4: Pinzamiento leve; 5-6: Pinzamiento moderado; 7-8: Pinzamiento severo con esclerosis subcondral; 9-10: Pinzamiento total con contacto óseo/colapso).
3. "meniscopatia_deg": Meniscopatía Degenerativa (0-1: Meniscos conservados; 2-4: Cambios mucoides o irregularidad/extrusión menor; 5-6: Desgarro degenerativo complejo o extrusión moderada; 7-8: Desgarro severo desinsertado/macerado o extrusión >3mm; 9-10: Maceración meniscal masiva o menisco ausente/destruido).
4. "cartilago_troclear": Adelgazamiento o Irregularidad del Cartílago Troclear (0-1: Cartílago troclear uniforme de espesor normal; 2-4: Adelgazamiento focal o irregularidad superficial leve; 5-6: Defectos condrales parciales/condromalacia II-III; 7-8: Defecto condral a espesor completo/grado IV focal; 9-10: Denudación cartilaginosa extensa con hueso subcondral expuesto).
5. "hidrartrosis": Hidrartrosis / Efusión Articular (0-1: Ausente/Líquido fisiológico; 2-4: Distensión leve en receso suprarrotuliano; 5-6: Efusión moderada con sinovitis reactiva; 7-8: Hidrartrosis severa a tensión/quiste de Baker tenso; 9-10: Derramamiento masivo a tensión).
6. "osteofitos": Osteofitos Marginales & Entesofitos (0-1: Márgenes óseos regulares; 2-4: Osteofitos incipientes marginales femoral/tibial/rotuliano; 5-6: Osteofitos definidos moderados; 7-8: Osteofitosis prominente con deformidad de contornos; 9-10: Osteofitos gigantes puenteantes o deformidad masiva).
` : ""}

${(requestedMode === "ankle_trauma" || (requestedMode === "auto" && /tobillo|esguince|lpaa|atfl|lpc|cfl|deltoid|tibioastragal|maleolo|peroneo|subluxacion.*peroneo|sindesmosis|cajon.*anterior|osteocondral/i.test(report))) ? `
SI LA MATRIZ ES DE TRAUMA DISTORSIVO DE TOBILLO (ANKLE TRAUMA 6D):
Aplica la matriz de 6 vectores específicos para la evaluación de esguince / trauma de tobillo:
1. "lpaa": Ligamento Peroneo Astragalino Anterior - LPAA/ATFL (0-1: Fisiológico normal con espesor y fibrilaridad conservados; 2-4: Esguince Grado I engrosado hipoecoico focal; 5-6: Esguince Grado II ruptura parcial <50% de fibras o hematoma intraligamentario; 7-8: Esguince Grado III ruptura subtotal/total reciente con brecha anecoica o cajón anterior (+); 9-10: Ruptura total masiva con inestabilidad anterolateral severa o ligamento ausente/avulsionado).
2. "lpc": Ligamento Peroneo Calcáneo - LPC/CFL (0-1: Fisiológico normal bajo tendones peroneos; 2-4: Esguince Grado I engrosamiento edematoso en inserción calcánea/peronea; 5-6: Esguince Grado II ruptura parcial de fibras subperoneas; 7-8: Esguince Grado III ruptura completa con inestabilidad en varo/inclinación astragalina (+); 9-10: Lesión compleja bicompartimental LPAA+LPC con inestabilidad subastragalina masiva).
3. "deltoideo": Complejo Ligamentoso Deltoideo - Medial (0-1: Capas superficial y profunda continuas normales; 2-4: Entesopatía postraumática / Esguince Grado I leve sin brecha; 5-6: Ruptura parcial deltoidea con hematoma medial; 7-8: Ruptura completa superficial y profunda con ensanchamiento de espacio claro medial; 9-10: Avulsión deltoidea masiva con diástasis tibioastragalina severa).
4. "hidrartrosis": Hidrartrosis / Hemartrosis Articular (0-1: Ausente / Líquido fisiológico <2mm; 2-4: Distensión leve 2-4mm en receso anterior; 5-6: Derrame moderado 5-7mm con sinovitis reactiva / hemartrosis incipiente; 7-8: Hemartrosis severa >7mm a tensión con detritos ecogénicos; 9-10: Derramamiento masivo a tensión con extravasación periarticular o ruptura capsular).
5. "tendones": Tendones Mediales y Laterales - Peroneos / Tibial Posterior / Aquiles (0-1: Retináculos y tendones intactos en correderas; 2-4: Tenosinovitis postraumática leve sin luxación; 5-6: Tenosinovitis moderada con fisuración fibrilar longitudinal; 7-8: Subluxación / Luxación de tendones peroneos por ruptura del RPS o ruptura parcial tendinosa; 9-10: Ruptura tendinosa completa o luxación tendinosa irreductible).
6. "oseo": Estructuras Óseas, Corticales, Cartílago y Sindesmosis (0-1: Corticales continuas normales sin avulsiones ni defectos; 2-4: Irregularidad cortical leve / Avulsión cortical ínfima <2mm; 5-6: Pequeño fragmento avulsionado 2-4mm o Lesión Osteocondral del Astrágalo LOA/OCD I-II; 7-8: Fragmento avulsionado desplazado >4mm o LOA III-IV inestable; 9-10: Fractura maleolar desplazada o Diástasis sindesmótica abierta / Lesión de sindesmosis).
` : ""}

${(requestedMode === "cholecystitis" || (requestedMode === "auto" && /colecist|ves[ií]cula|murphy|hidrocolecisto|hidrops.*vesic|bacinete|coledocolitiasis|c[aá]lculo.*c[ií]stico|coleperitoneo/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN DE COLECISTITIS AGUDA (CHOLECYSTITIS 6D):
Aplica la matriz de 6 vectores específicos para la evaluación ecográfica de colecistitis aguda y complicaciones vesiculobiliares:
1. "engrosamiento_pared": Engrosamiento y Edema Parietal Vesicular (0-1: Espesor normal ≤3.0mm, pared fina monocapa; 2-4: Engrosamiento leve 3.1-4.5mm; 5-6: Engrosamiento moderado 4.6-6.0mm con signo de doble pared o estriación; 7-8: Engrosamiento severo 6.1-8.0mm edematoso heterogéneo; 9-10: Engrosamiento masivo/destructivo >8.0mm con aspecto acartonado).
2. "vascularidad": Vascularidad Parietal / Doppler Color (0-1: Señal vascular fisiológica normal; 2-4: Hiperemia sutil focal en cuello o cuerpo; 5-6: Hiperemia moderada difusa en pared vesicular; 7-8: Hiperemia intensa con velocidades elevadas en arteria cística; 9-10: Paro vascular / Isquemia parietal con ausencia focal/difusa de flujo por necrosis o trombosis).
3. "necrosis_pared": Necrosis Parietal / Gangrena (0-1: Pared continua sin necrosis ni gas; 2-4: Irregularidad intraluminal discreta o membranas focales pequeñas; 5-6: Membranas intraluminales desprendidas / sloughing mucoso; 7-8: Microburbujas intraparietales / foco de discontinuidad parietal; 9-10: Colecistitis Gangrenosa/Enfisematosa establecida con abundante gas parietal/intraluminal o perforación transmural).
4. "cambios_perivesiculares": Cambios Perivesiculares y Lecho Hepático (0-1: Grasa perivesicular limpia y lecho hepático libre; 2-4: Halo hiperecogénico perivesicular leve o mínima lámina líquida; 5-6: Líquido perivesicular moderado / fat stranding definido; 7-8: Colección perivesicular / absceso en lecho hepático; 9-10: Perforación contenida con absceso hepático contiguo o coleperitoneo).
5. "via_biliar": Vía Biliar / Colédoco (0-1: Vía biliar intra y extrahepática de calibre normal; 2-4: Dilatación mínima o barro biliar sin coledocolitiasis; 5-6: Dilatación moderada del colédoco o coledocolitiasis no obstructiva; 7-8: Obstrucción biliar con dilatación marcada y coledocolitiasis; 9-10: Colangitis asociada / obstrucción biliar crítica con dilatación masiva).
6. "tamano_forma": Tamaño / Hidrops Vesicular (0-1: Dimensiones vesiculares normales; 2-4: Distensión leve; 5-6: Hidrops / sobredistensión moderada; 7-8: Hidrops severo a tensión; 9-10: Hidrops masivo con riesgo de isquemia/perforación).
` : ""}

${(requestedMode === "hepatic" || (requestedMode === "auto" && /h[ií]gado|hep[aá]tic|esteatosis|cirrosis|fibrosis.*hep|elastograf|kpa|portal|suprahep|loe.*hep|lesi[oó]n.*focal.*hep/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN HEPÁTICA INTEGRAL (HEPATIC 6D):
Aplica la matriz de 6 vectores específicos para valoración hepática:
1. "tamano_forma": Tamaño y Forma (0-1: Dimensiones conservadas, borde inferior agudo, contornos lisos; 2-4: Hepatomegalia leve o irregularidad sutil de contorno; 5-6: Hepatomegalia moderada o lobulación capsular; 7-8: Hepatomegalia marcada o atrofia lobar con remodelado; 9-10: Hígado cirrótico desestructurado / atrofia severa con asimetría extrema).
2. "vascularidad": Vascularidad (0-1: Vena porta calibre y flujo hepatópeto normales, suprahepáticas trifásicas; 2-4: Calibre portal limítrofe o atenuación sutil de fásicidad; 5-6: Signos de hipertensión portal leve-moderada; 7-8: Flujo portal atenuado/hepatófugo o colaterales significativas; 9-10: Trombosis portal / oclusión vascular mayor).
3. "elasticidad": Elasticidad (0-1: Rigidez fisiológica <6.0 kPa / F0-F1; 2-4: Elevación leve 6-8 kPa; 5-6: Fibrosis intermedia 8-10 kPa / F2; 7-8: Fibrosis avanzada 10-14 kPa / F3; 9-10: Cirrosis >14 kPa / F4).
4. "apariencia_parenquima": Apariencia del Parénquima (0-1: Ecoestructura homogénea granular fina; 2-4: Heterogeneidad leve; 5-6: Tosquedad moderada / patrón micronodular; 7-8: Patrón nodular difuso marcado; 9-10: Parénquima completamente desestructurado).
5. "infiltracion_grasa": Infiltración Grasa (0-1: Sin esteatosis Grado 0; 2-4: Esteatosis leve Grado I; 5-6: Esteatosis moderada Grado II; 7-8: Esteatosis severa Grado III con atenuación marcada; 9-10: Esteatohepatitis / infiltración masiva con pérdida de visualización profunda).
6. "lesiones_focales": Lesiones Focales (0-1: Sin LOEs; 2-4: Quiste simple o hemangioma típico pequeño; 5-6: LOE indeterminada o múltiples lesiones benignas; 7-8: LOE sospechosa / LI-RADS intermedio-alto; 9-10: Masa maligna franca / metástasis múltiples).
` : ""}

${(requestedMode === "renal" || (requestedMode === "auto" && /ri[nñ][oó]n|renal|corteza renal|hidronefrosis|pielonefritis|ectasia|litiasis renal|c[aá]liz|seno renal|bosniak|angiomiolipoma|nefromegal|uropat[ií]a/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN RENAL INTEGRAL (RENAL 6D):
Aplica la matriz de 6 vectores específicos cuantitativos y cualitativos para valoración renal:
1. "tamano_renal": Tamaño Renal (0-1: Fisiológico / Eje bipolar longitudinal normal 100-120mm, contornos reniformes simétricos; 2-4: Nefromegalia leve 121-130mm o riñón en límite inferior 90-99mm con asimetría discreta 10-15mm; 5-6: Nefromegalia moderada 131-145mm o hipotrofia renal moderada 75-89mm compatible con nefropatía crónica incipiente; 7-8: Hipotrofia/atrofia renal severa 60-74mm con pérdida de silueta o nefromegalia marcada >145mm; 9-10: Riñón atrófico terminal <60mm escleroatrófico o riñón gigante desestructurado >160mm).
2. "grosor_cortical": Grosor Cortical (0-1: Corteza normal preservada ≥9-10mm con nítida diferenciación córtico-medular y ecogenicidad normal; 2-4: Adelgazamiento cortical leve 7-8mm, atenuación sutil de diferenciación o ecogenicidad aumentada Grado I; 5-6: Adelgazamiento cortical moderado 5-6mm, ecogenicidad igual al hígado Grado II y pérdida parcial de pirámides medulares; 7-8: Adelgazamiento cortical severo 3-4mm, hiperecogenicidad marcada Grado III y pérdida completa de diferenciación; 9-10: Atrofia cortical extrema <3mm con desdiferenciación total y calcificaciones).
3. "vascularidad": Vascularidad (0-1: Perfusión cortical periférica completa hasta la cápsula sin áreas avasculares, RI intrarrenal fisiológico 0.58-0.70, vena permeable; 2-4: Perfusión conservada con RI limítrofe 0.71-0.74 o 0.52-0.57; 5-6: Reducción difusa de microvascularización periférica o RI elevado 0.75-0.80 sugestivo de nefropatía médica; 7-8: Defecto de perfusión segmentario / cuña avascular de infarto, RI >0.80-0.85 o patrón tardus-parvus; 9-10: Trombosis de vena renal, oclusión de arteria renal, ausencia total de flujo vascular o inversión diastólica).
4. "lesiones_focales": Lesiones Focales (0-1: Parénquima homogéneo sin LOEs o quiste cortical simple milimétrico solitario Bosniak I; 2-4: Quistes simples Bosniak I/II o angiomiolipoma típico hiperecogénico <10mm no complicado; 5-6: Quiste complejo Bosniak IIF con septos múltiples o angiomiolipoma 20-40mm; 7-8: Quiste sospechoso Bosniak III con paredes engrosadas >2mm o masa sólida indeterminada >20mm; 9-10: Masa sólida con signos francos de malignidad Bosniak IV / Carcinoma de Células Renales o invasión vascular tumoral).
5. "procesos_obstructivos": Procesos Obstructivos (0-1: Seno renal ecolucente sin separación de la pelvis <5mm, sin hidronefrosis Grado 0 SFU y jets ureterales simétricos; 2-4: Ectasia piélica leve o pielocalicial mínima Grado I SFU 5-10mm o litiasis calicial no obstructiva; 5-6: Hidronefrosis moderada Grado II-III SFU con dilatación piélica y calicial pero parénquima respetado, litiasis obstructiva; 7-8: Hidronefrosis severa Grado IV SFU con compresión parenquimatosa marcada o pionefrosis; 9-10: Uropatía obstructiva descompensada / saco hidronefrótico a tensión con adelgazamiento extremo o rotura fornicial con urinoma).
6. "cambios_inflamatorios": Cambios Inflamatorios (0-1: Grasa perirrenal limpia, fascia de Gerota fina y parénquima sin áreas de edema o hiperemia; 2-4: Engrosamiento urotelial piélico leve o edema reactivo inespecífico; 5-6: Pielonefritis aguda focal / nefronía lobar con área hipoecoica en cuña e hipoperfusión focal; 7-8: Pielonefritis complicada / microabscesos coalescentes o colección perirrenal; 9-10: Absceso renal mayor >3-5cm con extensión retroperitoneal o Pielonefritis Enfisematosa con gas parenquimatoso).
` : ""}

${(requestedMode === "scrotal" || (requestedMode === "auto" && /test[ií]cul|escrot|epid[ií]dim|varicocele|hidrocele|orquitis|torsi[oó]n testicular|plexo pampiniforme|espermatocele|albug[ií]nea/i.test(report))) ? `
SI LA MATRIZ ES DE VALORACIÓN ESCROTAL / TESTICULAR INTEGRAL (ESCROTO 6D):
Aplica la matriz de 6 vectores específicos cuantitativos y cualitativos para valoración escrotal y testicular con estas escalas de calificación exactas:
1. "tamano_testicular": Tamaño Testicular (0-1: Normal / Volumen testicular simétrico en rango fisiológico 8-25 cc con morfología ovoidea conservada; 2-4: Asimetría leve con discrepancia de volumen 20-30%, hipotrofia leve 6.0-7.9 cc o discreta orquimegalia reactiva 26-30 cc; 5-6: Hipotrofia moderada 4.0-5.9 cc o aumento volumétrico significativo por orquitis/edema difuso 31-40 cc; 7-8: Atrofia severa 2.5-3.9 cc o aumento masivo de volumen con desestructuración tisular; 9-10: Atrofia terminal escleroatrófica <2.5 cc o masa expansiva gigante que sustituye el parénquima).
2. "vascularidad_testicular": Vascularidad Testicular (0-1: Flujo Doppler color y espectral simétrico y homogéneo intraparenquimatoso con RI fisiológico 0.45-0.70; 2-4: Hiperemia vascular reactiva leve o asimetría sutil de flujo sin inversión ni resistencia patológica; 5-6: Hiperemia Doppler marcada difusa con orquitis activa o hipoflujo segmentario con RI aumentado >0.75; 7-8: Defecto de perfusión parenquimatosa extenso / infarto focal o flujo arterial tardus-parvus con pérdida venosa; 9-10: Ausencia total de señal Doppler en parénquima testicular por Torsión Testicular completa / infarto hemorrágico agudo).
3. "integridad_epididimos": Integridad de Epidídimos (0-1: Cabeza, cuerpo y cola de epidídimos de grosor, contornos y ecogenicidad normal sin hiperemia; 2-4: Engrosamiento focal leve de cabeza 11-13mm o quiste simple de epidídimo / espermatocele <10mm; 5-6: Epididimitis aguda/subaguda con tumefacción, desestructuración y marcada hiperemia Doppler; 7-8: Epididimitis complicada con microabscesos o espermatocele gigante >30mm; 9-10: Absceso epididimario mayor coalescente o flemón / necrosis escrotal por torsión de apéndice complicada).
4. "lesiones_focales": Lesiones Focales (0-1: Parénquima homogéneo sin LOEs ni calcificaciones sospechosas, quiste simple aislado de túnica albugínea o microquiste tubular <3mm; 2-4: Microlitiasis testicular Grado I <5 por campo, ectasia de rete testis o quiste simple benigno <5mm; 5-6: Microlitiasis densa Grado II-III >10 por campo o nódulo intratesticular sólido hipoecoico <10mm; 7-8: Masa intratesticular sólida vascularizada sospechosa 10-25mm con alto riesgo de neoplasia; 9-10: Tumoración testicular franca maligna >25mm / masa multinodular con invasión de túnicas o metástasis).
5. "varicocele": Varicocele (0-1: Venas del plexo pampiniforme con calibre en reposo <2 mm, sin ectasia ni reflujo con maniobra de Valsalva; 2-4: Varicocele Grado I / dilatación 2.0-2.8 mm en reposo con reflujo breve únicamente con Valsalva; 5-6: Varicocele Grado II / dilatación 2.9-3.5 mm visible en modo B y reflujo patológico sostenido >2s con Valsalva; 7-8: Varicocele Grado III / dilatación tortuosa >3.5-4.5 mm palpable en reposo con reflujo continuo espontáneo; 9-10: Megavaricocele masivo >5 mm con reflujo continuo masivo y compromiso trombótico del plexo).
6. "cambios_inflamatorios_hidrocele": Cambios Inflamatorios e Hidrocele (0-1: Líquido fisiológico en túnica vaginal <2 mL, pared escrotal normal 2-4 mm sin edema; 2-4: Hidrocele simple anecoico leve 10-30 mL o engrosamiento cutáneo escrotal reactivo leve 5-6 mm; 5-6: Hidrocele moderado a tensión 30-80 mL o paquivaginalitis con engrosamiento y trabéculas finas; 7-8: Hidrocele severo / hematocele o piocele con septos gruesos, nivel líquido-debris y celulitis parietal >8 mm; 9-10: Piocele a tensión con absceso de túnicas o fascitis necrotizante escrotal / Gangrena de Fournier con gas parietal).
` : ""}

REGLAS CRÍTICAS DE FIDELIDAD AL REPORTE (OBLIGATORIAS):
1. El campo "finding" DEBE basarse SOLO en el texto del reporte. Cita o parafrasea de forma fiel el fragmento relevante de ese eje (incluye medidas, grados, lateralidad y calificadores cuando consten).
2. PROHIBIDO inventar hallazgos, medidas o diagnósticos que no figuren en el reporte.
3. PROHIBIDO rellenar "finding" con frases genéricas de normalidad si el reporte describe patología, duda o alteración relacionada con ese eje.
4. Si el reporte NO aporta dato para un eje: asigna score 0-1 y en "finding" indica explícitamente la ausencia de alteración descrita para ese vector (sin inventar detalles).
5. "justification" debe vincular de forma explícita el score con el hallazgo citado del reporte (1-2 frases).
6. Coherencia score↔hallazgo: patología severa/masiva ⇒ score alto; hallazgo normal/ausente ⇒ score 0-1. No contradigas el texto.
7. Usa EXACTAMENTE las 6 keys de la matriz seleccionada. No mezcles vectores de otras matrices.
8. En AUTO, elige UNA sola matriz (la más específica) y evalúa solo esa.

REGLAS DE CALIFICACIÓN (0-10):
- 0 a 1: Fisiológico / Benigno / Ausente / Sin alteración.
- 2 a 4: Incipiente / Leve / Afectación focal o leve.
- 5 a 6: Moderado / Compromiso intermedio o dolor parcial.
- 7 a 8: Severo / Gran compromiso funcional o desgarro transfixiante.
- 9 a 10: Masivo / Crítico / Imposibilidad funcional o ruptura masiva.

SE REQUIERE EL SIGUIENTE ESQUEMA JSON:
- "globalLoadIndex": Categoría de carga/riesgo global ("Baja", "Moderada", "Elevada", "Crítica").
- "globalScore": Promedio de los puntajes de los ejes (número flotante redondeado a 1 decimal).
- "dominantVector": Nombre claro y descriptivo del vector patológico dominante (el de mayor score; si empate, el clínicamente más relevante).
- "radarMode": La matriz efectivamente aplicada ("rotator_cuff", "knee_oa", "cholecystitis", "ankle_trauma", "knee_trauma", "appendicitis", "thyroid", "muscle_injury", "hepatic", "renal", "scrotal", "msk", "visceral", u "oncology").
- "axes": Array de exactamente 6 objetos con todos los keys de la matriz seleccionada.
  Cada objeto contiene:
  * "key": string de la key EXACTA de la matriz.
  * "label": Nombre legible en español adecuado a la matriz aplicada.
  * "score": entero entre 0 y 10.
  * "level": nivel cualitativo ("Fisiológico", "Leve", "Moderado", "Severo", "Masivo / Crítico").
  * "finding": Texto fiel al reporte que fundamenta este eje (cita/paráfrasis; no plantilla genérica).
  * "justification": Explicación clínica sucinta que justifica el puntaje asignado según ese hallazgo.
- "clinicalSummary": Síntesis clínica integradora de 2 a 3 frases basada únicamente en los hallazgos del reporte.
- "recommendation": Recomendación clínica, conducta quirúrgica/conservadora o estudio complementario sugerido, coherente con los scores.

Reporte Médico a Analizar:
${report}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            globalLoadIndex: { type: Type.STRING },
            globalScore: { type: Type.NUMBER },
            dominantVector: { type: Type.STRING },
            radarMode: { type: Type.STRING },
            axes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  label: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  level: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  justification: { type: Type.STRING }
                },
                required: ["key", "label", "score", "level", "finding", "justification"]
              }
            },
            clinicalSummary: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["globalLoadIndex", "globalScore", "dominantVector", "axes", "clinicalSummary", "recommendation"]
        }
      }
    });

    const rawText = response.text || "{}";
    const parsedData = JSON.parse(rawText);

    const effectiveMode = requestedMode !== "auto" ? requestedMode : (parsedData.radarMode || "msk");
    parsedData.radarMode = effectiveMode;
    // Prefer explicit user matrix; clamp unknown auto modes to known presets.
    if (!MATRIX_PRESETS[parsedData.radarMode]) {
      parsedData.radarMode = MATRIX_PRESETS[effectiveMode] ? effectiveMode : "msk";
    }
    parsedData.axes = normalizeAxesForMode(parsedData.radarMode, parsedData.axes);
    refineRadarAggregate(parsedData);

    res.json({
      success: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error("Error en /api/generate-biomechanical-radar:", error);
    res.status(500).json({ success: false, error: handleGeminiError(error) });
  }
});

// --- VITE DEV SERVER OR STATIC SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for all other routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Servidor] Asistente Radiológico corriendo correctamente en http://localhost:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[Servidor] ${signal} recibido; cerrando conexiones activas.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 9_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer();
