# M7 — Página do A/B Lab reordenada: plano de implementação (r3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página `/cms/youtube/ab-lab` passa a abrir, nesta ordem: cabeçalho com frase, faixa "Com você", "Em teste agora", Sugestões (só quando houver), "Concluídos" (vencedor e "no ar desde") e "Vídeos do canal" recolhido com busca no servidor; com o painel "O que fica no vídeo?" e o diálogo "O que o Studio mostrou?" do dia 14. Só tela, sem migration.

**Architecture:** Toda decisão de conteúdo sai de módulos PUROS em `apps/web/src/lib/youtube/ab-lab-pagina/` (entram os testes, as linhas do caminho e os dias do placar já lidos; sai o modelo da página). Uma borda de servidor (`pagina-borda.ts`) lê o banco uma vez, dentro de um `<Suspense>` da página, e entrega o modelo ao cliente. Os componentes de cliente só desenham o modelo e chamam as actions recebidas por props (as que já existem: `endAbTest`, `aplicarSugerido`, `revertWinner`, `responderTesteDoYouTube`, `mudarRespostaDoTesteDoYouTube`, mais a action nova de leitura `lerVideosDoCanal`).

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript 5 strict, Tailwind 4 + tokens `cms-*`, Zod, Vitest + Testing Library (jsdom/happy-dom), Supabase (service client só na borda).

**Spec (o que este plano implementa; o executor lê os dois):**
- Mockup aprovado pelo dono em 26/10 (r5): `docs/superpowers/mockups/2026-10-26-lab-reordem/index.html` — abrir com `?estado=<a|b|b2|c|d|e|f|g|g1|g2|g3|h|h2|i>&largura=<1440|390>`.
- Decisões e escopo: `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/lab-reordem/sintese-r1.md` (decisões do dono no fim), `hanna-r4.md` (critérios de aceite M7-a..d), `logan-r4.md`, `logan-mockup-r4.md`, `naksu-mockup-r4.md`.

## Dois envios e ordem obrigatória (r2, decisão de Hanna; consertos de Yannis; r3 com as emendas R1 a R4 de Yannis e os desvios 5 e 6 decididos)

**Envio 1 — achados do dono de 26/10 (Tasks 17 → 15, 16, 18).** Só arquivos que já existem; não toca a página do Lab nem depende das Tasks 1 a 6. Verificação curta no fim (typecheck + `npx vitest run test/ab-` + `npm run build:web`; é a Task 12 reduzida), revisão de Yannis só sobre o diff da Task 16 (query nova do seletor; Sonnet basta), prova do Gio limitada ao parágrafo "Gio, na Task 14, também confere" (fim da seção "Ajustes do assistente"). Depois, push e promoção. Estimativa do envio: ~250K de tarefas + ~25K de verificação + ~30K da revisão de Yannis + ~60K da prova do Gio = **~365K tokens**.

**Envio 2 — a reordem (Tasks 1 a 14).** Estimativa r3: **~1,84M tokens** (T1 60K, T2 120K, T3 80K, T4 130K, T5 160K, T6 185K, T7 150K, T8 175K, T9 90K, T10 155K, T11 160K, T12 40K, T13 205K, T14 130K; a r2 dizia ~1,73M, a diferença de ~110K é a soma das emendas R1 a R4, dos menores de Yannis/Phil e dos desvios 5 e 6). O envio 1 não muda (~365K). O envio 2 só começa depois do envio 1 estar no staging (a T7 consome `rotuloDoDia`).

**Ordem de execução (dependências explícitas; cada seta é obrigatória):**
- Envio 1: `T17 → T15 → T16 → T18` (T17 primeiro por causa de `rotuloDoDia` e `TYPE_META`; as outras três não dependem entre si, mas rodam em série, ver regra de agentes).
- Envio 2: `T1 → T2 → T3 → T4 → T6 → T5 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14`.
  - **T17 antes da T7 é obrigatório** (T7 usa `rotuloDoDia` e o selo "Título" da T17; o envio 1 já a entrega).
  - **T6 antes da T5 é obrigatório:** `lerPaginaDoLab` (T5) chama `lerPaginaDoCanal` (T6).
  - **Uma única leitura de `lerPaginaDoCanal` por visita:** só `lerPaginaDoLab` a chama no carregamento; Com você, Em teste agora e a lista inicial saem dessa mesma resposta. `lerLinhasDoCaminho` deixa de ser chamada pela página (continua para os outros consumidores).
  - T4 depende de T2 e T3 (que rodam uma depois da outra); T11 depende de T4 a T10; T16 (envio 1) liga `onContinuarRascunho` no dashboard velho e a T11 mantém essa ligação (teste na T11).
- **Agentes sequenciais no mesmo worktree.** Nenhum par de tarefas roda em paralelo: o pre-commit roda o typecheck do app inteiro e pegaria o trabalho em andamento do vizinho (componente meio escrito), forçando `--no-verify` em código. Um agente por vez, uma tarefa por vez, commit por caminho explícito.

## Global Constraints

- Sem migration, sem coluna nova, sem RPC nova. Toda leitura usa tabela/RPC que já existe (`ab_tests`, `ab_test_variants`, `ab_test_cycles`, `ab_test_dias` via `lerDiasDosTestes`, `ab_native_tests`/`lerLinhasDoCaminho`, RPC `ab_lab_volume`, RPC `ab_lab_formato_atual`).
- Nenhuma action de escrita nova. A escrita é só por `endAbTest` (ativo, qualquer versão), `aplicarSugerido` (concluído, só a sugerida e "aplicar de novo"), `revertWinner` (voltar à original enquanto `revert_expires_at > agora`), `responderTesteDoYouTube` e `mudarRespostaDoTesteDoYouTube`.
- No concluído, nenhum controle visível pode disparar recusa `ja_encerrado`: versões que não são a sugerida (inclusive "Manter A") aparecem desabilitadas com o selo **"Em breve"** (M7b).
- Prazo de voltar = `ab_tests.revert_expires_at` (gravado pelo `settleOnAir` = aplicação + 7 dias), em `dd/mm` no fuso `America/Sao_Paulo`. Depois dele, a ação some.
- Next 16: nunca passar `next/link` (ou componente importado num Server Component) como prop para client component; client que precisa de link usa `CmsLink` (`src/app/cms/(authed)/_shared/cms-link.tsx`) ou `next/link` importado no próprio arquivo client.
- Client component nunca importa `../actions` nem `../actions-nativo`: actions chegam por props tipadas (`import type` é permitido). Padrão: `AcoesCaminho` em `lista-caminho.tsx`.
- TypeScript sem `any`; validação de entrada de action com Zod.
- Texto de interface em português, sem sigla de sistema ("dia 14", "regra_v2", "M7b", "M8" nunca aparecem). Nada abaixo de 12px; alvo de toque ≥ 44px; selos com 24px de altura e `align-self: flex-start` (Naksu r4); um alinhamento de borda direita.
- Nulo nunca vira zero: CTR sem impressão = "CTR não medido"; volume com menos de 3 dias cobertos = "volume ainda não lido" (nunca "sem volume").
- Cópia exata do mockup r5 onde ele fixa texto (citada em cada tarefa). Onde o mockup contradiz o servidor, vale o servidor e a tarefa diz o texto (ver "Desvios decididos").
- Gates: pre-commit (`build:packages` + typecheck) a cada commit; `npx vitest run` completo e `npm run build:web` antes de pedir a prova do Gio no envio 2 (mudança arriscada de página). No envio 1 basta a verificação curta (typecheck + `test/ab-` + `build:web`).
- Agentes sequenciais no mesmo worktree (ver "Dois envios e ordem obrigatória"): nunca duas tarefas em paralelo.
- Constantes de prazo não se duplicam: `PRAZO_FECHAMENTO_DIAS` (T17) é a única fonte do 11, inclusive em `decisao-v2.ts:426` (`provisorioAte`).
- Data curta "dd/mm" em São Paulo: reusar o formatador de `_components/encerrar-props.ts` (`dataCurtaSp`), extraindo dele `diaMesSp(iso): string` e movendo ambos para `apps/web/src/lib/youtube/ab-data-curta.ts` (o núcleo puro não importa de `app/`); `encerrar-props.ts` reexporta. Não criar um segundo formatador.
- Commits só por caminho explícito (`git add <arquivos>`), nunca `git add -A`: outros terminais trabalham no mesmo branch. Não tocar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`.
- A cada tarefa concluída, o controlador atualiza a página de status da frente (kit `~/.claude/status-kit/`).

## Desvios decididos em relação ao mockup (o dado real vence)

1. **"Volte à original" com "o CTR caiu de 4,8% para 3,6%" (estado f)** não entra em "Com você": é comparação antes × depois, que é do M8 (Hanna, achado 4). No M7 a volta fica na linha do Concluído ("Voltar à original até dd/mm").
2. **"Não vi ainda" (estado i)** fecha o diálogo com "Certo — O aviso continua até você responder." **sem chamar o servidor** (o servidor grava `nao_vi` e encerra o registro como `sem_desfecho`, o que tiraria o item de "Com você" e contradiria o texto aprovado). A resposta `nao_vi` continua disponível na linha da lista, como hoje.
3. **Falha no ativo:** o mockup diz "A original continua no ar"; no teste ativo quem está no ar é a versão da rotação. O texto usa a letra lida (`noArAgora`): "Não consegui aplicar C. B continua no ar." (quando a do ar é a original: "A original continua no ar.").
4. **Sugerida no ativo:** teste ativo da regra v2 não tem vencedor sugerido gravado (só `sinal` quando os pisos fecham). O painel ativo marca "Sugerida pelo teste" só quando `result_metadata.v2.vencedor_sugerido` existir; sem ela, nada vem pré-marcado e o botão fica "Escolha uma versão" (desabilitado com `aria-disabled`).
5. **[decidido 26/10 (Hanna, Logan, Naksu): entra no envio 2] Entrada do painel ativo:** cada cartão de teste do Lab em andamento (`status = active`; `queued` e Studio não têm o botão) e **sem pendência** ganha, no rodapé neutro, o botão **"Encerrar e escolher"** (texto de Logan: avisa a consequência antes do clique; "Escolher o que fica" foi descartado). Botão `.btn.txt` de 44 px, nunca junto com a pendência (a pendência abre o mesmo painel), nunca no cartão do Studio. O painel ativo **sem sugerida** (T8) abre sem nada marcado e com o primário "Escolha uma versão" desabilitado. Estados do mockup r6 (commit `f43456485`): `a-encerrar`, `a-pendencia`, `g-sem-sugerida`. A r7 do mockup pode ajustar o estilo do botão para **secundário com borda, sem chevron**, e tirar o aviso duplicado do subtítulo; o texto e o comportamento não mudam. Necessário, não capricho: sem ele um teste ativo sem sugestão nem pendência não chega ao painel e "escolher qualquer versão no ativo" (síntese r1) fica inalcançável. Logan e Naksu conferem na revisão da tela (Tarefa 13).
6. **[decidido 26/10 (Hanna, Logan, Naksu): a `LinhaCaminho` fica] Linhas de "Vídeos do canal"** mantêm a `LinhaCaminho` atual (ficha do Studio, "Já iniciei", cartão S7, `?video=`), sem os cabeçalhos de grupo nem o resumo próprio. Muda a fonte (busca, filtro, páginas de 20), não a linha. A T10 ganha só três consertos: (a) botão de **44 px** em `.cn-vrow .cn-btn` (regra com escopo; `.cn-btn` global não muda); (b) **mesmo dia e mesmo teto** na linha e no cartão, da mesma fonte (R1); (c) **"Ver teste"** como nome único (R4). O invólucro novo da linha (tokens da página, grade `.vl`, apoio de 12 px, fim da repetição "Sem volume… piso 220") **vai para o M6**; volta antes só se o dono reclamar da cara da lista ao ver o envio 2 ou se o M6 escorregar para depois de jan/2027. Até lá a página tem duas caras de linha (cartão novo × linha antiga): dívida registrada na T13 Step 3b.
7. **Candidatos (fora da contagem) e a faixa de KPIs saem da página** (síntese r1: "sem faixa de KPIs"; o mockup não tem Candidatos). `getSuggestedVideos` deixa de ser chamado pela página; a função fica.
8. **Sugestões vazias:** com 0 itens o bloco vira uma linha discreta: "Sugestões de vídeos para testar: nenhuma agora." (`motivoVazio = 'nunca-calculado'` → "…: ainda não calculadas."), com o link "Ver detalhes" para `link.sugestoes()`. Sem acesso: nada.

## Perguntas ao dono (com padrão; não param o trabalho; 1 e 2 decididas em 26/10)

1. Desvio 5 (botão "Encerrar e escolher"): **decidido 26/10, entra no envio 2.**
2. Desvio 6 (linha da lista): **decidido 26/10, a `LinhaCaminho` fica até o M6.**
3. As três frases novas fora do mockup (T17: "Ainda não decide: o YouTube ainda não fechou nenhum dia." e o texto de 11 dias; T18: frase de origem do Lab). **Padrão: seguir com o texto do plano**; mostrar ao dono junto com o envio 1, sem esperar para codificar (ajuste = um commit).

O controlador mostra a de número 3 ao dono e registra a resposta no ledger. Os itens 1 e 2 já estão decididos e não bloqueiam o envio 2.

## Review Focus

1. **Canal com 300+ vídeos e busca digitada rápido:** respostas fora de ordem não podem sobrescrever a busca mais nova (descartar resposta com número de pedido antigo) e cada tecla não pode disparar uma ida ao servidor (espera de 350 ms; menos de 2 letras = sem busca; ao cair de 2+ letras para menos de 2, o cliente pede `busca: null` e a lista volta ao normal, nunca fica filtrada por um termo velho). Teste em `videos-do-canal.test.tsx` (Tarefa 10).
2. **Volume não lido (menos de 3 dias, ou sem prova de leitura) nunca conta como "sem volume" nem como "testável":** vai para um terceiro grupo, "volume ainda não lido", com o motivo (`sem_leitura`, `falha`, `poucos_dias`) dito na tela; falha da RPC de volume não derruba a página. Teste em `lista-borda-recorte.test.ts` (Tarefa 6).
3. **Prazo de voltar no limite:** `revert_expires_at` vencido há 1 segundo não pode mostrar o botão (o servidor recusaria). Teste em `painel-decisao.test.ts` (Tarefa 2) e em `concluidos.test.ts` (Tarefa 3).
4. **Fechar o painel durante "Aplicando…"** (Esc, X, clique fora, Cancelar) não fecha nem perde o resultado; ao responder, o painel mostra o desfecho. Teste em `painel-o-que-fica.test.tsx` (Tarefa 8).
5. **Título e acento na busca:** "agua" acha "Água de coco em Bangkok"; `%` e `_` digitados são texto, não curinga. Teste em `lista-borda-recorte.test.ts` (Tarefa 6).

---

6. **`outroTesteAberto` dos concluídos:** esquecer o campo libera "Aplicar B" com outro teste aberto no mesmo vídeo. Calculado na borda por `Set` (Tarefa 5), com teste.
7. **Uma leitura só por visita** (`lerPaginaDoCanal` uma vez, `ab_test_dias` uma vez): teste que conta as chamadas (Tarefa 5).

## Mapa de arquivos

**Criar (puro, sem banco nem relógio próprio):**
- `apps/web/src/lib/youtube/ab-lab-pagina/tipos.ts` — tipos do modelo da página.
- `apps/web/src/lib/youtube/ab-lab-pagina/painel-decisao.ts` — opções, rótulos, avisos e mensagens do painel "O que fica no vídeo?".
- `apps/web/src/lib/youtube/ab-lab-pagina/concluidos.ts` — linhas de Concluídos e "no ar desde".
- `apps/web/src/lib/youtube/ab-lab-pagina/com-voce.ts` — itens de "Com você", próxima decisão, frase do topo e cartões de "Em teste agora".
- `apps/web/src/lib/youtube/ab-lab-pagina/montar.ts` — `montarPaginaDoLab` (junta tudo).

**Criar (servidor):**
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/pagina-borda.ts` — `lerPaginaDoLab`.
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/corpo-do-lab.tsx` — componente de servidor assíncrono dentro do `<Suspense>`.

**Criar (cliente), em `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/`:**
- `faixa-com-voce.tsx`, `secao-em-teste.tsx`, `cartao-em-teste.tsx`, `secao-concluidos.tsx`, `videos-do-canal.tsx`, `painel-o-que-fica.tsx`, `dialogo-dia-14.tsx`, `lab-esqueleto.tsx`, `lab-erro.tsx`, `pagina-lab.css`.

**Criar (compartilhado):**
- `apps/web/src/lib/youtube/ab-data-curta.ts` — `dataCurtaSp` (movida) e `diaMesSp`; `encerrar-props.ts` reexporta (Task 2).

**Modificar:**
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-servidor.tsx` (exportar `ACOES` ou movê-lo para `corpo-do-lab.tsx`; apagar `ListaCaminhoServidor` se ficar sem uso — Task 11).
- `apps/web/src/lib/youtube/ab-types.ts:390-416` (`AbTestCardView`) e `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:439-503` (`toCardView`).
- `apps/web/src/lib/youtube/teste-youtube/nativo/lista-borda.ts` (`lerLinhasDoCaminho` ganha `recorte`).
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions-nativo.ts` (action `lerVideosDoCanal`).
- `apps/web/src/lib/youtube/teste-youtube/nativo/frases.ts` (`dia14.responder`, `dia14.naoViAinda`, `dia14.certo`, textos do diálogo).
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-pergunta.tsx` (props `embutido`, `aoNaoViAinda`).
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho.tsx` (prop `agrupar`).
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes.tsx` (linha discreta).
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx` (nova ordem) e `apps/web/src/app/cms/(authed)/youtube/ab-lab/page.tsx`.
- Testes existentes que mudam: `apps/web/test/ab-dashboard.test.tsx`, `apps/web/test/ab-lab-dashboard-d8.test.tsx`, `apps/web/test/ab-lab-dia-14-pergunta.test.tsx`, `apps/web/test/ab-lab-lista-servidor.test.tsx`, `apps/web/test/ab-lab-gio-fix1*.test.tsx` (só o que quebrar pela ordem nova).

**Testes novos** (em `apps/web/test/`): `ab-lab-pagina-cartao-view.test.ts`, `ab-lab-pagina-painel-decisao.test.ts`, `ab-lab-pagina-concluidos.test.ts`, `ab-lab-pagina-com-voce.test.ts`, `ab-lab-pagina-borda.test.ts`, `ab-lab-lista-borda-recorte.test.ts`, `ab-lab-pagina-topo-faixa.test.tsx`, `ab-lab-pagina-painel.test.tsx`, `ab-lab-pagina-dialogo-dia-14.test.tsx`, `ab-lab-pagina-videos-do-canal.test.tsx`, `ab-lab-pagina-composicao.test.tsx`. Testes de módulo puro: `// @vitest-environment node`; de componente: `// @vitest-environment jsdom`.

