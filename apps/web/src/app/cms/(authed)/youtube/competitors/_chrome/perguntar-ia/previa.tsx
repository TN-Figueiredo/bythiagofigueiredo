'use client'
// A5 · E17 degrau 1, Tarefa 10: a prévia do texto (início, dobra, fim da seção 7 e 8, dobra, pergunta), em bloco de código com cabeçalho.
// As fatias e as contagens das dobras vêm de `resumir().previa`: visível + dobras = total.
import { forwardRef, type ReactNode } from 'react'
import type { ResumoDoDialogo } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import * as F from './frases-do-dialogo'

const MARCAS: Array<[RegExp, string]> = [[/(não medido)/g, 'pi-nm'], [/(zero medido)/g, 'pi-zr'], [/(NÃO incluído)/g, 'pi-ni'], [/(privado do canal)/g, 'pi-pv']]

/** Marca, dentro da linha, as palavras que o produto sempre desenha do mesmo jeito (a mesma regra do mockup). */
function decorar(linha: string): ReactNode[] {
  let partes: Array<string | { t: string; c: string }> = [linha]
  for (const [re, c] of MARCAS) {
    partes = partes.flatMap((p) => (typeof p !== 'string' ? [p] : p.split(re).map((x, i) => (i % 2 ? { t: x, c } : x))))
  }
  return partes.map((p, i) => (typeof p === 'string' ? p : <span key={i} className={p.c}>{p.t}</span>))
}
function classeDaLinha(l: string): string {
  if (l.startsWith('# ')) return 'h1'
  if (l.startsWith('## ')) return 'h'
  if (l.startsWith('### ')) return 'h3'
  if (l.startsWith('AVISO:')) return 'av'
  if (l.startsWith('> Não incluído') || l.includes('NÃO incluído')) return 'nao'
  if (l.startsWith('│')) return 'tc'
  return ''
}

function Bloco({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  return <>{linhas.map((l, i) => <span key={i} className={`pi-l ${classeDaLinha(l)}`.trim()}>{decorar(l)}{i < linhas.length - 1 ? '\n' : ''}</span>)}</>
}

function Dobra({ n, descricao }: { n: number; descricao: string }) {
  return (
    <span className="pi-dobra" aria-label={F.dobraAria(n)}>
      <span aria-hidden="true">⋯</span> {F.dobra(n, descricao)}<span className="pi-dobra-s">{F.VAO_NA_COPIA}</span>
    </span>
  )
}

export const Previa = forwardRef<HTMLPreElement, { arquivo: string; resumo: ResumoDoDialogo }>(function Previa({ arquivo, resumo }, ref) {
  const p = resumo.previa
  return (
    <figure className="pi-cod">
      <figcaption className="pi-cod-h"><span className="pi-cod-n">{arquivo}</span><span className="pi-cod-m">{F.previaMeta(resumo.copia.caracteres)}</span></figcaption>
      <pre className="pi-cod-b" id="pi-pre" ref={ref} tabIndex={0} role="region" aria-label={F.PREVIA_ARIA}>
        <code>
          <Bloco texto={p.inicio} />
          {p.dobra1 > 0 && <Dobra n={p.dobra1} descricao={F.DOBRA_1} />}
          <Bloco texto={p.fim7e8} />
          {p.dobra2 > 0 && <Dobra n={p.dobra2} descricao={F.DOBRA_2} />}
          <Bloco texto={p.fim9} />
        </code>
      </pre>
    </figure>
  )
})
