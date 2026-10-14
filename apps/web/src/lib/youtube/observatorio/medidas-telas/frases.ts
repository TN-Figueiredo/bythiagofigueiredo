// A5 · E5a, Tarefa 1: as frases das telas. A frase LONGA de todo motivo é a da tabela única (`medidas-frases.ts`, dona: E7 T11);
// este arquivo escreve só a CURTA, a classe do motivo, a frase das notas e a fonte fixa.
import { FRASES_DE_MOTIVO, type ContextoDaFrase } from '../medidas-frases'
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
// mockups; as outras são TEXTO-A-REVISAR (Logan/Naksu), escritas para caber em uma linha e sem jargão.
const CURTAS: Record<MotivoNaoMedido, (c: ContextoDaFrase) => string> = {
  leitura_comecou_depois: () => 'vídeo anterior à contagem', // TEXTO-A-REVISAR
  descoberto_tarde: () => 'descoberto tarde demais', // TEXTO-A-REVISAR
  leitura_parou_antes: () => 'contagem parou antes', // TEXTO-A-REVISAR
  leituras_distantes: () => 'leituras longe da idade', // TEXTO-A-REVISAR
  sem_leitura: () => 'sem leitura nessa idade', // TEXTO-A-REVISAR
  views_ocultas: () => 'views ocultas pelo canal', // TEXTO-A-REVISAR
  fecha_em: c => (c.fechaEm ? `fecha em ${dm(c.fechaEm)}` : 'ainda sem data para fechar'),
  aguardando_calculo: () => 'cálculo ainda não rodou', // TEXTO-A-REVISAR
  poucos_videos: c => comNumeros(c, (n, min) => `${n} de ${min} vídeos`, 'poucos vídeos'), // TEXTO-A-REVISAR
  poucas_publicacoes: c => comNumeros(c, (n, min) => `${n} de ${min} publicações`, 'poucas publicações'), // TEXTO-A-REVISAR
  ritmo_parcial: () => 'ritmo parcial', // TEXTO-A-REVISAR
  sem_publicacao: () => 'sem data de publicação', // TEXTO-A-REVISAR
  sem_registro_recente: () => 'sem registro recente', // TEXTO-A-REVISAR
  sem_registro_na_borda: c => (c.desde ? `sem registro em ${dm(c.desde)}` : 'sem registro num dos dias'), // TEXTO-A-REVISAR
  pouco_registro: () => 'poucos dias de registro', // TEXTO-A-REVISAR
  janela_cruza_mudanca_de_contagem: c => (c.fechaEm ? `fecha em ${dm(c.fechaEm)}` : 'cruza a mudança de contagem'), // TEXTO-A-REVISAR
  contagem_recuou: () => 'contagem recuou', // TEXTO-A-REVISAR
  base_zero: () => 'base em zero', // TEXTO-A-REVISAR
  poucas_views: () => 'poucas views', // TEXTO-A-REVISAR
  poucas_curtidas: () => 'poucas curtidas', // TEXTO-A-REVISAR
  sem_v30: () => 'sem views aos 30 dias', // TEXTO-A-REVISAR
  idade_menor_que_90: () => 'ainda sem 90 dias', // TEXTO-A-REVISAR
  ao_vivo_ou_estreia: () => 'ao vivo ou estreia', // TEXTO-A-REVISAR
  formato_nao_confirmado: () => 'formato não confirmado', // TEXTO-A-REVISAR
  sem_reacao_publica: () => 'sem reação pública para comparar', // TEXTO-A-REVISAR (mockup 14 usa esta frase)
  curtidas_ocultas: () => 'curtidas ocultas', // TEXTO-A-REVISAR
  retrato_ausente: () => 'sem leitura de comentários', // TEXTO-A-REVISAR
  sem_multiplo: () => 'sem múltiplo', // TEXTO-A-REVISAR
  serie_nao_pedida: () => 'contagem dia a dia não pedida', // TEXTO-A-REVISAR
  serie_diaria_incompleta: () => 'contagem dia a dia incompleta', // TEXTO-A-REVISAR
  arquivado: () => 'vídeo arquivado', // TEXTO-A-REVISAR
  sem_permissao: () => 'só para quem edita', // TEXTO-A-REVISAR
  leitura_falhou: () => 'não carregou', // TEXTO-A-REVISAR
  calculo_falhou: () => 'não carregou', // TEXTO-A-REVISAR
  coleta_pausada: () => 'coleta pausada', // TEXTO-A-REVISAR
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

/** A frase de uma nota que a medida carrega. TEXTO-A-REVISAR (Logan/Naksu): o plano não fixa o texto das notas. */
export function fraseDaNota(n: Nota): string {
  switch (n.tipo) {
    case 'mudanca_de_contagem': return 'A janela cruza o dia em que o YouTube mudou a contagem de views.'
    case 'ao_vivo_fora': return `${plural(n.n, 'transmissão ao vivo ficou', 'transmissões ao vivo ficaram')} fora da conta.`
    case 'fora_do_ar_dentro': return `${plural(n.n, 'vídeo fora do ar entrou', 'vídeos fora do ar entraram')} na conta.`
    case 'formato_nao_confirmado_fora': return `${plural(n.n, 'vídeo com formato não confirmado ficou', 'vídeos com formato não confirmado ficaram')} fora da conta.`
    case 'ao_vivo_nao_se_sabe': return `Não se sabe se ${plural(n.n, 'vídeo foi', 'vídeos foram')} ao vivo.`
    case 'total_de_hoje': return 'O número é o total de hoje, não o de uma data passada.'
    case 'so_curtidas': return 'Só as curtidas entram: os comentários estão desligados.'
    case 'so_comentarios': return 'Só os comentários entram: as curtidas estão ocultas.'
    case 'serie_semanal': return 'A contagem é semanal, não dia a dia.'
    case 'agendado_fora': return `${plural(n.n, 'vídeo agendado ficou', 'vídeos agendados ficaram')} fora da conta.`
  }
}
