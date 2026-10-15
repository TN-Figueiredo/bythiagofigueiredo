'use client'
/**
 * O seletor de período da origem das views (plano E5b, Tarefa 11). Recebe só texto e nós já montados no servidor (`Origem`): nada de dado
 * privado cru, nenhum leitor. A troca não navega: é botão com `aria-pressed` dentro de `role="group"`. `?origem=` vence; sem ele vale o que ficou
 * neste navegador (`localStorage`, sempre em try/catch, só depois do primeiro render para servidor e cliente concordarem). Valor que não existe nesta
 * tela é ignorado. Traz também o "Tentar de novo" do bloco de erro.
 */
import { useLayoutEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHAVE_ORIGEM, PARAM_ORIGEM } from './origem-constantes'
import './origem.css'

export interface OpcaoOrigem { id: string; rotulo: string }

function lembrado(validos: readonly string[]): string | null {
  try {
    const x = window.localStorage.getItem(CHAVE_ORIGEM)
    return x != null && validos.includes(x) ? x : null
  } catch { return null }
}

function guardar(p: string, padrao: string): void {
  try {
    if (p === padrao) window.localStorage.removeItem(CHAVE_ORIGEM)
    else window.localStorage.setItem(CHAVE_ORIGEM, p)
  } catch { /* sem armazenamento a tela fica no padrão */ }
}

export function OrigemPeriodos({ opcoes, conteudos, padrao, lembranca, dica }: {
  opcoes: readonly OpcaoOrigem[]; conteudos: Readonly<Record<string, ReactNode>>; padrao: string; lembranca: string; dica: string
}) {
  const params = useSearchParams()
  const doUrl = params?.get(PARAM_ORIGEM) ?? null
  const ids = opcoes.map(o => o.id)
  const [periodo, setPeriodo] = useState<string>(doUrl != null && ids.includes(doUrl) ? doUrl : padrao)
  const [salvo, setSalvo] = useState(false)

  useLayoutEffect(() => {
    if (doUrl != null && ids.includes(doUrl)) { setPeriodo(doUrl); return }
    const l = lembrado(ids)
    if (l != null) { setPeriodo(l); setSalvo(l !== padrao) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doUrl, padrao, ids.join('|')])

  const escolher = (p: string) => { setPeriodo(p); setSalvo(p !== padrao); guardar(p, padrao) }

  return (
    <div className="ov-novo">
      <div className="ov-bar">
        <div className="ov-pes" role="group" aria-label="Período">
          <span className="ov-pl" aria-hidden="true">Período:</span>
          {opcoes.map(o => (
            <button key={o.id} type="button" className="ov-pe" aria-pressed={o.id === periodo} data-periodo={o.id} onClick={() => escolher(o.id)}>{o.rotulo}</button>
          ))}
        </div>
        {salvo && periodo !== padrao ? (
          // mesmo conceito, mesmo nome do % assistido da A4: "Salvo neste navegador" e "Voltar ao padrão (rótulo do padrão)"
          <p className="ov-lem">{lembranca} <button type="button" className="ov-lk" onClick={() => escolher(padrao)}>Voltar ao padrão ({opcoes.find(o => o.id === padrao)?.rotulo ?? padrao})</button></p>
        ) : null}
      </div>
      {dica ? <p className="ov-lem">{dica}</p> : null}
      <div aria-live="polite" data-periodo-atual={periodo}>{conteudos[periodo] ?? conteudos[padrao] ?? null}</div>
    </div>
  )
}

/** "Tentar de novo" do bloco de erro: pede os dados de novo ao servidor, uma vez por clique. */
export function TentarDeNovo() {
  const router = useRouter()
  // a transição termina quando o servidor responde, com sucesso ou com nova falha: o botão nunca fica preso (Yannis I2)
  const [tentando, iniciar] = useTransition()
  return (
    <>
      <button type="button" className="ov-pe ov-retry" disabled={tentando} onClick={() => iniciar(() => router.refresh())}>Tentar de novo</button>
      {tentando ? <span role="status" className="ov-lem">Tentando de novo…</span> : null}
    </>
  )
}
