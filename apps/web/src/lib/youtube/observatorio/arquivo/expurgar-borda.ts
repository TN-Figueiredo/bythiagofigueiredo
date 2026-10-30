/**
 * M9, Tarefa 8: a borda real do `DepsExpurgo` (ssh de leitura à forja, rota C14 com a chave do arquivo, pasta de cópias no Mac).
 * Só LÊ a forja, pela montagem `ro`; nada aqui escreve no NAS. Usada por `pendencias-main.ts`.
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { CAMINHO_SEGURO } from '../arquivo-mensal/pendencias'
import type { Filho } from '../arquivo-mensal/contrato'
import { SHA_RE } from '../arquivo-mensal/contrato'
import { URL_DO_ARQUIVO } from './credencial'
import { RAIZ_LEITURA, TETO_COPIA_BYTES, type CopiaGuardada, type DepsExpurgo } from './expurgar'

export const URL_DO_EXPURGO = `${URL_DO_ARQUIVO}expurgo`
export const PASTA_DE_COPIAS = '.superpowers/sdd/manutencao-nas/copias'
const SSH_BASE = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=auto', '-o', 'ControlPath=~/.ssh/cm-forja-%C', '-o', 'ControlPersist=60', 'forja']

export type Ssh = (args: string[]) => Promise<{ codigo: number; stdout: Buffer; stderr: string }>

export const sshReal: Ssh = args => new Promise(ok => {
  execFile('ssh', args, { encoding: 'buffer', maxBuffer: TETO_COPIA_BYTES * 2, timeout: 120_000 }, (e, stdout, stderr) => {
    const codigo = e === null ? 0 : typeof (e as { code?: unknown }).code === 'number' ? (e as { code: number }).code : 255
    ok({ codigo, stdout: stdout as Buffer, stderr: (stderr as Buffer).toString('utf8') })
  })
})

export function nasMontadoVia(ssh: Ssh) {
  return async (filho: Filho): Promise<boolean> => {
    const raiz = RAIZ_LEITURA[filho]
    const r = await ssh([...SSH_BASE, `mountpoint -q ${raiz} && test -f ${raiz}/.arquivo-vivo`])
    return r.codigo === 0       // qualquer outra coisa, inclusive ssh que cai, é "fora": indisponibilidade não prova ausência
  }
}

export function lerDoNasVia(ssh: Ssh) {
  return async (filho: Filho, caminho: string): Promise<Buffer | null> => {
    if (!CAMINHO_SEGURO.test(caminho)) throw new Error('caminho_inseguro')
    const r = await ssh([...SSH_BASE, 'env', 'LC_ALL=C', 'cat', '--', `${RAIZ_LEITURA[filho]}/${caminho}`])
    if (r.codigo === 0) return r.stdout
    if (r.codigo === 1 && /No such file/.test(r.stderr)) return null
    throw new Error('leitura_do_nas_falhou')
  }
}

const Meta = z.object({ sha256: z.string().regex(SHA_RE), filho: z.enum(['numerico', 'texto']), caminho: z.string().regex(CAMINHO_SEGURO), itemId: z.string() }).strict()

/** Raiz do repositório (onde está `.git`, arquivo ou pasta), a partir deste módulo: não depende do `cwd` de quem roda. */
export function raizDoRepositorio(inicio: string = dirname(fileURLToPath(import.meta.url))): string {
  let atual = inicio
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(atual, '.git'))) return atual
    const pai = dirname(atual)
    if (pai === atual) break
    atual = pai
  }
  throw new Error('raiz_do_repositorio_nao_achada')
}

export function guardarEm(pasta: string): DepsExpurgo['guardar'] {
  const sumir = (c: string) => unlink(c).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e })
  const nomesJson = async (): Promise<string[]> => (await readdir(pasta).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return [] as string[]; throw e })).filter(x => x.endsWith('.json'))
  /** Índice ilegível (gravação cortada) não derruba a execução: vira nada. */
  const lerMeta = async (n: string) => { try { const m = Meta.safeParse(JSON.parse(await readFile(join(pasta, n), 'utf8'))); return m.success ? m.data : null } catch { return null } }
  return {
    async ler(sha) { try { return await readFile(join(pasta, `${sha}.gz`)) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e } },
    async gravarDados(sha, dados) {
      await mkdir(pasta, { recursive: true, mode: 0o700 })
      await writeFile(join(pasta, `${sha}.gz`), dados, { mode: 0o600 })
    },
    async apagarDados(sha) { await sumir(join(pasta, `${sha}.gz`)) },
    async gravar(sha, dados, meta) {
      await this.gravarDados(sha, dados)
      const tmp = join(pasta, `${sha}.json.tmp`)
      await writeFile(tmp, JSON.stringify({ sha256: sha, ...meta }), { mode: 0o600 })
      await rename(tmp, join(pasta, `${sha}.json`))
    },
    async daItem(itemId) {
      const out: CopiaGuardada[] = []
      for (const n of await nomesJson()) { const m = await lerMeta(n); if (m && m.itemId === itemId) out.push({ sha256: m.sha256, filho: m.filho, caminho: m.caminho }) }
      return out
    },
    async itensGuardados() {
      const ids = new Set<string>()
      for (const n of await nomesJson()) { const m = await lerMeta(n); if (m) ids.add(m.itemId) }
      return [...ids]
    },
    async apagarDoItem(itemId) {
      for (const n of await nomesJson()) {
        const m = await lerMeta(n)
        if (m && m.itemId === itemId) { await sumir(join(pasta, `${m.sha256}.gz`)); await sumir(join(pasta, n)) }
      }
    },
  }
}

/** Corpo: `data` do envelope em 200; em erro, `{ motivo: error.code }`. Rede, timeout e redirecionamento lançam. */
export function siteVia(chave: string, fetchFn: typeof fetch = fetch, url: string = URL_DO_EXPURGO): DepsExpurgo['site'] {
  return async passo => {
    const r = await fetchFn(url, {
      method: 'POST', headers: { 'X-Pipeline-Key': chave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(passo), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000),
    })
    let json: unknown = null
    try { json = JSON.parse(await r.text()) } catch { json = null }
    const o = (typeof json === 'object' && json !== null ? json : {}) as { data?: unknown; error?: { code?: unknown } }
    if (r.status === 200) return { status: 200, corpo: o.data }
    return { status: r.status, corpo: { motivo: typeof o.error?.code === 'string' ? o.error.code : null } }
  }
}

export function criarDepsExpurgo(chave: string, raiz: string = raizDoRepositorio()): DepsExpurgo {
  const ssh = sshReal
  return { nasMontado: nasMontadoVia(ssh), lerDoNas: lerDoNasVia(ssh), site: siteVia(chave), agora: () => new Date(), guardar: guardarEm(join(raiz, PASTA_DE_COPIAS)) }
}
