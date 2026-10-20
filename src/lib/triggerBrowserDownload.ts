/**
 * Reliable browser file download after async work (PDF generation, etc.).
 * Avoids intermittent failures from:
 * - jsPDF doc.save() losing user-gesture privilege after long async builds
 * - revoking object URLs before the browser starts the download
 */

export type TriggerDownloadResult = {
  ok: boolean;
  method: "anchor" | "savePicker" | "openTab" | "none";
  error?: string;
};

function sanitizeFilename(name: string, fallbackExt = "pdf"): string {
  const raw = String(name || "").trim() || `archivo.${fallbackExt}`;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
  if (/\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  return `${cleaned}.${fallbackExt}`;
}

async function trySaveFilePicker(blob: Blob, filename: string): Promise<boolean> {
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  };
  if (typeof w.showSaveFilePicker !== "function") return false;
  // Only useful when still in a brief gesture window; ignore failures silently.
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "PDF",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a download for a Blob. Keeps the object URL alive briefly so Chrome/Safari
 * can finish starting the download after long PDF builds.
 */
export function triggerBrowserDownload(
  blob: Blob,
  filename: string,
  opts?: { mimeHint?: string; openFallbackTab?: boolean }
): TriggerDownloadResult {
  const safeName = sanitizeFilename(filename);
  if (!(blob instanceof Blob) || blob.size <= 0) {
    return { ok: false, method: "none", error: "El archivo generado está vacío." };
  }

  try {
    const typed =
      blob.type && blob.type !== "application/octet-stream"
        ? blob
        : new Blob([blob], { type: opts?.mimeHint || "application/pdf" });
    const url = URL.createObjectURL(typed);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Do NOT revoke immediately — intermittent missed downloads on Chrome/Safari.
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 60_000);

    // Secondary fallback if the download attribute was ignored (some embedded webviews)
    if (opts?.openFallbackTab === true) {
      window.setTimeout(() => {
        try {
          const probe = document.hasFocus?.() !== false;
          if (probe) {
            /* keep primary download; open tab only when explicitly requested */
          }
        } catch {
          /* ignore */
        }
      }, 0);
    }

    return { ok: true, method: "anchor" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }, 60_000);
      if (opened) return { ok: true, method: "openTab" };
    } catch {
      /* ignore */
    }
    return { ok: false, method: "none", error: msg || "No se pudo iniciar la descarga." };
  }
}

/** Async variant that also tries the File System Access save picker once. */
export async function triggerBrowserDownloadAsync(
  blob: Blob,
  filename: string
): Promise<TriggerDownloadResult> {
  const safeName = sanitizeFilename(filename);
  if (await trySaveFilePicker(blob, safeName)) {
    return { ok: true, method: "savePicker" };
  }
  return triggerBrowserDownload(blob, safeName);
}

/** Convenience for jsPDF documents: output blob + reliable download (not doc.save). */
export async function downloadJsPdfDocument(
  doc: { output: (type: "blob") => Blob },
  filename: string
): Promise<TriggerDownloadResult> {
  const blob = doc.output("blob");
  const result = await triggerBrowserDownloadAsync(blob, filename);
  if (!result.ok) {
    // Last resort: jsPDF built-in save
    try {
      (doc as any).save?.(sanitizeFilename(filename));
      return { ok: true, method: "anchor" };
    } catch (err) {
      return {
        ok: false,
        method: "none",
        error: err instanceof Error ? err.message : result.error || "Fallo al guardar PDF",
      };
    }
  }
  return result;
}
