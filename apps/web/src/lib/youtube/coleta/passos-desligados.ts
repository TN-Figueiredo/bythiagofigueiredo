// Interruptor por passo da coleta própria: YT_OWN_STEPS_OFF="retencao,dimensoes" (nomes separados por vírgula,
// espaços tolerados, sem diferenciar maiúsculas). Variável ausente ou vazia: nada desligado.
// Nome desconhecido não desliga nada: volta em `nomesDesconhecidos` e em `notaNomesDesconhecidos`.
// A variável é lida a cada chamada (nunca no import): o teste apaga e afirma o padrão.

export const PASSOS_COM_INTERRUPTOR = ['retencao', 'dimensoes', 'versoes', 'normalizadores'] as const
export type PassoComInterruptor = (typeof PASSOS_COM_INTERRUPTOR)[number]

const VARIAVEL = 'YT_OWN_STEPS_OFF'
const MAX_NOME_NA_NOTA = 40

function itens(env: NodeJS.ProcessEnv): string[] {
  const bruto = env[VARIAVEL]
  if (typeof bruto !== 'string') return []
  return bruto.split(',').map(s => s.trim()).filter(s => s !== '')
}

export function passoDesligado(nome: PassoComInterruptor, env: NodeJS.ProcessEnv = process.env): boolean {
  return itens(env).some(i => i.toLowerCase() === nome)
}

export function nomesDesconhecidos(env: NodeJS.ProcessEnv = process.env): string[] {
  const conhecidos: readonly string[] = PASSOS_COM_INTERRUPTOR
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const i of itens(env)) {
    const chave = i.toLowerCase()
    if (conhecidos.includes(chave) || vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(i)
  }
  return saida
}

/** O texto é um só: quem integra usa `pushUnico(falhas, nota)` e a nota nunca se repete. */
export function notaNomesDesconhecidos(env: NodeJS.ProcessEnv = process.env): string | null {
  const nomes = nomesDesconhecidos(env)
  if (nomes.length === 0) return null
  return `${VARIAVEL} tem nome desconhecido: ${nomes.map(n => n.slice(0, MAX_NOME_NA_NOTA)).join(', ')}`
}
