# F3 (lista "Sugestões (N)" na tela) Implementation Plan — r3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## r3: achado → onde foi consertado (emenda final; r2 aprovada por 91–94)

| Achado | Onde |
|---|---|
| Phil N1 + Yannis N1 (`null` → `false`, ids sem repetição) | T6 `aviso.ts` |
| Yannis N2 (`ultimaBoa` em `useRef`, `vistaVisivel` pura) | T5 |
| Yannis N3 (`filtro` só marca `atual`; bloco pede `proprios` do `parecido`) | T3, T6 |
| Naksu D1 (contador ≥ 12 px, ROTEIRO, plano B) | T6, Menores |
| Naksu D2 (`<ol class="sg-list">` para o `nth-child`) | T5 |
| Naksu D3 (`top` do filtro sticky abaixo da barra) | T5 |
| Logan N1 (resposta tardia) e N2 (link de login) | T5 |
| Hanna S1 (T9 no status) e S2 (conta de tokens) | T0 Step 4, Estimativa |

## r2: achado → onde foi consertado

| Achado | Onde |
|---|---|
| H1 (DF1 fora) | DF1, Goal, Architecture, T0, T2, T3, T5, seção F3b |
| H2 (aceite em produção com N > 0 e N = 0) | Envios |
| H3 (sino na transição; "régua" do vazio) | Critérios do §7 abaixo, T6, T8 |
| H4 (caminho crítico, o que o dono vê, status) | Envios, T0 Step 4 |
| H5 (revisão final enxuta, estimativa) | T9, Estimativa |
| P-C1, P-C2 | F3b |
| P-C3 = Y-C1 (`contarAbertosEntre` em blocos de 200, até 500 ids) | T2, T6 |
| P-C4 = Y-C2 (lugar do `parecido`, chaves dos próprios, blocos) | T2, T3, T6 |
| P-C5 (`ja_adiado`) | F3b (a F3 não tem adiar; `nao_aberto` coberto em T5) |
| P-C6 (aba com "—" quando nunca calculado) | T6 |
| Y-B1 (reducer puro, "erro com lista antiga") | T5 `estado-da-lista.ts`, T6 (página não lança) |
| Y-C3 = L-C2 (7 desfechos, toque duplo, "Salvando…") | T5 |
| Y-C4 (`expira_antes`) | F3b |
| Y-C5 (`outlierMaisForte`, `outliers` vazio) | T3 |
| Y-C6 (tipo da ação fora do componente client) | T3 `tipos.ts` |
| Y-C7 = L-C6 + N-M2 (erro e vazio do bloco) | T7 |
| Y-C8 = L-C5 (filtro no cliente, sem refazer a leitura) | T3 `filtrarVista`, T5 |
| Y-C9 (`vigentes` sem `any`) | T2 |
| Y-C10 (`podeResponder` = predicado da ação) | T6 |
| L-C1 (rótulo "Adiar 7 dias") | F3b |
| L-C3 (confirmação no lugar da linha) | T5 |
| L-C4 = N-C4 (aba em 2º lugar, ⚠ visível no contador) | DF3, T6 |
| N-B1 (raiz `.sg`, tokens literais nos dois temas, régua ≥ 3:1) | Global Constraints, T5 |
| N-C1 (`--lado-n` em vez de `--ln`) | Global Constraints, T5 |
| N-C2 (container queries, sem JS de largura) | T5 |
| N-C3 (alturas do esqueleto) | T5, T8 |
| N-C5 (eyebrow e `text-[9px]` da T7) | T7 |
| N-C6 (Naksu: desenho de "Depois"/"Adiada") | F3b |
| N-C7 (miniatura com dimensões, `lazy`) | T5 |

**Conflitos decididos.** (1) Posição da aba: Logan 2º lugar, Naksu "rolar a aba atual e deixar a ordem ao Logan" → 2º lugar, e o Gio mede a 390. (2) Texto de `nao_aberto`: Phil/r1 "Já respondida em outro lugar" × Logan "Esta sugestão já saiu da lista." (pode ter sido o próprio toque duplo ou vencimento) → o de Logan. (3) `sem_permissao`: Logan "sessão expirou" × Yannis "sem permissão" → um texto só que serve às duas causas. (4) "Mostrar mais": Naksu CSS puro × Logan `&mais=1` → os dois (CSS decide o recorte, o clique põe `data-mais` e grava a URL). (5) Vazio da aba: Phil "—" (nunca calculado) × Logan "…" (carregando) → "…" só enquanto carrega, "—" sem estado, "?" no erro.

**Goal:** mostrar ao dono, em Competidores (aba própria) e no A/B Lab (bloco), a mesma lista "Sugestões (N)" que o Cowork já lê desde a F2, com dispensar de um toque e o mesmo N nos três lugares. **Sem migration.** "Depois" (adiar 7 dias) fica na F3b.

**Architecture:** a tela não lê `niche_signals`: chama `listarSinaisDoNicho` (F2 T8, único leitor) e `lerAmostraDasLinhas` (título, miniatura, canal, chaves de lugar). Um view-model puro (`_sugestoes/view-model.ts`) transforma a leitura nos estados do mockup M3; um reducer puro (`estado-da-lista.ts`) governa a lista no cliente; componentes client só desenham e recebem as server actions por prop. Nenhuma escrita nova no banco: dispensar usa `dispensarSinal` da F2. O N é igual nos cinco caminhos (página, aba, bloco, rota, `get_signals`/`sugestoes`) porque todos passam por `leitura.ts`.

**Tech Stack:** Next.js 16 (server components + server actions), React 19, Supabase, Vitest (node, jsdom), Playwright (Gio).

**Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` r17: §3.4, §3.5, §6, §7 linha "F3 Tela única", D25, D26, E8. **Mockup aprovado:** `docs/superpowers/mockups/2026-10-21-m3-sugestoes/` (`README.md` = regras de desenho; `index.html` = estados e textos; `shots/`). Respostas do mockup: `.superpowers/sdd/ab-lab/m3/respostas-{hanna,phil,yannis}.md`. **Base de código:** `lote/f2-sinal` (F2 inteira, com o conserto do DF6 em `989c352dd`; a F3 começa só depois dela em `staging`). Plano da F2: `docs/superpowers/plans/2026-10-21-f2-sinal-cowork-plan.md` r6. Pareceres da r1: `.superpowers/sdd/ab-lab/f3/revisao-plano-r1-*.md`.

**Critérios do §7 F3 traduzidos (Hanna H3):** (1) *notificação na transição*: clicar no sino com aviso individual abre `/cms/youtube/competitors/sugestoes` com a linha presente; com um resumo cujo item foi dispensado, aparece a faixa "algumas saíram" (T6, Review Focus 3; T8 local; em produção na 1ª notificação real, com data no ledger). (2) *canal vazio mostra motivo e régua*: no M3 a "régua" do vazio é a contagem da chave de `contagens` (ou o selo "não medido" quando falta); aceite = teste da T3 "cada `motivoVazio` com a família e a frase" + o da T5 "nenhum 0 fora do texto da contagem". Anotar na emenda do spec.

## Decisões deste plano (para o dono e para a revisão)

| # | Decisão | Padrão do plano | Custo de cada lado |
|---|---|---|---|
| DF1 | **"Depois" (volta em 7 dias).** O mockup M3 aprovado não tem o botão ("sem 'Depois'", README); o §6 do spec r17 é anterior à aprovação. | **Fora, F3b** (seção no fim). A F3 sai sem migration, sem envio F3-1 e sem o estado vazio `adiado`. Gatilho: o dono aprovar o delta desenhado no M3. | Sem o botão, o dono deixa a linha aberta (vence sozinha por `expires_at`) ou dispensa com "Não me interessa". Com ele: migration em produção antes do código, mudança no sino e no outbox (~110 mil tokens). **Decidido pelo dono (23/10): depois, na F3b.** |
| DF2 | **Desfazer / `niche_signals_reabrir`.** | **Fora — decidido pelo dono (23/10), com registro: etapa futura "Desfazer dispensa" na página de status.** Risco aceito: toque errado tira a linha por 30 dias; o dado fica no banco e volta por SQL. Gatilho: o dono relatar toque errado ou pedir para desfazer. | Entrar custaria ~25 mil e a reversão do sino sem botão que a use. |
| DF3 | **Botão "Sugestões (N)" em Competidores = aba do chrome do Observatório**, **em 2º lugar** (logo depois da inicial), com o ⚠ visível dentro do contador. | Aba, porque o chrome é a navegação do Observatório; 2º lugar porque a 390 a barra rola e a 6ª aba some (Logan C4/Naksu C4). | Botão solto exigiria um lugar novo em cada página. Gio confirma a 390 (T8). |
| DF4 | **Bloco do A/B Lab com 3 linhas** e "Ver todas (N)" quando N > 3. Na página, até 100, com "As 100 mais fortes de N" acima disso. | Como o mockup. | — |
| DF5 | **Cowork não ganha "adiar".** | Fora (D16 pede o mesmo N, não as mesmas ações). | — |
| DF6 | `parecido` com `proprios_agora = []` por chave errada. | **Consertado na F2** (`989c352dd`, `lote/f2-sinal`); a T2 só tem o teste de regressão. | — |

## Global Constraints

- **Sem migration e sem `db:push:prod` na F3.** Banco local de integração: 54421/54422 (`describe.skipIf(skipIfNoLocalDb())`). O 54321/54322 é do navegador (Gio).
- Leitura só por `listarSinaisDoNicho` e pelas funções novas de `leitura.ts`; nenhum componente, página ou ação lê `niche_signals` direto (o teste de importação da F2 cobre os arquivos novos).
- Server action de escrita: `denyUnlessSiteAdmin` **antes** de criar o cliente de serviço; `siteId` de `getSiteContext()`; o cliente manda só o id; `dispensado_por` = `user:<uuid>`. Componente client recebe as ações por prop, nunca as importa; **os tipos da ação moram em `_sugestoes/tipos.ts`**, não no componente. `next/link` nunca vai como prop a client component: usar `CmsLink` (`src/app/cms/(authed)/_shared/cms-link.tsx`).
- Mapa dos motivos 1:1 com o enum: destino "Lugar errado" = `lugar_errado`, "Não me interessa" = `nao_interessa`, "Já fiz" = `ja_fiz`; parecido "Não é parecido" = `nao_e_parecido`, "Não me interessa", "Já fiz". "Já fiz" grava `dispensado/ja_fiz`, nunca `feito`.
- Botão primário segue `proprios_agora` lido na hora (`rotulo_acao`, `n_proprios`), nunca `acao_gravada`. Textos: sem vídeo seu "Abrir o vídeo do concorrente"; com N, "Abrir seus N vídeos sobre X" / "Abrir seu vídeo sobre X" / "Abrir seus N vídeos parecidos" / "Abrir seu vídeo parecido"; não medido "Abrir seus vídeos". Laranja (primário cheio) só na 1ª linha aberta; as demais em contorno.
- "Pode ajudar", "associação, não causa"; "não medido" em cinza próprio (`nm`), nunca 0; N "…" ao carregar, "?" no erro, "—" sem estado de cálculo, nunca 0 inventado.
- **UI (Naksu B1/C1):** a lista tem raiz própria `<section data-obs-screen="sugestoes" class="sg">` com `container-type:inline-size`, igual na página e no bloco do A/B Lab (o bloco não herda `[data-obs]`). `sugestoes.css` declara na raiz, em hex/rgba **literais e nos dois temas** (`.sg{…}` e `[data-theme="light"] .sg{…}`), todos os tokens que usa, copiados do bloco `.frame` do `index.html` do M3: `--bg --surface --surface-2 --sunk --border --border-subtle --border-strong --btn-line --text --muted --dim --accent --on-accent --nm --nm-line --nm-bg --warn --warn-bg --warn-line --ok --ok-bg --ok-line --err --err-line --yt --yt-bg --yt-line --skel`. Teste: `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\(" sugestoes.css` só acha linhas dentro dos seletores de tokens. **Origem do nicho: reusar `--lado-n`** de `_chrome/tokens-telas.css` (#D9C08F escuro, #7A5C14 claro, 5,28:1; divergência declarada do mockup #6B5320) e acrescentar ao lado dele `--lado-n-line` (#8C7748 / #9C8452) e `--lado-n-bg` (rgba(217,192,143,.08) / rgba(122,92,20,.07)); na raiz `.sg` os mesmos literais; **não criar `--ln`**. Elemento gráfico (régua, contorno de botão) ≥ 3:1 (`--btn-line`, nunca `--border-strong`, que dá 1,44:1). **Nunca `color-mix()`**; texto ≥ 12 px; alvo ≥ 44 px a 390; títulos em Georgia; `font-variant-numeric: tabular-nums` nos contadores; sem rolagem lateral a 390.
- Texto de terceiro (título, canal) só como texto React com `line-clamp`; nunca HTML, nunca prompt.
- LGPD (D5, D8): nada de texto de comentário; a amostra não entra em `ListaDeSinais` nem no Cowork.
- Sem `any`; Zod nas entradas das ações; kebab-case. Sem push fora do calendário; ≤ 3 pushes/dia/terminal até 27/10. Nunca stash/reset; commit por caminho explícito.

## Review Focus

1. **Toque duplo e rede lenta:** dois cliques no mesmo motivo chamam a ação uma vez; com `pendente`, todos os botões do grupo ficam `disabled`, o tocado mostra "Salvando…"; a 2ª chamada que chegasse (`nao_aberto`) nunca vira "Dispensada" + "já saiu" juntas. Teste da T5 (reducer em node e jsdom).
2. **Responder num lugar com a tela aberta noutro** (Cowork dispensa): a ação recebe `nao_aberto`. Esperado: a linha sai com "Esta sugestão já saiu da lista." e o N cai **uma vez só** (prop nova com `n − 1` + estado local não descontam duas vezes), nunca erro vermelho nem "Tentar de novo". Teste na T5 (reducer) e T6.
3. **Vindo do sino com link velho ou alheio** (`aviso=` de outro usuário, apagado, inexistente, de 5 KB): a página abre sem faixa e sem erro; a faixa "algumas saíram" só aparece quando o aviso é do próprio usuário e algum id dele não está vigente, e só na abertura vinda do sino (a URL perde `de`/`aviso` depois da 1ª renderização). Resumo de 450 ids com o 420º dispensado → faixa. Teste na T6.
4. **Dado hostil na linha:** título de 200 caracteres com emoji e `<script>`, canal longo, miniatura que falha, `mult` 48,3 ("20×+"), `outliers` vazio ou fora de ordem, chave de lugar sem nome (`pais:xk`): nada vaza, `<script>` aparece como texto, página não lança. Teste na T3 e T5.
5. **Leitura que falha:** erro do banco na abertura → `vista.n = null` (a página nunca lança para o `error.tsx`), aba "?"; erro no bloco do A/B Lab vira o estado de erro do bloco e não derruba o Lab; erro ao recarregar depois de uma ação mantém a última lista boa com a faixa "erro com lista antiga". Teste na T5, T6 e T7.

## Falha em verde: o que a tela mostra quando o dado não existe

| Dado ausente | Tela |
|---|---|
| `niche_signals_estado` sem linha | vazio `nunca-calculado` com `textoNuncaCalculado`; aba com "—" e título "ainda não calculado" (nunca 0) |
| chave de `contagens` ausente | frase sem número + selo "não medido" |
| `proprios_agora = null` | "não medido: não temos como confirmar quantos vídeos seus citam X"; primário genérico |
| amostra sem o id (vídeo removido) | linha sem "Puxado por", miniatura "Miniatura indisponível" |
| `evidence.outliers` vazio | sem régua e sem "Puxado por"; primário aponta `/cms/youtube/competitors/outliers`; página não lança |
| chaves de lugar dos próprios ou do outlier ausentes (`parecido`) | frase sem lugar (nunca "lugar diferente" sem medir) |
| `computado_em` > 36 h | selo ⚠ "Dados velhos" no cabeçalho, no contador da aba (ícone visível) e no bloco; faixa com a data |
| `count` nulo na contagem da aba | "?" (nunca 0) |

---

### Task 0: Preparação (controlador, sem código)

- [ ] **Step 1:** conferir que a F2 está em `staging` (T4, T8, T9) e anotar o hash no ledger da F3 (`.superpowers/sdd/ab-lab/f3/ledger.md`, novo); se não estiver, a F3 espera.
- [ ] **Step 2:** conferir por grep e anotar: `TELAS_IA.sugestoes.rota` (hoje `null`); `HREF` em `sinais/avisos.ts`; que `989c352dd` (DF6) está na base; o seletor do sino do teste de integração da F2; `grep -n "fetch\|router.refresh" videos-connected.tsx` (T4); `select count(*) from yt_own_video_meta_daily where site_id = :site and day_pt >= current_date - 30` no 54421 e o tempo de `listarSinaisDoNicho(…, 100)` com semente de 300 vídeos.
- [ ] **Step 3:** registrar no ledger: DF1 e DF2 decididos pelo dono em 23/10 (os dois depois; F3b e "Desfazer dispensa" são linhas próprias da página de status). Declarar no ledger: `dispensado_por = 'user:<uuid>'` sem destino na exclusão LGPD (retenção = vida da linha); a fase 3 da exclusão pode zerar o campo (backlog).
- [ ] **Step 4:** na página de status da frente, trocar a linha da F3 por uma por parte: "F3 leitura e componentes (T2–T5)", "F3 página, aba e bloco do Lab (T6–T7)", "F3 prova na tela, Gio + Logan/Naksu (T8)", "F3-2 envio da lista" e "F3 revisão final, Phil e Yannis (T9)" e "F3b botão Adiar 7 dias" com `◆`.

### Task 2: Leitura — contagens, amostra, textos e regressão do `parecido`

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/sinais/leitura.ts`, `.../sinais/amostra.ts`, `.../sinais/frases.ts`, `.../sinais/avisos.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/{leitura,amostra,frases,avisos}.test.ts`, `apps/web/test/integration/f2-leitura-paridade.test.ts` (casos novos)

**Interfaces:**
- Produces (`leitura.ts`):
  - **Sem helper genérico `vigentes<Q>`** (não tipa sem `any`): cada consulta escreve `.eq('status','aberto').gt('expires_at', iso)`; teste-varredura `vigentes-scan.test.ts`: todo `from('niche_signals')` em `leitura.ts`/`avisos.ts` com `.eq('status', 'aberto')` contém `.gt('expires_at'` (exceções listadas). Dívida declarada: "vigente" também existe em SQL (`sincronizar_sino`), coberta pela integração de paridade.
  - `export async function contarSinaisAbertos(sb, siteId, agora): Promise<number | null>` (`head: true, count: 'exact'`; `count` nulo sem erro → `null` → "?").
  - `export async function contarAbertosEntre(sb, siteId, ids: string[], agora): Promise<number | null>`: até `LIMITE_PENDENTES` (500) ids únicos, em blocos de `BLOCO_DO_IN` (200), somando; acima de 500 → `null`.
- Produces (`amostra.ts`): `AmostraDoVideo` ganha `canal: string | null` (de `competitor_channels.title` no mesmo `!inner`) e `chaves: string[] | null` de `video_lugares` **para as duas origens** (competidor e próprio), filtrado por `site_id`, `null` sem linha. `lerAmostraDasLinhas` consulta tudo em blocos de `BLOCO_DO_IN` (200). Continua fora de `ListaDeSinais`.
- Produces (`frases.ts`): `textoDoRotulo('abrir-concorrente', …)` = "Abrir o vídeo do concorrente"; `textoDoRotulo('abrir-seus', n, lugar, kind)` ganha `kind` ("parecido" vs "sobre X").
- Produces (`avisos.ts`): `hrefDoAviso(dedupKey: string): string` = `/cms/youtube/competitors/sugestoes?de=sino&aviso=${encodeURIComponent(dedupKey)}` (substitui o `HREF`).

- [ ] **Step 1: testes (FAIL):** `contarSinaisAbertos` e `listarSinaisDoNicho` dão o mesmo `n` e os mesmos ids (integração de paridade estendida: rota, `get_signals`, `sugestoes`); `count` nulo → `null`; `contarAbertosEntre`: 450 ids com o 420º dispensado → soma correta em 3 consultas (spy), ids de outro site ignorados, 501 ids → `null`; **DF6 (regressão):** `parecido` com `evidence.proprios = [p1]` público → `proprios_agora = [p1]`, `rotulo_acao = 'abrir-seus'`, `n_proprios = 1`; `p1` privado → `[]` e `abrir-concorrente`; amostra devolve `canal` e `chaves` das duas origens, `chaves = null` sem `video_lugares`, id de outro site ausente, 450 ids = blocos de 200 (spy); `textoDoRotulo` nos 6 casos do mockup (inclui `kind = 'parecido'`); `hrefDoAviso('nicho-resumo:2026-10-23:abc')` codifica os dois-pontos; **`delete process.env.OBS_SINAIS_NICHO` → `calculoLigado: false` e, sem estado, "ainda não foi ligado"**.
- [ ] **Step 2:** implementar. PASS em `npx vitest run test/youtube/observatorio/sinais` e, com banco, nas integrações citadas.
- [ ] **Step 3:** docs do Cowork só se algo mudar para ele (nada muda: o N é o mesmo). Commit `feat: F3 leitura com contagens da aba e amostra com lugares`.

**Estimativa: ~70 mil tokens.**

### Task 3: Tipos, view-model puro e filtro

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_sugestoes/{tipos,view-model,lugar}.ts`
- Test: `apps/web/test/cms/youtube/sugestoes-view-model.test.ts`, `.../sugestoes-lugar.test.ts`

**Interfaces:**
- Consumes: `ListaDeSinais`, `ItemDeSinal`, `AmostraDoVideo` (T2), `textoDoRotulo`, `textoDoVazio`, `textoDaAcao`, `REGRA_SINAIS.multSozinho` (nunca "5" à mão).
- Produces (`tipos.ts`, sem React): `MotivoDaTela` (4 valores do enum), `RespostaDaAcao = { ok: true } | { ok: false; motivo: 'nao_aberto' | 'nao_encontrado' | 'motivo_invalido' | 'sem_permissao' | 'falhou' }`, `AcoesDaLista { dispensar(id, motivo): Promise<RespostaDaAcao> }`. T5 e T6 importam daqui.
- Produces (`lugar.ts`): `nomeDoLugar(chave)`: `pais:xx` → `Intl.DisplayNames(['pt-BR'], { type: 'region' })` (devolve `XX` se der o próprio código ou lançar); `local:slug` → espaços e 1ª maiúscula; outro prefixo → a chave.
- Produces (`view-model.ts`):
  ```ts
  export type FamiliaDoVazio = 'resolvido' | 'calmo' | 'espera' | 'problema' | 'nm'
  export interface LinhaDaVista {
    id: string; kind: 'destino' | 'parecido'
    chip: { rotulo: 'Destino esquentou' | 'Concorrente bombou'; simbolo: 'alfinete' | 'chama' }
    titulo: string
    puxadoPor: { titulo: string; canal: string | null; miniatura: string | null } | null
    regua: { valor: number; acimaDe20: boolean; limiar: number; texto: string } | null
    seus: { texto: string; naoMedido: boolean }
    primario: { texto: string; href: string; cheio: boolean }
    venceEm: string | null               // só ≤ 3 dias
    info: { mults: string; medida: string; regra: string; surgiu: string; vence: string }
    motivos: Array<{ valor: MotivoDaTela; rotulo: string; grupo: 'motivo' | 'feito' }>
  }
  export interface VistaDaLista {
    n: number | null; calculado: string | null; velho: boolean; resumo: string
    faixa: null | { tipo: 'velho' | 'sino-saiu' | 'erro-com-lista'; titulo: string; texto: string }
    filtro: null | { atual: 'todas' | 'destino' | 'parecido'; contagens: { todas: number; destino: number; parecido: number } }
    linhas: LinhaDaVista[]; totalAlemDoLimite: number | null
    vazio: null | { familia: FamiliaDoVazio; titulo: string; texto: string; topo: string }
  }
  export function montarVistaDaLista(e: { lista: ListaDeSinais; amostra: ReadonlyMap<string, AmostraDoVideo>; agora: Date; filtro: 'todas' | 'destino' | 'parecido'; saiuDoAviso: boolean; limite: number }): VistaDaLista
  export function filtrarVista(vista: VistaDaLista, filtro: 'todas' | 'destino' | 'parecido'): VistaDaLista   // pura; recalcula `cheio` e contagens
  export function resumoDaLista(itens: ReadonlyArray<{ kind: 'destino' | 'parecido'; lugar: string }>): string
  function outlierMaisForte(e: Evidence): Evidence['outliers'][number] | null  // maior mult_vpd7, desempate por video_id
  ```
- Regras (copiar os textos de `index.html`: `h4txt`, `alvos`, `vsTxt`, `resumo`, `head`, `row`, `MOT`, `MLAB`, vazios das linhas 405–431): **`outlierMaisForte` alimenta régua, `puxadoPor` e `primario.href`** (nunca `outliers[0]`); `null` → `href = '/cms/youtube/competitors/outliers'`, sem régua e sem "Puxado por". Régua 1× a 20× em escala log, "20×+" acima de 20. Lugar do `parecido`: 1ª chave `pais:` do outlier; "mesmo lugar" só se ela está entre as chaves dos próprios; `null` em qualquer das duas medidas → **frase sem lugar** (nunca "lugar diferente" sem medir). `primario.href`: `abrir-concorrente` → `/cms/youtube/competitors/video/<id do outlier mais forte>`; `abrir-seus`/`playlist` → `/cms/youtube/videos?ids=<proprios_agora.join(',')>&total=<n_proprios>`; `generico` → `/cms/youtube/videos`; `cheio` só na 1ª linha da lista filtrada. `calculado` "Calculado hoje às HH:MM" / "Calculado em DD/MM, HH:MM" (fuso SP). **`filtro` presente quando `n > 8` ou `filtro.atual !== 'todas'`**; filtro sem linha e `n > 0` → "Nenhum destino aberto agora." (ou "Nenhum concorrente…") + botão "Ver todas (N)". **`filtro` em `montarVistaDaLista` só define `filtro.atual`; as linhas vêm sempre completas (destino e parecido) e o recorte é `filtrarVista`.** Família do vazio: `tudo-respondido` resolvido; `sem-terceiro-outlier`, `abaixo-do-minimo`, `sem-grupo` calmo; `nunca-calculado`, `sem-historico` espera; `sync-atrasado` problema; `sem-lugar` nm. Motivos por `kind` na ordem do mockup; "Já fiz" em `grupo: 'feito'` (traço antes dele).

- [ ] **Step 1: testes (FAIL)** com literais, um por estado do mockup: `lista` (3 linhas, só a 1ª `cheio`, 1ª sem vídeo seu); `quarenta` (filtro presente, 28/12; 10ª linha `video_novo` + `n_proprios = 1`); `titulo-longo` (48,3 → `acimaDe20`, sem miniatura); `alvos-nao-medido`; `sem-video-proprio`; vence ≤ 3 dias; `velho` com faixa e data; `saiuDoAviso` → faixa `sino-saiu`; cada `motivoVazio` com a família e a frase; `contagens` sem a chave → frase sem número; `n` 120 com limite 100 → `totalAlemDoLimite = 120`; limiar vem de `REGRA_SINAIS.multSozinho` (`vi.mock` muda o texto); outliers fora de ordem → `href` e `puxadoPor` do mesmo (mais forte); `outliers: []` não lança; `parecido` com outlier `pais:vn` e próprio `pais:vn` → "mesmo lugar", próprio sem `chaves` → frase sem lugar, mesma frase em `limite` 100 e 3; `filtro` presente com `n = 8` e `atual = 'destino'`; `montarVistaDaLista({ filtro: 'destino' })` devolve também as linhas `parecido`; `filtrarVista(quarenta, 'parecido')` → 12 linhas, só a 1ª `cheio`; `resumoDaLista` (1, 2 e 5 destinos: "Vietnã, Japão e +3"); `nomeDoLugar('pais:vn') = 'Vietnã'`, `'pais:xk'` não lança, `'local:sao-tome'` → "Sao tome"; título com `<script>` sai igual (string).
- [ ] **Step 2:** implementar. PASS `npx vitest run test/cms/youtube/sugestoes-*`. **Step 3:** commit `feat: F3 view-model da lista de sugestões`.

**Estimativa: ~80 mil tokens.**

### Task 4: Destino do primário — `/cms/youtube/videos?ids=`

> Necessária para a honestidade do primário (§6: o rótulo diz N vídeos; o destino mostra esses N). Não sai em corte.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/page.tsx` (recebe `searchParams`), `.../videos/videos-connected.tsx` (faixa)
- Create: `.../videos/filtro-ids.ts`
- Test: `apps/web/test/cms/youtube/videos-filtro-ids.test.ts`

**Interfaces:** `lerFiltroDeIds(v): string[] | null` (uuids válidos, únicos, ≤ 20; nenhum → `null`); `lerTotal(v): number | null` (inteiro 1–10000). Com ids, `.in('id', ids)` sempre com o `eq('site_id', siteId)`. Faixa: "Mostrando N vídeos da sugestão · Ver todos"; com corte, "Mostrando 20 de 25 vídeos da sugestão · Ver todos".

- [ ] **Step 1: testes (FAIL):** 2 uuids → 2; lixo e repetido descartados; 25 → 20; vazio → `null`; `total=25` com 20 ids → faixa "Mostrando 20 de 25"; `total=abc` ignorado; render com `ids` de outro site → lista vazia com "Nenhum destes vídeos está neste site" e "Ver todos".
- [ ] **Step 2:** implementar (conferir antes que `videos-connected.tsx` não refaz a busca no cliente, perdendo o filtro). **Step 3:** commit `feat: F3 lista de vídeos filtrada pelos ids da sugestão`.

**Estimativa: ~40 mil tokens.**

### Task 5: Componentes da lista (client) e reducer

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_sugestoes/{estado-da-lista.ts,sugestoes-lista.tsx,linha.tsx,regua-mult.tsx,vazio.tsx,esqueleto.tsx,sugestoes.css}` (`sugestoes-lista.tsx` com `'use client'`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/tokens-telas.css` (`--lado-n-line`, `--lado-n-bg`)
- Test: `apps/web/test/cms/youtube/sugestoes-estado.test.ts` (node), `.../sugestoes-lista.test.tsx` (`// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: `VistaDaLista`, `filtrarVista` (T3), `RespostaDaAcao`, `AcoesDaLista` (`tipos.ts`).
- `estado-da-lista.ts` (puro, sem React): `reduzirLista(estado, evento)` e `vistaVisivel(prop, estado, ultimaBoa)`. Estado = `{ pendente: { id, motivo } | null; respondidas: Map<id, 'sucesso' | 'ja-saiu'>; faixaDeErro: boolean }`. **`ultimaBoa` fica num `useRef` atualizado durante o render quando `prop.n !== null` (sem `useEffect`, sem evento) e entra em `vistaVisivel` só como parâmetro; `vistaVisivel` é pura e calculada no render: `prop.n !== null` → a prop; `prop.n === null` com `ultimaBoa` → `ultimaBoa` com faixa `erro-com-lista`, na mesma chamada (sem quadro vazio nem perda de foco).** Regras: (a) linhas e N mostrados são **sempre derivados** da prop: `linhas = vista.linhas − respondidas`, `n = vista.n − |respondidas ∩ ids de vista.linhas|` (a linha que o servidor já tirou não desconta de novo); (b) prop com `n === null` depois de uma ação mostra `ultimaBoa` e liga a faixa `erro-com-lista` (ver acima); (c) chave estável por `id`, nunca por índice. Tabela de desfechos: `ok` → confirmação de sucesso; `nao_aberto` | `nao_encontrado` → linha sai + "Esta sugestão já saiu da lista." (sem "Tentar de novo"); `sem_permissao` → linha fica, "Você não tem permissão para responder agora. Entre de novo ou fale com o admin do site." com o link "Entrar de novo" para a rota de login do CMS com `next=` da página atual, sem "Tentar de novo"; `motivo_invalido` | `falhou` → linha fica + "Não salvou “<Motivo>”. A sugestão continua aberta." + "Tentar de novo “<Motivo>”"; (d) **resposta tardia:** o evento leva `id` + `motivo` da chamada; o reducer ignora resposta de chamada que não é a `pendente` atual, exceto `ok`, que sempre vale (estouro de 15 s → "sem conexão", depois `ok` tardio → a linha sai com a confirmação); rejeição da promessa ou 15 s sem resposta → "Não salvou “<Motivo>”: sem conexão. A sugestão continua aberta." + "Tentar de novo “<Motivo>”".
- `SugestoesLista(p: { vista; acoes: AcoesDaLista | null; modo: 'pagina' | 'bloco'; verTodasHref?: string })` usa `useReducer(reduzirLista)`; `EsqueletoDaLista(p: { linhas: number })`.
- Comportamento (README do mockup r2): Dispensar a 1440 é botão de texto sublinhado `--muted` a 24 px do primário; a 390, "⋯" de 44 × 44; os dois coexistem no DOM, um escondido por container query. O grupo de motivos (botões, não `radiogroup`) grava ao toque; ao tocar, todos os botões do grupo ficam `disabled`, o tocado mostra "Salvando…" (`aria-busy`) e "Cancelar" some; Esc e "Cancelar" fecham e devolvem o foco ao gatilho. **A confirmação substitui a linha no mesmo lugar** (como `row()` do mockup, `role="status"`, 44 px, 13,5 px, ✓ verde) e recolhe após 5 s ("Dispensada: <motivo>. Não volta nos próximos 30 dias." / "Marcada como já feita…"); o foco vai à próxima linha no momento da resposta (última linha: à frase-resumo, `tabindex=-1`); N e frase-resumo caem depois da resposta; laranja passa para a 1ª aberta; nunca faixa no topo para resultado de ação. ⓘ abre o método (`info`). **Toda troca por largura é CSS em `@container (max-width:640px)` sobre `.sg`**, sem `useJanelaEstreita`: a 390 a linha recolhe com "vídeos seus" e "Detalhes ▾" (44 px); o servidor renderiza todas as linhas num `<ol class="sg-list">` só com `<li class="sg-row">` (a confirmação ocupa o mesmo `<li>`, mesma posição e `key`) e `.sg:not([data-mais]) .sg-list > .sg-row:nth-child(n+11){display:none}` dentro da container query esconde as demais; "Mostrar mais (K)" põe `data-mais` e grava `mais=1` por `router.replace(…, { scroll: false })`. Filtro: `filtrarVista` no cliente + `window.history.replaceState` (sem refazer a leitura); `position: sticky; top: calc(var(--obs-topbar-h, 52px) + 8px)` (a barra do Observatório; `--obs-topbar-h` só existe em `_canal/canal.css`, então o fallback 52 px é o valor real; `--z-grudado` existe em `_chrome/camadas.css`) na página, e `position: static` no `modo='bloco'`, com `background:var(--bg)`, `padding-block:8px`, `z-index:var(--z-grudado, 2)` e borda inferior `--border-subtle`. `modo='bloco'`: 3 linhas e "Ver todas (N)" quando N > 3; `vazio` no bloco = uma linha (ícone da família + título + link "Ver detalhes"), sem parágrafo e sem `min-height`. `acoes = null` esconde Dispensar. Miniatura = `<img width={96} height={54} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="">` com `onError` trocando pelo bloco "Miniatura indisponível" (`--dim` sobre `--sunk`, borda tracejada `--border-strong`), sem `next/image`. `regua-mult.tsx` (prefixo `sg-rg-`): traço do limiar 2 px `--text` com contorno 1 px `--surface`, trilha `--btn-line`, `aria-label` com "regra 5×" (valor de `REGRA_SINAIS`). **Esqueleto** copia `.sk-row`: grid `96px minmax(0,1fr) 248px`, gap 16, padding 16, `min-height:209px` a 1440 e `259px` na container query; blocos em `--skel`, pulso só em `prefers-reduced-motion:no-preference`; cabeçalho com o título real e `.cnt` "…".

- [ ] **Step 1: testes (FAIL).** Reducer em node: sucesso + prop nova com `n − 1` → N cai uma vez; sucesso + prop velha → cai uma vez; `vistaVisivel({ n: null, linhas: [] }, estado, A)` → A com `erro-com-lista` na mesma chamada; estouro de 15 s e então `ok` tardio → linha sai com a confirmação; os desfechos da tabela, orientados por tabela (`ok`, `nao_aberto`, `nao_encontrado`, `sem_permissao`, `motivo_invalido`, `falhou`, rejeição). jsdom: só um botão com a classe do primário cheio; Dispensar abre os motivos do `kind`; Esc fecha e o foco volta; **dois cliques rápidos → `acoes.dispensar` uma vez**; motivo → confirmação no lugar da linha, N cai de 3 para 2 só depois da promessa, foco na linha seguinte; `sem_permissao` sem "Tentar de novo"; "Tentar de novo" chama de novo com o mesmo motivo; `<script>` no título vira texto; com filtro, faixa e 40 linhas o CSS esconde da 11ª em diante (seletor `.sg-list > li:nth-child(n+11)`); HTML do servidor com 40 linhas contém as 40 e o botão "Mostrar mais (30)"; `modo='bloco'` com 5 linhas → 3 e "Ver todas (5)"; bloco com `vazio` → uma linha e "Ver detalhes"; `acoes = null` → sem Dispensar; vazio sem "0" fora do texto da contagem; `grep -nE "color-mix|useJanelaEstreita"` vazio; varredura de cores do CSS (Global Constraints).
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit `feat: F3 componentes da lista de sugestões`.

**Estimativa: ~140 mil tokens.**

### Task 6: Página, aba e ações em Competidores

**Files:**
- Create: `.../competitors/sugestoes/{page.tsx,loading.tsx}` (`EsqueletoDaLista linhas={3}`), `.../_sugestoes/actions.ts` (`'use server'`), `.../_sugestoes/aviso.ts`, `.../_sugestoes/dados.ts`
- Modify: `.../_chrome/view-model.ts` (`ChromeTab` ganha `'sugestoes'`, **aba em 2º lugar**), `.../_chrome/tabs.tsx` (⚠ como ícone dentro do contador), `.../_chrome/chrome-server.tsx` (contagem em paralelo), `.../competitors/page.tsx` (`?aba=sugestoes` → `redirect('/cms/youtube/competitors/sugestoes')` antes de qualquer leitura), `apps/web/src/lib/youtube/observatorio/contexto-ia/telas.ts` (`sugestoes.rota = 'sugestoes'`)
- Test: `apps/web/test/cms/youtube/{sugestoes-actions,sugestoes-aviso,chrome-view-model}.test.ts`, testes de `TELAS_IA`

**Interfaces:**
- **Step 0 (libera a T7):** fixar só o tipo de `abrirListaDaTela(agora: Date, limite: number): Promise<{ estado: 'sem_acesso' } | { estado: 'erro' } | { estado: 'ok'; lista: ListaDeSinais; amostra: Map<string, AmostraDoVideo>; podeResponder: boolean }>` (molde `LeituraDaFila`; `switch` exaustivo na página e no bloco).
- `actions.ts`: `dispensarSugestao(id, motivo): Promise<RespostaDaAcao>`: (1) `denyUnlessSiteAdmin` antes do cliente de serviço; (2) `por = 'user:' + uid`; (3) Zod (`z.string().uuid()`, enum dos 4 motivos); (4) `dispensarSinal(sb, siteId, id, 'dispensado', motivo, por)`; (5) `revalidatePath('/cms/youtube/competitors', 'layout')` (a aba está em todas as páginas do Observatório) e `revalidatePath('/cms/youtube/ab-lab')`. Exceção vira `{ ok: false, motivo: 'falhou' }`, sem texto do banco.
- `dados.ts`: `abrirListaDaTela` (guarda `requireSiteScope edit`; `podeResponder = (await requireSiteAdminScope(siteId)).ok`, **o mesmo predicado da ação**; amostra: página = outlier mais forte de cada linha + até 3 ids de `evidence.proprios` por `parecido` (para o "mesmo lugar"); bloco = 3 linhas, com o outlier mais forte e até 3 `proprios` de cada `parecido` entre elas (mesma frase da página). A página nunca lança: erro de leitura → `{ estado: 'erro' }` → `vista.n = null`); `contarParaAAbaSugestoes(): Promise<{ visivel: false } | { visivel: true; n: number | null; velho: boolean; calculado: boolean }>`.
- `aviso.ts`: `saiuDoAviso(sb, siteId, userId, dedupKey, agora): Promise<boolean>`: valida `dedupKey` com `/^nicho(-resumo)?:[\w:.-]{1,80}$/` (fora disso → `false` sem ir ao banco); lê `notifications` por `(site_id, user_id, dedup_key)`; individual → id de `nicho:<id>`; resumo → `payload.ids`; `true` só se a linha existe e `abertos < new Set(ids).size`, onde `abertos = await contarAbertosEntre(…)`; **`abertos === null` → `false` (nunca `null < n`) + `Sentry.captureMessage('sugestoes: contagem do aviso nula', { level: 'warning' })`**; exceção → `Sentry.captureMessage('sugestoes: saiuDoAviso falhou', { level: 'warning' })` e `false`.
- Aba: `n` com `…` enquanto carrega, `?` no erro, **"—" e título "ainda não calculado" quando `calculado = false`**, `0` só com cálculo feito; `velho` → ícone ⚠ visível dentro do contador (`<svg aria-hidden>` em `--warning-text`) com `aria-label="3 sugestões, dados velhos"`, não só `title`. Na aba Sugestões, `tabs.tsx` aplica `font-size:12px` ao contador e `min-height:44px` só nela. Pré-existentes, fora da F3 (`.obs-ch-ct` 11,5 px; abas de 40/42 px): registrar no `ROTEIRO-DE-TESTE-E-MELHORIAS.md`. **Plano B:** se o Gio medir a aba fora de 0..390 px a 390, `tabs.tsx` rola a aba atual para a vista (`scrollIntoView({ inline: 'nearest' })`) e o Logan decide a ordem. Quem só lê (sem admin) vê a aba e a lista sem Dispensar.
- Página: `ObservatoryChromeServer tab="sugestoes"` com `perguntarIa` de `TELAS_IA['sugestoes']`; `limite = 100`; sem acesso → mesma resposta da página `saiu`; depois da 1ª renderização vinda do sino, `router.replace` tira `de` e `aviso` da URL.

- [ ] **Step 1: testes (FAIL):** ação sem admin → `sem_permissao` e cliente de serviço não criado (spy); id não-uuid e motivo fora do enum recusados sem tocar o banco; sucesso chama `dispensarSinal` com `por = 'user:<uid>'` e as duas revalidações; `nao_aberto` repassado; exceção → `falhou`; editor sem admin → `podeResponder = false` e a ação com o mesmo usuário → `sem_permissao`; `saiuDoAviso`: aviso de outro usuário, inexistente, `undefined`, 5 KB, individual aberto (`false`), resumo de 3 com 1 dispensado (`true`), resumo de 450 com o 420º dispensado (`true`), exceção → `false` + Sentry; `contarAbertosEntre` mockado em `null` → `false` + Sentry; resumo com id repetido (`[a, a, b]`, ambos abertos) → `false`; `buildChromeView`: aba 2ª; `n: 3` → "3"; `n: null` → `?`; `velho` → ícone no contador e `aria-label`; `calculado: false` → "—", nunca "0"; `n: 0` com cálculo → "0"; `?aba=sugestoes` redireciona; `TELAS_IA.sugestoes.rota === 'sugestoes'` e testes exaustivos de telas verdes; leitura com erro → `vista.n = null` sem lançar.
- [ ] **Step 2:** implementar. PASS. `npm run typecheck -w apps/web` (saída em arquivo; só falhas no contexto). **Step 3:** commit `feat: F3 página e aba Sugestões em Competidores`.

**Estimativa: ~90 mil tokens.**

### Task 7: Bloco no A/B Lab e "Candidatos (fora da contagem)"

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes.tsx` (server component assíncrono dentro de `<Suspense>` com cabeçalho "Sugestões …" e `EsqueletoDaLista linhas={3}`)
- Modify: `.../ab-lab/page.tsx` (passa o bloco como `slot`; `getSuggestedVideos` intacto), `.../_components/ab-lab-dashboard.tsx`
- Test: `apps/web/test/cms/youtube/ab-lab-bloco-sugestoes.test.tsx` (jsdom), teste existente do dashboard

**Interfaces:**
- Consumes: `abrirListaDaTela(agora, 3)` (o N continua exato pelo `count`), `montarVistaDaLista`, `SugestoesLista` com `modo='bloco'`, `verTodasHref='/cms/youtube/competitors/sugestoes'`, ação da T6. `AbLabDashboardProps` ganha `blocoSugestoes?: React.ReactNode`.
- **Erro do bloco (não existe fronteira de erro por componente no Next):** o bloco não lança. `abrirListaDaTela` devolve `{ estado: 'erro' }` e o bloco renderiza o estado de erro do mockup (`.band.err`: "Não deu para ler as sugestões." + "Tentar de novo" de 44 px a 390, `router.refresh`, reusando `BlocoComTentativa` de `_chrome/ausencia/tentar-de-novo.tsx`); qualquer exceção fora dela é pega por `try/catch` em `BlocoSugestoes`, vira o mesmo estado e chama `Sentry.captureException`. Sem `ErrorBoundary` de classe.
- Dashboard: o slot entra antes do cartão de candidatos; cartão = `<h2>` "Candidatos (fora da contagem)" com a mesma classe do título do bloco (Georgia 600 17 px) e a frase em 12,5 px `text-cms-text-muted` (sem eyebrow); trocar `text-[9px]` (linhas ~250, ~274, ~383) e `text-[11px]` (~300) por `text-xs`; "Iniciar Lote (n)" em contorno, não laranja.

- [ ] **Step 1: testes (FAIL):** `const el = await BlocoSugestoes(); render(el)` com `abrirListaDaTela` mockado devolvendo `erro` e, noutro caso, lançando → "Não deu para ler as sugestões." e resto do dashboard renderiza; dashboard com `blocoSugestoes` renderiza antes de "Candidatos (fora da contagem)"; "Sugeridos para testar" sumiu; `grep -nE 'text-\[(9|10|11)px\]' ab-lab-dashboard.tsx` vazio; "Iniciar Lote" sem a classe do primário laranja; lote continua funcionando; fallback do Suspense mostra "…" no lugar do N, nunca 0; bloco vazio = uma linha com "Ver detalhes"; `git diff --stat` de `queries.ts` (`getSuggestedVideos`) vazio.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit `feat: F3 bloco Sugestões no A/B Lab, candidatos fora da contagem`.

**Estimativa: ~60 mil tokens.**

### Task 8: Prova na tela (Gio) e revisão de UX/UI (Logan, Naksu)

- [ ] **Step 1 (Gio, Sonnet, navegador):** semente local (54321) com os dados de `BASE`, `LONGO`, `quarenta` e um site sem `niche_signals_estado`, com `expires_at` relativo ao `now()` real (ou o roteiro sem `OBS_NOW_OVERRIDE`); percorrer os estados do mockup a 1440 e 390, claro e escuro, e comparar com `shots/`. Roteiro: dispensar (motivo, confirmação no lugar da linha, N cai na página, no bloco e na aba depois de recarregar), Esc, "Tentar de novo" com a rede cortada, **toque duplo com Slow 3G**, sessão expirada e então dispensar, filtro "Destinos" com N = 9 e então dispensar, **confirmação no lugar da linha a 390 na 7ª linha**, vir do sino (individual e resumo com um item dispensado), link velho `?aba=sugestoes`, flag apagada, **bloco do A/B Lab vazio e em erro**. Medir: alvos ≥ 44 px a 390, texto ≥ 12 px, `scrollWidth` sem rolagem lateral, contraste ≥ 4,5:1 (elementos gráficos ≥ 3:1), zero `color-mix`, **aba Sugestões dentro de 0..390 px sem rolar a barra**, altura do esqueleto de 3 linhas contra a lista carregada (diferença ≤ 60 px a 1440 e a 390). Mesma lista e mesmo N pelo `get_signals` sobre a mesma semente. Validação autenticada conforme `docs/ops/runbook-cms-e2e-local.md`. Capturas em `.superpowers/sdd/ab-lab/f3/gio/`; veredito em até 10 linhas.
- [ ] **Step 2 (Logan e Naksu, em paralelo):** comparam as capturas com o mockup, com os deltas declarados: aba no lugar do botão e em 2º lugar com ⚠ no contador; `--lado-n` claro #7A5C14; sem o selo "formato não confirmado"; confirmação no lugar da linha. Consertos em Sonnet, re-conferência até acordo.

**Aceite:** veredito "pronto" do Gio e acordo de Logan e Naksu no ledger. **Estimativa: ~100 mil tokens.**

### Task 9: Revisão final (enxuta)

- [ ] **Step 1:** Phil revisa T2 e T6 (leitura, `notifications`, consultas por abertura); Yannis revisa T2–T7. Consertos em Sonnet até acordo; resultado no ledger.

**Ordem de execução:** T0; T2, T3 e T4 em paralelo; T5 depois da T3; T6 depois de T2 e T3 (só o `page.tsx` espera a T5); T7 depois do Step 0 da T6 e dos dados da T6; T8; T9.

**Estimativa: ~50 mil tokens.**

## Envios e calendário

| Envio | Conteúdo | Condição | O dono vê |
|---|---|---|---|
| **F3-2** (único; sem migration) | T2–T7 | F2-2 em produção (portão da T6b ≥ 0,90, data no ledger da F2); T8 e T9 fechadas; dentro do orçamento de pushes do dia, combinado com a frente do A/B | a aba "Sugestões (N)" em Competidores, o bloco no A/B Lab e o clique do sino abrindo a lista |

**Caminho crítico (Hanna H4):** F2-2 em produção (portão ≥ 0,90) → T6 → T7 → T8 → T9 → F3-2. T2–T5 rodam enquanto a F2-2 espera o portão, para o F3-2 subir no mesmo dia em que ela estiver em produção. Se cair até 27/10, entra na promoção combinada do dia (≤ 3 pushes/dia/terminal). **O dono vê:** "Em Competidores há uma aba nova, 'Sugestões (N)', com o que bombou no nicho e você ainda não tem; o mesmo bloco aparece no topo do A/B Lab; o clique no sino abre essa lista." **O que ele faz:** abrir a aba e confirmar; nenhum comando.

**Aceite em produção (Hanna H2), pelo controlador, no mesmo dia do deploy** (depois da 1ª execução de `sinais_do_nicho` se o cálculo ainda não rodou desde o deploy; script do dono `bash <arquivo>.sh` só se a leitura de produção for negada): (a) **N > 0:** o N da aba, do bloco e do `get_signals` iguais e os `id`s coincidem; dispensar 1 linha pela tela com "Não me interessa" derruba o N nos três e no sino (`/api/notifications/count`); anotar o id no ledger. (b) **N = 0:** os três mostram o mesmo `motivoVazio`, a frase da família certa e nenhum "0" fora do texto da contagem; "dispensa derruba o N" fica pendente para a 1ª sugestão real, com data no ledger e linha `⏳` na página de status. Rollback: só código (sem banco); as notificações já criadas apontam para `/cms/youtube/competitors/sugestoes`.

## Estimativa total

T0 5 + T2 70 + T3 80 + T4 40 + T5 145 + T6 92 + T7 60 + T8 100 + T9 50 ≈ **642 mil tokens** (r3: +7 mil das emendas; conta somada de novo, Yannis confirma no ledger) (r1: 710 mil com DF1; a F3b leva ~110 mil, ver abaixo).

## F3b — Depois (volta em 7 dias), depende do dono

**Gatilho:** o dono aprovar o delta desenhado no mockup M3: rótulo **"Adiar 7 dias"** num grupo próprio depois de um segundo traço (`[motivos] | Já fiz | Adiar 7 dias`, depois "Cancelar"; nunca "Depois", que lê como "fechar"), faixa "Adiada" com relógio e `border-left` em `--border-strong` sobre `--sunk` (sem verde), e vazio `adiado` com a data de volta ("Você adiou 2 sugestões. A primeira volta em DD/MM."; lista com adiados: "2 adiadas voltam até DD/MM."). Logan e Naksu desenham antes do código. Spec §6 emendado para "na F3b, se o dono aprovar".

**Escopo (estimativa ~110 mil: T1 60 + partes de T2/T3/T5/T6/T8 ~50):** migration C por `npm run db:new f3_niche_signals_adiar` (`adiado_ate`, `adiado_por`, `niche_signals_adiar` com o lock de `dispensar`, `sincronizar_sino` com "aberto" = `status = 'aberto' and (adiado_ate is null or adiado_ate <= now())`); filtro `naoAdiado(iso)` exportado de `leitura.ts` e usado em todas as consultas de vigentes, inclusive `avisos.ts` (teste-varredura estendido); `MotivoDaLista 'adiado'` e `contagens.adiados`; `adiarSinal`; `textoDoVazio('adiado')`; motivo `adiar` (grupo `'adiar'`) na T3/T5; `ja_adiado` em `RespostaDaAcao`; envio F3-1 (migration em produção antes do código; `npx supabase migration list` confere que só a C está pendente) e revisão separada da migration por Phil e Yannis. Rollback em transação única e ensaiado: `begin; create or replace … sincronizar_sino (F2, 20261022000003); drop function if exists public.niche_signals_adiar(uuid,uuid,text); alter table niche_signals drop column adiado_ate, drop column adiado_por; commit;` (os adiados voltam ao N na hora).

**Consertos já conhecidos que a F3b herda:**
- **P-C1 / Y-C4:** só adiar de verdade se `expires_at > now() + 7 d`; senão a função devolve `{ok:true, adiado_ate, volta:false, expira_antes:true}` e a faixa diz "Adiada. Ela vence em DD/MM, antes de voltar."; `contagens.adiados` conta só os que voltam.
- **P-C2:** precedência: `adiados > 0 ? 'adiado' : (estado.motivo_vazio ?? …)`, com a frase do motivo do cálculo como 2ª linha do vazio.
- **P-C5 / Phil-M6 / Logan:** `ja_adiado` e item vencido ainda `aberto` (`vencida`) tratados na tela como `nao_aberto`.
- **L-C1, N-C6:** rótulo e desenho acima.
- **Outbox × adiado:** pendente adiado não é enviado; ao voltar, vai sempre no **resumo** (não renasce como "Nova sugestão") (Phil-M2).
- **LGPD:** `adiado_por` entra na limpeza da exclusão junto com `dispensado_por`.
- Revisão do índice: `niche_signals_site_status_idx` basta (filtro residual).

## Menores adiados (uma linha cada)

- Contador `.obs-ch-ct` a 11,5 px e abas com 40/42 px (pré-existentes): a F3 só corrige na aba nova (T6); o restante entra em `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` (Naksu C4, D1) pelo controlador na T0.
- Paridade `--lado-n` nas telas vizinhas (`--sq-com` em `_saiu/saiu.css`): unificar numa emenda de tokens, fora da F3 (Naksu C1).
- `videos/page.tsx` lê todos os vídeos sem limite: pagar quando passar de 2.000 vídeos (Yannis, dívida existente).
- Duas definições de "vigente" (TS e SQL): coberta pelo teste de paridade; pagar em qualquer mudança da regra.
- Adiado que volta não reenvia o sino; "Anotar como pauta" (D26); absorver "Candidatos" (D25); "adiar" pelo Cowork (DF5); selo "formato não confirmado" no `parecido`; "meu vídeo caiu" e tipos da F4; Desfazer (DF2): cada um com o gatilho da seção de decisões.
