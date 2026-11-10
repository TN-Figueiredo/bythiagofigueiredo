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

/** Tira o corte das linhas (e dos blocos citados delas) das tabelas `ids`: elas entram inteiras em qualquer degrau. */
export function fixarLinhas(p: PacoteSerializado, ids: ReadonlySet<string>): PacoteSerializado {
  return { ...p, segmentos: p.segmentos.map((s) => (s.corte?.classe === 'linha_de_lista' && ids.has(s.corte.tabela) ? { ...s, corte: null } : s)) }
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

export function escolherCorte(modelo: PacoteModelo, ctx: ContextoDoPacote, n: number, teto: number, totalReal?: number): Corte {
  const tela = modelo.tela
  const classe = (t: Tabela): ClasseNaIa => classeDa(tela, t)
  const principal = modelo.tabelas.find((t) => classe(t) === 'principal')
  const totalDaPrincipal = principal?.linhas.length ?? 0
  const degraus = degrausDoLimite(n)
  const rodar = (m: PacoteModelo, fixos: ReadonlySet<string>): { t: TextoMontado; p: PacoteSerializado } => {
    const p = fixarLinhas(segmentar(m, ctx), fixos)
    return { t: montarTexto(p, '', teto, 'todos', degraus, { ia: true }), p }
  }

  // E0: tudo, nada fixo. Só vale se nada foi cortado (`cabe` é verdadeiro só no plano 0); degrau que "cabe" cortando a principal não vale.
  const inteiro = rodar(modelo, new Set())
  if (inteiro.t.cabe) {
    return { texto: inteiro.t, estagio: 'E0', avisos: [], linhasDaPrincipal: totalDaPrincipal, totalDaPrincipal, principalCortada: false, primeiraLinhaDeAviso: inteiro.p.primeiraLinhaDeAviso }
  }

  let ultimo: Corte | null = null
  for (const [estagio, cfg] of ESTAGIOS) {
    const fixos = new Set(modelo.tabelas.filter((t) => t.tipo === 'lista' && cfg.fixos.includes(classe(t))).map((t) => t.id))
    const base = cfg.texto === 'fora' ? modelo.tabelas.filter((t) => classe(t) !== 'texto') : modelo.tabelas
    const semAvisoDaPrincipal = cfg.avisaPrincipal ? modelo.avisos.filter((a) => !(a.startsWith('há ') && a.includes('; saíram '))) : modelo.avisos
    // O aviso diz quantas linhas o texto levou, e o texto muda de tamanho com o aviso: repete até o degrau parar (só desce, então para).
    let g: number | null = null
    let feito: { t: TextoMontado; p: PacoteSerializado } | null = null
    let avisos: string[] = []
    for (let volta = 0; volta < 5; volta += 1) {
      avisos = []
      if (cfg.texto === 'fora') for (const t of modelo.tabelas) if (classe(t) === 'texto') avisos.push(avisoDeLinhas(tela, t.titulo, t.linhas.length))
      if (g !== null) {
        if (cfg.texto === 'degraus') for (const t of base) if (classe(t) === 'texto' && t.linhas.length > g) avisos.push(avisoDeLinhas(tela, t.titulo, t.linhas.length - g))
        if (cfg.avisaColunas) for (const t of base) if (t.tipo === 'lista' && classe(t) === 'coluna' && t.linhas.length > g) avisos.push(avisoDeColunas(tela, t.titulo, t.linhas.length - g))
        if (cfg.avisaPrincipal && principal && principal.linhas.length > g) {
          const resto = g < n ? ` (o limite da ação é ${n}; o resto não coube no tamanho)` : ''
          avisos.push(`há ${totalReal ?? totalDaPrincipal} ${ehTelaComLista(tela) ? SUBSTANTIVO[tela] : 'linhas'}; saíram ${g}, na ordem da tela${resto}`)
        }
      }
      feito = rodar({ ...modelo, tabelas: base, avisos: [...semAvisoDaPrincipal, ...avisos] }, fixos)
      const novo = feito.t.degrau
      if (novo === g || novo === null) break
      g = novo
    }
    const f = feito!
    const grau = f.t.degrau
    const cortouAPrincipal = principal !== undefined && grau !== null && principal.linhas.length > grau
    ultimo = {
      texto: f.t, estagio, avisos,
      linhasDaPrincipal: estagio === 'E3' && grau !== null ? Math.min(totalDaPrincipal, grau) : totalDaPrincipal,
      totalDaPrincipal, principalCortada: estagio === 'E3' && (cortouAPrincipal || f.t.pisoPassou), primeiraLinhaDeAviso: f.p.primeiraLinhaDeAviso,
    }
    if (!f.t.pisoPassou) return ultimo
  }
  return ultimo!
}
