// A5 · E5a, Tarefa 1: as frases das telas. A frase LONGA de todo motivo é a da tabela única (`medidas-frases.ts`, dona: E7 T11);
// este arquivo escreve só a CURTA, a classe do motivo, a frase das notas e a fonte fixa.
import { FRASES_DE_MOTIVO, type ContextoDaFrase } from '../medidas-frases'
import { MEASURE_RULES } from '../medidas/regras'
import { MOTIVOS_NAO_MEDIDO, type MotivoNaoMedido, type Nota } from '../medidas/tipos'

export type { ContextoDaFrase }
export type ClasseDoMotivo = 'nao_medido' | 'nao_carregou'
export type TelaDeFrase = 'canais' | 'mudancas' | 'comparar' | 'outliers' | 'insights' | 'estourou' | 'canal' | 'historico'

/** Item 35: a fonte, sempre a mesma frase. */
export const FRASE_FIXA_DA_FONTE = 'Cálculo do Observatório sobre dados públicos do YouTube.'

/** "Não carregou" é falha de leitura ou de cálculo; nunca vira "não medido" nem zero. Todo o resto é "não medido". */
export function classeDoMotivo(m: MotivoNaoMedido): ClasseDoMotivo {
  return m === 'leitura_falhou' || m === 'calculo_falhou' ? 'nao_carregou' : 'nao_medido'
}

const dm = (s: string): string => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const comNumeros = (c: ContextoDaFrase, com: (n: number, min: number) => string, sem: string): string =>
  typeof c.n === 'number' && typeof c.minimo === 'number' ? com(c.n, c.minimo) : sem

// A curta é a que cabe numa pastilha. Só `fecha_em` (mockup 16, "fecha em dd/mm" e "ainda sem data para fechar") vem fixada pelos
// mockups; as outras passaram pelo Logan (17/10), escritas para caber em uma linha e sem jargão.
const CURTAS: Record<MotivoNaoMedido, (c: ContextoDaFrase) => string> = {
  leitura_comecou_depois: () => 'vídeo anterior à coleta',
  descoberto_tarde: () => 'visto só depois do prazo',
  leitura_parou_antes: () => 'coleta parou antes',
  leituras_distantes: () => 'sem leitura perto dessa idade',
  sem_leitura: () => 'sem leitura nessa idade',
  views_ocultas: () => 'views ocultas pelo canal',
  fecha_em: c => (c.fechaEm ? `fecha em ${dm(c.fechaEm)}` : 'ainda sem data para fechar'),
  aguardando_calculo: () => 'ainda não calculado',
  poucos_videos: c => comNumeros(c, (n, min) => `só ${n} de ${min} vídeos`, 'poucos vídeos para medir'),
  poucas_publicacoes: c => comNumeros(c, (n, min) => `só ${n} de ${min} publicações`, 'poucas publicações para medir'),
  ritmo_parcial: () => 'ritmo de parte do período',
  sem_publicacao: () => 'sem data de publicação',
  sem_registro_recente: () => 'sem leitura recente',
  sem_registro_na_borda: c => (c.desde ? `sem leitura em ${dm(c.desde)}` : 'sem leitura num dos dias'),
  pouco_registro: () => 'poucos dias de leitura',
  janela_cruza_mudanca_de_contagem: c => (c.fechaEm ? `fecha em ${dm(c.fechaEm)}` : `cruza a mudança de ${dm(MEASURE_RULES.countChange)} do YouTube`),
  contagem_recuou: () => 'views diminuíram no período',
  base_zero: () => 'período anterior com 0 views',
  poucas_views: () => 'poucas views',
  poucas_curtidas: () => 'poucas curtidas',
  sem_v30: () => 'sem views aos 30 dias',
  idade_menor_que_90: () => 'ainda sem 90 dias',
  ao_vivo_ou_estreia: () => 'ao vivo ou estreia',
  formato_nao_confirmado: () => 'formato não confirmado',
  sem_reacao_publica: () => 'sem reação pública para comparar',
  curtidas_ocultas: () => 'curtidas ocultas',
  retrato_ausente: () => 'sem leitura de comentários',
  sem_multiplo: () => 'múltiplo não calculado',
  serie_nao_pedida: () => 'dia a dia não carregado nesta tela',
  serie_diaria_incompleta: () => 'dia a dia incompleto',
  arquivado: () => 'vídeo arquivado',
  sem_permissao: () => 'só para quem edita',
  leitura_falhou: () => 'não carregou',
  calculo_falhou: () => 'não carregou',
  coleta_pausada: () => 'coleta pausada',
  nao_se_aplica: () => 'esta medida é só dos vídeos longos: o Short não tem direção dos vídeos novos',
}

/** Variante da `curta` por tela, quando um mockup escreve o mesmo motivo de outro jeito. Vazia até um mockup pedir; nunca troca a `longa`. */
const CURTAS_POR_TELA: Partial<Record<TelaDeFrase, Partial<Record<MotivoNaoMedido, (c: ContextoDaFrase) => string>>>> = {}

export const FRASES: Record<MotivoNaoMedido, (c: ContextoDaFrase, tela?: TelaDeFrase) => { curta: string; longa: string }> = Object.fromEntries(
  MOTIVOS_NAO_MEDIDO.map(m => [m, (c: ContextoDaFrase, tela?: TelaDeFrase) => ({
    curta: (tela ? CURTAS_POR_TELA[tela]?.[m] : undefined)?.(c) ?? CURTAS[m](c),
    longa: FRASES_DE_MOTIVO[m](c),
  })]),
) as Record<MotivoNaoMedido, (c: ContextoDaFrase, tela?: TelaDeFrase) => { curta: string; longa: string }>

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

/** A frase de uma nota que a medida carrega. Textos revistos pelo Logan (17/10). */
export function fraseDaNota(n: Nota): string {
  switch (n.tipo) {
    case 'mudanca_de_contagem': return `A janela inclui ${dm(MEASURE_RULES.countChange)}, dia em que o YouTube mudou como conta as views.`
    case 'ao_vivo_fora': return `${plural(n.n, 'transmissão', 'transmissões')} ao vivo fora da conta.`
    case 'fora_do_ar_dentro': return `${plural(n.n, 'vídeo', 'vídeos')} fora do ar na conta.`
    case 'formato_nao_confirmado_fora': return `${plural(n.n, 'vídeo', 'vídeos')} de formato não confirmado fora da conta.`
    case 'ao_vivo_nao_se_sabe': return `Não sabemos se ${plural(n.n, 'vídeo foi', 'vídeos foram')} ao vivo.`
    case 'total_de_hoje': return 'O número é o total de hoje, não o de uma data passada.'
    case 'so_curtidas': return 'Só as curtidas entram: os comentários estão desligados.'
    case 'so_comentarios': return 'Só os comentários entram: as curtidas estão ocultas.'
    case 'serie_semanal': return 'A contagem é semanal, não dia a dia.'
    case 'agendado_fora': return `${plural(n.n, 'vídeo agendado', 'vídeos agendados')} fora da conta.`
  }
}
