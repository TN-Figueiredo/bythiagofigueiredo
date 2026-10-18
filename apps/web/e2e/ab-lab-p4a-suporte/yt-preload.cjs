// Preload (NODE_OPTIONS=--require) do servidor de dev usado pela suíte e2e do A/B Lab P4a.
// Desvia TODA chamada do servidor a YouTube / Google / Blob para o servidor falso local (yt-falso-servidor.ts):
// nenhuma escrita sai da máquina. Não toca em Supabase, GoTrue nem nada que não seja desses hosts.
const real = globalThis.fetch
const MOCK = process.env.YT_MOCK_URL
const DESVIAR = [
  /^https:\/\/www\.googleapis\.com\//,
  /^https:\/\/youtubeanalytics\.googleapis\.com\//,
  /^https:\/\/oauth2\.googleapis\.com\//,
  /^https:\/\/i\.ytimg\.com\//,
  /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//,
]

if (MOCK && typeof real === 'function' && !globalThis.__ytMockPatched) {
  globalThis.__ytMockPatched = true
  globalThis.fetch = function fetchComDesvio(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url
    if (url && DESVIAR.some((r) => r.test(url))) {
      const method = (init && init.method) || (input && input.method) || 'GET'
      return real(`${MOCK}/__yt?u=${encodeURIComponent(url)}`, { ...(init || {}), method })
    }
    return real(input, init)
  }
}
