import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";
import { app, auth, getFirebaseConfig } from "./firebaseAuth";
import { initializeApp, deleteApp } from "firebase/app";

const activeConfig = getFirebaseConfig();

export const db = activeConfig.firestoreDatabaseId 
  ? getFirestore(app, activeConfig.firestoreDatabaseId) 
  : getFirestore(app);

export interface WorklistPatient {
  id: string;
  name: string;
  age: string;
  gender: string;
  patientId: string;
  studyType: string;
  time: string;
  status: 'pending' | 'attended' | 'current';
  phone?: string;
}

export interface Worklist {
  id: string; // e.g. `${userId}_${dateStr}`
  userId: string;
  date: string; // YYYY-MM-DD
  patients: WorklistPatient[];
  createdAt?: any;
}

export interface CloudStudy {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: string; // Human readable timestamp
  createdAt?: any; // Firestore ServerTimestamp or Date
  patientName: string;
  patientEmail: string;
  patientAge?: string;
  patientGender?: string;
  patientId?: string;
  reportDate: string;
  doctorName: string;
  doctorLicense: string;
  clinicName: string;
  studyType: string;
  clinicalHistory: string;
  findings: string;
  reportText: string;
  pdfBase64?: string; // Stored compiled jsPDF Base64
  operationalSummaryText?: string;
  customLogoUrl?: string;
  customLogoStyle?: string;
  customSignatureUrl?: string;
  specificStudy?: string;
  pdfLayoutType?: string;
  selectedLogo?: string;
  attachedImages?: any[];
  findings3dRenders?: any[];
  atlas3dData?: any;
  includeAtlas3dInReport?: boolean;
  vascular3dData?: any;
  includeVascular3dInReport?: boolean;
  usImagesGridMode?: string;
  patientSummary?: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Helper to race a promise against a timeout
 */
const promiseWithTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
  ]);
};

/**
 * Saves or updates a clinical study in Firestore
 */
export const saveStudyToCloud = async (
  userId: string,
  userEmail: string,
  study: Omit<CloudStudy, "userId" | "userEmail">
): Promise<void> => {
  if (!userId) {
    throw new Error("Se requiere iniciar sesión para guardar estudios en la nube.");
  }

  // 1. Always save to LocalStorage fallback first
  try {
    const localKey = `fallback_studies_${userId}`;
    const existingStr = localStorage.getItem(localKey);
    let localStudies: CloudStudy[] = [];
    if (existingStr) {
      try {
        localStudies = JSON.parse(existingStr);
      } catch (e) {
        localStudies = [];
      }
    }
    const fullStudy: CloudStudy = {
      ...study,
      userId,
      userEmail,
      createdAt: study.createdAt || new Date().toISOString()
    };
    const index = localStudies.findIndex(s => s.id === study.id);
    if (index >= 0) {
      localStudies[index] = fullStudy;
    } else {
      localStudies.unshift(fullStudy);
    }
    localStorage.setItem(localKey, JSON.stringify(localStudies));
  } catch (localErr) {
    console.warn("Could not save to local fallback storage:", localErr);
  }

  // Also save to a global lookup table in local storage so that getSingleStudyFromCloud can find it on this machine if quota is exceeded
  try {
    const globalKey = `fallback_single_study_${study.id}`;
    const fullStudy: CloudStudy = {
      ...study,
      userId,
      userEmail,
      createdAt: study.createdAt || new Date().toISOString()
    };
    localStorage.setItem(globalKey, JSON.stringify(fullStudy));
  } catch (err) {
    console.warn("Could not save to global study fallback storage:", err);
  }

  const path = `clinical_studies/${study.id}`;
  try {
    const docRef = doc(db, "clinical_studies", study.id);
    const dataToSave = {
      ...study,
      userId,
      userEmail,
      createdAt: serverTimestamp()
    };

    await promiseWithTimeout(
      setDoc(docRef, dataToSave, { merge: true }),
      15000,
      "Timeout writing to Firestore clinical_studies"
    );
  } catch (error) {
    console.error("Firestore error in saveStudyToCloud, using local storage fallback:", error);
    throw error;
  }
};

/**
 * Deletes a study from Firestore
 */
export const deleteStudyFromCloud = async (studyId: string): Promise<void> => {
  // Always delete from LocalStorage fallback as well
  try {
    localStorage.removeItem(`fallback_single_study_${studyId}`);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("fallback_studies_")) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const studies = JSON.parse(stored) as CloudStudy[];
            const filtered = studies.filter(s => s.id !== studyId);
            localStorage.setItem(key, JSON.stringify(filtered));
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn("Could not delete from local fallback storage:", err);
  }

  const path = `clinical_studies/${studyId}`;
  try {
    const docRef = doc(db, "clinical_studies", studyId);
    await promiseWithTimeout(
      deleteDoc(docRef),
      15000,
      "Timeout deleting from Firestore clinical_studies"
    );
  } catch (error) {
    console.error("Firestore error in deleteStudyFromCloud, using local storage fallback:", error);
    throw error;
  }
};

