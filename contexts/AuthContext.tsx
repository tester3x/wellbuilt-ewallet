import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  DriverSession, verifyLogin, saveDriverSession, getDriverSession,
  clearDriverSession, revalidateDriverSession, submitRegistration,
  checkRegistrationStatus, completeRegistration, getPendingRegistration,
} from '../services/driverAuth';

type AuthMode = 'checking' | 'login' | 'register' | 'verifying' | 'registering' | 'pending' | 'approved' | 'rejected' | 'error' | 'authenticated';

interface AuthContextValue {
  mode: AuthMode;
  session: DriverSession | null;
  isAuthenticated: boolean;
  error: string;
  login(displayName: string, passcode: string): Promise<boolean>;
  register(displayName: string, passcode: string, companyName?: string, legalName?: string): Promise<boolean>;
  completeReg(): Promise<boolean>;
  logout(): Promise<void>;
  switchToRegister(): void;
  switchToLogin(): void;
  tryAgain(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [session, setSession] = useState<DriverSession | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      const existing = await getDriverSession();
      if (existing) {
        const valid = await revalidateDriverSession();
        if (valid) { setSession(existing); setMode('authenticated'); return; }
      }
      // Check pending registration
      const pending = await getPendingRegistration();
      if (pending) { setMode('pending'); return; }
      setMode('login');
    })();
  }, []);

  // Poll for registration approval
  useEffect(() => {
    if (mode !== 'pending') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      const status = await checkRegistrationStatus();
      if (status === 'approved') setMode('approved');
      else if (status === 'rejected') setMode('rejected');
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mode]);

  const login = useCallback(async (displayName: string, passcode: string) => {
    setMode('verifying');
    setError('');
    const result = await verifyLogin(displayName, passcode);
    if (result.valid && result.driverId) {
      await saveDriverSession(
        result.driverId, result.displayName!, result.passcodeHash!,
        result.isAdmin, result.isViewer, result.companyId, result.companyName,
        result.legalName, 'manual'
      );
      const s = await getDriverSession();
      setSession(s);
      setMode('authenticated');
      return true;
    }
    setError(result.error || 'Login failed');
    setMode('error');
    return false;
  }, []);

  const register = useCallback(async (displayName: string, passcode: string, companyName?: string, legalName?: string) => {
    setMode('registering');
    setError('');
    const result = await submitRegistration({ passcode, displayName, companyName, legalName });
    if (result.success) { setMode('pending'); return true; }
    setError(result.error || 'Registration failed');
    setMode('error');
    return false;
  }, []);

  const completeReg = useCallback(async () => {
    const result = await completeRegistration();
    if (result.success) {
      const s = await getDriverSession();
      setSession(s);
      setMode('authenticated');
      return true;
    }
    setError(result.error || 'Failed to complete registration');
    return false;
  }, []);

  const logout = useCallback(async () => {
    await clearDriverSession();
    setSession(null);
    setMode('login');
  }, []);

  return (
    <AuthContext.Provider value={{
      mode, session, isAuthenticated: mode === 'authenticated', error,
      login, register, completeReg, logout,
      switchToRegister: () => { setMode('register'); setError(''); },
      switchToLogin: () => { setMode('login'); setError(''); },
      tryAgain: () => { setMode('login'); setError(''); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
