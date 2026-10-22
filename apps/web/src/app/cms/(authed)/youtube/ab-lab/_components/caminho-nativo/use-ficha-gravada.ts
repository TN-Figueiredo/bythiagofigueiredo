'use client'
// Estado local da ficha + gravação com CAS (F1a-tela-1, T8). Regras (Yannis M2/R5, Phil C6):
//  - grava ao sair de cada campo e antes de cada ação; `executar` é a FILA: uma mutação por vez, cada uma partindo do
//    `atualizada_em` adotado da anterior (a cópia lenta da A não gera o falso "mudou em outro lugar");
//  - `rascunho = mesclar(fichaAtual, alteradosLocais)` por (n, atributo): dois aparelhos em campos diferentes, os dois sobrevivem;
//  - a n=1 (título e imagem da A) é do servidor: o cliente nunca a manda;
//  - título vazio da B omite a chave `titulo`; o título é contado por grafema, pela MESMA função do servidor.
// SÓ `import type` de `ficha`/`actions-nativo`: esses arquivos puxam código de servidor.
import { useCallback, useRef, useState } from 'react'
import type { FichaLida, FichaRascunho, VarianteFicha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import type { ResultadoAcaoFicha } from '../../actions-nativo'
import { contarCaracteresDoTitulo, LIMITE_TITULO } from '@/lib/youtube/teste-youtube/nativo/titulo'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'

export type Campo = 'titulo' | 'miniatura'
export type ImagemFicha = NonNullable<VarianteFicha['imagem']>
/** `recusado` = o servidor (ou o limite do título) não aceitou; `mensagem` traz a frase. Os outros três vêm do brief. */
export type StatusGravacao = 'salvo' | 'salvando' | 'sem_conexao' | 'mudou' | 'recusado'

export type Alteracao =
  | { atributo: 'campos'; valor: Campo[] }
  | { atributo: 'titulo'; n: number; valor: string }
  | { atributo: 'imagem'; n: number; valor: ImagemFicha }
  | { atributo: 'versao'; n: number }
export type ChaveCampo = 'campos' | `${number}:titulo` | `${number}:imagem` | `${number}:versao`
type Alterados = Partial<Record<ChaveCampo, Alteracao>>

export interface AcoesGravacao {
  salvarFicha: (fichaId: string, lido: string, dados: FichaRascunho) => Promise<ResultadoAcaoFicha>
}

export const chaveDe = (a: Alteracao): ChaveCampo => (a.atributo === 'campos' ? 'campos' : `${a.n}:${a.atributo}`)

const tipoDe = (campos: Campo[]): VarianteFicha['tipo'] => (campos.length === 2 ? 'combo' : campos[0] ?? 'titulo')

/** Mescla por (n, atributo): o que o dono mexeu vence; o resto vem da ficha adotada. */
export function mesclar(ficha: FichaLida, alterados: Alterados): FichaRascunho {
  const campos = (alterados.campos?.atributo === 'campos' ? alterados.campos.valor : ficha.campos) as Campo[]
  const porN = new Map<number, VarianteFicha>(ficha.variantes.map((v) => [v.n, { ...v }]))
  for (const a of Object.values(alterados)) {
    if (!a || a.atributo === 'campos') continue
    const v = porN.get(a.n) ?? { n: a.n, tipo: tipoDe(campos) }
    if (a.atributo === 'titulo') {
      if (a.valor.trim() === '') delete v.titulo
      else v.titulo = a.valor
    } else if (a.atributo === 'imagem') v.imagem = a.valor
    porN.set(a.n, v)
  }
  const variantes = [...porN.values()].sort((x, y) => x.n - y.n).map((v) => ({ ...v, tipo: tipoDe(campos) }))
  return { campos, variantes }
}

/** O que vai ao servidor: sem a n=1 (título e imagem da A são do servidor). */
const paraServidor = (r: FichaRascunho): FichaRascunho => ({ campos: r.campos, variantes: r.variantes.filter((v) => v.n !== 1) })

const iguais = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export interface FichaGravada {
  ficha: FichaLida
  rascunho: FichaRascunho
  status: StatusGravacao
  mensagem: string | null
  alterar: (a: Alteracao) => void
  sair: (campo?: ChaveCampo) => Promise<void>
  salvarAgora: () => Promise<boolean>
  adotar: (f: FichaLida) => void
  executar: <T>(mutacao: (atualizadaEm: string) => Promise<T & { ficha?: FichaLida }>) => Promise<T>
}

export function useFichaGravada(inicial: FichaLida, acoes: AcoesGravacao): FichaGravada {
  const [ficha, setFicha] = useState<FichaLida>(inicial)
  const [alterados, setAlterados] = useState<Alterados>({})
  const [status, setStatus] = useState<StatusGravacao>('salvo')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const fichaRef = useRef<FichaLida>(inicial)
  const alteradosRef = useRef<Alterados>({})
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes

  const adotar = useCallback((f: FichaLida): void => { fichaRef.current = f; setFicha(f) }, [])

  const executar = useCallback(<T,>(mutacao: (atualizadaEm: string) => Promise<T & { ficha?: FichaLida }>): Promise<T> => {
    const rodada = fila.current.then(async () => {
      const r = await mutacao(fichaRef.current.atualizada_em)
      const nova = r?.ficha ?? (r as { fichaAtual?: FichaLida } | undefined)?.fichaAtual
      if (nova) adotar(nova)
      return r as T
    })
    fila.current = rodada.catch(() => undefined)
    return rodada
  }, [adotar])

  const alterar = useCallback((a: Alteracao): void => {
    const proximo = { ...alteradosRef.current, [chaveDe(a)]: a }
    alteradosRef.current = proximo
    setAlterados(proximo)
  }, [])

  const salvarAgora = useCallback(async (): Promise<boolean> => {
    if (Object.keys(alteradosRef.current).length === 0) {
      // Nada a gravar: ainda assim espera a fila, para quem chama antes de uma ação ter a ficha adotada.
      await fila.current
      if (Object.keys(alteradosRef.current).length === 0) return true
    }
    setStatus('salvando')
    const r = await executar<{ ok: boolean }>(async (lido) => {
      const alt = alteradosRef.current
      if (Object.keys(alt).length === 0) return { ok: true }
      const rasc = mesclar(fichaRef.current, alt)
      if (rasc.variantes.some((v) => v.titulo !== undefined && contarCaracteresDoTitulo(v.titulo) > LIMITE_TITULO)) {
        setStatus('recusado'); setMensagem(FRASES.ficha.tituloAcima(LIMITE_TITULO))
        return { ok: false }
      }
      const enviado = alt
      let res: ResultadoAcaoFicha
      try {
        res = await acoesRef.current.salvarFicha(fichaRef.current.id, lido, paraServidor(rasc))
      } catch {
        setStatus('sem_conexao'); setMensagem(null)
        return { ok: false }
      }
      if (res.ok) {
        const resto: Alterados = {}
        for (const [k, v] of Object.entries(alteradosRef.current) as Array<[ChaveCampo, Alteracao]>) {
          if (!iguais(enviado[k], v)) resto[k] = v
        }
        alteradosRef.current = resto
        setAlterados(resto)
        setStatus('salvo'); setMensagem(null)
        return { ok: true, ficha: res.ficha }
      }
      if (res.fichaAtual) {
        setStatus('mudou'); setMensagem(FRASES.mudouEmOutroLugar)
        return { ok: false, ficha: res.fichaAtual }
      }
      setStatus('recusado'); setMensagem(FRASES.ficha.erroSalvar)
      return { ok: false }
    })
    return r.ok
  }, [executar])

  const sair = useCallback(async (_campo?: ChaveCampo): Promise<void> => { await salvarAgora() }, [salvarAgora])

  return { ficha, rascunho: mesclar(ficha, alterados), status, mensagem, alterar, sair, salvarAgora, adotar, executar }
}
