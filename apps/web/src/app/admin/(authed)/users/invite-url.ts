/**
 * Link que a pessoa convidada abre para aceitar. É o mesmo valor que vai no
 * e-mail e no botão "Copiar link do convite" — o link é o plano B quando o
 * e-mail não chega, então os dois precisam sair do mesmo lugar.
 */
export function inviteAcceptUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  return `${baseUrl.replace(/\/+$/, '')}/signup/invite/${token}`
}
