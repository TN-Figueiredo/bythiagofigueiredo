// @vitest-environment jsdom
// M6a T13c: a frase do mês fora no diálogo de remover canal (recusa do apagar) e o aviso, sem bloquear, ao pedir o guardar.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import { RemoveDialog, type ImpactAnswer } from '@/app/cms/(authed)/youtube/competitors/_canais/remove-dialog'
import { fraseDoErro } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'

const IMPACT = { name: 'Viaje com Marina', videos: 12, pinned: 2, versions: 36, dailyDays: 14, bookmarks: 1, readings: 200, watch: { readings: 20, thumbs: 0, alvos: 0 } }
const ARQ = { meses: 0, de: null, ate: null, foraDoBanco: { meses: 0, de: null, ate: null }, videosRetirados: { n: 0, de: null, ate: null }, imagensBlob: 0 }
const MES = { meses: 1 as const, nomes: ['2026-10-01'], liberarAPartir: '2026-11-24' }
const resp = (extra: Record<string, unknown> = {}): ImpactAnswer =>
  ({ ok: true, impact: IMPACT, semGuardar: { pode: true }, arquivo: ARQ, capacidade: 'nao-sim', dataDoComando: null, ...extra }) as ImpactAnswer

function mount(o: { impact?: () => Promise<ImpactAnswer>; apagar?: ReturnType<typeof vi.fn>; pedir?: ReturnType<typeof vi.fn>; hojeSP?: string; podeAdministrar?: boolean } = {}) {
  const onApagar = o.apagar ?? vi.fn()
  const onPedir = o.pedir ?? vi.fn(async () => ({ ok: true as const, jaPedido: false }))
  const r = render(
    <div data-obs=""><div data-obs-screen="canais">
      <RemoveDialog id="c1" name="Viaje com Marina" onImpact={o.impact ?? (async () => resp())} onPedir={onPedir as never} onApagar={onApagar as never}
        onCancel={vi.fn()} onDone={vi.fn()} onConferir={vi.fn()} onBloqueio={vi.fn()} hojeSP={o.hojeSP} podeAdministrar={o.podeAdministrar} trap={() => {}} />
    </div></div>,
  )
  const q = <T extends Element = HTMLElement>(s: string) => r.container.querySelector<T>(s)
  const btn = (t: string | RegExp) => [...r.container.querySelectorAll('button')].find(b => (typeof t === 'string' ? b.textContent === t : t.test(b.textContent ?? '')))!
  return { ...r, onApagar, onPedir, q, btn }
}
afterEach(() => { vi.useRealTimers(); cleanup() })

const recusaApagar = (mesFora?: typeof MES) => vi.fn(async () => ({ ok: false as const, codigo: 'mes_destacado_em_transito' as const, frase: 'Não dá para remover canal agora: o mês saiu das telas.', ...(mesFora ? { mesFora } : {}) }))
async function tentarApagar(m: ReturnType<typeof mount>) {
  fireEvent.click(m.q('input[value="apagar"]')!)
  fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
  await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
}

describe('T13c · recusa do apagar com mês fora', () => {
  it('com mesFora: forma longa (negrito, resto, ⓘ), só Fechar e sem "Escolher guardar"', async () => {
    const m = mount({ apagar: recusaApagar(MES), hojeSP: '2026-10-28', podeAdministrar: true }); await act(async () => {})
    await tentarApagar(m)
    const faixa = m.q('.fx-msg.fx-err')!
    expect(faixa.querySelector('b')!.textContent).toBe('O mês saiu das telas enquanto este diálogo estava aberto. Outubro de 2026 saiu das telas e o espaço dele ainda não foi liberado.')
    expect(faixa.textContent).toContain('Nada foi removido.')
    expect(faixa.textContent).toContain('a partir de 24/11')
    expect(faixa.querySelector('.ri-ibtn')).not.toBeNull()
    expect(m.btn('Fechar')).toBeTruthy()
    expect(m.btn('Escolher guardar no NAS')).toBeUndefined()
  })
  it('depois da data e com direito: link para o Arquivo', async () => {
    const m = mount({ apagar: recusaApagar(MES), hojeSP: '2026-11-25', podeAdministrar: true }); await act(async () => {})
    await tentarApagar(m)
    expect(m.q('.fx-msg.fx-err a')!.getAttribute('href')).toContain('/arquivo')
  })
  it('sem mesFora: cai na frase do catálogo (forma curta), também só Fechar', async () => {
    const m = mount({ apagar: recusaApagar() }); await act(async () => {})
    await tentarApagar(m)
    expect(m.q('.fx-msg.fx-err')!.textContent).toContain('Não dá para remover canal agora: o mês saiu das telas.')
    expect(m.q('.fx-msg.fx-err .ri-ibtn')).toBeNull()
    expect(m.btn('Escolher guardar no NAS')).toBeUndefined()
  })
  it('o modelo conhece o código: frase do catálogo e não é passageiro', () => {
    expect(fraseDoErro('mes_destacado_em_transito', undefined, 'apagar').corpo).toContain('o mês saiu das telas')
  })
})

describe('T13c · aviso ao abrir (guardar)', () => {
  it('com mês fora: aviso com a frase do pedido parado, e guardar segue ativo e funciona', async () => {
    const m = mount({ impact: async () => resp({ mesFora: MES }), hojeSP: '2026-10-28', podeAdministrar: false }); await act(async () => {})
    const aviso = m.q('.fx-mes-fora')!
    expect(aviso.textContent).toContain('Outubro de 2026 saiu das telas')
    expect(aviso.textContent).toContain('o pedido fica parado até o mês voltar ou ser apagado')
    expect(aviso.textContent).not.toContain('enquanto este diálogo')
    const guardar = m.btn(/Parar coleta e agendar/)
    expect(guardar.getAttribute('aria-disabled')).toBeNull()
    await act(async () => { fireEvent.click(guardar) })
    expect(m.onPedir).toHaveBeenCalledTimes(1)
  })
  it('sem mês fora: nada muda', async () => {
    const m = mount(); await act(async () => {})
    expect(m.q('.fx-mes-fora')).toBeNull()
  })
  it('leitura falhou (a action devolve sem mesFora): sem aviso, guardar ativo', async () => {
    const m = mount({ impact: async () => resp() }); await act(async () => {})
    expect(m.q('.fx-mes-fora')).toBeNull()
    expect(m.btn(/Parar coleta e agendar/).getAttribute('aria-disabled')).toBeNull()
  })
  it('no apagar o aviso do guardar não aparece', async () => {
    const m = mount({ impact: async () => resp({ mesFora: MES }) }); await act(async () => {})
    fireEvent.click(m.q('input[value="apagar"]')!)
    expect(m.q('.fx-mes-fora')).toBeNull()
  })
})
