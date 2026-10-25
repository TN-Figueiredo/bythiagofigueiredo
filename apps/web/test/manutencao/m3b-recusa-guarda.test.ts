// @vitest-environment node
/**
 * M3b-recusa, guarda estática (sem banco): depois da recusa, toda migration que recria competitor_video_purge ou competitor_comments_purge
 * tem de manter a chamada a obs_archive_m9_pronto, e nenhuma pode pô-la em competitor_channel_purge. Pega a A5 recriando a função e tirando a
 * recusa em silêncio (como a F2 fez em 18/10); o `m3b_recusa_e9_mudou` só pega no dia da migration, este pega todo dia na CI.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')
const RASCUNHO = resolve(__dirname, '../../../../supabase/rascunhos/m3b-recusa.sql')
const MSG = 'D-M9-26: a recusa enquanto a M9 não existe; ver .superpowers/sdd/manutencao-nas/plano-m3b-recusa-2510.md'

/** O corpo de cada `create or replace function public.<nome>` do texto (até o próximo `create or replace function` ou o fim). */
function corpos(sql: string, nome: string): string[] {
  const re = new RegExp(`create or replace function public\\.${nome}\\s*\\(`, 'gi')
  const inicios = [...sql.matchAll(re)].map(m => m.index as number)
  return inicios.map(i => {
    const resto = sql.slice(i + 1)
    const prox = resto.search(/create or replace function /i)
    return prox < 0 ? sql.slice(i) : sql.slice(i, i + 1 + prox)
  })
}

describe('M3b-recusa: guarda de migrations', () => {
  const todas = readdirSync(MIGRATIONS).filter(n => n.endsWith('.sql')).sort()
  const daRecusa = todas.find(n => n.endsWith('_manutencao_m3b_recusa.sql'))

  it('a recusa existe (migration, ou o rascunho enquanto a migration não nasce)', () => {
    expect(daRecusa !== undefined || existsSync(RASCUNHO), MSG).toBe(true)
  })

  it('toda migration posterior que recria vídeo/comentários mantém obs_archive_m9_pronto', () => {
    const depois = daRecusa ? todas.filter(n => n > daRecusa) : []
    for (const arq of depois) {
      const sql = readFileSync(resolve(MIGRATIONS, arq), 'utf8')
      for (const nome of ['competitor_video_purge', 'competitor_comments_purge']) {
        for (const corpo of corpos(sql, nome)) expect(corpo.includes('obs_archive_m9_pronto'), `${arq}: ${nome}. ${MSG}`).toBe(true)
      }
    }
  })

  it('nenhuma migration (nem o rascunho) põe a recusa em competitor_channel_purge', () => {
    const textos = todas.map(n => [n, readFileSync(resolve(MIGRATIONS, n), 'utf8')] as const)
    if (existsSync(RASCUNHO)) textos.push(['m3b-recusa.sql (rascunho)', readFileSync(RASCUNHO, 'utf8')])
    for (const [arq, sql] of textos) {
      for (const corpo of corpos(sql, 'competitor_channel_purge')) expect(corpo.includes('obs_archive_m9_pronto'), `${arq}: competitor_channel_purge não leva a recusa (a lista de remoções do canal já existe). ${MSG}`).toBe(false)
    }
  })

  it('o detector funciona: um corpo sem a chamada é pego (mutante)', () => {
    const sem = `create or replace function public.competitor_comments_purge(p_site uuid) returns void as $$ begin null; end $$;`
    const com = `create or replace function public.competitor_comments_purge(p_site uuid) returns void as $$ begin perform public.obs_archive_m9_pronto(p_site); end $$;`
    expect(corpos(sem, 'competitor_comments_purge').every(c => c.includes('obs_archive_m9_pronto'))).toBe(false)
    expect(corpos(com, 'competitor_comments_purge').every(c => c.includes('obs_archive_m9_pronto'))).toBe(true)
  })
})
