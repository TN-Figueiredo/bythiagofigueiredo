// A4 R3, T5: os agregados do bloco, sobre TODAS as elegíveis (antes do limite). Mediana e quartis só por `median`/`quant`;
// o engajamento é `engajamentoDoCanal` sobre o conjunto (o mesmo grupo único que a tela Canal usa).
import { OUT_WINDOWS, winOf } from '../rules'
import { median, quant } from '../stats'
import { engajamentoDoCanal, type VideoParaEngajamento } from '../medidas/engajamento'
import type { MedidasDoVideo } from '../medidas/do-canal'
import type { EntradaDoConjunto, LinhaDaConsulta, MetricaDaConsulta, PedidoDaConsulta } from './tipos'

type PorMetrica = NonNullable<AgregadoDoBloco['porMetrica'][MetricaDaConsulta]>

export interface AgregadoDoBloco {
  n: number; elegiveis: number
  porMetrica: Partial<Record<MetricaDaConsulta, { mediana: number | null; q1: number | null; q3: number | null; n: number; semOsVideos: string[]; semOsCanais: string[]; porFaixa?: Array<{ faixa: string; mediana: number | null; n: number }> }>>
  /** `grupo`: 'componente' quando o grupo vencedor é só curtidas ou só comentários; 'base' quando mistura os dois componentes (a base, `idade_30` ou `total_de_hoje`, vem nas notas do resultado). */
  engajamento?: { resultado: ReturnType<typeof engajamentoDoCanal>; grupo: 'base' | 'componente'; agendadosFora: number; falhou: number }
  baseFraca: number; sincAtrasado: number
}

function resumo(xs: number[], semOsVideos: string[], semOsCanais: string[]): PorMetrica {
  return { mediana: median([...xs]), q1: quant([...xs], 0.25), q3: quant([...xs], 0.75), n: xs.length, semOsVideos, semOsCanais }
}

export function agregar(todas: LinhaDaConsulta[], p: PedidoDaConsulta, e: EntradaDoConjunto): AgregadoDoBloco {
  const porMetrica: AgregadoDoBloco['porMetrica'] = {}
  // canal sem medida: ausente de `porCanal` ou com `naoCarregou`; o código do canal (não o nome) vai para o texto
  const semMedida = (id: string): boolean => { const c = e.medidas.porCanal.get(id); return c === undefined || 'naoCarregou' in c }
  const semCanais = (m: MetricaDaConsulta): string[] => [...new Set(todas.filter((l) => l.celulas[m]?.estado !== 'medido' && l.celulas[m]?.estado !== 'zero_medido' && semMedida(l.canalId)).map((l) => l.canalId))]
  const medidos = (m: MetricaDaConsulta, f: (l: LinhaDaConsulta) => boolean = () => true): number[] =>
    todas.filter((l) => f(l) && l.celulas[m]?.x != null).map((l) => l.celulas[m]!.x!)

  for (const m of p.metricas) {
    if (m === 'multiplicador') porMetrica.multiplicador = resumo(medidos(m, (l) => p.incluirBaseFraca || !l.baseFraca), [], [])
    else if (m === 'vpd7') porMetrica.vpd7 = resumo(medidos(m, (l) => l.celulas.vpd7?.vpdBase === '7d'), [], [])
    else if (m === 'views' || m === 'likes' || m === 'comentarios') {
      const porFaixa = OUT_WINDOWS.map((w) => {
        const xs = medidos(m, (l) => winOf(l.idadeDias)?.id === w.id)
        return { faixa: w.id, mediana: median([...xs]), n: xs.length }
      }).filter((f) => f.n > 0)
      const umaFaixa = p.janelaIdade !== 'todas' && p.janelaIdade.length === 1
      const r = resumo(umaFaixa ? medidos(m) : [], [], semCanais(m))
      porMetrica[m] = umaFaixa ? { ...r, porFaixa } : { mediana: null, q1: null, q3: null, n: 0, semOsVideos: [], semOsCanais: r.semOsCanais, porFaixa }
    }
  }

  let engajamento: AgregadoDoBloco['engajamento']
  const formato = todas[0]?.formato === 'shorts' ? 'short' : 'long'
  if (p.metricas.includes('engajamento') && todas.length > 0) {
    const noMotor = (l: LinhaDaConsulta): MedidasDoVideo | undefined => {
      const c = e.medidas.porCanal.get(l.canalId)
      return c && !('naoCarregou' in c) ? c.porVideo.get(l.id) : undefined
    }
    const videos: VideoParaEngajamento[] = []
    for (const l of todas) {
      const mv = noMotor(l)
      if (!mv) continue
      const wasLive = e.medidas.videos?.get(l.id)?.wasLive ?? null
      videos.push({ formato: l.formatoConfirmado ? (l.formato === 'shorts' ? 'short' : 'long') : null, wasLive, agendadoOuNoAr: mv.m7.estado === 'nao_medido' && mv.m7.motivo === 'fecha_em', engajamento: mv.m7 })
    }
    const resultado = engajamentoDoCanal(videos, { formato, agoraMs: e.agoraMs })
    const foraPorAgenda = todas.filter((l) => l.celulas.engajamento?.causa === 'agendado ou ao vivo').length
    const falhas = todas.filter((l) => l.celulas.engajamento?.estado === 'falhou')
    const componente = resultado.notas.some((n) => n.tipo === 'so_curtidas' || n.tipo === 'so_comentarios')
    engajamento = { resultado, grupo: componente ? 'componente' : 'base', agendadosFora: foraPorAgenda, falhou: falhas.length }
    // por mil views, como a célula; o quartil do grupo único não existe na medida do motor: fica nulo, nunca inventado
    porMetrica.engajamento = {
      mediana: resultado.estado === 'medido' ? resultado.valor * 1000 : null, q1: null, q3: null,
      n: resultado.estado === 'medido' ? resultado.n : 0, semOsVideos: falhas.map((l) => l.id), semOsCanais: semCanais('engajamento'),
    }
  }

  const atrasados = new Set(todas.filter((l) => { const s = e.obs.channel(l.canalId)?.sync.state; return s === 'atrasado' || s === 'erro' }).map((l) => l.canalId))
  return { n: todas.length, elegiveis: todas.length, porMetrica, ...(engajamento ? { engajamento } : {}), baseFraca: todas.filter((l) => l.baseFraca).length, sincAtrasado: atrasados.size }
}
