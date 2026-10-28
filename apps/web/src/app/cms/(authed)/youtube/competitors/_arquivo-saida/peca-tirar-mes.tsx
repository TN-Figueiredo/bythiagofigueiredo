'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { EstadoDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import {
  TEXTO_PARTICAO_AUSENTE, ddmmaaaa, estadoDaLinha, fraseDaFalha, fraseDaFalta, fraseDaLinhaDescartada, fraseDaLinhaDestacada, fraseDaSimulacao,
  fraseDoRetornoDaAcao, nomeDoMes, type Operacao, type RetornoDaAcao,
} from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'

/** As ações chegam por props (CLAUDE.md: componente cliente não importa server action); o encaixe da Tarefa 12b as passa. */
export type AcoesDaSaida = {
  simular: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  tirar: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  liberar: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  trazer: (tabela: string, mes: string) => Promise<RetornoDaAcao>
}
type Props = {
  tabela: string; mes: string; estado: EstadoDoMes | null; hojeSP: string; pctDoBanco: number | null; ehAdmin: boolean
  acoes: AcoesDaSaida
  /** Só o bloco de ação, sem a frase da linha (a M5 já a escreve; Tarefa 12b). */
  soBloco?: boolean
}
type Fase = 'simulando' | 'tirando' | 'liberando' | 'trazendo'
type Aviso = { tom: 'ok' | 'aviso' | 'erro'; texto: string }

/** O dia em que o espaço poderá ser liberado se o dono tirar hoje: a espera de 7 dias do mockup (o banco confirma na hora com `liberar_a_partir`). */
const DIAS_ATE_LIBERAR = 7
const maisDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

function Dialogo({ titulo, corpo, rotuloOk, onOk, onCancela }: { titulo: string; corpo: ReactElement; rotuloOk: string; onOk: () => void; onCancela: () => void }): ReactElement {
  const cancelar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelar.current?.focus() }, [])
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onKeyDown={e => { if (e.key === 'Escape') onCancela() }}>
      <h2>{titulo}</h2>
      {corpo}
      <button type="button" className="arq-btn" onClick={onOk}>{rotuloOk}</button>
      <button type="button" className="arq-btn" ref={cancelar} onClick={onCancela}>Cancelar</button>
    </div>
  )
}

function Mensagem({ a }: { a: Aviso }): ReactElement {
  return a.tom === 'erro' ? <p role="alert">{a.texto}</p> : <p role="status">{a.texto}</p>
}

