// A7a T2: o corte por tamanho do acesso pela IA, em estágios. A lista principal da tela (os canais, os vídeos, as trocas) fica inteira; o corte começa
// pelo que repete e pode vir por item (notas, dicas), depois pelo que é geral, depois pelas colunas, e só em último caso pela própria principal (E3,
// rede de segurança até a janela da T9). Puro: sem relógio, sem banco, sem Sentry (quem avisa é o `responder`, com as flags que daqui saem).
import { createHash } from 'node:crypto'
import { montarTexto, type TextoMontado } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar, type PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { BlocoCitado, Celula, ContextoDoPacote, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

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

/** Tabelas de texto que ficam fora de toda janela de lista (notas e dicas de Canais; R2 do plano). As outras tabelas de texto seguem as linhas da janela pela origem. */
export const TEXTO_SEMPRE_FORA: ReadonlySet<string> = new Set(['canais-notas', 'canais-dicas'])

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
  estagio: 'E0' | 'E1' | 'E2' | 'E2t' | 'E2b' | 'E2c' | 'E3'
  /** Os avisos que o corte pôs no pacote (parte 6). */
  avisos: string[]
  linhasDaPrincipal: number
  totalDaPrincipal: number
  principalCortada: boolean
  /** `PacoteSerializado.primeiraLinhaDeAviso`, para o `responder` pôr o topo depois dela. */
  primeiraLinhaDeAviso: string | null
  /** T4: as outras listas (não a principal) e quantas linhas cada uma levou no texto; `saiu` = levadas, `de` = o que a tela tinha. */
  apoio: Array<{ titulo: string; saiu: number; de: number }>
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
  /** Das listas que não são a principal: quantas linhas cada uma leva no estágio `cfg` com o degrau `g` (`saidas` = tabelas tiradas antes de segmentar). */
  const apoioDe = (cfg: Config | null, g: number | null, saidas: readonly Tabela[]): Corte['apoio'] =>
    modelo.tabelas.filter((t) => t.tipo === 'lista' && classe(t) !== 'principal').map((t) => {
      const fixa = cfg !== null && cfg.fixos.includes(classe(t))
      const levadas = saidas.includes(t) ? 0 : !fixa && g !== null && t.linhas.length > g ? g : t.linhas.length
      return { titulo: t.titulo, saiu: levadas, de: real(t) }
    })
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
    return { texto: inteiro.t, estagio: 'E0', avisos: avisosE0, linhasDaPrincipal: principal?.linhas.length ?? 0, totalDaPrincipal, principalCortada: false, primeiraLinhaDeAviso: inteiro.p.primeiraLinhaDeAviso, apoio: apoioDe(null, null, []) }
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
      apoio: apoioDe(cfg, grau, saidas),
    }
    if (!f.t.pisoPassou) return ultimo
  }
  return ultimo!
}


/* ------------------------------------------------------------------ A7b T9: a janela da lista principal */

export interface JanelaDaLista {
  corte: Corte
  inicio: number
  /** Linhas da principal nesta janela (`k` exato: o maior que cabe em `teto`, no máximo `n`). */
  k: number
  /** Linhas da principal antes de qualquer corte. */
  total: number
  /** 8 hex do SHA-256 dos Ids da principal inteira, na ordem. */
  marca: string
  /** Linhas de apoio (coluna, por nome) sem dona na principal: vão para a janela 1 e contam aqui. */
  semDona: number
  /** Tabelas de texto que ficam sempre fora (notas, dicas de Canais): linhas que a janela teria e que se pedem por item. */
  textoFora: { tabelas: number; linhas: number }
  /** Nem a janela de 1 linha coube: o fim do texto é cortado e quem chama avisa. */
  linhaNaoCabe: boolean
}

const chaveDeOrigem = (l: readonly Celula[]): string | null => l.find((c) => c.papel === 'terceiros')?.origem ?? null
const nomeDaLinha = (l: readonly Celula[]): string | null => { const c = l.find((x) => x.papel === 'terceiros'); return c && c.papel === 'terceiros' ? c.texto : null }

/** A chave de cada linha da principal: a célula da coluna Id (se há), senão o texto da 1ª célula `terceiros`. */
export function marcaDaPrincipal(t: Tabela): string {
  const col = t.colunas.indexOf('Id')
  const chaves = t.linhas.map((l) => { const c = col >= 0 ? l[col] : undefined; return c && c.papel !== 'numero' ? c.texto.trim() : (nomeDaLinha(l) ?? '') })
  return createHash('sha256').update(chaves.join('\n')).digest('hex').slice(0, 8)
}

