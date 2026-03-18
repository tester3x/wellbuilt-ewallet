export const colors = {
  bg: {
    primary: '#0A0E1A',
    secondary: '#111422',
    card: '#161A2B',
    elevated: '#1C2038',
  },
  brand: {
    primary: '#00A8E8',
    accent: '#818CF8',
    wallet: '#A78BFA', // Purple/indigo for wallet branding
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    muted: '#64748B',
  },
  status: {
    valid: '#34D399',
    expiring: '#FBBF24',
    expired: '#EF4444',
  },
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    accent: 'rgba(167,139,250,0.2)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text.primary },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text.primary },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text.primary },
  body: { fontSize: 16, color: colors.text.primary },
  bodySmall: { fontSize: 14, color: colors.text.secondary },
  caption: { fontSize: 12, color: colors.text.muted },
};
