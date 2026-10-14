// O segundo servidor MCP (plano, 4.4): UMA ferramenta (`observatorio_leitura`, só leitura), nenhum recurso e nenhum prompt.
// Não entra em `tools.ts`, em `API_REGISTRY` nem em `auto-register.ts`. A entrada é só repassada: quem valida de verdade é `responder`
// (esquema estrito da Tarefa 9); o formato abaixo existe para o cliente saber o que pode mandar.
import 'server-only'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ACOES } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { executarChamada, type Responder } from './executar'

export const NOME_DA_FERRAMENTA = 'observatorio_leitura'

const DESCRICAO =
  'Lê o Observatório do YouTube (concorrentes e canal próprio) e devolve texto com cada número, o estado "não medido" e o motivo. ' +
  'Só leitura. Escolha uma ação: definicoes, listar_canais, canal, video, comparar (2 a 6 canais), destaques, serie, mudancas ou pacote_da_tela. ' +
  'Cada ação aceita só os campos que a ela cabem; o resto é recusado.'

const FORMA = {
  acao: z.enum(ACOES).describe('A ação.'),
  canal_id: z.string().optional().describe('uuid do canal ou id do YouTube (canal, serie, mudancas).'),
  video_id: z.string().optional().describe('uuid ou id do YouTube do vídeo (video, serie).'),
  canal_ids: z.array(z.string()).optional().describe('comparar: de 2 a 6 canais.'),
  janela: z.string().optional().describe('7, 30, 90 ou todas.'),
  formato: z.string().optional().describe('todos, longos ou shorts.'),
  nicho: z.string().optional(),
  de: z.string().optional().describe('serie: AAAA-MM-DD.'),
  ate: z.string().optional().describe('serie: AAAA-MM-DD.'),
  grao: z.string().optional().describe('serie: dia ou semana.'),
  desde: z.string().optional().describe('mudancas: AAAA-MM-DD.'),
  tela: z.string().optional().describe('pacote_da_tela: a tela.'),
  id: z.string().optional().describe('pacote_da_tela: o id, se a tela pedir.'),
  parametros: z.record(z.string(), z.string()).optional().describe('pacote_da_tela: parâmetros da tela.'),
}

export function registrarServidorDoObservatorio(server: McpServer, responder: Responder): void {
  server.tool(NOME_DA_FERRAMENTA, DESCRICAO, FORMA, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async (entrada) => {
    try {
      const r = await executarChamada(entrada, { sb: getSupabaseServiceClient(), responder, agora: Date.now })
      return { content: [{ type: 'text' as const, text: r.texto }], ...(r.erro ? { isError: true } : {}) }
    } catch {
      // "sem contexto" (fora da porta) ou falha imprevista: frase fechada, nada lido
      return { content: [{ type: 'text' as const, text: 'não foi possível atender: nada foi entregue' }], isError: true }
    }
  })
}