/** Reserva fixa, por tabela de texto que sai da janela, para o aviso dela e a linha "Por tamanho" (medido: ~250 caracteres por tabela). */
export const RESERVA_POR_TABELA_DE_TEXTO = 450
/** Mudanças: a linha "descrições de N mudanças não couberam" (só quando as descrições saem). */
export const RESERVA_DAS_DESCRICOES = 300

/** O aviso de uma tabela de texto que saiu da janela, com um apontador que a IA consegue seguir. */
const avisoDeTextoFora = (tela: TelaId, titulo: string, quantas: number): string =>
  tela === 'canais' ? avisoDeLinhas(tela, titulo, quantas) : `tabela "${titulo}": ${quantas} linhas não couberam; peça a ação canal com o Id do canal para ver as de um item`

/**
 * A janela `inicio … inicio + k − 1` da principal, com as linhas de apoio dessas linhas. `k` exato por busca binária: `cabe(k)` = o texto do modo `ia` (principal em `k`
 * linhas, colunas dessas linhas, tabelas fixas, resumo, partes fixas) cabe em `teto`. Notas e dicas de Canais ficam sempre fora; as outras tabelas de texto (títulos, descrições, avisos) seguem as linhas da janela e entram no predicado.
 * Estágios (o 1º cujo `k` = 1 cabe): E2 tudo da janela dentro; E2t o texto fora; E2b também as colunas fora; E2c também o geral e o por-nome fora. Dentro de um estágio `cabe` é monótono em `k`.
 * `totais`: linhas de cada lista antes do limite da ação (só o `geral` é cortado nele). Chamar só com a principal presente e `1 <= inicio <= total`.
 */
