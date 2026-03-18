import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../i18n';
import { colors } from '../constants/colors';

function AppContent() {
  const { isAuthenticated, session, logout, loginSSO } = useAuth();
  const initialURLProcessed = useRef(false);

  // Handle SSO deep links: wbewallet://login?hash={hash}&name={name}
  // Also handles logout: wbewallet://logout
  useEffect(() => {
    const handleSSODeepLink = async (url: string) => {
      const hashMatch = url.match(/[?&]hash=([^&]+)/);
      const nameMatch = url.match(/[?&]name=([^&]+)/);
      if (!hashMatch || !nameMatch) return;

      const incomingHash = decodeURIComponent(hashMatch[1]);
      const incomingName = decodeURIComponent(nameMatch[1]);
      console.log('[eWallet-SSO] Deep link received for:', incomingName);

      await loginSSO(incomingHash, incomingName);
    };

    const handleLogoutDeepLink = async () => {
      // Only auto-logout if this session was started via SSO from WB S.
      // Manual logins are driver-owned — WB S doesn't control them.
      const authMethod = await SecureStore.getItemAsync('wbew_authMethod');
      if (authMethod !== 'sso') {
        console.log('[eWallet-SSO] Ignoring logout deep link — session is manual, not SSO');
        return;
      }
      console.log('[eWallet-SSO] Received logout deep link — clearing SSO session');
      await logout();
    };

    const onDeepLink = (event: { url: string }) => {
      if (event.url?.includes('logout')) handleLogoutDeepLink();
      else if (event.url?.includes('login')) handleSSODeepLink(event.url);
    };

    const sub = Linking.addEventListener('url', onDeepLink);

    // Cold start: app opened via SSO link (getInitialURL)
    if (!initialURLProcessed.current) {
      initialURLProcessed.current = true;
      Linking.getInitialURL().then((url) => {
        if (url?.includes('logout')) handleLogoutDeepLink();
        else if (url?.includes('login')) handleSSODeepLink(url);
      });
    }

    return () => sub.remove();
  }, [loginSSO, logout]);

  // Check for RTDB logoutAt signal on app foreground (SSO sessions only)
  useEffect(() => {
    if (!isAuthenticated || !session) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !session.passcodeHash) return;
      try {
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
