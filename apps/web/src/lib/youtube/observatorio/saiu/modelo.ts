/**
 * A5 · E9, Tarefa 3: o modelo puro da fila "Saíram do YouTube". Sem banco, sem rede, sem relógio próprio: tudo o que depende de "agora"
 * recebe o instante por parâmetro. As constantes da fila moram aqui (e não em `rules.ts`, que é da A5 inteira).
 */
import { STALE_AFTER_MINUTES } from '../../analysis-progress'

export const FILA_PAGINA = 10
/** A janela da recusa é a do vigia da forja: lida de `STALE_AFTER_MINUTES`, nunca copiada. */
export const JANELA_FORJA_MIN = STALE_AFTER_MINUTES
export const LEITURA_RECENTE_H = 24
export const APAGANDO_VERMELHO_H = 24
export const MANTIDO_QUE_VOLTOU_DIAS = 30
export const PALAVRA = 'APAGAR'
export const DATA_MG1 = '2026-10-12'
export const RESPONDIDOS_PAGINA = 50
export const LISTA_TETO = 20_000

export type TipoDeItem = 'video' | 'canal' | 'comentarios'

export const CODIGOS_DE_ERRO = [
  'schema_ausente', 'erro_de_banco', 'tempo_esgotado', 'impasse', 'impedido_por_tabela', 'contagem_indisponivel', 'resposta_inesperada', 'blob_nao_configurado',
  'mes_destacado_em_transito',
] as const
export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number]

export interface Previa {
  linhas: Record<string, number>
  miniaturas: number
  forjaEmAndamento: boolean
  /** Respostas do criador que o apagar leva junto (0 para vídeo e canal). */
  respostasDoCriador: number
  /** Versões separadas por campo, para a frase "3 títulos, 2 miniaturas, 1 descrição". */
  versoes?: { title: number; thumb: number; desc: number }
  /** Lotes do arquivo do NAS com este canal (`lotes_exportados` da prévia). Ausente ou `null` = não conferido; nunca vira "nenhuma". */
  lotesExportados?: number | null
}

export interface ItemEsperando {
  tipo: TipoDeItem
  chave: string
  titulo: string | null
  canal: string | null
  desde: string
  diasEsperando: number
  ultimaLeitura: string | null
  views: number | null
  curtidas: number | null
  comentarios: number | null
  inscritos: number | null
  canalNoAr: boolean | null
  formato: 'longo' | 'short' | null
  duracaoSeg: number | null
  publicadoEm: string | null
  vistoPrimeiro: string | null
  miniaturaUrl: string | null
  codigo: string | null
  videosDoGrupo: Array<{ titulo: string | null; comentarios: number }> | null
  idsDoGrupo: number[] | null
  previa: Previa | { erro: CodigoDeErro }
  decisao: 'manter' | null
}

/** Apagamento incompleto: a linha de `competitor_removed_items` ainda tem Blob ou arquivo por fazer. */
export interface ItemApagando {
  itemId: number
  tipo: TipoDeItem
  /** Id público (vídeo ou canal); nulo para comentários (o id do comentário nunca vai para o item). */
  codigo: string | null
  decididoEm: string
  pendentes: string[]
  arquivoPendente: boolean
  voltouEm: string | null
}

export interface ItemVoltou {
  tipo: TipoDeItem
  /** Apagado que voltou e pede resposta; `false` = mantido que voltou ao ar, só informa. */
  pedeResposta: boolean
  itemIds: number[]
  codigo: string | null
  titulo: string | null
  voltouEm: string | null
  comentarios: number | null
}

export interface ItemRespondido {
  tipo: TipoDeItem
  situacao: 'mantido' | 'apagado'
  itemId: number | null
  codigo: string | null
  titulo: string | null
  quando: string
  comentarios: number | null
}

export interface FilaLida {
  esperando: ItemEsperando[]
  totalEsperando: number
  apagando: ItemApagando[]
  voltaram: ItemVoltou[]
  respondidos: ItemRespondido[]
  respondidosTotal: number
  ultimaLeituraDosCanais: string | null
  canaisDoSite: number
  podeResponder: boolean
}

export type LeituraDaFila =
  | { estado: 'ok'; fila: FilaLida }
  | { estado: 'sem_acesso' }
  | { estado: 'schema_ausente'; texto: string }
  | { estado: 'erro'; codigo: CodigoDeErro; detalhe?: string }

/**
 * O número da aba: cada linha conta uma vez. A que está em `apagando` não entra de novo em `voltaram` (o leitor já a põe só no primeiro), e o
 * mantido que voltou ao ar (`pedeResposta: false`) só informa. Comentários que voltaram vêm um item por canal. Mesma regra de `competitor_missing_count`.
 */
export function contadorDaAba(f: Pick<FilaLida, 'totalEsperando' | 'apagando' | 'voltaram'>): number {
  return f.totalEsperando + f.apagando.length + f.voltaram.filter(v => v.pedeResposta).length
}

