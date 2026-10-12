// E19: as ações que o registro de leitura do pipeline grava em audit_log. Sem dependência nenhuma, de propósito.
export const ACAO_AVISO = 'pipeline_leitura_aviso'
export const ACAO_RECUSA = 'pipeline_leitura_recusada'
export const ACOES_DE_LEITURA: readonly string[] = [ACAO_AVISO, ACAO_RECUSA]
export const RECURSO_CHAVE = 'pipeline_api_key'
