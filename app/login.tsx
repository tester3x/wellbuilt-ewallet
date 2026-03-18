import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { colors, spacing, radius, typography } from '../constants/colors';

export default function LoginScreen() {
  const { mode, error, login, register, completeReg, switchToRegister, switchToLogin, tryAgain } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [company, setCompany] = useState('');
  const [legalName, setLegalName] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const legalRef = useRef<TextInput>(null);
  const companyRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const isRegister = mode === 'register' || mode === 'registering';
  const isLoading = mode === 'verifying' || mode === 'registering' || mode === 'checking';

  const handleSubmit = () => {
    if (!name.trim() || !passcode.trim()) return;
    if (isRegister) register(name.trim(), passcode.trim(), company.trim() || undefined, legalName.trim() || undefined);
    else login(name.trim(), passcode.trim());
  };

  // Pending / Approved / Rejected states
  if (mode === 'pending') {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.centerContent}>
          <MaterialCommunityIcons name="clock-outline" size={64} color={colors.brand.wallet} />
          <Text style={s.title}>{t('login.pending')}</Text>
          <Text style={s.subtitle}>{t('login.pendingSub')}</Text>
          <ActivityIndicator size="small" color={colors.brand.wallet} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  if (mode === 'approved') {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.centerContent}>
          <MaterialCommunityIcons name="check-circle" size={64} color={colors.status.valid} />
          <Text style={s.title}>{t('login.approved')}</Text>
          <Text style={s.subtitle}>{t('login.approvedSub')}</Text>
          <Pressable onPress={completeReg} style={s.btn}>
            <Text style={s.btnText}>{t('login.continueBtn')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (mode === 'rejected') {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.centerContent}>
          <MaterialCommunityIcons name="close-circle" size={64} color={colors.status.expired} />
          <Text style={s.title}>{t('login.rejected')}</Text>
          <Text style={s.subtitle}>{t('login.rejectedSub')}</Text>
          <Pressable onPress={tryAgain} style={s.btn}>
            <Text style={s.btnText}>{t('login.startOver')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.centerContent}>
          <Image source={require('../assets/icon.png')} style={s.appIcon} />
          <Text style={s.title}>{t('login.title')}</Text>
          <Text style={s.subtitle}>{t('login.subtitle')}</Text>

          <View style={s.form}>
            <TextInput
              ref={nameRef}
              style={s.input}
              placeholder={t('login.displayName')}
              placeholderTextColor={colors.text.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => isRegister ? legalRef.current?.focus() : passRef.current?.focus()}
            />

            {isRegister && (
              <>
                <TextInput
                  ref={legalRef}
                  style={s.input}
                  placeholder={t('login.legalName')}
                  placeholderTextColor={colors.text.muted}
                  value={legalName}
                  onChangeText={setLegalName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => companyRef.current?.focus()}
                />
                <TextInput
                  ref={companyRef}
                  style={s.input}
                  placeholder={t('login.company')}
                  placeholderTextColor={colors.text.muted}
                  value={company}
                  onChangeText={setCompany}
                  autoCapitalize="words"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passRef.current?.focus()}
                />
              </>
            )}

            <View style={s.passRow}>
              <TextInput
                ref={passRef}
                style={[s.input, s.passInput]}
                placeholder={t('login.passcode')}
                placeholderTextColor={colors.text.muted}
                value={passcode}
                onChangeText={setPasscode}
                secureTextEntry={!showPasscode}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                blurOnSubmit={false}
                onSubmitEditing={handleSubmit}
              />
              <Pressable onPress={() => setShowPasscode(!showPasscode)} style={s.eyeBtn}>
                <MaterialCommunityIcons
                  name={showPasscode ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.text.muted}
                />
              </Pressable>
            </View>

            {(mode === 'error' && error) ? (
              <Text style={s.error}>{error}</Text>
            ) : null}

            <Pressable onPress={handleSubmit} style={[s.btn, isLoading && s.btnDisabled]} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>{isRegister ? t('login.registerBtn') : t('login.loginBtn')}</Text>
              )}
            </Pressable>

            <Pressable onPress={isRegister ? switchToLogin : switchToRegister} style={s.switchBtn}>
              <Text style={s.switchText}>
                {isRegister ? t('login.switchToLogin') : t('login.switchToRegister')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  centerContent: { alignItems: 'center' },
  appIcon: { width: 100, height: 100, borderRadius: 20 },
  title: { ...typography.h1, color: colors.text.primary, marginTop: spacing.md },
  subtitle: { ...typography.bodySmall, color: colors.text.muted, marginTop: spacing.xs, textAlign: 'center' },
  form: { width: '100%', marginTop: spacing.xl, gap: spacing.md },
  input: {
    backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.md,
    color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.border.subtle,
  },
  passRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
  },
  passInput: {
    flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0,
  },
  eyeBtn: {
    backgroundColor: colors.bg.card, borderRadius: radius.md, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    borderWidth: 1, borderColor: colors.border.subtle, borderLeftWidth: 0,
    padding: spacing.md, justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  btn: {
    backgroundColor: colors.brand.wallet, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.status.expired, fontSize: 14, textAlign: 'center' },
  switchBtn: { alignItems: 'center', marginTop: spacing.md },
  switchText: { color: colors.brand.wallet, fontSize: 14 },
});
