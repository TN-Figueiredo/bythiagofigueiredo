/**
 * O último vídeo que o Histórico mostrou a quem veio da página de um canal (spec 3: "Voltar sai para a lista de origem, no cartão do
 * ÚLTIMO vídeo visto"). Anterior/Próximo substituem a entrada do histórico do navegador, então a URL do canal a que o Voltar leva é a de
 * antes do primeiro vídeo; é daqui que a página do canal sabe onde pôr o foco. `sessionStorage`, sempre em try/catch: sem ele a
 * página volta como volta o navegador (conforto, nunca requisito).
 */
const PREFIXO = 'obs:ultimo-video:'

export function lembrarUltimoVideo(canalId: string, videoId: string): void {
  try { window.sessionStorage.setItem(PREFIXO + canalId, videoId) } catch { /* conforto */ }
}

export function lerUltimoVideo(canalId: string): string | null {
  try { return window.sessionStorage.getItem(PREFIXO + canalId) || null } catch { return null }
}

/** O Voltar já usou o registro: o próximo Voltar para a página não repete o foco. */
export function esquecerUltimoVideo(canalId: string): void {
  try { window.sessionStorage.removeItem(PREFIXO + canalId) } catch { /* conforto */ }
}
