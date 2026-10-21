/**
 * A5 · Remover canal, F2: a regra PURA da janela e da linha agendada. Nenhum React, nenhum servidor: estado da janela, frases,
 * idade do agendado, regra do nome digitado e o texto do pedido ao agente. Os componentes só desenham o que sai daqui.
 * O texto da tela nunca vem do banco: a frase de um erro sai de `FRASES_E10` (por código) ou das constantes abaixo.
 */
import { FRASES_E10, type CodigoE10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { SemGuardar } from '@/lib/youtube/competitor-removal-impact'

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
  subVideos: (versoes: number) => `com ${plural(versoes, 'versão', 'versões')} de título, thumbnail e descrição`,
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

/** Quando a opção "apagar sem guardar" está desligada, e por quê (a frase fica visível, ligada por aria-describedby). */
export function opcaoApagar(e: { fase: Fase; semGuardar: SemGuardar | null }): { ativa: true } | { ativa: false; porque: string } {
  // contando: desligada sem frase de falha (a contagem ainda vem; a caixa não pode mudar de altura, I1)
  if (e.fase === 'contando') return { ativa: false, porque: '' }
  if (e.fase === 'falha_contagem' || e.semGuardar === null) return { ativa: false, porque: 'Precisa da contagem para apagar sem guardar.' }
  const s = e.semGuardar
  if (s.pode) return { ativa: true }
  if (s.porque === 'antigo') {
    return { ativa: false, porque: `Este canal tem ${s.meses} ${s.meses === 1 ? 'mês' : 'meses'} de histórico. Para não perder tudo por engano, use "Guardar no NAS".` }
  }
  return { ativa: false, porque: 'Não sabemos quando este canal foi adicionado. Para não perder nada por engano, use "Guardar no NAS".' }
}

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
export function toastApagadoCorpo(nome: string, d: { videos: number; leituras?: number }): string {
  const itens = [plural(d.videos, 'vídeo', 'vídeos')]
  if (d.leituras !== undefined) itens.push(plural(d.leituras, 'leitura', 'leituras'))
  const lista = itens.length === 1 ? itens[0]! : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
  return `${nome} saiu, sem cópia: ${lista}. A vaga foi liberada. A ação foi registrada.`
}
