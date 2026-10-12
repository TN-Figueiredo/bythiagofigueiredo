/**
 * Modelo da lista de vídeos do canal próprio (spec 16.4): o cartão tem três colunas (views, impressões, múltiplo), a TERCEIRA
 * LINHA diz o que as impressões permitem afirmar do vídeo e a Lista troca Views/dia e Trocas por Impressões e Cliques.
 *
 * Puro: recebe o dado privado JÁ LIDO (`DadosDoCanal`, com os estados ok / negado / erro) e não lê banco, não pede a prova de
 * edição e não importa os leitores (uma varredura de teste barra). Parte de `buildCanalVideos` (o mesmo vídeo, o mesmo
 * múltiplo, as mesmas notas) e acrescenta o que é do canal próprio. Dado ausente é `null` no tipo e uma frase na tela, nunca
 * zero: vídeo que não aparece nos relatórios lidos é "sem impressão no período" (não "0 impressões"); cliques sem CTR são "não
 * medido"; leitura negada, com erro ou sem relatório diz o motivo UMA vez, na nota do conjunto (`motivoAlcance`), e o cartão
 * só leva a palavra curta da coluna.
 *
 * A ordenação por impressões é do cliente, como todas as da lista (`montarLista` roda no navegador sobre `imp`): este modelo só
 * entrega o número bruto. Quem não tem impressão não é zero: vai para o fim nas duas direções.
 *
 * As views por dia de cada vídeo (diário por vídeo) saem em `vpdDiario*` e o cartão as desenha (A4 13.3); a frase que explica a base, ou o motivo de não haver
 * (UMA vez, no topo da grade), é `viewsPorDiaFrase`; a de cada vídeo vai em "Ações do vídeo" (`notas`). `vpd7`/`vpdText` do motor ficam nulos.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { AlcanceVideo } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { motivoVpdTexto, vpdDoCanal, vpdDoVideo, type MotivoSemVpd, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { buildCanalVideos, type ChannelVideoView } from '../_canal/videos-model'
import { numNb } from '../_canal/formato'
import { vpdText } from '../_canal/numeros'
import type { DadosDoCanal } from './dados'
import { cliquesTexto, FRASE_NADA_LIDO, fraseDoAlcance, lerEstado } from './header-model'
import { VPD_SO_LONGOS, longosAcompanhados } from './extras'

export interface ProprioVideoView extends ChannelVideoView {
  /** Impressões de miniatura no período dos relatórios. null = sem impressão no período OU alcance não lido (a frase diz qual). Nunca 0. */
  imp: number | null
  impText: string | null
  /** A palavra curta da coluna quando não há número ("sem impressão", "só quem edita vê"…); null quando há. */
  impMissing: string | null
  /** Cliques estimados (impressões × CTR por dia, somados SEM arredondar). null = sem impressão, alcance não lido ou CTR nulo em algum dia. */
  cliques: number | null
  /** Arredondado só aqui, pela mesma função do cabeçalho. */
  cliquesText: string | null
  cliquesMissing: string | null
  /** A terceira linha: "2 cliques em 6 dias" | "nenhum clique em 4 dias" | "sem impressão no período" | "cliques: não medido". '' = alcance não lido (o motivo está em `motivoAlcance`, uma vez). Nunca tem percentual. */
  terceira: string
  /** Views por dia deste vídeo (média dos dias com medida nos 28 do YouTube que terminam no último dia gravado, 7 dias no mínimo). 0 é zero medido. */
  vpdDiario: number | null
  vpdDiarioText: string | null
  vpdDiarioMissing: string | null
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
}

/** A base das views por dia que o cartão mostra. Uma só na tela. */
export const VIEWS_POR_DIA_BASE = 'Views por dia: média dos últimos 28 dias com medida.'

