# F2b (Medida da hipótese D2, "destino esquentou") Implementation Plan — r3

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (ou executing-plans). Passos com checkbox (`- [ ]`).

## r3: achado → onde foi tratado

Revisões r2: Phil `.superpowers/sdd/ab-lab/f2b/phil-plano-r2.md` (90) e Yannis `.../yannis-plano-r2.md` (86). Fatos novos (28/10): F2 ligada (`OBS_SINAIS_NICHO=on`, ~18h, main `b1bd17203`), T6b = 0,9375, `rule_version = sinais-v1+lugar-v2+semente-N`. Tipos e funções conferidos por grep em `/Users/figueiredo/Workspace/bt-m6`.

| Achado | Onde foi tratado |
|---|---|
| Phil 1 / Yannis N7 (plano diz F2 desligada) | Fatos de produção, T0, volume (T2), Envios: flag on feita, T6b 0,9375, calendário com V0 = 28/10 (1º par limpo `pub ≥ 23/11`, 1º medido 03/01/2027) |
| Phil 2 (T0 pela metade) | T0: "flag on feita; aceite pendente até a rodada de 29/10 após 8h SP"; F2b-2 não se codifica antes |
| Phil 3 / Yannis N7 (V0) | V0 = `min(primeiro_visto_em)` lido do banco por site (`v0` em `niche_signal_medida_contagem`), nunca constante nem data da flag |
| Yannis N1 (`niche_signals_ancoras` não serve) | T2: pertença por janela de tempo `[first_seen_at − 14 d, fim do evento]` (14 = `REGRA_SINAIS.janelaDias`, justificado) e exclusão pelo **evento anterior** da chave (`lag`), sem reusar a função |
| Yannis N2 (`lerProprios`) | T1/T3: `ProprioRow` ganha `youtube_video_id` e `published_at` obrigatório (aditivo); filtro de privacidade escrito; `d2_proprios_fora_do_universo` |
| Yannis N3 (`EstadoDoDia` vs `EstadoValor`; `ParamsDoDia`; base) | T1 `somarJanela` recebe `EstadoValor`; T3 `estadoDoDiaDe` monta `ParamsDoDia` com a base de cada fonte |
| Yannis N4 | T4: `PESADA_FIM_MS/LEVE_FIM_MS − (c.agora() − c.t0)` no lugar de `restanteMs()`; `agenda/catalogo.ts` e `DEFINICAO_MEDIDA_D2` na lista |
| Yannis N5 | T2: métrica só sai da fila com `alvo` E `controle` em `anos_atras = 0`; a função grava os dois papéis juntos; teste novo |
| Yannis N6 | T2/T3/T5: `prova_related` é presença (`pre = 0`, `pos` = soma dos dias em que apareceu); ausência em dia coberto não é zero |

## r2: achado → onde foi tratado

Revisões r1: Phil `.superpowers/sdd/ab-lab/f2b/phil-plano-r1.md` (68) e Yannis `.../yannis-plano-r1.md` (66). Decisões do controlador para os conflitos (28/10): **D-6** tarefa própria `medida_d2` na agenda com `ligaCom: 'OBS_MEDIDA_D2'` (flag lida na hora da chamada); **E-b2** estrato lido na hora da estimativa; **E-b3** braço guardado uma vez por par; **E-b6** objetivo mantido, mecanismo pela D-6; **E-b8** e **E-b9** (Yannis) entram; fecho por métrica/fonte e espera até `pub + 41`; cobertura por vídeo via `yt_own_video_coverage`/`estadoDoDia`; calendário refeito com `V0 + 67`; fato novo da T0 (`OBS_SINAIS_NICHO` nunca ligada) vira pré-requisito.

| Achado | Onde foi tratado |
|---|---|
| Phil C1 (zero vistos, zero eventos) | Pré-requisito T0 (F2 ligada, T6b ≥ 0,90 → flag on); `sem_entrada` e V0 nulo na T4; Fatos de produção |
| Phil C2 / Yannis A1 (cobertura da fonte errada, zero por limiar) | T1 `somarJanela` com `estadoDoDia`; T3 reusa leitores e extrai `consultas.ts`; sem `yt_own_collection_attempts` |
| Phil C3 / Yannis A7 (pertença e chave mutável) | T2 `niche_signal_pares_abertos` (pertença por tempo, âncoras, `coalesce(vl.chaves, v.chaves)`, filtro 120 d, chave congelada no braço) |
| Phil I1 / A12 (volume 30× e braço repetido) | T2: `metrica = 'par'` para descarte; tabela `niche_signal_efeito_bracos`; conta refeita |
| Phil I2 / Yannis A3 / E-b9 (fecho tudo-ou-nada) | T1 `prontoParaFechar` por métrica/fonte; T2 fila "par × métrica faltante"; espera `pub + 41` |
| Phil I3 (braços de tamanhos diferentes) | T5 `estimar` por vídeo-dia |
| Phil I4 (gatilho somado) | T5 `gatilhoD2` por evento |
| Phil I5 / Yannis E-b7 (calendário) | Envios e calendário; Conferências; E-b7 |
| Phil I6 (alvo recalculado) | T1 `montarPares`: alvo = `evidence.proprios` |
| Phil M1 / E-b2 (estrato) | Coluna `estrato` removida; T5 lê `dispensa_motivo` na estimativa |
| Phil M2 (placebo filtrado na coleta) | T4: placebo gravado sempre que a cobertura cobre; piso é do estimador |
| Phil M3 (check fechado) | T2: `impressoes_sugeridos`/`impressoes_inicio`/`par` já no `check` |
| Phil M4 (R4 desde 12/10) | Fatos de produção; sem data no texto, decide o intervalo `trafego` |
| Phil M5 (grants) | T2: `revoke`/`grant` e teste `has_table_privilege` |
| Phil M6 (controle com outro destino quente) | T2/T1: `chaves_em_evento` no braço |
| Phil M7 / Yannis A8 (N+1) | T3 `lerSeriesDoSite`, uma ida por fonte |
| Phil D-1..D-5 | Decisões: D-1 A, D-2 adiar, D-3 não (e nunca para pares antes de V0+26), D-4 fora, D-5 pela D-6 |
| Yannis A2 / D-6 / E-b6 | T4 tarefa própria `medida_d2`; some `PASSOS_DEPOIS` e a flag caseira |
| Yannis A4 / E-b8 (placebo colide na PK) | T2: `papel in ('alvo','controle')`, placebo = `anos_atras > 0` |
| Yannis A5 (`detalhe` no arquivo errado, texto descartado) | T4: tarefa monta `detalhe` só com números |
| Yannis A6 (guarda tarde e lista negra) | T1: guarda de lista de permissão; passo não importa `estimador.ts` |
| Yannis A9 (`dayPt` não nomeado) | T1 importa `coleta/day-pt.ts` e `reporting/codigos.ts`; teste do horário de verão |
| Yannis A10 (RPC sem validação) | T4: Zod; `de_outro_site > 0` → vermelho; `fechado_em` por `now()` |
| Yannis A11 (ordem T4/T5) | T4 não usa `gatilhoD2` |
| Yannis dívida / complexidade | T1 `Map<chave, pub[]>`; `niche_signal_medida_contagem` em SQL |