export function janela(modelo: PacoteModelo, ctx: ContextoDoPacote, inicio: number, n: number, teto: number, totais?: ReadonlyMap<string, number>, opcoes: { reservaPorTexto?: number } = {}): JanelaDaLista {
  const tela = modelo.tela
  const classe = (t: Tabela): ClasseNaIa => classeDa(tela, t)
  const principal = modelo.tabelas.find((t) => classe(t) === 'principal')!
  const total = principal.linhas.length
  const real = (t: Tabela): number => totais?.get(t.id) ?? t.linhas.length
  const marca = marcaDaPrincipal(principal)
  const degraus = degrausDoLimite(n)

  // quem é a dona de cada linha de apoio: posição (0-based) na principal, ou -1 (sem dona; nome repetido também)
  const posDaChave = new Map<string, number>()
  const posDoNome = new Map<string, number[]>()
  principal.linhas.forEach((l, i) => {
    const k = chaveDeOrigem(l)
    if (k !== null && !posDaChave.has(k)) posDaChave.set(k, i)
    const nome = nomeDaLinha(l)
    if (nome !== null) posDoNome.set(nome, [...(posDoNome.get(nome) ?? []), i])
  })
  const donos = new Map<string, number[]>()
  for (const t of modelo.tabelas) {
    const c = classe(t)
    if (t.tipo !== 'lista' || c === 'principal' || c === 'geral') continue
    donos.set(t.id, t.linhas.map((l) => {
      if (c === 'por_nome') { const nome = nomeDaLinha(l); const ps = nome === null ? undefined : posDoNome.get(nome); return ps && ps.length === 1 ? ps[0]! : -1 }
      const k = chaveDeOrigem(l)
      return k === null ? -1 : (posDaChave.get(k) ?? -1)
    }))
  }
  const soltos = modelo.citados.filter((b) => !b.linha)
  // quanto ocupa uma tabela retirada: o pacote só com ela, menos o pacote sem tabelas (com o mesmo estado do dado privado, que o `segmentar` confere)
  const tamanhoSo = (ts: readonly Tabela[], cit: readonly BlocoCitado[]): number => {
    const priv = ts.some((t) => t.privada)
    const m: PacoteModelo = priv
      ? { ...modelo, tabelas: [...ts], citados: [...cit] }
      : { ...modelo, tabelas: [...ts], citados: cit.filter((b) => !b.privado), privado: { estado: 'na' }, comentarios: { estado: 'na' }, foco: modelo.foco.filter((f) => !f.privado), definicoes: modelo.definicoes.filter((d) => !d.privado) }
    if (!priv) delete m.avisosPrivados
    return tamanhoDe(segmentar(m, ctx))
  }
  const basesVazias = new Map<boolean, number>()
  const baseVazia = (priv: boolean): number => {
    let v = basesVazias.get(priv)
    if (v === undefined) { v = tamanhoSo(priv ? [{ id: '_', titulo: '_', colunas: [], linhas: [], tipo: 'lista', nomeNoCorte: '_', privada: true }] : [], soltos); basesVazias.set(priv, v) }
    return v
  }
  const pesoDaRetirada = (t: Tabela, linhas: Celula[][], cit: readonly BlocoCitado[]): number => Math.max(0, tamanhoSo([{ ...t, linhas }], [...soltos, ...cit]) - baseVazia(t.privada))

  type Estagio = 'E2' | 'E2t' | 'E2b' | 'E2c'
  interface Montagem { modelo: PacoteModelo; antes: Array<{ rotulo: string; caracteres: number }>; avisos: string[]; apoio: Corte['apoio']; semDona: number; textoFora: { tabelas: number; linhas: number } }
  const montar = (k: number, estagio: Estagio, comTexto: boolean): Montagem => {
    const s = inicio - 1, e = s + k
    const dentro = (pos: number): boolean => (pos >= s && pos < e) || (pos < 0 && inicio === 1)
    const avisos: string[] = [...modelo.avisos]
    const antes: Montagem['antes'] = []
    const apoio: Corte['apoio'] = []
    const mantidas = new Map<string, Map<number, number>>() // posição 0-based original -> posição 1-based na tabela da janela
    let semDona = 0
    let textoLinhas = 0
    let textoTabelas = 0
    const tabelas: Tabela[] = []
    const tiraDoTexto = (t: Tabela, linhas: Celula[][], idx: number[]): void => {
      const conjunto = new Set(idx)
      antes.push({ rotulo: `a tabela "${t.titulo}"`, caracteres: pesoDaRetirada(t, linhas, modelo.citados.filter((b) => b.linha?.tabela === t.id && conjunto.has(b.linha.posicao - 1))) })
    }
    for (const t of modelo.tabelas) {
      if (t.tipo !== 'lista') { tabelas.push(t); continue }
      const c = classe(t)
      if (c === 'principal') { tabelas.push({ ...t, linhas: t.linhas.slice(s, e) }); continue }
      if (c === 'geral') {
        if (inicio !== 1) continue
        if (estagio === 'E2c') { antes.push({ rotulo: `a tabela "${t.titulo}"`, caracteres: pesoDaRetirada(t, t.linhas, []) }); avisos.push(avisoDeLinhas(tela, t.titulo, real(t))); apoio.push({ titulo: t.titulo, saiu: 0, de: real(t) }); continue }
        tabelas.push(t)
        if (real(t) > t.linhas.length) avisos.push(`tabela "${t.titulo}": há ${real(t)} linhas; saíram ${t.linhas.length}, na ordem da tela`)
        apoio.push({ titulo: t.titulo, saiu: t.linhas.length, de: real(t) })
        continue
      }
      const ds = donos.get(t.id) ?? []
      const idx = ds.flatMap((p, i) => (dentro(p) ? [i] : []))
      semDona += inicio === 1 && c !== 'texto' ? ds.filter((p) => p < 0).length : 0
      const linhas = idx.map((i) => t.linhas[i]!)
      if (c === 'texto') {
        const sempre = TEXTO_SEMPRE_FORA.has(t.id)
        if (sempre || estagio !== 'E2') {
          if (linhas.length > 0) {
            if (sempre) { textoTabelas += 1; textoLinhas += linhas.length } else apoio.push({ titulo: t.titulo, saiu: 0, de: linhas.length })
            if (comTexto) { avisos.push(avisoDeTextoFora(tela, t.titulo, linhas.length)); tiraDoTexto(t, linhas, idx) }
          }
          continue
        }
      }
      const fora = estagio === 'E2c' || (estagio === 'E2b' && c === 'coluna')
      if (linhas.length === 0) continue
      if (fora) {
        antes.push({ rotulo: `a tabela "${t.titulo}"`, caracteres: pesoDaRetirada(t, linhas, []) })
        avisos.push(c === 'coluna' ? avisoDeColunas(tela, t.titulo, linhas.length) : avisoDeLinhas(tela, t.titulo, linhas.length))
        apoio.push({ titulo: t.titulo, saiu: 0, de: linhas.length })
        continue
      }
      mantidas.set(t.id, new Map(idx.map((o, novo) => [o, novo + 1])))
      tabelas.push({ ...t, linhas })
      apoio.push({ titulo: t.titulo, saiu: linhas.length, de: linhas.length })
    }
    // as descrições penduradas na principal seguem as linhas da janela no E2 e saem no E2t em diante; os de outras tabelas seguem as linhas que ficaram
    let descricoes = 0
    // a posição do bloco é na tabela da janela (que tem só as linhas dela): refaz a conta para não apontar para linha que não existe
    const citados: BlocoCitado[] = modelo.citados.flatMap((b): BlocoCitado[] => {
      if (!b.linha) return [b]
      if (b.linha.tabela === principal.id) {
        const naJanela = b.linha.posicao - 1 >= s && b.linha.posicao - 1 < e
        if (naJanela && estagio === 'E2') return [{ ...b, linha: { tabela: b.linha.tabela, posicao: b.linha.posicao - s } }]
        if (naJanela) descricoes += 1
        return []
      }
      const m = mantidas.get(b.linha.tabela)
      const novo = m?.get(b.linha.posicao - 1)
      if (novo !== undefined) return [{ ...b, linha: { tabela: b.linha.tabela, posicao: novo } }]
      return m || modelo.tabelas.some((t) => t.id === b.linha!.tabela && t.tipo === 'lista') ? [] : [b]
    })
    if (descricoes > 0 && ehTelaComLista(tela)) {
      apoio.push({ titulo: 'Descrições das linhas', saiu: 0, de: descricoes })
      if (comTexto) avisos.push(`descrições de ${descricoes} ${SUBSTANTIVO[tela]} não couberam; peça a ação canal com o Id do canal para ver as de um item`)
    }
    return { modelo: { ...modelo, tabelas, citados, avisos }, antes, avisos, apoio, semDona, textoFora: { tabelas: textoTabelas, linhas: textoLinhas } }
  }
  const rodar = (k: number, estagio: Estagio, comTexto: boolean, tetoDaBusca: number) => {
    const m = montar(k, estagio, comTexto)
    const fixos = new Set(m.modelo.tabelas.filter((t) => t.tipo === 'lista').map((t) => t.id))
    const p = fixarLinhas(segmentar(m.modelo, ctx), fixos)
    const t = montarTexto(p, '', comTexto ? teto : tetoDaBusca, 'todos', degraus, { ia: true, cortadoAntes: m.antes })
    return { m, p, t }
  }

  // O que os avisos das tabelas de texto que saem deixam no texto (o aviso de cada uma e a linha "Por tamanho") é uma reserva FIXA, não o que elas ocupam de fato:
  // assim `k` é o mesmo com e sem notas e dicas. Se a reserva não bastar (o texto real passa do teto), uma 2ª busca binária desce `k` até caber.
  const reserva = opcoes.reservaPorTexto ?? RESERVA_POR_TABELA_DE_TEXTO
  const tabelasDeTexto = Object.keys(CLASSES_NA_IA[tela as TelaComLista] ?? {}).filter((id) => CLASSES_NA_IA[tela as TelaComLista][id] === 'texto')
  const alvoMax = Math.max(1, Math.min(n, total - inicio + 1))
  const buscar = (cabe: (k: number) => boolean, teto: number): number => {
    let lo = 0, hi = teto
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (cabe(mid)) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  for (const estagio of ['E2', 'E2t', 'E2b', 'E2c'] as const) {
    const ultimo = estagio === 'E2c'
    const nTextos = estagio === 'E2' ? tabelasDeTexto.filter((id) => TEXTO_SEMPRE_FORA.has(id)).length : tabelasDeTexto.length
    const tetoDaBusca = teto - nTextos * reserva - (tela === 'mudancas' && estagio !== 'E2' ? RESERVA_DAS_DESCRICOES : 0)
    const cabe = (k: number): boolean => !rodar(k, estagio, false, tetoDaBusca).t.pisoPassou
    const lo = buscar(cabe, alvoMax)
    if (lo === 0 && !ultimo) continue
    // o texto de verdade (com os avisos das tabelas de texto); a reserva quase sempre basta
    const completos = new Map<number, ReturnType<typeof rodar>>()
    const completo = (k: number): ReturnType<typeof rodar> => { let r = completos.get(k); if (!r) { r = rodar(k, estagio, true, tetoDaBusca); completos.set(k, r) } return r }
    const cheio = (k: number): boolean => !completo(k).t.pisoPassou
    let k = Math.max(1, lo)
    if (!cheio(k)) {
      k = k > 1 ? buscar(cheio, k) : 0
      if (k === 0) { if (!ultimo) continue; k = 1 }
    }
    const r = completo(k)
    return {
      corte: {
        texto: r.t, estagio, avisos: r.m.avisos.slice(modelo.avisos.length), linhasDaPrincipal: k, totalDaPrincipal: total, principalCortada: false,
        primeiraLinhaDeAviso: r.p.primeiraLinhaDeAviso, apoio: r.m.apoio,
      },
      inicio, k, total, marca, semDona: r.m.semDona, textoFora: r.m.textoFora, linhaNaoCabe: r.t.pisoPassou,
    }
  }
  throw new Error('corte-da-ia: janela sem estágio')
}
