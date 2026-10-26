# M7 — Página do A/B Lab reordenada: plano de implementação (r1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página `/cms/youtube/ab-lab` passa a abrir, nesta ordem: cabeçalho com frase, faixa "Com você", "Em teste agora", Sugestões (só quando houver), "Concluídos" (vencedor e "no ar desde") e "Vídeos do canal" recolhido com busca no servidor; com o painel "O que fica no vídeo?" e o diálogo "O que o Studio mostrou?" do dia 14. Só tela, sem migration.

**Architecture:** Toda decisão de conteúdo sai de módulos PUROS em `apps/web/src/lib/youtube/ab-lab-pagina/` (entram os testes, as linhas do caminho e os dias do placar já lidos; sai o modelo da página). Uma borda de servidor (`pagina-borda.ts`) lê o banco uma vez, dentro de um `<Suspense>` da página, e entrega o modelo ao cliente. Os componentes de cliente só desenham o modelo e chamam as actions recebidas por props (as que já existem: `endAbTest`, `aplicarSugerido`, `revertWinner`, `responderTesteDoYouTube`, `mudarRespostaDoTesteDoYouTube`, mais a action nova de leitura `lerVideosDoCanal`).

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript 5 strict, Tailwind 4 + tokens `cms-*`, Zod, Vitest + Testing Library (jsdom/happy-dom), Supabase (service client só na borda).

