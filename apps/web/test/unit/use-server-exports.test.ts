// @vitest-environment node
// Static ratchet: a 'use server' module may only export async functions.
// Next 16 enforces this at module evaluation, so ONE stray `export const
// schema = z.object(...)` disables EVERY server action in that file — in prod
// the YouTube "Sync" button surfaced it as React #441 (2026-09-06), with the
// real message only in Vercel logs: "A "use server" file can only export async
// functions, found object". Type-only exports are fine (erased at build).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = join(__dirname, '..', '..', 'src')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
  )
}

const USE_SERVER = /^\s*(['"])use server\1/
// Anything `export`ed that is not `export async function`, `export type`,
// `export interface`, or `export { type ... }`.
const BAD_EXPORT = /^export\s+(?!async\s+function\b|type\b|interface\b|\{\s*type\b)([^\n]{0,100})/gm

describe("'use server' modules export only async functions", () => {
  const files = walk(SRC).filter((f) => USE_SERVER.test(readFileSync(f, 'utf8')))

  it('finds the server-action modules (guard against a broken walk)', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('has no non-function exports', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(BAD_EXPORT)) {
        offenders.push(`${f.replace(SRC, 'src')}: export ${m[1].trim()}`)
      }
    }
    expect(offenders, 'move the value to a non-"use server" module or drop the export').toEqual([])
  })
})
