// apps/web/test/integration/manutencao-m2-particoes.test.ts
// @vitest-environment node
/**
 * Manutenção M2 (spec 02 §10.2; 06 §18 itens 7, 8, 10, 72 e 73). Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m2-particoes.test.ts --no-file-parallelism
 * Tudo roda em `begin … rollback`, salvo o caso de concorrência, que confirma só a parte 1 (funções em obs_part) e uma tabela de
 * brinquedo própria, apagada no fim com o site que a semeou.
 * O banco é dividido com outras etapas: nenhuma afirmação conta linhas de tabela inteira de produção.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarCanal, criarVideo, escalar, tenta, q1 } from '../helpers/mg6'
import { aplicarM2, aplicarM2SoFuncoes, criarBrinquedo, apagarBrinquedo } from '../helpers/m2'
import { apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M2: o conversor numa tabela de brinquedo', () => {
  let pg: Client
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    // varre brinquedo órfão de execução morta (ele entra no fecho de cascata que obs_archive_uncovered da E10 percorre)
    const { rows } = await pg.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'zz\\_m2\\_brinquedo\\_%' and c.relkind in ('r', 'p') and not c.relispartition`)
    for (const r of rows as { relname: string }[]) await apagarBrinquedo(pg, r.relname)
  })
  afterAll(async () => { await pg.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      // o mês corrente e os 12 à frente, qualquer que seja o mês em que a M2 foi aplicada neste banco (fixture temporal relativa)
      if (await escalar<string | null>(pg, `select to_regprocedure('public.obs_partitions_ensure(integer)')::text`)) await pg.query('select public.obs_partitions_ensure(12)')
      return await fn()
    } finally { await pg.query('rollback') }
  }
  async function semear(t: string, n: number): Promise<{ site: string; video: string }> {
    const { site } = await criarSite(pg)
    const canal = await criarCanal(pg, site)
    const video = await criarVideo(pg, canal, 3)
    // n horas a partir de 15 h antes da virada do mês corrente em SP: com n > 15, cruza a virada sempre (exercita duas partições)
    await pg.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views)
      select $1, z.b + make_interval(hours => g), z.b + make_interval(hours => g), $2, g
        from generate_series(0, $3 - 1) g,
             (select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '15 hours' as b) z`, [video, site, n])
    return { site, video }
  }

  it('converte: particionada, mesma assinatura, mesma contagem e soma, partições em obs_part com RLS e sem concessão, antiga sem FK e sem concessão', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await semear(t, 30)
      const antes = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      const r = await escalar<{ feito: boolean; linhas: number }>(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.feito).toBe(true)
      expect(r.linhas).toBe(30)
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('p')
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(antes)
      const parts = await pg.query(`select n.nspname, c.relrowsecurity, c.relacl::text as acl
          from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace where i.inhparent = 'public.${t}'::regclass`)
      expect(parts.rows.length).toBeGreaterThanOrEqual(14) // mês anterior (a semente cruza a virada) .. corrente + 12
      for (const p of parts.rows as { nspname: string; relrowsecurity: boolean; acl: string | null }[]) {
        expect(p.nspname).toBe('obs_part')
        expect(p.relrowsecurity).toBe(true)
        expect(p.acl ?? '').not.toMatch(/anon=|authenticated=|service_role=/)
      }
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.${t}_antiga'::regclass and contype = 'f'`)).toBe(0)
      for (const papel of ['anon', 'authenticated', 'service_role']) {
        expect(await escalar<boolean>(pg, `select has_table_privilege($1, 'public.${t}_antiga', 'select')`, [papel])).toBe(false)
      }
      expect(await escalar<number>(pg, `select count(*)::int from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.${t}'::regclass and pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`)).toBe(0)
      expect(await escalar<number>(pg, `select rows_copied::int from public.obs_partition_conversions where table_name = 'public.${t}'`)).toBe(30)
    })
  })

  it('segunda chamada não faz nada (idempotente); a migration aplicada duas vezes não muda nada', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await semear(t, 5)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      const r = await escalar<{ feito: boolean; motivo: string }>(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r).toMatchObject({ feito: false, motivo: 'ja_particionada' })
      const assinatura = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      const n = await escalar<number>(pg, `select count(*)::int from public.${t}`)
      await aplicarM2(pg)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(assinatura)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(n)
    })
  })

  it('tabela vazia: partições do mês corrente até 12 à frente, nenhuma do passado', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(await escalar<number>(pg, `select count(*)::int from pg_inherits where inhparent = 'public.${t}'::regclass`)).toBe(13)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.' || obs_part.nome_da_particao($1, obs_part.mes_corrente_sp()))::text`, [t])).not.toBeNull()
    })
  })

  it('cópia que diverge (gatilho que muda views) desfaz tudo: a tabela continua comum e sem _antiga', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg, { gatilhoQueMuda: true })
      await semear(t, 5)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:copia_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
      expect(await escalar<string | null>(pg, `select to_regclass('public.${t}_antiga')::text`)).toBeNull()
    } finally { await pg.query('rollback') }
  })

  it('índice único sem a coluna de tempo (pedido 6) recusa alto e desfaz', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg, { unicoSemTempo: true })
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
    } finally { await pg.query('rollback') }
  })

  it('dependente novo (view, FK de outra tabela) recusa com M2:dependente_novo', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg)
      await pg.query(`create view public.${t}_v as select video_id from public.${t}`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:dependente_novo/)
      await pg.query('rollback to savepoint s')
      await pg.query(`drop view public.${t}_v`)
      await pg.query(`create table public.${t}_filha (video_id uuid, hour_slot timestamptz, foreign key (video_id, hour_slot) references public.${t} (video_id, hour_slot))`)
      await pg.query('savepoint s2')
      const r2 = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.message).toMatch(/M2:dependente_novo/)
      await pg.query('rollback to savepoint s2')
    } finally { await pg.query('rollback') }
  })

  it('a assinatura acusa diferença de concessão (o que faz a conversão desfazer)', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      const a = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      await pg.query(`revoke select on public.${t} from anon`)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).not.toEqual(a)
    })
  })

  it('catálogo que o DDL capturado não reproduz (privilégio revogado do dono) desfaz com M2:catalogo_divergente', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg)
      await pg.query(`revoke truncate on public.${t} from current_user`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:catalogo_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
    } finally { await pg.query('rollback') }
  })

  it('volta atrás (02 §10.2, os 7 dias): converter, gravar 3 linhas novas, desfazer → tabela comum, antes + 3 linhas, assinatura de antes', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      const { site, video } = await semear(t, 30)
      const antes = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await pg.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views)
        select $1, date_trunc('hour', now()) + make_interval(hours => g), date_trunc('hour', now()) + make_interval(hours => g), $2, 1000 + g
          from generate_series(1, 3) g`, [video, site])
      const r = await escalar<{ feito: boolean; linhas: number }>(pg, `select obs_part.desfazer('public.${t}'::regclass)`)
      expect(r).toMatchObject({ feito: true, linhas: 33 })
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(33)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(antes)
      // a particionada fica de lado, fora do fecho de cascata e da API
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.${t}_particionada'::regclass and contype = 'f'`)).toBe(0)
      expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.${t}_particionada', 'select')`)).toBe(false)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_partition_conversions where table_name = 'public.${t}'`)).toBe(0)
      // sem dado: tabela já comum não faz nada
      expect(await escalar<unknown>(pg, `select obs_part.desfazer('public.${t}'::regclass)`)).toMatchObject({ feito: false, motivo: 'nao_particionada' })
    })
  })

  it('volta atrás sem registro da conversão recusa com M2:sem_registro (nunca adivinha FK nem concessão)', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await pg.query(`delete from public.obs_partition_conversions where table_name = 'public.${t}'`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.desfazer('public.${t}'::regclass)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:sem_registro/)
      await pg.query('rollback to savepoint s')
    })
  })

  it('gravação concorrente: nenhuma linha confirmada se perde e nada cai na _antiga depois da cópia', async () => {
    // Commita de verdade (o caso pede duas conexões), mas só a parte 1: nenhuma tabela real do banco compartilhado muda.
    // A tabela de brinquedo e o site que a semeou são apagados no fim.
    await aplicarM2SoFuncoes(pg)
    const t = await criarBrinquedo(pg, { semFk: true }) // sem FK: a tabela confirmada não entra no fecho de cascata do banco compartilhado
    const { site, video } = await semear(t, 10)
    const g = new Client({ connectionString: PG_URL }); await g.connect()
    const confirmadas: number[] = []
    let parar = false
    // a base fixa: se a hora virar no meio do teste, o i novo não colide com o i+1 velho (on conflict engoliria a linha)
    const base = (await escalar<string>(pg, `select date_trunc('hour', now())::text`))
    const gravador = (async () => {
      for (let i = 1000; !parar; i++) {
        await g.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views) values ($1, $4::timestamptz + make_interval(hours => $2), $4::timestamptz + make_interval(hours => $2), $3, $2)
          on conflict (video_id, hour_slot) do nothing`, [video, i, site, base])
        confirmadas.push(i)
      }
    })()
    try {
      await new Promise(r => setTimeout(r, 200))
      await pg.query('begin')
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await new Promise(r => setTimeout(r, 300)) // o gravador fica esperando a trava
      await pg.query('commit')
      await new Promise(r => setTimeout(r, 200))
      parar = true
      await gravador
      const naNova = await escalar<number>(pg, `select count(*)::int from public.${t} where views >= 1000`)
      expect(naNova).toBe(confirmadas.length)
      const copiadas = await escalar<number>(pg, `select rows_copied::int from public.obs_partition_conversions where table_name = 'public.${t}'`)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}_antiga`)).toBe(copiadas)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(10 + confirmadas.length)
    } finally {
      parar = true
      await gravador.catch(() => undefined)
      await g.end()
      await apagarBrinquedo(pg, t)
      await apagarSites(pg, 'id = $1', [site])
    }
  })
})
describe.skipIf(skipIfNoLocalDb())('M2: as três séries, o ensure, os meses à frente e a tabela de ensaio', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  const TRES = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const
  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    // ensure(12) logo depois: os testes não dependem do mês em que a M2 foi aplicada neste banco (fixture temporal relativa)
    try { await aplicarM2(pg); await pg.query('select public.obs_partitions_ensure(12)'); return await fn() } finally { await pg.query('rollback') }
  }

  it('item 7: as três particionadas, partições em obs_part, RLS ligada, sem select de anon nem authenticated, sem DEFAULT, do mês de min(coluna) a 12 à frente', async () => {
    await emTx(async () => {
      for (const t of TRES) {
        expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = $1::regclass`, ['public.' + t])).toBe('p')
        const r = await pg.query(`select n.nspname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon_le,
              has_table_privilege('authenticated', c.oid, 'select') as auth_le, pg_get_expr(c.relpartbound, c.oid) as faixa
            from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace where i.inhparent = $1::regclass`, ['public.' + t])
        for (const p of r.rows as { nspname: string; relrowsecurity: boolean; anon_le: boolean; auth_le: boolean; faixa: string }[]) {
          expect(p).toMatchObject({ nspname: 'obs_part', relrowsecurity: true, anon_le: false, auth_le: false })
          expect(p.faixa).not.toBe('DEFAULT')
        }
      }
      const m = await pg.query(`select table_name, months_ahead from public.obs_partitions_months_ahead() order by 1`)
      expect(m.rows).toEqual(TRES.map(t => ({ table_name: t, months_ahead: 12 })))
      // a semente do passado (dev.sql) não conta: o que se afirma é que o mês de min(coluna) existe
      for (const [t, col] of [['competitor_video_daily', 'snap_date'], ['competitor_video_early', 'taken_at'], ['competitor_video_hourly', 'hour_slot']] as const) {
        const minMes = await escalar<string | null>(pg, `select to_char(obs_part.primeiro_dia((min(${col})${col === 'snap_date' ? '' : " at time zone 'America/Sao_Paulo'"})::date), 'YYYYMM') from public.${t}`)
        if (minMes !== null) expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${t}_' || $1)::text`, [minMes])).not.toBeNull()
      }
    })
  })

  it('a hora da virada: 02:00 UTC de 1º/11 (23:00 de 31/10 em SP) cai na partição de outubro', async () => {
    await emTx(async () => {
      await pg.query(`select obs_part.criar_particao('public.competitor_video_hourly'::regclass, '2026-10-01'), obs_part.criar_particao('public.competitor_video_hourly'::regclass, '2026-11-01')`)
      const { site } = await criarSite(pg)
      const video = await criarVideo(pg, await criarCanal(pg, site), 3)
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-11-01 02:00:00+00', '2026-11-01 02:10:00+00', $2, 1), ($1, '2026-11-01 03:00:00+00', '2026-11-01 03:10:00+00', $2, 2)`, [video, site])
      const r = await pg.query(`select tableoid::regclass::text as part, views from public.competitor_video_hourly where video_id = $1 order by views`, [video])
      expect(r.rows).toEqual([{ part: 'obs_part.competitor_video_hourly_202610', views: '1' }, { part: 'obs_part.competitor_video_hourly_202611', views: '2' }])
    })
  })

  it('itens 10 e 73: ensure recria o que falta à frente, liga RLS e revoga, é idempotente e nunca cria mês passado', async () => {
    await emTx(async () => {
      const ultimo = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', (obs_part.mes_corrente_sp() + interval '12 months')::date)`)
      await pg.query(`drop table obs_part.${ultimo}`)
      const passado = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_daily', (obs_part.mes_corrente_sp() - interval '30 months')::date)`)
      await pg.query(`drop table if exists obs_part.${passado}`) // a semente cria −1..−36; o teste prova que o ensure não a recria
      const r1 = await pg.query(`select table_name, created from public.obs_partitions_ensure(12) order by 1`)
      expect(r1.rows).toEqual([
        { table_name: 'competitor_video_daily', created: 0 },
        { table_name: 'competitor_video_early', created: 0 },
        { table_name: 'competitor_video_hourly', created: 1 },
      ])
      expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = to_regclass('obs_part.${ultimo}')`)).toBe(true)
      expect(await escalar<boolean>(pg, `select has_table_privilege('service_role', 'obs_part.${ultimo}', 'select')`)).toBe(false)
      const r2 = await pg.query(`select sum(created)::int as n from public.obs_partitions_ensure(12)`)
      expect(r2.rows[0].n).toBe(0)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${passado}')::text`)).toBeNull()
    })
  })

  it('item 73: mês com detached_at ou dropped_at no registro nunca é recriado', async (ctx) => {
    await emTx(async () => {
      const existe = await escalar<string | null>(pg, `select to_regclass('public.obs_archive_months')::text`)
      if (existe === null) {
        // a M3b ainda não existe: a forma mínima do contrato (table_name, month, detached_at, dropped_at), só nesta transação
        await pg.query(`create table public.obs_archive_months (table_name text, month date, detached_at timestamptz, dropped_at timestamptz)`)
      }
      const mes = await escalar<string>(pg, `select to_char((obs_part.mes_corrente_sp() + interval '12 months')::date, 'YYYY-MM-DD')`)
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_early', $1::date)`, [mes])
      await pg.query(`drop table obs_part.${nome}`)
      if (existe === null) await pg.query(`insert into public.obs_archive_months values ('competitor_video_early', $1::date, now(), null)`, [mes])
      else ctx.skip() // com a M3b viva, o teste dela cobre o caso com a chave completa: aparece como pulado, nunca como verde
      await pg.query(`select * from public.obs_partitions_ensure(12)`)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${nome}')::text`)).toBeNull()
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_early'`)
      expect(m.rows[0].months_ahead).toBe(11)
    })
  })

  it('o que acontece sem dado: ensure com tabela não particionada falha alto; meses à frente devolve null', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      await pg.query(`alter table public.competitor_video_early rename to competitor_video_early_x`)
      await pg.query(`create table public.competitor_video_early (video_id uuid)`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select * from public.obs_partitions_ensure(12)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:tabela_nao_particionada: competitor_video_early/)
      await pg.query('rollback to savepoint s')
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_early'`)
      expect(m.rows[0].months_ahead).toBeNull()
      const r2 = await tenta(pg, `select * from public.obs_partitions_ensure(0)`)
      expect(r2.ok).toBe(false)
    } finally { await pg.query('rollback') }
  })

  it('mês corrente sem partição: months_ahead = -1', async (ctx) => {
    await emTx(async () => {
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', obs_part.mes_corrente_sp())`)
      const n = await escalar<number>(pg, `select count(*)::int from obs_part.${nome}`)
      if (n > 0) ctx.skip() // banco com leitura horária do mês: não se apaga dado para testar (pulado, nunca verde)
      await pg.query(`drop table obs_part.${nome}`)
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_hourly'`)
      expect(m.rows[0].months_ahead).toBe(-1)
    })
  })

  it('permissões: só service_role executa as duas públicas (has_function_privilege; chamar como anon derruba o Postgres local)', async () => {
    await emTx(async () => {
      for (const f of ['public.obs_partitions_ensure(integer)', 'public.obs_partitions_months_ahead()']) {
        expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1, 'execute')`, [f])).toBe(true)
        expect(await escalar<boolean>(pg, `select has_function_privilege('anon', $1, 'execute')`, [f])).toBe(false)
        expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', $1, 'execute')`, [f])).toBe(false)
      }
      for (const f of ['obs_part.criar_particao(regclass,date)', 'obs_part.converter(regclass,text,text)']) {
        expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1, 'execute')`, [f])).toBe(false)
      }
    })
  })

  it('a tabela de ensaio: particionada por hour_slot, sem FK, RLS ligada, sem concessão a anon e authenticated, linha só sintética', async () => {
    await emTx(async () => {
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.obs_archive_rehearsal'::regclass`)).toBe('p')
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.obs_archive_rehearsal'::regclass and contype = 'f'`)).toBe(0)
      expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = 'public.obs_archive_rehearsal'::regclass`)).toBe(true)
      expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.obs_archive_rehearsal', 'select')`)).toBe(false)
      expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', 'public.obs_archive_rehearsal', 'select')`)).toBe(false)
      await pg.query(`select obs_part.criar_particao('public.obs_archive_rehearsal'::regclass, '2026-03-01')`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `insert into public.obs_archive_rehearsal (video_id, hour_slot, taken_at, site_id, views, synthetic) values (gen_random_uuid(), '2026-03-10 10:00+00', '2026-03-10 10:05+00', gen_random_uuid(), 1, false)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/obs_archive_rehearsal_synthetic/)
      await pg.query('rollback to savepoint s')
    })
  })
})
