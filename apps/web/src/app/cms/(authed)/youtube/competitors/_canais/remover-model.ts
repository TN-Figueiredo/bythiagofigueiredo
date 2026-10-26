/**
 * A5 · Remover canal, F2: a regra PURA da janela e da linha agendada. Nenhum React, nenhum servidor: estado da janela, frases,
 * idade do agendado, regra do nome digitado e o texto do pedido ao agente. Os componentes só desenham o que sai daqui.
 * O texto da tela nunca vem do banco: a frase de um erro sai de `FRASES_E10` (por código) ou das constantes abaixo.
 */
import { FRASES_E10, type CodigoE10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { SemGuardar } from '@/lib/youtube/competitor-removal-impact'
import type { ImpactoDoArquivo } from '@/lib/youtube/observatorio/arquivo/impacto-arquivo'

export type ArquivoImpact = ImpactoDoArquivo
/** O que o servidor sabe fazer pelas imagens do Blob: o site apaga todo dia (sim), ou ainda não; e a página do Arquivo mostra a contagem (sim) ou não. */
export type Capacidade = 'sim' | 'nao-sim' | 'nao-nao'

/** Um motivo fixo por caminho (formato da F1: `^[a-z_]{1,40}$`). */
export const MOTIVO = { guardar: 'nao_acompanhar', apagar: 'entrou_por_engano' } as const
export type Caminho = 'guardar' | 'apagar'
export type Fase = 'contando' | 'pronto' | 'falha_contagem' | 'enviando' | 'incerto' | 'erro'

/** Prazos (U7): a contagem que não responde em 10 s vira falha; a ação que não responde em 30 s vira "incerto". */
export const PRAZO_CONTAGEM_MS = 10_000
export const PRAZO_ACAO_MS = 30_000

export type CodigoTela = CodigoE10 | 'leitura' | 'itens_na_fila' | 'inesperado'

/** Milhar com ponto (pt-BR), sem depender do ICU do ambiente. */
export const milhar = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const plural = (n: number, um: string, varios: string) => `${milhar(n)} ${n === 1 ? um : varios}`

export const TXT = {
  pergunta: 'Por que você quer remover?',
  guardarTitulo: 'Não quero mais acompanhar: guardar no NAS',
  guardarSub: 'A coleta para agora e a vaga é liberada. O histórico só sai daqui depois de ir para o NAS.',
  apagarTitulo: 'Entrou por engano: apagar sem guardar',
  apagarSub: `Apaga agora e sem cópia. Só para canal adicionado há até ${RULES.removal.semGuardarAteDias} dias.`,
  leadGuardar: 'O que vai para o NAS, com cópia conferida antes de sair daqui:',
  leadApagar: 'O que será apagado, sem cópia e sem volta:',
  falta: 'Depois do clique falta um passo: o agente guarda o histórico no NAS. Você pode desfazer até lá.',
  contando: 'Contando o que será guardado. O botão libera quando a contagem chegar.',
  falhaTitulo: 'Não foi possível contar o que sai.',
  falhaCorpo: 'Guardar no NAS continua disponível: nada é apagado antes da cópia conferida. Para apagar sem guardar, conte de novo.',
  nomeRotulo: 'Para confirmar, digite o nome do canal:',
  nomeDica: 'O botão libera quando o nome estiver igual.',
  nomeOk: 'Nome confere. O botão está liberado.',
  incertoTitulo: 'Não recebemos a resposta.',
  incertoApagarCorpo: 'Pode ter sido feito. Feche e confira a lista antes de tentar de novo: o canal pode já ter saído.',
  incertoGuardarCorpo: 'Pode ter sido feito. Feche e confira a lista: o canal pode já estar como "Agendado para guardar no NAS". Se ainda estiver normal, tente de novo.',
  erroGuardarTitulo: 'Não deu para pausar o canal.',
  erroGuardarCorpo: 'Nada mudou: ele continua sendo coletado e ocupando a vaga. Tente de novo. Se falhar outra vez, mostre o código ao agente.',
  erroApagarTitulo: 'Nada foi apagado.',
  compartilhadoProximo: 'Guardar no NAS também não é possível por este motivo. Nada mudou: o canal continua sendo coletado. Copie o pedido e leve ao agente.',
  toastApagadoTitulo: 'Apagado',
  subVideos: (versoes: number) => (versoes === 0 ? '' : `com ${plural(versoes, 'versão', 'versões')} de título, thumbnail e descrição`),
  subDias: 'views diárias dos vídeos',
  subLeituras: 'feitas para vídeos deste canal, inclusive as da página de vídeo',
  subLeiturasExtra: ', mais as fotos e os alvos da página de vídeo',
  subFixados: (fixados: number, trocas: number) => `${plural(fixados, 'vídeo fixado', 'vídeos fixados')} e ${plural(trocas, 'troca', 'trocas')} no swipe file`,
  irParaCanais: 'Ir para Canais',
  toastAgendadoTitulo: 'Coleta parada. Agendado para guardar no NAS.',
  toastAgendadoCorpo: 'O histórico ainda não está no NAS: falta o agente concluir.',
  selo: 'Agendado para guardar no NAS',
  aguardando: 'Aguardando o agente guardar no NAS',
  avisoDetalhes: 'A coleta parou e a vaga foi liberada. O histórico ainda NÃO está no NAS: falta o agente concluir. Só então o canal sai da lista (a lista pode levar até 15 minutos para atualizar). Para desfazer, use Desfazer na lista de Canais.',
  desfeitoTitulo: 'Desfeito',
  pedidoCopiadoTitulo: 'Pedido copiado',
  pedidoCopiadoCorpo: 'Cole na conversa com o agente.',
  jaNaoAgendado: (nome: string) => `${nome} já não estava agendado. A lista foi atualizada.`,
  itemJaAgendado: 'Já agendado. Use Desfazer antes.',
} as const

/** 'YYYY-MM' (ou 'YYYY-MM-DD') do banco vira 'MM/YYYY' da tela. */
export const mesAno = (ym: string): string => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`
const mesesDe = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

/** Q1: a 5ª linha "meses já no arquivo" (só com N > 0; vale no caminho de guardar). */
export function linhaArquivo(a: ArquivoImpact | null): { n: number; rotulo: string; sub: string } | null {
  if (!a || a.meses <= 0) return null
  if (!a.de || !a.ate) {
    // sem as datas do primeiro e do último mês: a frase não cita faixa
    return { n: a.meses, rotulo: a.meses === 1 ? 'mês já no arquivo' : 'meses já no arquivo', sub: a.meses === 1 ? 'Fica como está.' : 'Ficam como estão: o arquivo não é tocado.' }
  }
  return a.meses === 1
    ? { n: 1, rotulo: 'mês já no arquivo', sub: `em ${mesAno(a.de)}. Fica como está.` }
    : { n: a.meses, rotulo: 'meses já no arquivo', sub: `de ${mesAno(a.de)} a ${mesAno(a.ate)}. Ficam como estão: o arquivo não é tocado.` }
}
/** A mais longa das subfrases da 5ª linha: o que o sizer reserva. */
export const SIZER_SUB_ARQUIVO = 'de 00/0000 a 00/0000. Ficam como estão: o arquivo não é tocado.'

/**
 * Há arquivo a proteger. Mesma regra do banco: `meses` conta só unidade corrente com row_count > 0 (cte `cheios` de obs_archive_channel_archive_impact) e a
 * recusa `apagar_com_arquivo` de competitor_channel_remove (`v_cheias`, migration 20261025000005) conta o mesmo; unidade vazia não é arquivo.
 */
export const temArquivo = (a: ArquivoImpact | null | undefined): boolean => !!a && (a.meses > 0 || a.videosRetirados.n > 0)

/** Q2: a frase do rádio desligado. "Única cópia" só quando há mês fora do banco ou vídeo retirado (D2). */
export const FRASE_ARQUIVO_SEM_NUMEROS = 'Este canal tem meses no arquivo. Para não perder esse histórico, use Guardar no NAS.'
export function fraseApagarComArquivo(a: ArquivoImpact | null): string {
  if (!a || !temArquivo(a)) return FRASE_ARQUIVO_SEM_NUMEROS
  const partes: string[] = []
  if (a.meses > 0) {
    const faixa = a.de && a.ate ? (a.meses === 1 || a.de === a.ate ? ` (${mesAno(a.de)})` : ` (${mesAno(a.de)} a ${mesAno(a.ate)})`) : ''
    partes.push(`Este canal tem ${mesesDe(a.meses)} no arquivo${faixa}${a.foraDoBanco.meses > 0 ? `, ${a.foraDoBanco.meses} já fora do banco` : ''}.`)
  }
  const v = a.videosRetirados.n
  if (v > 0) partes.push(v === 1 ? '1 vídeo deste canal já foi retirado do banco e só existe no arquivo.' : `${milhar(v)} vídeos deste canal já foram retirados do banco e só existem no arquivo.`)
  const unica = a.foraDoBanco.meses > 0 || v > 0
  partes.push(unica ? 'Para não perder a única cópia, use Guardar no NAS.' : 'Para não perder esse histórico, use Guardar no NAS.')
  return partes.join(' ')
}
/** A mais longa das frases do rádio desligado: o que o sizer reserva no rádio de apagar (D6). */
export const SIZER_PORQUE = 'Este canal tem 00 meses no arquivo (00/0000 a 00/0000), 00 já fora do banco. Para não perder a única cópia, use Guardar no NAS.'

/** Quando a opção "apagar sem guardar" está desligada, e por quê (a frase fica visível, ligada por aria-describedby). `corrida`: o servidor respondeu apagar_com_arquivo. */
export function opcaoApagar(e: { fase: Fase; semGuardar: SemGuardar | null; arquivo?: ArquivoImpact | null; corrida?: boolean }): { ativa: true } | { ativa: false; porque: string } {
  // contando: desligada sem frase de falha (a contagem ainda vem; a caixa não pode mudar de altura, I1)
  if (e.fase === 'contando') return { ativa: false, porque: '' }
  if (e.fase === 'falha_contagem' || e.semGuardar === null) return { ativa: false, porque: 'Precisa da contagem para apagar sem guardar.' }
  if (temArquivo(e.arquivo)) return { ativa: false, porque: fraseApagarComArquivo(e.arquivo ?? null) }
  if (e.corrida) return { ativa: false, porque: FRASE_ARQUIVO_SEM_NUMEROS }
  const s = e.semGuardar
  if (s.pode) return { ativa: true }
  if (s.porque === 'antigo') {
    return { ativa: false, porque: `Este canal tem ${s.meses} ${s.meses === 1 ? 'mês' : 'meses'} de histórico. Para não perder tudo por engano, use "Guardar no NAS".` }
  }
  return { ativa: false, porque: 'Não sabemos quando este canal foi adicionado. Para não perder nada por engano, use "Guardar no NAS".' }
}

/** 'AAAA-MM-DD...' vira 'dd/mm'; qualquer outra coisa é sem data (nunca "chega em sem data"). */
function dataCurta(iso: string | null | undefined): string | null {
  const m = typeof iso === 'string' ? /^\d{4}-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[2]}/${m[1]}` : null
}
/** B2: a frase de capacidade (04 §14.3), a do diálogo (momento 'dialogo') e a do aviso depois do clique ('toast'). */
export function fraseCapacidade(cap: Capacidade, n: number, dataIso: string | null | undefined, momento: 'dialogo' | 'toast'): string {
  const um = n === 1
  if (cap === 'sim') return `O site tenta apagá-${um ? 'la' : 'las'} todo dia, e a página do Arquivo mostra quantas faltam.`
  const data = dataCurta(dataIso)
  const lead = data ? `A limpeza das imagens chega em ${data}` : 'A limpeza das imagens ainda não tem data para chegar'
  if (momento === 'toast') return `${lead}; até lá não há nada a fazer.`
  const ate = `${lead}; até lá ${um ? 'ela continua' : 'elas continuam'} no Blob`
  return cap === 'nao-sim' ? `${ate}, e a página do Arquivo mostra quantas faltam.` : `${ate}. A página do Arquivo vai mostrar quantas faltam.`
}
/** Q3: a frase do Blob, em duas partes (o ⓘ entra entre `linha1Antes` e `linha1Depois`). Sem imagens, sem frase. */
/** I3 (dono, 25/10): a 2ª linha diz o que o clique faz (remover.ts apaga na hora; o que não sair fica em blob_urls_pending). A frase de capacidade fica só no aviso âmbar. */
export function fraseBlobDialogo(n: number): { linha1Antes: string; linha1Depois: string; linha2: string } | null {
  if (n <= 0) return null
  const um = n === 1
  return {
    linha1Antes: `Este canal tem ${milhar(n)} ${um ? 'imagem guardada' : 'imagens guardadas'} no Blob`,
    linha1Depois: `. Ao apagar, ${um ? 'ela fica anotada' : 'elas ficam anotadas'} para apagar.`,
    linha2: um ? 'O site tenta apagar a imagem agora; se não sair, fica anotada, e o aviso depois do clique diz se sobrou.' : 'O site tenta apagar as imagens agora; o que não sair fica anotado, e o aviso depois do clique diz quantas sobraram.',
  }
}
export const BLOB_INFO = { rotulo: 'O que é o Blob', titulo: 'O que é o Blob', itens: ['O Blob é o armazenamento de imagens do site, na Vercel.', 'A contagem vem do banco no momento em que esta janela abre.'] }
/**
 * Espelho de `obs_nome_normalizado` (banco): classe EXPLÍCITA de espaços (nunca `\s`, que difere entre JS e Postgres), um espaço simples,
 * pontas aparadas, caixa ignorada, acento preservado. A mesma classe vale nos dois lados.
 */