/**
 * Fetches all studies for a specific user from Firestore ordered by createdAt desc (sorted in memory)
 */
export const getStudiesFromCloud = async (userId: string): Promise<CloudStudy[]> => {
  if (!userId) return [];

  const path = "clinical_studies";
  try {
    const studiesCollection = collection(db, "clinical_studies");
    const q = query(
      studiesCollection,
      where("userId", "==", userId)
    );

    const querySnapshot = await promiseWithTimeout(
      getDocs(q),
      15000,
      "Timeout fetching from Firestore clinical_studies"
    );
    const studies: CloudStudy[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      studies.push({
        id: doc.id,
        userId: data.userId,
        userEmail: data.userEmail,
        timestamp: data.timestamp || "",
        createdAt: data.createdAt,
        patientName: data.patientName || "",
        patientEmail: data.patientEmail || "",
        reportDate: data.reportDate || "",
        doctorName: data.doctorName || "",
        doctorLicense: data.doctorLicense || "",
        clinicName: data.clinicName || "",
        studyType: data.studyType || "",
        clinicalHistory: data.clinicalHistory || "",
        findings: data.findings || "",
        reportText: data.reportText || "",
        pdfBase64: data.pdfBase64 || "",
        operationalSummaryText: data.operationalSummaryText || "",
        attachedImages: data.attachedImages || [],
        findings3dRenders: data.findings3dRenders || [],
        patientSummary: data.patientSummary || null
      });
    });

    // Sync cloud studies to local fallback cache
    try {
      const localKey = `fallback_studies_${userId}`;
      localStorage.setItem(localKey, JSON.stringify(studies));
    } catch (err) {
      console.warn("Could not sync cloud data to local storage cache:", err);
    }

    // Sort in memory by createdAt descending to avoid composite index requirement
    studies.sort((a, b) => {
      const aTime = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime())) : 0;
      const bTime = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime())) : 0;
      return bTime - aTime;
    });

    return studies;
  } catch (error) {
    console.error("Firestore getDocs failed:", error);
    throw error;
  }
};

/**
 * Fetches a single study publicly by its ID
 */
export const getSingleStudyFromCloud = async (studyId: string): Promise<CloudStudy | null> => {
  if (!studyId) return null;
  const path = `clinical_studies/${studyId}`;
  try {
    const docRef = doc(db, "clinical_studies", studyId);
    const docSnap = await promiseWithTimeout(
      getDoc(docRef),
      15000,
      "Timeout fetching single study from Firestore"
    );
    if (docSnap.exists()) {
      const data = docSnap.data();
      const studyObj: CloudStudy = {
        id: docSnap.id,
        userId: data.userId || "",
        userEmail: data.userEmail || "",
        timestamp: data.timestamp || "",
        createdAt: data.createdAt,
        patientName: data.patientName || "",
        patientEmail: data.patientEmail || "",
        reportDate: data.reportDate || "",
        doctorName: data.doctorName || "",
        doctorLicense: data.doctorLicense || "",
        clinicName: data.clinicName || "",
        studyType: data.studyType || "",
        clinicalHistory: data.clinicalHistory || "",
        findings: data.findings || "",
        reportText: data.reportText || "",
        pdfBase64: data.pdfBase64 || "",
        operationalSummaryText: data.operationalSummaryText || "",
        attachedImages: data.attachedImages || [],
        findings3dRenders: data.findings3dRenders || [],
        patientSummary: data.patientSummary || null
      };

      // Sync to global fallback
      try {
        localStorage.setItem(`fallback_single_study_${studyId}`, JSON.stringify(studyObj));
      } catch (err) {}

      return studyObj;
    }
    return null;
  } catch (error) {
    console.error("Firestore getDoc single study failed, falling back to local storage:", error);
    // Look up in global single study fallback
    try {
      const cached = localStorage.getItem(`fallback_single_study_${studyId}`);
      if (cached) {
        return JSON.parse(cached) as CloudStudy;
      }
    } catch (e) {
      console.error("Failed to parse cached single study:", e);
    }
    // Try to search in all fallback_studies_* keys as a second option
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fallback_studies_")) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const studies = JSON.parse(stored) as CloudStudy[];
            const found = studies.find(s => s.id === studyId);
            if (found) return found;
          }
        }
      }
    } catch (e) {}
    throw error;
  }
};

/**
 * Saves or updates a daily worklist in Firestore
 */
