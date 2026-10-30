// @vitest-environment node
/** M9, Tarefa 8: a borda real do expurgo (ssh de leitura, rota C14, pasta de cópias), com ssh e fetch falsos. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { guardarEm, raizDoRepositorio, criarDepsExpurgo, lerDoNasVia, nasMontadoVia, siteVia, type Ssh } from '@/lib/youtube/observatorio/arquivo/expurgar-borda'

const ssh = (codigo: number, stdout = '', stderr = ''): { chamadas: string[][]; ssh: Ssh } => {
  const chamadas: string[][] = []
  return { chamadas, ssh: async a => { chamadas.push(a); return { codigo, stdout: Buffer.from(stdout), stderr } } }
}

describe('borda do expurgo', () => {
  it('nasMontado: só código 0 é montado; ssh que cai (255) é fora', async () => {
    expect(await nasMontadoVia(ssh(0).ssh)('numerico')).toBe(true)
    expect(await nasMontadoVia(ssh(1).ssh)('numerico')).toBe(false)
    expect(await nasMontadoVia(ssh(255).ssh)('texto')).toBe(false)
    const s = ssh(0); await nasMontadoVia(s.ssh)('texto')
    expect(s.chamadas[0]!.at(-1)).toBe('mountpoint -q /mnt/arquivo/leitura/texto && test -f /mnt/arquivo/leitura/texto/.arquivo-vivo')
  })
  it('lerDoNas: lê pela montagem ro; não achado = null; outro erro lança; caminho inseguro nem vai ao ssh', async () => {
    const ok = ssh(0, 'abc'); expect((await lerDoNasVia(ok.ssh)('numerico', 'serie/x.csv.gz'))!.toString()).toBe('abc')
    expect(ok.chamadas[0]!.slice(-3)).toEqual(['cat', '--', '/mnt/arquivo/leitura/numerico/serie/x.csv.gz'])
    expect(await lerDoNasVia(ssh(1, '', 'cat: x: No such file or directory').ssh)('numerico', 'serie/x.csv.gz')).toBeNull()
    await expect(lerDoNasVia(ssh(255).ssh)('numerico', 'serie/x.csv.gz')).rejects.toThrow()
    const nunca = ssh(0)
    await expect(lerDoNasVia(nunca.ssh)('numerico', '../etc/passwd')).rejects.toThrow('caminho_inseguro')
    await expect(lerDoNasVia(nunca.ssh)('numerico', 'a b; rm')).rejects.toThrow('caminho_inseguro')
    expect(nunca.chamadas).toHaveLength(0)
  })
  it('site: 200 devolve data; erro devolve o code como motivo; rede lança; a chave vai só no cabeçalho', async () => {
    let visto: RequestInit | undefined
    const f = (status: number, corpo: unknown): typeof fetch => (async (_u: unknown, i?: RequestInit) => { visto = i; return new Response(JSON.stringify(corpo), { status }) }) as typeof fetch
    expect(await siteVia('k', f(200, { data: { a: 1 } }))({ passo: 'abrir' })).toEqual({ status: 200, corpo: { a: 1 } })
    expect((visto!.headers as Record<string, string>)['X-Pipeline-Key']).toBe('k')
    expect(String(visto!.body)).not.toContain('"k"')
    expect(await siteVia('k', f(409, { error: { code: 'base_mudou' } }))({})).toEqual({ status: 409, corpo: { motivo: 'base_mudou' } })
    expect(await siteVia('k', f(500, 'x'))({})).toEqual({ status: 500, corpo: { motivo: null } })
    await expect(siteVia('k', (async () => { throw new TypeError('fetch failed') }) as typeof fetch)({})).rejects.toThrow()
  })
  it('guardar: grava a cópia e o índice; daItem acha só as do item; ler de sha ausente = null', async () => {
    const g = guardarEm(join(mkdtempSync(join(tmpdir(), 'cop-')), 'copias'))
    const sha = 'c'.repeat(64)
    expect(await g.daItem('item:1')).toEqual([])
    await g.gravar(sha, Buffer.from('zz'), { itemId: 'item:1', filho: 'numerico', caminho: 'serie/x.csv.gz' })
    expect((await g.ler(sha))!.toString()).toBe('zz')
    expect(await g.ler('d'.repeat(64))).toBeNull()
    expect(await g.daItem('item:1')).toEqual([{ sha256: sha, filho: 'numerico', caminho: 'serie/x.csv.gz' }])
    expect(await g.daItem('item:2')).toEqual([])
  })
  it('guardar: limpeza por item apaga .gz e .json; índice corrompido é ignorado', async () => {
    const pasta = join(mkdtempSync(join(tmpdir(), 'cop-')), 'copias')
    const g = guardarEm(pasta)
    await g.gravar('c'.repeat(64), Buffer.from('a'), { itemId: 'item:1', filho: 'numerico', caminho: 'serie/x.csv.gz' })
    await g.gravar('d'.repeat(64), Buffer.from('b'), { itemId: 'item:2', filho: 'texto', caminho: 'serie/y.csv.gz' })
    writeFileSync(join(pasta, `${'e'.repeat(64)}.json`), '{corta')
    expect((await g.itensGuardados()).sort()).toEqual(['item:1', 'item:2'])
    await g.apagarDoItem('item:1')
    expect(readdirSync(pasta).filter(n => n.startsWith('c'))).toEqual([])
    expect(await g.daItem('item:2')).toHaveLength(1)
  })
  it('a pasta de cópias vem da raiz do repositório, não do cwd', () => {
    const antes = process.cwd()
    const a = raizDoRepositorio()
    process.chdir(tmpdir())
    try { expect(raizDoRepositorio()).toBe(a) } finally { process.chdir(antes) }
    expect(existsSync(join(a, '.git'))).toBe(true)
    expect(typeof criarDepsExpurgo).toBe('function')
  })
})
