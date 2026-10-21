// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { devidosDoFechamento, devidosDoLembrete, emEsperaDoLembrete, type LinhaAviso } from '@/lib/youtube/teste-youtube/nativo/avisos'

const AGORA = new Date('2026-12-20T12:00:00.000Z')
const dias = (n: number, de: Date = AGORA): string => new Date(de.getTime() - n * 86_400_000).toISOString()
const h = (n: number, de: Date = AGORA): string => new Date(de.getTime() - n * 3_600_000).toISOString()
const linha = (o: Partial<LinhaAviso> = {}): LinhaAviso => ({
  id: 'r1', estado: 'em_andamento', primeira_vista: dias(14), confirmado_em: dias(14), created_at: dias(30),
  resposta_dono: null, lembrete_notificado_em: null, notificacao_falhou_em: null, notificacao_tentativas: 0, ...o,
})

describe('devidosDoLembrete', () => {
  it('13 d 23 h não; 14 d sim', () => {
    expect(devidosDoLembrete([linha({ primeira_vista: h(14 * 24 - 1), confirmado_em: h(14 * 24 - 1) })], AGORA)).toEqual([])
    expect(devidosDoLembrete([linha()], AGORA)).toEqual(['r1'])
  })
  it('detectado não confirmado: nenhuma; descartado: nenhuma', () => {
    expect(devidosDoLembrete([linha({ confirmado_em: null })], AGORA)).toEqual([])
    expect(devidosDoLembrete([linha({ estado: 'descartado' })], AGORA)).toEqual([])
  })
  it('respondido, já lembrado ou falho: nenhuma', () => {
    expect(devidosDoLembrete([linha({ resposta_dono: 'ficou_igual' })], AGORA)).toEqual([])
    expect(devidosDoLembrete([linha({ lembrete_notificado_em: h(1) })], AGORA)).toEqual([])
    expect(devidosDoLembrete([linha({ notificacao_falhou_em: h(1) })], AGORA)).toEqual([])
  })
  it('encerrado e sem_desfecho sem resposta também lembram', () => {
    expect(devidosDoLembrete([linha({ estado: 'encerrado' }), linha({ id: 'r2', estado: 'sem_desfecho' })], AGORA)).toEqual(['r1', 'r2'])
  })
  it('sem corte por created_at: criada antes da migration, confirmada depois, lembra (Phil M6)', () => {
    expect(devidosDoLembrete([linha({ created_at: dias(400) })], AGORA)).toEqual(['r1'])
  })
  it('detecção há 20 dias, confirmada hoje: lembra hoje (início = o menor entre primeira_vista e confirmado_em)', () => {
    expect(devidosDoLembrete([linha({ primeira_vista: dias(20), confirmado_em: AGORA.toISOString() })], AGORA)).toEqual(['r1'])
  })
})

describe('uma tentativa por dia, contada de max(inicio + 14 d, confirmado_em)', () => {
  const mais = (d: number, ms = 0): Date => new Date(AGORA.getTime() + d * 86_400_000 + ms)
  it('tentativa n só a partir do dia base + n', () => {
    const l = (n: number) => linha({ notificacao_tentativas: n })
    expect(devidosDoLembrete([l(1)], AGORA)).toEqual([])
    expect(devidosDoLembrete([l(1)], mais(1, -1))).toEqual([])
    expect(devidosDoLembrete([l(1)], mais(1))).toEqual(['r1'])
    expect(devidosDoLembrete([l(2)], mais(1, 23 * 3_600_000))).toEqual([])
    expect(devidosDoLembrete([l(2)], mais(2))).toEqual(['r1'])
  })
  it('confirmada tarde (início há 20 d, confirmada hoje): a base é a confirmação', () => {
    const l = linha({ primeira_vista: dias(20), confirmado_em: AGORA.toISOString(), notificacao_tentativas: 1 })
    expect(devidosDoLembrete([l], mais(1, -1))).toEqual([])
    expect(devidosDoLembrete([l], mais(1))).toEqual(['r1'])
  })
  it('emEsperaDoLembrete conta só quem já tentou e ainda não pode', () => {
    expect(emEsperaDoLembrete([linha({ notificacao_tentativas: 1 }), linha({ id: 'r2' })], AGORA)).toBe(1)
    expect(emEsperaDoLembrete([linha({ notificacao_tentativas: 1 })], mais(1))).toBe(0)
  })
})

describe('devidosDoFechamento', () => {
  it('16 d e lembrete enviado há 2 d: fecha; lembrete há 1 d 23 h: não', () => {
    const base = { primeira_vista: dias(16), confirmado_em: dias(16) }
    expect(devidosDoFechamento([linha({ ...base, lembrete_notificado_em: dias(2) })], AGORA)).toEqual(['r1'])
    expect(devidosDoFechamento([linha({ ...base, lembrete_notificado_em: h(2 * 24 - 1) })], AGORA)).toEqual([])
  })
  it('15 d 23 h: não, mesmo com lembrete antigo', () => {
    const base = { primeira_vista: h(16 * 24 - 1), confirmado_em: h(16 * 24 - 1) }
    expect(devidosDoFechamento([linha({ ...base, lembrete_notificado_em: dias(5) })], AGORA)).toEqual([])
  })
  it('nunca fecha pergunta que não saiu: sem lembrete e sem falha, não', () => {
    expect(devidosDoFechamento([linha({ primeira_vista: dias(30), confirmado_em: dias(30) })], AGORA)).toEqual([])
  })
  it('lembrete que falhou 3 vezes (notificacao_falhou_em) fecha', () => {
    expect(devidosDoFechamento([linha({ primeira_vista: dias(16), confirmado_em: dias(16), notificacao_falhou_em: h(1) })], AGORA)).toEqual(['r1'])
  })
  it('detecção há 20 dias e confirmação hoje: lembrete hoje, fechamento só daqui a 2 dias', () => {
    const conf = { primeira_vista: dias(20), confirmado_em: AGORA.toISOString() }
    expect(devidosDoFechamento([linha({ ...conf, lembrete_notificado_em: AGORA.toISOString() })], AGORA)).toEqual([])
    const daqui2 = new Date(AGORA.getTime() + 2 * 86_400_000)
    expect(devidosDoFechamento([linha({ ...conf, lembrete_notificado_em: AGORA.toISOString() })], daqui2)).toEqual(['r1'])
  })
  it('só em_andamento, só sem resposta, só confirmada', () => {
    const base = { primeira_vista: dias(20), confirmado_em: dias(20), lembrete_notificado_em: dias(5) }
    expect(devidosDoFechamento([linha({ ...base, estado: 'encerrado' })], AGORA)).toEqual([])
    expect(devidosDoFechamento([linha({ ...base, resposta_dono: 'nao_vi' })], AGORA)).toEqual([])
    expect(devidosDoFechamento([linha({ ...base, confirmado_em: null })], AGORA)).toEqual([])
  })
})
