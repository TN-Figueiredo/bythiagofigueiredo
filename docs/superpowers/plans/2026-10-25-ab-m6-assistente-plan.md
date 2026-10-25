# M6: assistente "Novo teste A/B" em 3 passos e carregamento do teste, plano de implementação

> **Para agentes executores:** use a sub-skill superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans e siga tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Status: r1, 25/10/2026 (1º rascunho, Opus).** Falta a revisão de Phil, Yannis e Hanna.

**Objetivo:** o assistente de criação de teste A/B passa de 5 para 3 passos (Tipo, Variantes, Revisar). O seletor distingue vídeos de mesmo título. A prévia do Revisar mostra só dado real. O aviso de volume vira cartão e não some. As esperas (criar rascunho, salvar, ativar, abrir a tela do teste) deixam de cobrir a tela e passam a usar `.etd-msg.busy`. Todo texto fica em português.

**Arquitetura:** só tela e duas leituras que já existem. O passo vira nome (`'tipo' | 'variantes' | 'revisar'`) em vez de número, e o rascunho local ganha chave nova (`-v2-`). A regra de "o que cada variante mostra" vira uma função pura (`previaPorTipo`), usada pelo assistente e pelo `WinnerDetail`. Cada ação tem o seu estado de espera (`acao`), separado do `isPending`. O carregamento do detalhe lê de `sessionStorage` o cabeçalho que a navegação já conhecia. Os tokens `--etd-*` ficam disponíveis fora do `.etd` pela classe `.etd-tok`.

**Tech:** Next 16 + React 19, TypeScript strict, Tailwind 4 + CSS global por componente, Vitest (jsdom para componente, node para pura).

**Fonte de verdade da tela:** mockup `bythiagofigueiredo/docs/superpowers/mockups/2026-10-25-m6-assistente/` no commit `114d61695` (r3; README "Como testar" 1-10, "r2", "Escolhas", "Diferenças em relação ao produto"; `index.html` com CSS em `<style>` l. 1-308 e marcação nas funções JS l. 352-479). Revisões: `.superpowers/sdd/ab-lab/assistente-r1/{logan,naksu,rev-mockup-logan,rev-mockup-naksu}.md` (repo principal). Decisão do dono (25/10): uma frente só; Ideias e Config saem.

## Restrições globais

- **Worktree:** `$WT=/Users/figueiredo/Workspace/bt-m6` (branch `trabalho/ab-m6`, de `origin/staging 98629371d`), `W=$WT/apps/web`, `AB=$W/src/app/cms/(authed)/youtube/ab-lab`, `C=$AB/_components`, `T=$W/test/youtube`. **Tarefas em série:** T3, T4 e T6 editam `ab-create-wizard.tsx`, e o pre-commit roda `tsc` na árvore toda.
- **Padrão existente antes de padrão novo (dono, 25/10).** Copie a marcação e o CSS do mockup, que por sua vez copiou o produto: `.etd-msg.busy/.err/.warn` (`ab-end-test-dialog.css:62-71`), `AvisoResolucao` (`step-revisar.tsx:131-158`), a linha-esqueleto `h-5 w-3/5 … motion-safe:animate-pulse` (`step-revisar.tsx:191-193`), `InfoDica` (`youtube/_components/info-dica.tsx`), o cabeçalho de `FichaEsqueleto`. Padrão novo só com motivo escrito neste plano.
- **Nenhum dado inventado na tela.** Dado ausente some ou diz "não informada"/"Sem thumbnail", nunca vira número fixo nem arte de exemplo. `OVERLAY_TEXT`, `THUMB_BG`, `12:48`, "12 mil visualizações · há 2 dias", "TF", "ByThiagoFigueiredo", a descrição "Fui até o MBK Center…" e "11 testes anteriores" saem do código de produção.
- **Textos exatamente como na tabela "Textos" (Decisões).** O executor nunca inventa frase: estado sem linha na tabela volta ao controlador. Inicial maiúscula e ponto final na tela; `aviso-volume.ts` não muda (o Cowork lê a mesma frase).
- **O registro gravado na criação não muda** (D-M6-1): `wizardConfigToAbConfig(initWizardConfig(settings))` continua indo ao `createAbTest`.
- **Sem migration, sem rota nova, sem consulta nova ao banco.** O seletor ganha 2 colunas no `select` que já existe.
- **Sem `color-mix`** (o Opera renderiza transparente; `bg-cms-surface/80` do Tailwind 4 compila para `color-mix`). Cor em hex/rgba literal ou token `--cms-*`/`--cn-*`/`--etd-*`.
- **Acessibilidade:** alvo ≥ 44 px (X, botões do rodapé, remover variante, pills, linhas, links "Pedir ideias", "Tentar de novo"); fonte ≥ 12 px em tudo o que esta frente toca; animação só com `motion-safe:` ou com `prefers-reduced-motion: reduce` desligando.
- **Next 16:** nenhum `next/link` nem componente de Server Component como prop de client component; server action chega por prop (padrão de `iniciarTeste`/`avisoDeVolume`). Exceção já existente: `ab-create-wizard.tsx` importa actions de `../actions` (l. 14-23); não acrescentar import de action em outro componente.
- **Sem `any`.** Testes de componente em `.tsx` com `// @vitest-environment jsdom`; pura em `.ts` (node). Datas com `vi.useFakeTimers()`/`vi.setSystemTime` ou ISO relativo; nunca ano fixo no futuro como "agora". Saída de teste em `/tmp/m6-*.log`, só `tail`/falhas no contexto; nada em primeiro plano > 4 min (suíte em background com `; echo FIM >>`).
- **Commits:** `tipo: descrição` em português + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; sem `--no-verify` em código; hook falhou ⇒ commit novo, nunca `--amend`. Teste que muda por causa da tarefa vai no mesmo commit.

## Conferências (T0; o executor refaz e para se mudou)

- **K1 (base = produção).** `git -C $WT rev-parse --short HEAD` ⇒ `98629371d`; `git -C $WT diff --stat 9ed04d688 HEAD -- 'apps/web/src/app/cms/(authed)/youtube/ab-lab'` ⇒ vazio (a árvore do A/B é a de `origin/main d4c26f2b1`, que é a de `9ed04d688`; as linhas citadas por Logan e Naksu valem aqui).
- **K2 (burn-in e ciclos, ponto 1 do brief).** `grep -rn "burn_in_days\|burnInDays" $W/src/lib/youtube/ab-gravacao $W/src/lib/youtube/ab-start.ts` ⇒ vazio. `grep -rn "burnInDays\|burn_in_days" $W/src --include='*.ts' --include='*.tsx'` ⇒ só `ab-types.ts`, `ab-schemas.ts`, `ab-wizard-adapter.ts`, `ab-gates.ts`, `queries.ts:1046` (entrada de `computeGates`), `step-config.tsx`, `settings-drawer.tsx`. `grep -rn "<GatesPanel" $W/src` ⇒ vazio (os `gates` da view não são desenhados). "Ciclos ABBA 16" só existe em `step-config.tsx:24` (`Math.ceil(padrao/2)*2`, nunca gravado).
- **K3 (teto).** `grep -n "tetoMexido\|teto_explicito" "$AB/actions.ts"` ⇒ `createAbTest` grava `teto_explicito: false` quando o config do cliente não traz a chave; `grep -n "configV2 =" $W/src/lib/youtube/ab-start.ts` ⇒ o início grava `max_duration_days: tetoDoTesteV2(config, V, { soExplicito: true })` = `tetoPadrao(V)` (15 com V=2, 17 com V=3; mínimo `tetoMinimo(V)` = 12/16, `decisao-v2.ts:15-17`).
- **K4 (InfoDica e Escape).** `$W/src/app/cms/(authed)/youtube/_components/info-dica.tsx` existe com `InfoDica({ titulo, paragrafos, rotulo })`; `grep -n "Escape" "$W/src/app/cms/(authed)/youtube/competitors/_chrome/flut/store.ts"` ⇒ listener em captura no `document` com `stopPropagation` (Esc fecha só a dica, não o assistente, cujo listener é de bolha no `document`, `ab-create-wizard.tsx:339-343`).
- **K5 (PerguntarIa, ponto 9).** `grep -rn "PerguntarIa\b" $W/src/app | grep -v perguntar-ia/` ⇒ só `competitors/_chrome/{observatory-chrome,chrome-server,trail-chrome}.tsx`; `TelaId` (`lib/youtube/observatorio/contexto-ia/tipos.ts:4-5`) não tem tela do A/B. Ver D-M6-6.
- **K6 (colunas).** `awk '/CREATE TABLE IF NOT EXISTS "public"."youtube_videos"/,/\);/' $WT/supabase/migrations/20260507000001_schema.sql | grep -n "published_at\|view_count\""` ⇒ `published_at timestamptz NOT NULL`, `view_count integer DEFAULT 0 NOT NULL`. Índice `idx_youtube_videos_published (site_id, published_at DESC)` já atende ao `order`.
- **K7 (testes que citam o que muda).** `grep -rln "Title for variant\|Challenger\|Passo [0-9] de 5\|Criando rascunho\|data-aviso-volume\|Carregando o placar\|ab-wizard-draft-\|LEITURA_A_PARTIR_DO_PASSO\|StepConfig\|StepIdeias\|'Variant [A-D]'\|Untitled" $W/test $W/e2e` ⇒ hoje: `test/cms/ab-step-variantes.test.tsx`, `test/youtube/ab-step-variantes.test.tsx`, `test/cms/ab-step-revisar.test.tsx`, `test/cms/ab-create-wizard-restore.test.tsx`, `test/ab-wizard-aviso-original.test.tsx`, `test/ab-wizard-variante-vazia.test.tsx`, `test/youtube/ab-s8-f4-t11c.test.tsx`, `test/youtube/ab-s8-f3-tela-t5b.test.tsx`, `test/youtube/ab-step-config.test.tsx`, `test/youtube/ab-wizard-components.test.tsx`, `test/youtube/ab-click-moment.test.tsx`, `test/youtube/ab-detail-active.test.tsx`. Nenhum e2e do assistente. Cada tarefa ajusta os seus no mesmo commit.

