/**
 * A5 · E17 degrau 1, Tarefa 6a: o empacotador de Comparar. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo; a primeira palavra, `modelo`, é só o nome da raiz) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloComparar`) é o `ParView` da tela mais o que a tela lê do pacote (`serieDesde`, `eixo`, os cartões de "Só o seu
 * canal mede" já escolhidos por `buildSoSeuCanal`, os nomes das réguas comprimidas). Duas arrumações, ambas só de chave, sem mudar valor:
 *  - `modelo.linhas[].lados` e `modelo.linhas[].pos` (pares) viram `a`/`b` e `posA`/`posB`: duas células da mesma linha apontam para o mesmo `modelo.linhas[i]`,
 *    e a regra (d2) da paridade compara os ÍNDICES da origem (`lados[0]` contra `lados[1]` pareceria "elementos diferentes da lista");
 *  - a linha do cartão separa `nota` (valor medido) de `motivo` (valor não medido): uma chave do inventário tem um destino só.
 *
 * Dado privado (spec 8.1.3/4.4): vem do estado que o `montar…` entrega (`EstadoDoPrivado`), nunca de uma frase da tela. As linhas "Views por
 * dia nos longos" e "por mil inscritos" de um canal SEU vêm do diário privado: quando o diário foi lido, vão para tabelas privadas.
 */
import type { Numero, NumeroId } from '../_comparar/numeros-model'
import type { CanalPack, CompararPack, Pub90Item } from '../_comparar/pack'
import type { LinhaPar, ParView, PosLado } from '../_comparar/par-model'
import { definicoesDaTabela } from '../_comparar/definicoes'
import { reguaDaLinha } from '../_comparar/regua-da-linha'
import { buildSoSeuCanal, INFO_SO_SEU_CANAL, type SoSeuCanalCartao } from '../_comparar/so-seu-canal-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, EstadoDoPrivado, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
export interface LinhaDoModelo extends Omit<LinhaPar, 'lados' | 'pos'> {
  lados: LinhaPar['lados']
  pos: LinhaPar['pos']
  a: Numero
  b: Numero
  posA: PosLado | null
  posB: PosLado | null
  /** A relação como a tela a ESCREVE (a tela põe a primeira letra em maiúscula nas relações "igual" e "zero"; ver `textoDaRelacao`). */
  relacaoTexto: string | null
}

export interface LinhaDoCartao {
  chave: string; rotulo: string; sub: string
  valor: string | null
  /** Só com valor medido. */
  nota: string | null
  /** Só sem valor: a nota da linha, ou, sem nota, a frase do cartão. */
  motivo: string | null
  fraco: boolean; aindaNaoDa: boolean
}
export interface CartaoDoModelo extends Omit<SoSeuCanalCartao, 'linhas'> { linhas: LinhaDoCartao[] }

export interface ModeloComparar extends Omit<ParView, 'linhas'> {
  linhas: LinhaDoModelo[]
  serieDesde: string
  eixo: CompararPack['eixo']
  cartoes: CartaoDoModelo[]
  /** Nomes das linhas cuja régua está em escala comprimida (entram na definição "Régua"). */
  comprimidas: string[]
}

/**
 * A mesma regra de `capitalizar` em `_comparar/numero-a-numero.tsx`, que mora num módulo `'use client'` e por isso não se importa aqui
 * (PENDÊNCIA: mover para um módulo neutro, como `definicoes.ts`). O teste de paridade (regra c) compara com o texto REAL da tela e cai se divergirem.
 */
