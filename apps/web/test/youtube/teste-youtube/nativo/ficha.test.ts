// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const acesso = vi.hoisted(() => ({ requireEditUser: vi.fn() }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => acesso)
const servico = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: servico.get }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { FichaRascunhoSchema, VarianteFichaSchema, derivarFicha, type FichaLinha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { abrirFicha, salvarFicha, marcarStudioAberto, lembrarNoComputador } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

const SHA = 'a'.repeat(64)
const BLOB = 'https://abc123.public.blob.vercel-storage.com/ab/v1.jpg'
const imagem = { url: BLOB, sha256: SHA, largura: 1280, altura: 720 }
const U = '11111111-1111-4111-8111-111111111111'

describe('VarianteFichaSchema / FichaRascunhoSchema: entrada hostil (Review Focus 4)', () => {
  const ok = { n: 2, tipo: 'combo', titulo: 'Novo título', imagem }
  it('aceita variante válida', () => { expect(VarianteFichaSchema.safeParse(ok).success).toBe(true) })
  it.each([
    ['URL fora do Blob', { ...ok, imagem: { ...imagem, url: 'https://evil.example.com/x.jpg' } }],
    ['URL que só contém o domínio do Blob', { ...ok, imagem: { ...imagem, url: 'https://evil.example.com/?h=a.blob.vercel-storage.com' } }],
    ['sha256 malformado', { ...ok, imagem: { ...imagem, sha256: 'xyz' } }],
    ['sha256 em maiúsculas', { ...ok, imagem: { ...imagem, sha256: 'A'.repeat(64) } }],
    ['título acima de 100 caracteres', { ...ok, titulo: 'x'.repeat(101) }],
    ['título vazio', { ...ok, titulo: '   ' }],
    ['n fora de 1..3 (0)', { ...ok, n: 0 }],
    ['n fora de 1..3 (4)', { ...ok, n: 4 }],
    ['tipo desconhecido', { ...ok, tipo: 'descricao' }],
    ['largura negativa', { ...ok, imagem: { ...imagem, largura: -1 } }],
  ])('recusa: %s', (_nome, v) => { expect(VarianteFichaSchema.safeParse(v).success).toBe(false) })
  it('título de exatamente 100 caracteres passa', () => { expect(VarianteFichaSchema.safeParse({ ...ok, titulo: 'x'.repeat(100) }).success).toBe(true) })

  it('rascunho: só o original passa; vazio passa; n repetido, 4 variantes e campo fora recusados', () => {
    const v = (n: number) => ({ n, tipo: 'titulo' as const, titulo: `T${n}` })
    expect(FichaRascunhoSchema.safeParse({ campos: ['titulo'], variantes: [v(1)] }).success).toBe(true)
    expect(FichaRascunhoSchema.safeParse({ campos: [], variantes: [] }).success).toBe(true)
    expect(FichaRascunhoSchema.safeParse({ campos: ['titulo'], variantes: [v(1), v(1)] }).success).toBe(false)
    expect(FichaRascunhoSchema.safeParse({ campos: ['titulo'], variantes: [v(1), v(2), v(3), { ...v(3), n: 4 }] }).success).toBe(false)
    expect(FichaRascunhoSchema.safeParse({ campos: ['descricao'], variantes: [] }).success).toBe(false)
    expect(FichaRascunhoSchema.safeParse({ campos: ['titulo', 'titulo'], variantes: [] }).success).toBe(false)
  })
})

describe('derivarFicha (relógio injetado)', () => {
  const agora = new Date('2026-10-21T12:00:00Z')
  const dias = (n: number): string => new Date(agora.getTime() - n * 86_400_000).toISOString()
  const base: FichaLinha = {
    id: 'f1', site_id: 's1', video_id: 'v1', campos: [], variantes: [], criada_em: dias(30), criada_por: null, atualizada_em: dias(30),
    studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null,
  }
  it('aberta = sem registro e sem descarte', () => {
    expect(derivarFicha(base, agora).aberta).toBe(true)
    expect(derivarFicha({ ...base, registro_id: 'r' }, agora).aberta).toBe(false)
    expect(derivarFicha({ ...base, descartada_em: dias(1) }, agora).aberta).toBe(false)
  })
  it('enviada: Studio aberto há 20 d e "Lembrar" ontem => true (greatest ignora nulos, não coalesce)', () => {
    expect(derivarFicha({ ...base, studio_aberto_em: dias(20), lembrar_em: dias(1) }, agora).enviada).toBe(true)
  })
  it('enviada: marcador de 13 d => true; de 15 d => false; sem marcador => false', () => {
    expect(derivarFicha({ ...base, studio_aberto_em: dias(13) }, agora).enviada).toBe(true)
    expect(derivarFicha({ ...base, studio_aberto_em: dias(15) }, agora).enviada).toBe(false)
    expect(derivarFicha(base, agora).enviada).toBe(false)
    expect(derivarFicha({ ...base, lembrar_em: dias(14) }, agora).enviada).toBe(true)
  })
  it('enviada exige ficha aberta', () => {
    expect(derivarFicha({ ...base, studio_aberto_em: dias(1), registro_id: 'r' }, agora).enviada).toBe(false)
  })
})

describe('actions: sem permissão recusa antes de qualquer leitura', () => {
  beforeEach(() => { servico.get.mockReset(); acesso.requireEditUser.mockReset() })
  it.each([
    ['abrirFicha', () => abrirFicha(U)],
    ['salvarFicha', () => salvarFicha(U, '2026-10-21T00:00:00+00:00', { campos: [], variantes: [] })],
    ['marcarStudioAberto', () => marcarStudioAberto(U)],
    ['lembrarNoComputador', () => lembrarNoComputador(U)],
  ])('%s', async (_n, chamar) => {
    acesso.requireEditUser.mockRejectedValue(new Error('forbidden'))
    const r = await chamar()
    expect(r).toEqual({ ok: false, error: 'forbidden' })
    expect(servico.get).not.toHaveBeenCalled()
  })
  it('id que não é uuid é recusado sem tocar o banco', async () => {
    acesso.requireEditUser.mockResolvedValue({ siteId: U, userId: U })
    expect(await abrirFicha('nao-uuid')).toMatchObject({ ok: false })
    expect(servico.get).not.toHaveBeenCalled()
  })
})