**Spec (o que este plano implementa; o executor lê os dois):**
- Mockup aprovado pelo dono em 26/10 (r5): `docs/superpowers/mockups/2026-10-26-lab-reordem/index.html` — abrir com `?estado=<a|b|b2|c|d|e|f|g|g1|g2|g3|h|h2|i>&largura=<1440|390>`.
- Decisões e escopo: `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/lab-reordem/sintese-r1.md` (decisões do dono no fim), `hanna-r4.md` (critérios de aceite M7-a..d), `logan-r4.md`, `logan-mockup-r4.md`, `naksu-mockup-r4.md`.

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
- Gates: pre-commit (`build:packages` + typecheck) a cada commit; `npx vitest run` completo e `npm run build:web` antes de pedir a prova do Gio (mudança arriscada de página).
- Commits só por caminho explícito (`git add <arquivos>`), nunca `git add -A`: outros terminais trabalham no mesmo branch. Não tocar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`.
- A cada tarefa concluída, o controlador atualiza a página de status da frente (kit `~/.claude/status-kit/`).

## Desvios decididos em relação ao mockup (o dado real vence)

1. **"Volte à original" com "o CTR caiu de 4,8% para 3,6%" (estado f)** não entra em "Com você": é comparação antes × depois, que é do M8 (Hanna, achado 4). No M7 a volta fica na linha do Concluído ("Voltar à original até dd/mm").
2. **"Não vi ainda" (estado i)** fecha o diálogo com "Certo — O aviso continua até você responder." **sem chamar o servidor** (o servidor grava `nao_vi` e encerra o registro como `sem_desfecho`, o que tiraria o item de "Com você" e contradiria o texto aprovado). A resposta `nao_vi` continua disponível na linha da lista, como hoje.
3. **Falha no ativo:** o mockup diz "A original continua no ar"; no teste ativo quem está no ar é a versão da rotação. O texto usa a letra lida (`noArAgora`): "Não consegui aplicar C. B continua no ar." (quando a do ar é a original: "A original continua no ar.").
4. **Sugerida no ativo:** teste ativo da regra v2 não tem vencedor sugerido gravado (só `sinal` quando os pisos fecham). O painel ativo marca "Sugerida pelo teste" só quando `result_metadata.v2.vencedor_sugerido` existir; sem ela, nada vem pré-marcado e o botão fica "Escolha uma versão" (desabilitado com `aria-disabled`).
5. **Entrada do painel ativo:** cada cartão de teste do Lab em andamento ganha o botão secundário "Escolher o que fica" no rodapé (o mockup só mostra o painel a partir de uma pendência). Logan e Naksu confirmam na revisão da tela (Tarefa 13).
6. **Linhas de "Vídeos do canal"** mantêm a `LinhaCaminho` atual (ficha do Studio, "Já iniciei", cartão S7, `?video=`), sem os cabeçalhos de grupo nem o resumo próprio; o mockup mostra uma linha simplificada, que fica para o M6 (assistente novo). Muda a fonte (busca, filtro, páginas de 20), não a linha.
7. **Candidatos (fora da contagem) e a faixa de KPIs saem da página** (síntese r1: "sem faixa de KPIs"; o mockup não tem Candidatos). `getSuggestedVideos` deixa de ser chamado pela página; a função fica.
8. **Sugestões vazias:** com 0 itens o bloco vira uma linha discreta: "Sugestões de vídeos para testar: nenhuma agora." (`motivoVazio = 'nunca-calculado'` → "…: ainda não calculadas."), com o link "Ver detalhes" para `link.sugestoes()`. Sem acesso: nada.

## Review Focus

1. **Canal com 300+ vídeos e busca digitada rápido:** respostas fora de ordem não podem sobrescrever a busca mais nova (descartar resposta com número de pedido antigo) e cada tecla não pode disparar uma ida ao servidor (espera de 350 ms; menos de 2 letras = sem busca). Teste em `videos-do-canal.test.tsx` (Tarefa 10).
2. **Volume não lido (menos de 3 dias, ou sem prova de leitura) nunca conta como "sem volume" nem como "testável":** vai para um terceiro grupo, "volume ainda não lido". Teste em `lista-borda-recorte.test.ts` (Tarefa 6).
3. **Prazo de voltar no limite:** `revert_expires_at` vencido há 1 segundo não pode mostrar o botão (o servidor recusaria). Teste em `painel-decisao.test.ts` (Tarefa 2) e em `concluidos.test.ts` (Tarefa 3).
4. **Fechar o painel durante "Aplicando…"** (Esc, X, clique fora, Cancelar) não fecha nem perde o resultado; ao responder, o painel mostra o desfecho. Teste em `painel-o-que-fica.test.tsx` (Tarefa 8).
5. **Título e acento na busca:** "agua" acha "Água de coco em Bangkok"; `%` e `_` digitados são texto, não curinga. Teste em `lista-borda-recorte.test.ts` (Tarefa 6).

---

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

**Modificar:**
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
- Produces: `AbTestCardView.variants: Array<{ id: string; label: DisplayLabel; color: string; thumbUrl: string | null; title: string | null; isOriginal: boolean }>`; `AbTestCardView.restoreSeq: number`; `AbTestCardView.videoTitle: string | null` (título do vídeo, `original_title`).

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
```
`fixture()` monta um `AbTestWithVariants` mínimo (copie o padrão de `apps/web/test/ab-dashboard-queries.test.ts`).

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run test/ab-lab-pagina-cartao-view.test.ts` → FAIL (`title` undefined).
- [ ] **Step 3: Implementar** — em `toCardView`: `title: v.title_text ?? (v.is_original ? test.original_title ?? null : null)`, `id: v.id`, `isOriginal: v.is_original`; `restoreSeq: test.restore_seq ?? 0`; `videoTitle: test.original_title ?? null`. Ajustar o tipo em `ab-types.ts`. Mocks que montam `AbTestCardView` (grep `AbTestCardView` em `mock-views.ts` e `apps/web/test/`) ganham os campos novos.
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
- Consumes: `TelaV2` (`apps/web/src/lib/youtube/ab-gravacao/tela-v2.ts`), `ctrDosValidos` (`decisao-v2.ts:243`), `lerResultadoV2` (`ab-types.ts:265`).
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
  - `ddmmSp(iso: string): string` (dd/mm em São Paulo)

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
    expect(rotuloDoBotao(pComSugB, 'vc')).toBe('Aplicar C ao vídeo')
    expect(rotuloDoBotao(pComSugB, 'va')).toBe('Manter A (original)')
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
- [ ] **Step 3: Implementar** — `voltarAte = tela.voltar && revertExpiresAt ? ddmmSp(revertExpiresAt) : null`, conferindo também `Date.parse(revertExpiresAt) > agora` (dupla guarda); concluído `padrao` = sugerida (não aplicada) ou A (aplicada); `escolhaDe` devolve `encerrar` no ativo (`original` = opção A), `aplicar_sugerida` no concluído não aplicado e `voltar` no aplicado; nulo para opção não escolhível. Ordem das opções: A, B, C (original primeiro, depois por letra).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: modelo do painel O que fica no vídeo (M7 T2)"` com os 3 arquivos.

**Pronto quando:** todos os testes acima passam e nenhum caminho do modelo devolve uma escolha que `aplicarSugerido` recusaria.

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
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `noArDoTeste`: lê `paraRestoreStatus(restore_status)`; confirmado só se TODOS os campos de `camposDoTeste(test_type)` estão `ok` com o mesmo `destino`; letra = `'A'` para `destino === 'original'`, senão `letraDe(destino)`; desde = maior `em`. Sem `restore_status` legível: `{ letra: null, desde: null, confirmado: false }`. Teste concluído pelo caminho v1 sem `restore_status` usa `winner_applied_at` como desde quando `winner_variant_id` aponta variante não original (registre no comentário que é o dado de antes do P4).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: modelo dos Concluídos com vencedor e no ar desde (M7 T3)"`.

