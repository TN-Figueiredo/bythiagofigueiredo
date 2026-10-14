// Semente do A/B Lab nas versões do vídeo próprio (E18, Tarefa 11). Nasce em SIMULAÇÃO: lê, imprime o que gravaria e NÃO grava.
// Só grava com `--gravar --confirmar=<ref do projeto>` (o ref é o primeiro pedaço do host de NEXT_PUBLIC_SUPABASE_URL). Quem roda em
// produção é o dono. O .env.local aponta para PRODUÇÃO: a primeira linha impressa é o endereço do projeto, sem chave.
//   cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs --env-file=.env.local scripts/semear-versoes-ab-lab.ts [--gravar --confirmar=<ref>]
// Nunca imprime título (dado privado): só o id do vídeo, o início do ciclo e a contagem.
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerPaginado } from '../src/lib/youtube/coleta/paginar'
import { montarSementeAb, type CicloSemente, type LinhaSemente, type TesteSemente, type VideoSemente } from '../src/lib/youtube/coleta/versoes-semente-ab'

export interface DepsSemente {
  env: Record<string, string | undefined>
  sb: SupabaseClient
  dizer: (linha: string) => void
  dizerErro: (linha: string) => void
}

const TETO = 20_000
const CATALOGO: Record<string, string> = {
  sem_estado: 'o canal ainda não tem estado de versões: espere a coleta diária derivar o canal antes de semear',
  fora_do_pre_registro: 'alguma linha cai dentro do período já registrado; nada foi gravado para este canal',
  video_fora_do_canal: 'algum vídeo não pertence ao canal; nada foi gravado para este canal',
  canal_fora_do_site: 'o canal não pertence ao site; nada foi gravado',
  argumento_invalido: 'a função recusou os argumentos; nada foi gravado',
}
const mensagemDe = (m: unknown): string => (typeof m === 'string' && CATALOGO[m] ? CATALOGO[m]! : 'erro desconhecido ao gravar; nada foi copiado do banco para esta mensagem')

async function ler<T>(sb: SupabaseClient, tabela: string, colunas: string, filtros: (q: ConsultaLeitura) => ConsultaLeitura, ordem: string): Promise<T[] | null> {
  const r = await lerPaginado<T>((de, ate) => filtros(sb.from(tabela).select(colunas) as unknown as ConsultaLeitura).order(ordem).range(de, ate) as unknown as PromiseLike<{ data: T[] | null; error: null }>, TETO)
  return r.ok ? r.linhas : null
}
interface ConsultaLeitura { eq(c: string, v: string): ConsultaLeitura; in(c: string, v: readonly string[]): ConsultaLeitura; order(c: string): ConsultaLeitura; range(de: number, ate: number): PromiseLike<unknown> }

