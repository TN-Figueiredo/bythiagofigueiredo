/**
 * Modelo da lista de vídeos do canal próprio (spec 16.4): o cartão tem três colunas (views, impressões, múltiplo), a TERCEIRA
 * LINHA diz o que as impressões permitem afirmar do vídeo e a Lista troca Views/dia e Trocas por Impressões e Cliques.
 *
 * Puro: recebe o dado privado JÁ LIDO (`DadosDoCanal`, com os estados ok / negado / erro) e não lê banco, não pede a prova de
 * edição e não importa os leitores (uma varredura de teste barra). Parte de `buildCanalVideos` (o mesmo vídeo, o mesmo
 * múltiplo, as mesmas notas) e acrescenta o que é do canal próprio. Dado ausente é `null` no tipo e uma frase na tela, nunca
 * zero: vídeo que não aparece em NENHUM relatório medido é ZERO MEDIDO (`semImpressao`, "0" na caixa vazada, como no gráfico) e só o dia sem relatório é
 * "não medido"; cliques sem a taxa de clique de algum dia são "não medido"; leitura negada, com erro ou sem relatório diz o motivo UMA vez, na nota do conjunto (`motivoAlcance`), e o cartão
 * só leva a palavra curta da coluna.
 *
 * A ordenação por impressões é do cliente, como todas as da lista (`montarLista` roda no navegador sobre `imp`): este modelo só
 * entrega o número bruto. Quem não tem impressão não é zero: vai para o fim nas duas direções.
 *
 * As views por dia de cada vídeo (diário por vídeo) saem em `vpdDiario*` e o cartão as desenha (A4 13.3); a frase que explica a base, ou o motivo de não haver
 * (UMA vez, no topo da grade), é `viewsPorDiaFrase`; a de cada vídeo vai em "Ações do vídeo" (`notas`). `vpd7`/`vpdText` do motor ficam nulos.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { montarDias, publicacoesDe, resumir, videoNovo, type AlcanceVideo } from '@/lib/youtube/observatorio/proprio/dias'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { motivoVpdTexto, vpdDoCanal, vpdDoVideo, type MotivoSemVpd, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { buildCanalVideos, type ChannelVideoView } from '../_canal/videos-model'
import { numNb } from '../_canal/formato'
import { vpdText } from '../_canal/numeros'
import { ausenciaDoAcesso, ausenciaDoVpdComNegativa, type EstadoAusencia, type NegativaPrivada } from '../_chrome/ausencia/estado'
import type { DadosDoCanal } from './dados'
import { cliquesTexto, FRASE_NADA_LIDO, fraseDoAlcance, lerEstado } from './header-model'
import { VPD_SO_LONGOS, longosAcompanhados } from './extras'
import { FRASE_VIDEO_NOVO, PALAVRA_VIDEO_NOVO } from './reguas-model'

export interface ProprioVideoView extends ChannelVideoView {
  /**
   * true = ZERO MEDIDO: o alcance foi lido, houve dia medido e este vídeo não apareceu em nenhum (a tela mostra "0" na caixa vazada, em impressões e
   * em cliques). false = tem número, ou o alcance não foi lido (palavra do motivo na hachura). Nunca é true sem dia medido.
   */
  semImpressao: boolean
  /** Impressões de miniatura no período dos relatórios. null = sem impressão no período (`semImpressao`) OU alcance não lido (a frase diz qual). Nunca 0. */
  imp: number | null
  impText: string | null
  /** A palavra curta da coluna quando não há número ("só quem edita vê", "leitura falhou"…); null quando há número ou quando é zero medido (`semImpressao`). */
  impMissing: string | null
  /** Decisão 75: o estado de ausência de impressões e de cliques (null ⇔ há número ou zero medido). A forma da pastilha sai DAQUI, nunca da palavra. */
  impEstado: EstadoAusencia | null
  cliquesEstado: EstadoAusencia | null
  /** Cliques estimados (impressões × CTR por dia, somados SEM arredondar). null = sem impressão, alcance não lido ou CTR nulo em algum dia. */
  cliques: number | null
  /** Arredondado só aqui, pela mesma função do cabeçalho. */
  cliquesText: string | null
  cliquesMissing: string | null
  /** A terceira linha: "2 cliques em 6 dias" | "nenhum clique em 4 dias" | "cliques: não medido". '' = alcance não lido (o motivo está em `motivoAlcance`, uma vez). Nunca tem percentual. */
  terceira: string
  /** Views por dia deste vídeo (média dos dias com medida nos 28 do YouTube que terminam no último dia gravado, 7 dias no mínimo). 0 é zero medido. */
  vpdDiario: number | null
  vpdDiarioText: string | null
  vpdDiarioMissing: string | null
  /** Decisão 75: o estado de ausência das views por dia deste vídeo (null ⇔ há número). */
  vpdDiarioEstado: EstadoAusencia | null
}

