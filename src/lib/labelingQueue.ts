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

export async function fetchSuggestedLabel(params: {
  image: AttachedImageForLabeling;
  reportText: string;
  studyType: string;
  clinicalHistory: string;
  keyword?: string;
  model: string;
}): Promise<string> {
  const { image, reportText, studyType, clinicalHistory, keyword, model } = params;
  const imageData = image.base64 || image.url;

  if (keyword?.trim()) {
    const response = await fetch("/api/autocomplete-label-from-report", {
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
    const data = await response.json();
    if (!response.ok || !data.success || !data.label) {
      throw new Error(data.error || "No se pudo reorientar la rotulacion.");
    }
    return String(data.label).trim();
  }

  const isMmg = image.modality === "MMG";
  if (isMmg) {
    const response = await fetch("/api/classify-and-label-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        filename: image.name,
        studyType,
        clinicalHistory,
        findings: reportText,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "No se pudo rotular la imagen.");
    }
    return String(data.label || "").trim();
  }

  const response = await fetch("/api/auto-label-us-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: imageData,
      studyType,
      clinicalHistory,
      findings: reportText,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.success || !data.label) {
    throw new Error(data.error || "No se pudo sugerir la rotulacion.");
  }
  return String(data.label).trim();
}