**Fonte:** spec `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r17): §3.1, §3.4 (gravador; passo isolado vira tarefa própria, E-b6), §3.6 (medida inteira), §2.3 C4, §7 linha F2b, §11 (códigos 4 e 5), §13–§26. Base de código: `origin/main` 560325036 (28/10). O checkout `staging` local (787 à frente, 1.532 atrás) **não serve** para ler código; tudo abaixo foi lido em `origin/main`.

**Goal:** guardar, para cada outlier de "destino esquentou", a janela pré `[-28, -1]` e pós `[+1, +30]` dos vídeos nossos com a mesma chave (alvo) e sem ela (controle), por métrica, assim que a fonte fecha; e deixar pronto e testado com literais o estimador que só passa a valer depois do gatilho.

**Corte obrigatório (§3.6):** até o gatilho a F2b **só coleta e grava a janela**. Nenhum número, par nem veredito vai para a tela, o Cowork, a rota, o MCP, o sino ou o Claude Code. Três camadas: (1) a tabela nova não tem policy de leitura para `authenticated` nem grant (só `service_role`); (2) teste de arquitetura em **lista de permissão** (nasce na T1): só `sinais/medida/**` e `agenda/tarefas/medida-d2.ts` importam `sinais/medida/`; (3) `estimador.ts` não é importado por ninguém fora de teste (a tarefa não o usa) até a emenda do gatilho.

**Arquitetura (D-6):** a F2b é uma **tarefa própria `medida_d2` da agenda** (sem cron novo), `ligaCom: 'OBS_MEDIDA_D2'`, `periodo: 'dia'`, `aPartirDaHoraSP: 8` (depois de `sinais_do_nicho`), `peso: 'leve'` se o p95 da sonda couber em 85 s, senão `pesada` com `cedeA: ['sincronizar_canais']`. Não depende de nada em memória do gravador (lê `niche_signals`, `niche_outliers_vistos`, `video_lugares`, séries). Falha da medida deixa **só ela** vermelha (E-b6 mantida no objetivo) e a retentativa repete só a medida, nunca o gravador da F2. Núcleo puro (`medida/regra-d2.ts`, `janela.ts`, `estimador.ts`), borda que lê séries já coletadas (`medida/series.ts`, sobre consultas extraídas dos leitores existentes), função de banco atômica e imutável. Zero coleta nova, zero chamada à Analytics na parte (1).

**Divisão pedida no brief:**

| Parte | Tarefas | Sobe quando | O dono vê |
|---|---|---|---|
| **(0) Pré-requisito** | T0 | antes de tudo: F2 ligada | nada |
| **(1) Coleta e gravação** | T1, T2, T3, T4 | depois da revisão e do `db:push:prod` | nada; o controlador confere no `detalhe` da agenda e no SQL |
| **(2) Estimador atrás do gatilho** | T5 | o código pode subir junto, inalcançável | nada até a emenda do gatilho |
| **(3) Opcional, decisão do dono** | T7 (leitura fresca C4) | só com "pode" | nada |

---

## Fatos de produção (§11, brief e T0 de 28/10 16h12)

**Leitura de produção negada ao subagente.** Resultado que o dono rodou: `.superpowers/sdd/ab-lab/f2b/conferencia-f2b-2026-10-28-1612.txt`, resumo em `.superpowers/sdd/ab-lab/f2b/t0-resultado.md`. Consultas em `.superpowers/sdd/ab-lab/f2b/sql/` (`q1`..`q6`), rodar por `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f2b/dono-conferir-f2b.sh`. **`q5` deu erro 42803 (coluna fora do `group by`): refazer na T0.**

- **Fato da T0 de 28/10 16h12 (superado):** `niche_signals` e `niche_outliers_vistos` estavam vazios porque `OBS_SINAIS_NICHO` nunca fora ligada.
- **Fato novo (28/10 ~18h): F2 ligada.** O portão T6b rodou: precisão **0,9375** (≥ 0,90); `OBS_SINAIS_NICHO=on` no Vercel; `main` = `b1bd17203`; `rule_version = sinais-v1+lugar-v2+semente-N` (N = versão da semente de lugar). A `sinais_do_nicho` só roda de novo depois das 8h SP de 29/10: **até lá `niche_outliers_vistos` segue vazia e a entrada da F2b não está provada** (T0 pendente). Sem entrada a F2b escreveria todo dia `d2_pares_abertos: 0` com a tarefa verde (falha em verde); por isso `d2_sem_entrada` e V0 nulo.
- **V0 = `min(primeiro_visto_em)` de `niche_outliers_vistos` por site, lido do banco** (não a data da flag nem constante): a tarefa só roda a partir das 8h SP do dia seguinte e a 1ª rodada pode falhar. Estimativa de trabalho: V0 ≈ 29/10 se a rodada de 29/10 gravar, mas o plano usa 28/10 nos exemplos (1 dia otimista; o valor real vai ao ledger).
- **Mapeamento dos códigos 4 e 5 (§11): resolvido pela documentação, pelos brutos e pela `q1`** (`plano E11 F6–F7`, 12/10): mesma enumeração nos dois relatórios; **4 = `YT_CHANNEL`**, **5 = `YT_SEARCH`**, 8 = `YT_OTHER_PAGE`. `reporting/codigos.ts` diz `'3' = SUBSCRIBER`, `'7' = RELATED_VIDEO`; a `q1` mostra só 4, 5 e 8 em R3 (108 e 48 linhas) e em R5 (11 e 5). Consequência (E-b4): impressões por origem (R3) **não medem** Sugeridos nem Início. Impressões da F2b = **totais (R2)** + **busca (R3, código 5)**; `impressoes_canal` (código 4) só por inventário; `impressoes_sugeridos` (código 7) e `impressoes_inicio` (código 3) entram já no `check` (hoje zero real, dado de graça, sem migration futura). Sugeridos e Início como **views** vêm de R4 (`RELATED_VIDEO`, `SUBSCRIBER`).
- **R4 (views por origem):** coleta de dimensões existe desde 12/10 e `dimensoes ok` desde 17/10 (`q1`/`q6`). **Não se fixa data no texto:** quem decide se a janela pré de R4 está coberta é o intervalo `trafego` de `yt_own_video_coverage` (C2).
- **`q4`:** canal `117b666d` com reach/traffic todos `vazio` (49); `969fcf1b` baixa reach 31 dias e traffic_source só 9. A T0 confirma F0-a (`traffic_source_a3` com `end_time ≥ hoje − 4`) por canal.
- **`yt_own_video_traffic_detail_daily.source` só aceita `'reporting_api'`** e a PK é diária. A leitura fresca de C4 não cabe nela sem migration. Ver D-2.
- **Cobertura:** a verdade de "este dia foi coletado" é `yt_own_video_coverage`, por vídeo e `metric_set` (`base` = R1, `trafego` = R4, `alcance_dim` = R3, `detalhe` = R5; `coleta/cobertura.ts:1-5`), mais `yt_reporting_reports` para R2. `yt_own_collection_attempts` é podada aos 90 dias e só existe desde 10/10: **não é fonte de cobertura**.

---

## Global Constraints

- Migration só por `npm run db:new f2b_niche_signal_efeitos`; idempotente (`create ... if not exists`, `drop policy if exists`, `create or replace function`); `set lock_timeout = '5s'`. Migration antes do código que grava. Antes do YES do `db:push:prod`: `npx supabase migration list` e conferir que só a migration da F2b está pendente.
- Funções: `plpgsql`, `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. Tabelas: `revoke all on ... from public, anon, authenticated; grant select, insert on ... to service_role` (padrão da F2, migration `20261022000003`). No banco local de integração (54421), conferir `has_function_privilege` antes de chamar (SIGSEGV).
- RLS: as duas tabelas novas com RLS ligada e **sem policy para `authenticated`** até o gatilho; a emenda do gatilho cria a policy `public.can_edit_site(site_id)`. Teste que falsifica `app.site_id` como não-superusuário e vê 0 linhas, e `has_table_privilege('authenticated', ..., 'select') = false`.
- Flag `OBS_MEDIDA_D2`: só o valor exato `on` liga a tarefa (`ligadaPorVariavel`, `definicoes.ts:341`), **lida na hora da chamada**, nunca no `import`. Teste que **apaga** a variável. Linha em `docs/ops/env-vars.md`. Variável no Vercel antes do push que a lê. `OBS_SINAIS_NICHO` desligada ⇒ sem entrada (a tarefa devolve `d2_sem_entrada: 1`, não verde cego).
- Régua, lugar e eventos: só os da F2 (`niche_outliers_vistos`, `niche_signals.evidence`, `video_lugares`). Leitura de séries: **reusa** `observatorio/proprio/ler-diario-periodo.ts`, `ler-dimensoes.ts`, `ler.ts` (alcance) por consultas extraídas; nenhum leitor, régua ou extrator paralelo (§3.7).
- Dia de Pacífico: importar `dayPt`, `addDays`, `diffDias` de `coleta/day-pt.ts`; códigos de `reporting/codigos.ts` (`ORIGEM_DE_BUSCA` etc.); `TIPO_ALCANCE` (`ler.ts:16`) e `TIPOS_E11` (`e11-config.ts:23`). Nada de literal solto.
- Unidade = o outlier. Pré `[pub − 28, pub − 1]`, pós `[pub + 1, pub + 30]`; âncora = `published_at` do outlier.
- Linha fechada é **imutável**: `on conflict do nothing`, nunca `update` de `pre`/`pos`. `fechado_em` por `now()` dentro da função.
- LGPD: só ids, números e chaves de lugar. Nada de termo de busca: a prova direta lê só `source_type = '7'`.
- Sem `any`; Zod em toda entrada externa (inclusive retorno de RPC); kebab-case. Envio: ≤ 3 pushes/dia/terminal, combinado com a promoção; nunca stash/reset.
- Subagentes: Sonnet `medium` executa; Opus `medium` só na 1ª revisão de Phil e Yannis.

## Review Focus

1. **Dia sem linha** (falha em verde): sem linha ≠ zero. Segue `estadoDoDia(...).de(valor)` (`dimensoes-estado.ts:63-70`, rótulos `EstadoValor`): só `valor` e `zero_medido` somam; `zero_ou_abaixo_do_limiar`, `em_revisao`, `base_nao_medida`, `fora_da_cobertura`, `antes_do_inicio` contam em `dias_sem_cobertura` e a linha fecha `nao_medido` (`limiar` ou `cobertura`).
2. **Imutabilidade e reexecução:** reexecutar no mesmo dia, ou depois de mudar a semente de lugar, não altera linha fechada; a chave do par fica congelada no braço.
3. **Nada vaza antes do gatilho:** RLS sem policy e sem grant, guarda de lista de permissão, `detalhe` só com números.
4. **Prazo e vermelho:** tarefa própria com prazo próprio; sem prazo = vermelho `sem_prazo`, nunca some calado, e nunca re-executa a F2.
5. **Entrada:** "sem entrada" é distinto de "nada a fechar".

## Falha em verde: o que cada passo faz quando o dado não existe

| Passo | Dado ausente | Comportamento |
|---|---|---|
| entrada | site sem `niche_outliers_vistos` e sem sinal `destino` | `d2_sem_entrada: 1` no `detalhe` (não "0 pares abertos" calado); V0 (`min(primeiro_visto_em)` do banco) nulo ⇒ todo par `contaminacao_desconhecida`, nunca "limpo" |
| pares | sinal sem outlier com `published_at` | par não nasce; contado em `d2_sem_ancora` |
| pares | `pub − 28 < V0 − 2` | `nao_medido: contaminacao_desconhecida` (uma linha `metrica = 'par'`) |
| pares | outro outlier da mesma chave com `pub'` em `[pub − 28, pub − 1]` | `nao_medido: pre_contaminado` (uma linha `metrica = 'par'`) |
| pares | evento > 20 outliers e chave na data do evento não provável | só os 20 de `evidence`; `d2_fora_de_evidence` conta o resto |
| braço alvo | nenhum vídeo de `evidence.proprios` publicado antes de `pub − 28` | `nao_medido: sem_alvo` (uma linha `par`) |
| braço controle | nenhum vídeo nosso sem a chave publicado antes de `pub − 28` | `nao_medido: sem_controle` (uma linha `par`) |
| braço | vídeo nosso sem linha em `video_lugares` | fica fora dos dois braços; `d2_proprios_sem_lugar` conta |
| métrica | `EstadoValor` ≠ `valor`/`zero_medido` em algum dia | `nao_medido`: `limiar` (soma < base) ou `cobertura`, com `dias_sem_cobertura` |
| fecho (por fonte) | fonte ainda não cobre `pub + 30` / janela de revisão aberta | métrica fica na fila (`aguarda`); as outras fontes fecham |
| fecho | `pub + 60` sem a fonte | `desiste`: `detalhe_ausente` só em R5, `cobertura` nas demais |
| prova direta | outlier apagado antes do fecho | `nao_medido: outlier_apagado` |
| prova direta (R5 é top-N) | dia coberto sem a linha do outlier | **não é zero**: `prova_related` é presença (`pre = 0` por definição, `pos` = soma dos dias em que apareceu); ausência = "não apareceu no top", nunca "views 0" |
| braço controle | vídeo nosso público sem linha em `yt_own_video_meta_daily` nos últimos 7 dias | fica fora do universo (filtro de `lerProprios`); `d2_proprios_fora_do_universo` conta |
| placebo | período sem cobertura (R1 tem passado; R2–R5 não) | R1 `nao_medido: cobertura`; R2–R5 **não se grava** (§3.6) |
| tarefa inteira | tabela ausente (`42P01`), RPC malformada, `de_outro_site > 0` | tarefa vermelha (`schema_ausente`/`medida_falhou`), código no Sentry; F2 não é re-executada |
| tarefa inteira | prazo esgotado | `sem_prazo` (vermelho); os pares seguem devidos |

---

### Task 0: Pré-requisito e preparação (controlador, sem código)

**Estado (28/10): flag on feita; aceite pendente até a 1ª execução de 29/10 (após 8h SP).** T6b = 0,9375 passou, `OBS_SINAIS_NICHO=on` está no Vercel (~18h, main `b1bd17203`). A `sinais_do_nicho` só roda depois das 8h SP de 29/10. **Não se codifica a F2b-2 (T4 em diante, nem se faz o `db:push:prod` da T2 como "pronto para ligar") antes do aceite; T1 e o texto podem andar.** Se o T6b for refeito ou a F2 falhar, o conserto é da F2, não desta fase.

- [ ] Conferência de 29/10 (após 8h SP, leitura, uma linha cada): `select site_id, count(*), min(primeiro_visto_em) from niche_outliers_vistos group by 1;` e `select site_id, computed_at, motivo_vazio, contagens from niche_signals_estado;` (`motivo_vazio` nulo por site) e `select r.created_at, r.status, r.detalhe->>'motivo', r.detalhe->'outliers', r.detalhe->'outliersSemLugar' from competitor_agenda_runs r where r.task = 'sinais_do_nicho' order by r.created_at desc limit 7;` (conferir nomes de coluna antes). **V0 = o `min(primeiro_visto_em)` lido**, registrado no ledger `.superpowers/sdd/ab-lab/f2b/ledger.md` com a data da leitura. Se 0 linhas ou `motivo_vazio` não nulo: a causa vai ao ledger e a F2b-2 espera.
- [ ] Refazer a `q5` (par alcance×tráfego) sem o erro 42803; incluir `select metric_set, count(*), min(covered_from), max(covered_to) from yt_own_video_coverage group by 1` para confirmar que `alcance_dim` e `detalhe` têm intervalos (se não tiverem, R3/R5 ficam no relatório por canal e dia, e o plano diz isso antes da T3).
- [ ] Refazer em `origin/main` (b1bd17203): `agenda/definicoes.ts` (`sinais_do_nicho`, `ligadaPorVariavel:341`, `tetoTentativas`), `agenda/catalogo.ts`, `agenda/despachante.ts:53-57,106-114`, `agenda/tarefas/sinais-do-nicho.ts`, `observatorio/proprio/dimensoes-estado.ts:63-70`, `ler-diario-periodo.ts`, `ler-dimensoes.ts:185-230`, `ler.ts:16,99-113`, `coleta/day-pt.ts`, `coleta/e11-config.ts`, `reporting/codigos.ts`, os testes-guarda (`consumidores-semanal`, `lista-fechada-do-que-apaga`, `proprio-varredura`) e o teste do catálogo que compara `CATALOGO` e `TODAS_AS_DEFINICOES`. Divergência → ledger antes de codar.
- [ ] Se a `q1` mostrar código 3 ou 7 em R3: nada muda no desenho (já no `check`).

**Aceite:** `count(*) from niche_outliers_vistos > 0` e `motivo_vazio` nulo por site após a rodada de 29/10, **ou** a causa escrita no ledger com o dono ciente (e F2b-2 adiada); V0 lido do banco e registrado; ledger com os números e a data. Estimativa: ~25 mil tokens.

### Task 1: Núcleo puro — pares, braços, janela, fecho e guarda de vazamento

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/medida/regra-d2.ts`, `.../medida/janela.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/medida/janela.test.ts`, `.../medida/sem-vazamento.test.ts`

**Interfaces:**
- `REGRA_D2 = { versao: 1, preDias: 28, posDias: 30, fechaReportingEmDias: 34, fechaAnalyticsEmDias: 41, desisteEmDias: 60, pisoPre: 30, eventosMinimos: 10, folgaV0Dias: 2, limiteVistosDias: 120 } as const`; `fechaAnalyticsEmDias = posDias + janela de revisão da coleta (10, importada da constante da coleta, não repetida)`; `versao_regra = 'd2-v' + versao`.
- `V0` não é constante: `v0` chega a `montarPares` lido do banco (`min(primeiro_visto_em)` de `niche_outliers_vistos` por site, via `niche_signal_medida_contagem`, T2).
- `type MetricaD2 = 'views_total' | 'impressoes_total' | 'impressoes_busca' | 'impressoes_canal' | 'impressoes_sugeridos' | 'impressoes_inicio' | 'views_sugeridos' | 'views_busca' | 'views_inicio' | 'prova_related'` (mais `'par'` só como metrica de linha de descarte); `FONTE_DA_METRICA: Record<MetricaD2, 'R1'|'R2'|'R3'|'R4'|'R5'>`; `CODIGO_DA_METRICA` importando de `reporting/codigos.ts` (`impressoes_busca → ORIGEM_DE_BUSCA '5'`, `impressoes_canal → '4'`, `impressoes_sugeridos → '7'`, `impressoes_inicio → '3'`, `views_sugeridos → 'RELATED_VIDEO'`, `views_busca → 'YT_SEARCH'`, `views_inicio → 'SUBSCRIBER'`, `prova_related → '7'`). `prova_related` é **presença** (N6): `pre = 0` por definição, `pos` = soma dos dias coletados em que o outlier apareceu no top do `detalhe`; o estimador a lê como "apareceu / não apareceu", nunca como views.
- `montarPares(p: { pares: ParDaFila[]; vistosPorChave: Map<string, string[]>; proprios: { id: string; youtubeId: string; publicadoEm: string; chaves: string[]; semLugar: boolean }[] /* de lerProprios estendido */; alvoDeEvidence: Map<string, string[]>; v0: string | null; hoje: string }): Par[]` — `ParDaFila` vem da função de banco (chave já resolvida, A7). **Alvo = `evidence.proprios` do sinal ∩ publicados antes de `pub − 28`** (I6: nunca recalculado por `video_lugares` no fecho). **Controle = universo de `lerProprios` menos qualquer vídeo com a chave em `video_lugares`.** O universo de `lerProprios` (`lugares-do-site.ts:242`) é `is_hidden = false` **e** `privacy_status = 'public'` na linha mais recente de `yt_own_video_meta_daily` dos últimos 7 dias (+3 h); vídeo público sem meta nesse prazo fica fora em silêncio, então o passo o conta em `d2_proprios_fora_do_universo` (compara com `youtube_videos` `is_hidden = false`). **`ProprioRow` (`lugares-do-site.ts:11`) é estendida de forma aditiva: `youtube_video_id: string` e `published_at: string | null` sempre preenchido pelo `lerProprios`** (`calcularLugares` ignora os campos novos; os testes dos lugares seguem verdes); sem a extensão as séries (por ytId) não casam com os braços; vídeo `semLugar` fica fora dos dois e conta em `d2_proprios_sem_lugar`. `pre_contaminado` por `Map<chave, pub[]>` montado uma vez (O(W + P·log W), nunca `filter` por par). `chaves_em_evento` (M6): chaves de outros eventos `destino` quentes na janela, gravadas no braço, **sem filtrar o controle**. Descartes: `pre_contaminado | contaminacao_desconhecida | sem_alvo | sem_controle`; `v0 === null` ⇒ `contaminacao_desconhecida`.
- `prontoParaFechar(par, metrica, hoje, cobertura): 'aguarda' | 'fecha' | 'desiste'` — **por métrica/fonte** (E-b9). Reporting (R2/R3/R5): `fecha` com `end_time ≥ pub + 31` e `hoje ≥ pub + 34`. Analytics (R1/R4): `hoje ≥ pub + 41` (janela de revisão) e `covered_to ≥ pub + 30` do canal; buraco dentro da janela vira `dias_sem_cobertura`, **não espera**. `desiste` em `pub + 60`.
- `somarJanela(serie: Map<dia, number>, dias: string[], estadoDe: (dia) => EstadoValor): { soma: number } | { nao_medido: 'cobertura' | 'limiar'; diasSemCobertura: number }` — `EstadoValor` importado de `dimensoes-estado.ts` (os rótulos `valor`, `zero_medido`, `zero_ou_abaixo_do_limiar`, `em_revisao`, `fora_da_cobertura`/`base_nao_medida`/`antes_do_inicio`; `EstadoDoDia` é o objeto `{soma, omitido, emRevisao, de(valor)}` e fica na T3).

- [ ] **Step 1: testes com literais** (FAIL): âncora é a publicação do outlier, não `first_seen_at`; outro da mesma chave em `pub − 10` → `pre_contaminado`, em `pub − 29` → limpo; `pub − 28 < V0 − 2` → `contaminacao_desconhecida`; `v0 = null` → `contaminacao_desconhecida`; vídeo público sem meta recente fora do controle e contado; vídeo nosso publicado em `pub − 5` fora dos dois braços; `evidence.proprios` mantém o alvo quando a semente muda (alvo igual ao de `evidence`); nenhum alvo → `sem_alvo`; vídeo sem lugar fora dos braços e contado; `prontoParaFechar`: R2 coberto e R4 não em `pub + 34` → `views_total` `aguarda` até `pub + 41` e `fecha` depois; R4 com buraco no pré e R1 completo em `pub + 41` → R1 `medido`, R4 `nao_medido: cobertura` com contagem; R5 atrasado → só R5 espera; `pub + 60` → `desiste`; `somarJanela`: `soma < base` sem linha → `nao_medido: limiar` (nunca 0); `soma = base` sem linha → 0; dentro da carência de 3 dias → `aguarda`; fronteiras `−1` e `+1` excluem o dia da publicação; `pub` em 2026-11-01T07:30Z (fim do horário de verão nos EUA) → dia PT `2026-11-01`, pré começa em `2026-10-04`; `prova_related`: dia coberto sem a linha do outlier não vira soma 0 de views (é ausência); `D20`: nenhuma entrada de desempenho próprio muda a composição dos braços.
- [ ] **Step 2: guarda `sem-vazamento.test.ts` (lista de permissão)**: varrer `apps/web/src/**` e `apps/api/src/**`; só `sinais/medida/**` e `agenda/tarefas/medida-d2.ts` podem importar `sinais/medida/`; só `sinais/medida/**`, `database.types.ts` e `supabase/migrations/**` podem citar `niche_signal_efeitos`/`niche_signal_efeito_bracos`; **`estimador.ts` não é importado fora de `test/`**. Caso de controle: arquivo temporário fora da lista importando `medida/janela` faz a varredura devolver o nome dele (o guarda morde).
- [ ] **Step 3:** implementar. PASS. **Step 4:** commit.

**Aceite:** `npx vitest run test/youtube/observatorio/sinais/medida` verde. Estimativa: ~85 mil tokens.

### Task 2: Migration — tabelas, fila e função de gravar

**Files:**
- Create: `supabase/migrations/<ts>_f2b_niche_signal_efeitos.sql` (por `npm run db:new f2b_niche_signal_efeitos`)
- Create: `.superpowers/sdd/ab-lab/f2b/f2b-1-conferir.sql`, `.superpowers/sdd/ab-lab/f2b/f2b-1-rollback.sql`
- Modify: `apps/web/src/types/database.types.ts` (à mão, padrão da F2)
- Test: `apps/web/test/integration/f2b-efeitos.test.ts` (banco 54421, `skipIfNoLocalDb`)

**Esquema** (§3.6 com E-b1, E-b3, E-b8; **sem coluna `estrato`**, E-b2: o estimador lê `niche_signals.dispensa_motivo` por `signal_id` na hora da estimativa):

```sql
create table if not exists public.niche_signal_efeitos (
  site_id uuid not null references public.sites (id) on delete cascade,
  signal_id uuid not null references public.niche_signals (id) on delete cascade,
  outlier_video_id uuid not null,              -- sem FK: apagar canal acompanhado apaga competitor_videos (D4)
  canal_id uuid not null,
  outlier_published_at timestamptz not null,
  papel text not null check (papel in ('alvo', 'controle')),     -- E-b8: placebo = o mesmo braço com anos_atras > 0
  metrica text not null check (metrica in ('par','views_total','impressoes_total','impressoes_busca','impressoes_canal',
                 'impressoes_sugeridos','impressoes_inicio','views_sugeridos','views_busca','views_inicio','prova_related')),
  anos_atras smallint not null default 0 check (anos_atras in (0, 1, 2)),
  pre numeric, pos numeric,
  estado text not null check (estado in ('medido', 'nao_medido')),
  motivo text check (motivo in ('cobertura','limiar','detalhe_ausente','pre_contaminado','contaminacao_desconhecida',
                                 'sem_alvo','sem_controle','outlier_apagado','base_zero','volume')),
  dias_sem_cobertura smallint,
  fechado_em timestamptz not null default now(),
  versao_regra text not null,
  primary key (signal_id, outlier_video_id, papel, metrica, anos_atras),
  constraint niche_signal_efeitos_coerencia check (
    (estado = 'medido' and motivo is null and pre is not null and pos is not null)
    or (estado = 'nao_medido' and motivo is not null)),
  constraint niche_signal_efeitos_par check (metrica <> 'par' or (estado = 'nao_medido' and anos_atras = 0))
);
create table if not exists public.niche_signal_efeito_bracos (          -- E-b3: braço guardado UMA vez por par
  site_id uuid not null references public.sites (id) on delete cascade,
  signal_id uuid not null references public.niche_signals (id) on delete cascade,
  outlier_video_id uuid not null,
  papel text not null check (papel in ('alvo', 'controle')),
  anos_atras smallint not null default 0 check (anos_atras in (0, 1, 2)),
  chave text not null,                          -- chave do par congelada: troca de semente não tira o par da fila (Phil C3)
  videos text[] not null,
  chaves_em_evento text[] not null default '{}', -- M6: outros destinos quentes na janela (o estimador testa com e sem)
  criado_em timestamptz not null default now(),
  primary key (signal_id, outlier_video_id, papel, anos_atras)
);
create index if not exists niche_signal_efeitos_site_idx on public.niche_signal_efeitos (site_id, fechado_em);
alter table public.niche_signal_efeitos enable row level security;
alter table public.niche_signal_efeito_bracos enable row level security;
-- sem policy e sem grant para authenticated até o gatilho: só service_role
revoke all on public.niche_signal_efeitos, public.niche_signal_efeito_bracos from public, anon, authenticated;
grant select, insert on public.niche_signal_efeitos, public.niche_signal_efeito_bracos to service_role;
```

- `public.niche_signal_efeitos_gravar(p_site uuid, p_bracos jsonb, p_linhas jsonb) returns jsonb` — insere braços e linhas, ambos `on conflict do nothing`, só onde o `signal_id` pertence a `p_site` (`join niche_signals s on s.id = r.signal_id and s.site_id = p_site`); `fechado_em` por `now()`; devolve `{inseridas, ignoradas, de_outro_site}`. Uma transação.
- **Fila por métrica, dois papéis (N5):** a métrica só sai de `metricas_faltantes` quando existem as linhas de `alvo` **e** `controle` com `anos_atras = 0` (ou a linha `par` de descarte); a função de gravar grava os dois papéis da métrica na mesma chamada.
- `public.niche_signal_pares_abertos(p_site uuid, p_metricas text[], p_janela_dias int) returns table(signal_id, outlier_video_id, canal_id, outlier_published_at, chave, metricas_faltantes text[])` — **fila "par × métrica sem linha `anos_atras = 0`"** (A3); o catálogo vem por parâmetro para a função não repetir a lista do TS. Um par sai da fila quando não falta métrica (linha `par` de descarte encerra o par). Membros: os `outliers` de `evidence` **mais** `niche_outliers_vistos` com a chave **e** `primeiro_visto_em` em `[first_seen_at − 14 d, fim do evento]`, `fim = coalesce(dispensado_em, least(expires_at, now()))`, **e** fora do evento anterior da mesma chave (N1). **`niche_signals_ancoras` NÃO é reusada** (`20261022000003:259-272`): ela usa o último evento da chave (`distinct on ... order by first_seen_at desc`) e devolve todo visto até o fim dele, o que exclui os outliers do próprio evento que se quer medir. A função nova calcula o evento anterior com `lag(first_seen_at)` e `lag(fim)` por `subject_key` ordenado por `first_seen_at` e exclui o visto com `primeiro_visto_em <= fim do evento anterior` (já pertencia ao anterior); sem evento anterior, só vale a janela. **Δ = 14 dias = `REGRA_SINAIS.janelaDias`** (`sinais/regra.ts:7`), a janela em que a F2 junta outliers num evento: um outlier visto até 14 d antes do `first_seen_at` ainda entrou naquele evento (o sinal só abre quando a janela fecha o mínimo de 2 outliers/2 canais); passa por parâmetro da função (`p_janela_dias`), vindo da constante, não literal em SQL. Chave = `coalesce(vl.chaves, v.chaves)` (mesma expressão, a regra nunca é recomputada no TS). Filtros: `kind = 'destino'` e `first_seen_at > now() − interval '120 days'` (todo par desiste em `pub + 60`). Par que já tem braço gravado usa a **chave do braço** (congelada). Se a chave na data do evento não for provável com o dado atual, limitar aos 20 de `evidence`. Outlier sem `published_at` não entra.
- `public.niche_signal_medida_contagem(p_site uuid) returns jsonb` — só números: `pares_abertos`, `eventos_fechados` (eventos `destino` com ≥ 1 par `medido`), `sem_ancora`, `fora_de_evidence`, `sem_entrada` (1 se o site não tem `niche_outliers_vistos` nem sinal `destino`), e `v0` (data PT de `min(primeiro_visto_em)` do site, ou nulo): `v0` é a **única** chave não numérica e a tarefa a usa só para `montarPares`, nunca a publica. O resto é o que a tarefa publica no `detalhe`; a tarefa não importa o estimador (Yannis A6).
- [ ] **Step 1: testes de integração** (FAIL): reexecutar → `ignoradas ≥ 1`, `pre` intacto; `signal_id` de outro site → `de_outro_site = 1`, nada gravado; `medido` sem `pre` → violação; `metrica = 'par'` com `medido` → violação; placebo do alvo e do controle, mesmo par e `anos_atras = 1` → `inseridas = 2` (A4); `authenticated` com GUC falsificado vê 0 linhas, `has_function_privilege('authenticated', ..., 'execute')` e `has_table_privilege('authenticated', ..., 'select')` = false; fila: gravar só `views_total` → par continua com 9 métricas faltantes; gravar só o `alvo` de `views_total` (sem `controle`) → a métrica continua faltante (N5); `prova_related` `medido` com `pre = 0` e `pos` = presença é aceito, e `pre` nulo viola o `check`; outlier nº 21 (só em `vistos`) entra e some depois de gravado; dois eventos da mesma chave em sequência, 1 outlier em cada → 2 pares, nenhum repetido (o outlier do evento corrente **não** some por ser a âncora do último evento, N1); `v0` devolvido = menor `primeiro_visto_em`; outlier visto com X há 40 dias (âncora do evento anterior) não vira par do evento novo; troca de semente depois do evento mantém o par (chave do braço); sinal de 130 dias não aparece; apagar o site apaga as duas tabelas em cascata.
- [ ] **Step 2:** migration + funções. PASS (`HAS_LOCAL_DB=1`, saída em arquivo). **Step 3:** scripts de conferência e rollback (`drop function` das 3, `drop table` das 2, `migration repair --status reverted`). **Step 4:** commit.

**Volume (refeita, Phil I1):** por outlier medido: 2 papéis × 10 métricas × ~120 B ≈ 2,4 KB + 2 braços × ~450 B ≈ 0,9 KB + 2 placebos de `views_total` ≈ 0,5 KB ≈ 3,8 KB; descarte = 1 linha `par` de ~120 B (não 20). Teto de 10 eventos/dia × 3 outliers: ~30 outliers/dia ≈ 115 KB/dia ≈ **~40 MB/ano**, 3× canais ≈ 120 MB/ano; realista hoje: zero até a rodada de 29/10 (F2 ligada em 28/10, sem outlier visto ainda). Conferência D+30: `select pg_total_relation_size('public.niche_signal_efeitos') + pg_total_relation_size('public.niche_signal_efeito_bracos')`. Retenção sem prazo; revisitar quando as duas passarem de 50 MB. Estimativa: ~120 mil tokens.

### Task 3: Borda — séries e cobertura já coletadas (sem leitor paralelo)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/proprio/consultas.ts` (consultas sem prova extraídas de `ler-diario-periodo.ts` e `ler-dimensoes.ts:185-230`; recebe `sb, siteId, canalId, ytIds, de, ate`, sem `LeituraPrivadaDoSite`; os leitores existentes passam a chamá-la; a prova continua nas portas)
- Modify: `apps/web/src/lib/youtube/observatorio/sinais/lugares-do-site.ts` (`ProprioRow` ganha `youtube_video_id` e `published_at`; `lerProprios` os preenche; N2)
- Create: `apps/web/src/lib/youtube/observatorio/sinais/medida/series.ts`
- Modify: `apps/web/test/youtube/observatorio/proprio-varredura.test.ts` (`consultas.ts` só para `ler*.ts` e `sinais/medida/series.ts`; a revisão julga)
- Test: `apps/web/test/youtube/observatorio/sinais/medida/series.test.ts`; os testes atuais de `ler-dimensoes`/`ler-diario-periodo` ficam verdes (regressão das telas)

**Interfaces:**
- `lerSeriesDoSite(sb, siteId, ytIds: string[] /* união dos braços */, de: string, ate: string): Promise<SeriesDoSite>` — **uma ida por fonte** para o intervalo `[min, max]` de todos os pares do dia (inclui placebo `−365·n` só para R1), blocos de 50 (`TETO_VIDEOS_DIMENSOES`), `readAll` paginado; o núcleo recorta por par em memória (`Map<ytId, Map<dia, número>>`). R1 `base`; R2 `yt_own_video_reach_daily.thumbnail_impressions`; R3 `yt_own_video_reach_dim_daily` por `traffic_source_type in ('4','5','7','3')` (aparelho e sistema somados; `'8'` ignorado); R4 `yt_own_video_dim_daily`, `dim_kind = 'traffic_source'`, `RELATED_VIDEO`/`YT_SEARCH`/`SUBSCRIBER`; R5 `yt_own_video_traffic_detail_daily`, `source_type = '7'` e `detail = <id do YouTube do outlier>` (lido em `competitor_videos` no fecho; ausente → `outlier_apagado`). Só colunas numéricas, dia e código; nunca `detail` de outro tipo.
- `estadoDoDiaDe(...)`: monta `ParamsDoDia` (`dimensoes-estado.ts:41-52`: `coberto`, `baseMedida`, `antesDoInicio`, `desde`, `linhas`, `base`) por vídeo e dia e devolve `estadoDoDia(p).de(valor)` (um `EstadoValor`). **Base de cada fonte (N3):** R4 (`trafego`) = views de R1 (`base`) do mesmo vídeo e dia; R3 (`alcance_dim`) = impressões de R2 do mesmo vídeo e dia; R5 (`detalhe`) = top-N sem base total: dia coberto sem a linha do outlier é **ausência** (não `zero_medido`), conta em `prova_related` como "não apareceu". **R1 e R2 não têm limiar de privacidade:** sem linha com cobertura = 0 medido (confirmar em `ler-diario-periodo.ts` na T0; se divergir, o plano para e volta ao ledger). **Cobertura por vídeo e por dia** a partir de `yt_own_video_coverage` — R1 → `base`, R4 → `trafego`, R3 → `alcance_dim`, R5 → `detalhe` — passada por `estadoDoDia` (limiar, revisão, base ausente). R2 (sem conjunto próprio) e, se a T0 mostrar que `alcance_dim`/`detalhe` não têm intervalos, R3/R5: `yt_reporting_reports` `status in ('baixado','vazio')` por canal e dia de `start_time`, como `lerAlcance` (`ler.ts:99-113`), com `TIPO_ALCANCE`/`TIPOS_E11`. `coberturaAte` por fonte = maior `covered_to` (ou `end_time`) do canal.
- [ ] **Step 1: testes com cliente falso** (FAIL): o cliente falha se receber `.from('yt_own_collection_attempts')`; vídeo sem intervalo `base` no dia e canal com tentativa `ok` → `nao_medido: cobertura`; intervalo `base` de 2024 cobre o placebo de 1 ano; relatório `vazio` → coberto; `listado` → descoberto; R3 soma aparelhos e sistemas; código `'8'` ignorado; dia coberto de R5 sem a linha do outlier → presença falsa, `pre = 0`, nunca views 0; R5 com `detail` de outro vídeo não conta e nunca pede `source_type = '5'`; 10 pares do mesmo site → 5 consultas (uma por fonte), não 50; 450 vídeos → blocos de 50.
- [ ] **Step 2:** extrair `consultas.ts` primeiro (testes das telas verdes), depois `series.ts`. PASS. **Step 3:** commit.

**Aceite:** acima; guardas verdes. Estimativa: ~120 mil tokens.

### Task 4: Tarefa `medida_d2` na agenda (flag, `detalhe` e doc)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/medida/passo.ts` (`medirD2`), `apps/web/src/lib/youtube/agenda/tarefas/medida-d2.ts`
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts` (import de `DEFINICAO_MEDIDA_D2` e registro da `Tarefa`, junto de `sinaisDoNicho`, linhas ~16 e ~58)
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (nova definição `medida_d2`: `periodo: 'dia'`, `aPartirDaHoraSP: 8`, `ligaCom: 'OBS_MEDIDA_D2'`, `tetoTentativas` pequeno, peso conforme sonda; motivos `schema_ausente`, `medida_falhou`, `sem_prazo`), catálogo/`TODAS_AS_DEFINICOES`
- Modify: `docs/ops/env-vars.md` (`OBS_MEDIDA_D2`: `on` liga; padrão desligado; recuo da F2b sem desligar os sinais; dono: controlador do A/B Lab)
- **Não modifica** `sinais/gravador.ts` nem `sinais-do-nicho.ts` (some `PASSOS_DEPOIS` e a flag caseira; spec §3.4 ganha a emenda E-b6')
- Test: `.../medida/passo.test.ts`, `apps/web/test/youtube/agenda/` (catálogo, `ligadaPorVariavel`, despachante), `apps/web/test/integration/f2b-passo.test.ts`

**Interface:** `medirD2(c): Promise<ResumoD2>` — por site de `niche_signals`: lê `v0` de `niche_signal_medida_contagem` (banco, nunca constante); `niche_signal_pares_abertos(p_site, p_metricas)` → `montarPares` → por par e métrica, `prontoParaFechar`; para `fecha`/`desiste`: `lerSeriesDoSite` (uma vez por site) → linhas alvo/controle por métrica, **placebo de `views_total` nos dois braços com `anos_atras` 1 e 2 gravado sempre que a cobertura cobre as duas janelas** (`nao_medido: cobertura` quando não; o piso é do estimador, M2; R2–R5 sem placebo) → `niche_signal_efeitos_gravar` (braços uma vez por par). O passo **nunca** emite `volume` nem `base_zero` (são do estimador). O prazo é `LEVE_FIM_MS` (90 s) ou `PESADA_FIM_MS` menos `(c.agora() - c.t0)`, como em `tarefas/sinais-do-nicho.ts:15` (**não existe `restanteMs()`**); confere esse restante antes de cada site; sem prazo → `sem_prazo`. **Não importa `estimador.ts` nem `gatilhoD2`** (A6/A11). Retornos de RPC validados por Zod (A10): forma inválida ou `de_outro_site > 0` → `medida_falhou`, nunca `inseridas = 0` verde. `detalhe` montado pela tarefa, **só números finitos** (o despachante descarta o resto): `d2_pares_abertos`, `d2_fechados_hoje`, `d2_nao_medidos_hoje`, `d2_eventos_fechados`, `d2_sem_entrada`, `d2_sem_ancora`, `d2_fora_de_evidence`, `d2_proprios_sem_lugar`, `d2_proprios_fora_do_universo`, `d2_coletando: 1` (do `niche_signal_medida_contagem`).

- [ ] **Step 1: testes** (FAIL): **`delete process.env.OBS_MEDIDA_D2`** → `ligadaPorVariavel` falso e o despachante marca `desligada`; `'ON'`, `'1'`, `''` → desligada; `'on'` → devida; mesma importação do módulo, duas chamadas com `env` diferente → resultados diferentes (flag não lida no import); passo lança `42P01` → `erro` com `schema_ausente` e um spy em `rodarSinaisDoNicho` não é chamado; RPC falsa devolve `{}` → `medida_falhou`; restante do prazo `= 0` → `sem_prazo`, nenhuma RPC de efeitos; site sem vistos e sem sinais → `d2_sem_entrada: 1`; reexecução no mesmo dia → `inseridas = 0`; `detalhe` só tem `number` (`Object.values(d).every(Number.isFinite)`) e nenhuma chave casa `/pre|pos|video|id/`; integração: sinal com 2 outliers, 3 vídeos nossos (2 com a chave), séries com literais no 54421 → 2 pares × métricas gravados, um `pre_contaminado` como 1 linha `par`.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit. Sonda do p95 da tarefa decide leve/pesada (registrar no ledger).

**Aceite:** `npx vitest run test/youtube/observatorio/sinais test/youtube/agenda` verde; integração `f2b-*` verde com `HAS_LOCAL_DB=1`. Estimativa: ~85 mil tokens.

### Task 5: Estimador e gatilho (parte 2: escrito e testado, inalcançável da leitura)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/medida/estimador.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/medida/estimador.test.ts`

