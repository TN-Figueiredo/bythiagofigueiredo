/**
 * Manutenção M5, Tarefa 5 (mockup 19, peça 1): as formas da ausência por arquivo. Puro SVG/HTML, sem hook e sem diretiva: serve a server e a client component.
 * A caixa de arquivo (no arquivo) e o meio-círculo ◐ (em leitura mensal) são os dois ícones novos, desenhados como em `m19.js`; o pontilhado e o zero reusam as formas
 * que já existiam (círculo tracejado e caixa vazada). Cor nunca é o único sinal: toda forma leva o texto ao lado.
 */
import type { ReactElement } from 'react'
import type { FormaPeca1 } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'
import type { Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

/** O desenho de cada forma de estado, UM só para a página Arquivo e para o aviso do banco (Naksu N2: o octógono era desenhado de dois jeitos, com X e com "!").
 *  O octógono leva "!" (mockup 19, m19.js). Quem usa põe o `<svg>` em volta (viewBox 0 0 16 16, traço 1,5). */
export const DESENHO_DA_FORMA: Partial<Record<Forma, ReactElement>> = {
  visto: <><circle cx="8" cy="8" r="6.2" /><path d="M5.2 8.3 7.2 10.3 10.9 6" /></>,
  triangulo: <><path d="M8 2.2 14.4 13.4H1.6Z" /><path d="M8 6.6v3.2M8 11.5v.1" /></>,
  octogono: <><path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2L1.8 10.8V5.2z" /><path d="M8 4.8v3.8M8 11v.1" /></>,
  pontilhado: <circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" />,
}

const CAMINHOS = {
  arquivo: <><rect x="2" y="3" width="12" height="3.5" rx="1" /><path d="M3 6.5V13h10V6.5M6.5 9.5h3" /></>,
  meio: <><circle cx="8" cy="8" r="6.2" style={{ strokeWidth: 2 }} /><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" style={{ fill: 'currentColor', stroke: 'none' }} /></>,
  pontilhado: <circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" />,
} as const

const ROTULO = { arquivo: 'no arquivo', meio: 'em leitura mensal', pontilhado: 'antes da coleta' } as const

/** `decorativo` (o padrão): o texto está ao lado e já diz o estado, então o leitor de tela pula o ícone. Só o ícone sozinho (`decorativo={false}`) leva `role="img"` e rótulo. */
export function IconeDeArquivo({ qual, tamanho = 16, decorativo = true }: { qual: keyof typeof CAMINHOS; tamanho?: number; decorativo?: boolean }): ReactElement {
  const a11y = decorativo ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': ROTULO[qual] }
  return (
    <svg className={`obs-fa-ico obs-fa-${qual}`} viewBox="0 0 16 16" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" focusable="false" {...a11y}>{CAMINHOS[qual]}</svg>
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
