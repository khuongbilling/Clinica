export const COLORS = {
  surface: '#111315',
  surfaceSecondary: '#1A1D21',
  surfaceTertiary: '#252A2E',
  onSurface: '#E5E7EB',
  onSurfaceSecondary: '#D1D5DB',
  onSurfaceTertiary: '#9CA3AF',
  brand: '#D4AF37',
  brandSecondary: '#8C7322',
  brandTertiary: '#3A3116',
  onBrand: '#111315',
  onBrandTertiary: '#EAD385',
  border: '#2E3338',
  borderStrong: '#4B5563',
  divider: '#1F2428',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  // Element colors
  air: '#A7F3D0',
  river: '#059669',
  fire: '#DC2626',
  energy: '#FCD34D',
  storm: '#BEF264',
  mind: '#E5E7EB',
  filter: '#4D7C0F',
  forge: '#78716C',
  protection: '#9CA3AF',
  growth: '#10B981',
} as const;

export const ELEMENT_COLORS: Record<string, string> = {
  Air: COLORS.air,
  River: COLORS.river,
  Fire: COLORS.fire,
  Energy: COLORS.energy,
  Storm: COLORS.storm,
  Mind: COLORS.mind,
  Filter: COLORS.filter,
  Forge: COLORS.forge,
  Protection: COLORS.protection,
  Growth: COLORS.growth,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const FONTS = {
  display: 'serif',
  text: 'System',
} as const;