Comando de teste (sempre a partir de `apps/web`): `npx vitest run test/<arquivo> 2>&1 | tail -30`.

---

### Task 1: Títulos das versões e dados do painel na view do cartão

**Estimativa:** ~60K tokens (Sonnet).

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-types.ts:390-416`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:439-503`
- Test: `apps/web/test/ab-lab-pagina-cartao-view.test.ts`

**Interfaces:**
- Produces: `AbTestCardView.variants: Array<{ id: string; label: DisplayLabel; color: string; thumbUrl: string | null; title: string | null; isOriginal: boolean }>`; `AbTestCardView.restoreSeq: number`; `AbTestCardView.videoTitle: string | null` (título do vídeo: `original_title ?? name`; nunca vazio sem motivo).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// @vitest-environment node
it('toCardView leva o título de cada versão: title_text, e a original cai no original_title', () => {
  const v = toCardView(fixture({ test_type: 'title', original_title: 'Main AD Diamante 2 - Lolzin raiz!',
    variants: [{ id: 'va', label: 'original', is_original: true, title_text: null },
               { id: 'vb', label: 'B', is_original: false, title_text: 'Main AD no Diamante 2: partida comentada (LoL raiz)' }] }))
  expect(v.variants.map(x => [x.id, x.label, x.title, x.isOriginal])).toEqual([
    ['va', 'A', 'Main AD Diamante 2 - Lolzin raiz!', true], ['vb', 'B', 'Main AD no Diamante 2: partida comentada (LoL raiz)', false]])
  expect(v.restoreSeq).toBe(fixture().restore_seq)
})
it('teste de miniatura: variante não original sem title_text tem title nulo (nunca o título do vídeo inventado)', () => { /* title === null */ })
it('teste antigo sem original_title: videoTitle === test.name; a original sem título gravado tem title nulo e a tela escreve "título não gravado" (nunca linha vazia)', () => {})
```
`fixture()` monta um `AbTestWithVariants` mínimo (copie o padrão de `apps/web/test/ab-dashboard-queries.test.ts`).

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run test/ab-lab-pagina-cartao-view.test.ts` → FAIL (`title` undefined).
- [ ] **Step 3: Implementar** — em `toCardView`: `title: v.title_text ?? (v.is_original ? test.original_title ?? null : null)`, `id: v.id`, `isOriginal: v.is_original`; `restoreSeq: test.restore_seq ?? 0`; `videoTitle: test.original_title ?? test.name ?? null` (`original_title` é nulável em `database.types.ts:898`; `queries.ts:1123` já usa o mesmo fallback). Ajustar o tipo em `ab-types.ts`. Mocks que montam `AbTestCardView` (grep `AbTestCardView` em `mock-views.ts` e `apps/web/test/`) ganham os campos novos.
- [ ] **Step 4: Rodar o teste e `npx tsc --noEmit -p apps/web`** → PASS e 0 erros.
- [ ] **Step 5: Commit** — `git add apps/web/src/lib/youtube/ab-types.ts apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts apps/web/test/ab-lab-pagina-cartao-view.test.ts <mocks tocados>`; `git commit -m "feat: títulos das versões e restore_seq na view do cartão do A/B Lab (M7 T1)"`.

**Pronto quando:** o teste passa, o typecheck passa e nenhum consumidor de `AbTestCardView` quebra.

---

### Task 2: Modelo puro do painel "O que fica no vídeo?"

**Estimativa:** ~110K tokens (Sonnet).

**Files:**
- Create: `apps/web/src/lib/youtube/ab-lab-pagina/tipos.ts`
- Create: `apps/web/src/lib/youtube/ab-lab-pagina/painel-decisao.ts`
- Test: `apps/web/test/ab-lab-pagina-painel-decisao.test.ts`

**Interfaces:**
- Consumes: `diaMesSp` (novo `lib/youtube/ab-data-curta.ts`, extraído de `dataCurtaSp` em `encerrar-props.ts:25`), `TelaV2` (`apps/web/src/lib/youtube/ab-gravacao/tela-v2.ts`), `ctrDosValidos` (`decisao-v2.ts:243`), `lerResultadoV2` (`ab-types.ts:265`).
- Produces (em `tipos.ts`):
```ts
export type ModoPainel = 'ativo' | 'concluido' | 'aplicado'
export interface OpcaoPainel {
  varianteId: string; letra: 'A' | 'B' | 'C' | 'D'; original: boolean
  titulo: string | null; miniatura: string | null
  /** fração 0..1; nulo = não medido */ ctr: number | null
  noAr: boolean; sugerida: boolean
  estado: 'escolhivel' | 'em_breve' | 'no_ar_fixo' | 'sem_permissao'
}
export interface PainelDecisao {
  testId: string; nomeVideo: string; tipo: 'thumbnail' | 'title' | 'combo'; modo: ModoPainel
  opcoes: OpcaoPainel[]; padrao: string | null /* varianteId pré-marcado */
  sugeridaLetra: string | null; noArLetra: string; regraV2: boolean
  restoreSeq: number; voltarAte: string | null /* 'dd/mm' */
  podeDeixarVariante: boolean
}
export type EscolhaPainel = { tipo: 'encerrar'; varianteId: string; original: boolean } | { tipo: 'aplicar_sugerida'; varianteId: string } | { tipo: 'voltar' }
```
- Produces (em `painel-decisao.ts`):
  - `painelDoAtivo(card: AbTestCardView, e: { ctrs: Record<string, number | null>; noArLetra: string; sugeridaId: string | null; regraV2: boolean; podeDeixarVariante: boolean }): PainelDecisao`
  - `painelDoConcluido(card: AbTestCardView, tela: Extract<TelaV2, { fase: 'concluido' }>, e: { ctrs: Record<string, number | null>; sugeridaId: string | null; revertExpiresAt: string | null; agora: Date }): PainelDecisao | null` — nulo quando não há ação possível (nem `aplicar`, nem `aplicarDeNovo`, nem `voltar`).
  - `escolhaDe(p: PainelDecisao, varianteId: string): EscolhaPainel | null`
  - `rotuloDoBotao(p: PainelDecisao, varianteId: string | null): string`
  - `avisoDaEscolha(p: PainelDecisao, varianteId: string | null): string | null`
  - `mensagemDeFalha(p: PainelDecisao, varianteId: string, r: { tipo: 'servidor'; error: string } | { tipo: 'rede' }): string`
  - `mensagemDeFeito(p: PainelDecisao, varianteId: string, hojeDdMm: string): string`
  - `ddmmSp` NÃO é criado: usar `diaMesSp` de `ab-data-curta.ts` (ver Global Constraints).

- [ ] **Step 1: Escrever os testes que falham** (valores exatos do mockup r5, `index.html:205-216, 283-285`):

```ts
// @vitest-environment node
describe('painelDoAtivo', () => {
  it('todas as versões escolhíveis; "No ar agora" na letra lida; sem sugerida nada vem marcado', () => {
    const p = painelDoAtivo(cardABC, { ctrs: {}, noArLetra: 'B', sugeridaId: null, regraV2: true, podeDeixarVariante: true })
    expect(p.opcoes.map(o => [o.letra, o.estado, o.noAr])).toEqual([['A','escolhivel',false],['B','escolhivel',true],['C','escolhivel',false]])
    expect(p.padrao).toBeNull()
    expect(rotuloDoBotao(p, null)).toBe('Escolha uma versão')
  })
  it('rótulo acompanha a escolha', () => {
    // ativo: o rótulo diz a consequência (ação irreversível; Yannis R3)
    expect(rotuloDoBotao(pComSugB, 'vc')).toBe('Encerrar e deixar C no ar')
    expect(rotuloDoBotao(pComSugB, 'va')).toBe('Encerrar e manter A (original)')
    // concluído mantém 'Aplicar B ao vídeo' (rótulo do mockup)
  })
  it('aviso quando difere da sugerida, inclusive Manter A', () => {
    expect(avisoDaEscolha(pComSugB, 'vc')).toBe('O teste indicou B. Escolher C encerra o teste agora e coloca C no ar.')
    expect(avisoDaEscolha(pComSugB, 'va')).toBe('O teste indicou B. Manter A encerra o teste agora, sem aplicar B.')
    expect(avisoDaEscolha(pComSugB, 'vb')).toBeNull()
  })
  it('sem permissão de administrar: só a original fica escolhível', () => {
    const p = painelDoAtivo(cardABC, { ...e, podeDeixarVariante: false })
    expect(p.opcoes.map(o => [o.letra, o.estado])).toEqual([['A','escolhivel'],['B','sem_permissao'],['C','sem_permissao']])
  })
  it('CTR nulo vira null (a tela escreve "CTR não medido"), nunca 0', () => { expect(painelDoAtivo(cardABC, { ...e, ctrs: { va: null } }).opcoes[0].ctr).toBeNull() })
})
describe('painelDoConcluido', () => {
  it('B sugerida e não aplicada: só B escolhível; A e C "em_breve"; padrão B; botão "Aplicar B ao vídeo"', () => { /* tela.aplicar = { variant_id: 'vb', letra: 'B' } */ })
  it('B aplicada com prazo aberto: A escolhível (voltar), B "no_ar_fixo", C "em_breve"; voltarAte "02/11"; botão "Voltar à original"', () => {
    // revertExpiresAt '2026-11-02T15:00:00Z', agora '2026-10-26T15:00:00Z', tela.voltar = true
  })
  it('prazo vencido há 1 s: painel nulo quando não há aplicar nem aplicarDeNovo', () => { /* tela.voltar=false, revertExpiresAt = agora-1000 */ })
  it('aplicarDeNovo (voltou à original): a sugerida volta a ser escolhível com o rótulo "Aplicar B ao vídeo"', () => {})
  it('nenhuma opção não sugerida é escolhível no concluído (nada que o servidor recuse)', () => {
    for (const p of todosOsConcluidos) expect(p.opcoes.filter(o => o.estado === 'escolhivel' && !o.sugerida && !(p.modo === 'aplicado' && o.original))).toEqual([])
  })
})
describe('diaMesSp (ab-data-curta.ts)', () => {
  it('fronteira do fuso: 2026-10-27T02:30:00Z é 23h30 de 26/10 em São Paulo', () => { expect(diaMesSp('2026-10-27T02:30:00Z')).toBe('26/10') })
  it('nulo ou inválido devolve string vazia', () => { expect(diaMesSp(null)).toBe(''); expect(diaMesSp('lixo')).toBe('') })
})
describe('mensagens', () => {
  it('falha no ativo cita a letra no ar', () => expect(mensagemDeFalha(pAtivoNoArB, 'vc', { tipo: 'servidor', error: 'x' })).toBe('Não consegui aplicar C. B continua no ar.'))
  it('falha no ativo com a original no ar', () => expect(mensagemDeFalha(pAtivoNoArA, 'vc', { tipo: 'servidor', error: 'x' })).toBe('Não consegui aplicar C. A original continua no ar.'))
  it('Manter A falhou', () => expect(mensagemDeFalha(pAtivoNoArB, 'va', { tipo: 'servidor', error: 'x' })).toBe('Não consegui encerrar o teste. Ele continua rodando.'))
  it('concluído', () => { expect(mensagemDeFalha(pConc, 'vb', srv)).toBe('Não consegui aplicar B. A original continua no ar.'); expect(mensagemDeFalha(pAplicado, 'va', srv)).toBe('Não consegui voltar à original. B continua no ar.') })
  it('rede', () => expect(mensagemDeFalha(pConc, 'vb', { tipo: 'rede' })).toBe('A conexão caiu e não deu para confirmar se mudou. Confira o vídeo no YouTube antes de tentar de novo.'))
  it('feito', () => {
    expect(mensagemDeFeito(pComSugB, 'vb', '26/10')).toBe('Teste encerrado. B no ar desde 26/10.')
    expect(mensagemDeFeito(pComSugB, 'vc', '26/10')).toBe('Teste encerrado. C no ar desde 26/10. Você escolheu C; o teste indicava B.')
    expect(mensagemDeFeito(pComSugB, 'va', '26/10')).toBe('Teste encerrado. Você manteve A (original). O teste indicava B.')
    expect(mensagemDeFeito(pConc, 'vb', '26/10')).toBe('B no ar desde 26/10. Dá para voltar à original até 02/11.')
    expect(mensagemDeFeito(pAplicado, 'va', '26/10')).toBe('A original voltou ao ar.')
  })
})
```
Com `podeDeixarVariante = false` a tela escreve "Só quem administra o site pode deixar uma versão no ar." (mesma regra de `ab-end-test-dialog.tsx:331`).

