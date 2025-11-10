export const DISTANCE_FILTERS = [100, 300, 500];
export const FALLBACK_LOCATION = { lat: -23.527, lon: -46.705 }; // Lapa-SP

export const UI_TOKENS = {
  colors: {
    headerBg: '#3B424A',
    headerInputBg: 'rgba(255,255,255,0.12)',
    searchBg: 'rgba(255,255,255,0.12)',
    chipBg: '#26313B',
    chipBorder: '#4B5A67',
    chipActiveBg: '#2BD3C6',
    chipActiveText: '#0F2A2A',
    brand: '#2BD3C6',
    brandRing: '#A8EDEA',
    brandText: '#0F2A2A',
    tabBg: '#FFFFFF',
    tabBorder: 'rgba(0,0,0,0.06)',
    tabActive: '#2BD3C6',
    tabInactive: '#6B7280',
    recenterBg: '#E9F8F6',
    qrRing: '#A8EDEA',
    danger: '#E11D48',
    white: '#FFFFFF',
    textLight: '#D8DEE5',
    textMuted: '#D8DEE5',
    chipText: '#D8DEE5',
  },
  sizes: { headerH: 168, tabH: 64, chipH: 36, searchH: 46, fab: 64, qr: 64 },
  radius: { pill: 22, search: 24, fab: 32, chip: 22, qr: 32 },
} as const;