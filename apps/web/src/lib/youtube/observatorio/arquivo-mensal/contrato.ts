// apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
/**
 * Manutenção M3b: o contrato das rotas /api/pipeline/archive/ (plano M3b-site, seção "Contrato das rotas"). Puro: só `zod`.
 * As listas fechadas são as da política do banco (`obs_archive_policy()`); um teste de integração (Tarefa 3) as compara.
 */
import { z } from 'zod'

export const CLASSES = ['horaria', 'serie', 'texto', 'video_antigo', 'ensaio'] as const
export type Classe = (typeof CLASSES)[number]
export type Filho = 'numerico' | 'texto'
export const FILHO_DA_CLASSE: Readonly<Record<Classe, Filho>> = {
  horaria: 'numerico', serie: 'numerico', ensaio: 'numerico', texto: 'texto', video_antigo: 'texto',
}
export const TABELAS_DA_CLASSE: Readonly<Record<Classe, readonly string[]>> = {
  horaria: ['competitor_video_hourly'],
  serie: ['competitor_video_daily', 'competitor_video_early'],
  texto: ['competitor_video_comments', 'competitor_video_comment_marks', 'competitor_raw'],
  ensaio: ['obs_archive_rehearsal'],
  video_antigo: [
    'competitor_video_versions', 'competitor_field_versions', 'competitor_raw', 'competitor_video_tier_spans',
    'competitor_video_comment_snaps', 'competitor_hour_fold_log', 'competitor_changes', 'competitor_readings',
  ],
}
export const COLUNA_DE_CONTROLE: Readonly<Record<string, string | null>> = {
  competitor_video_hourly: 'views', competitor_video_daily: 'views', competitor_video_early: 'views', obs_archive_rehearsal: 'views',
  competitor_video_comment_marks: 'likes',
  competitor_video_comments: null, competitor_raw: null, competitor_video_versions: null, competitor_field_versions: null,
  competitor_video_tier_spans: null, competitor_video_comment_snaps: null, competitor_hour_fold_log: null, competitor_changes: null,
  competitor_readings: null,
}
export const RESERVADOS = ['_recebendo', '_canario', 'canais', 'resumo', 'miniaturas', 'manifestos'] as const
/**
 * CP13 (medida de 14/10 no bythiago_int, 54422): uma chamada de obs_archive_read_unit custa ~220 ms (diária, 99.200 linhas) e ~410 ms
 * (comentários, 100.000 linhas de ~565 B no jsonb) com limit de 2.000, 5.000 ou 10.000: o custo é o da unidade inteira, não da página.
 * O tempo deixaria 10.000; o tamanho da resposta não (5.000 linhas largas = 2,8 MB, 10.000 = 5,6 MB, acima dos 4,5 MB da função).
 */
export const TETO_LINHAS_POR_CHAMADA = 5_000
/**
 * CP13 (D25): acima disto, 413 grande_demais antes de ler qualquer página. Medido: 100.000 linhas largas em 20 páginas de 5.000 = 8,0 s;
 * 99.200 estreitas em páginas de 2.000 = 11,7 s (metade do maxDuration = 60 é 30 s; custo quadrático, ~190 mil linhas chegariam a 30 s).
 * NÃO MEDIDO contra a maior unidade de produção × 3 (diária, early, marcas, horária e comentários; o script do dono é
 * m3b/m3b-0-leituras-prod.sh, saída em saidas/m3b-0-*.txt); o valor é da medida sintética. AMARRAÇÃO (Phil I3): o teto vale se o
 * maior de produção × 3 ficar abaixo de 60.000 (100.000 só se a CPU de produção igualar a local; 11,7 s × 4,05 = 47,4 s > 30 s com 99.200 linhas); acima disso, pagar a D25
 * (hash incremental no read_unit) ANTES da Tarefa 11. Unidade acima do teto responde 413 e só vira vermelho 30 dias depois.
 */
