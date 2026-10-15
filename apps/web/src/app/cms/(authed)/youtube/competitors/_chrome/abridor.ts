// O abridor (E17 degrau 2, plano 4.7): as três portas de entrada de dado das telas do Observatório, como um tipo. `ABRIDOR_DE_SESSAO` é o de hoje
// (guarda de sessão, redirect, cookie e preferência por usuário). O abridor da chave (`_acesso-ia/abrir-por-chave.ts`) chama os mesmos carregadores
// com o site e a pessoa DA PROVA, sem sessão. Os empacotadores recebem um `Abridor` com o de sessão como padrão (Tarefa 8b).
import 'server-only'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { acessoPrivado } from '../_proprio/dados'
import { openChannelPage, openObservatoryPage, type ChannelPage, type ObservatoryPage } from './page-data'

export interface Abridor {
  observatorio<T = undefined>(extra?: (siteId: string) => Promise<T>): Promise<ObservatoryPage<T>>
  canal(channelId: string): Promise<ChannelPage>
  acessoPrivado(siteId: string): Promise<AcessoPrivado>
}

export const ABRIDOR_DE_SESSAO: Abridor = {
  observatorio: openObservatoryPage,
  canal: openChannelPage,
  acessoPrivado,
}
