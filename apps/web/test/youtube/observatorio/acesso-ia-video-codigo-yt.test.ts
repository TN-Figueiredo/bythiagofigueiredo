// @vitest-environment node
/**
 * C1 R2: `video` e `serie` aceitam o código de 11 caracteres do YouTube (o que a `consultar` entrega e manda usar), além do uuid.
 * O obs é montado por `rowsToDataset` (não um abridor falso com uuid): o teste prova o caminho que a IA percorre.
 */
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', () => ({ loadSwipeRows: async () => [], savedFromRows: () => ({ saved: undefined }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: vi.fn() }))

import { montarVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/montar'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'

const S = 'a', NOW = Date.now()
// o fixture usa `yt-<uuid>` (>11); o código real tem 11 caracteres: regrava a linha e o ytId do motor
const YT = 'ZWQAbRkPto0'
async function paginaComCodigoReal() {
  const tables = buildTables({ siteId: S, now: NOW, channels: 1, videosPerChannel: 4 })
  tables.competitor_videos!.find(v => v.id === ids.video(S, 0, 0))!.video_id = YT
  const obs = createObservatory(rowsToDataset(await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client }), NOW))
  return { siteId: 's1', now: NOW, rows: {}, obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined } as never
}

describe('video: código do YouTube', () => {
  it('o motor traduz o código para o vídeo; uuid segue valendo; código desconhecido não casa', async () => {
    const p = await paginaComCodigoReal() as { obs: ReturnType<typeof createObservatory> }
    expect(p.obs.videoByYt(YT)?.id).toBe(ids.video(S, 0, 0))
    expect(p.obs.video(ids.video(S, 0, 0))?.ytId).toBe(YT)
    expect(p.obs.videoByYt('naoexiste00')).toBeUndefined()
  })
  it('consultar -> próxima chamada -> video: o código que a consultar entrega dá o mesmo pacote que o uuid', async () => {
    const p = await paginaComCodigoReal() as { obs: ReturnType<typeof createObservatory> }
    const ytId = p.obs.videos.find(v => v.id === ids.video(S, 0, 0))!.ytId // a coluna "Código do vídeo"
    const proxima = ENTRADA.safeParse({ acao: 'video', video_id: ytId }) // _acesso-ia/consultar.ts: { acao: 'video', video_id: primeira.ytId }
    expect(proxima.success).toBe(true)
    const r = traduzir(proxima.data!)
    if (!r.ok) throw new Error('traduzir')
    const alvo = r.pedido.telas[0]!.id!
    const abrir = async () => p
    const porCodigo = await montarVideo(alvo, {}, abrir)
    const porUuid = await montarVideo(ids.video(S, 0, 0), {}, abrir)
    expect(porCodigo.tipo).toBe('concorrente')
    if (porCodigo.tipo !== 'concorrente' || porUuid.tipo !== 'concorrente') return
    expect(porCodigo.view.notFound).toBeFalsy()
    expect(porCodigo.view).toEqual(porUuid.view)
  })
  it('serie com video_id em código do YouTube usa a mesma tela e o mesmo alvo', () => {
    const r = traduzir(ENTRADA.parse({ acao: 'serie', video_id: YT, de: '2026-10-01', ate: '2026-10-31' }))
    if (!r.ok) throw new Error('traduzir')
    expect(r.pedido.telas[0]).toMatchObject({ tela: 'video?', id: YT })
  })
  it('código sem casamento: frase própria (fora do Observatório), nunca a do uuid inexistente; desfecho nao_encontrado', async () => {
    m.empacotar['video'] = vi.fn(async () => null); m.empacotar['video-proprio'] = vi.fn(async () => null)
    const r = await responder({ acao: 'video', video_id: 'naoexiste00' }, ABRIDOR_DE_SESSAO, NOW)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(r.texto).toContain('naoexiste00')
    expect(r.texto).toContain('não está no Observatório')
    expect(r.texto).toContain('consultar')
    const u = await responder({ acao: 'video', video_id: '00000000-0000-4000-8000-000000000001' }, ABRIDOR_DE_SESSAO, NOW)
    expect(u.texto).toBe('não encontrado')
  })
})
