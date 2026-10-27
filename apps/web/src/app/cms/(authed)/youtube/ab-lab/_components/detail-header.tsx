'use client'

import { rotuloDoDia } from '@/lib/youtube/ab-rotulo-dia'
import React from 'react'
import Link from 'next/link'
import type { TestType, AbTestStatus } from '@/lib/youtube/ab-types'
import { TypeBadge, Badge } from './ab-primitives'
import { InfoDica } from '../../_components/info-dica'
import { seloDoTeste, type TomDoSelo } from './cabecalho-do-teste'
import { ChevronLeft, ExternalLink, Swords } from 'lucide-react'
import './caminho-nativo.css'
import './detail-header-lab.css'

export type DetailOutcome = 'winner' | 'playoff' | undefined

export interface DetailHeaderProps {
  title: string
  flag: TestType
  status: AbTestStatus
  roundNumber: number
  totalRounds: number
  hasPlayoff: boolean
  outcome?: DetailOutcome
  dayInfo?: { dayOf: number; total: number }
  actions?: React.ReactNode
  /** Id do vídeo no YouTube (`view.youtubeVideoId`); ausente = sem o botão "Abrir no YouTube". */
  youtubeVideoId?: string | null
  /** O título é o da última leitura confirmada, não o de agora (M7b D19): mostra o selo "na última leitura". */
  tituloNaUltimaLeitura?: boolean
  /** Variante do Lab (S8-F3 T5b): rastro com respiro, miniatura, selo "Teste do Lab". Sem a prop, o cabeçalho é o de sempre. */
  lab?: { thumbUrl: string | null; naoIniciado?: boolean; /** Escrevendo no YouTube agora (régua da faixa, 5 min): o selo muda para "Escrevendo no YouTube…". */ escrevendo?: boolean; /** Teste v2 concluído (T12 T7): "DD/MM" da conclusão; troca o selo "rodando, dia X de Y". */ concluidoEm?: string }
}

/** O que o Lab troca no YouTube, por tipo: o teste do Lab não é o "Testar e comparar" do Studio. */
export function fraseDeOrigemDoLab(flag: TestType): string {
  const alvo = flag === 'thumbnail' ? 'a miniatura pública' : flag === 'combo' ? 'o título e a miniatura públicos' : 'o título público'
  return `Teste do A/B Lab: o Lab troca ${alvo} do vídeo no YouTube em rodízio, uma versão por vez. Não é o “Testar e comparar” do Studio.`
}

/** D20: link para o vídeo público (não confundir com o "Abrir no YouTube Studio" da faixa de restauração). Alvo de toque >= 44 px. */
export function AbrirNoYoutube({ youtubeVideoId }: { youtubeVideoId?: string | null }) {
  if (!youtubeVideoId) return null
  return (
    <a
      href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="abrir-no-youtube"
      className="inline-flex items-center gap-[6px] min-h-[44px] px-[12px] text-[12.5px] font-medium text-cms-text-dim hover:text-cms-text transition-colors"
    >
      <ExternalLink size={14} aria-hidden="true" />
      Abrir no YouTube
    </a>
  )
}

