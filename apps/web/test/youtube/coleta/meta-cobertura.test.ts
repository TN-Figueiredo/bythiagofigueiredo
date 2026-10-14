// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import {
  cobrirMetadados, compactacaoPedida, notaValorDesconhecido, lerRespostaCobertura, VARIAVEL_DIETA_OFF, RECUSAS_DA_COBERTURA,
} from '@/lib/youtube/coleta/meta-cobertura'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb } from './fake-supabase'

const canalA: ColetaChannel = { id: 'ca', channel_id: 'UCa', site_id: 'sa', name: 'Canal A', sync_enabled: true, collection_status: 'ok', video_count: 3 }
const canalB: ColetaChannel = { id: 'cb', channel_id: 'UCb', site_id: 'sb', name: 'Canal B', sync_enabled: true, collection_status: 'ok', video_count: 3 }
const DIA = '2026-10-06'

const BOA = { resultado: 'ok', dia: DIA, texto: 2, thumb: 1, linhas: 5, descobertas: 0, sem_explicacao: 0, compactacao: 'indisponivel', compactadas: 0 }
const ctxDe = (db: FakeDb, prazoMs = 30_000): StepCtx => ({ supabase: db.client, channels: [], deadline: Date.now() + prazoMs, falhas: [], tentativas: [] })
function dbCom(resp: Record<string, unknown> = BOA): FakeDb {
  const db = fakeSupabase({})
  db.rpcHandlers.yt_own_meta_cover = () => ({ data: { ...resp }, error: null })
  return db
}

beforeEach(() => { delete process.env[VARIAVEL_DIETA_OFF]; vi.mocked(Sentry.captureException).mockClear() })
afterEach(() => { delete process.env[VARIAVEL_DIETA_OFF]; vi.useRealTimers() })

