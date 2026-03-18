import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n';
import { colors, spacing, radius } from '../constants/colors';

export default function CameraScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return null;

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

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        // Pass the URI back — the add-document screen will pick it up
        router.back();
        // In a full implementation, we'd use a shared state or params
      }
    } catch {
      Alert.alert(t('viewDoc.errorTitle'), t('viewDoc.errorCapture'));
    }
  };

  return (
    <View style={s.container}>
      <CameraView ref={cameraRef} style={s.camera} facing={facing}>
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={s.topTitle}>{t('camera.title')}</Text>
          <Pressable onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.flipBtn}>
            <MaterialCommunityIcons name="camera-flip" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Guide overlay */}
        <View style={s.guide}>
          <View style={s.guideCorner} />
        </View>

        {/* Bottom bar */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable onPress={handleCapture} style={s.captureBtn}>
            <View style={s.captureBtnInner} />
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: { padding: spacing.sm },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  flipBtn: { padding: spacing.sm },
  guide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guideCorner: {
    width: '85%', height: '60%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.lg,
  },
  bottomBar: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingTop: spacing.lg },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff',
  },
  permissionView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  permText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', marginTop: spacing.lg },
  permBtn: { backgroundColor: colors.brand.wallet, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: spacing.md },
  cancelText: { color: colors.text.muted, fontSize: 14 },
});
