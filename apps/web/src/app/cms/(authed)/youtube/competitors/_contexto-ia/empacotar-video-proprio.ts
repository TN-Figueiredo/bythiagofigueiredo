/**
 * A5 · E17 degrau 1, Tarefa 7b: o empacotador do VÍDEO próprio. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do modelo,
 * com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloVideoProprio`) é o que a página monta: o cabeçalho (`buildProprioVideoBase`) e os blocos (`buildVideoBlocos`). Nenhuma
 * arrumação: os dois já são texto pronto.
 *
 * Dado privado (spec 8.1.3/4.4): vem do estado que o `montar…` entrega (`EstadoDoPrivado`) e do `acesso` dos blocos. Nesta página a leitura é uma só
 * (alcance + diário + retenção do vídeo, depois da prova de edição): ou os blocos privados existem, ou não existe nenhum. Por isso o pacote só leva
 * tabela privada quando o alcance E o diário foram lidos E os blocos vieram com `acesso: 'ok'`; qualquer outra combinação vira `excluido`, com o motivo
 * do estado, e só as frases de "não medido" que o modelo já escreveu. As linhas de impressões, views por dia e % assistido das réguas do canal são
 * privadas (a posição do vídeo entre os outros é dado do alcance e do diário); as linhas de views, curtidas, comentários, engajamento e duração
 * são públicas e vão sempre.
 *
 * Versões da capa e "antes × depois" (item 198) são dado privado e NÃO entram: o visualizador de thumbnail só abre num diálogo, e o modelo de
 * blocos não carrega troca de título nem de capa ("ainda não registradas"). O pacote não afirma causa.
 */
import type { ProprioVideoHeader } from '../_proprio/video-model'
import type { VideoBlocosView } from '../_proprio/video-blocos-model'
import type { LinhaRegua, ReguasView } from '../_proprio/reguas-model'
import type { RetencaoView } from '../_proprio/retencao-curva-model'
import type { ImpressoesView } from '../_proprio/impressoes-model'
import type { TaxaFaixaView } from '../_proprio/taxa-faixa-model'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, EstadoDoPrivado, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import {
  APAR, bas, CTRL, END, IDENT, IMG, inventarioDeColunasDeGrafico, leituraDe, NAO_MEDE_CAUSA, NAO_MEDE_OUTROS, naoVazio, numero, REP, rot,
  tabelaDeDiaADia, tabelaDeProsa, TITULO_PRIVADO,
} from './empacotar-canal-proprio'

// ───────────────────────── o modelo
export interface ModeloVideoProprio {
  header: ProprioVideoHeader
  blocos: VideoBlocosView
}

export const modeloDeVideoProprio = (header: ProprioVideoHeader, blocos: VideoBlocosView): ModeloVideoProprio => ({ header, blocos })

// ───────────────────────── o inventário de folhas (item 160)
function inventarioDaTaxa(p: string): Inventario {
  return {
    [`${p}.alt`]: REP, [`${p}.topo`]: APAR, [`${p}.eixo[].pos`]: APAR, [`${p}.eixo[].txt`]: APAR,
    [`${p}.linhas[].rotulo`]: 'rotulo', [`${p}.linhas[].nota`]: 'base', [`${p}.linhas[].classe`]: APAR, [`${p}.linhas[].inconclusiva`]: CTRL,
    [`${p}.linhas[].valor`]: 'numero', [`${p}.linhas[].loTxt`]: 'numero', [`${p}.linhas[].hiTxt`]: 'numero',
    [`${p}.linhas[].lo`]: APAR, [`${p}.linhas[].p`]: APAR, [`${p}.linhas[].hi`]: APAR,
  }
}

