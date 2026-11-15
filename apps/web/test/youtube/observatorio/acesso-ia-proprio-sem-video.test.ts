// @vitest-environment node
/**
 * acessoir-15: canal próprio cadastrado e coletado, sem vídeo publicado (`montarCanal` → `proprio_sem_videos`), responde `ok` vazio com a frase
 * "sem vídeo publicado", nunca `nao_encontrado`; na série de vários canais vira o tipo `sem_video`, fora da contagem de não encontrados.
 * O `_contexto-ia` e o `responder` são os REAIS; só o `montarCanal` (a leitura do banco) é dobrado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ porId: {} as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/montar', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  montarCanal: async (id: string) => m.porId[id] ?? { tipo: 'nao_encontrado', pagina: {}, recente: null },
}))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { canalWorld } from './canal-fixture'
import { AGORA } from './contexto-ia-fixture'

const SEM_VIDEO = '117b666d-7845-4f6c-92da-e4510b294395'
const INEXISTENTE = '22222222-2222-4222-8222-222222222222'
const PEDIDO = { acao: 'serie', de: '2026-10-01', ate: '2026-10-13' }

beforeEach(() => {
  const { obs } = canalWorld()
  m.porId = { [SEM_VIDEO]: { tipo: 'proprio_sem_videos', pagina: {}, obs, proprio: { id: SEM_VIDEO, name: 'Canal novo' }, recente: null } }
})

describe('serie de canal próprio sem vídeo (acessoir-15)', () => {
  it('um canal, texto: ok com a frase "sem vídeo publicado"; nunca nao_encontrado', async () => {
    const r = await responder({ ...PEDIDO, canal_id: SEM_VIDEO }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('sem vídeo publicado')
    expect(r.texto).not.toContain('a tela não registrou o motivo')
  })
  it('vários canais: o sem vídeo tem linha-resumo própria e não conta como não encontrado; o inexistente continua não encontrado', async () => {
    const r = await responder({ ...PEDIDO, canal_ids: [SEM_VIDEO, INEXISTENTE], saida: 'tabela' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('sem vídeo publicado')
    expect(r.texto).toContain('canal não encontrado')
    expect(r.texto).toContain('1 não encontrado') // só o inexistente: o sem vídeo fica fora da contagem
    expect(r.texto).toContain('Canais: 0 de 1 lidos; 1 sem vídeo publicado; 1 não encontrado') // acessoir-15: o sem vídeo não conta como leitura que falhou
    expect(r.texto).not.toContain('0 de 2 lidos') // só o inexistente conta no "de N"
  })
})
