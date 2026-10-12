/**
 * A lista de origem do Histórico quando a pessoa veio da página do canal (spec 3 e 6.5): a frase que descreve a lista, lida de `back=`
 * (o estado da página: aba, formato, ordenação, direção, busca). Puro, sem `obs` e sem React.
 *
 *   grade:  "de Leo Khev (longos, do mais novo ao mais antigo)"           → "vídeo 7 de 51 de Leo Khev (…)"
 *   trocas: "com trocas de Leo Khev (trocas dos últimos 30 dias, …)"      → "vídeo 3 de 5 com trocas de Leo Khev (…)"
 *
 * As palavras são as dos controles do spec 5.5. Só o que difere do padrão entra na frase (formato "Todos" e vista não contam: a vista
 * não muda a lista, e `n` só diz quantos antigos estavam carregados).
 */
import { parseCanalState, type CanalState } from '../_canal/params'

const FMT: Record<CanalState['fmt'], string | null> = { todos: null, longos: 'longos', shorts: 'Shorts', fixados: 'fixados' }
/** Ordenação e direção, nas palavras do select "Mais recentes / Mais vistos / Maior múltiplo / Mais views por dia". */
const ORDEM: Record<CanalState['sort'], Record<CanalState['dir'], string>> = {
  recentes: { desc: 'do mais novo ao mais antigo', asc: 'do mais antigo ao mais novo' },
  vistos: { desc: 'mais vistos primeiro', asc: 'menos vistos primeiro' },
  multiplo: { desc: 'maior múltiplo primeiro', asc: 'menor múltiplo primeiro' },
  vpd: { desc: 'mais views por dia primeiro', asc: 'menos views por dia primeiro' },
  // canal próprio: `SORTS` abaixo ainda não deixa passar 'imp' (este módulo lê o estado do concorrente, sem `own`); quem ligar a origem do canal próprio troca as duas pontas
  imp: { desc: 'mais impressões primeiro', asc: 'menos impressões primeiro' },
}
const TROCAS = 'trocas dos últimos 30 dias, da mais recente à mais antiga'

const ABAS = ['videos', 'trocas'] as const
const FMTS = ['todos', 'longos', 'shorts', 'fixados'] as const
const SORTS = ['recentes', 'vistos', 'multiplo', 'vpd'] as const
/** O canal próprio escreve só estas (a página dele não tem Trocas como lista, nem Fixados, nem views por dia na ordenação; tem impressões). */
const ABAS_PROPRIO = ['videos'] as const
const FMTS_PROPRIO = ['todos', 'longos', 'shorts'] as const
const SORTS_PROPRIO = ['recentes', 'vistos', 'multiplo', 'imp'] as const
const DIRS = ['asc', 'desc'] as const

/** O valor de um parâmetro conhecido, se vier, tem de ser um dos que a página do canal escreve. */
const valido = (v: string | null, lista: readonly string[]) => v == null || lista.includes(v)

/**
 * `back` é o `back=` do Histórico (começa com `?`; `''` e `?` são a grade no estado padrão, que a página não escreve na URL).
 * `null` quando `back` não descreve um estado do canal: ausente, sem `?`, aba que não tem lista de vídeos (Leitura, Retenção) ou valor
 * que a página nunca escreveria. Nesse caso quem chama não afirma ordem nenhuma.
 */
export function origemDoCanal(back: string | null, canalNome: string): { of: string; outside: string } | null {
  if (back == null || (back !== '' && !back.startsWith('?'))) return null
  const qs = new URLSearchParams(back.slice(1))
  if (!valido(qs.get('tab'), ABAS) || !valido(qs.get('fmt'), FMTS) || !valido(qs.get('sort'), SORTS) || !valido(qs.get('dir'), DIRS)) return null
  const s = parseCanalState(Object.fromEntries(qs), { own: false })
  if (s.tab === 'trocas') {
    const d = `trocas de ${canalNome} (${TROCAS})`
    return { of: 'com ' + d, outside: 'fora da lista de vídeos com ' + d }
  }
  const desc = [FMT[s.fmt], s.q ? `busca “${s.q}”` : null, ORDEM[s.sort][s.dir]].filter((x): x is string => x != null).join(', ')
  return { of: `de ${canalNome} (${desc})`, outside: `fora da lista de ${canalNome} (${desc})` }
}

/**
 * O `back=` do top de "Como o canal está" (os vídeos com mais impressões): abre a seção na página do canal (`painel=1`) e leva o marcador
 * próprio `origem=top-imp`, que é como o paginador do vídeo sabe que a ordem é a do TOP e não a de uma lista da grade.
 */
export const BACK_DO_TOP_IMP = '?painel=1&origem=top-imp'
/** O `back` veio do top de impressões da seção "Como o canal está". */
export const veioDoTopDeImpressoes = (back: string | null): boolean => back != null && back.startsWith('?') && new URLSearchParams(back.slice(1)).get('origem') === 'top-imp'

/** Os parâmetros que a página do canal escreve para descrever a lista de vídeos (`canalQuery`). Só `painel` e `origem` NÃO descrevem lista. */
const CHAVES_DA_LISTA = ['tab', 'fmt', 'sort', 'dir', 'q', 'ver', 'n', 'video', 'nums'] as const

/**
 * A frase da lista de origem de um canal PRÓPRIO, sem o nome do canal ("longos, mais impressões primeiro"): a página do vídeo próprio a usa
 * em "na ordem da lista: …". `null` quando `back` não descreve uma lista de vídeos que a página do canal próprio escreveria (aba sem lista,
 * Fixados, views por dia, valor desconhecido) e também quando ele só abre uma seção (`?painel=1`, o top de impressões): quem chama não afirma
 * ordem nenhuma. `''` e `?` são a grade no estado padrão.
 */
export function descricaoDaOrigem(back: string | null): string | null {
  if (back == null || (back !== '' && !back.startsWith('?'))) return null
  const qs = new URLSearchParams(back.slice(1))
  if (qs.get('origem') != null) return null
  if (back !== '' && back !== '?' && !CHAVES_DA_LISTA.some(k => qs.has(k))) return null
  if (!valido(qs.get('tab'), ABAS_PROPRIO) || !valido(qs.get('fmt'), FMTS_PROPRIO) || !valido(qs.get('sort'), SORTS_PROPRIO) || !valido(qs.get('dir'), DIRS)) return null
  const s = parseCanalState(Object.fromEntries(qs), { own: true })
  return [FMT[s.fmt], s.q ? `busca “${s.q}”` : null, ORDEM[s.sort][s.dir]].filter((x): x is string => x != null).join(', ')
}
