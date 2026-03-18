import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, Linking } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../i18n';
import { colors } from '../constants/colors';

function AppContent() {
  const { isAuthenticated, session, logout } = useAuth();

  // Handle SSO deep links: wbewallet://login?hash={hash}&name={name}
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      if (!url?.includes('login?')) return;
      const params = new URLSearchParams(url.split('?')[1]);
      const hash = params.get('hash');
      const name = params.get('name');
      if (hash && name) {
        // SSO login handled by AuthContext
        console.log('[eWallet] SSO deep link received for:', name);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  // Check for RTDB logoutAt signal on app foreground (SSO sessions only)
  useEffect(() => {
    if (!isAuthenticated || !session) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !session.passcodeHash) return;
      try {
        const { default: SecureStore } = await import('expo-secure-store');
        const authMethod = await SecureStore.getItemAsync('wbew_authMethod');
        if (authMethod !== 'sso') return;
        const { firebaseGet } = await import('../services/driverAuth');
        const data = await firebaseGet(`drivers/approved/${session.passcodeHash}/logoutAt`);
        if (data) {
          const verifiedAt = await SecureStore.getItemAsync('wbew_driverVerifiedAt');
          if (verifiedAt && new Date(data).getTime() > parseInt(verifiedAt)) {
            await logout();
          }
        }
      } catch {}
    });
    return () => sub.remove();
  }, [isAuthenticated, session, logout]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: 'none',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="add-document" options={{ headerShown: true, headerStyle: { backgroundColor: colors.bg.secondary }, headerTintColor: colors.text.primary, title: 'Add Document' }} />
        <Stack.Screen name="view-document" options={{ headerShown: true, headerStyle: { backgroundColor: colors.bg.secondary }, headerTintColor: colors.text.primary, title: 'Document' }} />
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Hide Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      import('expo-navigation-bar').then(mod => {
        mod.setVisibilityAsync('hidden');
        mod.setBehaviorAsync('overlay-swipe');
      }).catch(() => {});
    }
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}
