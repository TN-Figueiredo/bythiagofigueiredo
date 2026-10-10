/**
 * Filtro, ordenação, busca e "Carregar mais" da lista de vídeos do canal (spec 5.5, 5.6 e 5.9). Funções puras, sem React
 * e sem `obs`: rodam no navegador sobre os campos brutos de `ChannelVideoView`, então cada troca responde sem navegar.
 *
 * Os antigos (fora dos acompanhados) ficam sempre abaixo, ordenados por data, e só entram pelo `n` da URL. Os divisores
 * de "sem valor" e de "sem data" contam só o que está na tela; o divisor dos antigos conta todos os que casam com filtro
 * e busca (spec 5.6: "Mais antigos, sem contagem diária (82)").
 */
import type { ChannelVideoView } from './videos-model'
import { LOTE, type CanalState } from './params'

export interface Divisor { key: string; label: string; count: number }
export interface Secao { divisor: Divisor | null; itens: ChannelVideoView[] }
export interface ListaView {
  secoes: Secao[]; visiveis: string[]                 // ids na ordem da tela (para ids= do Histórico)
  counts: { todos: number; longos: number; shorts: number; fixados: number; naoConfirmado: number }
  resultado: string                                   // linha de resultado / anúncio do status
  vazio: { text: string; acao: 'limpar-busca' | 'buscar-em-todos' | null } | null
  /** `faltam` = antigos ainda não carregados (antes do lote); `frase` já diz quantos faltam depois dele. */
  mais: { mostrando: number; total: number; proximo: number; faltam: number; frase: string; botao: string; soAntigos: string | null } | null
}

type Estado = Pick<CanalState, 'fmt' | 'sort' | 'dir' | 'q' | 'n'>