**Interfaces:**
- `gatilhoD2(p: { linhas: EfeitoRow[]; bracos: BracoRow[]; hoje: string }): { estado: 'coletando'; eventosFechados: number; eventosNoPiso: number; faltam: ('eventos' | 'volume' | 'idade_impressoes')[] } | { estado: 'medindo'; separaEstacao: boolean }` — **(a) e (b) juntos, por evento (Phil I4):** ≥ 10 eventos, **cada um com o alvo da métrica `medido` e Σpré_alvo ≥ 30**; `faltam` inclui `volume` com a contagem dos eventos que passaram no piso; (c) placebo de impressões só com `hoje ≥ 2027-09-08`, antes disso `separaEstacao = false` e a frase futura é "associação, não causa".
- `estimar(p: { linhas; bracos; sinais: { signalId: string; dispensaMotivo: string | null }[]; semente: number; reamostras: number }): Record<MetricaD2, Estimativa>` — **Δ por vídeo-dia (Phil I3):** por braço `((Σpós/30) − (Σpré/28)) / n_videos`, com `n_videos` lido do braço congelado; diferença alvo − controle sobre essas escalas; razão por braço `(Σpós/30)/(Σpré/28)` comparada como razão de razões, só com Σpré ≥ `pisoPre`, senão `nao_medido: base_zero`; bootstrap **por evento** com PRNG semeado (mulberry32, sem dependência nova). **Estrato derivado aqui (E-b2/M1):** par cujo sinal tem `dispensa_motivo = 'ja_fiz'` na hora da leitura é `autodeclarado` e fica fora das somas do alvo e do controle, contado à parte. Pares `nao_medido` fora das somas, contados à parte. Placebo ausente → campo ausente, nunca 0; o piso do placebo é aplicado **aqui**. Opção com/sem `chaves_em_evento` do controle (M6).
- [ ] **Step 1: testes com literais** (FAIL): alvo de 2 vídeos e controle de 31, mesmo +0,1/vídeo/dia → diferença 0; Σpré = 0 → sem NaN nem `Infinity`, `base_zero`; mesma semente → mesmo intervalo, outra → outro; 9 eventos → `coletando`, `eventosFechados = 9`, `faltam = ['eventos']`; 10 eventos de Σpré 3 → `coletando`, `faltam = ['volume']`; `hoje = 2027-09-07` → `separaEstacao = false`; `ja_fiz` dado depois do fecho tira o par da soma do alvo; `prova_related` entra como presença (sim / não apareceu), nunca somada com views; placebo abaixo do piso não aparece; placebo sem linha não aparece.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit.

