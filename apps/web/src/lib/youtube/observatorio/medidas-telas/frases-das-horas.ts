// apps/web/src/lib/youtube/observatorio/medidas-telas/frases-das-horas.ts
// E5a Tarefa 14d: as frases dos motivos de "não medido" das 72 horas. Puro. Os textos são os dos NOTAS 13 e 15;
// os marcados TEXTO-A-REVISAR são do desvio 16 do plano (Logan confere).
import type { MotivoDeHora, MotivoDeHoras } from './tracao-72h'

export interface ContextoDeHoras {
  /** "dd/mm" ou "dd/mm/aaaa" já escritos pela tela (fuso de São Paulo). */
  publicadoEm?: string
  /** "dd/mm" da primeira hora do site. */
  comecouEm?: string
  /** "dd/mm hh:mm" */
  paradaDesde?: string
  /** Horas entre a publicação e a entrada na contagem. */
  horasAteEntrar?: number
  /** "7 h 40 min" */
  depoisDePublicar?: string
  /** "1/4", "1/2" ou "3/4" */
  fracao?: string
  /** Vídeos que têm as 72 horas, e o mínimo. */
  n?: number
  minimo?: number
  /** Para a ponta vazia. */
  k?: number
  views?: number
}

export type ClasseDoMotivo = 'nao_medido' | 'nao_carregou'
export interface Frase { curta: string; longa: string }

const num = (n: number): string => n.toLocaleString('pt-BR')

export const CLASSE_DO_MOTIVO: Record<MotivoDeHoras, ClasseDoMotivo> = {
  leitura_por_hora_nao_comecou: 'nao_medido',
  publicado_antes_da_leitura_por_hora: 'nao_medido',
  entrou_tarde: 'nao_medido',
  ja_tinha_passado: 'nao_medido',
  poucos_videos: 'nao_medido',
  muitas_horas_sem_contagem: 'nao_medido',
  ainda_nao_tem_72_horas: 'nao_medido',
  ao_vivo_ou_estreia: 'nao_medido',
  leitura_falhou: 'nao_carregou',
  sem_contagem_no_fim_das_72_horas: 'nao_medido',
  sem_contagem_nas_72_horas: 'nao_medido',
  leitura_por_hora_parada: 'nao_carregou',
}

export const FRASES_DAS_HORAS: Record<MotivoDeHoras, (c: ContextoDeHoras) => Frase> = {
  // TEXTO-A-REVISAR (desvio 16, pergunta 20)
  leitura_por_hora_nao_comecou: () => ({
    curta: 'a leitura por hora ainda não começou',
    longa: 'A leitura por hora ainda não começou.',
  }),
  publicado_antes_da_leitura_por_hora: (c) => ({
    curta: `publicado antes de ${c.comecouEm ?? ''}`.trim(),
    longa: `publicado em ${c.publicadoEm ?? ''}, antes de ${c.comecouEm ?? ''}: a contagem por hora começou nesse dia e só vale para vídeos publicados depois`,
  }),
  entrou_tarde: (c) => ({
    curta: 'entrou tarde na contagem',
    longa: `entrou tarde na contagem: o vídeo só entrou na contagem ${num(c.horasAteEntrar ?? 0)} horas depois de publicado, quando as 72 horas já tinham passado`,
  }),
  ja_tinha_passado: (c) => ({
    curta: `${c.fracao ?? ''} não medido`.trim(),
    longa: `Deste vídeo, ${c.fracao ?? ''} não medido: o vídeo já tinha mais de ${c.fracao ?? ''} das views quando a contagem por hora começou (${c.depoisDePublicar ?? ''} depois de publicar).`,
  }),
  poucos_videos: (c) => ({
    curta: 'menos de 3 vídeos com as 72 horas',
    longa: `menos de ${c.minimo ?? 3} vídeos com as 72 primeiras horas acompanhadas (hoje ${c.n ?? 0}).`,
  }),
  // TEXTO-A-REVISAR (desvio 16: não afirma o que ninguém mediu)
  muitas_horas_sem_contagem: () => ({
    curta: 'muitas horas sem contagem',
    longa: 'não medido: mais de 20% das 72 horas ficaram sem contagem',
  }),
  // TEXTO-A-REVISAR
  ainda_nao_tem_72_horas: () => ({
    curta: 'ainda não tem 72 horas',
    longa: 'ainda não existe: o vídeo ainda não fez 72 horas',
  }),
  ao_vivo_ou_estreia: () => ({
    curta: 'ao vivo ou estreia',
    longa: 'fora do normal do canal: ao vivo ou estreia',
  }),
  // TEXTO-A-REVISAR
  leitura_falhou: () => ({
    curta: 'não carregou',
    longa: 'não carregou: a leitura por hora falhou; tente de novo',
  }),
  // TEXTO-A-REVISAR (a décima oitava do desvio 16)
  sem_contagem_no_fim_das_72_horas: (c) => ({
    curta: 'contagem parou antes das 72 horas',
    longa: `não medido: a contagem por hora parou na hora ${c.k ?? 0}, com ${num(c.views ?? 0)} views; o total das 72 horas não foi lido`,
  }),
  // TEXTO-A-REVISAR (desvio 16)
  sem_contagem_nas_72_horas: () => ({
    curta: 'sem contagem nas 72 horas',
    longa: 'não medido: a contagem por hora não rodou para este vídeo nas primeiras 72 horas',
  }),
  // TEXTO-A-REVISAR (desvio 16)
  leitura_por_hora_parada: (c) => ({
    curta: 'leitura por hora parada',
    longa: `a leitura por hora está parada desde ${c.paradaDesde ?? ''}`.trim(),
  }),
}

/** Frases de uma hora sem barra (desvio 16). TEXTO-A-REVISAR em todas, menos a primeira (NOTAS 13). */
export const FRASES_DE_HORA: Record<MotivoDeHora | 'diminuiu', string> = {
  antes_da_primeira_contagem: 'não medido: antes da primeira contagem',
  sem_contagem_nesta_hora: 'não medido: sem contagem nesta hora',
  fora_da_hora_cheia: 'não medido: contagem fora da hora cheia',
  cobre_mais_de_uma_hora: 'não medido: a contagem cobre mais de uma hora',
  diminuiu: 'a contagem diminuiu nesta hora',
}

/** "N horas sem barra: o ganho delas está no total, não nas barras". Nula quando não há o que dizer ou o total não foi lido. */
export function fraseDasHorasSemBarra(horasSemBarra: number, totalLido: boolean): string | null {
  if (!totalLido || horasSemBarra <= 0) return null
  return `${horasSemBarra} ${horasSemBarra === 1 ? 'hora sem barra' : 'horas sem barra'}: o ganho ${horasSemBarra === 1 ? 'dela está' : 'delas está'} no total, não nas barras`
}
