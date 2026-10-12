// E19: registro das leituras do pipeline feitas por chave. Vai para audit_log (dura os 7 dias; o log da Vercel não dura).
// site_id NULO de propósito: com o site da chave, o feed de atividade do painel (fetchActivityFeed) mostraria estas linhas.
import * as Sentry from '@sentry/nextjs'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requirePermission, type PipelineAuth } from './auth'
import { modoLeitura } from './leitura-modo'

// (emenda do portão: S19-M7) As quatro constantes moram em leitura-acoes.ts, que não importa nada: a tela de /admin/audit
// as usa sem carregar o Sentry nem o cliente de serviço.
import { ACAO_AVISO, ACAO_RECUSA, ACOES_DE_LEITURA, RECURSO_CHAVE } from './leitura-acoes'
export { ACAO_AVISO, ACAO_RECUSA, ACOES_DE_LEITURA, RECURSO_CHAVE }
/** Passado isto no dia (as duas ações somadas), o registro cai para uma linha por chave, rota, método e dia. */
export const TETO_LINHAS_DIA = 5000
/** Do dia seguinte a este em diante, sem a janela fechar, vale o modo reduzido. */
export const DIAS_CORRIDOS_CHEIOS = 14
const TTL_CONTAGEM_MS = 5 * 60_000

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Caminho sem query string (pode trazer texto de busca), com ids trocados por marcador para a lista agrupar por rota. */
export function rotaNormalizada(pathname: string): string {
  return pathname.replace(UUID, ':id').replace(/\/\d+(?=\/|$)/g, '/:n').slice(0, 200)
}

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export function diaSP(d: Date): string {
  return FMT_SP.format(d)
}
/** São Paulo é UTC−3 o ano todo desde 2019 (sem horário de verão): o dia começa às 03:00 UTC. */
export function inicioDoDiaSP(dia: string): string {
  return `${dia}T03:00:00.000Z`
}
/** O dia `desde` é o dia 1. */
export function diasCorridos(desde: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1
}

// Estado por instância: só economiza consultas. A regra vale pelo banco.
let contagem: { dia: string; n: number; lidaEm: number } | null = null
let diaDosVistos = ''
const vistos = new Set<string>()
let avisouAtraso = ''
let avisouTeto = ''
const ultimaFalha: { gravacao: number; contagem: number } = { gravacao: 0, contagem: 0 }
export function zerarEstadoDoRegistro(): void {
  contagem = null
  diaDosVistos = ''
  vistos.clear()
  avisouAtraso = ''
  avisouTeto = ''
  ultimaFalha.gravacao = 0
  ultimaFalha.contagem = 0
}

/**
 * (emenda do portão: S19-M1) Uma captura por instância, por hora e por tipo: gravação recusada de forma sistemática não vira
 * um evento por leitura. `tipo: 'gravacao'` é o que marca o dia como "não medido" no fechamento da janela (a linha pode não
 * ter sido gravada); `'contagem'` não marca (a linha foi gravada, só o teto ficou sem número).
 */
function avisarFalha(tipo: 'gravacao' | 'contagem', e: unknown): void {
  const agora = Date.now()
  if (agora - ultimaFalha[tipo] < 3_600_000) return
  ultimaFalha[tipo] = agora
  Sentry.captureException(e, { tags: { component: 'pipeline', action: 'leitura_registro', tipo }, level: 'warning' })
}

type Cliente = ReturnType<typeof getSupabaseServiceClient>

async function linhasDeHoje(supabase: Cliente, hoje: string, agoraMs: number, sinal: AbortSignal): Promise<number> {
  if (contagem && contagem.dia === hoje && agoraMs - contagem.lidaEm < TTL_CONTAGEM_MS) return contagem.n
  const r = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .is('site_id', null)
    .in('action', [...ACOES_DE_LEITURA])
    .gte('created_at', inicioDoDiaSP(hoje))
    .abortSignal(sinal)
  if (r.error || r.count === null) {
    // Contagem indisponível não cala o registro: segue cheio (prefere medir) e avisa.
    avisarFalha('contagem', new Error(`pipeline leitura: contagem do teto indisponível (${r.error?.code ?? 'sem contagem'})`))
    return contagem && contagem.dia === hoje ? contagem.n : 0
  }
  contagem = { dia: hoje, n: r.count, lidaEm: agoraMs }
  return r.count
}

/** (emenda do portão: S19-I5) Teto de tempo do registro INTEIRO: contagem, conferência de duplicata e gravação somadas. */
export const TETO_REGISTRO_MS = 1500

/**
 * Grava a linha da leitura. NUNCA lança, e nunca segura a leitura por mais de TETO_REGISTRO_MS: em modo aviso a leitura
 * passa mesmo se o registro falhar ou o banco não responder (o erro vai ao Sentry, e o dia em que houve falha é "não
 * medido" no fechamento da janela).
 * `desfecho = 'aviso'`: a leitura foi aceita. `'recusada'`: a chave recebeu 403.
 */
