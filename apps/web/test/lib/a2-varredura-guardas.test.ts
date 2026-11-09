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

  it('a varredura enxerga: a guarda existe e é usada nos 5 pontos', () => {
    const usos = dentro.filter((f) => codigo(f).some(({ l }) => l.includes('exigirLeituraDoObservatorio(')))
    expect(usos.map(rel).sort()).toEqual([
      'app/cms/(authed)/youtube/competitors/_chrome/page-data.ts',
      'app/cms/(authed)/youtube/competitors/contexto-ia-actions.ts',
      'app/cms/(authed)/youtube/competitors/niche-actions.ts',
      'lib/youtube/observatorio/guarda-leitura.ts', // a definição
      'lib/youtube/observatorio/proprio/leitura-privada.ts',
    ].sort())
  })
})
