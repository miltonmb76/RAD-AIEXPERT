export type InfographicAudience = "patient" | "clinician";
export type InfographicComparisonInput = {
  report: string;
  studyType: string;
  reportDate: string;
  projections: string[];
  viewOrientation: "AP" | "PA";
  studyLaterality: string;
  diagnosisAnchor: string;
  correctionNotes: string;
};
export type InfographicCandidate = { imageUrl: string; model: string; elapsedMs: number };

/** The candidate is returned for review only; this function cannot change a PDF. */
export async function requestOpenAiInfographic(
  input: InfographicComparisonInput,
  audience: InfographicAudience,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<InfographicCandidate> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 240_000);
  try {
    const response = await request("/api/generate-infographic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, provider: "openai", audience, mode: "general", includeRecommendations: "none" }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "No se pudo generar la comparación con OpenAI.");
    if (result.provider !== "openai" || result.audience !== audience ||
      typeof result.imageUrl !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(result.imageUrl)) {
      throw new Error("La respuesta no corresponde a la imagen de OpenAI solicitada.");
    }
    return { imageUrl: result.imageUrl, model: String(result.model || "OpenAI"), elapsedMs: Number(result.elapsedMs) || 0 };
  } catch (error) {
    if (timedOut) throw new Error("La comparación tardó demasiado. La imagen actual se conserva.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
