'use client'
// Diálogo "O que o Studio mostrou?" (M7 T9). As actions chegam por props (nenhum client importa ../actions-nativo).
// Um toque grava pelo servidor que já existe; "Não vi ainda" só fecha com "Certo" e NÃO chama o servidor (desvio 2).
import { useRef, useState, type ReactElement } from 'react'
import { YtPortal } from '../../../_components/yt-portal'
import { useModalFocusTrap } from '../../../../_shared/editor/use-modal-focus-trap'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import type { RespostaDono } from '@/lib/youtube/teste-youtube/nativo/versoes'
import type { PedidoRespostaDia14 } from '../../actions-nativo'
import { Dia14Pergunta, type AcoesDia14 } from '../caminho-nativo/dia-14-pergunta'
import { versoesDoDia14 } from '../caminho-nativo/dia-14-estado'
import type { AcoesCaminho } from '../caminho-nativo/lista-caminho'
import './pagina-lab.css'

export interface DialogoDia14Props {
  linha: LinhaDoCaminho
  acoes: Pick<AcoesCaminho, 'responderTesteDoYouTube' | 'mudarRespostaDoTesteDoYouTube'>
  /** Relê a página (a linha mudou). Chamado ao registrar e ao fechar depois de registrar. */
  atualizar: () => void
  onFechar: () => void
}

type Vista =
  | { v: 'pergunta' }
  | { v: 'feito'; titulo: string; texto: string; gravado: boolean }

const urlDoStudio = (ytId: string): string => `https://studio.youtube.com/video/${ytId}/edit`

export function DialogoDia14({ linha, acoes, atualizar, onFechar }: DialogoDia14Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const enviando = useRef(false)
  const ultimo = useRef<{ resposta: RespostaDono; n: number | null } | null>(null)
  const [vista, setVista] = useState<Vista>({ v: 'pergunta' })
  const [rodada, setRodada] = useState(0)
  const registrou = useRef(false)

  const fechar = (): void => {
    if (enviando.current) return
    if (registrou.current) atualizar()
    onFechar()
  }
  useModalFocusTrap(ref, true, fechar, tituloRef)

  const reg = linha.registro
  const pergunta = reg ? versoesDoDia14(reg) : null
  const mudar = ultimo.current !== null

  const acoesDia14: AcoesDia14 = {
    responder: async (p: PedidoRespostaDia14) => {
      enviando.current = true
      try {
        const r = await acoes.responderTesteDoYouTube(p)
        if (r.ok) ultimo.current = { resposta: p.resposta, n: p.n }
        return r
      } finally { enviando.current = false }
    },
    mudar: async p => {
      enviando.current = true
      try {
        const r = await acoes.mudarRespostaDoTesteDoYouTube(p)
        if (r.ok) ultimo.current = { resposta: p.resposta, n: p.n }
        return r
      } finally { enviando.current = false }
    },
    atualizar,
    anunciar: texto => { registrou.current = true; setVista({ v: 'feito', titulo: 'Registrado', texto, gravado: true }) },
  }

  return (
    <YtPortal>
      <div className="lab-pg lab-scrim">
        <div className="absolute inset-0" data-testid="dialogo-fundo" onClick={fechar} aria-hidden="true" />
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dl14-t" className="lab-dlg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="dl14-t" ref={tituloRef} tabIndex={-1} className="m-0 text-xl font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>
                {vista.v === 'feito' ? vista.titulo : FRASES.dia14.tituloDialogo}
              </h2>
              {vista.v === 'pergunta' ? <p className="m-0 mt-0.5 text-xs text-cms-text-muted">{linha.titulo}</p> : null}
            </div>
            {vista.v === 'pergunta' ? (
              <button type="button" className="lab-btn txt lab-alvo -mr-2 -mt-1.5 min-w-11 !px-0" aria-label="Fechar" onClick={fechar}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            ) : null}
          </div>
          {vista.v === 'feito' ? (
            <>
              <p className="mt-3.5 text-sm" role="status">{vista.texto}</p>
              <div className="lab-acoes">
                <button type="button" className="lab-btn ghost lab-alvo" onClick={() => { setRodada(n => n + 1); setVista({ v: 'pergunta' }) }}>Mudar resposta</button>
                <button type="button" className="lab-btn pri lab-alvo" onClick={fechar}>Fechar</button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-cms-text-muted">
                {FRASES.dia14.apoioDialogo}
                <a className="lab-alvo ml-2 inline-flex items-center text-[13px] text-[#9FB4C9] underline underline-offset-[3px]" href={urlDoStudio(linha.ytId)} target="_blank" rel="noopener">{FRASES.dia14.abrirNoStudio}</a>
              </p>
              {reg && pergunta ? (
                <Dia14Pergunta
                  key={rodada} embutido linha={linha} pergunta={pergunta} acoes={acoesDia14} aoFechar={fechar}
                  modo={mudar ? 'mudar' : 'responder'}
                  {...(mudar && ultimo.current ? { respostaVista: ultimo.current.resposta, varianteVista: ultimo.current.n } : {})}
                  aoNaoViAinda={() => setVista({ v: 'feito', titulo: FRASES.dia14.certo, texto: FRASES.dia14.avisoContinua, gravado: false })}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </YtPortal>
  )
}
