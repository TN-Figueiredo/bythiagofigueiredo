// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import {
  RECONNECT_CTA,
  kindFrom,
  oauthErrorText,
  previewDisabledText,
} from '@/lib/instagram/status-text'

// Exaustividade em typecheck: se um código novo entrar no union e não entrar
// aqui, `Missing` deixa de ser `never` e o typecheck do arquivo quebra.
const ALL_CODES = [
  'not_configured', 'vault_unavailable', 'account_not_found', 'exchange_failed',
  'origin_not_allowed', 'invalid_state', 'session_changed', 'permission_denied',
  'cancelled', 'identity_invalid', 'write_failed', 'cross_origin', 'browser_changed',
] as const satisfies readonly OauthErrorCode[]
type Missing = Exclude<OauthErrorCode, (typeof ALL_CODES)[number]>
const _exhaustive: Missing extends never ? true : false = true
void _exhaustive

describe('kindFrom', () => {
  it('token_error nulo => transient', () => {
    expect(kindFrom({ token_error: null })).toBe('transient')
    expect(kindFrom({})).toBe('transient')
  })
  it("'expired' => expired", () => {
    expect(kindFrom({ token_error: 'expired' })).toBe('expired')
  })
  it("'deauthorized' e 'data_deletion_requested' => revoked", () => {
    expect(kindFrom({ token_error: 'deauthorized' })).toBe('revoked')
    expect(kindFrom({ token_error: 'data_deletion_requested' })).toBe('revoked')
  })
  it('qualquer outro motivo => invalid', () => {
    expect(kindFrom({ token_error: 'decrypt_failed' })).toBe('invalid')
    expect(kindFrom({ token_error: 'The session has been invalidated' })).toBe('invalid')
  })
})

describe('oauthErrorText', () => {
  it('devolve uma frase humana para TODOS os códigos, nunca undefined', () => {
    for (const code of ALL_CODES) {
      const text = oauthErrorText(code)
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(10)
    }
  })

  it('usa os textos canônicos do mapa de §3.1', () => {
    expect(oauthErrorText('not_configured'))
      .toBe("Instagram OAuth isn't configured yet — see the setup runbook")
    expect(oauthErrorText('vault_unavailable'))
      .toBe("Token storage isn't configured — see the Instagram setup runbook")
    expect(oauthErrorText('account_not_found'))
      .toBe('This Instagram account no longer exists — reload the page')
    expect(oauthErrorText('origin_not_allowed'))
      .toBe("This domain isn't allowed for Instagram authorization")
    expect(oauthErrorText('invalid_state'))
      .toBe('Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS')
    expect(oauthErrorText('session_changed'))
      .toBe('Session changed during authorization — sign in and try again')
    expect(oauthErrorText('permission_denied'))
      .toBe('Instagram did not grant the required permission')
    expect(oauthErrorText('cancelled')).toBe('Authorization cancelled')
    expect(oauthErrorText('identity_invalid'))
      .toBe('Instagram returned an unexpected account identity')
    expect(oauthErrorText('write_failed'))
      .toBe("Couldn't save the connection — try again in a minute")
    expect(oauthErrorText('cross_origin'))
      .toBe('This page must be opened from the CMS — go back and click Connect again')
    expect(oauthErrorText('browser_changed'))
      .toBe('Authorization finished in a different browser. Open the CMS in Safari or Chrome (not inside another app) and try again.')
  })

  it('exchange_failed é a frase SECA — o "(code N)" é anexado pelo call-site', () => {
    expect(oauthErrorText('exchange_failed')).toBe('Instagram rejected the authorization')
    expect(oauthErrorText('exchange_failed')).not.toContain('(')
  })
})

describe('previewDisabledText', () => {
  it('é a frase de preview', () => {
    expect(previewDisabledText())
      .toBe('Instagram authorization is disabled on preview deployments — use production.')
  })
})

describe('RECONNECT_CTA', () => {
  // Fixado POR COMMIT: C3 troca esta asserção para 'reconnect' no mesmo commit
  // que troca a constante. Aceitar as duas formas não ratcheta nada.
  it("em C2 é exatamente 'paste a new token'", () => {
    expect(RECONNECT_CTA).toBe('paste a new token')
  })
})

describe('status-text é isomórfico', () => {
  it('não importa nada de runtime (só import type)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      new URL('../../src/lib/instagram/status-text.ts', import.meta.url),
      'utf8',
    )
    const runtimeImports = src
      .split('\n')
      .filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l))
    expect(runtimeImports).toEqual([])
  })
})