/** Minúsculas, sem acento. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const normTitle = new WeakMap<ChannelVideoView, string>()
const titleKey = (v: ChannelVideoView) => {
  let t = normTitle.get(v)
  if (t === undefined) { t = norm(v.title); normTitle.set(v, t) }
  return t
}

const SEM_VALOR: Record<Exclude<CanalState['sort'], 'recentes'>, string> = {
  vistos: 'Sem contagem de views', multiplo: 'Sem múltiplo ainda', vpd: 'Sem views por dia ainda',
}
const LABEL_ANTIGOS = 'Mais antigos, sem contagem diária'
const FMT_NOME = { longos: 'vídeo longo', shorts: 'Short', fixados: 'vídeo fixado' } as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const porData = (a: ChannelVideoView, b: ChannelVideoView) => (b.pub ?? 0) - (a.pub ?? 0)

function chave(v: ChannelVideoView, sort: CanalState['sort']): number | null {
  return sort === 'recentes' ? v.pub : sort === 'vistos' ? v.views : sort === 'multiplo' ? v.mult : v.vpd7
}

function casaFormato(v: ChannelVideoView, fmt: CanalState['fmt']): boolean {
  return fmt === 'todos' || (fmt === 'longos' ? v.isShort === false : fmt === 'shorts' ? v.isShort === true : v.pinned)
}

export function montarLista(all: readonly ChannelVideoView[], s: Estado): ListaView {
  const q = s.q.trim(), qn = norm(q)
  const casaBusca = (v: ChannelVideoView) => !qn || titleKey(v).includes(qn)

  const counts = {
    todos: all.length,
    longos: all.filter(v => v.isShort === false).length,
    shorts: all.filter(v => v.isShort === true).length,
    fixados: all.filter(v => v.pinned).length,
    naoConfirmado: all.filter(v => v.isShort == null).length,
  }

  const casam = all.filter(v => casaFormato(v, s.fmt) && casaBusca(v))
  const frente: ChannelVideoView[] = [], semData: ChannelVideoView[] = [], antigos: ChannelVideoView[] = []
  for (const v of casam) {
    if (v.grupo === 'antigo') antigos.push(v)
    else if (v.grupo === 'sem-data' || (s.sort === 'recentes' && v.pub == null)) semData.push(v)
    else frente.push(v)
  }
  antigos.sort(porData)
  const carregados = antigos.slice(0, Math.max(0, s.n))

  /* acompanhados e fixados antigos: quem tem a chave, ordenado; quem não tem, sob o divisor da ordenação */
  const comValor = frente.filter(v => chave(v, s.sort) != null)
  const semValor = frente.filter(v => chave(v, s.sort) == null).sort(porData)
  const sinal = s.dir === 'asc' ? 1 : -1
  comValor.sort((a, b) => sinal * (chave(a, s.sort)! - chave(b, s.sort)!) || porData(a, b))

  const secoes: Secao[] = []
  if (comValor.length) secoes.push({ divisor: null, itens: comValor })
  if (semValor.length && s.sort !== 'recentes') secoes.push({ divisor: { key: 'sem-valor', label: SEM_VALOR[s.sort], count: semValor.length }, itens: semValor })
  if (semData.length) secoes.push({ divisor: { key: 'sem-data', label: 'Sem data de publicação', count: semData.length }, itens: semData })
  if (carregados.length) secoes.push({ divisor: { key: 'antigos', label: LABEL_ANTIGOS, count: antigos.length }, itens: carregados })
  const visiveis = secoes.flatMap(x => x.itens.map(v => v.id))

  /* bloco "Carregar mais" */
  const faltam = antigos.length - carregados.length
  let mais: ListaView['mais'] = null
  if (faltam > 0) {
    const proximo = Math.min(LOTE, faltam), depois = faltam - proximo
    const frase = `Mais ${plural(proximo, 'vídeo antigo', 'vídeos antigos')}, sem contagem diária. `
      + (depois === 0 ? 'Depois deste lote não falta nenhum.' : depois === 1 ? 'Depois deste lote falta 1.' : `Depois deste lote faltam ${depois}.`)
    const botao = depois > 0 ? `Carregar mais ${proximo} vídeos`
      : proximo === 1 ? 'Carregar o último vídeo' : `Carregar os últimos ${proximo} vídeos`
    const soAntigos = visiveis.length === 0
      ? `Nenhum dos vídeos acompanhados ${q ? `tem “${q}”` : 'está neste filtro'}. Há ${plural(faltam, 'vídeo antigo', 'vídeos antigos')}, sem contagem diária.`
      : null
    mais = { mostrando: visiveis.length, total: casam.length, proximo, faltam, frase, botao, soAntigos }
  }

  /* vazio */
  let vazio: ListaView['vazio'] = null
  if (visiveis.length === 0 && !mais) {
    if (all.length === 0) vazio = { text: 'Este canal ainda não tem vídeos sincronizados.', acao: null }
    else if (q) {
      const emTodos = all.filter(casaBusca).length
      vazio = s.fmt !== 'todos' && emTodos > 0
        ? { text: `Nenhum ${FMT_NOME[s.fmt]} com “${q}”. Há ${emTodos} em Todos.`, acao: 'buscar-em-todos' }
        : { text: `Nenhum vídeo com “${q}”.`, acao: 'limpar-busca' }
    } else if (s.fmt === 'shorts') vazio = { text: 'Nenhum Short neste canal.', acao: null }
    else if (s.fmt === 'longos') vazio = { text: 'Nenhum vídeo longo neste canal.', acao: null }
    else if (s.fmt === 'fixados') vazio = { text: 'Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes.', acao: null }
  }

  /* linha de resultado */
  let resultado: string
  if (q) {
    resultado = casam.length ? `${plural(casam.length, 'vídeo', 'vídeos')} com “${q}”` : `Nenhum vídeo com “${q}”`
  } else if (s.fmt === 'todos') {
    const partes = [
      counts.longos ? plural(counts.longos, 'longo', 'longos') : null,
      counts.shorts ? plural(counts.shorts, 'Short', 'Shorts') : null,
      counts.naoConfirmado ? `${counts.naoConfirmado} com formato não confirmado` : null,
    ].filter((x): x is string => x != null)
    resultado = counts.todos ? `${plural(counts.todos, 'vídeo', 'vídeos')}: ${partes.join(', ')}.` : 'Nenhum vídeo guardado.'
  } else {
    const n = casam.length
    resultado = s.fmt === 'shorts' ? (n ? plural(n, 'Short', 'Shorts') : 'Nenhum Short')
      : s.fmt === 'longos' ? (n ? plural(n, 'vídeo longo', 'vídeos longos') : 'Nenhum vídeo longo')
      : (n ? plural(n, 'vídeo fixado', 'vídeos fixados') : 'Nenhum vídeo fixado')
  }

  return { secoes, visiveis, counts, resultado, vazio, mais }
}
