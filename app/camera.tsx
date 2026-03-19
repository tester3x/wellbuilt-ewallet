import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useTranslation } from '../i18n';
import { colors, spacing, radius } from '../constants/colors';
import { setCapturedImageUri } from '../services/capturedImage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Guide frame = 90% of screen width, 4:3 aspect ratio
const GUIDE_W_RATIO = 0.90;
const GUIDE_ASPECT = 4 / 3; // width / height → landscape document
const GUIDE_W = SCREEN_W * GUIDE_W_RATIO;
const GUIDE_H = GUIDE_W / GUIDE_ASPECT;

// Output image size
const OUTPUT_W = 1200;
const OUTPUT_H = 900; // 4:3

export default function CameraScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) { setCapturing(false); return; }

      const photoW = photo.width;
      const photoH = photo.height;

      // Calculate the crop rectangle that matches the guide overlay position
      // The guide is centered horizontally (90% width) and centered vertically in the camera area
      // Camera preview fills the screen, photo maps to it

      // Crop dimensions matching guide proportions
      const cropW = photoW * GUIDE_W_RATIO;
      const cropH = cropW / GUIDE_ASPECT;

      // Center the crop
      const originX = (photoW - cropW) / 2;
      const originY = (photoH - cropH) / 2;

      // Crop to guide area, then resize to output dimensions
      const result = await manipulateAsync(
        photo.uri,
        [
          {
            crop: {
              originX: Math.max(0, Math.round(originX)),
              originY: Math.max(0, Math.round(originY)),
              width: Math.round(Math.min(cropW, photoW)),
              height: Math.round(Math.min(cropH, photoH)),
            },
          },
          { resize: { width: OUTPUT_W, height: OUTPUT_H } },
        ],
        { compress: 0.8, format: SaveFormat.JPEG },
      );

      setCapturedImageUri(result.uri);
      router.back();
    } catch (err) {
      console.error('[Camera] capture error:', err);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setCapturing(false);
    }
  }, [capturing]);

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

  return (
    <View style={s.container}>
      <CameraView ref={cameraRef} style={s.camera} facing={facing}>
        {/* Dark overlay with transparent cutout for guide frame */}
        <View style={s.overlay}>
          {/* Top dark band */}
          <View style={[s.darkBand, { paddingTop: insets.top }]}>
            <View style={s.topBar}>
              <Pressable onPress={() => router.back()} style={s.closeBtn}>
                <MaterialCommunityIcons name="close" size={28} color="#fff" />
              </Pressable>
              <Text style={s.topTitle}>{t('camera.title')}</Text>
              <Pressable onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.flipBtn}>
                <MaterialCommunityIcons name="camera-flip" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Middle row: dark sides + transparent center */}
          <View style={s.middleRow}>
            <View style={s.darkSide} />
            <View style={s.guideCutout}>
              {/* Corner brackets */}
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
              {/* Hint text */}
              <Text style={s.guideHint}>Fit document inside frame</Text>
            </View>
            <View style={s.darkSide} />
          </View>

          {/* Bottom dark band */}
          <View style={[s.darkBand, { paddingBottom: insets.bottom }]}>
            <View style={s.bottomBar}>
              {capturing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Pressable onPress={handleCapture} style={s.captureBtn}>
                  <View style={s.captureBtnInner} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const SIDE_W = (SCREEN_W - GUIDE_W) / 2;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  darkBand: { backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' },
  middleRow: { flexDirection: 'row', height: GUIDE_H },
  darkSide: { width: SIDE_W, backgroundColor: 'rgba(0,0,0,0.55)' },
  guideCutout: {
    width: GUIDE_W, height: GUIDE_H,
    // Transparent — shows camera preview through
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4 },
  guideHint: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  closeBtn: { padding: spacing.sm },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  flipBtn: { padding: spacing.sm },
  bottomBar: { alignItems: 'center', paddingVertical: spacing.xl },
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
