/** Modelo puro de "Com você", frase do topo e "Em teste agora" (M7 T4). Sem banco nem relógio próprio. */
import { lerResultadoV2 } from '../ab-types'
import { regraDoTeste } from '../ab-gravacao/placar'
import { diaMesSp } from '../ab-data-curta'
import { prazoDoTeste } from '../teste-youtube/nativo/lista'
import { porExtenso, porExtensoFem, capitalizar } from '../teste-youtube/nativo/frases'
import { versoesDoDia14 } from '../teste-youtube/nativo/dia-14-estado'
import { painelDoAtivo, painelDoConcluido } from './painel-decisao'
import type { LinhaDoCaminho } from '../teste-youtube/nativo/lista'
import type { CartaoEmTeste, EntradaPagina, ItemComVoce } from './tipos'

export type { EntradaPagina, ItemComVoce, CartaoEmTeste } from './tipos'

const DIA_MS = 86_400_000

/** "~Nh" / "<1h" até a próxima rotação (24 h depois do início do ciclo); nulo sem ciclo. */
export function proximaTrocaDe(cycleStartedAt: string | null, agora: Date): string | null {
  if (!cycleStartedAt) return null
  const t = Date.parse(cycleStartedAt)
  if (!Number.isFinite(t)) return null
  const horas = Math.max(0, 24 - (agora.getTime() - t) / 3_600_000)
  return horas < 1 ? '<1h' : `~${Math.round(horas)}h`
}

const pct = (f: number): string => `${(f * 100).toFixed(1).replace('.', ',')}%`

function regraV2(bruto: unknown): boolean {
  try { return regraDoTeste(bruto) === 'v2' } catch { return false }
}

function sugeridaDoAtivo(bruto: { result_metadata: unknown }): string | null {
  const l = lerResultadoV2(bruto.result_metadata)
  return l.estado === 'ok' && typeof l.v2.vencedor_sugerido === 'string' ? l.v2.vencedor_sugerido : null
}

function noArDoAtivo(e: EntradaPagina['ativos'][number]): string {
  const id = e.bruto.current_cycle?.variant_id
  return e.card.variants.find(v => v.id === id)?.label ?? 'A'
}

function tetoDe(e: EntradaPagina['ativos'][number]): number {
  return e.card.diaV2?.teto ?? e.tela?.teto ?? e.card.durationDays ?? 14
}

function temHistoricoDe(e: EntradaPagina): boolean {
  return e.ativos.length + e.concluidos.length + e.pausados.length + e.rascunhos.length > 0
    || e.linhas.some(l => l.registro !== null || l.nosso !== null)
}

/** Estados em que a linha do Studio gera o item `dia14` em "Com você" (fonte única do item e do cartão). */
export function geraItemDia14(l: LinhaDoCaminho): boolean {
  return l.registro !== null && (l.estado === 'resultado_pronto' || l.estado === 'sem_resposta')
}

export function itensComVoce(e: EntradaPagina): ItemComVoce[] {
  const vencidos: ItemComVoce[] = []
  const aplicar: ItemComVoce[] = []
  const noPrazo: ItemComVoce[] = []
  const retomar: ItemComVoce[] = []
  const rascunhos: ItemComVoce[] = []
  const conferir: ItemComVoce[] = []

  for (const l of e.linhas) {
    if (!l.registro) continue
    if (geraItemDia14(l)) {
      const vencido = l.estado === 'sem_resposta'
      const item: ItemComVoce = { tipo: 'dia14', titulo: l.titulo, linha: l, ytId: l.ytId, prazo: diaMesSp(prazoDoTeste(l.registro.inicio).toISOString()), vencido }
      ;(vencido ? vencidos : noPrazo).push(item)
    } else if (l.estado === 'em_teste_studio' && l.registro.confirmadoEm === null) {
      conferir.push({ tipo: 'conferir_studio', titulo: l.titulo, ytId: l.ytId })
    }
  }
  for (const c of e.concluidos) {
    if (!c.tela?.aplicar) continue
    const painel = painelDoConcluido(c.card, c.tela, { ctrs: c.ctrs, sugeridaId: c.tela.aplicar.variant_id, revertExpiresAt: c.bruto.revert_expires_at, agora: e.agora })
    if (!painel) continue
    aplicar.push({ tipo: 'aplicar', testId: c.card.id, titulo: c.card.videoTitle ?? c.card.name, letra: c.tela.aplicar.letra, motivo: 'sugerida pelo teste', painel })
  }
  for (const p of e.pausados) {
    if (p.pausaYoutube?.aberto) continue // vira cartão do Studio
    // desde quando está pausado: só paused_at. Sem ele, nulo (o início do ciclo não é a data da pausa; ausência nunca vira 0).
    const t = p.pausedAt ? Date.parse(p.pausedAt) : NaN
    const dias = Number.isFinite(t) ? Math.max(0, Math.floor((e.agora.getTime() - t) / DIA_MS)) : null
    retomar.push({ tipo: 'retomar', titulo: p.videoTitle ?? p.name, testId: p.id, pausadoHaDias: dias })
  }
  for (const d of e.rascunhos) rascunhos.push({ tipo: 'rascunho', draftId: d.id, titulo: d.name, passo: d.step })

  const itens = [...vencidos, ...aplicar, ...noPrazo, ...retomar, ...rascunhos, ...conferir]
  if (itens.length === 0 && !temHistoricoDe(e)) itens.push({ tipo: 'primeiro_teste' })
  return itens
}

