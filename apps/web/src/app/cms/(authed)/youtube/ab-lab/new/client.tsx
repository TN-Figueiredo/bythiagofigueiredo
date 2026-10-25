'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AbCreateWizard, type IniciarTeste, type LerAvisoDeVolume } from '../_components/ab-create-wizard'
import type { WizardVideo } from '../_components/ab-create-wizard'
import type { EligibleVideo } from '../_components/video-picker-dialog'
import { LinhaDeVideo } from '../_components/linha-de-video'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { Search, FlaskConical, Info } from 'lucide-react'
import type { ReferenciaPedida } from './params'
import type { TipoTroca } from '@/lib/youtube/ab-referencia'

interface DraftPrefill {
  id: string
  videoId: string
  videoTitle: string
  thumbnailUrl: string | null
  testType: string
  sourcePipelineId: string | null
}

export interface CompetitorContext extends ReferenciaPedida {
  canal: string | null
  hrefOrigem: string | null
  /** thumbOriginalYtimg(ytId) quando a thumb da URL não vale; só o servidor monta */
  // Sem desenho ainda: o estado P1 (imagem substituta) espera mockup (it.todo em ab-new-client.test.tsx). Calculado no servidor, não renderizado.
  thumbSubstituta: string | null
}

interface NewTestClientProps {
  siteId: string
  iniciarTeste: IniciarTeste
  avisoDeVolume?: LerAvisoDeVolume
  settings: AbTestSiteSettings
  eligibleVideos: EligibleVideo[]
  draftPrefill?: DraftPrefill
  competitorContext?: CompetitorContext
  /** Tipo pedido na URL (com ou sem referência); pré-marca o assistente sem levar thumb nem título. */
  tipoInicial?: TipoTroca | null
  initialVideoId?: string
  aviso?: string
}

export function NewTestClient({ siteId, iniciarTeste, avisoDeVolume, settings, eligibleVideos, draftPrefill, competitorContext, tipoInicial, initialVideoId, aviso }: NewTestClientProps) {
  const router = useRouter()
  const [selectedVideo, setSelectedVideo] = useState<WizardVideo | null>(() =>
    draftPrefill
      ? {
          id: draftPrefill.videoId,
          title: draftPrefill.videoTitle,
          thumbnailUrl: draftPrefill.thumbnailUrl,
          sourcePipelineId: draftPrefill.sourcePipelineId,
        }
      : (() => {
          const v = initialVideoId ? eligibleVideos.find((e) => e.id === initialVideoId) : undefined
          return v
            ? { id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, sourcePipelineId: v.sourcePipelineId, durationSeconds: v.durationSeconds, publishedAt: v.publishedAt, channelHandle: v.channelHandle }
            : null
        })(),
  )
  const [search, setSearch] = useState('')
  // A faixa recolhida vive aqui: recolher não apaga a referência (Foco 4).
  const [recolhida, setRecolhida] = useState(false)
  const alternarRef = () => setRecolhida((r) => !r)
  // Região viva montada vazia e preenchida depois, para o leitor de tela anunciar.
  const [avisoAnunciado, setAvisoAnunciado] = useState<string | null>(null)
  useEffect(() => {
    setAvisoAnunciado(aviso ?? null)
  }, [aviso])

  if (selectedVideo) {
    return (
      <AbCreateWizard
        video={selectedVideo}
        siteId={siteId}
        settings={settings}
        onClose={() => router.push('/cms/youtube/ab-lab')}
        onCreated={(testId) => router.push(`/cms/youtube/ab-lab/${testId}`)}
        iniciarTeste={iniciarTeste}
        avisoDeVolume={avisoDeVolume}
        existingDraftId={draftPrefill?.id}
        prefill={
          draftPrefill
            ? { testType: draftPrefill.testType as import('@/lib/youtube/ab-types').TestType }
            : tipoInicial
              ? { testType: tipoInicial }
              : undefined
        }
        referenciaDados={competitorContext ? { refVideoId: competitorContext.refVideoId, refTroca: competitorContext.refTroca, tipo: competitorContext.tipo } : undefined}
        referencia={competitorContext ? <ReferenciaConcorrente contexto={competitorContext} recolhida={recolhida} onAlternar={alternarRef} /> : undefined}
      />
    )
  }

  const filtered = eligibleVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.channelHandle.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {competitorContext && <ReferenciaConcorrente contexto={competitorContext} recolhida={recolhida} onAlternar={alternarRef} />}
      <div role="status">
        {avisoAnunciado && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-cms-border bg-cms-accent-subtle px-4 py-3 text-sm text-cms-text">
            <Info size={15} className="mt-0.5 shrink-0 text-cms-accent" aria-hidden="true" />
            <span>{avisoAnunciado}</span>
          </div>
        )}
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-cms-text">Escolha um vídeo</h2>
        <p className="text-sm text-cms-text-muted mt-1">
          Escolha o vídeo em que você quer criar um teste A/B.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cms-text-dim"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Buscar vídeos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
        />
      </div>

      {/* Video list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-cms-text-dim py-8 text-center">
            {eligibleVideos.length === 0 ? 'Nenhum vídeo disponível.' : 'Nenhum vídeo corresponde à busca.'}
          </p>
        )}
        {filtered.map((v) => (
          <LinhaDeVideo key={v.id} video={v} onEscolher={setSelectedVideo} />
        ))}
      </div>

      {/* Back link */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.push('/cms/youtube/ab-lab')}
          className="text-sm text-cms-text-muted hover:text-cms-text transition-colors"
        >
          &larr; Voltar ao A/B Lab
        </button>
      </div>
    </div>
  )
}

