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
  it('A7b (l): linha de notas e dicas fora, sem dona e lista mudada; pior caso com a janela seguinte (marca) cabe em RODAPE_MAX', () => {
    const proxima = { chamada: { acao: 'destaques', janela: 'todas', formato: 'longos', nicho: 'tecnologia-e-ciencia-aplicada', a_partir_da_linha: 100_000, marca: '1a2b3c4d' }, para: 'ver a próxima janela da lista, da linha 100000 em diante' }
    const c = base({
      lista: { titulo: 'L'.repeat(60), de: 99_001, ate: 99_999, total: 100_000, concorrentes: true },
      apoio: { inteiras: 2, total: 5, cortadas: [1, 2, 3].map((i) => ({ titulo: 'T'.repeat(200) + i, saiu: 0, de: 411 })) },
      textoFora: { rotulo: 'Notas, títulos, imagens e descrições das trocas', linhas: 123456, comoVer: 'o detalhe aparece na tela Mudanças' },
      semDona: 123456, marcaMudou: true, lidaAs: '14:05', proximas: [proxima, chamada(1), chamada(2)],
      cortesDeTamanho: Array.from({ length: 8 }, (_, i) => `rótulo de corte número ${i + 1} bem comprido`),
      numeros: { medidos: 123456, zerosMedidos: 123456, naoMedidos: 123456, falhou: 123456, restrito: 123456, privadosMedidos: 0 },
    })
    const t = secaoDeCobertura(c)
    expect(t.length).toBeLessThanOrEqual(RODAPE_MAX)
    expect(t).toContain('A lista mudou desde a janela anterior')
    expect(t).toContain(JSON.stringify(proxima.chamada))
    expect(t).toContain('Você viu só uma parte')
  })
  it('A7b: texto fora da janela é informação (a lista pode ser completa); lista mudada nunca é completa; a linha traz o como ver', () => {
    const fora = { rotulo: 'Notas e dicas', linhas: 411, comoVer: 'para um canal, peça canal com o Id' }
    expect(coberturaCompleta(base({ textoFora: fora, semDona: 2 }))).toBe(true)
    expect(secaoDeCobertura(base({ textoFora: fora }))).toContain('- Notas e dicas: 0 de 411 linhas; para um canal, peça canal com o Id.')
    expect(coberturaCompleta(base({ marcaMudou: true }))).toBe(false)
    expect(secaoDeCobertura(base())).not.toContain('sem dona')
    expect(secaoDeCobertura(base({ semDona: 2, apoio: { inteiras: 1, total: 1, cortadas: [] } }))).toContain('2 linhas sem dona na lista vieram nesta janela')
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
  it('I1: pares sem dado: a linha própria, frase de parte e nunca completa', () => {
    const c = base({ naoEncontrados: { quantos: 1, de: 2 } })
    const t = secaoDeCobertura(c)
    expect(t).toContain('- Pares sem dado: 1 de 2 (canal não encontrado); a comparação não cobre esses canais.')
    expect(t).toContain('Você viu só uma parte')
    expect(coberturaCompleta(c)).toBe(false)
    expect(secaoDeCobertura(base({ naoEncontrados: { quantos: 0, de: 2 } }))).not.toContain('Pares sem dado')
    expect(coberturaCompleta(base({ naoEncontrados: { quantos: 0, de: 2 } }))).toBe(true)
  })
  it('I1: a linha de pares sem dado sobrevive ao corte do rodapé no pior caso', () => {
    const c = base({
      naoEncontrados: { quantos: 2, de: 5 },
      lista: { titulo: 'L'.repeat(200), de: 1, ate: 25, total: 34, concorrentes: true },
      serie: { pontos: 400, total: 1000, de: '2025-01-01', ate: '2026-11-09', grao: 'semana' },
      apoio: { inteiras: 2, total: 5, cortadas: [1, 2, 3].map((i) => ({ titulo: 'T'.repeat(200) + i, saiu: 0, de: 411 })) },
      foraDoPacote: { mostrados: 123456, total: 234567 },
      cortesDeTamanho: Array.from({ length: 8 }, (_, i) => `rótulo de corte número ${i + 1} bem comprido`),
      marcaMudou: true, lidaAs: '14:05', proximas: [1, 2, 3].map(chamada),
    })
    const t = secaoDeCobertura(c)
    expect(t.length).toBeLessThanOrEqual(RODAPE_MAX)
    expect(t).toContain('Pares sem dado: 2 de 5')
  })
  it('M3: números contados antes do corte do fim: a linha avisa', () => {
    expect(secaoDeCobertura(base({ numerosAntesDoCorte: true }))).toContain('(contados antes do corte do fim)')
    expect(secaoDeCobertura(base())).not.toContain('contados antes')
  })
  it('M6: três rótulos de corte de 700 caracteres: o rodapé nunca passa de RODAPE_MAX', () => {
    const c = base({ cortesDeTamanho: [1, 2, 3].map((i) => `${i}`.repeat(700)), proximas: [1, 2, 3].map(chamada) })
    const t = secaoDeCobertura(c)
    expect(t.length).toBeLessThanOrEqual(RODAPE_MAX)
    expect(t).toContain('Cortado por tamanho: mais 3.')
    expect(t).toContain('Você viu só uma parte')
  })
  it('M7: a frase de série que não veio é só da série; a da lista continua a mesma', () => {
    const t = secaoDeCobertura(base({ lista: undefined, vazio: true, serieAusente: true }))
    expect(t).toContain('A série não veio neste recorte; ausência não é zero.')
    expect(t).not.toContain('A lista está vazia')
    expect(secaoDeCobertura(base({ vazio: true }))).toContain('A lista está vazia neste recorte; vazio não é zero.')
  })
})

describe('A5 F1b: tabelas que só existem no modo texto', () => {
  const sem = ['tabela de avisos dos outliers', 'tabela de notas']
  it('a linha cita as tabelas, diz como ver e torna a lista incompleta', () => {
    const c = base({ soNoTexto: sem })
    expect(secaoDeCobertura(c)).toContain('- Só no modo texto (peça sem saida tabela): tabela de avisos dos outliers; tabela de notas.')
    expect(coberturaCompleta(c)).toBe(false)
    expect(coberturaCompleta(base({ soNoTexto: [] }))).toBe(true)
    expect(secaoDeCobertura(base({}))).not.toContain('Só no modo texto')
  })
  it('mais de 3 vira "mais N"', () => {
    expect(secaoDeCobertura(base({ soNoTexto: ['a', 'b', 'c', 'd', 'e'] }))).toContain('a; b; c, mais 2.')
  })
})