export const INVENTARIO_VIDEO_PROPRIO: Inventario = {
  // cabeçalho
  'header.id': IDENT, 'header.ytId': IDENT, 'header.titulo': 'terceiros', 'header.url': END, 'header.thumb': IMG, 'header.meta': 'base',
  'header.faixa[].key': IDENT, 'header.faixa[].value': 'numero', 'header.faixa[].missing': 'motivo', 'header.faixa[].label': 'rotulo', 'header.faixa[].sub': 'base', 'header.faixa[].conta': 'base',
  'header.canal.id': IDENT, 'header.canal.name': CTRL, 'header.canal.href': END, // o nome do canal mora na trilha da moldura, não nesta tela
  'header.viewer.*': IMG, // o visualizador abre num diálogo: versões e legendas das capas são dado privado e não entram (item 198)
  'header.semData': REP, // "sem data de publicação" já está na meta
  // os blocos
  'blocos.acesso': CTRL, 'blocos.nota': 'base',
  // objetos que são nulos quando a leitura privada não veio: a folha é o próprio nulo
  'blocos.views': CTRL, 'blocos.impressoes': CTRL, 'blocos.assistido': CTRL, 'blocos.views.grafico': CTRL, 'blocos.impressoes.grafico': CTRL, 'blocos.impressoes.taxa': CTRL,
  'blocos.assistido.marcas': CTRL, 'blocos.retencao.curva': CTRL, 'blocos.canal.reguas.linhas[].pos': CTRL,
  'blocos.views.medido': CTRL, 'blocos.views.frase': 'base',
  ...inventarioDeColunasDeGrafico('blocos.views.grafico'),
  'blocos.impressoes.medido': CTRL, 'blocos.impressoes.frase': 'base', 'blocos.impressoes.semTaxa': 'base',
  ...inventarioDeColunasDeGrafico('blocos.impressoes.grafico'),
  'blocos.impressoes.taxa.partes[].t': 'base', 'blocos.impressoes.taxa.partes[].b': APAR,
  'blocos.impressoes.taxa.inconclusiva': CTRL, 'blocos.impressoes.taxa.metodo[]': 'base',
  ...inventarioDaTaxa('blocos.impressoes.taxa.faixa'),
  'blocos.assistido.estado': CTRL, 'blocos.assistido.partes[].t': 'base', 'blocos.assistido.partes[].b': APAR,
  'blocos.assistido.pctTexto': REP, 'blocos.assistido.barraPct': APAR, 'blocos.assistido.normalPct': REP, 'blocos.assistido.normalTexto': REP,
  'blocos.assistido.marcaPct': APAR, 'blocos.assistido.rotuloAncora': APAR, 'blocos.assistido.contra': 'base', 'blocos.assistido.direcao': CTRL,
  'blocos.assistido.semNormal': 'base', 'blocos.assistido.marcas[]': APAR, 'blocos.assistido.alt': REP, 'blocos.assistido.metodo[]': 'base',
  'blocos.retencao.estado': CTRL, 'blocos.retencao.rotulo': REP, // a etiqueta "não medido"/"falhou" da tela: a frase e o estado já dizem o mesmo
  'blocos.retencao.frase': 'base', 'blocos.retencao.partes[].t': REP, 'blocos.retencao.partes[].b': APAR,
  'blocos.retencao.metodo[]': 'base', 'blocos.retencao.saidas': 'base', 'blocos.retencao.revistos': 'base', 'blocos.retencao.aviso': 'base',
  'blocos.retencao.curva.pontos[].t': APAR, 'blocos.retencao.curva.pontos[].ratio': APAR, 'blocos.retencao.curva.eixo[]': APAR, 'blocos.retencao.curva.meioT': APAR,
  'blocos.retencao.curva.ateT': APAR, 'blocos.retencao.curva.saidas[].t': APAR, 'blocos.retencao.curva.revistos[].de': APAR, 'blocos.retencao.curva.revistos[].ate': APAR,
  'blocos.retencao.curva.legenda.saidas': APAR, 'blocos.retencao.curva.legenda.revistos': APAR, 'blocos.retencao.curva.legenda.pico': APAR, 'blocos.retencao.curva.legenda.semDado': APAR,
  'blocos.retencao.curva.alt': REP,
  'blocos.canal.notaDiario': 'base',
  'blocos.canal.reguas.frase': 'base', 'blocos.canal.reguas.base': 'base', 'blocos.canal.reguas.pouco': 'base',
  'blocos.canal.reguas.linhas[].numero': IDENT, 'blocos.canal.reguas.linhas[].grupo': CTRL, 'blocos.canal.reguas.linhas[].nome': 'rotulo',
  'blocos.canal.reguas.linhas[].valor': 'numero', 'blocos.canal.reguas.linhas[].zeroMedido': CTRL, 'blocos.canal.reguas.linhas[].pos.*': REP,
  'blocos.canal.reguas.linhas[].posTexto': 'numero', 'blocos.canal.reguas.linhas[].semRegua': 'motivo', 'blocos.canal.reguas.linhas[].semMedida': 'base',
  'blocos.canal.reguas.linhas[].sub': 'base', 'blocos.canal.reguas.linhas[].min': 'numero', 'blocos.canal.reguas.linhas[].max': 'numero',
  'blocos.canal.reguas.linhas[].medianaPct': APAR, 'blocos.canal.reguas.linhas[].comprimida': CTRL, 'blocos.canal.reguas.linhas[].neutro': CTRL,
  'blocos.canal.reguas.linhas[].href': END, 'blocos.canal.reguas.linhas[].sr': 'base',
  'blocos.canal.reguas.linhas[].tracos[].id': IDENT, 'blocos.canal.reguas.linhas[].tracos[].pct': APAR, 'blocos.canal.reguas.linhas[].tracos[].este': CTRL,
  'blocos.canal.reguas.linhas[].tracos[].texto': REP, 'blocos.canal.reguas.linhas[].tracos[].dx': APAR, 'blocos.canal.reguas.linhas[].tracos[].titulo': APAR,
  'blocos.canal.reguas.linhas[].tracos[].href': END,
  'blocos.forja.titulo': 'rotulo', 'blocos.forja.estado': 'base', 'blocos.forja.oQue': 'base', 'blocos.forja.botao': CTRL, 'blocos.forja.porque': 'base',
  'blocos.ainda': 'base',
}

