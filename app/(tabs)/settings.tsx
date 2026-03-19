import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation, Locale } from '../../i18n';
import { colors, spacing, radius, typography } from '../../constants/colors';
import { getAllDocuments, syncToCloud } from '../../services/documentStore';
import { DriverDocument } from '../../services/firebase';

export default function SettingsScreen() {
  const { session, logout } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const insets = useSafeAreaInsets();
  const [docCount, setDocCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [truckNumber, setTruckNumber] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [vehicleDirty, setVehicleDirty] = useState(false);

  useFocusEffect(useCallback(() => {
    getAllDocuments().then(docs => setDocCount(docs.length));
    // Load vehicle info
    (async () => {
      const truck = await SecureStore.getItemAsync('wbew_truckNumber');
      const trailer = await SecureStore.getItemAsync('wbew_trailerNumber');
      setTruckNumber(truck || '');
      setTrailerNumber(trailer || '');
    })();
  }, []));

  const handleSync = async () => {
    if (!session) return;
    setSyncing(true);
    setSyncResult(null);
    const result = await syncToCloud(session.passcodeHash);
    setSyncing(false);
    setSyncResult(t('settings.syncResult', { count: result.synced, s: result.synced !== 1 ? 's' : '' }) + (result.failed > 0 ? t('settings.syncFailed', { count: result.failed }) : ''));
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutMessage'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.logoutBtn'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Language Toggle */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('settings.language')}</Text>
          <View style={s.card}>
            <Pressable
              onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}
              style={s.langRow}
            >
              <MaterialCommunityIcons name="translate" size={22} color={colors.brand.wallet} />
              <Text style={s.rowLabel}>{locale === 'en' ? 'English' : 'Español'}</Text>
              <Text style={s.langBadge}>{t('settings.languageLabel')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Profile Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('settings.profile')}</Text>
          <View style={s.card}>
            <View style={s.profileRow}>
              <View style={s.avatar}>
                <MaterialCommunityIcons name="account" size={32} color={colors.brand.wallet} />
              </View>
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{session?.displayName}</Text>
                {session?.legalName && <Text style={s.profileSub}>{session.legalName}</Text>}
                {session?.companyName && <Text style={s.profileSub}>{session.companyName}</Text>}
              </View>
            </View>
          </View>
        </View>

        {/* Vehicle Setup */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>VEHICLE SETUP</Text>
          <View style={s.card}>
            <View style={s.inputRow}>
              <MaterialCommunityIcons name="truck" size={22} color={colors.brand.wallet} />
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Truck #</Text>
                <TextInput
                  style={s.input}
                  value={truckNumber}
                  onChangeText={v => { setTruckNumber(v); setVehicleDirty(true); }}
                  placeholder="e.g. 4608"
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <View style={[s.inputRow, { marginTop: spacing.sm }]}>
              <MaterialCommunityIcons name="truck-trailer" size={22} color={colors.brand.wallet} />
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Trailer #</Text>
                <TextInput
                  style={s.input}
                  value={trailerNumber}
                  onChangeText={v => { setTrailerNumber(v); setVehicleDirty(true); }}
                  placeholder="e.g. T-15"
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            {vehicleDirty && (
              <Pressable
                onPress={async () => {
                  await SecureStore.setItemAsync('wbew_truckNumber', truckNumber.trim());
                  await SecureStore.setItemAsync('wbew_trailerNumber', trailerNumber.trim());
                  setVehicleDirty(false);
                  Alert.alert('Saved', 'Vehicle info updated');
                }}
                style={[s.syncBtn, { backgroundColor: colors.brand.wallet }]}
              >
                <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                <Text style={s.syncBtnText}>Save Vehicle Info</Text>
              </Pressable>
            )}
            <Text style={s.syncNote}>Vehicle docs for this truck/trailer will appear on your wallet.</Text>
          </View>
        </View>

        {/* Cloud Sync Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('settings.cloudBackup')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <MaterialCommunityIcons name="cloud-outline" size={22} color={colors.brand.primary} />
              <Text style={s.rowLabel}>{t('settings.documents')}</Text>
              <Text style={s.rowValue}>{docCount}</Text>
            </View>
            <Pressable onPress={handleSync} disabled={syncing} style={[s.syncBtn, syncing && { opacity: 0.5 }]}>
              <MaterialCommunityIcons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={s.syncBtnText}>{syncing ? t('settings.syncing') : t('settings.syncBtn')}</Text>
            </Pressable>
            {syncResult && <Text style={s.syncResult}>{syncResult}</Text>}
            <Text style={s.syncNote}>{t('settings.syncNote')}</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('settings.about')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <MaterialCommunityIcons name="wallet" size={22} color={colors.brand.wallet} />
              <Text style={s.rowLabel}>WB eWallet</Text>
              <Text style={s.rowValue}>v1.0.0</Text>
            </View>
            <View style={s.row}>
              <MaterialCommunityIcons name="information-outline" size={22} color={colors.text.muted} />
              <Text style={s.rowLabel}>{t('settings.aboutNote')}</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.status.expired} />
          <Text style={s.logoutText}>{t('settings.logoutBtn')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  headerTitle: { ...typography.h2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionLabel: { ...typography.caption, color: colors.text.muted, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.subtle, padding: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: `${colors.brand.wallet}15`, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1 },
  profileName: { ...typography.h3 },
  profileSub: { ...typography.bodySmall, color: colors.text.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowLabel: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  rowValue: { ...typography.bodySmall, color: colors.text.muted },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.brand.primary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  syncBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  syncResult: { ...typography.caption, color: colors.status.valid, textAlign: 'center', marginTop: spacing.sm },
  syncNote: { ...typography.caption, color: colors.text.muted, marginTop: spacing.sm, lineHeight: 18 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: `${colors.status.expired}30`,
  },
  logoutText: { color: colors.status.expired, fontWeight: '600', fontSize: 14 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  langBadge: { color: colors.brand.wallet, fontWeight: '700', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inputLabel: { ...typography.caption, color: colors.text.muted, fontWeight: '700', marginBottom: 2 },
  input: { backgroundColor: colors.bg.primary, borderRadius: radius.md, padding: spacing.sm, color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.border.subtle },
});
