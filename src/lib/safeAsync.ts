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

export async function withPdfGenerationLock<T>(fn: () => Promise<T>): Promise<T> {
  while (pdfBusy) {
    try {
      await pdfBusy;
    } catch {
      /* previous failure — continue */
    }
  }
  let release!: () => void;
  pdfBusy = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    pdfBusy = null;
  }
}