/** Textos da faixa num ponto só (decisão do dono pode mudar a redação). */
const TEXTO_REF = {
  prefixo: 'Referência',
  concorrenteSemNome: 'um concorrente',
  aviso: 'Referência, não modelo.',
  verTroca: 'Ver a troca',
  verVideo: 'Ver o vídeo',
  recolher: 'Recolher',
  mostrar: 'Mostrar referência',
} as const

export function fraseDaReferencia(c: Pick<CompetitorContext, 'tipo' | 'canal' | 'refTroca'>): string {
  const quem = c.canal ?? TEXTO_REF.concorrenteSemNome
  if (c.refTroca) return `${TEXTO_REF.prefixo} · ${quem} trocou ${c.tipo === 'thumbnail' ? 'a thumbnail' : 'o título'}`
  return `${TEXTO_REF.prefixo} · ${c.tipo === 'thumbnail' ? 'thumbnail' : 'título'} de ${quem}`
}

function ReferenciaConcorrente({ contexto, recolhida, onAlternar }: { contexto: CompetitorContext; recolhida: boolean; onAlternar: () => void }) {
  // 404 do Blob: cai no estado "sem imagem guardada", por estado local, sem nova leitura.
  // O desenho final desse estado (imagem substituta com selo, quadro neutro) depende do mockup de Logan/Naksu: por enquanto, sem imagem.
  const [imagemFalhou, setImagemFalhou] = useState(false)
  const frase = fraseDaReferencia(contexto)
  const mostraImagem = contexto.tipo === 'thumbnail' && contexto.thumb && !imagemFalhou
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-cms-border bg-cms-accent-subtle px-4 py-3 text-sm text-cms-text">
      <FlaskConical size={15} className="mt-0.5 shrink-0 text-cms-accent" aria-hidden="true" />
      {!recolhida && mostraImagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={contexto.thumb ?? undefined}
          alt=""
          width={96}
          height={54}
          referrerPolicy="no-referrer"
          onError={() => setImagemFalhou(true)}
          className="h-[54px] w-24 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p>{frase}</p>
        {!recolhida && (
          <>
            {contexto.titulo &&
              (contexto.tipo === 'title' ? (
                <p className="mt-1 font-serif text-cms-text">{contexto.titulo}</p>
              ) : (
                <p className="mt-1 text-cms-text-muted line-clamp-2">{contexto.titulo}</p>
              ))}
            <p className="mt-1 text-cms-text-muted">{TEXTO_REF.aviso}</p>
            {contexto.hrefOrigem && (
              <a href={contexto.hrefOrigem} className="mt-1 inline-block text-cms-text underline">
                {contexto.refTroca ? TEXTO_REF.verTroca : TEXTO_REF.verVideo}
              </a>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={!recolhida}
        className="shrink-0 text-cms-text-muted hover:text-cms-text underline"
      >
        {recolhida ? TEXTO_REF.mostrar : TEXTO_REF.recolher}
      </button>
    </div>
  )
}
