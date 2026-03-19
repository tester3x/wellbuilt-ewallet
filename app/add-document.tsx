import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { colors, spacing, radius, typography } from '../constants/colors';
import { DocumentType, DOC_TYPE_LABELS, DOC_TYPE_ICONS } from '../services/firebase';
import { saveDocument, saveImageLocally } from '../services/documentStore';
import { getCapturedImageUri } from '../services/capturedImage';

const DOC_TYPES: DocumentType[] = [
  'cdl', 'medical_card', 'insurance', 'registration',
  'dot_inspection', 'hazmat_cert', 'twic_card', 'ifta_permit',
  'drug_test', 'training_cert', 'other',
];

export default function AddDocumentScreen() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [label, setLabel] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pick up image from custom camera screen when returning
  useFocusEffect(
    useCallback(() => {
      const uri = getCapturedImageUri();
      if (uri) setImageUri(uri);
    }, [])
  );

  const handleCamera = () => {
    router.push('/camera');
  };

  const handleGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('addDoc.galleryPermTitle'), t('addDoc.galleryPermMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      // Resize gallery picks to same document size as camera
      const resized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      setImageUri(resized.uri);
    }
  };

  const handleSave = async () => {
    if (!selectedType) { Alert.alert(t('addDoc.selectTypeAlert'), t('addDoc.selectTypeMsg')); return; }
    if (!imageUri) { Alert.alert(t('addDoc.addPhotoAlert'), t('addDoc.addPhotoMsg')); return; }
    if (!session) return;

    setSaving(true);
    try {
      const docId = `${session.passcodeHash.slice(0, 8)}_${selectedType}_${Date.now()}`;
      const localUri = await saveImageLocally(imageUri, docId);

      // Parse dates (accept MM/DD/YYYY or YYYY-MM-DD)
      const parseDate = (d: string): string | undefined => {
        if (!d.trim()) return undefined;
        // MM/DD/YYYY
        const parts = d.split('/');
        if (parts.length === 3) {
          const [m, day, y] = parts;
          return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return d; // assume ISO
      };

      await saveDocument({
        id: docId,
        driverHash: session.passcodeHash,
        companyId: session.companyId,
        type: selectedType,
        label: label.trim() || DOC_TYPE_LABELS[selectedType],
        imageUri: localUri,
        expirationDate: parseDate(expirationDate),
        issuedDate: parseDate(issuedDate),
        documentNumber: documentNumber.trim() || undefined,
        state: state.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      router.back();
    } catch (error) {
      Alert.alert(t('addDoc.errorTitle'), t('addDoc.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  // Step 1: Type selection
  if (!selectedType) {
    return (
      <View style={[s.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <ScrollView contentContainerStyle={s.typeGrid}>
          <Text style={s.stepTitle}>{t('addDoc.typeTitle')}</Text>
          {DOC_TYPES.map(type => {
            const key = `docTypes.${type}`;
            const label = t(key) !== key ? t(key) : DOC_TYPE_LABELS[type];
            return (
            <Pressable key={type} onPress={() => { setSelectedType(type); setLabel(label); }} style={s.typeCard}>
              <MaterialCommunityIcons name={DOC_TYPE_ICONS[type] as any} size={28} color={colors.brand.wallet} />
              <Text style={s.typeLabel}>{label}</Text>
            </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Step 2: Photo + details
  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
        {/* Photo Section */}
        <Text style={s.stepTitle}>{t('addDoc.photoTitle')}</Text>
        <View style={s.photoRow}>
          <Pressable onPress={handleCamera} style={s.photoBtn}>
            <MaterialCommunityIcons name="camera" size={32} color={colors.brand.wallet} />
            <Text style={s.photoBtnText}>{t('addDoc.camera')}</Text>
          </Pressable>
          <Pressable onPress={handleGallery} style={s.photoBtn}>
            <MaterialCommunityIcons name="image" size={32} color={colors.brand.primary} />
            <Text style={s.photoBtnText}>{t('addDoc.gallery')}</Text>
          </Pressable>
        </View>
        {imageUri && (
          <View style={s.photoPreviewWrap}>
            <Image source={{ uri: imageUri }} style={s.photoThumb} resizeMode="cover" />
            <View style={s.photoPreview}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.status.valid} />
              <Text style={s.photoPreviewText}>{t('addDoc.photoCaptured')}</Text>
              <Pressable onPress={() => setImageUri(null)}>
                <MaterialCommunityIcons name="close-circle" size={20} color={colors.text.muted} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Details */}
        <Text style={[s.stepTitle, { marginTop: spacing.xl }]}>{t('addDoc.detailsTitle')}</Text>

        <Text style={s.fieldLabel}>{t('addDoc.label')}</Text>
        <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder={DOC_TYPE_LABELS[selectedType]} placeholderTextColor={colors.text.muted} />

        <Text style={s.fieldLabel}>{t('addDoc.docNumber')}</Text>
        <TextInput style={s.input} value={documentNumber} onChangeText={setDocumentNumber} placeholder={t('addDoc.docNumberPlaceholder')} placeholderTextColor={colors.text.muted} />

        <Text style={s.fieldLabel}>{t('addDoc.expDate')}</Text>
        <TextInput style={s.input} value={expirationDate} onChangeText={setExpirationDate} placeholder="03/15/2027" placeholderTextColor={colors.text.muted} keyboardType="default" />

        <Text style={s.fieldLabel}>{t('addDoc.issuedDate')}</Text>
        <TextInput style={s.input} value={issuedDate} onChangeText={setIssuedDate} placeholder="03/15/2025" placeholderTextColor={colors.text.muted} keyboardType="default" />

        <Text style={s.fieldLabel}>{t('addDoc.issuingState')}</Text>
        <TextInput style={s.input} value={state} onChangeText={setState} placeholder="ND" placeholderTextColor={colors.text.muted} autoCapitalize="characters" />

        <Text style={s.fieldLabel}>{t('addDoc.notes')}</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder={t('addDoc.notesPlaceholder')} placeholderTextColor={colors.text.muted} multiline />

        {/* Save Button */}
        <Pressable onPress={handleSave} style={[s.saveBtn, saving && { opacity: 0.5 }]} disabled={saving}>
          <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
          <Text style={s.saveBtnText}>{saving ? t('addDoc.saving') : t('addDoc.saveBtn')}</Text>
        </Pressable>

        <Pressable onPress={() => setSelectedType(null)} style={s.backLink}>
          <Text style={s.backLinkText}>{t('addDoc.changeType')}</Text>
        </Pressable>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  typeGrid: { padding: spacing.lg },
  stepTitle: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.lg },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  typeLabel: { ...typography.body, fontWeight: '600' },
  formContent: { padding: spacing.lg },
  photoRow: { flexDirection: 'row', gap: spacing.md },
  photoBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl, borderRadius: radius.lg,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.accent,
  },
  photoBtnText: { ...typography.bodySmall, color: colors.text.secondary },
  photoPreviewWrap: { marginTop: spacing.md },
  photoThumb: {
    width: '100%', height: 160, borderRadius: radius.md,
    backgroundColor: colors.bg.card,
  },
  photoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: `${colors.status.valid}10`,
  },
  photoPreviewText: { ...typography.bodySmall, color: colors.status.valid, flex: 1 },
  fieldLabel: { ...typography.caption, color: colors.text.muted, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.md,
    color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.border.subtle,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.brand.wallet, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.xl,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: { alignItems: 'center', marginTop: spacing.md },
  backLinkText: { color: colors.text.muted, fontSize: 14 },
});
