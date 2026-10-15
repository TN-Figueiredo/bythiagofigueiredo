// A5 · E17 degrau 2 (acesso direto pelo Claude Code): as regras do acesso externo da IA. Um lugar só: a porta, a taxa, o registro,
// a poda, o comando de criar chave e os testes leem estes números daqui.
// Este arquivo NÃO importa `rules.ts` (ciclo): é `rules.ts` que importa este.
// `PERFIL`, `ehDoPerfil`, `ehSoDoPerfil` e `fraseDeVencida` moram em `lib/pipeline/chave.ts` (caminho quente do Cowork e da forja).

export const ACESSO_IA_RULES = {
  porMinuto: 30,
  porDia: 500,
  tetoPorAcao: 60_000,
  tetoPacoteDaTela: 30_000,
  canaisNaLista: 200,
  canaisNoComparar: { min: 2, max: 6 },
  videosNosDestaques: 50,
  pontosDaSerie: 400,
  mudancas: 100,
  validadeDias: 180,
  validadeMaxDias: 366,
  avisoDeVencimentoDias: 14,
  /** Conta PESSOAS com chave ativa, não linhas: renovar (segunda chave da mesma pessoa) não esbarra nele. */
  pessoasComChaveMax: 2,
  prazoPorIdaMs: 5_000,
  prazoDaFerramentaMs: 50_000,
  prazoPorIdaDaPodaMs: 2_500,
  /** É o `maxDuration` da rota `/api/mcp` (em segundos, vezes mil); um teste os prende. */
  tetoDaRequisicaoMs: 60_000,
  reservaDoRegistroMs: 5_000,
  folgaMs: 3_000,
  minimoParaResponderMs: 5_000,
  guardaDoRegistroDias: 400,
  guardaDoContadorDias: 2,
  recusadoNoMaximoACadaMs: 3_600_000,
  fatiaDaPodaDoRegistroDias: 30,
  fatiaDaPodaDoContadorDias: 30,
  /** AAAA-MM-DD; o controlador preenche no dia de abrir (Tarefa 20), depois da conferência da E19 estar no ledger dela. */
  e19RecusaConferidaEm: null as string | null,
  /** AAAA-MM-DD do "sim" do dono à pergunta 47; idem. */
  excecaoDaPergunta47Em: null as string | null,
} as const

/**
 * Quanto tempo a ferramenta pode gastar em `responder`, contado do início da requisição.
 * `null` = não sobrou o mínimo (ou o dado é inválido: negativo, NaN, infinito, acima do teto): não chama.
 * Garante `decorrido + prazo + reservaDoRegistroMs + folgaMs <= tetoDaRequisicaoMs`.
 */
export function prazoDoResponder(decorridoMs: number): number | null {
  const r = ACESSO_IA_RULES
  if (!Number.isFinite(decorridoMs) || decorridoMs < 0 || decorridoMs > r.tetoDaRequisicaoMs) return null
  const sobra = r.tetoDaRequisicaoMs - decorridoMs - r.reservaDoRegistroMs - r.folgaMs
  const prazo = Math.min(r.prazoDaFerramentaMs, sobra)
  return prazo < r.minimoParaResponderMs ? null : prazo
}