export interface ProprioVideosView {
  videos: ProprioVideoView[]
  /** A nota sob a grade: múltiplo, impressões, cliques e o dia do YouTube; com o motivo de leitura, quando houver. */
  nota: string
  semVideos: string | null
  /** A frase única das views por dia por vídeo: a base ("média dos últimos 28 dias com medida") ou o motivo de não haver; a tela a mostra uma vez, na linha das abas. */
  viewsPorDiaFrase: string
  /** Por que não há impressão nem clique em NENHUM vídeo (negado, erro, sem relatório, nada lido). null = o alcance foi lido. */
  motivoAlcance: string | null
  /** Decisão 75: o estado de `motivoAlcance` (null ⇔ o alcance foi lido). */
  motivoAlcanceEstado: EstadoAusencia | null
  /** Decisão 75: o estado de ausência de `viewsPorDiaFrase` quando ela é o motivo de não haver views por dia (null = é a base). */
  viewsPorDiaEstado: EstadoAusencia | null
}

/** A base das views por dia que o cartão mostra. Uma só na tela. */
export const VIEWS_POR_DIA_BASE = 'Views por dia: média dos últimos 28 dias com medida.'

/** O motivo de nenhum vídeo ter views por dia, numa frase só ("Views por dia: …."). Sem permissão e leitura com erro têm a sua palavra curta. */
export function viewsPorDiaSemDado(m: MotivoSemVpd, c: Pick<VpdCanal, 'ultimoDia'>, dm: (d: DiaYt) => string): string {
  if (m === 'sem-acesso') return 'Views por dia: só quem edita o site vê.'
  if (m === 'leitura-falhou') return 'Views por dia: a leitura falhou agora; recarregue a página.'
  return `Views por dia: ${motivoVpdTexto(m, c, dm)}.`
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A terceira linha do cartão (spec 16.4): a contagem, sem corte e sem percentual. Vídeo que não aparece nos relatórios (zero medido) não tem terceira linha: a caixa "0" já diz. */
export function terceiraLinha(a: AlcanceVideo): string {
  if (a.cliques == null) return 'cliques: não medido'
  const n = Math.round(a.cliques)
  return `${n === 0 ? 'nenhum clique' : plural(n, 'clique', 'cliques')} em ${plural(a.diasComImpressao, 'dia', 'dias')}`
}

/** Onde o alcance está para este modelo: o do cabeçalho mais "nada lido" (relatórios existem, nenhum foi lido). */
type EstadoVideos = 'negado' | 'erro' | 'sem-relatorio' | 'nada-lido' | 'ok'

/** A palavra curta que a coluna diz em cada estado sem número e o estado de ausência dela. Switch exaustivo: estado novo não compila sem a sua palavra. `negado` só é restrito com a negativa `sem_direito` (guarda caída = falhou). */
function colunaSemNumero(e: Exclude<EstadoVideos, 'ok'>, negativa: NegativaPrivada): { palavra: string; estado: EstadoAusencia } {
  switch (e) {
    case 'negado': return { palavra: 'só quem edita vê', estado: ausenciaDoAcesso('negado', negativa) ?? 'falhou' }
    case 'erro': return { palavra: 'leitura falhou', estado: 'falhou' }
    case 'sem-relatorio': return { palavra: 'sem relatório', estado: 'nao_medido' }
    case 'nada-lido': return { palavra: 'ainda não lido', estado: 'nao_medido' }
    default: { const nunca: never = e; return nunca }
  }
}

/** Os motivos de LEITURA (iguais para todo vídeo); os outros dependem do vídeo. */
const MOTIVOS_DE_LEITURA: readonly MotivoSemVpd[] = ['sem-acesso', 'leitura-falhou', 'sem-diario', 'diario-parado']

export function buildProprioVideos(
  obs: Observatory, canalId: string, dados: DadosDoCanal, o: { hoje: DiaYt; dm: (d: DiaYt) => string; negativa?: NegativaPrivada },
): ProprioVideosView | null {
  const ch = obs.channel(canalId)
  if (!ch || !ch.own) return null
  const F = obs.fmt, { dm } = o
  const negativa = o.negativa ?? null
  const base = buildCanalVideos(obs, canalId)

  const alc = lerEstado(dados.alcance, o.hoje, publicacoesDe(base.videos))
  const estado: EstadoVideos = alc.estado !== 'ok' ? alc.estado : alc.resumo.diasLidos === 0 ? 'nada-lido' : 'ok'
  const motivoAlcance = estado === 'ok' ? null : estado === 'nada-lido' ? FRASE_NADA_LIDO : fraseDoAlcance(estado, alc.estado === 'sem-relatorio' ? { parouEm: alc.parouEm, dm } : undefined)
  const periodoTxt = alc.estado === 'ok' ? `de ${dm(alc.periodo.de)} a ${dm(alc.periodo.ate)}` : null
  const porVideo = alc.estado === 'ok' && estado === 'ok' ? alc.porVideo : null
  const semNumero = estado === 'ok' ? null : colunaSemNumero(estado, negativa)
  const motivoAlcanceEstado = semNumero?.estado ?? null

  // views por dia de cada vídeo: o motivo de leitura vale para todos; o resto, vídeo a vídeo
  const longos = new Set(longosAcompanhados(obs, canalId))
  const leitura = vpdDoCanal(dados.diario, [], o.hoje)
  const motivoLeitura = leitura.motivo != null && MOTIVOS_DE_LEITURA.includes(leitura.motivo) ? leitura.motivo : null

  /** Os dias que valem para o vídeo (a partir da publicação, D e D-1 sem linha fora do zero): a mesma regra do gráfico do vídeo. */
  const diasDoVideo = (v: { ytId: string }, publicadoEm: DiaYt | null) => {
    if (dados.alcance.acesso !== 'ok') return { periodo: null, resumo: resumir([]) }
    const m = montarDias(dados.alcance.dado, { hoje: o.hoje, ytId: v.ytId, publicadoEm })
    return { periodo: m.periodo, resumo: resumir(m.dias) }
  }
  const videos = base.videos.map((v): ProprioVideoView => {
    const notas = [...v.notas]

    /* alcance: impressões, cliques e a terceira linha */
    let imp: number | null = null, impText: string | null = null, impMissing: string | null = null, semImpressao = false
    let impEstado: EstadoAusencia | null = null, cliquesEstado: EstadoAusencia | null = null
    let cliques: number | null = null, cliquesText: string | null = null, cliquesMissing: string | null = null
    let terceira = ''
    if (semNumero != null) {
      impMissing = cliquesMissing = semNumero.palavra
      impEstado = cliquesEstado = semNumero.estado
    } else {
      const a = porVideo?.get(v.ytId) ?? null
      terceira = a == null ? '' : terceiraLinha(a)
      if (a == null) {
        const publicadoEm = v.pub != null ? dayPt(new Date(v.pub)) : null
        const dv = diasDoVideo(v, publicadoEm)
        if (videoNovo(publicadoEm, o.hoje)) {
          // menos de 3 dias de vida (o mesmo limite da página e da régua): o alcance chega com 2 a 3 dias de atraso, então ausência de linha nunca é zero
          impMissing = cliquesMissing = PALAVRA_VIDEO_NOVO
          impEstado = cliquesEstado = 'nao_medido'
          terceira = ''
          notas.push(`Impressões e cliques: ${FRASE_VIDEO_NOVO}.`)
        } else if (dv.resumo.diasLidos === 0) {
          // nenhum dia valeu para ESTE vídeo (o último dia medido é anterior à publicação dele): ainda não há o que dizer, e zero seria inventar
          impMissing = cliquesMissing = 'não medido'
          impEstado = cliquesEstado = 'nao_medido'
          terceira = ''
        } else {
          // há dia medido desde a publicação (D e D-1 não contam) e o vídeo não apareceu em nenhum: zero medido, não "não medido"
          semImpressao = true
          const medidos = dv.resumo.diasLidos
          const sem = dv.resumo.diasNaoMedidos > 0 ? ` (${plural(dv.resumo.diasNaoMedidos, 'dia', 'dias')} sem dado)` : ''
          const periodoDoVideo = dv.periodo != null ? `de ${dm(dv.periodo.de)} a ${dm(dv.periodo.ate)}` : periodoTxt
          notas.push(`Impressões: nenhuma ${medidos === 1 ? 'em' : 'nos'} ${plural(medidos, 'dia medido', 'dias medidos')}${sem}, ${periodoDoVideo}.`)
        }
      } else {
        imp = a.imp
        impText = numNb(F, a.imp)   // o espaço antes de "mil"/"mi" não quebra linha, como nas views do cartão
        notas.push(`Impressões: ${F.num(a.imp)} em ${plural(a.diasComImpressao, 'dia', 'dias')}, ${periodoTxt} (dia do YouTube).`)
        if (a.cliques == null) {
          cliquesMissing = 'não medido'
          cliquesEstado = 'nao_medido'
          notas.push('Cliques: o YouTube não informou a taxa de clique de algum dia com impressões deste vídeo.')
        } else {
          cliques = a.cliques
          cliquesText = cliquesTexto(a.cliques, F)
        }
      }
    }

    /* views por dia deste vídeo (o diário por vídeo) */
    let vpdDiario: number | null = null, vpdDiarioText: string | null = null, vpdDiarioMissing: string | null = null
    let vpdDiarioEstado: EstadoAusencia | null = null
    if (motivoLeitura != null) {
      vpdDiarioMissing = motivoVpdTexto(motivoLeitura, leitura, dm)
      vpdDiarioEstado = ausenciaDoVpdComNegativa(motivoLeitura, negativa) ?? 'nao_medido'
    } else if (!longos.has(v.ytId)) {
      vpdDiarioMissing = VPD_SO_LONGOS
      vpdDiarioEstado = 'nao_medido'
    } else {
      const c = vpdDoCanal(dados.diario, [v.ytId], o.hoje)
      if (c.valor != null && c.janela != null && dados.diario.acesso === 'ok') {
        vpdDiario = c.valor
        vpdDiarioText = vpdText(c.valor, F.num)
        notas.push(`Views por dia: ${vpdDiarioText}, média de ${plural(vpdDoVideo(dados.diario.dado, v.ytId).dias, 'dia', 'dias')} com medida (de ${dm(c.janela.de)} a ${dm(c.janela.ate)}).`)
      } else if (c.motivo != null) {
        vpdDiarioMissing = motivoVpdTexto(c.motivo, c, dm)
        vpdDiarioEstado = ausenciaDoVpdComNegativa(c.motivo, negativa) ?? 'nao_medido'
      }
    }
    if (vpdDiario == null && vpdDiarioMissing != null) notas.push(`Views por dia: ${vpdDiarioMissing}.`)

    return {
      ...v, notas,
      // o cartão do canal próprio tem as suas colunas: "views/dia e múltiplo: não medido" é frase do concorrente
      semMedida: null,
      semImpressao, imp, impText, impMissing, impEstado, cliquesEstado, cliques, cliquesText, cliquesMissing, terceira,
      vpdDiario, vpdDiarioText, vpdDiarioMissing, vpdDiarioEstado,
    }
  })

  const nota = 'Múltiplo = views do vídeo ÷ mediana dos outros vídeos do seu canal, do mesmo formato e da mesma faixa de idade. '
    + 'De 2 a 5, alto; de 5 a 10, muito alto; 10 ou mais, topo. '
    + `Impressões = vezes em que a thumbnail do vídeo apareceu no YouTube, somadas ${periodoTxt ?? 'no período dos relatórios de alcance'}. `
    + 'Cliques = impressões × taxa de clique de cada dia, somados e arredondados só no fim; é contagem, nunca percentual. '
    + 'O dia é o do YouTube (horário do Pacífico), não o de São Paulo. '
    + 'Caixa vazada com 0: o YouTube mediu o período e o vídeo não apareceu. Hachura: ainda não medido.'
    + (motivoAlcance != null ? ` Impressões e cliques: ${motivoAlcance}.` : '')

  // a frase única do topo da grade: a base, quando algum cartão tem o número; senão, o motivo (do canal inteiro)
  const canalVpd = vpdDoCanal(dados.diario, [...longos], o.hoje)
  const viewsPorDiaFrase = videos.some(v => v.vpdDiarioText != null) || canalVpd.motivo == null ? VIEWS_POR_DIA_BASE : viewsPorDiaSemDado(canalVpd.motivo, canalVpd, dm)

  const viewsPorDiaEstado = videos.some(v => v.vpdDiarioText != null) || canalVpd.motivo == null ? null : (ausenciaDoVpdComNegativa(canalVpd.motivo, negativa) ?? 'nao_medido')

  return { videos, nota, semVideos: base.semVideos, viewsPorDiaFrase, motivoAlcance, motivoAlcanceEstado, viewsPorDiaEstado }
}
