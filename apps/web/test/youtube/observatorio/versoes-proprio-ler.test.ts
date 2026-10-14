// @vitest-environment node
// E18 T9: leitor de servidor das versões do vídeo próprio (banco falso; o banco de verdade é a Tarefa 10).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { edicaoDe } from './edicao-teste'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { ErroLeituraVersoes, lerVersoes } from '@/lib/youtube/observatorio/proprio-versoes/ler'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const OUTRO_CANAL = '9a9a9a9a-5a47-4d0e-9b1c-7e6a2d4f8a10'
const V1 = 'vid00000001', V2 = 'vid00000002'
const HOJE = dayPt(new Date())
const d = (n: number): string => addDays(HOJE, -n)
const SENTINELA = 'zz-sentinela-e18'
const DHASH = 'abcdef0123456789'

let edicao: EdicaoDoSite
beforeAll(async () => { edicao = await edicaoDe(S) })
const pedido = (extra: Record<string, unknown> = {}) => ({ edicao, canalId: C, hoje: HOJE, ytIds: [V1], ...extra })

const estado = (over: Row = {}): Row => ({ channel_id: C, site_id: S, tracking_since: d(10), derived_through: d(1), updated_at: 'x', ...over })
function versao(yt: string, campo: 'title' | 'thumb' | 'desc', id: string, over: Row = {}): Row {
  const base: Row = {
    id, youtube_video_id: yt, site_id: S, channel_id: C, video_id: 'v-' + yt, field: campo, value_text: campo === 'thumb' ? null : 'texto ' + id,
    value_hash: campo === 'thumb' ? DHASH : 'h' + id, thumb_dhash: null, thumb_anchor_dhash: null, thumb_sha256: null, thumb_blob_url: null, thumb_similar: false,
    first_day_pt: d(10), last_day_pt: d(1), first_seen_at: `${d(9)}T12:00:00Z`, last_seen_at: `${d(1)}T12:00:00Z`,
    window_start: null, window_end: null, window_precision: 'first', origin: 'linha_de_base', ab_event: null, ab_test_id: null, ab_variant_id: null,
    pre_registro: false, is_current: true, created_at: 'x',
  }
  if (campo === 'thumb') Object.assign(base, { thumb_dhash: DHASH, thumb_anchor_dhash: DHASH, thumb_sha256: 'sha', thumb_blob_url: `https://blob.test/x/${DHASH}.jpg` })
  return { ...base, ...over }
}
const troca = (over: Row = {}): Row => ({
  origin: 'fora_do_sistema', window_precision: '1d', window_start: `${d(5)}T12:00:00Z`, window_end: `${d(4)}T12:00:00Z`, ...over,
})

function comErroNaTabela(sb: SupabaseClient, tabela: string, code: string): SupabaseClient {
  return {
    from: (t: string) => {
      if (t !== tabela) return sb.from(t)
      const falha = { data: null, error: { code, message: 'conteudo ' + SENTINELA } }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'neq', 'is']) q[m] = () => q
      q.range = async () => falha
      q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(falha).then(ok, ko)
      return q
    },
  } as unknown as SupabaseClient
}
const ok = <T>(r: { acesso: string; dado?: T }): T => { if (r.acesso !== 'ok' || r.dado === undefined) throw new Error('esperava ok: ' + r.acesso); return r.dado }

