// E19 (A5, spec 07 §8.2). Trocar `modo` de 'aviso' para 'recusa' É o commit 2 da etapa; reverter esse commit volta a medir.
// Não é variável de ambiente de propósito: o valor publicado é o que está no git, e um teste o prende.
export interface ConfigLeitura {
  /** 'aviso': chave sem `read` lê e a leitura é registrada. 'recusa': recebe 403. */
  modo: 'aviso' | 'recusa'
  /** Dia de São Paulo (AAAA-MM-DD) em que o modo aviso foi a produção: é o dia 1 dos 14 dias de registro cheio. */
  avisoDesde: string
  /** Dia de São Paulo em que a janela fechou com 7 dias medidos (ledger). null = aberta. Fechada: leitura com `read` não grava mais. */
  controleFechadoEm: string | null
  /** Só no modo recusa: até este instante (ISO, UTC) toda leitura ACEITA de chave grava a linha de controle. Sem ela, "zero
   *  recusas" não se distingue de "registro mudo" na conferência do dia da promoção. */
  conferenciaAte: string | null
}

const CONFIG: ConfigLeitura = {
  modo: 'aviso',
  avisoDesde: '2026-10-13',
  controleFechadoEm: null,
  conferenciaAte: null,
}

export function modoLeitura(): ConfigLeitura {
  return CONFIG
}
