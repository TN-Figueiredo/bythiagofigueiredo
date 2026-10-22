'use client'
// Liga os encaixes da `FichaTeste` (T8) ao Studio e ao "Já iniciei" (F1a-tela-1, T9a): "Abrir no Studio", a volta do Studio, o bloco
// "Confirmar" (que sobe ao topo depois da volta) e os erros. Faixas do nosso teste e "Lembrar no computador" são da T9b.
// Toda action que mexe na ficha passa por `ctx.executar` (a fila da ficha) e o `atualizada_em` devolvido é adotado lá.
import { useRef, useState, type ReactElement } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { EntradaFicha } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import type { ResultadoAcaoConfirmar } from '../../actions-nativo'
import type { AcoesCaminho } from './lista-caminho'
import { FichaTeste, type AcoesFicha, type ContextoFicha, type EncaixesFicha, type FichaTesteProps } from './ficha-teste'
import { FichaConfirmar, type FaseFicha } from './ficha-confirmar'
import { Icone } from './icones'
import { useVoltaDoStudio } from './use-volta-do-studio'
import { FaixasFicha, useNossoDaFicha } from './ficha-faixas'
import { RodapeCelular } from './ficha-rodape-celular'

export type AcoesFichaStudio = AcoesFicha & Pick<AcoesCaminho, 'marcarStudioAberto' | 'jaIniciei' | 'lembrarNoComputador' | 'pauseAbTest' | 'retryRestore'>

export interface FichaComStudioProps extends Omit<FichaTesteProps, 'acoes' | 'linha' | 'encaixes'> {
  linha: FichaTesteProps['linha'] & { ytId: string }
  acoes: AcoesFichaStudio
  /** O registro foi gravado: a lista relê (a linha passa a "Em teste no Studio"). */
  aoRegistrar: () => void
  /** "Abrir esse teste" / "Recarregar a ficha". */
  aoAtualizar: () => void
  /** Relê só a lista (sem fechar a ficha): o nosso teste avançou `restore_seq`/`restore_status` e o próximo "Tentar de novo" precisa do valor atual. */
  aoRecarregar?: () => void
  /** Encaixes das outras tarefas (T9b) somados aos daqui. */
  encaixes?: EncaixesFicha
}

const urlDoStudio = (ytId: string): string => `https://studio.youtube.com/video/${encodeURIComponent(ytId)}/edit`

const confirmacaoDe = (f: FaseFicha): EntradaFicha['confirmacao'] => {
  switch (f.tipo) {
    case 'ask': case 'enviando': return 'aberta'
    case 'ainda_nao': return 'ainda_nao'
    case 'erro': return { erro: f.motivo }
    case 'registrada': return 'registrada'
    case 'pergunta': return 'fechada'
    default: { const _x: never = f; return _x }
  }
}

