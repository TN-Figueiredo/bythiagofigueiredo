// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12: a varredura do CÓDIGO do botão "Perguntar a uma IA". Regras de camada (a pasta de regras é pura; os empacotadores só
 * importam valor de módulos sem `'use client'`), de nome e de vocabulário, com controle negativo em cada uma.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB = resolve(__dirname, '../../..')
const L = join(WEB, 'src/lib/youtube/observatorio/contexto-ia')
const C = join(WEB, 'src/app/cms/(authed)/youtube/competitors')
const T = join(WEB, 'test/youtube/observatorio')

const arquivos = (dir: string, ext: RegExp = /\.(ts|tsx)$/): string[] => readdirSync(dir).filter((n) => ext.test(n)).map((n) => join(dir, n)).sort()
const ler = (p: string): string => readFileSync(p, 'utf8')
const nome = (p: string): string => p.slice(WEB.length + 1)

/** Tira comentários de linha e de bloco (a regra olha o código, não a prosa que explica a regra). */
const semComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Cada `import` com o que traz e de onde. `soTipo` é verdadeiro quando TUDO o que ele traz é tipo. */
function importacoes(fonte: string): Array<{ de: string; soTipo: boolean }> {
  const saida: Array<{ de: string; soTipo: boolean }> = []
  const re = /import\s+(type\s+)?([\s\S]*?)\s*from\s*'([^']+)'/g
  for (let m = re.exec(semComentarios(fonte)); m; m = re.exec(semComentarios(fonte))) {
    const corpo = m[2] ?? ''
    const tudoTipo = !!m[1] || (/^\{[\s\S]*\}$/.test(corpo.trim()) && corpo.replace(/[{}]/g, '').split(',').map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith('type ')))
    saida.push({ de: m[3]!, soTipo: tudoTipo })
  }
  return saida
}

describe('a pasta de regras (contexto-ia) é pura', () => {
  const PROIBIDO = [/server-only/, /from 'next\//, /@\/lib\/supabase/, /@sentry/, /\bfetch\(/, /Date\.now/]
  const puros = arquivos(L).filter((p) => !p.endsWith('registrar-acesso.ts'))
  it('há arquivos para varrer', () => { expect(puros.length).toBeGreaterThanOrEqual(8) })
  for (const p of puros) {
    it(`${nome(p)}: sem server-only, next/, supabase, Sentry, fetch( nem Date.now`, () => {
      const codigo = semComentarios(ler(p))
      for (const re of PROIBIDO) expect(re.test(codigo), String(re)).toBe(false)
    })
  }
  it('controle negativo: a regra acha cada violação num exemplo ruim', () => {
    for (const ruim of ["import 'server-only'", "import x from 'next/link'", "import s from '@/lib/supabase/service'", "import * as S from '@sentry/nextjs'", 'fetch(url)', 'Date.now()']) {
      expect(PROIBIDO.some((re) => re.test(ruim)), ruim).toBe(true)
    }
  })
  it('registrar-acesso.ts é o único que cria o cliente de serviço, e nenhum outro arquivo do botão o importa', () => {
    const todos = [...arquivos(L), ...arquivos(C, /^contexto-ia-actions\.ts$/), ...arquivos(join(C, '_contexto-ia')), ...arquivos(join(C, '_chrome/perguntar-ia'))]
    const comServico = todos.filter((p) => /getSupabaseServiceClient/.test(semComentarios(ler(p)))).map(nome)
    expect(comServico).toEqual(['src/lib/youtube/observatorio/contexto-ia/registrar-acesso.ts'])
  })
})

describe('os empacotadores só importam valor de módulos sem "use client"', () => {
  /** Módulos de definição, de limiar e de formatador de folha crua de onde um empacotador pode importar VALOR. */
  const PERMITIDOS = new Set([
    '@/lib/youtube/observatorio/contexto-ia/frases', '@/lib/youtube/observatorio/medidas/regras',
    '../_comparar/definicoes', '../_comparar/medidas-do-par', './modelo-medidas-comparar', '../_comparar/regua-da-linha', '../_comparar/so-seu-canal-model', '../_proprio/taxa-faixa-model', '../_proprio/retencao-model', '../_chrome/comentarios/frases', '../_canal/medidas/criador-do-canal', '../_canal/medidas/criador-model', '../_canal/medidas/criador-lista-model',
    '../_canal/videos-model', '../_canal/lista',
    // TG: os modelos puros das medidas da página do canal (os mesmos que a tela usa)
    '../_canal/medidas/canal-derivado', '../_canal/medidas/cabecalho-model', '../_canal/medidas/estado-model', '../_canal/medidas/frase-do-topo', '../_canal/medidas/formatos',
    '../_canal/medidas/direcao-model', '../_canal/medidas/ritmo-model', '../_canal/medidas/lancamentos-model', '../_canal/medidas/linha-do-tempo-model',
    // TG: os modelos puros das medidas do Histórico do vídeo (os mesmos que a tela usa) e a leitura de "Estourou e parou"
    '../_historico/medidas/formatos', '../_chrome/medidas/estourou-model', '@/lib/youtube/observatorio/medidas-telas/texto-m10',
  ])
  const empacotadores = arquivos(join(C, '_contexto-ia'), /^empacotar-.*\.ts$/)
  it('há treze empacotadores', () => { expect(empacotadores).toHaveLength(13) })
  for (const p of empacotadores) {
    it(`${nome(p)}: valor só de permitidos, de irmãos empacotar-* e de contexto-ia/; nenhum módulo importado tem 'use client'`, () => {
      for (const i of importacoes(ler(p))) {
        if (i.soTipo) continue
        const ok = PERMITIDOS.has(i.de) || /^\.\/empacotar-[a-z-]+$/.test(i.de) || i.de.startsWith('@/lib/youtube/observatorio/contexto-ia/')
        expect(ok, `${nome(p)} importa valor de ${i.de}`).toBe(true)
      }
      for (const i of importacoes(ler(p))) {
        if (!i.de.startsWith('../')) continue
        const alvo = ['.ts', '.tsx'].map((e) => resolve(join(C, '_contexto-ia'), i.de + e)).find(existsSync)
        if (alvo) expect(ler(alvo).split('\n')[0], `${i.de} é módulo de cliente`).not.toMatch(/use client/)
      }
    })
  }
  it('controle negativo: o leitor de importações separa tipo de valor', () => {
    expect(importacoes("import type { A } from '../x'\nimport { type B, C } from '../y'\nimport { type D } from '../z'")).toEqual([
      { de: '../x', soTipo: true }, { de: '../y', soTipo: false }, { de: '../z', soTipo: true },
    ])
  })
  it("o módulo de cliente 'numero-a-numero' existe e é de cliente (a razão de a regra existir)", () => {
    expect(ler(join(C, '_comparar/numero-a-numero.tsx')).split('\n')[0]).toMatch(/use client/)
  })
})

describe('o botão e a ação', () => {
  it('nenhum arquivo de _chrome/perguntar-ia importa de contexto-ia-actions', () => {
    for (const p of arquivos(join(C, '_chrome/perguntar-ia'), /\.(ts|tsx|css)$/)) expect(ler(p), nome(p)).not.toMatch(/contexto-ia-actions/)
  })
  it('a palavra "pergunta" não aparece no código de contexto-ia-actions.ts nem de registrar-acesso.ts', () => {
    for (const p of [join(C, 'contexto-ia-actions.ts'), join(L, 'registrar-acesso.ts')]) {
      expect(/\bpergunta\b/i.test(semComentarios(ler(p))), nome(p)).toBe(false)
    }
  })
  it('contexto-ia-actions.ts só exporta a função gerarPacoteIa e começa por "use server"', () => {
    const fonte = ler(join(C, 'contexto-ia-actions.ts'))
    expect(fonte.split('\n')[0]).toBe("'use server'")
    const exportados = [...semComentarios(fonte).matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class|type|interface)\s+(\w+)/gm)].map((m) => m[1])
    expect(exportados).toEqual(['gerarPacoteIa'])
  })
})

