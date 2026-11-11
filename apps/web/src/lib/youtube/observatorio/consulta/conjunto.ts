// A4 R3, T4: o conjunto da consulta. Puro: filtra os vídeos do motor e escreve, por linha e por métrica, o que a tela já sabe.
// Nenhuma conta nova: `views`, `vpd7`, `mult` e `subs` saem do motor; curtidas e comentários passam pela regra única `reacaoComEstado`;
// o engajamento é o `m7` pronto das medidas do site (a consulta não monta a M7).
import { winOf } from '../rules'
import { inNiche } from '../niche'
import { spDateOf } from '../time'
import { reacaoComEstado } from '../medidas/engajamento'
import type { MedidasDoVideo } from '../medidas/do-canal'
import type { ObsChannel, ObsVideo } from '../types'
import type { Derived } from '../series'
import type { CelulaDaConsulta, EntradaDoConjunto, LinhaDaConsulta, MetricaDaConsulta, PedidoDaConsulta } from './tipos'

type V = ObsVideo & Derived

const nao = (causa: string): CelulaDaConsulta => ({ x: null, estado: 'nao_medido', causa })
const medidaX = (x: number): CelulaDaConsulta => ({ x, estado: x === 0 ? 'zero_medido' : 'medido' })

const CAUSA_DA_M7: Record<string, string> = {
  poucas_views: 'poucas views para medir',
  sem_reacao_publica: 'sem reação pública (curtidas ocultas e comentários desligados)',
  sem_v30: 'sem leitura de 30 dias e vídeo velho para o total de hoje',
  sem_leitura: 'views não lidas',
  calculo_falhou: 'o cálculo da medida falhou',
}

function celulaDeReacao(valor: number | null, sinal: boolean | null, oculto: string, nome: string): CelulaDaConsulta {
  const r = reacaoComEstado(valor, sinal)
  if (r.estado !== 'nao_medido') return { x: r.x, estado: r.estado }
  if (r.causa === 'oculto') return nao(oculto)
  if (r.causa === 'sem_sinalizador') return nao(`${nome} zero sem confirmação do canal (ainda não relido)`)
  return nao(`${nome} não lidas`)
}

