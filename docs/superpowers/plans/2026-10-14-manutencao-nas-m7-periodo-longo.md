# Fase de manutenção (NAS e forja), M7: período longo (a peça 6, "Ver antigo"). Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** quem edita o site pede, na página do canal, o relatório de um período que já saiu do banco (12, 24 ou 36 meses), e recebe, sem ficar esperando na página, uma lista por mês com dias medidos, origem e views, montada dos **arquivos de resumo por canal** guardados no NAS (meses selados) e do banco (meses ainda não selados, marcados "parcial"). A forja atende pelo **respondedor**, um serviço contínuo de só leitura que pega o pedido, lê só os arquivos que o site lista, e devolve linhas e falhas por arquivo; o site confere contra o registro, guarda o resultado por 30 dias e mostra cada um dos 15 estados da peça 6 com a frase aprovada. Item 12 do `05` §15.1: o claim leva a lista dos arquivos, e a medida do respondedor com 2.700, 10.800 e 16.200 arquivos sintéticos lidos por NFS fixa o teto antes da entrega.

**Architecture:** uma migration (`*_manutencao_m7_periodo_longo.sql`, rascunho em `supabase/rascunhos/m7.sql` até a vez dela: TRAVA M7-1) cria a fila (`obs_archive_requests`), o resultado (`obs_archive_results`), as funções da fila (criar, cancelar, ler, claim, progresso, resultado, falha), o cálculo do resumo extraído (`obs_archive_summary_calc`, usado pela selagem da M3b **e** pelo caminho online "parcial"), o gatilho que apaga resultado e cancela pedido quando um canal é removido com `apagar`, a consulta do vigia 5 e a poda diária. No site: módulos puros em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/` (contrato do pedido, estado efetivo, frases da peça 6) entram antes da migration; as quatro rotas `POST /api/pipeline/archive/request/{claim,progress,result,fail}`, as server actions e o painel "Ver antigo" na página do canal só depois de ela estar em produção (TRAVA M7-2). Na forja: `arquivo/respondedor/responder.py` (biblioteca padrão, Python 3.12, montagem de leitura `ro`), a unidade `arquivo-responder.service`, o bloco do pulso e o programa de medida; tudo instalado pelo dono por arquivos de comandos (TRAVA M7-3).

**Tech Stack:** PostgreSQL 17 (Supabase), PL/pgSQL, pg_cron, Next.js 16 (route handlers, server actions, client component), TypeScript strict, Zod, Vitest, `pg` nos testes de integração; Python 3.12 só com biblioteca padrão; systemd.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos: `05` §15.1 (linha M7, item 12) e §16.6 (instalar o serviço); `02` §10.6 (fila, respondedor, resultado, custo); `02` §11.2 (comentário nunca no resultado); `03` linha 46 (linha 11 da tabela de falhas) e linha 140 (passo 9 do ensaio, M8); `04` §14.6 (peça 6, 15 estados); `06` §18 itens 50 a 57, 102 a 105, 160 (consultas 5 e 6) e 162; `06` §19 R40, P22, P45 (retirada). O `00` §3 (D1 a D27) vale como lei. Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md` (seção final: rota com chave, sem papel de banco; "o que exige a casa, M7 incluída, fecha antes da partida").

**Mockup aprovado (fonte da tela; não redesenhar):** `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/peca6-ver-antigo.html`, `peca6.js` (frases exatas nas funções `antes`, `semArquivo`, `desligado`, `enviado`, `lidos`, `andamento`, `pronto`, `venceu`, `incompleto`, `bate`, `naoResp`, `nasFora`, `grande`, `repetido`, `cancelado`, `naoMedido`), o bloco da peça 6 em `m19.css`, `NOTAS.md` linhas 78 a 120 e o roteiro `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` §19e (linhas 1199 a 1220). Aprovado pelo dono em 14/10.

