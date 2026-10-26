'use client'
// Seção "Em teste agora" (M7 T7): 1 cartão = largura cheia; 2 a 4 = grade de 2 colunas a partir de 1024 px;
// 5 ou mais = 4 visíveis + "Ver todos (n)"; 0 = a seção some.
import { useState, type ReactElement } from 'react'
import type { CartaoEmTeste } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { FaixaComVoceProps } from './faixa-com-voce'
import { CartaoEmTesteView } from './cartao-em-teste'
import './pagina-lab.css'

export interface SecaoEmTesteProps {
  cartoes: CartaoEmTeste[]
  onAbrirPainel: FaixaComVoceProps['onAbrirPainel']
  onAbrirDia14: FaixaComVoceProps['onAbrirDia14']
}

const VISIVEIS = 4

export function SecaoEmTeste({ cartoes, onAbrirPainel, onAbrirDia14 }: SecaoEmTesteProps): ReactElement | null {
  const [todos, setTodos] = useState(false)
  if (cartoes.length === 0) return null
  const n = cartoes.length
  const mostrados = todos ? cartoes : cartoes.slice(0, VISIVEIS)
  return (
    <section className="lab-pg mt-9" aria-label="Em teste agora">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-[18px] font-semibold leading-[1.3]" style={{ fontFamily: 'Georgia, serif' }}>Em teste agora</h2>
        <span className="text-xs text-cms-text-muted tabular-nums sm:ml-auto">{n} {n === 1 ? 'teste' : 'testes'}</span>
      </div>
      <div className={n === 1 ? 'grid grid-cols-1 gap-3.5' : 'grid grid-cols-1 gap-3.5 lg:grid-cols-2'}>
        {mostrados.map((c, k) => (
          <CartaoEmTesteView
            key={c.tipo === 'lab' ? c.card.id : `studio-${c.linha.videoId}-${k}`}
            cartao={c} unico={n === 1}
            onAbrirPainel={onAbrirPainel} onAbrirDia14={onAbrirDia14}
          />
        ))}
      </div>
      {n > VISIVEIS && !todos ? (
        <div className="mt-3">
          <button type="button" className="lab-btn ghost lab-alvo" onClick={() => setTodos(true)}>Ver todos ({n})</button>
        </div>
      ) : null}
    </section>
  )
}