**Pronto quando:** cada linha bate com o banco pela regra acima (critério M7-d da Hanna) e nenhuma data aparece sem `em` lido.

---

### Task 4: Modelo puro de "Com você", frase do topo e "Em teste agora"

**Estimativa:** ~120K tokens (Sonnet).

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
  | { tipo: 'dia14'; titulo: string; videoId: string; ytId: string; prazo: string /* 'dd/mm' */; vencido: boolean }
  | { tipo: 'conferir_studio'; titulo: string; ytId: string }
  | { tipo: 'retomar'; titulo: string; testId: string; pausadoHaDias: number }
export type CartaoEmTeste =
  | { tipo: 'lab'; card: AbTestCardView; lider: { letra: string; ctrs: [string, string] } | null; semLider: 'poucos dados' | 'CTR não medido'; proximaTroca: string | null; painel: PainelDecisao }
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
it('dia 14: linha resultado_pronto ou sem_resposta vira item dia14; em_teste_studio sem confirmadoEm vira conferir_studio', () => {})
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

### Task 5: Borda da página e `page.tsx` com um só `<Suspense>`

**Estimativa:** ~130K tokens (Sonnet).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/pagina-borda.ts`
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/corpo-do-lab.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-esqueleto.tsx` (estado d)
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-erro.tsx` (estado e; fronteira de erro cliente, padrão `caminho-nativo/lista-erro.tsx`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/page.tsx`
- Test: `apps/web/test/ab-lab-pagina-borda.test.ts`, `apps/web/test/ab-lab-lista-servidor.test.tsx` (ajuste)

**Interfaces:**
- Consumes: `getAbTestsForSite`, `toCardView`, `toDraftList`, `getAbSiteSettings`, `getChannelLearnings` (`queries.ts`); `lerLinhasDoCaminho` (sem recorte = comportamento de hoje); `lerDiasDosTestes` (`lib/youtube/ab-gravacao/placar-leitura.ts`); `telaV2DoTeste`; `lerPausasYoutube`; `leituraDoEditor`; `canAdminSite`/`denyUnlessSiteAdmin` (o mesmo degrau que `endAbTest` usa, só leitura: `podeDeixarVariante`); `montarPaginaDoLab` (Task 4).
- Produces: `lerPaginaDoLab(siteId: string, agora: Date): Promise<{ pagina: PaginaDoLab; linhas: LinhaDoCaminho[]; settings: AbTestSiteSettings; learnings: ChannelLearningsData | null; drafts: AbTestDraft[]; cards: AbTestCardView[]; completed: AbTestCardView[] }>`; `<CorpoDoLab siteId videoInicial />` (servidor) que renderiza `<AbLabDashboard … pagina={…} />`.

- [ ] **Step 1: Escrever os testes que falham** (stub do Supabase no padrão de `ab-lab-lista-servidor.test.tsx`):

```ts
// @vitest-environment node
it('lerDiasDosTestes é chamado UMA vez, só com os ids dos ativos e dos concluídos com ação possível (aplicar, aplicarDeNovo ou voltar)', () => {})
it('dias até encerrado_em_dia no concluído (o CTR do painel é o da decisão)', () => {})
it('erro em lerDiasDosTestes lança (a fronteira mostra o estado e); nunca devolve CTR 0', () => {})
it('lerLinhasDoCaminho é chamado uma vez e as mesmas linhas alimentam Com você, Em teste e a lista inicial', () => {})
it('getSuggestedVideos não é mais chamado pela página (desvio 7)', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** `page.tsx` fica: cabeçalho fora do Suspense não existe (o resumo depende do dado; estado d mostra "Lendo os testes…"); `page` renderiza `<LabErro><Suspense fallback={<LabEsqueleto />}><CorpoDoLab siteId videoInicial /></Suspense></LabErro>` e mantém o `blocoSugestoes` em Suspense próprio, passado como slot. Nenhum `await` de leitura no corpo do `page` além de `getSiteContext` e `searchParams` (regra do comentário de `lista-caminho-servidor.tsx:1-2`). `LabEsqueleto` reproduz o estado d (`index.html:144-150`): resumo "Lendo os testes…" em `--cms-text-dim`, faixa Com você com esqueleto de 56px, "Em teste agora — Carregando…", "Concluídos — Carregando…", "Vídeos do canal — Carregando…", `aria-busy="true"`. `LabErro` reproduz o estado e (`index.html:151-155`): topo "Não deu para ler os testes agora.", Com você "Não dá para saber se há algo com você enquanto os testes não carregam.", caixa "Se havia testes rodando, eles seguem; só a leitura falhou." com um só "Tentar de novo" (`router.refresh()` + `reset()`), Concluídos "Os concluídos vêm da mesma leitura dos testes. Use o botão “Tentar de novo” do bloco acima."
- [ ] **Step 4: Rodar os testes novos e `test/ab-lab-lista-servidor.test.tsx`, `test/ab-lab-page-video-param.test.ts`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: borda única da página do A/B Lab com Suspense e estados de carga e erro (M7 T5)"`.

