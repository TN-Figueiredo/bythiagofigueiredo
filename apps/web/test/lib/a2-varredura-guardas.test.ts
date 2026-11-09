// @vitest-environment node
/**
 * A2 · Tarefa 2: varredura do código-fonte. O Observatório lê pela guarda própria (`exigirLeituraDoObservatorio`); `mode: 'view'` do pacote
 * volta a ser `can_view_site` (= editar) depois da MG19 e esvaziaria a tela da leitora. E nenhuma tela do Observatório lê pela sessão
 * (createServerClient): a RLS dá 0 a quem só lê, a tela ficaria vazia em verde.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '../../src')
const O = join(SRC, 'app/cms/(authed)/youtube/competitors')
const L = join(SRC, 'lib/youtube/observatorio')

function arquivos(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...arquivos(p))
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
const codigo = (f: string) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l))
const rel = (f: string) => relative(SRC, f)

describe('A2: varredura das guardas', () => {
  const dentro = [...arquivos(O), ...arquivos(L)]

  it('(a) nenhum mode: view sob O/ e lib/youtube/observatorio (linhas de comentário ignoradas)', () => {
    const achados = dentro.flatMap((f) => codigo(f).filter(({ l }) => /mode:\s*['"]view['"]/.test(l)).map(({ n }) => `${rel(f)}:${n}`))
    expect(achados).toEqual([])
  })

  it('(b) exigirLeituraDoObservatorio não aparece fora desses dois caminhos (nem na lib/cms)', () => {
    const todos = arquivos(SRC).filter((f) => !f.startsWith(O) && !f.startsWith(L))
    const achados = todos.filter((f) => codigo(f).some(({ l }) => l.includes('exigirLeituraDoObservatorio'))).map(rel)
    expect(achados).toEqual([])
  })

  it('(c) nenhum createServerClient/createBrowserClient sob O/ e lib/youtube/observatorio além de _canais/meu-email.ts', () => {
    const achados = dentro
      .filter((f) => codigo(f).some(({ l }) => /create(Server|Browser)Client/.test(l)))
      .map(rel)
      .filter((f) => !f.endsWith('_canais/meu-email.ts'))
    expect(achados).toEqual([])
  })

  const chamadas = (f: string, trecho: string) => codigo(f).filter(({ l }) => l.replace(/\s\/\/.*$/, '').includes(trecho)).length
  const contagem = (trecho: string) => Object.fromEntries(dentro.map((f) => [rel(f), chamadas(f, trecho)]).filter(([, n]) => (n as number) > 0).sort())

  it('a varredura enxerga: a guarda existe e é chamada nos 5 pontos, contando CHAMADAS e não arquivos', () => {
    expect(contagem('exigirLeituraDoObservatorio(')).toEqual({
      'app/cms/(authed)/youtube/competitors/_chrome/page-data.ts': 2,
      'app/cms/(authed)/youtube/competitors/contexto-ia-actions.ts': 1,
      'app/cms/(authed)/youtube/competitors/niche-actions.ts': 2,
      'lib/youtube/observatorio/guarda-leitura.ts': 1, // a definição
      'lib/youtube/observatorio/proprio/leitura-privada.ts': 1,
    })
  })

  it('(d) requireSiteScope( sob O/ e lib/youtube/observatorio só nas chamadas de escrita da lista nominal, todas com mode edit/publish', () => {
    // Cada item é uma chamada de ESCRITA (ou de tela só do editor). Uma leitura que voltar a `requireSiteScope` (mesmo com mode: 'edit')
    // fecha o Observatório à leitora e aumenta a contagem do arquivo: o teste fica vermelho e obriga a justificar aqui.
    const ESCRITA: Record<string, number> = {
      'app/cms/(authed)/youtube/competitors/niche-actions.ts': 1, // a ação que grava o nicho
      'app/cms/(authed)/youtube/competitors/forja-actions.ts': 1, // pedido à forja
      'app/cms/(authed)/youtube/competitors/actions.ts': 3, // adicionar, remover e demais ações do Observatório
      'app/cms/(authed)/youtube/competitors/_saiu/dados.ts': 2, // tela do que saiu: só quem edita
      'app/cms/(authed)/youtube/competitors/_saiu/actions.ts': 1,
      'app/cms/(authed)/youtube/competitors/_arquivo/actions-canal.ts': 1,
      'app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/ler-testes-abertos.ts': 1, // A/B Lab: só quem edita
      'app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/permissao.ts': 1,
      'app/cms/(authed)/youtube/competitors/_sugestoes/dados.ts': 1, // sugestões: só quem edita
      'app/cms/(authed)/youtube/competitors/_sugestoes/actions.ts': 4,
      'app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela.ts': 2,
      'app/cms/(authed)/youtube/competitors/sugestoes/page.tsx': 1,
      'lib/youtube/observatorio/proprio/edicao.ts': 1, // a prova de edição do desempenho privado
    }
    expect(contagem('requireSiteScope(')).toEqual(Object.fromEntries(Object.entries(ESCRITA).sort()))
    const fracas = dentro.flatMap((f) => codigo(f).filter(({ l }) => /requireSiteScope\(/.test(l) && !/mode:\s*['"](edit|publish)['"]/.test(l)).map(({ n }) => `${rel(f)}:${n}`))
    expect(fracas).toEqual([])
  })
})