## Decisões do plano (a revisão pode recusar)

- **D-M6-1. Cortar Config não muda o que é gravado (ponto 1 do brief).** O estado `config` do assistente continua nascendo de `initWizardConfig(settings)` (`ab-wizard-adapter.ts:33-39`) e indo inteiro a `createAbTest` por `wizardConfigToAbConfig`. Grava o mesmo de hoje: `confidence_threshold` e `burn_in_days` do padrão do site, `rotation_pattern: 'abba'`, `stability_threshold: 3`, sem `max_duration_days`, `teto_explicito: false` (K3). A única diferença é que o slider de burn-in deixa de existir, e nenhum leitor da regra v2 lê esse valor (K2). `durationTouched`/`duration` ficam como estão (legado, fora do escopo). O padrão do site continua editável no `settings-drawer.tsx:214`.
- **D-M6-2. Passo por nome (ponto 2).** `export const PASSOS = ['tipo', 'variantes', 'revisar'] as const; export type Passo = (typeof PASSOS)[number]` em `C/wizard-passos.ts` (novo), junto de `ROTULO_DO_PASSO: Record<Passo, string>` = `{ tipo: 'Tipo', variantes: 'Variantes', revisar: 'Revisar' }`, `indiceDoPasso(p): number`, `proximoPasso(p): Passo` e `passoAnterior(p): Passo` (nas pontas, devolvem o próprio). `WizardState.step: Passo`, `SET_STEP` com `step: Passo`. Tudo o que hoje compara número passa a comparar nome: `stepIsValid` (`:255`), passo inicial (`:304`; `continuingDraft` ⇒ `'revisar'`, prefill/rascunho do banco ⇒ `'variantes'`), `SET_STEP` do tipo (`:377,:392` ⇒ `'variantes'`), `goBack`/`goNext` (`:559-564`), `renderStep` (`:567`), rodapé (`:698-702,:723-764`), `useAvisoVolume` (`:336`) e `useAvisoOriginal` (`:334`). `LEITURA_A_PARTIR_DO_PASSO` (`use-aviso-original.ts:11-12`) sai: o assistente passa `state.step !== 'tipo'`.
- **D-M6-3. Rascunho local com chave nova.** `draftStorageKey(videoId) = 'ab-wizard-draft-v2-' + videoId`; `PersistedDraft.step: Passo` (sem `hypothesis`). `loadDraft` valida `PASSOS.includes(step)` e trata valor fora disso como ausente. Ao montar, o assistente apaga a chave antiga `ab-wizard-draft-${videoId}` (try/catch), sem ler: o rascunho antigo guarda passo numérico de 5 (abriria um passo à frente). Perda aceita: até 7 dias de texto digitado; o rascunho do banco não é afetado.
- **D-M6-4. Cada espera no seu botão (ponto 5).** `type AcaoDoAssistente = 'criar' | 'salvar' | 'ativar'` e `const [acao, setAcao] = useState<AcaoDoAssistente | null>(null)`, setado antes de cada `startTransition` e limpo em todo retorno de erro e no fim do salvar. Ao ativar com sucesso, fica `'ativar'` até a navegação (como `isLaunching` hoje, `:526-529`). Rótulo em gerúndio só no botão da ação; os outros ficam `disabled` com o rótulo normal. `ocupado = acao !== null` substitui `isPending || state.isLaunching` nos `disabled`. O X e o Esc travam só em `salvar`/`ativar` (hoje: `isLaunching`).
- **D-M6-5. `--etd-*` fora do `.etd` (ponto 5).** Em `ab-end-test-dialog.css`, as declarações de token de `.etd` (l. 4-10) e de `[data-theme="light"] .etd` (l. 15-19) passam a valer também para `.etd-tok` (`.etd, .etd-tok { --etd-…}`), e o layout de `.etd` (l. 11-13) fica numa regra só sua. O contêiner do assistente, o do seletor e o do carregamento do detalhe ganham `className="… etd-tok"` e importam `ab-end-test-dialog.css`. É uma cópia de regra a menos; não sobe para `:root` (não vaza para o resto do CMS).
- **D-M6-6. "Pedir ideias a uma IA" (ponto 9).** O `PerguntarIa` não serve sem obra: ele exige `TelaId` do Observatório e um pacote montado no servidor por `contexto-ia` (K5), e o A/B não tem tela nesse modelo. O mínimo desta frente é reaproveitar o que o passo Ideias já faz: um link-botão sob o título de Variantes chama `onPedirIdeias` = o `handleCoworkClick` de hoje sem `hypothesis` (`fetchAbBriefingData` + `buildAbBriefingPrompt` + `navigator.clipboard.writeText`). O resultado aparece numa `.etd-msg` logo abaixo (textos 12-14). **◆ dono:** usar o diálogo `PerguntarIa` no A/B exige uma `TelaId` nova (`'ab-rascunho'`), o pacote no `contexto-ia` e a revisão do Phil (≈40-60K). Fica fora desta frente até ele decidir.
- **D-M6-7. Prévia por tipo numa função pura (ponto 4).** `C/previa-por-tipo.ts`: `previaPorTipo(tipo: TestType, variantes: ReadonlyArray<{ label: DisplayLabel; thumbUrl: string | null; title: string; isOriginal: boolean }>): Array<{ label: DisplayLabel; thumbUrl: string | null; title: string }>`. Regras: `title` ⇒ toda variante usa a `thumbUrl` da original e o próprio título; `thumbnail` ⇒ toda variante usa o título da original e a própria `thumbUrl`; `combo` ⇒ cada uma usa os dois próprios. Título vazio (`trim() === ''`) ⇒ `'Sem título'`. Sem original na lista ⇒ cada uma com o próprio. O `ClickMoment` recebe as variantes já resolvidas e um `meta` real, sem `videoTitle` nos cartões. `WinnerDetail` passa a usar a mesma função (`tipo = view.flag`, título de `variantThumbs[].titleText ?? view.videoTitle`).
- **D-M6-8. Banner, regra e aviso (pontos 6 e 8).** O banner deixa de ser verde quando há aviso. Título por `tituloDoBanner(avisoOriginal, { volume, faltaThumb })`, nesta ordem: `faltaThumb` ⇒ texto 7; algum aviso visível (original com selo, ou volume com texto) ⇒ texto 6; alguma leitura pendente ⇒ "Pronto para ativar."; senão "Tudo pronto.". Ícone verde só em "Tudo pronto."; nos outros, ícone neutro (`text-cms-text-muted`; com `faltaThumb`, `AlertTriangle`). **Divergência do mockup, com motivo:** em `revisar-titulo-lendo` o mockup diz "com um aviso abaixo" antes de a leitura voltar. O produto já tem a regra "pendente ⇒ Pronto para ativar." (teste `ab-wizard-aviso-original.test.tsx:43`), e afirmar um aviso que pode não vir seria falso. A regra fica numa linha abaixo do banner, com `InfoDica`. O resumo do banner diz só `{V} variantes de {título|thumbnail|título e thumbnail}`.
- **D-M6-9. Aviso de volume em cartão que não some (ponto 6).** `useAvisoVolume` devolve `EstadoAvisoVolume = 'pendente' | null | { estado: AvisoDeVolume['estado']; texto: string }`, guardado pela chave `${draftTestId}|${V}`: mudar V volta a `'pendente'` e nunca mostra o texto de outro V. `ativo` não depende mais de `isLaunching` (o mesmo vale para `useAvisoOriginal`, que hoje some ao ativar pelo mesmo motivo, `:334`). Selo por `seloDoAvisoDeVolume(estado)` (D-M6-10). `'pendente'` ⇒ esqueleto `.avs-sk` com `min-height` 80 px (100 px a ≤640 px, `index.html:211,240`): a altura é a do cartão e a página não pula. O aviso continua sem bloquear o botão.
- **D-M6-10. Selo do aviso de volume.** `nao_chega` ⇒ âmbar `AlertTriangle` "Volume insuficiente"; `so_decide_depois` ⇒ neutro tracejado `CircleHelp` "Decide mais tarde"; `teto_justo` ⇒ neutro "Teto justo"; `sem_medicao` ⇒ neutro "Sem medição" (◆T, Logan confere); `sem_variantes`/`variantes_demais` (não acontecem no Revisar, onde V ≥ 2 e ≤ 3) ⇒ linha neutra sem selo, como `AVISO_INDISPONIVEL`. Estilo do selo: o de `AvisoResolucao` (`step-revisar.tsx:138-152`), que já tem os dois tons.
- **D-M6-11. Falta thumbnail bloqueia Ativar (Logan C1 da revisão do mockup).** `faltaThumbDe(tipo, variantes): DisplayLabel | null` (em `previa-por-tipo.ts`) = a 1ª letra não original sem `thumbUrl` quando o tipo é `thumbnail`/`combo`; senão null. Com valor: banner texto 7, cartão tracejado "Sem thumbnail" com "Escolher da Biblioteca" (abre o `LibraryPickerDialog` daquela variante), nota texto 9 e "Ativar teste" `disabled`. "Salvar rascunho" segue habilitado. O passo Variantes também exige, por tipo, o que o tipo muda: `title` ⇒ título; `thumbnail` ⇒ imagem; `combo` ⇒ os dois (hoje basta um, `:259`). Assim só o rascunho do banco reaberto chega ao Revisar sem imagem.
- **D-M6-12. Rascunho que já existe (Logan M1, F4).** `createAbTest` devolve, no ramo `existing` (`actions.ts:162-174`), `{ ok: false, error, codigo: 'ja_existe', existente: { id, status } }`, lendo `id, status` no mesmo `select` (zero consulta nova). Com `status === 'draft'`, o assistente mostra o texto 3 e o rodapé fica com "Cancelar" + "Abrir rascunho" (primário, `router.push('/cms/youtube/ab-lab/new?draft=' + id)`; a rota já existe, `new/params.ts:38`). Com outro status, mostra o texto 4 e o botão "Abrir o teste" (`/cms/youtube/ab-lab/${id}`). "Próximo" some nos dois casos. O teste atual `result.error?.includes('already exists')` (`:393`) é código morto, porque o servidor responde em português, e sai.
- **D-M6-13. Cabeçalho conhecido no carregamento (ponto 7).** `C/abrindo-teste.ts`: `guardarTesteAbrindo(c: { id: string; titulo: string; miniaturaUrl: string | null }): void` e `lerTesteAbrindo(id: string): { titulo: string; miniaturaUrl: string | null } | null`, em `sessionStorage['ab-lab:abrindo']` com try/catch e validação de forma (lixo ⇒ null). Quem grava: o assistente antes de `onCreated` (vídeo e miniatura da original) e `handleOpenTest` do dashboard (`ab-lab-dashboard.tsx:121`). Os outros caminhos (link "Ver teste" da lista do caminho nativo, vídeos) caem no esqueleto frio. `[testId]/loading.tsx` segue Server Component e desenha `<DetalheCarregando />` (client, `useParams()`).
- **D-M6-14. Esqueleto visível.** Em `caminho-nativo.css`, `--cn-skel` passa a `#3B342C` (escuro) e `#D6CBB6` (claro), e entra `--cn-skel-2` = `#483F35` / `#CBBEA6` (valores do mockup, `index.html:39,51`, ≥ 1,4:1 sobre o fundo). `placar-esqueleto.css` troca `var(--cn-surface-2)` por `var(--cn-skel-2)` no gradiente. Afeta também a lista e a ficha do caminho nativo (README "Diferenças"; Gio compara).
- **D-M6-15. Contrastes do produto (README "Diferenças").** `VChip` com letra `#1A120A` em vez de `text-white`, e `aria-label` "Variante X" (`ab-primitives.tsx:21-23`; 17 consumidores, todos ganham). No trilho, número do passo futuro em `--cms-text-muted`. Botões secundários habilitados do rodapé em `--cms-text`; desabilitados em `--cms-text-dim` sem `opacity`. Pill ativa da prévia com texto `--cms-text`. "Teste ativo em andamento" em `--cms-amber-text`.

