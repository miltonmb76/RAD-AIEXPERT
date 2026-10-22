/** A finite browser wait slightly longer than the server's four-minute budget.
 * Each call has its own controller; patient and clinician remain independent. */
export async function requestInfographic(body: Record<string, unknown>, signal?: AbortSignal, timeoutMs = 255_000): Promise<any> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; cancel(); }, timeoutMs);
  let onAbort: (() => void) | undefined;
  try {
    if (controller.signal.aborted) throw new Error("Solicitud cancelada.");
    const cancelled = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new Error("Solicitud cancelada."));
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    return await Promise.race([(async () => {
      const response = await fetch("/api/generate-infographic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) throw new Error("Solicitud cancelada.");
      return response.ok ? data : { success: false, error: data?.error || "No se pudo generar esta versión." };
    })(), cancelled]);
  } catch (error) {
    if (timedOut) throw new Error("Se agotó el tiempo de espera de esta versión de la infografía.");
    throw new Error(signal?.aborted ? "Solicitud cancelada." : "No se pudo recibir esta versión de la infografía. Revisa la conexión e intenta de nuevo.");
  } finally {
    clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
    signal?.removeEventListener("abort", cancel);
  }
}
