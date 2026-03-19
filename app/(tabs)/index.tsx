import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n';
import { colors, spacing, radius, typography } from '../../constants/colors';
import { getAllDocuments, getExpiringDocuments, isExpired, daysUntilExpiration } from '../../services/documentStore';
import { DriverDocument, DOC_TYPE_LABELS, DOC_TYPE_ICONS, DocumentType } from '../../services/firebase';
import {
  fetchVehicleDocsForMultiple, cacheVehicleDocs, getCachedVehicleDocs,
  isDocExpired, daysUntilExpiration as vehicleDaysUntil,
  type VehicleDocument,
} from '../../services/vehicleDocuments';

function VehicleDocCard({ doc }: { doc: VehicleDocument }) {
  const expired = isDocExpired(doc.expirationDate);
  const days = vehicleDaysUntil(doc.expirationDate);
  const statusColor = expired ? colors.status.expired : (days !== null && days <= 30) ? colors.status.expiring : colors.status.valid;
  const statusLabel = expired ? 'EXPIRED' : (days !== null && days <= 30) ? `${days}d` : (days !== null ? 'Valid' : '');

  return (
    <Pressable
      onPress={() => router.push(`/view-document?vehicleDocId=${doc.id}&storageUrl=${encodeURIComponent(doc.storageUrl)}&label=${encodeURIComponent(doc.label)}&type=${doc.type}&expiration=${doc.expirationDate || ''}&docNumber=${doc.documentNumber || ''}&state=${doc.state || ''}&notes=${encodeURIComponent(doc.notes || '')}`)}
      style={s.docCard}
    >
      <View style={s.docThumb}>
        {doc.storageUrl ? (
          <Image source={{ uri: doc.storageUrl }} style={s.docImage} />
        ) : (
          <MaterialCommunityIcons name="file-document-outline" size={28} color={colors.text.muted} />
        )}
      </View>
      <View style={s.docInfo}>
        <Text style={s.docLabel} numberOfLines={1}>{doc.label}</Text>
        {doc.documentNumber && <Text style={s.docNumber}>#{doc.documentNumber}</Text>}
        {doc.expirationDate && (
          <Text style={[s.docExp, { color: statusColor }]}>
            Exp: {new Date(doc.expirationDate).toLocaleDateString()}
          </Text>
        )}
      </View>
      {statusLabel ? (
        <View style={[s.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.muted} />
    </Pressable>
  );
}

export default function WalletScreen() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [truckDocs, setTruckDocs] = useState<VehicleDocument[]>([]);
  const [trailerDocs, setTrailerDocs] = useState<VehicleDocument[]>([]);
  const [truckNum, setTruckNum] = useState('');
  const [trailerNum, setTrailerNum] = useState('');
  const [vehicleLoading, setVehicleLoading] = useState(false);

  const loadDocuments = useCallback(async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  }, []);

  const loadVehicleDocs = useCallback(async () => {
    const truck = await SecureStore.getItemAsync('wbew_truckNumber') || '';
    const trailer = await SecureStore.getItemAsync('wbew_trailerNumber') || '';
    setTruckNum(truck);
    setTrailerNum(trailer);

    if (!truck && !trailer) {
      // Try cache
      const cached = await getCachedVehicleDocs();
      if (cached) {
        setTruckDocs(cached.truck);
        setTrailerDocs(cached.trailer);
        setTruckNum(cached.truckNumber);
        setTrailerNum(cached.trailerNumber);
      }
      return;
    }

    if (!session?.companyId) return;
    setVehicleLoading(true);
    try {
      const result = await fetchVehicleDocsForMultiple(session.companyId, truck, trailer);
      setTruckDocs(result.truck);
      setTrailerDocs(result.trailer);
      await cacheVehicleDocs(result.truck, result.trailer, truck, trailer);
    } catch (err) {
      console.warn('[Wallet] Vehicle docs fetch failed:', err);
      // Fall back to cache
      const cached = await getCachedVehicleDocs();
      if (cached) {
        setTruckDocs(cached.truck);
        setTrailerDocs(cached.trailer);
      }
    } finally {
      setVehicleLoading(false);
    }
  }, [session?.companyId]);

  useFocusEffect(useCallback(() => {
    loadDocuments();
    loadVehicleDocs();
  }, [loadDocuments, loadVehicleDocs]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDocuments(), loadVehicleDocs()]);
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

        {/* Vehicle Documents */}
        {(truckDocs.length > 0 || trailerDocs.length > 0 || vehicleLoading) && (
          <View style={s.vehicleDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>VEHICLE DOCUMENTS</Text>
            <View style={s.dividerLine} />
          </View>
        )}

        {vehicleLoading && (
          <ActivityIndicator color={colors.brand.wallet} style={{ marginVertical: spacing.md }} />
        )}

        {truckDocs.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <MaterialCommunityIcons name="truck" size={18} color={colors.brand.primary} />
              <Text style={[s.sectionTitle, { color: colors.brand.primary }]}>Truck {truckNum}</Text>
              <Text style={s.sectionCount}>{truckDocs.length}</Text>
            </View>
            {truckDocs.map(vd => (
              <VehicleDocCard key={vd.id} doc={vd} />
            ))}
          </View>
        )}

        {trailerDocs.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <MaterialCommunityIcons name="truck-trailer" size={18} color={colors.brand.primary} />
              <Text style={[s.sectionTitle, { color: colors.brand.primary }]}>Trailer {trailerNum}</Text>
              <Text style={s.sectionCount}>{trailerDocs.length}</Text>
            </View>
            {trailerDocs.map(vd => (
              <VehicleDocCard key={vd.id} doc={vd} />
            ))}
          </View>
        )}

        {!truckNum && !trailerNum && documents.length > 0 && (
          <View style={s.vehicleHint}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.text.muted} />
            <Text style={s.vehicleHintText}>Set your truck/trailer in Settings to see vehicle documents.</Text>
          </View>
        )}

        {/* DOT Stop Button */}
        <Pressable onPress={() => router.push('/retrieve-docs')} style={s.dotStopBtn}>
          <MaterialCommunityIcons name="shield-search" size={22} color="#fff" />
          <Text style={s.dotStopText}>DOT Stop — Retrieve All Docs</Text>
        </Pressable>

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
  // Vehicle docs
  vehicleDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border.subtle },
  dividerText: { ...typography.caption, color: colors.text.muted, fontWeight: '700', letterSpacing: 1 },
  vehicleHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: `${colors.brand.primary}10` },
  vehicleHintText: { ...typography.caption, color: colors.text.muted, flex: 1 },
  // DOT Stop button
  dotStopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.brand.primary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  dotStopText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
