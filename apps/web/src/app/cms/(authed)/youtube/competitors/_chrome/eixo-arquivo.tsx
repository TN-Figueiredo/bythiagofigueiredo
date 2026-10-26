/**
 * Manutenção M5, Tarefa 5 (mockup 19, `.m-seg.arq`): o trecho "no arquivo" (ou "antes da coleta") dentro de um gráfico em SVG. Fundo `--sunk`, contorno sólido `--dim`,
 * a caixa de arquivo e o rótulo repetido na borda esquerda do trecho. `nada_saiu` (e todo estado sem forma de trecho) não desenha nada: a tela de hoje não muda.
 * Componente puro de SVG, sem hook.
 */
import type { ReactElement } from 'react'
import { frasePeca1, type EstadoPeca1 } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

export function TrechoDoEixo({ estado, x, y, w, h, quem = 'edita' }: { estado: EstadoPeca1; x: number; y: number; w: number; h: number; quem?: 'edita' | 'so_le' }): ReactElement | null {
  const f = frasePeca1(estado, quem)
  if ((f.forma !== 'arquivo' && f.forma !== 'pontilhado') || f.texto === '' || w <= 0) return null
  return (
    <g className={`obs-ea-trecho ${f.forma}`} data-forma={f.forma}>
      <rect className={`obs-ea-rect ${f.forma}`} x={x} y={y} width={w} height={h} rx={6} />
      {f.forma === 'arquivo'
        ? <g className="obs-ea-ico" transform={`translate(${x + 8} ${y + 8})`} aria-hidden="true"><rect x="2" y="3" width="12" height="3.5" rx="1" /><path d="M3 6.5V13h10V6.5M6.5 9.5h3" /></g>
        : <circle className="obs-ea-ico" cx={x + 16} cy={y + 16} r={6.2} strokeDasharray="2.4 2.2" aria-hidden="true" />}
      <text className="obs-ea-txt" x={x + 30} y={y + 20}>{f.texto}</text>
    </g>
  )
}
