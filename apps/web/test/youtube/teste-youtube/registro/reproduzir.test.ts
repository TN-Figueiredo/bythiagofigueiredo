// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/youtube/teste-youtube/detectar', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/youtube/teste-youtube/detectar')>()
  return { ...real, detectarTesteYoutube: vi.fn(real.detectarTesteYoutube) }
})

import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { rodadasDeTitulo } from '@/lib/youtube/teste-youtube/rodadas'
import { avaliarVideo } from '@/lib/youtube/teste-youtube/registro/registrar'
import { reproduzirPassado } from '@/lib/youtube/teste-youtube/registro/reproduzir'
import type { LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9, TITULO_A, TITULO_B } from '../../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura, rodadas } from '../sintetico'

const H = 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString()
const textos = { A: 'Titulo A', B: 'Titulo B' }
const idsDeterministicos = (): (() => string) => { let n = 0; return () => `rep-${++n}` }
const ultima = (ls: readonly LeituraWatch[]): number => Math.max(...ls.map(l => Date.parse(l.lidaEm)))

describe('reproduzirPassado', () => {
  const { leituras } = carregarQIg9()
  const agora = iso(ultima(leituras) + H)

  it('qIg9 reproduzido: 20 avaliações retroativas + 1 real; 1 registro detectado aberto igual ao do registrador', () => {
    const r = reproduzirPassado(leituras, [], agora, idsDeterministicos())
    expect(r.avaliacoes).toHaveLength(21)
    expect(r.avaliacoes.filter(a => a.retroativa)).toHaveLength(20)
    expect(r.avaliacoes.at(-1)!.retroativa).toBe(false)
    expect(r.registros).toHaveLength(1)
    const reg = r.registros[0]!
    expect(reg.fim).toBeNull()
    const direto = avaliarVideo({ leituras, escritas: [], aberto: null, fechamentos: { encerradoEm: null, descartadoEm: null }, agora, novoId: () => 'x', retroativa: false })
    if (direto.acao.tipo !== 'criar') throw new Error('x')
    expect(reg.variantesTitulo).toEqual(direto.acao.novo.variantesTitulo)
    expect(reg.votosTitulo).toEqual({ [TITULO_A]: 29, [TITULO_B]: 31 })
    expect(reg.primeiraVista).toBe(direto.acao.novo.primeiraVista)
    expect(r.avaliacoes.every(a => a.registroId === null || a.registroId === reg.id)).toBe(true)
  })

  it('teste que começou e acabou no passado: 1 registro encerrado, vencedor B, e a avaliação real não cria outro', () => {
    const inicio = Date.parse('2026-10-01T00:00:00Z')
    const mistura = rodadas({ inicio: iso(inicio), intervaloMs: 4 * H, padroes: Array.from({ length: 18 }, () => 'AAB'), textos })
    const fim = ultima(mistura)
    const soB = Array.from({ length: 20 }, (_, i) => leitura({ em: iso(fim + 2 * H + i * 90 * 60_000), rodada: `b${i}`, titulo: textos.B, oficial: textos.B }))
    const todas = [...mistura, ...soB]
    const r = reproduzirPassado(todas, [], iso(ultima(soB) + H), idsDeterministicos())
    expect(r.registros).toHaveLength(1)
    expect(r.registros[0]!.fim?.estado).toBe('encerrado')
    expect(r.registros[0]!.fim?.vencedorTitulo).toBe(textos.B)
    expect(r.avaliacoes.at(-1)!.retroativa).toBe(false)
  })

  it('pureza: duas chamadas com o mesmo novoId determinístico dão o mesmo resultado', () => {
    const a = reproduzirPassado(leituras, [], agora, idsDeterministicos())
    const b = reproduzirPassado(leituras, [], agora, idsDeterministicos())
    expect(b).toEqual(a)
  })

  it('inicial (P10): com o registro já fechado vindo do banco não recria nada', () => {
    const T = ultima(leituras)
    const r = reproduzirPassado(leituras, [], agora, idsDeterministicos(), { aberto: null, fechamentos: { encerradoEm: iso(T), descartadoEm: null } })
    expect(r.registros).toHaveLength(0)
    expect(r.avaliacoes.length).toBeGreaterThan(0)
  })

  it('custo (P3): o número de chamadas à regra cresce linear em R (no máximo 3 por avaliação)', () => {
    const espiao = vi.mocked(detectarTesteYoutube)
    espiao.mockClear()
    const R = rodadasDeTitulo(leituras).length
    reproduzirPassado(leituras, [], agora, idsDeterministicos())
    expect(R).toBe(20)
    expect(espiao.mock.calls.length).toBeGreaterThanOrEqual(R + 1)
    expect(espiao.mock.calls.length).toBeLessThanOrEqual(3 * (R + 1))
  })

  it('sem leituras: uma única avaliação real, sem registro', () => {
    const r = reproduzirPassado([], [], '2026-10-18T12:00:00.000Z', idsDeterministicos())
    expect(r.avaliacoes).toHaveLength(1)
    expect(r.avaliacoes[0]!.estado14).toBe('sem_leitura')
    expect(r.registros).toHaveLength(0)
  })
})
