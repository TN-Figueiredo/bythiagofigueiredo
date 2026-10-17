// Os testes do A/B Lab de UM vídeo, para a tela das trocas (plano E5b, Tarefa 20b). Só leitura; erro de banco e passar de teto são LANÇADOS
// (nunca uma lista cortada, nunca lista vazia no lugar de erro); linha com data inválida, tipo ou status fora da lista: descartada e contada.
// A leitura não filtra por canal (o teste não tem canal): quem garante o vídeo certo é o uuid, que a página resolveu a partir do canal próprio.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ObservatoryLoadError } from '../niches-db'
import { leituraValida } from './leitura-privada'
import type { Pedido } from './ler'
import type { Privado } from './tipos'

export const TETO_TESTES_AB = 50
export const TETO_CICLOS_AB = 1000

export interface CicloAb { n: number; inicio: string; fim: string | null }
export type StatusAb = 'active' | 'paused' | 'completed' | 'archived' | 'queued' | 'draft'
export type TipoAb = 'thumbnail' | 'title' | 'description' | 'combo'
export interface TesteAb {
  id: string
  tipo: TipoAb
  /** instantes ISO */
  inicio: string
  pausadoEm: string | null
  concluidoEm: string | null
  motivo: string | null
  vencedorAplicadoEm: string | null
  tituloOriginal: string | null
  ciclos: CicloAb[]
  /** lido de `ab_tests.status`; "em andamento" é só 'active' */
  status: StatusAb
}
export interface TestesAbDoVideo { testes: TesteAb[]; descartados: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS = new Set<string>(['active', 'paused', 'completed', 'archived', 'queued', 'draft'])
const TIPOS = new Set<string>(['thumbnail', 'title', 'description', 'combo'])
const PAGINA = 1000

interface TesteRow { id: string; test_type: string; status: string; started_at: string | null; paused_at: string | null; completed_at: string | null; completed_reason: string | null; winner_applied_at: string | null; original_title: string | null }
interface CicloRow { id?: string; test_id: string; cycle_number: unknown; started_at: string | null; ended_at: string | null }

/** Instante ISO de um timestamptz; inválido devolve undefined (nulo de verdade é null). */
function iso(x: unknown): string | null | undefined {
  if (x == null) return null
  if (typeof x !== 'string') return undefined
  const t = new Date(x).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined
}

/**
 * A guarda é uma cópia declarada de três linhas (`siteAutorizado` continua privada em `ler.ts`): o token válido do HEAD, o canal em uuid e o site tirado DO TOKEN.
 * Uma cópia sem a checagem do token é violação na varredura.
 */
const siteDoToken = (p: Pedido): string | null => (leituraValida(p.leitura) && UUID.test(p.canalId) ? p.leitura.siteId : null)

export async function lerTestesAb(sb: SupabaseClient, p: Pedido & { videoUuid: string }): Promise<Privado<TestesAbDoVideo>> {
  const siteId = siteDoToken(p)
  if (siteId == null || !UUID.test(p.videoUuid)) return { acesso: 'negado' }
  const { data, error } = await sb.from('ab_tests')
    .select('id, test_type, status, started_at, paused_at, completed_at, completed_reason, winner_applied_at, original_title')
    .eq('site_id', siteId).eq('youtube_video_id', p.videoUuid)
    // rascunho sem início não é teste que rodou
    .gte('started_at', '1970-01-01T00:00:00Z')
    .order('started_at').order('id').range(0, TETO_TESTES_AB)
  if (error) throw new ObservatoryLoadError('ab_tests', error.code, error.message)
  const lidos = (Array.isArray(data) ? data : []) as TesteRow[]
  if (lidos.length > TETO_TESTES_AB) throw new ObservatoryLoadError('ab_tests', undefined, `mais de ${TETO_TESTES_AB} testes neste vídeo`, true)

  let descartados = 0
  const testes: TesteAb[] = []
  for (const r of lidos) {
    if (r.started_at == null) continue
    const inicio = iso(r.started_at), pausadoEm = iso(r.paused_at), concluidoEm = iso(r.completed_at), aplicado = iso(r.winner_applied_at)
    if (inicio == null || inicio === undefined || pausadoEm === undefined || concluidoEm === undefined || aplicado === undefined || !TIPOS.has(r.test_type) || !STATUS.has(r.status)) { descartados++; continue }
    testes.push({
      id: r.id, tipo: r.test_type as TipoAb, inicio, pausadoEm, concluidoEm, motivo: r.completed_reason ?? null, vencedorAplicadoEm: aplicado,
      tituloOriginal: r.original_title ?? null, ciclos: [], status: r.status as StatusAb,
    })
  }
  if (testes.length === 0) return { acesso: 'ok', dado: { testes, descartados } }

  // os ciclos, paginados; passar do teto lança (nunca corta)
  const ids = lidos.map(r => r.id)
  const ciclos: CicloRow[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data: pg, error: e2 } = await sb.from('ab_test_cycles').select('id, test_id, cycle_number, started_at, ended_at')
      .in('test_id', ids).order('test_id').order('cycle_number').order('id').range(de, de + PAGINA - 1)
    if (e2) throw new ObservatoryLoadError('ab_test_cycles', e2.code, e2.message)
    const pagina = (Array.isArray(pg) ? pg : []) as CicloRow[]
    ciclos.push(...pagina)
    if (ciclos.length > TETO_CICLOS_AB) throw new ObservatoryLoadError('ab_test_cycles', undefined, `mais de ${TETO_CICLOS_AB} ciclos nos testes deste vídeo`, true)
    if (pagina.length < PAGINA) break
  }
  const porId = new Map(testes.map(t => [t.id, t]))
  for (const c of ciclos) {
    const t = porId.get(c.test_id)
    if (!t) continue
    const inicio = iso(c.started_at), fim = iso(c.ended_at)
    const n = typeof c.cycle_number === 'number' && Number.isFinite(c.cycle_number) ? c.cycle_number : Number(c.cycle_number)
    if (inicio == null || inicio === undefined || fim === undefined || !Number.isFinite(n)) { descartados++; continue }
    t.ciclos.push({ n, inicio, fim })
  }
  return { acesso: 'ok', dado: { testes, descartados } }
}