export function FichaComStudio(p: FichaComStudioProps): ReactElement {
  const agora = p.agora ?? ((): Date => new Date())
  const [fase, setFase] = useState<FaseFicha>({ tipo: 'pergunta' })
  const [abriu, setAbriu] = useState(false)
  const [erroAbrir, setErroAbrir] = useState<string | null>(null)
  const abrindo = useRef(false)
  const voltou = useVoltaDoStudio(abriu)
  const nosso = useNossoDaFicha(p.linha.nosso, p.acoes, agora, p.aoRecarregar)
  // A ficha enviada que veio do servidor (outro aparelho, recarga) já faz a pergunta; só o lembrete NÃO conta como Studio aberto.
  const doServidor = p.inicial.enviada && p.inicial.studio_aberto_em !== null
  const studioAberto = doServidor || voltou

  /** `window.open` é a PRIMEIRA coisa do clique (popup depois de `await` é bloqueado no Safari/Firefox); salvar e marcar seguem pela fila. */
  function abrirNoStudio(ctx: ContextoFicha): void {
    if (abrindo.current) return
    abrindo.current = true
    setErroAbrir(null)
    window.open(urlDoStudio(p.linha.ytId), '_blank', 'noopener')
    setAbriu(true)
    void (async () => {
      try {
        if (!(await ctx.salvarAgora())) { setErroAbrir(FRASES.ficha.erroSalvar); return }
        await ctx.executar<Awaited<ReturnType<AcoesFichaStudio['marcarStudioAberto']>>>(() => p.acoes.marcarStudioAberto(ctx.ficha.id))
      } catch { /* a marca do Studio é só memória da tela: a cópia da A é do servidor e nunca aparece ao dono */ }
      finally { abrindo.current = false }
    })()
  }

  const botaoDoTopo = (ctx: ContextoFicha): ReactElement => (
    <div className="cn-next">
      <div className="cn-bacts">
        <button type="button" className={`cn-btn${ctx.vista.primario === 'abrir_studio' ? ' pri' : ''}`} disabled={!ctx.vista.abrirStudioHabilitado}
          onClick={() => abrirNoStudio(ctx)}><Icone nome="ext" />{FRASES.ficha.bloco2.abrirNoStudio}</button>
        {!ctx.vista.abrirStudioHabilitado && ctx.vista.motivoDesabilitado ? <span className="cn-why">{ctx.vista.motivoDesabilitado}</span> : null}
      </div>
      {erroAbrir ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{erroAbrir}</span></p> : null}
    </div>
  )

  const bloco = (ctx: ContextoFicha, noTopo: boolean): ReactElement => (
    <FichaConfirmar
      variante="ficha" fichaId={ctx.ficha.id} noTopo={noTopo}
      studioAbertoEm={studioAberto ? ctx.ficha.studio_aberto_em : null}
      primario={ctx.vista.primario === 'ja_iniciei'} habilitado={ctx.vista.jaIniciouHabilitado} motivoDesabilitado={ctx.vista.motivoDesabilitado}
      fase={fase} setFase={setFase} agora={agora}
      jaIniciei={(id) => ctx.executar<ResultadoAcaoConfirmar>(() => p.acoes.jaIniciei(id))}
      aoRegistrar={p.aoRegistrar} aoAtualizar={p.aoAtualizar} aoVoltarALista={p.fechar}
    />
  )

  const encaixes: EncaixesFicha = {
    ...p.encaixes,
    faixas: (ctx) => <FaixasFicha ctx={ctx} n={nosso} registroDetectado={p.entrada?.registroDetectado ?? null} />,
    rodape: (ctx) => (p.entrada?.criadaEmOutroAparelho || fase.tipo === 'registrada' ? null : <RodapeCelular ctx={ctx} lembrar={p.acoes.lembrarNoComputador} agora={agora} />),
    acaoDoTopo: (ctx) => (ctx.vista.acaoDoTopo === 'confirmar' ? bloco(ctx, true) : ctx.vista.acaoDoTopo === 'abrir_studio' ? botaoDoTopo(ctx) : null),
    abrirNoStudio: (ctx) => (
      <div className="cn-bacts">
        <button type="button" className="cn-lnk" onClick={() => abrirNoStudio(ctx)}>
          {studioAberto ? FRASES.ficha.bloco2.abrirNoStudioDeNovo : FRASES.ficha.bloco2.abrirNoStudio}
        </button>
      </div>
    ),
    confirmar: (ctx) => (ctx.vista.acaoDoTopo === 'confirmar' ? null : bloco(ctx, false)),
  }

  return (
    <FichaTeste
      linha={p.linha} inicial={p.inicial} acoes={p.acoes} fechar={p.fechar} agora={p.agora} largura={p.largura} aoRecomecar={p.aoRecomecar}
      travada={fase.tipo === 'registrada'}
      entrada={{
        ...p.entrada, nosso: p.entrada?.nosso !== undefined ? p.entrada.nosso : nosso.nosso, studioAbertoNestaSessao: studioAberto,
        confirmacao: nosso.pausaAberta && nosso.nosso?.originalDeVolta === 'nao' && nosso.nosso.status === 'active' ? 'aberta' : confirmacaoDe(fase),
      }}
      encaixes={encaixes}
    />
  )
}
