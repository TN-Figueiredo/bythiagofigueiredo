/**
 * A regra única do "meu canal" (design D-C.1 da 11c, no lugar da D16 do plano). PURA e sem dependência de servidor: roda no navegador (a
 * comparação escolhe o lado A padrão com ela) e no servidor (lista de Canais, atalho, linha presa no pé, página do canal).
 */
import { DAY } from '@/lib/youtube/observatorio/time'

/** Canal "ativo" = publicou nos últimos 91 dias (13 semanas, a janela de "parado" do ritmo). */
export const JANELA_ATIVO_DIAS = 91

/** O que a regra precisa de um canal próprio. `ultimo` = data de publicação do vídeo mais novo (qualquer formato; vídeo sem data não conta); `null` se nenhum tem data. */
export interface LinhaPrincipal { id: string; videos: number; ultimo: number | null }

/**
 * O canal próprio padrão, ou `null`. `linhas` vem na ordem do motor (inscritos, maior primeiro, depois nome, depois id).
 * 1. candidatos = canais com vídeos (nenhum: `null`); 2. ativo = `ultimo` conhecido e a menos de 91 dias;
 * 3. a lembrança do dono vale se é candidata E (é ativa OU nenhum candidato é ativo): uma lembrança velha não segura um canal parado
 *    quando já existe um ativo; 4. senão, o de `ultimo` mais recente (sem data por último; empate: a ordem do motor).
 */
export function escolherPrincipal(linhas: readonly LinhaPrincipal[], lembrado: string | null | undefined, agora: number): string | null {
  const candidatos = linhas.filter(l => l.videos > 0)
  if (!candidatos.length) return null
  const ativo = (l: LinhaPrincipal) => l.ultimo != null && agora - l.ultimo <= JANELA_ATIVO_DIAS * DAY
  const lembrada = lembrado ? candidatos.find(l => l.id === lembrado) : undefined
  if (lembrada && (ativo(lembrada) || !candidatos.some(ativo))) return lembrada.id
  let melhor = candidatos[0]!
  for (const l of candidatos) if (l.ultimo != null && (melhor.ultimo == null || l.ultimo > melhor.ultimo)) melhor = l
  return melhor.id
}
