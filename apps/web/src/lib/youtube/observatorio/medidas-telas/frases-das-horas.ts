// apps/web/src/lib/youtube/observatorio/medidas-telas/frases-das-horas.ts
// E5a Tarefa 14d: as frases dos motivos de "não medido" das 72 horas. Puro. Os textos são os dos NOTAS 13 e 15;
// textos revistos pelo Logan (17/10, trem 4). Termo único: "leitura por hora" (nunca "contagem", que colide com a mudança do YouTube).
import { REGRAS_DAS_72_HORAS, type MotivoDeHora, type MotivoDeHoras } from './tracao-72h'

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
  leitura_por_hora_nao_comecou: () => ({
    curta: 'leitura por hora ainda não começou',
    longa: 'A leitura por hora ainda não começou; as barras aparecem a partir do primeiro vídeo publicado depois dela.',
  }),
  publicado_antes_da_leitura_por_hora: (c) => ({
    curta: `publicado antes de ${c.comecouEm ?? ''}`.trim(),
    longa: `publicado em ${c.publicadoEm ?? ''}, antes de ${c.comecouEm ?? ''}: a leitura por hora começou em ${c.comecouEm ?? ''} e só vale para vídeos publicados depois`,
  }),
  entrou_tarde: (c) => ({
    curta: 'leitura por hora começou tarde',
    longa: `a leitura por hora só começou ${num(c.horasAteEntrar ?? 0)} ${c.horasAteEntrar === 1 ? 'hora' : 'horas'} depois da publicação, quando as 72 horas já tinham passado`,
  }),
  ja_tinha_passado: (c) => ({
    curta: `${c.fracao ?? ''} não medido`.trim(),
    longa: `Falta ${c.fracao ?? ''} da medida deste vídeo: ele já tinha mais de ${c.fracao ?? ''} das views quando a leitura por hora começou (${c.depoisDePublicar ?? ''} depois de publicar).`,
  }),
  poucos_videos: (c) => ({
    curta: 'menos de 3 vídeos com as 72 horas',
    longa: `menos de ${c.minimo ?? 3} vídeos com as 72 primeiras horas acompanhadas (hoje ${c.n ?? 0}).`,
  }),
  muitas_horas_sem_contagem: () => ({
    curta: 'muitas horas sem leitura',
    longa: `não medido: mais de ${Math.round(REGRAS_DAS_72_HORAS.MAX_HORAS_SEM_CONTAGEM * 100)}% das 72 horas ficaram sem leitura`,
  }),
  ainda_nao_tem_72_horas: () => ({
    curta: 'ainda não tem 72 horas',
    longa: 'ainda não dá para medir: o vídeo não fez 72 horas',
  }),
  ao_vivo_ou_estreia: () => ({
    curta: 'ao vivo ou estreia',
    longa: 'fora do normal do canal: ao vivo ou estreia',
  }),
  leitura_falhou: () => ({
    curta: 'não carregou',
    longa: 'não carregou: não deu para ler as horas deste vídeo',
  }),
  sem_contagem_no_fim_das_72_horas: (c) => ({
    curta: 'leitura parou antes das 72 horas',
    longa: `não medido: a leitura por hora parou na hora ${c.k ?? 0}, com ${num(c.views ?? 0)} views até ali; o total das 72 horas não foi lido`,
  }),
  sem_contagem_nas_72_horas: () => ({
    curta: 'sem leitura nas 72 horas',
    longa: 'não medido: não há leitura por hora deste vídeo nas primeiras 72 horas',
  }),
  leitura_por_hora_parada: (c) => ({
    curta: 'leitura por hora parada',
    longa: `a leitura por hora está parada desde ${c.paradaDesde ?? ''}`.trim(),
  }),
}

/** Frases de uma hora sem barra (desvio 16), revistas pelo Logan. */
export const FRASES_DE_HORA: Record<MotivoDeHora | 'diminuiu', string> = {
  antes_da_primeira_contagem: 'não medido: antes da primeira leitura',
  sem_contagem_nesta_hora: 'não medido: sem leitura nesta hora',
  fora_da_hora_cheia: 'não medido: leitura fora da hora cheia',
  cobre_mais_de_uma_hora: 'não medido: a leitura cobre mais de uma hora',
  diminuiu: 'o total de views diminuiu nesta hora',
}

/** "N horas sem barra: o ganho delas está no total, não nas barras". Nula quando não há o que dizer ou o total não foi lido. */
export function fraseDasHorasSemBarra(horasSemBarra: number, totalLido: boolean): string | null {
  if (!totalLido || horasSemBarra <= 0) return null
  return `${horasSemBarra} ${horasSemBarra === 1 ? 'hora sem barra' : 'horas sem barra'}: o ganho ${horasSemBarra === 1 ? 'dela está' : 'delas está'} no total, não nas barras`
}
