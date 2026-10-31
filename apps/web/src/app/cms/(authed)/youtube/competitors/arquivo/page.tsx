import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { montarArquivo } from '../_arquivo/montar'
import { ArquivoScreen } from '../_arquivo/arquivo-screen'
import { apagarDoArquivoAction } from '../_arquivo/actions-canal'
import { SoLe } from '../_arquivo/so-le'
import '../_arquivo/arquivo.css'

export const metadata = { title: 'Arquivo · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function ArquivoPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const r = await montarArquivo()
  if (r.acesso === 'so_le') return <SoLe />
  return (
    <ObservatoryChromeServer tab="arquivo" searchParams={sp} obs={r.obs} forja={r.forja} meuCanalLembrado={r.meuCanalLembrado}>
      <ArquivoScreen modelo={r.modelo} bloco={r.bloco} acesso={r.acesso} onApagar={apagarDoArquivoAction} />
    </ObservatoryChromeServer>
  )
}
