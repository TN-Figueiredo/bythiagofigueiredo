// @vitest-environment node
/**
 * A5 · E14, Tarefa 11 (varreduras estáticas): leem o CÓDIGO-FONTE do repositório e quebram de propósito se alguém violar uma das
 * promessas de privacidade e de acoplamento da etapa. Nada aqui chama banco, rede nem API.
 *
 * Cada varredura (1) prova que está olhando para alguma coisa (a lista de arquivos varridos não pode ser vazia: pasta que sumiu
 * não vira "verde") e (2) prova que o detector de verdade acha a violação, com um exemplo ruim embutido no teste.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const WEB = resolve(__dirname, '../../..')
const REPO = resolve(WEB, '../..')
const SRC = join(WEB, 'src')
const COMENTARIOS = join(SRC, 'lib/youtube/observatorio/comentarios')
const TAREFAS = join(SRC, 'lib/youtube/agenda/tarefas')

// ───────────────────────── arquivos ─────────────────────────
function listar(dir: string, exts: readonly string[]): string[] {
  if (!existsSync(dir)) return []
  const saida: string[] = []
  for (const nome of readdirSync(dir).sort()) {
    if (nome === 'node_modules' || nome === '.next' || nome === 'dist') continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...listar(caminho, exts))
    else if (exts.some((e) => nome.endsWith(e))) saida.push(caminho)
  }
  return saida
}
const CODIGO = ['.ts', '.tsx', '.mts', '.js', '.mjs'] as const
const rel = (f: string): string => relative(REPO, f)
const ler = (f: string): string => readFileSync(f, 'utf8')
const doComentarios = (): string[] => listar(COMENTARIOS, CODIGO)
const nome = (f: string): string => f.slice(f.lastIndexOf('/') + 1)

/** Todo o código de produção das aplicações e pacotes do monorepo (nunca teste, migration nem doc). */
function todoSrc(): string[] {
  const raizes = [SRC, join(REPO, 'apps/api/src')]
  const pacotes = join(REPO, 'packages')
  if (existsSync(pacotes)) for (const p of readdirSync(pacotes)) raizes.push(join(pacotes, p, 'src'))
  return raizes.flatMap((r) => listar(r, CODIGO))
}

// ───────────────────────── o leitor de código ─────────────────────────
interface Lido {
  /** O arquivo com os comentários trocados por espaços; as strings ficam como estão. */
  semComentarios: string
  /** Como acima, mas o miolo de toda string e template vira espaços: sobra só a estrutura do código. */
  soEstrutura: string
  /** O miolo de cada string e de cada trecho de texto de template. */
  literais: string[]
}

/**
 * Um leitor pequeno de TypeScript: separa comentário, string, template (com `${}` aninhado) e literal de regex. Basta para estas
 * varreduras; não é um parser.
 */
