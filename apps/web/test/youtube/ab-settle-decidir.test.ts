import { describe, it, expect } from 'vitest'
import { decidirCampo, ultimaEscritaDoApp, type EntradaTitulo, type EntradaThumb } from '@/lib/youtube/ab-settle-decidir'
import type { DhashDaVariante } from '@/lib/youtube/ab-variant-dhash'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'

const V = [{ id: 'A', title_text: null }, { id: 'B', title_text: 'Título B' }, { id: 'C', title_text: 'Título C' }]
const T = (atual: EntradaTitulo['atual'], over: Partial<EntradaTitulo> = {}): EntradaTitulo =>
  ({ campo: 'title', destino: 'original', atual, originalTitle: 'Original', variantes: V, forcar: false, ...over })

describe('título', () => {
  it('1: já é o destino → ok sem escrever (comparação sem espaços nas pontas)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: '  Original ' }))).toEqual({ acao: 'ok_sem_escrever' }))
  it('2: é de outra variante → escreve', () => expect(decidirCampo(T({ tipo: 'lido', valor: 'Título C' }))).toEqual({ acao: 'escrever' }))
  it('2: é o original e o destino é B → escreve', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Original' }, { destino: { varianteId: 'B' } }))).toEqual({ acao: 'escrever' }))
  it('3: outro valor → pulado_drift; com forcar → escreve', () => {
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Editado no Studio' }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: null })
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Editado no Studio' }, { forcar: true }))).toEqual({ acao: 'escrever' })
  })
  it('5: leitura falhou → falhar com o erro', () =>
    expect(decidirCampo(T({ tipo: 'falha', erro: { status: 503, reason: 'backendError' } }))).toMatchObject({ acao: 'falhar' }))
  it('7: vídeo inexistente → desistir', () =>
    expect(decidirCampo(T({ tipo: 'video_inexistente' }))).toEqual({ acao: 'desistir', motivo: 'video_inexistente' }))
  it('sem original: original_title nulo → pulado_sem_original', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Título B' }, { originalTitle: null }))).toEqual({ acao: 'pular', estado: 'pulado_sem_original', motivo: null }))
  it('16: variante original com title_text próprio no ar, destino original → linha 2 (escreve original_title)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Título da A' }, { variantes: [{ id: 'A', title_text: 'Título da A' }, ...V.slice(1)] }))).toEqual({ acao: 'escrever' }))
  it('destino variante sem title_text → falhar (variante_sem_titulo)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Original' }, { destino: { varianteId: 'A' } }))).toMatchObject({ acao: 'falhar', erro: { motivo: 'variante_sem_titulo' } }))
})

