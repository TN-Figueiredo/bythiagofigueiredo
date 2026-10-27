// apps/web/test/youtube/observatorio/arquivo-canais-removidos.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { montarBloco, marcaAoLadoDaPastilha, lerCanaisRemovidos, type ListaRemovidosV2 } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import type { Casa } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const casa: Casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' }
const semCmd = { comandoDeLimpeza: false, blocoCanaisRemovidos: true, dataDoComando: null }
const comCmd = { comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null }
const linha = (o: Record<string, unknown>): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', estado: 'pedido', decided_at: new Date(AGORA - 5 * D).toISOString(),
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: new Date(AGORA - 5 * D).toISOString(), removido_via: 'botao',
  primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 118402, classes: ['serie'], ...o }) as ListaRemovidosV2[number]

describe('bloco Canais removidos, só de leitura (item 163, parte M5)', () => {
  it('sem o comando: limpeza pedida espera o comando, sem cor aos 30 nem aos 60 dias', () => {
    for (const dias of [29, 30, 60, 90]) {
      const b = montarBloco([linha({ decided_at: new Date(AGORA - dias * D).toISOString() })], { agora: AGORA, casa, cap: semCmd })
      expect(b.linhas[0]!.gravidade).toBe('nenhuma')
      expect(b.linhas[0]!.frase).toMatch(/Espera o comando, que ainda não tem data para chegar\./)
    }
  })
  it('sem o comando: a marca ao lado da pastilha não existe', () => {
    expect(marcaAoLadoDaPastilha([linha({})], { agora: AGORA, casa, cap: semCmd })).toBeNull()
  })
  it('com o comando: a marca conta pedido e apagado_nas, muda aos 30 e aos 60', () => {
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 29 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })).toEqual({ n: 1, forma: 'arquivo' })
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 30 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })!.forma).toBe('triangulo')
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 60 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })!.forma).toBe('octogono')
  })
  it('sem_destino: vermelho, no topo, código e faixa, nunca nome nem "removido em"', () => {
    const b = montarBloco([linha({ estado: 'sem_destino', nome: null, removido_em: null, removido_via: 'sem_registro', meses: 9, primeiro_mes: '2026-10', ultimo_mes: '2027-06' })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]).toMatchObject({ gravidade: 'vermelho', forma: 'octogono', noTopo: true })
    expect(b.linhas[0]!.frase).toContain('código interno: AAAAAAAA')
    expect(b.linhas[0]!.frase).toContain('Há 9 meses no arquivo, de 10/2026 a 06/2027.')
    expect(b.linhas[0]!.frase).not.toMatch(/removido em/)
  })
  it('Phil I5: canal sem nenhuma unidade tem meses e registros nulos e a frase não fala em "0 meses"', () => {
    const b = montarBloco([linha({ estado: 'sem_arquivo', meses: null, registros: null, primeiro_mes: null, ultimo_mes: null, blobs_pendentes: 2 })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).not.toMatch(/\b0 meses\b|Há null/)
  })
  it('sem_destino com meses nulos: a frase omite a faixa em vez de inventá-la', () => {
    const b = montarBloco([linha({ estado: 'sem_destino', nome: null, removido_em: null, meses: null, registros: null, primeiro_mes: null, ultimo_mes: null })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toContain('código interno: AAAAAAAA'); expect(b.linhas[0]!.frase).not.toMatch(/Há .* meses no arquivo/)
  })
  it('linha da vigia sem nome e sem data: "removido sem aviso, limpeza pedida em dd/mm"', () => {
    const b = montarBloco([linha({ nome: null, removido_em: null, removido_via: 'vigia' })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toMatch(/^AAAAAAAA, removido sem aviso, limpeza pedida em \d\d\/\d\d/)
  })
  it('Review Focus 4: nome de 100 caracteres não é cortado na frase', () => {
    const nome = 'N'.repeat(100)
    const b = montarBloco([linha({ nome })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toContain(nome)
    expect(b.linhas[0]!.rotulo).toBe(nome)        // as reticências são do CSS; title e aria-label recebem o nome inteiro
  })
  it('sem_arquivo com imagens no Blob fica à vista; sem imagens vai para Já limpos', () => {
    const com = montarBloco([linha({ estado: 'sem_arquivo', blobs_pendentes: 3 })], { agora: AGORA, casa, cap: semCmd })
    const sem = montarBloco([linha({ estado: 'sem_arquivo', blobs_pendentes: 0 })], { agora: AGORA, casa, cap: semCmd })
    expect(com.linhas).toHaveLength(1); expect(com.jaLimpos.n).toBe(0)
    expect(sem.linhas).toHaveLength(0); expect(sem.jaLimpos.n).toBe(1)
  })
  it('zero medido: frase própria, Já limpos (0)', () => {
    const b = montarBloco([], { agora: AGORA, casa, cap: semCmd })
    expect(b.resumo).toBe('Nenhum canal removido pede limpeza.')
    expect(b.jaLimpos.n).toBe(0)
  })
  it('casa fora: triângulo, sem vermelho por idade', () => {
    const fora: Casa = { estado: 'nao_respondeu', desde: AGORA - 3 * D, forma: 'octogono', frase: '' }
    const b = montarBloco([linha({ decided_at: new Date(AGORA - 90 * D).toISOString() })], { agora: AGORA, casa: fora, cap: comCmd })
    expect(b.linhas[0]!.gravidade).not.toBe('vermelho')
  })
  it('nunca diz "apagado" antes da prova', () => {
    const b = montarBloco([linha({})], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).not.toMatch(/[Aa]pagado/)
  })

  it('estado desconhecido vira não medido, nunca ok', () => {
    const b = montarBloco([linha({ estado: 'inventado' })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.gravidade).toBe('nao_medido'); expect(b.linhas[0]!.forma).toBe('hachura')
  })
  it('data do comando conhecida entra na frase', () => {
    const b = montarBloco([linha({})], { agora: AGORA, casa, cap: { ...semCmd, dataDoComando: '2028-12-12' } })
    expect(b.linhas[0]!.frase).toContain('chega em 12/12/2028')
    expect(b.resumo).toBe('Canais removidos: 1 esperam o comando de limpeza, que chega em 12/12/2028.')
  })
  it('sem comando o resumo diz o que espera', () => {
    expect(montarBloco([linha({})], { agora: AGORA, casa, cap: semCmd }).resumo).toBe('Canais removidos: 1 esperam o comando de limpeza, que ainda não tem data para chegar.')
  })
  it('Phil I5: função ausente avisa o Sentry só com OBS_ARQUIVO=on (variável apagada = silêncio)', async () => {
    const { captureMessage } = await import('@sentry/nextjs')
    const sb = { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) } as unknown as SupabaseClient
    vi.mocked(captureMessage).mockClear()
    delete process.env.OBS_ARQUIVO
    expect(await lerCanaisRemovidos(sb, 's')).toEqual({ ok: false })
    expect(captureMessage).not.toHaveBeenCalled()
    process.env.OBS_ARQUIVO = 'on'
    expect(await lerCanaisRemovidos(sb, 's')).toEqual({ ok: false })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_removed_channel_list ausente com OBS_ARQUIVO=on', 'warning')
    delete process.env.OBS_ARQUIVO
  })
  it('lerCanaisRemovidos: erro, função ausente e fora do esquema viram ok:false; lista vazia é ok', async () => {
    const sb = (r: { data: unknown; error: { code?: string } | null }) => ({ rpc: async () => r }) as unknown as SupabaseClient
    expect(await lerCanaisRemovidos(sb({ data: null, error: { code: '42883' } }), 's')).toEqual({ ok: false })
    expect(await lerCanaisRemovidos(sb({ data: null, error: { code: 'XX000' } }), 's')).toEqual({ ok: false })
    expect(await lerCanaisRemovidos(sb({ data: null, error: null }), 's')).toEqual({ ok: false })
    expect(await lerCanaisRemovidos(sb({ data: [{ versao: 1 }], error: null }), 's')).toEqual({ ok: false })
    expect(await lerCanaisRemovidos(sb({ data: [], error: null }), 's')).toEqual({ ok: true, lista: [] })
    expect(await lerCanaisRemovidos(sb({ data: [linha({})], error: null }), 's')).toMatchObject({ ok: true })
  })
})
