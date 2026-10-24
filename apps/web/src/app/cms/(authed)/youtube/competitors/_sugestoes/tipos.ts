// Tipos compartilhados da lista "Sugestões" (F3 T3). Sem React: o componente client e a server action importam daqui.

/** Os 4 motivos que a tela oferece; 1:1 com o enum de dispensa do banco ("Já fiz" grava `ja_fiz`, nunca `feito`). */
export type MotivoDaTela = 'lugar_errado' | 'nao_interessa' | 'nao_e_parecido' | 'ja_fiz'

export type RespostaDaAcao =
  /** `adiado_ate` (ISO) só na resposta do "Adiar 7 dias". */
  | { ok: true; adiado_ate?: string }
  | { ok: false; motivo: 'nao_aberto' | 'nao_encontrado' | 'motivo_invalido' | 'sem_permissao' | 'falhou' }
  /** F3b: a tentativa anterior chegou ao servidor; a tela trata como sucesso com a data. */
  | { ok: false; motivo: 'ja_adiado'; adiado_ate: string }
  /** F3b: vence antes de voltar (menos de 7 dias): não adiou. */
  | { ok: false; motivo: 'expira_antes'; expira_em: string }

/** As ações chegam ao componente por prop (nunca importadas no client). */
export interface AcoesDaLista {
  dispensar(id: string, motivo: MotivoDaTela): Promise<RespostaDaAcao>
  /** F3b: "Adiar 7 dias". */
  adiar(id: string): Promise<RespostaDaAcao>
}