### Textos (fora do que o código já diz; do mockup salvo ◆T)

| # | Onde | Texto |
|---|---|---|
| 1 | Rodapé, criando | `<strong>Criando o rascunho…</strong>Leva alguns segundos.` (`.etd-msg.busy.compact`, único `role="status"`; o cartão só tem spinner e `aria-busy`) |
| 2 | Tipo, erro | `<strong>Não foi possível criar o rascunho</strong>Nada foi salvo. Tente de novo.` + botão "Tentar de novo" (`.etd-msg.err`, `role="alert"`) |
| 3 | Tipo, já existe rascunho | `<strong>Já existe um rascunho deste vídeo</strong>Abra-o na lista de rascunhos para continuar de onde parou.` (`.etd-msg.warn`) |
| 4 | Tipo, já existe teste (◆T) | `<strong>Este vídeo já tem um teste</strong>Termine ou cancele esse teste antes de criar outro.` + botão "Abrir o teste" |
| 5 | Seletor | título "Selecionar vídeo"; apoio "Escolha o vídeo. Os mais recentes aparecem primeiro."; busca "Buscar vídeos..."; vazio "Nenhum vídeo disponível." / "Nenhum vídeo encontrado."; linha: "Duração {m:ss}", "Publicado em {21 out 2026, 18:32}" ou "Data de publicação não informada", "{12.345} visualizações" (1 ⇒ "1 visualização"), "Teste ativo em andamento", "Lift anterior: …" (já existe), miniatura ausente "Sem thumbnail" |
| 6 | Banner com aviso | "Pronto para ativar, com um aviso abaixo." + resumo |
| 7 | Banner sem imagem | "Falta a thumbnail da variante {X}." + "Escolha uma imagem da Biblioteca para poder ativar o teste." |
| 8 | Regra | "Roda até {T} dias (mínimo {M}), em rotação ABBA. Quem escolhe o vencedor é você." + `InfoDica` título "Por que {T} dias", parágrafos "O YouTube leva dias para enviar o alcance de cada vídeo; por isso o prazo é fixo: no mínimo {M} e no máximo {T} dias." e "A rotação ABBA alterna as versões em blocos ({seq}) para que cada uma passe por dias parecidos." com `seq` = "A, B, B, A" (V=2) ou "A, B, C, C, B, A" (V=3, `ab-rotation.ts:12`); T = `tetoPadrao(V)`, M = `tetoMinimo(V)` |
| 9 | Nota do Revisar | normal: "Clique em **Ativar teste** para começar. As variantes começam a alternar depois que o teste for ativado no YouTube." (novo `NOTA_ATIVAR`); sem imagem: "**Ativar teste** está desativado: a variante {X} ainda não tem thumbnail."; some durante salvar/ativar e no erro |
| 10 | Revisar, esperas e erro | ativando: `<strong>Ativando o teste no YouTube</strong>Pode levar alguns segundos. Se fechar, o teste continua e aparece na lista.`; salvando: `<strong>Salvando o rascunho</strong>Leva alguns segundos.`; erro: `<strong>Não foi possível ativar</strong>O rascunho ficou salvo. Você pode tentar de novo.` e o botão primário vira "Tentar de novo". A recusa da guarda (`FRASES.guarda.*`, `:685-695`) continua como está, no corpo como `.etd-msg.err` |
| 11 | Prévia | cabeçalho "O momento de clique"; apoio "É assim que cada variante aparece para o espectador. {d}" com `d` = título: "Neste teste só o título muda: a miniatura é a mesma nas duas." / thumbnail: "Neste teste só a thumbnail muda: o título é o mesmo nas duas." / combo: "Neste teste o título e a thumbnail mudam juntos."; com V=3 "nas duas" ⇒ "nas três"; rótulo do cartão `VChip` + "Original"/"Variante {X}"; meta `@handle` e "Publicado em {21 out 2026}"; duração real no canto da miniatura |
| 12 | Ideias, copiando | `<strong>Montando o briefing…</strong>Leva alguns segundos.` (◆T) |
| 13 | Ideias, copiado | `<strong>Briefing copiado</strong>Cole numa IA, como o Claude, e traga as ideias para os campos abaixo.` (◆T) |
| 14 | Ideias, erro | `<strong>Não foi possível copiar o briefing</strong>Tente de novo.` (◆T) |
| 15 | Variantes | "Desafiante"; rótulo visível "Título da variante {X}"; placeholder e `aria-label` "Título da variante {X}…"/"Título da variante {X}"; "Monte até {n} desafiantes. A original (A) fica travada como referência."; contador "1 de 2 desafiantes" (sai o selo "MAX. 3 VARIANTES"); "{len}/100 caracteres" só com `len ≥ 80`; "Título mantido: só a thumbnail está sendo testada."; "Remover variante {X}"; "Sem thumbnail"; `'Untitled'` ⇒ "Sem título" |
| 16 | Carregando o teste | `<strong>Carregando o placar do teste</strong>Isso costuma levar poucos segundos.`; depois de 8 s: `<strong>Está demorando mais que o normal</strong>` + botão "Tentar de novo" (`window.location.reload()`); crumb "Teste A/B" |
| 17 | Erros genéricos do cliente | os `'Failed to …'` de `:374,422,448,466,487,507` deixam de aparecer: criar ⇒ texto 2; upload, limpeza e texto da variante ⇒ texto 10 (erro). O `error` do servidor vai para `console.warn` (diagnóstico) |

◆T (4, 10-sem-imagem, 12-14, selo "Sem medição"): Logan confere uma vez no fim (≈3K), sem bloquear. Troca de frase é troca de string mais teste.

## Mapa de arquivos

