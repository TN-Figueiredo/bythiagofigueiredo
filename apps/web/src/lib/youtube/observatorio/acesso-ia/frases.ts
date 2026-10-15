// A5 · E17 degrau 2: as frases fechadas do acesso externo da IA (plano, seção 6), cada uma com o status HTTP quando é da porta.
// Frase de recusa nunca leva dado: nem chave, nem hash, nem id de pessoa, nem texto do que foi pedido.

export interface FraseHttp { status: 401 | 403 | 503; frase: string }

/** As recusas da porta. A de chave vencida tem a data e vem de `fraseDeVencida` (lib/pipeline/chave.ts), com status 401. */
export const FRASES = {
  desligado: { status: 503, frase: 'acesso externo desligado' },
  misto: { status: 403, frase: 'chave de perfil misto: recusada' },
  sem_pessoa: { status: 401, frase: 'chave sem pessoa: peça outra ao dono' },
  sem_validade: { status: 401, frase: 'chave sem validade: peça outra ao dono' },
  sem_acesso: { status: 403, frase: 'sem acesso ao site' },
  nao_conferido: { status: 503, frase: 'não foi possível conferir o acesso agora: tente de novo em instantes' },
} as const satisfies Record<string, FraseHttp>

/** As respostas de erro da ferramenta (sem status HTTP: vão no corpo do resultado MCP). Nenhuma leva dado. */
export const FRASES_DA_FERRAMENTA = {
  nao_encontrado: 'não encontrado',
  nao_registrou: 'não foi possível registrar a consulta: nada foi entregue',
  demorou: 'a consulta demorou demais: nada foi entregue',
  taxa_nao_conferida: 'não foi possível conferir o limite de uso: nada foi entregue',
  nao_montou: 'não foi possível montar a resposta',
  tela_sem_pacote: 'esta tela ainda não tem pacote',
} as const

const TRES_HORAS_MS = 3 * 3_600_000 // São Paulo é UTC-3, sem horário de verão desde 2019 (igual a `lib/pipeline/chave.ts`)

/** `limite de uso atingido: tente de novo a partir das HH:MM (horário de São Paulo)`. Instante inválido não inventa hora. */
export function fraseDeLimite(voltaEmIso: string): string {
  const ms = Date.parse(voltaEmIso)
  if (!Number.isFinite(ms)) return 'limite de uso atingido: tente de novo mais tarde'
  const d = new Date(ms - TRES_HORAS_MS)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `limite de uso atingido: tente de novo a partir das ${hh}:${mm} (horário de São Paulo)`
}