function capitalizar(texto: string, nomes: readonly string[]): string {
  if (!texto || nomes.some((n) => n && (texto.startsWith(`${n} `) || texto.startsWith(`${n}:`)))) return texto
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function textoDaRelacao(r: NonNullable<LinhaPar['relacao']>, nomes: readonly string[]): string {
  switch (r.tipo) {
    case 'maior':
    case 'recente': return r.texto
    case 'igual': return capitalizar(r.texto, [])
    case 'zero': return capitalizar(r.texto, nomes)
    default: { const nunca: never = r; return nunca }
  }
}

export function modeloDeComparar(pack: CompararPack, par: ParView): ModeloComparar {
  const cartoes = buildSoSeuCanal({ a: par.a, b: par.b }, pack.soSeuCanal).map((c): CartaoDoModelo => ({
    ...c,
    linhas: c.linhas.map((l): LinhaDoCartao => ({
      chave: l.chave, rotulo: l.rotulo, sub: l.sub, valor: l.valor,
      nota: l.valor === null ? null : l.nota,
      motivo: l.valor === null ? (l.nota ?? c.frase) : null,
      fraco: l.fraco, aindaNaoDa: l.aindaNaoDa,
    })),
  }))
  return {
    ...par,
    linhas: par.linhas.map((l): LinhaDoModelo => ({
      ...l, a: l.lados[0], b: l.lados[1], posA: l.pos[0], posB: l.pos[1],
      relacaoTexto: l.relacao ? textoDaRelacao(l.relacao, [par.a.name, par.b.name]) : null,
    })),
    serieDesde: pack.serieDesde,
    eixo: pack.eixo,
    cartoes,
    comprimidas: par.linhas.filter((l) => reguaDaLinha(pack, par, l.id)?.comprimida).map((l) => l.nome),
  }
}

// ───────────────────────── o inventário de folhas (item 160)
/** Todo caminho do modelo, com o destino. Chave com `[]` = qualquer posição de lista; `*` no fim casa o resto. */
export const INVENTARIO_COMPARAR: Inventario = {
  // o canal de cada lado (CanalPack)
  'a.id': { descartado: 'identificador' }, 'b.id': { descartado: 'identificador' },
  'a.name': 'terceiros', 'b.name': 'terceiros',
  'a.own': { descartado: 'controle de tela' }, 'b.own': { descartado: 'controle de tela' },
  'a.niche': { descartado: 'identificador' }, 'b.niche': { descartado: 'identificador' },
  'a.nicheLabel': 'rotulo', 'b.nicheLabel': 'rotulo',
  'a.avatar': { descartado: 'imagem' }, 'b.avatar': { descartado: 'imagem' },
  'a.ini': { descartado: 'aparência' }, 'b.ini': { descartado: 'aparência' },
  'a.color': { descartado: 'aparência' }, 'b.color': { descartado: 'aparência' },
  'a.subsTexto': { descartado: 'repetido' }, 'b.subsTexto': { descartado: 'repetido' }, // é o `numeros.inscritos.texto`; a linha de foco o escreve
  'a.semVideos': { descartado: 'controle de tela' }, 'b.semVideos': { descartado: 'controle de tela' },
  'a.comDatas': { descartado: 'controle de tela' }, 'b.comDatas': { descartado: 'controle de tela' },
  'a.ultimo': { descartado: 'repetido' }, 'b.ultimo': { descartado: 'repetido' }, // é a base de "dias desde o último vídeo"
  'a.href': { descartado: 'endereço' }, 'b.href': { descartado: 'endereço' },
  'a.numeros.*': { descartado: 'repetido' }, 'b.numeros.*': { descartado: 'repetido' }, // os mesmos de `modelo.linhas[].a` e `modelo.linhas[].b`
  'a.top5[].id': { descartado: 'identificador' }, 'b.top5[].id': { descartado: 'identificador' },
  'a.top5[].abre': { descartado: 'controle de tela' }, 'b.top5[].abre': { descartado: 'controle de tela' },
  'a.top5[].titulo': 'terceiros', 'b.top5[].titulo': 'terceiros',
  'a.top5[].thumb': { descartado: 'imagem' }, 'b.top5[].thumb': { descartado: 'imagem' },
  'a.top5[].viewsTexto': 'numero', 'b.top5[].viewsTexto': 'numero',
  'a.top5[].idadeTexto': 'base', 'b.top5[].idadeTexto': 'base',
  'a.top5[].short': 'rotulo', 'b.top5[].short': 'rotulo',
  'a.top5Nota': 'base', 'b.top5Nota': 'base',
  'a.pub90[].t': { descartado: 'repetido' }, 'b.pub90[].t': { descartado: 'repetido' }, // a data escrita é `dataTexto`
  'a.pub90[].fmt': 'rotulo', 'b.pub90[].fmt': 'rotulo',
  'a.pub90[].dataTexto': 'rotulo', 'b.pub90[].dataTexto': 'rotulo',
  'a.pub90Nota': 'base', 'b.pub90Nota': 'base',
  // o par
  'cores[]': { descartado: 'aparência' },
  'conjunto.tipo': 'rotulo', 'conjunto.niche': { descartado: 'identificador' }, 'conjunto.label': 'rotulo',
  subtitulo: 'rotulo', // o conjunto vai em `janela`; a frase em si é só apresentação
  titulo: { descartado: 'controle de tela' }, // título da aba do navegador
  status: { descartado: 'controle de tela' }, // anúncio para leitor de tela
  publicacao: { descartado: 'controle de tela' },
  'fora[]': { descartado: 'repetido' }, // vai no rodapé e na definição "Ficaram de fora"
  rodape: 'base',
  'leitura[].simbolo': { descartado: 'aparência' }, 'leitura[].lado': { descartado: 'aparência' }, 'leitura[].texto': 'base',
  serieDesde: 'base',
  'eixo[]': 'rotulo',
  'comprimidas[]': { descartado: 'repetido' }, // vai na definição "Régua"
  // as linhas
  'linhas[].id': { descartado: 'identificador' },
  'linhas[].grupo': { descartado: 'controle de tela' },
  'linhas[].nome': 'rotulo', 'linhas[].base': 'base',
  'linhas[].lados[].*': { descartado: 'repetido' }, // os mesmos de `a` e `b`
  'linhas[].pos[].*': { descartado: 'repetido' }, 'linhas[].pos[]': { descartado: 'repetido' }, // os mesmos de `posA` e `posB`
  'linhas[].a.x': { descartado: 'repetido' }, 'linhas[].b.x': { descartado: 'repetido' }, // o valor escrito é `texto`
  'linhas[].a.texto': 'numero', 'linhas[].b.texto': 'numero',
  'linhas[].a.motivo': 'motivo', 'linhas[].b.motivo': 'motivo',
  'linhas[].a.nota': 'base', 'linhas[].b.nota': 'base',
  'linhas[].posA': { descartado: 'repetido' }, 'linhas[].posB': { descartado: 'repetido' },
  'linhas[].posA.texto': 'base', 'linhas[].posB.texto': 'base',
  'linhas[].posA.geral': 'base', 'linhas[].posB.geral': 'base',
  'linhas[].eixo.*': { descartado: 'aparência' }, // régua e barras finas: o desenho; o aviso das barras é só do desenho
  'linhas[].relacao': { descartado: 'repetido' },
  'linhas[].relacaoTexto': 'base',
  'linhas[].relacao.tipo': { descartado: 'aparência' }, 'linhas[].relacao.lado': { descartado: 'aparência' },
  'linhas[].relacao.quem': { descartado: 'repetido' }, 'linhas[].relacao.texto': { descartado: 'repetido' }, // a tela escreve `relacaoTexto`
  // o cartão "Só o seu canal mede" (dado privado do canal)
  'cartoes[].id': { descartado: 'identificador' },
  'cartoes[].canal': 'rotulo',
  'cartoes[].frase': 'base',
  'cartoes[].naoMedido': { descartado: 'controle de tela' },
  'cartoes[].taxa': { descartado: 'repetido' }, 'cartoes[].taxa.*': { descartado: 'repetido' }, // cliques, impressões e taxa: as linhas do cartão
  'cartoes[].linhas[].chave': { descartado: 'identificador' },
  'cartoes[].linhas[].rotulo': 'rotulo',
  'cartoes[].linhas[].sub': 'base',
  'cartoes[].linhas[].valor': 'numero',
  'cartoes[].linhas[].nota': 'base',
  'cartoes[].linhas[].motivo': 'motivo',
  'cartoes[].linhas[].fraco': { descartado: 'aparência' },
  'cartoes[].linhas[].aindaNaoDa': { descartado: 'controle de tela' },
}

/** Folhas de número cru: o componente escreve, o empacotador usa o MESMO texto por nome. O formato do vídeo e da publicação sai como rótulo. */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_COMPARAR = [
  'a.top5[].short', 'b.top5[].short', 'a.pub90[].fmt', 'b.pub90[].fmt',
] as const

export const formatoDoVideo = (short: unknown): string => (short === true ? 'Short' : 'sem marca de Short')
export const formatoDaPublicacao = (fmt: unknown): string => (fmt === 'short' ? 'Short' : 'longo')

// ───────────────────────── textos do pacote que esta tela escreve
// TEXTO-A-REVISAR (Logan/Naksu): as frases de aviso e de "o que esta tela não mede" abaixo.
export const AVISO_FREQUENCIA = 'A contagem de publicados em 90 dias não mede frequência.' // fixo do item 163
export const AVISO_PARCIAL = 'Parte do dado privado do canal não foi lida agora.'
export const SEM_PAR = 'Para comparar, o site precisa acompanhar pelo menos dois canais.' // a frase que a tela escreve sem par
const NAO_MEDE_RITMO = 'ritmo de publicação (a linha não existe nesta comparação)'
const NAO_MEDE_CAUSA = 'a causa das diferenças entre os dois canais: maior não quer dizer melhor'
const NAO_MEDE_CONCORRENTE = 'impressões, taxa de clique e % assistido de um concorrente: o YouTube só os entrega ao dono do canal'
const ITENS_EXCLUIDOS = 'views por dia do seu canal, impressões, cliques estimados, taxa de clique e % assistido'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })

