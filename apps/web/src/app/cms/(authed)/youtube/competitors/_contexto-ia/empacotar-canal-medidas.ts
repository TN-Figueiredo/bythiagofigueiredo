/**
 * A5 · E17 degrau 1, TG: os blocos de medida da página do canal do concorrente no pacote "Perguntar a uma IA" (estado e frase do topo, células de
 * medida, Direção, Ritmo, Lançamentos e Horas, Linha do tempo). Puro. `projetarMedidas` junta os MESMOS modelos que a página usa (`derivar`,
 * `fraseDoTopo`, `celulasDoCabecalho`, `blocoDeDirecao`...: nenhuma conta nova) e deixa só texto, como a tela o escreve; as tabelas saem daí.
 * Dado ausente sai como "não medido"/"não carregou" com o motivo da tela, nunca como 0.
 */
import { celulaAusente, ehMotivoDeFalha } from './celula-ausente'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { derivar, entradaDaFrase, type ContextoDoCanal } from '../_canal/medidas/canal-derivado'
import { celulasDoCabecalho } from '../_canal/medidas/cabecalho-model'
import { COM_FAIXA } from '../_canal/medidas/estado-model'
import { fraseDoTopo } from '../_canal/medidas/frase-do-topo'
import { blocoDeDirecao, type BlocoDeDirecao } from '../_canal/medidas/direcao-model'
import { blocoDeRitmo, type BlocoDeRitmo } from '../_canal/medidas/ritmo-model'
import { horasDoCanal, type ModeloDe72Horas, type ModeloDeLancamentos } from '../_canal/medidas/lancamentos-model'
import { linhaDoTempo, type LinhaDoTempo } from '../_canal/medidas/linha-do-tempo-model'
import type { ComentariosDoCanal } from '../_canal/medidas/comentarios-do-canal'
import { criadorComLeitura } from '../_canal/medidas/criador-do-canal'
import { FRASE_CRIADOR_NAO_PEDIDA } from '../_canal/medidas/criador-model'
import type { ModeloDaLista } from '../_canal/medidas/criador-lista-model'
import { dm, dmy, ptn } from '../_canal/medidas/formatos'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

// ───────────────────────── a projeção: só texto, na ordem da tela
export interface CelulaDeMedidaIa {
  chave: string
  rotulo: string
  /** O texto do valor como a célula o mostra; nulo = não medido ou não carregou (o `motivo` diz por quê). */
  valor: string | null
  zero: boolean
  motivo: string | null
  base: string
  aviso: string | null
}

/** O texto que a tela escreve quando a medida não chegou. */
const NAO_CARREGOU_TELA = 'falhou'
const NAO_MEDIDO_TELA = 'não medido'

export interface DirecaoIa {
  frase: string
  linhas: Array<{ chave: string; nome: string; sub: string; valor: string | null; motivo: string | null; numeros: string | null; avisos: string[] }>
  queda: {
    rotulo: string
    casas: Array<{ rotulo: string; valor: string | null; motivo: string | null }>
    veredito: { valor: string | null; motivo: string | null }
    nota: string | null
  }
}

export interface RitmoIa {
  frase: string
  cartoes: Array<{ chave: string; rotulo: string; valor: string | null; pequeno: string | null; motivo: string | null }>
  raias: Array<{ rotulo: string; ausente: string | null; casas: Array<{ semana: string; valor: string | null; zero: boolean; motivo: string | null }> }>
  ponteiro: { rotulo: string; dias: string; zero: boolean; limiteRotulo: string; limite: string; tipicoRotulo: string; tipico: string | null } | null
}

export interface LancamentosIa {
  /** A frase do bloco quando não há vídeo com normal para citar (não carregou, vazio, sem normal); nulo quando cada vídeo traz a sua frase. */
  rotulo: string
  frase: string | null
  motivo: string | null
  videos: Array<{
    titulo: string; legenda: string; razao: string | null; faixaNome: string; ultimoPonto: string | null
    /** A frase do vídeo cita o título dele: entra como texto de terceiros. */
    frase: string
  }>
  temNormal: boolean
  normal: Array<{ idade: string; videos: string }>
  semPonto: string | null
}

export interface HorasIa {
  rotulo: string
  frase: string | null
  aviso: string | null
  motivo: string | null
  marcos: Array<{ rotulo: string; valor: string }>
}

export interface LinhaDoTempoIa {
  frase: string
  motivo: string | null
  nota: string | null
  corte: string | null
  dias: Array<{ dia: string; views: string; situacao: string }>
  /** Cada evento cita o título de um vídeo: texto de terceiros. */
  eventos: Array<{ dia: string; texto: string }>
  raiasNaoCarregou: Array<{ nome: string; motivo: string }>
}

export interface ListaDoCriadorIa {
  tipo: 'nao_carregou' | 'vazia' | 'contagem' | 'itens'
  /** A frase da lista cita o nome do criador: texto de terceiros. */
  frase: string
  /** O aviso de quem vê só a contagem (ou a permissão não conferida). */
  aviso: string | null
  /** O título do vídeo, o comentário e a resposta do criador são texto de terceiros. O pacote leva TODOS os fios (a tela esconde, o pacote não corta). */
  grupos: Array<{ titulo: string; respostasDele: string; fios: Array<{ data: string | null; curtidas: string | null; texto: string; /** uma por linha: `dd/mm: texto`, ` …` quando cortada */ respostas: string }> }>
}

