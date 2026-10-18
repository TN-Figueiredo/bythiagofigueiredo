import { detectarTesteYoutube } from '../detectar'
import { inferirDesfecho } from '../desfecho'
import { normalizarTitulo } from '../normalizar-titulo'
import { rodadasDeTitulo, type RodadaTitulo } from '../rodadas'
import {
  PADROES_DESFECHO,
  PADROES_DETECCAO,
  REGRA_TESTE_YOUTUBE_VERSAO,
  type Desfecho,
  type EscritaConhecida,
  type ImagemComparavel,
  type LeituraWatch,
  type OpcoesDeteccao,
  type VereditoTesteYoutube,
} from '../tipos'
import { JANELA_V14_MS, JANELA_V48_MS, NOVO_TESTE_APOS_MS } from './constantes'
import { evidenciaPorRodada, juntarEvidencia, medidaPropagacao } from './evidencia'
import type { AcaoRegistro, Encerramento, EstadoAvaliacao14, Fechamentos, NovaAvaliacao, NovoRegistro, RegistroAberto } from './tipos'

export interface EntradaVideo {
  leituras: readonly LeituraWatch[]
  escritas: readonly EscritaConhecida[]
  aberto: RegistroAberto | null
  fechamentos: Fechamentos
  agora: string
  novoId: () => string
  retroativa: boolean
  /** hqdefault vista (F10); opcional, padrão null. */
  miniaturaA?: ImagemComparavel | null
}

type Provavel = Extract<VereditoTesteYoutube, { estado: 'provavel_teste' }>
type Contexto = {
  agora: string
  fechamentos: Fechamentos
  novoId: () => string
  rodadas: readonly RodadaTitulo[]
  escritas: readonly EscritaConhecida[]
  ultimaVotanteDepoisMs: number | null
  miniaturaA: ImagemComparavel | null
}

/** §5.4: sem o corte, um teste nativo encerrado continuaria a dar `provavel_teste` por 14 dias e reabriria registro em laço. */
export function corteDaJanela(agoraMs: number, f: Fechamentos): number {
  let corte = agoraMs - JANELA_V14_MS
  for (const t of [f.encerradoEm, f.descartadoEm]) {
    if (t === null) continue
    const ms = Date.parse(t)
    if (!Number.isNaN(ms) && ms > corte) corte = ms
  }
  return corte
}

const iguais = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function motivoDe(d: Desfecho): string | null {
  return 'motivo' in d ? d.motivo : null
}

function novoRegistro(v: Provavel, c: Contexto): NovoRegistro {
  const ev = juntarEvidencia([], evidenciaPorRodada(c.rodadas, v.variantes.titulo, c.escritas, Date.parse(v.primeiraVista)))
  return {
    id: c.novoId(),
    origem: 'detectado',
    campos: ['titulo'],
    variantesTitulo: [...v.variantes.titulo],
    votosTitulo: { ...v.votos.titulo },
    tituloOficial: v.tituloOficial,
    primeiraVista: v.primeiraVista,
    ultimaVista: v.ultimaVista,
    veredito: v,
    versaoRegra: v.versaoRegra,
    sinaisFracos: v.sinaisFracos,
    evidencia: ev.evidencia,
    evidenciaCortada: ev.cortada,
    miniaturaA: c.miniaturaA,
  }
}

function fimDe(estado: Encerramento['estado'], desfechoEstado: Encerramento['desfechoEstado'], motivo: string, versao: number, vencedor: string | null, em: string): Encerramento {
  return { estado, desfechoEstado, desfechoMotivo: motivo, desfechoVersaoRegra: versao, vencedorTitulo: vencedor, encerradoEm: em }
}