/** Devolve o código de saída: 0 ok, 1 falha de leitura ou de gravação, 2 uso errado. */
export async function executarSemente(argv: readonly string[], d: DepsSemente): Promise<number> {
  const url = d.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  let host = ''
  try { host = new URL(url).host } catch { /* host vazio: vira erro abaixo */ }
  d.dizer(`projeto: ${host || '(endereço ausente)'}`)
  const ref = host.split('.')[0] ?? ''
  const gravar = argv.includes('--gravar')
  const confirmar = argv.find(a => a.startsWith('--confirmar='))?.slice('--confirmar='.length) ?? null
  if (host === '') { d.dizerErro('NEXT_PUBLIC_SUPABASE_URL ausente ou inválida'); return 2 }
  if (gravar && (confirmar === null || confirmar !== ref)) {
    d.dizerErro('--gravar exige --confirmar=<ref do projeto> igual ao ref impresso acima; nada foi lido nem gravado')
    return 2
  }

  const canais = await ler<{ id: string; site_id: string }>(d.sb, 'youtube_channels', 'id, site_id', q => q, 'id')
  if (canais === null) { d.dizerErro('não foi possível ler os canais'); return 1 }
  let totalLinhas = 0, totalCiclos = 0, falhou = false
  for (const canal of canais) {
    const videosDb = await ler<{ id: string; youtube_video_id: string }>(d.sb, 'youtube_videos', 'id, youtube_video_id', q => q.eq('channel_id', canal.id), 'id')
    const estado = await ler<{ tracking_since: string }>(d.sb, 'yt_own_versions_state', 'tracking_since', q => q.eq('site_id', canal.site_id).eq('channel_id', canal.id), 'channel_id')
    if (videosDb === null || estado === null) { d.dizerErro('leitura falhou para um canal'); falhou = true; continue }
    const videos: VideoSemente[] = videosDb.map(v => ({ id: v.id, ytId: v.youtube_video_id }))
    const desde = estado[0]?.tracking_since
    if (desde === undefined) { d.dizer(`canal ${canal.id}: ainda sem estado de versões; nada a semear`); continue }
    const testesDb = videos.length === 0 ? [] : await ler<{ id: string; youtube_video_id: string }>(d.sb, 'ab_tests', 'id, youtube_video_id', q => q.in('youtube_video_id', videos.map(v => v.id)), 'id')
    if (testesDb === null) { d.dizerErro('leitura dos testes falhou'); falhou = true; continue }
    const testes: TesteSemente[] = testesDb.map(t => ({ id: t.id, videoId: t.youtube_video_id }))
    const ciclosDb = testes.length === 0 ? [] : await ler<{ id: string; test_id: string; variant_id: string | null; started_at: string; ended_at: string | null; applied_metadata: Record<string, unknown> | null }>(
      d.sb, 'ab_test_cycles', 'id, test_id, variant_id, started_at, ended_at, applied_metadata', q => q.in('test_id', testes.map(t => t.id)), 'id')
    if (ciclosDb === null) { d.dizerErro('leitura dos ciclos falhou'); falhou = true; continue }
    const ciclos: CicloSemente[] = ciclosDb.map(c => ({
      id: c.id, testId: c.test_id, variantId: c.variant_id, iniciadoEm: c.started_at, encerradoEm: c.ended_at,
      tituloSet: typeof c.applied_metadata?.title_set === 'string' ? c.applied_metadata.title_set : null,
    }))
    totalCiclos += ciclos.length
    const { linhas, fora } = montarSementeAb(testes, ciclos, videos, desde)
    totalLinhas += linhas.length
    const porMotivo = fora.reduce<Record<string, number>>((m, f) => ({ ...m, [f.motivo]: (m[f.motivo] ?? 0) + 1 }), {})
    d.dizer(`canal ${canal.id}: ${ciclos.length} ciclo(s), ${linhas.length} linha(s) a gravar, fora: ${JSON.stringify(porMotivo)}`)
    for (const l of linhas) d.dizer(`  ${l.youtube_video_id} desde ${l.first_seen_at}`)
    if (!gravar || linhas.length === 0) continue
    const r = await d.sb.rpc('yt_own_versions_seed_pre', { p_channel_id: canal.id, p_site_id: canal.site_id, p_rows: linhas satisfies LinhaSemente[] })
    if (r.error) { d.dizerErro(mensagemDe(r.error.message)); falhou = true; continue }
    const res = r.data as { inseridas?: number; ja_existiam?: number } | null
    d.dizer(`  gravado: inseridas ${res?.inseridas ?? 0}, já existiam ${res?.ja_existiam ?? 0}`)
  }
  if (totalCiclos === 0) { d.dizer('nenhum ciclo para semear'); return falhou ? 1 : 0 }
  if (!gravar) d.dizer(`simulação: ${totalLinhas} linha(s) seriam gravadas; nada foi gravado (use --gravar --confirmar=${ref})`)
  return falhou ? 1 : 0
}

async function main(): Promise<number> {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) { console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no ambiente'); return 2 }
  const sb = createClient(url, chave, { auth: { persistSession: false } })
  return executarSemente(process.argv.slice(2), { env: process.env, sb, dizer: l => console.log(l), dizerErro: l => console.error(l) })
}

// Só roda quando é o comando; importar este arquivo (o teste) não executa nada.
if (process.argv[1] && /semear-versoes-ab-lab/.test(process.argv[1])) {
  main().then(c => process.exit(c), () => { console.error('falha inesperada'); process.exit(1) })
}
