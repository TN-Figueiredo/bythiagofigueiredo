/** Fixtures SINTÉTICAS da fila "Saíram do YouTube" (datas relativas a `AGORA`; nenhum dado real). */
import type { FilaLida, ItemApagando, ItemEsperando, ItemRespondido, ItemVoltou, LeituraDaFila, Previa } from '@/lib/youtube/observatorio/saiu/modelo'

export const AGORA = Date.parse('2026-10-14T15:00:00Z')
export const ha = (dias: number, horas = 0): string => new Date(AGORA - dias * 86_400_000 - horas * 3_600_000).toISOString()

export const previaVideo = (o: Partial<Previa> = {}): Previa => ({
  linhas: { competitor_videos: 1, competitor_video_daily: 41, competitor_video_early: 12, competitor_video_versions: 6, competitor_changes: 5, competitor_raw: 3 },
  miniaturas: 2, forjaEmAndamento: false, respostasDoCriador: 0, versoes: { title: 3, thumb: 2, desc: 1 }, ...o,
})

export function video(n: number, o: Partial<ItemEsperando> = {}): ItemEsperando {
  return {
    tipo: 'video', chave: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`, titulo: `Vídeo sintético ${n}`, canal: 'Canal Alfa', desde: ha(10 - (n % 5)), diasEsperando: 10 - (n % 5),
    ultimaLeitura: ha(11), views: 184_000, curtidas: 9_100, comentarios: 412, inscritos: null, canalNoAr: true, formato: 'longo', duracaoSeg: 1122,
    publicadoEm: ha(90), vistoPrimeiro: ha(80), miniaturaUrl: null, codigo: `COD${String(n).padStart(8, '0')}`, videosDoGrupo: null, idsDoGrupo: null,
    previa: previaVideo(), decisao: null, ...o,
  }
}
export const canal = (o: Partial<ItemEsperando> = {}): ItemEsperando => ({
  ...video(90), tipo: 'canal', chave: '00000000-0000-4000-8000-000000000099', titulo: 'Canal Beta', canal: null, inscritos: 341_000, views: 2_100_000, curtidas: null, comentarios: null,
  canalNoAr: false, formato: null, duracaoSeg: null, publicadoEm: null, vistoPrimeiro: null, codigo: 'UCsintetico0000000000001', previa: previaVideo({ linhas: { competitor_channels: 1, competitor_videos: 13 }, miniaturas: 27 }), ...o,
})
export const grupo = (o: Partial<ItemEsperando> = {}): ItemEsperando => ({
  ...video(91), tipo: 'comentarios', chave: '00000000-0000-4000-8000-000000000098', titulo: '7 comentários de 2 vídeos', canal: 'Canal Alfa', views: null, curtidas: null, comentarios: 7,
  canalNoAr: null, formato: null, duracaoSeg: null, publicadoEm: null, vistoPrimeiro: null, codigo: null,
  videosDoGrupo: [{ titulo: 'Vídeo X', comentarios: 4 }, { titulo: 'Vídeo Y', comentarios: 3 }], idsDoGrupo: [11, 12, 13, 14, 15, 16, 17],
  previa: previaVideo({ linhas: { competitor_video_comments: 7, competitor_video_comment_marks: 21 }, miniaturas: 0, respostasDoCriador: 1 }), ...o,
})
export const apagando = (n: number, o: Partial<ItemApagando> = {}): ItemApagando => ({
  itemId: n, tipo: 'video', codigo: `APG${String(n).padStart(8, '0')}`, decididoEm: ha(2), pendentes: ['https://x.public.blob.vercel-storage.com/observatorio/thumbs/a.jpg'], arquivoPendente: false, voltouEm: null, ...o,
})

export function fila(o: Partial<FilaLida> = {}): LeituraDaFila {
  const esperando = o.esperando ?? [video(1), video(2), canal(), grupo()]
  return {
    estado: 'ok',
    fila: {
      esperando, totalEsperando: o.totalEsperando ?? esperando.length, apagando: [], voltaram: [], respondidos: [], respondidosTotal: o.respondidos?.length ?? 0,
      ultimaLeituraDosCanais: ha(0, 2), canaisDoSite: 5, podeResponder: true, ...o,
    },
  }
}
export const respondidoMantido = (o: Partial<ItemRespondido> = {}): ItemRespondido => ({ tipo: 'video', situacao: 'mantido', itemId: null, codigo: 'MAN00000001', titulo: 'Vídeo mantido', quando: ha(9), comentarios: null, ...o })
export const respondidoApagado = (o: Partial<ItemRespondido> = {}): ItemRespondido => ({ tipo: 'canal', situacao: 'apagado', itemId: 7, codigo: 'UCapagado000000000000001', titulo: null, quando: ha(12), comentarios: null, ...o })
export const voltouApagado = (o: Partial<ItemVoltou> = {}): ItemVoltou => ({ tipo: 'video', pedeResposta: true, itemIds: [21], codigo: 'VOL00000001', titulo: null, voltouEm: ha(3), comentarios: null, ...o })
