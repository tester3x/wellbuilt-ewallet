// Vehicle document fetch service for eWallet
// Reads from Firestore `vehicle_documents` collection (uploaded by Dashboard admin).
// Vehicle docs are company property — displayed via storageUrl, not downloaded locally.
// Metadata cached in AsyncStorage for offline display.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAGWXa-doFGzo7T5SxHVD_v5-SHXIc8wAI',
  authDomain: 'wellbuilt-sync.firebaseapp.com',
  projectId: 'wellbuilt-sync',
  storageBucket: 'wellbuilt-sync.firebasestorage.app',
};

function getDb() {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface VehicleDocument {
  id: string;
  companyId: string;
  equipmentType: 'truck' | 'trailer';
  equipmentNumber: string;
  type: string;
  label: string;
  storageUrl: string;
  expirationDate?: string;
  issuedDate?: string;
  documentNumber?: string;
  state?: string;
  notes?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Firestore queries ──────────────────────────────────────────────────────

function parseTimestamp(val: any): string {
  if (!val) return '';
  if (val.toDate) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return '';
}

function docToVehicleDocument(id: string, data: any): VehicleDocument {
  return {
    id,
    companyId: data.companyId || '',
    equipmentType: data.equipmentType || 'truck',
    equipmentNumber: data.equipmentNumber || '',
    type: data.type || 'other',
    label: data.label || '',
    storageUrl: data.storageUrl || '',
    expirationDate: data.expirationDate || undefined,
    issuedDate: data.issuedDate || undefined,
    documentNumber: data.documentNumber || undefined,
    state: data.state || undefined,
    notes: data.notes || undefined,
    uploadedBy: data.uploadedBy || '',
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt),
  };
}

/** Fetch vehicle docs for a specific piece of equipment. */
export async function fetchVehicleDocsForEquipment(
  companyId: string,
  equipmentType: 'truck' | 'trailer',
  equipmentNumber: string,
): Promise<VehicleDocument[]> {
  const db = getDb();
  const q = query(
    collection(db, 'vehicle_documents'),
    where('companyId', '==', companyId),
    where('equipmentType', '==', equipmentType),
    where('equipmentNumber', '==', equipmentNumber.trim().toUpperCase()),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToVehicleDocument(d.id, d.data()));
}

/** Fetch vehicle docs for both truck and trailer at once. */
export async function fetchVehicleDocsForMultiple(
  companyId: string,
  truckNumber: string,
  trailerNumber: string,
): Promise<{ truck: VehicleDocument[]; trailer: VehicleDocument[] }> {
  const [truck, trailer] = await Promise.all([
    truckNumber ? fetchVehicleDocsForEquipment(companyId, 'truck', truckNumber) : Promise.resolve([]),
    trailerNumber ? fetchVehicleDocsForEquipment(companyId, 'trailer', trailerNumber) : Promise.resolve([]),
  ]);
  return { truck, trailer };
}

// ── Cache layer ────────────────────────────────────────────────────────────

const CACHE_KEY = 'wbew_vehicleDocs';
const CACHE_TRUCK_KEY = 'wbew_vehicleDocs_truck';
const CACHE_TRAILER_KEY = 'wbew_vehicleDocs_trailer';

export async function cacheVehicleDocs(
  truck: VehicleDocument[],
  trailer: VehicleDocument[],
  truckNumber: string,
  trailerNumber: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ truck, trailer }));
    await AsyncStorage.setItem(CACHE_TRUCK_KEY, truckNumber);
    await AsyncStorage.setItem(CACHE_TRAILER_KEY, trailerNumber);
  } catch (err) {
    console.warn('[vehicleDocs] Cache save failed:', err);
  }
}

export async function getCachedVehicleDocs(): Promise<{
  truck: VehicleDocument[];
  trailer: VehicleDocument[];
  truckNumber: string;
  trailerNumber: string;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const truckNumber = await AsyncStorage.getItem(CACHE_TRUCK_KEY) || '';
    const trailerNumber = await AsyncStorage.getItem(CACHE_TRAILER_KEY) || '';
    return { ...data, truckNumber, trailerNumber };
  } catch {
    return null;
  }
}

export async function clearVehicleDocsCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TRUCK_KEY, CACHE_TRAILER_KEY]);
}

// ── Expiration helpers ─────────────────────────────────────────────────────

export function isDocExpired(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

export function daysUntilExpiration(expirationDate?: string): number | null {
  if (!expirationDate) return null;
  const diff = new Date(expirationDate).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}
