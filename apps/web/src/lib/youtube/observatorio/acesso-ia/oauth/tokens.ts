import { createHash, randomBytes } from 'crypto'

export const MAX_CORPO = 8 * 1024

/** 32 bytes base64url; só o `hash` (sha256 hex) vai ao banco. */
export function novoToken(prefixo: 'oat_' | 'ort_' | 'oac_'): { texto: string; hash: string } {
  const texto = prefixo + randomBytes(32).toString('base64url')
  return { texto, hash: createHash('sha256').update(texto).digest('hex') }
}

/** PKCE S256: base64url(sha256(verifier)). */
export function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** Lê o corpo até MAX_CORPO bytes contados no stream; `null` = passou do limite. */
export async function lerCorpoLimitado(req: Request): Promise<string | null> {
  const cl = Number(req.headers.get('content-length'))
  if (Number.isFinite(cl) && cl > MAX_CORPO) return null
  if (!req.body) return ''
  const leitor = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_CORPO) {
      await leitor.cancel().catch(() => undefined)
      return null
    }
    partes.push(value)
  }
  return Buffer.concat(partes).toString('utf8')
}

/** Só `application/x-www-form-urlencoded`; ≤ 8 KB; parâmetro repetido = 400. */
export async function lerForm(req: Request): Promise<{ ok: true; f: URLSearchParams } | { ok: false; status: 400 | 413 }> {
  const tipo = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (tipo !== 'application/x-www-form-urlencoded') return { ok: false, status: 400 }
  let texto: string | null
  try {
    texto = await lerCorpoLimitado(req)
  } catch {
    return { ok: false, status: 400 }
  }
  if (texto === null) return { ok: false, status: 413 }
  const f = new URLSearchParams(texto)
  const vistos = new Set<string>()
  for (const k of f.keys()) {
    if (vistos.has(k)) return { ok: false, status: 400 }
    vistos.add(k)
  }
  return { ok: true, f }
}
