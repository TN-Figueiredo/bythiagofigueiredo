// @vitest-environment node
// Varredura do código-fonte: o dado privado do canal próprio só se lê depois da guarda de edição.
// Nenhum arquivo fora do módulo da guarda constrói o token, pede a prova de edição ou chama os leitores.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = join(__dirname, '../../../src')
const EDICAO = 'lib/youtube/observatorio/proprio/edicao.ts'
const LER = 'lib/youtube/observatorio/proprio/ler.ts'
/** O leitor da curva de retenção (A5 E8, Tarefa 12b): o único arquivo fora da coleta que consulta `yt_own_video_retention`. */
const LER_RETENCAO = 'lib/youtube/observatorio/proprio/ler-retencao.ts'
/** A coleta ESCREVE a curva (service role, passo `retencao`); a leitura da tela é só do leitor acima. */
const COLETA_DIR = 'lib/youtube/coleta/'
const DADOS = 'app/cms/(authed)/youtube/competitors/_proprio/dados.ts'
/** A prova de tipo do token (compilada pelo tsc do web, nunca executada): o único outro arquivo que nomeia a classe como valor. */
const TIPOS = 'lib/youtube/observatorio/proprio/edicao.type-test.ts'
/** Usos do token como VALOR (a classe em si), que o brand check de edicao.ts não pode deixar de cobrir: estender, protótipo, construção reflexiva, typeof, instanceof. */
const USO_COMO_VALOR = /\bextends\s+EdicaoDoSite\b|\bEdicaoDoSite\s*\.\s*(prototype|ehEdicao)\b|\bReflect\s*\.\s*construct\s*\([^)]*\bEdicaoDoSite\b|\bObject\s*\.\s*create\s*\([^)]*\bEdicaoDoSite\b|\btypeof\s+EdicaoDoSite\b|\binstanceof\s+EdicaoDoSite\b/
/** `import { EdicaoDoSite }` sem `type` traz a classe como valor. */
const importaComoValor = (s: string) =>
  [...s.matchAll(/import\s*(?!type\b)\{([^}]*)\}\s*from\s*['"][^'"]*proprio\/edicao['"]/g)].some(m => m[1]!.split(',').some(n => /^\s*EdicaoDoSite\b/.test(n)))
const importaNamespace = (s: string) => /import\s*\*\s*as\s+\w+\s+from\s*['"][^'"]*proprio\/edicao['"]|import\s*\(\s*['"][^'"]*proprio\/edicao['"]\s*\)|require\s*\(\s*['"][^'"]*proprio\/edicao['"]\s*\)/.test(s)
/** O token de LEITURA do desempenho privado (E17 passo 0) e a prova de tipo dele. */
const LEITURA = 'lib/youtube/observatorio/proprio/leitura-privada.ts'
const TIPOS_LEITURA = 'lib/youtube/observatorio/proprio/leitura-privada.type-test.ts'
const USO_LEITURA_COMO_VALOR = /\bextends\s+LeituraPrivadaDoSite\b|\bLeituraPrivadaDoSite\s*\.\s*(prototype|ehLeitura)\b|\bReflect\s*\.\s*construct\s*\([^)]*\bLeituraPrivadaDoSite\b|\bObject\s*\.\s*create\s*\([^)]*\bLeituraPrivadaDoSite\b|\btypeof\s+LeituraPrivadaDoSite\b|\binstanceof\s+LeituraPrivadaDoSite\b/
const importaLeituraComoValor = (s: string) =>
  [...s.matchAll(/import\s*(?!type\b)\{([^}]*)\}\s*from\s*['"][^'"]*proprio\/leitura-privada['"]/g)].some(m => m[1]!.split(',').some(n => /^\s*LeituraPrivadaDoSite\b/.test(n)))
const importaLeituraNamespace = (s: string) => /import\s*\*\s*as\s+\w+\s+from\s*['"][^'"]*proprio\/leitura-privada['"]|import\s*\(\s*['"][^'"]*proprio\/leitura-privada['"]\s*\)|require\s*\(\s*['"][^'"]*proprio\/leitura-privada['"]\s*\)/.test(s)
/** Quem pode pedir a prova de edição e chamar os leitores: o módulo da guarda. */
const PODE_PROVAR = new Set([EDICAO, DADOS, LEITURA])
const PODE_LER = new Set([LER, LER_RETENCAO, DADOS])

function arquivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) arquivos(p, out)
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
/** Tira comentários e deixa as strings: o que sobra é o que o compilador vê. */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const cliente = (src: string) => /^\s*(['"])use client\1/.test(semComentarios(src))

export function violacoes(fontes: Record<string, string>): string[] {
  const v: string[] = []
  for (const [arq, bruto] of Object.entries(fontes)) {
    const s = semComentarios(bruto)
    if (arq !== EDICAO && arq !== TIPOS && /\bnew\s+EdicaoDoSite\b|\bEdicaoDoSite\.provar\b/.test(s)) v.push(`${arq}: constrói o token de edição`)
    if (arq !== EDICAO && arq !== TIPOS && USO_COMO_VALOR.test(s)) v.push(`${arq}: usa a classe do token como valor (estender, protótipo, Reflect.construct, Object.create, typeof, instanceof)`)
    if (arq !== EDICAO && arq !== TIPOS && importaComoValor(s)) v.push(`${arq}: importa a classe do token como valor (só \`import type\`)`)
    if (arq !== EDICAO && arq !== TIPOS && importaNamespace(s)) v.push(`${arq}: importa o módulo do token por namespace ou dinâmico`)
    if (arq !== TIPOS && /edicao\.type-test['"]/.test(s)) v.push(`${arq}: importa a prova de tipo (ela não roda)`)
    if (!PODE_PROVAR.has(arq) && /\bprovarEdicao\s*\(/.test(s)) v.push(`${arq}: pede a prova de edição fora do módulo da guarda`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && /\bnew\s+LeituraPrivadaDoSite\b|\bLeituraPrivadaDoSite\.provar\b/.test(s)) v.push(`${arq}: constrói o token de leitura`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && USO_LEITURA_COMO_VALOR.test(s)) v.push(`${arq}: usa a classe do token de leitura como valor (estender, protótipo, Reflect.construct, Object.create, typeof, instanceof)`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && importaLeituraComoValor(s)) v.push(`${arq}: importa a classe do token de leitura como valor (só \`import type\`)`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && importaLeituraNamespace(s)) v.push(`${arq}: importa o módulo do token de leitura por namespace ou dinâmico`)
    if (arq !== TIPOS_LEITURA && /leitura-privada\.type-test['"]/.test(s)) v.push(`${arq}: importa a prova de tipo da leitura (ela não roda)`)
    if (arq !== LEITURA && arq !== DADOS && /\b(provarAcessoPrivado|provarLeituraPrivada)\s*\(/.test(s)) v.push(`${arq}: pede a prova de leitura privada fora do módulo da guarda`)
    if (arq !== LEITURA && /can_view_private_site_as/.test(s)) v.push(`${arq}: cita a função do direito fora do módulo da leitura privada`)
    if (cliente(bruto) && /from\s+['"][^'"]*proprio\/leitura-privada['"]/.test(s)) v.push(`${arq}: componente cliente importa o módulo da leitura privada`)
    if (!PODE_LER.has(arq) && /\b(lerAlcance|lerDiario|lerRetencao)\s*\(/.test(s)) v.push(`${arq}: chama um leitor do dado privado`)
    if (!PODE_LER.has(arq) && /from\s+['"][^'"]*proprio\/ler(-retencao)?['"]/.test(s)) v.push(`${arq}: importa os leitores do dado privado`)
    if (cliente(bruto) && /from\s+['"][^'"]*(proprio\/ler|proprio\/ler-retencao|proprio\/edicao|_proprio\/dados)['"]/.test(s)) v.push(`${arq}: componente cliente importa o módulo do dado privado`)
    if (arq !== LER_RETENCAO && !arq.startsWith(COLETA_DIR) && /yt_own_video_retention/.test(s)) v.push(`${arq}: consulta a tabela da curva de retenção fora do leitor`)
    if ((arq === LER || arq === DADOS) && /\bpodeEditar\b/.test(s)) v.push(`${arq}: volta a usar um booleano no lugar do token`)
  }
  return v
}

const reais: Record<string, string> = {}
for (const p of arquivos(SRC)) reais[relative(SRC, p).split(sep).join('/')] = readFileSync(p, 'utf8')

describe('varredura: o dado privado do canal próprio', () => {
  it('o código real não viola nenhuma regra', () => {
    expect(violacoes(reais)).toEqual([])
  })
  it('a varredura enxerga os arquivos do módulo (não passa por varrer uma pasta errada)', () => {
    for (const a of [EDICAO, LER, LER_RETENCAO, DADOS]) expect(Object.keys(reais), a).toContain(a)
    expect(Object.keys(reais).length).toBeGreaterThan(300)
  })
  it('a prova de tipo do token está no tsc do web: 3 diretivas, uma única função exportada, nada fora dela', () => {
    expect(Object.keys(reais)).toContain(TIPOS)
    const bruto = reais[TIPOS]!
    expect(bruto.match(/^\s*\/\/ @ts-expect-error/gm)).toHaveLength(3)
    const s = semComentarios(bruto)
    expect(s.match(/^export\b/gm)).toEqual(['export'])
    expect(s).toMatch(/^export function provasDeTipo\(\): void \{/m)
    // nada de statement no topo além do import e da função (nenhuma chamada, nenhum new fora da função)
    const fora = s.replace(/^export function provasDeTipo\(\): void \{[\s\S]*\n\}\s*$/m, '').replace(/^import .*$/gm, '').trim()
    expect(fora).toBe('')
  })
  it('a prova de tipo do token de leitura está no tsc do web: 5 diretivas, uma única função exportada, nada fora dela', () => {
    expect(Object.keys(reais)).toContain(TIPOS_LEITURA)
    const bruto = reais[TIPOS_LEITURA]!
    expect(bruto.match(/^\s*\/\/ @ts-expect-error/gm)).toHaveLength(5)
    const s = semComentarios(bruto)
    expect(s.match(/^export\b/gm)).toEqual(['export'])
    expect(s).toMatch(/^export function provasDeTipo\(/m)
    const fora = s.replace(/^export function provasDeTipo\([\s\S]*\n\}\s*$/m, '').replace(/^import .*$/gm, '').trim()
    expect(fora).toBe('')
  })
  it('a leitura privada pede a guarda com mode "view" e nunca "edit" (quem pede edição é edicao.ts)', () => {
    expect(Object.keys(reais)).toContain(LEITURA)
    const s = semComentarios(reais[LEITURA]!)
    expect(s).toMatch(/requireSiteScope\(\s*\{[^}]*mode:\s*'view'/)
    expect(s).not.toMatch(/mode:\s*'edit'/)
  })
  it('a prova de edição pede a guarda com mode "edit" e nenhum outro', () => {
    const s = semComentarios(reais[EDICAO]!)
    expect(s).toMatch(/requireSiteScope\(\s*\{[^}]*mode:\s*'edit'/)
    expect(s).not.toMatch(/mode:\s*'view'/)
  })
  it('só o leitor da retenção consulta yt_own_video_retention fora da coleta (que a escreve)', () => {
    const donos = Object.entries(reais).filter(([, f]) => /yt_own_video_retention/.test(semComentarios(f))).map(([a]) => a)
    expect(donos.filter(a => !a.startsWith(COLETA_DIR))).toEqual([LER_RETENCAO])
    // a coleta é o único outro dono, e só dentro da pasta da coleta
    expect(donos.filter(a => a.startsWith(COLETA_DIR)).length).toBeGreaterThan(0)
  })
  it('só os leitores e o módulo de dados falam com as duas tabelas privadas', () => {
    const donos = Object.entries(reais).filter(([, s]) => /yt_own_video_daily|yt_own_video_reach_daily/.test(semComentarios(s))).map(([a]) => a)
    // as migrations e a coleta (escrita) vivem em outros lugares; aqui só se confere que nenhuma tela lê as tabelas direto
    const telas = donos.filter(a => a.startsWith('app/') && a !== DADOS)
    expect(telas).toEqual([])
  })
  describe('controles negativos: a varredura pega o que deve pegar', () => {
    const base = { [EDICAO]: '', [LER]: '', [DADOS]: '' }
    it('chamar um leitor fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerDiario(sb, p)' })).toEqual(['app/x/page.tsx: chama um leitor do dado privado'])
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerAlcance(sb, p)' })).toHaveLength(1)
    })
    it('retenção: chamar o leitor da curva, importá-lo ou consultar a tabela fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerRetencao(sb, p)' })).toEqual(['app/x/page.tsx: chama um leitor do dado privado'])
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerRetencao } from '@/lib/youtube/observatorio/proprio/ler-retencao'" })).toEqual(['app/x/a.ts: importa os leitores do dado privado'])
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport { x } from '@/lib/youtube/observatorio/proprio/ler-retencao'" })).toEqual(['app/x/c.tsx: importa os leitores do dado privado', 'app/x/c.tsx: componente cliente importa o módulo do dado privado'])
      expect(violacoes({ ...base, 'app/x/a.ts': "sb.from('yt_own_video_retention').select('points')" })).toEqual(['app/x/a.ts: consulta a tabela da curva de retenção fora do leitor'])
      expect(violacoes({ ...base, 'lib/youtube/observatorio/outro.ts': "sb.from('yt_own_video_retention')" })).toHaveLength(1)
    })
    it('retenção: o leitor e a coleta podem (não se acusam)', () => {
      expect(violacoes({ ...base, [LER_RETENCAO]: "sb.from('yt_own_video_retention'); export async function lerRetencao(sb: X) {}", 'lib/youtube/coleta/retencao-step.ts': "ctx.supabase.from('yt_own_video_retention').upsert(x)", [DADOS]: 'await lerRetencao(sb, p)' })).toEqual([])
    })
    it('fabricar o token', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = new EdicaoDoSite("s")' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = await EdicaoDoSite.provar("s")' })).toHaveLength(1)
    })
    it('pedir a prova de edição fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = await provarEdicao(siteId)' })).toHaveLength(1)
    })
    it('importar o leitor, ou o módulo do dado privado num componente cliente', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerDiario } from '@/lib/youtube/observatorio/proprio/ler'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport { x } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
    })
    it('usar a classe do token como valor fora de edicao.ts: estender, protótipo, Reflect.construct, Object.create, typeof, instanceof', () => {
      for (const codigo of [
        'class F extends EdicaoDoSite {}',
        'Object.create(EdicaoDoSite.prototype, { siteId: { value: "s" } })',
        'Reflect.construct(EdicaoDoSite, ["s"])',
        'Object.create(EdicaoDoSite)',
        'const k = typeof EdicaoDoSite',
        'if (x instanceof EdicaoDoSite) {}',
        'EdicaoDoSite.ehEdicao(x)',
      ]) expect(violacoes({ ...base, 'app/x/a.ts': codigo }), codigo).toHaveLength(1)
      // como TIPO é permitido
      expect(violacoes({ ...base, 'app/x/a.ts': "import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'\nconst f = (e: EdicaoDoSite | null): Promise<EdicaoDoSite | null> => Promise.resolve(e)" })).toEqual([])
      expect(violacoes({ ...base, 'app/x/a.ts': "import { edicaoValida, type EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toEqual([])
    })
    it('importar a classe como valor, ou o módulo por namespace ou dinâmico', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provarEdicao, EdicaoDoSite } from './proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import * as E from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "const m = await import('@/lib/youtube/observatorio/proprio/edicao')" })).toHaveLength(1)
    })
    it('importar a prova de tipo (ela não deve rodar)', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provasDeTipo } from '@/lib/youtube/observatorio/proprio/edicao.type-test'" })).toHaveLength(1)
    })
    it('a prova de tipo pode nomear a classe (não acusa a si mesma)', () => {
      expect(violacoes({ ...base, [TIPOS]: "import { EdicaoDoSite } from './edicao'\nclass S extends EdicaoDoSite {}\nnew EdicaoDoSite('s', Symbol())" })).toEqual([])
    })
    it('token de leitura: construir, usar a classe como valor, importá-la como valor ou por namespace, importar a prova de tipo', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = new LeituraPrivadaDoSite("s")' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'await LeituraPrivadaDoSite.provar("s")' })).toHaveLength(1)
      for (const codigo of ['class F extends LeituraPrivadaDoSite {}', 'Object.create(LeituraPrivadaDoSite.prototype)', 'Reflect.construct(LeituraPrivadaDoSite, ["s"])', 'const k = typeof LeituraPrivadaDoSite', 'if (x instanceof LeituraPrivadaDoSite) {}'])
        expect(violacoes({ ...base, 'app/x/a.ts': codigo }), codigo).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import * as L from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "const m = await import('@/lib/youtube/observatorio/proprio/leitura-privada')" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provasDeTipo } from '@/lib/youtube/observatorio/proprio/leitura-privada.type-test'" })).toHaveLength(1)
      // como TIPO é permitido
      expect(violacoes({ ...base, 'app/x/a.ts': "import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toEqual([])
    })
    it('token de leitura: pedir a prova fora do módulo e de dados.ts, citar a função do direito, importar num componente cliente', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'await provarAcessoPrivado(siteId)' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'await provarLeituraPrivada(siteId)' })).toHaveLength(1)
      expect(violacoes({ ...base, [DADOS]: 'await provarAcessoPrivado(siteId)' })).toEqual([])
      expect(violacoes({ ...base, 'app/x/a.ts': "sb.rpc('can_view_private_site_as', {})" })).toEqual(['app/x/a.ts: cita a função do direito fora do módulo da leitura privada'])
      expect(violacoes({ ...base, [LEITURA]: "sb.rpc('can_view_private_site_as', {})" })).toEqual([])
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toEqual(['app/x/c.tsx: componente cliente importa o módulo da leitura privada'])
    })
    it('o módulo da leitura privada pode (não acusa a si mesmo)', () => {
      expect(violacoes({ ...base, [LEITURA]: 'new LeituraPrivadaDoSite(s, k); provarAcessoPrivado(s)', [TIPOS_LEITURA]: "class S extends LeituraPrivadaDoSite {}" })).toEqual([])
    })
    it('voltar ao booleano', () => {
      expect(violacoes({ ...base, [DADOS]: 'a: { podeEditar: boolean }' })).toHaveLength(1)
    })
    it('comentário que cita o nome não é violação', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': '// chama lerDiario(sb) depois\n/* provarEdicao( */' })).toEqual([])
    })
    it('o módulo da guarda pode (não acusa a si mesmo)', () => {
      expect(violacoes({ ...base, [DADOS]: 'await lerDiario(sb, p); provarEdicao(s)', [EDICAO]: 'new EdicaoDoSite(s)' })).toEqual([])
    })
  })
})