**Planos aprovados que este consome (por `grep`, sem copiar):** M3b-site (`...-m3b-site.md`; contrato r2.5 em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md`: C0 regras, C0.2 caminho do resumo, C8 batimento, C10 "request/* são da M7"; Tarefa 11: `archive-auth.ts` com `authenticateArchive`, `arquivoLigado`, `TRABALHADOR.archive_read = 'respondedor'`, `erroDoRpc`; Tarefa 1: `contrato.ts` com `STATUS_DO_CODIGO`, `CODIGOS`, `caminhoDoResumo`; Tarefa 14: `docs/ops/runbook-arquivo-mensal.md` com a consulta 5 em `to_regclass`); M3b-forja (`...-m3b-forja.md`: `comum.py`, `cliente_site.py`, `falsos.py`, `pulso_arquivo.py`, `teste_tudo.sh`); M3a (`...-m3a-casa.md`: chave `respondedor.chave` com `archive_read`, montagens `/mnt/arquivo/leitura/{numerico,texto}` `ro`, CP10 aceito).

**Quem é o outro lado:** o respondedor (Tarefas 11 a 13, kit da forja) lê a seção "Contrato das rotas do pedido" abaixo, gravada também em `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md` (Tarefa 1). **Este plano é o dono do contrato.**

---

## Global Constraints

- **Migration só no dia, e por `npm run db:new manutencao_m7_periodo_longo`** (Tarefa 14). Até lá o SQL vive em `supabase/rascunhos/m7.sql` (rastreado; o CLI só lê `supabase/migrations/`). O nome leva `_manutencao_` (o teste da M2, Tarefa 1, a reconhece por isso).
- Idempotência: `create table if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`, `cron.unschedule` guardado antes de `cron.schedule`.
- Tabelas novas em `public`, RLS ligada, policy de leitura `public.can_edit_site(site_id)` (memória `reference_rls_guc_spoof_pattern.md`: leitura sensível nunca por `can_view_row`), **nenhuma** policy de escrita; `revoke all ... from public, anon, authenticated` **e** `revoke insert, update, delete, truncate, references, trigger ... from service_role` (molde da M3b, Global Constraints). Nenhuma chave estrangeira para canal, vídeo ou site (`02` §10.1). Funções novas: `security definer`, `set search_path = ''`; **produção já tem `20261014000007` (A5): função nova em `public` nasce sem EXECUTE para `anon`/`PUBLIC`**; mesmo assim cada função leva `revoke all on function ... from public, anon, authenticated` explícito, as internas também `from service_role`, e `grant execute ... to service_role` só onde a rota ou a server action chama. Permissão se testa com `has_function_privilege`, nunca chamando como `anon`/`authenticated` (SIGSEGV no Postgres local).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se a pendente for exatamente a do dia. Janela: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), arquivos em série (`--no-file-parallelism`), cada teste dentro de `begin … rollback`. O rascunho da M3b é pré-requisito (aplicado por `aplicarM3b` de `apps/web/test/helpers/m3b.ts` enquanto `M3B_EM_MIGRATION=false`).
- TypeScript strict, sem `any`; Zod na borda com `.safeParse` (nunca `as` sobre dado de RPC); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito no `staging`; arquivo novo: `git add -- <caminhos>` antes do `git commit -- <caminhos>`; nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Kit da forja: `git -C ~/Workspace/forja/ferramentas add -- <caminhos>` e `git -C ~/Workspace/forja/ferramentas commit -- <caminhos>`.
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de Modify, `git diff --stat -- <arquivo>`; com mudança alheia, não editar nem commitar: registrar no ledger o arquivo, `git log -1 --format=%an -- <arquivo>` e a data; o controlador pergunta na manhã seguinte (regra da M3b).
- `.superpowers/` é ignorado pelo git: ledger (`.superpowers/sdd/manutencao-nas/m7-progresso.md`), arquivos de comandos (`.superpowers/sdd/manutencao-nas/m7/`) e saídas (`.superpowers/sdd/manutencao-nas/saidas/`) nunca entram em commit. O que teste ou CI lê vive em caminho rastreado.
- **NAS e forja: escrita é do dono, sem exceção.** Nenhum agente roda `ssh forja '<escreve>'`, `scp`, `install`, `systemctl`, `crontab -` nem `mv` lá. O agente prepara um ARQUIVO de comandos (curtos, um por linha) e uma linha curta que o roda com saída em `saidas/`, posta no clipboard (`pbcopy`), uma de cada vez, a próxima só depois do resultado (memória `feedback_comando_no_clipboard.md`). Leitura por `ssh forja '<leitura>'` é permitida e esperada. Nenhum agente cria nem revoga chave: o respondedor usa a `respondedor.chave` que a M3a já instalou.
- **O sistema falha em VERDE.** Cada passo diz o que acontece quando o dado NÃO existe (mês sem registro, resumo vazio, arquivo ausente, NAS desmontado, heartbeat nunca gravado, variável apagada, casa desligada) antes do que acontece quando dá erro. Nenhum estado da tela vira "sem dados" nem zero por falta de leitura.
- Variáveis com padrão (respondedor): `ARQ_RESP_INTERVALO_S` (15), `ARQ_RESP_ORCAMENTO_S` (780), `ARQ_RESP_PAUSA_DESLIGADO_S` (300), `ARQ_MONTAGEM_LEITURA` (`/mnt/arquivo/leitura`), mais as comuns (`ARQ_SITE`, `ARQUIVO_BASE`, `ARQUIVO_CHAVE_ARQ`). Cada uma com **teste que a apaga** e afirma o padrão, e com teste do valor ilegível (vira `bug`, nunca o padrão calado; regra do `config` da M3b). No site não há variável nova: a peça 6 obedece `OBS_ARQUIVO` (só `on` liga), cujo teste de apagar já existe na M3b.
- **Orçamento acoplado da fila da forja (CLAUDE.md, "A forja") não é tocado:** o respondedor é outro processo, com `Nice=10` e `IOSchedulingClass=idle`, sem cron, e não lê `youtube_intelligence_tasks`.
- Sem datas-meta. O único relógio é o do dado e o da partida: **em jan/2027 o dono está na Ásia**; a instalação na forja (Tarefa 15) e a medida (Tarefa 13) são mão do dono em casa e fecham antes da partida (decisoes-dono-14-10, "o que exige a casa"). O respondedor tem o que ler desde a primeira selagem (devida em 28/11/2026); a tela só oferece o botão quando houver mês fora do banco.

## Travas e ordem de execução

- **TRAVA M7-0 (dependência de teste):** as Tarefas 3 a 7 só começam com `git ls-files apps/web/test/helpers/m3b.ts supabase/rascunhos/m3b.sql` listando os dois e com `grep -n "export async function aplicarM3b" apps/web/test/helpers/m3b.ts` achando a função. Faltando, a M7 faz as Tarefas 0, 1, 2 e 11 a 13 (puras ou do kit) e registra a espera.
- **TRAVA M7-1:** nenhum arquivo `*_manutencao_m7_*` em `supabase/migrations/` antes da Tarefa 14, Passo 1. O teste `apps/web/test/manutencao/m7-trava.test.ts` (Tarefa 3) segura a trava.
- **TRAVA M7-1b (dependência de produção):** a Tarefa 14 só começa com a M3b aplicada em produção e conferida no ledger dela ("TRAVA M3b-2 solta em <data hora>" em `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md`). A M7 lê `obs_archive_summaries`, `obs_archive_units`, `obs_archive_months`, `obs_archive_heartbeat`, `obs_archive_channel_removals` e substitui `obs_archive_summary_rows`. Ordem das migrations em produção (brief da onda 2): M2 (15/10) → M10a → M3b → **M7**.
- **TRAVA M7-2:** nenhuma linha das Tarefas 8, 9 e 10 (rotas, server actions, painel), nem na árvore sem commit, antes de a migration da M7 estar aplicada em produção e conferida (linha "TRAVA M7-2 solta em <data hora>" no ledger). Parte mecânica no `m7-trava.test.ts`: sem migration `*_manutencao_m7_*`, `apps/web/src/app/api/pipeline/archive/request` não existe e nenhum arquivo em `apps/web/src/app/cms/(authed)/youtube/competitors/canal/` contém `obs_archive_request`. Motivo (P47 da M3b): com o código no `staging`, a promoção de outra frente o leva a produção antes da função, e o painel responderia "Não foi possível ler o estado do pedido" para sempre.
- **TRAVA M7-3 (forja):** o respondedor só é ligado (Tarefa 15) depois de as rotas estarem em produção e responderem `200` com `{pedido: null}` a uma chamada de prova; antes disso ele bateria em 404 a cada 15 s.
- **Ordem:** 0 → 1 → 2 → (TRAVA M7-0) 3 → 4 → 5 → 6 → 7 → 11 → 12 → 13 (medida; pode correr em paralelo a 3–7 assim que a Tarefa 11 existir) → **14** (migration; TRAVA M7-1b) → 8 → 9 → 10 → 15 → 16. Tarefas 1, 2, 11, 12 e 13 são puras (TypeScript sem banco, ou kit) e podem ser commitadas antes da migration.
- **Dívida declarada:** entre as Tarefas 3 e 14 o SQL só é provado no banco local e na CI (`ci.yml` roda `HAS_LOCAL_DB=1 npm test -- integration/ --no-file-parallelism`). Gatilho de pagamento: Tarefa 14, Passo 1.

## Review Focus

1. **Nunca "sem dados" por falta de leitura (falha em verde).** Mês com linhas esperadas no registro e resposta zero, ausente ou diferente é **incompleto** com motivo; mês sem entrada no registro nunca é pedido; NAS desmontado ou sem sentinela é `nas_fora`, nunca `arquivo_ausente` nem mês vazio; pedido nunca atendido vence em 15 min (`sem_trabalhador`), calculado na leitura (Tarefas 4 a 6, 11).
2. **O site confere; o respondedor só lê.** O `result` recalcula o esperado do registro (linhas do resumo e `hash_conteudo` de cada unidade); o respondedor não lista pasta, não deduz do manifesto, abre só os caminhos que o claim mandou e só arquivos de resumo `.canal` (Tarefas 6, 11).
3. **Fila sem duplicado e sem laço.** Índice único parcial por (site, impressão) nos ativos; o contador de tentativas sobe **antes** de processar; teto 2; pedido vencido nunca é pego; pedidos acumulados com a casa desligada vencem, não rodam no religamento; resumo purgado depois do claim volta o pedido a `pending` **uma** vez (Tarefas 4, 5, 6).
4. **Teto de tamanho antes de inserir** (512 kB por resultado; 8 MB no total, expulsando o mais antigo na mesma função) e **nada de comentário** no resultado (Tarefa 6).
5. **Remoção de canal com `apagar`** apaga o resultado e cancela o pedido na mesma transação, inclusive pedido sem lista de canais; a consulta 5 do vigia acha o resultado plantado (Tarefa 7).
6. **Costura**: mês selado vem sempre do resumo no arquivo; mês não selado vem do banco pela **mesma** função que gera o resumo (`obs_archive_summary_calc`, com prova de bytes idênticos na selagem), marcado "parcial"; pedido real nunca lê a classe `ensaio` (Tarefa 6).
7. **Cada estado da tela com a frase aprovada** e nenhum estado novo sem remessa ao Logan (Tarefas 2, 10).

---

## Fatos usados (com fonte)

| Fato | Fonte |
|---|---|
| M7 = fila, respondedor, resultado, peça 6; item 12 (lista de arquivos no claim; medida com um resumo por canal: até 16.200 em 5 anos com 75 canais; 2.700 só da classe usada); depende de M3b; mão do dono: instalar o serviço; "já há o que ler desde 28/11" | `05` linha 27 |
| Instalação: `scp` do `arquivo/respondedor` para `/opt/arquivo/`, unidade em `/etc/systemd/system` por `sudo install`, `daemon-reload`, `enable --now`; conferência `systemctl show arquivo-responder -p ActiveState -p NRestarts -p ActiveEnterTimestamp` | `05` §16.6 (linhas ~427 a 460) |
| Rotas `request/claim`, `progress`, `result`, `fail` com `archive_read`; claim devolve por (classe, mês) a lista dos resumos com sha256 de `obs_archive_summaries` sem `purged_at`, num jsonb com total; respondedor recusa `inesperado` se o total difere; esperado recalculado no `result`; purgado depois do claim → volta a `pending` uma vez; decisão `apagar` apaga resultados e cancela pendentes (sem lista de canais também); `sem_destino` lido como guardado, contado à parte | `02` §10.6 (linhas 374 a 460) |
| Fila: meses 12/24/36/tudo, lista fechada de medidas, status `pending,running,done,failed,expired,cancelled`, `expires_at` 15 min, arrendamento 3 min renovável, execução máx 15 min, motivos `sem_trabalhador, nas_fora, arquivo_ausente, divergente, grande_demais, inesperado`, índice único parcial, dono cancela pendente, expiração na leitura; resultado ≤512 kB comprimido, cobertura por mês, validade 30 dias, teto total 8 MB pela função que insere; poda diária de pedidos > 7 dias e resultados vencidos | `02` §10.6 |
| Respondedor: serviço contínuo (`Restart=on-failure`, 30 s, limite de partidas), consulta a cada 15 s, só leitura, `nas_fora` sem montagem ou sentinela, só arquivos de resumo, contador antes de processar, teto 2, bloco próprio no pulso; custo 5 a 50 ms por arquivo (54 s a 13,5 min), claim ~1,4 MB a 10.800 entradas | `02` §10.6 |
| Linha 11 da tabela de falhas (as frases de cada motivo; "nunca 'sem dados'") | `03` linha 46 |
| Itens 50 a 57, 102 a 105, 162; 160 (consultas 5 e 6 do runbook) | `06` §18 |
| 15 estados da peça 6 e as frases | `04` §14.6; frases finais em `peca6.js` linhas 43 a 140 (o mockup aprovado prevalece onde difere: "Peça menos meses." sem "canais", porque o pedido da tela é de um canal) |
| `obs_archive_summary_rows(p_site, p_class, p_channel, p_month)`: recusas `resumo_da_m10b`, `canal_removido`, `ja_no_arquivo`, `canal_fora_do_mes`, `unidades_pendentes`; laço por unidade com `execute format` sobre `obs_archive_table_exprs` e `obs_archive_unit_source`; colunas `.canal` = `canal,tabela,mes,videos_com_linha,linhas,dias_medidos,dias_do_mes,primeira_leitura,ultima_leitura,var_views,var_likes,var_comments,hash_conteudo_unidade,versao_resumo` | `supabase/rascunhos/m3b.sql` linhas 1073 a 1137 |
| Tabelas do registro (`obs_archive_units` 59–97, `obs_archive_months` 113, `obs_archive_heartbeat` 157, `obs_archive_summaries` 184–202, `obs_archive_channel_removals` 204), política (9–31: `serie` = `competitor_video_daily` e `competitor_video_early`, filho `numerico`) | `supabase/rascunhos/m3b.sql` |
| `obs_archive_agora()` é o gancho de relógio de teste; `obs_archive_hoje_sp()` | `m3b.sql` linhas 1441 e 420 |
| `competitor_channel_remove` (2439–2465) e `obs_archive_channel_removal_decide` (2515–2544) gravam a decisão em `obs_archive_channel_removals.archive_decision` | `m3b.sql` |
| `authenticateArchive(req, ['archive_read'])`, `erroDoRpc`, `pipelineSuccess` sem `no-store` (a rota o põe) | plano M3b-site linhas 2904–2990 e 440 |
| `STATUS_DO_CODIGO` e `CODIGOS` em `arquivo-mensal/contrato.ts` | plano M3b-site linhas 888–897 |
| Caminho do resumo `<classe>/canais/<canal>/resumo/<AAAA-MM>.v<N>.<tipo>.csv.gz`; `serie` mora no filho `numerico` | `comum.py` linhas 9 (CLASSES) e 96–100; contrato C0.2 |
| `estado_filho(raiz, filho)` exige montagem real e `.arquivo-vivo`; `ler_arquivo(caminho, coluna, eh_csv)` dá sha256, bytes, linhas e soma numa leitura com `descartar_cache`; `existe` não engole EIO; `config` aceita só `copiador` e `conferir-b2` hoje | `comum.py` linhas 290, 385, 405 |
| `Site.dados(metodo, rota, corpo)`; erros `SiteFora`, `ArquivoDesligado`, `ChaveRecusada`, `Recusa` | `cliente_site.py` linhas 14–30, 56, 125 |
| Chave `/opt/arquivo/chaves/respondedor.chave` com `archive_read`, ativa desde 14/10 16:52; montagens de leitura `ro` (CP10 aceito) | ledger M3a |
| Molde systemd na forja: `biblioteca-trabalhar.service` (User=thiago, Restart=on-failure, RestartSec=30, TimeoutStopSec=30, Nice=10, IOSchedulingClass=idle, NoNewPrivileges, ProtectSystem=strict, ProtectHome=tmpfs, ReadWritePaths, ReadOnlyPaths, PrivateTmp) | lido por `ssh forja` em 14/10 |
| pg_cron: função `cron_purge_*` grava `cron_runs`; `do $guard$` só agenda se a extensão existe | `supabase/migrations/20261014000001_manutencao_m1_podas_execucao.sql` linhas 136 a 165 |
| Lista fechada do que apaga: estática em `apps/web/test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts`; de banco em `apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts` (regex `delete from` em funções `^(competitor_\|yt_\|youtube_channel_\|obs_)`) | os dois arquivos |
| Página do canal: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/page.tsx` → `CanalScreen` de `_canal/canal-screen.tsx` (`'use client'`, ações por props `CanalActions`) | leitura em 14/10 |

## Decisões deste plano (o que o spec deixou ao plano, ou que o plano muda, com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Medidas v1 (lista fechada):** `linhas`, `videos_com_linha`, `dias_medidos`, `dias_do_mes`, `var_views`, `var_likes`, `var_comments` da linha `competitor_video_daily` do resumo `.canal` da classe `serie`. Nenhuma outra classe nem tipo de resumo é aberto. `ficha_do_video` (P22) é **recusada** (`medida_fora_da_lista`) até a M10b | `02` §10.6 ("colunas do resumo por canal"); a tela mostra dias medidos e views; `obs_archive_summary_rows` recusa `video_antigo` (`resumo_da_m10b`) |
| D2 | **O "esperado" de cada arquivo** é: `canal_rows` de `obs_archive_summaries` (linhas do CSV) e, linha a linha, `hash_conteudo_unidade` igual ao `hash_conteudo` da unidade em `obs_archive_units` (via `unit_hashes` do resumo). Diferença em qualquer um: mês `divergente` | O spec fala em "linhas e soma esperadas"; o resumo não tem coluna de controle; o hash da unidade é o que o resumo carrega e o registro guarda (desvio declarado, mais forte que a soma) |
| D3 | **Falhas por arquivo** (`ausente`, `divergente`, `nas_fora` no meio da leitura, `ilegivel`) viajam dentro do `result` e viram meses incompletos; `fail` é só para o pedido inteiro (`nas_fora` antes do primeiro arquivo, `grande_demais`, `inesperado`) | O mockup mostra "faltam 2 de 12 meses ... porque o NAS deixou de responder durante a leitura" com os outros 10 meses presentes (quadro `x-inc`) |
| D4 | **Carga como `jsonb`** com teto de 512 kB medido por `octet_length(payload::text)` (texto **não** comprimido) e total de 8 MB pela soma de `payload_bytes` | Postgres 17 não tem gzip em SQL; medir o texto é mais restritivo que o spec ("comprimida ≤ 512 kB"); o TOAST comprime no disco. Desvio declarado, para o lado seguro |
| D5 | **Cancelar também durante a leitura** (mockup, quadro `e-and`); o respondedor sabe pelo `progress` (`409 pedido_cancelado`) e para | O spec diz "dono pode cancelar pendente"; o mockup aprovado tem "Cancelar pedido" no andamento |
| D6 | **Estado efetivo calculado na leitura** (`obs_archive_request_state`): `pending` com `expires_at` passado → `expired/sem_trabalhador`; `running` com `deadline_at` passado, ou arrendamento vencido com `attempts = 2` → `expired/sem_trabalhador`; a poda diária só normaliza o que a leitura já mostra | `02` §10.6 ("expiração calculada na leitura") e item 50 |
| D7 | **Um pedido = (site, tipo, canais, meses, medidas).** A tela pede sempre um canal; a função aceita `p_channels` nulo ("todos", para o ensaio e uso futuro). Impressão = `md5` do texto normalizado; o índice único parcial `(site_id, fingerprint) where status in ('pending','running')` recusa o segundo ativo (`repetido`) | Item 53; `02` §10.6 |
| D8 | **Meses do pedido:** os N meses de calendário que terminam no mês corrente de São Paulo; "Tudo" = desde o primeiro mês com linha do canal na diária ou no registro. Mais de 36 → `grande_demais` **na criação** (o botão "Pedir" já vem desligado na tela). Teto de arquivos por pedido `TETO_ARQUIVOS = 2700` até a medida (Tarefa 13) | Mockup (`LIM = 36`); item 12 |
| D9 | **Origem de cada mês:** selado com `sealed_kind = 'com_dado'` → do resumo no NAS ("da cópia no NAS"); `vazio_conferido` → "Sem registro neste mês (conferimos em dd/mm)" com a data do `sealed_at`, sem abrir arquivo; não selado → do banco por `obs_archive_summary_calc`, "do banco, ainda sem cópia" + "parcial". O rótulo "do banco" sem "parcial" do mockup **não aparece**: mês selado vem sempre do arquivo (`02` §10.6, item 103). Remessa ao Logan (Tarefa 10, Passo 1) | Spec prevalece sobre o rótulo; o desenho não muda |
| D10 | **`obs_archive_summary_calc` extraído** do corpo de `obs_archive_summary_rows` (o bloco `execute format` por unidade) e chamado pela selagem e pelo caminho online. A M7 recria `obs_archive_summary_rows` com o corpo idêntico salvo a chamada; prova: o JSON da selagem antes e depois é igual byte a byte nas fixtures da M3b (Tarefa 6) | `02` §10.6 ("pela mesma função do resumo"); se a Tarefa 10 da M3b ainda não tiver rodado quando a M7 chegar à Tarefa 6, a extração pode entrar no rascunho da M3b como emenda, com acordo do dono do plano M3b (registrar no ledger) |
| D11 | **Remoção com `apagar`:** gatilho `after insert or update of archive_decision on obs_archive_channel_removals` (quando `new.archive_decision = 'apagar'`) apaga resultados e cancela pedidos na mesma transação. **Não** recria `competitor_channel_remove` nem `obs_archive_channel_removal_decide` | O D16 da M3b diz que a M7 os recria; copiar corpos de função da M3b para acrescentar duas instruções duplica código vivo. O gatilho pega os dois caminhos e qualquer terceiro (desvio declarado, a Phil e Yannis) |
| D12 | **Vigia 5** é a função `obs_archive_vigia_resultados()` (só leitura, devolve a contagem) e a consulta do runbook a chama; o vigia 4 da M3b não é tocado | Item 160: (5) é consulta do dono no runbook |
| D13 | **Online parcial chamado pela rota, um mês por chamada** (`obs_archive_request_online(p_site, p_request, p_month)`), antes do `obs_archive_request_finish`. Cada chamada é uma instrução curta (um mês, os canais do pedido) | Mantém cada instrução bem abaixo do `statement_timeout`; a medida local está na Tarefa 6, Passo 7 |
| D14 | **Respondedor: orçamento interno 780 s** (13 min), abaixo dos 15 min de execução e dos 3 min de arrendamento renovados a cada 30 s ou a cada 50 arquivos; passou do orçamento → `fail grande_demais` | `02` §10.6; a medida da Tarefa 13 decide se o teto de arquivos baixa |
| D15 | **"O primeiro sai em dd/mm/aaaa"** = 1º dia do mês `primeiro_mes_com_linha + janela_da_politica + 1` (classe `serie`, janela 6 de `obs_archive_policy`), calculado por `obs_archive_request_preview`. NÃO VERIFICADO contra a regra do destaque de partição (etapa que destaca, não a M7); remessa ao Logan e a Phil | Mockup: "O primeiro sai em 01/02/2027" com coleta desde ago/2026 e janela 6 |
| D16 | **Frase do `inesperado`** (o `04` não tem): "A casa encontrou um erro ao montar o relatório. Nada foi perdido." + `PODE`. Remessa ao Logan antes da Tarefa 10 | Estado alcançável sem frase aprovada |
| D17 | **Botão só para quem edita**, só com ao menos um mês da classe `serie` destacado (`detached_at` não nulo) para o canal; sem nenhum, a tira mostra a frase de `semArquivo` sem botão; quem só lê vê só "dd/mm a dd/mm/aaaa no arquivo." | Mockup, nota do quadro `a-nada` e linha 172 de `peca6.js` |
| D18 | **Polling da tela a cada 10 s** enquanto o pedido está `pending` ou `running` e a aba está visível (`document.visibilityState`); para no estado final | 180 chamadas no máximo por pedido de 15 min; nada de polling com a aba escondida |
| D19 | **Claim a cada 15 s custa ~5.760 chamadas por dia** à Vercel (cada uma uma função SQL curta com `skip locked`). Com `503 arquivo_desligado` o respondedor espera `ARQ_RESP_PAUSA_DESLIGADO_S` (300 s) | Custo declarado a Phil; o spec fixa 15 s |

---

## Contrato das rotas do pedido (r1; cópia em `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md`)

**R0. Regras comuns.** Herda o C0 da M3b inteiro: só `X-Pipeline-Key`; permissão exata `archive_read`; ordem das recusas chave → permissão → `OBS_ARQUIVO` (`503 arquivo_desligado`) → Zod (`400 VALIDATION_ERROR`) → regra; 100 req/min; envelope `{data}` / `{error: {code, message, details}}`; `500 erro_do_banco` com Sentry; `504 tempo_esgotado` em `57014`; `Cache-Control: no-store` em toda resposta. Todo corpo de pedido leva `pedido_id` (uuid) e `token` (uuid devolvido no claim; muda a cada claim). Códigos novos em `STATUS_DO_CODIGO`: `pedido_cancelado: 409`, `pedido_vencido: 409`, `pedido_de_outro: 409` (token não confere), `medida_fora_da_lista: 422`, `resposta_fora_da_lista: 422` (arquivo que o claim não listou), `grande_demais: 413` (já existe).

**R1. `POST request/claim`** — corpo `{versao: 1, hora_maquina: ISO}`.
- Sem pedido: `200 {data: {pedido: null}}`.
- Com pedido: `200 {data: {pedido: {id, token, tipo: 'relatorio'|'ensaio', prazo: ISO (deadline_at), arrendamento_ate: ISO, tentativa: 1|2, total: N, arquivos: [{arquivo_id: 's:<uuid>:canal', classe, filho, caminho, canal, mes: 'AAAA-MM', versao, sha256, bytes}]}}}`. `total` = `arquivos.length` calculado no banco; o respondedor recusa (`fail inesperado`) se diferir. Lista ordenada por (mês desc, canal). O claim só lista resumos `.canal` das classes das medidas pedidas (v1: `serie`; tipo `ensaio`: só `ensaio`), sem `purged_at`, sem `lost_at`, sem `superseded_at`, não vazios.

**R2. `POST request/progress`** — corpo `{pedido_id, token, lidos: int ≥ 0, total: int ≥ 1}`. `200 {data: {arrendamento_ate}}`; `409 pedido_cancelado`, `409 pedido_vencido`, `409 pedido_de_outro`. Renova o arrendamento por 3 min, nunca além de `deadline_at`.

**R3. `POST request/result`** — corpo `{pedido_id, token, lidos: [{arquivo_id, linhas: [[...14 colunas .canal em texto ou null]]}], falhas: [{arquivo_id, motivo: 'ausente'|'divergente'|'nas_fora'|'ilegivel'}]}`. Cada `arquivo_id` do claim aparece **exatamente uma vez** em `lidos` ou em `falhas`; faltando ou sobrando: `422 resposta_fora_da_lista`. Corpo limitado a 4 MB (Vercel aceita 4,5 MB). Resposta `200 {data: {estado: 'completo'|'incompleto'|'devolvido'}}` (`devolvido` = voltou a `pending` porque um resumo foi purgado depois do claim). O site nunca devolve o esperado.

**R4. `POST request/fail`** — corpo `{pedido_id, token, motivo: 'nas_fora'|'grande_demais'|'inesperado', detalhe?: string ≤ 200}`. `200 {data: {estado: 'failed'}}`.

**R5. Heartbeat.** O respondedor usa a rota `heartbeat` da M3b (C8) com `archive_read`, no máximo uma vez por minuto (o site limita a 30 s); `last_poll_at` do trabalhador `respondedor` é o "Último sinal" da tela.

---

## Estrutura de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts` (criar) | 1 | medidas, tetos, motivos, esquemas Zod de corpo e resposta das quatro rotas, impressão do pedido |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts` (modificar) | 1 | cinco códigos novos em `STATUS_DO_CODIGO` |
| `apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts` (criar) | 1 | contrato puro |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-tela.ts` (criar) | 2 | estado da tela a partir da leitura (15 estados), frases exatas da peça 6 |
| `apps/web/test/youtube/observatorio/arquivo-mensal-pedido-tela.test.ts` (criar) | 2 | cada estado com a sua frase |
| `supabase/rascunhos/m7.sql` (criar) | 3–7 | o SQL da etapa até a migration |
| `apps/web/test/helpers/m7.ts` (criar) | 3 | `M7_SQL_CAMINHO`, `M7_EM_MIGRATION`, `aplicarM7(c)`, `semearPedido` |
| `apps/web/test/manutencao/m7-trava.test.ts` (criar) | 3 | TRAVA M7-1 e M7-2 |
| `apps/web/test/integration/manutencao-m7-fila.test.ts` (criar) | 3–5 | tabelas, criar, cancelar, estado, claim, progresso, falha |
| `apps/web/test/integration/manutencao-m7-resultado.test.ts` (criar) | 6 | resultado, online parcial, teto, expulsão, extração do cálculo |
| `apps/web/test/integration/manutencao-m7-remocao-poda.test.ts` (criar) | 7 | gatilho `apagar`, vigia 5, poda, lista fechada |
| `apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts` (modificar) | 7 | pares novos |
| `apps/web/src/app/api/pipeline/archive/request/{claim,progress,result,fail}/route.ts` (criar) | 8 | as quatro rotas |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco.ts` (criar) | 8 | leitura das RPCs com Zod, montagem do resultado |
| `apps/web/test/app/api/pipeline/archive-request.test.ts` (criar) | 8 | rotas com `rpc` falso |
| `apps/web/src/lib/pipeline/api-registry.ts`, `apps/web/data/pipeline-docs/cowork-docs-archive.md`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/test/lib/pipeline/mcp-registry-sync.test.ts` (modificar) | 8 | integridade do pipeline |
| `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/ver-antigo-actions.ts` (criar) | 9 | server actions `lerVerAntigo`, `pedirVerAntigo`, `cancelarVerAntigo` |
| `apps/web/test/cms/ver-antigo-actions.test.ts` (criar) | 9 | permissão e mapeamento |
| `apps/web/src/app/cms/(authed)/youtube/competitors/canal/_canal/ver-antigo.tsx` (criar), `canal-screen.tsx`, `canal/[id]/page.tsx` (modificar) | 10 | o painel e a ligação |
| `apps/web/test/cms/ver-antigo.test.tsx` (criar) | 10 | item 105 |
| `~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py` (criar) | 11 | o respondedor |
| `~/Workspace/forja/ferramentas/arquivo/teste_respondedor.py` (criar), `falsos.py`, `comum.py`, `teste_tudo.sh` (modificar) | 11 | testes, falso do site, `config('respondedor')` |
| `~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service`, `respondedor.env.modelo` (criar), `pulso_arquivo.py`, `teste_pulso_arquivo.py` (modificar) | 12 | serviço e vigilância |
| `~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py`, `teste_medir_respondedor.py` (criar) | 13 | gerador de resumos sintéticos e cronômetro |
| `supabase/migrations/<ts>_manutencao_m7_periodo_longo.sql` (criar por `db:new`) | 14 | a migration |
| `docs/ops/runbook-arquivo-mensal.md` (modificar) | 16 | consultas 5 e 6, ligar e desligar o respondedor |
| `.superpowers/sdd/manutencao-nas/m7/*.sh` (criar, fora do git) | 13, 15, 16 | arquivos de comandos do dono |

---

### Tarefa 0: leituras, ledger e conferências

**Files:**
- Create: `.superpowers/sdd/manutencao-nas/m7-progresso.md` (fora do git)

- [ ] **Passo 1. Ledger.** Criar com as seções "Travas", "Medidas", "Remessas ao Logan", "Desvios declarados" e "NÃO VERIFICADO". Copiar para "Desvios declarados" as decisões D2, D4, D9, D10, D11, D15 e D16.
- [ ] **Passo 2. Estado da M3b.** Rodar e anotar a saída:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git ls-files apps/web/test/helpers/m3b.ts supabase/rascunhos/m3b.sql apps/web/src/lib/pipeline/archive-auth.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
ls supabase/migrations | grep _manutencao_m3b_ || echo "M3b ainda em rascunho"
grep -n "TRAVA M3b-2 solta" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md || echo "M3b fora de produção"
```

Esperado hoje: só os dois primeiros listados; "M3b ainda em rascunho"; "M3b fora de produção". `archive-auth.ts` e `contrato.ts` nascem na M3b (Tarefas 1 e 11 dela). **Sem `contrato.ts`, a Tarefa 1 desta etapa espera** (ela modifica o arquivo); a Tarefa 2 não depende dele.
- [ ] **Passo 3. Âncora da tela.** `grep -rn "Views por dia\|views por dia\|ViewsPorDia" apps/web/src/app/cms/\(authed\)/youtube/competitors/canal/`. Achando, anotar arquivo e linha (o painel vai logo abaixo). Não achando (o que a leitura de 14/10 indicou), a peça entra abaixo do cabeçalho do canal e o desvio vai como remessa ao Logan no ledger; se a M5 estiver criando o gráfico, a tira segue o gráfico quando ele chegar.
- [ ] **Passo 4. Leitura de produção não é preciso.** Nenhuma consulta ao banco de produção nesta etapa antes da Tarefa 14.

---

### Tarefa 1: contrato do pedido (TypeScript puro)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts` (bloco `STATUS_DO_CODIGO`)
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts`
- Create (fora do git): `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md` (cópia da seção "Contrato das rotas do pedido")

**Interfaces:**
- Consumes: `STATUS_DO_CODIGO`, `CLASSES` de `contrato.ts` (M3b Tarefa 1).
- Produces: `MEDIDAS_V1`, `type Medida`, `ESCOLHAS_DE_MESES`, `type EscolhaDeMeses`, `TETO_MESES`, `TETO_ARQUIVOS`, `TETO_CARGA_BYTES`, `TETO_TOTAL_RESULTADOS_BYTES`, `TETO_CORPO_RESULTADO_BYTES`, `COLUNAS_CANAL`, `MOTIVOS_DO_ARQUIVO`, `MOTIVOS_DO_PEDIDO`, `CorpoClaim`, `RespostaClaim`, `ArquivoDoPedido`, `CorpoProgresso`, `CorpoResultado`, `CorpoFalha`, `mesesDaEscolha`, `impressaoDoPedido`. Consumido pelas Tarefas 2, 8, 9, 10 e, como texto, pelo respondedor.

**O que acontece quando o dado não existe:** claim sem pedido é `{pedido: null}` (nunca lista vazia com id); `arquivos: []` com `total: 0` é recusado pelo esquema (`min(1)`): pedido sem arquivo nenhum não vai à forja (a função de criação o fecha sozinha, Tarefa 4); medida desconhecida é recusada pelo enum, nunca ignorada.

- [ ] **Passo 1. `git diff --stat -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts`** vazio (regra do Global Constraints).
- [ ] **Passo 2. Teste, falhando.**

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  CorpoClaim, RespostaClaim, CorpoResultado, CorpoFalha, CorpoProgresso, MEDIDAS_V1, TETO_MESES,
  mesesDaEscolha, impressaoDoPedido, COLUNAS_CANAL,
} from '@/lib/youtube/observatorio/arquivo-mensal/pedido'
import { STATUS_DO_CODIGO } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'

const ID = '11111111-1111-4111-8111-111111111111'
const CANAL = '22222222-2222-4222-8222-222222222222'
const arquivo = (mes: string) => ({
  arquivo_id: `s:${ID}:canal`, classe: 'serie', filho: 'numerico',
  caminho: `serie/canais/${CANAL}/resumo/${mes}.v1.canal.csv.gz`, canal: CANAL, mes, versao: 1,
  sha256: 'a'.repeat(64), bytes: 300,
})

describe('contrato do pedido (M7)', () => {
  it('medidas v1 são a lista fechada; ficha_do_video fica de fora (P22 é da M10b)', () => {
    expect(MEDIDAS_V1).toEqual(['linhas', 'videos_com_linha', 'dias_medidos', 'dias_do_mes', 'var_views', 'var_likes', 'var_comments'])
    expect(MEDIDAS_V1).not.toContain('ficha_do_video')
  })
  it('claim sem pedido é null, nunca lista vazia', () => {
    expect(RespostaClaim.safeParse({ pedido: null }).success).toBe(true)
    const vazio = { pedido: { id: ID, token: ID, tipo: 'relatorio', prazo: '2027-03-01T10:15:00Z', arrendamento_ate: '2027-03-01T10:03:00Z', tentativa: 1, total: 0, arquivos: [] } }
    expect(RespostaClaim.safeParse(vazio).success).toBe(false)
  })
  it('claim aceita 1.001 arquivos e recusa caminho fora do resumo .canal (item 104)', () => {
    const lista = Array.from({ length: 1001 }, () => arquivo('2027-01'))
    const ok = RespostaClaim.safeParse({ pedido: { id: ID, token: ID, tipo: 'relatorio', prazo: '2027-03-01T10:15:00Z', arrendamento_ate: '2027-03-01T10:03:00Z', tentativa: 1, total: 1001, arquivos: lista } })
    expect(ok.success).toBe(true)
    const video = { ...arquivo('2027-01'), caminho: `serie/canais/${CANAL}/resumo/2027-01.v1.video.csv.gz` }
    expect(RespostaClaim.safeParse({ pedido: { id: ID, token: ID, tipo: 'relatorio', prazo: '2027-03-01T10:15:00Z', arrendamento_ate: '2027-03-01T10:03:00Z', tentativa: 1, total: 1, arquivos: [video] } }).success).toBe(false)
  })
  it('resultado: linha com 14 colunas; nenhuma coluna de comentário existe', () => {
    expect(COLUNAS_CANAL).toHaveLength(14)
    expect(COLUNAS_CANAL.join(',')).not.toMatch(/comment_id|texto|autor/)
    const linha = [CANAL, 'competitor_video_daily', '2027-01', '50', '1500', '31', '31', 'x', 'y', '100', '10', '1', 'h'.repeat(64), '1']
    expect(CorpoResultado.safeParse({ pedido_id: ID, token: ID, lidos: [{ arquivo_id: `s:${ID}:canal`, linhas: [linha] }], falhas: [] }).success).toBe(true)
    expect(CorpoResultado.safeParse({ pedido_id: ID, token: ID, lidos: [{ arquivo_id: `s:${ID}:canal`, linhas: [linha.slice(0, 13)] }], falhas: [] }).success).toBe(false)
  })
  it('falha só com motivo da lista', () => {
    expect(CorpoFalha.safeParse({ pedido_id: ID, token: ID, motivo: 'nas_fora' }).success).toBe(true)
    expect(CorpoFalha.safeParse({ pedido_id: ID, token: ID, motivo: 'arquivo_ausente' }).success).toBe(false)   // por arquivo vai no result (D3)
    expect(CorpoProgresso.safeParse({ pedido_id: ID, token: ID, lidos: 3, total: 2 }).success).toBe(false)
  })
  it('meses da escolha: N meses que terminam no mês corrente; Tudo acima de 36 é grande demais', () => {
    expect(mesesDaEscolha('12', '2027-05', '2024-03')).toHaveLength(12)
    expect(mesesDaEscolha('12', '2027-05', '2024-03')[0]).toBe('2027-05')
    expect(mesesDaEscolha('tudo', '2027-05', '2026-08')).toHaveLength(10)
    expect(() => mesesDaEscolha('tudo', '2028-05', '2024-03')).toThrow('grande_demais')
    expect(TETO_MESES).toBe(36)
  })
  it('impressão independe da ordem dos canais e das medidas (item 53)', () => {
    const a = impressaoDoPedido({ tipo: 'relatorio', canais: [CANAL, ID], meses: ['2027-01'], medidas: ['var_views', 'linhas'] })
    const b = impressaoDoPedido({ tipo: 'relatorio', canais: [ID, CANAL], meses: ['2027-01'], medidas: ['linhas', 'var_views'] })
    expect(a).toBe(b)
  })
  it('códigos novos com o status do contrato R0', () => {
    expect(STATUS_DO_CODIGO.pedido_cancelado).toBe(409)
    expect(STATUS_DO_CODIGO.pedido_vencido).toBe(409)
    expect(STATUS_DO_CODIGO.pedido_de_outro).toBe(409)
    expect(STATUS_DO_CODIGO.medida_fora_da_lista).toBe(422)
    expect(STATUS_DO_CODIGO.resposta_fora_da_lista).toBe(422)
  })
})
```

Rodar `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-mensal-pedido.test.ts > /tmp/m7-t1.txt 2>&1; grep -E "FAIL|✓|×" /tmp/m7-t1.txt | head` — falha por módulo ausente.
- [ ] **Passo 3. `pedido.ts`.**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts
/** M7 (spec 02 §10.6): o contrato do pedido de período longo. Puro; o respondedor o lê como texto (contrato-rotas-m7.md). */
import { z } from 'zod'
import { createHash } from 'node:crypto'

export const MEDIDAS_V1 = ['linhas', 'videos_com_linha', 'dias_medidos', 'dias_do_mes', 'var_views', 'var_likes', 'var_comments'] as const
export type Medida = (typeof MEDIDAS_V1)[number]
export const ESCOLHAS_DE_MESES = ['12', '24', '36', 'tudo'] as const
export type EscolhaDeMeses = (typeof ESCOLHAS_DE_MESES)[number]
export const TETO_MESES = 36
/** D8: até a medida da Tarefa 13 (75 canais × 36 meses). Mudou na medida: mudar aqui e no SQL (obs_archive_request_limits). */
export const TETO_ARQUIVOS = 2700
export const TETO_CARGA_BYTES = 512 * 1024
export const TETO_TOTAL_RESULTADOS_BYTES = 8 * 1024 * 1024
export const TETO_CORPO_RESULTADO_BYTES = 4 * 1024 * 1024
/** As colunas do resumo .canal (M3b, obs_archive_summary_rows), na ordem do CSV. Nenhuma de comentário (02 §11.2). */
export const COLUNAS_CANAL = ['canal', 'tabela', 'mes', 'videos_com_linha', 'linhas', 'dias_medidos', 'dias_do_mes', 'primeira_leitura',
  'ultima_leitura', 'var_views', 'var_likes', 'var_comments', 'hash_conteudo_unidade', 'versao_resumo'] as const
export const MOTIVOS_DO_ARQUIVO = ['ausente', 'divergente', 'nas_fora', 'ilegivel'] as const
export const MOTIVOS_DO_PEDIDO = ['nas_fora', 'grande_demais', 'inesperado'] as const

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
const mes = z.string().regex(/^20[2-9][0-9]-(0[1-9]|1[0-2])$/)
const iso = z.string().datetime({ offset: true })
const RE_CAMINHO = /^(serie|ensaio)\/canais\/[0-9a-f-]{36}\/resumo\/20[2-9][0-9]-(0[1-9]|1[0-2])\.v[1-9][0-9]*\.canal\.csv\.gz$/

export const ArquivoDoPedido = z.object({
  arquivo_id: z.string().regex(/^s:[0-9a-f-]{36}:canal$/), classe: z.enum(['serie', 'ensaio']), filho: z.literal('numerico'),
  caminho: z.string().regex(RE_CAMINHO), canal: uuid, mes, versao: z.number().int().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().min(1),
}).strict()
export const CorpoClaim = z.object({ versao: z.literal(1), hora_maquina: iso }).strict()
export const RespostaClaim = z.object({
  pedido: z.object({
    id: uuid, token: uuid, tipo: z.enum(['relatorio', 'ensaio']), prazo: iso, arrendamento_ate: iso,
    tentativa: z.union([z.literal(1), z.literal(2)]), total: z.number().int().min(1).max(20000),
    arquivos: z.array(ArquivoDoPedido).min(1).max(20000),
  }).strict().refine(p => p.total === p.arquivos.length, { message: 'total difere da lista' }).nullable(),
}).strict()
export const CorpoProgresso = z.object({ pedido_id: uuid, token: uuid, lidos: z.number().int().min(0), total: z.number().int().min(1) })
  .strict().refine(p => p.lidos <= p.total, { message: 'lidos acima do total' })
const celula = z.string().max(200).nullable()
export const CorpoResultado = z.object({
  pedido_id: uuid, token: uuid,
  lidos: z.array(z.object({ arquivo_id: z.string().regex(/^s:[0-9a-f-]{36}:canal$/), linhas: z.array(z.array(celula).length(COLUNAS_CANAL.length)).max(50) }).strict()).max(20000),
  falhas: z.array(z.object({ arquivo_id: z.string().regex(/^s:[0-9a-f-]{36}:canal$/), motivo: z.enum(MOTIVOS_DO_ARQUIVO) }).strict()).max(20000),
}).strict()
export const CorpoFalha = z.object({ pedido_id: uuid, token: uuid, motivo: z.enum(MOTIVOS_DO_PEDIDO), detalhe: z.string().max(200).optional() }).strict()

function somaMes(m: string, delta: number): string {
  const [a, b] = m.split('-').map(Number)
  const t = a * 12 + (b - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
/** D8: os N meses de calendário que terminam em `mesCorrente` (São Paulo), do mais recente ao mais antigo. */
export function mesesDaEscolha(e: EscolhaDeMeses, mesCorrente: string, primeiroMes: string): string[] {
  const [a1, m1] = mesCorrente.split('-').map(Number); const [a0, m0] = primeiroMes.split('-').map(Number)
  const n = e === 'tudo' ? (a1 * 12 + m1) - (a0 * 12 + m0) + 1 : Number(e)
  if (n > TETO_MESES) throw new Error('grande_demais')
  return Array.from({ length: Math.max(n, 0) }, (_, i) => somaMes(mesCorrente, -i))
}
/** D7: igual à do SQL (obs_archive_request_fingerprint): md5 de tipo|canais ordenados|meses ordenados|medidas ordenadas. */
export function impressaoDoPedido(p: { tipo: 'relatorio' | 'ensaio'; canais: string[] | null; meses: string[]; medidas: string[] }): string {
  const t = [p.tipo, p.canais ? [...p.canais].sort().join(',') : '*', [...p.meses].sort().join(','), [...p.medidas].sort().join(',')].join('|')
  return createHash('md5').update(t).digest('hex')
}
```

- [ ] **Passo 4. `contrato.ts`:** acrescentar ao objeto `STATUS_DO_CODIGO`, depois de `tabela_ausente`:

```ts
  // M7 (contrato do pedido, R0)
  pedido_cancelado: 409, pedido_vencido: 409, pedido_de_outro: 409, medida_fora_da_lista: 422, resposta_fora_da_lista: 422,
```

- [ ] **Passo 5.** Rodar o teste do Passo 2 (passa) e `npx vitest run test/youtube/observatorio/arquivo-mensal` (os da M3b continuam passando). `npm run typecheck -w apps/web > /tmp/m7-tc.txt 2>&1; tail -3 /tmp/m7-tc.txt`.
- [ ] **Passo 6. Contrato no disco** (fora do git): copiar a seção "Contrato das rotas do pedido" deste plano para `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md`.
- [ ] **Passo 7. Commit.**

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts
git commit -m "feat: M7: contrato do pedido de período longo (medidas v1, tetos, esquemas das quatro rotas)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
```

---

### Tarefa 2: estado da tela e frases da peça 6 (TypeScript puro)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-tela.ts`
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-pedido-tela.test.ts`

**Interfaces:**
- Produces: `type LeituraDoPedido` (o JSON de `obs_archive_request_read`, Tarefa 4), `LeituraDoPedidoZ`, `type EstadoDaTela` (união de 15 + `inesperado`), `estadoDaTela(l: LeituraDoPedido | null, agora: Date, euId: string, o?: { reaberto?: boolean }): EstadoDaTela`, `FRASES` (por estado: `lead`, `sub`), `PODE`, `fraseAntes(...)`, `fraseLidos(...)`, `fraseIncompleto(...)`, `formaDoAviso(ultimoSinal, agora): 'triangulo'|'octogono'`. Consumido pela Tarefa 10.

**O que acontece quando o dado não existe:** leitura `null` (RPC falhou ou fora do esquema) → `nao_medido` ("Não foi possível ler o estado do pedido."), nunca "antes de pedir"; sem mês destacado → `sem_arquivo`; `OBS_ARQUIVO` desligado → `desligado`; heartbeat do respondedor nunca gravado → "Último sinal: nunca" e octógono (o site nunca ouviu a casa).

- [ ] **Passo 1. Teste, falhando.** Uma linha de tabela por estado, com a frase exata do `peca6.js` (copiar o texto do arquivo aprovado, não deste plano, se divergirem):

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-pedido-tela.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoDaTela, FRASES, PODE, fraseAntes, fraseIncompleto, formaDoAviso, type LeituraDoPedido } from '@/lib/youtube/observatorio/arquivo-mensal/pedido-tela'

const EU = '33333333-3333-4333-8333-333333333333'
const AGORA = new Date('2028-05-03T17:40:00Z')
const base: LeituraDoPedido = {
  arquivo_ligado: true, meses_no_arquivo: 7, primeiro_sai_em: null, ultimo_sinal: '2028-05-03T17:39:00Z',
  previa: { '12': { online: 5, arquivo: 7, total: 12 }, '24': { online: 5, arquivo: 19, total: 24 }, '36': { online: 5, arquivo: 31, total: 36 }, tudo: { online: 5, arquivo: 45, total: 50 } },
  pedido: null, resultado: null,
}
const pedido = (o: Partial<NonNullable<LeituraDoPedido['pedido']>>) => ({
  id: 'p', status: 'pending', status_efetivo: 'pending', fail_reason: null, requested_by: EU, requested_at: '2028-05-03T17:32:00Z',
  progress_done: 0, progress_total: 12, cancelled_at: null, finished_at: null, ...o,
}) as NonNullable<LeituraDoPedido['pedido']>

describe('peça 6: estado e frase (item 105)', () => {
  it.each([
    ['desligado', { ...base, arquivo_ligado: false }, 'O arquivo está desligado neste site. Nada foi pedido.'],
    ['sem_arquivo', { ...base, meses_no_arquivo: 0, primeiro_sai_em: '2027-02-01' }, 'Ainda não há mês no arquivo. O primeiro sai em 01/02/2027.'],
    ['nao_medido', null, 'Não foi possível ler o estado do pedido.'],
    ['enviado', { ...base, pedido: pedido({}) }, 'Pedido feito às 14:32. Aguardando a casa.'],
    ['cancelado', { ...base, pedido: pedido({ status: 'cancelled', status_efetivo: 'cancelled', cancelled_at: '2028-05-03T17:36:00Z' }) }, 'Pedido cancelado às 14:36.'],
    ['nao_respondeu', { ...base, pedido: pedido({ status_efetivo: 'expired', fail_reason: 'sem_trabalhador' }) }, 'A casa não respondeu em 15 minutos. O pedido venceu e nada foi perdido.'],
    ['nas_fora', { ...base, pedido: pedido({ status: 'failed', status_efetivo: 'failed', fail_reason: 'nas_fora' }) }, 'A forja respondeu, mas o NAS não está acessível.'],
    ['grande', { ...base, pedido: pedido({ status: 'failed', status_efetivo: 'failed', fail_reason: 'grande_demais' }) }, 'O período pedido passa do tamanho que o site guarda. Peça menos meses.'],
  ] as const)('%s', (estado, leitura, frase) => {
    const e = estadoDaTela(leitura as LeituraDoPedido | null, AGORA, EU)
    expect(e.tipo).toBe(estado)
    expect(e.lead).toBe(frase)
  })
  it('em andamento de outro editor é "repetido", meu ao reabrir diz "Há um pedido seu"', () => {
    const outro = estadoDaTela({ ...base, pedido: pedido({ status: 'running', status_efetivo: 'running', requested_by: 'outro', progress_done: 9 }) }, AGORA, EU)
    expect(outro.tipo).toBe('repetido')
    const meu = estadoDaTela({ ...base, pedido: pedido({ status: 'running', status_efetivo: 'running', progress_done: 9 }) }, AGORA, EU, { reaberto: true })
    expect(meu.tipo).toBe('andamento')
    expect(meu.lead).toBe('Há um pedido seu em andamento desde 14:32. Pode fechar esta página: o resultado fica aqui por 30 dias.')
  })
  it('venceu o resultado (30 dias) e incompleto nunca diz zero', () => {
    const r = { gerado_em: '2028-04-01T17:34:00Z', vale_ate: '2028-05-01T17:34:00Z', estado: 'completo' as const, meses: [] }
    expect(estadoDaTela({ ...base, pedido: pedido({ status: 'done', status_efetivo: 'done' }), resultado: r }, AGORA, EU).lead).toBe('O resultado de 01/04 venceu. Peça de novo.')
    expect(fraseIncompleto(['agosto de 2027', 'setembro de 2027'], 12, 'nas_fora')).toBe('Faltam 2 de 12 meses: agosto e setembro de 2027, porque o NAS deixou de responder durante a leitura.')
  })
  it('frase de antes de pedir e Tudo acima de 36', () => {
    expect(fraseAntes('12', base.previa, 'Canal X')).toBe('Vai ler 12 meses de Canal X: 5 estão online, 7 no arquivo.')
    expect(fraseAntes('tudo', base.previa, 'Canal X')).toBe('Tudo passa do que o site guarda (50 meses). Escolha até 36 meses.')
  })
  it('aviso: triângulo até 36 h sem sinal, octógono depois; nunca ouvido é octógono', () => {
    expect(formaDoAviso('2028-05-02T06:00:00Z', AGORA)).toBe('triangulo')
    expect(formaDoAviso('2028-05-01T05:00:00Z', AGORA)).toBe('octogono')
    expect(formaDoAviso(null, AGORA)).toBe('octogono')
  })
  it('PODE é a frase do mockup', () => {
    expect(PODE).toBe('Pode esperar. Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo.')
    expect(FRASES.inesperado.lead).toBe('A casa encontrou um erro ao montar o relatório. Nada foi perdido.')   // D16: remessa ao Logan
  })
})
```

- [ ] **Passo 2. `pedido-tela.ts`.** Horas e datas sempre em `America/Sao_Paulo` (`Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })`). Estrutura:

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-tela.ts
/** M7, peça 6 (spec 04 §14.6; mockup 19, peca6.js aprovado em 14/10): do JSON de obs_archive_request_read ao estado e à frase. Puro. */
import { z } from 'zod'

export const PODE = 'Pode esperar. Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo.'
const previaZ = z.object({ online: z.number().int().min(0), arquivo: z.number().int().min(0), total: z.number().int().min(0) }).strict()
const mesZ = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/), estado: z.enum(['ok', 'parcial', 'vazio_conferido', 'faltou']),
  origem: z.enum(['nas', 'banco_sem_copia']).nullable(), dias_medidos: z.number().int().nullable(), dias_do_mes: z.number().int().nullable(),
  views: z.string().nullable(), conferido_em: z.string().nullable(), motivo: z.enum(['ausente', 'divergente', 'nas_fora', 'ilegivel']).nullable(),
}).strict()
export const LeituraDoPedidoZ = z.object({
  arquivo_ligado: z.boolean(), meses_no_arquivo: z.number().int().min(0), primeiro_sai_em: z.string().nullable(), ultimo_sinal: z.string().nullable(),
  previa: z.object({ '12': previaZ, '24': previaZ, '36': previaZ, tudo: previaZ }).strict(),
  pedido: z.object({
    id: z.string(), status: z.enum(['pending', 'running', 'done', 'failed', 'expired', 'cancelled']),
    status_efetivo: z.enum(['pending', 'running', 'done', 'failed', 'expired', 'cancelled']),
    fail_reason: z.enum(['sem_trabalhador', 'nas_fora', 'arquivo_ausente', 'divergente', 'grande_demais', 'inesperado']).nullable(),
    requested_by: z.string(), requested_at: z.string(), progress_done: z.number().int().min(0), progress_total: z.number().int().min(0),
    cancelled_at: z.string().nullable(), finished_at: z.string().nullable(),
  }).strict().nullable(),
  resultado: z.object({ gerado_em: z.string(), vale_ate: z.string(), estado: z.enum(['completo', 'incompleto']), meses: z.array(mesZ) }).strict().nullable(),
}).strict()
export type LeituraDoPedido = z.infer<typeof LeituraDoPedidoZ>
export type TipoDoEstado = 'antes' | 'sem_arquivo' | 'desligado' | 'enviado' | 'andamento' | 'pronto' | 'venceu' | 'incompleto'
  | 'bate' | 'nao_respondeu' | 'nas_fora' | 'grande' | 'repetido' | 'cancelado' | 'nao_medido' | 'inesperado'
