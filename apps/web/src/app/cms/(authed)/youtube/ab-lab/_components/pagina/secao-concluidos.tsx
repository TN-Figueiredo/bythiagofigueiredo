'use client'
// Seção "Concluídos" (M7 T11): quem venceu, desde quando está no ar e a ação possível (abre o painel). Sem sigla de sistema.
// Sem concluído e sem história a seção some (estado b2). Com 3 ou mais testes concluídos o LearningsPanel ocupa o lugar da régua.
import { useState, type ReactElement } from 'react'
import type { ChannelLearningsData, LearningsData } from '@/lib/youtube/ab-types'
import type { LinhaConcluida, PaginaDoLab, PainelDecisao, SeloDeLinha } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { Ic } from './icones-painel'
import { LearningsPanel } from '../learnings-panel'
import './pagina-lab.css'

export interface SecaoConcluidosProps {
  concluidos: PaginaDoLab['concluidos']
  temHistorico: boolean
  learnings: LearningsData | null
  channelLearnings: ChannelLearningsData | null
  onAbrirPainel: (p: PainelDecisao | PainelEscolha, origem: HTMLElement) => void
}

function Miniatura({ src }: { src: string | null }): ReactElement {
  const [falhou, setFalhou] = useState(false)
  if (!src || falhou) return <div className="lab-th vazia !w-24 max-sm:!w-16" role="img" aria-label="Miniatura do vídeo">sem miniatura</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="lab-th !w-24 max-sm:!w-16"><img src={src} alt="Miniatura do vídeo" onError={() => setFalhou(true)} /></div>
}

const CLASSE_SELO: Record<SeloDeLinha['tom'], string> = { neutro: '', dia: 'dia', esc: 'esc' }

function SeloLinha({ s }: { s: SeloDeLinha }): ReactElement {
  return <span className={`pe-selo ${CLASSE_SELO[s.tom]}`}><Ic n={s.icone} />{s.texto}</span>
}

function Linha({ l, onAbrirPainel }: { l: LinhaConcluida; onAbrirPainel: SecaoConcluidosProps['onAbrirPainel'] }): ReactElement {
  const painel = l.painel
  const corpo = (
    <>
      <Miniatura src={l.miniaturaUrl} />
      <span className="block min-w-0 flex-1">
        <b className="line-clamp-2 block text-sm font-medium leading-[1.35] max-sm:line-clamp-4" title={l.titulo}>{l.titulo}</b>
        <span className="text-xs text-cms-text-muted">{l.tipo}{l.concluidoEm ? ` · concluído em ${l.concluidoEm}` : ''}</span>
      </span>
      {l.selos ? (
        <span className="flex flex-col items-end gap-1.5 max-sm:basis-full max-sm:items-start" data-selos>
          {l.selos.map(s => <SeloLinha key={s.texto} s={s} />)}
        </span>
      ) : (
        <span className="flex flex-col items-end gap-1 text-right max-sm:basis-full max-sm:items-start max-sm:text-left">
          <b className="text-[13px] font-semibold text-cms-text-muted">{l.resultado}</b>
          <span className="text-xs text-cms-text-muted">{l.apoio}</span>
        </span>
      )}
    </>
  )
  if (painel) {
    return (
      <button
        type="button" data-concluido={l.chave} onClick={e => onAbrirPainel(painel, e.currentTarget)}
        className="relative flex min-h-[68px] w-full flex-wrap items-center gap-x-3.5 gap-y-2 border-0 border-t border-cms-border bg-transparent py-2 pr-7 text-left text-inherit first:border-t-0 hover:bg-cms-surface-hover"
        style={{ font: 'inherit', cursor: 'pointer' }}
      >
        {corpo}
        <span className="absolute right-0 top-1/2 -mt-2 text-cms-text-muted"><Ic n="chev" /></span>
      </button>
    )
  }
  return (
    <div className="flex min-h-[68px] flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-cms-border py-2 first:border-t-0" data-concluido={l.chave}>
      {corpo}
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
          {linhas.some(l => l.painel) ? <p className="m-0 pt-2 text-xs text-cms-text-muted">Toque numa linha para abrir o painel do teste.</p> : null}
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