describe('nomes e vocabulário', () => {
  const doPlano = [
    ...arquivos(L), ...arquivos(join(C, '_contexto-ia')), ...arquivos(join(C, '_chrome/perguntar-ia')), join(C, 'contexto-ia-actions.ts'),
    ...readdirSync(T).filter((n) => n.startsWith('contexto-ia-')).map((n) => join(T, n)),
  ].filter((p) => !p.endsWith('contexto-ia-varredura-de-codigo.test.ts'))
  it('nenhum arquivo se chama pack.ts', () => {
    expect(doPlano.filter((p) => /(^|\/)pack\.ts$/.test(p))).toEqual([])
  })
  it('nenhum arquivo de teste do plano cita o caminho .superpowers (ele não existe na CI)', () => {
    const citam = doPlano.filter((p) => p.startsWith(T) && /\.superpowers/.test(ler(p))).map(nome)
    expect(citam).toEqual([])
  })
  it('o código do botão não cita a prova de acesso nem a leitura privada por dentro', () => {
    const PROIBIDO = /provarAcessoPrivado|provarEdicao|LeituraPrivadaDoSite|EdicaoDoSite|competitor_video_comment|can_view_private_site/
    const codigo = doPlano.filter((p) => !p.startsWith(T)).filter((p) => PROIBIDO.test(semComentarios(ler(p)))).map(nome)
    expect(codigo).toEqual([])
  })
  it('nenhuma palavra de receita no código do botão (conferência auxiliar por palavra inteira)', () => {
    const achados = doPlano.filter((p) => !p.startsWith(T)).filter((p) => /\b(revenue|rpm|cpm|adsense)\b/i.test(semComentarios(ler(p)))).map(nome)
    expect(achados).toEqual([])
  })
  it('controle negativo: o padrão de receita acha a palavra inteira e não "cpmx"', () => {
    expect(/\b(revenue|rpm|cpm|adsense)\b/i.test('o CPM do canal')).toBe(true)
    expect(/\b(revenue|rpm|cpm|adsense)\b/i.test('cpmx')).toBe(false)
  })
})

describe('pendências do pacote da IA (Yannis, 17/10)', () => {
  it('as marcas PENDENTE-E17-PACOTE no código são exatamente as declaradas; o portão G-5 (ligar a IA) exige esta lista vazia', () => {
    const achadas = arquivos(join(C, '_contexto-ia')).flatMap((p) => [...ler(p).matchAll(/PENDENTE-E17-PACOTE\(([^)]*)\)/g)].flatMap((m) => m[1]!.split(';').map((x) => x.trim())))
    expect(achadas.sort()).toEqual(['direcaoNicho*', 'groups[].cards[].idade*', 'idade*'])
  })
})
