// services/documentStore.ts
// Local-first document storage using expo-file-system legacy API.
// Documents are stored locally and synced to Firebase in the background.

import {
  documentDirectory, getInfoAsync, makeDirectoryAsync, readAsStringAsync,
  writeAsStringAsync, deleteAsync, copyAsync, EncodingType,
} from 'expo-file-system/legacy';
import { DriverDocument, DocumentType, uploadDocument, fetchDriverDocuments, deleteDocumentFromCloud, uploadImageToStorage, deleteImageFromStorage } from './firebase';

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

  // Background cloud upload — fire and forget
  if (doc.driverHash) {
    uploadToCloudBackground(doc).catch(() => {});
  }
}

async function uploadToCloudBackground(doc: DriverDocument): Promise<void> {
  try {
    // Upload image first if not already in cloud
    if (doc.imageUri && !doc.cloudUri) {
      const imageInfo = await getInfoAsync(doc.imageUri);
      if (imageInfo.exists) {
        const base64 = await readAsStringAsync(doc.imageUri, { encoding: EncodingType.Base64 });
        const response = await fetch(`data:image/jpeg;base64,${base64}`);
        const blob = await response.blob();
        const cloudUrl = await uploadImageToStorage(doc.driverHash, doc.id, blob);
        if (cloudUrl) doc.cloudUri = cloudUrl;
      }
    }
    // Upload metadata to Firestore
    const result = await uploadDocument({ ...doc, driverHash: doc.driverHash });
    if (result.success) {
      doc.syncedAt = new Date().toISOString();
      // Update local index with syncedAt + cloudUri
      const all = await loadIndex();
      const idx = all.findIndex(d => d.id === doc.id);
      if (idx >= 0) { all[idx] = doc; await saveIndex(all); }
      console.log(`[eWallet] Doc ${doc.id} synced to cloud`);
    }
  } catch (err) {
    console.warn('[eWallet] Background cloud upload failed (will retry later):', err);
  }
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

// --- Sync FROM Cloud (login) ---

export async function syncFromCloud(driverHash: string): Promise<{ downloaded: number; errors: number }> {
  const cloudDocs = await fetchDriverDocuments(driverHash);
  if (cloudDocs.length === 0) return { downloaded: 0, errors: 0 };

  await ensureDir();
  const localDocs = await loadIndex();
  let downloaded = 0;
  let errors = 0;

  for (const cloudDoc of cloudDocs) {
    // Skip if local version is same or newer
    const localDoc = localDocs.find(d => d.id === cloudDoc.id);
    if (localDoc?.syncedAt && cloudDoc.syncedAt && localDoc.syncedAt >= cloudDoc.syncedAt) continue;

    try {
      // Download image if we have a cloud URL
      let localImageUri = localDoc?.imageUri || '';
      if (cloudDoc.cloudUri) {
        const ext = 'jpg';
        const localPath = `${DOCS_DIR}${cloudDoc.id}.${ext}`;
        const info = await getInfoAsync(localPath);
        if (!info.exists) {
          // Download image from Firebase Storage
          const { downloadAsync } = await import('expo-file-system/legacy');
          const result = await downloadAsync(cloudDoc.cloudUri, localPath);
          localImageUri = result.uri;
        } else {
          localImageUri = localPath;
        }
      }

      // Merge cloud doc with local image path
      const merged: DriverDocument = {
        ...cloudDoc,
        imageUri: localImageUri || cloudDoc.imageUri,
      };

      // Update local index
      const idx = localDocs.findIndex(d => d.id === cloudDoc.id);
      if (idx >= 0) localDocs[idx] = merged;
      else localDocs.push(merged);
      downloaded++;
    } catch (err) {
      console.error(`[eWallet] Failed to sync doc ${cloudDoc.id}:`, err);
      errors++;
    }
  }

  if (downloaded > 0) await saveIndex(localDocs);
  return { downloaded, errors };
}

// --- Clear Local Documents (SSO logout) ---

export async function clearLocalDocuments(): Promise<void> {
  try {
    const info = await getInfoAsync(DOCS_DIR);
    if (info.exists) await deleteAsync(DOCS_DIR, { idempotent: true });
  } catch (err) {
    console.error('[eWallet] Error clearing local documents:', err);
  }
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