**Aceite:** acima; a guarda de vazamento da T1 segue verde (nada fora de teste importa `estimador.ts`). Ligar a leitura (policy, rota, ação MCP, frase "associação, não causa", Pipeline Integrity) é **plano próprio** quando `gatilhoD2` devolver `medindo` em produção. Estimativa: ~85 mil tokens.

### Task 6: Revisão final

- [ ] Phil (`phil-dados`) e Yannis (`yannis-software`), Opus `medium`, sobre o diff de T1–T5; a da T2 vem antes, para o `db:push:prod`. Consertos por executor Sonnet até acordo; re-revisão escopada em Sonnet.

**Aceite:** pareceres fechados no ledger. Estimativa: ~130 mil tokens.

### Task 7 (opcional, só com "pode" do dono): leitura fresca de `RELATED_VIDEO` (C4)

Só se o dono decidir D-2 por "fazer agora". `analytics-client.ts` ganha `fetchDetalheSugeridos(siteId, canal, video, de, ate)` (`dimensions=insightTrafficSourceDetail`, `filters=video==X;insightTrafficSourceType==RELATED_VIDEO`, `maxResults=25`), `mapLimit` 3, teto 20/dia em `REGRA_D2`, só para vídeos do braço alvo com par aberto; resultado vai **direto** para a linha `prova_related` (sim / não no top 25 / não medido), não para R5. Testes: teto respeitado; 403/429 → `nao_medido`, nunca "não". Cota: ≤ 20/dia contra 100.000/dia do projeto `tonagarantia` (0,02%). Estimativa: ~70 mil tokens.

