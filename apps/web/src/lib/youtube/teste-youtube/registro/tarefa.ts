import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa, ResultadoTarefa } from '@/lib/youtube/agenda/tipos'
import { resumoTecnico } from '@/lib/youtube/agenda/motivos'
import { PADROES_DETECCAO, REGRA_TESTE_YOUTUBE_VERSAO, type EscritaConhecida, type LeituraWatch } from '../tipos'
import { JANELA_REPRODUCAO_MS, RETENCAO_PEDIDA_MS } from './constantes'
import { escritasDoApp } from './escritas'
import { lerAberto, lerCandidatos, lerEscritas, lerLeiturasPaginadas, type Candidato } from './ler'
import { avaliarVideo, corteDaJanela } from './registrar'
import { reproduzirPassado, type Reproducao } from './reproduzir'
import type { AcaoRegistro, Encerramento, NovaAvaliacao, NovoRegistro, RegistroAberto } from './tipos'

const MAX_VIDEOS = 8
const MAX_REPRODUCOES = 2
const PARALELO = 4
const PROPRIO_MS = 30_000
const BANCO_ATE_MS = 83_000
const PODA_LOTE = 500
const PODA_FOLGA_MS = 3_000

/** Códigos curtos de erro por vídeo (§5.5). Entram em `ab_native_avaliacoes.erro` (check `^[a-z0-9_]{1,40}$`). */
type CodigoErro = 'opcao_invalida' | 'escrita_sem_fuso' | 'paginacao' | 'banco' | 'corrida' | 'excecao' | 'leitura_invalida'

class ErroRegistro extends Error {
  constructor(readonly codigo: CodigoErro, readonly gravacao: boolean = false) { super(codigo) }
}
/** CAS perdido duas vezes: conta como falha do vídeo, mas nada é escrito (nem a avaliação nem a linha de erro); o vídeo segue devido (C-7e). */
class CasPerdido extends Error {}
/** Sem tempo para mais uma ida ao banco: o vídeo fica para o disparo seguinte (não é falha e nada é escrito). */
class SemTempo extends Error {}

function codigoDe(e: unknown): { codigo: CodigoErro; gravacao: boolean } {
  if (e instanceof ErroRegistro) return { codigo: e.codigo, gravacao: e.gravacao }
  const msg = e instanceof Error ? e.message : ''
  if (/escritasConhecidas\[\d+\]\.em inválido/.test(msg)) return { codigo: 'escrita_sem_fuso', gravacao: false }
  if (/opção .* inválida/.test(msg)) return { codigo: 'opcao_invalida', gravacao: false }
  return { codigo: 'excecao', gravacao: false }
}

export interface OpcoesRegistro { novoId?: () => string }

interface Contagem {
  avaliados: number; criados: number; atualizados: number; encerrados: number; encerradosOficialNaoLido: number; reproduzidos: number; reproducaoJaFeita: number
  retencaoSemAlvo: number; retencaoSemRpc: number; retencaoFalhou: number; casPerdido: number; variantesDemais: number; falhas: number; falhasDeGravacao: number
  erroRegravado: number; leiturasInvalidas: number
}

// ───────────────────────── serialização para as colunas ─────────────────────────
const motivoDe = (d: { estado: string } & Record<string, unknown>): string | null => (typeof d.motivo === 'string' ? d.motivo : null)