export function PecaTirarMes({ tabela, mes, estado, hojeSP, pctDoBanco, ehAdmin, acoes, soBloco }: Props): ReactElement {
  const [fase, setFase] = useState<Fase | null>(null)
  const [dialogo, setDialogo] = useState<'tirar' | 'liberar' | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [simulacao, setSimulacao] = useState<string | null>(null)
  const nome = nomeDoMes(mes)
  const ctx = { mes, doisPassos: estado?.dois_passos ?? true, hoje: hojeSP, pctDoBanco }

  async function rodar(op: Operacao, f: Fase, fn: (t: string, m: string) => Promise<RetornoDaAcao>, simular = false): Promise<void> {
    setFase(f); setAviso(null); setSimulacao(null)
    try {
      const ret = await fn(tabela, mes)
      if (simular && ret.resposta?.tipo === 'simulado') setSimulacao(fraseDaSimulacao(ret.resposta, mes))
      else setAviso(fraseDoRetornoDaAcao(op, ret, ctx))
    } catch {
      setAviso({ tom: 'erro', texto: fraseDaFalha('prazo', op) })   // a chamada à ação não voltou: pode ter mudado, conferir antes de repetir
    } finally { setFase(null) }
  }

  if (estado === null) return <p>Não foi possível ler o estado deste mês. Nada foi tirado.</p>
  const e = estado
  const ocupado = fase !== null
  const quem = !ehAdmin ? <p>Quem administra o site tira um mês do banco.</p> : null
  const retorno = aviso ? <Mensagem a={aviso} /> : null

  if (e.estado === 'descartado') return <div>{soBloco ? null : <p>{fraseDaLinhaDescartada(e, pctDoBanco)}</p>}{retorno}</div>
  if (e.particao_ausente) return <div><p>{TEXTO_PARTICAO_AUSENTE}</p>{retorno}</div>

  if (e.estado === 'destacado') {
    const s = estadoDaLinha(e, hojeSP)
    const podeLiberar = s !== 'T7'
    return (
      <div aria-busy={ocupado}>
        {soBloco ? null : <p>{fraseDaLinhaDestacada(e, hojeSP, pctDoBanco)}</p>}
        {ehAdmin ? (
          <div>
            <button type="button" className="arq-btn" disabled={ocupado} onClick={() => void rodar('trazer', 'trazendo', acoes.trazer)}>Trazer de volta</button>
            {podeLiberar
              ? <button type="button" className="arq-btn" disabled={ocupado} onClick={() => setDialogo('liberar')}>Liberar o espaço</button>
              : <button type="button" className="arq-btn" aria-disabled="true" disabled>Liberar o espaço (disponível em {ddmmaaaa(e.liberar_a_partir ?? '')})</button>}
          </div>
        ) : quem}
        {fase === 'trazendo' || fase === 'liberando' ? <p role="status">{fase === 'liberando' ? 'Conferindo o banco contra o arquivo, depois liberando' : 'Trazendo de volta'}</p> : null}
        {retorno}
        {dialogo === 'liberar' ? (
          <Dialogo
            titulo={`Liberar o espaço de ${nomeDoMes(mes)}?`} rotuloOk="Liberar o espaço"
            onCancela={() => setDialogo(null)} onOk={() => { setDialogo(null); void rodar('liberar', 'liberando', acoes.liberar) }}
            corpo={<p><strong>Depois disso não dá mais para trazer de volta pelo site.</strong> {pctDoBanco === null ? 'Quanto isso libera: não medido.' : `Isto libera cerca de ${pctDoBanco}% do banco.`} O dado continua no NAS e no B2.</p>}
          />
        ) : null}
      </div>
    )
  }

  // online (T1/T3)
  const faltas = e.faltam
  const tirarOk = faltas.length === 0
  const quando = ddmmaaaa(maisDias(hojeSP, DIAS_ATE_LIBERAR))
  return (
    <div aria-busy={ocupado}>
      {faltas.length > 0 ? (
        <ul>
          {faltas.map((f, i) => (
            <li key={`${f.codigo}-${i}`}>
              <span aria-hidden="true">{f.codigo === 'ainda_na_janela' ? '● ' : '▲ '}</span>
              <span>{fraseDaFalta(f, { mes, janelaMeses: 6 })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {ehAdmin ? (
        <div>
          <button type="button" className="arq-btn" disabled={!tirarOk || ocupado} aria-disabled={!tirarOk || ocupado} onClick={() => setDialogo('tirar')}>Tirar {nome} do banco online</button>
          <button type="button" className="arq-btn" disabled={ocupado} onClick={() => void rodar('tirar', 'simulando', acoes.simular, true)}>Ver o que sairia</button>
        </div>
      ) : quem}
      {simulacao !== null ? <p role="status"><span>simulação, nada foi tirado</span> {simulacao}</p> : null}
      {fase === 'simulando' ? <p role="status">Conferindo o banco contra o arquivo</p> : null}
      {fase === 'tirando' ? (
        <div role="status">
          <p>Conferindo o banco contra o arquivo</p>
          <p>Tirando</p>
        </div>
      ) : null}
      {retorno}
      {dialogo === 'tirar' ? (
        <Dialogo
          titulo={`Tirar ${nome} do banco online?`} rotuloOk={`Tirar ${nome} do banco`}
          onCancela={() => setDialogo(null)} onOk={() => { setDialogo(null); void rodar('tirar', 'tirando', acoes.tirar) }}
          corpo={(
            <>
              <p><strong>Continua:</strong> o mês inteiro, no NAS e no B2. <strong>Para ver de novo:</strong> peça o período em “Ver antigo” (números por mês).</p>
              {e.dois_passos
                ? <p><strong>Em dois passos:</strong> hoje sai das telas; a partir de {quando} você pode liberar o espaço. Dá para trazer de volta a qualquer momento, até você liberar o espaço. <strong>Enquanto o espaço não for liberado, não dá para remover canal nem apagar vídeo da fila “Saíram do YouTube”.</strong></p>
                : <p><strong>Não volta ao banco por este botão.</strong> Daqui em diante a saída é em um passo só e não há “trazer de volta”. Em “Views por dia”, as primeiras horas ainda podem voltar; os views por dia, não.</p>}
            </>
          )}
        />
      ) : null}
    </div>
  )
}
