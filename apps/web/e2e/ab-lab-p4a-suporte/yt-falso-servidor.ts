// Servidor HTTP do YouTube/Blob falso da suíte e2e do A/B Lab P4a (porta 3098). Roda com `npx tsx`.
// O servidor de dev (preload yt-preload.cjs) manda para cá toda chamada a googleapis / i.ytimg.com / *.blob.vercel-storage.com.
// A lógica de YouTube é a mesma dos testes de integração (test/helpers/youtube-falso.ts); aqui só entram o canal de controle
// (`POST /__ctl`, `GET /__ctl/estado`) e o atraso REAL por chamada (o atraso do falso é de relógio, não de parede).
import http from 'node:http'
import { YouTubeFalso, imagemComDhash, H } from '../../test/helpers/youtube-falso'
import type { ChamadaFalsa } from '../../test/helpers/youtube-falso'

const PORTA = Number(process.env.YT_MOCK_PORT ?? 3098)

interface Estado {
  falso: YouTubeFalso
  dhashDaThumb: string
  atrasosMs: Partial<Record<ChamadaFalsa, number>>
  gravacoes: Array<{ chamada: ChamadaFalsa; em: string }>
  chamadasLeitura: string[]
}

let estado: Estado | null = null

function classificar(url: string, metodo: string): ChamadaFalsa {
  if (url.startsWith('https://i.ytimg.com/vi/')) return 'hqdefault'
  if (url.includes('/upload/youtube/v3/thumbnails/set')) return 'thumbnails.set'
  if (url.includes('googleapis.com/youtube/v3/videos')) return metodo === 'PUT' ? 'videos.update' : 'videos.list'
  return 'blob'
}

interface Reset {
  titulo?: string
  descricao?: string
  /** dHash (16 dígitos) da thumbnail que está no YouTube agora. */
  thumbDhash?: string
  blobs?: Record<string, string> // url → dHash
  videoApagado?: boolean
}

async function resetar(r: Reset): Promise<void> {
  const dhash = r.thumbDhash ?? H.A
  const blobs: Record<string, Buffer> = {}
  for (const [url, h] of Object.entries(r.blobs ?? {})) blobs[url] = await imagemComDhash(h)
  estado = {
    falso: new YouTubeFalso({
      titulo: r.titulo ?? 'Título original do vídeo',
      descricao: r.descricao ?? 'Descrição',
      thumb: await imagemComDhash(dhash),
      blobs,
      videoApagado: r.videoApagado ?? false,
    }),
    dhashDaThumb: dhash,
    atrasosMs: {},
    gravacoes: [],
    chamadasLeitura: [],
  }
}

function corpo(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = []
    req.on('data', (c: Buffer) => partes.push(c))
    req.on('end', () => ok(Buffer.concat(partes)))
    req.on('error', falha)
  })
}

const json = (res: http.ServerResponse, status: number, obj: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(obj))
}

async function controle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')
  if (req.method === 'GET' && url.pathname === '/__ctl/estado') {
    if (!estado) return json(res, 200, { pronto: false })
    return json(res, 200, {
      pronto: true,
      chamadas: estado.falso.chamadas,
      escritas: estado.falso.escritas(),
      titulo: estado.falso.titulo,
      gravacoes: estado.gravacoes,
    })
  }
  if (req.method !== 'POST') return json(res, 405, { erro: 'método' })
  const b = JSON.parse((await corpo(req)).toString('utf8') || '{}') as Record<string, unknown>
  switch (b.op) {
    case 'reset':
      await resetar(b as Reset)
      return json(res, 200, { ok: true })
    case 'recusar':
      estado?.falso.recusar(b.chamada as ChamadaFalsa, Number(b.status), String(b.reason ?? 'forbidden'))
      return json(res, 200, { ok: true })
    case 'atrasar':
      if (estado) estado.atrasosMs[b.chamada as ChamadaFalsa] = Number(b.ms)
      return json(res, 200, { ok: true })
    case 'titulo-por-fora':
      if (estado) estado.falso.titulo = String(b.titulo)
      return json(res, 200, { ok: true })
    case 'thumb-por-fora':
      if (estado) estado.falso.thumb = await imagemComDhash(String(b.dhash))
      return json(res, 200, { ok: true })
    default:
      return json(res, 400, { erro: 'op desconhecida' })
  }
}

const servidor = http.createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url ?? '/', 'http://x')
      if (url.pathname.startsWith('/__ctl')) return await controle(req, res)
      if (url.pathname !== '/__yt') return json(res, 404, { erro: 'rota' })
      if (!estado) await resetar({})
      const e = estado!
      const alvo = url.searchParams.get('u') ?? ''
      const metodo = req.method ?? 'GET'
      const chamada = classificar(alvo, metodo)
      const bruto = await corpo(req)
      if (alvo.includes('googleapis.com/youtube/v3/videos') && alvo.includes('part=statistics')) {
        // O poll de estatísticas do detalhe (somente leitura) não faz parte da P4a: devolve números fixos.
        e.chamadasLeitura.push('videos.statistics')
        return json(res, 200, { items: [{ statistics: { viewCount: '1000', likeCount: '50' } }] })
      }
      if (alvo.includes('youtubeanalytics.googleapis.com')) {
        // Analytics (somente leitura, fora da P4a): resposta vazia e válida, em vez do 404 do falso.
        e.chamadasLeitura.push('analytics')
        return json(res, 200, { kind: 'youtubeAnalytics#resultTable', columnHeaders: [], rows: [] })
      }
      const atraso = e.atrasosMs[chamada]
      if (atraso) await new Promise((r) => setTimeout(r, atraso))
      const r = await e.falso.fetch(alvo, { method: metodo, body: bruto.length ? bruto : undefined })
      if (chamada === 'videos.update' || chamada === 'thumbnails.set') e.gravacoes.push({ chamada, em: new Date().toISOString() })
      const dados = Buffer.from(await r.arrayBuffer())
      const cab: Record<string, string> = {}
      r.headers.forEach((v, k) => { cab[k] = v })
      res.writeHead(r.status, cab)
      res.end(dados)
    } catch (err) {
      json(res, 500, { erro: String(err) })
    }
  })()
})

servidor.listen(PORTA, '127.0.0.1', () => { console.log(`yt-falso em http://127.0.0.1:${PORTA}`) })
