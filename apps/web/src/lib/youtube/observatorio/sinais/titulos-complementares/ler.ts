// F4 T9: o que a forja fez com os pedidos de "títulos complementares" (vídeo nosso x sinal). UM leitor para a tela, a rota e o MCP (D-F4-4:
// o Cowork só LÊ; mesmo dado da tela). Dado ausente nunca vira lista vazia: pedido recusado carrega o motivo; leitura que falha vira `leitura: 'erro'`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requestStateOf } from '@/lib/youtube/observatorio/forja/states'
import type { MotivoTitulo } from '@/lib/youtube/observatorio/forja/titulo-complementar'

export const TIPO_TITULO = 'titulo-complementar'
const BLOCO = 150
const MOTIVOS: ReadonlySet<string> = new Set<MotivoTitulo>(['demais', 'longo', 'repetido', 'numero_fora', 'vazio'])

export type EstadoDoPar =
  | { estado: 'fila'; pedido_em: string }
  | { estado: 'gerando'; pedido_em: string }
  /** A forja não consulta há mais de 3 ciclos: o pedido fica guardado e sai quando ela voltar. */
  | { estado: 'parada'; pedido_em: string; parada_desde: string | null }
  | { estado: 'pronto'; titulos: string[]; gerado_em: string }
  /** O validador descartou a resposta inteira; `vazio` = nenhum título válido. Nunca uma lista vazia calada. */
  | { estado: 'recusado'; motivo: MotivoTitulo; pedido_em: string }
  | { estado: 'falhou'; pedido_em: string }
export type ParDeTitulos = { own_video_id: string } & EstadoDoPar

/** Uma vez por lista (não por item: o Cowork lê a lista toda e o tamanho da resposta tem teto). */
export interface TitulosDaForja {
  /** `erro`: a leitura falhou; a tela diz isso e não oferece o botão. */
  leitura: 'ok' | 'erro'
  /** O heartbeat lista `titulo-complementar`. `false` = a forja ainda não sabe fazer o pedido; `null` = nunca houve heartbeat. */
  forja_sabe_pedir: boolean | null
}
export const TITULOS_SEM_LEITURA: TitulosDaForja = { leitura: 'erro', forja_sabe_pedir: null }

const Tarefa = z.object({
  id: z.string(), status: z.string(), requested_at: z.string(), started_at: z.string().nullable(), completed_at: z.string().nullable(), failed_at: z.string().nullable(),
  refused_at: z.string().nullable(), released_at: z.string().nullable(), retry_count: z.number().nullable(), refused_reason: z.string().nullable(),
  target_own_video_id: z.string().nullable(), target_signal_id: z.string().nullable(),
})
const Leitura = z.object({ task_id: z.string().nullable(), own_video_id: z.string().nullable(), signal_id: z.string().nullable(), generated_at: z.string(), text: z.unknown() })
const Beat = z.object({ last_poll_at: z.string(), capabilities: z.array(z.string()) })
const Itens = z.object({ items: z.array(z.string()) })

const chave = (sinal: string, proprio: string): string => `${sinal}|${proprio}`

