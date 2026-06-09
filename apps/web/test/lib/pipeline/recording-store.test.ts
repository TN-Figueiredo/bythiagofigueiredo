import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetMemStore,
  applyRemote,
  dirtyRows,
  loadLocal,
  markSynced,
  mergeRemoteRows,
  putLocal,
  rowKey,
  type LocalRecRow,
  type RemoteRecRow,
} from '@/lib/pipeline/recording-store'

// Note: in the vitest `src/lib/**` (node) env there is no `window`/`indexedDB`,
// so the store transparently uses its in-memory fallback. These tests therefore
// exercise BOTH the pure merge core AND the fallback IO path.

function local(over: Partial<LocalRecRow> = {}): LocalRecRow {
  return {
    pipelineId: 'p1',
    lang: 'pt',
    beatId: 'b1',
    status: 'pendente',
    updatedAt: 1000,
    dirty: false,
    ...over,
  }
}

function remote(over: Partial<RemoteRecRow> = {}): RemoteRecRow {
  return {
    pipelineId: 'p1',
    lang: 'pt',
    beatId: 'b1',
    status: 'pendente',
    updatedAt: 1000,
    ...over,
  }
}

describe('rowKey', () => {
  it('keys by pipelineId:lang:beatId', () => {
    expect(rowKey({ pipelineId: 'p1', lang: 'en', beatId: 'b9' })).toBe('p1:en:b9')
  })

  it('distinguishes langs for the same beat', () => {
    const pt = rowKey({ pipelineId: 'p1', lang: 'pt', beatId: 'b1' })
    const en = rowKey({ pipelineId: 'p1', lang: 'en', beatId: 'b1' })
    expect(pt).not.toBe(en)
  })
})

describe('mergeRemoteRows (pure core)', () => {
  it('dirty local wins even when remote is newer', () => {
    const l = [local({ status: 'gravada', dirty: true, updatedAt: 1000 })]
    const r = [remote({ status: 'pendente', updatedAt: 9999 })]
    const merged = mergeRemoteRows(l, r)
    expect(merged).toHaveLength(1)
    expect(merged[0].status).toBe('gravada')
    expect(merged[0].dirty).toBe(true)
    expect(merged[0].updatedAt).toBe(1000)
  })

  it('clean local: newer remote wins (becomes clean)', () => {
    const l = [local({ status: 'pendente', dirty: false, updatedAt: 1000 })]
    const r = [remote({ status: 'gravada', updatedAt: 2000 })]
    const merged = mergeRemoteRows(l, r)
    expect(merged[0].status).toBe('gravada')
    expect(merged[0].updatedAt).toBe(2000)
    expect(merged[0].dirty).toBe(false)
  })

  it('clean local: newer local wins and stays local', () => {
    const l = [local({ status: 'refazer', dirty: false, updatedAt: 5000 })]
    const r = [remote({ status: 'gravada', updatedAt: 2000 })]
    const merged = mergeRemoteRows(l, r)
    expect(merged[0].status).toBe('refazer')
    expect(merged[0].updatedAt).toBe(5000)
    expect(merged[0].dirty).toBe(false)
  })

  it('tie on updatedAt: remote wins (server is source of truth for clean rows)', () => {
    const l = [local({ status: 'pendente', dirty: false, updatedAt: 3000 })]
    const r = [remote({ status: 'gravada', updatedAt: 3000 })]
    const merged = mergeRemoteRows(l, r)
    expect(merged[0].status).toBe('gravada')
    expect(merged[0].dirty).toBe(false)
  })

  it('remote-only key is adopted as clean', () => {
    const r = [remote({ beatId: 'b2', status: 'gravada', updatedAt: 4000 })]
    const merged = mergeRemoteRows([], r)
    expect(merged).toHaveLength(1)
    expect(merged[0].beatId).toBe('b2')
    expect(merged[0].dirty).toBe(false)
    expect(merged[0].status).toBe('gravada')
  })

  it('local-only clean key is kept', () => {
    const l = [local({ beatId: 'b3', status: 'gravada', dirty: false })]
    const merged = mergeRemoteRows(l, [])
    expect(merged).toHaveLength(1)
    expect(merged[0].beatId).toBe('b3')
    expect(merged[0].dirty).toBe(false)
  })

  it('local-only dirty key is kept (unsynced edit)', () => {
    const l = [local({ beatId: 'b4', status: 'refazer', dirty: true })]
    const merged = mergeRemoteRows(l, [])
    expect(merged).toHaveLength(1)
    expect(merged[0].dirty).toBe(true)
    expect(merged[0].status).toBe('refazer')
  })

  it('combines dirty-wins, remote-only, and local-only in one pass', () => {
    const l = [
      local({ beatId: 'b1', status: 'gravada', dirty: true, updatedAt: 100 }), // dirty wins
      local({ beatId: 'b2', status: 'pendente', dirty: false, updatedAt: 100 }), // remote newer
      local({ beatId: 'b3', status: 'refazer', dirty: false, updatedAt: 9000 }), // local only
    ]
    const r = [
      remote({ beatId: 'b1', status: 'pendente', updatedAt: 9999 }),
      remote({ beatId: 'b2', status: 'gravada', updatedAt: 200 }),
      remote({ beatId: 'b5', status: 'gravada', updatedAt: 300 }), // remote only
    ]
    const merged = mergeRemoteRows(l, r)
    const byBeat = new Map(merged.map((row) => [row.beatId, row]))
    expect(byBeat.get('b1')?.status).toBe('gravada')
    expect(byBeat.get('b1')?.dirty).toBe(true)
    expect(byBeat.get('b2')?.status).toBe('gravada') // remote won
    expect(byBeat.get('b2')?.dirty).toBe(false)
    expect(byBeat.get('b3')?.status).toBe('refazer') // local only kept
    expect(byBeat.get('b5')?.status).toBe('gravada') // remote only adopted
    expect(byBeat.get('b5')?.dirty).toBe(false)
    expect(merged).toHaveLength(4)
  })

  it('does not mutate inputs', () => {
    const l = [local({ status: 'gravada', dirty: false, updatedAt: 1000 })]
    const r = [remote({ status: 'refazer', updatedAt: 2000 })]
    const lSnap = JSON.stringify(l)
    const rSnap = JSON.stringify(r)
    mergeRemoteRows(l, r)
    expect(JSON.stringify(l)).toBe(lSnap)
    expect(JSON.stringify(r)).toBe(rSnap)
  })

  it('is deterministic: local order first, then remote-only order', () => {
    const l = [local({ beatId: 'bA' }), local({ beatId: 'bB' })]
    const r = [remote({ beatId: 'bZ', updatedAt: 1 }), remote({ beatId: 'bY', updatedAt: 1 })]
    const merged = mergeRemoteRows(l, r)
    expect(merged.map((row) => row.beatId)).toEqual(['bA', 'bB', 'bZ', 'bY'])
  })

  it('preserves optional fields when adopting remote', () => {
    const r = [
      remote({ beatId: 'b7', beatName: 'Intro', retakeNote: 'too fast', contentHash: 'abc', updatedAt: 5 }),
    ]
    const merged = mergeRemoteRows([], r)
    expect(merged[0].beatName).toBe('Intro')
    expect(merged[0].retakeNote).toBe('too fast')
    expect(merged[0].contentHash).toBe('abc')
  })
})

