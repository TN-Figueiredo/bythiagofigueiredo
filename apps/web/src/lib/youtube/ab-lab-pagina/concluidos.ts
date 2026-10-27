/** Modelo puro de Concluídos: "quem venceu" e "no ar desde" (M7 T3). Só lê o que o banco gravou; nunca inventa data. */
import type { AbTestCardView, AbTestWithVariants, DisplayLabel } from '../ab-types'
import type { TelaV2 } from '../ab-gravacao/tela-v2'
import { camposDoTeste, paraRestoreStatus } from '../ab-restore'
import { noArConfirmado, type TentativaNoAr } from '../ab-no-ar'
import type { LinhaDoCaminho } from '../teste-youtube/nativo/lista'
import { diaMesSp } from '../ab-data-curta'
import { versaoDoRespondido, versoesDoDia14 } from '@/lib/youtube/teste-youtube/nativo/dia-14-estado'
import type { PainelEscolha } from './painel-escolha'
import type { LinhaConcluida, SeloDeLinha, SelosDaLinha } from './tipos'

export const CONCLUIDOS_VISIVEIS = 3

type TelaConcluida = Extract<TelaV2, { fase: 'concluido' }>

const LETRAS: ReadonlyArray<string> = ['A', 'B', 'C', 'D']

/**
 * Delega a `noArConfirmado` (M7b T2). `variantes` é opcional só para os chamadores antigos: sem ele, as variantes saem do que o
 * próprio teste cita (vencedor e destinos do registro), com a original sob o id 'original' e a letra A.
 */
export function noArDoTeste(
  t: {
    test_type: 'thumbnail' | 'title' | 'combo'; restore_status?: unknown; winner_variant_id: string | null
    winner_applied_at: string | null; completed_at: string | null; restore_seq?: number
  },
  letraDe: (id: string) => string | null,
  historico: TentativaNoAr[] = [],
  variantes?: ReadonlyArray<{ id: string; label: DisplayLabel; is_original: boolean }>,
): { letra: string | null; desde: string | null; confirmado: boolean } {
  let vs = variantes
  if (!vs) {
    const rs = paraRestoreStatus(t.restore_status)
    const ids = new Set<string>()
    if (t.winner_variant_id) ids.add(t.winner_variant_id)
    for (const c of camposDoTeste(t.test_type)) { const d = rs?.[c]?.destino; if (d && d !== 'original') ids.add(d) }
    for (const h of historico) if (h.destino !== 'original') ids.add(h.destino)
    const sint: Array<{ id: string; label: DisplayLabel; is_original: boolean }> = [{ id: 'original', label: 'A', is_original: true }]
    for (const id of ids) { const l = letraDe(id); if (l && LETRAS.includes(l)) sint.push({ id, label: l as DisplayLabel, is_original: false }) }
    vs = sint
  }
  const r = noArConfirmado({ ...t, restore_seq: t.restore_seq ?? 0, variantes: vs }, historico)
  if (r.tipo === 'confirmado') return { letra: r.letra, desde: r.desde, confirmado: true }
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

/** Os dois selos da linha (mockup r4): o que o teste disse e o que está no ar. Nunca mais de dois. */
function selosDaLinha(t: { card: AbTestCardView; bruto: AbTestWithVariants; tela: TelaConcluida; noAr: ReturnType<typeof noArDoTeste> }): SelosDaLinha {
  const { card, bruto, tela, noAr } = t
  const selo = tela.selo
  const teste: SeloDeLinha = selo.tipo === 'vence' ? { texto: `Teste: sugeriu ${selo.letra}`, icone: 'star', tom: 'neutro' }
    : selo.tipo === 'original' ? { texto: 'Teste: sugeriu A', icone: 'star', tom: 'neutro' }
    : selo.tipo === 'sem_diferenca' ? { texto: 'Teste: sem diferença clara', icone: 'info', tom: 'neutro' }
    : { texto: 'Teste: sem vencedor', icone: 'info', tom: 'neutro' }
  if (!noAr.confirmado || !noAr.letra) return [teste, { texto: 'No ar: não confirmado', icone: 'info', tom: 'neutro' }]
  const original = card.variants.find(v => v.isOriginal)
  const ehOriginal = original?.label === noAr.letra || noAr.letra === 'A'
  const dia = noAr.desde ? diaMesSp(noAr.desde) : ''
  const base = ehOriginal ? `${noAr.letra} (original) no ar` : `${noAr.letra} no ar`
  const noArId = card.variants.find(v => v.label === noAr.letra)?.id ?? null
  const doDono = bruto.escolha_em != null && bruto.escolha_variant_id != null && bruto.escolha_variant_id === noArId
  if (doDono) {
    return [teste, { texto: `${base}${dia && !ehOriginal ? ` desde ${dia}` : ''} · ${ehOriginal ? 'mantida' : 'escolhida'} por você`, icone: 'user', tom: 'esc' }]
  }
  return [teste, { texto: `${base}${dia ? ` desde ${dia}` : ''}`, icone: 'dot', tom: 'dia' }]
}

function linhaDoLab(t: { card: AbTestCardView; bruto: AbTestWithVariants; painel: PainelEscolha | null; tela: TelaConcluida | null; historico?: TentativaNoAr[] | null }): LinhaConcluida {
  const { card, bruto, painel, tela } = t
  const letraDe = (id: string): string | null => card.variants.find(v => v.id === id)?.label ?? null
  const noAr = t.historico === null ? { letra: null, desde: null, confirmado: false } : noArDoTeste(bruto, letraDe, t.historico ?? [], card.variants.map(v => ({ id: v.id, label: v.label, is_original: v.isOriginal })))
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

  return {
    chave: `lab:${card.id}`, origem: 'lab', testId: card.id, ytId: bruto.youtube_video_id,
    titulo: card.videoTitle ?? card.name, miniaturaUrl: original?.thumbUrl ?? card.leaderThumbUrl,
    tipo: TIPO_LAB[card.type], resultado, apoio, painel,
    selos: tela ? selosDaLinha({ card, bruto, tela, noAr }) : null,
    concluidoEm: bruto.completed_at ? (diaMesSp(bruto.completed_at) || null) : null,
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
    miniaturaUrl: l.miniaturaUrl, tipo, resultado, apoio, painel: null, selos: null, concluidoEm: null, ordem: r.respondidoEm ?? r.inicio ?? r.updatedAt,
  }
}

export function linhasConcluidas(e: {
  testes: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; painel: PainelEscolha | null; tela: TelaConcluida | null; historico?: TentativaNoAr[] | null }>
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
