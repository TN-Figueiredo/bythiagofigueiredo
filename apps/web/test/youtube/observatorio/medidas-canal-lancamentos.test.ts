// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

vi.mock('server-only', () => ({}))

import { horasDoCanal, lancamentosDoCanal, type EntradaDeLancamentos } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos-model'
import { Lancamentos } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos'
import { HorasDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/horas-do-canal'
import { formatoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/cabecalho-model'
import { oracaoDoUltimoVideo } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/frase-do-topo'
import { medidasDoCanal, type Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { faixaDeLancamento } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import type { HorasDoCanal as HorasLidas, LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'
import { AGORA_CHEIA, HOJE_CHEIA, insumosCheios } from './medidas-fixture'

const H = 3_600_000
const F = { num: (v: number | null) => (v === null ? '—' : String(Math.round(v))) }

function entrada(ins: Insumos, o: Partial<EntradaDeLancamentos> = {}): EntradaDeLancamentos {
  const videos = ins.videos.lido ? ins.videos.dados : []
  const m = medidasDoCanal(ins, { agoraMs: AGORA_CHEIA })
  return {
    F, medidas: m, videos, marcas: ins.marcas.lido ? ins.marcas.dados : null,
    serie: ins.series !== 'nao_pedida' && ins.series.lido ? ins.series.dados.series : null,
    formato: formatoDoCanal(videos), titulos: new Map(videos.map(v => [v.id, `Título ${v.id}`])),
    primeiraBusca: false, agoraMs: AGORA_CHEIA, hojeSP: HOJE_CHEIA, ...o,
  }
}
/** A fixture cheia, ficando só com os vídeos que `f` aceita. */
function so(f: (v: VideoLido) => boolean): Insumos {
  const ins = insumosCheios()
  if (!ins.videos.lido) throw new Error('fixture')
  return { ...ins, videos: { lido: true, dados: ins.videos.dados.filter(f) } }
}
const longos = (ids: string[]) => so(v => !v.isShort && ids.includes(v.id))
const html = (e: EntradaDeLancamentos) => renderToStaticMarkup(createElement(Lancamentos, { modelo: lancamentosDoCanal(e).modelo, horas: null }))

describe('Lançamentos: o modelo', () => {
  it('abre pelo último, lista 6 e cada vídeo tem curva, faixa e frase própria', () => {
    const { modelo, ultimo } = lancamentosDoCanal(entrada(insumosCheios()))
    expect(modelo.tipo).toBe('curvas')
    if (modelo.tipo !== 'curvas') return
    expect(modelo.videos).toHaveLength(6)
    expect(modelo.videos[0]!.id).toBe('v0')
    expect(modelo.videos[0]!.legenda).toMatch(/^o último longo · publicado há 8 dias · /)
    expect(modelo.temNormal).toBe(true)
    expect(modelo.videos.every(v => v.curva.length > 0 && v.frase.negrito.startsWith('“Título '))).toBe(true)
    expect(new Set(modelo.videos.map(v => v.frase.negrito)).size).toBe(6)
    expect(ultimo.tipo).toBe('medido')
    for (const v of modelo.videos) if (v.ultima) expect(v.faixa).toBe(faixaDeLancamento(v.ultima.razao))
  })
  it('o dia em que passou do normal é o primeiro ponto com razão de 1,5 ou mais', () => {
    const { modelo } = lancamentosDoCanal(entrada(insumosCheios()))
    if (modelo.tipo !== 'curvas') throw new Error('curvas')
    const comPassou = modelo.videos.filter(v => v.passou)
    for (const v of comPassou) {
      expect(v.passou!.razao).toBeGreaterThanOrEqual(1.5)
      expect(v.frase.negrito).toContain(`saiu acima do normal já no dia ${v.passou!.dia}`)
    }
  })
  it('série não lida: o bloco diz não carregou, não o cartão de "nenhum vídeo"', () => {
    const r = lancamentosDoCanal(entrada(insumosCheios(), { serie: null }))
    expect(r.modelo.tipo).toBe('nao_carregou')
    expect(html(entrada(insumosCheios(), { serie: null }))).toContain('Não carregou')
    expect(html(entrada(insumosCheios(), { serie: null }))).not.toContain('Nenhum vídeo longo')
  })
  it('medidas, vídeos ou marcas que não vieram: não carregou', () => {
    expect(lancamentosDoCanal(entrada(insumosCheios(), { medidas: null })).modelo.tipo).toBe('nao_carregou')
    expect(lancamentosDoCanal(entrada(insumosCheios(), { videos: null })).modelo.tipo).toBe('nao_carregou')
    expect(lancamentosDoCanal(entrada(insumosCheios(), { marcas: null })).modelo.tipo).toBe('nao_carregou')
  })
  it('nenhum vídeo com um dia de contagem: cartão de uma linha, sem gráfico e sem as oito casas', () => {
    const ins = so(v => v.id === 'v0')
    if (!ins.videos.lido) throw new Error('fixture')
    const novo: VideoLido = { ...ins.videos.dados[0]!, publishedAt: new Date(AGORA_CHEIA - 12 * H).toISOString() }
    const e = entrada({ ...ins, videos: { lido: true, dados: [novo] } })
    const r = lancamentosDoCanal(e)
    expect(r.modelo.tipo).toBe('vazio')
    expect(r.ultimo).toMatchObject({ tipo: 'saiu_agora', quando: 'hoje', anterior: null })
    const h = html(e)
    expect(h).toContain('Nenhum vídeo longo com contagem por vídeo ainda.')
    expect(h).not.toContain('pc-nrow')
    expect(h).not.toContain('<svg class="pc-svg"')
  })
  it('o último vídeo com menos de um dia não entra, e a lista continua com 6; a oração usa o anterior', () => {
    const ins = insumosCheios()
    if (!ins.videos.lido) throw new Error('fixture')
    const novo: VideoLido = { ...ins.videos.dados[0]!, id: 'novo', publishedAt: new Date(AGORA_CHEIA - 12 * H).toISOString() }
    const r = lancamentosDoCanal(entrada({ ...ins, videos: { lido: true, dados: [novo, ...ins.videos.dados] } }))
    if (r.modelo.tipo !== 'curvas') throw new Error('curvas')
    expect(r.modelo.videos).toHaveLength(6)
    expect(r.modelo.videos.some(v => v.id === 'novo')).toBe(false)
    expect(r.modelo.videos[0]!.legenda).toMatch(/^o mais recente com contagem · /)
    expect(r.ultimo.tipo).toBe('saiu_agora')
    expect(oracaoDoUltimoVideo(r.ultimo, { quem: 'vídeo', ate: null })).toMatch(/^O último vídeo saiu hoje e ainda não completou um dia de contagem\. O anterior, “Título v0”/)
  })
  it('vídeo anterior à contagem por vídeo: sem leitura, com o motivo', () => {
    const ins = so(v => v.id === 'v0')
    if (!ins.videos.lido) throw new Error('fixture')
    const antigo: VideoLido = { ...ins.videos.dados[0]!, publishedAt: '2026-09-20T12:00:00Z' }
    const r = lancamentosDoCanal(entrada({ ...ins, videos: { lido: true, dados: [antigo] }, marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } }, series: { lido: true, dados: { series: new Map(), foraDoCanal: 0 } } }))
    expect(r.modelo.tipo).toBe('vazio')
    expect(r.ultimo).toEqual({ tipo: 'sem_contagem', motivo: 'antes_da_contagem' })
  })
  it('curvas sem normal: a legenda não tem "o normal do canal" e a frase diz o melhor n', () => {
    const e = entrada(longos(['v0', 'v1']))
    const { modelo } = lancamentosDoCanal(e)
    if (modelo.tipo !== 'curvas') throw new Error('curvas')
    expect(modelo.temNormal).toBe(false)
    expect(modelo.frase!.negrito).toBe('Ainda não há “normal” para comparar.')
    expect(modelo.frase!.resto).toMatch(/Cada ponto da linha pede 3 vídeos medidos na mesma idade; hoje o melhor ponto tem 2\./)
    const h = html(e)
    expect(h).not.toContain('>o normal do canal<')
    expect(h).toContain('<svg class="pc-svg"')
  })
  it('ponto com 2 vídeos: casa hachurada e sem ponto na linha; "1 vídeo" no singular', () => {
    const e = entrada(longos(['v0', 'v1', 'v2']))
    const { modelo } = lancamentosDoCanal(e)
    if (modelo.tipo !== 'curvas') throw new Error('curvas')
    const ponto = modelo.normal.find(p => p.n !== null && p.n < 3)
    expect(ponto).toBeDefined()
    expect(ponto!.valor).toBeNull()
    expect(modelo.temCasaSemPonto).toBe(true)
    const h = html(e)
    expect(h).toContain('menos de 3 vídeos: sem ponto')
    expect(h).toMatch(/<li class="nm"><span>dia \d+<\/span><b class="num">1 vídeo<\/b>/)
    expect(h).not.toContain('1 vídeos')
  })
  it('a legenda "menos de 3 vídeos" só existe quando há casa hachurada', () => {
    const h = html(entrada(insumosCheios()))
    expect(h).not.toContain('menos de 3 vídeos: sem ponto')
    expect(h).toContain('>o normal do canal<')
  })
  it('canal só de Shorts: Lançamentos de Shorts', () => {
    const e = entrada(so(v => v.isShort === true))
    expect(e.formato.soShorts).toBe(true)
    const { modelo } = lancamentosDoCanal(e)
    if (modelo.tipo !== 'curvas') throw new Error('curvas')
    expect(modelo.soShorts).toBe(true)
    expect(html(e)).toContain('Quantos Shorts entram em cada ponto da linha do normal')
  })
  it('canal ainda buscando vídeos: a oração do último vídeo diz que a primeira busca não terminou', () => {
    expect(lancamentosDoCanal(entrada(insumosCheios(), { primeiraBusca: true })).ultimo).toEqual({ tipo: 'canal_novo' })
  })
})

// ───────────── as 72 horas ─────────────
function leituras(pub: number, ate = 73): LeituraPorHora[] {
  const out: LeituraPorHora[] = []
  for (let h = 0; h <= ate; h++) out.push({ horaMs: pub + h * H, lidaEmMs: pub + h * H + 2 * 60_000, views: h * 10, likes: null, comments: null })
  return out
}
function horasDe(ids: string[], videos: readonly VideoLido[], extra: Partial<HorasLidas> = {}): HorasLidas {
  const porVideo = new Map<string, LeituraPorHora[]>()
  for (const v of videos) if (ids.includes(v.id)) porVideo.set(v.id, leituras(Date.parse(v.publishedAt as string)))
  return { porVideo, primeiraHoraDoSiteMs: AGORA_CHEIA - 120 * 24 * H, ultimoOkDaTarefaMs: AGORA_CHEIA - 30 * 60_000, primeiraExecucaoDaTarefaMs: AGORA_CHEIA - 120 * 24 * H, foraDoCanal: 0, ...extra }
}
const videosCheios = (): VideoLido[] => { const i = insumosCheios(); return i.videos.lido ? i.videos.dados : [] }

describe('as 72 horas do canal', () => {
  const vs = videosCheios()
  const fmt = formatoDoCanal(vs)
  const base = { videos: vs, formato: fmt, agoraMs: AGORA_CHEIA }
  it('4 vídeos com as 72 horas: metade em 37 horas, valor do meio de 4 vídeos', () => {
    const m = horasDoCanal({ ...base, horas: horasDe(['v0', 'v1', 'v2', 'v3'], vs) })
    expect(m.tipo).toBe('medido')
    if (m.tipo !== 'medido') return
    expect(m.frase.negrito).toBe('Metade das views das primeiras 72 horas chega em 37 horas')
    expect(m.frase.resto).toBe(' (valor do meio de 4 vídeos).')
    expect(renderToStaticMarkup(createElement(HorasDoCanal, { modelo: m }))).toContain('data-frase-das-72h')
  })
  it('leitura por hora não começou: não medido com a frase nova, sem data', () => {
    const m = horasDoCanal({ ...base, horas: horasDe([], vs, { primeiraHoraDoSiteMs: null }) })
    expect(m).toEqual({ tipo: 'nao_medido', motivo: 'A leitura por hora ainda não começou.' })
    expect(m.tipo === 'nao_medido' && /\d\d\/\d\d/.test(m.motivo)).toBe(false)
  })
  it('2 vídeos com as 72 horas: não medido com o n', () => {
    const m = horasDoCanal({ ...base, horas: horasDe(['v0', 'v1'], vs) })
    expect(m.tipo).toBe('nao_medido')
    expect(m.tipo === 'nao_medido' && m.motivo).toContain('(hoje 2)')
  })
  it('leitura por hora que não carregou: não carregou, nunca "nenhum vídeo"', () => {
    const m = horasDoCanal({ ...base, horas: null })
    expect(m.tipo).toBe('nao_carregou')
    expect(renderToStaticMarkup(createElement(HorasDoCanal, { modelo: m }))).toContain('Não carregou')
  })
  it('leitura por hora parada há mais de 70 minutos: a frase avisa desde quando', () => {
    const m = horasDoCanal({ ...base, horas: horasDe(['v0', 'v1', 'v2', 'v3'], vs, { ultimoOkDaTarefaMs: AGORA_CHEIA - 5 * H }) })
    expect(m.tipo === 'medido' && m.aviso).toMatch(/^a leitura por hora está parada desde \d\d\/\d\d \d\d:\d\d$/)
  })
})
