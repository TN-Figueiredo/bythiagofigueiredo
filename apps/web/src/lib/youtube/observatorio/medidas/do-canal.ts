import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Formato, type Medida } from './tipos'
import {
  baseDaIdade, m1DoCanal, m1DoVideo,
  type FaltaLida, type IdadeDeMarca, type Leitura, type MarcaLida, type ValorM1, type VideoComM1,
} from './m1'
import { curvaDoCanal, type PontoDaCurva, type VideoComSerie } from './curva'
import { caudaDoVideo } from './cauda'
import {
  direcaoDoCanalInteiro, direcaoDosVideosNovos,
  type RetratoDoCanal, type ValorDirecaoCanal, type ValorDirecaoVideos, type VideoParaDirecao,
} from './direcao'
import { estadoDoCanal, type EstadoDoCanal } from './estado-canal'
import { taxaDeAcerto, type ValorAcerto, type VideoParaAcerto } from './acerto'
import { ritmo, type ValorRitmo } from './ritmo'
import { engajamentoDoCanal, engajamentoDoVideo, type ValorEngajamento, type VideoParaEngajamento } from './engajamento'
import { mudouCapitulos, subidasDoVideo, type MudancaDoVideo, type Subida } from './subida'
import { picoSemCauda, type ValorPico } from './pico'
import {
  criadorResponde, pesoDoComentarioDeTopo, pesoDoComentarioDeTopoDoCanal,
  type StatusDoRetrato, type ValorResposta, type VideoParaResposta,
} from './comentarios'
import type {
  CanalLido, CausaNaoLida, MarcasDoCanal, MudancaLida, MudancasDoCanal, Parte, SeriesDoCanal, VideoLido,
} from './ler'

/**
 * New (A5, E4, Tarefa 14): o montador. Puro: recebe o que os leitores devolveram (`Insumos`) e devolve todas as medidas por formato,
 * por vídeo e do canal. Não importa banco, Sentry nem relógio. Uma medida que lança vira `nao_medido` com `calculo_falhou` e entra em
 * `falhas` (só o nome da medida e o nome da classe do erro); quem chama relata. Parte não lida: as medidas que dependem dela saem
 * `leitura_falhou`. Parte não pedida: `serie_nao_pedida` ou `sem_multiplo`.
 */

// ───── os insumos ─────

export interface InsumoDeComentariosDoVideo {
  retrato7: StatusDoRetrato | null
  retrato30: StatusDoRetrato | null
  algumComRespostaDoCriador: boolean
  maiorCurtidas7: number | null
  maiorCurtidas30: number | null
}
export interface InsumosDeComentarios { coletaDesdeMs: number | null; porVideo: Map<string, InsumoDeComentariosDoVideo> }
/** O leitor (Tarefa 15) devolve esta forma; `sem_permissao` é só dele. */
export type ParteDeComentarios = { lido: true; dados: InsumosDeComentarios } | { lido: false; causa: CausaNaoLida | 'sem_permissao' }

export interface Insumos {
  canal: Parte<CanalLido>
  videos: Parte<VideoLido[]>
  marcas: Parte<MarcasDoCanal>
  retratos: Parte<RetratoDoCanal[]>
  series: Parte<SeriesDoCanal> | 'nao_pedida'
  mudancas: Parte<MudancasDoCanal> | 'nao_pedida'
  /** Por `VideoLido.id`. */
  multiplos: Map<string, { valor: number | null; baseFraca: boolean }> | 'nao_pedido'
  comentarios: ParteDeComentarios | 'nao_pedido'
}

// ───── o resultado ─────

