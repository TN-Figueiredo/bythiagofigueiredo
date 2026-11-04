import { describe, it, expect } from 'vitest'
import { comMedicao, contarFrio, gravarAoFim, linhaDaMedicao, medirEtapa, novaMedicao, registrarIdadeServida } from '@/lib/youtube/observatorio/medicao-abertura'

const espera = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

describe('medição de uma abertura', () => {
  it('soma etapas e frios através de await, e a linha só leva nomes e números', async () => {
    const m = novaMedicao('canais')
    const r = await comMedicao(m, async () => {
      await espera(1)
      contarFrio('pacotes')
      await Promise.all([medirEtapa('pacotes', async () => { await espera(5); contarFrio('pacotes') }), medirEtapa('medidas', () => espera(5))])
      return await medirEtapa('pacotes', async () => 7)
    })
    expect(r).toBe(7)
    const l = JSON.parse(linhaDaMedicao(m))
    expect(Object.keys(l).sort()).toEqual(['etapas', 'evento', 'frios', 'idade_max_s', 'tela', 'total_ms'])
    expect([l.evento, l.tela, l.frios.pacotes]).toEqual(['obs-abertura', 'canais', 2])
    expect(l.etapas.pacotes).toBeGreaterThanOrEqual(3)
    expect(Number.isInteger(l.etapas.medidas)).toBe(true)
  })
  it('idade_max_s guarda a maior idade servida (s) e vale 0 sem entrada velha', async () => {
    const m = novaMedicao('canal')
    expect(JSON.parse(linhaDaMedicao(m)).idade_max_s).toBe(0)
    await comMedicao(m, async () => { registrarIdadeServida(7_200_000); registrarIdadeServida(60_000) })
    expect(JSON.parse(linhaDaMedicao(m)).idade_max_s).toBe(7200)
  })
  it('fora de uma medição nada é contado nem lança', async () => {
    const m = novaMedicao('canais')
    contarFrio('pacotes')
    await expect(medirEtapa('x', async () => 1)).resolves.toBe(1)
    expect(m.frios).toEqual({})
    expect(m.etapas).toEqual({})
  })
  it('a medição explícita vale fora de comMedicao (o chrome), e etapa que lança conta o tempo e deixa o erro passar', async () => {
    const m = novaMedicao('canais')
    await medirEtapa('chrome', async () => 1, m)
    await expect(medirEtapa('falha', async () => { throw new Error('banco') }, m)).rejects.toThrow('banco')
    expect(Object.keys(m.etapas).sort()).toEqual(['chrome', 'falha'])
  })
  it('fora de uma requisição gravarAoFim não lança', () => {
    expect(() => gravarAoFim(novaMedicao('canais'))).not.toThrow()
  })
  it('duas aberturas ao mesmo tempo não se misturam', async () => {
    const a = novaMedicao('canais'), b = novaMedicao('canais')
    await Promise.all([comMedicao(a, async () => { await espera(2); contarFrio('x') }), comMedicao(b, async () => { contarFrio('y'); await espera(1) })])
    expect([a.frios, b.frios]).toEqual([{ x: 1 }, { y: 1 }])
  })
})
