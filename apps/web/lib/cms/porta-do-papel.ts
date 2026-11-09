import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import * as Sentry from '@sentry/nextjs'

/**
 * A porta de papel do CMS (A2, MG19). Quem só lê (o `reporter`) alcança, dentro de `/cms`, apenas o Observatório e as telas de entrada/saída.
 * O resto de `/cms/*` pergunta `can_edit_site(site do host)`: `true` segue; `false`, erro ou site ausente redirecionam para o Painel do
 * Observatório (fechada por construção, também para quem não tem vínculo no site do host). Pega as páginas sem guarda própria e a navegação
 * no cliente (o layout não roda de novo entre páginas irmãs; o middleware roda em toda requisição RSC). `/api/*` não passa por aqui.
 */
export const DESTINO_DO_REPORTER = '/cms/youtube/competitors'

const ABERTOS = [/^\/cms\/youtube\/competitors(\/.*)?$/, /^\/cms\/(login|logout|forgot|disabled)$/, /^\/cms\/reset/]

export function caminhoAbertoAoReporter(pathname: string): boolean {
  return ABERTOS.some((r) => r.test(pathname))
}

/**
 * `effectivePathname`: o caminho depois do prefixo de idioma (`/pt/cms/...` vale como `/cms/...`).
 * `authRes`: a resposta do `cmsAuth`; os cookies renovados por ele (token vencido e renovado) têm de valer para a RPC, senão o dono
 * seria mandado ao Observatório na 1ª requisição de cada hora.
 * Devolve `null` para seguir, ou o redirect 307.
 */
export async function portaDoPapel(
  effectivePathname: string,
  request: NextRequest,
  authRes: NextResponse,
  siteId: string | null,
): Promise<NextResponse | null> {
  if (!effectivePathname.startsWith('/cms')) return null
  if (caminhoAbertoAoReporter(effectivePathname)) return null
  const fechar = (): NextResponse => {
    const res = NextResponse.redirect(new URL(DESTINO_DO_REPORTER, request.url), 307)
    authRes.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c as Parameters<typeof res.cookies.set>[2]))
    return res
  }
  if (!siteId) return fechar()
  try {
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          const porNome = new Map<string, { name: string; value: string }>()
          for (const c of request.cookies.getAll()) porNome.set(c.name, { name: c.name, value: c.value })
          for (const c of authRes.cookies.getAll()) porNome.set(c.name, { name: c.name, value: c.value })
          return [...porNome.values()]
        },
        setAll() { /* o cmsAuth já gravou os cookies na resposta */ },
      },
    })
    const { data, error } = await sb.rpc('can_edit_site', { p_site_id: siteId })
    if (error) {
      Sentry.captureException(new Error('porta-do-papel: a RPC can_edit_site falhou'), { tags: { guarda: 'porta-do-papel' }, extra: { code: error.code } })
      return fechar()
    }
    return data === true ? null : fechar()
  } catch (e) {
    Sentry.captureException(e, { tags: { guarda: 'porta-do-papel' } })
    return fechar()
  }
}
