// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerFormatoDoBruto, lerFormatos, formatoNaAbertura } from '@/lib/youtube/teste-youtube/nativo/formato-borda'
import { caminhoDoTeste } from '@/lib/youtube/teste-youtube/nativo/roteador'

describe('lerFormatoDoBruto', () => {
  const bruto = (o: { kids?: unknown; rating?: unknown; live?: unknown } = {}) => ({
    status: { madeForKids: o.kids ?? false }, contentDetails: { contentRating: o.rating ?? {} }, snippet: { liveBroadcastContent: o.live ?? 'none' },
  })
  it('lê os três campos', () => {
    expect(lerFormatoDoBruto(bruto())).toEqual({ kids: false, adulto: false, aoVivo: false })
    expect(lerFormatoDoBruto(bruto({ kids: true }))).toMatchObject({ kids: true })
    expect(lerFormatoDoBruto(bruto({ rating: { ytRating: 'ytAgeRestricted' } }))).toMatchObject({ adulto: true })
    expect(lerFormatoDoBruto(bruto({ live: 'upcoming' }))).toMatchObject({ aoVivo: true })
    expect(lerFormatoDoBruto(bruto({ live: 'live' }))).toMatchObject({ aoVivo: true })
  })
  it('bruto sem status => kids nulo; sem as outras partes => nulos; nunca false', () => {
    expect(lerFormatoDoBruto({ contentDetails: { contentRating: {} }, snippet: { liveBroadcastContent: 'none' } })).toEqual({ kids: null, adulto: false, aoVivo: false })
    expect(lerFormatoDoBruto({})).toEqual({ kids: null, adulto: null, aoVivo: null })
    expect(lerFormatoDoBruto(null)).toEqual({ kids: null, adulto: null, aoVivo: null })
    expect(lerFormatoDoBruto('x')).toEqual({ kids: null, adulto: null, aoVivo: null })
  })
  it('tipo errado => nulo', () => {
    expect(lerFormatoDoBruto(bruto({ kids: 'true' })).kids).toBeNull()
    expect(lerFormatoDoBruto(bruto({ live: 1 })).aoVivo).toBeNull()
    expect(lerFormatoDoBruto({ ...bruto(), contentDetails: { contentRating: 'x' } }).adulto).toBeNull()
  })
})

interface Linha { youtube_video_id: string; raw: unknown; is_short: boolean | null }
/** Banco falso que conta as idas e recusa qualquer escrita. */
function falso(rpcLinhas: Linha[], duracoes: Array<{ id: string; duration_seconds: number }>) {
  const idas: string[] = []
  const escreveu = vi.fn()
  const sb = {
    rpc: (nome: string, args: Record<string, unknown>) => { idas.push('rpc:' + nome); void args; return Promise.resolve({ data: rpcLinhas, error: null }) },
    from: (tabela: string) => {
      idas.push('from:' + tabela)
      const q: Record<string, unknown> = {
        select: () => q, in: () => q, eq: () => q,
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: duracoes, error: null }).then(ok),
        insert: escreveu, update: escreveu, upsert: escreveu, delete: escreveu,
      }
      return q
    },
  } as unknown as SupabaseClient
  return { sb, idas, escreveu }
}