/** §5.3 passo 5: ordem fixa, a primeira que vale decide. */
export function decidirRegistro(
  aberto: RegistroAberto | null,
  v14: VereditoTesteYoutube,
  desfecho: Desfecho | null,
  ctx: Contexto,
): { acao: AcaoRegistro; aviso: 'variantes_demais' | null } {
  const nada = (aviso: 'variantes_demais' | null = null): { acao: AcaoRegistro; aviso: 'variantes_demais' | null } => ({ acao: { tipo: 'nada' }, aviso })
  const agoraMs = Date.parse(ctx.agora)

  if (aberto === null) {
    if (v14.estado !== 'provavel_teste') return nada()
    // o corte já garante; a conferência fica explícita (descartado só reabre com evidência posterior)
    if (ctx.fechamentos.descartadoEm !== null && !(Date.parse(v14.primeiraVista) > Date.parse(ctx.fechamentos.descartadoEm))) return nada()
    return { acao: { tipo: 'criar', novo: novoRegistro(v14, ctx) }, aviso: null }
  }

  // (a) desfecho terminal vence tudo
  if (desfecho?.estado === 'vencedor_provavel') {
    return { acao: { tipo: 'encerrar', id: aberto.id, lido: aberto.updatedAt, fim: fimDe('encerrado', 'vencedor_provavel', 'vencedor_provavel', desfecho.versaoRegra, desfecho.vencedor, ctx.agora) }, aviso: null }
  }
  // (b) órfão: nenhuma leitura votante depois da última vista há mais de maxIdadeColetaMs
  if (aberto.ultimaVista !== null && ctx.ultimaVotanteDepoisMs === null && agoraMs - Date.parse(aberto.ultimaVista) > PADROES_DESFECHO.maxIdadeColetaMs) {
    return { acao: { tipo: 'encerrar', id: aberto.id, lido: aberto.updatedAt, fim: fimDe('sem_desfecho', 'sem_dado', 'sem_leitura_depois', REGRA_TESTE_YOUTUBE_VERSAO, null, ctx.agora) }, aviso: null }
  }
  // (a') coleta encerrada (a regra: havia leitura votante depois, a última há > 48 h)
  if (desfecho?.estado === 'sem_dado' && desfecho.motivo === 'coleta_encerrada') {
    return { acao: { tipo: 'encerrar', id: aberto.id, lido: aberto.updatedAt, fim: fimDe('sem_desfecho', 'sem_dado', 'coleta_encerrada', desfecho.versaoRegra, null, ctx.agora) }, aviso: null }
  }

  // (d) v14 provável com registro aberto
  if (v14.estado === 'provavel_teste') {
    if (aberto.ultimaVista !== null && Date.parse(v14.primeiraVista) > Date.parse(aberto.ultimaVista) + NOVO_TESTE_APOS_MS) {
      return {
        acao: {
          tipo: 'encerrar_e_criar', id: aberto.id, lido: aberto.updatedAt,
          fim: fimDe('sem_desfecho', 'sem_dado', 'teste_novo', REGRA_TESTE_YOUTUBE_VERSAO, null, ctx.agora),
          novo: novoRegistro(v14, ctx),
        },
        aviso: null,
      }
    }
    const uniao: string[] = [...(aberto.variantesTitulo ?? [])]
    const vistos = new Set(uniao.map(normalizarTitulo))
    for (const t of v14.variantes.titulo) if (!vistos.has(normalizarTitulo(t))) { uniao.push(t); vistos.add(normalizarTitulo(t)) }
    if (uniao.length > PADROES_DETECCAO.maxVariantes) return nada('variantes_demais')

    const votos: Record<string, number> = { ...(aberto.votosTitulo ?? {}) }
    for (const [k, n] of Object.entries(v14.votos.titulo)) votos[k] = Math.max(votos[k] ?? 0, n) // monotônico: a janela de 14 d desliza
    const ev = juntarEvidencia(aberto.evidencia, evidenciaPorRodada(ctx.rodadas, uniao, ctx.escritas, aberto.primeiraVista === null ? Date.parse(v14.primeiraVista) : Math.min(Date.parse(aberto.primeiraVista), Date.parse(v14.primeiraVista))))
    const ultimaVista = aberto.ultimaVista !== null && Date.parse(aberto.ultimaVista) >= Date.parse(v14.ultimaVista) ? aberto.ultimaVista : v14.ultimaVista
    const primeiraVista = aberto.primeiraVista !== null && Date.parse(aberto.primeiraVista) <= Date.parse(v14.primeiraVista) ? aberto.primeiraVista : v14.primeiraVista
    const precisaTitulo = !aberto.campos.includes('titulo')
    const desfechoMuda = desfecho !== null && (aberto.desfechoEstado !== desfecho.estado || (aberto.desfechoMotivo ?? null) !== motivoDe(desfecho))
    const muda =
      precisaTitulo || aberto.variantesTitulo === null || ultimaVista !== aberto.ultimaVista || !iguais(votos, aberto.votosTitulo) ||
      !iguais(ev.evidencia, aberto.evidencia) || !iguais(uniao, aberto.variantesTitulo) || desfechoMuda
    if (!muda) return nada()
    return {
      acao: {
        tipo: 'atualizar', id: aberto.id, lido: aberto.updatedAt,
        mudanca: {
          ...(precisaTitulo ? { campos: [...new Set(['titulo' as const, ...aberto.campos])] } : {}),
          variantesTitulo: uniao, votosTitulo: votos, tituloOficial: v14.tituloOficial, primeiraVista, ultimaVista,
          veredito: v14, versaoRegra: v14.versaoRegra, sinaisFracos: v14.sinaisFracos, evidencia: ev.evidencia, evidenciaCortada: ev.cortada,
          ...(desfecho !== null ? { desfecho } : {}),
        },
      },
      aviso: null,
    }
  }

  // (e) outros: grava o desfecho sem mudar o estado, só se mudou
  if (desfecho !== null && (aberto.desfechoEstado !== desfecho.estado || (aberto.desfechoMotivo ?? null) !== motivoDe(desfecho))) {
    return { acao: { tipo: 'desfecho', id: aberto.id, lido: aberto.updatedAt, desfecho }, aviso: null }
  }
  return nada()
}

