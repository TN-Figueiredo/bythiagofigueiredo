/** Modelo puro de Concluídos: "quem venceu" e "no ar desde" (M7 T3). Só lê o que o banco gravou; nunca inventa data. */
import type { AbTestCardView, AbTestWithVariants } from '../ab-types'
import type { TelaV2 } from '../ab-gravacao/tela-v2'
import { camposDoTeste, paraRestoreStatus } from '../ab-restore'
import type { LinhaDoCaminho } from '../teste-youtube/nativo/lista'
import { diaMesSp } from '../ab-data-curta'
import { versaoDoRespondido, versoesDoDia14 } from '@/lib/youtube/teste-youtube/nativo/dia-14-estado'
import type { LinhaConcluida, PainelDecisao } from './tipos'

export const CONCLUIDOS_VISIVEIS = 3

type TelaConcluida = Extract<TelaV2, { fase: 'concluido' }>

export function noArDoTeste(
  t: {
    test_type: 'thumbnail' | 'title' | 'combo'; restore_status?: unknown; winner_variant_id: string | null
    winner_applied_at: string | null; completed_at: string | null
  },
  letraDe: (id: string) => string | null,
): { letra: string | null; desde: string | null; confirmado: boolean } {
  const rs = paraRestoreStatus(t.restore_status)
  if (rs) {
    const campos = camposDoTeste(t.test_type).map(c => rs[c])
    const todos = campos.every(c => c !== undefined && c.estado === 'ok')
    const destino = campos[0]?.destino
    if (todos && destino && campos.every(c => c?.destino === destino)) {
      const letra = destino === 'original' ? 'A' : letraDe(destino)
      const desde = campos.reduce<string | null>((m, c) => (c && (m === null || Date.parse(c.em) > Date.parse(m)) ? c.em : m), null)
      return { letra, desde, confirmado: letra !== null }
    }
    return { letra: null, desde: null, confirmado: false }
  }
  // Teste concluído pelo caminho v1, sem `restore_status` (dado de antes do P4): `winner_applied_at` é o que há.
  if (t.winner_variant_id && t.winner_applied_at) {
    const letra = letraDe(t.winner_variant_id)
    if (letra) return { letra, desde: t.winner_applied_at, confirmado: true }
  }
  return { letra: null, desde: null, confirmado: false }
}

/**
 * Título que está no ar num teste concluído (cabeçalho, M7b D19 / envio 1): com uma versão `confirmado` no ar, o `title_text` dela
 * (a original usa o título do vídeo); senão o original, nunca o de uma variante não confirmada.
 */
export function tituloNoArDoConcluido(
  t: Parameters<typeof noArDoTeste>[0] & { original_title: string | null; name: string },
  variantes: ReadonlyArray<{ id: string; letra: string; is_original: boolean; title_text: string | null }>,
): string {
  const original = t.original_title ?? t.name
  const letraDe = (id: string): string | null => variantes.find(v => v.id === id)?.letra ?? null
  const noAr = noArDoTeste(t, letraDe)
  if (!noAr.confirmado || !noAr.letra) return original
  const v = variantes.find(x => x.letra === noAr.letra)
  if (!v || v.is_original) return original
  return v.title_text ?? original
}

const SEM_VENCEDOR = new Set(['sem_diferenca', 'volume', 'dado', 'falha', 'aguardando', 'pendente', 'ilegivel'])
const TIPO_LAB = { title: 'Título', thumbnail: 'Miniatura', combo: 'Título e miniatura' } as const

