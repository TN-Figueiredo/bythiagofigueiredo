// @vitest-environment node
// Guard against a stale Observatório with everything green: whoever writes to a cached table, or runs the sync that
// does, has to invalidate the site's cache tag.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = path.join(dir, f)
  return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []
})
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/')
const ALL = files(SRC).map(p => ({ file: rel(p), text: readFileSync(p, 'utf8') }))

const ACTIONS = 'app/cms/(authed)/youtube/competitors/actions.ts'
const CACHED = 'competitor_videos|competitor_video_versions|competitor_video_daily|competitor_channel_snapshots|competitor_video_marks|competitor_video_mark_misses'
/** A write to a cached table, one of the two functions that write to them, or the delete of a channel (cascades to all four). */
const WRITES = new RegExp(`from\\('(?:${CACHED})'\\)\\s*\\.(?:insert|update|upsert|delete)\\(|rpc\\('(?:apply_competitor_version_plan|pin_competitor_video|competitor_video_purge|competitor_channel_purge|competitor_missing_keep|competitor_marks_apply)'|ida\\(o\\.sb, 'competitor_marks_apply'|from\\('competitor_channels'\\)\\s*\\.(?:delete|update)\\(`)
/**
 * The sync itself (its callers invalidate), the prune of snapshots older than 365 d (outside the 90 d read; `lib/youtube/competitor-snapshot-prune.ts`, called by the watchdog),
 * the actions (pin, unpin, pedir/desfazer/apagar canal), which invalidate themselves, and the writer of the age marks
 * (fechar-marcas.ts: the agenda task `marcas_de_idade` returns the channels in `extra` and executar.ts invalidates them).
 */
const KNOWN_WRITERS = ['lib/youtube/competitor-sync.ts', 'lib/youtube/short-backfill.ts', 'lib/youtube/competitor-snapshot-prune.ts', 'lib/youtube/observatorio/saiu/responder.ts', 'lib/youtube/observatorio/medidas/fechar-marcas.ts', ACTIONS]
const RUNS_SYNC = /from '@\/lib\/youtube\/competitor-sync(?:-batch)?'/

describe('quem escreve no que o Observatório guarda em cache', () => {
  it('a varredura enxerga os escritores conhecidos (o padrão não está morto)', () => {
    const found = ALL.filter(f => WRITES.test(f.text)).map(f => f.file).sort()
    expect(found).toEqual([...KNOWN_WRITERS].sort())
  })
  it('quem chama a sincronização fora de lib/youtube invalida a tag do site', () => {
    const callers = ALL.filter(f => RUNS_SYNC.test(f.text) && !f.file.startsWith('lib/youtube/'))
    expect(callers.map(f => f.file).sort()).toEqual(['app/api/cron/sync-youtube/route.ts', ACTIONS])
    for (const f of callers) expect({ file: f.file, invalidates: f.text.includes('invalidateObservatory(') }).toEqual({ file: f.file, invalidates: true })
  })
  it('quem chama o serviço das respostas invalida (a fila Saíram do YouTube muda o banco)', () => {
    const callers = ALL.filter(f => /from '@\/lib\/youtube\/observatorio\/saiu\/responder'/.test(f.text) && !f.file.startsWith('lib/'))
    expect(callers.length).toBeGreaterThan(0)
    for (const f of callers) expect({ file: f.file, invalidates: f.text.includes('invalidateObservatory(') }).toEqual({ file: f.file, invalidates: true })
  })
  it('o caminho da agenda invalida: o disparo da agenda (lib/youtube/agenda/executar.ts) roda a sincronização e invalida o site e o layout', () => {
    const text = ALL.find(f => f.file === 'lib/youtube/agenda/executar.ts')!.text
    expect(text).toContain('invalidateObservatory(')
    expect(text).toContain('revalidatePath(')
  })
  it('em actions.ts cada sincronização e cada escrita (fixar, desafixar, remover canal) tem a sua invalidação', () => {
    const text = ALL.find(f => f.file === ACTIONS)!.text
    const count = (re: RegExp) => (text.match(re) ?? []).length
    expect(count(/await syncCompetitorChannel\(/g)).toBe(4)
    expect(count(/invalidateObservatory\(siteId, \[/g)).toBe(4) // the first sync, syncCompetitorNow, syncFullHistory (channel tags) and updateVideoLimit; `soltarCache` (pedir, desfazer e apagar sem guardar, num finally) vive em _canais/solta-cache.ts desde a M9b T2
    expect(count(/soltarCache\(g\.siteId\)/g)).toBe(3)
    const solta = readFileSync(path.join(SRC, 'app/cms/(authed)/youtube/competitors/_canais/solta-cache.ts'), 'utf8')
    expect(solta).toContain('invalidateObservatory(siteId)')
    expect(solta).toContain('revalidatePath(')
    // pin (one write, also when already pinned) and unpin (the write, and the already-unpinned answer)
    expect(count(/rpc\('pin_competitor_video'/g)).toBe(1)
    expect(count(/from\('competitor_videos'\)\.update\(/g)).toBe(1)
    expect(count(/invalidateObservatory\(who\.siteId, /g)).toBe(3)
    // the many-channel sync keeps the whole site (the list of `attempted` would add nothing)
    expect(count(/invalidateObservatory\(siteId\)/g)).toBe(1)
    // video_limit is read by the cached measures of the channel
    expect(count(/from\('competitor_channels'\)\s*\.update\(\{ video_limit/g)).toBe(1)
  })
  it('a rota e a agenda derrubam canal a canal, e a tarefa das marcas devolve os canais no extra', () => {
    const rota = ALL.find(f => f.file === 'app/api/cron/sync-youtube/route.ts')!.text
    expect(rota).toMatch(/invalidateObservatory\(siteId, \(channelIdsBySite \?\? \{\}\)\[siteId\]\)/)
    expect(rota).toContain('const visited = new Set<string>()')
    const agenda = ALL.find(f => f.file === 'lib/youtube/agenda/executar.ts')!.text
    expect(agenda).toContain("extraDe('serie_semanal')")
    expect(agenda).toContain("extraDe('marcas_de_idade')")
    const marcas = ALL.find(f => f.file === 'lib/youtube/agenda/tarefas/marcas-de-idade.ts')!.text
    expect(marcas).toContain('channelIdsBySite')
    // todo `runWeeklyPhase(` alimenta a lista (devolve channelIdsBySite) ou entrega o resultado inteiro a quem a lê
    const batch = ALL.find(f => f.file === 'lib/youtube/competitor-sync-batch.ts')!.text
    expect(batch).toContain('out.channelIdsBySite[siteId] = [...set]')
  })
})
