// @vitest-environment node
/**
 * E17 degrau 2, Tarefa 8b (plano 4.7, S-I6 a): tudo em `competitors/` que `_contexto-ia/index.ts` alcança pelos imports abre o dado pelo `Abridor`
 * recebido. Nenhuma chamada direta às portas de sessão fora dos quatro arquivos que as definem ou as ligam. A lista de arquivos é CALCULADA pelos
 * imports (não escrita à mão): um `montar…` novo que entra no `EMPACOTAR` entra na varredura sozinho.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative, sep, posix } from 'node:path'

const SRC = join(__dirname, '../../../src')
const C = join(SRC, 'app/cms/(authed)/youtube/competitors')
const INDEX = join(C, '_contexto-ia/index.ts')
const PERMITIDOS = new Set(['_chrome/abridor.ts', '_chrome/page-data.ts', '_proprio/dados.ts', '_acesso-ia/abrir-por-chave.ts'])
const PROIBIDA = /(?<![.\w])(openObservatoryPage|openChannelPage|acessoPrivado|podeVerPrivado|provarAcessoPrivado|requireSiteScope|getSiteContext|provarEdicao\w*|podeEditarSite|canAdminSiteUsers|permissoesDoSite|cookies)\s*\(/g
/** Guarda/sessão que o alcance por imports enxerga, mas que fica atrás de uma condição que a chave nunca cumpre. Cada entrada diz qual. */
const EXCECOES_DE_SESSAO: Record<string, string> = {
  '_sugestoes/dados.ts': 'sugestoes: a guarda fica atrás de abrir === ABRIDOR_DE_SESSAO; por chave lê o site da prova pelo abridor (sugestoes-por-chave.test.ts)',
  '_saiu/dados.ts': 'fila: idem sugestoes',
  '_chrome/permissoes.ts': 'só chamada por quem já está atrás de abridor de sessão (fila, sugestões, canAdmin do canal)',
  '_chrome/ab-entradas/permissao.ts': 'guarda do A/B; alcançada só por telas de sessão (fila, sugestões)',
  '_chrome/ab-entradas/ler-testes-abertos.ts': 'idem permissao.ts',
  '_proprio/dados-termos.ts': 'provarEdicaoComAviso: os montares só chamam lerTermosESites com podeEditar, e a chave nunca edita (I-3 do Yannis)',
  '_canal/montar.ts': 'canAdminSiteUsers: só com abrir === ABRIDOR_DE_SESSAO; por chave canAdmin é falso',
}
const ALIAS = '@/app/cms/(authed)/youtube/competitors/'

const semComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

function resolver(de: string, alvo: string): string | null {
  let base: string
  if (alvo.startsWith('.')) base = join(dirname(de), alvo)
  else if (alvo.startsWith(ALIAS)) base = join(C, alvo.slice(ALIAS.length))
  else return null
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(c) && statSync(c).isFile()) return c
  return null
}

/** Os arquivos de `competitors/` alcançáveis do ponto de entrada, por `import … from`, `export … from` e `import()` literais. */
export function alcancaveis(entrada: string, ler: (f: string) => string = (f) => readFileSync(f, 'utf8')): string[] {
  const vistos = new Set<string>()
  const fila = [entrada]
  while (fila.length) {
    const f = fila.pop()!
    if (vistos.has(f)) continue
    vistos.add(f)
    const texto = semComentarios(ler(f))
    for (const m of texto.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
      const r = resolver(f, m[1]!)
      if (r && r.startsWith(C + sep) && !vistos.has(r)) fila.push(r)
    }
  }
  return [...vistos]
}

export function chamadasProibidas(arquivos: string[], ler: (f: string) => string = (f) => readFileSync(f, 'utf8')): string[] {
  const achados: string[] = []
  for (const f of arquivos) {
    const rel = relative(C, f).split(sep).join(posix.sep)
    if (PERMITIDOS.has(rel)) continue
    for (const m of semComentarios(ler(f)).matchAll(PROIBIDA)) {
      // as portas das telas valem em qualquer arquivo; os nomes de guarda de sessão têm exceção nominal
      const guarda = !/^(openObservatoryPage|openChannelPage|acessoPrivado|podeVerPrivado|provarAcessoPrivado)$/.test(m[1]!)
      if (guarda && rel in EXCECOES_DE_SESSAO) continue
      achados.push(`${rel}: ${m[1]}(`)
    }
  }
  return achados
}

describe('varredura do abridor (S-I6 a)', () => {
  const lista = alcancaveis(INDEX)
  const rel = lista.map(f => relative(C, f).split(sep).join(posix.sep))

  it('a lista calculada alcança os montar… do EMPACOTAR (guarda contra varredura vazia)', () => {
    for (const esperado of ['_canais/montar.ts', '_canal/montar.ts', '_historico/montar.ts', '_comparar/montar.ts', '_outliers/montar.ts', '_insights/montar.ts', '_mudancas/montar.ts', '_proprio/carregar-extras.ts']) {
      expect(rel, esperado).toContain(esperado)
    }
  })

  it('nenhum arquivo alcançável chama as portas de sessão fora dos quatro permitidos', () => {
    expect(chamadasProibidas(lista)).toEqual([])
  })

  it('o detector pega a chamada (mutação em memória): openObservatoryPage() de volta em _outliers/montar.ts', () => {
    const outliers = lista.find(f => f.endsWith('_outliers/montar.ts'))!
    const mutado = (f: string): string => (f === outliers ? readFileSync(f, 'utf8').replace('abrir.observatorio()', 'openObservatoryPage()') : readFileSync(f, 'utf8'))
    expect(chamadasProibidas(lista, mutado)).toEqual(['_outliers/montar.ts: openObservatoryPage('])
  })
  it('o detector pega guarda de sessão nova em arquivo sem exceção (mutação em memória): requireSiteScope() em _outliers/montar.ts', () => {
    const outliers = lista.find(f => f.endsWith('_outliers/montar.ts'))!
    const mutado = (f: string): string => (f === outliers ? `${readFileSync(f, 'utf8')}\nawait requireSiteScope({})` : readFileSync(f, 'utf8'))
    expect(chamadasProibidas(lista, mutado)).toEqual(['_outliers/montar.ts: requireSiteScope('])
  })
  it('chamada em método (abrir.acessoPrivado) e menção em comentário não contam', () => {
    expect(chamadasProibidas([join(C, '_canais/montar.ts')], () => 'const a = await abrir.acessoPrivado(s)\n// openChannelPage(id)\n/* acessoPrivado(x) */')).toEqual([])
  })
})