const INVISIVEIS = /[\u200b\u2060\ufeff]/g
const ESPACOS = /[ \t\n\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g
export function normalizarNome(s: string): string {
  return s.replace(INVISIVEIS, '').replace(ESPACOS, ' ').replace(/^ +| +$/g, '').toLowerCase()
}
export function nomeConfere(digitado: string, nome: string): boolean {
  const d = normalizarNome(digitado)
  return d !== '' && d === normalizarNome(nome)
}

export function botaoPrincipal(e: { caminho: Caminho; fase: Fase; nomeOk: boolean }): { rotulo: string; desabilitado: boolean; ocupado: boolean } {
  const enviando = e.fase === 'enviando'
  if (e.caminho === 'guardar') {
    return { rotulo: enviando ? 'Parando a coleta…' : 'Parar coleta e agendar guarda no NAS', desabilitado: e.fase === 'contando' || enviando, ocupado: enviando }
  }
  return {
    rotulo: enviando ? 'Apagando…' : 'Apagar sem guardar',
    desabilitado: !e.nomeOk || e.fase === 'contando' || e.fase === 'falha_contagem' || enviando,
    ocupado: enviando,
  }
}

/** "agendado há N dias", por horas decorridas (não por data de calendário: não depende de fuso). */
export function idadeDoAgendado(desdeIso: string, agoraMs: number): string {
  const desde = Date.parse(desdeIso)
  const dias = Number.isFinite(desde) ? Math.floor((agoraMs - desde) / 86_400_000) : 0
  if (dias < 1) return 'agendado hoje'
  return dias === 1 ? 'agendado há 1 dia' : `agendado há ${dias} dias`
}

/** A frase do pacote de IA para o canal agendado: fixa, com a data do pedido (DD/MM), nunca a idade relativa. */
export function fraseAgendadoIa(desdeIso: string): string {
  return `agendado para guardar desde ${desdeIso.slice(8, 10)}/${desdeIso.slice(5, 7)}; coleta parada, números congelados`
}

export function pedidoAoAgente(nome: string, email: string | null): string {
  return [
    'Peço que rode, no repositório bythiagofigueiredo:',
    `\`npx tsx scripts/obs-arquivo.ts pedidos --por ${email ?? '<seu e-mail>'}\``,
    `Ele leva a remoção de ${nome} ao próximo passo (exportar, conferir, copiar para o NAS e remover). Avise quando ${nome} sair da lista de Canais (a lista pode levar até 15 minutos para atualizar).`,
  ].join('\n')
}

/** Códigos que podem passar sozinhos: tentar de novo faz sentido. Os outros são permanentes (a frase diz o que fazer). */
export function codigoPassageiro(c: CodigoTela | 'sem-resposta'): boolean {
  return c === 'leitura' || c === 'inesperado'
}

const FRASE_LEITURA = 'Não deu para conferir o canal agora. Nada mudou. Tente de novo.'

/** A janela mostra `frase` (do catálogo do código, nunca do banco). Sem frase, cai no catálogo. */
export function fraseDoErro(codigo: CodigoTela | 'sem-resposta', frase?: string, caminho: Caminho = 'apagar'): { titulo: string; corpo: string } {
  if (codigo === 'sem-resposta') {
    return { titulo: TXT.incertoTitulo, corpo: caminho === 'guardar' ? TXT.incertoGuardarCorpo : TXT.incertoApagarCorpo }
  }
  if (caminho === 'apagar' && codigo === 'video_compartilhado') {
    return { titulo: TXT.erroApagarTitulo, corpo: `${frase ?? FRASES_E10.video_compartilhado} ${TXT.compartilhadoProximo}` }
  }
  const f = frase ?? (codigo in FRASES_E10 ? FRASES_E10[codigo as CodigoE10] : FRASE_LEITURA)
  if (caminho === 'guardar') {
    return codigoPassageiro(codigo)
      ? { titulo: TXT.erroGuardarTitulo, corpo: TXT.erroGuardarCorpo }
      : { titulo: TXT.erroGuardarTitulo, corpo: `Nada mudou. ${f}` }
  }
  return { titulo: TXT.erroApagarTitulo, corpo: f }
}

export function desfeitoCorpo(nome: string, despausado: boolean): string {
  return despausado
    ? `A coleta de ${nome} foi retomada e a remoção foi cancelada.`
    : `A remoção de ${nome} foi cancelada. O canal continua pausado, como estava antes.`
}

/**
 * Os números vêm do retorno da F1 (linhas apagadas, contadas pelo banco); o que faltou é omitido da frase (nunca escreve 0 no lugar).
 * As linhas de `competitor_video_daily` NÃO entram no toast: a janela conta dias distintos e o retorno da F1 só tem linhas, então os dois
 * números da mesma tabela divergiriam. As linhas seguem no `audit_log`.
 */
export function listaApagada(nome: string, d: { videos: number; leituras?: number }): string {
  const itens = [plural(d.videos, 'vídeo', 'vídeos')]
  if (d.leituras !== undefined) itens.push(plural(d.leituras, 'leitura', 'leituras'))
  const lista = itens.length === 1 ? itens[0]! : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
  return `${nome} saiu, sem cópia: ${lista}.`
}
export function toastApagadoCorpo(nome: string, d: { videos: number; leituras?: number }): string {
  return `${listaApagada(nome, d)} A vaga foi liberada. A ação foi registrada.`
}

/** B2/Q4: o que se sabe das imagens do canal. `imagensRestantes`: lido depois do clique (ausente = a leitura não veio); `imagensAoAbrir`: lido quando a janela abriu. */
export interface ImagensDoAviso { imagensRestantes?: number; imagensAoAbrir?: number; capacidade?: Capacidade; dataDoComando?: string | null }
export interface AvisoApagado { kind: 'ok' | 'warn'; titulo: string; corpo: string; /** âmbar: fica até o ✕ (D5) */ fixo: boolean }

/** O aviso depois de apagar. Âmbar quando restaram imagens ou quando não deu para conferir; verde (o de hoje) quando nada sobrou ou nada havia. */
export function toastApagado(nome: string, d: { videos: number; leituras?: number } & ImagensDoAviso): AvisoApagado {
  const base = toastApagadoCorpo(nome, d)
  const verde: AvisoApagado = { kind: 'ok', titulo: TXT.toastApagadoTitulo, corpo: base, fixo: false }
  const cap = d.capacidade ?? 'nao-nao'
  if (d.imagensRestantes === undefined) {
    if (d.imagensAoAbrir === undefined || d.imagensAoAbrir <= 0) return verde
    const lista = listaApagada(nome, d)
    return { kind: 'warn', fixo: true, titulo: 'Apagado, sem conferir as imagens',
      corpo: `${lista} Não deu para conferir as imagens do canal no Blob; quando você abriu esta janela havia ${milhar(d.imagensAoAbrir)}. A vaga foi liberada. A ação foi registrada.` }
  }
  const n = d.imagensRestantes
  if (n <= 0) return verde
  const lista = listaApagada(nome, d)
  const ainda = n === 1 ? '1 imagem do canal ainda está' : `${milhar(n)} imagens do canal ainda estão`
  return { kind: 'warn', fixo: true, titulo: n === 1 ? 'Apagado, com 1 imagem no Blob' : `Apagado, com ${milhar(n)} imagens no Blob`,
    corpo: `${lista} ${ainda} no Blob. ${fraseCapacidade(cap, n, d.dataDoComando, 'toast')} A vaga foi liberada. A ação foi registrada.` }
}

/** O que o desfecho de "apagar" sabe das imagens, no formato do aviso (só os campos que vieram). */
export function imagensDe(d: ImagensDoAviso): ImagensDoAviso {
  return {
    ...(d.imagensRestantes !== undefined ? { imagensRestantes: d.imagensRestantes } : {}),
    ...(d.imagensAoAbrir !== undefined ? { imagensAoAbrir: d.imagensAoAbrir } : {}),
    ...(d.capacidade !== undefined ? { capacidade: d.capacidade } : {}),
    ...(d.dataDoComando !== undefined ? { dataDoComando: d.dataDoComando } : {}),
  }
}