function linhaDoLab(t: { card: AbTestCardView; bruto: AbTestWithVariants; painel: PainelDecisao | null; tela: TelaConcluida | null }): LinhaConcluida {
  const { card, bruto, painel, tela } = t
  const letraDe = (id: string): string | null => card.variants.find(v => v.id === id)?.label ?? null
  const noAr = noArDoTeste(bruto, letraDe)
  const original = card.variants.find(v => v.isOriginal)
  const w = bruto.winner_variant_id
  const wLetra = w && w !== original?.id ? letraDe(w) : null

  let resultado: string
  let apoio: string
  const apoioNoAr = noAr.confirmado && noAr.desde ? `no ar desde ${diaMesSp(noAr.desde)}` : 'no ar: não confirmado'
  if (tela?.aplicar) {
    resultado = `${tela.aplicar.letra} sugerido pelo teste`
    apoio = 'falta aplicar no vídeo'
  } else if (tela && SEM_VENCEDOR.has(tela.selo.tipo)) {
    resultado = 'Sem vencedor'
    apoio = apoioNoAr
  } else if (noAr.confirmado && noAr.letra && noAr.letra !== 'A') {
    resultado = `${noAr.letra} venceu`
    apoio = apoioNoAr
  } else if (noAr.confirmado && noAr.letra === 'A') {
    resultado = 'A (original) ficou'
    apoio = apoioNoAr
  } else if (wLetra) {
    resultado = `${wLetra} venceu`
    apoio = apoioNoAr
  } else if (tela?.selo.tipo === 'original' || (w !== null && w === original?.id)) {
    resultado = 'A (original) ficou'
    apoio = apoioNoAr
  } else {
    resultado = 'Sem vencedor'
    apoio = apoioNoAr
  }

  let acao: LinhaConcluida['acao'] = null
  if (painel) {
    if (painel.modo === 'aplicado') acao = { rotulo: 'Voltar à original', painel }
    else {
      const alvo = painel.opcoes.find(o => o.estado === 'escolhivel')
      if (alvo) acao = { rotulo: `Aplicar ${alvo.letra}`, painel }
    }
  }
  return {
    chave: `lab:${card.id}`, origem: 'lab', testId: card.id, ytId: bruto.youtube_video_id,
    titulo: card.videoTitle ?? card.name, miniaturaUrl: original?.thumbUrl ?? card.leaderThumbUrl,
    tipo: TIPO_LAB[card.type], resultado, apoio, acao,
    ordem: bruto.completed_at ?? bruto.winner_applied_at ?? card.createdAt,
  }
}

function linhaDoStudio(l: LinhaDoCaminho): LinhaConcluida | null {
  const r = l.registro
  if (!r || (l.estado !== 'ficou_no_ar' && l.estado !== 'respondido_sem_vencedor')) return null
  const campos = r.campos
  const tipo: LinhaConcluida['tipo'] = campos && campos.includes('titulo') && campos.includes('miniatura') ? 'Título e miniatura'
    : campos && campos.length === 1 && campos[0] === 'miniatura' ? 'Miniatura'
    : 'Título'
  const studio = 'você contou do Studio'
  let resultado = 'Sem vencedor'
  let apoio = studio
  if (l.estado === 'ficou_no_ar') {
    const versao = versaoDoRespondido(r, versoesDoDia14(r))
    resultado = r.respostaDono === 'venceu_original' || versao?.original ? 'A (original) ficou'
      : versao ? `${versao.letra} venceu` : 'Uma versão nova ficou'
    const dia = diaMesSp(r.respondidoEm)
    apoio = dia ? `no ar desde ${dia} · ${studio}` : studio
  }
  return {
    chave: `studio:${l.videoId}:${r.id}`, origem: 'studio', testId: null, ytId: l.ytId, titulo: l.titulo,
    miniaturaUrl: l.miniaturaUrl, tipo, resultado, apoio, acao: null, ordem: r.respondidoEm ?? r.inicio ?? r.updatedAt,
  }
}

export function linhasConcluidas(e: {
  testes: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; painel: PainelDecisao | null; tela: TelaConcluida | null }>
  linhasStudio: LinhaDoCaminho[]
  agora: Date
}): LinhaConcluida[] {
  const todas = [
    ...e.testes.map(linhaDoLab),
    ...e.linhasStudio.map(linhaDoStudio).filter((x): x is LinhaConcluida => x !== null),
  ]
  const t = (s: string): number => { const n = Date.parse(s); return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY }
  return todas.sort((a, b) => t(b.ordem) - t(a.ordem))
}