export async function registrarLeitura(req: NextRequest, auth: PipelineAuth, desfecho: 'aviso' | 'recusada'): Promise<void> {
  if (auth.source !== 'api_key' || !auth.keyId) return
  const corte = new AbortController()
  let relogio: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      gravar(req, auth, auth.keyId, desfecho, corte.signal),
      new Promise<never>((_, recusar) => {
        relogio = setTimeout(() => {
          corte.abort()   // cancela as idas ao banco que ainda estiverem no ar
          recusar(new Error(`registro de leitura passou de ${TETO_REGISTRO_MS} ms`))
        }, TETO_REGISTRO_MS)
      }),
    ])
  } catch (e) {
    avisarFalha('gravacao', e)
  } finally {
    clearTimeout(relogio)
  }
}

async function gravar(req: NextRequest, auth: PipelineAuth, keyId: string, desfecho: 'aviso' | 'recusada', sinal: AbortSignal): Promise<void> {
  const cfg = modoLeitura()
  const agora = new Date()
  const hoje = diaSP(agora)
  const temRead = requirePermission(auth, 'read')
  const emConferencia = cfg.modo === 'recusa' && !!cfg.conferenciaAte && agora.getTime() <= Date.parse(cfg.conferenciaAte)
  // Linha de controle (leitura aceita de chave COM read): tem fim.
  if (desfecho === 'aviso' && temRead) {
    if (cfg.modo === 'recusa' ? !emConferencia : cfg.controleFechadoEm !== null) return
  }
  // No modo recusa, leitura aceita sem read não existe (seria recusada); nada a gravar fora da conferência.
  if (desfecho === 'aviso' && cfg.modo === 'recusa' && !emConferencia) return

  const action = desfecho === 'recusada' ? ACAO_RECUSA : ACAO_AVISO
  const rota = rotaNormalizada(req.nextUrl.pathname)
  const metodo = req.method
  const supabase = getSupabaseServiceClient()

  const passouDoPrazo = cfg.modo === 'aviso' && diasCorridos(cfg.avisoDesde, hoje) > DIAS_CORRIDOS_CHEIOS
  if (passouDoPrazo && avisouAtraso !== hoje) {
    avisouAtraso = hoje
    Sentry.captureMessage(`pipeline: modo aviso da leitura aberto há ${diasCorridos(cfg.avisoDesde, hoje)} dias sem fechar (E19); registro reduzido`, 'warning')
  }
  // (emenda do portão: D-I4) O registro cheio tem fim nos DOIS modos. Aviso: até o 14º dia corrido. Recusa: só nas 48 horas
  // da conferência; depois, uma linha por chave, rota, método e dia, para sempre. Modo recusa sem `conferenciaAte` (não
  // deveria ser publicado: um teste prende) cai no reduzido, nunca no cheio.
  const foraDoCheio = cfg.modo === 'recusa' ? !emConferencia : passouDoPrazo
  const noTeto = !foraDoCheio && (await linhasDeHoje(supabase, hoje, agora.getTime(), sinal)) >= TETO_LINHAS_DIA
  // (emenda do portão: D-M10) Um laço de uma chave aparece no dia, não só na conferência seguinte.
  if (noTeto && avisouTeto !== hoje) {
    avisouTeto = hoje
    Sentry.captureMessage(`pipeline: o registro de leitura bateu no teto de ${TETO_LINHAS_DIA} linhas hoje (E19); registro reduzido até o fim do dia e contagem de vezes cortada`, 'warning')
  }
  const reduzido = foraDoCheio || noTeto
  const marca = `${keyId}|${rota}|${metodo}|${action}|${temRead}`
  if (reduzido) {
    if (diaDosVistos !== hoje) {
      vistos.clear()
      diaDosVistos = hoje
    }
    if (vistos.has(marca)) return
    const ja = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .is('site_id', null)
      .eq('action', action)
      .gte('created_at', inicioDoDiaSP(hoje))
      .eq('after_data->>key_id', keyId)
      .eq('after_data->>rota', rota)
      .eq('after_data->>metodo', metodo)
      .abortSignal(sinal)
    if (!ja.error && (ja.count ?? 0) > 0) {
      vistos.add(marca)
      return
    }
    // Conferência que falha: grava (prefere medir).
  }

  const { error } = await supabase
    .from('audit_log')
    .insert({
      action,
      resource_type: RECURSO_CHAVE,
      site_id: null,
      after_data: { site_id: auth.siteId, key_id: keyId, key_name: auth.keyName ?? null, rota, metodo, tem_read: temRead },
    })
    .abortSignal(sinal)
  if (error) throw new Error(`audit_log recusou a linha de leitura (${error.code ?? 'sem código'})`)
  if (reduzido) vistos.add(marca)
  if (contagem && contagem.dia === hoje) contagem.n++
}
