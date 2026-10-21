/**
 * Persist the active study/report (+ annex modules) so soft-recover
 * ("Reintentar sin recargar") does not wipe the session.
 *
 * - Light text fields → sessionStorage (sync hydrate on remount)
 * - Heavy annex payloads (suites, packs, infographics, US images) → IndexedDB
 */

export const ACTIVE_SESSION_DRAFT_KEY = "rad_active_session_draft";

export type ActiveSessionDraft = {
  v: 1 | 2;
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
  /** Fingerprint linking sessionStorage draft ↔ IndexedDB annex bundle */
  reportFingerprint?: string;
  hasAnnexBundle?: boolean;
};

/** Module / annex snapshot restored after crash recovery. */
export type ActiveSessionAnnexBundle = {
  v: 1;
  savedAt: string;
  reportFingerprint: string;
  diagnosisAnchor: string;
  operationalSummaryText: string;
  patientSummary: unknown | null;
  attachedImages: unknown[];
  findings3dRenders: unknown[];
  // Classic infographics
  infographicUrl: string | null;
  infographicClinicianUrl: string | null;
  directedInfographicUrl: string | null;
  directedInfographicClinicianUrl: string | null;
  attachInfographicToOfficialReport: boolean;
  attachInfographicToPatientSummary: boolean;
  attachDirectedInfographicToOfficialReport: boolean;
  attachDirectedInfographicToPatientSummary: boolean;
  // Clinical annex modules
  clinicalScorecardData: unknown | null;
  includeScorecardInReport: boolean;
  reasoningChainData: unknown | null;
  includeReasoningChainInReport: boolean;
  negativityChecklistData: unknown | null;
  includeNegativityChecklistInReport: boolean;
  secondReaderData: unknown | null;
  differentialTreeData: unknown | null;
  includeDifferentialTreeInReport: boolean;
  findingsInfographicData: unknown | null;
  includeFindingsInfographicInReport: boolean;
  diagnosticPacks: unknown[];
  includeDiagnosticPackInReport: boolean;
  dominantLesionCardData: unknown | null;
  includeDominantLesionCardInReport: boolean;
  measurementGaugeData: unknown | null;
  includeMeasurementGaugesInReport: boolean;
  biomechanicalRadarData: unknown | null;
  // Organ / anatomy suites
  atlas3dData: unknown | null;
  includeAtlas3dInReport: boolean;
  vascular3dData: unknown | null;
  includeVascular3dInReport: boolean;
  focalLesion3dData: unknown | null;
  includeFocalLesion3dInReport: boolean;
  usPlaneSimulatorData: unknown | null;
  includeUsPlaneSimulatorInReport: boolean;
  /** Multi-finding explainer (eco + CGI + bullets). */
  findingExplainerData?: unknown | null;
  includeFindingExplainerInReport?: boolean;
  /** Optional clickable annex index in the official PDF. */
  includeAnnexIndexInReport?: boolean;
  thyroid3dData: unknown | null;
  includeThyroid3dInReport: boolean;
  breast3dData: unknown | null;
  includeBreast3dInReport: boolean;
  shoulder3dData: unknown | null;
  includeShoulder3dInReport: boolean;
  knee3dData: unknown | null;
  includeKnee3dInReport: boolean;
  ankle3dData: unknown | null;
  includeAnkle3dInReport: boolean;
  kidney3dData: unknown | null;
  includeKidney3dInReport: boolean;
  abdomen3dData: unknown | null;
  includeAbdomen3dInReport: boolean;
  abdominalWall3dData: unknown | null;
  includeAbdominalWall3dInReport: boolean;
  scrotum3dData: unknown | null;
  includeScrotum3dInReport: boolean;
  muscleTendon3dData: unknown | null;
  includeMuscleTendon3dInReport: boolean;
  wrist3dData: unknown | null;
  includeWrist3dInReport: boolean;
  // Elastography
  includeElastographyInReport: boolean;
  elastographyStiffness: number;
  elastographyCAP: number;
  elastographyFatFraction: number;
  elastographyImage3d: string | null;
  elastographyOriginalImage: string | null;
  elastographyEtiology: string;
};

const MAX_TEXT = 450_000;
const ANNEX_DB = "RadiologySessionDraftDB";
const ANNEX_DB_VERSION = 1;
const ANNEX_STORE = "annexes";
const ANNEX_KEY = "current";

