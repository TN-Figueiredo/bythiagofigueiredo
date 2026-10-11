/**
 * O último vídeo que o Histórico mostrou a quem veio da página de um canal (spec 3: "Voltar sai para a lista de origem, no cartão do
 * ÚLTIMO vídeo visto"). Anterior/Próximo substituem a entrada do histórico do navegador, então a URL do canal a que o Voltar leva é a de
 * antes do primeiro vídeo; é daqui que a página do canal sabe onde pôr o foco. `sessionStorage`, sempre em try/catch: sem ele a
 * página volta como volta o navegador (conforto, nunca requisito).
 *
 * O registro leva um carimbo de tempo e expira (30 min): um registro que ninguém consumiu não pode fazer um `popstate` qualquer, muito
 * depois, pular o foco para um cartão antigo. Leva também POR ONDE a pessoa saiu da aba Trocas (o link "Abrir nesta troca" ou o botão
 * "Abrir histórico do vídeo" do cartão; spec 3, tabela de entradas) e, por poucos segundos, que ela voltou pelo item do canal na trilha
 * (um `push`, não um `popstate`, mas o spec 6.5 o trata como o Voltar).
 */
const PREFIXO = 'obs:ultimo-video:'
const VALE_MS = 30 * 60_000
const TRILHA_MS = 10_000

export type SaidaDoCartao = 'cartao' | 'troca'
export interface UltimoVideo { id: string; via: SaidaDoCartao; troca: string | null }
interface Guardado { v: string; t: number; via: SaidaDoCartao; troca: string | null; trilha: number | null }

function ler(canalId: string): Guardado | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIXO + canalId)
    if (raw == null) return null
    let g: Partial<Guardado> | null = null
    try { g = JSON.parse(raw) as Partial<Guardado> } catch { g = null }
    if (!g || typeof g.v !== 'string' || !g.v || typeof g.t !== 'number' || Date.now() - g.t > VALE_MS || g.t - Date.now() > 60_000) {
      window.sessionStorage.removeItem(PREFIXO + canalId)   // formato antigo, lixo ou velho: ignorado e apagado
      return null
    }
    return { v: g.v, t: g.t, via: g.via === 'troca' ? 'troca' : 'cartao', troca: g.via === 'troca' && typeof g.troca === 'string' ? g.troca : null, trilha: typeof g.trilha === 'number' ? g.trilha : null }
  } catch { return null }
}

function gravar(canalId: string, g: Guardado): void {
  try { window.sessionStorage.setItem(PREFIXO + canalId, JSON.stringify(g)) } catch { /* conforto */ }
}

/** A página do canal, no clique que leva ao Histórico: por onde a pessoa saiu (só importa na aba Trocas). */
export function lembrarSaida(canalId: string, videoId: string, via: SaidaDoCartao, troca?: string): void {
  gravar(canalId, { v: videoId, t: Date.now(), via, troca: via === 'troca' ? troca ?? null : null, trilha: null })
}

/** O Histórico, ao mostrar um vídeo: o mesmo vídeo de que a pessoa saiu mantém o "por onde"; outro vídeo (o pager andou) vale pelo cartão. */
export function lembrarUltimoVideo(canalId: string, videoId: string): void {
  const ant = ler(canalId)
  if (ant && ant.v === videoId) gravar(canalId, { ...ant, t: Date.now() })
  else gravar(canalId, { v: videoId, t: Date.now(), via: 'cartao', troca: null, trilha: null })
}

/** Renova o prazo (a pessoa ainda está no Histórico, por exemplo ao clicar num link dele). */
export function renovarUltimoVideo(canalId: string): void {
  const g = ler(canalId)
  if (g) gravar(canalId, { ...g, t: Date.now() })
}

/** O item do canal na trilha foi clicado: a página do canal vai tratar a chegada como um Voltar (por poucos segundos). */
export function marcarVoltaPelaTrilha(canalId: string): void {
  const g = ler(canalId)
  if (g) gravar(canalId, { ...g, t: Date.now(), trilha: Date.now() })
}

export function chegouPelaTrilha(canalId: string): boolean {
  const g = ler(canalId)
  return g?.trilha != null && Date.now() - g.trilha <= TRILHA_MS
}

/** `null` quando não há registro, ele é velho ou está estragado (e então é apagado). */
export function lerUltimoVideo(canalId: string): UltimoVideo | null {
  const g = ler(canalId)
  return g ? { id: g.v, via: g.via, troca: g.troca } : null
}

/** O Voltar já usou o registro: o próximo Voltar para a página não repete o foco. */
export function esquecerUltimoVideo(canalId: string): void {
  try { window.sessionStorage.removeItem(PREFIXO + canalId) } catch { /* conforto */ }
}
