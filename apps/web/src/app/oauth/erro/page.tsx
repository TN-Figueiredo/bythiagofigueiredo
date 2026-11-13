import type { Metadata } from 'next'
import { TEXTOS_ERRO, codigoDeErro } from '@/lib/youtube/observatorio/acesso-ia/oauth/textos-erro'

export const metadata: Metadata = { title: 'Conexão não concluída', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ErroOAuth({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const { codigo } = await searchParams
  const c = codigoDeErro(Array.isArray(codigo) ? codigo[0] : codigo)
  return (
    <main style={{ maxWidth: '32rem', margin: '4rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Conexão não concluída</h1>
      <p>{TEXTOS_ERRO[c]}</p>
    </main>
  )
}
