import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { videoDaUrl } from './video-param'
import { CorpoDoLab } from './_components/pagina/corpo-do-lab'
import { LabEsqueleto } from './_components/pagina/lab-esqueleto'
import { LabErro } from './_components/pagina/lab-erro'
import { BlocoSugestoes } from './_components/bloco-sugestoes'
import { EsqueletoDaLista } from '../competitors/_sugestoes/esqueleto'

export const metadata = { title: 'A/B Lab' }

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // F-D3: settleOnAir (teto de 55 s) corre dentro das ações desta página

export default async function AbLabPage({ searchParams }: { searchParams: Promise<{ video?: string | string[] }> }) {
  const { siteId } = await getSiteContext()
  // O formato é conferido antes de qualquer leitura; toda a leitura mora no filho assíncrono, dentro do Suspense.
  const videoInicial = videoDaUrl((await searchParams).video)

  return (
    <LabErro>
      <Suspense fallback={<LabEsqueleto />}>
        <CorpoDoLab
          siteId={siteId}
          videoInicial={videoInicial}
          blocoSugestoes={<Suspense fallback={<EsqueletoDaLista linhas={3} modo="bloco" />}><BlocoSugestoes /></Suspense>}
        />
      </Suspense>
    </LabErro>
  )
}
