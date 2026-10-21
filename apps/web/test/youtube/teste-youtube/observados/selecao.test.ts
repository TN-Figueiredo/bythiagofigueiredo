// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { selecionarAlvos, type AlvoObs, type CursorObs } from '@/lib/youtube/teste-youtube/observados/selecao'

const alvo = (n: number, o: Partial<AlvoObs> = {}): AlvoObs => ({ siteId: 's', ytId: 'v' + String(n).padStart(10, '0'), rodadas: 10, ultimaRodadaEm: '2026-10-20T00:00:00Z', saiuEm: null, saiuPor: null, ...o })
const cursor = (a: AlvoObs, o: Partial<CursorObs> = {}): CursorObs => ({ siteId: a.siteId, ytId: a.ytId, avaliadoAteRodada: a.rodadas, avaliadoEm: '2026-10-20T06:00:00Z', ...o })

describe('selecionarAlvos', () => {
  it('3 alvos sem troca, já avaliados e sem rodada nova -> nenhum devido', () => {
    const as = [alvo(1), alvo(2), alvo(3)]
    expect(selecionarAlvos(as, as.map(a => cursor(a))).escolhidos).toEqual([])
  })
  it('sem cursor entra; rodadas diferentes entra (<>, inclusive cursor MAIOR que rodadas: alvo recriado pela poda)', () => {
    const a = alvo(1), b = alvo(2, { rodadas: 3 }), c = alvo(3)
    const out = selecionarAlvos([a, b, c], [cursor(b, { avaliadoAteRodada: 120 }), cursor(c)]).escolhidos
    expect(out.map(x => x.ytId)).toEqual([a.ytId, b.ytId])
  })
  it('rodada mais nova que avaliado_em entra mesmo com a mesma contagem', () => {
    const a = alvo(1, { ultimaRodadaEm: '2026-10-20T07:00:00Z' })
    expect(selecionarAlvos([a], [cursor(a)]).escolhidos).toHaveLength(1)
  })
  it('60 alvos sem cursor: teto de 50 e, no 2º disparo, os 10 restantes (nenhum starvation)', () => {
    const as = Array.from({ length: 60 }, (_, i) => alvo(i))
    const d1 = selecionarAlvos(as, [])
    expect(d1.escolhidos).toHaveLength(50)
    expect(d1.devidos).toBe(60)
    const cs = d1.escolhidos.map(a => cursor(a))
    const d2 = selecionarAlvos(as, cs)
    expect(d2.escolhidos).toHaveLength(10)
    expect(new Set([...d1.escolhidos, ...d2.escolhidos].map(a => a.ytId)).size).toBe(60)
  })
  it('ordem: sem cursor primeiro, depois o avaliado há mais tempo', () => {
    const a = alvo(1, { rodadas: 11 }), b = alvo(2, { rodadas: 11 }), c = alvo(3)
    const out = selecionarAlvos([a, b, c], [cursor(a, { avaliadoAteRodada: 5, avaliadoEm: '2026-10-20T05:00:00Z' }), cursor(b, { avaliadoAteRodada: 5, avaliadoEm: '2026-10-20T01:00:00Z' })]).escolhidos
    expect(out.map(x => x.ytId)).toEqual([c.ytId, b.ytId, a.ytId])
  })
})
