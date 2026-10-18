'use client'

import { useEffect, useRef } from 'react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import type { OpcaoDoDialogo } from './encerrar-props'
import './ab-end-test-dialog.css'

export interface AbConfirmarTrocaDialogProps {
  /** Campos que mudaram por fora, com o valor que está no YouTube agora (título em texto; thumbnail por URL pública). */
  campos: Array<{ campo: CampoNome; valor_atual: string }>
  /** Variante escolhida (a que vai entrar no lugar). */
  opcao: OpcaoDoDialogo
  onVoltar: () => void
  onConfirmar: () => void
}

function Miniatura({ src, rotulo }: { src: string | null; rotulo: string }) {
  // Na comparação a imagem é o dado; quando não carrega, o texto diz que falta.
  if (!src) return <div className="etd-th fail" role="img" aria-label={rotulo}>Sem imagem</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="etd-th"><img src={src} alt={rotulo} /></div>
}

export function AbConfirmarTrocaDialog({ campos, opcao, onVoltar, onConfirmar }: AbConfirmarTrocaDialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const voltarRef = useRef<HTMLButtonElement>(null)
  useModalFocusTrap(ref, true, onVoltar)
  // Depois da armadilha de foco (que foca o 1º controle), o foco vai para "Voltar" (a opção segura).
  useEffect(() => { voltarRef.current?.focus() }, [])

  const titulo = campos.find(c => c.campo === 'title')
  const thumb = campos.find(c => c.campo === 'thumbnail')
  const ambos = !!titulo && !!thumb
  const v = opcao.rotulo

  const lead = ambos
    ? 'O título e a thumbnail no YouTube não são de nenhuma variante: alguém editou os dois por fora.'
    : titulo
      ? 'O título no YouTube não é de nenhuma variante: alguém editou por fora.'
      : 'A thumbnail no YouTube não é de nenhuma variante: alguém editou por fora.'
  const nota = ambos
    ? `Se você continuar, o título e a thumbnail editados por fora saem do YouTube e os da variante ${v} entram no lugar. Copie o título e salve a imagem antes se quiser guardar.`
    : titulo
      ? `Se você continuar, o título editado por fora sai do YouTube e o da variante ${v} entra no lugar. Copie-o antes se quiser guardar.`
      : `Se você continuar, a thumbnail editada por fora sai do YouTube e a da variante ${v} entra no lugar. Salve a imagem antes se quiser guardar.`
  const botao = ambos
    ? `Trocar título e thumbnail por ${v} e encerrar`
    : titulo
      ? `Trocar pelo título de ${v} e encerrar`
      : `Trocar pela thumbnail de ${v} e encerrar`

  const compTitulo = titulo ? (
    <div className="etd-cmp">
      <div><h4>No YouTube agora</h4><p>{titulo.valor_atual}</p></div>
      <div className="mine"><h4>Variante {v}</h4><p>{opcao.titulo ?? ''}</p></div>
    </div>
  ) : null
  const compThumb = thumb ? (
    <div className="etd-cmp">
      <div><h4>No YouTube agora</h4><Miniatura src={thumb.valor_atual || null} rotulo="Thumbnail editada por fora" /></div>
      <div className="mine"><h4>Variante {v}</h4><Miniatura src={opcao.miniatura} rotulo={`Thumbnail da variante ${v}`} /></div>
    </div>
  ) : null

  return (
    <YtPortal>
      <div className="etd-scrim">
        <div className="absolute inset-0" onClick={onVoltar} aria-hidden="true" />
        <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="etd-c-t" aria-describedby="etd-c-d etd-c-n" className="etd">
          <div className="etd-h">
            <span className="etd-ico w" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3L22 20H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4.5M12 17.3v.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </span>
            <h2 id="etd-c-t">Trocar mesmo assim?</h2>
            <button type="button" className="etd-x" aria-label="Fechar" onClick={onVoltar}>
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="etd-b">
            <p className="etd-lead" id="etd-c-d">{lead}</p>
            <p className="etd-tiny" id="etd-c-n">{nota}</p>
            {ambos ? <h3 className="etd-sec">Título</h3> : null}
            {compTitulo}
            {ambos ? <h3 className="etd-sec">Thumbnail</h3> : null}
            {compThumb}
          </div>
          <div className="etd-f">
            <button type="button" className="etd-btn over" onClick={onConfirmar}>{botao}</button>
            <button type="button" className="etd-btn" ref={voltarRef} onClick={onVoltar}>Voltar</button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
