/**
 * A5 · E17 degrau 1, TG: os blocos de medida da página do canal do concorrente no pacote "Perguntar a uma IA" (estado e frase do topo, células de
 * medida, Direção, Ritmo, Lançamentos e Horas, Linha do tempo). Puro. `projetarMedidas` junta os MESMOS modelos que a página usa (`derivar`,
 * `fraseDoTopo`, `celulasDoCabecalho`, `blocoDeDirecao`...: nenhuma conta nova) e deixa só texto, como a tela o escreve; as tabelas saem daí.
 * Dado ausente sai como "não medido"/"não carregou" com o motivo da tela, nunca como 0.
 */
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import { derivar, entradaDaFrase, type ContextoDoCanal } from '../_canal/medidas/canal-derivado'
import { celulasDoCabecalho } from '../_canal/medidas/cabecalho-model'
import { COM_FAIXA } from '../_canal/medidas/estado-model'
import { fraseDoTopo } from '../_canal/medidas/frase-do-topo'
import { blocoDeDirecao, type BlocoDeDirecao } from '../_canal/medidas/direcao-model'
import { blocoDeRitmo, type BlocoDeRitmo } from '../_canal/medidas/ritmo-model'
import { dm, dmy } from '../_canal/medidas/formatos'
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
const NAO_CARREGOU_TELA = 'Não carregou'
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
  ponteiro: { rotulo: string; dias: string; limiteRotulo: string; limite: string; tipicoRotulo: string; tipico: string | null } | null
}

export interface MedidasIa {
  topo: { faixa: string | null; frase: string }
  celulas: CelulaDeMedidaIa[]
  direcao: DirecaoIa
  ritmo: RitmoIa
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
      return { chave: l.chave, nome: l.nome, sub: l.sub, valor: null, motivo: l.motivo, numeros: l.estado === 'progresso' ? progressoDaTela(l.progresso, l.motivo) : null, avisos: [] }
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
      dias: `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'}`,
      rotulo: `Dias ${p.rotulo}${p.ate ? `, até ${dm(p.ate)}` : p.pelaBusca ? ', pelo que já foi buscado' : ''}`,
      limiteRotulo: 'Limite para parado', limite: `${p.limite} d`, tipicoRotulo: 'Intervalo típico', tipico: p.tipico !== null && p.tipico < p.limite ? `${Math.round(p.tipico)} d` : null,
    },
  }
}

const UNIDADE: Record<string, string> = { ritmo: ' (por semana)' }

export function projetarMedidas(c: CanalInteiro, ctx: ContextoDoCanal): MedidasIa {
  const d = derivar(ctx, c)
  const frase = fraseDoTopo(entradaDaFrase(ctx, d))
  const celulas = celulasDoCabecalho({
    F: ctx.F, subs: ctx.subs, medidas: d.medidas, formato: d.formato, estado: d.estado, extras: { missingSince: null },
    semVideos: ctx.semVideos, hojeSP: ctx.hojeSP,
    // PENDENTE: a célula "Criador responde" entra com o bloco do criador (leitura dos comentários)
  }).filter((x) => x.chave !== 'inscritos' && x.chave !== 'criador')
  const direcao = blocoDeDirecao({ F: ctx.F, medidas: d.medidas, soShorts: d.formato.soShorts, estado: d.estado, hojeSP: ctx.hojeSP })
  const ritmo = blocoDeRitmo({ medidas: d.medidas, videos: d.videos, formato: d.formato, estado: d.estado, ultimaLeituraMs: ctx.sync.last, agoraMs: ctx.agoraMs, hojeSP: ctx.hojeSP })
  return {
    direcao: direcaoIa(direcao), ritmo: ritmoIa(ritmo, MEASURE_RULES.rhythm.weeks),
    topo: { faixa: COM_FAIXA.has(d.estado.tipo) ? d.estado.pastilha : null, frase: frase.texto },
    celulas: celulas.map((x): CelulaDeMedidaIa => {
      const det = x.detalhe
      let valor: string | null = null
      if (x.valor === 'medido' || x.valor === 'zero') {
        if (det.chave === 'direcao' && det.direcao.tipo === 'medido') valor = det.direcao.texto
        else if (det.chave === 'estado') valor = det.estado.pastilha
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

  // Ritmo
  'derivado.medidas.ritmo.frase': 'base',
  'derivado.medidas.ritmo.cartoes[].chave': ID, 'derivado.medidas.ritmo.cartoes[].rotulo': 'rotulo', 'derivado.medidas.ritmo.cartoes[].valor': 'numero',
  'derivado.medidas.ritmo.cartoes[].pequeno': 'base', 'derivado.medidas.ritmo.cartoes[].motivo': 'motivo',
  'derivado.medidas.ritmo.raias[].rotulo': 'rotulo', 'derivado.medidas.ritmo.raias[].ausente': 'base',
  'derivado.medidas.ritmo.raias[].casas[].semana': 'rotulo', 'derivado.medidas.ritmo.raias[].casas[].valor': 'numero',
  'derivado.medidas.ritmo.raias[].casas[].zero': CTRL, 'derivado.medidas.ritmo.raias[].casas[].motivo': 'motivo',
  'derivado.medidas.ritmo.ponteiro': CTRL, 'derivado.medidas.ritmo.ponteiro.rotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.dias': 'numero',
  'derivado.medidas.ritmo.ponteiro.limiteRotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.limite': 'numero',
  'derivado.medidas.ritmo.ponteiro.tipicoRotulo': 'rotulo', 'derivado.medidas.ritmo.ponteiro.tipico': 'numero',
}

// ───────────────────────── células
const O = 'modelo.derivado.medidas'
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string, zero = false): Celula => (zero ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })

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
  if (semanas.length) tabelas.push({ id: 'canal-ritmo-semanas', titulo: 'Publicações por semana, das 13 últimas semanas', tipo: 'lista', nomeNoCorte: 'publicações por semana', privada: false, colunas: ['Formato', 'Semana', 'Publicações'], linhas: semanas })
  const pt = rit.ponteiro
  if (pt) {
    tabelas.push(tabelaFixa('canal-ritmo-parado', 'Dias sem publicar contra o limite de parado', 'dias sem publicar', ['Medida', 'Valor'], [
      [rotulo(pt.rotulo, `${R}.ponteiro.rotulo`), medido(pt.dias, `${R}.ponteiro.dias`, pt.dias.startsWith('0 '))],
      [rotulo(pt.limiteRotulo, `${R}.ponteiro.limiteRotulo`), medido(pt.limite, `${R}.ponteiro.limite`)],
      ...(pt.tipico !== null ? [[rotulo(pt.tipicoRotulo, `${R}.ponteiro.tipicoRotulo`), medido(pt.tipico, `${R}.ponteiro.tipico`)]] : []),
    ]))
  }
  const ausentes = rit.raias.flatMap((r) => (r.ausente ? [r.ausente] : []))
  return { tabelas, avisos: [...(m.topo.faixa ? [m.topo.faixa] : []), dir.frase, ...(dir.queda.nota ? [dir.queda.nota] : []), rit.frase, ...ausentes] }
}
