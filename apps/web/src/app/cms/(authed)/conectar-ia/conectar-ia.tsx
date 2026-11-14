'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, CircleCheck, Copy, ExternalLink, Hand, Info, Lock, TriangleAlert } from 'lucide-react'
import { RECURSO } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { FRASES_CONECTAR as F, PASSOS_POR_IA } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'
import type { IaDaPagina } from '@/lib/youtube/observatorio/acesso-ia/estado-da-pessoa'

const IAS: readonly IaDaPagina[] = ['chatgpt', 'claude']
const CHAVE = 'conectar-ia:aba'
const FID = 'cia'
type Copia = 'idle' | 'ok' | 'fail'

const ico = { 'aria-hidden': true, size: 20, strokeWidth: 1.8 } as const

export function ConectarIa({ ia, bloqueadas }: { ia: IaDaPagina; bloqueadas: IaDaPagina[] }) {
  const [aba, setAba] = useState<IaDaPagina>(ia)
  const [copia, setCopia] = useState<Copia>('idle')
  const pre = useRef<HTMLPreElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})

  // 3º critério da aba: última escolha no aparelho, só quando a URL não traz ?ia=
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('ia')) return
      const v = window.localStorage.getItem(CHAVE)
      if ((v === 'chatgpt' || v === 'claude') && !bloqueadas.includes(v)) setAba(v)
    } catch {
      /* armazenamento indisponível: fica na aba recebida */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function escolher(k: IaDaPagina, foco = false) {
    setAba(k)
    try { window.localStorage.setItem(CHAVE, k) } catch { /* ignora */ }
    try { window.history.replaceState(null, '', `${window.location.pathname}?ia=${k}`) } catch { /* ignora */ }
    if (foco) tabs.current[k]?.focus()
  }

  function setas(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    escolher(aba === 'chatgpt' ? 'claude' : 'chatgpt', true)
  }

  async function copiar() {
    if (timer.current) clearTimeout(timer.current)
    try {
      if (!navigator.clipboard) throw new Error('sem clipboard')
      await navigator.clipboard.writeText(RECURSO)
      setCopia('ok')
      timer.current = setTimeout(() => setCopia('idle'), 3000)
    } catch {
      setCopia('fail')
      const el = pre.current
      if (el) {
        const sel = window.getSelection()
        const r = document.createRange()
        r.selectNodeContents(el)
        sel?.removeAllRanges()
        sel?.addRange(r)
      }
    }
  }

  return (
    <>
      <section className="step1">
        <ol className="steps one">
          <li>
            <div>
              <p className="lbl" id={`${FID}-s1`}>{F.copieEndereco}</p>
              <div className="urlrow">
                <pre ref={pre} className={`url${copia === 'fail' ? ' sel' : ''}`} tabIndex={0} role="group" aria-labelledby={`${FID}-s1`}>{RECURSO}</pre>
                {copia === 'ok' ? (
                  <button className="btn go copy ok" type="button" onClick={copiar}><Check {...ico} />{F.copiado}</button>
                ) : (
                  <button className="btn go copy" type="button" aria-label={F.copiarAria} onClick={copiar}><Copy {...ico} />{F.copiar}</button>
                )}
              </div>
              <div className={`live${copia === 'ok' ? ' good' : ''}`} role="status" aria-live="polite">
                {copia === 'ok' ? <><CircleCheck {...ico} size={16} />{F.copiadoStatus}</> : null}
              </div>
              {copia === 'fail' ? <p className="live bad" role="alert"><TriangleAlert {...ico} size={16} /><span><b>Não deu para copiar.</b> Toque no endereço, segure e escolha Copiar.</span></p> : null}
            </div>
          </li>
        </ol>
      </section>
      <h2>{F.naSuaIa}</h2>
      <div className="tabs" role="tablist" aria-label={F.escolhaIa}>
        {IAS.map((k) => (
          <button
            key={k} ref={(el) => { tabs.current[k] = el }} className="tab" role="tab" type="button" id={`${FID}-t-${k}`}
            aria-controls={`${FID}-p-${k}`} aria-selected={aba === k} tabIndex={aba === k ? 0 : -1}
            onClick={() => escolher(k)} onKeyDown={setas}
          >{PASSOS_POR_IA[k].nome}</button>
        ))}
      </div>
      {IAS.map((k) => <Painel key={k} k={k} ativo={aba === k} bloqueada={bloqueadas.includes(k)} />)}
    </>
  )
}

function Painel({ k, ativo, bloqueada }: { k: IaDaPagina; ativo: boolean; bloqueada: boolean }) {
  const d = PASSOS_POR_IA[k]
  return (
    <div className="panel" role="tabpanel" id={`${FID}-p-${k}`} aria-labelledby={`${FID}-t-${k}`} hidden={!ativo}>
      {bloqueada ? (
        <div className="neutral" role="note">
          <Hand {...ico} />
          <div><strong>{F.pausadoTitulo}</strong><span>{F.pausadoTexto}</span></div>
        </div>
      ) : (
        <>
          <ol className="steps" start={2}>
            {d.passos.map((texto, i) => (
              <li key={texto}>
                <div>
                  <p>{texto}</p>
                  {i === 0 ? (
                    <a className="btn no" href={d.href} target="_blank" rel="noopener noreferrer" aria-label={`${d.abrir} (abre em nova aba)`}>{d.abrir} <ExternalLink {...ico} /></a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <div className="after">
            <p className="msg">{F.depoisPasso5}</p>
            <div className="alert" role="note">
              <TriangleAlert {...ico} />
              <div><strong>{F.avisoAprove(d.nome)}</strong><span>{F.avisoLinkAlheio}</span></div>
            </div>
            <ul className="risk">
              <li><Check {...ico} size={16} /><span>{F.riscoPergunte(d.nome)}</span></li>
              <li><Lock {...ico} size={16} /><span>{F.riscoSoLe}</span></li>
            </ul>
          </div>
          <details className="dica">
            <summary><Info {...ico} />{F.naoAchou}</summary>
            <p>{F.naoAchouTexto}</p>
          </details>
        </>
      )}
    </div>
  )
}