| Arquivo | Tarefa | Papel |
|---|---|---|
| `$AB/queries.ts` (`getEligibleVideosForPicker`, l. 306-365), `$AB/new/video-fora.ts` | T1 | `publishedAt`, `viewCount` |
| `$W/src/lib/youtube/ab-linha-video.ts` (novo) | T1 | `duracaoDoVideo`, `dataHoraDePublicacao`, `dataDePublicacao`, `textoDeVisualizacoes` |
| `C/linha-de-video.tsx` (novo), `C/video-picker-dialog.tsx`, `$AB/new/client.tsx` | T1 | linha única; `EligibleVideo` exportado de um lugar só |
| `C/ab-create-wizard.tsx` (`WizardVideo`), `C/ab-lab-dashboard.tsx`, `$AB/library/_components/library-dashboard.tsx` | T1 | `WizardVideo` ganha `durationSeconds`, `publishedAt`, `channelHandle` |
| `C/ab-end-test-dialog.css`, `C/etd-icone-busy.tsx` (novo; sai de `ab-end-test-dialog.tsx:108-110`), `C/ab-primitives.tsx` (`VChip`) | T2 | `.etd-tok`, `ICONE_BUSY` compartilhado, contraste do chip |
| `C/wizard-passos.ts` (novo), `C/ab-create-wizard.tsx`, `C/step-variantes.tsx`, `C/use-aviso-original.ts`; apaga `C/step-ideias.tsx`, `C/step-config.tsx` | T3 | 3 passos, rascunho v2, ideias, textos |
| `C/ab-create-wizard.tsx`, `C/step-tipo.tsx`, `$AB/actions.ts` (`createAbTest`) | T4 | esperas, erros, já existe |
| `C/previa-por-tipo.ts` (novo), `C/click-moment.tsx`, `C/step-revisar.tsx` (prévia), `C/winner-detail.tsx` | T5 | prévia honesta |
| `C/step-revisar.tsx`, `C/use-aviso-volume.ts`, `C/aviso-volume-selo.ts` (novo), `$W/src/lib/youtube/ab-original-resolucao.ts` (`tituloDoBanner`, `NOTA_ATIVAR`), `C/ab-create-wizard.tsx` | T6 | banner, regra, aviso, nota |
| `$AB/[testId]/loading.tsx`, `C/detalhe-carregando.tsx` (novo), `C/abrindo-teste.ts` (novo), `C/placar-esqueleto.css`, `C/caminho-nativo.css`, `C/ab-lab-dashboard.tsx` | T7 | carregamento do teste |
| Testes novos: `$W/test/youtube/ab-linha-video.test.ts`, `T/ab-m6-seletor.test.tsx`, `T/ab-m6-passos.test.tsx`, `T/ab-m6-esperas.test.tsx`, `T/ab-m6-previa.test.tsx`, `T/ab-m6-revisar.test.tsx`, `T/ab-m6-carregando.test.tsx`; ajustes da K7 | T1-T7 | |

## Ordem e custo

**Ordem:** T0 → T2 → T1 → T3 → T4 → T5 → T6 → T7 → T8. A T2 vem primeiro porque T4, T6 e T7 usam `.etd-tok` e `ICONE_BUSY`. A T5 (a prévia que mente, prioridade 1 de Logan) não pode subir antes da T3 porque o `step-revisar.tsx` muda nas duas. Se o push do dia apertar, **T2+T1+T5 formam um lote que sobe sozinho** (seletor e prévia honesta, sem mexer no índice de passos).

| Tarefa | Estimativa (Sonnet) |
|---|---|
| T0 | 4K |
| T2 | 10K |
| T1 | 24K |
| T3 | 40K |
| T4 | 36K |
| T5 | 30K |
| T6 | 32K |
| T7 | 22K |
| T8 | 12K |

**Total de execução ≈ 210K.** Fora disso: Gio no navegador, local, ≈ 25K (a confirmar no despacho); Phil e Yannis no fim ≈ 45K (Phil curto: só `select` do seletor e o retorno de `createAbTest`); conferência dos ◆T pelo Logan ≈ 3K. **Total com portões ≈ 283K.**

## Foco de revisão (o mockup implica, nenhum teste de tarefa cobre sozinho)

1. **Rascunho local antigo (5 passos) num navegador que já usou o assistente.** Esperado: abre no passo Tipo ou no salvo da chave v2, nunca um passo à frente, nunca "Step 3". **Teste na T3** (chave antiga com `step: 3` ⇒ ignorada e apagada; chave v2 com `step: 'variantes'` ⇒ abre em Variantes; v2 com `step: 4` ⇒ Tipo).
2. **Rascunho do banco reaberto sem a imagem de B num combo** (o assistente agora não deixa sair de Variantes sem imagem, mas o banco pode ter). Esperado: Revisar com banner texto 7, Ativar desabilitado e Salvar habilitado. **Teste na T6.**
3. **V muda entre leituras do aviso** (remover C depois de abrir o Revisar e voltar). Esperado: esqueleto até a nova leitura, nunca o texto do V anterior. **Teste na T6** (leitor falso com V=3 ⇒ texto X; V=2 ⇒ `'pendente'` até resolver ⇒ texto Y).
4. **`view_count = 0` de vídeo nunca sincronizado** (coluna `NOT NULL DEFAULT 0`, K6): a linha diz "0 visualizações", e isso pode ser falso. O seletor mostra o número como o banco tem (o mockup pede o zero real). Risco anotado; Phil decide se é preciso "não medido" (ver Riscos). **Teste na T1** só fixa o comportamento: 0 ⇒ "0 visualizações".
5. **Esc com a dica ⓘ aberta dentro do assistente.** Esperado: fecha só a dica (K4); um segundo Esc fecha o assistente. **Teste na T6** (abre ⓘ, `keydown Escape` no `document` ⇒ `onClose` não chamado e popover fechado).

---

### T0: conferências K1-K7 (≈4K)

- [ ] Rodar K1-K7 e comparar. Se algo diferir, parar e reportar ao controlador com a saída.

**Pronto quando** todas batem.

### T2: tokens `.etd-tok`, `ICONE_BUSY` compartilhado e contraste do `VChip` (≈10K)

**Files:** Modify `C/ab-end-test-dialog.css` (D-M6-5), `C/ab-end-test-dialog.tsx` (importa `ICONE_BUSY`), `C/ab-primitives.tsx`; Create `C/etd-icone-busy.tsx` (`export const ICONE_BUSY`, o SVG de `ab-end-test-dialog.tsx:108-110`); Test `T/ab-m6-passos.test.tsx` (bloco "tokens"), ajustes `test/youtube/ab-click-moment.test.tsx:65,91,125-126` e `test/youtube/ab-detail-active.test.tsx:209` ("Variant X" ⇒ "Variante X").

**Interfaces — Produces:** classe `.etd-tok` com todos os `--etd-*` (escuro e claro); `ICONE_BUSY` em `etd-icone-busy.tsx`.

- [ ] **Teste (FAIL):** `fs.readFileSync` do CSS: existe uma regra cujo seletor contém `.etd-tok` e que declara `--etd-info-bg` e `--etd-err`; existe `[data-theme="light"] .etd-tok` com `--etd-err: #A4261B`; o CSS não contém `color-mix`. `render(<VChip label="B" />)` ⇒ `getByLabelText('Variante B')` com `style.color` = `rgb(26, 18, 10)`.
- [ ] Implementar. `grep -rn "'Variant \|Variant \${" $W/src $W/test` ⇒ ajustar o que sobrar.
- [ ] PASS (`npx vitest run test/youtube/ab-m6-passos.test.tsx test/youtube/ab-click-moment.test.tsx test/youtube/ab-detail-active.test.tsx test/youtube/ab-end-test-dialog.test.tsx > /tmp/m6-t2.log 2>&1`). Commit `refactor: M6 tokens do diálogo de encerrar fora dele e chip de variante legível`.

### T1: seletor com duração, data e visualizações (≈24K)

**Files:** Create `$W/src/lib/youtube/ab-linha-video.ts`, `C/linha-de-video.tsx`; Modify `$AB/queries.ts:306-365`, `$AB/new/video-fora.ts` (o `select` e o objeto de retorno, l. 26-50), `C/video-picker-dialog.tsx`, `$AB/new/client.tsx` (apaga a interface local `EligibleVideo`, l. 13-22, e importa a de `video-picker-dialog`), `C/ab-create-wizard.tsx` (`WizardVideo`), os três lugares que montam `WizardVideo` a partir da linha (`video-picker-dialog.tsx:144-149`, `new/client.tsx:158-163` e o inicial `:66-68`); Test `$W/test/youtube/ab-linha-video.test.ts`, `T/ab-m6-seletor.test.tsx`, ajuste `test/ab-dashboard-queries.test.ts` e `test/ab-new-client.test.tsx` se fixarem a forma.

**Interfaces — Produces:**
- `EligibleVideo` (em `video-picker-dialog.tsx`) ganha `publishedAt: string | null` (ISO) e `viewCount: number | null`.
- `WizardVideo` ganha `durationSeconds?: number; publishedAt?: string | null; channelHandle?: string | null` (opcionais: o rascunho do banco não os tem e a prévia omite).
- `duracaoDoVideo(seg: number): string | null`: `≤ 0` ⇒ null; `< 3600` ⇒ `m:ss`; senão `h:mm:ss`.
- `dataHoraDePublicacao(iso: string): string` ⇒ `"21 out 2026, 18:32"` e `dataDePublicacao(iso: string): string` ⇒ `"21 out 2026"`, os dois em `America/Sao_Paulo`, dia com 2 dígitos, mês abreviado sem ponto (via `Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts`, padrão de `teste-youtube/nativo/frases.ts:14-25`). ISO inválido ⇒ quem chama trata como ausente (`Number.isNaN(Date.parse(iso))`).
- `textoDeVisualizacoes(n: number): string` ⇒ `toLocaleString('pt-BR')` + " visualizações" (1 ⇒ "1 visualização").
- `LinhaDeVideo({ video, onEscolher }: { video: EligibleVideo; onEscolher: (v: WizardVideo) => void })`: um `<button>` com a marcação e o CSS de `.vp` do mockup (`index.html:121-134`, em classes Tailwind ou CSS local). Título em `line-clamp-2`; meta `.m` com só os itens que existem (texto 5); sem `@handle`; `disabled` quando `hasActiveTest`, com `opacity .5` **só** na miniatura e no título (Naksu 1); miniatura ausente no tracejado de `.etd-th.fail` + "Sem thumbnail".

