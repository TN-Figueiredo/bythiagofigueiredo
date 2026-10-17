// @vitest-environment node
// Decisão 75, Task 8a: "Não carregou" deixou de ser rótulo do produto. A varredura lê todo .ts/.tsx/.css de competitors/ e de lib/youtube/observatorio/,
// descarta linhas de comentário e veta só o que é rótulo. Chaves internas `nao_carregou` e `NaoCarregou` em nomes de função/campo não entram.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(__dirname, '../../../src')
const C = join(RAIZ, 'app/cms/(authed)/youtube/competitors')
const L = join(RAIZ, 'lib/youtube/observatorio')

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx|css)$/.test(n) ? [p] : []
  })
}
const TODOS = [...arquivos(C), ...arquivos(L)]
const ehComentario = (l: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(l)
function linhas(): Array<{ arq: string; n: number; texto: string }> {
  return TODOS.flatMap((p) => readFileSync(p, 'utf8').split('\n').map((texto, i) => ({ arq: relative(RAIZ, p), n: i + 1, texto })).filter((x) => !ehComentario(x.texto)))
}

/** Só estas três: falha de OUTRA coisa que a medida. Qualquer outra minúscula "não carregou"/"não carregaram" falha. */
const PERMITIDAS: Array<{ arq: string; razao: string }> = [
  { arq: 'app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/thumb-viewer.tsx', razao: 'falha de imagem, não de medida' },
  { arq: 'lib/youtube/observatorio/medidas-telas/carregar-do-site.ts', razao: 'mensagem do Sentry; buscas e alertas dependem do texto' },
  { arq: 'lib/conferencias.ts', razao: 'checklist interno (trocar quando a Task 9/10 tocar o arquivo)' },
]

describe('decisão 75, varredura da Task 8a', () => {
  it('zero "Não carregou" com maiúscula, em qualquer arquivo', () => {
    expect(linhas().filter((x) => /Não carregou|Não carregaram/.test(x.texto)).map((x) => `${x.arq}:${x.n}`)).toEqual([])
  })
  it('zero obs-md-nc, vb-falhou e o componente NaoCarregou (só o nome de função canalNaoCarregou, de outra coisa)', () => {
    const achados = linhas().filter((x) => /obs-md-nc|vb-falhou|(?<![a-z])NaoCarregou\b/.test(x.texto))
    expect(achados.map((x) => `${x.arq}:${x.n}`)).toEqual([])
  })
  it('minúsculas "não carregou"/"não carregaram" só nas 3 PERMITIDAS', () => {
    const permitidas = new Set(PERMITIDAS.map((p) => p.arq))
    expect(PERMITIDAS).toHaveLength(3)
    const achados = linhas().filter((x) => /não carregou|não carregaram/.test(x.texto) && !permitidas.has(x.arq.replace(/\\/g, '/')))
    expect(achados.map((x) => `${x.arq}:${x.n}`)).toEqual([])
  })
  it('zero role="alert" na pastilha: nenhuma linha junta PastilhaAusencia/obs-au com role="alert" (avisos de bloco com alert, de antes, ficam)', () => {
    const achados = linhas().filter((x) => /PastilhaAusencia|obs-au/.test(x.texto) && /role="alert"/.test(x.texto))
    expect(achados.map((x) => `${x.arq}:${x.n}`)).toEqual([])
  })
})
