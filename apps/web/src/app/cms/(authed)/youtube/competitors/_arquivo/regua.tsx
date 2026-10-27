/**
 * Manutenção M5, Tarefa 9 (mockup 19, m19.js): as formas do Arquivo e a régua de etapas. Puro (sem hook, sem diretiva): serve a server e a client component.
 * Cor nunca é o único sinal: toda forma leva o texto ao lado, e a régua inteira leva um rótulo com a sequência.
 */
import type { ReactElement } from 'react'
import type { Etapa, Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { DESENHO_DA_FORMA, IconeDeArquivo } from '../_chrome/formas-arquivo'

const NOME: Record<Forma, string> = {
  visto: 'feito', pontilhado: 'ainda não', pontilhado_ambar: 'ainda não, passou do prazo', triangulo: 'atenção', octogono: 'problema', hachura: 'não medido', arquivo: 'no arquivo', zero: 'zero', barra: 'em andamento',
}
export const nomeDaForma = (f: Forma): string => NOME[f]

const COR: Record<Forma, string> = { visto: 'arq-ok', pontilhado: 'arq-pt', pontilhado_ambar: 'arq-am', triangulo: 'arq-am', octogono: 'arq-vm', hachura: 'arq-nm', arquivo: 'arq-ar', zero: 'arq-zr', barra: 'arq-pt' }

/** O desenho da forma (16 px, ou 24 px com `grande`). Decorativo: o texto vem ao lado. */
export function FormaIcone({ forma, grande = false }: { forma: Forma; grande?: boolean }): ReactElement {
  const t = grande ? 24 : 16
  const base = { className: `arq-ico ${COR[forma]}`, viewBox: '0 0 16 16', width: t, height: t, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const, focusable: 'false' as const }
  switch (forma) {
    case 'visto': case 'pontilhado': case 'triangulo': case 'octogono': return <svg {...base}>{DESENHO_DA_FORMA[forma]}</svg>
    case 'pontilhado_ambar': return <svg {...base}><circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" /><path d="M8 4.8V8l2 1.4" /></svg>
    case 'hachura': return <span className={`arq-hach${grande ? ' g' : ''}`} aria-hidden="true" />
    case 'arquivo': return <IconeDeArquivo qual="arquivo" tamanho={t} />
    case 'zero': return <span className={`arq-zero${grande ? ' g' : ''}`} aria-hidden="true">0</span>
    case 'barra': return <svg {...base}><rect x="1.8" y="5.6" width="12.4" height="4.8" rx="2.4" /><path d="M2.6 8h5" /></svg>
  }
}

/** Uma frase com a forma ao lado. */
export function FraseComForma({ forma, children, className = '' }: { forma: Forma; children: React.ReactNode; className?: string }): ReactElement {
  return <span className={`arq-fr-forma ${className}`.trim()} data-forma={forma}><FormaIcone forma={forma} /><span>{children}</span></span>
}

/** A régua de etapas: cada etapa é forma + rótulo (no celular, o rótulo curto). Uma imagem para o leitor de tela, com a sequência dita. */
export function Regua({ etapas, rotulo }: { etapas: Etapa[]; rotulo: string }): ReactElement {
  const dita = etapas.map(e => `${e.rotulo}: ${nomeDaForma(e.forma)}`).join('; ')
  return (
    <div className="arq-reg" role="img" aria-label={`${rotulo}. ${dita}`}>
      {etapas.map((e, i) => (
        <span key={i} className={`arq-et${e.forma === 'pontilhado' || e.forma === 'pontilhado_ambar' ? ' pend' : ''}${e.forma === 'octogono' || e.forma === 'triangulo' ? ' prob' : ''}`} data-forma={e.forma}>
          <FormaIcone forma={e.forma} grande />
          <span className="arq-et-l"><span className="l">{e.rotulo}</span><span className="s">{e.curto}</span></span>
        </span>
      ))}
    </div>
  )
}
