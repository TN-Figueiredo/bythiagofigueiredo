// F4 T2: a borda do "esse vídeo do terceiro já nos manda tráfego?". Lê a cobertura e as linhas da origem "vídeos sugeridos" dos vídeos
// nossos que cobrem o lugar do sinal, e entrega a `TrafegoDoTerceiro` de cada item. Só LÊ, só depois da prova (`provaValida`: brand check
// da leitura E mesmo site) e só pelas consultas de `proprio/consultas.ts` (nenhum `.from` desta tabela mora aqui).
// Falha em verde é o risco: dado ausente vira `nao_medido` com motivo, nunca `nao`. Qualquer exceção vira `erro_de_leitura` (a lista não cai).
// Não grava `detail` nem id de terceiro em log; o `detail` vazio só vira "dia sem origem informada".
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, dayPt } from '../../../coleta/day-pt'
import { passoDesligado } from '../../../coleta/passos-desligados'
import { ORIGEM_SUGERIDOS, ORIGEM_SUGERIDOS_SEM_PAR } from '../../../reporting/codigos'
import {
  contarOrigem, lerCobertura, lerDetalheDiario, TETO_VIDEOS_CONSULTA, type AlvoConsulta,
} from '../../proprio/consultas'
import { leituraValida, type AcessoPrivado, type LeituraPrivadaDoSite } from '../../proprio/leitura-privada'
import type { ItemDeSinal } from '../leitura'
import { outlierMaisForte } from '../outlier'
import {
  estadoDaSugestao, estadoDoPar, REGRA_F4, type EstadoDoPar, type MotivoNaoMedido, type TrafegoDoTerceiro,
} from './regra'

/** Linhas por bloco de 50 vídeos nossos × até 90 dias × alguns terceiros: com folga; acima lança (vira `erro_de_leitura`). */
const TETO_LINHAS = 200_000
const SEP = '\u0001'
const BLOCO_DE_IDS = 200

export type ProvaDaLeitura = { ok: true; leitura: LeituraPrivadaDoSite } | { ok: false; motivo: 'sem_direito' | 'nao_conferido' }

/** Molde de `lista-borda.ts`: o brand check da leitura E o mesmo site. `undefined`/`null`/objeto imitado = `sem_direito`. */
export function provaValida(acesso: AcessoPrivado | LeituraPrivadaDoSite | null | undefined, siteId: string): ProvaDaLeitura {
  if (acesso === null || acesso === undefined) return { ok: false, motivo: 'sem_direito' }
  if (leituraValida(acesso)) return acesso.siteId === siteId ? { ok: true, leitura: acesso } : { ok: false, motivo: 'sem_direito' }
  const a = acesso as Partial<AcessoPrivado>
  if (typeof a !== 'object' || !('leitura' in a)) return { ok: false, motivo: 'sem_direito' }
  if (a.leitura !== null && a.leitura !== undefined && leituraValida(a.leitura)) {
    return a.leitura.siteId === siteId ? { ok: true, leitura: a.leitura } : { ok: false, motivo: 'sem_direito' }
  }
  return { ok: false, motivo: a.negativa === 'nao_foi_possivel_conferir' ? 'nao_conferido' : 'sem_direito' }
}

type ItemLido = Pick<ItemDeSinal, 'id' | 'evidence' | 'proprios_agora' | 'proprios_agora_n'>

export interface ResultadoDoTrafego {
  porItem: Map<string, TrafegoDoTerceiro>
  /** Linhas da origem "sem par" nos canais do site na janela; `null` = não medido (nunca vira 0). */
  codigo32: number | null
}

function emBlocos<T>(xs: readonly T[], tam: number): T[][] {
  const blocos: T[][] = []
  for (let i = 0; i < xs.length; i += tam) blocos.push(xs.slice(i, i + tam))
  return blocos
}

const numeroOuNulo = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : null }
  return null
}

const doMotivo = (itens: readonly ItemLido[], motivo: MotivoNaoMedido): Map<string, TrafegoDoTerceiro> => {
  const m = new Map<string, TrafegoDoTerceiro>()
  for (const it of itens) m.set(it.id, estadoDaSugestao([], null, motivo, it.proprios_agora_n ?? 0, false))
  return m
}

interface Par { itemId: string; proprioId: string; terceiroId: string }

