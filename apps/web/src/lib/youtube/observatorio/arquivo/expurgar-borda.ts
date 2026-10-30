/**
 * M9, Tarefa 8: a borda real do `DepsExpurgo` (ssh de leitura à forja, rota C14 com a chave do arquivo, pasta de cópias no Mac).
 * Só LÊ a forja, pela montagem `ro`; nada aqui escreve no NAS. Usada por `pendencias-main.ts`.
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { CAMINHO_SEGURO } from '../arquivo-mensal/pendencias'
import type { Filho } from '../arquivo-mensal/contrato'
import { SHA_RE } from '../arquivo-mensal/contrato'
import { URL_DO_ARQUIVO } from './credencial'
import { RAIZ_LEITURA, TETO_COPIA_BYTES, type CopiaGuardada, type DepsExpurgo } from './expurgar'

export const URL_DO_EXPURGO = `${URL_DO_ARQUIVO}expurgo`
export const PASTA_DE_COPIAS = '.superpowers/sdd/manutencao-nas/copias'
const SSH_BASE = ['-o', 'ControlMaster=auto', '-o', 'ControlPath=~/.ssh/cm-forja-%C', '-o', 'ControlPersist=60', 'forja']

export type Ssh = (args: string[]) => Promise<{ codigo: number; stdout: Buffer; stderr: string }>

export const sshReal: Ssh = args => new Promise(ok => {
  execFile('ssh', args, { encoding: 'buffer', maxBuffer: TETO_COPIA_BYTES * 2 }, (e, stdout, stderr) => {
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
    const r = await ssh([...SSH_BASE, 'cat', '--', `${RAIZ_LEITURA[filho]}/${caminho}`])
    if (r.codigo === 0) return r.stdout
    if (r.codigo === 1 && /No such file/.test(r.stderr)) return null
    throw new Error('leitura_do_nas_falhou')
  }
}

const Meta = z.object({ sha256: z.string().regex(SHA_RE), filho: z.enum(['numerico', 'texto']), caminho: z.string().regex(CAMINHO_SEGURO), itemId: z.string() }).strict()

export function guardarEm(pasta: string): DepsExpurgo['guardar'] {
  return {
    async ler(sha) { try { return await readFile(join(pasta, `${sha}.gz`)) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e } },
    async gravar(sha, dados, meta) {
      await mkdir(pasta, { recursive: true, mode: 0o700 })
      await writeFile(join(pasta, `${sha}.gz`), dados, { mode: 0o600 })
      await writeFile(join(pasta, `${sha}.json`), JSON.stringify({ sha256: sha, ...meta }), { mode: 0o600 })
    },
    async daItem(itemId) {
      const nomes = await readdir(pasta).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return [] as string[]; throw e })
      const out: CopiaGuardada[] = []
      for (const n of nomes.filter(x => x.endsWith('.json'))) {
        const m = Meta.safeParse(JSON.parse(await readFile(join(pasta, n), 'utf8')))
        if (m.success && m.data.itemId === itemId) out.push({ sha256: m.data.sha256, filho: m.data.filho, caminho: m.data.caminho })
      }
      return out
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

export function criarDepsExpurgo(chave: string, raiz: string = process.cwd()): DepsExpurgo {
  const ssh = sshReal
  return { nasMontado: nasMontadoVia(ssh), lerDoNas: lerDoNasVia(ssh), site: siteVia(chave), agora: () => new Date(), guardar: guardarEm(join(raiz, PASTA_DE_COPIAS)) }
}
