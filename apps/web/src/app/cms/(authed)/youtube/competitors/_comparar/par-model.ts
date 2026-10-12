/**
 * O par da comparação entre dois canais (spec 18.2 a 18.5 e rodapés): lados, cores, relação, barras, posição, "Leitura rápida",
 * rodapé e status. PURO e SEM O MOTOR: roda no navegador, a partir do pacote do servidor (`CompararPack`), para trocar o
 * seletor sem rede (D14). As regras são as de `comparar.js` (`relacao`, `quemMaior`, `leitura`, `celulaEixo`, `ZERO`) com D12.
 *
 * Regras que valem para tudo aqui:
 * - Nulo nunca vira zero e nunca gera relação: lado sem medida mostra o motivo que veio no pacote; a linha em que NENHUM dos
 *   dois tem dado não aparece em `linhas`, vai para `fora`, e o rodapé a conta e a nomeia.
 * - A relação sempre NOMEIA o maior e nunca afirma mais do que os números dizem: "maior" só a partir de 10% de diferença,
 *   "×" só a partir de 2×, abaixo disso "+N%". A conta é maior÷menor (simétrica): inverter os lados troca os nomes e nunca a
 *   classe (com B÷A, 100 contra 90,5 seria "igual" e 90,5 contra 100 seria "+11%").
 * - Zero em linguagem de gente, nunca razão. Nenhuma divisão sem checar os dois zeros antes.
 * - Os textos NÃO levam o símbolo (▲ ＝ ●): quem desenha escolhe por `tipo` (switch exaustivo) e põe o texto equivalente para
 *   leitor de tela.
 */
import { posicoes, conjuntoTexto, type Conjunto, type Posicao } from '@/lib/youtube/observatorio/posicao'
import { escolherPrincipal, type LinhaPrincipal } from '../_chrome/principal'
import type { CanalPack, CompararPack } from './pack'
import { NO_NICHO, NUMEROS, type Numero, type NumeroId } from './numeros-model'
import { dec, emVezes, haDias, juntar, minuscula, numeros, ordinal, quanto, TOL } from './formatos'

export type CorLado = 'o' | 'b' | 'n' // --lado-o (seu canal), --lado-b, --lado-n

/* ================================================================================================================== resolverPar */

/**
 * a e b válidos e diferentes. `a` ausente ou inválido = "o meu canal" (`escolherPrincipal`: a escolha do dono, `lembrado`, ou o canal próprio
 * de publicação mais recente; a data exata do último vídeo vem do pacote, a mesma entrada da lista); sem canal próprio com vídeos, o
 * maior concorrente. A URL sempre vence: `lembrado` só preenche o que a URL não diz. `b` ausente, inválido ou igual a `a` = o concorrente logo acima de A em inscritos, ou, sem ninguém
 * acima (ou sem a contagem de A), o maior dos outros. null = não há dois canais.
 */
export function resolverPar(pack: CompararPack, a: string | undefined, b: string | undefined, lembrado: string | null = null): { a: string; b: string } | null {
  if (pack.canais.length < 2) return null
  const por = new Map(pack.canais.map(c => [c.id, c] as const))
  const ordem = [...new Set([...pack.ordem.filter(id => por.has(id)), ...pack.canais.map(c => c.id)])]
  const subs = (id: string) => por.get(id)!.numeros.inscritos.x
  const proprio = (id: string) => por.get(id)!.own

  const padraoA = (excluir: string | undefined): string | undefined => {
    const livres = ordem.filter(id => id !== excluir)
    const proprios = livres.filter(proprio).map((id): LinhaPrincipal => {
      const c = por.get(id)!
      // a mesma entrada da lista e do menu (`linhasDoMotor`): o critério único `canalTemVideos` (vídeo guardado conta, com ou sem data); a data, quando há, é a exata (I-11c-2)
      return { id, videos: c.semVideos ? 0 : 1, ultimo: c.ultimo }
    })
    return escolherPrincipal(proprios, lembrado, pack.now) ?? livres.find(id => !proprio(id)) ?? livres[0]
  }
  const padraoB = (de: string): string | undefined => {
    const outros = ordem.filter(id => id !== de)
    const concorrentes = outros.filter(id => !proprio(id))
    const pool = concorrentes.length ? concorrentes : outros // a ordem do pacote: inscritos, maior primeiro, escondidos por último
    const s = subs(de)
    if (s != null) {
      const acima = pool.filter(id => { const x = subs(id); return x != null && x > s })
      if (acima.length) return acima[acima.length - 1] // o mais perto de A, por cima
    }
    return pool[0]
  }

  const va = a != null && por.has(a) ? a : undefined
  const vb = b != null && por.has(b) ? b : undefined
  const A = va ?? padraoA(vb)
  if (A == null) return null
  const B = vb != null && vb !== A ? vb : padraoB(A)
  return B == null || B === A ? null : { a: A, b: B }
}