function ler2(src: string): Lido {
  let semC = ''
  let estr = ''
  const literais: string[] = []
  const n = src.length
  let i = 0
  // pilha dos templates abertos: em cada um, a profundidade de chaves dentro de um `${`
  const chavesDoTemplate: number[] = []
  let ultimoSignificativo = ''
  const pushCodigo = (c: string): void => { semC += c; estr += c; if (!/\s/.test(c)) ultimoSignificativo = c }

  const lerString = (aspa: string): void => {
    let miolo = ''
    semC += aspa; estr += aspa
    i++
    while (i < n && src[i] !== aspa) {
      if (src[i] === '\\') { miolo += src[i] + (src[i + 1] ?? ''); semC += src[i] + (src[i + 1] ?? ''); estr += '  '; i += 2; continue }
      if (src[i] === '\n') break
      miolo += src[i]; semC += src[i]; estr += ' '; i++
    }
    if (src[i] === aspa) { semC += aspa; estr += aspa; i++ }
    literais.push(miolo)
    ultimoSignificativo = aspa
  }
  /** Lê o texto de um template a partir do primeiro caractere depois da crase (ou depois de um `}` que fecha `${`). */
  const lerTemplate = (): void => {
    let miolo = ''
    while (i < n) {
      const c = src[i] as string
      if (c === '\\') { miolo += c + (src[i + 1] ?? ''); semC += c + (src[i + 1] ?? ''); estr += '  '; i += 2; continue }
      if (c === '`') { semC += c; estr += c; i++; literais.push(miolo); ultimoSignificativo = '`'; return }
      if (c === '$' && src[i + 1] === '{') {
        literais.push(miolo); miolo = ''
        semC += '${'; estr += '${'; i += 2
        chavesDoTemplate.push(0)
        return
      }
      miolo += c; semC += c; estr += c === '\n' ? '\n' : ' '; i++
    }
    literais.push(miolo)
  }

  while (i < n) {
    const c = src[i] as string
    const d = src[i + 1]
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { semC += ' '; estr += ' '; i++ } continue }
    if (c === '/' && d === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { const x = src[i] === '\n' ? '\n' : ' '; semC += x; estr += x; i++ }
      semC += '  '; estr += '  '; i += 2
      continue
    }
    if (c === '"' || c === "'") { lerString(c); continue }
    if (c === '`') { semC += c; estr += c; i++; lerTemplate(); continue }
    if (c === '/' && /[(,=:[!&|?{};]|^$/.test(ultimoSignificativo)) {
      // literal de regex: até a próxima `/` sem escape fora de classe
      let j = i + 1
      let classe = false
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === '[') classe = true
        else if (src[j] === ']') classe = false
        else if (src[j] === '/' && !classe) break
        j++
      }
      const corpo = src.slice(i, j + 1)
      semC += corpo; estr += ' '.repeat(corpo.length)
      i = j + 1
      while (i < n && /[a-z]/.test(src[i] as string)) { semC += src[i]; estr += ' '; i++ }
      ultimoSignificativo = '/'
      continue
    }
    if (chavesDoTemplate.length > 0) {
      const topo = chavesDoTemplate.length - 1
      if (c === '{') chavesDoTemplate[topo] = (chavesDoTemplate[topo] as number) + 1
      else if (c === '}') {
        if (chavesDoTemplate[topo] === 0) {
          chavesDoTemplate.pop()
          semC += c; estr += c; i++
          lerTemplate()
          continue
        }
        chavesDoTemplate[topo] = (chavesDoTemplate[topo] as number) - 1
      }
    }
    pushCodigo(c)
    i++
  }
  return { semComentarios: semC, soEstrutura: estr, literais }
}

/** Os argumentos (texto entre parênteses balanceados) de cada chamada a `nomeFn(`. */
function argumentosDe(src: string, nomeFn: string): string[] {
  const achados: string[] = []
  const re = new RegExp('(?<![A-Za-z0-9_$.])' + nomeFn + '\\s*\\(', 'g')
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    let prof = 1
    let j = m.index + m[0].length
    const ini = j
    while (j < src.length && prof > 0) {
      if (src[j] === '(') prof++
      else if (src[j] === ')') prof--
      j++
    }
    achados.push(src.slice(ini, j - 1))
  }
  return achados
}

