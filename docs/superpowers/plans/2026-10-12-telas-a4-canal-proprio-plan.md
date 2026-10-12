# Telas do Observatório, fase A4 (página do canal próprio e vídeo próprio) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por vez,
> Sonnet, `effort: high` (desce para `medium` quando as revisões voltarem limpas; nunca `xhigh` nem `max`), um revisor
> por tarefa. Revisão final do lote em Opus, `high`. Os passos usam caixas (`- [ ]`).

**Objetivo:** o canal próprio ganha página (`canal/<id>`) e o vídeo próprio ganha tela (`video/<id>`), as duas lendo pela primeira vez `yt_own_video_reach_daily` (impressões e CTR de miniatura) e `yt_own_video_daily` (diário por vídeo); os "não medido" e "começa em breve" do canal próprio na lista de Canais e na comparação viram número real onde o dado existe; a comparação ganha o cartão "Só o seu canal mede".

**Arquitetura:** dois leitores de servidor novos e pequenos (`L/proprio/ler.ts`) leem as duas tabelas do L2 e os relatórios de alcance, sempre com janela de datas, sempre depois da guarda de acesso e só para quem edita o site. Tudo o que vira número ou frase sai de funções puras (`L/proprio/dias.ts`, `L/proprio/vpd.ts` e os modelos em `C/_proprio/`), testadas sem banco. **O motor (`createObservatory`) não muda:** o dado privado chega às telas como um parâmetro a mais dos modelos, nunca como série sintética dentro de `ObsVideo`. As rotas `canal/[id]` e `video/[id]` ramificam pelo dono do canal.

**Stack:** Next 16, React 19, TypeScript estrito, Vitest (happy-dom; `node` nos leitores; jsdom onde indicado), Playwright (projeto `observatorio`, banco local).

**Spec:** `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (v9): emendas 40, 44 (item 5), 45 e 46; seção 4.1 (linha A4) e 4.2 "A4"; seções 8.3, 16 (inteira), 17 (inteira), 18.6, 19 e 20. Quem executa lê o spec junto com a tarefa: **todo texto de tela citado aqui está no spec e vale o do spec, letra por letra.** Onde o corpo e uma emenda discordarem vale a emenda. Spec da coleta (o que as tabelas guardam): `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md`, seções 1, 5 e 6; migration `supabase/migrations/20261009000001_coleta_canais_proprios_l2.sql`.

**Fonte visual (mockup aprovado em 10/10):** `docs/superpowers/mockups/2026-10-07-pagina-canal/{canal-proprio.html,dados-proprio.js,impressoes.js,impressoes.css,video-proprio.html,video-proprio.js,regua.js,regua.css,faixa-numeros.js,comparar.js}`. Medidas, espaçamento e ordem saem dali; os dados do mockup são uma exportação de 09/10, não o banco: copia-se a forma, nunca o dado.

**Ledger:** `.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/progress.md` (do controlador). Relatório de cada tarefa em `task-N-report.md` na mesma pasta; a resposta do agente ao controlador tem até 10 linhas. Regras do implementador: as de `.superpowers/sdd/2026-10-11-telas-a3-canais-comparacao-plan/regras-implementador.md`, que o controlador copia para a pasta nova trocando o parágrafo do produto. Perguntas ao dono: `.superpowers/sdd/a4-perguntas-ao-dono.md`.

**Formato dos testes neste plano:** as Tarefas 1, 2, 3 e 12 (os modelos e leitores de que todas as outras dependem) trazem o arquivo de teste inteiro. Nas demais, o **título de cada teste é o contrato** e o corpo vem inteiro só em um ou dois testes de cada tarefa; onde o corpo está como `/* … */`, o implementador o escreve **antes do código**, no padrão do teste completo da mesma tarefa, e registra o vermelho. Isto é uma limitação conhecida deste plano (as telas dependem de props de componentes que só existem depois das tarefas anteriores); o revisor de cada tarefa confere que nenhum título ficou sem afirmação.

Abreviações de caminho:
- `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`
- `L/` = `apps/web/src/lib/youtube/observatorio/`
- `T/` = `apps/web/test/youtube/observatorio/`
- `E/` = `apps/web/e2e/tests/cms/observatorio/`
- `M/` = `docs/superpowers/mockups/2026-10-07-pagina-canal/`

## O portão do spec e o dado que existe (lido em 12/10, só SELECT)

O spec põe um portão na A4: emenda 44, item 5 ("A4 só começa depois da Task 11 do L2 e de alguns dias de série"), a linha A4 de 4.1 ("precisa da conferência da Task 11 e de alguns dias de dado") e o aceite de A4.1 ("conferência da Task 11 registrada").

| Parte do portão | Estado em 12/10 | Fonte |
|---|---|---|
| Task 11 por SELECT | **feita** em 10/10 15:45, sem falha | roteiro 3f; ledger do L2, linha 197 |
| Achado A (médias 0 em dia sem view) | **fechado** em 10/10 (código e linhas corrigidos) | ledger do L2, linhas 202 a 222 |
| Conferência de 3 vídeos contra o YouTube Studio | **NÃO feita** (a extensão do navegador não conectou; é do dono) | ledger do L2, linhas 200 e 217 |
| "Alguns dias de série" | **2 execuções** da coleta (10/10 e 11/10) | `collected_at` das duas tabelas |

Produção (`supabase db query --linked`, só contagem):

| Tabela | Linhas | Dias distintos | De | Até | Canais | Vídeos |
|---|---|---|---|---|---|---|
| `yt_own_video_reach_daily` | 103 | 20 | 08/09/2026 | 08/10/2026 | 1 | 33 |
| `yt_own_video_daily` | 96.857 (2.433 com `views > 0`) | 4.062 (o histórico inteiro, desde 26/08/2015) | 26/08/2015 | 08/10/2026 | 1 | 35 |

- Relatórios de alcance (`yt_reporting_reports`, tipo `channel_reach_basic_a1`): 62, todos normalizados (20 `baixado`, 42 `vazio`), um por canal e por dia, de 08/09 a 08/10. Nenhum dia "não medido" hoje nesse tipo.
- **O dia do relatório bate com `day_pt`:** nos 6 relatórios mais novos, `start_time` (07:00 UTC do dia D) corresponde a `day_pt = D`. O dia do relatório é a **data UTC de `start_time`** (resolve o "a conferir" de 16.6).
- **O diário grava zero:** a Analytics API devolve todos os dias da janela, então linha com `views = 0` é **zero medido**; "não medido" é o dia **sem linha**. Nos últimos 30 dias: 945 linhas, 9 com view. O diário chega com 2 a 3 dias de atraso (em 11/10 o último `day_pt` era 08/10).
- Canais próprios em produção: `tnFigueiredo` (1.160 inscritos, 35 vídeos, último em 10/12/2024: parado) e `Thiago Figueiredo` (3 inscritos, **nenhum vídeo**).
- Banco local: **as duas tabelas estão vazias** (0 linhas) e não há relatório. Toda prova em navegador depende da semente da Tarefa 15.

**Como este plano trata o portão (D1):** a Parte 1 é código em `staging`, provado com dado semeado. **A promoção para `main` e o aceite de A4.1 esperam a conferência com o Studio** (item P2-1). É a pergunta 1 ao dono.

## Restrições globais

- Trabalho em `staging`, sem branch nem worktree. Nunca `git stash`, `git reset`, `--no-verify`, `pkill`. Commit por caminho explícito (`git add <caminhos>` e `git commit -m ... -- <caminhos>`). **Nunca** commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. **Sem push**: push e promoção são do controlador.
- **Nenhuma migration, nenhuma tabela nova, nenhuma função de banco, nenhuma escrita em produção, nenhuma escrita na forja.** A A4 só lê. O único banco em que um teste escreve é o local (a semente do Playwright, atrás de `assertLocal`).
- **Não tocar:** `next.config.*` e CSP; `docs/cowork-*`; `apps/web/data/pipeline-docs/`; `apps/web/src/lib/pipeline/api-registry.ts` (o pre-commit semeia em produção quando esses arquivos mudam). Nenhuma rota nova em `app/api/pipeline/`.
- **Nulo nunca vira zero.** Dado ausente é `null` no tipo e uma frase na tela, com o motivo. Zero medido é "0" e tem forma e cor próprias. Este sistema falha em verde: cada leitor e cada modelo tem um teste que responde "o que aparece quando o dado não existe?" (tabela vazia, canal sem linha, vídeo sem linha, dia sem relatório, leitura negada, leitura que falhou). Nenhuma ordenação usa sentinela numérica.
- **"Não medido" tem cor e frase estáveis:** `.obs-ch-nm` e os tokens `--nm`, `--nm-line`, `--nm-bg` de `C/_chrome/tokens-telas.css`, com a hachura e a palavra. Os três estados do gráfico: `--lado-o` (#FF8240, dia com impressões), `--im-zero` (#7A8FA6, zero medido), `--nm` (não medido), `--im-cl` (#38BDF8, cliques). Terços: `--tier-high`, `--tier-mid`, `--terco-baixo`.
- **Telas de dados:** bloco monocromático ou em prosa é reprovado. Todo bloco novo tem frase-resumo, régua ou barra, cor estável, símbolo (cor nunca é o único sinal) e o método no ⓘ.
- Nenhum `color-mix()`. Nenhum `z-index` numérico em regra nova: só `var(--z-*)` de `C/_chrome/camadas.css`. Texto mínimo de 12 px. Alvos de toque de 44 px (em `pointer: coarse`).
- Toda dica, popover e menu usa `Popover` ou `HoverTip` de `C/_chrome/flut/flut.tsx`.
- `strict: true`, nunca `any`. Arquivos em kebab-case. Escolha de frase por estado é exaustiva: `switch` com `default` que atribui a `never`.
- **Palavras internas não aparecem em tela:** "L2", "L3", "lote", "pack", "pacote" (fora do cartão da forja), "dataset", "motor", "diário" como nome de tabela, `day_pt`, "Reporting", "Analytics API", "escala √". Onde o spec escreve "(lote L3)" numa frase de tela, vale a frase de D12. Cada modelo tem um teste que varre todos os textos.
- **Dado privado só para quem edita o site** (D4): os leitores recebem `podeEditar` e devolvem `{ acesso: 'negado' }` sem consultar nada quando é falso. `siteId` vem de `getSiteContext()`, nunca da URL.
- Nunca passar `next/link` (nem componente importado num Server Component) como prop para componente cliente; server actions chegam por props. Do servidor para o cliente passam só dados simples.
- **Next 16 não remonta componente cliente quando só a query muda:** estado que nasce da URL (`sort`, `painel`, vídeo aberto no pager) é ressincronizado por valor, no modelo de `C/_canal/use-canal-state.ts`. A árvore anterior da rota fica escondida no DOM depois do Voltar: buscar elemento por `ref` da raiz; nos specs de Playwright, localizadores com `:visible`.
- A casca do CMS rola em `main`, não na janela (`C/_canal/use-rolagem-ao-voltar.ts`).
- `localStorage` sempre em try/catch; sem ele a tela funciona com o padrão.
- Teste que muda de expectativa vai no **mesmo commit** da mudança de código, listado no relatório com o porquê.
- Fixture de teste: o conjunto base é lido **uma vez por arquivo** (padrão de `T/canal-fixture.ts` e `T/a3-fixture.ts`); o CI tem limite de 60 s por executor. Toda data de fixture é relativa a `Date.now()` ou usa relógio falso.
- **Teste primeiro, com o vermelho observado** e registrado no relatório (inclusive os testes de tela).
- Playwright: `cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:3333 npx playwright test --project=observatorio --reporter=list <spec> > $SCRATCH/pw.txt 2>&1` (sem a variável o login falha em silêncio). `npm run db:start`, nunca `db:reset`. Gesto de mouse e teclado de verdade. **Todo spec da A4 intercepta TODO `POST` com cabeçalho `next-action` e falha se algum escapar.** O fixture carrega o oráculo uma vez por arquivo.
- Subagente nunca espera mais de 4 min parado: suíte, `tsc`, build e Playwright vão em fundo, com saída em arquivo; no contexto entram só as falhas. `$SCRATCH` = o diretório de rascunho que o controlador informa.
- Suíte da pasta: `cd apps/web && npx vitest run test/youtube/observatorio > $SCRATCH/vitest.txt 2>&1`. Typecheck: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`.
- Navegador (DevTools/Chrome MCP) só em subagente Sonnet. Os e2e antigos de fidelidade estão aposentados: não rodar, não consertar.
- Horários em São Paulo; **só os dados privados do canal próprio são "dia do YouTube"**, dito uma vez por seção com o ⓘ ("O YouTube fecha o dia no horário do Pacífico, não em São Paulo"). Datas em `<time datetime>`.

## Decisões deste plano (o spec deixou para o plano; o dono pode reverter)

