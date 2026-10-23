// Tipos compartilhados da lista "Sugestões" (F3 T3). Sem React: o componente client e a server action importam daqui.

/** Os 4 motivos que a tela oferece; 1:1 com o enum de dispensa do banco ("Já fiz" grava `ja_fiz`, nunca `feito`). */
export type MotivoDaTela = 'lugar_errado' | 'nao_interessa' | 'nao_e_parecido' | 'ja_fiz'

export type RespostaDaAcao =
  | { ok: true }
  | { ok: false; motivo: 'nao_aberto' | 'nao_encontrado' | 'motivo_invalido' | 'sem_permissao' | 'falhou' }

/** As ações chegam ao componente por prop (nunca importadas no client). */
export interface AcoesDaLista {
  dispensar(id: string, motivo: MotivoDaTela): Promise<RespostaDaAcao>
}
