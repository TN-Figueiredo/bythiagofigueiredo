// A5 · E5a · Tarefa C1: as leituras de contagem da página do canal (M11 e a lista "O que o criador respondeu").
// Mesmas regras do leitor do vídeo: cliente por parâmetro, nunca lança, toda ida ao banco por `comTempo`, erro por código, sem frase.
// Cada consulta leva o filtro de site E o de canal (`competitor_channel_id`): é o cruzamento dos vídeos com os do canal.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { comTempo } from './gravar'
import { nivelDeQuemVe, semMencoes } from './leitor-nivel'
import type { ContagemDeRespostas, ParteLida, ProvasDeQuemVe, RespostaDoCriador, RespostasDoCriador } from './leitor-tipos'
import { PAGINA, blocos, bool, boolOuNulo, cortada, ForaDaForma, lerAgenda, linhasDe, marcoDe, msDe, naoLidaPorErro, num, txt } from './leitor'
import type { Marco } from './tipos'

const idDe = (v: unknown): string => {
  if (typeof v === 'number' && Number.isInteger(v)) return String(v)
  if (typeof v === 'string' && /^\d+$/.test(v)) return v
  throw new ForaDaForma()
}

/** M11: por vídeo, o status do retrato de 30 dias e se algum comentário teve resposta do criador. Em qualquer nível (só contagem). */
export async function lerContagemDeRespostas(
  sb: SupabaseClient, p: { siteId: string; channelId: string; videoIds: readonly string[] },
): Promise<ParteLida<ContagemDeRespostas>> {
  try {
    const porVideo = new Map<string, { retrato30: string | null; algumComRespostaDoCriador: boolean }>()
    for (const id of p.videoIds) porVideo.set(id, { retrato30: null, algumComRespostaDoCriador: false })
    for (const bloco of blocos(p.videoIds)) {
      const [rSnaps, rComentarios] = await Promise.all([
        comTempo((sinal) => sb.from('competitor_video_comment_snaps').select('video_id, mark, status, taken_at').eq('site_id', p.siteId)
          .eq('competitor_channel_id', p.channelId).in('video_id', bloco).abortSignal(sinal)),
        comTempo((sinal) => sb.from('competitor_video_comments').select('video_id, creator_replied').eq('site_id', p.siteId)
          .eq('competitor_channel_id', p.channelId).in('video_id', bloco).limit(PAGINA).abortSignal(sinal)),
      ])
      for (const x of linhasDe(rSnaps)) {
        const v = porVideo.get(txt(x.video_id))
        txt(x.taken_at)
        if (v !== undefined && marcoDe(x.mark) === 30) v.retrato30 = txt(x.status)
      }
      const comentarios = linhasDe(rComentarios)
      if (cortada(comentarios)) throw new ForaDaForma()
      for (const x of comentarios) {
        const v = porVideo.get(txt(x.video_id))
        if (v !== undefined && boolOuNulo(x.creator_replied) === true) v.algumComRespostaDoCriador = true
      }
    }
    const [rSite, rCanal, agenda] = await Promise.all([
      comTempo((sinal) => sb.from('competitor_video_comment_snaps').select('taken_at').eq('site_id', p.siteId)
        .order('taken_at', { ascending: true }).limit(1).abortSignal(sinal)),
      comTempo((sinal) => sb.from('competitor_video_comment_snaps').select('taken_at').eq('site_id', p.siteId)
        .eq('competitor_channel_id', p.channelId).order('taken_at', { ascending: true }).limit(1).abortSignal(sinal)),
      lerAgenda(sb),
    ])
    const site = linhasDe(rSite)
    const canal = linhasDe(rCanal)
    return {
      lido: true,
      dados: {
        porVideo, coletaDoSiteDesdeMs: site[0] ? msDe(site[0].taken_at) : null, coletaDoCanalDesdeMs: canal[0] ? msDe(canal[0].taken_at) : null,
        ultimoOkDaTarefaMs: agenda.ultimoOkMs, primeiraExecucaoDaTarefaMs: agenda.primeiraExecucaoMs,
      },
    }
  } catch (e) {
    return naoLidaPorErro(e)
  }
}

