// @vitest-environment node
// A5 · E5a · Tarefa C1: o nível de quem vê os comentários (contagem, texto, identidade) e a troca de menções.
// Os tokens nascem pelos caminhos REAIS (provarEdicao, provarAcessoPrivado) com as guardas simuladas por vi.mock.
import { describe, it, expect, vi } from 'vitest'
import { edicaoDe } from './edicao-teste'
import { leituraDe } from './leitura-teste'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { nivelDeQuemVe, semMencoes, MARCADOR_DE_MENCAO } from '@/lib/youtube/observatorio/comentarios/leitor-nivel'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-a'
const OUTRO = 'site-b'

describe('nivelDeQuemVe (E5a C1)', () => {
  it('provas nulas: contagem, com o site da guarda', () => {
    expect(nivelDeQuemVe(null, S)).toEqual({ nivel: 'contagem', siteId: S })
  })
  it('as duas provas ausentes: contagem', () => {
    expect(nivelDeQuemVe({ leitura: null, edicao: null }, S)).toEqual({ nivel: 'contagem', siteId: S })
  })
  it('token de edição do site: identidade, com o site de dentro do token', async () => {
    expect(nivelDeQuemVe({ leitura: null, edicao: await edicaoDe(S) }, S)).toEqual({ nivel: 'identidade', siteId: S })
  })
  it('token de leitura do site: texto', async () => {
    expect(nivelDeQuemVe({ leitura: await leituraDe(S), edicao: null }, S)).toEqual({ nivel: 'texto', siteId: S })
  })
  it('os dois tokens: identidade (edita lê)', async () => {
    expect(nivelDeQuemVe({ leitura: await leituraDe(S), edicao: await edicaoDe(S) }, S).nivel).toBe('identidade')
  })
  it('objeto forjado com a forma do token não sobe de nível (literal e protótipo copiado)', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const falsaLeitura: LeituraPrivadaDoSite = { siteId: S }
    // @ts-expect-error literal não é um EdicaoDoSite
    const falsaEdicao: EdicaoDoSite = { siteId: S }
    expect(nivelDeQuemVe({ leitura: falsaLeitura, edicao: falsaEdicao }, S).nivel).toBe('contagem')
    const real = await edicaoDe(S)
    const copia = Object.create(Object.getPrototypeOf(real) as object, { siteId: { value: S } }) as EdicaoDoSite
    expect(nivelDeQuemVe({ leitura: null, edicao: copia }, S).nivel).toBe('contagem')
    const espalhado = { ...real } as unknown as EdicaoDoSite
    expect(nivelDeQuemVe({ leitura: null, edicao: espalhado }, S).nivel).toBe('contagem')
  })
  it('token de outro site: contagem do site da guarda', async () => {
    expect(nivelDeQuemVe({ leitura: await leituraDe(OUTRO), edicao: await edicaoDe(OUTRO) }, S)).toEqual({ nivel: 'contagem', siteId: S })
  })
  it('token de edição passado no lugar do de leitura não dá texto por si', async () => {
    const edicao = await edicaoDe(S)
    // @ts-expect-error o tipo recusa; em execução o brand check também
    expect(nivelDeQuemVe({ leitura: edicao, edicao: null }, S).nivel).toBe('contagem')
  })
  it('edita verdadeiro sem token de edição: no máximo texto', async () => {
    expect(nivelDeQuemVe({ leitura: await leituraDe(S), edicao: null }, S).nivel).toBe('texto')
  })
  it('acesso que falhou ou veio incompleto é contagem', () => {
    // @ts-expect-error forma incompleta
    expect(nivelDeQuemVe({}, S).nivel).toBe('contagem')
    // @ts-expect-error resposta que falhou
    expect(nivelDeQuemVe({ falhou: true }, S).nivel).toBe('contagem')
    // @ts-expect-error não é objeto
    expect(nivelDeQuemVe('texto', S).nivel).toBe('contagem')
  })
})

describe('semMencoes (E5a C1)', () => {
  it('troca @ até o primeiro espaço pelo marcador fixo', () => {
    expect(semMencoes('@fulano obrigado')).toEqual({ texto: MARCADOR_DE_MENCAO + ' obrigado', trocadas: 1 })
  })
  it('dois @ e um endereço de e-mail: os três trocados', () => {
    const r = semMencoes('@ana e @bia falem com x@y.com ok')
    expect(r.trocadas).toBe(3)
    expect(r.texto).toBe('@… e @… falem com x@… ok')
  })
  it('nome por extenso sai como veio (limite conhecido)', () => {
    expect(semMencoes('Obrigado Maria Souza')).toEqual({ texto: 'Obrigado Maria Souza', trocadas: 0 })
  })
  it('menção com nome de exibição de duas palavras: sai com o segundo nome (segundo limite conhecido)', () => {
    expect(semMencoes('@João Silva obrigado').texto).toBe('@… Silva obrigado')
  })
  it('texto vazio e sem arroba não mudam', () => {
    expect(semMencoes('')).toEqual({ texto: '', trocadas: 0 })
    expect(semMencoes('olá, tudo bem?')).toEqual({ texto: 'olá, tudo bem?', trocadas: 0 })
  })
})