**Pronto quando:** a página lê o banco num só lugar, dentro do Suspense; erro de leitura mostra o estado e; nenhuma leitura duplicada (contagem de chamadas no teste).

---

### Task 6: Recorte da lista (busca, filtro Testáveis, páginas de 20) e action `lerVideosDoCanal`

**Estimativa:** ~150K tokens (Sonnet).

**Files:**
- Modify: `apps/web/src/lib/youtube/teste-youtube/nativo/lista-borda.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions-nativo.ts`
- Test: `apps/web/test/ab-lab-lista-borda-recorte.test.ts`

**Interfaces:**
- Produces:
```ts
export interface RecorteDaLista { busca: string | null; filtro: 'testaveis' | 'todos'; pagina: number; incluirYtId: string | null }
export interface ContagemDoCanal { testaveis: number; semVolume: number; naoLido: number; total: number }
export interface PaginaDoCanal { linhas: LinhaDoCaminho[]; contagem: ContagemDoCanal; totalDoFiltro: number; temMais: boolean }
export async function lerPaginaDoCanal(sb: SupabaseClient, siteId: string, agora: Date, leitura: LeituraPrivadaDoSite | null, r: RecorteDaLista): Promise<PaginaDoCanal>
export const POR_PAGINA = 20
export const TETO_VIDEOS_DO_CANAL = 2000
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
it('lê os vídeos do site em blocos de 1000 com .range() até acabar ou chegar ao teto (2000); no teto, Sentry warning', () => {})
it('volume pedido em lotes de 100 ids à RPC ab_lab_volume', () => {})
it('testável = acimaDoPiso === true, público (publico !== false) e não Short (formato.isShort !== true)', () => {})
it('volume nulo (menos de 3 dias ou sem prova de leitura) conta em naoLido, nunca em semVolume nem em testaveis', () => {})
it('filtro testaveis devolve 20 por página, do mais novo ao mais velho; temMais quando há mais', () => {})
it('busca sem acento: "agua" acha "Água de coco em Bangkok"; "%" e "_" são texto', () => {})
it('busca com menos de 2 letras é tratada como sem busca', () => {})
it('página 0 sem busca inclui as linhas extras de hoje (fichas abertas, registros do Studio, testes nossos) mesmo fora do filtro', () => {})
it('incluirYtId desconhecido no recorte entra na página (abre ?video=)', () => {})
it('formato (RPC ab_lab_formato_atual) só para os acima do piso e para as linhas da página, nunca para os 300', () => {})
it('lerVideosDoCanal: sem edição → sem_permissao; pedido fora do schema → pedido_invalido; erro de banco → falha + Sentry', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Fluxo de `lerPaginaDoCanal`: (1) `youtube_videos` `id, youtube_video_id, title, thumbnail_url, published_at` do site, `published_at <= agora`, `order(published_at desc)`, em `.range()` de 1000; (2) filtra busca em JS por `normalizarBusca(title).includes(normalizarBusca(busca))`; (3) volume (`lerVolumes`, lotes de 100) só com `leituraValida`; (4) privados (`publico === false`) saem; (5) `lerFormatos` só para os acima do piso; (6) classifica e conta; (7) pagina; (8) para as linhas da página (+ extras na página 0 sem busca + `incluirYtId`) roda os mesmos passos de hoje (fichas, registros, nossos, títulos de antes, formato) e monta `LinhaDoCaminho` pela função extraída. A action segue o molde de `lerFichaDoVideo` em `actions-nativo.ts` (sessão e site do contexto; `leituraDoEditor(siteId)`; nunca site vindo do cliente).
- [ ] **Step 4: Rodar o teste novo e `test/ab-lab-lista-servidor.test.tsx`, `test/ab-lab-lista-caminho.test.tsx`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: busca no servidor e filtro Testáveis da lista de vídeos do Lab (M7 T6)"`.

**Pronto quando:** a contagem "N com volume para testar, M sem" bate com a regra do piso (`pisoPorDia(2) = 220`) e nada de volume não lido entra em "sem".

---

### Task 7: Topo, faixa "Com você" e "Em teste agora" (cliente)

