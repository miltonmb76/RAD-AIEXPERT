/**
 * Spoken script for patient-summary WhatsApp audio (~30–45 s).
 * By default: study + findings only — no recommendations / treatment / follow-up.
 * Opt-in: includeFollowUp adds explicit follow-up text (BI-RADS, TI-RADS, etc.).
 */

export type PatientSummaryAudioInput = {
  studyOverview?: string;
  summary?: string;
  keyFindings?: Array<{
    title?: string;
    finding?: string;
    simplifiedExplanation?: string;
    explanation?: string;
    description?: string;
    clinicalContext?: string;
    reassurance?: string;
    analogy?: string;
  }>;
  glossary?: Array<{ term?: string; plainDefinition?: string; definition?: string }>;
};

export type BuildPatientAudioOpts = {
  /** When false (default), strip recommendation/treatment/follow-up language. */
  includeFollowUp?: boolean;
  /** Only used when includeFollowUp is true (e.g. scorecard recommendation / BI-RADS). */
  followUpText?: string | null;
  studyType?: string | null;
  patientFirstName?: string | null;
  /** Soft word budget for ~30–45 s of spoken Spanish (~2.5 words/s). */
  maxWords?: number;
};

const FOLLOW_UP_RE =
  /\b(recomend\w*|suger\w*|tratamiento|terap[eé]ut\w*|medicaci[oó]n|cirug[ií]a|biopsia|intervenci[oó]n|deber[ií]a|debe\b|hay que\b|conviene\b|es importante que\b|seguimiento|control (en|a los|cada)|pr[oó]xim[oa]s?\s+pasos|qu[eé] hacer|manejo|derivaci[oó]n|referir|urgencias?|alarma|h[aá]bitos?|ejercicios?|cuidados?|preguntas?\s+para\s+su\s+m[eé]dico|plan de (manejo|seguimiento|tratamiento))\b/i;

const CLASSIFICATION_KEEP_RE =
  /\b(bi-?rads|ti-?rads|bosniak|metavir|fleischner|acr|categoria|categor[ií]a|grado|estadio)\b/i;

function cleanWhitespace(s: string): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function splitSentences(text: string): string[] {
  const t = cleanWhitespace(text);
  if (!t) return [];
  return t
    .split(/(?<=[.!?…])\s+/)
    .map((s) => cleanWhitespace(s))
    .filter(Boolean);
}