---

## Envios e calendário

| Envio | Conteúdo | Ordem e condição | O dono vê |
|---|---|---|---|
| **Pré (T0)** | `OBS_SINAIS_NICHO=on` **feito 28/10 ~18h** (T6b 0,9375, main `b1bd17203`) | aceite pendente até a rodada de 29/10 após 8h SP; V0 = `min(primeiro_visto_em)` lido | nada novo da F2b |
| **F2b-1 (sem build)** | migration da T2 | revisão de Phil e Yannis da T2; `npx supabase migration list` só com ela pendente (no ledger); `npm run db:push:prod`; `f2b-1-conferir.sql` | nada |
| **F2b-2** | T1, T3, T4, T5 | F2b-1 em produção; F2 com vistos > 0; `OBS_MEDIDA_D2=on` no Vercel **antes** do push; próximo push combinado de staging e promoção do dia | nada |
| **gatilho** (plano próprio) | policy de leitura, rota/MCP, frase | `gatilhoD2 = medindo` em produção | "associação, não causa", com controle |

**Calendário em função de V0** (E-b7 + fecho Analytics em `pub + 41`): só par com `pub − 28 ≥ V0 − 2` é limpo, isto é, `pub ≥ V0 + 26`; fecha em `pub + 41`. **1º par `medido` ≈ V0 + 67 dias.** Exemplo com V0 = 28/10/2026 (valor real é o lido do banco, provavelmente 29/10): 1º par limpo publica em `pub ≥ 23/11` e fecha em `pub + 41` = **03/01/2027** (= V0 + 67); com V0 = 29/10, 04/01/2027. Dez eventos fechados com Σpré_alvo ≥ 30 por evento dependem **também do volume do canal** (≈ 0,13 impressão/vídeo/dia e ≈ 0,5 view/dia no canal inteiro hoje: alvo de 3 vídeos ≈ 11 impressões e ≈ 1,2 view em 28 dias), portanto a leitura chega **depois** de V0 + 67, provavelmente meses depois; o dono recebe essa frase e a data só é prometida quando a contagem mensal mostrar a taxa real. Sem V0 (nenhum outlier visto) não há data.

