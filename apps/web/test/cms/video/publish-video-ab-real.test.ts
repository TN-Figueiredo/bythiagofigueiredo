// @vitest-environment node
// S8-F4 (Yannis B2): publishVideo contra as ações REAIS do A/B Lab (sem mock de createAbTest/createTextVariant),
// sobre o banco falso único (helpers/banco-ab).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SITE, criarBanco, servicoAtual } from '../../helpers/banco-ab'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servicoAtual.cliente }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }) }))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/pipeline/load-video-detail', () => ({ loadVideoDetail: vi.fn() }))

// Só as bordas externas (YouTube/token); as ações do A/B Lab são as reais.
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn().mockResolvedValue({ accessToken: 'tok' }) }))
vi.mock('@/lib/youtube/channel-account', () => ({ channelAccountIdForVideo: vi.fn().mockResolvedValue('UC1') }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ captureOriginalMetadata: vi.fn().mockResolvedValue({ title: 'Título A' }), updateVideoMetadata: vi.fn() }))

import { publishVideo } from '@/app/cms/(authed)/video/[id]/edit/actions'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'

const DRAFT = {
  firstOnAir: 'A',
  variants: [
    { id: 'A', role: 'challenger', title: 'Orig', brief: 'b A' },
    { id: 'B', role: 'challenger', title: 'B', brief: 'b B' },
    { id: 'C', role: 'challenger', title: 'C', brief: 'b C' },
    { id: 'D', role: 'winner', title: 'D', brief: 'b D' },
  ],
}
const detalhe = () => ({
  id: 'p1', code: 'VID-001', stage: 'pos_producao', language: 'pt-br', version: 1, youtubeVideoId: 'video-interno',
  sections: { publish_pt: DRAFT },
  abJoinFacts: { youtubeVideoId: 'video-interno', thumbnailHqUrl: 'https://x/t.jpg', durationSeconds: 600 },
})

/** Banco com o vídeo e sem teste aberto nele (o modelo de criarBanco entra como concluído), mais content_pipeline. */
function montar(falharNaInsercao?: number, falharNoDelete = false) {
  const banco = criarBanco({ status: 'completed', testType: 'title', regra: 'v2' })
  let insercoes = 0
  const publicado = { data: { id: 'p1', stage: 'published', version: 2 }, error: null }
  const cadeia: Record<string, unknown> = {}
  for (const m of ['update', 'eq', 'select']) cadeia[m] = () => cadeia
  cadeia.single = () => Promise.resolve(publicado)
  servicoAtual.cliente = {
    from(t: string) {
      if (t === 'content_pipeline') return cadeia
      const q = banco.supabase.from(t)
      if (t === 'ab_tests' && falharNoDelete) {
        return new Proxy(q, {
          get(alvo, p, rec) {
            if (p !== 'delete') return Reflect.get(alvo, p, rec)
            const c: Record<string, unknown> = {}
            for (const m of ['eq']) c[m] = () => c
            c.then = (res: (v: unknown) => unknown) => res({ error: { message: 'delete falhou' } })
            return () => c
          },
        })
      }
      if (t !== 'ab_test_variants' || falharNaInsercao === undefined) return q
      return new Proxy(q, {
        get(alvo, p, rec) {
          if (p !== 'insert') return Reflect.get(alvo, p, rec)
          return (linha: Record<string, unknown>) => {
            insercoes++
            if (insercoes === falharNaInsercao) return { select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'falha injetada' } }) }) }
            return alvo.insert(linha)
          }
        },
      })
    },
    rpc: banco.supabase.rpc.bind(banco.supabase),
  }
  return banco
}
const testesDoRascunho = (b: ReturnType<typeof criarBanco>) => b.supabase.from('ab_tests').select('*').eq('site_id', SITE).eq('status', 'draft')

beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadVideoDetail).mockResolvedValue(detalhe() as never) })

describe('publishVideo sem mock das ações do A/B (S8-F4 B2)', () => {
  it('ABDraft de 4 variantes: ok, teste com 3 variantes, regra v2, o winner entra e o restante vai para a nota', async () => {
    const b = montar()
    const r = await publishVideo('p1', 1)
    expect(r).toMatchObject({ ok: true })
    const { data: testes } = await testesDoRascunho(b)
    const t = (testes as Array<Record<string, unknown>>)[0]!
    expect(t.regra_duracao).toBe('v2')
    const { data: vars } = await b.supabase.from('ab_test_variants').select('*').eq('test_id', t.id as string)
    const v = vars as Array<Record<string, unknown>>
    expect(v).toHaveLength(3)
    expect(v.map(x => x.title_text)).toEqual(['Orig', 'D', 'B']) // original, winner primeiro, depois a ordem do rascunho
    expect(String(t.status_note)).toContain('C: C')
  })

  it('o retorno diz quantos títulos ficaram fora do teste e que estão na nota', async () => {
    montar()
    const r = await publishVideo('p1', 1)
    expect(r).toMatchObject({ ok: true, data: { foraDoTeste: 1 } })
    if (!r.ok) throw new Error('esperava ok')
    expect(r.data?.aviso).toMatch(/1 título ficou fora do teste/)
    expect(r.data?.aviso).toMatch(/nota do teste/)
  })

  it('falha no 2º createTextVariant: nenhum ab_tests de rascunho sobra', async () => {
    const b = montar(3) // 1ª inserção = a original do createAbTest; 2ª e 3ª = os desafiantes
    const r = await publishVideo('p1', 1)
    expect(r).toMatchObject({ ok: false, error: 'falha injetada' })
    const { data: testes } = await testesDoRascunho(b)
    expect(testes).toEqual([])
  })

  it('delete da compensação falha: loga e devolve o erro ORIGINAL (não mascara)', async () => {
    montar(3, true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await publishVideo('p1', 1)
    expect(r).toMatchObject({ ok: false, error: 'falha injetada' })
    expect(log).toHaveBeenCalled()
    expect(String(log.mock.calls[0]!.join(' '))).toContain('delete falhou')
    log.mockRestore()
  })
})