function colunasDoNovo(n: NovoRegistro): Record<string, unknown> {
  return {
    origem: n.origem, campos: n.campos, variantes_titulo: n.variantesTitulo, votos_titulo: n.votosTitulo, titulo_oficial: n.tituloOficial,
    primeira_vista: n.primeiraVista, ultima_vista: n.ultimaVista, veredito: n.veredito, versao_regra: n.versaoRegra, sinais_fracos: n.sinaisFracos,
    evidencia: n.evidencia, evidencia_cortada: n.evidenciaCortada, miniatura_a: n.miniaturaA,
  }
}
function colunasDoFim(f: Encerramento): Record<string, unknown> {
  return {
    estado: f.estado, desfecho_estado: f.desfechoEstado, desfecho_motivo: f.desfechoMotivo, desfecho_versao_regra: f.desfechoVersaoRegra,
    desfecho_em: f.encerradoEm, vencedor_titulo: f.vencedorTitulo, vencedor_fonte: f.vencedorTitulo === null ? null : 'regra', encerrado_em: f.encerradoEm,
  }
}
function colunasDaMudanca(m: Extract<AcaoRegistro, { tipo: 'atualizar' }>['mudanca'], agoraIso: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (m.campos !== undefined) out.campos = m.campos
  if (m.variantesTitulo !== undefined) out.variantes_titulo = m.variantesTitulo
  if (m.votosTitulo !== undefined) out.votos_titulo = m.votosTitulo
  if (m.tituloOficial !== undefined) out.titulo_oficial = m.tituloOficial
  if (m.primeiraVista !== undefined) out.primeira_vista = m.primeiraVista
  if (m.ultimaVista !== undefined) out.ultima_vista = m.ultimaVista
  if (m.veredito !== undefined) out.veredito = m.veredito
  if (m.versaoRegra !== undefined) out.versao_regra = m.versaoRegra
  if (m.sinaisFracos !== undefined) out.sinais_fracos = m.sinaisFracos
  if (m.evidencia !== undefined) out.evidencia = m.evidencia
  if (m.evidenciaCortada !== undefined) out.evidencia_cortada = m.evidenciaCortada
  if (m.miniaturaA !== undefined) out.miniatura_a = m.miniaturaA
  if (m.desfecho !== undefined) Object.assign(out, colunasDoDesfecho(m.desfecho, agoraIso))
  return out
}
function colunasDoDesfecho(d: { estado: string; versaoRegra: number } & Record<string, unknown>, agoraIso: string): Record<string, unknown> {
  return { desfecho_estado: d.estado, desfecho_motivo: motivoDe(d), desfecho_versao_regra: d.versaoRegra, desfecho_em: agoraIso }
}
function linhaDeAvaliacao(a: NovaAvaliacao): Record<string, unknown> {
  return {
    avaliada_em: a.avaliadaEm, ate_lida_em: a.ateLidaEm, estado_14: a.estado14, motivo_14: a.motivo14, estado_48: a.estado48, mistas_48: a.mistas48,
    mistas_48_fora_quarentena: a.mistas48ForaQuarentena, min_desde_escrita: a.minDesdeEscrita, contagem: a.contagem, escritas: a.escritas,
    versao_regra: a.versaoRegra, registro_id: a.registroId, erro: a.erro, retroativa: a.retroativa, aviso: a.aviso,
  }
}
function linhaDeReproducaoRegistro(n: NovoRegistro & { fim: Encerramento | null }, ytId: string): Record<string, unknown> {
  return { id: n.id, youtube_video_id: ytId, ...colunasDoNovo(n), ...(n.fim === null ? { estado: 'em_andamento' } : colunasDoFim(n.fim)) }
}

const semFeito = (estado: ResultadoTarefa['estado'], motivo: string, detalhe?: Record<string, number>): ResultadoTarefa =>
  ({ estado, feitas: 0, deixadas: null, motivo, ...(detalhe ? { detalhe } : {}) })

/**
 * `registro_teste_nativo` (S7 fase 1, §5.1): lê as leituras da watch dos vídeos próprios devidos, roda a regra da S3 e grava o registro e a avaliação.
 * Só escreve em `ab_native_tests`, `ab_native_avaliacoes` e nas RPCs `yt_watch_reter`, `ab_native_poda` e `ab_native_reproduzir`.
 * 30 s próprios; nenhuma ida ao banco começa depois de `t0 + 83 s`.
 */
