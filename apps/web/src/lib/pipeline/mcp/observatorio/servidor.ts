// O segundo servidor MCP (plano, 4.4): UMA ferramenta (`observatorio_leitura`, só leitura), nenhum recurso e nenhum prompt.
// Não entra em `tools.ts`, em `API_REGISTRY` nem em `auto-register.ts`. A entrada é só repassada: quem valida de verdade é `responder`
// (esquema estrito da Tarefa 9); o formato abaixo existe para o cliente saber o que pode mandar.
import 'server-only'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ACOES } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { EXEMPLO_DA_ACAO, EXEMPLO_DA_SERIE_DE_CANAIS, TODOS_OS_CAMPOS } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { executarChamada, type Responder } from './executar'

export const NOME_DA_FERRAMENTA = 'observatorio_leitura'

export const DESCRICAO =
  'Lê o Observatório do YouTube (concorrentes e canal próprio) e devolve texto com cada número, o estado "não medido" e o motivo. ' +
  'Só leitura. Escolha uma das onze ações: definicoes, listar_canais, canal, video, comparar (2 a 6 canais), destaques, serie, mudancas, pacote_da_tela, sugestoes (as sugestões do nicho: só leitura) ou consultar (lista de vídeos filtrada por lugar, canal, idade e data, ordenada pela medida que você escolher). ' +
  'Cada ação aceita só os campos que a ela cabem; o resto é recusado. ' +
  'Para gráfico ou planilha, peça saida "tabela" (CSV com número de máquina; célula vazia não é zero; cada tabela traz o gráfico sugerido: linha, barra, pizza ou nenhum). ' +
  // para o cliente que ignora as `instructions` (não se sabe se o conector web do Claude.ai as entrega)
  'Toda resposta termina com "Cobertura" (quanto você viu e as próximas chamadas): diga a cobertura antes de recomendar e ofereça aprofundar. ' +
  'Um pedido válido por ação (troque <uuid> pelo id da coluna Id de listar_canais):\n' +
  ACOES.map((a) => `- ${EXEMPLO_DA_ACAO[a]}`).join('\n') +
  `\n- vários canais na mesma série (até 6; só em tabela): ${EXEMPLO_DA_SERIE_DE_CANAIS}`

/** A fatia (tarefa do plano A7) que liga cada item das `instructions`. Item de fatia desligada não aparece; a numeração sai só dos que aparecem. */
export type FatiaDeInstrucao = 'T5' | 'T6' | 'T9' | 'T10' | 'A5' | 'A4'
export const ITENS_DE_INSTRUCAO: ReadonlyArray<{ texto: string; fatia: FatiaDeInstrucao }> = [
  { fatia: 'T5', texto: 'Toda resposta termina com a seção "Cobertura". Antes de recomendar, comparar ou concluir sobre um conjunto, diga em uma frase quanto viu ("vi 31 dos 34 canais") e, se não viu tudo, pergunte: "quer que eu aprofunde em X?", com X em palavras (o texto depois de " : " em "Próximas chamadas").' },
  { fatia: 'T5', texto: '"não medido", "falhou" e "restrito" não são zero: não some, não faça média, não ordene como se fossem.' },
  { fatia: 'T6', texto: 'Pedido recusado traz formato e exemplo válido: corrija e tente de novo uma vez.' },
  { fatia: 'T9', texto: 'Para ler a lista inteira, peça a próxima janela (a_partir_da_linha; listar_canais, destaques, mudancas) antes de concluir sobre todos. Se a Cobertura disser que a lista mudou, refaça da linha 1.' },
  { fatia: 'T10', texto: 'Para o conjunto, use o "Resumo do todo" do topo: vale para todas as linhas.' },
  { fatia: 'A5', texto: 'Para gráfico ou planilha use saida "tabela". Desenhe o gráfico sugerido de cada tabela; vazio é buraco, nunca zero; pizza só onde sugerido. Publicações por mês não é medida: use a coluna Ritmo de listar_canais em tabela e diga que mês não é medido.' },
  { fatia: 'A4', texto: 'Na consultar, diga por qual medida ordenou e ofereça outra; a lista não tem janela: estreite o filtro.' },
]
/** As fatias já entregues; cada fatia nova liga o seu item aqui, na mesma tarefa que o entrega. */
const FATIAS_LIGADAS: ReadonlySet<FatiaDeInstrucao> = new Set<FatiaDeInstrucao>(['T5', 'T6', 'T9', 'T10', 'A5', 'A4'])

export function instrucoesDe(ligadas: ReadonlySet<FatiaDeInstrucao>): string {
  const itens = ITENS_DE_INSTRUCAO.filter((i) => ligadas.has(i.fatia))
  return [`Observatório do YouTube, só leitura. Ao usar a ferramenta ${NOME_DA_FERRAMENTA}:`, ...itens.map((i, n) => `${n + 1}. ${i.texto}`)].join('\n')
}
/** Vai no `initialize` do servidor do Observatório (`route.ts`); o servidor do Cowork não recebe. */
export const INSTRUCOES = instrucoesDe(FATIAS_LIGADAS)

