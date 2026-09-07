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
 * A4 — a versão anterior montava o destino a partir de `x-short-domain` (lido
 * direto do request) e `x-short-domain: go.evil.com` redirecionava para
 * `https://evil.com`. Essa leitura foi removida: o destino agora vem de
 * `site.primaryDomain` (`getSiteContext`, `lib/cms/site-context.ts`), que por
 * sua vez é `x-primary-domain ?? host`.
 *
 * `x-primary-domain` É UM HEADER — sozinho, tão forjável quanto
 * `x-short-domain` era. Esta rota não é segura porque leia "a fonte certa";
 * ela é segura porque `src/middleware.ts` apaga `x-primary-domain` (entre os
 * 8 nomes de `STRIPPED_REQUEST_HEADERS`) de TODO request antes de qualquer
 * handler rodar. O controle real de A4 está no middleware, não aqui: sem o
 * strip na borda, `x-primary-domain: evil.com` chegaria a este `headers()`
 * do mesmo jeito que `x-short-domain` chegava antes dele ser removido desta
 * rota. `test/middleware/forged-site-headers.test.ts` cobre isso passando
 * pelo middleware de verdade, não só mockando `next/headers`.
 */
export async function GET(): Promise<Response> {
  const site = await tryGetSiteContext()
  const domain =
    site && isPublicDomain(site.primaryDomain) ? site.primaryDomain : CANONICAL_HOST
  return NextResponse.redirect(`https://${domain}`, 302)
}