/** `origem` é o caminho do NÚMERO (`modelo.linhas[3].a`): o texto vem de `.texto`, o motivo de `.motivo`. */
function celulaDoNumero(n: Numero, origem: string): Celula {
  if (n.x === null || n.texto === null) return { papel: 'numero', estado: 'nao_medido', motivo: n.motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${origem}.motivo` }
  if (n.x === 0) return { papel: 'numero', estado: 'zero_medido', texto: n.texto, x: 0, origem: `${origem}.texto` }
  return { papel: 'numero', estado: 'medido', texto: n.texto, x: n.x, origem: `${origem}.texto` }
}

function celulaDoCartao(l: LinhaDoCartao, origem: string): Celula {
  if (l.valor === null) return { papel: 'numero', estado: 'nao_medido', motivo: l.motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${origem}.motivo` }
  if (l.valor === '0') return { papel: 'numero', estado: 'zero_medido', texto: l.valor, x: 0, origem: `${origem}.valor` }
  return { papel: 'numero', estado: 'medido', texto: l.valor, x: null, origem: `${origem}.valor` }
}

const ehDoDiario = (id: NumeroId): boolean => id === 'vpd' || id === 'vpdPorMil'

// ───────────────────────── tabelas das linhas do par
function tabelasDasLinhas(m: ModeloComparar, indices: readonly number[], privada: boolean): Tabela[] {
  if (indices.length === 0) return []
  const p = privada ? 'privado-' : ''
  const sufixo = privada ? ', views por dia do seu canal' : ''
  const lado = { a: m.a, b: m.b } as const
  const saida: Tabela[] = []

  saida.push({
    id: `${p}numero-a-numero`, titulo: `Número a número${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela de views por dia do seu canal' : 'tabela número a número', privada,
    colunas: ['Medida', `${m.a.name} (lado A)`, `${m.b.name} (lado B)`, 'Base'],
    linhas: indices.map((i) => {
      const l = m.linhas[i]!
      return [rotulo(l.nome, `modelo.linhas[${i}].nome`), celulaDoNumero(l.a, `modelo.linhas[${i}].a`), celulaDoNumero(l.b, `modelo.linhas[${i}].b`), base(l.base, `modelo.linhas[${i}].base`)]
    }),
  })

  const relacao = indices.filter((i) => m.linhas[i]!.relacaoTexto !== null)
  if (relacao.length) {
    saida.push({
      id: `${p}relacao`, titulo: `Relação entre os lados${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? 'tabela de relação (views por dia)' : 'tabela de relação', privada,
      colunas: ['Medida', 'Relação'],
      linhas: relacao.map((i) => [rotulo(m.linhas[i]!.nome, `modelo.linhas[${i}].nome`), base(m.linhas[i]!.relacaoTexto!, `modelo.linhas[${i}].relacaoTexto`)]),
    })
  }

  // posição e nota: uma tabela por lado, sem coluna de canal (o nome do canal no título e no foco; numa tabela privada ele não é dado privado)
  for (const k of ['a', 'b'] as const) {
    const canal = lado[k]
    const K = k.toUpperCase()
    const posicao: Celula[][] = []
    const notas: Celula[][] = []
    for (const i of indices) {
      const l = m.linhas[i]!
      const pos = k === 'a' ? l.posA : l.posB
      if (pos) {
        posicao.push([rotulo(l.nome, `modelo.linhas[${i}].nome`), base(pos.texto, `modelo.linhas[${i}].pos${K}.texto`)])
        if (pos.geral !== null) posicao.push([rotulo(l.nome, `modelo.linhas[${i}].nome`), base(pos.geral, `modelo.linhas[${i}].pos${K}.geral`)])
      }
      const nota = l[k].nota
      if (nota !== null) notas.push([rotulo(l.nome, `modelo.linhas[${i}].nome`), base(nota, `modelo.linhas[${i}].${k}.nota`)])
    }
    if (posicao.length) {
      saida.push({
        id: `${p}posicao-${k}`, titulo: `Posição de ${canal.name} (lado ${K}) entre os canais${sufixo}`, tipo: 'fixa', nomeNoCorte: `tabela de posição (lado ${K}${privada ? ', views por dia' : ''})`, privada,
        colunas: ['Medida', 'Posição'], linhas: posicao,
      })
    }
    if (notas.length) {
      saida.push({
        id: `${p}notas-dos-numeros-${k}`, titulo: `Nota de cada número de ${canal.name} (lado ${K})${sufixo}`, tipo: 'fixa', nomeNoCorte: `tabela de notas (lado ${K}${privada ? ', views por dia' : ''})`, privada,
        colunas: ['Medida', 'Nota'], linhas: notas,
      })
    }
  }
  return saida
}