/** Folhas de número cru: nenhuma neste modelo, tudo o que a tela escreve já é texto. */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO_PROPRIO = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// Revisto pelo Logan (17/10): as frases abaixo.
export const ITENS_PRIVADOS_VIDEO = 'views por dia, impressões, cliques estimados, taxa de clique, % assistido e retenção deste vídeo, e a posição dele entre os vídeos do canal nessas medidas'

/** As linhas das réguas que vêm do alcance ou do diário (privadas); as outras vêm dos dados públicos do vídeo. */
const PRIVADAS = ['impressoes', 'vpd', 'assistido']
const ehPrivada = (l: LinhaRegua): boolean => PRIVADAS.includes(l.numero)

// ───────────────────────── tabelas
function tabelaDoCabecalho(h: ProprioVideoHeader): Tabela[] {
  const saida: Tabela[] = [{
    id: 'cabecalho-do-video', titulo: 'Números do vídeo', tipo: 'fixa', nomeNoCorte: 'tabela do cabeçalho do vídeo', privada: false, colunas: ['Medida', 'Valor', 'Base'],
    linhas: h.faixa.map((c, i): Celula[] => {
      const o = `modelo.header.faixa[${i}]`
      return [rot(c.label, `${o}.label`), numero(c.value, c.missing, `${o}.value`, c.missing ? `${o}.missing` : `${o}.value`), bas(c.conta, `${o}.conta`)]
    }),
  }]
  const notas = h.faixa.flatMap((c, i): Celula[][] => (c.sub ? [[rot(c.label, `modelo.header.faixa[${i}].label`), bas(c.sub, `modelo.header.faixa[${i}].sub`)]] : []))
  if (notas.length) saida.push({ id: 'cabecalho-do-video-notas', titulo: 'Nota de cada número do vídeo', tipo: 'fixa', nomeNoCorte: 'tabela de notas do cabeçalho do vídeo', privada: false, colunas: ['Medida', 'Nota'], linhas: notas })
  return saida
}

