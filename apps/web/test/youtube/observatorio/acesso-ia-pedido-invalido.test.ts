// @vitest-environment node
/**
 * A7e T7: o registro diz QUAL campo foi recusado (`params.campos_invalidos`) e nunca o valor. Pelo `responder` real e pelo `registrarAcessoDaChave` real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'

const AGORA = Date.UTC(2026, 10, 9, 15)
const C1 = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { m.empacotar.outliers = vi.fn(async () => null); m.empacotar.canais = vi.fn(async () => null); m.empacotar.canal = vi.fn(async () => null) })

const linhaGravada = async (entrada: unknown): Promise<Record<string, unknown>> => {
  const r = await responder(entrada, ABRIDOR_DE_SESSAO, AGORA)
  expect(r.desfecho).toBe('pedido_invalido')
  const linhas: Array<Record<string, unknown>> = []
  const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
  const g = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('s', 'u', 'k', new Date(Date.now() + 86_400_000).toISOString()), acao: 'pacote_da_tela', params: { ...r.params, desfecho: r.desfecho } as never, incluiuPrivado: false, caracteres: 0, resultado: 'ok' })
  expect(g.ok).toBe(true)
  return linhas[0]!
}

describe('campos_invalidos no registro', () => {
  it('formato errado: ["formato"]', async () => {
    expect((await linhaGravada({ acao: 'destaques', formato: 'longo' })).params).toMatchObject({ campos_invalidos: ['formato'] })
  })
  it('dois campos errados: ordenados, sem repetir', async () => {
    expect((await linhaGravada({ acao: 'canal', canal_id: 'com espaço', formato: 'xx', janela: '45' })).params).toMatchObject({ campos_invalidos: ['canal_id', 'formato', 'janela'] })
  })
  it('campo inventado: ["(desconhecido)"]', async () => {
    expect((await linhaGravada({ acao: 'canal', canal_id: C1, ZZ_CAMPO: 1 })).params).toMatchObject({ campos_invalidos: ['(desconhecido)'] })
  })
  it('ação fora da lista: ["acao"]; entrada que não é objeto: sem campos_invalidos (nunca lista vazia)', async () => {
    expect((await linhaGravada({ acao: 'xpto' })).params).toMatchObject({ campos_invalidos: ['acao'] })
    expect((await linhaGravada(null)).params).not.toHaveProperty('campos_invalidos')
  })
  it('recusa do tradutor (comparar com 1 canal): campos_invalidos = canal_ids', async () => {
    expect((await linhaGravada({ acao: 'comparar', canal_ids: [C1] })).params).toMatchObject({ campos_invalidos: ['canal_ids'] })
  })
  it('recusa do tradutor (serie com de > ate): ["ate","de"]', async () => {
    expect((await linhaGravada({ acao: 'serie', canal_id: C1, de: '2026-11-08', ate: '2026-10-05' })).params).toMatchObject({ campos_invalidos: ['ate', 'de'] })
  })
  it('recusa do tradutor (serie sem canal nem vídeo): ["canal_id","video_id"]', async () => {
    expect((await linhaGravada({ acao: 'serie', de: '2026-10-05', ate: '2026-11-08' })).params).toMatchObject({ campos_invalidos: ['canal_id', 'video_id'] })
  })
  it('valor-isca (REDE, nasce verde: o registro nunca gravou valores; impede a regressão): o valor errado não aparece na linha', async () => {
    const linha = await linhaGravada({ acao: 'destaques', formato: 'SEGREDO-123' })
    const json = JSON.stringify(linha)
    expect(json).not.toContain('SEGREDO-123')
    expect(json).not.toContain('SEGREDO')
  })
})
