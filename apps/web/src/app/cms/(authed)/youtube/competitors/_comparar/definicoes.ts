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

/** O ⓘ das linhas novas (A5 E5a T7). Todos dizem de onde vem o número. */
export function definicoesDasMedidas(): DefinicaoDaTabela[] {
  const ORIGEM = ' Cálculo do Observatório sobre dados públicos do YouTube.'
  return [
    { termo: 'Direção:', depois: ' ', frase: `para onde o canal vai. A leitura principal é uma só por par; as de apoio servem para conferir, não são vereditos. Dentro de ±10% é "estável".${ORIGEM}` },
    { termo: 'Três leituras:', depois: ' ', frase: `canal inteiro (views ganhas em 28 dias contra os 28 anteriores), vídeos novos com as views de hoje e vídeos novos na mesma idade. Descer na segunda pode ser só idade.${ORIGEM}` },
    { termo: 'Praticamente igual:', depois: ' ', frase: `diferença menor que 10% não é dita como maior.${ORIGEM}` },
    { termo: 'Longos publicados:', depois: ' ', frase: `contagem dos últimos 90 dias contra os 90 anteriores. É contagem, não frequência.${ORIGEM}` },
    { termo: 'Nichos diferentes:', depois: ' ', frase: `a régua ordena cada canal dentro do próprio nicho; não diz quem é melhor.${ORIGEM}` },
    { termo: 'Estado do canal:', depois: ' ', frase: `ativo, parado, em queda sustentada, pausado ou fora do YouTube. "Fora do YouTube" mostra "até dd/mm" nos números.${ORIGEM}` },
    { termo: 'Acerto:', depois: ' ', frase: `vídeos longos contra a mediana do próprio canal; mede regularidade, não tamanho. A porcentagem só aparece com 10 vídeos ou mais.${ORIGEM}` },
    { termo: 'Reação do público:', depois: ' ', frase: `curtidas e comentários por view. Idades ou componentes diferentes (total de hoje, primeiros 30 dias, só curtidas) não se comparam.${ORIGEM}` },
    { termo: 'Primeiros dias:', depois: ' ', frase: `mediana das views dos longos aos 7 e 30 dias de contagem e nas primeiras 24 horas (só vídeos com a leitura das primeiras horas).${ORIGEM}` },
  ]
}
