'use client'
// A5 · E17 degrau 1, Tarefa 10: o diálogo "Perguntar a uma IA". <dialog> modal nativo: foco preso (laço de Tab), Esc fecha (com ⓘ aberto, fecha só o ⓘ),
// clique no fundo fecha, o foco volta ao botão. Tudo o que mostra vem de `resumir(pacote, pergunta)`, recalculado a cada tecla; nada é contado aqui.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import type { PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { BarraDeTamanho } from './barra-de-tamanho'
import * as F from './frases-do-dialogo'
import { BotaoInfo, Icones, PainelDoInfo, type InfoId } from './info'
import { LinhasDeFora } from './linhas-de-fora'
import { Previa } from './previa'
import { ReguaDosNumeros } from './regua-dos-numeros'
import type { FaseDaCopia, FaseDoPacote } from './use-pacote'

export interface PropsDoDialogo {
  nomeDaTela: string
  exemplos: readonly string[]
  estado: FaseDoPacote
  copia: FaseDaCopia
  pergunta: string
  onPergunta: (p: string) => void
  onCopiar: (texto: string) => void
  onFechar: () => void
  onTentarDeNovo: () => void
  /** O botão que abriu: o foco volta a ele. */
  abridor: RefObject<HTMLElement | null>
}

const FOCAVEIS = 'button:not([aria-disabled="true"]):not([disabled]),textarea,[tabindex="0"]'

