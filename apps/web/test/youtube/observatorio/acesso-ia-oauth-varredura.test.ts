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
/** Comparadas em minúsculas e sem `_`: `client_id`, `clientId` e `ClientID` são a mesma chave. */
const PROIBIDAS = ['token', 'hash', 'email', 'clientid', 'ip', 'redirecturi', 'useremail', 'ipaddress']
const norm = (k: string): string => k.toLowerCase().replace(/_/g, '')
const CHAMADAS = /\b(captureMessage|captureException|pipelineLog|avisar\w*|setContext|setTag|setTags|setExtra|setExtras|setUser|addBreadcrumb|withScope)\s*\(/g
/** Destas, o 2º argumento é um objeto de dados e tem de ser LITERAL (indireção esconde a chave da varredura). */
const OBJETO_NO_2 = ['captureMessage', 'captureException', 'setContext']
/** Destas, a 1ª é uma chave: `setTag('client_id', x)`. */
const CHAVE_NO_1 = ['setTag', 'setExtra', 'setContext']

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

/** Argumentos de topo da chamada (separa por vírgula fora de (), {}, []). */
function partes(arg: string): string[] {
  const dentro = arg.slice(1, -1)
  const r: string[] = []
  let n = 0, ini = 0
  for (let i = 0; i < dentro.length; i++) {
    const c = dentro[i]
    if ('({['.includes(c!)) n++
    else if (')}]'.includes(c!)) n--
    else if (c === ',' && n === 0) { r.push(dentro.slice(ini, i)); ini = i + 1 }
  }
  r.push(dentro.slice(ini))
  return r.map((x) => x.trim())
}

/** O que há de errado nesta chamada (lista vazia = limpa). */
function violacoes(nome: string, arg: string): string[] {
  const v: string[] = []
  for (const k of chaves(arg)) if (PROIBIDAS.includes(norm(k))) v.push(`chave proibida: ${k}`)
  if (/\.\.\.\s*(?!\()/.test(arg)) v.push('spread de variável')
  for (const m of arg.matchAll(/(?:^|[{,\s])(extra|tags|contexts|data)\s*([:,}])([^]*)/g)) {
    if (m[2] !== ':') { v.push(`indireção: ${m[1]} sem objeto literal`); continue }
    if (!/^\s*(\{|[^,{}()]*\?\s*\{)/.test(m[3]!)) v.push(`indireção: ${m[1]} não é objeto literal`)
  }
  const p = partes(arg)
  if (OBJETO_NO_2.includes(nome) && p.length > 1 && !p[1]!.startsWith('{')) v.push('2º argumento não é objeto literal')
  if (CHAVE_NO_1.includes(nome)) {
    const k = /^['"`]([^'"`]*)['"`]$/.exec(p[0] ?? '')
    if (!k) v.push('1ª chave não é texto literal')
    else if (PROIBIDAS.includes(norm(k[1]!))) v.push(`chave proibida: ${k[1]}`)
  }
  return v
}
const sonda = (t: string): string[] => {
  const m = [...t.matchAll(CHAMADAS)][0]!
  return violacoes(m[1]!, argumentos(t, m.index! + m[0].length - 1))
}

describe('C1-24: varredura de vazamento nos arquivos do OAuth', () => {
  it('há arquivos a varrer', () => { expect(todos.length).toBeGreaterThan(10) })
  it.each(todos.map((f) => [relative(RAIZ, f), f]))('%s: nenhum console.', (_n, f) => {
    expect(semComentario(readFileSync(f, 'utf8'))).not.toMatch(/\bconsole\./)
  })
  it.each(todos.map((f) => [relative(RAIZ, f), f]))('%s: nenhuma chave proibida nos dados de log e Sentry', (_n, f) => {
    const t = semComentario(readFileSync(f, 'utf8'))
    for (const m of t.matchAll(CHAMADAS)) {
      const arg = argumentos(t, m.index! + m[0].length - 1)
      const ruins = violacoes(m[1]!, arg)
      expect(ruins, `${relative(RAIZ, f)}: ${m[1]}(${arg.slice(0, 80)}…)`).toEqual([])
    }
  })
  it.each([
    ['chave literal', "Sentry.captureMessage('x', { extra: { token: t, ok: 1 } })"],
    ['camelCase clientId', "Sentry.captureMessage('x', { extra: { clientId: id } })"],
    ['camelCase redirectUri', "Sentry.captureMessage('x', { tags: { redirectUri: u } })"],
    ['camelCase userEmail / ipAddress', "Sentry.captureMessage('x', { extra: { ipAddress: a, userEmail: e } })"],
    ['shorthand client_id', "Sentry.captureMessage('x', { extra: { client_id } })"],
    ['indireção const extra', "Sentry.captureMessage('x', { extra })"],
    ['extra apontando para variável', "Sentry.captureMessage('x', { extra: dados })"],
    ['2º argumento é variável', "Sentry.captureMessage('x', opcoes)"],
    ['spread de variável', "Sentry.captureMessage('x', { extra: { ...linha } })"],
    ['spread de 2º argumento', "Sentry.captureException(e, { ...opcoes })"],
    ['setContext com chave proibida', "Sentry.setContext('oauth', { client_id: id })"],
    ['setContext com nome proibido', "Sentry.setContext('email', { a: 1 })"],
    ['setTag com chave proibida', "Sentry.setTag('redirect_uri', u)"],
    ['setTag com chave dinâmica', "Sentry.setTag(nome, u)"],
    ['setExtra com chave proibida', "Sentry.setExtra('ip', ip)"],
  ])('o detector acusa: %s (controle)', (_n, t) => { expect(sonda(t)).not.toEqual([]) })
  it.each([
    ['extra literal com ternário e spread entre parênteses', "Sentry.captureMessage('x', { level: 'warning', tags: { tipo }, extra: { passo, ...(code ? { code } : {}) } })"],
    ['extra ternário literal', "Sentry.captureException(new Error('x'), { tags: { codigo }, extra: code ? { code } : {} })"],
    ['setTag permitido', "Sentry.setTag('component', 'oauth')"],
  ])('o detector deixa passar o que é limpo: %s (controle)', (_n, t) => { expect(sonda(t)).toEqual([]) })
})
