// Identidade da leitura anônima da watch do YouTube. Fonte única: a rota do portão P-V e o leitor
// de produção da S4 importam daqui. Mudar qualquer literal muda o que o YouTube serve (A/B do T&C).
export const USER_AGENT_LEITOR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
export const ACCEPT_LANGUAGE_LEITOR = 'pt-BR'

export function urlWatch(ytId: string): string {
  return `https://www.youtube.com/watch?v=${ytId}&hl=pt-BR&gl=BR`
}
