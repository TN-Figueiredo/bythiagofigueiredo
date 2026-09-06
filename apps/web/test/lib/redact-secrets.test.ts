// @vitest-environment node
// Canária de §4: a redação é dirigida por NOME DE PARÂMETRO, nunca pela forma
// do valor — o token de 60 d da Meta viaja em query string (api-client.ts:56,76,83)
// e chega ao Sentry pelo breadcrumb undici (`data.url`). Apostar no prefixo `IG…`
// é a única premissa Meta-dependente sem gate empírico; ele fica só como 2ª rede.
import { describe, it, expect } from 'vitest'
import { redactSecrets, registerSecretLiteral } from '@/lib/redact-secrets'

const SIXTY_FOUR = 'a'.repeat(64)

describe('redactSecrets — query string por nome de parâmetro', () => {
  it('redige access_token numa URL, sem depender do prefixo IG', () => {
    const url = `https://graph.instagram.com/v25.0/me?fields=id&access_token=${SIXTY_FOUR}`
    const out = redactSecrets(url)
    expect(out).toContain('access_token=[REDACTED]')
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out).toContain('fields=id')
  })

  it.each(['client_secret', 'code', 'signed_request', 'state', 'rebind'])(
    'redige %s em query string',
    (param) => {
      const out = redactSecrets(`https://x.test/cb?${param}=${SIXTY_FOUR}&keep=1`)
      expect(out).toContain(`${param}=[REDACTED]`)
      expect(out).not.toContain(SIXTY_FOUR)
      expect(out).toContain('keep=1')
    },
  )

  it('redige a forma nua no meio de uma mensagem de exceção', () => {
    const out = redactSecrets(`upstream rejected access_token=${SIXTY_FOUR} for /me`)
    expect(out).toContain('access_token=[REDACTED]')
    expect(out).not.toContain(SIXTY_FOUR)
  })

  it('redige a forma nua ancorada em início de string', () => {
    const out = redactSecrets(`access_token=${SIXTY_FOUR}`)
    expect(out).toBe('access_token=[REDACTED]')
  })
})

describe('redactSecrets — forma de atribuição/JSON', () => {
  it('redige um corpo de troca de código ecoado', () => {
    const body = `{"access_token":"${SIXTY_FOUR}","token_type":"bearer"}`
    const out = redactSecrets(body)
    expect(out).toContain('"access_token":"[REDACTED]"')
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out).toContain('"token_type":"bearer"')
  })

  it('redige client_secret e signed_request em atribuição', () => {
    const out = redactSecrets(`client_secret: ${SIXTY_FOUR}, signed_request = ${SIXTY_FOUR}`)
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out.match(/\[REDACTED\]/g)).toHaveLength(2)
  })
})

describe('redactSecrets — 2ª rede: prefixo IG fora de query string', () => {
  it('redige um token IG solto', () => {
    const tok = `IGQVJ${'X'.repeat(40)}`
    expect(redactSecrets(`stored token ${tok} failed`)).not.toContain(tok)
  })

  it('não toca palavras curtas que começam com IG', () => {
    expect(redactSecrets('IGNORE this IG line')).toBe('IGNORE this IG line')
  })
})

describe('registerSecretLiteral', () => {
  it('é no-op para valores com menos de 16 caracteres', () => {
    registerSecretLiteral('short')
    expect(redactSecrets('the word short stays')).toBe('the word short stays')
  })

  it('é no-op para undefined', () => {
    registerSecretLiteral(undefined)
    expect(redactSecrets('nothing changes')).toBe('nothing changes')
  })

  it('redige todas as ocorrências de um literal registrado', () => {
    const secret = 'sup3r-s3cret-value-0123456789'
    registerSecretLiteral(secret)
    expect(redactSecrets(`a=${secret} b=${secret}`)).toBe('a=[REDACTED] b=[REDACTED]')
  })

  it('escapa metacaracteres de regex no literal', () => {
    const secret = 'a+b.c*d(efg)hij12345'
    registerSecretLiteral(secret)
    expect(redactSecrets(`k=${secret}`)).toBe('k=[REDACTED]')
    // O literal escapado NÃO vira um padrão que casa outra coisa.
    expect(redactSecrets('k=aab_cddefghij12345')).toBe('k=aab_cddefghij12345')
  })

  it('deduplica registros repetidos (uma substituição, não duas)', () => {
    const secret = 'dup-literal-0123456789'
    registerSecretLiteral(secret)
    registerSecretLiteral(secret)
    expect(redactSecrets(`v=${secret}`)).toBe('v=[REDACTED]')
  })
})

describe('redactSecrets — idempotência', () => {
  it('rodar duas vezes não altera o resultado', () => {
    const once = redactSecrets(`https://x.test/a?access_token=${SIXTY_FOUR}`)
    expect(redactSecrets(once)).toBe(once)
  })
})
