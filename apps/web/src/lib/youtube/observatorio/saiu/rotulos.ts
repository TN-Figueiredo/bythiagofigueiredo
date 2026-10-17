/**
 * A5 · E9, Tarefa 3: os rótulos do painel "o que some" e a linha "Guardado". Puro. Tabela fora do catálogo aparece com o nome (nunca é omitida):
 * a contagem por catálogo do banco enxerga tabela nova de outra etapa e o painel não pode esconder linha apagada.
 */
// Rótulos revistos pelo Logan (17/10).
import { ehTabelaDeIdentidade } from '../comentarios/identidade'

export interface RotuloDaTabela { um: string; muitos: string; interno?: true }

export const ROTULO_DA_TABELA: Record<string, RotuloDaTabela> = {
  competitor_videos: { um: 'vídeo', muitos: 'vídeos' },
  competitor_channels: { um: 'canal', muitos: 'canais' },
  competitor_video_daily: { um: 'dia de views', muitos: 'dias de views' },
  competitor_video_early: { um: 'leitura das primeiras horas', muitos: 'leituras das primeiras horas' },
  competitor_video_hourly: { um: 'leitura por hora', muitos: 'leituras por hora' },
  competitor_video_versions: { um: 'versão do vídeo', muitos: 'versões do vídeo' },
  competitor_changes: { um: 'mudança registrada', muitos: 'mudanças registradas' },
  youtube_intelligence_tasks: { um: 'tarefa da forja', muitos: 'tarefas da forja' },
  competitor_readings: { um: 'leitura da forja', muitos: 'leituras da forja' },
  competitor_channel_snapshots: { um: 'dia de inscritos e views do canal', muitos: 'dias de inscritos e views do canal' },
  competitor_channel_hour_map: { um: 'mapa de horário do canal', muitos: 'mapas de horário do canal' },
  competitor_video_comments: { um: 'texto de comentário, de terceiros', muitos: 'textos de comentário, de terceiros' },
  competitor_video_comment_marks: { um: 'contagem de curtidas e respostas por idade', muitos: 'contagens de curtidas e respostas por idade' },
  competitor_video_comment_snaps: { um: 'retrato de comentários', muitos: 'retratos de comentários' },
  competitor_field_versions: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_raw: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_video_tier_spans: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_hour_fold_log: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_video_marks: { um: 'marca de idade do vídeo', muitos: 'marcas de idade do vídeo' },
  competitor_missing_baseline: { um: 'registro interno', muitos: 'registros internos', interno: true },
  // achados pela integração da Tarefa 12 (a prévia devolvia o nome cru): tabelas das MG6 e MG4 que entram na cascata do canal e do vídeo
  competitor_collection_pauses: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_video_mark_misses: { um: 'registro interno', muitos: 'registros internos', interno: true },
  // X3: playlists e seções do canal dos concorrentes
  competitor_playlists: { um: 'playlist', muitos: 'playlists' },
  competitor_playlist_versions: { um: 'versão da playlist', muitos: 'versões da playlist' },
  competitor_playlist_items: { um: 'vídeo numa playlist', muitos: 'vídeos em playlists' },
  competitor_playlist_reads: { um: 'registro interno', muitos: 'registros internos', interno: true },
  competitor_channel_sections: { um: 'seção da página do canal', muitos: 'seções da página do canal' },
}

/** Ordem do mockup: o que o dono reconhece primeiro. */
const ORDEM = [
  'competitor_channels', 'competitor_videos', 'competitor_video_daily', 'competitor_channel_snapshots', 'competitor_video_early', 'competitor_video_hourly',
  'competitor_video_versions', 'competitor_changes', 'competitor_readings', 'youtube_intelligence_tasks', 'competitor_channel_hour_map',
  'competitor_video_comments', 'competitor_video_comment_marks', 'competitor_video_comment_snaps',
]

