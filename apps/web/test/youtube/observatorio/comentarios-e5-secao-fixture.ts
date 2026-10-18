// Fixture SINTÉTICA da seção de comentários (C2): nomes e textos inventados.
import type { CartaoIdentidade, CartaoTexto, ComentariosDoVideo, EstadoDoMarco, MotivoDoCartao, ResumoDoMarco } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { Marco } from '@/lib/youtube/observatorio/comentarios/tipos'
import type { OpcoesDaSecao } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/model'

export const T0 = Date.UTC(2026, 9, 6, 15, 0, 0) // 06/10/2026
export const DIA = 86_400_000
export const OPCOES: OpcoesDaSecao = { hojeSP: '2026-10-13', canalNome: 'Canal Exemplo', t0Ms: T0, descobertoEmMs: T0 + 4 * DIA }

export const resumo = (o: Partial<ResumoDoMarco> = {}): ResumoDoMarco => ({
  tomadoEmMs: T0 + 7 * DIA, idadeHoras: 168, amostra: 100, amostraCompleta: false, totalDoDia: 1240, escolhidos: 12, autoresConsultados: 20, autoresSemTamanho: 0, ...o,
})

export function cartao(ordem: number, motivo: MotivoDoCartao, o: Partial<CartaoIdentidade> = {}): CartaoIdentidade {
  return {
    ordem, motivo, curtidas: { 1: 'ainda_nao', 7: 100 - ordem, 30: 'ainda_nao' }, respostas: 0, criador: 'nao_vimos', criadorNome: 'Leo', posicao: { 1: null, 7: null, 30: null }, doCriador: false,
    entrouNoMarco: 7, nosMarcos: [7], saiuDoYouTubeDesde: null, faixas: { tamanho: null, razao: null },
    texto: `Comentário sintético número ${ordem}`, cortado: false, publicadoEm: '2026-10-07', respostasDoCriador: [],
    autor: { tipo: 'espectador' }, mencoesTrocadas: 0, ...o,
  }
}

export function doze(): CartaoIdentidade[] {
  const cs: CartaoIdentidade[] = []
  for (let i = 1; i <= 8; i++) cs.push(cartao(i, 'curtidos'))
  for (let i = 9; i <= 12; i++) cs.push(cartao(i, 'criador', { criador: i <= 11 ? 'respondeu' : 'nao_vimos', respostas: 2, respostasDoCriador: i <= 11 ? [{ texto: `Resposta ${i}`, cortado: false, publicadoEm: '2026-10-08T15:00:00.000Z' }] : [] }))
  return cs
}

export const OK7: EstadoDoMarco = { estado: 'ok', resumo: resumo() }
export function dados(o: Partial<{ marcos: Record<Marco, EstadoDoMarco>; comentarios: CartaoIdentidade[] }> = {}): ComentariosDoVideo {
  return {
    nivel: 'identidade',
    marcos: o.marcos ?? { 1: { estado: 'ok', resumo: resumo({ idadeHoras: 24 }) }, 7: OK7, 30: { estado: 'fecha_em', fechaEmMs: T0 + 30 * DIA } },
    comentarios: o.comentarios ?? doze().map(c => ({ ...c, nosMarcos: [1, 7] as Marco[], entrouNoMarco: 1 as Marco })),
  }
}
export type { CartaoTexto }
