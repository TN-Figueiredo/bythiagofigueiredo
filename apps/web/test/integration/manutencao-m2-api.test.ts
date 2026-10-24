// apps/web/test/integration/manutencao-m2-api.test.ts
// @vitest-environment node
/**
 * Manutenção M2, itens 9 e 72, pela API (54421) com a M2 aplicada de vez. Semeia o SEU site/canal/vídeo, commita e apaga no fim.
 * 9: upsert com onConflict pelas colunas da chave funciona na particionada; gravação em mês sem partição falha alto e a
 *    leitura horária devolve falhouCruas (a tarefa vira erro 'gravacao_falhou', horaria/executar.ts:211), nunca "ok".
 * 72: a leitura embutida competitor_videos!inner pela API e a leitura como authenticated pela mãe, com as partições revogadas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb, localSupabaseUrl } from '../helpers/db-skip'
import { criarSite, criarCanal, criarVideo, criarUsuario, escalar } from '../helpers/mg6'
import { M2_EM_MIGRATION, m2NoBanco } from '../helpers/m2'
import { gravarLeituras } from '@/lib/youtube/horaria/gravar'
import type { Alvo } from '@/lib/youtube/horaria/lista'
import type { Contagem } from '@/lib/youtube/horaria/leitura'
import { apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
// Pula até a conversão existir no banco (rascunho aplicado no Step 1, ou a migration pelo `db reset` da CI depois da Tarefa 8,
// Step 0). Com M2_EM_MIGRATION = true a condição volta a ser só a do banco: migration ausente FALHA, não pula (sem verde falso).
const pular = skipIfNoLocalDb() || (!M2_EM_MIGRATION && !(await m2NoBanco(PG_URL)))

describe.skipIf(pular)('M2 pela API (pula até a conversão existir no banco)', () => {
  let pg: Client
  let sb: SupabaseClient
  let site = '', org = '', canal = '', video = '', editor = ''
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    sb = createClient(localSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
    const s = await criarSite(pg); site = s.site; org = s.org
    canal = await criarCanal(pg, site)
    video = await criarVideo(pg, canal, 3)
    editor = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [site, editor])
  })
  afterAll(async () => {
    // o gatilho de auditoria de site_memberships grava no audit_log ao apagar o vínculo: vínculo antes, audit_log depois, site por último
    await pg.query(`delete from public.site_memberships where site_id = $1`, [site])
    await pg.query(`delete from public.audit_log where site_id = $1`, [site])
    await apagarSites(pg, 'id = $1', [site])
    await pg.query(`delete from public.organizations where id = $1`, [org])
    await pg.query(`delete from auth.users where id = $1`, [editor])
    await pg.end()
  })

  it('item 9: upsert pela chave funciona e repetir não duplica', async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    const linha = { video_id: video, snap_date: hoje, views: 10, taken_at: new Date().toISOString() }
    const r1 = await sb.from('competitor_video_daily').upsert([linha], { onConflict: 'video_id,snap_date', ignoreDuplicates: true }).select('video_id')
    expect(r1.error).toBeNull()
    const r2 = await sb.from('competitor_video_daily').upsert([linha], { onConflict: 'video_id,snap_date', ignoreDuplicates: true }).select('video_id')
    expect(r2.error).toBeNull()
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1`, [video])).toBe(1)
  })

  it('item 9: upsert da diária em mês sem partição falha alto com 23514 (a coleta diária lança, competitor-sync.ts:862)', async () => {
    const longe = new Date(Date.now() + 15 * 31 * 24 * 3_600_000).toISOString().slice(0, 10) // além dos 12 meses criados
    const r = await sb.from('competitor_video_daily').upsert([{ video_id: video, snap_date: longe, views: 1, taken_at: new Date().toISOString() }], { onConflict: 'video_id,snap_date' })
    expect(r.error?.code).toBe('23514')
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1 and snap_date = $2::date`, [video, longe])).toBe(0)
  })

  it('item 9: leitura horária em mês sem partição falha alto (falhouCruas), nada gravado', async () => {
    const longe = Date.now() + 15 * 31 * 24 * 3_600_000 // 15 meses à frente: além dos 12 criados
    const alvo: Alvo = { ytId: 'yt-' + video.slice(0, 8), tipo: 'concorrente', uuid: video, canalId: canal, siteId: site, publishedAt: new Date(longe - 30 * 24 * 3_600_000).toISOString(), descobertoEm: null }
    const contagem: Contagem = { ytId: alvo.ytId, lidoEm: new Date(longe).toISOString(), views: 5, likes: null, comments: null, privacidade: null }
    const r = await gravarLeituras(sb, [alvo], [contagem], { agoraMs: longe, podeGravar: () => true })
    expect(r.falhouCruas).toBe(true)
    expect(r.cruas).toBe(0)
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_hourly where video_id = $1`, [video])).toBe(0)
  })

  it('item 72: a leitura embutida competitor_videos!inner pela API devolve a linha do site', async () => {
    const { data, error } = await sb.from('competitor_video_daily')
      .select('snap_date, taken_at, competitor_videos!inner(competitor_channels!inner(site_id))')
      .eq('competitor_videos.competitor_channels.site_id', site)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('item 72: authenticated lê pela mãe (RLS da mãe), e não lê a partição diretamente', async () => {
    await pg.query('begin')
    try {
      // o nome se calcula ANTES de trocar de papel: authenticated não tem execute em obs_part.* (chamar derruba o Postgres local)
      const part = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_daily', obs_part.mes_corrente_sp())`)
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: editor, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [site])
      await pg.query('set local role authenticated')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1`, [video])).toBe(1)
      await pg.query('savepoint s2')
      await expect(pg.query(`select count(*) from obs_part.${part}`)).rejects.toThrow(/permission denied/)
      await pg.query('rollback to savepoint s2')
    } finally { await pg.query('rollback') }
  })
})