// ───────────────────────── os próprios detectores ─────────────────────────
describe('o leitor de código das varreduras (se ele cegar, todas as outras ficam verdes à toa)', () => {
  it('tira comentário, guarda string, entende template com ${} e não confunde regex com comentário', () => {
    const exemplo = [
      "const a = 'console.log(1)' // console.log(2)",
      '/* console.log(3) */ const b = `x ${f("y // z")} w`',
      "const r = /['\"]\\/\\/x/.test(a) // console.log(4)",
      'const c = a / b // não é regex',
      "console.warn('de verdade')",
    ].join('\n')
    const l = ler2(exemplo)
    expect(l.semComentarios).not.toContain('console.log(2)')
    expect(l.semComentarios).not.toContain('console.log(3)')
    expect(l.semComentarios).not.toContain('console.log(4)')
    expect(l.semComentarios).toContain("'console.log(1)'")
    expect(l.soEstrutura).not.toContain('console.log(1)')
    expect(l.soEstrutura).toContain('console.warn(')
    expect(l.literais).toEqual(expect.arrayContaining(['console.log(1)', 'x ', ' w', 'y // z', 'de verdade']))
  })
  it('acha o argumento de uma chamada com parênteses dentro', () => {
    expect(argumentosDe('x = runAnularIdentidade({ sb: f(c.sb), now: g() }) ; y.anular(a, b)', 'runAnularIdentidade')).toEqual(['{ sb: f(c.sb), now: g() }'])
    expect(argumentosDe('anular(sb, ctx.siteId)', 'anular')).toEqual(['sb, ctx.siteId'])
    expect(argumentosDe('const r = x.anular(a, b)', 'anular')).toEqual([])
  })
})