Dependências: **F2 em produção com `OBS_SINAIS_NICHO=on` (ligada 28/10 ~18h; aceite T0 pendente até a rodada de 29/10)**; F0-a em produção (sem ela R5 chega com 16 dias de atraso e a fonte desiste em `pub + 60`). A `q4` da T0 confirma.

**Rollback:** `OBS_MEDIDA_D2` fora de `on` desliga a tarefa sem deploy de código novo (vale no próximo deploy; não há leitor, os dados gravados não afetam nada). Tabelas: `f2b-1-rollback.sql`.

## Conferências datadas (controlador; resultado no ledger)

- **T0 (29/10 após 8h SP):** `count(*) from niche_outliers_vistos > 0`, `niche_signals_estado.motivo_vazio` nulo por site, V0 = `min(primeiro_visto_em)` registrado; `q5` refeita; intervalos `alcance_dim`/`detalhe`.
- **D0** (1ª execução com a flag): `competitor_agenda_runs` de `medida_d2` `ok` com `detalhe.d2_*` numéricos; `select papel, metrica, estado, motivo, count(*) from niche_signal_efeitos group by 1,2,3,4` — esperado, antes de `V0 + 26`, só `metrica = 'par'` com `contaminacao_desconhecida`.
- **D+7:** contagem só cresce; `niche_signal_pares_abertos` sem par com `pub + 60` vencido; nenhum `de_outro_site`.
- **D+30:** `pg_total_relation_size` das duas tabelas ≤ 2 MB; p95 de `inicio_ms + ms` da `medida_d2` dentro do peso escolhido e da `sinais_do_nicho` ainda < 225 s.
- **V0 + 67:** 1º par `medido` (`views_total` em R1); se não houver, achado.
- **Mensal depois:** `gatilhoD2` por SQL equivalente (eventos com alvo `medido` e Σpré ≥ 30 por evento). Lembrete no `ACOMPANHAMENTO.md`.

