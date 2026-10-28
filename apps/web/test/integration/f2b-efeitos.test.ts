// @vitest-environment node
/**
 * F2b T2: niche_signal_efeitos / niche_signal_efeito_bracos, fila de pares abertos, gravação atômica e contagem contra
 * Postgres de verdade. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2b-efeitos.test.ts --no-file-parallelism
 * Tudo dentro de begin/rollback; o "relógio" é simulado pelas datas inseridas (as funções usam now()).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const JANELA = 14
const METRICAS = ['views_total', 'impressoes_total', 'impressoes_busca', 'impressoes_canal', 'impressoes_sugeridos',
  'impressoes_inicio', 'views_sugeridos', 'views_busca', 'views_inicio', 'prova_related']

interface Fila { signal_id: string; outlier_video_id: string; canal_id: string; chave: string; metricas_faltantes: string[]; outlier_published_at: Date }

describe.skipIf(skipIfNoLocalDb())('F2b T2: efeitos da medida D2 (tabelas, fila, gravar, contagem)', () => {
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
  /** Sinal `destino` com `first_seen_at` há `diasAtras` dias, vivo por 30 d (ou `fimDiasAtras` quando dado, via dispensado_em). */
  async function sinal(site: string, chave: string, diasAtras: number, outliers: Array<{ video: string; canal: string; pub: string }> = [], fimDiasAtras?: number): Promise<string> {
    const ev = { outliers: outliers.map((o) => ({ video_id: o.video, canal_id: o.canal, published_at: o.pub })), outliers_total: outliers.length, canais: 2, proprios: [] }
    const r = await pg.query(
      `insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, dispensado_em, motivo)
       values ($1, 'destino', $2, 'sinais-v1', $3::jsonb, 10, 'video_novo', $6,
               now() - make_interval(days => $4), now(), now() - make_interval(days => $4) + interval '30 days',
               case when $5::int is null then null else now() - make_interval(days => $5::int) end, 'm') returning id`,
      [site, chave, JSON.stringify(ev), diasAtras, fimDiasAtras ?? null, fimDiasAtras == null ? 'aberto' : 'dispensado'])
    return r.rows[0].id
  }
  /** Outlier em `niche_outliers_vistos`: publicado há `pubDias` dias, visto pela 1ª vez há `vistoDias` dias. */
  async function visto(site: string, chaves: string[], pubDias: number, vistoDias: number, canal = randomUUID()): Promise<string> {
    const id = randomUUID()
    await pg.query(
      `insert into public.niche_outliers_vistos (site_id, video_id, canal_id, formato, published_at, n_canal, primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)
       values ($1, $2, $3, 'long', now() - make_interval(days => $4), 10, now() - make_interval(days => $5), now(), 6, 100, $6)`,
      [site, id, canal, pubDias, vistoDias, chaves])
    return id
  }
  async function fila(site: string, metricas = METRICAS): Promise<Fila[]> {
    const r = await pg.query(`select * from public.niche_signal_pares_abertos($1, $2::text[], $3)`, [site, metricas, JANELA])
    return r.rows
  }
  async function gravar(site: string, bracos: unknown[], linhas: unknown[]): Promise<Record<string, number>> {
    const r = await pg.query(`select public.niche_signal_efeitos_gravar($1, $2::jsonb, $3::jsonb) as r`, [site, JSON.stringify(bracos), JSON.stringify(linhas)])
    return r.rows[0].r
  }
  function linha(signal: string, video: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { signal_id: signal, outlier_video_id: video, canal_id: randomUUID(), outlier_published_at: '2026-09-01T00:00:00Z', papel: 'alvo', metrica: 'views_total',
      anos_atras: 0, pre: 10, pos: 20, estado: 'medido', motivo: null, dias_sem_cobertura: null, versao_regra: 'd2-v1', ...extra }
  }
  function braco(signal: string, video: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { signal_id: signal, outlier_video_id: video, papel: 'alvo', anos_atras: 0, chave: 'pais:VN', videos: ['a', 'b'], chaves_em_evento: [], ...extra }
  }
  async function tentar(sql: string, params: unknown[]): Promise<boolean> {
    await pg.query('savepoint t')
    try { await pg.query(sql, params); await pg.query('release savepoint t'); return true } catch { await pg.query('rollback to savepoint t'); return false }
  }

  it('funções só para service_role; tabelas sem grant para authenticated', async () => {
    for (const f of ['niche_signal_pares_base(uuid,int)', 'niche_signal_pares_abertos(uuid,text[],int)', 'niche_signal_efeitos_gravar(uuid,jsonb,jsonb)', 'niche_signal_medida_contagem(uuid,int)']) {
      expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', 'public.${f}', 'execute')`), f).toBe(false)
      expect(await escalar<boolean>(pg, `select has_function_privilege('anon', 'public.${f}', 'execute')`), f).toBe(false)
      expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', 'public.${f}', 'execute')`), f).toBe(true)
    }
    for (const t of ['niche_signal_efeitos', 'niche_signal_efeito_bracos']) {
      expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', 'public.${t}', 'select')`), t).toBe(false)
      expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.${t}', 'select')`), t).toBe(false)
      expect(await escalar<boolean>(pg, `select has_table_privilege('service_role', 'public.${t}', 'select')`), t).toBe(true)
      expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`), t).toBe(true)
      expect(await escalar<number>(pg, `select count(*)::int from pg_policies where schemaname = 'public' and tablename = $1`, [t]), t).toBe(0)
    }
  })

  it('authenticated com GUC falsificado vê 0 linhas (RLS sem policy)', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      await gravar(site, [], [linha(s, v)])
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signal_efeitos`)).toBe(1)
      await pg.query(`select set_config('app.site_id', $1, true)`, [site])
      await pg.query('set local role authenticated')
      try {
        // sem grant de select a tabela nem abre; o que importa é nenhuma linha vazar
        const ok = await tentar(`select count(*) from public.niche_signal_efeitos`, [])
        expect(ok).toBe(false)
      } finally { await pg.query('reset role') }
    })
  })

  it('reexecutar não altera linha fechada (pre intacto, ignoradas >= 1)', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      expect(await gravar(site, [braco(s, v)], [linha(s, v, { pre: 10 })])).toMatchObject({ inseridas: 1, ignoradas: 0, bracos_inseridos: 1, de_outro_site: 0 })
      const r = await gravar(site, [braco(s, v)], [linha(s, v, { pre: 999 })])
      expect(r).toMatchObject({ inseridas: 0, ignoradas: 1, bracos_inseridos: 0, bracos_ignorados: 1 })
      expect(await escalar<number>(pg, `select pre::int from public.niche_signal_efeitos where signal_id = $1`, [s])).toBe(10)
    })
  })

  it('signal_id de outro site: de_outro_site = 1 e nada gravado', async () => {
    await tx(async () => {
      const a = await criarSite(pg)
      const b = await criarSite(pg)
      const v = randomUUID()
      const sB = await sinal(b.site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      const r = await gravar(a.site, [], [linha(sB, v)])
      expect(r).toMatchObject({ inseridas: 0, de_outro_site: 1 })
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signal_efeitos`)).toBe(0)
    })
  })

  it('checks: medido sem pre viola; par medido viola; par fora de papel alvo viola; motivos novos aceitos', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      await pg.query('savepoint a')
      await expect(gravar(site, [], [linha(s, v, { pre: null })])).rejects.toThrow()
      await pg.query('rollback to savepoint a')
      await expect(gravar(site, [], [linha(s, v, { metrica: 'par', estado: 'medido' })])).rejects.toThrow()
      await pg.query('rollback to savepoint a').catch(() => undefined)
      await pg.query('savepoint b')
      await expect(gravar(site, [], [linha(s, v, { metrica: 'par', estado: 'nao_medido', motivo: 'pre_contaminado', papel: 'controle', pre: null, pos: null })])).rejects.toThrow()
      await pg.query('rollback to savepoint b')
      await pg.query('savepoint c')
      await expect(gravar(site, [], [linha(s, v, { motivo: 'inventado', estado: 'nao_medido', pre: null, pos: null })])).rejects.toThrow()
      await pg.query('rollback to savepoint c')
      const r = await gravar(site, [], [
        linha(s, v, { metrica: 'views_busca', estado: 'nao_medido', motivo: 'em_revisao', pre: null, pos: null }),
        linha(s, v, { metrica: 'views_inicio', estado: 'nao_medido', motivo: 'sem_valor', pre: null, pos: null }),
        linha(s, v, { metrica: 'par', estado: 'nao_medido', motivo: 'pre_contaminado', pre: null, pos: null })])
      expect(r).toMatchObject({ inseridas: 3 })
    })
  })

  it('placebo do alvo e do controle (anos_atras = 1) coexistem: inseridas = 2', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      const r = await gravar(site, [], [linha(s, v, { papel: 'alvo', anos_atras: 1 }), linha(s, v, { papel: 'controle', anos_atras: 1 })])
      expect(r).toMatchObject({ inseridas: 2, ignoradas: 0 })
    })
  })

  it('prova_related: medido com pre = 0 e pos = presença é aceito; pre nulo viola', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      expect(await gravar(site, [], [linha(s, v, { metrica: 'prova_related', pre: 0, pos: 3 })])).toMatchObject({ inseridas: 1 })
      await pg.query('savepoint p')
      await expect(gravar(site, [], [linha(s, v, { metrica: 'prova_related', papel: 'controle', pre: null, pos: 3 })])).rejects.toThrow()
      await pg.query('rollback to savepoint p')
    })
  })

  it('fila: só views_total gravada (alvo e controle) deixa 9 métricas faltantes; só o alvo não tira a métrica', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      expect((await fila(site))[0].metricas_faltantes).toHaveLength(10)
      await gravar(site, [], [linha(s, v, { papel: 'alvo' })])
      expect((await fila(site))[0].metricas_faltantes).toHaveLength(10) // N5: falta o controle
      await gravar(site, [], [linha(s, v, { papel: 'controle' })])
      const f = await fila(site)
      expect(f).toHaveLength(1)
      expect(f[0].metricas_faltantes).toHaveLength(9)
      expect(f[0].metricas_faltantes).not.toContain('views_total')
    })
  })

  it('fila: só a linha par (papel alvo), sem controle, encerra o par', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      expect(await fila(site)).toHaveLength(1)
      await gravar(site, [], [linha(s, v, { metrica: 'par', papel: 'alvo', estado: 'nao_medido', motivo: 'contaminacao_desconhecida', pre: null, pos: null })])
      expect(await fila(site)).toHaveLength(0)
    })
  })

  it('fila: outlier nº 21 (só em vistos) entra e some depois de gravado', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const pub = new Date(Date.now() - 6 * 86400000).toISOString()
      const evid = Array.from({ length: 20 }, () => ({ video: randomUUID(), canal: randomUUID(), pub }))
      const s = await sinal(site, 'pais:VN', 5, evid)
      const extra = await visto(site, ['pais:VN'], 6, 4)
      const f = await fila(site)
      expect(f).toHaveLength(21)
      expect(f.map((x) => x.outlier_video_id)).toContain(extra)
      await gravar(site, [], [linha(s, extra, { metrica: 'par', estado: 'nao_medido', motivo: 'sem_alvo', pre: null, pos: null })])
      expect((await fila(site)).map((x) => x.outlier_video_id)).not.toContain(extra)
    })
  })

  it('fila: dois eventos da mesma chave em sequência, 1 outlier em cada, são 2 pares sem repetição (N1)', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v1 = await visto(site, ['pais:VN'], 50, 45)
      const v2 = await visto(site, ['pais:VN'], 8, 4)
      await sinal(site, 'pais:VN', 44, [], 30) // evento antigo: fim há 30 d
      await sinal(site, 'pais:VN', 5, [])
      const f = await fila(site)
      const ids = f.map((x) => x.outlier_video_id).sort()
      expect(ids).toEqual([v1, v2].sort())
      expect(new Set(f.map((x) => `${x.signal_id}|${x.outlier_video_id}`)).size).toBe(2)
    })
  })

  it('fila: outlier visto há 40 d (âncora do evento anterior) não vira par do evento novo', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const antigo = await visto(site, ['pais:VN'], 42, 40)
      const novo = await visto(site, ['pais:VN'], 8, 4)
      const sAntigo = await sinal(site, 'pais:VN', 44, [], 30)
      const sNovo = await sinal(site, 'pais:VN', 5, [])
      const pares = (await fila(site)).map((x) => `${x.signal_id}|${x.outlier_video_id}`)
      expect(pares).toContain(`${sAntigo}|${antigo}`)
      expect(pares).toContain(`${sNovo}|${novo}`)
      expect(pares).not.toContain(`${sNovo}|${antigo}`)
    })
  })

  it('R3-1: outlier publicado há 60 d e visto hoje, com a chave do evento, não vira par', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const velho = await visto(site, ['pais:VN'], 60, 2)
      const bom = await visto(site, ['pais:VN'], 8, 2)
      await sinal(site, 'pais:VN', 5, [])
      const ids = (await fila(site)).map((x) => x.outlier_video_id)
      expect(ids).toContain(bom)
      expect(ids).not.toContain(velho)
    })
  })

  it('R3-1: outlier publicado depois do fim do evento não entra', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const depois = await visto(site, ['pais:VN'], 1, 1)
      await sinal(site, 'pais:VN', 10, [], 5) // evento dispensado há 5 d
      expect((await fila(site)).map((x) => x.outlier_video_id)).not.toContain(depois)
    })
  })

  it('troca de semente depois do evento mantém o par (chave do braço); chave sai de video_lugares quando existe', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = await visto(site, ['pais:VN'], 8, 4)
      const s = await sinal(site, 'pais:VN', 5, [])
      expect((await fila(site)).map((x) => x.outlier_video_id)).toEqual([v])
      await gravar(site, [braco(s, v, { chave: 'pais:VN' })], [linha(s, v)])
      // a semente nova tira a chave do vídeo
      await pg.query(`insert into public.video_lugares (video_id, site_id, origem, chaves, fonte, entrada_hash, semente_versao, computado_em)
                      values ($1, $2, 'competidor', array['pais:TH'], 'texto', 'h', 2, now())`, [v, site])
      const f = await fila(site)
      expect(f.map((x) => x.outlier_video_id)).toEqual([v])
      expect(f[0].chave).toBe('pais:VN')
    })
  })

  it('sinal de 130 dias não aparece', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      await sinal(site, 'pais:VN', 130, [{ video: randomUUID(), canal: randomUUID(), pub: new Date(Date.now() - 131 * 86400000).toISOString() }])
      expect(await fila(site)).toHaveLength(0)
    })
  })

  it('contagem: v0 = menor primeiro_visto_em (dia PT), sem_entrada, fora_de_evidence, eventos_fechados', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const vazio = await pg.query(`select public.niche_signal_medida_contagem($1, $2) as r`, [site, JANELA])
      expect(vazio.rows[0].r).toMatchObject({ sem_entrada: 1, v0: null, pares_abertos: 0, eventos_fechados: 0 })
      await visto(site, ['pais:VN'], 9, 7)
      const v2 = await visto(site, ['pais:VN'], 8, 3)
      const s = await sinal(site, 'pais:VN', 5, [])
      const minimo = await escalar<string>(pg, `select to_char(min(primeiro_visto_em) at time zone 'America/Los_Angeles', 'YYYY-MM-DD') from public.niche_outliers_vistos where site_id = $1`, [site])
      const r = (await pg.query(`select public.niche_signal_medida_contagem($1, $2) as r`, [site, JANELA])).rows[0].r
      expect(r).toMatchObject({ sem_entrada: 0, v0: minimo, pares_abertos: 2, fora_de_evidence: 2, eventos_fechados: 0 })
      await gravar(site, [], [linha(s, v2, { papel: 'alvo' }), linha(s, v2, { papel: 'controle' })])
      const r2 = (await pg.query(`select public.niche_signal_medida_contagem($1, $2) as r`, [site, JANELA])).rows[0].r
      expect(r2).toMatchObject({ pares_abertos: 1, eventos_fechados: 1 })
    })
  })

  it('apagar o site apaga as duas tabelas em cascata', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const v = randomUUID()
      const s = await sinal(site, 'pais:VN', 5, [{ video: v, canal: randomUUID(), pub: new Date(Date.now() - 6 * 86400000).toISOString() }])
      await gravar(site, [braco(s, v)], [linha(s, v)])
      await pg.query(`delete from public.sites where id = $1`, [site])
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signal_efeitos where site_id = $1`, [site])).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signal_efeito_bracos where site_id = $1`, [site])).toBe(0)
    })
  })
})
