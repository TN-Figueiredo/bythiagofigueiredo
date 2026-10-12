// E19: a janela de medição do modo aviso. Função pura. "Nenhuma leitura sem read" só vale com o controle positivo do dia.
export const DIAS_MEDIDOS_PARA_FECHAR = 7
/** O mesmo número de TETO_LINHAS_DIA do registrador. Este arquivo não importa nada (o script o usa fora do Next); um teste
 *  em leitura-registro.test.ts prende a igualdade. */
export const TETO_LINHAS_DIA_DA_JANELA = 5000

/** `linhas`, `tarefas_forja` e `perdidas` vêm da consulta por dia do plano. Ausentes contam como zero AQUI; o script, que lê a
 *  consulta de verdade, exige todas as colunas (lerEntradaDaJanela). `perdidas`: leituras sem registro cobrindo o dia (onda 3, B). */
export interface DiaLido { dia_sp: string; controle: number; sem_read: number; linhas?: number; tarefas_forja?: number; perdidas?: number }
export interface DiaDaJanela {
  dia: string
  estado: 'medido' | 'nao_medido' | 'em_curso'
  motivo?: 'sem_linha_de_controle' | 'falha_de_gravacao' | 'leituras_perdidas' | 'dia_do_envio'
  controle: number
  sem_read: number
  /** Leituras que passaram sem registro e que uma linha deste dia (ou que começou antes dele) declarou. */
  perdidas: number
  /** (emenda do portão: S19-I2) Tarefas da fila da forja concluídas neste dia de São Paulo. */
  tarefas_forja: number
  /** (emenda do portão: D-M10) O dia bateu no teto de linhas: a coluna `vezes` da lista está cortada para ele. */
  teto: boolean
}
export interface Janela {
  dias: DiaDaJanela[]
  dias_medidos: number
  /** Dias MEDIDOS em que a forja concluiu pelo menos uma tarefa da fila. A janela não fecha com zero. */
  dias_com_tarefa: number
  fechada: boolean
  linhas_sem_read: number
  /** Dias ANTERIORES a `desde` e a partir do envio com leitura sem read: contam em `linhas_sem_read` e ficam listados. */
  sem_read_fora_da_janela: Array<{ dia: string; sem_read: number }>
  frase: string
}

const proximo = (dia: string): string => new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const numero = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * `lidos`: uma linha por dia de São Paulo que teve registro ou tarefa da forja (a consulta por dia do plano). Dia ausente
 * da lista é dia sem linha nenhuma: "não medido", nunca "limpo". `hoje` ainda está em curso e não conta. `diasComFalha`:
 * dias em que o Sentry registrou falha de gravação do registro.
 *
 * (onda 3, D) O dia `desde` é o dia do envio, parcial: nunca conta como medido; os 7 dias começam no dia seguinte.
 * (onda 3, E) `envio` (padrão: `desde`) é o dia em que o código foi ao ar. `desde` posterior a ele deixa um vão não medido: a
 * janela não fecha. Leitura sem read a partir do envio sempre conta contra o veredito.
 *
 * (emenda do portão: S19-I2) A janela só fecha com 7 dias medidos E pelo menos um dia medido em que a forja concluiu uma
 * tarefa da fila. A tarefa é semanal (segundas, 08:10 UTC): sem essa regra, sete dias medidos sem a segunda-feira fechariam
 * a janela sem que o caminho completo da fila (claim, leituras, PATCH) tivesse rodado uma vez sob medição.
 */
export function montarJanela(lidos: DiaLido[], o: { desde: string; hoje: string; diasComFalha?: string[]; envio?: string }): Janela {
  const envio = o.envio ?? o.desde
  const porDia = new Map(lidos.map(l => [l.dia_sp, l]))
  const falhas = new Set(o.diasComFalha ?? [])
  const dias: DiaDaJanela[] = []
  for (let dia = o.desde; dia <= o.hoje; dia = proximo(dia)) {
    const l = porDia.get(dia)
    const base = {
      dia,
      controle: numero(l?.controle),
      sem_read: numero(l?.sem_read),
      tarefas_forja: numero(l?.tarefas_forja),
      perdidas: numero(l?.perdidas),
      teto: numero(l?.linhas) >= TETO_LINHAS_DIA_DA_JANELA,
    }
    if (dia === o.hoje) dias.push({ ...base, estado: 'em_curso' })
    // (onda 3, D) O dia do envio é parcial: o código entra no ar no meio dele, e as leituras da manhã não têm registro.
    else if (dia === o.desde) dias.push({ ...base, estado: 'nao_medido', motivo: 'dia_do_envio' })
    else if (falhas.has(dia)) dias.push({ ...base, estado: 'nao_medido', motivo: 'falha_de_gravacao' })
    else if (base.perdidas > 0) dias.push({ ...base, estado: 'nao_medido', motivo: 'leituras_perdidas' })
    else if (base.controle < 1) dias.push({ ...base, estado: 'nao_medido', motivo: 'sem_linha_de_controle' })
    else dias.push({ ...base, estado: 'medido' })
  }
  const medidos = dias.filter(d => d.estado === 'medido')
  const dias_medidos = medidos.length
  const dias_com_tarefa = medidos.filter(d => d.tarefas_forja > 0).length
  // (onda 3, E) Leitura sem read de qualquer dia a partir do envio conta, esteja ou não dentro de [desde, hoje].
  const sem_read_fora_da_janela = lidos
    .filter(l => l.dia_sp >= envio && l.dia_sp < o.desde && numero(l.sem_read) > 0)
    .map(l => ({ dia: l.dia_sp, sem_read: numero(l.sem_read) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
  const linhas_sem_read = dias.reduce((s, d) => s + d.sem_read, 0) + sem_read_fora_da_janela.reduce((s, d) => s + d.sem_read, 0)
  const desdeDepoisDoEnvio = o.desde > envio
  const fechada = !desdeDepoisDoEnvio && dias_medidos >= DIAS_MEDIDOS_PARA_FECHAR && dias_com_tarefa >= 1
  const frase = desdeDepoisDoEnvio
    ? `desde (${o.desde}) é posterior ao envio (${envio}): as leituras de ${envio} a ${o.desde} não foram medidas; a recusa não sobe`
    : dias_medidos < DIAS_MEDIDOS_PARA_FECHAR
    ? `${dias_medidos} dias medidos de ${DIAS_MEDIDOS_PARA_FECHAR}: a recusa não sobe`
    : dias_com_tarefa === 0
      ? `${dias_medidos} dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe`
      : linhas_sem_read === 0
        ? `${dias_medidos} dias medidos e nenhuma leitura sem read: a recusa pode subir`
        : `${dias_medidos} dias medidos; ${linhas_sem_read} leitura(s) sem read: decidir linha a linha antes da recusa`
  return { dias, dias_medidos, dias_com_tarefa, fechada, linhas_sem_read, sem_read_fora_da_janela, frase }
}
