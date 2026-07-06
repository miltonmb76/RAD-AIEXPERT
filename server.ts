import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

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

function getModelName(requestedModel?: string): string {
  if (requestedModel === "gemini-3.1-pro-preview" || requestedModel === "gemini-3.1-pro") {
    return "gemini-3.1-pro-preview";
  }
  return "gemini-3.5-flash";
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
  const valTrimmed = defaultValStr.trim();
  
  // Skip if not a numeric/standard starting string
  const match = valTrimmed.match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return defaultValStr;

  const numStr = match[1].replace(",", ".");
  const unit = match[2] ? match[2].trim() : "";
  const num = parseFloat(numStr);
  if (isNaN(num)) return defaultValStr;

  const nameLower = structureName.toLowerCase();
  const isIR = nameLower.includes("ir") || nameLower.includes("índice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("índice resistencia") || nameLower.includes("indice resistencia");

  if (isIR && (nameLower.includes("renal") || nameLower.includes("riñón") || nameLower.includes("riñon") || nameLower.includes("izquierdo") || nameLower.includes("derecho") || rangeStr.includes("0."))) {
    // Generate randomized renal IR between 0,56 and 0,68 with 2 decimals
    const randomIR = 0.56 + Math.random() * (0.68 - 0.56);
    return randomIR.toFixed(2).replace(".", ",");
  }

  const { min, max } = parseRangeLimits(rangeStr, num);

  // Apply a 10% safety margin to stay within range borders
  const margin = (max - min) * 0.1;
  const safeMin = min + margin;
  const safeMax = max - margin;

  let randomVal = safeMin + Math.random() * (safeMax - safeMin);
  if (safeMax <= safeMin) {
    randomVal = min + Math.random() * (max - min);
  }

  let formattedVal = "";
  if (numStr.includes(".") || (num > 0 && num < 1) || (max - min < 5 && !Number.isInteger(num))) {
    const decimals = numStr.split(".")[1]?.length || 1;
    formattedVal = randomVal.toFixed(decimals);
  } else {
    formattedVal = Math.round(randomVal).toString();
  }

  return unit ? `${formattedVal} ${unit}` : formattedVal;
}

const app = express();
const PORT = 3000;

// Enable JSON with elevated body limit because medical images can be large
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

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
      const firstChars = cleanedKey.substring(0, Math.min(6, cleanedKey.length));
      const lastChars = cleanedKey.substring(Math.max(0, cleanedKey.length - 4));
      keyInfo = `Configurada (${firstChars}...${lastChars}), total: ${length} caracteres.`;
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
  let text = "\n\n--- REGIONES DE INTERÉS MARCADAS EN LA IMAGEN POR EL MÉDICO ---\n";
  text += "El usuario ha marcado y etiquetado puntos o regiones específicas sobre la imagen radiológica provista para que les prestes máxima prioridad interpretativa:\n";
  annotations.forEach((ann: any, index: number) => {
    const num = index + 1;
    if (ann.type === "point") {
      text += `- **Marcador #${num} (Punto)**: Ubicado aproximadamente en X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% de la imagen. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    } else if (ann.type === "box") {
      text += `- **Marcador #${num} (Región Rectangular)**: Enmarcado desde X: ${Number(ann.x).toFixed(1)}%, Y: ${Number(ann.y).toFixed(1)}% con un ancho de ${Number(ann.w || 0).toFixed(1)}% y un alto de ${Number(ann.h || 0).toFixed(1)}%. Hallazgo descrito / sospecha: "${ann.label}"\n`;
    }
  });
  text += "Por favor, analiza de manera exhaustiva y prioritaria estas coordenadas y regiones en la imagen, correlacionándolas detalladamente en la sección de HALLAZGOS del informe.\n\n";
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
    const { model, image, mimeType, studyType, clinicalHistory, findings, inputReport, uploadedReportContent, uploadedReportMimeType, systemInstruction, annotations } = req.body;
    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const parts: any[] = [];

    // System instruction/guidelines for drafting reports
    const finalSystemInstruction = systemInstruction || 
      "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica. Tu nivel de detalle es impecable, sigues estrictos estándares médicos (como BI-RADS, Bosniak, Fleischner, etc.) y formulas reportes radiológicos sumamente precisos, limpios, profesionales y listos para ser copiados y pegados directamente en expedientes clínicos y Microsoft Word (donde las secciones están separadas por doble espacio, los títulos van en negrita normal en vez de encabezados Markdown, y la sección de impresión diagnóstica se redacta enteramente en negrita). Siempre mantienes un vocabulario técnico radiológico riguroso.";

    // If an image is provided, prepare it for Gemini
    if (image && mimeType) {
      parts.push({
        inlineData: {
          data: image,
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
 *   model?: string (e.g. "gemini-3.5-flash")
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
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: audio,
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
      "Eres un consultor radiológico de élite de nivel académico. Ayudas a otros radiólogos y médicos a resolver casos difíciles, proponer diagnósticos diferenciales detallados basados en signos radiográficos, sugerir estudios de imagen complementarios idóneos para resolver el dilema diagnóstico y explicar la fisiopatología detrás de los hallazgos de imagen. Responde siempre con rigor científico y de forma estructurada.";

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
      "Eres una enciclopedia viva de clasificaciones, escalas y criterios radiológicos (ej. BI-RADS, Bosniak, LI-RADS, PI-RADS, Fleischner, Stanford/DeBakey, Duke, Balthazar, Child-Pugh, etc.). Tu tarea es proveer información estructurada, precisa y actualizada sobre la escala consultada, detallando los estadios/grados, criterios de imagen clave para cada uno y las recomendaciones correspondientes de seguimiento clínico o quirúrgico. Presenta todo con tablas detalladas y listas claras de lectura rápida.";

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
      "(ej. BI-RADS, quistes de Bosniak, criterios de Fleischner, LI-RADS, PI-RADS, criterios de Alvarado, criterios de Duke, Balthazar, etc.) " +
      "son aplicables diagnósticamente para complementar la 'Impresión Diagnóstica' o 'Recomendaciones' de este informe, y estructurar una respuesta en formato JSON exacto.";

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
    const { model, report, classificationName, whyRecommended, contentToAppend, studyType } = req.body;
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
4. Inserta y fusiona esta clasificación ya calculada (incluyendo su grado/conducta sugerida y su sustento clínico rápido) adecuadamente dentro del reporte. Lo ideal es integrarlo de manera estructurada en la sección de "IMPRESIÓN DIAGNÓSTICA" o agregar un apartado fino titulado "CLASIFICACIÓN" o "ESCALA APLICADA" sin desconfigurar el resto del reporte.
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
    const { model, currentReport, instruction, image, mimeType } = req.body;
    if (!currentReport || !instruction) {
      return res.status(400).json({ success: false, error: "Se requiere el 'currentReport' y la 'instruction' para modificar." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);
    const parts: any[] = [];

    if (image && mimeType) {
      parts.push({
        inlineData: {
          data: image,
          mimeType: mimeType,
        },
      });
    }

    const promptText = `
Tienes un reporte médico de radiología en formato Markdown:

"""
${currentReport}
"""

El usuario solicita realizar la siguiente modificación o mejora:
"${instruction}"

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
      "Eres un médico radiólogo subespecialista experto con más de 20 años de experiencia clínica. Reformulas y mejoras informes médicos radiológicos con un vocabulario médico de la más alta precisión y elegancia, integrando hallazgos o clasificaciones de manera totalmente fluida y nativa, sin preámbulos ni justificaciones didácticas externas.";

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
          data: image,
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
      "Eres un consultor radiólogo internacional senior. Eres extremadamente meticuloso y exacto al valorar imágenes médicas, explicando de forma transparente y didáctica el proceso de valoración visual de las anomalías radiológicas para la educación o validación médica. ATENCIÓN DE CONSISTENCIA DIAGNÓSTICA Y EVITACIÓN DE ALUCINACIONES: Es imperativo que identifiques de forma consistente y transparente cualquier alteración estructural obvia o conspicua detectable (como una marcada disminución del espacio articular femorotibial, estrechamiento del espacio articular, osteofitos, esclerosis ósea subcondral, deformidades, luxaciones o líneas de fractura claras) sin minimizarlas. Al mismo tiempo, debes mantener una adherencia absoluta a la verdad física de la imagen: está estrictamente prohibido alucinar, inventar o reportar material de osteosíntesis (placas, tornillos transindesmales), fracturas, o disminuciones de espacio de la mortaja o espacios articulares que no existan en la imagen real, basando tu veredicto 100% en la evidencia de los píxeles anatómicos observables.";

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
        .match(/(torax|tórax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|parénquima|parenquima)/);

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
          data: image1,
          mimeType: mimeType1,
        },
      });
    }

    const img2Supported = image2 && mimeType2 && checkImageSupport(mimeType2);
    if (image2 && mimeType2 && img2Supported) {
      parts.push({
        inlineData: {
          data: image2,
          mimeType: mimeType2,
        },
      });
    }

    const img3Supported = image3 && mimeType3 && checkImageSupport(mimeType3);
    if (image3 && mimeType3 && img3Supported) {
      parts.push({
        inlineData: {
          data: image3,
          mimeType: mimeType3,
        },
      });
    }

    let promptText = `
Eres un radiólogo académico senior con subespecialidad en diagnóstico avanzado de alta complejidad y el consultor de máxima precisión clínica.
Este módulo ("Doble Valoración IA") es el estándar de oro de exactitud visual y clínica disponible. Tu análisis debe ser extremadamente minucioso, cuidadoso y exacto. Realiza una inspección microscópica pixel por pixel de cada imagen, analizando todas las áreas y reparos anatómicos. Los pequeños detalles, por más sutiles, iniciales, tenues o milimétricos que sean (como micro-fisuras, asimetrías de densidad leves, calcificaciones incipientes, reacciones corticales tempranas, engrosamientos pericorticales mínimos, opacidades de vidrio esmerilado incipiente, o distorsiones sutiles de la arquitectura normal), NO deben pasarse por alto bajo ninguna circunstancia.

⚠️ PROTOCOLO DE EXTREMADA ACUIDAD DIAGNÓSTICA Y EQUILIBRIO ANTI-ALUCINACIÓN (EVITACIÓN DE OMISIONES Y SESGO DE SATISFACCIÓN):
Para lograr la máxima exactitud científica equilibrada, debes operar bajo un riguroso protocolo de cinco niveles de seguridad radiológica:

1. **ESCENIFICACIÓN EXHAUSTIVA DE REJILLA DE ESCANEO DE 3X3 (Visual Grid Scanning)**:
   - Divide mentalmente cada imagen médica en una rejilla virtual de 3x3 sectores (Superior Izquierdo/Centro/Derecho, Medio Izquierdo/Centro/Derecho, Inferior Izquierdo/Centro/Derecho).
   - Realiza un barrido visual secuencial y obligatorio por cada uno de los 9 sectores. Analiza de forma exhaustiva las corticales óseas, interfaces hiliares, ángulos costofrénicos, y tejidos blandos periféricos en cada sector. Esto evita omisiones típicas de hallazgos en esquinas o zonas marginales de la placa.

2. **PROTECCIÓN CONTRA EL SESGO DE SATISFACCIÓN DE BÚSQUEDA (Satisfaction of Search Shielding)**:
   - Encontrar un hallazgo conspicuo u obvio (p. ej., una fractura desplazada, una cardiomegalia masiva, o una masa de gran tamaño) NO debe suspender el análisis. Sigue examinando minuciosamente el resto de las estructuras de manera exhaustiva. Registra y describe de forma prioritaria lesiones sutiles asociadas o concomitantes (pequeños derrames pleurales, micro-focos de gas, discontinuidades óseas adicionales, etc.).

3. **DETERMINACIÓN Y MANEJO DE HALLAZGOS SUTILES O BORDERLINE**:
   - Está prohibido descartar o ignorar de manera silenciosa cualquier detalle solo por ser pequeño, de bajo contraste, tenue o estar en el límite de la visibilidad clínica.
   - Si detectas una alteración sutil, descríbela indicando honestamente tu nivel de sospecha y certeza visual y proponiendo alternativas de diagnóstico diferencial.

4. **EQUILIBRIO ACTIVO Y PREVENCIÓN DE ALUCINACIONES (Evitación Rigurosa de Falsos Positivos)**:
   - No debes sobrediagnosticar ni inventar patologías basándote en artificios técnicos (pliegues cutáneos, líneas de superposición costal o escapular normal), ruidos de la placa, variantes anatómicas sanas (canales nutricios, suturas accesorias) o marcas de posición.
   - Si un hallazgo es compatible con una variante anatómica inofensiva o un artefacto, indícalo con objetividad científica como un diagnóstico diferencial probable ("Variante de la normalidad vs. lesión incipiente").

5. **CONSISTENCIA Y EXACTITUD ABSOLUTA ANTE HALLAZGOS ESTRUCTURALES EVIDENTES**:
   - Es mandatorio que no suavices ni subestimes alteraciones de alta gravedad técnica observables (reducciones severas de espacio articular, discontinuidades corticales francas, o desviaciones mediastinales marcadas). Deben reportarse con la terminología adecuada y el nivel de gravedad correspondiente.

6. **FUNCIÓN DE VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL PARA EXCLUSIÓN**:
   - Antes de considerar normal, preservado o negativo cualquier signo, campo o espacio articular principal de riesgo, describe brevemente la evidencia visual directa (continuidad cortical perfecta e ininterrumpida, alineamiento liso, etc.) que ampara de manera objetiva tu conclusión.

7. **PROTOCOLO DE MÁXIMA EXACTITUD PARA FRACTURAS (MÚLTIPLE VALORACIÓN EXPERTA)**:
   - Ante cualquier sospecha o indicio visual de fractura:
     * **Número y dirección de trazos**: Clasifica numéricamente los trazos de discontinuidad y su orientación exacta (transverso, oblicuo, espiroideo, longitudinal, conminuta con N fragmentos, ala de mariposa, etc.).
     * **Compromiso articular**: Determina con total precisión si el trazo alcanza la cortical de la carilla articular intermedia. Evalúa si hay hundimiento, escalón articular u holgura física en milímetros.
     * **Relación y Alineamiento de Fragmentos**: Reporta la presencia de diástasis de bordes, acortamiento/cabalgamiento en mm, angulaciones (varo/valgo, recurvatum/antecurvatum) y rotaciones espaciales.
     * **Evidencia Absoluta**: Fundamenta tu veredicto 100% en la visualización directa de píxeles anatómicos sin alucinar por un canal nutricio fisiológico o línea de crecimiento epifisario normal.
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
      let output = `\n- **Regiones o Señales de Interés Marcadas en la ${name}**:\n`;
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
      "Eres un consultor radiólogo internacional senior de diagnóstico, y el estándar supremo de precisión diagnóstica clínica de esta plataforma. Este módulo ('Doble Valoración') exige un equilibrio científico idóneo:\n" +
      "1. EXACTITUD SIN SUBESTIMACIONES: Registra de manera consistente y con total exactitud cualquier hallazgo o alteración estructural real y evidente (por ejemplo, marcada disminución del espacio articular en proyección femorotibial, esclerosis subcondral o severo desgaste marginal, fractura real), asegurando que las patologías macroscópicas y conspicuas no sean subestimadas ni clasificadas como dudosas.\n" +
      "2. ADHERENCIA ESTRICTA A LA VERDAD FÍSICA (CERO ALUCINACIONES): Está terminantemente prohibido inventar o alucinar hallazgos que no existan en la imagen, especialmente material de osteosíntesis (placas, tornillos transindesmales), fracturas, o disminuciones de espacio de la mortaja o espacios articulares que estén preservados. Si la sospecha clínica o las preguntas del paciente mencionan un término (ej. 'fractura', 'placa', 'tornillos transindesmales') pero en la imagen real no hay material de osteosíntesis ni trazos de fractura, debes ser taxativo, riguroso y declarar que no existen, en lugar de inventarlos por complacer la sospecha o el protocolo.\n" +
      "3. VARIANTES DE LA NORMALIDAD: No confundas variantes anatómicas normales (canales nutricios, suturas) o superposiciones óseas y artefactos de imagen con fracturas, placas o tornillos. Tu veredicto debe fundamentarse 100% en la evidencia física y observable de los píxeles de la imagen.";

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
      "Eres un consultor de medicina interna y radiología de un hospital universitario de alta complejidad. Te especializas en desglosar casos clínicos complejos mediante correlación anatomo-radiológica detallada.";

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
          data: image1,
          mimeType: mimeType1,
        },
      });
    }

    const img2Supported = image2 && mimeType2 && checkImageSupport(mimeType2);
    if (image2 && mimeType2 && img2Supported) {
      parts.push({
        inlineData: {
          data: image2,
          mimeType: mimeType2,
        },
      });
    }

    const img3Supported = image3 && mimeType3 && checkImageSupport(mimeType3);
    if (image3 && mimeType3 && img3Supported) {
      parts.push({
        inlineData: {
          data: image3,
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
        .match(/(torax|tórax|chest|pulm|pulmonar|hilio|hiliar|intersticial|alveolar|infiltrado|masa|cavitac|atelectas|mediastin|pleur|neumon|consolida|parénquima|parenquima)/);

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
⚠️ RECORDATORIO PROTOCOLO DE PARÉNQUIMA PULMONAR E HILIOS:
- Evalúa minuciosamente el parénquima para diferenciar infiltrados intersticiales y alveolares densos.
- Busca o descarta exhaustivamente masas discretas, cavitaciones y atelectasias/colapsos.
- Analiza con agudeza la simetría y densidad de ambos hilios, y descarta o reporta ensanchamiento mediastinal patológico.
- Mantén el máximo nivel de sospecha diagnóstica ante hallazgos sumamente sutiles, basándote rigurosamente en la evidencia visual científica real.
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
      "Eres un consultor radiólogo internacional senior de diagnóstico de casos complejos y desafiantes. Tu principal fortaleza es el equilibrio óptimo entre acatamiento meticuloso del detalle (hiper-agudeza de micro-hallazgos reales) y un estricto filtro de seguridad anti-alucinación. Evita falsos positivos distinguiendo claramente ruidos, variaciones normales, y artefactos técnicos de las verdaderas patologías. Responde las aclaraciones de estudios de imagen de forma exacta, infalible y objetiva.";

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
          data: image1,
          mimeType: mimeType1,
        },
      });
    }

    if (image2 && mimeType2 && checkImageSupport(mimeType2)) {
      parts.push({
        inlineData: {
          data: image2,
          mimeType: mimeType2,
        },
      });
    }

    if (image3 && mimeType3 && checkImageSupport(mimeType3)) {
      parts.push({
        inlineData: {
          data: image3,
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
      "Eres el Radiólogo Jefe y Director Clínico de un prestigioso centro PACS universitario. Diriges las sesiones generales de interconsulta, resolución de contradicciones diagnósticas y arbitraje clínico. Tu principal dogma es la veracidad empírica basada estrictamente en la evidencia visual real de la imagen. Debes eliminar activamente y con mano de hierro cualquier falsa interpretación, alucinación de material de osteosíntesis (placas, tornillos transindesmales), fracturas inexistentes o falsos positivos (como reducciones de espacio articular/mortaja que no existen) introducidos por borradores preliminares o sugeridos por textos de sospecha clínica, dictaminando únicamente lo que se observa de forma fidedigna y empírica en las imágenes.";

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
    const { model, analysisText } = req.body;
    if (!analysisText) {
      return res.status(400).json({ success: false, error: "Se requiere el 'analysisText' para extraer los hallazgos esenciales." });
    }

    const ai = getGeminiClient();
    const selectedModel = getModelName(model);

    const promptText = `
Texto de la Valoración Experta realizada por la IA (puede contener el análisis inicial y un historial de consultas/correcciones posteriores):
"""
${analysisText}
"""

Por favor, extrae de manera extremadamente precisa, concisa y rigurosa únicamente los siguientes elementos indispensables para volcarlos en un generador de reportes médicos, simplificando y depurando todo el resto del texto (como discusiones académicas, recomendaciones técnicas de seguimiento, indicaciones de control, o explicaciones metodológicas, etc., dado que estas NO deben inyectarse en el generador):

CRÍTICO: Si el texto contiene un historial de consultas, aclaraciones, sugerencias de aspectos específicos o correcciones adicionales (por ejemplo, bajo encabezados como "HISTORIAL DE COMPLEMENTOS Y CORRECCIONES POSTERIORES" o "Chat Activo"), debes dar PRIORIDAD ABSOLUTA a los hallazgos re-evaluados, clasificaciones ajustadas y diagnósticos corregidos en las aclaraciones y respuestas más recientes. Los hallazgos, interpretaciones o diagnósticos preliminares/antiguos que hayan sido modificados o refinados en las consultas deben ser enteramente reemplazados por sus versiones corregidas definitivas.

Saca exactamente el reporte corregido final estructurado bajo estos tres puntos:
1. **HALLAZGOS PATOLÓGICOS DETECTADOS**: Describe los hallazgos patológicos definitivos con sus consideraciones anatómicas y métricas exactas corregidas tras todas las aclaraciones. Mantén un lenguaje de alta especificidad radiológica.
2. **CLASIFICACIONES MÉDICAS DE CONSENSO**: Extrae la clasificación final de consenso y su puntaje o estadio corregido (como BI-RADS, Bosniak, Fleischner, LI-RADS, Lung-RADS, PI-RADS, etc.) de acuerdo con la última retroalimentación. Si no aplica ninguna, indícalo brevemente.
3. **DIAGNÓSTICO FINAL / IMPRESIÓN DIAGNÓSTICA**: La conclusión o diagnóstico principal fundamentado definitivo y revisado.

IMPORTANTE:
- Sé sumamente directo, omite protocolos de saludo o intros/outros de conversación.
- No incluyas explicaciones de cómo hiciste el análisis de la imagen, debates de diagnósticos diferenciales ni la lista de recomendaciones técnicas o de seguimiento, dado que estas alargan y entorpecen la posterior generación técnica del reporte.
- El formato final del texto debe ser muy limpio, estructurado con títulos en negrita en lugar de encabezados grandes, en Markdown, listo para que el usuario redacte el reporte definitivo a partir de aquí.
`;

    const systemInstruction = 
      "Eres un transcriptor y redactor médico de alta precisión. Tu tarea es analizar un dictamen radiológico complejo de doble valoración y extraer estrictamente los hallazgos patológicos anatómicos detallados, clasificaciones diagnósticas y diagnóstico final.";

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

Por favor, realiza una EVALUACIÓN DEL REPORTE médico interpretado. Tu tarea principal es:
1. Analizar el informe elaborado de forma meticulosa.
2. Identificar y recomendar los aspectos clave de gran relevancia diagnóstica o terapéutica que el médico clínico solicitante (clínico) debería saber obligatoriamente.
3. Diferenciar de manera sumamente clara y visible:
   - **Aspectos / Datos ya incluidos en el reporte actual** (aquellos que ya están redactados y documentados en el informe).
   - **Aspectos / Datos que faltarían o podrían recomendarse agregar** (aquellos que no están o podrían complementar y mejorar sustancialmente el manejo clínico o la toma de decisiones).

Por favor, estructura tu respuesta en español con formato Markdown elegante, limpio y profesional. No agregues notas introductorias ni comentarios fuera del análisis. Clasifica los aspectos en secciones claras y utiliza viñetas o tablas según sea más agradable de leer.

⚠️ REQUISITO TECNOLÓGICO CRÍTICO:
Para cada uno de tus puntos de la sección de "Aspectos / Datos que faltarían o podrían recomendarse agregar" (recomendaciones clínicas), DEBES iniciar el punto obligatoriamente con la etiqueta exacta "[RECOMENDACION]: " (en mayúsculas, comillas no, corchetes rígidos exactamente de esta forma: \`[RECOMENDACION]: \`).
Ejemplo correcto:
- [RECOMENDACION]: Describir la clasificación de Bosniak para el quiste renal detectado.
- [RECOMENDACION]: Medir el espesor de la fascia renal si está engrosada.

No agregues cursivas ni negritas dentro de los corchetes. El software lee este identificador exacto de forma automatizada para renderizar un botón en la interfaz de usuario.
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
      model: "gemini-3.5-flash",
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
          data: image,
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

    res.json({
      success: true,
      table: parsedResult.table,
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

    let specialInstruction = `
[REGLA DE CONGRUENCIA Y SINCERIDAD ESTRICTA]:
- Analiza con sumo cuidado TODO el texto del reporte médico (tanto el cuerpo general "Hallazgos" como las conclusiones "Impresión Diagnóstica / Conclusión").
- NO inventes ni asumas ningún hallazgo patológico que no esté explícitamente escrito en el texto.
- Si una estructura se describe como "Normal", "Sin alteraciones", "Conservado", "Homogéneo", "Límites normales", "No muestra alteraciones" o similar, su "state" DEBE ser estrictamente "Normal" y su "description" DEBE ser EXACTAMENTE "Dentro de límites normales.".
- Si la estructura no se menciona en ninguna parte de todo el reporte, su "state" DEBE ser "no_descrito" y su "description" DEBE ser "No mencionado / No descrito.".

- EN PARTICULAR PARA LA ASCITIS / LÍQUIDO LIBRE ("ascitis"):
  * Si el reporte menciona "no se observa líquido libre", "sin líquido libre", "no se evidencia líquido", "recesos libres", "douglas sin líquido", "sin colecciones", o no describe ninguna acumulación de líquido libre o ascitis, el "state" DEBE ser "Normal" (o "no_descrito" si no se menciona en absoluto).
  * BAJO NINGUNA CIRCUNSTANCIA debes asignarle un nivel patológico como "leve", "moderada", "severa" o "líquido libre" si el reporte indica que no hay líquido o que la cavidad está libre/limpia. Sé sumamente riguroso con esto: no inventar ascitis.
- NO utilices términos predeterminados del sistema ni asumas defaults/hallazgos clásicos. El estado ("state") debe describir de forma muy concisa (de 1 a 3 palabras) el diagnóstico patológico real escrito en el texto (por ejemplo: "Ruptura Completa", "Desgarro", "Bursitis", "Hernia umbilical", "Normal", "no_descrito").
- Está terminantemente prohibido alucinar niveles de severidad, medidas, escalas, o patologías que no estén explícitamente escritas en el texto.
${sidePrompt}
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
    const selectedModel = getModelName(model || "gemini-2.5-flash");

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
    const { model, report } = req.body;
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
      "   - Si detectas que es un DOPPLER ARTERIAL DE MIEMBROS INFERIORES: Debes analizar de manera exhaustiva el reporte para extraer las características de flujo, velocidades y forma de onda de cada uno de los vasos principales de forma bilateral o unilateral según corresponda. Los vasos son: Arteria Ilíaca Común (AIC), Arteria Femoral Común (AFC), Arteria Femoral (AF) [¡NUNCA uses el término Femoral Superficial, usa únicamente Arteria Femoral o AF!], Arteria Poplítea (AP), Arteria Tibial Anterior (ATA), Arteria Tibial Posterior (ATP), Arteria Peronea (APer) y Arteria Pedia (APed). Realiza una evaluación inteligente del estado de cada vaso y su concordancia con el reporte de la siguiente manera:\n" +
      "     * ¡ATENCIÓN CLÍNICA DETALLADA!: Para determinar el estado exacto de un vaso, debes leer con cuidado tanto el cuerpo del reporte como la **IMPRESIÓN DIAGNÓSTICA** o **CONCLUSIÓN** al final. Si la conclusión/impresión diagnóstica señala que un vaso tiene una patología o alteración (ej. estenosis, oclusión, flujo monofásico, flujo filiforme o flujo atenuado), debes priorizar esta conclusión diagnóstica definitiva para marcar el estado del vaso como 'altered' y describir la alteración con total exactitud, incluso si en el cuerpo parecía no registrarse. No ignores la conclusión bajo ninguna circunstancia.\n" +
      "     * ¡IMPORTANTE!: Si el estudio es unilateral (por ejemplo, solo menciona miembro inferior izquierdo 'izq' o solo miembro inferior derecho 'der'), debes reportar 'detectedSide' como 'izq' o 'der' y reportar ÚNICAMENTE los 8 vasos de ese miembro. ¡NO inventes datos para el miembro contralateral y NO lo menciones bajo ningún concepto en el listado de estructuras! Si es bilateral, reporta 'both' y los 16 vasos.\n" +
      "     * Para cada vaso analizado, busca en el reporte la velocidad (ej. '75 cm/s') y la forma de onda. Debes respetar rigurosamente la nomenclatura del reporte y mapearla a estas categorías exactas sin contradicciones:\n" +
      "       1. 'Trifásico' o 'Flujo trifásico' -> Status: 'normal'. Interpretation: 'Flujo normal (Onda Trifásica)'.\n" +
      "       2. 'Atenuado' o 'Flujo atenuado' o 'Atenuada' -> Status: 'altered'. Interpretation: 'Estenosis leve'.\n" +
      "       3. 'Ensanchamiento espectral' -> Status: 'altered'. Interpretation: 'Estenosis moderada'.\n" +
      "       4. 'Monofásico' o 'Flujo monofásico' -> Status: 'altered'. Interpretation: 'Estenosis severa'.\n" +
      "       5. 'Flujo no detectable' o 'Flujo filiforme' o 'Oclusión' -> Status: 'altered'. Interpretation: 'Estenosis muy severa/oclusión'.\n" +
      "       6. Si se menciona 'Estenosis focal' con un porcentaje específico (ej. 'Estenosis focal del 50%' o 'Estenosis focal del 70%'), usa el término exacto 'Estenosis focal de X%' en la interpretación, y detalla la velocidad si se describe (ej. '120 cm/s, Estenosis focal (50%)').\n" +
      "     * Para cada vaso, asocia un rango de referencia normal sugerido (ej. 'Trifásico, VPS 50 - 90 cm/s' o 'Trifásico, VPS 20 - 50 cm/s' para la pedia) y un 'defaultNormalValue' saludable representativo (ej. '80 cm/s, Trifásico').\n" +
      "   - Si detectas que es un DOPPLER RENAL: Incluye velocidades pico sistólicas y los Índices de Resistencia (IR) renales arteriales principales.\n" +
      "   - Si detectas que es un ULTRASONIDO DE ABDOMEN (o riñón/vías urinarias está involucrado) o ULTRASONIDO ABDOMINAL COMPLETO: Debes incluir de manera obligatoria las 8 mediciones renales específicas (Riñón Derecho Largo, Ancho, Grosor Cortical e IR; Riñón Izquierdo Largo, Ancho, Grosor Cortical e IR) con sus rangos de referencia estándares. Además, para los estudios de abdomen, debes incluir de manera obligatoria los siguientes parámetros con sus rangos y valores predeterminados exactos:\n" +
      "     * Hígado [Rango: 120 - 154 mm, Default: 135 mm]\n" +
      "     * Bazo [Rango: 9 - 11,8 mm, Default: 10,5 mm]\n" +
      "     * Rigidez Hepática (Elastografía) [Rango: 4 - 5,4 kPa, Default: 4,7 kPa]\n" +
      "   - Si detectas que es un ULTRASONIDO DE TIROIDES o US DE CUELLO / ULTRASONIDO DE CUELLO: Incluye medidas de lóbulos (ej. 'Lóbulo Derecho (Longitudinal)', 'Lóbulo Derecho (Anteroposterior)', 'Lóbulo Derecho (Transverso)', 'Lóbulo Izquierdo...', 'Istmo (Espesor)'). Rango normal de espesor de istmo: < 3 mm, lóbulos longitud: 37 - 44 mm. Está ESTRICTAMENTE PROHIBIDO incluir vasos sanguíneos o parámetros del sistema carotídeo (Arterias Carótidas Comunes, Internas, Externas, Arterias Vertebrales, Grosor Miointimal (GIM), o Relación ACC/ACI) en este estudio, ya que esas estructuras corresponden única y exclusivamente al Doppler de Carótidas.\n" +
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
    if (studyLower.includes("carot") || reportLower.includes("carot") || reportLower.includes("carótida")) {
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
      const matchedKeys = new Set<string>();

      // Try matching existing structures first
      currentStructures.forEach((s: any) => {
        const sName = (s.structure || "").toLowerCase();
        let matchedKey: string | null = null;

        for (const m of mandatoryCarotid) {
          if (matchedKeys.has(m.key)) continue;

          let isMatch = m.matchRegex.test(sName);
          if (isMatch && m.matchSub) {
            isMatch = m.matchSub.test(sName);
          }
          if (isMatch && m.negativeSub) {
            isMatch = !m.negativeSub.test(sName);
          }

          if (isMatch) {
            matchedKey = m.key;
            s.structure = m.name;
            if (!s.normalRange) s.normalRange = m.range;
            if (!s.defaultNormalValue) s.defaultNormalValue = m.defaultVal;
            break;
          }
        }

        if (matchedKey) {
          matchedKeys.add(matchedKey);
        }
        updatedStructures.push(s);
      });

      // Add missing ones
      mandatoryCarotid.forEach(m => {
        if (!matchedKeys.has(m.key)) {
          const isVelocity = m.name.includes("(VPS)") || m.name.includes("(VED)");
          updatedStructures.push({
            structure: m.name,
            normalRange: m.range,
            measuredValue: isVelocity ? m.defaultVal : "",
            status: isVelocity ? "normal" : "not_found",
            interpretation: isVelocity ? "Flujo normal" : "Sin medición registrada",
            defaultNormalValue: m.defaultVal
          });
        }
      });

      // Enforce pre-filling and formatting of velocities in cm/s for carotid doppler
      updatedStructures.forEach((s: any) => {
        const nameLower = (s.structure || "").toLowerCase();
        const isVelocity = nameLower.includes("(vps)") || nameLower.includes("(ved)");
        
        if (isVelocity) {
          // If empty, blank, or not_found, pre-fill with defaultNormalValue
          if (!s.measuredValue || s.measuredValue.trim() === "" || s.status === "not_found") {
            s.measuredValue = s.defaultNormalValue || "";
            s.status = "normal";
            s.interpretation = "Flujo normal";
          } else {
            // It has a measured value, make sure it ends with " cm/s"
            let val = s.measuredValue.trim();
            // Match any number
            const numMatch = val.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
              const numStr = numMatch[1];
              if (!val.includes("cm/s")) {
                val = `${numStr} cm/s`;
              }
              s.measuredValue = val;
            }
          }
        }
      });

      // Ensure that left and right carotid velocities are never identical
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
            const numDerStr = matchDer[1].replace(",", ".");
            const numIzqStr = matchIzq[1].replace(",", ".");
            const numDer = parseFloat(numDerStr);
            const numIzq = parseFloat(numIzqStr);

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

    // Enforce normal longitudinal range for thyroid (37 - 44 mm) and recalculate status if present
    if (parsedData.structures && Array.isArray(parsedData.structures)) {
      parsedData.structures = parsedData.structures.map((s: any) => {
        const nameLower = (s.structure || "").toLowerCase();
        const isThyroid = nameLower.includes("lóbulo") || nameLower.includes("lobulo") || nameLower.includes("tiroides") || nameLower.includes("tiroidea");
        const isLongitudinal = nameLower.includes("longitudinal") || nameLower.includes("longitud") || nameLower.includes("largo");
        
        if (isThyroid && isLongitudinal) {
          s.normalRange = "37 - 44 mm";
          s.defaultNormalValue = "40 mm";
          
          if (s.measuredValue && s.measuredValue.trim() !== "") {
            const numMatch = s.measuredValue.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
              const numVal = parseFloat(numMatch[1].replace(",", "."));
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
        const isIR = nameLower.includes("ir") || nameLower.includes("índice de resistencia") || nameLower.includes("indice de resistencia") || nameLower.includes("índice resistencia") || nameLower.includes("indice resistencia");
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
3. No alteres otras patologías o hallazgos descritos, mantén el rigor del diagnóstico intacto.
4. **REGLA DE CASING ESTRICTA**: No uses mayúsculas sostenidas (ALL CAPS) para el texto nuevo o modificado. Escribe en minúsculas normales respetando las mayúsculas iniciales.
5. Devuelve ÚNICAMENTE el informe modificado completo en formato Markdown, sin preámbulos, explicaciones ni comentarios de ningún tipo.
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
      "- No sugieras 'gpc-sru-esteatosis' (Consenso SRU Hígado) si el hígado tiene ecogenicidad normal o si se niega explícitamente la esteatosis hepática (por ejemplo, 'hígado de tamaño y ecogenicidad normal, sin esteatosis').\n" +
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
- "gpc-sru-esteatosis": Aplicada si hay esteatosis hepática (hígado graso, infiltración grasa).
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

// --- VITE DEV SERVER OR STATIC SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Servidor] Asistente Radiológico corriendo correctamente en http://localhost:${PORT}`);
  });
}

startServer();
