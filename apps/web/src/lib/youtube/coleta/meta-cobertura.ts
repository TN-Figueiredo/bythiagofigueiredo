// A5 · E18 parte 2: a cobertura de metadados. Depois de gravar as linhas do dia, o passo de metadados chama
// `yt_own_meta_cover` uma vez por canal: ela diz "este dia foi conferido" (conjuntos meta_texto e meta_thumb) e, quando a MG17
// estiver em produção, enxuga as sequências de dias idênticos. Aqui só vive o contrato e as notas; a função é do banco.
//
// Regra do módulo: dado ausente ou fora da forma NUNCA vira zero. Uma resposta sem linha avaliada é falha, não "tudo certo".
// Nenhuma nota leva título, descrição, URL nem texto do Postgres: só contagens, códigos de uma lista fechada e o nome do canal.
import * as Sentry from '@sentry/nextjs'
import { comPrazo } from './clock'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx } from './types'

export const VARIAVEL_DIETA_OFF = 'YT_OWN_META_DIETA_OFF'

const ESTADOS = ['feita', 'desligada', 'sem_estado', 'indisponivel'] as const
export type EstadoCompactacao = (typeof ESTADOS)[number]

export interface CoberturaCanal {
  texto: number
  thumb: number
  linhas: number
  descobertas: number
  semExplicacao: number
  compactacao: EstadoCompactacao
  compactadas: number
}

export interface CoberturaMetaResumo {
  pedida: boolean
  canais: number
  ok: number
  falhas: number
  sem_tempo: boolean
  texto: number
  thumb: number
  descobertas: number
  sem_explicacao: number
  compactadas: number
  compactacao: Partial<Record<EstadoCompactacao, number>>
}

/** Recusas que a função do banco lança de propósito (`raise exception '<código>'`). Qualquer outro texto vira `erro_desconhecido`. */
export const RECUSAS_DA_COBERTURA: readonly string[] = ['argumento_nulo', 'canal_fora_do_site', 'conjunto_invalido']

const DESLIGA = ['1', 'true', 'sim']

function lerVariavel(env: NodeJS.ProcessEnv): string {
  return (env[VARIAVEL_DIETA_OFF] ?? '').trim().toLowerCase()
}

/** Ausente ou vazia: true. '1', 'true', 'sim' (sem diferenciar maiúsculas, espaços tolerados): false. Outro valor: true. */
export function compactacaoPedida(env: NodeJS.ProcessEnv = process.env): boolean {
  return !DESLIGA.includes(lerVariavel(env))
}

/** Valor que não é vazio nem um dos que desligam: a dieta segue ligada e o dono é avisado. */
export function notaValorDesconhecido(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = lerVariavel(env)
  if (v === '' || DESLIGA.includes(v)) return null
  return `${VARIAVEL_DIETA_OFF} tem valor desconhecido`
}

const ehNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Forma inesperada devolve null. Nunca devolve zeros inventados. */
export function lerRespostaCobertura(data: unknown): CoberturaCanal | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (d.resultado !== 'ok') return null
  const { texto, thumb, linhas, descobertas, sem_explicacao: semExplicacao, compactadas, compactacao } = d
  if (!ehNumero(texto) || !ehNumero(thumb) || !ehNumero(linhas) || !ehNumero(descobertas) || !ehNumero(semExplicacao) || !ehNumero(compactadas)) return null
  if (typeof compactacao !== 'string' || !(ESTADOS as readonly string[]).includes(compactacao)) return null
  return { texto, thumb, linhas, descobertas, semExplicacao, compactacao: compactacao as EstadoCompactacao, compactadas }
}

function resumoVazio(pedida: boolean, canais: number): CoberturaMetaResumo {
  return { pedida, canais, ok: 0, falhas: 0, sem_tempo: false, texto: 0, thumb: 0, descobertas: 0, sem_explicacao: 0, compactadas: 0, compactacao: {} }
}

/**
 * Chama a cobertura de cada canal recebido (o chamador manda só os que têm vídeo publicado). Não lança: a chamada de cada canal
 * vai num try/catch, porque uma exceção aqui descartaria o resumo inteiro do passo com as linhas já gravadas.
 */
export async function cobrirMetadados(ctx: StepCtx, day: string, canais: readonly ColetaChannel[]): Promise<CoberturaMetaResumo> {
  const resumo = resumoVazio(compactacaoPedida(), canais.length)
  const aviso = notaValorDesconhecido()
  if (aviso) pushUnico(ctx.falhas, aviso)
  if (!resumo.pedida) pushUnico(ctx.falhas, `metadados: a dieta diária está desligada por ${VARIAVEL_DIETA_OFF}`)

  let semTempo = 0
  for (const c of canais) {
    const pedida = compactacaoPedida()
    let res: { data: unknown; error: { code?: string | null; message?: string | null } | null } | null
    try {
      res = await comPrazo(
        Promise.resolve(ctx.supabase.rpc('yt_own_meta_cover', { p_site_id: c.site_id, p_channel_id: c.id, p_day: day, p_compactar: pedida })),
        ctx.deadline,
      )
    } catch (e) {
      resumo.falhas++
      pushUnico(ctx.falhas, `metadados: cobertura de ${c.name} falhou na chamada`)
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados', etapa: 'cobertura' }, extra: { canal: c.channel_id } })
      continue
    }
    if (res === null) { semTempo++; continue }

    if (res.error) {
      resumo.falhas++
      if (res.error.code === 'P0001') {
        const msg = (res.error.message ?? '').trim()
        pushUnico(ctx.falhas, `metadados: cobertura de ${c.name} recusada (${RECUSAS_DA_COBERTURA.includes(msg) ? msg : 'erro_desconhecido'})`)
      } else {
        conferirBanco(res, 'yt_own_meta_cover', ctx.falhas)
      }
      continue
    }

    const r = lerRespostaCobertura(res.data)
    if (r === null) {
      resumo.falhas++
      pushUnico(ctx.falhas, `metadados: cobertura de ${c.name} respondeu fora da forma`)
      continue
    }
    if (r.linhas === 0) {
      resumo.falhas++
      pushUnico(ctx.falhas, `metadados: cobertura de ${c.name} não avaliou nenhuma linha`)
      continue
    }

    resumo.ok++
    resumo.texto += r.texto
    resumo.thumb += r.thumb
    resumo.descobertas += r.descobertas
    resumo.sem_explicacao += r.semExplicacao
    resumo.compactadas += r.compactadas
    resumo.compactacao[r.compactacao] = (resumo.compactacao[r.compactacao] ?? 0) + 1
    if (r.descobertas > 0) pushUnico(ctx.falhas, `metadados: ${r.descobertas} linha(s) com captura fora da cobertura em ${c.name}`)
    if (r.semExplicacao > 0) pushUnico(ctx.falhas, `metadados: ${r.semExplicacao} dia(s) coberto(s) sem linha e fora de uma sequência igual em ${c.name}`)
    if (pedida && r.compactacao === 'desligada') {
      pushUnico(ctx.falhas, `metadados: a compactação está desligada no banco em ${c.name} (religar: docs/ops/sql/dieta-meta-religar-compactacao.sql)`)
    }
  }

  if (semTempo > 0) {
    resumo.sem_tempo = true
    pushUnico(ctx.falhas, `metadados: cobertura de metadados sem tempo em ${semTempo} canal(is)`)
  }
  return resumo
}