describe('thumbnail', () => {
  const agora = new Date('2026-10-12T12:00:00Z')
  const ok = (d: string): DhashDaVariante => ({ tipo: 'ok', dhash: d })
  const H = { A: '0000000000000000', B: 'ffffffffffffffff', C: '00000000ffffffff' }
  const base = (over: Partial<EntradaThumb> = {}): EntradaThumb => ({
    campo: 'thumbnail', destino: 'original', atual: { tipo: 'lido', dhash: H.A }, originalNoBlob: true,
    dhashes: new Map([['A', ok(H.A)], ['B', ok(H.B)], ['C', ok(H.C)]]), idOriginal: 'A',
    ultimaEscrita: new Date('2026-10-10T08:00:00Z'), marcador: null, agora, forcar: false, ...over })
  it('1: atual a ≤6 do destino, última escrita há 2 dias → ok sem escrever', () => expect(decidirCampo(base()).acao).toBe('ok_sem_escrever'))
  it('2: atual é B → escreve', () => expect(decidirCampo(base({ atual: { tipo: 'lido', dhash: H.B } })).acao).toBe('escrever'))
  it('3: atual não casa com nada, todos calculados → pulado_drift; forcar → escreve', () => {
    const atual = { tipo: 'lido' as const, dhash: '0f0f0f0f0f0f0f0f' }
    expect(decidirCampo(base({ atual }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: null })
    expect(decidirCampo(base({ atual, forcar: true })).acao).toBe('escrever')
  })
  it('4: não casa e alguma variante sem base → pulado_drift sem_base_de_comparacao; forcar → escreve', () => {
    const atual = { tipo: 'lido' as const, dhash: '0f0f0f0f0f0f0f0f' }
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'sem_base', motivo: 'blob_404' }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ atual, dhashes }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: 'sem_base_de_comparacao' })
    expect(decidirCampo(base({ atual, dhashes, forcar: true })).acao).toBe('escrever')
  })
  it('5: probeThumb falhou, ou Blob 5xx de variante → falhar', () => {
    expect(decidirCampo(base({ atual: { tipo: 'falha', erro: { motivo: 'hqdefault_indisponivel' } } })).acao).toBe('falhar')
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'falha', erro: new YouTubeApiError(503, 'blob_503', 'blob') }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ atual: { tipo: 'lido', dhash: '0f0f0f0f0f0f0f0f' }, dhashes })).acao).toBe('falhar')
  })
  it('7: vídeo inexistente → desistir', () => expect(decidirCampo(base({ atual: { tipo: 'video_inexistente' } })).acao).toBe('desistir'))
  it('sem original no Blob → pulado_sem_original', () => expect(decidirCampo(base({ originalNoBlob: false })).acao).toBe('pular'))
  it('D7: destino variante sem arquivo (404) → falhar arquivo_do_destino_indisponivel', () => {
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'sem_base', motivo: 'blob_404' }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ destino: { varianteId: 'B' }, dhashes }))).toMatchObject({ acao: 'falhar', erro: { motivo: 'arquivo_do_destino_indisponivel' } })
  })
  it('18: já é B mas a última escrita foi há 1 h → escreve', () =>
    expect(decidirCampo(base({ destino: { varianteId: 'B' }, atual: { tipo: 'lido', dhash: H.B }, ultimaEscrita: new Date('2026-10-12T11:00:00Z') })).acao).toBe('escrever'))
  it('18: 3:00 exatas já NÃO é recente (menos de 3 h = recente) → ok sem escrever', () =>
    expect(decidirCampo(base({ ultimaEscrita: new Date('2026-10-12T09:00:00Z') })).acao).toBe('ok_sem_escrever'))
  it('18: marcador não nulo → escreve', () => expect(decidirCampo(base({ marcador: 'B' })).acao).toBe('escrever'))
  it('18: destino a ≤6 de outra variante → escreve sempre', () => {
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', ok('0000000000000003')], ['C', ok(H.C)]])
    expect(decidirCampo(base({ dhashes })).acao).toBe('escrever')
  })
})

describe('ultimaEscritaDoApp', () => {
  it('o mais recente entre o início do último ciclo, o em do próprio campo (escreveu !== false) e winner_applied_at', () => {
    const t = { inicioUltimoCiclo: '2026-10-10T08:00:00Z', winnerAppliedAt: null,
      restoreStatus: { thumbnail: { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, attempts: 0, em: '2026-10-12T11:00:00Z' } } as RestoreStatus }
    expect(ultimaEscritaDoApp(t, 'thumbnail')).toEqual(new Date('2026-10-12T11:00:00Z'))
  })
  it('F-P2: em de campo que não escreveu (escreveu false) e em do OUTRO campo não contam', () => {
    const rs = { title: { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, attempts: 0, em: '2026-10-12T11:30:00Z' },
                 thumbnail: { estado: 'pulado_drift', destino: 'original', forcado: false, escreveu: false, erro: null, attempts: 0, em: '2026-10-12T11:40:00Z' } } as RestoreStatus
    expect(ultimaEscritaDoApp({ inicioUltimoCiclo: '2026-10-10T08:00:00Z', winnerAppliedAt: null, restoreStatus: rs }, 'thumbnail')).toEqual(new Date('2026-10-10T08:00:00Z'))
  })
  it('tudo nulo → null (nunca "agora")', () => expect(ultimaEscritaDoApp({ inicioUltimoCiclo: null, restoreStatus: null, winnerAppliedAt: null }, 'thumbnail')).toBeNull())
})
