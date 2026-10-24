// Frases da leitura dos sinais (F2 T8). Fora do React: tela, rota e Cowork usam as mesmas. Sem banco, sem relógio (a hora vem de fora).
import { DEFINICAO_SINAIS_DO_NICHO } from '../../agenda/definicoes'
import type { RotuloDaAcao } from './acao'

/** Idade (em horas) do último cálculo a partir da qual a lista conta como desatualizada. */
export const HORAS_ATE_DESATUALIZAR = 36
/** Dias que "Adiar" empurra a sugestão (a função `niche_signals_adiar` do banco usa os mesmos 7). Aqui para o cliente importar sem trazer o leitor. */
export const DIAS_DO_ADIAR = 7
const HORA_SP = (agora: Date): number => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora))
const dois = (n: number): string => String(n).padStart(2, '0')

/** Por que a lista nunca foi calculada, e quando passa a ser. A hora vem da definição da tarefa, nunca escrita à mão. */
export function textoNuncaCalculado(agora: Date, ligado: boolean): string {
  if (!ligado) return 'O cálculo das sugestões ainda não foi ligado.'
  const hora = `${dois(DEFINICAO_SINAIS_DO_NICHO.aPartirDaHoraSP ?? 0)}:00`
  if (HORA_SP(agora) < (DEFINICAO_SINAIS_DO_NICHO.aPartirDaHoraSP ?? 0)) return `O 1º cálculo roda hoje depois das ${hora} (Brasília).`
  return `O 1º cálculo roda depois das ${hora} de amanhã (Brasília), ou na próxima rodada da agenda se hoje falhou.`
}

/** O texto do botão da ação derivada. `lugar` é o nome do lugar quando a tela o conhece; sem ele, "este lugar". `kind` separa "parecido" de "sobre X". */
export function textoDoRotulo(rotulo: RotuloDaAcao, n: number | null, lugar: string | undefined, kind: 'destino' | 'parecido'): string {
  const onde = lugar && lugar.trim() !== '' ? lugar : 'este lugar'
  switch (rotulo) {
    case 'abrir-seus':
      if (kind === 'parecido') return n === 1 ? 'Abrir seu vídeo parecido' : `Abrir seus ${n ?? ''} vídeos parecidos`.replace('  ', ' ')
      return n === 1 ? `Abrir seu vídeo sobre ${onde}` : `Abrir seus ${n ?? ''} vídeos sobre ${onde}`.replace('  ', ' ')
    case 'abrir-concorrente': return 'Abrir o vídeo do concorrente'
    case 'playlist': return 'Abrir a playlist'
    case 'generico': return 'Abrir seus vídeos'
  }
}

/** O que a ação sugerida diz em palavras. "Pode ajudar", nunca "vai ajudar" (D2). */
export const TEXTO_DA_ACAO: Record<string, string> = {
  titulo_descricao: 'pode ajudar: rever título e descrição de um vídeo seu que já fala do lugar',
  video_novo: 'pode ajudar: considerar um vídeo novo sobre o lugar',
  playlist: 'pode ajudar: considerar reunir seus vídeos do lugar numa playlist',
}
export const textoDaAcao = (acao: string): string => TEXTO_DA_ACAO[acao] ?? 'pode ajudar: rever o lugar'

const num = (c: Record<string, number>, k: string): number | null => (typeof c[k] === 'number' ? c[k]! : null)

/**
 * A frase de cada lista vazia. Cada vazio mostra só o número que a chave de `contagens` trouxe (E-3); sem a chave, a frase fica sem número.
 * `sem-grupo` se separa só por contagem: 1 canal só, ou tudo já respondido antes (âncora).
 */
export function textoDoVazio(motivo: string, contagens: Record<string, number>, agora: Date, ligado: boolean): string {
  const c = contagens
  switch (motivo) {
    case 'nunca-calculado': return textoNuncaCalculado(agora, ligado)
    case 'adiado': {
      // Só o texto puro (sem a data, que depende do fuso e vive na tela): a tela monta "Você adiou N" e a data.
      const a = num(c, 'adiados')
      return a === null ? 'Adiadas por você: não medido. Não deu para contar quantas voltam nem quando.' : `Você adiou ${a} ${a === 1 ? 'sugestão' : 'sugestões'}; ${a === 1 ? 'ela volta' : 'voltam'} sozinhas em até ${DIAS_DO_ADIAR} dias.`
    }
    case 'tudo-respondido': {
      const r = num(c, 'respondidos_30d')
      return `Todas as sugestões recentes já foram respondidas${r !== null ? ` (${r} nos últimos 30 dias)` : ''}.`
    }
    case 'sem-historico': {
      const t = num(c, 'canais_total')
      return `Ainda não há histórico suficiente para calcular as sugestões${t !== null ? ` (${t} canais acompanhados)` : ''}.`
    }
    case 'sync-atrasado': {
      const s = num(c, 'canais_sem_ritmo'), t = num(c, 'canais_total')
      return `A coleta dos canais está atrasada e nada foi calculado${s !== null && t !== null ? `: ${s} de ${t} canais sem ritmo medido` : ''}.`
    }
    case 'sem-terceiro-outlier': {
      const t = num(c, 'canais_total')
      return `Nenhum vídeo de concorrente passou da régua de estouro${t !== null ? ` nos ${t} canais acompanhados` : ''}.`
    }
    case 'sem-lugar': {
      const s = num(c, 'outliers_sem_lugar'), t = num(c, 'outliers_total')
      return `Há vídeos estourando, mas nenhum com lugar reconhecido${s !== null && t !== null ? ` (${s} de ${t} sem lugar)` : ''}.`
    }
    case 'abaixo-do-minimo': {
      const n = num(c, 'sem_n_minimo'), p = num(c, 'abaixo_do_piso')
      return `Há vídeos estourando, mas todos ficaram abaixo do mínimo de histórico do canal${n !== null ? ` (${n})` : ''} ou de visualizações${p !== null ? ` (${p})` : ''}.`
    }
    case 'sem-grupo': {
      const t = num(c, 'outliers_total')
      if (num(c, 'calculo_atrasado') === 1) return `A última leitura do nicho é antiga (mais de ${HORAS_ATE_DESATUALIZAR} horas): a lista pode estar sem atualizar, não é prova de que não há sugestão.`
      if (num(c, 'canais_com_outlier') === 1) return 'Há vídeos estourando com lugar, mas só em 1 canal: ainda não forma um evento.'
      if (t !== null && t > 0 && num(c, 'outliers_ancora') === t) return 'Os vídeos estourando com lugar já foram respondidos antes: nada novo.'
      return `Há vídeos estourando com lugar${t !== null ? ` (${t})` : ''}, mas nenhum grupo forma um evento.`
    }
    default: return 'A lista está vazia e o motivo não foi informado.'
  }
}
