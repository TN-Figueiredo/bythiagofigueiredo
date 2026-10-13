/**
 * As constantes de tempo do disparo do cron de concorrentes, SEM importar nada. Moram aqui (e não em `competitor-sync-batch.ts`) para que
 * `agenda/definicoes.ts` e o vigia (`/api/health`, `cron-watchdog`) as leiam sem carregar a coleta inteira (Sentry, cliente de serviço, sync,
 * captura, cota, notificações, classificador de Shorts). `competitor-sync-batch.ts` as reexporta com os mesmos nomes.
 * A conta está comentada no topo de `competitor-sync-batch.ts`.
 */
/** A duração máxima da função do cron (`export const maxDuration` da rota). Um teste confere os dois. */
export const COMPETITORS_MAX_DURATION_S = 300
/** A prova da captura e da série tem teto próprio: estourou, é vermelho ("não foi possível ler a prova a tempo"). */
export const PROOF_TIMEOUT_MS = 20_000
/** Gravar o resumo no `cron_health`, invalidar o cache, a partida da função e uma folga (a rota só chega aqui depois da prova). */
export const RECORD_RESERVE_MS = 15_000
/** O que o fim do disparo precisa inteiro: a prova no seu teto e a gravação. */
export const FINISH_RESERVE_MS = PROOF_TIMEOUT_MS + RECORD_RESERVE_MS
/** O pior caso de um canal sincronizado (medido: 13 a 27 s em produção; ~34 s estimado com a E1 nova; margem para o dobro). A sincronização do canal não tem relógio. */
export const CHANNEL_CALL_WORST_MS = 65_000
/** O pior caso de UMA chamada da fase semanal com download: sonda da miniatura 45 s (HEAD 10 + GET 15 + 2 cópias de 10) e a cauda no banco. */
export const WEEKLY_CALL_WORST_MS = 55_000

/** Depois disso o lote não começa canal novo. (Era o literal 200_000 da rota.) */
export const BATCH_BUDGET_MS = COMPETITORS_MAX_DURATION_S * 1000 - FINISH_RESERVE_MS - CHANNEL_CALL_WORST_MS
// O corte fixo de 150 s saiu: ele era contado do início do disparo, e a ordem dos canais é a mesma todo dia, então os canais das
// posições 7 a 11 nunca leriam os semanais. A leitura semanal é uma FASE do disparo.
/** Depois disso a fase semanal não começa vídeo novo: o que resta é menor que o pior caso de uma chamada com download mais a reserva do fim. */
export const WEEKLY_DEADLINE_MS = COMPETITORS_MAX_DURATION_S * 1000 - FINISH_RESERVE_MS - WEEKLY_CALL_WORST_MS
