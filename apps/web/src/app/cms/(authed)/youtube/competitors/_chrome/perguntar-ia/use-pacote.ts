'use client'
// A5 · E17 degrau 1, Tarefa 10: a máquina de estados do botão. `fechado → carregando → pronto | erro` e, à parte, a da cópia
// `ocioso → copiado | falhou`. Cada abertura e cada "Tentar de novo" ganha um número de pedido crescente e só a resposta do número
// corrente é aceita (fechar e reabrir com a primeira ainda no ar não mostra o pacote velho). A ação chega por prop; nada daqui importa a ação.
import { useCallback, useRef, useState } from 'react'
import type { PedidoDePacote } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { PacoteSerializado, RespostaDePacote } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

export type FaseDoPacote = { fase: 'fechado' } | { fase: 'carregando' } | { fase: 'pronto'; pacote: PacoteSerializado } | { fase: 'erro' }
export type FaseDaCopia = 'ocioso' | 'copiado' | 'falhou'

export interface PacoteHook {
  estado: FaseDoPacote
  copia: FaseDaCopia
  pergunta: string
  setPergunta: (p: string) => void
  abrir: () => void
  fechar: () => void
  tentarDeNovo: () => void
  copiar: (texto: string) => void
}

export function usePacote({ tela, id, onGerar }: { tela: TelaId; id?: string; onGerar: (p: PedidoDePacote) => Promise<RespostaDePacote> }): PacoteHook {
  const [estado, setEstado] = useState<FaseDoPacote>({ fase: 'fechado' })
  const [copia, setCopia] = useState<FaseDaCopia>('ocioso')
  const [pergunta, setPerguntaEstado] = useState('')
  const pedido = useRef(0)
  // a ação pode mudar de identidade a cada pintura da página; ela nunca dispara um pedido sozinha
  const gerar = useRef(onGerar)
  gerar.current = onGerar
  const alvo = useRef({ tela, id })
  alvo.current = { tela, id }

  const pedir = useCallback(() => {
    const n = ++pedido.current
    setEstado({ fase: 'carregando' })
    setCopia('ocioso')
    const req: PedidoDePacote = { tela: alvo.current.tela, ...(alvo.current.id !== undefined ? { id: alvo.current.id } : {}), consulta: window.location.search }
    let promessa: Promise<RespostaDePacote>
    try { promessa = gerar.current(req) } catch { promessa = Promise.reject(new Error('onGerar lançou')) }
    promessa.then(
      (r) => { if (n === pedido.current) setEstado(r.ok ? { fase: 'pronto', pacote: r.pacote } : { fase: 'erro' }) },
      () => { if (n === pedido.current) setEstado({ fase: 'erro' }) },
    )
  }, [])

  const abrir = useCallback(() => { pedir() }, [pedir])
  const fechar = useCallback(() => { pedido.current++; setEstado({ fase: 'fechado' }); setCopia('ocioso') }, [])
  const setPergunta = useCallback((p: string) => { setPerguntaEstado(p); setCopia('ocioso') }, [])
  const copiar = useCallback((texto: string) => {
    const ok = () => setCopia('copiado')
    const falha = () => setCopia('falhou')
    try {
      const c = typeof navigator === 'undefined' ? undefined : navigator.clipboard
      if (c && typeof c.writeText === 'function') c.writeText(texto).then(ok, falha)
      else falha()
    } catch { falha() }
  }, [])

  return { estado, copia, pergunta, setPergunta, abrir, fechar, tentarDeNovo: pedir, copiar }
}
