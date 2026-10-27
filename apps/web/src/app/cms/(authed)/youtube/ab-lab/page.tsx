import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { videoDaUrl } from './video-param'
import { painelDaUrl } from './painel-param'
import { CorpoDoLab } from './_components/pagina/corpo-do-lab'
import { LabEsqueleto } from './_components/pagina/lab-esqueleto'
import { LabErro } from './_components/pagina/lab-erro'
import { BlocoSugestoes } from './_components/bloco-sugestoes'
import { EsqueletoDaLista } from '../competitors/_sugestoes/esqueleto'

export const metadata = { title: 'A/B Lab' }

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // F-D3: settleOnAir (teto de 55 s) corre dentro das ações desta página

export default async function AbLabPage({ searchParams }: { searchParams: Promise<{ video?: string | string[]; painel?: string | string[] }> }) {
  const { siteId } = await getSiteContext()
  // O formato é conferido antes de qualquer leitura; toda a leitura mora no filho assíncrono, dentro do Suspense.
  const params = await searchParams
  const videoInicial = videoDaUrl(params.video)
  const painelInicial = painelDaUrl(params.painel)

  return (
    <LabErro>
      <Suspense fallback={<LabEsqueleto />}>
        <CorpoDoLab
          siteId={siteId}
          videoInicial={videoInicial}
          painelInicial={painelInicial}
          blocoSugestoes={<Suspense fallback={<EsqueletoDaLista linhas={3} modo="bloco" />}><BlocoSugestoes /></Suspense>}
        />
      </Suspense>
    </LabErro>
  )
}
