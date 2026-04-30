// services/driverAuth.ts
// Driver authentication for WB eWallet — same Firebase paths as WB S / WB M / WB T / WB JSA.
// All apps share the `wellbuilt-sync` Firebase project.

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const FIREBASE_DATABASE_URL = 'https://wellbuilt-sync-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyAGWXa-doFGzo7T5SxHVD_v5-SHXIc8wAI';
const DRIVERS_PENDING = 'drivers/pending';
const DRIVERS_APPROVED = 'drivers/approved';
const FIREBASE_TIMEOUT_MS = 10000;
const PREFIX = 'wbew_';

export interface DriverSession {
  driverId: string;
  displayName: string;
  legalName?: string;
  passcodeHash: string;
  isAdmin: boolean;
  isViewer: boolean;
  companyId?: string;
  companyName?: string;
}

// --- Firebase helpers ---

const buildFirebaseUrl = (path: string): string => {
  let url = `${FIREBASE_DATABASE_URL}/${path}.json`;
  if (FIREBASE_API_KEY) url += `?auth=${FIREBASE_API_KEY}`;
  return url;
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = FIREBASE_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error(`Firebase request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const firebaseGet = async (path: string): Promise<any> => {
  const url = buildFirebaseUrl(path);
  const response = await fetchWithTimeout(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Firebase GET failed (${response.status})`);
  return response.json();
};

const firebasePost = async (path: string, data: any): Promise<string> => {
  const url = buildFirebaseUrl(path);
  const response = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`Firebase POST failed (${response.status})`);
  const result = await response.json();
  return result.name;
};

const firebasePatch = async (path: string, data: any): Promise<void> => {
  const url = buildFirebaseUrl(path);
  const response = await fetchWithTimeout(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`Firebase PATCH failed (${response.status})`);
};

// --- Crypto ---

export const hashPasscode = async (passcode: string, name?: string): Promise<string> => {
  const input = name ? name.toLowerCase().trim() + passcode : passcode;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return hash.toLowerCase();
};

// --- Authentication ---

export const verifyLogin = async (displayName: string, passcode: string): Promise<{
  valid: boolean; driverId?: string; displayName?: string; passcodeHash?: string;
  isAdmin?: boolean; isViewer?: boolean; companyId?: string; companyName?: string;
  legalName?: string; error?: string;
}> => {
  try {
    const hash = await hashPasscode(passcode, displayName);
    const driverData = await firebaseGet(`${DRIVERS_APPROVED}/${hash}`);
    if (!driverData) return { valid: false, error: 'Invalid name or passcode' };

    // Flat structure
    if (driverData.displayName) {
      if (driverData.active === false) return { valid: false, error: 'This account has been deactivated' };
      if (driverData.displayName.toLowerCase() !== displayName.toLowerCase()) return { valid: false, error: 'Invalid name or passcode' };
      // Clear stale logoutAt
      firebasePatch(`${DRIVERS_APPROVED}/${hash}`, { logoutAt: null }).catch(() => {});
      return {
        valid: true, driverId: hash, displayName: driverData.displayName, passcodeHash: hash,
        isAdmin: driverData.isAdmin === true, isViewer: driverData.isViewer === true,
        companyId: driverData.companyId || undefined, companyName: driverData.companyName || undefined,
        legalName: driverData.legalName || undefined,
      };
    }

    // Legacy structure
    for (const key of Object.keys(driverData)) {
      const entry = driverData[key];
      if (entry.displayName?.toLowerCase() === displayName.toLowerCase() && entry.active !== false) {
        firebasePatch(`${DRIVERS_APPROVED}/${hash}`, { logoutAt: null }).catch(() => {});
        return {
          valid: true, driverId: hash, displayName: entry.displayName, passcodeHash: hash,
          isAdmin: entry.isAdmin === true, isViewer: entry.isViewer === true,
          companyId: entry.companyId || undefined, companyName: entry.companyName || undefined,
          legalName: entry.legalName || undefined,
        };
      }
    }
    return { valid: false, error: 'Invalid name or passcode' };
  } catch (error) {
    return { valid: false, error: 'Connection error' };
  }
};

