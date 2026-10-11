// @vitest-environment node
// A3 Tarefa 9: o Histórico do vídeo aberto a partir da comparação entre dois canais (`from=comparar&back=?a=…&b=…`): a trilha diz
// "Comparar canais" e o caminho de volta é a comparação com o MESMO par.
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView, parseFrom, historicoTrail } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const { obs } = a3World()
const rival = obs.channels.find(c => !c.own)!
const meu = obs.channels.find(c => c.own)!
const videoDe = (ch: string) => obs.videos.find(v => v.ch === ch)!
const hv = (id: string, p: Record<string, string | undefined> = {}) => buildHistoricoView(obs, id, p)
const BACK = '?a=eu&b=outro'
const COMPARAR = '/cms/youtube/competitors/comparar'

describe('Histórico: origem "comparar"', () => {
  it('parseFrom reconhece comparar; o resto continua como era (valor desconhecido cai em Mudanças)', () => {
    expect(parseFrom('comparar')).toBe('comparar')
    expect(parseFrom('canais')).toBe('canais')
    expect(parseFrom('lixo')).toBe('mudancas')
    expect(parseFrom(undefined)).toBe('mudancas')
  })
  it('o link do Histórico aceita from=comparar e leva o back da comparação (que começa com ?)', () => {
    const h = link.historico('abc', { from: 'comparar', back: BACK })
    expect(h).toBe('/cms/youtube/competitors/video/abc?from=comparar&back=%3Fa%3Deu%26b%3Doutro')
    expect(new URL(h, 'http://x').searchParams.get('back')).toBe(BACK)
    // back sem "?" é descartado
    expect(link.historico('abc', { from: 'comparar', back: 'a=eu&b=outro' })).toBe('/cms/youtube/competitors/video/abc?from=comparar')
  })
  it('vídeo de concorrente: trilha "Comparar canais › <canal> › Histórico do vídeo", voltando à comparação com o mesmo par', () => {
    const v = hv(videoDe(rival.id).id, { from: 'comparar', back: BACK })
    expect(v.state).not.toBe('not-found')
    expect(v.crumbs.from).toBe('comparar')
    expect(v.crumbs.crumb).toBe('Comparar canais')
    expect(v.crumbs.href).toBe(COMPARAR + BACK)
    expect(v.crumbs.sub).toEqual({ text: rival.name, href: link.canal(rival.id) })
    expect(v.crumbs.canal).toBeNull()
    expect(historicoTrail(v.crumbs).map(t => t.text)).toEqual(['Comparar canais', rival.name, 'Histórico do vídeo'])
    // sem lista de origem: o pager diz de onde veio e não anda
    expect(v.pager).toMatchObject({ prev: null, next: null, backHref: COMPARAR + BACK, position: 'aberto a partir de Comparar canais', status: '' })
  })
  it('vídeo do canal próprio: a mesma trilha, sem o item do canal (ele não tem página)', () => {
    const v = hv(videoDe(meu.id).id, { from: 'comparar', back: BACK })
    expect(v.crumbs.crumb).toBe('Comparar canais')
    expect(v.crumbs.href).toBe(COMPARAR + BACK)
    expect(v.crumbs.sub).toBeNull()
  })
  it('sem back (ou back sem "?"): volta à comparação sem par, que escolhe o padrão', () => {
    expect(hv(videoDe(rival.id).id, { from: 'comparar' }).crumbs.href).toBe(COMPARAR)
    expect(hv(videoDe(rival.id).id, { from: 'comparar', back: 'a=eu' }).crumbs.href).toBe(COMPARAR)
  })
  it('vídeo que não existe: o estado "não encontrado" também volta à comparação com o par', () => {
    const v = hv('nao-existe', { from: 'comparar', back: BACK })
    expect(v.state).toBe('not-found')
    expect(v.crumbs.crumb).toBe('Comparar canais')
    expect(v.crumbs.href).toBe(COMPARAR + BACK)
    expect(v.notFound!.href).toBe(COMPARAR + BACK)
    expect(v.notFound!.back).toBe('Voltar para Comparar canais')
  })
  it('as outras origens não mudaram', () => {
    const id = videoDe(rival.id).id
    expect(hv(id, { from: 'insights' }).crumbs.crumb).toBe('Insights')
    expect(hv(id, { from: 'canais', canal: rival.id }).crumbs.crumb).toBe('Canais')
    expect(hv(id, { from: 'outliers' }).crumbs.crumb).toBe('Outliers')
    expect(hv(id, {}).crumbs.crumb).toBe('Mudanças')
  })
})
