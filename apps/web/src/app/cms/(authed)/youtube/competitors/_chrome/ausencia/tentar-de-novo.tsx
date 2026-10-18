'use client'
/**
 * "Tentar de novo" com três estados (decisão 75). O componente fica no MESMO lugar da árvore nos dois ramos (falhou e ok): é isso que
 * preserva o estado do cliente através do `router.refresh()`. Um botão por bloco, fora da pastilha; `aria-disabled`, não `disabled`
 * (o foco fica no botão). Um único `role="status"` por bloco; nenhum `role="alert"`.
 */
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import './ausencia.css'
import { proximaFase, type Fase } from './tentativa'

export function BlocoComTentativa(p: { falhou: boolean; fraseFalha: string; children: ReactNode; soPastilha?: boolean }) {
  const { falhou, fraseFalha, children, soPastilha } = p
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fase, setFase] = useState<Fase>('parado')
  const conteudo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fase !== 'tentando' || isPending) return
    const novo = proximaFase(fase, falhou ? 'terminou_falhou' : 'terminou_lido')
    setFase(novo)
    if (novo === 'lido') {
      const alvo = conteudo.current?.querySelector<HTMLElement>('[data-valor]')
      if (alvo) { alvo.tabIndex = -1; alvo.focus() }
    }
  }, [fase, isPending, falhou])

  function tentar() {
    if (fase === 'tentando' || isPending) return
    setFase(proximaFase(fase, 'clicou'))
    startTransition(async () => { await router.refresh() })
  }

  let extra: ReactNode = null
  if (falhou) {
    if (soPastilha) {
      extra = <p className="obs-au-frase">{fraseFalha}</p>
    } else {
      const tentando = fase === 'tentando'
      const frase = tentando ? 'Lendo as medidas de novo…' : fase === 'falhou_de_novo' ? 'A leitura falhou de novo. Tente mais uma vez.' : fraseFalha
      extra = (
        <div className="obs-au-retry-row">
          <p role="status">{frase}</p>
          <button type="button" className="obs-au-retry" aria-disabled={tentando ? 'true' : undefined} aria-busy={tentando ? 'true' : undefined} onClick={tentar}>
            {tentando ? 'Tentando…' : 'Tentar de novo'}
          </button>
        </div>
      )
    }
  } else if (fase === 'lido') {
    extra = <p role="status" aria-live="polite" className="obs-au-frase">Medidas lidas agora.</p>
  }

  return (
    <div className="obs-au-bloco">
      <div ref={conteudo}>{children}</div>
      {extra}
    </div>
  )
}
