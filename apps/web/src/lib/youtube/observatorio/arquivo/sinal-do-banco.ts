/**
 * A5 · E10: o sinal de tamanho do banco do site, como função PURA. Recebe as linhas de `obs_db_size_daily` e o relógio;
 * devolve o veredito (cor, nível, projeção), tudo o que a tela mostra já calculado e a frase única que vai para a tela,
 * para `acao_do_dono` e para o e-mail. Nada aqui lê banco, relógio ou ambiente: o "agora" é argumento.
 *
 * Regras (plano da E10, Tarefa 2): a decisão é sobre UM inteiro, `pctDoLimite`; o limite de 500 MB é o do banco INTEIRO
 * do site; a única decisão tomada pelos bytes é "acima do limite". Dado ausente nunca vira zero nem verde: sem a linha do
 * dia de leitura o estado é `sem_leitura_hoje` (cor nunca verde), sem nenhuma linha é `nunca_medido`.
 * Importa `RULES` por caminho relativo (o `tsx` da raiz não resolve o apelido `@/`).
 */
import { RULES } from '../rules'

const MB = 1_048_576
const DIA_MS = 86_400_000
const HORA_MS = 3_600_000
/** Inclinação abaixo disto (MB por dia) é "reta parada": o ruído de ponto flutuante não vira crescimento. */
const INCLINACAO_MIN = 1e-9
/** Mais de dois milhões de dias até o limite é o mesmo que não chegar: a data nem cabe em ano de quatro dígitos. */
const DIAS_MAX = 2_000_000
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

export interface LinhaTamanho { day: string; db_bytes: number; competitor_bytes: number; own_bytes: number; measured_at: string }
/** O que o leitor pode entregar antes de a linha ser validada: qualquer campo pode vir nulo (o banco é a fronteira). */
export type LinhaBruta = { [K in keyof LinhaTamanho]: LinhaTamanho[K] | null | undefined }

export type CorDoBanco = 'verde' | 'amarelo' | 'vermelho'
export type Projecao =
  | { estado: 'nao_medida'; medidas: number; minimo: number; existeEm: string }
  | { estado: 'sem_crescimento' }
  | { estado: 'medida'; mbPorDia: number; diasAteOLimite: number; chegaEm: string; chegaNoDia: string }
export type NivelDoBanco = 'com_folga' | 'enchendo' | 'quase_cheio' | 'enche_em_dias' | 'acima_do_limite'
/** Inteiros; concorrentes + seuCanal + resto = 100; observatorio = concorrentes + seuCanal. */
export interface PartesPct { concorrentes: number; seuCanal: number; resto: number; observatorio: number }
export type Cresceu28d =
  | { estado: 'medido'; pctDoLimite: number; medidas: number }
  | { estado: 'menos_de_um_decimo'; medidas: number }
  | { estado: 'zero_medido' }
  | { estado: 'nao_medido' }
export type DoCrescimento = { estado: 'medido'; partes: PartesPct } | { estado: 'zero_medido' } | { estado: 'nao_medido' } | { estado: 'parte_encolheu' }
/** SÓ para o botão de informação; nenhum outro elemento da tela lê isto. */
export interface BancoEmMb {
  limite: number; hoje: number; concorrentes: number; seuCanal: number; resto: number; amareloEm: number; vermelhoEm: number
  cresceu28d: number | null; porDia: number | null; cresceuPorParte: { concorrentes: number; seuCanal: number; resto: number } | null
}
export interface BancoNaTela {
  /** O inteiro mostrado; 104 = acima do limite. */
  pctDoLimite: number
  nivel: NivelDoBanco
  /** 100 menos `pctDoLimite`; nulo acima do limite. */
  livrePct: number | null
  /** `pctDoLimite` menos 100, só acima do limite (pode ser 0: de 500,0 a 502,5 MB o inteiro ainda mostra 100). */
  passouPct: number | null
  cresceu: Cresceu28d
  doOcupado: PartesPct
  doCrescimento: DoCrescimento
  mb: BancoEmMb
}
export interface SinalDoBanco {
  estado: 'medido' | 'sem_leitura_hoje' | 'nunca_medido'
  cor: CorDoBanco | null
  diaDeLeitura: string
  ultima: { day: string; dbMb: number; competitorMb: number; ownMb: number; restoMb: number; medidoEm: string; pctDoLimite: number } | null
  horasSemMedida: number | null
  projecao: Projecao
  /** Nulo sem a linha do dia de leitura. */
  tela: BancoNaTela | null
  /** Quantas linhas foram ignoradas por forma (nula, negativa, não numérica, partes maiores que o banco, dia futuro). */
  ilegiveis: number
  /** A frase da tela, a mesma de `acao_do_dono` e do e-mail; nunca contém "MB" nem "lote". */
  frase: string
}

