// A regra pura da retenção: quem é lido hoje (A5 E6/E8, Tarefa 8). Sem banco, sem rede, sem relógio.
// Os fatos vêm de `yt_own_retention_facts` (apêndice B do plano); aqui só se decide. O passo (Tarefa 9), o
// critério (Tarefa 10) e o leitor da tela (Tarefa 12b) importam `Janela` e `decidirRetencao` daqui.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { addDays, diffDias, utcDay, type DiaPt } from './day-pt'
import { separarPermanentes, type Atrasado } from './atraso-permanente'

export const RETENCAO = {
  vencimentoDias: 7,
  levaDias: 7,
  viewRecenteDias: 14,
  diarioAtrasadoDias: 7,
  videoNovoDias: 5,
  janelaDesisteDias: 45,
  margemDaFonteDias: 3,
} as const

/** O dia (Pacífico) a partir do qual uma janela de 7 ou 30 dias que FECHA é lida (decisão 32: nada antes). */
export const RETENCAO_JANELAS_DESDE: DiaPt = '2026-10-13'

export type Janela = 'vida' | 'primeiros_7_dias' | 'primeiros_30_dias'

const DIA = /^\d{4}-\d{2}-\d{2}$/
const dia = z.string().regex(DIA).refine(s => new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s)
const diaOuNulo = dia.nullable()
const contagem = z.number().finite().nonnegative()
const contagemOuNula = contagem.nullable()
const instante = z.string().refine(s => !Number.isNaN(Date.parse(s)))

const esquemaFato = z.object({
  youtube_video_id: z.string().min(1),
  video_id: z.string().min(1),
  site_id: z.string().min(1),
  duration_seconds: contagemOuNula,
  publicado_dia_pt: dia,
  fonte_ate: diaOuNulo,
  views_total: contagemOuNula,
  ultimo_dia_com_view: diaOuNulo,
  views_7d: contagemOuNula,
  views_30d: contagemOuNula,
  vida_window_end: diaOuNulo,
  vida_collected_at: instante.nullable(),
  vida_views_at_read: contagemOuNula,
  tem_7d: z.boolean(),
  tem_30d: z.boolean(),
  primeira_tent_dia: diaOuNulo,
  leva_ancora_dia: diaOuNulo,
  diario_tent_dia: diaOuNulo,
  diario_tent_resultado: z.string().nullable(),
  diario_falhas_4d: contagem,
  vida_tent_dia: diaOuNulo,
  vida_tent_resultado: z.string().nullable(),
  vida_resposta_dia: diaOuNulo,
  d7_tent_dia: diaOuNulo,
  d7_tent_resultado: z.string().nullable(),
  d7_resposta_dia: diaOuNulo,
  d30_tent_dia: diaOuNulo,
  d30_tent_resultado: z.string().nullable(),
  d30_resposta_dia: diaOuNulo,
})

/** Os campos de `yt_own_retention_facts`, com os mesmos nomes. Nulo é "não se sabe", nunca 0. */
export type FatoRetencao = z.infer<typeof esquemaFato>

/** Valida a forma do jsonb que a função SQL devolve; lança se vier diferente. A mensagem não leva o dado. */
export function lerFatos(x: unknown): FatoRetencao[] {
  const r = z.array(esquemaFato).safeParse(x)
  if (!r.success) {
    const onde = r.error.issues[0]?.path.join('.') ?? ''
    throw new Error(`fatos de retenção em forma inesperada${onde ? ` (${onde})` : ''}`)
  }
  return r.data
}

export interface Leitura {
  ytId: string
  videoId: string | null
  siteId: string
  janela: Janela
  kind: 'retencao_vida' | 'retencao_7d' | 'retencao_30d'
  inicio: DiaPt
  fim: DiaPt
  windowEnd: DiaPt
  viewsAtRead: number | null
  prioridade: 0 | 1 | 2
}

export interface Decisao {
  ler: Leitura[]
  /** Vídeos de 5 dias ou mais sem diário em dia, ainda vermelhos. */
  semDiarioEmDia: string[]
  /** Os que ficaram atrasados por 3 dias ou mais com o YouTube não devolvendo o vídeo 4 dias seguidos. */
  semRespostaDoYoutube: string[]
  pane: boolean
  /** Vídeos de menos de 5 dias sem diário em dia: não é falha. */
  novos: string[]
  adiadosPelaLeva: number
}