const dentro = (ms: number, de: number): boolean => Number.isNaN(ms) || ms >= de // leitura de instante inválido segue: quem conta é a regra

export function avaliarVideo(e: EntradaVideo): { acao: AcaoRegistro; avaliacao: NovaAvaliacao } {
  const agoraMs = Date.parse(e.agora)
  const corte = Math.max(corteDaJanela(agoraMs, e.fechamentos), agoraMs - JANELA_V14_MS)
  const opts: OpcoesDeteccao = { escritasConhecidas: e.escritas }
  const l14 = e.leituras.filter(l => dentro(Date.parse(l.lidaEm), corte))
  const l48 = e.leituras.filter(l => dentro(Date.parse(l.lidaEm), agoraMs - JANELA_V48_MS))
  const v14 = detectarTesteYoutube(l14, opts)
  const v48 = detectarTesteYoutube(l48, opts)
  const medida = medidaPropagacao(rodadasDeTitulo(l48, opts), e.escritas, PADROES_DETECCAO.quarentenaEscritaMs)

  let desfecho: Desfecho | null = null
  let ultimaVotanteDepoisMs: number | null = null
  const ab = e.aberto
  if (ab !== null && ab.ultimaVista !== null) {
    const ultimaVistaMs = Date.parse(ab.ultimaVista)
    const depois = e.leituras.filter(l => Date.parse(l.lidaEm) > ultimaVistaMs)
    for (const l of depois) {
      if (l.erro === null && l.titulosExibidos.some(t => t.texto !== null)) ultimaVotanteDepoisMs = Math.max(ultimaVotanteDepoisMs ?? -Infinity, Date.parse(l.lidaEm))
    }
    if (ab.origem === 'detectado' && ab.veredito !== null && ab.veredito.estado === 'provavel_teste') {
      desfecho = inferirDesfecho(ab.veredito, depois, { escritasConhecidas: e.escritas, agora: e.agora })
    }
  }

  const { acao, aviso } = decidirRegistro(ab, v14, desfecho, {
    agora: e.agora, fechamentos: e.fechamentos, novoId: e.novoId, rodadas: rodadasDeTitulo(l14, opts), escritas: e.escritas,
    ultimaVotanteDepoisMs, miniaturaA: e.miniaturaA ?? null,
  })

  const registroId = acao.tipo === 'criar' ? acao.novo.id : acao.tipo === 'encerrar_e_criar' ? acao.novo.id : ab?.id ?? null
  let ateLidaEm: string | null = null
  let ateMs = -Infinity
  for (const l of e.leituras) {
    const ms = Date.parse(l.lidaEm)
    if (ms > ateMs) { ateMs = ms; ateLidaEm = l.lidaEm }
  }
  const motivo14 = v14.estado === 'insuficiente' ? v14.detalhe.motivo : v14.estado === 'nada_visivel' ? v14.motivo : null
  return {
    acao,
    avaliacao: {
      avaliadaEm: e.agora,
      ateLidaEm,
      estado14: v14.estado as EstadoAvaliacao14,
      motivo14,
      estado48: v48.estado,
      mistas48: v48.contagem.rodadasMistasTitulo,
      mistas48ForaQuarentena: medida.mistas48ForaQuarentena,
      minDesdeEscrita: medida.minDesdeEscrita,
      contagem: v14.contagem,
      escritas: e.escritas.length,
      versaoRegra: v14.versaoRegra,
      registroId,
      erro: null,
      retroativa: e.retroativa,
      aviso,
    },
  }
}
