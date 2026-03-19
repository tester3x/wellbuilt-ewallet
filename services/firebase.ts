import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAGWXa-doFGzo7T5SxHVD_v5-SHXIc8wAI',
  authDomain: 'wellbuilt-sync.firebaseapp.com',
  databaseURL: 'https://wellbuilt-sync-default-rtdb.firebaseio.com',
  projectId: 'wellbuilt-sync',
  storageBucket: 'wellbuilt-sync.firebasestorage.app',
  messagingSenderId: '559487114498',
  appId: '1:559487114498:web:e951ab0c6388339d5bf61b',
  measurementId: 'G-XWQQ98B8LG',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Firestore: driver_documents collection ---

export interface DriverDocument {
  id: string;
  driverHash: string;
  companyId?: string;
  type: DocumentType;
  label: string;
  // Image data
  imageUri: string; // local file URI
  cloudUri?: string; // Firebase Storage download URL
  thumbnailUri?: string;
  // Metadata
  expirationDate?: string; // ISO date
  issuedDate?: string;
  documentNumber?: string;
  state?: string; // issuing state
  notes?: string;
  // Privacy
  personal?: boolean; // true = wiped on SSO logout from shared device
  // Timestamps
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export type DocumentType =
  | 'cdl'
  | 'medical_card'
  | 'insurance'
  | 'registration'
  | 'dot_inspection'
  | 'hazmat_cert'
  | 'twic_card'
  | 'ifta_permit'
  | 'drug_test'
  | 'training_cert'
  | 'other';

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  cdl: 'CDL',
  medical_card: 'Medical Card',
  insurance: 'Insurance',
  registration: 'Registration',
  dot_inspection: 'DOT Inspection',
  hazmat_cert: 'Hazmat Certification',
  twic_card: 'TWIC Card',
  ifta_permit: 'IFTA Permit',
  drug_test: 'Drug Test Results',
  training_cert: 'Training Certificate',
  other: 'Other',
};

export const DOC_TYPE_ICONS: Record<DocumentType, string> = {
  cdl: 'card-account-details',
  medical_card: 'medical-bag',
  insurance: 'shield-check',
  registration: 'file-document',
  dot_inspection: 'clipboard-check',
  hazmat_cert: 'hazard-lights',
  twic_card: 'badge-account',
  ifta_permit: 'gas-station',
  drug_test: 'test-tube',
  training_cert: 'certificate',
  other: 'file-outline',
};

// Default personal flag per doc type — CDL and medical card are personal by default
export const DOC_TYPE_DEFAULT_PERSONAL: Record<DocumentType, boolean> = {
  cdl: true,
  medical_card: true,
  insurance: false,
  registration: false,
  dot_inspection: false,
  hazmat_cert: false,
  twic_card: false,
  ifta_permit: false,
  drug_test: false,
  training_cert: false,
  other: false,
};

const DOCS_COLLECTION = 'driver_documents';

// --- Firestore CRUD ---

export async function uploadDocument(doc_data: DriverDocument): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, DOCS_COLLECTION, doc_data.id);
    await setDoc(docRef, {
      ...doc_data,
      syncedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('[eWallet] Error uploading document:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchDriverDocuments(driverHash: string): Promise<DriverDocument[]> {
  try {
    const q = query(
      collection(db, DOCS_COLLECTION),
      where('driverHash', '==', driverHash),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as DriverDocument);
  } catch (error) {
    console.error('[eWallet] Error fetching documents:', error);
    return [];
  }
}

export async function deleteDocumentFromCloud(docId: string): Promise<{ success: boolean }> {
  try {
    await deleteDoc(doc(db, DOCS_COLLECTION, docId));
    return { success: true };
  } catch (error) {
    console.error('[eWallet] Error deleting document:', error);
    return { success: false };
  }
}

// --- Firebase Storage ---

export async function uploadImageToStorage(
  driverHash: string,
  docId: string,
  imageBlob: Blob
): Promise<string | null> {
  try {
    const storageRef = ref(storage, `ewallet/${driverHash}/${docId}.jpg`);
    await uploadBytes(storageRef, imageBlob);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('[eWallet] Error uploading image to storage:', error);
    return null;
  }
}

export async function deleteImageFromStorage(driverHash: string, docId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `ewallet/${driverHash}/${docId}.jpg`);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignore — file may not exist in cloud yet
  }
}

export { db, storage };
