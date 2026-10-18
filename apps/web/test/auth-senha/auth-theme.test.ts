// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { AUTH_THEME, buildAuthTheme, contrastWithWhite } from '../../lib/auth/auth-theme'

describe('auth-theme', () => {
  it('sem primary_color usa os tokens do produto', () => {
    expect(buildAuthTheme(null)).toEqual(AUTH_THEME)
    expect(AUTH_THEME.accent).toBe('var(--auth-accent-solid)')
    expect(AUTH_THEME.border).toBe('var(--auth-field-border)')
  })
  it('nao usa color-mix', () => {
    expect(JSON.stringify(AUTH_THEME)).not.toContain('color-mix')
  })
  it('primary_color escuro o bastante (>=4,5:1) vira acento', () => {
    expect(contrastWithWhite('#B94210')).toBeGreaterThanOrEqual(4.5)
    expect(buildAuthTheme('#B94210').accent).toBe('#B94210')
  })
  it('primary_color claro demais e ignorado', () => {
    expect(buildAuthTheme('#FFCC00')).toEqual(AUTH_THEME)
  })
  it('primary_color invalido e ignorado', () => {
    expect(buildAuthTheme('red')).toEqual(AUTH_THEME)
  })
})