/** True if a sentence looks like advice / treatment / follow-up. */
export function isFollowUpLikeSentence(sentence: string): boolean {
  const s = String(sentence || "").trim();
  if (!s) return false;
  if (FOLLOW_UP_RE.test(s)) return true;
  // "control en 6 meses", "revisión en un año"
  if (/\b(control|revisi[oó]n|seguimiento)\b.{0,40}\b(\d+|seis|doce|un|una)\b.{0,20}\b(mes|meses|a[nñ]o|semanas?)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Filter sentences. Classifications (BI-RADS 3, TI-RADS 4) stay as descriptive
 * findings; actionable follow-up around them is dropped unless includeFollowUp.
 */
export function filterSpokenSentences(
  text: string,
  includeFollowUp: boolean
): string {
  const parts = splitSentences(text);
  const kept = parts.filter((s) => {
    if (includeFollowUp) return true;
    if (!isFollowUpLikeSentence(s)) return true;
    // Keep short classification labels that happen to match FOLLOW_UP_RE weakly
    if (CLASSIFICATION_KEEP_RE.test(s) && s.length < 80 && !/\b(control|seguimiento|meses|tratamiento)\b/i.test(s)) {
      return true;
    }
    return false;
  });
  return cleanWhitespace(kept.join(" "));
}

function wordCount(text: string): number {
  const t = cleanWhitespace(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function trimToWords(text: string, maxWords: number): string {
  const words = cleanWhitespace(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  // Prefer cutting at sentence end inside budget
  const truncated = words.slice(0, maxWords).join(" ");
  const lastStop = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?")
  );
  if (lastStop > truncated.length * 0.45) {
    return truncated.slice(0, lastStop + 1).trim();
  }
  return `${truncated.trim()}…`;
}

function findingPlain(f: NonNullable<PatientSummaryAudioInput["keyFindings"]>[number]): string {
  return cleanWhitespace(
    f?.simplifiedExplanation || f?.explanation || f?.description || ""
  );
}

/**
 * Build a short spoken script (~30–45 s) from the patient summary payload.
 */
export function buildPatientSummarySpokenScript(
  summary: PatientSummaryAudioInput | null | undefined,
  opts: BuildPatientAudioOpts = {}
): string {
  if (!summary) return "";
  const includeFollowUp = opts.includeFollowUp === true;
  const maxWords = Math.max(60, Math.min(160, opts.maxWords ?? 110));

  const chunks: string[] = [];
  const name = cleanWhitespace(String(opts.patientFirstName || "").split(/\s+/)[0] || "");
  const study = cleanWhitespace(String(opts.studyType || ""));

  if (name) {
    chunks.push(`Hola${name ? ` ${name}` : ""}.`);
  } else {
    chunks.push("Hola.");
  }

  const overview = filterSpokenSentences(
    String(summary.studyOverview || ""),
    includeFollowUp
  );
  if (overview) {
    chunks.push(overview);
  } else if (study) {
    chunks.push(`Le explicamos de forma breve su estudio de ${study}.`);
  } else {
    chunks.push("Le explicamos de forma breve los hallazgos de su estudio.");
  }

  const body = filterSpokenSentences(String(summary.summary || ""), includeFollowUp);
  if (body) chunks.push(body);

  const findings = Array.isArray(summary.keyFindings) ? summary.keyFindings.filter(Boolean) : [];
  const findingLines: string[] = [];
  for (const f of findings.slice(0, 3)) {
    const title = cleanWhitespace(String(f?.title || f?.finding || ""));
    const plain = filterSpokenSentences(findingPlain(f), includeFollowUp);
    if (!title && !plain) continue;
    if (title && plain) findingLines.push(`Sobre ${title}: ${plain}`);
    else if (plain) findingLines.push(plain);
    else if (title) findingLines.push(`Hallazgo: ${title}.`);
  }
  if (findingLines.length) {
    chunks.push(findingLines.join(" "));
  }

  if (includeFollowUp) {
    const follow = filterSpokenSentences(
      String(opts.followUpText || "").trim(),
      true
    );
    if (follow) {
      chunks.push(`Sobre el seguimiento: ${follow}`);
    }
  }

  chunks.push(
    includeFollowUp
      ? "El informe formal queda con su médico tratante."
      : "Este audio solo explica lo que se vio en el estudio. El informe formal y cualquier decisión de seguimiento quedan con su médico tratante."
  );

  let script = cleanWhitespace(chunks.join(" "));
  script = trimToWords(script, maxWords);
  return script;
}

export function estimateSpokenSeconds(script: string, wordsPerSecond = 2.4): number {
  const n = wordCount(script);
  if (!n) return 0;
  return Math.round(n / wordsPerSecond);
}

export function browserTtsSupported(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

/** Pick a Spanish voice when available. */
export function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (!browserTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const es =
    voices.find((v) => /^es(-|_)?(MX|US|ES|AR|CO|CL|PE)?$/i.test(v.lang)) ||
    voices.find((v) => String(v.lang || "").toLowerCase().startsWith("es"));
  return es || null;
}

export function speakPatientSummaryScript(
  script: string,
  opts?: { rate?: number; onEnd?: () => void; onError?: (err: string) => void }
): SpeechSynthesisUtterance | null {
  if (!browserTtsSupported()) {
    opts?.onError?.("Este navegador no soporta lectura en voz alta.");
    return null;
  }
  const text = cleanWhitespace(script);
  if (!text) {
    opts?.onError?.("No hay texto para narrar.");
    return null;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = opts?.rate ?? 1.02;
  const voice = pickSpanishVoice();
  if (voice) u.voice = voice;
  u.onend = () => opts?.onEnd?.();
  u.onerror = () => opts?.onError?.("No se pudo reproducir el audio.");
  window.speechSynthesis.speak(u);
  return u;
}

export function stopPatientSummarySpeech(): void {
  if (browserTtsSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Request natural-voice MP3 from /api/patient-summary-tts and trigger a download.
 * Shared by the patient module bar and the WhatsApp share modal.
 */
export async function downloadPatientSummaryAudioMp3(opts: {
  script: string;
  filename?: string;
  includeFollowUp?: boolean;
}): Promise<Blob> {
  const script = String(opts.script || "").replace(/\s+/g, " ").trim();
  if (!script) {
    throw new Error("No hay guion de audio. Genere primero la explicación al paciente.");
  }
  const res = await fetch("/api/patient-summary-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: script,
      includeFollowUp: opts.includeFollowUp === true,
    }),
  });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error(json?.error || "No se pudo generar el MP3.");
  }
  if (!contentType.includes("audio")) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error(json?.error || "El servidor no devolvió audio.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.filename || "explicacion-paciente-whatsapp.mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Keep URL briefly so the browser can start the download, then revoke.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return blob;
}