// --- Session Management ---

export const saveDriverSession = async (
  driverId: string, displayName: string, passcodeHash: string,
  isAdmin = false, isViewer = false, companyId?: string, companyName?: string,
  legalName?: string, authMethod?: 'sso' | 'manual'
): Promise<void> => {
  await SecureStore.setItemAsync(`${PREFIX}driverId`, driverId);
  await SecureStore.setItemAsync(`${PREFIX}driverName`, displayName);
  await SecureStore.setItemAsync(`${PREFIX}passcodeHash`, passcodeHash);
  await SecureStore.setItemAsync(`${PREFIX}isAdmin`, isAdmin ? 'true' : 'false');
  await SecureStore.setItemAsync(`${PREFIX}isViewer`, isViewer ? 'true' : 'false');
  await SecureStore.setItemAsync(`${PREFIX}driverVerifiedAt`, Date.now().toString());
  if (companyId) await SecureStore.setItemAsync(`${PREFIX}companyId`, companyId);
  else await SecureStore.deleteItemAsync(`${PREFIX}companyId`);
  if (companyName) await SecureStore.setItemAsync(`${PREFIX}companyName`, companyName);
  else await SecureStore.deleteItemAsync(`${PREFIX}companyName`);
  if (legalName) await SecureStore.setItemAsync(`${PREFIX}legalName`, legalName);
  else await SecureStore.deleteItemAsync(`${PREFIX}legalName`);
  if (authMethod) await SecureStore.setItemAsync(`${PREFIX}authMethod`, authMethod);

  // Cascade-logout baseline (post-2026-04-30 redesign — see WB T's
  // driverProfile.ts for the canonical write-up). Snapshot the current
  // RTDB logoutAt for this hash so the foreground listener in
  // _layout.tsx can fire on any STRICTLY NEWER logoutAt going forward.
  // Falls back to NOW if the seed fetch fails (offline) — stale signals
  // older than NOW won't fire (treated as already-consumed by a prior
  // session); newer signals from this point forward will fire normally.
  try {
    let baseline: string;
    try {
      const data = await firebaseGet(`${DRIVERS_APPROVED}/${passcodeHash}/logoutAt`);
      baseline = (typeof data === 'string' && data.length > 0) ? data : new Date().toISOString();
    } catch {
      baseline = new Date().toISOString();
    }
    await SecureStore.setItemAsync(`${PREFIX}lastConsumedLogoutAt`, baseline);
  } catch {
    // Best-effort; if SecureStore write fails the listener's no-baseline
    // fallback compares against NOW on first foreground.
  }

  await clearPendingRegistration();
};

export const getDriverSession = async (): Promise<DriverSession | null> => {
  const driverId = await SecureStore.getItemAsync(`${PREFIX}driverId`);
  const displayName = await SecureStore.getItemAsync(`${PREFIX}driverName`);
  const passcodeHash = await SecureStore.getItemAsync(`${PREFIX}passcodeHash`);
  const isAdminStr = await SecureStore.getItemAsync(`${PREFIX}isAdmin`);
  const isViewerStr = await SecureStore.getItemAsync(`${PREFIX}isViewer`);
  const companyId = await SecureStore.getItemAsync(`${PREFIX}companyId`);
  const companyName = await SecureStore.getItemAsync(`${PREFIX}companyName`);
  const legalName = await SecureStore.getItemAsync(`${PREFIX}legalName`);
  if (driverId && displayName && passcodeHash) {
    return {
      driverId, displayName, legalName: legalName || undefined, passcodeHash,
      isAdmin: isAdminStr === 'true', isViewer: isViewerStr === 'true',
      companyId: companyId || undefined, companyName: companyName || undefined,
    };
  }
  return null;
};

