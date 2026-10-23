// Estado puro da lista "Sugestões" (F3 T5): sem React. Linhas e N mostrados são SEMPRE derivados da prop; o estado local só guarda
// o que a pessoa fez (a chamada em voo, as linhas já respondidas, o erro de cada linha).
import type { MotivoDaTela, RespostaDaAcao } from './tipos'
import { resumoDaLista, type LinhaDaVista, type VistaDaLista } from './view-model'

export type DesfechoDaLinha = 'sucesso' | 'ja-saiu'
export type TipoDeErro = 'nao-salvou' | 'sem-conexao' | 'sem-permissao'

export interface EstadoDaLista {
  pendente: { id: string; motivo: MotivoDaTela } | null
  respondidas: ReadonlyMap<string, DesfechoDaLinha>
  /** Motivo da dispensa que deu certo (para a confirmação). */
  motivoDe: ReadonlyMap<string, MotivoDaTela>
  erros: ReadonlyMap<string, { tipo: TipoDeErro; motivo: MotivoDaTela }>
}

export type EventoDaLista =
  | { tipo: 'iniciar'; id: string; motivo: MotivoDaTela }
  | { tipo: 'resposta'; id: string; motivo: MotivoDaTela; resposta: RespostaDaAcao }
  /** Promessa rejeitada ou 15 s sem resposta. */
  | { tipo: 'falha'; id: string; motivo: MotivoDaTela }

export const estadoInicial = (): EstadoDaLista => ({ pendente: null, respondidas: new Map(), motivoDe: new Map(), erros: new Map() })

function com<K, V>(m: ReadonlyMap<K, V>, k: K, v: V): Map<K, V> { const n = new Map(m); n.set(k, v); return n }
function sem<K, V>(m: ReadonlyMap<K, V>, k: K): Map<K, V> { const n = new Map(m); n.delete(k); return n }

export function reduzirLista(e: EstadoDaLista, ev: EventoDaLista): EstadoDaLista {
  const ePendente = e.pendente !== null && e.pendente.id === ev.id && e.pendente.motivo === ev.motivo
  switch (ev.tipo) {
    case 'iniciar':
      if (e.pendente !== null) return e // toque duplo / outra chamada em voo
      return { ...e, pendente: { id: ev.id, motivo: ev.motivo }, erros: sem(e.erros, ev.id) }
    case 'falha':
      if (!ePendente) return e
      return { ...e, pendente: null, erros: com(e.erros, ev.id, { tipo: 'sem-conexao', motivo: ev.motivo }) }
    case 'resposta': {
      const r = ev.resposta
      // `ok` sempre vale (inclusive depois do estouro de 15 s): a linha sai com a confirmação.
      if (r.ok) {
        return {
          pendente: e.pendente?.id === ev.id ? null : e.pendente,
          respondidas: com(e.respondidas, ev.id, 'sucesso'),
          motivoDe: com(e.motivoDe, ev.id, ev.motivo),
          erros: sem(e.erros, ev.id),
        }
      }
      if (!ePendente) return e // resposta tardia de chamada que não é a atual
      const base = { ...e, pendente: null }
      switch (r.motivo) {
        case 'nao_aberto':
        case 'nao_encontrado':
          // Já dispensada por aqui: não vira "já saiu" por cima do sucesso.
          return { ...base, respondidas: e.respondidas.get(ev.id) === 'sucesso' ? e.respondidas : com(e.respondidas, ev.id, 'ja-saiu'), erros: sem(e.erros, ev.id) }
        case 'sem_permissao':
          return { ...base, erros: com(e.erros, ev.id, { tipo: 'sem-permissao', motivo: ev.motivo }) }
        case 'motivo_invalido':
        case 'falhou':
          return { ...base, erros: com(e.erros, ev.id, { tipo: 'nao-salvou', motivo: ev.motivo }) }
      }
    }
  }
}

const resumoDe = (ls: LinhaDaVista[]): string => (ls.length === 0 ? 'Nenhuma sugestão aberta.' : resumoDaLista(ls.map((l) => ({ kind: l.kind, lugar: l.lugar }))))
const cheioNaPrimeira = (ls: LinhaDaVista[]): LinhaDaVista[] =>
  ls.map((l, i) => (l.primario.cheio === (i === 0) ? l : { ...l, primario: { ...l.primario, cheio: i === 0 } }))
const contagens = (ls: LinhaDaVista[]) => ({ todas: ls.length, destino: ls.filter((l) => l.kind === 'destino').length, parecido: ls.filter((l) => l.kind === 'parecido').length })

/**
 * Pura, calculada no render. `prop.n !== null` -> a prop; `prop.n === null` com `ultimaBoa` -> a última boa com a faixa `erro-com-lista`,
 * na mesma chamada (sem quadro vazio nem perda de foco). Depois tira as respondidas: o N cai só pelas linhas que a prop AINDA traz.
 */
export function vistaVisivel(prop: VistaDaLista, e: EstadoDaLista, ultimaBoa: VistaDaLista | null): VistaDaLista {
  const base: VistaDaLista = prop.n !== null ? prop
    : ultimaBoa !== null ? { ...ultimaBoa, faixa: { tipo: 'erro-com-lista', titulo: 'Não deu para atualizar a lista.', texto: 'Esta é a última lista que deu para ler.' } }
    : prop
  if (base.n === null || e.respondidas.size === 0) return base
  const descontadas = base.completas.filter((l) => e.respondidas.has(l.id)).length
  if (descontadas === 0 && base.linhas.every((l) => !e.respondidas.has(l.id))) return base
  const completas = cheioNaPrimeira(base.completas.filter((l) => !e.respondidas.has(l.id)))
  const linhas = cheioNaPrimeira(base.linhas.filter((l) => !e.respondidas.has(l.id)))
  const n = base.n - descontadas
  const vazio = n <= 0 && base.vazio === null
    ? { familia: 'resolvido' as const, topo: 'Nenhuma sugestão aberta.', titulo: 'As últimas sugestões já saíram da lista.', texto: '' }
    : base.vazio
  return {
    ...base, n, linhas, completas, vazio,
    resumo: vazio ? vazio.topo : descontadas > 0 ? resumoDe(completas) : base.resumo,
    filtro: base.filtro === null ? null : { atual: base.filtro.atual, contagens: contagens(completas) },
  }
}