// ───────────────────────── tabelas do canal (mais vistos, publicação)
function tabelasDosCanais(m: ModeloComparar): Tabela[] {
  const canais = [['a', m.a], ['b', m.b]] as const
  const saida: Tabela[] = []

  const vistos: Celula[][] = []
  for (const [k, c] of canais) {
    c.top5.forEach((v, j) => {
      const o = `modelo.${k}.top5[${j}]`
      vistos.push([
        terceiros(c.name, `modelo.${k}.name`), terceiros(v.titulo, `${o}.titulo`),
        { papel: 'numero', estado: 'medido', texto: v.viewsTexto, x: null, origem: `${o}.viewsTexto` },
        base(v.idadeTexto, `${o}.idadeTexto`), rotulo(formatoDoVideo(v.short), `${o}.short`),
      ])
    })
  }
  if (vistos.length) {
    saida.push({
      id: 'mais-vistos', titulo: 'Os 5 vídeos mais vistos de cada canal', tipo: 'lista', nomeNoCorte: 'tabela de vídeos mais vistos', privada: false,
      colunas: ['Canal', 'Vídeo', 'Views', 'Idade', 'Formato'], linhas: vistos,
    })
  }
  saida.push({
    id: 'mais-vistos-notas', titulo: 'Quantos vídeos entram em "mais vistos"', tipo: 'fixa', nomeNoCorte: 'tabela de notas dos mais vistos', privada: false,
    colunas: ['Canal', 'Nota'], linhas: canais.map(([k, c]) => [terceiros(c.name, `modelo.${k}.name`), base(c.top5Nota, `modelo.${k}.top5Nota`)]),
  })

  if (!m.publicacao) return saida // a tela não mostra o bloco de publicação; o rodapé diz por quê
  const comFormato: Celula[][] = [], semFormato: Celula[][] = []
  for (const [k, c] of canais) {
    c.pub90.forEach((v: Pub90Item, j) => {
      const o = `modelo.${k}.pub90[${j}]`
      if (v.fmt === null) semFormato.push([terceiros(c.name, `modelo.${k}.name`), rotulo(v.dataTexto, `${o}.dataTexto`)])
      else comFormato.push([terceiros(c.name, `modelo.${k}.name`), rotulo(v.dataTexto, `${o}.dataTexto`), rotulo(formatoDaPublicacao(v.fmt), `${o}.fmt`)])
    })
  }
  if (comFormato.length) {
    saida.push({
      id: 'publicacoes-90-dias', titulo: 'Publicação nos últimos 90 dias', tipo: 'lista', nomeNoCorte: 'tabela de publicações', privada: false,
      colunas: ['Canal', 'Data', 'Formato'], linhas: comFormato,
    })
  }
  if (semFormato.length) {
    saida.push({
      id: 'publicacoes-90-dias-sem-formato', titulo: 'Publicação nos últimos 90 dias, formato não confirmado', tipo: 'lista', nomeNoCorte: 'tabela de publicações sem formato', privada: false,
      colunas: ['Canal', 'Data'], linhas: semFormato,
    })
  }
  saida.push({
    id: 'publicacao-notas', titulo: 'Resumo da publicação em 90 dias', tipo: 'fixa', nomeNoCorte: 'tabela de resumo da publicação', privada: false,
    colunas: ['Canal', 'Resumo'], linhas: canais.map(([k, c]) => [terceiros(c.name, `modelo.${k}.name`), base(c.pub90Nota, `modelo.${k}.pub90Nota`)]),
  })
  return saida
}

