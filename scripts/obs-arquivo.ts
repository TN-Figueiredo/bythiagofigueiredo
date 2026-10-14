// O comando do arquivo do Observatório (A5 E10): pausar, exportar, conferir, comandos-nas, confirmar-nas, remover, comandos-recarga, estado.
//   OBS_ARQUIVO_DB_URL='<conexão direta ao banco>' npx tsx scripts/obs-arquivo.ts <comando> [opções]     (sem argumento: imprime o uso)
// A conexão NUNCA vem do .env.local (ele aponta para a produção): só desta variável, que o dono põe na hora de rodar.
// A lógica inteira vive em apps/web/src/lib/youtube/observatorio/arquivo/cli.ts (sob o typecheck e os testes do web); este arquivo é fino:
// cria o cliente do banco, o disco, o fetch e o terminal, chama `rodar`, imprime e sai (0 feito, 1 recusado ou diferença, 2 argumento ou ambiente inválido).
import { Client } from 'pg'
import { access, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { interpretar, rodar, USO } from '../apps/web/src/lib/youtube/observatorio/arquivo/cli'
import { criarBaixar } from '../apps/web/src/lib/youtube/observatorio/arquivo/miniaturas'
import type { Disco } from '../apps/web/src/lib/youtube/observatorio/arquivo/exportar'
import type { ClienteSql } from '../apps/web/src/lib/youtube/observatorio/arquivo/sessao'

const VERSAO = 'obs-arquivo 1.0.0'

const existe = (p: string): Promise<boolean> => access(p).then(() => true, () => false)

async function listarDe(base: string, rel: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(join(base, rel), { withFileTypes: true }).catch(() => [])) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`
    if (e.isDirectory()) out.push(...(await listarDe(base, r)))
    else out.push(r)
  }
  return out
}

const disco: Disco = {
  existe,
  listar: p => listarDe(p, ''),
  criarPasta: async (p, modo) => { await mkdir(p, { recursive: true, mode: modo }) },
  gravar: async (p, d) => { await writeFile(p, d) },
  ler: async p => new Uint8Array(await readFile(p)),
  apagar: async p => { await unlink(p).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e }) },
  dentroDeRepositorio: async p => {
    let atual = dirname(p)
    for (let i = 0; i < 40; i++) {
      if (await existe(join(atual, '.git'))) return true
      const pai = dirname(atual)
      if (pai === atual) break
      atual = pai
    }
    return false
  },
}

async function main(): Promise<number> {
  const comando = interpretar(process.argv.slice(2), process.env)
  if ('erro' in comando) {
    console.error(comando.erro === USO.join('\n') ? comando.erro : `${comando.erro}\n\n${USO.join('\n')}`)
    return 2
  }
  const url = process.env.OBS_ARQUIVO_DB_URL
  let cliente: Client | null = null
  let sql: ClienteSql | null = null
  if (url && comando.nome !== 'comandos-nas' && comando.nome !== 'comandos-recarga') {
    cliente = new Client({ connectionString: url })
    try {
      await cliente.connect()
    } catch {
      console.error('não foi possível conectar ao banco com OBS_ARQUIVO_DB_URL') // a URL (e a senha) nunca vão para a saída
      return 2
    }
    const c = cliente
    sql = { query: async (texto, valores) => ({ rows: (await c.query(texto, valores)).rows as Array<Record<string, unknown>> }) }
  }
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const r = await rodar(comando, {
      sql, disco, baixar: criarBaixar(fetch), agora: () => new Date(), ehTerminal: process.stdin.isTTY === true && process.stdout.isTTY === true,
      perguntar: pergunta => new Promise(resolve => leitor.question(pergunta, resolve)), versaoDoScript: VERSAO,
    })
    for (const linha of r.saida) console.log(linha)
    return r.codigo
  } finally {
    leitor.close()
    await cliente?.end().catch(() => undefined)
  }
}

main().then(c => process.exit(c), () => { console.error('erro inesperado'); process.exit(1) })
