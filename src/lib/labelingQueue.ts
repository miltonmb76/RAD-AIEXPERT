export type LabelQueueStatus =
  | "waiting"
  | "analyzing"
  | "suggested"
  | "reorienting"
  | "confirmed"
  | "skipped"
  | "error";

export interface LabelQueueItem {
  imageId: string;
  name: string;
  previewUrl: string;
  status: LabelQueueStatus;
  suggestedLabel: string;
  editedLabel: string;
  keyword: string;
  error?: string;
}

export interface AttachedImageForLabeling {
  id: string;
  name?: string;
  url: string;
  base64?: string;
  caption?: string;
  modality?: "MMG" | "US" | string;
}

const LABEL_FETCH_TIMEOUT_MS = 120_000;

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = LABEL_FETCH_TIMEOUT_MS
): Promise<{ response: Response; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let data: Record<string, unknown> = {};
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Error(`Respuesta invalida del servidor (HTTP ${response.status}).`);
    }
    return { response, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La solicitud de rotulado excedio el tiempo de espera. Reintenta.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function resolveImagePayload(image: AttachedImageForLabeling): string {
  const payload = image.base64 || image.url;
  if (!payload) {
    throw new Error("La imagen no tiene datos disponibles para analizar.");
  }
  return payload;
}

export async function fetchSuggestedLabel(params: {
  image: AttachedImageForLabeling;
  reportText: string;
  studyType: string;
  clinicalHistory: string;
  keyword?: string;
  model: string;
}): Promise<string> {
  const { image, reportText, studyType, clinicalHistory, keyword, model } = params;
  const imageData = resolveImagePayload(image);

  if (keyword?.trim()) {
    const { response, data } = await fetchJsonWithTimeout("/api/autocomplete-label-from-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        phrase: keyword.trim(),
        currentReport: reportText,
        studyType,
        clinicalHistory,
      }),
    });
    if (!response.ok || !data.success || !data.label) {
      throw new Error(String(data.error || "No se pudo reorientar la rotulacion."));
    }
    return String(data.label).trim();
  }

  // Same primary endpoint used by manual "Rotular con IA" in App.tsx.
  const { response, data } = await fetchJsonWithTimeout("/api/classify-and-label-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      image: imageData,
      filename: image.name,
      studyType,
      clinicalHistory,
      findings: reportText,
    }),
  });

  if (!response.ok || !data.success) {
    throw new Error(String(data.error || "No se pudo rotular la imagen."));
  }

  const label = String(data.label || "").trim();
  if (label) {
    return label;
  }

  // Fallback for US captures when classify returns empty label.
  const fallback = await fetchJsonWithTimeout("/api/auto-label-us-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      image: imageData,
      studyType,
      clinicalHistory,
      findings: reportText,
    }),
  });

  if (!fallback.response.ok || !fallback.data.success || !fallback.data.label) {
    throw new Error(String(fallback.data.error || "No se pudo sugerir la rotulacion."));
  }

  return String(fallback.data.label).trim();
}


export type AutoLabelProgress = {
  done: number;
  total: number;
  currentImageId?: string;
  error?: string;
};

/**
 * Labels unlabeled attached images with the same AI engine as the queue,
 * applying captions immediately (no confirmation step).
 */
export async function autoLabelAttachedImages(params: {
  images: AttachedImageForLabeling[];
  reportText: string;
  studyType: string;
  clinicalHistory: string;
  model: string;
  onlyUnlabeled?: boolean;
  concurrency?: number;
  shouldCancel?: () => boolean;
  onProgress?: (progress: AutoLabelProgress) => void;
  onLabeled?: (imageId: string, label: string) => void;
}): Promise<{ labeled: number; failed: number }> {
  const {
    images,
    reportText,
    studyType,
    clinicalHistory,
    model,
    onlyUnlabeled = true,
    concurrency = 2,
    shouldCancel,
    onProgress,
    onLabeled,
  } = params;

  const targets = images.filter((img) => {
    if (!(img.url || img.base64)) return false;
    if (onlyUnlabeled && img.caption?.trim()) return false;
    return true;
  });

  let labeled = 0;
  let failed = 0;
  let cursor = 0;

  onProgress?.({ done: 0, total: targets.length });

  async function worker() {
    while (cursor < targets.length) {
      if (shouldCancel?.()) return;
      const index = cursor++;
      const image = targets[index];
      onProgress?.({ done: labeled + failed, total: targets.length, currentImageId: image.id });
      try {
        const label = await fetchSuggestedLabel({
          image,
          reportText,
          studyType,
          clinicalHistory,
          model,
        });
        if (shouldCancel?.()) return;
        if (label.trim()) {
          onLabeled?.(image.id, label.trim());
          labeled += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        onProgress?.({
          done: labeled + failed,
          total: targets.length,
          currentImageId: image.id,
          error: err instanceof Error ? err.message : "Error de rotulado",
        });
      }
      onProgress?.({ done: labeled + failed, total: targets.length });
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, targets.length || 1)) }, () => worker());
  await Promise.all(workers);
  return { labeled, failed };
}
