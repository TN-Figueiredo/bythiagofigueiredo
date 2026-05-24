import { describe, it } from 'vitest'
import { skipIfNoLocalDb } from '../../helpers/db-skip'

describe.skipIf(skipIfNoLocalDb())('playlist snapshots (integration)', () => {
  it.todo('createSnapshot inserts a row with correct graph_data')
  it.todo('createSnapshot deduplicates auto-type by content_hash')
  it.todo('withSnapshot creates snapshot before executing mutation')
  it.todo('restore_playlist_snapshot RPC restores full state')
  it.todo('restore_playlist_snapshot RPC restores edges_only (skips items from snapshot not in current)')
  it.todo('restore_playlist_snapshot RPC restores positions_only')
  it.todo('cleanup cron deletes expired auto snapshots')
})
