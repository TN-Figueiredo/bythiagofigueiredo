export interface ArtlistSearchResult {
  url: string
  fallbackUrl: string | null
  ids: number[]
  fallbackIds: number[]
}

const GENRES: Record<string, number> = {
  'ambient': 57, 'blues': 58, 'soul-rnb': 59, 'country': 60, 'jazz': 61,
  'cinematic': 62, 'world': 63, 'electronic': 64, 'acoustic': 65, 'indie': 66,
  'rock': 68, 'pop': 69, 'singer-songwriter': 70, 'folk': 71, 'classical': 72,
  'hip-hop': 85, 'funk': 89, 'latin': 91, 'lofi-chill-beats': 549,
}

const MOODS: Record<string, number> = {
  'uplifting': 5, 'powerful': 6, 'happy': 7, 'carefree': 8, 'love': 9,
  'peaceful': 10, 'serious': 12, 'dramatic': 13, 'angry': 14, 'tense': 15,
  'sad': 16, 'playful': 35, 'hopeful': 78, 'scary': 79, 'groovy': 83,
  'dark': 92, 'funny': 101, 'exciting': 105, 'epic': 311, 'mysterious': 320,
}

const INSTRUMENTS: Record<string, number> = {
  'acoustic-guitar': 38, 'electric-guitar': 39, 'piano': 40, 'acoustic-drums': 41,
  'strings': 42, 'percussion': 43, 'bells': 48, 'synth': 49, 'keys': 80,
  'electronic-drums': 82, 'orchestra': 86, 'brass': 98, 'pads': 322, 'bass': 548,
}

const VIDEO_THEMES: Record<string, number> = {
  'documentary': 22, 'travel': 75, 'trailer': 551, 'vlog': 553, 'shorts': 556,
}

type Category = 'genre' | 'mood' | 'instrument' | 'theme'

interface SynonymEntry {
  id: number
  category: Category
}

const SYNONYMS: Record<string, SynonymEntry> = buildSynonymMap()

function buildSynonymMap(): Record<string, SynonymEntry> {
  const map: Record<string, SynonymEntry> = {}

  function add(term: string, slug: string, category: Category) {
    const table = categoryTable(category)
    const id = table[slug]
    if (id !== undefined) {
      map[term] = { id, category }
    }
  }

  add('mysterious', 'mysterious', 'mood')
  add('dark', 'dark', 'mood')
  add('determined', 'uplifting', 'mood')
  add('building', 'uplifting', 'mood')
  add('focused', 'serious', 'mood')
  add('motivational', 'uplifting', 'mood')
  add('reflective', 'peaceful', 'mood')
  add('emotional', 'sad', 'mood')
  add('inspiring', 'hopeful', 'mood')
  add('warm', 'peaceful', 'mood')
  add('contemplative', 'peaceful', 'mood')
  add('adventurous', 'exciting', 'mood')
  add('suspenseful', 'tense', 'mood')
  add('energetic', 'exciting', 'mood')
  add('melancholic', 'sad', 'mood')
  add('triumphant', 'epic', 'mood')
  add('nostalgic', 'sad', 'mood')
  add('lo-fi', 'lofi-chill-beats', 'genre')
  add('lofi', 'lofi-chill-beats', 'genre')
  add('lo fi', 'lofi-chill-beats', 'genre')
  add('piano', 'piano', 'instrument')
  add('acoustic', 'acoustic', 'genre')
  add('cinematic', 'cinematic', 'genre')
  add('ambient', 'ambient', 'genre')
  add('electronic', 'electronic', 'genre')
  add('indie', 'indie', 'genre')
  add('world', 'world', 'genre')
  add('orchestral', 'orchestra', 'instrument')
  add('strings', 'strings', 'instrument')
  add('synth', 'synth', 'instrument')

  return map
}

function categoryTable(category: Category): Record<string, number> {
  switch (category) {
    case 'genre': return GENRES
    case 'mood': return MOODS
    case 'instrument': return INSTRUMENTS
    case 'theme': return VIDEO_THEMES
  }
}

function categoryForField(fieldName: string): Category | null {
  switch (fieldName) {
    case 'mood': return 'mood'
    case 'genre': return 'genre'
    case 'instrument': return 'instrument'
    case 'theme': return 'theme'
    default: return null
  }
}