export interface CriadorIa {
  /** A frase do bloco cita o nome do criador: texto de terceiros. */
  frase: string
  pastilha: string | null
  legenda: string[]
  lista: ListaDoCriadorIa | null
  /** A casa sem valor nas tabelas (curtidas que a tela não mostra). */
  sem: string
}

export interface MedidasIa {
  criador: CriadorIa
  topo: { faixa: string | null; frase: string }
  celulas: CelulaDeMedidaIa[]
  direcao: DirecaoIa
  ritmo: RitmoIa
  lancamentos: LancamentosIa
  horas: HorasIa
  tempo: LinhaDoTempoIa
}

const progressoDaTela = (p: { feitos: number; total: number; fechaEm: string }, motivo: string): string => `${p.feitos} de ${p.total} dias · ${motivo}; passa a existir em ${dmy(p.fechaEm)}`

function direcaoIa(b: BlocoDeDirecao): DirecaoIa {
  return {
    frase: `${b.frase.negrito}${b.frase.resto}`,
    linhas: b.linhas.map((l) => {
      if (l.estado === 'medido') {
        const numeros = l.base.tipo === 'views' ? `${l.base.recente} views contra ${l.base.anterior}` : `${l.base.recente} contra ${l.base.anterior} views (${l.base.n} vídeos no total)`
        return { chave: l.chave, nome: l.nome, sub: l.sub, valor: l.texto, motivo: null, numeros, avisos: [...(l.foraDaEscala ? [`${l.foraDaEscala === 'acima' ? 'ou mais' : 'ou menos'}, fora da escala`] : []), ...(l.aviso ? [l.aviso] : []), ...(l.dica ? [l.dica] : [])] }
      }
      return { chave: l.chave, nome: l.nome, sub: l.sub, valor: null, motivo: l.estado === 'nao_carregou' ? NAO_CARREGOU_TELA : l.motivo, numeros: l.estado === 'progresso' ? progressoDaTela(l.progresso, l.motivo) : null, avisos: [] }
    }),
    queda: {
      rotulo: 'Queda sustentada',
      casas: b.queda.casas.map((c) => c.estado === 'medida'
        ? { rotulo: c.rotulo, valor: c.texto, motivo: null }
        : { rotulo: c.rotulo, valor: null, motivo: c.estado === 'ainda_nao_existe' ? 'ainda não existe' : NAO_MEDIDO_TELA }),
      // a pastilha da tela diz só "não medido"; o motivo está na frase de baixo (progresso: a barra com a data; sem leitura: o motivo) e é ele que vai na célula
      veredito: b.queda.estado === 'medida'
        ? { valor: b.queda.emQueda ? 'Em queda sustentada' : 'Fora da queda', motivo: null }
        : { valor: null, motivo: b.queda.estado === 'nao_carregou' ? NAO_CARREGOU_TELA : b.queda.motivo },
      nota: b.queda.estado === 'progresso' ? progressoDaTela(b.queda.progresso, b.queda.motivo) : b.queda.estado === 'nao_carregou' ? b.queda.motivo : null,
    },
  }
}

function ritmoIa(b: BlocoDeRitmo, semanas: number): RitmoIa {
  const p = b.ponteiro
  return {
    frase: `${b.frase.negrito}${b.frase.resto}`,
    cartoes: b.cartoes.map((c) => c.valor.tipo === 'medido'
      ? { chave: c.chave, rotulo: c.rotulo, valor: c.valor.texto, pequeno: c.valor.pequeno, motivo: null }
      : { chave: c.chave, rotulo: c.rotulo, valor: null, pequeno: null, motivo: c.valor.tipo === 'nao_carregou' ? NAO_CARREGOU_TELA : c.valor.motivo }),
    raias: b.raias.map((r) => ({
      rotulo: r.rotulo,
      ausente: r.ausente ? `nenhum ${r.rotulo === 'Longos' ? 'vídeo longo' : 'Short'} nas ${semanas} semanas` : null,
      casas: r.ausente ? [] : r.casas.map((c, k) => ({
        semana: k === r.casas.length - 1 ? b.eixoFim : `há ${r.casas.length - k} semanas`,
        valor: c.estado === 'com' ? String(c.n) : c.estado === 'zero' ? '0' : null, zero: c.estado === 'zero', motivo: c.estado === 'nao_lida' ? c.por : null,
      })),
    })),
    ponteiro: p === null ? null : {
      dias: `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'}`, zero: p.dias === 0,
      rotulo: `Dias ${p.rotulo}${p.ate ? `, até ${dm(p.ate)}` : p.pelaBusca ? ', pelo que já foi buscado' : ''}`,
      limiteRotulo: 'Limite para parado', limite: `${p.limite} d`, tipicoRotulo: 'Intervalo típico', tipico: p.tipico !== null && p.tipico < p.limite ? `${Math.round(p.tipico)} d` : null,
    },
  }
}