| # | Decisão | Por quê | Custo se errado |
|---|---|---|---|
| D1 | **O portão trava a promoção, não o código.** A Parte 1 vai até `staging` com dado semeado; `main` espera o item P2-1 | o código não depende do valor conferido; a conferência depende do dono | se o Studio discordar do banco, a tela não muda: muda a coleta, e a promoção atrasa |
| D2 | **O motor não muda.** Views por dia do canal próprio é um número à parte (`L/proprio/vpd.ts`), entregue aos modelos por parâmetro; `ObsVideo.series` do vídeo próprio continua `[]` | uma série sintética mudaria o múltiplo do vídeo próprio e a fase em todas as telas, e o diário é por dia do Pacífico com 2 a 3 dias de atraso | duas definições de "views por dia" (D3); juntar no motor é tarefa própria com paridade |
| D3 | **"Views por dia" do canal próprio** = por vídeo, soma das views dos dias **com linha** nos últimos 28 dias do YouTube que terminam no último dia gravado do canal, dividida pelo número desses dias; exige 7 dias com linha. O número do canal é a **mediana entre os longos acompanhados** (`tracked && fmt === 'long'`, como o concorrente). A base escrita diz a janela | o concorrente mede "desde 03/10" pela diferença de contagens; o diário próprio dá o dia fechado. Janela fixa evita que o histórico de 11 anos entre na média | a linha da comparação põe lado a lado duas janelas diferentes (está escrito na base de cada lado); pergunta 2 |
| D4 | **Dado privado atrás de `mode: 'edit'`** (`requireSiteScope`), o mesmo critério da RLS das duas tabelas (`can_edit_site`). O spec 19.4 fala em `canAdminSite`; a RLS é a regra mais nova e mais larga | quem só vê o site não lê impressões pela RLS; o cliente de serviço não pode abrir mais do que ela | se o dono quiser só admin: uma linha; pergunta 4 |
| D5 | **Falha de leitura:** na página do canal e do vídeo próprio o erro é lançado (a `error.tsx` da rota aparece); na lista de Canais e na comparação a tela inteira não cai por causa do dado privado: o lado próprio diz "a leitura falhou agora" e o erro vai ao Sentry **uma vez por requisição** | lição da A3 (I-N1: ~975 eventos por abertura) e "falha em verde": o erro nunca vira número nem vazio calado | uma frase a mais |
| D6 | **Período do alcance** = até 30 dias do YouTube terminando no dia do relatório mais novo do canal (qualquer status), sem passar do relatório mais antigo. Sempre escrito com as duas datas | 16.3 pede o período escrito, não "28 dias" | pergunta 7 |
| D7 | **Cliques estimados:** soma de impressões × CTR sem arredondar; arredonda-se só o número que aparece (dia, vídeo ou total). Dia ou vídeo com impressão e CTR nulo fica "não medido" em cliques. O ⓘ diz que o total pode diferir da soma das partes escritas | 19.3 deixou o arredondamento para o plano; arredondar por linha zeraria quase tudo (140 impressões, 3 cliques) | trocar a regra é uma função |
| D8 | **Dia "não medido"** = dia do período sem relatório, ou com relatório `listado`, `erro`, `expirado_sem_baixar`, ou baixado sem `normalized_at`. Dia medido sem linha de alcance é zero medido. Linha de alcance sem relatório medido (não deveria existir) conta como "com impressões" e gera aviso | 16.6 e emenda 46 | nenhum |
| D9 | **Rotas:** `canal/<id>` e `video/<id>` ramificam pelo dono do canal (as INFERÊNCIAS recomendadas de 16 e 17). `ownChannelHref(id)` passa a devolver `link.canal(id)`; `?channel=<próprio>` na lista redireciona para a página | os links existentes continuam valendo | nenhum |
| D10 | **Canal próprio sem vídeos não tem página** (16.8): `canal/<id>` dele mostra, na moldura, "Este canal ainda não tem vídeos. A página aparece com o primeiro vídeo sincronizado.", status 200, com o atalho "Meu canal". O menu continua dizendo "ainda sem página" | 16.8; o dono vai abrir canais novos, que nascem assim | pergunta 3: página mínima com cabeçalho |
| D11 | **O paginador do vídeo próprio reusa o da A2** (`ids=`, `pos=`, `tot=`, `canal=`, `back=` de `link.historico`): a grade do canal próprio monta os links na ordem em que está. Sem `ids`, do mais novo ao mais antigo | 17.1 pede a ordem da lista de origem; a A2 já resolveu isso e o Voltar | janela de 100 ids (menor adiado da A2) |
| D12 | **Frases novas, que o spec não traz letra por letra** (o controlador confere antes do push): as de D3 (motivos de views por dia), D5, D10 e: (a) views por dia medidas: base "média dos últimos 28 dias do YouTube com medida (de dd/mm a dd/mm), mediana de N longos"; (b) onde o spec diz "ainda não coletada (lote L3)", a tela diz "ainda não coletada" e o ⓘ diz "chega com a coleta de retenção"; (c) "O que ainda não é medido" passa a dizer "Views por dia de cada vídeo: já são coletadas; o desenho delas nesta tela ainda não existe." | a coleta diária entrou em produção em 09/10 e a frase do mockup ("começa em breve") ficou falsa (ruling da A3) | trocar texto é uma linha por frase |
| D13 | **Frase de volume de "Como o canal está":** abaixo de 1.000 impressões no período, a frase do spec ("ainda é pouco para dizer qual vídeo ou qual capa funciona melhor…"), com os números calculados; a partir de 1.000, "Com N impressões em D dias dá para ver em que dias e em quais vídeos o canal apareceu. Nenhum vídeo sozinho diz que uma capa funciona melhor." | 16.5 manda o plano definir a segunda frase a partir da tabela da rodada 6 | pergunta 8 |
| D14 | **A lista de Canais e a comparação leem o diário de todos os canais próprios do site, só dos longos acompanhados (até 50 por canal), 28 dias** | 50 × 28 = 1.400 linhas por canal; sem isso um canal de 1.000 vídeos custaria 28 mil linhas por abertura | canal com mais de 50 longos tem a mediana dos 50 mais novos (igual ao concorrente) |
| D15 | **Réguas do vídeo:** mínimo de 3 vídeos com o dado (`MIN_REGUA` de `C/_chrome/regua/regua-model.ts`); a escala reusa `escalar` do mesmo arquivo; a explicação da escala vai num ⓘ só, ao fim da legenda | 17.3, 17.5 e seção 20, item 2 | nenhum |
| D16 | **O painel lateral de Canais sai de vez** na Tarefa 16, que pode ser pulada sem afetar aceite (a página já redireciona antes) | D20 da A3; canal próprio agora tem página | código morto por mais uma fase |
| D17 | **Fica como está:** o formato do vídeo próprio continua deduzido (duração e "#Shorts"); trocas do canal próprio ficam no A/B Lab; inscritos em 30 dias continua "sem contagem de 30 dias atrás" | cada um muda número em outras telas ou pede dado que não existe; itens P2-5 e P2-6 | perguntas 9 e 10 |

## Foco de revisão

Entradas que o spec implica e que mais mordem quem usa; cada linha tem o teste na tarefa dona do código.

1. **Tabela vazia, canal sem linha, vídeo sem linha** (o banco local hoje; um canal novo; um vídeo publicado ontem): a página abre, cada número diz o motivo, o gráfico diz "Ainda não há relatório de alcance deste canal." e nenhuma célula mostra 0. → Tarefas 1, 2, 3, 6, 9 e 15.
2. **0, 1, 2 e N canais próprios; canal novo sem vídeo; canal parado:** sem canal próprio nada da A4 aparece; canal sem vídeo não tem página (D10); canal parado mostra "parado" e série em zero medido, não "não medido". → Tarefas 5, 8, 14 e 15.
3. **Zero medido contra não medido** (dia com relatório vazio; dia sem relatório; vídeo que não veio no relatório do dia; linha do diário com `views = 0`; dia sem linha): forma e cor diferentes, frase diferente, e a soma nunca trata o não medido como zero. → Tarefas 1, 3 e 9.
4. **Quem não edita o site e a leitura que falha:** nenhuma consulta às tabelas privadas é feita para quem não edita; a tela diz o motivo; uma falha de leitura na lista não derruba a lista nem vira número. → Tarefas 2, 4 e 5.
5. **Série curta, velha ou parcial** (2 dias de coleta; diário parado há mais de 7 dias; CTR nulo num dia com impressão; relatório `listado` no meio do período): "menos de 7 dias medidos", "a coleta diária deste canal parou em dd/mm", cliques "não medido" naquele dia, coluna hachurada naquele dia. → Tarefas 1, 3 e 9.

---

# PARTE 1 — o que pode ser feito já (sem decisão do dono, sem migration)

### Tarefa 1: dias do alcance, cliques estimados e resumo (modelo puro)

**Arquivos:**
- Criar: `L/proprio/tipos.ts`, `L/proprio/dias.ts`
- Teste: `T/proprio-dias.test.ts`

**Interfaces:**
- Consome: `addDays`, `diffDias` de `apps/web/src/lib/youtube/coleta/day-pt.ts`.
- Produz:
  ```ts
  // L/proprio/tipos.ts — puro
  /** 'AAAA-MM-DD': o dia como veio da fonte (dia do YouTube, Pacífico). Nunca se junta a uma data de São Paulo. */
  export type DiaYt = string
  export interface AlcanceLinha { ytId: string; dia: DiaYt; imp: number | null; ctr: number | null }
  export type StatusRelatorio = 'listado' | 'baixado' | 'vazio' | 'erro' | 'expirado_sem_baixar' | 'desconhecido'
  export interface RelatorioDia { dia: DiaYt; status: StatusRelatorio; normalizado: boolean }
  export interface DiarioLinha { ytId: string; dia: DiaYt; views: number | null }
  export interface AlcanceCanal { canalId: string; relatorios: RelatorioDia[]; linhas: AlcanceLinha[] }
  export interface DiarioCanal { canalId: string; ultimoDia: DiaYt | null; linhas: DiarioLinha[] }
  /** 'negado' = quem pede não edita o site (nada foi consultado); 'erro' = a leitura falhou (só onde D5 permite). */
  export type Privado<T> = { acesso: 'ok'; dado: T } | { acesso: 'negado' } | { acesso: 'erro' }

  // L/proprio/dias.ts — puro
  export const JANELA_ALCANCE_DIAS = 30
  export type Situacao = 'com-impressoes' | 'zero-medido' | 'nao-medido'
  export type MotivoDia = 'sem-relatorio' | 'nao-baixado' | 'erro' | 'expirado'
  export interface DiaAlcance { dia: DiaYt; situacao: Situacao; motivo: MotivoDia | null; imp: number | null; cliques: number | null }
  export interface Periodo { de: DiaYt; ate: DiaYt; dias: number }
  export interface ResumoAlcance { imp: number | null; cliques: number | null; diasComImpressao: number; diasLidos: number; diasNaoMedidos: number }
  export interface AlcanceVideo { imp: number; cliques: number | null; diasComImpressao: number }
  export function periodoDoAlcance(relatorios: readonly RelatorioDia[]): Periodo | null
  /** Sem `ytId`: o canal. Com `ytId`: só aquele vídeo (dia medido em que ele não veio é zero medido). */
  export function montarDias(a: AlcanceCanal, ytId?: string): { periodo: Periodo | null; dias: DiaAlcance[]; avisos: string[] }
  export function resumir(dias: readonly DiaAlcance[]): ResumoAlcance
  /** Só vídeos com alguma impressão no período. */
  export function alcancePorVideo(a: AlcanceCanal): Map<string, AlcanceVideo>
  export function motivoDiaTexto(m: MotivoDia): string
  ```

