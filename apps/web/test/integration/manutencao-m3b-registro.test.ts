// apps/web/test/integration/manutencao-m3b-registro.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 1 do SQL (plano M3b-site, Tarefa 3): o registro, a política e o administrador do site. Banco: SÓ o `bythiago_int`.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m3b-registro.test.ts --no-file-parallelism
 * Tudo em `begin … rollback`. Permissão se testa por has_*_privilege, nunca chamando como anon/authenticated (SIGSEGV no banco local).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, escalar, q1, tenta, semearCanal } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { readFileSync } from 'node:fs'
import { CLASSES, TABELAS_DA_CLASSE } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const QUINZE = ['obs_archive_units', 'obs_archive_unit_parts', 'obs_archive_months', 'obs_archive_prechecks', 'obs_archive_restores', 'obs_archive_switch',
  'obs_archive_heartbeat', 'obs_archive_purges', 'obs_archive_unit_attachments', 'obs_archive_summaries', 'obs_archive_channel_removals',
  'obs_archive_b2_runs', 'obs_archive_b2_files', 'obs_archive_canaries', 'obs_archive_sweeps']

describe.skipIf(skipIfNoLocalDb())('M3b parte 1: o registro', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução (Yannis R3-1)
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 1)
      return await fn()
    } finally { await c.query('rollback') }
  }
  const unidade = (site: string, o: Record<string, unknown> = {}): [string, unknown[]] => [
    `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, ${Object.keys(o).join(', ') || 'parts'})
     values ($1, coalesce($2, 'serie'), coalesce($3, 'competitor_video_daily'), $4, '2026-10-01', 1, 1, repeat('a', 64), repeat('b', 64), repeat('c', 64), ${Object.keys(o).map((_, i) => `$${i + 5}`).join(', ') || '1'})`,
    [site, null, null, randomUUID(), ...Object.values(o)]]

  it('as 15 tabelas existem, com RLS e sem FK para canal, vídeo ou site', async () => {
    await emTx(async () => {
      const r = await c.query(`select c.relname, c.relrowsecurity from pg_class c where c.oid = any(select to_regclass('public.' || t)::oid from unnest($1::text[]) t)`, [QUINZE])
      expect(r.rows.map(x => x.relname).sort()).toEqual([...QUINZE].sort())
      expect(r.rows.every(x => x.relrowsecurity === true)).toBe(true)
      const fks = await c.query(`select conrelid::regclass::text as de, confrelid::regclass::text as para from pg_constraint
        where contype = 'f' and conrelid = any(select to_regclass('public.' || t)::oid from unnest($1::text[]) t) order by 1`, [QUINZE])
      expect(fks.rows).toEqual([
        { de: 'obs_archive_unit_attachments', para: 'obs_archive_units' },
        { de: 'obs_archive_unit_parts', para: 'obs_archive_units' },
      ])
    })
  })

  it('a classe faz parte da chave em units, months, restores, prechecks e purges (item 131)', async () => {
    await emTx(async () => {
      for (const t of ['obs_archive_units', 'obs_archive_months', 'obs_archive_prechecks']) {
        const r = await c.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
          where i.indrelid = $1::regclass and i.indisunique and not (i.indpred is not null)`, ['public.' + t])
        expect(r.rows.map(x => x.attname), t).toContain('class')
      }
      // restores e purges: a classe é coluna not null da própria linha, com a tabela (a unicidade é pelo id)
      for (const t of ['obs_archive_restores', 'obs_archive_purges']) {
        expect(await escalar<boolean>(c, `select attnotnull from pg_attribute where attrelid = $1::regclass and attname = 'class'`, ['public.' + t]), t).toBe(true)
      }
    })
  })

  it('duas unidades do bruto, uma por classe, coexistem (item 131)', async () => {
    await emTx(async () => {
      const { site, canal } = await semearCanal(c)
      for (const classe of ['texto', 'video_antigo']) {
        const r = await tenta(c, `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes)
          values ($1, $2, 'competitor_raw', $3, '2026-12-01', 1, 1, repeat('a', 64), repeat('b', 64), repeat('c', 64))`, [site, classe, canal])
        expect(r.ok, classe).toBe(true)
      }
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and table_name = 'competitor_raw'`, [site])).toBe(2)
    })
  })

  it('o gatilho recusa o par fora da política, nas cinco tabelas', async () => {
    await emTx(async () => {
      const { site, canal } = await semearCanal(c)
      const sqls: Record<string, string> = {
        obs_archive_units: `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes) values ($1, 'serie', 'competitor_raw', $2, '2026-10-01', 1, 1, repeat('a', 64), repeat('b', 64), repeat('c', 64))`,
        obs_archive_months: `insert into public.obs_archive_months (site_id, class, table_name, month) values ($1, 'serie', 'competitor_raw', '2026-10-01')`,
        obs_archive_restores: `insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by) values ($1, 'serie', 'competitor_raw', 'x', 'b2', 'cofre', 1, 1, 0, 'x')`,
        obs_archive_prechecks: `insert into public.obs_archive_prechecks (site_id, class, table_name, month, channel_ref) values ($1, 'serie', 'competitor_raw', '2026-10-01', $2)`,
        obs_archive_purges: `insert into public.obs_archive_purges (site_id, class, table_name, channel_ref, month, from_version, to_version, rows_removed) values ($1, 'serie', 'competitor_raw', $2, '2026-10-01', 1, 2, 0)`,
      }
      for (const [t, sql] of Object.entries(sqls)) {
        const r = await tenta(c, sql, sql.includes('$2') ? [site, canal] : [site])
        expect(r.ok, t).toBe(false)
        if (!r.ok) { expect(r.code, t).toBe('P0001'); expect(r.message, t).toContain('classe_tabela_invalida') }
      }
    })
  })

  it('a política é a mesma lista do TypeScript', async () => {
    await emTx(async () => {
      const r = await c.query(`select class, table_name from public.obs_archive_policy()`)
      const sql = r.rows.map(x => `${x.class}/${x.table_name}`).sort()
      const ts = CLASSES.flatMap(k => TABELAS_DA_CLASSE[k].map(t => `${k}/${t}`)).sort()
      expect(sql).toEqual(ts)
      expect(sql).toHaveLength(15)
    })
  })

  it('na M3b nenhuma classe está liberada (D12)', async () => {
    await emTx(async () => {
      expect(await escalar<boolean>(c, `select coalesce(bool_or(released), false) from public.obs_archive_policy()`)).toBe(false)
    })
  })

  it('checks: purged, lost e absent juntos ou nenhum (23514)', async () => {
    await emTx(async () => {
      const { site } = await semearCanal(c)
      for (const o of [{ purged_at: new Date() }, { lost_at: new Date() }, { absent_first_at: new Date() }, { nas_withdrawn_at: new Date() }]) {
        const [sql, params] = unidade(site, o)
        const r = await tenta(c, sql, params)
        expect(r.ok, JSON.stringify(Object.keys(o))).toBe(false)
        if (!r.ok) expect(r.code).toBe('23514')
      }
      const [okSql, okParams] = unidade(site, { purged_at: new Date(), purged_by: randomUUID(), purge_ref: 'remocao:x' })
      expect((await tenta(c, okSql, okParams)).ok).toBe(true)
    })
  })

  it('índices de P36', async () => {
    await emTx(async () => {
      const r = await c.query(`select tablename, indexdef from pg_indexes where schemaname = 'public' and tablename in ('obs_archive_units', 'obs_archive_summaries', 'obs_archive_channel_removals')`)
      const defs = r.rows.map(x => `${x.tablename}: ${x.indexdef}`).join('\n')
      expect(defs).toMatch(/obs_archive_units: .*\(site_id, channel_ref\)/)
      expect(defs).toMatch(/obs_archive_summaries: .*\(site_id, channel_ref\)/)
      expect(defs).toMatch(/obs_archive_channel_removals: .*\(site_id\) WHERE \(completed_at IS NULL\)/)
    })
  })

  it('permissões: nenhuma escrita para authenticated, anon e service_role (K3)', async () => {
    await emTx(async () => {
      for (const t of QUINZE) for (const papel of ['authenticated', 'anon', 'service_role']) for (const p of ['insert', 'update', 'delete', 'truncate']) {
        expect(await escalar<boolean>(c, `select has_table_privilege($1, $2, $3)`, [papel, 'public.' + t, p]), `${papel} ${p} ${t}`).toBe(false)
      }
      expect(await escalar<boolean>(c, `select has_table_privilege('service_role', 'public.obs_archive_units', 'select')`)).toBe(true)
      expect(await escalar<boolean>(c, `select has_function_privilege('anon', 'public.obs_archive_policy()', 'execute')`)).toBe(false)
      expect(await escalar<boolean>(c, `select has_function_privilege('service_role', 'public.obs_archive_class_table_guard()', 'execute')`)).toBe(false)
    })
  })

  it('obs_archive_is_site_admin: org_admin do site sim, editor não, org_admin de raiz sim, usuário inexistente não', async () => {
    await emTx(async () => {
      const suf = randomUUID().slice(0, 8)
      const raiz = (await c.query(`select id from public.organizations where parent_org_id is null limit 1`)).rows[0]?.id as string
        ?? (await q1(c, `insert into public.organizations (name, slug, parent_org_id) values ('raiz ' || $1, 'm3b-raiz-' || $1, null) returning id`, [suf])).id as string
      const orgA = (await q1(c, `insert into public.organizations (name, slug, parent_org_id) values ('a ' || $1, 'm3b-a-' || $1, $2) returning id`, [suf, raiz])).id as string
      const orgB = (await q1(c, `insert into public.organizations (name, slug, parent_org_id) values ('b ' || $1, 'm3b-b-' || $1, $2) returning id`, [suf, raiz])).id as string
      const site = (await q1(c, `insert into public.sites (org_id, name, slug, domains, primary_domain) values ($1, 's', 'm3b-s-' || $2, array['m3b-' || $2 || '.test'], 'm3b-' || $2 || '.test') returning id`, [orgA, suf])).id as string
      const user = async (): Promise<string> => {
        const id = randomUUID()
        await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, `m3b-${id}@t.test`])
        return id
      }
      const admin = await user(), editor = await user(), adminRaiz = await user(), adminOutra = await user()
      await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin'), ($3, $4, 'org_admin'), ($5, $6, 'org_admin')`,
        [orgA, admin, raiz, adminRaiz, orgB, adminOutra])
      await c.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [site, editor])
      const eh = (u: string): Promise<boolean> => escalar<boolean>(c, `select public.obs_archive_is_site_admin($1, $2)`, [site, u])
      expect(await eh(admin)).toBe(true)
      expect(await eh(editor)).toBe(false)
      expect(await eh(adminRaiz)).toBe(true)
      expect(await eh(adminOutra)).toBe(false)
      expect(await eh(randomUUID())).toBe(false)
    })
  })

  it('a M2 lê o registro de verdade (obs_partitions_ensure respeita detached_at)', async () => {
    await emTx(async () => {
      const { site } = await semearCanal(c)
      const mes = await escalar<string>(c, `select (obs_part.mes_corrente_sp() + interval '3 months')::date::text`)
      const nome = await escalar<string>(c, `select obs_part.nome_da_particao('competitor_video_daily', $1::date)`, [mes])
      await c.query('select public.obs_partitions_ensure(12)')
      expect(await escalar<boolean>(c, `select to_regclass('obs_part.' || $1) is not null`, [nome])).toBe(true)
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at) values ($1, 'serie', 'competitor_video_daily', $2, now())`, [site, mes])
      await c.query(`drop table obs_part.${nome}`)
      await c.query('select public.obs_partitions_ensure(12)')
      expect(await escalar<boolean>(c, `select to_regclass('obs_part.' || $1) is not null`, [nome])).toBe(false)
    })
  })
})

// Emenda 23/10 (Yannis §3.5, Phil M3b-1): forma "registro (32) x política". Não é igualdade: 19 tabelas ficam online POR DECISÃO, escrita aqui.
const FICA_ONLINE: ReadonlyArray<{ tabela: string; motivo: string; gatilho: string }> = [
  { tabela: 'competitor_playlist_reads', motivo: 'estado mutável, 1 linha por canal', gatilho: 'nenhum' },
  { tabela: 'competitor_playlists', motivo: 'estado corrente, mutável', gatilho: '> 5 MB' },
  { tabela: 'competitor_playlist_versions', motivo: 'imutável, mas 3 MB/ano; candidata a texto', gatilho: '> 10 MB ou 12/2027' },
  { tabela: 'competitor_playlist_items', motivo: 'mutável, sem classe que a alcance', gatilho: '15/11, >= 250 linhas/dia' },
  { tabela: 'competitor_channel_sections', motivo: 'pequena, versão só por mudança', gatilho: '> 5 MB' },
  { tabela: 'competitor_video_marks', motivo: 'resumo leve que sobra depois da série (spec 02 l.186)', gatilho: 'nenhum' },
  { tabela: 'competitor_video_mark_misses', motivo: 'par das marcas, mutável', gatilho: '> 15 MB' },
  { tabela: 'competitor_missing_baseline', motivo: 'piso da prova dos ausentes (spec 02 l.186)', gatilho: 'nenhum' },
  { tabela: 'yt_watch_alvos', motivo: 'fila mutável com poda própria da A5', gatilho: 'nenhum' },
  { tabela: 'yt_watch_thumbs', motivo: 'mesma poda do alvo', gatilho: 'nenhum' },
  { tabela: 'yt_watch_readings', motivo: 'poda da A5 como retenção; platô ~38 MB em 22/12', gatilho: '22/12: 30 a 45 MB' },
  { tabela: 'ab_native_observados', motivo: 'tem update, nunca sai por idade', gatilho: '25/10 cursor com linha' },
  { tabela: 'ab_native_obs_cursor', motivo: 'estado de avaliação', gatilho: 'idem ab_native_observados' },
  { tabela: 'competitor_channels', motivo: 'estado do canal, mutável', gatilho: 'nenhum' },
  { tabela: 'competitor_collection_pauses', motivo: 'estado de pausa, mutável', gatilho: '> 5 MB' },
  { tabela: 'competitor_channel_hour_map', motivo: 'mapa por mês/formato, mutável', gatilho: '> 5 MB' },
  { tabela: 'competitor_videos', motivo: 'tabela-mãe, vira toco na M10b, não sai', gatilho: '> 15 MB' },
  { tabela: 'youtube_intelligence_tasks', motivo: 'fila da forja, 1 linha/dia', gatilho: '> 5 MB' },
  { tabela: 'competitor_channel_snapshots', motivo: 'série diária pequena, ~8,9 MB/ano; candidata a serie', gatilho: '> 10 MB ou 06/2027' },
]

/** As quatro asserções da emenda; devolve a lista de problemas (vazia = ok). */
export function formaRegistroXPolitica(registro: string[], politica: string[], ficaOnline: string[]): string[] {
  const R = new Set(registro), P = new Set(politica), F = new Set(ficaOnline), erros: string[] = []
  for (const t of R) if (!P.has(t) && !F.has(t)) erros.push(`registro sem decisão: ${t}`)
  for (const t of F) if (P.has(t)) erros.push(`FICA_ONLINE também na política: ${t}`)
  const soPolitica = [...P].filter(t => !R.has(t)).sort()
  if (soPolitica.join(',') !== 'obs_archive_rehearsal') erros.push(`política fora do registro: ${soPolitica.join(',')}`)
  const dentro = [...R].filter(t => P.has(t)).length
  if (dentro + F.size !== R.size) erros.push(`soma ${dentro} + ${F.size} != ${R.size}`)
  return erros
}

describe.skipIf(skipIfNoLocalDb())('M3b: forma registro x política (Yannis §3.5)', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })
  async function lista(): Promise<{ registro: string[]; politica: string[] }> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try {
      await aplicarM2(c); await c.query(readFileSync(M10A_SQL, 'utf8')); await aplicarM3b(c, 1)
      const registro = (await c.query(`select table_name from public.obs_archive_registry()`)).rows.map(x => x.table_name as string)
      const politica = [...new Set((await c.query(`select table_name from public.obs_archive_policy()`)).rows.map(x => x.table_name as string))]
      return { registro, politica }
    } finally { await c.query('rollback') }
  }
  const FO = FICA_ONLINE.map(x => x.tabela)

  it('registro real: 32 = 13 classificadas + 19 FICA_ONLINE, sem tabela sem decisão', async () => {
    const { registro, politica } = await lista()
    expect(FICA_ONLINE).toHaveLength(19)
    expect(new Set(FO).size).toBe(19)
    FICA_ONLINE.forEach(x => { expect(x.motivo.length).toBeGreaterThan(0); expect(x.gatilho.length).toBeGreaterThan(0) })
    expect(registro).toHaveLength(32)
    expect(registro.filter(t => politica.includes(t))).toHaveLength(13)
    expect(formaRegistroXPolitica(registro, politica, FO)).toEqual([])
  })

  it('mutantes: tabela fictícia no registro, ou a política perdendo uma tabela, derrubam a forma', async () => {
    const { registro, politica } = await lista()
    expect(formaRegistroXPolitica([...registro, 'tabela_ficticia'], politica, FO)).toContain('registro sem decisão: tabela_ficticia')
    expect(formaRegistroXPolitica(registro, politica.filter(t => t !== 'competitor_video_daily'), FO).join('|')).toContain('competitor_video_daily')
    expect(formaRegistroXPolitica(registro, politica, [...FO, 'competitor_video_daily']).join('|')).toContain('também na política')
  })
})