const SEARCH_BASE = 'https://artlist.io/royalty-free-music/search'
const SFX_BASE = 'https://artlist.io/royalty-free-sound-effects'
const PARAM_IDS = 'includedIds'
const PARAM_BPM_MIN = 'bpmMin'
const PARAM_BPM_MAX = 'bpmMax'
const PARAM_DURATION_MIN = 'durationMin'

const TRIGGER_RE = /Search\s+Art(?:list|ist)\s*:/i
const SFX_RE = /Artlist\s+[“”‘’"'']([^“”‘’"'']+)[“”‘’"'']/i

interface Pools {
  genres: number[]
  moods: number[]
  instruments: number[]
  themes: number[]
}

function resolveTerm(term: string, fieldCategory: Category | null): { id: number; category: Category } | null {
  const normalized = term.trim().toLowerCase()
  if (!normalized) return null

  if (fieldCategory) {
    const table = categoryTable(fieldCategory)
    const directId = table[normalized]
    if (directId !== undefined) {
      return { id: directId, category: fieldCategory }
    }
  }

  const synonym = SYNONYMS[normalized]
  if (synonym) {
    return { id: synonym.id, category: synonym.category }
  }

  return null
}

function addToPool(pools: Pools, id: number, category: Category) {
  const pool = poolForCategory(pools, category)
  if (!pool.includes(id)) {
    pool.push(id)
  }
}

function poolForCategory(pools: Pools, category: Category): number[] {
  switch (category) {
    case 'genre': return pools.genres
    case 'mood': return pools.moods
    case 'instrument': return pools.instruments
    case 'theme': return pools.themes
  }
}

function parseBpm(value: string): { bpmMin: number; bpmMax: number } | null {
  const rangeMatch = value.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (rangeMatch?.[1] && rangeMatch[2]) {
    return { bpmMin: parseInt(rangeMatch[1], 10), bpmMax: parseInt(rangeMatch[2], 10) }
  }

  const singleMatch = value.match(/(\d+)/)
  if (singleMatch?.[1]) {
    const bpm = parseInt(singleMatch[1], 10)
    return { bpmMin: bpm - 10, bpmMax: bpm + 10 }
  }

  return null
}

function parseDuration(value: string): number | null {
  const mmssMatch = value.match(/(\d+):(\d+)\+?\s*min/)
  if (mmssMatch?.[1] && mmssMatch[2]) {
    return parseInt(mmssMatch[1], 10) * 60 + parseInt(mmssMatch[2], 10)
  }

  const minMatch = value.match(/(\d+)\+?\s*min/)
  if (minMatch?.[1]) {
    return parseInt(minMatch[1], 10) * 60
  }

  const secMatch = value.match(/(\d+)\+?\s*sec/)
  if (secMatch?.[1]) {
    return parseInt(secMatch[1], 10)
  }

  return null
}

function prioritizeIds(pools: Pools): number[] {
  const result: number[] = []
  let remaining = 4

  const tiers: Array<{ pool: number[]; max: number }> = [
    { pool: pools.genres, max: 2 },
    { pool: pools.moods, max: 2 },
    { pool: pools.instruments, max: 1 },
    { pool: pools.themes, max: Infinity },
  ]

  for (const tier of tiers) {
    const take = Math.min(tier.pool.length, tier.max, remaining)
    result.push(...tier.pool.slice(0, take))
    remaining -= take
    if (remaining <= 0) break
  }

  if (remaining > 0) {
    const allPools = [pools.moods, pools.genres, pools.instruments, pools.themes]
    for (const pool of allPools) {
      const available = pool.filter(id => !result.includes(id))
      const take = Math.min(available.length, remaining)
      result.push(...available.slice(0, take))
      remaining -= take
      if (remaining <= 0) break
    }
  }

  return result
}

const MOOD_ID_SET = new Set(Object.values(MOODS))

function buildUrl(ids: number[], bpm: { bpmMin: number; bpmMax: number } | null, duration: number | null): string {
  const otherIds = ids.filter(id => !MOOD_ID_SET.has(id))
  const moodIds = ids.filter(id => MOOD_ID_SET.has(id))

  const parts: string[] = []
  if (otherIds.length > 0) {
    parts.push(`${PARAM_IDS}=${otherIds.join(',')}`)
  }
  if (bpm) {
    parts.push(`${PARAM_BPM_MIN}=${bpm.bpmMin}`)
    parts.push(`${PARAM_BPM_MAX}=${bpm.bpmMax}`)
  }
  if (duration !== null) {
    parts.push(`${PARAM_DURATION_MIN}=${duration}`)
  }
  for (const moodId of moodIds) {
    parts.push(`${PARAM_IDS}=${moodId}`)
  }
  return `${SEARCH_BASE}?${parts.join('&')}`
}

export function parseArtlistSearch(text: string): ArtlistSearchResult | null {
  const triggerMatch = TRIGGER_RE.exec(text)
  if (!triggerMatch) return null

  const remainder = text.slice(triggerMatch.index + triggerMatch[0].length)
  const segments = remainder.split('|')

  const pools: Pools = { genres: [], moods: [], instruments: [], themes: [] }
  let bpm: { bpmMin: number; bpmMax: number } | null = null
  let duration: number | null = null

  for (const segment of segments) {
    const colonIdx = segment.indexOf(':')
    if (colonIdx === -1) continue

    const fieldName = segment.slice(0, colonIdx).trim().toLowerCase()
    const fieldValue = segment.slice(colonIdx + 1).trim()
    if (!fieldValue) continue

    if (fieldName === 'bpm') {
      bpm = parseBpm(fieldValue)
      continue
    }

    if (fieldName === 'duration') {
      duration = parseDuration(fieldValue)
      continue
    }

    const category = categoryForField(fieldName)
    if (category === null) continue

    const values = fieldValue.split(',')
    for (const val of values) {
      const resolved = resolveTerm(val, category)
      if (resolved) {
        addToPool(pools, resolved.id, resolved.category)
      }
    }
  }

  const ids = prioritizeIds(pools)
  if (ids.length === 0) return null

  const url = buildUrl(ids, bpm, duration)

  let fallbackUrl: string | null = null
  let fallbackIds: number[] = []

  if (ids.length > 2) {
    fallbackIds = ids.slice(0, -1)
    fallbackUrl = buildUrl(fallbackIds, bpm, duration)
  }

  return { url, fallbackUrl, ids, fallbackIds }
}

export const CATEGORY_TABLES = { GENRES, MOODS, INSTRUMENTS, VIDEO_THEMES } as const

export function buildArtlistMusicUrl(searchTerms: string): string | null {
  const terms = searchTerms.split(/\s+/).filter(Boolean)
  if (terms.length === 0) return null

  const pools: Pools = { genres: [], moods: [], instruments: [], themes: [] }

  for (const term of terms) {
    const normalized = term.toLowerCase()
    const synonym = SYNONYMS[normalized]
    if (synonym) {
      addToPool(pools, synonym.id, synonym.category)
    }
  }

  const ids = prioritizeIds(pools)
  if (ids.length === 0) return null

  return buildUrl(ids, null, null)
}

export interface ArtlistTierUrls {
  narrow: string
  medium: string
  broad: string
}

export function buildArtlistTierUrls(params: {
  searchTerms: string
  bpm: { bpmMin: number; bpmMax: number } | null
  duration: number | null
}): ArtlistTierUrls {
  const terms = params.searchTerms.split(/\s+/).filter(Boolean)
  const pools: Pools = { genres: [], moods: [], instruments: [], themes: [] }

  for (const term of terms) {
    const normalized = term.toLowerCase()
    const synonym = SYNONYMS[normalized]
    if (synonym) {
      addToPool(pools, synonym.id, synonym.category)
    }
  }

  const allIds = prioritizeIds(pools)
  const genreMoodIds = prioritizeIds({ genres: pools.genres, moods: pools.moods, instruments: [], themes: [] })

  const narrow = allIds.length > 0
    ? buildUrl(allIds, params.bpm, params.duration)
    : `${SEARCH_BASE}?${PARAM_IDS}=${pools.genres[0] ?? pools.moods[0] ?? 62}`

  const medium = allIds.length > 0
    ? buildUrl(allIds, null, null)
    : narrow

  const broad = genreMoodIds.length > 0
    ? buildUrl(genreMoodIds, null, null)
    : medium

  return { narrow, medium, broad }
}

export function parseArtlistSfxRef(text: string): { name: string; url: string } | null {
  const match = SFX_RE.exec(text)
  if (!match) return null

  const name = match[1]?.trim()
  if (!name) return null

  const search = encodeURIComponent(name).replace(/%20/g, '+')
  return { name, url: `${SFX_BASE}?search=${search}` }
}

export function buildArtlistSfxUrl(searchTerms: string): string | null {
  const trimmed = searchTerms.trim()
  if (!trimmed) return null
  const encoded = encodeURIComponent(trimmed).replace(/%20/g, '+')
  return `${SFX_BASE}?search=${encoded}`
}
