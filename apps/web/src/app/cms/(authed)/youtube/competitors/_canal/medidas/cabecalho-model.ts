// E5a Tarefa 15: as seis células do cabeçalho da página do canal, na ordem Inscritos, Direção, Estado, Acerto, Ritmo, Criador responde.
// Puro. Toda célula não medida traz o motivo na linha de baixo; nenhuma vira zero.
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { MedidasDoCanal, PorFormato } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { Formato, Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { celulaDeDirecao, type CelulaDeDirecao } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { notaDoRitmo, type NotaDoRitmo } from '@/lib/youtube/observatorio/ritmo-nota'
import { dec1 } from './formatos'
import type { EstadoDaPagina } from './estado-model'
import type { CanalHeaderView, NumCell } from '../header-model'
import { celulaDoCriador, type CelulaDoCriadorComDado } from './criador-model'

export type TipoDeCelula = 'medido' | 'zero' | 'nao_medido' | 'ainda_nao_existe' | 'nao_carregou'

export interface FormatoDoCanal { fmt: Formato; doisFormatos: boolean; soShorts: boolean }

/** O formato principal do canal: o longo, salvo canal só de Shorts. */
export function formatoDoCanal(videos: readonly VideoLido[]): FormatoDoCanal {
  const longos = videos.filter(v => v.isShort === false).length
  const shorts = videos.filter(v => v.isShort === true).length
  const soShorts = longos === 0 && shorts > 0
  return { fmt: soShorts ? 'short' : 'long', doisFormatos: longos > 0 && shorts > 0, soShorts }
}

export type DetalheDaCelula =
  | { chave: 'inscritos'; texto: string | null }
  | { chave: 'direcao'; direcao: CelulaDeDirecao; avisoAte: string | null }
  | { chave: 'estado'; estado: EstadoDaPagina }
  | { chave: 'acerto'; k: number; n: number; pct: number | null; pontos: Array<'a' | 'm' | 'f'>; colunas: number; soNumero: boolean }
  /** `nota`: a base menor que as 13 semanas ou o canal abaixo do piso (sufixo âmbar + ⓘ); null quando a base é a da regra. */
  | { chave: 'ritmo'; porSemana: string; nota: NotaDoRitmo | null }
  | { chave: 'criador'; k: number | null; n: number | null; pct: number | null }

export interface CelulaDoCabecalho {
  chave: DetalheDaCelula['chave']
  rotulo: string
  valor: TipoDeCelula
  base: string
  /** O motivo, quando a célula não é medida. Nunca vazio nesse caso. */
  motivo: string | null
  detalhe: DetalheDaCelula
}

export interface EntradaDoCabecalho {
  F: Pick<Fmt, 'subs'>
  subs: number | null
  /** Nulo = as medidas não carregaram. */
  medidas: MedidasDoCanal | null
  formato: FormatoDoCanal
  estado: EstadoDaPagina
  extras: { missingSince: string | null } | null
  semVideos: boolean
  /** C4: a célula já calculada de "Criador responde". Ausente = a leitura não foi pedida. */
  criador?: CelulaDoCriadorComDado
  /** Semanas das 13 com leitura (padrão 13). */
  semanasLidas?: number
  hojeSP: string
}

const NAO_CARREGOU = 'a leitura falhou'

/** Grade fixa de 12 px: uma fileira até 8; acima, duas equilibradas, no máximo 10 por fileira; com mais de 20, só o número. */
export function colunasDosPontinhos(n: number): { colunas: number; soNumero: boolean } {
  if (n > 20) return { colunas: 0, soNumero: true }
  if (n <= 8) return { colunas: n, soNumero: false }
  return { colunas: Math.ceil(n / 2), soNumero: false }
}

function motivoDe(m: Extract<Medida<unknown>, { estado: 'nao_medido' }>, quando: 'canal' = 'canal'): { carregou: boolean; curta: string; longa: string } {
  const f = FRASES[m.motivo]({ desde: m.desde, fechaEm: m.fechaEm, n: m.n, minimo: m.minimo }, quando)
  return { carregou: classeDoMotivo(m.motivo) !== 'nao_carregou', curta: f.curta, longa: f.longa }
}

export function celulasDoCabecalho(o: EntradaDoCabecalho): CelulaDoCabecalho[] {
  const out: CelulaDoCabecalho[] = []
  const med = o.medidas
  const semDado = med === null

  // 1. Inscritos (acima de 1 milhão: três algarismos; oculto: hachura, nunca 0)
  out.push(o.subs === null
    ? { chave: 'inscritos', rotulo: 'Inscritos', valor: 'nao_medido', base: 'o canal esconde a contagem de inscritos no YouTube', motivo: 'inscritos ocultos pelo canal', detalhe: { chave: 'inscritos', texto: null } }
    : { chave: 'inscritos', rotulo: 'Inscritos', valor: 'medido', base: 'arredondado pelo YouTube', motivo: null, detalhe: { chave: 'inscritos', texto: o.F.subs(o.subs) } })

  // 2. Direção
  const dir = celulaDeDirecao(semDado ? null : med.m3a, o.extras ? { missingSince: o.extras.missingSince, subscribersHidden: null, lastOkSyncedAt: null } : null, { semVideos: o.semVideos })
  if (dir.tipo === 'medido') {
    out.push({ chave: 'direcao', rotulo: 'Direção', valor: 'medido', base: 'views do canal, 28 × 28 dias', motivo: null,
      detalhe: { chave: 'direcao', direcao: dir, avisoAte: dir.avisoDeContagem ? dir.avisoDeContagem.ate : null } })
  } else if (dir.tipo === 'nao_carregou') {
    out.push({ chave: 'direcao', rotulo: 'Direção', valor: 'nao_carregou', base: NAO_CARREGOU, motivo: NAO_CARREGOU, detalhe: { chave: 'direcao', direcao: dir, avisoAte: null } })
  } else {
    const txt = dir.longa
    out.push({ chave: 'direcao', rotulo: 'Direção', valor: 'nao_medido', base: txt, motivo: txt, detalhe: { chave: 'direcao', direcao: dir, avisoAte: null } })
  }

  // 3. Estado (em erro o estado é "não confirmado" e a faixa dá o título)
  const e = o.estado
  if (e.tipo === 'nao_carregou') out.push({ chave: 'estado', rotulo: 'Estado', valor: 'nao_carregou', base: NAO_CARREGOU, motivo: NAO_CARREGOU, detalhe: { chave: 'estado', estado: e } })
  else if (e.tipo === 'nao_medido') out.push({ chave: 'estado', rotulo: 'Estado', valor: 'nao_medido', base: e.base, motivo: e.base, detalhe: { chave: 'estado', estado: e } })
  else if (e.tipo === 'erro') out.push({ chave: 'estado', rotulo: 'Estado', valor: 'nao_medido', base: e.base, motivo: e.base, detalhe: { chave: 'estado', estado: e } })
  else out.push({ chave: 'estado', rotulo: 'Estado', valor: 'medido', base: e.base, motivo: null, detalhe: { chave: 'estado', estado: e } })

  // 4. Acerto
  const m4: Medida<import('@/lib/youtube/observatorio/medidas/acerto').ValorAcerto> | null = semDado ? null : (med.porFormato[o.formato.fmt] as PorFormato).m4
  if (m4 === null) {
    out.push({ chave: 'acerto', rotulo: 'Acerto', valor: 'nao_carregou', base: NAO_CARREGOU, motivo: NAO_CARREGOU, detalhe: { chave: 'acerto', k: 0, n: 0, pct: null, pontos: [], colunas: 0, soNumero: true } })
  } else if (m4.estado === 'nao_medido') {
    const mt = motivoDe(m4)
    out.push({ chave: 'acerto', rotulo: 'Acerto', valor: mt.carregou ? 'nao_medido' : 'nao_carregou', base: mt.carregou ? mt.longa : NAO_CARREGOU, motivo: mt.carregou ? mt.longa : NAO_CARREGOU,
      detalhe: { chave: 'acerto', k: 0, n: 0, pct: null, pontos: [], colunas: 0, soNumero: true } })
  } else {
    const { acertos, fracassos, total, pctAcerto } = m4.valor
    const meio = Math.max(0, total - acertos - fracassos)
    const pontos: Array<'a' | 'm' | 'f'> = [...Array<'a'>(acertos).fill('a'), ...Array<'m'>(meio).fill('m'), ...Array<'f'>(fracassos).fill('f')]
    const g = colunasDosPontinhos(total)
    out.push({ chave: 'acerto', rotulo: 'Acerto', valor: acertos === 0 ? 'zero' : 'medido', base: '2× ou mais · 90 dias', motivo: null,
      detalhe: { chave: 'acerto', k: acertos, n: total, pct: pctAcerto === null ? null : Math.round(pctAcerto * 100), pontos: g.soNumero ? [] : pontos, colunas: g.colunas, soNumero: g.soNumero } })
  }

  // 5. Ritmo
  const m6 = semDado ? null : (med.porFormato[o.formato.fmt] as PorFormato).m6
  const quemRitmo = o.formato.soShorts ? 'um Short' : 'um longo'
  if (m6 === null) {
    out.push({ chave: 'ritmo', rotulo: 'Ritmo', valor: 'nao_carregou', base: NAO_CARREGOU, motivo: NAO_CARREGOU, detalhe: { chave: 'ritmo', porSemana: '', nota: null } })
  } else if (m6.estado === 'nao_medido') {
    const mt = motivoDe(m6)
    out.push({ chave: 'ritmo', rotulo: 'Ritmo', valor: mt.carregou ? 'nao_medido' : 'nao_carregou', base: mt.carregou ? mt.longa : NAO_CARREGOU, motivo: mt.carregou ? mt.longa : NAO_CARREGOU,
      detalhe: { chave: 'ritmo', porSemana: '', nota: mt.carregou && (m6.motivo === 'canal_novo' || m6.motivo === 'ritmo_parcial') ? notaDoRitmo({ corte: m6.motivo === 'canal_novo' ? 'criacao' : 'cobertura', dias: m6.notas.find(x => x.tipo === 'canal_mais_novo_que_a_janela' || x.tipo === 'cobertura_curta')?.dias ?? null, abaixoDoPiso: true, semanasDaRegra: MEASURE_RULES.rhythm.weeks }) : null } })
  } else {
    const lidas = o.semanasLidas ?? m6.valor.semanas
    const base = lidas < m6.valor.semanas
      ? `${m6.valor.semanasComPublicacao} de ${lidas} semanas com leitura`
      : `com ${quemRitmo} em ${m6.valor.semanasComPublicacao} de ${m6.valor.semanas} semanas${m6.notas.some(x => x.tipo === 'canal_mais_novo_que_a_janela') ? ` (canal com ${m6.valor.dias} dias)` : m6.notas.some(x => x.tipo === 'cobertura_curta') ? ` (${m6.valor.dias} dias guardados)` : ''}`
    out.push({ chave: 'ritmo', rotulo: 'Ritmo', valor: 'medido', base, motivo: null, detalhe: { chave: 'ritmo', porSemana: dec1(m6.valor.porSemana), nota: notaDoRitmo({ corte: m6.notas.some(x => x.tipo === 'canal_mais_novo_que_a_janela') ? 'criacao' : m6.notas.some(x => x.tipo === 'cobertura_curta') ? 'cobertura' : null, dias: m6.valor.dias, abaixoDoPiso: false, semanasDaRegra: MEASURE_RULES.rhythm.weeks }) } })
  }

  // 6. Criador responde (C4: a célula vem de `criadorDoCanal`; sem ela, a leitura não foi pedida)
  if (o.criador) {
    const cr = o.criador
    out.push({ chave: 'criador', rotulo: 'Criador responde', valor: cr.valor, base: cr.base, motivo: cr.motivo, detalhe: { chave: 'criador', k: cr.k, n: cr.n, pct: cr.pct } })
  } else {
    const cr = celulaDoCriador('nao_pedida')
    out.push({ chave: 'criador', rotulo: 'Criador responde', valor: 'nao_medido', base: cr.longa, motivo: cr.longa, detalhe: { chave: 'criador', k: null, n: null, pct: null } })
  }
  return out
}


/** Um dos quatro números que saíram da faixa: o valor e o motivo que `header-model.ts` já devolve (pergunta 29), sem conta nova. */
export interface NumeroDeMais { chave: string; rotulo: string; valor: string | null; n: string | null; motivo: string | null; base: string }

const DE_MAIS: Array<{ chave: string; rotulo: string; lista: 'faixa' | 'todos' }> = [
  { chave: 'growth30', rotulo: 'Inscritos em 30 dias', lista: 'faixa' },
  { chave: 'vpd', rotulo: 'Views por dia no canal', lista: 'faixa' },
  { chave: 'engajamento', rotulo: 'Engajamento nos longos', lista: 'faixa' },
  { chave: 'medianaViews', rotulo: 'Views típicas', lista: 'todos' },
]

/** Pela chave da célula, nas duas listas do cabeçalho de hoje; não refaz conta. Célula ausente vira "não carregou", nunca zero. */
export function maisNumeros(h: Pick<CanalHeaderView, 'faixa' | 'todos'>): NumeroDeMais[] {
  return DE_MAIS.map((d): NumeroDeMais => {
    const c: NumCell | undefined = h[d.lista].find((x) => x.key === d.chave)
    if (!c) return { chave: d.chave, rotulo: d.rotulo, valor: null, n: null, motivo: NAO_CARREGOU, base: NAO_CARREGOU }
    return { chave: d.chave, rotulo: d.rotulo, valor: c.value, n: c.n, motivo: c.value === null ? (c.missing ?? NAO_CARREGOU) : null, base: c.base }
  })
}
