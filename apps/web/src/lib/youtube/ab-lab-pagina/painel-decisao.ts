/** Modelo puro do painel "O que fica no vídeo?" (M7 T2). Sem banco, sem relógio próprio. */
import type { AbTestCardView } from '../ab-types'
import type { TelaV2 } from '../ab-gravacao/tela-v2'
import { diaMesSp } from '../ab-data-curta'
import { rotuloDoDiaExtenso } from '../ab-rotulo-dia'
import type { EscolhaPainel, OpcaoPainel, PainelDecisao } from './tipos'

type TelaConcluida = Extract<TelaV2, { fase: 'concluido' }>

function ordenadas(card: AbTestCardView): AbTestCardView['variants'] {
  return [...card.variants].sort((a, b) =>
    a.isOriginal === b.isOriginal ? (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) : a.isOriginal ? -1 : 1)
}

function base(card: AbTestCardView, modo: PainelDecisao['modo'], p: Pick<PainelDecisao, 'opcoes' | 'padrao' | 'sugeridaLetra' | 'noArLetra' | 'voltarAte' | 'podeDeixarVariante' | 'regraV2'>): PainelDecisao {
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
    noArLetra: e.noArLetra, voltarAte: null, podeDeixarVariante: e.podeDeixarVariante, regraV2: e.regraV2,
  })
}

export function painelDoConcluido(
  card: AbTestCardView,
  tela: TelaConcluida,
  e: { ctrs: Record<string, number | null>; sugeridaId: string | null; revertExpiresAt: string | null; agora: Date },
): PainelDecisao | null {
  const aplicada = tela.noAr.tipo === 'aplicada' ? tela.noAr : null
  // dupla guarda: o servidor recusa depois do prazo (revert_expires_at <= agora)
  const prazoAberto = e.revertExpiresAt !== null && Date.parse(e.revertExpiresAt) > e.agora.getTime()
  const voltar = aplicada !== null && tela.voltar && prazoAberto
  const alvo = tela.aplicar ?? tela.aplicarDeNovo
  if (!voltar && !alvo) return null

  const modo = voltar ? 'aplicado' : 'concluido'
  const noArLetra = aplicada ? aplicada.letra : 'A'
  const opcoes: OpcaoPainel[] = ordenadas(card).map(v => {
    let estado: OpcaoPainel['estado'] = 'em_breve'
    if (voltar) {
      if (v.isOriginal) estado = 'escolhivel'
      else if (v.label === noArLetra) estado = 'no_ar_fixo'
    } else if (alvo && v.id === alvo.variant_id) estado = 'escolhivel'
    return {
      varianteId: v.id, letra: v.label, original: v.isOriginal, titulo: v.title, miniatura: v.thumbUrl,
      ctr: e.ctrs[v.id] ?? null,
      noAr: v.label === noArLetra,
      sugerida: v.id === e.sugeridaId || (alvo !== null && v.id === alvo.variant_id),
      estado,
    }
  })
  const padrao = voltar ? opcoes.find(o => o.original)?.varianteId ?? null : alvo?.variant_id ?? null
  const futuro = prazoAberto && e.revertExpiresAt ? diaMesSp(e.revertExpiresAt) : ''
  return base(card, modo, {
    opcoes, padrao,
    sugeridaLetra: opcoes.find(o => o.sugerida)?.letra ?? null,
    noArLetra, voltarAte: futuro || null, podeDeixarVariante: true, regraV2: true,
  })
}

export function escolhaDe(p: PainelDecisao, varianteId: string): EscolhaPainel | null {
  const o = p.opcoes.find(x => x.varianteId === varianteId)
  if (!o || o.estado !== 'escolhivel') return null
  if (p.modo === 'ativo') return { tipo: 'encerrar', varianteId, original: o.original }
  if (p.modo === 'concluido') return { tipo: 'aplicar_sugerida', varianteId }
  return o.original ? { tipo: 'voltar' } : null
}

function achar(p: PainelDecisao, varianteId: string | null): OpcaoPainel | null {
  return varianteId === null ? null : p.opcoes.find(o => o.varianteId === varianteId) ?? null
}

export function rotuloDoBotao(p: PainelDecisao, varianteId: string | null): string {
  const o = achar(p, varianteId)
  if (!o || o.estado !== 'escolhivel') return 'Escolha uma versão'
  if (p.modo === 'ativo') return o.original ? `Encerrar e manter ${o.letra} (original)` : `Encerrar e deixar ${o.letra} no ar`
  if (p.modo === 'concluido') return `Aplicar ${o.letra} ao vídeo`
  return 'Voltar à original'
}

export function avisoDaEscolha(p: PainelDecisao, varianteId: string | null): string | null {
  const o = achar(p, varianteId)
  if (p.modo !== 'ativo' || !o || !p.sugeridaLetra || o.sugerida) return null
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
  if (p.modo === 'ativo') return o?.original ? 'Não consegui encerrar o teste. Ele continua rodando.' : `Não consegui aplicar ${letra}. ${continua}`
  if (p.modo === 'concluido') return `Não consegui aplicar ${letra}. ${continua}`
  return `Não consegui voltar à original. ${continua}`
}

export function mensagemDeFeito(p: PainelDecisao, varianteId: string, hojeDdMm: string): string {
  const o = achar(p, varianteId)
  const letra = o?.letra ?? ''
  if (p.modo === 'aplicado') return 'A original voltou ao ar.'
  if (p.modo === 'concluido') {
    return p.voltarAte ? `${letra} no ar desde ${hojeDdMm}. Dá para voltar à original até ${p.voltarAte}.` : `${letra} no ar desde ${hojeDdMm}.`
  }
  const indicava = p.sugeridaLetra && !o?.sugerida ? ` O teste indicava ${p.sugeridaLetra}.` : ''
  if (o?.original) return `Teste encerrado. Você manteve ${letra} (original).${indicava}`
  const escolheu = indicava ? ` Você escolheu ${letra};${indicava.replace(' O teste', ' o teste')}` : ''
  return `Teste encerrado. ${letra} no ar desde ${hojeDdMm}.${escolheu}`
}
