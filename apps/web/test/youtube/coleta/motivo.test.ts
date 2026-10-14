// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  REASONS_CONHECIDOS, MOTIVOS_FIXOS, ehMotivo, motivoDoErro, textoDoMotivo,
} from '@/lib/youtube/coleta/motivo'
import { AnalyticsApiError } from '@/lib/youtube/coleta/analytics-diario'

const TEXTO_DO_GOOGLE = 'The request cannot be completed (dado de terceiro) <script>alert(1)</script>'

describe('motivoDoErro', () => {
  it('AnalyticsApiError(403, quotaExceeded) → http_403_quotaExceeded', () => {
    expect(motivoDoErro(new AnalyticsApiError(403, 'quotaExceeded'))).toBe('http_403_quotaExceeded')
  })
  it('reason conhecido vai junto; o texto qualquer do Google não passa', () => {
    expect(motivoDoErro(new AnalyticsApiError(404, 'notFound'))).toBe('http_404_notFound')
    expect(motivoDoErro(new AnalyticsApiError(400, TEXTO_DO_GOOGLE))).toBe('http_400')
    expect(motivoDoErro(new AnalyticsApiError(500, null))).toBe('http_500')
    expect(motivoDoErro(new AnalyticsApiError(429, ''))).toBe('http_429')
  })
  it('reason de cota fora da lista vira http_<status>_quotaExceeded (o texto não passa)', () => {
    for (const reason of ['limitExceeded', 'concurrentLimitExceeded', 'someQuotaExceededThing', 'LIMITEXCEEDED']) {
      const m = motivoDoErro(new AnalyticsApiError(403, reason))
      expect(m).toBe('http_403_quotaExceeded')
      expect(ehMotivo(m)).toBe(true)
    }
    expect(motivoDoErro(new AnalyticsApiError(429, 'x'.repeat(5000) + 'quotaExceeded'))).toBe('http_429_quotaExceeded')
  })
  it('reason conhecido de limite mantém o próprio nome (não vira quotaExceeded)', () => {
    expect(motivoDoErro(new AnalyticsApiError(403, 'rateLimitExceeded'))).toBe('http_403_rateLimitExceeded')
    expect(motivoDoErro(new AnalyticsApiError(403, 'userRateLimitExceeded'))).toBe('http_403_userRateLimitExceeded')
    expect(motivoDoErro(new AnalyticsApiError(403, 'dailyLimitExceeded'))).toBe('http_403_dailyLimitExceeded')
  })
  it('reason gigante ou com texto livre: só o status', () => {
    expect(motivoDoErro(new AnalyticsApiError(403, 'a'.repeat(100_000)))).toBe('http_403')
    expect(motivoDoErro(new AnalyticsApiError(502, 'bad gateway: tente de novo'))).toBe('http_502')
  })
  it("AnalyticsApiError(200, 'forma_inesperada') e 'corpo_invalido' viram o próprio código", () => {
    expect(motivoDoErro(new AnalyticsApiError(200, 'forma_inesperada'))).toBe('forma_inesperada')
    expect(motivoDoErro(new AnalyticsApiError(200, 'corpo_invalido'))).toBe('corpo_invalido')
    expect(motivoDoErro(new AnalyticsApiError(0, 'forma_inesperada'))).toBe('forma_inesperada')
  })
  it('status fora de 100 a 599 ou não inteiro: excecao, nunca um código inventado', () => {
    for (const s of [0, 99, 600, 1000, -1, 404.5, Number.NaN]) {
      expect(motivoDoErro(new AnalyticsApiError(s, 'quotaExceeded'))).toBe('excecao')
    }
  })
  it('erro comum: excecao, e a mensagem não aparece na saída', () => {
    const m = motivoDoErro(new Error('duplicate key value violates … (dado de terceiro)'))
    expect(m).toBe('excecao')
    expect(JSON.stringify([m, textoDoMotivo(m)])).not.toMatch(/duplicate|terceiro/)
  })
  it('erro de banco (objeto com code e message, como o que conferirBanco recusa) → erro_de_banco', () => {
    expect(motivoDoErro({ code: '23505', message: 'duplicate key (dado de terceiro)' })).toBe('erro_de_banco')
    expect(motivoDoErro({ code: null, message: 'x' })).toBe('erro_de_banco')
    expect(motivoDoErro({ code: 'PGRST202', message: null })).toBe('erro_de_banco')
  })
  it('erro sem status e sem reason, e entradas estranhas: excecao', () => {
    for (const e of [{}, { reason: 'quotaExceeded' }, { status: 403 }, null, undefined, 'texto', 42, [], Symbol('x'), () => 1]) {
      expect(motivoDoErro(e)).toBe('excecao')
    }
  })
  it('Error de sistema com code (ECONNRESET) não é erro de banco', () => {
    const e = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    expect(motivoDoErro(e)).toBe('excecao')
  })
})

