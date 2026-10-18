// A5 · E17 degrau 1, portão do N3 (Yannis Y2 / Phil C3): a mensagem técnica CRUA da coleta (`competitor_channels.sync_error`) que `humanizeSyncError`
// não reconhece nunca vai à IA de terceiro. Mudar o motor mudaria a tela (e quem administra precisa do detalhe); então a troca é aqui, no modelo do pacote,
// ANTES de `segmentar` (depois dele `naCelula` já escapou o `|` e a busca por substring falharia). Função pura; devolve uma cópia.
import { ERRO_DA_COLETA_SEM_DETALHE } from './frases'
import type { Celula, PacoteModelo, Tabela } from './tipos'

export function mascararCrus(m: PacoteModelo, crus: readonly string[]): PacoteModelo {
  // o mais longo primeiro: um cru que contém outro não deixa resto
  const lista = [...new Set(crus.filter((c) => c !== ''))].sort((a, b) => b.length - a.length)
  if (lista.length === 0) return m
  const t = (s: string): string => lista.reduce((acc, c) => acc.split(c).join(ERRO_DA_COLETA_SEM_DETALHE), s)
  const tn = (s: string | null): string | null => (s === null ? null : t(s))
  const celula = (c: Celula): Celula => {
    if (c.papel === 'numero') return c.estado === 'nao_medido' || c.estado === 'falhou' || c.estado === 'restrito' ? { ...c, motivo: t(c.motivo) } : { ...c, texto: t(c.texto) }
    return { ...c, texto: t(c.texto) }
  }
  const tabela = (x: Tabela): Tabela => ({ ...x, linhas: x.linhas.map((l) => l.map(celula)) })
  return {
    ...m,
    janela: t(m.janela),
    foco: m.foco.map((f) => ({ ...f, detalhe: t(f.detalhe) })),
    tabelas: m.tabelas.map(tabela),
    citados: m.citados.map((c) => ({ ...c, texto: t(c.texto) })),
    definicoes: m.definicoes.map((d) => ({ ...d, frase: t(d.frase), limiares: d.limiares.map(t) })),
    avisos: m.avisos.map(t),
    ...(m.avisosPrivados ? { avisosPrivados: m.avisosPrivados.map(t) } : {}),
    naoMede: m.naoMede.map(t),
    vazio: tn(m.vazio),
    motivoDoMagro: tn(m.motivoDoMagro),
  }
}