export const FRASE_BANCO_NAO_LIDO =
  'Não foi possível ler o tamanho do banco do site. O banco não respondeu, então nada indica que está tudo bem nem que está ruim.'

// ───────────────────────── datas ─────────────────────────

const FORMATO_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de leitura começa às `horaDeInicioSP` de São Paulo: é a data de São Paulo de (agora menos essas horas). */
export function diaDeLeitura(agoraMs: number, horaDeInicioSP: number = RULES.dbSize.readingDayStartHourSP): string {
  return FORMATO_SP.format(new Date(agoraMs - horaDeInicioSP * HORA_MS))
}

const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Número do dia (dias desde 1970) de `AAAA-MM-DD`, ou null se não for uma data real. */
function numeroDoDia(iso: string): number | null {
  const m = DIA_ISO.exec(iso)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(t)
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null
  return Math.round(t / DIA_MS)
}
const isoDoDia = (n: number): string => new Date(n * DIA_MS).toISOString().slice(0, 10)
const somaDias = (iso: string, dias: number): string => isoDoDia((numeroDoDia(iso) ?? 0) + dias)
const ddmm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const mesAno = (iso: string): string => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`
const horaCheia = (h: number): string => `${String(h).padStart(2, '0')}:00`
const dias = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`

// ───────────────────────── linhas ─────────────────────────

interface Valida { day: string; n: number; db: number; comp: number; own: number; medidoEm: string }

function validar(l: LinhaBruta): Valida | null {
  if (typeof l.day !== 'string') return null
  const n = numeroDoDia(l.day)
  if (n === null) return null
  const campos = [l.db_bytes, l.competitor_bytes, l.own_bytes]
  for (const c of campos) if (typeof c !== 'number' || !Number.isFinite(c) || c < 0) return null
  const db = l.db_bytes as number
  const comp = l.competitor_bytes as number
  const own = l.own_bytes as number
  if (db <= 0) return null
  if (comp + own > db) return null
  if (typeof l.measured_at !== 'string' || !Number.isFinite(Date.parse(l.measured_at))) return null
  return { day: l.day, n, db, comp, own, medidoEm: l.measured_at }
}

const arred1 = (x: number): number => Math.round(x * 10) / 10
const mbDe = (bytes: number): number => arred1(bytes / MB)

/** Mínimos quadrados: a inclinação (por dia) de `y` sobre `x`. */
function inclinacao(x: readonly number[], y: readonly number[]): number {
  const n = x.length
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += x[i]!; sy += y[i]! }
  const mx = sx / n, my = sy / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (x[i]! - mx) * (y[i]! - my); den += (x[i]! - mx) ** 2 }
  return den === 0 ? 0 : num / den
}