**Estimativa:** ~140K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/faixa-com-voce.tsx`, `_components/pagina/secao-em-teste.tsx`, `_components/pagina/cartao-em-teste.tsx`, `_components/pagina/pagina-lab.css`
- Test: `apps/web/test/ab-lab-pagina-topo-faixa.test.tsx`

**Interfaces:**
- Consumes: `PaginaDoLab`, `ItemComVoce`, `CartaoEmTeste` (Task 4).
- Produces:
```ts
export interface FaixaComVoceProps { itens: ItemComVoce[]; vazio: string | null; onAbrirPainel: (p: PainelDecisao, origem: HTMLElement) => void; onAbrirDia14: (videoId: string, origem: HTMLElement) => void; onContinuarRascunho: (draftId: string) => void; onNovoTeste: () => void; onAbrirTeste: (testId: string) => void }
export interface SecaoEmTesteProps { cartoes: CartaoEmTeste[]; onAbrirTeste: (testId: string) => void; onAbrirPainel: FaixaComVoceProps['onAbrirPainel']; onAbrirDia14: FaixaComVoceProps['onAbrirDia14'] }
```
- Textos fixos (mockup r5): cabeçalho "Com você" + contagem "(n)"; botão "O que é automático?" (`aria-expanded`, `aria-controls`, Esc fecha e devolve foco) abre o parágrafo `AUTO` de `index.html:54` literal; vazio "**Nada com você agora.** {vazio}"; itens:
  - aplicar: título "Aplique {L} em “{título}”", motivo do modelo, prazo "Prazo: hoje", botão primário "Aplicar {L}".
  - dia14: título "O teste do YouTube em “{título}” terminou. Veja no Studio qual versão ganhou e conte aqui.", motivo "O Lab não lê o resultado do Studio." + link "Abrir no Studio" (`https://studio.youtube.com/video/{ytId}/edit`, `target="_blank" rel="noopener"`), prazo "vence {dd/mm}" (ou "Prazo acabou em {dd/mm}"), botão "Dizer o que o Studio escolheu" (a 390 px: "Qual ganhou no Studio?").
  - rascunho: "Continue o rascunho de “{título}”", "Você parou no passo {n} de 3. O Lab não cria o teste sozinho.", "sem prazo", "Continuar rascunho".
  - retomar: "Retome o teste pausado de “{título}”", "Pausado há {n} dias. O Lab não retoma sozinho.", "pausado", "Retomar" (navega para o detalhe, onde o Retomar existe).
  - conferir_studio: "Confira no Studio “{título}”", "Teste criado no Studio, sem ficha no Lab. O Lab não lê o resultado do Studio.", "sem prazo", "Abrir no Studio".
  - primeiro_teste: "Crie o primeiro teste", "O Lab não escolhe vídeo nem escreve versões; você faz isso no assistente, em 3 passos.", "sem prazo", "Novo teste" (primário).
- "Em teste agora": 1 cartão = largura cheia (layout horizontal); 2–4 = grade de 2 colunas a ≥1024 px; 5 ou mais = 4 visíveis + "Ver todos ({n})"; 0 = seção some. Cartão de título: selo "Título" (português, nunca "TITLE"), selo "Dia {d}/{teto}", miniatura atual, h3 com o nome (link para o detalhe no Lab; texto sem link no Studio), linhas "A {título}" e "B {título}" (C quando houver) com "● no ar" na letra no ar, stats "Líder" e "Próxima troca … automática"; no Studio: selo "No Studio", sem stats nem "no ar". Cartão de miniatura: pares de miniaturas A/B com "original"/"nova"/"● no ar". Rodapé de pendência "Com você: {verbo}" + botão; cartão do Lab em andamento tem o botão "Escolher o que fica" (desvio 5).

- [ ] **Step 1: Escrever os testes que falham** (RTL, jsdom):

```tsx
it('estado a: cartão único ocupa a largura (classe um), mostra A e B em texto e "● no ar" em A', () => {})
it('nenhum cartão mostra caixa B vazia: versão sem título e sem miniatura escreve "sem título gravado"', () => {})
it('cartão do Studio não tem Líder, CTR nem Próxima troca e tem o selo "No Studio"', () => {})
it('"O que é automático?" abre e fecha; Esc fecha e devolve o foco ao botão', () => {})
it('item aplicar chama onAbrirPainel com o painel do modelo; dia14 chama onAbrirDia14 com o videoId', () => {})
it('todo botão de item tem min-height 44px (classe .lab-alvo) e nenhum texto usa classe abaixo de 12px', () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** com Tailwind + tokens `cms-*`; cores carregadas por rgba/hex literal, nunca `color-mix()` (Opera o mostra transparente). `pagina-lab.css` guarda só `.lab-alvo{min-height:44px}`, `.lab-selo{height:24px;align-self:flex-start}` e o layout do cartão horizontal.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: topo, Com você e Em teste agora na página do Lab (M7 T7)"`.

