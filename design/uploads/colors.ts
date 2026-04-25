/**
 * Paleta de cores do app TôNaGarantia — Design System v2
 *
 * Estrutura:
 * - Base colors (background, surface, text)
 * - Status colors (success, warning, danger, info)
 * - Brand colors (primary, gradient)
 * - Semantic tokens (status cards, progress, tags, CTA, sheet, badge)
 *
 * Dark Mode:
 * - Backgrounds: Near-black scale (#0B0D11 / #13161D / #1A1E27)
 * - Elevação: Cores mais claras (sem sombras)
 * - Status: Cores dessaturadas para não "gritar"
 * - Texto: Branco suave (não puro)
 */

const lightColors = {
  // Base
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Text
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    muted: '#9CA3AF',
    inverse: '#FFFFFF',
  },

  // Brand
  primary: {
    main: '#0A7B4E',
    light: '#B8E4CF',
    dark: '#064D31',
    contrast: '#FFFFFF',
    bg: '#E6F5EE',
  },

  // Gradient
  gradient: {
    start: '#064D31',
    end: '#0A7B4E',
  },

  // Success (Garantia Ativa)
  success: {
    bg: '#E6F5EE',
    bgSubtle: '#F0FDF4',
    text: '#0A7B4E',
    main: '#0A7B4E',
    dark: '#064D31',
  },

  // Warning (Atenção)
  warning: {
    bg: '#FEF3C7',
    bgSubtle: '#FFFBEB',
    text: '#92400E',
    main: '#D97706',
    dark: '#B45309',
    border: '#FDE68A',
  },

  // Danger (Expirada)
  danger: {
    bg: '#FEE2E2',
    bgSubtle: '#FEF2F2',
    text: '#991B1B',
    main: '#DC2626',
    dark: '#991B1B',
    border: '#FECACA',
  },

  // Info (Lembretes)
  info: {
    bg: '#DBEAFE',
    bgSubtle: '#EFF6FF',
    text: '#1D4ED8',
    main: '#3B82F6',
    dark: '#2563EB',
  },

  // Cards
  card: {
    background: '#FFFFFF',
    backgroundPressed: '#F6F7F9',
    border: '#E5E7EB',
  },

  // Tab Bar
  tabBar: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    active: '#0A7B4E',
    inactive: '#9CA3AF',
  },

  // Inputs
  input: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    borderFocus: '#0A7B4E',
    placeholder: '#9CA3AF',
    text: '#111827',
  },

  // Overlays
  overlay: 'rgba(15, 17, 23, 0.5)',
  overlayInner: 'rgba(255, 255, 255, 0.3)',

  // Skeleton loading
  skeleton: {
    base: '#E5E7EB',
    highlight: '#F3F4F6',
  },

  // Switch
  switch: {
    trackOff: '#D1D5DB',
    trackOn: '#B8E4CF',
    thumbOff: '#F4F3F4',
    thumbOn: '#0A7B4E',
  },

  // Status cards (dashboard)
  status: {
    seguras: { bg: '#E6F5EE', text: '#0A7B4E' },
    atencao: { bg: '#FEF3C7', text: '#92400E' },
    expiradas: { bg: '#FEE2E2', text: '#991B1B' },
    criticas: { bg: 'rgba(249, 115, 22, 0.1)', text: '#F97316' },
    alertas: { bg: '#FCE7F3', text: '#9D174D' },
  },

  // Progress bar
  progress: {
    bg: '#E5E7EB',
    safe: '#0A7B4E',
    warning: '#F59E0B',
    danger: '#DC2626',
  },

  // Tags (experience quality)
  tag: {
    positive: { bg: '#E6F5EE', text: '#0A7B4E', border: '#B8E4CF' },
    negative: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  },

  // CTA buttons
  cta: {
    primary: '#0A7B4E',
    secondary: '#E6F5EE',
    disabled: '#D1D5DB',
    disabledText: '#9CA3AF',
  },

  // Bottom sheet
  sheet: {
    handle: '#D1D5DB',
    bg: '#FFFFFF',
  },

  // Premium badge
  badge: {
    premium: '#7C3AED',
    premiumLight: '#EDE9FE',
  },

  // Divider
  divider: '#F3F4F6',

  // Premium (Referral/Premium UI)
  premium: {
    bg: '#EDE9FE',
    bgSubtle: '#F5F3FF',
    text: '#6D28D9',
    main: '#7C3AED',
    dark: '#6D28D9',
    border: '#E9D5FF',
  },

  // Splash screen
  splash: {
    bg: '#F8FAFC',
    title: '#1F2937',
    subtitle: 'rgba(31, 41, 55, 0.5)',
  },

  // Toast (overlay UI — same both themes)
  toast: {
    bg: '#1F2937',
    text: '#FFFFFF',
    action: '#60A5FA',
  },

  // Pill (status pills, labels, muted text)
  pill: {
    label: 'rgba(0, 0, 0, 0.40)',
    muted: 'rgba(0, 0, 0, 0.45)',
    subtle: 'rgba(0, 0, 0, 0.25)',
  },

  // Travel / Bagagem (Modo Viagem)
  travel: {
    main: '#6366F1',
    light: '#A5B4FC',
    dark: '#4338CA',
    bg: '#EEF2FF',
    bgSubtle: '#F5F3FF',
    text: '#3730A3',
    border: '#C7D2FE',
  },

  // Gamification — Tier colors
  tier: {
    bronze: { main: '#A0522D', light: '#CD7F32', bg: '#FFF0E1', glow: '#DBA053', text: '#A0522D' },
    prata: { main: '#6B7280', light: '#9CA3AF', bg: '#F3F4F6', glow: '#CBD5E1', text: '#555D6B' },
    ouro: { main: '#D97706', light: '#FBBF24', bg: '#FEF3C7', glow: '#FDE68A', text: '#92400E' },
    platina: { main: '#8B5CF6', light: '#A78BFA', bg: '#EDE9FE', glow: '#C4B5FD', text: '#6B3FCC' },
    diamante: { main: '#3B82F6', light: '#60A5FA', bg: '#DBEAFE', glow: '#93C5FD', text: '#2E66C2' },
  },
  xpBar: { bg: '#E5E7EB', fill: '#0A7B4E' },
  streak: { bg: '#FEF3C7', text: '#92400E' },
  badgeLocked: { bg: '#E5E7EB', text: '#9CA3AF' },

  // Shadows (applied only in light mode)
  shadow: true as const,
} as const;

