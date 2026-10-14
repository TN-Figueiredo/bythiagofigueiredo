// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 4: a montagem do texto final (partes 1 a 9) e o corte por tamanho (30.000 na cópia, 200.000 no arquivo).
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { segmentar, type PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { medidaConfere, medir, montarTexto, resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { milhar } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import {
  CONTEXTO, SENTINELA, modeloCheio, modeloComComentarios, modeloComZero, modeloEstresse, modeloEstresseMudancas, modeloEstresseVideo, modeloMagro,
  modeloPrivadoExcluido, modeloPrivadoIncluido, modeloVazio, medido, rotulo, terceiros,
} from './contexto-ia-fixture'

const contagem = vi.hoisted(() => ({ noJson: 0 }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/terceiros', async (original) => {
  const m = await original<typeof import('@/lib/youtube/observatorio/contexto-ia/terceiros')>()
  return { ...m, noJson: (v: unknown) => { contagem.noJson += 1; return m.noJson(v) } }
})

const WEB = resolve(__dirname, '../../..')
const MOCKUP = resolve(WEB, '../../docs/superpowers/mockups/2026-10-13-a5-lote-2/22-perguntar-a-uma-ia')
const MONTAR_TS = join(WEB, 'src/lib/youtube/observatorio/contexto-ia/montar-texto.ts')

const pac = (m: PacoteModelo): PacoteSerializado => segmentar(m, CONTEXTO)
const L30 = 30_000
const L200 = 200_000
const PERGUNTAS = ['', 'u', 'p'.repeat(500), 'q'.repeat(1_000)]

/** Põe nas definições um enchimento que leva o texto inteiro a `alvo` caracteres (a linha "Por tamanho" também conta). */
function comTamanho(m: PacoteModelo, alvo: number, pergunta = ''): PacoteModelo {
  let enchimento = 0
  for (let i = 0; i < 8; i += 1) {
    const modelo = { ...m, definicoes: [...m.definicoes, { medida: 'Enchimento', frase: 'e'.repeat(enchimento), limiares: [] }] }
    const total = montarTexto(pac(modelo), pergunta, L30, 'todos').totalSemCorte
    if (total === alvo) return modelo
    enchimento = Math.max(0, enchimento + (alvo - total))
  }
  throw new Error(`não achei o enchimento para ${alvo}`)
}

const lerJson = (texto: string): { tela: string; formato: number; medidas: Array<{ tabela: string; valores: Record<string, unknown> }> } => {
  const a = texto.indexOf('## 8. Bloco estruturado\n') + '## 8. Bloco estruturado\n'.length
  const b = texto.indexOf('\n## 9. Minha pergunta')
  return JSON.parse(texto.slice(a, b))
}

const FIXTURES: Array<[string, () => PacoteModelo]> = [
  ['cheio', modeloCheio], ['magro', () => modeloMagro(12)], ['vazio', modeloVazio], ['zero', modeloComZero], ['privado incluído', modeloPrivadoIncluido],
  ['privado excluído', () => modeloPrivadoExcluido('nao_conferido')], ['comentários', () => modeloComComentarios('incluido')], ['comentários fora', () => modeloComComentarios('excluido')],
  ['estresse', () => modeloEstresse()], ['mudanças longas', () => modeloEstresseMudancas()], ['vídeo longo', () => modeloEstresseVideo()],
]

describe('cabe sem corte', () => {
  it('nenhum corte: a linha "Por tamanho: nada" com os dois números, e a seção 7 diz o resto', () => {
    const p = pac(modeloCheio())
    const t = montarTexto(p, '', L30, 'todos')
    expect(t.cabe).toBe(true)
    expect(t.cortes).toEqual([])
    expect(t.degrau).toBeNull()
    expect(t.pisoPassou).toBe(false)
    expect(t.totalSemCorte).toBe(t.caracteres)
    expect(t.caracteres).toBe(t.texto.length)
    expect(t.texto).toContain(`- Por tamanho: nada. O pacote tem ${milhar(t.caracteres)} de 30.000 caracteres.`)
    expect(t.texto).toContain('- Dado privado do canal: esta tela não tem.')
    expect(t.texto).toContain('- Texto de comentários: esta tela não tem.')
    expect(t.texto).toContain('- Chaves, senhas e links de acesso ao site: nunca entram.')
    expect(medidaConfere(t)).toBe(true)
  })

  it('as nove partes, na ordem, e a parte 9 é a última', () => {
    const t = montarTexto(pac(modeloCheio()), 'Qual dos dois cresce mais?', L30, 'todos').texto
    const ix = ['## 2. ', '## 3. ', '## 4. ', '## 5. ', '## 6. ', '## 7. O que ficou de fora', '## 8. Bloco estruturado', '## 9. Minha pergunta'].map((x) => t.indexOf(`\n${x}`))
    expect(ix.every((i) => i > 0)).toBe(true)
    expect([...ix].sort((a, b) => a - b)).toEqual(ix)
    expect(t.endsWith('## 9. Minha pergunta\nMinha pergunta:\nQual dos dois cresce mais?')).toBe(true)
  })

  it('sem tabela nenhuma (vazio): cabe, cortes vazio', () => {
    const t = montarTexto(pac(modeloVazio()), '', L30, 'todos')
    expect(t.cabe).toBe(true)
    expect(t.cortes).toEqual([])
    expect(t.texto).toContain('(nenhuma tabela: nenhum canal acompanhado ainda)')
    expect(lerJson(t.texto).medidas).toEqual([])
  })

  it('as variantes da linha do dado privado e dos comentários na seção 7', () => {
    const fora = (m: PacoteModelo) => montarTexto(pac(m), '', L30, 'todos').texto
    expect(fora(modeloPrivadoIncluido())).toContain('- Dado privado do canal: incluído (impressões por dia).')
    expect(fora(modeloPrivadoExcluido('sem_direito'))).toContain('- Dado privado do canal: NÃO incluído (impressões por dia e cliques estimados). Sem o direito.')
    expect(fora(modeloPrivadoExcluido('nao_conferido'))).toContain('Não foi possível conferir o direito agora.')
    expect(fora(modeloPrivadoExcluido('leitura_falhou'))).toContain('A leitura falhou agora.')
    expect(fora(modeloPrivadoExcluido('leitura_falhou'))).not.toContain('Sem o direito.')
    expect(fora(modeloComComentarios('incluido'))).toContain('- Texto de comentários: incluído, sem o nome de quem escreveu (2).')
    expect(fora(modeloComComentarios('excluido'))).toContain('- Texto de comentários: NÃO incluído. Há 14 comentários que não foram incluídos.')
  })
})

describe('fronteira e pergunta', () => {
  it('30.000 exatos cabe; 30.001 corta', () => {
    const cabe = montarTexto(pac(comTamanho(modeloCheio(), 30_000)), '', L30, 'todos')
    expect(cabe.totalSemCorte).toBe(30_000)
    expect(cabe.cabe).toBe(true)
    expect(cabe.caracteres).toBe(30_000)
    const corta = montarTexto(pac(comTamanho(modeloCheio(), 30_001)), '', L30, 'todos')
    expect(corta.totalSemCorte).toBe(30_001)
    expect(corta.cabe).toBe(false)
    expect(corta.cortes.length).toBeGreaterThanOrEqual(1)
    expect(corta.caracteres).toBeLessThanOrEqual(30_000)
    expect(corta.texto).toContain('- Por tamanho: cortei ')
  })

  it('a pergunta entra no total: o mesmo pacote cabe com pergunta vazia e corta com 1.000', () => {
    const p = pac(comTamanho(modeloCheio(), 29_800))
    expect(montarTexto(p, '', L30, 'todos').cabe).toBe(true)
    const cheia = montarTexto(p, 'q'.repeat(1_000), L30, 'todos')
    expect(cheia.cabe).toBe(false)
    expect(cheia.totalSemCorte).toBeGreaterThan(30_000)
    expect(cheia.caracteres).toBeLessThanOrEqual(30_000)
  })

  it('a pergunta nunca é cortada: as 1.000 letras estão no fim do texto, mesmo quando o pacote corta', () => {
    const pergunta = Array.from({ length: 1_000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('')
    const t = montarTexto(pac(modeloEstresse()), pergunta, L30, 'todos')
    expect(t.cabe).toBe(false)
    expect(t.texto.endsWith(`Minha pergunta:\n${pergunta}`)).toBe(true)
  })

  it('pergunta de 1.001: a função usa 1.000', () => {
    const pergunta = `${'a'.repeat(1_000)}ZZ`
    const t = montarTexto(pac(modeloCheio()), pergunta, L30, 'todos')
    expect(t.texto.endsWith(`Minha pergunta:\n${'a'.repeat(1_000)}`)).toBe(true)
    expect(t.texto).not.toContain('ZZ')
  })

  it('exatamente uma linha "Minha pergunta:" antes da pergunta, e é a última linha antes dela (item 238)', () => {
    const casos: PacoteModelo[] = [modeloComComentarios('incluido')]
    const titulo = modeloCheio(); titulo.tabelas[2]!.linhas[0]![0] = terceiros(SENTINELA, 'pack.v[0].titulo'); casos.push(titulo)
    const citado = modeloCheio(); citado.citados = [{ rotulo: 'descrição', texto: SENTINELA, origem: 'pack.x' }, { rotulo: 'outra', texto: SENTINELA, origem: 'pack.y', linha: { tabela: 'videos', posicao: 1 } }]; casos.push(citado)
    for (const m of casos) {
      const t = montarTexto(pac(m), 'Minha pergunta real', L30, 'todos').texto
      const antes = t.slice(0, t.lastIndexOf('Minha pergunta real'))
      expect(antes.split('\n').filter((l) => l === 'Minha pergunta:')).toHaveLength(1)
      expect(antes.endsWith('\n## 9. Minha pergunta\nMinha pergunta:\n')).toBe(true)
      expect(t.split('\n').filter((l) => l.startsWith('## 9.'))).toHaveLength(1)
    }
  })

  it('a própria pergunta é do dono e fica como veio: o sentinela digitado no campo vai no fim, depois do único cabeçalho', () => {
    const t = montarTexto(pac(modeloCheio()), SENTINELA, L30, 'todos').texto
    expect(t.endsWith(`## 9. Minha pergunta\nMinha pergunta:\n${SENTINELA}`)).toBe(true)
    expect(t.slice(0, t.length - SENTINELA.length).split('\n').filter((l) => l === 'Minha pergunta:')).toHaveLength(1)
  })

  it('o texto não contém três crases em lugar nenhum (sentinelas em comentário, título e bloco citado)', () => {
    const m = modeloComComentarios('incluido')
    m.tabelas[2]!.linhas[0]![0] = terceiros(SENTINELA, 'pack.v[0].titulo')
    m.citados = [{ rotulo: 'descrição', texto: SENTINELA, origem: 'pack.x' }]
    m.avisos = [SENTINELA]
    expect(montarTexto(pac(m), '', L30, 'todos').texto).not.toContain('```')
  })
})

describe('ordem e conteúdo do corte', () => {
  it('ordem: o dia a dia sai antes de qualquer linha de lista', () => {
    const p = pac(comTamanho(modeloCheio(), 30_300))
    const t = montarTexto(p, '', L30, 'todos')
    expect(t.cortes).toHaveLength(1)
    expect(t.cortes[0]!.rotulo).toBe('dia a dia de canal Nômade Raiz')
    expect(t.degrau).toBeNull()
    expect(t.texto).not.toContain('### Views por dia')
    for (const i of [1, 2, 3]) expect(t.texto).toContain(`| Vídeo número ${i} |`)
  })

  it('definições, avisos, "como ler" e foco estão inteiros em todo degrau', () => {
    for (const [, fabrica] of [['estresse', () => modeloEstresse()], ['mudanças', () => modeloEstresseMudancas()], ['cheio+', () => comTamanho(modeloCheio(), 30_300)]] as Array<[string, () => PacoteModelo]>) {
      const p = pac(fabrica())
      const t = montarTexto(p, '', L30, 'todos')
      for (const s of p.segmentos.filter((x) => x.parte !== 4)) expect(t.texto, `parte ${s.parte}`).toContain(s.texto)
    }
  })

  it('o JSON só tem as linhas que ficaram (uma linha cortada da tabela não aparece no bloco)', () => {
    const p = pac(modeloEstresseMudancas())
    const t = montarTexto(p, '', L30, 'todos')
    expect(t.degrau).not.toBeNull()
    const json = lerJson(t.texto)
    const trocas = json.medidas.filter((x) => x.tabela === 'trocas' && 'Vídeo' in x.valores)
    const linhasNoTexto = t.texto.split('\n').filter((l) => /^\| Vídeo \d+ \|/.test(l))
    expect(trocas).toHaveLength(linhasNoTexto.length)
    expect(trocas.length).toBeLessThan(40)
    expect(json.medidas.length).toBeLessThan(p.segmentos.filter((s) => s.linhaDoJson).length)
  })

  it('o JSON lido de volta tem a ferramenta, o formato e a janela', () => {
    const t = montarTexto(pac(modeloCheio()), '', L30, 'todos').texto
    const json = lerJson(t)
    expect(json.tela).toBe('comparar')
    expect(json.formato).toBe(1)
    expect(json.medidas.some((x) => x.tabela === 'desempenho')).toBe(true)
  })

  it('dois itens no máximo, e a soma dos cortes é o que a cópia não levou, para pergunta de 0, 1, 500 e 1.000', () => {
    for (const pergunta of PERGUNTAS) {
      for (const [, fabrica] of FIXTURES) {
        const p = pac(fabrica())
        const t = montarTexto(p, pergunta, L30, 'todos')
        expect(t.cortes.length).toBeLessThanOrEqual(2)
        if (t.cabe) continue
        const soma = t.cortes.reduce((s, c) => s + c.caracteres, 0)
        expect(Math.abs(soma - (t.totalSemCorte - t.caracteres)), `${fabrica().tela} pergunta ${pergunta.length}`).toBeLessThanOrEqual(1) // na virada de dígitos do próprio número, a diferença pode ser de um caractere
      }
    }
  })

  it('a soma fecha exatamente nos casos de estresse', () => {
    for (const pergunta of PERGUNTAS) {
      const t = montarTexto(pac(modeloEstresse()), pergunta, L30, 'todos')
      expect(t.cortes.reduce((s, c) => s + c.caracteres, 0)).toBe(t.totalSemCorte - t.caracteres)
    }
  })

  it('dois itens (dia a dia e linhas): o primeiro é o medido, o último é o resto, e a soma fecha exatamente', () => {
    const m = modeloEstresse(60, 30)
    m.tabelas[0]!.linhas = m.tabelas[0]!.linhas.map((l) => [terceiros('c'.repeat(700), 'pack.c'), ...l.slice(1)]) // 60 linhas largas: depois do dia a dia ainda passa de 30.000
    for (const pergunta of PERGUNTAS) {
      const t = montarTexto(pac(m), pergunta, L30, 'todos')
      expect(t.cortes).toHaveLength(2)
      expect(t.cortes[0]!.rotulo).toBe('dia a dia de 60 canais')
      expect(t.cortes[1]!.rotulo).toMatch(/^linhas além da \d+ª da tabela de canais$/)
      expect(t.cortes[0]!.caracteres).toBeGreaterThan(0)
      expect(t.cortes[1]!.caracteres).toBeGreaterThan(0)
      expect(t.cortes.reduce((s, c) => s + c.caracteres, 0)).toBe(t.totalSemCorte - t.caracteres)
      expect(t.texto).toContain(`primeiro dia a dia de 60 canais (${milhar(t.cortes[0]!.caracteres)}), depois ${t.cortes[1]!.rotulo} (${milhar(t.cortes[1]!.caracteres)})`)
    }
  })

  it('a medida por soma bate com o texto montado em todas as fixtures, com e sem pergunta', () => {
    for (const pergunta of ['', 'q'.repeat(1_000)]) {
      for (const [nome, fabrica] of FIXTURES) {
        const p = pac(fabrica())
        for (const [lim, modo] of [[L30, 'todos'], [L200, 'um_por_vez']] as const) expect(medidaConfere(montarTexto(p, pergunta, lim, modo)), `${nome} ${lim}`).toBe(true)
      }
    }
  })

  it('rótulos do corte no molde do mockup', () => {
    const notas = readFileSync(join(MOCKUP, 'NOTAS.md'), 'utf8')
    expect(notas).toContain('dia a dia de ')
    expect(notas).toContain('linhas além da 25ª da tabela de trocas')
    const trocas = montarTexto(pac(modeloEstresseMudancas()), '', L30, 'todos')
    expect(trocas.cortes[0]!.rotulo).toMatch(/^linhas além da \d+ª da tabela de trocas$/)
    const canais = montarTexto(pac(modeloEstresse()), '', L30, 'todos')
    expect(canais.cortes[0]!.rotulo).toBe('dia a dia de 60 canais')
  })
})

describe('estresse (60 canais, 90 dias)', () => {
  const p = pac(modeloEstresse())
  const copia = montarTexto(p, '', L30, 'todos')
  const completo = montarTexto(p, '', L200, 'um_por_vez')

  it('a cópia cabe em 30.000, o completo em 200.000, e o que não sai é o que o completo cortou', () => {
    expect(copia.caracteres).toBeLessThanOrEqual(L30)
    expect(completo.caracteres).toBeLessThanOrEqual(L200)
    expect(copia.pisoPassou || completo.pisoPassou).toBe(false)
    const r = resumir(p, '')
    expect(r.naoSaem + r.completo.caracteres).toBe(r.completo.totalSemCorte)
    expect(r.soNoArquivo).toBe(r.completo.caracteres - r.copia.caracteres)
    expect(r.soNoArquivo).toBeGreaterThan(0)
  })

  it('a cópia não tem nenhuma tabela de dia a dia (o corte grosso da cópia continua)', () => {
    expect(copia.texto).not.toContain('### Views por dia')
  })

  it('o completo não desperdiça: devolver a última tabela de dia a dia tirada estouraria o limite', () => {
    const m = medir(p)
    const noTexto = new Set(completo.texto.split('\n').filter((l) => l.startsWith('### Views por dia, canal de teste ')).map((l) => Number(l.replace('### Views por dia, canal de teste ', ''))))
    const tiradas = m.diaTabelas.map((id) => Number(id.replace('dia-', ''))).filter((n) => !noTexto.has(n))
    expect(tiradas.length).toBeGreaterThan(0)
    const ultima = Math.min(...tiradas) // cortado da última para a primeira: a que sai por último é a de menor número
    const item = m.itens.find((i) => i.seg.corte?.classe === 'dia_a_dia' && i.seg.corte.tabela === `dia-${ultima}`)!
    expect(completo.caracteres + item.texto + 1 + item.json).toBeGreaterThan(L200)
  })

  it('o completo ainda tem tabela de dia a dia, e o rótulo diz "dia a dia de {k} de 60 canais"', () => {
    expect(completo.texto).toContain('### Views por dia')
    expect(completo.cortes[0]!.rotulo).toMatch(/^dia a dia de \d+ de 60 canais$/)
  })

  it('no completo, as tabelas de dia a dia que ficam são as primeiras do pacote', () => {
    const ficam = completo.texto.split('\n').filter((l) => l.startsWith('### Views por dia, canal de teste ')).map((l) => Number(l.replace('### Views por dia, canal de teste ', '')))
    expect(ficam).toEqual(Array.from({ length: ficam.length }, (_, i) => i + 1))
    expect(ficam.length).toBeLessThan(60)
  })

  it('nenhuma tabela aparece pela metade: toda tabela de dia a dia presente tem as 90 linhas', () => {
    const linhas = completo.texto.split('\n')
    const inicios = linhas.flatMap((l, i) => (l.startsWith('### Views por dia') ? [i] : []))
    expect(inicios.length).toBeGreaterThan(0)
    for (const i of inicios) {
      let n = 0
      for (let j = i + 3; j < linhas.length && linhas[j]!.startsWith('| '); j += 1) n += 1
      expect(n).toBe(90)
    }
  })

  it('a prévia: visível mais dobras é igual ao total da cópia, sem dobra negativa', () => {
    const r = resumir(p, 'e agora?')
    const v = r.previa
    expect(v.inicio.length + v.dobra1 + v.fim7e8.length + v.dobra2 + v.fim9.length).toBe(r.copia.caracteres)
    expect(v.dobra1).toBeGreaterThan(0)
    expect(v.dobra2).toBeGreaterThan(0)
  })
})

describe('texto longo (descrições de 5.000 caracteres)', () => {
  it('Mudanças com 40 trocas de descrição: a cópia cabe em 30.000 e o completo em 200.000', () => {
    const p = pac(modeloEstresseMudancas())
    const copia = montarTexto(p, '', L30, 'todos')
    const completo = montarTexto(p, '', L200, 'um_por_vez')
    expect(copia.pisoPassou).toBe(false)
    expect(completo.pisoPassou).toBe(false)
    expect(copia.caracteres).toBeLessThanOrEqual(L30)
    expect(completo.caracteres).toBeLessThanOrEqual(L200)
    expect(completo.caracteres).toBeGreaterThan(copia.caracteres)
  })

  it('Vídeo com 30 versões de descrição: idem', () => {
    const p = pac(modeloEstresseVideo())
    const copia = montarTexto(p, '', L30, 'todos')
    const completo = montarTexto(p, '', L200, 'um_por_vez')
    expect(copia.pisoPassou).toBe(false)
    expect(completo.pisoPassou).toBe(false)
    expect(copia.caracteres).toBeLessThanOrEqual(L30)
    expect(completo.caracteres).toBeLessThanOrEqual(L200)
  })

  it('linha cortada leva o bloco: nenhum bloco órfão no texto, e o campo do bloco some do JSON', () => {
    for (const fabrica of [modeloEstresseMudancas, modeloEstresseVideo]) {
      const t = montarTexto(pac(fabrica()), '', L30, 'todos')
      const linhasNoTexto = new Set(t.texto.split('\n').flatMap((l) => (/^\| (Vídeo|versão) (\d+) \|/.exec(l) ? [Number(/(\d+)/.exec(l)![1])] : [])))
      const blocos = [...t.texto.matchAll(/^\[descrição (?:nova do vídeo|da versão) (\d+) · texto de terceiros\]$/gm)].map((m) => Number(m[1]))
      expect(blocos.length).toBeGreaterThan(0)
      for (const b of blocos) expect(linhasNoTexto.has(b), `bloco ${b} sem a sua linha`).toBe(true)
      const dosBlocos = lerJson(t.texto).medidas.filter((x) => 'bloco' in x.valores && 'posicao' in x.valores).map((x) => x.valores['posicao'] as number)
      for (const pos of dosBlocos) expect(linhasNoTexto.has(pos), `campo do bloco ${pos} no JSON sem a linha`).toBe(true)
      expect(dosBlocos.sort((x, y) => x - y)).toEqual([...blocos].sort((x, y) => x - y))
    }
  })

  it('os caracteres do bloco ligado entram no item das linhas, e a soma dos cortes continua fechando', () => {
    const t = montarTexto(pac(modeloEstresseMudancas()), '', L30, 'todos')
    expect(t.cortes[t.cortes.length - 1]!.rotulo).toMatch(/linhas além da|todas as linhas/)
    expect(t.cortes[t.cortes.length - 1]!.caracteres).toBeGreaterThan(5_000)
    expect(t.cortes.reduce((s, c) => s + c.caracteres, 0)).toBe(t.totalSemCorte - t.caracteres)
  })

  it('bloco sem linha só sai depois do degrau 0 das listas: o texto citado de 8.000 fica quando o degrau 10 basta', () => {
    const m = modeloEstresseMudancas()
    m.tabelas[0]!.linhas = m.tabelas[0]!.linhas.map((l) => [...l.slice(0, 2), rotulo('x'.repeat(1_000), 'pack.x')]) // 40 linhas de mil caracteres
    m.citados = [{ rotulo: 'leitura da forja', texto: 'f'.repeat(8_000), origem: 'pack.forja' }]
    const t = montarTexto(pac(m), '', L30, 'todos')
    expect(t.cabe).toBe(false)
    expect(t.texto).toContain('[leitura da forja · texto de terceiros]')
    expect(t.cortes.map((c) => c.rotulo).join(' ')).not.toContain('texto citado')
    expect(t.degrau).not.toBeNull()
    expect(t.degrau).toBeGreaterThan(0)
  })

  it('bloco sem linha sai quando nem o degrau 0 basta, e o rótulo diz "… e 1 texto citado"', () => {
    const m = modeloCheio()
    m.tabelas = m.tabelas.filter((t) => t.tipo === 'lista')
    m.citados = [{ rotulo: 'leitura da forja', texto: 'f'.repeat(40_000), origem: 'pack.forja' }]
    const t = montarTexto(pac(m), '', L30, 'todos')
    expect(t.pisoPassou).toBe(false)
    expect(t.degrau).toBe(0)
    expect(t.texto).not.toContain('[leitura da forja')
    expect(t.cortes[t.cortes.length - 1]!.rotulo).toBe('todas as linhas da tabela de vídeos e 1 texto citado')
  })

  it('só bloco sem linha, sem lista: o rótulo é "1 texto citado" sozinho', () => {
    const m = modeloCheio()
    m.tabelas = m.tabelas.filter((t) => t.tipo === 'fixa')
    m.citados = [{ rotulo: 'leitura da forja', texto: 'f'.repeat(40_000), origem: 'pack.forja' }]
    const t = montarTexto(pac(m), '', L30, 'todos')
    expect(t.cortes).toHaveLength(1)
    expect(t.cortes[0]!.rotulo).toBe('1 texto citado')
  })

  it('nenhum bloco citado aparece pela metade', () => {
    const t = montarTexto(pac(modeloEstresseMudancas()), '', L30, 'todos')
    const blocos = t.texto.split('\n[').slice(1).filter((x) => x.startsWith('descrição nova'))
    expect(blocos.length).toBeGreaterThan(0)
    for (const b of blocos) {
      const corpo = b.split('\n').slice(1).filter((l) => l.startsWith('│ '))
      expect(corpo.join('').length).toBeGreaterThan(4_000)
    }
  })
})

describe('piso', () => {
  it('todas as fixtures, com pergunta de 1.000, cabem no último passo (nos dois limites)', () => {
    for (const [nome, fabrica] of FIXTURES) {
      const p = pac(fabrica())
      expect(montarTexto(p, 'q'.repeat(1_000), L30, 'todos').pisoPassou, nome).toBe(false)
      expect(montarTexto(p, 'q'.repeat(1_000), L200, 'um_por_vez').pisoPassou, nome).toBe(false)
    }
  })

  it('piso forçado (definições de enchimento com 31.000): pisoPassou, as definições inteiras e a seção 7 diz o tamanho real', () => {
    const enchimento = 'd'.repeat(31_000)
    const m = modeloCheio()
    m.definicoes = [...m.definicoes, { medida: 'Enchimento', frase: enchimento, limiares: [] }]
    const t = montarTexto(pac(m), '', L30, 'todos')
    expect(t.pisoPassou).toBe(true)
    expect(t.cabe).toBe(false)
    expect(t.texto).toContain(enchimento)
    expect(t.texto).toMatch(new RegExp(`- Por tamanho: o pacote tem ${milhar(t.totalSemCorte).replace(/\./g, '\\.')} caracteres, acima do limite de 30\\.000`))
    expect(t.caracteres).toBeGreaterThan(L30)
    expect(medidaConfere(t)).toBe(true)
  })

  it('piso forçado sem nada que possa sair: a linha diz isso, sem inventar corte', () => {
    const m = modeloVazio()
    m.definicoes = [{ medida: 'Enchimento', frase: 'd'.repeat(31_000), limiares: [] }]
    const t = montarTexto(pac(m), '', L30, 'todos')
    expect(t.pisoPassou).toBe(true)
    expect(t.cortes).toEqual([])
    expect(t.texto).toContain('e não há nada que possa sair sem tirar definições ou avisos.')
  })
})

describe('prévia e pureza', () => {
  it('prévia: visível mais dobras é igual ao total, para toda fixture e para pergunta vazia e cheia; nenhuma dobra negativa', () => {
    for (const pergunta of ['', 'q'.repeat(1_000)]) {
      for (const [nome, fabrica] of FIXTURES) {
        const r = resumir(pac(fabrica()), pergunta)
        const v = r.previa
        expect(v.inicio.length + v.dobra1 + v.fim7e8.length + v.dobra2 + v.fim9.length, nome).toBe(r.copia.caracteres)
        expect(v.dobra1, nome).toBeGreaterThanOrEqual(0)
        expect(v.dobra2, nome).toBeGreaterThanOrEqual(0)
        expect(v.fim9.startsWith('## 9. Minha pergunta'), nome).toBe(true)
        expect(v.fim7e8.startsWith('## 7. O que ficou de fora'), nome).toBe(true)
        expect(v.inicio.startsWith(r.copia.texto.slice(0, 10)), nome).toBe(true)
      }
    }
  })

  it('a prévia com menos de três tabelas vai até o fim da parte 4, e a dobra são as partes 5 e 6', () => {
    const r = resumir(pac(modeloComZero()), '')
    expect(r.previa.inicio.trimEnd().endsWith('| 2× o normal ou mais | 0 (zero medido) | 38 longos olhados em 7 canais |')).toBe(true)
    expect(r.copia.texto.slice(r.previa.inicio.length, r.previa.inicio.length + r.previa.dobra1)).toContain('## 5. Definições e método')
  })

  it('a prévia com três tabelas ou mais vai até o fim da segunda', () => {
    const r = resumir(pac(modeloCheio()), '')
    expect(r.previa.inicio).toContain('### Desempenho dos vídeos')
    expect(r.previa.inicio).not.toContain('### Vídeos do período')
    expect(r.copia.texto.slice(r.previa.inicio.length)).toMatch(/^### Vídeos do período/)
  })

  it('resumir chama noJson no máximo duas vezes por limite (a decisão é por soma, não por remontagem)', () => {
    const p = pac(modeloEstresse())
    contagem.noJson = 0
    resumir(p, 'uma pergunta')
    expect(contagem.noJson).toBeLessThanOrEqual(2)
    expect(contagem.noJson).toBeGreaterThanOrEqual(1)
    contagem.noJson = 0
    montarTexto(p, 'outra', L30, 'todos')
    expect(contagem.noJson).toBe(1)
  })

  it('montarTexto é pura: duas chamadas iguais dão o mesmo texto', () => {
    const p = pac(modeloEstresse())
    const a = montarTexto(p, 'oi', L30, 'todos')
    const b = montarTexto(pac(modeloEstresse()), 'oi', L30, 'todos')
    expect(a.texto).toBe(b.texto)
    expect(a.cortes).toEqual(b.cortes)
  })

  it('o arquivo não lê relógio nem sorteio', () => {
    const fonte = readFileSync(MONTAR_TS, 'utf8')
    expect(fonte).not.toMatch(/\bDate\b/)
    expect(fonte).not.toMatch(/Math\.random|performance\.now/)
  })

  it('um pacote com célula de número cru: nada aqui depende de relógio (o instante entra no segmentar)', () => {
    const m = modeloMagro(0, 2)
    m.tabelas[0]!.linhas[0] = [rotulo('Medida', 'pack.m'), medido('1', 1, 'pack.n')]
    expect(montarTexto(pac(m), '', L30, 'todos').texto).toContain('Gerado em: 13/10/2026 14:32')
  })
})