export const clearDriverSession = async (): Promise<void> => {
  const keys = ['driverId', 'driverName', 'passcodeHash', 'isAdmin', 'isViewer',
    'driverVerifiedAt', 'companyId', 'companyName', 'legalName', 'authMethod',
    // Cascade-logout baseline — clear so next login seeds fresh from RTDB
    'lastConsumedLogoutAt'];
  for (const k of keys) await SecureStore.deleteItemAsync(`${PREFIX}${k}`);
  await clearPendingRegistration();
};

export const revalidateDriverSession = async (): Promise<boolean> => {
  const session = await getDriverSession();
  if (!session) return false;
  try {
    const driverData = await firebaseGet(`${DRIVERS_APPROVED}/${session.passcodeHash}`);
    if (!driverData) { await clearDriverSession(); return false; }
    if (driverData.displayName) return driverData.active !== false;
    for (const key of Object.keys(driverData)) {
      const entry = driverData[key];
      if (entry.displayName?.toLowerCase() === session.displayName.toLowerCase()) return entry.active !== false;
    }
    await clearDriverSession();
    return false;
  } catch { return true; } // Don't clear on network error — allow offline
};

// --- Registration ---

export const submitRegistration = async (params: {
  passcode: string; displayName: string; companyName?: string; legalName?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const hash = await hashPasscode(params.passcode, params.displayName);
    const data: Record<string, string> = {
      displayName: params.displayName, passcodeHash: hash,
      requestedAt: new Date().toISOString(), source: 'wbew',
    };
    if (params.companyName) data.companyName = params.companyName;
    if (params.legalName) data.legalName = params.legalName;
    await firebasePost(DRIVERS_PENDING, data);
    await SecureStore.setItemAsync(`${PREFIX}pendingHash`, hash);
    await SecureStore.setItemAsync(`${PREFIX}pendingName`, params.displayName);
    await SecureStore.setItemAsync(`${PREFIX}pendingTime`, Date.now().toString());
    if (params.companyName) await SecureStore.setItemAsync(`${PREFIX}pendingCompany`, params.companyName);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Connection error' };
  }
};

export const getPendingRegistration = async () => {
  const passcodeHash = await SecureStore.getItemAsync(`${PREFIX}pendingHash`);
  const displayName = await SecureStore.getItemAsync(`${PREFIX}pendingName`);
  const companyName = await SecureStore.getItemAsync(`${PREFIX}pendingCompany`);
  if (passcodeHash && displayName) return { passcodeHash, displayName, companyName: companyName || undefined };
  return null;
};

export const checkRegistrationStatus = async (): Promise<'pending' | 'approved' | 'rejected' | 'none'> => {
  const pending = await getPendingRegistration();
  if (!pending) return 'none';
  try {
    const driver = await firebaseGet(`${DRIVERS_APPROVED}/${pending.passcodeHash}`);
    if (driver) return 'approved';
    const pendingDrivers = await firebaseGet(DRIVERS_PENDING);
    if (pendingDrivers) {
      for (const key of Object.keys(pendingDrivers)) {
        if (pendingDrivers[key].passcodeHash === pending.passcodeHash) return 'pending';
      }
    }
    return 'rejected';
  } catch { return 'pending'; }
};

export const completeRegistration = async (): Promise<{ success: boolean; error?: string }> => {
  const pending = await getPendingRegistration();
  if (!pending) return { success: false, error: 'No pending registration' };
  try {
    const driverData = await firebaseGet(`${DRIVERS_APPROVED}/${pending.passcodeHash}`);
    if (!driverData) return { success: false, error: 'Driver not found in approved list' };
    const displayName = driverData.displayName || pending.displayName;
    await saveDriverSession(pending.passcodeHash, displayName, pending.passcodeHash,
      driverData.isAdmin === true, driverData.isViewer === true,
      driverData.companyId, driverData.companyName, driverData.legalName, 'manual');
    return { success: true };
  } catch { return { success: false, error: 'Connection error' }; }
};

export const clearPendingRegistration = async (): Promise<void> => {
  for (const k of ['pendingHash', 'pendingName', 'pendingTime', 'pendingCompany']) {
    await SecureStore.deleteItemAsync(`${PREFIX}${k}`);
  }
};