- [ ] **Step 2: Rodar e ver falhar** → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** — primeiro criar `ab-data-curta.ts` (mover `dataCurtaSp`, extrair `diaMesSp`, reexportar em `encerrar-props.ts`; testes existentes de `encerrar-props` seguem verdes). `painelDoAtivo` só é chamado para teste com `status = 'active'` (`queued` entra em `ativos` em `queries.ts:105`, mas não ganha o botão; o caminho `endAbTest` com `queued` não foi verificado e fica fora). `voltarAte = tela.voltar && revertExpiresAt ? ddmmSp(revertExpiresAt) : null`, conferindo também `Date.parse(revertExpiresAt) > agora` (dupla guarda); concluído `padrao` = sugerida (não aplicada) ou A (aplicada); `escolhaDe` devolve `encerrar` no ativo (`original` = opção A), `aplicar_sugerida` no concluído não aplicado e `voltar` no aplicado; nulo para opção não escolhível. Ordem das opções: A, B, C (original primeiro, depois por letra).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: modelo do painel O que fica no vídeo (M7 T2)"` com os 3 arquivos.

**Pronto quando:** todos os testes acima passam, `ddmmSp` não existe duplicado e nenhum caminho do modelo devolve uma escolha que `aplicarSugerido` recusaria.

---

### Task 3: Modelo puro de Concluídos ("quem venceu" e "no ar desde")

**Estimativa:** ~80K tokens (Sonnet).

**Files:**
- Create: `apps/web/src/lib/youtube/ab-lab-pagina/concluidos.ts`
- Modify: `apps/web/src/lib/youtube/ab-lab-pagina/tipos.ts`
- Test: `apps/web/test/ab-lab-pagina-concluidos.test.ts`

**Interfaces:**
- Consumes: `paraRestoreStatus`, `camposDoTeste` (`lib/youtube/ab-restore.ts`), `LinhaDoCaminho` (`nativo/lista.ts`), `versaoDoRespondido`/`versoesDoDia14` (`caminho-nativo/dia-14-estado.ts`), `PainelDecisao` (Task 2).
- Produces:
```ts
export interface LinhaConcluida {
  chave: string; origem: 'lab' | 'studio'; testId: string | null; ytId: string
  titulo: string; miniaturaUrl: string | null; tipo: 'Título' | 'Miniatura' | 'Título e miniatura'
  resultado: string      // "B venceu" | "A (original) ficou" | "B sugerido pelo teste" | "Sem vencedor"
  apoio: string          // "no ar desde 26/10" | "falta aplicar no vídeo" | "no ar desde 12/10 · você contou do Studio" | "no ar: não confirmado"
  acao: { rotulo: 'Aplicar B' | 'Voltar à original'; painel: PainelDecisao } | null
  ordem: string          // ISO usado para ordenar (mais recente primeiro)
}
export function noArDoTeste(t: { test_type: 'thumbnail'|'title'|'combo'; restore_status: unknown; winner_variant_id: string | null; winner_applied_at: string | null; completed_at: string | null }, letraDe: (id: string) => string | null): { letra: string | null; desde: string | null; confirmado: boolean }
export function linhasConcluidas(e: { testes: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; painel: PainelDecisao | null; tela: Extract<TelaV2, { fase: 'concluido' }> | null }>; linhasStudio: LinhaDoCaminho[]; agora: Date }): LinhaConcluida[]
export const CONCLUIDOS_VISIVEIS = 3
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
// @vitest-environment node
it('aplicada: "B venceu" e "no ar desde" = maior `em` entre os campos ok do tipo, todos com destino = id de B', () => {
  // restore_status { title: { estado:'ok', destino:'vb', em:'2026-10-26T13:00:00Z', ... } }, test_type 'title'
  expect(linha.resultado).toBe('B venceu'); expect(linha.apoio).toBe('no ar desde 26/10')
})
it('combo com um campo falhou: apoio "no ar: não confirmado" (nunca uma data inventada)', () => {})
it('original vence (winner_variant_id = original ou nulo, campos ok com destino original): "A (original) ficou"', () => {})
it('sugerida não aplicada (tela.aplicar não nulo): "B sugerido pelo teste", "falta aplicar no vídeo", ação "Aplicar B"', () => {})
it('aplicada e prazo aberto: ação "Voltar à original"; prazo vencido: sem ação', () => {})
it('desfecho sem vencedor (sem_diferenca/volume/dado/falha): "Sem vencedor"', () => {})
it('Studio respondido (estado ficou_no_ar): "A (original) ficou" ou "B venceu", apoio "no ar desde dd/mm · você contou do Studio" com dd/mm de respondidoEm', () => {})
it('Studio sem vencedor (respondido_sem_vencedor): "Sem vencedor", apoio "você contou do Studio"', () => {})
it('ordena do mais recente para o mais antigo misturando Lab e Studio', () => {})
it('concluído com `tela.aplicarDeNovo === null` por outro teste aberto no mesmo vídeo: linha sem ação', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `noArDoTeste`: lê `paraRestoreStatus(restore_status)`; confirmado só se TODOS os campos de `camposDoTeste(test_type)` estão `ok` com o mesmo `destino`; letra = `'A'` para `destino === 'original'`, senão `letraDe(destino)`; desde = maior `em`. Sem `restore_status` legível: `{ letra: null, desde: null, confirmado: false }`. Teste concluído pelo caminho v1 sem `restore_status` usa `winner_applied_at` como desde quando `winner_variant_id` aponta variante não original (registre no comentário que é o dado de antes do P4).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: modelo dos Concluídos com vencedor e no ar desde (M7 T3)"`.

**Pronto quando:** cada linha bate com o banco pela regra acima (critério M7-d da Hanna) e nenhuma data aparece sem `em` lido.

---

### Task 4: Modelo puro de "Com você", frase do topo e "Em teste agora"

**Estimativa:** ~130K tokens (Sonnet).

**Files:**
- Create: `apps/web/src/lib/youtube/ab-lab-pagina/com-voce.ts`
- Create: `apps/web/src/lib/youtube/ab-lab-pagina/montar.ts`
- Modify: `apps/web/src/lib/youtube/ab-lab-pagina/tipos.ts`
- Test: `apps/web/test/ab-lab-pagina-com-voce.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3; `AbTestDraft`; `LinhaDoCaminho`, `prazoDoDia14`, `rotuloRetomar` (`nativo/lista.ts`); `pausaVisivel`.
- Produces:
```ts
export type ItemComVoce =
  | { tipo: 'primeiro_teste' }
  | { tipo: 'rascunho'; draftId: string; titulo: string; passo: number }
  | { tipo: 'aplicar'; titulo: string; letra: string; motivo: string; painel: PainelDecisao }
  | { tipo: 'dia14'; titulo: string; linha: LinhaDoCaminho /* o diálogo exige a linha; resultado_pronto não está em emTeste */; ytId: string; prazo: string /* 'dd/mm' */; vencido: boolean }
  | { tipo: 'conferir_studio'; titulo: string; ytId: string }
  | { tipo: 'retomar'; titulo: string; testId: string; pausadoHaDias: number }
export type CartaoEmTeste =
  | { tipo: 'lab'; card: AbTestCardView; lider: { letra: string; ctrs: [string, string] } | null; semLider: 'poucos dados' | 'CTR não medido'; proximaTroca: string | null; painel: PainelDecisao | null /* nulo quando status != 'active' */ }
  | { tipo: 'studio'; linha: LinhaDoCaminho; titulos: Array<{ letra: string; titulo: string | null }>; labPausadoAte: string | null; dia14: boolean }
export interface PaginaDoLab {
  topo: { frase: string }
  comVoce: { itens: ItemComVoce[]; vazio: string | null }
  emTeste: CartaoEmTeste[]
  concluidos: { linhas: LinhaConcluida[]; total: number; regua: { feitos: number; meta: 3 } | null }
  temHistorico: boolean
}
export function itensComVoce(e: EntradaPagina): ItemComVoce[]
export function proximaDecisao(e: EntradaPagina): Date | null
export function fraseDoTopo(p: { lab: number; studio: number; itens: ItemComVoce[]; temHistorico: boolean }): string
export function montarPaginaDoLab(e: EntradaPagina): PaginaDoLab
export interface EntradaPagina {
  ativos: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; tela: Extract<TelaV2, { fase: 'ativo' }> | null; ctrs: Record<string, number | null> }>
  concluidos: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; tela: Extract<TelaV2, { fase: 'concluido' }> | null; ctrs: Record<string, number | null> }>
  pausados: AbTestCardView[]; rascunhos: AbTestDraft[]; linhas: LinhaDoCaminho[]
  podeDeixarVariante: boolean; agora: Date
}
```
- Ordem dos itens (urgência primeiro): `dia14` vencido → `aplicar` → `dia14` no prazo → `retomar` → `rascunho` → `conferir_studio`; `primeiro_teste` só quando não há teste nem rascunho nem registro do Studio em toda a história (`temHistorico = false`).

- [ ] **Step 1: Escrever os testes que falham** (textos do mockup r5, `index.html:124-171`):

```ts
// @vitest-environment node
it('estado a: 1 ativo, nada com você → topo "Um teste rodando. Nada com você agora." e vazio "Próxima decisão: 08/11."', () => {
  // ativo começou 25/10, teto 15 → proximaDecisao = início + 14 dias (dia 14 do teto) em dd/mm SP
})
it('estado b: 0 ativos com histórico → topo "Nenhum teste rodando. Nada com você agora." e vazio "Nenhum teste rodando; crie um quando quiser."', () => {})
it('estado b2: sem história → topo "Nenhum teste ainda. Crie o primeiro quando quiser." e um item primeiro_teste', () => {})
it('estado c: 3 do Lab + 1 Studio, aplicar B e dia 14 → topo "4 testes rodando (1 no Studio). Duas coisas com você: aplicar B e dizer o que o Studio escolheu."', () => {})
it('estado f: sem Lab rodando, 4 itens → topo "Nenhum teste do Lab rodando. Quatro coisas com você." (sem item de voltar à original: desvio 1)', () => {})
it('dia 14: linha resultado_pronto ou sem_resposta vira item dia14 CARREGANDO a LinhaDoCaminho inteira; em_teste_studio sem confirmadoEm vira conferir_studio', () => {})
it('cartão queued: painel nulo (sem botão Encerrar e escolher)', () => {})
it('pausado por teste do YouTube aberto (pausaYoutube.aberto) não vira "retomar": vira cartão studio com labPausadoAte', () => {})
it('cartão lab: líder só com tela.sinal; ctrs formatados "4,8%" e "4,1%"; sem sinal → semLider "poucos dados" se algum CTR medido, senão "CTR não medido"', () => {})
it('nulo nunca vira 0: CTR nulo não aparece como "0,0%" em lugar nenhum do modelo', () => {})
it('régua só com menos de 3 concluídos raiz; 3 ou mais → regua null', () => {})
```
Números por extenso no topo até dez ("Duas", "Quatro"), como `porExtenso` de `frases.ts`. Frase com 1 item cita o verbo do item ("Uma coisa com você: aplicar B.").

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `proximaDecisao` = menor entre (para cada ativo do Lab: `started_at` + (teto − 1) dias — o último dia do teto) e (para cada Studio em teste: `prazoDoDia14`). `proximaTroca` = mesma conta de `active-test-card.tsx:146-150` (`~Nh`, `<1h`, nulo sem ciclo), extraída para uma função pura exportada `proximaTrocaDe(cycleStartedAt: string | null, agora: Date): string | null`. Concluídos visíveis: `CONCLUIDOS_VISIVEIS` mais recentes; `total` conta todos.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: modelo de Com você, topo e Em teste agora (M7 T4)"`.

**Pronto quando:** as frases dos estados a, b, b2, c e f saem idênticas ao mockup (fora o desvio 1) a partir de entradas montadas como o banco as entrega.

---

### Task 5: Borda da página e `page.tsx` com um só `<Suspense>` (depois da Task 6)

**Estimativa:** ~150K tokens (Sonnet).

**Depende de:** Task 6 (chama `lerPaginaDoCanal`). Ordem obrigatória T6 → T5.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/pagina-borda.ts`
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/corpo-do-lab.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-esqueleto.tsx` (estado d)
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-erro.tsx` (estado e; fronteira de erro cliente, padrão `caminho-nativo/lista-erro.tsx`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/page.tsx`
- Test: `apps/web/test/ab-lab-pagina-borda.test.ts`, `apps/web/test/ab-lab-lista-servidor.test.tsx` (ajuste)

