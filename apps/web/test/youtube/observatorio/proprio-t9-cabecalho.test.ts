// @vitest-environment node
// A4 Tarefa 9 (revisão da T8): M1, o item da linha de posição SEM posição não é link (o clique levaria a uma lista ordenada onde este canal está sem
// valor); M6, `muitosProprios` é obrigatório no cabeçalho (o fallback `obs.ownChannels()` lança no conjunto de UM canal, que é o da página).
import { afterEach, describe, it, expect, vi } from 'vitest'
import { proprioWorld, umCanal } from './proprio-fixture'
import { buildProprioHeader, type PosicaoNoNicho } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { link } from '@/lib/youtube/observatorio/links'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))
const BASE = proprioWorld()
const O = { hoje: BASE.hoje, dm: BASE.dm, muitosProprios: true }
const item = (p: PosicaoNoNicho, chave: string, w = BASE) => buildProprioHeader(w.obs, w.canalId, w.dados, { ...O, posicao: p })!.posicaoItens!.itens.find(i => i.chave === chave)!

describe('M1 · o item sem posição não é link', () => {
  const sem: PosicaoNoNicho = { conjunto: { tipo: 'geral' }, inscritos: null, medianaViews: null, longos90: null, vpdPorMil: null }
  it('sem posição em inscritos e sem posição em views/dia por mil: href null nos quatro itens, e o texto diz o motivo', () => {
    const x = buildProprioHeader(BASE.obs, BASE.canalId, BASE.dados, { ...O, posicao: sem })!.posicaoItens!
    expect(x.itens.map(i => i.href)).toEqual([null, null, null, null])
    expect(x.itens[0]!.texto).toMatch(/^sem posição em inscritos/)
    expect(x.itens[3]!.texto.startsWith('Views/dia por mil inscritos: ')).toBe(true)
  })
  it('inscritos ocultos pelo canal: o item diz isso e não linka', () => {
    const w = proprioWorld({ mut: ds => { ds.channels.find(c => c.own)!.subs = null } })
    const i = item(sem, 'inscritos', w)
    expect(i.texto).toContain('(ocultos pelo canal)')
    expect(i.href).toBeNull()
  })
  it('cada item liga SÓ quando tem posição: inscritos com posição e vpd sem, e o contrário', () => {
    const real = posicaoDoSite(BASE.obs, BASE.canalId).posicao!
    expect(real.inscritos).not.toBeNull()
    const soInscritos: PosicaoNoNicho = { ...real, vpdPorMil: null }
    expect(item(soInscritos, 'inscritos').href).toMatch(/sort=subs/)
    expect(item(soInscritos, 'vpdPorMil').href).toBeNull()
    const soVpd: PosicaoNoNicho = { ...real, inscritos: null, vpdPorMil: { pos: 3, de: 9, empate: false } as NonNullable<PosicaoNoNicho['vpdPorMil']> }
    expect(item(soVpd, 'inscritos').href).toBeNull()
    expect(item(soVpd, 'vpdPorMil').href).toBe(link.canais({ niche: 'todos', sort: 'vpd', ...(real.conjunto.tipo === 'nicho' ? { niche: real.conjunto.niche as never } : {}) }))
  })
})

describe('M6 · muitosProprios é obrigatório: o cabeçalho não pergunta ao conjunto', () => {
  it('com o conjunto de UM canal (ownChannels lança) e muitosProprios informado, o cabeçalho monta e não chama ownChannels', () => {
    const w = proprioWorld({ mut: umCanal })
    expect(() => w.obs.ownChannels()).toThrow()
    const spy = vi.spyOn(w.obs, 'ownChannels')
    const h = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null, muitosProprios: false })
    expect(h).not.toBeNull()
    expect(h!.lang).toBeNull() // um canal só: sem selo de idioma
    expect(spy).not.toHaveBeenCalled()
  })
  it('muitosProprios decide o selo de idioma, sem consultar o motor', () => {
    const w = proprioWorld()
    const spy = vi.spyOn(w.obs, 'ownChannels')
    const com = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null, muitosProprios: true })!
    const sem = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null, muitosProprios: false })!
    expect(com.lang).not.toBeNull()
    expect(sem.lang).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})