/** O motivo de nenhum vídeo ter views por dia, numa frase só ("Views por dia: …."). Sem permissão e leitura com erro têm a sua palavra curta. */
export function viewsPorDiaSemDado(m: MotivoSemVpd, c: Pick<VpdCanal, 'ultimoDia'>, dm: (d: DiaYt) => string): string {
  if (m === 'sem-acesso') return 'Views por dia: só quem edita o site vê.'
  if (m === 'leitura-falhou') return 'Views por dia: a leitura falhou agora; recarregue a página.'
  return `Views por dia: ${motivoVpdTexto(m, c, dm)}.`
}

const SEM_IMPRESSAO = 'sem impressão no período'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A terceira linha do cartão (spec 16.4): a contagem, sem corte e sem percentual. null = o vídeo não aparece nos relatórios lidos. */
export function terceiraLinha(a: AlcanceVideo | null): string {
  if (a == null) return SEM_IMPRESSAO
  if (a.cliques == null) return 'cliques: não medido'
  const n = Math.round(a.cliques)
  return `${n === 0 ? 'nenhum clique' : plural(n, 'clique', 'cliques')} em ${plural(a.diasComImpressao, 'dia', 'dias')}`
}

/** Onde o alcance está para este modelo: o do cabeçalho mais "nada lido" (relatórios existem, nenhum foi lido). */
type EstadoVideos = 'negado' | 'erro' | 'sem-relatorio' | 'nada-lido' | 'ok'

/** A palavra curta que a coluna diz em cada estado sem número. Switch exaustivo: estado novo não compila sem a sua palavra. */
function palavraDaColuna(e: Exclude<EstadoVideos, 'ok'>): string {
  switch (e) {
    case 'negado': return 'só quem edita vê'
    case 'erro': return 'leitura falhou'
    case 'sem-relatorio': return 'sem relatório'
    case 'nada-lido': return 'ainda não lido'
    default: { const nunca: never = e; return nunca }
  }
}

/** Os motivos de LEITURA (iguais para todo vídeo); os outros dependem do vídeo. */
const MOTIVOS_DE_LEITURA: readonly MotivoSemVpd[] = ['sem-acesso', 'leitura-falhou', 'sem-diario', 'diario-parado']

