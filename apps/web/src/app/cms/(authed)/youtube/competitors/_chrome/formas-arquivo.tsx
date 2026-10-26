/**
 * Manutenção M5, Tarefa 5 (mockup 19, peça 1): as formas da ausência por arquivo. Puro SVG/HTML, sem hook e sem diretiva: serve a server e a client component.
 * A caixa de arquivo (no arquivo) e o meio-círculo ◐ (em leitura mensal) são os dois ícones novos, desenhados como em `m19.js`; o pontilhado e o zero reusam as formas
 * que já existiam (círculo tracejado e caixa vazada). Cor nunca é o único sinal: toda forma leva o texto ao lado.
 */
import type { ReactElement } from 'react'
import type { FormaPeca1 } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

const CAMINHOS = {
  arquivo: <><rect x="2" y="3" width="12" height="3.5" rx="1" /><path d="M3 6.5V13h10V6.5M6.5 9.5h3" /></>,
  meio: <><circle cx="8" cy="8" r="6.2" style={{ strokeWidth: 2 }} /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" style={{ fill: 'currentColor', stroke: 'none' }} /></>,
  pontilhado: <circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" />,
} as const

const ROTULO = { arquivo: 'no arquivo', meio: 'em leitura mensal', pontilhado: 'antes da coleta' } as const

export function IconeDeArquivo({ qual, tamanho = 16 }: { qual: keyof typeof CAMINHOS; tamanho?: number }): ReactElement {
  return (
    <svg className={`obs-fa-ico obs-fa-${qual}`} viewBox="0 0 16 16" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={ROTULO[qual]} focusable="false">{CAMINHOS[qual]}</svg>
  )
}

/** A frase de uma ausência de peça 1 com a forma ao lado. `nenhuma` não desenha nada (a tela de hoje). */
export function AusenciaPeca1({ forma, texto }: { forma: FormaPeca1; texto: string }): ReactElement | null {
  if (forma === 'nenhuma' || texto === '') return null
  if (forma === 'hachura') return <span className="obs-ch-nm" data-forma="hachura">{texto}</span>
  if (forma === 'zero') return <span className="obs-fa obs-fa-zr" data-forma="zero"><span className="obs-ch-zero" aria-hidden="true">0</span>{texto}</span>
  return (
    <span className={`obs-fa obs-fa-${forma}`} data-forma={forma}>
      <IconeDeArquivo qual={forma === 'arquivo' ? 'arquivo' : 'pontilhado'} />
      <span>{texto}</span>
    </span>
  )
}
