import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useTranslation } from '../i18n';
import { colors, spacing, radius } from '../constants/colors';
import { setCapturedImageUri } from '../services/capturedImage';

// Output image size
const OUTPUT_W = 1200;

export default function CameraScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission?.granted) {
      launchScanner();
    }
  }, [permission?.granted]);

  const launchScanner = async () => {
    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 90,
        maxNumDocuments: 1,
        letUserAdjustCrop: true,
      });

      if (result?.scannedImages?.length > 0) {
        // Resize to standard output width, preserve aspect ratio
        const resized = await manipulateAsync(
          result.scannedImages[0],
          [{ resize: { width: OUTPUT_W } }],
          { compress: 0.8, format: SaveFormat.JPEG },
        );
        setCapturedImageUri(resized.uri);
      }
      router.back();
    } catch (err: any) {
      // User cancelled or scanner failed
      if (err?.message?.includes('cancel') || err?.message?.includes('Cancel')) {
        router.back();
        return;
      }
      console.error('[Camera] scanner error:', err);
      Alert.alert('Error', 'Document scanner failed. Please try again.');
      router.back();
    }
  };

  if (!permission) return <View style={s.container} />;

  if (!permission.granted) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.permissionView}>
          <MaterialCommunityIcons name="camera-off" size={64} color={colors.text.muted} />
          <Text style={s.permText}>{t('camera.permissionMsg')}</Text>
          <Pressable onPress={requestPermission} style={s.permBtn}>
            <Text style={s.permBtnText}>{t('camera.grantBtn')}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={s.cancelBtn}>
            <Text style={s.cancelText}>{t('camera.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Scanner launches via useEffect when permission granted.
  // Show a black screen while it opens (native scanner takes over).
  return <View style={s.container} />;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  permText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', marginTop: spacing.lg },
  permBtn: { backgroundColor: colors.brand.wallet, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: spacing.md },
  cancelText: { color: colors.text.muted, fontSize: 14 },
});