export function buildProprioVideos(
  obs: Observatory, canalId: string, dados: DadosDoCanal, o: { hoje: DiaYt; dm: (d: DiaYt) => string },
): ProprioVideosView | null {
  const ch = obs.channel(canalId)
  if (!ch || !ch.own) return null
  const F = obs.fmt, { dm } = o
  const base = buildCanalVideos(obs, canalId)

  const alc = lerEstado(dados.alcance)
  const estado: EstadoVideos = alc.estado !== 'ok' ? alc.estado : alc.resumo.diasLidos === 0 ? 'nada-lido' : 'ok'
  const motivoAlcance = estado === 'ok' ? null : estado === 'nada-lido' ? FRASE_NADA_LIDO : fraseDoAlcance(estado)
  const periodoTxt = alc.estado === 'ok' ? `de ${dm(alc.periodo.de)} a ${dm(alc.periodo.ate)}` : null
  const porVideo = alc.estado === 'ok' && estado === 'ok' ? alc.porVideo : null

  // views por dia de cada vídeo: o motivo de leitura vale para todos; o resto, vídeo a vídeo
  const longos = new Set(longosAcompanhados(obs, canalId))
  const leitura = vpdDoCanal(dados.diario, [], o.hoje)
  const motivoLeitura = leitura.motivo != null && MOTIVOS_DE_LEITURA.includes(leitura.motivo) ? leitura.motivo : null

  const videos = base.videos.map((v): ProprioVideoView => {
    const notas = [...v.notas]

    /* alcance: impressões, cliques e a terceira linha */
    let imp: number | null = null, impText: string | null = null, impMissing: string | null = null
    let cliques: number | null = null, cliquesText: string | null = null, cliquesMissing: string | null = null
    let terceira = ''
    if (estado !== 'ok') {
      impMissing = cliquesMissing = palavraDaColuna(estado)
    } else {
      const a = porVideo?.get(v.ytId) ?? null
      terceira = terceiraLinha(a)
      if (a == null) {
        impMissing = cliquesMissing = 'sem impressão'
        notas.push(`Impressões: nenhuma nos relatórios lidos ${periodoTxt}.`)
      } else {
        imp = a.imp
        impText = numNb(F, a.imp)   // o espaço antes de "mil"/"mi" não quebra linha, como nas views do cartão
        notas.push(`Impressões: ${F.num(a.imp)} em ${plural(a.diasComImpressao, 'dia', 'dias')}, ${periodoTxt} (dia do YouTube).`)
        if (a.cliques == null) {
          cliquesMissing = 'não medido'
          notas.push('Cliques: o YouTube não devolveu o CTR de algum dia com impressão deste vídeo.')
        } else {
          cliques = a.cliques
          cliquesText = cliquesTexto(a.cliques, F)
        }
      }
    }

    /* views por dia deste vídeo (o diário por vídeo) */
    let vpdDiario: number | null = null, vpdDiarioText: string | null = null, vpdDiarioMissing: string | null = null
    if (motivoLeitura != null) {
      vpdDiarioMissing = motivoVpdTexto(motivoLeitura, leitura, dm)
    } else if (!longos.has(v.ytId)) {
      vpdDiarioMissing = VPD_SO_LONGOS
    } else {
      const c = vpdDoCanal(dados.diario, [v.ytId], o.hoje)
      if (c.valor != null && c.janela != null && dados.diario.acesso === 'ok') {
        vpdDiario = c.valor
        vpdDiarioText = vpdText(c.valor, F.num)
        notas.push(`Views por dia: ${vpdDiarioText}, média de ${plural(vpdDoVideo(dados.diario.dado, v.ytId).dias, 'dia', 'dias')} com medida (de ${dm(c.janela.de)} a ${dm(c.janela.ate)}).`)
      } else if (c.motivo != null) {
        vpdDiarioMissing = motivoVpdTexto(c.motivo, c, dm)
      }
    }
    if (vpdDiario == null && vpdDiarioMissing != null) notas.push(`Views por dia: ${vpdDiarioMissing}.`)

    return {
      ...v, notas,
      // o cartão do canal próprio tem as suas colunas: "views/dia e múltiplo: não medido" é frase do concorrente
      semMedida: null,
      imp, impText, impMissing, cliques, cliquesText, cliquesMissing, terceira,
      vpdDiario, vpdDiarioText, vpdDiarioMissing,
    }
  })

  const nota = 'Múltiplo = views do vídeo ÷ mediana dos outros vídeos do seu canal, do mesmo formato e da mesma faixa de idade. '
    + 'De 2 a 5, alto; de 5 a 10, muito alto; 10 ou mais, topo. '
    + `Impressões = vezes em que a miniatura do vídeo apareceu no YouTube, somadas ${periodoTxt ?? 'no período dos relatórios de alcance'}. `
    + 'Cliques = impressões × CTR de cada dia, somados e arredondados só no fim; é contagem, nunca percentual. '
    + 'O dia é o do YouTube (horário do Pacífico), não o de São Paulo.'
    + (motivoAlcance != null ? ` Impressões e cliques: ${motivoAlcance}.` : '')

  // a frase única do topo da grade: a base, quando algum cartão tem o número; senão, o motivo (do canal inteiro)
  const canalVpd = vpdDoCanal(dados.diario, [...longos], o.hoje)
  const viewsPorDiaFrase = videos.some(v => v.vpdDiarioText != null) || canalVpd.motivo == null ? VIEWS_POR_DIA_BASE : viewsPorDiaSemDado(canalVpd.motivo, canalVpd, dm)

  return { videos, nota, semVideos: base.semVideos, viewsPorDiaFrase, motivoAlcance }
}