export async function rodarRegistro(c: ContextoTarefa, o: OpcoesRegistro = {}): Promise<ResultadoTarefa> {
  const novoId = o.novoId ?? randomUUID
  const sb = c.sb
  const inicio = c.agora()
  const fimDuro = c.t0 + BANCO_ATE_MS
  const ateMs = Math.min(inicio + PROPRIO_MS, fimDuro)

  const falha = await schemaTablesReady(sb, [
    ['MG-S4', [['yt_watch_alvos', 'id'], ['yt_watch_readings', 'id'], ['yt_watch_thumbs', 'id']]],
    ['MG-S7', [['ab_native_tests', 'id'], ['ab_native_avaliacoes', 'id']]],
  ], { signal: AbortSignal.timeout(BANCO_MS) })
  if (falha !== null) return falha.tipo === 'ausente' ? semFeito('parcial', 'schema_ausente') : semFeito('erro', 'schema_nao_conferido')

  const lista = await lerCandidatos(sb, inicio)
  if (!('valor' in lista)) {
    if (lista.causa === 'erro_do_banco' && lista.codigo === '42P01') return semFeito('parcial', 'schema_ausente')
    return semFeito('parcial', 'lista_falhou')
  }
  const { devidos, semVideo, semVideoAntigos, antigosFora, total, candidatosTotal } = lista.valor

  const cont: Contagem = {
    avaliados: 0, criados: 0, atualizados: 0, encerrados: 0, encerradosOficialNaoLido: 0, reproduzidos: 0, reproducaoJaFeita: 0,
    retencaoSemAlvo: 0, retencaoSemRpc: 0, retencaoFalhou: 0, casPerdido: 0, variantesDemais: 0, falhas: 0, falhasDeGravacao: 0, erroRegravado: 0, leiturasInvalidas: 0,
  }
  let podadas = 0
  const detalheDe = (sobrou: number, extra: Record<string, number> = {}): Record<string, number> => ({
    candidatos_total: candidatosTotal, alvos_lidos: total, avaliados: cont.avaliados, criados: cont.criados, atualizados: cont.atualizados,
    encerrados: cont.encerrados, encerrados_oficial_nao_lido: cont.encerradosOficialNaoLido, sem_video: semVideo, antigos_fora: antigosFora, sobrou,
    reproduzidos: cont.reproduzidos, reproducao_ja_feita: cont.reproducaoJaFeita, retencao_sem_alvo: cont.retencaoSemAlvo, retencao_sem_rpc: cont.retencaoSemRpc,
    retencao_falhou: cont.retencaoFalhou, cas_perdido: cont.casPerdido, variantes_demais: cont.variantesDemais, falhas: cont.falhas,
    erros_regravados: cont.erroRegravado, leituras_invalidas: cont.leiturasInvalidas, podadas, inicio_ms: inicio - c.t0, ...extra,
  })

  if (devidos.length === 0) {
    podadas = await podar(c, inicio, fimDuro)
    const detalhe = detalheDe(0, { sem_candidatos: 1 })
    // alvo ativo há > 24 h sem `youtube_videos` nunca vira `ok` calado (Y3, Review Focus 2)
    return semVideoAntigos > 0 ? { estado: 'parcial', feitas: 0, deixadas: 0, motivo: 'sem_video', detalhe } : { estado: 'ok', feitas: 0, deixadas: 0, detalhe }
  }

  // até 8 por disparo, no máximo 2 de reprodução do passado de alvo que saiu (nível 5)
  const escolhidos: Candidato[] = []
  let reproducoes = 0
  for (const d of devidos) {
    if (escolhidos.length >= MAX_VIDEOS) break
    if (d.prioridade === 5) { if (reproducoes >= MAX_REPRODUCOES) continue; reproducoes++ }
    escolhidos.push(d)
  }
  let proximo = 0
  let comecaram = 0
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const i = proximo++
      if (i >= escolhidos.length) return
      if (c.agora() >= ateMs) return
      comecaram++
      const cand = escolhidos[i]!
      try {
        await processar(c, cand, inicio, fimDuro, novoId, cont)
      } catch (e) {
        if (e instanceof SemTempo) { comecaram--; continue }
        cont.falhas++
        if (e instanceof CasPerdido) continue
        const { codigo, gravacao } = codigoDe(e)
        if (gravacao) cont.falhasDeGravacao++
        try {
          await gravarErro(c, cand, codigo, cont)
        } catch { /* a linha de erro não pôde ser gravada: o vídeo segue devido no disparo seguinte */ }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, escolhidos.length) }, trabalhador))

  const sobrou = devidos.length - comecaram
  podadas = await podar(c, inicio, fimDuro)

  if (cont.falhas > 0) {
    const motivo = cont.falhas === cont.falhasDeGravacao ? 'gravacao_falhou' : 'video_falhou'
    return { estado: cont.falhas >= comecaram ? 'erro' : 'parcial', feitas: cont.avaliados, deixadas: sobrou, motivo, detalhe: detalheDe(sobrou) }
  }
  if (sobrou > 0) return { estado: 'parcial', feitas: cont.avaliados, deixadas: sobrou, motivo: 'sobrou', detalhe: detalheDe(sobrou) }
  if (semVideoAntigos > 0) return { estado: 'parcial', feitas: cont.avaliados, deixadas: 0, motivo: 'sem_video', detalhe: detalheDe(0) }
  return { estado: 'ok', feitas: cont.avaliados, deixadas: 0, detalhe: detalheDe(0) }
}

