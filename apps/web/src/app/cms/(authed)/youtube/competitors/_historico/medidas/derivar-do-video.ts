// A5 E5a, Tarefa 21c (mockup 13): de UM `CanalInteiro` aos modelos do Histórico de um vídeo. Puro: o relógio e o dado entram por parâmetro,
// nada aqui lê banco. É onde "o que acontece quando o dado não existe?" é respondido: parte não lida vira `null` (o bloco diz "não carregou"),
// nunca lista vazia, nunca zero.
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { VideoLido, MudancaLida } from '@/lib/youtube/observatorio/medidas/ler'
import { baseDaIdade, type Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import type { VideoComSerie } from '@/lib/youtube/observatorio/medidas/curva'
import type { Formato } from '@/lib/youtube/observatorio/medidas/tipos'
import type { Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { Subida } from '@/lib/youtube/observatorio/medidas/subida'
import { normalSem } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import { INICIO_DAS_MARCAS } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { pontosDoVideoDeM1 } from '@/lib/youtube/observatorio/medidas-telas/pontos-por-idade'
import { curvaDe72Horas, tracaoDoCanal, type VideoDaTracao } from '@/lib/youtube/observatorio/medidas-telas/tracao-72h'
import { DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import { DAY, H, spDateOf } from '@/lib/youtube/observatorio/time'
import { blocoDeIdade, type BlocoDeIdade } from './idade-model'
import { blocoDeHoras, type BlocoDeHoras } from './horas-model'
import { cartaoDaSubida, type CartaoDaSubida } from './subida-model'
import { resumoDoVideo, type Resumo } from './resumo-model'
import { listaDeMudancas, numerarMudancas, type CampoDoVideo, type ListaDeMudancas, type MudancaDoVideo, type MudancaNumerada, type PrecisaoDaMudanca } from './mudancas-model'
import { acrescimosDoGrafico, barrasPorDia, contagemPorSemana, type AcrescimosDoGrafico } from './dias-model'

/** `toleranciaVigiaH` da leitura horária: nenhum número escrito aqui. */
const TOLERANCIA_HORARIA_H = DEFINICOES.find((d) => d.nome === 'leitura_horaria')?.toleranciaVigiaH ?? 2

export interface PedidoDeDerivacao {
  agoraMs: number
  /** O vídeo do motor (a página já o tem; vale mesmo se a lista de vídeos do canal não foi lida). */
  video: { id: string; publicadoEmMs: number; viewsAgora: number | null; dur: number | null }
  /** O recorte do eixo do gráfico: de `fromH` a `H`, em horas desde a publicação. */
  eixoH: { fromH: number; H: number }
}

export interface DerivadoDoVideo {
  idade: BlocoDeIdade
  horas: BlocoDeHoras
  subida: CartaoDaSubida
  resumo: Resumo
  /** Nulo = as mudanças não foram lidas: o bloco diz "não carregou". */
  lista: ListaDeMudancas | null
  acrescimos: AcrescimosDoGrafico
  /** A série (ou a parte que o bloco precisa) não foi lida: o gráfico por dia não é desenhado em barras. */
  serieLida: boolean
  /** O primeiro dia sem contagem de um vídeo que saiu do YouTube; nulo = no ar, ou não lido. */
  saiuEm: string | null
  aoVivo: boolean
}

const CAMPOS: Record<string, CampoDoVideo> = {
  titulo: 'titulo', miniatura: 'miniatura', descricao: 'descricao', tags: 'tags', categoria: 'categoria', duracao: 'duracao', capitulos: 'capitulos', idioma: 'idioma',
}

/** A precisão da janela vem da largura dela (a leitura anterior até a que viu): nunca se afirma mais do que o dado diz. */
export function precisaoDaJanela(deMs: number | null, ateMs: number): PrecisaoDaMudanca {
  if (deMs === null) return 'dia'
  const largura = ateMs - deMs
  if (largura <= H) return 'min'
  if (largura <= 6 * H) return '6h'
  return 'dia'
}

/** As mudanças lidas viram as do modelo: as do mesmo instante se juntam; a janela começa na leitura anterior da série (nula se não se sabe). */
export function mudancasDoModelo(lista: readonly MudancaLida[], leituras: readonly Leitura[] | null): MudancaDoVideo[] {
  const ord = [...lista].sort((a, b) => a.em - b.em)
  const porEm = new Map<number, CampoDoVideo[]>()
  for (const m of ord) {
    const c = CAMPOS[m.campo]
    if (c === undefined) continue
    const campos = porEm.get(m.em) ?? []
    if (!campos.includes(c)) campos.push(c)
    porEm.set(m.em, campos)
  }
  const ts = (leituras ?? []).map((l) => l.t).sort((a, b) => a - b)
  return [...porEm.entries()].map(([ateMs, campos]): MudancaDoVideo => {
    let deMs: number | null = null
    for (const t of ts) { if (t < ateMs) deMs = t; else break }
    return { campos, ateMs, deMs, precisao: precisaoDaJanela(deMs, ateMs) }
  })
}

const formatoDe = (v: VideoLido): Formato | null => (v.isShort === true ? 'short' : v.isShort === false ? 'long' : null)
const ms = (s: string | null): number | null => {
  if (s === null) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

export function derivarDoVideo(c: CanalInteiro, p: PedidoDeDerivacao): DerivadoDoVideo {
  const { agoraMs, video } = p
  const hojeSP = spDateOf(agoraMs)
  const medidas = 'naoCarregou' in c.medidas ? null : c.medidas
  const videos = c.videos.lido ? c.videos.dados : null
  const lido = videos?.find((v) => v.id === video.id) ?? null
  const pub = video.publicadoEmMs
  const baseMs = lido ? (baseDaIdade(lido) ?? pub) : pub
  const formato: Formato = (lido ? formatoDe(lido) : null) ?? 'long'
  const serie = c.serie !== 'nao_pedida' && c.serie.lido ? c.serie.dados : null
  const leituras = serie ? (serie.get(video.id) ?? []) : null
  const marcas = c.marcas.lido ? c.marcas.dados : null
  const semanal = lido?.seriesTier === 'semanal'
  const aoVivo = lido?.liveBroadcastContent === 'live'
  const descobertoMs = lido ? ms(lido.discoveredAt) : null
  const saiuMs = lido ? ms(lido.missingSince) : null
  const saiuEm = saiuMs === null ? null : spDateOf(saiuMs)

  // ───── Views por idade ─────
  const m1 = medidas?.porVideo.get(video.id)?.m1 ?? null
  const pontos = leituras !== null && m1 !== null ? pontosDoVideoDeM1({ baseMs: lido ? baseMs : pub }, leituras, m1, agoraMs) : null
  let normal: ReturnType<typeof normalSem> | null = null
  if (videos !== null && marcas !== null && serie !== null) {
    const comSerie = videos.map((v): VideoComSerie & { id: string } => {
      const b = baseDaIdade(v)
      const valida = <T extends { ageBaseAt: number }>(x: T | undefined): T | undefined => (x !== undefined && b !== null && x.ageBaseAt === b ? x : undefined)
      const mc = marcas.marcas.get(v.id) ?? {}
      const fl = marcas.faltas.get(v.id) ?? {}
      const marcasV: VideoComSerie['marcas'] = {}
      const faltasV: VideoComSerie['faltas'] = {}
      for (const i of [1, 7, 30] as const) {
        const a = valida(mc[i]); if (a) marcasV[i] = a
        const f = valida(fl[i]); if (f) faltasV[i] = f
      }
      return {
        id: v.id, formato: formatoDe(v), publicadoEm: ms(v.publishedAt) ?? 0, baseMs: b, wasLive: v.wasLive,
        agendadoOuNoAr: v.liveBroadcastContent === 'upcoming' || v.liveBroadcastContent === 'live',
        marcas: marcasV, faltas: faltasV, leituras: serie.get(v.id),
      }
    })
    normal = normalSem(comSerie, video.id, { formato, agoraMs })
  }
  const horasAteEntrar = descobertoMs === null ? null : (descobertoMs - pub) / H
  const idade = blocoDeIdade({
    hojeSP, inicioDaContagem: INICIO_DAS_MARCAS, publicadoEm: spDateOf(pub), aoVivo, saiuDoYoutube: saiuEm !== null,
    horasAteEntrar, pontos, normal,
  })

  // ───── mudanças e subida ─────
  const mudLidas = c.mudancas !== 'nao_pedida' && c.mudancas.lido ? (c.mudancas.dados.get(video.id) ?? []) : null
  const numeradas: MudancaNumerada[] | null = mudLidas === null ? null : numerarMudancas(mudancasDoModelo(mudLidas, leituras))
  // dia de contagem = dia com a leitura diária das 12:00; o dia que só tem leitura por hora não conta (portão Phil I3)
  const diasDeContagem = leituras === null ? null : new Set(leituras.filter((l) => l.porHora !== true).map((l) => spDateOf(l.t))).size
  const subidas: Medida<Subida[]> | null = medidas?.porVideo.get(video.id)?.m5 ?? null
  const subida = cartaoDaSubida({
    hojeSP, semanal, saiu: saiuEm !== null, diasDeContagem, subidas, mudancas: numeradas,
    inicioDaContagem: INICIO_DAS_MARCAS, publicadoAntesDoInicio: spDateOf(pub) < INICIO_DAS_MARCAS,
  })
  const subidaDia = subida.tipo === 'subiu' ? subida.dia : null

  // ───── As 72 horas ─────
  const horasLidas = c.horas !== 'nao_pedida' && c.horas.lido ? c.horas.dados : null
  let normalHoras: ReturnType<typeof tracaoDoCanal> | null = null
  if (horasLidas !== null && videos !== null) {
    const daTracao: VideoDaTracao[] = []
    for (const v of videos) {
      if (v.id === video.id) continue
      const vp = ms(v.publishedAt)
      if (vp === null) continue
      const d = ms(v.discoveredAt)
      daTracao.push({
        curva: curvaDe72Horas(horasLidas.porVideo.get(v.id) ?? [], vp, agoraMs),
        descobertoComHoras: d === null ? null : (d - vp) / H, aoVivo: v.wasLive, formato: formatoDe(v), publicadoEmMs: vp,
      })
    }
    normalHoras = tracaoDoCanal(daTracao, { formato, agoraMs })
  }
  const diarias = leituras === null ? [] : leituras.filter((l) => l.porHora !== true)
  const primeiroDia = diarias.length > 0 ? spDateOf(Math.min(...diarias.map((l) => l.t))) : null
  const horas = blocoDeHoras({
    agoraMs, publicadoEmMs: pub, descobertoEmMs: descobertoMs, aoVivo, viewsAgora: video.viewsAgora,
    horas: horasLidas, leituras: horasLidas?.porVideo.get(video.id) ?? [], toleranciaH: TOLERANCIA_HORARIA_H,
    normal: normalHoras, contagemPorDiaDesde: primeiroDia,
  })

  // ───── gráfico por dia (acréscimos) ─────
  const dias = leituras === null ? [] : barrasPorDia({ leituras, publicadoEmMs: pub, agoraMs, saiuEm })
  const eixo = { de: spDateOf(pub + p.eixoH.fromH * H), ate: spDateOf(pub + p.eixoH.H * H) }
  const semana = semanal && leituras !== null ? contagemPorSemana(leituras, pub) : null
  const acrescimos = acrescimosDoGrafico({ publicadoEmMs: pub, subidaDia, saiuEm, eixo, mudancas: numeradas, semanal: semana })

  // ───── resumo ─────
  const zerosDias = dias.filter((d) => d.tipo === 'zero').length
  const medidosDias = dias.filter((d) => d.tipo === 'com' || d.tipo === 'zero').length
  const ultimaLeitura = leituras && leituras.length > 0 ? Math.max(...leituras.map((l) => l.t)) : null
  const resumo = resumoDoVideo({
    hojeSP, inicioDaContagem: INICIO_DAS_MARCAS, viewsAgora: video.viewsAgora, idade, subida, mudancas: numeradas, semanal, aoVivo,
    diasDeContagem, idadeDoVideoDias: Math.max(0, Math.floor((agoraMs - pub) / DAY)),
    saiu: saiuEm !== null ? { em: saiuEm, ultimaContagem: ultimaLeitura === null ? null : spDateOf(ultimaLeitura) } : null,
    entrouTarde: horasAteEntrar !== null && horasAteEntrar > 72 && descobertoMs !== null ? { em: spDateOf(descobertoMs), falta: null } : null,
    zeros: {
      dias: zerosDias, diasMedidos: medidosDias,
      horas: horas.tipo === 'ok' ? horas.zeros : null, horasMedidas: horas.tipo === 'ok' ? horas.medidas : null,
    },
  })

  const lista = numeradas === null ? null : listaDeMudancas(numeradas, { subidaDia, inicioDoHistorico: INICIO_DAS_MARCAS })
  return { idade, horas, subida, resumo, lista, acrescimos, serieLida: leituras !== null, saiuEm, aoVivo }
}
