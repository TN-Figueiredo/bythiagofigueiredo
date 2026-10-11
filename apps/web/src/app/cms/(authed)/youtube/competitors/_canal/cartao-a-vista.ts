/**
 * O cartão do último vídeo visto está dentro da área visível do contêiner que rola (`main`)? Puro, porque o jsdom não tem layout; a
 * prova com layout real é do Playwright. Quem anda vários vídeos com Anterior/Próximo volta para um cartão que a rolagem restaurada
 * (a de antes do primeiro vídeo) deixa fora da tela.
 */
export interface Retangulo { top: number; bottom: number }

/**
 * `true` quando é preciso trazer o alvo para a vista. Sem layout (área ou alvo sem altura) nunca rola. Alvo mais alto que a área só
 * precisa de ajuda se não cruzar a área. `margem` é a folga que o cartão precisa ter em cada borda para contar como à vista.
 */
export function precisaTrazer(alvo: Retangulo, area: Retangulo, margem = 8): boolean {
  if (area.bottom - area.top <= 0 || alvo.bottom - alvo.top <= 0) return false
  if (alvo.bottom - alvo.top > area.bottom - area.top) return alvo.bottom <= area.top || alvo.top >= area.bottom
  return alvo.top < area.top + margem || alvo.bottom > area.bottom - margem
}
