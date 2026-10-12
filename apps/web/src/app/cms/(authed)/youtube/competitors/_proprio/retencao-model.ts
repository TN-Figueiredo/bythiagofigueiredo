/**
 * Modelo da aba Retenção = "% assistido" do canal próprio (A4 13.3; mockup 5 de 12/10). Puro: recebe o dado privado JÁ LIDO (`DadosDoCanal`) e devolve o que a
 * tela escreve: o normal de % assistido por faixa de duração, a frase de relance, a tabela por vídeo (do mais visto em 28 dias ao menos) e as frases de cada estado
 * sem número. Não lê banco, não pede a prova de edição e não importa os leitores (uma varredura de teste barra). Sem permissão ou com a leitura falha, nenhum número
 * nem título de vídeo está na view.
 *
 * Decisões do dono (12/10): % assistido de um vídeo = média do percentual de cada dia pesada pelas views, nos 28 dias até o último dia gravado; "na média" = até 2
 * pontos para cima ou para baixo (a conta arredonda antes de decidir: `contraNormal`); o normal de uma faixa de duração é a mediana e só existe com 5 vídeos ou mais
 * com views; menos de 10 views = poucas (o % sai com a contagem e sem comparação); ACIMA de 100% é dado válido (trecho que muita gente voltou para rever): o número
 * real, a barra cheia e uma marca por forma, nunca um recorte em 100. "Não medido" nunca vira zero: vídeo sem views nos 28 dias não aparece na tabela.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import {
  assistidoDoVideo, contraNormal, FAIXAS, faixaDaDuracao, medianaDe, normalDaFaixa, type FaixaId, type LeituraContraNormal, type NormalDaFaixa,
} from '@/lib/youtube/observatorio/proprio/assistido'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { assistidoDoCanal, views28DoVideo } from './canal-agregados'
import type { DadosDoCanal } from './dados'
import { longosAcompanhados } from './extras'
import { int } from './impressoes-model'

export type EstadoRetencao = 'ok' | 'negado' | 'erro' | 'sem-diario' | 'sem-views' | 'sem-percentual'

export interface FaixaLinha {
  rotulo: string
  /** vídeos da faixa (com duração conhecida) */
  videos: number
  /** o normal ("45%"); null = sem normal (veja `estado`) */
  normal: string | null
  estado: 'normal' | 'nenhum' | 'sem-views' | 'poucos'
  /** a frase quando não há normal */
  texto: string | null
}

export interface ContraFaixa {
  leitura: LeituraContraNormal | 'sem'
  /** '+' acima, '−' abaixo, '=' na média; null = não compara */
  sinal: '+' | '−' | '=' | null
  /** "4 pontos"; null quando não há diferença a escrever */
  pontos: string | null
  texto: string
}

export interface LinhaVideo {
  id: string
  titulo: string
  href: string
  /** "5 a 15 min"; "sem duração" quando o vídeo não tem duração guardada */
  faixa: string
  views28: string
  /** "45%" (pode passar de 100) */
  pct: string
  /** a barra de 0 a 1 (recortada em 1 SÓ no desenho: `acimaDe100` marca o resto) */
  barra: number
  acimaDe100: boolean
  /** posição da marca do normal da faixa na mesma escala; null = sem normal */
  normalPos: number | null
  /** "8 views" quando são poucas (menos de 10); null caso contrário */
  nViews: string | null
  /** o que a barra diz em texto, para o leitor de tela */
  alt: string
  contra: ContraFaixa
  /** views acima do normal do canal e % assistido abaixo do normal da faixa */
  alvo: boolean
}

export interface RetencaoView {
  estado: EstadoRetencao
  titulo: string
  /** "Dado do diário do YouTube, dia do YouTube, dos 28 dias até dd/mm. A curva de retenção por minuto fica na página de cada vídeo." */
  nota: string
  /** a frase quando não há o que mostrar; null = há tabela */
  vazio: string | null
  faixas: FaixaLinha[]
  /** a frase de relance; `negrito` abre a frase ("3 vídeos têm"); vazio quando a frase é a negativa */
  relance: { negrito: string; resto: string } | null
  videos: LinhaVideo[]
  /** "1 vídeo teve views, mas o YouTube ainda não entregou o % assistido dele."; null = nenhum */
  semPercentual: string | null
}