**Pronto quando:** os estados a, b, b2, c e f do mockup são reproduzíveis só trocando o `PaginaDoLab` de entrada (fixtures do teste).

---

### Task 8: Painel "O que fica no vídeo?" (cliente) ligado às actions existentes

**Estimativa:** ~140K tokens (Sonnet).

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
- Envio: botão vira "Aplicando…" com `aria-disabled`, opções `inert`, `aria-busy` no diálogo, status "Mudando no YouTube. Aguarde, não feche esta janela."; **Esc, X, Cancelar e clique fora não fecham enquanto aplica**. `precisa_confirmar` → `AbConfirmarTrocaDialog` e "Aplicar mesmo assim" reenvia com `forcar: true` (só para variante). Falha do servidor → mensagem de `mensagemDeFalha` em `role="alert"` com foco, a escolha fica marcada, primário vira "Tentar de novo"; `ja_encerrado`/`mudou` → mensagem do servidor + "Recarregar"; `sem_permissao` com `unauthenticated` → `hrefDoLogin()`. Exceção na chamada → `sessaoExpirou()` decide entre sessão expirada e "rede" (`mensagemDeFalha(...,{tipo:'rede'})`). Sem resposta em `ESPERA_SEM_RESPOSTA_MS` → mensagem de rede e "Recarregar". Feito → título "Feito", texto de `mensagemDeFeito` (hoje em dd/mm SP), "Fechar" com foco, `router.refresh()`. Foco inicial: opção marcada, senão a primeira escolhível. A 390 px: folha de baixo com o primário fixo no pé (Naksu r4 item 5).

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('ativo: escolher C chama acoes.encerrar(testId, { destino: "variante", varianteId: "vc", seqVisto })', () => {})
it('ativo: escolher A chama encerrar com { destino: "original", seqVisto }', () => {})
it('concluído: confirmar chama aplicarSugerido(testId, "vb", seq); aplicado chama voltar(testId, seq)', () => {})
it('opção "Em breve" está disabled e não pode ser marcada', () => {})
it('durante Aplicando…: Esc, X, Cancelar e clique no fundo não chamam onFechar', async () => {})
it('falha: mostra "Não consegui aplicar C. B continua no ar." com role alert e o botão "Tentar de novo"', async () => {})
it('rejeição da promessa sem sessão expirada: mensagem de conexão caída', async () => {})
it('precisa_confirmar abre a confirmação e "Aplicar mesmo assim" reenvia com forcar true', async () => {})
it('feito: "Teste encerrado. C no ar desde 26/10. Você escolheu C; o teste indicava B." e refresh', async () => {})
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Um só envio por vez (`useRef` de voo, como `ab-end-test-dialog.tsx:146-150`).
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

**Estimativa:** ~120K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/videos-do-canal.tsx`
- Modify: `_components/caminho-nativo/lista-caminho.tsx` (prop `agrupar?: boolean`, padrão `true`; com `false` some o resumo `cn-sum`, os cabeçalhos de grupo e a linha `cn-lhd`)
- Modify: `_components/caminho-nativo/lista-caminho-paineis.tsx` (repassa `agrupar`)
- Test: `apps/web/test/ab-lab-pagina-videos-do-canal.test.tsx`

**Interfaces:**
- Consumes: `lerVideosDoCanal` (Task 6, por prop), `ListaCaminhoComPaineis`, `ACOES` de `lista-caminho-servidor.tsx`.
- Produces: `VideosDoCanalProps { inicial: PaginaDoCanal; videoInicial: string | null; acoes: AcoesCaminho; ler: (p: z.infer<typeof PedidoVideosDoCanalSchema>) => Promise<ResultadoVideosDoCanal> }`.
- Textos (mockup `index.html:102-116`): `<details>` com summary "Vídeos do canal" + "{t} com volume para testar, {s} sem" (+ ", {n} sem volume lido" quando `naoLido > 0`); busca `type="search"` placeholder "Buscar por título" `aria-label="Buscar vídeo"`; chips "Testáveis" (padrão, `aria-pressed`) e "Todos"; grupo "{s} vídeos com poucas impressões por dia (menos de 220). Escolha “Todos” para ver."; rodapé "Mostrando {k} de {total} testáveis" + "Mostrar os {resto} restantes" (até 20 por clique: "Mostrar mais 20" quando resto > 20); vazio "Nenhum vídeo com “{busca}”." + "Limpar busca"; carregando = 3 linhas esqueleto; erro = "Não deu para ler os vídeos." + "Tentar de novo".
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
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (contador de pedido em `useRef`; `AbortController` não se aplica a server action, por isso o descarte é por número).
- [ ] **Step 4: Rodar o novo e `test/ab-lab-lista-caminho.test.tsx`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: Vídeos do canal recolhido com busca no servidor (M7 T10)"`.