export interface EstadoDaTela { tipo: TipoDoEstado; lead: string; sub: string | null; alerta: boolean; podeCancelar: boolean; podePedir: boolean }

export const FRASES = {
  desligado: { lead: 'O arquivo está desligado neste site. Nada foi pedido.', sub: 'Quem administra o site liga o arquivo; até lá, tudo o que está online continua nas telas.' },
  nao_medido: { lead: 'Não foi possível ler o estado do pedido.', sub: 'O site não conseguiu ler o próprio registro do pedido. Ele pode ter sido feito. Abra a página de novo em alguns minutos.' },
  nas_fora: { lead: 'A forja respondeu, mas o NAS não está acessível.', sub: `Nada foi perdido. ${PODE}` },
  grande: { lead: 'O período pedido passa do tamanho que o site guarda. Peça menos meses.', sub: 'O limite deste site é de 36 meses. Escolha um período menor.' },
  inesperado: { lead: 'A casa encontrou um erro ao montar o relatório. Nada foi perdido.', sub: PODE },
} as const
// … hora(), data(), mesPorExtenso() com Intl em America/Sao_Paulo; estadoDaTela segue a ordem:
// null → nao_medido; !arquivo_ligado → desligado; meses_no_arquivo = 0 → sem_arquivo;
// pedido ativo de outro → repetido; pending → enviado; running → andamento (reaberto muda o lead);
// cancelled → cancelado; expired → nao_respondeu (sub: "Último sinal: dd/mm hh:mm. " + PODE, ou "Último sinal: nunca. ");
// failed → nas_fora | grande | inesperado; done + resultado vencido (vale_ate < agora) → venceu;
// done + algum mês 'faltou' com motivo divergente → bate; com outro motivo → incompleto; senão pronto; sem pedido → antes.
```

O corpo completo das funções segue o `peca6.js` linha por linha (funções `fraseDe`, `lidos`, `pronto`, `incompleto`, `bate`); em `bate`, o texto "peça ao Claude Code para conferir <mês>" vem do mockup sem mudança.
- [ ] **Passo 3.** Teste passa; `npm run typecheck -w apps/web`.
- [ ] **Passo 4. Commit** `feat: M7: estado e frases da peça 6 (puro, frases do mockup aprovado)` por caminho, os dois arquivos com `git add --` antes.

---

### Tarefa 3: SQL parte 1, tabelas e trava

**Files:**
- Create: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/helpers/m7.ts`
- Create: `apps/web/test/manutencao/m7-trava.test.ts`
- Create: `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces: tabelas `obs_archive_requests`, `obs_archive_results`; helper `aplicarM7(c: pg.Client)` (aplica `aplicarM3b` e depois o rascunho da M7, dentro da transação do teste); `M7_SQL_CAMINHO`, `M7_EM_MIGRATION`.

**O que acontece quando o dado não existe:** sem a M3b aplicada (`to_regclass('public.obs_archive_summaries') is null`), o rascunho falha no primeiro `create function` que a cita, alto; o helper sempre aplica a M3b antes.

- [ ] **Passo 1. Teste da trava, falhando.**

```ts
// apps/web/test/manutencao/m7-trava.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const migrou = readdirSync(join(RAIZ, 'supabase/migrations')).some(f => /_manutencao_m7_/.test(f))
const CANAL = join(RAIZ, 'apps/web/src/app/cms/(authed)/youtube/competitors/canal')

