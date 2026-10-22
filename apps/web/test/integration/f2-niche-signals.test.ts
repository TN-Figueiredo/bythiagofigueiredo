// @vitest-environment node
/**
 * F2 T4: niche_signals, gravação atômica, dispensar, expirar e âncoras contra Postgres de verdade. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-niche-signals.test.ts --no-file-parallelism
 * Quase tudo dentro de begin/rollback; o "relógio" é simulado por `update` das datas (a função usa now()).
 * Só o teste de concorrência grava de verdade (duas conexões) e limpa o site no fim.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface Item { kind?: string; subject_key: string; evidence?: unknown; forca?: number; acao?: string; motivo?: string; notificar_como?: string }
const ESTADO = { rule_version: 'sinais-v1+semente-1', motivo_vazio: null, contagens: { n: 1 } }

function outlier(i: number, mult = 5 + i): Record<string, unknown> {
  return { video_id: randomUUID(), canal_id: randomUUID(), published_at: '2026-10-01T00:00:00Z', mult_vpd7: mult, mult_tela: mult, vpd7: 100, formato: 'long' }
}
function item(chave: string, extra: Partial<Item> = {}): Item {
  return {
    kind: 'destino', subject_key: chave, forca: 10, acao: 'video_novo', motivo: 'dois canais estouraram',
    evidence: { outliers: [outlier(0), outlier(1)], outliers_total: 2, canais: 2, proprios: [] }, ...extra,
  }
}

describe.skipIf(skipIfNoLocalDb())('F2 T4: niche_signals (gravar, expirar, dispensar, âncoras)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
  })

  async function tx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }
  async function gravar(site: string, lote: Item[], opts: { base?: boolean; vistos?: unknown[]; estado?: unknown } = {}): Promise<{ novos: number; atualizados: number; expirados: number }> {
    const r = await pg.query(`select public.niche_signals_gravar($1, $2::jsonb, $3::jsonb, $4, $5::jsonb) as r`,
      [site, JSON.stringify(lote), JSON.stringify(opts.estado ?? ESTADO), opts.base ?? false, JSON.stringify(opts.vistos ?? [])])
    return r.rows[0].r
  }
  async function dispensar(site: string, id: string, status: string, motivo: string | null, por = 'user:x'): Promise<{ ok: boolean; motivo?: string }> {
    const r = await pg.query(`select public.niche_signals_dispensar($1, $2, $3, $4, $5) as r`, [site, id, status, motivo, por])
    return r.rows[0].r
  }
  async function linhas(site: string, chave?: string) {
    const r = await pg.query(`select * from public.niche_signals where site_id = $1 ${chave ? 'and subject_key = $2' : ''} order by first_seen_at, status desc`, chave ? [site, chave] : [site])
    return r.rows
  }
  async function visto(site: string, chaves: string[], diasPrimeiro: number): Promise<string> {
    const id = randomUUID()
    await pg.query(
      `insert into public.niche_outliers_vistos (site_id, video_id, canal_id, formato, published_at, n_canal, primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)
       values ($1, $2, $3, 'long', now(), 10, now() - make_interval(days => $4), now(), 6, 100, $5)`, [site, id, randomUUID(), diasPrimeiro, chaves])
    return id
  }
  async function notificar(site: string, user: string, dedup: string, payload: unknown = {}): Promise<string> {
    const r = await pg.query(
      `insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key, payload)
       values ($1, $2, 'youtube.niche_signal', 'youtube', 2, 't', $3, $4::jsonb) returning id`, [site, user, dedup, JSON.stringify(payload)])
    return r.rows[0].id
  }
  async function conta(site: string, user: string): Promise<number> {
    // consulta idêntica à de /api/notifications/count
    return await escalar<number>(pg, `select count(id)::int from public.notifications where site_id = $1 and user_id = $2
      and dismissed_at is null and expired_at is null and read_at is null`, [site, user])
  }

  it('funções só para service_role', async () => {
    for (const f of ['niche_signals_gravar(uuid,jsonb,jsonb,boolean,jsonb)', 'niche_signals_expirar(uuid)', 'niche_signals_dispensar(uuid,uuid,text,text,text)', 'niche_signals_ancoras(uuid)']) {
      expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', 'public.${f}', 'execute')`), f).toBe(false)
      expect(await escalar<boolean>(pg, `select has_function_privilege('anon', 'public.${f}', 'execute')`), f).toBe(false)
      expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', 'public.${f}', 'execute')`), f).toBe(true)
    }
  })

  it('grava, devolve contagens, estado e validade fixa de 30 d; 2ª chamada atualiza sem duplicar', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      expect(await gravar(site, [item('pais:VN')])).toEqual({ novos: 1, atualizados: 0, expirados: 0 })
      const [l] = await linhas(site)
      expect(l.status).toBe('aberto')
      expect(l.notificar_como).toBe('individual')
      expect(await escalar<number>(pg, `select extract(epoch from (expires_at - first_seen_at))::int / 86400 from public.niche_signals where id = $1`, [l.id])).toBe(30)
      expect(await gravar(site, [item('pais:VN', { forca: 20, motivo: 'novo motivo' })])).toEqual({ novos: 0, atualizados: 1, expirados: 0 })
      const l2 = await linhas(site)
      expect(l2).toHaveLength(1)
      expect(Number(l2[0].forca)).toBe(20)
      expect(l2[0].motivo).toBe('novo motivo')
      expect(l2[0].expires_at.getTime()).toBe(l.expires_at.getTime())
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signals_estado where site_id = $1`, [site])).toBe(1)
    })
  })

  it('linha de base grava notificar_como = resumo', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN'), item('pais:TH')], { base: true })
      expect((await linhas(site)).map(l => l.notificar_como)).toEqual(['resumo', 'resumo'])
    })
  })

  it('baseline_em já preenchido não muda ao gravar de novo (Yannis)', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      await pg.query(`update public.niche_signals_estado set baseline_em = '2026-01-01T00:00:00Z' where site_id = $1`, [site])
      await gravar(site, [item('pais:VN')], { estado: { ...ESTADO, motivo_vazio: 'sem-grupo' } })
      const r = await pg.query(`select baseline_em, motivo_vazio from public.niche_signals_estado where site_id = $1`, [site])
      expect(r.rows[0].baseline_em.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(r.rows[0].motivo_vazio).toBe('sem-grupo')
    })
  })

  it('falha no passo 3 (forca fora do numeric) desfaz o passo 1 e o 2', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN'), item('pais:VELHO')])
      await pg.query(`update public.niche_signals set expires_at = now() - interval '1 day' where site_id = $1 and subject_key = 'pais:VELHO'`, [site])
      await pg.query('savepoint s')
      await expect(gravar(site, [item('pais:NOVO'), item('pais:VN', { forca: 99999999 })])).rejects.toThrow()
      await pg.query('rollback to savepoint s')
      const l = await linhas(site)
      expect(l.map(x => x.subject_key).sort()).toEqual(['pais:VELHO', 'pais:VN'])
      expect(l.find(x => x.subject_key === 'pais:VELHO')?.status).toBe('aberto')
    })
  })

  it('duas chamadas concorrentes com o mesmo lote deixam 1 linha', async () => {
    const b = new Client({ connectionString: PG_URL })
    await b.connect()
    const { org, site } = await criarSite(pg)
    try {
      const sql = `select public.niche_signals_gravar($1, $2::jsonb, $3::jsonb, false, '[]'::jsonb)`
      const args = [site, JSON.stringify([item('pais:VN')]), JSON.stringify(ESTADO)]
      await Promise.all([pg.query(sql, args), b.query(sql, args)])
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signals where site_id = $1`, [site])).toBe(1)
    } finally {
      await b.end()
      await pg.query(`delete from public.sites where id = $1`, [site])
      await pg.query(`delete from public.organizations where id = $1`, [org])
    }
  })

  it('dispensar → regravar continua dispensado e nada novo; carência 29 d bloqueia, 31 d cria', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      const [l] = await linhas(site)
      expect(await dispensar(site, l.id, 'dispensado', 'lugar_errado')).toEqual({ ok: true })
      expect(await gravar(site, [item('pais:VN')])).toEqual({ novos: 0, atualizados: 0, expirados: 0 })
      expect((await linhas(site)).map(x => x.status)).toEqual(['dispensado'])
      await pg.query(`update public.niche_signals set dispensado_em = now() - interval '29 days' where id = $1`, [l.id])
      expect((await gravar(site, [item('pais:VN')])).novos).toBe(0)
      await pg.query(`update public.niche_signals set dispensado_em = now() - interval '31 days' where id = $1`, [l.id])
      expect((await gravar(site, [item('pais:VN')])).novos).toBe(1)
      expect((await linhas(site)).map(x => x.status)).toEqual(['dispensado', 'aberto'])
    })
  })

  it('evidence: published_at/canal_id da criação não mudam; teto de 20 e outliers_total conta tudo', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const primeiros = Array.from({ length: 3 }, (_, i) => outlier(i))
      await gravar(site, [item('pais:VN', { evidence: { outliers: primeiros, outliers_total: 3, canais: 2, proprios: [] } })])
      const alterado = { ...primeiros[0], published_at: '2020-01-01T00:00:00Z', canal_id: randomUUID() }
      const muitos = Array.from({ length: 30 }, (_, i) => outlier(i + 10))
      await gravar(site, [item('pais:VN', { evidence: { outliers: [alterado, ...muitos], outliers_total: 33, canais: 4, proprios: ['p'] } })])
      const [l] = await linhas(site)
      expect(l.evidence.outliers).toHaveLength(20)
      expect(l.evidence.outliers_total).toBe(33)
      expect(l.evidence.canais).toBe(4)
      const porId = new Map((l.evidence.outliers as Array<{ video_id: string }>).map(o => [o.video_id, o]))
      expect(porId.get(primeiros[0].video_id as string)).toEqual(primeiros[0])
      for (const o of primeiros) expect(porId.get(o.video_id as string)).toEqual(o)
    })
  })

  it('criação com mais de 20 outliers guarda os 20 mais fortes e o total', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const todos = Array.from({ length: 25 }, (_, i) => outlier(i, 5 + i))
      await gravar(site, [item('pais:VN', { evidence: { outliers: todos, outliers_total: 25, canais: 3, proprios: [] } })])
      const [l] = await linhas(site)
      expect(l.evidence.outliers).toHaveLength(20)
      expect(l.evidence.outliers_total).toBe(25)
      expect(Math.min(...l.evidence.outliers.map((o: { mult_vpd7: number }) => o.mult_vpd7))).toBe(10)
    })
  })

  it('âncora até o fim do evento (Phil N1): C entra no dia 10, E1 expira no dia 30; D no dia 31 não é âncora', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      await pg.query(`update public.niche_signals set first_seen_at = now() - interval '31 days', expires_at = now() - interval '1 day' where site_id = $1`, [site])
      const a = await visto(site, ['pais:VN'], 31)
      const b = await visto(site, ['pais:VN'], 31)
      const c = await visto(site, ['pais:VN'], 21)
      const d = await visto(site, ['pais:VN'], 0)
      const r = await gravar(site, [])
      expect(r.expirados).toBe(1)
      const anc = await pg.query(`select video_id from public.niche_signals_ancoras($1) where subject_key = 'pais:VN'`, [site])
      const ids = anc.rows.map(x => x.video_id).sort()
      expect(ids).toEqual([a, b, c].sort())
      expect(ids).not.toContain(d)
    })
  })

  it('evento com 25 outliers vistos, dia 30: o 21º continua âncora (sem teto)', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN', { evidence: { outliers: Array.from({ length: 25 }, (_, i) => outlier(i)), outliers_total: 25, canais: 3, proprios: [] } })])
      await pg.query(`update public.niche_signals set first_seen_at = now() - interval '30 days', expires_at = now() where site_id = $1`, [site])
      const vistos: string[] = []
      for (let i = 0; i < 25; i++) vistos.push(await visto(site, ['pais:VN'], 30 - (i % 5)))
      await gravar(site, [])
      const anc = (await pg.query(`select video_id from public.niche_signals_ancoras($1)`, [site])).rows.map(x => x.video_id)
      expect(anc).toHaveLength(25)
      expect(anc).toContain(vistos[20])
      expect((await linhas(site))[0].status).toBe('expirado')
    })
  })

  it('"feito" seguido de regravação: os outliers do evento seguem como âncora', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      const a = await visto(site, ['pais:VN'], 5)
      const [l] = await linhas(site)
      expect(await dispensar(site, l.id, 'feito', null)).toEqual({ ok: true })
      await pg.query(`update public.niche_signals set dispensado_em = now() - interval '1 day' where id = $1`, [l.id])
      const novo = await visto(site, ['pais:VN'], 0)
      const anc = (await pg.query(`select video_id from public.niche_signals_ancoras($1)`, [site])).rows.map(x => x.video_id)
      expect(anc).toContain(a)
      expect(anc).not.toContain(novo)
    })
  })

  it('sem evento nos últimos 60 d não há âncora', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      await visto(site, ['pais:VN'], 70)
      await pg.query(`update public.niche_signals set first_seen_at = now() - interval '61 days', expires_at = now() - interval '31 days' where site_id = $1`, [site])
      expect((await pg.query(`select * from public.niche_signals_ancoras($1)`, [site])).rowCount).toBe(0)
    })
  })

  it('vistos: upsert com least/greatest', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = { video_id: randomUUID(), canal_id: randomUUID(), formato: 'long', published_at: '2026-10-01T00:00:00Z', n_canal: 9, mult_max: 6, vpd7_max: 100, chaves: ['pais:VN'] }
      await gravar(site, [], { vistos: [v] })
      await pg.query(`update public.niche_outliers_vistos set primeiro_visto_em = now() - interval '5 days' where site_id = $1`, [site])
      await gravar(site, [], { vistos: [{ ...v, mult_max: 4, vpd7_max: 300 }] })
      const r = (await pg.query(`select * from public.niche_outliers_vistos where site_id = $1`, [site])).rows
      expect(r).toHaveLength(1)
      expect(Number(r[0].mult_max)).toBe(6)
      expect(Number(r[0].vpd7_max)).toBe(300)
      expect(Date.now() - r[0].primeiro_visto_em.getTime()).toBeGreaterThan(4 * 86_400_000)
    })
  })

  it('dispensar mantém motivo e preenche dispensa_motivo/dispensado_por; motivo fora do enum é inválido', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN')])
      const [l] = await linhas(site)
      expect(await dispensar(site, l.id, 'dispensado', 'banana')).toEqual({ ok: false, motivo: 'motivo_invalido' })
      expect(await dispensar(site, l.id, 'dispensado', null)).toEqual({ ok: false, motivo: 'motivo_invalido' })
      expect(await dispensar(site, l.id, 'dispensado', 'ja_fiz', 'user:abc')).toEqual({ ok: true })
      const [d] = await linhas(site)
      expect(d.motivo).toBe('dois canais estouraram')
      expect(d.dispensa_motivo).toBe('ja_fiz')
      expect(d.dispensado_por).toBe('user:abc')
      expect(d.status).toBe('dispensado')
      expect(await dispensar(site, l.id, 'dispensado', 'ja_fiz')).toEqual({ ok: false, motivo: 'nao_aberto' })
      expect(await dispensar(site, randomUUID(), 'dispensado', 'ja_fiz')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    })
  })

  it('E-2: nao_e_parecido só em parecido, lugar_errado só em destino; ja_fiz e nao_interessa nos dois', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await gravar(site, [item('pais:VN'), item('video:1', { kind: 'parecido', acao: 'titulo_complementar' })])
      const dest = (await linhas(site, 'pais:VN'))[0]
      const par = (await linhas(site, 'video:1'))[0]
      expect(await dispensar(site, dest.id, 'dispensado', 'nao_e_parecido')).toEqual({ ok: false, motivo: 'motivo_invalido' })
      expect(await dispensar(site, par.id, 'dispensado', 'lugar_errado')).toEqual({ ok: false, motivo: 'motivo_invalido' })
      expect(await dispensar(site, dest.id, 'dispensado', 'nao_interessa')).toEqual({ ok: true })
      expect(await dispensar(site, par.id, 'dispensado', 'ja_fiz')).toEqual({ ok: true })
      const feitos = await linhas(site)
      expect(feitos.every(x => x.status === 'dispensado')).toBe(true)
    })
  })

  it('niche_signals_expirar no site A não expira o resumo do site B', async () => {
    await tx(async () => {
      const a = await criarSite(pg)
      const b = await criarSite(pg)
      const u = await criarUsuario(pg)
      await notificar(b.site, u, 'nicho-resumo:2026-10-22:abc', { ids: [randomUUID()] })
      await pg.query(`select public.niche_signals_expirar($1)`, [a.site])
      expect(await conta(b.site, u)).toBe(1)
      await pg.query(`select public.niche_signals_expirar($1)`, [b.site])
      expect(await conta(b.site, u)).toBe(0)
    })
  })

  it('resumo só expira quando nenhum id continua aberto', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const u = await criarUsuario(pg)
      await gravar(site, [item('pais:VN'), item('pais:TH')])
      const ls = await linhas(site)
      await notificar(site, u, 'nicho-resumo:2026-10-22:abc', { ids: ls.map(l => l.id) })
      await dispensar(site, ls[0].id, 'dispensado', 'ja_fiz')
      expect(await conta(site, u)).toBe(1)
      await dispensar(site, ls[1].id, 'dispensado', 'ja_fiz')
      expect(await conta(site, u)).toBe(0)
    })
  })

  it('dispensar derruba o que /api/notifications/count lê', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const u = await criarUsuario(pg)
      await gravar(site, [item('pais:VN')])
      const [l] = await linhas(site)
      await notificar(site, u, `nicho:${l.id}`, { ids: [l.id] })
      expect(await conta(site, u)).toBe(1)
      await dispensar(site, l.id, 'dispensado', 'lugar_errado')
      expect(await conta(site, u)).toBe(0)
    })
  })

  it('gravador parado 31 dias: linha já notificada vencida expira e derruba a notificação na 1ª execução', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const u = await criarUsuario(pg)
      await gravar(site, [item('pais:VN')])
      const [l] = await linhas(site)
      await pg.query(`update public.niche_signals set notificado_em = now() - interval '31 days', first_seen_at = now() - interval '31 days',
        expires_at = now() - interval '1 day' where id = $1`, [l.id])
      await notificar(site, u, `nicho:${l.id}`)
      expect(await conta(site, u)).toBe(1)
      const r = await gravar(site, [])
      expect(r.expirados).toBe(1)
      expect((await linhas(site))[0].status).toBe('expirado')
      expect(await conta(site, u)).toBe(0)
    })
  })

  it('niche_signals_expirar direto, sem o gravador, expira a notificação da linha já notificada e vencida', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const u = await criarUsuario(pg)
      await gravar(site, [item('pais:VN')])
      const [l] = await linhas(site)
      await pg.query(`update public.niche_signals set notificado_em = now() - interval '31 days', expires_at = now() - interval '1 day' where id = $1`, [l.id])
      await notificar(site, u, `nicho:${l.id}`)
      expect(await escalar<number>(pg, `select public.niche_signals_expirar($1)`, [site])).toBe(1)
      expect(await conta(site, u)).toBe(0)
      expect(await escalar<number>(pg, `select public.niche_signals_expirar($1)`, [site])).toBe(0)
    })
  })
})
