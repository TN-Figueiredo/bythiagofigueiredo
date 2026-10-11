import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { link } from '@/lib/youtube/observatorio/links'

describe('buildCanalView', () => {
  it('id que não é canal deste conjunto: null (a página mostra "Canal não encontrado")', () => {
    const { obs } = canalWorld()
    expect(buildCanalView(obs, 'nao-existe', {})).toBeNull()
  })
  it('junta cabeçalho, vídeos, trocas e estado da URL', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalView(obs, chId, { nums: '1', fmt: 'shorts' })!
    expect(v.header.id).toBe(chId)
    expect(v.videos.videos.length).toBeGreaterThan(0)
    expect(v.state.nums).toBe(true)
    expect(v.state.fmt).toBe('shorts')
    expect(v.trocas.total).toBe(obs.changesIn({ days: 30, channel: chId }).filter(c => c.type !== 'desc').length)
    expect(v.trocas.tabCount).toBe(`${v.trocas.total} em 30 d`)
    expect(v.own).toBe(false)
  })
  it('canal próprio: own true (a página redireciona para o painel de Canais até a A4)', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.channels.find(c => c.id === id)!.own = true })
    expect(buildCanalView(obs, chId, {})!.own).toBe(true)
  })
  it('trilha: sem origem, o primeiro item é Canais', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalView(obs, chId, {})!
    expect(v.canaisHref).toBe(link.canais())
    expect(v.origemText).toBe('Canais')
  })
  it('trilha: de Outliers ou Mudanças, o primeiro item é a tela de origem, com o back', () => {
    const { obs, chId } = canalWorld()
    const o = buildCanalView(obs, chId, { from: 'outliers', back: '?min=3&fmt=long' })!
    expect(o.origemText).toBe('Outliers')
    expect(o.canaisHref).toBe(link.outliers() + '?min=3&fmt=long')
    const m = buildCanalView(obs, chId, { from: 'mudancas', back: '?win=30' })!
    expect(m.origemText).toBe('Mudanças')
    expect(m.canaisHref).toBe(link.mudancas() + '?win=30')
  })
  it('origem: as abas levam from e back junto; de Canais não levam nada', () => {
    const { obs, chId } = canalWorld()
    expect(buildCanalView(obs, chId, {})!.origem).toEqual({})
    expect(buildCanalView(obs, chId, { from: 'outliers', back: '?min=3' })!.origem).toEqual({ from: 'outliers', back: '?min=3' })
    expect(buildCanalView(obs, chId, { from: 'mudancas', back: 'https://x' })!.origem).toEqual({ from: 'mudancas', back: '' })
    expect(buildCanalView(obs, chId, { from: 'video', back: '?a=1' })!.origem).toEqual({})
  })
  it('trilha: de Outliers sem back volta à tela sem filtro; back que não começa por ? é ignorado; outra origem cai em Canais', () => {
    const { obs, chId } = canalWorld()
    expect(buildCanalView(obs, chId, { from: 'outliers' })!.canaisHref).toBe(link.outliers())
    expect(buildCanalView(obs, chId, { from: 'outliers', back: 'https://evil.example/' })!.canaisHref).toBe(link.outliers())
    const v = buildCanalView(obs, chId, { from: 'video', back: '?x=1' })!
    expect(v.origemText).toBe('Canais')
    expect(v.canaisHref).toBe(link.canais())
    expect(buildCanalView(obs, chId, { from: 'qualquer' })!.canaisHref).toBe(link.canais())
  })
})
