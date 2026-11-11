// A5 · E17 degrau 2 (acesso direto pelo Claude Code): as regras do acesso externo da IA. Um lugar só: a porta, a taxa, o registro,
// a poda, o comando de criar chave e os testes leem estes números daqui.
// Este arquivo NÃO importa `rules.ts` (ciclo): é `rules.ts` que importa este.
// `PERFIL`, `ehDoPerfil`, `ehSoDoPerfil` e `fraseDeVencida` moram em `lib/pipeline/chave.ts` (caminho quente do Cowork e da forja).

export const ACESSO_IA_RULES = {
  porMinuto: 30,
  porDia: 500,
  tetoPorAcao: 60_000,
  /** Teto de caracteres de UMA janela de lista: ~20 mil tokens a 2,2 caracteres por token, abaixo dos ~25 mil por resultado de MCP do Claude Code. O total da ação segue coberto pela paginação. */
  tetoDaJanela: 45_000,
  tetoPacoteDaTela: 30_000,
  canaisNaLista: 200,
  canaisNoComparar: { min: 2, max: 6 },
  /**
   * A5 F2b: canais de uma `serie` com `canal_ids`, em série (sem pool). Decidido pela medida de PRODUÇÃO, não pela fixture: a Q2 de 11/11/2026
   * (`a5/leituras-prod.out`, ação `serie`, origem `mcp`) deu n = 27 chamadas, p50 3.932 ms, p95 5.424 ms, máximo 6.165 ms. Regra do plano: p95 ≤ 7 s → 6 canais
   * em série; de 7 a 11 s → pool de 2 e nova medida; acima, 4 ou 3. Refazer a medida muda este número (e o teste que o prende).
   */
  tetoDeCanaisDaSerie: { canais: 6, medidoEm: '2026-11-11', chamadasMedidas: 27, p95Ms: 5_424 },
  /** Folga do `limiteMs` da `serie` de vários canais: o `responder` para de ler 2 s antes do fim do prazo para ainda montar e devolver a tabela. */
  margemDaTabelaMs: 2_000,
  /** Estimativa de uma leitura de canal na 1ª vez da chamada (depois vale o máximo dos canais já lidos nesta chamada). */
  estimativaPorCanalMs: 8_000,
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
  e19RecusaConferidaEm: '2026-10-25' as string | null,   // e19-t0-48h ok (ACOMPANHAMENTO, 25/10); recusa em main desde 23/10
  /** AAAA-MM-DD do "sim" do dono à pergunta 47; idem. */
  excecaoDaPergunta47Em: '2026-11-09' as string | null,   // "sim" do dono, ledger a5-e17-d2 de 09/11
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
