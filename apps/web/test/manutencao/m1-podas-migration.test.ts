// @vitest-environment node
/** M1: o texto da migration das podas, sem banco (roda na CI, onde o pg_cron não existe e o agendamento não é exercido). */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const nome = readdirSync(DIR).find(f => f.includes('manutencao_m1_podas_execucao'))
const sql = nome ? readFileSync(DIR + nome, 'utf8') : ''

/** Horas já ocupadas por agendamentos do banco (F11 e saidas/producao.txt, P7), em UTC. */
const OCUPADAS = new Set(['0 5', '30 5', '0 6'])

/** Confere o guarda e as agendas; devolve os problemas (vazio = ok). */
function conferirAgendas(texto: string): string[] {
  const problemas: string[] = []
  const guarda = texto.slice(texto.indexOf('do $guard$'))
  if (!guarda.includes(`if not exists (select 1 from pg_extension where extname = 'pg_cron')`)) problemas.push('sem guarda do pg_cron')
  const agendas = [...guarda.matchAll(/cron\.schedule\('([^']+)', '([^']+)'/g)].map(m => [m[1], m[2]])
  const combinado = [['purge-cron-runs', '10 6 * * *'], ['purge-yt-own-collection-attempts', '50 6 * * *']]
  if (JSON.stringify(agendas) !== JSON.stringify(combinado)) problemas.push('agendas diferentes do combinado')
  for (const [, cron] of agendas) {
    const [min, hora] = cron.split(' ')
    if (OCUPADAS.has(`${min} ${hora}`)) problemas.push(`hora ocupada: ${cron}`)
    if (['0', '20', '40'].includes(min)) problemas.push(`minuto proibido: ${cron}`)
  }
  if (texto.slice(0, texto.indexOf('do $guard$')).includes('cron.schedule')) problemas.push('cron.schedule fora do guarda')
  return problemas
}

describe('M1: migration das podas (estático)', () => {
  it('o arquivo existe', () => { expect(nome).toBeDefined() })

  it('os dois agendamentos estão dentro do guarda do pg_cron, com nome e hora fixos', () => {
    expect(conferirAgendas(sql)).toEqual([])
  })

  it('o teste enxerga: agenda às 06:00 é acusada', () => {
    expect(conferirAgendas(sql.replace("'10 6 * * *'", "'0 6 * * *'"))).not.toEqual([])
  })

  it('cada invólucro registra a execução em cron_runs', () => {
    expect(sql.match(/insert into public\.cron_runs/g)).toHaveLength(2)
  })

  it('toda função é security definer, search_path vazio, sem execute para public, anon e authenticated', () => {
    const funcoes = ['purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts']
    for (const f of funcoes) {
      const ini = sql.indexOf(`create or replace function public.${f}(`)
      expect(ini, f).toBeGreaterThanOrEqual(0)
      const corpo = sql.slice(ini, sql.indexOf('$$;', ini))
      expect(corpo, f).toContain('security definer')
      expect(corpo, f).toContain(`set search_path = ''`)
      expect(sql, f).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`))
      expect(sql, f).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`))
    }
  })

  it('o piso de 90 dias está nas duas podas, e nenhuma linha da migration reescreve tabela', () => {
    expect(sql.match(/p_dias < 90/g)).toHaveLength(2)
    expect(sql.match(/p_dias integer default 90/g)).toHaveLength(2)
    expect(sql).not.toMatch(/\b(vacuum|truncate|drop table|cluster)\b/i)
  })

  it('só duas tabelas são apagadas', () => {
    const alvos = [...sql.matchAll(/delete from public\.([a-z_]+)/g)].map(m => m[1])
    expect(alvos).toEqual(['cron_runs', 'yt_own_collection_attempts'])
  })
})