/* ================================================================================================================== tipos */

export type Relacao =
  | { tipo: 'maior'; lado: 0 | 1; quem: string; texto: string } // "Você: +54% de engajamento"
  | { tipo: 'igual'; texto: string } // "praticamente igual" | "nenhum dos dois publicou longos em 90 dias" | "os dois em 0"
  | { tipo: 'recente'; lado: 0 | 1; quem: string; texto: string } // dias desde o último vídeo
  | { tipo: 'zero'; texto: string } // "você não publicou longos em 90 dias" (sem símbolo)

export interface PosLado { texto: string; geral: string | null } // "14º de 14 em Viagem" + (mesmo nicho) "40º de 75 no geral"

export interface LinhaPar {
  id: NumeroId; grupo: 'tamanho' | 'publicacao' | 'desempenho'; nome: string; base: string
  lados: [Numero, Numero]
  pos: [PosLado | null, PosLado | null] // só nas seis de NO_NICHO
  /** `barras`: larguras de 0 a 1 (a maior vale 1; a menor, se for menos de 3% da maior, vale 0,03 e o aviso diz isso por escrito). Só existe com os dois lados medidos. */
  eixo: { tipo: 'regua' } | { tipo: 'barras'; larguras: [number, number]; aviso: string | null } | { tipo: 'nenhum' }
  relacao: Relacao | null // null: um lado não medido, ou linha sem relação (inscritos em 30 dias)
}

export interface ItemLeitura { simbolo: 'maior' | 'igual' | 'sem'; lado: 0 | 1 | null; texto: string }

export interface ParView {
  a: CanalPack; b: CanalPack; cores: [CorLado, CorLado]
  conjunto: Conjunto; subtitulo: string; titulo: string
  linhas: LinhaPar[] // sem as linhas em que nenhum dos dois tem dado
  fora: string[] // os nomes das linhas que ficaram de fora
  rodape: string
  leitura: ItemLeitura[] // vazio = o bloco não aparece
  status: string
  publicacao: boolean // algum dos dois tem datas?
}

/* ================================================================================================================== as linhas */

type Genero = 'o' | 'a' | 'os' | 'as'
interface Meta {
  grupo: LinhaPar['grupo']; nome: string
  /** O nome curto da linha, no meio de uma frase da Leitura rápida. */
  curto: string
  noun: { t: string; g: Genero } | null
  eixo: 'regua' | 'barras' | 'nenhum'
  /** razao: maior÷menor; dias: menor é mais recente; nenhuma: sem relação nem "é maior em". */
  tipo: 'razao' | 'dias' | 'nenhuma'
  /** Em relação a "sem relação": a Leitura rápida também a deixa de fora de "é maior em" (inscritos em 30 dias e trocas) mas a tabela mostra a relação das trocas. */
  naLeitura: boolean
  /** A Leitura rápida escreve os dois valores ("14,9% contra 9,6%") em vez da diferença. */
  valores?: boolean
  base: (semanas: number) => string
}

