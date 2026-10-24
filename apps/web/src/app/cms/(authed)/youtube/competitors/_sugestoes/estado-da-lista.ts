// Estado puro da lista "Sugestões" (F3 T5): sem React. Linhas e N mostrados são SEMPRE derivados da prop; o estado local só guarda
// o que a pessoa fez (a chamada em voo, as linhas já respondidas, o erro de cada linha).
import type { MotivoDaTela, RespostaDaAcao } from './tipos'
import { diaSP, resumoDaLista, type AdiadasDaVista, type LinhaDaVista, type VistaDaLista } from './view-model'

/** O que a pessoa pediu numa linha: um dos 4 motivos de dispensa ou (F3b) `adiar` ("Adiar 7 dias"). */
export type AcaoDaLinha = MotivoDaTela | 'adiar'
/** `adiada` (F3b): "Adiar 7 dias" deu certo (inclui `ja_adiado`); a data de volta fica em `voltaDe`. */
export type DesfechoDaLinha = 'sucesso' | 'ja-saiu' | 'adiada'
export type TipoDeErro = 'nao-salvou' | 'sem-conexao' | 'sem-permissao' | 'sessao' | 'vence-antes'

export interface EstadoDaLista {
  pendente: { id: string; motivo: AcaoDaLinha } | null
  respondidas: ReadonlyMap<string, DesfechoDaLinha>
  /** Motivo da dispensa que deu certo (para a confirmação). */
  motivoDe: ReadonlyMap<string, MotivoDaTela>
  /** F3b: quando volta (ISO) cada linha adiada por aqui. */
  voltaDe: ReadonlyMap<string, string>
  erros: ReadonlyMap<string, { tipo: TipoDeErro; motivo: AcaoDaLinha; /** `vence-antes`: o vencimento (ISO). */ expiraEm?: string }>
}

export type EventoDaLista =
  | { tipo: 'iniciar'; id: string; motivo: AcaoDaLinha }
  | { tipo: 'resposta'; id: string; motivo: AcaoDaLinha; resposta: RespostaDaAcao }
  /** Promessa rejeitada ou 15 s sem resposta. */
  | { tipo: 'falha'; id: string; motivo: AcaoDaLinha; causa?: 'sessao' }

export const estadoInicial = (): EstadoDaLista => ({ pendente: null, respondidas: new Map(), motivoDe: new Map(), voltaDe: new Map(), erros: new Map() })

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
      return { ...e, pendente: null, erros: com(e.erros, ev.id, { tipo: ev.causa === 'sessao' ? 'sessao' : 'sem-conexao', motivo: ev.motivo }) }
    case 'resposta': {
      const r = ev.resposta
      // `ok` sempre vale (inclusive depois do estouro de 15 s): a linha sai com a confirmação.
      const pendenteSemEste = e.pendente?.id === ev.id ? null : e.pendente
      if (r.ok) {
        if (ev.motivo === 'adiar') {
          const volta = typeof r.adiado_ate === 'string' ? com(e.voltaDe, ev.id, r.adiado_ate) : e.voltaDe
          return { ...e, pendente: pendenteSemEste, respondidas: com(e.respondidas, ev.id, 'adiada'), voltaDe: volta, erros: sem(e.erros, ev.id) }
        }
        return {
          ...e,
          pendente: pendenteSemEste,
          respondidas: com(e.respondidas, ev.id, 'sucesso'),
          motivoDe: com(e.motivoDe, ev.id, ev.motivo as MotivoDaTela),
          erros: sem(e.erros, ev.id),
        }
      }
      // `ja_adiado` também vale depois do estouro de 15 s: a 1ª tentativa chegou ao servidor, a linha sai como adiada, com a data.
      if (r.motivo === 'ja_adiado') {
        return { ...e, pendente: pendenteSemEste, respondidas: com(e.respondidas, ev.id, 'adiada'), voltaDe: com(e.voltaDe, ev.id, r.adiado_ate), erros: sem(e.erros, ev.id) }
      }
      if (!ePendente) return e // resposta tardia de chamada que não é a atual
      const base = { ...e, pendente: null }
      switch (r.motivo) {
        case 'expira_antes':
          return { ...base, erros: com(e.erros, ev.id, { tipo: 'vence-antes', motivo: ev.motivo, expiraEm: r.expira_em }) }
        case 'nao_aberto':
        case 'nao_encontrado':
          // Já respondida por aqui (dispensada ou adiada): não vira "já saiu" por cima do sucesso.
          return { ...base, respondidas: e.respondidas.get(ev.id) === 'sucesso' || e.respondidas.get(ev.id) === 'adiada' ? e.respondidas : com(e.respondidas, ev.id, 'ja-saiu'), erros: sem(e.erros, ev.id) }
        case 'sem_permissao':
          return { ...base, erros: com(e.erros, ev.id, { tipo: 'sem-permissao', motivo: ev.motivo }) }
        case 'motivo_invalido':
        case 'falhou':
          return { ...base, erros: com(e.erros, ev.id, { tipo: 'nao-salvou', motivo: ev.motivo }) }
      }
    }
  }
}

