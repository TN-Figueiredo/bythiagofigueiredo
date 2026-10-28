/** Borda do `pendencias` (peça 7, M3b-forja): lê a chave do disco, chama a rota e escreve só o script no stdout (D-F21, D-F23). Usada por scripts/obs-arquivo.ts. */
import { readFile, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { rodar } from './cli'
import { criarPedirRotaDoDono, lerChave, type LeituraDoArquivoDaChave } from './credencial'
import { escreverTudo } from './escrever'
import { saidaSegura, scriptDeFalha } from './pendencias-script'
import type { Disco } from './exportar'

const NAO = async (): Promise<never> => { throw new Error('pendencias não usa o disco') }
const SEM_DISCO = { existe: NAO, listar: NAO, criarPasta: NAO, gravar: NAO, ler: NAO, apagar: NAO, dentroDeRepositorio: NAO } satisfies Disco

async function lerArquivoDaChave(caminho: string): Promise<LeituraDoArquivoDaChave> {
  try {
    const [a, pasta] = await Promise.all([stat(caminho), stat(dirname(caminho))])
    return { modo: a.mode & 0o777, modoPasta: pasta.mode & 0o777, texto: await readFile(caminho, 'utf8') }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

/** `pendencias`: stdout só o script (escreverTudo), tudo o mais no stderr, sem banco e sem readline (D-F21, D-F23). */
export async function pendencias(versao: string): Promise<number> {
  // ssh que cai antes de ler fecha o pipe: EPIPE no stdout não pode despejar pilha do node no terminal (Yannis M2)
  process.stdout.on('error', e => { if ((e as NodeJS.ErrnoException).code !== 'EPIPE') throw e })
  const falhar = async (codigo: number, frase: string): Promise<number> => {
    console.error(frase)
    await escreverTudo(scriptDeFalha(frase).join('\n') + '\n')
    return codigo
  }
  let chave: Awaited<ReturnType<typeof lerChave>>
  try { chave = await lerChave(process.env, lerArquivoDaChave) } catch { return falhar(2, 'obs:arquivo: não consegui ler ~/.config/obs-arquivo/chave') }
  if (!chave.ok) return falhar(2, chave.mensagem)
  const r = await rodar({ nome: 'pendencias' }, {
    sql: null, disco: SEM_DISCO, baixar: async () => { throw new Error('pendencias não baixa') }, agora: () => new Date(), ehTerminal: false,
    perguntar: async () => { throw new Error('pendencias não pergunta') }, versaoDoScript: versao,
    pedirPendencias: criarPedirRotaDoDono({ chave: chave.chave, rota: 'pending' }),
  })
  for (const e of r.erros ?? []) console.error(e)
  await escreverTudo(saidaSegura(r).join('\n') + '\n')
  return r.codigo
}

