// apps/web/test/manutencao/classe-liberada.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const MIG = resolve(RAIZ, 'supabase/migrations')
const RASCUNHO = resolve(RAIZ, 'supabase/rascunhos/m5.sql')
const ler = (p: string): string => { try { return readFileSync(p, 'utf8') } catch { return '' } }
/** A última definição de `nome` entre o rascunho da M5 (antes da Tarefa 13) e as migrations (a mais nova que a define). */
function ultimaDefinicao(nome: string): string {
  const re = new RegExp(`function public\\.${nome}\\(`)
  const r = ler(RASCUNHO)
  const arqs = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort().filter(f => re.test(ler(resolve(MIG, f))))
  const m = arqs.length ? ler(resolve(MIG, arqs.at(-1)!)) : ''
  return re.test(r) ? r : m
}
const liberada = (classe: string, tabela: string): boolean =>
  new RegExp(`\\('${classe}', '${tabela}', '[a-z_]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', true`).test(ultimaDefinicao('obs_archive_policy'))

describe('item 87: classe liberada só com as telas', () => {
  it('serie liberada exige o carregador sem DAILY_MAX_DAYS e a função do online desde', () => {
    if (!liberada('serie', 'competitor_video_daily')) return
    expect(ler(resolve(RAIZ, 'apps/web/src/lib/youtube/observatorio/load.ts'))).not.toMatch(/DAILY_MAX_DAYS/)
    expect(ultimaDefinicao('obs_archive_online_since')).not.toBe('')
  })
  it('horaria liberada exige competitor_hourly_health lendo o desde de obs_archive_horaria_desde', () => {
    if (!liberada('horaria', 'competitor_video_hourly')) return
    expect(ultimaDefinicao('competitor_hourly_health')).toMatch(/obs_archive_horaria_desde/)
  })
  it('texto, video_antigo e ensaio continuam fechadas', () => {
    expect(liberada('texto', 'competitor_video_comments')).toBe(false)
    expect(liberada('video_antigo', 'competitor_raw')).toBe(false)
    expect(liberada('ensaio', 'obs_archive_rehearsal')).toBe(false)
  })
  it('o teste enxerga uma classe liberada (teste do teste)', () => {
    expect(new RegExp("\\('serie', 'competitor_video_daily', '[a-z_]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', true").test("('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true, 'views', 'numerico')")).toBe(true)
  })
})