describe('meta-cobertura', () => {
  it('1. variável apagada: a compactação é pedida e a rpc recebe p_compactar true', async () => {
    delete process.env[VARIAVEL_DIETA_OFF]
    expect(compactacaoPedida()).toBe(true)
    const db = dbCom(); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r.pedida).toBe(true)
    expect(db.rpcCalls).toEqual([{ name: 'yt_own_meta_cover', args: { p_site_id: 'sa', p_channel_id: 'ca', p_day: DIA, p_compactar: true } }])
    expect(ctx.falhas).toEqual([])
  })

  it("2. '1', 'true', ' SIM ' desligam; '' não desliga; 'talvez' não desliga e gera a nota de valor desconhecido", () => {
    for (const v of ['1', 'true', ' SIM ', 'True']) {
      expect(compactacaoPedida({ [VARIAVEL_DIETA_OFF]: v })).toBe(false)
      expect(notaValorDesconhecido({ [VARIAVEL_DIETA_OFF]: v })).toBeNull()
    }
    expect(compactacaoPedida({ [VARIAVEL_DIETA_OFF]: '' })).toBe(true)
    expect(notaValorDesconhecido({ [VARIAVEL_DIETA_OFF]: '' })).toBeNull()
    expect(compactacaoPedida({ [VARIAVEL_DIETA_OFF]: 'talvez' })).toBe(true)
    expect(notaValorDesconhecido({ [VARIAVEL_DIETA_OFF]: 'talvez' })).toBe('YT_OWN_META_DIETA_OFF tem valor desconhecido')
  })

  it('2b. valor desconhecido na execução vira nota vermelha e não desliga', async () => {
    process.env[VARIAVEL_DIETA_OFF] = 'talvez'
    const db = dbCom(); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r.pedida).toBe(true)
    expect(ctx.falhas).toContain('YT_OWN_META_DIETA_OFF tem valor desconhecido')
  })

  it('3. resposta boa de dois canais soma no resumo', async () => {
    const db = dbCom(); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA, canalB])
    expect(r).toEqual({ pedida: true, canais: 2, ok: 2, falhas: 0, sem_tempo: false, texto: 4, thumb: 2, descobertas: 0, sem_explicacao: 0, compactadas: 0, compactacao: { indisponivel: 2 } })
    expect(ctx.falhas).toEqual([])
  })

  it('4. lista de canais vazia: canais 0, ok 0, nenhuma nota (dado ausente)', async () => {
    const db = dbCom(); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [])
    expect(r.canais).toBe(0); expect(r.ok).toBe(0); expect(r.falhas).toBe(0)
    expect(ctx.falhas).toEqual([]); expect(db.rpcCalls).toEqual([])
  })

  it('5. função ausente (PGRST202): nota schema_ausente, falhas 1, ok 0', async () => {
    const db = fakeSupabase({}); const ctx = ctxDe(db) // sem handler: o fake devolve PGRST202
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r).toMatchObject({ ok: 0, falhas: 1 })
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_meta_cover'])
  })

  it('6. erro de banco: nota de erro de banco, sem o texto do Postgres', async () => {
    const db = dbCom(); db.errors['rpc:yt_own_meta_cover'] = { code: '57014', message: 'canceling statement: título secreto' }
    const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r).toMatchObject({ ok: 0, falhas: 1 })
    expect(ctx.falhas).toEqual(['erro de banco ao gravar yt_own_meta_cover'])
    expect(JSON.stringify(ctx.falhas)).not.toContain('secreto')
  })

  it('7. recusa conhecida cita o código; texto livre vira erro_desconhecido e o texto não aparece em nota nem no Sentry', async () => {
    for (const cod of RECUSAS_DA_COBERTURA) {
      const db = dbCom(); db.errors['rpc:yt_own_meta_cover'] = { code: 'P0001', message: cod }
      const ctx = ctxDe(db)
      await cobrirMetadados(ctx, DIA, [canalA])
      expect(ctx.falhas).toEqual([`metadados: cobertura de Canal A recusada (${cod})`])
    }
    const db = dbCom(); db.errors['rpc:yt_own_meta_cover'] = { code: 'P0001', message: 'Meu Título Fictício do Vídeo' }
    const ctx = ctxDe(db)
    await cobrirMetadados(ctx, DIA, [canalA])
    expect(ctx.falhas).toEqual(['metadados: cobertura de Canal A recusada (erro_desconhecido)'])
    expect(JSON.stringify(ctx.falhas)).not.toContain('Fictício')
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain('Fictício')
  })

  it('8. sem o campo descobertas, texto no lugar de número, ou resultado diferente de ok: falhas 1 e a nota "fora da forma"', async () => {
    const { descobertas: _d, ...semDescobertas } = BOA
    for (const resp of [semDescobertas, { ...BOA, texto: '2' }, { ...BOA, resultado: 'erro' }]) {
      const db = dbCom(resp); const ctx = ctxDe(db)
      const r = await cobrirMetadados(ctx, DIA, [canalA])
      expect(r).toMatchObject({ ok: 0, falhas: 1, texto: 0, thumb: 0 })
      expect(ctx.falhas).toEqual(['metadados: cobertura de Canal A respondeu fora da forma'])
    }
    expect(lerRespostaCobertura(null)).toBeNull()
    expect(lerRespostaCobertura([])).toBeNull()
    expect(lerRespostaCobertura({ ...BOA, compactacao: 'qualquer' })).toBeNull()
    expect(lerRespostaCobertura(BOA)).toEqual({ texto: 2, thumb: 1, linhas: 5, descobertas: 0, semExplicacao: 0, compactacao: 'indisponivel', compactadas: 0 })
  })

  it('9. sem resposta até o prazo: sem_tempo verdadeiro e a nota de sem tempo', async () => {
    vi.useFakeTimers()
    const db = dbCom(); db.rpcHandlers.yt_own_meta_cover = () => new Promise(() => {})
    const ctx = ctxDe(db, 5_000)
    const p = cobrirMetadados(ctx, DIA, [canalA, canalB])
    await vi.advanceTimersByTimeAsync(6_000)
    const r = await p
    expect(r.sem_tempo).toBe(true)
    expect(r.ok).toBe(0)
    expect(ctx.falhas).toContain('metadados: cobertura de metadados sem tempo em 2 canal(is)')
  })

  it('10. descobertas 2 e sem_explicacao 3 geram as duas notas vermelhas, com o nome do canal e os números', async () => {
    const db = dbCom({ ...BOA, descobertas: 2, sem_explicacao: 3 }); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r).toMatchObject({ ok: 1, descobertas: 2, sem_explicacao: 3 })
    expect(ctx.falhas).toEqual([
      'metadados: 2 linha(s) com captura fora da cobertura em Canal A',
      'metadados: 3 dia(s) coberto(s) sem linha e fora de uma sequência igual em Canal A',
    ])
  })

  it('11. sem_estado e indisponivel não geram nota', async () => {
    for (const compactacao of ['sem_estado', 'indisponivel']) {
      const db = dbCom({ ...BOA, compactacao }); const ctx = ctxDe(db)
      const r = await cobrirMetadados(ctx, DIA, [canalA])
      expect(r.compactacao).toEqual({ [compactacao]: 1 })
      expect(ctx.falhas).toEqual([])
    }
  })

  it('12. dieta desligada: p_compactar false, pedida false e a nota vermelha da variável', async () => {
    process.env[VARIAVEL_DIETA_OFF] = '1'
    const db = dbCom(); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r.pedida).toBe(false)
    expect(db.rpcCalls[0]!.args.p_compactar).toBe(false)
    expect(ctx.falhas).toEqual(['metadados: a dieta diária está desligada por YT_OWN_META_DIETA_OFF'])
  })

  it('13. mutação: a chamada leva o site_id e o id do próprio canal', async () => {
    const db = dbCom(); const ctx = ctxDe(db)
    await cobrirMetadados(ctx, DIA, [canalA, canalB])
    expect(db.rpcCalls.map(c => [c.args.p_site_id, c.args.p_channel_id])).toEqual([['sa', 'ca'], ['sb', 'cb']])
  })

  it('14. resposta na forma com linhas 0: falhas 1, ok 0 e a nota "não avaliou nenhuma linha" (dado ausente)', async () => {
    const db = dbCom({ ...BOA, linhas: 0, texto: 0, thumb: 0 }); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r).toMatchObject({ ok: 0, falhas: 1 })
    expect(ctx.falhas).toEqual(['metadados: cobertura de Canal A não avaliou nenhuma linha'])
  })

  it('15. a chamada lança no primeiro canal: falhas 1, nota sem o texto da exceção, o segundo canal é chamado e o resumo é devolvido', async () => {
    const db = dbCom(); let n = 0
    db.rpcHandlers.yt_own_meta_cover = () => { if (n++ === 0) throw new Error('ECONNRESET segredo-da-rede'); return { data: { ...BOA }, error: null } }
    const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA, canalB])
    expect(r).toMatchObject({ canais: 2, ok: 1, falhas: 1 })
    expect(ctx.falhas).toEqual(['metadados: cobertura de Canal A falhou na chamada'])
    expect(JSON.stringify(ctx.falhas)).not.toContain('segredo')
    expect(db.rpcCalls).toHaveLength(2)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('16. pediu a compactação e recebeu desligada: nota com o caminho do roteiro e canal em ok; não pediu: só a nota da variável', async () => {
    const db = dbCom({ ...BOA, compactacao: 'desligada' }); const ctx = ctxDe(db)
    const r = await cobrirMetadados(ctx, DIA, [canalA])
    expect(r).toMatchObject({ ok: 1, falhas: 0, compactacao: { desligada: 1 } })
    expect(ctx.falhas).toEqual(['metadados: a compactação está desligada no banco em Canal A (religar: docs/ops/sql/dieta-meta-religar-compactacao.sql)'])

    process.env[VARIAVEL_DIETA_OFF] = 'sim'
    const db2 = dbCom({ ...BOA, compactacao: 'desligada' }); const ctx2 = ctxDe(db2)
    await cobrirMetadados(ctx2, DIA, [canalA])
    expect(ctx2.falhas).toEqual(['metadados: a dieta diária está desligada por YT_OWN_META_DIETA_OFF'])
  })
})
