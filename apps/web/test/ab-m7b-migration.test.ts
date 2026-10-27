import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(__dirname, '../../../supabase/migrations')
const arquivo = readdirSync(DIR).find(f => f.endsWith('_ab_lab_m7b_escolha_do_dono.sql'))
const sql = arquivo ? readFileSync(resolve(DIR, arquivo), 'utf8') : ''

describe('migration M7b (escolha do dono): forma do SQL', () => {
  it('existe', () => { expect(arquivo).toBeTruthy() })
  it('é idempotente', () => {
    expect(sql).toMatch(/add column if not exists escolha_variant_id/)
    expect(sql).toMatch(/add column if not exists iniciativa/)
    expect(sql).toMatch(/drop constraint if exists ab_tests_escolha_tem_data/)
    expect(sql).toMatch(/drop constraint if exists yt_own_video_versions_ab_event_check/)
    expect(sql).toMatch(/drop trigger if exists ab_tests_escolha_so_servidor/)
  })
  it('a guarda é security invoker e não usa auth.role()', () => {
    const g = sql.slice(sql.indexOf('tg_ab_tests_escolha_so_servidor() returns trigger'), sql.indexOf('revoke all on function public.tg_ab_tests_escolha_so_servidor'))
    expect(g).toMatch(/security invoker/)
    expect(g).not.toMatch(/auth\.role\(\)/)
    expect(g).not.toMatch(/security definer/)
  })
  it('revoga a função da guarda e do histórico', () => {
    expect(sql).toMatch(/revoke all on function public\.tg_ab_tests_escolha_so_servidor\(\) from public, anon, authenticated/)
    expect(sql).toMatch(/revoke all on function public\.tg_ab_tests_restore_log\(\) from public, anon, authenticated/)
  })
  it('o gatilho do histórico segue security definer com search_path vazio e copia iniciativa só como dono', () => {
    const g = sql.slice(sql.indexOf('create or replace function public.tg_ab_tests_restore_log'))
    expect(g).toMatch(/security definer\s+set search_path = ''/)
    expect(g).toMatch(/case when v ->> 'iniciativa' = 'dono' then 'dono' end/)
  })
  it('o CHECK de ab_event aceita escolha', () => { expect(sql).toMatch(/'restauro', 'escolha'/) })
  it('comenta a coluna', () => { expect(sql).toMatch(/comment on column public\.ab_tests\.escolha_variant_id/) })
})