/** Um mapa `id do sinal` -> o que a forja fez. Sinal sem pedido nenhum fica fora do mapa (a tela mostra o botão ou "sem a capacidade"). Lança em erro de banco. */
export async function lerTitulosDosSinais(sb: SupabaseClient, siteId: string, sinalIds: readonly string[], agora: number): Promise<{ forjaSabePedir: boolean | null; porSinal: Map<string, ParDeTitulos[]> }> {
  const hb = await sb.from('forja_heartbeat').select('last_poll_at, capabilities').eq('site_id', siteId).limit(1)
  if (hb.error) throw new Error('titulos: leitura do heartbeat falhou')
  const beat = z.array(Beat).parse(hb.data ?? [])[0] ?? null
  const lastPollAt = beat ? Date.parse(beat.last_poll_at) : null
  const forjaSabePedir = beat ? beat.capabilities.includes(TIPO_TITULO) : null
  const porSinal = new Map<string, ParDeTitulos[]>()
  const unicos = [...new Set(sinalIds)]
  if (unicos.length === 0) return { forjaSabePedir, porSinal }

  const tarefas: z.infer<typeof Tarefa>[] = []
  const leituras: z.infer<typeof Leitura>[] = []
  for (let i = 0; i < unicos.length; i += BLOCO) {
    const bloco = unicos.slice(i, i + BLOCO)
    const [t, l] = await Promise.all([
      sb.from('youtube_intelligence_tasks')
        .select('id, status, requested_at, started_at, completed_at, failed_at, refused_at, released_at, retry_count, refused_reason, target_own_video_id, target_signal_id')
        .eq('site_id', siteId).eq('task_type', TIPO_TITULO).in('target_signal_id', bloco).order('requested_at', { ascending: false }).limit(1000),
      sb.from('competitor_readings').select('task_id, own_video_id, signal_id, generated_at, text')
        .eq('site_id', siteId).eq('task_type', TIPO_TITULO).in('signal_id', bloco).order('generated_at', { ascending: false }).limit(1000),
    ])
    if (t.error) throw new Error('titulos: leitura dos pedidos falhou')
    if (l.error) throw new Error('titulos: leitura dos resultados falhou')
    tarefas.push(...z.array(Tarefa).parse(t.data ?? []))
    leituras.push(...z.array(Leitura).parse(l.data ?? []))
  }
  const porTarefa = new Map<string, z.infer<typeof Leitura>>()
  for (const r of leituras) if (r.task_id && !porTarefa.has(r.task_id)) porTarefa.set(r.task_id, r)

  const vistos = new Set<string>()
  for (const t of tarefas) { // mais recente primeiro: a primeira de cada par é a que vale
    if (!t.target_signal_id || !t.target_own_video_id) continue
    const k = chave(t.target_signal_id, t.target_own_video_id)
    if (vistos.has(k)) continue
    vistos.add(k)
    const base = { own_video_id: t.target_own_video_id }
    let par: ParDeTitulos
    const pedido_em = t.requested_at
    if (t.status === 'pending' || t.status === 'running') {
      const st = requestStateOf({ status: t.status, retry_count: t.retry_count ?? 0, requested_at: t.requested_at, started_at: t.started_at, completed_at: t.completed_at, failed_at: t.failed_at, refused_at: t.refused_at, released_at: t.released_at }, { lastPollAt }, agora)
      if (t.status === 'running') par = { ...base, estado: 'gerando', pedido_em }
      else if (st === 'sem máquina') par = { ...base, estado: 'parada', pedido_em, parada_desde: beat?.last_poll_at ?? null }
      else par = { ...base, estado: 'fila', pedido_em }
    } else if (t.status === 'completed') {
      const r = porTarefa.get(t.id)
      const itens = r ? Itens.safeParse(r.text) : null
      // concluído sem resultado legível não é "pronto com zero": é falha que a tela diz
      par = r && itens?.success && itens.data.items.length > 0 ? { ...base, estado: 'pronto', titulos: itens.data.items, gerado_em: r.generated_at } : { ...base, estado: 'falhou', pedido_em }
    } else if (t.status === 'refused') {
      const m = t.refused_reason?.startsWith('validador-') ? t.refused_reason.slice('validador-'.length) : null
      par = m !== null && MOTIVOS.has(m) ? { ...base, estado: 'recusado', motivo: m as MotivoTitulo, pedido_em } : { ...base, estado: 'falhou', pedido_em }
    } else par = { ...base, estado: 'falhou', pedido_em }
    const lista = porSinal.get(t.target_signal_id) ?? []
    lista.push(par)
    porSinal.set(t.target_signal_id, lista)
  }
  return { forjaSabePedir, porSinal }
}
