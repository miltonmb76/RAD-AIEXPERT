/**
 * Run async UI actions without letting rejections become unhandled
 * (which can tear down the session during Gmail / PDF / save flows).
 */

export function runSafeAsync(
  action: () => void | Promise<void>,
  onError?: (err: unknown) => void
): void {
  try {
    const result = action();
    void Promise.resolve(result).catch((err) => {
      console.error("[safeAsync]", err);
      try {
        onError?.(err);
      } catch (handlerErr) {
        console.error("[safeAsync] onError failed:", handlerErr);
      }
    });
  } catch (err) {
    console.error("[safeAsync] sync throw:", err);
    try {
      onError?.(err);
    } catch (handlerErr) {
      console.error("[safeAsync] onError failed:", handlerErr);
    }
  }
}

/** Simple mutex so concurrent full-report PDF builds do not OOM the tab. */
let pdfBusy: Promise<unknown> | null = null;
let pdfBusyStartedAt = 0;

const PDF_LOCK_WAIT_MS = 90_000;
const PDF_LOCK_STALE_MS = 120_000;

export function isPdfGenerationBusy(): boolean {
  return pdfBusy != null;
}

/** Simple mutex so concurrent full-report PDF builds do not OOM the tab. */
export async function withPdfGenerationLock<T>(fn: () => Promise<T>): Promise<T> {
  const waitStarted = Date.now();
  while (pdfBusy) {
    // Recover from a stuck lock (tab never released after crash / navigation)
    if (pdfBusyStartedAt && Date.now() - pdfBusyStartedAt > PDF_LOCK_STALE_MS) {
      console.warn("[pdfLock] clearing stale PDF generation lock");
      pdfBusy = null;
      pdfBusyStartedAt = 0;
      break;
    }
    if (Date.now() - waitStarted > PDF_LOCK_WAIT_MS) {
      throw new Error(
        "Otra generación de PDF sigue en curso. Espere unos segundos e intente de nuevo."
      );
    }
    try {
      await pdfBusy;
    } catch {
      /* previous failure — continue */
    }
  }
  let release!: () => void;
  pdfBusyStartedAt = Date.now();
  pdfBusy = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    pdfBusy = null;
    pdfBusyStartedAt = 0;
  }
}