/** Método do maior resto: inteiros que somam 100; empate no resto: a ordem recebida. */
function maiorResto(partes: readonly number[]): number[] {
  const soma = partes.reduce((a, b) => a + b, 0)
  const exatos = partes.map(p => (p * 100) / soma)
  const base = exatos.map(Math.floor)
  let sobra = 100 - base.reduce((a, b) => a + b, 0)
  const ordem = exatos.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => (b.r - a.r) || (a.i - b.i))
  for (const o of ordem) { if (sobra <= 0) break; base[o.i] = base[o.i]! + 1; sobra-- }
  return base
}

function pctParaPartes(comp: number, own: number, resto: number): PartesPct {
  const [c, s, r] = maiorResto([comp, own, resto]) as [number, number, number]
  return { concorrentes: c, seuCanal: s, resto: r, observatorio: c + s }
}

// ───────────────────────── avaliação de uma linha de referência ─────────────────────────

interface Avaliacao {
  ref: Valida
  pctDoLimite: number
  acima: boolean
  noLimiteOuAcima: boolean
  projecao: Projecao
  nivel: NivelDoBanco
  cor: CorDoBanco
  /** Inclinações (MB por dia) das três colunas e do total, quando a reta existe (14 ou mais medidas). */
  retas: { total: number; concorrentes: number; seuCanal: number; resto: number; medidas: number } | null
}

function avaliar(validas: readonly Valida[], ref: Valida, regras: typeof RULES.dbSize): Avaliacao {
  const limiteBytes = regras.limitMb * MB
  const pctDoLimite = Math.round((ref.db * 100) / limiteBytes)
  const acima = ref.db > limiteBytes
  const noLimiteOuAcima = ref.db >= limiteBytes
  // a janela de tendência: os `trendWindowDays` dias terminados no dia de referência (28 dias = no máximo 28 linhas)
  const janela = validas.filter(v => v.n <= ref.n && ref.n - v.n <= regras.trendWindowDays - 1).sort((a, b) => a.n - b.n)
  let projecao: Projecao
  let retas: Avaliacao['retas'] = null
  if (janela.length < regras.trendMinDays) {
    projecao = { estado: 'nao_medida', medidas: janela.length, minimo: regras.trendMinDays, existeEm: somaDias(ref.day, regras.trendMinDays - janela.length) }
  } else {
    const x = janela.map(v => v.n - janela[0]!.n)
    const pcol = (f: (v: Valida) => number): number => inclinacao(x, janela.map(v => f(v) / MB))
    retas = {
      total: pcol(v => v.db), concorrentes: pcol(v => v.comp), seuCanal: pcol(v => v.own), resto: pcol(v => v.db - v.comp - v.own), medidas: janela.length,
    }
    const faltam = regras.limitMb - ref.db / MB
    const d = retas.total > INCLINACAO_MIN ? Math.max(0, Math.round(faltam / retas.total)) : Infinity
    if (!(d <= DIAS_MAX)) {
      projecao = { estado: 'sem_crescimento' }
    } else {
      const chega = somaDias(ref.day, d)
      projecao = { estado: 'medida', mbPorDia: retas.total, diasAteOLimite: d, chegaEm: chega.slice(0, 7), chegaNoDia: chega }
    }
  }
  const diasAte = projecao.estado === 'medida' ? projecao.diasAteOLimite : null
  let nivel: NivelDoBanco
  if (acima) nivel = 'acima_do_limite'
  else if (pctDoLimite >= regras.redPct) nivel = 'quase_cheio'
  else if (diasAte !== null && diasAte < regras.redDaysToLimit) nivel = 'enche_em_dias'
  else if (pctDoLimite >= regras.yellowPct) nivel = 'enchendo'
  else nivel = 'com_folga'
  const cor: CorDoBanco = nivel === 'com_folga' ? 'verde' : nivel === 'enchendo' ? 'amarelo' : 'vermelho'
  return { ref, pctDoLimite, acima, noLimiteOuAcima, projecao, nivel, cor, retas }
}

// ───────────────────────── frases ─────────────────────────

