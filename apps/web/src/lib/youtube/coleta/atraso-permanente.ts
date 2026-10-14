// A regra do fim do alarme: vídeo atrasado deixa de ser vermelho e vira ação do dono (A5 E6/E8, Tarefa 2b).
// Pura: sem banco e sem rede. Usada pelo passo do diário, pelo critério de cobertura e pelo passo da retenção.
//
// `youtubeNaoDevolveu` é a MESMA regra de `diario_falhas_4d` em `yt_own_retention_facts` (SQL). Os casos de
// teste são os mesmos dos dois lados: mudou um, mude o outro.

export const ATRASO = { diasDeVermelho: 3, diasDeTentativa: 4 } as const

export interface Atrasado {
  ytId: string
  /** 0 no primeiro dia em que o vídeo passou do limite de atraso de quem chama; cresce 1 por dia. */
  diasAtrasado: number
  /**
   * Em quantos dos 4 últimos dias UTC a tentativa `diario` do vídeo terminou com o YouTube NÃO devolvendo o
   * vídeo (`youtubeNaoDevolveu`; falha nossa ou de cota não conta). null = não foi lido.
   */
  falhasDoDiario4d: number | null
}

export interface TentativaDoDiario {
  outcome: string
  http_status: number | null
  error: string | null
}

const STATUS_DE_VIDEO_AUSENTE: readonly number[] = [403, 404, 410]
// Sem `/i` de propósito: igual ao `!~` (e não `!~*`) do SQL de `diario_falhas_4d`; 'limitexceeded' em minúsculas não é de cota.
const ERRO_DE_COTA = /(quota|Limit)Exceeded/

/**
 * Verdadeiro quando o YouTube não devolveu o vídeo: `sem_dado_na_janela`, ou `erro_http` com status 403, 404
 * ou 410 cujo `error` não seja de cota. Falso para falha nossa (erro_de_banco, forma_inesperada, excecao,
 * orçamento, autorização, schema), para 400, 429, 5xx, 403 de cota e para `ok`.
 */
export function youtubeNaoDevolveu(t: TentativaDoDiario): boolean {
  if (t.outcome === 'sem_dado_na_janela') return true
  if (t.outcome !== 'erro_http') return false
  if (t.http_status === null || !STATUS_DE_VIDEO_AUSENTE.includes(t.http_status)) return false
  return !ERRO_DE_COTA.test(t.error ?? '')
}

/**
 * Separa, entre os atrasados, os que continuam vermelhos dos que viram ação do dono. Candidato a ação do
 * dono: `diasAtrasado >= 3` e `falhasDoDiario4d === 4` (nulo nunca é candidato). Se os candidatos são metade
 * ou mais dos `elegiveis` (ou `elegiveis` não é positivo), é pane: todos ficam em `vermelho`. Sem candidato
 * não há pane (nada a segurar). Preserva a ordem de entrada e devolve os mesmos objetos.
 */
export function separarPermanentes<T extends Atrasado>(
  atrasados: readonly T[],
  elegiveis: number,
): { vermelho: T[]; acaoDoDono: T[]; pane: boolean } {
  const ehCandidato = (a: T): boolean =>
    a.diasAtrasado >= ATRASO.diasDeVermelho && a.falhasDoDiario4d === ATRASO.diasDeTentativa
  const candidatos = atrasados.filter(ehCandidato)
  if (candidatos.length === 0) return { vermelho: [...atrasados], acaoDoDono: [], pane: false }
  const pane = !(elegiveis > 0) || candidatos.length * 2 >= elegiveis
  if (pane) return { vermelho: [...atrasados], acaoDoDono: [], pane: true }
  return {
    vermelho: atrasados.filter((a) => !ehCandidato(a)),
    acaoDoDono: candidatos,
    pane: false,
  }
}
