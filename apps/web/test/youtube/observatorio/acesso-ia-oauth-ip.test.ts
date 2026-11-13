// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashDoIp } from '../../../src/lib/youtube/observatorio/acesso-ia/oauth/ip'

const SEG = Buffer.from('segredo-de-teste-segredo-de-teste')
const DIA1 = Date.UTC(2026, 10, 13, 10)
const DIA2 = Date.UTC(2026, 10, 14, 10)
const req = (xff?: string) => new Request('https://x.test/', { headers: xff === undefined ? {} : { 'x-forwarded-for': xff } })

describe('hashDoIp', () => {
  it('mesmo IP e dia = mesmo hash; outro dia = outro', () => {
    expect(hashDoIp(req('1.2.3.4'), SEG, DIA1)).toBe(hashDoIp(req('1.2.3.4'), SEG, DIA1 + 3600_000))
    expect(hashDoIp(req('1.2.3.4'), SEG, DIA1)).not.toBe(hashDoIp(req('1.2.3.4'), SEG, DIA2))
    expect(hashDoIp(req('1.2.3.4'), SEG, DIA1)).toMatch(/^[0-9a-f]{64}$/)
  })
  it('usa só o 1º salto', () => {
    expect(hashDoIp(req('1.2.3.4, 9.9.9.9'), SEG, DIA1)).toBe(hashDoIp(req('1.2.3.4, 8.8.8.8'), SEG, DIA1))
  })
  it('IPv6 do mesmo /64 = mesmo hash, comprimido ou expandido', () => {
    expect(hashDoIp(req('2001:db8::1'), SEG, DIA1)).toBe(hashDoIp(req('2001:0db8:0000:0000:ffff::2'), SEG, DIA1))
    expect(hashDoIp(req('2001:db8::1'), SEG, DIA1)).not.toBe(hashDoIp(req('2001:db8:0:1::1'), SEG, DIA1))
  })
  it('sem x-forwarded-for ou ilegível = hash de sem-ip, estável, sem lançar', () => {
    const a = hashDoIp(req(), SEG, DIA1)
    expect(a).toBe(hashDoIp(req('lixo'), SEG, DIA1))
    expect(a).toBe(hashDoIp(req(''), SEG, DIA1))
    expect(a).not.toBe(hashDoIp(req('1.2.3.4'), SEG, DIA1))
  })
})
