// F4 T4: a linha "já recebo tráfego dele" do cartão. Puro: recebe `trafego_do_terceiro` (já lido, com prova) e devolve os textos do
// mockup 2026-10-29-f4-trafego-e-titulos (logan-r2 + naksu-r2). `nao_medido` nunca vira "0" nem "não"; nenhuma frase diz "0 visitas".
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { MotivoNaoMedido, TrafegoDoTerceiro } from '@/lib/youtube/observatorio/sinais/trafego-terceiro/regra'

export type EstadoDaLinhaDeTrafego = 'sim' | 'nao' | 'nao_medido' | 'erro'

export interface TrafegoDaVista {
  estado: EstadoDaLinhaDeTrafego
  /** Texto cheio (sem o selo "não medido", que a tela desenha antes). */
  texto: string
  /** Texto curto (≤ 4 palavras quando o motivo é geral) para o cartão fechado. */
  curto: string
  /** Frase do grupo "Visitas vindas dele" do ⓘ. */
  info: string
  /** O YouTube informou visitas mas o link "Pedir títulos" só vale no "não". */
  podePedir: boolean
  /** Motivo do `nao_medido`/`erro` (a frase-resumo detecta o motivo geral); `null` em sim/nao. */
  motivo: MotivoNaoMedido | null
  /** Último dia de dado (`coberto_ate` ou `ate`), ISO; base do "dado até dd/mm" do resumo. */
  ateIso: string | null
}

export const INFO_QUANDO_NAO = 'Só quando o YouTube informou a origem de todas as visitas da janela e nenhuma veio dele. Se houve visita sem origem informada, fica “não medido”: não dá para afirmar sim nem não.'
export const INFO_REGRA_TRAFEGO = 'f4-trafego-v1 · desde a publicação dele até o último dia coletado'

const MOTIVO_ERRO: ReadonlyArray<MotivoNaoMedido> = ['erro_de_leitura', 'schema_ausente']

/** "2026-10-27" → "27/10". */
export function ddmm(dia: string | null): string | null {
  if (dia === null) return null
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dia)
  return m ? `${m[2]}/${m[1]}` : null
}

const fmt = (n: number): string => n.toLocaleString('pt-BR')
const vid = (n: number): string => (n === 1 ? 'vídeo seu' : 'vídeos seus')

export function montarTrafego(t: TrafegoDoTerceiro | null | undefined, hoje: string): TrafegoDaVista | null {
  if (!t || t.estado === 'nao_se_aplica') return null
  const M = t.videos_total
  const desde = ddmm(t.desde)
  const coberto = ddmm(t.coberto_ate)
  const info = desde !== null
    ? `O YouTube diz de qual vídeo vieram as visitas aos seus vídeos. Contamos as que vieram deste vídeo dele, da data em que ele saiu (${desde}) até ${coberto ?? 'o último dia coletado'}.`
    : `O YouTube diz de qual vídeo vieram as visitas aos seus vídeos. Contamos as que vieram deste vídeo dele, desde que ele saiu até ${coberto ?? 'o último dia coletado'}.`
  const ateIso = t.coberto_ate ?? t.ate ?? null
  const base = { info, podePedir: false, motivo: null as MotivoNaoMedido | null, ateIso }

  if (t.estado === 'sim') {
    const ate = ddmm(t.coberto_ate)
    const fim = ate === null ? '.' : `, até ${ate}.`
    const parcial = t.videos_medidos > 0 && t.videos_medidos < M ? ` Medido em ${t.videos_medidos} de ${M} ${vid(M)}.` : ''
    // `views` 0 ou nulo: a linha existe, mas nunca se escreve "0 visitas".
    const texto = t.views !== null && t.views > 0
      ? `Já te manda visitas: ${fmt(t.views)} em ${t.videos_com_trafego} de ${M} vídeos seus${fim}${parcial}`
      : `Já te manda visitas para ${t.videos_com_trafego} de ${M} vídeos seus (o YouTube não disse quantas)${fim}${parcial}`
    return { ...base, estado: 'sim', texto, curto: `Já te manda visitas · ${t.videos_com_trafego} de ${M}` }
  }

  if (t.estado === 'nao') {
    const ate = ddmm(t.ate)
    return {
      ...base, estado: 'nao', podePedir: true,
      texto: `Não te manda visitas: nenhum dos seus ${M} vídeos recebeu visita dele${ate === null ? '.' : `, até ${ate}.`}`,
      curto: ate === null ? 'Não te manda visitas' : `Não te manda visitas · até ${ate}`,
    }
  }

  const motivo = t.motivo
  if (motivo !== null && MOTIVO_ERRO.includes(motivo)) {
    return { ...base, motivo, estado: 'erro', texto: 'Não deu para ler este dado agora. A sugestão continua valendo.', curto: 'Não deu para ler este dado.' }
  }
  const nm = (texto: string, curto: string = texto): TrafegoDaVista => ({ ...base, motivo, estado: 'nao_medido', texto, curto })
  switch (motivo) {
    case 'origem_nao_informada':
      return nm('O YouTube informou visitas sem dizer de qual vídeo vieram; não dá para afirmar sim nem não.', 'Origem das visitas não informada.')
    case 'pouca_cobertura':
    case 'ainda_nao_coletado': {
      const medir = t.desde !== null ? addDays(t.desde, 9) : null // 7 dias de dado + ~2 de atraso do YouTube
      if (desde !== null && medir !== null && medir > hoje) {
        const m = ddmm(medir)!
        return nm(`Ainda cedo: ele saiu em ${desde}; dá para medir a partir de ${m}.`, `Ainda cedo; medir a partir de ${m}.`)
      }
      return nm('Ainda faltam dias de coleta dos seus vídeos desde que ele saiu.', 'Faltam dias de coleta.')
    }
    case 'lista_truncada': {
      const n = t.videos_medidos
      return n > 0
        ? nm(`Conferimos ${n} dos seus ${M} vídeos; nenhum dos ${n} recebeu visita dele.`, `Só ${n} de ${M} vídeos conferidos.`)
        : nm(`Conferimos só parte dos seus ${M} vídeos; não dá para afirmar que nenhum recebeu visita dele.`, 'Só parte dos vídeos conferida.')
    }
    case 'sem_proprios_medidos':
      return nm('Ainda não sabemos quais vídeos seus comparar.', 'Sem vídeos seus para comparar.')
    case 'sem_terceiro':
    case 'sem_id':
      return nm('Sem o vídeo do concorrente para medir.', 'Sem vídeo dele para medir.')
    case 'cobertura_velha':
      return nm(coberto === null ? 'Coleta parada.' : `Coleta parada desde ${coberto}.`)
    case 'sem_cobertura':
      return nm('Coleta ainda sem dados.')
    case 'nao_conferido':
      return nm('Acesso não conferido agora.')
    case 'coleta_desligada':
      return nm('Coleta desligada.')
    default:
      return nm('Sem acesso a este dado.')
  }
}

