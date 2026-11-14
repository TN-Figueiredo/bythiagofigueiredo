import './conectar-ia.css'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { Clock, Hand, Lock, Power } from 'lucide-react'
import type { ReactNode } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { hostDoRecurso, oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { iaInicial, lerEstadoDaPessoa } from '@/lib/youtube/observatorio/acesso-ia/estado-da-pessoa'
import { FRASES_CONECTAR as F } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'
import { ConectarIa } from './conectar-ia'

export const metadata = { title: 'Conectar sua IA' }
export const dynamic = 'force-dynamic'

function Bloco({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto?: string }) {
  return (
    <div className="cia"><div className="pg">
      <h1 tabIndex={-1} style={{ marginBottom: 16 }}>{F.titulo}</h1>
      <div className="neutral" role="note">{icone}<div><strong>{titulo}</strong>{texto ? <span>{texto}</span> : null}</div></div>
    </div></div>
  )
}
const ico = { 'aria-hidden': true, size: 20, strokeWidth: 1.8 } as const

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const h = await headers()
  if (!hostDoRecurso(h.get('host') ?? '')) notFound()

  const sp = (await searchParams) ?? {}
  const iaParam = Array.isArray(sp.ia) ? sp.ia[0] : sp.ia
  const iaDaUrl = iaParam === 'chatgpt' || iaParam === 'claude' ? iaParam : undefined

  const store = await cookies()
  const sb = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try { for (const { name, value, options } of lista) store.set(name, value, options) } catch { /* render: sem escrita de cookie */ }
      },
    },
  })
  const { data, error } = await sb.auth.getUser()
  const user = data?.user
  if (error || !user) redirect('/cms/login?next=' + encodeURIComponent('/cms/conectar-ia' + (iaDaUrl ? '?ia=' + iaDaUrl : '')))

  if (!oauthLigado() || !acessoExternoLigado().ligado) {
    return <Bloco icone={<Power {...ico} />} titulo={F.desligadoTitulo} />
  }

  // Exceção declarada à regra "service client só após canAdminSite": a RLS de obs_ai_liberacoes só deixa can_admin_site_users ler, então o
  // cliente da sessão da irmã veria zero linhas ("sem acesso" falso). Só leitura, 5 colunas, filtrada pelo id do getUser() (nunca da URL).
  const { siteId } = await getSiteContext()
  const estado = await lerEstadoDaPessoa(getSupabaseServiceClient(), { userId: user.id, siteId, agoraMs: Date.now() })

  switch (estado.tipo) {
    case 'erro':
      throw new Error('conectar-ia: leitura')
    case 'nunca':
      return <Bloco icone={<Lock {...ico} />} titulo={F.nuncaTitulo} texto={F.nuncaTexto} />
    case 'vencida':
      return <Bloco icone={<Clock {...ico} />} titulo={F.vencidaTitulo(estado.em)} texto={F.vencidaTexto} />
    case 'cortada':
      return <Bloco icone={<Hand {...ico} />} titulo={F.pausadoTitulo} texto={F.pausadoTexto} />
    case 'ativa':
      return (
        <div className="cia"><div className="pg">
          <h1 tabIndex={-1}>{F.titulo}</h1>
          <p className="sub">{F.resumo}{estado.ate ? F.ate(estado.ate) : ''}</p>
          <ConectarIa ia={iaInicial(iaDaUrl, estado.bloqueadas)} bloqueadas={estado.bloqueadas} />
        </div></div>
      )
  }
}
