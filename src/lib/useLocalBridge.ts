import { useState, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import {
  checkBridgeHealth,
  listBridgeCaptures,
  fetchBridgeCaptureBuffer,
  subscribeBridgeEvents,
  type BridgeCaptureEvent,
} from "./localBridge";
import { decodeDicomForDisplay, compressImageForAttachment } from "./dicomHelpers";
import type { CaptureMismatchInfo } from "../components/ActivePatientPanel";

export type BridgeAttachedImage = {
  id: string;
  name: string;
  url: string;
  base64: string;
  caption: string;
  isDicom: boolean;
  width?: number;
  height?: number;
  modality?: "MMG" | "US";
  dicomMetaData?: any;
};

export interface UseLocalBridgeArgs {
  /** DICOM PatientID of the currently open report form */
  patientId: string;
  /** Worklist patient DICOM id fallback for capture counting */
  activeWorklistPatientId?: string;
  attachedImages: Array<{ id: string }>;
  setAttachedImages: Dispatch<SetStateAction<any[]>>;
  setBridgePatientCount: (n: number) => void;
}

export function useLocalBridge({
  patientId,
  activeWorklistPatientId,
  attachedImages,
  setAttachedImages,
  setBridgePatientCount,
}: UseLocalBridgeArgs) {
  const [bridgeOnline, setBridgeOnline] = useState<boolean>(false);
  const [bridgeDicomReady, setBridgeDicomReady] = useState<boolean | null>(null);
  const [bridgeCaptureMismatch, setBridgeCaptureMismatch] = useState<CaptureMismatchInfo | null>(null);
  const bridgeImportedKeysRef = useRef<Set<string>>(new Set());

  const importBridgeCapturesForPatient = async (patientId: string) => {
    if (!patientId) return;
    try {
      const captures = await listBridgeCaptures(patientId);
      if (captures.length === 0) return;

      const loaded: BridgeAttachedImage[] = [];

      for (const cap of captures) {
        const importKey = `${patientId}/${cap.studyInstanceUid}/${cap.fileName}`;
        if (bridgeImportedKeysRef.current.has(importKey)) continue;

        const buffer = await fetchBridgeCaptureBuffer(patientId, cap.studyInstanceUid, cap.fileName);
        if (!buffer || buffer.byteLength === 0) continue;

        const { visualUrl, meta } = await decodeDicomForDisplay(buffer, cap.fileName);
        const res = await compressImageForAttachment(visualUrl);
        bridgeImportedKeysRef.current.add(importKey);

        loaded.push({
          id: "bridge-" + importKey.replace(/\//g, "-"),
          name: cap.fileName,
          url: res.dataUrl,
          base64: res.dataUrl,
          caption: "",
          isDicom: true,
          dicomMetaData: meta as any,
          width: res.width,
          height: res.height,
          modality: "US",
        });
      }

      if (loaded.length > 0) {
        setAttachedImages((prev) => {
          const existingIds = new Set(prev.map((img) => img.id));
          const novel = loaded.filter((img) => !existingIds.has(img.id));
          return novel.length > 0 ? [...prev, ...novel] : prev;
        });
      }
    } catch (err) {
      console.warn("No se pudieron importar capturas del puente local:", err);
    }
  };

  const handleBridgeCaptureEvent = (event: BridgeCaptureEvent) => {
    if (event.type !== "capture_received" || !event.patientId || !event.studyInstanceUid || !event.fileName) {
      return;
    }

    const currentPatientDicomId = patientId?.trim() || "";
    const shouldAttach =
      event.autoAttach ||
      (currentPatientDicomId !== "" && event.patientId === currentPatientDicomId);

    if (shouldAttach) {
      void importBridgeCapturesForPatient(event.patientId);
    } else if (currentPatientDicomId !== "" && event.patientId !== currentPatientDicomId) {
      setBridgeCaptureMismatch({
        patientId: event.patientId,
        patientName: event.patientName,
        fileName: event.fileName,
      });
    }
  };

  const activePatientCaptureCount = useMemo(() => {
    const dicomId = (patientId || activeWorklistPatientId || "").trim();
    if (!dicomId) return 0;
    const prefix = `bridge-${dicomId.replace(/\//g, "-")}`;
    return attachedImages.filter((img) => img.id.startsWith(prefix)).length;
  }, [attachedImages, patientId, activeWorklistPatientId]);

  useEffect(() => {
    let cancelled = false;

    const pollBridge = async () => {
      const health = await checkBridgeHealth();
      if (cancelled) return;
      setBridgeOnline(Boolean(health?.ok));
      if (health?.ok) {
        setBridgePatientCount(health.patients);
        if (typeof health.dicomReady === "boolean") {
          setBridgeDicomReady(health.dicomReady);
        } else if (
          typeof health.mwlListening === "boolean" &&
          typeof health.storageListening === "boolean"
        ) {
          setBridgeDicomReady(health.mwlListening && health.storageListening);
        } else {
          setBridgeDicomReady(null);
        }
      } else {
        setBridgeDicomReady(null);
      }
    };

    pollBridge();
    const interval = setInterval(pollBridge, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bridgeOnline) return;
    const unsubscribe = subscribeBridgeEvents(handleBridgeCaptureEvent);
    return unsubscribe;
  }, [bridgeOnline, patientId]);


  return {
    bridgeOnline,
    bridgeDicomReady,
    bridgeCaptureMismatch,
    setBridgeCaptureMismatch,
    bridgeImportedKeysRef,
    importBridgeCapturesForPatient,
    handleBridgeCaptureEvent,
    activePatientCaptureCount,
  };
}