export const TITULO_ASSISTIDO = '% assistido'
const CURVA_NO_VIDEO = 'A curva de retenção por minuto fica na página de cada vídeo.'
const SEM_FAIXA = 'sem duração'

/** O ⓘ "De onde vem o % assistido": texto estático (nada do dado do canal). */
export const METODO_ASSISTIDO: readonly string[] = [
  '% assistido de um vídeo: média do percentual de cada dia, pesada pelas views do dia. Dá o mesmo resultado que o YouTube calcula para a janela inteira.',
  'Normal da faixa: mediana dos vídeos da faixa. Só aparece com 5 ou mais vídeos com views no período.',
  'Na média: uma diferença de até 2 pontos para cima ou para baixo é ruído e não ganha cor; de 3 pontos em diante é “acima” ou “abaixo”.',
  'Poucas views: abaixo de 10 views o valor aparece com a contagem ao lado, porque uma ou duas pessoas mudam o resultado. Acima de 100%: trecho que muita gente voltou para rever.',
]

const pontosTexto = (n: number): string => `${int(n)} ${n === 1 ? 'ponto' : 'pontos'}`
const pctTexto = (x: number): string => `${Math.round(x)}%`

function notaDe(ultimo: DiaYt | null | undefined, dm: (d: DiaYt) => string): string {
  const ate = ultimo ? `dos 28 dias até ${dm(ultimo)}` : 'dos 28 dias que terminam no último dia gravado'
  return `Dado do diário do YouTube, dia do YouTube, ${ate}. ${CURVA_NO_VIDEO}`
}

function vazia(estado: EstadoRetencao, vazio: string, nota: string): RetencaoView {
  return { estado, titulo: TITULO_ASSISTIDO, nota, vazio, faixas: [], relance: null, videos: [], semPercentual: null }
}

