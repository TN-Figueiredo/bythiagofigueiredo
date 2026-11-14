// K17 (C1 T21): renova a sessão do Supabase no middleware para a tela de consentimento. O `createAuthMiddleware` do pacote devolve
// `NextResponse.next()` em rota pública, sem tocar no Auth; o Server Component, por sua vez, não consegue gravar cookie, então um
// refresh vencido o faria ver "sem login". Aqui o `getUser()` renova e o cookie novo vai (a) na REQUISIÇÃO repassada, para o Server
// Component, e (b) na RESPOSTA, para o navegador. Edge-safe; nunca lança (Auth fora do ar = segue sem renovar).
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

export interface CookieRenovado {
  name: string
  value: string
  options?: Parameters<import('next/server').NextResponse['cookies']['set']>[2]
}

export async function renovarSessao(request: NextRequest, requestHeaders: Headers): Promise<CookieRenovado[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return []
  const novos: CookieRenovado[] = []
  try {
    const sb = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (lista: Array<{ name: string; value: string; options?: CookieRenovado['options'] }>) => {
          for (const c of lista) {
            if (c.value === '') request.cookies.delete(c.name)
            else request.cookies.set(c.name, c.value)
            novos.push({ name: c.name, value: c.value, options: c.options })
          }
        },
      },
    })
    await sb.auth.getUser()
  } catch {
    /* Auth fora do ar: a tela decide com o que tem */
  }
  if (novos.length > 0) requestHeaders.set('cookie', request.cookies.toString())
  return novos
}
