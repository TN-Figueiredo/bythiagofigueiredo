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
  videoError?: boolean; channelError?: boolean; updateError?: boolean
  /** Rows the unpin update reports as written; null = the answer came without data. Default: one row. */
  updated?: Array<{ id: string }> | null
  /** What pin_competitor_video answers. Default: { status: 'ok', already: false }. */
  rpc?: { data: unknown; error: { code?: string; message: string } | null }
}
async function load(o: Opts = {}) {
  vi.resetModules()
  const calls: Call[] = [], order: string[] = [], rpcCalls: Array<[string, unknown]> = []
  const has = (c: Call, op: string) => c.ops.some(x => x[0] === op)
  const answer = (c: Call) => {
    if (c.table === 'competitor_channels') return o.channelError ? { data: null, error: PG } : { data: o.channel === undefined ? { id: CH, channel_name: 'Canal Um' } : o.channel, error: null }
    if (has(c, 'update')) return o.updateError ? { data: null, error: PG } : { data: o.updated === undefined ? [{ id: VID }] : o.updated, error: null }
    if (has(c, 'maybeSingle')) return o.videoError ? { data: null, error: PG } : { data: o.video === undefined ? { id: VID, competitor_channel_id: CH, pinned_at: null } : o.video, error: null }
    return { data: null, error: null }
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
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('db'); return { from, rpc: async (name: string, args: unknown) => { rpcCalls.push([name, args]); return o.rpc ?? { data: { status: 'ok', already: false }, error: null } } } } }))
  const { pinVideo, unpinVideo } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  const updates = () => calls.filter(c => has(c, 'update'))
  const opArgs = (c: Call, op: string) => c.ops.filter(x => x[0] === op).map(x => x[1])
  return { pinVideo, unpinVideo, calls, order, rpcCalls, revalidatePath, updates, opArgs }
}
const DENIED = { ok: false, kind: 'denied', error: 'Você não tem permissão para fixar ou desafixar vídeos neste site. Se a sessão expirou, entre de novo.' }
const GONE = { ok: false, kind: 'denied', error: 'Este vídeo não existe mais no Observatório.' }
const PIN_FAILED = { ok: false, kind: 'failed', error: 'Não foi possível fixar agora. Tente de novo.' }
const UNPIN_FAILED = { ok: false, kind: 'failed', error: 'Não foi possível desafixar agora. Tente de novo.' }
const FULL = { ok: false, kind: 'cap', error: `Sem vagas: ${RULES.pinLimit} de ${RULES.pinLimit} vídeos fixados em Canal Um. Desafixe um para fixar outro.` }
const PINNED = { id: VID, competitor_channel_id: CH, pinned_at: new Date(Date.now() - 864e5).toISOString() }

const rpcOf = (data: unknown) => ({ rpc: { data, error: null } })
const CAP = { status: 'cap', name: 'Canal Um', pinned: RULES.pinLimit }

