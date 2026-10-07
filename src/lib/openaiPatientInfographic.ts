/**
 * OpenAI GPT Image helper for patient-education infographics.
 * Secret must live only in server env: OPENAI_API_KEY
 */

import OpenAI from "openai";

export function cleanOpenAiKey(key: string): string {
  if (!key) return "";
  let clean = key.trim();
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, "");
  clean = clean.replace(/\\"/g, '"').replace(/\\'/g, "'");

  if (clean.includes("=")) {
    const parts = clean.split("=");
    const prefix = parts[0].toLowerCase();
    if (
      prefix.includes("openai") ||
      prefix.includes("secret") ||
      prefix.includes("key") ||
      prefix.includes("export") ||
      prefix.includes("env")
    ) {
      clean = parts.slice(1).join("=").trim();
    }
  }

  const quoteChars = ['"', "'", "\u201c", "\u201d", "\u2018", "\u2019", "`", "\\"];
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
    if (clean !== beforeTrim) changed = true;
  }
  return clean;
}

export function hasOpenAiApiKey(): boolean {
  return Boolean(cleanOpenAiKey(process.env.OPENAI_API_KEY || ""));
}

export type OpenAiInfographicResult = {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  model: string;
  quality: string;
  size: string;
};

/** Keep prompt under image-API comfort zone while preserving findings. */
export function truncateReportForImagePrompt(report: string, maxChars = 5500): string {
  const text = String(report || "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[…informe truncado para la infografía; usa solo lo anterior…]`;
}

/**
 * Medium-quality vertical poster via gpt-image-1 (ChatGPT-class typography).
 */
export async function generatePatientInfographicOpenAI(
  promptText: string
): Promise<OpenAiInfographicResult> {
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ override: true });
  } catch (_) {}

  const apiKey = cleanOpenAiKey(process.env.OPENAI_API_KEY || "");
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Añade la Secret Key de OpenAI como secreto del servidor."
    );
  }

  const openai = new OpenAI({ apiKey });
  // SDK / API stable model id. Do NOT default to gpt-image-1.5 (often rejected → silent Gemini fallback).
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const quality = (process.env.OPENAI_IMAGE_QUALITY?.trim() || "medium") as
    | "low"
    | "medium"
    | "high"
    | "auto";
  const size = (process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1536") as
    | "1024x1024"
    | "1024x1536"
    | "1536x1024"
    | "auto";

  const modelsToTry = Array.from(
    new Set([model, "gpt-image-1"].filter(Boolean))
  );

  let lastError: any = null;
  for (const tryModel of modelsToTry) {
    try {
      const result = await openai.images.generate({
        model: tryModel,
        prompt: promptText,
        size,
        quality,
        output_format: "png",
        n: 1,
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("OpenAI no devolvió imagen (b64_json vacío).");
      }

      return {
        base64: b64,
        mimeType: "image/png",
        model: tryModel,
        quality,
        size: String(size),
      };
    } catch (err) {
      lastError = err;
      console.warn(`OpenAI images.generate falló con modelo ${tryModel}:`, (err as any)?.message || err);
    }
  }

  throw lastError || new Error("No se pudo generar la infografía con OpenAI.");
}

export function handleOpenAiError(error: any): string {
  const msg = String(error?.message || error || "");
  const lower = msg.toLowerCase();
  if (lower.includes("incorrect api key") || lower.includes("invalid_api_key")) {
    return "La Secret Key de OpenAI (OPENAI_API_KEY) fue rechazada. Crea una nueva en platform.openai.com/api-keys y actualiza el secreto.";
  }
  if (lower.includes("insufficient_quota") || lower.includes("billing") || lower.includes("quota")) {
    return "OpenAI indica cuota/billing insuficiente. Revisa facturación y límite de gasto en platform.openai.com.";
  }
  if (lower.includes("organization") && lower.includes("verif")) {
    return "OpenAI pide verificación de organización para generar imágenes. Complétala en la configuración de la cuenta API.";
  }
  if (lower.includes("moderation") || lower.includes("safety") || lower.includes("blocked")) {
    return "OpenAI bloqueó el contenido por moderación. Prueba regenerar sin datos identificables del paciente.";
  }
  if (lower.includes("rate_limit") || lower.includes("429")) {
    return "Límite de ritmo de OpenAI alcanzado. Espera un momento y vuelve a generar la infografía.";
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("invalid"))) {
    return `Modelo de imagen OpenAI no disponible (${msg}). Usa gpt-image-1 en OPENAI_IMAGE_MODEL.`;
  }
  return `Error OpenAI (ChatGPT Image): ${msg || "fallo desconocido"}`;
}
