// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { faixaDaPagina } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-da-pagina'
import type { AbTestBaseView } from '@/lib/youtube/ab-types'

const AGORA = new Date('2026-10-27T12:00:00Z')
const haMin = (m: number) => new Date(AGORA.getTime() - m * 60000).toISOString()
function view(status: string, em: string | null): AbTestBaseView {
  return {
    status, variantDb: [], youtubeVideoId: 'abc', noArAntes: null,
    restoreStatus: em ? { title: { estado: 'em_andamento', destino: 'original', em, attempts: 1, escreveu: null, erro: null } } : null,
  } as unknown as AbTestBaseView
}

describe('M7d T3b: faixaDaPagina.escrevendo', () => {
  it('campo em_andamento de 3 min atrás: escrevendo', () => {
    expect(faixaDaPagina(view('active', haMin(3)), null, AGORA).escrevendo).toBe(true)
  })
  it('de 6 min atrás: não escrevendo, mesmo com emAndamentoDesde preenchido', () => {
    const r = faixaDaPagina(view('active', haMin(6)), null, AGORA)
    expect(r.emAndamentoDesde).not.toBeNull()
    expect(r.escrevendo).toBe(false)
  })
  it('sem campo em andamento: false (ramo ativo sem faixa)', () => {
    expect(faixaDaPagina(view('active', null), null, AGORA).escrevendo).toBe(false)
  })
  it('dois campos em andamento: a ilha usa o mais recente', () => {
    const v = {
      status: 'active', variantDb: [], youtubeVideoId: 'abc', noArAntes: null,
      restoreStatus: {
        title: { estado: 'em_andamento', destino: 'original', em: haMin(7), attempts: 1, escreveu: null, erro: null },
        thumbnail: { estado: 'em_andamento', destino: 'original', em: haMin(1), attempts: 1, escreveu: null, erro: null },
      },
    } as unknown as AbTestBaseView
    expect(faixaDaPagina(v, null, AGORA).emAndamentoDesde).toBe(haMin(1))
  })
})
