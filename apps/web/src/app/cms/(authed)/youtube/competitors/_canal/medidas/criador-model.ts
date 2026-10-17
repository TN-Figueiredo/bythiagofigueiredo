// E5a Tarefa 15: a célula "Criador responde". Nesta tarefa só existe `nao_pedida`: a célula não faz consulta e não afirma estado da
// coleta de comentários (a C4 a estende com `nao_comecou` e `parada`, porque é ela que lê a coleta).

export type EstadoDaColetaDeComentarios = 'nao_pedida'

export interface CelulaDoCriador {
  tipo: 'nao_medido'
  /** TEXTO-A-REVISAR (desvio 16): a frase da pergunta 26, terceira forma. */
  curta: string
  longa: string
}

export const FRASE_CRIADOR_NAO_PEDIDA = 'não medido: esta medida chega com a tela de comentários'

export function celulaDoCriador(estadoDaColeta: EstadoDaColetaDeComentarios): CelulaDoCriador {
  switch (estadoDaColeta) {
    case 'nao_pedida':
      return { tipo: 'nao_medido', curta: FRASE_CRIADOR_NAO_PEDIDA, longa: FRASE_CRIADOR_NAO_PEDIDA }
  }
}