type DraftFlush = () => void;
let draftFlush: DraftFlush | null = null;
/** Survives App unmount when ErrorBoundary swaps to the recovery UI. */
let lastPayload: Omit<ActiveSessionDraft, "v" | "savedAt"> | null = null;
let lastAnnexPayload: Omit<ActiveSessionAnnexBundle, "v" | "savedAt"> | null = null;

export function registerActiveSessionDraftFlush(fn: DraftFlush | null): void {
  draftFlush = fn;
}

export function rememberActiveSessionDraft(
  partial: Omit<ActiveSessionDraft, "v" | "savedAt">
): void {
  lastPayload = partial;
}

export function rememberActiveSessionAnnexes(
  partial: Omit<ActiveSessionAnnexBundle, "v" | "savedAt">
): void {
  lastAnnexPayload = partial;
}

/** Call from ErrorBoundary before remount so the latest in-memory payload is written. */
export function flushActiveSessionDraftNow(): void {
  try {
    if (draftFlush) {
      draftFlush();
    } else if (lastPayload && draftHasReport(lastPayload)) {
      saveActiveSessionDraft({
        ...lastPayload,
        reportFingerprint: buildReportFingerprint(lastPayload),
        hasAnnexBundle: annexBundleHasContent(lastAnnexPayload),
      });
    }
  } catch {
    /* ignore */
  }
  try {
    if (lastAnnexPayload && annexBundleHasContent(lastAnnexPayload)) {
      void saveActiveSessionAnnexBundle(lastAnnexPayload);
    }
  } catch {
    /* ignore */
  }
}

function clip(s: unknown, max = MAX_TEXT): string {
  return String(s ?? "").slice(0, max);
}

export function buildReportFingerprint(d: {
  patientName?: string;
  studyType?: string;
  generatedReport?: string;
  editedReportText?: string;
}): string {
  const report = clip(d.editedReportText || d.generatedReport || "", 400);
  return [
    clip(d.patientName, 80),
    clip(d.studyType, 120),
    String(report.length),
    report.slice(0, 80),
  ].join("|");
}

export function draftHasReport(d: Partial<ActiveSessionDraft> | null | undefined): boolean {
  if (!d) return false;
  return Boolean(
    clip(d.generatedReport).trim() || clip(d.editedReportText).trim()
  );
}

export function annexBundleHasContent(
  b: Partial<ActiveSessionAnnexBundle> | null | undefined
): boolean {
  if (!b) return false;
  return Boolean(
    b.clinicalScorecardData ||
      b.reasoningChainData ||
      b.negativityChecklistData ||
      b.secondReaderData ||
      b.differentialTreeData ||
      b.findingsInfographicData ||
      (Array.isArray(b.diagnosticPacks) && b.diagnosticPacks.length > 0) ||
      b.dominantLesionCardData ||
      (b.findingExplainerData &&
        Array.isArray((b.findingExplainerData as any).cards) &&
        (b.findingExplainerData as any).cards.length > 0) ||
      b.measurementGaugeData ||
      b.biomechanicalRadarData ||
      b.atlas3dData ||
      b.vascular3dData ||
      b.focalLesion3dData ||
      b.usPlaneSimulatorData ||
      b.thyroid3dData ||
      b.breast3dData ||
      b.shoulder3dData ||
      b.knee3dData ||
      b.ankle3dData ||
      b.kidney3dData ||
      b.abdomen3dData ||
      b.abdominalWall3dData ||
      b.scrotum3dData ||
      b.muscleTendon3dData ||
      b.wrist3dData ||
      b.patientSummary ||
      b.infographicUrl ||
      b.infographicClinicianUrl ||
      b.directedInfographicUrl ||
      b.directedInfographicClinicianUrl ||
      b.elastographyImage3d ||
      b.elastographyOriginalImage ||
      b.includeElastographyInReport ||
      (Array.isArray(b.attachedImages) && b.attachedImages.length > 0) ||
      (Array.isArray(b.findings3dRenders) && b.findings3dRenders.length > 0) ||
      clip(b.diagnosisAnchor).trim() ||
      clip(b.operationalSummaryText).trim()
  );
}

export function loadActiveSessionDraft(): ActiveSessionDraft | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_DRAFT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ActiveSessionDraft;
    if (!o || (o.v !== 1 && o.v !== 2)) return null;
    if (!draftHasReport(o)) return null;
    return {
      v: 2,
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
      reportFingerprint:
        o.reportFingerprint ||
        buildReportFingerprint({
          patientName: o.patientName,
          studyType: o.studyType,
          generatedReport: o.generatedReport,
          editedReportText: o.editedReportText,
        }),
      hasAnnexBundle: Boolean(o.hasAnnexBundle),
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
    const fingerprint =
      partial.reportFingerprint ||
      buildReportFingerprint(partial);
    const payload: ActiveSessionDraft = {
      v: 2,
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
      reportFingerprint: fingerprint,
      hasAnnexBundle: Boolean(partial.hasAnnexBundle),
    };
    sessionStorage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("No se pudo guardar borrador de sesión:", err);
    return false;
  }
}

function openAnnexDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb =
      (typeof globalThis !== "undefined" && (globalThis as any).indexedDB) ||
      (typeof window !== "undefined" && window.indexedDB) ||
      null;
    if (!idb) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = idb.open(ANNEX_DB, ANNEX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ANNEX_STORE)) {
        db.createObjectStore(ANNEX_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
  });
}

/** Finish each transaction before releasing its connection, including failed saves. */
async function runAnnexRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openAnnexDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(ANNEX_STORE, mode);
      const request = operation(tx.objectStore(ANNEX_STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error || new Error("Annex transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("Annex transaction aborted"));
    });
  } finally {
    db.close();
  }
}

/** Drop oversized elastography bitmaps before IDB put (prevents UI freeze on open). */
function sanitizeAnnexImagesForIdb<T extends Omit<ActiveSessionAnnexBundle, "v" | "savedAt">>(
  partial: T
): T {
  const MAX = 1_800_000; // ~1.8MB chars — enough for preview, safe for IDB
  const trim = (s: string | null | undefined) => {
    if (!s) return null;
    return s.length > MAX ? null : s;
  };
  return {
    ...partial,
    elastographyImage3d: trim(partial.elastographyImage3d as any) as any,
    elastographyOriginalImage: trim(partial.elastographyOriginalImage as any) as any,
  };
}

export async function saveActiveSessionAnnexBundle(
  partial: Omit<ActiveSessionAnnexBundle, "v" | "savedAt">
): Promise<boolean> {
  const safe = sanitizeAnnexImagesForIdb(partial);
  if (!annexBundleHasContent(safe)) return false;
  const payload: ActiveSessionAnnexBundle & { id: string } = {
    id: ANNEX_KEY,
    v: 1,
    savedAt: new Date().toISOString(),
    ...safe,
    reportFingerprint: safe.reportFingerprint || "",
  };
  try {
    await runAnnexRequest("readwrite", (store) => store.put(payload));
    // Mark light draft so recovery UI knows annexes exist
    const light = loadActiveSessionDraft();
    if (light) {
      saveActiveSessionDraft({ ...light, hasAnnexBundle: true, reportFingerprint: payload.reportFingerprint });
    }
    return true;
  } catch (err) {
    console.warn("No se pudo guardar anexos de sesión (IDB):", err);
    // Retry once without the heaviest image arrays if quota-ish failure
    try {
      const slim = {
        ...safe,
        attachedImages: [],
        findings3dRenders: [],
        elastographyImage3d: null,
        elastographyOriginalImage: null,
      };
      if (!annexBundleHasContent(slim)) return false;
      await runAnnexRequest("readwrite", (store) => store.put({
        id: ANNEX_KEY,
        v: 1,
        savedAt: new Date().toISOString(),
        ...slim,
      }));
      return true;
    } catch (err2) {
      console.warn("Reintento slim de anexos también falló:", err2);
      return false;
    }
  }
}

export async function loadActiveSessionAnnexBundle(
  expectedFingerprint?: string
): Promise<ActiveSessionAnnexBundle | null> {
  try {
    const row = await runAnnexRequest("readonly", (store) => store.get(ANNEX_KEY));
    if (!row || row.v !== 1) return null;
    if (
      expectedFingerprint &&
      row.reportFingerprint &&
      row.reportFingerprint !== expectedFingerprint
    ) {
      return null;
    }
    const { id: _id, ...bundle } = row;
    return bundle as ActiveSessionAnnexBundle;
  } catch (err) {
    console.warn("No se pudieron cargar anexos de sesión:", err);
    return null;
  }
}

export async function clearActiveSessionAnnexBundle(): Promise<void> {
  lastAnnexPayload = null;
  try {
    await runAnnexRequest("readwrite", (store) => store.delete(ANNEX_KEY));
  } catch {
    /* ignore */
  }
}

export function clearActiveSessionDraft(): void {
  lastPayload = null;
  lastAnnexPayload = null;
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_DRAFT_KEY);
  } catch {
    /* ignore */
  }
  void clearActiveSessionAnnexBundle();
}
