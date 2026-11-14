import 'server-only'
import { createHmac } from 'crypto'
import { isIP } from 'net'

/** Expande IPv6 à mão (`::` em 8 grupos, sem regex com retrocesso). Devolve 8 números de 16 bits ou null. */
function expandirIpv6(s: string): number[] | null {
  const pctoIdx = s.indexOf('%')
  const limpo = pctoIdx >= 0 ? s.slice(0, pctoIdx) : s
  const partes = limpo.split('::')
  if (partes.length > 2) return null
  const grupos = (t: string): string[] => (t === '' ? [] : t.split(':'))
  let esq = grupos(partes[0] ?? '')
  let dir = partes.length === 2 ? grupos(partes[1] ?? '') : []
  // IPv4 embutido no fim (::ffff:1.2.3.4) vira 2 grupos
  const ultimo = partes.length === 2 ? dir : esq
  if (ultimo.length > 0 && (ultimo[ultimo.length - 1] ?? '').includes('.')) {
    const q = ultimo.pop() ?? ''
    const o = q.split('.').map(Number)
    if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    const [a = 0, b = 0, c = 0, d = 0] = o
    ultimo.push(((a << 8) | b).toString(16), ((c << 8) | d).toString(16))
  }
  if (partes.length === 2) {
    const falta = 8 - esq.length - dir.length
    if (falta < 1) return null
    esq = esq.concat(new Array<string>(falta).fill('0'), dir)
    dir = []
  }
  if (esq.length !== 8) return null
  const out: number[] = []
  for (const g of esq) {
    if (g.length < 1 || g.length > 4) return null
    const n = parseInt(g, 16)
    if (!Number.isFinite(n) || n.toString(16).padStart(g.length, '0') !== g.toLowerCase()) return null
    out.push(n)
  }
  return out
}

function normalizar(bruto: string | null): string {
  if (!bruto) return 'sem-ip'
  const ip = (bruto.split(',')[0] ?? '').trim()
  const tipo = isIP(ip)
  if (tipo === 4) return ip
  if (tipo === 6) {
    const g = expandirIpv6(ip)
    if (!g) return 'sem-ip'
    // IPv4 mapeado (::ffff:a.b.c.d) vira o IPv4, senão todos caem no mesmo /64
    if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) {
      const [x = 0, y = 0] = g.slice(6)
      return `${x >> 8}.${x & 255}.${y >> 8}.${y & 255}`
    }
    return g.slice(0, 4).map((n) => n.toString(16)).join(':') + '::/64'
  }
  return 'sem-ip'
}

/** HMAC-SHA256(segredo, ip || '|' || AAAA-MM-DD UTC), hex. IPv6 truncado em /64; ausente/ilegível = 'sem-ip'. */
export function hashDoIp(req: Request, segredo: Buffer, agora: number): string {
  const ip = normalizar(req.headers.get('x-forwarded-for'))
  const dia = new Date(agora).toISOString().slice(0, 10)
  return createHmac('sha256', segredo).update(`${ip}|${dia}`).digest('hex')
}
