import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  serverTimestamp
} from "firebase/firestore";
import { app, auth } from "./firebaseAuth";
import firebaseConfig from "../firebase-applet-config.json";

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface CloudStudy {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: string; // Human readable timestamp
  createdAt?: any; // Firestore ServerTimestamp or Date
  patientName: string;
  patientEmail: string;
  reportDate: string;
  doctorName: string;
  doctorLicense: string;
  clinicName: string;
  studyType: string;
  clinicalHistory: string;
  findings: string;
  reportText: string;
  pdfBase64?: string; // Stored compiled jsPDF Base64
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

  const path = `clinical_studies/${study.id}`;
  try {
    const docRef = doc(db, "clinical_studies", study.id);
    const dataToSave = {
      ...study,
      userId,
      userEmail,
      createdAt: serverTimestamp()
    };

    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Deletes a study from Firestore
 */
export const deleteStudyFromCloud = async (studyId: string): Promise<void> => {
  const path = `clinical_studies/${studyId}`;
  try {
    const docRef = doc(db, "clinical_studies", studyId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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

    const querySnapshot = await getDocs(q);
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
        pdfBase64: data.pdfBase64 || ""
      });
    });

    // Sort in memory by createdAt descending to avoid composite index requirement
    studies.sort((a, b) => {
      const aTime = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime())) : 0;
      const bTime = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime())) : 0;
      return bTime - aTime;
    });

    return studies;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};
