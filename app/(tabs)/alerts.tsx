import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { colors, spacing, radius, typography } from '../../constants/colors';
import { getAllDocuments, getExpiringDocuments, isExpired, daysUntilExpiration } from '../../services/documentStore';
import { DriverDocument, DOC_TYPE_LABELS, DOC_TYPE_ICONS, DocumentType } from '../../services/firebase';

export default function AlertsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);

  useFocusEffect(useCallback(() => {
    getAllDocuments().then(setDocuments);
  }, []));

  const expired = documents.filter(isExpired);
  const expiringSoon = getExpiringDocuments(documents, 30).filter(d => !isExpired(d));
  const expiring60 = getExpiringDocuments(documents, 60).filter(d => !isExpired(d) && daysUntilExpiration(d)! > 30);

  const renderDocRow = (doc: DriverDocument) => {
    const days = daysUntilExpiration(doc);
    const exp = isExpired(doc);
    const color = exp ? colors.status.expired : days !== null && days <= 30 ? colors.status.expiring : colors.status.valid;
    return (
      <Pressable key={doc.id} onPress={() => router.push(`/view-document?id=${doc.id}`)} style={s.row}>
        <MaterialCommunityIcons name={DOC_TYPE_ICONS[doc.type] as any} size={22} color={color} />
        <View style={s.rowInfo}>
          <Text style={s.rowLabel}>{doc.label || DOC_TYPE_LABELS[doc.type]}</Text>
          <Text style={[s.rowExp, { color }]}>
            {exp ? t('alerts.expired') : t('alerts.expiresOn', { date: new Date(doc.expirationDate!).toLocaleDateString() })}
            {days !== null && !exp ? ` (${t('alerts.daysRemaining', { days, s: days !== 1 ? 's' : '' })})` : ''}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.muted} />
      </Pressable>
    );
  };

  const hasAlerts = expired.length > 0 || expiringSoon.length > 0 || expiring60.length > 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('alerts.title')}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {!hasAlerts && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="check-circle-outline" size={64} color={colors.status.valid} style={{ opacity: 0.4 }} />
            <Text style={s.emptyTitle}>{t('alerts.allClear')}</Text>
            <Text style={s.emptyText}>{t('alerts.allClearSub')}</Text>
          </View>
        )}

        {expired.length > 0 && (
          <View style={s.section}>
            <View style={[s.sectionBadge, { backgroundColor: `${colors.status.expired}20` }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={colors.status.expired} />
              <Text style={[s.sectionTitle, { color: colors.status.expired }]}>{t('alerts.expired')} ({expired.length})</Text>
            </View>
            {expired.map(renderDocRow)}
          </View>
        )}

        {expiringSoon.length > 0 && (
          <View style={s.section}>
            <View style={[s.sectionBadge, { backgroundColor: `${colors.status.expiring}15` }]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.status.expiring} />
              <Text style={[s.sectionTitle, { color: colors.status.expiring }]}>{t('alerts.expiring30')} ({expiringSoon.length})</Text>
            </View>
            {expiringSoon.map(renderDocRow)}
          </View>
        )}

        {expiring60.length > 0 && (
          <View style={s.section}>
            <View style={[s.sectionBadge, { backgroundColor: `${colors.brand.primary}15` }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.brand.primary} />
              <Text style={[s.sectionTitle, { color: colors.brand.primary }]}>{t('alerts.expiring60')} ({expiring60.length})</Text>
            </View>
            {expiring60.map(renderDocRow)}
          </View>
        )}
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
  empty: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  emptyTitle: { ...typography.h3, color: colors.text.secondary, marginTop: spacing.lg },
  emptyText: { ...typography.bodySmall, color: colors.text.muted, marginTop: spacing.sm },
  section: { marginBottom: spacing.xl },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  rowInfo: { flex: 1 },
  rowLabel: { ...typography.body, fontWeight: '600' },
  rowExp: { ...typography.caption, marginTop: 2 },
});
