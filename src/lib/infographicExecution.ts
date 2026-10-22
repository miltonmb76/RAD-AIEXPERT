type Stage = "plan" | "image" | "review";
type StopReason = "deadline" | "stage_timeout" | "disconnected";

// Below Cloud Run's 300-second request timeout. These are ceilings for stalled
// operations, not estimates of normal generation time. Keep the current 2K image.
const DEFAULT_LIMITS = { total: 240_000, plan: 30_000, image: 120_000, review: 30_000 };

export class InfographicExecutionError extends Error {
  constructor(readonly reason: StopReason) {
    super(reason === "disconnected" ? "La solicitud de la infografía se canceló."
      : "La generación superó el tiempo de espera. No se iniciarán más intentos automáticos; puedes volver a intentarlo cuando el servicio responda.");
    this.name = "InfographicExecutionError";
  }
}

/** One request's budget and anonymous timings. Never stores clinical inputs,
 * images, credentials, provider responses or user identifiers. */
export function createInfographicExecution(limits: Partial<typeof DEFAULT_LIMITS> = {}, now = () => performance.now()) {
  const policy = { ...DEFAULT_LIMITS, ...limits };
  const started = now();
  const controller = new AbortController();
  const calls = { plan: 0, image: 0, review: 0 };
  const durationMs = { plan: 0, image: 0, review: 0 };
  let stopped: InfographicExecutionError | undefined;
  let providerFailure: any;
  const stop = (reason: StopReason) => {
    if (!stopped) { stopped = new InfographicExecutionError(reason); controller.abort(stopped); }
    return stopped;
  };
  return {
    cancel: () => { stop("disconnected"); },
    get error() { return stopped || providerFailure; },
    async run<T>(stage: Stage, invoke: (config: {
      abortSignal: AbortSignal;
      httpOptions: { timeout: number; retryOptions: { attempts: number } };
    }) => Promise<T>): Promise<T> {
      if (stopped) throw stopped;
      if (providerFailure) throw providerFailure;
      const remaining = policy.total - (now() - started);
      if (remaining <= 0) throw stop("deadline");
      const timeout = Math.max(1, Math.ceil(Math.min(policy[stage], remaining)));
      const callStarted = now();
      calls[stage]++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(stopped || providerFailure);
          controller.signal.addEventListener("abort", onAbort, { once: true });
          timer = setTimeout(() => stop(remaining <= policy[stage] ? "deadline" : "stage_timeout"), timeout);
        });
        // Race also bounds a provider/SDK that fails to honor the abort signal.
        // Aborting locally does not cancel work or charges already at Gemini.
        const result = await Promise.race([Promise.resolve().then(() => {
          if (stopped) throw stopped;
          return invoke({ abortSignal: controller.signal, httpOptions: { timeout, retryOptions: { attempts: 1 } } });
        }), cancelled]);
        if (stopped) throw stopped;
        if (now() - started >= policy.total) throw stop("deadline");
        if (now() - callStarted >= policy[stage]) throw stop("stage_timeout");
        return result;
      } catch (error) {
        if (!(error instanceof InfographicExecutionError) && isTerminalInfographicError(error) && !isInfographicImageConfigError(error)) {
          providerFailure = error;
          controller.abort(error);
        }
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) controller.signal.removeEventListener("abort", onAbort);
        durationMs[stage] += Math.round(now() - callStarted);
      }
    },
    diagnostics: () => ({
      totalMs: Math.round(now() - started), calls: { ...calls }, stageMs: { ...durationMs },
      ...(stopped ? { stopReason: stopped.reason } : providerFailure ? { stopReason: "provider_error" } : {}),
    }),
  };
}

/** An explicit size/aspect incompatibility may use the existing compatibility
 * fallback. Quota, authentication, outages and empty image responses must not
 * multiply requests through all four image configurations. */
export function isInfographicImageConfigError(error: any): boolean {
  return Number(error?.status) === 400 &&
    /image[_ -]?size|aspect[_ -]?ratio|imageConfig/i.test(String(error?.message || ""));
}

export function isTerminalInfographicError(error: any): boolean {
  return error instanceof InfographicExecutionError || Number(error?.status) >= 400;
}
