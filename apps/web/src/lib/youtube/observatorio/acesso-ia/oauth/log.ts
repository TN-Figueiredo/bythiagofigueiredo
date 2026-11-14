/** Código do erro do Postgres/PostgREST para o log. `''` (falha de rede do postgrest-js) e ausente viram 'sem_codigo'. */
export const codigoDeErroPg = (e: unknown): string => (e as { code?: string } | null)?.code || 'sem_codigo'
