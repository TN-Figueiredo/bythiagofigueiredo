// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato.ts
/**
 * Manutenção M9: o contrato C14 da rota de expurgo (plano M9, Tarefas 3 e 11). Puro: só `zod`.
 * Corpos `.strict()`; as respostas espelham as funções SQL da Tarefa 3.
 */
import { z } from 'zod'
import { CLASSES, MES_RE, SHA_RE, UUID_RE } from './contrato'

export const ITEM_ID_EXPURGO_RE = /^(?:item:\d{1,18}|canal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|antiga:\d{1,18})$/
const item_id = z.string().regex(ITEM_ID_EXPURGO_RE)
const sha = z.string().regex(SHA_RE)
const inteiro = z.number().int().min(0)
/** `arquivo_id` da resposta SQL é texto: `u:<uuid>` por alvo, `s:<uuid>` no resumo (plano M9, Tarefa 3). */
const arquivoId = z.string().regex(/^[us]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

export const CorpoAbrir = z.object({ passo: z.literal('abrir'), item_id }).strict()

const UnidadeNova = z.object({
  row_count: inteiro, control_sum: z.string().nullable(), hash_conteudo: sha, schema_fp: sha, sha256_bytes: sha.nullable(), csv_sha256: sha.nullable(), file_bytes: inteiro,
  partes: z.literal(1), min_key: z.null(), max_key: z.null(), parts: z.array(z.never()).length(0),
}).strict().superRefine((u, ctx) => {
  // m3b.sql:88: check ((row_count = 0) = (sha256_bytes is null)); unidade esvaziada vem com row_count 0 e shas nulos
  if ((u.row_count === 0) !== (u.sha256_bytes === null)) ctx.addIssue({ code: 'custom', message: 'row_count_e_sha_incoerentes' })
  if ((u.sha256_bytes === null) !== (u.csv_sha256 === null)) ctx.addIssue({ code: 'custom', message: 'shas_incoerentes' })
})

export const CorpoRegistrar = z.object({
  passo: z.literal('registrar'),
  item_id,
  classe: z.enum(CLASSES),
  canal: z.string().regex(UUID_RE),
  mes: z.string().regex(MES_RE),
  alvos: z.array(z.object({ alvo_id: inteiro, removidas: inteiro, unidade: UnidadeNova.nullable() }).strict().superRefine((a, ctx) => {
    // o SQL recusa `removidas > 0` com unidade nula (`forma`); sem remoção não há unidade nova
    if ((a.removidas > 0) !== (a.unidade !== null)) ctx.addIssue({ code: 'custom', message: 'removidas_e_unidade_incoerentes' })
  })),
  resumo: z.object({
    versao: inteiro, vazio: z.boolean(),
    canal_sha256: sha.nullable(), canal_bytes: inteiro, canal_rows: inteiro,
    video_sha256: sha.nullable(), video_bytes: inteiro, video_rows: inteiro,
    tabelas_lidas: z.array(z.string()),
  }).strict(),
}).strict()

export const CorpoBloquear = z.object({
  passo: z.literal('bloquear'),
  item_id,
  alvo_id: inteiro,
  motivo: z.enum(['antiga_ausente', 'antiga_divergente', 'grande_demais', 'contagem_divergente']),
}).strict()

export const CorpoCanal = z.object({ passo: z.literal('canal'), channel_ref: z.string().regex(UUID_RE) }).strict()

export const CorpoExpurgo = z.discriminatedUnion('passo', [CorpoAbrir, CorpoRegistrar, CorpoBloquear, CorpoCanal])

const Arquivo = z.object({ caminho: z.string(), sha256: sha, parte: inteiro })
const Alvo = z.object({
  alvo_id: inteiro, tabela: z.string(), versao: inteiro, linhas: inteiro, soma: z.string().nullable(), coluna_controle: z.string().nullable(),
  schema_fp: sha, hash_conteudo: sha, esperadas: inteiro.nullable(), chaves: z.array(z.string()), refs: z.array(z.string()), arquivos: z.array(Arquivo),
})
const Outra = z.object({
  tabela: z.string(), unidade_id: inteiro, versao: inteiro, linhas: inteiro, hash_conteudo: sha, arquivos: z.array(Arquivo),
})
export const RespostaAbrir = z.object({
  grupos: z.array(z.object({
    classe: z.enum(CLASSES), canal: z.string().regex(UUID_RE), mes: z.string().regex(MES_RE), filho: z.enum(['numerico', 'texto']),
    alvos: z.array(Alvo), outras: z.array(Outra),
    vazias: z.array(z.object({ tabela: z.string(), hash_conteudo: sha })),
    resumo: z.object({ versao: inteiro, canal: sha.nullable(), video: sha.nullable() }).nullable(),
    mes_online: z.boolean(), dias_do_mes: inteiro,
  })),
  esperando: inteiro,
})

const Recusa = z.object({ status: z.literal('recusado'), motivo: z.string(), alvo_id: inteiro.optional() })

export const RespostaRegistrar = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    alvos: z.array(z.object({
      alvo_id: inteiro, estado: z.enum(['aguardando_nova', 'sem_linhas']), arquivo_id: arquivoId.optional(), versao: inteiro.optional(),
    })),
    resumo: z.object({ arquivo_id: arquivoId, versao: inteiro }).nullable(),
  }),
  Recusa,
])

export const RespostaBloquear = z.discriminatedUnion('status', [z.object({ status: z.literal('ok') }), Recusa])

export const RespostaCanal = z.object({
  motivo: z.enum(['ok', 'canal_desconhecido', 'canal_nao_removido', 'canal_guardado', 'sem_destino']),
  prefixos: z.array(z.object({ filho: z.enum(['numerico', 'texto']), prefixo: z.string() })),
})

export type CorpoAbrir = z.infer<typeof CorpoAbrir>
export type RespostaAbrir = z.infer<typeof RespostaAbrir>
export type CorpoRegistrar = z.infer<typeof CorpoRegistrar>
export type RespostaRegistrar = z.infer<typeof RespostaRegistrar>
export type RespostaBloquear = z.infer<typeof RespostaBloquear>
export type CorpoBloquear = z.infer<typeof CorpoBloquear>
export type CorpoCanal = z.infer<typeof CorpoCanal>
export type RespostaCanal = z.infer<typeof RespostaCanal>
export type CorpoExpurgo = z.infer<typeof CorpoExpurgo>
