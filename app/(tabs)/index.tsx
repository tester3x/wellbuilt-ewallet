import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n';
import { colors, spacing, radius, typography } from '../../constants/colors';
import { getAllDocuments, getExpiringDocuments, isExpired, daysUntilExpiration } from '../../services/documentStore';
import { DriverDocument, DOC_TYPE_LABELS, DOC_TYPE_ICONS, DocumentType } from '../../services/firebase';

export default function WalletScreen() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocuments = useCallback(async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  }, []);

  useFocusEffect(useCallback(() => { loadDocuments(); }, [loadDocuments]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const expiring = getExpiringDocuments(documents, 30);
  const docsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, DriverDocument[]>);

  const getStatusColor = (doc: DriverDocument) => {
    if (isExpired(doc)) return colors.status.expired;
    const days = daysUntilExpiration(doc);
    if (days !== null && days <= 30) return colors.status.expiring;
    return colors.status.valid;
  };

  const getStatusLabel = (doc: DriverDocument) => {
    if (isExpired(doc)) return t('wallet.statusExpired');
    const days = daysUntilExpiration(doc);
    if (days !== null && days <= 0) return t('wallet.statusExpired');
    if (days !== null && days <= 30) return t('wallet.statusDaysLeft', { days });
    if (days !== null) return t('wallet.statusValid');
    return '';
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('wallet.title')}</Text>
          <Text style={s.headerSub}>{session?.displayName} — {documents.length} {documents.length !== 1 ? t('wallet.documentPlural') : t('wallet.documents')}</Text>
        </View>
        <Pressable onPress={() => router.push('/add-document')} style={s.addBtn}>
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.wallet} />}
      >
        {/* Expiration Alerts Banner */}
        {expiring.length > 0 && (
          <Pressable onPress={() => router.push('/(tabs)/alerts')} style={s.alertBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={colors.status.expiring} />
            <Text style={s.alertText}>
              {t('wallet.expiringBanner', { count: expiring.length, s: expiring.length !== 1 ? 's' : '' })}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.muted} />
          </Pressable>
        )}

        {/* Empty State */}
        {documents.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="wallet-outline" size={80} color={colors.text.muted} style={{ opacity: 0.3 }} />
            <Text style={s.emptyTitle}>{t('wallet.emptyTitle')}</Text>
            <Text style={s.emptyText}>{t('wallet.emptySub')}</Text>
            <Pressable onPress={() => router.push('/add-document')} style={s.emptyBtn}>
              <MaterialCommunityIcons name="camera-plus" size={20} color="#fff" />
              <Text style={s.emptyBtnText}>{t('wallet.emptyBtn')}</Text>
            </Pressable>
          </View>
        )}

        {/* Document Cards by Type */}
        {Object.entries(docsByType).map(([type, docs]) => (
          <View key={type} style={s.section}>
            <View style={s.sectionHeader}>
              <MaterialCommunityIcons
                name={DOC_TYPE_ICONS[type as DocumentType] as any}
                size={18}
                color={colors.brand.wallet}
              />
              <Text style={s.sectionTitle}>{DOC_TYPE_LABELS[type as DocumentType]}</Text>
              <Text style={s.sectionCount}>{docs.length}</Text>
            </View>

            {docs.map(doc => {
              const statusColor = getStatusColor(doc);
              const statusLabel = getStatusLabel(doc);
              return (
                <Pressable
                  key={doc.id}
                  onPress={() => router.push(`/view-document?id=${doc.id}`)}
                  style={s.docCard}
                >
                  {/* Thumbnail */}
                  <View style={s.docThumb}>
                    {doc.imageUri ? (
                      <Image source={{ uri: doc.imageUri }} style={s.docImage} />
                    ) : (
                      <MaterialCommunityIcons name="file-image-outline" size={28} color={colors.text.muted} />
                    )}
                  </View>

                  {/* Info */}
                  <View style={s.docInfo}>
                    <Text style={s.docLabel} numberOfLines={1}>{doc.label || DOC_TYPE_LABELS[doc.type]}</Text>
                    {doc.documentNumber && <Text style={s.docNumber}>#{doc.documentNumber}</Text>}
                    {doc.expirationDate && (
                      <Text style={[s.docExp, { color: statusColor }]}>
                        {t('wallet.expLabel')} {new Date(doc.expirationDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>

                  {/* Status Badge */}
                  {statusLabel ? (
                    <View style={[s.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                      <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  ) : null}

                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.muted} />
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  headerTitle: { ...typography.h2, color: colors.text.primary },
  headerSub: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.brand.wallet, justifyContent: 'center', alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  // Alert banner
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: `${colors.status.expiring}10`, borderWidth: 1,
    borderColor: `${colors.status.expiring}30`, marginBottom: spacing.lg,
  },
  alertText: { ...typography.bodySmall, color: colors.status.expiring, flex: 1 },
  // Empty state
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyTitle: { ...typography.h3, color: colors.text.secondary, marginTop: spacing.lg },
  emptyText: { ...typography.bodySmall, color: colors.text.muted, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.brand.wallet, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md, marginTop: spacing.xl,
  },
  emptyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Sections
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { ...typography.bodySmall, color: colors.brand.wallet, fontWeight: '700', flex: 1 },
  sectionCount: { ...typography.caption, color: colors.text.muted },
  // Doc card
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  docThumb: {
    width: 48, height: 48, borderRadius: radius.sm,
    backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  docImage: { width: 48, height: 48, borderRadius: radius.sm },
  docInfo: { flex: 1 },
  docLabel: { ...typography.body, fontWeight: '600' },
  docNumber: { ...typography.caption, color: colors.text.muted, marginTop: 1 },
  docExp: { ...typography.caption, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: '700' },
});
