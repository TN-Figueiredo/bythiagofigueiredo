// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const PROIBIDAS = ['lote', 'unidade', 'selar', 'selado', 'selagem', 'partição', 'cadeia', 'atestação', 'hash', 'ensaio', 'restauração', 'divergente',
  'ambiente', 'tabela', 'linhas', 'MB', 'toco', 'congelado', 'congelamento', 'estágio', 'classe']
const C = 'apps/web/src/app/cms/(authed)/youtube/competitors'
/** Os arquivos que a Tarefa 5 tocou para a peça 1 (ledger, Tarefa 5/5b/5c): textos de tela também. */
// Fora da lista, de propósito: _historico/view-model.ts e views-chart.tsx têm texto ANTIGO com "tabela"/"linhas" (aria do gráfico, "Ver os registros diários em tabela"), não da fase; vão a Logan na T15.
const CONSUMIDORES_PECA1: string[] = [
  `${C}/_canal/medidas/lancamentos-model.ts`,
  `${C}/_canal/medidas/horas-do-canal.tsx`,
  `${C}/_chrome/eixo-arquivo.tsx`,
  `${C}/_chrome/formas-arquivo.tsx`,
  `${C}/_historico/medidas/dias-model.ts`,
  `${C}/_historico/medidas/horas-model.ts`,
  `${C}/_historico/medidas/horas-72.tsx`,
  `${C}/_historico/medidas/idade-model.ts`,
  `${C}/_historico/medidas/curva-por-idade.tsx`,
  `${C}/_historico/medidas/ler-do-video.ts`,
]
const ARQUIVOS = [
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-leve.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/vermelhos.ts',
  ...CONSUMIDORES_PECA1,
  ...execFileSync('git', ['ls-files', `${C}/_arquivo`, `${C}/_chrome/aviso-banco`, `${C}/_canais/esperam-comandos.tsx`], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter(f => /\.(ts|tsx)$/.test(f)),
]
/** Palavra após `.` é acesso a propriedade dentro de `${...}` (v.classe), não texto. Só o texto que vai à tela: literais de string e texto JSX; fora o que está dentro de INFO(...) (o ⓘ) e os comentários. */
function textosDeTela(fonte: string): string[] {
  const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  // fora do texto: o ⓘ (INFO), as chaves de comparação `prefixo:` (dado do banco, não vai à tela)
  const semInfo = semComentario.replace(/INFO\(([`'"])[\s\S]*?\1\)/g, '').replace(/prefixo:\s*(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '')
  const literais = [...semInfo.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map(m => m[2]!).filter(s => /[a-zà-ú]/i.test(s) && !/^[a-z0-9_\-./@:]+$/.test(s))
  const jsx = [...semInfo.matchAll(/>([^<>{}]*[a-zà-ú][^<>{}]*)</gi)].map(m => m[1]!)
  return [...literais, ...jsx]
}
describe('item 38: vocabulário das telas da fase', () => {
  it('a lista dos consumidores da peça 1 não está vazia (a Tarefa 5 a preenche)', () => { expect(CONSUMIDORES_PECA1.length).toBeGreaterThan(0) })
  it('o teste enxerga uma palavra proibida solta e ignora identificadores (teste do teste)', () => {
    expect(textosDeTela("const a = 'Unidade'; const b = 'competitor_video_daily'; const c = 'arq-contorno'")).toEqual(['Unidade'])
  })
  it.each([...new Set(ARQUIVOS)])('%s', arq => {
    const ruins = textosDeTela(readFileSync(resolve(RAIZ, arq), 'utf8'))
      .flatMap(t => PROIBIDAS.filter(p => new RegExp(`(^|[^\\p{L}.])${p}([^\\p{L}]|$)`, p === 'MB' ? 'u' : 'iu').test(t)).map(p => `${p}: ${t.slice(0, 80)}`))
    expect(ruins).toEqual([])
  })
})
