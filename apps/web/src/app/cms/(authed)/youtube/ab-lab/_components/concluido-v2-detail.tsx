'use client'

// Teste v2 concluído pela regra (S8-F4 T12, T7): resumo, desfecho, régua final e placar. Aplicar e Voltar à original só reusam as actions.
// Sucesso = `resultado === 'feito'` (precisa_confirmar também é ok:true e NÃO é sucesso).
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestDetailView } from '@/lib/youtube/ab-types'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import { MSG_EM_ANDAMENTO, MSG_MUDOU, MSG_OUTRO_TESTE, type ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { DetailHeader } from './detail-header'
import { ResumoV2, PisosV2, DesfechoV2 } from './blocos-v2'
import { PlacarDoTeste } from './placar-do-teste'
import { AbConfirmarDialog } from './ab-confirmar-dialog'
import { AbConfirmarTrocaDialog } from './ab-confirmar-troca-dialog'
import { dadosDoDialogoEncerrar, dataCurtaSp } from './encerrar-props'
import type { CampoNome } from '@/lib/youtube/ab-restore'

type Concluido = Extract<TelaV2, { fase: 'concluido' }>
type Pendencia = Array<{ campo: CampoNome; valor_atual: string }>

export interface ConcluidoV2DetailProps {
  view: AbTestDetailView & { v2: Concluido }
  /** `aplicarSugerido` com o id do teste, montada em page.tsx (nunca importada aqui). */
  aplicar: (varianteId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoAcaoSaida>
  /** `revertWinner` com o id do teste, idem. */
  voltar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
}

const MSG_RECARREGUE = 'O teste mudou desde que você abriu a página. Recarregue para ver o estado atual.'
const MSG_PRAZO_VOLTAR = 'O prazo de 7 dias para voltar acabou.'
const MSG_VOLTA_NAO_CONCLUIDA = 'Não consegui concluir a volta. Recarregue a página para ver o estado atual.'
const MSG_SEM_RESPOSTA = 'Sem resposta. Recarregue a página para ver o resultado.'

/** Texto do que muda no YouTube, conforme o que o teste varia (miniatura, título ou os dois). */
function oQueMuda(flag: string, volta: boolean): string {
  if (flag === 'combo') return volta ? 'A miniatura e o título voltam a ser os de A agora no YouTube.' : 'A miniatura e o título mudam agora.'
  if (flag === 'title') return volta ? 'O título volta a ser o de A agora no YouTube.' : 'O título muda agora.'
  return volta ? 'A miniatura volta a ser a de A agora no YouTube.' : 'A miniatura muda agora no YouTube.'
}

type Dialogo = null | 'aplicar' | 'voltar' | 'troca'

export function ConcluidoV2Detail({ view, aplicar, voltar }: ConcluidoV2DetailProps) {
  const router = useRouter()
  const tela = view.v2
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<{ texto: string; recarregar: boolean; prazo: boolean } | null>(null)
  const [pendencia, setPendencia] = useState<Pendencia | null>(null)
  const [focoNoAr, setFocoNoAr] = useState(false)
  const [isPending, startTransition] = useTransition()
  const voo = useRef(false)
  const noArRef = useRef<HTMLDivElement>(null)

  // Y9: o foco vai para a linha "No ar agora" quando o refresh termina (a linha já é a nova).
  useEffect(() => {
    if (focoNoAr && !isPending) {
      noArRef.current?.focus()
      setFocoNoAr(false)
    }
  }, [focoNoAr, isPending])

  const fechar = useCallback(() => { setDialogo(null); setErro(null); setPendencia(null) }, [])
  const recarregar = useCallback(() => { router.refresh(); fechar() }, [router, fechar])

  const revertExpiresAt = 'revertExpiresAt' in view ? (view.revertExpiresAt ?? null) : null

  const executar = useCallback(async (tipo: 'aplicar' | 'voltar', forcar: boolean) => {
    if (voo.current) return
    if (tipo === 'voltar' && revertExpiresAt && Date.parse(revertExpiresAt) <= Date.now()) {
      setErro({ texto: MSG_PRAZO_VOLTAR, recarregar: false, prazo: true })
      return
    }
    const alvo = tela.aplicar
    if (tipo === 'aplicar' && !alvo) return
    voo.current = true
    setEnviando(true)
    setErro(null)
    try {
      let r: ResultadoAcaoSaida
      try {
        r = tipo === 'aplicar'
          ? (forcar ? await aplicar(alvo!.variant_id, view.restoreSeq, true) : await aplicar(alvo!.variant_id, view.restoreSeq))
          : await voltar(view.restoreSeq)
      } catch {
        setErro({ texto: MSG_SEM_RESPOSTA, recarregar: true, prazo: false })
        return
      }
      if (r.ok && r.resultado === 'feito') {
        fechar()
        setFocoNoAr(true)
        startTransition(() => router.refresh())
        return
      }
      if (r.ok && r.resultado === 'precisa_confirmar' && tipo === 'aplicar') {
        setPendencia(r.campos)
        setDialogo('troca')
        return
      }
      if (r.ok) { setErro({ texto: tipo === 'voltar' ? MSG_VOLTA_NAO_CONCLUIDA : MSG_RECARREGUE, recarregar: true, prazo: false }); return }
      if (r.resultado === 'ja_encerrado') {
        setErro(r.error === MSG_OUTRO_TESTE ? { texto: r.error, recarregar: false, prazo: false } : { texto: MSG_RECARREGUE, recarregar: true, prazo: false })
        return
      }
      if (r.resultado === 'mudou') { setErro({ texto: MSG_MUDOU, recarregar: false, prazo: false }); return }
      if (r.resultado === 'em_andamento') { setErro({ texto: MSG_EM_ANDAMENTO, recarregar: false, prazo: false }); return }
      setErro({ texto: r.error, recarregar: false, prazo: false })
    } finally {
      voo.current = false
      setEnviando(false)
    }
  }, [aplicar, voltar, tela.aplicar, view.restoreSeq, revertExpiresAt, router, fechar])

  const { opcoes } = dadosDoDialogoEncerrar(view)
  const opcao = tela.aplicar ? opcoes.find(o => o.id === tela.aplicar!.variant_id) ?? null : null
  const concluidoEm = view.completedAt ? dataCurtaSp(view.completedAt).slice(0, 5) : undefined
  const provisorio = tela.selo.tipo === 'vence' && tela.selo.provisorio

  return (
    <div data-testid="concluido-v2-detail">
      <div data-section="header">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          lab={{ thumbUrl: view.variantThumbs.find(t => t.isOriginal)?.thumbUrl ?? view.variantThumbs[0]?.thumbUrl ?? null, concluidoEm }}
        />
      </div>

      <div className="cn-raiz pv2 mb-[8px]" data-testid="tela-v2">
        <ResumoV2 frase={tela.frase} />
        <DesfechoV2
          tela={tela}
          noArRef={noArRef}
          onAplicar={() => { setErro(null); setDialogo('aplicar') }}
          onVoltar={() => { setErro(null); setDialogo('voltar') }}
          onTentarDeNovo={() => router.refresh()}
        />
        {tela.pisos ? <PisosV2 linhas={tela.pisos} n={tela.n} final /> : null}
      </div>

      <section data-section="variant-performance" className="mb-[24px]">
        <PlacarDoTeste
          placar={view.placar ?? null}
          faixaDias={view.faixa_dias ?? []}
          variants={view.variants}
          variantDb={view.variantDb}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          status={view.status}
          modoV2
        />
      </section>

      {dialogo === 'aplicar' && tela.aplicar ? (
        <AbConfirmarDialog
          titulo={`Aplicar ${tela.aplicar.letra} ao vídeo?`}
          lead={oQueMuda(view.flag, false)}
          nota={provisorio ? 'O desfecho ainda é provisório.' : null}
          rotuloConfirmar={`Aplicar ${tela.aplicar.letra}`}
          enviando={enviando}
          erro={erro?.texto ?? null}
          acaoSegura={erro?.recarregar ? { rotulo: 'Recarregar', onClick: recarregar } : null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('aplicar', false) }}
        />
      ) : null}
      {dialogo === 'voltar' ? (
        <AbConfirmarDialog
          titulo="Voltar à original (A)?"
          lead={oQueMuda(view.flag, true)}
          nota="O resultado do teste não muda e continua visível aqui."
          rotuloConfirmar="Sim, voltar à original"
          enviando={enviando}
          erro={erro?.texto ?? null}
          acaoSegura={erro?.prazo ? { rotulo: 'Fechar', onClick: fechar } : erro?.recarregar ? { rotulo: 'Recarregar', onClick: recarregar } : null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('voltar', false) }}
        />
      ) : null}
      {dialogo === 'troca' && pendencia && opcao && tela.aplicar ? (
        <AbConfirmarTrocaDialog
          campos={pendencia}
          opcao={opcao}
          rotuloConfirmar={`Aplicar ${tela.aplicar.letra} mesmo assim`}
          enviando={enviando}
          erro={erro?.texto}
          acaoSegura={erro?.recarregar ? { rotulo: 'Recarregar', onClick: recarregar } : null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('aplicar', true) }}
        />
      ) : null}
    </div>
  )
}