/** O vazio "Você adiou N" montado no cliente (a última linha aberta acabou de ser adiada aqui). */
function vazioDeAdiadas(a: AdiadasDaVista | null): NonNullable<VistaDaLista['vazio']> {
  if (a === null) return { familia: 'adiado', topo: 'Nenhuma sugestão aberta.', titulo: 'Adiadas por você:', chipNm: true, texto: 'Não deu para contar quantas voltam nem quando.' }
  return {
    familia: 'adiado', topo: 'Nenhuma sugestão aberta.', titulo: `Você adiou ${a.n} ${a.n === 1 ? 'sugestão' : 'sugestões'}.`,
    texto: a.proxima === null ? '' : a.n === 1 ? `Ela volta em ${diaSP(a.proxima)}.` : `A próxima volta em ${diaSP(a.proxima)}.`,
  }
}
const resumoDe = (ls: LinhaDaVista[]): string => (ls.length === 0 ? 'Nenhuma sugestão aberta.' : resumoDaLista(ls.map((l) => ({ kind: l.kind, lugar: l.lugar }))))
const cheioNaPrimeira = (ls: LinhaDaVista[]): LinhaDaVista[] =>
  ls.map((l, i) => (l.primario.cheio === (i === 0) ? l : { ...l, primario: { ...l.primario, cheio: i === 0 } }))
export const contagens = (ls: LinhaDaVista[]) => ({ todas: ls.length, destino: ls.filter((l) => l.kind === 'destino').length, parecido: ls.filter((l) => l.kind === 'parecido').length })

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
  // F3b: as adiadas por aqui que a prop ainda traz entram na contagem das adiadas (a prop atualizada já as conta).
  let adiadas: AdiadasDaVista | null = base.adiadas
  if (adiadas) {
    const novas = base.completas.filter((l) => e.respondidas.get(l.id) === 'adiada')
    if (novas.length > 0) {
      const voltas = novas.map((l) => e.voltaDe.get(l.id)).filter((v): v is string => v !== undefined)
      const todas = [...voltas, ...(adiadas.proxima ? [adiadas.proxima] : [])].sort()
      adiadas = { n: adiadas.n + novas.length, proxima: todas[0] ?? null }
    }
  }
  const adiouAgora = base.completas.some((l) => e.respondidas.get(l.id) === 'adiada')
  const vazio = n <= 0 && base.vazio === null
    ? adiouAgora || (adiadas && adiadas.n > 0) ? vazioDeAdiadas(adiadas) : { familia: 'resolvido' as const, topo: 'Nenhuma sugestão aberta.', titulo: 'As últimas sugestões já saíram da lista.', texto: '' }
    : base.vazio
  return {
    ...base, n, linhas, completas, vazio, adiadas,
    resumo: vazio ? vazio.topo : descontadas > 0 ? resumoDe(completas) : base.resumo,
    filtro: base.filtro === null ? null : { atual: base.filtro.atual, contagens: contagens(completas) },
  }
}
