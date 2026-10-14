import type { Writable } from 'node:stream'

/** Terminal fechado (SIGHUP): escrever vira EIO assíncrono; sem ouvinte de 'error' o processo morre antes de devolver a original. */
export function protegerSaida(streams: readonly Pick<Writable, 'on'>[]): void {
  for (const s of streams) s.on('error', () => { /* terminal fechado: o registro.jsonl continua */ })
}

/** Dois sinais em menos de 1 s são o mesmo Ctrl-C (o tsx repassa o SIGINT ao filho que já o recebeu do grupo). */
export function sinalRepetido(ultimoEm: number | null, agora: number): boolean {
  return ultimoEm !== null && agora - ultimoEm < 1_000
}