function SeloIcone({ tom }: { tom: TomDoSelo }) {
  const comum = { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  if (tom === 'pausado') return <svg {...comum}><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>
  if (tom === 'escrevendo') return <svg {...comum} className="dhl-giro"><path d="M8 2a6 6 0 1 0 6 6" /></svg>
  if (tom === 'concluido') return <svg {...comum}><circle cx="8" cy="8" r="6" /><path d="M5.2 8.3l2 2 3.6-4" /></svg>
  return <svg {...comum}><path d="M6 2h4M6.5 2v4L3 12.2a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L9.5 6V2" /></svg>
}

export function DetailHeader({
  title,
  flag,
  status,
  roundNumber,
  totalRounds,
  hasPlayoff,
  outcome,
  dayInfo,
  actions,
  youtubeVideoId,
  tituloNaUltimaLeitura,
  lab,
}: DetailHeaderProps) {
  if (lab) {
    const selo = seloDoTeste({
      status,
      dayOf: dayInfo?.dayOf ?? 0,
      durationDays: dayInfo?.total ?? 0,
      escrevendo: lab.escrevendo,
      naoIniciado: lab.naoIniciado,
      concluidoEm: lab.concluidoEm,
    })
    const comOrigem = (status === 'active' || status === 'paused') && !lab.concluidoEm && !lab.naoIniciado
    return (
      <header className="cn-raiz dhl">
        <div className="dhl-hd">
          {lab.thumbUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="dhl-th" src={lab.thumbUrl} alt="" referrerPolicy="no-referrer" />
            : <span className="dhl-th" aria-hidden="true" />}
          <div className="dhl-crumb">
            <Link href="/cms/youtube/ab-lab" className="inline-flex items-center gap-[5px] font-medium hover:text-cms-text transition-colors">
              <ChevronLeft size={15} aria-hidden="true" />
              A/B Lab
            </Link>
            <span>/</span>
            <TypeBadge type={flag} />
            {totalRounds > 1 && (
              <Badge tone="neutral">
                <Swords size={11} aria-hidden="true" className="-translate-y-px" />
                Round {roundNumber}/{totalRounds}
              </Badge>
            )}
          </div>
          <div className="dhl-ttl">
            <h2 className="dhl-h2" title={title}>{title}</h2>
            {tituloNaUltimaLeitura ? <p className="dhl-origem" data-testid="titulo-ultima-leitura">na última leitura</p> : null}
            {(dayInfo || lab.concluidoEm) && (
              <div className="dhl-selos">
                <span className={`dhl-selo dhl-selo--${selo.tom}`} data-testid="selo-lab">
                  <SeloIcone tom={selo.tom} />
                  <span>{selo.texto}</span>
                </span>
                {comOrigem && (
                  <InfoDica rotulo="O que é este teste" titulo="De onde vem este teste" paragrafos={[fraseDeOrigemDoLab(flag)]} />
                )}
              </div>
            )}
          </div>
        </div>
        {(actions || youtubeVideoId) && (
          <div className="dhl-acoes">
            {actions}
            <AbrirNoYoutube youtubeVideoId={youtubeVideoId} />
          </div>
        )}
      </header>
    )
  }
  return (
    <header>
      {/* Row 1: breadcrumb + badges */}
      <div className="flex items-center gap-[10px] flex-wrap mb-[14px]">
        <Link
          href="/cms/youtube/ab-lab"
          className="inline-flex items-center gap-[5px] text-[12.5px] text-cms-text-dim hover:text-cms-text transition-colors font-medium"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          A/B Lab
        </Link>
        <span className="text-cms-text-dim text-[12px]">/</span>
        <TypeBadge type={flag} />
        {totalRounds > 1 && (
          <Badge tone="neutral">
            <Swords size={11} aria-hidden="true" className="-translate-y-px" />
            Round {roundNumber}/{totalRounds}
          </Badge>
        )}
        {dayInfo && dayInfo.total >= 1 && (
          <Badge tone="green" dot={status === 'active'}>
            {rotuloDoDia(dayInfo.dayOf, dayInfo.total)}
          </Badge>
        )}
      </div>

      {/* Row 2: Title */}
      <h2 className="text-[28px] font-bold text-cms-text leading-[1.15] max-w-[720px] tracking-[-0.01em]">{title}</h2>
      {tituloNaUltimaLeitura ? <p className="text-[12px] text-cms-text-dim mt-[4px]" data-testid="titulo-ultima-leitura">na última leitura</p> : null}

      {/* Row 3: Toolbar */}
      {(actions || youtubeVideoId) && (
        <div className="flex flex-wrap items-center gap-[9px] mt-[14px]">
          {actions}
          <AbrirNoYoutube youtubeVideoId={youtubeVideoId} />
        </div>
      )}
    </header>
  )
}
