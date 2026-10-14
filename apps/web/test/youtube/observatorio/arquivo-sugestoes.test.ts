// @vitest-environment node
/**
 * A5 · E10, Tarefa 8: as sugestões de arquivar (`arquivo/sugestoes.ts`).
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerSugestoes, BYTES_ESTIMADOS_POR_LINHA } from '@/lib/youtube/observatorio/arquivo/sugestoes'
import { RULES } from '@/lib/youtube/observatorio/rules'

const SITE = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const DIA_MS = 86_400_000
const iso = (diasAtras: number): string => new Date(AGORA - diasAtras * DIA_MS).toISOString()
const SEGREDO = 'segredo-da-mensagem-do-banco'

type Resposta = { data?: unknown; error?: { message: string; code?: string } | null } | null
function falso(r: Resposta | Error) {
  const chamadas: Array<{ nome: string; args: Record<string, unknown>; sinal: AbortSignal | null }> = []
  const sb = {
    rpc: (nome: string, args: Record<string, unknown>) => ({
      abortSignal: (s: AbortSignal) => { chamadas.push({ nome, args, sinal: s }); return r instanceof Error ? Promise.reject(r) : Promise.resolve(r) },
    }),
  } as unknown as SupabaseClient
  return { sb, chamadas }
}
const item = (o: Record<string, unknown> = {}) => ({ channel_row_id: 'c1', channel_name: 'Canal parado', last_published_at: iso(400), last_ok_synced_at: iso(1), videos: 30, linhas: 10_000, ...o })
const objeto = (itens: unknown[], o: Record<string, unknown> = {}) => ({ data: { canais_avaliados: 3, canais_sem_video: 1, sugestoes: itens, ...o }, error: null })

describe('A5 E10 T8: lerSugestoes', () => {
  it('usa RULES.archiveCutMonths como argumento, com o site e o relógio injetado', async () => {
    const f = falso(objeto([]))
    await lerSugestoes(f.sb, SITE, AGORA)
    expect(f.chamadas).toHaveLength(1)
    expect(f.chamadas[0]).toMatchObject({ nome: 'competitor_archive_suggestions', args: { p_site: SITE, p_now: new Date(AGORA).toISOString(), p_months: RULES.archiveCutMonths } })
    expect(f.chamadas[0]!.sinal).toBeInstanceOf(AbortSignal)
    expect(RULES.archiveCutMonths).toBe(12)
  })

  it('o item vem com as contagens, a estimativa em MB (linhas × 156 B) e a última leitura boa', async () => {
    const r = await lerSugestoes(falso(objeto([item()])).sb, SITE, AGORA)
    expect(r).toEqual({ valor: { avaliados: 3, semVideo: 1, cortaEmMeses: 12, itens: [{
      canalId: 'c1', nome: 'Canal parado', ultimaPublicacao: iso(400), videos: 30, linhas: 10_000,
      mbEstimado: Math.round(((10_000 * BYTES_ESTIMADOS_POR_LINHA) / 1_048_576) * 10) / 10, ultimaLeituraBoa: iso(1), naoAvaliado: false,
    }] } })
    expect(BYTES_ESTIMADOS_POR_LINHA).toBe(156)
    expect('valor' in r && r.valor.itens[0]!.mbEstimado).toBe(1.5)
  })

  it('sugestão de canal sem leitura boa há 8 dias vem com naoAvaliado: true; com leitura de ontem, false; com last_ok_synced_at nulo, true', async () => {
    const r = await lerSugestoes(falso(objeto([
      item({ channel_row_id: 'velho', last_ok_synced_at: iso(8) }), item({ channel_row_id: 'ontem', last_ok_synced_at: iso(1) }),
      item({ channel_row_id: 'nulo', last_ok_synced_at: null }), item({ channel_row_id: 'borda', last_ok_synced_at: iso(RULES.archive.suggestionFreshDays) }),
    ])).sb, SITE, AGORA)
    const por = Object.fromEntries(('valor' in r ? r.valor.itens : []).map(i => [i.canalId, [i.naoAvaliado, i.ultimaLeituraBoa]]))
    expect(por.velho).toEqual([true, iso(8)])
    expect(por.ontem).toEqual([false, iso(1)])
    expect(por.nulo).toEqual([true, null])
    expect(por.borda).toEqual([false, iso(7)]) // exatamente 7 dias ainda vale
    expect(RULES.archive.suggestionFreshDays).toBe(7)
  })

  it('resposta nula é forma_invalida, não lista vazia (parâmetro nulo no banco)', async () => {
    expect(await lerSugestoes(falso({ data: null, error: null }).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
    expect(await lerSugestoes(falso(null).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
    expect(await lerSugestoes(falso({ data: [], error: null }).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
    expect(await lerSugestoes(falso({ data: { canais_avaliados: 'x', canais_sem_video: 0, sugestoes: [] }, error: null }).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
    expect(await lerSugestoes(falso(objeto([{ channel_row_id: 1 }])).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
    expect(await lerSugestoes(falso(objeto(['texto'])).sb, SITE, AGORA)).toEqual({ porque: 'forma_invalida' })
  })

  it('avaliados 0 e itens vazio são devolvidos como estão', async () => {
    expect(await lerSugestoes(falso(objeto([], { canais_avaliados: 0, canais_sem_video: 0 })).sb, SITE, AGORA)).toEqual({ valor: { avaliados: 0, semVideo: 0, cortaEmMeses: 12, itens: [] } })
  })

  it('erro do banco, função ausente e exceção: só o código; nunca a mensagem', async () => {
    const a = await lerSugestoes(falso({ data: null, error: { message: SEGREDO, code: '57014' } }).sb, SITE, AGORA)
    const b = await lerSugestoes(falso({ data: null, error: { message: SEGREDO, code: '42883' } }).sb, SITE, AGORA)
    const c = await lerSugestoes(falso(new Error(SEGREDO)).sb, SITE, AGORA)
    const d = await lerSugestoes(falso({ data: null, error: { message: 'AbortError: aborted', code: '' } }).sb, SITE, AGORA)
    expect([a, c, d]).toEqual([{ porque: 'erro_do_banco' }, { porque: 'excecao' }, { porque: 'prazo' }])
    expect('porque' in b).toBe(true)
    expect(JSON.stringify([a, b, c])).not.toContain(SEGREDO)
  })

  it('só lê: a função chamada é a de sugestões, e nada mais é chamado', async () => {
    const f = falso(objeto([item()]))
    await lerSugestoes(f.sb, SITE, AGORA)
    expect(f.chamadas.map(c => c.nome)).toEqual(['competitor_archive_suggestions'])
  })
})
