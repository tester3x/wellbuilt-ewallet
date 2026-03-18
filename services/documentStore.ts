// services/documentStore.ts
// Local-first document storage using expo-file-system legacy API.
// Documents are stored locally and synced to Firebase in the background.

import {
  documentDirectory, getInfoAsync, makeDirectoryAsync, readAsStringAsync,
  writeAsStringAsync, deleteAsync, copyAsync, EncodingType,
} from 'expo-file-system/legacy';
import { DriverDocument, DocumentType, uploadDocument, deleteDocumentFromCloud, uploadImageToStorage, deleteImageFromStorage } from './firebase';

const DOCS_DIR = `${documentDirectory}ewallet/`;
const INDEX_FILE = `${DOCS_DIR}index.json`;

async function ensureDir(): Promise<void> {
  const info = await getInfoAsync(DOCS_DIR);
  if (!info.exists) await makeDirectoryAsync(DOCS_DIR, { intermediates: true });
}

// --- Index Management ---

async function loadIndex(): Promise<DriverDocument[]> {
  await ensureDir();
  const info = await getInfoAsync(INDEX_FILE);
  if (!info.exists) return [];
  const raw = await readAsStringAsync(INDEX_FILE);
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveIndex(docs: DriverDocument[]): Promise<void> {
  await ensureDir();
  await writeAsStringAsync(INDEX_FILE, JSON.stringify(docs));
}

// --- Public API ---

export async function getAllDocuments(): Promise<DriverDocument[]> {
  return loadIndex();
}

export async function getDocumentsByType(type: DocumentType): Promise<DriverDocument[]> {
  const all = await loadIndex();
  return all.filter(d => d.type === type);
}

export async function getDocument(id: string): Promise<DriverDocument | null> {
  const all = await loadIndex();
  return all.find(d => d.id === id) || null;
}

export async function saveDocument(doc: DriverDocument): Promise<void> {
  const all = await loadIndex();
  const idx = all.findIndex(d => d.id === doc.id);
  if (idx >= 0) all[idx] = doc;
  else all.push(doc);
  await saveIndex(all);
}

export async function deleteDocument(id: string): Promise<void> {
  let all = await loadIndex();
  const doc = all.find(d => d.id === id);
  if (!doc) return;

  if (doc.imageUri) {
    const info = await getInfoAsync(doc.imageUri);
    if (info.exists) await deleteAsync(doc.imageUri);
  }

  all = all.filter(d => d.id !== id);
  await saveIndex(all);

  deleteDocumentFromCloud(id).catch(() => {});
  if (doc.driverHash) deleteImageFromStorage(doc.driverHash, id).catch(() => {});
}

export async function saveImageLocally(imageUri: string, docId: string): Promise<string> {
  await ensureDir();
  const ext = imageUri.includes('.png') ? 'png' : 'jpg';
  const localPath = `${DOCS_DIR}${docId}.${ext}`;
  await copyAsync({ from: imageUri, to: localPath });
  return localPath;
}

// --- Cloud Sync ---

export async function syncToCloud(driverHash: string): Promise<{ synced: number; failed: number }> {
  const all = await loadIndex();
  let synced = 0;
  let failed = 0;

  for (const doc of all) {
    if (doc.syncedAt && doc.updatedAt <= doc.syncedAt) continue;

    try {
      if (doc.imageUri && !doc.cloudUri) {
        const imageInfo = await getInfoAsync(doc.imageUri);
        if (imageInfo.exists) {
          const base64 = await readAsStringAsync(doc.imageUri, { encoding: EncodingType.Base64 });
          const response = await fetch(`data:image/jpeg;base64,${base64}`);
          const blob = await response.blob();
          const cloudUrl = await uploadImageToStorage(driverHash, doc.id, blob);
          if (cloudUrl) doc.cloudUri = cloudUrl;
        }
      }

      const result = await uploadDocument({ ...doc, driverHash });
      if (result.success) {
        doc.syncedAt = new Date().toISOString();
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  if (synced > 0) await saveIndex(all);
  return { synced, failed };
}

// --- Expiration Helpers ---

export function getExpiringDocuments(docs: DriverDocument[], withinDays: number = 30): DriverDocument[] {
  const now = Date.now();
  const threshold = now + withinDays * 24 * 60 * 60 * 1000;
  return docs.filter(d => {
    if (!d.expirationDate) return false;
    const exp = new Date(d.expirationDate).getTime();
    return exp <= threshold && exp > 0;
  }).sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime());
}

export function isExpired(doc: DriverDocument): boolean {
  if (!doc.expirationDate) return false;
  return new Date(doc.expirationDate).getTime() < Date.now();
}

export function daysUntilExpiration(doc: DriverDocument): number | null {
  if (!doc.expirationDate) return null;
  const diff = new Date(doc.expirationDate).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
