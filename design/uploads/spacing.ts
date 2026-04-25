export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '1.5xl': 14,
  '2xl': 16,
  '3xl': 20,
  '4xl': 24,
  '5xl': 32,
  '6xl': 40,
  '7xl': 48,
  '8xl': 60,
} as const;

export type SpacingToken = keyof typeof spacing;