export type M1PorIdade = Record<IdadeDeMarca, Medida<ValorM1>>
export interface PorFormato {
  m1: Record<IdadeDeMarca, Medida<number>>
  m2: Medida<PontoDaCurva[]>
  m4: Medida<ValorAcerto>
  m6: Medida<ValorRitmo>
  m7: Medida<number>
  m11: Medida<ValorResposta>
  m12: Record<7 | 30, Medida<number>>
}
/** M3 (b) e (c) são dos vídeos longos: o Short não tem essas duas medidas. */
export interface PorFormatoLongo extends PorFormato {
  m3b: Medida<ValorDirecaoVideos>
  m3c: Medida<ValorDirecaoVideos>
}
export interface MedidasDoVideo {
  formato: Formato | null
  m1: M1PorIdade
  m5: Medida<Subida[]>
  m7: Medida<ValorEngajamento>
  m9: { cauda: Medida<number>; aindaRende: Medida<number> }
  m10: Medida<ValorPico>
  m12: Record<7 | 30, Medida<number>>
}
export interface M8DoCanal { estado: Medida<EstadoDoCanal>; parado: ReturnType<typeof estadoDoCanal>['parado']; queda: ReturnType<typeof estadoDoCanal>['queda'] }
export interface MedidasDoCanal {
  porFormato: { long: PorFormatoLongo; short: PorFormato }
  m3a: Medida<ValorDirecaoCanal>
  m8: M8DoCanal
  porVideo: Map<string, MedidasDoVideo>
  falhas: Array<{ medida: string; classe: string }>
}

// ───── ajudantes ─────

