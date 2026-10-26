/**
 * Manutenção M5, Tarefa 5 (mockup 19, `.m-seg.arq`): o trecho "no arquivo" (ou "antes da coleta") dentro de um gráfico em SVG. Fundo `--sunk`, contorno sólido `--dim`,
 * a caixa de arquivo e o rótulo repetido na borda esquerda do trecho. `nada_saiu` (e todo estado sem forma de trecho) não desenha nada: a tela de hoje não muda.
 * Componente puro de SVG, sem hook.
 */
import type { ReactElement } from 'react'
import { frasePeca1, type EstadoPeca1 } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

export function TrechoDoEixo({ estado, x, y, w, h, quem = 'edita' }: { estado: EstadoPeca1; x: number; y: number; w: number; h: number; quem?: 'edita' | 'so_le' }): ReactElement | null {
  const f = frasePeca1(estado, quem)
  if ((f.forma !== 'arquivo' && f.forma !== 'pontilhado' && f.forma !== 'hachura') || f.texto === '' || w <= 0) return null
  // id da área de recorte do texto: o texto de 12 px não passa da borda do trecho (num trecho estreito ele vazaria sobre as barras vizinhas); a frase inteira fica no <title>
  const id = `obs-ea-${Math.round(x)}-${Math.round(y)}-${Math.round(w)}`
  return (
    <g className={`obs-ea-trecho ${f.forma}`} data-forma={f.forma}>
      <title>{f.texto}</title>
      <clipPath id={id}><rect x={x} y={y} width={w} height={h} rx={6} /></clipPath>
      <rect className={`obs-ea-rect ${f.forma}`} x={x} y={y} width={w} height={h} rx={6} />
      {f.forma === 'hachura'
        ? <g clipPath={`url(#${id})`} aria-hidden="true">{Array.from({ length: Math.ceil((w + h) / 10) }, (_, i) => <line key={i} className="obs-ea-hachura-linha" x1={x + i * 10} y1={y + h} x2={x + i * 10 + h} y2={y} />)}</g>
        : null}
      {f.forma === 'arquivo'
        ? <g className="obs-ea-ico" transform={`translate(${x + 8} ${y + 8})`} aria-hidden="true"><rect x="2" y="3" width="12" height="3.5" rx="1" /><path d="M3 6.5V13h10V6.5M6.5 9.5h3" /></g>
        : f.forma === 'pontilhado'
          ? <circle className="obs-ea-ico" cx={x + 16} cy={y + 16} r={6.2} strokeDasharray="2.4 2.2" aria-hidden="true" />
          : null}
      <text className="obs-ea-txt" x={x + (f.forma === 'hachura' ? 10 : 30)} y={y + 20} clipPath={`url(#${id})`}>{f.texto}</text>
    </g>
  )
}
