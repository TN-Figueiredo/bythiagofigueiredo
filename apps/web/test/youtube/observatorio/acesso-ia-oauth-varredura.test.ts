// @vitest-environment node
/**
 * C1 T23 (C1-24): varredura de texto nos arquivos do OAuth. Nenhum `console.`; nenhum `captureMessage`/`captureException`/`pipelineLog`
 * (ou a função de log do módulo) leva `token`, `hash`, `email`, `client_id`, `ip` ou `redirect_uri` como CHAVE do objeto de `extra`/`tags`/dados.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const RAIZ = resolve(__dirname, '../../..')
const PASTAS = [
  'src/lib/youtube/observatorio/acesso-ia/oauth',
  'src/app/api/oauth',
  'src/app/oauth',
  'src/app/cms/(authed)/conectar-ia',
]
const ARQUIVOS = ['src/lib/youtube/observatorio/acesso-ia/estado-da-pessoa.ts']
const PROIBIDAS = ['token', 'hash', 'email', 'client_id', 'ip', 'redirect_uri']
const CHAMADAS = /\b(captureMessage|captureException|pipelineLog|logOAuth|avisar\w*)\s*\(/g

function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}
const todos = [...PASTAS.flatMap((p) => arquivos(join(RAIZ, p))), ...ARQUIVOS.map((a) => join(RAIZ, a)).filter(existsSync)]
const semComentario = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Do `(` da chamada até o `)` que fecha. */
function argumentos(t: string, desde: number): string {
  let n = 0
  for (let i = desde; i < t.length; i++) {
    if (t[i] === '(') n++
    else if (t[i] === ')' && --n === 0) return t.slice(desde, i + 1)
  }
  return t.slice(desde)
}
const chaves = (arg: string): string[] => [...arg.matchAll(/(?:^|[{,\s])['"]?([A-Za-z_][\w]*)['"]?\s*[:,}]/g)].map((m) => m[1]!)

describe('C1-24: varredura de vazamento nos arquivos do OAuth', () => {
  it('há arquivos a varrer', () => { expect(todos.length).toBeGreaterThan(10) })
  it.each(todos.map((f) => [relative(RAIZ, f), f]))('%s: nenhum console.', (_n, f) => {
    expect(semComentario(readFileSync(f, 'utf8'))).not.toMatch(/\bconsole\./)
  })
  it.each(todos.map((f) => [relative(RAIZ, f), f]))('%s: nenhuma chave proibida nos dados de log e Sentry', (_n, f) => {
    const t = semComentario(readFileSync(f, 'utf8'))
    for (const m of t.matchAll(CHAMADAS)) {
      const arg = argumentos(t, m.index! + m[0].length - 1)
      const ruins = chaves(arg).filter((k) => PROIBIDAS.includes(k))
      expect(ruins, `${relative(RAIZ, f)}: ${m[1]}(${arg.slice(0, 80)}…)`).toEqual([])
    }
  })
  it('o detector pega o que deve (controle)', () => {
    const t = "Sentry.captureMessage('x', { extra: { token: t, ok: 1 } })"
    const m = [...t.matchAll(CHAMADAS)][0]!
    expect(chaves(argumentos(t, m.index! + m[0].length - 1))).toContain('token')
  })
})
