// A5 · E5a · Tarefa C1: de que NÍVEL quem pede vê os comentários. Sem ida ao banco (não é puro: importa os validadores dos tokens,
// que vivem em módulos com `server-only`). Nunca sobe de nível por falta de resposta: o que não for prova válida do site da guarda é `contagem`.
import { edicaoValida } from '../proprio/edicao'
import { leituraValida } from '../proprio/leitura-privada'
import type { Nivel, ProvasDeQuemVe } from './leitor-tipos'

/**
 * `identidade` só com token de edição válido E do site da guarda; `texto` só com token de leitura válido E do site da guarda; todo o resto
 * (nulo, objeto com a forma do token, token de outro site, resposta que falhou) é `contagem` com o site da guarda. Nos dois níveis de cima
 * o `siteId` devolvido é o de DENTRO do token.
 */
export function nivelDeQuemVe(provas: ProvasDeQuemVe | null, siteDaGuarda: string): { nivel: Nivel; siteId: string } {
  const contagem = { nivel: 'contagem' as const, siteId: siteDaGuarda }
  if (typeof provas !== 'object' || provas === null) return contagem
  const edicao: unknown = provas.edicao
  const leitura: unknown = provas.leitura
  if (edicaoValida(edicao) && edicao.siteId === siteDaGuarda) return { nivel: 'identidade', siteId: edicao.siteId }
  if (leituraValida(leitura) && leitura.siteId === siteDaGuarda) return { nivel: 'texto', siteId: leitura.siteId }
  return contagem
}

/** O marcador que ocupa o lugar de uma menção. */
export const MARCADOR_DE_MENCAO = '@…'

/**
 * Troca toda menção (`@` seguido de caracteres até o primeiro espaço) pelo marcador fixo. Limites conhecidos: nome por extenso, sem `@`,
 * não é reconhecido; nome de exibição de duas palavras perde só a primeira ("@João Silva" vira "@… Silva").
 */
export function semMencoes(texto: string): { texto: string; trocadas: number } {
  let trocadas = 0
  const saida = texto.replace(/@\S*/g, () => { trocadas += 1; return MARCADOR_DE_MENCAO })
  return { texto: saida, trocadas }
}
