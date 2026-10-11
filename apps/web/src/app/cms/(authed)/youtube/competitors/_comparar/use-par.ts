'use client'
/**
 * O par da comparação na URL (spec 18.1): `?a=&b=`, espelhado com `history.replaceState`, sem navegar e sem router. O pacote já tem
 * todos os canais, então trocar um seletor ou "Inverter lados" não vai à rede. No modelo de `_canal/use-canal-state.ts`:
 * - O Next 16 NÃO remonta o componente quando só a query muda: o estado que nasce da URL é ressincronizado por VALOR do `inicial`
 *   (uma rerrenderização do servidor com a mesma query não desfaz a escolha local).
 * - A URL é a fonte da verdade: o `inicial` pode vir velho (o Voltar até uma entrada que `replaceState` reescreveu devolve o RSC da
 *   query anterior). Por isso o efeito relê a URL; `inicial` só vale quando a URL não diz nada.
 * - Voltar e Avançar (`popstate`) releem a URL, só enquanto o pathname é o da comparação, e nunca escrevem nela. Par inválido (id de outro site, inventado, em maiúsculas, `a === b`, ausente) cai no
 *   padrão de `resolverPar`, sem mensagem de erro.
 * - A URL é conforto: se o navegador recusar (`history` que lança), a tela já mudou.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CompararPack } from './pack'
import { resolverPar } from './par-model'

export interface ParIds { a: string; b: string }

/** Escreve o par na URL atual sem navegar e sem criar entrada no histórico; os outros parâmetros ficam. */
function escreverUrl(par: ParIds): void {
  try {
    const q = new URLSearchParams(window.location.search)
    q.set('a', par.a); q.set('b', par.b)
    window.history.replaceState(null, '', window.location.pathname + '?' + q.toString() + window.location.hash)
  } catch { /* a URL é conforto */ }
}

/** O par que a URL do navegador diz, já válido; `null` quando a URL não tem `a` nem `b` (aí vale o `fallback`). */
function lerUrl(pack: CompararPack): ParIds | null | 'vazia' {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('a') && !q.has('b')) return 'vazia'
  return resolverPar(pack, q.get('a') ?? undefined, q.get('b') ?? undefined)
}

const mesmo = (x: ParIds, y: ParIds) => x.a === y.a && x.b === y.b
/** A URL já é a canônica do par? */
function urlCanonica(par: ParIds): boolean {
  const q = new URLSearchParams(window.location.search)
  return q.get('a') === par.a && q.get('b') === par.b
}

export function usePar(pack: CompararPack, inicial: ParIds): ParIds & { trocar(lado: 'a' | 'b', id: string): void; inverter(): void } {
  const [par, setPar] = useState<ParIds>(inicial)
  // o último par, lido na hora: dois comandos seguidos no mesmo evento não perdem o primeiro
  const ref = useRef(par)
  const packRef = useRef(pack)
  packRef.current = pack
  const aplicar = useCallback((next: ParIds) => {
    ref.current = next
    setPar(next)
    escreverUrl(next)
  }, [])

  const trocar = useCallback((lado: 'a' | 'b', id: string) => {
    const atual = ref.current, outro = lado === 'a' ? atual.b : atual.a
    // a opção do outro lado está desabilitada; um id que não é deste pacote também não vira par
    if (id === outro || id === atual[lado] || !packRef.current.canais.some(c => c.id === id)) return
    aplicar(lado === 'a' ? { a: id, b: atual.b } : { a: atual.a, b: id })
  }, [aplicar])
  const inverter = useCallback(() => aplicar({ a: ref.current.b, b: ref.current.a }), [aplicar])

  // O servidor manda um `inicial` novo quando a navegação muda a query (Link para ?a=&b=, Voltar): compara por VALOR. Layout effect: o
  // par certo entra antes da primeira pintura. A primeira vez também normaliza a URL (sem `redirect` no servidor: custaria outra carga).
  const chave = `${inicial.a}|${inicial.b}`
  const chaveAnterior = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (chaveAnterior.current === chave) return
    chaveAnterior.current = chave
    const daUrl = lerUrl(pack)
    const alvo = daUrl === 'vazia' || daUrl === null ? inicial : daUrl
    if (!mesmo(alvo, ref.current)) { ref.current = alvo; setPar(alvo) }
    if (!urlCanonica(alvo)) escreverUrl(alvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave (o valor de `inicial`) é o gatilho; o que vale é a URL
  }, [chave])

  // Voltar e Avançar do navegador: a URL é a verdade, e o `popstate` só LÊ (como `use-canal-state`). Ao apertar Voltar para fora da comparação
  // (a lista de Canais, por exemplo) o evento chega com este componente ainda montado e `window.location` já é a do DESTINO: lê-la aqui e
  // gravar `a` e `b` nela sujaria a URL de outra página. Só vale enquanto o pathname é o da comparação; e nunca se escreve.
  useEffect(() => {
    const caminho = window.location.pathname
    const onPop = () => {
      if (window.location.pathname !== caminho) return
      const q = new URLSearchParams(window.location.search)
      const next = resolverPar(packRef.current, q.get('a') ?? undefined, q.get('b') ?? undefined) ?? ref.current
      ref.current = next
      setPar(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return { a: par.a, b: par.b, trocar, inverter }
}
