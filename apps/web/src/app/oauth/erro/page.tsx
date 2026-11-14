import type { Metadata } from 'next'
import { CSS_ERRO, codigoDeErro, corpoDeErro } from '@/lib/youtube/observatorio/acesso-ia/oauth/textos-erro'

export const metadata: Metadata = { title: 'Conexão não concluída', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ErroOAuth({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const { codigo } = await searchParams
  const c = codigoDeErro(Array.isArray(codigo) ? codigo[0] : codigo)
  // Conteúdo 100% constante (TEXTOS_ERRO); nada da URL entra no HTML. O <style> vai cru para o React não escapar o CSS.
  return (
    <div className="oe-pg">
      <style dangerouslySetInnerHTML={{ __html: CSS_ERRO }} />
      <div dangerouslySetInnerHTML={{ __html: corpoDeErro(c) }} />
    </div>
  )
}
