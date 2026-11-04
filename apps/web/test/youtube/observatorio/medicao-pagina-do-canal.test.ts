// @vitest-environment node
// F3-cache T2b: a página do canal mede a abertura (tela 'canal'); o pacote vem do cache e não conta frio; as medidas somam na mesma medição.
import { describe, it, expect, vi } from 'vitest'
import { contarFrio, type MedicaoDaAbertura } from '@/lib/youtube/observatorio/medicao-abertura'

const gravadas: MedicaoDaAbertura[] = []
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/lib/youtube/observatorio/medicao-abertura', async orig => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/medicao-abertura')>()
  return { ...m, gravarAoFim: (x: MedicaoDaAbertura) => { gravadas.push(x) } }
})
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: ({ children }: { children: unknown }) => children }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/medidas/contexto-do-canal', () => ({
  lerMedidasDoCanal: async () => { contarFrio('medidas'); return {} }, contextoDoCanal: () => ({}),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/montar', () => ({
  // o pacote veio do cache: nada de contarFrio('pacotes'); a leitura das medidas é iniciada como no montarCanal real
  montarCanal: async (_id: string, _sp: unknown, o: { iniciarMedidas: (c: never) => Promise<unknown> }) => {
    await o.iniciarMedidas({} as never)
    return { tipo: 'nao_encontrado', pagina: { owns: { itens: [], principal: null, listaHref: '/l' } } }
  },
}))

describe('T2b: medição da página do canal', () => {
  it('registra tela canal, frios.pacotes ausente (pacote em cache) e conta a leitura das medidas na mesma medição', async () => {
    const { default: Page } = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
    await Page({ params: Promise.resolve({ id: 'c1' }), searchParams: Promise.resolve({}) })
    expect(gravadas).toHaveLength(1)
    const m = gravadas[0]!
    expect(m.tela).toBe('canal')
    expect(m.frios.pacotes ?? 0).toBe(0)
    expect(m.frios.medidas).toBe(1)
    expect(Object.keys(m.etapas)).toContain('medidas')
  })
})
