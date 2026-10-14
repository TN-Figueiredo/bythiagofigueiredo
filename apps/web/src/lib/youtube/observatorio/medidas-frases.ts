// A5 · E7, Tarefa 11: a tabela ÚNICA de frases dos motivos de "não medido". A rota do Cowork (services/competitors-frases reexporta
// daqui) e as telas (E5a: `medidas-telas/frases.ts` só acrescenta a frase curta e a classe do motivo) leem a mesma tabela.
// Módulo neutro: sem server-only, sem next, sem banco; importa só tipos de `medidas/tipos` e o Sentry (para o aviso do código
// desconhecido, que tem de morar aqui porque os dois caminhos são a mesma referência).
//
// Regras das frases: português, uma oração, SEM número escrito no texto (os números vêm do contexto; sem o número a frase não o cita),
// datas como dd/mm/aaaa, nenhuma frase manda o leitor fazer alguma coisa, e nenhum termo da lista de `CONVENCOES.md` (frases sem jargão).
// A `longa` é uma por motivo: a variante por tela é só da `curta`, que é da E5a.
import * as Sentry from '@sentry/nextjs'
import type { Medida, MotivoNaoMedido } from './medidas/tipos'

export interface ContextoDaFrase {
  n?: number
  minimo?: number
  /** Data `AAAA-MM-DD` (ou ISO completo) do que faltou ou de quando algo começou. */
  desde?: string
  /** Data em que a medida passa a fechar. */
  fechaEm?: string
  /** Idade do vídeo a que o motivo se refere, em dias. */
  idade?: 1 | 7 | 30
}

/** `AAAA-MM-DD…` vira `dd/mm/aaaa`, sem passar por `Date` (nenhum fuso entra). Texto que não é data sai como veio. */
function dataBR(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

const naIdade = (c: ContextoDaFrase): string => (c.idade ? ` aos ${c.idade} ${c.idade === 1 ? 'dia' : 'dias'} de vida` : ' nessa idade')

const comNumeros = (c: ContextoDaFrase, comDados: (n: number, minimo: number) => string, semDados: string): string =>
  typeof c.n === 'number' && typeof c.minimo === 'number' ? comDados(c.n, c.minimo) : semDados

export const FRASES_DE_MOTIVO: Record<MotivoNaoMedido, (c: ContextoDaFrase) => string> = {
  leitura_comecou_depois: c => (c.desde ? `o vídeo foi publicado antes de ${dataBR(c.desde)}, quando o Observatório começou a contar` : 'o vídeo foi publicado antes de o Observatório começar a contar'),
  descoberto_tarde: c => `o Observatório só descobriu o vídeo depois de ele passar da idade pedida${c.idade ? ` (${c.idade} ${c.idade === 1 ? 'dia' : 'dias'})` : ''}`,
  leitura_parou_antes: c => `a contagem do vídeo parou de ser lida antes de ele chegar à idade pedida${c.idade ? ` (${c.idade} ${c.idade === 1 ? 'dia' : 'dias'})` : ''}`,
  leituras_distantes: c => `as leituras mais próximas do vídeo${naIdade(c)} estão longe demais dela`,
  sem_leitura: c => `o vídeo não tem leitura de views${naIdade(c)}`,
  views_ocultas: () => 'o canal oculta a contagem de views do vídeo',
  fecha_em: c => (c.fechaEm ? `a janela ainda não fechou e fecha em ${dataBR(c.fechaEm)}` : 'a janela ainda não fechou e não há data prevista para fechar'),
  aguardando_calculo: c => `a idade já fechou${c.idade ? ` (${c.idade} ${c.idade === 1 ? 'dia' : 'dias'})` : ''}, mas o cálculo ainda não rodou`,
  poucos_videos: c => comNumeros(c, (n, min) => `há ${n} ${n === 1 ? 'vídeo' : 'vídeos'} na janela e a medida pede ${min}`, 'há poucos vídeos na janela para medir'),
  poucas_publicacoes: c => comNumeros(c, (n, min) => `há ${n} ${n === 1 ? 'publicação' : 'publicações'} na janela e a medida pede ${min}`, 'há poucas publicações na janela para medir o ritmo'),
  ritmo_parcial: () => 'a coleta do canal ainda não cobriu todos os vídeos, então o ritmo é parcial',
  sem_publicacao: () => 'o vídeo não tem data de publicação para a idade ser contada',
  sem_registro_recente: () => 'o último registro do canal é mais antigo que ontem',
  sem_registro_na_borda: c => (c.desde ? `falta o registro do canal no dia ${dataBR(c.desde)}` : 'falta o registro do canal em um dos dias da comparação'),
  pouco_registro: () => 'o canal tem poucos dias de registro para a comparação',
  janela_cruza_mudanca_de_contagem: c => 'a janela cruza o dia em que o YouTube mudou a contagem de views' + (c.fechaEm ? `; a primeira leitura limpa fecha em ${dataBR(c.fechaEm)}` : ''),
  contagem_recuou: () => 'a contagem de views diminuiu no período, e a diferença não é uma medida',
  base_zero: () => 'a base de comparação está em zero, então a razão não existe',
  poucas_views: () => 'o vídeo tem poucas views para esta medida',
  poucas_curtidas: () => 'o vídeo tem poucas curtidas para esta medida',
  sem_v30: () => 'o vídeo não tem a medida de views da idade de referência',
  idade_menor_que_90: () => 'o vídeo ainda não chegou à idade mínima desta medida',
  ao_vivo_ou_estreia: () => 'o vídeo é uma transmissão ao vivo ou uma estreia e fica fora desta comparação',
  formato_nao_confirmado: () => 'ainda não se sabe se o vídeo é longo ou Short',
  sem_reacao_publica: () => 'o vídeo não mostra curtidas nem comentários ao público',
  curtidas_ocultas: () => 'o canal oculta as curtidas do vídeo',
  retrato_ausente: () => 'o vídeo não tem leitura de comentários na idade pedida',
  sem_multiplo: () => 'o vídeo não tem múltiplo calculado contra o canal',
  serie_nao_pedida: () => 'a contagem dia a dia não foi pedida para esta medida',
  serie_diaria_incompleta: () => 'a contagem dia a dia do vídeo tem buracos para esta medida',
  arquivado: () => 'o vídeo está arquivado e a leitura dele foi encerrada',
  sem_permissao: () => 'esta medida só vale para quem edita o site',
  leitura_falhou: () => 'a leitura do banco falhou ou foi cortada nesta consulta; o valor não é conhecido',
  calculo_falhou: () => 'o cálculo desta medida falhou nesta consulta; o valor não é conhecido',
  coleta_pausada: () => 'a coleta deste canal está pausada, e não há leitura nova',
}

/**
 * A frase de uma medida não medida, com os números e datas da própria medida. Código fora do catálogo em execução (versão nova da
 * E4 numa tela velha): a frase de `leitura_falhou`, e um aviso ao Sentry com o código (nunca uma frase vazia).
 */
export function fraseDoMotivo(medida: Extract<Medida<unknown>, { estado: 'nao_medido' }>): string {
  const motivo: string = medida.motivo
  const f = Object.hasOwn(FRASES_DE_MOTIVO, motivo) ? FRASES_DE_MOTIVO[motivo as MotivoNaoMedido] : undefined
  if (!f) {
    Sentry.captureMessage('medidas.frase_sem_motivo', { extra: { motivo } })
    return FRASES_DE_MOTIVO.leitura_falhou({})
  }
  return f({ n: medida.n, minimo: medida.minimo, desde: medida.desde, fechaEm: medida.fechaEm })
}
