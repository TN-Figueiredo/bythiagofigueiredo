// Testes do A/B Lab ainda abertos (draft/active/paused/queued) e a frase de cada um. Puro: sem banco, sem React.
// O mapa é chaveado por `ab_tests.youtube_video_id`, que é a FK uuid para `youtube_videos.id` (apesar do nome), nunca pelo id do YouTube.
import { z } from 'zod'
import { hrefListaAb, hrefTesteAb } from '@/lib/youtube/ab-referencia'

export type EstadoAberto = 'andamento' | 'pausado' | 'fila' | 'rascunho'
export interface TesteAbertoView { id: string; estado: EstadoAberto; href: string; rotulo: string; frase: string; curto: string; aviso: string }
export type TestesAbertos = { acesso: 'ok'; porVideo: Record<string, TesteAbertoView> } | { acesso: 'erro' } | { acesso: 'negado' }
export const TETO_ABERTOS = 500

/** Textos num ponto só (Q-b e Q-c esperam o dono). */
export const ROTULO_VER_TESTE = 'Ver teste'
export const ROTULO_RASCUNHO = 'Rascunho no A/B Lab'

const Linha = z.object({
  id: z.string().min(1),
  youtube_video_id: z.string().min(1),
  test_type: z.string(),
  status: z.enum(['draft', 'active', 'paused', 'queued']),
  started_at: z.string().nullish(),
  paused_at: z.string().nullish(),
  created_at: z.string().nullish(),
})

/** Prioridade quando o mesmo vídeo tem duas linhas (queued não está no índice único). */
const PRIORIDADE: Record<EstadoAberto, number> = { andamento: 3, pausado: 2, fila: 1, rascunho: 0 }

const tipoDe = (t: string): string => (t === 'thumbnail' ? 'de thumbnail' : t === 'title' ? 'de título' : 'A/B')

/** dd/mm no fuso de São Paulo a partir do ISO; inválido ou ausente = null (a frase cai para a versão sem data). */
function dataDe(iso: string | null | undefined, dm: (iso: string) => string): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return dm(iso)
}

export function testeAbertoDe(row: unknown, dm: (iso: string) => string): TesteAbertoView | null {
  const r = Linha.safeParse(row)
  if (!r.success) return null
  const l = r.data
  const tipo = tipoDe(l.test_type)
  const href = hrefTesteAb(l.id)
  switch (l.status) {
    case 'active': {
      const d = dataDe(l.started_at, dm)
      return { id: l.id, estado: 'andamento', href, rotulo: ROTULO_VER_TESTE, curto: 'em andamento', frase: d ? `Teste ${tipo} em andamento desde ${d}.` : `Teste ${tipo} em andamento.`, aviso: d ? `Este vídeo já tem um teste em andamento desde ${d}.` : 'Este vídeo já tem um teste em andamento.' }
    }
    case 'paused': {
      const d = dataDe(l.paused_at, dm)
      return { id: l.id, estado: 'pausado', href, rotulo: ROTULO_VER_TESTE, curto: 'pausado', frase: d ? `Teste ${tipo} pausado desde ${d}.` : `Teste ${tipo} pausado.`, aviso: d ? `Este vídeo já tem um teste pausado desde ${d}.` : 'Este vídeo já tem um teste pausado.' }
    }
    case 'queued':
      return { id: l.id, estado: 'fila', href, rotulo: ROTULO_VER_TESTE, curto: 'na fila', frase: `Teste ${tipo} na fila do A/B Lab.`, aviso: 'Este vídeo já tem um teste na fila do A/B Lab.' }
    case 'draft': {
      const d = dataDe(l.created_at, dm)
      return { id: l.id, estado: 'rascunho', href: hrefListaAb(), rotulo: ROTULO_RASCUNHO, curto: 'rascunho', frase: d ? `Rascunho de teste aberto no A/B Lab desde ${d}.` : 'Rascunho de teste aberto no A/B Lab.', aviso: d ? `Este vídeo já tem um rascunho de teste desde ${d}.` : 'Este vídeo já tem um rascunho de teste.' }
    }
  }
}

export function porVideo(rows: readonly unknown[], dm: (iso: string) => string): Record<string, TesteAbertoView> {
  const mapa: Record<string, TesteAbertoView> = {}
  for (const row of rows) {
    const v = testeAbertoDe(row, dm)
    if (!v) continue
    // testeAbertoDe já validou a forma da linha
    const vid = (row as { youtube_video_id: string }).youtube_video_id
    const atual = mapa[vid]
    if (!atual || PRIORIDADE[v.estado] > PRIORIDADE[atual.estado]) mapa[vid] = v
  }
  return mapa
}
