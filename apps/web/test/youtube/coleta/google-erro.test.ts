// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ehPerdaDeAutorizacao, motivoDoGoogle } from '@/lib/youtube/coleta/google-erro'

const resposta = (corpo: unknown, status = 403) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status })

describe('google-erro', () => {
  it('motivoDoGoogle lê o formato antigo (errors[]) e o novo (details[])', async () => {
    expect(await motivoDoGoogle(resposta({ error: { errors: [{ reason: 'insufficientPermissions' }] } }))).toBe('insufficientPermissions')
    expect(await motivoDoGoogle(resposta({ error: { details: [{}, { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }))).toBe('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
  })

  it('motivoDoGoogle devolve nulo para corpo vazio, não-JSON ou sem reason', async () => {
    expect(await motivoDoGoogle(resposta(''))).toBeNull()
    expect(await motivoDoGoogle(resposta('<html>'))).toBeNull()
    expect(await motivoDoGoogle(resposta({ error: { message: 'x' } }))).toBeNull()
  })

  it.each([
    [401, null, true],
    [401, 'qualquer', true],
    [403, 'insufficientPermissions', true],
    [403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', true],
    [403, 'quotaExceeded', false],
    [403, null, false],
    [500, null, false],
    [404, 'insufficientPermissions', false],
  ])('ehPerdaDeAutorizacao(%s, %s) = %s', (status, reason, esperado) => {
    expect(ehPerdaDeAutorizacao(status, reason)).toBe(esperado)
  })
})
