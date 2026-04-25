/**
 * Typography System v2
 *
 * Centraliza todos os tokens tipograficos do app.
 * Cada token combina fontSize + lineHeight + fontWeight + letterSpacing.
 *
 * iOS: usa fontWeight com a fonte do sistema (SF Pro Display).
 * Android: usa fontFamily com variantes Inter (Inter_700Bold, etc).
 */

import { Platform, TextStyle } from 'react-native';

// ── FONT FAMILIES ──

export const fonts = {
  primary: Platform.select({
    ios: 'System',
    android: 'Inter_400Regular',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
  android: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
  },
};

// ── HELPER ──

const weightMap: Record<number, string> = {
  300: fonts.android.light,
  400: fonts.android.regular,
  500: fonts.android.medium,
  600: fonts.android.semibold,
  700: fonts.android.bold,
  800: fonts.android.extrabold,
};

const text = (
  size: number,
  lineHeight: number,
  weight: 300 | 400 | 500 | 600 | 700 | 800,
  letterSpacing: number = 0,
): TextStyle => ({
  fontSize: size,
  lineHeight: lineHeight,
  letterSpacing: letterSpacing,
  ...(Platform.OS === 'ios'
    ? { fontWeight: String(weight) as TextStyle['fontWeight'] }
    : { fontFamily: weightMap[weight] }),
});

// ── TYPE SCALE ──

export const type = {
  // Display
  heroValue:    text(34, 40, 800, -1.02),
  displayLg:    text(24, 30, 800, -0.48),
  displaySm:    text(22, 28, 800, -0.22),

  // Headings
  headingLg:    text(20, 26, 800, -0.40),
  headingSm:    text(18, 24, 800, -0.36),

  // Titles
  titleLg:      text(16, 22, 700),
  titleMd:      text(17, 23, 600),
  titleSm:      text(15, 20, 700),

  // Body
  bodyLg:       text(14, 20, 400),
  bodyLgMed:    text(14, 20, 500),
  bodyLgSemi:   text(14, 20, 600),
  bodyLgBold:   text(14, 20, 700),
  bodySm:       text(13, 18, 500),
  bodySmSemi:   text(13, 18, 600),
  bodySmBold:   text(13, 18, 700),

  // Labels
  label:        text(12, 16, 600),
  labelBold:    text(12, 16, 700),
  labelSm:      text(11, 15, 600),

  // Micro
  micro:        text(10, 14, 600, 0.20),
  microBold:    text(10, 14, 700, 0.20),
  nano:         text(9,  12, 700, 0.27),

  // Mono
  mono: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
  } as TextStyle,

  monoSm: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
  } as TextStyle,
};
