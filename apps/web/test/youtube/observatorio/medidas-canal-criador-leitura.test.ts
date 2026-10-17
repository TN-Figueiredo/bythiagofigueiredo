// @vitest-environment node
// E5a Tarefa C4, portão (Phil e Yannis I1): a lista tem os mesmos vídeos das casas com resposta vista, e a leitura pede só a base da conta.
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { leituraDe } from './leitura-teste'
import { criadorDoCanal, type EntradaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-model'
import { listaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-lista-model'
import { lerComentariosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/comentarios-do-canal'
import { canalNaoCarregou } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado-async'
import { DEFINICAO_RETRATOS_COMENTARIOS } from '@/lib/youtube/agenda/definicoes'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const DIA = 86_400_000
const AGORA = Date.UTC(2026, 9, 24, 18)
const BASE = { formato: { fmt: 'long' as const, doisFormatos: false, soShorts: false }, agoraMs: AGORA }
const vid = (i: number, idade: number, over: Partial<VideoLido> = {}): VideoLido => ({
  id: `v${i}`, videoId: `v${i}`, publishedAt: new Date(AGORA - idade * DIA).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false,
  isShort: false, durationSeconds: 600, viewCount: 1000, likeCount: 10, commentCount: 5, likesHidden: false, commentsDisabled: false, viewsHidden: false,
  discoveredAt: null, missingSince: null, seriesTier: null, lastCheckedAt: null, ...over,
})
const K = { siteId: 's', channelId: 'c', nome: 'Matt' }
let comTexto: ProvasDeQuemVe
beforeAll(async () => { comTexto = { leitura: await leituraDe('s'), edicao: null } })

// 14 vídeos longos na base (5 com resposta), 1 Short de 10 dias e 1 longo de 200 dias, ambos com resposta fora da base
const videos = [...Array.from({ length: 14 }, (_, i) => vid(i, 35 + i)), vid(100, 10, { isShort: true }), vid(101, 200)]
const COM = ['v0', 'v1', 'v2', 'v3', 'v4']
const linhasDoQuadro = (): Record<string, Linha[]> => ({
  competitor_video_comment_snaps: videos.map(v => ({ site_id: 's', competitor_channel_id: 'c', video_id: v.id, mark: 30, status: 'ok', taken_at: new Date(AGORA - 150 * DIA).toISOString() })),
  competitor_video_comments: [
    ...[...COM, 'v100', 'v101'].map((id, i) => ({
      id: String(i + 1), site_id: 's', competitor_channel_id: 'c', video_id: id, parent_id: null, creator_replied: true, body: 'texto ' + id, body_truncated: false,
      published_at: new Date(AGORA - 30 * DIA).toISOString(),
    })),
    ...[...COM, 'v100', 'v101'].map((id, i) => ({
      id: String(i + 501), site_id: 's', competitor_channel_id: 'c', video_id: id, parent_id: String(i + 1), creator_replied: false, body: 'resposta ' + id, body_truncated: false,
      published_at: new Date(AGORA - 20 * DIA).toISOString(),
    })),
  ],
  competitor_video_comment_marks: [], competitor_agenda_runs: [{ task: DEFINICAO_RETRATOS_COMENTARIOS.nome, status: 'ok', started_at: new Date(AGORA - 150 * DIA).toISOString(), finished_at: new Date(AGORA - 3_600_000).toISOString() }],
})
const inteiro = (): CanalInteiro => ({ ...canalNaoCarregou(), videos: { lido: true, dados: videos } })
const entrada = (contagem: EntradaDoCriador['contagem']): EntradaDoCriador => ({
  nome: 'Matt', formato: BASE.formato, videos, contagem, estado: { tipo: 'ativo', pastilha: 'Ativo', base: '', ate: null } as unknown as EntradaDoCriador['estado'], agoraMs: AGORA, hojeSP: '2026-10-24',
})

describe('I1: a lista tem os mesmos vídeos das casas com resposta vista', () => {
  it('a leitura pede só os ids da base (14 de 16) e a lista só os vídeos das casas com resposta', async () => {
    const f = falsoComentarios(linhasDoQuadro())
    const c = inteiro()
    const r = await lerComentariosDoCanal(Promise.resolve(c), c, { ...K, provas: comTexto }, BASE, () => f.client)
    const ids = f.pedidos.flatMap(p => (p.ins.video_id ?? []).map(String))
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).not.toContain('v100')
    expect(ids).not.toContain('v101')
    expect(Math.max(...f.pedidos.map(p => (p.ins.video_id ?? []).length))).toBeLessThanOrEqual(14)
    expect(r.contagem?.lido).toBe(true)
    const m = criadorDoCanal(entrada(r.contagem))
    expect(m.celula).toMatchObject({ k: 5, n: 14 })
    expect(r.respostas?.lido).toBe(true)
    const l = listaDoCriador({ nome: 'Matt', resposta: r.respostas, videos, titulos: new Map(), nBase: m.bloco.nBase })
    expect(l.tipo === 'itens' ? l.grupos.map(g => g.videoId).sort() : []).toEqual(COM)
    expect(l.tipo === 'itens' ? l.nVideos : -1).toBe(m.bloco.casas.filter(x => x === 'com').length)
  })
  it('nível contagem: o total é só o dos 5 vídeos das casas, sem o Short nem o vídeo de 200 dias', async () => {
    const f = falsoComentarios(linhasDoQuadro())
    const c = inteiro()
    const r = await lerComentariosDoCanal(Promise.resolve(c), c, { ...K, provas: null }, BASE, () => f.client)
    expect(r.respostas?.lido && r.respostas.dados.nivel).toBe('contagem')
    expect(r.respostas?.lido && r.respostas.dados.total).toBe(5)
  })
  it('cliente que lança: um aviso ao Sentry sem texto nem id, e a tela cai em "não carregou"', async () => {
    const Sentry = await import('@sentry/nextjs')
    vi.mocked(Sentry.captureMessage).mockClear()
    const f = falsoComentarios(linhasDoQuadro(), { lancaEm: ['competitor_video_comment_snaps'] })
    const c = inteiro()
    const r = await lerComentariosDoCanal(Promise.resolve(c), c, { ...K, provas: comTexto }, BASE, () => f.client)
    expect(r.respostas).toBeNull()
    expect(r.contagem === null || !r.contagem.lido).toBe(true)
    if (r.contagem === null) {
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toMatch(/texto v|body/)
    }
  })
})
