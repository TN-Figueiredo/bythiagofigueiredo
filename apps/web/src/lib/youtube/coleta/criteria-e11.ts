// A5 · E11: os alarmes do passo "dimensões" e dos normalizadores. Só LEEM (a prova `yt_own_dim_prova`) e decidem
// se o cron fica vermelho: cada nota entra em `falhas` por `pushUnico`, e a rota dá o veredito num lugar só.
//
// REGRA DESTE ARQUIVO: prova que não existe NUNCA vira zero. Função ausente, resposta nula, chave faltando,
// erro de banco, tempo esgotado, lista de sites vazia, data ou configuração inválida: tudo vira nota escrita.
// Verde só aparece quando a prova veio inteira e o número realmente não passa do limite.
// Nenhuma nota leva texto do Postgres nem conteúdo de dimensão (só contagens, datas e o id do site).

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from './day-pt'
import {
  CARENCIA_COBERTURA_DIAS, CARENCIA_NORMALIZAR_DIAS, PRAZO_DA_PROVA_MS,
  chamarProva, configE11, type ConfigE11, type ProvaE11, type ResultadoProva,
} from './e11-config'
import type { PassoComInterruptor } from './passos-desligados'
import { ehSchemaAusente, pushUnico, type ErroBanco } from './schema'

export type CriteriosE11Ctx = {
  supabase: SupabaseClient
  falhas: string[]
  /** Hoje no Pacífico, `AAAA-MM-DD`. */
  hoje: string
  e11: ConfigE11
  /** Sites dos canais com coleta ligada (hoje, um). */
  sites: string[]
  desligados: { dimensoes: boolean; normalizadores: boolean }
}

