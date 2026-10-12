// @vitest-environment jsdom
// A3 Tarefa 10 (D18): o gatilho de "Comparar" lembrado na sessão, para o Voltar devolver o foco a ele. Conforto, nunca requisito:
// sem armazenamento (ou com ele lançando) a tela volta como hoje.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { lembrarGatilho, lerGatilho, descartarGatilhoSeNaoVoltou } from '@/app/cms/(authed)/youtube/competitors/_chrome/gatilho-volta'

const CHAVE = 'obs:gatilho-comparar'
beforeEach(() => { window.sessionStorage.clear(); window.history.replaceState(null, '', '/cms/youtube/competitors?fmt=longos') })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('lembrarGatilho / lerGatilho', () => {
  it('lê o canal lembrado para o lugar e apaga: o próximo Voltar não repete o foco', () => {
    lembrarGatilho('canais', 'ch-1')
    expect(lerGatilho('canais')).toBe('ch-1')
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
  })
  it('o registro é de UM lugar: ler outro lugar devolve null e não apaga o registro de quem ainda vai ler', () => {
    lembrarGatilho('canal', 'ch-2')
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).not.toBeNull()
    expect(lerGatilho('canal')).toBe('ch-2')
  })
  it('o último gatilho vale: lembrar de novo troca o registro', () => {
    lembrarGatilho('canais', 'ch-1'); lembrarGatilho('canais', 'ch-3')
    expect(lerGatilho('canais')).toBe('ch-3')
  })
  it('expira (30 min): um registro que ninguém consumiu não pode fazer um Voltar muito depois pular o foco', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    lembrarGatilho('canais', 'ch-1')
    vi.setSystemTime(new Date('2026-10-11T12:31:00Z'))
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull() // o velho é apagado
  })
  it('registro estragado (JSON ruim, formato antigo, carimbo do futuro) é ignorado e apagado', () => {
    for (const raw of ['{não é json', '"texto"', JSON.stringify({ lugar: 'canais', canalId: 7, t: Date.now() }), JSON.stringify({ lugar: 'canais', canalId: '', t: Date.now() }), JSON.stringify({ lugar: 'canais', canalId: 'x', t: Date.now() + 10 * 3600_000 })]) {
      window.sessionStorage.setItem(CHAVE, raw)
      expect(lerGatilho('canais')).toBeNull()
      expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
    }
  })
  it('sem registro: null', () => { expect(lerGatilho('canais')).toBeNull() })
  it('armazenamento que lança (modo privado, bloqueado): nada lança e a leitura é null', () => {
    const quebra = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
    vi.stubGlobal('sessionStorage', quebra)
    expect(() => lembrarGatilho('canais', 'ch-1')).not.toThrow()
    expect(lerGatilho('canais')).toBeNull()
  })
})

describe('I-1: o registro não vaza para um Voltar que não é o dele', () => {
  const irPara = (url: string) => window.history.replaceState(null, '', url)
  it('o registro leva a URL da tela de origem e só vale se a tela que volta É essa URL', () => {
    irPara('/cms/youtube/competitors?fmt=longos&sort=subs')
    lembrarGatilho('canais', 'leo')
    expect(JSON.parse(window.sessionStorage.getItem(CHAVE)!).origem).toBe('/cms/youtube/competitors?fmt=longos&sort=subs')
    expect(lerGatilho('canais')).toBe('leo') // a mesma URL: vale
  })
  it('vazamento 1: saiu da comparação por OUTRO caminho (trilha) e um Voltar posterior chega à lista em outra URL: o registro é descartado e o foco não vai ao "Comparar" errado', () => {
    irPara('/cms/youtube/competitors?fmt=longos')
    lembrarGatilho('canais', 'leo') // clicou "Comparar" de Leo Khev
    irPara('/cms/youtube/competitors?fmt=longos&sort=vpd') // voltou à lista pela trilha, ordenou, abriu outro canal, e o Voltar chega aqui
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE), 'o registro velho não fica para um terceiro Voltar').toBeNull()
  })
  it('vazamento 2: na página do canal, o registro de uma saída antiga não é lido na mesma página aberta de novo sem Voltar', () => {
    const base = Date.now() + 24 * 3600_000 // bem depois de qualquer popstate de um teste anterior
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(base)
    irPara('/cms/youtube/competitors/canal/x')
    lembrarGatilho('canal', 'x')
    vi.setSystemTime(base + 5 * 60_000) // minutos depois, nenhum Voltar entre uma coisa e outra
    descartarGatilhoSeNaoVoltou('canal') // a montagem nova da página não veio de um Voltar
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
    expect(lerGatilho('canal')).toBeNull()
  })
  it('a montagem logo depois de um Voltar (popstate há pouco) NÃO descarta: o registro é o dele', () => {
    lembrarGatilho('canais', 'leo')
    window.dispatchEvent(new PopStateEvent('popstate'))
    descartarGatilhoSeNaoVoltou('canais')
    expect(lerGatilho('canais')).toBe('leo')
  })
  it('descartar só mexe no registro do PRÓPRIO lugar; o de outro lugar fica para quem vai ler', () => {
    const base = Date.now() + 48 * 3600_000
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(base)
    lembrarGatilho('canal', 'x')
    vi.setSystemTime(base + 60_000)
    descartarGatilhoSeNaoVoltou('canais')
    expect(window.sessionStorage.getItem(CHAVE)).not.toBeNull()
    descartarGatilhoSeNaoVoltou('canal')
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
  })
  it('registro sem origem (formato anterior) é ignorado e apagado', () => {
    window.sessionStorage.setItem(CHAVE, JSON.stringify({ lugar: 'canais', canalId: 'x', t: Date.now() }))
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
  })
  it('descartar com armazenamento que lança não lança', () => {
    const quebra = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
    vi.stubGlobal('sessionStorage', quebra)
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 72 * 3600_000)
    expect(() => descartarGatilhoSeNaoVoltou('canais')).not.toThrow()
  })
})
