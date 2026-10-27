'use client'
// Faixa "Com você" (M7 T7): o que só o dono pode fazer. Nada de action aqui; tudo chega por props.
import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { ItemComVoce, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import './pagina-lab.css'

export interface FaixaComVoceProps {
  itens: ItemComVoce[]
  vazio: string | null
  onAbrirPainel: (p: PainelDecisao | PainelEscolha, origem: HTMLElement) => void
  onAbrirDia14: (linha: LinhaDoCaminho, origem: HTMLElement) => void
  onContinuarRascunho: (draftId: string) => void
  onNovoTeste: () => void
  onAbrirTeste: (testId: string) => void
}

/** Texto literal do mockup (index.html:54). */
export const TEXTO_AUTOMATICO = 'O Lab troca as versões, lê impressões e cliques e calcula o resultado. Escolher o vídeo, aplicar o vencedor, voltar à original e responder pelo Studio são com você.'

const urlDoStudio = (ytId: string): string => `https://studio.youtube.com/video/${ytId}/edit`

interface Linha { urgente: boolean; titulo: string; motivo: string; prazo: string; botao: ReactElement; link?: ReactElement }

const BOTAO = 'lab-btn lab-alvo'

export function FaixaComVoce(p: FaixaComVoceProps): ReactElement {
  const [aberto, setAberto] = useState(false)
  const botaoAuto = useRef<HTMLButtonElement>(null)
  const idAuto = useId()

  function aoTeclar(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape' && aberto) {
      e.stopPropagation()
      setAberto(false)
      botaoAuto.current?.focus()
    }
  }

  function linhaDe(i: ItemComVoce): Linha {
    switch (i.tipo) {
      case 'aplicar':
        return {
          urgente: true, titulo: `Aplique ${i.letra} em “${i.titulo}”`, motivo: i.motivo, prazo: 'Prazo: hoje',
          botao: <button type="button" className={`${BOTAO} pri`} onClick={e => p.onAbrirPainel(i.painel, e.currentTarget)}>Aplicar {i.letra}</button>,
        }
      case 'escolher':
        return {
          urgente: false, titulo: `Escolha o que fica em “${i.titulo}”`, motivo: i.motivo, prazo: 'sem prazo',
          botao: <button type="button" className={BOTAO} onClick={e => p.onAbrirPainel(i.painel, e.currentTarget)}>Escolher a versão</button>,
        }
      case 'dia14':
        return {
          urgente: true,
          titulo: `O teste do YouTube em “${i.titulo}” terminou. Veja no Studio qual versão ganhou e conte aqui.`,
          motivo: 'O Lab não lê o resultado do Studio.',
          prazo: i.vencido ? `Prazo acabou em ${i.prazo}` : `vence ${i.prazo}`,
          link: <a className="lab-alvo ml-2 inline-flex items-center text-[13px] text-[#9FB4C9] underline underline-offset-[3px]" href={urlDoStudio(i.ytId)} target="_blank" rel="noopener">Abrir no Studio</a>,
          botao: (
            <button type="button" className={BOTAO} aria-label="Dizer o que o Studio escolheu" onClick={e => p.onAbrirDia14(i.linha, e.currentTarget)}>
              <span aria-hidden="true" className="sm:hidden">Qual ganhou no Studio?</span>
              <span aria-hidden="true" className="hidden sm:inline">Dizer o que o Studio escolheu</span>
            </button>
          ),
        }
      case 'rascunho':
        return {
          urgente: false, titulo: `Continue o rascunho de “${i.titulo}”`,
          motivo: `Você parou no passo ${i.passo} de 3. O Lab não cria o teste sozinho.`, prazo: 'sem prazo',
          botao: <button type="button" className={BOTAO} onClick={() => p.onContinuarRascunho(i.draftId)}>Continuar rascunho</button>,
        }
      case 'retomar':
        return {
          urgente: false, titulo: `Retome o teste pausado de “${i.titulo}”`,
          motivo: `${i.pausadoHaDias === null ? 'Pausado' : i.pausadoHaDias === 0 ? 'Pausado hoje' : `Pausado há ${i.pausadoHaDias} ${i.pausadoHaDias === 1 ? 'dia' : 'dias'}`}. O Lab não retoma sozinho.`, prazo: 'pausado',
          botao: <button type="button" className={BOTAO} onClick={() => p.onAbrirTeste(i.testId)}>Retomar</button>,
        }
      case 'conferir_studio':
        return {
          urgente: false, titulo: `Confira no Studio “${i.titulo}”`,
          motivo: 'Teste criado no Studio, sem ficha no Lab. O Lab não lê o resultado do Studio.', prazo: 'sem prazo',
          botao: <a className={BOTAO} href={urlDoStudio(i.ytId)} target="_blank" rel="noopener">Abrir no Studio</a>,
        }
      case 'primeiro_teste':
        return {
          urgente: false, titulo: 'Crie o primeiro teste',
          motivo: 'O Lab não escolhe vídeo nem escreve versões; você faz isso no assistente, em 3 passos.', prazo: 'sem prazo',
          botao: <button type="button" className={`${BOTAO} pri`} onClick={p.onNovoTeste}>Novo teste</button>,
        }
    }
  }

  const n = p.itens.filter(i => i.tipo !== 'primeiro_teste').length
  return (
    <section aria-label="Com você" onKeyDown={aoTeclar} className="lab-pg mt-6 rounded-[14px] border border-cms-border bg-cms-surface px-4 pb-2 pt-1.5">
      <header className="flex items-center gap-2 pb-1.5 pt-2.5">
        <h2 className="m-0 text-[18px] font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>Com você</h2>
        {n > 0 ? <span className="text-sm font-normal text-cms-text-muted tabular-nums">({n})</span> : null}
        <button
          ref={botaoAuto} type="button" className="lab-btn txt lab-alvo ml-auto" aria-expanded={aberto} aria-controls={idAuto}
          onClick={() => setAberto(v => !v)}
        >
          O que é automático?
        </button>
      </header>
      <p id={idAuto} hidden={!aberto} className="mb-2 max-w-[75ch] rounded-lg border border-cms-border bg-[#16130F] px-3.5 py-2.5 text-[13px] text-cms-text-muted">{TEXTO_AUTOMATICO}</p>
      {p.itens.length === 0 ? (
        <div className="flex items-start gap-3 border-t border-cms-border pb-3 pt-2.5">
          <p className="m-0 max-w-[75ch] text-sm text-cms-text-muted"><b className="font-semibold">Nada com você agora.</b>{p.vazio ? ` ${p.vazio}` : ''}</p>
        </div>
      ) : p.itens.map((i, k) => {
        const l = linhaDe(i)
        return (
          <div
            key={`${i.tipo}-${k}`} data-item={i.tipo}
            className={`grid min-h-16 grid-cols-1 items-center gap-1.5 border-t border-cms-border py-2.5 pl-3.5 sm:grid-cols-[1fr_auto_auto] sm:gap-x-3.5 ${l.urgente ? 'border-l-[3px] border-l-[#F5B13D]' : 'border-l-[3px] border-l-cms-border'}`}
          >
            <div className="min-w-0">
              <b className="block text-sm font-semibold leading-[1.35]">{l.titulo}</b>
              <span className="block max-w-[70ch] text-[13px] text-cms-text-muted">{l.motivo}{l.link}</span>
            </div>
            <div className={`whitespace-nowrap text-[13px] tabular-nums sm:text-right ${l.urgente ? 'font-semibold text-[#F5B13D]' : 'text-cms-text-muted'}`}>{l.prazo}</div>
            <div className="[&>*]:w-full sm:[&>*]:w-auto">{l.botao}</div>
          </div>
        )
      })}
    </section>
  )
}