/**
 * A lista "O que o criador respondeu": o comentário, a resposta presa, as curtidas no marco mais recente que existir e o vídeo.
 * No nível `contagem` devolve só o número de itens. NÃO consulta a tabela de identidade em nível nenhum: o autor é sempre "um espectador",
 * e por isso a troca de menções vale para todo texto, em todo nível.
 */
export async function lerRespostasDoCriador(
  sb: SupabaseClient, p: { siteDaGuarda: string; provas: ProvasDeQuemVe | null; channelId: string; videoIds: readonly string[] },
): Promise<ParteLida<RespostasDoCriador>> {
  try {
    const { nivel, siteId } = nivelDeQuemVe(p.provas, p.siteDaGuarda)
    const comTexto = nivel !== 'contagem'
    const colunas = comTexto ? 'id, video_id, parent_id, is_creator, creator_replied, body, body_truncated, published_at' : 'id, video_id, parent_id, is_creator, creator_replied'
    const topos: Array<{ id: string; videoId: string; texto: string; cortado: boolean }> = []
    const respostas = new Map<string, Array<{ id: string; texto: string; cortado: boolean; publicadoMs: number }>>()
    for (const bloco of blocos(p.videoIds)) {
      const r = await comTempo((sinal) => sb.from('competitor_video_comments').select(colunas).eq('site_id', siteId)
        .eq('competitor_channel_id', p.channelId).in('video_id', bloco).limit(PAGINA).abortSignal(sinal))
      const linhas = linhasDe(r)
      if (cortada(linhas)) throw new ForaDaForma()
      for (const x of linhas) {
        const parent = x.parent_id === null || x.parent_id === undefined ? null : idDe(x.parent_id)
        if (parent === null) {
          if (boolOuNulo(x.creator_replied) === true) topos.push({ id: idDe(x.id), videoId: txt(x.video_id), texto: comTexto ? txt(x.body) : '', cortado: comTexto ? bool(x.body_truncated) : false })
        } else if (comTexto) {
          respostas.set(parent, [...(respostas.get(parent) ?? []), { id: idDe(x.id), texto: txt(x.body), cortado: bool(x.body_truncated), publicadoMs: msDe(x.published_at) }])
        }
      }
    }
    if (!comTexto) return { lido: true, dados: { nivel, total: topos.length, itens: [] } }

    const likes = new Map<string, { marco: Marco; curtidas: number }>()
    for (const bloco of blocos(topos.map((t) => t.id))) {
      const r = await comTempo((sinal) => sb.from('competitor_video_comment_marks').select('comment_id, mark, likes').eq('site_id', siteId)
        .in('comment_id', bloco).abortSignal(sinal))
      for (const x of linhasDe(r)) {
        const marco = marcoDe(x.mark)
        if (marco === null) continue
        const id = idDe(x.comment_id)
        const atual = likes.get(id)
        if (atual === undefined || marco > atual.marco) likes.set(id, { marco, curtidas: num(x.likes) })
      }
    }
    const itens: RespostaDoCriador[] = []
    for (const t of topos) {
      const resposta = (respostas.get(t.id) ?? []).sort((a, b) => a.publicadoMs - b.publicadoMs)[0]
      if (resposta === undefined) continue
      const a = semMencoes(t.texto)
      const b = semMencoes(resposta.texto)
      const l = likes.get(t.id)
      itens.push({
        videoId: t.videoId, texto: a.texto, cortado: t.cortado, respostaTexto: b.texto, respostaCortada: resposta.cortado,
        curtidas: l?.curtidas ?? null, marco: l?.marco ?? null, mencoesTrocadas: a.trocadas + b.trocadas,
      })
    }
    return { lido: true, dados: { nivel, total: topos.length, itens } }
  } catch (e) {
    return naoLidaPorErro(e)
  }
}
