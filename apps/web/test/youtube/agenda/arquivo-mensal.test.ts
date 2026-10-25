// apps/web/test/youtube/agenda/arquivo-mensal.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { avaliarArquivo, itensDoArquivo, lerArquivoParaVigia, MOTIVO_SEM_LEITURA, type LeituraArquivo } from '@/lib/youtube/agenda/arquivo-mensal'
import { buildCronHealthReport } from '@/lib/ops/cron-health-report'

const zero = (): LeituraArquivo => ({ atraso: { amarelos: 0, vermelhos: 0, meses_sem_selo: 0 }, vigia: { c1: 0, c2: 0, c3: 0, c4: 0 } })
const com = (f: (l: LeituraArquivo) => void): { valor: LeituraArquivo } => { const l = zero(); f(l); return { valor: l } }

describe('avaliarArquivo', () => {
  it('zero em tudo: verde', () => { expect(avaliarArquivo({ valor: zero() }).gravidade).toBe('verde') })
  it('atraso.amarelos = 1: amarelo', () => { expect(avaliarArquivo(com(l => { l.atraso.amarelos = 1 })).gravidade).toBe('amarelo') })
  it('atraso.vermelhos = 1: vermelho', () => { expect(avaliarArquivo(com(l => { l.atraso.vermelhos = 1 })).gravidade).toBe('vermelho') })
  it('meses_sem_selo = 1: amarelo (Phil I6)', () => { expect(avaliarArquivo(com(l => { l.atraso.meses_sem_selo = 1 })).gravidade).toBe('amarelo') })
  it.each(['c1', 'c2', 'c3', 'c4'] as const)('%s diferente de zero: vermelho com o número da consulta', k => {
    const r = avaliarArquivo(com(l => { l.vigia[k] = 2 }))
    expect(r.gravidade).toBe('vermelho')
    expect(r.motivo).toContain(k.slice(1))
  })
  it('sem leitura: vermelho, nunca verde', () => {
    expect(avaliarArquivo({ porque: 'x', causa: 'schema_ausente', codigo: '42883' })).toEqual({ gravidade: 'vermelho', motivo: MOTIVO_SEM_LEITURA, causa: 'schema_ausente' })
  })
  it.each(['prazo', 'excecao'] as const)('causa %s: amarelo (emenda M2 de 24/10)', causa => {
    expect(avaliarArquivo({ porque: 'x', causa }).gravidade).toBe('amarelo')
    expect(buildCronHealthReport([], new Date(), itensDoArquivo({ porque: 'x', causa })).status).toBe('degraded')
  })
  it.each(['schema_ausente', 'erro_do_banco', 'forma_invalida'] as const)('causa %s: vermelho', causa => {
    expect(avaliarArquivo({ porque: 'x', causa }).gravidade).toBe('vermelho')
  })
  it('sem causa informada: vermelho (conservador)', () => { expect(avaliarArquivo({ porque: 'x' }).gravidade).toBe('vermelho') })
})

describe('itensDoArquivo no relatório', () => {
  it('dois itens com os nomes do plano; vermelho derruba, amarelo degrada', () => {
    const v = itensDoArquivo(com(l => { l.vigia.c2 = 1 }))
    expect(v.map(i => i.nome)).toEqual(['arquivo_atraso_copia', 'arquivo_vigia_remocao'])
    expect(buildCronHealthReport([], new Date(), v).status).toBe('down')
    expect(buildCronHealthReport([], new Date(), itensDoArquivo(com(l => { l.atraso.amarelos = 1 }))).status).toBe('degraded')
    expect(buildCronHealthReport([], new Date(), itensDoArquivo({ valor: zero() })).status).not.toBe('down')
  })
})

type Resp = { data: unknown; error: { code: string } | null } | 'lanca'
const sb = (rpc: (fn: string) => Resp, sites: unknown = [{ id: 's1' }]): SupabaseClient => ({
  from: () => ({ select: () => ({ abortSignal: () => Promise.resolve({ data: sites, error: null }) }) }),
  rpc: (fn: string) => ({ abortSignal: () => { const r = rpc(fn); return r === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(r) } }),
}) as unknown as SupabaseClient
const boas = (fn: string): Resp => ({ data: fn === 'obs_archive_atraso' ? { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } : { c1: 0, c2: 0, c3: 0, c4: 0 }, error: null })

describe('lerArquivoParaVigia', () => {
  it('leitura certa com tudo zero: valor zero', async () => {
    expect(await lerArquivoParaVigia(sb(boas))).toEqual({ valor: zero() })
  })
  it('rpc com 42883: vermelho sem leitura', async () => {
    const l = await lerArquivoParaVigia(sb(() => ({ data: null, error: { code: '42883' } })))
    expect('porque' in l && l.causa).toBe('schema_ausente')
    expect(avaliarArquivo(l).gravidade).toBe('vermelho')
  })
  it('rpc que lança: vermelho', async () => {
    const l = await lerArquivoParaVigia(sb(() => 'lanca'))
    const r = avaliarArquivo(l)
    expect(r.gravidade).toBe('amarelo')
    expect(r.motivo).toContain(MOTIVO_SEM_LEITURA)
    expect(r.motivo).toContain('site s1')
  })
  it('motivo nomeia o site com problema', async () => {
    const l = await lerArquivoParaVigia(sb(fn => (fn === 'obs_archive_atraso' ? { data: null, error: { code: 'XX' } } : boas(fn)), [{ id: 'aaaaaaaa-1' }, { id: 'bbbbbbbb-2' }]))
    expect(avaliarArquivo(l).motivo).toMatch(/site (aaaaaaaa|bbbbbbbb)/)
    expect(avaliarArquivo(l).gravidade).toBe('vermelho')
  })
  it('estrutural vence passageira quando há as duas', async () => {
    const l = await lerArquivoParaVigia(sb(fn => (fn === 'obs_archive_atraso' ? 'lanca' : { data: null, error: { code: '42883' } })))
    expect(avaliarArquivo(l).gravidade).toBe('vermelho')
  })
  it('RPCs em paralelo: todas disparadas antes de qualquer resposta', async () => {
    let emVoo = 0, pico = 0
    const cli = { from: () => ({ select: () => ({ abortSignal: () => Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null }) }) }),
      rpc: (fn: string) => ({ abortSignal: async () => { emVoo++; pico = Math.max(pico, emVoo); await new Promise(r => setTimeout(r, 10)); emVoo--; return boas(fn) } }) } as unknown as SupabaseClient
    await lerArquivoParaVigia(cli)
    expect(pico).toBe(6)
  })
  it('resposta nula ou fora da forma: vermelho, nunca zero', async () => {
    for (const data of [null, {}, { c1: 0 }, { amarelos: '0' }]) {
      expect(avaliarArquivo(await lerArquivoParaVigia(sb(() => ({ data, error: null })))).gravidade).toBe('vermelho')
    }
  })
  it('nenhum site lido: vermelho', async () => {
    expect(avaliarArquivo(await lerArquivoParaVigia(sb(boas, []))).gravidade).toBe('vermelho')
  })
  it('soma dois sites', async () => {
    const l = await lerArquivoParaVigia(sb(fn => ({ data: fn === 'obs_archive_atraso' ? { amarelos: 1, vermelhos: 0, meses_sem_selo: 0 } : { c1: 0, c2: 0, c3: 0, c4: 0 }, error: null }), [{ id: 'a' }, { id: 'b' }]))
    expect('valor' in l && l.valor.atraso.amarelos).toBe(2)
  })
})
