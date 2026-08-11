import { Worklist, CloudStudy } from "./firebaseDb";

const DB_NAME = "RadiologyAppDB";
const DB_VERSION = 1;

const STORES = {
  WORKLIST: "worklists",
  STUDIES: "local_studies",
  HISTORY: "reports_history"
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject("IndexedDB not supported");
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.WORKLIST)) {
        db.createObjectStore(STORES.WORKLIST, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.STUDIES)) {
        db.createObjectStore(STORES.STUDIES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        db.createObjectStore(STORES.HISTORY, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- WORKLIST OPERATIONS ---
export async function idbSaveWorklist(wl: Worklist): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.WORKLIST, "readwrite");
    const store = tx.objectStore(STORES.WORKLIST);
    store.put({ ...wl, id: "current_worklist", updatedAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[IndexedDB] Error saving worklist:", e);
  }
}

export async function idbGetWorklist(): Promise<Worklist | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.WORKLIST, "readonly");
    const store = tx.objectStore(STORES.WORKLIST);
    const req = store.get("current_worklist");
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("[IndexedDB] Error getting worklist:", e);
    return null;
  }
}

export async function idbClearWorklist(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.WORKLIST, "readwrite");
    const store = tx.objectStore(STORES.WORKLIST);
    store.delete("current_worklist");
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {}
}

// --- LOCAL STUDIES OPERATIONS ---
export async function idbSaveStudy(study: CloudStudy): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.STUDIES, "readwrite");
    const store = tx.objectStore(STORES.STUDIES);
    store.put(study);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[IndexedDB] Error saving study:", e);
  }
}

export async function idbGetAllStudies(): Promise<CloudStudy[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.STUDIES, "readonly");
    const store = tx.objectStore(STORES.STUDIES);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const results = (req.result || []) as CloudStudy[];
        results.sort((a: CloudStudy, b: CloudStudy) => {
          const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return tB - tA;
        });
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn("[IndexedDB] Error getting studies:", e);
    return [];
  }
}

export async function idbDeleteStudy(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.STUDIES, "readwrite");
    const store = tx.objectStore(STORES.STUDIES);
    store.delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {}
}

// --- REPORTS HISTORY OPERATIONS ---
export async function idbSaveHistory(reports: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.HISTORY, "readwrite");
    const store = tx.objectStore(STORES.HISTORY);
    store.clear();
    for (const r of reports) {
      store.put(r);
    }
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.warn("[IndexedDB] Error saving history:", e);
  }
}

export async function idbGetHistory(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.HISTORY, "readonly");
    const store = tx.objectStore(STORES.HISTORY);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}