const nf = new Intl.NumberFormat('pt-BR')
const fmtN = (n: number): string => nf.format(n)
const pl = (n: number, a: string, b: string): string => `${fmtN(n)} ${n === 1 ? a : b}`

export function linhasDoPainel(linhas: Record<string, number>, miniaturas: number): Array<{ n: number; texto: string }> {
  const saida: Array<{ n: number; texto: string }> = []
  let internas = 0
  let identidades = 0
  const vistas = new Set<string>()
  const emitir = (tabela: string): void => {
    const n = linhas[tabela]
    if (n === undefined || !Number.isFinite(n) || n <= 0) return
    // a identidade dos autores (dado pessoal de terceiro) nunca é nomeada fora de comentarios/ (varredura 2): comentarios/identidade.ts diz qual é
    if (ehTabelaDeIdentidade(tabela)) { identidades += n; return }
    const r = ROTULO_DA_TABELA[tabela]
    if (!r) { saida.push({ n, texto: `${fmtN(n)} ${n === 1 ? 'linha' : 'linhas'} em ${tabela}` }); return }
    if (r.interno) { internas += n; return }
    saida.push({ n, texto: pl(n, r.um, r.muitos) })
  }
  for (const t of ORDEM) { vistas.add(t); emitir(t) }
  const resto = Object.keys(linhas).filter(t => !vistas.has(t)).sort()
  for (const t of resto) emitir(t)
  if (miniaturas > 0) saida.push({ n: miniaturas, texto: pl(miniaturas, 'arquivo de miniatura', 'arquivos de miniatura') })
  if (identidades > 0) saida.push({ n: identidades, texto: pl(identidades, 'identidade de autor de comentário (dado pessoal; some sozinha aos 28 dias)', 'identidades de autores de comentário (dado pessoal; somem sozinhas aos 28 dias)') })
  if (internas > 0) saida.push({ n: internas, texto: pl(internas, 'registro interno', 'registros internos') })
  return saida
}

/** "41 dias de views, 3 títulos, 2 miniaturas, 1 descrição, 5 mudanças". As versões vêm separadas por campo; sem elas, ficam de fora. */
export function resumoGuardado(
  linhas: Record<string, number>,
  _miniaturas: number,
  versoes?: { title: number; thumb: number; desc: number },
): string {
  const p: string[] = []
  const dias = linhas.competitor_video_daily ?? 0
  if (dias > 0) p.push(pl(dias, 'dia de views', 'dias de views'))
  if (versoes) {
    if (versoes.title > 0) p.push(pl(versoes.title, 'título', 'títulos'))
    if (versoes.thumb > 0) p.push(pl(versoes.thumb, 'miniatura', 'miniaturas'))
    if (versoes.desc > 0) p.push(pl(versoes.desc, 'descrição', 'descrições'))
  }
  const mud = linhas.competitor_changes ?? 0
  if (mud > 0) p.push(pl(mud, 'mudança', 'mudanças'))
  return p.join(', ')
}

/** "3 comentários e 1 resposta do criador"; sem resposta, só "3 comentários". */
export function fraseDoPainelDeComentarios(comentarios: number, respostasDoCriador: number): string {
  const c = pl(comentarios, 'comentário', 'comentários')
  return respostasDoCriador > 0 ? `${c} e ${pl(respostasDoCriador, 'resposta do criador', 'respostas do criador')}` : c
}

/** O que a resposta "voltar a acompanhar" promete: a condição vai escrita. */
export function fraseDaVolta(tipo: 'video' | 'canal' | 'comentarios'): string {
  if (tipo === 'video') return 'Entra de novo na próxima leitura do canal, se ainda estiver entre os vídeos mais recentes.'
  if (tipo === 'canal') return 'Você pode adicionar o canal de novo; ele entra como novo, sem o histórico.'
  return 'Comentários que você apagou não voltam a ser guardados, mesmo que reapareçam no YouTube. "Não perguntar de novo" só tira este aviso.'
}