- [ ] **Testes (FAIL), pura:** `duracaoDoVideo(768) === '12:48'`, `(3725) === '1:02:05'`, `(0) === null`; `dataHoraDePublicacao('2026-10-21T21:32:00Z') === '21 out 2026, 18:32'`; `dataHoraDePublicacao('2026-10-02T12:40:00Z') === '02 out 2026, 09:40'`; `textoDeVisualizacoes(12345) === '12.345 visualizações'`, `(1) === '1 visualização'`, `(0) === '0 visualizações'`.
- [ ] **Testes (FAIL), tela (estados `seletor` e `seletor-dado-ruim`):** duas linhas de mesmo título com datas `…18:32` e `…11:05` mostram textos diferentes; a linha com `hasActiveTest` é `disabled`, mostra "Teste ativo em andamento" e o nó desse texto não tem `opacity` no estilo calculado; título de 120 caracteres tem a classe de `line-clamp-2`; `thumbnailUrl: null` ⇒ "Sem thumbnail"; `durationSeconds: 0` ⇒ nenhum "Duração"; `publishedAt: null` ⇒ "Data de publicação não informada"; `viewCount: null` ⇒ nenhum "visualizaç"; `viewCount: 0` ⇒ "0 visualizações"; nenhum `@` na linha; cabeçalho "Selecionar vídeo" e "Os mais recentes aparecem primeiro."; clicar a linha chama `onEscolher` com `durationSeconds`, `publishedAt`, `channelHandle`.
- [ ] **Teste (FAIL), dado:** `getEligibleVideosForPicker` com o `fake-postgrest` do teste existente ⇒ o `select` pede `published_at, view_count` e o retorno traz `publishedAt`/`viewCount`; o número de consultas é igual ao de antes.
- [ ] Implementar; `video-picker-dialog.tsx` e `new/client.tsx` passam a desenhar `LinhaDeVideo`. Alvo da linha ≥ 44 px; fonte ≥ 12 px (`text-2xs` sai).
- [ ] PASS (`/tmp/m6-t1.log`). Commit `feat: M6 seletor de vídeo com duração, data de publicação e visualizações`.

### T3: três passos, rascunho v2, ideias de IA no Variantes e textos (≈40K)

**Files:** Create `C/wizard-passos.ts`; Modify `C/ab-create-wizard.tsx` (D-M6-2, D-M6-3; tira `StepIdeias`, `StepConfig`, `hypothesis`, `SET_HYPOTHESIS`, `UPDATE_CONFIG`, o botão "Pular" e "A IA é opcional — pode pular"), `C/step-variantes.tsx` (texto 15; prop `onPedirIdeias`), `C/use-aviso-original.ts` (sai `LEITURA_A_PARTIR_DO_PASSO`); Delete `C/step-ideias.tsx`, `C/step-config.tsx`, `test/youtube/ab-step-config.test.tsx` e o bloco `StepConfig` de `test/youtube/ab-wizard-components.test.tsx`; Test `T/ab-m6-passos.test.tsx`; ajustes `test/cms/ab-create-wizard-restore.test.tsx` (chave v2, `step: 'variantes'`), `test/ab-wizard-aviso-original.test.tsx` (C3/C3b passam a "Variantes"/"Tipo"), `test/ab-wizard-variante-vazia.test.tsx`, `test/cms/ab-step-variantes.test.tsx`, `test/youtube/ab-step-variantes.test.tsx` (rótulos novos).

**Interfaces — Produces:** `PASSOS`, `Passo`, `ROTULO_DO_PASSO`, `indiceDoPasso`, `proximoPasso`, `passoAnterior` (D-M6-2). `StepVariantesProps.onPedirIdeias?: () => Promise<void>`.

**Validação por tipo (D-M6-11):** `stepIsValid('variantes')` = existe não original com (`type !== 'thumbnail'` ⇒ título com `trim()`) e (`type !== 'title'` ⇒ `thumbUrl`).

**Ideias (D-M6-6):** em `StepVariantes`, sob o parágrafo do cabeçalho, `<button type="button" className=…ideia aria-haspopup={undefined}>` com `Sparkles` e "Pedir ideias a uma IA" (marcação de `.ideia`, `index.html:169-170`; sem `aria-haspopup`, porque não abre diálogo). O estado `'idle' | 'copiando' | 'copiado' | 'erro'` é local; abaixo do botão aparece `.etd-msg.busy`/`.etd-msg` neutra/`.etd-msg.err` com os textos 12/13/14, com `role="status"` (erro: `role="alert"`). Clique durante `'copiando'` não chama de novo. `'copiado'` e `'erro'` ficam até o próximo clique (não somem sozinhos em 3 s como hoje: a pessoa pode estar lendo). O assistente passa `onPedirIdeias = handleCoworkClick` sem `focus`.

- [ ] **Testes (FAIL), estados `tipo`, `variantes-titulo`, `variantes-thumbnail`, `variantes-combo`:** trilho com 3 itens "Tipo", "Variantes", "Revisar" e rodapé "Passo 1 de 3"; em Variantes, "Passo 2 de 3", nenhum "Ideias", "Config", "Burn-in", "Ciclos", "Pular", "Challenger", "Title for", "Monte ate", "MAX."; rótulo visível "Título da variante B" ligado ao `input` (`getByLabelText`); "1 de 2 desafiantes"; contador ausente com 79 caracteres e "86/100 caracteres" com 86; `title` sem título ⇒ Próximo desabilitado, digitando ⇒ habilitado; `combo` só com título ⇒ desabilitado, com título e imagem ⇒ habilitado; `thumbnail` com imagem ⇒ habilitado; Voltar em Variantes ⇒ Tipo.
- [ ] **Testes (FAIL), ideias:** clicar "Pedir ideias a uma IA" com `onPedirIdeias` pendente ⇒ "Montando o briefing…" com `role="status"`, e um 2º clique não chama de novo (1 chamada); resolvida ⇒ "Briefing copiado"; rejeitada ⇒ "Não foi possível copiar o briefing" com `role="alert"`.
- [ ] **Testes (FAIL), rascunho local (Foco 1):** chave antiga `ab-wizard-draft-vid-1` com `step: 3` ⇒ abre em Tipo e a chave antiga some do `localStorage`; chave `ab-wizard-draft-v2-vid-1` com `step: 'variantes'` e tipo válido ⇒ abre em Variantes; v2 com `step: 4` ⇒ Tipo; o `saveDraft` grava `step: 'variantes'` (string) e não grava `hypothesis`.
- [ ] **Teste (FAIL), gravação (D-M6-1):** do Tipo ao clique em "Ativar teste", o `config` passado a `createAbTest` é igual a `wizardConfigToAbConfig(initWizardConfig(settings))` e não tem `max_duration_days` nem `teto_explicito`.
- [ ] Implementar; apagar os dois arquivos de passo; `grep -rn "StepIdeias\|StepConfig\|step-ideias\|step-config\|LEITURA_A_PARTIR_DO_PASSO\|hypothesis" $W/src $W/test` ⇒ vazio (exceto `buildAbBriefingPrompt`, que aceita `focus` opcional e não muda).
- [ ] PASS (`npx vitest run test/youtube/ab-m6-passos.test.tsx test/cms test/ab-wizard-* test/youtube/ab-step-* test/youtube/ab-wizard-components.test.tsx > /tmp/m6-t3.log 2>&1`). Commit `feat: M6 assistente em 3 passos (Tipo, Variantes, Revisar) com ideias de IA no Variantes`.

### T4: esperas sem véu, erros em português e "já existe" (≈36K)

**Files:** Modify `C/ab-create-wizard.tsx` (apaga o véu `:674-678`; D-M6-4; rodapé; erros; X/Esc), `C/step-tipo.tsx` (prop `pendente`), `$AB/actions.ts` (`createAbTest`, D-M6-12, tipo de retorno `:121-123`); Test `T/ab-m6-esperas.test.tsx`, teste existente `test/ab-actions-create.test.ts:368` (ganha `codigo`/`existente`).

