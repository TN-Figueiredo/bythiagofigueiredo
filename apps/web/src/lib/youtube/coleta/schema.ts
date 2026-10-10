// Detecção de "a migration não foi aplicada" e conferência de erro em toda leitura e escrita.
// Regra: nenhuma escrita é descartada em silêncio. A nota nunca leva o texto do Postgres.

/** 42P01 tabela, 42703 coluna, PGRST204 coluna (PostgREST), PGRST205 tabela (PostgREST),
 *  PGRST202 função (PostgREST), 42883 função (Postgres). */
export const CODIGOS_SCHEMA_AUSENTE: readonly string[] = ['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST202', '42883']

export interface ErroBanco {
  code?: string | null
  message?: string | null
}

export function ehSchemaAusente(e: ErroBanco | null | undefined): boolean {
  return !!e?.code && CODIGOS_SCHEMA_AUSENTE.includes(e.code)
}

export function pushUnico(falhas: string[], nota: string): void {
  if (!falhas.includes(nota)) falhas.push(nota)
}

/** Início da nota que o passo `alcance` anota quando marca um relatório como `erro` (`… de <canal> não pôde ser normalizado (<motivo>)`). */
export const prefixoNotaErroAlcance = (reportId: string): string => `alcance: relatório ${reportId} de `

export type Escrita = 'ok' | 'schema_ausente' | 'erro'

/** Confere o `error` de uma resposta do Supabase e registra a falha crítica correspondente. */
export function conferirBanco(
  res: { error?: ErroBanco | null } | null | undefined,
  onde: string,
  falhas: string[],
  verbo: 'gravar' | 'ler' = 'gravar',
): Escrita {
  const e = res?.error
  if (!e) return 'ok'
  if (ehSchemaAusente(e)) {
    pushUnico(falhas, `schema_ausente: ${onde}`)
    return 'schema_ausente'
  }
  pushUnico(falhas, `erro de banco ao ${verbo} ${onde}`)
  return 'erro'
}
