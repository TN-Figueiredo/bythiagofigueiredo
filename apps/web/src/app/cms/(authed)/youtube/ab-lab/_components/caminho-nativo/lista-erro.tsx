'use client'
// Boundary local da lista (F1a-tela-1, T7; Yannis M3): a leitura da lista falhar não derruba o painel dos testes que já funcionam.
// Sentry sem `extra` (nada de título de vídeo); o texto do erro nunca aparece na tela.
import { Component, type ContextType, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ContextoAssistente } from './assistente-contexto'
import '../caminho-nativo.css'
import '../lista-caminho.css'

interface Props { children: ReactNode }
interface State { falhou: boolean }

export class ListaErro extends Component<Props, State> {
  static contextType = ContextoAssistente
  declare context: ContextType<typeof ContextoAssistente>
  state: State = { falhou: false }
  static getDerivedStateFromError(): State { return { falhou: true } }
  componentDidCatch(error: Error, _info: ErrorInfo): void {
    Sentry.captureException(error, { tags: { area: 'ab-lista' } })
    // Lista em erro: as portas do "Iniciar teste" abrem sem perguntar (falha aberta aceita).
    this.context.registrarErro()
  }
  render(): ReactNode {
    if (!this.state.falhou) return this.props.children
    return (
      <section className="cn-raiz" aria-label="Vídeos do A/B Lab">
        <p className="cn-sum" role="alert">{FRASES.lista.leituraFalhou}</p>
      </section>
    )
  }
}