**Interfaces:**
- `createAbTest(...)`: `Promise<{ ok: boolean; id?: string; error?: string; codigo?: 'ja_existe'; existente?: { id: string; status: AbTestStatus } }>`.
- `StepTipoProps.pendente?: TestType | null` e `StepTipoProps.travado?: boolean`: o cartão pendente fica `aria-checked="true"`, `aria-busy="true"`, com classe de marcado e `ICONE_BUSY` (classe com `motion-safe:` na animação `etd-sp`) no lugar do ícone; os outros ficam `aria-disabled="true"` e não reagem ao clique nem às setas; travado = sem fundo, ícone a `.55`, título e descrição em cor cheia (Naksu 3; `index.html:156-158`).
- Rodapé do Tipo: `acao === 'criar'` ⇒ texto 1 no lugar de "Passo 1 de 3", "Cancelar" `disabled`, "Próximo" `disabled`. Erro do tipo: mensagem no corpo, abaixo dos cartões (textos 2/3/4); "Tentar de novo" repete `handleTypeSelect(state.type)`.
- Revisar: `acao === 'ativar'` ⇒ primário com `ICONE_BUSY` + "Ativando…", "Salvar rascunho" e "Voltar" `disabled` com o rótulo normal, X `disabled`, Esc e clique no fundo não fecham, texto 10 (ativando) abaixo do corpo, nota oculta. `'salvar'` é o espelho. Falha ⇒ `acao = null`, texto 10 (erro) e o primário vira "Tentar de novo": se o rascunho e as versões já foram gravados, chama `tentarIniciarDeNovo` (`:538-555`, que já repete só o início); senão, `handleSubmit(true)`. Recusa da guarda ⇒ como hoje, sem o texto 10.
- O aviso de volume e o da original continuam na tela durante `'ativar'` (D-M6-9; a T6 tira `isLaunching` dos hooks, e esta tarefa só garante que o corpo não é desmontado).

- [ ] **Testes (FAIL), estados `tipo-criando`, `tipo-erro`, `tipo-ja-existe`:** `createAbTest` pendente após clicar "Título" ⇒ nenhum elemento com `absolute inset-0`; o cartão "Título" tem `aria-busy="true"`; "Thumbnail" e "Título + thumbnail" têm `aria-disabled="true"` e clicar neles não chama `createAbTest` de novo; há exatamente 1 `role="status"` com "Criando o rascunho…" e o cartão não repete o texto; "Cancelar" `disabled`. Rejeição genérica ⇒ `role="alert"` "Não foi possível criar o rascunho" e "Tentar de novo" chama `createAbTest` de novo. `{ codigo: 'ja_existe', existente: { id: 'd9', status: 'draft' } }` ⇒ texto 3, rodapé só com "Cancelar" e "Abrir rascunho", e o clique faz `push('/cms/youtube/ab-lab/new?draft=d9')` (`useRouter` falso); com `status: 'active'` ⇒ texto 4 e "Abrir o teste" ⇒ `/cms/youtube/ab-lab/d9`.
- [ ] **Testes (FAIL), estados `revisar-ativando`, `revisar-salvando`, `revisar-erro`:** com `iniciarTeste` pendente, só o primário diz "Ativando…"; "Salvar rascunho" mantém o rótulo e está `disabled`; X `disabled`; Esc não chama `onClose`; texto 10 presente; nota ausente. Espelho para salvar. `iniciarTeste` com `{ ok: false, error: 'boom' }` ⇒ "Não foi possível ativar", "O rascunho ficou salvo", nenhum "boom" e nenhum "Failed"; o primário diz "Tentar de novo" e chama só `iniciarTeste` (`createTextVariant` não é chamado de novo). Com sucesso, o rótulo fica "Ativando…" até `onCreated`.
- [ ] **Teste de action (FAIL):** `createAbTest` com teste existente em rascunho ⇒ `codigo: 'ja_existe'`, `existente: { id, status: 'draft' }`, a mesma frase de `error`, e o `select` pede `id, status` (sem consulta nova).
- [ ] Implementar; alvo ≥ 44 px nos botões do rodapé e no X (`min-h-[44px]`, X `w-11 h-11`); `grep -n "Failed to\|animate-pulse\|bg-cms-surface/" "$C/ab-create-wizard.tsx"` ⇒ vazio.
- [ ] PASS (`/tmp/m6-t4.log`, com `test/ab-actions-create.test.ts` e os testes do assistente). Commit `feat: M6 esperas do assistente sem véu, só o botão clicado ocupado, erros em português`.

### T5: prévia honesta por tipo de teste (≈30K)

**Files:** Create `C/previa-por-tipo.ts`; Modify `C/click-moment.tsx` (apaga `OVERLAY_TEXT`, `THUMB_BG`, `12:48`, as metas fixas, o avatar "TF", "ByThiagoFigueiredo", a descrição do `SearchCard` e o seletor "Comparar/No feed" com o estado `mode`), `C/step-revisar.tsx` (apaga `buildClickMomentVariants` e `VariantMiniCard` com a faixa "Variantes", `:61-128,207-215`), `C/ab-create-wizard.tsx` (passa `meta`, `tipo` e `onEscolherDaBiblioteca`), `C/winner-detail.tsx:169-179`; Test `T/ab-m6-previa.test.tsx`; reativa `test/youtube/ab-click-moment.test.tsx` (`describe.skip` da l. 104) com as asserções novas; ajusta `test/cms/ab-step-revisar.test.tsx`.

**Interfaces:**
- `previaPorTipo` e `faltaThumbDe` (D-M6-7, D-M6-11).
- `ClickMoment({ variants, winnerLabel, winnerColor, semCtr, semVencedor, meta, descricao, onEscolherDaBiblioteca })` com `variants: Array<{ label: DisplayLabel; color: string; ctr: number | null; thumbUrl: string | null; title: string }>`, `meta: { canal: string | null; publicadoEm: string | null; duracao: string | null }` e `descricao: string` (texto 11, `d`). Sai `videoTitle`. Cada cartão: linha `VChip` + "Original"/"Variante {X}" (`.cml`), miniatura com `duracao` no canto quando houver, título da variante, `@canal` e "Publicado em {publicadoEm}" só quando houver. Sem `thumbUrl` ⇒ tracejado "Sem thumbnail" (`.cmt.semimg`, `index.html:224,237`) e, se `onEscolherDaBiblioteca` e a variante não for original, o botão "Escolher da Biblioteca" chama `onEscolherDaBiblioteca(label)`. Com `semVencedor`, todos os contextos mostram todas as variantes (hoje, fora da Home, só A e o "vencedor", `:213`). Pills Home/Busca/Sugeridos/Mobile ficam com 44 px, `aria-pressed` e texto `--cms-text` na ativa.
- O assistente monta `meta` a partir de `WizardVideo` (`canal: channelHandle`, `publicadoEm: dataDePublicacao(publishedAt)`, `duracao: duracaoDoVideo(durationSeconds)`; ausente ⇒ null). `WinnerDetail` passa `meta` com os três nulos (a view não tem esses dados hoje; nada inventado) e `descricao` do `view.flag`.

- [ ] **Testes (FAIL), pura:** `previaPorTipo('title', [A(thumb a.jpg, 'TA'), B(null, 'TB')])` ⇒ A e B com `a.jpg`, títulos `TA`/`TB`; `'thumbnail'` com B (`b.jpg`, '') ⇒ títulos `TA`/`TA`, thumbs `a.jpg`/`b.jpg`; `'combo'` ⇒ os próprios; título `'  '` ⇒ "Sem título"; `faltaThumbDe('combo', [A, B sem thumb])` ⇒ `'B'`; `'title'` ⇒ null.
- [ ] **Testes (FAIL), estados `revisar-titulo`, `revisar-thumbnail`, `revisar-combo`, `revisar-combo-sem-imagem`:** em teste de título, as duas `<img>` dos cartões têm o mesmo `src` (o da original) e o cartão B mostra o título digitado; o texto da página não contém "FILA DE", "RAMEN", "12 mil", "há 2 dias", "TF", "ByThiagoFigueiredo", "MBK", "Comparar", "No feed"; trocar a pill para Busca, Sugeridos e Mobile mantém os dois cartões, cada um com o seu título; teste de thumbnail ⇒ `src` diferentes e o mesmo título; combo sem imagem em B ⇒ "Sem thumbnail" e "Escolher da Biblioteca", que chama o callback com `'B'`; com `meta.duracao = '12:48'` aparece "12:48", e com `meta` nulo nenhum "Publicado em" nem duração; no `WinnerDetail` de título, o cartão B mostra `titleText` de B e não `view.videoTitle`.
- [ ] Implementar; `grep -n "OVERLAY_TEXT\|THUMB_BG\|12:48\|12 mil\|ByThiagoFigueiredo\|MBK" "$C/click-moment.tsx"` ⇒ vazio.
- [ ] PASS (`/tmp/m6-t5.log`, com `ab-click-moment`, `ab-detail-active`, `ab-step-revisar` e os testes do `winner-detail`: `grep -rln WinnerDetail $W/test`). Commit `feat: M6 prévia do teste mostra título e miniatura reais por tipo, sem dado inventado`.

### T6: banner, regra numa linha, aviso de volume em cartão e nota (≈32K)

**Files:** Create `C/aviso-volume-selo.ts`; Modify `C/use-aviso-volume.ts` (D-M6-9), `C/use-aviso-original.ts` (`ativo` sem `isLaunching`: só o assistente muda a chamada), `$W/src/lib/youtube/ab-original-resolucao.ts` (`tituloDoBanner` com 2º parâmetro opcional; `NOTA_ATIVAR` = texto 9 normal), `C/step-revisar.tsx` (banner, regra com `InfoDica`, `AvisoVolume`, esqueleto, nota, fonte ≥ 12 px), `C/ab-create-wizard.tsx` (`:334-336`, `faltaThumb` desabilita Ativar); Test `T/ab-m6-revisar.test.tsx`; ajustes `test/youtube/ab-s8-f4-t11c.test.tsx:94-130` (o hook devolve objeto), `test/youtube/ab-original-resolucao.test.ts` (`NOTA_ATIVAR`, `tituloDoBanner`), `test/ab-wizard-aviso-original.test.tsx`.

