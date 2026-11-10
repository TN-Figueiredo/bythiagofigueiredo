// A5 F1b T7: o modo tabela das listas (`saida: 'tabela'` em listar_canais, destaques e mudancas). Puro: sem banco, sem relógio, sem Sentry (quem avisa é o `responder`,
// com os códigos que daqui saem em `avisos`). Monta a janela da lista principal (a mesma da A7b) e escreve um bloco CSV por tabela, lendo o MESMO objeto
// `PacoteModelo` que passou por `segmentar` (que lança com dado privado sem direito). Nunca lê o texto dos segmentos; nunca inclui comentário.
import * as F from '@/lib/youtube/observatorio/contexto-ia/frases'
import { segmentar, textoDoPrivadoExcluido, type PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { blocoDaTabela, csvDaTabela, novaLegenda, type ColunaExtra, type CsvDaTabela, type EstadoVazio, type Legenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import { naCelula } from '@/lib/youtube/observatorio/contexto-ia/terceiros'
import type { Cobertura } from '@/lib/youtube/observatorio/acesso-ia/cobertura'
import type { ContextoDoPacote, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { classeDa, donosDasLinhas, marcaDaPrincipal, TEXTO_SEMPRE_FORA, type ClasseNaIa } from './corte-da-ia'

export interface AvisoDaTabela { passo: string; extra?: Record<string, number | string> }

export interface RespostaEmTabela {
  /** Do cabeçalho (parte 1) ao último bloco CSV fechado. Sem o topo do pedido e sem a Cobertura (quem chama põe). */
  texto: string
  primeira: string | null
  /** `k`: linhas da principal entregues nesta janela. */
  linhasDaPrincipal: number
  totalDaPrincipal: number
  semX: number
  apoio: Cobertura['apoio']
  semDona: number
  /** Notas e dicas de Canais: fora de toda janela. */
  textoFora: { tabelas: number; linhas: number }
  /** `nomeNoCorte` das tabelas que só existem no modo texto (sem `chaves`, ou de texto). */
  soNoTexto: string[]
  marca: string
  linhaNaoCabe: boolean
  /** Cortes por tamanho (rótulos) para a Cobertura; vazio quando tudo coube. */
  rotulos: string[]
  numeros: PacoteSerializado['numeros']
  incluiuPrivado: boolean
  avisos: AvisoDaTabela[]
}

type EmpacotadoNaJanela = { m: PacoteModelo; meta: Map<string, Meta>; pacote: PacoteSerializado }
interface Meta { classe: ClasseNaIa; origem: number[]; de: number }
const baseDe = (id: string): string => id.replace(/^privado-/, '')
const CHAVE_DO_DONO: Partial<Record<string, ColunaExtra['chave']>> = { canais: 'canal_id', outliers: 'video_id', mudancas: 'video_id' }
const TITULO_DO_DONO: Record<string, string> = { canal_id: 'Id do canal da linha (use na ação canal)', video_id: 'Id do vídeo da linha' }

/** Registra os pares (estado, frase) que cada chamada pede; o id é o da legenda de verdade. */
function legendaGravando(): { legenda: Legenda; pares: Array<{ estado: EstadoVazio; frase: string }> } {
  const inner = novaLegenda()
  const pares: Array<{ estado: EstadoVazio; frase: string }> = []
  return { legenda: { idDe: (estado, frase) => { pares.push({ estado, frase }); return inner.idDe(estado, frase) }, linhas: () => inner.linhas() }, pares }
}

export function respostaEmTabela(
  modelo: PacoteModelo,
  ctx: ContextoDoPacote,
  janela: { inicio: number; n: number },
  teto: number,
  totais?: ReadonlyMap<string, number>,
): RespostaEmTabela {
  const tela = modelo.tela
  const principal = modelo.tabelas.find((t) => classeDa(tela, t) === 'principal')
  if (!principal) throw new Error('resposta-tabela: modelo sem lista principal')
  const total = principal.linhas.length
  const { inicio } = janela
  const s = inicio - 1
  const donos = donosDasLinhas(modelo)
  const idCol = principal.colunas.indexOf('Id')
  const chaveDono = CHAVE_DO_DONO[tela]
  const real = (t: Tabela): number => totais?.get(t.id) ?? t.linhas.length

  /** O Id da dona de cada linha de apoio (o que a coluna `canal_id`/`video_id` leva); `null` = sem dona. */
  const idDaDona = (pos: number): string | null => {
    if (pos < 0 || idCol < 0) return null
    const c = principal.linhas[pos]?.[idCol]
    return c && c.papel !== 'numero' ? c.texto.trim() : null
  }

  /** O modelo da janela com `k` linhas da principal; tabelas que não entram no CSV não estão nele. */
  const janelaComK = (k: number): EmpacotadoNaJanela => {
    const e = s + k
    const dentro = (pos: number): boolean => (pos >= s && pos < e) || (pos < 0 && inicio === 1)
    const meta = new Map<string, Meta>()
    const tabelas: Tabela[] = []
    for (const t of modelo.tabelas) {
      if (t.tipo === 'dia_a_dia') continue
      if (t.tipo === 'fixa') { tabelas.push(t); meta.set(t.id, { classe: 'resumo-da-tela', origem: [], de: t.linhas.length }); continue }
      const classe = classeDa(tela, t)
      const classeBase = classeDa(tela, { id: baseDe(t.id), tipo: t.tipo })
      if (classeBase === 'texto') continue // texto não entra no modo tabela (D7); a Cobertura diz
      if (classe === 'principal') { tabelas.push({ ...t, linhas: t.linhas.slice(s, e) }); meta.set(t.id, { classe, origem: [], de: total }); continue }
      if (classe === 'geral') {
        if (inicio !== 1) continue
        tabelas.push(t)
        meta.set(t.id, { classe, origem: [], de: real(t) })
        continue
      }
      const ds = donos.get(t.id) ?? []
      const origem = ds.flatMap((p, i) => (dentro(p) ? [i] : []))
      if (origem.length === 0) continue
      tabelas.push({ ...t, linhas: origem.map((i) => t.linhas[i]!) })
      meta.set(t.id, { classe, origem, de: origem.length })
    }
    const comPrivada = tabelas.some((t) => t.privada)
    const privadoFora = modelo.privado.estado === 'incluido' && !comPrivada
    // janela sem tabela privada (janela 2 em diante): o dado privado não está nela, então o modelo dela não o declara (como o `tamanhoSo` do corte)
    const m: PacoteModelo = privadoFora
      ? { ...modelo, tabelas, citados: [], privado: { estado: 'na' }, comentarios: { estado: 'na' }, foco: modelo.foco.filter((f) => !f.privado), definicoes: modelo.definicoes.filter((d) => !d.privado) }
      : { ...modelo, tabelas, citados: [], comentarios: { estado: 'na' } }
    delete m.resumoDoTodo
    if (privadoFora) delete m.avisosPrivados
    // `segmentar` valida e lança com privado sem direito: o mesmo objeto `m` é o que o CSV lê
    return { m, meta, pacote: segmentar(m, ctx) }
  }

  const extrasDe = (t: Tabela, meta: Meta): ColunaExtra[] => {
    if ((meta.classe !== 'coluna' && meta.classe !== 'por_nome') || chaveDono === undefined) return []
    const ds = donos.get(t.id) ?? []
    return [{ chave: chaveDono, titulo: TITULO_DO_DONO[chaveDono]!, valor: (linha) => idDaDona(ds[meta.origem[linha]!] ?? -1) }]
  }

  interface Montado {
    texto: string
    semX: number
    soNoTexto: string[]
    avisos: AvisoDaTabela[]
    pares: Array<{ estado: EstadoVazio; frase: string }>
    j: EmpacotadoNaJanela
    tabelasComCsv: Array<{ t: Tabela; meta: Meta; csv: CsvDaTabela }>
  }
  const montar = (k: number): Montado => {
    const j = janelaComK(k)
    const { legenda, pares } = legendaGravando()
    const avisos: AvisoDaTabela[] = []
    const soNoTexto: string[] = []
    const blocos: string[] = []
    const tabelasComCsv: Montado['tabelasComCsv'] = []
    let semX = 0
    let primeiroSemX: string | null = null
    for (const t of j.m.tabelas) {
      const meta = j.meta.get(t.id)!
      const csv = csvDaTabela(t, legenda, extrasDe(t, meta))
      if (csv === null) { soNoTexto.push(t.nomeNoCorte); avisos.push({ passo: 'tabela_sem_chaves', extra: { tabela: t.id } }); continue }
      for (const a of csv.avisos) avisos.push({ passo: a, extra: { tabela: t.id } })
      if (csv.semX > 0 && primeiroSemX === null) primeiroSemX = t.id
      semX += csv.semX
      tabelasComCsv.push({ t, meta, csv })
      blocos.push(blocoDaTabela(csv, csv.linhas))
    }
    if (semX > 0) avisos.push({ passo: 'csv_sem_x', extra: { tabela: primeiroSemX!, n: semX } })
    const m = j.m
    const topo = j.pacote.segmentos.filter((x) => x.parte === 1).map((x) => x.texto)
    const avisosDoModelo = [...m.avisos.map((a) => `- ${naCelula(a)}`), ...(m.privado.estado === 'incluido' ? (m.avisosPrivados ?? []).map((a) => `- ${naCelula(a)}${F.MARCA_PRIVADO}`) : [])]
    const partes = [
      ...topo,
      F.COMO_LER_TABELA,
      ...(m.privado.estado === 'excluido' ? [textoDoPrivadoExcluido(m.privado)] : []),
      ...(avisosDoModelo.length > 0 ? [['## Avisos', ...avisosDoModelo].join('\n')] : []),
      ...(legenda.linhas().length > 0 ? [legenda.linhas().join('\n')] : []),
      ...blocos,
    ]
    return { texto: partes.join('\n\n'), semX, soNoTexto, avisos, pares, j, tabelasComCsv }
  }

  /* ---- quanto custa cada linha da principal: a linha CSV, o apoio dela e a legenda que ela inaugura (soma de prefixo; sem montar texto) */
  const k0 = montar(0)
  const vistos = new Set(k0.pares.map((p) => `${p.estado}\u0000${p.frase}`))
  const maxK = Math.min(janela.n, total - s)
  const custos: number[] = []
  for (let i = 0; i < maxK; i += 1) {
    const pos = s + i
    const { legenda, pares } = legendaGravando()
    let c = 0
    const linhaCsv = (t: Tabela, linhaDaTabela: number, meta: Meta): void => {
      const so: Tabela = { ...t, linhas: [t.linhas[linhaDaTabela]!] }
      const csv = csvDaTabela(so, legenda, extrasDe(so, { ...meta, origem: [linhaDaTabela] }))
      if (csv) c += (csv.linhas[0]?.length ?? 0) + 1
    }
    linhaCsv(principal, pos, { classe: 'principal', origem: [], de: total })
    for (const t of modelo.tabelas) {
      if (t.tipo !== 'lista') continue
      const classe = classeDa(tela, t)
      if (classe !== 'coluna' && classe !== 'por_nome') continue
      if (classeDa(tela, { id: baseDe(t.id), tipo: t.tipo }) === 'texto') continue
      ;(donos.get(t.id) ?? []).forEach((p, linha) => { if (p === pos) linhaCsv(t, linha, { classe, origem: [], de: 0 }) })
    }
    for (const p of pares) {
      const chave = `${p.estado}\u0000${p.frase}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      c += F.legendaLinha('m99', p.estado, p.frase).length + 1
    }
    custos.push(c)
  }
  let k = 0
  let usado = k0.texto.length
  while (k < maxK && usado + custos[k]! <= teto) { usado += custos[k]!; k += 1 }

  /* ---- a guarda final: a estimativa pode errar para cima (legenda, apoio); desce até caber */
  const avisosDoCorte: AvisoDaTabela[] = []
  let montado = montar(Math.max(k, 0))
  while (montado.texto.length > teto && k > 1) {
    avisosDoCorte.push({ passo: 'tabela_estourou' })
    k -= 1
    montado = montar(k)
  }
  let linhaNaoCabe = false
  if (k === 0 && maxK > 0) {
    // nem uma linha cabe: entrega a primeira (quem chama corta o fim do texto), senão a janela seguinte nunca andaria
    k = 1
    montado = montar(1)
    linhaNaoCabe = true
    avisosDoCorte.push({ passo: 'tabela_nao_cabe' })
  } else if (montado.texto.length > teto) {
    linhaNaoCabe = true
    avisosDoCorte.push({ passo: 'tabela_nao_cabe' })
  }

  /* ---- o que a Cobertura precisa saber da janela */
  const j = montado.j
  const apoioLinhas: Array<{ titulo: string; saiu: number; de: number }> = []
  const soNoTexto = [...montado.soNoTexto]
  let textoTabelas = 0
  let textoLinhas = 0
  const e = s + k
  const dentro = (pos: number): boolean => (pos >= s && pos < e) || (pos < 0 && inicio === 1)
  for (const t of modelo.tabelas) {
    if (t.tipo !== 'lista') continue
    const classe = classeDa(tela, t)
    if (classe === 'principal') continue
    const classeBase = classeDa(tela, { id: baseDe(t.id), tipo: t.tipo })
    if (classeBase === 'texto') {
      const ds = donos.get(t.id) ?? []
      const linhas = ds.filter(dentro).length
      if (linhas === 0) continue
      if (TEXTO_SEMPRE_FORA.has(baseDe(t.id))) { textoTabelas += 1; textoLinhas += linhas } else { apoioLinhas.push({ titulo: t.titulo, saiu: 0, de: linhas }); soNoTexto.push(t.nomeNoCorte) }
      continue
    }
  }
  for (const { t, meta, csv } of montado.tabelasComCsv) {
    if (meta.classe === 'principal' || meta.classe === 'resumo-da-tela') continue
    apoioLinhas.push({ titulo: csv.titulo, saiu: t.linhas.length, de: meta.classe === 'geral' ? meta.de : t.linhas.length })
  }
  for (const nome of montado.soNoTexto) {
    const t = j.m.tabelas.find((x) => x.nomeNoCorte === nome)
    if (t && (j.meta.get(t.id)?.classe === 'coluna' || j.meta.get(t.id)?.classe === 'por_nome' || j.meta.get(t.id)?.classe === 'geral')) apoioLinhas.push({ titulo: t.titulo, saiu: 0, de: t.linhas.length })
  }
  const cortadas = apoioLinhas.filter((x) => x.saiu < x.de)
  const semDona = inicio === 1
    ? [...donos.entries()].reduce((a, [id, ds]) => a + (classeDa(tela, { id: baseDe(id), tipo: 'lista' }) === 'texto' ? 0 : ds.filter((p) => p < 0).length), 0)
    : 0
  const rotulos: string[] = []
  if (montado.texto.length > teto) rotulos.push('o fim do texto')

  return {
    texto: montado.texto,
    primeira: j.pacote.primeiraLinhaDeAviso,
    linhasDaPrincipal: k,
    totalDaPrincipal: total,
    semX: montado.semX,
    apoio: { inteiras: apoioLinhas.length - cortadas.length, total: apoioLinhas.length, cortadas },
    semDona,
    textoFora: { tabelas: textoTabelas, linhas: textoLinhas },
    soNoTexto: [...new Set(soNoTexto)],
    marca: marcaDaPrincipal(principal),
    linhaNaoCabe,
    rotulos,
    numeros: j.pacote.numeros,
    incluiuPrivado: j.m.privado.estado === 'incluido',
    avisos: [...montado.avisos, ...avisosDoCorte],
  }
}