## Decisões em aberto para o dono

| # | Pergunta | Recomendação | Custo de cada lado |
|---|---|---|---|
| D-1 | Âncora: linhas só no fecho (A) ou `aberto` desde a criação (B) | **A** (Phil e Yannis de acordo): fila "par × métrica sem linha" sai de `niche_signal_pares_abertos`; chave congelada no braço | A: zero estado novo. B: +1 estado, linhas vazias e um `update` em linha "imutável", ~+20 mil tokens |
| D-2 | Leitura fresca de `RELATED_VIDEO` (C4) | **Adiar** (T7 opcional); a Analytics guarda o passado | adiar: zero cota e zero código. Fazer: ~70 mil tokens, top 25 sem dia não cabe em R5 |
| D-3 | Completar a janela pré de R4 pela Analytics | **Não**, nem no gatilho para pares antes de `V0 + 26` (já fecham `contaminacao_desconhecida`) | não: pares sem `trafego` cobrem R1/R2 e R4 fica `nao_medido`. Sim: ~50 mil tokens + até 35 consultas por evento |
| D-4 | Marcar `feito` por efeito observado | **Fora da F2b** (F4) | dentro: ~40 mil tokens e a lista muda sem ação do dono |
| D-5/D-6 | Flag própria e mecanismo | **Decidido pelo controlador: tarefa própria `medida_d2`, `ligaCom: 'OBS_MEDIDA_D2'`** (emenda curta do §3.4) | tarefa: uma definição e o arquivo; recuo separado, vermelho sem re-executar a F2. Passo no gravador: reexecuta a F2 até 12×/dia na falha |

