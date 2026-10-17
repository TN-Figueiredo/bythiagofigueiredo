// E5a Tarefa 15: a frase do topo da página do canal e a oração do último vídeo. Puro; as frases são as da tabela do NOTAS 15.
// O estado é dito uma vez só (decisão 13): a frase não repete o título da faixa. Texto novo leva TEXTO-A-REVISAR.
import type { CelulaDeDirecao } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { progresso } from '@/lib/youtube/observatorio/medidas-telas/progresso'
import { faixaDeLancamento } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import { dec1, dm, ptn } from './formatos'
import type { EstadoDaPagina } from './estado-model'
import type { FormatoDoCanal } from './cabecalho-model'

export type Glifo = 'up' | 'dn' | 'eq' | 'x' | 'aviso' | 'sync' | 'pausa' | 'interr'
export type Parte = { t: string; k?: 'forte' | 'ressalva' | 'num' }

export interface FraseDoTopo { tom: 'up' | 'dn' | 'eq'; glifo: Glifo; partes: Parte[]; texto: string }

/** O que a oração do último vídeo sabe de um vídeo (a Tarefa 17 monta). */
export type VideoDaOracao =
  | { tipo: 'passou'; titulo: string; dia: number; razao: number }
  | { tipo: 'faixa'; titulo: string; dia: number; razao: number }
  | { tipo: 'sem_normal'; titulo: string }

export type UltimoVideo =
  | { tipo: 'medido'; v: VideoDaOracao }
  /** Saiu agora: sem um dia completo de contagem; a resposta vem do anterior (se houver). */
  | { tipo: 'saiu_agora'; quando: string; anterior: VideoDaOracao | null }
  | { tipo: 'sem_contagem'; motivo: 'antes_da_contagem' | 'sem_dia_completo' }
  | { tipo: 'canal_novo' }
  /** Nenhum vídeo do formato. */
  | { tipo: 'nenhum' }

const x1 = (r: number): string => dec1(r).replace(/,0$/, ',0')
const NOME_DA_FAIXA = { muito_acima: 'acima do normal', acima: 'acima do normal', perto: 'perto do normal', abaixo: 'abaixo do normal' } as const

function orac(v: VideoDaOracao, suj: string): string {
  const nome = v.tipo === 'sem_normal' ? '' : `“${v.titulo}”`
  if (v.tipo === 'sem_normal') return `${suj}“${v.titulo}”, ainda não tem normal para comparar: faltam vídeos medidos na mesma idade.`
  if (v.tipo === 'passou') return `${suj}${nome}, saiu acima do normal já no dia ${v.dia} (${x1(v.razao)}×).`
  return `${suj}${nome}, está ${NOME_DA_FAIXA[faixaDeLancamento(v.razao)]} (${x1(v.razao)}× no dia ${v.dia}).`
}

/** A última oração da frase do topo. `ate` = "dd/mm" quando a leitura parou (erro e fora do ar: "Até dd/mm, o último vídeo…"). */
export function oracaoDoUltimoVideo(u: UltimoVideo, o: { quem: string; ate: string | null }): string | null {
  const pre = o.ate ? `Até ${o.ate}, o` : 'O'
  const ultimo = `${pre} último ${o.quem}`
  switch (u.tipo) {
    case 'nenhum': return null
    case 'canal_novo': return `Sem leitura do último ${o.quem}: a primeira busca ainda não terminou.`
    case 'sem_contagem':
      return u.motivo === 'antes_da_contagem'
        ? `Sem leitura do último ${o.quem}: ele saiu antes de a contagem por vídeo começar (03/10).`
        : `Sem leitura do último ${o.quem}: ele ainda não completou um dia de contagem.`
    case 'medido': return orac(u.v, `${ultimo}, `)
    case 'saiu_agora': {
      const a = `${ultimo} saiu ${u.quando} e ainda não completou um dia de contagem.`
      return u.anterior ? `${a} ${orac(u.anterior, 'O anterior, ')}` : a
    }
  }
}

