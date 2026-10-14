// O contexto de UMA requisição do servidor do Observatório (plano, 4.4): a prova da chave do perfil, o token de leitura privada (ou a sua
// falta) e o instante em que a rota recebeu a requisição. Viaja por um `AsyncLocalStorage` PRÓPRIO, separado do `McpServiceContext` do pipeline:
// os serviços do pipeline nunca recebem contexto de chave do perfil. Nunca guardar em variável de módulo: duas pessoas ao mesmo tempo
// se cruzariam (o teste das duas chaves da Tarefa 12 olha isto).
import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { ChaveDoPerfilProvada } from '@/lib/youtube/observatorio/acesso-ia/prova'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'

/** `t0` = instante (ms) em que a rota recebeu a requisição; dele sai o prazo único da ferramenta. */
export interface ContextoDoObservatorio { prova: ChaveDoPerfilProvada; acesso: AcessoPrivado; t0: number }

const armazem = new AsyncLocalStorage<ContextoDoObservatorio>()

/** Lança se a ferramenta foi chamada fora da porta: sem contexto, nada é lido. */
export function contextoDoObservatorio(): ContextoDoObservatorio {
  const c = armazem.getStore()
  if (!c) throw new Error('contexto do Observatório ausente: a ferramenta só roda depois da porta')
  return c
}

export function comContextoDoObservatorio<T>(c: ContextoDoObservatorio, fn: () => T): T {
  return armazem.run(c, fn)
}
