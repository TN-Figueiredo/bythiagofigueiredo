'use client'
/**
 * M9b T7 (mockup peca9, itens 4 e 6; Logan 11.2): o diálogo "Apagar do arquivo". Digitar o nome (ou o código) libera o botão. Em todo erro o diálogo
 * fica aberto, o nome digitado fica, o foco vai ao aviso (âmbar: nada foi apagado ou o estado é incerto). A action vem por prop; nunca é importada aqui.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { DialogoApagar as Dados } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { nomeConfere } from '../_canais/remover-model'
import type { RespostaApagar } from './actions-canal'

export const AVISO_DO_ERRO: Record<Extract<RespostaApagar, { ok: false }>['erro'] | 'rede', string> = {
  sem_permissao: 'Só quem administra o site pode apagar do arquivo. A limpeza não foi pedida.',
  desligado: 'A limpeza de canal está desligada agora. A limpeza não foi pedida.',
  nome_nao_confere: 'O nome do canal mudou desde que você abriu esta janela. Feche e abra de novo. A limpeza não foi pedida.',
  canal_nao_encontrado: 'Este canal não está mais na lista; outra pessoa pode ter pedido a limpeza. Feche e atualize a página. A limpeza não foi pedida por aqui.',
  canal_existe: 'Este canal voltou a existir no site; o arquivo dele não foi apagado. Feche e atualize a página. A limpeza não foi pedida.',
  forma: 'Não deu para pedir a limpeza agora. A limpeza não foi pedida; tente de novo em alguns minutos. Se repetir, avise quem cuida do site.',
  interno: 'Não deu para pedir a limpeza agora. A limpeza não foi pedida; tente de novo em alguns minutos. Se repetir, avise quem cuida do site.',
  rede: 'Não sabemos se a limpeza foi pedida. Recarregue a página antes de tentar de novo.',
}

export function DialogoApagar({ d, onConfirmar, onFechar }: {
  d: Dados
  /** Devolve a resposta da action; lançar = a resposta se perdeu. */
  onConfirmar: (digitado: string) => Promise<RespostaApagar>
  onFechar: (r: { status: 'ok' | 'ja_pedido' } | null) => void
}): ReactElement {
  const uid = useId()
  const [digitado, setDigitado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const emVoo = useRef(false)
  const campo = useRef<HTMLInputElement>(null)
  const avisoRef = useRef<HTMLParagraphElement>(null)
  const confere = nomeConfere(digitado, d.confirma)
  useEffect(() => { campo.current?.focus() }, [])
  useEffect(() => { if (aviso) avisoRef.current?.focus() }, [aviso])

  const enviar = async (): Promise<void> => {
    if (emVoo.current || !confere) return
    emVoo.current = true; setEnviando(true); setAviso(null)
    try {
      const r = await onConfirmar(digitado)
      if (r.ok) { onFechar({ status: r.status }); return }
      setAviso(AVISO_DO_ERRO[r.erro] ?? AVISO_DO_ERRO.interno)
    } catch {
      setAviso(AVISO_DO_ERRO.rede)
    }
    emVoo.current = false; setEnviando(false)
  }
  const caixa = useRef<HTMLDivElement>(null)
  const teclas = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && !enviando) { e.stopPropagation(); onFechar(null); return }
    if (e.key !== 'Tab' || !caixa.current) return
    // foco preso: Tab no último volta ao primeiro e Shift+Tab no primeiro vai ao último (aria-modal sozinho não prende o foco)
    const alvos = Array.from(caixa.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])'))
    const primeiro = alvos[0], ultimo = alvos[alvos.length - 1]
    if (!primeiro || !ultimo) return
    const ativo = document.activeElement
    if (e.shiftKey && (ativo === primeiro || !caixa.current.contains(ativo))) { e.preventDefault(); ultimo.focus() }
    else if (!e.shiftKey && (ativo === ultimo || !caixa.current.contains(ativo))) { e.preventDefault(); primeiro.focus() }
  }
  const rotuloCampo = d.porCodigo ? 'Código do arquivo' : 'Nome do canal'
  return (
    <div className="arq-mdl-fundo" onKeyDown={teclas}>
      <div className="arq-mdl" ref={caixa} role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} data-dialogo="apagar-do-arquivo">
        <div className="arq-mdl-b">
          <h2 id={`${uid}-t`}>{d.titulo}</h2>
          <p className="t"><b>Não dá para desfazer.</b> {d.corpo}</p>
          {d.loteE10 ? <p className="t arq-mdl-av" data-aviso="lote">A exportação que você fez à mão fica no Mac e no NAS. Apagar do arquivo não a apaga: apague-a você.</p> : null}
          {d.avisoBlob ? <p className="t arq-mdl-av" data-aviso="blob">O site não anotou, na remoção, quais imagens deste canal estão no Blob e não consegue apagá-las. Elas continuam lá depois que o arquivo for apagado.</p> : null}
          <p className="t">Para continuar, digite {d.porCodigo ? 'o código deste arquivo' : 'o nome do canal'}: <b>{d.confirma}</b></p>
          <label htmlFor={`${uid}-n`}>{rotuloCampo}</label>
          <input id={`${uid}-n`} ref={campo} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} value={digitado} readOnly={enviando} onChange={e => setDigitado(e.target.value)} aria-describedby={`${uid}-s`} />
          {aviso ? <p ref={avisoRef} tabIndex={-1} role="alert" className="arq-ausente am" id={`${uid}-s`}>{aviso}</p>
            : <p className="m-st" role="status" id={`${uid}-s`}>{enviando ? 'Enviando o pedido…' : confere ? (d.porCodigo ? 'Código confirmado.' : 'Nome confirmado.') : `Digite ${d.porCodigo ? 'o código' : 'o nome do canal'} para continuar.`}</p>}
        </div>
        <div className="arq-mdl-a">
          <button type="button" className="btn" aria-disabled={enviando} onClick={() => { if (!enviando) onFechar(null) }}>Cancelar</button>
                  <button type="button" className="btn danger" aria-disabled={!confere || enviando} onClick={() => { void enviar() }}>{enviando ? 'Apagando…' : 'Apagar do arquivo'}</button>
</div>
      </div>
    </div>
  )
}
