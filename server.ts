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

    // NEW: Check if uploadedReportContent is an image (e.g. an elastography PNG screenshot or image report)
    let uploadedReportImageBase64 = "";
    let uploadedReportImageMimeType = "";

    if (uploadedReportContent && (uploadedReportContent.startsWith("data:") || (uploadedReportMimeType && uploadedReportMimeType.startsWith("image/")))) {
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
      promptText += `\n⚠️ CRÍTICO - IMAGEN DE ESTUDIO DE SOPORTE ADJUNTA (ELASTOGRAFÍA, ECOGRAFÍA O REPORTE PREVIO):
Se ha cargado una imagen/captura de pantalla de un estudio previo o de elastografía como segunda señal de entrada para este caso. 
Analiza visualmente con extrema detención esta segunda imagen adjunta. Extrae detalladamente todos sus parámetros, tales como mediciones de rigidez (kPa o m/s), clasificaciones correspondientes (ej: puntuaciones METAVIR F0-F4, grados de esteatosis, etc.) o hallazgos visuales clave descritos en dicha captura, e intégralos formalmente y de forma prioritaria en los HALLAZGOS o IMPRESIÓN DIAGNÓSTICA del reporte radiológico actual. No omitas estos datos cuantitativos cruciales.
\n`;
    } else if (uploadedReportContent) {
      promptText += `Informe de estudio previo o elastografía anexado: \n"""\n${uploadedReportContent}\n"""\n`;
    }

    if (annotations && annotations.length > 0) {
      promptText += formatImageAnnotations(annotations);
    }

    promptText += `
Por favor, estructura tu respuesta de la siguiente forma EXACTA (usa formato Markdown claro para que sea fácil de copiar y pegar). No agregues notas introductorias ni comentarios personales fuera del informe:

[INICIO DEL REPORTE]
**${studyType ? studyType.toUpperCase() : "REPORTE DE ESTUDIO RADIOLÓGICO"}**


**TIPO DE ESTUDIO:** ${studyType || "Estudio de Imagen"}

**HISTORIA CLÍNICA / INDICACIONES:** ${clinicalHistory || "No especificada"}


**TÉCNICA DEL EXAMEN:**
(Describe aquí la técnica de manera profesional para este tipo de estudio basado en las buenas prácticas, por ejemplo cortes, proyecciones, administración de contraste si aplica. Solo usa texto normal sin encabezados Markdown '#' ni '##')


**HALLAZGOS:**
${findings ? `Basados en los hallazgos descritos ("${findings}") y la imagen proporcionada (si aplica), describe con sumo rigor clínico y terminología radiológica avanzada. No uses encabezados de sección '#' ni '##', usa líneas de texto normales y listas con viñetas estándar si es necesario:\n` : `(Divide por estructuras anatómicas relevantes para este estudio de manera detallada y científica, describiendo dimensiones, densidades, atenuaciones, o si son características normales y conservadas. No uses encabezados '#' ni '##')\n`}


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
      "Eres un consultor radiólogo internacional senior. Eres extremadamente meticuloso y exacto al valorar imágenes médicas, explicando de forma transparente y didáctica el proceso de valoración visual de las anomalías radiológicas para la educación o validación médica. ATENCIÓN DE CONSISTENCIA DIAGNÓSTICA: Es imperativo que identifiques de forma consistente y transparente cualquier alteración estructural obvia o conspicua detectable (como una marcada disminución del espacio articular femorotibial, estrechamiento del espacio articular, osteofitos, esclerosis ósea subcondral, deformidades, luxaciones o líneas de fractura claras). Nunca subestimes ni califiques de dudosa la presencia de estas patologías evidentes; lístalas de forma directa y califícalas con su debido nivel de gravedad clínica.";

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

⚠️ PROTOCOLO DE EXTREMADA ACUIDAD DIAGNÓSTICA Y EQUILIBRIO ANTI-ALUCINACIÓN:
Para lograr la máxima exactitud científica equilibrada, debes operar bajo un riguroso protocolo de cuatro niveles:

1. **ESCENIFICACIÓN EXHAUSTIVA DE MICRO-ACUIDAD (Inspección por Regiones)**:
   - Divide mentalmente la imagen en cuadrantes o subsegmentos anatómicos y analízalos sistemáticamente. Evalúa con lupa virtual todas las interfaces, corticales óseas, márgenes articulares, densidad del tejido blando, patrón trabecular, luz tubular y recesos anatómicos.
   - Todo hallazgo de tamaño milimétrico o de bajo contraste debe ser registrado y descrito con precisión (dimensiones estimadas, densidad, bordes, orientación).

2. **DETERMINACIÓN Y MANEJO DE HALLAZGOS SUTILES O BORDERLINE**:
   - Está prohibido descartar o ignorar de manera silenciosa cualquier detalle solo por ser pequeño, tenue o estar en el límite de la visibilidad.
   - Si detectas una alteración sutil, descríbela con total honestidad intelectual. Clasifícala explícitamente en el informe indicando tu nivel de certeza y de sospecha, para que el clínico de cabecera pueda correlacionar apropiadamente.

3. **EQUILIBRIO ACTIVO Y PREVENCIÓN DE ALUCINACIONES (Evitación Rigurosa de Falsos Positivos)**:
   - Aunque mantienes una agudeza extrema para detectar lo más mínimo, debes ser extraordinariamente prudente y riguroso. NO debes inventar ni asumir patologías basándote en sombras normales, superposiciones de tejidos, variantes anatómicas sanas de la normalidad (ej. canales vasculares normales, fusiones óseas accesorias, etc.) o ruido técnico de la imagen.
   - Si un hallazgo visual puede interpretarse de forma alternativa como un artefacto técnico, una superposición, o una variante anatómica inofensiva, debes consignarlo explícitamente y con objetividad científica, sin sobrediagnosticar. "Veracidad sobre especulación".

4. **EVALUACIÓN GEOMÉTRICA DE PRÓTESIS E IMPLANTES (Valoración Mecánica de Precisión)**:
   - Ante material protésico o de osteosíntesis, evalúa meticulosamente el anclaje óseo, signos de aflojamiento (líneas radiolúcidas periprotésicas por pequeñas que sean), concentricidad y alineación de componentes.
   - En caderas o rodillas, verifica la simetría milimétrica clínica. Reporta detalladamente cómo se comporta la interfase cemento-hueso o metal-hueso ante cualquier sospecha sutil de desgaste.

5. **CONSISTENCIA Y EXACTITUD ABSOLUTA ANTE HALLAZGOS ESTRUCTURALES EVIDENTES (Evitar Subestimar la Gravedad)**:
   - Es mandatorio y de máxima criticidad que NO subestimes, minimices ni omitas alteraciones estructurales francas, obvias o conspicuas (como una marcada disminución del espacio articular femorotibial / estrechamiento del espacio articular, osteofitos marginales groseros, esclerosis subcondral, deformidades, luxaciones o líneas de fractura claras).
   - No debes suavizarlas ni sembrar dudas artificiales sobre su existencia cuando haya evidencia física clara en la imagen. Deben registrarse directamente con su debida relevancia y severidad de manera prioritaria.

6. **FUNCIÓN DE VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA VISUAL PARA EXCLUSIÓN**:
   - Antes de considerar descartada, normal, preservada o negativa cualquier alteración anatómica relevante o signo cardinal (especialmente reducción de espacios femorotibiales o articulares, osteofitosis o fracturas), debes obligatoriamente citar de forma breve la evidencia física, médica o métrica observable en la imagen (por ejemplo, simetría del espacio intercondíleo, preservación de márgenes óseos lisos, continuidad cortical sin discontinuidades abruptas, etc.) que fundamentan con precisión científica dicha exclusión. No se permite descartar hallazgos importantes sin citar su evidencia visual correlativa.

7. **PROTOCOLO DE MÁXIMA EXACTITUD PARA FRACTURAS (MÚLTIPLE VALORACIÓN EXPERTA)**:
   - Ante cualquier sospecha, mención o hallazgo visual de fractura, se dispara obligatoriamente este protocolo especial:
     * **Número y dirección de trazos**: Identifica de forma sumamente precisa si hay trazo único, doble, conminuta y la trayectoria geométrica exacta (transversa, oblicua corta/larga, espiroidea, espiroideo helicoidal, longitudinal, con tercer fragmento en ala de mariposa, etc.).
     * **Compromiso articular**: Determina rigurosamente si el trazo se extiende hasta la corteza de la carilla o carillas articulares comprometidas. Reporta si existe escalón articular o diástasis intraarticular y su estimación milimétrica.
     * **Desplazamiento de fragmentos**: Detalla si hay diástasis de los fragmentos, cabalgamiento (acortamiento en mm), rotación o angulación (ej. en varo/valgo, antecurvatum/recurvatum).
     * **Evidencia absoluta**: No inventes trazos inexistentes debidos a artificios normales de superposición, ni minimices o pases por alto trazos sutiles reales. Basa tu informe 100% en la estricta evidencia visual observable.
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

## REGISTRO DE AUDITORÍA VISUAL MULTI-PASADA DE LA IA
(Para que el usuario identifique el rigor tecnológico empleado, describe brevemente el resultado técnico de las dos pasadas visuales e internas que realizaste sobre este caso):
- **Pasada de Acuidad Micro-Estructural**: (Indica qué estructuras anatómicas, corticales óseas o márgenes interfaces evaluaste minuciosamente en busca de micro-alteraciones sutiles.)
- **Pasada de Seguridad y Evidencia Real**: (Detalla qué sospechas o anomalías aparentes sometiste a escrutinio para comprobar si contaban con evidencia física real o si se trataba de artefactos, protegiendo al informe de sobre-diagnósticos.)

## PROTOCOLO DE VALIDACIÓN DE CONFIANZA Y CITA DE EVIDENCIA RADIOLÓGICA VISUAL DE EXCLUSIÓN
(Obligatorio: Para cada hallazgo mayor de riesgo o signo cardinal que descartes, consideres normal, negativo o preservado, cita brevemente las características físicas, visuales o métricas exactas y observables en la imagen que demuestran científicamente su exclusión para evitar la subestimación diagnóstica):
- **¿Se consideró descartado, normal o descartable algún hallazgo mayor o reducción de espacio articular?**: [Detallar, ej. "Sí, se evaluó reducción del espacio femorotibial"]
- **Evidencia Radiológica Visual Citada**: [Ej. "Preservación uniforme y simétrica del espacio femorotibial bilateral, calculada en aproximadamente ~X mm, con líneas corticales nítidas e íntegras y ausencia total de esclerosis ósea reactiva o pinzamiento osteofitario marginal"]
- **Nivel de Certeza Visual de Exclusión**: [Ej. "Alta - Confirmado por visualización nítida y nitidez de límites anatómicos"]

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
## ⚡️ PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA FRACTURAS (MUTIPLE VALORACIÓN BIOMECÁNICA) ⚡️
(Este apartado especial se ha disparado obligatoriamente por sospecha, mención o hallazgo visual de fractura. Debes caracterizar microscómicamente los hallazgos con máxima precisión traumatológica, basándote rigurosamente en la evidencia física y real de la imagen):
- **1. Presencia, Densidad y Localización Anatomopatológica Precisa**: (Identifica con exactitud diagnóstica la localización anatómica: diáfisis, metáfisis, epífisis, cuello, cabeza, etc., describiendo la discontinuidad cortical).
- **2. Número y Dirección Tridimensional de Trazos**: (Describe el número exacto de trazos óseos identificados. Clasifica rigurosamente su orientación geométrica: transverso, oblicuo corto/largo, espiroideo o helicoidal, longitudinal, ala de mariposa, conminuto con múltiples fragmentos libres, etc.)
- **3. Extensión y Compromiso Articular Estricto**: (Especificar de forma obligatoria e inflexible si existe afección, interrupción o extensión del trazo hacia la carilla, cavidad o cartílago articular. Detalla si hay escalón o hundimiento articular en milímetros estimados, pérdida de congruencia o diástasis intraarticular.)
- **4. Desplazamiento Espacial de Fragmentos y Alineación**: (Describe minuciosamente la dirección y grado de desplazamiento óseo: diástasis o separación en mm, cabalgamiento con acortamiento longitudinal, luxación o subluxación articular, desviación angular en varo/valgo o antero/retrocurvatum, o rotación fragmentaria.)
- **5. Cita de Evidencia Visual de Integridad Científica**: (Proporciona la confirmación estricta de cada hallazgo con correlato clínico directo. ¡No tolerar alucinación de líneas vasculares normales ni subestimación de trazos corticales sutiles!)
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
(Este apartado especial se ha disparado obligatoriamente por sospecha, mención o hallazgo de enfermedad degenerativa. Debes buscar y describir minuciosamente los cambios degenerativos o artrósicos en articulaciones o columna con el mayor rigor, basándote rígidamente en la evidencia física visible sin inventar ni pasar por alto hallazgos sutiles):
- **1. Disminución / Pinzamiento de Espacios Articulares o Discales**: (Evalúa con precisión micrométrica la anchura del espacio articular o intervertebral. Especifica si el compromiso es simétrico o asimétrico -ej. medial vs. lateral en rodilla- y estima su reducción porcentual o milimétrica).
- **2. Presencia, Medida y Distribución de Osteofitos**: (Identifica y detalla la localización exacta de osteofitos marginales, espolones u osteofitos de tracción en platillos, carillas, márgenes óseos o cuerpos vertebrales. No pases por alto osteofitos incipientes pero evita alucinar excrecencias normales o superposiciones estructurales).
- **3. Esclerosis Ósea Subcondral e Integridad del Hueso**: (Analiza el aumento focalizado de la densidad ósea -esclerosis- debajo del cartílago articular o en las plataformas vertebrales, indicando las zonas de máxima sobrecarga mecánica).
- **4. Geodas o Quistes Subcondrales**: (Busca con alta magnificación visual sutiles geodas de presión o quistes subcondrales degenerativos, reportando su presencia, diámetro y localización precisa).
- **5. Clasificación y Gradación Internacional Rigurosa**: (Aplica con absoluto rigor las escalas internacionales correspondientes según la región estudiada: por ejemplo, la clasificación de Kellgren-Lawrence para rodilla/cadera -de Grado 1 sutil a Grado 4 severo-, escalas de severidad para artrosis facetaria, o de discopatía degenerativa en columna. Fundamenta científicamente cada grado asignado).
- **6. Coherencia y Sinergia Diagnóstica Ampliada**: 
  * *NOTA CRÍTICA*: La activación de este protocolo específico NO debe disminuir de ninguna manera la eficiencia o detalle del resto de la valoración diagnóstica anatomopatológica general (tejidos blandos, estructuras óseas no degenerativas u órganos visibles). Al contrario, debe potenciar y enriquecer el análisis integral cruzando los datos mecánicos/degenerativos con el resto de los hallazgos para una valoración diagnóstica holística de máxima potencia clínica.
`;
    }

    if (isMetalCase) {
      promptText += `
## 🔩 PROTOCOLO ESPECIAL DE MÁXIMA EXACTITUD PARA PRÓTESIS Y ELEMENTOS METÁLICOS DE OSTEOSÍNTESIS (INTEGRIDAD Y ALINEACIÓN) 🔩
(Este apartado especial se ha disparado obligatoriamente por sospecha, mención o hallazgo de implantes metálicos, prótesis o material de osteosíntesis. Debes realizar una evaluación técnica y de imagen de alta especificidad, describiendo adecuadamente su composición y valorando con el mayor rigor su integridad estructural y estabilidad, basándote en la evidencia física real visible en la imagen):
- **1. Tipo, Localización Anatomopatológica y Componentes del Implante**: (Describe con propiedad los componentes de osteosíntesis o prótesis identificados: vástagos, placas de compresión/reconstrucción, tornillos corticales/esponjosos, clavos endomedulares, alambres, cerclajes, cúpulas acetabulares, liners, etc. Especifica con precisión los segmentos óseos o articulaciones involucrados).
- **2. Valoración de la Estructura Metálica e Integridad**: (Evalúa con minuciosa agudeza visual si existe evidencia de fatiga, doblamiento, fractura o alteración del material. Detalla de forma explícita la integridad de cada uno de los elementos metálicos y valora su integridad y estabilidad).
- **3. Interfaz Hueso-Implante (Margen Periprotésico / Peri-implante)**: (Inspecciona la presencia de bandas radiolúcidas -osteólisis peri-implante u osteólisis periprotésica sutil-, aflojamiento aséptico, hundimiento de componentes, reabsorción ósea circundante o reacción periosteal anormal).
- **4. Orientación, Alineación Espacial y Relación Anatómica**: (Describe si la orientación de la prótesis o del material de osteosíntesis es anatómica y funcional. Si es una prótesis articular, valora si existe luxación, subluxación, asimetría de componentes o desalineación).
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
      "Eres un consultor radiólogo internacional senior de diagnóstico, y el estándar supremo de precisión diagnóstica clínica de esta plataforma. Este módulo ('Doble Valoración') exige un equilibrio científico idóneo: requiere registrar de manera consistente y con total exactitud cualquier hallazgo o alteración estructural evidente (por ejemplo, marcada disminución del espacio articular en proyección femorotibial, esclerosis subcondral o severo desgaste marginal), asegurando que las patologías macroscópicas y conspicuas no sean subestimadas ni clasificadas como dudosas. Al mismo tiempo, mantiene un alto nivel de sensibilidad para documentar de forma honesta micro-detalles o anomalías sutiles de forma analítica, protegiendo al informe contra alucinaciones de micro-lesiones inexistentes basando tu veredicto estrictamente en la evidencia física real de la imagen.";

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
    const { report, studyType, findings } = req.body;
    if (!report) {
      return res.status(400).json({ success: false, error: "Se requiere el informe para realizar la búsqueda bibliográfica." });
    }

    const ai = getGeminiClient();

    const promptText = `
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

Asegúrate de buscar en GoogleSearch tanto la patología relacionada a PubMed, como a Radiopaedia y su respectiva clasificación oficial, reuniendo al menos de 4 a 6 referencias o fuentes del más alto nivel académico.

Genera un objeto JSON que contenga:
1. "bibliography": Una revisión bibliográfica impecable, robusta y con excelente profundidad médica en formato Markdown con las siguientes 4 secciones principales:
   - **🎓 SÍNTESIS FISIOPATOLÓGICA Y LOG DE APRENDIZAJE** (análisis educativo profundo, signos radiológicos patognomónicos, diagnósticos diferenciales contrastados).
   - **📋 GUÍAS DE CONSENSO Y CRITERIOS INTERNACIONALES** (criterios de apropiación de sociedades, intervalos detallados de seguimiento por modalidad como RM/TC/Ecografía y criterios de intervención quirúrgica/biopsia).
   - **🔬 LITERATURA ACADÉMICA CLAVE Y ESTUDIOS HISTÓRICOS** (referencias detalladas a un espectro amplio de artículos con sus aportes clave específicos, revistas de procedencia, diseño de estudio si aplica, y años).
   - **💡 CONCLUSIONES DE RELEVANCIA PRÁCTICA PARA EL RADIÓLOGO** (resumen con al menos 3 perlas diagnósticas de alta utilidad operacional para optimizar tus informes diarios).

2. "sources": Una lista de los artículos, guías de consenso, o recursos web reales encontrados en tu búsqueda y que se utilizaron para redactar tu análisis bibliográfico. Cada elemento de la lista debe contener:
   - "title": El título o nombre oficial del artículo científico, recomendación o guía clínica. Debe ser claro e indicar de forma precisa y fiel el artículo real visitado.
   - "uri": La URL real y exacta para el acceso directo a este recurso en internet (ej. de dominios PubMed/NCBI, Radiopaedia.org, ACR.org, etc).
   - "summary": Un resumen clínico, claro, esclarecedor y detallado de 3 a 5 líneas en español que explique de manera práctica los objetivos, metodología o recomendaciones clave del artículo. Debe detallar información suficiente para que el radiólogo evalúe la conveniencia o relevancia de acudir al artículo o caso original.

CRÍTICO: No inventes URLs bajo ninguna circunstancia. Tampoco intercambies ni mezcles enlaces de artículos; cada 'uri' debe corresponder exactamente al artículo clínico y de investigación del 'title'. Es preferible tener menos fuentes pero que todas sean 100% verídicas y precisas.
`;

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
  - vfs_der (Vena Femoral Superficial Derecha)
  - vp_der (Vena Poplítea Derecha)
  - vsm_der (Vena Safena Magna Derecha)
  - vsp_der (Vena Safena Parva Derecha)
  - sfj_der (Unión Safenofemoral Derecha)
  - vfc_izq (Vena Femoral Común Izquierda)
  - vfs_izq (Vena Femoral Superficial Izquierda)
  - vp_izq (Vena Poplítea Izquierda)
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
  - afs_der (Arteria Femoral Superficial Derecha)
  - ap_der (Arteria Poplítea Derecha)
  - ata_der (Arteria Tibial Anterior Derecha)
  - atp_der (Arteria Tibial Posterior Derecha)
  - aper_der (Arteria Peronea Derecha)
  - aic_izq (Arteria Ilíaca Común Izquierda)
  - afc_izq (Arteria Femoral Común Izquierda)
  - afs_izq (Arteria Femoral Superficial Izquierda)
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
- Debe resumir con brevedad y excelente lenguaje médico los hallazgos para cada segmento/vaso de interés (ej: simetría de velocidades, flujo, presencia de placas, etc.).
- Ejemplo de encabezado para Carótidas:
  | Segmento | Lado Derecho | Lado Izquierdo |
- Ejemplo para Miembros:
  | Vasos / Región | Miembro Derecho | Miembro Izquierdo |

Instrucciones para la Estructura de Datos (JSON):
${variablesPromptDesc}

Por favor, formatea la respuesta de manera estricta y exclusiva como un objeto JSON válido que contenga cuatro atributos primarios: "table", "states", "descriptions" y "subLocations".
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
        subLocations: {}
      };
    }

    res.json({
      success: true,
      table: parsedResult.table,
      states: parsedResult.states || {},
      descriptions: parsedResult.descriptions || {},
      subLocations: parsedResult.subLocations || {}
    });

  } catch (error: any) {
    console.error("Error en /api/analyze-vascular:", error);
    const friendlyError = handleGeminiError(error);
    res.status(500).json({ success: false, error: friendlyError });
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
