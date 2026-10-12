// Views por dia do canal próprio, calculadas do diário por vídeo (yt_own_video_daily). Modelo puro, sem banco.
// Regra de ouro: zero medido é a linha com views 0; não medido é a FALTA da linha (ou views nulas). Média e mediana
// sobre série curta ou vazia nunca viram 0: viram null com o motivo.
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { DiarioCanal, DiaYt, Privado } from './tipos'

export const MIN_DIAS_VPD = 7
export const DIARIO_PARADO_DIAS = 7
const JANELA_VPD_DIAS = 28

export type MotivoSemVpd = 'sem-acesso' | 'leitura-falhou' | 'sem-diario' | 'diario-parado' | 'sem-longos' | 'poucos-dias'

export interface VpdVideo { vpd: number | null; dias: number }

export interface VpdCanal {
  valor: number | null
  motivo: MotivoSemVpd | null
  /** vídeos que entraram na mediana */
  n: number
  janela: { de: DiaYt; ate: DiaYt } | null
  /** o último dia gravado, para a frase "parou em dd/mm" */
  ultimoDia: DiaYt | null
}

/** Média das views dos dias COM medida (linha com views != null) nos 28 dias que terminam no último dia gravado. */
export function vpdDoVideo(d: DiarioCanal, ytId: string): VpdVideo {
  if (d.ultimoDia == null) return { vpd: null, dias: 0 }
  const de = addDays(d.ultimoDia, -(JANELA_VPD_DIAS - 1))
  let soma = 0
  let dias = 0
  for (const l of d.linhas) {
    if (l.ytId !== ytId || l.views == null || l.dia < de || l.dia > d.ultimoDia) continue
    soma += l.views
    dias++
  }
  return { vpd: dias >= MIN_DIAS_VPD ? soma / dias : null, dias }
}

function mediana(xs: readonly number[]): number {
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 === 1 ? (o[m] as number) : ((o[m - 1] as number) + (o[m] as number)) / 2
}

const semValor = (motivo: MotivoSemVpd, ultimoDia: DiaYt | null): VpdCanal => ({ valor: null, motivo, n: 0, janela: null, ultimoDia })

/** Mediana de `vpdDoVideo` entre os longos acompanhados que têm o número. Ordem dos motivos: a do brief da Tarefa 3. */
export function vpdDoCanal(d: Privado<DiarioCanal>, longosAcompanhados: readonly string[], hoje: DiaYt): VpdCanal {
  if (d.acesso === 'negado') return semValor('sem-acesso', null)
  if (d.acesso === 'erro') return semValor('leitura-falhou', null)
  const { ultimoDia } = d.dado
  if (ultimoDia == null) return semValor('sem-diario', null)
  if (diffDias(ultimoDia, hoje) > DIARIO_PARADO_DIAS) return semValor('diario-parado', ultimoDia)
  if (longosAcompanhados.length === 0) return semValor('sem-longos', ultimoDia)
  const valores: number[] = []
  for (const id of longosAcompanhados) {
    const { vpd } = vpdDoVideo(d.dado, id)
    if (vpd != null) valores.push(vpd)
  }
  if (valores.length === 0) return semValor('poucos-dias', ultimoDia)
  return {
    valor: mediana(valores), motivo: null, n: valores.length,
    janela: { de: addDays(ultimoDia, -(JANELA_VPD_DIAS - 1)), ate: ultimoDia }, ultimoDia,
  }
}

/** `dm` formata 'AAAA-MM-DD' como "dd/mm". */
export function motivoVpdTexto(m: MotivoSemVpd, c: Pick<VpdCanal, 'ultimoDia'>, dm: (d: DiaYt) => string): string {
  switch (m) {
    case 'sem-acesso': return 'só quem edita o site vê as views por dia do seu canal'
    case 'leitura-falhou': return 'a leitura das views por dia falhou agora; recarregue a página'
    case 'sem-diario': return 'a coleta diária ainda não gravou este canal'
    case 'diario-parado': return c.ultimoDia == null ? 'a coleta diária deste canal parou' : `a coleta diária deste canal parou em ${dm(c.ultimoDia)}`
    case 'sem-longos': return 'nenhum vídeo longo acompanhado'
    case 'poucos-dias': return `menos de ${MIN_DIAS_VPD} dias medidos nos últimos ${JANELA_VPD_DIAS}`
    default: { const _nunca: never = m; return _nunca }
  }
}

/** A base escrita do número: a janela e quantos vídeos. Sem valor, não há base. */
export function baseVpdTexto(c: VpdCanal, dm: (d: DiaYt) => string): string | null {
  if (c.valor == null || c.janela == null) return null
  return `média dos últimos ${JANELA_VPD_DIAS} dias do YouTube com medida (de ${dm(c.janela.de)} a ${dm(c.janela.ate)}), mediana de ${c.n} ${c.n === 1 ? 'longo' : 'longos'}`
}