export function proximaDecisao(e: EntradaPagina): Date | null {
  const datas: number[] = []
  for (const a of e.ativos) {
    if (a.card.status !== 'active' || !a.bruto.started_at) continue
    const t = Date.parse(a.bruto.started_at)
    if (Number.isFinite(t)) datas.push(t + (tetoDe(a) - 1) * DIA_MS)
  }
  for (const l of e.linhas) {
    if (l.estado === 'em_teste_studio' && l.registro) datas.push(prazoDoTeste(l.registro.inicio).getTime())
  }
  return datas.length ? new Date(Math.min(...datas)) : null
}

function verboDe(i: ItemComVoce): string | null {
  switch (i.tipo) {
    case 'aplicar': return `aplicar ${i.letra}`
    case 'dia14': return 'dizer o que o Studio escolheu'
    case 'conferir_studio': return 'conferir o Studio'
    case 'rascunho': return 'terminar o rascunho'
    case 'retomar': return 'retomar o teste'
    default: return null
  }
}

export function fraseDoTopo(p: { lab: number; studio: number; itens: ItemComVoce[]; temHistorico: boolean }): string {
  const itens = p.itens.filter(i => i.tipo !== 'primeiro_teste')
  const total = p.lab + p.studio
  if (total === 0 && itens.length === 0) {
    return p.temHistorico ? 'Nenhum teste rodando. Nada com você agora.' : 'Nenhum teste ainda. Crie o primeiro quando quiser.'
  }
  let rodando: string
  if (total === 0) rodando = 'Nenhum teste do Lab rodando.'
  else {
    const n = total === 1 ? 'Um teste' : `${total} testes`
    rodando = `${n} rodando${p.studio > 0 ? ` (${p.studio} no Studio)` : ''}.`
  }
  if (itens.length === 0) return `${rodando} Nada com você agora.`
  const n = itens.length
  const coisas = `${n === 1 ? 'Uma' : capitalizar(porExtensoFem(n))} ${n === 1 ? 'coisa' : 'coisas'} com você`
  if (n > 2) return `${rodando} ${coisas}.`
  const verbos = itens.map(verboDe).filter((v): v is string => v !== null)
  const lista = verbos.length > 1 ? `${verbos.slice(0, -1).join(', ')} e ${verbos[verbos.length - 1]}` : verbos[0] ?? ''
  return `${rodando} ${coisas}${lista ? `: ${lista}` : ''}.`
}

export function cartoesEmTeste(e: EntradaPagina, itens: ItemComVoce[] = itensComVoce(e)): CartaoEmTeste[] {
  const out: CartaoEmTeste[] = []
  for (const a of e.ativos) {
    const { card } = a
    const original = card.variants.find(v => v.isOriginal)
    let lider: Extract<CartaoEmTeste, { tipo: 'lab' }>['lider'] = null
    const letraLider = a.tela?.sinal ?? null
    if (letraLider) {
      const v = card.variants.find(x => x.label === letraLider)
      const cl = v ? a.ctrs[v.id] : null
      const co = original ? a.ctrs[original.id] : null
      if (cl != null && co != null) lider = { letra: letraLider, ctrs: [pct(cl), pct(co)] }
    }
    const algumMedido = card.variants.some(v => a.ctrs[v.id] != null)
    const ativo = card.status === 'active'
    const painel = ativo
      ? painelDoAtivo(card, { ctrs: a.ctrs, noArLetra: noArDoAtivo(a), sugeridaId: sugeridaDoAtivo(a.bruto), regraV2: regraV2(a.bruto), podeDeixarVariante: e.podeDeixarVariante })
      : null
    out.push({ tipo: 'lab', card, lider, semLider: algumMedido ? 'poucos dados' : 'CTR não medido', proximaTroca: ativo ? proximaTrocaDe(card.cycleStartedAt, e.agora) : null, painel })
  }
  for (const l of e.linhas) {
    if (l.estado !== 'em_teste_studio' || !l.registro) continue
    const pergunta = versoesDoDia14(l.registro)
    const titulos = pergunta.tipo === 'versoes' ? pergunta.versoes.map(v => ({ letra: v.letra, titulo: v.titulo })) : []
    out.push({ tipo: 'studio', linha: l, titulos, labPausadoAte: l.labPausadoAte, dia14: geraItemDia14(l) })
  }
  return out
}
