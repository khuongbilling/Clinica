export const COLORS = {
  surface: '#0C0E12',
  surfaceSecondary: '#161A1F',
  surfaceTertiary: '#1E2328',
  onSurface: '#E8EAF0',
  onSurfaceSecondary: '#C8CDD8',
  onSurfaceTertiary: '#7A8494',
  brand: '#D4AF37',
  brandSecondary: '#8C7322',
  brandTertiary: '#3A3116',
  onBrand: '#0C0E12',
  onBrandTertiary: '#EAD385',
  border: '#252B34',
  borderStrong: '#3D4858',
  divider: '#181C22',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  // Element colors — dark fantasy body-system palette
  air: '#B0DEFF',         // Pale sky blue        — Respiratory
  river: '#06B6D4',       // Cyan / teal           — Cardiovascular
  fire: '#F97316',        // Red-orange            — Immune / Infection
  energy: '#FBBF24',      // Gold / amber          — Metabolic
  storm: '#8B5CF6',       // Electric violet       — Sepsis / Multi-system
  mind: '#A78BFA',        // Soft purple           — Neurological
  filter: '#22D3EE',      // Aqua / ice blue       — Renal
  forge: '#D97706',       // Bronze / amber        — Musculoskeletal
  protection: '#34D399',  // Healing emerald green — Integumentary
  growth: '#F472B6',      // Rose / pink           — Endocrine
  // Semantic dark-fantasy UI colors
  healGlow: '#22C55E',        // Stability bar — life energy
  corruptCrystal: '#7C3AED',  // Corruption bar — disease violet
  runeGold: '#F59E0B',        // AP rune gems
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
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const FONTS = {
  display: 'serif',
  text: 'System',
} as const;
