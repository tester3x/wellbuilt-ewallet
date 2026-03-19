import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, Dimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n';
import { colors, spacing, radius, typography } from '../constants/colors';
import { getDocument, deleteDocument, isExpired, daysUntilExpiration } from '../services/documentStore';
import { DriverDocument, DOC_TYPE_LABELS, DOC_TYPE_ICONS, DocumentType } from '../services/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ViewDocumentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<DriverDocument | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    if (id) getDocument(id).then(setDoc);
  }, [id]);

  if (!doc) {
    return (
      <View style={[s.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <Text style={s.loading}>{t('viewDoc.loading')}</Text>
      </View>
    );
  }

  const expired = isExpired(doc);
  const days = daysUntilExpiration(doc);
  const statusColor = expired ? colors.status.expired : (days !== null && days <= 30) ? colors.status.expiring : colors.status.valid;
  const statusLabel = expired ? t('viewDoc.expired') : days !== null && days <= 0 ? t('viewDoc.expired') : days !== null && days <= 30 ? t('viewDoc.expiresIn', { days }) : days !== null ? t('viewDoc.validDays', { days }) : t('viewDoc.noExpiration');

  const handleDelete = () => {
    Alert.alert(t('viewDoc.deleteTitle'), t('viewDoc.deleteMsg'), [
      { text: t('viewDoc.cancel'), style: 'cancel' },
      {
        text: t('viewDoc.delete'), style: 'destructive',
        onPress: async () => { await deleteDocument(doc.id); router.back(); },
      },
    ]);
  };

  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Document Image */}
        {doc.imageUri && (
          <Pressable onPress={() => setImageExpanded(!imageExpanded)}>
            <Image
              source={{ uri: doc.imageUri }}
              style={imageExpanded ? s.imageExpanded : s.imageCompact}
              resizeMode={imageExpanded ? 'contain' : 'cover'}
            />
            <View style={s.expandHint}>
              <MaterialCommunityIcons name={imageExpanded ? 'arrow-collapse' : 'arrow-expand'} size={16} color="#fff" />
              <Text style={s.expandText}>{imageExpanded ? t('viewDoc.tapShrink') : t('viewDoc.tapExpand')}</Text>
            </View>
          </Pressable>
        )}

        {/* Status Banner */}
        <View style={[s.statusBanner, { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}30` }]}>
          <MaterialCommunityIcons
            name={expired ? 'alert-circle' : days !== null && days <= 30 ? 'clock-alert-outline' : 'check-circle'}
            size={22}
            color={statusColor}
          />
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Document Details */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <MaterialCommunityIcons name={DOC_TYPE_ICONS[doc.type] as any} size={24} color={colors.brand.wallet} />
            <Text style={s.cardTitle}>{doc.label || DOC_TYPE_LABELS[doc.type]}</Text>
          </View>

          {doc.documentNumber && (
            <DetailRow label={t('viewDoc.docNumber')} value={doc.documentNumber} />
          )}
          {doc.state && (
            <DetailRow label={t('viewDoc.issuingState')} value={doc.state} />
          )}
          {doc.issuedDate && (
            <DetailRow label={t('viewDoc.issuedDate')} value={new Date(doc.issuedDate).toLocaleDateString()} />
          )}
          {doc.expirationDate && (
            <DetailRow label={t('viewDoc.expDate')} value={new Date(doc.expirationDate).toLocaleDateString()} />
          )}
          {doc.notes && (
            <DetailRow label={t('viewDoc.notes')} value={doc.notes} />
          )}

          <View style={s.metaRow}>
            <Text style={s.metaText}>{t('viewDoc.added', { date: new Date(doc.createdAt).toLocaleDateString() })}</Text>
            {doc.syncedAt && (
              <View style={s.syncBadge}>
                <MaterialCommunityIcons name="cloud-check" size={12} color={colors.status.valid} />
                <Text style={[s.metaText, { color: colors.status.valid }]}>{t('viewDoc.backedUp')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <Pressable onPress={handleDelete} style={s.deleteBtn}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={colors.status.expired} />
            <Text style={s.deleteBtnText}>{t('viewDoc.deleteBtn')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  loading: { ...typography.body, color: colors.text.muted, textAlign: 'center', marginTop: 100 },
  content: { paddingBottom: spacing.xxl },
  imageCompact: { width: SCREEN_WIDTH, height: 220, borderRadius: 0 },
  imageExpanded: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75, borderRadius: 0 },
  expandHint: {
    position: 'absolute', bottom: spacing.sm, right: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm,
  },
  expandText: { color: '#fff', fontSize: 11 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1,
  },
  statusText: { fontSize: 14, fontWeight: '600' },
  card: {
    margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { ...typography.h3 },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  detailLabel: { ...typography.caption, color: colors.text.muted, fontWeight: '700', marginBottom: 2 },
  detailValue: { ...typography.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm },
  metaText: { ...typography.caption, color: colors.text.muted },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { paddingHorizontal: spacing.lg },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: `${colors.status.expired}30`,
  },
  deleteBtnText: { color: colors.status.expired, fontWeight: '600' },
});
