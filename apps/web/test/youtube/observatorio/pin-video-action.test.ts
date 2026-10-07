// @vitest-environment node
// apps/web/test/youtube/observatorio/pin-video-action.test.ts — pinVideo / unpinVideo (R118).
import { describe, it, expect, vi } from 'vitest'
import { RULES } from '@/lib/youtube/observatorio/rules'

const VID = '0f8fad5b-d9cb-469f-a165-70867728950e', CH = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
/** What a real Postgres / PostgREST failure says: none of it may reach a result. */
const PG = { code: '42501', message: 'permission denied for table competitor_videos' }
interface Call { table: string; ops: Array<[string, unknown[]]> }
interface Opts {
  /** false = the guard refuses (forbidden); 'anon' = it refuses as unauthenticated. */
  allowed?: boolean | 'anon'
  /** The competitor_videos row; null = no such video. */
  video?: { id: string; competitor_channel_id: string; pinned_at: string | null } | null
  /** The channel row when it belongs to this site; null = the channel is another site's. */
  channel?: { id: string; channel_name: string } | null
  pinnedCount?: number | null
  videoError?: boolean; channelError?: boolean; countError?: boolean; updateError?: boolean
}
async function load(o: Opts = {}) {
  vi.resetModules()
  const calls: Call[] = [], order: string[] = []
  const has = (c: Call, op: string) => c.ops.some(x => x[0] === op)
  const answer = (c: Call) => {
    if (c.table === 'competitor_channels') return o.channelError ? { data: null, error: PG } : { data: o.channel === undefined ? { id: CH, channel_name: 'Canal Um' } : o.channel, error: null }
    if (has(c, 'update')) return o.updateError ? { data: null, error: PG } : { data: [{ id: VID }], error: null }
    if (has(c, 'maybeSingle')) return o.videoError ? { data: null, error: PG } : { data: o.video === undefined ? { id: VID, competitor_channel_id: CH, pinned_at: null } : o.video, error: null }
    return o.countError ? { count: null, error: PG } : { count: o.pinnedCount === undefined ? 0 : o.pinnedCount, error: null }
  }
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'is', 'update', 'maybeSingle']) q[m] = (...args: unknown[]) => { call.ops.push([m, args]); return q }
    q.then = (res: (x: unknown) => unknown) => Promise.resolve(answer(call)).then(res)
    return q
  }
  const revalidatePath = vi.fn()
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async () => {
      order.push('guard')
      return o.allowed === false ? { ok: false, reason: 'forbidden' } : o.allowed === 'anon' ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: 'u1' } }
    },
  }))
  vi.doMock('next/cache', () => ({ revalidatePath }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('db'); return { from } } }))
  const { pinVideo, unpinVideo } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  const updates = () => calls.filter(c => has(c, 'update'))
  const opArgs = (c: Call, op: string) => c.ops.filter(x => x[0] === op).map(x => x[1])
  return { pinVideo, unpinVideo, calls, order, revalidatePath, updates, opArgs }
}
const DENIED = { ok: false, kind: 'denied', error: 'Você não tem permissão para fixar vídeos neste site.' }
const GONE = { ok: false, kind: 'denied', error: 'Este vídeo não existe mais no Observatório.' }
const PIN_FAILED = { ok: false, kind: 'failed', error: 'Não foi possível fixar agora. Tente de novo.' }
const UNPIN_FAILED = { ok: false, kind: 'failed', error: 'Não foi possível deixar de acompanhar agora. Tente de novo.' }
const FULL = { ok: false, kind: 'cap', error: `Sem vagas: ${RULES.pinLimit} de ${RULES.pinLimit} vídeos fixados em Canal Um. Deixe de acompanhar um para fixar outro.` }
const PINNED = { id: VID, competitor_channel_id: CH, pinned_at: new Date(Date.now() - 864e5).toISOString() }

