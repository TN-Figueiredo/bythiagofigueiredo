// F4 T1: núcleo puro do "esse vídeo do terceiro já nos manda tráfego?". Sem banco, sem relógio.
import { addDays, diffDias } from '../../../coleta/day-pt'

export const REGRA_F4 = { versao: 1, diasMinimosCobertos: 7, atrasoMaxDias: 4, janelaMaxDias: 90 } as const

export type MotivoNaoMedido =
  | 'sem_direito'
  | 'nao_conferido'
  | 'sem_proprios_medidos'
  | 'lista_truncada'
  | 'sem_terceiro'
  | 'sem_id'
  | 'schema_ausente'
  | 'erro_de_leitura'
  | 'coleta_desligada'
  | 'sem_cobertura'
  | 'pouca_cobertura'
  | 'cobertura_velha'
  | 'ainda_nao_coletado'
  | 'origem_nao_informada'

/** Ordem do tipo: desempate do motivo mais frequente. */
const ORDEM_MOTIVOS: ReadonlyArray<MotivoNaoMedido> = [
  'sem_direito', 'nao_conferido', 'sem_proprios_medidos', 'lista_truncada', 'sem_terceiro', 'sem_id',
  'schema_ausente', 'erro_de_leitura', 'coleta_desligada', 'sem_cobertura', 'pouca_cobertura',
  'cobertura_velha', 'ainda_nao_coletado', 'origem_nao_informada',
]

export type EstadoDoPar =
  | { estado: 'sim'; views: number | null; dias: number }
  | { estado: 'nao'; diasCobertos: number; ate: string }
  | { estado: 'nao_medido'; motivo: MotivoNaoMedido }

export interface EntradaDoPar {
  /** Dia PT (coleta/day-pt.ts) da publicação do vídeo do terceiro. */
  pubDoTerceiro: string
  hoje: string
  intervalos: ReadonlyArray<{ de: string; ate: string }>
  linhas: ReadonlyArray<{ dia: string; views: number | null }>
  /** Dias de origem sugeridos com detail vazio, do vídeo nosso. */
  diasSemOrigem: ReadonlyArray<string>
}

// YYYY-MM-DD compara certo como texto.
const dentro = (dia: string, ini: string, fim: string): boolean => dia >= ini && dia <= fim

export function estadoDoPar(p: EntradaDoPar): EstadoDoPar {
  const piso = addDays(p.hoje, -REGRA_F4.janelaMaxDias)
  const ini = p.pubDoTerceiro > piso ? p.pubDoTerceiro : piso
  const fim = p.hoje

  const naJanela = p.linhas.filter((l) => dentro(l.dia, ini, fim))
  if (naJanela.length > 0) {
    const algumNulo = naJanela.some((l) => l.views === null)
    const views = algumNulo ? null : naJanela.reduce((s, l) => s + (l.views as number), 0)
    return { estado: 'sim', views, dias: new Set(naJanela.map((l) => l.dia)).size }
  }

  if (p.intervalos.length === 0) return { estado: 'nao_medido', motivo: 'sem_cobertura' }
  const maiorAte = p.intervalos.reduce((m, i) => (i.ate > m ? i.ate : m), p.intervalos[0]!.ate)
  if (maiorAte < p.pubDoTerceiro) return { estado: 'nao_medido', motivo: 'ainda_nao_coletado' }
  if (diffDias(maiorAte, p.hoje) > REGRA_F4.atrasoMaxDias) return { estado: 'nao_medido', motivo: 'cobertura_velha' }

  // Interseção com a janela, fundindo sobreposições (aritmética de intervalos).
  const cortados = p.intervalos
    .map((i) => ({ de: i.de > ini ? i.de : ini, ate: i.ate < fim ? i.ate : fim }))
    .filter((i) => i.de <= i.ate)
    .sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0))
  let diasCobertos = 0
  let ultimoAte: string | null = null
  let atual: { de: string; ate: string } | null = null
  for (const i of cortados) {
    if (atual && i.de <= addDays(atual.ate, 1)) {
      if (i.ate > atual.ate) atual = { de: atual.de, ate: i.ate }
    } else {
      if (atual) diasCobertos += diffDias(atual.de, atual.ate) + 1
      atual = i
    }
    ultimoAte = atual.ate
  }
  if (atual) diasCobertos += diffDias(atual.de, atual.ate) + 1
  if (diasCobertos < REGRA_F4.diasMinimosCobertos || ultimoAte === null) return { estado: 'nao_medido', motivo: 'pouca_cobertura' }

  if (p.diasSemOrigem.some((d) => dentro(d, ini, fim))) return { estado: 'nao_medido', motivo: 'origem_nao_informada' }

  return { estado: 'nao', diasCobertos, ate: ultimoAte }
}

export interface TrafegoDoTerceiro {
  estado: 'sim' | 'nao' | 'nao_medido' | 'nao_se_aplica'
  motivo: MotivoNaoMedido | null
  terceiro_video_id: string | null
  videos_com_trafego: number
  videos_medidos: number
  videos_total: number
  views: number | null
  ate: string | null
  regra: 'f4-trafego-v1'
}

export function estadoDaSugestao(
  pares: ReadonlyArray<EstadoDoPar>,
  terceiroId: string | null,
  motivoGeral: MotivoNaoMedido | null,
  totalProprios: number,
  truncada: boolean,
): TrafegoDoTerceiro {
  const sims = pares.filter((p): p is Extract<EstadoDoPar, { estado: 'sim' }> => p.estado === 'sim')
  const naos = pares.filter((p): p is Extract<EstadoDoPar, { estado: 'nao' }> => p.estado === 'nao')
  const naoMedidos = pares.filter((p): p is Extract<EstadoDoPar, { estado: 'nao_medido' }> => p.estado === 'nao_medido')

  const resultado = (
    estado: TrafegoDoTerceiro['estado'],
    motivo: MotivoNaoMedido | null,
    extra: Partial<Pick<TrafegoDoTerceiro, 'views' | 'ate'>> = {},
  ): TrafegoDoTerceiro => ({
    estado,
    motivo,
    terceiro_video_id: terceiroId,
    videos_com_trafego: sims.length,
    videos_medidos: sims.length + naos.length,
    videos_total: totalProprios,
    views: null,
    ate: null,
    regra: 'f4-trafego-v1',
    ...extra,
  })

  if (motivoGeral) return resultado('nao_medido', motivoGeral)
  if (pares.length === 0) return resultado('nao_se_aplica', null)

  if (sims.length > 0) {
    const views = sims.some((s) => s.views === null) ? null : sims.reduce((t, s) => t + (s.views as number), 0)
    return resultado('sim', null, { views })
  }
  if (truncada) return resultado('nao_medido', 'lista_truncada')
  if (naoMedidos.length === 0) {
    const ate = naos.reduce((m, n) => (n.ate < m ? n.ate : m), naos[0]!.ate)
    return resultado('nao', null, { ate })
  }
  const cont = new Map<MotivoNaoMedido, number>()
  for (const n of naoMedidos) cont.set(n.motivo, (cont.get(n.motivo) ?? 0) + 1)
  let melhor: MotivoNaoMedido = ORDEM_MOTIVOS.find((m) => cont.has(m)) ?? naoMedidos[0]!.motivo
  for (const m of ORDEM_MOTIVOS) if ((cont.get(m) ?? 0) > (cont.get(melhor) ?? 0)) melhor = m
  return resultado('nao_medido', melhor)
}
