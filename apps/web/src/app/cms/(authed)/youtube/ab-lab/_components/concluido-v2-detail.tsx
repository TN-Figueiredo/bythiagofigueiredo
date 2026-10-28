'use client'

// Teste v2 concluído pela regra (S8-F4 T12, T7): resumo, desfecho, régua final e placar. M7b T15: sem prazo e sem Aplicar/Voltar aqui;
// "Escolher o que fica" abre o painel do Lab (`?painel=`), que serve a qualquer concluído v2.
import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestDetailView } from '@/lib/youtube/ab-types'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import { DetailHeader } from './detail-header'
import { ResumoV2, PisosV2, DesfechoV2 } from './blocos-v2'
import { PlacarDoTeste } from './placar-do-teste'
import { dataCurtaSp } from './encerrar-props'

type Concluido = Extract<TelaV2, { fase: 'concluido' }>

export interface ConcluidoV2DetailProps {
  view: AbTestDetailView & { v2: Concluido }
}

export function ConcluidoV2Detail({ view }: ConcluidoV2DetailProps) {
  const router = useRouter()
  const tela = view.v2
  const noArRef = useRef<HTMLDivElement>(null)
  const concluidoEm = view.completedAt ? dataCurtaSp(view.completedAt).slice(0, 5) : undefined

  return (
    <div data-testid="concluido-v2-detail">
      <div data-section="header">
        <DetailHeader
          title={view.tituloNoAr ?? view.videoTitle}
          tituloNaUltimaLeitura={view.tituloNaUltimaLeitura}
          youtubeVideoId={view.youtubeVideoId}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          lab={{ thumbUrl: view.variantThumbs.find(t => t.isOriginal)?.thumbUrl ?? view.variantThumbs[0]?.thumbUrl ?? null, concluidoEm }}
        />
      </div>

      <div className="cn-raiz pv2 mb-[8px]" data-testid="tela-v2">
        <ResumoV2 frase={tela.frase} />
        <DesfechoV2 tela={tela} testId={view.id} noArRef={noArRef} onTentarDeNovo={() => router.refresh()} />
        {tela.pisos ? <PisosV2 linhas={tela.pisos} n={tela.n} final /> : null}
      </div>

      <section data-section="variant-performance" className="mb-[24px]">
        <PlacarDoTeste
          placar={view.placar ?? null}
          faixaDias={view.faixa_dias ?? []}
          variants={view.variants}
          variantDb={view.variantDb}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          status={view.status}
          testType={view.flag}
          inicio={view.startedAt ?? null}
          modoV2
        />
      </section>

    </div>
  )
}
