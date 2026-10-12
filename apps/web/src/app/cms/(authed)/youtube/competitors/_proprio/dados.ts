// A entrada do dado privado do canal próprio (alcance e diário por vídeo) para as páginas. É o ÚNICO módulo, fora de
// `lib/.../proprio/`, que pede a prova de edição e chama os leitores (uma varredura de teste garante). Fluxo:
//   página → guarda de leitura (openObservatoryPage/openChannelPage) → `podeVerPrivado(siteId)` (guarda de EDIÇÃO) →
//   token `EdicaoDoSite` → leitores. Sem token, nada é consultado e nem o cliente de serviço (sem RLS) é criado.
// O token e o que ele abre são objetos de servidor: para um componente cliente só vão dados já montados pelos modelos.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import { mapLimit } from '@/lib/youtube/observatorio/load'
import { edicaoValida, provarEdicao, type EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { lerAlcance, lerDiario } from '@/lib/youtube/observatorio/proprio/ler'
import type { AlcanceCanal, DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { longosAcompanhados } from './extras'

/** Canais lidos ao mesmo tempo na lista de Canais e na comparação. */
const CANAIS_EM_VOO = 4
const TAGS = { component: 'observatorio-proprio' }

/** A prova de que quem pede edita o site (o critério da RLS das tabelas privadas), ou null: sem sessão, sem permissão ou guarda fora do ar. Nunca lança. */
export async function podeVerPrivado(siteId: string): Promise<EdicaoDoSite | null> {
  return provarEdicao(siteId)
}

export interface DadosDoCanal { alcance: Privado<AlcanceCanal>; diario: Privado<DiarioCanal> }

const NEGADO: DadosDoCanal = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }

/** Linhas com valor ruim (CTR fora de 0 a 1, número negativo, data inválida) que os leitores viraram em nulo: UM aviso por requisição. */
function avisarDescartados(siteId: string, descartados: number): void {
  if (descartados <= 0) return
  Sentry.captureMessage('observatório: leitura do canal próprio descartou valores ruins', { level: 'warning', tags: TAGS, extra: { siteId, descartados } })
}
const descartadosDe = (p: Privado<AlcanceCanal> | Privado<DiarioCanal>): number => (p.acesso === 'ok' ? p.dado.descartados : 0)

/**
 * Página do canal e do vídeo próprio: erro de leitura é LANÇADO (D5; a `error.tsx` da rota aparece, nunca um canal vazio).
 * `longosAcompanhados` = os ytIds de `longosAcompanhadosDe`. Sem token: as duas respostas são 'negado', sem consulta.
 */
export async function lerDadosDoCanal(a: { canalId: string; longosAcompanhados: readonly string[]; agora: number; edicao: EdicaoDoSite | null }): Promise<DadosDoCanal> {
  if (!edicaoValida(a.edicao)) return NEGADO
  const sb = getSupabaseServiceClient()
  const pedido = { edicao: a.edicao, canalId: a.canalId, hoje: dayPt(new Date(a.agora)) }
  const [alcance, diario] = await Promise.all([lerAlcance(sb, pedido), lerDiario(sb, { ...pedido, ytIds: a.longosAcompanhados })])
  avisarDescartados(a.edicao.siteId, descartadosDe(alcance) + descartadosDe(diario))
  return { alcance, diario }
}

/** O que a tela do vídeo próprio lê: o alcance e o diário do canal (a taxa do canal, o normal da faixa e o "normal do canal" precisam dos outros vídeos). */
export interface DadosDoVideo { alcance: AlcanceCanal; diario: DiarioCanal }

/**
 * Tela do vídeo próprio: UMA leitura (alcance + diário) depois do token, num `Privado` só. `ytId` (o vídeo da tela) vai na FRENTE
 * da lista pedida ao diário, para o teto de vídeos nunca cortá-lo, e sem duplicar quando já está em `longosAcompanhados`.
 * Sem token: 'negado' e nenhum cliente de serviço (nenhum número). Erro de leitura é LANÇADO (D5), nunca 'erro' nem vazio.
 */
export async function lerDadosDoVideo(a: { canalId: string; ytId: string; longosAcompanhados: readonly string[]; agora: number; edicao: EdicaoDoSite | null }): Promise<Privado<DadosDoVideo>> {
  if (!edicaoValida(a.edicao)) return { acesso: 'negado' }
  const ytIds = [a.ytId, ...a.longosAcompanhados.filter(y => y !== a.ytId)]
  const { alcance, diario } = await lerDadosDoCanal({ canalId: a.canalId, longosAcompanhados: ytIds, agora: a.agora, edicao: a.edicao })
  // com token válido as duas leituras são 'ok' ou lançam; isto só fecha o tipo (e se um dia não for, é 'erro', nunca 'negado')
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') return { acesso: 'erro' }
  return { acesso: 'ok', dado: { alcance: alcance.dado, diario: diario.dado } }
}

/**
 * Lista de Canais e comparação: um canal que falha vira { acesso: 'erro' } (a tela não cai por causa do dado privado) e UM
 * aviso para a requisição inteira, com a contagem de falhas (D5; nunca um por canal nem por linha). Idem para as linhas
 * descartadas. Sem canal próprio ou sem token: nenhuma consulta. No máximo 4 canais em voo.
 */
export async function lerDiarioDosCanais(
  a: { canais: ReadonlyArray<{ id: string; longosAcompanhados: readonly string[] }>; agora: number; edicao: EdicaoDoSite | null },
  avisar?: (e: unknown, n: number) => void,
): Promise<Map<string, Privado<DiarioCanal>>> {
  const out = new Map<string, Privado<DiarioCanal>>()
  if (!edicaoValida(a.edicao)) {
    for (const c of a.canais) out.set(c.id, { acesso: 'negado' })
    return out
  }
  if (a.canais.length === 0) return out
  const { siteId } = a.edicao
  const edicao = a.edicao
  const sb = getSupabaseServiceClient()
  const hoje = dayPt(new Date(a.agora))
  const falhas: unknown[] = []
  const lidos = await mapLimit(a.canais, CANAIS_EM_VOO, async (c): Promise<Privado<DiarioCanal>> => {
    try { return await lerDiario(sb, { edicao, canalId: c.id, hoje, ytIds: c.longosAcompanhados }) } catch (e) { falhas.push(e); return { acesso: 'erro' } }
  })
  a.canais.forEach((c, i) => out.set(c.id, lidos[i]!))
  if (falhas.length > 0) {
    const padrao = (e: unknown, n: number) => Sentry.captureMessage('observatório: leitura do diário dos canais próprios falhou', {
      level: 'warning', tags: TAGS, extra: { siteId, falhas: n, primeiroErro: e instanceof Error ? e.message : String(e) },
    })
    ;(avisar ?? padrao)(falhas[0], falhas.length)
  }
  avisarDescartados(siteId, lidos.reduce((s, l) => s + descartadosDe(l), 0))
  return out
}

/** Os ytIds dos longos acompanhados de um canal próprio, na ordem do motor (mais novo primeiro). */
export function longosAcompanhadosDe(obs: Pick<Observatory, 'videos'>, canalId: string): string[] {
  return longosAcompanhados(obs, canalId)
}
