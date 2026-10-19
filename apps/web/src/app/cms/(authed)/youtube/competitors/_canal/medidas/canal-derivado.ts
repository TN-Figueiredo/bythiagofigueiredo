// E5a Tarefa 19: o que os três elementos de servidor (topo, células, blocos) tiram, cada um por conta própria, da MESMA promessa de medidas.
// Puro: relógio e dados entram por parâmetro. Nada aqui lê banco.
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import type { CriadorDoFio } from '../../_chrome/comentarios/fio-model'
import { celulaDeDirecao } from '../../_canais/direcao-model'
import { formatoDoCanal, type FormatoDoCanal } from './cabecalho-model'
import { estadoDaPagina, type EstadoDaPagina, type SincDaPagina } from './estado-model'
import type { EntradaDaFrase } from './frase-do-topo'
import { lancamentosDoCanal } from './lancamentos-model'
import type { TrocaDoMotor } from './linha-do-tempo-model'

/** O que a página já sabe, sem esperar medida nenhuma. */
export interface ContextoDoCanal {
  F: Fmt
  subs: number | null
  sync: SincDaPagina
  hojeSP: string
  agoraMs: number
  primeiraBusca: boolean
  semVideos: boolean
  /** id do vídeo, título. */
  titulos: ReadonlyArray<readonly [string, string]>
  /** id do vídeo, endereço da thumbnail (nulo sem `ytId`). */
  thumbs: ReadonlyArray<readonly [string, string | null]>
  /** O canal, para a foto e o nome do criador no fio. */
  criador: CriadorDoFio
  trocas: readonly TrocaDoMotor[]
  /** C4: quem lê os comentários. Ausente = a leitura não é feita (célula "não pedida"). */
  comentarios?: { siteId: string; channelId: string; nome: string; provas: ProvasDeQuemVe | null; permissaoFalhou?: boolean }
}

export interface CanalDerivado {
  medidas: MedidasDoCanal | null
  videos: readonly VideoLido[] | null
  formato: FormatoDoCanal
  estado: EstadoDaPagina
  titulos: ReadonlyMap<string, string>
  lanc: ReturnType<typeof lancamentosDoCanal>
}

export function derivar(ctx: ContextoDoCanal, c: CanalInteiro): CanalDerivado {
  const medidas = 'naoCarregou' in c.medidas ? null : c.medidas
  const videos = c.videos.lido ? c.videos.dados : null
  const formato = formatoDoCanal(videos ?? [])
  const estado = estadoDaPagina(medidas?.m8 ?? null, ctx.sync, { missingSince: null, doisFormatos: formato.doisFormatos }, null, ctx.hojeSP, ctx.agoraMs)
  const titulos = new Map(ctx.titulos)
  const lanc = lancamentosDoCanal({
    F: ctx.F, medidas, videos, marcas: c.marcas.lido ? c.marcas.dados : null,
    serie: c.serie !== 'nao_pedida' && c.serie.lido ? c.serie.dados : null,
    formato, titulos, primeiraBusca: ctx.primeiraBusca, agoraMs: ctx.agoraMs, hojeSP: ctx.hojeSP,
  })
  return { medidas, videos, formato, estado, titulos, lanc }
}

/** A entrada da frase do topo, tirada só das medidas (nada recalculado). */
export function entradaDaFrase(ctx: ContextoDoCanal, d: CanalDerivado): EntradaDaFrase {
  const m = d.medidas
  const fmt = m === null ? null : m.porFormato[d.formato.fmt]
  const m6 = fmt?.m6, m4 = fmt?.m4
  const par = m?.m8.parado.estado === 'medido' ? m.m8.parado.valor : null
  const qd = m?.m8.queda.estado === 'medido' ? m.m8.queda.valor.janelas : null
  return {
    estado: d.estado,
    direcao: m === null ? null : celulaDeDirecao(m.m3a, { missingSince: null, subscribersHidden: null, lastOkSyncedAt: null }, { semVideos: ctx.semVideos }),
    formato: d.formato,
    ritmo: m6 && m6.estado === 'medido'
      ? {
        porSemana: m6.valor.porSemana, n: m6.n, semanasLidas: MEASURE_RULES.rhythm.weeks, semanasComPublicacao: m6.valor.semanasComPublicacao,
        // o período encurtado por criação ou cobertura, em dias (as `semanas` da medida não são "semanas com leitura")
        base: m6.notas.some(x => x.tipo === 'canal_mais_novo_que_a_janela') ? { tipo: 'criacao', dias: m6.valor.dias }
          : m6.notas.some(x => x.tipo === 'cobertura_curta') ? { tipo: 'cobertura', dias: m6.valor.dias } : null,
      }
      : null,
    acerto: m4 && m4.estado === 'medido' ? { k: m4.valor.acertos, n: m4.valor.total } : null,
    // o intervalo habitual só se sabe quando o limite passou do piso de 28 dias (limite = 4 x o intervalo mediano)
    parado: par ? { dias: par.dias, ultimaEm: spDateOf(par.ultimaEm), costumava: par.limite > 28 ? par.limite / 4 : null } : null,
    queda: qd ? [...qd] : null,
    ultimoVideo: d.lanc.ultimo,
    hojeSP: ctx.hojeSP,
  }
}