export interface EntradaDaFrase {
  estado: EstadoDaPagina
  /** Nulo = as medidas não carregaram. */
  direcao: CelulaDeDirecao | null
  formato: FormatoDoCanal
  ritmo: { porSemana: number; semanasLidas: number; semanasComPublicacao: number } | null
  /** Acerto "k de n" (vídeos recentes), nulo se não medido. */
  acerto: { k: number; n: number } | null
  /** Parado: dias, data (AAAA-MM-DD) do último vídeo, intervalo habitual em dias (ou nulo). */
  parado: { dias: number; ultimaEm: string; costumava: number | null } | null
  /** Em queda: as três variações, da atual à mais antiga (frações, 0,1 = +10%). */
  queda: number[] | null
  ultimoVideo: UltimoVideo
  hojeSP: string
}

const pctTxt = (v: number): string => {
  const p = Math.round(v * 100)
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`
}

function montar(tom: FraseDoTopo['tom'], glifo: Glifo, partes: Parte[], oracao: string | null): FraseDoTopo {
  const todas = oracao ? [...partes, { t: ` ${oracao}` }] : partes
  return { tom, glifo, partes: todas, texto: todas.map((p) => p.t).join('') }
}

export function fraseDoTopo(e: EntradaDaFrase): FraseDoTopo {
  const quem = e.formato.soShorts ? 'Short' : e.formato.doisFormatos ? 'vídeo longo' : 'vídeo'
  const ate = e.estado.ate ? dm(e.estado.ate) : null
  const oracaoNormal = oracaoDoUltimoVideo(e.ultimoVideo, { quem, ate: null })
  const oracaoParada = oracaoDoUltimoVideo(e.ultimoVideo, { quem, ate })

  // as medidas não carregaram: a frase não afirma direção nem estado
  if (e.direcao === null || e.estado.tipo === 'nao_carregou') {
    return montar('eq', 'aviso', [{ t: 'Não carregou:', k: 'forte' }, { t: ' as medidas deste canal não carregaram agora.' }], null) // TEXTO-A-REVISAR
  }
  switch (e.estado.tipo) {
    case 'saiu':
      return montar('eq', 'x', [{ t: `Os números valem até ${ate ?? 'a última leitura'}.`, k: 'forte' }], oracaoParada)
    case 'erro':
      return montar('eq', 'aviso', [{ t: `Os números abaixo são de ${ate ?? 'a última leitura'}.`, k: 'forte' }], oracaoParada)
    case 'primeira_busca':
      return montar('eq', 'sync', [{ t: 'Canal novo na lista:', k: 'forte' }, { t: ' os números aparecem aos poucos.' }], oracaoNormal)
    case 'pausado': // TEXTO-A-REVISAR
      return montar('eq', 'pausa', [{ t: 'Coleta pausada:', k: 'forte' }, { t: ' os números param na última leitura.' }], oracaoNormal)
    case 'parado': {
      const p = e.parado
      if (!p) return montar('dn', 'pausa', [{ t: 'Parado.', k: 'forte' }], null)
      const cada = p.costumava !== null ? ` Ele costumava publicar ${e.formato.doisFormatos ? 'um longo ' : ''}a cada ${dec1(p.costumava).replace(/,0$/, '')} dias.` : ''
      return montar('dn', 'pausa', [
        { t: `Parado há ${p.dias} dias:`, k: 'forte' },
        { t: ` o último vídeo${e.formato.doisFormatos ? ' (longo ou Short)' : ''} saiu em ${dm(p.ultimaEm)}.${cada}` },
      ], null)
    }
    case 'em_queda': {
      const q = e.queda
      const lista = q ? ` (${q.map(pctTxt).join(', ')})` : ''
      return montar('dn', 'dn', [
        { t: 'Em queda sustentada:', k: 'forte' },
        { t: ` as três últimas janelas de ${MEASURE_RULES.direction.windowDays} dias ganharam menos views que a anterior${lista}.` },
      ], oracaoNormal)
    }
    case 'ativo':
      break
  }
  return fraseDeDirecao(e, oracaoNormal)
}

function fraseDeDirecao(e: EntradaDaFrase, oracao: string | null): FraseDoTopo {
  const d = e.direcao as CelulaDeDirecao
  const r = e.ritmo
  const quemPubs = e.formato.soShorts ? 'Shorts' : e.formato.doisFormatos ? 'vídeos longos' : 'vídeos'
  if (d.tipo !== 'medido') {
    if (d.tipo === 'nao_carregou') return montar('eq', 'aviso', [{ t: 'Não carregou:', k: 'forte' }, { t: ' a direção do canal não carregou agora.' }], oracao)
    // sem direção: "faltam N dias de registro (completa em dd/mm)"
    const p = d.tipo === 'nao_medido' && d.fechaEm ? progresso(56, d.fechaEm, e.hojeSP) : null
    const corpo = p
      ? ` faltam ${p.total - p.feitos} dias de registro (completa em ${dm(p.fechaEm)}).`
      : ` ${d.tipo === 'nao_medido' ? d.longa : ''}`
    let pubs = ''
    if (r) {
      const n = Math.round(r.porSemana * 13)
      const quem = e.formato.soShorts ? ptn(n, 'Short', 'Shorts') : ptn(n, 'vídeo longo', 'vídeos longos')
      pubs = r.semanasLidas < 13 ? ` Ele publicou ${quem} nas ${ptn(r.semanasLidas, 'semana', 'semanas')} com leitura.` : ` Ele publicou ${quem} nas últimas 13 semanas.`
    }
    return montar('eq', 'interr', [{ t: 'Ainda não dá para dizer para onde o canal anda:', k: 'forte' }, { t: `${corpo}${pubs}` }], oracao)
  }
  const tom: FraseDoTopo['tom'] = d.simbolo === 'sobe' ? 'up' : d.simbolo === 'desce' ? 'dn' : 'eq'
  const glifo: Glifo = tom
  const ress = d.avisoDeContagem ? ` (a janela ainda cruza a mudança de contagem de ${dm(MEASURE_RULES.countChange)})` : ''
  if (e.formato.soShorts) {
    const verbo = tom === 'up' ? 'subiram ' : tom === 'dn' ? 'caíram ' : 'ficaram iguais, '
    return montar(tom, glifo, [
      { t: 'Canal só de Shorts:', k: 'forte' },
      { t: ` publica ${r ? dec1(r.porSemana) : '—'} Shorts por semana, e as views do canal ${verbo}${d.texto} em 28 dias${ress}.` },
    ], oracao)
  }
  const nome = d.simbolo === 'sobe' ? 'Subindo' : d.simbolo === 'desce' ? 'Descendo' : 'Sem mudança'
  const verbo = d.simbolo === 'sobe' ? 'ganhou mais views do que' : d.simbolo === 'desce' ? 'ganhou menos views do que' : d.pct === 0 ? 'ganhou as mesmas views que' : 'ganhou quase as mesmas views que'
  const partes: Parte[] = [{ t: `${nome} ${d.texto}:`, k: 'forte' }, { t: ` nos últimos 28 dias o canal ${verbo} nos 28 anteriores` }]
  if (ress) partes.push({ t: ress, k: 'ressalva' })
  const publica = r ? ` Publica ${dec1(r.porSemana)} ${quemPubs} por semana` : ''
  const acertou = e.acerto ? `${e.acerto.k} de ${e.acerto.n} vídeos recentes` : null
  partes.push({ t: publica ? `.${publica}${acertou ? ` e acertou ${acertou}.` : '.'}` : acertou ? `. Acertou ${acertou}.` : '.' })
  return montar(tom, glifo, partes, oracao)
}
