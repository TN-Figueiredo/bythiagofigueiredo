import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { anotarPausaDetectado } from './anotar-log'
import type { PontoDaGuarda } from './anotar-log'
import { modoPausaPorDetectado } from './flag'
import { retomarAPartirDe } from './lista'
import { MOTIVO_GUARDA_FALHOU, MOTIVO_RECUSA_NATIVO, bloqueadoComRetentativa, decidirGuarda } from './guarda'

export type CodigoRecusaNativa = 'teste_youtube' | 'guarda_falhou'
export type ResultadoGuardaDoPonto = { seguir: true } | { seguir: false; codigo: CodigoRecusaNativa; motivo: string; nativeTestId?: string; ate?: string }

/**
 * Guarda de UM teste nosso num ponto de recusa (start, retomar, forçar rotação): confere o vídeo e decide.
 * Falha na consulta = recusa (falha fechada). `log` anota e segue; `on` e linha confirmada recusam.
 */
export async function guardaDoPonto(
  sb: SupabaseClient,
  a: { siteId: string; testId: string; videoId: string; ponto: PontoDaGuarda },
): Promise<ResultadoGuardaDoPonto> {
  const r = await bloqueadoComRetentativa(sb, a.siteId, [a.videoId])
  if (!r.ok) {
    Sentry.captureMessage('ab-guarda-nativa: consulta falhou', { level: 'error', extra: { testId: a.testId, ponto: a.ponto, erro: r.erro } })
    return { seguir: false, codigo: 'guarda_falhou', motivo: MOTIVO_GUARDA_FALHOU }
  }
  const linha = r.linhas.get(a.videoId)
  const d = decidirGuarda(linha, modoPausaPorDetectado())
  if (d.acao === 'seguir') return { seguir: true }
  if (d.acao === 'seguir_e_anotar') {
    await anotarPausaDetectado(sb, { siteId: a.siteId, orgId: null, testId: a.testId, videoId: a.videoId, nativeTestId: d.nativeTestId, ponto: a.ponto })
    return { seguir: true }
  }
  // A data do "até dd/mm" só existe se a linha trouxe `created_at`; sem ela não se inventa (o cliente cai na frase sem data).
  const ate = typeof linha?.created_at === 'string'
    ? retomarAPartirDe({ primeiraVista: linha.primeira_vista ?? null, confirmadoEm: linha.confirmado_em, createdAt: linha.created_at }).toISOString()
    : undefined
  return { seguir: false, codigo: 'teste_youtube', motivo: MOTIVO_RECUSA_NATIVO, nativeTestId: d.nativeTestId, ...(ate ? { ate } : {}) }
}
