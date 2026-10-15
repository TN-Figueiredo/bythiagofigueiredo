'use server'
/**
 * A5 · E9, Tarefa 9: as cinco ações da fila "Saíram do YouTube". Porta de entrada, nenhuma regra: (1) quem administra, ANTES de qualquer cliente de
 * serviço; (2) a sessão de edição, para o id do usuário; (3) a forma da entrada; (4) o schema; (5) o serviço (`saiu/responder.ts`); (6) invalidar.
 *
 * O `siteId` vem SEMPRE de `getSiteContext()`: o cliente manda só ids de item, e o filtro de site das funções do banco os recusa. Componente cliente
 * recebe estas ações por prop, nunca as importa.
 */
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { denyUnlessSiteAdmin } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { schemaE9 } from '@/lib/youtube/observatorio/saiu/schema'
import {
  apagarCanal, apagarComentarios, apagarVideo, decidirVolta, ignorarVoltaDoGrupo as ignorarVoltaDoGrupoSvc, manter, tentarDeNovo,
  type CtxDeResposta, type Resposta,
} from '@/lib/youtube/observatorio/saiu/responder'
import { JANELA_FORJA_MIN, fraseDoDesfecho, fraseDoErro, type Desfecho, type TipoDeItem } from '@/lib/youtube/observatorio/saiu/modelo'

/** O que a tela recebe: o desfecho do serviço e a frase pronta (catálogo fechado; nunca texto do banco). */
export type ResultadoDaAcao = Resposta & { frase: string }

const ACAO = 'responder à fila Saíram do YouTube'
const MAX_IDS = 500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ehUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const ehInteiroPositivo = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const MUDA_O_BANCO: ReadonlySet<Desfecho> = new Set<Desfecho>(['apagado', 'apagando', 'mantido', 'respondido'])

function pronto(r: Resposta, tipo: TipoDeItem = 'video'): ResultadoDaAcao {
  const frase = r.desfecho === 'erro' ? fraseDoErro(r.codigo ?? 'erro_de_banco') : fraseDoDesfecho(r.desfecho, { tipo, janelaMin: JANELA_FORJA_MIN, faltam: r.faltam })
  return { ...r, frase }
}
const semPermissao = (): ResultadoDaAcao => pronto({ desfecho: 'sem_permissao' })
const malformada = (): ResultadoDaAcao => pronto({ desfecho: 'erro', codigo: 'resposta_inesperada' })

/** IP e agente do pedido: primeiro valor de `x-forwarded-for`; `user-agent` cortado em 300 caracteres. */
async function origem(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = h.get('user-agent')?.slice(0, 300) || null
  return { ip, ua }
}

/**
 * Passos 1 e 2: administra (antes de qualquer cliente de serviço), depois a sessão de edição. Recusou: `null`.
 * Passo 4 (schema) e o cliente de serviço só vêm depois da forma da entrada, em `executar`.
 */
async function entrar(): Promise<{ siteId: string; actorId: string } | null> {
  const { siteId } = await getSiteContext()
  const negado = await denyUnlessSiteAdmin(siteId, ACAO)
  if (negado) return null
  const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!edicao.ok) return null
  return { siteId, actorId: edicao.user.id }
}

async function executar(
  dono: { siteId: string; actorId: string }, tipo: TipoDeItem,
  rodar: (sb: ReturnType<typeof getSupabaseServiceClient>, ctx: CtxDeResposta) => Promise<Resposta>,
): Promise<ResultadoDaAcao> {
  const sb = getSupabaseServiceClient()
  const texto = await schemaE9(sb)
  if (texto !== null) return { desfecho: 'erro', codigo: 'schema_ausente', frase: texto }
  const { ip, ua } = await origem()
  const r = await rodar(sb, { siteId: dono.siteId, actorId: dono.actorId, ip, ua })
  // resposta parcial (erro depois de n linhas gravadas, m-2 do portão 14/10) também mudou o banco
  if (MUDA_O_BANCO.has(r.desfecho) || (r.desfecho === 'erro' && (r.n ?? 0) > 0)) {
    invalidateObservatory(dono.siteId)
    revalidatePath('/cms/youtube/competitors', 'layout')
  }
  return pronto(r, tipo)
}

export async function manterItens(e: { tipo: 'video' | 'canal' | 'comentario'; ids: Array<string | number> }): Promise<ResultadoDaAcao> {
  const dono = await entrar()
  if (!dono) return semPermissao()
  const tipoOk = e?.tipo === 'video' || e?.tipo === 'canal' || e?.tipo === 'comentario'
  const idsOk = Array.isArray(e?.ids) && e.ids.length <= MAX_IDS && e.ids.every(i => (e.tipo === 'comentario' ? ehInteiroPositivo(i) : ehUuid(i)))
  if (!tipoOk || !idsOk) return malformada()
  return executar(dono, e.tipo === 'comentario' ? 'comentarios' : e.tipo, (sb, ctx) => manter(sb, ctx, e.tipo, e.ids))
}

export async function apagarItem(e: { tipo: TipoDeItem; id: string; ids?: number[]; palavra: string }): Promise<ResultadoDaAcao> {
  const dono = await entrar()
  if (!dono) return semPermissao()
  const tipoOk = e?.tipo === 'video' || e?.tipo === 'canal' || e?.tipo === 'comentarios'
  const idOk = ehUuid(e?.id)
  const comentariosOk = e?.tipo !== 'comentarios' || (Array.isArray(e.ids) && e.ids.length > 0 && e.ids.length <= MAX_IDS && e.ids.every(ehInteiroPositivo))
  if (!tipoOk || !idOk || !comentariosOk || typeof e.palavra !== 'string') return malformada()
  return executar(dono, e.tipo, (sb, ctx) =>
    e.tipo === 'video' ? apagarVideo(sb, ctx, e.id, e.palavra)
      : e.tipo === 'canal' ? apagarCanal(sb, ctx, e.id, e.palavra)
        : apagarComentarios(sb, ctx, e.id, e.ids ?? [], e.palavra))
}

export async function responderVolta(e: { itemId: number; decisao: 'voltar' | 'ignorar' }): Promise<ResultadoDaAcao> {
  const dono = await entrar()
  if (!dono) return semPermissao()
  if (!ehInteiroPositivo(e?.itemId) || (e.decisao !== 'voltar' && e.decisao !== 'ignorar')) return malformada()
  return executar(dono, 'video', (sb, ctx) => decidirVolta(sb, ctx, e.itemId, e.decisao))
}

export async function tentarApagarDeNovo(e: { itemId: number }): Promise<ResultadoDaAcao> {
  const dono = await entrar()
  if (!dono) return semPermissao()
  if (!ehInteiroPositivo(e?.itemId)) return malformada()
  return executar(dono, 'video', (sb, ctx) => tentarDeNovo(sb, ctx, e.itemId))
}

export async function ignorarVoltaDoGrupo(e: { itemIds: number[] }): Promise<ResultadoDaAcao> {
  const dono = await entrar()
  if (!dono) return semPermissao()
  if (!Array.isArray(e?.itemIds) || e.itemIds.length > MAX_IDS || !e.itemIds.every(ehInteiroPositivo)) return malformada()
  return executar(dono, 'comentarios', (sb, ctx) => ignorarVoltaDoGrupoSvc(sb, ctx, e.itemIds))
}
