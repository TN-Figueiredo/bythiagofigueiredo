// A5 · E17 degrau 1, Tarefa 1: o registro das onze telas do Observatório que ganham o botão "Perguntar a uma IA".
// `nome` e `exemplos` são os de `pi-dados.js` do mockup 22 (campos `nome` e `sug` de cada tela), copiados letra por letra; um teste os confere.
import type { TelaId } from './tipos'

export interface TelaIa {
  nome: string
  /** Pasta em `competitors/` ('' para Canais); `null` quando a página ainda não existe. */
  rota: string | null
  pedeId: boolean
  estado: 'existe' | 'espera_a_tela'
  exemplos: readonly [string, string] | readonly [string]
}

export const TELAS_IA: Record<TelaId, TelaIa> = {
  canais: { nome: 'Canais', rota: '', pedeId: false, estado: 'existe', exemplos: ['Quais canais estão subindo?', 'Qual canal eu devo olhar primeiro?'] },
  canal: { nome: 'Canal', rota: 'canal/[id]', pedeId: true, estado: 'existe', exemplos: ['O que este canal publica mais?', 'Há algo nos lançamentos que merece atenção?'] },
  video: { nome: 'Vídeo', rota: 'video/[id]', pedeId: true, estado: 'existe', exemplos: ['O que os comentários elogiam e o que criticam?', 'Este vídeo está acima do normal do canal?'] },
  comparar: { nome: 'Comparar', rota: 'comparar', pedeId: false, estado: 'existe', exemplos: ['Qual dos dois está crescendo mais?', 'O que eu ainda não consigo afirmar com estes números?'] },
  outliers: { nome: 'Outliers', rota: 'outliers', pedeId: false, estado: 'existe', exemplos: ['O que estes vídeos têm em comum?', 'Isso muda o que eu devo publicar?'] },
  insights: { nome: 'Insights', rota: 'insights', pedeId: false, estado: 'existe', exemplos: ['O nicho está subindo ou descendo?', 'Onde o meu canal está nisso?'] },
  mudancas: { nome: 'Mudanças', rota: 'mudancas', pedeId: false, estado: 'existe', exemplos: ['Quem mexeu mais em títulos?', 'O que mudou antes de um vídeo subir?'] },
  fila: { nome: 'Saíram do YouTube', rota: null, pedeId: false, estado: 'espera_a_tela', exemplos: ['Há algo nesta fila que eu deveria manter?'] },
  // As duas próprias dividem a rota com Canal e Vídeo e passam a `existe` nas Tarefas 7a e 7b.
  'canal-proprio': { nome: 'Canal próprio', rota: 'canal/[id]', pedeId: true, estado: 'espera_a_tela', exemplos: ['O que melhorou nos meus últimos vídeos?', 'O que ainda não dá para medir?'] },
  'video-proprio': { nome: 'Vídeo próprio', rota: 'video/[id]', pedeId: true, estado: 'espera_a_tela', exemplos: ['A miniatura está funcionando?', 'O que os comentários pedem?'] },
  ritmo: { nome: 'Ritmo por hora', rota: null, pedeId: false, estado: 'espera_a_tela', exemplos: ['Qual a melhor faixa de hora para publicar?', 'O que este perfil não consegue dizer?'] },
}

export const telaExiste = (t: unknown): t is TelaId => typeof t === 'string' && Object.prototype.hasOwnProperty.call(TELAS_IA, t)