describe('lerVersoes', () => {
  it('1. item 192: sem edição (null) ou objeto forjado: negado e zero chamada ao banco', async () => {
    const db = fakeSupabase({})
    expect(await lerVersoes(db.client, { ...pedido(), edicao: null })).toEqual({ acesso: 'negado' })
    expect(await lerVersoes(db.client, { ...pedido(), edicao: { siteId: S } as unknown as EdicaoDoSite })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })

  it('2. mutação de site e de canal: versão de outro site ou de outro canal não aparece', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [versao(V1, 'title', 'a'), versao(V1, 'title', 'b', { site_id: 'site-b' }), versao(V1, 'title', 'c', { channel_id: OUTRO_CANAL })],
    })
    const r = ok(await lerVersoes(db.client, pedido()))
    expect(r.videos[0]!.versoes.map(v => v.id)).toEqual(['a'])
  })

  it('3. tabela ausente: schema_ausente, sem lançar', async () => {
    const db = fakeSupabase({})
    const r = ok(await lerVersoes(comErroNaTabela(db.client, 'yt_own_versions_state', '42P01'), pedido()))
    expect(r.estado).toEqual({ estado: 'schema_ausente' })
  })

  it('4. canal sem estado: sem_estado e todo vídeo pedido com os três campos em sem_versao', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [] })
    const r = ok(await lerVersoes(db.client, pedido({ ytIds: [V1, V2] })))
    expect(r.estado).toEqual({ estado: 'sem_estado' })
    expect(r.videos.map(v => v.ytId)).toEqual([V1, V2])
    for (const v of r.videos) for (const c of ['title', 'thumb', 'desc'] as const) expect(v.registro[c]).toEqual({ estado: 'sem_versao', conferidoAte: null })
  })

  it('5. campo só com linha de base: so_linha_de_base; com troca: com_trocas; vídeo sem linha continua na resposta', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [
        versao(V1, 'title', 't1', { is_current: false, last_day_pt: d(6) }), versao(V1, 'title', 't2', troca({ first_day_pt: d(4), first_seen_at: `${d(4)}T12:00:00Z` })),
        versao(V1, 'desc', 'd1'),
      ],
    })
    const r = ok(await lerVersoes(db.client, pedido({ ytIds: [V1, V2] })))
    const v1 = r.videos.find(v => v.ytId === V1)!, v2 = r.videos.find(v => v.ytId === V2)!
    expect(v1.registro.title.estado).toBe('com_trocas')
    expect(v1.registro.desc.estado).toBe('so_linha_de_base')
    expect(v1.registro.thumb.estado).toBe('sem_versao')
    expect(v2.versoes).toEqual([])
    expect(v2.registro.title.estado).toBe('sem_versao')
  })

  it('5b. vídeo privado: thumb sem_versao com conferidoAte nulo; título só linha de base', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()], yt_own_video_versions: [versao(V1, 'title', 't1'), versao(V1, 'desc', 'd1')] })
    const v = ok(await lerVersoes(db.client, pedido())).videos[0]!
    expect(v.registro.thumb).toEqual({ estado: 'sem_versao', conferidoAte: null })
    expect(v.registro.title.estado).toBe('so_linha_de_base')
  })

  it('5c. vídeo só com thumbnail: título e descrição sem_versao, thumb so_linha_de_base', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()], yt_own_video_versions: [versao(V1, 'thumb', 'th1')] })
    const v = ok(await lerVersoes(db.client, pedido())).videos[0]!
    expect(v.registro.title.estado).toBe('sem_versao')
    expect(v.registro.desc.estado).toBe('sem_versao')
    expect(v.registro.thumb.estado).toBe('so_linha_de_base')
  })

  it('5d. thumbnail parada há 3 dias e título em dia: conferidoAte por campo', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [versao(V1, 'thumb', 'th1', { last_day_pt: d(3) }), versao(V1, 'title', 't1', { last_day_pt: d(1) })],
    })
    const v = ok(await lerVersoes(db.client, pedido())).videos[0]!
    expect(v.registro.thumb.conferidoAte).toBe(d(3))
    expect(v.registro.title.conferidoAte).toBe(d(1))
  })

  it('5e. versão pre_registro de título sem outra versão de título: continua sem_versao', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [versao(V1, 'title', 'pre', { pre_registro: true, is_current: false, origin: 'ab_lab', ab_event: 'rotacao', window_precision: 'min', window_start: `${d(20)}T12:00:00Z`, window_end: `${d(20)}T12:00:00Z` })],
    })
    const v = ok(await lerVersoes(db.client, pedido())).videos[0]!
    expect(v.registro.title).toEqual({ estado: 'sem_versao', conferidoAte: null })
    expect(v.versoes).toHaveLength(1)
    expect(v.versoes[0]!.preRegistro).toBe(true)
  })

  it('6. erro de banco e teto de linhas lançam ErroLeituraVersoes, sem o texto do banco', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()] })
    const falha = comErroNaTabela(db.client, 'yt_own_video_versions', 'XX000')
    const e = await lerVersoes(falha, pedido()).catch(x => x)
    expect(e).toBeInstanceOf(ErroLeituraVersoes)
    expect(String((e as Error).message)).not.toContain(SENTINELA)
    expect((e as ErroLeituraVersoes).motivo).toBe('erro_de_banco')
    const muitas = Array.from({ length: 1500 }, (_, i) => versao(V1, 'title', 'id' + String(i).padStart(5, '0'), { first_day_pt: d(10) }))
    const db2 = fakeSupabase({ yt_own_versions_state: [estado()], yt_own_video_versions: muitas })
    const e2 = await lerVersoes(db2.client, pedido({ tetoLinhas: 1200 })).catch(x => x)
    expect(e2).toBeInstanceOf(ErroLeituraVersoes)
    expect((e2 as ErroLeituraVersoes).motivo).toBe('passou_do_teto')
    // estado com erro de banco também lança
    const e3 = await lerVersoes(comErroNaTabela(db.client, 'yt_own_versions_state', 'XX000'), pedido()).catch(x => x)
    expect(e3).toBeInstanceOf(ErroLeituraVersoes)
  })

  it('7. ytIds vazio: nenhuma consulta às versões, o estado real do canal', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()], yt_own_video_versions: [versao(V1, 'title', 'a')] })
    const r = ok(await lerVersoes(db.client, pedido({ ytIds: [] })))
    expect(r.estado.estado).toBe('registrando')
    expect(r.videos).toEqual([])
    expect(db.trips).toEqual(['yt_own_versions_state'])
  })

  it('8. atrasoDias = hoje - 1 - conferidoAte; desde = tracking_since', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado({ derived_through: d(4), tracking_since: d(30) })] })
    const r = ok(await lerVersoes(db.client, pedido({ ytIds: [] })))
    expect(r.estado).toEqual({ estado: 'registrando', desde: d(30), conferidoAte: d(4), atrasoDias: 3 })
    const emDia = ok(await lerVersoes(fakeSupabase({ yt_own_versions_state: [estado()] }).client, pedido({ ytIds: [] })))
    expect(emDia.estado).toMatchObject({ atrasoDias: 0 })
  })

  it('9. imagemExata: verdadeira quando a URL termina em /<dhash>.jpg, falsa senão; retoque vem de thumb_similar', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [
        versao(V1, 'thumb', 'th1', { is_current: false }),
        versao(V1, 'thumb', 'th2', { thumb_blob_url: 'https://blob.test/x/outra.jpg', thumb_similar: true, origin: 'fora_do_sistema', window_precision: '1d', window_start: `${d(3)}T12:00:00Z`, window_end: `${d(2)}T12:00:00Z`, first_day_pt: d(2), first_seen_at: `${d(2)}T12:00:00Z` }),
      ],
    })
    const th = ok(await lerVersoes(db.client, pedido())).videos[0]!.versoes.filter(v => v.campo === 'thumb')
    expect(th.find(v => v.id === 'th1')!.thumb).toMatchObject({ imagemExata: true, retoque: false, dhash: DHASH })
    expect(th.find(v => v.id === 'th2')!.thumb).toMatchObject({ imagemExata: false, retoque: true })
    expect(th[0]!.texto).toBeNull()
  })

  it("10. versão com origem 'cms' no banco é lida como veio", async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()], yt_own_video_versions: [versao(V1, 'title', 'a', { origin: 'cms', window_precision: '1d', window_start: `${d(5)}T12:00:00Z`, window_end: `${d(4)}T12:00:00Z` })] })
    expect(ok(await lerVersoes(db.client, pedido())).videos[0]!.versoes[0]!.origem).toBe('cms')
  })

  it('11. ordem das versões: por campo e por vistaDesde', async () => {
    const db = fakeSupabase({
      yt_own_versions_state: [estado()],
      yt_own_video_versions: [
        versao(V1, 'desc', 'd1'),
        versao(V1, 'title', 't2', troca({ first_seen_at: `${d(4)}T12:00:00Z`, first_day_pt: d(4) })),
        versao(V1, 'thumb', 'th1'),
        versao(V1, 'title', 't1', { is_current: false, first_seen_at: `${d(9)}T12:00:00Z` }),
      ],
    })
    expect(ok(await lerVersoes(db.client, pedido())).videos[0]!.versoes.map(v => v.id)).toEqual(['t1', 't2', 'th1', 'd1'])
  })

  it('12. ytIds: inválidos saem, repetidos somem, no máximo 50', async () => {
    const db = fakeSupabase({ yt_own_versions_state: [estado()] })
    const ids = Array.from({ length: 60 }, (_, i) => `vid${String(i).padStart(8, '0')}`)
    const r = ok(await lerVersoes(db.client, pedido({ ytIds: [...ids, ids[0]!, 'inválido!', ''] })))
    expect(r.videos).toHaveLength(50)
  })

  it('13. varredura: só este arquivo consulta yt_own_video_versions fora de coleta/', () => {
    const raiz = new URL('../../../src', import.meta.url).pathname
    const achados: string[] = []
    const anda = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) { if (!p.endsWith('/lib/youtube/coleta')) anda(p); continue }
        if (/\.(ts|tsx)$/.test(n) && /from\(\s*['"`]yt_own_video_versions['"`]/.test(readFileSync(p, 'utf8'))) achados.push(p.slice(raiz.length))
      }
    }
    anda(raiz)
    expect(achados).toEqual(['/lib/youtube/observatorio/proprio-versoes/ler.ts'])
  })
})