const darkColors = {
  // Base (near-black scale)
  background: '#0B0D11',
  surface: '#13161D',
  surfaceElevated: '#1A1E27',

  // Borders
  border: '#2A2E38',
  borderLight: '#1A1E27',

  // Text
  text: {
    primary: '#F1F5F9',
    secondary: '#9CA3AF',
    muted: '#6B7280',
    inverse: '#0B0D11',
  },

  // Brand
  primary: {
    main: '#34D399',
    light: '#6EE7B7',
    dark: '#0A7B4E',
    contrast: '#FFFFFF',
    bg: 'rgba(52, 211, 153, 0.15)',
  },

  // Gradient
  gradient: {
    start: '#064D31',
    end: '#0A7B4E',
  },

  // Success (dessaturado)
  success: {
    bg: 'rgba(52, 211, 153, 0.15)',
    bgSubtle: 'rgba(52, 211, 153, 0.08)',
    text: '#34D399',
    main: '#34D399',
    dark: '#0A7B4E',
  },

  // Warning
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    bgSubtle: 'rgba(245, 158, 11, 0.08)',
    text: '#FBBF24',
    main: '#F59E0B',
    dark: '#D97706',
    border: 'rgba(245, 158, 11, 0.3)',
  },

  // Danger
  danger: {
    bg: 'rgba(239, 68, 68, 0.15)',
    bgSubtle: 'rgba(239, 68, 68, 0.08)',
    text: '#F87171',
    main: '#EF4444',
    dark: '#DC2626',
    border: 'rgba(239, 68, 68, 0.3)',
  },

  // Info
  info: {
    bg: 'rgba(59, 130, 246, 0.15)',
    bgSubtle: 'rgba(59, 130, 246, 0.08)',
    text: '#60A5FA',
    main: '#3B82F6',
    dark: '#2563EB',
  },

  // Cards (elevação = mais claro)
  card: {
    background: '#13161D',
    backgroundPressed: '#1A1E27',
    border: '#2A2E38',
  },

  // Tab Bar
  tabBar: {
    background: '#0B0D11',
    border: '#1A1E27',
    active: '#34D399',
    inactive: '#6B7280',
  },

  // Inputs
  input: {
    background: '#13161D',
    border: '#2A2E38',
    borderFocus: '#34D399',
    placeholder: '#6B7280',
    text: '#F1F5F9',
  },

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayInner: 'rgba(255, 255, 255, 0.15)',

  // Skeleton
  skeleton: {
    base: '#1A1E27',
    highlight: '#2A2E38',
  },

  // Switch
  switch: {
    trackOff: '#4B5563',
    trackOn: '#0A7B4E',
    thumbOff: '#9CA3AF',
    thumbOn: '#34D399',
  },

  // Status cards (dashboard)
  status: {
    seguras: { bg: 'rgba(52, 211, 153, 0.15)', text: '#34D399' },
    atencao: { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24' },
    expiradas: { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171' },
    criticas: { bg: 'rgba(249, 115, 22, 0.1)', text: '#FB923C' },
    alertas: { bg: 'rgba(236, 72, 153, 0.15)', text: '#F472B6' },
  },

  // Progress bar
  progress: {
    bg: '#2A2E38',
    safe: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
  },

  // Tags (experience quality)
  tag: {
    positive: { bg: 'rgba(52, 211, 153, 0.15)', text: '#34D399', border: 'rgba(52, 211, 153, 0.3)' },
    negative: { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },
  },

  // CTA buttons
  cta: {
    primary: '#34D399',
    secondary: 'rgba(52, 211, 153, 0.15)',
    disabled: '#2A2E38',
    disabledText: '#6B7280',
  },

  // Bottom sheet
  sheet: {
    handle: '#4B5563',
    bg: '#13161D',
  },

  // Premium badge
  badge: {
    premium: '#A78BFA',
    premiumLight: 'rgba(124, 58, 237, 0.2)',
  },

  // Divider
  divider: '#1A1E27',

  // Premium (Referral/Premium UI)
  premium: {
    bg: 'rgba(124, 58, 237, 0.15)',
    bgSubtle: 'rgba(139, 92, 246, 0.08)',
    text: '#C4B5FD',
    main: '#A78BFA',
    dark: '#7C3AED',
    border: 'rgba(139, 92, 246, 0.15)',
  },

  // Splash screen
  splash: {
    bg: '#0C1A14',
    title: '#F0FDF4',
    subtitle: 'rgba(240, 253, 244, 0.5)',
  },

  // Toast (overlay UI — same both themes)
  toast: {
    bg: '#1F2937',
    text: '#FFFFFF',
    action: '#60A5FA',
  },

  // Pill (status pills, labels, muted text)
  pill: {
    label: 'rgba(255, 255, 255, 0.40)',
    muted: 'rgba(255, 255, 255, 0.45)',
    subtle: 'rgba(255, 255, 255, 0.25)',
  },

  // Travel / Bagagem (Modo Viagem)
  travel: {
    main: '#818CF8',
    light: '#A5B4FC',
    dark: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.15)',
    bgSubtle: 'rgba(99, 102, 241, 0.08)',
    text: '#C7D2FE',
    border: 'rgba(99, 102, 241, 0.3)',
  },

  // Gamification — Tier colors
  tier: {
    bronze: { main: '#CD7F32', light: '#E8B86D', bg: '#261A08', glow: '#F0C878', text: '#CD7F32' },
    prata: { main: '#B0BEC5', light: '#E0E7EC', bg: '#1A1E27', glow: '#F0F4F8', text: '#B0BEC5' },
    ouro: { main: '#FBBF24', light: '#FDE68A', bg: '#2D2308', glow: '#FEF3C7', text: '#FBBF24' },
    platina: { main: '#C084FC', light: '#E0BBFF', bg: '#1E1536', glow: '#EDD6FF', text: '#C084FC' },
    diamante: { main: '#38BDF8', light: '#7DD3FC', bg: '#1E2A4A', glow: '#BAE6FD', text: '#38BDF8' },
  },
  xpBar: { bg: '#252A36', fill: '#34D399' },
  streak: { bg: '#2D2308', text: '#FBBF24' },
  badgeLocked: { bg: '#252A36', text: '#64748B' },

  // No shadows in dark mode
  shadow: false as const,
} as const;

// Widen literal string/boolean types so light and dark are assignable
type Widen<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends boolean
    ? boolean
    : T[K] extends object
    ? Widen<T[K]>
    : T[K];
};

export type ThemeColors = Widen<typeof lightColors>;

export const themes = {
  light: lightColors,
  dark: darkColors,
} as const;
