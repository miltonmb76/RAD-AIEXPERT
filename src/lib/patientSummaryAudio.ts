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
  /**
   * Soft ceiling for spoken Spanish. Findings are NEVER dropped to fit —
   * overview/summary are shortened first. Default ~400 words (~2.5–3 min).
   */
  maxWords?: number;
};

/** Advice / treatment language — includes Spanish conjugations (sugiere ≠ suger*). */
const FOLLOW_UP_RE =
  /\b(recomend\w*|sugier\w*|suger\w*|tratamiento|terap[eé]ut\w*|medicaci[oó]n|cirug[ií]a|biopsia|intervenci[oó]n|deber[ií]a|debe\b|hay que\b|conviene\b|es importante que\b|seguimiento|control (en|a los|cada|ecogr[aá]fico|peri[oó]dico)|pr[oó]xim[oa]s?\s+pasos|qu[eé] hacer|manejo|derivaci[oó]n|referir|urgencias?|alarma|h[aá]bitos?|ejercicios?|cuidados?|preguntas?\s+para\s+su\s+m[eé]dico|plan de (manejo|seguimiento|tratamiento))\b/i;

const CLASSIFICATION_KEEP_RE =
  /\b(bi-?rads|ti-?rads|bosniak|metavir|fleischner|acr|categoria|categor[ií]a|grado|estadio)\b/i;

function cleanWhitespace(s: string): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Roman → Spanish cardinals for TTS (avoids "Grado I" spoken as "Grado i"). */
const ROMAN_TO_SPOKEN: Record<string, string> = {
  I: "uno",
  II: "dos",
  III: "tres",
  IV: "cuatro",
  V: "cinco",
  VI: "seis",
  VII: "siete",
  VIII: "ocho",
  IX: "nueve",
  X: "diez",
  XI: "once",
  XII: "doce",
};

const ROMAN_TOKEN_RE = /^(X{0,3})(IX|IV|V?I{0,3})$/i;

function romanTokenToSpoken(token: string): string | null {
  const t = String(token || "")
    .trim()
    .toUpperCase()
    .replace(/[.\u00BA\u00B0]/g, ""); // "I." / "Iº"
  if (!t || !ROMAN_TOKEN_RE.test(t)) return null;
  return ROMAN_TO_SPOKEN[t] || null;
}

/**
 * Expand medical Roman numerals so TTS says "grado uno" not "grado i".
 * Targets Grado/estadio/tipo/clase/fase/nivel + standalone II–XII; single "I"
 * only after those clinical prefixes (avoids English pronoun false positives).
 */
