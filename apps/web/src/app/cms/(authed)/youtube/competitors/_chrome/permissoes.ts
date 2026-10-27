import 'server-only'
import { cache } from 'react'
import { podeEditarSite as guardaDeEdicao } from './ab-entradas/permissao'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'

export interface PermissoesDoSite { canUnlock: boolean; podeEditar: boolean }
/** Só o direito de editar (2 idas: getUser + rpc). É o que o chrome usa em toda navegação (Yannis r2 N-6). */
export const podeEditarSite = cache(async (siteId: string): Promise<boolean> => guardaDeEdicao(siteId)) // a guarda do A/B Lab: `requireSiteScope(... mode: 'edit')`, erro da guarda = false com Sentry
/** Quem administra: só chamada onde a tela precisa (página Arquivo, peça 7), depois de `podeEditarSite`. */
export const podeAdministrarSite = cache(async (siteId: string): Promise<boolean> => canAdminSiteUsers(siteId))
/** Uma pergunta por requisição (React cache): a página, o chrome e a peça 7 dividem a resposta. "+25" é de quem administra (can_admin_site_users); `podeEditar`: quem só lê vê a lista com as ações desligadas. */
export const permissoesDoSite = cache(async (siteId: string): Promise<PermissoesDoSite> => {
  if (!(await podeEditarSite(siteId))) return { canUnlock: false, podeEditar: false }
  return { canUnlock: await podeAdministrarSite(siteId), podeEditar: true }
})
