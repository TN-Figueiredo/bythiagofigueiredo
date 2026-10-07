// @vitest-environment node
// Catraca do PACK_VERSION. Uma entrada do cache sobrevive ao deploy (a chave é PACK_VERSION + argumentos): quem muda as
// colunas lidas ou a forma do pacote sem subir o número faz o código novo ler um pacote velho com a forma nova, e
// unpackChannel o aceita, porque só confere `v` e as quatro listas. Este arquivo guarda o retrato da forma que vale
// para o PACK_VERSION atual e reprova quando um muda sem o outro.
import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'
import { loadChannelRows } from '@/lib/youtube/observatorio/load-channel'
import { packChannel, PACK_VERSION } from '@/lib/youtube/observatorio/pack'

/**
 * O RETRATO. Só se mexe aqui junto com PACK_VERSION (pack.ts): mudou a forma → suba o número e reescreva o retrato com
 * o que o teste mostrar como recebido.
 */
const PORTRAIT = {
  version: 1,
  /** As colunas que a leitura por canal pede a cada tabela (load-channel.ts), na ordem das consultas. */
  selects: [
    'competitor_videos: id, competitor_channel_id, video_id, title, view_count, like_count, comment_count, duration_seconds, published_at, is_short, last_checked_at, tags, thumbnail_url, pinned_at',
    'competitor_channel_snapshots: id, competitor_channel_id, snapshot_date, subscriber_count, view_count, video_count',
    'competitor_video_versions: id, video_id, field, value_text, value_hash, has_text, thumb_blob_url, first_seen_at, last_seen_at, window_start, precision, is_current',
    'competitor_video_versions: id, video_id, field, value_hash, has_text, thumb_blob_url, first_seen_at, last_seen_at, window_start, precision, is_current',
    'competitor_video_daily: video_id, snap_date, views, taken_at',
    'competitor_video_versions: id, value_text',
  ],
  /** As chaves do que é guardado: o envelope e, por lista, a união das chaves das linhas. */
  envelope: ['daily', 'snapshots', 'v', 'versions', 'videos'],
  rows: {
    videos: ['comment_count', 'competitor_channel_id', 'duration_seconds', 'id', 'is_short', 'last_checked_at', 'like_count', 'pinned_at', 'published_at', 'tags', 'thumbnail_url', 'title', 'video_id', 'view_count'],
    versions: ['field', 'first_seen_at', 'has_text', 'id', 'is_current', 'last_seen_at', 'precision', 'text_omitted', 'thumb_blob_url', 'value_hash', 'value_text', 'video_id', 'window_start'],
    daily: ['snap_date', 'taken_at', 'video_id', 'views'],
    snapshots: ['competitor_channel_id', 'id', 'snapshot_date', 'subscriber_count', 'video_count', 'view_count'],
  },
}

const NOW = Date.now()
const keysOf = (xs: unknown): string[] => [...new Set((xs as Array<Record<string, unknown>>).flatMap(x => Object.keys(x)))].sort()

/** A forma de verdade: um canal com fixado, descrição trocada e descrição nunca trocada, lido e empacotado pelo código de produção. */
async function shapeNow() {
  const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW, pinOldest: true }))
  const packed = packChannel(await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 3, seriesStart: NOW - 5 * 864e5, now: NOW }))
  const stored = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8')) as Record<string, unknown>
  return {
    selects: [...new Set(db.selects.map(s => s.table + ': ' + s.cols))],
    envelope: Object.keys(stored).sort(),
    rows: { videos: keysOf(stored.videos), versions: keysOf(stored.versions), daily: keysOf(stored.daily), snapshots: keysOf(stored.snapshots) },
  }
}

describe('catraca do PACK_VERSION', () => {
  it('a forma do pacote é a do retrato deste PACK_VERSION', async () => {
    const { version, ...shape } = PORTRAIT
    const now = await shapeNow()
    // every list has rows: an empty list would have no keys to compare
    for (const list of Object.values(now.rows)) expect(list.length).toBeGreaterThan(0)
    expect(now, 'mudou a forma do pacote (colunas lidas ou chaves guardadas): suba PACK_VERSION em pack.ts e atualize este retrato (version e a forma) no mesmo commit').toEqual(shape)
    expect(PACK_VERSION, 'PACK_VERSION mudou: atualize `version` deste retrato, junto com a forma se ela mudou').toBe(version)
  })
})