export const TETO_LINHAS_DA_UNIDADE = 60_000
export const TETO_BYTES_POR_PARTE = 3 * 1024 * 1024
export const TETO_PARTES = 99
export const TENTATIVAS_DE_LEITURA = 3

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const MES_RE = /^20\d{2}-(0[1-9]|1[0-2])$/
export const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const SHA_RE = /^[0-9a-f]{64}$/
export const SOMA_RE = /^-?\d{1,40}$/

const classe = z.enum(CLASSES)
const canal = z.string().regex(UUID_RE)
const mes = z.string().regex(MES_RE)
const sha = z.string().regex(SHA_RE)
const soma = z.string().regex(SOMA_RE).nullable()
const arquivoId = z.string().min(3).max(120)
/** Fora do Zod de propósito: o `refine` viraria 400 VALIDATION_ERROR, e o contrato promete 422 classe_tabela_invalida (C0, C3). A rota chama depois do parseBody. */
export const parDaPolitica = (o: { classe: Classe; tabela: string }): boolean => TABELAS_DA_CLASSE[o.classe].includes(o.tabela)

export const CorpoExportar = z.object({
  classe, tabela: z.string().min(1).max(63), canal, mes, parte: z.number().int().min(1).max(TETO_PARTES).optional(),
}).strict()
export const CorpoResumo = z.object({ classe, canal, mes }).strict()
export const CorpoManifesto = z.object({ classe, mes }).strict()
export const CorpoRecebido = z.object({
  itens: z.array(z.object({
    arquivo_id: arquivoId, sha256: sha, bytes: z.number().int().min(0), linhas: z.number().int().min(0).nullable(), soma,
  }).strict()).min(1).max(100),
}).strict()

const estadoDoFilho = z.object({ montado: z.boolean(), sentinela: z.boolean() }).strict()
const AtestarNas = z.object({
  fonte: z.literal('nas'), plano_id: canal,
  filhos: z.object({ numerico: estadoDoFilho, texto: estadoDoFilho }).strict(),
  canarios: z.array(z.object({ filho: z.enum(['numerico', 'texto']), dia: z.string().regex(DIA_RE), sha256: sha }).strict()).max(2),
  itens: z.array(z.object({
    arquivo_id: arquivoId, resultado: z.enum(['presente', 'ausente', 'nas_fora', 'ilegivel']),
    sha256: sha.optional(), bytes: z.number().int().min(0).optional(), linhas: z.number().int().min(0).nullable().optional(), soma: soma.optional(),
  }).strict()
    .refine(i => i.resultado !== 'presente' || (i.sha256 !== undefined && i.bytes !== undefined), { message: 'presente_sem_valores' })
    .refine(i => i.resultado !== 'ilegivel' || (i.sha256 === undefined && i.bytes === undefined && i.linhas === undefined && i.soma === undefined),
      { message: 'ilegivel_com_valores' })).max(500),
}).strict()
const AtestarB2 = z.object({
  fonte: z.literal('b2'), execucao_id: canal,
  itens: z.array(z.object({
    arquivo_id: arquivoId, resultado: z.enum(['presente', 'ausente', 'sem_acesso', 'chave_ausente', 'nao_decifra']),
    sha256: sha.optional(), bytes: z.number().int().min(0).optional(), linhas: z.number().int().min(0).nullable().optional(), soma: soma.optional(),
    file_id: z.string().min(1).max(200).optional(), upload_timestamp: z.number().int().min(0).optional(),
    tentativa: z.union([z.literal(1), z.literal(2)]),
  }).strict().superRefine((i, ctx) => {
    const semValores = i.sha256 === undefined && i.bytes === undefined && i.linhas === undefined && i.soma === undefined
    const comFileId = i.file_id !== undefined && i.upload_timestamp !== undefined
    if (i.arquivo_id === 'controle_negativo' && i.resultado === 'presente') {
      // Pedido 10: a forja não baixa o que não devia existir.
      if (!comFileId || !semValores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'negativo_presente_forma' })
    } else if (i.resultado === 'presente') {
      if (i.sha256 === undefined || !comFileId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'presente_sem_file_id' })
    } else if (i.resultado === 'nao_decifra') {
      // K4: divergente já no primeiro informe; só o fileId identifica a cópia estragada.
      if (!comFileId || !semValores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nao_decifra_forma' })
    }
  })).min(1).max(200),
}).strict()
export const CorpoAtestar = z.discriminatedUnion('fonte', [AtestarNas, AtestarB2])
export type CorpoAtestarNas = z.infer<typeof AtestarNas>
export type CorpoAtestarB2 = z.infer<typeof AtestarB2>

