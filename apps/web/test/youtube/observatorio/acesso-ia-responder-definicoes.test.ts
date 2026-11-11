// @vitest-environment node
/**
 * A4 R4 T11: `definicoes` lista até 60 lugares com dados (≥ 3 vídeos), com a linha de "mais N lugares". `EMPACOTAR` e o leitor de lugares são dobrados:
 * o que se prova é o que o `responder` escreve com o que o leitor devolve.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>,
  lugares: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: m.lugares }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import type { PacoteModelo, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AGORA, modeloCheio } from './contexto-ia-fixture'

const TELAS: TelaId[] = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo', 'sugestoes']
const modelo = (tela: TelaId): PacoteModelo => ({ ...modeloCheio(), tela, definicoes: [{ medida: `Só de ${tela}`, frase: 'x', limiares: [] }] })

beforeEach(() => {
  m.lugares.mockReset()
  for (const t of TELAS) m.empacotar[t] = vi.fn(async () => null)
  for (const t of ['canais', 'comparar', 'outliers', 'insights', 'mudancas'] as const) {
    m.empacotar[t] = vi.fn(async () => ({ modelo: modelo(t), recente: '13/10/2026 09:10', estado: {} }))
  }
})

const lista = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `pais:P${String(i).padStart(3, '0')}`, n: 500 - i }))
const OK = { estado: 'ok', lugares: [] as Array<{ slug: string; n: number }>, totalDeVideos: 40, computadoEm: '2026-11-11T10:00:00Z', atrasado: false }
const pedir = () => responder({ acao: 'definicoes' }, ABRIDOR_DE_SESSAO, AGORA)

describe('definicoes: lugares com dados', () => {
  it('(pergunta 1) mostra o lugar de Hanói com a contagem', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: [{ slug: 'local:vn-hanoi', n: 41 }, { slug: 'pais:VN', n: 30 }] })
    const r = await pedir()
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('local:vn-hanoi')
    expect(r.texto).toMatch(/local:vn-hanoi[^\n]*41/)
    expect(r.texto).not.toContain('mais 0 lugares')
  })
  it('128 lugares: 60 linhas, ordem como veio (contagem desc, slug asc), e a última diz "mais 68 lugares"', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: lista(128) })
    const r = await pedir()
    const linhas = r.texto.split('\n').filter((l) => l.includes('pais:P'))
    expect(linhas).toHaveLength(60)
    expect(linhas[0]).toContain('pais:P000')
    expect(linhas[59]).toContain('pais:P059')
    expect(r.texto).not.toContain('pais:P060')
    expect(r.texto).toContain('mais 68 lugares com dados; pergunte pelo slug em `consultar`')
    expect(r.texto.indexOf('pais:P059')).toBeLessThan(r.texto.indexOf('mais 68 lugares'))
  })
  it('exatamente 60 lugares: sem linha de "mais"', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: lista(60) })
    const r = await pedir()
    expect(r.texto.split('\n').filter((l) => l.includes('pais:P'))).toHaveLength(60)
    expect(r.texto).not.toMatch(/mais \d+ lugares/)
  })
  const AUSENCIAS = {
    vazio: 'nenhum lugar com 3 vídeos ou mais entre os 40 vídeos calculados',
    nunca: 'lugares nunca calculados neste site',
    desligado: 'lugares não calculados: tarefa desligada',
  }
  it('calculado, mas nenhum lugar com 3+ vídeos: diz isso (não "nenhum lugar calculado")', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: [] })
    const t = (await pedir()).texto
    expect(t).toContain(AUSENCIAS.vazio)
    expect(t).not.toContain(AUSENCIAS.nunca); expect(t).not.toContain(AUSENCIAS.desligado); expect(t).not.toContain('nenhum lugar calculado')
  })
  it('cálculo sem nenhum vídeo marcado: "o cálculo não marcou nenhum vídeo de concorrente"', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: [], totalDeVideos: 0 })
    expect((await pedir()).texto).toContain('o cálculo não marcou nenhum vídeo de concorrente')
  })
  it('nunca calculado: a sua frase, sem as outras duas', async () => {
    m.lugares.mockResolvedValue({ estado: 'nunca' })
    const t = (await pedir()).texto
    expect(t).toContain(AUSENCIAS.nunca)
    expect(t).not.toContain(AUSENCIAS.desligado); expect(t).not.toContain('nenhum lugar com 3 vídeos')
  })
  it('tarefa desligada: a sua frase, sem as outras duas', async () => {
    m.lugares.mockResolvedValue({ estado: 'desligado' })
    const t = (await pedir()).texto
    expect(t).toContain(AUSENCIAS.desligado)
    expect(t).not.toContain(AUSENCIAS.nunca); expect(t).not.toContain('nenhum lugar com 3 vídeos')
  })
  it('Phil I-1: cálculo fresco leva a data do cálculo e nenhum aviso de atraso', async () => {
    m.lugares.mockResolvedValue({ ...OK, lugares: [{ slug: 'pais:VN', n: 5 }] })
    const t = (await pedir()).texto
    expect(t).toContain('calculados em 11/11 às 07:00, horário de Brasília')
    expect(t).not.toContain('desatualizados')
  })
  it('Phil I-1: cálculo atrasado diz "desatualizados desde 05/11" e ainda lista os lugares', async () => {
    m.lugares.mockResolvedValue({ ...OK, atrasado: true, computadoEm: '2026-11-05T13:00:00Z', lugares: [{ slug: 'pais:VN', n: 5 }] })
    const t = (await pedir()).texto
    expect(t).toContain('desatualizados desde 05/11')
    expect(t).toContain('- pais:VN: 5 vídeos')
  })
  it('leitura falhou: "lista de lugares não carregou", e o resto das definições segue', async () => {
    m.lugares.mockResolvedValue({ estado: 'falhou' })
    const r = await pedir()
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('lista de lugares não carregou')
    expect(r.texto).not.toContain('nenhum lugar calculado')
    for (const t of ['canais', 'comparar', 'outliers', 'insights', 'mudancas']) expect(r.texto).toContain(`Só de ${t}`)
  })
  it('o leitor lançar também é "não carregou" (nunca derruba a resposta)', async () => {
    m.lugares.mockRejectedValue(new Error('boom'))
    const r = await pedir()
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('lista de lugares não carregou')
  })
})
