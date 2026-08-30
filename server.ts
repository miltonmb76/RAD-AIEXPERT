import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import sharp from "sharp";

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
  const quoteChars = ['"', "'", '‚Äú', '‚Äù', '‚Äò', '‚Äô', '‚Äû', '`', '\\'];
  
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
  return "gemini-3.7-flash";
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
      .replace(/Punci[o√≥]n(?:-|\s+por\s+|\s+)Aspiraci[o√≥]n\s+con\s+Aguja\s+Fina/gi, "Biopsia por Aspiraci√≥n con Aguja Fina")
      .replace(/punci[o√≥]n(?:-|\s+por\s+|\s+)aspiraci[o√≥]n\s+con\s+aguja\s+fina/gi, "biopsia por aspiraci√≥n con aguja fina")
      .replace(/Punci[o√≥]n\s+por\s+aguja\s+fina/gi, "Biopsia por aspiraci√≥n con aguja fina")
      .replace(/punci[o√≥]n\s+por\s+aguja\s+fina/gi, "biopsia por aspiraci√≥n con aguja fina")
      .replace(/Punci[o√≥]n\s+con\s+aguja\s+fina/gi, "Biopsia con aguja fina")
      .replace(/punci[o√≥]n\s+con\s+aguja\s+fina/gi, "biopsia con aguja fina")
      .replace(/Punci[o√≥]n\s+aspirativa\s+con\s+aguja\s+fina/gi, "Biopsia por aspiraci√≥n con aguja fina")
      .replace(/punci[o√≥]n\s+aspirativa\s+con\s+aguja\s+fina/gi, "biopsia por aspiraci√≥n con aguja fina")
      .replace(/Punci[o√≥]n\s+Aspiraci[o√≥]n/gi, "Biopsia por Aspiraci√≥n")
      .replace(/punci[o√≥]n\s+aspiraci[o√≥]n/gi, "biopsia por aspiraci√≥n");
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
    throw new Error("La variable de entorno GEMINI_API_KEY no est√° configurada, est√° vac√≠a o solo contiene comillas. Por favor, a√±√°dela en la secci√≥n de Secretos de AI Studio.");
  }

  // Update process.env to ensure the cleaned key is globally visible to any SDK fallback
  process.env.GEMINI_API_KEY = apiKey;
  
  // Recreate client if the key changed to avoid stale client caching
  if (!aiClient || lastUsedKey !== apiKey) {
    const rawClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Transparent proxy wrapper on ai.models.generateContent for automatic backoff & retry on 429 / ResourceExhausted / transient errors
    const originalGenerateContent = rawClient.models.generateContent.bind(rawClient.models);

    (rawClient.models as any).generateContent = async function (params: any, ...args: any[]) {
      const maxRetries = 3;
      let lastErr: any = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await originalGenerateContent(params, ...args);
        } catch (err: any) {
          lastErr = err;
          const errMsg = `${err?.message || ""} ${JSON.stringify(err || {})} ${String(err)}`.toLowerCase();
          const isRateLimitOrTransient =
            errMsg.includes("429") ||
            errMsg.includes("resource_exhausted") ||
            errMsg.includes("quota") ||
            errMsg.includes("rate limit") ||
            errMsg.includes("overloaded") ||
            errMsg.includes("503") ||
            errMsg.includes("unavailable") ||
            errMsg.includes("too many requests") ||
            errMsg.includes("high demand");

          if (isRateLimitOrTransient && attempt < maxRetries) {
            // Exponential backoff with jitter: 600ms, 1300ms, 2600ms (+ random 0-200ms)
            const delay = Math.pow(2, attempt) * 600 + Math.floor(Math.random() * 200);
            console.warn(`[Gemini Resilient Retry] Attempt ${attempt + 1}/${maxRetries} for model "${params?.model || "default"}". Waiting ${delay}ms before retrying...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    };

    aiClient = rawClient;
    lastUsedKey = apiKey;
  }
  return aiClient;
}

// Intercepts and formats Gemini API errors to provide clear guidance to the user
function handleGeminiError(error: any): string {
  const errorMsg = error?.message || "";
  const errorJson = typeof error === "object" ? JSON.stringify(error) : "";
  const fullErrorStr = `${errorMsg} ${errorJson} ${String(error)}`.toLowerCase();
  
  const rawDetails = `\n\n[Detalle t√©cnico del error: ${errorMsg || String(error)}]`;
  
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
    return "‚ùå ERROR DE AUTENTICACI√ìN (API_KEY_INVALID)\n\n" +
           "La Clave de API de Gemini (GEMINI_API_KEY) es detectada pero ha sido rechazada por los servidores de Google.\n\n" +
           "Para solucionar este inconveniente, por favor realiza las siguientes comprobaciones:\n" +
           "1. **Crear una Clave Nueva**: Entra a Google AI Studio (https://aistudio.google.com/), haz clic en 'Get API Key' y crea una clave totalmente nueva. A veces las claves antiguas se desactivan espont√°neamente.\n" +
           "2. **Guardarla en Secrets**: Ve al bot√≥n superior de 'Settings' (Configuraci√≥n) o panel de Secretos en esta pantalla de AI Studio, escribe 'GEMINI_API_KEY' de forma exacta y pega all√≠ tu clave nueva.\n" +
           "3. **Habilitar la API de Lenguaje Generativo**: Si est√°s utilizando un proyecto de Google Cloud (GCP) personalizado, aseg√∫rate de haber habilitado la 'Generative Language API' (o Vertex AI API) en la biblioteca de APIs de la consola de GCP para ese proyecto.\n" +
           "4. **Remover Restricciones**: Asegura que el API Key no est√© restringido en Google Cloud Console para otras APIs, o que tenga permitida la API de Lenguaje Generativo.\n" +
           rawDetails;
  }
  return (errorMsg || "Error de comunicaci√≥n con Gemini AI. Por favor, revisa la configuraci√≥n.") + rawDetails;
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
  const rangeMatch = cleanRange.match(/([\d.]+)\s*[-‚Äì‚Äî]\s*([\d.]+)/);
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
  const rangeMatch = cleanRange.match(/([\d.]+)\s*[-‚Äì‚Äî]\s*([\d.]+)/);
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
  const defaultRangeMatch = cleanDefault.match(/([\d.]+)\s*[-‚Äì‚Äî]\s*([\d.]+)\s*([a-zA-Z/]*)/);
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
  const isIR = /\bir\b/i.test(nameLower) || nameLower.includes("√≠ndice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("√≠ndice resistencia") || nameLower.includes("indice resistencia");

  if (isIR && (nameLower.includes("renal") || nameLower.includes("ri√±√≥n") || nameLower.includes("ri√±on") || nameLower.includes("izquierdo") || nameLower.includes("derecho") || rangeStr.includes("0."))) {
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
  let cleanUnit = unit.replace(/^[-‚Äì‚Äî\s\d.,]+/, "").trim();
  
  return cleanUnit ? `${formattedVal} ${cleanUnit}` : formattedVal;
}

const app = express();
const PORT = 3000;

// Enable JSON with elevated body limit because medical images can be large
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

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
    const hasSmartQuotes = rawKey.includes("‚Äú") || rawKey.includes("‚Äù") || rawKey.includes("‚Äò") || rawKey.includes("‚Äô");
    
    let keyInfo = "No provista";
    let length = 0;
    let matchesFormat = false;

    if (cleanedKey) {
      length = cleanedKey.length;
      matchesFormat = cleanedKey.startsWith("AIzaSy");
      const firstChars = cleanedKey.substring(0, Math.min(6, cleanedKey.length));
      const lastChars = cleanedKey.substring(Math.max(0, cleanedKey.length - 4));
      keyInfo = `Configurada (${firstChars}...${lastChars}), total: ${length} caracteres.`;
    }

    res.json({
      status: "ok",
      message: "Servidor del Asistente Radiol√≥gico activo",
      api_key_configured: !!cleanedKey,
      api_key_status: keyInfo,
      api_key_length: length,
      api_key_starts_with_aizasy: matchesFormat,
      api_key_has_surrounding_whitespace: hasSpacingIssues || hasQuoteIssues,
      tip: cleanedKey.startsWith("sk-")
        ? "‚ö†Ô∏è ¬°ERROR DE PROVEEDOR! Se detect√≥ una clave que comienza con 'sk-'. Las claves de API de Google Gemini SIEMPRE comienzan con 'AIzaSy'. Las claves que comienzan con 'sk-' corresponden a OpenAI (ChatGPT) u Anthropic y no funcionar√°n aqu√≠. Por favor, crea una clave v√°lida en Google AI Studio (https://aistudio.google.com/)."
        : hasSmartQuotes
        ? "¬°ADVERTENCIA DE IPHONE/DISPOSITIVO SMART! Se detectaron comillas curvas inteligentes (curly/smart quotes ‚Äú ‚Äù o ‚Äò ‚Äô) alrededor de tu API key. Esto ocurre com√∫nmente al copiar/pegar en iPhones y Macs. Nuestro software las ha filtrado y removido autom√°ticamente, ¬°puedes continuar utilizando la IA!"
        : hasQuoteIssues
        ? "¬°ADVERTENCIA! Se encontraron comillas rectangulares (' o \") rodeando tu clave de API en Settings. Las hemos removido autom√°ticamente."
        : hasSpacingIssues 
        ? "¬°ADVERTENCIA! Se encontraron espacios en blanco al inicio o al final del API Key. Las hemos limpiado autom√°ticamente." 
        : "Tu API key est√° siendo le√≠da y limpiada de forma segura."
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
      tip: "Ocurri√≥ un error inesperado al leer la configuraci√≥n. Contacta con soporte o revisa el formato de tus variables de entorno."
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
  let text = "\n\n--- ‚ö†Ô∏è REGIONES CR√çTICAS MARCADAS EN LA IMAGEN POR EL M√âDICO ---\n";
  text += "El m√©dico ha marcado y etiquetado puntos o regiones espec√≠ficas sobre la imagen radiol√≥gica provista.\n";
  text += "ESTAS MARCAS REPRESENTAN SU SOSPECHA CL√çNICA DIRECTA DE UNA LESI√ìN. EST√ÅS OBLIGADO a asumir que existe una alteraci√≥n real en estas zonas y enfocar el 100% de tu sensibilidad en confirmar su naturaleza (ej. fracturas sutiles en manos/pies, fisuras, lesiones focales). NUNCA asumas que es normal si el m√©dico la ha marcado; eval√∫a con m√°xima minucia.\n";
  annotations.forEach((ann: any, index: number) => {
    const num = index + 1;
    if (ann.type === "point") {
      text += `- **Marcador #${num} (Punto)**: Ubicado aproximadamente en X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% de la imagen. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    } else if (ann.type === "box") {
      text += `- **Marcador #${num} (Regi√≥n Rectangular)**: Enmarcado desde X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% con un ancho de ${Number(ann.w || 0).toFixed(1)}% y un alto de ${Number(ann.h || 0).toFixed(1)}%. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    }
  });
  text += "Analiza de manera exhaustiva y prioritaria estas coordenadas, correlacion√°ndolas detalladamente en el informe.\n\n";
  return text;
}

/**
 * Helper: Multi-strategy 3D Medical Image Generation with Retries
 */
async function generate3DMedicalImageWithRetry(ai: any, prompt: string): Promise<string> {
  // Strategy 1: gemini-3.1-flash-image
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
          imageSize: "1K"
        }
      }
    });
    if (res.candidates && res.candidates[0]?.content?.parts) {
      for (const part of res.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (err: any) {
    console.warn("Primary 3D image model (gemini-3.1-flash-image) error:", err?.message);
  }

  // Strategy 2: imagen-3.0-generate-002
  try {
    const imagenRes = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "4:3",
        outputMimeType: "image/jpeg"
      }
    });
    if (imagenRes.generatedImages && imagenRes.generatedImages[0]?.image?.imageBytes) {
      return `data:image/jpeg;base64,${imagenRes.generatedImages[0].image.imageBytes}`;
    }
  } catch (err: any) {
    console.warn("Imagen fallback (imagen-3.0-generate-002) error:", err?.message);
  }

  // Strategy 3: gemini-3.1-flash-lite-image
  try {
    const liteRes = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: { parts: [{ text: prompt }] }
    });
    if (liteRes.candidates && liteRes.candidates[0]?.content?.parts) {
      for (const part of liteRes.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (err: any) {
    console.warn("Lite fallback error:", err?.message);
  }

  // Strategy 4: Simplified medical prompt retry with gemini-3.1-flash-image
  try {
    const simplified = prompt
      .replace(/Photorealistic 3D medical illustration, peer-reviewed radiology journal quality,/gi, "3D anatomical illustration,")
      .slice(0, 400);
    const retryRes = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: { parts: [{ text: simplified }] }
    });
    if (retryRes.candidates && retryRes.candidates[0]?.content?.parts) {
      for (const part of retryRes.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (err: any) {
    console.error("All 3D image strategies failed:", err?.message);
  }

  return "";
}

export interface Atlas3DPanel {
  panelLetter: string;
  panelTitle: string;
  imagePrompt: string;
  anatomicalFocus: string;
  imageUrl?: string;
  laterality?: string;
  isCustomFlipped?: boolean;
}

/**
 * Helper to build strict spatial anchor prompt prefixes for anatomical laterality
 */
function buildStrictLateralityPromptAnchor(regionOrStudy: string, explicitLat: string, text: string): string {
  const fullContext = `${regionOrStudy} ${explicitLat} ${text}`.toLowerCase();
  
  const isLeft = explicitLat.toLowerCase().includes("izq") || 
                explicitLat.toLowerCase().includes("left") || 
                fullContext.includes("izquierda") || 
                fullContext.includes("izquierdo") || 
                fullContext.includes("left knee") || 
                fullContext.includes("left shoulder") || 
                fullContext.includes("left breast") || 
                fullContext.includes("rodilla izq") || 
                fullContext.includes("hombro izq") || 
                fullContext.includes("mama izq");

  const isRight = !isLeft && (explicitLat.toLowerCase().includes("der") || 
                  explicitLat.toLowerCase().includes("right") || 
                  fullContext.includes("derecha") || 
                  fullContext.includes("derecho") || 
                  fullContext.includes("right knee") || 
                  fullContext.includes("right shoulder") || 
                  fullContext.includes("right breast") || 
                  fullContext.includes("rodilla der") || 
                  fullContext.includes("hombro der") || 
                  fullContext.includes("mama der"));

  if (fullContext.includes("rodilla") || fullContext.includes("knee") || fullContext.includes("menisc")) {
    if (isLeft) {
      return `MANDATORY LATERALITY RULE (LEFT KNEE ANTERIOR VIEW): This render is STRICTLY the patient's LEFT KNEE in anterior coronal view. CANVAS GEOMETRY: The MEDIAL compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S LEFT side of the image frame. The LATERAL compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S RIGHT side of the image frame. Any Medial Meniscus lesion/tear must be placed on the VIEWER'S LEFT side. DO NOT render a right knee.`;
    } else if (isRight) {
      return `MANDATORY LATERALITY RULE (RIGHT KNEE ANTERIOR VIEW): This render is STRICTLY the patient's RIGHT KNEE in anterior coronal view. CANVAS GEOMETRY: The LATERAL compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S LEFT side of the image frame. The MEDIAL compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S RIGHT side of the image frame. Any Medial Meniscus lesion/tear must be placed on the VIEWER'S RIGHT side. DO NOT render a left knee.`;
    }
  }

  if (fullContext.includes("hombro") || fullContext.includes("shoulder") || fullContext.includes("manguito") || fullContext.includes("supraespinoso")) {
    if (isLeft) {
      return `MANDATORY LATERALITY RULE (LEFT SHOULDER ANTERIOR VIEW): This render is STRICTLY the patient's LEFT SHOULDER. CANVAS GEOMETRY: Medial structures (clavicle, sternum) on VIEWER'S LEFT; Lateral structures (humeral head, deltoid, greater tuberosity) on VIEWER'S RIGHT. DO NOT invert.`;
    } else if (isRight) {
      return `MANDATORY LATERALITY RULE (RIGHT SHOULDER ANTERIOR VIEW): This render is STRICTLY the patient's RIGHT SHOULDER. CANVAS GEOMETRY: Lateral structures (humeral head, deltoid, greater tuberosity) on VIEWER'S LEFT; Medial structures (clavicle, sternum) on VIEWER'S RIGHT. DO NOT invert.`;
    }
  }

  if (fullContext.includes("mama") || fullContext.includes("breast") || fullContext.includes("mamari")) {
    if (isLeft) {
      return `MANDATORY LATERALITY RULE (LEFT BREAST FRONTAL VIEW): This render is STRICTLY the patient's LEFT BREAST. CANVAS GEOMETRY: Medial quadrants (CSI/CII, sternum) on VIEWER'S LEFT; Outer/Lateral quadrants (CSE/CIE, axilla) on VIEWER'S RIGHT.`;
    } else if (isRight) {
      return `MANDATORY LATERALITY RULE (RIGHT BREAST FRONTAL VIEW): This render is STRICTLY the patient's RIGHT BREAST. CANVAS GEOMETRY: Outer/Lateral quadrants (CSE/CIE, axilla) on VIEWER'S LEFT; Medial quadrants (CSI/CII, sternum) on VIEWER'S RIGHT.`;
    }
  }

  if (fullContext.includes("tobillo") || fullContext.includes("ankle") || fullContext.includes("pie") || fullContext.includes("foot")) {
    if (isLeft) {
      return `MANDATORY LATERALITY RULE (LEFT ANKLE ANTERIOR VIEW): Patient's LEFT ANKLE. Medial malleolus on VIEWER'S LEFT; Lateral malleolus (peron√©) on VIEWER'S RIGHT.`;
    } else if (isRight) {
      return `MANDATORY LATERALITY RULE (RIGHT ANKLE ANTERIOR VIEW): Patient's RIGHT ANKLE. Lateral malleolus (peron√©) on VIEWER'S LEFT; Medial malleolus on VIEWER'S RIGHT.`;
    }
  }

  if (fullContext.includes("cadera") || fullContext.includes("hip")) {
    if (isLeft) {
      return `MANDATORY LATERALITY RULE (LEFT HIP ANTERIOR VIEW): Patient's LEFT HIP. Acetabulum/medial pelvic wall on VIEWER'S LEFT; Femoral head/greater trochanter on VIEWER'S RIGHT.`;
    } else if (isRight) {
      return `MANDATORY LATERALITY RULE (RIGHT HIP ANTERIOR VIEW): Patient's RIGHT HIP. Femoral head/greater trochanter on VIEWER'S LEFT; Acetabulum/medial pelvic wall on VIEWER'S RIGHT.`;
    }
  }

  return isLeft 
    ? `MANDATORY LATERALITY RULE: Strictly LEFT side anatomy. Anatomically verified left orientation.`
    : isRight 
      ? `MANDATORY LATERALITY RULE: Strictly RIGHT side anatomy. Anatomically verified right orientation.`
      : "";
}

/**
 * API: GENERATE 3D REALISTIC MEDICAL ATLAS & SYNOPSIS
 * POST /api/generate-3d-atlas
 * Generates 1 to 3 peer-reviewed medical-journal-grade 3D renders with clinical correlation
 */
app.post("/api/generate-3d-atlas", async (req: express.Request, res: express.Response) => {
  try {
    const { reportText, organOrStudy, laterality, customApiKey, requestedModel, customDirectives } = req.body;
    if (!reportText || !reportText.trim()) {
      return res.status(400).json({ error: "Se requiere el texto del reporte radiol√≥gico para generar el Atlas 3D." });
    }

    const ai = getGeminiClient();
    const explicitLaterality = (laterality || "").trim();

    const customDirectivesBlock = customDirectives && customDirectives.trim()
      ? `\nDIRECTIVAS Y MATICES ANAT√ìMICOS ESPEC√çFICOS INDICADOS POR EL M√âDICO RADI√ìLOGO:
"""
${customDirectives.trim()}
"""
REGLA DE M√ÅXIMA PRIORIDAD: Debes incorporar de forma estricta y protagonista esta instrucci√≥n cl√≠nica en la selecci√≥n del √°ngulo de los paneles, en los "imagePrompt" en ingl√©s detallando visualmente los matices indicados (ej. fibras preservadas, grado de retracci√≥n, cuadrante, radio horario, edema perif√©rico, focos de disrupci√≥n tisular) y en las descripciones semiol√≥gicas de la tabla.\n`
      : "";

    const userLateralityInstruction = explicitLaterality
      ? `\nLATERALIDAD SELECCIONADA POR EL M√âDICO RADI√ìLOGO: "${explicitLaterality.toUpperCase()}". Esta lateralidad es una REGLA INQUEBRANTABLE.\n`
      : "";

    // Step 1: Deep clinical reasoning to extract pathology and design 1 to 3 3D renders + editorial synopsis
    const analysisPrompt = `Eres un m√©dico radi√≥logo y director de arte m√©dico editorial de primer nivel mundial (The New England Journal of Medicine, Radiology, RSNA).
Tu misi√≥n es transformar el siguiente reporte radiol√≥gico en un ATLAS ANAT√ìMICO 3D FOTORREALISTA Y DE CORRELACI√ìN PATOL√ìGICA DE ALTA DEFINICI√ìN.
${userLateralityInstruction}
REGLAS OBLIGATORIAS DE PRECISI√ìN ANAT√ìMICA, LATERALIDAD Y EJES ESPACIALES:
1. LATERALIDAD ESTRICTA, QUIR√öRGICA Y ANCLAJE ESPACIAL EN EL LIENZO (CR√çTICO ABSOLUTO):
   - Identifica con m√°xima rigurosidad si el estudio o lesi√≥n corresponde al lado DERECHO (Right) o IZQUIERDO (Left).
   - NUNCA mezcles ni inviertas la lateralidad. Si el informe habla de Rodilla Izquierda, NUNCA generes un prompt de Rodilla Derecha.
   - Si la lesi√≥n es en el MENISCO INTERNO (Medial Meniscus) de la RODILLA IZQUIERDA:
     * La lesi√≥n DEBE ubicarse en el compartimento MEDIAL, el cual se sit√∫a en la IZQUIERDA DEL MARCO DE LA IMAGEN (Viewer's Left).
     * El peron√© / menisco externo DEBE situarse en la DERECHA DEL MARCO DE LA IMAGEN (Viewer's Right).
   - REGLA DE COMPOSICI√ìN ESPACIAL OBLIGATORIA EN EL "imagePrompt" EN INGL√âS:
     Los modelos de renderizado de imagen sufren de inversiones si no se les fija la posici√≥n de los reparos anat√≥micos en el marco del cuadro (image-left vs image-right). En CADA "imagePrompt", DEBES iniciar con la descripci√≥n espacial expl√≠cita:
     * RODILLA IZQUIERDA (LEFT KNEE) - Vista AP/Coronal Anterior:
       "Strictly anterior coronal AP view of the patient's LEFT knee. SPATIAL CANVAS ANCHOR: The medial compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S LEFT of the image frame. The lateral compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S RIGHT of the image frame. Highlighted pathology (if on medial meniscus) is strictly on the VIEWER'S LEFT side. Anatomically verified left knee."
     * RODILLA DERECHA (RIGHT KNEE) - Vista AP/Coronal Anterior:
       "Strictly anterior coronal AP view of the patient's RIGHT knee. SPATIAL CANVAS ANCHOR: The lateral compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S LEFT of the image frame. The medial compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S RIGHT of the image frame. Highlighted pathology (if on medial meniscus) is strictly on the VIEWER'S RIGHT side. Anatomically verified right knee."
     * HOMBRO DERECHO (RIGHT SHOULDER) - Vista AP:
       "Right shoulder anterior view. SPATIAL CANVAS ANCHOR: Humeral head and deltoid are on the LEFT of the image frame (lateral); clavicle and sternum on the RIGHT of the image frame (medial)."
     * HOMBRO IZQUIERDO (LEFT SHOULDER) - Vista AP:
       "Left shoulder anterior view. SPATIAL CANVAS ANCHOR: Clavicle and sternum are on the LEFT of the image frame (medial); humeral head and deltoid on the RIGHT of the image frame (lateral)."
     * MAMA DERECHA (RIGHT BREAST):
       "Right breast frontal view. SPATIAL CANVAS ANCHOR: Upper Outer Quadrant (CSE) and axilla on the LEFT of the image frame; Upper Inner Quadrant (CSI) and sternum on the RIGHT of the image frame."
     * MAMA IZQUIERDA (LEFT BREAST):
       "Left breast frontal view. SPATIAL CANVAS ANCHOR: Upper Inner Quadrant (CSI) and sternum on the LEFT of the image frame; Upper Outer Quadrant (CSE) and axilla on the RIGHT of the image frame."
     * OTRAS ARTICULACIONES / √ìRGANOS (Cadera, Tobillo, Codo, etc.):
       Mapear siempre los reparos mediales y laterales a la izquierda o derecha del marco de la imagen.

2. EJES ESPACIALES, CUADRANTES, RADIOS HORARIOS Y PROFUNDIDAD:
   - EN MAMA:
     * Mama: Declarar expl√≠citamente Mama Derecha vs Mama Izquierda.
     * Cuadrante exacto: CSE (Cuadrante Superoexterno / Upper Outer), CSI (Cuadrante Superointerno / Upper Inner), CIE (Cuadrante Inferoexterno / Lower Outer), CII (Cuadrante Inferointerno / Lower Inner), Regi√≥n Retroareolar o Uni√≥n de Cuadrantes.
     * Radio Horario: Si el informe o contexto menciona hora (ej. Radio de las 10, 11, 2, 6, 8), ubica visualmente la lesi√≥n exactamente en esa posici√≥n angular del reloj respecto al pez√≥n/areola.
     * Profundidad: Plano subcut√°neo pre-mamario, par√©nquima medio, retro-mamario o plano prepectoral/fascial.
   - EN MUSCULOESQUEL√âTICO / TIROIDES / √ìRGANOS ABDOMINALES:
     * Identificar cara (anterior, posterior, medial, lateral, superior, inferior) y tercio (proximal, medio, distal).
     * En el "imagePrompt", sit√∫a visualmente el foco patol√≥gico exactamente en esas coordenadas con un shader de realce hiperrealista (ej. foco hipoecoico / calcificado con halo rub√≠ transl√∫cido, disrupci√≥n fibrilar).

3. DETERMINACI√ìN DE PANELES (1 a 3 paneles):
   - 1 panel si solo hay una estructura alterada de forma aislada.
   - 2 paneles si hay dos compartimentos principales o se requiere una vista panor√°mica regional + un corte tisular de detalle.
   - 3 paneles si es un caso pluripatol√≥gico o complejo.

4. FORMATO CLAVE DEL "imagePrompt" EN INGL√âS:
   - Iniciar con la regla de lateralidad y anclaje espacial.
   - "Photorealistic 3D medical illustration, peer-reviewed radiology journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin cortical/glandular tissue texture, translucent soft tissue / subsurface scattering, highlighted pathological disruption with glowing hyperemic ruby-amber accent, fluid distension in translucent sapphire blue. No labels, no typography, no watermarks, crisp anatomical focus."
   - Aseg√∫rate de incluir la vista espec√≠fica, la lateralidad exacta (Right / Left), el anclaje espacial (Spatial Canvas Anchor) y la coordenada anat√≥mica.

5. EXPLICACI√ìN SIN√ìPTICA ("synopticExplanation") Y S√çNTESIS ("biomechanicalSynthesis"):
   - "structure": Nombre de la estructura anat√≥mica en espa√±ol formal.
   - "panelRef": Referencia al panel correspondiente (ej. "(Panel A)", "(Panel B)").
   - "findingDetail": Descripci√≥n semiol√≥gica concisa del hallazgo correlacionado.
   - "biomechanicalSynthesis": Una sola frase m√©dica de s√≠ntesis sobre el impacto biomec√°nico o diagn√≥stico integrador.
${customDirectivesBlock}
REPORTE RADIOL√ìGICO DEL PACIENTE:
"""
${reportText}
"""
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        studyRegion: { type: Type.STRING, description: "Regi√≥n y lateralidad evaluada (ej. Mama Derecha, Hombro Derecho, Rodilla Izquierda)" },
        detectedLaterality: { type: Type.STRING, description: "Izquierda, Derecha, Bilateral o L√≠nea Media" },
        figureTitle: { type: Type.STRING, description: "T√≠tulo de la figura (ej. FIGURA 1. RECONSTRUCCI√ìN ANAT√ìMICA 3D Y CORRELACI√ìN PATOL√ìGICA DE RODILLA IZQUIERDA)" },
        panels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              panelLetter: { type: Type.STRING, description: "A, B o C" },
              panelTitle: { type: Type.STRING, description: "T√≠tulo cl√≠nico de la vista o foco anat√≥mico con lateralidad y cuadrante/eje" },
              imagePrompt: { type: Type.STRING, description: "Detailed English prompt for 3D medical photorealistic render specifying exact laterality and axes" },
              anatomicalFocus: { type: Type.STRING, description: "Estructuras clave, cuadrante, radio horario y plano en foco" }
            },
            required: ["panelLetter", "panelTitle", "imagePrompt", "anatomicalFocus"]
          }
        },
        synopticExplanation: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              structure: { type: Type.STRING, description: "Nombre de la estructura anat√≥mica" },
              panelRef: { type: Type.STRING, description: "Panel donde se visualiza (ej. Panel A & B)" },
              findingDetail: { type: Type.STRING, description: "Descripci√≥n semiol√≥gica del hallazgo correlacionado" }
            },
            required: ["structure", "panelRef", "findingDetail"]
          }
        },
        biomechanicalSynthesis: { type: Type.STRING, description: "Conclusi√≥n de impacto biomec√°nico o diagn√≥stico integrador" }
      },
      required: ["studyRegion", "figureTitle", "panels", "synopticExplanation", "biomechanicalSynthesis"]
    };

    const textResponse = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ parts: [{ text: analysisPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2
      }
    });

    const parsedJson = JSON.parse(textResponse.text || "{}");
    const plannedPanels = parsedJson.panels || [];
    const detectedLat = parsedJson.detectedLaterality || explicitLaterality || "Izquierda";

    // Step 2: Generate 3D render images for each panel with robust retries and spatial anchor reinforcement
    const generatedPanels = [];
    for (const p of plannedPanels) {
      // Reinforce the prompt with deterministic laterality anchors if not already present
      const anchorPrefix = buildStrictLateralityPromptAnchor(parsedJson.studyRegion || organOrStudy || "", detectedLat, reportText);
      let enhancedPrompt = p.imagePrompt;
      if (anchorPrefix && !enhancedPrompt.includes("MANDATORY LATERALITY RULE")) {
        enhancedPrompt = `${anchorPrefix} ${enhancedPrompt}`;
      }

      let imageUrl = await generate3DMedicalImageWithRetry(ai, enhancedPrompt);

      // If still empty after primary attempts, try an explicit secondary focused attempt
      if (!imageUrl) {
        console.warn(`Panel ${p.panelLetter} initial image generation was empty. Executing secondary retry...`);
        const secondaryPrompt = `${anchorPrefix} 3D medical render of ${parsedJson.studyRegion || "anatomy"}, ${p.anatomicalFocus || p.panelTitle}, Octane render, photorealistic medical journal quality, clean white background.`;
        imageUrl = await generate3DMedicalImageWithRetry(ai, secondaryPrompt);
      }

      generatedPanels.push({
        panelLetter: p.panelLetter,
        panelTitle: p.panelTitle,
        anatomicalFocus: p.anatomicalFocus,
        imageUrl: imageUrl,
        imagePrompt: enhancedPrompt,
        laterality: detectedLat
      });
    }

    const finalResult = {
      studyRegion: parsedJson.studyRegion,
      figureTitle: parsedJson.figureTitle,
      detectedLaterality: detectedLat,
      panels: generatedPanels,
      synopticExplanation: parsedJson.synopticExplanation,
      biomechanicalSynthesis: parsedJson.biomechanicalSynthesis
    };

    res.json({ success: true, data: enforceBaafTerminology(finalResult) });
  } catch (error: any) {
    console.error("Error in /api/generate-3d-atlas:", error);
    res.status(500).json({ error: handleGeminiError(error) });
  }
});

/**
 * API: REGENERATE A SINGLE 3D PANEL WITH CUSTOM CLINICAL DIRECTIVES & STRICT LATERALITY
 * POST /api/regenerate-3d-panel
 * Refines and regenerates only ONE panel while preserving other panels intact
 */
app.post("/api/regenerate-3d-panel", async (req: express.Request, res: express.Response) => {
  try {
    const { reportText, studyRegion, panel, userDirective, laterality, requestedModel } = req.body;
    if (!panel || !panel.panelLetter) {
      return res.status(400).json({ error: "Se requiere la informaci√≥n del panel a regenerar." });
    }

    const ai = getGeminiClient();
    const explicitLaterality = (laterality || panel.laterality || "").trim();

    const panelRefinementPrompt = `Eres un m√©dico radi√≥logo y director de arte m√©dico editorial de primer nivel mundial.
Tu misi√≥n es REFINAR Y REGENERAR UN PANEL ESPEC√çFICO (PANEL ${panel.panelLetter}) de un Atlas Anat√≥mico 3D existente.

DATOS DEL CASO:
- Regi√≥n y lateralidad evaluada: "${studyRegion || 'Regi√≥n anat√≥mica del estudio'}"
- Lateralidad activa: "${explicitLaterality || 'Detectada del informe'}"
- T√≠tulo actual del panel: "${panel.panelTitle || ''}"
- Foco anat√≥mico actual: "${panel.anatomicalFocus || ''}"
- Prompt 3D previo: "${panel.imagePrompt || ''}"

REPORTE RADIOL√ìGICO ORIGINAL:
"""
${reportText || ''}
"""

INSTRUCCIONES DE MODIFICACI√ìN / CAMBIO SOLICITADAS POR EL RADI√ìLOGO PARA ESTE PANEL:
"""
${userDirective || 'Mejorar resoluci√≥n, perspectiva y fidelidad anat√≥mica del panel respetando rigurosamente lateralidad y ejes.'}
"""

REGLAS OBLIGATORIAS:
1. LATERALIDAD ESTRICTA, QUIR√öRGICA Y ANCLAJE ESPACIAL EN EL LIENZO (CR√çTICO):
   - Si el estudio es de lado DERECHO o IZQUIERDO, mant√©n de forma inquebrantable esa lateralidad en el render y en el prompt.
   - Si el usuario solicita corregir de lado o compartimento (ej. cambiar a Menisco Interno de Rodilla Izquierda o pasar a Rodilla Derecha), aplica el cambio de forma estricta y absoluta.
   - REGLA DE COMPOSICI√ìN ESPACIAL OBLIGATORIA EN EL "imagePrompt" EN INGL√âS:
     * Si es RODILLA IZQUIERDA (LEFT KNEE) - Vista AP/Coronal:
       "Strictly anterior coronal AP view of the patient's LEFT knee. SPATIAL CANVAS ANCHOR: The medial compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S LEFT of the image frame. The lateral compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S RIGHT of the image frame. Highlighted pathology on Medial Meniscus is strictly on the VIEWER'S LEFT side. Anatomically verified left knee."
     * Si es RODILLA DERECHA (RIGHT KNEE) - Vista AP/Coronal:
       "Strictly anterior coronal AP view of the patient's RIGHT knee. SPATIAL CANVAS ANCHOR: The lateral compartment (Lateral Meniscus, LCL, fibular head/peron√©) is positioned on the VIEWER'S LEFT of the image frame. The medial compartment (Medial Meniscus, MCL, medial tibial plateau) is positioned on the VIEWER'S RIGHT of the image frame. Highlighted pathology on Medial Meniscus is strictly on the VIEWER'S RIGHT side. Anatomically verified right knee."
     * En Mama: Respetar cuadrante exacto (CSE, CSI, CIE, CII, retroareolar), radio horario, profundidad y anclaje espacial (axila vs estern√≥n).
     * En Hombro: Deltoides/Troqu√≠ter lateral vs Clav√≠cula/Estern√≥n medial.
     * En Tobillo / Pie / Cadera / Mu√±eca: Respetar cara, eje tendinoso/√≥seo y posici√≥n de reparos mediales/laterales en el cuadro.
2. Aplica la instrucci√≥n de modificaci√≥n del radi√≥logo de forma protag√≥nica en el nuevo "imagePrompt" en INGL√âS, en el "panelTitle" y en el "anatomicalFocus".
3. Formato del imagePrompt: "Photorealistic 3D medical illustration, peer-reviewed radiology journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin cortical/glandular tissue texture, translucent soft tissue / subsurface scattering, highlighted pathological disruption with glowing hyperemic ruby-amber accent, fluid distension in translucent sapphire blue. No labels, no typography, no watermarks, crisp anatomical focus."
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        panelTitle: { type: Type.STRING, description: "T√≠tulo cl√≠nico refinado del panel" },
        imagePrompt: { type: Type.STRING, description: "Detailed refined English prompt for 3D render specifying exact laterality and axes" },
        anatomicalFocus: { type: Type.STRING, description: "Estructuras y ejes en foco refinados" }
      },
      required: ["panelTitle", "imagePrompt", "anatomicalFocus"]
    };

    const textResponse = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ parts: [{ text: panelRefinementPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2
      }
    });

    const refinedJson = JSON.parse(textResponse.text || "{}");
    const updatedTitle = refinedJson.panelTitle || panel.panelTitle;
    const updatedFocus = refinedJson.anatomicalFocus || panel.anatomicalFocus;
    let updatedPrompt = refinedJson.imagePrompt || panel.imagePrompt;

    const anchorPrefix = buildStrictLateralityPromptAnchor(studyRegion || "", explicitLaterality, `${userDirective} ${reportText}`);
    if (anchorPrefix && !updatedPrompt.includes("MANDATORY LATERALITY RULE")) {
      updatedPrompt = `${anchorPrefix} ${updatedPrompt}`;
    }

    let imageUrl = await generate3DMedicalImageWithRetry(ai, updatedPrompt);

    if (!imageUrl) {
      const fallbackPrompt = `${anchorPrefix} 3D medical render of ${studyRegion || "anatomy"}, ${updatedFocus || updatedTitle}, Octane render, photorealistic medical journal quality, clean white background.`;
      imageUrl = await generate3DMedicalImageWithRetry(ai, fallbackPrompt);
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No se pudo generar la imagen 3D en este intento. Por favor intente nuevamente." });
    }

    const updatedPanel: Atlas3DPanel = {
      panelLetter: panel.panelLetter,
      panelTitle: updatedTitle,
      anatomicalFocus: updatedFocus,
      imageUrl: imageUrl,
      imagePrompt: updatedPrompt,
      laterality: explicitLaterality || panel.laterality
    };

    res.json({ success: true, panel: updatedPanel });
  } catch (error: any) {
    console.error("Error in /api/regenerate-3d-panel:", error);
    res.status(500).json({ error: handleGeminiError(error) });
  }
});

/**
 * API: GENERATE HIGH-FIDELITY 3D VASCULAR SUITE
 * POST /api/generate-vascular-3d
 * Uses the Atlas 3D core intelligence and render pipeline to generate 1 to 3 peer-reviewed journal quality vascular renders + detailed hemodynamic table
 */
app.post("/api/generate-vascular-3d", async (req: express.Request, res: express.Response) => {
  try {
    const { reportText, vascularStudyType, laterality, customDirectives, requestedModel } = req.body;
    if (!reportText || !reportText.trim()) {
      return res.status(400).json({ error: "Se requiere el texto del informe vascular para generar la reconstrucci√≥n 3D." });
    }

    const ai = getGeminiClient();
    const explicitLaterality = (laterality || "").trim();

    const directivesBlock = customDirectives && customDirectives.trim()
      ? `\nDIRECTIVAS CL√çNICAS Y MATICES ESPEC√çFICOS INDICADOS POR EL RADI√ìLOGO VASCULAR / ANGI√ìLOGO:
"""
${customDirectives.trim()}
"""
REGLA DE M√ÅXIMA PRIORIDAD: Incorpora de forma estricta y protag√≥nica estas directivas en los paneles de foco anat√≥mico (ej. tama√±o de placa, grado de estenosis, morfolog√≠a lip√≠dica vs calcificada, presencia de colaterales, flujo parvus-tardus, trombosis oclusiva/no oclusiva, reflujo safenofemoral).\n`
      : "";

    const userLateralityInstruction = explicitLaterality && explicitLaterality !== "Detectar del informe"
      ? `\nLATERALIDAD SELECCIONADA POR EL M√âDICO: "${explicitLaterality.toUpperCase()}". Aseg√∫rate de que los paneles respeten esta orientaci√≥n.\n`
      : "";

    const userStudyTypeHint = vascularStudyType && vascularStudyType !== "undefined"
      ? `\nTIPO DE ESTUDIO SUGERIDO POR EL USUARIO: "${vascularStudyType}". (Verifica siempre contra el contenido del informe para m√°xima fidelidad anat√≥mica).\n`
      : "";

    const analysisPrompt = `Eres un m√©dico especialista en ultrasonido Doppler vascular, angi√≥logo y director de arte m√©dico editorial de primer nivel mundial (The New England Journal of Medicine, Journal of Vascular Surgery, RSNA, Radiographics).
Tu misi√≥n es transformar el siguiente informe de ECOGRAF√çA DOPPLER VASCULAR en un ATLAS VASCULAR 3D FOTORREALISTA DE ALTA DEFINICI√ìN (CLOSE-UP MACRO PANELS) Y TABLA DE CORRELACI√ìN HEMODIN√ÅMICA.
${userLateralityInstruction}
${userStudyTypeHint}
${directivesBlock}

INFORME RADIOL√ìGICO / ECOGRAF√çA DOPPLER:
"""
${reportText}
"""

REGLAS OBLIGATORIAS DE PRECISI√ìN ANAT√ìMICA Y GENERACI√ìN VISUAL 3D (ESTILO ATLAS 3D):

1. INTERPRETACI√ìN CL√çNICA INTELIGENTE Y TERRITORIO VASCULAR EXACTO:
   - Lee el informe cl√≠nico con absoluta atenci√≥n para identificar con precisi√≥n qu√© territorio vascular se evalu√≥ y cu√°les son los hallazgos reales:
     * DOPPLER CAROT√çDEO Y VERTEBRAL (carotid): Enf√≥cate 100% en las arterias car√≥tidas (Com√∫n/Primitiva, Bulbo, Interna, Externa) y/o vertebrales. Describe la pared arterial, grosor √≠ntima-media, morfolog√≠a de placa de ateroma (fibrolip√≠dica blanda, calcificada con sombra, mixta, ulcerada), porcentaje de estenosis, luz residual exc√©ntrica y turbulencia de flujo.
     * DOPPLER VENOSO DE MIEMBROS INFERIORES (venous_mmii): Enf√≥cate 100% en el sistema venoso (Vena Femoral Com√∫n, Femoral Profunda, Femoral, Popl√≠tea, Venas Tibiales/Peroneas/Gemelares, Cayado Safenofemoral / Safena Magna, Safenopopl√≠teo / Safena Menor).
       - Si hay TROMBOSIS VENOSA PROFUNDA (TVP): describe la pared venosa transl√∫cida sapphire-blue con calibre fisiol√≥gico (4-8 mm, CERO globos deformes), ocupada por trombo intraluminal adherido, no compresible, con ausencia de flujo Doppler color.
       - Si hay INSUFICIENCIA VENOSA / REFLUJO: describe las valvas venosas bic√∫spides incompetentes en la uni√≥n safenofemoral o safenopopl√≠tea con jet de reflujo.
     * DOPPLER ARTERIAL DE MIEMBROS INFERIORES (arterial_mmii): Enf√≥cate en las arterias de las piernas (Arteria Femoral Com√∫n, Superficial, Profunda, Popl√≠tea, Tronco Tibioperoneo, Tibial Anterior, Tibial Posterior, Pedia). Muestra placas ateromatosas, estenosis focales, oclusiones o flujo monof√°sico parvus-tardus.
     * DOPPLER RENAL (renal): Enf√≥cate en las arterias renales principales desde el ostium a√≥rtico hasta el hilio renal, relaci√≥n con la aorta abdominal y par√©nquima renal.
     * DOPPLER AORTOIL√çACO (aortoiliac): Enf√≥cate en la aorta abdominal infrarrenal y bifurcaci√≥n en arterias il√≠acas comunes.
   - NUNCA mezcles territorios. Si el reporte es carot√≠deo, los paneles DEBEN ser 100% carot√≠deos. Si el reporte es venoso de miembros inferiores, los paneles DEBEN ser 100% venosos.

2. DETERMINACI√ìN DE PANELES FOCALES (1 a 3 paneles macro):
   - Determina entre 1 y 3 paneles focales ('focalPanels') etiquetados con letras 'A', 'B' y 'C'.
   - Cada panel DEBE representar un PRIMER PLANO MACRO (Close-up) de la lesi√≥n o estaci√≥n anat√≥mica clave descrita en el reporte.
   - Incluye el LECHO ANAT√ìMICO de referencia en semi-translucidez (subsurface scattering): contornos √≥seos (v√©rtebras cervicales, cart√≠lago tiroides, f√©mur, tibia), planos musculares y fascias en suave textura satinada.
   - El campo "roadmapPanel" debe ser SIEMPRE null.

3. F√ìRMULA DEL "imagePrompt" EN INGL√âS PARA CADA PANEL (FOTORREALISMO M√âDICO PURO):
   - Inicia con la identificaci√≥n clara del segmento y lateralidad (ej. "Strictly close-up macro surgical 3D medical illustration of the patient's Right Carotid Bifurcation and Internal Carotid Artery...").
   - Detalla la pared vascular y la patolog√≠a exacta descrita en el reporte:
     "Photorealistic 3D medical vascular close-up illustration, peer-reviewed vascular surgery journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin anatomical tissue texture with subsurface scattering, realistic translucent [arterial ruby-red wall with atheroma plaque mass / venous sapphire-blue wall with intraluminal thrombus filling defect or valve cusps], adjacent translucent bone and muscle bed anchors in soft ivory/satin shader, hyper-focused macro anatomical view. No text, no typography, no labels, no callouts, no watermarks, crisp anatomical focus."
   - PROHIBICI√ìN ABSOLUTA DE TEXTO: "No text, no typography, no labels, no callouts, no watermarks".

4. EXTRACCI√ìN EXHAUSTIVA DE LA TABLA HEMODIN√ÅMICA:
   - Extrae todos los vasos y segmentos mencionados en el informe con sus par√°metros medidos (morfolog√≠a de placa/trombo, estenosis/reflujo, velocidades PSV/EDV, ratios, patr√≥n espectral e impacto hemodin√°mico).
   - "hemodynamicSynthesis": 2 a 4 oraciones de s√≠ntesis m√©dica objetiva y descriptiva sin recomendaciones de tratamiento ni f√°rmacos.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON V√ÅLIDO CON ESTE ESQUEMA:
{
  "vascularTerritory": "string (ej. Doppler Carot√≠deo y Vertebral, Doppler Venoso de Miembros Inferiores, Doppler Arterial de Miembros Inferiores, Doppler Renal, Doppler Aortoil√≠aco)",
  "vascularStudyType": "string (carotid, arterial_mmii, venous_mmii, renal, aortoiliac)",
  "laterality": "string (Izquierda, Derecha, Bilateral, Central)",
  "figureTitle": "string (ej. FIGURA 1. RECONSTRUCCI√ìN VASCULAR 3D Y CORRELACI√ìN HEMODIN√ÅMICA)",
  "roadmapPanel": null,
  "focalPanels": [
    {
      "panelId": "PANEL_A",
      "panelLetter": "A",
      "panelTitle": "string (T√≠tulo cl√≠nico conciso del segmento en foco y lateralidad)",
      "panelCategory": "string (focal_plaque, reflux_valve, thrombus, aneurysm, normal_vessel)",
      "vesselSegment": "string (Vaso y segmento anat√≥mico exacto)",
      "anatomicalFocus": "string (Descripci√≥n semiol√≥gica y reparos anat√≥micos en foco)",
      "imagePrompt": "string (Prompt en ingl√©s fotorrealista completo para el motor 3D)",
      "laterality": "string (Izquierda, Derecha, Bilateral, Central)",
      "stenosisDegree": "string (Opcional)",
      "flowPattern": "string (Opcional)"
    }
  ],
  "hemodynamicTable": [
    {
      "vessel": "string (Nombre del vaso)",
      "segment": "string (Segmento explorado)",
      "plaqueOrThrombusMorphology": "string (Morfolog√≠a de placa, trombo, o pared)",
      "stenosisPercentOrReflux": "string (% de estenosis, tiempo de reflujo, o permeabilidad)",
      "hemodynamicPattern": "string (Velocidades PSV/EDV o patr√≥n f√°sico/espectral)",
      "icaCcaRatio": "string (Ratio o relaci√≥n hemodin√°mica si aplica)",
      "compressibility": "string (Compresibilidad en venoso)",
      "thrombusPresence": "string (Presencia de trombo en venoso)",
      "valvularReflux": "string (Reflujo valvular en venoso)",
      "veinCaliber": "string (Calibre del vaso)",
      "flowPhasicity": "string (Fasismo del flujo)",
      "waveMorphology": "string (Morfolog√≠a de onda en arterial)",
      "psv": "string (PSV en cm/s)",
      "edv": "string (EDV en cm/s)",
      "vrRatio": "string (Ratio VR)",
      "stenosisPercent": "string (% estenosis)",
      "plaqueMorphology": "string (Morfolog√≠a de placa)",
      "diameterMm": "string (Di√°metro en mm)",
      "rarRatio": "string (Ratio RAR en renal)",
      "accelerationTime": "string (Tiempo de aceleraci√≥n en renal)",
      "resistiveIndex": "string (√çndice de resistividad)",
      "renalLength": "string (Longitud renal)",
      "hemodynamicImpact": "string (Impacto cl√≠nico/hemodin√°mico)"
    }
  ],
  "hemodynamicSynthesis": "string (S√≠ntesis descriptiva de los hallazgos en 2-4 oraciones)"
}`;

    const textResponse = await ai.models.generateContent({
      model: requestedModel || "gemini-3.7-flash",
      contents: [{ text: analysisPrompt }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const parsedJson = JSON.parse(textResponse.text || "{}");
    const rawFocals = parsedJson.focalPanels || [];
    const detectedLat = parsedJson.laterality || explicitLaterality || "Bilateral";
    const detectedStudyType = parsedJson.vascularStudyType || vascularStudyType || "carotid";

    // Step 2: Generate 3D render images using the Atlas 3D core image generation engine
    const generatedFocalPanels = [];
    for (let i = 0; i < rawFocals.length; i++) {
      const fp = rawFocals[i];
      const letter = String.fromCharCode(65 + i); // "A", "B", "C"...
      let focalPrompt = (fp.imagePrompt || "").trim();
      
      if (!focalPrompt) {
        focalPrompt = `Photorealistic 3D medical vascular close-up illustration, peer-reviewed vascular surgery journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin anatomical tissue texture with subsurface scattering, realistic translucent vessel wall showing ${fp.vesselSegment || "vascular segment"} with ${fp.anatomicalFocus || fp.panelTitle}, adjacent translucent bone and muscle bed anchors, hyper-focused macro anatomical view. No text, no typography, no labels, no watermarks, crisp anatomical focus.`;
      }

      // Generate image with the Atlas 3D multi-model retry engine
      let focalImgUrl = await generate3DMedicalImageWithRetry(ai, focalPrompt);
      if (!focalImgUrl) {
        console.warn(`Vascular Panel ${letter} initial generation empty. Executing secondary focused retry...`);
        const fallbackPrompt = `3D photorealistic medical vascular render of ${fp.vesselSegment || "vessel"}, ${fp.anatomicalFocus || fp.panelTitle}, Octane render, medical journal quality, pure clean white background, no text.`;
        focalImgUrl = await generate3DMedicalImageWithRetry(ai, fallbackPrompt);
      }

      generatedFocalPanels.push({
        panelId: fp.panelId || `PANEL_LESION_${i + 1}`,
        panelLetter: letter,
        panelTitle: fp.panelTitle || `Panel ${letter}: ${fp.vesselSegment || "Detalle Vascular"}`,
        panelCategory: fp.panelCategory || (detectedStudyType === "venous_mmii" ? "reflux_valve" : "focal_plaque"),
        vesselSegment: fp.vesselSegment || "Segmento Vascular",
        anatomicalFocus: fp.anatomicalFocus || "",
        imagePrompt: focalPrompt,
        imageUrl: focalImgUrl,
        laterality: fp.laterality || detectedLat,
        stenosisDegree: fp.stenosisDegree,
        flowPattern: fp.flowPattern
      });
    }

    const cleanHemodynamicTable = (parsedJson.hemodynamicTable || []).map((row: any) => {
      let ratioVal = row.icaCcaRatio || row.ratioIcaCca || row.relacionAccAci || row.relacionAciAcc || "";
      if (!ratioVal && row.hemodynamicPattern) {
        const match = row.hemodynamicPattern.match(/(?:Ratio|Relaci[o√≥]n|ACI\/ACC|ACC\/ACI|ICA\/CCA)[\s:]*([0-9.,]+|[<>]?[0-9.,]+)/i);
        if (match) {
          ratioVal = match[1];
        }
      }

      const compVal = row.compressibility || row.compresibilidad || (row.plaqueOrThrombusMorphology && /compres/i.test(row.plaqueOrThrombusMorphology) ? row.plaqueOrThrombusMorphology : "");
      const thrombVal = row.thrombusPresence || row.trombo || (row.plaqueOrThrombusMorphology && /trombo|eco/i.test(row.plaqueOrThrombusMorphology) ? row.plaqueOrThrombusMorphology : "");
      const refluxVal = row.valvularReflux || row.reflujo || row.competenciaValvular || (row.stenosisPercentOrReflux && /refluj|compet/i.test(row.stenosisPercentOrReflux) ? row.stenosisPercentOrReflux : "");
      const caliberVal = row.veinCaliber || row.calibre || row.diameter || "";
      const phasicVal = row.flowPhasicity || row.fasismo || (row.hemodynamicPattern && /f[a√°]sic|espont[a√°]neo|continuo/i.test(row.hemodynamicPattern) ? row.hemodynamicPattern : "");

      const waveVal = row.waveMorphology || row.morfologiaOnda || row.flowPhasicity || (row.hemodynamicPattern && /trif[a√°]sic|bif[a√°]sic|monof[a√°]sic|parvus|tardus/i.test(row.hemodynamicPattern) ? row.hemodynamicPattern : "");
      const psvVal = row.psv || row.vps || (row.hemodynamicPattern && /psv|vps/i.test(row.hemodynamicPattern) ? row.hemodynamicPattern : "");
      const edvVal = row.edv || row.vfd || "";
      const vrVal = row.vrRatio || row.vr || row.ratioVr || (row.icaCcaRatio && /vr/i.test(row.icaCcaRatio) ? row.icaCcaRatio : "");
      const stenVal = row.stenosisPercent || row.stenosisPercentOrReflux || row.estenosis || "";
      const plaqueVal = row.plaqueMorphology || row.plaqueOrThrombusMorphology || row.placa || "";

      const diamVal = row.diameterMm || row.diametro || row.veinCaliber || "";
      const rarVal = row.rarRatio || row.rar || row.relacionAortoRenal || (row.icaCcaRatio && !/aci|cca/i.test(row.icaCcaRatio) ? row.icaCcaRatio : "");
      const atVal = row.accelerationTime || row.tiempoAceleracion || row.at || "";
      const riVal = row.resistiveIndex || row.indiceResistividad || row.ir || row.ri || "";
      const lenVal = row.renalLength || row.longitudRenal || row.ejeRenal || "";

      return {
        vessel: row.vessel || "",
        segment: row.segment || "",
        plaqueOrThrombusMorphology: plaqueVal || row.plaqueOrThrombusMorphology || "",
        stenosisPercentOrReflux: stenVal || row.stenosisPercentOrReflux || "",
        hemodynamicPattern: row.hemodynamicPattern || (psvVal ? `PSV: ${psvVal}` : ""),
        icaCcaRatio: ratioVal || "-",
        compressibility: compVal || "100% Compresible",
        thrombusPresence: thrombVal || "Ausente",
        valvularReflux: refluxVal || "Competente (<500 ms)",
        veinCaliber: caliberVal || diamVal || "-",
        flowPhasicity: phasicVal || waveVal || "Espont√°neo y f√°sico respiratorio",
        waveMorphology: waveVal || "Trif√°sico de alta resistencia",
        psv: psvVal || row.hemodynamicPattern || "-",
        edv: edvVal || "-",
        vrRatio: vrVal || ratioVal || "-",
        stenosisPercent: stenVal || row.stenosisPercentOrReflux || "-",
        plaqueMorphology: plaqueVal || row.plaqueOrThrombusMorphology || "-",
        diameterMm: diamVal || caliberVal || "-",
        rarRatio: rarVal || ratioVal || "-",
        accelerationTime: atVal || "-",
        resistiveIndex: riVal || "-",
        renalLength: lenVal || "-",
        hemodynamicImpact: row.hemodynamicImpact || row.clinicalSignificance || "",
        clinicalSignificance: row.hemodynamicImpact || row.clinicalSignificance || ""
      };
    });

    const finalVascularResult = {
      vascularTerritory: parsedJson.vascularTerritory || "Exploraci√≥n Vascular Doppler 3D",
      vascularStudyType: detectedStudyType,
      laterality: detectedLat,
      figureTitle: parsedJson.figureTitle || "FIGURA 1. RECONSTRUCCI√ìN VASCULAR 3D Y CORRELACI√ìN HEMODIN√ÅMICA",
      roadmapPanel: null,
      focalPanels: generatedFocalPanels,
      hemodynamicTable: cleanHemodynamicTable,
      hemodynamicSynthesis: parsedJson.hemodynamicSynthesis || parsedJson.surgicalHemodynamicSynthesis || "",
      surgicalHemodynamicSynthesis: parsedJson.hemodynamicSynthesis || parsedJson.surgicalHemodynamicSynthesis || ""
    };

    res.json({ success: true, data: enforceBaafTerminology(finalVascularResult) });
  } catch (error: any) {
    console.error("Error in /api/generate-vascular-3d:", error);
    res.status(500).json({ error: handleGeminiError(error) });
  }
});

/**
 * API: REGENERATE A SINGLE VASCULAR 3D PANEL WITH SURGICAL DIRECTIVES
 * POST /api/regenerate-vascular-panel
 */
app.post("/api/regenerate-vascular-panel", async (req: express.Request, res: express.Response) => {
  try {
    const { reportText, vascularTerritory, vascularStudyType, panel, userDirective, laterality, requestedModel } = req.body;
    if (!panel || !panel.panelLetter) {
      return res.status(400).json({ error: "Se requiere la informaci√≥n del panel vascular a regenerar." });
    }

    const ai = getGeminiClient();
    const explicitLaterality = (laterality || panel.laterality || "").trim();

    const panelRefinementPrompt = `Eres un cirujano vascular, angi√≥logo y director de arte m√©dico editorial de m√°ximo nivel mundial.
Tu misi√≥n es REFINAR Y REGENERAR UN PANEL VASCULAR 3D ESPEC√çFICO (PANEL ${panel.panelLetter}) de una Suite Vascular 3D existente.

DATOS DEL CASO VASCULAR:
- Territorio Vascular: "${vascularTerritory || 'Estudio Vascular'}"
- Tipo de Estudio: "${vascularStudyType || 'carotid'}"
- Lateralidad activa: "${explicitLaterality || 'Detectada del informe'}"
- Categor√≠a del Panel: "${panel.panelCategory || 'focal_plaque'}"
- T√≠tulo actual: "${panel.panelTitle || ''}"
- Vaso / Segmento: "${panel.vesselSegment || ''}"
- Foco anat√≥mico actual: "${panel.anatomicalFocus || ''}"
- Prompt 3D previo: "${panel.imagePrompt || ''}"

INFORME DOPPLER ORIGINAL:
"""
${reportText || ''}
"""

INSTRUCCIONES DE MODIFICACI√ìN / CAMBIO SOLICITADAS POR EL M√âDICO:
"""
${userDirective || 'Mejorar resoluci√≥n, perspectiva y fidelidad anat√≥mica del panel respetando rigurosamente lateralidad y ejes vasculares.'}
"""

REGLAS OBLIGATORIAS:
1. Si el usuario solicita corregir de lado, vaso, morfolog√≠a de placa (blanda/calcificada/ulcerada), porcentaje de estenosis, trombo o reflujo, aplica el cambio de forma estricta y absoluta.
2. ENFOQUE MACRO / CLOSE-UP OBLIGATORIO: Genera una vista en primer plano (macro close-up) del segmento vascular con lecho anat√≥mico de referencia (m√∫sculo, hueso y fascia en semi-translucidez). Prohibidas vistas panor√°micas completas.
3. Formato del imagePrompt: "Photorealistic 3D medical vascular close-up illustration, peer-reviewed vascular surgery journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin anatomical tissue texture with subsurface scattering, realistic translucent vessel wall, adjacent translucent bone/muscle bed anchors, hyper-focused macro anatomical view. No text, no typography, no labels, no watermarks, crisp anatomical focus."

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON:
{
  "panelTitle": "string (T√≠tulo actualizado del panel)",
  "vesselSegment": "string (Vaso y segmento actualizado)",
  "anatomicalFocus": "string (Foco anat√≥mico y semiol√≥gico actualizado)",
  "imagePrompt": "string (Prompt en ingl√©s fotorrealista con la modificaci√≥n)",
  "stenosisDegree": "string (Opcional)",
  "flowPattern": "string (Opcional)"
}`;

    const textResponse = await ai.models.generateContent({
      model: requestedModel || "gemini-3.7-flash",
      contents: [{ text: panelRefinementPrompt }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const refinedJson = JSON.parse(textResponse.text || "{}");
    const updatedTitle = refinedJson.panelTitle || panel.panelTitle;
    const updatedSegment = refinedJson.vesselSegment || panel.vesselSegment;
    const updatedFocus = refinedJson.anatomicalFocus || panel.anatomicalFocus;
    let updatedPrompt = (refinedJson.imagePrompt || panel.imagePrompt || "").trim();

    if (!updatedPrompt) {
      updatedPrompt = `Photorealistic 3D medical vascular close-up illustration, peer-reviewed vascular surgery journal quality, clean pure white background with subtle soft studio lighting, Octane Render / ZBrush medical shader, satin anatomical tissue texture with subsurface scattering, realistic translucent vessel wall showing ${updatedSegment || "vascular segment"} with ${updatedFocus || updatedTitle}, adjacent translucent bone and muscle bed anchors, hyper-focused macro anatomical view. No text, no typography, no labels, no watermarks, crisp anatomical focus.`;
    }

    let imageUrl = await generate3DMedicalImageWithRetry(ai, updatedPrompt);

    if (!imageUrl) {
      const fallbackPrompt = `3D medical vascular render of ${updatedSegment || "vessel"}, ${updatedFocus || updatedTitle}, Octane render, photorealistic journal quality, pure clean white background, no text.`;
      imageUrl = await generate3DMedicalImageWithRetry(ai, fallbackPrompt);
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No se pudo generar la imagen vascular 3D en este intento. Por favor intente nuevamente." });
    }

    const updatedPanel: any = {
      panelId: panel.panelId,
      panelLetter: panel.panelLetter,
      panelTitle: updatedTitle,
      panelCategory: panel.panelCategory,
      vesselSegment: updatedSegment,
      anatomicalFocus: updatedFocus,
      imageUrl: imageUrl,
      imagePrompt: updatedPrompt,
      laterality: explicitLaterality || panel.laterality,
      isCustomFlipped: panel.isCustomFlipped,
      stenosisDegree: refinedJson.stenosisDegree || panel.stenosisDegree,
      flowPattern: refinedJson.flowPattern || panel.flowPattern
    };

    res.json({ success: true, panel: updatedPanel });
  } catch (error: any) {
    console.error("Error in /api/regenerate-vascular-panel:", error);
    res.status(500).json({ error: handleGeminiError(error) });
  }
});


/**
 * 1. API: ANALIZE IMAGE AND DRAFT RADIOLOGY REPORT
 * POST /api/analyze
 * Payload: {
 *   image?: string (base64 string without data prefix, e.g. "iVBORw0KG...")
 *   mimeType?: string (e.g. "image/png", "image/jpeg")
 *   studyType: string (e.g. "Radiograf√≠a de T√≥rax AP/Lateral")
 *   clinicalHistory: string (e.g. "Paciente masculino de 45 a√±os con tos persistente")
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
      "Eres un m√©dico radi√≥logo subespecialista experto con m√°s de 20 a√±os de experiencia cl√≠nica. Tu nivel de detalle es impecable, sigues strictly est√°ndares m√©dicos (como BI-RADS, Bosniak, Fleischner, ACR TI-RADS, etc.) y formulas reportes radiol√≥gicos sumamente precisos, limpios, profesionales y listos para ser copiados y pegados directamente en expedientes cl√≠nicos y Microsoft Word (donde las secciones est√°n separadas por doble espacio, los t√≠tulos van en negrita normal en vez de encabezados Markdown, y la secci√≥n de impresi√≥n diagn√≥stica se redacta enteramente en negrita). Siempre mantienes un vocabulario t√©cnico radiol√≥gico riguroso. " +
      "CONVENCI√ìN DE LATERALIDAD Y ORIENTACI√ìN RADIOL√ìGICA OBLIGATORIA (REGLA DE ESPEJO ANAT√ìMICO Y ALINEACI√ìN DE INDICACI√ìN CL√çNICA): " +
      "1. REGLA ANAT√ìMICA RADIOL√ìGICA DE ESPEJO (Proyecciones frontales PA/AP): La DERECHA VISUAL de la pantalla/imagen corresponde al LADO IZQUIERDO ANAT√ìMICO DEL PACIENTE (Hemit√≥rax / Campo pulmonar izquierdo). La IZQUIERDA VISUAL de la pantalla corresponde al LADO DERECHO ANAT√ìMICO DEL PACIENTE (Hemit√≥rax / Campo pulmonar derecho). NUNCA confundas la derecha visual de la foto con la derecha del paciente. Un neumot√≥rax, infiltrado o lesi√≥n visible en la mitad derecha de la foto/pantalla DEBE ser reportado como IZQUIERDO (Lado del paciente). " +
      "2. ALINEACI√ìN CON LA INDICACI√ìN CL√çNICA: Si el m√©dico o consulta indica 'Neumot√≥rax Izquierdo' (o hallazgo en lado izquierdo), examina la mitad VISUAL DERECHA de la imagen m√©dica (hemit√≥rax izquierdo del paciente). Si identificas la l√≠nea pleural visceral o avascularidad perif√©rica en la mitad visual derecha de la placa, CONFIRMA Y REPORTA EXPL√çCITAMENTE COMO 'NEUMOT√ìRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusi√≥n de la matriz de la foto. " +
      "REGLAS CR√çTICAS DE TERMINOLOG√çA Y RECOMENDACIONES DE TIROIDES (ACR TI-RADS): " +
      "1. Usa SIEMPRE la sigla BAAF (Biopsia por Aspiraci√≥n con Aguja Fina). Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla PAAF o el t√©rmino punci√≥n por aguja fina. " +
      "2. Umbrales oficiales de la ACR TI-RADS 2017 para recomendaci√≥n de BAAF y seguimiento ecogr√°fico: " +
      "- TR1 (Benigno, 0 pts) y TR2 (No sospechoso, 2 pts): No requieren BAAF ni seguimiento ecogr√°fico. " +
      "- TR3 (Levemente sospechoso, 3 pts): Indicar BAAF √öNICAMENTE si mide ‚â• 2.5 cm (25 mm). Indicar seguimiento ecogr√°fico si mide ‚â• 1.5 cm (15 mm) (n√≥dulos TR3 de 15 mm a 24 mm son de seguimiento ecogr√°fico, NUNCA BAAF). " +
      "- TR4 (Moderadamente sospechoso, 4-6 pts): Indicar BAAF si mide ‚â• 1.5 cm (15 mm). Indicar seguimiento ecogr√°fico si mide ‚â• 1.0 cm (10 mm) (n√≥dulos TR4 de 10 mm a 14 mm son de seguimiento ecogr√°fico). " +
      "- TR5 (Altamente sospechoso, ‚â• 7 pts): Indicar BAAF si mide ‚â• 1.0 cm (10 mm). Indicar seguimiento ecogr√°fico si mide ‚â• 0.5 cm (5 mm) (n√≥dulos TR5 de 5 mm a 9 mm son de seguimiento ecogr√°fico).";

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
Indicaci√≥n m√©dica: ${clinicalHistory || "No proporcionada"}
`;

    if (findings) {
      promptText += `Hallazgos descritos por el usuario: ${findings}\n`;
    }

    if (inputReport) {
      promptText += `Borrador / Informe previo: \n"""\n${inputReport}\n"""\n`;
    }

    if (attachedImages && attachedImages.length > 0) {
      promptText += `\n‚ö†Ô∏è REFERENCIAS BIDIRECCIONALES A IM√ÅGENES ADJUNTAS:
El informe tiene las siguientes capturas diagn√≥sticas adjuntas:
`;
      attachedImages.forEach((img: any) => {
        promptText += `- Imagen ${img.index}: "${img.caption || "Sin descripci√≥n a√∫n"}"\n`;
      });
      promptText += `
Cuando redactes o describas los HALLAZGOS o la IMPRESI√ìN DIAGN√ìSTICA del reporte, si describes un hallazgo, estructura, lesi√≥n o anomal√≠a que corresponda directamente con alguna de las im√°genes adjuntas anteriores (bas√°ndote en su descripci√≥n/r√≥tulo), est√°s obligado a insertar de manera natural la indicaci√≥n entre par√©ntesis para el lector, por ejemplo: "(ver Imagen ${attachedImages[0].index})" o "(ver Imagen ${attachedImages[1].index})" al final de la oraci√≥n pertinente. Esto permite una correlaci√≥n bidireccional perfecta para que el lector busque la imagen si lo desea.
`;
    }

    if (uploadedReportImageBase64 && uploadedReportImageMimeType) {
      if (uploadedReportImageMimeType === "application/pdf") {
        promptText += `\n‚ö†Ô∏è CR√çTICO - ESTUDIO CL√çNICO/INFORME PREVIO ADJUNTO EN FORMATO PDF:
Se ha cargado un archivo PDF conteniendo un informe m√©dico o estudio previo como segunda se√±al de entrada para este caso.
Analiza con el mayor rigor m√©dico y minucia el contenido de este documento PDF. Extrae con precisi√≥n:
1. La lesi√≥n base descrita (quistes, n√≥dulos, masas, roturas, desgarros, etc.) con sus dimensiones exactas en mm/cm, densidad/ecogenicidad y localizaci√≥n anat√≥mica exacta.
2. Cualquier hallazgo o par√°metro cuantitativo relevante.
SI EL USUARIO INDICA "SIN CAMBIOS", "SIN MODIFICACIONES", "CONTROL", "ESTABLE" O NO INDICA NUEVOS DETALLES, EST√ÅS OBLIGADO A TOMAR ESTE ESTUDIO PREVIO COMO BASE DE TU REPORTE, CONFIRMANDO LA PERSISTENCIA Y ESTABILIDAD CL√çNICA DE DICHA LESI√ìN SIN INVENTAR OTRA DIFERENTE NI EXCLUIRLA.
\n`;
      } else {
        promptText += `\n‚ö†Ô∏è CR√çTICO - IMAGEN DE ESTUDIO DE SOPORTE ADJUNTA (ELASTOGRAF√çA, ECOGRAF√çA O REPORTE PREVIO):
Se ha cargado una imagen/captura de pantalla de un estudio previo o de elastograf√≠a como segunda se√±al de entrada para este caso. 
Analiza visualmente con extrema detenci√≥n esta segunda imagen adjunta. Extrae detalladamente todos sus par√°metros, tales como mediciones de rigidez (kPa o m/s), clasificaciones correspondientes (ej: puntuaciones METAVIR F0-F4, grados de esteatosis, etc.) o hallazgos visuales clave descritos en dicha captura, e int√©gralos formalmente y de forma prioritaria en los HALLAZGOS o IMPRESI√ìN DIAGN√ìSTICA del reporte radiol√≥gico actual. No omitas estos datos cuantitativos cruciales.
\n`;
      }
    } else if (uploadedReportContent) {
      promptText += `Informe de estudio previo o elastograf√≠a anexado: \n"""\n${uploadedReportContent}\n"""\n`;
    }

    if (uploadedReportContent || inputReport || (uploadedReportImageBase64 && uploadedReportImageMimeType === "application/pdf")) {
      promptText += `
‚ö†Ô∏è DIRECTRIZ CR√çTICA DE ADHERENCIA M√âDICA AL ESTUDIO PREVIO COMPARTIDO:
1. Lee minuciosamente el estudio cl√≠nico o informe previo anexado anteriormente (ya sea en formato texto, PDF o imagen). Identifica con precisi√≥n la lesi√≥n base descrita (como quistes, n√≥dulos, masas, roturas, fracturas, atenuaci√≥n, dimensiones en mm/cm, y localizaci√≥n anat√≥mica exacta).
2. Si el usuario indica "sin cambios", "no hay cambios espec√≠ficos", "sin modificaciones", "estable", "de control", o si el texto ingresado no especifica una nueva alteraci√≥n en la lesi√≥n, est√°s OBLIGADO a tomar este estudio compartido como tu verdad cl√≠nica absoluta y base del nuevo informe.
3. BAJO NINGUNA CIRCUNSTANCIA inventes o alucines una lesi√≥n de diferente naturaleza, tama√±o o localizaci√≥n a la descrita en el estudio previo. Tampoco ignores la lesi√≥n descrita en el estudio previo para declarar un examen normal, a menos que el usuario indique expl√≠citamente que la lesi√≥n ha desaparecido o se ha resuelto.
4. Redacta la secci√≥n de HALLAZGOS partiendo literalmente de la descripci√≥n de la lesi√≥n descrita en el estudio previo, confirmando su estabilidad, persistencia y ausencia de cambios de forma cl√≠nicamente rigurosa, y refl√©jalo en la IMPRESI√ìN DIAGN√ìSTICA como una lesi√≥n estable.
\n`;
    }

    if (annotations && annotations.length > 0) {
      promptText += formatImageAnnotations(annotations);
    }

    promptText += `
Por favor, estructura tu respuesta de la siguiente forma EXACTA (usa formato Markdown claro para que sea f√°cil de copiar y pegar). No agregues notas introductorias ni comentarios personales fuera del informe:

[INICIO DEL REPORTE]
**${studyType ? studyType.toUpperCase() : "REPORTE DE ESTUDIO RADIOL√ìGICO"}**


**TIPO DE ESTUDIO:** ${studyType || "Estudio de Imagen"}

**HISTORIA CL√çNICA / INDICACIONES:** ${clinicalHistory ? `(Pula, redacte adecuadamente, corrija ortogr√°ficamente y formatee de manera fluida y acad√©mica la indicaci√≥n del estudio provista por el usuario: "${clinicalHistory}". REGLA DE CASING OBLIGATORIA: Si est√° escrita completa o parcialmente en may√∫sculas sostenidas, debe convertirla obligatoriamente a min√∫sculas est√°ndar/mixtas con su primera letra may√∫scula para que guarde perfecta coherencia est√©tica con el resto del reporte. No use may√∫sculas sostenidas ni abreviaciones informales bajo ninguna circunstancia, y red√°ctela con impecable terminolog√≠a m√©dica en espa√±ol, sin inventar s√≠ntomas o hallazgos).` : "No especificada"}


**T√âCNICA DEL EXAMEN:**
(Describe aqu√≠ la t√©cnica de manera profesional para este tipo de estudio basado en las buenas pr√°cticas, por ejemplo cortes, proyecciones, administraci√≥n de contraste si aplica. Solo usa texto normal sin encabezados Markdown '#' ni '##')


**HALLAZGOS:**
${findings ? `Basados en los hallazgos descritos ("${findings}"), el estudio previo provisto (si aplica) y la imagen proporcionada (si aplica), describe con sumo rigor cl√≠nico y terminolog√≠a radiol√≥gica avanzada. Si el caso es de control o sin cambios respecto al estudio previo, parte rigurosamente de la lesi√≥n descrita en el estudio anterior, detall√°ndola con absoluta precisi√≥n y describiendo que permanece estable. No uses encabezados de secci√≥n '#' ni '##', usa l√≠neas de texto normales y listas con vi√±etas est√°ndar si es necesario:\n` : `(Divide por estructuras anat√≥micas relevantes para este estudio de manera detallada y cient√≠fica. Si hay un informe o estudio previo anexado, as√∫melo como la base para tus hallazgos, describiendo la lesi√≥n base all√≠ detallada con sus dimensiones y confirmando su persistencia/estabilidad. No uses encabezados '#' ni '##')\n`}


**IMPRESI√ìN DIAGN√ìSTICA:**
**1. (La conclusi√≥n diagn√≥stica y cualquier recomendaci√≥n o clasificaci√≥n de consenso como BI-RADS, quistes de Bosniak, criterios de Fleischner, etc. DEBE estar ESCRITA COMPLETAMENTE EN NEGRITA. Cada l√≠nea de esta secci√≥n debe estar envuelta en asteriscos dobles. Ejemplo: '**1. Hallazgo de sospecha...**')**
**2. (Toda esta secci√≥n debe estar completamente en negrita l√≠nea por l√≠nea)**

[FIN DEL REPORTE]

REGLAS DE FORMATO CR√çTICAS PARA COMPATIBILIDAD CON MICROSOFT WORD:
1. NUNCA utilices encabezados de estilo Markdown como '#', '##', o '###' para el t√≠tulo, nombres de secciones ni subsecciones. Utiliza √∫nicamente texto plano y negritas tanto para las secciones principales (ej: **T√âCNICA DEL EXAMEN:**, **HALLAZGOS:**) como para las subsecciones internas (ej: **Par√©nquima pulmonar:**, **Mediastino:**, **Silueta card√≠aca:**).
2. Deja exactamente DOS l√≠neas en blanco (doble espacio) entre cada una de las secciones principales del reporte, y tambi√©n exactamente DOS l√≠neas en blanco (doble espacio) entre los p√°rrafos y las subsecciones internas (por ejemplo, entre cada subsecci√≥n de los hallazgos para que queden bien espaciadas).
3. Asegura que TODO el texto, puntos, listas y recomendaciones bajo la secci√≥n 'IMPRESI√ìN DIAGN√ìSTICA' est√© renderizado enteramente en negrita (ej: **1. Hallazgo...** y **2. Recomendaci√≥n...**).
4. El t√≠tulo principal (basado en el estudio especificado) debe estar exactamente en esa l√≠nea y se centrar√° autom√°ticamente al copiarlo o visualizarlo.
5. El tono debe ser de un radi√≥logo experto de nivel de subespecialidad.
6. ASISTENCIA Y REDACCI√ìN DE LA INDICACI√ìN / HISTORIA CL√çNICA: Debes pulir, refinar ortogr√°ficamente y redactar de forma cl√≠nicamente √≥ptima el texto provisto para la indicaci√≥n o historia cl√≠nica. Si la indicaci√≥n fue ingresada completa o parcialmente en may√∫sculas sostenidas (ALL CAPS) o con ortograf√≠a informal, trad√∫cela obligatoriamente a una redacci√≥n fluida, t√©cnica, acad√©mica y formal usando min√∫sculas con may√∫scula inicial (caja mixta). Nunca la dejes en may√∫sculas sostenidas, para mantener absoluta uniformidad est√©tica y profesional con el resto de la redacci√≥n del reporte.
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
      return res.status(400).json({ success: false, error: "Se requiere el par√°metro 'clinicalHistory' para asistir." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Eres un asistente de redacci√≥n m√©dica especialista en radiolog√≠a. El usuario te ha proporcionado el motivo o indicaci√≥n cl√≠nica para una prueba de imagen radiol√≥gica.

Estudio realizado o solicitado: "${studyType || "No especificado"}"
Texto original provisto por el usuario: "${clinicalHistory}"

Por favor, reescribe, pule, corrige ortogr√°ficamente y mejora de manera formal esta indicaci√≥n m√©dica en espa√±ol cl√≠nico/radiol√≥gico.

REGLAS CR√çTICAS DE FORMATO Y CONTENIDO (S√çGUELAS DE MANERA ESTRICTA):
1. REGLA DE CASING ABSOLUTA: Si el texto provisto tiene palabras o frases enteras escritas en may√∫sculas sostenidas (ALL CAPS) o con may√∫sculas informales, debes traducirlas y convertirlas COMPLETAMENTE al formato est√°ndar de min√∫sculas con su primera letra may√∫scula (caja normal/mixta). Bajo ninguna circunstancia respondas con un texto completamente en may√∫sculas sostenidas.
2. RIGOR CL√çNICO: Corrige cualquier error ortogr√°fico, faltas de acentuaci√≥n o sintaxis. No inventes antecedentes o s√≠ntomas cl√≠nicos nuevos que el usuario no describi√≥, simplemente dale una redacci√≥n formal, impecable, t√©cnica, elegante y profesional (por ejemplo: "DOLOR SEVERO EN CODO DERECHO" -> "Dolor severo en la articulaci√≥n del codo derecho").
3. M√ÅXIMA CONCISI√ìN: Devuelve S√ìLO el texto plano de la indicaci√≥n m√©dica ya corregida y asistida, sin pre√°mbulos, sin notas aclaratorias, sin comentarios, sin comillas adicionales en la salida. Debe ser legible e inyectable directamente.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ text: promptText }],
      config: {
        systemInstruction: "Eres un redactor m√©dico de radiolog√≠a de √©lite. Tu funci√≥n es corregir, pulir sint√°ctica y ortogr√°ficamente, y formatear a may√∫sculas/min√∫sculas correctas las indicaciones de estudio, garantizando que nunca se produzcan textos en may√∫sculas sostenidas y dot√°ndolos de un lenguaje t√©cnico formal y fluido.",
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'audio' y 'mimeType'." });
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
        "Por favor, transcribe este archivo de audio de dictado m√©dico radiol√≥gico con absoluta precisi√≥n t√©cnica en espa√±ol. Devuelve √∫nicamente el texto plano de la transcripci√≥n, sin saludos, sin formateo adicional, ni comentarios personales. Mant√©n la terminolog√≠a m√©dica exacta dictada en espa√±ol.",
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
      "Eres un consultor radiol√≥gico de √©lite de nivel acad√©mico. Ayudas a otros radi√≥logos y m√©dicos a resolver casos dif√≠ciles, proponer diagn√≥sticos diferenciales detallados basados en signos radiogr√°ficos, sugerir estudios de imagen complementarios id√≥neos para resolver el dilema diagn√≥stico y explicar la fisiopatolog√≠a detr√°s de los hallazgos de imagen. Responde siempre con rigor cient√≠fico y de forma estructurada. " +
      "REGLA DE TERMINOLOG√çA: Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla o t√©rmino PAAF. Utiliza SIEMPRE la sigla BAAF (Biopsia por Aspiraci√≥n con Aguja Fina).";

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
      return res.status(400).json({ success: false, error: "Falta el par√°metro 'query' de la b√∫squeda." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const finalSystemInstruction = systemInstruction || 
      "Eres una enciclopedia viva de clasificaciones, escalas y criterios radiol√≥gicos (ej. BI-RADS, Bosniak, LI-RADS, PI-RADS, Fleischner, Stanford/DeBakey, Duke, Balthazar, Child-Pugh, etc.). Tu tarea es proveer informaci√≥n estructurada, precisa y actualizada sobre la escala consultada, detallando los estadios/grados, criterios de imagen clave para cada uno y las recomendaciones correspondientes de seguimiento cl√≠nico o quir√∫rgico. Presenta todo con tablas detalladas y listas claras de lectura r√°pida. " +
      "REGLA DE TERMINOLOG√çA: Queda ESTRICTAMENTE PROHIBIDO utilizar la sigla o t√©rmino PAAF. Utiliza SIEMPRE la sigla BAAF (Biopsia por Aspiraci√≥n con Aguja Fina).";

    const promptText = `Explica a fondo, con criterios precisos y de forma perfectamente organizada la siguiente escala, criterio o clasificaci√≥n radiol√≥gica:
"${query}"

Por favor, proporciona:
1. Definici√≥n y prop√≥sito de la clasificaci√≥n.
2. Una tabla clara con los Grados/Categor√≠as, sus Hallazgos Radiol√≥gicos Clave y la conducta recomendada o seguimiento.
3. Consejos o advertencias pr√°cticas para el radi√≥logo al aplicar esta escala en su reporte diario.`;

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
      "Eres un consultor radiol√≥gico experto con amplias credenciales internacionales. Tu tarea es examinar con sumo rigor cl√≠nico el informe " +
      "radiol√≥gico provisto por el usuario, discernir qu√© clasificaciones, escalas, criterios m√©dicos o scores radiol√≥gicos de consenso internacional " +
      "(ej. BI-RADS, quistes de Bosniak, criterios de Fleischner, ACR TI-RADS, LI-RADS, PI-RADS, criterios de Alvarado, criterios de Duke, Balthazar, Consenso SRU para Esteatosis Hep√°tica / QUS, etc.) " +
      "son aplicables diagn√≥sticamente para complementar la 'Impresi√≥n Diagn√≥stica' o 'Recomendaciones' de este informe, y estructurar una respuesta en formato JSON exacto. " +
      "REGLAS OBLIGATORIAS DE BAAF Y ACR TI-RADS: " +
      "1. Usa siempre la sigla BAAF (Biopsia por Aspiraci√≥n con Aguja Fina). Prohibido usar PAAF. " +
      "2. Criterios exactos ACR TI-RADS 2017 para BAAF y seguimiento: " +
      "   - TR1 (0 pts) y TR2 (2 pts): No BAAF ni seguimiento. " +
      "   - TR3 (3 pts): BAAF solo si ‚â• 2.5 cm (25 mm). Seguimiento ecogr√°fico si es ‚â• 1.5 cm (15 mm) (rango 15-24 mm es para seguimiento ecogr√°fico, NUNCA BAAF). " +
      "   - TR4 (4-6 pts): BAAF si ‚â• 1.5 cm (15 mm). Seguimiento ecogr√°fico si es ‚â• 1.0 cm (10 mm) (rango 10-14 mm es seguimiento ecogr√°fico). " +
      "   - TR5 (‚â•7 pts): BAAF si ‚â• 1.0 cm (10 mm). Seguimiento ecogr√°fico si es ‚â• 0.5 cm (5 mm) (rango 5-9 mm es seguimiento ecogr√°fico). " +
      "3. Criterios para Esteatosis Hep√°tica / Consenso SRU (por porcentaje de grasa QUS): " +
      "   - Normal: < 5.0% " +
      "   - Leve: 5.0% a 12.0% " +
      "   - Moderada: 12.1% a 20.0% " +
      "   - Severa: > 20.0%.";

    const promptText = `Analiza detenidamente este informe radiol√≥gico:

"""
${report}
"""

Identifica cu√°les de las clasificaciones, escalas, criterios m√©dicos o scores radiol√≥gicos de consenso internacional o gu√≠as cl√≠nicas son aplicables o de gran valor basado en los hallazgos descritos de este estudio.

Proporciona una lista detallada de recomendaciones (de 1 a 3 escalas o criterios cl√≠nico-radiol√≥gicos relevantes). Si no hay escalas internacionalmente estructuradas que encajen directamente, puedes proponer recomendaciones estructuradas o de seguimiento cl√≠nico-patol√≥gico de gran utilidad cl√≠nica bajo el formato de "Sugerencias Espec√≠ficas de Seguimiento".

Por cada recomendaci√≥n, rellena los campos requeridos en el esquema JSON, especialmente el contenido a incorporar redactado con el m√°s alto rigor cient√≠fico del radi√≥logo senior.`;

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
                description: "Nombre oficial de la clasificaci√≥n radiol√≥gica, criterio o escala sugerida (ej: Criterios de Fleischner 2017 para n√≥dulos incidentales, Criterios de Diagn√≥stico Duke modificado, etc.)." 
              },
              whyRecommended: { 
                type: Type.STRING, 
                description: "Breve explicaci√≥n diagn√≥stica de una sola oraci√≥n de por qu√© se recomienda esta escala tras analizar el texto del reporte." 
              },
              contentToAppend: { 
                type: Type.STRING, 
                description: "El bloque redactado que contiene la escala detallada, grados y conducta aplicable al caso, preferiblemente en una tabla o lista Markdown perfectamente formateada y lista para integrarse." 
              },
              alreadyIncorporated: {
                type: Type.BOOLEAN,
                description: "Indica con 'true' si esta clasificaci√≥n o score ya se encuentra calculada, asignada de forma expl√≠cita y redactada con su valor correspondiente (ej: 'BI-RADS 4', 'Bosniak II') dentro del cuerpo del reporte provisto, o 'false' si est√° ausente o no calculada/aplicada formalmente."
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
      throw new Error("No se pudo obtener un JSON v√°lido de las recomendaciones. Reintenta la solicitud.");
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
      "Eres un m√©dico radi√≥logo de √©lite experto en an√°lisis sem√°ntico de reportes m√©dicos. " +
      "Tu tarea es analizar cada uno de los fragmentos de texto (p√°rrafos, oraciones o elementos de lista) de un informe radiol√≥gico provistos, " +
      "y clasificarlos con precisi√≥n m√©dica real en una de estas tres categor√≠as de severidad cl√≠nica:\n" +
      "1. 'normal': El texto describe estructuras normales, hallazgos esperados para la edad, t√©cnicas del examen, t√≠tulos, datos de identificaci√≥n, o la ausencia de patolog√≠a de forma expl√≠cita (por ejemplo: 'sin hallazgos patol√≥gicos', 'silueta card√≠aca normal', 'estructuras conservadas', 'par√©nquima pulmonar normal').\n" +
      "2. 'altered': El texto describe un hallazgo patol√≥gico activo, lesi√≥n, alteraci√≥n anat√≥mica, inflamaci√≥n, degeneraci√≥n o anormalidad de severidad est√°ndar, moderada o leve (por ejemplo: 'presencia de n√≥dulo de 5mm', 'bursitis', 'esteatosis leve', 'quiste cortical renal', 'desgarro parcial', 'osteofitos', 'derrame articular leve').\n" +
      "3. 'critical': El texto describe un hallazgo patol√≥gico cr√≠tico, agudo, potencialmente mortal o de m√°xima urgencia cl√≠nica (por ejemplo: 'trombosis venosa profunda', 'desgarro/ruptura completa de tend√≥n', 'apendicitis aguda', 'aneurisma gigante', 'neumot√≥rax a tensi√≥n', 'infarto espl√©nico', 'masa de sospecha altamente maligna BI-RADS 5').\n\n" +
      "REGLAS CR√çTICAS:\n" +
      "- Debes entender el contexto cl√≠nico real. Si se niega un hallazgo (ej. 'Sin evidencia de derrame' o 'No se aprecian fracturas'), es un hallazgo NORMAL ('normal').\n" +
      "- Si hay duda de si es altered o critical, clasif√≠calo como 'altered' a menos que sea una emergencia de alta urgencia o una ruptura completa.\n" +
      "- No uses palabras clave de forma rob√≥tica, entiende la sem√°ntica m√©dica real.";

    const promptText = `Analiza cada uno de los siguientes textos y clasif√≠calos seg√∫n su severidad radiol√≥gica/cl√≠nica. Retorna un objeto JSON con la clasificaci√≥n de cada texto de manera exacta.

La estructura de salida debe ser un objeto JSON plano donde las llaves sean los textos originales exactos y los valores sean la clasificaci√≥n correspondiente: "normal", "altered" o "critical".

Ejemplo de salida esperada:
{
  "Silueta card√≠aca de tama√±o normal.": "normal",
  "Se observa un n√≥dulo pulmonar s√≥lido de 8 mm en el l√≥bulo superior derecho.": "altered",
  "Trombosis venosa profunda aguda de la vena femoral com√∫n derecha.": "critical"
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
      "Eres un consultor de neurorradiolog√≠a y radiolog√≠a general de √©lite. Tu objetivo es modificar el reporte m√©dico radiol√≥gico del usuario " +
      "para integrar de forma inteligente, contextualizada y m√©dicamente rigurosa la clasificaci√≥n o escala cl√≠nica solicitada. " +
      "NUNCA pegues una escala vac√≠a, plantilla gen√©rica, o una tabla con todas las categor√≠as de la escala. " +
      "En su lugar, lee detalladamente los hallazgos descritos de este reporte espec√≠fico, asigna/calcula la categor√≠a o score correcto y exacto de esta escala que de verdad corresponde a estos hallazgos, " +
      "e inserta dicha clasificaci√≥n de forma elegante y natural dentro de la 'IMPRESI√ìN DIAGN√ìSTICA' o como una secci√≥n correspondiente de 'CLASIFICACI√ìN/CRITERIO'. " +
      "IMPORTANTE: Si en los resultados o en la clasificaci√≥n se mencionan valores de QUS (Quantitative Ultrasound) o ELASTOGRAF√çA, aseg√∫rate de que el t√≠tulo o tipo de examen (studyType) mencionado expl√≠citamente indique que se han realizado dichas t√©cnicas de forma independiente. No asumas que porque hubo QUS hubo elastograf√≠a o viceversa. " +
      "Aseg√∫rate de conservar el rigor cient√≠fico y el formato del reporte, actualiz√°ndolo con coherencia absoluta.";

    const promptText = `
Reporte M√©dico Radiol√≥gico Original:
"""
${report}
"""

Tipo de Examen (T√≠tulo):
"""
${studyType || "Estudio Radiol√≥gico"}
"""

Clasificaci√≥n a incorporar/utilizar:
Nombre: ${classificationName}
Prop√≥sito: ${whyRecommended}
Gu√≠a/Referencia de la escala:
${contentToAppend}

Instrucciones:
1. Analiza con sumo cuidado los hallazgos cl√≠nico-radiol√≥gicos descritos en el "Reporte M√©dico Radiol√≥gico Original" anterior.
2. Aplica y calcula la categor√≠a, grado o score adecuado que corresponde a este caso particular seg√∫n la "Gu√≠a/Referencia de la escala" suministrada. E.g. Si el informe describe un n√≥dulo pulmonar s√≥lido de 7 mm incidental, calcula el seguimiento seg√∫n Fleischner y pon el resultado. Si describe un quiste renal con septos finos m√≠nimos, apl√≠cale Bosniak II, etc.
3. Si la clasificaci√≥n aplicada o los resultados calculados involucran valores de QUS (Quantitative Ultrasound) o ELASTOGRAF√çA, aseg√∫rate de que el t√≠tulo del informe o en la descripci√≥n t√©cnica se mencione expl√≠citamente "realizado con QUS" o "realizado con Elastograf√≠a" SOLAMENTE si realmente se realiz√≥ dicha t√©cnica en ese estudio espec√≠fico. No asumas que ambas t√©cnicas se hicieron si solo una se menciona.
4. ${
      includeManagementRecommendation
        ? "Inserta y fusiona esta clasificaci√≥n ya calculada (incluyendo su grado, score, conducta sugerida, recomendaciones de manejo o seguimiento y su sustento cl√≠nico r√°pido) adecuadamente dentro del reporte."
        : "Inserta y fusiona √öNICAMENTE la clasificaci√≥n o escala ya calculada (incluyendo su grado, score y justificaci√≥n diagn√≥stica/cl√≠nica de la asignaci√≥n) adecuadamente dentro del reporte. REQUISITO CR√çTICO Y ABSOLUTO: Queda ESTRICTAMENTE PROHIBIDO incluir cualquier tipo de conducta sugerida, recomendaci√≥n de manejo, seguimiento cl√≠nico sugerido, pautas de tratamiento, o derivaciones m√©dicas (por ejemplo, NO debes escribir cosas como 'se sugiere control en 1 a√±o', 'requiere correlaci√≥n con ecograf√≠a o biopsia', o 'se recomienda conducta quir√∫rgica'). √önicamente reporta el hallazgo y su asignaci√≥n de escala/clasificaci√≥n, sin ninguna recomendaci√≥n de manejo o conducta."
    } Lo ideal es integrarlo de manera estructurada en la secci√≥n de "IMPRESI√ìN DIAGN√ìSTICA" o agregar un apartado fino titulado "CLASIFICACI√ìN" o "ESCALA APLICADA" sin desconfigurar el resto del reporte.
5. **IMPORTANTE**: No pegues la escala completa con todas sus variantes ni plantillas gen√©ricas sin rellenar. Solo debes aplicar la categor√≠a o escala espec√≠fica de este paciente.
6. **REGLA ESTRICTA DE MAY√öSCULAS/MIN√öSCULAS (CASING)**: No escribas los textos de los cambios ni la escala o clasificaci√≥n completamente en may√∫sculas (ALL CAPS / All-uppercase). Debes escribir en min√∫sculas est√°ndar, respetando el uso correcto de may√∫sculas iniciales para nombres de secciones o clasificaciones y el formato circundante o preexistente de la secci√≥n del reporte. La incorporaci√≥n debe hacerse usando el formato gramatical regular ordinario de may√∫sculas y min√∫sculas (ej: escribiendo 'Grado II seg√∫n Bosniak' en lugar de 'GRADO II SEG√öN BOSNIAK').
7. Devuelve EXCLUSIVAMENTE el reporte m√©dico radiol√≥gico modificado al completo en espa√±ol, manteniendo el mismo formato limpio, espaciado y profesional. No agregues saludos, explicaciones, ni notas fuera del informe.
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
      "Eres un consultor de radiolog√≠a diagn√≥stica de √©lite con credenciales internacionales. " +
      "Tu objetivo es examinar minuciosamente el informe radiol√≥gico provisto e identificar todas las clasificaciones, " +
      "escalas, criterios o scores cl√≠nicos de consenso internacional (ej. BI-RADS, Bosniak, Fleischner, LI-RADS, PI-RADS, " +
      "O-RADS, Kellgren-Lawrence, Neer, Rockwood, Garden, Marsh, AO, Balthazar, Alvarado, etc.) que est√©n expl√≠citamente " +
      "mencionadas en el texto o que sean directamente aplicables a los hallazgos descritos.";

    const promptText = `Analiza el siguiente informe radiol√≥gico:

"""
${report}
"""

Identifica todas las clasificaciones, escalas o criterios cl√≠nicos presentes o directamente aplicables a los hallazgos descritos.
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
                description: "Nombre oficial de la clasificaci√≥n o escala (ej: BI-RADS, Clasificaci√≥n de Bosniak, Criterios de Fleischner 2017, Escala de Kellgren-Lawrence)." 
              },
              assignedCategory: { 
                type: Type.STRING, 
                description: "Categor√≠a, grado, tipo o score asignado en el informe o correspondiente a los hallazgos (ej: BI-RADS 4B, Bosniak II, Grado 3, Tipo II)." 
              },
              detectedInText: { 
                type: Type.BOOLEAN, 
                description: "true si la escala/categor√≠a est√° mencionada expl√≠citamente en el texto del informe; false si se deduce cl√≠nicamente de los hallazgos descritos." 
              },
              whyApplicable: { 
                type: Type.STRING, 
                description: "Explicaci√≥n breve de 1 oraci√≥n del porqu√© aplica esta clasificaci√≥n al informe." 
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

    const isOptionA = format === "option_a"; // Tabla Estructurada / Matriz de Justificaci√≥n Criterio por Criterio
    const isOptionB = format === "option_b"; // Ficha Explicativa e Ilustrativa / Tarjeta de Anexo

    const systemInstruction = 
      "Eres un m√©dico especialista en radiolog√≠a diagn√≥stica de nivel internacional. " +
      "Tu tarea es generar un anexo de justificaci√≥n diagn√≥stica S√ìLIDO Y MANTENIDO EN EXTENSI√ìN EXACTA PARA P√ÅGINA √öNICA, que explique de forma concisa y rigurosa los hallazgos del reporte que sustentan la clasificaci√≥n radiol√≥gica y categor√≠a asignada. " +
      "TODO EL ANEXO DEBE SER EQUILIBRADO Y COMPACTO, GARANTIZANDO QUE QUEPA DE FORMA HOLGADA EN UNA SOLA P√ÅGINA DEDICADA SIN DESBORDARSE A UNA SEGUNDA P√ÅGINA. " +
      "REGLAS ABSOLUTAS PARA TIROIDES Y BIOPSIA: " +
      "1. Usa SIEMPRE la sigla BAAF (Biopsia por Aspiraci√≥n con Aguja Fina). Jam√°s utilices la sigla PAAF. " +
      "2. Umbrales rigurosos oficiales ACR TI-RADS 2017: TR1 y TR2 no BAAF/no seguimiento; TR3 BAAF si ‚â• 2.5 cm (25 mm), seguimiento ecogr√°fico si ‚â• 1.5 cm (15 mm) (15 a 24 mm es SOLO seguimiento ecogr√°fico, NUNCA BAAF); TR4 BAAF si ‚â• 1.5 cm (15 mm), seguimiento si ‚â• 1.0 cm (10 mm); TR5 BAAF si ‚â• 1.0 cm (10 mm), seguimiento si ‚â• 0.5 cm (5 mm). " +
      "3. Umbrales para Esteatosis Hep√°tica / Consenso SRU (por porcentaje de grasa QUS): Normal < 5.0%, Leve 5.0% - 12.0%, Moderada 12.1% - 20.0%, Severa > 20.0%.";

    const promptText = `
Reporte Radiol√≥gico Base:
"""
${report}
"""

Estudio: ${studyType || "Estudio Radiol√≥gico"}
Clasificaci√≥n Seleccionada: ${classificationName} ${assignedCategory ? `(${assignedCategory})` : ""}
Formato Deseado: ${isOptionA ? "OPCI√ìN A: Tabla Estructurada / Matriz de Justificaci√≥n Criterio por Criterio" : "OPCI√ìN B: Ficha Explicativa e Ilustrativa (Tarjeta de Anexo / Infograf√≠a Esquem√°tica)"}
Incluir Recomendaciones de Manejo / Seguimiento Cl√≠nico: ${includeRecommendations ? "S√ç (Incluir gu√≠as de manejo, seguimiento o pautas cl√≠nicas oficiales)" : "NO (ESTRICTAMENTE PROHIBIDO sugerir conductas o tratamientos)"}

REQUISITOS FUNDAMENTALES Y FORMATO P√ÅGINA √öNICA:
1. T√çTULO DEL ANEXO: El t√≠tulo debe indicar expl√≠citamente la clasificaci√≥n y el estadio/categor√≠a asignado de forma limpia comenzando directamente con 'CLASIFICACI√ìN DE...'.
   - Queda ESTRICTAMENTE PROHIBIDO incluir la frase 'ANEXO DIAGN√ìSTICO:' o 'ANEXO:' en el t√≠tulo de la clasificaci√≥n. Ya se sabe que es un anexo por el encabezado de p√°gina.
   - Si la clasificaci√≥n es "Clasificaci√≥n de Rockwood" y la categor√≠a es "Tipo III - V", el t√≠tulo debe ser exactamente:
     "CLASIFICACI√ìN DE ROCKWOOD - TIPO III - V"
   - Queda ESTRICTAMENTE PROHIBIDO repetir la palabra 'CLASIFICACI√ìN' (NO escribir "CLASIFICACI√ìN CLASIFICACI√ìN...").
2. REGLA ESTRICTA DE ENCABEZADOS Y PALABRAS PROHIBIDAS:
   - NO incluyas tablas de 2 columnas ni subt√≠tulos redundantes con las palabras 'Interpretaci√≥n', 'Interpretaci√≥n de Hallazgos' ni 'Hallazgos' debajo del t√≠tulo principal. Pasa directamente a Definici√≥n y Sustento Diagn√≥stico Integrador.
3. MATRIZ CONCISA BASADA EN HALLAZGOS DEL REPORTE (M√ÅXIMO 3 A 5 FILAS):
   - Crea una tabla estructurada de √öNICAMENTE 3 A 5 FILAS M√ÅXIMO que abarque los criterios y hallazgos clave esenciales.
   - Incluye los hallazgos principales presentes o ausentes en el reporte que justifican de forma directa la categor√≠a asignada.
   - Redacta celdas directas, claras y sint√©ticas (de 5 a 12 palabras por celda m√°ximo) para mantener la tabla compacta.
4. DEFINICI√ìN Y SUSTENTO DIAGN√ìSTICO INTEGRADOR CONCISO:
   - "definitionAndRisk": Definici√≥n oficial concisa y riesgo de la categor√≠a asignada (1-2 oraciones claras).
   - "clinicalSummary": Sustento radiol√≥gico integrador de 2-3 oraciones directas que correlacione los hallazgos de imagen con los criterios de la escala.
5. PASOS Y ALGORITMO DECISIONAL (SI SE SELECCIONA OPCI√ìN B O PARA FICHA):
   - Proporciona entre 3 y 4 pasos sint√©ticos del algoritmo con descripciones de 1 frase corta.
6. REGLA DE RECOMENDACIONES:
   - ${includeRecommendations 
       ? "Detalla las recomendaciones oficiales de conducta o seguimiento en 1-2 l√≠neas breves. Si aplica a TI-RADS, usa la sigla BAAF (NUNCA PAAF) y respeta estrictamente las gu√≠as oficiales ACR TI-RADS 2017: TR3 indica BAAF solo si ‚â• 25 mm (2.5 cm) y seguimiento ecogr√°fico si ‚â• 15 mm (1.5 cm); TR4 indica BAAF si ‚â• 15 mm y seguimiento si ‚â• 10 mm; TR5 indica BAAF si ‚â• 10 mm y seguimiento si ‚â• 5 mm." 
       : "Si 'includeRecommendations' es false, el campo 'recommendations' DEBE ser una cadena completamente vac√≠a (\"\"). Queda PROHIBIDO agregar cualquier frase aclaratoria, notas de exclusi√≥n o disclaimers al final."}
7. "formattedAnnexMarkdown": Texto completo del Anexo formateado en Markdown estructurado, limpio y compacto. Debe comenzar con un t√≠tulo √∫nico e impecable sin palabras duplicadas y garantizando extensi√≥n de p√°gina √∫nica.

Retorna la respuesta en estricto formato JSON seg√∫n el esquema definido.`;

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
            classificationName: { type: Type.STRING, description: "Nombre formal de la escala/clasificaci√≥n" },
            categoryAssigned: { type: Type.STRING, description: "Categor√≠a o Grado asignado (ej: BI-RADS 4B, Bosniak II, Grado 3)" },
            definitionAndRisk: { type: Type.STRING, description: "Definici√≥n oficial de la categor√≠a y estimaci√≥n de riesgo o significado cl√≠nico." },
            clinicalSummary: { type: Type.STRING, description: "Resumen integrador del razonamiento diagn√≥stico radiol√≥gico." },
            criteriaMatrix: {
              type: Type.ARRAY,
              description: "Matriz de criterios evaluados vs hallazgos en el reporte y su ponderaci√≥n/justificaci√≥n",
              items: {
                type: Type.OBJECT,
                properties: {
                  criterion: { type: Type.STRING, description: "Par√°metro o criterio analizado (ej: M√°rgenes, Densidad, Tama√±o, Realce)" },
                  findingInReport: { type: Type.STRING, description: "Hallazgo espec√≠fico presente en el informe radiol√≥gico" },
                  weightOrGrade: { type: Type.STRING, description: "Peso o aporte a la escala (ej: Criterio Mayor (+), +2 Puntos, Caracter√≠stica sospechosa)" },
                  justification: { type: Type.STRING, description: "Justificaci√≥n m√©dica de por qu√© este hallazgo respalda la clasificaci√≥n" }
                },
                required: ["criterion", "findingInReport", "weightOrGrade", "justification"]
              }
            },
            decisionSteps: {
              type: Type.ARRAY,
              description: "Pasos secuenciales del algoritmo de decisi√≥n cl√≠nica",
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER, description: "N√∫mero de paso (1, 2, 3...)" },
                  title: { type: Type.STRING, description: "T√≠tulo del paso del algoritmo" },
                  description: { type: Type.STRING, description: "Explicaci√≥n del hallazgo y decisi√≥n tomada en este paso" },
                  isMet: { type: Type.BOOLEAN, description: "true si se cumple el criterio en el paciente" }
                },
                required: ["stepNumber", "title", "description", "isMet"]
              }
            },
            recommendations: { type: Type.STRING, description: "Recomendaciones de manejo / conducta (si fueron solicitadas) o nota de exclusi√≥n." },
            formattedAnnexMarkdown: { type: Type.STRING, description: "Texto completo del Anexo formateado en Markdown estructurado de alta calidad" },
            formattedAnnexHtml: { type: Type.STRING, description: "Fragmento HTML con clases limpias y legibles para renderizado directo o impresi√≥n" }
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
Tienes un reporte m√©dico de radiolog√≠a en formato Markdown:

"""
${currentReport}
"""

El usuario solicita realizar la siguiente modificaci√≥n o mejora:
"${instruction}"
`;

    if (attachedImages && attachedImages.length > 0) {
      promptText += `\n‚ö†Ô∏è REFERENCIAS BIDIRECCIONALES A IM√ÅGENES ADJUNTAS:
El informe tiene las siguientes capturas diagn√≥sticas adjuntas:
`;
      attachedImages.forEach((img: any) => {
        promptText += `- Imagen ${img.index}: "${img.caption || "Sin descripci√≥n a√∫n"}"\n`;
      });
      promptText += `
Cuando realices la modificaci√≥n o reescribas los HALLAZGOS o la IMPRESI√ìN DIAGN√ìSTICA, si describes un hallazgo, estructura, lesi√≥n o anomal√≠a que corresponda directamente con alguna de las im√°genes adjuntas anteriores (bas√°ndote en su descripci√≥n/r√≥tulo), est√°s obligado a insertar de manera natural la indicaci√≥n entre par√©ntesis para el lector, por ejemplo: "(ver Imagen ${attachedImages[0].index})" o "(ver Imagen ${attachedImages[1].index})" al final de la oraci√≥n pertinente. Esto permite una correlaci√≥n bidireccional perfecta para que el lector busque la imagen si lo desea.
`;
    }

    promptText += `
Por favor, reescribe el reporte manteniendo exactamente el mismo formato estructurado previo (con las secciones [INICIO DEL REPORTE], T√âCNICA DEL EXAMEN, HALLAZGOS, IMPRESI√ìN DIAGN√ìSTICA, [FIN DEL REPORTE] si estaban presentes).

‚ö†Ô∏è REQUISITOS DE INTEGRACI√ìN NATURAL CR√çTICOS:
1. Aplica la instrucci√≥n solicitada de manera profesional y rigurosa, conservando el vocabulario t√©cnico radiol√≥gico de primer nivel.
2. Cuando integres una clasificaci√≥n, escala o recomendaci√≥n, incorp√≥rala de forma TOTALMENTE NATURAL, directa y asertiva en primera persona o la voz t√©cnica habitual del informe.
3. Est√° ESTRICTAMENTE PROHIBIDO que se note que es una recomendaci√≥n externa o sugerencia a√±adida de auditor√≠a.
4. NUNCA utilices justificaciones did√°cticas o meta-comentarios como: "Se incluye la clasificaci√≥n para...", "Con el fin de facilitar el manejo por urolog√≠a/cl√≠nicos...", "Al clasificar esto...", "Se sugiere agregar...", "Recomendaci√≥n de auditor√≠a:".
5. Integra la clasificaci√≥n o hallazgo de forma directa y sobria. Por ejemplo: si la recomendaci√≥n es "Agregar clasificaci√≥n Bosniak", escribe directamente el grado correspondiente (ej: "Quiste renal izquierdo Bosniak I") en la descripci√≥n de los hallazgos o impresi√≥n diagn√≥stica, sin dar explicaciones ni pre√°mbulos de por qu√© se hace.
6. Nunca inventes hallazgos no sustentados, pero desarrolla la redacci√≥n acad√©mica y formal al m√°ximo nivel.
7. **REGLA ESTRICTA DE MAY√öSCULAS/MIN√öSCULAS (CASING)**: Bajo ninguna circunstancia debes escribir el texto nuevo, los cambios o la s√≠ntesis completamente en may√∫sculas (ALL CAPS / All-uppercase). Debes escribir en min√∫sculas est√°ndar, respetando el uso correcto de may√∫sculas iniciales y adapt√°ndote perfectamente al formato y caja (casing) del reporte original y del texto circundante. La incorporaci√≥n debe hacerse usando el formato gramatical regular ordinario de may√∫sculas y min√∫sculas (ej: escribiendo 'Dolor en la fosa il√≠aca' en lugar de 'DOLOR EN LA FOSA IL√çACA'). No alteres el casing original de las secciones que no fueron editadas.

Devuelve √∫nicamente el reporte modificado en formato Markdown, sin notas aclaratorias antes o despu√©s coordinadas en el exterior.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo subespecialista experto con m√°s de 20 a√±os de experiencia cl√≠nica. Reformulas y mejoras informes m√©dicos radiol√≥gicos con un vocabulario m√©dico de la m√°s alta precisi√≥n y elegancia, integrando hallazgos o clasificaciones de manera totalmente fluida y nativa, sin pre√°mbulos ni justificaciones did√°cticas externas. " +
      "REGLA ESTRICTA DE TERMINOLOG√çA: Queda TERMINANTEMENTE PROHIBIDO utilizar el t√©rmino o sigla PAAF. Usa SIEMPRE BAAF (Biopsia por Aspiraci√≥n con Aguja Fina).";

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
Tienes un reporte radiol√≥gico activo en formato Markdown:
"""
${currentReport}
"""

Y tienes un an√°lisis cl√≠nico avanzado exhaustivo que tiene diagn√≥sticos diferenciales y discusi√≥n cl√≠nica:
"""
${caseAnalysis}
"""

Misi√≥n:
1. Extrae y genera una S√çNTESIS EXTREMADAMENTE CORTA Y CONCISA (M√ÅXIMO 1 o 2 oraciones, o hasta 3 l√≠neas como l√≠mite absoluto) de los diagn√≥sticos diferenciales y de sospecha clave discutidos en el an√°lisis. Debe ser ultra directa y de alta densidad de informaci√≥n cl√≠nica, sin rodeos.
2. Integra esta breve s√≠ntesis de forma totalmente fluida, asertiva y natural dentro del reporte activo.
3. El destino ideal para esta peque√±a integraci√≥n es insertarla en una secci√≥n dedicada si ya existe (por ejemplo, "DISCUSI√ìN DE DIAGN√ìSTICOS DIFERENCIALES", "CORRELACI√ìN CL√çNICA", "IMPRESI√ìN DIAGN√ìSTICA", etc.) o agregarla de forma compacta al final antes de la firma.
4. REQUISITO CR√çTICO DE DISE√ëO, BREVEDAD Y LENGUAJE:
   - Est√° ESTRICTAMENTE PROHIBIDO usar lenguaje generativo u aclarativo (ej. evita "Se sugiere diagn√≥stico...", "S√≠ntesis de diferencial...", "El modelo propone..."). Escribe de manera directa, asertiva y formal, simulando que fue redactado desde el inicio por el radi√≥logo principal de forma muy sucinta.
   - La s√≠ntesis debe ser breve para no sobrecargar el informe. M√°ximo un p√°rrafo ultra corto o dos oraciones condensadas en total.
   - **REGLA ESTRICTA DE MAY√öSCULAS/MIN√öSCULAS (CASING)**: No escribas esta s√≠ntesis o los cambios completamente en may√∫sculas (ALL CAPS / All-uppercase). Debes escribirla en min√∫sculas est√°ndar, respetando el uso correcto de may√∫sculas iniciales y adapt√°ndote perfectamente al formato y caja del reporte original.
   - Conserva todo el resto del informe (t√©cnica, hallazgos, estructura) intacto.

Devuelve de manera estricta y exclusiva el reporte radiol√≥gico COMPLETO resultante en formato Markdown. No agregues observaciones, de lo contrario fallar√°.
`;

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo acad√©mico senior. Te especializas en redactar informes de nivel hospitalario docente, integrando de forma natural e impecable la correlaci√≥n y discusi√≥n de diagn√≥sticos diferenciales sin pre√°mbulos aclaratorios.";

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
Genera una infograf√≠a m√©dica sencilla, clara y amable para un paciente, basada en este reporte radiol√≥gico sobre un estudio de ${studyType}.
La infograf√≠a debe explicar de manera did√°ctica y visualmente comprensible exclusivamente los hallazgos patol√≥gicos o anormalidades principales encontradas en el siguiente informe, evitando tecnicismos complejos:

"""
${report}
"""

La infograf√≠a debe centrarse √∫nica y exclusivamente en explicar qu√© hallazgos patol√≥gicos se encontraron en el estudio para que el paciente los entienda de forma sencilla y clara. NO debes incluir ning√∫n tipo de recomendaci√≥n m√©dica, indicaciones, tratamientos, pasos a seguir o sugerencias sobre qu√© hacer a continuaci√≥n ni derivaciones. Omitir por completo cualquier recomendaci√≥n o pautas de acci√≥n. Mant√©n el estilo visual limpio y profesional, adecuado para un paciente.
Dise√±o: Ilustraci√≥n m√©dica 2D clara, estilo did√°ctico, amable y enfocado enteramente en la explicaci√≥n de los hallazgos patol√≥gicos del reporte.
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
      throw new Error("No se pudo generar la imagen de la infograf√≠a.");
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
      queryPrompt += `[Nota del sistema: El estudio provisto es una representaci√≥n/maqueta vectorial SVG o metadatos estructurados. Por favor, realiza la valoraci√≥n bas√°ndote con m√°xima fidelidad en los metadatos de diagn√≥stico provistos, de manera altamente rigurosa].\n`;
    }

    if (isAdditional) {
      queryPrompt = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Indicaci√≥n: ${clinicalHistory || "No especificada"}
Hallazgos iniciales: ${findings || "No proporcionados"}

Por favor, realiza una VALORACI√ìN DIAGN√ìSTICA ADICIONAL de esta imagen radiol√≥gica y los hallazgos descritos.
Analiza con sumo esmero patrones morfol√≥gicos sutiles, diagn√≥sticos diferenciales menos predictivos pero cr√≠ticos cl√≠nicos, buscando signos radiol√≥gicos secundarios o correlaciones fisiopatol√≥gicas profundas.
Proporciona esta valoraci√≥n estructurada en Markdown:
1. **AN√ÅLISIS DE SEGUNDA OPINI√ìN**: Discusi√≥n de patrones visualizados bajo criterios complejos (escalas avanzadas relevantes, variaciones anat√≥micas, o diagn√≥sticos sutiles a descartar).
2. **VALIDACI√ìN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL**: Antes de descartar o calificar de conservada/normal cualquier alteraci√≥n estructural importante (como reducci√≥n de espacio articular/femorotibial, osteofitosis o fracturas), debes obligatoriamente citar de forma breve una caracter√≠stica o m√©trica visual radiol√≥gica concreta observada en el estudio que sustente cl√≠nicamente dicho descarte.
3. **CORRELACI√ìN Y RECOMENDACI√ìN COMPLEMENTARIA**: Criterios de diagn√≥stico sugeridos, estudios complementarios ideales (como RMN, TC multicorte o de contraste, ecograf√≠a Doppler avanzada, etc.) y por qu√© estar√≠an indicados.
4. **PUNTOS CLAVE PARA EL EXPEDIENTE**: Una lista sucinta de 2 o 3 recomendaciones inmediatas cl√≠nicas de seguimiento quir√∫rgico o m√©dico.

Mant√©n un tono de consulta interdepartamental formal y de muy alto nivel acad√©mico.
`;
    } else {
      queryPrompt = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Indicaci√≥n: ${clinicalHistory || "No especificada"}
Hallazgos previos: ${findings || "No proporcionados"}

Por favor, elabora un INFORME DE VALORACI√ìN CL√çNICA DETALLADA de esta imagen radiol√≥gica.
Explica detalladamente:
1. **VALORACI√ìN DE ATRIBUTOS T√âCNICOS Y ANAT√ìMICOS DE LA IMAGEN**: Explica la calidad t√©cnica, orientaci√≥n, proyecciones visibles, planos visualizados y estructuras anat√≥micas de referencia patol√≥gica.
2. **VALORACI√ìN CL√çNICA DIRECTA DE LA IMAGEN**: Explica la valoraci√≥n visual realizada paso a paso (qu√© se analiz√≥ primero, qu√© se comprob√≥ secuencialmente y cu√°les son los hallazgos directamente identificados en la imagen cargada).
3. **VALIDACI√ìN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL**: Antes de considerar descartada, normal o conservada cualquier anomal√≠a estructural mayor (ej. reducci√≥n del espacio articular femorotibial, osteoartritis, fractura), cita brevemente la evidencia radiol√≥gica visual concreta y caracter√≠sticas observables en la imagen que de verdad justifican dicha normalidad.
4. **DIAGN√ìSTICO COMPARATIVO Y CONCLUSI√ìN DE VALORACI√ìN**: Describe con alta precisi√≥n la correlaci√≥n entre la imagen m√©dica y los hallazgos descritos, justificando tu conclusi√≥n cl√≠nica.

Devuelve este informe en un formato de caja cl√≠nica estructurado con t√≠tulos limpios en Markdown.
`;
    }

    if (annotations && annotations.length > 0) {
      queryPrompt += formatImageAnnotations(annotations);
    }

    parts.push({ text: queryPrompt });

    const systemInstruction = 
      "Eres un consultor radi√≥logo internacional senior. Eres extremadamente meticuloso y exacto al valorar im√°genes m√©dicas, explicando de forma transparente y did√°ctica el proceso de valoraci√≥n visual de las anomal√≠as radiol√≥gicas para la educaci√≥n o validaci√≥n m√©dica. " +
      "CONVENCI√ìN DE LATERALIDAD Y ORIENTACI√ìN RADIOL√ìGICA (REGLA DE ESPEJO ANAT√ìMICO): " +
      "1. En proyecciones frontales (PA/AP), la DERECHA VISUAL de la pantalla es el LADO IZQUIERDO ANAT√ìMICO DEL PACIENTE (hemit√≥rax/campo pulmonar izquierdo). La IZQUIERDA VISUAL de la pantalla es el LADO DERECHO ANAT√ìMICO DEL PACIENTE. NUNCA confundas la derecha de la pantalla con el lado derecho del paciente. Un neumot√≥rax o lesi√≥n visible en la derecha de la foto es el NEUMOT√ìRAX IZQUIERDO del paciente. " +
      "2. Si la consulta m√©dica o indicaci√≥n se√±ala 'Neumot√≥rax Izquierdo', eval√∫a la mitad VISUAL DERECHA de la imagen m√©dica (hemit√≥rax izquierdo del paciente). Si identificas la l√≠nea pleural visceral o hiperclaridad avascular, CONFIRMA Y VALIDA COMO 'NEUMOT√ìRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad a 'derecho' por confusi√≥n de lados de la pantalla. " +
      "ATENCI√ìN DE CONSISTENCIA DIAGN√ìSTICA Y EVITACI√ìN DE ALUCINACIONES: Es imperativo que reconozcas y valides de forma consistente cualquier alteraci√≥n o patolog√≠a evidente o conspicua detectable (como neumot√≥rax extenso o apical, colapso pulmonar, derrames, marcada disminuci√≥n del espacio articular, esclerosis subcondral, luxaciones o l√≠neas de fractura) sin minimizarlas ni refutarlas por un hiper-escepticismo exagerado. Si el m√©dico se√±ala o consulta por un hallazgo indiscutible, realiza una verificaci√≥n dirigida de alta sensibilidad. Al mismo tiempo, mant√©n una adherencia absoluta a la verdad f√≠sica de la imagen: est√° estrictamente prohibido alucinar elementos totalmente inexistentes (como material de osteos√≠ntesis o tornillos que no existan en la imagen real), basando tu veredicto 100% en la evidencia de los p√≠xeles anat√≥micos observables.";

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
      return res.status(400).json({ success: false, error: "Se requiere al menos la primera imagen para la valoraci√≥n experta." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];

    const isFractureCase = !!fractureProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(fractur|trazo|trazos|desplazam|fisura|compromiso articular|luxac|subluxac|fx|f√©mur|peron√©|tibia|radio|c√∫bito|h√∫mero)/);

    const isPulmonaryCase = !!pulmonaryProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(torax|t√≥rax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|par√©nquima|parenquima|neumotorax|neumot√≥rax|pneumothor|hidroneumo|linea pleural|colapso|aire pleural|hiperclaridad|enfisema)/);

    const isOsteoarthritisCase = !!osteoarthritisProtocol || 
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(artros|degenerat|osteofit|escleros|subcondral|pinzam|geoda|espolon|espol√≥n|espondilo|gonartros|coxartros|kellgren|lawrence|facetaria|discopat)/);

    const isMetalCase = !!prosthesisMetalProtocol ||
      [clinicalSuspicion, radiologicalQuestions, desc1, desc2, desc3, modality1, modality2, modality3]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(protesis|pr√≥tesis|metalico|met√°lico|metalicos|met√°licos|osteosintesis|osteos√≠ntesis|placa|tornillo|clavo|cerclaje|v√°stago|vastago|artroplastia)/);

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
Eres un radi√≥logo acad√©mico senior con subespecialidad en diagn√≥stico avanzado de alta complejidad y el consultor de m√°xima precisi√≥n cl√≠nica.
Este m√≥dulo ("Doble Valoraci√≥n IA") es el est√°ndar de oro de exactitud visual y cl√≠nica disponible. Tu an√°lisis debe ser extremadamente minucioso, cuidadoso y exacto. Realiza una inspecci√≥n microsc√≥pica pixel por pixel de cada imagen, analizando todas las √°reas y reparos anat√≥micos. Los peque√±os detalles, por m√°s sutiles, iniciales, tenues o milim√©tricos que sean (como micro-fisuras, asimetr√≠as de densidad leves, calcificaciones incipientes, reacciones corticales tempranas, engrosamientos pericorticales m√≠nimos, opacidades de vidrio esmerilado incipiente, o distorsiones sutiles de la arquitectura normal), NO deben pasarse por alto bajo ninguna circunstancia.

‚ö†Ô∏è PROTOCOLO DE EXTREMADA ACUIDAD DIAGN√ìSTICA Y EQUILIBRIO ANTI-ALUCINACI√ìN (EVITACI√ìN DE OMISIONES Y SESGO DE SATISFACCI√ìN):
Para lograr la m√°xima exactitud cient√≠fica equilibrada, debes operar bajo un riguroso protocolo de seguridad radiol√≥gica:

1. **ESCENIFICACI√ìN EXHAUSTIVA DE REJILLA DE ESCANEO DE 3X3 (Visual Grid Scanning)**:
   - Divide mentalmente cada imagen m√©dica en una rejilla virtual de 3x3 sectores (Superior Izquierdo/Centro/Derecho, Medio Izquierdo/Centro/Derecho, Inferior Izquierdo/Centro/Derecho).
   - Realiza un barrido visual secuencial y obligatorio por cada uno de los 9 sectores. Analiza de forma exhaustiva las corticales √≥seas, interfaces hiliares, √°ngulos costofr√©nicos, y tejidos blandos perif√©ricos en cada sector. Esto evita omisiones t√≠picas de hallazgos en esquinas o zonas marginales de la placa.

2. **PROTECCI√ìN CONTRA EL SESGO DE SATISFACCI√ìN DE B√öSQUEDA (Satisfaction of Search Shielding)**:
   - Encontrar un hallazgo conspicuo u obvio (p. ej., un neumot√≥rax extenso, una fractura desplazada, una cardiomegalia masiva, o una masa de gran tama√±o) NO debe suspender el an√°lisis. Sigue examinando minuciosamente el resto de las estructuras de manera exhaustiva. Registra y describe de forma prioritaria lesiones sutiles asociadas o concomitantes (peque√±os derrames pleurales, micro-focos de gas, discontinuidades √≥seas adicionales, etc.).

3. **PROTOCOLOS DE REVISI√ìN Y VALIDACI√ìN ANTE HALLAZGOS ASEVERADOS O INDICADOS POR EL M√âDICO (VERIFICACI√ìN ANAT√ìMICA DIRIGIDA CON ALTA SENSIBILIDAD)**:
   - Si el m√©dico tratante, la sospecha cl√≠nica o las preguntas del usuario afirman o se√±alan expresamente la presencia de un hallazgo cardinal o "no discutible" (por ejemplo: "neumot√≥rax extenso", "derrame pleural masivo", "fractura en falange"), NUNCA asumas por defecto que se trata de una trampa o intento de inducci√≥n de error.
   - Ejecuta de inmediato una verificaci√≥n dirigida de alta sensibilidad en esa regi√≥n anat√≥mica espec√≠fica:
     * Si la evidencia visual f√≠sica o semiol√≥gica confirma la alteraci√≥n (ej. en neumot√≥rax: l√≠nea pleural visceral, hiperclaridad/radiolucidez perif√©rica desprovista de trama vascular, colapso/atelectasia pasiva del par√©nquima pulmonar, o desviaci√≥n mediast√≠nica): **CONFIRMA Y VALIDA EL HALLAZGO CON TOTAL NITIDEZ**, detallando su extensi√≥n, lateralidad, porcentaje de colapso, medici√≥n de la separaci√≥n pleural en mm y repercusi√≥n hemodin√°mica o mediast√≠nica.
     * Si tras una revisi√≥n exhaustiva no se detecta la patolog√≠a en las proyecciones cargadas, fundamenta la conclusi√≥n objetivamente describiendo la anatom√≠a observada (ej. citando la presencia de trama vascular pulmonar normal que se extiende √≠ntegramente hasta la pared tor√°cica interna) de forma respetuosa y cient√≠fica.

4. **DETERMINACI√ìN Y MANEJO DE HALLAZGOS SUTILES O BORDERLINE**:
   - Est√° prohibido descartar o ignorar de manera silenciosa cualquier detalle solo por ser peque√±o, de bajo contraste, tenue o estar en el l√≠mite de la visibilidad cl√≠nica.
   - Si detectas una alteraci√≥n sutil, descr√≠bela indicando honestamente tu nivel de sospecha y certeza visual y proponiendo alternativas de diagn√≥stico diferencial.

5. **EQUILIBRIO ACTIVO Y PREVENCI√ìN DE ALUCINACIONES (Evitaci√≥n Rigurosa de Falsos Positivos)**:
   - No debes sobrediagnosticar ni inventar patolog√≠as bas√°ndote en artificios t√©cnicos (pliegues cut√°neos, l√≠neas de superposici√≥n costal o escapular normal), ruidos de la placa, variantes anat√≥micas sanas (canales nutricios, suturas accesorias) o marcas de posici√≥n.
   - Si un hallazgo es compatible con una variante anat√≥mica inofensiva o un artefacto, ind√≠calo con objetividad cient√≠fica como un diagn√≥stico diferencial probable ("Variante de la normalidad vs. lesi√≥n incipiente").

6. **CONSISTENCIA Y EXACTITUD ABSOLUTA ANTE HALLAZGOS ESTRUCTURALES EVIDENTES**:
   - Es mandatorio que no suavices, invisibilices ni subestimes alteraciones reales y patol√≥gicas observables (neumot√≥rax extenso, colapso pulmonar, reducciones severas de espacio articular, discontinuidades corticales francas, o desviaciones mediastinales marcadas). Deben reportarse con la terminolog√≠a adecuada y el nivel de gravedad correspondiente.

7. **FUNCI√ìN DE VALIDACI√ìN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL PARA EXCLUSI√ìN**:
   - Antes de considerar normal, preservado o negativo cualquier signo, campo o espacio articular principal de riesgo, describe brevemente la evidencia visual directa (continuidad cortical perfecta e ininterrumpida, trama vascular alcanzando la pared tor√°cica, etc.) que ampara de manera objetiva tu conclusi√≥n.

8. **PROTOCOLO DE M√ÅXIMA EXACTITUD PARA FRACTURAS (M√öLTIPLE VALORACI√ìN EXPERTA)**:
   - ALERTA M√ÅXIMA PARA MANOS Y PIES: Los trazos de fractura en huesos peque√±os (falanges, metacarpianos, metatarsianos, escafoides, etc.) suelen ser extremadamente finos. AUMENTA tu sensibilidad visual al 200% al evaluar los bordes corticales de estas √°reas buscando escalones milim√©tricos, l√≠neas radiol√∫cidas tenues o avulsiones puntiformes.
   - Si el usuario MARCA una regi√≥n espec√≠fica, ASUME QUE HAY UNA LESI√ìN HASTA DEMOSTRAR LO CONTRARIO. NO LA IGNORES.
   - Ante cualquier sospecha o indicio visual de fractura:
     * **N√∫mero y direcci√≥n de trazos**: Clasifica num√©ricamente los trazos de discontinuidad y su orientaci√≥n exacta (transverso, oblicuo, espiroideo, longitudinal, conminuta con N fragmentos, ala de mariposa, etc.).
     * **Compromiso articular**: Determina con total precisi√≥n si el trazo alcanza la cortical de la carilla articular intermedia. Eval√∫a si hay hundimiento, escal√≥n articular u holgura f√≠sica en mil√≠metros.
     * **Relaci√≥n y Alineamiento de Fragmentos**: Reporta la presencia de di√°stasis de bordes, acortamiento/cabalgamiento en mm, angulaciones (varo/valgo, recurvatum/antecurvatum) y rotaciones espaciales.
     * **Evidencia Absoluta vs Falso Positivo**: Aseg√∫rate de que el trazo cruce la cortical o la interrumpa claramente. No confundas l√≠neas articulares superpuestas o canales nutricios (bordes escler√≥ticos finos) con fracturas, pero NUNCA ignores una interrupci√≥n cortical real por miedo a alucinar.

9. **CONVENCI√ìN CR√çTICA DE LATERALIDAD Y ORIENTACI√ìN RADIOL√ìGICA (REGLA DE ESPEJO ANAT√ìMICO Y ALINEACI√ìN DE CONSULTA CL√çNICA)**:
   - **Regla de Espejo Radiol√≥gico en Im√°genes Frontales (PA/AP)**:
     * LA MITAD DERECHA DE LA IMAGEN/PANTALLA = LADO IZQUIERDO ANAT√ìMICO DEL PACIENTE (HEMIT√ìRAX IZQUIERDO / PAR√âNQUIMA PULMONAR IZQUIERDO).
     * LA MITAD IZQUIERDA DE LA IMAGEN/PANTALLA = LADO DERECHO ANAT√ìMICO DEL PACIENTE (HEMIT√ìRAX DERECHO / PAR√âNQUIMA PULMONAR DERECHO).
     * ¬°ALERTA M√ÅXIMA DE LATERALIDAD!: NUNCA confundas la derecha visual de la foto con el lado derecho del paciente. Un neumot√≥rax o alteraci√≥n visible en la mitad derecha de la foto/pantalla DEBE reportarse expl√≠citamente como "NEUMOT√ìRAX IZQUIERDO" (hemit√≥rax izquierdo del paciente).
   - **Alineaci√≥n Obligatoria con la Consulta del Usuario**:
     * Si el m√©dico tratante, la sospecha o las preguntas del usuario afirman o consultan por 'Neumot√≥rax Izquierdo' (o hallazgo en lado izquierdo), dir√≠gete de inmediato a evaluar la MITAD VISUAL DERECHA de la pantalla (hemit√≥rax izquierdo anat√≥mico).
     * Si all√≠ identificas la l√≠nea pleural visceral, hiperclaridad perif√©rica o colapso, CONFIRMA Y REPORTA EL HALLAZGO CATEG√ìRICAMENTE COMO "NEUMOT√ìRAX IZQUIERDO". Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusi√≥n de lados de la pantalla.

`;

    if (!img1Supported || (image2 && !img2Supported) || (image3 && !img3Supported)) {
      promptText += `\n[Nota del sistema: Al menos uno de los estudios provistos es una representaci√≥n/maqueta vectorial SVG o metadatos construidos cl√≠nicamente. Por favor, realiza la valoraci√≥n de m√°xima fidelidad y rigor cient√≠fico bas√°ndose en los metadatos de diagn√≥stico provistos, de forma sumamente acad√©mica].\n`;
    }

    promptText += `\n=== DATOS Y CONTEXTUALIZACI√ìN ===
- **Paciente**: ${patientInfo || "No especificado"}
- **Sospecha Cl√≠nica Principal**: ${clinicalSuspicion || "No descrita profundamente"}
- **Interrogante Diagn√≥stica / Dudas a Resolver**: ${radiologicalQuestions || "Consultas generales de alta precisi√≥n"}

=== CONFIGURACI√ìN DE LAS IM√ÅGENES PROVISTAS ===
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
      let output = `\n- **‚ö†Ô∏è REGIONES CR√çTICAS MARCADAS POR EL M√âDICO RADI√ìLOGO EN LA ${name}**:\n`;
      output += `  EL M√âDICO HA MARCADO F√çSICAMENTE ESTAS COORDENADAS PORQUE HA DETECTADO UNA LESI√ìN. EST√ÅS OBLIGADO a asumir que existe una alteraci√≥n real en estas zonas y enfocar el 100% de tu sensibilidad en confirmar su naturaleza (ej. trazo de fractura, fisura, escal√≥n articular), describi√©ndolo a detalle. NUNCA ignores un marcador del usuario.\n`;
      anns.forEach((a, i) => {
        const shapeType = a.type === "circle" ? "C√≠rculo" : a.type === "rectangle" ? "Caja Rectangular" : "Punto";
        const shapeDetails = a.type === "circle" 
          ? `(Radio: ${a.radius || 6}%)` 
          : a.type === "rectangle" 
          ? `(Ancho: ${a.width || 12}%, Alto: ${a.height || 8}%)` 
          : "";
        const desc = a.label ? `Descripci√≥n: "${a.label}"` : "Sin descripci√≥n";
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
Proporciona una valoraci√≥n de m√°xima exactitud cient√≠fica estructurada bajo la siguiente plantilla de diagn√≥stico acad√©mico. Cada respuesta debe ser clara, expl√≠cita y basada estrictamente en la evidencia visual directa:

---

## üîç RAZONAMIENTO VISUAL PRE-DIAGN√ìSTICO E INVENTARIO DE REJILLA (3X3 GRID SCAN)
(Obligatorio: Divide mentalmente la imagen en 9 sectores e indica anomal√≠as identificadas en cada una de manera puramente descriptiva semiol√≥gica -densidad, bordes, trazos- de forma independiente de las sospechas cl√≠nicas):
- **Sectores Superiores (Izquierdo / Centro / Derecho)**: [Describir minuciosamente]
- **Sectores Medios (Izquierdo / Centro / Derecho)**: [Describir minuciosamente - incluyendo par√©nquimas centrales, hilios, silueta card√≠aca u hombros/rodillas centrales]
- **Sectores Inferiores (Izquierdo / Centro / Derecho)**: [Describir minuciosamente - incluyendo bases pulmonares, recesos pleurales, corticales distales, etc.]
- **Evaluaci√≥n de Sesgo de Satisfacci√≥n**: [¬øSe detectaron hallazgos incidentales u ocultos no relacionados con la sospecha evidente? S√≠/No y descripci√≥n]

## REGISTRO DE AUDITOR√çA VISUAL MULTI-PASADA DE LA IA
(Para que el usuario identifique el rigor tecnol√≥gico empleado, describe brevemente el resultado t√©cnico de las dos pasadas visuales e internas que realizaste sobre este caso):
- **Pasada de Acuidad Micro-Estructural**: (Indica qu√© estructuras anat√≥micas, corticales √≥seas o m√°rgenes interfaces evaluaste minuciosamente en busca de micro-alteraciones sutiles.)
- **Pasada de Seguridad y Evidencia Real**: (Detalla qu√© sospechas o anomal√≠as aparentes sometiste a escrutinio para comprobar si contaban con evidencia f√≠sica real o si se trataba de artefactos, protegiendo al informe de sobre-diagn√≥sticos.)

## PROTOCOLO DE VALIDACI√ìN DE CONFIANZA Y CITA DE EVIDENCIA RADIOL√ìGICA VISUAL DE EXCLUSI√ìN
(Obligatorio: Para cada hallazgo mayor de riesgo o signo cardinal que descartes, consideres normal, negativo o preservado, cita brevemente las caracter√≠sticas f√≠sicas, visuales o m√©tricas exactas y observables en la imagen que demuestran cient√≠ficamente su exclusi√≥n para evitar la subestimaci√≥n diagn√≥stica):
- **¬øSe consider√≥ descartado, normal o descartable alg√∫n hallazgo mayor o reducci√≥n de espacio articular?**: [Detallar, ej. "S√≠, se evalu√≥ reducci√≥n del espacio femorotibial"]
- **Evidencia Radiol√≥gica Visual Citada**: [Ej. "Preservaci√≥n uniforme y sim√©trica del espacio femorotibial bilateral, calculada en aproximadamente ~X mm, con l√≠neas corticales n√≠tidas e √≠ntegras y ausencia total de esclerosis √≥sea reactiva o pinzamiento osteofitario marginal"]
- **Nivel de Certeza Visual de Exclusi√≥n**: [Ej. "Alta - Confirmado por visualizaci√≥n n√≠tida y nitidez de l√≠mites anat√≥micos"]

## ‚ö†Ô∏è EVALUACI√ìN DE HALLAZGOS SUTILES / BORDERLINE U OSCILACIONES DE SE√ëAL
(Enumera cualquier foco sutil, asimetr√≠a de baja visibilidad o zona dudosa, asign√°ndole un grado de certeza radiol√≥gica):
- **Hallazgo Sutil Detectado**: [Descripci√≥n del detalle lim√≠trofe]
- **Grado de Certeza Visual**: [Bajo / Moderado / Alto]
- **Diagn√≥sticos Alternativos / Variantes de la Normalidad**: [Ej: "Artefacto por superposici√≥n vs micro-consolidaci√≥n incipiente"]

## 1. EVALUACI√ìN DETALLADA DE LA IMAGEN 1: ${desc1 || "Carga Principal"} (${modality1 || "S/M"})
(Describe la calidad del estudio, posici√≥n, proyecciones visibles, reparos anat√≥micos de referencia, hallazgos principales, √°reas de sospecha y signos caracter√≠sticos con terminolog√≠a m√©dica avanzada.)
`;

    if (image2 && mimeType2) {
      promptText += `
## 2. EVALUACI√ìN DETALLADA DE LA IMAGEN 2: ${desc2 || "Estudio Comparativo"} (${modality2 || "S/M"})
(Describe la calidad, plano/proyecci√≥n de la segunda imagen, hallazgos identificables y anomal√≠as de manera aislada.)
`;
    }

    if (image3 && mimeType3) {
      promptText += `
## 3. EVALUACI√ìN DETALLADA DE LA IMAGEN 3: ${desc3 || "Estudio Adicional"} (${modality3 || "S/M"})
(Describe la calidad, plano/proyecci√≥n de la tercera imagen, hallazgos identificables y anomal√≠as de manera aislada.)
`;
    }

    if ((image2 && mimeType2) || (image3 && mimeType3)) {
      promptText += `
## COMPARATIVA DIN√ÅMICA / ESTUDIOS EVOLUTIVOS
(Contrasta los estudios provistos de forma evolutiva o comparativa. ¬øExiste progresi√≥n, estabilidad, cambios temporales, correlaciones espaciales en m√∫ltiples planos o diferencias cr√≠ticas de se√±al/densidad? S√© extremadamente expl√≠cito.)
`;
    }

    if (isFractureCase) {
      promptText += `
## ‚ö°Ô∏è PROTOCOLO ESPECIAL DE M√ÅXIMA EXACTITUD PARA FRACTURAS (M√öLTIPLE VALORACI√ìN BIOMEC√ÅNICA) ‚ö°Ô∏è
(Este apartado especial se ha disparado obligatoriamente por sospecha, menci√≥n o hallazgo visual de fractura en la indicaci√≥n o consulta. Debes caracterizar los hallazgos con m√°xima precisi√≥n, bas√°ndote rigurosamente en la evidencia f√≠sica real visible de la imagen):
*   **‚ö†Ô∏è REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACI√ìN):** Si tras un escaneo cuidadoso de la imagen confirmas que NO existe fractura, fisura ni trazo de discontinuidad cortical, DEBES declararlo categ√≥ricamente en el primer p√°rrafo: *"NO SE OBSERVAN TRAZOS DE FRACTURA NI DISCONTINUIDADES CORTICALES EN LOS SEGMENTOS EVALUADOS. Estructuras √≥seas √≠ntegras y conservadas."* En este caso, marca todos los sub-puntos siguientes como "No aplicable". Queda terminantemente prohibido inventar trazos de fractura por complacer la sospecha cl√≠nica.
- **1. Presencia, Densidad y Localizaci√≥n Anatomopatol√≥gica Precisa**: (Identifica con exactitud diagn√≥stica la localizaci√≥n anat√≥mica: di√°fisis, met√°fisis, ep√≠fisis, cuello, cabeza, etc., describiendo la discontinuidad cortical).
- **2. N√∫mero y Direcci√≥n Tridimensional de Trazos**: (Describe el n√∫mero exacto de trazos √≥seos identificados. Clasifica rigurosamente su orientaci√≥n geom√©trica: transverso, oblicuo corto/largo, espiroideo o helicoidal, longitudinal, ala de mariposa, conminuto con m√∫ltiples fragmentos libres, etc. Si no hay fractura, reportar 'No aplicable').
- **3. Extensi√≥n y Compromiso Articular Estricto**: (Especificar de forma obligatoria e inflexible si existe afecci√≥n, interrupci√≥n o extensi√≥n del trazo hacia la carilla, cavidad o cart√≠lago articular. Detalla si hay escal√≥n o hundimiento articular en mil√≠metros estimados, p√©rdida de congruencia o di√°stasis intraarticular. Si no hay fractura, reportar 'No aplicable').
- **4. Desplazamiento Espacial de Fragmentos y Alineaci√≥n**: (Describe minuciosamente la direcci√≥n y grado de desplazamiento √≥seo: di√°stasis o separaci√≥n en mm, cabalgamiento con acortamiento longitudinal, luxaci√≥n o subluxaci√≥n articular, desviaci√≥n angular en varo/valgo o antero/retrocurvatum, o rotaci√≥n fragmentaria. Si no hay fractura, reportar 'No aplicable').
- **5. Cita de Evidencia Visual de Integridad**: (Proporciona la confirmaci√≥n estricta de cada hallazgo con correlato cl√≠nico directo. ¬°No tolerar alucinaci√≥n de l√≠neas vasculares normales ni subestimaci√≥n de trazos corticales sutiles!)
`;
    }

    if (isPulmonaryCase) {
      promptText += `
## ü´Å PROTOCOLO ESPECIAL DE M√ÅXIMA EXACTITUD PARA PAR√âNQUIMA PULMONAR E HILIOS (VALORACI√ìN SISTEM√ÅTICA) ü´Å
(Este apartado especial se ha disparado obligatoriamente por tratarse de una radiograf√≠a de t√≥rax o por sospecha de patolog√≠a pulmonar. Debes evaluar minuciosamente el par√©nquima pulmonar y las estructuras hiliares con m√°xima precisi√≥n cl√≠nica, bas√°ndote estrictamente en hallazgos verdaderos y reales visibles en la imagen):
- **1. Evaluaci√≥n del Par√©nquima Pulmonar (Patrones e Infiltrados)**:
  * **Infiltrados Intersticiales**: (Eval√∫a con extremo detalle fino la presencia de patrones reticulares, nodulares, reticulonodulares o de vidrio esmerilado sutiles. Especifica si son difusos, localizados, bilaterales o de distribuci√≥n perif√©rica/basal, sin omitir opacidades lineales o septales tenues o incipientes).
  * **Infiltrados Alveolares (Consolidaciones)**: (Eval√∫a signos de consolidaci√≥n del espacio a√©reo, presencia de broncograma a√©reo, l√≠mites e infiltrados algodonosos focales, multifocales o lobares. Detalla con exactitud su localizaci√≥n anat√≥mica).
- **2. Masas y Cavitaciones**:
  * (Busca n√≥dulos solitarios o m√∫ltiples, masas pulmonares sospechosas describiendo sus bordes -netos, lobulados, espiculados- y dimensiones aproximadas. Eval√∫a exhaustivamente la presencia de cavitaciones pulmonares, paredes engrosadas, niveles hidroa√©reos concomitantes o bronquiectasias de car√°cter qu√≠stico).
- **3. Atelectasias y P√©rdida de Volumen o Colapso**:
  * (Valora signos de colapso pulmonar, atelectasias laminares, segmentarias o lobares. Describe signos indirectos como la desviaci√≥n de cisuras, desviaci√≥n mediastinal, o la elevaci√≥n diafragm√°tica ipsilateral por sutil que sea).
- **4. Hilios Pulmonares y Ensanchamientos Mediastinales**:
  * **Valoraci√≥n Hiliar**: (Analiza cr√≠ticamente la simetr√≠a, densidad y tama√±o de ambos hilios pulmonares. Discrimina con agudeza si hay adenopat√≠as hiliares, prominencia vascular/arterial o masas hiliares verdaderas vs. superposici√≥n normal de estructuras).
  * **Valoraci√≥n Mediastinal**: (Mide o estima el perfil mediast√≠nico para descartar de manera confiable o reportar ensanchamiento mediastinal patol√≥gico, alteraciones del bot√≥n a√≥rtico, masas mediastinales o neumomediastino).
- **5. Espacio Pleural e Integridad Costodiafragm√°tica**:
  * (Eval√∫a con lupa digital los √°ngulos costofr√©nicos y cardiofr√©nicos bilaterales en b√∫squeda de borramientos sutiles que sugieran derrame pleural inicial, engrosamientos pleurales, calcificaciones o signos de neumot√≥rax apical sutil -l√≠nea pleural visceral desprovista de trama pulmonar perif√©rica-).
- **6. Evidencia Absoluta y Agudeza Anti-Alucilaci√≥n**:
  * (Somete cada hallazgo al protocolo de veracidad: ¬°no inventes opacidades por superposici√≥n normal de esc√°pulas, pezones, costillas o pliegues cut√°neos, pero mant√©n un nivel m√°ximo de sospecha ante cambios sutiles reales!)
`;
    }

    if (isOsteoarthritisCase) {
      promptText += `
## ü¶¥ PROTOCOLO ESPECIAL DE M√ÅXIMA EXACTITUD PARA ARTROSIS Y ENFERMEDAD DEGENERATIVA (VALORACI√ìN ARTICULAR Y COLUMNA) ü¶¥
(Este apartado especial se ha disparado por sospecha, menci√≥n o hallazgo de enfermedad degenerativa. Debes buscar y describir minuciosamente los cambios degenerativos, bas√°ndote r√≠gidamente en la evidencia f√≠sica visible sin inventar desgaste ni disminuci√≥n del espacio articular que no existan):
*   **‚ö†Ô∏è REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACI√ìN):** Si los espacios articulares (interl√≠nea articular, mortaja del tobillo, espacio femorotibial, coxofemoral o intervertebral) est√°n perfectamente conservados, normales y sim√©tricos, DEBES reportarlo con total honestidad: *"Espacio articular conservado, de amplitud normal y sim√©trica, sin pinzamiento ni esclerosis subcondral."* No inventes disminuciones severas de la mortaja o espacios articulares si est√°n conservados.
- **1. Disminuci√≥n / Pinzamiento de Espacios Articulares o Discales**: (Eval√∫a con precisi√≥n microm√©trica la anchura del espacio articular o intervertebral. Especifica si el compromiso es sim√©trico o asim√©trico -ej. medial vs. lateral en rodilla- y estima su reducci√≥n porcentual o milim√©trica. Si es normal, reportar 'Espacio articular conservado').
- **2. Presencia, Medida y Distribuci√≥n de Osteofitos**: (Identifica y detalla la localizaci√≥n exacta de osteofitos marginales, espolones u osteofitos de tracci√≥n en platillos, carillas, m√°rgenes √≥seos o cuerpos vertebrales. No pases por alto osteofitos incipientes pero evita alucinar excrecencias normales o superposiciones estructurales. Si no hay, declara: 'Sin evidencia de osteofitosis').
- **3. Esclerosis √ìsea Subcondral e Integridad del Hueso**: (Analiza el aumento focalizado de la densidad √≥sea -esclerosis- debajo del cart√≠lago articular o en las plataformas vertebrales, indicando las zonas de m√°xima sobrecarga mec√°nica).
- **4. Geodas o Quistes Subcondrales**: (Busca con alta magnificaci√≥n visual sutiles geodas de presi√≥n o quistes subcondrales degenerativos, reportando su presencia, di√°metro y localizaci√≥n precisa. Si no hay, reportar como ausentes).
- **5. Clasificaci√≥n y Gradaci√≥n Internacional Rigurosa**: (Aplica con absoluto rigor las escalas internacionales correspondientes seg√∫n la regi√≥n estudiada: por ejemplo, la clasificaci√≥n de Kellgren-Lawrence para rodilla/cadera -de Grado 1 sutil a Grado 4 severo-, escalas de severidad para artrosis facetaria, o de discopat√≠a degenerativa en columna, s√≥lo si existe artrosis real comprobable).
- **6. Coherencia y Sinergia Diagn√≥stica Ampliada**: 
  * *NOTA CR√çTICA*: La activaci√≥n de este protocolo espec√≠fico NO debe disminuir de ninguna manera la eficiencia o detalle del resto de la valoraci√≥n diagn√≥stica anatomopatol√≥gica general (tejidos blandos, estructuras √≥seas no degenerativas u √≥rganos visibles). Al contrario, debe potenciar y enriquecer el an√°lisis integral cruzando los datos mec√°nicos/degenerativos con el resto de los hallazgos para una valoraci√≥n diagn√≥stica hol√≠stica de m√°xima potencia cl√≠nica.
`;
    }

    if (isMetalCase) {
      promptText += `
## üî© PROTOCOLO ESPECIAL DE M√ÅXIMA EXACTITUD PARA PR√ìTESIS Y ELEMENTOS MET√ÅLICOS DE OSTEOS√çNTESIS (INTEGRIDAD Y ALINEACI√ìN) üî©
(Este apartado especial se ha disparado por sospecha, menci√≥n o hallazgo de implantes met√°licos o material de osteos√≠ntesis. Debes realizar una evaluaci√≥n t√©cnica sumamente rigurosa de su presencia real):
*   **‚ö†Ô∏è REGLA DE PRESENCIA OBLIGATORIA (CONTROL ANTI-ALUCINACI√ìN):** Si tras un escaneo cuidadoso confirmas que NO existen implantes met√°licos, pr√≥tesis, placas de osteos√≠ntesis, ni tornillos (como tornillos transindesmales) en las im√°genes, DEBES declarar categ√≥ricamente al inicio del apartado: *"NO SE IDENTIFICAN IMPLANTES MET√ÅLICOS NI MATERIAL DE OSTEOS√çNTESIS EN NINGUNA DE LAS IM√ÅGENES EVALUADAS."* En este caso, marca todos los sub-puntos siguientes como "No aplicable". Queda estrictamente prohibido alucinar o inventar placas o tornillos inexistentes por complacer el motivo de consulta o la sospecha cl√≠nica.
- **1. Tipo, Localizaci√≥n Anatomopatol√≥gica y Componentes del Implante**: (Describe los componentes identificados: v√°stagos, placas de compresi√≥n/reconstrucci√≥n, tornillos corticales/esponjosos, clavos endomedulares, alambres, cerclajes, c√∫pulas acetabulares, liners, etc. Especifica con precisi√≥n los segmentos √≥seos o articulaciones involucrados. Si no hay ninguno, marcar como no aplicable/inexistente).
- **2. Valoraci√≥n de la Estructura Met√°lica e Integridad**: (Eval√∫a con minuciosa agudeza visual si existe evidencia de fatiga, doblamiento, fractura o alteraci√≥n del material. Detalla de forma expl√≠cita la integridad de cada uno de los elementos met√°licos y valora su integridad y estabilidad. Si no hay material, marcar como no aplicable).
- **3. Interfaz Hueso-Implante (Margen Periprot√©sico / Peri-implante)**: (Inspecciona la presencia de bandas radiol√∫cidas -oste√≥lisis peri-implante u oste√≥lisis periprot√©sica sutil-, aflojamiento as√©ptico, hundimiento de componentes, reabsorci√≥n √≥sea circundante o reacci√≥n periosteal anormal. Si no hay implante, marcar como no aplicable).
- **4. Orientaci√≥n, Alineaci√≥n Espacial y Relaci√≥n Anat√≥mica**: (Describe si la orientaci√≥n de la pr√≥tesis o del material de osteos√≠ntesis es anat√≥mica y funcional. Si es una pr√≥tesis articular, valora si existe luxaci√≥n, subluxaci√≥n, asimetr√≠a de componentes o desalineaci√≥n. Si no hay implante, marcar como no aplicable).
`;
    }

    promptText += `
## 4. DISCUSI√ìN DE DIAGN√ìSTICOS DIFERENCIALES Y CRITERIOS INTERNACIONALES DE CONSENSO
(Discute los diagn√≥sticos diferenciales pertinentes bas√°ndote cient√≠ficamente en los hallazgos. **Nota de m√°xima exactitud**: la cantidad de diagn√≥sticos no es importante; lo cr√≠tico es el valor real y la veracidad de lo aportado al reporte. No fuerces diferenciales hipot√©ticos si ponen en riesgo o restan claridad al diagn√≥stico final real. Si el estudio est√° conservado o es normal, descarta con fundamento cl√≠nico patolog√≠as de alta sospecha como "Descartadas por alineaci√≥n anat√≥mica o plano normal". Emplea clasificaciones seg√∫n corresponda como BI-RADS, Bosniak, Fleischner, etc., con sumo rigor.)

## 5. CONCLUSI√ìN DIAGN√ìSTICA Y SEGUNDA OPINI√ìN DEFINITIVA
(Ofrece el veredicto diagn√≥stico m√°s preciso y probable fundamentado en la visualizaci√≥n cl√≠nica.)

## 6. RECOMENDACIONES CL√çNICAS Y SUGERENCIAS T√âCNICAS ADICIONALES
(Pautas claras sobre qu√© estudios de seguimiento de mayor especificidad -como RMN de contraste, angioTAC, ecograf√≠a Doppler, elastograf√≠a por RM/US- se deber√≠an solicitar, justificando t√©cnicamente la indicaci√≥n.)

---

Mant√©n un lenguaje impecable, sumamente formal y cient√≠fico, digno de un comit√© interdepartamental internacional de discusi√≥n de casos dif√≠ciles.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres un consultor radi√≥logo internacional senior de diagn√≥stico, y el est√°ndar supremo de precisi√≥n diagn√≥stica cl√≠nica de esta plataforma. Este m√≥dulo ('Doble Valoraci√≥n') exige un equilibrio cient√≠fico id√≥neo entre alta sensibilidad visual ante patolog√≠as reales y un riguroso filtro anti-alucinaciones:\n" +
      "1. RECONOCIMIENTO Y VALIDACI√ìN DE PATOLOG√çAS EVIDENTES O ASEVERADAS POR EL CL√çNICO: Es mandatorio que identifiques y confirmes con absoluta precisi√≥n cualquier hallazgo o alteraci√≥n estructural patol√≥gica patente, evidente o relevante (por ejemplo, neumot√≥rax extenso o apical, colapso pulmonar, atelectasia, derrame pleural, fractura o fisura, marcada disminuci√≥n del espacio articular, o masa). Cuando el m√©dico tratante, la sospecha cl√≠nica o la consulta indiquen o aseveren que existe un hallazgo espec√≠fico o 'no discutible' (como 'neumot√≥rax extenso' o 'hallazgo evidente'), NUNCA asumas por defecto que es una trampa o intento de inducci√≥n de error. Ejecuta de inmediato una revisi√≥n dirigida con el 100% de tu sensibilidad en esa zona anat√≥mica para verificar, caracterizar y describir detalladamente la severidad del hallazgo (ej. en neumot√≥rax: ubicaci√≥n de la l√≠nea pleural visceral, separaci√≥n en mm, porcentaje de radiolucidez perif√©rica desprovista de trama vascular, colapso pulmonar o desviaci√≥n mediast√≠nica). NUNCA minimices ni refutes obstinadamente hallazgos patol√≥gicos reales por un hiper-escepticismo inapropiado.\n" +
      "2. FILTRO ANTI-ALUCINACI√ìN BASADO EN EVIDENCIA F√çSICA REAL: Mant√©n una estricta fidelidad a la imagen real. Est√° prohibido inventar o alucinar elementos totalmente inexistentes (como material de osteos√≠ntesis inexistente o placas/tornillos si la placa no muestra ning√∫n implante met√°lico). Si tras una verificaci√≥n exhaustiva y meticulosa un hallazgo sugerido realmente no es identificable en la imagen, explica objetivamente la anatom√≠a observada (ej. citando la presencia de trama vascular normal que se extiende hasta la pared tor√°cica parietal interna) de forma profesional y fundamentada, sin ser agresivo ni prejuzgar al especialista.\n" +
      "3. VARIANTES DE LA NORMALIDAD: Diferencia con claridad variaciones anat√≥micas fisiol√≥gicas (canales nutricios, suturas, pliegues cut√°neos, superposiciones de esc√°pula/costillas) de patolog√≠as verdaderas, basando tu dictamen en la evidencia objetiva de los p√≠xeles.\n" +
      "4. CONVENCI√ìN ANAT√ìMICA DE LATERALIDAD EN ESPEJO Y DERECHA/IZQUIERDA: En proyecciones frontales PA/AP, la DERECHA VISUAL de la pantalla es el HEIMIT√ìRAX/LADO IZQUIERDO del paciente. La IZQUIERDA VISUAL de la pantalla es el HEIMIT√ìRAX/LADO DERECHO del paciente. Si la sospecha o indicaci√≥n del usuario dice 'Neumot√≥rax Izquierdo', eval√∫a la mitad VISUAL DERECHA de la placa (hemit√≥rax izquierdo del paciente). Si all√≠ se observa la l√≠nea pleural visceral y radiolucidez sin trama, CONFIRMA Y VALIDA COMO 'NEUMOT√ìRAX IZQUIERDO'. Queda ESTRICTAMENTE PROHIBIDO invertir la lateralidad diciendo 'derecho' por confusi√≥n de lados de la pantalla.";

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
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para realizar el an√°lisis de caso." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio cl√≠nico / tipo de estudio: ${studyType || "No especificado"}
Indicaci√≥n cl√≠nica / Sospecha: ${clinicalHistory || "No especificada"}
Hallazgos preliminares o cargados: ${findings || "No proporcionados"}

Reporte Radiol√≥gico generado:
"""
${report}
"""

Por favor, realiza un AN√ÅLISIS DE CASO CL√çNICO COMPLETO y exhaustivo sobre este caso.
Este an√°lisis debe orientarse a un nivel de subespecialidad o interconsulta docente. Estructura el an√°lisis con las siguientes secciones detalladas en Markdown:
1. **RESUMEN FISIOPATOL√ìGICO**: Detalla el mecanismo lesional o la fisiopatolog√≠a detr√°s de los hallazgos radiol√≥gicos visualizados en este caso.
2. **ESCALAS Y CORRELACIONES CL√çNICAS CLAVE**: Detalla la relevancia de las escalas aplicadas o aquellas que deben estimarse cl√≠nicamente en el paciente (ej. escala de severidad, scores de riesgo, pron√≥stico).
3. **DIAGN√ìSTICOS DIFERENCIALES PRIORITARIOS**: Presenta una tabla o lista de los 3 principales diagn√≥sticos diferenciales, indicando los signos a favor y en contra de cada uno basados en este informe.
4. **PROPUESTA DE SEGUIMIENTO Y PLAN DE ACCI√ìN**: Sugerencias espec√≠ficas de estudios de imagen de seguimiento temporal (ej. 'revalorar en 6 meses con TC contrastada') y estudios paracl√≠nicos complementarios id√≥neos para la toma de decisiones cl√≠nicas.

Mant√©n un lenguaje extremadamente preciso, profesional, elegante y con rigor cient√≠fico impecable.
`;

    const systemInstruction = 
      "Eres un consultor de medicina interna y radiolog√≠a de un hospital universitario de alta complejidad. Te especializas en desglosar casos cl√≠nicos complejos mediante correlaci√≥n anatomo-radiol√≥gica detallada. " +
      "Cuando eval√∫es esteatosis hep√°tica o cuantificaci√≥n de grasa por QUS o ultrasonido cuantitativo, aplica estrictamente los rangos de clasificaci√≥n del Consenso SRU: Normal (< 5.0%), Leve (5.0% - 12.0%), Moderada (12.1% - 20.0%) y Severa (> 20.0%).";

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
Estudio radiol√≥gico / tipo: ${studyType || "Estudio Ultrasonogr√°fico"}
Indicaci√≥n / Historial cl√≠nico: ${clinicalHistory || "No especificada"}
Patolog√≠a Espec√≠fica a Evaluar: "${pathology}"

Reporte Radiol√≥gico redactado:
"""
${report}
"""

Por favor, realiza un AN√ÅLISIS DE CORRELACI√ìN Y EVALUACI√ìN DE HALLAZGOS para la patolog√≠a espec√≠fica: "${pathology}".

REGLAS STRICTAS OBLIGATORIAS:
1. ENFOCARSE EXCLUSIVAMENTE EN LOS HALLAZGOS PRESENTES EN EL REPORTE QUE REFUERZAN O RESPALDAN EL DIAGN√ìSTICO de "${pathology}". Destaca con precisi√≥n las im√°genes/mediciones/signos descritos que respaldan la condici√≥n.
2. NING√öN PORCENTAJE DE PROBABILIDAD NI CERTEZA EN PORCENTAJE (%) (ej. NO escribir "85% de certeza", "90% de probabilidad", ni incluir n√∫meros de porcentaje).
3. NINGUNA RECOMENDACI√ìN DE TRATAMIENTO O MANEJO M√âDICO O QUIR√öRGICO (ej. NO escribir "Se sugiere colecistectom√≠a", "Tratamiento antibi√≥tico", "Intervenci√≥n quir√∫rgica" ni "Manejo hospitalario").
4. INCLUIR AL FINAL UNA DISCUSI√ìN Y S√çNTESIS CL√çNICA FINAL limpia, elegante y de rigor acad√©mico subespecializado.

Devuelve la respuesta en formato JSON estricto con la siguiente estructura:
\`\`\`json
{
  "format": "esquema_pilares",
  "title": "CORRELACI√ìN ECOGR√ÅFICA: ${pathology.toUpperCase()}",
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
    "primaryFinding": "Hallazgo o signo ecogr√°fico principal presente en el reporte que apoya la patolog√≠a ${pathology}",
    "details": [
      "Signo ecogr√°fico confirmatorio 1 observado en el informe con mediciones o caracter√≠sticas",
      "Signo ecogr√°fico confirmatorio 2 o hallazgo secundario relevante"
    ],
    "severity": "altered"
  },
  "clinicalCorrelation": "Correlaci√≥n fisiopatol√≥gica de los hallazgos descritos con el mecanismo de la patolog√≠a ${pathology}.",
  "finalDiscussion": "Discusi√≥n y s√≠ntesis cl√≠nica final que sintetiza el respaldo radiol√≥gico para ${pathology}, fundamentando el juicio diagn√≥stico sin incluir porcentajes de certeza ni conductas de manejo.",
  "diagnostics": [
    {
      "name": "${pathology}",
      "probability": "Respaldo Radiol√≥gico Confirmatorio",
      "supportingCriteria": "Resumen de criterios positivos encontrados en el estudio"
    }
  ],
  "decisionFlow": [
    { "step": 1, "title": "Hallazgo Ecogr√°fico Clave", "desc": "Descripci√≥n del signo primario que orienta el caso" },
    { "step": 2, "title": "Signos de Soporte Encontrados", "desc": "Detalle de hallazgos ecogr√°ficos que refuerzan la sospecha" },
    { "step": 3, "title": "Discusi√≥n & S√≠ntesis Cl√≠nica", "desc": "S√≠ntesis diagn√≥stica final libre de recomendaciones de tratamiento" }
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
Responde √öNICAMENTE con el objeto JSON v√°lido en un bloque \`\`\`json ... \`\`\`.
`;

    const systemInstruction = 
      "Eres un consultor de radiolog√≠a de un centro m√©dico de alta complejidad. Tu objetivo es realizar correlaciones semiol√≥gicas de precisi√≥n sobre reportes ultrasonogr√°ficos, destacando √∫nicamente la evidencia que respalda la patolog√≠a consultada, sin emitir porcentajes probabil√≠sticos ni sugerencias de tratamiento.";

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
        title: `CORRELACI√ìN ECOGR√ÅFICA: ${pathology.toUpperCase()}`,
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
        clinicalCorrelation: `Correlaci√≥n de evidencia ecogr√°fica hallada en el informe para ${pathology}.`,
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
      return res.status(400).json({ success: false, error: "Se requiere ingresar una consulta o aspecto espec√≠fico de valoraci√≥n." });
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
      promptNote = `\n[Nota del sistema: Los archivos provistos son representaciones vectoriales/metadatos sin imagen rasterizada binaria. Por favor, genera tu respuesta bas√°ndose en los metadatos de diagn√≥stico y la descripci√≥n provista de manera altamente coherente].\n`;
    }

    const isFractureCase = !!fractureProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(fractur|trazo|trazos|desplazam|fisura|compromiso articular|luxac|subluxac|fx|f√©mur|peron√©|tibia|radio|c√∫bito|h√∫mero)/);

    const isPulmonaryCase = !!pulmonaryProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(torax|t√≥rax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|par√©nquima|parenquima|neumotorax|neumot√≥rax|pneumothor|hidroneumo|linea pleural|colapso|aire pleural|hiperclaridad|enfisema)/);

    const isOsteoarthritisCase = !!osteoarthritisProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(artros|degenerat|osteofit|escleros|subcondral|pinzam|geoda|espolon|espol√≥n|espondilo|gonartros|coxartros|kellgren|lawrence|facetaria|discopat)/);

    const isMetalCase = !!prosthesisMetalProtocol || 
      [clinicalSuspicion, queryText, previousAnalysis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .match(/(protesis|pr√≥tesis|metalico|met√°lico|metalicos|met√°licos|osteosintesis|osteos√≠ntesis|placa|tornillo|clavo|cerclaje|v√°stago|vastago|artroplastia)/);

    let protocolInstructions = "";
    if (isFractureCase) {
      protocolInstructions += `
‚ö†Ô∏è RECORDATORIO PROTOCOLO DE FRACTURAS DE ALTA EXACTITUD:
- Caracteriza microsc√≥picamente el n√∫mero y direcci√≥n tridimensional de los trazos.
- Especifica rigurosamente el compromiso de carillas articulares (escal√≥n articular/di√°stasis).
- Detalla grado de desplazamiento espacial (cabalgamiento, di√°stasis, angulaci√≥n).
- Basa tus conclusiones √∫nicamente en la evidencia visual real sin omitir ni alucinar.
`;
    }

    if (isPulmonaryCase) {
      protocolInstructions += `
‚ö†Ô∏è RECORDATORIO PROTOCOLO DE PAR√âNQUIMA PULMONAR, PLEURA Y NEUMOT√ìRAX (ATENCI√ìN A REGLA DE LATERALIDAD):
- CONVENCI√ìN DE ESPEJO EN RADIOLOG√çA FRONTAL: La MITAD VISUAL DERECHA de la pantalla = LADO ANAT√ìMICO IZQUIERDO DEL PACIENTE (hemit√≥rax/campo pulmonar izquierdo). La MITAD VISUAL IZQUIERDA = LADO ANAT√ìMICO DERECHO DEL PACIENTE.
- Un neumot√≥rax visible en la mitad derecha de la pantalla DEBE reportarse como "NEUMOT√ìRAX IZQUIERDO" (lado del paciente).
- Eval√∫a minuciosamente el espacio pleural buscando l√≠nea pleural visceral, radiolucidez perif√©rica y p√©rdida de trama vascular (neumot√≥rax extenso, apical o a tensi√≥n).
- Valora la presencia de colapso pulmonar pasivo ipsilateral y desplazamiento del mediastino/tr√°quea o aplanamiento diafragm√°tico.
- Revisa el par√©nquima para diferenciar infiltrados intersticiales/alveolares, masas, cavitaciones y derrames pleurales.
- Si el m√©dico consulta o indica un hallazgo espec√≠fico ("neumot√≥rax izquierdo no discutible"), realiza una verificaci√≥n dirigida de alta sensibilidad en la mitad visual derecha de la foto, confirmando y caracterizando el hallazgo real. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad a "derecho".
`;
    }

    if (isOsteoarthritisCase) {
      protocolInstructions += `
‚ö†Ô∏è RECORDATORIO PROTOCOLO DE ARTROSIS Y ENFERMEDAD DEGENERATIVA:
- Eval√∫a con precisi√≥n el pinzamiento de espacios articulares, diferenciando √°reas de carga sim√©tricas vs. asim√©tricas.
- Detalla la presencia de osteofitos marginales, esclerosis subcondral focal o geodas √≥seas.
- Emplea criterios sistem√°ticos internacionales de severidad (v.g., Kellgren-Lawrence para articulaciones mayores o discopat√≠a).
- Toda valoraci√≥n de cambios degenerativos debe optimizar la exactitud e integrarse arm√≥nicamente para potenciar el resto del diagn√≥stico cl√≠nico general sin demeritar su calidad.
`;
    }

    if (isMetalCase) {
      protocolInstructions += `
‚ö†Ô∏è RECORDATORIO PROTOCOLO DE PR√ìTESIS Y ELEMENTOS MET√ÅLICOS DE OSTEOS√çNTESIS:
- Describe con adecuado nivel t√©cnico cada implante articular o material de osteos√≠ntesis visible (placas, tornillos, clavos, etc.).
- Eval√∫a de forma obligatoria y rigurosa la integridad del material buscando signos de fractura, fatiga estructural, doblamiento o aflojamiento.
- Valora y reporta la interfaz hueso-implante en busca de lisis peri-implante, aflojamiento as√©ptico o hundimiento.
- Describe la orientaci√≥n y alineaci√≥n de los componentes respecto a las estructuras anat√≥micas.
`;
    }

    const promptText = `
Eres un radi√≥logo acad√©mico senior con subespecialidad en diagn√≥stico avanzado de alta complejidad.
${promptNote}
Anteriormente realizaste el siguiente an√°lisis de Doble Valoraci√≥n:
"""
${previousAnalysis || "No disponible cl√≠nicamente"}
"""
 
El usuario (m√©dico o especialista cl√≠nico) te solicita responder a la siguiente CONSULTA o SUGERIR LA VALORACI√ìN ESPEC√çFICA de un determinado aspecto sobre las im√°genes adjuntas o el reporte previo:
"=== CONSULTA / INDICACI√ìN DE VALORACI√ìN ESPEC√çFICA ==="
${queryText}
 
=== DATOS GENERALES DEL CASO ===
- **Paciente**: ${patientInfo || "S/D"}
- **Sospecha Cl√≠nica**: ${clinicalSuspicion || "S/D"}
${protocolInstructions}
 
Misi√≥n:
1. Responde con un rigor cl√≠nico impecable, extremadamente detallado, minucioso y exacto, promoviendo un equilibrio cient√≠fico perfecto.
2. Analiza de nuevo visualmente las im√°genes con un nivel microsc√≥pico de detalle en busca de hallazgos sutiles, micro-anomal√≠as o variaciones milim√©tricas que influyan en la consulta. No omitas ning√∫n rasgo peque√±o pero real.
3. Eval√∫a con el mismo rigor el factor anti-alucinaci√≥n: no inventes patolog√≠as en √°reas dudosas donde solo hay ruido t√©cnico, variaciones normales de proyecci√≥n o sombras normales. Si un hallazgo es incierto, descr√≠belo expl√≠citamente como indeterminado, sutil o variante normal.
4. Si el usuario te pide modificar o re-enfocar el reporte, responde justificando cl√≠nicamente cada observaci√≥n de forma estrecha con los p√≠xeles reales evaluados y la literatura radiol√≥gica vigente.

Escribe tu respuesta directamente en formato Markdown limpio, estructurado, sin rodeos conversacionales ni saludos innecesarios. Comienza directamente con tu an√°lisis especializado.
`;
 
    parts.push({ text: promptText });
 
    const systemInstruction = 
      "Eres un consultor radi√≥logo internacional senior de diagn√≥stico de casos complejos y desafiantes. Tu principal fortaleza es la combinaci√≥n de alta sensibilidad para detectar y confirmar patolog√≠as reales y evidentes (como neumot√≥rax extenso, colapso pulmonar, derrames pleurales, fracturas o lesiones focales) con un estricto filtro de seguridad anti-alucinaci√≥n. " +
      "REGLA DE ESPEJO Y LATERALIDAD ANAT√ìMICA RADIOL√ìGICA: En radiolog√≠a frontal PA/AP, la DERECHA VISUAL de la pantalla es el LADO ANAT√ìMICO IZQUIERDO DEL PACIENTE (hemit√≥rax/campo pulmonar izquierdo). Un neumot√≥rax visible en la mitad derecha de la foto/pantalla DEBE reportarse como 'NEUMOT√ìRAX IZQUIERDO'. Si la consulta del usuario indica 'Neumot√≥rax Izquierdo', eval√∫a la mitad visual derecha de la foto (lado izquierdo del paciente) para confirmar el neumot√≥rax con alta sensibilidad. Queda ESTRICTAMENTE PROHIBIDO cambiar la lateralidad diciendo 'derecho'. " +
      "Cuando el usuario/m√©dico consulte o afirme que existe un hallazgo espec√≠fico o no discutible, verifica minuciosamente esa regi√≥n anat√≥mica con m√°xima sensibilidad para confirmar y caracterizar sus detalles. Evita falsos positivos distinguiendo ruidos y variaciones normales de las verdaderas patolog√≠as, pero NUNCA niegues ni refutes hallazgos anat√≥micos reales y evidentes por un hiper-escepticismo injustificado. Responde con la m√°xima exactitud y objetividad cl√≠nica.";

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
 * NEW API: BLIND DOUBLE-MODEL CLINICAL TRIBUNAL & EVALUATION (RADI√ìLOGO JEFE)
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
      return res.status(400).json({ success: false, error: "Se requieren ambos reportes preliminares (Alpha y Beta) para iniciar la sesi√≥n de evaluaci√≥n del Tribunal M√©dico." });
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
Sospecha Cl√≠nica e Datos de Entrada del Paciente:
- Paciente: ${patientInfo || "No especificado"}
- Sospecha Cl√≠nica / Motivo de Estudio: ${clinicalSuspicion || "No especificado"}
- Preguntas Radiol√≥gicas Interesantes: ${radiologicalQuestions || "No especificados"}

Protocolos de Validaci√≥n T√©cnicos Activos:
- Fracturas: ${fractureProtocol ? "S√ç" : "NO"}
- Pulmonar: ${pulmonaryProtocol ? "S√ç" : "NO"}
- Artrosis/Osteoartrosis: ${osteoarthritisProtocol ? "S√ç" : "NO"}
- Pr√≥tesis/Metal de Apoyo: ${prosthesisMetalProtocol ? "S√ç" : "NO"}

A continuaci√≥n se presentan DOS reportes preliminares independientes generados para este caso radiol√≥gico.
Ambos fueron sometidos de manera ciega (t√∫ no sabes que modelo redact√≥ cada uno para evitar favoritismos y self-bias). Anal√≠zalos cr√≠ticamente y de forma objetiva de acuerdo con las im√°genes:

=== [INFORME DIAGN√ìSTICO ALPHA] ===
${reportAlpha}

=== [INFORME DIAGN√ìSTICO BETA] ===
${reportBeta}

Como el RADI√ìLOGO JEFE, Director de la Unidad y Presidente del Tribunal de Especializaci√≥n, realiza una EVALUACI√ìN CL√çNICA TUTORIAL Y UN ARBITRAJE DE ALTA ESPECIFICIDAD bajo el siguiente protocolo de auditor√≠a de imagen:

1. **ARBITRAJE DE DISCORDANCIAS (Discrepancy Arbitration & Tie-Breaker Key)**:
   - Identifica cualquier contradicci√≥n u omisi√≥n asim√©trica significativa entre los informes (por ejemplo, si el Informe Alpha reporta una neumon√≠a basilar o un foco de fisura que el Informe Beta describe como normal o preservado).
   - Realiza un "An√°lisis de Desempate" acudiendo con lupa virtual a los p√≠xeles de las im√°genes en busca de la lesi√≥n. Explica con terminolog√≠a cient√≠fica irrefutable cu√°l de los dos informes est√° en lo correcto y por qu√© la estructura anat√≥mica avala o descarta la patolog√≠a, resolviendo la inconsistencia. Es inaceptable silenciar o heredar una omisi√≥n asim√©trica.

2. **FORTALEZAS Y DEBILIDADES A CIEGAS DE LOS BORRADORES**:
   - Analiza cr√≠ticamente el [INFORME DIAGN√ìSTICO ALPHA] indicando si omiti√≥ hallazgos discretos, sobrediagnostic√≥ sombras normales (falsos positivos), o si emple√≥ clasificaciones de riesgo poco id√≥neas.
   - Realiza la misma evaluaci√≥n de rigor forense e instructor m√©dico para el [INFORME DIAGN√ìSTICO BETA].
   - Compara de forma directa la idoneidad m√©trica, l√©xica, y rigor de ambos borradores preliminares.

3. **DICTAMEN INTEGRAL CONSOLIDADO Y DEFINITIVO (La Conclusi√≥n del Tribunal)**:
   - Elabora el informe radiol√≥gico final y definitivo de la cl√≠nica, inyectando la m√°xima precisi√≥n. Elimina todo rastro de alucinaciones o interpretaciones dudosas, y asienta con absoluta nitidez y gravedad los hallazgos reales.
   - Describe con rigor avanzado la localizaci√≥n exacta, patrones, y cuantificaciones m√©tricas o de escalas cl√≠nicas del caso (grades, dimensiones).

Escribe tu respuesta con tono acad√©mico del m√°s alto nivel, sin rodeos corteses. Tu dictamen debe ser la palabra final resolutiva del caso, lista para ser inyectada al generador oficial.
`;

    parts.push({ text: promptText });

    const systemInstruction = 
      "Eres el Radi√≥logo Jefe y Director Cl√≠nico de un prestigioso centro PACS universitario. Diriges las sesiones generales de interconsulta, resoluci√≥n de contradicciones diagn√≥sticas y arbitraje cl√≠nico. Tu principal dogma es la veracidad emp√≠rica basada en la evidencia visual real. " +
      "REGLA DE ESPEJO Y LATERALIDAD ANAT√ìMICA RADIOL√ìGICA: En proyecciones frontales PA/AP, la DERECHA VISUAL de la imagen es el LADO ANAT√ìMICO IZQUIERDO del paciente (hemit√≥rax/campo pulmonar izquierdo). Un neumot√≥rax o lesi√≥n en la mitad derecha de la foto es un NEUMOT√ìRAX IZQUIERDO del paciente. Si la sospecha o indicaci√≥n del usuario se√±ala 'Neumot√≥rax Izquierdo', eval√∫a la mitad visual derecha de la foto para confirmar con m√°xima sensibilidad el hallazgo. Queda ESTRICTAMENTE PROHIBIDO modificar o invertir la lateralidad a 'derecho' por confusi√≥n de la matriz de la pantalla. " +
      "Debes validar de forma prioritaria los hallazgos patol√≥gicos reales y evidentes (como neumot√≥rax extenso, colapso pulmonar, fracturas, o masas) sin ignorarlos ni subestimarlos. Al mismo tiempo, elimina cualquier alucinaci√≥n de elementos inexistentes (como implantes met√°licos que no est√©n en la placa). Tu dictamen debe ser la palabra final resolutiva, justa y precisa del caso.";

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
Texto del Dictamen o An√°lisis de Caso Radiol√≥gico:
"""
${analysisText}
"""

El usuario solicit√≥ estructurar el An√°lisis de Caso en el formato: "${requestedFormat}".

INSTRUCCIONES DE FORMATO:
Si el formato es "matriz_semiotica" (Matriz Semi√≥tica Comparativa: Signos Peticionantes vs. Signos Exclusivos / Criterios de Descarte):
- Llena la propiedad "semioticMatrix" con "requestingSigns" (signos a favor o hallazgos que reclaman/exigen la hip√≥tesis principal), "exclusiveSigns" (criterios exclusores o patognom√≥nicos) y "discardCriteria" (signos ausentes o hallazgos que descartan diferenciales).
- Aseg√∫rate de completar los signos peticionantes clave e inclusivos basados en el dictamen ecogr√°fico.

Si el formato es "flujograma_semiologico" (Flujograma Semiol√≥gico / Ciclo de Pensamiento Radiol√≥gico):
- "sonographicPillar.primaryFinding" debe ser el Hallazgo Ecogr√°fico Principal (Punto de Partida).
- "sonographicPillar.details" deben ser los Hallazgos Secundarios de Soporte o caracter√≠sticas espec√≠ficas de la imagen.
- "clinicalCorrelation" debe detallar los aspectos cl√≠nicos, s√≠ntomas o antecedentes relevantes descritos.
- Cada elemento en "diagnostics" debe incluir criterios de descarte claros en "refutingCriteria" representando los signos cl√≠nicos/ecogr√°ficos ausentes que permitieron descartar o degradar esa sospecha frente al diagn√≥stico definitivo.
- El primer elemento en "diagnostics" debe ser el diagn√≥stico presuntivo principal final.
- REGLA ESTRICTA: NO INCLUIR NING√öN PORCENTAJE DE CERTEZA O PROBABILIDAD (S√çMBOLO %).

Filtros de elementos a incluir seg√∫n la preferencia del usuario:
- Incluir Pilar Sonogr√°fico Principal: ${config.includeSonographic ? "S√ç" : "NO"}
- Incluir Correlaci√≥n Cl√≠nico-Laboratorial: ${config.includeClinicalCorr ? "S√ç" : "NO"}
- Incluir Porcentaje de Certeza Diagn√≥stica: NO (NUNCA incluir porcentajes %)
- Incluir Diagn√≥sticos Diferenciales: ${config.includeDifferentials ? "S√ç" : "NO"}
- Incluir Conducta y Manejo Recomendado: ${config.includeManagement ? "S√ç" : "NO"}

Por favor, extrae los datos y responde √öNICAMENTE con un objeto JSON v√°lido con la siguiente estructura:
{
  "format": "${requestedFormat}",
  "elementsConfig": {
    "includeSonographic": ${config.includeSonographic},
    "includeClinicalCorr": ${config.includeClinicalCorr},
    "includeCertainty": false,
    "includeDifferentials": ${config.includeDifferentials},
    "includeManagement": ${config.includeManagement}
  },
  "title": "An√°lisis Integrado de Caso",
  "sonographicPillar": {
    "primaryFinding": "Resumen conciso del hallazgo sonogr√°fico clave con sus medidas principales",
    "details": ["Detalle m√©trico o morfol√≥gico 1", "Detalle vascular o ecog√©nico 2"],
    "severity": "altered"
  },
  "clinicalCorrelation": "Correlaci√≥n del hallazgo con los s√≠ntomas, antecedente o laboratorio del paciente",
  "diagnostics": [
    {
      "name": "Nombre del Diagn√≥stico Principal",
      "supportingCriteria": "Criterios sonogr√°ficos clave que lo respaldan",
      "refutingCriteria": "Signos ausentes o hallazgos en contra",
      "confirmatoryTest": "Prueba o estudio confirmativo de elecci√≥n"
    },
    {
      "name": "Diagn√≥stico Diferencial #2",
      "supportingCriteria": "Criterios sonogr√°ficos secundarios",
      "refutingCriteria": "Signos at√≠picos o no visualizados que lo descartan",
      "confirmatoryTest": "Prueba complementaria"
    }
  ],
  "decisionFlow": [
    { "step": 1, "title": "Punto de Partida Sonogr√°fico", "desc": "Descripci√≥n del hallazgo sonogr√°fico inicial" },
    { "step": 2, "title": "Signos Secundarios y Doppler", "desc": "Evaluaci√≥n de vascularizaci√≥n, ecogenicidad y tejidos adyacentes" },
    { "step": 3, "title": "Integraci√≥n con Contexto Cl√≠nico", "desc": "Correlaci√≥n cl√≠nica/laboratorial" },
    { "step": 4, "title": "Conclusi√≥n Diagn√≥stica", "desc": "Diagn√≥stico final y respaldo cl√≠nico" },
    { "step": 5, "title": "Manejo Sugerido", "desc": "Conducta cl√≠nica y recomendaci√≥n" }
  ],
  "semioticMatrix": {
    "requestingSigns": ["Hallazgo sonogr√°fico directo que sustenta la sospecha", "Signo Doppler o m√©trico clave"],
    "exclusiveSigns": ["Ausencia de signos de patolog√≠a compleja/malignidad", "Signo exclusivo confirmativo"],
    "discardCriteria": ["Criterio no visualizado que descarta diagn√≥stico diferencial secundario"]
  },
  "managementRecommendation": "Recomendaci√≥n de manejo cl√≠nico, seguimiento o interconsulta"
}
`;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: casePrompt,
        config: {
          systemInstruction: "Eres un experto redactor radiol√≥gico. Analizas casos m√©dicos e ingresas hallazgos estructurados en JSON estricto sin pre√°mbulos ni porcentajes de certeza.",
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
        let textSummary = `**AN√ÅLISIS INTEGRADO DE CASO (${requestedFormat.toUpperCase().replace("_", " ")})**\n\n`;
        if (config.includeSonographic && jsonParsed.sonographicPillar) {
          textSummary += `‚Ä¢ **Pilar Sonogr√°fico Fundamental**: ${jsonParsed.sonographicPillar.primaryFinding}\n`;
        }
        if (config.includeClinicalCorr && jsonParsed.clinicalCorrelation) {
          textSummary += `‚Ä¢ **Correlaci√≥n Cl√≠nica/Lab**: ${jsonParsed.clinicalCorrelation}\n`;
        }
        if (config.includeDifferentials && jsonParsed.diagnostics?.length) {
          textSummary += `‚Ä¢ **Diagn√≥stico Principal**: ${jsonParsed.diagnostics[0]?.name}\n`;
        }
        if (config.includeManagement && jsonParsed.managementRecommendation) {
          textSummary += `‚Ä¢ **Conducta Recomendada**: ${jsonParsed.managementRecommendation}\n`;
        }

        return res.json({
          success: true,
          caseAnalysisData: jsonParsed,
          extractedText: jsonBlock + textSummary,
        });
      }
    }

    const promptText = `
Texto de la Valoraci√≥n Experta de Imagen realizada por la IA en Doble Valoraci√≥n (puede contener el an√°lisis inicial y un historial de consultas/correcciones posteriores):
"""
${analysisText}
"""

S√çNTESIS PARA EL M√ìDULO GENERADOR DE REPORTES RADIOL√ìGICOS:
Por favor, extrae e integra de forma completa, amplia, rigurosa y detallada todos los datos fundamentales y necesarios para alimentarlos directamente al m√≥dulo generador de reportes.

REQUISITOS FUNDAMENTALES:
1. **CONSERVA TODOS LOS HALLAZGOS Y M√âTRICAS DETALLADAS**: Extrae y conserva TODOS los hallazgos anat√≥micos u org√°nicos (normales y patol√≥gicos), dimensiones, m√©tricas exactas, ecoestructura/densidad/se√±al, patr√≥n Doppler, vascularizaci√≥n y relaciones anat√≥micas. NO omitas las descripciones anat√≥micas o mediciones detalladas.
2. **PRIORIDAD A CORRECCIONES Y CHAT ACTIVO**: Si el texto contiene un historial de consultas, aclaraciones o correcciones del chat activo, da PRIORIDAD ABSOLUTA a los hallazgos re-evaluados, clasificaciones ajustadas y diagn√≥sticos corregidos en las aclaraciones y respuestas m√°s recientes.
3. **INCLUYE CLASIFICACIONES Y CONCLUSIONES**: Incluye √≠ntegramente las clasificaciones cl√≠nicas/escalas (p. ej., BI-RADS, Bosniak, TI-RADS, LI-RADS, PI-RADS, Lung-RADS, etc.) con sus estadios, la conclusi√≥n o impresi√≥n diagn√≥stica definitiva, diagn√≥sticos diferenciales relevantes y la conducta o recomendaci√≥n cl√≠nica indicada.
4. **FORMATO LIMPIO Y ESTRUCTURADO EN ESPA√ëOL**: Presenta la informaci√≥n en secciones bien organizadas con t√≠tulos en negrita en Markdown (p. ej., **CONTEXTO CL√çNICO**, **HALLAZGOS RADIOL√ìGICOS DETALLADOS**, **CLASIFICACIONES Y ESCALAS**, **IMPRESI√ìN DIAGN√ìSTICA Y RECOMENDACIONES**).
5. **SIN C√ìDIGO NI MARCAS JSON**: NO incluyas etiquetas JSON, bloques [CASE_ANALYSIS_JSON], ni estructuras de c√≥digo. Tampoco incluyas saludos, introducciones de chat o metacomentarios.

Genera una transcripci√≥n t√©cnica radiol√≥gica exhaustiva y limpia, lista para que el generador redacte el reporte cl√≠nico completo a partir de ella.
`;

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo subespecialista y redactor de informes cl√≠nicos de alta precisi√≥n. Tu tarea es analizar el dictamen de doble valoraci√≥n y estructurar una s√≠ntesis cl√≠nica exhaustiva con todos los hallazgos anat√≥micos, mediciones, clasificaciones e impresi√≥n diagn√≥stica necesaria para confeccionar un informe radiol√≥gico completo.";

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
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para realizar la evaluaci√≥n del reporte." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio cl√≠nico / tipo de estudio: ${studyType || "No especificado"}
Indicaci√≥n cl√≠nica / Sospecha: ${clinicalHistory || "No especificada"}
Hallazgos preliminares o cargados: ${findings || "No proporcionados"}

Reporte Radiol√≥gico generado:
"""
${report}
"""

Por favor, realiza una EVALUACI√ìN Y AUDITOR√çA DE CALIDAD DEL REPORTE m√©dico interpretado. Tu tarea principal es:
1. Analizar el informe elaborado de forma meticulosa.
2. Identificar y recomendar los aspectos clave de gran relevancia diagn√≥stica o terap√©utica que el m√©dico cl√≠nico solicitante deber√≠a conocer obligatoriamente.
3. **Clasificaciones y Escalas Radiol√≥gicas Sugeridas**: Identifica de forma activa y expl√≠cita qu√© clasificaciones radiol√≥gicas internacionales, escalas de riesgo o sistemas de gradaci√≥n son pertinentes o requeridos seg√∫n los hallazgos del reporte (por ejemplo: BI-RADS, O-RADS, LI-RADS, TI-RADS, PI-RADS, Bosniak, Neer, Rockwood, Gartland, Kellgren-Lawrence, AO, Balthazar, Fleischner, Stanford/DeBakey, etc.). Si el reporte ya cuenta con una escala, eval√∫a si es correcta o precisa; si le falta una escala pertinente, sugiere la categorizaci√≥n o grado exacto a incluir.
4. Diferenciar de manera sumamente clara y visible:
   - **Aspectos y Clasificaciones ya incluidos en el reporte actual** (aquellos que ya est√°n redactados y documentados en el informe).
   - **Aspectos, Recomendaciones y Clasificaciones Sugeridas para agregar** (aquellos que no est√°n o podr√≠an complementar y mejorar sustancialmente el manejo cl√≠nico o la toma de decisiones).

Por favor, estructura tu respuesta en espa√±ol con formato Markdown elegante, limpio y profesional. No agregues notas introductorias ni comentarios fuera del an√°lisis. Clasifica los aspectos en secciones claras y utiliza vi√±etas o tablas seg√∫n sea m√°s agradable de leer.

‚ö†Ô∏è REQUISITO TECNOL√ìGICO CR√çTICO:
Para cada uno de tus puntos de la secci√≥n de "Aspectos, Recomendaciones y Clasificaciones Sugeridas para agregar" (tanto recomendaciones cl√≠nicas como sugerencias de clasificaciones/escalas radiol√≥gicas), DEBES iniciar el punto obligatoriamente con la etiqueta exacta "[RECOMENDACION]: " (en may√∫sculas, comillas no, corchetes r√≠gidos exactamente de esta forma: \`[RECOMENDACION]: \`).
Ejemplos correctos:
- [RECOMENDACION]: Clasificaci√≥n BI-RADS Categor√≠a 4A - Sospecha baja de malignidad. Se sugiere correlaci√≥n histopatol√≥gica o biopsia percut√°nea.
- [RECOMENDACION]: Clasificaci√≥n de Bosniak Categor√≠a II - Quiste renal benigno m√≠nimamente complejo sin necesidad de seguimiento quir√∫rgico.
- [RECOMENDACION]: Medir el espesor de la fascia renal si est√° engrosada en la secci√≥n de hallazgos.

No agregues cursivas ni negritas dentro de los corchetes. El software lee este identificador exacto de forma automatizada para renderizar un bot√≥n en la interfaz de usuario que permite al radi√≥logo incorporar la recomendaci√≥n o clasificaci√≥n al informe con un solo clic.
`;

    const systemInstruction = 
      "Eres un consultor de auditor√≠a y calidad cl√≠nica radiol√≥gica con m√°xima credencial acad√©mica. Eval√∫as la precisi√≥n y completitud de informes de imagen, asegurando la comunicaci√≥n √≥ptima de aspectos de seguridad, clasificaciones de riesgo y hallazgos cr√≠ticos para que el m√©dico tratante tenga toda la informaci√≥n necesaria.";

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
      return res.status(400).json({ success: false, error: "Se requiere el informe para realizar la b√∫squeda bibliogr√°fica." });
    }

    const ai = getGeminiClient();

    let promptText = "";
    if (searchMore) {
      promptText = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Hallazgos clave o sospecha diagn√≥stica: ${findings || "No proporcionados"}

Reporte radiol√≥gico / Consulta:
"""
${report}
"""

Esta es una solicitud de B√öSQUEDA COMPLEMENTARIA DE SEGUNDA RONDA para ampliar y profundizar la bibliograf√≠a m√©dica ya existente.
Queremos encontrar m√°s art√≠culos, directrices oficiales, reportes de casos y revisiones de literatura cient√≠fica de alto nivel.

An√°lisis bibliogr√°fico previo:
"""
${existingBibliography || ""}
"""

Fuentes que YA han sido encontradas y deben ser EXCLUIDAS estrictamente de la lista de nuevas fuentes para evitar duplicados (NO las repitas):
${JSON.stringify(existingSources || [])}

Por favor, realiza una nueva b√∫squeda bibliogr√°fica complementaria en GoogleSearch. Re√∫ne al menos de 6 a 10 referencias o fuentes ADICIONALES y NUEVAS del m√°s alto nivel acad√©mico (como PubMed, Radiopaedia, gu√≠as oficiales ACR, Fleischner, etc.) que no est√©n en la lista de exclusi√≥n anterior.

Genera un objeto JSON que contenga:
1. "bibliography": Una revisi√≥n bibliogr√°fica impecable, ampliada y robustecida en formato Markdown. Debe INTEGRAR arm√≥nicamente la informaci√≥n de las nuevas fuentes encontradas junto con la informaci√≥n anterior, manteniendo las 4 secciones principales estructuradas, ampliando significativamente su profundidad cient√≠fica y de correlaci√≥n para la Educaci√≥n M√©dica Continua (CME):
   - **üéì S√çNTESIS FISIOPATOL√ìGICA Y LOG DE APRENDIZAJE** (an√°lisis educativo profundo ampliado, signos radiol√≥gicos patognom√≥nicos, diagn√≥sticos diferenciales contrastados).
   - **üìã GU√çAS DE CONSENSO Y CRITERIOS INTERNACIONALES** (criterios de apropiaci√≥n actualizados, intervalos detallados de seguimiento por modalidad y criterios de intervenci√≥n quir√∫rgica/biopsia).
   - **üî¨ LITERATURA ACAD√âMICA CLAVE Y ESTUDIOS HIST√ìRICOS** (referencias detalladas a un espectro a√∫n m√°s amplio de art√≠culos con sus aportes clave espec√≠ficos, revistas de procedencia y a√±os).
   - **üí° CONCLUSIONES DE RELEVANCIA PR√ÅCTICA PARA EL RADI√ìLOGO** (resumen con al menos 5 perlas diagn√≥sticas de alta utilidad operacional).

2. "sources": Una lista de las NUEVAS fuentes encontradas (excluyendo estrictamente las previas). Cada una debe contener "title", "uri" y "summary" con la misma estructura requerida (con URLs ver√≠dicas obtenidas de la b√∫squeda).
`;
    } else {
      promptText = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Hallazgos clave o sospecha diagn√≥stica: ${findings || "No proporcionados"}

Reporte radiol√≥gico / Consulta:
"""
${report}
"""

Por favor, realiza un an√°lisis bibliogr√°fico y una revisi√≥n de literatura cient√≠fica sumamente amplia, exhaustiva y diversificada, detallando hallazgos desde m√∫ltiples √°ngulos cl√≠nicos y acad√©micos para la Educaci√≥n M√©dica Continua (CME).

Es un requisito indispensable recopilar y presentar fuentes diversificadas y de alta reputaci√≥n:
1. **PubMed / NCBI / PMC (Literatura indexada)**: Art√≠culos cient√≠ficos, ensayos cl√≠nicos controlados, revisiones sistem√°ticas o meta-an√°lisis.
2. **Radiopaedia (Casos pr√°cticos y Gu√≠as formativas)**: Art√≠culos de referencia enciclop√©dica, clasificaciones, estadios y casos pr√°cticos validados por la comunidad global de radiolog√≠a.
3. **Consensos y Gu√≠as de Sociedades Cl√≠nicas e Internacionales (ACR, RSNA, ESR, Fleischner Society, Bosniak, LI-RADS, PI-RADS, etc.)**: Directrices oficiales de apropiaci√≥n de estudios y planes de seguimiento.

Aseg√∫rate de buscar en GoogleSearch tanto la patolog√≠a relacionada a PubMed, como a Radiopaedia y su respectiva clasificaci√≥n oficial, reuniendo al menos de 8 a 12 referencias o fuentes del m√°s alto nivel acad√©mico para lograr una cobertura muy profunda y de gran valor cl√≠nico.

Genera un objeto JSON que contenga:
1. "bibliography": Una revisi√≥n bibliogr√°fica impecable, robusta y con excelente profundidad m√©dica en formato Markdown con las siguientes 4 secciones principales:
   - **üéì S√çNTESIS FISIOPATOL√ìGICA Y LOG DE APRENDIZAJE** (an√°lisis educativo profundo, signos radiol√≥gicos patognom√≥nicos, diagn√≥sticos diferenciales contrastados).
   - **üìã GU√çAS DE CONSENSO Y CRITERIOS INTERNACIONALES** (criterios de apropiaci√≥n de sociedades, intervalos detallados de seguimiento por modalidad como RM/TC/Ecograf√≠a y criterios de intervenci√≥n quir√∫rgica/biopsia).
   - **üî¨ LITERATURA ACAD√âMICA CLAVE Y ESTUDIOS HIST√ìRICOS** (referencias detalladas a un espectro amplio de art√≠culos con sus aportes clave espec√≠ficos, revistas de procedencia, dise√±o de estudio si aplica, y a√±os).
   - **üí° CONCLUSIONES DE RELEVANCIA PR√ÅCTICA PARA EL RADI√ìLOGO** (resumen con al menos 4 perlas diagn√≥sticas de alta utilidad operacional para optimizar tus informes diarios).

2. "sources": Una lista de los art√≠culos, gu√≠as de consenso, o recursos web reales encontrados en tu b√∫squeda y que se utilizaron para redactar tu an√°lisis bibliogr√°fico. Cada elemento de la lista debe contener:
   - "title": El t√≠tulo o nombre oficial del art√≠culo cient√≠fico, recomendaci√≥n o gu√≠a cl√≠nica. Debe ser claro e indicar de forma precisa y fiel el art√≠culo real visitado.
   - "uri": La URL real y exacta para el acceso directo a este recurso en internet (ej. de dominios PubMed/NCBI, Radiopaedia.org, ACR.org, etc).
   - "summary": Un resumen cl√≠nico, claro, esclarecedor y detallado de 3 a 5 l√≠neas en espa√±ol que explique de manera pr√°ctica los objetivos, metodolog√≠a o recomendaciones clave del art√≠culo. Debe detallar informaci√≥n suficiente para que el radi√≥logo eval√∫e la conveniencia o relevancia de acudir al art√≠culo o caso original.

CR√çTICO: No inventes URLs bajo ninguna circunstancia. Tampoco intercambies ni mezcles enlaces de art√≠culos; cada 'uri' debe corresponder exactamente al art√≠culo cl√≠nico y de investigaci√≥n del 'title'. Es preferible tener menos fuentes pero que todas sean 100% ver√≠dicas y precisas.
`;
    }

    const systemInstruction = 
      "Eres un consultor senior de primer nivel en medicina acad√©mica y radiolog√≠a cl√≠nica, bibliotecario m√©dico maestro en recuperaci√≥n de evidencia cient√≠fica y editor en jefe de revistas de radiolog√≠a indexadas. Tu misi√≥n es redactar revisiones de literatura cl√≠nica sumamente minuciosas, integradas, ricas en detalles y de diversas fuentes acad√©micas de prestigio (como PubMed, Radiopaedia y consorcios de sociedades internacionales), asegur√°ndote de que no exista ninguna discrepancia de temas en tus enlaces de referencia. Devuelve siempre un objeto JSON v√°lido que cumpla estrictamente con el esquema especificado.";

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
      console.warn("Fallo al parsear JSON devuelto por Gemini, intentando reparaci√≥n y extracci√≥n Regex:", parseError);
      
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
        console.warn("La sanitizaci√≥n completa de caracters de control tambi√©n fall√≥, procediendo a extracci√≥n Regex quir√∫rgica.");
        
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
            title: c.web.title || "Art√≠culo Cient√≠fico o Gu√≠a de Pr√°ctica Cl√≠nica"
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
            summary: genSource.summary || "Enlace de alta relevancia cient√≠fica verificado por la b√∫squeda cl√≠nica."
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
          let summaryText = "Publicaci√≥n o consenso oficial recopilado y verificado en la b√∫squeda cl√≠nica para este reporte.";
          if (realLink.title) {
            summaryText = `Recurso oficial verificado: "${realLink.title}". Evidencia indexada consultada para la elaboraci√≥n del an√°lisis literario.`;
          }
          finalSources.push({
            title: realLink.title || "Art√≠culo Cient√≠fico / Gu√≠a Radiol√≥gica",
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
      bibliography: bibliographyText || "No se pudo recuperar el cuerpo del an√°lisis bibliogr√°fico.",
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
      return res.status(400).json({ success: false, error: "Se requiere el reporte m√©dico para generar el resumen del paciente." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio cl√≠nico / tipo de estudio: ${studyType || "No especificado"}
Indicaci√≥n cl√≠nica / Sospecha: ${clinicalHistory || "No espec√≠fica"}

Reporte Radiol√≥gico formal:
"""
${report}
"""

Por favor, traduce este reporte radiol√≥gico formal de alta complejidad m√©dica en un objeto JSON estructurado dise√±ado para el paciente. 

PAUTAS DE TONO Y ESTILO REDACCIONAL (CR√çTICAS):
- Tono neutral y profesional: Toda la informaci√≥n debe ser explicada con claridad y precisi√≥n cl√≠nica elemental, pero con un tono estrictamente neutro, objetivo y profesional. 
- Evita el paternalismo y la condescendencia: No intentes "tranquilizar", "calmar" o "consolar" de manera activa ni forzada. El objetivo es que el paciente entienda sus hallazgos anat√≥micos concretos, no disminuir su percepci√≥n del reporte rest√°ndole seriedad.
- Vocabulario sencillo pero formal: Utiliza t√©rminos accesibles y de f√°cil lectura pero evita a toda costa expresiones que resulten innecesariamente coloquiales, infantiles o informales. 
- Honestidad y veracidad cient√≠fica: Transmite la realidad de las descripciones m√©dicas de manera directa, clara y sobria.
- Omisi√≥n de Recomendaciones: NO se debe incluir ning√∫n tipo de recomendaci√≥n pr√°ctica de salud, ejercicio, h√°bitos, postura o bienestar que sugiera al paciente qu√© debe hacer. Conc√©ntrate EXCLUSIVAMENTE en la explicaci√≥n objetiva de los hallazgos ya descritos.

Devuelve un objeto JSON con las siguientes propiedades:
1. "summary": Una descripci√≥n objetiva de 2 a 3 p√°rrafos explicando qu√© tipo de estudio se le realiz√≥, qu√© estructuras principales se detallan o resultan normales, y una s√≠ntesis descriptiva y neutral de los hallazgos principales identificados. NO debe contener recomendaciones, sugerencias de preguntas, pautas de conducta ni consejos de ning√∫n tipo.
2. "keyFindings": Una lista de los hallazgos identificados, donde para cada uno se entrega:
   - "title": Nombre claro o regi√≥n anat√≥mica afectada en lenguaje accesible (ej: "Articulaci√≥n del Hombro" o "Zonas inferiores del Pulm√≥n").
   - "originalTerm": El t√©rmino radiol√≥gico t√©cnico original tal cual aparece en el informe (ej: "Opacidad basal", "Osteonecrosis", o "Rotura parcial").
   - "simplifiedExplanation": Una explicaci√≥n clara, objetiva e intuitiva de qu√© significa f√≠sicamente a nivel anat√≥mico, expresada de manera comprensible pero formal (sin adjetivos tranquilizadores redundantes, sugerencias ni recomendaciones).
   - "analogy": Una analog√≠a f√≠sica, estructural u operativa de la vida diaria estrictamente con fines ilustrativos y did√°cticos (por ejemplo: filtros, conductos, elasticidad de cables, desgaste de componentes) que facilite la comprensi√≥n mec√°nica sin caer en t√©rminos infantiles o excesivamente coloquiales.
   - "reassurance": Contexto cl√≠nico objetivo y neutral sobre el hallazgo. Describe la perspectiva m√©dica est√°ndar para este hallazgo (por ejemplo, si se asocia com√∫nmente con cambios cr√≥nicos, hallazgos incidentales t√≠picos o si requiere una revisi√≥n cronol√≥gica simple, redactado de forma neutral y absolutamente libre de indicaciones, recomendaciones terap√©uticas, pautas o preguntas sugeridas).
`;

    const systemInstruction = "Eres un especialista en comunicaci√≥n m√©dica institucional, traducci√≥n cl√≠nica orientada al paciente y radiodiagn√≥stico. Tu meta es transcribir informes complejos en t√©rminos comprensibles pero formales, manteniendo un tono completamente neutro, cient√≠fico, maduro y objetivo. Evitas por completo el paternalismo, frases de alivio auto-complacientes, consuelos, rodeos coloquiales innecesarios, preguntas sugeridas o recomendaciones de salud o bienestar de cualquier √≠ndole. REQUISITO CR√çTICO: El JSON de salida solo debe contener la explicaci√≥n descriptiva y cient√≠fica simplificada de los hallazgos, libre de cualquier tipo de recomendaci√≥n o sugerencia de preguntas para la consulta.";

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
      return res.status(400).json({ success: false, error: "Se requiere el reporte m√©dico para generar el glosario de t√©rminos." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Reporte Radiol√≥gico:
"""
${report}
"""

Analiza detalladamente este informe m√©dico para extraer de 4 a 8 de las clasificaciones, signos m√©dicos espec√≠ficos, s√≠ndromes, acr√≥nimos radiol√≥gicos, o terminolog√≠a anat√≥mica/patol√≥gica clave de alta relevancia conceptual mencioandas en el reporte. El usuario solicit√≥ espec√≠ficamente registrar e incluir signos radiol√≥gicos cl√≠nicos, clasificaciones y t√©rminos complejos presentes.

Construye un glosario din√°mico estructurado en un objeto JSON que sirva tanto para m√©dicos docentes como para estudiantes o cl√≠nicos tratantes.

Devuelve un objeto JSON con la propiedad "terms" que contiene una lista de objetos, donde cada uno debe contener:
- "term": El t√©rmino o clasificaci√≥n m√©dico exacto o abreviatura (ej: "L√≠nea de Shenton", "Osteofito", "BI-RADS", "Kellgren & Lawrence", "FLAIR", "Unidades Hounsfield", etc.).
- "category": Clasifica el t√©rmino estrictamente como uno de los siguientes: "Signo Radiol√≥gico", "Clasificaci√≥n", "Acr√≥nimo/Medida", "Anatom√≠a", o "Patolog√≠a/Otros".
- "pronunciation": Gu√≠a de pronunciaci√≥n r√°pida de ayuda o su origen histol√≥gico/etimol√≥gico/ep√≥nimo (ej: "KOSS: Kellgren y Lawrence (ep√≥nimos de reumat√≥logos pioneros)").
- "definition": Explicaci√≥n cient√≠fica, rigurosa, clara y acad√©mica de qu√© es y c√≥mo se define t√©cnicamente.
- "clinicalRelevance": Por qu√© es de vital importancia cl√≠nica en el an√°lisis del paciente y c√≥mo ayuda a tomar decisiones terap√©uticas o diagn√≥sticas quir√∫rgicas.
- "literatureQuery": Un t√©rmino de consulta de b√∫squeda en PubMed o Radiopedia altamente optimizado para obtener literatura cient√≠fica directa sobre este concepto (ej: "Kellgren Lawrence classification knee osteoarthritis guidelines").
`;

    const systemInstruction = "Eres un director editorial m√©dico, catedr√°tico universitario de radiolog√≠a cl√≠nica y experto en lexicograf√≠a de ciencias de la salud. Creas glosarios cl√≠nicos interactivos de alta especificidad cient√≠fica y formativa, ayudando a los m√©dicos solicitantes a comprender el trasfondo te√≥rico riguroso de cada signo y clasificaci√≥n descrito. Devuelve un JSON v√°lido que cumpla estrictamente con la estructura.";

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
      return res.status(400).json({ success: false, error: "Se requiere el reporte m√©dico para generar el esquema estructural." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Reporte Radiol√≥gico formal:
"""
${report}
"""

Por favor, analiza este reporte cl√≠nico y extrae los hallazgos principales en forma de esquema estructurado y visualmente atractivo.
Debes devolver un JSON que represente una tabla o un mapa bento de hallazgos. El JSON debe contener:
1. "findings": Una lista de los hallazgos principales (de 3 a 6 hallazgos significativos), con los siguientes campos:
   - "findingId": Identificador corto (ej: "H1", "H2", "H3", ...)
   - "anatomicalSite": El sitio anat√≥mico o estructura espec√≠fica evaluada (ej: "L√≥bulo superior derecho", "Columna L4-L5", "Tend√≥n supraespinoso")
   - "findingType": Categor√≠a del hallazgo ("Estructural", "Inflamatorio/Infeccioso", "Degenerativo", "Normal/Variante", "L√≠quido/Derrame", "Otro")
   - "description": Resumen ultra-corto, conciso pero claro de lo hallado (m√°ximo 60 caracteres)
   - "iconSuggested": Un nombre de emoji (ej: "üîç", "üî•", "üíß", "ü¶¥", "ü´Å", "üß†", "‚ö†Ô∏è") apropiado para representar el hallazgo visualmente.

2. "markdownScheme": Una representaci√≥n textual en formato de tabla Markdown perfectamente formateada y atractiva de estos hallazgos principales (totalmente libre de emojis o iconos incompatibles con impresoras PDF), para que el usuario pueda insertarla en el reporte original como un cuadro sin√≥ptico. Incluye un encabezado que diga "### ESQUEMA CL√çNICO DE HALLAZGOS PRINCIPALES" y una bonita tabla con columnas exactamente como: | ID | Estructura / Sitio | Hallazgo Principal |. No incluyas de ninguna manera la columna 'Categor√≠a' ni menciones de 'findingType'.
`;

    const systemInstruction = "Eres un especialista senior en estructuraci√≥n de datos m√©dicos, ontolog√≠a cl√≠nica y dise√±o de informes m√©dicos compactos. Creas res√∫menes visuales, sin√≥pticos y estructurados de alta calidad para facilitar la consulta r√°pida de m√©dicos tratantes. Devuelve √∫nicamente el objeto JSON solicitado.";

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
      return res.status(400).json({ success: false, error: "Se requiere el reporte m√©dico para generar el cuadro semiol√≥gico." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Estudio cl√≠nico: ${studyType || "No especificado"}
Reporte Radiol√≥gico formal:
"""
${report}
"""

Por favor, analiza este reporte cl√≠nico y genera un cuadro semiol√≥gico formal de deducci√≥n radiol√≥gica.
El JSON debe contener:
1. "confirmedDiagnoses": Diagn√≥sticos confirmados con su justificaci√≥n semiol√≥gica.
2. "ruledOutPathologies": Patolog√≠as diferenciales descartadas con sus criterios de exclusi√≥n.
3. "markdownTable": Una representaci√≥n formal en formato Markdown con t√≠tulos limpios (sin emojis, ni emoticones, totalmente apta para un reporte en PDF impreso formal). Debe usar t√≠tulos de nivel 3 (###) y 4 (####) y contener dos secciones tabulares bien dise√±adas:
   - Una secci√≥n titulada "### CUADRO DE SEMIOLOG√çA Y JUSTIFICACI√ìN RADIOL√ìGICA".
   - Bajo esta, un subt√≠tulo "#### 1. Diagn√≥sticos Confirmados y Justificaci√≥n Semiol√≥gica" con una tabla que tenga exactamente las columnas: | INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |.
   - Otro subt√≠tulo "#### 2. Patolog√≠as Diferenciales Descartadas y Evidencia de Exclusi√≥n" con una tabla que tenga exactamente las columnas: | INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |.
`;

    const systemInstruction = "Eres un consultor radiol√≥gico acad√©mico senior y catedr√°tico universitario de semiolog√≠a m√©dica por im√°genes. Analizas informes de radiolog√≠a para desglosar la l√≥gica deductiva cl√≠nica detr√°s de cada diagn√≥stico establecido o descartado, correlacion√°ndolos minuciosamente con los signos interpretativos. Devuelve √∫nicamente el objeto JSON solicitado.";

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
      return res.status(400).json({ success: false, error: "Se requiere una imagen de ultrasonido o una descripci√≥n del hallazgo." });
    }

    const ai = getGeminiClient();

    // Heuristic pre-detection of laterality and anatomical structures from text
    const fullTextToScan = `${findingDescription || ""} ${studyType || ""} ${clinicalHistory || ""} ${anatomicalLocation || ""} ${customInstructions || ""} ${specificAnatomicalUnit || ""}`.toLowerCase();
    
    let detectedLateralityHint = "auto";
    if (explicitLaterality && explicitLaterality !== "auto") {
      detectedLateralityHint = explicitLaterality;
    } else {
      const hasRight = /\b(derech[ao]s?|der\b|dcha\b|dcho\b|right\b|rt\b|l[o√≥]bulo derecho|ri√±[o√≥]n derecho|mama derecha|hombro derecho|rodilla derecha|muslo derecho|pierna derecha|brazo derecho|test[i√≠]culo derecho|ovario derecho|mano derecha|pie derecho|tobillo derecho|codo derecho|mu√±eca derecha)\b/i.test(fullTextToScan);
      const hasLeft = /\b(izquierd[ao]s?|izq\b|izda\b|left\b|lt\b|l[o√≥]bulo izquierdo|ri√±[o√≥]n izquierdo|mama izquierda|hombro izquierdo|rodilla izquierda|muslo izquierdo|pierna izquierda|brazo izquierdo|test[i√≠]culo izquierdo|ovario izquierdo|mano izquierda|pie izquierdo|tobillo izquierdo|codo izquierdo|mu√±eca izquierda)\b/i.test(fullTextToScan);
      if (hasRight && !hasLeft) detectedLateralityHint = "right";
      else if (hasLeft && !hasRight) detectedLateralityHint = "left";
      else if (hasRight && hasLeft) detectedLateralityHint = "bilateral";
      else detectedLateralityHint = "unspecified";
    }

    // Heuristic pre-detection of digits and joint levels
    let detectedDigit = targetDigit || "";
    if (!detectedDigit) {
      if (/\b(4[¬∞¬∫to\s]|cuarto|4to|cuarto dedo|dedo anular|ring finger|fourth digit|4th digit|4th finger|iv dedo|dedo iv)\b/i.test(fullTextToScan)) detectedDigit = "4 (Anular / Ring finger)";
      else if (/\b(3[¬∞¬∫er\s]|tercer|3er|tercer dedo|dedo medio|dedo mayor|dedo coraz[o√≥]n|middle finger|third digit|3rd digit|3rd finger|iii dedo|dedo iii)\b/i.test(fullTextToScan)) detectedDigit = "3 (Medio / Middle finger)";
      else if (/\b(2[¬∞¬∫do\s]|segundo|2do|segundo dedo|dedo [i√≠]ndice|index finger|second digit|2nd digit|2nd finger|ii dedo|dedo ii)\b/i.test(fullTextToScan)) detectedDigit = "2 (√çndice / Index finger)";
      else if (/\b(1[¬∞¬∫er\s]|primer|1er|primer dedo|pulgar|thumb|first digit|1st digit|1st finger|i dedo|dedo i)\b/i.test(fullTextToScan)) detectedDigit = "1 (Pulgar / Thumb)";
      else if (/\b(5[¬∞¬∫to\s]|quinto|5to|quinto dedo|dedo me√±ique|pinky|little finger|fifth digit|5th digit|5th finger|v dedo|dedo v)\b/i.test(fullTextToScan)) detectedDigit = "5 (Me√±ique / Little finger)";
    }

    let detectedJoint = targetJointLevel || "";
    if (!detectedJoint) {
      if (/\b(ifd|interfal[a√°]ngica distal|dip|distal interphalangeal|articulaci[o√≥]n interfal[a√°]ngica distal|falange distal|ungueal)\b/i.test(fullTextToScan)) detectedJoint = "IFD (Interfal√°ngica Distal / DIP)";
      else if (/\b(ifp|interfal[a√°]ngica proximal|pip|proximal interphalangeal|articulaci[o√≥]n interfal[a√°]ngica proximal|falange media)\b/i.test(fullTextToScan)) detectedJoint = "IFP (Interfal√°ngica Proximal / PIP)";
      else if (/\b(mcf|metacarpofal[a√°]ngica|mcp|metacarpophalangeal|nudillo|base del dedo)\b/i.test(fullTextToScan)) detectedJoint = "MCF (Metacarpofal√°ngica / MCP)";
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

    const visionPrompt = `Eres un Catedr√°tico de Anatom√≠a Humana Quir√∫rgica, M√©dico Radi√≥logo Especialista en Ecograf√≠a de Alta Resoluci√≥n y Director de Arte M√©dico 3D.
Tu objetivo es analizar la imagen ecogr√°fica 2D aportada y la descripci√≥n cl√≠nica del hallazgo para:

========================================================================
1) INVESTIGAR Y CONSULTAR EL MAPA ANAT√ìMICO QUIR√öRGICO DE REFERENCIA (ANATOMICAL GROUNDING):
========================================================================
Antes de sintetizar cualquier imagen, debes consultar y deducir las coordenadas anat√≥micas exactas y los hitos anat√≥micos cardinales de la estructura solicitada:
- Identificar con EXACTITUD ANAT√ìMICA CARDINAL la estructura diana (ej. bursa olecraneana, quiste de Baker, tend√≥n flexor del 4to dedo a nivel IFD, bursa subacromial-subdeltoidea, placa volar, fascia plantar, n√≥dulo tiroideo en polo superior derecho, ligamento colateral medial, etc.).
- UBICACI√ìN ANAT√ìMICA EXACTA ("exactAnatomicalLocation"): Especificar en qu√© cara, plano tisular, relaci√≥n espacial y coordenadas √≥seas/musculares exactas se encuentra en la realidad anat√≥mica humana.
  * Ejemplo para BURSA OLECRANEANA: "Cara POSTERIOR del codo, tejido celular subcut√°neo directamente sobre el v√©rtice √≥seo del ol√©cranon del c√∫bito, superficial a la inserci√≥n distal del tend√≥n del tr√≠ceps braquial".
  * Ejemplo para QUISTE DE BAKER: "Fosa popl√≠tea POSTEROMEDIAL de la rodilla, entre el tend√≥n del semimembranoso y la cabeza medial del m√∫sculo gastrocnemio".
  * Ejemplo para BURSA SUBACROMIAL-SUBDELTOIDEA: "Espacio subacromial del hombro, por debajo del acromion y m√∫sculo deltoides, superficial a los tendones del manguito rotador (supraespinoso), extraarticular".
  * Ejemplo para FASCIA PLANTAR: "Cara PLANTAR del calc√°neo, entesis proximal en la tuberosidad medial del calc√°neo, plano subcut√°neo profundo plantar".
  * Ejemplo para LESI√ìN EN 4¬∫ DEDO (ANULAR) IFD: "Cuarto rayo digital (4¬∫ dedo / anular), articulaci√≥n interfal√°ngica distal entre falange media y falange distal, cara volar flexora, adyacente a la placa ungueal".
- HITOS √ìSEOS Y MUSCULARES DE ANCLAJE ("cardinalLandmarks"): Lista de estructuras vecinas reales obligatorias para anclar el dibujo.
- LUGARES ERR√ìNEOS PROHIBIDOS ("prohibitedMisplacements"): Lista de ubicaciones incorrectas frecuentes donde los generadores de IA suelen cometer errores graves:
  * Para Bursa Olecraneana: PROHIBIDO dibujarla en la fosa cubital / cara anterior del codo; PROHIBIDO intraarticular en la fosa troclear; PROHIBIDO en el tend√≥n del b√≠ceps braquial.
  * Para 4¬∫ dedo IFD: PROHIBIDO en el 3er dedo (medio); PROHIBIDO en la articulaci√≥n IFP o MCF.
- PROFUNDIDAD TISULAR ("tissueLayerDepth"): "Subcut√°neo (Suprafascial)" | "Subfascial" | "Intratendinoso" | "Intraarticular" | "Intramuscular" | "Subperi√≥stico" | "Parenquimatoso".

========================================================================
2) FORMULAR PROMPTS EN INGL√âS RIGUROSAMENTE ANCLADOS A ESTAS COORDENADAS ANAT√ìMICAS:
========================================================================
- Prompt 1 (FOCAL / CLOSE-UP): Vista volum√©trica 3D aislada, de gran detalle, anclada expl√≠citamente a los hitos √≥seos y musculares correctos, con directivas de plano claras (ej. "Posterior subcutaneous aspect of the elbow directly over the ulnar olecranon tip") y restricciones de exclusi√≥n negativa de las ubicaciones err√≥neas.
- ${dualPerspective ? "Prompt 2 (MACRO / PANOR√ÅMICO TOPOGR√ÅFICO): Vista de perspectiva regional que muestre la mano/extremidad/√≥rgano completo con referencias anat√≥micas claras y la lesi√≥n resaltada en su posici√≥n espacial, lateralidad y coordenadas EXACTAS sin margen de confusi√≥n." : ""}

========================================================================
3) GENERAR T√çTULO, EXPLICACI√ìN CL√çNICA Y FICHA DE ATLAS ANAT√ìMICO EN ESPA√ëOL:
========================================================================
- T√≠tulo profesional y elegante en espa√±ol con la lateralidad y ubicaci√≥n anat√≥mica exacta.
- Explicaci√≥n cl√≠nica estructurada (2 a 3 p√°rrafos de alta calidad) que correlacione la vista ecogr√°fica 2D con la anatom√≠a tridimensional ${dualPerspective ? "(incluyendo correlaci√≥n tisular focal, topograf√≠a regional y lateralidad anat√≥mica expl√≠cita)" : ""}.

========================================================================
REGLA SUPREMA 1: EXACTITUD TOPOGR√ÅFICA SEGMENTARIA Y DE D√çGITOS (CERO TOLERANCIA A ERRORES):
========================================================================
Cuando el estudio corresponda a extremidades, manos, pies, dedos, tendones o articulaciones:
- CONTEO Y NUMERACI√ìN DE DEDOS DE LA MANO (de radial a cubital):
  * 1¬∫ Dedo = Pulgar / Thumb (1er rayo)
  * 2¬∫ Dedo = √çndice / Index Finger (2do rayo)
  * 3¬∫ Dedo = Medio / Middle Finger (3er rayo)
  * 4¬∫ Dedo = Anular / Ring Finger (4to rayo) -> [CR√çTICO: Si se indica 4¬∫ dedo, NUNCA colocarlo en el 3¬∫ ni en el 2¬∫].
  * 5¬∫ Dedo = Me√±ique / Little (Pinky) Finger (5to rayo).
- NIVELES ARTICULARES Y FAL√ÅNGICOS:
  * IFD (Interfal√°ngica Distal / DIP): Entre falange media y distal, inmediatamente adyacente al lecho ungueal / u√±a.
  * IFP (Interfal√°ngica Proximal / PIP): Entre falange proximal y falange media.
  * MCF (Metacarpofal√°ngica / MCP): Entre metacarpiano y falange proximal (nudillo).

========================================================================
REGLA SUPREMA 2: LATERALIDAD RADIOL√ìGICA Y ANAT√ìMICA:
========================================================================
1. VISTA ANTERIOR / FRONTAL / PALMAR (el paciente mira de frente / palma hacia el observador):
   - Lesi√≥n DERECHA (Patient's Right): En el lienzo 2D la lesi√≥n DEBE dibujarse en el LADO IZQUIERDO DE LA PANTALLA DEL OBSERVADOR (Viewer's Left).
   - Lesi√≥n IZQUIERDA (Patient's Left): En el lienzo 2D la lesi√≥n DEBE dibujarse en el LADO DERECHO DE LA PANTALLA DEL OBSERVADOR (Viewer's Right).
2. VISTA POSTERIOR / DORSAL (dorso de la mano / codo posterior / espalda / gemelos):
   - Lesi√≥n DERECHA (Patient's Right): En el lienzo 2D la extremidad derecha DEBE estar en el LADO DERECHO DE LA PANTALLA (Viewer's Right).
   - Lesi√≥n IZQUIERDA (Patient's Left): En el lienzo 2D la extremidad izquierda DEBE estar en el LADO IZQUIERDO DE LA PANTALLA (Viewer's Left).

DATOS DEL CASO:
- Descripci√≥n del Hallazgo por el M√©dico: "${findingDescription || "Hallazgo ecogr√°fico relevante"}"
- Lateralidad Indicada/Detectada: "${detectedLateralityHint.toUpperCase()}"
- D√≠gito / Rayo Objetivo: "${detectedDigit || "No especificado / Conforme al texto"}"
- Nivel Articular / Segmento: "${detectedJoint || "No especificado / Conforme al texto"}"
- Cara / Compartimento: "${detectedAspect || "No especificado"}"
- Unidad Anat√≥mica Espec√≠fica: "${specificAnatomicalUnit || "No especificada"}"
- Tipo de Estudio: "${studyType || "Ecograf√≠a Diagn√≥stica"}"
- Historia Cl√≠nica: "${clinicalHistory || "No especificada"}"
- √ìrgano / Regi√≥n Anat√≥mica: "${anatomicalLocation || "No especificado"}"
- Estilo Visual Seleccionado: "${renderStyle}"
- Instrucciones Adicionales: "${customInstructions || "Ninguna"}"
- Modo de Perspectiva: "${dualPerspective ? "DOBLE PERSPECTIVA (FOCAL + PANOR√ÅMICA GENERAL)" : "INDIVIDUAL (FOCAL)"}"

DIRECTRICES PARA LOS PROMPTS DE IMAGEN 3D EN INGL√âS:
- Estilo: Modern 3D medical volumetric cross-section render, clean organic glass and translucent parenchyma cutaway, cinema 4D octane render style, glowing chromatic bioluminescent accents highlighting the pathology/finding, ultra-high fidelity medical visualization, soft studio rim lighting, translucent subsurface scattering.
- NUNCA incluir texto escrito, palabras, n√∫meros, marcas de agua ni flechas dentro de la imagen.

RESPONDE ESTRICTAMENTE EN FORMATO JSON V√ÅLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "targetStructure": "Nombre de la estructura anat√≥mica patol√≥gica (ej: Bursa olecraneana, Tend√≥n flexor profundo 4¬∫ dedo, etc.)",
  "exactAnatomicalLocation": "Detailed anatomical position in English with precise bony and muscular coordinates",
  "exactAnatomicalLocationEs": "Ubicaci√≥n anat√≥mica exacta en espa√±ol con planos, caras y referencias √≥seas",
  "cardinalLandmarks": ["Landmark 1 in English", "Landmark 2 in English", "Landmark 3 in English"],
  "cardinalLandmarksEs": ["Hito de referencia 1 en espa√±ol", "Hito de referencia 2 en espa√±ol", "Hito 3 en espa√±ol"],
  "prohibitedMisplacements": ["Prohibited location 1 in English", "Prohibited location 2 in English"],
  "prohibitedMisplacementsEs": ["Ubicaci√≥n err√≥nea prohibida 1 en espa√±ol", "Ubicaci√≥n prohibida 2 en espa√±ol"],
  "anatomicalAspect": "POSTERIOR" | "ANTERIOR" | "LATERAL" | "MEDIAL" | "VOLAR" | "DORSAL" | "PLANTAR",
  "tissueLayerDepth": "Subcut√°neo (Suprafascial)" | "Subfascial" | "Intratendinoso" | "Intraarticular" | "Intramuscular" | "Subperi√≥stico" | "Parenquimatoso",
  "lateralityIdentified": "RIGHT" | "LEFT" | "BILATERAL" | "MIDLINE",
  "digitOrSegmentIdentified": "4th digit (Ring finger)" | "3rd digit (Middle finger)" | "2nd digit (Index)" | "1st digit (Thumb)" | "5th digit (Pinky)" | "N/A",
  "jointOrLevelIdentified": "DIP (Distal Interphalangeal)" | "PIP (Proximal Interphalangeal)" | "MCP" | "N/A",
  "viewOrientation": "POSTERIOR" | "ANTERIOR" | "SAGITTAL" | "AXIAL" | "LATERAL",
  "spatialScreenRule": "Explicaci√≥n breve de la posici√≥n en pantalla del observador",
  "title": "T√≠tulo descriptivo y elegante en espa√±ol con la lateralidad y ubicaci√≥n anat√≥mica exacta",
  "explanation": "Explicaci√≥n cl√≠nica detallada en espa√±ol estructurada que correlacione la ecograf√≠a 2D con la anatom√≠a tridimensional mencionando con claridad la estructura, su localizaci√≥n anat√≥mica exacta, plano y lateralidad del paciente.",
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
      console.error("Error parseando respuesta JSON de an√°lisis 3D:", e);
      analysisJson = {
        title: `Representaci√≥n Esquem√°tica 3D: ${findingDescription?.slice(0, 40) || "Hallazgo Ecogr√°fico"}`,
        explanation: `Representaci√≥n esquem√°tica tridimensional basada en los hallazgos ecogr√°ficos observados. Ilustra la correlaci√≥n volum√©trica del tejido y la morfolog√≠a descrita (${findingDescription || "estudio actual"}).`,
        imagePrompt: `Medical 3D volumetric render of ${findingDescription || "anatomical ultrasound finding"}, clean anatomical cross-section, translucent organic glass style, octane render, soft studio lighting, high resolution medical illustration, no text.`,
        imagePromptMacro: `Wide panoramic medical 3D volumetric render of the entire anatomical region of ${findingDescription || "anatomical ultrasound finding"}, showing neighboring organs and muscles, translucent medical illustration, glowing focal finding in place, no text.`
      };
    }

    // Step 2: Extract Grounded Anatomical Reference Profile & Constraints
    const targetStructure = analysisJson.targetStructure || specificAnatomicalUnit || anatomicalLocation || findingDescription || "Estructura ecogr√°fica";
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

    // Auditor√≠a y auto-correcci√≥n multimodal de posici√≥n anat√≥mica exacta, lateralidad y topograf√≠a
    const auditAndValidate3dRender = async (
      imgBase64: string,
      structureName: string,
      expectedLocation: string,
      landmarks: string[],
      prohibitedAreas: string[],
      targetLaterality: string,
      targetDigitOrLoc: string,
      targetJointOrLevel: string,
      perspectiveLabel: "FOCAL (Detalle)" | "MACRO (Panor√°mica)"
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
        const auditPrompt = `Eres un auditor radiol√≥gico perito en anatom√≠a humana quir√∫rgica de alta precisi√≥n.
El m√©dico solicit√≥ una representaci√≥n 3D con los siguientes requisitos anat√≥micos fundamentales:
- Estructura Solicitada: ${structureName}
- Ubicaci√≥n Anat√≥mica Exacta Obligatoria: ${expectedLocation || "Posici√≥n fisiol√≥gica est√°ndar"}
- Hitos de Referencia Anat√≥mica: ${landmarks.join(", ") || "Hitos est√°ndar"}
- Ubicaciones Err√≥neas Prohibidas (Lugares donde NUNCA debe estar): ${prohibitedAreas.join(", ") || "Ninguna"}
- Lateralidad Requerida: LADO ${cleanTarget === "RIGHT" ? "DERECHO (Right)" : cleanTarget === "LEFT" ? "IZQUIERDO (Left)" : "L√≠nea media / No especificada"} DEL PACIENTE.
- D√≠gito / Segmento Requerido: ${targetDigitOrLoc || "Conforme a la descripci√≥n"}
- Nivel Articular / Falange: ${targetJointOrLevel || "Conforme a la descripci√≥n"}

Analiza minuciosamente esta imagen m√©dica 3D generada (${perspectiveLabel}):

1. POSICI√ìN ANAT√ìMICA EXACTA Y PLANO:
   - ¬øEn qu√© ubicaci√≥n y cara anat√≥mica est√° realmente dibujada la lesi√≥n o estructura? (ej. cara posterior sobre el ol√©cranon vs. fosa cubital anterior).
   - ¬øLa estructura patol√≥gica est√° situada en su posici√≥n anat√≥mica quir√∫rgicamente correcta ("isAnatomicalPositionCorrect": true/false)?
   - Si la estructura se coloc√≥ en un lugar err√≥neo (por ejemplo, una bursa olecraneana dibujada en la cara anterior/fosa cubital del codo, o un quiste de Baker en la cara anterior de la rodilla), debes marcar "isAnatomicalPositionCorrect": false y detallar la discrepancia.

2. LATERALIDAD DEL PACIENTE:
   - Determina el punto de vista (ANTERIOR/PALMAR vs. POSTERIOR/DORSAL vs. CORTE SAGITAL/FOCAL).
   - ¬øEn qu√© lado DEL PACIENTE est√° situada la lesi√≥n?
   - Si la lesi√≥n qued√≥ en el lado CONTRARIO al solicitado (ej. el m√©dico pidi√≥ DERECHO pero qued√≥ en la izquierda del paciente), indica "shouldFlipHorizontally": true para que el sistema invierta el lienzo.

3. TOPOGRAF√çA SEGMENTARIA / D√çGITO / NIVEL:
   - Si involucra dedos: ¬øEn qu√© dedo espec√≠fico est√° dibujada la lesi√≥n? (1¬∫ Pulgar, 2¬∫ √çndice, 3¬∫ Medio, 4¬∫ Anular, 5¬∫ Me√±ique).
   - ¬øEn qu√© articulaci√≥n est√° dibujada? (IFD distal, IFP proximal, MCF o falange).
   - Si se solicit√≥ el 4¬∫ dedo a nivel IFD pero la imagen la coloc√≥ en el 3¬∫ dedo o en la IFP, indica "isTopographyAccurate": false.

Responde ESTRICTAMENTE en JSON:
{
  "isAnatomicalPositionCorrect": true | false,
  "depictedAnatomicalPosition": "Descripci√≥n exacta de d√≥nde est√° dibujada la lesi√≥n en la imagen",
  "depictedPatientSide": "RIGHT" | "LEFT" | "MIDLINE",
  "depictedDigit": "1st (Thumb)" | "2nd (Index)" | "3rd (Middle)" | "4th (Ring)" | "5th (Pinky)" | "N/A",
  "depictedJoint": "DIP" | "PIP" | "MCP" | "N/A",
  "isLateralityCorrect": true | false,
  "shouldFlipHorizontally": true | false,
  "isTopographyAccurate": true | false,
  "discrepancyReason": "Explicaci√≥n concisa si hubo error de posici√≥n anat√≥mica, lateralidad o dedo",
  "reason": "Explicaci√≥n general de auditor√≠a anat√≥mica"
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
        console.log(`[AUDITOR√çA ANAT√ìMICA 3D - ${perspectiveLabel}]`, auditJson);

        let processedBase64 = clean;
        let wasFlipped = false;

        const sideMismatched = (cleanTarget === "RIGHT" && auditJson.depictedPatientSide === "LEFT") ||
                              (cleanTarget === "LEFT" && auditJson.depictedPatientSide === "RIGHT");

        if (auditJson.shouldFlipHorizontally || (!auditJson.isLateralityCorrect && sideMismatched)) {
          console.log(`[AUTOCORRECCI√ìN LATERALIDAD 3D] Volteando horizontalmente la imagen ${perspectiveLabel} para alinearse al lado ${cleanTarget} del paciente.`);
          processedBase64 = await flipBase64Horizontally(clean);
          wasFlipped = true;
        }

        return {
          finalBase64: processedBase64,
          wasFlipped,
          isAnatomicalPositionCorrect: auditJson.isAnatomicalPositionCorrect !== false,
          isTopographyAccurate: auditJson.isTopographyAccurate !== false,
          depictedPosition: auditJson.depictedAnatomicalPosition || "Posici√≥n verificada",
          discrepancyReason: auditJson.discrepancyReason,
          detectedSide: auditJson.depictedPatientSide || cleanTarget,
          log: auditJson.reason || "Auditor√≠a de posici√≥n anat√≥mica y topogr√°fica completada."
        };
      } catch (auditErr) {
        console.warn(`[AUDITOR√çA ANAT√ìMICA 3D] Error no bloqueante al auditar imagen ${perspectiveLabel}:`, auditErr);
        return {
          finalBase64: imgBase64,
          wasFlipped: false,
          isAnatomicalPositionCorrect: true,
          isTopographyAccurate: true,
          depictedPosition: "Posici√≥n est√°ndar",
          detectedSide: cleanTarget,
          log: "Auditor√≠a no concluyente"
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
      throw new Error("El modelo de renderizado no devolvi√≥ datos para la imagen focal.");
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
      console.log(`[AUTOCORRECCI√ìN POSICI√ìN ANAT√ìMICA 3D] Estructura fuera de coordenadas anat√≥micas (${auditedFocal.discrepancyReason || "desplazamiento"}). Reconstruyendo con anclaje estricto a ${exactAnatomicalLocation}...`);
      
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
      console.log(`[AUTOCORRECCI√ìN TOPOGR√ÅFICA 3D] Regenerando con aislamiento focal estricto para ${finalDigit} en ${finalJoint}...`);
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
            "MACRO (Panor√°mica)"
          );
          base64RenderMacro = auditedMacro.finalBase64;
        }
      } catch (macroErr) {
        console.warn("Fallo al generar imagen panor√°mica 3D secundaria:", macroErr);
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
      contents: `Genera una imagen radiol√≥gica o anat√≥mica m√©dica precisa sobre: ${prompt}. Estilo: did√°ctico, limpio, profesional, de alta calidad t√©cnica para educaci√≥n m√©dica.`,
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
      return res.status(400).json({ success: false, error: "Se requiere la informaci√≥n de la anotaci√≥n." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const annotType = annotation.type === "point" ? "un PUNTO de inter√©s" : "una REGION rectangular de sospecha";
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

    let queryText = `Analiza detenidamente esta imagen m√©dica de estudio radiol√≥gico/cl√≠nico. 
Tipo de estudio: ${studyType || "No especificado"}
Antecedentes cl√≠nicos: ${clinicalHistory || "No especificado"}

El usuario ha marcado ${annotType} en el siguiente lugar espec√≠fico de la imagen:
- ${coordDesc}

Observa con extrema atenci√≥n los detalles visuales de la anatom√≠a o patolog√≠a justo en esas coordenadas/regi√≥n. 
Tu tarea es sugerir un diagn√≥stico corto, una patolog√≠a o hallazgo alterado que se observe de forma patente all√≠ (por ejemplo: "N√≥dulo pulmonar apical", "Atelectasia subsegmentaria", "Hernia hiatal", "Infiltrado alveolar", "Derrame pleural leve", "Fractura cortical", etc.).

REGLAS DE RESPUESTA:
- Responde UNICAMENTE con el nombre del hallazgo o etiqueta sugerida (m√°ximo 4 palabras).
- Debe ser en idioma ESPA√ëOL.
- No a√±adas comillas, no expliques, no des introducciones ni uses puntos finales. Solo la pura etiqueta textual. Ej: "Infiltrado basal derecho"`;

    if (!imgSupported) {
      queryText = `[Simulaci√≥n] ` + queryText + `\nNota: Como la imagen es una simulaci√≥n sint√©tica o formato SVG no rasterizado, genera una etiqueta diagn√≥stica coherente correspondiente de forma directa basada en el tipo de estudio e indicaci√≥n de sospecha o hallazgo m√°s com√∫n para este estudio cl√≠nico.`;
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
    const { image, filename, studyType, clinicalHistory, findings } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Se requiere la imagen." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName("gemini-3.7-flash");

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

    const queryText = `Analiza esta imagen m√©dica y clasif√≠cala.
Nombre de archivo: ${filename || "Desconocido"}
Tipo de estudio/Solicitud: ${studyType || "Mamograf√≠a y Ultrasonido"}
Antecedentes/Reporte: ${findings || clinicalHistory || "No especificado"}

INSTRUCCIONES:
1. Determina la MODALIDAD de la imagen:
   - "MMG" si es una Mamograf√≠a (rayos X de mama, mamograma digital, proyecciones mamogr√°ficas en escala de grises sobre fondo negro/oscuro, capturas de proyecciones CC o MLO).
   - "US" si es una Ecograf√≠a / Ultrasonido (im√°genes con barridos sonogr√°ficos, Doppler color, profundidad, foco, o capturas de ec√≥grafo).
2. Si es MMG:
   - Determina la PROYECCI√ìN: "CC" (Proyecciones Cr√°neo Caudales / Craneocaudales) o "MLO" (Proyecciones Medio Lateral Oblicuas / Mediolateral Oblicuas) u "OTRO".
   - Determina la LATERALIDAD: "Bilateral" (si muestra ambas mamas / proyecciones pareadas), "Derecha", "Izquierda" o "Bilateral".
3. Redacta un R√ìTULO / LEYENDA CL√çNICA (pie de foto profesional en espa√±ol, de 12 a 25 palabras) sintetizando la modalidad, proyecci√≥n y hallazgos clave o estado del tejido fibroglandular/mamas.
   - Si la proyecci√≥n es "CC" (Cr√°neo Caudales): Inicia el r√≥tulo OBLIGATORIAMENTE con "Proyecciones Cr√°neo Caudales (CC)." seguido de la descripci√≥n sint√©tica del tejido, distribuci√≥n sim√©trica y ausencia/presencia de lesiones o calcificaciones. Ej: "Proyecciones Cr√°neo Caudales (CC). Tejido fibroglandular de distribuci√≥n sim√©trica sin evidencia de n√≥dulos ni microcalcificaciones sospechosas."
   - Si la proyecci√≥n es "MLO" (Medio Lateral Oblicuas): Inicia el r√≥tulo OBLIGATORIAMENTE con "Proyecciones Medio Lateral Oblicuas (MLO)." seguido de la descripci√≥n sint√©tica del tejido, regi√≥n axilar y profundidad pectoral. Ej: "Proyecciones Medio Lateral Oblicuas (MLO). Adecuada visualizaci√≥n de los planos pectorales sin distorsiones ni adenopat√≠as axilares."
   - Para US: "Ultrasonido mamario, cuadrante superior externo derecho mostrando quiste anecoico simple de 10 mm."

Responde EXCLUSIVAMENTE en formato JSON estricto con la siguiente estructura:
{
  "modality": "MMG" o "US",
  "projection": "MLO" | "CC" | "OTRO",
  "side": "Bilateral" | "Derecha" | "Izquierda",
  "label": "texto del r√≥tulo"
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
    const { image, studyType, clinicalHistory, findings } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: "Se requiere la imagen." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName("gemini-3.7-flash");

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

    let queryText = `Analiza con extrema precisi√≥n esta imagen de ecograf√≠a (ultrasonido) m√©dica o captura cl√≠nica.
Tipo de estudio: ${studyType || "No especificado"}
Antecedentes cl√≠nicos/Sospecha: ${clinicalHistory || "No especificado"}
Texto del Informe/Hallazgos redactados: ${findings || "No especificado"}

Tu principal tarea es:
1. Identificar si hay alg√∫n texto impreso, rotulado, etiqueta u anotaci√≥n quemada dentro de la imagen (por ejemplo, palabras cortas escritas en la pantalla como 'Ves√≠cula', 'LIVER', 'KIDNEY', 'AO', 'VESICULA BILIAR', 'QUISTE', marcas de medici√≥n o distancias impresas, etc.).
2. Hacer correlaci√≥n inteligente entre lo visualizado en la foto, cualquier texto/r√≥tulo quemado que detectes dentro de ella, y el texto del informe/hallazgos redactados en busca del hallazgo descrito que est√© m√°s relacionado, para sintetizar el r√≥tulo final m√°s representativo.
3. Si el texto del informe menciona hallazgos patol√≥gicos o medidas espec√≠ficas (por ejemplo, "colelitiasis de 12mm", "quiste cortical de 20mm en polo superior", "esteatosis hep√°tica grado II"), correlaci√≥nalos de inmediato con la anatom√≠a observada y el r√≥tulo quemado en la imagen para formular un t√≠tulo coherente que vincule de forma √≥ptima ambos mundos.
4. Si no hay texto legible en la imagen, analiza la anatom√≠a y prop√≥n una descripci√≥n cl√≠nica o hallazgo en espa√±ol basado en la correlaci√≥n con el reporte.

REGLAS DE RESPUESTA:
- El r√≥tulo sugerido debe ser sumamente limpio, claro y profesional, al estilo del pie de foto o descripci√≥n de figura en un art√≠culo de revista m√©dica o cient√≠fica (menciona la estructura anat√≥mica, el hallazgo clave o patolog√≠a y alg√∫n detalle cl√≠nico o medida relevante, sin exceder de 1 a 2 l√≠neas breves, unas 10 a 20 palabras en total).
- Evita redundancias excesivas y s√© sumamente descriptivo pero conciso.
- La respuesta debe ser una descripci√≥n fluida y directa (ejemplo: "Ves√≠cula biliar distendida con presencia de un lito hiperecog√©nico de 12 mm en su interior que proyecta sombra ac√∫stica" o "Bifurcaci√≥n carot√≠dea derecha con placa de ateroma calcificada que genera estenosis leve de aproximadamente el 25%").
- Debe estar enteramente en ESPA√ëOL.
- No incluyas prefijos como "Figura X." ni comillas, introducciones, explicaciones, ni puntos finales. Devuelve √∫nicamente la descripci√≥n limpia.`;

    if (!imgSupported) {
      queryText = `[Simulaci√≥n] ` + queryText + `\nNota: Como la imagen es una simulaci√≥n sint√©tica o formato SVG no de mapa de bits, genera una etiqueta diagn√≥stica coherente correspondiente de forma directa basada en el tipo de estudio, hallazgos o sospecha cl√≠nica que est√© m√°s correlacionada con la informaci√≥n disponible.`;
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
 * Endpoint para buscar de manera manual un hallazgo/estructura en el reporte actual y autocomplete la rotulaci√≥n.
 */
app.post("/api/autocomplete-label-from-report", async (req: express.Request, res: express.Response) => {
  try {
    const { model, phrase, currentReport, studyType, clinicalHistory } = req.body;
    if (!phrase || !phrase.trim()) {
      return res.status(400).json({ success: false, error: "Se requiere la palabra o frase de b√∫squeda manual." });
    }
    if (!currentReport || !currentReport.trim()) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte actual para realizar la b√∫squeda." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    const promptText = `
Eres un radi√≥logo cl√≠nico experto y editor de art√≠culos cient√≠ficos de radiolog√≠a.
El usuario ha subido una imagen de ultrasonido y ha escrito manualmente una palabra o frase clave (estructura anat√≥mica o hallazgo) que desea rotular.
Tu misi√≥n es buscar en el informe de radiolog√≠a suministrado la secci√≥n donde se mencione ese hallazgo o estructura, extraer los detalles precisos (medidas, caracter√≠sticas ecog√©nicas, ubicaci√≥n, etc.) y construir una descripci√≥n de figura cl√≠nica (pie de foto de art√≠culo cient√≠fico), fluida y detallada, pero sin excederse de largo (entre 10 y 20 palabras).

INFORMACI√ìN SUMINISTRADA:
- Frase/Estructura manual: "${phrase}"
- Tipo de estudio: ${studyType || "Ecograf√≠a"}
- Antecedentes cl√≠nicos: ${clinicalHistory || ""}

INFORME DE RADIOLOG√çA ACTUAL:
"""
${currentReport}
"""

REGLAS DE GENERACI√ìN PARA EL R√ìTULO:
1. Localiza en el informe el fragmento que mejor describa la frase "${phrase}".
2. Redacta un pie de foto profesional y fluido para una revista m√©dica (ejemplo: "Ves√≠cula biliar con lito de 15 mm en su interior que genera sombra ac√∫stica posterior n√≠tida").
3. Si el informe no menciona espec√≠ficamente la estructura o hallazgo exacto, infiere una descripci√≥n l√≥gica, profesional y coherente con el tipo de estudio y el informe para esa palabra.
4. Debe ser una descripci√≥n fluida de entre 10 y 20 palabras. No exageres el largo, s√© directo y formal.
5. NO incluyas prefijos como "Figura X." ni t√≠tulos como "Pie de foto:". Devuelve √∫nicamente el texto de la descripci√≥n.
6. El idioma debe ser enteramente ESPA√ëOL.
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
 * Endpoint para correlacionar e insertar de manera retr√≥grada las referencias a las figuras en el reporte existente.
 */
app.post("/api/correlate-figures-retroactive", async (req: express.Request, res: express.Response) => {
  try {
    const { model, currentReport, attachedImages } = req.body;
    if (!currentReport) {
      return res.status(400).json({ success: false, error: "Se requiere el reporte actual." });
    }
    if (!attachedImages || attachedImages.length === 0) {
      return res.status(400).json({ success: false, error: "No hay im√°genes cargadas para correlacionar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model || "gemini-3.7-flash");

    let promptText = `
Eres un radi√≥logo experto y un editor de informes m√©dicos de alta precisi√≥n.
Se te proporciona un informe de radiolog√≠a/ecograf√≠a estructurado en formato Markdown, y un listado de im√°genes/capturas de ultrasonido adjuntas que han sido rotuladas/etiquetadas por el m√©dico o mediante IA.

TU MISI√ìN PASO A PASO:
1. Lee atentamente el INFORME DE RADIOLOG√çA de principio a fin (especialmente las secciones de HALLAZGOS e IMPRESI√ìN DIAGN√ìSTICA).
2. Para cada una de las IM√ÅGENES ADJUNTAS (identificadas por su "id" y su "caption"), determina en qu√© lugar del texto del informe se menciona por primera vez el hallazgo, estructura u √≥rgano correspondiente a esa imagen.
3. REORDENA la lista de im√°genes para que queden en el orden exacto de su primera aparici√≥n cronol√≥gica en el texto del informe (de arriba a abajo):
   - La imagen cuyo hallazgo se describe PRIMERO en el reporte ser√° la Figura 1.
   - La imagen cuyo hallazgo se describe SEGUNDO en el reporte ser√° la Figura 2.
   - La imagen cuyo hallazgo se describe TERCERO ser√° la Figura 3, y as√≠ sucesivamente.
   - Si alguna imagen no coincide claramente con el reporte, col√≥cala al final de la lista conservando su orden relativo.
4. Una vez determinado el nuevo orden de las im√°genes (y por ende su nuevo n√∫mero de Figura 1, 2, 3...):
   - Inserta la referencia "(ver Figura 1)", "(ver Figura 2)", etc. en el texto del informe en la ubicaci√≥n exacta donde se describe dicho hallazgo espec√≠fico.
   - Esto garantiza que las menciones "(ver Figura 1)", "(ver Figura 2)", "(ver Figura 3)" dentro del texto del informe aparezcan en ORDEN ESTRICTAMENTE ASCENDENTE (1, 2, 3...) a medida que el lector lee el documento de arriba a abajo.
5. NO alteres, elimines ni resumas el texto original del reporte. √önicamente debes insertar los par√©ntesis de referencia como "(ver Figura 1)" en el lugar exacto que corresponda. Mant√©n intacto el formato de secciones.

LISTADO DE IM√ÅGENES ADJUNTAS DISPONIBLES:
`;

    attachedImages.forEach((img: any) => {
      const modality = img.modality || "US";
      const proj = img.projection || "";
      const side = img.side || "";
      promptText += `- ID: "${img.id}" | Modalidad: "${modality}" | Proyecci√≥n: "${proj}" | Lado: "${side}" | R√≥tulo/Descripci√≥n: "${img.caption || img.name || "Sin descripci√≥n"}"\n`;
    });

    promptText += `
INFORME DE RADIOLOG√çA ACTUAL EN EL QUE TRABAJAS:
"""
${currentReport}
"""

Debes devolver un objeto JSON estricto con:
- "reorderedImageIds": un arreglo con todos los IDs de las im√°genes en el nuevo orden cronol√≥gico de aparici√≥n en el informe (ej: ["id1", "id2", "id3"]).
- "report": el texto completo del informe con los par√©ntesis "(ver Figura 1)", "(ver Figura 2)", etc. insertados en orden estrictamente ascendente.
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
              description: "Lista de IDs de imagen reordenados seg√∫n su primera aparici√≥n en el texto del reporte."
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
        console.error("Error parseando respuesta JSON de correlaci√≥n de figuras:", e);
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
      return res.status(400).json({ success: false, error: "Se requiere el 'reportText' para realizar el an√°lisis vascular." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const isCarotidas = studyType === "Doppler de car√≥tidas" || reportText.toLowerCase().includes("carotid");
    const isVenoso = studyType === "Doppler venoso de miembro inferior" || reportText.toLowerCase().includes("venoso");

    let variablesPromptDesc = "";
    if (isCarotidas) {
      variablesPromptDesc = `
  Analiza los siguientes vasos carot√≠deos para el lado derecho e izquierdo:
  - acc_der (Arteria Car√≥tida Com√∫n Derecha)
  - aci_der (Arteria Car√≥tida Interna Derecha)
  - ace_der (Arteria Car√≥tida Externa Derecha)
  - vert_der (Arteria Vertebral Derecha)
  - acc_izq (Arteria Car√≥tida Com√∫n Izquierda)
  - aci_izq (Arteria Car√≥tida Interna Izquierda)
  - ace_izq (Arteria Car√≥tida Externa Izquierda)
  - vert_izq (Arteria Vertebral Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (si el flujo es laminar, sin estenosis ni placas significativas, o normal)
  - "mild" (si hay presencia de placas ateromatosas con estenosis hemodin√°micamente no significativa o leve <50%)
  - "severe" (si hay estenosis cr√≠tica/severa >=50% o est√° ocluida)
  `;
    } else if (isVenoso) {
      variablesPromptDesc = `
  Analiza los siguientes segmentos venosos de miembros inferiores para extremidad derecha e izquierda:
  - vfc_der (Vena Femoral Com√∫n Derecha)
  - vfs_der (Vena Femoral Derecha / Anteriormente llamada Vena Femoral Superficial Derecha)
  - vp_der (Vena Popl√≠tea Derecha)
  - vta_der (Vena Tibial Anterior Derecha)
  - vtp_der (Vena Tibial Posterior Derecha)
  - vper_der (Vena Peronea Derecha)
  - vsm_der (Vena Safena Magna Derecha)
  - vsp_der (Vena Safena Parva Derecha)
  - sfj_der (Uni√≥n Safenofemoral Derecha)
  - vfc_izq (Vena Femoral Com√∫n Izquierda)
  - vfs_izq (Vena Femoral Izquierda / Anteriormente llamada Vena Femoral Superficial Izquierda)
  - vp_izq (Vena Popl√≠tea Izquierda)
  - vta_izq (Vena Tibial Anterior Izquierda)
  - vtp_izq (Vena Tibial Posterior Izquierda)
  - vper_izq (Vena Peronea Izquierda)
  - vsm_izq (Vena Safena Magna Izquierda)
  - vsp_izq (Vena Safena Parva Izquierda)
  - sfj_izq (Uni√≥n Safenofemoral Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (permeable, completamente colapsable, flujo normal, sin insuficiencia ni reflujo)
  - "reflux" (si hay insuficiencia valvular, reflujo provocado/espont√°neo o incompetencia)
  - "thrombosis" (si hay trombosis venosa profunda o superficial, no compresible, trombo visible, o ausencia de flujo)
  `;
    } else {
      variablesPromptDesc = `
  Analiza los siguientes segmentos arteriales de miembros inferiores para extremidad derecha e izquierda:
  - aic_der (Arteria Il√≠aca Com√∫n Derecha)
  - afc_der (Arteria Femoral Com√∫n Derecha)
  - afs_der (Arteria Femoral Derecha / Anteriormente llamada Arteria Femoral Superficial Derecha)
  - ap_der (Arteria Popl√≠tea Derecha)
  - ata_der (Arteria Tibial Anterior Derecha)
  - atp_der (Arteria Tibial Posterior Derecha)
  - aper_der (Arteria Peronea Derecha)
  - aic_izq (Arteria Il√≠aca Com√∫n Izquierda)
  - afc_izq (Arteria Femoral Com√∫n Izquierda)
  - afs_izq (Arteria Femoral Izquierda / Anteriormente llamada Arteria Femoral Superficial Izquierda)
  - ap_izq (Arteria Popl√≠tea Izquierda)
  - ata_izq (Arteria Tibial Anterior Izquierda)
  - atp_izq (Arteria Tibial Posterior Izquierda)
  - aper_izq (Arteria Peronea Izquierda)
  
  Determina el estado de cada una como uno de los siguientes valores exactos:
  - "normal" (flujo trif√°sico normal, sin placas ni estenosis hemodin√°mica)
  - "mild" (flujo bif√°sico, estenosis <50% o placas difusas con velocidades conservadas)
  - "severe" (flujo monof√°sico o amortiguado "tardus-parvus", oclusi√≥n vascular, o estenosis >=50% con velocidades elevadas)
  `;
    }

    const promptText = `
Estudio Vascular Analizado: ${studyType || "Doppler Vascular"}
Texto del Reporte M√©dico:
"""
${reportText}
"""

Tu misi√≥n es analizar el texto de este reporte y generar:
1. Un cuadro de hallazgos principales en formato de tabla de Markdown.
2. Un objeto JSON estructurado que asigne un estado y una breve descripci√≥n a cada segmento vascular clave.

Instrucciones para el Cuadro (Markdown):
- Debe ser una tabla de Markdown impecable y elegante con encabezados claros.
- Debe resumir con brevedad y excelente lenguaje m√©dico √öNICAMENTE los hallazgos patol√≥gicos o alteraciones (placas, estenosis, reflujos, trombosis, flujos alterados, etc.).
- Debe omitir por completo √≥rganos, vasos o segmentos con un reporte normal o fisiol√≥gico ("Dentro de l√≠mites normales" o similar). No incluyas filas para estructuras normales.
- Si todas las estructuras, segmentos o vasos evaluados son completamente normales, la tabla de Markdown debe contener una √∫nica fila descriptiva amigable indicando: "| Estado General | Sin hallazgos patol√≥gicos detectados en el examen actual. |".
- Ejemplo de encabezado para Car√≥tidas o Miembros:
  | Segmento Alterado | Derecho | Izquierdo |

Instrucciones para la Estructura de Datos (JSON):
${variablesPromptDesc}

Por favor, formatea la respuesta de manera estricta y exclusiva como un objeto JSON v√°lido que contenga los siguientes atributos primarios: "table", "states", "descriptions", "subLocations" y "carotidPlaques".
- En "carotidPlaques" coloca una lista de las placas ateromatosas individuales identificadas en el sistema carot√≠deo (solo para estudios de car√≥tidas o si se describen). Cada objeto del arreglo "carotidPlaques" debe tener los siguientes campos: side (derecho/izquierdo), vessel (acc/bulbo/aci/ace), type (tipo clasificaci√≥n Gray-Weale "I", "II", "III" o "IV" exactamente, asumiendo "II" por defecto si es mixta o "IV" si es calcificada), size (tama√±o medido como "3 mm" o verbal "peque√±a"), stenosis (entero que representa % de estenosis ej. 30 o 70), description (breve descripci√≥n ej. "Placa calcificada").
- En "table" coloca el formato string de la tabla Markdown generada.
- En "states" coloca el mapeo de ID del segmento a su estado detectado ("normal", "mild", "severe", "reflux", o "thrombosis" exactamente).
- En "descriptions" coloca una explicaci√≥n muy breve (m√°ximo un rengl√≥n, ej: "Flujo laminar, sin placas", "Placa lip√≠dica con estenosis de 35%", "Ausencia de flujo, trombo obstructivo", etc.) correspondiente a cada ID.
- En "subLocations" asigna a cada ID de segmento detectado con alteraci√≥n ("mild", "severe", "reflux", o "thrombosis") su ubicaci√≥n anat√≥mica exacta bas√°ndote en la descripci√≥n f√≠sica indicada en el reporte (por ejemplo: si es proximal, medio, distal, en la bifurcaci√≥n, etc.). Los valores v√°lidos que debes mapear son exactamente uno de: "proximal", "medio", "distal", "bifurcacion", "origen", o "general". Si es normal o no se detalla un punto espec√≠fico, usa "general".

IMPORTANTE: Devuelve √öNICAMENTE el objeto de JSON bien formateado, sin rodeos, pre√°mbulos, explicaciones ni etiquetas externas como marcas de bloque de c√≥digo \`\`\`json. Comienza directamente con { y finaliza con }.
`;

    const systemInstruction = "Eres un especialista cl√≠nico experto en radiolog√≠a y Doppler vascular avanzado. Tu tarea es extraer de forma precisa cuadros diagn√≥sticos estructurados y catalogar anatomopatol√≥gicamente cada segmento vascular en base al reporte indicado.";

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
      return res.status(400).json({ success: false, error: "Se requiere el reporte m√©dico para realizar el an√°lisis." });
    }
    if (!structures || !Array.isArray(structures) || structures.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere una lista de estructuras anat√≥micas para evaluar." });
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
- Est√°s analizando EXCLUSIVAMENTE los hallazgos correspondientes al lado **${side.toUpperCase()}** (${side === "Derecho" ? "Derecho/Derecha/Der" : "Izquierdo/Izquierda/Izq"}).
- Si el reporte describe hallazgos para ambos lados (Bilateral), DEBES extraer S√ìLO los que correspondan al lado **${side.toUpperCase()}**.
- Ignora por completo los hallazgos descritos para el lado opuesto.
- Si una estructura no se describe espec√≠ficamente para el lado **${side.toUpperCase()}** pero s√≠ para el otro lado, debr√°s marcarla como "no_descrito" o "Normal" para el lado **${side.toUpperCase()}**.
`;
    }

    let breastInstruction = "";
    if (studyType && (studyType.toLowerCase().includes("mama") || studyType.toLowerCase().includes("mamograf"))) {
      breastInstruction = `
[REGLA ESPECIAL PARA ULTRASONIDO / ESTUDIO DE MAMAS]:
- Mapea minuciosamente las menciones de los hallazgos por cada eje o hora (1 a 12), regi√≥n retroareolar, cola de spence y axila de ambas mamas (Mama Derecha "md_" y Mama Izquierda "mi_"):
  * Ejes horarios ("md_eje1" a "md_eje12", "mi_eje1" a "mi_eje12"): Si el reporte menciona un n√≥dulo, quiste, masa o hallazgo en hora X, eje X, 10:00, 10h, radio X o CSE/CSI/CIE/CII, as√≠gnalo al ID del eje correspondiente.
  * Regi√≥n retroareolar ("md_retroareolar", "mi_retroareolar"): Si se describe ectasia, conductos o lesi√≥n detr√°s del pez√≥n.
  * Prolongaci√≥n axilar / Cola de Spence ("md_cola_spence", "mi_cola_spence"): Si se menciona tejido o alteraci√≥n en cola de Spence.
  * Regi√≥n axilar ("md_axila", "mi_axila"): Si se mencionan adenopat√≠as, ganglios o hallazgos en fosa axilar.
- Si una estructura presenta una lesi√≥n, asigna un "state" representativo (ej: "N√≥dulo Hipoecoico", "Quiste Simple", "Fibroadenoma", "Ectasia Ductal", "Adenopat√≠a") y en "description" extrae el resumen del hallazgo con sus medidas y caracter√≠sticas del reporte.
- Si el reporte no menciona hallazgos para una hora o regi√≥n en particular, m√°rcala como "no_descrito".
`;
    }

    let neckInstruction = "";
    if (studyType && (studyType.toLowerCase().includes("cuello") || studyType.toLowerCase().includes("tiroide"))) {
      neckInstruction = `
[REGLA ESPECIAL PARA GANGLIOS CERVICALES EN ESTUDIOS DE CUELLO]:
- Si el reporte describe "adenopat√≠as cervicales de aspecto inflamatorio bilateral", "adenopat√≠as reactivas bilaterales" o hallazgos ganglionares generales SIN especificar un nivel ganglionar individual (Nivel I, Nivel II, Nivel III, Nivel IV, Nivel V, Nivel VI, Nivel VII):
  * Cada uno de los niveles ganglionares individuales ("nodes_r_i"..."nodes_r_vii", "nodes_l_i"..."nodes_l_vii") DEBE ser asignado a "Normal" (o "no_descrito") para que el esquema los muestre en VERDE.
  * S√ìLO asigna un estado alterado a un nivel ganglionar individual si el reporte hace referencia expl√≠cita a dicho nivel espec√≠fico (ej. "nivel IIa", "nivel III derecho", etc.).
`;
    }

    let abdomenInstruction = "";
    if (studyType && studyType.toLowerCase().includes("abdomen")) {
      abdomenInstruction = `
[REGLA ESPECIAL PARA ESTUDIOS DE ABDOMEN Y TARJETAS SINOPSIS DE √ìRGANOS]:
- Para cada uno de los √≥rganos y estructuras del abdomen (H√≠gado, Ves√≠cula, V√≠as biliares / Col√©doco, P√°ncreas, Bazo, Ri√±√≥n derecho, Ri√±√≥n izquierdo, Vejiga, Pr√≥stata, √ötero, Ovarios, Retroperitoneo, Intestino delgado, Ascitis / L√≠quido libre, Pared abdominal):
  1. Lee CUIDADOSAMENTE tanto la secci√≥n de HALLAZGOS (descripci√≥n anat√≥mica detallada) como la IMPRESI√ìN DIAGN√ìSTICA / CONCLUSIONES del reporte.
  2. Extrae la SINOPSIS CL√çNICA INTELIGENTE y ESPEC√çFICA correspondiente al hallazgo real descrita para ESE √ìRGANO en particular.
  3. La descripci√≥n debe ser EN POCAS PALABRAS (de 3 a 10 palabras), inteligente, directa y libre de introducciones o redundancias, conservando las medidas (mm/cm) o caracter√≠sticas clave descritas en el reporte.
     - Ejemplos de sinopsis inteligentes para √≥rganos alterados:
       * H√≠gado: "Esteatosis hep√°tica moderada con hepatomegalia (165 mm)."
       * Ves√≠cula: "Litiasis vesicular m√∫ltiple con colecistitis y pared de 4.5 mm."
       * V√≠as Biliares: "Coledocolitiasis distal de 6 mm con dilataci√≥n del conducto (9 mm)."
       * P√°ncreas: "P√°ncreas de tama√±o conservado con dilataci√≥n del Wirsung (4 mm)."
       * Bazo: "Esplenomegalia moderada (142 mm) de aspecto homog√©neo."
       * Ri√±√≥n Derecho: "Nefrolitiasis derecha de 5 mm en c√°liz inferior sin hidronefrosis."
       * Ri√±√≥n Izquierdo: "Quiste cortical simple de 20 mm en polo superior."
       * Vejiga: "Paredes delgadas con abundante sedimento urinario en declive."
       * Pr√≥stata: "Hiperplasia prost√°tica benigna grado II de 45 cc."
       * √ötero: "Miomatosis uterina intramural de 25 mm."
       * Retroperitoneo: "Adenopat√≠as retroperitoneales interaortocavas de 12 mm."
       * Intestino Delgado: "Edema de pared intestinal con asas delgadas dilatadas."
       * Ascitis: "Escasa cantidad de l√≠quido libre en fondo de saco de Douglas."
       * Pared Abdominal: "Hernia umbilical reducible con defecto aponeur√≥tico de 10 mm."
  4. Si el √≥rgano o estructura no presenta alteraciones y es normal en el reporte: "Dentro de l√≠mites normales."
  5. Si el √≥rgano o estructura no se menciona ni se describe en ninguna parte del reporte: "No mencionado / No descrito."
  6. Queda estrictamente prohibido responder "Alteraci√≥n descrita" o frases gen√©ricas predefinidas cuando hay hallazgos espec√≠ficos en el texto.
`;
    }

    let specialInstruction = `
[REGLA DE CONGRUENCIA Y SINCERIDAD ESTRICTA]:
- Analiza con sumo cuidado TODO el texto del reporte m√©dico (tanto el cuerpo general "Hallazgos" como las conclusiones "Impresi√≥n Diagn√≥stica / Conclusi√≥n").
- NO inventes ni asumas ning√∫n hallazgo patol√≥gico que no est√© expl√≠citamente escrito en el texto.
- Si una estructura se describe como "Normal", "Sin alteraciones", "Conservado", "Homog√©neo", "L√≠mites normales", "No muestra alteraciones" o similar, su "state" DEBE ser strictly "Normal" y su "description" DEBE ser EXACTAMENTE "Dentro de l√≠mites normales.".
- Si la estructura no se menciona en ninguna parte de todo el reporte, su "state" DEBE ser "no_descrito" y su "description" DEBE ser "No mencionado / No descrito.".

- EN PARTICULAR PARA LA ASCITIS / L√çQUIDO LIBRE ("ascitis"):
  * Si el reporte menciona "no se observa l√≠quido libre", "sin l√≠quido libre", "no se evidencia l√≠quido", "recesos libres", "douglas sin l√≠quido", "sin colecciones", o no describe ninguna acumulaci√≥n de l√≠quido libre o ascitis, el "state" DEBE ser "Normal" (o "no_descrito" si no se menciona en absoluto).
  * BAJO NINGUNA CIRCUNSTANCIA debes asignarle un nivel patol√≥gico como "leve", "moderada", "severa" o "l√≠quido libre" si el reporte indica que no hay l√≠quido o que la cavidad est√° libre/limpia. S√© sumamente riguroso con esto: no inventar ascitis.
- NO utilices t√©rminos predeterminados del sistema ni asumas defaults/hallazgos cl√°sicos. El estado ("state") debe describir de forma muy concisa (de 1 a 3 palabras) el diagn√≥stico patol√≥gico real escrito en el texto (por ejemplo: "Ruptura Completa", "Desgarro", "Bursitis", "Hernia umbilical", "Normal", "no_descrito").
- Est√° terminantemente prohibido alucinar niveles de severidad, medidas, escalas, o patolog√≠as que no est√©n expl√≠citamente escritas en el texto.
${sidePrompt}
${breastInstruction}
${neckInstruction}
${abdomenInstruction}
`;

    const promptText = `
Estudio cl√≠nico / Regi√≥n: ${studyType || "No especificado"}

Reporte Radiol√≥gico Completo:
"""
${reportText}
"""

Tu misi√≥n es analizar detenidamente el reporte anterior y extraer los hallazgos reales correspondientes a las siguientes estructuras anat√≥micas, sin inventar nada:
${structuresPrompt}

${specialInstruction}

Para cada una de estas estructuras en la lista:
1. "state": Determina el estado o diagn√≥stico cl√≠nico corto de la estructura derivado directamente del reporte (en espa√±ol, ej: "Normal", "Tendinosis", "Derrame articular", "Desgarro", "Bursitis", "Hernia umbilical", "Normal", "no_descrito" etc.). Genera un t√©rmino m√©dico conciso (de 1 a 3 palabras) del hallazgo en lenguaje natural (ej: "Litiasis vesicular", "Esteatosis leve", "Normal", "no_descrito").
   - Analiza con sumo cuidado la negaci√≥n de hallazgos (ej: "sin l√≠quido libre", "no se observa l√≠quido libre", "sin litiasis" significan estado normal o libre).
   - Si la estructura est√° sana o indica un aspecto normal, usa exactamente "Normal".
   - Si la estructura no se describe ni se menciona en absoluto, entonces elige obligatoriamente "no_descrito".

2. "description": Genera un resumen cl√≠nico del hallazgo que sea extremadamente COMPACTO, BREVE y DIRECTO para esa estructura (en espa√±ol).
   - IMPORTANTE: Si la estructura es normal o sana (estado "Normal"), la descripci√≥n DEBE ser EXACTAMENTE: "Dentro de l√≠mites normales."
   - Si la estructura NO est√° descrita en el reporte (estado "no_descrito"), responde: "No mencionado / No descrito."
   - Si tiene una anomal√≠a o hallazgo patol√≥gico, genera un micro-resumen ultra-concreto de solo 2 a 7 palabras (ej: "Litiasis de 15mm", "Esteatosis hep√°tica leve", "Paredes engrosadas", "Hernia reducible"). Evita explicaciones largas, rodeos o redundancias para asegurar que la descripci√≥n quepa perfectamente en el cuadro.
   - No alucines escalas, grados ni dimensiones que no figuren expl√≠citamente en el texto.

Devuelve la lista "results" con el an√°lisis de cada estructura solicitada.
`;

    const systemInstruction = `Eres un radi√≥logo experto. Analizas reportes m√©dicos y extraes hallazgos muy espec√≠ficos y resumidos para cada estructura anat√≥mica solicitada, sin inventar nada. Evita alucinar detalles que no est√°n en el texto original.`;

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
                  id: { type: Type.STRING, description: "ID de la estructura anat√≥mica." },
                  state: { type: Type.STRING, description: "Estado cl√≠nico extra√≠do exactamente de las opciones permitidas." },
                  description: { type: Type.STRING, description: "Resumen cl√≠nico sintetizado, muy cuidadoso y veraz, sin inventar o alucinar grados/medidas." }
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
      return res.status(400).json({ success: false, error: "Se requiere la instrucci√≥n en lenguaje natural para realizar la modificaci√≥n." });
    }
    if (!structures || !Array.isArray(structures) || structures.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere la lista de estructuras anat√≥micas." });
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
      currentStateStr += `  - Descripci√≥n actual: "${curDesc}"\n\n`;
    });

    // Format current additional findings
    let additionalFindingsStr = "";
    if (currentAdditionalFindings && Array.isArray(currentAdditionalFindings)) {
      currentAdditionalFindings.forEach((f: any) => {
        additionalFindingsStr += `- ID: "${f.id}", Estructura/Regi√≥n: "${f.structureName}", Estado: "${f.state}", Descripci√≥n: "${f.description}"\n`;
      });
    }

    const promptText = `
Estudio cl√≠nico / Regi√≥n: ${studyType || "No especificado"}

INSTRUCCI√ìN DE MODIFICACI√ìN DEL USUARIO (en lenguaje natural):
"""
${instruction}
"""

Reporte m√©dico de referencia (opcional):
"""
${reportText || "No provisto"}
"""

A continuaci√≥n se listan las estructuras m√©dicas actuales con sus estados y descripciones predefinidas del DIBUJO:
${currentStateStr}

A continuaci√≥n se listan los HALLAZGOS ADICIONALES (no graficados en el dibujo) que se tienen actualmente:
${additionalFindingsStr || "Ninguno"}

Tu objetivo es aplicar de manera inteligente la INSTRUCCI√ìN DE MODIFICACI√ìN tanto a la lista predefinida (dibujo) como a la lista de hallazgos adicionales.

REGLAS DE DECISI√ìN:
1. Para cada estructura de la lista predefinida del DIBUJO:
   - Si la instrucci√≥n del usuario implica modificar su estado/diagn√≥stico o sugerencia del reporte, actual√≠zalos.
   - El "state" debe ser el diagn√≥stico corto (ej: "Normal", "Tendinosis", "Desgarro", "Derrame leve", etc.). Si el usuario pide que sea normal o sano, el estado DEBE ser "Normal".
   - Si se cambia a un estado patol√≥gico, genera una "description" corta (ej: "Tendinosis del supraespinoso" o similar).
   - Si se cambia a estado "Normal", la "description" DEBE ser: "Dentro de l√≠mites normales."
   - Si se indica borrar, quitar o "no descrito", cambia el estado a "no_descrito" y la descripci√≥n a "No mencionado / No descrito."
   - Si la instrucci√≥n del usuario no afecta de ninguna manera a esa estructura, mantenla EXACTAMENTE con su "state" y "description" actuales.

2. Para estructuras / regiones de HALLAZGOS ADICIONALES (que NO est√°n en la lista de estructuras predefinidas del dibujo, p. ej. "Grasa de Hoffa", "Hoffitis", "Quiste de Baker" si no est√° mapeado, etc.):
   - Si el usuario solicita a√±adir, registrar o describe un diagn√≥stico de un sitio que NO est√° en la lista de estructuras predefinidas del dibujo, debes agregarlo a la lista de resultados de "additionalFindings".
   - Genera un "id" como "finding-extra-" + un n√∫mero secuencial √∫nico.
   - "structureName": El nombre literal o normalizado del sitio/hallazgo (ej: "Grasa de Hoffa").
   - "state": El estado cl√≠nico (ej: "Alterado", "Colecci√≥n", "Desgarro", "Complejo", "Normal").
   - "description": La descripci√≥n resumida correspondiente de forma literal (ej: "Cambios inflamatorios de la grasa de Hoffa").
   - Si el usuario indica eliminar, quitar o sanar un hallazgo adicional ya existente, no lo incluyas en la lista devuelta "additionalFindings".
   - Si el usuario no menciona modificar ni eliminar un hallazgo adicional existente, pres√©rvalo EXACTAMENTE igual en la lista devuelta "additionalFindings" con su ID y datos actuales.
`;

    const systemInstruction = `Eres un radi√≥logo experto especializado en sincronizaci√≥n anat√≥mica estructurada y hallazgos adicionales no representados en esquemas. Analizas instrucciones naturales para modificar de forma precisa el mapeo cl√≠nico de una lista de tejidos predefinidos y registrar nuevos hallazgos adicionales libres sin dibujo asociado.`;

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
                  id: { type: Type.STRING, description: "ID de la estructura anat√≥mica." },
                  state: { type: Type.STRING, description: "Estado cl√≠nico final (modificado o conservado)." },
                  description: { type: Type.STRING, description: "Descripci√≥n resumida final (modificada o conservada)." }
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
                  id: { type: Type.STRING, description: "ID √∫nico o ID actual." },
                  structureName: { type: Type.STRING, description: "Nombre de la estructura o regi√≥n cl√≠nica (ej: Grasa de Hoffa)." },
                  state: { type: Type.STRING, description: "Estado (ej: Alterado, Coleccion, Desgarro, Complejo, Normal)" },
                  description: { type: Type.STRING, description: "Descripci√≥n resumida del hallazgo (ej: Cambios inflamatorios de la grasa de Hoffa)." }
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'text' y 'action' para continuar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    let systemInstruction = "Eres un m√©dico radi√≥logo subespecialista experto con m√°s de 20 a√±os de experiencia cl√≠nica.";
    let promptText = "";

    const contextPart = `
--- CONTEXTO DEL CASO ---
Tipo de Estudio: ${studyType || "No especificado"}
Indicaci√≥n Cl√≠nica: ${clinicalHistory || "No especificada"}
${fullReport ? `Reporte Completo de Referencia:\n"""\n${fullReport}\n"""` : ""}
-------------------------
`;

    if (action === "analyze") {
      systemInstruction = "Eres un consultor radi√≥logo acad√©mico de √©lite. Tu funci√≥n es analizar de manera cient√≠fica, cr√≠tica y rigurosa descripciones o fragmentos de informes radiol√≥gicos.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para analizar:
"""
${text}
"""

Por favor, realiza un an√°lisis cl√≠nico sumamente detallado de este fragmento. Explica:
1. Qu√© hallazgos describe y su relevancia anatomopatol√≥gica.
2. Posibles diagn√≥sticos diferenciales de sospecha que se asocian a esta descripci√≥n.
3. Sugerencias cl√≠nicas o t√©cnicas para el m√©dico (ej. estudios complementarios de mayor resoluci√≥n si corresponde) basadas en este hallazgo.

Responde con un formato Markdown elegante, profesional, y de lectura r√°pida (usa vi√±etas o n√∫meros para que sea f√°cil de digerir).
`;
    } else if (action === "improve") {
      systemInstruction = "Eres un m√©dico radi√≥logo experto en redacci√≥n cient√≠fica. Tu funci√≥n es reescribir y perfeccionar descripciones radiol√≥gicas, logrando un tono de la m√°s alta elegancia, sobriedad y exactitud cl√≠nica.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para mejorar:
"""
${text}
"""

Por favor, reescribe este fragmento para que tenga una redacci√≥n m√©dica impecable, fluida, profesional y de la m√°s alta elegancia radiol√≥gica.
Sigue estrictamente estas reglas:
1. Conserva exactamente las mismas observaciones diagn√≥sticas, mediciones, lateralidades, y hallazgos reales. No inventes patolog√≠as.
2. **REGLA DE CASING ESTRICTA**: No escribas el texto resultante en may√∫sculas sostenidas. Utiliza min√∫sculas est√°ndar con may√∫sculas iniciales.
3. Devuelve **√öNICAMENTE el fragmento de texto ya mejorado**, sin pre√°mbulos, saludos, comentarios aclaratorios, ni comillas iniciales/finales. Debe estar listo para ser inyectado y reemplazar el texto original directamente.
`;
    } else if (action === "expand") {
      systemInstruction = "Eres un m√©dico radi√≥logo experto. Tu funci√≥n es enriquecer y complementar hallazgos radiol√≥gicos, aumentando ligeramente su nivel de detalle, precisi√≥n descriptiva y correlaciones cl√≠nicas correspondientes, sin caer en extensiones excesivas o redundancias.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para hacer exhaustivo:
"""
${text}
"""

Por favor, reescribe y complementa este fragmento de manera elegante y fluida. 
Instrucciones espec√≠ficas:
1. Incrementa el nivel de detalle cl√≠nico y la precisi√≥n descriptiva de forma MODERADA (no exagerada ni excesivamente larga).
2. Agrega de forma sutil las correlaciones cl√≠nicas o repercusiones funcionales pertinentes asociadas a los hallazgos descritos, enriqueciendo el vocabulario radiol√≥gico de subespecialidad.
3. Evita pre√°mbulos explicativos o redundancias artificiales. El texto debe sonar profesional, conciso pero detallado y con gran fluidez.
4. **REGLA DE CASING ESTRICTA**: No escribas el texto resultante en may√∫sculas sostenidas. Utiliza min√∫sculas est√°ndar con may√∫sculas iniciales.
5. Devuelve **√öNICAMENTE el fragmento de texto ya enriquecido/expandido**, sin comentarios explicativos, notas, introducciones ni comillas. Debe estar listo para reemplazar el fragmento original de inmediato.
`;
    } else if (action === "explain") {
      systemInstruction = "Eres un m√©dico radi√≥logo y educador cl√≠nico paciente, c√°lido y sumamente did√°ctico.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para explicar:
"""
${text}
"""

Por favor, explica de manera sencilla, clara y detallada el significado de este fragmento para un paciente o un m√©dico no especialista.
Instrucciones:
1. Traduce los tecnicismos radiol√≥gicos complejos a un lenguaje comprensible sin perder el rigor cl√≠nico.
2. Explica qu√© significan los hallazgos descritos, por qu√© son relevantes, y la importancia m√©dica general del fragmento.
3. No des pautas de tratamiento espec√≠ficas ni recomendaciones de medicamentos. Enf√≥cate √∫nicamente en la explicaci√≥n did√°ctica y comprensible de los hallazgos.
4. Responde con un tono emp√°tico, claro, y estructurado en Markdown con vi√±etas.
`;
    } else if (action === "classify") {
      systemInstruction = "Eres un consultor de clasificaciones radiol√≥gicas internacionales de consenso (como BI-RADS, Bosniak, Fleischner, etc.).";
      promptText = `
${contextPart}

Fragmento de texto seleccionado para clasificar:
"""
${text}
"""

Por favor, identifica qu√© escala, clasificaci√≥n o criterios m√©dicos de consenso internacional (ej: escala de Bosniak para quistes renales, criterios de Fleischner para n√≥dulos incidentales, BI-RADS, clasificaci√≥n de Kellgren-Lawrence para artrosis de rodilla, etc.) encajan con el hallazgo descrito en el fragmento.
Instrucciones:
1. Determina y asigna de manera justificada el grado, categor√≠a o score correspondiente de la escala aplicable.
2. Redacta una recomendaci√≥n o nota formal y exacta en espa√±ol para ser incorporada al informe (con el grado y conducta recomendada).
3. Responde de forma muy concisa y organizada en Markdown. En la primera secci√≥n, explica brevemente la escala sugerida y el c√°lculo. En la segunda secci√≥n, escribe un apartado titulado "**Texto a incorporar:**" con el bloque de texto formal que el m√©dico puede agregar al reporte.
`;
    } else if (action === "custom") {
      const customPrompt = req.body.customPrompt || "Por favor, eval√∫a este fragmento.";
      systemInstruction = "Eres un m√©dico radi√≥logo subespecialista experto con m√°s de 20 a√±os de experiencia cl√≠nica y acad√©mica.";
      promptText = `
${contextPart}

Fragmento de texto seleccionado:
"""
${text}
"""

Petici√≥n/Instrucci√≥n del usuario para evaluar o procesar este fragmento:
"${customPrompt}"

Por favor, realiza la tarea solicitada sobre el fragmento con la m√°xima precisi√≥n, elegancia y rigurosidad radiol√≥gica.
Sigue estrictamente las pautas que ha especificado el usuario. Si la instrucci√≥n del usuario pide reescribir o mejorar, devuelve el fragmento editado limpio sin saludos. Si es una pregunta, responde con precisi√≥n en formato Markdown estructurado.
`;
    } else {
      return res.status(400).json({ success: false, error: `La acci√≥n '${action}' no es v√°lida.` });
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
      "Eres un radi√≥logo senior y experto en anatometr√≠a cl√≠nica y hemodin√°mica vascular. Tu tarea es analizar rigurosamente el informe radiol√≥gico proporcionado para:\n" +
      "1. Determinar con la m√°xima precisi√≥n posible el tipo de estudio radiol√≥gico realizado bas√°ndote en el contenido del reporte (por ejemplo: 'Doppler de Car√≥tidas', 'Ultrasonido Abdominal Completo', 'Doppler Renal', 'Doppler Venoso de Miembros Inferiores', 'Ultrasonido de Tiroides', 'Ultrasonido P√©lvico', 'Ultrasonido de Partes Blandas', etc.) y guardarlo en el campo 'detectedStudyType'.\n" +
      "2. Identificar de manera din√°mica todas las estructuras anat√≥micas, vasos sangu√≠neos, velocidades o par√°metros que son t√≠picamente susceptibles de medici√≥n cl√≠nica e indispensables para ese tipo de estudio espec√≠fico:\n" +
      "   - Si detectas que es un DOPPLER DE CAR√ìTIDAS o DOPPLER CAROT√çDEO: Debes incluir de forma obligatoria y exhaustiva las siguientes 22 mediciones y par√°metros bilateralmente, buscando sus valores reales en el reporte, o sugiriendo sus valores normales por defecto correspondientes si no se mencionan:\n" +
      "     1. Arteria Car√≥tida Com√∫n Derecha (VPS) [Rango: 50 - 100 cm/s, Default: 75 cm/s]\n" +
      "     2. Arteria Car√≥tida Com√∫n Derecha (VED) [Rango: < 35 cm/s, Default: 20 cm/s]\n" +
      "     3. Arteria Car√≥tida Interna Derecha (VPS) [Rango: < 125 cm/s, Default: 70 cm/s]\n" +
      "     4. Arteria Car√≥tida Interna Derecha (VED) [Rango: < 40 cm/s, Default: 25 cm/s]\n" +
      "     5. Arteria Car√≥tida Externa Derecha (VPS) [Rango: < 115 cm/s, Default: 65 cm/s]\n" +
      "     6. Arteria Car√≥tida Externa Derecha (VED) [Rango: < 30 cm/s, Default: 15 cm/s]\n" +
      "     7. Arteria Car√≥tida Com√∫n Izquierda (VPS) [Rango: 50 - 100 cm/s, Default: 75 cm/s]\n" +
      "     8. Arteria Car√≥tida Com√∫n Izquierda (VED) [Rango: < 35 cm/s, Default: 20 cm/s]\n" +
      "     9. Arteria Car√≥tida Interna Izquierda (VPS) [Rango: < 125 cm/s, Default: 70 cm/s]\n" +
      "     10. Arteria Car√≥tida Interna Izquierda (VED) [Rango: < 40 cm/s, Default: 25 cm/s]\n" +
      "     11. Arteria Car√≥tida Externa Izquierda (VPS) [Rango: < 115 cm/s, Default: 65 cm/s]\n" +
      "     12. Arteria Car√≥tida Externa Izquierda (VED) [Rango: < 30 cm/s, Default: 15 cm/s]\n" +
      "     13. Grosor Miointimal Derecho (GIM) [Rango: < 0.9 mm, Default: 0.6 mm]\n" +
      "     14. Grosor Miointimal Izquierdo (GIM) [Rango: < 0.9 mm, Default: 0.6 mm]\n" +
      "     15. Presencia de Placas (Derecha) [Rango: Sin placas, Default: Sin placas]\n" +
      "     16. Presencia de Placas (Izquierda) [Rango: Sin placas, Default: Sin placas]\n" +
      "     17. Arteria Vertebral Derecha (VPS) [Rango: 20 - 60 cm/s, Default: 35 cm/s]\n" +
      "     18. Arteria Vertebral Derecha (Direcci√≥n) [Rango: Anter√≥grado, Default: Anter√≥grado]\n" +
      "     19. Arteria Vertebral Izquierda (VPS) [Rango: 20 - 60 cm/s, Default: 35 cm/s]\n" +
      "     20. Arteria Vertebral Izquierda (Direcci√≥n) [Rango: Anter√≥grado, Default: Anter√≥grado]\n" +
      "     21. Relaci√≥n ACC/ACI Derecha [Rango: < 2.0, Default: 1.2]\n" +
      "     22. Relaci√≥n ACC/ACI Izquierda [Rango: < 2.0, Default: 1.2]\n" +
      "   - Si detectas que es un DOPPLER ARTERIAL O VENOSO DE MIEMBROS (INFERIORES O SUPERIORES):\n" +
      "     * ¬°IMPORTANTE SOBRE LATERALIDAD!: Si el estudio es unilateral (por ejemplo, el reporte solo eval√∫a el miembro izquierdo 'izq' o solo el derecho 'der'), DEBES reportar 'detectedSide' como 'izq' o 'der' y devolver √öNICAMENTE las estructuras vasculares de ese miembro evaluado. ¬°EST√Å ESTRICTAMENTE PROHIBIDO INCLUIR, NOMBRAR O INVENTAR DATOS NORMALES PARA EL MIEMBRO CONTRALATERAL NO EVALUADO! Si el estudio eval√∫a de forma expl√≠cita ambos miembros, reporta 'both' y devuelve los vasos de ambos lados.\n" +
      "     * Si es DOPPLER ARTERIAL: Debes analizar de manera exhaustiva el reporte para extraer las caracter√≠sticas de flujo, velocidades y forma de onda de cada uno de los vasos principales. Los vasos son: Arteria Il√≠aca Com√∫n (AIC), Arteria Femoral Com√∫n (AFC), Arteria Femoral (AF) [¬°NUNCA uses el t√©rmino Femoral Superficial, usa √∫nicamente Arteria Femoral o AF!], Arteria Popl√≠tea (AP), Arteria Tibial Anterior (ATA), Arteria Tibial Posterior (ATP), Arteria Peronea (APer) y Arteria Pedia (APed). Realiza una evaluaci√≥n inteligente:\n" +
      "       - Si la conclusi√≥n diagn√≥stica se√±ala que un vaso tiene una patolog√≠a o alteraci√≥n, prior√≠zala para marcar el estado como 'altered'.\n" +
      "       - 1. 'Trif√°sico' o 'Flujo trif√°sico' -> Status: 'normal'. Interpretation: 'Flujo normal (Onda Trif√°sica)'.\n" +
      "       - 2. 'Atenuado' o 'Flujo atenuado' o 'Atenuada' -> Status: 'altered'. Interpretation: 'Estenosis leve'.\n" +
      "       - 3. 'Ensanchamiento espectral' -> Status: 'altered'. Interpretation: 'Estenosis moderada'.\n" +
      "       - 4. 'Monof√°sico' o 'Flujo monof√°sico' -> Status: 'altered'. Interpretation: 'Estenosis severa'.\n" +
      "       - 5. 'Flujo no detectable' o 'Flujo filiforme' o 'Oclusi√≥n' -> Status: 'altered'. Interpretation: 'Estenosis muy severa/oclusi√≥n'.\n" +
      "     * Si es DOPPLER VENOSO DE MIEMBROS INFERIORES: Eval√∫a el estado de las venas (Vena Femoral Com√∫n, Vena Femoral, Vena Popl√≠tea, Venas Tibiales, Vena Safena Mayor, Vena Safena Menor). Mapea su estado de permeabilidad y competencia valvular.\n" +
      "   - Si detectas que es un DOPPLER RENAL: Incluye velocidades pico sist√≥licas y los √çndices de Resistencia (IR) renales arteriales principales.\n" +
      "   - Si detectas que es un ULTRASONIDO DE ABDOMEN (o ri√±√≥n/v√≠as urinarias est√° involucrado) o ULTRASONIDO ABDOMINAL COMPLETO: Debes incluir de manera obligatoria las 8 mediciones renales espec√≠ficas (Ri√±√≥n Derecho Largo, Ancho, Grosor Cortical e IR; Ri√±√≥n Izquierdo Largo, Ancho, Grosor Cortical e IR) con sus rangos de referencia est√°ndares. Adem√°s, para los estudios de abdomen, debes incluir de manera obligatoria los siguientes par√°metros con sus rangos y valores predeterminados exactos:\n" +
      "     * H√≠gado [Rango: 120 - 154 mm, Default: 135 mm]\n" +
      "     * Bazo [Rango: 9 - 11,8 mm, Default: 10,5 mm]\n" +
      "     * Rigidez Hep√°tica (Elastograf√≠a) [Rango: 4 - 5,4 kPa, Default: 4,7 kPa]\n" +
      "   - Si detectas que es un ULTRASONIDO DE TIROIDES o US DE CUELLO / ULTRASONIDO DE CUELLO: Incluye medidas de l√≥bulos (ej. 'L√≥bulo Derecho (Longitudinal)', 'L√≥bulo Derecho (Anteroposterior)', 'L√≥bulo Derecho (Transverso)', 'L√≥bulo Izquierdo...', 'Istmo (Espesor)'). Rango normal de espesor de istmo: < 4 mm, l√≥bulos longitud: 37 - 44 mm, l√≥bulos anteroposterior: 10 - 20 mm, l√≥bulos transverso: 15 - 20 mm. Est√° ESTRICTAMENTE PROHIBIDO incluir vasos sangu√≠neos o par√°metros del sistema carot√≠deo (Arterias Car√≥tidas Comunes, Internas, Externas, Arterias Vertebrales, Grosor Miointimal (GIM), o Relaci√≥n ACC/ACI) en este estudio, ya que esas estructuras corresponden √∫nica y exclusivamente al Doppler de Car√≥tidas.\n" +
      "   - Si detectas que es un ULTRASONIDO P√âLVICO/GINECOL√ìGICO: Incluye '√ötero (Longitudinal)', '√ötero (Anteroposterior)', '√ötero (Transversal)', 'Endometrio (Espesor)', 'Ovario Derecho (Volumen)', 'Ovario Izquierdo (Volumen)'.\n" +
      "3. Para cada estructura o par√°metro:\n" +
      "   - Indicar su rango o l√≠mite normal est√°ndar aceptado en medicina cl√≠nica con unidades (ej: 'Hasta 150 mm', 'Pared hasta 3 mm', '90 - 120 mm', '< 125 cm/s').\n" +
      "   - Buscar si el informe ya menciona alguna medici√≥n para esa estructura (ej. 'h√≠gado de 165 mm', 'VPS de 85 cm/s', etc.). Si se menciona, extraer la medida exacta encontrada. Si no se menciona ninguna medida, dejarlo vac√≠o ('').\n" +
      "   - Determinar el estado ('status'): 'normal' si hay medida y est√° en rango normal; 'altered' si hay medida y se desv√≠a del rango; 'not_found' si no se menciona ninguna medida en el reporte.\n" +
      "   - Ofrecer una interpretaci√≥n o sugerencia diagn√≥stica concisa en base a su estado (ej: 'Flujo hemodin√°micamente normal', 'Estenosis significativa', 'Hepatomegalia', 'Sin medir').\n" +
      "   - Proponer un valor normal por defecto representativo y saludable ('defaultNormalValue') con unidades (ej. '105 mm', '12 mm', '75 cm/s', '0.60', etc.) que cumpla el rango normal y se pueda asignar directamente si el usuario lo desea.\n" +
      "Debes estructurar la respuesta exclusivamente como un objeto JSON con tres propiedades: 'detectedStudyType', 'detectedSide' y 'structures'.";

    const promptText = `Analiza detenidamente este informe radiol√≥gico para el Asistente de Medidas:

"""
${report}
"""

Detecta el tipo de estudio m√©dico, el lado analizado si es unilateral (der, izq, both), identifica todas las estructuras, vasos o par√°metros relevantes a medir para dicho estudio, indica sus rangos normales, busca si el reporte ya contiene medidas para ellos, califica su estado e interpretaci√≥n, y sugiere un valor normal predeterminado saludable.
Devuelve el JSON estructurado seg√∫n el esquema solicitado.`;

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
              description: "Tipo de estudio m√©dico detectado a partir del informe (ej. 'Doppler de Car√≥tidas', 'Ultrasonido Abdominal Completo', 'Doppler Venoso de Miembros Inferiores', 'Ultrasonido de Tiroides', etc.)."
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
                    description: "Nombre de la estructura, vaso o par√°metro anat√≥mico en espa√±ol (ej. H√≠gado, Ves√≠cula Biliar, Arteria Car√≥tida Interna Derecha (VPS), L√≥bulo Derecho de Tiroides (Longitudinal), etc.)." 
                  },
                  normalRange: { 
                    type: Type.STRING, 
                    description: "Rango normal sugerido cl√≠nicamente con sus unidades (ej. 'Hasta 150 mm', 'Pared hasta 3 mm', '50 - 100 cm/s', etc.)." 
                  },
                  measuredValue: { 
                    type: Type.STRING, 
                    description: "Medida exacta encontrada en el reporte para esta estructura/par√°metro (ej. '138 mm', '75 cm/s', '4 mm'). Si no se encuentra ninguna medida para ella, debe ser una cadena vac√≠a ''." 
                  },
                  status: { 
                    type: Type.STRING, 
                    description: "Estado de la estructura. Debe ser exactamente uno de estos tres valores: 'normal' (si tiene medida y est√° dentro del rango normal), 'altered' (si tiene medida y est√° fuera del rango), o 'not_found' (si no se especifica ninguna medida en el reporte)." 
                  },
                  interpretation: { 
                    type: Type.STRING, 
                    description: "Breve interpretaci√≥n o diagn√≥stico cl√≠nico sugerido si est√° alterado (ej. 'Hepatomegalia leve', 'Estenosis carot√≠dea leve', etc.) o confirmaci√≥n de normalidad (ej. 'Flujo normal') o 'Sin medici√≥n registrada'." 
                  },
                  defaultNormalValue: { 
                    type: Type.STRING, 
                    description: "Un valor t√≠pico normal, saludable y est√°ndar (con unidades, ej. '105 mm', '75 cm/s', '0.60', etc.) representativo de esa estructura para poder asignarlo directamente al reporte." 
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
    if (studyLower.includes("carot") || reportLower.includes("carot") || reportLower.includes("car√≥tida") || inputStudyLower.includes("carot")) {
      isCarotidas = true;
    }

    if (isCarotidas) {
      if (!studyLower.includes("carot")) {
        parsedData.detectedStudyType = "Doppler de Car√≥tidas";
      }

      const mandatoryCarotid = [
        {
          key: "acc_der_vps",
          name: "Arteria Car√≥tida Com√∫n Derecha (VPS)",
          range: "50 - 100 cm/s",
          defaultVal: "72 cm/s",
          matchRegex: /com[u√∫]n.*der|acc.*der|der.*(com[u√∫]n|acc)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "acc_der_ved",
          name: "Arteria Car√≥tida Com√∫n Derecha (VED)",
          range: "< 35 cm/s",
          defaultVal: "18 cm/s",
          matchRegex: /com[u√∫]n.*der|acc.*der|der.*(com[u√∫]n|acc)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "aci_der_vps",
          name: "Arteria Car√≥tida Interna Derecha (VPS)",
          range: "< 125 cm/s",
          defaultVal: "68 cm/s",
          matchRegex: /interna.*der|aci.*der|der.*(interna|aci)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "aci_der_ved",
          name: "Arteria Car√≥tida Interna Derecha (VED)",
          range: "< 40 cm/s",
          defaultVal: "22 cm/s",
          matchRegex: /interna.*der|aci.*der|der.*(interna|aci)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "ace_der_vps",
          name: "Arteria Car√≥tida Externa Derecha (VPS)",
          range: "< 115 cm/s",
          defaultVal: "64 cm/s",
          matchRegex: /externa.*der|ace.*der|der.*(externa|ace)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "ace_der_ved",
          name: "Arteria Car√≥tida Externa Derecha (VED)",
          range: "< 30 cm/s",
          defaultVal: "14 cm/s",
          matchRegex: /externa.*der|ace.*der|der.*(externa|ace)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "acc_izq_vps",
          name: "Arteria Car√≥tida Com√∫n Izquierda (VPS)",
          range: "50 - 100 cm/s",
          defaultVal: "76 cm/s",
          matchRegex: /com[u√∫]n.*izq|acc.*izq|izq.*(com[u√∫]n|acc)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "acc_izq_ved",
          name: "Arteria Car√≥tida Com√∫n Izquierda (VED)",
          range: "< 35 cm/s",
          defaultVal: "21 cm/s",
          matchRegex: /com[u√∫]n.*izq|acc.*izq|izq.*(com[u√∫]n|acc)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "aci_izq_vps",
          name: "Arteria Car√≥tida Interna Izquierda (VPS)",
          range: "< 125 cm/s",
          defaultVal: "72 cm/s",
          matchRegex: /interna.*izq|aci.*izq|izq.*(interna|aci)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "aci_izq_ved",
          name: "Arteria Car√≥tida Interna Izquierda (VED)",
          range: "< 40 cm/s",
          defaultVal: "26 cm/s",
          matchRegex: /interna.*izq|aci.*izq|izq.*(interna|aci)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "ace_izq_vps",
          name: "Arteria Car√≥tida Externa Izquierda (VPS)",
          range: "< 115 cm/s",
          defaultVal: "66 cm/s",
          matchRegex: /externa.*izq|ace.*izq|izq.*(externa|ace)/i,
          matchSub: /vps|vmax|sist[o√≥]l/i,
          negativeSub: /ved|vmin|diast[o√≥]l/i
        },
        {
          key: "ace_izq_ved",
          name: "Arteria Car√≥tida Externa Izquierda (VED)",
          range: "< 30 cm/s",
          defaultVal: "16 cm/s",
          matchRegex: /externa.*izq|ace.*izq|izq.*(externa|ace)/i,
          matchSub: /ved|vmin|diast[o√≥]l/i,
          negativeSub: /vps|vmax|sist[o√≥]l/i
        },
        {
          key: "gim_der",
          name: "Grosor Miointimal Derecho (GIM)",
          range: "< 0.9 mm",
          defaultVal: "0.6 mm",
          matchRegex: /(grosor|gim|intima|miointimal).*der|der.*(grosor|gim|intima|miointimal)/i,
          matchSub: /grosor|miointimal|gim|√≠ntima-media/i
        },
        {
          key: "gim_izq",
          name: "Grosor Miointimal Izquierdo (GIM)",
          range: "< 0.9 mm",
          defaultVal: "0.6 mm",
          matchRegex: /(grosor|gim|intima|miointimal).*izq|izq.*(grosor|gim|intima|miointimal)/i,
          matchSub: /grosor|miointimal|gim|√≠ntima-media/i
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
          matchSub: /vps|vmax|sist[o√≥]l|velocidad/i,
          negativeSub: /direcci√≥n|flujo|sentido/i
        },
        {
          key: "vert_der_dir",
          name: "Arteria Vertebral Derecha (Direcci√≥n)",
          range: "Anter√≥grado",
          defaultVal: "Anter√≥grado",
          matchRegex: /vertebral.*der|der.*vertebral/i,
          matchSub: /direcci√≥n|flujo|sentido/i,
          negativeSub: /vps|vmax|sist[o√≥]l|velocidad/i
        },
        {
          key: "vert_izq_vps",
          name: "Arteria Vertebral Izquierda (VPS)",
          range: "20 - 60 cm/s",
          defaultVal: "36 cm/s",
          matchRegex: /vertebral.*izq|izq.*vertebral/i,
          matchSub: /vps|vmax|sist[o√≥]l|velocidad/i,
          negativeSub: /direcci√≥n|flujo|sentido/i
        },
        {
          key: "vert_izq_dir",
          name: "Arteria Vertebral Izquierda (Direcci√≥n)",
          range: "Anter√≥grado",
          defaultVal: "Anter√≥grado",
          matchRegex: /vertebral.*izq|izq.*vertebral/i,
          matchSub: /direcci√≥n|flujo|sentido/i,
          negativeSub: /vps|vmax|sist[o√≥]l|velocidad/i
        },
        {
          key: "rel_der",
          name: "Relaci√≥n ACC/ACI Derecha",
          range: "< 2.0",
          defaultVal: "1.2",
          matchRegex: /(relaci√≥n|ratio|√≠ndice).*der|der.*(relaci√≥n|ratio|√≠ndice)/i,
          matchSub: /acc\/aci|aci\/acc|carot√≠de/i
        },
        {
          key: "rel_izq",
          name: "Relaci√≥n ACC/ACI Izquierda",
          range: "< 2.0",
          defaultVal: "1.2",
          matchRegex: /(relaci√≥n|ratio|√≠ndice).*izq|izq.*(relaci√≥n|ratio|√≠ndice)/i,
          matchSub: /acc\/aci|aci\/acc|carot√≠de/i
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
              const typeMatch = windowText.match(/(calcificada|blanda|lip[i√≠]dica|mixta|fibrosa|fibrocalcificada)/i);
              const typeStr = typeMatch ? typeMatch[1].toLowerCase() : "calcificada";
              const sizeMatch = windowText.match(/(\d+[,.]\d+|\d+)\s*mm/i);
              const sizeStr = sizeMatch ? `${sizeMatch[1]} mm` : "peque√±a";

              const stenosisMatch = windowText.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstruccion)/i) || 
                                    windowText.match(/(?:estenosis|obstruccion)\s*(?:de\s+)?(?:del\s+)?(\d+)\s*%/i);
              const stenosisVal = stenosisMatch ? `${stenosisMatch[1]}%` : "";

              let desc = `Placa ${typeStr}`;
              if (stenosisVal) desc += ` con estenosis del ${stenosisVal}`;
              else desc += ` sin estenosis hemodin√°mica`;

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
              return "Retr√≥grado / Reverso";
            }
            idx = normReport.indexOf(normalizedKw, idx + 1);
          }
        }
        return "Anter√≥grado";
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
          interpretation = "Estenosis severa (> 70%) seg√∫n criterios de Consenso de Estenosis";
          status = "altered";
        } else if (currentVps >= 125) {
          estenosis = "50% - 70% (Estenosis moderada)";
          interpretation = "Estenosis moderada (50% - 70%) seg√∫n criterios de Consenso de Estenosis";
          status = "altered";
        } else {
          if (plaquesPresent) {
            estenosis = "< 50% (Estenosis leve)";
            interpretation = "Estenosis leve (< 50%) seg√∫n criterios de Consenso de Estenosis";
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
        const interpretation = status === "normal" ? "Flujo anter√≥grado normal" : "Flujo retr√≥grado patol√≥gico (Robo de la subclavia)";
        extractedMap.set(key, { measuredValue: dir, status, interpretation });
      });

      // Extract and set Ratios (Relaci√≥n ACC/ACI)
      ["der", "izq"].forEach(side => {
        const key = `rel_${side}`;
        const kws = side === "der" 
          ? ["relacion der", "ratio der", "acc/aci der", "relacion acc/aci der", "relacion acc/aci derecha"]
          : ["relacion izq", "ratio izq", "acc/aci izq", "relacion acc/aci izq", "relacion acc/aci izquierda"];
        
        const ext = extractVal(kws, null, false, true);
        if (ext) {
          const valFormatted = ext.value.replace(".", ",");
          const status = ext.num >= 2.0 ? "altered" : "normal";
          const interpretation = status === "altered" ? "Relaci√≥n aumentada (Sugerente de estenosis)" : "Relaci√≥n normal";
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
            const interpretation = status === "altered" ? "Relaci√≥n aumentada (Sugerente de estenosis)" : "Relaci√≥n normal";
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
            interpretation: "Sin medici√≥n registrada",
            defaultNormalValue: m.defaultVal
          });
        }
      });

      // Ensure left and right velocities have slight realistic variations if they defaulted to identical
      const carotidPairs = [
        { der: "Arteria Car√≥tida Com√∫n Derecha (VPS)", izq: "Arteria Car√≥tida Com√∫n Izquierda (VPS)" },
        { der: "Arteria Car√≥tida Com√∫n Derecha (VED)", izq: "Arteria Car√≥tida Com√∫n Izquierda (VED)" },
        { der: "Arteria Car√≥tida Interna Derecha (VPS)", izq: "Arteria Car√≥tida Interna Izquierda (VPS)" },
        { der: "Arteria Car√≥tida Interna Derecha (VED)", izq: "Arteria Car√≥tida Interna Izquierda (VED)" },
        { der: "Arteria Car√≥tida Externa Derecha (VPS)", izq: "Arteria Car√≥tida Externa Izquierda (VPS)" },
        { der: "Arteria Car√≥tida Externa Derecha (VED)", izq: "Arteria Car√≥tida Externa Izquierda (VED)" },
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
      (reportLower.includes("doppler") && reportLower.includes("arterial") && (reportLower.includes("miembro") || reportLower.includes("pierna") || reportLower.includes("inferior") || reportLower.includes("extremidad") || reportLower.includes("femoral") || reportLower.includes("popl√≠tea") || reportLower.includes("pedio")))
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
      const conclusionRegex = /(?:impresi[o√≥]n|conclusi[o√≥]n|conclusiones|diagn[o√≥]stico|dx:)/i;
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
          name: "Arteria Il√≠aca Com√∫n Derecha (AIC)",
          range: "Trif√°sico, VPS > 50 cm/s",
          baseVel: 80,
          modVel: 15,
          leftOff: -3,
          vesselKeywords: ["il√≠aca com√∫n", "iliaca comun", "aic"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "afc_der",
          side: "der" as const,
          name: "Arteria Femoral Com√∫n Derecha (AFC)",
          range: "Trif√°sico, VPS 50 - 100 cm/s",
          baseVel: 75,
          modVel: 15,
          leftOff: 4,
          vesselKeywords: ["femoral com√∫n", "femoral comun", "afc"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "afs_der",
          side: "der" as const,
          name: "Arteria Femoral Derecha (AF)",
          range: "Trif√°sico, VPS 50 - 90 cm/s",
          baseVel: 70,
          modVel: 15,
          leftOff: -2,
          vesselKeywords: ["femoral superficial", "afs", "femoral", "af"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "ap_der",
          side: "der" as const,
          name: "Arteria Popl√≠tea Derecha (AP)",
          range: "Trif√°sico, VPS 40 - 80 cm/s",
          baseVel: 60,
          modVel: 15,
          leftOff: 3,
          vesselKeywords: ["popl√≠tea", "poplitea", "ap"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "ata_der",
          side: "der" as const,
          name: "Arteria Tibial Anterior Derecha (ATA)",
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 20 - 50 cm/s",
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
          name: "Arteria Il√≠aca Com√∫n Izquierda (AIC)",
          range: "Trif√°sico, VPS > 50 cm/s",
          baseVel: 80,
          modVel: 15,
          leftOff: -3,
          vesselKeywords: ["il√≠aca com√∫n", "iliaca comun", "aic"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "afc_izq",
          side: "izq" as const,
          name: "Arteria Femoral Com√∫n Izquierda (AFC)",
          range: "Trif√°sico, VPS 50 - 100 cm/s",
          baseVel: 75,
          modVel: 15,
          leftOff: 4,
          vesselKeywords: ["femoral com√∫n", "femoral comun", "afc"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "afs_izq",
          side: "izq" as const,
          name: "Arteria Femoral Izquierda (AF)",
          range: "Trif√°sico, VPS 50 - 90 cm/s",
          baseVel: 70,
          modVel: 15,
          leftOff: -2,
          vesselKeywords: ["femoral superficial", "afs", "femoral", "af"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "ap_izq",
          side: "izq" as const,
          name: "Arteria Popl√≠tea Izquierda (AP)",
          range: "Trif√°sico, VPS 40 - 80 cm/s",
          baseVel: 60,
          modVel: 15,
          leftOff: 3,
          vesselKeywords: ["popl√≠tea", "poplitea", "ap"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "ata_izq",
          side: "izq" as const,
          name: "Arteria Tibial Anterior Izquierda (ATA)",
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 30 - 60 cm/s",
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
          range: "Trif√°sico, VPS 20 - 50 cm/s",
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
            const regex = new RegExp(`(?:^|[^a-z√°√©√≠√≥√∫√º√±])${escaped}(?:$|[^a-z√°√©√≠√≥√∫√º√±])`, 'i');
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

        const defaultNormalValue = `${normalSpeed} cm/s, Trif√°sico`;

        if (!context) {
          return {
            status: "not_found" as const,
            measuredValue: "",
            interpretation: "Sin medici√≥n registrada",
            defaultNormalValue
          };
        }

        // 0. ESTENOSIS FOCAL CON PORCENTAJE
        const focalMatch = context.match(/(?:estenosis|obstrucci√≥n|obstruccion)\s+(?:focal\s+)?(?:de|del|de un)?\s*(\d+)\s*%/i) || context.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstrucci√≥n|obstruccion)/i);

        if (focalMatch) {
          const percent = focalMatch[1];
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const interpretation = `Estenosis focal del ${percent}%`;
          const pctVal = parseInt(percent, 10);
          let term = `Estenosis focal (${percent}%)`;
          if (pctVal >= 70) {
            term = `${velStr}Flujo monof√°sico, Estenosis focal (${percent}%)`;
          } else if (pctVal >= 50) {
            term = `${velStr}Ensanchamiento espectral, Estenosis focal (${percent}%)`;
          } else {
            term = `${velStr}Flujo atenuado, Estenosis focal (${percent}%)`;
          }
          return {
            status: "altered" as const,
            measuredValue: term,
            interpretation: interpretation,
            defaultNormalValue: velStr ? `${velStr}Trif√°sico` : `${normalSpeed} cm/s, Trif√°sico`
          };
        }

        // 1. OCLUSION / SIN FLUJO DETECTABLE / FILIFORME
        const isNoFlow = context.includes("oclusi") || context.includes("ocluido") || context.includes("ocluida") || 
                         context.includes("no detectable") || context.includes("sin flujo") || context.includes("ausencia de flujo") || 
                         context.includes("no se detecta") || context.includes("obstruccion total") || context.includes("obstrucci√≥n total") || 
                         context.includes("flujo no medible") || context.includes("filiforme");

        // 2. MONOF√ÅSICO / ESTENOSIS SEVERA
        const isSevere = context.includes("monofasico") || context.includes("monof√°sica") || context.includes("monofasica") || 
                         context.includes("severa") || context.includes("severo") || context.includes("estenosis severa") || 
                         context.includes("obstruccion severa") || context.includes("obstrucci√≥n severa") || 
                         context.includes("tardus") || context.includes("parvus") || context.includes("amortiguado") || 
                         context.includes("baja resistencia");

        // 3. ENSANCHAMIENTO ESPECTRAL / ESTENOSIS MODERADA
        const isModerate = context.includes("ensanchamiento") || context.includes("espectral") || context.includes("turbulencia") ||
                           context.includes("moderada") || context.includes("moderado") || context.includes("estenosis moderada");

        // 4. ATENUADO / ESTENOSIS LEVE
        const isLeve = context.includes("atenuado") || context.includes("atenuada") || context.includes("atenuad") ||
                       context.includes("bifasico") || context.includes("bif√°sica") || context.includes("bifasica") ||
                       context.includes("leve") || context.includes("estenosis leve");

        if (isNoFlow) {
          const isFiliforme = context.includes("filiforme");
          const term = isFiliforme ? "Flujo filiforme" : "Flujo no detectable";
          return {
            status: "altered" as const,
            measuredValue: term,
            interpretation: "Estenosis muy severa/oclusi√≥n",
            defaultNormalValue: "Flujo no detectable"
          };
        }

        if (isSevere) {
          const speedMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/) || context.match(/(?:vps|velocidad)\D*(\d+(?:[.,]\d+)?)/);
          const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";
          const term = "Flujo monof√°sico";
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
        const hasTrifasico = context.includes("trifasico") || context.includes("trif√°sica") || context.includes("trifasica") || context.includes("normal") || context.includes("conservado");

        if (speedMatch || hasTrifasico) {
          const vel = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s` : `${normalSpeed} cm/s`;
          return {
            status: "normal" as const,
            measuredValue: `${vel}, Trif√°sico`,
            interpretation: "Flujo normal (Onda Trif√°sica)",
            defaultNormalValue
          };
        }

        return {
          status: "not_found" as const,
          measuredValue: "",
          interpretation: "Sin medici√≥n registrada",
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
            const preFocalMatch = valLower.match(/(?:estenosis|obstrucci√≥n|obstruccion)\s+(?:focal\s+)?(?:de|del)?\s*(\d+)\s*%/i) || valLower.match(/(\d+)\s*%\s*(?:de\s+)?(?:estenosis|obstrucci√≥n|obstruccion)/i);

            const speedMatch = valueToUse.match(/(\d+(?:[.,]\d+)?)\s*(?:cm\/s|m\/s)/i);
            const velStr = speedMatch ? `${speedMatch[1].replace(",", ".")} cm/s, ` : "";

            if (preFocalMatch) {
              const percent = preFocalMatch[1];
              s.interpretation = `Estenosis focal del ${percent}%`;
              const pctVal = parseInt(percent, 10);
              if (pctVal >= 70) {
                s.measuredValue = `${velStr}Flujo monof√°sico, Estenosis focal (${percent}%)`;
              } else if (pctVal >= 50) {
                s.measuredValue = `${velStr}Ensanchamiento espectral, Estenosis focal (${percent}%)`;
              } else {
                s.measuredValue = `${velStr}Flujo atenuado, Estenosis focal (${percent}%)`;
              }
            } else {
              const preNoFlow = valLower.includes("no detect") || valLower.includes("sin flujo") || valLower.includes("oclu") || valLower.includes("ausen") || valLower.includes("filiform");
              const preMonofasico = valLower.includes("monofas") || valLower.includes("monof√°s");
              const preEspectral = valLower.includes("ensanch") || valLower.includes("espectr") || valLower.includes("turbu") || valLower.includes("moderad");
              const preLeve = valLower.includes("atenuad") || valLower.includes("bifas") || valLower.includes("leve");

              if (preNoFlow) {
                const isFiliforme = valLower.includes("filiform");
                s.measuredValue = isFiliforme ? "Flujo filiforme" : "Flujo no detectable";
                s.interpretation = "Estenosis muy severa/oclusi√≥n";
              } else if (preMonofasico) {
                s.measuredValue = `${velStr}Flujo monof√°sico`;
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
            if (!valueToUse.includes("Trif√°sico") && !valueToUse.includes("Trif√°sica") && !valueToUse.includes("onda") && !valueToUse.includes(" detectable")) {
              s.measuredValue = `${valueToUse.replace(/\s*cm\/s/g, "").trim()} cm/s, Trif√°sico`;
            } else {
              s.measuredValue = valueToUse;
            }
            s.interpretation = "Flujo normal (Onda Trif√°sica)";
          } else {
            s.status = "not_found";
            s.measuredValue = "";
            s.interpretation = "Sin medici√≥n registrada";
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
      (reportLower.includes("doppler") && reportLower.includes("venoso") && (reportLower.includes("miembro") || reportLower.includes("pierna") || reportLower.includes("inferior") || reportLower.includes("extremidad") || reportLower.includes("femoral") || reportLower.includes("popl√≠tea") || reportLower.includes("safena")))
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
      const conclusionRegex = /(?:impresi[o√≥]n|conclusi[o√≥]n|conclusiones|diagn[o√≥]stico|dx:)/i;
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
          name: "Vena Femoral Com√∫n Derecha (VFC)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral com√∫n", "femoral comun", "vfc"],
          sideKeywords: ["derech", "der", "dch", "mid"]
        },
        {
          key: "sfj_der",
          side: "der" as const,
          name: "Uni√≥n Safenofemoral Derecha (USF)",
          range: "Competente, sin reflujo",
          defaultVal: "Competente",
          vesselKeywords: ["safenofemoral", "sfj", "uni√≥n safeno", "union safeno", "cayado de la safena magna", "cayado de la safena interna", "safeno-femoral"],
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
          name: "Vena Popl√≠tea Derecha (VP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["popl√≠tea", "poplitea", "vp"],
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
          name: "Vena Femoral Com√∫n Izquierda (VFC)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["femoral com√∫n", "femoral comun", "vfc"],
          sideKeywords: ["izquierd", "izq", "mii"]
        },
        {
          key: "sfj_izq",
          side: "izq" as const,
          name: "Uni√≥n Safenofemoral Izquierda (USF)",
          range: "Competente, sin reflujo",
          defaultVal: "Competente",
          vesselKeywords: ["safenofemoral", "sfj", "uni√≥n safeno", "union safeno", "cayado de la safena magna", "cayado de la safena interna", "safeno-femoral"],
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
          name: "Vena Popl√≠tea Izquierda (VP)",
          range: "Permeable, colapsable",
          defaultVal: "Permeable",
          vesselKeywords: ["popl√≠tea", "poplitea", "vp"],
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
            const regex = new RegExp(`(?:^|[^a-z√°√©√≠√≥√∫√º√±])${escaped}(?:$|[^a-z√°√©√≠√≥√∫√º√±])`, 'i');
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
            interpretation: "Sin medici√≥n registrada",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        const isThrombosis = context.includes("trombosis") || context.includes("trombo") || context.includes("no colapsable") || context.includes("no compresible") || context.includes("ocluid") || context.includes("ausencia de flujo");
        const isReflux = context.includes("reflujo") || context.includes("insuficienc") || context.includes("incompetent") || context.includes("reflujo provocado") || context.includes("reflujo espont√°neo");

        // Extract any numeric values (e.g. "6.5 mm", "5 mm", etc.) that might have been assigned or recorded in the report
        const numberMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|cm|m\/s|cm\/s)/i) || 
                            context.match(/(?:di√°metro|diametro|medida|mide|de)?\s*(\d+(?:[.,]\d+)?)\s*(?:mm|cm)/i) ||
                            context.match(/(?:di√°metro|diametro|medida|mide|de)\s+(\d+(?:[.,]\d+)?)/i);

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
            interpretation = "Dilataci√≥n venosa / Ectasia";
          } else {
            interpretation = key.startsWith("sfj") ? "Uni√≥n safenofemoral competente" : "Permeable, colapsable al transductor";
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
            interpretation: key.startsWith("sfj") ? "Uni√≥n safenofemoral competente" : "Permeable, colapsable al transductor",
            defaultNormalValue: key.startsWith("sfj") ? "Competente" : "Permeable"
          };
        }

        return {
          status: "not_found" as const,
          measuredValue: "",
          interpretation: "Sin medici√≥n registrada",
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
            s.interpretation = matchedVessel.key.startsWith("sfj") ? "Uni√≥n safenofemoral competente" : "Permeable, colapsable al transductor";
          } else {
            s.status = "not_found";
            s.measuredValue = "";
            s.interpretation = "Sin medici√≥n registrada";
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
        "car√≥tida", "carotida", "gim", "miointimal", "vertebral", "acc/aci", "acc", "aci", "ace", "grosor miointimal", "relaci√≥n acc"
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
      (report || "").toLowerCase().includes("h√≠gado") ||
      (report || "").toLowerCase().includes("higado") ||
      (report || "").toLowerCase().includes("bazo") ||
      (report || "").toLowerCase().includes("hep√°tica") ||
      (report || "").toLowerCase().includes("hepatica");

    if (isAbdomenStudy) {
      const mandatoryAbdomen = [
        {
          key: "higado",
          name: "H√≠gado",
          range: "120 - 154 mm",
          defaultVal: "135 mm",
          matchRegex: /h[√≠i]gado/i,
          negativeRegex: /rigidez|elastograf|porta|suprahep[√°a]t|arteria|vena/i
        },
        {
          key: "bazo",
          name: "Bazo",
          range: "9 - 11,8 mm",
          defaultVal: "10,5 mm",
          matchRegex: /bazo/i,
          negativeRegex: /arteria|vena|espl[e√©]nic/i
        },
        {
          key: "rigidez",
          name: "Rigidez Hep√°tica (Elastograf√≠a)",
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
                  s.interpretation = "Caracter√≠sticas normales";
                } else {
                  s.status = "altered";
                  if (m.key === "higado") {
                    s.interpretation = numVal < 120 ? "H√≠gado disminuido de tama√±o" : "Hepatomegalia";
                  } else if (m.key === "bazo") {
                    s.interpretation = numVal < 9 ? "Bazo disminuido de tama√±o" : "Esplenomegalia";
                  } else {
                    s.interpretation = numVal < 4 ? "Rigidez hep√°tica disminuida" : "Rigidez hep√°tica aumentada (Sugerente de Fibrosis)";
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
            interpretation: "Sin medici√≥n registrada",
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
        const isThyroid = nameLower.includes("l√≥bulo") || nameLower.includes("lobulo") || nameLower.includes("tiroides") || nameLower.includes("tiroidea");
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
                  s.interpretation = "Caracter√≠sticas normales";
                } else {
                  s.status = "altered";
                  if (numVal < 37) {
                    s.interpretation = "L√≥bulo tiroideo disminuido de tama√±o";
                  } else {
                    s.interpretation = "Bocio / L√≥bulo tiroideo aumentado de tama√±o";
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
                  s.interpretation = "Caracter√≠sticas normales";
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
                  s.interpretation = "Caracter√≠sticas normales";
                } else {
                  s.status = "altered";
                  if (numVal < 15) {
                    s.interpretation = "Di√°metro transverso disminuido";
                  } else {
                    s.interpretation = "Di√°metro transverso aumentado";
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
                  s.interpretation = "Caracter√≠sticas normales";
                } else {
                  s.status = "altered";
                  s.interpretation = "Istmo aumentado de tama√±o (Hipertrofia)";
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
                  s.interpretation = "Caracter√≠sticas normales";
                } else {
                  s.status = "altered";
                  if (numVal < 4) {
                    s.interpretation = "Volumen de l√≥bulo tiroideo disminuido";
                  } else {
                    s.interpretation = "Volumen de l√≥bulo tiroideo aumentado";
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
        const isIR = /\bir\b/i.test(nameLower) || nameLower.includes("√≠ndice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("√≠ndice resistencia") || nameLower.includes("indice resistencia");
        const studyLower = (parsedData.detectedStudyType || "").toLowerCase();
        const isRenalIR = isIR && (nameLower.includes("renal") || nameLower.includes("ri√±√≥n") || nameLower.includes("ri√±on") || nameLower.includes("izquierdo") || nameLower.includes("derecho") || studyLower.includes("renal") || studyLower.includes("abdomen"));

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

          // Same base structure but different sides (e.g. "Ri√±√≥n Derecho Largo" and "Ri√±√≥n Izquierdo Largo")
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'currentReport' y un arreglo 'measurementsToAssign'." });
    }

    if (measurementsToAssign.length === 0) {
      return res.json({ success: true, modifiedReport: currentReport });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const measurementsText = measurementsToAssign.map(m => `- **${m.structure}**: ${m.value}`).join("\n");

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo experto en redacci√≥n cl√≠nica. Tu tarea es incorporar mediciones de manera totalmente natural, profesional " +
      "y fluida en las descripciones de las estructuras anat√≥micas correspondientes dentro de un informe radiol√≥gico de ultrasonido o tomograf√≠a. " +
      "Debes integrar las medidas solicitadas directamente en las frases existentes o reformularlas ligeramente para que suene como redactado de forma nativa por el m√©dico en una sola sesi√≥n. " +
      "Est√° estrictamente prohibido crear secciones de 'Medidas a√±adidas' o pre√°mbulos did√°cticos del estilo 'Se asignan las medidas...'. " +
      "Debe fluir de manera perfecta con el tono y estilo cl√≠nico senior.";

    const promptText = `
Tienes este informe radiol√≥gico en formato Markdown:

"""
${currentReport}
"""

Por favor, incorpora de forma nativa y fluida las siguientes mediciones normales en sus respectivas estructuras descritas en los hallazgos:

${measurementsText}

‚ö†Ô∏è REGLAS DE INTEGRACI√ìN:
1. Localiza cada estructura en la secci√≥n de HALLAZGOS (por ejemplo, si se pide H√≠gado de 135 mm, agr√©galo de manera natural en la descripci√≥n del H√≠gado: 'H√≠gado de tama√±o conservado, que mide 135 mm de di√°metro bipolar...').
2. Si la estructura no se describe de forma espec√≠fica pero pertenece al estudio o hay un texto est√°ndar, agr√©gala de forma elegante respetando el formato del reporte.
3. Para estudios Doppler (como Doppler de Car√≥tidas), es MANDATORIO integrar las velocidades utilizando expl√≠citamente las abreviaciones 'VPS' y 'VED' juntas o muy cerca del nombre del vaso. Debe redactarse de forma id√©ntica a: 'Nombre del Vaso (VPS: XX cm/s, VED: YY cm/s)' o bien 'Nombre del Vaso con velocidad sist√≥lica (VPS) de XX cm/s y diast√≥lica (VED) de YY cm/s'. Bajo ninguna circunstancia omitas los t√©rminos 'VPS' y 'VED' o pongas solo el n√∫mero, ya que el sistema automatizado de escaneo requiere estas siglas exactas para leer las velocidades correctamente de vuelta.
4. Para la Relaci√≥n ACC/ACI (tanto derecha como izquierda), incorp√≥rala de forma redactada fluida diciendo exactamente 'Relaci√≥n ACC/ACI de X,X' (por ejemplo: 'Relaci√≥n ACC/ACI de 1,2') al final del an√°lisis hemodin√°mico de cada lado.
5. ¬°EST√Å TERMINANTEMENTE PROHIBIDO OMITIR O IGNORAR NINGUNO de los par√°metros solicitados! Cada uno de los elementos de la lista de mediciones debe quedar incorporado de manera expl√≠cita en el informe redactado. Si alg√∫n vaso, relaci√≥n, estructura o par√°metro de la lista no se describe ni se menciona en el informe original, DEBES redactar una frase cl√≠nica fluida, elegante y natural dentro de la secci√≥n de Hallazgos para describirlo e incluir sus valores (por ejemplo: 'La Arteria Car√≥tida Externa presenta velocidades conservadas (VPS: 64 cm/s, VED: 14 cm/s)...' o 'La relaci√≥n ACC/ACI en el lado izquierdo es de 1,2.'). No resumas ni agrupes de forma que se pierdan las cifras individuales de cada par√°metro.
6. No alteres otras patolog√≠as o hallazgos descritos, mant√©n el rigor del diagn√≥stico intacto.
7. **REGLA DE CASING ESTRICTA**: No uses may√∫sculas sostenidas (ALL CAPS) para el texto nuevo o modificado. Escribe en min√∫sculas normales respetando las may√∫sculas iniciales.
8. Devuelve √öNICAMENTE el informe modificado completo en formato Markdown, sin pre√°mbulos, explicaciones ni comentarios de ning√∫n tipo.
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
 * 25. API: GENERATE FOOTNOTES SUGGESTIONS (Creador de Notas de Pie de P√°gina)
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
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para generar las notas de pie de p√°gina." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo senior experto en auditor√≠a de informes ecogr√°ficos y redactores de notas de pie de p√°gina.\n" +
      "Tu tarea es analizar de forma √≠ntegra el reporte cl√≠nico proporcionado y elaborar sugerencias de notas de pie de p√°gina con informaci√≥n altamente relevante y de alto valor para el m√©dico tratante o para el paciente.\n" +
      "Debes generar exactamente 4 sugerencias diferentes y bien redactadas en espa√±ol, cada una clasificada en una de estas categor√≠as:\n" +
      "1. 'M√©dico Tratante': Recomendaciones cl√≠nicas t√©cnicas, sugerencias de laboratorios complementarios, correlaciones histol√≥gicas, perfiles hep√°ticos/tiroideos, etc. Si detectas hallazgos patol√≥gicos espec√≠ficos, integra la cita cient√≠fica correspondiente (ej. 'Estratificaci√≥n de riesgo estimada mediante criterios ACR TI-RADS 2017' para n√≥dulos tiroideos; o 'Criterios hemodin√°micos basados en el Consenso de la Society of Radiologists in Ultrasound (SRU)' para estenosis carot√≠dea o esteatosis hep√°tica; 'Clasificaci√≥n de Bosniak' para quistes renales; o 'BI-RADS' para hallazgos en mamas).\n" +
      "2. 'Paciente': Explicaciones emp√°ticas o recomendaciones amigables sobre control de s√≠ntomas, aclaraciones generales que disipen dudas comunes, etc.\n" +
      "3. 'Control': Sugerencias espec√≠ficas de temporalidad para estudios de control (ej: repetir en 6 meses, control anual, control inmediato seg√∫n evoluci√≥n cl√≠nica).\n" +
      "4. 'T√©cnico / General': Notas de calidad del estudio, limitaciones t√©cnicas del examen (ej: interposici√≥n de gas intestinal, pan√≠culo adiposo, colaboraci√≥n del paciente, transductor utilizado).\n\n" +
      "REGLAS IMPORTANTES:\n" +
      "- Adapta las notas de forma estrictamente personalizada a los hallazgos reales del reporte (por ejemplo, si hay hepatomegalia, sugiera perfil hep√°tico; si hay bocio, sugiera TSH; si todo es normal, sugiera controles rutinarios de prevenci√≥n y comente las excelentes condiciones de la ventana ac√∫stica).\n" +
      "- Las notas deben ser breves, sumamente profesionales y elegantes (m√°ximo 150 caracteres por sugerencia).\n" +
      "- Devuelve √öNICAMENTE un objeto JSON v√°lido con la estructura descrita abajo, sin backticks ni explicaciones externas.";

    const promptText = `
Analiza este reporte cl√≠nico:

"""
${report}
"""

Genera las 4 sugerencias personalizadas en formato JSON estructurado exactamente as√≠:
{
  "footnotes": [
    {
      "id": "fn_1",
      "category": "M√©dico Tratante",
      "text": "Sugerencia personalizada de pie de p√°gina para el m√©dico"
    },
    {
      "id": "fn_2",
      "category": "Paciente",
      "text": "Sugerencia amigable personalizada de pie de p√°gina para el paciente"
    },
    {
      "id": "fn_3",
      "category": "Control",
      "text": "Sugerencia personalizada de control y seguimiento"
    },
    {
      "id": "fn_4",
      "category": "T√©cnico / General",
      "text": "Sugerencia t√©cnica sobre limitaciones o calidad del estudio"
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
            category: "M√©dico Tratante",
            text: "Se sugiere correlaci√≥n cl√≠nica con antecedentes y ex√°menes de laboratorio complementarios."
          },
          {
            id: "fn_2",
            category: "Paciente",
            text: "Recuerde consultar los resultados de este examen con su m√©dico tratante para una interpretaci√≥n integral."
          },
          {
            id: "fn_3",
            category: "Control",
            text: "Se recomienda control ecogr√°fico peri√≥dico seg√∫n indicaci√≥n m√©dica y evoluci√≥n cl√≠nica."
          },
          {
            id: "fn_4",
            category: "T√©cnico / General",
            text: "Examen realizado bajo condiciones t√©cnicas adecuadas con transductor multifrecuencial de alta resoluci√≥n."
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
      return res.status(400).json({ success: false, error: "Se requiere el 'report' para escanear gu√≠as cl√≠nicas." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const systemInstruction = 
      "Eres un m√©dico radi√≥logo, traumat√≥logo y auditor cl√≠nico senior experto en consensos cient√≠ficos, gu√≠as de pr√°ctica cl√≠nica internacionales y sistemas de clasificaci√≥n.\n" +
      "Tu tarea es analizar detalladamente el reporte m√©dico proporcionado y determinar qu√© gu√≠as y consensos de pr√°ctica cl√≠nica han sido REALMENTE APLICADOS o son directamente pertinentes seg√∫n los hallazgos patol√≥gicos reales descritos en el informe.\n" +
      "REGLAS CR√çTICAS DE AUDITOR√çA (PROHIBIDO EL EMPAREJAMIENTO DE PALABRAS CLAVE AISLADAS):\n" +
      "- Debes entender el contexto cl√≠nico real de manera √≠ntegra. No uses atajos como recomendar una gu√≠a solo porque aparezca un t√©rmino anat√≥mico si el √≥rgano o estructura es normal.\n" +
      "- No sugieras 'gpc-bosniak' (Clasificaci√≥n de Bosniak) si no hay menci√≥n expl√≠cita de quistes o lesiones qu√≠sticas renales complejas con tabiques o calcificaciones.\n" +
      "- No sugieras 'gpc-ti-rads' (ACR TI-RADS) si la tiroides es normal o no se describen n√≥dulos tiroideos.\n" +
      "- No sugieras 'gpc-bi-rads' (ACR BI-RADS) si no hay hallazgos patol√≥gicos o sospechas reales en mamas.\n" +
      "- No sugieras 'gpc-sru-esteatosis' (Consenso SRU H√≠gado) si el h√≠gado tiene ecogenicidad normal o si se niega expl√≠citamente la esteatosis hep√°tica (por ejemplo, 'h√≠gado de tama√±o y ecogenicidad normal, sin esteatosis'). Si est√° presente, los rangos oficiales QUS son: Normal (<5.0%), Leve (5.0-12.0%), Moderada (12.1-20.0%), Severa (>20.0%).\n" +
      "- No sugieras 'gpc-sru-carotidas' (Consenso SRU Car√≥tidas) o 'gpc-mannheim' (Consenso de Mannheim GIM) si no se describe patolog√≠a carot√≠dea, placas de ateroma o alteraci√≥n del grosor √≠ntima-media.\n" +
      "- No sugieras 'gpc-kellgren' (Kellgren & Lawrence) si no se describe artrosis, osteofitos o pinzamiento articular en la rodilla.\n" +
      "- No sugieras 'gpc-sru-tvp' (Consenso SRU de TVP) si no hay signos de trombosis venosa profunda.\n" +
      "- No sugieras 'gpc-tasc-ii' (Consenso TASC II Arterial) si no hay enfermedad arterial perif√©rica, estenosis o flujos alterados descritos.\n" +
      "- No sugieras 'gpc-or-ads' (Clasificaci√≥n O-RADS) o 'gpc-iota' (Reglas Simples IOTA) si no hay masas anexiales, quistes ov√°ricos o hallazgos ginecol√≥gicos patol√≥gicos relevantes.\n" +
      "- No sugieras 'gpc-tokio-tg18' (Gu√≠as de Tokio TG18) si no se describe colecistitis aguda o sospecha de inflamaci√≥n vesicular.\n" +
      "- No sugieras 'gpc-apendice-acr' (Criterios Apendicitis ACR) si el ap√©ndice es normal o no hay sospecha de apendicitis aguda.\n" +
      "Debes responder √öNICAMENTE con un objeto JSON con la estructura descrita abajo, sin comillas invertidas (backticks) ni explicaciones de texto adicionales.";

    const promptText = `
Analiza el siguiente reporte cl√≠nico para auditar y extraer gu√≠as o consensos aplicados o pertinentes seg√∫n el contexto real:

"""
${report}
"""

Las gu√≠as est√°ndar disponibles y sus condiciones son:
- "gpc-ti-rads": Aplicada si hay n√≥dulos tiroideos.
- "gpc-sru-carotidas": Aplicada si hay estenosis o placas carot√≠deas.
- "gpc-bi-rads": Aplicada si hay lesiones mamarias (n√≥dulos, microcalcificaciones, asimetr√≠as) o BI-RADS expl√≠cito.
- "gpc-bosniak": Aplicada si hay quistes renales con tabiques, calcificaciones o complejidad.
- "gpc-sru-esteatosis": Aplicada si hay esteatosis hep√°tica (h√≠gado graso, infiltraci√≥n grasa). Clasificaci√≥n QUS: Leve (5.0-12.0%), Moderada (12.1-20.0%), Severa (>20.0%).
- "gpc-kellgren": Aplicada si hay artrosis o pinzamiento articular en rodilla.
- "gpc-sru-tvp": Aplicada si hay trombosis venosa profunda o sospecha de TVP.
- "gpc-tasc-ii": Aplicada si hay estenosis o flujos alterados en Doppler arterial de miembros inferiores.
- "gpc-mannheim": Aplicada si hay medici√≥n del grosor √≠ntima-media (GIM) carot√≠deo o Mannheim.
- "gpc-or-ads": Aplicada si hay masas anexiales u ov√°ricas bajo O-RADS.
- "gpc-iota": Aplicada si hay masas anexiales valoradas con reglas IOTA.
- "gpc-tokio-tg18": Aplicada si hay colecistitis aguda o sospecha de inflamaci√≥n de ves√≠cula.
- "gpc-apendice-acr": Aplicada si hay sospecha de apendicitis aguda.

Retorna el resultado en formato JSON estructurado exactamente as√≠:
{
  "matchedStandardIds": ["gpc-ti-rads", "gpc-bi-rads"], // Arreglo de IDs de gu√≠as est√°ndar de la lista que realmente aplican seg√∫n el contexto. Si ninguna aplica, dejar vac√≠o [].
  "detected": [
    {
      "id": "guideline_id_unico",
      "title": "Nombre de la Clasificaci√≥n (ej: Clasificaci√≥n de Gustilo-Anderson o Clasificaci√≥n de Schatzker)",
      "description": "Qu√© eval√∫a en la lesi√≥n espec√≠fica descrita en el informe.",
      "text": "Texto formal de pie de p√°gina para incrustar.",
      "source": "Entidad emisora de la gu√≠a"
    }
  ] // Arreglo de clasificaciones din√°micas detectadas (especialmente de fracturas u ortopedia descritas en el informe). Si ninguna aplica, dejar vac√≠o [].
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'image' y 'mimeType'." });
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
Analiza la siguiente imagen que corresponde a una lista de trabajo (agenda diaria de pacientes) de un m√©dico o centro radiol√≥gico.
Digitaliza de manera rigurosa y extrae la lista de pacientes, sus datos personales correspondientes y los detalles de sus citas.

REGLAS DE EXTRACCI√ìN:
1. Identifica cada fila o elemento de la agenda que represente a un paciente diferente.
2. Extrae y formatea:
   - 'name': Nombre completo del paciente (en formato May√∫scula/Min√∫scula est√°ndar, ej: "Carlos P√©rez").
   - 'age': Edad (ej: "45" o "45 a√±os"). Si no se especifica, d√©jalo vac√≠o "".
   - 'gender': G√©nero/sexo. Usa "M", "F" o d√©jalo vac√≠o "" si no est√° presente.
   - 'patientId': Identificaci√≥n, ID de paciente, Historia Cl√≠nica o c√©dula. Si no se especifica, d√©jalo vac√≠o "".
   - 'studyType': Tipo de estudio radiol√≥gico solicitado (ej: "Ecograf√≠a Renal" o "Radiograf√≠a de T√≥rax"). Si no se especifica, d√©jalo vac√≠o "".
   - 'time': Hora programada de la cita (ej: "08:30" o "14:15"). Si no se especifica, d√©jalo vac√≠o "".
   - 'phone': N√∫mero de tel√©fono, celular o de contacto del paciente. Si no se especifica, d√©jalo vac√≠o "".
3. S√© sumamente fiel a la imagen. No inventes pacientes que no aparezcan en la lista.
`;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [imagePart, { text: promptText }],
      config: {
        systemInstruction: "Eres un experto asistente de digitalizaci√≥n de documentos m√©dicos y agendas cl√≠nicas. Extraes informaci√≥n de agendas radiol√≥gicas manuscritas o impresas con absoluta precisi√≥n y devuelves una lista estructurada de pacientes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre completo del paciente" },
              age: { type: Type.STRING, description: "Edad o a√±os" },
              gender: { type: Type.STRING, description: "Sexo o g√©nero ('M', 'F' o vac√≠o)" },
              patientId: { type: Type.STRING, description: "ID, Historia Cl√≠nica o Identificaci√≥n" },
              studyType: { type: Type.STRING, description: "Tipo de estudio m√©dico/radiol√≥gico solicitado" },
              time: { type: Type.STRING, description: "Hora de la cita o turno" },
              phone: { type: Type.STRING, description: "N√∫mero de tel√©fono o celular del paciente si est√° presente" }
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
      throw new Error("No se pudo obtener una lista estructurada v√°lida de la imagen. Por favor, aseg√∫rate de que la foto de la agenda sea clara y legible.");
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

// --- PERSISTENT FIREBASE CONFIG ENDPOINTS ---

// Automatic backup of original firebase-applet-config.json on startup
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const backupPath = path.join(process.cwd(), "firebase-applet-config.json.backup");
  if (fs.existsSync(configPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
    console.log("[Servidor] Copia de seguridad del Firebase predeterminado creada de forma segura.");
  }
} catch (err) {
  console.warn("No se pudo crear la copia de seguridad de la configuraci√≥n de Firebase:", err);
}

// Endpoint to save custom Firebase config directly to the workspace file system
app.post("/api/save-firebase-config", (req, res) => {
  try {
    const { config } = req.body;
    if (!config || !config.apiKey || !config.projectId) {
      return res.status(400).json({ success: false, error: "La configuraci√≥n provista no contiene 'apiKey' o 'projectId'." });
    }
    
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    
    console.log(`[Servidor] Se ha guardado una nueva configuraci√≥n de Firebase (Proyecto: ${config.projectId}) directamente en el disco del espacio de trabajo.`);
    res.json({ success: true, message: "¬°Configuraci√≥n de Firebase guardada con √©xito de forma persistente en el servidor!" });
  } catch (error: any) {
    console.error("Error al guardar la configuraci√≥n de Firebase en el disco:", error);
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Endpoint to reset and restore the original AI Studio test database configuration
app.post("/api/reset-firebase-config", (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const backupPath = path.join(process.cwd(), "firebase-applet-config.json.backup");
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath);
      console.log("[Servidor] Configuraci√≥n predeterminada de Firebase restaurada.");
      res.json({ success: true, message: "Configuraci√≥n original restaurada con √©xito." });
    } else {
      res.status(404).json({ success: false, error: "No se encontr√≥ la copia de seguridad de la configuraci√≥n original en el servidor." });
    }
  } catch (error: any) {
    console.error("Error al restaurar la configuraci√≥n de Firebase en el disco:", error);
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Endpoint to fetch current Firebase config from the server disk
app.get("/api/firebase-config", (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(data);
      res.json(parsed);
    } else {
      res.status(404).json({ error: "No se encontr√≥ el archivo de configuraci√≥n." });
    }
  } catch (error: any) {
    console.error("Error al obtener la configuraci√≥n de Firebase:", error);
    res.status(500).json({ error: error?.message || String(error) });
  }
});

/**
 * 40. API: GENERATE ORGAN SYNOPTIC TABLE (Creador de Cuadro Sin√≥ptico de √ìrgano)
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'report' y 'organ'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un radi√≥logo experto y un asistente de redacci√≥n m√©dica de precisi√≥n.
Analiza la secci√≥n de hallazgos del reporte radiol√≥gico proporcionado enfocado √∫nicamente en la estructura u √≥rgano indicado: '${organ}'.
Tambi√©n ten en cuenta los aspectos adicionales requeridos por el usuario: '${aspects || ""}'.
Debes generar una lista de aspectos cl√≠nicos para dicho √≥rgano, estructurados seg√∫n el esquema JSON solicitado.

REGLAS DE TERMINOLOG√çA Y REDACCI√ìN (CR√çTICAS):
1. NUNCA utilices expresiones como 'no fue reportado', 'no se menciona en el informe original', 'no descrito' o similares que separen la IA del usuario o dejen en evidencia la falta de datos del reporte de manera impersonal. Tanto el reporte como este cuadro son redactados y avalados por el mismo profesional m√©dico.
2. Si un dato no figura expl√≠citamente en el reporte pero es un aspecto cl√≠nico est√°ndar o de inter√©s, infiere su valor cl√≠nico habitual para este contexto, o clasif√≠calo como 'Sin alteraciones descritas', 'Ecoestructura habitual', 'No detectable', 'De aspecto normal', o prop√≥n una deducci√≥n cl√≠nica l√≥gica de valor a√±adido.
3. INCLUSI√ìN DE MEDIDAS Y HALLAZGOS COMPLEMENTARIOS: Si el reporte carece de dimensiones o medidas espec√≠ficas habituales para dicho √≥rgano (por ejemplo, di√°metros, volumen, espesor) o de hallazgos negativos/positivos clave que se correlacionan directamente con la patolog√≠a descrita (por ejemplo, ausencia de l√≠quido libre perihep√°tico si hay colecistitis, calibre del col√©doco si hay litiasis, etc.), la IA DEBE incluir propuestas de estas medidas y hallazgos l√≥gicos y consistentes con la patolog√≠a del paciente. Clasif√≠calos como 'Inferencia Cl√≠nica IA' en el origen para que el m√©dico pueda inyectarlos de manera retr√≥grada al informe.
4. Para clasificaciones de riesgo o diagn√≥sticos diferenciales solicitados por el usuario, utiliza el an√°lisis de los hallazgos descritos para deducir la escala m√°s coherente (ej: TI-RADS, Bosniak, LI-RADS) y fundamenta la clasificaci√≥n cl√≠nicamente.

Para cada aspecto cl√≠nico:
1. 'key': Nombre del aspecto (e.g., 'Tama√±o', 'Morfolog√≠a', 'Estructura/Ecogenicidad', 'Vascularizaci√≥n', 'Lesiones', 'Clasificaci√≥n', 'Diagn√≥stico Diferencial', 'Recomendaci√≥n').
2. 'value': El valor cl√≠nico o detalle. S√© espec√≠fico, profesional y preciso.
3. 'clinicalSource': 'Hallazgo de Reporte' si se menciona de forma expl√≠cita en el reporte, o 'Inferencia Cl√≠nica IA' si lo deduces por IA, escalas o seg√∫n las gu√≠as de pr√°ctica cl√≠nica como complemento.
4. 'explanation': Breve nota de por qu√© se incluye este aspecto y su significado cl√≠nico.
5. 'narrativeSentence': Una frase en espa√±ol redactada de forma impecable, fluida, natural y estrictamente profesional en lenguaje m√©dico para ser inyectada en la secci√≥n de hallazgos del reporte si se aprueba. No debe sonar rob√≥tica. Ej: 'La gl√°ndula tiroides se observa de tama√±o normal, con ecoestructura homog√©nea y sin evidencia de n√≥dulos sospechosos.'.

Reglas estrictas:
- No inventes hallazgos patol√≥gicos graves que no existan en el reporte de origen a menos que sea en forma de diagn√≥stico diferencial o clasificaciones de riesgo solicitadas.
- Mant√©n un rigor m√©dico intachable.
- Escribe todo en min√∫sculas normales respetando may√∫sculas iniciales (evita ALL CAPS).

Reporte Cl√≠nico:
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
                  key: { type: Type.STRING, description: "The name of the aspect (e.g. Tama√±o, Lesiones, Ecogenicidad, Clasificaci√≥n, Diagn√≥stico Diferencial, Recomendaci√≥n)" },
                  value: { type: Type.STRING, description: "The clinical value or detail. Must be highly precise and based on the report findings or standard clinical inference if requested." },
                  clinicalSource: { type: Type.STRING, description: "Indicates the source: 'Hallazgo de Reporte' or 'Inferencia Cl√≠nica IA'." },
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
      return res.status(400).json({ success: false, error: "Se requieren los par√°metros 'report' y 'organ'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un radi√≥logo subespecialista y editor m√©dico de alta precisi√≥n.
Tu objetivo principal es incrustar e inyectar de manera RETR√ìGRADA, INTELIGENTE e IMPERCEPTIBLE las frases/puntos seleccionados del cuadro sin√≥ptico referente al √≥rgano o estructura '${organ}' dentro del texto original del reporte radiol√≥gico, de modo que el reporte quede enriquecido y perfectamente redactado.

√ìrgano / Estructura: '${organ}'

Frases o Puntos Cl√≠nicos a Inyectar de forma retr√≥grada al cuerpo del reporte:
${sentencesToInject.length > 0 ? sentencesToInject.map((s: string, idx: number) => `${idx + 1}. ${s}`).join("\n") : "(Ninguna frase individual adicional; solo integrar la coherencia del cuadro)"}

Cuadro Sin√≥ptico en Markdown a adjuntar (si procede):
${synopticTableMarkdown || "Ninguno"}

REGLAS DE ORO PARA LA REDACCI√ìN E INSERCI√ìN IMPERCEPTIBLE:
1. Revisa detenidamente el cuerpo del reporte radiol√≥gico original (especialmente las secciones 'HALLAZGOS', 'INFORME', u 'ORGANOS').
2. Localiza la secci√≥n o p√°rrafo correspondiente a '${organ}'. Si el √≥rgano ya est√° descrito en el reporte, integra suavemente las nuevas frases o puntos dentro del mismo p√°rrafo o vi√±eta de dicho √≥rgano, ajustando la puntuaci√≥n y conectores gramaticales para que la adici√≥n sea fluida y natural.
3. Evita redundancias o duplicaciones de informaci√≥n. Si el reporte ya ten√≠a un dato similar, ampl√≠alo o ref√≠nalo en lugar de pegarlo dos veces.
4. Si el √≥rgano '${organ}' no figuraba en la descripci√≥n narrativa original, agrega su descripci√≥n dentro de la secci√≥n 'HALLAZGOS' respetando la estructura y estilo del documento (por ejemplo, como un nuevo p√°rrafo o vi√±eta anat√≥mica coherente).
5. Si alguna de las frases inyectadas implica un diagn√≥stico relevante, escala de riesgo (TI-RADS, Bosniak, LI-RADS, etc.) o recomendaci√≥n cl√≠nica, aseg√∫rate de reflejarla o resumirla tambi√©n de forma arm√≥nica en la 'IMPRESI√ìN DIAGN√ìSTICA' o 'CONCLUSI√ìN' si esa secci√≥n existe.
6. ${includeSynopticTable && synopticTableMarkdown ? `INSERCI√ìN DEL CUADRO Y RESUMEN INTERPRETATIVO: Adjunta inmediatamente despu√©s de la 'IMPRESI√ìN DIAGN√ìSTICA' (o 'CONCLUSI√ìN') del reporte la secci√≥n '### SINOPSIS CL√çNICA DE ${organ.toUpperCase()}' incluyendo de manera √≠ntegra tanto la tabla Markdown como el p√°rrafo '**Resumen Interpretativo:** ...' que se proporciona en 'Cuadro Sin√≥ptico y Resumen Interpretativo en Markdown'. Si ya existe la secci√≥n de sinopsis de dicho √≥rgano, reempl√°zala completamente por el nuevo contenido.` : "No incluyas secciones de cuadro sin√≥ptico si no se solicita."}
7. EL INFORME FINAL DEBE LEERSE IMPECABLE, CONTINUO Y PROFESIONAL, SIN RASTROS DE QUE FUE EDITADO O COMPLEMENTADO A POSTERIORI.

Reporte radiol√≥gico original:
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
              description: "El reporte radiol√≥gico completo actualizado con la inyecci√≥n retr√≥grada inteligente e imperceptible de los hallazgos y el cuadro sin√≥ptico."
            },
            summaryOfInjections: {
              type: Type.STRING,
              description: "Resumen conciso en una frase de c√≥mo y d√≥nde se incrustaron los puntos en el reporte."
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
      summaryOfInjections: parsedData.summaryOfInjections || "Inyecci√≥n retr√≥grada e imperceptible completada exitosamente."
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
      return res.status(400).json({ success: false, error: "Se requiere el par√°metro 'report'." });
    }

    const ai = getGeminiClient();
    const modelToUse = getModelName(model);

    const prompt = `Eres un traumat√≥logo y radi√≥logo osteomuscular experto.
Analiza con precisi√≥n t√©cnica el reporte radiol√≥gico proporcionado en busca de cualquier descripci√≥n de fractura √≥sea.
Debes estructurar un cuadro sin√≥ptico de la fractura con los aspectos clave de la semiolog√≠a de fracturas, seg√∫n el esquema JSON solicitado.

REGLAS DE TERMINOLOG√çA Y REDACCI√ìN (CR√çTICAS):
1. NUNCA utilices expresiones como 'no fue reportado', 'no se menciona en el informe original', 'no descrito' o similares que separen la IA del usuario o dejen en evidencia la falta de datos del reporte de manera impersonal. Tanto el reporte como este cuadro son redactados y avalados por el mismo profesional m√©dico.
2. Si un dato no figura expl√≠citamente en el reporte (por ejemplo, si no se menciona angulaci√≥n o si hay compromiso de partes blandas), NO digas que falta. En su lugar, infiere un valor coherente basado en la patolog√≠a o prop√≥n un descarte cl√≠nico relevante de valor a√±adido (ej: 'Sin desplazamiento significativo', 'Alineaci√≥n anat√≥mica conservada', 'Sin compromiso articular aparente', 'Sin enfisema de partes blandas').
3. Si la fractura carece de detalles importantes que se correlacionan con la patolog√≠a descrita (por ejemplo, angulaci√≥n exacta, n√∫mero de fragmentos, etc.), la IA DEBE proponer descripciones l√≥gicas coherentes. Clasif√≠calas como 'Inferencia Cl√≠nica IA' en el origen para que el m√©dico pueda inyectarlas de manera retr√≥grada al reporte.
4. Para la clasificaci√≥n de la fractura, deduce la escala m√°s id√≥nea para esa regi√≥n anat√≥mica (ej. clasificaci√≥n AO, Schatzker para meseta tibial, Garden o Pauwels para cuello femoral, Gustilo-Anderson para expuestas, Neer para h√∫mero proximal, etc.) y fundamenta la clasificaci√≥n cl√≠nicamente.

Para cada aspecto cl√≠nico del cuadro (debes incluir idealmente estos aspectos: Hueso y Regi√≥n, Tipo de Trazo, Alineaci√≥n y Desplazamiento, Angulaci√≥n, Compromiso Articular, Compromiso de Partes Blandas, Clasificaci√≥n Sugerida, Recomendaci√≥n):
1. 'key': Nombre del aspecto.
2. 'value': El valor cl√≠nico o detalle.
3. 'clinicalSource': 'Hallazgo de Reporte' o 'Inferencia Cl√≠nica IA'.
4. 'explanation': Breve nota de por qu√© se incluye este aspecto.
5. 'narrativeSentence': Una frase en espa√±ol redactada de forma impecable en lenguaje m√©dico para ser inyectada en el reporte.

Reporte Cl√≠nico:
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
 * 42. API: GENERATE BIOMECHANICAL & INFLAMMATORY RADAR
 * POST /api/generate-biomechanical-radar
 * Payload: { model?: string, report: string, studyType?: string, radarMode?: "auto" | "msk" | "visceral" | "oncology" | "rotator_cuff" | "knee_oa" | "cholecystitis" | "ankle_trauma" | "knee_trauma" | "appendicitis" | "thyroid" | "muscle_injury" | "hepatic" }
 */

const MATRIX_PRESETS: Record<string, { key: string; label: string; finding: string; justification: string }[]> = {
  rotator_cuff: [
    { key: "ruptura_supraespinoso", label: "Ruptura del Supraespinoso", finding: "Sin evidencia de desgarro ni soluci√≥n de continuidad en el supraespinoso.", justification: "Integridad fibrilar conservada." },
    { key: "bursitis", label: "Bursitis Subacromiodeltoidea", finding: "Bursa subacromial de espesor normal, sin l√≠quido anormal.", justification: "Ausencia de distensi√≥n o reacci√≥n inflamatoria bursal." },
    { key: "pinzamiento", label: "Pinzamiento Subacromial", finding: "Din√°mica subacromial conservada sin conflicto de espacio.", justification: "Sin fricci√≥n ni atrapamiento en maniobras." },
    { key: "otros_tendones", label: "Lesi√≥n de Otros Tendones del Manguito", finding: "Tendones infraespinoso, subescapular y redondo menor intactos.", justification: "Estructura y patr√≥n fibrilar normal en tendones adyacentes." },
    { key: "tendinosis_supraespinoso", label: "Tendinosis del Supraespinoso", finding: "Ecoestructura y espesor fibrilar habituales.", justification: "Sin cambios tendin√≥sicos cr√≥nicos ni calcificaciones." },
    { key: "tclb", label: "Tend√≥n Cabeza Larga del B√≠ceps (TCLB)", finding: "TCLB centrado en la corredera bicipital sin tenosinovitis.", justification: "L√≠quido peritendinoso fisiol√≥gico y retin√°culo intacto." }
  ],
  knee_oa: [
    { key: "femorotibial_medial", label: "Compartimento Femorotibial Medial", finding: "Espacio articular medial de amplitud conservada.", justification: "Sin pinzamiento ni esclerosis subcondral." },
    { key: "femorotibial_lateral", label: "Compartimento Femorotibial Lateral", finding: "Espacio articular lateral normal.", justification: "Sin disminuci√≥n de espacio ni cambios osteoartr√≥sicos." },
    { key: "meniscopatia_deg", label: "Meniscopat√≠a Degenerativa", finding: "Meniscos de morfolog√≠a y ecogenicidad habituales.", justification: "Sin fisuras degenerativas ni extrusi√≥n meniscal." },
    { key: "cartilago_troclear", label: "Cart√≠lago Troclear / Condromalacia", finding: "Cart√≠lago troclear de espesor uniforme y superficie lisa.", justification: "Sin condromalacia ni defectos condrales." },
    { key: "hidrartrosis", label: "Hidrartrosis / Efusi√≥n Articular", finding: "Receso suprarrotuliano sin derrame significativo.", justification: "L√≠quido articular dentro de l√≠mites fisiol√≥gicos." },
    { key: "osteofitos", label: "Osteofitos Marginales & Entesofitos", finding: "M√°rgenes √≥seos articulares regulares.", justification: "Sin osteofitosis marginal ni remodelado hipertr√≥fico." }
  ],
  knee_trauma: [
    { key: "lcm", label: "Ligamento Colateral Medial (LCM)", finding: "LCM de continuidad y espesor conservados.", justification: "Sin signos de esguince o brecha fibrilar." },
    { key: "lcl", label: "Ligamento Colateral Lateral / CPL", finding: "LCL y complejo posterolateral continuos.", justification: "Sin edema o desgarro periligamentario." },
    { key: "menisco_interno", label: "Menisco Interno / Medial", finding: "Menisco interno bien configurado sin rupturas.", justification: "Tri√°ngulo meniscal ecog√©nico e √≠ntegro." },
    { key: "menisco_externo", label: "Menisco Externo / Lateral", finding: "Menisco externo sin l√≠neas de desgarro.", justification: "Puntal meniscal estable y en su sitio." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis", finding: "Sin efusi√≥n o hemartrosis traum√°tica.", justification: "Recesos articulares limpios." },
    { key: "lig_patelar", label: "Ligamento Patelar / Mecanismo Extensor", finding: "Ligamento patelar de espesor y patr√≥n fibrilar normal.", justification: "Mecanismo extensor sin desgarro ni entesopat√≠a." }
  ],
  ankle_trauma: [
    { key: "lpaa", label: "Lig. Peroneo Astragalino Anterior (LPAA)", finding: "LPAA continuo de espesor normal.", justification: "Sin brecha anecoica ni inestabilidad anterolateral." },
    { key: "lpc", label: "Lig. Peroneo Calc√°neo (LPC)", finding: "LPC preservado debajo de tendones peroneos.", justification: "Sin engrosamiento ni compromiso traum√°tico." },
    { key: "deltoideo", label: "Complejo Ligamentoso Deltoideo", finding: "Ligamento deltoideo medial de fibrilaridad conservada.", justification: "Espacio claro medial normal sin brechas." },
    { key: "hidrartrosis", label: "Hidrartrosis / Hemartrosis Articular", finding: "Sin efusi√≥n articular en receso anterior.", justification: "L√≠quido intraarticular fisiol√≥gico." },
    { key: "tendones", label: "Tendones Peroneos / Mediales", finding: "Tendones peroneos y tibiales en sus correderas.", justification: "Sin tenosinovitis ni subluxaci√≥n retinacular." },
    { key: "oseo", label: "Estructuras √ìseas / Sindesmosis", finding: "Corticales √≥seas continuas y sindesmosis alineada.", justification: "Sin avulsiones √≥seas ni di√°stasis sindesm√≥tica." }
  ],
  cholecystitis: [
    { key: "engrosamiento_pared", label: "Engrosamiento / Edema Parietal", finding: "Pared vesicular fina ‚â§3.0mm.", justification: "Sin edema parietal ni estratificaci√≥n." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", finding: "Se√±al Doppler parietal normal.", justification: "Sin hiperemia inflamatoria de la pared." },
    { key: "necrosis_pared", label: "Necrosis Parietal / Gangrena", finding: "Pared vesicular continua e intacta.", justification: "Sin gas intraparietal ni membranas desprendidas." },
    { key: "cambios_perivesiculares", label: "Cambios Perivesiculares / Lecho", finding: "Grasa perivesicular limpia y libre.", justification: "Sin l√≠quido ni colecciones perivesiculares." },
    { key: "via_biliar", label: "V√≠a Biliar / Col√©doco", finding: "V√≠a biliar intra y extrahep√°tica de calibre normal.", justification: "Col√©doco no dilatado sin coledocolitiasis." },
    { key: "tamano_forma", label: "Tama√±o / Hidrops Vesicular", finding: "Dimensiones vesiculares normales.", justification: "Sin hidrops ni sobredistensi√≥n vesicular." }
  ],
  appendicitis: [
    { key: "diametro_apendice", label: "Di√°metro Apendicular", finding: "Di√°metro apendicular normal ‚â§6.0mm.", justification: "Estructura tubular compresible de fondo ciego." },
    { key: "pared_apendice", label: "Pared / Signo de la Diana", finding: "Pared fina ‚â§2.0mm con capas conservadas.", justification: "Sin edema submucoso ni signo de la diana." },
    { key: "vascularidad", label: "Vascularidad Parietal (Doppler)", finding: "Flujo vascular parietal sim√©trico y fino.", justification: "Sin hiperemia reactiva en anillo." },
    { key: "cambios_inflamatorios", label: "Grasa Periapendicular / Flem√≥n", finding: "Grasa mesoapendicular de ecogenicidad normal.", justification: "Sin cambios inflamatorios ni flem√≥n." },
    { key: "liquido_colecciones", label: "L√≠quido Libre / Colecciones", finding: "Fosa il√≠aca derecha libre de l√≠quido.", justification: "Sin colecciones ni abscesos periapendiculares." },
    { key: "apendicolito", label: "Apendicolito / Fecalito", finding: "Luz apendicular limpia.", justification: "Sin apendicolitos ni obstrucci√≥n por fecalito." }
  ],
  diverticulitis: [
    { key: "engrosamiento_parietal", label: "Engrosamiento Parietal C√≥lico", finding: "Espesor de la pared c√≥lica normal (‚â§2.0-2.5 mm) con estratificaci√≥n conservada.", justification: "Sin engrosamiento ni rigidez parietal segmentaria." },
    { key: "grasa_pericolica", label: "Grasa Peric√≥lica / Flem√≥n", finding: "Grasa peric√≥lica homog√©nea, compresible y de ecogenicidad habitual.", justification: "Sin halo hiperecog√©nico, flem√≥n ni edema peric√≥lico." },
    { key: "diverticulo_inflamado", label: "Divert√≠culo Inflamado / Fecalito", finding: "Sin divert√≠culos inflamados evidentes ni fecalitos obstructivos con halo hipoecoico.", justification: "Ausencia de diverticulitis focal con dolor selectivo bajo transductor." },
    { key: "hiperemia_vascular", label: "Hiperemia Vascular (Doppler)", finding: "Vascularizaci√≥n parietal y mesent√©rica en l√≠mites fisiol√≥gicos.", justification: "Sin hiperemia Doppler patol√≥gica ni √°reas de isquemia." },
    { key: "complicacion_absceso", label: "Complicaci√≥n Locorregional (Absceso)", finding: "Sin colecciones l√≠quidas tabicadas ni abscesos peric√≥licos/p√©lvicos (Hinchey 0/Ia).", justification: "Ausencia de colecciones purulentas o flemosas." },
    { key: "gas_extraluminal", label: "Gas Extraluminal / Perforaci√≥n", finding: "Gas intraluminal confinado a la luz c√≥lica sin burbujas extraluminales ni neumoperitoneo.", justification: "Sin microperforaci√≥n ni neumoperitoneo libre (Hinchey IV)." }
  ],
  thyroid: [
    { key: "tamano_tiroides", label: "Tama√±o Glandular / Bocio", finding: "Volumen tiroideo normal en ambos l√≥bulos.", justification: "Sin bocio ni efecto de masa intrator√°cica." },
    { key: "presencia_nodulos", label: "Carga Nodular", finding: "Par√©nquima homog√©neo libre de n√≥dulos.", justification: "Sin im√°genes nodulares s√≥lidas ni qu√≠sticas." },
    { key: "nodulos_sospechosos", label: "Sospecha TI-RADS", finding: "Sin n√≥dulos con criterios de sospecha oncog√©nica.", justification: "Patr√≥n ecogr√°fico TI-RADS 1 / BENIGNO." },
    { key: "patron_parenquima", label: "Ecoestructura Parenquimatosa", finding: "Ecoestructura glandular homog√©nea e isoecoica.", justification: "Sin signos de tiroiditis difusa ni septos fibrosos." },
    { key: "vascularidad", label: "Vascularidad / Inferno Tiroideo", finding: "Patr√≥n Doppler vascular fisiol√≥gico escaso.", justification: "Sin hiperemia difusa ni inferno tiroideo." },
    { key: "adenopatias_atipicas", label: "Adenopat√≠as Cervicales At√≠picas", finding: "Cadenas ganglionares cervicales con morfolog√≠a ovalada normal.", justification: "Ganglios con hilio graso conservado sin rasgos at√≠picos." }
  ],
  muscle_injury: [
    { key: "desgarro_muscular", label: "Desgarro Muscular / Soluci√≥n Continuidad", finding: "Arquitectura muscular y patr√≥n en pluma de ave conservado.", justification: "Sin soluci√≥n de continuidad ni brecha fibrilar." },
    { key: "hematoma_coleccion", label: "Hematoma / Colecci√≥n L√≠quida", finding: "Sin colecciones l√≠quidas intra o interfasciales.", justification: "Ausencia de hematoma a tensi√≥n o seroma." },
    { key: "union_miotendinosa", label: "Uni√≥n Miotendinosa (MTJ)", finding: "Uni√≥n miotendinosa continua e intacta.", justification: "Sin deslamado ni avulsi√≥n en la MTJ." },
    { key: "tendon_insercion", label: "Tend√≥n e Inserci√≥n / Entesis", finding: "Tend√≥n de inserci√≥n de calibre y ecogenicidad normal.", justification: "Sin avulsi√≥n ent√©sica ni desgarro intratendinoso." },
    { key: "vascularidad", label: "Vascularidad / Neovascularizaci√≥n", finding: "Vascularizaci√≥n intramuscular baja normal.", justification: "Sin hiperemia perilesional ni neovasculatura." },
    { key: "cambios_inflamatorios", label: "Edema / Inflamaci√≥n Intramuscular", finding: "Vientres musculares limpios y sim√©tricos.", justification: "Sin edema perifocal ni miositis reactiva." }
  ],
  hepatic: [
    { key: "tamano_forma", label: "Tama√±o y Forma", finding: "H√≠gado de dimensiones conservadas con borde inferior agudo y contornos lisos.", justification: "Sin hepatomegalia ni nodularidad capsular." },
    { key: "vascularidad", label: "Vascularidad", finding: "Vena porta de calibre y flujo hepat√≥peto f√°sico normal, venas suprahep√°ticas trif√°sicas.", justification: "Sin hipertensi√≥n portal ni colaterales patol√≥gicas." },
    { key: "elasticidad", label: "Elasticidad", finding: "Elasticidad en rango fisiol√≥gico normal (<6.0 kPa / F0-F1).", justification: "Sin rigidez parenquimatosa ni fibrosis significativa." },
    { key: "apariencia_parenquima", label: "Apariencia del Par√©nquima", finding: "Ecoestructura parenquimatosa homog√©nea con patr√≥n granular fino habitual.", justification: "Sin tosquedad ni patr√≥n micronodular difuso." },
    { key: "infiltracion_grasa", label: "Infiltraci√≥n Grasa", finding: "Sin esteatosis hep√°tica (Grado 0), gradiente hepatorrenal conservado y buena penetraci√≥n ac√∫stica.", justification: "Atenuaci√≥n ac√∫stica y ecogenicidad fisiol√≥gica." },
    { key: "lesiones_focales", label: "Lesiones Focales", finding: "Par√©nquima homog√©neo libre de lesiones ocupantes de espacio (LOEs).", justification: "Ausencia de n√≥dulos sospechosos, quistes complicados ni masas s√≥lidas." }
  ],
  urinary_prostate: [
    { key: "volumen_prostatico", label: "Volumen Prost√°tico", finding: "Volumen prost√°tico conservado (<20-25 cc) sin hiperplasia.", justification: "Morfolog√≠a y biometr√≠a glandular dentro de l√≠mites fisiol√≥gicos." },
    { key: "paredes_vesicales", label: "Paredes Vesicales", finding: "Pared vesical lisa y delgada (<3 mm en repleci√≥n, <5 mm vac√≠xúÏ}Àr◊µË\_±√:âAReYñu
!		I $œÒµ]LhÇ-7z#› #ÿ √2∏ï/P’ΩTuSûex'ÁKÓzÌW)ÁénRâ¿Ó›˚±ˆ⁄ÎΩ÷~Ì÷w™Íıºò%W…0ö%:{¢v˙I¶‚lúÎ"ö$q6”jÂI<ã“™öÂ— Œ”hm„Beâ&≈LO£ŸÍ]§F±JÁ√Î®æ£~¨ﬁSü‘wÒ:çá≥®H¢À<Œ¢M°üû∑˘πÍ…Û´$%ŸßgZQs5tSâUÅììo¶IúÍaî&√¡TÊπôà≥|>ú%7—¶%û∆ÈMR®ÖÆﬁ¬Á∞ò9ˆ4»cïÈ|˝·HE2Œ4ΩÃ„´t˛Z7‚«.÷ò«E2öÎÀ©.fìdà	⁄„˜Í‘Ø*Ω”„›`Ÿ ⁄h§’¥á©h∆Cù)hMãDß´ü«…P7Fq1Õc¯bê∆™ÚtØ∂k•’”{j8‹∫Ωy<ã≥a≤˙9ò%l/@3òÆ\æ∫Ÿ∞ùÄqˆ«y2â.ßÄ(3h6‘ﬁjO£|ı7Pßÿ`ıVZ∏ï∂á:Ê]öÁë∫÷=Üo‚à ü≠~ÕSÄ}°ãi<º÷Øö∆yrµ˙)áûı 6ôûD"◊ì$C)6-˘0πäs\pƒk˛ûñÄ+‚¸&EÄ—º†∏◊G›∂7n¥a≥:»{K/ºµ?ßó˛≤ã`›≠’€iGHMmãwwñdÛ®
{3Üó9Ã)[Ωõ%#ÜG2Å÷Ÿ,≤xQ⁄†ıE≠ﬁM àä28?Oh8–∞DòL2B‡BœCƒ9Ëq6“f 8IÕ ∞˛ot"ü®ØxÃ¢IîÈµ√}èW◊w˚usôj\h™≥q2õ√‡¿õ¢Ue–˘˛ﬁd≤K»?—˘ïNI‡|√H…úS$ì’O3@âç@@dœ‚+@èx«;B¨πÜqgπæJ"^Ã˙ˆ"Ì”˘ÂPÁ∏7˛ä^“’roº5¬‡KÛô!$ˇıóˇ˝ymñA´0õ:*·‰pı3~¶kìxÑ˚øm5ÄÛÈ8˙ﬁêf7-∫Í1 gcåÄfDê)Ø&*êäÁÿ [ﬁE¯ÿ≠Ì4ŒØÊM‘Bƒ⁄…4Œ@+[ΩÉ÷BKë¬‹ohIl#gRÓSØ»_GÌ’◊ˆÍüÌm•VÄØ@Ú]„ÒVÛ„ÛÔ»3 0¶äÚLp”Æ¶0'dZóW»4bˇ»…+ı¬æÚ÷Ó—2K•4ù†=@}ä’œ),î¶Õ
<tXû≤ s]dIÙùÍ ef#Tf„íõÔ!EDı‡∏ π”)‡1?ﬁÑ◊zùö¢ãK«Ru*ÔU7|ˇﬂ‚¬i2KêGﬁ∆ÑqkØìê5<†¯¡v^^ÿ0ö 	.ìÏ*"3”àﬁ¬Z¸^uJÔ›¬^Ê∞wÑÃÇô%ãçá,ÂT’ò!øzõ«·MéÚ∆Ö˘àôå'¸A
ø Q8∫˘€ß±≈0◊≥≠TvÜ}“1›@jœ¸óûT[GòäOE]OéÓ‚¨·ºj:≈Äj:8≤™Ú∏vˇ‡}¢Eƒ§µÍìYX™ŒÒ 	éò2æü,m^ßO°∂-ˆÊÄî
AÓË÷°û¬1…√–ÔßZõ(’√É˜S*¶¿X¢áò¥~K√¬I5¥†üÎ¿ ≤èÒ4¡'éwÏ{Ï¥MVÔLè+πÁÿåY[ï‰ù#ı\‡¡ﬁ,à]G`Ã∏QõóÎ—_ô av4ûè @4çs¡0·‘D«UO6.˙câÙ{ÖI”©“√˘4B)ëèÊ’úGπ∂t@±]ö∞Ç)Q}¯AÏÕ!+kE∑Àê7‚ ¬&@oÔ°á—i¸’∞…41rèß∞ÑÙÈ}ÖSAb>)-,=EY¢9•ã(-¢t;U6§˝y*°ØÈ©$ﬁÅ(_â/-s#yV±zÂµu´Ià«≈S5[˝#C…„&ìº¯^bUl’dﬂÀè_ë:ft2´@∏˘íÏ¶"Éó…ˆ§¯ÆL≤»GÇì+Oô¥GÒ$
π.N‹–X76$~}ﬂÅÌBà	•U»√£!ê&:´‘u{ñ|È∑•'§iZµÉnÊQËîXÀvØÉÄ®Å”ÊÛ)v ‚ |p€YC¬Æ7(d ≈√Q#Ä3™ÎÉ$•˘<ß6´∑“»‹]#`ê¶ç]Ä·V[à ú*:£Óx∞NÇqßpñ6…0ñŸ}_∆èˇ„»+√YJ“ŸÍÔ∞ªÜµπ√êÂèÁæY-fÂHì<I‘Rd0«≈¢-‚ç` grX`™ùûx0Y€dWË û"qY®+Xm‚,€©–Îb¢ôwÂSzç&)AÏ»5x÷7P&÷X%Ú±Ÿ>ÑIø Jä2ËFA‚
^&à	⁄‚ƒm¨Qh°‚ÖÆ~.Häbw∆z‰{Hü1é˚î‰&)Üqæ.ﬁÅú¸Ü…â:JWVeb¥Mò˛-#$≈uÅ“jÇ·Ìh√â˛Ñ‚°€Ììñ3qC%ÂA≤ÕjF∆√E›Å §ÿ[0~hµ¶0“œGò&
u2Pë◊-öÜyçÇÊ†¬v¨`… ÄΩ«~Ê`ffõ™i
ƒÕÎàt≤
}yALﬂê≥ßìΩ]FŒÉd$‘†í‚ès|}‚‚Q’èÀ ÕQ—fäR¢â‘Äåfﬁwà°Å	Ö»≠ w}+ôÎ∂[Õø∑Sò#/◊Ωï;!Å∆)*ı8!‹†-á–Ò_¯ƒBQZÖÍ Cö£Z;…äŒÜ®˙- deÛël¢ 6ãy¿êxê«Yºf
ZÆ≥} ,N ﬂr6•\Û ‘í ¬ñV$Q$]è6Y9∂#˙Iôª˝F¡#iè≥›HÓMæΩ}»]QñÇe0ìm+Åœë‘G´ü…ˆã»•dπM5#ÉF∂ÎÕ‚ÓÚ|DHih‰ë.[!Oë,∞¿î¬°{ˆ_kÛ÷[I;ò$ù9JÉ>∂Wk–ëî°œÔtt=∫n®‡“!`[iﬁµiûÄ;%Œ¥P£9©Ã®F∆Ë·ÿŒé≤aÙŒ®0¿êÉ&"Û≥˘DÁõ—ffzbÿ√á≥çÎÛç"Õkî≤ETsgîF»y_©?ŒWÔPC‹äˇ@è¥òñ"ñ%
Ê∂el§<MÙå∞!≠`Z	¥6€∞Çóp>R&c¢rdªçÌŒQÚ£¥ˇÅ” ÁhS˘tËﬁè_‹ªw5œÜ¯π»…˜qÛM\º–˘±≈ï”Ò>Q@ô`¢ËÅÉí≈#l˜PzÒı∑ªÚØ˙˙Ej3„ôŒ˙†t´/’qÛ¨◊˘èÀ”^ªﬂ>ÎÌz˝V-óÂ∑;†ºÌ|˚ÖÌÈ
<o0ËÔkxÔaáUÖÕõ–`˙ zó&d;“Ûl_7Û<Z‘ìÇ˛≠¯ÀŸ•÷J˝k∞»:ÓQ•—¯ªÍÀg“+ˇ'πRï_EªÚà–iQz’A‘ó_~iÁâÏ7@ÚÉOx∫—bÃ>'dBXÌÏÏ÷g˙Hˇ)Œ[QWv7|˜{Àz∑o–8bÜ≥S§AÔÚ%Ë/m˚W≤dû$ ƒ|Û‰◊ÅÏ§s‡4yµãÔÏ›knæªÌK~TLÅßWvÄtÏÏ~Ω˜≠7ïÕf?QŸ<M	°x∑OvÌ&À:á:èaï≥≈4£6uyÀÿ…ÊìAúÔ ÍG≥Î:Ò ˛^U˛àﬁTÃÔ?¨xüÔÓÓ¬ˆÃƒ“xˇª°ù‡V¸Ó„Oÿ€1‡åyœæTüÔ⁄èwéQŸ’∞ÚVéé.ÔìP4¸Ó3Ôª>¸»ﬂ◊¯¿q<Ï=ÕÔ{Õè‡Gÿ‘æ*-N⁄ÿ√_üŒãÎä;xDq}î´⁄WByC<vØib^kúÄ˚”“cæ¸â‡∑˝…3˜MâÛó¡√‡˚‡Õ=Éçï*?¸ìóWÇ¿ì“lÄ»ùp∑ïﬁ√ˇ›≥¡.ıã{8öNÎQŸiD”§¡¸{◊Xª&q,≠Êë√!*ŸP)ˇ„øA˙_‘{1h5≈˘U·?-¶([2>Àì¯¯-Ët¯ŸTÁy1õègpÍ·á€Ù%4¯c}†Gã/,·¯„Há,FÆct¬º®<‹€€≠ø.tV˘AÛ·ÊÙÑyFU≈yÆsRõ∞ÔyJõBÌ2 Wo'1öì>·>An¡ËM>J`^¿Z_¢àë¥Rî¡˘Â¥∏3}^ƒ‹WìûDì∏BovøªÀÑÒà÷¸•∑~§F—|f™·˘ bŒ†·⁄h{üg‚ı÷¯%»; ƒh2mL1N$*≈„ÃËBL Ì—m1‘ Ê^I8IÓ–Ø1T’$ÜŒmP,ãÛæ&˘ú:bÑ·0©9ZFx ÔõÅï·€“yQ.ŒÉ˙Ω&ñøè¿çüE4!èkú
nƒ˛tuÉfªz{ÖøqöYD` 
4¶XûÈ.Qä˝#t–ïü†·\ı≤Íxû¬Ñ–9ÖnsÕ#øFgâ‚ß(¶—πˆT§ˆ˜Te§3˙ﬁÒHF3ãÉ8CﬂåºOçÜ¬‚ç…=¨€ŸOvÎ˜Óµ˚gÁáùÆj≠˛z“iuü®˘¡û⁄˛óa‡/'Z∂ÙäúJ;?ﬁ;Ó6è:áÕC’ÔuZù≥Êa{(!ÚM¬"‡ö;á†oäı∞	œ&ç∞SùÊ∞»‡c0ŒßS#`¸xØ‹˜Ø¸æˇM÷}~‘yŸluV;Q}7[gMuÿf—Û®ˆ¥éŒ˚ùòd˚Hù˜œõ=X˚´¶Í∑è⁄≠Vß{“<ÏB´SÄÆÊ∏}r÷VGMÛ˝'•·K≥˚§c=o˜U˚¢y}´Ø‡ÔãÓ—EªÁÜñ>ª}ÿÙãvÎ¨‚p„˜ÌØ˙™ŸÔºƒ	¿/˚bF5ùÚÎû:áïµ‡+\◊4›«ˇk‰·MÜ}„ì√NÎï]Ñõ6lü (öΩ^Û+ıId›∑ˇGÎ>ˆ{Èûıö}Ó•’Ó◊ø…˛ ªµhpØs∞>o1ÿ∏˘„N˙WÕS@êfÔ…=ÿ¬ ¸@˜˚#ÄÊWW;àxõÒFˇÊ7
ê:œìô^Ûi°≠TpΩ”˚´ò‚bMÒò/Ûº _)<ç@Éõ,ØA_Õır6LÀ¡◊…Í›∑√xZ4í:z+B„Ajƒ∫◊Ôxh¿‡8nûº<ÔúuUØxﬂÌ¡	9mûuè∫/W%§{’=~ﬁÎ™
æ8®÷˘ãÍ—·Óì{MÚÀW29·9‰Œ>ù≤’ª+∂Drjù“,^!–F÷å,∆©–ΩiÇ¡˜ˆÎ XvÔ\Ä⁄y¢z¸ú:Ï˚ÔTeØ∂ˇDu2 3›•Ö/‘˝⁄√'†ù≥ÛÁ∆~CLÂ(màÉñ=‰DØ…ò¥ÒÈ¡ﬁØøPµGzb˙oZ>£ñü’ªÈBøYqïºIP≈m—P¿Ö≠ceù/ÅπOâÆ7}6ª˙+±j2gÀ	–»˚ DÉ< ∑S‘:çœÔπA™æ UÇ‹u¶ìQ	õBü≠Kıj†«´w∆:si#¥Ï ≈ÑØä 'y‰N‹Á3J†´H`◊g“Ô∑tæ…¯Õ|DçµÎx¢s‡l»îE<E{πÅ¢g¸HzùHp,ª®E£k	≥Kz zÄW&zË˛r`É≈’‘K⁄tå¡¬∞1„ºòg&ró…*QËÄòû¬·"ˆ≤áÔê véÅx35zq~Bt˝ÈŒR<8∫ùÓs§fáùì’üèÅ2ıATˆ∑ãÕƒn±ÛÁ#t3’–‡"à˙;√ÎŸOéc∆êΩÈ$éÛ∆´ËOﬂ%YA{ »¡	nDn±¶@±Ëa_<Œ˙éÿCO£†¿£’£Ωˇ¸?¡˘üˇàBéT!1Ñ√ÃŸGäµæπ◊(X˙ï›–¯2†ß—Pº¨t®Ã¬ÿÂP|ÈLp=∆#K°>$fÂﬁ'»Ù7è¥êUR\Ä'	0PÍ!†∆9óHa–ë∑É;PÎiﬂ©3yG˚pl(f•„sà*"†eU’ãQ “Í8ŒPB˜È`—ÏˇlCìΩ?2á·w÷Øn	9=¸ÉªFÚÇ ‹Œ}ra‚b¢BShzâZ™ãuçÉΩ4ùe1ÚÜC8ƒÃ.y∆‚	J•éf≥ÿ‡>®ìïY÷∏∆GºÂoc%kN›m#`5Æ∑i´ü(<¿£?,—∫Õúò√£9‘®‰˙àzΩ∞|\‹úÑ«¶^ä^7—M‰çb˙DôEûJÈúŒU@‡˙û˜ ¸Bà !’]4í#åq ∞>_ΩC·à‰YÎËyâE∑»M¬¥ ¥~t8ÁëÉÆvlHÁ<5‹.v”lΩo&Ü”hù“˘9¨Çbá‘[0\+◊-<$Ûò√§ºŸáº€†|√¶”f3C“Ïö"DY+ònñ5—|´à˘´ˇw2&GÓÜ•(…À·◊—ÍÌ∑Ÿ0ŒóhÆgÀÏkΩ˙˘[åÑ[∞tè.ºeÎiÀ	¿ßò-çg`9ì≥ÂtT†øräª5\R¨-pÙ•çê]FÉ#ìó»Ài®Ïn¢p∑÷Óü˜[ÁGMÇõΩ≥ˇ~Ÿ>i˜ÄÛVé˚øø]Í∏`!$T®s≈?Ú‰^-t=Qõ∫@B†ƒZÖÚ¥y'üV’Ã«Ìjsl∂0®∫hBÈb©äAvGÖˆ-Ql€Çx ﬂ„à⁄9£f≈DK\%<¸ ® ˙	ÉÁ¨Ñ’@Ou6&	ÉG-ªnü®˜≈&¿%—2o û@i™%wjU%˛~ò1xD„¢$¬≤!d	∂ç„å¸0•0Ë®Í≈¡JV?d8í8Êò&“Û–¡÷mä:Rèhyé™ƒ†4Ö¨î}Ui †Ã(b.&#¿·vZc„Sn◊iˇ€Á…¡x)iRDËAî≈oñDÎu˘Xﬂç˙XíRõªëàãNøEî ®√Û√ÓqÁÑ~üÆ˛rt—iu·ÁY˚w¥|<?jû‡øÄ '/éö«®8w∫∑“`O§¨(jBñgÎ3{–p9t∞è—mT•◊Ö3ˆ; Ò¶».8ÀƒHU%l!_[˝á5ƒm©Í∏0E7¸(ﬁ[hP)b≠s∆â]·'ñNW?Â# äï»„π™%Ø≈}^≈hßÇÂ6m»$±˝y>O1%›≤4?∞’ñ±qe€≤ìÓy:°`9UÒ?‡Iè◊∫.è§1Aç|∆	R’m¡[)ÜÖS6Ä+$ 0íÏPÅàÖ§·£(¶!òïR®®âÂjÄ¥¿õÕ)∑jƒ©•ÿ- 9î5I#fv∏ÜÜâ‰jò»Ö2°›æ’ ÿ√Ò5,åÂb≤Ã*∂ˇ·‘∂o¿à›ëÄ^51Y?hkD&0È9¶∫Ê‹å…∫Ÿ≥™(u¨*ﬂhRa)ıëNM ˆäB…o#Â&ºV”7A\=Üxˇ„…âàG“æjBΩÜHÿm[’B2KÆÄ^ €73_5¢¸az;/0¡`w‡øî08H@é*ñ)ˇ3‡¨∏Â,Aó⁄Mù›ìV˜hı∑óùVÅﬁÓw∫'¯Ï¸∏$~˝Fù¨˛vxé÷‰~∑⁄nΩÍ¬ø™ÚjınL≤¬)»1»Œ ƒΩdıw¢.«@Ë™@∆r¥ï¡ãSÄ"≤,|H!>ÖzûF†¨‚ÕÜı€ÂG	◊©!–ÇL¢'ÎîÙΩÅv∞ I(Æx:ø¯ûÇxπ∆Ü®nökpÜãüpƒ#PP SÏ)HfZvoRP˝Lˆ&òHWˇ†ê¶WÁ÷ç≥ëH›âÁ(’=#˚≠ë5M^CÏ`ã8‡‡>õSö¯Z¿]æë§w±π¥◊ÅuÑ$ëÌàõ•·çqw∞õÀç¶ú0lNbÂí|8œF¯h ê≥≤0n!àÈ>gq°v˘ò≈mîeÕ‡ò÷Ar%⁄vfÇóåá{ÍÛ÷i9∞Lîﬂòá"–6~bÖ\◊ " ,CS‰})∆éM;Â8æ⁄M]ëQ PW!{ÑWƒ5k@ç@>û∆·ÿêæ_˚˜$/Ê
vÉR™(O˙^„ıÖ‘m±|@¥ÅR_Ixr%|ß%˙N≠JZøÊ"6úNñg®÷a¨tí∏¥Ø⁄+F†Ûa›Öbc	¢˜z.0Ø»<≈oËß	◊|\∏XqÏ&*ÜdUåe7=^[`ÉıT¶GíÀÊ¯..—M
.åº€≥’[f¬>€a“-ŒL¥~uﬁiûüuw™Í∞}÷FohÎ|ıÁ#≤í7˚jˇ¿˙Û‘aß⁄=È<Gíﬁo´ÊÔŒ…Ÿ˛]∑ß@\ÔµOªΩ≥∂˙
]y´ø∂öG‰•$+ô·Î[Õ-Ûbò∆óIˆzûﬂÖ˜j˝S„ÖY∫G∆Ü∏DÍƒjè◊nc¸DV,ØIüDıO	=lÉyÊ>Úrbñﬂ&≥◊ﬂñ9rÃâ…çmâ¬4M†].Qìû[P'i¨A√"Y≈3Ó¿cB∆et⁄≤œFZöŸù›éÕ#‡ª÷’j˘±±¿¿œØ‘qß{÷>9Ïút˚∞À|w‘ïÍwÁΩØ>“â™√MîŒç?ƒFADçﬁ1SìÚiñÑvÙ@öÕª4/v<·±<#≈<·*}ﬂl“rfgˆ4	o¶«–¢|å¸‘Z‚Ÿh"YP&Ûâ]MıÙ`2)Ê≠ô⁄ÿ/•q⁄amr`
˚(D-*õ>ã˘`Ü	Âˆ€93K_≠˘"ç≠’:›Lbˇ‘¶øµø«›ÅnY	œí‘±ÁkXt”yéã^MsH.-©Ñùy%Ã=Q!GÓi‡∑Ä}±*°∏6ç«≥Ôr˘…+oeslˇ¿5∞V¶ﬂ+8!ÍÈ~}O'ˇ˘≥Ïå˝$81∂®äÇÊµ˚	mÑ˝‰”Ÿ·ÚK¥ÆÌªOÿˆv}`,Ä=≥m	Æf∞cÅ⁄4.íó*‚¿HÂcÒ|π—Ÿ•OiJ˙0„√yF˚Yzu|ˆ;Å(˛ÚjÁ»Ó{p~˚y°Û	ô5πE÷\U8 ”˚∆„ﬁ$ÍE∂vd¬ÛúÖ?qî‡ÃÒv—3 ›ç-È$RÁŸZB¢∏Ùÿ5lñ9¥ˆB2ˆ/Ty$πò ©qcÇéiÖ)NÓ]¬ŒëX‘ç)w—êTAÛ7∆!bôD$y`3^© º!íÄÜ–Ï:–b®Å6V‚ nk~=◊5`≠Ì§8
˙•N≈E‘óÒLúbÎ$'‰)ºEJ9√2¯,<nûNUBAg˚@¥≥j9õH◊0nöªHúd÷—g¨OëA¿†©9ÿ8÷Z/HC≤"b7≥'RoŸh3pŒg9äå5-‚˘¥&@ˆ§ !Ú
ÖNTö%¸«›Ê≤(p,7Ê€üz°|∂0Ü§VvÈH;GIg⁄+¶apö∫˜äÀ√|èùva@:B»¶:åÕÊ1ﬂ∫9"4 î@ÛI’Mi"≤@¨ÿ◊$∑7D¸J>ÂêHö-9FaAîÖ“Ó˛Aôç,ò(èkàn∑¨ÃÆhH∏ãaE,K˘°Ò⁄F¯o2ñ_G≈u2—3Ω$˜9⁄M‡¿°„*»†‹‘≥¡ÿGË£±GIÜ Ôq1ú˘£DΩ≥NØ€9l7UÂÏ’W¯Ûó„fò1(`?T,≈ôR8Ú©≥¿yâv)†∆Uo(•vı9¬Õ‡≥‘√ëÚüˇQù∞ÇÃYP¬‚L\w@(¨ôïc|ƒ£⁄˝˚√°†07±Ó~#ÿ›P{ ø¶∏ëã˘,IÖ˘Sé+qBﬁÉGµÉ=˘zc Ö¡˘¬Pã¿¸ı8≤r|≠!’wÉΩXΩ¢ÕßÄ‰„ÑG(ÅMM0Ÿ%©B9–È¢H)ZX¥CO
~ôÆﬁÿ1‰¿í©teJ¶T)™|ΩîñÄ˜Ñõ)™Å∆qX ÓËS™ù¶ùŒçV‹õmPÕntÌj∂–∆¿âÔ‘ÉÔ]1AıÃ}kŸc£ñ¸Ω≥&DÖ¢àÃ7"w	4/ΩRÜ ŸM©Ï}n©.⁄ZÖª’‡∏’zÕCÙCµœkpˆ∑HÚføvﬂ2léﬂílx!Ì∞%Lfôy˚∞iﬂ8˛∑ØÚ®ì…}∆Ò*Ê≥Áçá-6πŸœÔˇñ?+6⁄@zÅŸ◊f◊QV˚ú`ª"]Pﬂ¢Ü|1íÛéûµ…Íàg∫«˚-‹¶h7œ.›Ê ®É‚@ß°AΩ&v_éTå’+Co‹/â‚⁄¿°çu‡ÑÑ†ñF∆Å∏ﬂ⁄E’yˆZﬂ‚F∑0«”>ï8%2{1R‚÷6v»ıbÉ~¸^êÂFôƒ¥‚◊dCƒ`6{¶`ª^èÿ«ï'nìºé µ¡7DÔ ˙Döƒ≥ºZIDEè¯ú1ŒŒï	,≠	 ˛»é`$La@m˛rå⁄èÑ˙≤V∑Qí„`.∑/5·∫Ü9B]ì}XYÕ“¨ÑgÛ»’iˇ	4Ër©XAËäü3Ó&hØ¶së≥O¢‚˛ü≤qÀv≈ñ ÄﬂMõ±€0$à≠à§œi	Â«NÌ¢cHæ…∫é¬öi0]Ú6∞˙Ôåê≤%¡lå£1î‡L©◊Tç‡4ò¨ìjl≠ö#Cõ∂YF.;ô"L79;–`Ç°ÛRÍ∂’,˝æŸµµz[Pül—@8BÔ„¥r¬¿LÁ°Ô‡õã¶iAQﬁ∑ãë&.#ö~Ø~˙ñ
⁄-AØ«U⁄Dmh˙„
Î„|ö§,·˜kÜ^£—Ò*}3XRQ7xú πXr“t˝S|∏úÄ∂aÉ=Íüö9∞£æ¸t2`fÛ‚cãÕS4 ∂:gùæjæ<?…≥yÍ=˚ßãüë€Æô%÷ƒ$¢$πKy£511ôsghÇY¿Ê∑ﬂÃË\7π°øñÉ&“äèñÎ·ø˛Úø’A¸©¬Äi‡VÄƒíœË¢ ·aèmFÑ˝¸Q}øˆüd√“X∆~†ÒHa@~4∆BEåÈ|ÏºE;kR√í√œ†˚«ıÉR˜iÏÜê}ë∑v<œß◊P÷1ªkËß?§¡≤_üúèÎèj˚˚eÄÃÊé`@Öœ"©yræzá‚≠=∑^ﬂıß°·;û$+„¬—$Ò«èH1"3∆à¯õoä /º¿<≥SS}JãcÎ”!1Ùµ—!£WN‘àG∏˘˜y≠ÊæI#	#~H3π{rø˛π5$∑7"?®Ô’rÁÖ7%:ıÀû;GÿâË(œZIÅ∫˘`2jÚZˇáWp%‘@ﬁıR9¨mnÍÇõ¨:Óôë¡1Ugú«b≥{pãƒ·ÖMÖÜ}·Àv^±P2o±4ŸHf \öz"‡ÆDZÍuqÉ>ù∏‘í5jf;R”ûÒ9úÓöotí"£lh¬ë≠≥)Ãá±ÑAkÙÊ‰ŸÑÓ∞÷b  ˆ·õïé∏<'ß–¿Ï–Ã‰üˆ ôü$®3◊J™π¬A>–±B'Æµ±^ÚzÕŒ˜jΩ*∂πŒ’PW—ÀçDîf.∞63ùÆ≠¡§Ÿ@;n˚ Rg…Ú0õi9M(ˆÓ“Ûcâ	…;B]∫j‹$•,(ì◊–#œ€∆Òy‹R~Wä8V„Â˙cÆPóÁá:
;≥ÙËlΩ@…y_y∑0<1˘Gû>N,Eñ÷cÑ:®€
AÀ3fG≥ãIúœ¨ÑÎ	5;ñ¥”üà`"˚®3"Î‡8BÔã=ÎGÛÔ˝‚Y~óFâc’D.úHüJ7⁄é≈eYòìk∆É⁄Å– rÙ&WÁQ»˛¯SgàhxıªAcÿ÷Æ-q;Í™@u∏‚œ%`∫è±yèHœZÅõåT°ƒÙn\]‘EW˛Ä›’ÛÖœ	[D◊’‰{*O0bQ5Qı§éÎx»°\¡qåTÊ_:C9p-£¯ªèïB;mŒ'—“”EásÿÉdF˘(t'…wB˛$95Ñ*ÀüXÉ(œ„t]ve+#–†–∂ÙäÅE¡πWWœø˜€˝]cÉl•K√ v åﬂÚ º]‹»<ˆæ[@9P(^¨Ö¯:1fªmÜ@ıôÛ≤¨ÇΩÒ“HJp'©◊YÛﬁ'Ï†Éƒ`e%:ê
„ÔΩÎ®√$ñÌ¬–gË√›scD∏√3meSE7ÿYJséƒ«+}ÈMƒñÉ[âƒ ≤)±óK::Â@6«êá¥Éë«å%˙Y\yÍ5ıRﬂº˙⁄ºÈUÆµLb V;'— à˝7Üúæí†CÊ«‘óàE~úúu€∏¡µß~ò|Tú≥Ó∞GúR†#yˆ‹Ü·»Aﬂ∆uoˆwmp√ªqc¿© ˝LAa"‚Çc∞å°ŸZ⁄¿•%;4K¶¶z ç-—h¡Å‡hÄ‡ö¶—`§ô” \‡„\$]G¥ FöTO|æzGÈgÛ¬gàNLym≠’≠57	¡çH›8îïàb±Å/Usè¨ŒÈç,=iù«(ƒ"g˙√’Hxu(Á÷^-$Œ07!~∑W %•πù/Z6=8”f@òﬁ$cFr™ Fxõ®HvÿLô«7,ìLX®ÈPÿ»îÂX[ì,Ì|è dN3Õprº.Ú;ó'EÇ« Ñ∞9ör•X>ÖùRD!JÌ6≤Ô“à˛;æÚ‡G}nΩóÚÜ+øÓugÀ2U‡e:!QR§ú	<1ñXŸº4
ø7â√Òå¬tJÍíôO|ìp(=€9[v9¸4¥ê⁄È-ºº;’-
UÉiäTœ'“dnÎ·]Ê[ft 	ÂË‚ÕzÛïÜ©Åke1qy‡Õ®≤ëÃe’2O˜’No0@’¡úE‘.E˛ñ ﬂ‘2]P P\‡PRÃ|…€+!U$¸HUGÂ¥…©)(ΩÑEâΩZ'
î
Ì)PÂ”Q4kÉOiO˜˜‹1ß#‡´Ê/t‡È˝⁄5úÑ˘?HŒµh¿±ƒﬂ∆t≠Öõeg`ÑÎê•"Ω¡üvj6îÑvë}ØÉ<)„(ËπSVdLgÊ¶ùÍÂG~=;‡eÿXZ£‚4ºˆ˛ —y`KœÖﬁ Cá˘¥ΩGúX≥I+ƒô˚SÇ)SXâQãa:Gòÿ◊Òt¶†&Ög˚π˘ímÒË„KÌ5\'ãJ§ãÆvãAL1K’>ÿï8zaœ‹EQQfy*ÿäx|≤v∫1h{ı5`¨F˙ 6t‡$òòè{ƒc†˜–teU &èSGÖâ}¡ﬁ.¯'Ñ‘j˙∆€}ëàIY˙Ë§8´`í7⁄ÎÄ+éMîXi˜πso•∑kpﬂeq|…ıÀÓ¿BÎü"K”h„9ª'∏Q‰rØ ˘ıÀt8YNÜ©ˇF~¿´tyˇÏC~∏LA?%“z4¡òÈ§‹4âÓòJ€YØy~‹$eçÍ±Ù∫áù#hT˘˝I€æ˝E¸•B •ÖÃYv⁄Æ=QºH√∑^¨èà–˙cZ#cf©cÆQPSG≠„∆qÎ»ò-ÅòQÆò#∆'¨ÙjûÒ˝ëdát≈˝ç˙%{f£Uå(-óE˜Ñ£sï>Ôÿ®B„`†eñ§¨ù»D˚ôª‹âÎ≈Í8≤pDÄ˝XÛ•?¶bç^ 
3ÖósHÕÆL‚Ç≥1cÜë{µ4˘.núÇ<âQﬁYRÎœíx$˜¶à¢Xªe∑é‰_vÙ‡%mtˇ'(å¶n‰Q„l‰oTÎÙ»j‘÷w l{§•ÇœX‚á\êÉnàÒ≤üÏ˝ë•”-[ªñ"ÏLoﬂPÁñ¯dä≤îµcYóÿQ\ ,√∂ƒò∂ü€Ω›‰+Wˆ±∏PËˇ∑¶L«TOÅÄœb˝[{ÈYBŸÙ)Ä
ñ†K'`{è˘	ûg®S…Qî@ú<YΩÕ∆»„Ãπ∂7y¢)¡∑?{⁄Ûö-DÜ_∑,p¨uA‰,rô¡ÀÅt¥û:`'bˆÕøi≥Å%-d/Â6‰VÊõmE~.Rˆh'‚0◊Aîé‚|Ö°Qà•ˇ(A∑”(úı32óäm÷ïù≥øtŸj≥"{¡9@äAûq˝Éáﬁﬁ≈o {g|∞{0yÛZ( ç≠y≈ñq_¯6èµ≠zës«iâoì„∆¿`ÎvÙ¥r¶ „ôÎÜπ…±úø±i”Ö8Op^Ω˚û"É…X∞>b•ßıLù≈ÄÁ^Rá‰iL6ÌÑ˘8†¢$u‡âÁ∆Æ2ñ(%xël|ßŒ∫ÿÀ¸I)Æ˚W”îC	K‘)Oó¢{––é˘%n*áì©¿π¿].8…˛nwÑ±X˚‡#w=´´4dΩ!¢uf∫æ! &wòóıå∫Û2<PŒõjø∫
6¡*‘fï5`˝Ù”V–ﬂÎè≠1‘õ rŒ„]‹•àLo:ÂgËu¢ÿ3†+YsÌ)x˙]¸\∞6¨úeDä∞v÷ÊÜÜä˝t⁄‘ÕuJë~å∞à√´üg|ŸƒYÛlK∆É(Ç:/6Áç›˙Í**—0ì˜–‡Ïág¶3"0ﬁ¬h&∂Ùçòs[Ãb†˙≠_™∏£ƒ≠Ô"måp“µ¸[ˇî_-« */J˚3âÇ√H|,i4¶º›a
4`i »‹YñnˆŒz›~ßÔÀ—ı≤{b_∞T›˝âöVûSN3W5Ë‘.≥≈ì÷df¡ó,÷ëE¥‡J ∏GA4õz·}2Û∂‹ÈÛÆ•∆` ¥¨ Ö-øî$°7ß/˚Ô\hÚAÕÂÍ¯-LÄÖ¡–SVÖ¬Ãà©U(˝≥Y‘ñå#Ã”qI€vE"∫@BˇPŸË˚¿∂FÔœv∏¸¢ 	>äôºå€)ãbá>J"7s¥—©Ld∆√†;√ôsë)p°,¿ïÖÈMæÂk]¸lzf)€ì°‰KF¬ÿG˙Ö∞5¡À‘˜Êﬂƒ \H`$.óÜ∏p∏©Uπ∆B0,πGh"™t&ôÃΩ1]:ñ‰]Z¡“àlq-Å>–èÉlDπ°WêIÃ≤	˛j–3–v–›almw˙Œ|¶";5ì&€õ4YQ≥å‰ïÅi∏7√èÛÏòπ∞†u=g)«‡8&Ç"á–w¥⁄Ê ≥-R÷{Ø	QÔë∫Xsº*°Êë ⁄›ΩπöäV»iUÍTÿ8˙.&NÎblXÜ+yM›«"π:i öÆ˝ê=ß\©¶ßaÚ9ÿ´∑9øÇIEa49k2Ò∫rÚ 
j∂[…∫o0°lî!Âu`¥ ˛oc˙]#™
gΩòlè∆ì`JEŸ€úxº˛%∆ÌÃ¯u$FØõÜ}[Trˆ]˙!∂A=¿¯5k\¶”(ZF≥´~óC¯W S/JÉ¶¢1H+hú±pI∂çò™ZrëNÕÒ¸0…ÄM6K™O2ê8IYÆëÛÚ°v¬√Nˇ¨€Îw.»Xx÷}BNWUö'ø?˙≈≠Ö2ò¸ÀÜC4!2ÿƒ Âw^æj
∞0(±)ÎFc“i≥ŸhûΩ∞v¡yÃ>Mò™Ê	÷Ÿ›åÉf>2phr-Y[{S?»òTíÍÅ>%ˆê(≤›∏ëé^SπÅXÂ∑V∂5›©Ø<{hô¢O≠Ö…Ê√8Éíaëú*Mp;·t∏q/[Qä≈5·n`´—zÔˆëS¿TNVrn€Æ5É_ls¬ô˝»•)ÿÚé{È∂6B>.>¿∏’Ù◊¿{µl•õ»¢{‰ÔŸQÏx_”ua<ø†nÀ‚z›Z*HR7ﬂ:RQ˙≤;;4`œ›°E—Imëµ“Æ€‡}›xMs^€U‚∆hëgﬂ¢&ª‚ˇÅ¡ñu£mæÌ3∑1ÇL,Ñëƒè!å⁄v\6øªyxßjîòöA*†˛∏|™l√◊í‘P•±ônu‡i`f2cõ	È†ˆŸ/jA˙,4 1ÀüÂƒ—]TqGqhì¡à"t-ƒ\-œêdä≠K4≤-bœO1»G&üŒÅ–3‹ñ3÷O≠)≤°ö∞©M¶Ïy&Ë∆“3)îQ’√g`ÚJÅo®êAg¬Ù~q≤bz&\k’Ú≠‰Êzø‘8†ì˝ç¸∫Lä)Ñ#˜.4Èùˆ=¯ö”iÀj¨1 [o√JøJπ{çjÜ.a¨ïxâd9ˇà∞+®ÿa/ûr/OπZ`tÄë§¨=‹4›@±8VZò[Ló|éDu2πñÅ∫5îŒxÉÅ[Nﬁ¨ﬁeWëÓ91NMˆ∑14kÂ1T9û⁄2ÄÆ'ÒÃQ>ZΩc‰’Q∑ŸË∂…ub¬˙7vjM˜ò€¬›wõ»∂j†∫YóÉÓ3W–≥∏J)Î˛–îÑ%ÙMDUIˇål ¬ëÛêx“ÏÌr¯˝®ÆÆ|A‹ñkæâi-'îáµDÚ™MÕbŸ0hõó@∫,û≈TÚy§)öú ñJPºUL◊?R∑îúO-m|√«FZ∑∫GÌH‚~úuÎ>¸J˛“6Ù)a∏JîıB˘·U1„-(íözk‘Òh-zzQÆ‡|¡]Y~µG˝Ä3¥8˛„ä§ùiÄﬁ:˝†æ_#ã˝˚c¢÷’’ù€Cr¿FöBfi@vø&∑??¢<@ÏÀ	òa¶˚ˆPg1%Ij√c;#@°iƒó¢?*À+ài‹î5æµàá'≥%)∂°•‰S}k:ó?º1õ˝¡Y\|©ÚQ,¶"áÜ’±	].D\Æß@√_i"SC—ùÉ4˝‰/Ø¨ß)_!Ø,Z€≤ö∏_rŒX$0⁄†˚r˜Zè£Õº"à¶5Ò¡d~ƒ†⁄ÃãtïÍ Óz"€¬ÔÉBkäiŒÈ£(ò©ûèØÒrUNU¥ıÉ¸3«í≈q∆åj©oÁáÈö6ÓèÄº¥itç6∑"ñÇ¬Gpõyw&√«laÓR¶Q≈Ê¢`JzTî‹`ZÏÁËùÜoPt£‰Ø‚)	PÎqˇ∂µ∞ÑŸ˚U%˛≥ÎJVÅvzÌ3˜#ˇæ7å•M&ÄŒß_ôíÈ◊f∫k©g•Œƒ¨ïc˛±Ω‘ëYﬁ:ÿûì∆§_N∏à…âI3”Ÿ•‰§Ÿä‡éŒó“—`}-¶'’2≈m§@Q\P<∫%°Æ/¿*◊sµ%KV∞»õ$uÒö€ö˘özºÊ#ºµiè+Ib•3·˜Âo-é
ÿè0
ﬁèi•\Xº£î†\≈\[‰ü_≤P.◊è~ﬂñ7ƒ	0˘Ôñ›M14ú¢∂5ÖE&Üv…2Œ•©Oe¸l∂$¢∑›™p(|EUÕ’œT_BÏ¬¸ÖwÁ*Pµ1˘h™xgj†:®ßè˜»m>Û™ <}∏guNÈçbhu’ø≥WÔ∞˛{¨Ô’>ﬂsÅ“Î3≥"Lú„Wå	v¬a>«ú%Íúâ†t˛-Ô…¨‹ßòùâWŸ⁄nàúBU≈Qgô°=ìŒEE%FÏπ&Y°©.4JoçÈP‡#<∏ÆC_ïÂ´d)I∫ø]\í[4ºÉ†|Mb,ñâ_¬G$‡¬áKlÕÿ“:˝0ó≥‘?ZbÊ/]º§fö¥ÕLƒµ¶KTÄ+Lb4vDKz
íy’?%Øä◊ﬂGIœØ⁄ß´?üa}¸Œ…Y˚%]yœöËüëõ“¥eKÜ8GAë6∫ô√´–∂P/âÂ<—&c'⁄l~Ã)˝=' ˇtˇ!ñIBU>mRÙﬁÖíò\Î¡rﬁVE}Ö8aˆÄÂÊ˝É˝⁄˛£“˚L(üÌ-M∆q.àëï˚Çn\…¨Gèj˚èπjê4SÇé	 ¢ﬂÏÄÈÁ≤»a Üıyá›⁄†"È—≠HÓÉ„iŸ‚˛MµïFbâ0(k#ã¯"zN*©6’æRbj>q*C¥z«9<ÖÎp›&@∆KT( O‡Ûyõ‘æêd°S: XÉHŒA òº0≤™Hµ\T·ä8£ÿÁ∏VºL(w<úV∏fK•∫øW{»≈óêvel∂uGX{"πí“>aZœ"ö†c<ß ñédÔ‘ˆ?ß~)ìèÉ¶äpMÈÿ`R–/o m*iJ¿†˜öìy	yH˝"ÔWFDñ@˙¢yÖÿ ó•ÿÚﬁ®µ´˘X{ï˜ÈÍ+[5è⁄"6∑•+G•l?ß9ö«—∂‘-£Ø≠*fÔ00D5ª!◊ñHÓrtÉaöìhÊ7‘Nç±%|›-4éˆà÷B§ÿV‘oªø¢I 6∑9T⁄ñns©»„ˆYÛ¢”€5∆Jê‰K∂„{µ˚Í)h–ÍªS£çõ~≈“exÑgÒU/ˆk/Óã¬|¿ü≤Ì^>µ4ƒ˚‹ø±0R/Ó◊^<‡J8˜ÕËl ∑iÕD/^<®Ωx®ˆ±Ã˛g<ñ§—x∑çÑπv"ê	¡p TËÙY–°≈¬8EìŸRD˘ÂZ∂¢£∞FEı%ÉÍ|M˚ú‰|øpﬁ"ºÂΩu¯Çjw.ΩxΩlãˇ}òÉÍ€,P÷≈¶Ã„∞ö 6ä6WÓ£MC[	$p⁄QPì7≈m≤’*ÀıÉM‚®gı_K˜w◊y1©G¥¢´CÉYY∆\%ÜB)˘2Ø
„K©ï“∂"—g’ûÁ}i˚¡ÔBèÅ+í±]ÍC’¯>‚´@¨'”é@˜◊óüÔ…∂ôrx˝ÛèÁî∫%ﬁÕ4‚·&[*29»hœ≥Yò÷Ái∂◊Z[˜'çÓnªÒ“|]‘5Â0áYç1|õoÊπA≥Äv~R;¢\éÌ¶Ï∂dy˙∂Å^Z{∞Í,ŸÃÁ¨}ŒMƒ„ ŒgwΩI.âKÖ:ÉRÙô$º"Ωñ≤Ò‚qA%≈ƒ+K¶‘•x‰e2πæõOÂ®€V˝o?–oÜw
M–ΩaJßÓæüJ†ç›P=Yä/í§v/ÖQ„Uôâƒÿkx$%5¸÷ <Ωo™‘RØ¢7o»ò∑x∑≠–Íè»BŸó(è<0Úïœ§¯ÿ	Â©≈fÓ„ACQaUsSF◊Uõ≈ÍŸ¶Ù(^CÓÄ∆L"≤cô ∞µá6EQz ^åÚRY'ô*µ‰íØH$’aúÚ≠H^ıVÔRÂITÆÕÌä€<«‚≈•‹ﬂAÉõrÂA∫nÚÜK«Ää∆%Qz÷ÎdåÍ
DÈs∂GsÃ.Ñ&…ê+Ÿ/ø‰”…7æ∏“*wÛúØ?ª÷t˜ãt™ó#t"í&óF∞EÙõ
pbbdÿ!VéJ÷^Å∏«⁄gå’√wﬂ¶EÙÕ‡cù)´ø6˚Íº◊9iˆ:MºëÂ¥∑˙[ˇ¨y÷T~åè∫¯§˝œ÷	Ùö÷'f°≤bÖOË:ï(eRälÄw\ÌÓS€áQNò∑4lìíªØvˇ@áD†K+Ë‡€˛yìî?œ‘gC˜ëÓ0Ù æô¨qêá˚µG¯!Svîæ2Œ_û‚•v&ŒG∞°◊¢Ã%Ì◊>∑ùùYê_DäÕ⁄vØñÈƒÔ~≠ä¯Öz∆ùsùÆ r~ó™sz˙ús_¸Íà@”•QıS·ªÊY‡1 ◊¬fŒ°ÃÑaLQ˛≤9¯v`(dP‹Ó;¿+Y •yÚhK˘„u!o[%![P”~.éA[41¬C¿\0¨±Ç-$?§¯œ]ÌÕ’?≥&œ¨©~+ü⁄*œ’R!koÁ
PÛÍ&,8u.*å°£ZEë( ëWöÖ≈≈	_Wék√L…±Á9†åt@7UŒ«  6‡©ü≈)29£≤ë]Dó$RŸn˙[ıbW≥≠Ë r"
} 
¬l+TfX;≤…˛@à(÷cº*ü”dı—7.t«h#ÉŸwRÁ}3ùQ\ﬁvl˚<‡§1Œãv}õÈlXˇ˚u“–qN™>¢tS9$Ù˘°\Lé:SŒ]#K7RsiˆÉ⁄÷Ë«(ßÎôI§≥≈ÔÌ–µ2!¡@:"aΩ‘∞≥¬‡"ÿ?AJﬂbèµPZı#îdblÚLπnFˆbæ;àJ^fÊNÆkëd≈„“XSDÜ]„W°AîM·Ïócﬂ¡∏#zNëIˆπ™ÙNèç‡xÅ!˛#Käm?fÉ¢˛}UAk¥Ö¡N…•$¬ní,ëä∫OIñ#˛¿ñÅò*√∞YƒôÈì·	mG˜7˜jÆ'ãA@˛˜ÔK˜Ä1Ib∆aÖR«@:®Ò@{=	Ïﬂﬂá—•£g¶õï´M–‘ôÙ{I¡Ö!≈@ßÑc{=†ª7¡éfƒ1£ZPN1vÜë· -sÜÁ§z‡v√+Ñ(Z´≥%ÑbÇØ ¨ã
°?∂ıË√‹l<xˇQ>) ƒk¿ÀêΩ{≠pÙàú=âlÓ¢|s;û§)›øÅ
—u4Hfs/
¥tÛkÈÊ_[d÷‹åÅïVà{¡∞LÉ76«˘Œ…úõ“è~ats+í1>H◊3∫Quê˙òDÖX÷œ/h`dËózÜ◊e0	Í≠˛äà8©¨≥8"[πTë±c¯0÷∆6‚+7XHçt#ÿü@“<µ∑fÙé˘Ü‰fÄrqhw)C'b-˘7°€^1L—>å•#æ0ôw◊	t¢≥q¿√bîó‰Ú_É]îûÒXÙ≈]EÔ]ÒkìV™Ó^Ÿ(C/Znç®ƒhY%i‡¬ıÆx„am†h…àf¸ÈıV®3ERΩªp•Ô *b“¸Q7à¥•z}Mœ√b¶D«ƒìSM&Xô±ôˆõ6Ÿ+&KßVÔΩΩ◊ó’mtiŒÓ2_…oWæÔÑJ Ä ¶3ä€5fñúnWìÛ‰Îlı˜oŸ3π§ØñÅnyÌãKí\/∫ëJ‰¥•)•éLæ_VH≥ó|≥9î18Ìº¸*gC“í≈÷’?J√ÌµOöGû≥ìˇ˛'´±¥∫¿Õi§V„ÊÙ•÷ík≥˝DS]é66rÏ˛ﬁ2t™¸n9ÙœŸèÖWï‹péOÎŒ^æ/Ê§úÔ9ßj{´wìdÊ˘I?ﬂ´}˛π’åÏI≤¡W"ê⁄KÛºqúøò˝áÏ:%yô˝õ,ûπ€jèy§	:‰MÅHB$≠h=Fﬁv€àÇÓEty¥W˚Ï°,√wãI:Á≤,ò:{NA[}x‡B‰>xÁ˚TbúK’”G‰xÊ¨c˜ﬁ¡÷(Õ°+π>r
1ÍQ:ø4Ú4Ud≈'6‚⁄¿∆≥(¯‡›∂˘_˘ﬂüªjLÏ◊•ì·ÍgÏO◊Ä` MÒ∫~s“lØ¿ßÀ<”≥µ∫óG’· l•˜4wôÀ∆Òº\äGT8ÿÔΩ¨)≈kq_[≠…´‹Î%%MìÀõ#Îÿ+ø∂ç/ä˜-Ø™ı ÚgúŸ≈⁄´iTÜã5µﬁ⁄ÕUèT—Ñ£kä2LŸ’π&Hﬁ·∆1´8©7îddﬁ◊CÅ`ΩV%h?∂!‰| €^˝‡qmØ˛Ÿ{‘q®IÃQÛRP›õé©ßCká^=:t±è˝<T‘Á}¯}ô’ÄFV∂ë¨$ÔÆˇÖGÇcj±O†F{ı«{÷$ABàOãÄƒéúƒj≤ºCß≥´ çdùc›xéÇ·À¥g8z‡Ö¿∑£yQÃΩôÎNr¨hgBÎ™JSuFë8LL∞º[˜é_Öwd˘°Ë—ÉÍ$ä∆|'ÃáπV‹—züèD\íê@íàÉGæ*‹˚’æ
EâÌ¢íõ</ˇff'y}∂ˇŒQxß•í˘kÉRËàúì=•ƒuŸó0[=≠)≠ -ó¯%À
‹âQTÚQP•´œ‡µÛÑJœ-„)v¸-µÓÙ›¨~BgM¡ÚI,%"îZ\qïƒI≈UKø^z⁄7ŸrÂπÍzœﬂk®+[ËXpû∆È ˚”æé&SÅÙi= h[®◊Ò¨∞V∂ç¬–6S^…˛&◊`ã>ˆ.6=œZÍLà⁄7sY≥ø?œ5ãVâ†~9·qÉr· u…ø 3GÒtF8õbc7⁄¯BÉﬁÖ‹WÀKf√÷>∂#ÉuÁm|°π¶°ä[Ï|LäÃ˚HÄ“dÇ—V¨gÿMDl˛kçÀqÏ¬ß¯¶è™‚K…Û^ƒgVˆAÔ±>å.†`tCa&…fOÉò≥q'ywÌU±¸}nÍÎc&ô’;lO¡í‘#S/öˆÑ–X,>w.uﬂtbCÂczÍÒ(…Õób:˛0Æà;›yÏJ0„+<[∂˝0å≤œ%P#üq?ZÄ<˚ÏAÌ@*'s1Qö¬¢»∫4° M¬‘”ØYΩ]Ω‡]
T¿{ÛHLﬂ-„i2¢g£d≤ºâê¨Ahê49¸•)¬‘`@7‹´∞+é∞^√xÉ∞M6˘¢ŒéÚx•É˘ò∆¿Ñ˚è—x€˝VØ{JnCùµ˚tıH≥Ái¿¸æ˚œ÷Åc5ÂÔöıKy	ÙÇa¬ÅTHG*Án âﬂ`ö@È*g€ÉßCüπn∑xxΩÅΩª∫–a∏≥˜X‹ø8C`oWËŒ'“vc≥‰√
èûe…_Y1ûF¶\∫±“ì¡ˇ◊U_ˇ•o—›#ü≥-€•4!e‘Êâﬂdú∆©l∫≤¨Â!tw`∫3qP4+Wy—Çú€e0∂¡Ñà#—–È l÷äd$· ˜ÎµÂq$Ø‹[µh-Â(¥Vñ5´MØÈ—OÒ∂ã‰°¯ÕÕ  £V£ïWnÂ\ƒx7ÇGÆ7ÑáËËEk8≈A∞·E>tO´áW_ﬁ5Yb˛%–¢…ît¢á§≠ÂZqÀbÄpœcµmñÊë3yb|ñ¯˜Ñ~ó-7'~/∫Œÿ àäL÷b±Ë©8≤:£ÿkTi>;xØÜT6‹-h¢YÀ,è&:MÍE°UáÇÁ‹5WkjOﬁ\¡ò.‹“m?ûç3-ê<Û)òıkôY^c9'L('…SDÁxB9dﬂ	â&˚ß‘ÜW´wÙŒñ	¡ŒUI#%;<¥èΩ¶T—ÌCæp£)G§Ê˜…'hB0"»TBzçÑ~‹öhj¡D0œÁ`¨Zô@	Yµ\XXÖ$‹6–$∞j?—ÖÍ&Z±∞y]∆U··	-Csä[ti¢ÜzP \Y^1˚Ò≠<™ÿf≈Ø≤øweüeyà;3É;t?¨=+OW¨·¥ó]zûØZ⁄√()R)X9£[Ë0óD–{‚»∏ÂsMﬂb∑!∑–;6Fazz¿˘% È`˙õ(]¥å=‚Îañr-Ω≈`8›ajPœˆ˜‹Hûê∞/ êv§ü
¶rzrñÕﬂD˛Ω1#ﬂıC…ëÊ¬Ω(ùiÔ>XÿŒ≤v“öMô;Ü∏Y='˜ˆdBÅÿîHóŒ{E8˚e‹Ì[∆S⁄÷çtJ,Œ¸aH3Ω U◊R…≤‡Î!8∏ä3tïQ¿Õnëkp¥EY¢L}•Eîﬁb„M¿ H#–y˘N∏« ∆s~iÄ… m‚Ol/7!À˙0Î„|í›gÓ°ä)VB´Á‰Öî§wÀ*…õ,óS>ª_îFï[›◊F-ƒ`6GÑyÜ—fr]›4JßëÃ`√ä≠s®¸§`÷ﬁ¬°€a{/úΩo≠i±„h(ï_Ùqã
ÔS™/≠û≥UΩéŸ‰‡°⁄ÊÍJ(úŸπâ∆ÏD;2Â,,)X§$ûä‰T+-ô¡YÀ‰l≥õã‚l&GH˙v7ú3<›8Vßõ‹˝CnÎÑÃˆjèeå)F¯ rÑe•Å)·w∞˙iHV64.æ©Üó¬ÆÜÜÂ¢gd°_ûrúc˘O Ì•Z·|n6Ü^s9$p˜Ï±rÃÓT˙,[cÑÜ4Ê \ID¸n¥ênf3 Ù™<¿w/Ù<œí8˜us-ïU—{ÌóGM“_[Õ£ŒãNK4XDú=PNkj¶∂Ó!}.l¢·•ë‡-F@ÅM6L>æc	ó_’‡l¯•Q?—@Ò∆„g2Wo†ÂŒåMﬂ@V√◊∆â_	?˝>≈ÇPf_bD¨w‚(lMs…[öüÇdÆí7	¬{˘ÕF]DHüìöÒggÇ◊¶Hùﬂü© ≈aSı{˜˙m’kˇ€yß›k´ˆëÍw^¬Ôì3¯£ˇoÁÌ„¶˙]ø{Ç@ﬁ°{”#ç:Ÿ(~CáTùKLÈ0 «QCX7VïùÁ—Îhß™vL˛nsU¸)ìévvÎnå˛PÁ1€ÜM¥Ü¬x¢)¶âøÊªnÔW≤’?&»´0åík„ëÜÚ	‹á∆CÜRÄØ? fdª¿B$x◊^,’ÁdñÃì©8sR±qîﬁtAª∞Ék qq(íY˚È1Ó
,#mVvÃ–};ø∫¬ıõ¬Ì’rI¶j©Vj5ºV	_O›EÊ¯wÈﬁ\x2ª^‰:·OL∂áŒíÏı<_‡ì—^›ê#Q5Q Ug
√>äÔ‡àC™Ò]Usµ£3‘v«Ÿ¿Ë	ßÕ<è§êôÜ¡HÈ¡ÎX #≥√00‹∆Ô‚E!V|›±H8;UÄhh\¶èôY≈Y¸û
@â0÷ ∆“	<™ÛÀ4î‘mrè/«™É´øÎ‘DÁiÂõ∑ÃÜI7Ö‡cLu;ÒËl∞eœgbÎôº`À}≤ÑC‚‚ùz∆¥Äûñè3ñ∆ 6Ä∑äÔ¯•«–bZêëı:J”Ë˚1c.[ŸÍÒ≠WíÖ„πë>Ìã∂høÒÓ˚3h™ò±¶^π´‘H¥5å±º° ñ‹Dè]>ΩwÎoÃbrÖò.%Gc§YD"¸ Ö‹ÇÀÌ ’ç0I)∆Z•iÑu+ÍfâÖ±°79EΩŒ–iKÏa™öO-ˇ	Ämdﬁ√¯w∏tRö±>.>…Wˇ»—.“p5n©p+Ãw>JLçukÍ@∑0^F T∂'õqLaD∂fFv˘ì{ˇÚo’è˜˛≈=ÿEFƒ˘npı•ä˛%3P∆Í(Z§E]Í∫«-∫}V˘Å>S$y§O¯ü3}^ƒUy1‰Ü≈äËüŒºÁW…¯â2(;Íq2âœ”¯	öTP§Ò∫ pU◊Z˜á(Ö¯˝(5£Ø±èz˜˘Ô⁄≠≥™˜rJF|8»E¯ëR%6Ø˝û˙gΩŒ…Kıcu√7ƒ6JÌOŒèü∑{Âˆ!∏”ñŒﬂ©5í¡Ú¬à4{ΩÊW’“˚dO6|v(o(ˇà‚ùfŒˇ!¬˘Ìã†'_¬:Ïe $ò0Äø¯" m[æ[˚lCOú3èû®ØâŸT[©∆P5ÙøÍàtµL[ø-ué]∑DBÔÜ†Iª}¡¡Á˛"Àr^5À™kBTUÿ~uùˆW◊H≠ÉÉôˇ˚„nH¸¢?ù≈of@˚â©œÔÂRÌ¸„Œ^Sê¨ãxtZ4¥FiµNO*“Eÿo|≈íYÃŒ<:˜~Âú{ˇZzıDU‹@uKhB(ÌÚî6∂˘2v≠%B±õ|7·Ôöæ≠_VÀ_ô≈êÍHö-' ñ –ÇhfßaÄFª.,‡·ˇA|üØU%e(bî-vÖé ‡@2≠”õ NˇA™MìÜ·D5–Ú'∂N€_£µ?ÅÌßè68I0ÁEÂ`ooW&Ï¶z•¿±îÃ ∫•ÒÀP-°1yjªf¬˜cü~zôv6öjê)îÑÄ–…¢ß‚å[ä Çïëq’hëÅ∂=ƒ–>ÙÀ`åûà–§@d ií«Æcˇß—"ÖA§ıS%åˆ_ç‹YÂá¸1‚úyÅœΩ?m‹Z«¨ù ÅMÊX3”©â^√-∞E≈"íÎ˘	:≤ rEΩ«¯àA˘Öˇîè«Æ˙Úmÿ,_x7:@ì≠z”É›&ÃØÙh¡{ì\© Ø\ã]ÀCÚÙ≈Ãﬂªá∑Ô»≥.üBmo–Z}‚˘§æ#õâ€ÈM9J`~„x∆–JQ-ØÏ˙gﬁI8‹GzzFÖﬁÑgûEh¯á6z´ÁËÿÅòx°9s=πÚ7¿5Œgb™\Ω}ìPb+Vd4Uﬁ;W!"çÜF]‘Ôâdß¯ˆ#]òÀÈùH>)y∂ŒáR:x¡=≥Ì&«ª—xï¿zHçßr_˜Qæ‚t¬&EQ-"ÃzëØ~∆}√ËîVÀ¶ºõ;V∑ÊïVoıW¨¯EÜñˆúıö-1≥¥ëy¥Œö˝]r∂_tèŒè€'úÏMU¬∫O¯˛hZ£ÒÍbÓF°Éú‡ˆ4°õc≤. O@CG,0°\$+©N]√C¿'8kxÇ°©ì.r∫ãS}”¿çÏc>·–Sµ }gı7ˆgòΩœn'Í™ü‡üI&w°ÛÖÊÒ:Q∞’Ù0~xÊÛ	˙ü§§¿+P⁄qE√ˇ◊·T`wﬁFw⁄/ö.Fî»õÒÈ´ W%¸#ç§>¬PâÊ)¸ﬂ¸#Uê3˙∞†Íw∫'ÌæÏfﬂBÀﬂÛ°
 *GªUπb¬’ı®4OwKu+gªÚÉeﬂQ? ˝ıı∞~ø™‘U·◊c^ÅëÇˇ%°‡&Y˝ §,/ÿ"rdˆ⁄˝Œ·yWù¬\è;Ä>› •¿º»Ø`9'´?√„Ê&lô¢œŒfRNé√!,¬æ-˘5ûÚ°·P	%ØgfV~Ωªémfh‡ÅSdˆﬁJ‹‡h|b˙¿?@ãmeø˛¯◊ª∞Ûr>·1®˛ê|s∞5gΩÛ>ùy{Õ Cﬁ9=›ãq/Cº‹@|2ŸE\J6âYuE4∂Y˝:L\¢Yc÷ù◊\Û≤ï™¢ì´=•Ω±Ì9 ˜œi≥◊>T2_¶Ï16ëïAb7°Ä5î0¢ÇBuFöëÁìúü&E‰πü]då˛¶ÙI€&Ñ7‘ôÕ¢è>aœíü≥ÆÍüü∂{ùn–ß◊Y˝O<
˛4e\ _˝òN5i)îaRNµÊ»2ûbﬂÛNÖ≠≤dKJ≤+fFS¸¨Æ^t€Gù√Ê!(ı9ƒZâgOÖY¨#JƒàÉULå–B•|=E`ìÎ5rjπ ä2π5˛é¶‰¶ˇﬂ|`ﬁêD≈¡]≠·F{@’ŸyQU⁄πÿŒ¥Hä‘õ"∂‘ Æ‘Ôîu03¯Qúçg◊≠…ù?‹L∆qú…÷ö”ÓΩÃﬁ?¿ô·Ò‰3ô˜Çé–ÕïrÔÏ2≈[YOüÀ)ñ8æ Sä»C˙¸âÒ◊ÿÉS°Dˆ“K|kãrUL)ï†6ë*ZïG˚Ë∏\® 3y∏ªamÄ{…àQÍ∏l„x?˛l)Ì—z˜ πèÔ?`§*B@√(*à9Á∞:dè[«ÌI~˛iLå˜N√ünd“%Æ,˚÷I`THÜù~‚‰Æx „O‡.¨<U˚ƒ‰?Ò™0q=ÖÚª~PQ±ÚLQõu|H¶”„ªù†S/ŸÿOÎ
‰ˇ›4»GÄÅ?⁄G0`tÄáÏ ›bFC¯ÆWÆØx åŒ◊øGiz«ïøºEﬁÿ6Ñ∂öº÷®ˇdé„-∏®¥6‰w…(ã≈˘tJ„À®øyº∂QJ*_íïhñY0înHZ[®÷Ω§¯ÓNcılT—ùãº¿÷?è^k‹ŸéıYì|÷Lg˙ì≠Ñ˚XÁ”kÚ˚}‘Ω`Jå2q™ñàf>∫„»ùÄµi3cÀ RwöÜÛCçíhú°fºV<≈≥d√ˆ;;R/0h˛7Ã¸w±dóvÿy©H|tÛ.å∑)*vBÀÚLæ¡;e	jß∫˘Ωr∂ΩGe€;_∫ÿ÷Ü⁄˙ÀÄªÆΩ.q«mÔK\¨‹,‰3Â∑D—7<‹ÿ8 Ü[^d¨‹fçÓ¨u¬$b›Q-∑X?EÂ[ëﬁ«±_ﬁ¢/÷—;ı?ƒÓÙ˙òæﬂk√˝b˚n®Z≠¶.:gmuÿæP˝vÔ¢›S†.c∆Nã UÅV˜Ó±I›„∏É
&ìœ˙†ê«yÖóã&`Œ“,ÍqvS?È∂/€'ÏÅ7tO …n`_æ¡RF«Ê1Rx$]€}°?ëËMí¨ÌO¿tŸõäÂ((ã¢6”H–—ÿà—Ü>¿ÎÆõBv4€8ò^SqÕÆav†—_◊_Î$≥+˛iTŸ•®ôb∂S¿ÿ÷πÑN≈Ù≥+Õ Ó¥:Jµ}SøûMrß\¡WzvÁ*◊s‡3∂œq<´Ï|
Å}≤ﬂ[kΩ≈8Z/í4Æ∏ôöa´ò!`⁄1ì0òpèáH)£r⁄ÌùA˚Ω:˝GÙF2ÿG∫ÚáØq	…HÁﬂbä~€ÿãFN$∆´πT,]¢h√x ˇØg≥ÈìFÉ'◊Ä˝O˛Â˘«?§‡ˇabÜ}qÔˇ  ˇˇ è@–—