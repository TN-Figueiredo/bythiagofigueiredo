'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { EstadoDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import {
  FRASE_NAO_LEU_O_MES, TEXTO_PARTICAO_AUSENTE, ddmmaaaa, estadoDaLinha, fraseDaFalha, fraseDaFalta, fraseDaLinhaDescartada, fraseDaLinhaDestacada, fraseDaSimulacao,
  fraseDoRetornoDaAcao, nomeDoMes, type Operacao, type RetornoDaAcao,
} from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'
import { InfoDica } from '../../_components/info-dica'
import { Regua } from '../_arquivo/regua'

/** As ações chegam por props (CLAUDE.md: componente cliente não importa server action); o encaixe da Tarefa 12b as passa. */
export type AcoesDaSaida = {
  simular: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  tirar: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  liberar: (tabela: string, mes: string) => Promise<RetornoDaAcao>
  trazer: (tabela: string, mes: string) => Promise<RetornoDaAcao>
}
type Props = {
  tabela: string; mes: string; estado: EstadoDoMes | null; hojeSP: string; pctDoBanco: number | null; ehAdmin: boolean
  /** O nome do dado na tela (“Views por dia”). Com ele o bloco ganha cabeçalho (nome + código pequeno da tabela) e os textos o citam. */
  nome?: string
  /** A espera da política da classe, em dias (`wait_days`, lida pela página). Nulo = a página não a trouxe: o diálogo não inventa uma data. */
  esperaDias?: number | null
  /** O que foi contado AGORA no banco, quando o dado existir. O `exit_check` só confere os portões e não conta canais nem registros: sem a contagem, "não medido" (nunca 0). A conferência com números é "Ver o que sairia". */
  contado?: { canais: number | null; registros: number | null } | null
  acoes: AcoesDaSaida
  /** Só o bloco de ação, sem a frase da linha (a M5 já a escreve; Tarefa 12b). */
  soBloco?: boolean
  /** Quantas simulações a classe exige antes do automático (a peça 4 as conta). Nulo: a frase não cita o número. */
  simulacoesExigidas?: number | null
}
type Fase = 'simulando' | 'tirando' | 'liberando' | 'trazendo'
type Aviso = { tom: 'ok' | 'aviso' | 'erro'; texto: string }
type Qual = 'sair' | 'simular' | 'voltar' | 'apagar'

const maisDias = (dia: string, n: number): string => { const t = Date.parse(`${dia}T12:00:00Z`); return Number.isNaN(t) ? '' : new Date(t + n * 86_400_000).toISOString().slice(0, 10) }
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const SIMBOLO = { ok: '✓', aviso: '▲', erro: '✕' } as const
const TRAVA = 'não dá para remover canal nem apagar vídeo da fila “Saíram do YouTube”.'

type Bloco = readonly [string, ReactNode]
function Dialogo({ titulo, blocos, rotuloOk, onOk, onCancela }: { titulo: string; blocos: readonly Bloco[]; rotuloOk: string; onOk: () => void; onCancela: () => void }): ReactElement {
  const cancelar = useRef<HTMLButtonElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => { cancelar.current?.focus() }, [])
  // Tab fica dentro do diálogo; Esc cancela
  const tecla = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { onCancela(); return }
    if (e.key !== 'Tab') return
    const bs = raiz.current?.querySelectorAll('button'); if (!bs || bs.length === 0) return
    const a = bs[0]!, z = bs[bs.length - 1]!
    if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault() } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault() }
  }
  return (
    <div className="arq-dlg" ref={raiz} role="dialog" aria-modal="true" aria-labelledby={`${id}t`} aria-describedby={`${id}d`} onKeyDown={tecla}>
      <h2 id={`${id}t`}>{titulo}</h2>
      <div id={`${id}d`}>{blocos.map(([t, c]) => <p key={t} className="arq-dlg-b"><b>{t}</b><span>{c}</span></p>)}</div>
      <button type="button" className="arq-btn pesado" onClick={onOk}>{rotuloOk}</button>
      <button type="button" className="arq-btn" ref={cancelar} onClick={onCancela}>Cancelar</button>
    </div>
  )
}

