/**
 * A5 · E9, Tarefa 5: apagar do Blob as miniaturas de um item que o dono mandou apagar. Nunca lança; diz exatamente o que CONFIRMOU (`feitos`) e o
 * que falta (`restam`), para o banco tirar de `blobs_pending` só o que deu certo.
 *
 * Só apaga sob `observatorio/thumbs/` (URL pelo caminho, pasta por `^observatorio/thumbs/<uuid>/$`). O filtro de URL é o de `arquivo/remover.ts` (E10),
 * reusado e não copiado. Com `OBS_E2E=1` fora de produção o token é ignorado: o `.env.local` do Playwright traz o token de produção.
 */
import { del as blobDel, list as blobList } from '@vercel/blob'
import { comPrazo } from '../../agenda/relogio'
import { soMiniaturasDoObservatorio } from '../arquivo/remover'

const LOTE = 100
const TETO_POR_CHAMADA_MS = 5_000
const ARQUIVOS_POR_PREFIXO = 2_000
const PAGINA_DO_LIST = 1_000
const PREFIXO_OK = /^observatorio\/thumbs\/[0-9a-f-]{36}\/$/

export type MotivoDoBlob = 'ok' | 'sem_tempo' | 'erro' | 'blob_nao_configurado'
export interface ResultadoDoBlob { feitos: string[]; restam: string[]; motivo: MotivoDoBlob }

export interface OpcoesDoBlob {
  prazoMs: number
  agora?: () => number
  del?: (urls: string[]) => Promise<void>
  list?: (a: { prefix: string; cursor?: string; limit: number }) => Promise<{ blobs: Array<{ url: string }>; cursor?: string; hasMore: boolean }>
  token?: string | undefined
}

/** O padrão do token: ausente ou vazio = sem Blob; servidor de teste de navegador (`OBS_E2E=1` fora de produção) = sem Blob. */
function tokenPadrao(): string | undefined {
  if (process.env.OBS_E2E === '1' && process.env.NODE_ENV !== 'production') return undefined
  const t = process.env.BLOB_READ_WRITE_TOKEN
  return t ? t : undefined
}

export async function apagarDoBlob(pendentes: readonly string[], o: OpcoesDoBlob): Promise<ResultadoDoBlob> {
  if (pendentes.length === 0) return { feitos: [], restam: [], motivo: 'ok' }
  const token = o.token !== undefined ? (o.token || undefined) : tokenPadrao()
  if (!token) return { feitos: [], restam: [...pendentes], motivo: 'blob_nao_configurado' }

  const agora = o.agora ?? Date.now
  const fim = agora() + o.prazoMs
  const del = o.del ?? (async (urls: string[]): Promise<void> => { await blobDel(urls, { token }) })
  const list = o.list ?? (async (a: { prefix: string; cursor?: string; limit: number }) => {
    const r = await blobList({ prefix: a.prefix, cursor: a.cursor, limit: a.limit, token })
    return { blobs: r.blobs.map(b => ({ url: b.url })), cursor: r.cursor, hasMore: r.hasMore }
  })

  const prefixos = pendentes.filter(p => PREFIXO_OK.test(p))
  const candidatas = pendentes.filter(p => !PREFIXO_OK.test(p))
  const { apagar: urls, fora } = soMiniaturasDoObservatorio(candidatas)

  const feitos: string[] = []
  const restam: string[] = [...fora]
  let motivo: MotivoDoBlob = fora.length > 0 ? 'erro' : 'ok'

  /** Uma chamada ao Blob contra o menor entre o que resta do prazo e 5 s. `null` = sem tempo (nada se sabe do resultado). */
  async function chamar<T>(f: () => Promise<T>): Promise<{ valor: T } | { semTempo: true } | { erro: true }> {
    const resta = fim - agora()
    if (resta <= 0) return { semTempo: true }
    try {
      const r = await comPrazo(f(), Math.min(resta, TETO_POR_CHAMADA_MS))
      return 'valor' in r ? { valor: r.valor } : { semTempo: true }
    } catch {
      return { erro: true }
    }
  }

  const semTempo = (naoFeitas: string[]): ResultadoDoBlob => ({ feitos, restam: [...restam, ...naoFeitas], motivo: 'sem_tempo' })

  for (let i = 0; i < urls.length; i += LOTE) {
    const lote = urls.slice(i, i + LOTE)
    const r = await chamar(() => del(lote))
    if ('semTempo' in r) return semTempo([...urls.slice(i), ...prefixos])
    if ('erro' in r) { restam.push(...lote); motivo = 'erro'; continue }
    feitos.push(...lote)
  }

  for (let i = 0; i < prefixos.length; i += 1) {
    const prefixo = prefixos[i]
    if (prefixo === undefined) continue
    let apagados = 0
    let confirmado = false
    let falhou = false
    while (apagados < ARQUIVOS_POR_PREFIXO) {
      const l = await chamar(() => list({ prefix: prefixo, limit: PAGINA_DO_LIST }))
      if ('semTempo' in l) return semTempo(prefixos.slice(i))
      if ('erro' in l) { falhou = true; break }
      const achados = l.valor.blobs.map(b => b.url)
      if (achados.length === 0) { confirmado = true; break }
      const ok = soMiniaturasDoObservatorio(achados).apagar
      if (ok.length === 0) { falhou = true; break }
      const d = await chamar(() => del(ok))
      if ('semTempo' in d) return semTempo(prefixos.slice(i))
      if ('erro' in d) { falhou = true; break }
      apagados += ok.length
    }
    if (confirmado) feitos.push(prefixo)
    else { restam.push(prefixo); if (falhou) motivo = 'erro' }
  }

  return { feitos, restam, motivo }
}