const falhou = (): Medida<never> => naoMedido('leitura_falhou')
const porIdade = <T>(f: (i: IdadeDeMarca) => T): Record<IdadeDeMarca, T> => ({ 1: f(1), 7: f(7), 30: f(30) })
const por7e30 = <T>(f: (m: 7 | 30) => T): Record<7 | 30, T> => ({ 7: f(7), 30: f(30) })
const formatoDe = (v: VideoLido): Formato | null => (v.isShort === true ? 'short' : v.isShort === false ? 'long' : null)
const msDe = (s: string | null): number | null => {
  if (s === null) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

interface Ctx {
  agoraMs: number
  falhas: Array<{ medida: string; classe: string }>
}
function registrar(c: Ctx, nome: string, err: unknown): void {
  c.falhas.push({ medida: nome, classe: err instanceof Error ? err.name : 'desconhecido' })
}
/** Uma medida que lança não derruba as outras: vira `calculo_falhou` e entra em `falhas` (nome da medida e da classe, nunca a mensagem). */
function seguro<T>(c: Ctx, nome: string, f: () => Medida<T>): Medida<T> {
  try {
    return f()
  } catch (err) {
    registrar(c, nome, err)
    return naoMedido('calculo_falhou')
  }
}

interface VideoPronto {
  v: VideoLido
  formato: Formato | null
  publicadoEm: number | null
  baseMs: number | null
  idadeDias: number
  agendadoOuNoAr: boolean
  marcas: Partial<Record<IdadeDeMarca, MarcaLida>>
  faltas: Partial<Record<IdadeDeMarca, FaltaLida>>
  leituras: Leitura[] | undefined
  m1: M1PorIdade
}
type ProntoComData = VideoPronto & { publicadoEm: number }

/** A marca só vale com a base atual do vídeo (a tarefa vai refazer a que ficou para trás). */
const marcaValida = (p: VideoPronto, idade: IdadeDeMarca): MarcaLida | null => {
  const m = p.marcas[idade]
  return m !== undefined && p.baseMs !== null && m.ageBaseAt === p.baseMs ? m : null
}
const faltaValida = (p: VideoPronto, idade: IdadeDeMarca): FaltaLida | null => {
  const f = p.faltas[idade]
  return f !== undefined && p.baseMs !== null && f.ageBaseAt === p.baseMs ? f : null
}

const componenteDe = (m: Medida<ValorEngajamento>): 'os_dois' | 'so_curtidas' | 'so_comentarios' =>
  m.notas.some((n) => n.tipo === 'so_curtidas') ? 'so_curtidas' : m.notas.some((n) => n.tipo === 'so_comentarios') ? 'so_comentarios' : 'os_dois'

/** As mudanças do vídeo no formato de M5(ii); `capitulos` sai de duas descrições seguidas com listas diferentes. */
function mudancasDoVideo(lista: readonly MudancaLida[]): MudancaDoVideo[] {
  const out: MudancaDoVideo[] = []
  let descricaoAnterior: string | null = null
  for (const m of [...lista].sort((a, b) => a.em - b.em)) {
    out.push({ campo: m.campo, em: m.em })
    if (m.campo === 'descricao' && m.valueText !== null) {
      if (descricaoAnterior !== null && mudouCapitulos(descricaoAnterior, m.valueText)) out.push({ campo: 'capitulos', em: m.em })
      descricaoAnterior = m.valueText
    }
  }
  return out
}

export function medidasDoCanal(i: Insumos, o: { agoraMs: number }): MedidasDoCanal {
  const c: Ctx = { agoraMs: o.agoraMs, falhas: [] }
  const agoraMs = o.agoraMs
  const hojeSP = spDateOf(agoraMs)
  const canalLido = i.canal.lido ? i.canal.dados : null
  const videosLidos = i.canal.lido && i.videos.lido ? i.videos.dados : null
  const marcasLidas = videosLidos !== null && i.marcas.lido ? i.marcas.dados : null
  const seriesPedida = i.series !== 'nao_pedida'
  const seriesLida = i.series !== 'nao_pedida' && i.series.lido ? i.series.dados.series : null
  const retratosLidos = canalLido !== null && i.retratos.lido ? i.retratos.dados : null
  const mudancasLidas = i.mudancas !== 'nao_pedida' && i.mudancas.lido ? i.mudancas.dados.mudancas : null
  const comentarios = i.comentarios

  // ── por vídeo: o que as medidas do canal reaproveitam ──
  const prontos: VideoPronto[] = []
  for (const v of videosLidos ?? []) {
    const baseMs = baseDaIdade({ publishedAt: v.publishedAt, liveActualStartAt: v.liveActualStartAt })
    const agendadoOuNoAr = v.liveBroadcastContent === 'upcoming' || v.liveBroadcastContent === 'live'
    const marcas = marcasLidas?.marcas.get(v.id) ?? {}
    const faltas = marcasLidas?.faltas.get(v.id) ?? {}
    const leituras = seriesLida ? (seriesLida.get(v.id) ?? []) : undefined
    const m1 = marcasLidas
      ? porIdade((idade) => seguro(c, 'm1', () => m1DoVideo({ idadeDias: idade, baseMs, agendadoOuNoAr, agoraMs, marca: marcas[idade] ?? null, falta: faltas[idade] ?? null, leituras })))
      : porIdade(falhou)
    prontos.push({
      v, formato: formatoDe(v), publicadoEm: msDe(v.publishedAt), baseMs,
      idadeDias: baseMs === null ? 0 : Math.max(0, Math.floor((agoraMs - baseMs) / DAY)),
      agendadoOuNoAr, marcas, faltas, leituras, m1,
    })
  }
  const comData = prontos.filter((p): p is ProntoComData => p.publicadoEm !== null)

  // ── M7 por vídeo (a reação de M10 e a mediana de M7 do canal usam o mesmo cálculo) ──
  const m7 = new Map<string, Medida<ValorEngajamento>>()
  for (const p of prontos) {
    m7.set(p.v.id, marcasLidas === null ? falhou()
      : p.baseMs === null ? naoMedido('sem_publicacao')
      : seguro(c, 'm7', () => {
        const m30 = marcaValida(p, 30)
        return engajamentoDoVideo({
          views30: m30?.views ?? null, likes30: m30?.likes ?? null, comments30: m30?.comments ?? null, temMarca30: m30 !== null,
          viewsHoje: p.v.viewCount, likesHoje: p.v.likeCount, commentsHoje: p.v.commentCount,
          likesHidden: p.v.likesHidden, commentsDisabled: p.v.commentsDisabled, idadeDias: p.idadeDias, agendadoOuNoAr: p.agendadoOuNoAr,
        })
      }))
  }
  const m7De = (p: VideoPronto): Medida<ValorEngajamento> => m7.get(p.v.id) ?? falhou()

  // ── M3 (a) e M8 ──
  const pausado = canalLido !== null && canalLido.collectionPausedAt !== null
  const m3a: Medida<ValorDirecaoCanal> = canalLido === null ? falhou()
    : pausado ? naoMedido('coleta_pausada')
    : retratosLidos === null ? falhou()
    : seguro(c, 'm3a', () => direcaoDoCanalInteiro(retratosLidos, hojeSP))

  // Publicações: o agendado ('upcoming') não é publicação; o que está no ar conta no instante em que começou.
  const publicacoes = (f: Formato | null): number[] =>
    prontos.filter((p) => p.v.liveBroadcastContent !== 'upcoming' && p.baseMs !== null && (f === null || p.formato === f)).map((p) => p.baseMs as number)

  const m8 = ((): M8DoCanal => {
    if (canalLido === null || videosLidos === null) return { estado: falhou(), parado: falhou(), queda: falhou() }
    const todas = publicacoes(null)
    try {
      const intervalo = ritmo(todas, { agoraMs, parcial: false })
      const r = estadoDoCanal({
        missingSince: canalLido.missingSince,
        ultimaPublicacaoMs: todas.length ? Math.max(...todas) : null,
        intervaloMedianoDias: intervalo.estado === 'medido' ? intervalo.valor.intervaloMedianoDias : null,
        retratos: retratosLidos ?? [], hojeSP, agoraMs, collectionPausedAt: canalLido.collectionPausedAt,
      })
      const queda = retratosLidos === null && !pausado ? falhou() : r.queda
      // Fora do ar e pausado são fatos. Nos outros casos, "ativo" sem parado medido e sem retratos seria afirmar sem evidência.
      const fato = r.estado === 'fora_do_ar' || r.estado === 'pausado'
      const estado: Medida<EstadoDoCanal> = fato || (r.parado.estado === 'medido' && retratosLidos !== null)
        ? medido(r.estado, 1, { de: null, ate: hojeSP, dias: null })
        : retratosLidos === null ? falhou() : naoMedido(r.parado.estado === 'nao_medido' ? r.parado.motivo : 'poucos_videos')
      return { estado, parado: r.parado, queda }
    } catch (err) {
      registrar(c, 'm8', err)
      const f = naoMedido('calculo_falhou')
      return { estado: f, parado: f, queda: f }
    }
  })()

  // ── comentários: o estado de cada vídeo ──
  const faltaComentarios = (): Medida<never> | null => {
    if (comentarios === 'nao_pedido') return naoMedido('sem_permissao')
    if (!comentarios.lido) return comentarios.causa === 'sem_permissao' ? naoMedido('sem_permissao') : falhou()
    return null
  }
  const insumoDe = (p: VideoPronto): InsumoDeComentariosDoVideo | null =>
    comentarios !== 'nao_pedido' && comentarios.lido ? (comentarios.dados.porVideo.get(p.v.id) ?? null) : null

  const m12De = (p: VideoPronto): Record<7 | 30, Medida<number>> => por7e30((marco) => {
    const f = faltaComentarios()
    if (f) return f
    if (marcasLidas === null) return falhou()
    const idade: IdadeDeMarca = marco
    const marca = marcaValida(p, idade)
    const falta = faltaValida(p, idade)
    const ins = insumoDe(p)
    return seguro(c, 'm12', () => pesoDoComentarioDeTopo({
      marco, retrato: marco === 7 ? (ins?.retrato7 ?? null) : (ins?.retrato30 ?? null),
      maiorCurtidasDeComentario: marco === 7 ? (ins?.maiorCurtidas7 ?? null) : (ins?.maiorCurtidas30 ?? null),
      curtidasDoVideoNaMarca: marca?.likes ?? null,
      // A coluna `likes_hidden` da marca ainda não é lida (Tarefa 13): nulo vira `sem_reacao_publica`, nunca `curtidas_ocultas` por palpite.
      likesHiddenNaMarca: null,
      marca: marca !== null ? 'gravada' : falta !== null ? falta.reason : 'aguardando',
    }))
  })

  // ── por formato ──
  const elegiveis = (f: Formato): VideoPronto[] =>
    prontos.filter((p) => p.formato === f && !p.agendadoOuNoAr && p.v.wasLive !== true && p.idadeDias >= MEASURE_RULES.tail.minAgeDays && p.m1[30].estado === 'medido')

  const caudas = new Map<string, { cauda: Medida<number>; aindaRende: Medida<number> }>()
  for (const p of prontos) {
    if (marcasLidas === null) { caudas.set(p.v.id, { cauda: falhou(), aindaRende: falhou() }); continue }
    if (p.baseMs === null) { caudas.set(p.v.id, { cauda: naoMedido('sem_publicacao'), aindaRende: naoMedido('sem_publicacao') }); continue }
    try {
      const r = caudaDoVideo({ v30: p.m1[30], viewsHoje: p.v.viewCount, idadeDias: p.idadeDias, leituras: p.leituras, agoraMs })
      caudas.set(p.v.id, seriesPedida && seriesLida === null ? { cauda: r.cauda, aindaRende: falhou() } : r)
    } catch (err) {
      registrar(c, 'm9', err)
      caudas.set(p.v.id, { cauda: naoMedido('calculo_falhou'), aindaRende: naoMedido('calculo_falhou') })
    }
  }

  const reacaoDe = (p: VideoPronto): { taxa: number; componente: 'os_dois' | 'so_curtidas' | 'so_comentarios' } | null => {
    const m = m7De(p)
    return m.estado === 'medido' && m.valor.base === 'idade_30' ? { taxa: m.valor.taxa, componente: componenteDe(m) } : null
  }
  const valorMedido = (m: Medida<number> | undefined): number | null => (m && m.estado === 'medido' ? m.valor : null)

  const m10De = (p: VideoPronto): Medida<ValorPico> => {
    if (marcasLidas === null) return falhou()
    return seguro(c, 'm10', () => {
      const f = p.formato
      const el = f === null ? [] : elegiveis(f)
      const v30s = el.map((x) => (x.m1[30].estado === 'medido' ? x.m1[30].valor.views : null)).filter((x): x is number => x !== null)
      const cs = el.map((x) => valorMedido(caudas.get(x.v.id)?.cauda)).filter((x): x is number => x !== null)
      const r = reacaoDe(p)
      const rs = r === null ? [] : el.flatMap((x) => { const y = reacaoDe(x); return y !== null && y.componente === r.componente ? [y.taxa] : [] })
      const v30 = p.m1[30]
      const res = picoSemCauda({
        wasLive: p.v.wasLive, idadeDias: p.idadeDias, v30: v30.estado === 'medido' ? v30.valor.views : null,
        cauda: valorMedido(caudas.get(p.v.id)?.cauda), aindaRende: valorMedido(caudas.get(p.v.id)?.aindaRende), reacao: r,
        canal: { nElegiveis: el.length, medianaV30: median(v30s), medianaCauda: median(cs), medianaReacao: median(rs) },
      })
      return i.series === 'nao_pedida' && res.estado === 'nao_medido' && res.motivo === 'serie_diaria_incompleta' ? naoMedido('serie_nao_pedida') : res
    })
  }

  const m5De = (p: VideoPronto): Medida<Subida[]> => {
    if (i.series === 'nao_pedida' || i.mudancas === 'nao_pedida') return naoMedido('serie_nao_pedida')
    if (seriesLida === null || mudancasLidas === null) return falhou()
    return seguro(c, 'm5', () => subidasDoVideo(
      (p.leituras ?? []).map((l) => ({ dia: spDateOf(l.t), t: l.t, views: l.views })),
      mudancasDoVideo(mudancasLidas.get(p.v.id) ?? []),
    ))
  }

  const porVideo = new Map<string, MedidasDoVideo>()
  for (const p of prontos) {
    porVideo.set(p.v.id, { formato: p.formato, m1: p.m1, m5: m5De(p), m7: m7De(p), m9: caudas.get(p.v.id) ?? { cauda: falhou(), aindaRende: falhou() }, m10: m10De(p), m12: m12De(p) })
  }

  const porFormato = (f: Formato): PorFormato => {
    if (videosLidos === null) {
      return { m1: porIdade(falhou), m2: falhou(), m4: falhou(), m6: falhou(), m7: falhou(), m11: falhou(), m12: por7e30(falhou) }
    }
    const comM1 = (idade: IdadeDeMarca): VideoComM1[] => comData.map((p) => ({
      formato: p.formato, publicadoEm: p.publicadoEm, wasLive: p.v.wasLive, missingSince: msDe(p.v.missingSince), m1: p.m1[idade],
    }))
    const m1 = porIdade((idade) => marcasLidas === null ? falhou() : seguro(c, 'm1_canal', () => m1DoCanal(comM1(idade), { formato: f, idadeDias: idade, agoraMs })))
    const m2 = marcasLidas === null || (seriesPedida && seriesLida === null) ? falhou() : seguro(c, 'm2', () => curvaDoCanal(
      comData.map((p): VideoComSerie => ({
        formato: p.formato, publicadoEm: p.publicadoEm, baseMs: p.baseMs, wasLive: p.v.wasLive, agendadoOuNoAr: p.agendadoOuNoAr,
        marcas: p.marcas, faltas: p.faltas, ...(p.leituras !== undefined ? { leituras: p.leituras } : {}),
      })), { formato: f, agoraMs }))
    const m4 = i.multiplos === 'nao_pedido' ? naoMedido('sem_multiplo') : (() => {
      const mult = i.multiplos
      return seguro(c, 'm4', () => taxaDeAcerto(
        prontos.filter((p) => p.baseMs !== null).map((p): VideoParaAcerto => ({
          formato: p.formato, idadeDias: p.idadeDias, multiplo: mult.get(p.v.id)?.valor ?? null, baseFraca: mult.get(p.v.id)?.baseFraca ?? false, agendadoOuNoAr: p.agendadoOuNoAr,
        })), { formato: f }))
    })()
    const m6 = seguro(c, 'm6', () => ritmo(publicacoes(f), { agoraMs, parcial: false }))
    const m7c = marcasLidas === null ? falhou() : seguro(c, 'm7_canal', () => engajamentoDoCanal(
      prontos.filter((p) => p.baseMs !== null).map((p): VideoParaEngajamento => ({ formato: p.formato, wasLive: p.v.wasLive, agendadoOuNoAr: p.agendadoOuNoAr, engajamento: m7De(p) })),
      { formato: f, agoraMs }))
    const falta = faltaComentarios()
    const m11 = falta ?? seguro(c, 'm11', () => criadorResponde(
      prontos.filter((p) => p.baseMs !== null).map((p): VideoParaResposta => ({
        formato: p.formato, idadeDias: p.idadeDias, retrato30: insumoDe(p)?.retrato30 ?? null, algumComRespostaDoCriador: insumoDe(p)?.algumComRespostaDoCriador ?? false,
      })),
      { formato: f, coletaDesdeMs: comentarios !== 'nao_pedido' && comentarios.lido ? comentarios.dados.coletaDesdeMs : null, agoraMs }))
    const m12 = por7e30((marco) => falta ?? (marcasLidas === null ? falhou() : seguro(c, 'm12_canal', () => pesoDoComentarioDeTopoDoCanal(
      prontos.filter((p) => p.formato === f).map((p) => m12De(p)[marco])))))
    return { m1, m2, m4, m6, m7: m7c, m11, m12 }
  }

  const longo = (): PorFormatoLongo => {
    const base = porFormato('long')
    const paraDirecao = (): VideoParaDirecao[] => comData.map((p) => ({
      formato: p.formato, publicadoEm: p.publicadoEm, wasLive: p.v.wasLive, agendadoOuNoAr: p.agendadoOuNoAr,
      viewsHidden: p.v.viewsHidden, viewsHoje: p.v.viewCount, v30: marcasLidas === null ? null : p.m1[30],
    }))
    return {
      ...base,
      m3b: videosLidos === null ? falhou() : seguro(c, 'm3b', () => direcaoDosVideosNovos(paraDirecao(), { agoraMs, base: 'views_de_hoje' })),
      m3c: videosLidos === null || marcasLidas === null ? falhou() : seguro(c, 'm3c', () => direcaoDosVideosNovos(paraDirecao(), { agoraMs, base: 'v30' })),
    }
  }

  return { porFormato: { long: longo(), short: porFormato('short') }, m3a, m8, porVideo, falhas: c.falhas }
}