const UNIDADE: Record<string, string> = { ritmo: ' (por semana)' }

function lancamentosIa(m: ModeloDeLancamentos): LancamentosIa {
  if (m.tipo === 'nao_carregou') return { rotulo: 'Lançamentos', frase: null, motivo: m.motivo, videos: [], temNormal: false, normal: [], semPonto: null }
  if (m.tipo === 'vazio') return { rotulo: 'Lançamentos', frase: `${m.frase}${m.explicacao}`, motivo: null, videos: [], temNormal: false, normal: [], semPonto: null }
  return {
    rotulo: 'Lançamentos', frase: m.temNormal ? null : `${m.frase!.negrito}${m.frase!.resto}`, motivo: null, temNormal: m.temNormal,
    videos: m.videos.map((v) => ({ titulo: v.titulo, legenda: v.legenda, razao: v.razao, faixaNome: v.faixaNome, ultimoPonto: v.ultimoPonto?.texto ?? null, frase: `${v.frase.negrito}${v.frase.resto}` })),
    normal: m.normal.flatMap((p) => (p.n === null ? [] : [{ idade: `dia ${p.idadeDias}`, videos: ptn(p.n, 'vídeo', 'vídeos') }])),
    semPonto: m.temNormal && m.temCasaSemPonto ? 'menos de 3 vídeos: sem ponto' : null,
  }
}

function horasIa(m: ModeloDe72Horas): HorasIa {
  if (m.tipo !== 'medido') return { rotulo: 'Primeiras 72 horas', frase: null, aviso: null, motivo: m.motivo, marcos: [] }
  const h = (n: number): string => `${n} ${n === 1 ? 'hora' : 'horas'} depois de publicar`
  return {
    rotulo: 'Primeiras 72 horas', frase: `${m.frase.negrito}${m.frase.resto}`, aviso: m.aviso, motivo: null,
    marcos: [{ rotulo: '1/4 das views', valor: h(m.umQuarto) }, { rotulo: '1/2 das views', valor: h(m.metade) }, { rotulo: '3/4 das views', valor: h(m.tresQuartos) }],
  }
}

const NOMES_DAS_RAIAS = { videos: 'Vídeos', campos: 'Campos', trocas: 'Trocas' } as const

function tempoIa(t: LinhaDoTempo): LinhaDoTempoIa {
  const b = t.barras
  return {
    frase: `${t.frase.negrito}${t.frase.resto}`,
    motivo: b.tipo === 'dias' ? null : b.motivo, nota: b.tipo === 'dias' ? b.nota : null,
    corte: t.legenda.find((l) => l.chave === 'corte')?.texto ?? null,
    dias: t.tabela.map(([dia, views, situacao]) => ({ dia, views, situacao })),
    eventos: t.tabela.flatMap(([dia, , , aconteceu]) => (aconteceu === '' ? [] : [{ dia, texto: aconteceu }])),
    raiasNaoCarregou: (['videos', 'campos', 'trocas'] as const).flatMap((r) => (t.raias[r].tipo === 'nao_carregou' ? [{ nome: NOMES_DAS_RAIAS[r], motivo: NAO_CARREGOU_TELA }] : [])),
  }
}

function listaIa(m: ModeloDaLista): ListaDoCriadorIa {
  const fr = (f: { negrito: string; resto: string }): string => `${f.negrito}${f.resto}`
  if (m.tipo === 'itens') {
    // as datas vêm prontas do modelo da tela (`dmDeData`, fuso de São Paulo); o pacote não as recalcula
    return {
      tipo: 'itens', frase: fr(m.frase), aviso: null,
      grupos: m.grupos.map((g) => ({
        titulo: g.titulo, respostasDele: g.respostasDele,
        fios: g.fios.map((f) => ({
          data: f.raiz.data, curtidas: f.meta.curtidas, texto: `${f.raiz.texto ?? ''}${f.raiz.cortado ? ' …' : ''}`,
          respostas: f.respostas.map((x) => `${x.data ? `${x.data}: ` : ''}${x.texto ?? ''}${x.cortado ? ' …' : ''}`).join('\n'),
        })),
      })),
    }
  }
  // sem texto de comentário em nenhum outro tipo (a contagem não o carrega)
  return { tipo: m.tipo, frase: fr(m.frase), aviso: m.tipo === 'contagem' ? fr(m.aviso) : null, grupos: [] }
}

/** O bloco do criador como a tela o escreve; sem leitura pedida, a frase e a pastilha da tela "não pedida". */
function criadorIa(ctx: ContextoDoCanal, d: ReturnType<typeof derivar>, lidos: ComentariosDoCanal | null): { ia: CriadorIa; celula: Parameters<typeof celulasDoCabecalho>[0]['criador'] } {
  const k = ctx.comentarios
  if (!k) {
    return { ia: { frase: 'Ainda não dá para dizer se o criador responde.', pastilha: FRASE_CRIADOR_NAO_PEDIDA, legenda: [], lista: null, sem: '—' }, celula: undefined }
  }
  const { modelo, lista } = criadorComLeitura(k, ctx, d, lidos ?? { contagem: null, respostas: null })
  const b = modelo.bloco
  const semMedida = b.tipo === 'nao_medido' || b.tipo === 'desligados' || b.tipo === 'fora'
  return {
    celula: modelo.celula,
    ia: { frase: `${b.frase.negrito}${b.frase.resto}`, pastilha: semMedida ? b.pastilha : null, legenda: b.legenda.map((l) => l.texto), lista: lista ? listaIa(lista) : null, sem: '—' },
  }
}