- [ ] **Passo 1: escrever os testes que falham** (`T/proprio-dias.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { periodoDoAlcance, montarDias, resumir, alcancePorVideo, motivoDiaTexto, JANELA_ALCANCE_DIAS } from '@/lib/youtube/observatorio/proprio/dias'
import type { AlcanceCanal, RelatorioDia, AlcanceLinha } from '@/lib/youtube/observatorio/proprio/tipos'

const rel = (dia: string, status: RelatorioDia['status'] = 'baixado', normalizado = true): RelatorioDia => ({ dia, status, normalizado })
const lin = (ytId: string, dia: string, imp: number | null, ctr: number | null): AlcanceLinha => ({ ytId, dia, imp, ctr })
const canal = (relatorios: RelatorioDia[], linhas: AlcanceLinha[]): AlcanceCanal => ({ canalId: 'c1', relatorios, linhas })

describe('período do alcance', () => {
  it('sem relatório nenhum: null (nunca um período inventado)', () => {
    expect(periodoDoAlcance([])).toBeNull()
  })
  it('termina no relatório mais novo, de qualquer status, e começa no mais antigo quando há menos de 30 dias', () => {
    expect(periodoDoAlcance([rel('2026-10-01'), rel('2026-10-05', 'listado', false)])).toEqual({ de: '2026-10-01', ate: '2026-10-05', dias: 5 })
  })
  it('corta em 30 dias', () => {
    const p = periodoDoAlcance([rel('2026-08-01'), rel('2026-10-08')])
    expect(p).toEqual({ de: '2026-09-09', ate: '2026-10-08', dias: JANELA_ALCANCE_DIAS })
  })
})

describe('os três estados do dia', () => {
  const a = canal(
    [rel('2026-10-01'), rel('2026-10-02', 'vazio'), rel('2026-10-03', 'listado', false), rel('2026-10-05', 'erro', false), rel('2026-10-06', 'baixado', false), rel('2026-10-07', 'expirado_sem_baixar', false)],
    [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-01', 5, 0.2)],
  )
  const { dias, periodo } = montarDias(a)
  const de = (d: string) => dias.find(x => x.dia === d)!
  it('todo dia do período aparece, inclusive o que não tem relatório', () => {
    expect(periodo).toEqual({ de: '2026-10-01', ate: '2026-10-07', dias: 7 })
    expect(dias.map(d => d.dia)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])
  })
  it('dia com linha: impressões somadas e cliques sem arredondar', () => {
    expect(de('2026-10-01')).toEqual({ dia: '2026-10-01', situacao: 'com-impressoes', motivo: null, imp: 15, cliques: 2 })
  })
  it('relatório vazio e normalizado: ZERO MEDIDO, com 0 e não null', () => {
    expect(de('2026-10-02')).toEqual({ dia: '2026-10-02', situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
  })
  it('não medido tem null nas duas contagens e o motivo de cada caso', () => {
    expect(de('2026-10-03')).toMatchObject({ situacao: 'nao-medido', motivo: 'nao-baixado', imp: null, cliques: null })
    expect(de('2026-10-04')).toMatchObject({ situacao: 'nao-medido', motivo: 'sem-relatorio', imp: null, cliques: null })
    expect(de('2026-10-05')).toMatchObject({ situacao: 'nao-medido', motivo: 'erro', imp: null })
    expect(de('2026-10-06')).toMatchObject({ situacao: 'nao-medido', motivo: 'nao-baixado', imp: null })
    expect(de('2026-10-07')).toMatchObject({ situacao: 'nao-medido', motivo: 'expirado', imp: null })
  })
  it('status que o código não conhece é não medido, nunca zero', () => {
    const x = montarDias(canal([rel('2026-10-01', 'desconhecido', true)], []))
    expect(x.dias[0]).toMatchObject({ situacao: 'nao-medido', imp: null })
  })
})

describe('o vídeo dentro do canal', () => {
  const a = canal([rel('2026-10-01'), rel('2026-10-02'), rel('2026-10-03', 'listado', false)], [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-02', 4, 0.5)])
  it('dia medido em que o vídeo não veio é zero medido; dia não medido continua não medido', () => {
    const { dias } = montarDias(a, 'v1')
    expect(dias.map(d => [d.situacao, d.imp])).toEqual([['com-impressoes', 10], ['zero-medido', 0], ['nao-medido', null]])
  })
  it('vídeo que nunca apareceu: todos os dias medidos em zero, nenhum inventado', () => {
    expect(montarDias(a, 'v9').dias.map(d => d.imp)).toEqual([0, 0, null])
  })
})

describe('CTR ausente e linha órfã', () => {
  it('dia com impressão e CTR nulo: impressões valem, cliques é null (não medido), nunca 0', () => {
    const { dias } = montarDias(canal([rel('2026-10-01')], [lin('v1', '2026-10-01', 10, null), lin('v2', '2026-10-01', 5, 0.2)]))
    expect(dias[0]).toMatchObject({ imp: 15, cliques: null })
  })
  it('linha com impressões nulas não soma e não vira zero', () => {
    const { dias } = montarDias(canal([rel('2026-10-01')], [lin('v1', '2026-10-01', null, null)]))
    expect(dias[0]).toMatchObject({ situacao: 'zero-medido', imp: 0 })
  })
  it('linha de alcance em dia sem relatório medido: vale a linha e sai um aviso', () => {
    const x = montarDias(canal([rel('2026-10-01', 'listado', false)], [lin('v1', '2026-10-01', 3, 0)]))
    expect(x.dias[0]).toMatchObject({ situacao: 'com-impressoes', imp: 3, cliques: 0 })
    expect(x.avisos).toHaveLength(1)
  })
  it('dois relatórios no mesmo dia: basta um medido', () => {
    const x = montarDias(canal([rel('2026-10-01', 'listado', false), rel('2026-10-01', 'vazio')], []))
    expect(x.dias[0]).toMatchObject({ situacao: 'zero-medido', imp: 0 })
  })
})

describe('resumo e por vídeo', () => {
  const a = canal([rel('2026-10-01'), rel('2026-10-02', 'vazio'), rel('2026-10-03', 'listado', false)], [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-01', 5, 0.2)])
  it('conta dias lidos, com impressão e não medidos; o não medido não entra na soma', () => {
    expect(resumir(montarDias(a).dias)).toEqual({ imp: 15, cliques: 2, diasComImpressao: 1, diasLidos: 2, diasNaoMedidos: 1 })
  })
  it('nenhum dia lido: impressões e cliques são null, não 0', () => {
    expect(resumir(montarDias(canal([rel('2026-10-01', 'listado', false)], [])).dias)).toEqual({ imp: null, cliques: null, diasComImpressao: 0, diasLidos: 0, diasNaoMedidos: 1 })
    expect(resumir([])).toEqual({ imp: null, cliques: null, diasComImpressao: 0, diasLidos: 0, diasNaoMedidos: 0 })
  })
  it('por vídeo: só quem teve impressão; fora do período não conta', () => {
    const m = alcancePorVideo(canal([rel('2026-10-01'), rel('2026-10-02')], [lin('v1', '2026-10-01', 10, 0.1), lin('v1', '2026-10-02', 2, 0.5), lin('v1', '2026-08-01', 99, 1), lin('v3', '2026-10-02', 0, 0)]))
    expect([...m.keys()]).toEqual(['v1'])
    expect(m.get('v1')).toEqual({ imp: 12, cliques: 2, diasComImpressao: 2 })
  })
  it('motivoDiaTexto: as frases do spec 16.6, sem palavra interna', () => {
    expect(motivoDiaTexto('nao-baixado')).toBe('relatório ainda não baixado (não medido)')
    for (const m of ['sem-relatorio', 'nao-baixado', 'erro', 'expirado'] as const) expect(motivoDiaTexto(m)).toMatch(/não medido/)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/proprio-dias > $SCRATCH/t1.txt 2>&1`. Esperado: FALHA por módulo inexistente (`Cannot find module …/proprio/dias`).
- [ ] **Passo 3: implementar.** Regras, na ordem: (1) `periodoDoAlcance`: `ate` = maior `dia`; `de` = o maior entre `addDays(ate, -(JANELA_ALCANCE_DIAS - 1))` e o menor `dia`; `dias = diffDias(de, ate) + 1`. (2) "Relatório medido" = `(status === 'baixado' || status === 'vazio') && normalizado`. (3) Por dia do período: se há linha com `imp > 0` (do canal, ou do `ytId`) → `com-impressoes`; senão, se há relatório medido → `zero-medido` com `imp: 0, cliques: 0`; senão → `nao-medido` com o motivo: nenhum relatório `sem-relatorio`; `erro` → `erro`; `expirado_sem_baixar` → `expirado`; o resto (`listado`, `baixado` sem normalizar, `desconhecido`) → `nao-baixado`. (4) Cliques do dia: soma de `imp * ctr` das linhas com `imp > 0`; se alguma dessas tem `ctr == null`, o dia fica `cliques: null`. (5) `resumir`: soma `imp` dos dias lidos; `cliques` é `null` se algum dia com impressão tem `cliques: null` ou se `diasLidos === 0`. (6) `alcancePorVideo` usa só linhas dentro do período e com `imp > 0`. `motivoDiaTexto`: `switch` exaustivo; textos: "sem relatório deste dia (não medido)", "relatório ainda não baixado (não medido)", "o relatório deste dia deu erro (não medido)", "o relatório deste dia expirou sem ser baixado (não medido)".
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `git add` dos três arquivos e `git commit -m "feat: Observatório: dias do alcance do canal próprio, com zero medido e não medido separados" -- <caminhos>`.

---

### Tarefa 2: leitores de servidor das duas tabelas do L2

**Arquivos:**
- Criar: `L/proprio/ler.ts`
- Teste: `T/proprio-ler.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consome: `readAll` de `L/load.ts` (paginação de 1.000 em 1.000, erro lançado); os tipos da Tarefa 1; `fakeSupabase(tables)` de `apps/web/test/helpers/fake-supabase.ts` (devolve `{ client, trips }`, como em `T/load-channel.test.ts`).
- Produz:
  ```ts
  // L/proprio/ler.ts — import 'server-only'
  export const TIPO_ALCANCE = 'channel_reach_basic_a1'
  export const JANELA_DIARIO_DIAS = 28
  export const TETO_VIDEOS_DIARIO = 50
  interface Pedido { siteId: string; canalId: string; hoje: DiaYt; podeEditar: boolean }
  /** Relatórios do tipo de alcance e linhas de alcance dos últimos JANELA_ALCANCE_DIAS + 5 dias. Erro de banco é LANÇADO. */
  export async function lerAlcance(sb: SupabaseClient, p: Pedido): Promise<Privado<AlcanceCanal>>
  /** Diário dos `ytIds` (no máximo TETO_VIDEOS_DIARIO; o resto é ignorado) dos últimos JANELA_DIARIO_DIAS + 10 dias. */
  export async function lerDiario(sb: SupabaseClient, p: Pedido & { ytIds: readonly string[] }): Promise<Privado<DiarioCanal>>
  ```
  `hoje` é `dayPt(new Date(now))`. O dia do relatório é `start_time.slice(0, 10)` (data UTC; verificado em produção em 12/10).

- [ ] **Passo 1: escrever os testes que falham**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { lerAlcance, lerDiario, TIPO_ALCANCE, TETO_VIDEOS_DIARIO } from '@/lib/youtube/observatorio/proprio/ler'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

const S = 'site-a', C = 'canal-1', HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const relatorio = (dia: string, status: string, norm: boolean, over: Row = {}): Row => ({
  report_id: 'r-' + dia + '-' + status, site_id: S, channel_id: C, report_type_id: TIPO_ALCANCE, status,
  start_time: dia + 'T07:00:00+00:00', end_time: addDays(dia, 1) + 'T07:00:00+00:00', normalized_at: norm ? dia + 'T12:00:00+00:00' : null, ...over,
})
const alcance = (yt: string, dia: string, imp: number | null, ctr: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, thumbnail_impressions: imp, thumbnail_ctr: ctr, ...over })
const diario = (yt: string, dia: string, views: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, ...over })
const pedido = { siteId: S, canalId: C, hoje: HOJE, podeEditar: true }

describe('lerAlcance', () => {
  it('quem não edita o site: negado e NENHUMA consulta', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)] })
    expect(await lerAlcance(db.client, { ...pedido, podeEditar: false })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('tabelas vazias: ok com listas vazias (o modelo decide a frase), nunca um zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    expect(await lerAlcance(db.client, pedido)).toEqual({ acesso: 'ok', dado: { canalId: C, relatorios: [], linhas: [] } })
  })
  it('os três estados chegam ao modelo como vieram do banco', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3), 'baixado', true), relatorio(d(4), 'vazio', true), relatorio(d(5), 'listado', false)],
      yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.2)],
    })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual(expect.arrayContaining([
      { dia: d(3), status: 'baixado', normalizado: true }, { dia: d(4), status: 'vazio', normalizado: true }, { dia: d(5), status: 'listado', normalizado: false },
    ]))
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 5, ctr: 0.2 }])
  })
  it('nulo do banco continua nulo; número que veio como texto vira número; texto que não é número vira nulo', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), null, null), alcance('v2', d(3), '7' as unknown as number, '0.5' as unknown as number), alcance('v3', d(3), 'x' as unknown as number, null)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), imp: null, ctr: null }, { ytId: 'v2', dia: d(3), imp: 7, ctr: 0.5 }, { ytId: 'v3', dia: d(3), imp: null, ctr: null }]))
  })
  it('só o site, só o canal, só o tipo de alcance, só a janela', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3), 'baixado', true), relatorio(d(3), 'baixado', true, { report_id: 'x1', site_id: 'outro' }), relatorio(d(3), 'baixado', true, { report_id: 'x2', channel_id: 'outro' }), relatorio(d(3), 'baixado', true, { report_id: 'x3', report_type_id: 'channel_basic_a3' }), relatorio(d(90), 'baixado', true)],
      yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.2), alcance('v8', d(3), 5, 0.2, { site_id: 'outro' }), alcance('v9', d(3), 5, 0.2, { channel_id: 'outro' }), alcance('v1', d(90), 5, 0.2)],
    })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual([{ dia: d(3), status: 'baixado', normalizado: true }])
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 5, ctr: 0.2 }])
  })
  it('status fora da lista conhecida vira "desconhecido"', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'novo_status', true)], yt_own_video_reach_daily: [] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios[0]!.status).toBe('desconhecido')
  })
  it('erro do banco é lançado, nunca vira lista vazia', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] }, { failOn: 'yt_own_video_reach_daily' })
    await expect(lerAlcance(db.client, pedido)).rejects.toThrow()
  })
})

describe('lerDiario', () => {
  it('negado sem consulta; lista de vídeos vazia não consulta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] })
    expect(await lerDiario(db.client, { ...pedido, podeEditar: false, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { ...pedido, ytIds: [] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: null, linhas: [] } })
    expect(db.trips).toEqual([])
  })
  it('linha com views 0 é ZERO medido (0, não null); views nulas ficam null; dia sem linha não existe na resposta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 0), diario('v1', d(4), null), diario('v1', d(6), 9)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(3))
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), views: 0 }, { ytId: 'v1', dia: d(4), views: null }, { ytId: 'v1', dia: d(6), views: 9 }]))
    expect(r.dado.linhas).toHaveLength(3)
  })
  it('nunca lê o histórico inteiro: fora da janela, de outro vídeo, de outro site ou de outro canal não vem', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 1), diario('v1', d(200), 1), diario('v2', d(3), 1), diario('v1', d(4), 1, { site_id: 'outro' }), diario('v1', d(5), 1, { channel_id: 'outro' })] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 1 }])
  })
  it('acima do teto de vídeos: lê os primeiros TETO_VIDEOS_DIARIO da lista', async () => {
    const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO + 5 }, (_, k) => 'v' + k)
    const db = fakeSupabase({ yt_own_video_daily: ytIds.map(y => diario(y, d(3), 1)) })
    const r = await lerDiario(db.client, { ...pedido, ytIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(new Set(r.dado.linhas.map(l => l.ytId)).size).toBe(TETO_VIDEOS_DIARIO)
  })
  it('erro do banco é lançado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).rejects.toThrow()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/proprio-ler > $SCRATCH/t2.txt 2>&1`. Esperado: FALHA por módulo inexistente.
- [ ] **Passo 3: implementar.** `podeEditar === false` devolve `{ acesso: 'negado' }` **antes** de qualquer `from()`. Consultas (todas com `.eq('site_id', siteId).eq('channel_id', canalId)`, por `readAll`, com `.order` estável): `yt_reporting_reports` (`report_id, status, start_time, normalized_at`, `.eq('report_type_id', TIPO_ALCANCE)`, `.gte('start_time', addDays(hoje, -(JANELA_ALCANCE_DIAS + 5)) + 'T00:00:00Z')`); `yt_own_video_reach_daily` (`youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr`, `.gte('day_pt', …)`); `yt_own_video_daily` (`youtube_video_id, day_pt, views`, `.in('youtube_video_id', ytIds.slice(0, TETO))`, `.gte('day_pt', addDays(hoje, -(JANELA_DIARIO_DIAS + 10)))`). `numeric` e `bigint` chegam do PostgREST como número ou texto: converta com uma função `num(x)` que devolve `null` para `null`, `undefined` e não finito. `ultimoDia` = maior `day_pt` lido. Junte por `youtube_video_id` (o texto de 11 caracteres), **não** por `video_id`, que pode ser nulo (`on delete set null`). Se o `fakeSupabase` não tiver algum operador usado, acrescente-o no helper no mesmo commit e diga no relatório.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: Observatório: leitores do alcance e do diário do canal próprio, só para quem edita o site`.

---

### Tarefa 3: views por dia do canal próprio (modelo puro)

**Arquivos:**
- Criar: `L/proprio/vpd.ts`
- Teste: `T/proprio-vpd.test.ts`

**Interfaces:**
- Consome: tipos da Tarefa 1; `addDays`, `diffDias`.
- Produz:
  ```ts
  export const MIN_DIAS_VPD = 7
  export const DIARIO_PARADO_DIAS = 7
  export type MotivoSemVpd = 'sem-acesso' | 'leitura-falhou' | 'sem-diario' | 'diario-parado' | 'sem-longos' | 'poucos-dias'
  export interface VpdVideo { vpd: number | null; dias: number }
  export interface VpdCanal {
    valor: number | null; motivo: MotivoSemVpd | null
    /** vídeos que entraram na mediana */ n: number
    janela: { de: DiaYt; ate: DiaYt } | null
    /** o último dia gravado, para a frase "parou em dd/mm" */ ultimoDia: DiaYt | null
  }
  export function vpdDoVideo(d: DiarioCanal, ytId: string): VpdVideo
  export function vpdDoCanal(d: Privado<DiarioCanal>, longosAcompanhados: readonly string[], hoje: DiaYt): VpdCanal
  /** `dm` formata 'AAAA-MM-DD' como "dd/mm". */
  export function motivoVpdTexto(m: MotivoSemVpd, c: Pick<VpdCanal, 'ultimoDia'>, dm: (d: DiaYt) => string): string
  export function baseVpdTexto(c: VpdCanal, dm: (d: DiaYt) => string): string | null
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
import { describe, it, expect } from 'vitest'
import { vpdDoVideo, vpdDoCanal, motivoVpdTexto, baseVpdTexto, MIN_DIAS_VPD } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiarioCanal, DiarioLinha, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const HOJE = '2026-10-11', ULT = '2026-10-08'
const d = (n: number) => addDays(ULT, -n)
const serie = (ytId: string, views: Array<number | null>): DiarioLinha[] => views.map((v, k) => ({ ytId, dia: d(k), views: v }))
const ok = (linhas: DiarioLinha[], ultimoDia: string | null = ULT): Privado<DiarioCanal> => ({ acesso: 'ok', dado: { canalId: 'c', ultimoDia, linhas } })
const dm = (x: string) => x.slice(8) + '/' + x.slice(5, 7)

describe('views por dia de um vídeo', () => {
  it('média sobre os dias COM linha: zero medido conta, dia sem linha não', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', [7, 0, 0, 0, 0, 0, 0]) }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 7 })
  })
  it('views nulas não contam como dia medido', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', [7, null, 0, 0, 0, 0, 0, 0]) }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 7 })
  })
  it('menos de 7 dias medidos: null, nunca 0', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: serie('v1', Array(MIN_DIAS_VPD - 1).fill(3)) }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: null, dias: MIN_DIAS_VPD - 1 })
  })
  it('vídeo sem linha: null com 0 dias; canal sem último dia: null', () => {
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: ULT, linhas: [] }, 'v1')).toEqual({ vpd: null, dias: 0 })
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: null, linhas: [] }, 'v1')).toEqual({ vpd: null, dias: 0 })
  })
  it('só os 28 dias que terminam no último dia gravado', () => {
    const dado = { canalId: 'c', ultimoDia: ULT, linhas: [...serie('v1', Array(28).fill(1)), { ytId: 'v1', dia: d(28), views: 1000 }] }
    expect(vpdDoVideo(dado, 'v1')).toEqual({ vpd: 1, dias: 28 })
  })
  it('sete dias de zero medido dão 0 medido (canal parado), não null', () => {
    expect(vpdDoVideo({ canalId: 'c', ultimoDia: ULT, linhas: serie('v1', Array(7).fill(0)) }, 'v1')).toEqual({ vpd: 0, dias: 7 })
  })
})

