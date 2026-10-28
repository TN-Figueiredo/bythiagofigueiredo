// apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts
/** Frases e estado da peça 4 (o automático). Puro. Literais do mockup aprovado (interruptor.js). M6a: só o mínimo; a Tarefa 12c [M6b] acrescenta motivos e frase digitada. */
import type { EstadoInterruptor } from './saida'

export const SO_ADMIN = 'Quem administra o site liga o automático.'

const ddmmaaaa = (iso: string): string => { const d = new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }
export function tituloDoInterruptor(e: EstadoInterruptor | null, envOn: boolean, hojeSP: string): string {
  if (e === null) return 'Automático: não medido'
  if (e.estado === 'nao_existe') return 'Automático: não existe aqui'
  if (!envOn) return 'Automático: desligado na configuração'
  if (e.estado === 'nao_pode') return 'Automático: ainda não dá para ligar'
  if (e.estado === 'ligado') {
    const fim = new Date(Date.parse(e.armado_ate ?? '') - 3 * 3_600_000).toISOString().slice(0, 10)
    const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${hojeSP}T12:00:00Z`)) / 86_400_000)
    return dias <= 7 ? `Automático: ligado, vence em ${dias} dias` : `Automático: ligado até ${ddmmaaaa(e.armado_ate ?? '')}`
  }
  if (e.estado === 'venceu') return `Automático: a validade de 90 dias acabou em ${ddmmaaaa(e.desligado_em ?? '')}`
  if (e.estado === 'desligou_sozinho') return `Automático: desligou sozinho em ${ddmmaaaa(e.desligado_em ?? '')}`
  return 'Automático: desligado'
}
export const NAO_MEDIDO = 'Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.'
export function faltaParaLigar(descartes: number, simulacoes: number): string {
  const partes: string[] = []
  if (descartes < 3) partes.push(`${3 - descartes} ${3 - descartes === 1 ? 'saída feita' : 'saídas feitas'} por você (${descartes} de 3)`)
  if (simulacoes < 2) partes.push(`${2 - simulacoes} ${2 - simulacoes === 1 ? 'simulação vista' : 'simulações vistas'} (${simulacoes} de 2)`)
  return `Falta: ${partes.join(' e ')}.`
}
/** Decisão da Hanna (28/10): o contador é da classe, não da tabela, e só conta clique. Nenhuma frase diz "descartes" sem "à mão" e "nesta classe". Gatilho para contar por tabela: M7/M8 (segunda tabela na classe) ou M6b ligar o descarte automático. */
export const NOTA_DESCARTES = 'A conta de saídas usa os descartes feitos à mão nesta classe.'