export interface OpcoesDaRegra {
  hojePt: DiaPt
  hojeUtc: string
  janelasDesde?: DiaPt
  vencimentoDias?: number
  levaDias?: number
}

function hashDoId(ytId: string): number {
  return createHash('sha256').update(ytId).digest().readUInt32BE(0)
}

/** O dia da semana (0 a 6) em que o vídeo nunca tentado é lido: sha256(ytId), 4 primeiros bytes, módulo 7. */
export function diaDaLeva(ytId: string): number {
  return hashDoId(ytId) % RETENCAO.levaDias
}

function diasDesdeEpoca(diaUtc: string): number {
  return diffDias('1970-01-01', diaUtc)
}

const FIM_DE_JANELA = { primeiros_7_dias: 6, primeiros_30_dias: 29 } as const
const KIND_DA_JANELA = { vida: 'retencao_vida', primeiros_7_dias: 'retencao_7d', primeiros_30_dias: 'retencao_30d' } as const

export function decidirRetencao(fatos: readonly FatoRetencao[], o: OpcoesDaRegra): Decisao {
  const { hojePt, hojeUtc } = o
  const janelasDesde = o.janelasDesde ?? RETENCAO_JANELAS_DESDE
  const vencimento = o.vencimentoDias ?? RETENCAO.vencimentoDias
  const levaDias = o.levaDias ?? RETENCAO.levaDias

  const ler: Leitura[] = []
  const novos: string[] = []
  const atrasados: (Atrasado & { ytId: string })[] = []
  let adiadosPelaLeva = 0

  const limiteDoDiario = addDays(hojePt, -RETENCAO.diarioAtrasadoDias)
  const limiteDaView = addDays(hojePt, -RETENCAO.viewRecenteDias)
  const slotDeHoje = ((diasDesdeEpoca(hojeUtc) % levaDias) + levaDias) % levaDias
  const elegiveis = fatos.filter(f => diffDias(f.publicado_dia_pt, hojePt) >= RETENCAO.videoNovoDias).length

  const nova = (f: FatoRetencao, janela: Janela, p: Pick<Leitura, 'inicio' | 'fim' | 'windowEnd' | 'viewsAtRead' | 'prioridade'>): Leitura => ({
    ytId: f.youtube_video_id,
    videoId: f.video_id,
    siteId: f.site_id,
    janela,
    kind: KIND_DA_JANELA[janela],
    ...p,
  })

  for (const f of fatos) {
    const idade = diffDias(f.publicado_dia_pt, hojePt)

    // 1. Sem diário em dia: nada é lido.
    if (f.fonte_ate === null || f.fonte_ate < limiteDoDiario) {
      if (idade < RETENCAO.videoNovoDias) {
        novos.push(f.youtube_video_id)
      } else {
        atrasados.push({
          ytId: f.youtube_video_id,
          diasAtrasado: f.fonte_ate === null ? idade - RETENCAO.videoNovoDias : diffDias(f.fonte_ate, addDays(hojePt, -(RETENCAO.diarioAtrasadoDias + 1))),
          falhasDoDiario4d: f.diario_falhas_4d,
        })
      }
      continue
    }

    // 2. A vida inteira.
    const windowEnd = f.fonte_ate < hojePt ? f.fonte_ate : hojePt
    const vida = (prioridade: 0 | 1 | 2): void => {
      ler.push(nova(f, 'vida', { inicio: f.publicado_dia_pt, fim: hojePt, windowEnd, viewsAtRead: f.views_total, prioridade }))
    }
    const temLinha = f.vida_window_end !== null
    const fonteAndou = temLinha && windowEnd > (f.vida_window_end as string)
    const tentou = f.vida_tent_dia !== null
    const semResposta = tentou && (f.vida_resposta_dia === null || (f.vida_tent_dia as string) > f.vida_resposta_dia)

    if (semResposta) {
      // (a) a última tentativa não teve resposta. Com linha, só lê se a fonte andou (senão trocaria a curva da semana anterior).
      if (!temLinha || fonteAndou) vida(0)
    } else if (temLinha) {
      // (b) e (e): tem linha. A base é o mais recente entre o dia da coleta e a última resposta.
      const coletado = f.vida_collected_at === null ? null : utcDay(new Date(f.vida_collected_at))
      const base = [coletado, f.vida_resposta_dia].filter((x): x is string => x !== null).sort().pop() ?? null
      const venceu = base !== null && diffDias(base, hojeUtc) >= vencimento
      const viewsNovas = f.views_total !== null && (f.vida_views_at_read === null || f.views_total > f.vida_views_at_read)
      if (venceu && viewsNovas && fonteAndou) vida(1)
    } else if (tentou) {
      // (c) sem linha, com resposta vazia.
      const resposta = f.vida_resposta_dia as string
      const venceu = diffDias(resposta, hojeUtc) >= vencimento
      const viuDepois = f.ultimo_dia_com_view !== null && f.ultimo_dia_com_view >= addDays(resposta, -RETENCAO.margemDaFonteDias)
      if (venceu && viuDepois) vida(1)
    } else if (f.ultimo_dia_com_view !== null && f.ultimo_dia_com_view >= limiteDaView) {
      // (d) nunca tentado, com view recente.
      vida(0)
    } else if (f.leva_ancora_dia !== null && f.leva_ancora_dia <= addDays(hojeUtc, -levaDias)) {
      // (d) a primeira leva do canal já acabou: o vídeo que perdeu o seu dia não espera mais.
      vida(2)
    } else if (hashDoId(f.youtube_video_id) % levaDias === slotDeHoje) {
      vida(2)
    } else {
      adiadosPelaLeva++
    }

    // 3. As janelas dos primeiros 7 e 30 dias.
    for (const janela of ['primeiros_7_dias', 'primeiros_30_dias'] as const) {
      const sete = janela === 'primeiros_7_dias'
      const fim = addDays(f.publicado_dia_pt, FIM_DE_JANELA[janela])
      const jaTem = sete ? f.tem_7d : f.tem_30d
      const tent = sete ? f.d7_tent_dia : f.d30_tent_dia
      const resposta = sete ? f.d7_resposta_dia : f.d30_resposta_dia
      if (jaTem || fim < janelasDesde || f.fonte_ate < fim || hojePt > addDays(fim, RETENCAO.janelaDesisteDias)) continue
      const semRespostaNaJanela = tent !== null && (resposta === null || tent > resposta)
      const vencida = resposta !== null && diffDias(resposta, hojeUtc) >= vencimento
      if (tent === null || semRespostaNaJanela || vencida) {
        ler.push(nova(f, janela, { inicio: f.publicado_dia_pt, fim, windowEnd: fim, viewsAtRead: sete ? f.views_7d : f.views_30d, prioridade: 1 }))
      }
    }
  }

  const { vermelho, acaoDoDono, pane } = separarPermanentes(atrasados, elegiveis)
  const ordenar = (l: readonly { ytId: string }[]) => l.map(a => a.ytId).sort(comparar)

  // Dentro da prioridade: quem nunca foi tentado vem PRIMEIRO, depois a tentativa mais antiga, e só então o id.
  // Sem isso, ids baixos que falham todo dia ficariam sempre na frente e os altos nunca seriam lidos (8-3).
  const tentativa = new Map(fatos.map(f => [f.youtube_video_id, f.vida_tent_dia] as const))
  const porTentativa = (a: string, b: string): number => {
    const ta = tentativa.get(a) ?? null
    const tb = tentativa.get(b) ?? null
    if (ta === tb) return 0
    if (ta === null) return -1
    if (tb === null) return 1
    return comparar(ta, tb)
  }
  ler.sort((a, b) => a.prioridade - b.prioridade || porTentativa(a.ytId, b.ytId) || comparar(a.ytId, b.ytId) || ORDEM_JANELA[a.janela] - ORDEM_JANELA[b.janela])

  return {
    ler,
    semDiarioEmDia: ordenar(vermelho),
    semRespostaDoYoutube: ordenar(acaoDoDono),
    pane,
    novos: [...novos].sort(comparar),
    adiadosPelaLeva,
  }
}

const ORDEM_JANELA: Record<Janela, number> = { vida: 0, primeiros_7_dias: 1, primeiros_30_dias: 2 }

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
