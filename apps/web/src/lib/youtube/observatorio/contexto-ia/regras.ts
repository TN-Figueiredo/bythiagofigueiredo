// A5 · E17 degrau 1: as regras do pacote "Perguntar a uma IA". Um lugar só: o corte, o diálogo, a ação e os testes leem estes números daqui.
// Este arquivo NÃO importa `rules.ts` (ciclo): é `rules.ts` que importa este.

export const CONTEXTO_IA_RULES = {
  versaoDoFormato: 1,
  /** Limite da cópia (o que cabe numa mensagem de qualquer IA). */
  limiteCopia: 30_000,
  /** Limite do arquivo completo (.md). */
  limiteCompleto: 200_000,
  /** Teto da pergunta; ela entra no total e nunca é cortada. */
  perguntaMax: 1_000,
  linhasPorLista: 25,
  /** Degraus do corte das linhas de lista, do mais cheio ao vazio. */
  degrausDeLinhas: [25, 10, 5, 3, 1, 0],
  /** Fração de não medidos a partir da qual a primeira linha do pacote avisa a IA. */
  magroAPartirDe: 0.75,
  /** Tamanho máximo da consulta da URL que o botão manda. */
  consultaMax: 2_000,
  /** Interruptor do botão; nasce desligado e vira `true` no commit do envio (Tarefa 15). */
  ligado: false,
} as const