// ───────────────────────── o cartão "Só o seu canal mede" (dado privado)
function tabelasDoCartao(c: CartaoDoModelo, k: number, lado: 'a' | 'b'): Tabela[] {
  if (c.linhas.length === 0) return []
  const saida: Tabela[] = [{
    id: `privado-alcance-${lado}`, titulo: `Só o seu canal mede: ${c.canal}`, tipo: 'fixa', nomeNoCorte: `tabela de alcance (lado ${lado.toUpperCase()})`, privada: true,
    colunas: ['Medida', 'Valor', 'Base'],
    linhas: c.linhas.map((l, j) => [rotulo(l.rotulo, `modelo.cartoes[${k}].linhas[${j}].rotulo`), celulaDoCartao(l, `modelo.cartoes[${k}].linhas[${j}]`), base(l.sub, `modelo.cartoes[${k}].linhas[${j}].sub`)]),
  }]
  const notas = c.linhas.flatMap((l, j) => (l.nota === null ? [] : [[rotulo(l.rotulo, `modelo.cartoes[${k}].linhas[${j}].rotulo`), base(l.nota, `modelo.cartoes[${k}].linhas[${j}].nota`)]]))
  if (notas.length) {
    saida.push({
      id: `privado-alcance-${lado}-notas`, titulo: `Nota de cada medida de alcance: ${c.canal}`, tipo: 'fixa', nomeNoCorte: `tabela de notas do alcance (lado ${lado.toUpperCase()})`, privada: true,
      colunas: ['Medida', 'Nota'], linhas: notas,
    })
  }
  return saida
}

