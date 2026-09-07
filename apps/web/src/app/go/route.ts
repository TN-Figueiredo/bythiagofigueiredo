import { NextResponse } from 'next/server'
import { tryGetSiteContext } from '@/lib/cms/site-context'

/**
 * Destino de último recurso: usado quando o middleware não resolveu site
 * (host desconhecido, erro de resolução) ou quando o host resolvido não é um
 * domínio público (dev/local). Constante — nunca derivado de header.
 */
const CANONICAL_HOST = 'bythiagofigueiredo.com'

/** `localhost`, `dev.localhost`, `127.0.0.1` e afins não são destino público. */
function isPublicDomain(domain: string | undefined): domain is string {
  if (!domain) return false
  if (domain === '127.0.0.1') return false
  if (domain === 'localhost' || domain.endsWith('.localhost')) return false
  return domain.includes('.')
}

/**
 * `/go` no domínio principal devolve o visitante à home do site.
 *
 * A4 — o destino vem do site que o middleware resolveu (`getSiteContext`),
 * nunca de `x-short-domain`: esse header só é escrito na *resposta* do ramo
 * `go.*` (`src/middleware.ts`), então qualquer valor legível aqui veio do
 * cliente. A versão anterior o usava para montar o `NextResponse.redirect` e
 * `x-short-domain: go.evil.com` redirecionava para `https://evil.com`.
 */
export async function GET(): Promise<Response> {
  const site = await tryGetSiteContext()
  const domain =
    site && isPublicDomain(site.primaryDomain) ? site.primaryDomain : CANONICAL_HOST
  return NextResponse.redirect(`https://${domain}`, 302)
}