**Interfaces:**
- Consumes: `lerPaginaDoCanal` (Task 6); `getAbTestsForSite`, `toCardView`, `toDraftList`, `getAbSiteSettings`, `getChannelLearnings`, `getEligibleVideosForPicker` (`queries.ts`); `lerDiasDosTestes` (`lib/youtube/ab-gravacao/placar-leitura.ts`); `telaV2DoTeste`; `lerPausasYoutube`; `leituraDoEditor`; `requireSiteAdminScope(siteId)` de `@/lib/cms/auth-guards` (`.ok` é o mesmo valor que o `SiteAdminProvider` de `app/cms/(authed)/layout.tsx:89` entrega a `useCanAdminSite()`; só leitura, sem auditoria) para `podeDeixarVariante`; `montarPaginaDoLab` (Task 4).
- Produces: `lerPaginaDoLab(siteId: string, agora: Date, videoInicial: string | null): Promise<{ pagina: PaginaDoLab; listaInicial: PaginaDoCanal; eligibleVideos: EligibleVideo[]; settings: AbTestSiteSettings; learnings: ChannelLearningsData | null; drafts: AbTestDraft[] }>`; `<CorpoDoLab siteId videoInicial />` (servidor) que renderiza `<AbLabDashboard … pagina={…} listaInicial={…} eligibleVideos={…} />`.
- **Fluxo (uma leitura por visita):** `Promise.all` com `getAbTestsForSite`, `lerPaginaDoCanal(sb, siteId, agora, leitura, { busca: null, filtro: 'testaveis', pagina: 0, incluirYtId: videoInicial })` (UMA vez), `getEligibleVideosForPicker`, `getAbSiteSettings`, `getChannelLearnings`, `lerPausasYoutube`, `requireSiteAdminScope`. As linhas de Com você e Em teste agora são as de `listaInicial.linhas` (as extras da página 0 trazem fichas abertas e registros do Studio; os testes nossos entram nelas só quando o vídeo já está na lista, e os cartões do Lab vêm de `getAbTestsForSite`, então nenhum cartão se perde; as extras escapam do filtro de privados, de propósito). `lerLinhasDoCaminho` NÃO é chamada pela página.
- **`outroTesteAberto`:** na borda, `Set` de `youtube_video_id` dos testes com status `draft|queued|active|paused` do MESMO `getAbTestsForSite` (O(t), zero consulta extra); `outroTesteAberto = abertos.has(t.youtube_video_id)` ao chamar `telaV2DoTeste`. (Excluir o próprio teste do conjunto.) Nunca `false` fixo: `tela-v2.ts:37` exige o campo para "esquecer não liberar o botão".
- **Dias:** `lerDiasDosTestes` uma vez, só com os ids dos ativos e dos concluídos com ação possível. `ok:false` lança (a fronteira mostra o estado e). Linhas `invalidos` não lançam: os CTRs daquele teste ficam nulos ("CTR não medido") e o resto da página segue normal.
- **Volume:** falha da RPC de volume NÃO lança aqui: `lerPaginaDoCanal` (Task 6) devolve `motivoNaoLido: 'falha'` e a página monta (Com você não depende de volume).

- [ ] **Step 1: Escrever os testes que falham** (stub do Supabase no padrão de `ab-lab-lista-servidor.test.tsx`):

```ts
// @vitest-environment node
it('uma visita faz 1 select em youtube_videos, 1 em ab_native_tests, 1 em ab_test_dias e 0 chamadas a getSuggestedVideos (stub conta)', () => {})
it('lerPaginaDoCanal é chamado UMA vez e as mesmas linhas alimentam Com você, Em teste e listaInicial; lerLinhasDoCaminho não é chamado', () => {})
it('lerDiasDosTestes é chamado UMA vez, só com os ids dos ativos e dos concluídos com ação possível (aplicar, aplicarDeNovo ou voltar)', () => {})
it('dias até encerrado_em_dia no concluído (o CTR do painel é o da decisão)', () => {})
it('erro em lerDiasDosTestes lança (a fronteira mostra o estado e); nunca devolve CTR 0', () => {})
it('lerDiasDosTestes com linha inválida: CTRs daquele teste nulos, o resto da página normal, nada vira 0', () => {})
it('concluído com rascunho (ou teste ativo) no mesmo vídeo: tela.aplicarDeNovo === null e a linha do Concluído sem ação', () => {})
it('teste nosso ativo em vídeo fora da janela dos recentes: aparece em Em teste agora (vem de getAbTestsForSite) mesmo sem entrar nas extras da página 0', () => {})
it('podeDeixarVariante vem de requireSiteAdminScope: usuário editor → B e C do painel "sem_permissao"', () => {})
it('RPC de volume com erro: a página monta; listaInicial.contagem.motivoNaoLido === "falha"; Com você e Em teste normais', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `page.tsx`: cabeçalho fora do Suspense não existe (o resumo depende do dado; estado d mostra "Lendo os testes…"); `page` renderiza `<LabErro><Suspense fallback={<LabEsqueleto />}><CorpoDoLab siteId videoInicial /></Suspense></LabErro>` e mantém o `blocoSugestoes` em Suspense próprio, passado como slot. Os `await` que hoje estão no corpo de `page.tsx` (`getEligibleVideosForPicker`, `getAbSiteSettings`, `getChannelLearnings`) vão para dentro de `lerPaginaDoLab`; no corpo do `page` ficam só `getSiteContext` e `searchParams` (regra do comentário de `lista-caminho-servidor.tsx:1-2`). `LabEsqueleto` reproduz o estado d (`index.html:144-150`): resumo "Lendo os testes…" em `--cms-text-dim`, faixa Com você com esqueleto de 56px, "Em teste agora — Carregando…", "Concluídos — Carregando…", "Vídeos do canal — Carregando…", `aria-busy="true"`. `LabErro` reproduz o estado e (`index.html:151-155`): topo "Não deu para ler os testes agora.", Com você "Não dá para saber se há algo com você enquanto os testes não carregam.", caixa "Se havia testes rodando, eles seguem; só a leitura falhou." com um só "Tentar de novo" (`router.refresh()` + `reset()`), Concluídos "Os concluídos vêm da mesma leitura dos testes. Use o botão “Tentar de novo” do bloco acima."
- [ ] **Step 4: Rodar os testes novos e `test/ab-lab-lista-servidor.test.tsx`, `test/ab-lab-page-video-param.test.ts`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: borda única da página do A/B Lab com Suspense e estados de carga e erro (M7 T5)"`.

**Pronto quando:** a página lê o banco num só lugar, dentro do Suspense; erro de leitura mostra o estado e; nenhuma leitura duplicada (contagem de chamadas no teste).

---

### Task 6: Recorte da lista (busca, filtro Testáveis, páginas de 20) e action `lerVideosDoCanal` (antes da Task 5)

**Estimativa:** ~170K tokens (Sonnet).

**Depende de:** Tasks 1 a 4. A Task 5 depende desta.

**Files:**
- Modify: `apps/web/src/lib/youtube/teste-youtube/nativo/lista-borda.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions-nativo.ts`
- Test: `apps/web/test/ab-lab-lista-borda-recorte.test.ts`

