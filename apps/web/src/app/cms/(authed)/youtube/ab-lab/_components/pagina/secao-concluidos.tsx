'use client'
// Seção "Concluídos" (M7 T11): quem venceu, desde quando está no ar e a ação possível (abre o painel). Sem sigla de sistema.
// Sem concluído e sem história a seção some (estado b2). Com 3 ou mais testes concluídos o LearningsPanel ocupa o lugar da régua.
import { useState, type ReactElement } from 'react'
import type { ChannelLearningsData, LearningsData } from '@/lib/youtube/ab-types'
import type { LinhaConcluida, PaginaDoLab, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import { LearningsPanel } from '../learnings-panel'
import './pagina-lab.css'

export interface SecaoConcluidosProps {
  concluidos: PaginaDoLab['concluidos']
  temHistorico: boolean
  learnings: LearningsData | null
  channelLearnings: ChannelLearningsData | null
  onAbrirPainel: (p: PainelDecisao, origem: HTMLElement) => void
}

function Miniatura({ src }: { src: string | null }): ReactElement {
  const [falhou, setFalhou] = useState(false)
  if (!src || falhou) return <div className="lab-th vazia !w-24 max-sm:!w-16" role="img" aria-label="Miniatura do vídeo">sem miniatura</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="lab-th !w-24 max-sm:!w-16"><img src={src} alt="Miniatura do vídeo" onError={() => setFalhou(true)} /></div>
}

function Linha({ l, onAbrirPainel }: { l: LinhaConcluida; onAbrirPainel: SecaoConcluidosProps['onAbrirPainel'] }): ReactElement {
  const acao = l.acao
  return (
    <div className="flex min-h-[68px] flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-cms-border py-2 first:border-t-0" data-concluido={l.chave}>
      <Miniatura src={l.miniaturaUrl} />
      <div className="min-w-0 flex-1">
        <b className="line-clamp-2 text-sm font-medium leading-[1.35]">{l.titulo}</b>
        <span className="text-xs text-cms-text-muted">{l.tipo}</span>
      </div>
      <div className="flex flex-col items-end gap-1 text-right max-sm:basis-full max-sm:items-start max-sm:text-left">
        <b className="text-[13px] font-semibold text-cms-text-muted">{l.resultado}</b>
        <span className="text-xs text-cms-text-muted">{l.apoio}</span>
        {acao ? (
          <button type="button" className="lab-btn lab-alvo" onClick={e => onAbrirPainel(acao.painel, e.currentTarget)}>{acao.rotulo}</button>
        ) : null}
      </div>
    </div>
  )
}

export function SecaoConcluidos({ concluidos, temHistorico, learnings, channelLearnings, onAbrirPainel }: SecaoConcluidosProps): ReactElement | null {
  const { linhas, total, regua } = concluidos
  if (linhas.length === 0 && !temHistorico) return null
  return (
    <section className="lab-pg mt-9" aria-label="Concluídos" data-secao="concluidos">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-[18px] font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>Concluídos</h2>
        <span className="text-xs text-cms-text-muted tabular-nums sm:ml-auto">{total} {total === 1 ? 'teste' : 'testes'}</span>
      </div>
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[14px] border border-cms-border bg-cms-surface px-4 py-1">
          {linhas.map(l => <Linha key={l.chave} l={l} onAbrirPainel={onAbrirPainel} />)}
          <div className="flex flex-wrap items-center gap-2 border-t border-cms-border py-1">
            <button type="button" className="lab-btn txt lab-alvo underline underline-offset-[3px]" aria-disabled="true" onClick={e => e.preventDefault()}>Ver testes anteriores</button>
            <span className="lab-selo inline-flex items-center whitespace-nowrap !self-center rounded-full border border-dashed border-[#40382D] px-[9px] text-xs font-semibold leading-[18px] text-[#958A75]">Em breve</span>
          </div>
        </div>
        {regua ? (
          <div className="flex flex-col justify-center gap-2.5 rounded-[14px] border border-cms-border bg-cms-surface p-4">
            <b className="text-sm font-semibold leading-[1.35]">Coletando dados: {regua.feitos} de {regua.meta} testes concluídos</b>
            <div className="flex gap-1.5" role="img" aria-label={`${regua.feitos} de ${regua.meta}`}>
              {Array.from({ length: regua.meta }, (_, i) => (
                <i key={i} className={`h-2 flex-1 rounded border ${i < regua.feitos ? 'border-cms-text-dim bg-cms-text-dim' : 'border-[#40382D] bg-transparent'}`} />
              ))}
            </div>
            <span className="text-xs text-cms-text-muted">Com 3 testes o Lab começa a mostrar o que funciona no seu canal.</span>
          </div>
        ) : (
          <LearningsPanel learnings={learnings} channelLearnings={channelLearnings} totalTests={total} />
        )}
      </div>
    </section>
  )
}