const Mensagem = ({ a, refMsg }: { a: Aviso; refMsg: React.RefObject<HTMLParagraphElement | null> }): ReactElement => (
  <p className={`arq-saida-msg ${a.tom}`} role={a.tom === 'erro' ? 'alert' : 'status'} tabIndex={-1} ref={refMsg}><b aria-hidden="true">{SIMBOLO[a.tom]}</b><span>{a.texto}</span></p>
)

/** O botão com a linha de efeito fixa embaixo, ligada por `aria-describedby`. Desabilitado = `aria-disabled` (continua focável), tracejado e mudo; o clique não faz nada. */
function Acao({ rotulo, efeito, off = false, pesado = false, onClick, info, refBtn }: {
  rotulo: string; efeito: string; off?: boolean; pesado?: boolean; onClick: () => void; info?: ReactElement; refBtn?: React.Ref<HTMLButtonElement>
}): ReactElement {
  const ef = useId()
  return (
    <div className="arq-acao">
      <button type="button" ref={refBtn} className={`arq-btn${pesado && !off ? ' pesado' : ''}`} aria-disabled={off ? 'true' : undefined} aria-describedby={ef} onClick={() => { if (!off) onClick() }}>{rotulo}</button>
      <div className="arq-efl"><small className="arq-ef" id={ef}>{efeito}</small>{info ?? null}</div>
    </div>
  )
}