**Pronto quando:** com 300 vídeos a página abre sem a lista expandida e a busca não manda mais de um pedido por pausa de digitação.

---

### Task 11: Composição da página na ordem nova, Concluídos e Sugestões

**Estimativa:** ~140K tokens (Sonnet).

**Files:**
- Create: `_components/pagina/secao-concluidos.tsx`
- Modify: `_components/ab-lab-dashboard.tsx`, `_components/bloco-sugestoes.tsx`, `_components/pagina/corpo-do-lab.tsx`
- Test: `apps/web/test/ab-lab-pagina-composicao.test.tsx`; ajustar `apps/web/test/ab-dashboard.test.tsx`, `apps/web/test/ab-lab-dashboard-d8.test.tsx`, `apps/web/test/ab-lab-gio-fix1*.test.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 4–10.
- Produces: `AbLabDashboardProps` passa a ser `{ pagina: PaginaDoLab; settings; siteId; eligibleVideos; drafts; iniciarTeste; avisoDeVolume?; acoesDecisao: AcoesDecisao; acoesCaminho: AcoesCaminho; lerVideos: VideosDoCanalProps['ler']; listaInicial: PaginaDoCanal; videoInicial: string | null; blocoSugestoes?: ReactNode; learnings: LearningsData | null; channelLearnings: ChannelLearningsData | null }`. `corpo-do-lab.tsx` monta `acoesDecisao = { encerrar: endAbTest, aplicarSugerido, voltar: revertWinner }` (importadas no servidor) e `acoesCaminho = ACOES`.
- Ordem renderizada: (1) topo `h1` "A/B Lab" + ferramentas "Biblioteca" (link para `/cms/youtube/ab-lab/library`, `next/link` importado no próprio client), "Todos os tipos" (filtro existente), "Ajustes" (`aria-label="Configurações"`), "Novo teste" primário + `p.resumo` com `pagina.topo.frase`; (2) Com você; (3) Em teste agora; (4) `blocoSugestoes`; (5) Concluídos; (6) Vídeos do canal; diálogos (painel, dia 14, assistente, ajustes, seletor) fora do fluxo. Some: KPI strip, `DraftsBlock` (rascunho virou item de Com você), Candidatos, grade de pausados (virou item ou cartão do Studio).
- Concluídos (mockup `:90-98`): cabeçalho "Concluídos" + "{n} testes"; linha com miniatura real (`thumbnail_url`), título, tipo, resultado e apoio, botão da ação quando houver (abre o painel); "Ver testes anteriores" como `button aria-disabled="true"` + selo "Em breve"; régua "Coletando dados: {k} de 3 testes concluídos" com 3 marcas e "Com 3 testes o Lab começa a mostrar o que funciona no seu canal." quando `regua`; com 3 ou mais, o `LearningsPanel` existente no lugar da régua. Sem nenhum concluído e sem história: a seção some (estado b2).
- `BlocoSugestoes`: desvio 8.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('ordem das seções: Com você, Em teste agora, Sugestões, Concluídos, Vídeos do canal', () => {
  const titulos = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
  expect(titulos).toEqual(['Com você', 'Em teste agora', 'Concluídos', 'Vídeos do canal'].filter(Boolean)) // Sugestões é slot
})
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

### Task 12: Verificação local completa

**Estimativa:** ~40K tokens (Sonnet; saídas em arquivo, só falhas no contexto).

- [ ] **Step 1:** `cd apps/web && npx tsc --noEmit > /tmp/m7-tsc.txt 2>&1; tail -5 /tmp/m7-tsc.txt` → 0 erros. (Use o scratchpad da sessão em vez de `/tmp` se houver.)
- [ ] **Step 2:** `npx vitest run > <scratch>/m7-vitest.txt 2>&1; grep -E "FAIL|Test Files|Tests " <scratch>/m7-vitest.txt` → nenhuma FAIL (~160 s; rodar em background e voltar quando sair, nunca esperar parado mais de 4 min).
- [ ] **Step 3:** `npm run build:web > <scratch>/m7-build.txt 2>&1; tail -20 <scratch>/m7-build.txt` → build ok (mudança arriscada de página: CLAUDE.md permite e pede).
- [ ] **Step 4:** sem commit (nada mudou); registrar no ledger os três resultados.

**Pronto quando:** typecheck, suíte inteira e `next build` passam.

---

### Task 13: Revisão de Phil (dados) e Yannis (software), e de Logan e Naksu (tela)

**Estimativa:** ~200K tokens no total (Phil e Yannis em Opus na 1ª revisão, effort medium; Logan e Naksu sobre capturas que o Gio gera; consertos em Sonnet).

- [ ] **Step 1: Phil** revisa `pagina-borda.ts`, `lista-borda.ts` (recorte) e `actions-nativo.ts#lerVideosDoCanal`: conta de leituras por visita (meta: 1 `ab_tests` + 1 `lerLinhasDoCaminho` + 1 `ab_test_dias` na página; a busca = vídeos em blocos de 1000 + volume em lotes de 100 + formato só dos acima do piso), custo de `ab_lab_volume` com 300 ids (pedir `EXPLAIN (ANALYZE, BUFFERS)` no banco local de integração `bythiago_int`, porta 54422, com dado sintético de 300 vídeos × 28 dias), "nulo nunca é zero" em volume e CTR, e o critério M7-d (no ar desde = `restore_status`).
- [ ] **Step 2: Yannis** revisa painel (concorrência do envio, CAS por `seqVisto`, Esc em voo, `precisa_confirmar`), descarte de resposta velha na busca, fronteira de erro e o `Suspense` único, e a ausência de import de action em client.
- [ ] **Step 3:** consertos em commits próprios (`fix: … (M7 T13 Phil N)`), re-revisão de emenda por Sonnet, até acordo.
- [ ] **Step 4: Logan e Naksu** revisam a tela implementada (capturas do Gio a 1440 e 390) contra o mockup r5 e os desvios 5 e 6; consertos até nota ≥ 92 dos dois.

