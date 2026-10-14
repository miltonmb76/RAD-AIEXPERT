/**
 * Persist the active study/report in sessionStorage so a soft recover
 * ("Reintentar sin recargar") or in-tab reload does not wipe the informe.
 * Soft recover remounts <App />; without this, React state is lost.
 */

export const ACTIVE_SESSION_DRAFT_KEY = "rad_active_session_draft";

export type ActiveSessionDraft = {
  v: 1;
  savedAt: string;
  generatedReport: string;
  editedReportText: string;
  isEditingReportManual: boolean;
  originalBaseReport: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientId: string;
  patientEmail: string;
  studyType: string;
  clinicalHistory: string;
  findings: string;
  inputReport: string;
  reportDate: string;
  modality: string;
  specificStudy: string;
  laterality: string;
};

const MAX_TEXT = 450_000;

type DraftFlush = () => void;
let draftFlush: DraftFlush | null = null;
/** Survives App unmount when ErrorBoundary swaps to the recovery UI. */
let lastPayload: Omit<ActiveSessionDraft, "v" | "savedAt"> | null = null;

export function registerActiveSessionDraftFlush(fn: DraftFlush | null): void {
  draftFlush = fn;
}

/** Keep the latest fields even after React unmounts App on a crash. */
export function rememberActiveSessionDraft(
  partial: Omit<ActiveSessionDraft, "v" | "savedAt">
): void {
  lastPayload = partial;
}

/** Call from ErrorBoundary before remount so the latest in-memory payload is written. */
export function flushActiveSessionDraftNow(): void {
  try {
    if (draftFlush) {
      draftFlush();
      return;
    }
    if (lastPayload && draftHasReport(lastPayload)) {
      saveActiveSessionDraft(lastPayload);
    }
  } catch {
    /* ignore */
  }
}

function clip(s: unknown, max = MAX_TEXT): string {
  return String(s ?? "").slice(0, max);
}

export function draftHasReport(d: Partial<ActiveSessionDraft> | null | undefined): boolean {
  if (!d) return false;
  return Boolean(
    clip(d.generatedReport).trim() || clip(d.editedReportText).trim()
  );
}

export function loadActiveSessionDraft(): ActiveSessionDraft | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_DRAFT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ActiveSessionDraft;
    if (!o || o.v !== 1) return null;
    if (!draftHasReport(o)) return null;
    return {
      v: 1,
      savedAt: String(o.savedAt || ""),
      generatedReport: clip(o.generatedReport),
      editedReportText: clip(o.editedReportText),
      isEditingReportManual: Boolean(o.isEditingReportManual),
      originalBaseReport: clip(o.originalBaseReport),
      patientName: clip(o.patientName, 500),
      patientAge: clip(o.patientAge, 80),
      patientGender: clip(o.patientGender, 80),
      patientId: clip(o.patientId, 120),
      patientEmail: clip(o.patientEmail, 200),
      studyType: clip(o.studyType, 300),
      clinicalHistory: clip(o.clinicalHistory),
      findings: clip(o.findings),
      inputReport: clip(o.inputReport),
      reportDate: clip(o.reportDate, 40),
      modality: clip(o.modality, 120),
      specificStudy: clip(o.specificStudy, 200),
      laterality: clip(o.laterality, 40),
    };
  } catch {
    return null;
  }
}

export function saveActiveSessionDraft(
  partial: Omit<ActiveSessionDraft, "v" | "savedAt">
): boolean {
  try {
    if (!draftHasReport(partial)) return false;
    const payload: ActiveSessionDraft = {
      v: 1,
      savedAt: new Date().toISOString(),
      generatedReport: clip(partial.generatedReport),
      editedReportText: clip(partial.editedReportText),
      isEditingReportManual: Boolean(partial.isEditingReportManual),
      originalBaseReport: clip(partial.originalBaseReport),
      patientName: clip(partial.patientName, 500),
      patientAge: clip(partial.patientAge, 80),
      patientGender: clip(partial.patientGender, 80),
      patientId: clip(partial.patientId, 120),
      patientEmail: clip(partial.patientEmail, 200),
      studyType: clip(partial.studyType, 300),
      clinicalHistory: clip(partial.clinicalHistory),
      findings: clip(partial.findings),
      inputReport: clip(partial.inputReport),
      reportDate: clip(partial.reportDate, 40),
      modality: clip(partial.modality, 120),
      specificStudy: clip(partial.specificStudy, 200),
      laterality: clip(partial.laterality, 40),
    };
    sessionStorage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("No se pudo guardar borrador de sesión:", err);
    return false;
  }
}

export function clearActiveSessionDraft(): void {
  lastPayload = null;
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