describe('views por dia do canal', () => {
  it('mediana entre os longos acompanhados que têm o número', () => {
    const c = vpdDoCanal(ok([...serie('a', Array(7).fill(1)), ...serie('b', Array(7).fill(3)), ...serie('x', Array(7).fill(100)), ...serie('poucos', [9])]), ['a', 'b', 'poucos'], HOJE)
    expect(c).toEqual({ valor: 2, motivo: null, n: 2, janela: { de: d(27), ate: ULT }, ultimoDia: ULT })
  })
  it('cada ausência tem o seu motivo, e o valor é null', () => {
    expect(vpdDoCanal({ acesso: 'negado' }, ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'sem-acesso' })
    expect(vpdDoCanal({ acesso: 'erro' }, ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(vpdDoCanal(ok([], null), ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'sem-diario', janela: null })
    expect(vpdDoCanal(ok(serie('a', Array(7).fill(1))), [], HOJE)).toMatchObject({ valor: null, motivo: 'sem-longos' })
    expect(vpdDoCanal(ok(serie('a', [1, 1])), ['a'], HOJE)).toMatchObject({ valor: null, motivo: 'poucos-dias', n: 0 })
  })
  it('diário parado há mais de 7 dias: null com o motivo, mesmo havendo linhas (o número velho não passa por atual)', () => {
    const c = vpdDoCanal(ok(serie('a', Array(7).fill(5))), ['a'], addDays(ULT, 8))
    expect(c).toMatchObject({ valor: null, motivo: 'diario-parado', ultimoDia: ULT })
    expect(vpdDoCanal(ok(serie('a', Array(7).fill(5))), ['a'], addDays(ULT, 7)).valor).toBe(5)
  })
})

describe('textos', () => {
  it('a base diz a janela e quantos vídeos; sem valor não há base', () => {
    const c = vpdDoCanal(ok([...serie('a', Array(7).fill(1)), ...serie('b', Array(7).fill(3))]), ['a', 'b'], HOJE)
    expect(baseVpdTexto(c, dm)).toBe('média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 2 longos')
    expect(baseVpdTexto(vpdDoCanal({ acesso: 'negado' }, ['a'], HOJE), dm)).toBeNull()
  })
  it('um longo só: singular', () => {
    expect(baseVpdTexto(vpdDoCanal(ok(serie('a', Array(7).fill(1))), ['a'], HOJE), dm)).toMatch(/de 1 longo$/)
  })
  it('motivos: frase por estado, com a data quando parou, sem palavra interna', () => {
    expect(motivoVpdTexto('diario-parado', { ultimoDia: ULT }, dm)).toBe('a coleta diária deste canal parou em 08/10')
    expect(motivoVpdTexto('poucos-dias', { ultimoDia: ULT }, dm)).toBe('menos de 7 dias medidos nos últimos 28')
    for (const m of ['sem-acesso', 'leitura-falhou', 'sem-diario', 'diario-parado', 'sem-longos', 'poucos-dias'] as const) {
      expect(motivoVpdTexto(m, { ultimoDia: ULT }, dm)).not.toMatch(/L2|lote|day_pt|Analytics|dataset|undefined|null/)
    }
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/proprio-vpd > $SCRATCH/t3.txt 2>&1`. Esperado: FALHA por módulo inexistente.
- [ ] **Passo 3: implementar.** Janela = `[addDays(ultimoDia, -27), ultimoDia]`. `vpdDoVideo`: linhas do vídeo na janela com `views != null`; `dias` = quantas; `vpd = soma / dias` se `dias >= MIN_DIAS_VPD`, senão `null`. `vpdDoCanal`, nesta ordem: `negado` → `sem-acesso`; `erro` → `leitura-falhou`; `ultimoDia == null` → `sem-diario`; `diffDias(ultimoDia, hoje) > DIARIO_PARADO_DIAS` → `diario-parado`; lista de longos vazia → `sem-longos`; nenhum vídeo com `vpd` → `poucos-dias`; senão a mediana (com dois valores centrais, a média deles). Textos (D12): `sem-acesso` "só quem edita o site vê as views por dia do seu canal"; `leitura-falhou` "a leitura das views por dia falhou agora; recarregue a página"; `sem-diario` "a coleta diária ainda não gravou este canal"; `sem-longos` "nenhum vídeo longo acompanhado"; os outros dois como nos testes. `switch` exaustivo.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: Observatório: views por dia do canal próprio a partir do diário, com motivo para cada ausência`.

---

### Tarefa 4: entrada das páginas — o dado privado depois da guarda

**Arquivos:**
- Criar: `C/_proprio/dados.ts` (`import 'server-only'`)
- Modificar: `C/_chrome/page-data.ts` (`openChannelPage` devolve também `ownYtIds`; nada mais muda)
- Teste: `T/proprio-dados.test.ts` (`node`); ajustar `T/canal-page-data.test.ts` só se a forma de `ChannelPage` mudar

**Interfaces:**
- Consome: `lerAlcance`, `lerDiario` (Tarefa 2); `requireSiteScope` de `@tn-figueiredo/auth-nextjs/server`; `getSupabaseServiceClient`; `dayPt`; `RULES.videoLimitMax`.
- Produz:
  ```ts
  /** A permissão de edição do site (o critério da RLS das tabelas privadas). Nunca lança: sem sessão é false. */
  export async function podeVerPrivado(siteId: string): Promise<boolean>
  export interface DadosDoCanal { alcance: Privado<AlcanceCanal>; diario: Privado<DiarioCanal> }
  /** Página do canal e do vídeo próprio: erro de leitura é LANÇADO (D5). `longosAcompanhados` = ytIds. */
  export async function lerDadosDoCanal(a: { siteId: string; canalId: string; longosAcompanhados: readonly string[]; agora: number; podeEditar: boolean }): Promise<DadosDoCanal>
  /** Lista de Canais e comparação: um canal que falha vira { acesso: 'erro' } e UM aviso ao Sentry para a requisição inteira (D5). */
  export async function lerDiarioDosCanais(a: { siteId: string; canais: ReadonlyArray<{ id: string; longosAcompanhados: readonly string[] }>; agora: number; podeEditar: boolean }, avisar?: (e: unknown, n: number) => void): Promise<Map<string, Privado<DiarioCanal>>>
  /** Os ytIds dos longos acompanhados de um canal próprio, na ordem do motor (mais novo primeiro). */
  export function longosAcompanhadosDe(obs: Pick<Observatory, 'videos'>, canalId: string): string[]
  ```
  (`obs.videos` é a lista de todos os vídeos do conjunto, `L/index.ts:90`; filtre por `v.ch === canalId && v.tracked && v.fmt === 'long'` e ordene por `pub` decrescente.)

- [ ] **Passo 1: testes que falham** (`T/proprio-dados.test.ts`; simule `requireSiteScope` e `getSupabaseServiceClient` com `vi.mock`, como `T/canal-page-data.test.ts` faz)

```ts
it('podeVerPrivado: true só quando requireSiteScope({ mode: "edit" }) devolve ok; exceção vira false', async () => { /* mock ok:true → true; ok:false → false; throw → false */ })
it('lerDadosDoCanal sem permissão: as duas respostas são negado e o cliente de serviço não é criado', async () => {
  const r = await lerDadosDoCanal({ siteId: 's', canalId: 'c', longosAcompanhados: ['v1'], agora: Date.now(), podeEditar: false })
  expect(r).toEqual({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
  expect(getSupabaseServiceClient).not.toHaveBeenCalled()
})
it('lerDadosDoCanal com erro de banco: lança (a página mostra a tela de erro, nunca um canal vazio)', async () => { /* fakeSupabase com failOn */ })
it('lerDiarioDosCanais: um canal que falha vira erro, os outros vêm ok, e avisar é chamado UMA vez com a contagem', async () => {
  const avisar = vi.fn()
  const m = await lerDiarioDosCanais({ siteId: 's', canais: [{ id: 'bom', longosAcompanhados: ['v1'] }, { id: 'ruim', longosAcompanhados: ['v2'] }], agora: Date.now(), podeEditar: true }, avisar)
  expect(m.get('bom')!.acesso).toBe('ok'); expect(m.get('ruim')).toEqual({ acesso: 'erro' })
  expect(avisar).toHaveBeenCalledTimes(1); expect(avisar.mock.calls[0]![1]).toBe(1)
})
it('lerDiarioDosCanais sem canal próprio: mapa vazio e nenhuma consulta', async () => { /* canais: [] */ })
it('lerDiarioDosCanais sem permissão: todo canal negado, nenhuma consulta', async () => { /* podeEditar: false */ })
it('longosAcompanhadosDe: só tracked e fmt long, do canal pedido; canal sem vídeo dá []', () => { /* a3World() */ })
```
Escreva o corpo dos quatro testes marcados com comentário seguindo os dois completos: mesmas simulações, uma afirmação por linha do título.

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/proprio-dados > $SCRATCH/t4.txt 2>&1`
- [ ] **Passo 3: implementar.** `lerDiarioDosCanais` lê os canais (no máximo 4 por vez, com o `mapLimit` de `L/load.ts:480`, envolvendo cada leitura num `try/catch` que devolve `{ acesso: 'erro' }`); o `avisar` padrão é `Sentry.captureMessage` com `siteId` e a contagem, uma vez. `hoje = dayPt(new Date(agora))`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e `T/canal-page-data.test.ts`.
- [ ] **Passo 5: commit** — `feat: Observatório: dado privado do canal próprio lido depois da guarda de edição`.

---

### Tarefa 5: lista de Canais e comparação — views por dia reais do canal próprio

**Arquivos:**
- Modificar: `C/_canais/posicao-model.ts` (motivo `sem-views-dia-proprio`), `C/_canais/view-model.ts`, `C/page.tsx`, `C/_comparar/numeros-model.ts` (`semDiarioProprio`, linhas 40, 65, 81 e 184), `C/_comparar/pack.ts`, `C/comparar/page.tsx`
- Teste: `T/proprio-a4-canais.test.ts`, `T/proprio-a4-comparar.test.ts`; ajustar `T/canais-a3-posicao.test.ts` e os testes da comparação que afirmam a frase antiga (liste cada um)

**Interfaces:**
- Consome: `vpdDoCanal`, `motivoVpdTexto`, `baseVpdTexto` (Tarefa 3); `lerDiarioDosCanais`, `podeVerPrivado`, `longosAcompanhadosDe` (Tarefa 4); `vpdText` de `C/_canal/numeros.ts`.
- Produz:
  ```ts
  // os dois modelos ganham um último parâmetro opcional; ausente = como antes do dado existir (nunca um número)
  export interface ExtrasProprio { vpd: ReadonlyMap<string, VpdCanal>; dm: (d: DiaYt) => string }
  // C/_canais/view-model.ts: buildCanaisView(obs: Observatory, p: CanaisParams, extras?: ExtrasProprio)
  // C/_comparar/pack.ts: buildCompararPack(obs, avisar?, extras?: ExtrasProprio)
  // C/_comparar/numeros-model.ts: numerosDoCanal(obs, channelId, avisar?, extras?: ExtrasProprio);
  //   o tipo Motivo troca { k: 'semDiarioProprio' } por { k: 'semVpdProprio'; texto: string } (o texto vem de motivoVpdTexto)
  // C/_canais/posicao-model.ts: a chave 'sem-views-dia-proprio' fica; motivoTexto(m, textoVpd?: string) usa o texto de motivoVpdTexto
  //   para ela (sem o texto: o de 'sem-diario'), seguido de " Sem posição nesta ordenação." 
  ```

- [ ] **Passo 1: testes que falham**

```ts
// T/proprio-a4-canais.test.ts
it('canal próprio COM views por dia medidas entra na posição de Views/dia, no lugar dele, com o valor escrito por vpdText', () => {
  const { obs, owns } = a3World()
  const vpd = new Map([[owns[0]!, { valor: 2.4, motivo: null, n: 3, janela: { de: '2026-09-11', ate: '2026-10-08' }, ultimoDia: '2026-10-08' }]])
  const view = buildCanaisView(obs, { sort: 'vpd' }, { vpd, dm })
  const linha = [...view.list.ranked, ...view.list.unranked].find(r => r.id === owns[0])!
  expect(view.list.ranked).toContain(linha); expect(linha.pos).not.toBeNull(); expect(linha.valor.vpd).toBe(2.4)
})
it('zero medido (canal parado) entra na posição com "0", atrás de qualquer positivo, e NÃO vai para "sem medida"', () => { /* valor: 0 */ })
it('cada motivo (sem-acesso, leitura-falhou, sem-diario, diario-parado, sem-longos, poucos-dias) deixa o canal sob "Ainda sem medida para ordenar" com a frase do motivo', () => { /* laço pelos seis */ })
it('sem extras (o dado não foi lido): o canal próprio continua sem medida, com a frase de "sem-diario"; nunca um número', () => { /* buildCanaisView sem o último parâmetro */ })
it('a frase "começa em breve" não existe mais em nenhum texto do modelo, em nenhuma ordenação × formato × nicho', () => { /* varredura */ })
it('por mil inscritos: valor ÷ (inscritos ÷ 1000); inscritos ocultos ou zero continuam com o motivo de hoje', () => { /* … */ })
it('dois canais próprios: cada um com o seu número; o que não tem vídeo continua "sem vídeos"', () => { /* preset '2' */ })

// T/proprio-a4-comparar.test.ts
it('lado próprio com views por dia medidas: a linha mostra o número e a base diz a janela de 28 dias; o lado concorrente diz a dele', () => { /* … */ })
it('lado próprio sem o número: pastilha "não medido" com o motivo de motivoVpdTexto, e a linha fica sem relação', () => { /* … */ })
it('nenhum par do fixture mostra "ainda não aparecem nesta tela"', () => { /* varredura dos 364 pares, como na A3 */ })
it('sem canal próprio no site: lerDiarioDosCanais não é chamado', () => { /* teste de página com vi.mock */ })
```
Complete cada corpo no padrão do primeiro (o `a3World` de `T/a3-fixture.ts` dá o mundo; `dm` é `(d) => d.slice(8) + '/' + d.slice(5, 7)`).

- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Nas duas páginas de servidor: depois de `openObservatoryPage()`, se `obs.ownChannels().length > 0`, `const pode = await podeVerPrivado(siteId)` e `lerDiarioDosCanais(...)` com `longosAcompanhadosDe`; monte `vpd` com `vpdDoCanal(diario, longos, dayPt(new Date(now)))` por canal. Nos modelos, onde hoje o canal próprio cai direto no motivo fixo, leia `extras?.vpd.get(ch.id)`: com `valor != null`, é medido (texto por `vpdText`; por mil = `valor / (subs / 1000)`); senão o motivo é `motivoVpdTexto(...)`; **sem `extras`, o motivo é o de `sem-diario`**. A base da linha da comparação é `baseVpdTexto`. Nada mais na lista muda de texto.
- [ ] **Passo 4: ajustar os testes existentes** que afirmam "começa em breve" ou "ainda não aparecem nesta tela"; liste cada um no relatório.
- [ ] **Passo 5: rodar e ver passar**, mais `tsc` e a pasta inteira.
- [ ] **Passo 6: commit** — `feat: Canais e comparação: views por dia do canal próprio saem do diário; cada ausência diz o motivo`.

---

### Tarefa 6: cabeçalho do canal próprio — faixa de 6 e "Todos os números" de 11 (modelo)

**Arquivos:**
- Criar: `C/_proprio/header-model.ts`
- Teste: `T/proprio-header-model.test.ts`; criar `T/proprio-fixture.ts`

**Interfaces:**
- Consome: `NumCell` e os derivados de `C/_canal/header-model.ts` (views somadas, mediana, duração mediana, ritmo, dias desde o último vídeo); `montarDias`, `resumir`, `alcancePorVideo` (Tarefa 1); `vpdDoCanal`, `motivoVpdTexto`, `baseVpdTexto` (Tarefa 3); `posicoes`, `conjuntoTexto` de `L/posicao.ts`.
- Produz:
  ```ts
  // T/proprio-fixture.ts
  /** O mundo de um canal próprio (o primeiro do preset) com dado privado sintético; base lida uma vez por arquivo. */
  export function proprioWorld(o?: { preset?: OwnPreset; mut?: (ds: Dataset) => void; dados?: Partial<DadosDoCanal> }): { obs: Observatory; canalId: string; ytIds: string[]; dados: DadosDoCanal; hoje: DiaYt; dm: (d: DiaYt) => string }
  // C/_proprio/header-model.ts — puro
  export interface ProprioHeaderView {
    id: string; name: string; handle: string; url: string; avatar: string | null; ini: string; lang: LangChip | null
    faixa: NumCell[]      // 6, nesta ordem: inscritos, videos, viewsSomadas, impressoes, diasComImpressao, diasDesdeUltimo
    todos: NumCell[]      // 11, na ordem de 16.3
    sync: string; posicaoLinha: string | null
  }
  export function buildProprioHeader(obs: Observatory, canalId: string, dados: DadosDoCanal, o: { hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null }): ProprioHeaderView | null
  /** As posições do canal entre os do nicho (ou no geral, sem nicho), calculadas no servidor com o conjunto do site. null = não calculadas. */
  export interface PosicaoNoNicho { conjunto: Conjunto; inscritos: Posicao | null; medianaViews: Posicao | null; longos90: Posicao | null; vpdPorMil: Posicao | null }
  ```

- [ ] **Passo 1: testes que falham**

```ts
it('faixa: seis células na ordem do spec 16.3, cada uma com rótulo e base', () => {
  const w = proprioWorld()
  const h = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null })!
  expect(h.faixa.map(c => c.key)).toEqual(['inscritos', 'videos', 'viewsSomadas', 'impressoes', 'diasComImpressao', 'diasDesdeUltimo'])
  for (const c of [...h.faixa, ...h.todos]) { expect(c.label).not.toBe(''); expect(c.base).not.toBe('') }
})
it('"Todos os números": onze células; nenhuma vazia: ou tem valor, ou tem a frase do motivo, nunca os dois nulos', () => {
  const h = buildProprioHeader(/* mundo padrão */)!
  expect(h.todos).toHaveLength(11)
  for (const c of [...h.faixa, ...h.todos]) expect(c.value == null && c.missing == null).toBe(false)
})
it('impressões: a soma do período, com o período escrito com as duas datas (nunca "28 dias")', () => { /* label contém "de dd/mm a dd/mm" */ })
it('dias com impressão: "11 de 19" = dias com impressão sobre dias lidos', () => { /* dados com 19 lidos, 11 com impressão */ })
it('sem relatório nenhum (tabela vazia): impressões, dias com impressão, cliques e vídeos com impressão dizem "ainda sem relatório de alcance deste canal"; value é null, nunca "0"', () => { /* dados vazios */ })
it('todos os dias lidos vieram vazios: impressões é "0" medido, não a frase', () => { /* só relatórios vazio+norm */ })
it('sem permissão de edição: as células privadas dizem "só quem edita o site vê este número"; as públicas não mudam', () => { /* acesso negado */ })
it('cliques estimados: arredondado só no total; com CTR ausente em algum dia vira "não medido" com o motivo', () => { /* 2,6 → "3"; null → frase */ })
it('views/dia por vídeo: número do diário com a base de 28 dias; cada motivo de ausência com a sua frase', () => { /* seis motivos */ })
it('retenção e percentual assistido: "ainda não coletada"; inscritos em 30 dias: "sem contagem de 30 dias atrás"', () => { /* D12 (b), D17 */ })
it('canal parado: ritmo "parado: nenhum em 13 semanas" e dias desde o último vídeo com o número medido', () => { /* mut: todos os vídeos com mais de 91 dias */ })
it('inscritos ocultos (null): "não medido" com o motivo, nunca 0', () => { /* mut: subs = null */ })
it('linha de posição: diz o conjunto ("Entre 14 canais de Viagem: …"), com "(nenhum)" para zero medido; sem posição calculada a linha é null', () => { /* posicao dada e null */ })
it('nenhum texto do cabeçalho traz palavra interna', () => { /* varre faixa, todos, sync, posicaoLinha contra /L2|L3|lote|day_pt|dataset|pack/ */ })
```
O primeiro teste está completo; os demais seguem a mesma montagem (`proprioWorld` com `dados` e `mut`), uma afirmação por oração do título.

- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Reaproveite as funções de `C/_canal/header-model.ts` para o que é público (exporte as que hoje são locais; não copie). Frase única para alcance ausente por estado, num `switch` exaustivo sobre `'negado' | 'erro' | 'sem-relatorio' | 'ok'`. `proprioWorld` monta `dados` com datas relativas a `Date.now()`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal próprio: modelo do cabeçalho com a faixa de seis números e os onze de "Todos os números"`.

---

### Tarefa 7: vídeos do canal próprio — três colunas, terceira linha e ordenação por impressões (modelo)

**Arquivos:**
- Criar: `C/_proprio/videos-model.ts`
- Modificar: `L/links.ts` (`CanalSort` ganha `'imp'`; `CanalTab` ganha `'retencao'`), `C/_canal/params.ts` (aceitar os dois), `C/_canal/lista.ts` (ordenar por `'imp'` com nulos no fim)
- Teste: `T/proprio-videos-model.test.ts`; ajustar `T/canal-params.test.ts`, `T/canal-lista.test.ts`, `T/links.test.ts`

**Interfaces:**
- Consome: `ChannelVideoView`, `buildCanalVideos` (`C/_canal/videos-model.ts`); `alcancePorVideo` (Tarefa 1); `link.historico`.
- Produz:
  ```ts
  export interface ProprioVideoView extends ChannelVideoView {
    /** null = sem impressão no período OU alcance não lido (a frase diz qual) */ imp: number | null
    /** A terceira linha: "2 cliques em 6 dias" | "nenhum clique em 4 dias" | "sem impressão no período" | "cliques: não medido" */ terceira: string
  }
  export interface ProprioVideosView { videos: ProprioVideoView[]; nota: string; semVideos: string | null; semViewsDiarias: string }
  export function buildProprioVideos(obs: Observatory, canalId: string, alcance: Privado<AlcanceCanal>): ProprioVideosView
  ```

- [ ] **Passo 1: testes que falham**

```ts
it('terceira linha: contagem de cliques e de dias, sem percentual e sem corte', () => {
  // vídeo com 18 impressões em 6 dias e 2,4 cliques → "2 cliques em 6 dias"; 8 impressões em 4 dias e 0,2 clique → "nenhum clique em 4 dias"
})
it('um clique, um dia: singular ("1 clique em 1 dia")', () => { /* … */ })
it('vídeo sem linha de alcance: imp null e "sem impressão no período"; nunca 0 impressões', () => { /* … */ })
it('alcance negado ou não lido: imp null em todos e a terceira linha diz o motivo UMA vez na nota, não em cada cartão', () => { /* … */ })
it('nenhuma terceira linha, em nenhum vídeo do fixture, contém "%"', () => { for (const v of view.videos) expect(v.terceira).not.toMatch(/%/) })
it('ordenar por impressões: maior primeiro; quem não tem impressão vai para o fim NAS DUAS direções', () => { /* montarLista com sort imp, asc e desc */ })
it('sort=imp e tab=retencao são aceitos na URL; em canal de concorrente caem no padrão', () => { /* parseCanalState */ })
it('semViewsDiarias: a frase de D12 (c), uma só', () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `parseCanalState` ganha um segundo parâmetro opcional `{ own?: boolean }`: `'imp'`, `'retencao'` só valem com `own: true`; `'fixados'` e `'vpd'` só sem ele (canal próprio não tem fixados; 16.4). Texto da terceira linha por função única `terceiraLinha(a: AlcanceVideo | null)`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e a pasta.
- [ ] **Passo 5: commit** — `feat: canal próprio: modelo dos vídeos com impressões, cliques estimados e ordenação por impressões`.

---

### Tarefa 8: página do canal próprio — rota, tela, abas e links

**Arquivos:**
- Criar: `C/_proprio/proprio-screen.tsx` (`'use client'`), `C/_proprio/proprio.css`, `C/_proprio/view-model.ts`
- Modificar: `C/canal/[id]/page.tsx` (sai o `redirect` da linha 39), `C/_chrome/own-channels.ts` (`ownChannelHref` → `link.canal(id)`), `C/_canais/legacy.ts` e `C/page.tsx` (`?channel=<próprio>` redireciona para a página), `C/_canal/video-card.tsx` e `C/_canal/tabela.tsx` (colunas do canal próprio por prop, sem duplicar o componente)
- Teste: `T/proprio-tela.test.tsx` (jsdom), `T/proprio-rota.test.ts`; ajustar `T/canal-redirect.test.ts`, `T/own-channels.test.ts`, `T/own-menu.test.ts`

**Interfaces:**
- Consome: Tarefas 4, 6 e 7; `openChannelPage`; `TrailChrome`; `CanalNotFound`; `escolherPrincipal` (o atalho já vem em `owns`).
- Produz:
  ```ts
  // C/_proprio/view-model.ts
  export interface ProprioView { header: ProprioHeaderView; videos: ProprioVideosView; state: CanalState; compararHref: string | null; compararTitulo: string | null; abas: { trocas: string; leitura: string; retencao: string } }
  export function buildProprioView(obs: Observatory, canalId: string, sp: Record<string, string | undefined>, dados: DadosDoCanal, o: { hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null; concorrenteAcima: { id: string; name: string } | null }): ProprioView | null
  // C/_proprio/proprio-screen.tsx
  export function ProprioScreen(p: { view: ProprioView; comoEsta?: ReactNode; children?: never }): JSX.Element
  ```
  `comoEsta` é o lugar onde a Tarefa 10 encaixa a seção (acima das abas).

- [ ] **Passo 1: testes que falham**

```ts
it('canal próprio com vídeos: a rota NÃO redireciona; a trilha é "Canais › <nome>" e o selo "seu canal" está no cabeçalho', async () => { /* teste de página, vi.mock de page-data e de C/_proprio/dados */ })
it('canal próprio SEM vídeos: status 200, a frase de D10 na moldura, com o atalho "Meu canal"; nenhuma leitura das tabelas privadas', async () => { /* lerDadosDoCanal não chamado */ })
it('quem não edita o site abre a página: lerDadosDoCanal é chamado com podeEditar false', async () => { /* … */ })
it('ownChannelHref(id) devolve a página do canal', () => { expect(ownChannelHref('abc')).toBe(link.canal('abc')) })
it('?channel=<canal próprio> na lista redireciona para canal/<id>; ?channel=<próprio sem vídeos> abre a lista sem painel', async () => { /* … */ })
it('abas: Vídeos, Trocas, Leitura e Retenção, cada uma com a frase do spec 16.4 quando vazia', () => {
  // "Trocas dos seus vídeos ainda não são lidas nesta tela." / "A leitura da forja para o seu canal ainda não existe." / "Retenção ainda não coletada."
})
it('controles: ordenação "Mais impressões no período" no lugar de "Mais views por dia"; filtro sem "Fixados"', () => { /* … */ })
it('cartão: três colunas (views, impressões, múltiplo) e a terceira linha; a Lista tem Impressões e Cliques no lugar de Views/dia e Trocas', () => { /* … */ })
it('a frase das views por dia aparece UMA vez (na linha das abas), não em cada cartão', () => { expect(screen.getAllByText(/Views por dia de cada vídeo/)).toHaveLength(1) })
it('"Comparar com…" ao lado de "Abrir no YouTube": leva à comparação com o concorrente logo acima em inscritos e o title diz qual; sem concorrente o botão não existe', () => { /* … */ })
it('rerender só com outra query (sort=imp) atualiza a ordenação sem remontar', () => { /* padrão de use-canal-state */ })
it('cada link de vídeo leva canal=, back=, ids=, pos= e tot= na ordem em que a grade está', () => { /* D11 */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Em `C/canal/[id]/page.tsx`: `if (view.own)` passa a montar a página própria. As posições (`PosicaoNoNicho`) e `concorrenteAcima` precisam do conjunto do site: leia-o com `openObservatoryPage()` **só neste ramo** e calcule com `posicoes` de `L/posicao.ts` sobre os mesmos números da comparação (`buildCompararPack` já os tem: reuse `numerosDoCanal`, não recalcule). Canal próprio sem vídeos é resolvido **antes** de ler dado privado. Forma e medidas: `M/canal-proprio.html` e `M/canal.css` (variável `OWN`). CSS novo em `proprio.css`, preso a `[data-obs-screen="canal-proprio"]`.
- [ ] **Passo 4: ajustar os testes existentes** (`canal-redirect`, `own-channels`, `own-menu`: o destino mudou de painel para página); liste cada um.
- [ ] **Passo 5: rodar e ver passar**, mais `tsc` e a pasta.
- [ ] **Passo 6: commit** — `feat: canal próprio ganha página: cabeçalho, grade, lista e abas; "Abrir meu canal" leva a ela`.

---

### Tarefa 9: gráfico "Impressões por dia" (um componente para o canal e para o vídeo)

**Arquivos:**
- Criar: `C/_proprio/impressoes-model.ts`, `C/_proprio/impressoes.tsx` (`'use client'`), `C/_proprio/impressoes.css`
- Teste: `T/proprio-impressoes-model.test.ts`, `T/proprio-impressoes.test.tsx` (jsdom)

**Interfaces:**
- Consome: `DiaAlcance`, `Periodo`, `motivoDiaTexto` (Tarefa 1); `HoverTip` de `C/_chrome/flut/flut.tsx`.
- Produz:
  ```ts
  export interface ColunaView { dia: DiaYt; rotulo: string; situacao: Situacao; alturaPx: number; imp: string | null; cliques: string | null; dica: string; situacaoTexto: string }
  export interface ImpressoesView { teto: number; ticks: number[]; colunas: ColunaView[]; periodoTexto: string; vazio: string | null; legenda: Array<{ situacao: Situacao | 'cliques'; texto: string }> }
  /** `escopo` muda a frase do zero medido: no vídeo, "o relatório do dia não trouxe este vídeo". */
  export function buildImpressoes(dias: readonly DiaAlcance[], periodo: Periodo | null, o: { escopo: 'canal' | 'video'; alturaArea: number; dm: (d: DiaYt) => string; acesso: 'ok' | 'negado' }): ImpressoesView
  export function tetoDoEixo(max: number): number
  export function Impressoes(p: { view: ImpressoesView; titulo: string }): JSX.Element
  ```

- [ ] **Passo 1: testes que falham**

```ts
// modelo
it('teto do eixo: 4, 10 ou múltiplo de 20', () => {
  expect([0, 1, 4, 5, 10, 11, 20, 71, 100, 101].map(tetoDoEixo)).toEqual([4, 4, 4, 10, 10, 20, 20, 80, 100, 120])
})
it('escala linear: a barra de 1 impressão tem no mínimo 3 px e a de 71 não a apaga (área de 180 px)', () => {
  const v = buildImpressoes([dia('2026-10-01', 71), dia('2026-10-02', 1)], periodo, { escopo: 'canal', alturaArea: 180, dm, acesso: 'ok' })
  expect(v.colunas[0]!.alturaPx).toBeCloseTo(180 * 71 / 80, 0); expect(v.colunas[1]!.alturaPx).toBe(3)
})
it('zero medido: traço de 3 px, texto "0"; não medido: altura da área inteira, imp e cliques null', () => { /* … */ })
it('dicas, letra por letra (spec 16.6)', () => {
  // "24/09: 1 impressão, 1 clique estimado" · "30/09: 9 impressões, nenhum clique" · "26/09: relatório veio vazio (nenhuma impressão)" · "12/09: relatório ainda não baixado (não medido)"
})
it('no vídeo, o zero medido diz "o relatório do dia não trouxe este vídeo"', () => { /* escopo video */ })
it('situação por extenso na tabela: "com impressões", "relatório veio vazio", "ainda não baixado: não medido"', () => { /* … */ })
it('sem período (nenhum relatório): nenhuma coluna e vazio = "Ainda não há relatório de alcance deste canal."', () => { /* … */ })
it('acesso negado: nenhuma coluna e vazio = "Só quem edita o site vê as impressões."', () => { /* … */ })
it('a legenda tem os três estados e os cliques, cada um com texto', () => { /* 4 itens */ })
// componente (jsdom)
it('uma parada de Tab no gráfico; setas, Home e End percorrem os dias; Esc fecha a dica', async () => { /* userEvent.keyboard */ })
it('"Ver como tabela" mostra TODOS os dias do período, com dia, situação, impressões e cliques estimados', async () => { /* linhas === colunas.length */ })
it('cada estado tem forma própria além da cor: barra, traço, coluna hachurada (classe e data-situacao distintos)', () => { /* … */ })
it('repinta ao mudar a largura (resize com 120 ms de espera) e mantém "Ver como tabela" aberto', async () => { /* fake timers */ })
it('escreve "dia do YouTube" uma vez, com o ⓘ', () => { expect(screen.getAllByText(/dia do YouTube/)).toHaveLength(1) })
```
Os testes de modelo usam `const dia = (d, imp, cliques = 0): DiaAlcance => ({ dia: d, situacao: imp == null ? 'nao-medido' : imp > 0 ? 'com-impressoes' : 'zero-medido', motivo: imp == null ? 'nao-baixado' : null, imp, cliques: imp == null ? null : cliques })`.

- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma e medidas de `M/impressoes.js` e `M/impressoes.css`. Cores só por token (`--lado-o`, `--im-zero`, `--nm` com a hachura de `.obs-ch-nm`, `--im-cl`). O desenho é HTML e CSS (colunas em flex), sem biblioteca. A dica usa `HoverTip`. O ouvinte de `resize` é removido no desmontar.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal próprio: gráfico de impressões por dia com três estados, tabela e teclado`.

---

### Tarefa 10: "Como o canal está"

**Arquivos:**
- Criar: `C/_proprio/como-esta-model.ts`, `C/_proprio/como-esta.tsx` (`'use client'`)
- Modificar: `C/canal/[id]/page.tsx` (passa a seção em `comoEsta`), `C/_proprio/proprio.css`
- Teste: `T/proprio-como-esta.test.ts`, `T/proprio-como-esta-tela.test.tsx` (jsdom)

**Interfaces:**
- Consome: `ResumoAlcance`, `Periodo`, `alcancePorVideo` (Tarefa 1); `ImpressoesView` e `Impressoes` (Tarefa 9); `PosicaoNoNicho` (Tarefa 6); `link.canais`, `link.comparar`, `link.historico`.
- Produz:
  ```ts
  export const POUCO_VOLUME = 1000   // D13
  export interface ComoEstaView {
    recolhida: string                 // a linha de 16.5
    frase: string                     // a frase única, calculada do volume
    top: Array<{ id: string; titulo: string; href: string; imp: string; cliques: string; dias: string }>   // até 5
    topVazio: string | null
    noNicho: { linhas: Array<{ texto: string; href: string }>; opcoes: Array<{ id: string; name: string }>; acao: string } | null
    naoMedido: string
  }
  export function buildComoEsta(a: { resumo: ResumoAlcance; periodo: Periodo | null; acesso: 'ok' | 'negado'; porVideo: Map<string, AlcanceVideo>; videos: ReadonlyArray<{ id: string; ytId: string; title: string }>; posicao: PosicaoNoNicho | null; concorrentes: ReadonlyArray<{ id: string; name: string }>; canalId: string; dm: (d: DiaYt) => string }): ComoEstaView
  /** `painel` = o que a URL diz ('1' abre, '0' fecha, ausente = lembrado ou recolhida). */
  export function ComoEsta(p: { view: ComoEstaView; grafico: ImpressoesView; painel: '1' | '0' | null; canalId: string }): JSX.Element
  ```

- [ ] **Passo 1: testes que falham**

```ts
it('recolhida: "140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos."', () => { /* números do mockup como entrada */ })
it('abaixo de 1.000 impressões: a frase do spec 16.5 com os números calculados (nunca fixa)', () => {
  expect(v.frase).toBe('Com 140 impressões em 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.')
})
it('a partir de 1.000: a frase de D13, que não promete comparar capas', () => { /* 1000 e 999 nas duas bordas */ })
it('nenhum dia lido: a frase diz que ainda não há relatório e a recolhida não escreve "0 impressões"', () => { /* resumo.imp null */ })
it('todos os dias lidos em zero: "Nenhuma impressão em D dias lidos." (zero medido, dito como zero)', () => { /* … */ })
it('"Vídeos que mais apareceram": os 5 com mais impressões, com cliques e dias; menos de 5 mostra os que há; nenhum mostra a frase', () => { /* … */ })
it('"No nicho": sem posição calculada o bloco não existe; sem concorrente o formulário não existe', () => { /* … */ })
it('"O que ainda não é medido": views por dia de cada vídeo (D12 c), percentual assistido e retenção, origem do tráfego', () => { /* … */ })
// tela
it('recolhida por padrão; ?painel=1 abre; ?painel=0 fecha mesmo com "aberta" lembrada', () => { /* … */ })
it('lembra a escolha em localStorage; com localStorage que lança, a tela funciona e fica no padrão', () => { /* vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x') }) */ })
it('o formulário "Comparar com…" é GET, tem select e botão (duas paradas de Tab) e mudar o select NÃO navega', async () => { /* … */ })
it('rerender com outro painel= (só a query mudou) atualiza o estado sem remontar', () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Chave do `localStorage`: `obs:como-esta:<canalId>`. O formulário aponta para `link.comparar()` com `a` oculto (o canal) e `b` no select. A seção fica **acima das abas**; aberta, pode empurrar a grade (16.5 aceita).
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal próprio: seção "Como o canal está", recolhida por padrão`.

---

### Tarefa 11: vídeo próprio — rota, cabeçalho, paginador e faixa com ⓘ

**Arquivos:**
- Criar: `C/_proprio/video-model.ts`, `C/_proprio/video-screen.tsx` (`'use client'`), `C/_proprio/video.css`
- Modificar: `C/video/[id]/page.tsx` (ramo pelo dono do canal), `C/_historico/view-model.ts` (só se o ramo próprio de hoje ficar sem chamador: apague-o no mesmo commit com os testes dele)
- Teste: `T/proprio-video-model.test.ts`, `T/proprio-video-tela.test.tsx` (jsdom), `T/proprio-video-rota.test.ts`

**Interfaces:**
- Consome: `Pager` de `C/_historico/pager.tsx` (D11); `obs.video(id)`, `obs.channel(id)`; `multiplier.ts` pelo motor (o múltiplo do vídeo e a mediana dos outros); `durText`; `ThumbViewer` para "Ampliar thumbnail".
- Produz:
  ```ts
  export interface CelulaVideo { key: 'views' | 'curtidas' | 'comentarios' | 'engajamento' | 'multiplo' | 'duracao'; value: string | null; missing: string | null; label: string; conta: string }
  export interface ProprioVideoHeader { id: string; titulo: string; url: string; thumb: string | null; meta: string; faixa: CelulaVideo[]; canal: { id: string; name: string; href: string } }
  export function buildProprioVideoHeader(obs: Observatory, videoId: string): ProprioVideoHeader | null
  export function ProprioVideoScreen(p: { header: ProprioVideoHeader; children: ReactNode }): JSX.Element
  ```
  `children` é onde as Tarefas 12 e 13 encaixam "Este vídeo no canal", o gráfico e os cartões.

- [ ] **Passo 1: testes que falham**

```ts
it('seis células na ordem views, curtidas, comentários, engajamento, múltiplo, duração', () => { /* … */ })
it('o ⓘ traz a conta FEITA: "(12 curtidas + 6 comentários) ÷ 118 views = 15,3%" e "118 ÷ 138 = 0,9×; 138 é a mediana de views dos outros 34 vídeos"', () => { /* mut para esses números */ })
it('toda célula tem conta: a montagem LANÇA em teste se alguma vier vazia (o ⓘ nunca abre vazio)', () => { for (const c of h.faixa) expect(c.conta).not.toBe('') })
it('comentário nulo: "não medido" na célula e o motivo na conta; engajamento também fica sem valor, nunca 0%', () => { /* mut: comments = null */ })
it('views zero: engajamento sem valor ("sem views para calcular"), nunca NaN nem Infinity', () => { /* … */ })
it('canal com um vídeo só: múltiplo "poucos vídeos para comparar", sem número', () => { /* … */ })
it('rota: vídeo de canal próprio abre a tela nova; vídeo de concorrente continua no Histórico, sem mudança', async () => { /* teste de página */ })
it('rota: id desconhecido continua "Vídeo não encontrado" na moldura, status 200', async () => { /* … */ })
it('paginador: "Anterior" apagado (aria-disabled, na tela) no primeiro; "Próximo" no último; a frase diz a ordem', () => { /* ids= com 3 */ })
it('sem ids= na URL: a ordem é do mais novo ao mais antigo do canal', () => { /* … */ })
it('[ e ] só funcionam com o foco no título ou no paginador', async () => { /* foco num botão qualquer: nada acontece */ })
it('trilha: "Canais › <canal> › Vídeo"; o item do canal volta com o back= recebido', () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Em `C/video/[id]/page.tsx`: depois de `openObservatoryPage()`, `const v = obs.video(id)` (use o acessor que `buildHistoricoView` usa) e `obs.channel(v.ch)?.own` decide o ramo; o ramo de concorrente fica byte a byte como está. O ramo próprio lê `podeVerPrivado` e `lerDadosDoCanal` (o alcance do **canal inteiro**: as réguas da Tarefa 12 precisam de todos os vídeos). Sem `ids`, monte a lista do canal por `pub` decrescente. Forma: `M/video-proprio.html`, `M/faixa-numeros.js`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`, a pasta e os testes do Histórico (nenhum muda de expectativa para concorrente).
- [ ] **Passo 5: commit** — `feat: vídeo próprio ganha tela: cabeçalho, paginador e faixa de números com a conta feita`.

---

### Tarefa 12: "Este vídeo no canal" — posição, terço e frase (modelo)

**Arquivos:**
- Criar: `C/_proprio/reguas-model.ts`
- Teste: `T/proprio-reguas-model.test.ts`

**Interfaces:**
- Consome: `MIN_REGUA`, `escalar` de `C/_chrome/regua/regua-model.ts`; `alcancePorVideo`.
- Produz:
  ```ts
  export type Terco = 'cima' | 'meio' | 'baixo'
  export interface PosVideo { pos: number; de: number; empates: number; terco: Terco }
  /** null = o vídeo não tem o dado, ou menos de MIN_REGUA vídeos têm. */
  export function posicaoNoCanal(vals: ReadonlyArray<{ id: string; x: number | null }>, id: string): PosVideo | null
  export type NumeroRegua = 'impressoes' | 'views' | 'engajamento' | 'curtidas' | 'comentarios' | 'duracao'
  export interface LinhaRegua { numero: NumeroRegua; grupo: 'Alcance' | 'Resposta' | 'Formato'; nome: string; valor: string | null; pos: PosVideo | null; posTexto: string | null; semRegua: string | null; tracos: Array<{ id: string; pct: number; este: boolean }>; min: string | null; max: string | null; medianaPct: number | null; comprimida: boolean; neutro: boolean; href: string | null; sr: string }
  export interface ReguasView { frase: string; linhas: LinhaRegua[]; pouco: string | null }
  export function buildReguas(a: { videoId: string; videos: ReadonlyArray<{ id: string; ytId: string; views: number | null; likes: number | null; comments: number | null; dur: number | null }>; porVideo: Map<string, AlcanceVideo>; alcanceLido: boolean; periodoTexto: string | null; hrefs: { vistos: string; imp: string } }): ReguasView
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
import { describe, it, expect } from 'vitest'
import { posicaoNoCanal, buildReguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'

const vals = (xs: Array<number | null>) => xs.map((x, k) => ({ id: 'v' + k, x }))

describe('posição no canal', () => {
  it('1 + quantos têm valor MAIOR; "de" conta só quem tem o dado', () => {
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v1')).toEqual({ pos: 1, de: 3, empates: 0, terco: 'cima' })
  })
  it('vídeo sem o dado: null (fora da régua e da contagem), nunca último', () => {
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v3')).toBeNull()
  })
  it('menos de 3 vídeos com o dado: null para todos', () => {
    expect(posicaoNoCanal(vals([10, 30, null]), 'v0')).toBeNull()
  })
  it('empate: a posição MÉDIA decide o terço (posição + empates ÷ 2), para o empate não favorecer ninguém', () => {
    // 9 vídeos; três empatados em 2º (pos 2, empates 2 → média 3 = 9/3 → cima); com seis empatados em 1º: média 1 + 5/2 = 3,5 → meio
    expect(posicaoNoCanal(vals([9, 5, 5, 5, 4, 3, 2, 1, 0]), 'v1')).toEqual({ pos: 2, de: 9, empates: 2, terco: 'cima' })
    expect(posicaoNoCanal(vals([5, 5, 5, 5, 5, 5, 2, 1, 0]), 'v0')).toEqual({ pos: 1, de: 9, empates: 5, terco: 'meio' })
  })
  it('zero medido entra e fica atrás de qualquer positivo', () => {
    expect(posicaoNoCanal(vals([0, 4, 7]), 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
  })
  it('limites dos terços: média até n/3 é cima, até 2n/3 é meio, o resto é baixo', () => {
    const xs = vals([6, 5, 4, 3, 2, 1])
    expect(['v0', 'v1', 'v2', 'v3', 'v4', 'v5'].map(id => posicaoNoCanal(xs, id)!.terco)).toEqual(['cima', 'cima', 'meio', 'meio', 'baixo', 'baixo'])
  })
})

describe('as réguas do vídeo', () => {
  const videos = Array.from({ length: 6 }, (_, k) => ({ id: 'v' + k, ytId: 'y' + k, views: (k + 1) * 100, likes: k, comments: k === 5 ? null : 1, dur: 600 + k }))
  const porVideo = new Map([['y0', { imp: 18, cliques: 2, diasComImpressao: 6 }], ['y1', { imp: 8, cliques: 0, diasComImpressao: 4 }], ['y2', { imp: 3, cliques: 0, diasComImpressao: 1 }], ['y3', { imp: 1, cliques: 0, diasComImpressao: 1 }]])
  const base = { videos, porVideo, alcanceLido: true, periodoTexto: 'de 09/09 a 07/10', hrefs: { vistos: '/v', imp: '/i' } }
  it('seis linhas em três grupos, na ordem do spec 17.3', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.map(l => [l.grupo, l.numero])).toEqual([['Alcance', 'impressoes'], ['Alcance', 'views'], ['Resposta', 'engajamento'], ['Resposta', 'curtidas'], ['Resposta', 'comentarios'], ['Formato', 'duracao']])
  })
  it('impressões são "de 4", não "de 6": quem não teve impressão fica fora da régua e da posição', () => {
    const l = buildReguas({ ...base, videoId: 'v0' }).linhas[0]!
    expect(l.pos).toEqual({ pos: 1, de: 4, empates: 0, terco: 'cima' }); expect(l.tracos).toHaveLength(4); expect(l.posTexto).toBe('1º de 4')
  })
  it('vídeo sem impressão: a linha diz "sem impressão de 09/09 a 07/10", sem régua, sem posição, sem zero; a frase abre com "Sem impressão no período."', () => {
    const r = buildReguas({ ...base, videoId: 'v5' })
    expect(r.linhas[0]).toMatchObject({ valor: null, pos: null, tracos: [], semRegua: 'sem impressão de 09/09 a 07/10' })
    expect(r.frase.startsWith('Sem impressão no período.')).toBe(true)
  })
  it('alcance não lido: a linha de impressões diz o motivo e a frase não fala de impressões', () => {
    const r = buildReguas({ ...base, alcanceLido: false, porVideo: new Map(), periodoTexto: null, videoId: 'v0' })
    expect(r.linhas[0]!.semRegua).toBe('impressões não medidas'); expect(r.frase).not.toMatch(/impress/i)
  })
  it('comentário nulo: o vídeo fica fora da régua de comentários e de engajamento ("de 5")', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.find(l => l.numero === 'comentarios')!.pos!.de).toBe(5)
    expect(buildReguas({ ...base, videoId: 'v5' }).linhas.find(l => l.numero === 'comentarios')).toMatchObject({ valor: null, pos: null, semRegua: 'não medido' })
  })
  it('a duração é neutra e fica fora da frase', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas[5]!.neutro).toBe(true); expect(r.frase).not.toMatch(/dura/i)
  })
  it('só views e impressões são link', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.map(l => l.href)).toEqual(['/i', '/v', null, null, null, null])
  })
  it('texto para leitor de tela por régua: posição, terço, valor, faixa do canal e mediana', () => {
    expect(buildReguas({ ...base, videoId: 'v2' }).linhas[1]!.sr).toMatch(/^4º de 6 em views, terço do meio; 300 views; no canal de 100 a 600; mediana 350$/)
  })
  it('menos de 3 vídeos com o dado: sem régua e "poucos vídeos para comparar (2)"', () => {
    const r = buildReguas({ ...base, videos: videos.slice(0, 2), videoId: 'v0' })
    expect(r.linhas[1]).toMatchObject({ pos: null, tracos: [], semRegua: 'poucos vídeos para comparar (2)' })
  })
  it('pouco dado, dito: com menos de 1.000 impressões no canal a nota avisa que a posição em impressões muda de um dia para o outro', () => {
    expect(buildReguas({ ...base, videoId: 'v0' }).pouco).toMatch(/muda de um dia para o outro/)
  })
  it('a frase nunca traz número e cada oração leva a forma do terço (▲ ● ▼)', () => {
    const f = buildReguas({ ...base, videoId: 'v0' }).frase
    expect(f).not.toMatch(/\d/); expect(f).toMatch(/[▲●▼]/)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/proprio-reguas-model > $SCRATCH/t12.txt 2>&1`. Esperado: FALHA por módulo inexistente.
- [ ] **Passo 3: implementar.** Posição média = `pos + empates / 2`; `cima` se `<= de / 3`, `meio` se `<= 2 * de / 3`, senão `baixo`. Engajamento = `(likes + comments) / views`, só com os três não nulos e `views > 0`. `tracos[].pct` e `comprimida` saem de `escalar` (a regra dos 60% no primeiro quarto já mora lá). `posTexto`: "18º de 35 · empate com 2". A frase junta os números por terço, na ordem cima, meio, baixo ("Primeiro do canal em impressões, mas com poucas. No meio em views, engajamento, curtidas e comentários."): "mas com poucas" entra quando o vídeo é 1º em impressões e o canal tem menos de `POUCO_VOLUME` no período.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: vídeo próprio: posição, terço e frase de "Este vídeo no canal"`.

---

### Tarefa 13: "Este vídeo no canal" na tela, gráfico do vídeo, cartão da forja e o que ainda não há

**Arquivos:**
- Criar: `C/_proprio/reguas.tsx` (`'use client'`), `C/_proprio/forja-indisponivel-video.tsx`
- Modificar: `C/video/[id]/page.tsx` (preenche `children` da tela), `C/_proprio/video.css`
- Teste: `T/proprio-reguas-tela.test.tsx` (jsdom), `T/proprio-video-blocos.test.tsx` (jsdom)

**Interfaces:**
- Consome: `ReguasView` (Tarefa 12); `buildImpressoes` com `escopo: 'video'` e `Impressoes` (Tarefa 9); `montarDias(alcance, ytId)` (Tarefa 1); `HoverTip`; a classe visual do cartão de `C/_comparar/forja-indisponivel.tsx`.
- Produz: `Reguas({ view }: { view: ReguasView })`, `ForjaIndisponivelVideo()`, e o parágrafo "O que ainda não há deste vídeo".

- [ ] **Passo 1: testes que falham**

```ts
it('é uma tabela de verdade: caption, th scope, três grupos', () => { /* getByRole('table') com caption; rowgroup × 3 */ })
it('um traço por vídeo do canal; o deste vídeo é maior, tem contorno e a cor do terço; a forma ▲ ● ▼ e a posição escrita acompanham a cor', () => { /* … */ })
it('a duração não tem cor de terço', () => { /* … */ })
it('a régua visual é aria-hidden e a célula tem o texto para leitor de tela', () => { /* … */ })
it('uma parada de Tab por régua; setas, Home e End andam de vídeo em vídeo pelo valor; Enter abre o vídeo preservando back=; Esc fecha a dica', async () => { /* … */ })
it('cada passo é falado numa região aria-live', async () => { /* … */ })
it('toque: o primeiro mostra a dica, o segundo no mesmo traço abre', async () => { /* pointerType touch */ })
it('a explicação da escala está num ⓘ só, ao fim da legenda; nenhum "escala √" na tela', () => { expect(container.textContent).not.toMatch(/escala √/) })
it('vídeo sem impressão: a linha ocupa a largura toda com a frase, sem régua', () => { /* … */ })
it('gráfico só deste vídeo: dia medido em que ele não veio é zero medido com a dica "o relatório do dia não trouxe este vídeo"', () => { /* … */ })
it('cartão da forja: "ainda não disponível para o seu canal", botão "Pedir leitura deste vídeo à forja" com aria-disabled="true", sem etapas, com o porquê', () => { /* … */ })
it('o cartão da forja não se contradiz com a tela: não diz que a coleta diária ainda não está no ar', () => { expect(card.textContent).not.toMatch(/coleta diária/) })
it('"O que ainda não há deste vídeo": views por dia (D12 c), percentual assistido e retenção, origem do tráfego, trocas de título e thumbnail', () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma e medidas: `M/regua.js`, `M/regua.css`, `M/video-proprio.js`. Traço deste vídeo 4 × 26 px, os outros 2 × 12; triângulo sob a linha = mediana; empate abre 2,6 px para o lado e o traço deste vídeo fica no valor exato (17.3). Cores por token (`--tier-high`, `--tier-mid`, `--terco-baixo`, `--text` na duração). O porquê do cartão da forja segue o ruling I-C da A3: "A forja só recebe dados públicos de concorrente; a leitura de vídeo do seu canal ainda não existe."
- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e a pasta.
- [ ] **Passo 5: commit** — `feat: vídeo próprio: réguas de "Este vídeo no canal", impressões do vídeo e cartão da forja ainda não disponível`.

---

### Tarefa 14: comparação — cartão "Só o seu canal mede"

**Arquivos:**
- Criar: `C/_comparar/so-seu-canal.tsx`, `C/_comparar/so-seu-canal-model.ts`
- Modificar: `C/_comparar/pack.ts` (`CompararPack` ganha `soSeuCanal`), `C/_comparar/comparar-screen.tsx`, `C/comparar/page.tsx`, `C/_comparar/comparar.css`
- Teste: `T/proprio-a4-so-seu-canal.test.tsx` (jsdom); ajustar o teste da A3 que afirma que o cartão não existe (D17 da A3)

**Interfaces:**
- Consome: `lerAlcance` por canal próprio (via um `lerAlcanceDosCanais` novo em `C/_proprio/dados.ts`, com a mesma regra de erro de `lerDiarioDosCanais`); `montarDias`, `resumir`, `periodoDoAlcance`.
- Produz:
  ```ts
  // C/_proprio/dados.ts
  export async function lerAlcanceDosCanais(a: { siteId: string; canalIds: readonly string[]; agora: number; podeEditar: boolean }, avisar?: (e: unknown, n: number) => void): Promise<Map<string, Privado<AlcanceCanal>>>
  // C/_comparar/so-seu-canal-model.ts — puro; roda no navegador
  export interface SoSeuCanalView { canal: string; periodo: string; imp: string; cliques: string; relatorios: string; linha: string; nota: string }
  export interface SoSeuCanalDado { resumo: ResumoAlcance; periodo: Periodo | null; acesso: 'ok' | 'negado' | 'erro' }
  /** null = o cartão não aparece (nenhum lado é canal seu, ou o canal não tem dado a mostrar e nem motivo a dizer). */
  export function buildSoSeuCanal(par: { a: { id: string; name: string; own: boolean }; b: { id: string; name: string; own: boolean } }, dados: Record<string, SoSeuCanalDado>, dm: (d: DiaYt) => string): SoSeuCanalView[] 
  ```
  `CompararPack.soSeuCanal: Record<string, SoSeuCanalDado>` (uma entrada por canal próprio do site; dado simples, serializável).

- [ ] **Passo 1: testes que falham**

```ts
it('nenhum lado é canal seu: nenhum cartão', () => { expect(buildSoSeuCanal(parDeConcorrentes, dados, dm)).toEqual([]) })
it('um lado é canal seu: um cartão com impressões, cliques estimados e relatórios com impressão, em contagem, sem "%"', () => {
  const [c] = buildSoSeuCanal(par, { [own]: { resumo: { imp: 140, cliques: 2.6, diasComImpressao: 11, diasLidos: 19, diasNaoMedidos: 10 }, periodo, acesso: 'ok' } }, dm)
  expect(c!.linha).toBe('3 cliques estimados em 140 impressões'); expect(c!.relatorios).toBe('11 de 19')
  expect(JSON.stringify(c)).not.toMatch(/%/); expect(c!.nota).toMatch(/não porque seja zero/)
})
it('os dois lados são canais seus: dois cartões, cada um com o nome do canal', () => { /* … */ })
it('canal seu sem relatório lido: o cartão diz "ainda sem relatório de alcance deste canal", sem número', () => { /* imp null */ })
it('sem permissão ou leitura que falhou: o cartão diz o motivo; nunca 0', () => { /* negado, erro */ })
it('os três números usam a cor do canal próprio (--lado-o) e o cartão tem o fio laranja', () => { /* classe */ })
it('trocar o seletor para um par sem canal seu tira o cartão sem ir ao servidor', async () => { /* usePar */ })
it('"Inverter lados" mantém o cartão do mesmo canal', async () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** A página lê o alcance de todos os canais próprios do site (são poucos) e põe `resumir(montarDias(a).dias)` e o período no pacote. Posição do cartão e forma: `M/comparar.js` (procure "Só o seu canal mede"). Meça o pacote depois da mudança e registre (teto da A3: 250 KB com gzip).
- [ ] **Passo 4: ajustar o teste da A3** que afirma a ausência do cartão em todo par: passa a afirmar a ausência **sem canal próprio no par**.
- [ ] **Passo 5: rodar e ver passar**, mais `tsc` e a pasta.
- [ ] **Passo 6: commit** — `feat: comparação: cartão "Só o seu canal mede" com impressões e cliques estimados do canal próprio`.

---

### Tarefa 15: semente do dado privado e prova em navegador (0, 1, 2 e N canais; série cheia, curta e vazia)

**Arquivos:**
- Modificar: `apps/web/e2e/fixtures/observatorio-seed.ts` (`SeedOptions.ownL2`; limpeza das quatro tabelas em `clearObservatory`)
- Criar: `E/proprio-a4.spec.ts`
- Teste: o próprio spec; `E/seed.spec.ts` ganha a conferência da semente nova

**Interfaces:**
- Consome: `seedObservatory`, `ownSeedUuid`, `assertLocal`, `OWN_PRESETS`; as telas das Tarefas 5 a 14.
- Produz:
  ```ts
  /** Dado privado do PRIMEIRO canal próprio do preset. Ausente = nenhuma linha (as telas dizem "ainda sem relatório"). */
  ownL2?: 'cheio' | 'curto' | 'parado'
  ```
  `cheio`: 29 dias de relatório terminando 3 dias antes do relógio do oráculo (11 com impressão, 8 vazios, 10 `listado`), alcance em 6 vídeos (um com CTR nulo num dia), diário de 28 dias para os longos acompanhados (maioria zero, três vídeos com views). `curto`: 2 dias de relatório e 2 de diário. `parado`: 29 relatórios vazios e diário só de zeros.

- [ ] **Passo 1: escrever o spec que falha** (`E/proprio-a4.spec.ts`), com o oráculo carregado uma vez por arquivo e a interceptação de `POST` com `next-action`:

```ts
test.describe('A4 — canal próprio e vídeo próprio', () => {
  test('sem canal próprio (preset zero): nenhum atalho, nenhum cartão "Só o seu canal mede", e canal/<id de concorrente> abre como antes', async ({ page }) => { /* … */ })
  test('um canal próprio, dado cheio: a página abre com o selo, a faixa de seis, e nenhuma célula vazia', async ({ page }) => { /* conta .obs-ch-nm e células */ })
  test('tabelas vazias (sem ownL2): a página abre, o gráfico diz "Ainda não há relatório de alcance deste canal." e nenhum número privado mostra 0', async ({ page }) => { /* … */ })
  test('série curta (2 dias): views por dia diz "menos de 7 dias medidos nos últimos 28"; o gráfico tem 2 colunas', async ({ page }) => { /* … */ })
  test('canal parado: views por dia "0" medido, ritmo "parado: nenhum em 13 semanas", impressões "0"; nada vira "não medido"', async ({ page }) => { /* … */ })
  test('dois canais próprios, um sem vídeos: canal/<o sem vídeos> mostra a frase de D10 com status 200; o menu o lista apagado', async ({ page }) => { /* … */ })
  test('cinco canais próprios (preset 5): a lista de Canais posiciona cada um; a comparação de dois canais seus mostra dois cartões', async ({ page }) => { /* … */ })
  test('os três estados do gráfico são distinguíveis sem cor: cada um tem forma própria (medida por getComputedStyle com filtro de cinza)', async ({ page }) => { /* … */ })
  test('gráfico por teclado: Tab entra uma vez; setas mudam a dica; a dica fica dentro da janela em 1440 e em 390', async ({ page }) => { /* … */ })
  test('Capas → vídeo → Próximo → Voltar: a ordem é a da grade (por impressões) e o Voltar devolve a rolagem e o foco', async ({ page }) => { /* … */ })
  test('cabeçalho recolhido com no máximo 150 px; sem rolagem horizontal da página em 1440, 1024, 768 e 390', async ({ page }) => { /* … */ })
  test('alvos de toque de 44 px em 390 (pager, abas, "Ver como tabela", traços da régua em foco)', async ({ page }) => { /* … */ })
  test('nenhum POST de server action em nenhuma destas telas', async () => { expect(posts).toEqual([]) })
})
```
Escreva cada corpo no padrão de `E/canal.spec.ts` e `E/comparar-a3.spec.ts` (mesmos auxiliares de login, de rolagem `__sc()` e de localizador `:visible`).

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:3333 npx playwright test --project=observatorio --reporter=list e2e/tests/cms/observatorio/proprio-a4.spec.ts > $SCRATCH/pw15.txt 2>&1` (em fundo).
- [ ] **Passo 3: implementar a semente.** Insira, só no banco local (a função já passa por `assertLocal`): `yt_reporting_jobs` (uma linha por canal, tipo `channel_reach_basic_a1`; leia as colunas obrigatórias na migration do L1a em `supabase/migrations/`), `yt_reporting_reports`, `yt_own_video_reach_daily` e `yt_own_video_daily` (`metric_version: 'views_desde_2026-08-27'`, `source_report_id` de um relatório semeado). `clearObservatory` apaga as quatro por `site_id` **antes** de `youtube_channels` (a chave é `on delete restrict`).
- [ ] **Passo 4: consertar o que o navegador mostrar** nas telas das Tarefas 5 a 14, em commits próprios por tela, cada um com o teste unitário que faltava.
- [ ] **Passo 5: rodar e ver passar**, mais `E/canal.spec.ts`, `E/canais-a3.spec.ts`, `E/comparar-a3.spec.ts`, `E/historico-a2.spec.ts` e `E/flutuantes.spec.ts` (nenhum pode regredir). Copie as medidas (alturas, larguras, pacote) para o relatório antes de rodar de novo.
- [ ] **Passo 6: commit** — `test: canal e vídeo próprios provados em navegador com zero, um, dois e cinco canais e série cheia, curta e vazia`.

---

### Tarefa 16: o painel lateral de Canais sai de vez — pode ser pulada (D16)

**Arquivos:**
- Modificar: `C/_canais/view-model.ts` (`drawerOf`, `DrawerView`, `forjaOf`, `CanaisDrawerForja`), `C/_canais/canais-screen.tsx`, `C/_canais/row-menu.tsx`, `C/page.tsx`
- Apagar (só se nada mais os importar; confira com `grep`): `C/_canais/channel-drawer.tsx`, `C/_canais/drawer-forja.tsx`
- Teste: `T/proprio-a4-sem-painel.test.ts`; apagar ou ajustar os testes do painel listados em `.superpowers/sdd/2026-10-11-telas-a3-canais-comparacao-plan/task-12-brief.md`

**Interfaces:**
- Consome: o redirecionamento de `?channel=` (Tarefa 8, para canal próprio; `C/_canais/legacy.ts`, para concorrente).
- Produz: `CanaisView` sem `drawer` nem `drawerForja`; `CanaisScreen` sem as props `onAskForja`, `onPin`, `onUnpin` (se a lista não as usar em outro lugar).

- [ ] **Passo 0: confira o estado.** Se a Tarefa 12 da A3 já cortou o painel de concorrente, esta tarefa corta só o resto (canal próprio). `git log --oneline -5 -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-drawer.tsx"` e leia o ledger da A3.
- [ ] **Passo 1: o teste que fixa a fronteira, antes de apagar** (`T/proprio-a4-sem-painel.test.ts`)

```ts
it('buildCanaisView não devolve painel em nenhum caso: ?channel= de concorrente, de canal próprio e de id desconhecido', () => {
  for (const channel of [concorrente, proprio, 'nao-existe']) expect('drawer' in buildCanaisView(obs, { channel })).toBe(false)
})
it('nenhum arquivo de C/ importa channel-drawer nem drawer-forja', () => { /* leitura de arquivos com fs, como T/canal-css.test.ts */ })
it('o menu da linha e o "?" continuam; "Abrir meu canal" leva à página', () => { /* … */ })
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: cortar.** Liste no relatório cada teste apagado, com o que ele provava e onde isso passou a ser provado.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`, a pasta e `E/canais-a3.spec.ts`.
- [ ] **Passo 5: commit** — `refactor: Canais: painel lateral removido; canal próprio e concorrente têm página`.

---

### Tarefa 17: validação completa e seção nova do roteiro

**Arquivos:**
- Modificar: `docs/superpowers/plans/2026-10-08-proximos-passos.md` (seção nova **3j**; a 3i é a da A3)
- Criar: `.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/task-17-report.md`

**Interfaces:**
- Consome: tudo. Produz: as medidas e a lista do que ninguém conferiu.

- [ ] **Passo 1: suíte inteira, em fundo.** `cd apps/web && npx vitest run > $SCRATCH/vitest-full.txt 2>&1` (~200 s). No contexto entram só as falhas e a linha de contagem. Zero falhas.
- [ ] **Passo 2: typecheck dos dois apps.** `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/tsc-web.txt 2>&1` e `cd apps/api && npx tsc --noEmit -p . > $SCRATCH/tsc-api.txt 2>&1`. Zero erros.
- [ ] **Passo 3: build de produção, em fundo.** Na raiz: `npm run build:web > $SCRATCH/build.txt 2>&1`. Verde.
- [ ] **Passo 4: Playwright, em fundo.** `proprio-a4`, `canal`, `canais-a3`, `comparar-a3`, `historico-a2`, `flutuantes` com o comando das Restrições globais. Zero falhas.
- [ ] **Passo 5: validação logada** (`docs/ops/runbook-cms-e2e-local.md`), em subagente Sonnet com navegador: abrir o canal próprio pela lista, pelo atalho "Meu canal" e pelo bloco "Seus canais"; abrir um vídeo e paginar; abrir a comparação com o canal próprio; em 1440 px no tema escuro e em 390 px no tema claro; console sem erro e nenhuma resposta 500. Capturas em `docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a4/` (pasta não versionada).
- [ ] **Passo 6: varreduras.** `grep -rn "color-mix" "apps/web/src/app/cms/(authed)/youtube/competitors/_proprio"` (zero); `grep -rnE "z-index:\s*[0-9]" …/_proprio` (zero); `grep -rn "começa em breve" "apps/web/src/app/cms/(authed)/youtube/competitors"` (zero); `git status --short` sem `next-env.d.ts` nem `tsconfig.json` no índice.
- [ ] **Passo 7: escrever a seção 3j do roteiro**, no formato da 3h: estado; medido (contagens e tempos); decisões do controlador (as D deste plano que foram exercidas e as frases "minhas" de cada relatório); perguntas para o dono; **o que nenhum agente conferiu** (o dado real de produção nas telas, Opera, leitor de tela, zoom de 200 a 400%, toque real, o tempo das leituras novas em produção); os itens da Parte 2 com o estado de cada um; menores adiados por tarefa.
- [ ] **Passo 8: commit** — `docs: roteiro 3j: fase A4 em staging, com o que espera o dono` (só o arquivo do roteiro). **Sem push e sem promoção:** a promoção para `main` espera o item P2-1.

---

# PARTE 2 — o que depende do dono (não há tarefa de código antes do destrave)

Cada item diz o que falta, quem destrava e o que entra depois. Nenhum vira "não medido" permanente (emenda 46): todos ficam listados na seção 3j com dono e data.

| # | Item | O que falta, exatamente | Quem destrava | O que entra quando destravar |
|---|---|---|---|---|
| P2-1 | **Portão: conferência com o YouTube Studio** | Abrir 3 vídeos no Studio e comparar, para um mesmo dia do YouTube, impressões e CTR de miniatura (com `yt_own_video_reach_daily`) e views do dia (com `yt_own_video_daily`); anotar no ledger do L2 e fechar o aceite 9. Brief pronto: `.superpowers/sdd/2026-10-09-coleta-l2-plan/conferencia-navegador-brief.md` | o dono (o Studio é dele) | **promoção da A4 para `main`** e o aceite de A4.1. Se divergir: plano de conserto da coleta antes de promover |
| P2-2 | **Views por dia do vídeo próprio na tela** (gráfico ou célula) | Mockup novo: o aprovado só tem a frase. O dado existe (`yt_own_video_daily.views`) e o leitor também (Tarefa 2, ampliando a lista de vídeos) | o dono aprova o mockup | uma tarefa de modelo e uma de tela; a frase de D12 (c) sai |
| P2-3 | **Percentual assistido e duração média** (`avg_view_percentage`, `avg_view_duration_seconds`: **já estão no diário**, por dia, nulos em dia sem view) e **retenção** (curva; depende da coleta de retenção, ainda não feita) | Decisão: mostrar a média diária agora ou esperar a retenção; e mockup (a seção 8 do spec não tem desenho; a aba Retenção é só o estado vazio) | o dono; depois, o lote de retenção da coleta (tem migration) | aba Retenção e as duas células de "Todos os números" |
| P2-4 | **Taxa de cliques do canal em percentual** | Decisão: o dono vetou percentual **por vídeo** (09/10); falta dizer se vale um percentual do canal inteiro no período, e desenhar | o dono | uma célula e uma linha na comparação |
| P2-5 | **Formato do vídeo próprio pela coleta** (`yt_own_video_meta_daily.is_short`, D8 da A3) | Decisão: muda quais vídeos contam como longos em **todas** as telas (lista, comparação, Outliers, Insights); os canais atuais não têm Shorts, os novos podem ter | o dono | uma tarefa no carregador (`L/load.ts`, `ownIsShort`) com teste de paridade |
| P2-6 | **Inscritos em 30 dias do canal próprio** | A contagem diária de inscritos do canal é tabela nova (migration, via `npm run db:new`, com o dono). Alternativa sem migration, a decidir: somar `subscribers_gained − subscribers_lost` do diário (só conta inscrição vinda de vídeo) | o dono | a célula deixa de dizer "sem contagem de 30 dias atrás" |
| P2-7 | **Agregação no banco** (função ou view que some o diário por vídeo) | Só se um canal passar de 50 longos acompanhados com necessidade de todos, ou se a leitura da lista passar de 300 ms em produção (medir depois da promoção). É migration | o dono, com a medida em mãos | troca o corpo de `lerDiario`; os modelos não mudam |
| P2-8 | **Leitura da forja para canal e vídeo próprios** | Pacote novo da forja e escrita na forja (do dono, sem exceção); decisão já tomada ("vale, depois do L2") | o dono | os cartões "ainda não disponível" viram pedido real |

Fora das duas partes, por já estar decidido: trocas do canal próprio ficam no A/B Lab; origem do tráfego fica só no bruto (não há tabela normalizada).

## Varredura de conflitos

Pares de tarefas que dividem arquivo ou interface. A ordem das tarefas é a de execução; um implementador por vez.

| Par | O que dividem | Como não colidem |
|---|---|---|
| 1 → 2, 3, 6, 9, 14 | `L/proprio/tipos.ts` e `dias.ts` | a Tarefa 1 fecha os tipos; as outras só importam. Mudança de tipo depois dela exige rodar os testes das cinco |
| 2 → 4 | `lerAlcance`, `lerDiario` | assinatura fechada na Tarefa 2 |
| 3 → 5, 6 | `VpdCanal`, `motivoVpdTexto`, `baseVpdTexto` | a 5 e a 6 não redefinem frase de views por dia: usam as da 3 |
| 4 ↔ 14 | `C/_proprio/dados.ts` | a 14 só **acrescenta** `lerAlcanceDosCanais`; não toca nas funções da 4 |
| 4 ↔ 8 | `C/_chrome/page-data.ts` | a 4 acrescenta campo em `ChannelPage`; a 8 só lê |
| 5 ↔ 14 | `C/_comparar/pack.ts`, `C/comparar/page.tsx` | a 5 acrescenta o parâmetro `extras`; a 14 acrescenta o campo `soSeuCanal`. A 14 mede o pacote de novo |
| 5 ↔ 16 | `C/_canais/view-model.ts`, `C/page.tsx` | a 5 mexe no motivo de views por dia; a 16 corta `drawer`. Regiões diferentes; a 16 roda depois |
| 6 ↔ 8 | `C/_canal/header-model.ts` (exportar derivados) | a 6 só exporta o que já existe; a 8 não mexe no arquivo |
| 7 ↔ 8 | `L/links.ts`, `C/_canal/params.ts`, `C/_canal/lista.ts`, `video-card.tsx`, `tabela.tsx` | a 7 fecha tipos e ordenação; a 8 só desenha. Testes de `canal-*` rodam nas duas |
| 8 ↔ 10 | `C/canal/[id]/page.tsx`, `C/_proprio/proprio.css`, prop `comoEsta` | a 8 deixa o encaixe vazio; a 10 só o preenche |
| 8 ↔ 16 | `C/_canais/legacy.ts`, `C/page.tsx` (redirecionamento de `?channel=`) | a 8 cria o redirecionamento do canal próprio; a 16 depende dele e não o altera |
| 9 ↔ 10, 13 | `Impressoes`, `buildImpressoes` | componente único; a 13 usa `escopo: 'video'`. Nenhuma das duas edita `impressoes.tsx` (achado vira conserto na Tarefa 15) |
| 11 ↔ 13 | `C/video/[id]/page.tsx`, `C/_proprio/video.css`, `children` da tela | a 11 deixa o encaixe; a 13 o preenche |
| 11 ↔ Histórico (A2) | `C/_historico/pager.tsx`, `C/_historico/view-model.ts` | o ramo de concorrente não muda; os testes `historico-a2-*` rodam na 11 |
| 12 ↔ 13 | `ReguasView` | fechada na 12 |
| 12, 13 ↔ comparação (A3) | `C/_chrome/regua/regua-model.ts` | só leitura (`escalar`, `MIN_REGUA`); nenhuma das duas edita o arquivo |
| 15 ↔ todas | `e2e/fixtures/observatorio-seed.ts` | a opção nova é aditiva; sem `ownL2` a semente de hoje não muda (os specs antigos rodam na 15) |
| A4 ↔ consertos finais da A3 (em paralelo) | `C/_canais/view-model.ts`, `C/_comparar/numeros-model.ts`, `C/_comparar/par-model.ts`, `C/_chrome/own-menu.ts` | **a A4 só começa a Tarefa 5 depois de a A3 fechar** (revisão final e push); as Tarefas 1 a 4 não tocam em arquivo da A3 e podem ir antes |

## Cobertura do spec (auto-revisão)

| Aceite | Tarefas | Observação |
|---|---|---|
| A4.1 leitores e três estados | 1, 2, 4 | "conferência da Task 11 registrada" é o item P2-1 |
| A4.2 cabeçalho, faixa de 6 e 11 | 6, 8, 15 (teto de 150 px) | |
| A4.3 grade e lista, ordenação por impressões | 7, 8 | |
| A4.4 "Como o canal está" | 10 | a segunda frase de volume é D13 |
| A4.5 gráfico de impressões | 9, 15 (escala de cinza) | o dia do relatório foi verificado em produção |
| A4.6 tela do vídeo, paginador, faixa com ⓘ | 11 | o paginador é o da A2 (D11) |
| A4.7 "Este vídeo no canal" | 12, 13 | |
| A4.8 cartão da forja | 13 | |
| A4.9 "Só o seu canal mede" | 14 | |
| Emenda 46 (nada sem dado por falta de leitor) | 5 (views por dia na lista e na comparação), Parte 2 | o que não tem desenho está em P2-2 a P2-6 |
| 16.8 canal sem vídeos | 8, 15 | D10 |
| N canais próprios (D-C da A3) | 5, 8, 14, 15 | a regra `escolherPrincipal` não muda |

Lacunas do mockup confirmadas em 12/10: retenção (só o estado vazio da aba), percentual assistido (nenhum desenho), views por dia do canal e do vídeo próprios (só a frase "começa em breve"), CTR em percentual (nenhum; só cliques estimados em contagem). Nenhuma delas vira tela na Parte 1.
