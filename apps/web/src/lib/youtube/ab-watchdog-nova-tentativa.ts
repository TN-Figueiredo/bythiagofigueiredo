import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emParalelo } from '@/lib/util/em-paralelo'
import { LIMITE_PADRAO, NAO_INICIA_SETTLE_DEPOIS_MS, PRAZO_DA_ROTA_MS } from '@/lib/youtube/ab-watchdog-drift'
import type { RelogioDoVigia } from '@/lib/youtube/ab-watchdog-drift'
import { lerRetratoPadrao, novaTentativa } from '@/lib/youtube/ab-settle'
import { avisarNovaTentativa, avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import { camposPendentes, erroDeCota, paraRestoreStatus } from '@/lib/youtube/ab-restore'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'

export interface ResultadoNovaTentativa {
  tentadas: number
  ok: number
  falharam: number
  desistiram: number
  pulados: number
  cota: number
  ignorados: { outro_teste: number; pausado_variante: number; teste_youtube: number }
  adiados: number
  falhas: number
  semDestinatario: number
}

export interface PortasDaNovaTentativa { tentar?: typeof novaTentativa }

interface TesteLido { id: string; site_id: string; name: string; status: string; youtube_video_id: string; restore_seq: number; restore_status: unknown }

const ABERTOS = ['draft', 'queued', 'active', 'paused']
const CAMPOS: CampoNome[] = ['title', 'thumbnail']

export const zeroNovaTentativa = (): ResultadoNovaTentativa => ({
  tentadas: 0, ok: 0, falharam: 0, desistiram: 0, pulados: 0, cota: 0,
  ignorados: { outro_teste: 0, pausado_variante: 0, teste_youtube: 0 }, adiados: 0, falhas: 0, semDestinatario: 0,
})

function ler<T>(r: { data: unknown; error: { message: string } | null }, contexto: string): T[] {
  if (r.error) throw new Error(`ab-watchdog: ${contexto}: ${r.error.message}`)
  return (r.data ?? []) as T[]
}

/** Rótulo da variante que ficou no ar, só quando se sabe que a escrita não aconteceu (S3 do Phil). */
export async function rotuloNoAr(supabase: SupabaseClient, t: { id: string; site_id: string }, campos: RestoreStatus, tentados: CampoNome[]): Promise<string | null> {
  const quem = tentados.find((c) => campos[c]?.estado === 'falhou' || campos[c]?.estado === 'desistiu')
  if (!quem || campos[quem]?.escreveu !== false) return null
  const retrato = await lerRetratoPadrao(supabase, t.id, t.site_id)
  const id = retrato?.varianteUltimoCiclo
  const v = id ? retrato.variantes.find((x) => x.id === id) : undefined
  if (!v || v.is_original) return null
  return v.label ?? null
}

/** Fase 3 do vigia: repete a restauração dos campos `falhou`, no máximo uma tentativa por teste por execução. */
export async function faseNovaTentativa(
  supabase: SupabaseClient,
  relogio: RelogioDoVigia,
  f: typeof fetch = fetch,
  limite: number = LIMITE_PADRAO,
  portas: PortasDaNovaTentativa = {},
): Promise<ResultadoNovaTentativa> {
  const r = zeroNovaTentativa()
  const tentar = portas.tentar ?? novaTentativa

  const testes = ler<TesteLido>(await supabase
    .from('ab_tests')
    .select('id, site_id, name, status, youtube_video_id, restore_seq, restore_status')
    .neq('status', 'active')
    .or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou'), 'testes com campo falhou')
  if (testes.length === 0) return r

  // Uma leitura só: os testes abertos dos vídeos lidos, por vídeo (S2: o próprio teste não conta como "outro").
  const abertos = new Map<string, Set<string>>()
  const abertosR = ler<{ id: string; youtube_video_id: string }>(await supabase
    .from('ab_tests').select('id, youtube_video_id')
    .in('youtube_video_id', [...new Set(testes.map((t) => t.youtube_video_id))]).in('status', ABERTOS), 'testes abertos dos vídeos')
  for (const a of abertosR) abertos.set(a.youtube_video_id, (abertos.get(a.youtube_video_id) ?? new Set()).add(a.id))

  const itens: Array<{ t: TesteLido; pend: CampoNome[] }> = []
  for (const t of testes) {
    const rs = paraRestoreStatus(t.restore_status)
    if (!rs) {
      r.falhas++
      Sentry.captureMessage('ab-watchdog: restore_status ilegível', { extra: { testId: t.id } })
      continue
    }
    const pend = camposPendentes(rs, 'vigia')
    if ([...(abertos.get(t.youtube_video_id) ?? [])].some((id) => id !== t.id)) { r.ignorados.outro_teste++; continue }
    if (t.status === 'paused' && pend.some((c) => rs[c]!.destino !== 'original')) { r.ignorados.pausado_variante++; continue }
    itens.push({ t, pend })
  }

  const tentarUm = async ({ t, pend }: { t: TesteLido; pend: CampoNome[] }): Promise<void> => {
    let contou = false
    const contar = (): void => { if (!contou) { contou = true; r.tentadas++ } }
    try {
      const res = await tentar(t.id, {
        siteId: t.site_id, origem: 'vigia', prazo: relogio.inicio + PRAZO_DA_ROTA_MS, seqEsperado: t.restore_seq,
      }, { supabase, fetch: f })
      if (res.resultado === 'outro_teste') { r.ignorados.outro_teste++; return }
      if (res.resultado === 'teste_youtube') { r.ignorados.teste_youtube++; return } // teste do YouTube em andamento: não escreve, mas fica visível no resumo
      if (res.resultado === 'destino_invalido') {
        contar()
        r.falhas++
        const rs = paraRestoreStatus(t.restore_status)!
        const desistidos: RestoreStatus = {}
        for (const c of pend) desistidos[c] = { ...rs[c]!, estado: 'desistiu', motivo: 'destino_invalido' }
        const aviso = await avisarRestauracao(supabase, { id: t.id, site_id: t.site_id, name: t.name, restore_seq: t.restore_seq + 1 }, desistidos)
        if (aviso === 'sem_destinatario') r.semDestinatario++
        if (aviso === 'falha_de_envio') r.falhas++
        return
      }
      if (res.resultado !== 'feito') return // em_andamento, ja_encerrado, mudou: outro escritor é o dono; não conta como tentada (Y-A8)
      contar()
      const campos = res.campos
      const tentados = pend.filter((c) => campos[c])
      const estados = tentados.map((c) => campos[c]!.estado)
      if (estados.includes('desistiu')) r.desistiram++
      else if (estados.includes('falhou')) {
        r.falharam++
        if (tentados.some((c) => campos[c]!.estado === 'falhou' && erroDeCota(campos[c]!.erro))) r.cota++
      } else if (estados.some((e) => e.startsWith('pulado_'))) r.pulados++ // Y-10: pulado_drift não é ok
      else r.ok++
      const noAr = await rotuloNoAr(supabase, t, campos, tentados)
      const aviso = await avisarNovaTentativa(supabase, { id: t.id, site_id: t.site_id, name: t.name }, campos, noAr)
      if (aviso === 'sem_destinatario') r.semDestinatario++
      if (aviso === 'falha_de_envio') r.falhas++
    } catch (e) {
      contar()
      r.falhas++
      Sentry.captureException(e, { tags: { area: 'ab-watchdog', fase: 'nova-tentativa' }, extra: { testId: t.id } })
    }
  }

  const { adiados } = await emParalelo(itens, limite, tentarUm, () => relogio.agora() - relogio.inicio >= NAO_INICIA_SETTLE_DEPOIS_MS)
  r.adiados += adiados
  return r
}