export function PecaTirarMes({ tabela, mes, estado, hojeSP, pctDoBanco, ehAdmin, nome, esperaDias = null, contado = null, acoes, soBloco, simulacoesExigidas = null }: Props): ReactElement {
  const [fase, setFase] = useState<Fase | null>(null)
  const [dialogo, setDialogo] = useState<'tirar' | 'liberar' | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [simulacao, setSimulacao] = useState<string | null>(null)
  const router = useRouter()
  const origem = useRef<HTMLButtonElement | null>(null)
  const btnSair = useRef<HTMLButtonElement>(null)
  const btnApagar = useRef<HTMLButtonElement>(null)
  const btnSim = useRef<HTMLButtonElement>(null)
  const refMsg = useRef<HTMLParagraphElement>(null)
  const titulo = useId()
  const mesNome = nomeDoMes(mes)
  const C = cap(mesNome)
  const ctx = { mes, doisPassos: estado?.dois_passos ?? true, hoje: hojeSP, pctDoBanco, ...(nome ? { nomeDoDado: nome } : {}) }
  const doDado = nome ? ` de “${nome}”` : ''
  const aoFechar = (): void => { setDialogo(null); origem.current?.focus() }
  useEffect(() => { if (aviso) refMsg.current?.focus({ preventScroll: true }) }, [aviso])

  async function rodar(op: Operacao, f: Fase, fn: (t: string, m: string) => Promise<RetornoDaAcao>, simular = false): Promise<void> {
    setFase(f); setAviso(null); setSimulacao(null)
    try {
      const ret = await fn(tabela, mes)
      if (simular && ret.resposta?.tipo === 'simulado') { setSimulacao(fraseDaSimulacao(ret.resposta, mes, nome)); router.refresh() }   // o contador do automático (servidor) conta esta simulação
      else setAviso(fraseDoRetornoDaAcao(op, ret, ctx))
    } catch {
      setAviso({ tom: 'erro', texto: fraseDaFalha('prazo', op, undefined, mes) })   // a chamada à ação não voltou: pode ter mudado, conferir antes de repetir
    } finally { setFase(null) }
  }

  if (estado === null) return <p>{FRASE_NAO_LEU_O_MES}</p>
  const e = estado
  const ocupado = fase !== null
  const quem = !ehAdmin ? <p>Quem administra o site esconde e apaga um mês.</p> : null
  const retorno = aviso ? <Mensagem a={aviso} refMsg={refMsg} /> : null

  const cabecalho = nome ? <div><h4 id={titulo}>{nome}</h4><span className="arq-tab">{tabela}</span></div> : null
  const moldura = (escondido: boolean, filhos: ReactNode): ReactElement => (
    <article className="arq-bl" aria-labelledby={nome ? titulo : undefined} aria-busy={ocupado}>
      {cabecalho}
      {soBloco && !nome ? null : <p className="arq-mesb"><span className="arq-mesb-r">Mês mais antigo no banco:</span> <b>{C}</b>{escondido ? ' (escondido das telas)' : ''}</p>}
      {filhos}
    </article>
  )

  if (e.estado === 'descartado') return <div>{soBloco ? null : <p>{fraseDaLinhaDescartada(e, pctDoBanco)}</p>}{retorno}</div>
  if (e.particao_ausente) return <div><p>{TEXTO_PARTICAO_AUSENTE}</p>{retorno}</div>

  if (e.estado === 'destacado') {
    const s = estadoDaLinha(e, hojeSP)
    const pode = s !== 'T7'
    const data = ddmmaaaa(e.liberar_a_partir)
    const desde = ddmmaaaa(e.destacado_em)
    return moldura(true, (
      <>
        {soBloco ? null : <p>{fraseDaLinhaDestacada(e, hojeSP, pctDoBanco)}</p>}
        <Regua rotulo={`Caminho de ${mesNome}${doDado}`} etapas={[{ rotulo: 'Escondido das telas', curto: 'Escondido', forma: 'visto' }, { rotulo: 'Apagado do banco', curto: 'Apagado', forma: 'pontilhado' }]} />
        <p className="arq-aviso"><b aria-hidden="true">▲</b><span><b>Escondido, ainda não apagado{desde ? ` (desde ${desde})` : ''}.</b> Enquanto não apagar do banco, {TRAVA}</span></p>
        <p className="arq-passo"><b>Passo 2 de 2:</b> apagar do banco{pode ? ', já disponível.' : data ? ` (a partir de ${data}).` : ' (a data não foi medida).'}</p>
        {ehAdmin ? (
          <div className="arq-ac2">
            <Acao rotulo="Mostrar de novo" refBtn={btnSair} efeito={`${C} volta às telas. Nada se perde.`}
              onClick={() => { origem.current = btnSair.current; void rodar('trazer', 'trazendo', acoes.trazer) }} />
            <Acao rotulo="Apagar do banco" pesado off={!pode || ocupado} refBtn={btnApagar}
              efeito={pode ? `Apaga ${mesNome} do banco do site e libera espaço. Não volta pelo site; a cópia fica no NAS e no B2.` : `Apaga do banco do site e libera espaço. ${data ? `Disponível a partir de ${data}.` : 'A data em que fica disponível não foi medida.'} Não volta pelo site; a cópia fica no NAS e no B2.`}
              info={<InfoDica titulo="Como recuperar um mês apagado" paragrafos={['O mês apagado continua na cópia do NAS e do B2. Não há botão no site: a restauração é manual, com o comando de recuperação.']} />}
              onClick={() => { origem.current = btnApagar.current; setDialogo('liberar') }} />
          </div>
        ) : quem}
        {fase === 'trazendo' || fase === 'liberando' ? <p role="status">{fase === 'liberando' ? 'Conferindo o banco contra o arquivo, depois apagando' : 'Mostrando de novo'}</p> : null}
        {retorno}
        {dialogo === 'liberar' ? (
          <Dialogo
            titulo={`Apagar ${mesNome}${doDado} do banco do site?`} rotuloOk={`Apagar ${mesNome} do banco`}
            onCancela={aoFechar} onOk={() => { setDialogo(null); void rodar('liberar', 'liberando', acoes.liberar) }}
            blocos={[
              ['O que acontece', <>{C} sai do banco do site e o espaço volta. <strong>Depois disso não dá mais para mostrar de novo pelo site.</strong></>],
              ['O que continua', 'O dado continua no NAS e no B2, e só se lê com um comando seu.'],
              ['Como desfazer', 'Não há “Mostrar de novo” depois de apagar. Para ler o mês outra vez, use o comando de recuperação (ver os comandos).'],
              ['Quanto sai', pctDoBanco === null ? 'Quanto isso libera: não medido.' : `Cerca de ${pctDoBanco}% do que ${nome ? `“${nome}”` : 'este tipo de dado'} ocupa.`],
            ]}
          />
        ) : null}
      </>
    ))
  }

  // online (T1/T3)
  const faltas = e.faltam
  const tirarOk = faltas.length === 0
  // a data vem da política da classe; o banco confirma na hora com `liberar_a_partir` depois de esconder
  const quando = esperaDias === null ? null : ddmmaaaa(maisDias(hojeSP, esperaDias))   // nulo: o diálogo cai na frase sem data
  const nCanais = contado?.canais ?? null
  const nRegistros = contado?.registros ?? null
  const quantoSai = nCanais === null || nRegistros === null
    ? <>Nada sai do banco agora. “Ver o que sairia” mostra os números de quando você apagar.</>
    : <>Nada sai do banco agora. Quando você apagar: {nCanais.toLocaleString('pt-BR')} {nCanais === 1 ? 'canal' : 'canais'} e {nRegistros.toLocaleString('pt-BR')} {nRegistros === 1 ? 'registro' : 'registros'} de {mesNome}, conferidos contra o NAS e o B2.</>
  return moldura(false, (
    <>
      {faltas.length > 0 ? (
        <ul className="arq-cond">
          {faltas.map((f, i) => (
            <li key={`${f.codigo}-${i}`}>
              <b aria-hidden="true">{f.codigo === 'ainda_na_janela' ? '●' : '▲'}</b>
              <span>{fraseDaFalta(f, { mes, janelaMeses: 6 })}</span>
            </li>
          ))}
        </ul>
      ) : <p className="arq-fr"><b aria-hidden="true">✓</b><span>Pode sair agora.<small>Cópia no NAS e no B2 conferida hoje.</small></span></p>}
      {e.dois_passos ? <p className="arq-passo"><b>Passo 1 de 2:</b> esconder das telas. <b>Passo 2 de 2,</b> depois do prazo: apagar do banco.</p> : null}
      {ehAdmin ? (
        <div className="arq-ac2">
          <Acao rotulo="Esconder das telas" pesado off={!tirarOk || ocupado} refBtn={btnSair}
            efeito={`${!tirarOk ? `Indisponível até ${faltas.some(f => f.codigo === 'ainda_na_janela') ? 'sair da janela dos 6 meses' : /b2/.test(faltas.map(f => f.codigo).join()) ? 'conferir o B2' : 'resolver o que está acima'}. ` : ''}${C} some das telas; os dados seguem no banco e ${e.dois_passos ? 'dá' : 'não dá'} para mostrar de novo. Enquanto escondido, não dá para remover canal.`}
            onClick={() => { origem.current = btnSair.current; setDialogo('tirar') }} />
          <Acao rotulo="Ver o que sairia" off={ocupado} refBtn={btnSim} efeito="Só calcula canais, registros e % do banco. Nada muda."
            onClick={() => { origem.current = btnSim.current; void rodar('tirar', 'simulando', acoes.simular, true) }} />
        </div>
      ) : quem}
      {simulacao !== null ? <div className="arq-sim" role="status"><p><span className="arq-marca">simulação, nada mudou</span>{simulacao}</p>{simulacoesExigidas === null ? null : <p className="arq-sim-c">Conta como 1 das {simulacoesExigidas} simulações antes do automático.</p>}</div> : null}
      {fase === 'simulando' ? <p role="status">Conferindo o banco contra o arquivo</p> : null}
      {fase === 'tirando' ? (
        <div role="status">
          <p>Conferindo o banco contra o arquivo</p>
          <p>Escondendo</p>
        </div>
      ) : null}
      {retorno}
      {dialogo === 'tirar' ? (
        <Dialogo
          titulo={`Esconder ${mesNome} das telas${doDado}?`} rotuloOk={`Esconder ${mesNome} das telas`}
          onCancela={aoFechar} onOk={() => { setDialogo(null); void rodar('tirar', 'tirando', acoes.tirar) }}
          blocos={[
            ['O que acontece', e.dois_passos
              ? `${C} deixa de aparecer nas telas${doDado}. As curvas passam a começar no mês seguinte. Os outros meses não mudam.`
              : `${C} sai do banco do site${doDado}. Daqui em diante a saída é em um passo só e não há “mostrar de novo”.`],
            ['O que continua', 'Os dados seguem no banco do site, e a cópia completa fica no NAS e no B2.'],
            ['Como desfazer', e.dois_passos
              ? <>“Mostrar de novo”, até você apagar do banco. {quando === null ? 'O botão “Apagar do banco” fica disponível depois da espera da política (a data aparece no bloco).' : `A partir de ${quando} o botão “Apagar do banco” fica disponível.`}</>
              : 'Não volta por este botão. Em “Views por dia”, as primeiras horas ainda podem voltar; os views por dia, não.'],
            ...(e.dois_passos ? [['Enquanto estiver escondido', <strong key="t">{cap(TRAVA)}</strong>] as Bloco] : []),
            ['Quanto sai', quantoSai],
          ]}
        />
      ) : null}
    </>
  ))
}
