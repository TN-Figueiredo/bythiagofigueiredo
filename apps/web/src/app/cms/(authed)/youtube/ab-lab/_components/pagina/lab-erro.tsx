'use client'
// Fronteira de erro da página (M7 T5, mockup estado e): a leitura dos testes falhou. Padrão de caminho-nativo/lista-erro.tsx.
// Sentry sem `extra`; o texto do erro nunca aparece na tela.
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'

function Falha({ tentarDeNovo }: { tentarDeNovo: () => void }): ReactElement {
  const router = useRouter()
  return (
    <div className="p-6 space-y-6" role="alert" data-lab-erro="">
      <p className="text-sm font-semibold">Não deu para ler os testes agora.</p>
      <section aria-label="Com você" className="space-y-2">
        <h2 className="text-sm font-semibold">Com você</h2>
        <p className="text-sm text-cms-text-dim">Não dá para saber se há algo com você enquanto os testes não carregam.</p>
        <div className="rounded-lg border border-cms-border p-4 space-y-3">
          <p className="text-sm">Se havia testes rodando, eles seguem; só a leitura falhou.</p>
          <button
            type="button"
            className="btn"
            style={{ minHeight: 44 }}
            onClick={() => { router.refresh(); tentarDeNovo() }}
          >
            Tentar de novo
          </button>
        </div>
      </section>
      <section aria-label="Concluídos" className="space-y-2">
        <h2 className="text-sm font-semibold">Concluídos</h2>
        <p className="text-sm text-cms-text-dim">Os concluídos vêm da mesma leitura dos testes. Use o botão “Tentar de novo” do bloco acima.</p>
      </section>
    </div>
  )
}

interface Props { children: ReactNode }
interface State { falhou: boolean }

export class LabErro extends Component<Props, State> {
  state: State = { falhou: false }
  static getDerivedStateFromError(): State { return { falhou: true } }
  componentDidCatch(error: Error, _info: ErrorInfo): void {
    Sentry.captureException(error, { tags: { area: 'ab-lab-pagina' } })
  }
  render(): ReactNode {
    if (!this.state.falhou) return this.props.children
    return <Falha tentarDeNovo={() => this.setState({ falhou: false })} />
  }
}