export function estadoDaFilaVazia(
  f: Pick<FilaLida, 'canaisDoSite' | 'ultimaLeituraDosCanais'>,
  agoraMs: number,
): 'vazia' | 'vazia_sem_leitura_recente' | 'sem_canais' {
  if (f.canaisDoSite <= 0) return 'sem_canais'
  const t = f.ultimaLeituraDosCanais ? Date.parse(f.ultimaLeituraDosCanais) : NaN
  if (!Number.isFinite(t)) return 'vazia_sem_leitura_recente'
  return agoraMs - t <= LEITURA_RECENTE_H * 3_600_000 ? 'vazia' : 'vazia_sem_leitura_recente'
}

export function palavraConfere(digitado: string): boolean {
  return typeof digitado === 'string' && digitado.trim().toUpperCase() === PALAVRA
}

const DIA_MS = 86_400_000
/** Dias inteiros entre duas datas `YYYY-MM-DD` (já em São Paulo). Data inválida ou futura dá 0, nunca negativo. */
export function diasDesde(desde: string, hojeSP: string): number {
  const a = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${hojeSP.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / DIA_MS))
}

/** Entrada que começa por `observatorio/thumbs/` e termina em `/` é pasta; o resto é miniatura. */
export function faltaNoBlob(pendentes: readonly string[]): { miniaturas: number; pastas: number } {
  let pastas = 0
  let miniaturas = 0
  for (const p of pendentes) {
    if (p.startsWith('observatorio/thumbs/') && p.endsWith('/')) pastas += 1
    else miniaturas += 1
  }
  return { miniaturas, pastas }
}

// TEXTO-A-REVISAR: todas as frases abaixo (o plano fixa os códigos, não a redação).
const FRASES_DE_ERRO: Record<CodigoDeErro, string> = {
  schema_ausente: 'A migration desta etapa ainda não foi aplicada no banco.',
  erro_de_banco: 'Não foi possível concluir agora. Nada foi apagado.',
  tempo_esgotado: 'O banco demorou demais e a operação foi cancelada. Nada foi apagado.',
  impasse: 'Outra operação estava mexendo nos mesmos dados. Nada foi apagado; tente de novo.',
  impedido_por_tabela: 'Uma tabela impede o apagamento. Nada foi apagado.',
  contagem_indisponivel: 'Não foi possível contar o que há guardado deste item.',
  resposta_inesperada: 'O banco respondeu algo que não esperávamos. Confira a fila antes de tentar de novo.',
  blob_nao_configurado: 'O armazenamento das miniaturas não está configurado neste ambiente.',
  // M9 (aviso de 15/10): recusa de regra da manutenção, não falha; nada foi apagado
  mes_destacado_em_transito: 'O mês está saindo do banco; tente de novo depois que o copiador receber.',
}

export function fraseDoErro(codigo: CodigoDeErro): string {
  return Object.prototype.hasOwnProperty.call(FRASES_DE_ERRO, codigo) ? FRASES_DE_ERRO[codigo] : FRASES_DE_ERRO.erro_de_banco
}

export type Desfecho =
  | 'apagado' | 'apagando' | 'no_ar' | 'forja_em_andamento' | 'not_found' | 'mudou' | 'mantido' | 'respondido' | 'nada' | 'sem_permissao' | 'palavra_errada' | 'erro'

export interface OpcoesDaFrase {
  tipo: TipoDeItem
  janelaMin: number
  faltam?: { miniaturas: number; pastas: number }
}

function plural(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`
}

export function fraseDoDesfecho(d: Desfecho, o: OpcoesDaFrase): string {
  switch (d) {
    case 'apagado': return 'Apagado.'
    case 'apagando': {
      const f = o.faltam
      if (!f) return 'Apagando: falta concluir a limpeza das miniaturas.'
      const partes: string[] = []
      if (f.miniaturas > 0) partes.push(plural(f.miniaturas, 'miniatura', 'miniaturas'))
      if (f.pastas > 0) partes.push(plural(f.pastas, 'pasta de miniaturas', 'pastas de miniaturas'))
      return partes.length > 0 ? `Apagando: faltam ${partes.join(' e ')} no Blob.` : 'Apagando: falta concluir a limpeza das miniaturas.'
    }
    case 'no_ar':
      return o.tipo === 'canal' ? 'Este canal voltou a vir do YouTube; nada foi apagado.'
        : o.tipo === 'comentarios' ? 'Estes comentários voltaram a vir do YouTube; nada foi apagado.'
        : 'Este vídeo voltou a vir do YouTube; nada foi apagado.'
    case 'forja_em_andamento': return `A forja está lendo este vídeo agora. Tente de novo em até ${o.janelaMin} minutos.`
    case 'not_found': return 'Este item não está mais na fila.'
    case 'mudou': return 'A lista mudou; confira de novo.'
    case 'mantido': return 'Mantido para análise.'
    case 'respondido': return 'Resposta registrada.'
    case 'nada': return 'Nada mudou.'
    case 'sem_permissao': return 'Só quem administra o site pode responder.'
    case 'palavra_errada': return `Digite ${PALAVRA} para confirmar.`
    case 'erro': return 'Não foi possível concluir. Nada foi apagado.'
  }
}
