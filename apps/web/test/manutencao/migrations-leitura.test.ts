// @vitest-environment node
/**
 * Manutenção M2 (spec 06 §18, itens 15, 71 e 119). Sem banco: lê os arquivos.
 * 71: se alguma migration define obs_archive_uncovered ou obs_db_size_record, a ÚLTIMA definição sabe de partição.
 * 119: migration desta fase que cita obs_archive_is_site_admin exige que alguma migration a defina.
 * 15: nenhum código lê OBS_HOURLY_RAW_PURGE (pedido 5).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { lerMigrations, ultimaDefinicao, migrationsDaFase, PASTA_DAS_MIGRATIONS, type Migration } from '../helpers/migrations'
import { M2_EM_MIGRATION, M2_SQL_CAMINHO, M2_SQL, M2_BLOCO_11 } from '../helpers/m2'
import { M3B_EM_MIGRATION, M3B_SQL_CAMINHO, HASH_SQL_CAMINHO } from '../helpers/m3b'

const RAIZ = resolve(__dirname, '../../../..')

function pastaFalsa(arquivos: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'm2-migs-'))
  for (const [nome, sql] of Object.entries(arquivos)) writeFileSync(join(d, nome), sql)
  return d
}

export function regra71(dir?: string, extras: Migration[] = []): string[] {
  const migs = [...lerMigrations(dir), ...extras]
  const erros: string[] = []
  const u = ultimaDefinicao(migs, 'obs_archive_uncovered')
  if (u && !/relispartition/.test(u.corpo)) erros.push(`obs_archive_uncovered em ${u.arquivo} sem relispartition (pedido 1)`)
  const s = ultimaDefinicao(migs, 'obs_db_size_record')
  if (s && !/relispartition/.test(s.corpo)) erros.push(`obs_db_size_record em ${s.arquivo} sem relispartition (pedido 3)`)
  if (s && !/relkind\s+in\s*\(\s*'r'\s*,\s*'p'/.test(s.corpo)) erros.push(`obs_db_size_record em ${s.arquivo} sem relkind in ('r','p') (pedido 3)`)
  const r = ultimaDefinicao(migs, 'competitor_channel_remove_archived')
  if (r && (r.corpo.match(/pg_partition_tree/g) ?? []).length < 2) erros.push(`competitor_channel_remove_archived em ${r.arquivo} sem a soma das folhas (M2 11b)`)
  if (r && (r.corpo.match(/not c\.relispartition/g) ?? []).length < 2) erros.push(`competitor_channel_remove_archived em ${r.arquivo} sem not c.relispartition no fecho (M2 11b)`)
  return erros
}

export function regra119(dir?: string): string[] {
  const migs = lerMigrations(dir)
  const define = migs.some(m => /create\s+(or\s+replace\s+)?function\s+(public\.)?obs_archive_is_site_admin\s*\(/i.test(m.sql))
  if (define) return []
  return migrationsDaFase(migs).filter(m => /obs_archive_is_site_admin/.test(m.sql)).map(m => `${m.arquivo} cita obs_archive_is_site_admin e nenhuma migration a define`)
}

describe('item 71: a última definição das duas funções da E10 sabe de partição', () => {
  // A MG6 da E10 já está em produção sem as cláusulas; a M2 as recria. Até o dia do push a M2 é o rascunho (TRAVA M2-1): entra como a última migration.
  it('no repositório (com o rascunho da M2 como última migration, até o dia do push)', () => {
    const extras: Migration[] = M2_EM_MIGRATION ? [] : [{ arquivo: 'rascunhos/m2.sql', sql: M2_SQL }]
    expect(regra71(undefined, extras)).toEqual([])
  })
  it('pega a definição sem a cláusula', () => {
    const d = pastaFalsa({ '20990101000001_e10.sql': 'create or replace function public.obs_archive_uncovered() returns text[] language sql as $$ select 1 $$;' })
    expect(regra71(d)).toEqual(['obs_archive_uncovered em 20990101000001_e10.sql sem relispartition (pedido 1)'])
  })
  it('vale a ÚLTIMA definição: consertada e depois quebrada acusa', () => {
    const d = pastaFalsa({
      '20990101000001_a.sql': "create or replace function public.obs_db_size_record(p timestamptz) returns jsonb language sql as $$ select 1 where relispartition and relkind in ('r', 'p') $$;",
      '20990101000002_b.sql': "create or replace function public.obs_db_size_record(p timestamptz) returns jsonb language sql as $$ select 1 where relkind = 'r' $$;",
    })
    expect(regra71(d)).toHaveLength(2)
  })
  it('competitor_channel_remove_archived: o corpo da MG6 (sem as folhas) acusa; o do 11b passa; consertada e depois quebrada acusa', () => {
    const quebrada = 'create or replace function public.competitor_channel_remove_archived(a uuid, b uuid, c uuid) returns jsonb language plpgsql as $$ begin perform 1 from pg_stat_xact_user_tables x left join pg_class c on c.oid = x.relid; end $$;'
    const boa = 'create or replace function public.competitor_channel_remove_archived(a uuid, b uuid, c uuid) returns jsonb language plpgsql as $$ begin perform 1 from pg_partition_tree(c.oid) where not c.relispartition; perform 2 from pg_partition_tree(c.oid) where not c.relispartition; end $$;'
    expect(regra71(pastaFalsa({ '20990101000001_mg15.sql': quebrada }))).toHaveLength(2)
    expect(regra71(pastaFalsa({ '20990101000001_boa.sql': boa }))).toEqual([])
    expect(regra71(pastaFalsa({ '20990101000001_boa.sql': boa, '20990101000002_mg15.sql': quebrada }))).toHaveLength(2)
  })
  it('M2_BLOCO_11 contém as três funções e não converte', () => {
    for (const f of ['obs_archive_uncovered', 'obs_db_size_record', 'competitor_channel_remove_archived']) expect(M2_BLOCO_11).toContain(f)
    expect(M2_BLOCO_11).not.toContain('obs_part.converter(')
  })
  it('sem definição nenhuma não acusa', () => { expect(regra71(pastaFalsa({ '20990101000001_x.sql': 'select 1;' }))).toEqual([]) })
})

describe('item 119: obs_archive_is_site_admin citada pela fase só se alguma migration a define', () => {
  it('no repositório', () => { expect(regra119()).toEqual([]) })
  it('acusa a migration da fase que cita sem definição', () => {
    const d = pastaFalsa({ '20990101000001_manutencao_m3b.sql': 'select public.obs_archive_is_site_admin(null, null);' })
    expect(regra119(d)).toEqual(['20990101000001_manutencao_m3b.sql cita obs_archive_is_site_admin e nenhuma migration a define'])
  })
  it('migration de fora da fase não conta', () => {
    expect(regra119(pastaFalsa({ '20990101000001_e10.sql': 'select public.obs_archive_is_site_admin(null, null);' }))).toEqual([])
  })
})

describe('item 15: ninguém lê OBS_HOURLY_RAW_PURGE (pedido 5)', () => {
  it('nenhum arquivo de código cita a variável', () => {
    const raizes = ['apps/web/src', 'apps/api/src', 'packages', 'supabase/migrations', 'scripts'].map(p => join(RAIZ, p))
    const achados: string[] = []
    const varrer = (d: string): void => {
      let nomes: string[]
      try { nomes = readdirSync(d) } catch { return }
      for (const n of nomes) {
        if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue
        const p = join(d, n)
        if (statSync(p).isDirectory()) { varrer(p); continue }
        if (!/\.(ts|tsx|js|mjs|cjs|sql|sh|json)$/.test(n)) continue
        if (readFileSync(p, 'utf8').includes('OBS_HOURLY_RAW_PURGE')) achados.push(p.slice(RAIZ.length + 1))
      }
    }
    for (const r of raizes) varrer(r)
    expect(achados).toEqual([])
  })
})

describe('TRAVA M2-1: o SQL da M2 só entra em supabase/migrations no dia do push', () => {
  const daM2 = (): string[] => readdirSync(PASTA_DAS_MIGRATIONS).filter(n => /_manutencao_m2_/.test(n))
  it('antes do dia: nenhum arquivo da M2 em supabase/migrations e o rascunho existe; no dia: o arquivo existe e o rascunho saiu', () => {
    if (!M2_EM_MIGRATION) {
      expect(daM2()).toEqual([])
      expect(M2_SQL_CAMINHO.endsWith('supabase/rascunhos/m2.sql')).toBe(true)
    } else {
      expect(daM2().some(n => n.endsWith('_manutencao_m2_particoes.sql'))).toBe(true)
      expect(existsSync(resolve(__dirname, '../../../../supabase/rascunhos/m2.sql'))).toBe(false)
    }
  })
})

describe('TRAVA M3b-1: o SQL da M3b só entra em supabase/migrations no dia do push', () => {
  const daM3b = (): string[] => readdirSync(PASTA_DAS_MIGRATIONS).filter(n => /_manutencao_m3b_/.test(n))
  it('antes do dia: nenhum arquivo e o rascunho existe; no dia: o arquivo existe e o rascunho saiu', () => {
    if (!M3B_EM_MIGRATION) {
      expect(daM3b()).toEqual([])
      expect(existsSync(M3B_SQL_CAMINHO)).toBe(true)
    } else {
      expect(daM3b().some(n => n.endsWith('_manutencao_m3b_arquivo.sql'))).toBe(true)
      expect(existsSync(resolve(__dirname, '../../../../supabase/rascunhos/m3b.sql'))).toBe(false)
    }
  })
  it('D17: o corpo dos hashes está byte a byte no SQL da M3b', () => {
    const corpo = readFileSync(HASH_SQL_CAMINHO, 'utf8')
    const alvo = M3B_EM_MIGRATION
      ? readFileSync(resolve(PASTA_DAS_MIGRATIONS, daM3b().find(n => n.endsWith('_manutencao_m3b_arquivo.sql'))!), 'utf8')
      : readFileSync(M3B_SQL_CAMINHO, 'utf8')
    const ini = alvo.indexOf('-- obs-archive-hash.sql: início')
    const fim = alvo.indexOf('-- obs-archive-hash.sql: fim')
    expect(ini).toBeGreaterThanOrEqual(0)
    expect(alvo.slice(alvo.indexOf('\n', ini) + 1, fim)).toBe(corpo)
  })
  it('TRAVA M3b-2, parte mecânica: sem a migration no disco, nada de rota nem de botão novo (Yannis M8)', () => {
    if (!M3B_EM_MIGRATION) {
      expect(existsSync(resolve(__dirname, '../../src/app/api/pipeline/archive'))).toBe(false)
      expect(readFileSync(resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors/actions.ts'), 'utf8')).not.toContain('competitor_channel_remove')
    }
  })
  it('item 119 vale também para o rascunho: ele cita obs_archive_is_site_admin e a define', () => {
    const r = readFileSync(M3B_SQL_CAMINHO, 'utf8')
    if (/obs_archive_is_site_admin/.test(r)) expect(/create or replace function public\.obs_archive_is_site_admin\(p_site uuid, p_user uuid\)/.test(r)).toBe(true)
  })
})
