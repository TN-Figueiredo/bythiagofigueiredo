// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

vi.mock('server-only', () => ({}))

import { linhaDoTempo, type EntradaDaLinhaDoTempo, type TrocaDoMotor } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/linha-do-tempo-model'
import { LinhaDoTempoBloco } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/linha-do-tempo'
import { formatoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/cabecalho-model'
import type { EstadoDaPagina } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/estado-model'
import { medidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { RetratoDoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import type { MudancaLida } from '@/lib/youtube/observatorio/medidas/ler'
import { somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { AGORA_CHEIA, HOJE_CHEIA, insumosCheios } from './medidas-fixture'

const F = { num: (v: number | null) => (v === null ? '—' : String(Math.round(v))) }
const ATIVO: EstadoDaPagina = { tipo: 'ativo', pastilha: 'ativo', base: '', ate: HOJE_CHEIA }

function retratos(n: number, fim = HOJE_CHEIA, passo = 1000, ini = 5_000_000): RetratoDoCanal[] {
  return Array.from({ length: n }, (_, k) => ({ dia: somaDias(fim, -(n - 1 - k)), views: ini + k * passo }))
}
function entrada(o: Partial<EntradaDaLinhaDoTempo> = {}): EntradaDaLinhaDoTempo {
  const ins = insumosCheios()
  const videos = ins.videos.lido ? ins.videos.dados : []
  return {
    F, medidas: medidasDoCanal(ins, { agoraMs: AGORA_CHEIA }), retratos: retratos(120), videos, mudancas: new Map(), trocas: [],
    titulos: new Map(videos.map(v => [v.id, `Título ${v.id}`])), estado: ATIVO, formato: formatoDoCanal(videos), foraEm: null, hojeSP: HOJE_CHEIA, ...o,
  }
}
const html = (e: EntradaDaLinhaDoTempo) => renderToStaticMarkup(createElement(LinhaDoTempoBloco, { modelo: linhaDoTempo(e) }))

describe('Linha do tempo', () => {
  it('nenhum retrato: diz que não há registro, sem barra e sem zero', () => {
    const m = linhaDoTempo(entrada({ retratos: [] }))
    expect(m.barras.tipo).toBe('sem_registro')
    const h = html(entrada({ retratos: [] }))
    expect(h).toContain('Ainda não há leitura')
    expect(h).not.toContain('gl-barra')
    expect(h).not.toContain('data-zero')
  })
  it('retratos não lidos: não carregou, e as raias ainda aparecem', () => {
    const m = linhaDoTempo(entrada({ retratos: null }))
    expect(m.barras.tipo).toBe('nao_carregou')
    expect(m.raias.videos.tipo).toBe('marcas')
    expect(m.frase.negrito).toMatch(/^Não carregou/)
  })
  it('mudanças não lidas: a raia diz não carregou e a frase não diz 0 mudanças de campo', () => {
    const m = linhaDoTempo(entrada({ mudancas: null }))
    expect(m.raias.campos.tipo).toBe('nao_carregou')
    expect(m.frase.resto).not.toMatch(/0 mudanças de campo/)
    expect(m.frase.resto).toContain('Mudanças de campo: não carregou.')
  })
  it('trinta dias sem retrato viram um retângulo só', () => {
    const r = retratos(120).filter((_, k) => k < 40 || k >= 70)
    const m = linhaDoTempo(entrada({ retratos: r }))
    if (m.barras.tipo !== 'dias') throw new Error('dias')
    const t = m.barras.trechos.filter(x => x.tipo === 'sem_registro')
    expect(t).toHaveLength(1)
    expect(t[0]!.ate - t[0]!.de + 1).toBeGreaterThanOrEqual(30)
    expect(html(entrada({ retratos: r })).match(/data-trecho="sem_registro"/g)).toHaveLength(1)
  })
  it('registro de campo começando dentro da janela: não medido antes de dd/mm', () => {
    const e = entrada({ retratos: retratos(120), mudancas: new Map(), trocas: [] })
    const m = linhaDoTempo(e)
    expect(m.frase.resto).toMatch(/não medido antes de 03\/10|pelo menos/)
  })
  it('dois dias de registro: a frase diz 2 dias e a data em que a janela completa', () => {
    const m = linhaDoTempo(entrada({ retratos: retratos(3), medidas: null }))
    expect(m.frase.negrito).toMatch(/em 2 dias de registro/)
    expect(m.frase.resto).toContain(`completa em ${somaDias(HOJE_CHEIA, 26).slice(8)}/${somaDias(HOJE_CHEIA, 26).slice(5, 7)}`)
  })
  it('sem buraco nem queda, a soma das barras de 28 dias é m3a.ganhoRecente', () => {
    const ins = insumosCheios()
    const e = entrada({ retratos: ins.retratos.lido ? ins.retratos.dados : null })
    const m = linhaDoTempo(e)
    if (m.barras.tipo !== 'dias' || !e.medidas || e.medidas.m3a.estado !== 'medido') throw new Error('x')
    const soma = m.barras.dias.slice(-28).reduce((t, d) => t + (d.ganho ?? 0), 0)
    expect(soma).toBe(e.medidas.m3a.valor.ganhoRecente)
  })
  it('retrato faltando ou queda: a frase usa os ganhos do m3a e diz quantos dias as barras não mostram', () => {
    const r = retratos(120)
    r.splice(110, 1)
    r[118] = { dia: r[118]!.dia, views: 100 }
    const m = linhaDoTempo(entrada({ retratos: r }))
    if (m.barras.tipo !== 'dias') throw new Error('x')
    expect(m.barras.nota).toMatch(/dia sem registro|dia em que o total diminuiu/)
    expect(m.frase.resto).toContain('não nas barras')
  })
  it('dia de zero é caixa vazada com "zero medido"', () => {
    const r = retratos(120).map((x, k) => (k >= 100 ? { ...x, views: 5_000_000 + 100 * 1000 } : x))
    const m = linhaDoTempo(entrada({ retratos: r }))
    if (m.barras.tipo !== 'dias') throw new Error('x')
    expect(m.barras.dias.some(d => d.situacao === 'zero')).toBe(true)
    const h = html(entrada({ retratos: r }))
    expect(h).toContain('data-zero')
    expect(h).toContain('zero medido')
  })
  it('a linha de 24/08 aparece só enquanto cabe na janela', () => {
    const dentro = linhaDoTempo(entrada({ retratos: retratos(90, '2026-09-30'), hojeSP: '2026-09-30' }))
    const fora = linhaDoTempo(entrada({ retratos: retratos(90, '2027-01-15'), hojeSP: '2027-01-15' }))
    if (dentro.barras.tipo !== 'dias' || fora.barras.tipo !== 'dias') throw new Error('x')
    expect(dentro.barras.corte).not.toBeNull()
    expect(fora.barras.corte).toBeNull()
  })
  it('canal que saiu: nada depois da data, "sem registro" e pontilhado', () => {
    const fora = somaDias(HOJE_CHEIA, -10)
    const e = entrada({ retratos: retratos(110, fora), estado: { ...ATIVO, tipo: 'saiu', ate: fora }, foraEm: fora })
    const m = linhaDoTempo(e)
    if (m.barras.tipo !== 'dias') throw new Error('x')
    const depois = m.barras.dias.filter(d => d.dia > fora)
    expect(depois.length).toBeGreaterThan(0)
    expect(depois.every(d => d.situacao === 'fora' && d.ganho === null)).toBe(true)
    expect(html(e)).toContain('gl-pontilhado')
  })
  it('duas trocas do mesmo vídeo trazem a ordem; uma só, não', () => {
    const t = (videoId: string, campo: 'titulo' | 'miniatura', d: number): TrocaDoMotor => ({ videoId, campo, emMs: Date.parse(`${somaDias(HOJE_CHEIA, -d)}T15:00:00Z`) })
    const m = linhaDoTempo(entrada({ trocas: [t('v1', 'titulo', 5), t('v1', 'miniatura', 3), t('v2', 'titulo', 2)] }))
    const marcas = m.raias.trocas.tipo === 'marcas' ? m.raias.trocas.marcas : []
    expect(marcas.map(x => x.texto)).toEqual(expect.arrayContaining([expect.stringContaining('(troca 1)'), expect.stringContaining('(troca 2)')]))
    expect(marcas.filter(x => x.texto.includes('Título v2'))[0]!.texto).not.toContain('(troca')
  })
  it('publicação anterior ao registro do canal vai para "Antes de o canal entrar na lista"', () => {
    const m = linhaDoTempo(entrada({ retratos: retratos(120).slice(100) }))
    expect(m.frase.resto).toMatch(/Antes de o canal entrar na lista|publicações/)
  })
  it('mudança de campo entra com o dia e o campo', () => {
    const mud: MudancaLida = { campo: 'descricao', em: Date.parse(`${somaDias(HOJE_CHEIA, -4)}T15:00:00Z`) } as MudancaLida
    const m = linhaDoTempo(entrada({ mudancas: new Map([['v1', [mud]]]) }))
    const marcas = m.raias.campos.tipo === 'marcas' ? m.raias.campos.marcas : []
    expect(marcas).toHaveLength(1)
    expect(marcas[0]!.texto).toContain('a descrição')
  })
  it('a leitura do dia segue a tabela da NOTAS (dia, views, publicou)', () => {
    const m = linhaDoTempo(entrada())
    if (m.barras.tipo !== 'dias') throw new Error('x')
    expect(m.barras.dias.some(d => /^(dom|seg|ter|qua|qui|sex|sáb) \d\d\/\d\d: \d+ views ganhas/.test(d.fala))).toBe(true)
    expect(m.barras.dias.some(d => d.fala.includes('Publicou'))).toBe(true)
    expect(m.tabela[0]).toHaveLength(4)
  })
})