describe('pinVideo', () => {
  it('o guard vem primeiro; sem acesso nada é lido nem escrito, e a resposta é uma frase', async () => {
    for (const allowed of [false, 'anon'] as const) {
      const a = await load({ allowed })
      expect(await a.pinVideo(VID)).toEqual(DENIED)
      expect(a.order).toEqual(['guard'])
      expect(a.calls).toEqual([])
    }
    const b = await load()
    await b.pinVideo(VID)
    expect(b.order[0]).toBe('guard')
  })
  it('id que não é uuid: "não existe mais", sem tocar no banco', async () => {
    const a = await load()
    expect(await a.pinVideo('x,id.neq.0')).toEqual(GONE)
    expect(a.order).toEqual(['guard'])
  })
  it('fixa: grava pinned_at de agora e quem fixou, só enquanto ainda não está fixado, e revalida', async () => {
    const a = await load({ pinnedCount: RULES.pinLimit - 1 })
    expect(await a.pinVideo(VID)).toEqual({ ok: true })
    const [up] = a.updates()
    const set = a.opArgs(up!, 'update')[0]![0] as { pinned_at: string; pinned_by: string }
    expect(set.pinned_by).toBe('u1')
    expect(Math.abs(Date.parse(set.pinned_at) - Date.now())).toBeLessThan(60_000)
    expect(a.opArgs(up!, 'eq')).toEqual([['id', VID], ['competitor_channel_id', CH]])
    expect(a.opArgs(up!, 'is')).toEqual([['pinned_at', null]])
    expect(a.revalidatePath).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('o canal do vídeo é conferido contra o site', async () => {
    const a = await load()
    await a.pinVideo(VID)
    const ch = a.calls.find(c => c.table === 'competitor_channels')!
    expect(a.opArgs(ch, 'eq')).toEqual([['id', CH], ['site_id', 's1']])
  })
  it('a contagem olha só os fixados do canal', async () => {
    const a = await load()
    await a.pinVideo(VID)
    const count = a.calls.find(c => c.table === 'competitor_videos' && c.ops.some(x => x[0] === 'not'))!
    expect(a.opArgs(count, 'eq')).toEqual([['competitor_channel_id', CH]])
    expect(a.opArgs(count, 'not')).toEqual([['pinned_at', 'is', null]])
    expect(a.opArgs(count, 'select')[0]![1]).toEqual({ count: 'exact', head: true })
  })
  it('no teto (RULES.pinLimit já fixados) recusa com a frase do limite, não escreve e não desafixa ninguém', async () => {
    const a = await load({ pinnedCount: RULES.pinLimit })
    expect(await a.pinVideo(VID)).toEqual(FULL)
    expect(a.updates()).toEqual([])
    expect(a.revalidatePath).not.toHaveBeenCalled()
  })
  it('vídeo de um canal de outro site lê como "não existe mais"', async () => {
    const a = await load({ channel: null })
    expect(await a.pinVideo(VID)).toEqual(GONE)
    expect(a.updates()).toEqual([])
  })
  it('vídeo que não existe (o dado não existe): "não existe mais", e o canal nem é consultado', async () => {
    const a = await load({ video: null })
    expect(await a.pinVideo(VID)).toEqual(GONE)
    expect(a.calls.some(c => c.table === 'competitor_channels')).toBe(false)
  })
  it('contagem sem número, ou com erro, é falha: nunca vale como zero', async () => {
    for (const o of [{ pinnedCount: null }, { countError: true }] as Opts[]) {
      const a = await load(o)
      expect(await a.pinVideo(VID)).toEqual(PIN_FAILED)
      expect(a.updates()).toEqual([])
    }
  })
  it('erro ao ler o vídeo, ao ler o canal ou ao gravar é falha, sem revalidar', async () => {
    for (const o of [{ videoError: true }, { channelError: true }, { updateError: true }] as Opts[]) {
      const a = await load(o)
      expect(await a.pinVideo(VID)).toEqual(PIN_FAILED)
      expect(a.revalidatePath).not.toHaveBeenCalled()
    }
  })
  it('vídeo já fixado: sucesso sem contar e sem regravar a data', async () => {
    const a = await load({ video: PINNED, pinnedCount: RULES.pinLimit })
    expect(await a.pinVideo(VID)).toEqual({ ok: true })
    expect(a.updates()).toEqual([])
  })
})

describe('unpinVideo', () => {
  it('o guard vem primeiro', async () => {
    const a = await load({ allowed: false, video: PINNED })
    expect(await a.unpinVideo(VID)).toEqual(DENIED)
    expect(a.calls).toEqual([])
  })
  it('desafixa: zera pinned_at e pinned_by e revalida', async () => {
    const a = await load({ video: PINNED })
    expect(await a.unpinVideo(VID)).toEqual({ ok: true })
    const [up] = a.updates()
    expect(a.opArgs(up!, 'update')[0]![0]).toEqual({ pinned_at: null, pinned_by: null })
    expect(a.opArgs(up!, 'eq')).toEqual([['id', VID], ['competitor_channel_id', CH]])
    expect(a.revalidatePath).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('vídeo de outro site não é desafixado', async () => {
    const a = await load({ video: PINNED, channel: null })
    expect(await a.unpinVideo(VID)).toEqual(GONE)
    expect(a.updates()).toEqual([])
  })
  it('vídeo que não está fixado: sucesso sem escrita', async () => {
    const a = await load()
    expect(await a.unpinVideo(VID)).toEqual({ ok: true })
    expect(a.updates()).toEqual([])
  })
  it('erro ao ler ou ao gravar é falha, com a frase de desafixar', async () => {
    for (const o of [{ videoError: true }, { video: PINNED, updateError: true }] as Opts[]) {
      expect(await (await load(o)).unpinVideo(VID)).toEqual(UNPIN_FAILED)
    }
  })
})

describe('nenhum resultado carrega código cru nem texto do banco', () => {
  const CASES: Opts[] = [
    {}, { allowed: false }, { allowed: 'anon' }, { video: null }, { channel: null }, { pinnedCount: RULES.pinLimit }, { pinnedCount: null },
    { videoError: true }, { channelError: true }, { countError: true }, { updateError: true }, { video: PINNED }, { video: PINNED, updateError: true },
  ]
  it('pinVideo e unpinVideo, em todos os caminhos', async () => {
    for (const o of CASES) {
      for (const which of ['pinVideo', 'unpinVideo'] as const) {
        const a = await load(o)
        for (const id of [VID, 'não-é-uuid']) {
          const r = await a[which](id)
          const text = JSON.stringify(r)
          expect(text).not.toMatch(/forbidden|unauthori[sz]ed|unauthenticated|permission denied|42501|competitor_videos|PGRST/i)
          if (!r.ok) {
            expect(['cap', 'failed', 'denied']).toContain(r.kind)
            expect(r.error).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].*\.$/) // a whole sentence: capital first, final stop
          } else expect(r).toEqual({ ok: true })
        }
      }
    }
  })
})
