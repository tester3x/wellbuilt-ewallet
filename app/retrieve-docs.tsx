import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { colors, spacing, radius, typography } from '../constants/colors';
import { getAllDocuments } from '../services/documentStore';
import { DriverDocument, DOC_TYPE_LABELS, DOC_TYPE_ICONS, DocumentType } from '../services/firebase';
import {
  fetchVehicleDocsForMultiple, isDocExpired, daysUntilExpiration,
  type VehicleDocument,
} from '../services/vehicleDocuments';

export default function RetrieveDocsScreen() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [truckNumber, setTruckNumber] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrieved, setRetrieved] = useState(false);

  // Results
  const [personalDocs, setPersonalDocs] = useState<DriverDocument[]>([]);
  const [truckDocs, setTruckDocs] = useState<VehicleDocument[]>([]);
  const [trailerDocs, setTrailerDocs] = useState<VehicleDocument[]>([]);

  // Pre-fill from settings on mount
  useEffect(() => {
    (async () => {
      const truck = await SecureStore.getItemAsync('wbew_truckNumber') || '';
      const trailer = await SecureStore.getItemAsync('wbew_trailerNumber') || '';
      setTruckNumber(truck);
      setTrailerNumber(trailer);
    })();
  }, []);

  const handleRetrieve = async () => {
    setLoading(true);
    try {
      // Personal docs
      const allDocs = await getAllDocuments();
      setPersonalDocs(allDocs);

      // Vehicle docs
      if (session?.companyId && (truckNumber.trim() || trailerNumber.trim())) {
        const result = await fetchVehicleDocsForMultiple(
          session.companyId,
          truckNumber.trim(),
          trailerNumber.trim(),
        );
        setTruckDocs(result.truck);
        setTrailerDocs(result.trailer);
      } else {
        setTruckDocs([]);
        setTrailerDocs([]);
      }
      setRetrieved(true);
    } catch (err) {
      console.warn('[RetrieveDocs] Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const vehicleExpBadge = (expDate?: string) => {
    if (!expDate) return null;
    const expired = isDocExpired(expDate);
    const days = daysUntilExpiration(expDate);
    const color = expired ? colors.status.expired : (days !== null && days <= 30) ? colors.status.expiring : colors.status.valid;
    const label = expired ? 'EXPIRED' : (days !== null && days <= 30) ? `${days}d left` : 'Valid';
    return (
      <View style={[s.badge, { backgroundColor: `${color}20` }]}>
        <Text style={[s.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const totalDocs = personalDocs.length + truckDocs.length + trailerDocs.length;

  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.headerRow}>
          <MaterialCommunityIcons name="shield-search" size={32} color={colors.brand.wallet} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>DOT Stop</Text>
            <Text style={s.subtitle}>Retrieve all documents for inspection</Text>
          </View>
        </View>

        {/* Equipment inputs */}
        <View style={s.inputCard}>
          <View style={s.inputRow}>
            <MaterialCommunityIcons name="truck" size={22} color={colors.brand.wallet} />
            <TextInput
              style={s.input}
              value={truckNumber}
              onChangeText={setTruckNumber}
              placeholder="Truck #"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="characters"
            />
          </View>
          <View style={s.inputRow}>
            <MaterialCommunityIcons name="truck-trailer" size={22} color={colors.brand.wallet} />
            <TextInput
              style={s.input}
              value={trailerNumber}
              onChangeText={setTrailerNumber}
              placeholder="Trailer #"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="characters"
            />
          </View>
          <Pressable
            onPress={handleRetrieve}
            disabled={loading}
            style={[s.retrieveBtn, loading && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
            )}
            <Text style={s.retrieveBtnText}>{loading ? 'Retrieving...' : 'Retrieve Documents'}</Text>
          </Pressable>
        </View>

        {/* Results */}
        {retrieved && (
          <>
            <Text style={s.resultSummary}>{totalDocs} document{totalDocs !== 1 ? 's' : ''} found</Text>

            {/* Driver / Personal Docs */}
            {personalDocs.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <MaterialCommunityIcons name="account" size={20} color={colors.brand.wallet} />
                  <Text style={s.sectionTitle}>DRIVER — {session?.displayName}</Text>
                </View>
                {personalDocs.map(doc => (
                  <View key={doc.id} style={s.docCard}>
                    {doc.imageUri ? (
                      <Image source={{ uri: doc.imageUri }} style={s.docImage} resizeMode="contain" />
                    ) : (
                      <View style={s.docPlaceholder}>
                        <MaterialCommunityIcons name={DOC_TYPE_ICONS[doc.type] as any} size={40} color={colors.text.muted} />
                      </View>
                    )}
                    <View style={s.docMeta}>
                      <Text style={s.docLabel}>{doc.label || DOC_TYPE_LABELS[doc.type]}</Text>
                      {doc.documentNumber && <Text style={s.docSub}>#{doc.documentNumber}</Text>}
                      {doc.expirationDate && (
                        <Text style={s.docSub}>Exp: {new Date(doc.expirationDate).toLocaleDateString()}</Text>
                      )}
                      {vehicleExpBadge(doc.expirationDate)}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Truck Docs */}
            {truckDocs.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <MaterialCommunityIcons name="truck" size={20} color={colors.brand.primary} />
                  <Text style={[s.sectionTitle, { color: colors.brand.primary }]}>TRUCK {truckNumber}</Text>
                </View>
                {truckDocs.map(doc => (
                  <View key={doc.id} style={s.docCard}>
                    {doc.storageUrl ? (
                      <Image source={{ uri: doc.storageUrl }} style={s.docImage} resizeMode="contain" />
                    ) : (
                      <View style={s.docPlaceholder}>
                        <MaterialCommunityIcons name="file-document-outline" size={40} color={colors.text.muted} />
                      </View>
                    )}
                    <View style={s.docMeta}>
                      <Text style={s.docLabel}>{doc.label}</Text>
                      {doc.documentNumber && <Text style={s.docSub}>#{doc.documentNumber}</Text>}
                      {doc.expirationDate && (
                        <Text style={s.docSub}>Exp: {new Date(doc.expirationDate).toLocaleDateString()}</Text>
                      )}
                      {vehicleExpBadge(doc.expirationDate)}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Trailer Docs */}
            {trailerDocs.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <MaterialCommunityIcons name="truck-trailer" size={20} color={colors.brand.primary} />
                  <Text style={[s.sectionTitle, { color: colors.brand.primary }]}>TRAILER {trailerNumber}</Text>
                </View>
                {trailerDocs.map(doc => (
                  <View key={doc.id} style={s.docCard}>
                    {doc.storageUrl ? (
                      <Image source={{ uri: doc.storageUrl }} style={s.docImage} resizeMode="contain" />
                    ) : (
                      <View style={s.docPlaceholder}>
                        <MaterialCommunityIcons name="file-document-outline" size={40} color={colors.text.muted} />
                      </View>
                    )}
                    <View style={s.docMeta}>
                      <Text style={s.docLabel}>{doc.label}</Text>
                      {doc.documentNumber && <Text style={s.docSub}>#{doc.documentNumber}</Text>}
                      {doc.expirationDate && (
                        <Text style={s.docSub}>Exp: {new Date(doc.expirationDate).toLocaleDateString()}</Text>
                      )}
                      {vehicleExpBadge(doc.expirationDate)}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {totalDocs === 0 && (
              <View style={s.emptyResult}>
                <MaterialCommunityIcons name="file-search-outline" size={48} color={colors.text.muted} />
                <Text style={s.emptyText}>No documents found. Add personal documents from the wallet, or ask your admin to upload vehicle documents.</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text.primary },
  subtitle: { ...typography.bodySmall, color: colors.text.muted },
  inputCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border.subtle, marginBottom: spacing.lg,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.bg.primary, borderRadius: radius.md, padding: spacing.sm,
    color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.border.subtle,
  },
  retrieveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.brand.wallet, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs,
  },
  retrieveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultSummary: { ...typography.bodySmall, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.bodySmall, color: colors.brand.wallet, fontWeight: '700', letterSpacing: 1 },
  docCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.subtle,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  docImage: { width: '100%', height: 200, backgroundColor: colors.bg.elevated },
  docPlaceholder: {
    width: '100%', height: 120, backgroundColor: colors.bg.elevated,
    justifyContent: 'center', alignItems: 'center',
  },
  docMeta: { padding: spacing.md },
  docLabel: { ...typography.body, fontWeight: '600' },
  docSub: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, marginTop: spacing.xs },
  badgeText: { fontSize: 11, fontWeight: '700' },
  emptyResult: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { ...typography.bodySmall, color: colors.text.muted, textAlign: 'center', marginTop: spacing.md, maxWidth: 300 },
});
