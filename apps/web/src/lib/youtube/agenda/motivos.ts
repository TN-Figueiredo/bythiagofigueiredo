import type { Tarefa } from './tipos'

/** A mesma regra do `check` da coluna. */
export const CODIGO_RE = /^[a-z0-9_]{1,60}$/

/** Códigos que toda tarefa pode devolver. Frase fixa, sem ponto final, sem dado de fora. */
export const MOTIVOS_COMUNS = {
  excecao: 'falhou com erro inesperado (ver Sentry)',
  passou_do_tempo: 'passou do tempo e foi interrompida',
  sem_tempo: 'não coube no disparo',
  uma_pesada_por_disparo: 'cedeu a vez a outra tarefa pesada',
  tomada_falhou: 'não foi possível tomar a tarefa',
  schema_ausente: 'migration não aplicada',
  schema_nao_conferido: 'não foi possível conferir o schema',
  motivo_desconhecido: 'falhou (motivo fora do catálogo; ver Sentry)',
  motivo_invalido: 'falhou (motivo fora do catálogo; ver Sentry)',
} as const

const FRASE_MAX = 160
const tem = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)

/** A frase fixa de um código que SABEMOS estar na tarefa ou nos comuns; senão `undefined`. */
function fraseFixa(t: Pick<Tarefa, 'motivos'>, codigo: string): string | undefined {
  if (tem(t.motivos, codigo)) return t.motivos[codigo]
  if (tem(MOTIVOS_COMUNS, codigo)) return MOTIVOS_COMUNS[codigo as keyof typeof MOTIVOS_COMUNS]
  return undefined
}

/** O código, se está em `t.motivos` ou nos comuns; senão 'motivo_desconhecido'. Nunca devolve o texto recebido quando ele não é do catálogo. */
export function codigoDoMotivo(t: Pick<Tarefa, 'motivos'>, codigo: string | undefined): string | undefined {
  if (typeof codigo === 'string' && fraseFixa(t, codigo) !== undefined) return codigo
  return 'motivo_desconhecido'
}

/** Só números finitos passam para `fraseDe` (o mesmo filtro de `estado.ts`). */
function soNumeros(d: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

/** '<rótulo>: <frase>'. Código nulo ou fora do catálogo cai na frase de `motivo_desconhecido`; nunca devolve `undefined` nem o texto cru. */
export function fraseDoMotivo(
  t: Pick<Tarefa, 'motivos' | 'rotulo' | 'fraseDe'>,
  codigo: string | null | undefined,
  detalhe?: Readonly<Record<string, number>>,
): string {
  const c = codigoDoMotivo(t, codigo ?? undefined) ?? 'motivo_desconhecido'
  let frase = fraseFixa(t, c) ?? MOTIVOS_COMUNS.motivo_desconhecido
  // `fraseDe` só vale para código do catálogo DA TAREFA (os comuns e o desconhecido têm frase fixa).
  if (t.fraseDe && detalhe && tem(t.motivos, c)) {
    try {
      const f = t.fraseDe(c, soNumeros(detalhe))
      if (typeof f === 'string' && f.trim().length > 0) frase = f.slice(0, FRASE_MAX)
    } catch { /* cai na frase fixa */ }
  }
  return `${t.rotulo}: ${frase}`
}

/** SÓ o nome da classe e o código de 5 caracteres do Postgres; nunca a mensagem. */
export function resumoTecnico(err: unknown): { classe: string; sqlstate: string | null } {
  if (typeof err !== 'object' || err === null) return { classe: 'desconhecido', sqlstate: null }
  const nome: unknown = Reflect.get(err, 'name')
  const classe = typeof nome === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(nome) ? nome : 'Error'
  const code: unknown = Reflect.get(err, 'code')
  const sqlstate = typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null
  return { classe, sqlstate }
}
