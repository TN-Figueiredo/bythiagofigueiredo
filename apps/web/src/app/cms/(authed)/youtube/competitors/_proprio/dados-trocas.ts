// A5 · E5b · Tarefa 20c: a entrada das trocas do vídeo próprio (servidor).
// Sem prova de leitura: `negado`, sem criar o cliente de serviço. Com prova, em paralelo: as versões do vídeo e os testes do A/B Lab.
// Só se o vídeo tem troca que conta, o alcance do vídeo desde o começo da janela da troca mais antiga (nunca antes do teto de 400 dias).
// Cada leitor que falha vira `{ acesso: 'erro' }` no seu lugar e as outras leituras continuam; UM aviso por requisição, sem título nem texto do banco.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerAlcanceDoVideo, TETO_DIAS_ALCANCE_DO_VIDEO, type AlcanceDoVideo } from '@/lib/youtube/observatorio/proprio/ler'
import { lerTestesAb, type TestesAbDoVideo } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { lerVersoes, ErroLeituraVersoes } from '@/lib/youtube/observatorio/proprio-versoes/ler'
import { PROPRIO_RULES } from '@/lib/youtube/observatorio/proprio-versoes/regras'
import type { VersoesCanal } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import { desdeDaTroca, trocasQueContam } from './trocas-contam'

export interface TrocasLidas {
  versoes: VersoesCanal
  testes: Privado<TestesAbDoVideo>
  /** por que `testes` veio em erro: o teto estourado tem texto próprio na tela */
  motivoTestes: 'teto' | 'banco' | null
  /** null: o vídeo não tem troca que conta e o alcance NÃO foi lido */
  alcance: Privado<AlcanceDoVideo> | null
}

const TAGS = { component: 'observatorio-proprio', step: 'ler-trocas' } as const

const motivoDe = (e: unknown): string => {
  if (e instanceof ErroLeituraVersoes) return e.motivo
  if (e instanceof ObservatoryLoadError) return 'teto_ou_banco'
  if (e instanceof RangeError) return 'faixa'
  return 'inesperado'
}
const codigoDe = (e: unknown): string | null => {
  if (e instanceof ErroLeituraVersoes) return e.codigo
  const c = (e as { code?: unknown } | null)?.code
  return typeof c === 'string' ? c : null
}

export async function lerTrocas(a: {
  canalId: string
  ytId: string
  videoUuid: string
  agora: number
  prova: LeituraPrivadaDoSite | null
}): Promise<Privado<TrocasLidas>> {
  if (!leituraValida(a.prova)) return { acesso: 'negado' }
  const leitura = a.prova
  const hoje = dayPt(new Date(a.agora))
  const sb = getSupabaseServiceClient()
  const base = { leitura, canalId: a.canalId, hoje }
  const motivos: string[] = []
  const codigos: string[] = []
  const falhou = (parte: string, e: unknown): void => {
    motivos.push(`${parte}:${motivoDe(e)}`)
    const c = codigoDe(e)
    if (c) codigos.push(c)
  }

  const [versoesR, testesR] = await Promise.allSettled([
    lerVersoes(sb, { ...base, ytIds: [a.ytId] }),
    lerTestesAb(sb, { ...base, videoUuid: a.videoUuid }),
  ])

  let motivoTestes: 'teto' | 'banco' | null = null
  let testes: Privado<TestesAbDoVideo> = { acesso: 'erro' }
  if (testesR.status === 'fulfilled') {
    if (testesR.value.acesso === 'negado') { falhou('testes', new Error('negado')); motivoTestes = 'banco' } // negado COM prova é erro daquele leitor, nunca lista vazia
    else testes = testesR.value
  } else {
    falhou('testes', testesR.reason)
    motivoTestes = testesR.reason instanceof ObservatoryLoadError && testesR.reason.teto ? 'teto' : 'banco'
  }

  let versoes: VersoesCanal | null = null
  let alcance: Privado<AlcanceDoVideo> | null = null
  if (versoesR.status === 'rejected') falhou('versoes', versoesR.reason)
  else if (versoesR.value.acesso !== 'ok') falhou('versoes', new Error(versoesR.value.acesso))
  else {
    versoes = versoesR.value.dado
    try {
      const video = versoes.videos.find(v => v.ytId === a.ytId)
      const trocas = video ? trocasQueContam(video) : []
      if (trocas.length > 0) {
        const menor = trocas.map(t => desdeDaTroca(t, PROPRIO_RULES.trocaJanelaDias)).reduce((m, d) => (d < m ? d : m))
        const piso = addDays(hoje, -TETO_DIAS_ALCANCE_DO_VIDEO)
        const desde = menor < piso ? piso : menor
        try {
          const r = await lerAlcanceDoVideo(sb, { ...base, ytId: a.ytId, desde })
          if (r.acesso === 'negado') { falhou('alcance', new Error('negado')); alcance = { acesso: 'erro' } } else alcance = r
        } catch (e) {
          falhou('alcance', e)
          alcance = { acesso: 'erro' }
        }
      }
    } catch {
      // janela nula numa versão que conta (`desdeDaTroca` lança): o bloco inteiro das trocas vira erro
      motivos.push('versoes:janela_nula')
      versoes = null
    }
  }

  if (motivos.length > 0) {
    Sentry.captureMessage('observatório: a leitura das trocas do vídeo próprio falhou', { level: 'warning', tags: TAGS, extra: { motivos, codigos } })
  }
  if (versoes === null) return { acesso: 'erro' }
  return { acesso: 'ok', dado: { versoes, testes, motivoTestes, alcance } }
}
