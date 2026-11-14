import 'server-only'
import { cache } from 'react'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerEstadoDaPessoa, type EstadoDaPessoa } from './estado-da-pessoa'

/**
 * ÚNICO ponto onde o estado da liberação da pessoa é lido (layout/menu, página "Conectar sua IA" e linha do Observatório).
 * Exceção declarada à regra "service client só após canAdminSite": a RLS de obs_ai_liberacoes só deixa `can_admin_site_users` ler, então o
 * cliente da sessão da irmã veria zero linhas ("sem acesso" falso). Só leitura, 5 colunas, filtrada por `userId` + `siteId`:
 * quem chama passa o id do `getUser()` do servidor, NUNCA um valor vindo da URL ou do cliente.
 * `cache()` do React: dentro da mesma requisição a 2ª chamada com os mesmos argumentos sai do cache (uma leitura a menos).
 * Qualquer falha (inclusive o cliente de serviço lançar) = `erro`, que esconde o item (falha fechado).
 */
export const estadoDaSessao = cache(async (userId: string, siteId: string): Promise<EstadoDaPessoa> => {
  let estado: EstadoDaPessoa
  try {
    estado = await lerEstadoDaPessoa(getSupabaseServiceClient(), { userId, siteId, agoraMs: Date.now() })
  } catch {
    estado = { tipo: 'erro' }
  }
  // Sinal para o Sentry (migration fora de prod, grant ou coluna mudou): sem userId nem e-mail.
  if (estado.tipo === 'erro') Sentry.captureMessage('conectar-ia: estado ilegível', 'warning')
  return estado
})
