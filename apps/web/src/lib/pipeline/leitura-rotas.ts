// E19 (onda 1, M3): padrão das rotas de /api/pipeline (as estáticas entram para que um irmão estático, como /items/bulk, não vire /items/[id]), para o registro de leitura agrupar por rota e não por id/slug.
// Um teste (leitura-rotas.test.ts) confere esta lista contra as pastas de src/app/api/pipeline: rota nova sem entrada reprova.
const PADROES = [
  '/api/pipeline',
  '/api/pipeline/audio-library',
  '/api/pipeline/audio-library/[id]',
  '/api/pipeline/audio-library/export',
  '/api/pipeline/audio-library/import',
  '/api/pipeline/audio-library/resolve',
  '/api/pipeline/audio-library/stats',
  '/api/pipeline/broll-library',
  '/api/pipeline/broll-library/[id]',
  '/api/pipeline/broll-library/import',
  '/api/pipeline/context',
  '/api/pipeline/context/[key]',
  '/api/pipeline/docs/[domain]',
  '/api/pipeline/items',
  '/api/pipeline/items/[id]',
  '/api/pipeline/items/[id]/advance',
  '/api/pipeline/items/[id]/checklist',
  '/api/pipeline/items/[id]/graduate',
  '/api/pipeline/items/[id]/history',
  '/api/pipeline/items/[id]/link',
  '/api/pipeline/items/[id]/publish',
  '/api/pipeline/items/[id]/recording',
  '/api/pipeline/items/[id]/recording/batch',
  '/api/pipeline/items/[id]/recording/orphans',
  '/api/pipeline/items/[id]/restore',
  '/api/pipeline/items/[id]/retreat',
  '/api/pipeline/items/[id]/sections/[section]',
  '/api/pipeline/items/[id]/unlink',
  '/api/pipeline/items/batch-sections',
  '/api/pipeline/items/bulk',
  '/api/pipeline/links',
  '/api/pipeline/links/[id]',
  '/api/pipeline/playlists',
  '/api/pipeline/playlists/[id]',
  '/api/pipeline/playlists/[id]/auto-layout',
  '/api/pipeline/playlists/[id]/edges',
  '/api/pipeline/playlists/[id]/edges/[edgeId]',
  '/api/pipeline/playlists/[id]/edges/bulk',
  '/api/pipeline/playlists/[id]/items',
  '/api/pipeline/playlists/[id]/items/[itemId]',
  '/api/pipeline/playlists/[id]/items/bulk',
  '/api/pipeline/playlists/[id]/reorder',
  '/api/pipeline/research',
  '/api/pipeline/research/[id]',
  '/api/pipeline/research/[id]/links',
  '/api/pipeline/research/[id]/links/[linkId]',
  '/api/pipeline/research/decisoes',
  '/api/pipeline/research/decisoes/[id]',
  '/api/pipeline/research/decisoes/[id]/link',
  '/api/pipeline/research/focos',
  '/api/pipeline/research/focos/[id]',
  '/api/pipeline/research/focos/[id]/activate',
  '/api/pipeline/research/focos/active',
  '/api/pipeline/research/import',
  '/api/pipeline/research/topics',
  '/api/pipeline/research/topics/[id]',
  '/api/pipeline/search',
  '/api/pipeline/stats',
  '/api/pipeline/topics/[code]',
  '/api/pipeline/up-next',
  '/api/pipeline/workflows',
  '/api/pipeline/youtube/ab-performance',
  '/api/pipeline/youtube/ab-tests',
  '/api/pipeline/youtube/ab-tests/[id]',
  '/api/pipeline/youtube/ab-tests/[id]/funnel',
  '/api/pipeline/youtube/ab-tests/[id]/history',
  '/api/pipeline/youtube/ab-tests/[id]/variants',
  '/api/pipeline/youtube/ab-tests/dashboard',
  '/api/pipeline/youtube/ab-tests/learnings',
  '/api/pipeline/youtube/ab-tests/suggestions',
  '/api/pipeline/youtube/analytics/demographics',
  '/api/pipeline/youtube/analytics/grades',
  '/api/pipeline/youtube/analytics/notes',
  '/api/pipeline/youtube/analytics/overview',
  '/api/pipeline/youtube/analytics/search-terms',
  '/api/pipeline/youtube/categories',
  '/api/pipeline/youtube/channels',
  '/api/pipeline/youtube/competitors/changes',
  '/api/pipeline/youtube/competitors/channels',
  '/api/pipeline/youtube/competitors/insights',
  '/api/pipeline/youtube/competitors/outliers',
  '/api/pipeline/youtube/competitors/readings',
  '/api/pipeline/youtube/intelligence',
  '/api/pipeline/youtube/intelligence/task',
  '/api/pipeline/youtube/intelligence/task/[id]/fail',
  '/api/pipeline/youtube/intelligence/task/claim',
  '/api/pipeline/youtube/thumbnails/library',
  '/api/pipeline/youtube/videos',
  '/api/pipeline/youtube/videos/[id]',
].map(p => p.split('/'))

/** Padrão da rota (`/api/pipeline/items/[id]/sections/[section]`) ou null se nenhuma rota dinâmica conhecida bate. Vence a que tem mais trechos fixos. */
export function padraoDaRota(pathname: string): string | null {
  const partes = pathname.split('/')
  let melhor: string[] | null = null
  let fixos = -1
  for (const p of PADROES) {
    if (p.length !== partes.length) continue
    let n = 0
    const bate = p.every((seg, i) => {
      if (seg.startsWith('[')) return partes[i] !== ''
      if (seg !== partes[i]) return false
      n++
      return true
    })
    if (bate && n > fixos) { melhor = p; fixos = n }
  }
  return melhor ? melhor.join('/') : null
}
