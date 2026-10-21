/**
 * Decisão 75: o estado de uma ausência de número. Sem React, importável por modelo.
 * `nao_medido` = a hachura de sempre; `falhou` = a leitura deu erro; `restrito` = o sistema TEM certeza de que o dono não pode ver.
 */
import type { MotivoSemVpd } from '@/lib/youtube/observatorio/proprio/vpd'
import type { MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'

export type EstadoAusencia = 'nao_medido' | 'falhou' | 'restrito'

export const ROTULO_AUSENCIA: Record<EstadoAusencia, string> = { nao_medido: 'não medido', falhou: 'falhou', restrito: 'restrito' }

export type NegativaPrivada = 'sem_direito' | 'nao_foi_possivel_conferir' | null

/** ok→null; erro→falhou; negado→restrito SÓ com `sem_direito`. Guarda de permissão caída (ou negativa não preenchida) nunca vira cadeado. */
export function ausenciaDoAcesso(a: 'ok' | 'negado' | 'erro', negativa: NegativaPrivada): EstadoAusencia | null {
  if (a === 'ok') return null
  if (a === 'erro') return 'falhou'
  return negativa === 'sem_direito' ? 'restrito' : 'falhou'
}

/** O motivo escrito quando a ausência vem de negado sem prova de direito. */
export const MOTIVO_GUARDA_CAIDA = 'não deu para conferir a permissão agora'

const MAPA: Record<MotivoNaoMedido, EstadoAusencia> = {
  leitura_comecou_depois: 'nao_medido', descoberto_tarde: 'nao_medido', leitura_parou_antes: 'nao_medido', leituras_distantes: 'nao_medido',
  sem_leitura: 'nao_medido', views_ocultas: 'nao_medido', fecha_em: 'nao_medido', aguardando_calculo: 'nao_medido', poucos_videos: 'nao_medido',
  poucas_publicacoes: 'nao_medido', ritmo_parcial: 'nao_medido', canal_novo: 'nao_medido', sem_publicacao: 'nao_medido', sem_registro_recente: 'nao_medido',
  sem_registro_na_borda: 'nao_medido', pouco_registro: 'nao_medido', janela_cruza_mudanca_de_contagem: 'nao_medido', contagem_recuou: 'nao_medido',
  base_zero: 'nao_medido', poucas_views: 'nao_medido', poucas_curtidas: 'nao_medido', sem_v30: 'nao_medido', idade_menor_que_90: 'nao_medido',
  ao_vivo_ou_estreia: 'nao_medido', formato_nao_confirmado: 'nao_medido', sem_reacao_publica: 'nao_medido', curtidas_ocultas: 'nao_medido',
  retrato_ausente: 'nao_medido', sem_multiplo: 'nao_medido', serie_nao_pedida: 'nao_medido', serie_diaria_incompleta: 'nao_medido',
  arquivado: 'nao_medido', sem_permissao: 'restrito', leitura_falhou: 'falhou', calculo_falhou: 'falhou', coleta_pausada: 'nao_medido',
  nao_se_aplica: 'nao_medido',
}

/** `sem_permissao` só é restrito no lado próprio: no canal de fora (`nao_pedido`, leitura sem prova) segue "não medido". */
export function ausenciaDoMotivoNaoMedido(m: MotivoNaoMedido, lado: { proprio: boolean }): EstadoAusencia {
  const e = MAPA[m]
  return e === 'restrito' && !lado.proprio ? 'nao_medido' : e
}

/** Views por dia / % assistido: `sem-acesso` só vira cadeado com a prova de que não há direito (`sem_direito`); guarda caída vira falhou. Motivo desconhecido = nao_medido. */
export function ausenciaDoVpdComNegativa(m: string | null, negativa: NegativaPrivada): EstadoAusencia | null {
  if (m === null) return null
  if (m === 'sem-acesso') return ausenciaDoAcesso('negado', negativa)
  if (m === 'leitura-falhou') return 'falhou'
  return 'nao_medido'
}
