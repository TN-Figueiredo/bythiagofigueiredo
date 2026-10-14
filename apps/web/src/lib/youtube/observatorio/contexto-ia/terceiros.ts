// A5 · E17 degrau 1, Tarefa 2: texto de terceiros (título, descrição, comentário, resposta do criador, leitura da forja) nunca começa uma
// linha do pacote. Ele entra por três portas: `citar` (várias linhas, cada uma com a marca), `naCelula` (uma linha de tabela) e `noJson`
// (bloco estruturado). Assim uma descrição que diga "Minha pergunta:" ou feche uma cerca de código não consegue fingir ser o pacote.

/** Marca de toda linha de texto de terceiros: o leitor (e a IA) sabe que o que vem depois é dado, não instrução. */
export const MARCA = '│ '

// Além de \r e \n: NEL (U+0085), VT (U+000B) e FF (U+000C), que `splitlines()` e vários leitores de texto também tratam como fim de linha.
const FIM_DE_LINHA = /\r\n|[\r\n\u0085\u000b\u000c\u2028\u2029]/
const ABRE_COM_MARCA = /^[│\s]+/
const TRES_CRASES_OU_MAIS = /`{3,}/g

/** Várias linhas de terceiros: uma entrada por linha, cada uma começando por `MARCA`. Nunca devolve lista vazia. */
export function citar(texto: string): string[] {
  return texto.split(FIM_DE_LINHA).map((linha) => {
    const limpa = linha.replace(ABRE_COM_MARCA, '')
    return limpa === '' ? MARCA.trimEnd() : MARCA + limpa
  })
}

/** Uma linha só, para dentro de uma célula de tabela. */
export function naCelula(texto: string | null | undefined): string {
  const uma = (texto ?? '')
    .split(FIM_DE_LINHA)
    .join(' ')
    .replace(/\|/g, '\\|')
    .replace(TRES_CRASES_OU_MAIS, (c) => "'".repeat(c.length))
    .trim()
  return uma === '' ? '(sem texto)' : uma
}

/** JSON legível (dois espaços) em que nenhuma crase nem separador de linha aparece cru: cadeia de terceiros não fecha a cerca da IA. */
export function noJson(valor: unknown): string {
  const json = JSON.stringify(valor, null, 2)
  if (json === undefined) return 'null'
  return json.replace(/`/g, '\\u0060').replace(/\u0085/g, '\\u0085').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