// ---- Frase-resumo, barra de topo e faixa de motivo geral (mockup 2026-10-29, NOTAS: decisões 1 e 2) ----

export type SegmentoDaBarra = { estado: EstadoDaLinhaDeTrafego; n: number }
export interface ResumoDeTrafego {
  /** Frase-resumo sempre visível; `null` quando há faixa geral (ela diz o motivo) ou todos são "erro". */
  frase: string | null
  /** Faixa única quando todos os cartões têm o mesmo motivo geral. */
  geral: { tom: 'warn' | 'err'; texto: string } | null
  barra: SegmentoDaBarra[]
}

const GERAIS: Partial<Record<MotivoNaoMedido, (ate: string | null) => string>> = {
  cobertura_velha: (a) => `A coleta da origem das visitas parou${a ? ` em ${a}` : ''}. Até ela voltar, nenhum cartão diz sim ou não.`,
  sem_cobertura: () => 'O YouTube ainda não entregou a origem das visitas dos seus vídeos. Volte em 2 dias.',
  nao_conferido: () => 'Não deu para conferir seu acesso ao Analytics agora. Recarregue a página em alguns minutos.',
  coleta_desligada: () => 'A coleta da origem das visitas está desligada (YT_OWN_STEPS_OFF).',
}
const TEXTO_ERRO = 'Não deu para ler as visitas vindas dos concorrentes. O resto das sugestões está certo. Recarregue para tentar de novo.'

/** `null` quando nenhum cartão tem a linha (tudo `nao_se_aplica`). Puro. */
export function resumirTrafego(linhas: ReadonlyArray<{ trafego: TrafegoDaVista | null }>): ResumoDeTrafego | null {
  const ts = linhas.map((l) => l.trafego).filter((t): t is TrafegoDaVista => Boolean(t))
  const N = ts.length
  if (N === 0) return null
  const k = { sim: 0, nao: 0, nao_medido: 0, erro: 0 }
  for (const t of ts) k[t.estado]++
  const barra: SegmentoDaBarra[] = (['sim', 'nao', 'nao_medido', 'erro'] as const).filter((e) => k[e] > 0).map((e) => ({ estado: e, n: k[e] }))
  const ate = ts.map((t) => t.ateIso).filter((d): d is string => d !== null).sort().pop() ?? null

  if (k.erro === N) return { frase: null, geral: { tom: 'err', texto: TEXTO_ERRO }, barra }
  const motivos = new Set(ts.map((t) => (t.estado === 'nao_medido' ? t.motivo : '#')))
  if (k.nao_medido === N && motivos.size === 1) {
    const m = [...motivos][0] as MotivoNaoMedido | null
    const f = m ? GERAIS[m] : undefined
    if (f) return { frase: null, geral: { tom: 'warn', texto: f(m === 'cobertura_velha' ? ddmm(ate) : null) }, barra }
  }
  let p: string
  if (k.nao === N) p = 'nenhuma sugestão te manda visitas hoje'
  else {
    const a: string[] = []
    if (k.sim) a.push(`${k.sim} de ${N} já te ${k.sim === 1 ? 'manda' : 'mandam'} visitas`)
    if (k.nao) a.push(k.sim ? `${k.nao} ${k.nao === 1 ? 'não manda' : 'não mandam'}` : `${k.nao} de ${N} sugestões não te mandam visitas`)
    if (k.nao_medido) a.push(`${k.nao_medido} ${k.nao_medido === 1 ? 'ainda não medida' : 'ainda não medidas'}`)
    if (k.erro) a.push(`${k.erro} ${k.erro === 1 ? 'não pôde ser lida' : 'não puderam ser lidas'}`)
    p = a.join('; ')
  }
  const dado = ddmm(ate)
  return { frase: `Visitas vindas dos concorrentes: ${p}${dado ? ` (dado até ${dado})` : ''}.`, geral: null, barra }
}
