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
const CACHED = 'competitor_videos|competitor_video_versions|competitor_video_daily|competitor_channel_snapshots'
/** A write to a cached table, one of the two functions that write to them, or the delete of a channel (cascades to all four). */
const WRITES = new RegExp(`from\\('(?:${CACHED})'\\)\\s*\\.(?:insert|update|upsert|delete)\\(|rpc\\('(?:apply_competitor_version_plan|pin_competitor_video)'|from\\('competitor_channels'\\)\\s*\\.delete\\(`)
/**
 * The sync itself (its callers invalidate), the watchdog prune of snapshots older than 365 d (outside the 90 d read),
 * and the actions (pin, unpin, remove channel), which invalidate themselves.
 */
const KNOWN_WRITERS = ['lib/youtube/competitor-sync.ts', 'lib/youtube/short-backfill.ts', 'app/api/cron/ab-watchdog/route.ts', ACTIONS]
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
  it('em actions.ts cada sincronização e cada escrita (fixar, desafixar, remover canal) tem a sua invalidação', () => {
    const text = ALL.find(f => f.file === ACTIONS)!.text
    const count = (re: RegExp) => (text.match(re) ?? []).length
    expect(count(/await syncCompetitorChannel\(/g)).toBe(4)
    expect(count(/invalidateObservatory\(siteId\)/g)).toBe(5) // the four syncs + remove channel
    // pin (one write, also when already pinned) and unpin (the write, and the already-unpinned answer)
    expect(count(/rpc\('pin_competitor_video'/g)).toBe(1)
    expect(count(/from\('competitor_videos'\)\.update\(/g)).toBe(1)
    expect(count(/invalidateObservatory\(who\.siteId\)/g)).toBe(3)
  })
})
