/**
 * Cliente del puente local Samsung V7 (localhost).
 * La app en Cloud Run se comunica con el Mac donde corre samsung_bridge.py.
 */

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";

export interface BridgeHealth {
  ok: boolean;
  patients: number;
  activePatientId: string;
  mwlPort: number;
  storagePort: number;
  mwlAeTitle: string;
  storageAeTitle: string;
  dicomReady?: boolean;
  mwlListening?: boolean;
  storageListening?: boolean;
}

export interface BridgeWorklistPatient {
  id?: string;
  internalId?: string;
  name: string;
  patientId?: string;
  gender?: string;
  age?: string;
  studyType?: string;
  time?: string;
}

export interface BridgeCaptureEvent {
  type: string;
  patientId?: string;
  patientName?: string;
  studyInstanceUid?: string;
  sopInstanceUid?: string;
  fileName?: string;
  autoAttach?: boolean;
  receivedAt?: string;
}

export interface BridgeCaptureMeta {
  fileName: string;
  studyInstanceUid: string;
  sizeBytes: number;
  modifiedAt: string;
}

export async function checkBridgeHealth(baseUrl = DEFAULT_BRIDGE_URL): Promise<BridgeHealth | null> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      mode: "cors",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BridgeHealth;
    return data?.ok ? data : null;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[bridge] health check failed:", err);
    }
    return null;
  }
}

export async function pushWorklistToBridge(
  patients: BridgeWorklistPatient[],
  baseUrl = DEFAULT_BRIDGE_URL
): Promise<boolean> {
  try {
    const payload = patients.map((p, index) => ({
      name: p.name,
      patientId: p.patientId || `SS-${String(index + 1).padStart(4, "0")}`,
      gender: p.gender || "",
      age: p.age || "",
      studyType: p.studyType || "Ecografia US",
      time: p.time || "",
      internalId: p.internalId || p.id || "",
      accessionNumber: `ACC-${String(index + 1).padStart(4, "0")}`,
    }));

    const res = await fetch(`${baseUrl}/api/worklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients: payload }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setBridgeActivePatient(
  patient: { patientId?: string; internalId?: string; id?: string; name?: string },
  baseUrl = DEFAULT_BRIDGE_URL
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/active-patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patient.patientId || "",
        internalId: patient.internalId || patient.id || "",
        name: patient.name || "",
      }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listBridgeCaptures(
  patientId: string,
  baseUrl = DEFAULT_BRIDGE_URL
): Promise<BridgeCaptureMeta[]> {
  try {
    const res = await fetch(`${baseUrl}/api/patient/${encodeURIComponent(patientId)}/captures`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.captures || []) as BridgeCaptureMeta[];
  } catch {
    return [];
  }
}

export async function fetchBridgeCaptureBuffer(
  patientId: string,
  studyUid: string,
  fileName: string,
  baseUrl = DEFAULT_BRIDGE_URL
): Promise<ArrayBuffer | null> {
  try {
    const url = `${baseUrl}/api/patient/${encodeURIComponent(patientId)}/captures/${encodeURIComponent(studyUid)}/${encodeURIComponent(fileName)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export function subscribeBridgeEvents(
  onEvent: (event: BridgeCaptureEvent) => void,
  baseUrl = DEFAULT_BRIDGE_URL
): () => void {
  const source = new EventSource(`${baseUrl}/api/events`);

  source.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data) as BridgeCaptureEvent;
      onEvent(payload);
    } catch {
      // ignore malformed events
    }
  };

  source.onerror = () => {
    // EventSource auto-reconnects; no action needed
  };

  return () => source.close();
}