export function projetarMedidas(c: CanalInteiro, ctx: ContextoDoCanal, comentarios: ComentariosDoCanal | null = null): MedidasIa {
  const d = derivar(ctx, c)
  const cr = criadorIa(ctx, d, comentarios)
  const frase = fraseDoTopo(entradaDaFrase(ctx, d))
  const celulas = celulasDoCabecalho({
    F: ctx.F, subs: ctx.subs, medidas: d.medidas, formato: d.formato, estado: d.estado, extras: { missingSince: null },
    semVideos: ctx.semVideos, hojeSP: ctx.hojeSP,
    criador: cr.celula,
  }).filter((x) => x.chave !== 'inscritos')
  const direcao = blocoDeDirecao({ F: ctx.F, medidas: d.medidas, soShorts: d.formato.soShorts, estado: d.estado, hojeSP: ctx.hojeSP })
  const ritmo = blocoDeRitmo({ medidas: d.medidas, videos: d.videos, formato: d.formato, estado: d.estado, ultimaLeituraMs: ctx.sync.last, agoraMs: ctx.agoraMs, hojeSP: ctx.hojeSP })
  const horasLidas = c.horas !== 'nao_pedida' && c.horas.lido ? c.horas.dados : null
  const tempo = linhaDoTempo({
    F: ctx.F, medidas: d.medidas, retratos: c.retratos.lido ? c.retratos.dados : null, videos: d.videos,
    mudancas: c.mudancas !== 'nao_pedida' && c.mudancas.lido ? c.mudancas.dados : null,
    trocas: ctx.trocas, titulos: d.titulos, estado: d.estado, formato: d.formato,
    foraEm: d.estado.tipo === 'saiu' ? d.estado.ate : null, hojeSP: ctx.hojeSP,
  })
  return {
    criador: cr.ia, direcao: direcaoIa(direcao), ritmo: ritmoIa(ritmo, MEASURE_RULES.rhythm.weeks),
    lancamentos: lancamentosIa(d.lanc.modelo), horas: horasIa(horasDoCanal({ videos: d.videos, horas: horasLidas, formato: d.formato, agoraMs: ctx.agoraMs })), tempo: tempoIa(tempo),
    topo: { faixa: COM_FAIXA.has(d.estado.tipo) ? d.estado.pastilha : null, frase: frase.texto },
    celulas: celulas.map((x): CelulaDeMedidaIa => {
      const det = x.detalhe
      let valor: string | null = null
      if (x.valor === 'medido' || x.valor === 'zero') {
        if (det.chave === 'direcao' && det.direcao.tipo === 'medido') valor = det.direcao.texto
        else if (det.chave === 'estado') valor = det.estado.pastilha
        else if (det.chave === 'criador' && det.k !== null && det.n !== null) valor = `${det.k} de ${det.n}${det.pct === null ? '' : ` (${det.pct}%)`}`
        else if (det.chave === 'acerto') valor = `${det.k} de ${det.n}${det.pct === null ? '' : ` (${det.pct}%)`}`
        else if (det.chave === 'ritmo') valor = det.porSemana
      }
      return {
        chave: x.chave, rotulo: x.rotulo + (UNIDADE[x.chave] ?? ''), valor, zero: x.valor === 'zero', motivo: valor === null ? x.motivo : null, base: x.base,
        // a mesma frase que a célula escreve (a data é a da mudança de contagem, não a do aviso)
        aviso: det.chave === 'direcao' && det.avisoAte ? `ainda cruza a mudança de ${dm(MEASURE_RULES.countChange)}` : null,
      }
    }),
  }
}

// ───────────────────────── o inventário das folhas (prefixo `derivado.medidas.`)
const ID = { descartado: 'identificador' } as const
const CTRL = { descartado: 'controle de tela' } as const

