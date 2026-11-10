// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { secaoDeCobertura, coberturaCompleta, RODAPE_MAX, type Cobertura } from '@/lib/youtube/observatorio/acesso-ia/cobertura'

const NUM = { medidos: 100, zerosMedidos: 2, naoMedidos: 0, falhou: 0, restrito: 0, privadosMedidos: 0 }
const base = (o: Partial<Cobertura> = {}): Cobertura => ({
  lista: { titulo: 'Canais', de: 1, ate: 34, total: 34 },
  apoio: { inteiras: 5, total: 5, cortadas: [] },
  cortesDeTamanho: [], numeros: NUM, vazio: false, proximas: [], ...o,
})
const UUID = '123e4567-e89b-12d3-a456-426614174000'
const chamada = (n: number) => ({ chamada: { acao: 'canal', canal_id: UUID.replace('123', `12${n}`) }, para: 'aprofundar o canal número ' + n + ' com a série de 90 dias inteira' })

describe('secaoDeCobertura', () => {
  it('(a) 34 de 34 sem corte: frase completa e nenhuma linha de apoio cortado', () => {
    const t = secaoDeCobertura(base())
    expect(t).toContain('## Cobertura')
    expect(t).toContain('linhas 1–34 de 34')
    expect(t).toContain('Você viu tudo o que a tela mostra neste recorte.')
    expect(t).not.toContain('cortadas:')
    expect(coberturaCompleta(base())).toBe(true)
  })
  it('(b) 1–25 de 34: parcial', () => {
    const c = base({ lista: { titulo: 'Canais', de: 1, ate: 25, total: 34 } })
    expect(secaoDeCobertura(c)).toContain('Você viu só uma parte')
    expect(coberturaCompleta(c)).toBe(false)
  })
  it('(c) vazio: 0 de 0, frase do vazio, nunca completa', () => {
    const c = base({ vazio: true, lista: { titulo: 'Canais', de: 0, ate: 0, total: 0 } })
    const t = secaoDeCobertura(c)
    expect(t).toContain('0 de 0')
    expect(t).toContain('A lista está vazia neste recorte; vazio não é zero.')
    expect(t).not.toContain('Você viu tudo')
    expect(coberturaCompleta(c)).toBe(false)
  })
  it('(d) completa nas linhas mas com falhou: a linha de números e a frase final dizem', () => {
    const t = secaoDeCobertura(base({ numeros: { ...NUM, naoMedidos: 3, falhou: 3 } }))
    expect(t).toContain('3 sem medida (3 falharam, 0 restritos)')
    expect(t).toContain('mas 3 números estão sem medida; sem medida não é zero.')
  })
  it('(e) pior caso cabe em RODAPE_MAX e mantém a frase final e a chamada 1', () => {
    const titulo = 'T'.repeat(200)
    const c = base({
      lista: { titulo: 'L'.repeat(60), de: 1, ate: 25, total: 34, concorrentes: true },
      serie: { pontos: 400, total: 1000, de: '2025-01-01', ate: '2026-11-09', grao: 'semana' },
      apoio: { inteiras: 2, total: 5, cortadas: [1, 2, 3].map((i) => ({ titulo: titulo + i, saiu: 0, de: 411 })) },
      foraDoPacote: { mostrados: 123456, total: 234567 },
      cortesDeTamanho: Array.from({ length: 8 }, (_, i) => `rótulo de corte número ${i + 1} bem comprido`),
      numeros: { medidos: 123456, zerosMedidos: 123456, naoMedidos: 123456, falhou: 123456, restrito: 123456, privadosMedidos: 0 },
      marcaMudou: true, lidaAs: '14:05', proximas: [1, 2, 3].map(chamada),
    })
    const t = secaoDeCobertura(c)
    expect(t.length).toBeLessThanOrEqual(RODAPE_MAX)
    expect(t).toContain('Você viu só uma parte')
    expect(t).toContain(JSON.stringify(chamada(1).chamada))
    expect(t).toContain('A lista mudou desde a janela anterior')
    expect(t).toContain('Cortado por tamanho: rótulo de corte número 1 bem comprido; rótulo de corte número 2 bem comprido; rótulo de corte número 3 bem comprido, mais 5.')
  })
  it('(f) cinco próximas chamadas: saem 3', () => {
    const t = secaoDeCobertura(base({ proximas: [1, 2, 3, 4, 5].map(chamada) }))
    expect(t.split('\n').filter((l) => l.startsWith('- {"acao"'))).toHaveLength(3)
    expect(t).toContain('Próximas chamadas')
  })
  it('(g) grupo paginado pela tela: parcial, nunca completa', () => {
    const c = base({ foraDoPacote: { mostrados: 12, total: 40 } })
    const t = secaoDeCobertura(c)
    expect(t).toContain('A tela mostra 12 de 40 outliers')
    expect(t).toContain('Você viu só uma parte')
    expect(coberturaCompleta(c)).toBe(false)
  })
  it('(h) série parcial: parcial', () => {
    const c = base({ serie: { pontos: 400, total: 1000, de: '2025-01-01', ate: '2026-11-09', grao: 'dia' } })
    const t = secaoDeCobertura(c)
    expect(t).toContain('Série: 400 de 1000 pontos entre 01/01/2025 e 09/11/2026, grão dia.')
    expect(t).toContain('Você viu só uma parte')
  })
  it('(i) concorrentes: cita o canal próprio no dado privado', () => {
    expect(secaoDeCobertura(base({ lista: { titulo: 'Canais', de: 1, ate: 34, total: 34, concorrentes: true } }))).toContain('seu canal está na parte do dado privado')
  })
  it('apoio cortado e lacuna declarada; sem lista não há linha de lista', () => {
    const t = secaoDeCobertura({ ...base(), lista: undefined, apoio: { inteiras: 3, total: 5, cortadas: [{ titulo: 'Notas e dicas', saiu: 0, de: 411 }] } })
    expect(t).not.toContain('Lista principal')
    expect(t).toContain('Tabelas de apoio: 3 de 5 inteiras; cortadas: "Notas e dicas" (0 de 411 linhas).')
  })
})
