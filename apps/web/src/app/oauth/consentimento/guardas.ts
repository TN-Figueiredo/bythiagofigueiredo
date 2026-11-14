// Guardas comuns da página e das duas actions: forma do id, cookie do navegador que abriu o pedido (A1), origem, host e travas.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { EMISSOR, hostDoRecurso, oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import type { Cliente } from '@/lib/youtube/observatorio/acesso-ia/liberacao'

export const COOKIE_PEDIDO = '__Host-oauth_pedido'
export const FORMA_DO_ID = /^[A-Za-z0-9_-]{43}$/

export const NOME_DA_IA: Readonly<Record<Cliente, string>> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' }

export const sha256Hex = (t: string): string => createHash('sha256').update(t).digest('hex')

/** A1: o cookie é o id do pedido; compara o sha256 dos dois (mesmo tamanho), nunca `===`. */
export function cookieConfere(cookie: string | undefined, id: string): boolean {
  if (typeof cookie !== 'string' || cookie === '') return false
  const a = createHash('sha256').update(cookie).digest()
  const b = createHash('sha256').update(id).digest()
  return a.length === b.length && timingSafeEqual(a, b)
}

export const travasFechadas = (): boolean => !oauthLigado() || !acessoExternoLigado().ligado

export const hostAceito = (host: string | null): boolean => host !== null && hostDoRecurso(host)

/** `Origin` da action: o emissor; fora de produção também a origem do host local que `hostDoRecurso` aceita. */
export function origemConfere(origin: string | null, host: string | null): boolean {
  if (origin === null) return false
  if (origin === EMISSOR) return true
  return process.env.NODE_ENV !== 'production' && host !== null && hostDoRecurso(host) && (origin === `http://${host}` || origin === `https://${host}`)
}

export { caminhoDoLogin, caminhoDoPedido } from './tipos'

/** Código curto que a pessoa dita ao Thiago (q8): `c1-` e 8 hex. */
export const codigoDeErro = (): string => `c1-${randomBytes(4).toString('hex')}`