// ───────────────────────── o empacotador
const leituraDe = (e: EstadoDoPrivado, id: string): { diario: 'ok' | 'negado' | 'erro'; alcance: 'ok' | 'negado' | 'erro' } => {
  const x = e.acessoPorCanal[id]
  // leitura que o `montar…` não registrou conta como falha: nunca como "lida" nem como "sem direito"
  return { diario: x?.diario ?? 'erro', alcance: x?.alcance ?? 'erro' }
}

const detalheDoLado = (c: CanalPack, lado: 'A' | 'B'): string =>
  `lado ${lado}${c.nicheLabel ? `, nicho ${c.nicheLabel}` : ''}, ${c.subsTexto ? `${c.subsTexto} inscritos` : c.numeros.inscritos.motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO}`

/** `modelo` nulo = a tela sem par (menos de dois canais): pacote com `vazio` preenchido. */
export function empacotarComparar(modelo: ModeloComparar | null, privado: EstadoDoPrivado): PacoteModelo {
  if (modelo === null) {
    return {
      tela: 'comparar', janela: 'sem comparação', foco: [], tabelas: [], citados: [], definicoes: [], avisos: [], naoMede: [],
      privado: { estado: 'na' }, comentarios: { estado: 'na' }, vazio: SEM_PAR, motivoDoMagro: null, listasCompletas: false,
    }
  }
  const lados = ([['a', 'A', modelo.a], ['b', 'B', modelo.b]] as const)
  const proprios = lados.filter(([, , c]) => c.own)
  const leituras = proprios.map(([, , c]) => leituraDe(privado, c.id))

  // as linhas do diário de um canal seu vão para tabela privada quando o diário foi lido
  const diarioLido = leituras.some((x) => x.diario === 'ok')
  const indicesPrivados = diarioLido ? modelo.linhas.flatMap((l, i) => (ehDoDiario(l.id) ? [i] : [])) : []
  const indicesPublicos = modelo.linhas.flatMap((_, i) => (indicesPrivados.includes(i) ? [] : [i]))

  const cartaoDe = (id: string): { cartao: CartaoDoModelo; k: number } | null => {
    const k = modelo.cartoes.findIndex((c) => c.id === id)
    return k < 0 ? null : { cartao: modelo.cartoes[k]!, k }
  }
  const privadas: Tabela[] = [...tabelasDasLinhas(modelo, indicesPrivados, true)]
  const avisosPrivados: string[] = []
  const avisos: string[] = [AVISO_FREQUENCIA, modelo.rodape]
  let cartoesLidos = 0
  for (const [k, , c] of proprios) {
    const achado = cartaoDe(c.id)
    if (!achado) continue
    if (achado.cartao.linhas.length > 0) {
      privadas.push(...tabelasDoCartao(achado.cartao, achado.k, k))
      avisosPrivados.push(achado.cartao.frase)
      cartoesLidos += 1
    } else {
      avisos.push(achado.cartao.frase) // a frase do motivo (negado ou falhou) é texto do site, não dado privado
    }
  }

  const publicas = [...tabelasDasLinhas(modelo, indicesPublicos, false), ...tabelasDosCanais(modelo)]
  const leitura: Tabela[] = modelo.leitura.length
    ? [{
      id: 'leitura-rapida', titulo: 'Leitura rápida', tipo: 'fixa', nomeNoCorte: 'leitura rápida', privada: false, colunas: ['Leitura'],
      linhas: modelo.leitura.map((x, i) => [base(x.texto, `modelo.leitura[${i}].texto`)]),
    }]
    : []

  // o estado do dado privado (seção 4.4): só o que o `montar…` entregou, nunca uma frase da tela
  let estadoPrivado: PacoteModelo['privado']
  if (proprios.length === 0) estadoPrivado = { estado: 'na' }
  else if (privadas.length > 0) {
    const itens = [indicesPrivados.length ? 'views por dia do seu canal' : null, cartoesLidos ? 'impressões, cliques estimados, taxa de clique e % assistido' : null].filter((x): x is string => x !== null).join(' e ')
    estadoPrivado = { estado: 'incluido', itens }
    if (leituras.some((x) => x.diario === 'erro' || x.alcance === 'erro')) avisos.push(AVISO_PARCIAL)
  } else if (leituras.some((x) => x.diario === 'erro' || x.alcance === 'erro')) {
    estadoPrivado = { estado: 'excluido', motivo: 'leitura_falhou', itens: ITENS_EXCLUIDOS }
  } else if (privado.negativa === 'sem_direito') {
    estadoPrivado = { estado: 'excluido', motivo: 'sem_direito', itens: ITENS_EXCLUIDOS }
  } else {
    estadoPrivado = { estado: 'excluido', motivo: 'nao_conferido', itens: ITENS_EXCLUIDOS }
  }

  const comprimidas = modelo.comprimidas
  const definicoes: PacoteModelo['definicoes'] = definicoesDaTabela({ conjunto: modelo.conjunto, fora: modelo.fora, comprimidas }).map((d) => ({
    medida: `${d.termo}${d.depois}`.replace(/[:\s]+$/, ''), frase: d.frase, limiares: [],
  }))
  if (cartoesLidos > 0) for (const i of INFO_SO_SEU_CANAL.itens) definicoes.push({ medida: i.forte.replace(/:$/, ''), frase: i.texto, limiares: [], privado: true })

  // as duas janelas do "Views por dia nos longos" diferem quando só um dos lados é seu (a tela escreve o aviso)
  if (modelo.a.own !== modelo.b.own && modelo.linhas.some((l) => l.id === 'vpd')) {
    avisos.push(`As duas janelas de tempo são diferentes: 28 dias de um lado, desde ${modelo.serieDesde} do outro.`)
  }

  const naoMede = [NAO_MEDE_CAUSA, NAO_MEDE_CONCORRENTE]
  if (!modelo.linhas.some((l) => l.id === 'ritmo')) naoMede.unshift(NAO_MEDE_RITMO)

  return {
    tela: 'comparar',
    janela: modelo.conjunto.tipo === 'nicho'
      ? `últimos 90 dias · posições entre os canais de ${modelo.conjunto.label}`
      : 'últimos 90 dias · posições entre todos os canais do site',
    foco: lados.map(([, letra, c]) => ({ nome: c.name, oQueE: c.own ? 'seu canal' : 'concorrente', detalhe: detalheDoLado(c, letra) })),
    tabelas: [...publicas, ...leitura, ...privadas],
    citados: [],
    definicoes,
    avisos,
    ...(avisosPrivados.length ? { avisosPrivados } : {}),
    naoMede,
    privado: estadoPrivado,
    comentarios: { estado: 'na' },
    vazio: null,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}
