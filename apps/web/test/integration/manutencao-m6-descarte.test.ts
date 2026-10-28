// apps/web/test/integration/manutencao-m6-descarte.test.ts
// @vitest-environment node
/** M6 parte 5 (plano M6, Tarefa 5; itens 41, 43, 44, 88, 114, 124, 125, 127): liberar o espaço e a saída em um passo. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const D = 'competitor_video_daily'
type Resp = { status: string; codigo?: string; faltam?: Array<{ codigo: string }>; linhas?: number; bytes?: number; liberar_a_partir?: string; descartado_em?: string; descartes?: number }

describe.skipIf(skipIfNoLocalDb())('M6 parte 5: liberar o espaço e sair em um passo', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    liberadas = false
    try { await prepararM6(c, 5); await c.query('delete from public.competitor_video_daily'); await c.query(`update public.obs_archive_months set dropped_at = now() where detached_at is not null and dropped_at is null`); await f() } finally { await c.query('rollback') }
  }
  /** Meses verdes de jan a out de 2026 (para chegar aos três descartes). */
  let liberadas = false
  async function cenario(meses: string[]): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    if (!liberadas) { await liberarClasses(c, ['serie', 'ensaio']); liberadas = true }
    const s = await semearCanal(c, { videos: 2 })
    for (const mes of meses) {
      await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1)`, [mes])
      await semearDiaria(c, s.videos, mes, 28)
      await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes })
    }
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  /** O relógio anda dias entre o selo e a chamada: as atestações de 24 h / 7 d do selo vencem. Renova NAS e B2 (a retirada do B2 fica como está). */
  const renovar = (): Promise<unknown> => c.query(`update public.obs_archive_months set nas_attested_at = public.obs_archive_agora(),
      b2_forja_ok_at = case when b2_withdrawn_at is null and b2_forja_ok_at is not null then public.obs_archive_agora() else b2_forja_ok_at end
      where dropped_at is null and nas_attested_at is not null`)
  const chama = async (fn: 'detach' | 'discard' | 'drop', site: string, mes: string, por: string | null, o: { modo?: string; simular?: boolean } = {}): Promise<Resp> => {
    await renovar()
    return escalar<Resp>(c, `select public.obs_archive_${fn}_month($1, $2, $3, $4, $5, $6)`, [site, D, mes, por, o.modo ?? 'clique', o.simular ?? false])
  }   // simular SEMPRE explícito aqui; o default true tem teste próprio abaixo
  const existe = (rel: string): Promise<boolean> => escalar<boolean>(c, `select to_regclass($1) is not null`, [rel])
  const M1 = '2026-08-01', M2 = '2026-09-01', M3 = '2026-10-01', M4 = '2026-11-01'

  it('43: liberar antes do prazo recusa com cedo_demais e a data; no dia, libera e grava linhas e bytes', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-08 12:00:00+00')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'cedo_demais', liberar_a_partir: '2027-05-09' })
      await relogio(c, '2027-05-09 03:00:00+00')
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('ok')
      expect(r.linhas).toBeGreaterThan(0)
      expect(r.bytes).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(false)
      const m = (await c.query(`select dropped_at, dropped_by, drop_mode, rows_dropped, bytes_freed from public.obs_archive_months where site_id = $1 and month = $2`, [site, M1])).rows[0]
      expect(m).toMatchObject({ dropped_by: admin, drop_mode: 'clique', rows_dropped: String(r.linhas), bytes_freed: String(r.bytes) })
    })
  })

  it('44 e 125: duplo clique: o segundo responde ja_descartado com a data; _saida sumida sem registro = particao_ausente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      expect((await chama('discard', site, M1, admin)).status).toBe('ok')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
      expect((await chama('discard', site, M1, admin)).descartado_em).toBeTruthy()
      const { site: s2, admin: a2 } = await cenario([M2])
      await chama('detach', s2, M2, a2)
      await c.query(`drop table ${particaoDe(D, M2)}_saida`)
      await relogio(c, '2027-05-20 12:00:00+00')
      expect(await chama('discard', s2, M2, a2)).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
    })
  })

  it('88: liberar reconfere a cópia: B2 retirado recusa e o mês continua podendo voltar', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and month = $2`, [site, M1])
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toEqual(['b2_sem_atestacao'])
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('88: a tabela destacada mudou: liberar recusa com conteudo_mudou e não apaga', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update ${particaoDe(D, M1)}_saida set views = views + 1 where snap_date = '2026-08-03'`)
      const r = await chama('discard', site, M1, admin)
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('41 e 114: drop recusa dois_passos_obrigatorios antes do 3º descarte DA TABELA; o ensaio e mês vazio não contam; depois do 3º, sai em um passo', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1, M2, M3, M4])
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'dois_passos_obrigatorios', descartes: 0 })
      for (const [i, mes] of [M1, M2, M3].entries()) {
        await relogio(c, `2027-0${5 + i}-02 12:00:00+00`)
        { const d = await chama('detach', site, mes, admin); expect(d.status, mes + JSON.stringify(d)).toBe('ok') }
        await relogio(c, `2027-0${5 + i}-12 12:00:00+00`)
        expect((await chama('discard', site, mes, admin)).status, mes).toBe('ok')
      }
      await relogio(c, '2027-08-02 12:00:00+00')
      const r = await chama('drop', site, M4, admin)
      expect(r.status).toBe('ok')
      expect(await existe(particaoDe(D, M4))).toBe(false)
      expect(await existe(particaoDe(D, M4) + '_saida')).toBe(false)
      expect(await escalar<boolean>(c, `select detached_at is not null and dropped_at is not null from public.obs_archive_months where site_id = $1 and month = $2`, [site, M4])).toBe(true)
    })
  })

  it('114: o 3º descarte vale por tabela: três descartes da diária não liberam o drop da early', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      const r = await escalar<Resp>(c, `select public.obs_archive_drop_month($1, 'competitor_video_early', $2, $3)`, [site, M1, admin])
      expect(r).toMatchObject({ status: 'recusado', codigo: 'dois_passos_obrigatorios', descartes: 0 })
    })
  })

  it('124: drop de mês já destacado recusa com ja_destacado (é o caminho de liberar)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      await chama('detach', site, M1, admin)
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_destacado' })
    })
  })

  it('127: logo depois do descarte, remover canal volta a funcionar', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario([M1])
      await chama('detach', site, M1, admin)
      const recusa = await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])
      expect(recusa).toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      await relogio(c, '2027-05-10 12:00:00+00')
      expect((await chama('discard', site, M1, admin)).status).toBe('ok')
      { const rm = await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin]); expect(rm, JSON.stringify(rm)).toMatchObject({ ok: true }) }
    })
  })

  it('o ensaio espera 1 dia; texto sai com tabela_invalida', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([])
      expect(await escalar<Resp>(c, `select public.obs_archive_drop_month($1, 'competitor_video_comments', '2026-10-01', $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
      expect(await escalar<Resp>(c, `select public.obs_archive_discard_month($1, 'competitor_raw', '2026-10-01', $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
    })
  })

  it('simulação de liberar e de drop: nada é apagado; a resposta traz linhas e bytes', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      const r = await chama('discard', site, M1, admin, { simular: true })
      expect(r).toMatchObject({ status: 'simulado' })
      expect(r.bytes).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('I-1: drop sem o 6º argumento SIMULA (default true): num mês verde com 3 descartes, a partição continua na mãe', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      const r = await escalar<Resp>(c, `select public.obs_archive_drop_month($1, $2, $3, $4)`, [site, D, M1, admin])
      expect(r.status).toBe('simulado')
      expect(await existe(particaoDe(D, M1))).toBe(true)
      expect(await escalar<Resp>(c, `select public.obs_archive_discard_month($1, $2, $3, $4)`, [site, D, M1, admin])).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })

  it('C-1: conferiu, depois alguém mudou likes (fora da coluna de controle): o drop recusa conteudo_mudou sob a trava e a partição existe', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-08-05'`, [videos[0]])
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'conteudo_mudou' })
      expect(await existe(particaoDe(D, M1))).toBe(true)
    })
  })

  it('M2: conferiu, mudou views, conferiu de novo: a conferência anterior é apagada e o drop recusa', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-08-05'`, [videos[0]])
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: false, codigo: 'conteudo_mudou' })
      const r = await chama('drop', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(await existe(particaoDe(D, M1))).toBe(true)
    })
  })

  it('m-3: liberar reavalia a condição 13: outro site com linha na tabela destacada e B2 retirado recusa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, M1, 3)
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: M1 })
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and month = $2`, [outro.site, M1])
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('esquema: a mãe ganhou coluna depois do destaque: liberar recusa esquema_mudou (a cópia no B2 não tem a coluna)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      await relogio(c, '2027-05-10 12:00:00+00')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'esquema_mudou' })
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('o dado não existe: liberar mês que nunca foi destacado recusa com nao_destacado', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })
})
