/**
 * Modelo das seções Referências e Inscritos da tela Canais (A5 · E5a, R4). Puro: sem Sentry, sem relógio (`agoraMs` por parâmetro),
 * sem `server-only`, para ser importável fora do Next (paridade com o Cowork, decisão 70). Toda frase nasce aqui; os componentes só desenham.
 * Cada seção roda em `try/catch`: a que lança vira `{ estado: 'erro' }` e entra em `falhas`; a outra segue. Quem envia ao Sentry é `page.tsx`.
 */
import { DAY, H, MINUS } from '@/lib/youtube/observatorio/time'
import { referenciaDoCanal, REGRAS_REFERENCIAS, type ReferenciaDoCanal } from '@/lib/youtube/observatorio/referencias'
import { inscritosDoCanal, REGRAS_INSCRITOS, type InscritosDoCanal } from '@/lib/youtube/observatorio/inscritos-28d'
import type { Fmt, ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { RiFrase, RiLinhaIns, RiLinhaRef, RiPilula, RiSecao, RiView } from './ri-tipos'

/** O que o modelo lê do motor (o `Observatory` inteiro serve). */
export type RiObs = Pick<Observatory, 'channels' | 'videos'> & { SYNC: Pick<Observatory['SYNC'], 'last'> }

export interface RiParams {
  agoraMs: number; niche: string; fmt: Fmt; ordr?: string; ordi?: string; aba?: string; meuCanalLembrado: string | null
}
export type RiFalha = { secao: 'referencias' | 'inscritos'; erro: unknown }

/** Rótulos que não vêm do `ri.js` do mockup (RI-D5): o Logan os revisa na R7. */
export const ROTULOS_NOVOS_RI = {
  coletaVelha: (dm: string) => `sem medida · sem coleta desde ${dm}`,
  poucosVideos: (k: number) => `sem medida · poucos vídeos (${k})`,
  semVideos: { long: 'sem medida · sem vídeos em 90 dias', short: 'sem medida · sem Shorts em 90 dias' },
  janelaParcial: (dm: string) => `provisória · só desde ${dm}`,
  fraseRefVazia: 'Nenhum canal pôde ser medido nos últimos 90 dias.',
  fraseInsVazia: 'Nenhum canal pôde ser medido nos últimos 28 dias.',
  retratoVelho: (dm: string) => `sem medida · sem retrato desde ${dm}`,
  buraco: (dm: string) => `sem medida · retrato faltando em ${dm}`,
  canalProprio: 'sem medida · sem histórico público do seu canal',
  formato: { long: 'vídeos longos', short: 'Shorts' },
  legendaFormato: (f: string) => `Vídeos considerados: ${f}.`,
  datasDaJanela: (de: string, ate: string) => `de ${de} a ${ate}`,
  infoRefJanelaParcial: 'Canal com muitos vídeos novos: se o Observatório não guarda os 90 dias inteiros, a mediana vira provisória e diz desde quando.',
  infoInsTrintaDias: 'A coluna Crescimento da lista usa 30 dias.',
  erroRef: 'Não foi possível carregar as referências. Seus dados não mudaram.',
  erroIns: 'Não foi possível carregar os inscritos. Seus dados não mudaram.',
} as const

// ---------------------------------------------------------------- formatação
const nf = (n: number) => n.toLocaleString('pt-BR')
const d1 = (x: number) => x.toFixed(1).replace('.', ',')
/** Prosa: 1,2 mi / 88 mil. */
function cmp(n: number): string {
  if (n >= 1e6) return d1(n / 1e6) + ' mi'
  if (n >= 1e3) return (n >= 1e5 ? String(Math.round(n / 1e3)) : d1(n / 1e3).replace(',0', '')) + ' mil'
  return String(n)
}
/** Lista: mesma unidade na coluna; "1,42 mi" a partir de 999,95 mil, nunca "1.180 mil". */
function cmpL(n: number): string {
  if (n < 1e3) return String(n)
  const m = Math.round(n / 100) / 10
  if (n >= 1e6 || m >= 1000) return (Math.round(n / 1e4) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi'
  return m.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
}
const fpasso = (p: number) => (p >= 1000 ? '±' + p / 1000 + ' mil' : '±' + p)
const sinal = (g: number) => (g > 0 ? '+' : g < 0 ? MINUS : '')

const fmtSP = (ms: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', ...opts }).format(new Date(ms))
const ddmm = (ms: number) => fmtSP(ms, { day: '2-digit', month: '2-digit' })
const ddmmHm = (ms: number) => ddmm(ms) + ', ' + fmtSP(ms, { hour: '2-digit', minute: '2-digit' })

const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR')

// ---------------------------------------------------------------- escala logarítmica
interface Escala { pos: (v: number) => number; ticks: RiView['ticks'] }
const rotuloTick = (n: number) => (n >= 1e6 ? n / 1e6 + ' mi' : n >= 1e3 ? n / 1e3 + ' mil' : String(n))
function montaEscala(valores: { baixos: number[]; altos: number[] }): Escala {
  const pos0 = valores.baixos.filter(v => v > 0)
  const alt0 = valores.altos.filter(v => v > 0)
  if (pos0.length === 0 && alt0.length === 0) return { pos: () => 0, ticks: [] }
  const menor = Math.min(...pos0, ...alt0)
  const maior = Math.max(...alt0, ...pos0)
  const eLo = Math.max(0, Math.floor(Math.log10(menor)))
  let eHi = Math.ceil(Math.log10(maior))
  if (eHi - eLo < 2) eHi = eLo + 2
  const min = eLo, max = eHi
  const pos = (v: number) => (v <= 0 ? 0 : Math.max(0, Math.min(100, ((Math.log10(v) - min) / (max - min)) * 100)))
  const ticks: RiView['ticks'] = []
  for (let e = eLo; e <= eHi; e++) ticks.push({ pos: pos(Math.pow(10, e)), rotulo: rotuloTick(Math.pow(10, e)) })
  return { pos, ticks }
}

// ---------------------------------------------------------------- Referências
const GLIFO_FAIXA = { estreita: '＝', media: '～', larga: '≋' } as const
const ROTULO_FAIXA = { estreita: 'faixa estreita', media: 'faixa média', larga: 'faixa larga' } as const
const razaoTxt = (r: number) => (r < 10 ? d1(r) : String(Math.round(r))) + '×'

function infoRef(): { titulo: string; itens: string[] } {
  return {
    titulo: 'Como as referências de 90 dias são calculadas',
    itens: [
      'Vídeo típico (mediana): o vídeo do meio. Metade dos vídeos publicados nos últimos 90 dias teve mais views, metade teve menos. Um vídeo que estourou não puxa o número.',
      'Faixa: onde ficam metade dos vídeos (do quarto mais baixo ao quarto mais alto). O número ao lado (3×) diz quantas vezes o fim da faixa é maior que o começo. Até 2× é faixa estreita, até 6× é média, acima é larga. Cortes provisórios, serão ajustados com os canais reais.',
      'Poucos vídeos: com 5 ou mais vídeos (de pelo menos 7 dias) em 90 dias aparece a mediana e a faixa; com 3 ou 4, só uma mediana provisória (marca vazada, sem faixa); com 0 a 2, sem medida.',
      'Escala: logarítmica, cada traço vale 10 vezes o anterior, para um canal de 2 mil e um de 1 milhão caberem na mesma régua.',
      'Sem nota de corte: nenhum canal é "bom" ou "ruim" aqui; a lista só ordena.',
      'Vídeos com menos de 7 dias ficam de fora, porque ainda estão ganhando views.',
      ROTULOS_NOVOS_RI.infoRefJanelaParcial, // TEXTO-A-REVISAR
      'Cálculo do Observatório sobre dados públicos do YouTube. Views de hoje de cada vídeo publicado nos últimos 90 dias.',
    ],
  }
}

function pilulaNmRef(r: Extract<ReferenciaDoCanal, { tipo: 'nm' }>, fmt: Fmt): RiPilula {
  switch (r.motivo) {
    case 'ainda_nao_coletado': return { tipo: 'nm', texto: 'sem medida · ainda não coletado' }
    case 'coleta_velha': return { tipo: 'nm', texto: ROTULOS_NOVOS_RI.coletaVelha(r.desde != null ? ddmm(r.desde) : '–') }
    case 'so_videos_novos': return { tipo: 'nm', texto: ROTULOS_NOVOS_RI.poucosVideos(0) }
    case 'sem_videos_90d': return { tipo: 'nm', texto: ROTULOS_NOVOS_RI.semVideos[fmt] }
    case 'poucos_videos': return { tipo: 'nm', texto: ROTULOS_NOVOS_RI.poucosVideos(r.k) }
    default: { const nunca: never = r.motivo; return nunca }
  }
}

const vazioRef = { estado: 'vazio', titulo: 'Nenhum canal acompanhado ainda.', texto: 'Adicione canais em Canais para ver quem mantém as views em alta.' } as const
const vazioIns = { estado: 'vazio', titulo: 'Sem inscritos para mostrar.', texto: 'Os números aparecem depois da primeira coleta de cada canal.' } as const

/** O canal próprio que a frase cita: o lembrado, ou o único do escopo. */
function canalCitado(escopo: ObsChannel[], lembrado: string | null): string | null {
  const proprios = escopo.filter(c => c.own)
  if (lembrado != null) return proprios.some(c => c.id === lembrado) ? lembrado : null
  return proprios.length === 1 ? proprios[0]!.id : null
}

function secaoReferencias(escopo: ObsChannel[], obs: RiObs, p: RiParams, ordr: 'mediana' | 'faixa'): { secao: RiSecao<RiLinhaRef, 'mediana' | 'faixa'>; ticks: RiView['ticks'] } {
  if (escopo.length === 0) return { secao: vazioRef, ticks: [] }
  const porCanal = new Map<string, ObsVideo[]>()
  for (const v of obs.videos) { const a = porCanal.get(v.ch); if (a) a.push(v); else porCanal.set(v.ch, [v]) }
  const nums = escopo.map(c => ({ c, r: referenciaDoCanal(c, porCanal.get(c.id) ?? [], { fmt: p.fmt, syncDoSite: obs.SYNC.last }) }))

  const oks = nums.filter((x): x is { c: ObsChannel; r: Extract<ReferenciaDoCanal, { tipo: 'ok' }> } => x.r.tipo === 'ok')
  const provs = nums.filter((x): x is { c: ObsChannel; r: Extract<ReferenciaDoCanal, { tipo: 'prov' }> } => x.r.tipo === 'prov')
  const nms = nums.filter((x): x is { c: ObsChannel; r: Extract<ReferenciaDoCanal, { tipo: 'nm' }> } => x.r.tipo === 'nm')
  const esc = montaEscala({
    baixos: [...oks.flatMap(x => [x.r.p25, x.r.mediana]), ...provs.map(x => x.r.mediana)],
    altos: [...oks.flatMap(x => [x.r.p75, x.r.mediana]), ...provs.map(x => x.r.mediana)],
  })
  const nome = (c: ObsChannel) => c.name
  const poMediana = [...oks].sort((a, b) => b.r.mediana - a.r.mediana || nome(a.c).localeCompare(nome(b.c), 'pt-BR'))
  const razaoOrd = (r: { razao: number | null }) => r.razao ?? Infinity
  const poFaixa = [...oks].sort((a, b) => razaoOrd(a.r) - razaoOrd(b.r) || nome(a.c).localeCompare(nome(b.c), 'pt-BR'))

  const linhaOk = (x: (typeof oks)[number]): RiLinhaRef => {
    const { c, r } = x
    const fx = `${GLIFO_FAIXA[r.classe]} ${ROTULO_FAIXA[r.classe]}`
    return {
      id: c.id, nome: c.name, proprio: c.own, rank: null, valor: cmpL(r.mediana),
      sub: `${fx}${r.razao != null ? ' · ' + razaoTxt(r.razao) : ''} · ${r.k} vídeos`,
      marca: esc.pos(r.mediana), faixa: { de: esc.pos(r.p25), ate: esc.pos(r.p75) }, provisoria: false, pilula: null,
      ariaLabel: `${c.name}: vídeo típico de ${nf(r.mediana)} views por vídeo, metade dos vídeos entre ${nf(r.p25)} e ${nf(r.p75)}, ${ROTULO_FAIXA[r.classe]}`,
    }
  }
  const linhaProv = (x: (typeof provs)[number]): RiLinhaRef => ({
    id: x.c.id, nome: x.c.name, proprio: x.c.own, rank: null, valor: cmpL(x.r.mediana), sub: null,
    marca: esc.pos(x.r.mediana), faixa: null, provisoria: true,
    pilula: { tipo: 'prov', texto: x.r.desde != null ? ROTULOS_NOVOS_RI.janelaParcial(ddmm(x.r.desde)) : `provisória · ${x.r.k} vídeos` },
    ariaLabel: `${x.c.name}: vídeo típico provisório de ${nf(x.r.mediana)} views com ${x.r.k} vídeos, sem faixa`,
  })
  const linhaNm = (x: (typeof nms)[number]): RiLinhaRef => {
    const pilula = pilulaNmRef(x.r, p.fmt)
    return { id: x.c.id, nome: x.c.name, proprio: x.c.own, rank: null, valor: null, sub: null, marca: null, faixa: null, provisoria: false, pilula, ariaLabel: `${x.c.name}: ${pilula.texto}` }
  }
  const ordemFinal = ordr === 'faixa' ? poFaixa : poMediana
  const linhas: RiLinhaRef[] = [
    ...ordemFinal.map(linhaOk),
    ...[...provs].sort((a, b) => b.r.mediana - a.r.mediana || nome(a.c).localeCompare(nome(b.c), 'pt-BR')).map(linhaProv),
    ...[...nms].sort((a, b) => nome(a.c).localeCompare(nome(b.c), 'pt-BR')).map(linhaNm),
  ]
  linhas.forEach((l, i) => { if (i < oks.length) l.rank = i + 1 })

  // frase: sempre pelo vídeo típico (o mais alto), qualquer que seja a ordem da lista
  let frase: RiFrase
  if (poMediana.length === 0) frase = [{ t: ROTULOS_NOVOS_RI.fraseRefVazia }]
  else {
    const topo = poMediana[0]!
    const larga = oks.filter(x => x.r.classe === 'larga').length
    const citado = canalCitado(escopo, p.meuCanalLembrado)
    const idx = citado == null ? -1 : poMediana.findIndex(x => x.c.id === citado)
    const clausulas: string[] = []
    if (larga > 0) clausulas.push(`${larga} ${larga === 1 ? 'tem' : 'têm'} faixa larga (as views variam muito de um vídeo para outro)`)
    if (nms.length > 0) clausulas.push(`${nms.length} sem medida`)
    if (provs.length > 0) clausulas.push(`${provs.length} com mediana provisória`)
    const cauda = clausulas.map((t, i) => (i === 0 ? '' : i === 1 ? '; ' : ', ') + t).join('')
    const nOk = poMediana.length
    frase = [
      { t: 'Nos últimos 90 dias, o vídeo típico de ' },
      { t: `${topo.c.name} tem ${cmp(topo.r.mediana)} de views`, b: true },
      { t: nOk > 1 ? `, o mais alto entre os ${nOk} canais medidos. ` : ' (único canal medido). ' },
    ]
    if (idx >= 0) frase.push({ t: `Seu canal está em ${idx + 1}º (${cmp(poMediana[idx]!.r.mediana)}).`, b: true }, { t: cauda ? ' ' : '' })
    frase.push({ t: cauda ? cauda.replace(/^; /, '') + '.' : '' })
    const ultimo = frase[frase.length - 1]!
    if (!ultimo.t) { frase.pop(); const pen = frase[frase.length - 1]!; if (!pen.b) pen.t = pen.t.trimEnd() }
  }
  const legenda = [
    'vídeo típico (mediana)', 'faixa: onde ficam metade dos vídeos', 'mediana provisória, sem faixa', 'sem medida',
    'Fora da ordem, no fim da lista: mediana provisória e sem medida.',
    ROTULOS_NOVOS_RI.legendaFormato(ROTULOS_NOVOS_RI.formato[p.fmt]), // TEXTO-A-REVISAR
  ]
  return {
    ticks: esc.ticks,
    secao: {
      estado: 'ok', frase, info: infoRef(), linhas, legenda, n: linhas.length,
      ordens: {
        mediana: { rotulo: 'Views do vídeo típico', ids: poMediana.map(x => x.c.id) },
        faixa: { rotulo: 'Faixa mais estreita', ids: poFaixa.map(x => x.c.id) },
      },
    },
  }
}

// ---------------------------------------------------------------- Inscritos
function infoIns(): { titulo: string; itens: string[] } {
  return {
    titulo: 'Como o ganho de inscritos em 28 dias é calculado',
    itens: [
      'Ganho: inscritos de hoje menos os de 28 dias atrás, em número e em porcentagem sobre os de 28 dias atrás.',
      'Arredondamento: o YouTube mostra a contagem pública com 3 algarismos, a partir de mil inscritos (143 mil aparece como 143.000, 1,42 milhão como 1.420.000). Os dois números vêm arredondados, então o ganho só conta quando é de pelo menos 2 vezes esse arredondamento.',
      'Sem medida quando: o ganho é menor que 2 vezes o arredondamento ("dentro do arredondamento"); o canal tem menos de 28 dias no Observatório; ou o canal escondeu a contagem.',
      'Sem variação (＝): só quando a contagem é exata (menos de mil inscritos) e o ganho é zero.',
      ROTULOS_NOVOS_RI.infoInsTrintaDias,
      'Cálculo do Observatório sobre dados públicos do YouTube. Contagem pública de inscritos, uma coleta por dia.',
    ],
  }
}

type InsOk = Extract<InscritosDoCanal, { tipo: 'ok' }>
type InsNm = Extract<InscritosDoCanal, { tipo: 'nm' }>

function pilulaNmIns(r: InsNm): { pilula: RiPilula; nota: string | null } {
  const nm = (t: string): RiPilula => ({ tipo: 'nm', texto: t })
  switch (r.motivo) {
    case 'canal_proprio': return { pilula: nm(ROTULOS_NOVOS_RI.canalProprio), nota: null }
    case 'oculto': return { pilula: nm('sem medida · contagem oculta'), nota: 'O canal escondeu a contagem de inscritos.' }
    case 'ainda_nao_coletado': return { pilula: nm('sem medida · ainda não coletado'), nota: null }
    case 'retrato_velho': return { pilula: nm(ROTULOS_NOVOS_RI.retratoVelho(r.data ?? '–')), nota: null }
    case 'novo': return {
      pilula: nm('sem medida · menos de 28 dias'),
      nota: `Entrou há ${r.diasDeHistorico ?? 0} dias; faltam ${r.faltam ?? REGRAS_INSCRITOS.janelaDias} para ter 28 dias de histórico.`,
    }
    case 'buraco': return { pilula: nm(ROTULOS_NOVOS_RI.buraco(r.data ?? '–')), nota: null }
    case 'arred': return { pilula: nm(`sem medida · dentro do arredondamento (${fpasso(r.passo ?? 0)})`), nota: r.hoje != null ? `${cmpL(r.hoje)} no total` : null }
    default: { const nunca: never = r.motivo; return nunca }
  }
}

function secaoInscritos(escopo: ObsChannel[], p: RiParams, ordi: 'pct' | 'abs'): RiSecao<RiLinhaIns, 'pct' | 'abs'> {
  if (escopo.length === 0) return vazioIns
  const nums = escopo.map(c => ({ c, r: inscritosDoCanal(c, { agoraMs: p.agoraMs }) }))
  const oks = nums.filter((x): x is { c: ObsChannel; r: InsOk } => x.r.tipo === 'ok')
  const nms = nums.filter((x): x is { c: ObsChannel; r: InsNm } => x.r.tipo === 'nm')
  const nome = (c: ObsChannel) => c.name
  const desempate = (a: { c: ObsChannel }, b: { c: ObsChannel }) => nome(a.c).localeCompare(nome(b.c), 'pt-BR')
  // % : quem não tem % (antes = 0) vai depois de todos os que têm
  const poPct = [...oks].sort((a, b) => (b.r.pct ?? -Infinity) - (a.r.pct ?? -Infinity) || desempate(a, b))
  const poAbs = [...oks].sort((a, b) => b.r.ganho - a.r.ganho || desempate(a, b))

  // A barra é uma só por linha (contrato da R3): segue o critério da ordem aberta (`ordi`) e a legenda diz qual.
  const medida = (r: InsOk) => Math.abs(ordi === 'pct' ? r.pct ?? 0 : r.ganho)
  const maior = Math.max(1e-9, ...oks.map(x => medida(x.r)))
  const legendaBarra = `Barra: tamanho do ganho ${ordi === 'pct' ? 'em %' : 'em inscritos'}.`

  const linhaOk = ({ c, r }: { c: ObsChannel; r: InsOk }): RiLinhaIns => {
    const dm = (s: string) => s.slice(0, 5)
    const datas = ROTULOS_NOVOS_RI.datasDaJanela(dm(r.de), dm(r.ate))
    const abs = nf(Math.abs(r.ganho))
    return {
      id: c.id, nome: c.name, proprio: c.own, rank: null, classe: r.classe,
      pct: r.classe === 'eq' ? 'sem variação' : r.pct == null ? null : `${sinal(r.ganho)}${d1(Math.abs(r.pct))}%`,
      sub: `${r.classe === 'eq' ? '' : sinal(r.ganho) + abs + ' · '}${cmpL(r.hoje)} no total · ${datas}`,
      barra: r.classe === 'eq' ? 0 : Math.max(1, (medida(r) / maior) * 50), pilula: null, nota: null,
      ariaLabel: `${c.name}: ${r.classe === 'eq' ? 'sem variação' : `${r.ganho > 0 ? 'subiu' : 'caiu'} ${abs} inscritos${r.pct != null ? ', ' + d1(Math.abs(r.pct)) + '%' : ''}`} em 28 dias`,
    }
  }
  const linhaNm = ({ c, r }: { c: ObsChannel; r: InsNm }): RiLinhaIns => {
    const { pilula, nota } = pilulaNmIns(r)
    return { id: c.id, nome: c.name, proprio: c.own, rank: null, classe: null, pct: null, sub: null, barra: null, pilula, nota, ariaLabel: `${c.name}: ${pilula.texto}` }
  }
  const linhas = [...(ordi === 'abs' ? poAbs : poPct).map(linhaOk), ...[...nms].sort(desempate).map(linhaNm)]
  linhas.forEach((l, i) => { if (i < oks.length) l.rank = i + 1 })

  let frase: RiFrase
  if (oks.length === 0) frase = [{ t: ROTULOS_NOVOS_RI.fraseInsVazia }]
  else {
    const bp = poPct.find(x => x.r.pct != null)
    const ba = poAbs[0]!
    const sobe = oks.filter(x => x.r.classe === 'up').length, cai = oks.filter(x => x.r.classe === 'dn').length, igual = oks.filter(x => x.r.classe === 'eq').length
    const partes: string[] = []
    if (sobe > 0) partes.push(`${sobe} ${sobe === 1 ? 'subiu' : 'subiram'}`)
    if (cai > 0) partes.push(`${cai} ${cai === 1 ? 'caiu' : 'caíram'}`)
    if (igual > 0) partes.push(`${igual} sem variação`)
    const cauda = partes.join(', ') + (nms.length > 0 ? `${partes.length ? '; ' : ''}${nms.length} sem medida` : '') + '.'
    const ganhoTxt = (r: InsOk) => `${sinal(r.ganho)}${nf(Math.abs(r.ganho))}`
    frase = [{ t: 'Em 28 dias, ' }]
    if (bp) {
      frase.push({ t: bp.c.name, b: true }, { t: ` cresceu mais em %: ${sinal(bp.r.ganho)}${d1(Math.abs(bp.r.pct!))}% (${ganhoTxt(bp.r)}). ` })
      if (ba === bp) frase.push({ t: 'Também foi o que mais ganhou em número. ' })
      else frase.push({ t: ba.c.name, b: true }, { t: ` ganhou mais em número: ${ganhoTxt(ba.r)}. ` })
    } else {
      frase.push({ t: ba.c.name, b: true }, { t: ` ganhou mais em número: ${ganhoTxt(ba.r)}. ` })
    }
    frase.push({ t: cauda })
  }
  return {
    estado: 'ok', frase, info: infoIns(), linhas, n: linhas.length,
    legenda: ['subiu', 'caiu', 'sem variação', 'sem medida'],
    ordens: {
      pct: { rotulo: 'Ganho em %', ids: poPct.map(x => x.c.id), legendaBarra },
      abs: { rotulo: 'Ganho em inscritos', ids: poAbs.map(x => x.c.id), legendaBarra },
    },
  }
}

// ---------------------------------------------------------------- montagem
const ATALHOS: RiView['atalhos'] = [{ href: '#referencias', rotulo: 'Referências' }, { href: '#inscritos', rotulo: 'Inscritos' }]
const ultimaBoaDe = (obs: RiObs) => (obs.SYNC.last != null ? ddmmHm(obs.SYNC.last) : null)

function avisoDe(obs: RiObs, agoraMs: number): string | null {
  const last = obs.SYNC.last
  if (last == null || agoraMs - last <= REGRAS_REFERENCIAS.coletaVelhaHoras * H) return null
  const dias = Math.floor((agoraMs - last) / DAY)
  return `Mostrando os dados de ${ddmmHm(last)} (última coleta há ${dias} dias). Ordenar continua funcionando.`
}

/** As duas seções em erro (a conta inteira lançou): frases do modelo, sem ordem nem ticks. */
export function riEmErro(obs: RiObs): RiView {
  const ultimaBoa = ultimaBoaDe(obs)
  return {
    aviso: null, atalhos: ATALHOS, ticks: [], ordem: { ref: 'mediana', ins: 'pct' }, aba: 'ref',
    referencias: { estado: 'erro', texto: ROTULOS_NOVOS_RI.erroRef, ultimaBoa },
    inscritos: { estado: 'erro', texto: ROTULOS_NOVOS_RI.erroIns, ultimaBoa },
  }
}

export function buildRiView(obs: RiObs, p: RiParams): { view: RiView; falhas: RiFalha[] } {
  const ordr = p.ordr === 'faixa' ? 'faixa' : 'mediana'
  const ordi = p.ordi === 'abs' ? 'abs' : 'pct'
  const aba = p.aba === 'ins' ? 'ins' : 'ref'
  const escopo = obs.channels.filter(c => p.niche === 'todos' || c.niche === p.niche)
  const falhas: RiFalha[] = []
  const ultimaBoa = ultimaBoaDe(obs)
  let referencias: RiView['referencias']
  let ticks: RiView['ticks'] = []
  try {
    const r = secaoReferencias(escopo, obs, p, ordr)
    referencias = r.secao; ticks = r.ticks
  } catch (erro) {
    falhas.push({ secao: 'referencias', erro })
    referencias = { estado: 'erro', texto: ROTULOS_NOVOS_RI.erroRef, ultimaBoa }
  }
  let inscritos: RiView['inscritos']
  try {
    inscritos = secaoInscritos(escopo, p, ordi)
  } catch (erro) {
    falhas.push({ secao: 'inscritos', erro })
    inscritos = { estado: 'erro', texto: ROTULOS_NOVOS_RI.erroIns, ultimaBoa }
  }
  return { view: { aviso: avisoDe(obs, p.agoraMs), atalhos: ATALHOS, referencias, inscritos, ticks, ordem: { ref: ordr, ins: ordi }, aba }, falhas }
}