export function expandRomanNumeralsForSpeech(text: string): string {
  let s = String(text || "");
  if (!s) return "";

  // "grado I-II" / "estadio II/III" → "grado uno a dos"
  s = s.replace(
    /\b(grado|estadio|tipo|clase|fase|nivel|grupo|categor[ií]a|lesi[oó]n|metavir|bosniak|neer)\s+([IVX]{1,4})(?:\s*[–—\-/]\s*([IVX]{1,4}))?\b/gi,
    (_m, prefix: string, a: string, b?: string) => {
      const left = romanTokenToSpoken(a);
      const right = b ? romanTokenToSpoken(b) : null;
      if (!left) return _m;
      if (right) return `${prefix} ${left} a ${right}`;
      return `${prefix} ${left}`;
    }
  );

  // Trailing "… grado I." already handled; also "FIGURA I" / "Panel II"
  s = s.replace(
    /\b(figura|panel|anexo|hallazgo)\s+([IVX]{1,4})\b/gi,
    (_m, prefix: string, rom: string) => {
      const spoken = romanTokenToSpoken(rom);
      return spoken ? `${prefix} ${spoken}` : _m;
    }
  );

  // Remaining multi-character Romans (II–XII) anywhere as whole tokens
  s = s.replace(/\b([IVX]{2,4})\b/g, (m) => romanTokenToSpoken(m) || m);

  // Lone "I" / "I." only when clearly a grade after punctuation/space and
  // preceded earlier in the clause by a clinical grade word (fallback pass).
  s = s.replace(
    /\b(grado|estadio|tipo|clase|fase|nivel|grupo)\s+I\b/gi,
    (_m, prefix: string) => `${prefix} uno`
  );

  return s;
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

/** Keep the first N sentences (for shortening overview/summary without dropping findings). */
export function firstSentences(text: string, maxSentences: number): string {
  const parts = splitSentences(text);
  if (!parts.length) return "";
  return cleanWhitespace(parts.slice(0, Math.max(1, maxSentences)).join(" "));
}

/**
 * Build a spoken script from the same patient-summary payload as the PDF.
 * Covers EVERY keyFinding (ovario, riñones, etc.) — never truncates mid-list.
 */
export function buildPatientSummarySpokenScript(
  summary: PatientSummaryAudioInput | null | undefined,
  opts: BuildPatientAudioOpts = {}
): string {
  if (!summary) return "";
  const includeFollowUp = opts.includeFollowUp === true;
  // Soft ceiling only; findings always win over overview/summary length.
  const maxWords = Math.max(120, Math.min(600, opts.maxWords ?? 400));

  const name = cleanWhitespace(String(opts.patientFirstName || "").split(/\s+/)[0] || "");
  const study = cleanWhitespace(String(opts.studyType || ""));
  const greeting = name ? `Hola ${name}.` : "Hola.";

  const findings = Array.isArray(summary.keyFindings)
    ? summary.keyFindings.filter(Boolean)
    : [];

  const findingLines: string[] = [];
  for (const f of findings) {
    const title = cleanWhitespace(String(f?.title || f?.finding || ""));
    // One clear sentence per finding (same content family as PDF cards)
    const plain = firstSentences(
      filterSpokenSentences(findingPlain(f), includeFollowUp),
      2
    );
    if (!title && !plain) continue;
    if (title && plain) findingLines.push(`Sobre ${title}: ${plain}`);
    else if (plain) findingLines.push(plain);
    else findingLines.push(`Sobre ${title}.`);
  }

  const closing = includeFollowUp
    ? "El informe formal queda con su médico tratante."
    : "Este audio resume lo que se vio en el estudio, igual que la explicación escrita. El informe formal y cualquier decisión de seguimiento quedan con su médico tratante.";

  const follow =
    includeFollowUp
      ? firstSentences(
          filterSpokenSentences(String(opts.followUpText || "").trim(), true),
          3
        )
      : "";

  // Shorten overview/summary first if needed — never drop findingLines.
  let overviewSentences = 2;
  let summarySentences = findings.length >= 4 ? 2 : 3;

  const assemble = (ovN: number, sumN: number): string => {
    const parts: string[] = [greeting];
    const overviewRaw = filterSpokenSentences(
      String(summary.studyOverview || ""),
      includeFollowUp
    );
    const overview = overviewRaw
      ? firstSentences(overviewRaw, ovN)
      : study
        ? `Le explicamos los hallazgos de su estudio de ${study}.`
        : "Le explicamos los hallazgos de su estudio.";
    parts.push(overview);

    const bodyRaw = filterSpokenSentences(String(summary.summary || ""), includeFollowUp);
    const body = bodyRaw ? firstSentences(bodyRaw, sumN) : "";
    // If we already have a full finding list, keep summary brief to avoid redundancy
    if (body && findingLines.length === 0) parts.push(body);
    else if (body && findingLines.length > 0 && sumN > 0) parts.push(body);

    if (findingLines.length) {
      parts.push(
        findingLines.length === 1
          ? findingLines[0]
          : `Estos son los hallazgos principales. ${findingLines.join(" ")}`
      );
    }

    if (follow) parts.push(`Sobre el seguimiento: ${follow}`);
    parts.push(closing);
    return expandRomanNumeralsForSpeech(cleanWhitespace(parts.join(" ")));
  };

  let script = assemble(overviewSentences, summarySentences);
  // Compress intro only while over budget — keep all findings
  while (wordCount(script) > maxWords && (overviewSentences > 1 || summarySentences > 0)) {
    if (summarySentences > 0) summarySentences -= 1;
    else if (overviewSentences > 1) overviewSentences -= 1;
    script = assemble(overviewSentences, summarySentences);
  }
  // Last resort: still do not drop findings; allow slightly over budget
  return script;
}

/** Titles of findings the spoken script is expected to cover (for QA / AI prompts). */
export function listPatientSummaryFindingLabels(
  summary: PatientSummaryAudioInput | null | undefined
): string[] {
  if (!summary || !Array.isArray(summary.keyFindings)) return [];
  return summary.keyFindings
    .filter(Boolean)
    .map((f) => cleanWhitespace(String(f?.title || f?.finding || "")))
    .filter(Boolean);
}

/** Accent-insensitive lowercase for finding-coverage checks (ovário ≈ ovario). */
export function normalizeSpeechMatchKey(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Significant tokens from a finding title (skip short fillers). */
function findingMatchTokens(label: string): string[] {
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "y",
    "en",
    "con",
    "por",
    "para",
    "al",
    "a",
  ]);
  return normalizeSpeechMatchKey(label)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
}