describe('pinVideo', () => {
  it('o guard vem primeiro; sem acesso nada é lido nem escrito, e a resposta é uma frase', async () => {
    for (const allowed of [false, 'anon'] as const) {
      const a = await load({ allowed })
      expect(await a.pinVideo(VID)).toEqual(DENIED)
      expect(a.order).toEqual(['guard'])
      expect(a.rpcCalls).toEqual([])
    }
    const b = await load()
    await b.pinVideo(VID)
    expect(b.order).toEqual(['guard', 'db'])
  })
  it('id que não é uuid: "não existe mais", sem tocar no banco', async () => {
    const a = await load()
    expect(await a.pinVideo('x,id.neq.0')).toEqual(GONE)
    expect(a.order).toEqual(['guard'])
  })
  it('fixa por UMA chamada ao banco: site do contexto, vídeo, quem fixou e o teto de RULES.pinLimit; revalida', async () => {
    const a = await load()
    expect(await a.pinVideo(VID)).toEqual({ ok: true })
    expect(a.rpcCalls).toEqual([['pin_competitor_video', { p_site_id: 's1', p_video_id: VID, p_user_id: 'u1', p_limit: RULES.pinLimit }]])
    // the count and the write live inside the function (one transaction): the action does neither
    expect(a.calls).toEqual([])
    expect(a.revalidatePath).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('no teto recusa com a frase do limite, com o número que o banco contou, e não revalida', async () => {
    const a = await load(rpcOf(CAP))
    expect(await a.pinVideo(VID)).toEqual(FULL)
    expect(a.revalidatePath).not.toHaveBeenCalled()
  })
  it('teto sem nome de canal: a frase continua inteira', async () => {
    const r = await (await load(rpcOf({ status: 'cap', name: '', pinned: RULES.pinLimit }))).pinVideo(VID)
    expect(r).toMatchObject({ ok: false, kind: 'cap' })
    expect(r.ok ? '' : r.error).toContain('vídeos fixados em este canal.')
  })
  it('teto sem a contagem (o dado não existe) é falha: a frase nunca inventa um número', async () => {
    expect(await (await load(rpcOf({ status: 'cap', name: 'Canal Um' }))).pinVideo(VID)).toEqual(PIN_FAILED)
  })
  it('vídeo inexistente ou de um canal de outro site (not_found): "não existe mais", sem revalidar', async () => {
    const a = await load(rpcOf({ status: 'not_found' }))
    expect(await a.pinVideo(VID)).toEqual(GONE)
    expect(a.revalidatePath).not.toHaveBeenCalled()
  })
  it('vídeo já fixado: sucesso, sem revalidar', async () => {
    const a = await load(rpcOf({ status: 'ok', already: true }))
    expect(await a.pinVideo(VID)).toEqual({ ok: true })
    expect(a.revalidatePath).not.toHaveBeenCalled()
  })
  it.each([
    ['erro do banco', { data: null, error: PG }],
    ['função ausente (migration não chegou)', { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.pin_competitor_video' } }],
    ['resposta nula', { data: null, error: null }],
    ['lista', { data: [{ status: 'ok' }], error: null }],
    ['texto', { data: 'ok', error: null }],
    ['sem status', { data: {}, error: null }],
    ['status desconhecido', { data: { status: 'feito' }, error: null }],
  ])('%s é falha, nunca "fixado", e não revalida', async (_n, rpc) => {
    const a = await load({ rpc })
    expect(await a.pinVideo(VID)).toEqual(PIN_FAILED)
    expect(a.revalidatePath).not.toHaveBeenCalled()
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
  it('a gravação não alcança linha nenhuma (o vídeo sumiu entre ler e gravar): "não existe mais", sem revalidar', async () => {
    const a = await load({ video: PINNED, updated: [] })
    expect(await a.unpinVideo(VID)).toEqual(GONE)
    expect(a.revalidatePath).not.toHaveBeenCalled()
  })
  it('a gravação responde sem dado (não dá para saber se gravou): falha, nunca sucesso', async () => {
    const a = await load({ video: PINNED, updated: null })
    expect(await a.unpinVideo(VID)).toEqual(UNPIN_FAILED)
    expect(a.revalidatePath).not.toHaveBeenCalled()
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
    {}, { allowed: false }, { allowed: 'anon' }, { video: null }, { channel: null }, rpcOf(CAP), rpcOf({ status: 'not_found' }), rpcOf({ status: 'ok', already: true }),
    { rpc: { data: null, error: PG } }, rpcOf(null), rpcOf({ status: 'cap' }), { videoError: true }, { channelError: true }, { updateError: true },
    { video: PINNED }, { video: PINNED, updateError: true }, { video: PINNED, updated: [] }, { video: PINNED, updated: null },
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
  it('vocabulário: nenhuma frase chama o fixado de "acompanhado"', async () => {
    for (const o of CASES) {
      for (const which of ['pinVideo', 'unpinVideo'] as const) {
        const r = await (await load(o))[which](VID)
        if (!r.ok) expect(r.error).not.toMatch(/acompanh/i)
      }
    }
  })
})