function arquivos(d: string): string[] {
  if (!existsSync(d)) return []
  return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? arquivos(join(d, e.name)) : [join(d, e.name)])
}

describe('TRAVA M7-1 e M7-2', () => {
  it.skipIf(migrou)('sem migration da M7: sem rotas request/* e sem chamada da fila na página do canal', () => {
    expect(existsSync(join(RAIZ, 'apps/web/src/app/api/pipeline/archive/request'))).toBe(false)
    expect(arquivos(CANAL).filter(f => readFileSync(f, 'utf8').includes('obs_archive_request'))).toEqual([])
  })
  it('o rascunho existe enquanto não houver migration', () => {
    expect(migrou || existsSync(join(RAIZ, 'supabase/rascunhos/m7.sql'))).toBe(true)
  })
})
```

- [ ] **Passo 2. Helper.**

```ts
// apps/web/test/helpers/m7.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Client } from 'pg'
import { aplicarM3b } from './m3b'

/** Até a Tarefa 14 da M7: o rascunho. Depois: o arquivo da migration (um só lugar). */
export const M7_EM_MIGRATION = false
export const M7_SQL_CAMINHO = fileURLToPath(new URL('../../../../supabase/rascunhos/m7.sql', import.meta.url))
export async function aplicarM7(c: Client): Promise<void> {
  await aplicarM3b(c)
  if (!M7_EM_MIGRATION) await c.query(readFileSync(M7_SQL_CAMINHO, 'utf8'))
}
```

- [ ] **Passo 3. Teste das tabelas, falhando.** Em `manutencao-m7-fila.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`, cliente `pg` em `postgresql://postgres:postgres@127.0.0.1:54422/postgres`, `begin` / `aplicarM7` / `rollback` em cada teste:
  - as duas tabelas existem, com RLS ligada (`relrowsecurity`), uma policy só (`select`, `can_edit_site`), e `has_table_privilege('service_role', 'public.obs_archive_requests', 'INSERT')` falso (idem `UPDATE`, `DELETE`, `TRUNCATE`);
  - `has_table_privilege('anon', ..., 'SELECT')` falso;
  - nenhuma FK (`select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.obs_archive_requests'::regclass, 'public.obs_archive_results'::regclass)` = 0);
  - `insert` de dois pedidos ativos com a mesma impressão (como dono da tabela, só neste teste) falha com `23505` (item 53, a parte do índice);
  - `payload_bytes` acima de 524.288 é recusado pelo `check`.
- [ ] **Passo 4. `supabase/rascunhos/m7.sql`, parte 1.**

```sql
-- M7 (fase de manutenção): período longo. Rascunho até a Tarefa 14 (TRAVA M7-1). Spec 02 §10.6.
create table if not exists public.obs_archive_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  kind text not null check (kind in ('relatorio', 'ensaio')),
  channel_refs text[],                       -- null = todos (ensaio, uso futuro); a tela pede sempre um
  resolved_channel_refs text[],              -- gravado no claim
  months_choice text not null check (months_choice in ('12', '24', '36', 'tudo')),
  months date[] not null check (cardinality(months) between 1 and 36),
  measures text[] not null,
  fingerprint text not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'expired', 'cancelled')),
  expires_at timestamptz not null,           -- requested_at + 15 min: nunca atendido = sem_trabalhador
  claim_token uuid,
  claimed_at timestamptz,
  deadline_at timestamptz,                   -- primeiro claim + 15 min
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 2),
  requeued_once boolean not null default false,
  claimed_files jsonb,                       -- a lista exata do claim (arquivo_id, summary id, versão): o result confere contra ela
  progress_done integer not null default 0,
  progress_total integer not null default 0,
  finished_at timestamptz,
  fail_reason text check (fail_reason in ('sem_trabalhador', 'nas_fora', 'arquivo_ausente', 'divergente', 'grande_demais', 'inesperado')),
  fail_detail text check (char_length(fail_detail) <= 200),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancelled_reason text check (cancelled_reason in ('dono', 'canal_apagado'))
);
create unique index if not exists obs_archive_requests_ativo_uq on public.obs_archive_requests (site_id, fingerprint) where status in ('pending', 'running');
create index if not exists obs_archive_requests_fila_idx on public.obs_archive_requests (requested_at) where status in ('pending', 'running');
create index if not exists obs_archive_requests_site_idx on public.obs_archive_requests (site_id, requested_at desc);

create table if not exists public.obs_archive_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,                  -- sem FK: a poda de pedidos (7 dias) não leva o resultado (30 dias)
  site_id uuid not null,
  channel_refs text[],                       -- null = todos: apagado por qualquer canal com 'apagar' (02 §10.6)
  payload jsonb not null,
  payload_bytes integer not null check (payload_bytes between 1 and 524288),
  coverage jsonb not null,
  state text not null check (state in ('completo', 'incompleto')),
  created_at timestamptz not null default now(),
  valid_until timestamptz not null
);
create unique index if not exists obs_archive_results_pedido_uq on public.obs_archive_results (request_id);
create index if not exists obs_archive_results_site_idx on public.obs_archive_results (site_id, created_at);

alter table public.obs_archive_requests enable row level security;
alter table public.obs_archive_results enable row level security;
drop policy if exists obs_archive_requests_ler on public.obs_archive_requests;
create policy obs_archive_requests_ler on public.obs_archive_requests for select using (public.can_edit_site(site_id));
drop policy if exists obs_archive_results_ler on public.obs_archive_results;
create policy obs_archive_results_ler on public.obs_archive_results for select using (public.can_edit_site(site_id));
revoke all on table public.obs_archive_requests, public.obs_archive_results from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.obs_archive_requests, public.obs_archive_results from service_role;
```

- [ ] **Passo 5.** `HAS_LOCAL_DB=1 npx vitest run test/manutencao/m7-trava.test.ts test/integration/manutencao-m7-fila.test.ts --no-file-parallelism > /tmp/m7-t3.txt 2>&1; grep -E "✓|×|FAIL" /tmp/m7-t3.txt` — passa.
- [ ] **Passo 6. Commit** `feat: M7: rascunho do SQL, tabelas da fila e do resultado, e a trava` (os quatro arquivos, `git add --` antes).

---

### Tarefa 4: SQL parte 2, criar, cancelar, ler

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Modify: `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces (todas `security definer`, `set search_path = ''`, `grant execute ... to service_role`):
  - `obs_archive_request_create(p_site uuid, p_kind text, p_channels text[], p_choice text, p_measures text[], p_by uuid) returns jsonb` → `{status: 'criado'|'repetido'|'nada_a_pedir', id, requested_at}`; recusa `medida_fora_da_lista`, `grande_demais`, `canal_removido`.
  - `obs_archive_request_cancel(p_site uuid, p_request uuid, p_by uuid) returns jsonb` → `{status: 'cancelado'|'ja_terminado', cancelled_at}`.
  - `obs_archive_request_state(r public.obs_archive_requests) returns jsonb` (interna: estado efetivo e motivo, D6; `revoke ... from service_role`).
  - `obs_archive_request_read(p_site uuid, p_channel text, p_ligado boolean) returns jsonb` (o JSON de `LeituraDoPedidoZ`, Tarefa 2; `p_ligado` vem de `arquivoLigado()` no servidor), com `obs_archive_request_preview` interna.
  - `obs_archive_request_limits() returns jsonb` (`{teto_meses: 36, teto_arquivos: 2700, carga: 524288, total: 8388608, validade_dias: 30}`; interna, uma fonte para todas).

**O que acontece quando o dado não existe:** canal sem nenhum mês no registro e sem linha na diária → `nada_a_pedir` (o pedido não nasce; a tela nem oferece o botão, D17); pedido cujos meses não têm resumo (todos não selados) nasce e é resolvido só pelo banco, sem ir à forja (o claim nunca o pega; o `finish` roda na criação: ver Passo 3); heartbeat ausente → `ultimo_sinal: null`.

- [ ] **Passo 1. Testes, falhando** (relógio por `obs_archive_agora()`, gancho da M3b: o teste o substitui por `create or replace` dentro da transação, como a M3b faz):

| Teste | Afirma |
|---|---|
| `item 53: clique duplo não cria dois ativos` | duas chamadas iguais seguidas: a 2ª devolve `repetido` com o mesmo `id`; `count(*) where status in ('pending','running')` = 1 |
| `item 53: pedido vencido não segura o índice` | 1º pedido com relógio +16 min: a 2ª chamada normaliza o vencido para `expired` e cria outro (`criado`, `id` novo) |
| `item 104: medida fora da lista é recusada` | `p_measures = '{ficha_do_video}'` → `P0001 medida_fora_da_lista`; `'{texto_do_comentario}'` idem |
| `D8: Tudo acima de 36 meses é grande_demais na criação` | canal com diária desde 40 meses atrás, `p_choice = 'tudo'` → `P0001 grande_demais` |
| `canal removido não é pedido` | linha em `obs_archive_channel_removals` → `P0001 canal_removido` |
| `nada a pedir` | canal sem registro e sem diária → `{status: 'nada_a_pedir'}`, nenhuma linha |
| `cancelar pendente e em andamento (D5)` | `cancelado`; `status = 'cancelled'`, `cancelled_reason = 'dono'`; cancelar `done` → `ja_terminado` sem mudar nada |
| `cancelar de outro site` | `p_site` diferente → `ja_terminado`, nada muda (não vaza existência) |
| `item 50: expirado em 15 min calculado na leitura` | relógio +15 min +1 s: `obs_archive_request_read` traz `status: 'pending'`, `status_efetivo: 'expired'`, `fail_reason: 'sem_trabalhador'`; a linha continua `pending` no disco |
| `leitura sem pedido e sem heartbeat` | `pedido: null`, `resultado: null`, `ultimo_sinal: null`, `previa` com as quatro escolhas |
| `primeiro_sai_em (D15)` | primeiro mês com linha 2026-08, janela 6 → `'2027-02-01'` |
| `permissão` | `has_function_privilege('service_role', 'public.obs_archive_request_create(uuid,text,text[],text,text[],uuid)', 'EXECUTE')` verdadeiro; `anon` e `authenticated` falsos; `obs_archive_request_state` falso para `service_role` |

- [ ] **Passo 2. SQL.** Trechos centrais (o resto segue o mesmo molde):

```sql
create or replace function public.obs_archive_request_limits() returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('teto_meses', 36, 'teto_arquivos', 2700, 'carga', 524288, 'total', 8388608, 'validade_dias', 30)
$$;
revoke all on function public.obs_archive_request_limits() from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_fingerprint(p_kind text, p_channels text[], p_months date[], p_measures text[])
returns text language sql immutable set search_path = '' as $$
  select md5(p_kind || '|' || coalesce((select string_agg(c, ',' order by c) from unnest(p_channels) c), '*') || '|'
    || (select string_agg(to_char(m, 'YYYY-MM'), ',' order by m) from unnest(p_months) m) || '|'
    || (select string_agg(x, ',' order by x) from unnest(p_measures) x))
