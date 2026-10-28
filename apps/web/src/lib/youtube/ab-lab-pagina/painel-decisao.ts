/** Modelo puro do painel "O que fica no vídeo?" (M7 T2). Sem banco, sem relógio próprio. */
import type { AbTestCardView } from '../ab-types'
import { rotuloDoDiaExtenso } from '../ab-rotulo-dia'
import type { EscolhaPainel, OpcaoPainel, PainelDecisao } from './tipos'

function ordenadas(card: AbTestCardView): AbTestCardView['variants'] {
  return [...card.variants].sort((a, b) =>
    a.isOriginal === b.isOriginal ? (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) : a.isOriginal ? -1 : 1)
}

function base(card: AbTestCardView, modo: PainelDecisao['modo'], p: Pick<PainelDecisao, 'opcoes' | 'padrao' | 'sugeridaLetra' | 'noArLetra' | 'podeDeixarVariante' | 'regraV2'>): PainelDecisao {
  return {
    testId: card.id, nomeVideo: card.videoTitle ?? card.name, tipo: card.type, modo,
    restoreSeq: card.restoreSeq, ...p,
    ...(modo === 'ativo' && card.diaV2 ? { diaDeTeto: rotuloDoDiaExtenso(card.diaV2.dia, card.diaV2.teto, { minusculo: true }) } : {}),
  }
}

export function painelDoAtivo(
  card: AbTestCardView,
  e: { ctrs: Record<string, number | null>; noArLetra: string; sugeridaId: string | null; regraV2: boolean; podeDeixarVariante: boolean },
): PainelDecisao {
  const opcoes: OpcaoPainel[] = ordenadas(card).map(v => ({
    varianteId: v.id, letra: v.label, original: v.isOriginal, titulo: v.title, miniatura: v.thumbUrl,
    ctr: e.ctrs[v.id] ?? null,
    noAr: v.label === e.noArLetra,
    sugerida: v.id === e.sugeridaId,
    estado: e.podeDeixarVariante || v.isOriginal ? 'escolhivel' : 'sem_permissao',
  }))
  const sug = opcoes.find(o => o.sugerida && o.estado === 'escolhivel') ?? null
  return base(card, 'ativo', {
    opcoes, padrao: sug?.varianteId ?? null,
    sugeridaLetra: opcoes.find(o => o.sugerida)?.letra ?? null,
    noArLetra: e.noArLetra, podeDeixarVariante: e.podeDeixarVariante, regraV2: e.regraV2,
  })
}

export function escolhaDe(p: PainelDecisao, varianteId: string): EscolhaPainel | null {
  const o = p.opcoes.find(x => x.varianteId === varianteId)
  if (!o || o.estado !== 'escolhivel') return null
  return { tipo: 'encerrar', varianteId, original: o.original }
}

function achar(p: PainelDecisao, varianteId: string | null): OpcaoPainel | null {
  return varianteId === null ? null : p.opcoes.find(o => o.varianteId === varianteId) ?? null
}

export function rotuloDoBotao(p: PainelDecisao, varianteId: string | null): string {
  const o = achar(p, varianteId)
  if (!o || o.estado !== 'escolhivel') return 'Escolha uma versão'
  return o.original ? `Encerrar e manter ${o.letra} (original)` : `Encerrar e deixar ${o.letra} no ar`
}

export function avisoDaEscolha(p: PainelDecisao, varianteId: string | null): string | null {
  const o = achar(p, varianteId)
  if (!o || !p.sugeridaLetra || o.sugerida) return null
  return o.original
    ? `O teste indicou ${p.sugeridaLetra}. Manter ${o.letra} encerra o teste agora, sem aplicar ${p.sugeridaLetra}.`
    : `O teste indicou ${p.sugeridaLetra}. Escolher ${o.letra} encerra o teste agora e coloca ${o.letra} no ar.`
}

export function mensagemDeFalha(
  p: PainelDecisao, varianteId: string, r: { tipo: 'servidor'; error: string } | { tipo: 'rede' },
): string {
  if (r.tipo === 'rede') return 'A conexão caiu e não deu para confirmar se mudou. Confira o vídeo no YouTube antes de tentar de novo.'
  const o = achar(p, varianteId)
  const letra = o?.letra ?? ''
  const continua = p.noArLetra === 'A' ? 'A original continua no ar.' : `${p.noArLetra} continua no ar.`
  return o?.original ? 'Não consegui encerrar o teste. Ele continua rodando.' : `Não consegui aplicar ${letra}. ${continua}`
}

export function mensagemDeFeito(p: PainelDecisao, varianteId: string, hojeDdMm: string): string {
  const o = achar(p, varianteId)
  const letra = o?.letra ?? ''
  const indicava = p.sugeridaLetra && !o?.sugerida ? ` O teste indicava ${p.sugeridaLetra}.` : ''
  if (o?.original) return `Teste encerrado. Você manteve ${letra} (original).${indicava}`
  const escolheu = indicava ? ` Você escolheu ${letra};${indicava.replace(' O teste', ' o teste')}` : ''
  return `Teste encerrado. ${letra} no ar desde ${hojeDdMm}.${escolheu}`
}