async function podar(c: ContextoTarefa, inicio: number, fimDuro: number): Promise<number> {
  if (c.agora() + PODA_FOLGA_MS > Math.min(inicio + PROPRIO_MS + PODA_FOLGA_MS, fimDuro)) return 0
  try {
    const r = await c.sb.rpc('ab_native_poda', { p_agora: new Date(c.agora()).toISOString(), p_lote: PODA_LOTE }).abortSignal(AbortSignal.timeout(BANCO_MS))
    return !r.error && typeof r.data === 'number' ? r.data : 0
  } catch {
    return 0
  }
}

/** Uma ida ao banco só começa se ainda há tempo; senão o vídeo fica para o disparo seguinte, sem escrever nada. */
function ida(c: ContextoTarefa): void {
  if (c.agora() >= c.t0 + BANCO_ATE_MS) throw new SemTempo()
}

const eAusente = (error: unknown): boolean => { const s = resumoTecnico(error).sqlstate; return s === '42883' || s === '42P01' }

async function processar(c: ContextoTarefa, cand: Candidato, inicio: number, fimDuro: number, novoId: () => string, cont: Contagem): Promise<void> {
  void fimDuro
  const sb = c.sb
  const agoraMs = c.agora()
  const agoraIso = new Date(agoraMs).toISOString()
  const t0Leitura = new Date(inicio).toISOString() // o `leitura_watch` roda antes, no mesmo disparo: o teto é o começo DESTA tarefa, não o t0 do disparo

  if (cand.motivo === 'sem_rodada_nova') {
    ida(c)
    await inserirAvaliacao(sb, cand, {
      avaliadaEm: agoraIso, ateLidaEm: null, estado14: 'sem_rodada_nova', motivo14: null, estado48: null, mistas48: null, mistas48ForaQuarentena: null,
      minDesdeEscrita: null, contagem: null, escritas: null, versaoRegra: REGRA_TESTE_YOUTUBE_VERSAO, registroId: cand.aberto?.id ?? null, erro: null,
      retroativa: false, aviso: null,
    })
    cont.avaliados++
    return
  }

  const reproduz = cand.motivo === 'reproduzir'
  const desde = reproduz ? agoraMs - JANELA_REPRODUCAO_MS : Math.min(corteDaJanela(agoraMs, cand.fechamentos), cand.aberto?.ultimaVista != null ? Date.parse(cand.aberto.ultimaVista) : Infinity)
  ida(c)
  const lidas = await lerLeiturasPaginadas(sb, cand.ytId, cand.siteId, desde, t0Leitura)
  if (!('valor' in lidas)) throw new ErroRegistro(lidas.causa === 'forma_invalida' ? 'paginacao' : 'banco')
  const leituras: LeituraWatch[] = lidas.valor.leituras
  // a validação recusou linhas: nunca em silêncio. Se recusou TODAS (a S4 mudou a forma), o vídeo falha com código próprio (Y2).
  const { invalidas } = lidas.valor
  if (invalidas > 0 && leituras.length === 0) throw new ErroRegistro('leitura_invalida')
  cont.leiturasInvalidas += invalidas

  let escritas: EscritaConhecida[] = []
  if (leituras.length > 0) {
    const tempos = leituras.map(l => Date.parse(l.lidaEm)).filter(Number.isFinite)
    const deMs = Math.min(...tempos) - PADROES_DETECCAO.quarentenaEscritaMs
    const ateJanela = Math.max(...tempos) + PADROES_DETECCAO.maxDuracaoRodadaMs
    ida(c)
    const linhas = await lerEscritas(sb, cand.videoId, { deMs, ateMs: ateJanela })
    if (!('valor' in linhas)) throw new ErroRegistro('banco')
    escritas = escritasDoApp(linhas.valor, { deMs, ateMs: ateJanela })
  }

  if (reproduz) {
    const r = reproduzirPassado(leituras, escritas, agoraIso, novoId, { aberto: cand.aberto, fechamentos: cand.fechamentos })
    await gravarReproducao(c, cand, r, cont)
    return
  }
  await gravarAvaliacao(c, cand, leituras, escritas, agoraIso, novoId, cont)
}

