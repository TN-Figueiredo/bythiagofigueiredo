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

export const CorpoAbrir = z.object({ passo: z.literal('abrir'), item_id }).strict()

const UnidadeNova = z.object({
  row_count: inteiro, control_sum: z.string().nullable(), hash_conteudo: sha, schema_fp: sha, sha256_bytes: sha, csv_sha256: sha, file_bytes: inteiro,
  partes: z.literal(1), min_key: z.null(), max_key: z.null(), parts: z.array(z.never()).length(0),
}).strict()

export const CorpoRegistrar = z.object({
  passo: z.literal('registrar'),
  item_id,
  classe: z.enum(CLASSES),
  canal: z.string().regex(UUID_RE),
  mes: z.string().regex(MES_RE),
  alvos: z.array(z.object({ alvo_id: inteiro, removidas: inteiro, unidade: UnidadeNova.nullable() }).strict()),
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
    resumo: z.object({ versao: inteiro, canal: z.array(Arquivo).or(z.unknown()), video: z.array(Arquivo).or(z.unknown()) }).nullable(),
    mes_online: z.boolean(), dias_do_mes: inteiro,
  })),
  esperando: inteiro,
})

export const RespostaRegistrar = z.object({
  status: z.literal('ok'),
  alvos: z.array(z.object({
    alvo_id: inteiro, estado: z.enum(['aguardando_nova', 'sem_linhas']), arquivo_id: inteiro.optional(), versao: inteiro.optional(),
  })),
  resumo: z.object({ arquivo_id: inteiro, versao: inteiro }).nullable(),
})

export const RespostaCanal = z.object({
  motivo: z.enum(['ok', 'canal_desconhecido', 'canal_nao_removido', 'canal_guardado', 'sem_destino']),
  prefixos: z.array(z.object({ filho: z.enum(['numerico', 'texto']), prefixo: z.string() })),
})

export type CorpoAbrir = z.infer<typeof CorpoAbrir>
export type RespostaAbrir = z.infer<typeof RespostaAbrir>
export type CorpoRegistrar = z.infer<typeof CorpoRegistrar>
export type RespostaRegistrar = z.infer<typeof RespostaRegistrar>
export type CorpoBloquear = z.infer<typeof CorpoBloquear>
export type CorpoCanal = z.infer<typeof CorpoCanal>
export type RespostaCanal = z.infer<typeof RespostaCanal>
export type CorpoExpurgo = z.infer<typeof CorpoExpurgo>
