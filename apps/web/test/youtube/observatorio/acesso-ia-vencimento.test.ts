// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 14: o vencimento da chave do perfil. A conferência com data (14 dias antes de vencer) e a regra de renovar sem buraco.
 * Puro. Datas relativas a um instante fixo de 2026; nada de ano futuro escrito à mão.
 */
import { describe, expect, it } from 'vitest'
import { conferenciaDeVencimento, podeRenovar } from '@/lib/youtube/observatorio/acesso-ia/vencimento'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'

const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const DIA = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
const NOME = 'observatorio-20261013-ab12'

describe('conferenciaDeVencimento', () => {
  it('a data da conferência é absoluta, no formato AAAA-MM-DD, 14 dias antes do vencimento (dia de São Paulo)', () => {
    const c = conferenciaDeVencimento(NOME, '2026-11-12T15:00:00.000Z')
    expect(c).not.toBeNull()
    expect(c!.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(c!.data).toBe('2026-10-29')
  })

  it('o antecedente é o do plano (avisoDeVencimentoDias), não um número solto', () => {
    expect(ACESSO_IA_RULES.avisoDeVencimentoDias).toBe(14)
    expect(conferenciaDeVencimento(NOME, '2026-11-12T15:00:00.000Z')!.data).toBe('2026-10-29')
  })

  it('vencimento à 01:00 UTC: o dia de São Paulo é o anterior (22:00), então a data sai um dia antes', () => {
    expect(conferenciaDeVencimento(NOME, '2026-11-12T01:00:00.000Z')!.data).toBe('2026-10-28')
    expect(conferenciaDeVencimento(NOME, '2026-11-12T03:00:00.000Z')!.data).toBe('2026-10-29')
    expect(conferenciaDeVencimento(NOME, '2026-11-12T02:59:59.000Z')!.data).toBe('2026-10-28')
  })

  it('atravessa a virada de mês e de ano', () => {
    expect(conferenciaDeVencimento(NOME, '2026-12-05T12:00:00.000Z')!.data).toBe('2026-11-21')
    expect(conferenciaDeVencimento(NOME, '2026-12-20T12:00:00.000Z')!.data).toBe('2026-12-06')
    expect(conferenciaDeVencimento(NOME, '2026-01-05T12:00:00.000Z')!.data).toBe('2025-12-22')
  })

  it('o responsável é o dono, o identificador carrega o nome da chave e a conferência nasce por fazer', () => {
    const c = conferenciaDeVencimento(NOME, '2026-11-12T15:00:00.000Z')!
    expect(c.responsavel).toBe('dono')
    expect(c.id).toBe(`e17d2-chave-${NOME}-vence`)
    expect(c.feitaEm).toBeNull()
    expect(c.etapa).toMatch(/^E\d+$/)
    expect(c.onde).toContain(NOME)
  })

  it.each([
    ['vazia', ''],
    ['texto', 'amanhã'],
    ['só a data', '2026-11-12'],
    ['sem fuso', '2026-11-12T15:00:00'],
    ['data impossível', '2026-02-30T15:00:00.000Z'],
  ])('expires_at %s: null, nunca uma conferência com data inventada', (_n, expiresAt) => {
    expect(conferenciaDeVencimento(NOME, expiresAt)).toBeNull()
  })

  it('aceita o formato que o banco devolve (+00:00, com seis casas de fração)', () => {
    expect(conferenciaDeVencimento(NOME, '2026-11-12T15:00:00+00:00')!.data).toBe('2026-10-29')
    expect(conferenciaDeVencimento(NOME, '2026-11-12T15:00:00.123456+00:00')!.data).toBe('2026-10-29')
  })

  it.each([
    ['com e-mail', 'maria@exemplo.com'],
    ['com @', 'observatorio-20261013-ab@2'],
    ['com espaço', 'observatorio 20261013 ab12'],
    ['a parte local do e-mail', 'maria'],
    ['sufixo curto', 'observatorio-20261013-ab1'],
    ['sufixo longo', 'observatorio-20261013-ab123'],
    ['sufixo fora de hexadecimal', 'observatorio-20261013-zzzz'],
    ['maiúsculas', 'Observatorio-20261013-ab12'],
    ['data impossível no nome', 'observatorio-20261345-ab12'],
    ['vazio', ''],
    ['com texto depois', 'observatorio-20261013-ab12-maria'],
  ])('nome fora da forma (%s): null (o identificador vai ao git e não pode carregar dado pessoal)', (_n, nome) => {
    expect(conferenciaDeVencimento(nome, '2026-11-12T15:00:00.000Z')).toBeNull()
  })
})

describe('podeRenovar', () => {
  it('faltam 14 dias: sim; 14 dias e 1 ms: não; 15: não (fronteira)', () => {
    expect(podeRenovar(iso(AGORA + 14 * DIA), AGORA)).toBe(true)
    expect(podeRenovar(iso(AGORA + 14 * DIA + 1), AGORA)).toBe(false)
    expect(podeRenovar(iso(AGORA + 15 * DIA), AGORA)).toBe(false)
  })

  it('faltam 0 dias: sim; já vencida: sim (chave vencida não trava a nova)', () => {
    expect(podeRenovar(iso(AGORA), AGORA)).toBe(true)
    expect(podeRenovar(iso(AGORA - 1), AGORA)).toBe(true)
    expect(podeRenovar(iso(AGORA - 100 * DIA), AGORA)).toBe(true)
  })

  it('faltam 13 dias: sim; 180 dias: não', () => {
    expect(podeRenovar(iso(AGORA + 13 * DIA), AGORA)).toBe(true)
    expect(podeRenovar(iso(AGORA + 180 * DIA), AGORA)).toBe(false)
  })

  it('expires_at inválida ou vazia: não renova (não se adivinha a validade)', () => {
    expect(podeRenovar('', AGORA)).toBe(false)
    expect(podeRenovar('amanhã', AGORA)).toBe(false)
    expect(podeRenovar('2026-11-12', AGORA)).toBe(false)
  })

  it('agora inválido (NaN, infinito): não renova', () => {
    expect(podeRenovar(iso(AGORA + DIA), Number.NaN)).toBe(false)
    expect(podeRenovar(iso(AGORA + DIA), Number.POSITIVE_INFINITY)).toBe(false)
  })
})