export const INVENTARIO_MEDIDAS_CANAL: Inventario = {
  'derivado.medidas.topo.faixa': 'base', 'derivado.medidas.topo.frase': 'terceiros', // a oração do último vídeo cita o título dele: entra como texto de terceiros
  'derivado.medidas.celulas[].chave': ID, 'derivado.medidas.celulas[].rotulo': 'rotulo', 'derivado.medidas.celulas[].valor': 'numero',
  'derivado.medidas.celulas[].zero': CTRL, 'derivado.medidas.celulas[].motivo': 'motivo', 'derivado.medidas.celulas[].base': 'base', 'derivado.medidas.celulas[].aviso': 'base',

  // Direção
  'derivado.medidas.direcao.frase': 'base',
  'derivado.medidas.direcao.linhas[].chave': ID, 'derivado.medidas.direcao.linhas[].nome': 'rotulo', 'derivado.medidas.direcao.linhas[].sub': 'base',
  'derivado.medidas.direcao.linhas[].valor': 'numero', 'derivado.medidas.direcao.linhas[].motivo': 'motivo', 'derivado.medidas.direcao.linhas[].numeros': 'base',
  'derivado.medidas.direcao.linhas[].avisos[]': 'base',
  'derivado.medidas.direcao.queda.rotulo': 'rotulo', 'derivado.medidas.direcao.queda.casas[].rotulo': 'rotulo', 'derivado.medidas.direcao.queda.casas[].valor': 'numero', 'derivado.medidas.direcao.queda.casas[].motivo': 'motivo',
  'derivado.medidas.direcao.queda.veredito.valor': 'numero', 'derivado.medidas.direcao.queda.veredito.motivo': 'motivo', 'derivado.medidas.direcao.queda.nota': 'base',

  // Lançamentos
  'derivado.medidas.lancamentos.rotulo': 'rotulo', 'derivado.medidas.lancamentos.frase': 'base', 'derivado.medidas.lancamentos.motivo': 'motivo', 'derivado.medidas.lancamentos.temNormal': CTRL,
  'derivado.medidas.lancamentos.videos[].titulo': 'terceiros', 'derivado.medidas.lancamentos.videos[].legenda': 'base', 'derivado.medidas.lancamentos.videos[].razao': 'numero',
  'derivado.medidas.lancamentos.videos[].faixaNome': 'base', 'derivado.medidas.lancamentos.videos[].ultimoPonto': 'numero', 'derivado.medidas.lancamentos.videos[].frase': 'terceiros',
  'derivado.medidas.lancamentos.normal[].idade': 'rotulo', 'derivado.medidas.lancamentos.normal[].videos': 'numero', 'derivado.medidas.lancamentos.semPonto': 'base',

  // as 72 horas
  'derivado.medidas.horas.rotulo': 'rotulo', 'derivado.medidas.horas.frase': 'base', 'derivado.medidas.horas.aviso': 'base', 'derivado.medidas.horas.motivo': 'motivo',
  'derivado.medidas.horas.marcos[].rotulo': 'rotulo', 'derivado.medidas.horas.marcos[].valor': 'numero',

  // Linha do tempo
  'derivado.medidas.tempo.frase': 'base', 'derivado.medidas.tempo.motivo': 'base', 'derivado.medidas.tempo.nota': 'base', 'derivado.medidas.tempo.corte': 'base',
  'derivado.medidas.tempo.dias[].dia': 'rotulo', 'derivado.medidas.tempo.dias[].views': 'numero', 'derivado.medidas.tempo.dias[].situacao': 'base',
  'derivado.medidas.tempo.eventos[].dia': 'rotulo', 'derivado.medidas.tempo.eventos[].texto': 'terceiros', 'derivado.medidas.tempo.raiasNaoCarregou[].nome': 'rotulo', 'derivado.medidas.tempo.raiasNaoCarregou[].motivo': 'motivo',

  // O que o criador respondeu
  'derivado.medidas.criador.frase': 'terceiros', 'derivado.medidas.criador.pastilha': 'base', 'derivado.medidas.criador.legenda[]': 'base', 'derivado.medidas.criador.sem': 'rotulo',
  'derivado.medidas.criador.lista': CTRL, 'derivado.medidas.criador.lista.tipo': CTRL, 'derivado.medidas.criador.lista.frase': 'terceiros', 'derivado.medidas.criador.lista.aviso': 'base',
  'derivado.medidas.criador.lista.grupos[].titulo': 'terceiros', 'derivado.medidas.criador.lista.grupos[].respostasDele': 'base',
  'derivado.medidas.criador.lista.grupos[].fios[].data': 'base', 'derivado.medidas.criador.lista.grupos[].fios[].curtidas': 'base',
  'derivado.medidas.criador.lista.grupos[].fios[].texto': 'terceiros', 'derivado.medidas.criador.lista.grupos[].fios[].respostas': 'terceiros',

  // Ritmo
  'derivado.medidas.ritmo.frase': 'base',
  'derivado.medidas.ritmo.cartoes[].chave': ID, 'derivado.medidas.ritmo.cartoes[].rotulo': 'rotulo', 'derivado.medidas.ritmo.cartoes[].valor': 'numero',
  'derivado.medidas.ritmo.cartoes[].pequeno': 'base', 'derivado.medidas.ritmo.cartoes[].motivo': 'motivo',
  'derivado.medidas.ritmo.raias[].rotulo': 'rotulo', 'derivado.medidas.ritmo.raias[].ausente': 'base',
  'derivado.medidas.ritmo.raias[].casas[].semana': 'rotulo', 'derivado.medidas.ritmo.raias[].casas[].valor': 'numero',
  'derivado.medidas.ritmo.raias[].casas[].zero': CTRL, 'derivado.medidas.ritmo.raias[].casas[].motivo': 'motivo',
  'derivado.medidas.ritmo.ponteiro': CTRL, 'derivado.medidas.ritmo.ponteiro.rotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.dias': 'numero', 'derivado.medidas.ritmo.ponteiro.zero': CTRL,
  'derivado.medidas.ritmo.ponteiro.limiteRotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.limite': 'numero',
  'derivado.medidas.ritmo.ponteiro.tipicoRotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.tipico': 'numero',
}