**Interfaces:**
- `export type EstadoAvisoVolume = 'pendente' | null | { estado: AvisoDeVolume['estado']; texto: string }`; `useAvisoVolume(ler, draftTestId, ativo, V): EstadoAvisoVolume` (`estado: 'ok'` ou erro ⇒ null; sem `ler`/inativo/sem rascunho ⇒ null).
- `seloDoAvisoDeVolume(estado: AvisoDeVolume['estado']): { selo: string; tom: 'ambar' | 'neutro' } | null` (D-M6-10).
- `tituloDoBanner(aviso: EstadoAviso | undefined, extra?: { volume?: EstadoAvisoVolume; faltaThumb?: DisplayLabel | null }): string`, com a ordem de D-M6-8; sem `extra`, o resultado é o de hoje (compatível com os testes existentes).
- `StepRevisarProps` ganha `avisoVolume?: EstadoAvisoVolume` (troca o `string | null`), `faltaThumb?: DisplayLabel | null` e `ocupado?: boolean` (esconde a nota).
- Ordem do corpo (mockup `revisar()`, `index.html:417-438`): banner → `.regra` com `InfoDica` (texto 8, `rotulo` "Por que {T} dias") → aviso da original (como hoje) → aviso de volume (cartão `.avs` ou esqueleto `.avs-sk`) → prévia (T5) → nota. Espaço de 20 px entre blocos (`space-y-5`), sem exceção.

- [ ] **Testes (FAIL), estados `revisar-titulo-lendo`, `revisar-titulo`, `revisar-titulo-sem-aviso`, `revisar-thumbnail`:** leitor pendente ⇒ `[aria-busy="true"]` com `aria-label` "Estimando o volume do teste" e banner "Pronto para ativar."; resolvido `nao_chega` ⇒ `role="status"` com o selo "Volume insuficiente" e o texto com inicial maiúscula e ponto final ("Este teste não chega…"); banner "Pronto para ativar, com um aviso abaixo." sem a classe/ícone verde; `ok` ⇒ "Tudo pronto." e nenhum aviso; `so_decide_depois` ⇒ "Decide mais tarde" com borda tracejada; `teto_justo` ⇒ "Teto justo"; `sem_medicao` ⇒ "Sem medição". A linha da regra com V=2 diz "Roda até 15 dias (mínimo 12)" e com V=3 "Roda até 17 dias (mínimo 16)"; o ⓘ abre a dica com "A, B, B, A" (V=2) / "A, B, C, C, B, A" (V=3); nenhum "Duração:" nem "variantes título" no banner; o resumo diz "2 variantes de título".
- [ ] **Testes (FAIL), aviso estável:** a leitura resolve `nao_chega`; clicar "Ativar teste" com `iniciarTeste` pendente ⇒ o selo "Volume insuficiente" continua no documento e o leitor não é chamado de novo. Foco 3: leitor falso com V=3 ⇒ texto X; remover C (V=2) ⇒ `'pendente'` até resolver, e o texto X nunca aparece com V=2.
- [ ] **Testes (FAIL), Foco 2 e nota:** rascunho do banco `combo` com B sem imagem aberto direto no Revisar ⇒ banner "Falta a thumbnail da variante B.", "Ativar teste" `disabled`, "Salvar rascunho" habilitado, nota "está desativado: a variante B ainda não tem thumbnail". Nota normal = `NOTA_ATIVAR` nova; nenhum "rotacionar na hora". Foco 5: com o ⓘ aberto, `fireEvent.keyDown(document, { key: 'Escape' })` ⇒ dica fechada e `onClose` não chamado.
- [ ] Implementar; `text-[11px]`/`text-[10px]` saem de `step-revisar.tsx`.
- [ ] PASS (`/tmp/m6-t6.log`). Commit `feat: M6 Revisar com banner honesto, regra numa linha e aviso de volume em cartão que não some`.

### T7: carregamento da tela do teste (≈22K)

**Files:** Create `C/abrindo-teste.ts`, `C/detalhe-carregando.tsx` (`'use client'`); Modify `$AB/[testId]/loading.tsx` (só desenha `<DetalheCarregando />` e importa os CSS), `C/placar-esqueleto.css` (fica só `.skhd` com a forma de `.ld .hd`, `index.html:257-266`; saem `.sksum`, `.skband`, `.skrow`, `.skdias`; gradiente com `--cn-skel-2`), `C/caminho-nativo.css` (D-M6-14), `C/ab-create-wizard.tsx` (`guardarTesteAbrindo` antes de `onCreated`, nos dois pontos `:529,:553`), `C/ab-lab-dashboard.tsx` (`handleOpenTest(id, cab?)` e os 3 chamadores `:288,:312-315,:421` passam título e miniatura do objeto que já têm); Test `T/ab-m6-carregando.test.tsx`; ajuste `test/youtube/ab-s8-f3-tela-t5b.test.tsx:96-108`.

**Interfaces:**
- `guardarTesteAbrindo`, `lerTesteAbrindo` (D-M6-13). `export const DEMORA_DO_DETALHE_MS = 8000`.
- `DetalheCarregando()`: raiz `cn-raiz pm4-sk etd-tok`, `data-testid="detalhe-carregando"`, `aria-busy="true"`. Com cabeçalho lido ⇒ miniatura (`<img alt="">`, ou nada se nula), crumb "Teste A/B" e `<h2>` com o título. Sem cabeçalho (frio) ⇒ os dois traços `.sk` (`aria-hidden`). Abaixo, uma única `.etd-msg.busy` com `role="status"` e o texto 16. Depois de `DEMORA_DO_DETALHE_MS`, a mensagem vira "Está demorando mais que o normal" com o botão "Tentar de novo" (`window.location.reload()`). Mais nada abaixo: sem faixa, sem linhas, sem 14 dias. A leitura do `sessionStorage` acontece num `useEffect`, para o HTML do servidor e o 1º render baterem.

- [ ] **Testes (FAIL), estados `teste-carregando`, `-frio`, `-demora`:** com `guardarTesteAbrindo({ id: 't1', titulo: 'Meu vídeo', miniaturaUrl: 'm.jpg' })` e `useParams` falso `{ testId: 't1' }` ⇒ `h2` "Meu vídeo", `img[src="m.jpg"]`, 1 `role="status"` com "Carregando o placar do teste" fora de qualquer `.sk`; `testId` diferente ⇒ frio (traços, nenhum `h2`); `sessionStorage` que lança ⇒ frio, sem erro; JSON inválido ⇒ frio; `vi.advanceTimersByTime(8000)` ⇒ "Está demorando mais que o normal" e o botão "Tentar de novo"; nenhum `.skdias`/`.skrow`. Assistente: ao ativar com sucesso, `sessionStorage['ab-lab:abrindo']` tem o id do teste e o título do vídeo antes de `onCreated`.
- [ ] **Teste (FAIL), CSS:** `caminho-nativo.css` declara `--cn-skel: #3B342C`, `--cn-skel-2: #483F35` e, no claro, `#D6CBB6`/`#CBBEA6`; `placar-esqueleto.css` continua sem hex e sem `color-mix` e desliga a animação sob `prefers-reduced-motion` (asserções que já existem em `t5b`, mantidas).
- [ ] PASS (`/tmp/m6-t7.log`, com `ab-s8-f3-tela-t5b` e os testes da lista e da ficha do caminho nativo: `grep -rln "ListaEsqueleto\|FichaEsqueleto" $W/test`). Commit `feat: M6 tela do teste carregando com o cabeçalho conhecido e mensagem de espera`.

### T8: fecho (≈12K)

- [ ] Suíte do A/B em background: `cd $W && npx vitest run test/ab- test/cms test/youtube > /tmp/m6-suite.log 2>&1; echo FIM >> /tmp/m6-suite.log`; no contexto, só falhas.
- [ ] `npm run build:web > /tmp/m6-build.log 2>&1` em background (mudança de UI com CSS e arquivos apagados: arriscada pela regra do CLAUDE.md); `tail` no fim.
- [ ] `grep -rn "color-mix" "$C"/*.css "$AB/[testId]"` ⇒ só comentários. `grep -rn "text-2xs\|text-\[10px\]\|text-\[10.5px\]\|text-\[11px\]\|10.5px" "$C/ab-create-wizard.tsx" "$C/step-variantes.tsx" "$C/step-revisar.tsx" "$C/step-tipo.tsx" "$C/video-picker-dialog.tsx" "$C/linha-de-video.tsx" "$C/click-moment.tsx"` ⇒ vazio.
- [ ] Nada de doc novo: a seção do assistente em `docs/ab-testing-system-reference.md`, se existir (`grep -n "assistente\|wizard" $WT/docs/ab-testing-system-reference.md`), passa a dizer 3 passos e cita D-M6-1. Commit `docs: M6 referência do assistente em 3 passos` (só se mudou algo).

## Validação (portões, controlador)