$$;
revoke all on function public.obs_archive_request_fingerprint(text, text[], date[], text[]) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_state(r public.obs_archive_requests) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when r.status = 'pending' and public.obs_archive_agora() > r.expires_at
      then jsonb_build_object('status', 'expired', 'motivo', 'sem_trabalhador')
    when r.status = 'running' and (public.obs_archive_agora() > r.deadline_at
                                   or (public.obs_archive_agora() > r.lease_until and r.attempts >= 2))
      then jsonb_build_object('status', 'expired', 'motivo', 'sem_trabalhador')
    else jsonb_build_object('status', r.status, 'motivo', r.fail_reason) end
$$;
revoke all on function public.obs_archive_request_state(public.obs_archive_requests) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_create(p_site uuid, p_kind text, p_channels text[], p_choice text, p_measures text[], p_by uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_lim jsonb := public.obs_archive_request_limits();
  v_cur date := date_trunc('month', (v_agora at time zone 'America/Sao_Paulo'))::date;
  v_first date; v_n integer; v_months date[]; v_fp text; v_id uuid; v_old record;
begin
  if p_kind not in ('relatorio', 'ensaio') or p_choice not in ('12', '24', '36', 'tudo') then
    raise exception 'escolha_invalida' using errcode = 'P0001';
  end if;
  if p_measures is null or cardinality(p_measures) = 0 or exists (select 1 from unnest(p_measures) m
       where m not in ('linhas','videos_com_linha','dias_medidos','dias_do_mes','var_views','var_likes','var_comments')) then
    raise exception 'medida_fora_da_lista' using errcode = 'P0001';
  end if;
  if p_channels is not null and exists (select 1 from public.obs_archive_channel_removals x
       where x.site_id = p_site and x.channel_ref = any (p_channels)) then
    raise exception 'canal_removido' using errcode = 'P0001';
  end if;
  -- primeiro mês com algo: o registro (selado) ou a diária online (lida por canal, índice de site+canal)
  select least(
    (select min(s.month) from public.obs_archive_summaries s
      where s.site_id = p_site and s.class = case p_kind when 'ensaio' then 'ensaio' else 'serie' end
        and (p_channels is null or s.channel_ref = any (p_channels)) and s.purged_at is null),
    (select date_trunc('month', min(d.day))::date from public.competitor_video_daily d
      where d.site_id = p_site and (p_channels is null or d.channel_id::text = any (p_channels)))
  ) into v_first;
  if v_first is null then return jsonb_build_object('status', 'nada_a_pedir'); end if;
  v_n := case p_choice when 'tudo' then ((extract(year from v_cur) * 12 + extract(month from v_cur)) - (extract(year from v_first) * 12 + extract(month from v_first)))::int + 1
         else p_choice::int end;
  if v_n > (v_lim->>'teto_meses')::int then raise exception 'grande_demais' using errcode = 'P0001'; end if;
  select array_agg(m order by m desc) into v_months
    from (select (v_cur - make_interval(months => i))::date m from generate_series(0, v_n - 1) i) q where m >= v_first;
  v_fp := public.obs_archive_request_fingerprint(p_kind, p_channels, v_months, p_measures);
  -- D6/item 53: o vencido não segura o índice; normaliza só o deste site e desta impressão
  update public.obs_archive_requests r set status = 'expired', fail_reason = 'sem_trabalhador', finished_at = v_agora
   where r.site_id = p_site and r.fingerprint = v_fp and r.status in ('pending', 'running')
     and (public.obs_archive_request_state(r)->>'status') = 'expired';
  select r.id, r.requested_at into v_old from public.obs_archive_requests r
   where r.site_id = p_site and r.fingerprint = v_fp and r.status in ('pending', 'running');
  if found then return jsonb_build_object('status', 'repetido', 'id', v_old.id, 'requested_at', v_old.requested_at); end if;
  begin
    insert into public.obs_archive_requests (site_id, kind, channel_refs, months_choice, months, measures, fingerprint, requested_by, requested_at, expires_at)
    values (p_site, p_kind, p_channels, p_choice, v_months, p_measures, v_fp, p_by, v_agora, v_agora + interval '15 minutes')
    returning id into v_id;
  exception when unique_violation then          -- clique duplo em duas conexões: o perdedor lê o ganhador
    select r.id, r.requested_at into v_old from public.obs_archive_requests r
     where r.site_id = p_site and r.fingerprint = v_fp and r.status in ('pending', 'running');
    return jsonb_build_object('status', 'repetido', 'id', v_old.id, 'requested_at', v_old.requested_at);
  end;
  return jsonb_build_object('status', 'criado', 'id', v_id, 'requested_at', v_agora);
end $$;
revoke all on function public.obs_archive_request_create(uuid, text, text[], text, text[], uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_request_create(uuid, text, text[], text, text[], uuid) to service_role;
```

  - **Conferir no Passo 2** os nomes das colunas de `competitor_video_daily` (`site_id`, `channel_id`, `day`) com `grep -n "create table.*competitor_video_daily" -A 15 supabase/migrations/*.sql | head -30`; se o nome do dia for outro (ex.: `date`), usar o real e anotar no ledger.
  - **Pedido sem nenhum mês selado** (só online): nasce `pending` como os outros; o claim (Tarefa 5) o fecha sem ir à forja quando a lista de arquivos sai vazia, chamando o caminho do `finish` só com o online (Tarefa 6). Assim existe um só caminho de montagem.
  - `obs_archive_request_read(p_site, p_channel, p_ligado)`: `arquivo_ligado = p_ligado` (a função não lê variável de ambiente); `meses_no_arquivo` = `count(distinct month)` de `obs_archive_months` (classe `serie`, `detached_at is not null`) que tenham resumo do canal; `previa` por escolha; `ultimo_sinal` = `last_poll_at` de `obs_archive_heartbeat` com `worker = 'respondedor'`; `pedido` = o mais recente do canal (`p_channel = any(channel_refs)`) com o estado de `obs_archive_request_state`; `resultado` = o do pedido, com `payload->'meses'`, mesmo vencido (a tela diz "venceu"), enquanto a poda não o leva.
- [ ] **Passo 3.** Testes passam; anotar no ledger o tempo de `obs_archive_request_read` com 75 canais sintéticos × 36 meses no registro (`\timing` no `psql -p 54422`), alvo < 200 ms.
- [ ] **Passo 4. Commit** `feat: M7: criar, cancelar e ler o pedido (impressão única, vencido calculado na leitura)`.

---

### Tarefa 5: SQL parte 3, claim, progresso, falha

**Files:**
- Modify: `supabase/rascunhos/m7.sql`, `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces: `obs_archive_request_claim(p_site uuid) returns jsonb` (o `RespostaClaim` da Tarefa 1); `obs_archive_request_progress(p_site uuid, p_request uuid, p_token uuid, p_done int, p_total int) returns jsonb`; `obs_archive_request_fail(p_site uuid, p_request uuid, p_token uuid, p_reason text, p_detail text) returns jsonb`. Todas com `grant execute to service_role`.

**O que acontece quando o dado não existe:** fila vazia → `{pedido: null}`; pedido cujos resumos foram todos purgados ou que só tem meses online → o claim o tira da fila e devolve `{pedido: null}` depois de marcá-lo para a montagem só online (`status = 'running'`, `claimed_files = '[]'`, a rota do `claim` chama o `finish` no mesmo pedido: Tarefa 8, Passo 4) — nunca manda `total: 0` à forja; pedido acumulado e vencido → nunca é pego (item 51).

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `item 51: acumulados com a casa desligada vencem, não rodam no religamento` | três pedidos criados com relógio T; claim com relógio T+20 min → `{pedido: null}`; os três com `status_efetivo = 'expired'` |
| `claim pega o mais antigo, com skip locked` | dois pendentes; dois claims em duas conexões (`M7_CORRIDAS=1`, molde da M3b) pegam pedidos diferentes |
| `contador sobe antes de processar (item 52)` | claim → `attempts = 1`, `token` novo, `deadline_at = claimed_at + 15 min`, `lease_until = claimed_at + 3 min` |
| `item 52: pedido que derruba o respondedor ≤ 2 tentativas` | claim; relógio passa o arrendamento; claim de novo → mesmo pedido, `tentativa: 2`, token novo; relógio passa o arrendamento outra vez; claim → `{pedido: null}` e o pedido fica `failed`/`inesperado` com `fail_detail = 'teto de tentativas'` |
| `lista com 1.001 arquivos chega inteira (item 162)` | 1.001 resumos sintéticos (`obs_archive_summaries` com `canal_sha256`, `canal_bytes`, `canal_rows` > 0) para um pedido `p_channels = null` de 36 meses: `total = 1001` e `jsonb_array_length(arquivos) = 1001`; ordem (mês desc, canal) |
| `só .canal da classe serie; nunca ensaio no relatório (item 103)` | resumos `ensaio` plantados no mesmo mês não entram; tipo `ensaio` só lista `ensaio` |
| `purgado, perdido, substituído e vazio não entram` | quatro resumos com `purged_at`, `lost_at`, `superseded_at` e `empty = true` ficam fora; mês vazio entra na cobertura como `vazio_conferido` (Tarefa 6) |
| `mês sem entrada no registro nunca é pedido (item 55)` | mês anterior ao primeiro registro não aparece na lista |
| `canais resolvidos gravados` | `resolved_channel_refs` = os canais dos resumos listados ∪ os canais com linha online no período; canal removido com `guardar` entra; `sem_destino` entra e é contado à parte em `claimed_files->'guardados'` |
| `progresso renova o arrendamento, nunca além do prazo` | `lease_until = least(agora + 3 min, deadline_at)`; token errado → `pedido_de_outro`; cancelado → `pedido_cancelado`; passado o prazo → `pedido_vencido` |
| `falha grava motivo` | `fail(..., 'nas_fora')` → `failed`, `fail_reason = 'nas_fora'`, `finished_at`; segunda chamada → `pedido_vencido` (não está mais `running`) |
| `teto de arquivos` | 2.701 resumos num pedido: o claim marca `failed`/`grande_demais` e devolve `{pedido: null}` (a criação não sabe quantos arquivos são; o claim sabe) |

- [ ] **Passo 2. SQL do claim** (núcleo):

```sql
create or replace function public.obs_archive_request_claim(p_site uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_lim jsonb := public.obs_archive_request_limits();
  r public.obs_archive_requests; v_classe text; v_lista jsonb; v_total int; v_token uuid := gen_random_uuid();
begin
  -- 1. normaliza o que a leitura já chama de vencido (item 51): nunca é pego
  update public.obs_archive_requests q set status = 'expired', fail_reason = 'sem_trabalhador', finished_at = v_agora
   where q.site_id = p_site and q.status in ('pending', 'running') and (public.obs_archive_request_state(q)->>'status') = 'expired';
  -- 2. arrendamento vencido na 2ª tentativa: falha, nunca 3ª
  update public.obs_archive_requests q set status = 'failed', fail_reason = 'inesperado', fail_detail = 'teto de tentativas', finished_at = v_agora
   where q.site_id = p_site and q.status = 'running' and q.lease_until < v_agora and q.attempts >= 2;
  -- 3. pega um: pendente, ou em andamento com arrendamento vencido e 1 tentativa
  select * into r from public.obs_archive_requests q
   where q.site_id = p_site and (q.status = 'pending' or (q.status = 'running' and q.lease_until < v_agora and q.attempts < 2))
   order by q.requested_at for update skip locked limit 1;
  if not found then return jsonb_build_object('pedido', null); end if;
  v_classe := case r.kind when 'ensaio' then 'ensaio' else 'serie' end;
  select coalesce(jsonb_agg(jsonb_build_object(
           'arquivo_id', 's:' || s.id || ':canal', 'classe', s.class, 'filho', 'numerico',
           'caminho', s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.canal.csv.gz',
           'canal', s.channel_ref, 'mes', to_char(s.month, 'YYYY-MM'), 'versao', s.version, 'sha256', s.canal_sha256, 'bytes', s.canal_bytes)
           order by s.month desc, s.channel_ref), '[]'::jsonb), count(*)
    into v_lista, v_total
    from public.obs_archive_summaries s
   where exists (select 1 from public.obs_archive_months m          -- exists, não join: o registro tem uma linha por tabela (duplicaria o arquivo)
                  where m.site_id = s.site_id and m.class = s.class and m.table_name = 'competitor_video_daily' and m.month = s.month
                    and m.sealed_at is not null and m.sealed_kind = 'com_dado')
     and s.site_id = p_site and s.class = v_classe and s.month = any (r.months)
     and (r.channel_refs is null or s.channel_ref = any (r.channel_refs))
     and not s.empty and s.purged_at is null and s.lost_at is null and s.superseded_at is null and s.nas_withdrawn_at is null
     and not exists (select 1 from public.obs_archive_channel_removals x where x.site_id = s.site_id and x.channel_ref = s.channel_ref and x.archive_decision = 'apagar');
  if v_total > (v_lim->>'teto_arquivos')::int then
    update public.obs_archive_requests set status = 'failed', fail_reason = 'grande_demais', finished_at = v_agora where id = r.id;
    return jsonb_build_object('pedido', null);
  end if;
  update public.obs_archive_requests set status = 'running', attempts = attempts + 1, claim_token = v_token,
         claimed_at = coalesce(claimed_at, v_agora), deadline_at = coalesce(deadline_at, v_agora + interval '15 minutes'),
         lease_until = least(v_agora + interval '3 minutes', coalesce(deadline_at, v_agora + interval '15 minutes')),
         claimed_files = jsonb_build_object('arquivos', v_lista, 'guardados',
           (select count(distinct e->>'canal') from jsonb_array_elements(v_lista) e
             where exists (select 1 from public.obs_archive_channel_removals x
                            where x.site_id = p_site and x.channel_ref = e->>'canal' and x.archive_decision is distinct from 'apagar'))),
         resolved_channel_refs = (select array_agg(distinct e->>'canal') from jsonb_array_elements(v_lista) e),
         progress_done = 0, progress_total = v_total
   where id = r.id returning * into r;
  if v_total = 0 then return jsonb_build_object('pedido', null, 'so_online', r.id); end if;   -- a rota monta só com o banco (Tarefa 8)
  return jsonb_build_object('pedido', jsonb_build_object('id', r.id, 'token', v_token, 'tipo', r.kind, 'prazo', r.deadline_at,
    'arrendamento_ate', r.lease_until, 'tentativa', r.attempts, 'total', v_total, 'arquivos', v_lista));
end $$;
```

  - `resolved_channel_refs` também une os canais com linha online no período (para pedido `null`): consulta separada sobre `competitor_video_daily` dos meses não selados, mesma forma do `create`. `guardados` = canais da lista com remoção `guardar` ou sem decisão (`sem_destino`).
  - Nota de contrato: o `so_online` é campo **interno** entre a função e a rota; a rota o tira da resposta (o Zod `.strict()` da `RespostaClaim` o recusaria se escapasse; teste da Tarefa 8).
- [ ] **Passo 3.** Progresso e falha seguem o mesmo molde (`for update` na linha, conferir `status = 'running'`, `claim_token = p_token`, prazo; códigos `pedido_de_outro`, `pedido_cancelado` quando `status = 'cancelled'`, `pedido_vencido` nos demais). Testes passam.
- [ ] **Passo 4. Commit** `feat: M7: claim, progresso e falha (contador antes, teto 2, vencido nunca pego, lista fechada de resumos)`.

---

### Tarefa 6: SQL parte 4, cálculo extraído, online parcial, resultado

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/integration/manutencao-m7-resultado.test.ts`

**Interfaces:**
- Produces: `obs_archive_summary_calc(p_site uuid, p_class text, p_channel uuid, p_table text, p_month date, p_hash text, p_ver text) returns jsonb` (`{canal: [14 textos], video: [[...]]}`; interna, `revoke ... from service_role`); `obs_archive_summary_rows` recriada chamando-a; `obs_archive_request_online(p_site uuid, p_request uuid, p_month date) returns jsonb` (linhas `.canal` da `competitor_video_daily` para os canais resolvidos, `hash_conteudo_unidade` nulo, `versao_resumo` `'online'`); `obs_archive_request_finish(p_site uuid, p_request uuid, p_token uuid, p_lidos jsonb, p_falhas jsonb, p_online jsonb) returns jsonb` → `{estado: 'completo'|'incompleto'|'devolvido'}`.

**O que acontece quando o dado não existe:** arquivo listado sem resposta nem falha → `resposta_fora_da_lista` (nada gravado); arquivo lido com zero linha onde `canal_rows > 0` → mês `faltou`/`divergente` (item 55, nunca zero); mês selado `vazio_conferido` → `vazio_conferido` com `conferido_em = sealed_at`; mês online sem linha nenhuma do canal (canal novo, coleta parada) → `parcial` com `dias_medidos = 0` e `views` nulo: é o que o banco mediu, não leitura faltando; a frase "0 de 31 dias medidos" vai como remessa ao Logan (Tarefa 10, Passo 1, item e).

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `D10: selagem idêntica depois da extração` | para cada fixture de resumo da M3b (`semearDiaria` com 3 canais × 2 meses), `obs_archive_summary_rows` antes (rascunho da M3b só) e depois (M3b + M7) devolve o mesmo `jsonb::text` byte a byte |
| `item 103: não selado vem do banco, marcado parcial, pela mesma função` | mês corrente: `obs_archive_request_online` devolve a linha `.canal` igual à de `obs_archive_summary_calc` com hash nulo; no payload `estado: 'parcial'`, `origem: 'banco_sem_copia'` |
| `item 103: selado vem do arquivo` | mês selado com dado diferente no banco (linha alterada só no banco, como dono): o payload traz o número do arquivo, não o do banco |
| `item 55: linhas esperadas e resposta zero é incompleto` | `lidos` com `linhas: []` para resumo de `canal_rows = 2` → mês `faltou`, `motivo: 'divergente'`, `state = 'incompleto'` |
| `D2: hash de unidade diferente é divergente` | uma linha com `hash_conteudo_unidade` trocado → `divergente` |
| `falhas por arquivo viram meses incompletos` | `falhas: [{..., motivo: 'ausente'}]` → mês `faltou`/`ausente`; `nas_fora` idem com o seu motivo; os outros meses completos |
| `resumo purgado depois do claim volta a pending uma vez` | claim; `purged_at` num resumo da lista; finish → `devolvido`, `status = 'pending'`, `requeued_once = true`, `attempts = 0`, `expires_at = agora + 15 min`; purgar outro e finish de novo → grava normalmente, mês do purgado fora da lista (nunca `ausente`) |
| `item 54: resultado acima do teto é recusado antes de inserir` | `p_lidos` que faz `octet_length(payload::text) > 524288` → `failed`/`grande_demais`, nenhuma linha em `obs_archive_results` |
| `item 54: total ≤ 8 MB expulsando o mais antigo` | 17 resultados de ~500 kB: o 17º insere e o mais antigo sai; `sum(payload_bytes) <= 8388608` |
| `item 56: sem corpo nem id de comentário` | `p_lidos` com uma coluna a mais (ex.: `comment_id`) → recusado; o payload só tem as chaves `mes, canal, estado, origem, dias_medidos, dias_do_mes, views, likes, comentarios_contagem, conferido_em, motivo`; `payload::text` não casa `/comment_id|text_original|author/` |
| `token, cancelado e vencido` | token errado → `pedido_de_outro`; cancelado durante a leitura → `pedido_cancelado`, nada gravado; passado o prazo → `pedido_vencido` |
| `arquivo fora da lista` | `arquivo_id` que o claim não listou, ou um que falta → `resposta_fora_da_lista` |

- [ ] **Passo 2. Extração** (`obs_archive_summary_calc`): o corpo é o bloco `execute format(...) into v_c, v_v using ...` de `m3b.sql` linhas 1103 a 1127, movido sem mudar um caractere da consulta; `p_hash` e `p_ver` entram nos `$11` e `$12`. `obs_archive_summary_rows` é recriada com o texto de `m3b.sql` 1073–1137, trocando só o `execute` do laço por `select c->'canal', c->'video' into v_c, v_v from (select public.obs_archive_summary_calc(p_site, p_class, p_channel, u.table_name, p_month, u.hash_conteudo, v_ver::text) c) q;`. **Antes de editar:** `diff <(sed -n 1073,1137p supabase/rascunhos/m3b.sql) <(...)` contra o texto em produção (`pg_get_functiondef` no `bythiago_int` depois de `aplicarM3b`), para que a M7 recrie a versão final da M3b e não uma antiga; se a M3b mudou a função depois deste plano, usar a versão nova e anotar.
- [ ] **Passo 3. `obs_archive_request_finish`** (núcleo, em ordem):
  1. `for update` no pedido; `status = 'running'` e token conferem; prazo não passou; senão o código do R2.
  2. Conjunto exato: `select array_agg(e->>'arquivo_id')` de `claimed_files->'arquivos'` igual ao de `p_lidos ∪ p_falhas`, sem repetição; senão `resposta_fora_da_lista`.
  3. Purgado depois do claim: algum resumo da lista com `purged_at > claimed_at` → se `not requeued_once`: `status = 'pending'`, `requeued_once = true`, `attempts = 0`, `claim_token = null`, `claimed_at = null`, `deadline_at = null`, `expires_at = agora + 15 min`, retorna `devolvido`; se já foi devolvido uma vez: tira esses arquivos da conferência (mês fora da lista).
  4. Para cada arquivo lido: esperado = `obs_archive_summaries` (`canal_rows`, `unit_hashes`) pelo id do `arquivo_id`; `jsonb_array_length(linhas) = canal_rows` e cada `linha[12]` (hash) está em `unit_hashes` e a linha de `competitor_video_daily` existe; senão `divergente`. Lê `dias_medidos`, `dias_do_mes`, `var_views`, `var_likes`, `var_comments` da linha `competitor_video_daily`.
  5. Meses `vazio_conferido` do registro no período entram com `conferido_em`.
  6. `p_online` (montado pela rota, Tarefa 8) entra como `parcial`.
  7. Monta `payload = {versao: 1, meses: [...] (desc), guardados: n}`; `v_bytes := octet_length(payload::text)`; `> 524288` → pedido `failed`/`grande_demais`, retorna, **sem** insert.
  8. Expulsão: `delete from public.obs_archive_results where id in (select id from (select id, sum(payload_bytes) over (order by created_at desc, id desc) acc from public.obs_archive_results) q where acc + v_bytes > 8388608)`; depois o `insert` com `valid_until = agora + 30 days`, `channel_refs = r.resolved_channel_refs` (nulo se o pedido era `null`), `state`.
  9. Pedido `done`, `finished_at`, `progress_done = progress_total`.
- [ ] **Passo 4.** `obs_archive_request_online`: para cada canal de `resolved_channel_refs` com linha em `competitor_video_daily` no mês, chama `obs_archive_summary_calc(..., 'competitor_video_daily', p_month, null, 'online')`; recusa mês com `detached_at` (`ja_no_arquivo`) e mês selado (`mes_selado`: a rota não deve pedir).
- [ ] **Passo 5.** Testes passam (`HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m7-resultado.test.ts --no-file-parallelism > /tmp/m7-t6.txt 2>&1`).
- [ ] **Passo 6.** Rodar também os testes da selagem da M3b (`npx vitest run test/integration/ -t "selagem\|summary" --no-file-parallelism`): continuam passando com a M7 aplicada.
- [ ] **Passo 7. Medida local (D13).** No `bythiago_int`, 75 canais × 31 dias × 50 vídeos no mês corrente: `\timing` de `obs_archive_request_online` para o pedido `null` e para um canal; anotar no ledger. Acima de 3 s para 75 canais: a rota passa a chamar por blocos de 25 canais (parâmetro `p_offset`, `p_limit`), e o plano registra a mudança.
- [ ] **Passo 8. Commit** `feat: M7: cálculo do resumo extraído, online parcial e resultado conferido contra o registro (teto 512 kB, total 8 MB)`.

---

### Tarefa 7: SQL parte 5, remoção com apagar, vigia 5, poda, lista fechada

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/integration/manutencao-m7-remocao-poda.test.ts`
- Modify: `apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts`

**Interfaces:**
- Produces: gatilho `obs_archive_z_resultados_apagar` em `obs_archive_channel_removals` (função `obs_archive_results_on_apagar()`, interna); `obs_archive_vigia_resultados() returns integer` (`grant ... to service_role`); `cron_purge_obs_archive_requests() returns void` agendada `'30 6 * * *'` (UTC, fora de 11:30–13:00 e dos minutos 0/20/40; não colide com `'10 6'` e `'50 6'` da M1).

**O que acontece quando o dado não existe:** canal removido sem pedido nem resultado → o gatilho não faz nada; poda sem linha → grava `cron_runs` com zero (o vigia lê "rodou, zero"), nunca deixa de gravar; extensão `pg_cron` ausente (banco local sem ela) → o bloco `do $guard$` pula o agendamento, a função existe.

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `apagar apaga resultado e cancela pedido na mesma transação` | resultado com `channel_refs = '{A}'` e pedido pendente com `'{A}'`; `obs_archive_channel_removal_decide(..., 'apagar')` (função da M3b): na mesma transação, `count(results)` = 0 e o pedido `cancelled`/`canal_apagado` |
| `pedido e resultado sem lista de canais também` | `channel_refs is null` → apagado e cancelado |
| `guardar não apaga` | decisão `guardar` → nada muda |
| `vigia 5 acha o resultado plantado (item 162)` | como dono: `alter table ... disable trigger obs_archive_z_resultados_apagar`, decisão `apagar`, resultado do canal plantado, `enable trigger`; `obs_archive_vigia_resultados()` = 1 |
| `poda: pedido de mais de 7 dias e resultado vencido` | relógio +8 d: pedido `done` sai; pedido `running` nunca sai pela idade sem antes ser `expired` (sai só se `finished_at` < 7 d); resultado com `valid_until` passado sai; o de 29 dias fica; `cron_runs` ganha a linha |
| `item 57: poda na lista fechada` | o teste da lista fechada (abaixo) passa com os pares novos e falha se um `delete from` novo aparecer sem par |

- [ ] **Passo 2. SQL.**

```sql
create or replace function public.obs_archive_results_on_apagar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archive_decision is distinct from 'apagar' then return null; end if;
  delete from public.obs_archive_results r
   where r.site_id = new.site_id and (r.channel_refs is null or new.channel_ref = any (r.channel_refs));
  update public.obs_archive_requests q set status = 'cancelled', cancelled_reason = 'canal_apagado', cancelled_at = public.obs_archive_agora()
   where q.site_id = new.site_id and q.status in ('pending', 'running')
     and (q.channel_refs is null or new.channel_ref = any (q.channel_refs) or new.channel_ref = any (coalesce(q.resolved_channel_refs, '{}')));
  return null;
end $$;
revoke all on function public.obs_archive_results_on_apagar() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_z_resultados_apagar on public.obs_archive_channel_removals;
create trigger obs_archive_z_resultados_apagar after insert or update of archive_decision on public.obs_archive_channel_removals
  for each row execute function public.obs_archive_results_on_apagar();

create or replace function public.obs_archive_vigia_resultados() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.obs_archive_results r
   where exists (select 1 from public.obs_archive_channel_removals x
                  where x.site_id = r.site_id and x.archive_decision = 'apagar'
                    and (r.channel_refs is null or x.channel_ref = any (r.channel_refs)))
$$;
revoke all on function public.obs_archive_vigia_resultados() from public, anon, authenticated;
grant execute on function public.obs_archive_vigia_resultados() to service_role;
```

  A poda segue o molde de `20261014000001_manutencao_m1_podas_execucao.sql` linhas 136 a 165 (mesma forma de `cron_runs`, `do $guard$`, `cron.unschedule` guardado antes do `cron.schedule('cron_purge_obs_archive_requests', '30 6 * * *', ...)`); conferir os nomes exatos das colunas de `cron_runs` lendo essas linhas antes de escrever.
- [ ] **Passo 3. Lista fechada.** Em `observatorio-a5-e10-lista-fechada.test.ts`, depois do bloco da M1:

```ts
  // fase de manutenção, M7 (02 §10.6): a fila e o resultado do período longo. Disparo: cron (poda), dono (remoção com apagar), forja (expulsão ao inserir).
  { funcao: 'cron_purge_obs_archive_requests', tabela: 'obs_archive_requests', linha: 'manutenção M7: pedido com mais de 7 dias (item 57)', disparo: 'cron' },
  { funcao: 'cron_purge_obs_archive_requests', tabela: 'obs_archive_results', linha: 'manutenção M7: resultado vencido, 30 dias (item 57)', disparo: 'cron' },
  { funcao: 'obs_archive_request_finish', tabela: 'obs_archive_results', linha: 'manutenção M7: expulsa o mais antigo acima de 8 MB (item 54)', disparo: 'coleta' },
  { funcao: 'obs_archive_results_on_apagar', tabela: 'obs_archive_results', linha: 'manutenção M7: canal removido com apagar (02 §10.6)', disparo: 'dono' },
```

  A regex do teste só olha funções `^(competitor_|yt_|youtube_channel_|obs_)`: `cron_purge_obs_archive_requests` começa com `cron_`. **Conferir** se o teste já cobre `cron_purge_*` (a M1 pôs `yt_own_collection_attempts_purge`); se não cobre, o par da poda vai com nome `obs_archive_requests_purge` (renomear a função para casar com a regex, e o job do cron chama esse nome). Decisão no Passo 3, anotada no ledger. O disparo `'coleta'` é o mais próximo da lista de tipos (`'cron' | 'dono' | 'coleta' | 'agenda'`) para "a forja grava o resultado"; se Phil pedir `'forja'`, o tipo `Par` ganha o valor.
- [ ] **Passo 4.** A parte estática (`lista-fechada-do-que-apaga.test.ts`) não muda: nenhum `.delete()` de cliente é criado no TypeScript desta etapa (as rotas só chamam RPC). Rodar para confirmar.
- [ ] **Passo 5. Commit** `feat: M7: remoção com apagar leva resultado e pedido, vigia 5, poda diária na lista fechada`.

---

### Tarefa 8: as quatro rotas (depois da TRAVA M7-2)

**Files:**
- Create: `apps/web/src/app/api/pipeline/archive/request/claim/route.ts`, `.../progress/route.ts`, `.../result/route.ts`, `.../fail/route.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco.ts`
- Create: `apps/web/test/app/api/pipeline/archive-request.test.ts`
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (4 entradas; `endpoint_count` do domínio `archive` + 4), `apps/web/data/pipeline-docs/cowork-docs-archive.md`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/test/lib/pipeline/mcp-registry-sync.test.ts` (contagem)

**Interfaces:**
- Consumes: `authenticateArchive`, `erroDoRpc` (M3b), `CorpoClaim`, `RespostaClaim`, `CorpoProgresso`, `CorpoResultado`, `CorpoFalha`, `TETO_CORPO_RESULTADO_BYTES` (Tarefa 1).
- Produces: `montarOnline(rpc, site, pedido, meses): Promise<unknown[]>` em `pedido-do-banco.ts`.

**O que acontece quando o dado não existe:** `OBS_ARQUIVO` apagada → `503 arquivo_desligado` nas quatro (teste que apaga a variável); RPC que devolve dado fora do esquema → `500 erro_do_banco` + Sentry; claim com `so_online` → a rota monta o online e chama o `finish` com listas vazias, e responde `{pedido: null}` ao respondedor.

- [ ] **Passo 1.** `git diff --stat --` dos quatro Modify vazio; senão a regra do Global Constraints. Conferir a TRAVA M7-2 no ledger.
- [ ] **Passo 2. Testes, falhando** (cliente de serviço falso com `rpc` programável, molde do `pipeline-archive.test.ts` da M3b):

| Teste | Afirma |
|---|---|
| `chave sem archive_read` | `403` nas quatro; `archive_copy` também `403` |
| `OBS_ARQUIVO apagada` | `delete process.env.OBS_ARQUIVO` → `503 arquivo_desligado` nas quatro |
| `claim sem pedido` | `200 {data: {pedido: null}}`, `cache-control: no-store` |
| `claim só online` | RPC devolve `{pedido: null, so_online: id}`: a rota chama `obs_archive_request_online` por mês não selado e `obs_archive_request_finish` com `p_lidos = []`; responde `{pedido: null}` sem `so_online` |
| `claim fora do esquema` | RPC devolve `total` diferente do tamanho da lista → `500 erro_do_banco`, Sentry chamado |
| `result: corpo acima de 4 MB` | `413 grande_demais` antes do `parseBody` (lê `content-length`; sem cabeçalho, conta os bytes lidos) |
| `result: chama online para os meses não selados e depois finish` | ordem das chamadas; `p_online` com as linhas |
| `result: códigos do banco` | `P0001 pedido_cancelado` → `409`; `resposta_fora_da_lista` → `422` |
| `progress e fail` | repassam e validam a resposta |
| `nenhuma resposta traz sha256, canal_rows ou unit_hashes` (molde do item 132) | varre os corpos de resposta dos testes de `result`, `progress` e `fail` |

- [ ] **Passo 3. Rotas.** Molde da `unit/export` da M3b; `export const dynamic = 'force-dynamic'`; `maxDuration = 60` em `result` e `claim`; `res.headers.set('Cache-Control', 'no-store')`. A de `result`:

```ts
// apps/web/src/app/api/pipeline/archive/request/result/route.ts
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { erroDoRpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { CorpoResultado, TETO_CORPO_RESULTADO_BYTES } from '@/lib/youtube/observatorio/arquivo-mensal/pedido'
import { montarOnline, RespostaFinish } from '@/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_read'])
  if (a instanceof Response) return a
  const tam = Number(req.headers.get('content-length') ?? '0')
  if (tam > TETO_CORPO_RESULTADO_BYTES) return pipelineError('grande_demais', 'grande demais', 413, a.auth)
  const corpo = await parseBody(req, CorpoResultado, a.auth)
  if (corpo instanceof Response) return corpo
  const db = getSupabaseServiceClient()
  try {
    const online = await montarOnline(db, a.auth.siteId, corpo.pedido_id)
    if (!online.ok) return erroDoRpc(online.erro, a.auth)
    const { data, error } = await db.rpc('obs_archive_request_finish', {
      p_site: a.auth.siteId, p_request: corpo.pedido_id, p_token: corpo.token, p_lidos: corpo.lidos, p_falhas: corpo.falhas, p_online: online.linhas,
    })
    if (error) return erroDoRpc(error, a.auth)
    const r = RespostaFinish.safeParse(data)
    if (!r.success) { Sentry.captureMessage('archive request/result fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    const res = pipelineSuccess(r.data, 200, a.auth)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/request/result' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
```

  `montarOnline` lê os meses não selados do pedido por uma RPC curta (`obs_archive_request_online_months(p_site, p_request)`, só leitura, acrescentada ao rascunho nesta tarefa se a Tarefa 6 não a tiver criado) e chama `obs_archive_request_online` mês a mês (D13). **Conferir** o nome do campo do site em `PipelineAuth` (`siteId`) em `apps/web/src/lib/pipeline/auth.ts` antes de escrever.
- [ ] **Passo 4. Integridade do pipeline:** 4 entradas no `api-registry.ts` (domínio do arquivo da M3b; `endpoint_count` + 4), seção "Pedido de período longo (respondedor)" em `cowork-docs-archive.md` com os quatro corpos do contrato R1 a R4, `leitura-rotas.ts` (as quatro são escrita: conferir como a M3b classificou `heartbeat`), e a contagem em `mcp-registry-sync.test.ts`.
- [ ] **Passo 5.** `npx vitest run test/app/api/pipeline/archive-request.test.ts test/lib/pipeline > /tmp/m7-t8.txt 2>&1`, só falhas no contexto; `npm run typecheck -w apps/web`.
- [ ] **Passo 6. Commit** `feat: M7: rotas request/claim, progress, result e fail do respondedor (archive_read)`.

---

### Tarefa 9: server actions do CMS (depois da TRAVA M7-2)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/ver-antigo-actions.ts`
- Create: `apps/web/test/cms/ver-antigo-actions.test.ts`

**Interfaces:**
- Produces: `lerVerAntigo(canalId: string): Promise<LeituraDoPedido | null>`; `pedirVerAntigo(canalId: string, escolha: EscolhaDeMeses): Promise<{ status: 'criado' | 'repetido' | 'nada_a_pedir' | 'grande_demais' | 'desligado' | 'erro' }>`; `cancelarVerAntigo(canalId: string, pedidoId: string): Promise<{ status: 'cancelado' | 'ja_terminado' | 'erro' }>`. São passadas ao client component por props (CLAUDE.md: não importar server action em client component).

**O que acontece quando o dado não existe:** usuário sem `canEditSite` → `lerVerAntigo` devolve a leitura sem `pedido` e sem `resultado` e a tela mostra só a tira de leitura (D17); `pedir`/`cancelar` → `erro` sem chamar o banco; RPC com erro ou fora do esquema → `null` (`nao_medido`) e Sentry; `OBS_ARQUIVO` ≠ `on` → `pedir` devolve `desligado` sem criar nada.

- [ ] **Passo 1. Testes, falhando:** quem só lê não cria (o RPC não é chamado); `OBS_ARQUIVO` apagada → `desligado`; `P0001 grande_demais` → `grande_demais`; leitura fora do esquema → `null` + Sentry; o `p_channels` enviado é `[canalId]` e o `p_measures` é `MEDIDAS_V1`; `canalId` não uuid → `erro` sem banco.
- [ ] **Passo 2. Implementar** (`'use server'`; `getSiteContext()` para o site; `canEditSite(siteId)` antes de `getSupabaseServiceClient()`, regra do CLAUDE.md; `requested_by` = usuário da sessão). Molde: as ações de `competitors/actions.ts`.
- [ ] **Passo 3.** Testes passam; typecheck.
- [ ] **Passo 4. Commit** `feat: M7: ações do CMS para ler, pedir e cancelar o período longo (só quem edita)`.

---

### Tarefa 10: o painel "Ver antigo" na página do canal (depois da TRAVA M7-2)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/_canal/ver-antigo.tsx` (`'use client'`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/_canal/canal-screen.tsx` (recebe `verAntigo?: { leitura, acoes, podeEditar, nomeDoCanal }` em props e o põe na âncora do Passo 3 da Tarefa 0)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/page.tsx` (lê `lerVerAntigo` no servidor e passa as ações)
- Modify: o CSS do CMS onde vivem os estilos do Observatório (conferir com `grep -rn "m-va\b\|\.m-bar" apps/web/src/app/cms` se a M5 já trouxe o bloco do `m19.css`; se não, trazer **só** o bloco da peça 6 do `m19.css`, com os tokens do CMS)
- Create: `apps/web/test/cms/ver-antigo.test.tsx` (`// @vitest-environment jsdom`)

**O que acontece quando o dado não existe:** `leitura` nula → painel `nao_medido`; sem mês no arquivo → a tira com a frase de `semArquivo` e sem botão (D17); quem só lê → só "dd/mm a dd/mm/aaaa no arquivo." sem botão; ação que falha durante o polling → o painel mantém o último estado e, depois de 3 falhas seguidas, mostra `nao_medido` (nunca volta a "antes de pedir").

- [ ] **Passo 1. Remessas ao Logan antes do código** (no ledger, seção "Remessas ao Logan"; o controlador leva): (a) D9, o rótulo "do banco" sem "parcial" não aparece; (b) D16, a frase do `inesperado`; (c) D15, a data de "O primeiro sai em"; (d) a âncora, se o gráfico "Views por dia" não existir na tela real; (e) mês online sem linha do canal: "0 de 31 dias medidos". O código segue o mockup; cada remessa respondida muda só texto.
- [ ] **Passo 2. Testes, falhando (item 105):** um teste por quadro do mockup, cada um com a frase do `pedido-tela.ts` e a forma do aviso: `a-pedir` (frase de 12 meses; trocar para "Tudo" desliga "Pedir" com `aria-describedby`), `a-nada`, `a-desl`, `a-grande`, `e-env` (botão "Cancelar pedido"), `e-and` (barra com `aria-valuenow` e "Lendo: 9 de 12 meses"), `e-reab` (reaberto), `e-rep`, `p-ok` (12 linhas; com 24, "E mais 12 meses mais antigos"), venceu, `x-inc` (meses faltando sem número), `x-bate` (`role="alert"`), não respondeu (triângulo com sinal de 10 h, octógono com 40 h), `x-nas`, cancelado com a frase própria, `x-nm`. Mais: o polling para no estado final e com `document.visibilityState = 'hidden'` (fake timers); nenhum texto "sem dados" em nenhum estado (`expect(container.textContent).not.toMatch(/sem dados/i)`).
- [ ] **Passo 3. Componente.** Estrutura e classes do `peca6.js` (`m-va`, `m-va-h`, `m-segs`, `m-va-lead`, `m-va-acoes`, `m-va-prog`, `m-va-meses`, `m-vam`); `role="status"` no lead dos estados de espera e `role="alert"` em `bate`, `naoResp`, `nasFora`; o foco vai ao painel (`tabIndex={-1}`) quando ele abre. Ações por props; `useTransition` nos cliques; polling com `setInterval` de 10 s só em `enviado`/`andamento`, limpo no `useEffect` de desmontagem e em `visibilitychange`.
- [ ] **Passo 4.** Testes passam; typecheck; `next build` não é obrigatório (CLAUDE.md), mas a tela passa pelo **Gio** (navegador) contra o roteiro §19e antes de ir ao dono, e por Logan e Naksu (regra do dono).
- [ ] **Passo 5. Commit** `feat: M7: painel Ver antigo na página do canal (peça 6, 15 estados do mockup aprovado)`.

---

### Tarefa 11: o respondedor (kit da forja)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py`
- Create: `~/Workspace/forja/ferramentas/arquivo/teste_respondedor.py`
- Modify: `~/Workspace/forja/ferramentas/arquivo/comum.py` (`CHAVE_DO_PROGRAMA['respondedor'] = 'respondedor'`; `config` com `leitura`, `intervalo_s`, `orcamento_s` próprio e `pausa_desligado_s` quando o programa é o respondedor)
- Modify: `~/Workspace/forja/ferramentas/arquivo/falsos.py` (`SiteArquivoFalso` atende `request/claim|progress|result|fail` com o Zod espelhado: `zod_claim`, `zod_result`, `zod_fail`, `zod_progress`)
- Modify: `~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh` (lista ganha `teste_respondedor.py`)

**Interfaces:**
- Produces: `responder.py` com `main(argv, env, eh_montagem, dormir, relogio)`, `uma_volta(cf, site, eh_montagem) -> str` (o desfecho da volta: `nada`, `ok`, `incompleto`, `nas_fora`, `grande_demais`, `inesperado`, `desligado`, `site_fora`, `chave`), `atender(cf, site, pedido, eh_montagem) -> dict`; o registro `log/respondedor.jsonl` (uma linha por pedido atendido e uma por mudança de desfecho de volta, nunca uma a cada 15 s); `estado/respondedor-vivo.json` (`{"em": ISO, "desfecho": ...}`, trocado a cada volta por `trocar_atomico`).

**O que acontece quando o dado não existe:** chave ausente ou com permissão aberta → desfecho `chave`, dorme o intervalo e tenta de novo (o `systemd` não reinicia em laço: o programa não sai); montagem de leitura ausente ou sem `.arquivo-vivo` antes do primeiro arquivo → `fail nas_fora` (item 102), nunca `ausente`; a sentinela some no meio → o arquivo corrente e os seguintes vão em `falhas` com `nas_fora`, o resto já lido vai em `lidos` (D3); arquivo listado que não existe (`existe` → False) → `ausente`; EIO no `lstat` → `nas_fora` daquele arquivo, nunca `ausente`; `503 arquivo_desligado` → dorme `pausa_desligado_s`; total da lista diferente do tamanho → `fail inesperado`.

- [ ] **Passo 1. Testes, falhando** (`teste_respondedor.py`, molde de `teste_copiador.py` com `exige()`; pasta temporária com `numerico/.arquivo-vivo` e `eh_montagem` falso que diz montado):

| Teste | Afirma |
|---|---|
| `item 102: sem montagem ou sem sentinela é nas_fora` | `eh_montagem` falso → o falso recebeu `fail` com `nas_fora`; nenhum `result` |
| `item 104: só abre o que o claim mandou, só .canal` | o falso lista 3 arquivos; há 10 na pasta: `open` interceptado registra exatamente os 3; caminho com `video` ou `..` na lista → `fail inesperado` (o caminho é refeito por `caminho_resumo` e comparado, nunca usado cru) |
| `item 162: não lista pasta nem lê manifesto` | `os.listdir`, `os.scandir` e `glob` substituídos por funções que falham o teste se chamadas |
| `item 162: lista com 1.001 arquivos chega inteira e cada um é respondido uma vez` | 1.001 arquivos sintéticos: `result` com `len(lidos) + len(falhas) == 1001`, sem repetição |
| `sha256 diferente é divergente; arquivo ausente é ausente` | um arquivo com um byte trocado, um apagado |
| `CSV ilegível é ilegivel` | gzip cortado |
| `sentinela some no meio` | `eh_montagem` vira falso depois do 2º arquivo: 2 em `lidos`, o resto `nas_fora` em `falhas` |
| `item 52: contador antes, e o processo que morre não repete além de 2` | o falso conta claims do mesmo pedido; o respondedor é morto (exceção injetada) no 1º atendimento; na volta seguinte o falso entrega `tentativa: 2`; a terceira volta recebe `{pedido: null}` |
| `cancelado no meio para` | `progress` responde `409 pedido_cancelado` → o respondedor para sem `result` e registra `cancelado` |
| `orçamento` | `relogio` falso passa de 780 s → `fail grande_demais` |
| `total diferente da lista` | `fail inesperado` |
| `heartbeat no máximo 1 por minuto` | 10 voltas em 150 s de relógio falso → 3 batimentos |
| `variáveis com padrão (cada uma apagada)` | sem `ARQ_RESP_INTERVALO_S` → 15; sem `ARQ_RESP_ORCAMENTO_S` → 780; sem `ARQ_RESP_PAUSA_DESLIGADO_S` → 300; sem `ARQ_MONTAGEM_LEITURA` → `/mnt/arquivo/leitura`; valor ilegível em cada uma → `erro_config` e desfecho `bug` |
| `nenhuma escrita no NAS` | `open` em modo de escrita sob a raiz de leitura falha o teste |
| `linhas devolvidas: só as 14 colunas, em texto` | as linhas do CSV vão como listas de 14 células; arquivo com 15 colunas → `ilegivel` |

- [ ] **Passo 2. `comum.py`:** `CHAVE_DO_PROGRAMA = {"copiador": "copiador", "conferir-b2": "conferidor", "respondedor": "respondedor"}`; em `config`, para `programa == "respondedor"`: `leitura = e.get("ARQ_MONTAGEM_LEITURA") or "/mnt/arquivo/leitura"`, e os três números com o mesmo tratamento de valor ilegível (`erro_config`). `teste_comum.py` ganha os casos (o `config('respondedor')` sem variável nenhuma).
- [ ] **Passo 3. `responder.py`** (núcleo):

```python
"""M7 (forja): o respondedor do relatório de período longo (spec 02 §10.6; contrato R1 a R5 em contrato-rotas-m7.md).

Serviço contínuo (systemd: arquivo-responder.service). A cada ARQ_RESP_INTERVALO_S (15 s) pede um pedido ao site;
com um, lê SÓ os arquivos de resumo .canal que o claim listou, pela montagem de LEITURA (ro), confere o sha256 contra
a lista e devolve as linhas; quem conclui é o site. Nunca lista pasta, nunca lê manifesto, nunca grava no NAS.
Pasta não montada ou sem a sentinela: nas_fora (nunca 'ausente'). O contador de tentativas sobe no site antes."""
import csv, gzip, hashlib, io, os, sys, time, traceback
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import comum as c  # noqa: E402
from cliente_site import ArquivoDesligado, ChaveRecusada, Recusa, Site, SiteFora  # noqa: E402

PROGRAMA = "respondedor"
COLUNAS = 14
LOTE_PROGRESSO, PROGRESSO_S = 50, 30


class Cancelado(Exception):
    pass


def ler_resumo(caminho):
    """(linhas, sha256, bytes) ou levanta OSError (E/S) / ValueError (ilegível). Uma leitura só, sem cache do NFS."""
    with open(caminho, "rb", buffering=0) as f:
        c.descartar_cache(f.fileno())
        bruto = f.read()
    sha = hashlib.sha256(bruto).hexdigest()
    try:
        texto = gzip.decompress(bruto).decode("utf-8")
    except (OSError, EOFError, UnicodeDecodeError) as e:
        raise ValueError("gzip") from e
    linhas = list(csv.reader(io.StringIO(texto)))
    if not linhas or len(linhas[0]) != COLUNAS:
        raise ValueError("cabeçalho")
    corpo = linhas[1:]
    if any(len(l) != COLUNAS for l in corpo):
        raise ValueError("colunas")
    return [[x if x != "" else None for x in l] for l in corpo], sha, len(bruto)


def atender(cf, site, p, eh_montagem, relogio=time.monotonic):
    if p["total"] != len(p["arquivos"]):
        site.dados("POST", "request/fail", {"pedido_id": p["id"], "token": p["token"], "motivo": "inesperado", "detalhe": "total"})
        return {"desfecho": "inesperado"}
    raiz = os.path.join(cf["leitura"], "numerico")
    if not c.estado_filho(cf["leitura"], "numerico", eh_montagem)["sentinela"]:
        site.dados("POST", "request/fail", {"pedido_id": p["id"], "token": p["token"], "motivo": "nas_fora"})
        return {"desfecho": "nas_fora"}
    t0, ult, lidos, falhas, nas_caiu = relogio(), relogio(), [], [], False
    for i, a in enumerate(p["arquivos"]):
        if relogio() - t0 > cf["orcamento_s"]:
            site.dados("POST", "request/fail", {"pedido_id": p["id"], "token": p["token"], "motivo": "grande_demais", "detalhe": "orçamento"})
            return {"desfecho": "grande_demais", "lidos": i}
        _, rel = c.caminho_resumo(a["classe"], a["canal"], a["mes"], a["versao"], "canal")
        if rel != a["caminho"]:                                   # caminho refeito pelo contrato, nunca usado cru (item 104)
            site.dados("POST", "request/fail", {"pedido_id": p["id"], "token": p["token"], "motivo": "inesperado", "detalhe": "caminho"})
            return {"desfecho": "inesperado"}
        if nas_caiu or not c.estado_filho(cf["leitura"], "numerico", eh_montagem)["sentinela"]:
            nas_caiu = True
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "nas_fora"})
            continue
        caminho = os.path.join(raiz, rel)
        try:
            if not c.existe(caminho):
                falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "ausente"})
                continue
            linhas, sha, n = ler_resumo(caminho)
        except OSError:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "nas_fora"})
            continue
        except ValueError:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "ilegivel"})
            continue
        if sha != a["sha256"] or n != a["bytes"]:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "divergente"})
            continue
        lidos.append({"arquivo_id": a["arquivo_id"], "linhas": linhas})
        if (i + 1) % LOTE_PROGRESSO == 0 or relogio() - ult > PROGRESSO_S:
            ult = relogio()
            try:
                site.dados("POST", "request/progress", {"pedido_id": p["id"], "token": p["token"], "lidos": i + 1, "total": p["total"]})
            except Recusa as e:
                if e.code == "pedido_cancelado":
                    raise Cancelado()
                raise
    r = site.dados("POST", "request/result", {"pedido_id": p["id"], "token": p["token"], "lidos": lidos, "falhas": falhas})
    return {"desfecho": "ok" if not falhas else "incompleto", "estado": r.get("estado"), "lidos": len(lidos), "falhas": len(falhas)}
```

  `uma_volta` faz `site.dados("POST", "request/claim", {"versao": 1, "hora_maquina": c.agora_iso()})`, chama `atender` quando há pedido, captura `Cancelado` (`desfecho: cancelado`), `ArquivoDesligado` (`desligado`), `ChaveRecusada` (`chave`), `SiteFora` (`site_fora`), `Recusa` com `pedido_vencido`/`pedido_de_outro` (`vencido`). `main(argv)` aceita `--prova` (um claim, imprime e sai sem atender; teste próprio) e, sem argumento, faz o laço: lê a chave a cada volta (rotação sem reinício), `c.instalar_sigterm()`, batimento (`heartbeat` C8 com `c.corpo_batimento(cf["base"], filhos)`, filhos medidos pela montagem de **leitura**) no máximo a cada 60 s, `estado/respondedor-vivo.json` a cada volta, `registrar` só quando atende ou quando o desfecho da volta muda, e `dormir(intervalo)` (ou `pausa_desligado_s` com `desligado`). Exceção não prevista na volta: registra `bug` com o tipo e segue no laço depois de 60 s (o `systemd` só reinicia se o processo morrer; `StartLimitBurst` segura laço de morte). **Corpo do `result` acima de 4 MB:** o respondedor mede `len(json.dumps(...))` antes de enviar; acima, `fail grande_demais`.
- [ ] **Passo 4. `falsos.py`:** `SiteArquivoFalso` ganha `pedidos` (fila de respostas do claim), `resultados`, `progressos`, `falhas_pedido`, `cancelar_no_progresso`, e os quatro espelhos Zod (`zod_claim` confere 14 colunas em cada linha do `result`, `arquivo_id` só uma vez, motivo da lista).
- [ ] **Passo 5.** `bash ~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh > /tmp/m7-kit.txt 2>&1; tail -15 /tmp/m7-kit.txt` — todos passam (Python 3.12).
- [ ] **Passo 6. Commit no kit:** `git -C ~/Workspace/forja/ferramentas add -- arquivo/respondedor/responder.py arquivo/teste_respondedor.py` e `git -C ~/Workspace/forja/ferramentas commit -m "feat: arquivo M7: respondedor do período longo (só leitura, só resumos .canal listados, nas_fora sem montagem)" -- arquivo/respondedor/responder.py arquivo/teste_respondedor.py arquivo/comum.py arquivo/teste_comum.py arquivo/falsos.py arquivo/teste_tudo.sh`.

---

### Tarefa 12: serviço, modelo de ambiente e bloco do pulso

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service`
- Create: `~/Workspace/forja/ferramentas/arquivo/respondedor.env.modelo`
- Modify: `~/Workspace/forja/ferramentas/arquivo/pulso_arquivo.py`, `teste_pulso_arquivo.py`

**O que acontece quando o dado não existe:** `estado/respondedor-vivo.json` ausente → o bloco do pulso fica **vermelho** ("respondedor sem sinal"), nunca verde; mais velho que 120 s → vermelho; desfecho `chave`, `bug` ou `desligado` por mais de 30 min → amarelo com o desfecho; `NRestarts` lido pelo pulso subindo → amarelo.

- [ ] **Passo 1. Unidade** (molde `biblioteca-trabalhar.service`):

```ini
# /etc/systemd/system/arquivo-responder.service — M7: respondedor do período longo (só leitura do NAS)
[Unit]
Description=Arquivo: respondedor do relatório de período longo (M7)
After=network-online.target mnt-arquivo-leitura-numerico.mount
Wants=network-online.target
StartLimitIntervalSec=600
StartLimitBurst=5

[Service]
Type=simple
User=thiago
EnvironmentFile=-/opt/arquivo/respondedor.env
ExecStart=/usr/bin/python3 -B /opt/arquivo/respondedor/responder.py
Restart=on-failure
RestartSec=30
TimeoutStopSec=30
Nice=10
IOSchedulingClass=idle
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=tmpfs
ReadOnlyPaths=/mnt/arquivo/leitura /opt/arquivo/chaves /opt/arquivo/respondedor /opt/arquivo/comum.py /opt/arquivo/cliente_site.py
ReadWritePaths=/opt/arquivo/log /opt/arquivo/estado
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

  **Conferir** com `ssh forja 'ls /opt/arquivo; systemctl cat mnt-arquivo-leitura-numerico.mount | head -5'` (leitura) os caminhos reais de `comum.py` e `cliente_site.py` e o nome da unidade de montagem; ajustar `ReadOnlyPaths` e `After=` ao que existe.
- [ ] **Passo 2. `respondedor.env.modelo`** (molde `copiador.env.modelo`): as quatro variáveis comentadas com o padrão, e a linha "Nenhum segredo aqui: a chave mora em /opt/arquivo/chaves/respondedor.chave (M3a)".
- [ ] **Passo 3. Pulso.** `NOMES` ganha `respondedor`; o bloco lê `estado/respondedor-vivo.json` (não o `.jsonl`: o serviço não tem "execução do cron"); um modo `--so-bloco respondedor` imprime só o trecho novo para o dono acrescentar ao pulso instalado sem reescrever os outros (molde `--stdin`/`--remover` de `pulso_arquivo.py`). Testes: arquivo ausente → vermelho; velho → vermelho; `desligado` há 40 min → amarelo; bom → verde.
- [ ] **Passo 4.** `teste_tudo.sh` passa. Commit no kit `feat: arquivo M7: serviço do respondedor, modelo de ambiente e bloco do pulso`.

---

### Tarefa 13: a medida (2.700, 10.800 e 16.200 arquivos pelo NFS)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py`, `teste_medir_respondedor.py`
- Create (fora do git): `.superpowers/sdd/manutencao-nas/m7/m7-13-medir.sh`

**Interfaces:**
- `medir_respondedor.py --gerar N --pasta <escrita>/numerico/_medida-respondedor` cria N resumos sintéticos `.canal` (cabeçalho de 14 colunas, 2 linhas, gzip, tamanho ~300 B como o real) em árvore `serie/canais/<uuid>/resumo/<AAAA-MM>.v1.canal.csv.gz`; `--ler --pasta <leitura>/numerico/_medida-respondedor --lista <json>` lê pela função `ler_resumo` do respondedor (mesmo código) e imprime `{"n", "segundos", "ms_por_arquivo", "p95_ms"}`; `--apagar` remove a pasta inteira (só ela: recusa caminho que não termine em `_medida-respondedor`).

**O que acontece quando o dado não existe:** montagem ausente → o script sai com `PARE: montagem` sem criar nada; pasta da medida já existente → `PARE: sobra de medida anterior` (o dono apaga com `--apagar` depois de ler a saída).

- [ ] **Passo 1. Testes** (pasta temporária): gera 30, lê 30, apaga; recusa apagar fora do sufixo; a leitura usa `ler_resumo` importado do respondedor.
- [ ] **Passo 2. Commit no kit** `feat: arquivo M7: medida do respondedor (resumos sintéticos, só na pasta _medida-respondedor)`.
- [ ] **Passo 3. Arquivo de comandos do dono** (`m7-13-medir.sh`, um por linha; roda no Mac e só **escreve** na forja pelos comandos que o dono executa):

```bash
# M7, Tarefa 13: medir o respondedor por NFS. Rodar fora de 06:00–06:30 (a cópia do NAS às 06:10).
scp ~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py ~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py forja:/tmp/
ssh forja 'python3 -B /tmp/medir_respondedor.py --gerar 16200 --pasta /mnt/arquivo/escrita/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/medir_respondedor.py --ler 2700 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/medir_respondedor.py --ler 10800 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/medir_respondedor.py --ler 16200 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'python3 -B /tmp/medir_respondedor.py --apagar --pasta /mnt/arquivo/escrita/numerico/_medida-respondedor'
ssh forja 'rm -f /tmp/medir_respondedor.py /tmp/responder.py'
```

  Linha curta ao clipboard: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m7/m7-13-medir.sh > ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas/m7-13-medir.txt 2>&1`. **Conferir antes** que a pasta `_medida-respondedor` não colide com `RESERVADOS` nem com a varredura do copiador e do `conferir-b2` (eles só leem o que o plano do site lista: `grep -n "listdir\|scandir\|walk" ~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py ~/Workspace/forja/ferramentas/arquivo/conferir-b2/*.py`); se algum varrer a árvore, a medida usa pasta fora de `numerico/` (o dono escolhe onde, com quota) e o plano registra.
- [ ] **Passo 4. Ledger e decisão.** Anotar os três números. Regra: se 2.700 arquivos (a classe das medidas) passam de 780 s, `TETO_ARQUIVOS` baixa para `floor(780 s / p95)` (em `pedido.ts` e em `obs_archive_request_limits`) **antes** da Tarefa 14; se 10.800 ou 16.200 passam de 15 min, anotar como gatilho para quando outra classe entrar nas medidas (P22, M10b). Até a medida: `TETO_ARQUIVOS = 2700` NÃO MEDIDO.

---

### Tarefa 14: migration e produção (TRAVA M7-1b)

**Files:**
- Create: `supabase/migrations/<ts>_manutencao_m7_periodo_longo.sql` (por `npm run db:new manutencao_m7_periodo_longo`)
- Modify: `apps/web/test/helpers/m7.ts` (`M7_SQL_CAMINHO` aponta para a migration, `M7_EM_MIGRATION = true`)
- Delete: `supabase/rascunhos/m7.sql`

- [ ] **Passo 1.** Conferir a TRAVA M7-1b no ledger da M3b. `npm run db:new manutencao_m7_periodo_longo`; copiar o rascunho para o arquivo criado; `git rm -- supabase/rascunhos/m7.sql`; ajustar o helper.
- [ ] **Passo 2.** Banco local limpo: `npm run db:reset` no `bythiago_int` (ou o fluxo da M3b para ele) e a suíte de banco da M7 e da M3b (`HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m7 test/integration/observatorio-a5-e10-lista-fechada.test.ts --no-file-parallelism > /tmp/m7-t14.txt 2>&1`), só falhas no contexto.
- [ ] **Passo 3. Commit** `feat: M7: migration do período longo (fila, resultado, cálculo extraído, gatilho do apagar, poda)`.
- [ ] **Passo 4. Arquivo de comandos do dono** `m7-14-push.sh`: `npx supabase migration list --linked` (saída em `saidas/`); o controlador confere que a única pendente é a da M7; depois `npm run db:push:prod` (o dono digita `YES`). Janela fora de 11:30–13:00 UTC e dos minutos 0, 20 e 40.
- [ ] **Passo 5. Conferência em produção** (arquivo de comandos, só leitura por `supabase db query --linked`): as duas tabelas existem; `has_function_privilege('service_role', 'public.obs_archive_request_claim(uuid)', 'EXECUTE')` verdadeiro e `anon` falso; `select jobname, schedule from cron.job where jobname = 'cron_purge_obs_archive_requests'`; `select public.obs_archive_vigia_resultados()` = 0. Anotar "TRAVA M7-2 solta em <data hora>" no ledger.

---

### Tarefa 15: ligar o respondedor na forja (mão do dono; TRAVA M7-3)

**Files:**
- Create (fora do git): `.superpowers/sdd/manutencao-nas/m7/m7-15-instalar.sh`, `m7-15-conferir.sh`

- [ ] **Passo 1. Prova da rota.** A chave do respondedor só existe na forja, então a prova é do dono: a linha `responder.py --prova` do arquivo do Passo 2 (modo da Tarefa 11: um claim, imprime `pedido: null` ou o id e sai **sem atender**; o pedido real que ela pegar volta à fila quando o arrendamento de 3 min vencer, gastando uma das 2 tentativas). Esperado: `pedido: null`. Diferente disso, parar e não rodar o `enable --now`.
- [ ] **Passo 2. `m7-15-instalar.sh`** (um por linha, §16.6 do `05`):

```bash
# M7, Tarefa 15: instalar e ligar o respondedor. Depois da prova da rota (Passo 1).
scp -r ~/Workspace/forja/ferramentas/arquivo/respondedor forja:/tmp/respondedor
scp ~/Workspace/forja/ferramentas/arquivo/comum.py ~/Workspace/forja/ferramentas/arquivo/cliente_site.py ~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service ~/Workspace/forja/ferramentas/arquivo/respondedor.env.modelo forja:/tmp/
ssh forja 'sudo install -d -o thiago -g thiago -m 0755 /opt/arquivo/respondedor'
ssh forja 'install -m 0644 /tmp/respondedor/responder.py /opt/arquivo/respondedor/responder.py'
ssh forja 'install -m 0644 /tmp/comum.py /tmp/cliente_site.py /opt/arquivo/'
ssh forja 'cp -n /tmp/respondedor.env.modelo /opt/arquivo/respondedor.env && chmod 0600 /opt/arquivo/respondedor.env'
ssh forja 'sudo install -m 0644 /tmp/arquivo-responder.service /etc/systemd/system/arquivo-responder.service'
ssh forja 'sudo systemctl daemon-reload'
ssh forja 'python3 -B /opt/arquivo/respondedor/responder.py --prova'
ssh forja 'sudo systemctl enable --now arquivo-responder'
ssh forja 'rm -rf /tmp/respondedor /tmp/comum.py /tmp/cliente_site.py /tmp/arquivo-responder.service /tmp/respondedor.env.modelo'
```

  **Antes:** confirmar por leitura (`ssh forja 'md5sum /opt/arquivo/comum.py'` contra o do kit) que o `comum.py` instalado é o da M3b; se a cópia na forja estiver atrás (CLAUDE.md: "a cópia na forja está atrás"), a substituição do `comum.py` leva também as mudanças da M3b: conferir que o copiador e o `conferir-b2` passaram no `teste_tudo.sh` com este `comum.py` (Tarefa 11, Passo 5).
- [ ] **Passo 3. Bloco do pulso:** `python3 -B pulso_arquivo.py --so-bloco respondedor` gera o trecho; o dono o acrescenta pelo caminho que a M3b-forja usou para os outros blocos (`--stdin`), por arquivo de comandos.
- [ ] **Passo 4. `m7-15-conferir.sh`** (só leitura): `ssh forja 'systemctl show arquivo-responder -p ActiveState -p NRestarts -p ActiveEnterTimestamp'`; `ssh forja 'cat /opt/arquivo/estado/respondedor-vivo.json'`; `ssh forja 'tail -3 /opt/arquivo/log/respondedor.jsonl'`; e, no site, `supabase db query --linked "select worker, last_poll_at from public.obs_archive_heartbeat where worker = 'respondedor'"`. Esperado: `active`, `NRestarts=0`, desfecho `nada`, batimento com menos de 2 min.
- [ ] **Passo 5. Ponta a ponta** (com `OBS_ARQUIVO=on` e ao menos um mês destacado; antes de haver mês destacado, o ponta a ponta usa o pedido só online): o dono abre a página de um canal no Opera (`open -a Opera <url>`), pede 12 meses e confere "Aguardando a casa" → "Lendo" → pronto; com a montagem de leitura desmontada pelo dono (`sudo systemctl stop mnt-arquivo-leitura-numerico.mount`, se houver mês arquivado), confere "A forja respondeu, mas o NAS não está acessível" e remonta. Anotar no ledger.

---

### Tarefa 16: runbook

**Files:**
- Modify: `docs/ops/runbook-arquivo-mensal.md`

- [ ] **Passo 1.** Trocar a consulta 5 (`to_regclass`, "a fila do relatório ainda não existe") por `select public.obs_archive_vigia_resultados();` (esperado 0) e a consulta 6 do item 160 (pedidos ativos e vencidos: `select status, count(*) from public.obs_archive_requests group by 1`; resultados e bytes: `select count(*), sum(payload_bytes) from public.obs_archive_results`), com o que cada número quer dizer.
- [ ] **Passo 2.** Seção "Respondedor": o que é, como ver (`systemctl show`, `respondedor-vivo.json`, `respondedor.jsonl`), como **desligar** (`sudo systemctl disable --now arquivo-responder`: os pedidos vencem em 15 min com "A casa não respondeu"; nada se perde) e religar; que pedidos acumulados com a casa desligada **não** rodam no religamento (item 51); e o que fazer com `arquivo não bate` (pedir ao Claude Code para conferir o mês: a conferência do NAS da M3b).
- [ ] **Passo 3. Commit** `docs: M7: runbook do período longo (consultas 5 e 6, respondedor)`.

---

## Cobertura dos itens de aceite (`06` §18) desta etapa

| Item | Onde |
|---|---|
| 50 (vencido em 15 min, calculado na leitura) | Tarefa 4 (`obs_archive_request_state`), Tarefa 2 (frase) |
| 51 (acumulados com a casa desligada não rodam) | Tarefa 5 |
| 52 (pedido que derruba o respondedor ≤ 2 tentativas) | Tarefas 5 e 11 |
| 53 (clique duplo) | Tarefas 3 (índice) e 4 (função) |
| 54 (teto antes de inserir; total ≤ 8 MB expulsando o mais antigo) | Tarefa 6 |
| 55 (resposta zero é incompleto; fora do registro não pedido) | Tarefas 5 e 6 |
| 56 (sem corpo nem id de comentário) | Tarefas 1 e 6 |
| 57 (poda na lista fechada) | Tarefa 7 |
| 102 (`nas_fora`) | Tarefa 11 |
| 103 (selado do arquivo, não selado do online "parcial", nunca `ensaio`) | Tarefas 5 e 6 |
| 104 (medida fora da lista recusada; só resumos) | Tarefas 1, 4 e 11 |
| 105 (teste de tela por quadro) | Tarefa 10 |
| 160, consultas 5 e 6 | Tarefas 7 e 16 |
| 162 (1.001 arquivos; não lista pasta; vigia 5 = 1; medida 2.700/10.800/16.200) | Tarefas 5, 7, 11 e 13 |

## NÃO VERIFICADO (o plano escreveu sem ter rodado)

- O tempo por arquivo no NFS (5 a 50 ms é estimativa do spec) e, com ele, `TETO_ARQUIVOS = 2700` e o orçamento de 780 s: medida na Tarefa 13.
- O tempo de `obs_archive_request_online` para 75 canais e de `obs_archive_request_read` com o registro cheio: medidas locais nas Tarefas 4 e 6.
- Os nomes das colunas de `competitor_video_daily` usados em `obs_archive_request_create` (`site_id`, `channel_id`, `day`): conferência na Tarefa 4, Passo 2.
- Se o gráfico "Views por dia" existe na página real do canal (grep de 14/10 não achou): Tarefa 0, Passo 3.
- O corpo final de `obs_archive_summary_rows` que a M3b levar a produção (a M7 o recria): Tarefa 6, Passo 2.
- A regra do destaque de partição usada em "O primeiro sai em" (D15).
- Se a regex da lista fechada de banco pega funções `cron_purge_*` (Tarefa 7, Passo 3).
- O caminho real de `comum.py` e da unidade de montagem na forja, e se `copiador`/`conferir-b2` varrem pasta (o que tornaria a pasta da medida visível a eles): Tarefas 12 e 13.
- O custo de ~5.760 chamadas por dia do claim na Vercel (D19).

## Dependências de outras etapas e trilhas

- **M3b em produção** (Tarefas 10 e 11 dela: migration, `archive-auth.ts`, `contrato.ts`, rota `heartbeat` com `archive_read`, runbook) antes das Tarefas 1 (contrato.ts), 8 e 14; ordem das migrations M2 → M10a → M3b → M7.
- **M5** (telas): a peça 1 ("no arquivo") e, se existir, o gráfico onde o "Ver antigo" se ancora; o bloco de CSS do mockup 19.
- **M8**, passo 9 do ensaio: usa o tipo `ensaio` desta fila (`obs_archive_request_create(..., 'ensaio', ...)`); a M7 entrega a função e o filtro de classe, a M8 o disparo.
- **M10b**: `ficha_do_video` (P22) e a classe `video_antigo` nas medidas; até lá recusadas.
- **M9**: o expurgo marca `purged_at`; a M7 já trata purgado depois do claim.
- **Mão do dono, antes da partida para a Ásia (jan/2027):** medida (Tarefa 13), `db:push:prod` (Tarefa 14), instalação e ponta a ponta na forja (Tarefa 15).
- **Remessas ao Logan** (Tarefa 10, Passo 1) e revisão de Phil e Yannis do plano, antes da execução.
