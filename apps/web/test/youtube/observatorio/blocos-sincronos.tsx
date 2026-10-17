// A5 · E5a, Tarefa 21c: o `BlocosDoVideo` real é um componente de servidor ASSÍNCRONO (lê o banco). Os testes antigos que renderizam a página inteira no
// jsdom (`render(await HistoricoPage(...))`) não têm servidor: este stand-in sincrono devolve a mesma tela que a página mostrava antes da 21c
// (o HistoricoScreen puro, com o "Estourou e parou" no lugar de antes), para eles seguirem medindo a moldura, a trilha e a guarda.
import type { ReactNode } from 'react'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import type { HistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

export function BlocosDoVideo({ view, estourou, onAskForja, onCancelForja, onSyncChannel, onPin, onUnpin, pagerNaTrilha }: {
  view: HistoricoView; estourou?: ReactNode } & Pick<Parameters<typeof HistoricoScreen>[0], 'onAskForja' | 'onCancelForja' | 'onSyncChannel' | 'onPin' | 'onUnpin' | 'pagerNaTrilha'>) {
  return <HistoricoScreen view={view} estourou={estourou} onAskForja={onAskForja} onCancelForja={onCancelForja} onSyncChannel={onSyncChannel} onPin={onPin} onUnpin={onUnpin} pagerNaTrilha={pagerNaTrilha} />
}
