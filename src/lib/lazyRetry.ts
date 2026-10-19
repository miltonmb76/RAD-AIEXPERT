import React from "react";
import { flushActiveSessionDraftNow } from "./activeSessionDraft";

const CHUNK_RELOAD_KEY = "rad_lazy_chunk_reload";

/** True when a Vite/React lazy chunk failed to download (stale hash after deploy). */
export function isDynamicImportFetchError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    (/Loading chunk [\d]+ failed/i.test(msg) && /failed/i.test(msg))
  );
}

/**
 * React.lazy that recovers from stale chunk hashes after Cloud Run redeploys.
 * One automatic full reload (draft is flushed by callers / beforeunload); if it
 * still fails, the error surfaces normally.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [exportName: string]: T }>,
  exportName?: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const load = async (): Promise<{ default: T }> => {
      const mod = await factory();
      if (exportName) {
        const named = (mod as any)[exportName] as T | undefined;
        if (!named) {
          throw new Error(`Lazy export "${exportName}" no encontrado en el módulo.`);
        }
        return { default: named };
      }
      if ((mod as any).default) return mod as { default: T };
      throw new Error("Lazy module sin export default.");
    };

    try {
      const result = await load();
      try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        /* ignore */
      }
      return result;
    } catch (err) {
      if (!isDynamicImportFetchError(err)) throw err;

      let already = "";
      try {
        already = sessionStorage.getItem(CHUNK_RELOAD_KEY) || "";
      } catch {
        /* ignore */
      }

      if (already !== "1") {
        try {
          flushActiveSessionDraftNow();
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          sessionStorage.setItem("rad_ui_crash_reload", "1");
        } catch {
          /* ignore */
        }
        // Stale index/chunk after deploy — hard reload picks up the new hashes.
        window.location.reload();
        // Keep Suspense pending until the page unloads.
        return new Promise(() => {});
      }

      try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        /* ignore */
      }
      throw err;
    }
  });
}