**Interfaces:**
- Dívida declarada (ledger): "Mostrar mais" E cada busca (1 por pausa de 350 ms) refazem a leitura inteira (1 a 2 selects de 1000 + até 4 RPCs de volume + formato), O(n·p); com n≈300 são 1 select + 1 RPC, aceitável até o teto de 2000. Gatilho: canal com mais de 1000 vídeos ou action acima de 2 s → cursor por `published_at`. Alternativa barata depois: cache em memória de 30 s por `siteId` da lista de vídeos + volume dentro da action (não entra na v1). A T14 mede o custo por interação (Phil).
- **Teto no dado da linha (Yannis R1):** `LinhaDoCaminho.nosso` (`lista-borda.ts:218-223`) ganha `teto: number` = `duracaoPrevista(config)` (mesma função do cartão); o `select` de `ab_tests` da lista (`lista-borda.ts:168`) passa a ler `config`. `nosso.dia` e `diaDe14` saem de `diaDoTeste`, que é 0-based: quem escreve o rótulo usa `rotuloDoDia` (T10), nunca soma 1 à mão.
- Produces:
```ts
export interface RecorteDaLista { busca: string | null; filtro: 'testaveis' | 'todos'; pagina: number; incluirYtId: string | null }
export interface ContagemDoCanal { testaveis: number; semVolume: number; naoLido: number; total: number; motivoNaoLido: 'sem_leitura' | 'falha' | 'poucos_dias' | null }
/** `contagem` é SEMPRE do canal inteiro (nunca muda com a busca); `totalDoFiltro` é o da busca + filtro. */
export interface PaginaDoCanal { linhas: LinhaDoCaminho[]; contagem: ContagemDoCanal; totalDoFiltro: number; temMais: boolean; truncado: boolean; filtroEfetivo: 'testaveis' | 'todos' }
export async function lerPaginaDoCanal(sb: SupabaseClient, siteId: string, agora: Date, leitura: LeituraPrivadaDoSite | null, r: RecorteDaLista): Promise<PaginaDoCanal>
export const POR_PAGINA = 20
export const TETO_VIDEOS_DO_CANAL = 2000
export const LOTE_DE_VOLUME = 500   // corpo ~19 KB, até 2000 ids = 4 idas (Phil)
// actions-nativo.ts
export const PedidoVideosDoCanalSchema = z.object({ busca: z.string().trim().max(100).nullable(), filtro: z.enum(['testaveis','todos']), pagina: z.number().int().min(0).max(100), incluirYtId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable() })
export type ResultadoVideosDoCanal = { ok: true; pagina: PaginaDoCanal } | { ok: false; erro: 'sem_permissao' | 'pedido_invalido' | 'falha' }
export async function lerVideosDoCanal(pedido: unknown): Promise<ResultadoVideosDoCanal>
export function normalizarBusca(s: string): string  // NFD, sem diacríticos, minúsculas, espaços colapsados
```
- `lerLinhasDoCaminho` (sem recorte) fica igual e passa a reaproveitar os passos internos extraídos (montagem da linha), sem mudar a saída: os testes existentes de `lista-borda` e `ab-lab-lista-servidor` continuam verdes sem alteração de expectativa.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// @vitest-environment node
it('lê os vídeos do site em blocos de 1000 com .range() até acabar ou chegar ao teto (2000); no teto, Sentry warning E `truncado === true` (2.001 vídeos no stub → total 2000)', () => {})
it('ordem estável: order(published_at desc) + order(id asc) na leitura e o mesmo desempate no sort em JS; dois vídeos com o mesmo published_at nas posições 20/21 → página 0 e página 1 não se repetem e juntas cobrem os dois', () => {})
it('volume pedido em lotes de 500 ids à RPC ab_lab_volume (2000 ids = 4 idas)', () => {})
it('leitura nula (sem prova de leitura): naoLido = total, testaveis = 0, motivoNaoLido "sem_leitura" e filtroEfetivo "todos" com 20 linhas', () => {})
it('RPC de volume com erro: NÃO lança; tudo em naoLido, motivoNaoLido "falha", nada em semVolume, Sentry registra', () => {})
it('menos de 3 dias de relatório: motivoNaoLido "poucos_dias"', () => {})
it('contagem do canal não muda com a busca: busca "agua" mantém `contagem` igual à sem busca; totalDoFiltro muda', () => {})
it('extra testável da página 0 não reaparece na página 1 (a paginação roda sobre a lista SEM os ids das extras)', () => {})
it('testável = acimaDoPiso === true, público (publico !== false) e não Short (formato.isShort !== true); publico nulo (nunca capturado) conta como público, declarado em comentário', () => {})
it('volume nulo (menos de 3 dias ou sem prova de leitura) conta em naoLido, nunca em semVolume nem em testaveis', () => {})
it('filtro testaveis devolve 20 por página, do mais novo ao mais velho; temMais quando há mais', () => {})
it('busca sem acento: "agua" acha "Água de coco em Bangkok"; "%" e "_" são texto', () => {})
it('busca com menos de 2 letras é tratada como sem busca', () => {})
it('página 0 sem busca inclui as linhas extras de hoje (fichas abertas, registros do Studio, testes nossos) mesmo fora do filtro', () => {})
it('incluirYtId desconhecido no recorte entra na página (abre ?video=)', () => {})
it('formato (RPC ab_lab_formato_atual) só para os acima do piso e para as linhas da página, nunca para os 300', () => {})
it('filtro padrão: se testaveis === 0 e naoLido > 0, filtroEfetivo é "todos" (a lista nunca abre vazia sem explicação)', () => {})
it('nosso.teto: select de ab_tests lê config; teste v2 com max_duration_days 15 → teto 15 (duracaoPrevista); mesmo número que tetoDoTesteV2 usa no cartão, se divergirem vale o do cartão', () => {})
it('lerVideosDoCanal: sem edição → sem_permissao; pedido fora do schema → pedido_invalido; erro de banco → falha + Sentry', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Fluxo de `lerPaginaDoCanal`: (1) `youtube_videos` `id, youtube_video_id, title, thumbnail_url, published_at` do site, `published_at <= agora`, `order('published_at', { ascending: false }).order('id', { ascending: true })`, em `.range()` de 1000 (mesmo desempate no `sort` em JS antes de paginar); `truncado = true` quando chega ao teto; (2) a busca (`normalizarBusca(title).includes(normalizarBusca(busca))`) só afeta o recorte exibido e `totalDoFiltro`, nunca a `contagem`; (3) volume (`lerVolumes`, lotes de `LOTE_DE_VOLUME` = 500, pode rodar em `Promise.all`) para TODOS os vídeos (a `contagem` é do canal inteiro, então a busca não reduz esta leitura) só com `leituraValida`; `try/catch` em volta: erro → todos em `naoLido`, `motivoNaoLido = 'falha'`, Sentry, sem lançar; sem leitura → `'sem_leitura'`; menos de 3 dias → `'poucos_dias'`; (4) privados (`publico === false`) saem; (5) `lerFormatos` só para os acima do piso; (6) classifica e conta; (7) `filtroEfetivo` = `'todos'` quando o pedido é `testaveis` e `contagem.testaveis === 0 && contagem.naoLido > 0`; pagina a lista filtrada SEM os ids das extras (as extras entram só na página 0, à frente; o cliente anexa por `Map<videoId, linha>`); (8) para as linhas da página (+ extras na página 0 sem busca + `incluirYtId`) roda os mesmos passos de hoje (fichas, registros, nossos, títulos de antes, formato) e monta `LinhaDoCaminho` pela função extraída. A action segue o molde de `lerFichaDoVideo` em `actions-nativo.ts` (sessão e site do contexto; `leituraDoEditor(siteId)`; nunca site vindo do cliente).
- [ ] **Step 4: Rodar o teste novo e `test/ab-lab-lista-servidor.test.tsx`, `test/ab-lab-lista-caminho.test.tsx`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: busca no servidor e filtro Testáveis da lista de vídeos do Lab (M7 T6)"`.

**Pronto quando:** a contagem "N com volume para testar, M sem" bate com a regra do piso (`pisoPorDia(2) = 220`), nada de volume não lido entra em "sem", o corte do teto aparece em `truncado` e a ordem é estável entre páginas.

---

### Task 7: Topo, faixa "Com você" e "Em teste agora" (cliente)

**Estimativa:** ~140K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/faixa-com-voce.tsx`, `_components/pagina/secao-em-teste.tsx`, `_components/pagina/cartao-em-teste.tsx`, `_components/pagina/pagina-lab.css`
- Test: `apps/web/test/ab-lab-pagina-topo-faixa.test.tsx`

**Interfaces:**
- Consumes: `PaginaDoLab`, `ItemComVoce`, `CartaoEmTeste` (Task 4); **`rotuloDoDia` (Task 17, `lib/youtube/ab-rotulo-dia.ts`, já entregue pelo envio 1) para o selo "Dia {d}/{teto}" — nunca recalcular o dia**.
- Produces:
```ts
export interface FaixaComVoceProps { itens: ItemComVoce[]; vazio: string | null; onAbrirPainel: (p: PainelDecisao, origem: HTMLElement) => void; onAbrirDia14: (linha: LinhaDoCaminho, origem: HTMLElement) => void; onContinuarRascunho: (draftId: string) => void; onNovoTeste: () => void; onAbrirTeste: (testId: string) => void }
export interface SecaoEmTesteProps { cartoes: CartaoEmTeste[]; onAbrirTeste: (testId: string) => void; onAbrirPainel: FaixaComVoceProps['onAbrirPainel']; onAbrirDia14: FaixaComVoceProps['onAbrirDia14'] }
```
- Textos fixos (mockup r5): cabeçalho "Com você" + contagem "(n)"; botão "O que é automático?" (`aria-expanded`, `aria-controls`, Esc fecha e devolve foco) abre o parágrafo `AUTO` de `index.html:54` literal; vazio "**Nada com você agora.** {vazio}"; itens:
  - aplicar: título "Aplique {L} em “{título}”", motivo do modelo, prazo "Prazo: hoje", botão primário "Aplicar {L}".
  - dia14: título "O teste do YouTube em “{título}” terminou. Veja no Studio qual versão ganhou e conte aqui.", motivo "O Lab não lê o resultado do Studio." + link "Abrir no Studio" (`https://studio.youtube.com/video/{ytId}/edit`, `target="_blank" rel="noopener"`), prazo "vence {dd/mm}" (ou "Prazo acabou em {dd/mm}"), botão "Dizer o que o Studio escolheu" (a 390 px: "Qual ganhou no Studio?").
  - rascunho: "Continue o rascunho de “{título}”", "Você parou no passo {n} de 3. O Lab não cria o teste sozinho.", "sem prazo", "Continuar rascunho".
  - retomar: "Retome o teste pausado de “{título}”", "Pausado há {n} dias. O Lab não retoma sozinho.", "pausado", "Retomar" (navega para o detalhe, onde o Retomar existe).
  - conferir_studio: "Confira no Studio “{título}”", "Teste criado no Studio, sem ficha no Lab. O Lab não lê o resultado do Studio.", "sem prazo", "Abrir no Studio".
  - primeiro_teste: "Crie o primeiro teste", "O Lab não escolhe vídeo nem escreve versões; você faz isso no assistente, em 3 passos.", "sem prazo", "Novo teste" (primário).
- "Em teste agora": 1 cartão = largura cheia (layout horizontal); 2–4 = grade de 2 colunas a ≥1024 px; 5 ou mais = 4 visíveis + "Ver todos ({n})"; 0 = seção some. Cartão de título: selo "Título" (português, nunca "TITLE"), selo "Dia {d}/{teto}", miniatura atual, h3 com o nome (link para o detalhe no Lab; texto sem link no Studio), linhas "A {título}" e "B {título}" (C quando houver) com "● no ar" na letra no ar, stats "Líder" e "Próxima troca … automática"; no Studio: selo "No Studio", sem stats nem "no ar". Cartão de miniatura: pares de miniaturas A/B com "original"/"nova"/"● no ar". Rodapé de pendência "Com você: {verbo}" + botão; cartão do Lab em andamento (`active`) com `painel` não nulo **e sem pendência** tem, no rodapé neutro (`border-top:1px solid var(--border)`, fundo `var(--surface)`, sem âmbar), o botão **"Encerrar e escolher"** (desvio 5, decidido; `.btn.txt` de 44 px, estados `a-encerrar` e `a-pendencia` do mockup r6; se a r7 trocar o estilo, vale a r7). Cartão sem `painel` (`queued`), do Studio ou com pendência não tem o botão. **HTML válido (Yannis R2):** o cartão NÃO é um `<a>`; o link é o `h3` (ou um `::after` esticado) e o botão é irmão do link, nunca descendente, com `position:relative; z-index:2`.

- [ ] **Step 1: Escrever os testes que falham** (RTL, jsdom):

```tsx
it('estado a: cartão único ocupa a largura (classe um), mostra A e B em texto e "● no ar" em A', () => {})
it('nenhum cartão mostra caixa B vazia: versão sem título e sem miniatura escreve "sem título gravado"', () => {})
it('cartão do Studio não tem Líder, CTR nem Próxima troca e tem o selo "No Studio"', () => {})
it('"O que é automático?" abre e fecha; Esc fecha e devolve o foco ao botão', () => {})
it('item aplicar chama onAbrirPainel com o painel do modelo; dia14 chama onAbrirDia14 com a linha inteira do item', () => {})
it('selo do dia usa rotuloDoDia: dia passado 0 de teto 15 → "Dia 1/15"', () => {})
it('botão "Encerrar e escolher": ativo sem pendência = 1; ativo com pendência = 0; queued = 0; Studio = 0 (mutante: condição só `painel !== null` falha no caso da pendência)', () => {})
it('nenhum botão dentro de link: container.querySelector("a button") é nulo; clicar no botão chama onAbrirPainel com o painel do cartão', () => {})
it('todo botão de item tem min-height 44px (classe .lab-alvo) e nenhum texto usa classe abaixo de 12px', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** com Tailwind + tokens `cms-*`; cores carregadas por rgba/hex literal, nunca `color-mix()` (Opera o mostra transparente). `pagina-lab.css` guarda só `.lab-alvo{min-height:44px}`, `.lab-selo{height:24px;align-self:flex-start}` e o layout do cartão horizontal.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: topo, Com você e Em teste agora na página do Lab (M7 T7)"`.

**Pronto quando:** os estados a, b, b2, c e f do mockup são reproduzíveis só trocando o `PaginaDoLab` de entrada (fixtures do teste).

---

### Task 8: Painel "O que fica no vídeo?" (cliente) ligado às actions existentes

**Estimativa:** ~160K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/painel-o-que-fica.tsx`
- Test: `apps/web/test/ab-lab-pagina-painel.test.tsx`

**Interfaces:**
- Consumes: `PainelDecisao`, `escolhaDe`, `rotuloDoBotao`, `avisoDaEscolha`, `mensagemDeFalha`, `mensagemDeFeito` (Task 2); `AbConfirmarTrocaDialog` (`_components/ab-confirmar-troca-dialog.tsx`, para `precisa_confirmar`); `ESPERA_SEM_RESPOSTA_MS`, `sessaoExpirou`, `hrefDoLogin` (`_components/ab-end-test-dialog.tsx`); `useModalFocusTrap`; `YtPortal`.
- Produces:
```ts
export interface AcoesDecisao {
  encerrar: (testId: string, o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>      // endAbTest
  aplicarSugerido: (testId: string, varianteId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoAcaoSaida>
  voltar: (testId: string, seqVisto: number) => Promise<ResultadoAcaoSaida>        // revertWinner
}
export interface PainelOQueFicaProps { painel: PainelDecisao; acoes: AcoesDecisao; onFechar: () => void }
export function PainelOQueFica(p: PainelOQueFicaProps): ReactElement
```
- Comportamento (mockup `index.html:217-245`, estados g, g1, g2, g3, h, h2): título "O que fica no vídeo?"; subtítulo "{nome do vídeo}" + " · escolher encerra o teste agora" no ativo; radiogroup com miniatura (miniatura/combo) ou letra (título), título da versão, "CTR {x,x%}" ou "CTR não medido", selos "Original", "No ar agora", "Sugerida pelo teste", "Em breve"; no aplicado, linha "Dá para voltar até {dd/mm}" na A. Rodapé: ativo/concluído "Mudar o que está no ar muda o YouTube agora. Dá para voltar à original por 7 dias."; aplicado "Dá para voltar à original até {dd/mm}, 7 dias depois de aplicar. Depois dessa data o botão some." Aviso amarelo (`role="status"`) de `avisoDaEscolha`; no ativo com `regraV2`, também "Encerrar à mão tira o teste da decisão: o resultado não será calculado."; sem permissão: "Só quem administra o site pode deixar uma versão no ar.". Botões "Cancelar" e o primário de `rotuloDoBotao`.
- **Guarda de fechar (Yannis):** `useModalFocusTrap` chama `onClose` no Esc sem condição (`use-modal-focus-trap.ts:28`) e o scrim chama direto. Definir `fechar = () => { if (travado) return; onFechar() }` e passar essa função ao hook, ao X, ao Cancelar e ao scrim, com `travado = enviando || sem_resposta || mudou || sessao_expirada`. "Recarregar" = `router.refresh()` + fechar SEM a guarda. Copiar de `ab-end-test-dialog.tsx:123-170` o `expirou` (resposta que chega depois de `ESPERA_SEM_RESPOSTA_MS` é descartada: continua "sem resposta", nunca troca por "Feito" ou falha) e o `montado` (falha depois de desmontar vai para `onAviso`, não some em silêncio). `AbConfirmarTrocaDialog` (trap próprio, `onVoltar` no Esc) é renderizado NO LUGAR do painel (troca, não pilha), como em `ab-end-test-dialog.tsx:208`, para um Esc não fechar os dois.
- Envio: botão vira "Aplicando…" com `aria-disabled`, opções `inert`, `aria-busy` no diálogo, status "Mudando no YouTube. Aguarde, não feche esta janela."; **Esc, X, Cancelar e clique fora não fecham enquanto aplica**. `precisa_confirmar` → `AbConfirmarTrocaDialog` e "Aplicar mesmo assim" reenvia com `forcar: true` (só para variante). Falha do servidor → mensagem de `mensagemDeFalha` em `role="alert"` com foco, a escolha fica marcada, primário vira "Tentar de novo"; `ja_encerrado`/`mudou` → mensagem do servidor + "Recarregar"; `sem_permissao` com `unauthenticated` → `hrefDoLogin()`. Exceção na chamada → `sessaoExpirou()` decide entre sessão expirada e "rede" (`mensagemDeFalha(...,{tipo:'rede'})`). Sem resposta em `ESPERA_SEM_RESPOSTA_MS` → mensagem de rede e "Recarregar". Feito → título "Feito", texto de `mensagemDeFeito` (hoje em dd/mm SP), "Fechar" com foco, `router.refresh()`. Foco inicial: opção marcada, senão a primeira escolhível. A 390 px: folha de baixo com o primário fixo no pé (Naksu r4 item 5).

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('ativo: escolher C chama acoes.encerrar(testId, { destino: "variante", varianteId: "vc", seqVisto })', () => {})
it('ativo sem sugerida: nada marcado; clicar em "Escolha uma versão" NÃO chama acoes.encerrar (aria-disabled não bloqueia clique, o handler começa com `if (!escolhaId) return`); marcar C e clicar chama encerrar com C e o botão diz "Encerrar e deixar C no ar"', () => {})
it('aviso "escolher encerra o teste agora" aparece no topo e junto ao primário, com role="status" em UM só', () => {})
it('ativo: escolher A chama encerrar com { destino: "original", seqVisto }', () => {})
it('concluído: confirmar chama aplicarSugerido(testId, "vb", seq); aplicado chama voltar(testId, seq)', () => {})
it('opção "Em breve" está disabled e não pode ser marcada', () => {})
it('durante Aplicando…: Esc, X, Cancelar e clique no fundo não chamam onFechar', async () => {})
it('falha: mostra "Não consegui aplicar C. B continua no ar." com role alert e o botão "Tentar de novo"', async () => {})
it('rejeição da promessa sem sessão expirada: mensagem de conexão caída', async () => {})
it('precisa_confirmar abre a confirmação e "Aplicar mesmo assim" reenvia com forcar true', async () => {})
it('promessa que resolve em 46 s (fake timers): continua "sem resposta", sem "Feito"', async () => {})
it('Esc na confirmação volta ao painel e não chama onFechar', async () => {})
it('falha depois de desmontar chama onAviso e não lança', async () => {})
it('feito: "Teste encerrado. C no ar desde 26/10. Você escolheu C; o teste indicava B." e refresh', async () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** O handler do primário começa com `if (!escolhaId || travado) return` (`aria-disabled` só informa o leitor de tela; Yannis R3). Painel ativo sem sugerida: estado `g-sem-sugerida` do mockup r6. Um só envio por vez (`useRef` de voo, como `ab-end-test-dialog.tsx:146-150`), mais a guarda de fechar, `expirou` e `montado` descritos acima.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: painel O que fica no vídeo na página do Lab (M7 T8)"`.

**Pronto quando:** cada um dos estados g, g1, g2, g3, h e h2 do mockup é alcançável no teste com um stub de action, e nenhum caminho fecha o painel com a escrita em voo.

---

### Task 9: Diálogo "O que o Studio mostrou?" (dia 14) e textos

**Estimativa:** ~90K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/dialogo-dia-14.tsx`
- Modify: `apps/web/src/lib/youtube/teste-youtube/nativo/frases.ts` (bloco `dia14`)
- Modify: `_components/caminho-nativo/dia-14-pergunta.tsx`
- Test: `apps/web/test/ab-lab-pagina-dialogo-dia-14.test.tsx`; ajustar `apps/web/test/ab-lab-dia-14-pergunta.test.tsx`

**Interfaces:**
- Consumes: `Dia14Pergunta`, `versoesDoDia14`, `AcoesDia14` (`dia-14-pergunta.tsx`), `responderTesteDoYouTube`, `mudarRespostaDoTesteDoYouTube` (por props).
- Produces: `Dia14PerguntaProps` ganha `embutido?: boolean` (sem `h3` próprio, sem `FaixaCaminho`/`SeloCaminho` de topo) e `aoNaoViAinda?: () => void` (quando presente, o botão "Não vi" vira "Não vi ainda" e chama a função em vez da action); `DialogoDia14Props { linha: LinhaDoCaminho; acoes: Pick<AcoesCaminho, 'responderTesteDoYouTube' | 'mudarRespostaDoTesteDoYouTube'>; atualizar: () => void; onFechar: () => void }`.
- `FRASES.dia14`: `responder: 'Dizer o que o Studio escolheu'`, `responderCurto: 'Qual ganhou no Studio?'`, `naoViAinda: 'Não vi ainda'`, `tituloDialogo: 'O que o Studio mostrou?'`, `apoioDialogo: 'O Lab não lê o resultado do Studio. Conte aqui para o histórico ficar certo. Responder não muda o YouTube; o Studio já aplicou a versão dele.'`, `certo: 'Certo'`, `avisoContinua: 'O aviso continua até você responder.'`, `abrirNoStudio: 'Abrir no Studio'`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('foco inicial no título do diálogo (tabIndex -1), não na primeira resposta (Enter não grava por engano)', () => {})
it('com 3 versões mostra "A (original) ficou", "B venceu", "C venceu", "Ficou igual", "Inconclusivo", "Não vi ainda"', () => {})
it('"C venceu" chama responderTesteDoYouTube com venceu_nova e n = 3', async () => {})
it('"Não vi ainda" não chama action nenhuma e mostra "Certo" + "O aviso continua até você responder."', () => {})
it('depois de registrar: "Registrado: a versão C ficou no ar." + "Mudar resposta" + "Fechar"; Fechar chama atualizar', async () => {})
it('Esc fecha fora do envio e devolve foco ao botão que abriu', () => {})
it('nenhum texto do diálogo diz que o Lab leu o Studio', () => { expect(screen.queryByText(/o Lab leu|lido do Studio/i)).toBeNull() })
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `DialogoDia14` = `YtPortal` + `role="dialog"` `aria-modal` + `h2#dl14-t tabIndex=-1` com `tituloDialogo`, `apoioDialogo` + link "Abrir no Studio", `<Dia14Pergunta embutido modo="responder" aoNaoViAinda={…} />`. A pergunta inline da lista continua com "Não vi" e grava `nao_vi` (sem `aoNaoViAinda`). O botão da linha da lista passa a ler `FRASES.dia14.responder` (troca o "Responder").
- [ ] **Step 4: Rodar o novo e `test/ab-lab-dia-14-pergunta.test.tsx`, `test/ab-lab-dia-14-respondido.test.tsx`, `test/ab-lab-lista-caminho.test.tsx`** → PASS (ajuste só os textos trocados).
- [ ] **Step 5: Commit** — `git commit -m "feat: diálogo Dizer o que o Studio escolheu (M7 T9)"`.

**Pronto quando:** cada resposta do diálogo grava `resposta_dono` pelo servidor que já existe (critério M7-b), "Mudar" troca, e "Não vi ainda" não grava.

---

### Task 10: "Vídeos do canal" recolhido com busca e filtro

**Estimativa:** ~130K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/videos-do-canal.tsx`
- Modify: `_components/caminho-nativo/lista-caminho.tsx` (prop `agrupar?: boolean`, padrão `true`; com `false` some o resumo `cn-sum`, os cabeçalhos de grupo e a linha `cn-lhd`)
- Modify: `_components/caminho-nativo/lista-caminho-paineis.tsx` (repassa `agrupar`)
- Modify: `_components/caminho-nativo/linha-caminho.tsx` (rótulo do dia pelo `rotuloDoDia`, "Ver teste" único) e `_components/caminho-nativo.css` (regra `.cn-vrow .cn-btn{min-height:44px}`; `.cn-btn` global fica como está)
- Test: `apps/web/test/ab-lab-linha-caminho-dia.test.tsx` (novo)
- Test: `apps/web/test/ab-lab-pagina-videos-do-canal.test.tsx`

**Interfaces:**
- Consumes: `lerVideosDoCanal` (Task 6, por prop), `ListaCaminhoComPaineis`, `ACOES` de `lista-caminho-servidor.tsx`.
- Produces: `VideosDoCanalProps { inicial: PaginaDoCanal; videoInicial: string | null; acoes: AcoesCaminho; ler: (p: z.infer<typeof PedidoVideosDoCanalSchema>) => Promise<ResultadoVideosDoCanal> }`.
- Textos (mockup `index.html:102-116`): `<details>` com summary "Vídeos do canal" + "{t} com volume para testar, {s} sem" (+ ", {n} sem volume lido" quando `naoLido > 0`; + " (dos 2.000 mais recentes)" quando `truncado`, e a busca avisa que só procura neles); o chip ativo inicial é `inicial.filtroEfetivo`; busca `type="search"` placeholder "Buscar por título" `aria-label="Buscar vídeo"`; chips "Testáveis" (padrão, `aria-pressed`) e "Todos"; grupo "{s} vídeos com poucas impressões por dia (menos de 220). Escolha “Todos” para ver."; rodapé "Mostrando {k} de {total} testáveis" + "Mostrar os {resto} restantes" (até 20 por clique: "Mostrar mais 20" quando resto > 20); vazio com busca "Nenhum vídeo com “{busca}”." + "Limpar busca"; vazio de "Testáveis" sem busca por `motivoNaoLido`: `sem_leitura` → "O volume dos vídeos não pôde ser lido (sem acesso ao Analytics do canal). Escolha “Todos” para ver os vídeos."; `falha` → "Não deu para ler o volume agora." + "Tentar de novo"; `poucos_dias` → "O volume ainda está sendo lido (menos de 3 dias de relatório). Escolha “Todos”."; carregando = 3 linhas esqueleto; erro = "Não deu para ler os vídeos." + "Tentar de novo".
- **Consertos da linha (desvio 6, Hanna H4 a H6 + Yannis R1/R4):**
  - **44 px:** `.cn-vrow .cn-btn{min-height:44px}` (hoje `caminho-nativo.css:90` dá 36 px no mouse e só `:98` sobe para 44 em `pointer:coarse`). Teste lê a regra; o Gio mede na T14.
  - **Mesmo dia e mesmo teto (R1):** `linha-caminho.tsx:173-182` hoje escreve "Dia {diaDe14} de 14" e "dia {nosso.dia} de 14" a partir de `diaDoTeste` (0-based): no 1º dia diz "dia 0 de 14". Passa a escrever `rotuloDoDia(nosso.dia, nosso.teto)` (teto vem do dado da linha, T6) e, no registro do Studio, `rotuloDoDia(diaDe14, 14)` (o Studio tem 14 dias; `rotuloDoDia` é pura em `(dias, teto)`). A linha e o cartão leem a mesma fonte.
  - **"Ver teste" único (R4):** o texto visível é "Ver teste" em toda a página; o nome acessível é `aria-label="Ver teste de {nome}"` (contém o texto visível e começa por ele, WCAG 2.5.3 "Label in Name"); a string "Abrir teste" deixa de existir.
  - **H1 (lista a 390):** a quebra abaixo de 640 px já existe (`lista-caminho.css:47-55`, `@container (max-width:640px)`) e depende de `container-type:inline-size` em `.cn-raiz` (`caminho-nativo.css:40`). A T10 mantém a lista dentro de `.cn-raiz` (teste: `container.querySelector('.cn-raiz .cn-vrow')` existe); o Gio prova a 390 com título de 100 caracteres (T14).
- **Estado do cliente depois de `router.refresh()` (Yannis M-a):** `VideosDoCanal` guarda as linhas anexadas em estado; depois de encerrar/aplicar a página relê e `inicial` muda, mas o anexo ficaria velho. O componente reseta o estado quando `inicial` muda (`key` derivada de `inicial.linhas.map(l => l.videoId + l.estado)` no pai, ou efeito que reconcilia).
- Anexo: ao pedir a página seguinte, o cliente junta as linhas por `Map<videoId, linha>` (nunca `key` repetida); `contagem` do resumo vem sempre da última resposta e é a do canal.
- Busca: ao cair de 2+ letras para menos de 2, o cliente faz um pedido com `busca: null` (mesmo contador de pedido, descartando o termo velho se ainda em voo).
- Estado na URL: aberto = `?videos=1` (`history.replaceState`, como o mockup `:180`); `?video=<id>` abre o `<details>` e manda `incluirYtId`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('começa recolhido; com ?video= começa aberto', () => {})
it('digitar espera 350 ms e chama ler uma vez; menos de 2 letras não chama', async () => { /* fake timers */ })
it('resposta antiga que chega depois da nova é descartada', async () => {})
it('trocar para "Todos" pede filtro todos e página 0', async () => {})
it('"Mostrar os 11 restantes" pede a página seguinte e anexa as linhas', async () => {})
it('falha mostra "Não deu para ler os vídeos." e "Tentar de novo" repete o último pedido', async () => {})
it('a lista não mostra os cabeçalhos "Precisa de você"/"Outros vídeos" (agrupar false)', () => {})
it('"ag" → resposta → apagar para "a": ler é chamado com busca null e a lista volta à inicial; "ag" ainda em voo é descartado', async () => {})
it('depois de router.refresh() (inicial novo), o anexo antigo some e a linha mostra o estado novo', () => {})
it('anexo com linha repetida entre páginas não duplica (Map por videoId)', async () => {})
it('Testáveis vazio sem busca mostra a frase do motivoNaoLido; filtroEfetivo "todos" abre com o chip Todos ativo', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (contador de pedido em `useRef`; `AbortController` não se aplica a server action, por isso o descarte é por número).
Testes de `ab-lab-linha-caminho-dia.test.tsx`:
```tsx
it('nosso iniciado há 0 dias com teto 15: linha e cartão dizem "Dia 1/15"; Studio no 3º dia (diaDe14 = 3) diz "Dia 4/14"; o texto da linha não contém " de 14"', () => {})
it('getByRole("link", { name: /^Ver teste/ }) acha o link da linha; a string "Abrir teste" não existe na página', () => {})
it('a linha da lista está dentro de .cn-raiz', () => {})
```
- [ ] **Step 4: Rodar o novo, `ab-lab-linha-caminho-dia.test.tsx` e `test/ab-lab-lista-caminho.test.tsx`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: Vídeos do canal recolhido com busca no servidor (M7 T10)"`.

**Pronto quando:** com 300 vídeos a página abre sem a lista expandida e a busca não manda mais de um pedido por pausa de digitação.

---

### Task 11: Composição da página na ordem nova, Concluídos e Sugestões

**Estimativa:** ~150K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/secao-concluidos.tsx`
- Modify: `_components/ab-lab-dashboard.tsx`, `_components/bloco-sugestoes.tsx`, `_components/pagina/corpo-do-lab.tsx`
- Test: `apps/web/test/ab-lab-pagina-composicao.test.tsx`; ajustar `apps/web/test/ab-dashboard.test.tsx`, `apps/web/test/ab-lab-dashboard-d8.test.tsx`, `apps/web/test/ab-lab-gio-fix1*.test.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 4–10.
- Produces: `AbLabDashboardProps` passa a ser `{ pagina: PaginaDoLab; settings; siteId; eligibleVideos; drafts; iniciarTeste; avisoDeVolume?; acoesDecisao: AcoesDecisao; acoesCaminho: AcoesCaminho; lerVideos: VideosDoCanalProps['ler']; listaInicial: PaginaDoCanal; videoInicial: string | null; blocoSugestoes?: ReactNode; learnings: LearningsData | null; channelLearnings: ChannelLearningsData | null }`. `corpo-do-lab.tsx` monta `acoesDecisao = { encerrar: endAbTest, aplicarSugerido, voltar: revertWinner }` (importadas no servidor) e `acoesCaminho = ACOES` (exportar `ACOES` de `lista-caminho-servidor.tsx:16` ou movê-lo para `corpo-do-lab.tsx`; apagar `ListaCaminhoServidor` se ficar sem uso). `listaInicial` e `eligibleVideos` vêm de `lerPaginaDoLab` (Task 5); a T11 não faz leitura nova. O seletor mantém a ligação `onContinuarRascunho` → `handleContinueDraft` entregue pela T16 (envio 1).
- Ordem renderizada: (1) topo `h1` "A/B Lab" + ferramentas "Biblioteca" (link para `/cms/youtube/ab-lab/library`, `next/link` importado no próprio client), "Todos os tipos" (filtro existente), "Ajustes" (`aria-label="Configurações"`), "Novo teste" primário + `p.resumo` com `pagina.topo.frase`; (2) Com você; (3) Em teste agora; (4) `blocoSugestoes`; (5) Concluídos; (6) Vídeos do canal; diálogos (painel, dia 14, assistente, ajustes, seletor) fora do fluxo. Some: KPI strip, `DraftsBlock` (rascunho virou item de Com você), Candidatos, grade de pausados (virou item ou cartão do Studio).
- `VideosDoCanal` recebe `key` derivada da `listaInicial` (ver T10, estado depois de `router.refresh()`).
- Item `dia14` da faixa abre o diálogo com a `linha` do próprio item (não procura na `listaInicial`, que muda com busca e filtro).
- Concluídos (mockup `:90-98`): cabeçalho "Concluídos" + "{n} testes"; linha com miniatura real (`thumbnail_url`), título, tipo, resultado e apoio, botão da ação quando houver (abre o painel); "Ver testes anteriores" como `button aria-disabled="true"` + selo "Em breve"; régua "Coletando dados: {k} de 3 testes concluídos" com 3 marcas e "Com 3 testes o Lab começa a mostrar o que funciona no seu canal." quando `regua`; com 3 ou mais, o `LearningsPanel` existente no lugar da régua. Sem nenhum concluído e sem história: a seção some (estado b2).
- `BlocoSugestoes`: desvio 8.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('ordem das seções por data-secao, incluindo o slot de Sugestões', () => {
  // cada seção e o slot de sugestões têm data-secao; assertar a lista completa na ordem
  const ordem = [...container.querySelectorAll('[data-secao]')].map(n => n.getAttribute('data-secao'))
  expect(ordem).toEqual(['com-voce', 'em-teste', 'sugestoes', 'concluidos', 'videos-do-canal'])
  // mutante: trocar Sugestões de lugar ou omitir o slot faz falhar (sem filter(Boolean) no-op)
})
it('fixture do teste de ordem tem as 5 seções (com Sugestões e Concluídos presentes); outro teste confere que `concluidos` está ausente no estado b2', () => {})
it('seletor de vídeo: linha com rascunhoId chama handleContinueDraft (a ligação da T16 sobrevive à reescrita das props)', () => {})
it('buscar texto sem resultado e clicar "Dizer o que o Studio escolheu" na faixa abre o diálogo com as versões (a linha vem do item)', async () => {})
it('sem faixa de KPIs e sem "Candidatos (fora da contagem)"', () => {})
it('"Ver testes anteriores" é aria-disabled e tem o selo "Em breve"; clicar não navega', () => {})
it('item "Aplicar B" e botão do Concluído abrem o mesmo painel; dia 14 abre o diálogo', () => {})
it('BlocoSugestoes com 0 itens rende uma linha "Sugestões de vídeos para testar: nenhuma agora." e "Ver detalhes"', async () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Ajustar os testes antigos que dependiam da ordem velha ou da KPI strip (apagar a asserção, não o teste inteiro, quando o comportamento continua existindo).
- [ ] **Step 4: Rodar a suíte do A/B Lab** — `npx vitest run test/ab- 2>&1 | tail -40` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: página do A/B Lab na ordem nova com Concluídos e Sugestões só quando houver (M7 T11)"`.

**Pronto quando:** a página inteira renderiza a partir do modelo e os testes do A/B Lab passam.

---

### Task 12: Verificação local completa (envio 2; o envio 1 usa a versão reduzida: Steps 1, 3 e `npx vitest run test/ab-`)

**Estimativa:** ~40K tokens (Sonnet; saídas em arquivo, só falhas no contexto).

- [ ] **Step 1:** `cd apps/web && npx tsc --noEmit > /tmp/m7-tsc.txt 2>&1; tail -5 /tmp/m7-tsc.txt` → 0 erros. (Use o scratchpad da sessão em vez de `/tmp` se houver.)
- [ ] **Step 2:** `npx vitest run > <scratch>/m7-vitest.txt 2>&1; grep -E "FAIL|Test Files|Tests " <scratch>/m7-vitest.txt` → nenhuma FAIL (~160 s; rodar em background e voltar quando sair, nunca esperar parado mais de 4 min).
- [ ] **Step 3:** `npm run build:web > <scratch>/m7-build.txt 2>&1; tail -20 <scratch>/m7-build.txt` → build ok (mudança arriscada de página: CLAUDE.md permite e pede).
- [ ] **Step 4:** sem commit (nada mudou); registrar no ledger os três resultados.

**Pronto quando:** typecheck, suíte inteira e `next build` passam.

---

### Task 13: Revisão de Phil (dados) e Yannis (software), e de Logan e Naksu (tela)

**Estimativa:** ~200K tokens no total (Phil e Yannis em Opus na 1ª revisão, effort medium; Logan e Naksu sobre capturas que o Gio gera; consertos em Sonnet).

- [ ] **Step 1: Phil** revisa `pagina-borda.ts`, `lista-borda.ts` (recorte) e `actions-nativo.ts#lerVideosDoCanal`: conta de leituras por visita (meta: 1 `ab_tests` + 1 `lerPaginaDoCanal` + 1 `ab_test_dias` na página; a busca = vídeos em blocos de 1000 + volume em lotes de 500 + formato só dos acima do piso; ordem estável, `truncado`, `motivoNaoLido`), custo de `ab_lab_volume` com 300 ids (pedir `EXPLAIN (ANALYZE, BUFFERS)` no banco local de integração `bythiago_int`, porta 54422, com dado sintético de 300 vídeos × 28 dias), "nulo nunca é zero" em volume e CTR, e o critério M7-d (no ar desde = `restore_status`).
- [ ] **Step 2: Yannis** revisa painel (concorrência do envio, CAS por `seqVisto`, Esc em voo, `precisa_confirmar`), descarte de resposta velha na busca, fronteira de erro e o `Suspense` único, e a ausência de import de action em client.
- [ ] **Step 3:** consertos em commits próprios (`fix: … (M7 T13 Phil N)`), re-revisão de emenda por Sonnet, até acordo.
- [ ] **Step 3b: Dívida técnica no ledger.** Registrar: (a) existente — `getAbTestsForSite` lê todos os testes e ciclos a cada visita (gatilho: mais de 200 testes ou leitura acima de 1 s no Sentry; conserto: concluídos paginados, 3 mais recentes + `count`); (b) criada — "Mostrar mais" e cada busca refazem a leitura inteira, O(n·p) (gatilho: canal acima de 1000 vídeos ou action acima de 2 s; conserto: cursor por `published_at`, ou cache de 30 s por `siteId`); (c) criada — duas caras de linha (cartão novo × `LinhaCaminho` antiga, 12 estados) até o M6 (gatilho: o dono reclamar ao ver o envio 2 ou o M6 escorregar para depois de jan/2027; dono e data no ledger).
- [ ] **Step 4: Logan e Naksu** revisam a tela implementada (capturas do Gio a 1440 e 390) contra o mockup r5/r6 (e r7 se existir) e os desvios 5 e 6; consertos até nota ≥ 92 dos dois.

- [ ] **Step 5: Janela do dono.** No fim desta tarefa, o controlador pede ao dono a janela e o teste escolhido para a escrita no YouTube do passo 3 da Task 14 (M7-c), para a prova do Gio não ficar parada esperando; (os desvios 5 e 6 já estão decididos).

**Pronto quando:** Phil, Yannis, Logan e Naksu dão acordo escrito no ledger e a janela do dono está marcada.

---

### Task 14: Prova na tela pelo Gio, com dado de produção

**Estimativa:** ~120K tokens (gio-qa, Sonnet, navegador só nele; capturas em arquivo).

Ambiente: `next dev` local apontando para o Supabase de produção (`.env.local`), sessão autenticada pelo `docs/ops/runbook-cms-e2e-local.md`. Escrita no YouTube só com o dono presente e um teste escolhido por ele; tudo o mais é leitura.

- [ ] **Step 1 (M7-a):** com o dado real (1 teste ativo, ~300 vídeos), o cartão do teste aparece na 1ª dobra a 1440×900 e a 390×844; "Vídeos do canal" começa recolhido.
- [ ] **Step 2 (M7-b):** num teste do Studio no dia 14 (ou registro de teste do dono), o botão diz "Dizer o que o Studio escolheu"; cada opção grava `resposta_dono` (conferir por `supabase db query --linked` de leitura, ou pedir ao dono), "Mudar" troca; nenhum texto diz que o Lab leu o Studio; "Não vi ainda" não grava. **Caminho alternativo:** se não houver nenhum teste do Studio no dia 14 em produção, a prova roda no banco de integração local `bythiago_int` (porta 54422) com um teste nativo semeado no dia 14; o M7-b fica registrado como "pendente em produção" no ledger até aparecer o primeiro caso real, e **não** é marcado como passou.
- [ ] **Step 3 (M7-c):** no ativo, escolher uma versão encerra com ela no ar (título/miniatura lidos no YouTube depois — só com o dono autorizando a escrita); no concluído, nenhum controle visível devolve `ja_encerrado`; o prazo de voltar mostrado = `revert_expires_at` (dd/mm SP).
- [ ] **Step 4 (M7-d):** cada Concluído mostra vencedor e "no ar desde" iguais a `winner_variant_id` e `restore_status` do banco; "Sem vencedor" onde não houver.
- [ ] **Step 4b:** conferir "Com você" e a frase "Próxima decisão: dd/mm" contra o banco (testes ativos, pendências reais, `started_at` + teto − 1 e prazo do dia 14); sem data calculável, a frase não aparece.
- [ ] **Step 4c (desvios 5 e 6, Hanna/Yannis):** (i) cartão do Lab ativo sem pendência tem 1 botão "Encerrar e escolher" ≥44×44 a 1440 e 390; não aparece no Studio, no `queued` nem com pendência; abre o painel sem nada marcado e confirmar fica desabilitado até haver escolha; (ii) lista "Vídeos do canal" a 390 sem rolagem horizontal, título de 100 caracteres em até 2 linhas, botão na largura cheia na linha de baixo, botões da lista ≥44 px no mouse; (iii) o mesmo teste mostra o mesmo "Dia N/teto" na linha e no cartão.
- [ ] **Step 4d (custo da busca, Phil):** medir no Sentry/rede quantas leituras e quantos ms cada busca e cada "Mostrar mais" custam (1 select + até 4 RPCs de volume); se a RPC passar de 200 ms, guardar a contagem da primeira página e não recalcular na busca (nota no ledger).
- [ ] **Step 5:** estados d e e (rede lenta e leitura falhando via DevTools), busca ("agua", texto inexistente, 1 letra), filtro "Todos", "Mostrar os N restantes", painel em "Aplicando…" com Esc, 0 overflow horizontal a 390, contraste ≥ 4,5:1, nada abaixo de 12px, alvos ≥ 44px.
- [ ] **Step 6:** relatório em `docs/superpowers/mockups/2026-10-26-lab-reordem/gio-m7-prova.md` (até 10 linhas no retorno; capturas em `…/gio-m7-shots/`); defeitos voltam como tarefas `fix:` e o Gio reprova até zerar.

- [ ] **Step 7 (pós-deploy, o dono roda; só leitura, Phil):** (a) `select count(*) total, count(*) filter (where not exists (select 1 from yt_own_video_meta_daily m where m.youtube_video_id = y.youtube_video_id and m.privacy_status is not null)) com_publico_nulo from youtube_videos y where y.site_id = '<site>' and y.published_at <= now();` (esperado: total perto de 300, `com_publico_nulo` perto de 0; documenta o risco de `publico` nulo contar como testável); (b) `explain (analyze, buffers) select * from public.ab_lab_volume('<site>', (select array_agg(id) from youtube_videos where site_id = '<site>'));` (esperado abaixo de 200 ms); (c) no resumo da tela, N + M + K = total de (a) menos os privados.

**Pronto quando:** M7-a..d passam com dado de produção (o M7-b em produção ou marcado pendente com prova local), o dono confirma e os desvios 5 e 6 (já decididos em 26/10) estão provados na tela.

---

## Ajustes do assistente e da página do teste

Acréscimo do dono em 26/10, depois de criar o primeiro teste pelo assistente (teste `bb0e0649`, Aladdin). Achados em `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/lab-reordem/achados-dono-assistente.md`. Entram aqui os itens 1, 2, 4 e 5. O item 3 (rascunhos quase invisíveis) já está coberto pelo item "Continue o rascunho" da faixa Com você (Tasks 4 e 7). Continua só tela, sem migration. As Tasks 15 a 18 formam o **envio 1** (primeiro, sequencial `T17 → T15 → T16 → T18`, sem depender das Tasks 1 a 6, antes da reordem). A verificação do envio 1 é a Task 12 reduzida e a prova é o parágrafo "Gio, na Task 14, também confere" abaixo; a revisão de Yannis cobre só o diff da Task 16.

**O que o código diz sobre o item 4 (24 horas × 10 dias)**, conferido em 26/10:
- `tela-v2.ts:79` diz "A primeira avaliação sai até 24 horas depois do início." **É falso como promessa.** O cron `ab-evaluate` roda uma vez por dia (`vercel.json`: `0 12 * * *`). Mas só conta dia válido (`diaValido`, `decisao-v2.ts:344`), e um dia com o alcance `aguardando` não é válido. O próprio placar calcula que um dia fecha até 11 dias depois dele: `proximo_fechamento = addDays(minAguardando, 11)`, em `placar.ts:263`. Em 24 h a avaliação roda, mas não tem dia para decidir.
- `placar-do-teste.tsx:178` diz "O primeiro dia fecha até 10 dias depois do início." quando nenhum dia foi gravado. **O sentido está certo e o número está errado:** a regra do código é 11 dias.
- "Dia 0 de 15" vem de `diaDoTeste` (`ab-dia-do-teste.ts:11`, `Math.floor`) e de `relogioV2(...).length`. Os dois contam os dias **passados**, por isso dão 0 nas primeiras 24 h. Só o rótulo muda. A conta continua igual, porque a lógica de decisão depende dela.

### Task 15: Volume no passo Revisar do assistente sem caixa vazia nem pulo (item 1)

**Estimativa:** ~50K tokens (Sonnet).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-revisar.tsx:122-137` (`AvisoVolume`), `:143-196` (banner `tituloDoBanner`, borda `--cms-ban-bd`)
- Test: `apps/web/test/ab-lab-step-revisar-volume.test.tsx`

**Interfaces:**
- Consumes: `EstadoAvisoVolume` (`use-aviso-volume.ts:13`), `CartaoDeAviso`, `seloDoAvisoDeVolume`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
it('pendente: mostra o texto "Conferindo o volume do vídeo…" com role status e aria-busy, sem caixa vazia', () => {
  render(<StepRevisar {...base} avisoVolume="pendente" />)
  expect(screen.getByRole('status')).toHaveTextContent('Conferindo o volume do vídeo…')
})
it('pendente e resolvido ocupam a mesma altura mínima (classe .rv-vol, min-height igual à do CartaoDeAviso)', () => {})
it('enquanto o volume está pendente, o banner do topo não fica com a borda verde de "pronto"', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** O estado `pendente` vira uma linha com rótulo: ícone de relógio, o texto "Conferindo o volume do vídeo…" e a barra pulsante ao lado. O contêiner fica com `min-height` igual à altura do `CartaoDeAviso` com uma linha. Assim, a troca para "Volume insuficiente" não empurra a página. O banner só usa a borda e o ícone de "pronto" (verde) quando o volume já foi lido ou deu indisponível. Com `pendente`, usa `--cms-border`. Antes de mexer, o executor reproduz a caixa verde vazia com `avisoVolume="pendente"` e confirma qual dos dois elementos a desenha (o banner ou o esqueleto). A captura do dono está em `…/images/5.png` a `14.png`.
- [ ] **Step 4: Rodar o novo e os testes do assistente** (`npx vitest run test/ab-create-wizard test/ab-lab-step-revisar`) → PASS.
- [ ] **Step 5: Commit**: `git commit -m "fix: conferência de volume do assistente com rótulo e altura fixa (M7 T15)"`.

**Pronto quando:** em nenhum momento do passo 3 aparece uma caixa sem texto, e a troca de pendente para resolvido não muda a altura do bloco.

### Task 16: "Continuar rascunho" no seletor de vídeo (item 2)

**Estimativa:** ~70K tokens (Sonnet).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:340-372` (`getEligibleVideosForPicker`: ler também `id` dos testes `draft` e expor `rascunhoId: string | null`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog.tsx` (`EligibleVideo.rascunhoId`; prop `onContinuarRascunho: (draftId: string) => void`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/linha-de-video.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx` (liga a prop a `handleContinueDraft`, a mesma função que o item "Continuar rascunho" da faixa Com você usa)
- Test: `apps/web/test/ab-lab-linha-de-video-rascunho.test.tsx`; ajustar o teste de `getEligibleVideosForPicker` em `apps/web/test/ab-dashboard-queries.test.ts`

**Interfaces:**
- Produces: `EligibleVideo.rascunhoId: string | null`; `LinhaDeVideo({ video, onEscolher, onContinuarRascunho })`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('vídeo com rascunho: a linha é clicável, mostra "Continuar rascunho" e chama onContinuarRascunho(rascunhoId)', () => {})
it('teste ativo continua bloqueado com "Teste ativo em andamento"', () => {})
it('getEligibleVideosForPicker devolve rascunhoId do teste draft do vídeo (o mais recente quando houver dois)', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `motivoDoBloqueio` deixa de bloquear o `draft`. A linha com `rascunhoId` mostra o selo "Continuar rascunho" no lugar de "Já tem um rascunho" e chama `onContinuarRascunho`. Isso fecha o seletor e abre o assistente no passo salvo, pelo `handleContinueDraft`. **O executor confirma lendo `handleContinueDraft` que ele de fato restaura o passo salvo** (Hanna não conferiu); se não restaurar, o conserto entra nesta tarefa.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: continuar rascunho a partir do seletor de vídeo (M7 T16)"`.

**Pronto quando:** dá para abrir um rascunho a partir do seletor e ele volta no passo em que o dono parou.

### Task 17: Página do teste: miniatura vazia, selo em português, prazo verdadeiro e dia contado de 1 (item 4)

**Estimativa:** ~90K tokens (Sonnet). **Primeira tarefa do envio 1; obrigatória antes da Task 7.**

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-constants.ts:22-26` (`TYPE_META`: `thumbnail` → `'Miniatura'`, `title` → `'Título'`, `combo` → `'Título e miniatura'`; `hint` em português)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste.tsx:178, 206-209`
- Modify: `apps/web/src/lib/youtube/ab-gravacao/tela-v2.ts:79`
- Create: `apps/web/src/lib/youtube/ab-rotulo-dia.ts`, com `rotuloDoDia(diasPassados: number, teto: number): string`
- Modify: os usos do rótulo do dia: `detail-header.tsx:103` e os lugares que o executor achar com `grep -rn "dayOf}\|\.dia}" src/app/cms/(authed)/youtube/ab-lab/_components`. Inclui o cartão do M7 (Task 7, selo "Dia N/teto").
- Test: `apps/web/test/ab-lab-pagina-teste-ajustes.test.tsx`; ajustar testes que fixam "Title", "Thumbnail", "24 horas", "10 dias" ou "Dia 0"

**Interfaces:**
- Produces: `rotuloDoDia(0, 15) === 'Dia 1/15'`, `rotuloDoDia(14, 15) === 'Dia 15/15'`, `rotuloDoDia(20, 15) === 'Dia 15/15'` (teto). Com `teto` menor que 1, devolve `''`. A conta `diaDoTeste` e `relogioV2` não muda.
- Produces: `PRAZO_FECHAMENTO_DIAS = 11`, exportado de `placar.ts` e usado em `placar.ts:263` , em `decisao-v2.ts:426` e nos dois textos abaixo, para o texto e a conta nunca divergirem.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('placar de teste de TÍTULO: nenhuma variante desenha caixa de miniatura vazia; a linha usa a letra e o título', () => {})
it('teste de miniatura sem imagem: "Sem miniatura" escrito, nunca um quadro vazio', () => {})
it('selo de tipo em português: "Título", "Miniatura", "Título e miniatura"', () => {})
it('sem dia válido (tela v2): principal "Ainda não decide: o YouTube ainda não fechou nenhum dia." e apoio "O YouTube fecha cada dia com até 11 dias de atraso. O Lab confere uma vez por dia."', () => {})
it('placar sem dia gravado: "O primeiro dia fecha até {dd/mm}." com dd/mm = dia do Pacífico do início + 11 (nunca "10 dias")', () => {})
it('started_at = 2026-10-27T02:30:00Z (23h30 BRT de 26/10; dia do Pacífico 26/10) → "06/11", não "07/11"', () => {})
it('provisorioAte de decisao-v2 usa PRAZO_FECHAMENTO_DIAS (nenhum 11 literal restante)', () => {})
it('rotuloDoDia: 0→"Dia 1/15", 14→"Dia 15/15", 20→"Dia 15/15"', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** No placar, a miniatura só aparece quando `test_type` é `thumbnail` ou `combo`. Em teste de título, a linha começa pelo chip da letra, que já existe, sem o `span.pm4-th` vazio. Se o tipo é miniatura e falta a imagem, a linha escreve "Sem miniatura" no quadro. O texto sem dia gravado usa `proximo_fechamento` quando existe. Senão, calcula `addDays(dayPt(new Date(started_at)), PRAZO_FECHAMENTO_DIAS)` (o placar conta em `day_pt`, `America/Los_Angeles`, `coleta/day-pt.ts:9-11`) formatado a partir da string `AAAA-MM-DD` sem passar por `Date` com fuso, passado ao placar como prop `inicio`; somar 11 ao dia de São Paulo daria 1 dia a mais que `proximo_fechamento` para testes iniciados entre 21h e 23h59 de Brasília. `decisao-v2.ts:426` (`provisorioAte = addDays(enc, 11)`) passa a usar a mesma constante. A tela v2 deixa de prometer 24 horas.
- [ ] **Step 4: Rodar o novo e `npx vitest run test/ab-` (só falhas)** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "fix: página do teste com selo em português, prazo de 11 dias e dia contado de 1 (M7 T17)"`.

**Pronto quando:** na página do `bb0e0649`, o placar não tem quadro vazio, o selo diz "Título", os dois textos de prazo dizem a mesma regra (11 dias) e o primeiro dia aparece como "Dia 1/15".

### Task 18: A página do teste diz que é teste do Lab, não do Studio (item 5)

**Estimativa:** ~40K tokens (Sonnet).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/detail-header.tsx` (linha de explicação sob o título, para testes do Lab em `active` ou `paused`)
- Test: `apps/web/test/ab-lab-detalhe-origem.test.tsx`

- [ ] **Step 1: Escrever o teste que falha.** Num teste de título em andamento, a página mostra o texto "Teste do A/B Lab: o Lab troca o título público do vídeo no YouTube em rodízio, uma versão por vez. Não é o “Testar e comparar” do Studio." Em teste de miniatura, troca "o título" por "a miniatura". Em combo, por "o título e a miniatura".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** a frase como `p` com 13px e `--cms-text-muted`, sem ícone de alerta. Cópia proposta pelo plano: Logan e Naksu a confirmam na Task 13.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: página do teste explica que o teste é do Lab (M7 T18)"`.

**Pronto quando:** quem abre a página de um teste do Lab lê, sem clicar, que o Lab troca o título ou a miniatura públicos em rodízio e que não é o teste do Studio.

**Prova do envio 1 (Gio; o mesmo conteúdo vale como parte da Task 14 do envio 2, sem repetir o que já passou):** passo 3 do assistente sem caixa vazia nem pulo (com a rede lenta); "Continuar rascunho" no seletor; o `bb0e0649` com o placar sem quadro vazio, o selo "Título", o prazo de 11 dias e "Dia N/15" começando em 1; a frase de origem do Lab.

## Ordem e paralelismo

Ver "Dois envios e ordem obrigatória" no topo (fonte única). Resumo: **envio 1** = `T17 → T15 → T16 → T18` + verificação curta + Yannis só no diff da T16 + prova do Gio (~365K); **envio 2** = `T1 → T2 → T3 → T4 → T6 → T5 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14` (~1,73M). T17 antes da T7 e T6 antes da T5 são obrigatórias; uma leitura só de `lerPaginaDoCanal`; agentes sequenciais no mesmo worktree.

## Fora do M7 (não implementar)

- M7b: aplicar outra versão ou "manter a original" num teste concluído (action nova + estado novo no banco; a escolha do dono separada do vencedor para não contaminar `getLearnings`).
- M8: aba "Resultados" (antes × depois com linha de base) e o destino do link "Ver testes anteriores".
- Item "Volte à original" com comparação de CTR (desvio 1) e a linha simplificada da lista (desvio 6, M6).

## Achados r1 → onde foi tratado

Revisões: `yannis-plano-r1.md` (Y), `phil-plano-r1.md` (P), `hanna-plano-r1.md` (H), em `.superpowers/sdd/ab-lab/lab-reordem/`.

| Achado | Tratado em |
|---|---|
| Y1 lista inicial sem dono, leitura dupla (T6 → T5) | "Dois envios e ordem"; T5 (fluxo, `listaInicial`, `eligibleVideos`, teste de contagem de chamadas); T6 (depende das T1–T4); T11 (consome da borda) |
| Y2 `outroTesteAberto` não especificado | T5 (`Set` na borda + teste); T3 (teste da linha sem ação); Review Focus 6 |
| Y3 item `dia14` sem a linha | T4 (`linha` no item + teste); T7 (`onAbrirDia14(linha)`); T11 (teste buscar sem resultado) |
| Y4 site sem leitura privada abre lista vazia | T6 (`filtroEfetivo`, teste); T10 (chip inicial e frases) |
| Y5 extras duplicam; contagem com busca | T6 (paginação sem extras, `contagem` do canal, testes); T10 (anexo por `Map`, teste) |
| Y6 fechar em voo, `expirou`, `montado`, confirmação no lugar | T8 (guarda `travado`, `expirou`, `montado`, troca no lugar, 3 testes) |
| Y7 busca de 2 para 1 letra deixa resultado velho | T10 (pedido `busca: null` + teste); Review Focus 1 |
| Y8 ordem, T17 antes da T7, T16 × T11, paralelismo | "Dois envios e ordem"; T11 (teste do rascunho no seletor); T7 (consome `rotuloDoDia`); Global Constraints (agentes sequenciais) |
| Y9 `podeDeixarVariante` por caminho paralelo | T5 (`requireSiteAdminScope(...).ok`, o mesmo valor de `useCanAdminSite`; teste do editor) |
| Y10 `ACOES` não exportado | Mapa de arquivos (Modificar); T11 |
| Y11 `ddmmSp` duplica `dataCurtaSp` | Global Constraints; T2 (`ab-data-curta.ts`, `diaMesSp`) |
| Y12 testes `queued` em `ativos` | Desvio 5; T2 (painel só `active`); T4 (`painel` nulo + teste); T7 |
| Y13 `lerDiasDosTestes` devolve `invalidos` | T5 (CTR nulo, resto normal, teste) |
| Y14 teste de ordem com mutante sobrevivente | T11 (`data-secao` incluindo o slot) |
| Y dívida técnica (existente e criada) | T6 (nota); T13 Step 3b (ledger) |
| P-I1 `listaInicial` sem origem, leitura dobrada | = Y1 (T5, T6, T11) |
| P-I2 paginação sem desempate | T6 (`order(id)`, desempate em JS, teste 20/21) |
| P-I3 teto de 2000 corta em silêncio | T6 (`truncado`, teste 2.001); T10 (texto "dos 2.000 mais recentes") |
| P-I4 leitura ausente/falha de volume | T6 (`motivoNaoLido`, `try/catch`, testes); T5 (teste da página montando); T10 (frases) |
| P-M1 contagem muda com a busca | = Y5 (T6, T10) |
| P-M2 dia do Pacífico e constante com terceiro uso | T17 (teste `06/11`, `dayPt`, `decisao-v2.ts:426`); Global Constraints |
| P-M3 lotes de 100 triplicam idas | T6 (`LOTE_DE_VOLUME = 500`); T13 |
| P-M4 `original_title` nulável | T1 (`?? test.name`, "título não gravado", teste) |
| P-M5 `publico` nulo conta como testável | T6 (comentário e teste); T14 Step 7 (SQL de conferência pós-deploy) |
| P conferências pós-deploy (SQL de leitura) | T14 Step 7 |
| H1 fatiamento em 2 envios | "Dois envios e ordem"; Ordem e paralelismo; Ajustes do assistente |
| H2 conflito T17 × T7 | "Dois envios e ordem" (T17 primeiro); T7 Consumes; T17 marcada como primeira |
| H3 desvios 5 e 6 pendentes do dono | Desvios 5 e 6 (decididos 26/10 por Hanna, Logan e Naksu); "Perguntas ao dono"; T14 Pronto quando |
| H4 copy nova fora do mockup | "Perguntas ao dono" item 3 (mostrar junto do envio 1) |
| H5 M7-b sem onde ser provado | T14 Step 2 (caminho alternativo em `bythiago_int`, "pendente em produção") |
| H6 M7-c precisa do dono presente | T13 Step 5 (janela do dono) |
| H7 "Com você" e "Próxima decisão" sem conferência | T14 Step 4b |
| H "não conferi": `handleContinueDraft` restaura o passo | T16 Step 3 (executor confirma no código) |

## Achados da re-revisão r2 → onde foi tratado (r3)

Revisões: `yannis-plano-r2.md` (91/100, acordo com 4 emendas), `phil-plano-r2.md` (93/100, acordo), `hanna-desvios.md`, em `.superpowers/sdd/ab-lab/lab-reordem/`.

| Achado | Tratado em |
|---|---|
| Yannis R1 teto no dado da linha e dia 0-based ("dia 0 de 14") | T6 (`nosso.teto = duracaoPrevista(config)`, `config` no select, teste); T10 (`rotuloDoDia(nosso.dia, nosso.teto)`, Studio `rotuloDoDia(diaDe14, 14)`, testes "Dia 1/15" e "Dia 4/14") |
| Yannis R2 botão no cartão: HTML válido e 4 casos | T7 (cartão não é `<a>`, botão irmão do link, testes `a button` nulo e os 4 casos com mutante) |
| Yannis R3 `aria-disabled` não bloqueia clique; aviso duplicado; rótulo irreversível | T8 (`if (!escolhaId) return`, `role="status"` em um só, testes); T2 (`rotuloDoBotao` ativo "Encerrar e deixar C no ar" / "Encerrar e manter A (original)") |
| Yannis R4 "Ver teste" × `aria-label` (WCAG 2.5.3) | T10 (`aria-label="Ver teste de {nome}"`, teste do link por nome) |
| Yannis M-a estado do cliente depois de `router.refresh()` | T10 (reset do anexo) e T11 (`key`), teste |
| Yannis M-b extras e "testes nossos" | T5 (frase corrigida, extras escapam do filtro de privados, teste do cartão fora da janela) |
| Yannis M-c custo da busca por tecla | T6 (dívida), T13 Step 3b, T14 Step 4d |
| Yannis M-d fixture do teste de ordem | T11 (fixture com as 5 seções; `concluidos` ausente no b2) |
| Yannis Y11 teste de fronteira de `diaMesSp` (2026-10-27T02:30Z → 26/10; nulo/inválido → vazio) | T2 (testes) |
| Yannis H1 lista dentro de `.cn-raiz` | T10 (teste `.cn-raiz .cn-vrow`); T14 Step 4c (390 com título de 100 caracteres) |
| Phil menor: busca relê volume do canal inteiro | T6 (dívida), T13 Step 3b, T14 Step 4d (medir; guardar a contagem se RPC > 200 ms) |
| H-desvio 5 (entra no envio 2, "Encerrar e escolher", painel ativo sem sugerida, r6/r7) | Desvio 5; T7; T8; T14 Step 4c |
| H-desvio 6 (`LinhaCaminho` fica; 44 px, mesmo dia/teto, "Ver teste"; invólucro no M6) | Desvio 6; T10; T13 Step 3b (c); T14 Step 4c |
| Hanna H1 a H6 (bloqueio a 390, texto, envio, dia, nome, 36 px) | = linhas acima (T7, T8, T10, T14) |