async function gravarReproducao(c: ContextoTarefa, cand: Candidato, r: Reproducao, cont: Contagem): Promise<void> {
  ida(c)
  const res = await c.sb.rpc('ab_native_reproduzir', {
    p_site: cand.siteId, p_video: cand.videoId,
    p_registros: r.registros.map(n => linhaDeReproducaoRegistro(n, cand.ytId)),
    p_avaliacoes: r.avaliacoes.map(linhaDeAvaliacao),
  }).abortSignal(AbortSignal.timeout(BANCO_MS))
  if (res.error) throw new ErroRegistro('banco', true)
  if (typeof res.data !== 'number') throw new ErroRegistro('banco', true)
  if (res.data === 0) { cont.reproducaoJaFeita++; return }
  cont.reproduzidos++
  cont.avaliados++
  cont.criados += r.registros.length
  for (const n of r.registros) if (n.fim !== null) contarEncerramento(n.fim, cont)
  for (const a of r.avaliacoes) if (a.aviso === 'variantes_demais') cont.variantesDemais++
  const ultima = r.registros.map(n => n.ultimaVista).sort().at(-1)
  if (ultima !== undefined) await reter(c, cand, ultima, cont)
}

function contarEncerramento(f: Encerramento, cont: Contagem): void {
  cont.encerrados++
  if (f.desfechoMotivo === 'oficial_nao_lido') cont.encerradosOficialNaoLido++
}

type Aplicado = 'ok' | 'cas' | 'unico'

async function aplicarAcao(c: ContextoTarefa, cand: Candidato, acao: AcaoRegistro, agoraIso: string): Promise<Aplicado> {
  const sb = c.sb
  const inserir = async (n: NovoRegistro, conferido = false): Promise<Aplicado> => {
    if (!conferido) ida(c)
    const r = await sb.from('ab_native_tests').insert({
      id: n.id, site_id: cand.siteId, video_id: cand.videoId, youtube_video_id: cand.ytId, estado: 'em_andamento', ...colunasDoNovo(n),
    }).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error) { if (r.error.code === '23505') return 'unico'; throw new ErroRegistro('banco', true) }
    return 'ok'
  }
  const atualizar = async (id: string, lido: string, cols: Record<string, unknown>): Promise<Aplicado> => {
    ida(c)
    const r = await sb.from('ab_native_tests').update(cols).eq('id', id).eq('estado', 'em_andamento').eq('updated_at', lido).select('id').abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error) throw new ErroRegistro('banco', true)
    return Array.isArray(r.data) && r.data.length === 1 ? 'ok' : 'cas'
  }
  switch (acao.tipo) {
    case 'nada': return 'ok'
    case 'criar': return inserir(acao.novo)
    case 'atualizar': return atualizar(acao.id, acao.lido, colunasDaMudanca(acao.mudanca, agoraIso))
    case 'desfecho': return atualizar(acao.id, acao.lido, colunasDoDesfecho(acao.desfecho, agoraIso))
    case 'encerrar': return atualizar(acao.id, acao.lido, colunasDoFim(acao.fim))
    case 'encerrar_e_criar': {
      // as duas idas cabem juntas ou nenhuma começa: o teto não pode cair entre o fechamento do antigo e o insert do novo (Y5)
      if (c.agora() + 2 * BANCO_MS >= c.t0 + BANCO_ATE_MS) throw new SemTempo()
      const a = await atualizar(acao.id, acao.lido, colunasDoFim(acao.fim))
      if (a !== 'ok') return a
      return inserir(acao.novo, true)
    }
  }
}