// ───────────────────────── os detectores (usados pelas varreduras E provados com exemplo ruim) ─────────────────────────
const DET = {
  console: (src: string): boolean => /\bconsole\s*\./.test(ler2(src).soEstrutura),
  zod: (src: string): boolean => /(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"]zod(?:\/[^'"]*)?['"]/.test(ler2(src).semComentarios),
  sentry: (src: string): boolean => /(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"]@sentry\//.test(ler2(src).semComentarios),
  abortTimeout: (src: string): boolean => /\bAbortSignal\s*\.\s*timeout\b/.test(ler2(src).soEstrutura),
  excecaoEmTexto: (src: string): boolean => {
    const s = ler2(src).semComentarios
    return /\$\{\s*(e|err|error|erro)\s*\}/.test(s) || /String\(\s*(e|err|error|erro)\s*\)/.test(s) || /JSON\.stringify\(\s*(e|err|error|erro)\b/.test(s)
      || /(['"`])\s*\+\s*(e|err|error|erro)\s*[;,)\]]/.test(s)
  },
  idaSemTempo: (src: string): boolean => /\.\s*rpc\s*\(|\.\s*from\s*\(\s*['"`]/.test(ler2(src).soEstrutura),
  ctxSiteId: (src: string): boolean => /\bctx\.siteId\b/.test(ler2(src).semComentarios),
}

describe('os detectores das varreduras acham a violação (cada um com um exemplo ruim e um bom)', () => {
  it('console, zod, sentry, AbortSignal.timeout, exceção em texto, ida ao banco sem comTempo, ctx.siteId', () => {
    expect(DET.console("function f() { console.log('x') }")).toBe(true)
    expect(DET.console("// console.log('x')\nconst a = 'console.log'")).toBe(false)
    expect(DET.zod("import { z } from 'zod'")).toBe(true)
    expect(DET.zod("import { z } from \"zod/v4\"")).toBe(true)
    expect(DET.zod("// import zod from 'zod'")).toBe(false)
    expect(DET.sentry("import * as Sentry from '@sentry/nextjs'")).toBe(true)
    expect(DET.sentry("const { captureException } = require('@sentry/node')")).toBe(true)
    expect(DET.sentry("// import * as S from '@sentry/nextjs'")).toBe(false)
    expect(DET.abortTimeout('fetch(u, { signal: AbortSignal.timeout(5) })')).toBe(true)
    expect(DET.abortTimeout("const nota = 'AbortSignal.timeout'")).toBe(false)
    expect(DET.excecaoEmTexto('throw new Error(`falhou ${e}`)')).toBe(true)
    expect(DET.excecaoEmTexto('x = String(err)')).toBe(true)
    expect(DET.excecaoEmTexto("x = 'falhou: ' + e;")).toBe(true)
    expect(DET.excecaoEmTexto('x = codigoDe(e)')).toBe(false)
    expect(DET.idaSemTempo("await sb.rpc('f', {})")).toBe(true)
    expect(DET.idaSemTempo("await sb.from('t').select('*')")).toBe(true)
    expect(DET.idaSemTempo('Array.from(x)')).toBe(false)
    expect(DET.ctxSiteId('const s = ctx.siteId ?? null')).toBe(true)
    expect(DET.ctxSiteId('// ctx.siteId')).toBe(false)
  })
})

// ───────────────────────── 1 e 2: onde as tabelas podem ser citadas ─────────────────────────
describe('varredura 1: nada do pipeline, da forja nem do pack cita comentário (item 119)', () => {
  const dirs = [
    join(SRC, 'app/api/pipeline'), join(SRC, 'lib/pipeline'), join(SRC, 'lib/youtube/observatorio/forja'), join(WEB, 'data/pipeline-docs'),
  ]
  const arquivos = (): string[] => [
    ...dirs.flatMap((d) => listar(d, ['.ts', '.tsx', '.md', '.json', '.mjs'])),
    ...[...listar(SRC, ['pack.ts']), ...listar(SRC, ['pack.tsx'])],
  ]
  it('as pastas existem e há arquivos para varrer (pasta que some não vira verde)', () => {
    for (const d of dirs) expect(existsSync(d), rel(d)).toBe(true)
    expect(arquivos().length).toBeGreaterThan(30)
    expect(arquivos().some((f) => nome(f) === 'pack.ts')).toBe(true)
  })
  it('nenhum deles cita competitor_video_comment (nem snaps, nem authors, nem marks)', () => {
    const culpados = arquivos().filter((f) => /competitor_video_comment/i.test(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
})

describe('varredura 2: competitor_video_comment_authors só é citada dentro de comentarios/ (item 127)', () => {
  it('há código de produção para varrer, e a tabela é citada por gravar.ts (o detector enxerga)', () => {
    expect(todoSrc().length).toBeGreaterThan(500)
    expect(/competitor_video_comments/.test(ler(join(COMENTARIOS, 'gravar.ts')))).toBe(true)
  })
  it('nenhum arquivo de fora cita a tabela de identidade: nenhum export, nenhum leitor de tela', () => {
    const culpados = todoSrc().filter((f) => !f.startsWith(COMENTARIOS + '/') && /competitor_video_comment_authors/.test(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
  it('nem os tipos gerados do banco, nem o espelho de tipos, a conhecem (ninguém lê a identidade por tipo)', () => {
    const culpados = todoSrc().filter((f) => /database\.types|typed/.test(nome(f)) && /competitor_video_comment_authors/.test(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
})

// ───────────────────────── 3: console, zod, Sentry ─────────────────────────
describe('varredura 3: comentarios/ não tem console., não importa zod, e só relato.ts importa @sentry/nextjs', () => {
  it('há arquivos varridos, incluindo os que esta etapa criou', () => {
    const nomes = doComentarios().map(nome)
    expect(nomes).toEqual(expect.arrayContaining(['api.ts', 'coletar.ts', 'gravar.ts', 'anular.ts', 'relato.ts', 'frases.ts', 'erro.ts']))
  })
  it('nenhum console. no código (fora de comentário e de string)', () => {
    const culpados = doComentarios().filter((f) => DET.console(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
  it('nenhum import de zod (nem require, nem import dinâmico)', () => {
    const culpados = doComentarios().filter((f) => DET.zod(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
  it('só relato.ts importa @sentry (qualquer pacote @sentry/*), e relato.ts de fato o importa', () => {
    const importa = (f: string): boolean => DET.sentry(ler(f))
    expect(doComentarios().filter(importa).map(nome)).toEqual(['relato.ts'])
  })
  it('as duas tarefas da agenda só falam com o Sentry por relato.ts (nenhum import direto)', () => {
    const tarefas = ['anular-identidade.ts', 'retratos-comentarios.ts'].map((n) => join(TAREFAS, n))
    for (const t of tarefas) {
      expect(existsSync(t), rel(t)).toBe(true)
      expect(DET.sentry(ler(t)) || /['"]@sentry\//.test(ler2(ler(t)).semComentarios), rel(t)).toBe(false)
    }
  })
  it('o único Sentry.* de relato.ts é captureMessage, e nele só entram o código limpo e números', () => {
    const rel8 = ler2(ler(join(COMENTARIOS, 'relato.ts'))).soEstrutura
    const usos = [...rel8.matchAll(/Sentry\.(\w+)/g)].map((m) => m[1])
    expect(usos).toEqual(['captureMessage'])
  })
  it('nenhum arquivo de comentarios/ manda exceção ou texto do banco adiante: .message, .details e .hint só onde são lidos para classificar', () => {
    const usos: Array<[string, string]> = []
    for (const f of doComentarios()) {
      const lido = ler2(ler(f))
      const linhasReais = lido.semComentarios.split('\n')
      lido.soEstrutura.split('\n').forEach((linha, k) => {
        if (/\.(message|details|hint|stack|cause)\b/.test(linha)) usos.push([nome(f), (linhasReais[k] ?? '').trim()])
      })
    }
    // erro.ts lê a mensagem para reconhecer AbortError; gravar.ts confere que é string. Ninguém repassa.
    expect(usos).toEqual([
      ['erro.ts', 'const mensagem = err.message'],
      ['gravar.ts', "if (typeof err === 'object' && err !== null && !(err instanceof Error) && typeof (err as { message?: unknown }).message === 'string') {"],
    ])
  })
  it('nenhum arquivo monta texto com uma exceção: sem ${e}, ${err}, String(e), String(err), e + \'\' nem JSON.stringify de erro', () => {
    const culpados = doComentarios().filter((f) => DET.excecaoEmTexto(ler(f))).map(rel)
    expect(culpados).toEqual([])
  })
  it('AbortSignal.timeout só em api.ts (uso legítimo em fetch); no banco o tempo é AbortController + setTimeout (a regra é sobre rpc)', () => {
    const usa = (f: string): boolean => DET.abortTimeout(ler(f))
    expect(doComentarios().filter(usa).map(nome)).toEqual(['api.ts'])
    // e o uso de api.ts é um fetch, não um rpc
    const api = ler2(ler(join(COMENTARIOS, 'api.ts'))).soEstrutura
    expect(/fetchImpl\([^)]*AbortSignal\.timeout/.test(api)).toBe(true)
    expect(/\.rpc\s*\(/.test(api)).toBe(false)
    // as tarefas da agenda também não
    for (const n of ['anular-identidade.ts', 'retratos-comentarios.ts']) expect(usa(join(TAREFAS, n)), n).toBe(false)
  })
  it('toda ida ao banco de comentarios/ passa por comTempo: nenhum .rpc( nem .from( fora de gravar.ts e de dentro de comTempo', () => {
    for (const f of doComentarios().filter((x) => nome(x) !== 'gravar.ts')) {
      expect(DET.idaSemTempo(ler(f)), rel(f)).toBe(false)
    }
    // em gravar.ts, cada .rpc( e .from( está dentro de uma chamada comTempo(
    const g = ler2(ler(join(COMENTARIOS, 'gravar.ts'))).soEstrutura
    const dentro = argumentosDe(g, 'comTempo').join('\n')
    const RE_IDA = /\.\s*rpc\s*\(|\.\s*from\s*\(\s*['"`]/g
    const todos = [...g.matchAll(RE_IDA)].length
    const emTempo = [...dentro.matchAll(RE_IDA)].length
    expect(todos).toBeGreaterThan(5)
    expect(emTempo).toBe(todos)
  })
})

// ───────────────────────── 4: id de comentário nunca na URL do banco ─────────────────────────
describe('varredura 4: id de comentário do YouTube nunca vai para a URL do banco', () => {
  const RE = /\.\s*(in|eq|neq|filter|match|like|ilike|or|is|contains|overlaps)\s*\(\s*(['"`])[^'"`]*youtube_comment_id/
  it('o detector acha a violação (exemplos ruins)', () => {
    for (const ruim of [".in('youtube_comment_id', ids)", '.eq("youtube_comment_id", id)', ".eq(\n 'youtube_comment_id',", ".or('youtube_comment_id.eq.x')"]) {
      expect(RE.test(ruim), ruim).toBe(true)
    }
    expect(RE.test(".eq('video_id', v)")).toBe(false)
  })
  it('nenhum arquivo de src/ filtra por youtube_comment_id (varridos: todo o código de produção)', () => {
    const arquivos = todoSrc()
    expect(arquivos.length).toBeGreaterThan(500)
    const culpados = arquivos.filter((f) => RE.test(ler2(ler(f)).semComentarios)).map(rel)
    expect(culpados).toEqual([])
  })
  it('o filtro do banco por comentário é sempre o uuid/bigint nosso: lerGuardados filtra por video_id', () => {
    const g = ler2(ler(join(COMENTARIOS, 'gravar.ts'))).semComentarios
    expect(/\.eq\(\s*'video_id'/.test(g)).toBe(true)
  })
})

// ───────────────────────── 5: sem token OAuth ─────────────────────────
describe('varredura 5: o passo só usa a chave de API, nunca um token OAuth', () => {
  const PROIBIDOS = /obterToken|ensureFreshToken|youtube-token|oauth/i
  const arquivos = (): string[] => [
    ...doComentarios(), ...['anular-identidade.ts', 'retratos-comentarios.ts'].map((n) => join(TAREFAS, n)),
  ]
  it('o detector acha os quatro nomes', () => {
    for (const ruim of ["import { obterToken } from 'x'", 'await ensureFreshToken(c)', "from '@/lib/youtube-token'", "const x = 'OAuth2'"]) {
      expect(PROIBIDOS.test(ruim), ruim).toBe(true)
    }
  })
  it('as tarefas existem e há arquivos para varrer', () => {
    expect(arquivos().length).toBeGreaterThan(14)
    for (const t of arquivos().filter((f) => f.startsWith(TAREFAS))) expect(existsSync(t), rel(t)).toBe(true)
  })
  it('nenhum deles (nem os imports, nem o código, nem as strings) cita token OAuth', () => {
    const culpados = arquivos().filter((f) => PROIBIDOS.test(ler2(ler(f)).semComentarios)).map(rel)
    expect(culpados).toEqual([])
  })
  it('a chave é a de API: api.ts a recebe como apiKey e a põe em ?key=, sem cabeçalho Authorization', () => {
    const api = ler2(ler(join(COMENTARIOS, 'api.ts'))).semComentarios
    expect(/&key=\$\{encodeURIComponent\(o\.apiKey\)\}/.test(api)).toBe(true)
    expect(/authorization|bearer/i.test(api)).toBe(false)
  })
})

// ───────────────────────── 6: o texto do dono só em frases.ts; error_reason só por catálogo ─────────────────────────
describe('varredura 6: só frases.ts tem texto em português para o dono, e error_reason nunca é montado com texto', () => {
  const foraDeFrases = (): string[] => doComentarios().filter((f) => nome(f) !== 'frases.ts')
  const ACENTO = /[À-ÖØ-öø-ÿ]/
  it('o detector acha string com acento e a frase de comentários', () => {
    expect(ler2("const x = 'não'").literais.some((l) => ACENTO.test(l))).toBe(true)
    expect(ler2('const x = `${n} retratos`' + " // 'não'").literais.some((l) => ACENTO.test(l))).toBe(false)
    expect(ler2("const x = 'ação'").literais.some((l) => ACENTO.test(l))).toBe(true)
  })
  it('nenhum outro arquivo de comentarios/ tem o prefixo "comentários:" em texto', () => {
    const culpados = foraDeFrases().filter((f) => ler2(ler(f)).literais.some((l) => /coment[aá]rios\s*:/i.test(l) && ACENTO.test(l))).map(rel)
    expect(culpados).toEqual([])
  })
  it('nenhum outro arquivo de comentarios/ tem letra acentuada em literal de texto (frase de dono fora de frases.ts)', () => {
    const achados = foraDeFrases().flatMap((f) => ler2(ler(f)).literais.filter((l) => ACENTO.test(l)).map((l) => nome(f) + ': ' + l.slice(0, 60)))
    expect(achados).toEqual([])
  })
  it('nenhuma frase de FRASES_FIXAS aparece fora de frases.ts (sequer um pedaço de 25 caracteres)', async () => {
    const { FRASES_FIXAS } = await import('@/lib/youtube/observatorio/comentarios/frases')
    const frases = Object.values(FRASES_FIXAS)
    expect(frases.length).toBeGreaterThanOrEqual(18)
    const codigoDeFora = [...foraDeFrases(), ...['anular-identidade.ts', 'retratos-comentarios.ts'].map((n) => join(TAREFAS, n))].map((f) => [f, ler(f)] as const)
    const achados: string[] = []
    for (const [f, texto] of codigoDeFora) {
      for (const fr of frases) if (texto.includes(fr.slice(0, 25))) achados.push(rel(f) + ' <- ' + fr.slice(0, 25))
    }
    expect(achados).toEqual([])
  })
  it('error_reason nunca é montado com template nem com concatenação, fora de erro.ts', () => {
    const RUIM = /error_reason\s*:\s*(`|[^,}\n]*\+)/
    expect(RUIM.test('error_reason: `x ${y}`')).toBe(true)
    expect(RUIM.test("error_reason: 'a' + e")).toBe(true)
    expect(RUIM.test('error_reason: erroMotivo,')).toBe(false)
    const culpados = doComentarios().filter((f) => nome(f) !== 'erro.ts' && RUIM.test(ler2(ler(f)).semComentarios)).map(rel)
    expect(culpados).toEqual([])
  })
  it("'banco:' + só em erro.ts; e nenhum arquivo de comentarios/ grava um código com dois-pontos em error_reason: o motivo vem de MOTIVOS", () => {
    const culpados = doComentarios().filter((f) => nome(f) !== 'erro.ts' && /['"`]banco:['"`]?\s*\+|`banco:\$\{/.test(ler2(ler(f)).semComentarios)).map(rel)
    expect(culpados).toEqual([])
    // o motivo gravado só sai de lista fechada: coletar.ts filtra por ehMotivo e cai num motivo fixo; montarPacote exige MOTIVOS
    const coletar = ler2(ler(join(COMENTARIOS, 'coletar.ts'))).semComentarios
    expect(/sit\.motivo = ehMotivo\(codigo\) \? codigo : fallback/.test(coletar)).toBe(true)
    expect(/\(MOTIVOS as readonly string\[\]\)\.includes\(p\.motivo\)/.test(ler2(ler(join(COMENTARIOS, 'gravar.ts'))).semComentarios)).toBe(true)
  })
  it('o catálogo de motivos não tem dois-pontos nem maiúscula (é o que o check do banco aceita: ^[a-z0-9_]{1,40}$)', async () => {
    const { MOTIVOS } = await import('@/lib/youtube/observatorio/comentarios/regras')
    for (const m of MOTIVOS) expect(m).toMatch(/^[a-z0-9_]{1,40}$/)
  })
})

// ───────────────────────── 7: produção não passa o que é só de teste ─────────────────────────
describe('varredura 7: em produção a lista, a prova e a rotina valem para todos os sites e a API é a do YouTube', () => {
  const CHAMADORES_TESTE = /\b(siteId|apiBase|fetchImpl)\b/
  /** Quem importa as entradas da etapa a partir de fora de comentarios/. */
  const chamadores = (): string[] => todoSrc().filter((f) => {
    if (f.startsWith(COMENTARIOS + '/')) return false
    return /observatorio\/comentarios\/(coletar|anular|gravar)['"]/.test(ler2(ler(f)).semComentarios)
  })
  it('os dois adaptadores da agenda chamam as entradas (o detector enxerga as chamadas)', () => {
    const c = chamadores().map((f) => nome(f))
    expect(c).toEqual(expect.arrayContaining(['anular-identidade.ts', 'retratos-comentarios.ts']))
    const r = ler2(ler(join(TAREFAS, 'retratos-comentarios.ts'))).semComentarios
    expect(argumentosDe(r, 'runRetratosComentarios')).toHaveLength(1)
    expect(argumentosDe(ler2(ler(join(TAREFAS, 'anular-identidade.ts'))).semComentarios, 'runAnularIdentidade')).toHaveLength(1)
  })
  it('nenhum chamador passa siteId, apiBase nem fetchImpl ao contexto da coleta ou da rotina', () => {
    const culpados: string[] = []
    for (const f of chamadores()) {
      const s = ler2(ler(f)).semComentarios
      for (const fn of ['runRetratosComentarios', 'runAnularIdentidade']) {
        for (const arg of argumentosDe(s, fn)) if (CHAMADORES_TESTE.test(arg)) culpados.push(rel(f) + ' ' + fn + '(' + arg.slice(0, 80) + ')')
      }
    }
    expect(culpados).toEqual([])
  })
  it('nenhum chamador passa o segundo argumento de anular() (o filtro de site é de teste)', () => {
    const culpados: string[] = []
    for (const f of chamadores()) {
      for (const arg of argumentosDe(ler2(ler(f)).semComentarios, 'anular')) {
        // o segundo argumento existe se há uma vírgula no nível zero dos parênteses
        let prof = 0
        for (const ch of arg) {
          if ('({['.includes(ch)) prof++
          else if (')}]'.includes(ch)) prof--
          else if (ch === ',' && prof === 0) { culpados.push(rel(f) + ' anular(' + arg.slice(0, 60) + ')'); break }
        }
      }
    }
    expect(culpados).toEqual([])
  })
  it('nenhum chamador monta o contexto da coleta com siteId: o objeto passado tem só os campos de produção', () => {
    const r = ler2(ler(join(TAREFAS, 'retratos-comentarios.ts'))).semComentarios
    const arg = argumentosDe(r, 'runRetratosComentarios')[0] as string
    const chaves = [...arg.matchAll(/(?:^|[{,])\s*(\w+)\s*:/g)].map((m) => m[1])
    expect(chaves.sort()).toEqual(['apiKey', 'inicioMs', 'now', 'sb', 't0'])
    const a = ler2(ler(join(TAREFAS, 'anular-identidade.ts'))).semComentarios
    const chavesA = [...(argumentosDe(a, 'runAnularIdentidade')[0] as string).matchAll(/(?:^|[{,])\s*(\w+)\s*:/g)].map((m) => m[1])
    expect(chavesA.sort()).toEqual(['now', 'sb'])
  })
  it('dentro de comentarios/, só anular.ts repassa ctx.siteId a anular() e só coletar.ts o põe nas chamadas; api.ts usa o padrão do YouTube', () => {
    const api = ler2(ler(join(COMENTARIOS, 'api.ts'))).semComentarios
    expect(/const BASE_PADRAO = 'https:\/\/www\.googleapis\.com\/youtube\/v3'/.test(api)).toBe(true)
    const usaSiteIdNoCtx = doComentarios().filter((f) => DET.ctxSiteId(ler(f))).map(nome)
    expect(usaSiteIdNoCtx.sort()).toEqual(['anular.ts', 'coletar.ts'])
  })
})