export const saveWorklistToCloud = async (
  userId: string,
  worklist: Omit<Worklist, "userId">
): Promise<void> => {
  if (!userId) return;

  // Always save to LocalStorage fallback first
  try {
    const localKey = `fallback_worklist_${userId}_${worklist.date}`;
    localStorage.setItem(localKey, JSON.stringify(worklist));
  } catch (localErr) {
    console.warn("Could not save worklist to local fallback storage:", localErr);
  }

  const path = `worklists/${worklist.id}`;
  try {
    const docRef = doc(db, "worklists", worklist.id);
    const dataToSave = {
      ...worklist,
      userId,
      createdAt: serverTimestamp()
    };
    await promiseWithTimeout(
      setDoc(docRef, dataToSave, { merge: true }),
      15000,
      "Timeout saving worklist to Firestore"
    );
  } catch (error) {
    console.error("Firestore error in saveWorklistToCloud, using local storage fallback:", error);
    throw error;
  }
};

/**
 * Loads a daily worklist for a given ID (e.g., userId_YYYY-MM-DD)
 */
export const getWorklistFromCloud = async (
  userId: string,
  worklistId: string
): Promise<Worklist | null> => {
  if (!userId) return null;
  const path = `worklists/${worklistId}`;
  try {
    const docRef = doc(db, "worklists", worklistId);
    const docSnap = await promiseWithTimeout(
      getDoc(docRef),
      15000,
      "Timeout fetching worklist from Firestore"
    );
    if (docSnap.exists()) {
      const data = docSnap.data();
      const wlObj: Worklist = {
        id: docSnap.id,
        userId: data.userId,
        date: data.date || "",
        patients: data.patients || [],
        createdAt: data.createdAt
      };

      // Sync to fallback cache
      try {
        const localKey = `fallback_worklist_${userId}_${wlObj.date}`;
        localStorage.setItem(localKey, JSON.stringify(wlObj));
      } catch (err) {}

      return wlObj;
    }
    return null;
  } catch (error) {
    console.error("Firestore error in getWorklistFromCloud, falling back to local storage:", error);
    // Parse the date from worklistId (it is format `${userId}_${dateStr}`)
    try {
      const parts = worklistId.split("_");
      const dateStr = parts[parts.length - 1]; // YYYY-MM-DD
      const localKey = `fallback_worklist_${userId}_${dateStr}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        return JSON.parse(cached) as Worklist;
      }
    } catch (e) {
      console.error("Failed to parse cached worklist:", e);
    }
    throw error;
  }
};

/**
 * Tests a given Firebase SDK configuration to check if its Firestore is active and responsive.
 * Returns helpful diagnostic messages if it fails or times out.
 */
export const testFirebaseConfigConnection = async (config: any): Promise<{ success: boolean; message: string }> => {
  let tempApp: any = null;
  try {
    const tempAppName = "test-app-" + Date.now();
    tempApp = initializeApp(config, tempAppName);
    const tempDb = config.firestoreDatabaseId 
      ? getFirestore(tempApp, config.firestoreDatabaseId)
      : getFirestore(tempApp);
    
    // Attempt to read from a dummy path to force a connection probe
    const docRef = doc(tempDb, "test_connection_probe", "ping");
    await promiseWithTimeout(
      getDocFromServer(docRef),
      6000,
      "Timeout al conectar con Firestore (6 segundos)."
    );
    
    return {
      success: true,
      message: "¡Conexión de prueba exitosa! Tu base de datos Firestore en la nube respondió correctamente."
    };
  } catch (err: any) {
    console.error("Test connection failed:", err);
    let msg = err?.message || String(err);
    if (msg.includes("Timeout")) {
      msg = "Tiempo de espera agotado (Timeout). Esto suele ocurrir si creaste el proyecto de Firebase pero te faltó CREAR la base de datos de Firestore en tu consola. Por favor, ve a la consola de Firebase -> Firestore Database, haz clic en 'Crear base de datos' (en modo producción o prueba) y selecciona una ubicación física para habilitarla.";
    } else if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
      // If we got permission denied, it means we actually connected to the DB successfully!
      return { 
        success: true, 
        message: "¡Conexión de prueba exitosa! Nos conectamos con éxito a tu base de datos (se detectaron tus reglas de seguridad activas, lo cual es correcto y esperado)." 
      };
    } else if (msg.includes("invalid-api-key") || msg.includes("API key")) {
      msg = "Error: La API Key proporcionada no es válida para este proyecto de Firebase.";
    } else {
      msg = `Error de conexión: ${msg}. Asegúrate de que el ID de tu proyecto y la API Key sean correctos, y que Firestore Database esté inicializado en tu consola de Firebase.`;
    }
    return {
      success: false,
      message: msg
    };
  } finally {
    if (tempApp) {
      try {
        await deleteApp(tempApp);
      } catch (e) {}
    }
  }
};