function baixar(nome: string, texto: string): void {
  try {
    const b = new Blob([texto], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch { /* sem Blob ou sem URL: o botão não faz nada; "Copiar" e "Selecionar" seguem valendo */ }
}

function Resumo({ pacote, r }: { pacote: PacoteSerializado; r: ReturnType<typeof resumir> }) {
  const n = pacote.tabelas.length
  const privado = pacote.privado.estado === 'na' ? F.NADA_PRIVADO : pacote.privado.estado === 'incluido' ? null : undefined
  const total = pacote.numeros.medidos + pacote.numeros.zerosMedidos + pacote.numeros.naoMedidos
  return (
    <span>
      Pacote da tela <b>{pacote.nomeDaTela}</b>: <b>{F.tabelas(n)}</b>, <b>{F.fraseResumoCaracteres(r.copia.caracteres, r.copia.totalSemCorte, r.copia.cabe)}</b>,{' '}
      {privado === undefined ? <span className="pi-pvx"><Icones.cadeado />{F.PRIVADO_EXCLUIDO}</span>
        : privado === null ? <span className="pi-pvm"><Icones.cadeado />{F.PRIVADO_INCLUIDO}</span> : privado}
      {pacote.vazio ? <> · <span className="pi-sw-t"><i className="pi-sw nao" aria-hidden="true" />{F.NENHUM_NUMERO_AINDA}</span></>
        : pacote.primeiraLinhaDeAviso ? <> · <span className="pi-sw-t"><i className="pi-sw nao-medido" aria-hidden="true" /><b>{F.soMedidos(pacote.numeros.medidos, total)}</b></span></> : null}
    </span>
  )
}

export function Dialogo(p: PropsDoDialogo) {
  const ref = useRef<HTMLDialogElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const pre = useRef<HTMLPreElement>(null)
  const [info, setInfo] = useState<InfoId | null>(null)
  const aberto = p.estado.fase !== 'fechado'
  const pacote = p.estado.fase === 'pronto' ? p.estado.pacote : null
  const r = useMemo(() => (pacote ? resumir(pacote, p.pergunta) : null), [pacote, p.pergunta])

  // abrir e fechar o <dialog>; o foco inicial vai ao título e, ao fechar, volta ao botão
  const estavaAberto = useRef(false)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !estavaAberto.current) {
      if (typeof d.showModal === 'function') { if (!d.open) d.showModal() } else d.setAttribute('open', '')
      titulo.current?.focus({ preventScroll: true })
    } else if (!aberto && estavaAberto.current) {
      setInfo(null)
      if (typeof d.close === 'function') { if (d.open) d.close() } else d.removeAttribute('open')
      p.abridor.current?.focus()
    }
    estavaAberto.current = aberto
  }, [aberto, p.abridor])

  // depois de copiar, o foco fica no botão principal do novo estado
  useEffect(() => {
    if (p.copia === 'ocioso') return
    ref.current?.querySelector<HTMLElement>(p.copia === 'falhou' ? '#pi-baixar' : '#pi-copiar')?.focus()
  }, [p.copia])

  const alternar = (id: InfoId): void => setInfo((x) => (x === id ? null : id))
  const aoTeclar = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key !== 'Tab') return
    const d = ref.current
    if (!d) return
    const f = Array.from(d.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((x) => !x.closest('.pi-pop'))
    if (!f.length) return
    const i = f.indexOf(document.activeElement as HTMLElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1]!.focus() }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0]!.focus() }
  }
  const nome = p.nomeDaTela
  const erro = p.estado.fase === 'erro'
  const carregando = p.estado.fase === 'carregando'
  const rotBaixar = r ? (r.copia.cabe ? F.BAIXAR_MD : F.baixarCompleto(r.completo.caracteres)) : F.BAIXAR_MD
  const fazerBaixar = (): void => { if (pacote && r) baixar(pacote.arquivo, r.copia.cabe ? r.copia.texto : r.completo.texto) }
  const selecionar = (): void => {
    const el = pre.current
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(range)
  }

  return (
    <dialog
      ref={ref} className="pi-dlg" aria-labelledby="pi-h" aria-describedby="pi-res"
      onKeyDown={aoTeclar}
      onCancel={(e) => { e.preventDefault(); if (info) setInfo(null); else p.onFechar() }}
      onClose={() => { if (aberto) p.onFechar() }}
      onClick={(e) => { if (e.target === ref.current) p.onFechar() }}
    >
      <header className="pi-dh">
        <div className="pi-dt"><h2 id="pi-h" ref={titulo} tabIndex={-1}>{F.TITULO}</h2></div>
        <button type="button" className="pi-x" id="pi-x" aria-label={F.FECHAR} onClick={p.onFechar}><Icones.x /></button>
      </header>
      <div className="pi-sum">
        <p className="pi-res" id="pi-res" aria-busy={carregando || undefined}>
          {pacote && r ? <Resumo pacote={pacote} r={r} /> : erro ? <span>Pacote da tela <b>{nome}</b>: <b>não foi montado</b></span> : <span>Montando o pacote da tela <b>{nome}</b>…</span>}
        </p>
        {pacote && <BotaoInfo id="metodo" aberto={info === 'metodo'} onAlternar={alternar} />}
      </div>
      <div className="pi-corpo" id="pi-corpo">
        {erro ? (
          <div className="pi-err"><Icones.aviso /><div><h3 className="pi-h3">{F.ERRO_TITULO}</h3><p>{F.ERRO_CORPO}</p></div></div>
        ) : carregando ? (
          <div className="pi-esq" aria-busy="true">
            <div className="pi-ctl"><i className="pi-sk" style={{ width: '46%' }} /><i className="pi-sk b" /><i className="pi-sk" style={{ width: '60%' }} /><i className="pi-sk b" /><i className="pi-sk b" /><i className="pi-sk b" /></div>
            <div className="pi-cod pi-cod-sk"><div className="pi-cod-b"><i className="pi-sk l" style={{ width: '70%' }} /><i className="pi-sk l" style={{ width: '92%' }} /><i className="pi-sk l" style={{ width: '54%' }} /><i className="pi-sk l" style={{ width: '81%' }} /></div></div>
          </div>
        ) : pacote && r ? (
          <div className="pi-esq">
            <div className="pi-ctl">
              <section className="pi-bl" id="pi-sec-tam">
                <h3 className="pi-h3">{F.TAMANHO}<BotaoInfo id="tamanho" aberto={info === 'tamanho'} onAlternar={alternar} /></h3>
                <p className="pi-tam">
                  <span><b className="num">{F.milhar(r.copia.caracteres)}</b> de <b className="num">{F.milhar(CONTEXTO_IA_RULES.limiteCopia)}</b> caracteres</span>
                  {r.copia.cabe ? <span className="pi-stc ok"><Icones.ok />{F.CABE_INTEIRO}</span> : <span className="pi-stc cut"><Icones.corte />{F.CORTADO_POR_TAMANHO}</span>}
                </p>
                <BarraDeTamanho m={{ total: r.copia.totalSemCorte, copia: r.copia.caracteres, soArquivo: r.soNoArquivo, completo: r.completo.caracteres, naoSaem: r.naoSaem, cabe: r.copia.cabe, limite: CONTEXTO_IA_RULES.limiteCopia }} />
              </section>
              <section className="pi-bl" id="pi-sec-num">
                <h3 className="pi-h3">{F.NUMEROS_NO_PACOTE}<BotaoInfo id="numeros" aberto={info === 'numeros'} onAlternar={alternar} /></h3>
                <ReguaDosNumeros medidos={pacote.numeros.medidos} zeros={pacote.numeros.zerosMedidos} naoMedidos={pacote.numeros.naoMedidos} />
              </section>
              <section className="pi-bl" id="pi-sec-fora">
                <h3 className="pi-h3">{F.O_QUE_FICOU_DE_FORA}</h3>
                <LinhasDeFora cabe={r.copia.cabe} cortes={r.copia.cortes} privado={pacote.privado} comentarios={pacote.comentarios} />
              </section>
            </div>
            <div id="pi-prev"><Previa ref={pre} arquivo={pacote.arquivo} resumo={r} /></div>
          </div>
        ) : null}
        <div className="pi-perg">
          <label htmlFor="pi-q" className="pi-lb">{F.MINHA_PERGUNTA} <span className="pi-op">{F.OPCIONAL}</span></label>
          <textarea id="pi-q" className="pi-ta" rows={2} maxLength={CONTEXTO_IA_RULES.perguntaMax} placeholder={F.DICA_DA_PERGUNTA} value={p.pergunta} onChange={(e) => p.onPergunta(e.target.value)} />
          <p className="pi-pc">{F.contador(p.pergunta.length, CONTEXTO_IA_RULES.perguntaMax)}</p>
          {p.exemplos.length > 0 && (
            <div className="pi-sugs"><span className="pi-sug-l">{F.EXEMPLOS}</span>
              {p.exemplos.map((s) => <button key={s} type="button" className="pi-sug" onClick={() => p.onPergunta(s)}>{s}</button>)}
            </div>
          )}
        </div>
      </div>
      <footer className="pi-ft">
        <p className="pi-aviso"><Icones.aviso /><span><b>{F.AVISO_FIXO}</b></span></p>
        <div id="pi-ftb">
          {p.copia === 'copiado' && r ? (
            <p className="pi-st ok" id="pi-st" role="status"><Icones.ok /><span><b>{F.COPIADO_NEGRITO}</b>{F.copiadoResto(r.copia.caracteres)}</span></p>
          ) : p.copia === 'falhou' ? (
            <p className="pi-st err" id="pi-st" role="alert"><Icones.aviso /><span><b>{F.FALHOU_NEGRITO}</b>{F.FALHOU_RESTO}</span></p>
          ) : (
            <p className="pi-st" id="pi-st" role="status" />
          )}
          <div className="pi-acoes">
            {erro ? (
              <button type="button" className="btn big pri" id="pi-retry" onClick={p.onTentarDeNovo}><span>{F.TENTAR_DE_NOVO}</span></button>
            ) : carregando || !r ? (
              <>
                <button type="button" className="btn big pri" aria-disabled="true"><Icones.copiar /><span>{F.COPIAR_TEXTO}</span></button>
                <button type="button" className="btn big" aria-disabled="true"><Icones.baixar /><span>{F.BAIXAR_MD}</span></button>
              </>
            ) : p.copia === 'falhou' ? (
              <>
                <button type="button" className="btn big pri" id="pi-baixar" onClick={fazerBaixar}><Icones.baixar /><span>{rotBaixar}</span></button>
                <button type="button" className="btn big" id="pi-sel" onClick={selecionar}><span>{F.SELECIONAR_PREVIA}</span></button>
                <button type="button" className="btn big" id="pi-copiar" onClick={() => p.onCopiar(r.copia.texto)}><Icones.copiar /><span>{F.TENTAR_COPIAR_DE_NOVO}</span></button>
              </>
            ) : (
              <>
                <button type="button" className="btn big pri" id="pi-copiar" onClick={() => p.onCopiar(r.copia.texto)}><Icones.copiar /><span>{p.copia === 'copiado' ? F.COPIAR_DE_NOVO : F.COPIAR_TEXTO}</span></button>
                <button type="button" className="btn big" id="pi-baixar" onClick={fazerBaixar}><Icones.baixar /><span>{rotBaixar}</span></button>
              </>
            )}
            <button type="button" className="btn big pi-fechar" id="pi-fechar" onClick={p.onFechar}>{F.FECHAR}</button>
          </div>
        </div>
      </footer>
      {info && <PainelDoInfo id={info} />}
    </dialog>
  )
}