async function gravarAvaliacao(
  c: ContextoTarefa, cand: Candidato, leituras: readonly LeituraWatch[], escritas: readonly EscritaConhecida[], agoraIso: string, novoId: () => string, cont: Contagem,
): Promise<void> {
  let aberto: RegistroAberto | null = cand.aberto
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = avaliarVideo({ leituras, escritas, aberto, fechamentos: cand.fechamentos, agora: agoraIso, novoId, retroativa: false })
    const aplicado = await aplicarAcao(c, cand, r.acao, agoraIso)
    if (aplicado === 'ok') {
      await inserirAvaliacao(c.sb, cand, r.avaliacao, c)
      cont.avaliados++
      if (r.avaliacao.aviso === 'variantes_demais') cont.variantesDemais++
      const a = r.acao
      if (a.tipo === 'criar' || a.tipo === 'encerrar_e_criar') cont.criados++
      if (a.tipo === 'atualizar' || a.tipo === 'desfecho') cont.atualizados++
      if (a.tipo === 'encerrar' || a.tipo === 'encerrar_e_criar') contarEncerramento(a.fim, cont)
      const novo = a.tipo === 'criar' || a.tipo === 'encerrar_e_criar' ? a.novo : null
      if (novo !== null) await reter(c, cand, novo.ultimaVista, cont)
      else if (a.tipo === 'atualizar' && a.mudanca.ultimaVista !== undefined) await reter(c, cand, a.mudanca.ultimaVista, cont)
      return
    }
    if (tentativa === 1) {
      if (aplicado === 'unico') throw new ErroRegistro('corrida')
      cont.casPerdido++
      throw new CasPerdido()
    }
    ida(c)
    const relido = await lerAberto(c.sb, cand.videoId)
    if (!('valor' in relido)) throw new ErroRegistro('banco')
    aberto = relido.valor
  }
}

async function inserirAvaliacao(sb: SupabaseClient, cand: Candidato, a: NovaAvaliacao, c?: ContextoTarefa): Promise<void> {
  if (c) ida(c)
  const r = await sb.from('ab_native_avaliacoes').insert({ site_id: cand.siteId, video_id: cand.videoId, ...linhaDeAvaliacao(a) }).abortSignal(AbortSignal.timeout(BANCO_MS))
  if (r.error) throw new ErroRegistro('banco', true)
}

async function reter(c: ContextoTarefa, cand: Candidato, ultimaVista: string, cont: Contagem): Promise<void> {
  const ate = new Date(Date.parse(ultimaVista) + RETENCAO_PEDIDA_MS).toISOString()
  try {
    if (c.agora() >= c.t0 + BANCO_ATE_MS) { cont.retencaoFalhou++; return } // o registro já foi gravado: a retenção fica para a próxima avaliação
    const r = await c.sb.rpc('yt_watch_reter', { p_site: cand.siteId, p_video: cand.ytId, p_ate: ate }).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error) { if (eAusente(r.error)) cont.retencaoSemRpc++; else cont.retencaoFalhou++; return }
    if (r.data === 0) cont.retencaoSemAlvo++
  } catch {
    cont.retencaoFalhou++
  }
}

/** §5.5: avaliação `erro`. Erro igual só regrava a linha se for a avaliação mais recente do vídeo (Phil D3 e R2-1). */
async function gravarErro(c: ContextoTarefa, cand: Candidato, codigo: CodigoErro, cont: Contagem): Promise<void> {
  const agoraIso = new Date(c.agora()).toISOString()
  const u = cand.ultimas
  if (u !== null && u.ultimoErroId !== null && u.ultimoErroId === u.ultimaId && u.ultimoErro === codigo) {
    const r = await c.sb.from('ab_native_avaliacoes').update({ avaliada_em: agoraIso }).eq('id', u.ultimoErroId).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error) throw new ErroRegistro('banco', true)
    cont.erroRegravado++
    return
  }
  await inserirAvaliacao(c.sb, cand, {
    avaliadaEm: agoraIso, ateLidaEm: null, estado14: 'erro', motivo14: null, estado48: null, mistas48: null, mistas48ForaQuarentena: null, minDesdeEscrita: null,
    contagem: null, escritas: null, versaoRegra: REGRA_TESTE_YOUTUBE_VERSAO, registroId: null, erro: codigo, retroativa: false, aviso: null,
  })
}