const PRIMEIRA: Record<Exclude<NivelDoBanco, 'enche_em_dias' | 'acima_do_limite'>, string> = {
  com_folga: 'com folga',
  enchendo: 'enchendo',
  quase_cheio: 'quase cheio',
}

function fraseDoNivel(a: Avaliacao, regras: typeof RULES.dbSize): string {
  const p = a.pctDoLimite
  if (a.nivel === 'acima_do_limite') return `Banco do site acima do limite: ${p}% do limite.`
  if (a.nivel === 'enche_em_dias') {
    const d = a.projecao.estado === 'medida' ? a.projecao.diasAteOLimite : 0
    return `Banco do site enche em ${dias(d)}: ${p}% do limite, no ritmo dos últimos ${regras.trendWindowDays} dias.`
  }
  let f = `Banco do site ${PRIMEIRA[a.nivel]}: ${p}% do limite.`
  if (a.nivel === 'quase_cheio') f += ` Passou dos ${regras.redPct}%.`
  // com o banco já no limite ou acima, "chega ao limite em <mês>" e "não chega ao limite" seriam falsas: sem segunda parte
  if (a.noLimiteOuAcima) return f
  const pr = a.projecao
  if (pr.estado === 'medida') f += ` No ritmo dos últimos ${regras.trendWindowDays} dias, chega ao limite em ${mesAno(pr.chegaNoDia)}.`
  else if (pr.estado === 'sem_crescimento') f += ` Nos últimos ${regras.trendWindowDays} dias o banco não cresceu: nesse ritmo ele não chega ao limite.`
  else f += ` A previsão ainda não existe: há só ${dias(pr.medidas)} de leitura e são precisos ${pr.minimo}.`
  return f
}

const FRASE_NUNCA_MEDIDO = 'Ainda sem medida do tamanho do banco do site.'

/** A data da primeira leitura só é prometida com a medida agendada: sem agenda a leitura das 05:00 não vem. */
export function fraseDeNuncaMedido(diaDeLeitura: string, medidaAgendada: boolean): string {
  if (!medidaAgendada) return FRASE_NUNCA_MEDIDO
  return `${FRASE_NUNCA_MEDIDO} A primeira leitura é em ${ddmm(somaDias(diaDeLeitura, 1))}, às ${horaCheia(RULES.dbSize.readingDayStartHourSP)}. Antes disso não há dado.`
}

// ───────────────────────── o sinal ─────────────────────────

function ultimaDe(a: Avaliacao): NonNullable<SinalDoBanco['ultima']> {
  const r = a.ref
  return {
    day: r.day, dbMb: mbDe(r.db), competitorMb: mbDe(r.comp), ownMb: mbDe(r.own), restoMb: mbDe(r.db - r.comp - r.own),
    medidoEm: r.medidoEm, pctDoLimite: a.pctDoLimite,
  }
}

