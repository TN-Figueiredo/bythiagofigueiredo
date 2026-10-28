/**
 * Peça 7 (M3b-forja, Tarefa 7a): a credencial do Mac para as duas leituras do arquivo (`pending` e `pode-desligar`).
 * Uma chave de API só de arquivo (`arqdono_...`, permissão `archive_owner`) num arquivo 600 numa pasta 700; nunca a do Cowork,
 * nunca variável de ambiente (D-F21). Só `node:`/relativo (o `tsx` da raiz importa).
 */
export const CAMINHO_DA_CREDENCIAL = '.config/obs-arquivo/chave'
export const FORMA_DA_CHAVE = /^arqdono_[A-Za-z0-9_-]{43}$/
export const URL_DO_ARQUIVO = 'https://bythiagofigueiredo.com/api/pipeline/archive/'
export const URL_DAS_PENDENCIAS = `${URL_DO_ARQUIVO}pending`
export const URL_DO_PODE_DESLIGAR = `${URL_DO_ARQUIVO}pode-desligar`

export type PedirRota = () => Promise<{ status: number; corpo: string }>
export type PedirPendencias = PedirRota
export type PedirPodeDesligar = PedirRota

export type LeituraDoArquivoDaChave = { modo: number; modoPasta: number; texto: string } | null
export type ResultadoDaChave = { ok: true; chave: string } | { ok: false; mensagem: string }

export async function lerChave(
  env: NodeJS.ProcessEnv,
  ler: (caminho: string) => Promise<LeituraDoArquivoDaChave>,
): Promise<ResultadoDaChave> {
  const home = env.HOME
  if (typeof home !== 'string' || home === '') return { ok: false, mensagem: 'obs:arquivo: sem HOME, não sei onde está a chave (~/.config/obs-arquivo/chave)' }
  const r = await ler(`${home.replace(/\/+$/, '')}/${CAMINHO_DA_CREDENCIAL}`)
  if (r === null) {
    return { ok: false, mensagem: 'obs:arquivo: falta ~/.config/obs-arquivo/chave. Grave com: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-obs-arquivo-credencial.sh' }
  }
  if ((r.modo & 0o077) !== 0) return { ok: false, mensagem: 'obs:arquivo: ~/.config/obs-arquivo/chave pode ser lida por outros; trate como chave exposta (runbook) e rode chmod 600 nela' }
  if ((r.modoPasta & 0o077) !== 0) return { ok: false, mensagem: 'obs:arquivo: a pasta ~/.config/obs-arquivo pode ser lida por outros; rode chmod 700 nela' }
  const chave = r.texto.replace(/\r?\n$/, '')
  if (!FORMA_DA_CHAVE.test(chave)) {
    return { ok: false, mensagem: 'obs:arquivo: ~/.config/obs-arquivo/chave não tem uma chave arqdono_ numa linha (a do Cowork não serve); rode o m3b-obs-arquivo-credencial.sh' }
  }
  return { ok: true, chave }
}

/** A ida à rota com a chave. `url`, `timeoutMs` e `fetchFn` existem para o teste; a produção não os passa. */
export function criarPedirRotaDoDono(o: { chave: string; rota: 'pending' | 'pode-desligar'; url?: string; timeoutMs?: number; fetchFn?: typeof fetch }): PedirRota {
  const url = o.url ?? (o.rota === 'pending' ? URL_DAS_PENDENCIAS : URL_DO_PODE_DESLIGAR)
  const timeoutMs = o.timeoutMs ?? 15_000
  const buscar = o.fetchFn ?? fetch
  return async () => {
    const sinal = AbortSignal.timeout(timeoutMs) // o mesmo sinal vale para o cabeçalho e para o corpo
    const r = await buscar(url, { headers: { 'X-Pipeline-Key': o.chave, Accept: 'application/json' }, redirect: 'error', cache: 'no-store', signal: sinal })
    return { status: r.status, corpo: await r.text() }
  }
}