describe('IndexedDB store — in-memory fallback path', () => {
  beforeEach(() => {
    __resetMemStore()
  })

  it('putLocal then loadLocal round-trips a row', async () => {
    await putLocal(local({ beatId: 'b1', status: 'gravada', dirty: true, updatedAt: 10 }))
    const rows = await loadLocal('p1', 'pt')
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('gravada')
    expect(rows[0].dirty).toBe(true)
  })

  it('loadLocal scopes by pipelineId + lang', async () => {
    await putLocal(local({ pipelineId: 'p1', lang: 'pt', beatId: 'b1' }))
    await putLocal(local({ pipelineId: 'p1', lang: 'en', beatId: 'b1' }))
    await putLocal(local({ pipelineId: 'p2', lang: 'pt', beatId: 'b1' }))
    const pt = await loadLocal('p1', 'pt')
    expect(pt).toHaveLength(1)
    expect(pt[0].lang).toBe('pt')
    expect(pt[0].pipelineId).toBe('p1')
  })

  it('putLocal upserts (same composite key overwrites)', async () => {
    await putLocal(local({ beatId: 'b1', status: 'pendente', updatedAt: 1 }))
    await putLocal(local({ beatId: 'b1', status: 'refazer', updatedAt: 2 }))
    const rows = await loadLocal('p1', 'pt')
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('refazer')
  })

  it('applyRemote merges and persists the result back', async () => {
    await putLocal(local({ beatId: 'b1', status: 'gravada', dirty: true, updatedAt: 100 }))
    await putLocal(local({ beatId: 'b2', status: 'pendente', dirty: false, updatedAt: 100 }))
    const merged = await applyRemote('p1', 'pt', [
      remote({ beatId: 'b1', status: 'pendente', updatedAt: 9999 }), // loses to dirty local
      remote({ beatId: 'b2', status: 'gravada', updatedAt: 200 }), // wins (newer)
      remote({ beatId: 'b3', status: 'refazer', updatedAt: 50 }), // remote only
    ])
    const byBeat = new Map(merged.map((r) => [r.beatId, r]))
    expect(byBeat.get('b1')?.status).toBe('gravada')
    expect(byBeat.get('b2')?.status).toBe('gravada')
    expect(byBeat.get('b3')?.status).toBe('refazer')

    // Persisted: a fresh load returns the merged state.
    const reloaded = await loadLocal('p1', 'pt')
    expect(reloaded).toHaveLength(3)
    const r2 = new Map(reloaded.map((r) => [r.beatId, r]))
    expect(r2.get('b2')?.status).toBe('gravada')
    expect(r2.get('b3')?.dirty).toBe(false)
  })

  it('dirtyRows returns only dirty rows across all keys', async () => {
    await putLocal(local({ pipelineId: 'p1', lang: 'pt', beatId: 'b1', dirty: true }))
    await putLocal(local({ pipelineId: 'p1', lang: 'en', beatId: 'b2', dirty: true }))
    await putLocal(local({ pipelineId: 'p2', lang: 'pt', beatId: 'b3', dirty: false }))
    const dirty = await dirtyRows()
    expect(dirty).toHaveLength(2)
    expect(dirty.every((r) => r.dirty)).toBe(true)
  })

  it('markSynced clears the dirty flag on the given keys', async () => {
    const d = local({ pipelineId: 'p1', lang: 'pt', beatId: 'b1', dirty: true })
    await putLocal(d)
    await putLocal(local({ pipelineId: 'p1', lang: 'pt', beatId: 'b2', dirty: true }))
    await markSynced([rowKey(d)])
    const stillDirty = await dirtyRows()
    expect(stillDirty.map((r) => r.beatId)).toEqual(['b2'])
  })

  it('markSynced is a no-op for empty keys and unknown keys', async () => {
    await putLocal(local({ beatId: 'b1', dirty: true }))
    await markSynced([])
    await markSynced(['p9:pt:nope'])
    const dirty = await dirtyRows()
    expect(dirty).toHaveLength(1)
  })

  it('loadLocal on an empty store returns []', async () => {
    const rows = await loadLocal('nope', 'pt')
    expect(rows).toEqual([])
  })
})
