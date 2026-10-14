import { useState, useEffect, useMemo, useRef } from "react";
import type { Worklist, WorklistPatient } from "../firebaseDb";
import { saveWorklistToCloud, getWorklistFromCloud } from "../firebaseDb";
import { idbSaveWorklist, idbGetWorklist, idbClearWorklist, getActiveWorklistId } from "../localDb";
import { pushWorklistToBridge } from "./localBridge";
import { formatCostaRicaPhone } from "./appFormatters";

export interface UseWorklistPersistenceArgs {
  userId?: string | null;
  resolveLabelingModel: () => string;
}

/** Normalize Firestore Timestamp / number / missing → ms epoch. */
function worklistUpdatedAt(wl: Worklist | null | undefined): number {
  if (!wl) return 0;
  const n = Number(wl.updatedAt);
  if (Number.isFinite(n) && n > 0) return n;
  const c: any = wl.createdAt;
  if (c && typeof c.toMillis === "function") {
    const ms = Number(c.toMillis());
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  if (c && typeof c.seconds === "number") {
    return c.seconds * 1000;
  }
  if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  return 0;
}

type WorklistCandidate = { wl: Worklist; source: string; priority: number };

/**
 * Newest agenda wins. Never prefer a longer/stale list over a freshly digitized one.
 * If either side lacks updatedAt, prefer canonical local (idb/current) over cloud/legacy.
 */
function pickBestWorklist(candidates: WorklistCandidate[]): Worklist | null {
  const usable = candidates.filter((c) => Array.isArray(c.wl?.patients) && c.wl.patients.length > 0);
  if (usable.length === 0) return null;
  usable.sort((a, b) => {
    const ta = worklistUpdatedAt(a.wl);
    const tb = worklistUpdatedAt(b.wl);
    if (ta > 0 && tb > 0 && ta !== tb) return tb - ta;
    // Missing timestamps → trust local canonical over cloud / dated dumps
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (ta !== tb) return tb - ta;
    // Last resort only: more patients when same age + same priority
    return (b.wl.patients?.length || 0) - (a.wl.patients?.length || 0);
  });
  return usable[0].wl;
}

function purgeLegacyWorklistKeys(activeUserId: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const keep = new Set([
    "rad_worklist_current",
    "rad_worklist_latest",
    "rad_worklist_sidebar_open",
    "rad_worklist_explicitly_cleared",
    `fallback_worklist_${activeUserId}_active`,
  ]);
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (keep.has(key)) continue;
    if (
      key.startsWith("fallback_worklist_") ||
      (key.startsWith("rad_worklist_") &&
        key !== "rad_worklist_current" &&
        key !== "rad_worklist_latest" &&
        key !== "rad_worklist_sidebar_open" &&
        key !== "rad_worklist_explicitly_cleared")
    ) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
}

export function useWorklistPersistence({ userId, resolveLabelingModel }: UseWorklistPersistenceArgs) {
  // 1c. WORKLIST ("LISTA DE TRABAJO") STATES
  const [worklist, setWorklist] = useState<Worklist | null>(() => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const isExplicitlyCleared = localStorage.getItem("rad_worklist_explicitly_cleared") === "true";
      if (isExplicitlyCleared) {
        return null;
      }
      const primaryKeys = ["rad_worklist_current", "rad_worklist_latest"];
      for (const key of primaryKeys) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
            return parsed;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isWorklistSidebarOpen, setIsWorklistSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return localStorage.getItem("rad_worklist_sidebar_open") === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("rad_worklist_sidebar_open", String(isWorklistSidebarOpen));
    }
  }, [isWorklistSidebarOpen]);

  const [isProcessingWorklist, setIsProcessingWorklist] = useState<boolean>(false);
  const [worklistError, setWorklistError] = useState<string | null>(null);
  const [selectedWorklistPatientId, setSelectedWorklistPatientId] = useState<string | null>(null);
  const [bridgePatientCount, setBridgePatientCount] = useState<number>(0);

  /** Guards boot fetch from clobbering a list the user just saved. */
  const latestLocalUpdatedAtRef = useRef<number>(worklistUpdatedAt(worklist));
  useEffect(() => {
    latestLocalUpdatedAtRef.current = Math.max(
      latestLocalUpdatedAtRef.current,
      worklistUpdatedAt(worklist)
    );
  }, [worklist]);

  // --- DAILY WORKLIST SYSTEM ("LISTA DE TRABAJO") ---
  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchWorklist = async (overrideUserId?: string) => {
    try {
      const activeUserId = overrideUserId || userId || "local";
      const dateStr = getTodayDateStr();
      const activeWorklistId = getActiveWorklistId(activeUserId);

      const commitWorklistLocally = async (wl: Worklist) => {
        const normalized: Worklist = {
          ...wl,
          id: activeWorklistId,
          userId: activeUserId,
          date: wl.date || dateStr,
          updatedAt: worklistUpdatedAt(wl) || Date.now(),
        };
        latestLocalUpdatedAtRef.current = Math.max(
          latestLocalUpdatedAtRef.current,
          worklistUpdatedAt(normalized)
        );
        setWorklist(normalized);
        await idbSaveWorklist(normalized);
        const jsonStr = JSON.stringify(normalized);
        try {
          localStorage.setItem("rad_worklist_current", jsonStr);
          localStorage.setItem("rad_worklist_latest", jsonStr);
          localStorage.setItem(`fallback_worklist_${activeUserId}_active`, jsonStr);
          localStorage.removeItem("rad_worklist_explicitly_cleared");
        } catch (e) {}
      };

      if (localStorage.getItem("rad_worklist_explicitly_cleared") === "true") {
        setWorklist({
          id: activeWorklistId,
          userId: activeUserId,
          date: dateStr,
          patients: [],
          updatedAt: Date.now(),
        });
        return;
      }

      const candidates: WorklistCandidate[] = [];

      const pushCandidate = (wl: Worklist | null | undefined, source: string, priority: number) => {
        if (!wl?.patients?.length) return;
        candidates.push({ wl, source, priority });
      };

      // In-memory (just digitized / already hydrated) — highest trust
      if (worklist?.patients?.length) {
        pushCandidate(worklist, "memory", 100);
      }

      const idbWl = await idbGetWorklist();
      pushCandidate(idbWl, "idb", 90);

      // Canonical localStorage only — do NOT resurrect every dated fallback dump
      const canonicalKeys: Array<{ key: string; priority: number }> = [
        { key: "rad_worklist_current", priority: 85 },
        { key: "rad_worklist_latest", priority: 80 },
        { key: `fallback_worklist_${activeUserId}_active`, priority: 75 },
      ];
      if (activeUserId !== "local") {
        canonicalKeys.push({ key: "fallback_worklist_local_active", priority: 60 });
        canonicalKeys.push({ key: "rad_worklist_local_active", priority: 55 });
      }

      for (const { key, priority } of canonicalKeys) {
        const val = localStorage.getItem(key);
        if (!val) continue;
        try {
          pushCandidate(JSON.parse(val) as Worklist, key, priority);
        } catch (e) {}
      }

      if (activeUserId !== "local") {
        try {
          // Do not let cloud overwrite local fallback before merge (see getWorklistFromCloud)
          const cloudWl = await getWorklistFromCloud(activeUserId, activeWorklistId, {
            skipLocalMirror: true,
          });
          pushCandidate(cloudWl, "cloud", 40);
        } catch (err) {
          console.warn("Could not load worklist from cloud:", err);
        }
      }

      const best = pickBestWorklist(candidates);
      if (best) {
        const bestTs = worklistUpdatedAt(best);
        // If user saved during this fetch, never roll back to something older
        if (
          latestLocalUpdatedAtRef.current > 0 &&
          bestTs > 0 &&
          bestTs < latestLocalUpdatedAtRef.current
        ) {
          return;
        }
        await commitWorklistLocally(best);
        purgeLegacyWorklistKeys(activeUserId);
        return;
      }

      setWorklist((prev) => {
        if (prev?.patients?.length) {
          void commitWorklistLocally({
            ...prev,
            id: activeWorklistId,
            userId: activeUserId,
          });
          return prev;
        }
        return {
          id: activeWorklistId,
          userId: activeUserId,
          date: dateStr,
          patients: [],
          updatedAt: Date.now(),
        };
      });
    } catch (e) {
      console.error("Error loading worklist:", e);
    }
  };

  useEffect(() => {
    fetchWorklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when auth user changes
  }, [userId]);

  const saveWorklist = async (updatedPatients: WorklistPatient[]) => {
    const dateStr = getTodayDateStr();
    const activeUserId = userId || "local";
    const worklistId = getActiveWorklistId(activeUserId);
    const now = Date.now();
    const wlData: Worklist = {
      id: worklistId,
      userId: activeUserId,
      date: worklist?.date || dateStr,
      patients: updatedPatients,
      updatedAt: now,
    };

    try {
      latestLocalUpdatedAtRef.current = now;
      setWorklist(wlData);
      const jsonStr = JSON.stringify(wlData);

      // Clean up legacy fallback keys so old agendas never resurface
      localStorage.removeItem("rad_worklist_active");
      localStorage.removeItem("rad_worklist_backup_permanent");
      purgeLegacyWorklistKeys(activeUserId);

      if (updatedPatients.length === 0) {
        await idbClearWorklist();
        localStorage.setItem("rad_worklist_explicitly_cleared", "true");
        localStorage.removeItem("rad_worklist_current");
        localStorage.removeItem("rad_worklist_latest");
        localStorage.removeItem(`fallback_worklist_${activeUserId}_active`);
      } else {
        await idbSaveWorklist(wlData);
        localStorage.removeItem("rad_worklist_explicitly_cleared");
        try {
          localStorage.setItem("rad_worklist_current", jsonStr);
          localStorage.setItem("rad_worklist_latest", jsonStr);
          localStorage.setItem(`fallback_worklist_${activeUserId}_active`, jsonStr);
        } catch (e) {}
      }

      if (activeUserId && activeUserId !== "local") {
        saveWorklistToCloud(activeUserId, wlData).catch((err) => {
          console.warn("Could not sync worklist to cloud:", err);
        });
      }

      if (updatedPatients.length > 0) {
        pushWorklistToBridge(
          updatedPatients.map((p, index) => ({
            id: p.id,
            internalId: p.id,
            name: p.name,
            patientId: p.patientId || `SS-${String(index + 1).padStart(4, "0")}`,
            gender: p.gender,
            age: p.age,
            studyType: p.studyType,
            time: p.time,
          }))
        ).then((ok) => {
          if (ok) setBridgePatientCount(updatedPatients.length);
        });
      }
    } catch (e: any) {
      console.error("Error saving worklist:", e);
      setWorklistError("Error al guardar la lista de trabajo: " + (e.message || String(e)));
    }
  };

  const handleWorklistImageUpload = async (file: File, mergeExisting: boolean = false) => {
    setIsProcessingWorklist(true);
    setWorklistError(null);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/parse-worklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: file.type,
          model: resolveLabelingModel(),
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "No se pudo procesar la lista.");
      }

      const parsedPatients = (result.patients || []).map((p: any, idx: number) => ({
        id: `wl_${Date.now()}_${idx}`,
        name: p.name || "Paciente Desconocido",
        age: p.age || "",
        gender: p.gender || "",
        patientId: p.patientId || "",
        studyType: p.studyType || "",
        time: p.time || "",
        phone: p.phone ? formatCostaRicaPhone(p.phone) : "",
        status: "pending" as const,
      }));

      if (parsedPatients.length === 0) {
        throw new Error("No se detectaron pacientes legibles en la imagen. Intenta con otra foto.");
      }

      let updatedList: WorklistPatient[] = [];
      if (mergeExisting && worklist) {
        const existingPatients = worklist.patients;

        // Función para normalizar nombres para la comparación
        const normalizeName = (name: string) =>
          name.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, "").trim();

        // Mapeo de nombres normalizados de pacientes existentes
        const existingMap = new Map<string, WorklistPatient>();
        existingPatients.forEach((p) => {
          const norm = normalizeName(p.name);
          if (norm) {
            existingMap.set(norm, p);
          }
        });

        // Reconstruimos la lista en el orden de parsedPatients, reutilizando los objetos existentes si coinciden
        const mergedList: WorklistPatient[] = [];
        const usedExistingIds = new Set<string>();

        parsedPatients.forEach((pNew) => {
          const normNew = normalizeName(pNew.name);
          const matchedExisting = normNew ? existingMap.get(normNew) : null;

          if (matchedExisting) {
            mergedList.push(matchedExisting);
            usedExistingIds.add(matchedExisting.id);
          } else {
            mergedList.push(pNew);
          }
        });

        // Para cualquier paciente existente que no se haya detectado en la nueva digitalización,
        // lo reinsertamos de forma inteligente respetando su orden relativo original para evitar perderlo.
        const remainingExisting = existingPatients.filter((p) => !usedExistingIds.has(p.id));

        if (remainingExisting.length > 0) {
          const finalList: WorklistPatient[] = [];
          let mergedIdx = 0;

          existingPatients.forEach((pExisting) => {
            if (usedExistingIds.has(pExisting.id)) {
              while (mergedIdx < mergedList.length) {
                const curMerged = mergedList[mergedIdx];
                const isAnotherMatched = existingPatients.some((pe) => pe.id === curMerged.id);
                if (isAnotherMatched && curMerged.id !== pExisting.id) {
                  break;
                }
                if (!finalList.some((pf) => pf.id === curMerged.id)) {
                  finalList.push(curMerged);
                }
                mergedIdx++;
              }
            } else {
              finalList.push(pExisting);
            }
          });

          while (mergedIdx < mergedList.length) {
            const curMerged = mergedList[mergedIdx];
            if (!finalList.some((pf) => pf.id === curMerged.id)) {
              finalList.push(curMerged);
            }
            mergedIdx++;
          }

          updatedList = finalList;
        } else {
          updatedList = mergedList;
        }
      } else {
        updatedList = parsedPatients;
      }

      await saveWorklist(updatedList);
    } catch (err: any) {
      console.error("Error processing worklist photo:", err);
      setWorklistError(err.message || String(err));
    } finally {
      setIsProcessingWorklist(false);
    }
  };

  const activeWorklistPatient = useMemo(() => {
    if (!worklist) return null;
    if (selectedWorklistPatientId) {
      return worklist.patients.find((p) => p.id === selectedWorklistPatientId) || null;
    }
    return worklist.patients.find((p) => p.status === "current") || null;
  }, [worklist, selectedWorklistPatientId]);

  useEffect(() => {
    if (!worklist || selectedWorklistPatientId) return;
    const currentPatient = worklist.patients.find((p) => p.status === "current");
    if (currentPatient) {
      setSelectedWorklistPatientId(currentPatient.id);
    }
  }, [worklist, selectedWorklistPatientId]);

  const handleUpdatePatientStatus = (patientId: string, status: "pending" | "attended" | "current") => {
    if (!worklist) return;

    const updatedPatients = worklist.patients.map((p) => {
      if (p.id === patientId) {
        return { ...p, status };
      }
      return p;
    });

    saveWorklist(updatedPatients);
  };

  const handleDeletePatientFromWorklist = (patientId: string) => {
    if (!worklist) return;

    const updatedPatients = worklist.patients.filter((p) => p.id !== patientId);
    saveWorklist(updatedPatients);
  };

  const handleAddPatientToWorklist = (newPatient: Omit<WorklistPatient, "id" | "status">) => {
    const updatedPatients = worklist
      ? [...worklist.patients, { ...newPatient, id: `wl_${Date.now()}`, status: "pending" as const }]
      : [{ ...newPatient, id: `wl_${Date.now()}`, status: "pending" as const }];
    saveWorklist(updatedPatients);
  };

  return {
    worklist,
    setWorklist,
    isWorklistSidebarOpen,
    setIsWorklistSidebarOpen,
    isProcessingWorklist,
    worklistError,
    setWorklistError,
    selectedWorklistPatientId,
    setSelectedWorklistPatientId,
    bridgePatientCount,
    setBridgePatientCount,
    getTodayDateStr,
    fetchWorklist,
    saveWorklist,
    handleWorklistImageUpload,
    activeWorklistPatient,
    handleUpdatePatientStatus,
    handleDeletePatientFromWorklist,
    handleAddPatientToWorklist,
  };
}
