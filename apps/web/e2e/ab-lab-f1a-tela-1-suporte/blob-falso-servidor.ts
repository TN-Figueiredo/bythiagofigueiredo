// Blob falso da suíte do Gio (F1a-tela-1): responde ao `put()` do @vercel/blob (PUT /?pathname=...) sem sair da máquina.
// O servidor de dev aponta VERCEL_BLOB_API_URL para cá; sem isso o `put` iria ao vercel.com de verdade com um token falso.
import http from 'node:http'

const PORTA = Number(process.env.BLOB_MOCK_PORT ?? 3096)
const enviados: string[] = []

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (req.method === 'GET' && url.pathname === '/__estado') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ enviados })); return }
  const partes: Buffer[] = []
  req.on('data', (c: Buffer) => partes.push(c))
  req.on('end', () => {
    if (req.method !== 'PUT') { res.writeHead(404); res.end('{}'); return }
    const pathname = url.searchParams.get('pathname') ?? 'sem-nome'
    enviados.push(pathname)
    const u = `https://giostore.public.blob.vercel-storage.com/${pathname}`
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ url: u, downloadUrl: `${u}?download=1`, pathname, contentType: String(req.headers['content-type'] ?? 'image/png'), contentDisposition: 'inline', etag: '"gio"' }))
  })
}).listen(PORTA, '127.0.0.1', () => { console.log(`blob-falso em http://127.0.0.1:${PORTA}`) })
