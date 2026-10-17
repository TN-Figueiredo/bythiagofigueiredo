/**
 * A5 · E17 degrau 1, Tarefa 16: o empacotador de "Saíram do YouTube" (a fila). Puro: nada de banco, de relógio nem de conta; cada número e cada
 * frase é copiado do campo do modelo, e cada célula leva a `origem` para a prova de paridade.
 *
 * O MODELO daqui é o `FilaViewOk` da tela, sem mudança (o estado `sem_acesso` e o `erro` nunca chegam aqui: a página os mostra, o pacote não).
 *
 * O que NÃO entra, e o teste prova: o texto de comentário (a fila só guarda contagem e código; o item sai como "comentário (texto não incluído)"),
 * e qualquer título ou nome de um item que o dono mandou APAGAR (classe (iii): fica só o código e a data). Item mantido leva o título que a tela mostra.
 * Os botões, os rótulos de ação e o painel de confirmação de apagar são controle de tela e ficam de fora; do painel entram só "o que está guardado"
 * (a contagem do que sumiria) e o que o apagar não alcança.
 */
import type { CartaoView, FilaViewOk } from '../_saiu/view-model'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

export type ModeloFila = FilaViewOk

/** Tudo o que o modelo da tela tem. */
export const modeloDeFila = (view: FilaViewOk): ModeloFila => view

// ───────────────────────── o inventário de folhas (item 160)
const CTRL = { descartado: 'controle de tela' } as const
const ID = { descartado: 'identificador' } as const
const REP = { descartado: 'repetido' } as const

export const INVENTARIO_FILA: Inventario = {
  estado: CTRL, podeResponder: CTRL, semPermissao: CTRL, contador: REP,
  'resumo.vazia': CTRL, 'resumo.negrito': 'base', 'resumo.texto': 'base',
  'resumo.barra[].tipo': ID, 'resumo.barra[].n': 'numero', 'resumo.barra[].texto': 'rotulo',

  'cartoes[].chave': ID, 'cartoes[].tipo': ID, 'cartoes[].rotuloDoTipo': 'rotulo', 'cartoes[].quando': 'base',
  'cartoes[].titulo': 'terceiros', 'cartoes[].linha2': 'terceiros',
  'cartoes[].fatos[].rotulo': 'rotulo', 'cartoes[].fatos[].nota': 'base', 'cartoes[].fatos[].valor': 'terceiros', 'cartoes[].fatos[].largo': CTRL,
  'cartoes[].guardado': REP, 'cartoes[].erroDaPrevia': 'base', 'cartoes[].apagarRotulo': CTRL,
  'cartoes[].manter.tipo': ID, 'cartoes[].manter.ids[]': ID,
  'cartoes[].painel.titulo': CTRL, 'cartoes[].painel.aviso': CTRL, 'cartoes[].painel.efeito': CTRL, 'cartoes[].painel.fica[]': CTRL, 'cartoes[].painel.recusa': CTRL, 'cartoes[].painel.palavra': CTRL,
  'cartoes[].painel.some[].n': 'numero', 'cartoes[].painel.some[].texto': 'base', 'cartoes[].painel.naoSai[]': 'base',
  'cartoes[].painel.alvo.tipo': ID, 'cartoes[].painel.alvo.id': ID, 'cartoes[].painel': CTRL, 'cartoes[].painel.alvo.ids': ID, 'cartoes[].painel.alvo.ids[]': ID,

  maisN: CTRL, 'maisN.n': 'numero', 'maisN.mostrar': CTRL,
  manterTodos: CTRL, 'manterTodos.rotulo': CTRL, 'manterTodos.grupos[].tipo': CTRL, 'manterTodos.grupos[].ids[]': CTRL,

  'voltaram[].chave': ID, 'voltaram[].tipo': ID, 'voltaram[].rotuloDoTipo': 'rotulo', 'voltaram[].quando': 'base', 'voltaram[].titulo': 'terceiros', 'voltaram[].codigo': 'terceiros',
  'voltaram[].texto': 'base', 'voltaram[].acoes[].rotulo': CTRL, 'voltaram[].acoes[].acao': CTRL, 'voltaram[].acoes[].itemIds[]': ID, 'voltaram[].dica': CTRL,

  'apagando[].chave': ID, 'apagando[].itemId': ID, 'apagando[].tipo': ID, 'apagando[].codigo': 'terceiros', 'apagando[].desde': 'base', 'apagando[].falta': 'base',
  'apagando[].voltou': 'base', 'apagando[].podeTentar': CTRL,

  'respondidos.itens[].chave': ID, 'respondidos.itens[].tipo': ID, 'respondidos.itens[].rotuloDoTipo': 'rotulo', 'respondidos.itens[].codigo': 'terceiros',
  'respondidos.itens[].titulo': 'terceiros', 'respondidos.itens[].situacao': 'rotulo', 'respondidos.itens[].quando': 'base', 'respondidos.itens[].texto': 'base',
  'respondidos.total': 'numero', 'respondidos.eMais': 'base',

  'ajuda[]': 'base',
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (cada uma tem teste sintético próprio quando importa). */
export const SEM_FOLHA_NA_MATRIZ_FILA: readonly string[] = []

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo view model. */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_FILA = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
const NAO_MEDE_MOTIVO = 'por que um item saiu do YouTube: o YouTube devolve a mesma ausência para o que foi apagado pelo autor, ficou privado, foi denunciado ou removido por ordem judicial'
const NAO_MEDE_COMENTARIOS = 'o texto dos comentários: cada grupo de comentários entra só como contagem e vídeos, "comentário (texto não incluído)"'
const NAO_MEDE_APAGADOS = 'o que o dono já mandou apagar: de um item apagado ficam só o código do YouTube e as datas, sem título, número nem imagem'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })

/** O texto que o modelo escreveu para um número. */
function celulaDoNumero(texto: string | number, origem: string): Celula {
  const t = String(texto)
  if (t === '0') return { papel: 'numero', estado: 'zero_medido', texto: t, x: 0, origem }
  return { papel: 'numero', estado: 'medido', texto: t, x: null, origem }
}

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

// ───────────────────────── tabelas
function tabelaDePorTipo(m: ModeloFila): Tabela[] {
  const saida: Tabela[] = []
  const linhas: Celula[][] = m.resumo.barra.map((b, i) => [rotulo(b.texto, `modelo.resumo.barra[${i}].texto`), celulaDoNumero(b.n, `modelo.resumo.barra[${i}].n`)])
  if (linhas.length) saida.push(tabelaFixa('fila-por-tipo', 'Itens esperando resposta, por tipo', 'tabela de itens por tipo', ['Tipo', 'Itens'], linhas))
  // a tela mostra em páginas: o que ficou de fora é um número do modelo, com o cabeçalho dizendo o que ele conta
  if (m.maisN) saida.push(tabelaFixa('fila-fora-da-pagina', 'Itens esperando que esta página não mostra', 'tabela do que ficou fora da página', ['Ainda na fila, fora desta página'], [[celulaDoNumero(m.maisN.n, 'modelo.maisN.n')]]))
  return saida
}

const cartoes = (m: ModeloFila): Array<{ i: number; c: CartaoView }> => m.cartoes.map((c, i) => ({ i, c }))

function tabelasDosItens(m: ModeloFila): Tabela[] {
  if (m.cartoes.length === 0) return []
  const saida: Tabela[] = [tabelaLista('esperando', 'Itens esperando resposta, na ordem da tela', 'tabela de itens esperando',
    ['Tipo', 'Item', 'Desde quando', 'Detalhe'],
    cartoes(m).map(({ i, c }) => {
      const p = `modelo.cartoes[${i}]`
      return [rotulo(c.rotuloDoTipo, `${p}.rotuloDoTipo`), terceiros(c.titulo, `${p}.titulo`), base(c.quando, `${p}.quando`), terceiros(c.linha2, `${p}.linha2`)]
    }))]
  const fatos = cartoes(m).flatMap(({ i, c }) => c.fatos.map((f, k): Celula[] => {
    const p = `modelo.cartoes[${i}]`
    return [terceiros(c.titulo, `${p}.titulo`), rotulo(f.rotulo, `${p}.fatos[${k}].rotulo`), terceiros(f.valor, `${p}.fatos[${k}].valor`)]
  }))
  if (fatos.length) saida.push(tabelaLista('esperando-dados', 'O que o site guarda de cada item esperando', 'tabela de dados dos itens', ['Item', 'Dado', 'Valor'], fatos))
  const guardado = cartoes(m).flatMap(({ i, c }) => (c.painel?.some ?? []).map((s, k): Celula[] => {
    const p = `modelo.cartoes[${i}]`
    return [terceiros(c.titulo, `${p}.titulo`), base(s.texto, `${p}.painel.some[${k}].texto`), celulaDoNumero(s.n, `${p}.painel.some[${k}].n`)]
  }))
  if (guardado.length) saida.push(tabelaLista('esperando-guardado', 'O que está guardado de cada item esperando', 'tabela do que está guardado', ['Item', 'Guardado', 'Quantidade'], guardado))
  const notas = cartoes(m).flatMap(({ i, c }): Celula[][] => {
    const p = `modelo.cartoes[${i}]`
    return [
      ...(c.erroDaPrevia === null ? [] : [[terceiros(c.titulo, `${p}.titulo`), base(c.erroDaPrevia, `${p}.erroDaPrevia`)]]),
      ...c.fatos.flatMap((f, k): Celula[][] => (f.nota ? [[terceiros(c.titulo, `${p}.titulo`), base(f.nota, `${p}.fatos[${k}].nota`)]] : [])),
      ...(c.painel?.naoSai ?? []).map((n, k): Celula[] => [terceiros(c.titulo, `${p}.titulo`), base(n, `${p}.painel.naoSai[${k}]`)]),
    ]
  })
  if (notas.length) saida.push(tabelaLista('esperando-notas', 'Avisos de cada item esperando', 'tabela de avisos dos itens', ['Item', 'Aviso'], notas))
  return saida
}