describe('ehMotivo', () => {
  it('aceita os fixos, http_<status> e http_<status>_<reason conhecido>', () => {
    for (const m of MOTIVOS_FIXOS) expect(ehMotivo(m)).toBe(true)
    expect(ehMotivo('http_500')).toBe(true)
    expect(ehMotivo('http_100')).toBe(true)
    expect(ehMotivo('http_599')).toBe(true)
    for (const r of REASONS_CONHECIDOS) expect(ehMotivo(`http_403_${r}`)).toBe(true)
  })
  it('recusa o resto', () => {
    for (const m of ['', 'http_', 'http_99', 'http_600', 'http_6000', 'http_403_', 'http_403_inventado', 'http_403_QuotaExceeded',
      'http_403_quotaExceeded ', ' http_403', 'Excecao', 'erro', 'http_403\n', 'http_403_quotaExceeded_x']) {
      expect(ehMotivo(m)).toBe(false)
    }
  })
  it('o catálogo tem os cinco fixos e os onze reasons do plano', () => {
    expect([...MOTIVOS_FIXOS]).toEqual(['erro_de_banco', 'forma_inesperada', 'corpo_invalido', 'retorno_inesperado', 'excecao'])
    expect([...REASONS_CONHECIDOS]).toEqual(['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded',
      'forbidden', 'insufficientPermissions', 'badRequest', 'invalid', 'notFound', 'backendError', 'internalError'])
  })
})

describe('textoDoMotivo', () => {
  it('textos fixos do plano', () => {
    expect(textoDoMotivo('http_403_quotaExceeded')).toBe('o YouTube recusou por cota (403)')
    expect(textoDoMotivo('http_500')).toBe('erro do YouTube (500)')
    expect(textoDoMotivo('forma_inesperada')).toBe('a resposta veio em forma inesperada')
    expect(textoDoMotivo('erro_de_banco')).toBe('erro de banco')
    expect(textoDoMotivo('excecao')).toBe('erro interno (detalhe no Sentry)')
  })
  it("textoDoMotivo('qualquer coisa') = 'erro não classificado'", () => {
    expect(textoDoMotivo('qualquer coisa')).toBe('erro não classificado')
    expect(textoDoMotivo('')).toBe('erro não classificado')
    expect(textoDoMotivo('http_999')).toBe('erro não classificado')
  })
  it('todo motivo que motivoDoErro devolve passa em ehMotivo, e o texto nunca é o código cru nem vazio (propriedade)', () => {
    const entradas: unknown[] = [
      new Error('x'), null, undefined, {}, 'texto', 7, { code: '1', message: 'm' }, { code: null, message: null },
      new AnalyticsApiError(200, 'forma_inesperada'), new AnalyticsApiError(200, 'corpo_invalido'), new AnalyticsApiError(999, 'x'),
      new AnalyticsApiError(404, null), new AnalyticsApiError(410, 'notFound'), new AnalyticsApiError(429, 'limitExceeded'),
      new AnalyticsApiError(403, TEXTO_DO_GOOGLE), new AnalyticsApiError(503, 'backendError'),
      ...REASONS_CONHECIDOS.map(r => new AnalyticsApiError(403, r)),
      ...[100, 199, 200, 301, 400, 401, 403, 404, 410, 429, 500, 502, 599].map(s => new AnalyticsApiError(s, null)),
    ]
    for (const e of entradas) {
      const m = motivoDoErro(e)
      expect(ehMotivo(m)).toBe(true)
      const t = textoDoMotivo(m)
      expect(t.trim()).not.toBe('')
      expect(t).not.toBe(m)
      expect(t).not.toMatch(/terceiro|script/)
    }
    for (const m of [...MOTIVOS_FIXOS, 'http_404', 'http_410', 'http_403_forbidden', ...REASONS_CONHECIDOS.map(r => `http_403_${r}`)]) {
      expect(textoDoMotivo(m)).not.toBe(m)
      expect(textoDoMotivo(m)).not.toBe('erro não classificado')
    }
  })
})