const FORMA = {
  // tolerante de propósito: a IA vê o enum (anyOf) mas quem recusa a ação errada é o `ENTRADA` (formato e exemplo, sem eco, e entra no registro)
  acao: z.union([z.enum(ACOES), z.string()]).describe('A ação.'),
  canal_id: z.string().optional().describe('uuid do canal ou id do YouTube (canal, serie, mudancas).'),
  video_id: z.string().optional().describe('uuid ou id do YouTube do vídeo (video, serie).'),
  canal_ids: z.array(z.string()).optional().describe('consultar: até 6 canais do filtro (sem proprio). comparar: de 2 a 6 canais; o primeiro é comparado com cada um dos outros. serie: de 1 a 6 canais na mesma tabela (sempre CSV). Para incluir o seu canal, use `proprio` como primeiro id. Os ids (uuid) saem na coluna Id de listar_canais.'),
  janela: z.union([z.string(), z.number()]).optional().describe('7, 30, 90 ou todas.'),
  formato: z.string().optional().describe('todos, longos ou shorts.'),
  nicho: z.string().optional(),
  a_partir_da_linha: z.union([z.number(), z.string()]).optional().describe('listar_canais, destaques, mudancas: a 1ª linha desta janela (padrão 1); a seção Cobertura diz qual pedir a seguir.'),
  marca: z.string().optional().describe('devolvida pela Cobertura; repita na janela seguinte.'),
  saida: z.string().optional().describe('listar_canais, destaques, mudancas, consultar e serie: "tabela" devolve CSV para gráfico e planilha; padrão "texto".'),
  de: z.string().optional().describe('serie: AAAA-MM-DD.'),
  ate: z.string().optional().describe('serie: AAAA-MM-DD.'),
  grao: z.string().optional().describe('serie: dia ou semana.'),
  desde: z.string().optional().describe('mudancas: AAAA-MM-DD.'),
  tela: z.string().optional().describe('pacote_da_tela: a tela.'),
  id: z.string().optional().describe('pacote_da_tela: o id, se a tela pedir.'),
  parametros: z.record(z.string(), z.string()).optional().describe('pacote_da_tela: parâmetros da tela.'),
  entidade: z.string().optional().describe('consultar: video (padrão).'),
  lugar: z.string().optional().describe('consultar: local:<slug> ou pais:<XX>, os de definicoes.'),
  janela_idade: z.union([z.string(), z.array(z.string())]).optional().describe('consultar: todas, uma faixa ou lista (0-30, 31-90, 91-180, 181-365, 365+).'),
  publicado_de: z.string().optional().describe('consultar: AAAA-MM-DD.'),
  publicado_ate: z.string().optional().describe('consultar: AAAA-MM-DD.'),
  metricas: z.array(z.string()).optional().describe('consultar: views, likes, comentarios, vpd7, multiplicador, engajamento, inscritos.'),
  ordenar_por: z.string().optional().describe('consultar: uma das métricas (padrão multiplicador).'),
  direcao: z.string().optional().describe('consultar: desc (padrão) ou asc.'),
  limite: z.union([z.number(), z.string()]).optional().describe('consultar: de 1 a 50 linhas (padrão 20).'),
  incluir_base_fraca: z.union([z.boolean(), z.string()]).optional().describe('consultar: true inclui vídeos de base fraca no agregado do multiplicador.'),
}

export function registrarServidorDoObservatorio(server: McpServer, responder: Responder): void {
  // `passthrough`: chave sobrando chega ao `responder` (o `.strict()` do `ENTRADA` a recusa e grava `(desconhecido)`); o SDK padrão a tiraria em silêncio
  server.registerTool(NOME_DA_FERRAMENTA, { description: DESCRICAO, inputSchema: z.object(FORMA).passthrough(), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (entrada) => {
    try {
      const r = await executarChamada(entrada, { sb: getSupabaseServiceClient(), responder, agora: Date.now })
      return { content: [{ type: 'text' as const, text: r.texto }], ...(r.erro ? { isError: true } : {}) }
    } catch (e) {
      // "sem contexto" (fora da porta) ou falha imprevista: frase fechada, nada lido. Vai ao Sentry SEM a mensagem crua (Yannis I-1).
      Sentry.captureMessage('observatorio_leitura: falha fora de executarChamada', {
        level: 'error',
        tags: { component: 'observatorio-ia', step: 'servidor' },
        extra: { sem_contexto: e instanceof Error && e.message.startsWith('contexto do Observatório ausente') },
      })
      return { content: [{ type: 'text' as const, text: 'não foi possível atender: nada foi entregue' }], isError: true }
    }
  })
}
