export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  'md-lg': 10,
  lg: 12,
  'lg-xl': 14,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