export function montarConjunto(p: PedidoDaConsulta, e: EntradaDoConjunto): { longos: LinhaDaConsulta[]; shorts: LinhaDaConsulta[] } {
  const { obs, medidas } = e
  const canais = new Map<string, ObsChannel>(obs.channels.map(c => [c.id, c]))
  const so = p.canalIds ? new Set(p.canalIds) : null
  const faixas = p.janelaIdade === 'todas' ? null : new Set(p.janelaIdade)
  const longos: LinhaDaConsulta[] = [], shorts: LinhaDaConsulta[] = []

  for (const v of obs.videos as V[]) {
    const ch = canais.get(v.ch)
    if (!ch || ch.own) continue
    if (p.formato === 'longos' && v.fmt !== 'long') continue
    if (p.formato === 'shorts' && v.fmt !== 'short') continue
    if (so && !so.has(v.ch)) continue
    if (p.nicho && !inNiche(p.nicho, v)) continue
    if (e.marcados && !e.marcados.has(v.id)) continue
    const faixa = winOf(v.ageDays)
    if (faixas && (!faixa || !faixas.has(faixa.id))) continue
    const dia = spDateOf(v.pub)
    if (p.publicadoDe && dia < p.publicadoDe) continue
    if (p.publicadoAte && dia > p.publicadoAte) continue

    const info = medidas.videos?.get(v.id)
    const doCanal = medidas.porCanal.get(v.ch)
    const medidasDoVideo: MedidasDoVideo | undefined = doCanal && !('naoCarregou' in doCanal) ? doCanal.porVideo.get(v.id) : undefined
    const semMedidaDoCanal = doCanal === undefined ? 'medidas do canal não carregadas' : 'naoCarregou' in doCanal ? `medidas do canal indisponíveis: ${doCanal.naoCarregou}` : null

    const celulas: LinhaDaConsulta['celulas'] = {}
    const pedida = (m: MetricaDaConsulta) => p.metricas.includes(m)
    const motivos: string[] = []
    if (v.isShort === null) motivos.push('formato não confirmado')
    if (ch.removalRequestedAt) motivos.push('canal agendado para apagar')
    if (info?.missingSince != null) motivos.push('saiu do YouTube em ' + obs.date.dm(info.missingSince))
    if (ch.sync.state === 'atrasado' || ch.sync.state === 'erro') motivos.push(ch.sync.last != null ? 'última leitura ' + obs.date.dm(ch.sync.last) : 'sem leitura boa do canal')
    if (!faixa) motivos.push('idade fora das faixas (vídeo agendado ou data futura)')

    if (pedida('views')) celulas.views = v.views === null ? nao('views não lidas') : medidaX(v.views)
    if (pedida('likes')) celulas.likes = semMedidaDoCanal ? nao(semMedidaDoCanal) : celulaDeReacao(v.likes, info?.likesHidden ?? null, 'curtidas ocultas pelo canal', 'curtidas')
    if (pedida('comentarios')) celulas.comentarios = semMedidaDoCanal ? nao(semMedidaDoCanal) : celulaDeReacao(v.comments, info?.commentsDisabled ?? null, 'comentários desligados', 'comentários')
    if (pedida('vpd7')) {
      if (!v.tracked) celulas.vpd7 = nao('fora dos vídeos acompanhados')
      else if (v.vpd7 != null) celulas.vpd7 = { ...medidaX(v.vpd7), vpdBase: '7d' }
      else if (v.vpd != null) celulas.vpd7 = { ...medidaX(v.vpd), vpdBase: 'desde_publicacao', causa: 'menos de 7 dias de série: views por dia desde a publicação' }
      else celulas.vpd7 = nao(ch.sync.state === 'backfill' ? 'canal ainda buscando vídeos: sem série diária' : 'sem série diária')
    }
    if (pedida('multiplicador')) celulas.multiplicador = !v.tracked ? nao('fora dos vídeos acompanhados') : v.mult?.value != null ? medidaX(v.mult.value) : nao(v.mult?.reason ?? 'sem base de comparação')
    if (pedida('engajamento')) {
      const m7 = medidasDoVideo ? medidasDoVideo.m7 : null
      if (semMedidaDoCanal) celulas.engajamento = nao(semMedidaDoCanal)
      else if (!m7) celulas.engajamento = nao('sem medida do vídeo')
      else if (info?.wasLive === true || (m7.estado === 'nao_medido' && m7.motivo === 'fecha_em')) celulas.engajamento = nao('agendado ou ao vivo')
      else if (m7.estado === 'medido') celulas.engajamento = { ...medidaX(m7.valor.taxa * 1000), base: m7.valor.base }
      else if (m7.motivo === 'leitura_falhou') celulas.engajamento = { x: null, estado: 'falhou', causa: 'marcas do vídeo não lidas' }
      else celulas.engajamento = nao(CAUSA_DA_M7[m7.motivo] ?? m7.motivo)
    }
    if (pedida('inscritos')) celulas.inscritos = ch.subs === null ? nao('inscritos ocultos ou não lidos') : medidaX(ch.subs)

    const mult = v.tracked && v.mult?.value != null ? v.mult : null
    const linha: LinhaDaConsulta = {
      id: v.id, ytId: v.ytId, titulo: v.title, canal: ch.name, canalId: ch.id, publicadoEm: dia, idadeDias: v.ageDays,
      formato: v.fmt === 'short' ? 'shorts' : 'longos', formatoConfirmado: v.isShort !== null,
      estado: v.arquivo ? (v.arquivo.estado === 'leitura_mensal' ? 'leitura_mensal' : 'so_no_arquivo') : 'ativo',
      medidoEm: v.viewsAt != null ? new Date(v.viewsAt).toISOString() : null, lugares: null,
      celulas, multN: mult ? mult.n : null, multMetodo: mult ? mult.method : null, baseFraca: !!mult?.weak, motivos,
    }
    ;(v.fmt === 'short' ? shorts : longos).push(linha)
  }
  return { longos, shorts }
}