- **Gio (navegador, Sonnet, local, antes do push):** precisa de semente com 2 vídeos de mesmo título e datas diferentes, um vídeo com teste ativo, um com `view_count = 0`, um sem miniatura e um rascunho `combo` sem imagem em B. Percorre o fluxo inteiro como o modo "Fluxo" do mockup (seletor → Tipo → Variantes → Revisar → Ativar → tela do teste) nos três tipos. Faz captura completa (1440/390, claro/escuro) só de `seletor`, `tipo-criando`, `variantes-titulo`, `revisar-titulo`, `revisar-ativando` e `teste-carregando` (as 6 do README). O resto sai em 390 claro, uma captura cada. Critérios: README "Como testar" 1-10; 390 px sem rolagem horizontal; alvos ≥ 44 px; nenhum texto < 12 px; contraste de texto ≥ 4,5:1 (inclusive "Teste ativo em andamento" e a razão do Ativar desabilitado); altura igual entre `revisar-titulo-lendo` e `revisar-titulo`; o aviso continua durante "Ativando…"; Esc com ⓘ aberto; Opera (sem `color-mix`); lista e ficha do caminho nativo com o esqueleto novo (D-M6-14) e o ⓘ do placar sem regressão. Capturas em arquivo.
- **Phil** (curto): `select` do seletor (2 colunas, mesma consulta, o `view_count = 0` do Foco 4) e o retorno novo de `createAbTest`. **Yannis:** D-M6-2/3/4 (índice, rascunho, estado de espera), D-M6-12 e a T5 (componente compartilhado com `WinnerDetail`). **Hanna:** corte e ordem (o lote T2+T1+T5). **Logan:** os ◆T (≈3K).

## Aceite

- **CA-M6-1 (Gio, local):** no seletor, as duas linhas de mesmo título se distinguem pela data e hora; a linha com teste ativo diz "Teste ativo em andamento" legível nos dois temas.
- **CA-M6-2 (Gio, local):** o trilho tem 3 passos; tarefa principal (teste de título) = seletor, tipo, digitar, Próximo, Ativar = **4 cliques e 1 digitação**; nenhum "Ideias", "Config", "Burn-in", "Ciclos ABBA" nem texto em inglês.
- **CA-M6-3 (Gio, local):** ao escolher o tipo, nada cobre a tela; só o cartão clicado mostra a espera e a mensagem aparece uma vez, no rodapé.
- **CA-M6-4 (Gio, local):** no Revisar de um teste de título, as duas prévias mostram a mesma miniatura (a original) e o título de cada variante; nenhum número, arte ou canal inventado em Home, Busca, Sugeridos e Mobile.
- **CA-M6-5 (Gio, local):** o aviso de volume é um cartão com selo, o banner não fica verde quando há aviso, e o aviso continua visível durante "Ativando…"; só "Ativar teste" muda de rótulo.
- **CA-M6-6 (Gio, local):** combo sem imagem em B ⇒ "Falta a thumbnail da variante B." e "Ativar teste" desabilitado.
- **CA-M6-7 (Gio, local):** depois de ativar, a tela do teste carregando mostra o título e a miniatura do vídeo e uma só mensagem de espera; com o detalhe lento (rede limitada no DevTools), em 8 s aparece "Está demorando mais que o normal" com "Tentar de novo".
- **CA-M6-8 (controlador, produção, 1º teste criado depois do deploy):** `select config->>'burn_in_days', config->>'rotation_pattern', config->>'teto_explicito', config->>'max_duration_days', regra_duracao from ab_tests order by created_at desc limit 1;` ⇒ burn-in = padrão do site, `abba`, `false`, teto `15` (V=2) depois do início, `v2`: o mesmo registro de antes do M6 (D-M6-1).

## Riscos

- **`view_count = 0` não medido aparece como zero (Foco 4).** A coluna é `NOT NULL DEFAULT 0`. Se um vídeo entrou sem estatística, o seletor diz "0 visualizações". O mockup pede o zero real; Phil decide se cabe "não medido" (precisaria de um sinal de sincronização, fora desta frente).
- **`VChip` muda em 17 telas (D-M6-15).** A letra escura em vez de branca é melhor em todas as cores medidas (A, B, C, D), mas muda o visual de telas que esta frente não desenha. Gio compara a lista, o detalhe e o histórico.
- **`--cn-skel` muda a lista e a ficha do caminho nativo (D-M6-14).** A mudança é intencional (1,23:1 hoje); Gio compara.
- **`ClickMoment` é compartilhado com `WinnerDetail` (T5).** O concluído também perde o dado inventado e passa a mostrar o título real de cada variante; o texto do cabeçalho da prévia muda lá também. Aceito: era o mesmo defeito.
- **Rascunho local antigo descartado (D-M6-3).** Até 7 dias de texto digitado se perdem uma vez. O rascunho do banco continua.
- **"Pedir ideias" continua sendo "copiar o briefing" (D-M6-6).** O dono pode esperar o diálogo do Observatório; fica ◆ com o custo escrito.
- **`createAbTest` muda o retorno (D-M6-12).** Os campos são opcionais; os outros chamadores (`video/[id]/edit/actions.ts`, `ab-entradas/modelo.ts`, `pipeline/video-ab-*`) não leem `codigo` e não mudam.

## Fora do plano

- `ab-lab/loading.tsx` da lista (Logan e Naksu anotam; o README do mockup o deixa fora desta rodada).
- Faixa "Rascunho salvo." ao voltar à lista depois de "Salvar rascunho" (aparece só no modo Fluxo do mockup, não nos estados aprovados).
- Confirmação "Descartar o que digitou?" no Esc e o voltar do navegador (Logan, sugestões).
- Criar o rascunho em segundo plano (alternativa de Logan F3, condicionada à medição da espera; Gio mede o tempo real de "Criando o rascunho…" e registra).

## Cobertura (autoconferência)

| Achado / pedido | Tarefa |
|---|---|
| Brief 1: burn-in/ciclos na v2; o corte muda a gravação? | K2, K3, D-M6-1, teste da T3, CA-M6-8 |
| Brief 2: passo numérico + rascunho local versionado | D-M6-2/3, T3, Foco 1 |
| Brief 3: `publishedAt`/`viewCount` sem consulta nova | T1 (consultas iguais) |
| Brief 4 / Logan F12 / Naksu F1: prévia real, apagar constantes | D-M6-7, T5 |
| Brief 5 / Logan F3, F16 / Naksu B1, B2, F3: `.etd-msg.busy`, `--etd-*`, só o botão clicado | D-M6-4/5, T2, T4 |
| Brief 6 / Logan F15 / Naksu F2: aviso em cartão, sem sumir | D-M6-9/10, T6 |
| Brief 7 / Logan F18 / Naksu G1-G5: `loading.tsx` do detalhe | D-M6-13/14, T7 |
| Brief 8 / Logan F4, F6, F8 / Naksu D: textos em português | Textos 1-17, T3, T4 |
| Brief 9 / Logan F5 / Naksu C: Ideias sai; link de IA | D-M6-6 (◆ dono), T3 |
| Brief 10: teste de componente por estado do README | tabela abaixo |
| Logan F1, F2 / Naksu A1 / Naksu 1, 4 (r1 do mockup): seletor | T1 |
| Logan F7: um contador só | T3 (texto 15) |
| Logan F9-F11 / Naksu E1-E4: Config sai; regra numa linha | D-M6-1, D-M6-8, T3, T6 |
| Logan F13, F14: sem faixa de minicards, sem "No feed" | T5 |
| Logan F17: "Passo N de 3" | T3 |
| Logan C1 (revisão do mockup): combo sem imagem | D-M6-11, T5, T6, Foco 2 |
| Logan M1: "Próximo" ao lado de "Abrir rascunho" | D-M6-12, T4 |
| Logan M2: nota durante Ativando; prazo | T4, texto 10 |
| Logan M3 / Naksu 2: mensagem duplicada ao criar | T4 (1 `role="status"`) |
| Logan M4: causa da demora | T7, texto 16 |
| Logan M5: ordem do dado ruim | T1 (a consulta já ordena por `published_at desc`; vídeo de fora dos 100 vai por último) |
| Naksu 3: cartões travados ilegíveis | T4 (`travado`) |
| Naksu F4: resumo do banner | D-M6-8, T6 |
| Naksu F5: nota 11 px | T6 |
| README "Diferenças": contrastes, 44 px, 12 px, `NOTA_ATIVAR` | D-M6-15, T2, T4, T6, T8 |
| Erro de ativação em inglês / sem dizer o que ficou salvo | T4, texto 10/17 |

### Estado do README → teste

| Estado | Arquivo · teste |
|---|---|
| `seletor`, `seletor-dado-ruim` | `ab-m6-seletor.test.tsx` (T1) |
| `tipo` | `ab-m6-passos.test.tsx` "trilho com 3 passos" (T3) |
| `tipo-criando`, `tipo-erro`, `tipo-ja-existe` | `ab-m6-esperas.test.tsx` (T4) |
| `variantes-titulo`, `variantes-thumbnail`, `variantes-combo` | `ab-m6-passos.test.tsx` (T3) |
| `revisar-titulo-lendo`, `revisar-titulo`, `revisar-titulo-sem-aviso` | `ab-m6-revisar.test.tsx` (T6) |
| `revisar-thumbnail` | `ab-m6-previa.test.tsx` (prévia, T5) + `ab-m6-revisar.test.tsx` ("Decide mais tarde", T6) |
| `revisar-combo`, `revisar-combo-sem-imagem` | `ab-m6-previa.test.tsx` (T5) + `ab-m6-revisar.test.tsx` (Foco 2, T6) |
| `revisar-ativando`, `revisar-salvando`, `revisar-erro` | `ab-m6-esperas.test.tsx` (T4) + "aviso estável" (T6) |
| `teste-carregando`, `-frio`, `-demora` | `ab-m6-carregando.test.tsx` (T7) |
