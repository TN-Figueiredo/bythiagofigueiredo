// A porta do acesso externo da IA (plano, 4.2): toda requisição com chave do perfil passa por aqui ANTES de qualquer servidor MCP e de
// qualquer leitura de dado. A ordem não muda:
//   1 perfil exato  2 as três travas  3 pessoa  4 validade  5 a pessoa existe, não está banida e não pediu apagamento
//   6 `can_view_site_as`.  O passo 7 (direito privado) é da rota, depois da prova (`provarAcessoPrivadoDaChave`).
// Os passos 1 a 4 não tocam o banco; o cliente de serviço só nasce no 5 (em `pessoa.ts`). A busca da chave (passo 0) é do ponto único.
// Nunca fabrica prova num caminho de recusa: o fabricante só é chamado na última linha.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { ehSoDoPerfil, fraseDeVencida, type ChaveLida } from '@/lib/pipeline/chave'
import { FRASES } from './frases'
import { acessoExternoLigado } from './interruptor'
import { estadoDaPessoa, pediuApagamento, veOSite } from './pessoa'
import { fabricarProva, type ChaveDoPerfilProvada } from './prova'

export type Recusa = {
  status: 401 | 403 | 503
  frase: string
  /** Vira uma linha `recusado` no registro (no máximo uma por hora por chave): só quando há pessoa e site a quem atribuir. */
  registrar: boolean
  motivo: 'misto' | 'desligado' | 'sem_pessoa' | 'sem_validade' | 'vencida' | 'sem_acesso' | 'nao_conferido'
  /** Presente só quando `registrar = true`: é o que vai em `params` da linha `recusado`. */
  desfecho?: 'banida' | 'ausente' | 'apagamento_pedido' | 'sem_vinculo'
}

export type ResultadoDaPorta = { ok: true; prova: ChaveDoPerfilProvada } | { ok: false; recusa: Recusa }

const recusar = (recusa: Recusa): ResultadoDaPorta => ({ ok: false, recusa })

/** 503 "não foi possível conferir": nada de acusar a pessoa, nada de linha no registro; o código do erro vai ao Sentry (sem id nem dado). */
function naoConferido(passo: 'pessoa' | 'apagamento' | 'vinculo', code: string): ResultadoDaPorta {
  Sentry.captureMessage('acesso-ia: não foi possível conferir o acesso', { level: 'error', tags: { component: 'acesso-ia', step: `porta-${passo}`, code } })
  return recusar({ ...FRASES.nao_conferido, motivo: 'nao_conferido', registrar: false })
}

/**
 * `vencida` vem de `ctx.vencida` (ponto único da chave), nunca de uma comparação refeita na rota. `agora` é o relógio da requisição.
 * Recusa sem registro: `registrar = false`. Recusa com registro leva `desfecho`.
 */
export async function abrirPorta(chave: ChaveLida, vencida: boolean, agora: number, env?: NodeJS.ProcessEnv): Promise<ResultadoDaPorta> {
  // 1. perfil exato (perfil misto, ou chave que nem é do perfil, é recusada)
  if (!ehSoDoPerfil(chave.permissions)) {
    Sentry.captureMessage('acesso-ia: chave de perfil misto recusada', { level: 'warning', extra: { keyId: chave.id } })
    return recusar({ ...FRASES.misto, motivo: 'misto', registrar: false })
  }
  // 2. as três travas (a variável é lida a cada requisição; sem `env`, de process.env)
  const travas = env === undefined ? acessoExternoLigado() : acessoExternoLigado(env)
  if (!travas.ligado) return recusar({ ...FRASES.desligado, motivo: 'desligado', registrar: false })
  // 3. pessoa
  if (chave.userId === null) return recusar({ ...FRASES.sem_pessoa, motivo: 'sem_pessoa', registrar: false })
  // 4. validade
  if (chave.expiresAt === null) return recusar({ ...FRASES.sem_validade, motivo: 'sem_validade', registrar: false })
  if (vencida) return recusar({ status: 401, frase: fraseDeVencida(chave.expiresAt), motivo: 'vencida', registrar: false })

  // 5. a pessoa existe, não está banida e não tem pedido de apagamento confirmado. As duas leituras são independentes (o banimento é
  //    de melhor esforço), então saem juntas; o definitivo vale mais que o inconclusivo.
  const userId = chave.userId
  const [pessoa, apagamento] = await Promise.all([estadoDaPessoa(userId, { agora }), pediuApagamento(userId)])
  if (pessoa.estado === 'banida' || pessoa.estado === 'ausente') {
    return recusar({ ...FRASES.sem_acesso, motivo: 'sem_acesso', registrar: true, desfecho: pessoa.estado })
  }
  if (apagamento === 'sim') {
    return recusar({ ...FRASES.sem_acesso, motivo: 'sem_acesso', registrar: true, desfecho: 'apagamento_pedido' })
  }
  if (pessoa.estado === 'nao_conferido') return naoConferido('pessoa', pessoa.code ?? 'desconhecido')
  if (apagamento === 'nao_conferido') return naoConferido('apagamento', 'leitura')

  // 6. o vínculo com o site, com o user_id e o site_id da linha da chave
  const vinculo = await veOSite(userId, chave.siteId)
  if (vinculo === 'nao') return recusar({ ...FRASES.sem_acesso, motivo: 'sem_acesso', registrar: true, desfecho: 'sem_vinculo' })
  if (vinculo === 'nao_conferido') return naoConferido('vinculo', 'rpc')

  return { ok: true, prova: fabricarProva(chave.siteId, userId, chave.id, chave.expiresAt) }
}