const META: Record<NumeroId, Meta> = {
  inscritos: { grupo: 'tamanho', nome: 'Inscritos', curto: 'inscritos', noun: { t: 'inscritos', g: 'os' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'contagem pública do YouTube' },
  inscritos30: { grupo: 'tamanho', nome: 'Inscritos em 30 dias', curto: 'inscritos em 30 dias', noun: null, eixo: 'nenhum', tipo: 'nenhuma', naLeitura: false, base: () => 'a contagem de hoje contra a de 30 dias atrás' },
  longosAcomp: { grupo: 'publicacao', nome: 'Longos acompanhados', curto: 'longos acompanhados', noun: { t: 'longos acompanhados', g: 'os' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'longos com contagem diária de views' },
  longos90: { grupo: 'publicacao', nome: 'Longos publicados em 90 dias', curto: 'longos em 90 dias', noun: { t: 'longos publicados em 90 dias', g: 'os' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'nos últimos 90 dias, acompanhados ou não' },
  ritmo: { grupo: 'publicacao', nome: 'Longos + Shorts por semana', curto: 'ritmo de publicação', noun: { t: 'ritmo de publicação', g: 'o' }, eixo: 'barras', tipo: 'razao', naLeitura: true, base: s => `média das últimas ${s} semanas` },
  diasUltimo: { grupo: 'publicacao', nome: 'Dias desde o último vídeo', curto: 'tempo desde o último vídeo', noun: { t: 'tempo desde o último vídeo', g: 'o' }, eixo: 'nenhum', tipo: 'dias', naLeitura: true, base: () => 'do último vídeo publicado até hoje, de qualquer formato' },
  medianaViews: { grupo: 'desempenho', nome: 'Mediana de views dos longos', curto: 'mediana de views', noun: { t: 'mediana de views dos longos', g: 'a' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'a mediana das views de cada longo acompanhado' },
  vpd: { grupo: 'desempenho', nome: 'Views por dia nos longos', curto: 'views por dia', noun: { t: 'views por dia nos longos', g: 'as' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'mediana das views por dia dos longos acompanhados' },
  vpdPorMil: { grupo: 'desempenho', nome: 'Views por dia por mil inscritos', curto: 'views por dia por mil inscritos', noun: { t: 'views por dia por mil inscritos', g: 'as' }, eixo: 'regua', tipo: 'razao', naLeitura: true, base: () => 'views por dia nos longos ÷ mil inscritos' },
  engajamento: { grupo: 'desempenho', nome: 'Engajamento nos longos', curto: 'engajamento', noun: { t: 'engajamento', g: 'o' }, eixo: 'barras', tipo: 'razao', naLeitura: true, valores: true, base: () => '(curtidas + comentários) ÷ views, mediana dos longos guardados' },
  acima2x: { grupo: 'desempenho', nome: 'Vídeos acima de 2× em 90 dias', curto: 'vídeos acima de 2×', noun: { t: 'vídeos acima de 2×', g: 'os' }, eixo: 'barras', tipo: 'razao', naLeitura: true, base: () => 'longos de até 90 dias com 2× ou mais do normal do canal' },
  duracao: { grupo: 'desempenho', nome: 'Duração mediana dos longos', curto: 'duração', noun: { t: 'duração mediana', g: 'a' }, eixo: 'barras', tipo: 'razao', naLeitura: true, valores: true, base: () => 'mediana dos longos acompanhados com duração conhecida' },
  trocas30: { grupo: 'desempenho', nome: 'Trocas de título e thumbnail em 30 dias', curto: 'trocas em 30 dias', noun: { t: 'trocas em 30 dias', g: 'as' }, eixo: 'barras', tipo: 'razao', naLeitura: false, base: () => 'títulos e thumbnails trocados nos últimos 30 dias; a troca de descrição não conta' },
}

const POSS: Record<Genero, string> = { o: 'seu', a: 'sua', os: 'seus', as: 'suas' }

/* ================================================================================================================== a conta */

/** Maior só a partir de 10% de diferença; "×" só a partir de 2×. */
const LIMITE_IGUAL = 1.1

type Cmp =
  | { t: 'doisZero' }
  | { t: 'umZero'; zero: 0 | 1 }
  | { t: 'igual' }
  | { t: 'maior'; lado: 0 | 1; q: number }

/**
 * null = valor que não dá para comparar (não finito ou negativo): nunca vira relação. IMPOSSÍVEL para um pacote do
 * servidor: `medido()` (numeros-model) recusa não finito, e os doze números com relação não aceitam negativo (só inscritos
 * em 30 dias pode ser negativo e essa linha nunca tem relação); o que seria negativo vira "inválido" com aviso, não relação
 * calada. Um teste percorre todos os pares e afirma que linha com os dois lados medidos sempre tem relação.
 *
 * Os DOIS TEXTOS escritos iguais (0,26 e 0,34 viram "0,3"): "praticamente igual", sempre. A tela nunca mostra duas células
 * iguais com uma diferença percentual ao lado, nem "(empate)" na posição e "+31%" na relação: o empate de posição também
 * decide pelo texto escrito. Nenhuma divisão acontece antes de checar os zeros.
 */
function comparar(na: Numero, nb: Numero): Cmp | null {
  const xa = na.x, xb = nb.x
  if (xa == null || xb == null || !Number.isFinite(xa) || !Number.isFinite(xb) || xa < 0 || xb < 0) return null
  if (xa === 0 && xb === 0) return { t: 'doisZero' }
  if (na.texto != null && na.texto === nb.texto) return { t: 'igual' }
  if (xa === 0 || xb === 0) return { t: 'umZero', zero: xa === 0 ? 0 : 1 }
  const lado = xb > xa ? 1 : 0
  const q = lado === 1 ? xb / xa : xa / xb // maior ÷ menor, sempre >= 1
  return q < LIMITE_IGUAL - TOL ? { t: 'igual' } : { t: 'maior', lado, q }
}

/* ================================================================================================================== buildPar */

export function coresDoPar(a: CanalPack, b: CanalPack): [CorLado, CorLado] {
  return a.own ? ['o', 'b'] : b.own ? ['b', 'o'] : ['n', 'b']
}

/**
 * O par de dois canais DIFERENTES: o mesmo canal dos dois lados lança (`resolverPar` nunca o devolve; a tela escolhe o par
 * por ele e o seletor deixa o canal do outro lado desabilitado).
 */
export function buildPar(pack: CompararPack, idA: string, idB: string): ParView {
  if (idA === idB) throw new Error(`par com o mesmo canal dos dois lados: ${idA}`)
  const a = pack.canais.find(c => c.id === idA), b = pack.canais.find(c => c.id === idB)
  if (!a || !b) throw new Error(`canal desconhecido no par: ${idA} / ${idB}`)
  const lados = [a, b] as const
  const ambosProprios = a.own && b.own
  /** "Você" só quando exatamente um dos dois é canal seu; com os dois, cada um é chamado pelo nome. */
  const voce = (i: 0 | 1) => lados[i].own && !ambosProprios
  const quem = (i: 0 | 1, cap = true) => (voce(i) ? (cap ? 'Você' : 'você') : lados[i].name)

  /* ---- o conjunto da posição (D11): o nicho dos dois, ou todos os canais */
  const mesmoNicho = a.niche != null && a.niche === b.niche
  const conjunto: Conjunto = mesmoNicho ? { tipo: 'nicho', niche: a.niche!, label: a.nicheLabel ?? a.niche! } : { tipo: 'geral' }
  const doNicho = mesmoNicho ? pack.canais.filter(c => c.niche === a.niche) : pack.canais
  const GERAL: Conjunto = { tipo: 'geral' }
  const posTexto = (p: Posicao, c: Conjunto) => `${ordinal(p.pos)} de ${p.de} ${conjuntoTexto(c)}${p.empate ? ' (empate)' : ''}`
  const rolPos = (id: NumeroId, canais: readonly CanalPack[]) =>
    posicoes(canais.map(c => ({ id: c.id, x: c.numeros[id].x, chave: c.numeros[id].texto ?? undefined })))

  const semanas = pack.semanasRitmo
  const linhas: LinhaPar[] = []
  const fora: string[] = []

  for (const id of NUMEROS) {
    const m = META[id]
    const na = a.numeros[id], nb = b.numeros[id]
    if (na.x == null && nb.x == null) { fora.push(m.nome); continue }

    /* posição: só as seis do nicho, uma conta por número */
    let pos: LinhaPar['pos'] = [null, null]
    if (NO_NICHO.has(id)) {
      const noConjunto = rolPos(id, doNicho), noGeral = mesmoNicho ? rolPos(id, pack.canais) : noConjunto
      pos = lados.map(c => {
        const p = noConjunto.get(c.id)
        if (!p) return null
        const g = mesmoNicho ? noGeral.get(c.id) : null
        return { texto: posTexto(p, conjunto), geral: g ? posTexto(g, GERAL) : null }
      }) as LinhaPar['pos']
    }

    linhas.push({
      id, grupo: m.grupo, nome: m.nome, base: m.base(semanas), lados: [na, nb], pos,
      eixo: eixoDe(m, na, nb), relacao: relacaoDe(id, m, na, nb),
    })
  }

  /* ---- a relação em palavras, sempre nomeando o maior */
  function relacaoDe(id: NumeroId, m: Meta, na: Numero, nb: Numero): Relacao | null {
    if (na.x == null || nb.x == null || m.tipo === 'nenhuma') return null
    if (m.tipo === 'dias') return relacaoDias(na.x, nb.x)
    const noun = m.noun!
    const cmp = comparar(na, nb)
    if (!cmp) return null
    switch (cmp.t) {
      case 'doisZero': return { tipo: 'igual', texto: zeroDois(id) }
      case 'umZero': return { tipo: 'zero', texto: zeroUm(id, cmp.zero) }
      case 'igual': return { tipo: 'igual', texto: 'praticamente igual' }
      case 'maior': {
        const maior = cmp.lado, menor = maior === 0 ? 1 : 0
        const ref = `${noun.g} ${voce(menor) ? `${POSS[noun.g]} ${noun.t}` : `${noun.t} de ${lados[menor].name}`}`
        const q = quanto(cmp.q)
        const corpo = emVezes(cmp.q) ? `${q} ${ref}` : `${q} de ${noun.t}`
        return { tipo: 'maior', lado: maior, quem: quem(maior), texto: `${quem(maior)}: ${corpo}` }
      }
      default: { const nunca: never = cmp; return nunca }
    }
  }
  /** Dias desde o último vídeo: menor é mais recente; a frase diz quem publicou por último, sem "×" nem "%" e sem barra. */
  function relacaoDias(xa: number, xb: number): Relacao | null {
    if (!Number.isFinite(xa) || !Number.isFinite(xb) || xa < 0 || xb < 0) return null
    if (xa === xb) return { tipo: 'igual', texto: `Os dois publicaram ${haDias(xa)}` }
    const rec: 0 | 1 = xa < xb ? 0 : 1, outro: 0 | 1 = rec === 0 ? 1 : 0, dr = Math.min(xa, xb), dout = Math.max(xa, xb)
    return { tipo: 'recente', lado: rec, quem: quem(rec), texto: `${quem(rec)} publicou mais recentemente: ${haDias(dr)}; ${quem(outro, false)}, ${haDias(dout)}` }
  }
  /** Zero em linguagem de gente, conforme a linha (a razão com zero não existe). */
  function zeroUm(id: NumeroId, zero: 0 | 1): string {
    const sujeito = voce(zero) ? 'você' : lados[zero].name
    switch (id) {
      case 'longos90': return `${sujeito} não publicou longos em 90 dias`
      case 'ritmo': return `${sujeito} não publicou em ${semanas} semanas`
      case 'acima2x': return `${sujeito} não tem vídeo acima de 2× em 90 dias`
      default: return `${quem(zero)} tem 0`
    }
  }
  function zeroDois(id: NumeroId): string {
    switch (id) {
      case 'longos90': return 'nenhum dos dois publicou longos em 90 dias'
      case 'ritmo': return `nenhum dos dois publicou em ${semanas} semanas`
      case 'acima2x': return 'nenhum dos dois tem vídeo acima de 2× em 90 dias'
      default: return 'os dois em 0'
    }
  }

  /* ---- o eixo: régua do nicho, barras finas ou nada */
  function eixoDe(m: Meta, na: Numero, nb: Numero): LinhaPar['eixo'] {
    if (m.eixo === 'regua') return { tipo: 'regua' }
    if (m.eixo === 'nenhum') return { tipo: 'nenhum' }
    // barras: sem barra quando um lado não foi medido (spec 18.4) ou quando nenhum dos dois tem o que mostrar
    if (na.x == null || nb.x == null || !Number.isFinite(na.x) || !Number.isFinite(nb.x) || na.x < 0 || nb.x < 0) return { tipo: 'nenhum' }
    const mx = Math.max(na.x, nb.x)
    if (mx <= 0) return { tipo: 'nenhum' }
    let aviso: string | null = null
    const larg = (x: number) => {
      const s = x / mx
      if (x > 0 && s < MINIMA) { aviso = 'menos de 3% da barra do outro lado'; return MINIMA }
      return x === 0 ? 0 : s
    }
    return { tipo: 'barras', larguras: [larg(na.x), larg(nb.x)], aviso }
  }

  /* ---- Leitura rápida: o que a tabela diz, sem ler a tabela (spec 18.3). "É maior", nunca "ganha". */
  const leitura = leituraRapida()
  function leituraRapida(): ItemLeitura[] {
    interface Item { r: number; t: string }
    const por: [Item[], Item[]] = [[], []]
    const iguais: string[] = []
    const falta: [string[], string[]] = [[], []]
    let semComo = 0

    for (const l of linhas) {
      const m = META[l.id], [na, nb] = l.lados
      if (na.x == null || nb.x == null) {
        semComo++
        if (na.x == null) falta[0].push(m.curto)
        if (nb.x == null) falta[1].push(m.curto)
        continue
      }
      if (!m.naLeitura) continue
      if (m.tipo === 'dias') {
        const r = relacaoDias(na.x, nb.x)
        if (r?.tipo === 'recente') por[r.lado].push({ r: 1, t: 'publicação mais recente' })
        else if (r?.tipo === 'igual') iguais.push(m.curto)
        continue
      }
      const cmp = comparar(na, nb)
      if (!cmp) continue
      switch (cmp.t) {
        case 'igual':
        case 'doisZero': iguais.push(m.curto); break
        case 'umZero': {
          const lado: 0 | 1 = cmp.zero === 0 ? 1 : 0
          const mx = lado === 0 ? na : nb, mn = lado === 0 ? nb : na
          por[lado].push({ r: Number.POSITIVE_INFINITY, t: m.valores ? `${m.curto} (${mx.texto} contra ${mn.texto})` : `${m.curto} (${compacto(l.id, mx)} contra 0)` })
          break
        }
        case 'maior': {
          const mx = cmp.lado === 0 ? na : nb, mn = cmp.lado === 0 ? nb : na
          por[cmp.lado].push({ r: cmp.q, t: m.valores ? `${m.curto} (${mx.texto} contra ${mn.texto})` : `${m.curto} (${quanto(cmp.q)})` })
          break
        }
        default: { const nunca: never = cmp; void nunca }
      }
    }

    const out: ItemLeitura[] = []
    for (const lado of [0, 1] as const) {
      const its = por[lado]
      if (!its.length) continue
      its.sort((x, y) => (x.r === y.r ? 0 : y.r > x.r ? 1 : -1)) // do de maior diferença para o menor; contra zero primeiro; empate: ordem da tabela
      out.push({ simbolo: 'maior', lado, texto: `${quem(lado)} é maior em: ${cortar(its.map(i => i.t), 3)}.` })
    }
    if (iguais.length) out.push({ simbolo: 'igual', lado: null, texto: `Praticamente iguais: ${cortar(iguais, 3)}.` })
    if (semComo) {
      const partes = ([0, 1] as const).filter(i => falta[i].length).map(i => {
        const n = falta[i]
        return `falta o dado ${voce(i) ? 'do seu canal' : `de ${lados[i].name}`} em ${n.length > 3 ? `${n.slice(0, 2).join(', ')} e mais ${n.length - 2}` : juntar(n)}`
      })
      out.push({ simbolo: 'sem', lado: null, texto: `Sem como comparar ainda: ${numeros(semComo)} (${partes.join('; ')}).` })
    }
    return out
  }

  /* ---- cabeçalho da tela, rodapé e status */
  const publicacao = a.comDatas || b.comDatas
  const rodape = 'Maior não quer dizer melhor: são canais de tamanhos diferentes.'
    + (fora.length ? ` ${fora.length === 1 ? '1 número ficou' : `${fora.length} números ficaram`} de fora: nenhum dos dois canais tem o dado (${juntar(fora.map(minuscula))}).` : '')
    + (publicacao ? '' : ' O bloco de publicação não aparece: nenhum dos dois canais tem datas de publicação.')
  const status = `Comparando ${a.name} e ${b.name}.`
    + (fora.length ? ` ${fora.length === 1 ? '1 número sem dado em nenhum dos dois canais ficou' : `${fora.length} números sem dado em nenhum dos dois canais ficaram`} de fora.` : '')

  const subtitulo = mesmoNicho
    ? `Dois canais de ${a.nicheLabel ?? a.niche}, lado a lado, com o mesmo peso.`
    : a.niche != null && b.niche != null
      ? 'Dois canais de nichos diferentes, lado a lado, com o mesmo peso. A régua e as posições comparam com todos os canais do site.'
      : 'Dois canais, lado a lado, com o mesmo peso. A régua e as posições comparam com todos os canais do site.'

  return { a, b, cores: coresDoPar(a, b), conjunto, subtitulo, titulo: `Comparar: ${a.name} e ${b.name}`, linhas, fora, rodape, leitura, status, publicacao }
}

/** A menor largura de uma barra, em fração da maior (spec 18.4: menos de 3% ganha 3 px e a linha avisa). */
const MINIMA = 0.03

/** "a, b e c" ou, passando de `max`, "a, b, c e mais N". */
function cortar(xs: readonly string[], max: number): string {
  return xs.length > max ? `${xs.slice(0, max).join(', ')} e mais ${xs.length - max}` : juntar(xs)
}

/** O valor do lado maior quando o outro vale 0, curto: o ritmo diz "por semana"; vídeos acima de 2× diz só a contagem. */
function compacto(id: NumeroId, n: Numero): string {
  if (id === 'ritmo' && n.x != null) return `${dec(Math.round(n.x * 10) / 10, 1)} por semana`
  if (id === 'acima2x' && n.x != null) return String(n.x)
  return n.texto ?? ''
}
