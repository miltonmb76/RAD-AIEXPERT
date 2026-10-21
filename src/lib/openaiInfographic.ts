import OpenAI from "openai";
import { cleanOpenAiKey } from "./openaiPatientSummary";
import { redactPatientIdentifiersForInfographic } from "./infographicPrivacy";

export const DEFAULT_INFOGRAPHIC_IMAGE_MODEL = "gpt-image-2.5-flare";
let activeGenerations = 0;

export class InfographicProviderError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function requireOpenAiInfographicKey(): string {
  const key = cleanOpenAiKey(process.env.OPENAI_API_KEY || "");
  if (!key) throw new InfographicProviderError(
    "OpenAI no está configurado en el servidor. La opción Gemini sigue disponible.", 503);
  return key;
}

/** Keep upstream details, keys and clinical prompt text out of browser errors/logs. */
export function infographicProviderError(error: unknown): InfographicProviderError {
  if (error instanceof InfographicProviderError) return error;
  const status = Number((error as { status?: number })?.status);
  if (status === 401 || status === 403) return new InfographicProviderError(
    "OpenAI no autorizó la generación. Revisa el acceso al modelo de imágenes en la cuenta del servidor.", 502);
  if (status === 429) return new InfographicProviderError(
    "OpenAI alcanzó su límite de uso o saldo. Puedes conservar la infografía actual e intentarlo después.", 429);
  if ((error as { name?: string })?.name?.includes("Timeout")) return new InfographicProviderError(
    "OpenAI tardó demasiado. Se conserva la infografía actual; puedes volver a intentarlo.", 504);
  return new InfographicProviderError(
    "No se pudo generar la infografía con OpenAI. Se conserva la versión actual.", 502);
}

export async function generateOpenAiInfographic(prompt: string, signal?: AbortSignal) {
  const apiKey = requireOpenAiInfographicKey();
  if (activeGenerations >= 2) throw new InfographicProviderError(
    "Ya hay dos infografías de OpenAI en proceso. Espera a que termine una.", 429);
  activeGenerations++;
  try {
    const model = (process.env.OPENAI_INFOGRAPHIC_MODEL || DEFAULT_INFOGRAPHIC_IMAGE_MODEL).trim();
    const client = new OpenAI({ apiKey, timeout: 180_000, maxRetries: 0 });
    const start = Date.now();
    const result = await client.images.generate({
      model, n: 1, size: "1024x1536", quality: "high", output_format: "png",
      prompt: redactPatientIdentifiersForInfographic(prompt),
    }, { signal });
    const data = result.data?.[0]?.b64_json;
    // Do not fetch arbitrary URLs returned upstream or silently switch providers.
    if (!data || !/^[A-Za-z0-9+/=\r\n]+$/.test(data)) throw new InfographicProviderError(
      "OpenAI no devolvió una imagen válida. La versión actual se conserva.", 502);
    return { imageUrl: `data:image/png;base64,${data}`, model, elapsedMs: Date.now() - start };
  } finally { activeGenerations--; }
}
