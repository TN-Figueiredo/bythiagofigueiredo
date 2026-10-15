/**
 * O texto do ⓘ "Como ler esta tabela" (Número a número), fora do JSX: a tela o pinta (`numero-a-numero.tsx`) e o pacote "Perguntar a uma IA"
 * o importa (E17 degrau 1), então há UMA cópia. Sem `'use client'` e sem React: o servidor lê como texto.
 * Cada item é `<b>{termo}</b>{depois}{frase}`; `depois` carrega o separador (nos cinco itens comuns os dois-pontos ficam dentro de `termo`).
 */
import { LIMITE_IGUAL, type ParView } from './par-model'

export interface DefinicaoDaTabela { termo: string; depois: string; frase: string }

export const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t)
export function listar(xs: readonly string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

/** `comprimidas`: os nomes das linhas cuja régua está em escala comprimida (a tela sabe; o modelo do par não). */
export function definicoesDaTabela(par: Pick<ParView, 'conjunto' | 'fora'> & { comprimidas: readonly string[] }): DefinicaoDaTabela[] {
  const { comprimidas } = par
  const percentual = Math.round((LIMITE_IGUAL - 1) * 100)
  const itens: DefinicaoDaTabela[] = [
    { termo: 'Os lados:', depois: ' ', frase: 'laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.' },
    {
      termo: 'Régua:', depois: ' ',
      frase: `um traço por canal ${par.conjunto.tipo === 'nicho' ? `de ${par.conjunto.label}` : 'do site'}, do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). `
        + (comprimidas.length ? `Escala comprimida em ${listar(comprimidas.map(minuscula))}, para o maior canal não apagar os pequenos; ` : '')
        + (comprimidas.length ? 'as demais, em escala linear.' : 'Escala linear em todas as réguas.')
        + ' Lado sem dado não ganha traço, e a linha diz de quem falta.',
    },
    { termo: 'Barras finas:', depois: ' ', frase: 'nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.' },
    { termo: 'Relação:', depois: ' ', frase: `a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que ${percentual}% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido.` },
    { termo: 'Dias desde o último vídeo:', depois: ' ', frase: 'sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).' },
    { termo: 'Não medido', depois: ' (hachura): ', frase: 'o dado não existe para esse lado; não é zero.' },
  ]
  if (par.fora.length) itens.push({ termo: 'Ficaram de fora', depois: ' ', frase: `porque nenhum dos dois tem o dado: ${listar(par.fora.map(minuscula))}.` })
  return itens
}