/** True if the spoken script already mentions this finding label. */
export function scriptMentionsFindingLabel(script: string, label: string): boolean {
  const hay = normalizeSpeechMatchKey(script);
  if (!hay || !label) return false;
  const full = normalizeSpeechMatchKey(label);
  if (full.length >= 4 && hay.includes(full)) return true;
  // Title may be long ("Quiste en ovario izquierdo") — require a distinctive token
  const tokens = findingMatchTokens(label);
  if (!tokens.length) {
    const short = full.slice(0, Math.min(12, full.length));
    return short.length >= 3 && hay.includes(short);
  }
  // Prefer organ/lesion tokens (ovario, rinon, higado…) — any strong token counts
  return tokens.some((t) => hay.includes(t));
}

function findingMatchesMissingLabel(title: string, missingLabel: string): boolean {
  const a = normalizeSpeechMatchKey(missingLabel);
  const b = normalizeSpeechMatchKey(title);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return findingMatchTokens(missingLabel).some((t) => b.includes(t));
}

/**
 * Ensure a spoken script covers every keyFinding (same scope as the patient PDF).
 * Appends compact local lines for any omitted labels; strips advice unless opted in.
 */
export function reconcileSpokenScriptWithFindings(
  script: string,
  summary: PatientSummaryAudioInput | null | undefined,
  opts: { includeFollowUp?: boolean } = {}
): { script: string; missingLabels: string[]; appended: number } {
  const includeFollowUp = opts.includeFollowUp === true;
  let out = cleanWhitespace(script);
  if (!includeFollowUp) {
    out = filterSpokenSentences(out, false);
  }
  const labels = listPatientSummaryFindingLabels(summary);
  const missing = labels.filter((label) => !scriptMentionsFindingLabel(out, label));
  if (!missing.length || !summary || !Array.isArray(summary.keyFindings)) {
    return {
      script: expandRomanNumeralsForSpeech(out),
      missingLabels: missing,
      appended: 0,
    };
  }
  const extras: string[] = [];
  for (const f of summary.keyFindings) {
    const title = cleanWhitespace(String(f?.title || f?.finding || ""));
    if (!title) continue;
    if (!missing.some((m) => findingMatchesMissingLabel(title, m))) continue;
    const plain = firstSentences(filterSpokenSentences(findingPlain(f), includeFollowUp), 2);
    extras.push(plain ? `Sobre ${title}: ${plain}` : `Sobre ${title}.`);
  }
  if (extras.length) {
    out = cleanWhitespace(`${out} ${extras.join(" ")}`);
  }
  return {
    script: expandRomanNumeralsForSpeech(out),
    missingLabels: missing,
    appended: extras.length,
  };
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
 * Ask the server for a spoken script that covers ALL PDF findings (AI + fallback).
 */
export async function fetchPatientSummaryAudioScript(opts: {
  patientSummary: PatientSummaryAudioInput;
  includeFollowUp?: boolean;
  followUpText?: string | null;
  studyType?: string | null;
  patientFirstName?: string | null;
}): Promise<{ script: string; provider: string; findingCount: number }> {
  const res = await fetch("/api/patient-summary-audio-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientSummary: opts.patientSummary,
      includeFollowUp: opts.includeFollowUp === true,
      followUpText: opts.followUpText || "",
      studyType: opts.studyType || "",
      patientFirstName: opts.patientFirstName || "",
    }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.success || !json?.script) {
    // Local fallback — still covers every keyFinding
    const local = buildPatientSummarySpokenScript(opts.patientSummary, {
      includeFollowUp: opts.includeFollowUp,
      followUpText: opts.followUpText,
      studyType: opts.studyType,
      patientFirstName: opts.patientFirstName,
      maxWords: 450,
    });
    const reconciled = reconcileSpokenScriptWithFindings(local, opts.patientSummary, {
      includeFollowUp: opts.includeFollowUp,
    });
    return {
      script: reconciled.script,
      provider: "local-fallback",
      findingCount: listPatientSummaryFindingLabels(opts.patientSummary).length,
    };
  }
  // Defense in depth: re-check coverage / strip advice on the client too
  const reconciled = reconcileSpokenScriptWithFindings(
    String(json.script),
    opts.patientSummary,
    { includeFollowUp: opts.includeFollowUp }
  );
  return {
    script: reconciled.script,
    provider: String(json.provider || "server"),
    findingCount: Number(json.findingCount) || 0,
  };
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