export function buildRetencao(obs: Observatory, canalId: string, dados: DadosDoCanal, o: { dm: (d: DiaYt) => string; hoje: DiaYt }): RetencaoView {
  const d = dados.diario
  const ultimo = d.acesso === 'ok' ? d.dado.ultimoDia : null
  const nota = notaDe(ultimo, o.dm)
  if (d.acesso === 'negado') return vazia('negado', 'Só quem edita o site vê o % assistido.', 'Dado do diário do YouTube, dia do YouTube. ' + CURVA_NO_VIDEO)
  if (d.acesso === 'erro') return vazia('erro', 'A leitura do % assistido falhou agora; recarregue a página.', 'Dado do diário do YouTube, dia do YouTube. ' + CURVA_NO_VIDEO)

  const ytIds = longosAcompanhados(obs, canalId)
  const canal = assistidoDoCanal(d, ytIds)
  if (canal.motivo === 'sem-diario') return vazia('sem-diario', 'A coleta diária ainda não rodou para este canal: não há % assistido de nenhum vídeo.', nota)
  if (canal.motivo === 'sem-views') return vazia('sem-views', `Nenhum vídeo teve views nos 28 dias até ${ultimo ? o.dm(ultimo) : 'o último dia gravado'}. Sem views não há % assistido para comparar. Os vídeos voltam a aparecer aqui assim que tiverem uma.`, nota)
  if (canal.motivo === 'sem-percentual') return vazia('sem-percentual', 'O YouTube ainda não entregou o % assistido de nenhum vídeo.', nota)

  const porYt = new Map(obs.videos.filter(v => v.ch === canalId).map(v => [v.ytId, v]))
  const base = ytIds.flatMap(yt => {
    const v = porYt.get(yt)
    if (!v) return []
    const a = assistidoDoVideo(d, yt)
    return [{ v, a, views28: views28DoVideo(d, yt) }]
  })
  const comPct = base.filter(x => x.a.pct != null)
  const semPct = base.filter(x => x.a.pct == null && (x.views28 ?? 0) > 0).length

  const normais = normalDaFaixa(base.map(x => ({ dur: x.v.dur, pct: x.a.pct })))
  const normalDe = (id: FaixaId | null): NormalDaFaixa | undefined => (id ? normais.find(n => n.faixa === id) : undefined)
  const faixas: FaixaLinha[] = FAIXAS.map(f => {
    const n = normalDe(f.id)!
    if (n.normal != null) return { rotulo: f.rotulo, videos: n.videos, normal: pctTexto(n.normal), estado: 'normal', texto: null }
    if (n.videos === 0) return { rotulo: f.rotulo, videos: 0, normal: null, estado: 'nenhum', texto: 'nenhum vídeo nesta faixa' }
    if (n.comViews === 0) return { rotulo: f.rotulo, videos: n.videos, normal: null, estado: 'sem-views', texto: 'nenhum vídeo desta faixa teve views nos 28 dias' }
    return { rotulo: f.rotulo, videos: n.videos, normal: null, estado: 'poucos', texto: `poucos vídeos para comparar (${n.comViews}; precisa de 5)` }
  })

  // o "normal do canal": a mediana das views em 28 dias entre os vídeos que têm views medidas
  const medidas = base.map(x => x.views28).filter((x): x is number => x != null)
  const normalCanal = medianaDe(medidas)

  const linhas = comPct.map(({ v, a, views28 }) => {
    const pct = a.pct as number
    const id = faixaDaDuracao(v.dur)
    const normal = normalDe(id)?.normal ?? null
    const pouco = a.pouco
    const c = pouco ? null : contraNormal(pct, normal)
    let contra: ContraFaixa
    if (pouco) contra = { leitura: 'sem', sinal: null, pontos: null, texto: 'poucas views para comparar' }
    else if (id == null) contra = { leitura: 'sem', sinal: null, pontos: null, texto: 'sem duração para comparar' }
    else if (!c || normal == null) contra = { leitura: 'sem', sinal: null, pontos: null, texto: 'poucos vídeos para comparar' }
    else {
      const abs = Math.abs(c.dif)
      const ref = `do normal da faixa (${pctTexto(normal)})`
      if (c.leitura === 'na-media') {
        contra = { leitura: 'na-media', sinal: '=', pontos: c.dif === 0 ? null : pontosTexto(abs), texto: `na média da faixa (${pctTexto(normal)})${c.dif === 0 ? '' : `, ${c.dif > 0 ? '+' : '−'}${pontosTexto(abs)}`}` }
      } else {
        contra = c.leitura === 'acima'
          ? { leitura: 'acima', sinal: '+', pontos: pontosTexto(abs), texto: `acima ${ref}` }
          : { leitura: 'abaixo', sinal: '−', pontos: pontosTexto(abs), texto: `abaixo ${ref}` }
      }
    }
    const acimaDe100 = pct > 100
    const alvo = contra.leitura === 'abaixo' && views28 != null && normalCanal != null && views28 > normalCanal
    const titulo = v.title.trim() ? v.title : 'Vídeo sem título'
    return {
      v, views28: views28 ?? 0,
      linha: {
        id: v.id, titulo, href: link.historico(v.id, { from: 'canais', canal: canalId }),
        faixa: FAIXAS.find(f => f.id === id)?.rotulo ?? SEM_FAIXA,
        views28: int(views28 ?? 0), pct: pctTexto(pct), barra: Math.min(pct, 100) / 100, acimaDe100,
        normalPos: normal == null ? null : Math.min(normal, 100) / 100,
        nViews: pouco ? `${int(a.n)} ${a.n === 1 ? 'view' : 'views'}` : null,
        alt: `${pctTexto(pct)} assistido${acimaDe100 ? ', acima de 100%: trecho que muita gente voltou para rever' : ''}`,
        contra, alvo,
      } satisfies LinhaVideo,
    }
  })
  linhas.sort((x, y) => y.views28 - x.views28 || (x.linha.titulo < y.linha.titulo ? -1 : x.linha.titulo > y.linha.titulo ? 1 : 0))
  const videos = linhas.map(x => x.linha)

  const abaixo = videos.filter(v => v.alvo)
  const relance = abaixo.length
    ? { negrito: `${abaixo.length} ${abaixo.length === 1 ? 'vídeo tem' : 'vídeos têm'}`, resto: ` views acima do normal do canal e % assistido abaixo do normal da faixa: ${abaixo.map(v => `“${v.titulo}”`).join(', ')}.` }
    : { negrito: '', resto: 'Nenhum vídeo tem views acima do normal do canal com % assistido abaixo do normal da faixa.' }

  return {
    estado: 'ok', titulo: TITULO_ASSISTIDO, nota, vazio: null, faixas, relance, videos,
    semPercentual: semPct === 0 ? null : `${int(semPct)} ${semPct === 1 ? 'vídeo teve' : 'vídeos tiveram'} views, mas o YouTube ainda não entregou o % assistido ${semPct === 1 ? 'dele' : 'deles'}.`,
  }
}