describe('lerFormatos', () => {
  it('30 vídeos => 2 idas ao banco (o RPC e a duração), nunca uma por vídeo', async () => {
    const videos = Array.from({ length: 30 }, (_, i) => ({ id: `u${i}`, ytId: `yt${i}` }))
    const linhas: Linha[] = videos.map((v) => ({ youtube_video_id: v.ytId, raw: { status: { madeForKids: false } }, is_short: null }))
    const { sb, idas } = falso(linhas, [{ id: 'u3', duration_seconds: 900 }])
    const m = await lerFormatos(sb, 's1', videos)
    expect(idas).toEqual(['rpc:ab_lab_formato_atual', 'from:youtube_videos'])
    expect(m.size).toBe(30)
    expect(m.get('u3')).toEqual({ isShort: false, kids: false, adulto: null, aoVivo: null })
    expect(m.get('u4')).toEqual({ isShort: null, kids: false, adulto: null, aoVivo: null })
  })
  it('1001 vídeos => o RPC vai em lotes de 500 (3 idas), nenhum id perdido (Phil m5)', async () => {
    const videos = Array.from({ length: 1001 }, (_, i) => ({ id: `u${i}`, ytId: `yt${i}` }))
    const tamanhos: number[] = []
    const sb = {
      rpc: (_n: string, a: { p_ids: string[] }) => { tamanhos.push(a.p_ids.length); return Promise.resolve({ data: a.p_ids.map((y) => ({ youtube_video_id: y, raw: null, is_short: false })), error: null }) },
    } as unknown as SupabaseClient
    const m = await lerFormatos(sb, 's1', videos)
    expect(tamanhos).toEqual([500, 500, 1])
    expect(m.size).toBe(1001)
    expect(m.get('u1000')!.isShort).toBe(false)
  })
  it('todos com is_short conhecido: uma ida só (sem consulta de duração)', async () => {
    const videos = [{ id: 'u1', ytId: 'a' }, { id: 'u2', ytId: 'b' }]
    const { sb, idas } = falso(videos.map((v) => ({ youtube_video_id: v.ytId, raw: null, is_short: false })), [])
    await lerFormatos(sb, 's1', videos)
    expect(idas).toEqual(['rpc:ab_lab_formato_atual'])
  })
  it('sem meta e sem bruto: tudo nulo; duration_seconds > 180 => isShort false; <= 180 continua nulo', async () => {
    const { sb } = falso([], [{ id: 'u1', duration_seconds: 1200 }, { id: 'u2', duration_seconds: 180 }])
    const m = await lerFormatos(sb, 's1', [{ id: 'u1', ytId: 'a' }, { id: 'u2', ytId: 'b' }, { id: 'u3', ytId: 'c' }])
    expect(m.get('u1')).toEqual({ isShort: false, kids: null, adulto: null, aoVivo: null })
    expect(m.get('u2')).toEqual({ isShort: null, kids: null, adulto: null, aoVivo: null })
    expect(m.get('u3')).toEqual({ isShort: null, kids: null, adulto: null, aoVivo: null })
  })
  it('is_short da meta vence a duração; sem vídeos => zero idas', async () => {
    const { sb, idas } = falso([{ youtube_video_id: 'a', raw: null, is_short: true }], [{ id: 'u1', duration_seconds: 1200 }])
    expect((await lerFormatos(sb, 's1', [{ id: 'u1', ytId: 'a' }])).get('u1')?.isShort).toBe(true)
    idas.length = 0
    expect((await lerFormatos(sb, 's1', [])).size).toBe(0)
    expect(idas).toEqual([])
  })
  it('erro do RPC lança (nunca formato calado)', async () => {
    const sb = { rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }), from: () => ({}) } as unknown as SupabaseClient
    await expect(lerFormatos(sb, 's1', [{ id: 'u1', ytId: 'a' }])).rejects.toThrow('boom')
  })
})

describe('formatoNaAbertura', () => {
  const video = { id: 'u1', ytId: 'yt1' }
  const e = { idadeDias: 30, impressoesAcimaDoPiso: true }
  it('sem meta, duration 1200, sem bruto, com videosList (kids false) => nativo', async () => {
    const { sb, escreveu } = falso([], [{ id: 'u1', duration_seconds: 1200 }])
    const videosList = vi.fn().mockResolvedValue({ items: [{ status: { madeForKids: false }, contentDetails: { contentRating: {} }, snippet: { liveBroadcastContent: 'none' } }] })
    const formato = await formatoNaAbertura(sb, 's1', video, { videosList })
    expect(videosList).toHaveBeenCalledTimes(1)
    expect(videosList).toHaveBeenCalledWith('yt1')
    expect(caminhoDoTeste({ formato, ...e }).tipo).toBe('nativo')
    expect(escreveu).not.toHaveBeenCalled()
  })
  it('sem a porta: nao_confirmado com motivo "ainda não lido"', async () => {
    const { sb, escreveu } = falso([], [{ id: 'u1', duration_seconds: 1200 }])
    const formato = await formatoNaAbertura(sb, 's1', video, {})
    expect(caminhoDoTeste({ formato, ...e })).toMatchObject({ tipo: 'nao_confirmado', motivo: expect.stringContaining('ainda não lido') })
    expect(escreveu).not.toHaveBeenCalled()
  })
  it('com bruto: não chama videosList; item direto (sem items) também é lido', async () => {
    const com = falso([{ youtube_video_id: 'yt1', raw: { status: { madeForKids: false } }, is_short: false }], [])
    const vl = vi.fn()
    expect((await formatoNaAbertura(com.sb, 's1', video, { videosList: vl })).kids).toBe(false)
    expect(vl).not.toHaveBeenCalled()
    const sem = falso([], [])
    const direto = await formatoNaAbertura(sem.sb, 's1', video, { videosList: async () => ({ status: { madeForKids: true } }) })
    expect(direto.kids).toBe(true)
  })
  it('videosList que falha => kids nulo (terceiro estado), sem lançar e sem gravar', async () => {
    const { sb, escreveu } = falso([], [])
    const formato = await formatoNaAbertura(sb, 's1', video, { videosList: async () => { throw new Error('quota') } })
    expect(formato.kids).toBeNull()
    expect(escreveu).not.toHaveBeenCalled()
  })
})
