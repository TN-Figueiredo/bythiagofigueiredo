const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })

/** Hora (Brasília) da falha de leitura; calculada no servidor e passada por prop, para SSR e hidratação não divergirem. */
export function horaDaFalha(d: Date): string {
  return hora.format(d)
}
