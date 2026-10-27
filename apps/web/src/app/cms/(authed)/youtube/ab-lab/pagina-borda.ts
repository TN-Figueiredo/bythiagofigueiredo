// Borda única da página do A/B Lab (M7 T5): lê o banco num só lugar e entrega o modelo pronto. Só leitura.
// Uma visita = lerPaginaDoCanal UMA vez e ab_test_dias UMA vez; as linhas de "Com você" e "Em teste agora" são as da listaInicial.
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { leituraDoEditor } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerPaginaDoCanal, type PaginaDoCanal } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import { lerPausasYoutube } from '@/lib/youtube/teste-youtube/nativo/pausa-borda'
import { lerDiasDosTestes } from '@/lib/youtube/ab-gravacao/placar-leitura'
import { regraDoTeste, type LinhaDiaPlacar } from '@/lib/youtube/ab-gravacao/placar'
import { telaV2DoTeste, type TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import { ctrDosValidos, diasDaDecisao, type DiaDaDecisao } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { painelEscolhaDoConcluido } from '@/lib/youtube/ab-lab-pagina/painel-do-concluido'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { montarPaginaDoLab } from '@/lib/youtube/ab-lab-pagina/montar'
import { CONCLUIDOS_VISIVEIS, linhasConcluidas } from '@/lib/youtube/ab-lab-pagina/concluidos'
import { pedeDecisao } from '@/lib/youtube/ab-lab-pagina/com-voce'
import { lerHistoricoDeRestores } from '@/lib/youtube/ab-no-ar-leitura'
import type { TentativaNoAr } from '@/lib/youtube/ab-no-ar'
import type { EntradaPagina, PaginaDoLab } from '@/lib/youtube/ab-lab-pagina/tipos'
import { lerResultadoV2 } from '@/lib/youtube/ab-types'
import type { AbTestDraft, AbTestSiteSettings, AbTestWithVariants, ChannelLearningsData, CicloSemEntrega } from '@/lib/youtube/ab-types'
import type { EligibleVideo } from './_components/video-picker-dialog'
import {
  getAbTestsForSite, getAbSiteSettings, getChannelLearnings, getEligibleVideosForPicker, toCardView, toDraftList,
} from './queries'
import { toDisplayLabel } from './_components/ab-constants'

export interface PaginaLida {
  pagina: PaginaDoLab
  listaInicial: PaginaDoCanal
  eligibleVideos: EligibleVideo[]
  settings: AbTestSiteSettings
  learnings: ChannelLearningsData | null
  drafts: AbTestDraft[]
  /** Painel do `?painel=<testId>` (qualquer concluído v2, visível ou não na lista); nulo se o teste não existe, não é v2 ou tem outro aberto. */
  painelDaUrl: PainelEscolha | null
}

const ABERTOS = new Set(['draft', 'queued', 'active', 'paused'])

/** video (FK) -> ids dos testes nossos abertos nele; um só passo sobre a mesma leitura, sem consulta extra. */
function abertosPorVideo(todos: readonly AbTestWithVariants[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const t of todos) {
    if (!ABERTOS.has(t.status)) continue
    const s = m.get(t.youtube_video_id) ?? new Set<string>()
    s.add(t.id)
    m.set(t.youtube_video_id, s)
  }
  return m
}

const ehV2 = (t: AbTestWithVariants): boolean => {
  try { return regraDoTeste(t) === 'v2' } catch { return false }
}

const ciclosDe = (t: AbTestWithVariants): CicloSemEntrega[] => t.ciclos ?? []

function telaDe(t: AbTestWithVariants, dias: DiaDaDecisao[], agora: Date, outroTesteAberto: boolean, historico?: TentativaNoAr[]): TelaV2 | null {
  if (!ehV2(t)) return null
  return telaV2DoTeste({
    teste: {
      id: t.id, status: t.status, regra: 'v2', config: t.config, paused_at: t.paused_at, completed_at: t.completed_at,
      completed_reason: t.completed_reason, winner_variant_id: t.winner_variant_id, winner_applied_at: t.winner_applied_at,
      revert_expires_at: t.revert_expires_at, restore_status: t.restore_status, result_metadata: t.result_metadata,
      original_title: t.original_title, test_type: t.test_type, escolha_em: t.escolha_em ?? null, restore_seq: t.restore_seq ?? 0,
    },
    variantes: t.variants.map(v => ({
      id: v.id, letra: toDisplayLabel(v.label, v.is_original), is_original: v.is_original,
      titulo: v.is_original ? (v.title_text ?? t.original_title ?? '') : (v.title_text ?? ''),
    })),
    ciclos: ciclosDe(t), dias, agora, outroTesteAberto, ...(historico ? { historico } : {}),
  })
}

const telaAtiva = (x: TelaV2 | null) => (x?.fase === 'ativo' ? x : null)
const telaConcluida = (x: TelaV2 | null) => (x?.fase === 'concluido' ? x : null)

/** CTR por variante só dos dias válidos; no concluído, até o dia em que o teste encerrou (o CTR do painel é o da decisão). */
function ctrsDe(t: AbTestWithVariants, dias: DiaDaDecisao[]): Record<string, number | null> {
  const ids = t.variants.map(v => v.id)
  const out: Record<string, number | null> = {}
  for (const id of ids) out[id] = null
  if (dias.length === 0) return out
  let usados = dias
  if (t.status === 'completed') {
    const l = lerResultadoV2(t.result_metadata)
    const enc = l.estado === 'ok' ? (l.v2.encerrado_em_dia ?? null) : null
    if (enc) usados = dias.filter(d => d.day_pt <= enc)
  }
  const original = t.variants.find(v => v.is_original)?.id ?? ''
  const x = ctrDosValidos(usados, ids, original)
  for (const id of ids) out[id] = x[id]?.ctr ?? null
  return out
}

const semProvaAvisada = new Set<string>()

export async function lerPaginaDoLab(siteId: string, agora: Date, videoInicial: string | null, painelInicial: string | null = null): Promise<PaginaLida> {
  const sb = getSupabaseServiceClient()
  // O volume vem de uma RPC que lê dado privado: a borda repete a prova de edição. Sem prova a lista abre sem volume.
  const leitura = await leituraDoEditor(siteId)
  if (leitura === null && !semProvaAvisada.has(siteId)) {
    semProvaAvisada.add(siteId) // uma vez por processo: a página relê a cada visita
    Sentry.captureMessage('ab-lab página: sem prova de edição; lista sem volume', { level: 'warning', tags: { component: 'ab-lab-pagina' }, extra: { siteId } })
  }

  const [tests, listaInicial, eligibleVideos, settings, learnings, escopo] = await Promise.all([
    getAbTestsForSite(),
    lerPaginaDoCanal(sb, siteId, agora, leitura, { busca: null, filtro: 'testaveis', pagina: 0, incluirYtId: videoInicial }),
    getEligibleVideosForPicker(),
    getAbSiteSettings(),
    getChannelLearnings(siteId),
    requireSiteAdminScope(siteId),
  ])
  const pausas = await lerPausasYoutube(sb, siteId, tests.paused)

  const abertos = abertosPorVideo([...tests.active, ...tests.draft, ...tests.paused])
  const outroAberto = (t: AbTestWithVariants): boolean => {
    const s = abertos.get(t.youtube_video_id)
    return s !== undefined && [...s].some(id => id !== t.id)
  }

  // Concluídos que a página usa: os CONCLUIDOS_VISIVEIS primeiros da lista (a mesma ordem do modelo) e os que pedem decisão em "Com você".
  // Só esses precisam do histórico de restores e dos dias (CTR do painel); a 1ª passada é sem eles, e a decisão não depende deles.
  const telaSemDias = new Map(tests.completed.map(t => [t.id, telaConcluida(telaDe(t, [], agora, outroAberto(t)))]))
  const ordem = linhasConcluidas({
    testes: tests.completed.map(t => ({ card: toCardView(t), bruto: t, tela: telaSemDias.get(t.id) ?? null, painel: null })),
    linhasStudio: listaInicial.linhas, agora,
  })
  const visiveis = new Set(ordem.slice(0, CONCLUIDOS_VISIVEIS).map(l => l.testId).filter((x): x is string => x !== null))
  const usados = tests.completed.filter(t => {
    const tela = telaSemDias.get(t.id) ?? null
    return tela !== null && !outroAberto(t) && (visiveis.has(t.id) || t.id === painelInicial || pedeDecisao({ tela, bruto: t }, agora) !== null)
  })
  const idsAtivos = tests.active.filter(t => t.status === 'active').map(t => t.id)
  const idsDias = [...new Set([...idsAtivos, ...usados.map(t => t.id)])]

  // Histórico de tentativas (fonte única do "no ar"): uma leitura lógica por visita, só dos testes usados. Erro = desconhecido + Sentry.
  const historicos = new Map<string, TentativaNoAr[] | null>()
  if (usados.length > 0) {
    const h = await lerHistoricoDeRestores(sb, usados.map(t => t.id))
    if (!h.ok) {
      Sentry.captureMessage('ab-lab página: histórico de restores não lido; "no ar" fica desconhecido', { level: 'warning', tags: { component: 'ab-lab-pagina' }, extra: { siteId, motivo: h.motivo } })
      for (const t of usados) historicos.set(t.id, null)
    } else for (const t of usados) historicos.set(t.id, h.porTeste.get(t.id) ?? [])
  }

  const porTeste = new Map<string, LinhaDiaPlacar[]>()
  if (idsDias.length > 0) {
    const lido = await lerDiasDosTestes(sb, siteId, idsDias)
    if (!lido.ok) throw new Error(`ab_lab_pagina: ab_test_dias: ${lido.motivo}${lido.detalhe ? ` (${lido.detalhe})` : ''}`)
    for (const [id, linhas] of lido.porTeste) porTeste.set(id, linhas)
  }
  // Teste com linha inválida não está no mapa: dias vazios, CTR não medido, o resto da página segue.
  const diasDe = (t: AbTestWithVariants): DiaDaDecisao[] =>
    diasDaDecisao(porTeste.get(t.id) ?? [], ciclosDe(t), t.variants.length)

  const ativos: EntradaPagina['ativos'] = tests.active.map(t => {
    const dias = diasDe(t)
    return { card: toCardView(t), bruto: t, tela: telaAtiva(telaDe(t, dias, agora, outroAberto(t))), ctrs: ctrsDe(t, dias) }
  })
  const concluidos: EntradaPagina['concluidos'] = tests.completed.map(t => {
    const dias = diasDe(t)
    const historico = historicos.get(t.id)
    const tela = telaConcluida(telaDe(t, dias, agora, outroAberto(t), historico ?? undefined))
    return { card: toCardView(t), bruto: t, tela, ctrs: ctrsDe(t, dias), outroAberto: outroAberto(t), ...(historico !== undefined ? { historico } : {}) }
  })
  const pausados = tests.paused.map(t => {
    const card = toCardView(t)
    const pausa = pausas.get(t.id)
    return pausa ? { ...card, pausaYoutube: pausa } : card
  })
  const drafts = toDraftList(tests.draft)

  const pagina = montarPaginaDoLab({
    ativos, concluidos, pausados, rascunhos: drafts, linhas: listaInicial.linhas, podeDeixarVariante: escopo.ok, agora,
  })
  // `?painel=` abre o painel de qualquer concluído v2, mesmo fora das 3 linhas e do "Com você": o histórico e os dias dele já foram lidos acima.
  const alvo = painelInicial ? concluidos.find(c => c.bruto.id === painelInicial) : undefined
  const painelDaUrl = alvo ? painelEscolhaDoConcluido(alvo, escopo.ok) : null
  return { pagina, listaInicial, eligibleVideos, settings, learnings, drafts, painelDaUrl }
}