/** As linhas das réguas de um dos dois lados (públicas ou privadas). O índice é o da lista inteira: é ele que a origem carrega. */
function tabelasDasReguas(r: ReguasView, privada: boolean): Tabela[] {
  const p = privada ? 'privado-' : ''
  const sufixo = privada ? TITULO_PRIVADO : ''
  const dela = r.linhas.map((l, i) => ({ l, o: `modelo.blocos.canal.reguas.linhas[${i}]` })).filter(({ l }) => ehPrivada(l) === privada)
  if (dela.length === 0) return []
  const saida: Tabela[] = [{
    id: `${p}reguas-do-video`, titulo: `Este vídeo entre os do canal${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela da posição do vídeo (dado privado)' : 'tabela da posição do vídeo', privada,
    colunas: ['Medida', 'Valor', 'Posição'],
    linhas: dela.map(({ l, o }): Celula[] => [
      rot(l.nome, `${o}.nome`),
      numero(l.valor, l.semRegua, `${o}.valor`, `${o}.semRegua`),
      numero(l.posTexto, l.semRegua, `${o}.posTexto`, `${o}.semRegua`),
    ]),
  }]
  // a leitura por extenso só existe (na tela) quando a régua foi desenhada
  const leitura = dela.filter(({ l }) => l.pos !== null)
  if (leitura.length) {
    saida.push({
      id: `${p}reguas-do-video-leitura`, titulo: `Leitura de cada régua${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela da leitura da posição (dado privado)' : 'tabela da leitura da posição', privada,
      colunas: ['Medida', 'Leitura'], linhas: leitura.map(({ l, o }): Celula[] => [rot(l.nome, `${o}.nome`), bas(l.sr, `${o}.sr`)]),
    })
  }
  const faixa = dela.filter(({ l }) => l.min !== null && l.max !== null)
  if (faixa.length) {
    saida.push({
      id: `${p}reguas-do-video-faixa`, titulo: `Menor e maior valor entre os vídeos do canal${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela do menor e maior (dado privado)' : 'tabela do menor e maior', privada,
      colunas: ['Medida', 'Menor', 'Maior'],
      linhas: faixa.map(({ l, o }): Celula[] => [rot(l.nome, `${o}.nome`), numero(l.min, null, `${o}.min`, `${o}.min`), numero(l.max, null, `${o}.max`, `${o}.max`)]),
    })
  }
  const notas = dela.flatMap(({ l, o }): Celula[][] => [
    ...(l.sub ? [[rot(l.nome, `${o}.nome`), bas(l.sub, `${o}.sub`)]] : []),
    ...(l.semMedida ? [[rot(l.nome, `${o}.nome`), bas(l.semMedida, `${o}.semMedida`)]] : []),
  ])
  if (notas.length) {
    saida.push({
      id: `${p}reguas-do-video-notas`, titulo: `Nota de cada medida da posição${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela de notas da posição (dado privado)' : 'tabela de notas da posição', privada,
      colunas: ['Medida', 'Nota'], linhas: notas,
    })
  }
  return saida
}

function tabelaDaTaxa(f: TaxaFaixaView | undefined): Tabela[] {
  if (!f || f.linhas.length === 0) return []
  const o = 'modelo.blocos.impressoes.taxa.faixa.linhas'
  return [{
    id: 'privado-taxa-de-clique-do-video', titulo: `Taxa de clique do vídeo${TITULO_PRIVADO}`, tipo: 'fixa', nomeNoCorte: 'tabela da taxa de clique do vídeo', privada: true,
    colunas: ['Faixa', 'Taxa', 'Intervalo de 95%, de', 'Intervalo de 95%, até'],
    linhas: f.linhas.map((l, i): Celula[] => [
      rot(l.rotulo ?? 'Este vídeo', `${o}[${i}].rotulo`), numero(l.valor, null, `${o}[${i}].valor`, `${o}[${i}].valor`),
      numero(l.loTxt, null, `${o}[${i}].loTxt`, `${o}[${i}].loTxt`), numero(l.hiTxt, null, `${o}[${i}].hiTxt`, `${o}[${i}].hiTxt`),
    ]),
  }]
}

// ───────────────────────── o que cada leitura privada escreve em prosa
function prosaDoVideo(m: ModeloVideoProprio): Tabela[] {
  const b = m.blocos
  const linhas: Array<[string, string]> = []
  const raiz = 'modelo.blocos'
  const doGrafico = (g: ImpressoesView | null | undefined, o: string): void => {
    if (!g) return
    if (naoVazio(g.vazio)) linhas.push([g.vazio, `${o}.vazio`])
    if (naoVazio(g.periodoTexto)) linhas.push([g.periodoTexto, `${o}.periodoTexto`])
    if (naoVazio(g.resumo)) linhas.push([g.resumo, `${o}.resumo`])
    g.avisos.forEach((a, i) => linhas.push([a, `${o}.avisos[${i}]`]))
  }
  if (b.views && naoVazio(b.views.frase)) linhas.push([b.views.frase, `${raiz}.views.frase`])
  doGrafico(b.views?.grafico, `${raiz}.views.grafico`)
  doGrafico(b.impressoes?.grafico, `${raiz}.impressoes.grafico`)
  if (b.impressoes) {
    if (naoVazio(b.impressoes.frase)) linhas.push([b.impressoes.frase, `${raiz}.impressoes.frase`])
    if (naoVazio(b.impressoes.semTaxa)) linhas.push([b.impressoes.semTaxa, `${raiz}.impressoes.semTaxa`])
    const t = b.impressoes.taxa
    if (t) {
      t.partes.forEach((x, i) => { if (naoVazio(x.t)) linhas.push([x.t, `${raiz}.impressoes.taxa.partes[${i}].t`]) })
      t.faixa.linhas.forEach((l, i) => { if (naoVazio(l.nota)) linhas.push([l.nota, `${raiz}.impressoes.taxa.faixa.linhas[${i}].nota`]) })
    }
  }
  const a = b.assistido
  if (a) {
    a.partes.forEach((x, i) => { if (naoVazio(x.t)) linhas.push([x.t, `${raiz}.assistido.partes[${i}].t`]) })
    if (naoVazio(a.contra)) linhas.push([a.contra, `${raiz}.assistido.contra`])
    if (naoVazio(a.semNormal)) linhas.push([a.semNormal, `${raiz}.assistido.semNormal`])
  }
  const r = b.retencao
  if (r.estado === 'coletada') {
    linhas.push([r.frase, `${raiz}.retencao.frase`])
    if (naoVazio(r.saidas)) linhas.push([r.saidas, `${raiz}.retencao.saidas`])
    if (naoVazio(r.revistos)) linhas.push([r.revistos, `${raiz}.retencao.revistos`])
    if (naoVazio(r.aviso)) linhas.push([r.aviso, `${raiz}.retencao.aviso`])
  }
  if (naoVazio(b.canal.reguas.frase)) linhas.push([b.canal.reguas.frase, `${raiz}.canal.reguas.frase`])
  if (naoVazio(b.canal.reguas.base)) linhas.push([b.canal.reguas.base, `${raiz}.canal.reguas.base`])
  if (naoVazio(b.canal.reguas.pouco)) linhas.push([b.canal.reguas.pouco, `${raiz}.canal.reguas.pouco`])
  if (naoVazio(b.canal.notaDiario)) linhas.push([b.canal.notaDiario, `${raiz}.canal.notaDiario`])
  return tabelaDeProsa('privado-frases-do-video', 'Frases do vídeo', linhas)
}

/** Sem a leitura privada: só as frases de "não medido" que o modelo escreveu, e só delas. */
function motivosDoModelo(m: ModeloVideoProprio): string[] {
  const b = m.blocos
  const todos: Array<string | null> = [b.nota, b.canal.notaDiario, b.canal.reguas.frase, b.canal.reguas.base, b.canal.reguas.pouco]
  for (const l of b.canal.reguas.linhas) if (ehPrivada(l)) todos.push(l.semRegua)
  if (b.retencao.estado !== 'coletada') todos.push(b.retencao.frase)
  return [...new Set(todos.filter(naoVazio))]
}

function tabelasDaRetencaoNaoColetada(r: RetencaoView): Array<[string, string]> {
  return r.estado !== 'coletada' && naoVazio(r.frase) ? [[r.frase, 'modelo.blocos.retencao.frase']] : []
}

// ───────────────────────── o empacotador
export function empacotarVideoProprio(m: ModeloVideoProprio, privado: EstadoDoPrivado): PacoteModelo {
  const { alcance, diario } = leituraDe(privado, m.header.canal.id)
  const b = m.blocos
  const falhou = alcance === 'erro' || diario === 'erro' || b.acesso === 'erro'
  // as réguas públicas e a frase delas, quando não há o dado privado, são todas públicas
  const incluido = alcance === 'ok' && diario === 'ok' && b.acesso === 'ok'

  const publicas: Tabela[] = [...tabelaDoCabecalho(m.header), ...tabelasDasReguas(b.canal.reguas, false), ...tabelaDeProsa('retencao-em-frases', 'Retenção, em frases', tabelasDaRetencaoNaoColetada(b.retencao)).map((t) => ({ ...t, privada: false, titulo: 'Retenção, em frases' }))]
  const privadas: Tabela[] = []
  const avisos: string[] = []
  const definicoes: PacoteModelo['definicoes'] = []

  // o método da retenção é texto fixo e a tela o mostra em qualquer estado
  for (const [i, p] of b.retencao.metodo.entries()) definicoes.push({ medida: `De onde vem a curva de retenção (${i + 1})`, frase: p, limiares: [], privado: false })

  if (incluido) {
    if (b.views?.grafico) privadas.push(...tabelaDeDiaADia(b.views.grafico, 'modelo.blocos.views.grafico', 'privado-views-por-dia-do-video', 'Views por dia do vídeo', 'views por dia do vídeo', false))
    if (b.impressoes?.grafico) privadas.push(...tabelaDeDiaADia(b.impressoes.grafico, 'modelo.blocos.impressoes.grafico', 'privado-impressoes-por-dia-do-video', 'Impressões e cliques por dia do vídeo', 'impressões por dia do vídeo', true))
    privadas.push(...tabelaDaTaxa(b.impressoes?.taxa?.faixa), ...tabelasDasReguas(b.canal.reguas, true), ...prosaDoVideo(m))
    if (b.views?.grafico) for (const [i, p] of b.views.grafico.metodo.entries()) definicoes.push({ medida: `Como ler o gráfico de views do vídeo (${i + 1})`, frase: p, limiares: [], privado: true })
    if (b.impressoes?.grafico) for (const [i, p] of b.impressoes.grafico.metodo.entries()) definicoes.push({ medida: `Como ler o gráfico de impressões do vídeo (${i + 1})`, frase: p, limiares: [], privado: true })
    if (b.impressoes?.taxa) for (const p of b.impressoes.taxa.metodo) definicoes.push({ medida: 'Como a taxa de clique do vídeo é calculada', frase: p, limiares: [], privado: true })
    if (b.assistido) for (const p of b.assistido.metodo) definicoes.push({ medida: 'De onde vem o % assistido', frase: p, limiares: [], privado: true })
    // a frase de método que a retenção já escreve (pública) não vira privada de novo: seria o mesmo texto nos dois lados do corte
    const publicas = new Set(b.retencao.metodo)
    for (let k = definicoes.length - 1; k >= 0; k--) if (definicoes[k]!.privado && publicas.has(definicoes[k]!.frase)) definicoes.splice(k, 1)
  } else {
    avisos.push(...motivosDoModelo(m))
  }

  // o estado do dado privado (seção 4.4): só o que o `montar…` entregou, nunca uma frase da tela
  let estadoPrivado: PacoteModelo['privado']
  if (incluido) estadoPrivado = { estado: 'incluido', itens: ITENS_PRIVADOS_VIDEO }
  else if (falhou) estadoPrivado = { estado: 'excluido', motivo: 'leitura_falhou', itens: ITENS_PRIVADOS_VIDEO }
  else if (privado.negativa === 'sem_direito') estadoPrivado = { estado: 'excluido', motivo: 'sem_direito', itens: ITENS_PRIVADOS_VIDEO }
  else estadoPrivado = { estado: 'excluido', motivo: 'nao_conferido', itens: ITENS_PRIVADOS_VIDEO }

  const f = b.forja
  const naoMede = [
    NAO_MEDE_CAUSA, NAO_MEDE_OUTROS, `${f.titulo}: ${f.estado}. ${f.oQue} ${f.porque}`, b.ainda,
  ]

  return {
    tela: 'video-proprio',
    janela: m.header.meta,
    foco: [{ nome: m.header.titulo, oQueE: 'vídeo', detalhe: m.header.meta }],
    tabelas: [...publicas, ...privadas],
    citados: [],
    definicoes,
    avisos,
    naoMede,
    privado: estadoPrivado,
    comentarios: { estado: 'na' },
    vazio: null,
    motivoDoMagro: null,
    listasCompletas: true,
  }
}
