/** Forma das medidas e dos estados (plano A5 E4, 4.5). As medidas NÃO escrevem frase: quem escreve é a E5, a partir do código. */

/** Datas `AAAA-MM-DD` de São Paulo. */
export interface Janela { de: string | null; ate: string | null; dias: number | null }

export type Nota =
  | { tipo: 'mudanca_de_contagem' }
  | { tipo: 'ao_vivo_fora'; n: number }
  | { tipo: 'fora_do_ar_dentro'; n: number }
  | { tipo: 'formato_nao_confirmado_fora'; n: number }
  | { tipo: 'ao_vivo_nao_se_sabe'; n: number }
  | { tipo: 'total_de_hoje' }
  | { tipo: 'so_curtidas' }
  | { tipo: 'so_comentarios' }
  | { tipo: 'serie_semanal' }
  | { tipo: 'agendado_fora'; n: number }

export const MOTIVOS_NAO_MEDIDO = [
  'leitura_comecou_depois', 'descoberto_tarde', 'leitura_parou_antes', 'leituras_distantes', 'sem_leitura', 'views_ocultas',
  'fecha_em', 'aguardando_calculo', 'poucos_videos', 'poucas_publicacoes', 'ritmo_parcial', 'sem_publicacao',
  'sem_registro_recente', 'sem_registro_na_borda', 'pouco_registro', 'janela_cruza_mudanca_de_contagem', 'contagem_recuou',
  'base_zero', 'poucas_views', 'poucas_curtidas', 'sem_v30', 'idade_menor_que_90', 'ao_vivo_ou_estreia', 'formato_nao_confirmado',
  'sem_reacao_publica', 'curtidas_ocultas', 'retrato_ausente', 'sem_multiplo', 'serie_nao_pedida', 'serie_diaria_incompleta',
  'arquivado', 'sem_permissao', 'leitura_falhou', 'calculo_falhou', 'coleta_pausada',
] as const
export type MotivoNaoMedido = typeof MOTIVOS_NAO_MEDIDO[number]

/** Os seis motivos de uma marca de idade que não pôde ser medida, na ordem em que são decididos (plano 4.2). */
export const FALTAS_DE_MARCA = [
  'views_ocultas', 'sem_leitura', 'descoberto_tarde', 'leitura_comecou_depois', 'leitura_parou_antes', 'leituras_distantes',
] as const
export type FaltaDeMarca = typeof FALTAS_DE_MARCA[number]

export type Formato = 'long' | 'short'

export type Medida<T> =
  | { estado: 'medido'; valor: T; n: number; janela: Janela; notas: Nota[] }
  | { estado: 'nao_medido'; motivo: MotivoNaoMedido; desde?: string; fechaEm?: string; n?: number; minimo?: number; notas: Nota[] }

function temNaoFinito(x: unknown): boolean {
  if (typeof x === 'number') return !Number.isFinite(x)
  if (Array.isArray(x)) return x.some(temNaoFinito)
  if (x !== null && typeof x === 'object') return Object.values(x).some(temNaoFinito)
  return false
}

/** Última barreira contra `NaN` e `Infinity`: lança se o valor (ou algo dentro dele) ou o `n` não for finito. */
export function medido<T>(valor: T, n: number, janela: Janela, notas: Nota[] = []): Medida<T> {
  if (temNaoFinito(valor) || !Number.isFinite(n)) throw new Error('medida_nao_finita')
  return { estado: 'medido', valor, n, janela, notas }
}

export function naoMedido(
  motivo: MotivoNaoMedido,
  extra: { desde?: string; fechaEm?: string; n?: number; minimo?: number; notas?: Nota[] } = {},
): Medida<never> {
  const { notas, ...resto } = extra
  return { estado: 'nao_medido', motivo, ...resto, notas: notas ?? [] }
}