**Pronto quando:** Phil, Yannis, Logan e Naksu dão acordo escrito no ledger.

---

### Task 14: Prova na tela pelo Gio, com dado de produção

**Estimativa:** ~120K tokens (gio-qa, Sonnet, navegador só nele; capturas em arquivo).

Ambiente: `next dev` local apontando para o Supabase de produção (`.env.local`), sessão autenticada pelo `docs/ops/runbook-cms-e2e-local.md`. Escrita no YouTube só com o dono presente e um teste escolhido por ele; tudo o mais é leitura.

- [ ] **Step 1 (M7-a):** com o dado real (1 teste ativo, ~300 vídeos), o cartão do teste aparece na 1ª dobra a 1440×900 e a 390×844; "Vídeos do canal" começa recolhido.
- [ ] **Step 2 (M7-b):** num teste do Studio no dia 14 (ou registro de teste do dono), o botão diz "Dizer o que o Studio escolheu"; cada opção grava `resposta_dono` (conferir por `supabase db query --linked` de leitura, ou pedir ao dono), "Mudar" troca; nenhum texto diz que o Lab leu o Studio; "Não vi ainda" não grava.
- [ ] **Step 3 (M7-c):** no ativo, escolher uma versão encerra com ela no ar (título/miniatura lidos no YouTube depois — só com o dono autorizando a escrita); no concluído, nenhum controle visível devolve `ja_encerrado`; o prazo de voltar mostrado = `revert_expires_at` (dd/mm SP).
- [ ] **Step 4 (M7-d):** cada Concluído mostra vencedor e "no ar desde" iguais a `winner_variant_id` e `restore_status` do banco; "Sem vencedor" onde não houver.
- [ ] **Step 5:** estados d e e (rede lenta e leitura falhando via DevTools), busca ("agua", texto inexistente, 1 letra), filtro "Todos", "Mostrar os N restantes", painel em "Aplicando…" com Esc, 0 overflow horizontal a 390, contraste ≥ 4,5:1, nada abaixo de 12px, alvos ≥ 44px.
- [ ] **Step 6:** relatório em `docs/superpowers/mockups/2026-10-26-lab-reordem/gio-m7-prova.md` (até 10 linhas no retorno; capturas em `…/gio-m7-shots/`); defeitos voltam como tarefas `fix:` e o Gio reprova até zerar.

**Pronto quando:** M7-a..d passam com dado de produção e o dono confirma.

---

## Ordem e paralelismo

Tasks 1 → 2, 3, 4 (2 e 3 em paralelo; 4 depois de 2 e 3) → 5 e 6 (paralelas) → 7, 8, 9, 10 (paralelas depois de 5/6) → 11 → 12 → 13 → 14. Estimativa total: ~1,8M tokens com revisões.

## Fora do M7 (não implementar)

- M7b: aplicar outra versão ou "manter a original" num teste concluído (action nova + estado novo no banco; a escolha do dono separada do vencedor para não contaminar `getLearnings`).
- M8: aba "Resultados" (antes × depois com linha de base) e o destino do link "Ver testes anteriores".
- Item "Volte à original" com comparação de CTR (desvio 1) e a linha simplificada da lista (desvio 6, M6).