Hanna: não consultada; o controlador decidiu os conflitos acima.

## Emendas ao spec (propostas; entram no spec só com o acordo da revisão)

- **E-b1** (§3.6, tabela): `niche_signal_efeitos` ganha `site_id`; o `unique` vira PK.
- **E-b2** (§3.6, M3): **sem coluna `estrato`**; o estimador deriva `autodeclarado` de `niche_signals.dispensa_motivo` na hora da estimativa. "Tratado por efeito observado" fica para a F4 (D-4).
- **E-b3** (§3.6): braço congelado **uma vez por par e papel** em `niche_signal_efeito_bracos` (inclui `chave` e `chaves_em_evento`); alvo vem de `evidence.proprios`.
- **E-b4** (§3.6, métrica 1; resolve o `[a conferir]` do §11): 4 = `YT_CHANNEL`, 5 = `YT_SEARCH`; impressões medem **total (R2) e busca (R3)**; `impressoes_sugeridos`/`impressoes_inicio` já no `check`; Sugeridos e Início como views por R4.
- **E-b5** (§2.3 C4): a leitura fresca vai à linha `prova_related`, não a R5. Adiada (D-2).
- **E-b6'** (§3.4): o passo de `PASSOS_DEPOIS` vira **tarefa própria da agenda, sem cron novo**; objetivo mantido (falha deixa a medida vermelha), sem re-executar a F2.
- **E-b7** (§3.6): `contaminacao_desconhecida` quando `pub − 28 < V0 − 2` ou V0 nulo; **V0 = `min(primeiro_visto_em)` de `niche_outliers_vistos` por site, lido do banco**; 1º par limpo em `V0 + 26`, medido em `V0 + 67`.
- **E-b8** (§3.6): placebo = o próprio braço com `anos_atras > 0`; `papel in ('alvo','controle')`.
- **E-b10** (§3.6, N6): `prova_related` é presença (`pre = 0`, `pos` = dias em que o outlier apareceu no top); ausência em dia coberto não é zero.
- **E-b9** (§3.6): fecho por métrica/fonte (Reporting `pub + 34`, Analytics `pub + 41`, desiste `pub + 60`); "dia sem linha" segue `estadoDoDia`, com motivo `limiar` separado de `cobertura`.

## Estimativa total

T0 25 mil · T1 85 mil · T2 120 mil · T3 120 mil · T4 85 mil · T5 85 mil · T6 130 mil ⇒ **~650 mil tokens** (r3 sem mudança de total; r2: ~650 mil; r1: ~585 mil; sobe por extrair `consultas.ts`, a tabela de braços, a tarefa própria e a T0 de diagnóstico). Sonnet executa; Opus só na 1ª revisão. Com a T7 (se D-2 = fazer agora): ~720 mil. Fora disso, o conserto da F2 (se o T6b falhar) é da F2, não entra.

## Fora deste plano

Leitura do resultado (policy, rota, MCP, frase na tela) — plano do gatilho; "meu vídeo caiu" e portão de volume (F4); `feito` por efeito observado (D-4); placebo de impressões antes de ~08/09/2027; backfill de R4 (D-3); dívida de `outliers.ts:30` (§3.4); conserto da F2 se o portão T6b não passar.