// ───────────────────────── células
const O = 'modelo.derivado.medidas'
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string, zero = false): Celula => (zero ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
// Decisão 75: o modelo marca o bloco que não chegou com o motivo `falhou` (NAO_CARREGOU_TELA); no pacote isso é a célula `falhou`, nunca "não medido".
const naoMedido = (motivo: string | null, origem: string): Celula => celulaAusente(ehMotivoDeFalha(motivo) ? 'falhou' : 'nao_medido', motivo, origem)

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })

/** As tabelas e os avisos dos blocos de medida; vazio quando as medidas não foram pedidas ao empacotador. */
export function tabelasDeMedidas(m: MedidasIa | null): { tabelas: Tabela[]; avisos: string[] } {
  if (m === null) return { tabelas: [], avisos: [] }
  const tabelas: Tabela[] = [tabelaFixa('canal-frase-do-topo', 'A frase do topo da página', 'frase do topo', ['Frase'], [[terceiros(m.topo.frase, `${O}.topo.frase`)]])]
  if (m.celulas.length) {
    tabelas.push(tabelaFixa('canal-medidas-celulas', 'Direção, estado, acerto e ritmo do canal', 'direção, estado, acerto e ritmo', ['Medida', 'Valor', 'Base'],
      m.celulas.map((c, i) => [
        rotulo(c.rotulo, `${O}.celulas[${i}].rotulo`),
        c.valor !== null ? medido(c.valor, `${O}.celulas[${i}].valor`, c.zero) : naoMedido(c.motivo, `${O}.celulas[${i}].motivo`),
        base(c.base, `${O}.celulas[${i}].base`),
      ])))
    const avisos = m.celulas.flatMap((c, i) => (c.aviso ? [[i, c.aviso] as const] : []))
    if (avisos.length) {
      tabelas.push(tabelaFixa('canal-medidas-avisos', 'Avisos das medidas do canal', 'avisos das medidas', ['Medida', 'Aviso'],
        avisos.map(([i, a]) => [rotulo(m.celulas[i]!.rotulo, `${O}.celulas[${i}].rotulo`), base(a, `${O}.celulas[${i}].aviso`)])))
    }
  }
  const D = `${O}.direcao`
  const dir = m.direcao
  const valorOuMotivo = (valor: string | null, motivo: string | null, ov: string, om: string, zero = false): Celula => (valor !== null ? medido(valor, ov, zero) : naoMedido(motivo, om))
  tabelas.push(tabelaFixa('canal-direcao', 'Para onde o canal anda: as três leituras', 'direção do canal', ['Leitura', 'Valor', 'O que compara'],
    dir.linhas.map((l, i) => [rotulo(l.nome, `${D}.linhas[${i}].nome`), valorOuMotivo(l.valor, l.motivo, `${D}.linhas[${i}].valor`, `${D}.linhas[${i}].motivo`), base(l.sub, `${D}.linhas[${i}].sub`)])))
  const comNumeros = dir.linhas.flatMap((l, i) => (l.numeros !== null ? [[i, l.numeros] as const] : []))
  if (comNumeros.length) {
    tabelas.push(tabelaFixa('canal-direcao-numeros', 'Direção: os números de cada leitura', 'números da direção', ['Leitura', 'Números'],
      comNumeros.map(([i, n]) => [rotulo(dir.linhas[i]!.nome, `${D}.linhas[${i}].nome`), base(n, `${D}.linhas[${i}].numeros`)])))
  }
  const avisosDir = dir.linhas.flatMap((l, i) => l.avisos.map((a, k) => [i, k, a] as const))
  if (avisosDir.length) {
    tabelas.push(tabelaFixa('canal-direcao-avisos', 'Direção: avisos de cada leitura', 'avisos da direção', ['Leitura', 'Aviso'],
      avisosDir.map(([i, k, a]) => [rotulo(dir.linhas[i]!.nome, `${D}.linhas[${i}].nome`), base(a, `${D}.linhas[${i}].avisos[${k}]`)])))
  }
  tabelas.push(tabelaFixa('canal-direcao-queda', 'Queda sustentada: as três janelas de 28 dias', 'queda sustentada', ['Janela', 'Valor'], [
    ...dir.queda.casas.map((c, i) => [rotulo(c.rotulo, `${D}.queda.casas[${i}].rotulo`), valorOuMotivo(c.valor, c.motivo, `${D}.queda.casas[${i}].valor`, `${D}.queda.casas[${i}].motivo`)]),
    [rotulo(dir.queda.rotulo, `${D}.queda.rotulo`), valorOuMotivo(dir.queda.veredito.valor, dir.queda.veredito.motivo, `${D}.queda.veredito.valor`, `${D}.queda.veredito.motivo`)],
  ]))
  const R = `${O}.ritmo`
  const rit = m.ritmo
  tabelas.push(tabelaFixa('canal-ritmo', 'Ritmo e regularidade', 'ritmo e regularidade', ['Medida', 'Valor'],
    rit.cartoes.map((c, i) => [rotulo(c.rotulo, `${R}.cartoes[${i}].rotulo`), valorOuMotivo(c.valor, c.motivo, `${R}.cartoes[${i}].valor`, `${R}.cartoes[${i}].motivo`)])))
  const comPequeno = rit.cartoes.flatMap((c, i) => (c.pequeno !== null ? [[i, c.pequeno] as const] : []))
  if (comPequeno.length) {
    tabelas.push(tabelaFixa('canal-ritmo-detalhes', 'Ritmo: o detalhe de cada medida', 'detalhes do ritmo', ['Medida', 'Detalhe'],
      comPequeno.map(([i, t]) => [rotulo(rit.cartoes[i]!.rotulo, `${R}.cartoes[${i}].rotulo`), base(t, `${R}.cartoes[${i}].pequeno`)])))
  }
  const semanas: Celula[][] = rit.raias.flatMap((r, i) => r.casas.map((c, k): Celula[] => [
    rotulo(r.rotulo, `${R}.raias[${i}].rotulo`), rotulo(c.semana, `${R}.raias[${i}].casas[${k}].semana`),
    valorOuMotivo(c.valor, c.motivo, `${R}.raias[${i}].casas[${k}].valor`, `${R}.raias[${i}].casas[${k}].motivo`, c.zero),
  ]))
  if (semanas.length) tabelas.push({ id: 'canal-ritmo-semanas', titulo: `Publicações por semana, das ${MEASURE_RULES.rhythm.weeks} últimas semanas`, tipo: 'lista', nomeNoCorte: 'publicações por semana', privada: false, colunas: ['Formato', 'Semana', 'Publicações'], linhas: semanas })
  const pt = rit.ponteiro
  if (pt) {
    tabelas.push(tabelaFixa('canal-ritmo-parado', 'Dias sem publicar contra o limite de parado', 'dias sem publicar', ['Medida', 'Valor'], [
      [rotulo(pt.rotulo, `${R}.ponteiro.rotulo`), medido(pt.dias, `${R}.ponteiro.dias`, pt.zero)],
      [rotulo(pt.limiteRotulo, `${R}.ponteiro.limiteRotulo`), medido(pt.limite, `${R}.ponteiro.limite`)],
      ...(pt.tipico !== null ? [[rotulo(pt.tipicoRotulo, `${R}.ponteiro.tipicoRotulo`), medido(pt.tipico, `${R}.ponteiro.tipico`)]] : []),
    ]))
  }
  const L = `${O}.lancamentos`
  const lan = m.lancamentos
  if (lan.videos.length) {
    tabelas.push({ id: 'canal-lancamentos', titulo: 'Lançamentos: os vídeos recentes com contagem por vídeo', tipo: 'lista', nomeNoCorte: 'lançamentos', privada: false, colunas: ['Vídeo', 'Quando saiu'],
      linhas: lan.videos.map((v, i) => [terceiros(v.titulo, `${L}.videos[${i}].titulo`), base(v.legenda, `${L}.videos[${i}].legenda`)]) })
    if (lan.temNormal) {
      tabelas.push({ id: 'canal-lancamentos-normal', titulo: 'Lançamentos: contra o normal do canal', tipo: 'lista', nomeNoCorte: 'lançamentos contra o normal', privada: false, colunas: ['Vídeo', 'Contra o normal', 'Faixa'],
        linhas: lan.videos.map((v, i) => [terceiros(v.titulo, `${L}.videos[${i}].titulo`), v.razao !== null ? medido(v.razao, `${L}.videos[${i}].razao`) : naoMedido('sem normal', `${L}.videos[${i}].razao`), base(v.faixaNome, `${L}.videos[${i}].faixaNome`)]) })
      tabelas.push({ id: 'canal-lancamentos-frases', titulo: 'Lançamentos: a frase de cada vídeo', tipo: 'lista', nomeNoCorte: 'frases dos lançamentos', privada: false, colunas: ['Frase'],
        linhas: lan.videos.map((v, i) => [terceiros(v.frase, `${L}.videos[${i}].frase`)]) })
      if (lan.normal.length) {
        tabelas.push(tabelaFixa('canal-lancamentos-base', 'Lançamentos: quantos vídeos entram em cada ponto do normal', 'base do normal', ['Idade', 'Vídeos'],
          lan.normal.map((p, i) => [rotulo(p.idade, `${L}.normal[${i}].idade`), medido(p.videos, `${L}.normal[${i}].videos`)])))
      }
    } else {
      tabelas.push({ id: 'canal-lancamentos-ultimo-ponto', titulo: 'Lançamentos: views no último ponto medido de cada vídeo', tipo: 'lista', nomeNoCorte: 'último ponto dos lançamentos', privada: false, colunas: ['Vídeo', 'Views no último ponto medido'],
        linhas: lan.videos.map((v, i) => [terceiros(v.titulo, `${L}.videos[${i}].titulo`), v.ultimoPonto !== null ? medido(v.ultimoPonto, `${L}.videos[${i}].ultimoPonto`) : naoMedido('sem ponto medido', `${L}.videos[${i}].ultimoPonto`)]) })
    }
  }
  if (lan.motivo !== null) tabelas.push(tabelaFixa('canal-lancamentos-estado', 'Lançamentos', 'lançamentos', ['Medida', 'Valor'], [[rotulo(lan.rotulo, `${L}.rotulo`), naoMedido(lan.motivo, `${L}.motivo`)]]))
  const H = `${O}.horas`
  const hor = m.horas
  tabelas.push(tabelaFixa('canal-horas', 'As primeiras 72 horas do canal', 'primeiras 72 horas', ['Medida', 'Valor'],
    hor.motivo !== null
      ? [[rotulo(hor.rotulo, `${H}.rotulo`), naoMedido(hor.motivo, `${H}.motivo`)]]
      : hor.marcos.map((x, i) => [rotulo(x.rotulo, `${H}.marcos[${i}].rotulo`), medido(x.valor, `${H}.marcos[${i}].valor`)])))
  const T = `${O}.tempo`
  const tem = m.tempo
  if (tem.dias.length) {
    tabelas.push({ id: 'canal-linha-do-tempo', titulo: 'Linha do tempo: views ganhas por dia, do dia mais recente ao mais antigo', tipo: 'dia_a_dia', nomeNoCorte: 'views por dia do canal', privada: false, colunas: ['Dia', 'Views ganhas', 'Situação'],
      linhas: tem.dias.map((d, i) => [rotulo(d.dia, `${T}.dias[${i}].dia`), d.views === 'sem registro' ? naoMedido(d.situacao !== 'sem registro' ? d.situacao : 'sem registro', `${T}.dias[${i}].views`) : medido(d.views, `${T}.dias[${i}].views`, d.views === '0'), base(d.situacao, `${T}.dias[${i}].situacao`)]) })
  }
  if (tem.eventos.length) {
    tabelas.push({ id: 'canal-linha-do-tempo-eventos', titulo: 'Linha do tempo: o que aconteceu em cada dia', tipo: 'lista', nomeNoCorte: 'o que aconteceu por dia', privada: false, colunas: ['Dia', 'O que aconteceu'],
      linhas: tem.eventos.map((e, i) => [rotulo(e.dia, `${T}.eventos[${i}].dia`), terceiros(e.texto, `${T}.eventos[${i}].texto`)]) })
  }
  if (tem.raiasNaoCarregou.length) {
    tabelas.push(tabelaFixa('canal-linha-do-tempo-raias', 'Linha do tempo: raias em que a leitura falhou', 'raias da linha do tempo', ['Raia', 'Estado'],
      tem.raiasNaoCarregou.map((r, i) => [rotulo(r.nome, `${T}.raiasNaoCarregou[${i}].nome`), naoMedido(r.motivo, `${T}.raiasNaoCarregou[${i}].motivo`)])))
  }
  const K = `${O}.criador`
  const cri = m.criador
  tabelas.push({ id: 'canal-criador-frases', titulo: 'O que o criador respondeu: as frases do bloco e da lista', tipo: 'lista', nomeNoCorte: 'frases do criador', privada: false, colunas: ['Frase'],
    linhas: [...(cri.lista ? [[terceiros(cri.lista.frase, `${K}.lista.frase`)]] : []), [terceiros(cri.frase, `${K}.frase`)]] })
  if (cri.lista && cri.lista.grupos.length) {
    // uma linha por fio, na ordem da tela (vídeo mais novo primeiro): o corte por degraus do pacote age sobre as linhas
    tabelas.push({ id: 'canal-criador-respostas', titulo: 'O que o criador respondeu: as respostas guardadas, do vídeo mais recente ao mais antigo', tipo: 'lista', nomeNoCorte: 'respostas do criador', privada: false,
      colunas: ['Vídeo', 'Respostas dele no vídeo', 'Data', 'Curtidas do comentário', 'Comentário', 'Respostas do criador'],
      linhas: cri.lista.grupos.flatMap((g, gi) => g.fios.map((f, fi): Celula[] => {
        const F = `${K}.lista.grupos[${gi}]`
        return [
          terceiros(g.titulo, `${F}.titulo`), base(g.respostasDele, `${F}.respostasDele`), f.data !== null ? base(f.data, `${F}.fios[${fi}].data`) : rotulo(cri.sem, `${K}.sem`),
          f.curtidas !== null ? base(f.curtidas, `${F}.fios[${fi}].curtidas`) : rotulo(cri.sem, `${K}.sem`),
          terceiros(f.texto, `${F}.fios[${fi}].texto`), terceiros(f.respostas.split('\n').join(' · '), `${F}.fios[${fi}].respostas`),
        ]
      })) })
  }
  const avisosDoCriador = [cri.pastilha, ...cri.legenda, cri.lista?.aviso ?? null].flatMap((x) => (x === null ? [] : [x]))
  const avisosDoBloco = [...avisosDoCriador, lan.frase, lan.semPonto, hor.frase, hor.aviso, tem.frase, tem.motivo, tem.nota, tem.corte].flatMap((x) => (x === null ? [] : [x]))
  const ausentes = rit.raias.flatMap((r) => (r.ausente ? [r.ausente] : []))
  return { tabelas, avisos: [...(m.topo.faixa ? [m.topo.faixa] : []), dir.frase, ...(dir.queda.nota ? [dir.queda.nota] : []), rit.frase, ...ausentes, ...avisosDoBloco] }
}
