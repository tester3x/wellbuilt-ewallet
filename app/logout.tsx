// app/logout.tsx
// Route handler for wbewallet://logout deep link.
// Expo Router resolves the URL to this route after the deep link event handler
// in _layout.tsx has already processed the logout. This screen just redirects
// to avoid the "Unmatched Route" error.

import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function LogoutRoute() {
  useEffect(() => {
    // Deep link handler in _layout.tsx already processed the logout.
    // Just redirect to login so we don't show a blank screen.
    router.replace('/login');
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
