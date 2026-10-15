// O abridor da chave do perfil (E17 degrau 2, plano 4.7): chama os carregadores de `page-data.ts` com o site e a pessoa DA PROVA, sem
// `getSiteContext`, sem `requireSiteScope`, sem `cookies`, sem `redirect`. Nada aqui lê preferência: nicho `todos`, "meu canal" pela regra de
// recência, `canEdit` falso. As funções `carregar…` NÃO têm guarda: é a varredura de `proprio-varredura.test.ts` que as tranca (só `page-data.ts`
// e este arquivo as chamam). Só a rota do MCP deve chamar `abridorDaChave`, com a prova que a porta acabou de devolver.
import 'server-only'
import { chaveProvada, type ChaveDoPerfilProvada } from '@/lib/youtube/observatorio/acesso-ia/prova'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import type { Abridor } from '../_chrome/abridor'
import { carregarCanal, carregarObservatorio } from '../_chrome/page-data'

const SEM_DIREITO: AcessoPrivado = { leitura: null, edita: false, negativa: 'sem_direito' }

/** Lança se a prova não nasceu na porta (objeto literal, cast): antes de ler qualquer coisa. */
export function abridorDaChave(prova: ChaveDoPerfilProvada, acesso: AcessoPrivado): Abridor {
  if (!chaveProvada(prova)) throw new TypeError('abridorDaChave exige a prova que a porta devolveu')
  const siteId = prova.siteId
  // `edita` é sempre falso por este caminho, mesmo para quem edita pela sessão: a chave só lê
  const doSite: AcessoPrivado = { leitura: acesso.leitura, edita: false, negativa: acesso.negativa }
  return {
    observatorio: (extra) => carregarObservatorio({ siteId, now: observatoryNow(), userIdDaPreferencia: null, meuCanalLembrado: null, extra }),
    canal: (channelId) => carregarCanal({ siteId, now: observatoryNow(), channelId, acesso: doSite, meuCanalLembrado: null }),
    acessoPrivado: async (pedido) => (pedido === siteId ? doSite : SEM_DIREITO),
  }
}