function tabelaDeVoltaram(m: ModeloFila): Tabela[] {
  if (m.voltaram.length === 0) return []
  return [tabelaLista('voltaram', 'Itens que voltaram ao ar', 'tabela de itens que voltaram', ['Tipo', 'Item', 'Quando', 'Situação'],
    m.voltaram.map((v, i) => {
      const p = `modelo.voltaram[${i}]`
      // quem pede resposta é item que o dono apagou: o título não sai (classe (iii)), só o código; sem código, o tipo
      const apagado = v.acoes.length > 0
      const item = !apagado && v.titulo !== null ? terceiros(v.titulo, `${p}.titulo`) : v.codigo !== null ? terceiros(v.codigo, `${p}.codigo`) : rotulo(v.rotuloDoTipo, `${p}.rotuloDoTipo`)
      return [rotulo(v.rotuloDoTipo, `${p}.rotuloDoTipo`), item, base(v.quando, `${p}.quando`), base(v.texto, `${p}.texto`)]
    }))]
}

function tabelaDeApagando(m: ModeloFila): Tabela[] {
  if (m.apagando.length === 0) return []
  const saida: Tabela[] = [tabelaLista('apagando', 'Itens que estão sendo apagados (só código e datas)', 'tabela de itens sendo apagados', ['Código no YouTube', 'Desde', 'O que falta'],
    m.apagando.map((a, i) => {
      const p = `modelo.apagando[${i}]`
      return [terceiros(a.codigo, `${p}.codigo`), base(a.desde, `${p}.desde`), base(a.falta, `${p}.falta`)]
    }))]
  // só os que a tela marca como "voltou ao ar"; ausência não é "não medido", é "não voltou"
  const voltou = m.apagando.flatMap((a, i): Celula[][] => (a.voltou === null ? [] : [[terceiros(a.codigo, `modelo.apagando[${i}].codigo`), base(a.voltou, `modelo.apagando[${i}].voltou`)]]))
  if (voltou.length) saida.push(tabelaLista('apagando-voltou', 'Itens sendo apagados que voltaram ao ar', 'tabela de itens apagando que voltaram', ['Código no YouTube', 'Voltou ao ar'], voltou))
  return saida
}

function tabelaDeRespondidos(m: ModeloFila): Tabela[] {
  const r = m.respondidos
  if (r.itens.length === 0) return []
  const saida: Tabela[] = [tabelaLista('respondidos', 'Itens já respondidos (do apagado, só código e data)', 'tabela de itens respondidos', ['Tipo', 'Item', 'Situação', 'Quando', 'Situação do dado'],
    r.itens.map((x, i) => {
      const p = `modelo.respondidos.itens[${i}]`
      // o título só sai do item MANTIDO; do apagado ficam o código e a data
      const item = x.situacao === 'mantido' && x.titulo !== null ? terceiros(x.titulo, `${p}.titulo`) : terceiros(x.codigo, `${p}.codigo`)
      return [rotulo(x.rotuloDoTipo, `${p}.rotuloDoTipo`), item, rotulo(x.situacao, `${p}.situacao`), base(x.quando, `${p}.quando`), base(x.texto, `${p}.texto`)]
    }))]
  saida.push(tabelaFixa('respondidos-total', 'Quantos itens já foram respondidos', 'tabela do total de respondidos', ['Total'],
    [[celulaDoNumero(r.total, 'modelo.respondidos.total')]]))
  return saida
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
function avisosDe(m: ModeloFila): string[] {
  return [m.resumo.negrito, m.resumo.texto, m.respondidos.eMais ?? ''].filter((x) => x !== '')
}

const definicoesDe = (m: ModeloFila): PacoteModelo['definicoes'] =>
  m.ajuda.map((frase, i) => ({ medida: i === 0 ? 'Como a fila funciona' : `Como a fila funciona (${i + 1})`, frase, limiares: [] }))

// ───────────────────────── o empacotador
export function empacotarFila(modelo: ModeloFila): PacoteModelo {
  const tabelas: Tabela[] = [
    ...tabelaDePorTipo(modelo), ...tabelasDosItens(modelo), ...tabelaDeVoltaram(modelo), ...tabelaDeApagando(modelo), ...tabelaDeRespondidos(modelo),
  ]
  const r = modelo.resumo
  return {
    tela: 'fila',
    janela: `Fila dos que saíram do YouTube, ${modelo.cartoes.length} nesta página`,
    foco: [],
    tabelas,
    citados: [],
    definicoes: definicoesDe(modelo),
    avisos: avisosDe(modelo),
    naoMede: [NAO_MEDE_MOTIVO, NAO_MEDE_COMENTARIOS, NAO_MEDE_APAGADOS],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: r.vazia ? `${r.negrito} ${r.texto}` : null,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}
