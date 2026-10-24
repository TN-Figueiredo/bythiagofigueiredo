// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchScheduleData } from '@/lib/schedule/schedule-queries'
import { loadSchema } from '../../helpers/schema-audit'

// Regressão (Gio, ressalva B): /cms/schedule consultava content_pipeline.published_at, coluna que não existe.
type Call = { table: string; select: string; filters: string[]; eqs: string[]; rows: unknown[] }

function fakeClient(rowsByTable: Record<string, (c: Call) => unknown[]>) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      const call: Call = { table, select: '', filters: [], eqs: [], rows: [] }
      calls.push(call)
      const chain: Record<string, unknown> = {}
      const self = new Proxy(chain, {
        get(_t, prop: string) {
          if (prop === 'then') {
            call.rows = rowsByTable[table]?.(call) ?? []
            return (resolve: (v: unknown) => void) => resolve({ data: call.rows, error: null })
          }
          return (...args: unknown[]) => {
            if (prop === 'select') call.select = String(args[0])
            else if (typeof args[0] === 'string') {
              call.filters.push(args[0])
              if (prop === 'eq') call.eqs.push(`${args[0]}=${String(args[1])}`)
            }
            return self
          }
        },
      })
      return self
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('fetchScheduleData: content_pipeline', () => {
  const { schema } = loadSchema(resolve(__dirname, '../../../src/types/database.types.ts'))
  const cols = schema.get('content_pipeline')!.columns

  it('toda coluna consultada em content_pipeline existe no esquema', async () => {
    const { client, calls } = fakeClient({})
    await fetchScheduleData(client, 'site-1', '2026-10', 'America/Sao_Paulo')
    const cp = calls.filter((c) => c.table === 'content_pipeline')
    expect(cp.length).toBeGreaterThanOrEqual(3)
    for (const c of cp) {
      const used = [...c.select.split(',').map((s) => s.trim()), ...c.filters]
      for (const col of used) expect(cols.has(col), `${col} em: ${c.select}`).toBe(true)
    }
    expect(cols.has('published_at')).toBe(false)
  })

  it('vídeo publicado aparece no calendário pela data de scheduled_at', async () => {
    const { client } = fakeClient({
      content_pipeline: (c) =>
        c.eqs.includes('stage=published')
          ? [{ id: 'v1', title_pt: 'Vídeo', title_en: null, stage: 'published', scheduled_at: '2026-10-10T15:00:00Z' }]
          : [],
    })
    const data = await fetchScheduleData(client, 'site-1', '2026-10', 'America/Sao_Paulo')
    const v = data.items.find((i) => i.id === 'v1')
    expect(v).toBeTruthy()
    expect(v?.status).toBe('published')
    expect(v?.dateKey).toBe('2026-10-10')
  })
})