export const CorpoBatimento = z.object({
  versao: z.string().min(1).max(40), hora_maquina: z.string().datetime({ offset: true }), nas_ok: z.boolean(),
  montagens_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict(),
  sentinela_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict(),
  livre_bytes: z.object({ numerico: z.number().int().min(0).nullable(), texto: z.number().int().min(0).nullable() }).strict(),
  total_bytes: z.object({ numerico: z.number().int().min(0).nullable(), texto: z.number().int().min(0).nullable() }).strict(),
  parado_no_teto: z.enum(['dia', 'mes']).nullable(),
  ultimo_erro: z.string().max(200).nullable(),
}).strict()

export const ItemArquivo = z.object({
  arquivo_id: arquivoId, tipo: z.enum(['unidade', 'parte', 'resumo', 'manifesto', 'anexo']), filho: z.enum(['numerico', 'texto']),
  caminho: z.string().min(1).max(300), classe, tabela: z.string().nullable(), canal: canal.nullable(), mes, versao: z.number().int().min(1),
  coluna_controle: z.string().nullable(),
}).strict()
export type ItemArquivo = z.infer<typeof ItemArquivo>

// Respostas: toda rota valida o `data` contra o esquema `.strict()` antes de sair; as RPCs são lidas com `.safeParse`, nunca com `as`.
const filho = z.enum(['numerico', 'texto'])
const vermelhos = z.array(z.string().max(300))
const iso = z.string().datetime({ offset: true })
export const RespostaPlano = z.object({
  plano_id: canal, gerado_em: iso, modo: z.enum(['normal', 'completo']), cursor_seguinte: z.string().max(200).nullable(),
  primeira_selagem: mes.nullable(), vermelhos, canario: z.object({ dia: z.string().regex(DIA_RE) }).strict(),
  exportar: z.array(z.object({ classe, tabela: z.string(), canal, mes, motivo: z.enum(['nova', 'conteudo_mudou', 'arquivo_ausente', 'divergente',
    'conteudo_divergente', 'mudou_durante_a_leitura', 'parte_mudou']) }).strict()),
  resumos: z.array(z.object({ classe, canal, mes }).strict()), manifestos: z.array(z.object({ classe, mes }).strict()),
  aguardando_dono: z.array(ItemArquivo.extend({ b2_file_id_bom: z.string().nullable() })),
  a_apagar: z.array(z.object({ filho, caminho: z.string().min(1).max(320) }).strict()),
  reconferir: z.array(ItemArquivo).max(1000), prefixos_ausentes: z.array(z.never()).length(0),
}).strict()
const estadoFilhoB2 = z.enum(['aguardando_primeira_selagem', 'nada_devido', 'com_pedidos'])
export const RespostaPlanoB2 = z.object({
  execucao_id: canal, gerado_em: iso, modo: z.enum(['normal', 'completo']), cursor_seguinte: z.string().max(200).nullable(),
  primeira_selagem: mes.nullable(), vermelhos, estado: z.object({ numerico: estadoFilhoB2, texto: estadoFilhoB2 }).strict(),
  teto_bytes_dia: z.number().int().min(0), teto_bytes_mes: z.number().int().min(0),
  controle_negativo: z.object({ arquivo_id: z.literal('controle_negativo'), filho, caminho: z.string().min(1) }).strict(),
  canarios: z.array(z.object({ arquivo_id: z.enum(['canario:numerico', 'canario:texto']), filho,
    caminho: z.string().regex(/^_canario\/\d{4}-\d{2}-\d{2}$/).nullable() }).strict()).length(2),
  arquivos: z.array(ItemArquivo).max(500), prefixos_ausentes: z.array(z.never()).length(0),
  // r2.2 (I3 do Phil): o completo que não terminou é retomado pelo site; no normal os dois vêm nulos.
  retomado_de: z.string().min(1).max(200).nullable(),
  cobertura: z.object({ paginas_aceitas: z.number().int().min(0), paginas_total: z.number().int().min(1) }).strict()
    .refine(c => c.paginas_aceitas <= c.paginas_total, 'cobertura_acima_do_total').nullable(),
}).strict().superRefine((d, ctx) => {
  const ok = d.modo === 'normal' ? d.retomado_de === null && d.cobertura === null : d.cobertura !== null
  if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'retomada_fora_do_modo' })
})
// r2.2 (M6 do Phil): a cor do teto de bytes, contada pelo site; não nula só para o conferir_b2.
export const RespostaBatimento = z.object({ gravado: z.boolean(), teto: z.enum(['verde', 'ambar', 'vermelho']).nullable() }).strict()
export const RespostaAtestarNas = z.object({
  itens: z.array(z.object({ arquivo_id: arquivoId, resposta: z.enum(['aceito', 'recusado']), motivo: z.enum(['desconhecido', 'filho_fora', 'forma']).optional() }).strict()),
  canarios: z.array(z.object({ filho, dia: z.string().regex(DIA_RE), resposta: z.enum(['aceito', 'recusado']),
    motivo: z.enum(['sha256_diferente_no_dia', 'dia_invalido']).optional() }).strict()),
}).strict()
export const RespostaAtestarB2 = z.object({
  execucao: z.object({ estado: z.enum(['aguardando_controle', 'controle_ok', 'controle_falhou']), negativo_ok: z.boolean(),
    canario_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict() }).strict(),
  itens: z.array(z.object({ arquivo_id: arquivoId, resposta: z.enum(['aceito', 'repetir', 'recusado']),
    motivo: z.enum(['controle_pendente', 'controle_falhou', 'sem_file_id', 'file_id_invalido', 'desconhecido', 'execucao_vencida', 'forma']).optional() }).strict()),
}).strict()
/** Dado das RPCs que a rota de exportar lê (Yannis M10). */
export const RespostaParteInfo = z.object({
  status: z.literal('ok'), unidade_id: canal, versao: z.number().int().min(1), partes: z.number().int().min(1).max(TETO_PARTES),
  de: z.number().int().min(0), ate: z.number().int().min(0), sha256: sha, recebida: z.boolean(),
}).strict()
export const RespostaRecord = z.object({
  // o banco devolve `arquivo_id` ('u:<uuid>', C0.2 e C3 do contrato), nunca `unidade_id` (Yannis 9): o passthrough escondia a diferença
  status: z.string().min(1).max(40), arquivo_id: z.string().regex(/^u:[0-9a-f-]{36}$/).optional(), versao: z.number().int().min(1).optional(),
}).passthrough()

/** Códigos que as rotas devolvem em `error.code` (além de VALIDATION_ERROR, FORBIDDEN, UNAUTHORIZED), com o status. */
export const STATUS_DO_CODIGO = {
  arquivo_desligado: 503, erro_do_banco: 500, tempo_esgotado: 504,
  canal_removido: 409, sem_destino: 409, unidade_retirada: 409, mes_aberto: 409, nao_devida: 409, mes_fora_do_banco: 409,
  mudou_durante_a_leitura: 409, parte_mudou: 409, unidades_pendentes: 409, conteudo_mudou: 409, resumos_pendentes: 409,
  ja_no_arquivo: 409, resumo_da_m10b: 409,
  grande_demais: 413, classe_tabela_invalida: 422, faixa_invalida: 422,
  tabela_ausente: 409, // X3 (controlador, 14/10): 409. A forja decide pelo code.
} as const
export const CODIGOS = Object.keys(STATUS_DO_CODIGO) as (keyof typeof STATUS_DO_CODIGO)[]
export type CodigoArquivo = keyof typeof STATUS_DO_CODIGO
