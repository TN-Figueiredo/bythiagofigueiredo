// @vitest-environment node
/**
 * F0 das sugestões (Tarefa 4, Yannis P-M2): `yt_own_versions_prova` diante de uma tentativa `sem_videos` de `meta`.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/sugestoes-f0-sem-videos-prova.test.ts --no-file-parallelism
 * Pré-requisito: o CHECK da Tarefa 2 aplicado no banco local. Tudo em transação com rollback.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, q1 } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('F0 sugestões: sem_videos de meta e yt_own_versions_prova (banco local)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação */ }
    await pg.end()
  })

  /** Vídeo público de hoje, com linha de meta e sem versão de título/thumb; `tentativaDia` = deslocamento do `attempt_day` de sem_videos em relação a p_ontem (null = sem tentativa). */
  async function prova(tentativaDia: number | null): Promise<Record<string, unknown>> {
    await pg.query('begin')
    try {
      const { site } = await criarSite(pg)
      const x = randomUUID().replace(/-/g, '')
      const canal = String((await q1(pg, `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
        values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).id)
      const yt = 'v' + x.slice(0, 10)
      const video = String((await q1(pg, `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
        values ($1, $2, $3, 'T', now()) returning id`, [site, canal, yt])).id)
      const ontem = String((await q1(pg, `select (current_date - 1)::text as d`, [])).d)
      await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, title_at_capture, description_text,
          description_sha256, thumbnail_dhash, thumbnail_sha256_at_capture, thumbnail_blob_url, privacy_status, captured_at)
        values ($1, $2::date, $3, $4, $5, 'Titulo A', 'Descricao A', md5('d'), '0f0f0f0f0f0f0f0f', md5('t'), 'https://blob.example/a', 'public', now())`, [yt, ontem, site, video, canal])
      if (tentativaDia !== null) {
        await pg.query(`insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome)
          values ('canal', $1, 'meta', $2::date + $3::int, $4, $5, 'sem_videos')`, [canal, ontem, tentativaDia, site, canal])
      }
      const r = await pg.query(`select public.yt_own_versions_prova($1, $2::date) as j`, [site, ontem])
      return r.rows[0].j as Record<string, unknown>
    } finally {
      await pg.query('rollback')
    }
  }

  it('sem tentativa nenhuma: o vídeo público sem versão de título e de thumb é sem_explicacao (linha de base)', async () => {
    const j = await prova(null)
    expect(j).toMatchObject({ publicos: 1, sem_titulo: 1, sem_thumb: 1, sem_explicacao: 1 })
  })

  it('sem_videos de meta ANTES da janela (p_ontem - 1) não explica nada', async () => {
    const j = await prova(-1)
    expect(j).toMatchObject({ publicos: 1, sem_titulo: 1, sem_explicacao: 1 })
  })

  it('sem_videos de meta do canal NA janela não explica a thumb: sem_explicacao continua 1', async () => {
    // A função trata qualquer `meta` <> 'ok' do canal como motivo do título (desenho da A5, sem_videos incluso); a thumb exige tentativa de vídeo.
    // Fica registrado: o mascaramento do título por sem_videos é limitado a vídeo público com linha de meta, que um canal vazio não tem.
    const j = await prova(0)
    expect(j).toMatchObject({ publicos: 1, sem_titulo: 1, sem_thumb: 1, sem_explicacao: 1 })
  })
})