export async function lerTrafegoDoTerceiro(
  sb: SupabaseClient,
  siteId: string,
  acesso: AcessoPrivado | LeituraPrivadaDoSite | null | undefined,
  itens: ReadonlyArray<ItemLido>,
  hoje: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoDoTrafego> {
  const prova = provaValida(acesso, siteId)
  if (!prova.ok) return { porItem: doMotivo(itens, prova.motivo), codigo32: null }
  if (itens.length === 0) return { porItem: new Map(), codigo32: null }
  try {
    if (passoDesligado('normalizadores', env)) return { porItem: doMotivo(itens, 'coleta_desligada'), codigo32: null }
    return await ler(sb, siteId, itens, hoje)
  } catch {
    return { porItem: doMotivo(itens, 'erro_de_leitura'), codigo32: null }
  }
}

async function ler(sb: SupabaseClient, siteId: string, itens: ReadonlyArray<ItemLido>, hoje: string): Promise<ResultadoDoTrafego> {
  // (2) pares (nosso, terceiro) por item
  const geral = new Map<string, MotivoNaoMedido>()
  const pares: Par[] = []
  const truncada = new Set<string>()
  const terceiroDe = new Map<string, string>()
  for (const it of itens) {
    const forte = outlierMaisForte(it.evidence)
    if (!forte) { geral.set(it.id, 'sem_terceiro'); continue }
    if (it.proprios_agora === null) { geral.set(it.id, 'sem_proprios_medidos'); continue }
    terceiroDe.set(it.id, forte.video_id)
    if ((it.proprios_agora_n ?? 0) > it.proprios_agora.length) truncada.add(it.id)
    for (const p of new Set(it.proprios_agora)) pares.push({ itemId: it.id, proprioId: p, terceiroId: forte.video_id })
  }

  // (3) ids do YouTube: todos os vídeos do site (origem própria, P9), e os terceiros (sem `site_id`: o filtro é pelo canal)
  const nossos = new Map<string, string>() // id → youtube_video_id
  const proprioYt = new Set<string>()
  for (let de = 0; ; de += 1000) {
    const r = await sb.from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).range(de, de + 999)
    if (r.error) throw new Error('f4: leitura de youtube_videos falhou')
    const linhas = (Array.isArray(r.data) ? r.data : []) as Array<{ id: string; youtube_video_id: string | null }>
    for (const l of linhas) if (l.youtube_video_id) { nossos.set(l.id, l.youtube_video_id); proprioYt.add(l.youtube_video_id) }
    if (linhas.length < 1000) break
  }
  const terceirosIds = [...new Set(pares.map((p) => p.terceiroId))]
  const terceiro = new Map<string, { yt: string; pub: string | null }>() // uuid → vídeo do YouTube + dia PT da publicação
  for (const bloco of emBlocos(terceirosIds, BLOCO_DE_IDS)) {
    const r = await sb.from('competitor_videos').select('id, video_id, published_at, competitor_channels!inner(site_id)').in('id', bloco).eq('competitor_channels.site_id', siteId)
    if (r.error) throw new Error('f4: leitura de competitor_videos falhou')
    for (const l of (Array.isArray(r.data) ? r.data : []) as Array<{ id: string; video_id: string | null; published_at: string | null }>) {
      if (!l.video_id) continue
      const t = l.published_at ? Date.parse(l.published_at) : NaN
      terceiro.set(l.id, { yt: l.video_id, pub: Number.isNaN(t) ? null : dayPt(new Date(t)) })
    }
  }

  // pares utilizáveis; terceiro que é vídeo nosso sai (não é "terceiro")
  const resultado = new Map<string, EstadoDoPar[]>()
  const utilizaveis: Array<Par & { nossoYt: string; terceiroYt: string; pub: string }> = []
  for (const p of pares) {
    const lista = resultado.get(p.itemId) ?? []
    resultado.set(p.itemId, lista)
    const t = terceiro.get(p.terceiroId)
    const nossoYt = nossos.get(p.proprioId)
    if (!t || t.pub === null || !nossoYt) { lista.push({ estado: 'nao_medido', motivo: 'sem_id' }); continue }
    if (proprioYt.has(t.yt)) continue
    utilizaveis.push({ ...p, nossoYt, terceiroYt: t.yt, pub: t.pub })
  }

  let codigo32: number | null = null
  const cobertoAte = new Map<string, string>() // item → maior fim de cobertura
  if (utilizaveis.length > 0) {
    const piso = addDays(hoje, -REGRA_F4.janelaMaxDias)
    const menorPub = utilizaveis.reduce((m, u) => (u.pub < m ? u.pub : m), utilizaveis[0]!.pub)
    const de = menorPub > piso ? menorPub : piso
    const ytNossos = [...new Set(utilizaveis.map((u) => u.nossoYt))]
    const terceirosYt = [...new Set(utilizaveis.map((u) => u.terceiroYt))]

    const cobertura = new Map<string, Array<{ de: string; ate: string }>>()
    const linhas = new Map<string, Array<{ dia: string; views: number | null }>>() // (nosso, terceiro)
    const semOrigem = new Map<string, string[]>()
    let ausente = false

    await Promise.all(emBlocos(ytNossos, TETO_VIDEOS_CONSULTA).map(async (bloco) => {
      const alvo: AlvoConsulta = { siteId, canalId: null, ytIds: bloco, de, ate: hoje, teto: TETO_LINHAS }
      const [cob, det, sem] = await Promise.all([
        lerCobertura(sb, alvo, ['detalhe']),
        terceirosYt.length === 0 ? Promise.resolve(null) : lerDetalheDiario(sb, alvo, { sourceType: ORIGEM_SUGERIDOS, details: terceirosYt }),
        lerDetalheDiario(sb, alvo, { sourceType: ORIGEM_SUGERIDOS, details: [], semOrigem: true }),
      ])
      if (cob.ausente || sem.ausente || (det !== null && det.ausente)) { ausente = true; return }
      for (const r of cob.linhas) {
        const l = cobertura.get(r.youtube_video_id) ?? []
        l.push({ de: r.covered_from, ate: r.covered_to })
        cobertura.set(r.youtube_video_id, l)
      }
      if (det !== null && !det.ausente) {
        for (const r of det.linhas) {
          const k = r.youtube_video_id + SEP + r.detail
          const l = linhas.get(k) ?? []
          l.push({ dia: r.day_pt, views: numeroOuNulo(r.views) })
          linhas.set(k, l)
        }
      }
      for (const r of sem.linhas) {
        const l = semOrigem.get(r.youtube_video_id) ?? []
        l.push(r.day_pt)
        semOrigem.set(r.youtube_video_id, l)
      }
    }))

    for (const u of utilizaveis) {
      const lista = resultado.get(u.itemId)!
      for (const i of cobertura.get(u.nossoYt) ?? []) if (i.ate > (cobertoAte.get(u.itemId) ?? '')) cobertoAte.set(u.itemId, i.ate)
      if (ausente) { lista.push({ estado: 'nao_medido', motivo: 'schema_ausente' }); continue }
      lista.push(estadoDoPar({
        pubDoTerceiro: u.pub, hoje,
        intervalos: cobertura.get(u.nossoYt) ?? [],
        linhas: linhas.get(u.nossoYt + SEP + u.terceiroYt) ?? [],
        diasSemOrigem: semOrigem.get(u.nossoYt) ?? [],
      }))
    }

    // (5) a sentinela: a origem "sem par" não pode ter linha (se aparecer, o dado mudou de forma); sem alarme na leitura
    if (!ausente) {
      try {
        const r = await sb.from('youtube_channels').select('id').eq('site_id', siteId)
        const canais = ((Array.isArray(r.data) ? r.data : []) as Array<{ id: string }>).map((c) => c.id)
        if (!r.error) {
          const c = await contarOrigem(sb, siteId, canais, ORIGEM_SUGERIDOS_SEM_PAR, de, hoje)
          codigo32 = c.ausente ? null : (c.linhas[0] ?? null)
        }
      } catch {
        codigo32 = null
      }
    }
  }

  const porItem = new Map<string, TrafegoDoTerceiro>()
  for (const it of itens) {
    const motivo = geral.get(it.id) ?? null
    const tid = terceiroDe.get(it.id) ?? null
    const contexto = { desde: (tid !== null ? terceiro.get(tid)?.pub : null) ?? null, coberto_ate: cobertoAte.get(it.id) ?? null }
    porItem.set(it.id, estadoDaSugestao(resultado.get(it.id) ?? [], tid, motivo, it.proprios_agora_n ?? 0, truncada.has(it.id), contexto))
  }
  return { porItem, codigo32 }
}