export type CriteriosE11Resultado = {
  /** Uma entrada por site consultado; `null` = a prova não veio inteira (a nota já está em `falhas`). */
  provas: Record<string, ProvaE11 | null>
  /** Passos cujos critérios rodaram com a prova inteira em todos os sites. */
  avaliados: string[]
  /** Passos desligados: o orquestrador grava `desligado`, nunca "ok". */
  desligados: PassoComInterruptor[]
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/

function diaValido(s: unknown): s is string {
  if (typeof s !== 'string' || !FORMATO_DIA.test(s)) return false
  const d = new Date(`${s}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** `AAAA-MM-DD` para `dd/mm`. */
function ddmm(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

/**
 * `schema_ausente` pode ser a MG7 (a função da prova) ou a MG14 (a tabela de cobertura de que a MG7 depende).
 * Um select de 1 linha na cobertura decide qual migration falta; se ele não responde, vale a MG7. Sem texto do Postgres.
 */
async function qualMigrationFalta(sb: SupabaseClient): Promise<string> {
  const mg7 = 'migration MG7 não aplicada: falta a função yt_own_dim_prova'
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const limite = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), PRAZO_DA_PROVA_MS) })
    const res = (await Promise.race([Promise.resolve(sb.from('yt_own_video_coverage').select('youtube_video_id').limit(1)), limite])) as
      { error: ErroBanco | null } | null
    return res && ehSchemaAusente(res.error) ? 'migration MG14 não aplicada: falta a tabela yt_own_video_coverage' : mg7
  } catch {
    return mg7
  } finally {
    clearTimeout(timer)
  }
}

async function motivoDaProva(r: Extract<ResultadoProva, { ok: false }>, sb: SupabaseClient): Promise<string> {
  switch (r.motivo) {
    case 'schema_ausente': return qualMigrationFalta(sb)
    case 'sem_resposta': return 'sem resposta em 5 s'
    case 'erro_de_banco': return 'erro de banco'
    case 'forma_inesperada': return `forma inesperada: ${r.campo && r.campo !== '(resposta)' ? r.campo : 'resposta'}`
  }
}

export async function criteriosE11(ctx: CriteriosE11Ctx): Promise<CriteriosE11Resultado> {
  const { falhas, hoje } = ctx
  const dimLigado = !ctx.desligados.dimensoes
  const normLigado = !ctx.desligados.normalizadores
  const desligados = [ctx.desligados.dimensoes ? 'dimensoes' : null, ctx.desligados.normalizadores ? 'normalizadores' : null]
    .filter((x): x is PassoComInterruptor => x !== null)
  const provas: Record<string, ProvaE11 | null> = {}
  if (!dimLigado && !normLigado) return { provas, avaliados: [], desligados }

  // Sem prova não há critério: tudo abaixo é nota escrita, nunca silêncio.
  const semProva = (motivo: string, site?: string): CriteriosE11Resultado => {
    pushUnico(falhas, `dimensões: prova não avaliada (${motivo})${site ? ` [site ${site}]` : ''}`)
    return { provas, avaliados: [], desligados }
  }

  if (!diaValido(hoje)) return semProva('data de hoje inválida')
  const cfg = configE11(typeof ctx.e11 === 'object' && ctx.e11 !== null ? ctx.e11 : {})
  if (!cfg.ok) return semProva(cfg.motivo)
  // Teto de folga: uma data de ligação absurda (2099) viraria carência eterna e a prova nunca subiria.
  if (cfg.ligadoEm > addDays(hoje, 90)) return semProva('configuração das dimensões: ligadoEm está a mais de 90 dias no futuro')
  const sites = [...new Set(Array.isArray(ctx.sites) ? ctx.sites : [])]
  if (sites.length === 0) return semProva('nenhum site com coleta ligada para avaliar')

  const varios = sites.length > 1
  const suf = (site: string): string => (varios ? ` [site ${site}]` : '')
  const desdeCobertura = addDays(cfg.ligadoEm, CARENCIA_COBERTURA_DIAS)
  const desdeFila = addDays(cfg.ligadoEm, CARENCIA_NORMALIZAR_DIAS)
  const limiteBase = addDays(hoje, -4)
  let todasInteiras = true

  for (const site of sites) {
    if (typeof site !== 'string' || site === '') {
      todasInteiras = false
      pushUnico(falhas, 'dimensões: prova não avaliada (site sem id)')
      continue
    }
    let r: ResultadoProva
    try {
      r = await chamarProva(ctx.supabase, { site, hoje, desde: cfg.desde }, Date.now() + PRAZO_DA_PROVA_MS)
    } catch {
      r = { ok: false, motivo: 'erro_de_banco' }
    }
    if (!r.ok) {
      provas[site] = null
      todasInteiras = false
      pushUnico(falhas, `dimensões: prova não avaliada (${await motivoDaProva(r, ctx.supabase)})${suf(site)}`)
      continue
    }
    const p = r.prova
    // Vídeos com base e sem o dia da base: a prova veio incoerente, e "sem atraso" seria um verde falso.
    if (dimLigado && p.videos_com_base > 0 && p.base_ate === null) {
      provas[site] = null
      todasInteiras = false
      pushUnico(falhas, `dimensões: prova não avaliada (forma inesperada: base_ate)${suf(site)}`)
      continue
    }
    provas[site] = p

    if (dimLigado) {
      if (p.videos_com_base === 0 && p.videos_sem_base > 0) {
        pushUnico(falhas, `dimensões: nenhum vídeo com cobertura do diário (base): confira se a dieta (E6 P2) está em produção${suf(site)}`)
      }
      if (p.videos_com_base > 0 && p.base_ate !== null && p.base_ate < limiteBase) {
        pushUnico(falhas, `dimensões: a cobertura do diário (base) parou em ${ddmm(p.base_ate)} no canal mais atrasado${suf(site)}`)
      }
      if (p.faltando_cobertura > 0 && hoje >= desdeCobertura) {
        const ate = p.base_ate !== null && p.base_ate < limiteBase ? p.base_ate : limiteBase
        pushUnico(falhas, `dimensões: ${p.faltando_cobertura} par(es) vídeo e conjunto sem cobertura até ${ddmm(ate)} (origem, aparelho, país ou inscrito)${suf(site)}`)
      }
    }
    if (normLigado) {
      const dois = p.dias_dois_relatorios_detalhe + p.dias_dois_relatorios_alcance
      if (dois > 0) {
        pushUnico(falhas, `normalizadores: ${dois} dia(s) com linhas de dois relatórios (item 249)${suf(site)}`)
      }
      if (p.pendentes_normalizar > 0 && hoje >= desdeFila) {
        pushUnico(falhas, `normalizadores: ${p.pendentes_normalizar} relatório(s) baixado(s) há mais de 2 dias sem normalizar${suf(site)}`)
      }
    }
  }

  const avaliados = todasInteiras
    ? [dimLigado ? 'dimensoes' : null, normLigado ? 'normalizadores' : null].filter((x): x is string => x !== null)
    : []
  return { provas, avaliados, desligados }
}
