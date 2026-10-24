// @vitest-environment node
/**
 * A5 · E9, Tarefa 12 (parte de integração): a fila "Saíram do YouTube" de ponta a ponta, com o SERVIÇO de verdade (leitor e respostas pela API do
 * Postgres) e o Blob falso. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e9-fila.test.ts --no-file-parallelism
 *
 * Commit de verdade (a API enxerga só o que foi confirmado); cada teste semeia o SEU site e `afterAll` apaga tudo.
 * Fora deste arquivo (precisam da sincronização real e de funções de outras etapas): itens 72, 73, 118 e 120.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, SUPABASE_URL } from '../helpers/db-seed'
import { semearCena, semearDadosDoVideo, criarCanal, criarVideo, escalar, type Cena } from '../helpers/mg6'
import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'
import { apagarVideo, apagarCanal, manter, tentarDeNovo, type CtxDeResposta } from '@/lib/youtube/observatorio/saiu/responder'
import { ehTabelaDeIdentidade } from '@/lib/youtube/observatorio/comentarios/identidade'
import { ROTULO_DA_TABELA } from '@/lib/youtube/observatorio/saiu/rotulos'
import type { ItemEsperando } from '@/lib/youtube/observatorio/saiu/modelo'
import type { ResultadoDoBlob } from '@/lib/youtube/observatorio/saiu/blob'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TITULO = 'TITULO-SEMEADO-NAO-PODE-VAZAR'

interface Cenario extends Cena { videoA3: string; canalC: string; videoC: string; ctx: CtxDeResposta }

describe.skipIf(skipIfNoLocalDb())('A5 E9 Tarefa 12: a fila de ponta (serviço de verdade, Blob falso, commit e limpeza no fim)', () => {
  let pg: Client
  const api = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const criados: Cenario[] = []

  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    for (const c of criados) {
      try {
        await pg.query(`delete from public.audit_log where site_id = $1`, [c.site])
        await pg.query(`delete from public.competitor_removed_items where site_id = $1`, [c.site])
        await pg.query(`delete from public.youtube_intelligence_tasks where site_id = $1`, [c.site])
        await pg.query(`delete from public.youtube_niches where site_id = $1`, [c.site])
        await apagarCanais(pg, 'site_id = $1', [c.site])
        await apagarSites(pg, 'id = $1', [c.site])
        await pg.query(`delete from public.organizations where id = $1`, [c.org])
        await pg.query(`delete from auth.users where id in ($1, $2)`, [c.admin, c.comum])
      } catch (e) { console.error('limpeza da fila falhou', c.site, e instanceof Error ? e.message : e) }
    }
    await pg.end()
  })

  /** 3 vídeos ausentes (canal A no ar), 1 canal ausente (com 1 vídeo) e 1 grupo de comentários ausentes (canal B no ar). */
  async function semear(): Promise<Cenario> {
    const c = await semearCena(pg)
    const videoA3 = await criarVideo(pg, c.canalA, 8)
    await semearDadosDoVideo(pg, c.site, c.canalA, videoA3)
    const canalC = await criarCanal(pg, c.site, 'Canal C')
    const videoC = await criarVideo(pg, canalC, 4)
    await semearDadosDoVideo(pg, c.site, canalC, videoC)
    await pg.query(`update public.competitor_videos set title = $2 where id = $1`, [c.videoA, TITULO])
    await pg.query(`update public.competitor_videos set missing_since = current_date - 5 where id = any($1::uuid[])`, [[c.videoA, c.videoA2, videoA3]])
    await pg.query(`update public.competitor_channels set missing_since = current_date - 6 where id = $1`, [canalC])
    await pg.query(`update public.competitor_video_comments set missing_since = current_date - 4 where video_id = $1`, [c.videoB])
    const cen: Cenario = { ...c, videoA3, canalC, videoC, ctx: { siteId: c.site, actorId: c.admin, ip: null, ua: null } }
    criados.push(cen)
    return cen
  }
  const ler = async (c: Cenario) => {
    const r = await lerFila(api, { siteId: c.site, mostrar: 20, agoraMs: Date.now(), podeResponder: true })
    if (r.estado !== 'ok') throw new Error('fila não lida: ' + JSON.stringify(r))
    return r.fila
  }
  const blobFalso = (feito: boolean) => {
    const chamadas: string[][] = []
    const fn = async (pendentes: readonly string[]): Promise<ResultadoDoBlob> => {
      chamadas.push([...pendentes])
      return feito ? { feitos: [...pendentes], restam: [], motivo: 'ok' } : { feitos: [], restam: [...pendentes], motivo: 'erro' }
    }
    return { fn, chamadas }
  }
  const n = (tabela: string, coluna: string, id: string) => escalar<number>(pg, `select count(*)::int from public.${tabela} where ${coluna} = $1`, [id])
  const TABELAS_DO_VIDEO: Array<[string, string]> = [
    ['competitor_video_daily', 'video_id'], ['competitor_video_early', 'video_id'], ['competitor_video_hourly', 'video_id'], ['competitor_video_versions', 'video_id'],
    ['competitor_field_versions', 'video_id'], ['competitor_raw', 'video_id'], ['competitor_changes', 'video_id'], ['competitor_hour_fold_log', 'video_id'],
    ['competitor_video_comment_snaps', 'video_id'], ['competitor_video_tier_spans', 'video_id'], ['competitor_video_comments', 'video_id'],
    ['competitor_readings', 'video_id'], ['youtube_intelligence_tasks', 'target_video_id'],
  ]

  it('fila de ponta: lerFila devolve os 5 itens (3 vídeos, 1 canal, 1 grupo de comentários) com os campos de 4.5', async () => {
    const c = await semear()
    const fila = await ler(c)
    expect(fila.totalEsperando).toBe(5)
    expect(fila.esperando.map(i => i.tipo).sort()).toEqual(['canal', 'comentarios', 'video', 'video', 'video'])
    const video = fila.esperando.find(i => i.chave === c.videoA) as ItemEsperando
    expect(video).toMatchObject({ tipo: 'video', titulo: TITULO, canal: 'Canal A', canalNoAr: true })
    expect(video.desde).toMatch(/^\d{4}-\d{2}-\d{2}/)
    expect(video.diasEsperando).toBeGreaterThanOrEqual(4)
    expect(video.codigo).toMatch(/^e10/)
    expect(video.previa).not.toHaveProperty('erro')
    const canal = fila.esperando.find(i => i.tipo === 'canal') as ItemEsperando
    expect(canal).toMatchObject({ chave: c.canalC, titulo: 'Canal C' })
    const grupo = fila.esperando.find(i => i.tipo === 'comentarios') as ItemEsperando
    expect(grupo.idsDoGrupo?.length).toBeGreaterThan(0)
    expect(grupo.videosDoGrupo?.length).toBeGreaterThan(0)
    // o vídeo do canal ausente não é item solto: o canal é o item
    expect(fila.esperando.find(i => i.chave === c.videoC)).toBeUndefined()
    expect(fila.podeResponder).toBe(true)
  })

  it('todo nome de tabela que a prévia devolve tem rótulo em rotulos.ts', async () => {
    const c = await semear()
    const fila = await ler(c)
    const vistas = new Set<string>()
    for (const i of fila.esperando) if (!('erro' in i.previa)) for (const t of Object.keys(i.previa.linhas)) vistas.add(t)
    expect(vistas.size).toBeGreaterThan(5)
    // tabela de identidade de autor tem tratamento próprio em rotulos.ts (nunca aparece como linha de conteúdo)
    for (const t of vistas) expect(t in ROTULO_DA_TABELA || ehTabelaDeIdentidade(t), t).toBe(true)
  })

  it('manter: decisão, autor, data e auditoria; o item muda de bloco', async () => {
    const c = await semear()
    const r = await manter(api, c.ctx, 'video', [c.videoA2])
    expect(r).toMatchObject({ desfecho: 'mantido', n: 1 })
    const linha = (await pg.query(`select removal_decision, removal_decided_by, removal_decided_at from public.competitor_videos where id = $1`, [c.videoA2])).rows[0]
    expect(linha.removal_decision).toBe('manter')
    expect(linha.removal_decided_by).toBe(c.admin)
    expect(linha.removal_decided_at).not.toBeNull()
    expect(await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1 and actor_user_id = $2`, [c.site, c.admin])).toBeGreaterThan(0)
    const fila = await ler(c)
    expect(fila.totalEsperando).toBe(4)
    expect(fila.esperando.find(i => i.chave === c.videoA2)).toBeUndefined()
    expect(fila.respondidos.some(x => x.situacao === 'mantido' && x.tipo === 'video')).toBe(true)
  })

  it('apagar vídeo de ponta: zero linhas em cada tabela filha, Blob falso com as URLs, uma linha sem conteúdo, auditoria sem título', async () => {
    const c = await semear()
    const blob = blobFalso(true)
    const r = await apagarVideo(api, c.ctx, c.videoA, 'APAGAR', { apagarDoBlob: blob.fn })
    expect(r.desfecho).toBe('apagado')
    expect(await n('competitor_videos', 'id', c.videoA)).toBe(0)
    for (const [t, col] of TABELAS_DO_VIDEO) expect(await n(t, col, c.videoA), t).toBe(0)
    expect(blob.chamadas).toHaveLength(1)
    expect(blob.chamadas[0]!.some(u => u.includes(c.videoA))).toBe(true)
    const itens = (await pg.query(`select * from public.competitor_removed_items where site_id = $1`, [c.site])).rows
    expect(itens).toHaveLength(1)
    expect(itens[0].blobs_pending).toEqual([])
    // o título semeado não está em NENHUM lugar do audit_log nem de competitor_removed_items (como texto)
    expect(await escalar<number>(pg, `select count(*)::int from public.audit_log a where to_jsonb(a)::text like '%' || $1 || '%'`, [TITULO])).toBe(0)
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_removed_items i where to_jsonb(i)::text like '%' || $1 || '%'`, [TITULO])).toBe(0)
    // o resto do site fica
    expect(await n('competitor_videos', 'id', c.videoA3)).toBe(1)
  })

  it('Blob falha uma vez: "apagando" com o que falta; tentarDeNovo conclui', async () => {
    const c = await semear()
    const falha = blobFalso(false)
    const r = await apagarVideo(api, c.ctx, c.videoA, 'APAGAR', { apagarDoBlob: falha.fn })
    expect(r.desfecho).toBe('apagando')
    expect(r.faltam?.miniaturas).toBeGreaterThan(0)
    const linha = (await pg.query(`select id, blobs_pending from public.competitor_removed_items where site_id = $1`, [c.site])).rows[0]
    expect(linha.blobs_pending.length).toBeGreaterThan(0)
    expect((await ler(c)).apagando).toHaveLength(1)
    const ok = blobFalso(true)
    const de_novo = await tentarDeNovo(api, c.ctx, Number(linha.id), { apagarDoBlob: ok.fn })
    expect(de_novo.desfecho).toBe('apagado')
    expect(ok.chamadas[0]).toEqual(linha.blobs_pending)
    expect((await pg.query(`select blobs_pending from public.competitor_removed_items where id = $1`, [linha.id])).rows[0].blobs_pending).toEqual([])
    expect((await ler(c)).apagando).toHaveLength(0)
  })

  it('a prévia que o leitor mostrou é igual, chave a chave, ao rows_deleted que o apagar devolveu (vídeo e canal)', async () => {
    const c = await semear()
    const fila = await ler(c)
    const comparar = async (item: ItemEsperando, funcao: string, args: Record<string, unknown>) => {
      expect(item.previa).not.toHaveProperty('erro')
      const previa = (item.previa as { linhas: Record<string, number> }).linhas
      const { data, error } = await api.rpc(funcao, { p_site: c.site, p_actor: c.admin, p_janela_min: 30, p_ip: null, p_ua: null, ...args })
      expect(error).toBeNull()
      expect((data as { status: string }).status).toBe('apagado')
      const apagadas = (data as { rows_deleted: Record<string, number> }).rows_deleted
      const chaves = new Set([...Object.keys(previa), ...Object.keys(apagadas)])
      for (const k of chaves) expect(previa[k] ?? 0, `${funcao}:${k}`).toBe(apagadas[k] ?? 0)
    }
    await comparar(fila.esperando.find(i => i.chave === c.videoA3) as ItemEsperando, 'competitor_video_purge', { p_video: c.videoA3 })
    await comparar(fila.esperando.find(i => i.tipo === 'canal') as ItemEsperando, 'competitor_channel_purge', { p_channel: c.canalC })
  })

  it('apagar canal de ponta: o canal e tudo dele somem, o vídeo dele também; os outros canais ficam', async () => {
    const c = await semear()
    const blob = blobFalso(true)
    const r = await apagarCanal(api, c.ctx, c.canalC, 'APAGAR', { apagarDoBlob: blob.fn })
    expect(r.desfecho).toBe('apagado')
    expect(await n('competitor_channels', 'id', c.canalC)).toBe(0)
    expect(await n('competitor_videos', 'id', c.videoC)).toBe(0)
    expect(await n('competitor_channels', 'id', c.canalA)).toBe(1)
  })
})