function telaDe(a: Avaliacao, regras: typeof RULES.dbSize): BancoNaTela {
  const r = a.ref
  const resto = r.db - r.comp - r.own
  const retas = a.retas
  const pr = a.projecao
  const janela = regras.trendWindowDays
  let cresceu: Cresceu28d
  let doCrescimento: DoCrescimento
  if (pr.estado === 'medida' && retas) {
    const pct1 = Math.round(((retas.total * janela * 100) / regras.limitMb) * 10) / 10
    cresceu = pct1 === 0 ? { estado: 'menos_de_um_decimo', medidas: retas.medidas } : { estado: 'medido', pctDoLimite: pct1, medidas: retas.medidas }
    const partes = [retas.concorrentes, retas.seuCanal, retas.resto]
    doCrescimento = partes.some(p => p < 0)
      ? { estado: 'parte_encolheu' }
      : { estado: 'medido', partes: pctParaPartes(retas.concorrentes, retas.seuCanal, retas.resto) }
  } else if (pr.estado === 'sem_crescimento') {
    cresceu = { estado: 'zero_medido' }
    doCrescimento = { estado: 'zero_medido' }
  } else {
    cresceu = { estado: 'nao_medido' }
    doCrescimento = { estado: 'nao_medido' }
  }
  return {
    pctDoLimite: a.pctDoLimite,
    nivel: a.nivel,
    livrePct: a.acima ? null : 100 - a.pctDoLimite,
    passouPct: a.acima ? a.pctDoLimite - 100 : null,
    cresceu,
    doOcupado: pctParaPartes(r.comp, r.own, resto),
    doCrescimento,
    mb: {
      limite: regras.limitMb,
      hoje: mbDe(r.db),
      concorrentes: mbDe(r.comp),
      seuCanal: mbDe(r.own),
      resto: mbDe(resto),
      amareloEm: (regras.limitMb * regras.yellowPct) / 100,
      vermelhoEm: (regras.limitMb * regras.redPct) / 100,
      cresceu28d: retas ? arred1(retas.total * janela) : null,
      porDia: retas ? retas.total : null,
      cresceuPorParte: retas
        ? { concorrentes: arred1(retas.concorrentes * janela), seuCanal: arred1(retas.seuCanal * janela), resto: arred1(retas.resto * janela) }
        : null,
    },
  }
}

export function sinalDoBanco(linhas: readonly LinhaBruta[], agoraMs: number, regras: typeof RULES.dbSize = RULES.dbSize): SinalDoBanco {
  const dia = diaDeLeitura(agoraMs, regras.readingDayStartHourSP)
  const diaN = numeroDoDia(dia) ?? 0
  const validas: Valida[] = []
  let ilegiveis = 0
  let hojeIlegivel = false
  for (const l of linhas) {
    const v = validar(l)
    if (v === null || v.n > diaN) {
      ilegiveis++
      if (typeof l.day === 'string' && l.day === dia) hojeIlegivel = true
      continue
    }
    validas.push(v)
  }
  const hoje = validas.find(v => v.day === dia) ?? null
  const ultimaLinha = validas.reduce<Valida | null>((m, v) => (m === null || v.n > m.n ? v : m), null)

  if (ultimaLinha === null) {
    return {
      estado: hojeIlegivel ? 'sem_leitura_hoje' : 'nunca_medido',
      cor: null, diaDeLeitura: dia, ultima: null, horasSemMedida: null,
      projecao: { estado: 'nao_medida', medidas: 0, minimo: regras.trendMinDays, existeEm: somaDias(dia, regras.trendMinDays) },
      tela: null, ilegiveis,
      frase: hojeIlegivel ? `Sem leitura do banco do site hoje. A medida das ${horaCheia(regras.readingDayStartHourSP)} não chegou.` : FRASE_NUNCA_MEDIDO,
    }
  }

  const a = avaliar(validas, hoje ?? ultimaLinha, regras)
  const horasSemMedida = Math.max(0, (agoraMs - Date.parse(a.ref.medidoEm)) / HORA_MS)
  if (hoje) {
    return {
      estado: 'medido', cor: a.cor, diaDeLeitura: dia, ultima: ultimaDe(a), horasSemMedida, projecao: a.projecao,
      tela: telaDe(a, regras), ilegiveis, frase: fraseDoNivel(a, regras),
    }
  }
  // sem a linha do dia: a cor da última medida só vale se era amarela ou vermelha (nunca verde); a tela não desenha nada
  return {
    estado: 'sem_leitura_hoje', cor: a.cor === 'verde' ? null : a.cor, diaDeLeitura: dia, ultima: ultimaDe(a), horasSemMedida,
    projecao: a.projecao, tela: null, ilegiveis,
    frase: `Sem leitura do banco do site hoje. A medida das ${horaCheia(regras.readingDayStartHourSP)} não chegou; a última, de ${ddmm(a.ref.day)}, foi ${a.pctDoLimite}% do limite.`,
  }
}
