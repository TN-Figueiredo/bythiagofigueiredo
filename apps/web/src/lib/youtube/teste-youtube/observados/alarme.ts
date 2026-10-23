import { tituloValido, type LeituraObs } from './inferir'

/** Alarme de degradação da leitura (§6.1): avalia o dia BRT anterior. Puro: a leitura do banco e o aviso ficam em `avisos.ts`. */
export const LIMIAR_SEM_TITULO = 0.20
export const LIMIAR_ALVOS_SEM_LEITURA = 0.10
/** Alvo "aprendendo" (publicação há < 4 dias) e "fora da janela" (> 30 dias) não entram na conta. */
export const APRENDENDO_DIAS = 4
export const JANELA_DIAS = 30

const DIA_MS = 86_400_000
const FUSO = 'America/Sao_Paulo'

export interface LeituraDia {
  ytId: string; rodadaId: string; lidaEm: string; http: number | null; erro: string | null; jogadorBloqueado: boolean
  tituloExibido: string | null; idioma: string | null; canal: string | null
}
export interface AlvoAtivo { ytId: string; publicadoEm: string }

function partesLocais(ms: number): { ano: number; mes: number; dia: number } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day) }
}
/** Deslocamento de São Paulo em relação ao UTC no instante `ms` (negativo a oeste), pelo Intl: sem "-3 h" fixo. */
function deslocamentoMs(ms: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return local - Math.floor(ms / 1000) * 1000
}
/** 00:00 de São Paulo do dia civil `ano-mes-dia` (mes 1–12; dia pode transbordar), em ms UTC. */
function meiaNoiteBrt(ano: number, mes: number, dia: number): number {
  const utc = Date.UTC(ano, mes - 1, dia)
  return utc - deslocamentoMs(utc + 12 * 3_600_000) // o deslocamento é lido ao meio-dia, longe de qualquer virada de horário de verão
}

/** O dia BRT anterior ao de `agoraMs`: `[inicioMs, fimMs)` vai de 00:00 a 00:00 de São Paulo (hoje 03:00Z a 03:00Z). `rotulo` = 'AAAA-MM-DD'. */
export function diaBrtAnterior(agoraMs: number): { rotulo: string; inicioMs: number; fimMs: number } {
  const h = partesLocais(agoraMs)
  const ref = new Date(Date.UTC(h.ano, h.mes - 1, h.dia - 1))
  const [a, m, d] = [ref.getUTCFullYear(), ref.getUTCMonth() + 1, ref.getUTCDate()]
  return {
    rotulo: `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    inicioMs: meiaNoiteBrt(a, m, d), fimMs: meiaNoiteBrt(a, m, d + 1),
  }
}

export type Condicao = 'sem_leitura' | 'sem_titulo' | 'alvos_sem_leitura'
export interface Avaliacao { dispara: boolean; condicao: Condicao | null; pctSemTitulo: number; alvosSemLeitura: number; alvosConsiderados: number }

const comoObs = (l: LeituraDia): LeituraObs => ({
  id: 0, rodadaId: l.rodadaId, lidaEm: l.lidaEm, http: l.http, erro: l.erro, jogadorBloqueado: l.jogadorBloqueado, idioma: l.idioma, tituloExibido: l.tituloExibido, miniaturaId: null,
})

/**
 * Condições 1–3 do §6.1, na ordem; vale a 1ª que casa. Alvos considerados: ativos e não aprendendo em `fimMs` (publicação entre 4 e 30 dias).
 * `pctSemTitulo` é percentual (0–100) truncado em uma casa, para "acima de 20%" nunca aparecer como "20%".
 */
export function avaliarDegradacao(alvos: readonly AlvoAtivo[], leituras: readonly LeituraDia[], dia: { inicioMs: number; fimMs: number }): Avaliacao {
  const considerados = new Set(alvos.filter(a => {
    const idade = dia.fimMs - Date.parse(a.publicadoEm)
    return idade >= APRENDENDO_DIAS * DIA_MS && idade <= JANELA_DIAS * DIA_MS
  }).map(a => a.ytId))
  const doDia = leituras.filter(l => considerados.has(l.ytId) && Date.parse(l.lidaEm) >= dia.inicioMs && Date.parse(l.lidaEm) < dia.fimMs)
  const semTitulo = doDia.filter(l => !tituloValido(comoObs(l))).length
  const pctSemTitulo = doDia.length === 0 ? 0 : Math.floor(semTitulo * 1000 / doDia.length) / 10
  const comTitulo = new Set(doDia.filter(l => tituloValido(comoObs(l))).map(l => l.ytId))
  const alvosSemLeitura = [...considerados].filter(id => !comTitulo.has(id)).length
  const base = { pctSemTitulo, alvosSemLeitura, alvosConsiderados: considerados.size }
  if (considerados.size === 0) return { dispara: false, condicao: null, ...base }
  if (doDia.length === 0) return { dispara: true, condicao: 'sem_leitura', ...base }
  if (semTitulo / doDia.length - LIMIAR_SEM_TITULO > 1e-12) return { dispara: true, condicao: 'sem_titulo', ...base }
  if (alvosSemLeitura / considerados.size - LIMIAR_ALVOS_SEM_LEITURA > 1e-12) return { dispara: true, condicao: 'alvos_sem_leitura', ...base }
  return { dispara: false, condicao: null, ...base }
}

const RESTO = 'Se continuar, a leitura de títulos dos concorrentes fica parada até construirmos a leitura pela forja (hoje ela não existe).'
const SEGUNDO_DIA = '2º dia seguido: é o gatilho para construir a leitura pela forja.'
const NAO_MEDIDO = "Os estados de título podem ficar 'não medido'."
const pct = (x: number): string => String(x).replace('.', ',')

/**
 * UM texto por condição. `sem_titulo` é o literal do §6.1. `sem_leitura` e `alvos_sem_leitura` são PROPOSTA (o §6.1 só dá o texto da condição 2),
 * a redação final é da Hanna; o "resto" de cada um é o do §6.1, copiado.
 */
export function textoDegradacao(a: Avaliacao, segundoDia: boolean): string {
  const n = a.alvosConsiderados
  let t: string
  switch (a.condicao) {
    case 'sem_leitura':
      t = `Leitura dos concorrentes parada ontem: a sonda não trouxe nenhuma leitura de ${n} ${n === 1 ? 'vídeo acompanhado' : 'vídeos acompanhados'}. Os estados de título vão ficar 'não medido'. ${RESTO}`
      break
    case 'alvos_sem_leitura':
      t = `Leitura dos concorrentes degradada ontem: ${a.alvosSemLeitura} de ${n} ${n === 1 ? 'vídeo acompanhado' : 'vídeos acompanhados'} ${a.alvosSemLeitura === 1 ? 'ficou' : 'ficaram'} sem nenhuma passagem com título. ${NAO_MEDIDO} ${RESTO}`
      break
    default:
      t = `Leitura dos concorrentes degradada ontem: ${pct(a.pctSemTitulo)}% das leituras sem título. ${NAO_MEDIDO} ${RESTO}`
  }
  return segundoDia ? `${t} ${SEGUNDO_DIA}` : t
}

/** Texto do §6.2 "Aviso": `n` = vídeos em que o título repetido apareceu. */
export function textoSuspenso(n: number): string {
  return `Leitura de título suspensa ontem em ${n} ${n === 1 ? 'vídeo' : 'vídeos'}: o mesmo título apareceu em vídeos diferentes (provável falha da página do YouTube). Nada foi gravado com esse título.`
}
