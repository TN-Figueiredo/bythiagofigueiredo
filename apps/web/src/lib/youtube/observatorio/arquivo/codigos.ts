/**
 * A5 · E10: o catálogo de CÓDIGOS das recusas do banco (`E10:<codigo>: texto`) e as FRASES que o dono lê. Puro, só relativo:
 * o comando (`cli.ts`), `exportar.ts`, `conferir.ts` e `remover.ts` importam daqui. `remover.ts` fala com o Blob e com o Sentry e
 * o comando não pode importá-lo (o `tsx` da raiz não resolve `@/`, `server-only` nem `next/*`).
 *
 * Regra de ouro: o TEXTO do erro do banco (depois do segundo `:`) nunca vai para tela, nota, e-mail nem Sentry. Ele pode levar
 * nome de tabela, mês e contagens. A frase vem sempre deste catálogo, por código. Nenhuma frase aqui diz "lote" nem "MB": a palavra
 * de tela é "exportação" (os códigos, o argumento `--lote` e os nomes de tabela e de função não mudam).
 */
import { RULES } from '../rules'

export type CodigoE10 =
  | 'demorou_demais' | 'forja_em_andamento' | 'canal_nao_encontrado' | 'nao_pausado' | 'sem_lote' | 'lote_nao_conferido'
  | 'lote_nao_confirmado' | 'despausado_depois_do_export' | 'banco_difere_do_manifesto' | 'tabela_sem_export' | 'sobrou_linha'
  | 'sem_direito' | 'pausa_recente' | 'sincronizando' | 'lote_ja_apagado' | 'pausa_sem_remendo' | 'parametro_nulo'
  | 'schema_ausente' | 'inesperado'

/** Os códigos que o banco (MG6) levanta com `E10:<codigo>:`. `demorou_demais`, `schema_ausente` e `inesperado` nascem do código do erro, nunca da mensagem. */
const DO_BANCO: ReadonlySet<string> = new Set<CodigoE10>([
  'forja_em_andamento', 'canal_nao_encontrado', 'nao_pausado', 'sem_lote', 'lote_nao_conferido', 'lote_nao_confirmado',
  'despausado_depois_do_export', 'banco_difere_do_manifesto', 'tabela_sem_export', 'sobrou_linha', 'sem_direito', 'pausa_recente',
  'sincronizando', 'lote_ja_apagado', 'pausa_sem_remendo', 'parametro_nulo',
])

const MENSAGEM_E10 = /^E10:([a-z_]+):/

/**
 * O código de um erro do banco. Olha o `code` ANTES da mensagem: `57014` (instrução cancelada por tempo) é `demorou_demais`;
 * função que não existe (`PGRST202`, `42883`) é `schema_ausente`. Depois, só o que casa com `^E10:([a-z_]+):` e está no catálogo.
 * Qualquer outra coisa (mensagem sem o prefixo, código desconhecido, nulo) é `inesperado`.
 */
export function codigoE10(erro: { message?: string; code?: string } | null | undefined): CodigoE10 {
  if (!erro) return 'inesperado'
  if (erro.code === '57014') return 'demorou_demais'
  if (erro.code === 'PGRST202' || erro.code === '42883') return 'schema_ausente'
  const m = typeof erro.message === 'string' ? MENSAGEM_E10.exec(erro.message) : null
  if (m && DO_BANCO.has(m[1]!)) return m[1] as CodigoE10
  return 'inesperado'
}

export const FRASES_E10: Record<CodigoE10, string> = {
  demorou_demais: 'A remoção passou do tempo e nada foi apagado. O canal continua pausado e a exportação continua confirmada; remova pelo comando `remover`.',
  forja_em_andamento: 'Há uma leitura da forja em andamento para um vídeo deste canal. Espere ela terminar e exporte de novo.',
  canal_nao_encontrado: 'Este canal não foi encontrado neste site.',
  nao_pausado: 'A coleta deste canal não está pausada. Pause a coleta antes de exportar.',
  sem_lote: 'Este canal ainda não foi exportado.',
  lote_nao_conferido: 'A exportação deste canal ainda não foi conferida. Rode a conferência antes de continuar.',
  lote_nao_confirmado: 'Falta confirmar a cópia da exportação no NAS.',
  despausado_depois_do_export: 'A coleta deste canal foi retomada depois da exportação, então ela deixou de valer. Exporte de novo.',
  banco_difere_do_manifesto: 'O banco mudou depois da exportação: há dado que o arquivo não tem. Nada foi apagado. Exporte de novo.',
  tabela_sem_export: 'Existe uma tabela do canal que a exportação ainda não cobre. Nada foi apagado.',
  sobrou_linha: 'Depois de apagar, sobrou dado do canal em alguma tabela. A operação foi desfeita e nada foi apagado.',
  sem_direito: 'Só quem administra o site pode fazer isto.',
  pausa_recente: `A coleta foi pausada há pouco. Espere ${RULES.pause.minMinutesBeforeExport} minutos depois de pausar antes de exportar.`,
  sincronizando: 'O canal está sendo sincronizado agora. Espere terminar e tente de novo.',
  lote_ja_apagado: 'Já existe uma exportação apagada com este nome. Use outro nome.',
  pausa_sem_remendo: 'A migration da pausa não está completa: alguma função da coleta não conhece a pausa. Nada foi pausado.',
  parametro_nulo: 'Faltou um dado no pedido. Nada foi feito.',
  schema_ausente: 'A migration da exportação ainda não foi aplicada neste banco. Nada foi feito.',
  inesperado: 'Algo inesperado aconteceu e nada foi apagado. A causa foi registrada; tente de novo mais tarde.',
}
