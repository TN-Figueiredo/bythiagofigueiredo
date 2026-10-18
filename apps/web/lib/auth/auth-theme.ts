/**
 * Tema comum das 6 telas de entrada (cms|admin x login|forgot|reset).
 * Aponta para variáveis do produto; o tema claro/escuro troca por `data-theme`
 * sem ler cookie. Valores em hex literal em globals.css (sem color-mix, Opera).
 */
export const AUTH_THEME = {
  bg: 'var(--theme-cms-bg)',
  card: 'var(--theme-cms-surface)',
  text: 'var(--theme-cms-text)',
  muted: 'var(--theme-cms-text-muted)',
  border: 'var(--auth-field-border)',
  accent: 'var(--auth-accent-solid)',
  accentHover: 'var(--auth-accent-solid)',
}

export type AuthThemeProps = typeof AUTH_THEME

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

/** `primary_color` do site só vale se o texto branco do botão tiver 4,5:1. */
export function buildAuthTheme(primaryColor?: string | null): AuthThemeProps {
  if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor) && contrastWithWhite(primaryColor) >= 4.5) {
    return { ...AUTH_THEME, accent: primaryColor, accentHover: primaryColor }
  }
  return { ...AUTH_THEME }
}
