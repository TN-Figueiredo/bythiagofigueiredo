// A7a T2: o corte por tamanho do acesso pela IA, em estágios. A lista principal da tela (os canais, os vídeos, as trocas) fica inteira; o corte começa
// pelo que repete e pode vir por item (notas, dicas), depois pelo que é geral, depois pelas colunas, e só em último caso pela própria principal (E3,
// rede de segurança até a janela da T9). Puro: sem relógio, sem banco, sem Sentry (quem avisa é o `responder`, com as flags que daqui saem).
import { montarTexto, type TextoMontado } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar, type PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { ContextoDoPacote, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

export type ClasseNaIa = 'principal' | 'coluna' | 'texto' | 'por_nome' | 'resumo-da-tela' | 'geral'
type TelaComLista = 'canais' | 'outliers' | 'mudancas'

/** Ids das tabelas `lista` de cada tela (lidos nos empacotadores) e a classe de cada um. `privado-*` e o que não está aqui contam como `geral`. */
export const CLASSES_NA_IA: Record<TelaComLista, Record<string, ClasseNaIa>> = {
  canais: {
    canais: 'principal',
    'canais-nicho': 'coluna', 'canais-direcao-numeros': 'coluna', 'canais-views-por-dia': 'coluna', 'canais-maior-outlier': 'coluna', 'canais-outliers-contagem': 'coluna',
    'canais-shorts': 'coluna', 'canais-shorts-views-por-dia': 'coluna', 'canais-estado': 'coluna',
    'canais-notas': 'texto', 'canais-dicas': 'texto',
    'canais-referencias': 'por_nome', 'canais-referencias-notas': 'por_nome', 'canais-inscritos': 'por_nome', 'canais-inscritos-notas': 'por_nome',
  },
  outliers: { outliers: 'principal', 'outliers-avisos': 'texto', 'outliers-reuso': 'geral', 'canais-com-problema': 'geral', 'forja-do-site': 'geral' },
  mudancas: {
    trocas: 'principal',
    'trocas-efeito': 'coluna', 'trocas-esperado': 'coluna', 'trocas-faixa': 'coluna', 'trocas-base': 'coluna',
    'trocas-titulos': 'texto', 'trocas-thumbs': 'texto', 'trocas-descricoes': 'texto', 'trocas-notas': 'texto',
    'forja-do-site': 'geral',
  },
}

export function classeDa(tela: TelaId, tabela: { id: string; tipo: 'lista' | 'fixa' | string }): ClasseNaIa {
  if (tabela.tipo === 'fixa') return 'resumo-da-tela'
  if (tabela.id.startsWith('privado-')) return 'geral'
  return CLASSES_NA_IA[tela as TelaComLista]?.[tabela.id] ?? 'geral'
}

/** Os degraus do corte por tamanho para o limite `n` da ação: o texto só cai para 25 linhas depois de tentar 150, 100, 75 e 50. */
export const degrausDoLimite = (n: number): number[] => [n, 150, 100, 75, 50, 25, 10, 5, 3, 1, 0].filter((x, i, xs) => x <= n && xs.indexOf(x) === i)

/** Tira o corte das linhas das tabelas `ids`: elas entram inteiras em qualquer degrau. O bloco citado pendurado na linha (a descrição de cada troca) é texto e continua cortável. */
export function fixarLinhas(p: PacoteSerializado, ids: ReadonlySet<string>): PacoteSerializado {
  return { ...p, segmentos: p.segmentos.map((s) => (s.corte?.classe === 'linha_de_lista' && !s.corte.citado && ids.has(s.corte.tabela) ? { ...s, corte: null } : s)) }
}

export interface Corte {
  texto: TextoMontado
  estagio: 'E0' | 'E1' | 'E2' | 'E2b' | 'E3'
  /** Os avisos que o corte pôs no pacote (parte 6). */
  avisos: string[]
  linhasDaPrincipal: number
  totalDaPrincipal: number
  principalCortada: boolean
  /** `PacoteSerializado.primeiraLinhaDeAviso`, para o `responder` pôr o topo depois dela. */
  primeiraLinhaDeAviso: string | null
}

const SUBSTANTIVO: Record<TelaComLista, string> = { canais: 'canais', outliers: 'vídeos', mudancas: 'mudanças' }
const TELA_DO_DETALHE: Record<TelaComLista, string> = { canais: '', outliers: 'Destaques', mudancas: 'Mudanças' }
const ehTelaComLista = (t: TelaId): t is TelaComLista => t === 'canais' || t === 'outliers' || t === 'mudancas'

const avisoDeLinhas = (tela: TelaId, titulo: string, quantas: number): string =>
  tela === 'canais'
    ? `tabela "${titulo}": ${quantas} linhas não couberam; peça a ação canal com o Id para as de um item`
    : `tabela "${titulo}": ${quantas} linhas não couberam; o detalhe aparece na tela ${ehTelaComLista(tela) ? TELA_DO_DETALHE[tela] : 'da lista'}`
const avisoDeColunas = (tela: TelaId, titulo: string, quantas: number): string =>
  `tabela "${titulo}": colunas de ${quantas} ${ehTelaComLista(tela) ? SUBSTANTIVO[tela] : 'linhas'} não couberam`

interface Config {
  /** Classes cujas linhas entram inteiras em qualquer degrau. */
  fixos: readonly ClasseNaIa[]
  /** `fora`: as tabelas de texto saem do pacote, com um aviso por tabela. */
  texto: 'degraus' | 'fora' | 'dentro'
  avisaColunas?: boolean
  avisaPrincipal?: boolean
}
const ESTAGIOS: Array<[Corte['estagio'], Config]> = [
  ['E1', { fixos: ['principal', 'coluna', 'geral', 'por_nome'], texto: 'degraus' }],
  ['E2', { fixos: ['principal', 'coluna'], texto: 'fora' }],
  ['E2b', { fixos: ['principal'], texto: 'fora', avisaColunas: true }],
  ['E3', { fixos: [], texto: 'dentro', avisaPrincipal: true }],
]

const tamanhoDe = (p: PacoteSerializado): number => p.segmentos.reduce((a, x) => a + x.texto.length + 1, 0)

/**
 * `totais`: quantas linhas cada lista tinha antes do limite da ação (`limitarLinhas`); sem ele vale o que o modelo traz.
 * `avisoDaPrincipal`: a frase que o `limitarLinhas` pôs em `modelo.avisos` para a principal (o E3 a troca pela sua; tirada por identidade).
 */
export function escolherCorte(modelo: PacoteModelo, ctx: ContextoDoPacote, n: number, teto: number, totais?: ReadonlyMap<string, number>, avisoDaPrincipal?: string | null): Corte {
  const tela = modelo.tela
  const classe = (t: Tabela): ClasseNaIa => classeDa(tela, t)
  const principal = modelo.tabelas.find((t) => classe(t) === 'principal')
  const real = (t: Tabela): number => totais?.get(t.id) ?? t.linhas.length
  const totalDaPrincipal = principal ? real(principal) : 0
  const degraus = degrausDoLimite(n)
  const rodar = (m: PacoteModelo, fixos: ReadonlySet<string>, antes: ReadonlyArray<{ rotulo: string; caracteres: number }> = []): { t: TextoMontado; p: PacoteSerializado } => {
    const p = fixarLinhas(segmentar(m, ctx), fixos)
    return { t: montarTexto(p, '', teto, 'todos', degraus, { ia: true, cortadoAntes: antes }), p }
  }
  const avisoDaLimite = (t: Tabela): string => `tabela "${t.titulo}": há ${real(t)} linhas; saíram ${t.linhas.length}, na ordem da tela`
  const citadosDaPrincipal = principal ? modelo.citados.filter((b) => b.linha?.tabela === principal.id) : []

  /** Os avisos das listas que o limite da ação ou o degrau `g` cortaram (a principal só no E3, que é quando ela sai por tamanho). */
  const avisosDasListas = (cfg: Config, g: number | null, base: readonly Tabela[]): string[] => {
    const avisos: string[] = []
    for (const t of base) {
      if (t.tipo !== 'lista') continue
      const c = classe(t)
      const cortaG = g !== null && t.linhas.length > g
      if (c === 'principal') {
        if (cfg.avisaPrincipal && cortaG) {
          const resto = g < n ? ` (o limite da ação é ${n}; o resto não coube no tamanho)` : ''
          avisos.push(`há ${totalDaPrincipal} ${ehTelaComLista(tela) ? SUBSTANTIVO[tela] : 'linhas'}; saíram ${g}, na ordem da tela${resto}`)
        } else if (cfg.avisaPrincipal && avisoDaPrincipal) avisos.push(avisoDaPrincipal) // o tamanho não cortou a principal: vale a frase do limite da ação
        continue
      }
      const fixa = cfg.fixos.includes(c)
      const mantidas = !fixa && cortaG ? g : t.linhas.length
      if (c === 'texto') { if (real(t) > mantidas) avisos.push(avisoDeLinhas(tela, t.titulo, real(t) - mantidas)) }
      else if (c === 'coluna' && cfg.avisaColunas && cortaG) avisos.push(avisoDeColunas(tela, t.titulo, real(t) - g))
      else if (real(t) > t.linhas.length && !(cortaG && !fixa)) avisos.push(avisoDaLimite(t))
      else if (real(t) > t.linhas.length) avisos.push(avisoDeLinhas(tela, t.titulo, real(t) - mantidas))
    }
    // as descrições penduradas na principal são texto: saem antes dela, e o aviso conta quantas
    if (!cfg.avisaPrincipal && g !== null && principal && ehTelaComLista(tela)) {
      const fora = citadosDaPrincipal.filter((b) => (b.linha?.posicao ?? 0) > g).length
      if (fora > 0) avisos.push(`descrições de ${fora} ${SUBSTANTIVO[tela]} não couberam; o detalhe aparece na tela ${TELA_DO_DETALHE[tela] || 'da lista'}`)
    }
    return avisos
  }

  // E0: tudo, nada fixo. Só vale se nada foi cortado (`cabe` é verdadeiro só no plano 0); degrau que "cabe" cortando a principal não vale.
  const avisosE0 = avisosDasListas({ fixos: [], texto: 'dentro' }, null, modelo.tabelas)
  const inteiro = rodar({ ...modelo, avisos: [...modelo.avisos, ...avisosE0] }, new Set())
  if (inteiro.t.cabe) {
    return { texto: inteiro.t, estagio: 'E0', avisos: avisosE0, linhasDaPrincipal: principal?.linhas.length ?? 0, totalDaPrincipal, principalCortada: false, primeiraLinhaDeAviso: inteiro.p.primeiraLinhaDeAviso }
  }

  let ultimo: Corte | null = null
  for (const [estagio, cfg] of ESTAGIOS) {
    const fixos = new Set(modelo.tabelas.filter((t) => t.tipo === 'lista' && cfg.fixos.includes(classe(t))).map((t) => t.id))
    const base = cfg.texto === 'fora' ? modelo.tabelas.filter((t) => classe(t) !== 'texto') : modelo.tabelas
    const saidas = modelo.tabelas.filter((t) => !base.includes(t))
    // o que saiu antes de segmentar não está no pacote: o `montarTexto` precisa saber, para não dizer "Por tamanho: nada"
    const soltos = modelo.citados.filter((b) => !b.linha)
    const vazio = saidas.length ? tamanhoDe(segmentar({ ...modelo, tabelas: [], citados: soltos }, ctx)) : 0
    const antes = saidas.map((t) => ({
      rotulo: `a tabela "${t.titulo}"`,
      caracteres: Math.max(0, tamanhoDe(segmentar({ ...modelo, tabelas: [t], citados: [...soltos, ...modelo.citados.filter((b) => b.linha?.tabela === t.id)] }, ctx)) - vazio),
    }))
    // a principal da limite da ação só some do aviso no E3; filtrada por identidade, nunca por casamento de texto
    const semAvisoDaPrincipal = cfg.avisaPrincipal && avisoDaPrincipal ? modelo.avisos.filter((a) => a !== avisoDaPrincipal) : modelo.avisos
    // O aviso diz quantas linhas o texto levou, e o texto muda de tamanho com o aviso: repete até o degrau parar (só desce, então para).
    const passada = (g: number | null): { avisos: string[]; feito: { t: TextoMontado; p: PacoteSerializado } } => {
      const avisos = [...saidas.map((t) => avisoDeLinhas(tela, t.titulo, real(t))), ...avisosDasListas(cfg, g, base)]
      return { avisos, feito: rodar({ ...modelo, tabelas: base, avisos: [...semAvisoDaPrincipal, ...avisos] }, fixos, antes) }
    }
    let g: number | null = null
    let r = passada(g)
    // o degrau só desce e há `degraus.length` deles: mais voltas que isso é invariante quebrado
    for (let volta = 0; volta <= degraus.length; volta += 1) {
      const novo = r.feito.t.degrau
      if (novo === g || novo === null) break
      g = novo
      r = passada(g)
      if (volta === degraus.length) throw new Error('corte-da-ia: o aviso não chegou a um degrau fixo')
    }
    const f = r.feito
    const avisos = r.avisos
    const grau = f.t.degrau
    const cortouAPrincipal = principal !== undefined && grau !== null && principal.linhas.length > grau
    ultimo = {
      texto: f.t, estagio, avisos,
      linhasDaPrincipal: estagio === 'E3' && grau !== null ? Math.min(totalDaPrincipal, grau) : (principal?.linhas.length ?? 0),
      totalDaPrincipal, principalCortada: estagio === 'E3' && (cortouAPrincipal || f.t.pisoPassou), primeiraLinhaDeAviso: f.p.primeiraLinhaDeAviso,
    }
    if (!f.t.pisoPassou) return ultimo
  }
  return ultimo!
}
