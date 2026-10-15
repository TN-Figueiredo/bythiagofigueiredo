# Fase de manutenção (NAS e forja), M7: período longo (a peça 6, "Ver antigo"). Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revisão 1 (14/10 noite):** consertos dos pareceres de Phil (C1 a C3, I1 a I9, M1 a M8), Yannis (I-1 a I-12, M-1 a M-12) e Logan (5 respostas). Tabela achado → onde ficou: `.superpowers/sdd/manutencao-nas/resolucao-plano-m7.md`. Dois blocos pedem o dono antes de qualquer código: **"Levar ao dono antes do código"** (muda o mockup aprovado) e **"Decisão do dono pendente (muda o spec)"** (D19, custo do claim).

**Goal:** quem edita o site pede, na página do canal, o relatório de um período que já saiu do banco (12, 24 ou 36 meses), e recebe, sem ficar esperando na página, uma lista por mês com dias medidos, origem e views, montada dos **arquivos de resumo por canal** guardados no NAS (meses selados) e do banco (meses ainda não selados, marcados "parcial"). A forja atende pelo **respondedor**, um serviço contínuo de só leitura que pega o pedido, lê só os arquivos que o site lista, e devolve linhas e falhas por arquivo; o site confere contra o registro, guarda o resultado por 30 dias e mostra cada um dos 15 estados da peça 6 com a frase aprovada (mais as mudanças de texto da seção abaixo, depois da aprovação do dono). **Todo par (canal, mês) do pedido aparece no resultado exatamente uma vez**, com estado próprio (nunca some, nunca vira zero). Item 12 do `05` §15.1: o claim leva a lista dos arquivos, e a medida do respondedor com 2.700, 10.800 e 16.200 arquivos sintéticos lidos por NFS fixa o teto antes da entrega.

**Architecture:** uma migration (`*_manutencao_m7_periodo_longo.sql`, rascunho em `supabase/rascunhos/m7.sql` até a vez dela: TRAVA M7-1) cria a fila (`obs_archive_requests`), o resultado (`obs_archive_results`), as funções da fila (criar, cancelar, ler, status, claim, progresso, conferência, online, resultado, falha), o gatilho que apaga resultado e cancela pedido quando um canal é removido com `apagar`, a consulta do vigia 5 e a poda diária. **O cálculo do resumo (`obs_archive_summary_calc`) é extraído no rascunho da M3b** (pedido registrado em `m3b-site-progresso.md`, seção "Pedido da M7 para a Tarefa 10"); a M7 só o consome. No site: módulos puros em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/` (contrato do pedido, estado efetivo, frases da peça 6) entram antes da migration; as quatro rotas `POST /api/pipeline/archive/request/{claim,progress,result,fail}`, as server actions e o painel "Ver antigo" na página do canal só depois de ela estar em produção (TRAVA M7-2). Na forja: `arquivo/respondedor/responder.py` (biblioteca padrão, Python 3.12, montagem de leitura `ro`), a unidade `arquivo-responder.service`, o bloco do pulso e o programa de medida; tudo instalado pelo dono por arquivos de comandos (TRAVA M7-3).

**Tech Stack:** PostgreSQL 17 (Supabase), PL/pgSQL, pg_cron, Next.js 16 (route handlers, server actions, client component), TypeScript strict, Zod, Vitest, `pg` nos testes de integração; Python 3.12 só com biblioteca padrão; systemd.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos: `05` §15.1 (linha M7, item 12) e §16.6 (instalar o serviço); `02` §10.6 (fila, respondedor, resultado, custo); `02` §11.2 (comentário nunca no resultado); `03` linha 46 (linha 11 da tabela de falhas) e linha 140 (passo 9 do ensaio, M8); `04` §14.6 (peça 6, 15 estados); `06` §18 itens 50 a 57, 102 a 105, 160 (consultas 5 e 6) e 162; `06` §19 R40, P22, P45 (retirada). O `00` §3 (D1 a D27) vale como lei. Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md` (seção final: rota com chave, sem papel de banco; "o que exige a casa, M7 incluída, fecha antes da partida").

**Mockup aprovado (fonte da tela; não redesenhar, salvo a lista abaixo):** `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/peca6-ver-antigo.html`, `peca6.js` (frases exatas nas funções `antes`, `semArquivo`, `desligado`, `enviado`, `lidos`, `andamento`, `pronto`, `venceu`, `incompleto`, `bate`, `naoResp`, `nasFora`, `grande`, `repetido`, `cancelado`, `naoMedido`), o bloco da peça 6 em `m19.css`, `NOTAS.md` linhas 78 a 120 e o roteiro `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` §19e (linhas 1199 a 1220). Aprovado pelo dono em 14/10.

## LEVAR AO DONO ANTES DO CÓDIGO (muda o mockup aprovado)

Os pareceres do Logan (14/10) e a conferência da data mudam texto e posição de um mockup que o dono já aprovou. **Nenhuma linha da Tarefa 10 (nem o teste dela) começa antes de a lista abaixo estar no ledger como "aprovada pelo dono em <data>"**; as Tarefas 1 a 9 e 11 a 13 não dependem dela (a Tarefa 2 grava as frases como constantes e o teste da Tarefa 2 muda junto com a aprovação). O controlador leva ao dono, com os quadros do mockup afetados:

| # | Muda | De (mockup aprovado) | Para | Quadro |
|---|---|---|---|---|
| L1 | Rótulo de origem de cada mês | "do banco" sem marca nos meses ainda online | por estado do mês, nunca por estar online: selado com dado "da cópia no NAS" (visto, sem marca); não selado "do banco, ainda sem cópia" + marca "parcial"; selado vazio "Sem registro neste mês (conferimos em dd/mm)" (dd/mm = dia da selagem). O rótulo "do banco" sozinho não existe | `p-ok` |
| L2 | Frase de "antes de pedir" | "12 meses: 6 online, 6 no arquivo" (conta por onde o mês está) | por origem da leitura: "Vai ler os 12 meses de <canal>: 11 vêm da cópia no NAS e 1, o mês corrente, do banco (parcial)." A linha de apoio "depende de a casa estar ligada" fica | `a-pedir` |
| L3 | Frase do erro `inesperado` (D16) | "A casa encontrou um erro ao montar o relatório. Nada foi perdido." + PODE | lead "Não deu para montar o resultado. Nada foi perdido."; sub "Peça de novo. Se acontecer outra vez, avise o Claude Code para investigar e diga a hora do pedido (hh:mm)."; triângulo âmbar `role="alert"` com o botão "Pedir de novo" (o mesmo do `x-nas`); nunca mostra `fail_detail` | sem quadro (estado novo) |
| L4 | Data e verbo de "O primeiro sai em" | "O primeiro sai em 01/02/2027." (`peca6.js` linha 81) | **"Ainda não há mês no arquivo. O primeiro pode sair do banco a partir de 01/03/2027."** (a data certa é 01/03/2027, ver D15). Data já passada e ainda sem mês: "Ainda não há mês no arquivo. O primeiro já pode sair: a saída é na página do Arquivo." (link só para quem edita). Data não calculável: "Ainda não há mês no arquivo." sem data. Quem só lê: mesma frase sem o link, em quadro cinza discreto (`--muted`), uma linha, sem botão | `a-nada` |
| L5 | Onde mora a tira | "logo abaixo do gráfico Views por dia" | o gráfico não existe na tela real nem no mockup 15 aprovado; a tira vai **entre `<CanalHeader>` e `<AbasNav>`** de `apps/web/src/app/cms/(authed)/youtube/competitors/_canal/canal-screen.tsx` (linhas 508 a 510), largura total, uma linha, 390 px: texto em cima, botão embaixo (alvo de 44 px). Desvio de lugar, sem novo mockup | `a-pedir`, `a-nada` |
| L6 | Mês online sem linha: "0 de 31 dias medidos" (nunca escrever) | "0 de 31 dias medidos" | 4 casos por o que o banco sabe: (1) mês anterior à coleta do canal: "A coleta deste canal começou em <mês>/<ano>." (sem barra, sem número; mês e ano porque o dia exato some do banco quando o mês sai); (2) mês fechado, canal já coletado, nenhuma linha: "Sem registro neste mês (conferimos em dd/mm)" com a caixa vazada; (3) mês corrente sem linha ainda: "Sem registro neste mês até agora (conferimos em dd/mm)" + marca "parcial"; (4) ao menos 1 dia medido: "N de M dias medidos" com a barra. N = 0 nunca aparece | `p-ok` |
| L7 | Textos que este plano acrescenta (derivados dos pareceres de Phil/Yannis; o Logan não os escreveu) | não existiam | mês que falta no resultado, por motivo: `sem_copia` "A cópia deste mês não está no arquivo."; `expurgado` "Este mês foi apagado do arquivo em dd/mm."; `sem_registro_do_canal` "O arquivo não tem este canal neste mês."; resultado vencido sem resultado gravado: usa a frase aprovada "O resultado de dd/mm venceu. Peça de novo."; método no ⓘ de "Views do mês" ("soma, por vídeo, da última leitura do mês menos a primeira; o ganho entre o último dia de um mês e o primeiro do seguinte não entra") e "não medido" quando a soma é nula; tira por mês ("Views por dia: ago/2026 a set/2027 no arquivo.", não por dia, porque o dia exato da primeira leitura não fica no banco depois que o mês sai) | `x-inc`, `p-ok`, tira |

Sugestão do Logan (não bloqueia): se o Gio medir que a frase fixa "Ainda não há mês no arquivo." empurra a lista de vídeos a 390 px, esconder a tira nesse estado e deixar a frase só na página do Arquivo.

## DECISÃO DO DONO PENDENTE (muda o spec): custo do claim

O spec (`02` §10.6) fixa a consulta do respondedor a cada 15 s. Phil (I1) mediu o custo; **a variante B é a recomendada** e é a que o plano implementa; a variante A reproduz o spec com a mesma variável. O dono decide; enquanto não decidir, o padrão no código é o da B (um número só muda no `respondedor.env`).

| | A (spec) | B (recomendada) |
|---|---|---|
| Claim | a cada 15 s sempre: 86.400 ÷ 15 = 5.760/dia | a cada **15 s** enquanto houve pedido nos últimos 15 min (~60 por pedido), a cada **60 s** quando ocioso: 86.400 ÷ 60 = 1.440/dia |
| Batimento | rota `heartbeat` 1 por minuto: 1.440/dia | o **claim é o batimento** (a RPC grava `last_poll_at` do trabalhador `respondedor`); a rota `heartbeat` só a cada 10 min para disco e montagens: 144/dia |
| Total/dia | **7.200** (~216.000/mês; 6,5 vezes as ~1.107/dia do site inteiro depois do custo zero, `docs/ops/plano-custo-zero.md:114`) | **~1.584 ocioso** (−78%), mais ~60 por pedido atendido |
| Custo para o dono | nenhum | até 60 s a mais em "Aguardando a casa", dentro dos 15 min de validade do pedido |
| Como ligar | `ARQ_RESP_INTERVALO_OCIOSO_S=15`, `ARQ_RESP_BATIMENTO_S=60` | padrão (`60` e `600`) |

Frase para a Hanna: "a casa pergunta a cada minuto quando ninguém pediu nada e a cada 15 s quando há pedido; o site gasta um quinto das chamadas". Confirmação em produção: Tarefa 15, Passo 6 (contagem de invocações do claim em 24 h).

**Planos aprovados que este consome (por `grep`, sem copiar):** M3b-site (`...-m3b-site.md`; contrato r2.5 em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md`: C0 regras, C0.2 caminho do resumo, C8 batimento, C10 "request/* são da M7"; Tarefa 11: `archive-auth.ts` com `authenticateArchive`, `arquivoLigado`, `TRABALHADOR.archive_read = 'respondedor'`, `erroDoRpc`; Tarefa 1: `contrato.ts` com `STATUS_DO_CODIGO`, `CODIGOS`, `caminhoDoResumo`; Tarefa 14: `docs/ops/runbook-arquivo-mensal.md` com a consulta 5 em `to_regclass`); M3b-forja (`...-m3b-forja.md`: `comum.py`, `cliente_site.py`, `falsos.py`, `pulso_arquivo.py`, `teste_tudo.sh`); M3a (`...-m3a-casa.md`: chave `respondedor.chave` com `archive_read`, montagens `/mnt/arquivo/leitura/{numerico,texto}` `ro`, CP10 aceito).

**Quem é o outro lado:** o respondedor (Tarefas 11 a 13, kit da forja) lê a seção "Contrato das rotas do pedido" abaixo, gravada também em `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md` (Tarefa 1, Passo 6; **criado junto com esta revisão do plano**, r1.1). **Este plano é o dono do contrato.**

---

## Global Constraints

- **Migration só no dia, e por `npm run db:new manutencao_m7_periodo_longo`** (Tarefa 14). Até lá o SQL vive em `supabase/rascunhos/m7.sql` (rastreado; o CLI só lê `supabase/migrations/`). O nome leva `_manutencao_` (o teste da M2, Tarefa 1, a reconhece por isso).
- Idempotência: `create table if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`, `cron.unschedule` guardado antes de `cron.schedule`.
- Tabelas novas em `public`, RLS ligada, policy de leitura `public.can_edit_site(site_id)` (memória `reference_rls_guc_spoof_pattern.md`: leitura sensível nunca por `can_view_row`), **nenhuma** policy de escrita; `revoke all ... from public, anon, authenticated` **e** `revoke insert, update, delete, truncate, references, trigger ... from service_role` (molde da M3b, Global Constraints). Nenhuma chave estrangeira para canal, vídeo ou site (`02` §10.1). Funções novas: `security definer`, `set search_path = ''`; **produção já tem `20261014000007` (A5): função nova em `public` nasce sem EXECUTE para `anon`/`PUBLIC`**; mesmo assim cada função leva `revoke all on function ... from public, anon, authenticated` explícito, as internas também `from service_role`, e `grant execute ... to service_role` só onde a rota ou a server action chama. Permissão se testa com `has_function_privilege`, nunca chamando como `anon`/`authenticated` (SIGSEGV no Postgres local).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se a pendente for exatamente a do dia. Janela: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), arquivos **em série** (`--no-file-parallelism`; paralelo dá deadlock na M3b, ledger dela; a CI é série, `ci.yml:149`), cada teste dentro de `begin … rollback`. O rascunho da M3b é pré-requisito (aplicado por `aplicarM3b` de `apps/web/test/helpers/m3b.ts` enquanto `M3B_EM_MIGRATION=false`). **Relógio de teste:** `obs_archive_agora()` lê a GUC `obs_archive.agora` e `obs_archive_hoje_sp()` lê `obs_archive.hoje` (`m3b.sql:1441-1443` e `420-422`); o teste faz `select set_config('obs_archive.agora', '<iso>', true)` dentro da transação, nunca `create or replace` da função. Corridas entre duas conexões só com `M7_CORRIDAS=1`.
- TypeScript strict, sem `any`; Zod na borda com `.safeParse` (nunca `as` sobre dado de RPC); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito no `staging`; arquivo novo: `git add -- <caminhos>` antes do `git commit -- <caminhos>`; nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Kit da forja: `git -C ~/Workspace/forja/ferramentas add -- <caminhos>` e `git -C ~/Workspace/forja/ferramentas commit -- <caminhos>`.
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de Modify, `git diff --stat -- <arquivo>`; com mudança alheia, não editar nem commitar: registrar no ledger o arquivo, `git log -1 --format=%an -- <arquivo>` e a data; o controlador pergunta na manhã seguinte (regra da M3b).
- `.superpowers/` é ignorado pelo git: ledger (`.superpowers/sdd/manutencao-nas/m7-progresso.md`), arquivos de comandos (`.superpowers/sdd/manutencao-nas/m7/`) e saídas (`.superpowers/sdd/manutencao-nas/saidas/`) nunca entram em commit. O que teste ou CI lê vive em caminho rastreado.
- **NAS e forja: escrita é do dono, sem exceção.** Nenhum agente roda `ssh forja '<escreve>'`, `scp`, `install`, `systemctl`, `crontab -` nem `mv` lá. O agente prepara um ARQUIVO de comandos (curtos, um por linha) e uma linha curta que o roda com saída em `saidas/`, posta no clipboard (`pbcopy`), uma de cada vez, a próxima só depois do resultado (memória `feedback_comando_no_clipboard.md`). Leitura por `ssh forja '<leitura>'` é permitida e esperada. Nenhum agente cria nem revoga chave: o respondedor usa a `respondedor.chave` que a M3a já instalou.
- **O sistema falha em VERDE.** Cada passo diz o que acontece quando o dado NÃO existe (mês sem registro, resumo vazio, arquivo ausente, NAS desmontado, heartbeat nunca gravado, variável apagada, casa desligada) antes do que acontece quando dá erro. Nenhum estado da tela vira "sem dados" nem zero por falta de leitura. **Invariante central:** para todo pedido concluído, `jsonb_array_length(payload->'meses') = cardinality(months) × cardinality(resolved_channel_refs)`; a função que grava o resultado levanta `invariante_do_resultado` (500) se não bater.
- Variáveis com padrão (respondedor): `ARQ_RESP_INTERVALO_S` (15, com pedido recente), `ARQ_RESP_INTERVALO_OCIOSO_S` (60), `ARQ_RESP_BATIMENTO_S` (600), `ARQ_RESP_ORCAMENTO_S` (780), `ARQ_RESP_PAUSA_DESLIGADO_S` (300), `ARQ_MONTAGEM_LEITURA` (`/mnt/arquivo/leitura`), mais as comuns (`ARQ_SITE`, `ARQUIVO_BASE`, `ARQUIVO_CHAVE_ARQ`). Cada uma com **teste que a apaga** e afirma o padrão, e com teste do valor ilegível (vira `bug`, nunca o padrão calado; regra do `config` da M3b). No site não há variável nova: a peça 6 obedece `OBS_ARQUIVO` (só `on` liga), cujo teste de apagar já existe na M3b.
- **Orçamento acoplado da fila da forja (CLAUDE.md, "A forja") não é tocado:** o respondedor é outro processo, com `Nice=10` e `IOSchedulingClass=idle`, sem cron, e não lê `youtube_intelligence_tasks`.
- Sem datas-meta. O único relógio é o do dado e o da partida: **em jan/2027 o dono está na Ásia**; a instalação na forja (Tarefa 15) e a medida (Tarefa 13) são mão do dono em casa e fecham antes da partida (decisoes-dono-14-10, "o que exige a casa"). O respondedor tem o que ler desde a primeira selagem (devida em 28/11/2026); a tela só oferece o botão quando houver mês fora do banco, que pela regra da janela só existe a partir de 01/03/2027 (D15); por isso a **conferência do NAS por SQL entre 28/11/2026 e a partida** (Tarefa 15, Passo 7) é portão da partida.

## Travas e ordem de execução

- **TRAVA M7-0 (dependência de teste):** as Tarefas 3 a 5 e 7 só começam com `git ls-files apps/web/test/helpers/m3b.ts supabase/rascunhos/m3b.sql` listando os dois e com `grep -n "export async function aplicarM3b" apps/web/test/helpers/m3b.ts` achando a função. **TRAVA M7-0b (cálculo extraído, Yannis I-9):** a Tarefa 6 só começa com `grep -n "function public.obs_archive_summary_calc" supabase/rascunhos/m3b.sql` achando a função (o pedido está em `m3b-site-progresso.md`, "Pedido da M7 para a Tarefa 10"); se a M3b já tiver virado migration sem ela, vale o plano B do D10 (a M7 cria a função e repete o `diff` contra `pg_get_functiondef` na Tarefa 14, Passo 1). Faltando a trava 0, a M7 faz as Tarefas 0, 1, 2 e 11 a 13 (puras ou do kit) e registra a espera.
- **TRAVA M7-1:** nenhum arquivo `*_manutencao_m7_*` em `supabase/migrations/` antes da Tarefa 14, Passo 1. O teste `apps/web/test/manutencao/m7-trava.test.ts` (Tarefa 3) segura a trava.
- **TRAVA M7-1b (dependência de produção):** a Tarefa 14 só começa com a M3b aplicada em produção e conferida no ledger dela ("TRAVA M3b-2 solta em <data hora>" em `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md`). A M7 lê `obs_archive_summaries`, `obs_archive_units`, `obs_archive_months`, `obs_archive_heartbeat`, `obs_archive_channel_removals`, `obs_archive_summary_calc`. Ordem das migrations em produção (brief da onda 2): M2 (15/10) → M10a → M3b → **M7**. **Volta atrás da M3b antes de 28/11 (runbook M3b, (e)) passa a exigir desfazer a M7 antes** (a M7 tem gatilho em tabela da M3b): uma linha na Tarefa 16.
- **TRAVA M7-2:** nenhuma linha das Tarefas 8, 9 e 10 (rotas, server actions, painel), nem na árvore sem commit, antes de a migration da M7 estar aplicada em produção e conferida (linha "TRAVA M7-2 solta em <data hora>" no ledger). Parte mecânica no `m7-trava.test.ts`: sem migration `*_manutencao_m7_*`, `apps/web/src/app/api/pipeline/archive/request` não existe e nenhum arquivo em `apps/web/src/app/cms/(authed)/youtube/competitors/canal/` **nem em `.../competitors/_canal/`** contém `obs_archive_request`. Motivo (P47 da M3b): com o código no `staging`, a promoção de outra frente o leva a produção antes da função, e o painel responderia "Não foi possível ler o estado do pedido" para sempre.
- **TRAVA M7-2b (dono):** a Tarefa 10 também espera a lista "Levar ao dono antes do código" aprovada (ledger).
- **TRAVA M7-3 (forja, mecânica):** o respondedor só é ligado (Tarefa 15) por um arquivo **separado** (`m7-15-ligar.sh`) que o controlador só entrega depois de ler `pedido: null` e código de saída `0` na saída de `m7-15-prova.sh`; a prova é uma chamada que **não toma pedido** (`prova: true`, Tarefa 5) e a rota tem de estar em produção respondendo `200`.
- **Ordem:** 0 → 1 → 2 → (TRAVA M7-0) 3 → 4 → 5 → (TRAVA M7-0b) 6 → 7 → 11 → 12 → 13 (medida; pode correr em paralelo a 3–7 assim que a Tarefa 11 existir) → **14** (migration; TRAVA M7-1b) → 8 → 9 → 10 (TRAVA M7-2b) → 15 → 16. Tarefas 1, 2, 11, 12 e 13 são puras (TypeScript sem banco, ou kit) e podem ser commitadas antes da migration.
- **Dívida declarada:** entre as Tarefas 3 e 14 o SQL só é provado no banco local e na CI (`ci.yml` roda `HAS_LOCAL_DB=1 npm test -- integration/ --no-file-parallelism`). Gatilho de pagamento: Tarefa 14, Passo 1. Segunda dívida: a medida da Tarefa 13 pega o cache do NAS quente (arquivos recém-gerados): é **piso, não teto**; gatilho: a primeira leitura real lenta refaz a medida com arquivos antigos.

## Review Focus

1. **Nunca "sem dados" por falta de leitura (falha em verde).** Mês com linhas esperadas no registro e resposta zero, ausente ou diferente é **incompleto** com motivo; mês sem entrada no registro nunca é pedido; NAS desmontado ou sem sentinela é `nas_fora`, nunca `arquivo_ausente` nem mês vazio; pedido nunca atendido vence em 15 min (`sem_trabalhador`), calculado na leitura; **nenhum par (canal, mês) do pedido some do resultado** (invariante central) (Tarefas 4 a 6, 11).
2. **O site confere; o respondedor só lê.** O `result` recalcula o esperado do registro (linhas do resumo e `hash_conteudo` de cada unidade, **em par com a tabela e com `row_count`**); o respondedor não lista pasta, não deduz do manifesto, abre só os caminhos que o claim mandou e só arquivos de resumo `.canal` (Tarefas 6, 11).
3. **Fila sem duplicado e sem laço.** Índice único parcial por (site, impressão) nos ativos; o contador de tentativas sobe **antes** de processar; teto 2; pedido vencido nunca é pego; pedidos acumulados com a casa desligada vencem, não rodam no religamento; resumo purgado depois do claim volta o pedido a `pending` **uma** vez; o pedido só online nunca depende da forja (Tarefas 4, 5, 6).
4. **Teto de tamanho antes de inserir** (512 kB por resultado; 8 MB no total, expulsando o mais antigo na mesma função, sob trava) e **nada de comentário** no resultado (Tarefa 6).
5. **Remoção de canal com `apagar`** cancela o pedido e depois apaga o resultado na mesma transação (nessa ordem), inclusive pedido sem lista de canais; o `finish` recusa se o canal foi removido; a consulta 5 do vigia acha o resultado plantado (Tarefa 7).
6. **Costura**: mês selado vem sempre do resumo no arquivo; mês não selado vem do banco pela **mesma** função que gera o resumo (`obs_archive_summary_calc`, com os mesmos `SET` da selagem), marcado "parcial"; pedido real nunca lê a classe `ensaio` (Tarefa 6).
7. **Cada estado da tela com a frase aprovada** e nenhum estado novo sem remessa ao Logan/dono (Tarefas 2, 10).

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
| `competitor_video_daily` é `(video_id, snap_date, views, likes, comments, taken_at)`, PK `(video_id, snap_date)`, **sem** `site_id`, `channel_id` nem `day`; o site e o canal vêm de `competitor_videos.competitor_channel_id` → `competitor_channels.site_id` | `supabase/migrations/20261003000002_observatorio_versoes.sql:31-39`; molde do join em `m3b.sql:1958-1966` |
| `obs_archive_agora()` lê a GUC `obs_archive.agora`; `obs_archive_hoje_sp()` lê `obs_archive.hoje` | `m3b.sql:1441-1443`, `420-422` |
| `obs_archive_summary_rows` fixa `set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'`; o bloco `execute format(...) into v_c, v_v using ...` mora em `m3b.sql:1110-1127`, dentro do laço que abre na 1106 e fecha na 1130 | `m3b.sql:1073-1075`, `1106-1130` |
| `obs_archive_summaries.unit_hashes` é `{"u:<id da unidade>": "<hash_conteudo>"}`; `obs_archive_units` tem `table_name`, `row_count`, `hash_conteudo` | `m3b.sql:184-202`, `59-70`, `769-773` |
| `obs_archive_months.sealed_kind` ∈ `com_dado`, `vazio_conferido`, `sem_dado_a_guardar`; uma linha por (classe, tabela, mês) | `m3b.sql:113-125` |
| `obs_archive_channel_removals.archive_decision` ∈ `apagar`, `guardar`; `sem_destino` é canal ausente de `competitor_channels` **sem** linha de remoção | `m3b.sql:204-224` e `2546-2597` |
| `obs_archive_heartbeat` tem chave `(site_id, worker)` e `worker` aceita `respondedor` | `m3b.sql:157-163` |
| A janela da política é `obs_archive_policy()`, `serie` = 6 meses; **o mês M pode sair em 1º dia de M + janela + 1 meses** (com janela 6, outubro sai em 01/05; novembro a abril fechados) | spec `02` linha 275 (condição 2); `04` linha 115; plano M6, `v_pode := (p_month + make_interval(months => pol.window_months + 1))::date` (linha 1093) e teste `pode_sair_em 2027-05-01` (linha 825); `m3b.sql:10-14` |
| Funções `cron_purge_*` gravam `cron_runs (job, ran_at, status, duration_ms, items_processed)` com job `pg_cron:purge-<nome>`; jobs agendados `purge-cron-runs` (`10 6`) e `purge-yt-own-collection-attempts` (`50 6`) | `20261014000001_manutencao_m1_podas_execucao.sql:136-165` |
| O teste da lista fechada olha `^(competitor_|yt_|youtube_channel_|obs_)` (**não** pega `cron_*`) e exige uma chamada de 24 meses para toda função com `disparo: 'cron'` | `observatorio-a5-e10-lista-fechada.test.ts:69` e `132-141` |
| `CanalScreen` mora em `apps/web/src/app/cms/(authed)/youtube/competitors/_canal/canal-screen.tsx` (não em `canal/_canal/`); `<CanalHeader …/>` na linha 508 e `<AbasNav …/>` na 510; não há gráfico "Views por dia"; a página é `competitors/canal/[id]/page.tsx` (linha 9 importa `../../_canal/canal-screen`, linha 92 renderiza) | leitura de 14/10 noite |

## Decisões deste plano (o que o spec deixou ao plano, ou que o plano muda, com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Medidas v1 (lista fechada):** `linhas`, `videos_com_linha`, `dias_medidos`, `dias_do_mes`, `var_views`, `var_likes`, `var_comments` da linha `competitor_video_daily` do resumo `.canal` da classe `serie`. Nenhuma outra classe nem tipo de resumo é aberto. `ficha_do_video` (P22) é **recusada** (`medida_fora_da_lista`) até a M10b | `02` §10.6 ("colunas do resumo por canal"); a tela mostra dias medidos e views; `obs_archive_summary_rows` recusa `video_antigo` (`resumo_da_m10b`) |
| D2 | **O "esperado" de cada arquivo**, conferido pelo site no `result`: (a) `jsonb_array_length(linhas) = canal_rows` do resumo; (b) **cada linha, em par**: existe unidade em `unit_hashes` com `table_name = linha[1]`, `hash_conteudo = linha[12]` e `row_count = linha[4]`; (c) todas as células numéricas casam a regex de número (senão `divergente`, nunca `22P02`); (d) existe a linha `competitor_video_daily`. O respondedor confere o **cabeçalho** do CSV contra `COLUNAS_CANAL` (nome e ordem). Diferença em qualquer um: mês `divergente` | O spec fala em "linhas e soma esperadas"; o resumo não tem coluna de controle; o hash da unidade é o que o resumo carrega e o registro guarda (desvio declarado, mais forte que a soma; Phil I7) |
| D3 | **Falhas por arquivo** (`ausente`, `divergente`, `nas_fora` no meio da leitura, `ilegivel`) viajam dentro do `result` e viram meses incompletos; `fail` é só para o pedido inteiro (`nas_fora` antes do primeiro arquivo, `grande_demais`, `inesperado`) | O mockup mostra "faltam 2 de 12 meses ... porque o NAS deixou de responder durante a leitura" com os outros 10 meses presentes (quadro `x-inc`) |
| D4 | **Carga como `jsonb`** com teto de 512 kB medido por `octet_length(payload::text)` (texto **não** comprimido) e total de 8 MB pela soma de `payload_bytes`. Uma entrada do payload custa até `BYTES_POR_ENTRADA = 300` bytes (medido por teste); o teto de entradas é `floor(524288 / 300) = 1747` e vale para **canais × meses** do pedido, checado na criação | Postgres 17 não tem gzip em SQL; medir o texto é mais restritivo que o spec ("comprimida ≤ 512 kB"). Phil I2 / Yannis M-2: 2.700 entradas de ~250 B passavam do teto; o pedido no teto lia o NAS por 13 min para morrer em `grande_demais` |
| D5 | **Cancelar também durante a leitura** (mockup, quadro `e-and`); o respondedor sabe pelo `progress` (`409 pedido_cancelado`) e para | O spec diz "dono pode cancelar pendente"; o mockup aprovado tem "Cancelar pedido" no andamento |
| D6 | **Estado efetivo calculado na leitura** (`obs_archive_request_state`): `pending` com `expires_at` passado → `expired/sem_trabalhador`; `running` com `deadline_at` passado → `expired/sem_trabalhador`; `running` com arrendamento vencido e `attempts >= 2` → **`failed/inesperado`** (o respondedor atendeu duas vezes e morreu; a frase "A casa não respondeu" seria falsa). O claim grava exatamente o estado que a leitura calcula (passo 1 do claim); não há passo 2 separado. A poda diária só normaliza o que a leitura já mostra | `02` §10.6 ("expiração calculada na leitura") e item 50; Yannis I-1 |
| D7 | **Um pedido = (site, tipo, canais, meses, medidas).** A tela pede sempre um canal; a função aceita `p_channels` nulo ("todos", para o ensaio e uso futuro). Impressão = `md5` do texto normalizado; o índice único parcial `(site_id, fingerprint) where status in ('pending','running')` recusa o segundo ativo (`repetido`). **`resolved_channel_refs` é gravado na criação** (nomeados, ou todos os canais do site sem remoção `apagar`), nunca nulo | Item 53; `02` §10.6; Phil C2 |
| D8 | **Meses do pedido:** os N meses de calendário que terminam no mês corrente de São Paulo; "Tudo" = desde o primeiro mês com dado do canal (registro ou diária). Mais de 36 meses **ou** mais de 1747 pares (canal × mês) → `grande_demais` **na criação** (o botão "Pedir" já vem desligado na tela) | Mockup (`LIM = 36`); item 12; D4 |
| D9 | **Origem de cada mês** (L1, L6): selado `com_dado` com resumo do canal não vazio → do arquivo ("da cópia no NAS"); selado `vazio_conferido`/`sem_dado_a_guardar` ou resumo do canal `empty` → `vazio_conferido` com a data de `sealed_at`, sem abrir arquivo; selado `com_dado` sem resumo utilizável → `faltou` com motivo (`sem_copia`, `expurgado`, `sem_registro_do_canal`); mês anterior ao primeiro mês com dado do canal → `antes_da_coleta`; não selado → do banco por `obs_archive_summary_calc`, "parcial" (com `dias_medidos = 0` vira `sem_registro`, nunca "0 de 31"). O rótulo "do banco" sozinho não existe: mês selado vem sempre do arquivo (`02` §10.6, item 103) | Spec prevalece sobre o rótulo; Logan 1 e 5; Phil C1 |
| D10 | **`obs_archive_summary_calc` é extraído no rascunho da M3b** (pedido na Tarefa 10 da M3b; o corpo é o bloco `execute format` de `m3b.sql:1110-1127`, com os mesmos `SET` de `obs_archive_summary_rows`), chamado pela selagem **e** pelo caminho online. A M7 **não recria** `obs_archive_summary_rows`; a prova byte a byte da selagem vira teste da M3b. Plano B: se a M3b já tiver virado migration sem a função, a M7 a cria e repete o `diff` contra `pg_get_functiondef('public.obs_archive_summary_rows'::regproc)` de produção no Passo 1 da Tarefa 14, com falha alta se divergir | Yannis I-9 (recriar 65 linhas de corpo vivo pode reverter emenda da M3b); `02` §10.6 ("pela mesma função do resumo") |
| D11 | **Remoção com `apagar`:** gatilho `after insert or update of archive_decision on obs_archive_channel_removals` (quando `new.archive_decision = 'apagar'`) **primeiro cancela os pedidos ativos, depois apaga os resultados**, na mesma transação. **Não** recria `competitor_channel_remove` nem `obs_archive_channel_removal_decide`. O `finish` ainda recusa (`cancelado`) quando algum canal resolvido tem remoção `apagar` | O D16 da M3b diz que a M7 os recria; copiar corpos de função da M3b duplica código vivo. A ordem update → delete fecha a corrida com o `finish` em READ COMMITTED (Yannis I-4, Phil I9) |
| D12 | **Vigia 5** é a função `obs_archive_vigia_resultados()` (só leitura, devolve a contagem) e a consulta do runbook a chama; o vigia 4 da M3b não é tocado | Item 160: (5) é consulta do dono no runbook |
| D13 | **Online parcial chamado pela rota, um mês por chamada** (`obs_archive_request_online(p_site, p_request, p_month)`), antes do `obs_archive_request_finish`; a lista de meses online vem do **plano gravado no claim** (`obs_archive_request_check`), nunca recalculada | Mantém cada instrução curta; mês selado entre o claim e o `result` não some (Yannis I-7); a medida local está na Tarefa 6, Passo 7 |
| D14 | **Respondedor: orçamento interno** = `min(ARQ_RESP_ORCAMENTO_S (780), restante_s − 60)`, onde `restante_s` vem do claim (calculado no banco, sem depender do relógio da forja); passou do orçamento → `fail grande_demais`. A 2ª tentativa herda o prazo da 1ª e tem menos de 9 min | `02` §10.6; Phil I8, Yannis I-10 |
| D15 | **"O primeiro pode sair do banco a partir de dd/mm/aaaa"** = 1º dia do mês `primeiro_mes_com_dado + janela_da_política + 1` (`serie`, janela 6). **Data certa para coleta desde ago/2026: 01/03/2027** (não 01/02/2027). Conferência: spec `02` linha 275 ("Com janela 6, outubro pode sair quando novembro a abril estão fechados: em 01/05" = mês + 7), `04` linha 115 ("Outubro pode sair em 01/05/2027") e o portão da M6 (`make_interval(months => window_months + 1)`, plano M6 linha 1093, teste `pode_sair_em 2027-05-01`). O exemplo do D15 original e do mockup (01/02/2027) esquecia o "+ 1". **Uma função só:** `public.obs_archive_pode_sair_em(p_month date, p_window int)` (criada na Tarefa 4); a frase do Arquivo (M5) lê `pode_sair_em` do portão da M6, que tem de chamar a mesma função; pedido ao controlador da M6 registrado no ledger; teste de equivalência na Tarefa 4 (compara com `ainda_na_janela.pode_sair_em` do portão quando a M6 existir no banco, `skipIf` quando não) | Logan 3 e Phil I6 divergiam (01/03 e 01/02); a fórmula do próprio spec decide: 01/03/2027 |
| D16 | **Frase do `inesperado`** (o `04` não tem): a do Logan (L3), em `FRASES.inesperado`, com a hora do pedido (`requested_at`) | Estado alcançável sem frase aprovada; Logan 2 |
| D17 | **Botão só para quem edita**, só com ao menos um mês da classe `serie` destacado (`detached_at` não nulo) para o canal; sem nenhum, a tira mostra a frase de `semArquivo` (L4) sem botão; quem só lê vê só "Views por dia: <mês/aaaa> a <mês/aaaa> no arquivo." | Mockup, nota do quadro `a-nada` e linha 172 de `peca6.js` |
| D18 | **Polling da tela a cada 10 s** enquanto o pedido está `pending` ou `running` e a aba está visível (`document.visibilityState`), **pela leitura leve** `obs_archive_request_status` (só o estado e o progresso); a leitura completa só ao mudar de estado. Para no estado final | 180 chamadas no máximo por pedido de 15 min; Phil M4: a leitura completa recalcula a prévia das 4 escolhas a cada vez |
| D19 | **Custo do claim: ver "Decisão do dono pendente (muda o spec)" no topo.** Implementado: variante B (claim é o batimento, 60 s ocioso, 15 s com pedido recente); variante A com as duas variáveis. Com `503 arquivo_desligado` o respondedor espera `ARQ_RESP_PAUSA_DESLIGADO_S` (300 s) | Phil I1 |
| D20 | **Plano do pedido gravado no claim** (`obs_archive_requests.plan`): a classificação de **cada** par (canal, mês) em `arquivo`, `vazio`, `online`, `faltou`, `antes`. Pedido que não tem nenhum arquivo para ler (`online_only`) é fechado **pela server action**, logo depois do `create`, por `obs_archive_request_finish_online` (sem token, só aceita `online_only` e `pending`); o claim nunca o vê. Falha ao fechar → `obs_archive_request_fail_online` (`failed/inesperado`, nunca "A casa não respondeu") | Phil C1/C2, Yannis I-2 e I-7 |
| D21 | **Resultado anterior** (Phil M2): a leitura traz também `resultado_anterior` (o último resultado ainda válido do canal quando o pedido mais recente não terminou em `done`); a tela o oferece só nos estados `cancelado`, `nao_respondeu`, `nas_fora`, `inesperado` como "Ver o resultado de dd/mm". Texto: remessa ao Logan (lista L7) | Phil M2 |

---

## Contrato das rotas do pedido (r1.1; cópia em `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md`)

**R0. Regras comuns.** Herda o C0 da M3b inteiro: só `X-Pipeline-Key`; permissão exata `archive_read`; ordem das recusas chave → permissão → `OBS_ARQUIVO` (`503 arquivo_desligado`) → Zod (`400 VALIDATION_ERROR`) → regra; 100 req/min; envelope `{data}` / `{error: {code, message, details}}`; `500 erro_do_banco` com Sentry; `504 tempo_esgotado` em `57014`; `Cache-Control: no-store` em toda resposta. Todo corpo de pedido leva `pedido_id` (uuid) e `token` (uuid devolvido no claim; muda a cada claim). Códigos novos em `STATUS_DO_CODIGO`: `pedido_cancelado: 409`, `pedido_vencido: 409`, `pedido_de_outro: 409` (token não confere), `medida_fora_da_lista: 422`, `resposta_fora_da_lista: 422` (arquivo que o claim não listou, ou que falta), `grande_demais: 413` (já existe). `P0001 canal_removido` e `escolha_invalida` também têm status (422), para a server action.

**R1. `POST request/claim`** — corpo `{versao: 1, hora_maquina: ISO, prova?: boolean}`. **O claim é o batimento** do trabalhador `respondedor` (a RPC grava `last_poll_at`), exceto com `prova: true`.
- Sem pedido: `200 {data: {pedido: null}}`.
- `prova: true`: nada é tomado, normalizado nem gravado; `200 {data: {pedido: null, prova: {ha_pedido: boolean}}}`.
- Com pedido: `200 {data: {pedido: {id, token, tipo: 'relatorio'|'ensaio', prazo: ISO (deadline_at), restante_s: int ≥ 0 (prazo menos agora, calculado no banco), arrendamento_ate: ISO, tentativa: 1|2, total: N, arquivos: [{arquivo_id: 's:<uuid>:canal', classe, filho, caminho, canal, mes: 'AAAA-MM', versao, sha256, bytes}]}}}`. `total` = `arquivos.length` calculado no banco; o respondedor recusa (`fail inesperado`) se diferir. Lista ordenada por (mês desc, canal). O claim só lista resumos `.canal` das classes das medidas pedidas (v1: `serie`; tipo `ensaio`: só `ensaio`), do **mês selado `com_dado`**, sem `purged_at`, `lost_at`, `superseded_at`, `nas_withdrawn_at`, não vazios, de canal sem remoção `apagar`. O pedido que não tem nenhum arquivo (`online_only`) nunca é entregue; se os resumos sumirem entre a criação e o claim, o pedido termina `failed/inesperado` (nunca `total: 0` na forja).

**R2. `POST request/progress`** — corpo `{pedido_id, token, lidos: int ≥ 0, total: int ≥ 1}`. `200 {data: {arrendamento_ate}}`; `409 pedido_cancelado`, `409 pedido_vencido`, `409 pedido_de_outro`. Renova o arrendamento por 3 min, nunca além de `deadline_at`. O respondedor chama no topo do laço (a cada 50 arquivos **tentados** ou 30 s, contando falhas também).

**R3. `POST request/result`** — corpo `{pedido_id, token, lidos: [{arquivo_id, linhas: [[...14 colunas .canal em texto ou null]]}], falhas: [{arquivo_id, motivo: 'ausente'|'divergente'|'nas_fora'|'ilegivel'}]}`. Cada `arquivo_id` do claim aparece **exatamente uma vez** em `lidos` ou em `falhas`; faltando ou sobrando: `422 resposta_fora_da_lista`. Corpo limitado a 4 MB (Vercel aceita 4,5 MB). Resposta `200 {data: {estado: 'completo'|'incompleto'|'devolvido'|'cancelado'|'falhou'}}`: `devolvido` = voltou a `pending` porque um resumo foi purgado depois do claim; `cancelado` = canal removido com `apagar` durante a leitura (nada gravado); `falhou` = resultado acima de 512 kB (`failed/grande_demais`). Repetir o `result` com o mesmo token num pedido já `done` devolve o `estado` gravado (replay idempotente, Phil M3). O site nunca devolve o esperado. A rota confere `pedido_id`/token/estado por `obs_archive_request_check` **antes** de montar o online (Yannis M-12).

**R4. `POST request/fail`** — corpo `{pedido_id, token, motivo: 'nas_fora'|'grande_demais'|'inesperado', detalhe?: string ≤ 200}`. `200 {data: {estado: 'failed'}}`.

**R5. Heartbeat.** O claim já é o batimento de vida (R1). O respondedor chama a rota `heartbeat` da M3b (C8) com `archive_read` só a cada `ARQ_RESP_BATIMENTO_S` (600 s; 60 s na variante A) para medir disco e montagens (o site limita a 30 s); `last_poll_at` do trabalhador `respondedor` é o "Último sinal" da tela.

---

## Estrutura de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido.ts` (criar) | 1 | medidas, tetos, motivos, esquemas Zod de corpo e resposta das quatro rotas, impressão do pedido |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts` (modificar) | 1 | códigos novos em `STATUS_DO_CODIGO` |
| `apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts` (criar) | 1 | contrato puro |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-tela.ts` (criar) | 2 | estado da tela a partir da leitura (15 estados + `inesperado`), frases |
| `apps/web/test/youtube/observatorio/arquivo-mensal-pedido-tela.test.ts` (criar) | 2 | cada estado com a sua frase |
| `supabase/rascunhos/m7.sql` (criar) | 3–7 | o SQL da etapa até a migration |
| `apps/web/test/helpers/m7.ts` (criar) | 3 | `M7_SQL_CAMINHO`, `M7_EM_MIGRATION`, `aplicarM7(c)`, `semearPedido` |
| `apps/web/test/manutencao/m7-trava.test.ts` (criar) | 3 | TRAVA M7-1 e M7-2 |
| `apps/web/test/integration/manutencao-m7-fila.test.ts` (criar) | 3–5 | tabelas, criar, cancelar, estado, claim, progresso, falha |
| `apps/web/test/integration/manutencao-m7-resultado.test.ts` (criar) | 6 | resultado, online parcial, teto, expulsão, invariante |
| `apps/web/test/integration/manutencao-m7-remocao-poda.test.ts` (criar) | 7 | gatilho `apagar`, corrida, vigia 5, poda, lista fechada |
| `apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts` (modificar) | 7 | pares novos e chamada de 24 meses |
| `apps/web/src/app/api/pipeline/archive/request/{claim,progress,result,fail}/route.ts` (criar) | 8 | as quatro rotas |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco.ts` (criar) | 8 | leitura das RPCs com Zod, `montarOnline` (usado pela rota e pela server action) |
| `apps/web/test/app/api/pipeline/archive-request.test.ts` (criar) | 8 | rotas com `rpc` falso |
| `apps/web/src/lib/pipeline/api-registry.ts`, `apps/web/data/pipeline-docs/cowork-docs-archive.md`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/test/lib/pipeline/mcp-registry-sync.test.ts` (modificar) | 8 | integridade do pipeline |
| `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/ver-antigo-actions.ts` (criar) | 9 | server actions `lerVerAntigo`, `lerStatusVerAntigo`, `pedirVerAntigo`, `cancelarVerAntigo` |
| `apps/web/test/cms/ver-antigo-actions.test.ts` (criar) | 9 | permissão e mapeamento |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_canal/ver-antigo.tsx` (criar), `_canal/canal-screen.tsx`, `canal/[id]/page.tsx` (modificar) | 10 | o painel e a ligação |
| `apps/web/test/cms/ver-antigo.test.tsx` (criar) | 10 | item 105 |
| `~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py` (criar) | 11 | o respondedor |
| `~/Workspace/forja/ferramentas/arquivo/teste_respondedor.py` (criar), `falsos.py`, `comum.py`, `teste_comum.py`, `teste_tudo.sh` (modificar) | 11 | testes, falso do site, `config('respondedor')`, `ler_resumo`, `sentinela_viva` |
| `~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service`, `respondedor.env.modelo` (criar), `pulso_arquivo.py`, `teste_pulso_arquivo.py` (modificar) | 12 | serviço e vigilância |
| `~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py`, `teste_medir_respondedor.py` (criar) | 13 | gerador de resumos sintéticos e cronômetro |
| `supabase/migrations/<ts>_manutencao_m7_periodo_longo.sql` (criar por `db:new`) | 14 | a migration |
| `docs/ops/runbook-arquivo-mensal.md` (modificar) | 16 | consultas 5 e 6, ligar e desligar o respondedor |
| `.superpowers/sdd/manutencao-nas/m7/*.sh` (criar, fora do git) | 13, 15, 16 | arquivos de comandos do dono |

---

### Tarefa 0: leituras, ledger e conferências

**Files:**
- Create: `.superpowers/sdd/manutencao-nas/m7-progresso.md` (fora do git)

- [ ] **Passo 1. Ledger.** Criar com as seções "Travas", "Medidas", "Levar ao dono antes do código" (a tabela L1 a L7 do topo, cada linha com "aprovada pelo dono em <data>" ou "pendente"), "Decisão do dono pendente (D19)", "Desvios declarados" e "NÃO VERIFICADO". Copiar para "Desvios declarados" as decisões D2, D4, D9, D10, D11, D15, D16 e D21, e a nota "medida com cache quente é piso, não teto". Anotar também: **pedido à M6** (controlador): o portão deve chamar `public.obs_archive_pode_sair_em(p_month, window_months)` em vez da expressão inline da linha 1093 do plano dela; **M-10 (Yannis)**: pedido que espera atrás de outro de 13 min pode vencer na fila com "A casa não respondeu" (um dono, caso raro; `expires_at` conta da criação); se acontecer de fato, contar a validade a partir do fim do pedido em andamento.
- [ ] **Passo 2. Estado da M3b.** Rodar e anotar a saída:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git ls-files apps/web/test/helpers/m3b.ts supabase/rascunhos/m3b.sql apps/web/src/lib/pipeline/archive-auth.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
ls supabase/migrations | grep _manutencao_m3b_ || echo "M3b ainda em rascunho"
grep -n "TRAVA M3b-2 solta" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md || echo "M3b fora de produção"
grep -n "function public.obs_archive_summary_calc" supabase/rascunhos/m3b.sql || echo "calc ainda não extraído (TRAVA M7-0b)"
```

Esperado hoje: só os dois primeiros listados; "M3b ainda em rascunho"; "M3b fora de produção"; "calc ainda não extraído". `archive-auth.ts` e `contrato.ts` nascem na M3b (Tarefas 1 e 11 dela). **Sem `contrato.ts`, a Tarefa 1 desta etapa espera** (ela modifica o arquivo); a Tarefa 2 não depende dele.
- [ ] **Passo 3. Âncora da tela (já conferida em 14/10 noite, só reconferir).** `grep -n "<CanalHeader\|<AbasNav" "apps/web/src/app/cms/(authed)/youtube/competitors/_canal/canal-screen.tsx"` deve dar as linhas 508 e 510 (a tira entra entre as duas, L5). `grep -rn "Views por dia\|ViewsPorDia" apps/web/src/app/cms/\(authed\)/youtube/competitors/_canal apps/web/src/app/cms/\(authed\)/youtube/competitors/canal` não acha nada; se a M5 tiver criado o gráfico, a tira vai logo abaixo dele e o desvio de lugar é registrado no ledger.
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
- Produces: `MEDIDAS_V1`, `type Medida`, `ESCOLHAS_DE_MESES`, `type EscolhaDeMeses`, `TETO_MESES`, `BYTES_POR_ENTRADA`, `TETO_ENTRADAS`, `TETO_CARGA_BYTES`, `TETO_TOTAL_RESULTADOS_BYTES`, `TETO_CORPO_RESULTADO_BYTES`, `COLUNAS_CANAL`, `MOTIVOS_DO_ARQUIVO`, `MOTIVOS_DO_PEDIDO`, `MOTIVOS_DO_MES`, `CorpoClaim`, `RespostaClaim`, `ArquivoDoPedido`, `CorpoProgresso`, `CorpoResultado`, `RespostaFinish`, `CorpoFalha`, `mesesDaEscolha`, `impressaoDoPedido`. Consumido pelas Tarefas 2, 8, 9, 10 e, como texto, pelo respondedor.

**O que acontece quando o dado não existe:** claim sem pedido é `{pedido: null}` (nunca lista vazia com id); `arquivos: []` com `total: 0` é recusado pelo esquema (`min(1)`): pedido sem arquivo nenhum não vai à forja (a criação o marca `online_only` e a server action o fecha, Tarefa 4/9); medida desconhecida é recusada pelo enum, nunca ignorada; `restante_s` ausente no claim é recusado (o respondedor não adivinha prazo).

- [ ] **Passo 1. `git diff --stat -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts`** vazio (regra do Global Constraints).
- [ ] **Passo 2. Teste, falhando.**

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-pedido.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  CorpoClaim, RespostaClaim, CorpoResultado, CorpoFalha, CorpoProgresso, RespostaFinish, MEDIDAS_V1, TETO_MESES,
  BYTES_POR_ENTRADA, TETO_ENTRADAS, TETO_CARGA_BYTES, mesesDaEscolha, impressaoDoPedido, COLUNAS_CANAL,
} from '@/lib/youtube/observatorio/arquivo-mensal/pedido'
import { STATUS_DO_CODIGO } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'

const ID = '11111111-1111-4111-8111-111111111111'
const CANAL = '22222222-2222-4222-8222-222222222222'
const arquivo = (mes: string) => ({
  arquivo_id: `s:${ID}:canal`, classe: 'serie', filho: 'numerico',
  caminho: `serie/canais/${CANAL}/resumo/${mes}.v1.canal.csv.gz`, canal: CANAL, mes, versao: 1,
  sha256: 'a'.repeat(64), bytes: 300,
})
const pedido = (arquivos: unknown[], total = arquivos.length) => ({
  id: ID, token: ID, tipo: 'relatorio', prazo: '2027-03-01T10:15:00Z', restante_s: 800, arrendamento_ate: '2027-03-01T10:03:00Z',
  tentativa: 1, total, arquivos,
})

describe('contrato do pedido (M7)', () => {
  it('medidas v1 são a lista fechada; ficha_do_video fica de fora (P22 é da M10b)', () => {
    expect(MEDIDAS_V1).toEqual(['linhas', 'videos_com_linha', 'dias_medidos', 'dias_do_mes', 'var_views', 'var_likes', 'var_comments'])
    expect(MEDIDAS_V1).not.toContain('ficha_do_video')
  })
  it('claim sem pedido é null, nunca lista vazia; prova devolve só ha_pedido', () => {
    expect(RespostaClaim.safeParse({ pedido: null }).success).toBe(true)
    expect(RespostaClaim.safeParse({ pedido: null, prova: { ha_pedido: true } }).success).toBe(true)
    expect(RespostaClaim.safeParse({ pedido: pedido([], 0) }).success).toBe(false)
  })
  it('claim exige restante_s (o respondedor não adivinha o prazo da 2ª tentativa)', () => {
    const { restante_s: _r, ...sem } = pedido([arquivo('2027-01')])
    expect(RespostaClaim.safeParse({ pedido: sem }).success).toBe(false)
    expect(RespostaClaim.safeParse({ pedido: pedido([arquivo('2027-01')]) }).success).toBe(true)
  })
  it('claim aceita 1.001 arquivos e recusa caminho fora do resumo .canal (item 104)', () => {
    const lista = Array.from({ length: 1001 }, () => arquivo('2027-01'))
    expect(RespostaClaim.safeParse({ pedido: pedido(lista) }).success).toBe(true)
    const video = { ...arquivo('2027-01'), caminho: `serie/canais/${CANAL}/resumo/2027-01.v1.video.csv.gz` }
    expect(RespostaClaim.safeParse({ pedido: pedido([video]) }).success).toBe(false)
  })
  it('corpo do claim: prova é opcional e booleana', () => {
    expect(CorpoClaim.safeParse({ versao: 1, hora_maquina: '2027-03-01T10:00:00Z' }).success).toBe(true)
    expect(CorpoClaim.safeParse({ versao: 1, hora_maquina: '2027-03-01T10:00:00Z', prova: true }).success).toBe(true)
    expect(CorpoClaim.safeParse({ versao: 1, hora_maquina: '2027-03-01T10:00:00Z', prova: 'sim' }).success).toBe(false)
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
  it('resposta do finish tem os cinco estados do contrato R3', () => {
    for (const estado of ['completo', 'incompleto', 'devolvido', 'cancelado', 'falhou']) expect(RespostaFinish.safeParse({ estado }).success).toBe(true)
    expect(RespostaFinish.safeParse({ estado: 'pronto' }).success).toBe(false)
  })
  it('meses da escolha: N meses que terminam no mês corrente; Tudo acima de 36 é grande demais', () => {
    expect(mesesDaEscolha('12', '2027-05', '2024-03')).toHaveLength(12)
    expect(mesesDaEscolha('12', '2027-05', '2024-03')[0]).toBe('2027-05')
    expect(mesesDaEscolha('tudo', '2027-05', '2026-08')).toHaveLength(10)
    expect(() => mesesDaEscolha('tudo', '2028-05', '2024-03')).toThrow('grande_demais')
    expect(TETO_MESES).toBe(36)
  })
  it('o teto de entradas cabe no teto de bytes (Phil I2): 1747 × 300 ≤ 512 kB', () => {
    expect(TETO_ENTRADAS).toBe(Math.floor(TETO_CARGA_BYTES / BYTES_POR_ENTRADA))
    expect(TETO_ENTRADAS * BYTES_POR_ENTRADA).toBeLessThanOrEqual(TETO_CARGA_BYTES)
    expect(TETO_ENTRADAS).toBe(1747)
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
    expect(STATUS_DO_CODIGO.canal_removido).toBe(422)   // Yannis M-9: a server action mapeia, não cai em 'erro' genérico
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
export const TETO_CARGA_BYTES = 512 * 1024
/** D4: custo máximo de uma entrada do payload (medido no teste do SQL com as 13 chaves). Mudou: mudar aqui e em obs_archive_request_limits. */
export const BYTES_POR_ENTRADA = 300
/** D4/D8: pares (canal × mês) por pedido; cabe no teto de bytes. A medida da Tarefa 13 só pode BAIXAR o teto de arquivos, nunca subir este. */
export const TETO_ENTRADAS = Math.floor(TETO_CARGA_BYTES / BYTES_POR_ENTRADA)
export const TETO_TOTAL_RESULTADOS_BYTES = 8 * 1024 * 1024
export const TETO_CORPO_RESULTADO_BYTES = 4 * 1024 * 1024
/** As colunas do resumo .canal (M3b, obs_archive_summary_rows), na ordem do CSV. Nenhuma de comentário (02 §11.2). O respondedor confere o cabeçalho contra esta lista. */
export const COLUNAS_CANAL = ['canal', 'tabela', 'mes', 'videos_com_linha', 'linhas', 'dias_medidos', 'dias_do_mes', 'primeira_leitura',
  'ultima_leitura', 'var_views', 'var_likes', 'var_comments', 'hash_conteudo_unidade', 'versao_resumo'] as const
export const MOTIVOS_DO_ARQUIVO = ['ausente', 'divergente', 'nas_fora', 'ilegivel'] as const
/** Motivos que o site grava num mês que falta (os quatro do respondedor mais os três que só o site sabe; Phil C1). */
export const MOTIVOS_DO_MES = [...MOTIVOS_DO_ARQUIVO, 'sem_copia', 'expurgado', 'sem_registro_do_canal'] as const
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
export const CorpoClaim = z.object({ versao: z.literal(1), hora_maquina: iso, prova: z.boolean().optional() }).strict()
export const RespostaClaim = z.object({
  pedido: z.object({
    id: uuid, token: uuid, tipo: z.enum(['relatorio', 'ensaio']), prazo: iso, restante_s: z.number().int().min(0),
    arrendamento_ate: iso, tentativa: z.union([z.literal(1), z.literal(2)]), total: z.number().int().min(1).max(TETO_ENTRADAS),
    arquivos: z.array(ArquivoDoPedido).min(1).max(TETO_ENTRADAS),
  }).strict().refine(p => p.total === p.arquivos.length, { message: 'total difere da lista' }).nullable(),
  prova: z.object({ ha_pedido: z.boolean() }).strict().optional(),
}).strict()
export const CorpoProgresso = z.object({ pedido_id: uuid, token: uuid, lidos: z.number().int().min(0), total: z.number().int().min(1) })
  .strict().refine(p => p.lidos <= p.total, { message: 'lidos acima do total' })
const celula = z.string().max(200).nullable()
export const CorpoResultado = z.object({
  pedido_id: uuid, token: uuid,
  lidos: z.array(z.object({ arquivo_id: z.string().regex(/^s:[0-9a-f-]{36}:canal$/), linhas: z.array(z.array(celula).length(COLUNAS_CANAL.length)).max(50) }).strict()).max(TETO_ENTRADAS),
  falhas: z.array(z.object({ arquivo_id: z.string().regex(/^s:[0-9a-f-]{36}:canal$/), motivo: z.enum(MOTIVOS_DO_ARQUIVO) }).strict()).max(TETO_ENTRADAS),
}).strict()
export const RespostaFinish = z.object({ estado: z.enum(['completo', 'incompleto', 'devolvido', 'cancelado', 'falhou']) }).strict()
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

- [ ] **Passo 4. `contrato.ts`:** acrescentar ao objeto `STATUS_DO_CODIGO`, depois de `tabela_ausente` (e só o que a M3b ainda não tiver; `canal_removido` costuma já existir: `grep -n "canal_removido" .../contrato.ts` antes, sem duplicar a chave):

```ts
  // M7 (contrato do pedido, R0)
  pedido_cancelado: 409, pedido_vencido: 409, pedido_de_outro: 409, medida_fora_da_lista: 422, resposta_fora_da_lista: 422,
  escolha_invalida: 422, invariante_do_resultado: 500,
```

- [ ] **Passo 5.** Rodar o teste do Passo 2 (passa) e `npx vitest run test/youtube/observatorio/arquivo-mensal` (os da M3b continuam passando). `npm run typecheck -w apps/web > /tmp/m7-tc.txt 2>&1; tail -3 /tmp/m7-tc.txt`.
- [ ] **Passo 6. Contrato no disco** (fora do git): copiar a seção "Contrato das rotas do pedido" deste plano para `.superpowers/sdd/manutencao-nas/contrato-rotas-m7.md` (já criado na revisão 1 do plano; refazer a cópia se o contrato mudar).
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
- Produces: `type LeituraDoPedido` (o JSON de `obs_archive_request_read`, Tarefa 4), `LeituraDoPedidoZ`, `type EstadoDaTela` (união de 15 + `inesperado`), `estadoDaTela(l: LeituraDoPedido | null, agora: Date, euId: string, o?: { reaberto?: boolean }): EstadoDaTela`, `FRASES` (por estado: `lead`, `sub`), `PODE`, `fraseAntes(...)`, `fraseLidos(...)`, `fraseIncompleto(...)`, `fraseSemArquivo(...)`, `fraseDoMes(m: MesDoResultado, agora: Date): { texto, marca: 'parcial' | null, forma }`, `METODO_VAR_VIEWS`, `formatarViews(v: string | null)`, `formaDoAviso(ultimoSinal, agora): 'triangulo'|'octogono'`, e `podeSairEm(primeiroMes: string, janela: number): string` **somente como espelho de teste** do SQL (D15: a fonte é `obs_archive_pode_sair_em`). Consumido pela Tarefa 10.

**O que acontece quando o dado não existe:** leitura `null` (RPC falhou ou fora do esquema) → `nao_medido` ("Não foi possível ler o estado do pedido."), nunca "antes de pedir"; sem mês destacado → `sem_arquivo`; `OBS_ARQUIVO` desligado → `desligado`; heartbeat do respondedor nunca gravado → "Último sinal: nunca" e octógono (o site nunca ouviu a casa); **`done` sem resultado gravado (expulso pelo teto de 8 MB ou apagado) → `venceu` com a data de `finished_at`, nunca `pronto` vazio (Yannis I-6)**; viewer que só lê → `pedido` e `resultado` nulos (a RPC nem os devolve, M-8).

- [ ] **Passo 1. Teste, falhando.** Uma linha de tabela por estado, com a frase exata do `peca6.js` (copiar o texto do arquivo aprovado, não deste plano, se divergirem) **e, onde a lista L1 a L7 muda o texto, a frase nova** (marcadas `// L<n>`; se o dono recusar, o teste volta ao texto do mockup):

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-pedido-tela.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  estadoDaTela, FRASES, PODE, fraseAntes, fraseIncompleto, fraseSemArquivo, fraseDoMes, formatarViews, formaDoAviso, podeSairEm,
  type LeituraDoPedido,
} from '@/lib/youtube/observatorio/arquivo-mensal/pedido-tela'

const EU = '33333333-3333-4333-8333-333333333333'
const AGORA = new Date('2028-05-03T17:40:00Z')
const base: LeituraDoPedido = {
  arquivo_ligado: true, meses_no_arquivo: 7, primeiro_sai_em: null, ultimo_sinal: '2028-05-03T17:39:00Z',
  no_arquivo: { de: '2026-08', ate: '2027-09' },
  previa: { '12': { banco: 5, nas: 7, antes: 0, total: 12 }, '24': { banco: 5, nas: 19, antes: 0, total: 24 }, '36': { banco: 5, nas: 31, antes: 0, total: 36 }, tudo: { banco: 5, nas: 45, antes: 0, total: 50 } },
  pedido: null, resultado: null, resultado_anterior: null,
}
const pedido = (o: Partial<NonNullable<LeituraDoPedido['pedido']>>) => ({
  id: 'p', status: 'pending', status_efetivo: 'pending', fail_reason: null, requested_by: EU, requested_at: '2028-05-03T17:32:00Z',
  progress_done: 0, progress_total: 12, cancelled_at: null, finished_at: null, ...o,
}) as NonNullable<LeituraDoPedido['pedido']>

describe('peça 6: estado e frase (item 105)', () => {
  it.each([
    ['desligado', { ...base, arquivo_ligado: false }, 'O arquivo está desligado neste site. Nada foi pedido.'],
    ['sem_arquivo', { ...base, meses_no_arquivo: 0, primeiro_sai_em: '2027-03-01' }, 'Ainda não há mês no arquivo. O primeiro pode sair do banco a partir de 01/03/2027.'],   // L4
    ['nao_medido', null, 'Não foi possível ler o estado do pedido.'],
    ['enviado', { ...base, pedido: pedido({}) }, 'Pedido feito às 14:32. Aguardando a casa.'],
    ['cancelado', { ...base, pedido: pedido({ status: 'cancelled', status_efetivo: 'cancelled', cancelled_at: '2028-05-03T17:36:00Z' }) }, 'Pedido cancelado às 14:36.'],
    ['nao_respondeu', { ...base, pedido: pedido({ status_efetivo: 'expired', fail_reason: 'sem_trabalhador' }) }, 'A casa não respondeu em 15 minutos. O pedido venceu e nada foi perdido.'],
    ['nas_fora', { ...base, pedido: pedido({ status: 'failed', status_efetivo: 'failed', fail_reason: 'nas_fora' }) }, 'A forja respondeu, mas o NAS não está acessível.'],
    ['grande', { ...base, pedido: pedido({ status: 'failed', status_efetivo: 'failed', fail_reason: 'grande_demais' }) }, 'O período pedido passa do tamanho que o site guarda. Peça menos meses.'],
    ['inesperado', { ...base, pedido: pedido({ status_efetivo: 'failed', fail_reason: 'inesperado' }) }, 'Não deu para montar o resultado. Nada foi perdido.'],   // L3
  ] as const)('%s', (estado, leitura, frase) => {
    const e = estadoDaTela(leitura as LeituraDoPedido | null, AGORA, EU)
    expect(e.tipo).toBe(estado)
    expect(e.lead).toBe(frase)
  })
  it('sem_arquivo: data passada, sem data e quem só lê (L4)', () => {
    expect(fraseSemArquivo('2027-03-01', new Date('2027-03-02T12:00:00Z'), true)).toEqual({ texto: 'Ainda não há mês no arquivo. O primeiro já pode sair: a saída é na página do Arquivo.', link: true })
    expect(fraseSemArquivo('2027-03-01', new Date('2027-03-02T12:00:00Z'), false).link).toBe(false)
    expect(fraseSemArquivo(null, AGORA, true)).toEqual({ texto: 'Ainda não há mês no arquivo.', link: false })   // nunca data estimada
  })
  it('inesperado: sub com a hora do pedido, nunca o fail_detail; triângulo com botão "Pedir de novo" (L3)', () => {
    const e = estadoDaTela({ ...base, pedido: pedido({ status_efetivo: 'failed', fail_reason: 'inesperado' }) }, AGORA, EU)
    expect(e.sub).toBe('Peça de novo. Se acontecer outra vez, avise o Claude Code para investigar e diga a hora do pedido (14:32).')
    expect(e.sub).not.toMatch(/teto de tentativas|total|caminho/)
    expect(e.alerta).toBe(true)
    expect(e.podePedir).toBe(true)
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
  it('done SEM resultado gravado (expulso pelo teto de 8 MB) é venceu, nunca pronto vazio (Yannis I-6)', () => {
    const e = estadoDaTela({ ...base, pedido: pedido({ status: 'done', status_efetivo: 'done', finished_at: '2028-04-20T12:00:00Z' }), resultado: null }, AGORA, EU)
    expect(e.tipo).toBe('venceu')
    expect(e.lead).toBe('O resultado de 20/04 venceu. Peça de novo.')
  })
  it('frase de antes de pedir é por origem da leitura, não por onde o mês está (L2)', () => {
    const previa = { '12': { banco: 1, nas: 11, antes: 0, total: 12 }, '24': { banco: 1, nas: 17, antes: 6, total: 24 }, '36': { banco: 1, nas: 17, antes: 18, total: 36 }, tudo: { banco: 1, nas: 45, antes: 0, total: 50 } }
    expect(fraseAntes('12', previa, 'Canal X')).toBe('Vai ler os 12 meses de Canal X: 11 vêm da cópia no NAS e 1, o mês corrente, do banco (parcial).')
    expect(fraseAntes('24', previa, 'Canal X')).toBe('Vai ler os 24 meses de Canal X: 17 vêm da cópia no NAS e 1, o mês corrente, do banco (parcial). Os outros 6 são de antes de a coleta começar.')
    expect(fraseAntes('12', { ...previa, '12': { banco: 0, nas: 12, antes: 0, total: 12 } }, 'Canal X')).toBe('Vai ler os 12 meses de Canal X: os 12 vêm da cópia no NAS.')
    expect(fraseAntes('tudo', previa, 'Canal X')).toBe('Tudo passa do que o site guarda (50 meses). Escolha até 36 meses.')
  })
  it('rótulo de origem por estado do mês; "do banco" nunca sozinho; nunca "0 de N dias medidos" (L1, L6)', () => {
    const ok = { mes: '2027-01', canal: 'c', estado: 'ok', origem: 'nas', parcial: false, dias_medidos: 31, dias_do_mes: 31, views: '1500', likes: null, comentarios_contagem: null, conferido_em: null, primeira_leitura: null, motivo: null } as const
    expect(fraseDoMes({ ...ok }, AGORA).texto).toContain('da cópia no NAS')
    expect(fraseDoMes({ ...ok, estado: 'parcial', origem: 'banco_sem_copia', parcial: true, dias_medidos: 12 }, AGORA)).toMatchObject({ marca: 'parcial' })
    expect(fraseDoMes({ ...ok, estado: 'parcial', origem: 'banco_sem_copia', parcial: true, dias_medidos: 12 }, AGORA).texto).toContain('do banco, ainda sem cópia')
    expect(fraseDoMes({ ...ok, estado: 'vazio_conferido', origem: 'nas', conferido_em: '2027-02-02', dias_medidos: null, dias_do_mes: null, views: null }, AGORA).texto).toBe('Sem registro neste mês (conferimos em 02/02)')
    expect(fraseDoMes({ ...ok, estado: 'sem_registro', origem: null, parcial: false, dias_medidos: null, dias_do_mes: null, views: null, conferido_em: '2028-05-03' }, AGORA).texto).toBe('Sem registro neste mês (conferimos em 03/05)')
    expect(fraseDoMes({ ...ok, estado: 'sem_registro', origem: null, parcial: true, dias_medidos: null, dias_do_mes: null, views: null, conferido_em: '2028-05-03' }, AGORA)).toMatchObject({ texto: 'Sem registro neste mês até agora (conferimos em 03/05)', marca: 'parcial' })
    expect(fraseDoMes({ ...ok, estado: 'antes_da_coleta', origem: null, dias_medidos: null, dias_do_mes: null, views: null, primeira_leitura: '2027-08-01' }, AGORA).texto).toBe('A coleta deste canal começou em agosto de 2027.')
    for (const m of [ok, { ...ok, estado: 'sem_registro', dias_medidos: null }]) expect(fraseDoMes(m as never, AGORA).texto).not.toMatch(/\b0 de \d+ dias medidos|do banco(?!, ainda sem cópia)/)
  })
  it('mês que falta explica o motivo (Phil C1; L7)', () => {
    const f = (motivo: string) => fraseDoMes({ mes: '2027-01', canal: 'c', estado: 'faltou', origem: null, parcial: false, dias_medidos: null, dias_do_mes: null, views: null, likes: null, comentarios_contagem: null, conferido_em: '2027-03-04', primeira_leitura: null, motivo } as never, AGORA).texto
    expect(f('sem_copia')).toBe('A cópia deste mês não está no arquivo.')
    expect(f('expurgado')).toBe('Este mês foi apagado do arquivo em 04/03.')
    expect(f('sem_registro_do_canal')).toBe('O arquivo não tem este canal neste mês.')
  })
  it('views nula é "não medido", nunca 0 (Phil M5)', () => {
    expect(formatarViews(null)).toBe('não medido')
    expect(formatarViews('0')).toBe('0')
    expect(formatarViews('12345')).toBe('12.345')
  })
  it('data de "pode sair" é mês + janela + 1 (D15): coleta desde ago/2026, janela 6 → 01/03/2027; out/2026 → 01/05/2027', () => {
    expect(podeSairEm('2026-08', 6)).toBe('2027-03-01')
    expect(podeSairEm('2026-10', 6)).toBe('2027-05-01')
  })
  it('aviso: triângulo até 36 h sem sinal, octógono depois; nunca ouvido é octógono', () => {
    expect(formaDoAviso('2028-05-02T06:00:00Z', AGORA)).toBe('triangulo')
    expect(formaDoAviso('2028-05-01T05:00:00Z', AGORA)).toBe('octogono')
    expect(formaDoAviso(null, AGORA)).toBe('octogono')
  })
  it('PODE é a frase do mockup', () => {
    expect(PODE).toBe('Pode esperar. Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo.')
    expect(FRASES.inesperado.lead).toBe('Não deu para montar o resultado. Nada foi perdido.')   // L3
  })
})
```

- [ ] **Passo 2. `pedido-tela.ts`.** Horas e datas sempre em `America/Sao_Paulo` (`Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })`). Estrutura:

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-tela.ts
/** M7, peça 6 (spec 04 §14.6; mockup 19, peca6.js aprovado em 14/10; textos de L1 a L7 após aprovação do dono): do JSON de obs_archive_request_read ao estado e à frase. Puro. */
import { z } from 'zod'
import { MOTIVOS_DO_MES } from './pedido'

export const PODE = 'Pode esperar. Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo.'
export const METODO_VAR_VIEWS = 'Views do mês: soma, por vídeo, da última leitura do mês menos a primeira. O ganho entre o último dia de um mês e o primeiro do seguinte não entra.'
const previaZ = z.object({ banco: z.number().int().min(0), nas: z.number().int().min(0), antes: z.number().int().min(0), total: z.number().int().min(0) }).strict()
const mesZ = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/), canal: z.string(),
  estado: z.enum(['ok', 'parcial', 'vazio_conferido', 'sem_registro', 'antes_da_coleta', 'faltou']),
  // o SQL grava o payload com jsonb_strip_nulls: chave ausente = null (nullish); parcial ausente = false
  origem: z.enum(['nas', 'banco_sem_copia']).nullish(), parcial: z.boolean().default(false),
  dias_medidos: z.number().int().nullish(), dias_do_mes: z.number().int().nullish(),
  views: z.string().nullish(), likes: z.string().nullish(), comentarios_contagem: z.string().nullish(),
  conferido_em: z.string().nullish(), primeira_leitura: z.string().nullish(), motivo: z.enum(MOTIVOS_DO_MES).nullish(),
}).strict()
export type MesDoResultado = z.infer<typeof mesZ>
const resultadoZ = z.object({ gerado_em: z.string(), vale_ate: z.string(), estado: z.enum(['completo', 'incompleto']), meses: z.array(mesZ) }).strict()
export const LeituraDoPedidoZ = z.object({
  arquivo_ligado: z.boolean(), meses_no_arquivo: z.number().int().min(0), primeiro_sai_em: z.string().nullable(), ultimo_sinal: z.string().nullable(),
  no_arquivo: z.object({ de: z.string(), ate: z.string() }).strict().nullable(),
  previa: z.object({ '12': previaZ, '24': previaZ, '36': previaZ, tudo: previaZ }).strict(),
  pedido: z.object({
    id: z.string(), status: z.enum(['pending', 'running', 'done', 'failed', 'expired', 'cancelled']),
    status_efetivo: z.enum(['pending', 'running', 'done', 'failed', 'expired', 'cancelled']),
    fail_reason: z.enum(['sem_trabalhador', 'nas_fora', 'arquivo_ausente', 'divergente', 'grande_demais', 'inesperado']).nullable(),
    requested_by: z.string(), requested_at: z.string(), progress_done: z.number().int().min(0), progress_total: z.number().int().min(0),
    cancelled_at: z.string().nullable(), finished_at: z.string().nullable(),
  }).strict().nullable(),
  resultado: resultadoZ.nullable(),
  resultado_anterior: resultadoZ.nullable(),
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
  inesperado: { lead: 'Não deu para montar o resultado. Nada foi perdido.', sub: (hora: string) => `Peça de novo. Se acontecer outra vez, avise o Claude Code para investigar e diga a hora do pedido (${hora}).` },   // L3
} as const

/** Espelho de teste de public.obs_archive_pode_sair_em (D15): 1º dia do mês + janela + 1 meses. A tela NUNCA calcula: lê primeiro_sai_em da leitura. */
export function podeSairEm(primeiroMes: string, janela: number): string {
  const [a, m] = primeiroMes.split('-').map(Number)
  const t = a * 12 + (m - 1) + janela + 1
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}
export function formatarViews(v: string | null): string {
  if (v === null) return 'não medido'
  return new Intl.NumberFormat('pt-BR').format(Number(v))
}
// … hora(), data(), mesPorExtenso() com Intl em America/Sao_Paulo; estadoDaTela segue a ordem:
// null → nao_medido; !arquivo_ligado → desligado; meses_no_arquivo = 0 → sem_arquivo (fraseSemArquivo);
// pedido ativo de outro → repetido; pending → enviado; running → andamento (reaberto muda o lead);
// cancelled → cancelado; expired → nao_respondeu (sub: "Último sinal: dd/mm hh:mm. " + PODE, ou "Último sinal: nunca. ");
// failed → nas_fora | grande | inesperado (alerta: true, podePedir: true; sub com a hora de requested_at);
// done + resultado null → venceu (data de finished_at)            // Yannis I-6: nunca 'pronto' vazio
// done + resultado vencido (vale_ate < agora) → venceu;
// done + algum mês 'faltou' com motivo divergente → bate; com outro motivo → incompleto; senão pronto; sem pedido → antes.
```

O corpo completo das funções segue o `peca6.js` linha por linha (funções `fraseDe`, `lidos`, `pronto`, `incompleto`, `bate`); em `bate`, o texto "peça ao Claude Code para conferir <mês>" vem do mockup sem mudança. `fraseDoMes` implementa a tabela L1/L6/L7: `ok` → "da cópia no NAS" (sem marca); `parcial` → "do banco, ainda sem cópia" + marca "parcial"; `vazio_conferido` e `sem_registro` fechado → "Sem registro neste mês (conferimos em dd/mm)" (`conferido_em`); `sem_registro` com `parcial` → "Sem registro neste mês até agora (conferimos em dd/mm)" + marca; `antes_da_coleta` → "A coleta deste canal começou em <mês por extenso> de <ano>." (de `primeira_leitura`); `faltou` → a frase do motivo (L7). `fraseAntes` monta "Vai ler os N meses de <canal>: …" por origem (L2): banco 1 = "1, o mês corrente"; banco 2 = "2, o mês corrente e o último mês fechado"; sem banco "os N vêm da cópia no NAS"; com `antes > 0`, o complemento "Os outros K são de antes de a coleta começar."; `tudo` com `total > 36` mantém a frase do mockup.
- [ ] **Passo 3.** Teste passa; `npm run typecheck -w apps/web`.
- [ ] **Passo 4. Commit** `feat: M7: estado e frases da peça 6 (puro; textos novos marcados L1 a L7 até a aprovação do dono)` por caminho, os dois arquivos com `git add --` antes.

---

### Tarefa 3: SQL parte 1, tabelas e trava

**Files:**
- Create: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/helpers/m7.ts`
- Create: `apps/web/test/manutencao/m7-trava.test.ts`
- Create: `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces: tabelas `obs_archive_requests`, `obs_archive_results`; helper `aplicarM7(c: pg.Client)` (aplica `aplicarM3b` e depois o rascunho da M7, dentro da transação do teste); `M7_SQL_CAMINHO`, `M7_EM_MIGRATION`.

**O que acontece quando o dado não existe:** sem a M3b aplicada (`to_regclass('public.obs_archive_summaries') is null`), o rascunho falha no primeiro `create function` que a cita, alto; o helper sempre aplica a M3b antes. `resolved_channel_refs` e `channel_refs` do resultado são `not null`: um pedido sem canais não existe (a criação devolve `nada_a_pedir`).

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
const BASE = join(RAIZ, 'apps/web/src/app/cms/(authed)/youtube/competitors')
// a tela real mora em competitors/_canal/ (canal-screen.tsx); a página, em competitors/canal/[id]/. Os dois lados.
const PASTAS = [join(BASE, 'canal'), join(BASE, '_canal')]

function arquivos(d: string): string[] {
  if (!existsSync(d)) return []
  return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? arquivos(join(d, e.name)) : [join(d, e.name)])
}

describe('TRAVA M7-1 e M7-2', () => {
  it.skipIf(migrou)('sem migration da M7: sem rotas request/* e sem chamada da fila na página nem na tela do canal', () => {
    expect(existsSync(join(RAIZ, 'apps/web/src/app/api/pipeline/archive/request'))).toBe(false)
    expect(PASTAS.flatMap(arquivos).filter(f => readFileSync(f, 'utf8').includes('obs_archive_request'))).toEqual([])
  })
  it('as duas pastas da tela existem (o teste não passa por pasta errada)', () => {
    expect(existsSync(join(BASE, 'canal/[id]/page.tsx'))).toBe(true)
    expect(existsSync(join(BASE, '_canal/canal-screen.tsx'))).toBe(true)
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
/** Relógio do teste: a GUC que obs_archive_agora() lê (m3b.sql:1441). Vale até o fim da transação. */
export async function fixarAgora(c: Client, iso: string): Promise<void> {
  await c.query(`select set_config('obs_archive.agora', $1, true), set_config('obs_archive.hoje', $2, true)`, [iso, iso.slice(0, 10)])
}
```

- [ ] **Passo 3. Teste das tabelas, falhando.** Em `manutencao-m7-fila.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`, cliente `pg` em `postgresql://postgres:postgres@127.0.0.1:54422/postgres`, `begin` / `aplicarM7` / `rollback` em cada teste:
  - as duas tabelas existem, com RLS ligada (`relrowsecurity`), uma policy só (`select`, `can_edit_site`), e `has_table_privilege('service_role', 'public.obs_archive_requests', 'INSERT')` falso (idem `UPDATE`, `DELETE`, `TRUNCATE`);
  - `has_table_privilege('anon', ..., 'SELECT')` falso;
  - nenhuma FK (`select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.obs_archive_requests'::regclass, 'public.obs_archive_results'::regclass)` = 0);
  - `insert` de dois pedidos ativos com a mesma impressão (como dono da tabela, só neste teste) falha com `23505` (item 53, a parte do índice);
  - `payload_bytes` acima de 524.288 é recusado pelo `check`; `resolved_channel_refs` nulo ou vazio é recusado.
- [ ] **Passo 4. `supabase/rascunhos/m7.sql`, parte 1.**

```sql
-- M7 (fase de manutenção): período longo. Rascunho até a Tarefa 14 (TRAVA M7-1). Spec 02 §10.6.
create table if not exists public.obs_archive_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  kind text not null check (kind in ('relatorio', 'ensaio')),
  channel_refs text[],                       -- como o dono pediu; null = todos (ensaio, uso futuro); a tela pede sempre um
  resolved_channel_refs text[] not null check (cardinality(resolved_channel_refs) >= 1),   -- gravado na CRIAÇÃO (D7); nunca nulo (Phil C2)
  months_choice text not null check (months_choice in ('12', '24', '36', 'tudo')),
  months date[] not null check (cardinality(months) between 1 and 36),
  measures text[] not null,
  fingerprint text not null,
  online_only boolean not null default false, -- nenhum mês com arquivo para ler: a server action o fecha (D20); o claim nunca o vê
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
  claimed_files jsonb,                       -- a lista exata do claim (array de arquivos): o finish confere contra ela
  plan jsonb,                                -- D20: {celulas: [{c, m, k, x, d}], guardados, sem_destino}; cada par (canal, mês) que NÃO é arquivo
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
  request_id uuid not null,                  -- sem FK: a poda (7 dias) só leva o pedido cujo resultado já saiu (I-5)
  site_id uuid not null,
  channel_refs text[] not null,              -- nunca nulo: os canais resolvidos do pedido (Phil C2b); o gatilho do apagar lê esta lista
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

### Tarefa 4: SQL parte 2, estado, plano, criar, cancelar, ler

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Modify: `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces (todas `security definer`, `set search_path = ''`; `grant execute ... to service_role` só nas marcadas **[rota]**):
  - `obs_archive_request_create(p_site uuid, p_kind text, p_channels text[], p_choice text, p_measures text[], p_by uuid) returns jsonb` **[rota/ação]** → `{status: 'criado'|'repetido'|'nada_a_pedir', id, requested_at, so_online}`; recusa `medida_fora_da_lista`, `grande_demais`, `canal_removido`, `escolha_invalida`.
  - `obs_archive_request_cancel(p_site uuid, p_request uuid, p_by uuid) returns jsonb` **[ação]** → `{status: 'cancelado'|'ja_terminado', cancelled_at}`.
  - `obs_archive_request_read(p_site uuid, p_channel text, p_ligado boolean, p_incluir_pedido boolean default true) returns jsonb` **[ação]** (o JSON de `LeituraDoPedidoZ`, Tarefa 2; `p_ligado` vem de `arquivoLigado()` no servidor; `p_incluir_pedido = false` para quem só lê: o dado nem sai do banco).
  - `obs_archive_request_status(p_site uuid, p_request uuid) returns jsonb` **[ação]** (leve, para o polling: `{id, status_efetivo, fail_reason, progress_done, progress_total}`; nulo se não existe).
  - Internas (`revoke ... from service_role`): `obs_archive_request_limits()`, `obs_archive_pode_sair_em(date, int)`, `obs_archive_request_fingerprint(...)`, `obs_archive_request_state(r)`, `obs_archive_first_month(uuid, text, text)`, `obs_archive_request_files(uuid, text, text[], date[])`, `obs_archive_request_plan(uuid, text, text[], date[])`.

**O que acontece quando o dado não existe:** canal sem nenhum mês no registro e sem linha na diária → `nada_a_pedir` (o pedido não nasce; a tela nem oferece o botão, D17); pedido cujos meses não têm resumo `com_dado` listável (todos não selados, vazios ou com falta) nasce `online_only` e é resolvido só pelo banco, **sem ir à forja** (a server action o fecha logo depois do `create`; o claim nunca o vê: D20); heartbeat ausente → `ultimo_sinal: null`; viewer que só lê → `pedido`, `resultado` e `resultado_anterior` nulos sem consultar as tabelas de pedido.

- [ ] **Passo 1. Testes, falhando** (relógio por `fixarAgora`, que usa a GUC `obs_archive.agora`):

| Teste | Afirma |
|---|---|
| `item 53: clique duplo não cria dois ativos` | duas chamadas iguais seguidas: a 2ª devolve `repetido` com o mesmo `id`; `count(*) where status in ('pending','running')` = 1 |
| `item 53: pedido vencido não segura o índice` | 1º pedido com relógio +16 min: a 2ª chamada normaliza o vencido para `expired` e cria outro (`criado`, `id` novo) |
| `item 104: medida fora da lista é recusada` | `p_measures = '{ficha_do_video}'` → `P0001 medida_fora_da_lista`; `'{texto_do_comentario}'` idem |
| `D8: Tudo acima de 36 meses é grande_demais na criação` | canal com diária desde 40 meses atrás, `p_choice = 'tudo'` → `P0001 grande_demais` |
| `D8/D4: pares acima de 1747 são grande_demais` | pedido `null` (todos os canais) com 49 canais × 36 meses → `P0001 grande_demais` |
| `canal removido não é pedido` | linha em `obs_archive_channel_removals` → `P0001 canal_removido` |
| `nada a pedir` | canal sem registro e sem diária → `{status: 'nada_a_pedir'}`, nenhuma linha |
| `canais resolvidos gravados na criação (Phil C2)` | pedido de um canal: `resolved_channel_refs = '{A}'`; pedido `null`: todos os canais do site sem remoção `apagar`; `channel_refs` do pedido nomeado continua `'{A}'` |
| `só online: nasce online_only (Yannis I-2)` | canal com diária de 3 meses e nenhum selo: `so_online = true`, `online_only = true`, `plan` gravado; com um mês selado `com_dado` e resumo do canal: `so_online = false` |
| `plano: cada par (canal, mês) tem uma classe (C1)` | cinco casos num canal de 6 meses: selado com resumo (`arquivo`, fora do plano), selado com resumo `empty` (`vazio`), selado `vazio_conferido` (`vazio`), selado com resumo `purged_at` (`faltou`/`expurgado`, `d` = data do `purged_at`), selado sem resumo do canal (`faltou`/`sem_registro_do_canal`), selado com resumo `lost_at` (`faltou`/`sem_copia`), destacado sem selo (`faltou`/`sem_copia`), mês não selado (`online`), mês anterior à primeira leitura (`antes`, `d` = primeiro mês); `count(plano) + count(arquivos) = cardinality(months) × canais` |
| `primeiro mês com dado (I-3)` | semeado pela cadeia vídeo → canal (`competitor_videos`, `competitor_video_daily`): `obs_archive_first_month` devolve o 1º dia do mês da menor `snap_date`; um canal de **outro site** com diária mais antiga não interfere |
| `cancelar pendente e em andamento (D5)` | `cancelado`; `status = 'cancelled'`, `cancelled_reason = 'dono'`; cancelar `done` → `ja_terminado` sem mudar nada; cancelar pedido vencido (efetivo `expired`) → `ja_terminado` (a leitura continua dizendo "A casa não respondeu") |
| `cancelar de outro site` | `p_site` diferente → `ja_terminado`, nada muda (não vaza existência) |
| `item 50: expirado em 15 min calculado na leitura` | relógio +15 min +1 s: `obs_archive_request_read` traz `status: 'pending'`, `status_efetivo: 'expired'`, `fail_reason: 'sem_trabalhador'`; a linha continua `pending` no disco |
| `I-1: teto de tentativas aparece como failed/inesperado na leitura` | `running`, `attempts = 2`, `lease_until` passado, `deadline_at` futuro: `status_efetivo = 'failed'`, `fail_reason = 'inesperado'` (não `expired`) |
| `leitura sem pedido e sem heartbeat` | `pedido: null`, `resultado: null`, `ultimo_sinal: null`, `previa` com as quatro escolhas (`banco`, `nas`, `antes`, `total`; `nas = total − banco − antes`) |
| `leitura de quem só lê` | `p_incluir_pedido = false` → `pedido`, `resultado`, `resultado_anterior` nulos mesmo com pedido gravado |
| `resultado anterior (Phil M2)` | pedido A `done` com resultado válido; pedido B posterior `expired`: `resultado` nulo e `resultado_anterior` = o de A; com B `done`, `resultado_anterior` nulo |
| `status leve` | `obs_archive_request_status` devolve `status_efetivo` e o progresso, e nulo para pedido de outro site |
| `primeiro_sai_em (D15)` | primeiro mês com linha 2026-08, janela 6 → `'2027-03-01'` (**não** 2027-02-01); primeiro mês 2026-10 → `'2027-05-01'`; `obs_archive_pode_sair_em('2026-10-01', 6) = '2027-05-01'` |
| `D15: a fórmula é a do portão da M6` | `skipIf` a função do portão da M6 não existir no banco: `ainda_na_janela.pode_sair_em` do portão para outubro = `obs_archive_pode_sair_em` do mesmo mês |
| `meses_no_arquivo e no_arquivo` | 2 meses destacados com resumo do canal: `meses_no_arquivo = 2`, `no_arquivo = {de, ate}` do menor e do maior mês (`AAAA-MM`) |
| `permissão` | `has_function_privilege('service_role', 'public.obs_archive_request_create(uuid,text,text[],text,text[],uuid)', 'EXECUTE')` verdadeiro; `anon` e `authenticated` falsos; `obs_archive_request_state`, `_plan`, `_files`, `_limits` falsos para `service_role` |

- [ ] **Passo 2. SQL.** Trechos centrais (o resto segue o mesmo molde):

```sql
create or replace function public.obs_archive_request_limits() returns jsonb language sql immutable set search_path = '' as $$
  -- teto_entradas = floor(carga / bytes_por_entrada): pares (canal x mês) por pedido (D4); espelho de pedido.ts
  select jsonb_build_object('teto_meses', 36, 'bytes_por_entrada', 300, 'teto_entradas', 1747, 'carga', 524288, 'total', 8388608, 'validade_dias', 30)
$$;
revoke all on function public.obs_archive_request_limits() from public, anon, authenticated, service_role;

-- D15: UMA função para "o mês M pode sair em": 1º dia de M + janela + 1 meses (spec 02 linha 275: com janela 6, outubro sai em 01/05).
-- O portão da M6 (v_pode) chama esta mesma função (pedido ao controlador da M6 no ledger).
create or replace function public.obs_archive_pode_sair_em(p_month date, p_window integer) returns date
language sql immutable set search_path = '' as $$
  select (date_trunc('month', p_month) + pg_catalog.make_interval(months => p_window + 1))::date
$$;
revoke all on function public.obs_archive_pode_sair_em(date, integer) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_fingerprint(p_kind text, p_channels text[], p_months date[], p_measures text[])
returns text language sql immutable set search_path = '' as $$
  select md5(p_kind || '|' || coalesce((select string_agg(c, ',' order by c) from unnest(p_channels) c), '*') || '|'
    || (select string_agg(to_char(m, 'YYYY-MM'), ',' order by m) from unnest(p_months) m) || '|'
    || (select string_agg(x, ',' order by x) from unnest(p_measures) x))
$$;
revoke all on function public.obs_archive_request_fingerprint(text, text[], date[], text[]) from public, anon, authenticated, service_role;

-- D6 (Yannis I-1): três casos distintos. O teto de tentativas é failed/inesperado, NÃO expired/sem_trabalhador.
create or replace function public.obs_archive_request_state(r public.obs_archive_requests) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when r.status = 'pending' and public.obs_archive_agora() > r.expires_at
      then jsonb_build_object('status', 'expired', 'motivo', 'sem_trabalhador')
    when r.status = 'running' and public.obs_archive_agora() > r.deadline_at
      then jsonb_build_object('status', 'expired', 'motivo', 'sem_trabalhador')
    when r.status = 'running' and public.obs_archive_agora() > r.lease_until and r.attempts >= 2
      then jsonb_build_object('status', 'failed', 'motivo', 'inesperado')
    else jsonb_build_object('status', r.status, 'motivo', r.fail_reason) end
$$;
revoke all on function public.obs_archive_request_state(public.obs_archive_requests) from public, anon, authenticated, service_role;

-- Primeiro mês com dado do canal: o registro (resumo não vazio, mesmo purgado) ou a diária online. A diária não tem site_id nem channel_id:
-- o caminho é competitor_video_daily -> competitor_videos -> competitor_channels (I-3; molde m3b.sql:1958). Cada vídeo custa uma descida no PK (video_id, snap_date).
create or replace function public.obs_archive_first_month(p_site uuid, p_class text, p_channel text) returns date
language sql stable security definer set search_path = '' as $$
  select least(
    (select min(s.month) from public.obs_archive_summaries s
      where s.site_id = p_site and s.class = p_class and s.channel_ref = p_channel and not s.empty),
    case when p_class = 'serie' then
      (select date_trunc('month', min(x.m))::date
         from public.competitor_videos cv
         join public.competitor_channels ch on ch.id = cv.competitor_channel_id and ch.site_id = p_site
         cross join lateral (select min(d.snap_date) as m from public.competitor_video_daily d where d.video_id = cv.id) x
        where cv.competitor_channel_id = p_channel::uuid)
    end)
$$;
revoke all on function public.obs_archive_first_month(uuid, text, text) from public, anon, authenticated, service_role;

-- A lista fechada de resumos que o claim manda; a criação a usa para saber se há algo a ler na casa (um só predicado).
create or replace function public.obs_archive_request_files(p_site uuid, p_kind text, p_channels text[], p_months date[])
returns table (summary_id uuid, classe text, canal text, mes date, versao integer, sha256 text, bytes bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.class, s.channel_ref, s.month, s.version, s.canal_sha256, s.canal_bytes
    from public.obs_archive_summaries s
   where s.site_id = p_site and s.class = case p_kind when 'ensaio' then 'ensaio' else 'serie' end
     and s.month = any (p_months) and s.channel_ref = any (p_channels)
     and not s.empty and s.purged_at is null and s.lost_at is null and s.superseded_at is null and s.nas_withdrawn_at is null
     and exists (select 1 from public.obs_archive_months m          -- exists, não join: o registro tem uma linha por tabela (duplicaria o arquivo)
                  where m.site_id = s.site_id and m.class = s.class and m.table_name = 'competitor_video_daily' and m.month = s.month
                    and m.sealed_at is not null and m.sealed_kind = 'com_dado')
     and not exists (select 1 from public.obs_archive_channel_removals x where x.site_id = s.site_id and x.channel_ref = s.channel_ref and x.archive_decision = 'apagar')
$$;
revoke all on function public.obs_archive_request_files(uuid, text, text[], date[]) from public, anon, authenticated, service_role;

-- D20 / Phil C1: a classe de CADA par (canal, mês) do pedido. 'arquivo' fica fora do plano (vem de obs_archive_request_files).
-- k: vazio | online | faltou | antes.  x: motivo do faltou.  d: conferido_em / purged_at / primeiro mês.
create or replace function public.obs_archive_request_plan(p_site uuid, p_kind text, p_canais text[], p_months date[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  with k as (select case p_kind when 'ensaio' then 'ensaio' else 'serie' end as classe),
  par as (select ch as canal, mes from unnest(p_canais) ch cross join unnest(p_months) mes),
  prim as (select c as canal, public.obs_archive_first_month(p_site, (select classe from k), c) as primeiro from unnest(p_canais) c),
  cel as (
    select par.canal, par.mes, p.primeiro, m.sealed_at, m.sealed_kind, m.detached_at,
           s.id as sid, s.empty, s.purged_at, s.lost_at, s.superseded_at, s.nas_withdrawn_at
      from par join prim p on p.canal = par.canal
      left join public.obs_archive_months m on m.site_id = p_site and m.class = (select classe from k)
                                           and m.table_name = 'competitor_video_daily' and m.month = par.mes
      left join lateral (select s2.* from public.obs_archive_summaries s2
                          where s2.site_id = p_site and s2.class = (select classe from k) and s2.channel_ref = par.canal and s2.month = par.mes
                          order by s2.version desc limit 1) s on true),
  cls as (
    select cel.*,
      case
        when primeiro is not null and mes < primeiro then 'antes'
        when sealed_at is not null and sealed_kind in ('vazio_conferido', 'sem_dado_a_guardar') then 'vazio'
        when sealed_at is not null and sealed_kind = 'com_dado' then
          case when sid is null or purged_at is not null or lost_at is not null or superseded_at is not null or nas_withdrawn_at is not null then 'faltou'
               when empty then 'vazio' else 'arquivo' end
        when detached_at is not null then 'faltou'     -- destacado sem selo: a cópia não existe
        else 'online' end as k,
      case
        when primeiro is not null and mes < primeiro then null
        when sealed_at is not null and sealed_kind = 'com_dado' and sid is null then 'sem_registro_do_canal'
        when sealed_at is not null and sealed_kind = 'com_dado' and purged_at is not null then 'expurgado'
        when sealed_at is not null and sealed_kind = 'com_dado' and (lost_at is not null or superseded_at is not null or nas_withdrawn_at is not null) then 'sem_copia'
        when sealed_at is null and detached_at is not null then 'sem_copia' end as x
      from cel),
  fim as (
    select canal, mes, k, x,
      case when k = 'antes' then primeiro
           when k = 'vazio' then (sealed_at at time zone 'America/Sao_Paulo')::date
           when x = 'expurgado' then (purged_at at time zone 'America/Sao_Paulo')::date end as d
      from cls)
  select jsonb_build_object(
    'celulas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('c', canal, 'm', to_char(mes, 'YYYY-MM'), 'k', k, 'x', x, 'd', d)) order by mes desc, canal)
                           from fim where k <> 'arquivo'), '[]'::jsonb),
    'guardados', (select count(*) from unnest(p_canais) c where exists (select 1 from public.obs_archive_channel_removals r
                   where r.site_id = p_site and r.channel_ref = c and r.archive_decision = 'guardar')),
    'sem_destino', (select count(*) from unnest(p_canais) c      -- M-3 (Yannis): canal ausente de competitor_channels e sem linha de remoção
                     where not exists (select 1 from public.competitor_channels ch where ch.site_id = p_site and ch.id::text = c)
                       and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = c)))
$$;
revoke all on function public.obs_archive_request_plan(uuid, text, text[], date[]) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_create(p_site uuid, p_kind text, p_channels text[], p_choice text, p_measures text[], p_by uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_lim jsonb := public.obs_archive_request_limits();
  v_cur date := date_trunc('month', (v_agora at time zone 'America/Sao_Paulo'))::date;
  v_classe text := case p_kind when 'ensaio' then 'ensaio' else 'serie' end;
  v_canais text[]; v_first date; v_n integer; v_months date[]; v_fp text; v_id uuid; v_old record; v_arq integer; v_plan jsonb;
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
  -- canais resolvidos (Phil C2a): os nomeados, ou todos os do site (vivos e com resumo) sem remoção 'apagar'; gravado na criação
  v_canais := case when p_channels is not null then (select array_agg(distinct c order by c) from unnest(p_channels) c)
    else (select array_agg(x.canal order by x.canal)
            from (select ch.id::text as canal from public.competitor_channels ch where ch.site_id = p_site
                  union select s.channel_ref from public.obs_archive_summaries s where s.site_id = p_site and s.class = v_classe) x
           where not exists (select 1 from public.obs_archive_channel_removals r
                              where r.site_id = p_site and r.channel_ref = x.canal and r.archive_decision = 'apagar')) end;
  if v_canais is null then return jsonb_build_object('status', 'nada_a_pedir'); end if;
  select min(public.obs_archive_first_month(p_site, v_classe, c)) into v_first from unnest(v_canais) c;
  if v_first is null then return jsonb_build_object('status', 'nada_a_pedir'); end if;
  v_n := case p_choice when 'tudo' then ((extract(year from v_cur) * 12 + extract(month from v_cur)) - (extract(year from v_first) * 12 + extract(month from v_first)))::int + 1
         else p_choice::int end;
  if v_n > (v_lim->>'teto_meses')::int then raise exception 'grande_demais' using errcode = 'P0001'; end if;
  select array_agg(m order by m desc) into v_months
    from (select (v_cur - make_interval(months => i))::date m from generate_series(0, v_n - 1) i) q where m >= v_first;
  if cardinality(v_months) * cardinality(v_canais) > (v_lim->>'teto_entradas')::int then raise exception 'grande_demais' using errcode = 'P0001'; end if;
  v_fp := public.obs_archive_request_fingerprint(p_kind, p_channels, v_months, p_measures);
  -- D6/item 53: o vencido não segura o índice; normaliza só o deste site e desta impressão (mesmo molde do passo 1 do claim)
  update public.obs_archive_requests r set status = s.st->>'status', fail_reason = s.st->>'motivo', finished_at = v_agora
    from (select x.id, public.obs_archive_request_state(x) as st from public.obs_archive_requests x
           where x.site_id = p_site and x.fingerprint = v_fp and x.status in ('pending', 'running')) s
   where r.id = s.id and (s.st->>'status') in ('expired', 'failed');
  select r.id, r.requested_at into v_old from public.obs_archive_requests r
   where r.site_id = p_site and r.fingerprint = v_fp and r.status in ('pending', 'running');
  if found then return jsonb_build_object('status', 'repetido', 'id', v_old.id, 'requested_at', v_old.requested_at); end if;
  select count(*) into v_arq from public.obs_archive_request_files(p_site, p_kind, v_canais, v_months);
  if v_arq = 0 then v_plan := public.obs_archive_request_plan(p_site, p_kind, v_canais, v_months); end if;   -- só online: o plano nasce aqui
  begin
    insert into public.obs_archive_requests (site_id, kind, channel_refs, resolved_channel_refs, months_choice, months, measures, fingerprint,
                                             online_only, plan, requested_by, requested_at, expires_at)
    values (p_site, p_kind, p_channels, v_canais, p_choice, v_months, p_measures, v_fp, v_arq = 0, v_plan, p_by, v_agora, v_agora + interval '15 minutes')
    returning id into v_id;
  exception when unique_violation then          -- clique duplo em duas conexões: o perdedor lê o ganhador
    select r.id, r.requested_at into v_old from public.obs_archive_requests r
     where r.site_id = p_site and r.fingerprint = v_fp and r.status in ('pending', 'running');
    return jsonb_build_object('status', 'repetido', 'id', v_old.id, 'requested_at', v_old.requested_at);
  end;
  return jsonb_build_object('status', 'criado', 'id', v_id, 'requested_at', v_agora, 'so_online', v_arq = 0);
end $$;
revoke all on function public.obs_archive_request_create(uuid, text, text[], text, text[], uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_request_create(uuid, text, text[], text, text[], uuid) to service_role;

-- M6 (Phil): a corrida entre 'cancelar' e 'finish' fecha no próprio UPDATE: quem chega depois não encontra o pedido ativo.
create or replace function public.obs_archive_request_cancel(p_site uuid, p_request uuid, p_by uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz := public.obs_archive_agora(); v_id uuid;
begin
  update public.obs_archive_requests q set status = 'cancelled', cancelled_at = v_at, cancelled_by = p_by, cancelled_reason = 'dono', finished_at = v_at
   where q.id = p_request and q.site_id = p_site and q.status in ('pending', 'running')
     and (public.obs_archive_request_state(q)->>'status') in ('pending', 'running')
  returning q.id into v_id;
  if v_id is null then return jsonb_build_object('status', 'ja_terminado'); end if;
  return jsonb_build_object('status', 'cancelado', 'cancelled_at', v_at);
end $$;
revoke all on function public.obs_archive_request_cancel(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_request_cancel(uuid, uuid, uuid) to service_role;

create or replace function public.obs_archive_request_status(p_site uuid, p_request uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'status_efetivo', st->>'status', 'fail_reason', st->>'motivo',
                            'progress_done', r.progress_done, 'progress_total', r.progress_total)
    from public.obs_archive_requests r cross join lateral (select public.obs_archive_request_state(r) as st) x
   where r.id = p_request and r.site_id = p_site
$$;
revoke all on function public.obs_archive_request_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_request_status(uuid, uuid) to service_role;
```

  - **`obs_archive_request_read`** (mesmo molde; trechos que importam):

```sql
create or replace function public.obs_archive_request_read(p_site uuid, p_channel text, p_ligado boolean, p_incluir_pedido boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_cur date := date_trunc('month', (v_agora at time zone 'America/Sao_Paulo'))::date;
  v_win integer; v_first date; v_n integer; v_prev jsonb := '{}'::jsonb; v_choice text; v_months date[]; v_plan jsonb; v_banco integer; v_antes integer;
  v_no jsonb; v_hb timestamptz; r public.obs_archive_requests; v_st jsonb; v_pedido jsonb; v_res jsonb; v_ant jsonb;
begin
  select w.window_months into v_win from public.obs_archive_policy() w where w.class = 'serie' and w.table_name = 'competitor_video_daily';
  v_first := public.obs_archive_first_month(p_site, 'serie', p_channel);
  foreach v_choice in array array['12', '24', '36', 'tudo'] loop
    v_n := case v_choice when 'tudo' then case when v_first is null then 0
             else ((extract(year from v_cur) * 12 + extract(month from v_cur)) - (extract(year from v_first) * 12 + extract(month from v_first)))::int + 1 end
           else v_choice::int end;
    if v_n = 0 or v_n > 36 then   -- grande_demais: só o total (a tela desliga "Pedir")
      v_prev := v_prev || jsonb_build_object(v_choice, jsonb_build_object('banco', 0, 'nas', 0, 'antes', 0, 'total', v_n)); continue;
    end if;
    select array_agg(m order by m desc) into v_months from (select (v_cur - make_interval(months => i))::date m from generate_series(0, v_n - 1) i) q;
    v_plan := public.obs_archive_request_plan(p_site, 'relatorio', array[p_channel], v_months);
    select count(*) filter (where c->>'k' = 'online'), count(*) filter (where c->>'k' = 'antes') into v_banco, v_antes from jsonb_array_elements(v_plan->'celulas') c;
    v_prev := v_prev || jsonb_build_object(v_choice, jsonb_build_object('banco', v_banco, 'antes', v_antes, 'nas', v_n - v_banco - v_antes, 'total', v_n));   -- L2: por origem da leitura
  end loop;
  select jsonb_build_object('de', to_char(min(m.month), 'YYYY-MM'), 'ate', to_char(max(m.month), 'YYYY-MM')) into v_no
    from public.obs_archive_months m
   where m.site_id = p_site and m.class = 'serie' and m.table_name = 'competitor_video_daily' and m.detached_at is not null
     and exists (select 1 from public.obs_archive_summaries s where s.site_id = m.site_id and s.class = m.class and s.channel_ref = p_channel and s.month = m.month);
  select h.last_poll_at into v_hb from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = 'respondedor';
  if p_incluir_pedido then
    select * into r from public.obs_archive_requests q where q.site_id = p_site and p_channel = any (q.resolved_channel_refs) order by q.requested_at desc limit 1;
    if found then
      v_st := public.obs_archive_request_state(r);
      v_pedido := jsonb_build_object('id', r.id, 'status', r.status, 'status_efetivo', v_st->>'status', 'fail_reason', v_st->>'motivo',
        'requested_by', r.requested_by, 'requested_at', r.requested_at, 'progress_done', r.progress_done, 'progress_total', r.progress_total,
        'cancelled_at', r.cancelled_at, 'finished_at', r.finished_at);
      -- o resultado do PEDIDO (mesmo vencido: a tela diz "venceu" enquanto a poda não o leva; a poda só leva o pedido sem resultado: I-5)
      select jsonb_build_object('gerado_em', x.created_at, 'vale_ate', x.valid_until, 'estado', x.state,
               'meses', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(x.payload->'meses') e where e->>'canal' = p_channel)) into v_res
        from public.obs_archive_results x where x.request_id = r.id;
    end if;
    if r.id is null or (v_st->>'status') <> 'done' then      -- Phil M2 / D21: o último resultado ainda válido do canal
      select jsonb_build_object('gerado_em', x.created_at, 'vale_ate', x.valid_until, 'estado', x.state,
               'meses', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(x.payload->'meses') e where e->>'canal' = p_channel)) into v_ant
        from public.obs_archive_results x where x.site_id = p_site and p_channel = any (x.channel_refs) and x.valid_until > v_agora
       order by x.created_at desc limit 1;
    end if;
  end if;
  return jsonb_build_object('arquivo_ligado', p_ligado,
    'meses_no_arquivo', (select count(distinct m.month) from public.obs_archive_months m
                          where m.site_id = p_site and m.class = 'serie' and m.table_name = 'competitor_video_daily' and m.detached_at is not null
                            and exists (select 1 from public.obs_archive_summaries s where s.site_id = m.site_id and s.class = m.class and s.channel_ref = p_channel and s.month = m.month)),
    'no_arquivo', v_no,
    'primeiro_sai_em', case when v_first is null then null else public.obs_archive_pode_sair_em(v_first, v_win) end,
    'ultimo_sinal', v_hb, 'previa', v_prev, 'pedido', v_pedido, 'resultado', v_res, 'resultado_anterior', v_ant);
end $$;
revoke all on function public.obs_archive_request_read(uuid, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_request_read(uuid, text, boolean, boolean) to service_role;
```

  `v_no` com `min`/`max` de zero linhas vira `{de: null, ate: null}`: quando `meses_no_arquivo = 0`, devolver `no_arquivo: null` (`case when ... = 0 then null`); o Zod `nullable()` da Tarefa 2 espera isso.
- [ ] **Passo 3.** Testes passam; anotar no ledger o tempo de `obs_archive_request_read` com 75 canais sintéticos × 36 meses no registro (`\timing` no `psql -p 54422`), alvo < 200 ms; e o `explain (analyze, buffers)` de `obs_archive_first_month` com as partições da M2 aplicadas no `bythiago_int` (uma sonda por partição por vídeo: confirmar o custo).
- [ ] **Passo 4. Commit** `feat: M7: criar, cancelar, ler e status do pedido (impressão única, plano por par canal×mês, vencido calculado na leitura)`.

---

### Tarefa 5: SQL parte 3, claim, progresso, falha

**Files:**
- Modify: `supabase/rascunhos/m7.sql`, `apps/web/test/integration/manutencao-m7-fila.test.ts`

**Interfaces:**
- Produces: `obs_archive_request_claim(p_site uuid, p_prova boolean default false) returns jsonb` (o `RespostaClaim` da Tarefa 1); `obs_archive_request_progress(p_site uuid, p_request uuid, p_token uuid, p_done int, p_total int) returns jsonb`; `obs_archive_request_fail(p_site uuid, p_request uuid, p_token uuid, p_reason text, p_detail text) returns jsonb`; interna `obs_archive_request_lock(p_site, p_request, p_token, p_aceita_done boolean default false) returns obs_archive_requests` (única porta dos códigos `pedido_*`). As três primeiras com `grant execute to service_role`.

**O que acontece quando o dado não existe:** fila vazia → `{pedido: null}`; pedido `online_only` → o claim nunca o pega (a server action o fecha); pedido cujos resumos todos sumiram entre a criação e o claim → `failed/inesperado` com `fail_detail = 'sem_arquivo_no_claim'` e `{pedido: null}` (nunca manda `total: 0` à forja, nunca fica `running` sem dono; pedir de novo cai no caminho só online); pedido acumulado e vencido → nunca é pego (item 51); `prova: true` → nada é tomado, normalizado nem gravado.

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `item 51: acumulados com a casa desligada vencem, não rodam no religamento` | três pedidos criados com relógio T; claim com relógio T+20 min → `{pedido: null}`; os três com `status_efetivo = 'expired'` e, no disco, `status = 'expired'` |
| `claim pega o mais antigo, com skip locked` | dois pendentes; dois claims em duas conexões (`M7_CORRIDAS=1`, molde da M3b) pegam pedidos diferentes |
| `contador sobe antes de processar (item 52)` | claim → `attempts = 1`, `token` novo, `deadline_at = claimed_at + 15 min`, `lease_until = claimed_at + 3 min`, `restante_s = 900` |
| `item 52: pedido que derruba o respondedor ≤ 2 tentativas` | claim; relógio passa o arrendamento; claim de novo → mesmo pedido, `tentativa: 2`, token novo, **`restante_s` = 900 − os segundos passados (Yannis I-10)**; relógio passa o arrendamento outra vez; **`obs_archive_request_read` já traz `status_efetivo = 'failed'`, `fail_reason = 'inesperado'`** (I-1); claim → `{pedido: null}` e o pedido fica `failed`/`inesperado` com `fail_detail = 'teto de tentativas'` no disco |
| `claim é o batimento (Phil I1)` | `last_poll_at` do `respondedor` = relógio do claim; com `p_prova = true` nada muda |
| `prova não toma pedido` | `p_prova = true` com pedido pendente: `{pedido: null, prova: {ha_pedido: true}}`; o pedido continua `pending`, `attempts = 0`; sem pedido: `ha_pedido: false` |
| `lista com 1.001 arquivos chega inteira (item 162)` | 1.001 resumos sintéticos (`obs_archive_summaries` com `canal_sha256`, `canal_bytes`, `canal_rows` > 0) em 28 canais × 36 meses para um pedido `p_channels = null` de 36 meses: `total = 1001` e `jsonb_array_length(arquivos) = 1001`; ordem (mês desc, canal) |
| `só .canal da classe serie; nunca ensaio no relatório (item 103)` | resumos `ensaio` plantados no mesmo mês não entram; tipo `ensaio` só lista `ensaio` |
| `purgado, perdido, substituído, retirado do NAS e vazio não entram na lista` | cinco resumos com `purged_at`, `lost_at`, `superseded_at`, `nas_withdrawn_at` e `empty = true` ficam fora; **cada um aparece no plano gravado** (`faltou`/`expurgado`, `sem_copia`, `vazio`), nunca some |
| `mês sem entrada no registro nunca é pedido (item 55)` | mês anterior ao primeiro registro não aparece na lista; vira `antes` no plano |
| `plano gravado no claim` | `plan->'celulas'` = a classificação da Tarefa 4 para o pedido; `plan->>'guardados'` e `plan->>'sem_destino'` contam `guardar` e canal ausente sem remoção, separados (M-3) |
| `pedido online_only nunca é pego` | pedido criado `online_only`: claim → `{pedido: null}` e o pedido continua `pending` até a server action |
| `resumos sumiram entre a criação e o claim` | pedido com 1 arquivo; `purged_at` no resumo; claim → `{pedido: null}`, pedido `failed`/`inesperado`/`sem_arquivo_no_claim` |
| `progresso renova o arrendamento, nunca além do prazo` | `lease_until = least(agora + 3 min, deadline_at)`; token errado → `pedido_de_outro`; cancelado → `pedido_cancelado`; passado o prazo → `pedido_vencido` |
| `falha grava motivo` | `fail(..., 'nas_fora')` → `failed`, `fail_reason = 'nas_fora'`, `finished_at`; segunda chamada → `pedido_vencido` (não está mais `running`); motivo fora da lista → `escolha_invalida` |
| `teto` | pedido cujo número de arquivos passa de `teto_entradas` (1.748 resumos sintéticos): o claim marca `failed`/`grande_demais` e devolve `{pedido: null}` (a criação conta pares canal × mês; o claim confere a lista) |

- [ ] **Passo 2. SQL do claim e da porta dos códigos:**

```sql
-- A única porta dos códigos pedido_* (R2/R3/R4): token, cancelado, vencido. p_aceita_done deixa o finish repetir (replay).
create or replace function public.obs_archive_request_lock(p_site uuid, p_request uuid, p_token uuid, p_aceita_done boolean default false)
returns public.obs_archive_requests language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests;
begin
  select * into r from public.obs_archive_requests q where q.id = p_request and q.site_id = p_site for update;
  if not found then raise exception 'pedido_vencido' using errcode = 'P0001'; end if;
  if r.claim_token is distinct from p_token then raise exception 'pedido_de_outro' using errcode = 'P0001'; end if;
  if r.status = 'cancelled' then raise exception 'pedido_cancelado' using errcode = 'P0001'; end if;
  if r.status = 'done' and p_aceita_done then return r; end if;
  if r.status <> 'running' or public.obs_archive_agora() > r.deadline_at then raise exception 'pedido_vencido' using errcode = 'P0001'; end if;
  return r;
end $$;
revoke all on function public.obs_archive_request_lock(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_claim(p_site uuid, p_prova boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_lim jsonb := public.obs_archive_request_limits();
  r public.obs_archive_requests; v_lista jsonb; v_total int; v_token uuid := gen_random_uuid();
begin
  if p_prova then      -- Phil M8: a prova da rota não toma pedido, não normaliza e não grava batimento
    return jsonb_build_object('pedido', null, 'prova', jsonb_build_object('ha_pedido', exists (
      select 1 from public.obs_archive_requests q where q.site_id = p_site and not q.online_only and q.status in ('pending', 'running')
         and (public.obs_archive_request_state(q)->>'status') in ('pending', 'running'))));
  end if;
  -- o claim é o batimento do respondedor (Phil I1, variante B); a rota heartbeat só mede disco e montagens
  insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, updated_at) values (p_site, 'respondedor', v_agora, v_agora)
    on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at, updated_at = excluded.updated_at;
  -- 1. normaliza o que a leitura já chama de vencido ou de teto de tentativas (item 51; Yannis I-1): grava exatamente o estado que a leitura calcula
  update public.obs_archive_requests q set status = s.st->>'status', fail_reason = s.st->>'motivo',
         fail_detail = case when s.st->>'motivo' = 'inesperado' then 'teto de tentativas' end, finished_at = v_agora
    from (select x.id, public.obs_archive_request_state(x) as st from public.obs_archive_requests x
           where x.site_id = p_site and x.status in ('pending', 'running')) s
   where q.id = s.id and (s.st->>'status') in ('expired', 'failed');
  -- 2. pega um: pendente, ou em andamento com arrendamento vencido e 1 tentativa; o só online é da server action
  select * into r from public.obs_archive_requests q
   where q.site_id = p_site and not q.online_only
     and (q.status = 'pending' or (q.status = 'running' and q.lease_until < v_agora and q.attempts < 2))
   order by q.requested_at for update skip locked limit 1;
  if not found then return jsonb_build_object('pedido', null); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'arquivo_id', 's:' || f.summary_id || ':canal', 'classe', f.classe, 'filho', 'numerico',
           'caminho', f.classe || '/canais/' || f.canal || '/resumo/' || to_char(f.mes, 'YYYY-MM') || '.v' || f.versao || '.canal.csv.gz',
           'canal', f.canal, 'mes', to_char(f.mes, 'YYYY-MM'), 'versao', f.versao, 'sha256', f.sha256, 'bytes', f.bytes)
           order by f.mes desc, f.canal), '[]'::jsonb), count(*)
    into v_lista, v_total from public.obs_archive_request_files(p_site, r.kind, r.resolved_channel_refs, r.months) f;
  if v_total = 0 then      -- os resumos sumiram entre a criação e o claim: nunca total 0 na forja, nunca running sem dono
    update public.obs_archive_requests set status = 'failed', fail_reason = 'inesperado', fail_detail = 'sem_arquivo_no_claim', finished_at = v_agora where id = r.id;
    return jsonb_build_object('pedido', null);
  end if;
  if v_total > (v_lim->>'teto_entradas')::int then
    update public.obs_archive_requests set status = 'failed', fail_reason = 'grande_demais', finished_at = v_agora where id = r.id;
    return jsonb_build_object('pedido', null);
  end if;
  update public.obs_archive_requests set status = 'running', attempts = attempts + 1, claim_token = v_token,
         claimed_at = coalesce(claimed_at, v_agora), deadline_at = coalesce(deadline_at, v_agora + interval '15 minutes'),
         lease_until = least(v_agora + interval '3 minutes', coalesce(deadline_at, v_agora + interval '15 minutes')),
         claimed_files = v_lista, plan = public.obs_archive_request_plan(p_site, r.kind, r.resolved_channel_refs, r.months),   -- D20
         progress_done = 0, progress_total = v_total
   where id = r.id returning * into r;
  return jsonb_build_object('pedido', jsonb_build_object('id', r.id, 'token', v_token, 'tipo', r.kind, 'prazo', r.deadline_at,
    'restante_s', greatest(floor(extract(epoch from r.deadline_at - v_agora))::int, 0),    -- Yannis I-10: o respondedor orça pelo que falta, não por 780 s fixos
    'arrendamento_ate', r.lease_until, 'tentativa', r.attempts, 'total', v_total, 'arquivos', v_lista));
end $$;
revoke all on function public.obs_archive_request_claim(uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_request_claim(uuid, boolean) to service_role;

create or replace function public.obs_archive_request_progress(p_site uuid, p_request uuid, p_token uuid, p_done integer, p_total integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests; v_agora timestamptz := public.obs_archive_agora();
begin
  r := public.obs_archive_request_lock(p_site, p_request, p_token);
  update public.obs_archive_requests set progress_done = p_done, progress_total = p_total,
         lease_until = least(v_agora + interval '3 minutes', r.deadline_at) where id = r.id returning lease_until into r.lease_until;
  return jsonb_build_object('arrendamento_ate', r.lease_until);
end $$;
revoke all on function public.obs_archive_request_progress(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.obs_archive_request_progress(uuid, uuid, uuid, integer, integer) to service_role;

create or replace function public.obs_archive_request_fail(p_site uuid, p_request uuid, p_token uuid, p_reason text, p_detail text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests;
begin
  if p_reason not in ('nas_fora', 'grande_demais', 'inesperado') then raise exception 'escolha_invalida' using errcode = 'P0001'; end if;
  r := public.obs_archive_request_lock(p_site, p_request, p_token);
  update public.obs_archive_requests set status = 'failed', fail_reason = p_reason, fail_detail = left(p_detail, 200), finished_at = public.obs_archive_agora() where id = r.id;
  return jsonb_build_object('estado', 'failed');
end $$;
revoke all on function public.obs_archive_request_fail(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.obs_archive_request_fail(uuid, uuid, uuid, text, text) to service_role;
```

  - Nota de contrato: `restante_s` e `prova` são campos do R1; a rota os repassa e o Zod `.strict()` da `RespostaClaim` recusa qualquer campo a mais (teste da Tarefa 8).
- [ ] **Passo 3.** Testes passam (`HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m7-fila.test.ts --no-file-parallelism > /tmp/m7-t5.txt 2>&1`; só falhas no contexto).
- [ ] **Passo 4. Commit** `feat: M7: claim (batimento, prova, plano por par), progresso e falha (contador antes, teto 2 com o motivo certo, vencido nunca pego)`.

---

### Tarefa 6: SQL parte 4, online parcial, conferência e resultado (TRAVA M7-0b)

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/integration/manutencao-m7-resultado.test.ts`

**Interfaces:**
- Consumes (da M3b, pedido na Tarefa 10 dela): `obs_archive_summary_calc(p_site uuid, p_class text, p_channel uuid, p_table text, p_month date, p_hash text, p_ver text) returns jsonb` (`{canal: [14 textos], video: [[...]]}`; interna; **com os mesmos `set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'` de `obs_archive_summary_rows`**, `m3b.sql:1074-1075`).
- Produces: `obs_archive_request_linha_ok(p_linha jsonb, p_hashes jsonb) returns boolean` (interna); `obs_archive_request_check(p_site, p_request, p_token) returns jsonb` (`{replay, meses_online}`; token nulo = pedido só online); `obs_archive_request_online(p_site uuid, p_request uuid, p_month date) returns jsonb` (um mês: `[{canal, mes, linha}]` para as células `online` do plano); `obs_archive_request_conclude(r, p_lidos, p_falhas, p_online)` (interna, a única que grava resultado); `obs_archive_request_finish(p_site, p_request, p_token, p_lidos, p_falhas, p_online) returns jsonb` → `{estado: 'completo'|'incompleto'|'devolvido'|'cancelado'|'falhou'}`; `obs_archive_request_finish_online(p_site, p_request, p_online) returns jsonb`; `obs_archive_request_fail_online(p_site, p_request, p_detail) returns jsonb`.

**O que acontece quando o dado não existe:** arquivo listado sem resposta nem falha, ou resposta de arquivo que o claim não listou → `resposta_fora_da_lista` (nada gravado); arquivo lido com zero linha onde `canal_rows > 0` → mês `faltou`/`divergente` (item 55, nunca zero); mês selado `vazio_conferido` ou resumo do canal `empty` → `vazio_conferido` com `conferido_em` do selo; mês selado sem resumo utilizável → `faltou` com `sem_copia`/`expurgado`/`sem_registro_do_canal`; mês online sem linha do canal → `sem_registro` (nunca `parcial` com zero dias); mês anterior à coleta → `antes_da_coleta`; **par (canal, mês) ausente de todas as fontes → `faltou`/`divergente`, e a função levanta `invariante_do_resultado` se mesmo assim a contagem não fechar** (nenhum mês some).

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `nenhum mês do pedido some (C1; Yannis I-7)` | para cada um dos 6 casos (resumo do canal `empty` em mês `com_dado`; resumo `lost_at`/`nas_withdrawn_at`; mês destacado sem selo; mês `purged_at` depois do claim na 2ª vez; mês selado entre o claim e o `result`; canal sem resumo em mês selado): `jsonb_array_length(payload->'meses') = cardinality(months) × canais`, o estado do pedido é o esperado (`incompleto` se há `faltou`) e o motivo é o da tabela da Tarefa 4 |
| `item 103: não selado vem do banco, marcado parcial, pela mesma função` | mês corrente: `obs_archive_request_online` devolve a `linha` igual à de `obs_archive_summary_calc` com hash nulo; no payload `estado: 'parcial'`, `origem: 'banco_sem_copia'`, `parcial: true` |
| `I-8: online = selagem com a sessão em outro fuso e formato` | `set timezone = 'America/Sao_Paulo'; set extra_float_digits = 0; set datestyle = 'SQL, DMY'` na sessão antes de chamar `obs_archive_request_online`; a `linha` é **byte a byte** a de `obs_archive_summary_rows` do mesmo mês (o banco local roda em UTC: sem este `set` o teste não pegaria a falta dos `SET` na função) |
| `item 103: selado vem do arquivo` | mês selado com dado diferente no banco (linha alterada só no banco, como dono): o payload traz o número do arquivo, não o do banco |
| `mês online sem linha: sem_registro, nunca zero (Logan 5)` | canal com diária só no mês anterior: o mês corrente vira `sem_registro` com `parcial: true` e `conferido_em` = hoje (SP); um mês fechado no meio, vira `sem_registro` com `parcial` ausente; **nenhuma entrada** com `dias_medidos = 0` |
| `antes da coleta` | mês anterior ao primeiro dado do canal: `antes_da_coleta` com `primeira_leitura` = primeiro mês; sem `views` |
| `item 55: linhas esperadas e resposta zero é incompleto` | `lidos` com `linhas: []` para resumo de `canal_rows = 2` → mês `faltou`, `motivo: 'divergente'`, `state = 'incompleto'` |
| `D2/Phil I7: o par tabela-hash é conferido` | linha `competitor_video_early` com o hash da unidade `daily` → `divergente`; `linha[4]` (linhas) diferente de `row_count` da unidade → `divergente`; célula numérica `'abc'` ou `'1e3'` → `divergente` e **sem** erro `22P02` |
| `D2: hash de unidade diferente é divergente` | uma linha com `hash_conteudo_unidade` trocado → `divergente` |
| `falhas por arquivo viram meses incompletos` | `falhas: [{..., motivo: 'ausente'}]` → mês `faltou`/`ausente`; `nas_fora` idem com o seu motivo; os outros meses completos |
| `resumo purgado depois do claim volta a pending uma vez` | claim; `purged_at` num resumo da lista; finish → `devolvido`, `status = 'pending'`, `requeued_once = true`, `attempts = 0`, `claimed_files`/`plan` nulos, `expires_at = agora + 15 min`; claim de novo, purgar outro e finish → grava normalmente e o mês purgado entra como `faltou`/`expurgado` com a data do `purged_at` (nunca `ausente`, nunca fora da lista) |
| `item 54: resultado acima do teto é recusado antes de inserir` | `p_lidos` que faz `octet_length(payload::text) > 524288` → `failed`/`grande_demais`, `{estado: 'falhou'}`, nenhuma linha em `obs_archive_results` |
| `D4: uma entrada cabe em 300 bytes` | a maior entrada possível (estado `ok` com todas as chaves preenchidas: canal uuid, views de 15 dígitos, `primeira_leitura`) tem `octet_length(entrada::text) <= 300`; payload com 1.747 entradas sintéticas fica `< 524288` |
| `item 54: total ≤ 8 MB expulsando o mais antigo` | 17 resultados de ~500 kB (com `created_at` distintos pelo relógio de teste): o 17º insere e o mais antigo sai; `sum(payload_bytes) <= 8388608`; o pedido expulso: `obs_archive_request_read` traz `pedido.status_efetivo = 'done'` e `resultado: null` |
| `M-5: duas conclusões ao mesmo tempo respeitam o teto` | `M7_CORRIDAS=1`: duas conexões concluem pedidos de ~4,5 MB cada com 8 MB já ocupado; `sum(payload_bytes) <= 8388608` ao fim |
| `item 56: sem corpo nem id de comentário` | `p_lidos` com uma coluna a mais (ex.: `comment_id`) → `divergente`; o payload só tem as chaves `mes, canal, estado, origem, parcial, dias_medidos, dias_do_mes, views, likes, comentarios_contagem, conferido_em, primeira_leitura, motivo`; `payload::text` não casa `/comment_id|text_original|author/` |
| `token, cancelado e vencido` | token errado → `pedido_de_outro`; cancelado durante a leitura → `pedido_cancelado`, nada gravado; passado o prazo → `pedido_vencido` |
| `replay idempotente (Phil M3)` | `finish` repetido com o mesmo token num pedido `done` devolve o mesmo `estado`, sem segundo insert; se o resultado foi expulso → `pedido_vencido` |
| `arquivo fora da lista` | `arquivo_id` que o claim não listou, um que falta, ou um repetido → `resposta_fora_da_lista` (dois repetidos não mascaram um faltante) |
| `canal removido com apagar durante a leitura` | decisão `apagar` entre o claim e o finish: `{estado: 'cancelado'}`, pedido `cancelled`/`canal_apagado`, nenhum resultado gravado |
| `só online fecha sem a forja (Yannis I-2, Phil C2)` | `create` devolve `so_online: true`; `check(token nulo)` devolve os meses online; `online` por mês; `finish_online` → `done`, payload com todos os pares; claim nunca viu o pedido. `resolved_channel_refs`/`channel_refs` do resultado = `'{A}'` e a remoção `apagar` de outro canal B **não** apaga o resultado de A |
| `fail_online` | `failed`/`inesperado`; a leitura diz `inesperado`, não `sem_trabalhador` |
| `check antes de montar (M-12)` | `check` de pedido cancelado, vencido ou de outro token levanta o código sem tocar em `online` |
| `chamar a mesma função` | `select prosrc from pg_proc where proname = 'obs_archive_request_online'` contém `obs_archive_summary_calc`; `obs_archive_summary_rows` (da M3b) também; nenhuma das duas contém o texto `execute format` |

- [ ] **Passo 2. A extração do cálculo mora na M3b (Yannis I-9).** Conferir `grep -n "function public.obs_archive_summary_calc" supabase/rascunhos/m3b.sql` (TRAVA M7-0b) e que a função tem os cinco `set`: `sed -n '/function public.obs_archive_summary_calc/,/^as \$\$/p' supabase/rascunhos/m3b.sql | grep -c "set timezone = 'UTC'"` = 1. **Plano B** (só se a M3b já virou migration sem a função): criar `obs_archive_summary_calc` no `m7.sql` com o bloco `execute format` de `m3b.sql:1110-1127` copiado por `sed -n 1110,1127p` (nunca digitado), com os cinco `set`, e na Tarefa 14, Passo 1, repetir `diff <(psql ... -c "select pg_get_functiondef('public.obs_archive_summary_rows'::regproc)") <(corpo esperado)`, **falhando alto** se divergir.
- [ ] **Passo 3. SQL: conferência de linha, check, online.**

```sql
-- D2 / Phil I7: a linha .canal confere em PAR com a unidade (tabela + hash + contagem). A regex vem antes de qualquer cast (CASE garante a ordem).
create or replace function public.obs_archive_request_linha_ok(p_linha jsonb, p_hashes jsonb) returns boolean
language sql stable set search_path = '' as $$
  select jsonb_typeof(p_linha) = 'array' and jsonb_array_length(p_linha) = 14
     and coalesce(p_linha->>3, '') ~ '^[0-9]+$' and coalesce(p_linha->>4, '') ~ '^[0-9]+$'
     and coalesce(p_linha->>5, '') ~ '^[0-9]+$' and coalesce(p_linha->>6, '') ~ '^[0-9]+$'
     and coalesce(p_linha->>9, '0') ~ '^-?[0-9]+$' and coalesce(p_linha->>10, '0') ~ '^-?[0-9]+$' and coalesce(p_linha->>11, '0') ~ '^-?[0-9]+$'
     and exists (select 1 from jsonb_each_text(p_hashes) h join public.obs_archive_units u on 'u:' || u.id = h.key
                  where u.table_name = p_linha->>1 and u.hash_conteudo = p_linha->>12 and h.value = u.hash_conteudo
                    and u.row_count = case when p_linha->>4 ~ '^[0-9]+$' then (p_linha->>4)::bigint end)
$$;
revoke all on function public.obs_archive_request_linha_ok(jsonb, jsonb) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_check(p_site uuid, p_request uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests;
begin
  if p_token is null then      -- pedido só online (a server action)
    select * into r from public.obs_archive_requests q where q.id = p_request and q.site_id = p_site;
    if not found or not r.online_only or r.status <> 'pending' or (public.obs_archive_request_state(r)->>'status') <> 'pending' then
      raise exception 'pedido_vencido' using errcode = 'P0001';
    end if;
  else
    r := public.obs_archive_request_lock(p_site, p_request, p_token, true);
    if r.status = 'done' then return jsonb_build_object('replay', true, 'meses_online', '[]'::jsonb); end if;
  end if;
  return jsonb_build_object('replay', false, 'meses_online', coalesce(
    (select jsonb_agg(q.m order by q.m desc) from (select distinct c->>'m' as m from jsonb_array_elements(coalesce(r.plan->'celulas', '[]'::jsonb)) c where c->>'k' = 'online') q), '[]'::jsonb));
end $$;
revoke all on function public.obs_archive_request_check(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_request_check(uuid, uuid, uuid) to service_role;

-- D13: um mês por chamada. Só as células 'online' do PLANO gravado (nunca recalcula): mês selado depois do claim não some.
create or replace function public.obs_archive_request_online(p_site uuid, p_request uuid, p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.obs_archive_requests; v_mes text := to_char(p_month, 'YYYY-MM'); c record; v_out jsonb := '[]'::jsonb;
begin
  select * into r from public.obs_archive_requests q where q.id = p_request and q.site_id = p_site;
  if not found then raise exception 'pedido_vencido' using errcode = 'P0001'; end if;
  for c in select distinct e->>'c' as canal from jsonb_array_elements(coalesce(r.plan->'celulas', '[]'::jsonb)) e
            where e->>'k' = 'online' and e->>'m' = v_mes order by 1 loop
    v_out := v_out || jsonb_build_array(jsonb_build_object('canal', c.canal, 'mes', v_mes,
      'linha', public.obs_archive_summary_calc(p_site, 'serie', c.canal::uuid, 'competitor_video_daily', p_month, null, 'online')->'canal'));
  end loop;
  return v_out;
end $$;
revoke all on function public.obs_archive_request_online(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.obs_archive_request_online(uuid, uuid, date) to service_role;
```

- [ ] **Passo 4. SQL: `conclude` (a única que grava resultado), `finish`, `finish_online`, `fail_online`.**

```sql
create or replace function public.obs_archive_request_conclude(r public.obs_archive_requests, p_lidos jsonb, p_falhas jsonb, p_online jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_hoje date := public.obs_archive_hoje_sp();
  v_cur text := to_char(date_trunc('month', v_hoje), 'YYYY-MM');
  v_lim jsonb := public.obs_archive_request_limits();
  v_entries jsonb; v_payload jsonb; v_bytes integer; v_estado text; v_cob jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('obs_archive_results_teto'));      -- M-5: duas conclusões somando a janela cada uma sem ver a outra
  if exists (select 1 from public.obs_archive_channel_removals x       -- Phil I9b: canal removido com apagar durante a leitura: nada é gravado
              where x.site_id = r.site_id and x.archive_decision = 'apagar' and x.channel_ref = any (r.resolved_channel_refs)) then
    update public.obs_archive_requests set status = 'cancelled', cancelled_reason = 'canal_apagado', cancelled_at = v_agora, finished_at = v_agora where id = r.id;
    return jsonb_build_object('estado', 'cancelado');
  end if;
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('mes', e.mes, 'canal', e.canal) || e.j) order by e.mes desc, e.canal) into v_entries
    from (
      with par as (select ch as canal, to_char(m, 'YYYY-MM') as mes from unnest(r.resolved_channel_refs) ch cross join unnest(r.months) m),
      lista as (select f->>'arquivo_id' as aid, f->>'canal' as canal, f->>'mes' as mes, (substr(f->>'arquivo_id', 3, 36))::uuid as sid
                  from jsonb_array_elements(coalesce(r.claimed_files, '[]'::jsonb)) f),
      falha as (select x->>'arquivo_id' as aid, x->>'motivo' as motivo from jsonb_array_elements(p_falhas) x),
      lido as (select x->>'arquivo_id' as aid, x->'linhas' as linhas from jsonb_array_elements(p_lidos) x),
      arq as (
        select l.canal, l.mes, s.purged_at, fa.motivo as falha, li.linhas, s.canal_rows, s.unit_hashes,
               (select e from jsonb_array_elements(coalesce(li.linhas, '[]'::jsonb)) e where e->>1 = 'competitor_video_daily' limit 1) as d
          from lista l join public.obs_archive_summaries s on s.id = l.sid
          left join falha fa on fa.aid = l.aid left join lido li on li.aid = l.aid),
      f_arq as (
        select a.canal, a.mes, case
          when a.falha is not null then jsonb_build_object('estado', 'faltou', 'motivo', a.falha)
          when a.purged_at is not null and a.purged_at > r.claimed_at     -- purgado depois do claim, 2ª vez: nunca 'ausente' (Yannis I-7 d)
            then jsonb_build_object('estado', 'faltou', 'motivo', 'expurgado', 'conferido_em', (a.purged_at at time zone 'America/Sao_Paulo')::date)
          when a.linhas is null or jsonb_array_length(a.linhas) <> a.canal_rows or a.d is null
               or exists (select 1 from jsonb_array_elements(a.linhas) e where not public.obs_archive_request_linha_ok(e, a.unit_hashes))
            then jsonb_build_object('estado', 'faltou', 'motivo', 'divergente')                               -- item 55 e D2
          else jsonb_build_object('estado', 'ok', 'origem', 'nas', 'dias_medidos', (a.d->>5)::int, 'dias_do_mes', (a.d->>6)::int,
                 'views', a.d->>9, 'likes', a.d->>10, 'comentarios_contagem', a.d->>11, 'primeira_leitura', a.d->>7) end as j
          from arq a),
      cel as (select c->>'c' as canal, c->>'m' as mes, c->>'k' as k, c->>'d' as d, c->>'x' as x
                from jsonb_array_elements(coalesce(r.plan->'celulas', '[]'::jsonb)) c),
      onl as (select o->>'canal' as canal, o->>'mes' as mes, o->'linha' as linha from jsonb_array_elements(p_online) o),
      f_cel as (
        select c.canal, c.mes, case c.k
          when 'vazio' then jsonb_build_object('estado', 'vazio_conferido', 'origem', 'nas', 'conferido_em', c.d)
          when 'faltou' then jsonb_build_object('estado', 'faltou', 'motivo', c.x, 'conferido_em', c.d)
          when 'antes' then jsonb_build_object('estado', 'antes_da_coleta', 'primeira_leitura', c.d)
          else case
            when o.linha is null or jsonb_typeof(o.linha) <> 'array' or jsonb_array_length(o.linha) <> 14 then jsonb_build_object('estado', 'faltou', 'motivo', 'divergente')
            when o.linha->>5 = '0' then jsonb_build_object('estado', 'sem_registro', 'parcial', c.mes = v_cur, 'conferido_em', v_hoje)   -- Logan 5: nunca "0 de 31 dias"
            else jsonb_build_object('estado', 'parcial', 'origem', 'banco_sem_copia', 'parcial', true, 'dias_medidos', (o.linha->>5)::int, 'dias_do_mes', (o.linha->>6)::int,
                   'views', o.linha->>9, 'likes', o.linha->>10, 'comentarios_contagem', o.linha->>11, 'primeira_leitura', o.linha->>7) end
        end as j
          from cel c left join onl o on o.canal = c.canal and o.mes = c.mes)
      select p.mes, p.canal, coalesce(fa.j, fc.j, jsonb_build_object('estado', 'faltou', 'motivo', 'divergente')) as j     -- par sem fonte: faltou, nunca omissão (C1)
        from par p left join f_arq fa on fa.canal = p.canal and fa.mes = p.mes left join f_cel fc on fc.canal = p.canal and fc.mes = p.mes
    ) e;
  if v_entries is null or jsonb_array_length(v_entries) <> cardinality(r.months) * cardinality(r.resolved_channel_refs) then
    raise exception 'invariante_do_resultado' using errcode = 'XX000';
  end if;
  v_estado := case when exists (select 1 from jsonb_array_elements(v_entries) x where x->>'estado' = 'faltou') then 'incompleto' else 'completo' end;
  v_payload := jsonb_build_object('versao', 1, 'meses', v_entries,
                 'guardados', coalesce((r.plan->>'guardados')::int, 0), 'sem_destino', coalesce((r.plan->>'sem_destino')::int, 0));
  v_bytes := octet_length(v_payload::text);                                   -- D4: o texto, não comprimido
  if v_bytes > (v_lim->>'carga')::int then
    update public.obs_archive_requests set status = 'failed', fail_reason = 'grande_demais', finished_at = v_agora where id = r.id;
    return jsonb_build_object('estado', 'falhou');                             -- item 54: recusa ANTES de inserir
  end if;
  v_cob := jsonb_build_object('entradas', jsonb_array_length(v_entries),
    'faltou', (select count(*) from jsonb_array_elements(v_entries) x where x->>'estado' = 'faltou'),
    'parcial', (select count(*) from jsonb_array_elements(v_entries) x where x->>'estado' = 'parcial'),
    'sem_registro', (select count(*) from jsonb_array_elements(v_entries) x where x->>'estado' = 'sem_registro'));
  delete from public.obs_archive_results x where x.id in (                    -- expulsão: o mais antigo sai até caber (a trava acima serializa)
    select q.id from (select y.id, sum(y.payload_bytes) over (order by y.created_at desc, y.id desc) as acc from public.obs_archive_results y) q
     where q.acc + v_bytes > (v_lim->>'total')::int);
  insert into public.obs_archive_results (request_id, site_id, channel_refs, payload, payload_bytes, coverage, state, created_at, valid_until)
  values (r.id, r.site_id, r.resolved_channel_refs, v_payload, v_bytes, v_cob, v_estado, v_agora, v_agora + make_interval(days => (v_lim->>'validade_dias')::int));
  update public.obs_archive_requests set status = 'done', finished_at = v_agora, progress_done = progress_total where id = r.id;
  return jsonb_build_object('estado', v_estado);
end $$;
revoke all on function public.obs_archive_request_conclude(public.obs_archive_requests, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_request_finish(p_site uuid, p_request uuid, p_token uuid, p_lidos jsonb, p_falhas jsonb, p_online jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests; v_agora timestamptz := public.obs_archive_agora(); v_n integer; v_estado text;
begin
  r := public.obs_archive_request_lock(p_site, p_request, p_token, true);
  if r.status = 'done' then      -- replay idempotente (Phil M3): a resposta se perdeu e a forja reenviou
    select x.state into v_estado from public.obs_archive_results x where x.request_id = r.id;
    if v_estado is null then raise exception 'pedido_vencido' using errcode = 'P0001'; end if;
    return jsonb_build_object('estado', v_estado);
  end if;
  select count(*) into v_n from jsonb_array_elements(coalesce(r.claimed_files, '[]'::jsonb));
  -- conjunto exato (O(F log F), nunca @> de array): a contagem, a lista dentro da resposta e a resposta dentro da lista
  if (select count(*) from (select x->>'arquivo_id' from jsonb_array_elements(p_lidos) x union all select x->>'arquivo_id' from jsonb_array_elements(p_falhas) x) u) <> v_n
     or exists (select f->>'arquivo_id' from jsonb_array_elements(coalesce(r.claimed_files, '[]'::jsonb)) f
                except (select x->>'arquivo_id' from jsonb_array_elements(p_lidos) x union select x->>'arquivo_id' from jsonb_array_elements(p_falhas) x))
     or exists ((select x->>'arquivo_id' from jsonb_array_elements(p_lidos) x union select x->>'arquivo_id' from jsonb_array_elements(p_falhas) x)
                except select f->>'arquivo_id' from jsonb_array_elements(coalesce(r.claimed_files, '[]'::jsonb)) f) then
    raise exception 'resposta_fora_da_lista' using errcode = 'P0001';
  end if;
  -- purgado depois do claim: volta a pending UMA vez (a 2ª vez vira 'expurgado' no conclude)
  if not r.requeued_once and exists (select 1 from public.obs_archive_summaries s
        join jsonb_array_elements(r.claimed_files) f on s.id = (substr(f->>'arquivo_id', 3, 36))::uuid where s.purged_at > r.claimed_at) then
    update public.obs_archive_requests set status = 'pending', requeued_once = true, attempts = 0, claim_token = null, claimed_at = null, deadline_at = null,
           lease_until = null, claimed_files = null, plan = null, progress_done = 0, progress_total = 0, expires_at = v_agora + interval '15 minutes' where id = r.id;
    return jsonb_build_object('estado', 'devolvido');
  end if;
  return public.obs_archive_request_conclude(r, p_lidos, p_falhas, p_online);
end $$;
revoke all on function public.obs_archive_request_finish(uuid, uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_request_finish(uuid, uuid, uuid, jsonb, jsonb, jsonb) to service_role;

-- D20: o pedido que não precisa da casa. Sem token: só aceita online_only e pending, e o fecha pelo mesmo conclude.
create or replace function public.obs_archive_request_finish_online(p_site uuid, p_request uuid, p_online jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.obs_archive_requests;
begin
  select * into r from public.obs_archive_requests q where q.id = p_request and q.site_id = p_site for update;
  if not found or not r.online_only or r.status <> 'pending' or (public.obs_archive_request_state(r)->>'status') <> 'pending' then
    raise exception 'pedido_vencido' using errcode = 'P0001';
  end if;
  return public.obs_archive_request_conclude(r, '[]'::jsonb, '[]'::jsonb, p_online);
end $$;
revoke all on function public.obs_archive_request_finish_online(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_request_finish_online(uuid, uuid, jsonb) to service_role;

create or replace function public.obs_archive_request_fail_online(p_site uuid, p_request uuid, p_detail text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  update public.obs_archive_requests set status = 'failed', fail_reason = 'inesperado', fail_detail = left(p_detail, 200), finished_at = public.obs_archive_agora()
   where id = p_request and site_id = p_site and online_only and status = 'pending' returning id into v_id;
  return jsonb_build_object('estado', case when v_id is null then 'ja_terminado' else 'failed' end);
end $$;
revoke all on function public.obs_archive_request_fail_online(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_request_fail_online(uuid, uuid, text) to service_role;
```

- [ ] **Passo 5.** Testes passam (`HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m7-resultado.test.ts --no-file-parallelism > /tmp/m7-t6.txt 2>&1`).
- [ ] **Passo 6.** Rodar também os testes da selagem da M3b (`npx vitest run test/integration/ -t "selagem|summary" --no-file-parallelism`): continuam passando com a M7 aplicada (a M7 não recria nada da M3b).
- [ ] **Passo 7. Medidas locais (D13).** No `bythiago_int` com a M2 aplicada: (a) 75 canais × 31 dias × 50 vídeos no mês corrente: `\timing` de `obs_archive_request_online` para o pedido `null` e para um canal; acima de 3 s para 75 canais, a rota passa a chamar por blocos de 25 canais (parâmetros `p_offset`, `p_limit`); (b) **`\timing` de `obs_archive_request_finish` com 1.747 arquivos** (alvo < 10 s; `maxDuration = 60` das rotas `result` e `claim` não foi medido). Acima disso, a conferência do `conclude` passa a um só `select` com `jsonb_to_recordset` × `obs_archive_summaries` × `obs_archive_units`; (c) `statement_timeout` efetivo do `service_role` (`select rolconfig from pg_roles where rolname = 'service_role'`, leitura do dono em produção). Anotar os três no ledger.
- [ ] **Passo 8. Commit** `feat: M7: online parcial pela função da selagem, conferência em par e resultado sem mês que some (teto 512 kB, total 8 MB sob trava)`.

---

### Tarefa 7: SQL parte 5, remoção com apagar, vigia 5, poda, lista fechada

**Files:**
- Modify: `supabase/rascunhos/m7.sql`
- Create: `apps/web/test/integration/manutencao-m7-remocao-poda.test.ts`
- Modify: `apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts`

**Interfaces:**
- Produces: gatilho `obs_archive_z_resultados_apagar` em `obs_archive_channel_removals` (função `obs_archive_results_on_apagar()`, interna); `obs_archive_vigia_resultados() returns integer` (`grant ... to service_role`); `obs_archive_requests_purge(p_agora timestamptz default null) returns integer` (casa a regex `^obs_` da lista fechada) e `cron_purge_obs_archive_requests() returns void` (casca que grava `cron_runs`), agendada `purge-obs-archive-requests` em `'30 6 * * *'` (UTC, fora de 11:30–13:00 e dos minutos 0/20/40; não colide com `'10 6'` e `'50 6'` da M1).

**O que acontece quando o dado não existe:** canal removido sem pedido nem resultado → o gatilho não faz nada; poda sem linha → grava `cron_runs` com zero (o vigia lê "rodou, zero"), nunca deixa de gravar; extensão `pg_cron` ausente (banco local sem ela) → o bloco `do $guard$` pula o agendamento, a função existe; pedido terminado há mais de 7 dias **com** resultado ainda válido → **fica** (a tela promete o resultado por 30 dias).

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `apagar cancela o pedido e apaga o resultado na mesma transação` | resultado com `channel_refs = '{A}'` e pedido pendente com `'{A}'`; `obs_archive_channel_removal_decide(..., 'apagar')` (função da M3b): `count(results)` = 0 e o pedido `cancelled`/`canal_apagado` |
| `pedido e resultado de todos os canais também` | pedido `null` (resolvidos = todos os canais): decisão `apagar` de um canal → cancelado e o resultado apagado |
| `guardar não apaga` | decisão `guardar` → nada muda |
| `outro canal não leva o resultado (Phil C2)` | resultado de `'{A}'`; `apagar` de B → o resultado de A fica |
| `corrida entre apagar e finish (Yannis I-4, Phil I9)` | `M7_CORRIDAS=1`: conexão A abre `finish` (segura depois do `for update`); conexão B decide `apagar`; A commita; B commita; `obs_archive_vigia_resultados() = 0` (a ordem update → delete vê o commit do `finish`) |
| `vigia 5 acha o resultado plantado (item 162)` | como dono: `alter table ... disable trigger obs_archive_z_resultados_apagar`, decisão `apagar`, resultado do canal plantado, `enable trigger`; `obs_archive_vigia_resultados()` = 1 |
| `poda: pedido de mais de 7 dias sem resultado e resultado vencido` | relógio +8 d: pedido `failed`/`cancelled`/`expired` sai; pedido `running` vencido é normalizado e só sai se `finished_at` < 7 d; resultado com `valid_until` passado sai; o de 29 dias fica; `cron_runs` ganha a linha `pg_cron:purge-obs-archive-requests` |
| `I-5: pedido com resultado válido não é podado` | pedido `done` com resultado válido, relógio +8 d: o pedido **fica** e `obs_archive_request_read` traz `resultado` (estado `pronto`); relógio +31 d: os dois saem |
| `item 57: poda na lista fechada` | o teste da lista fechada (abaixo) passa com os pares novos e falha se um `delete from` novo aparecer sem par |

- [ ] **Passo 2. SQL.**

```sql
-- D11 / Yannis I-4 / Phil I9: PRIMEIRO cancela os pedidos (espera o bloqueio do finish concorrente), DEPOIS apaga os resultados
-- (instrução nova, foto nova: vê o resultado que o finish acabou de commitar). A ordem inversa deixava o resultado do canal apagado vivo.
create or replace function public.obs_archive_results_on_apagar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_agora timestamptz := public.obs_archive_agora();
begin
  if new.archive_decision is distinct from 'apagar' then return null; end if;
  update public.obs_archive_requests q set status = 'cancelled', cancelled_reason = 'canal_apagado', cancelled_at = v_agora, finished_at = v_agora
   where q.site_id = new.site_id and q.status in ('pending', 'running')
     and (q.channel_refs is null or new.channel_ref = any (q.channel_refs) or new.channel_ref = any (q.resolved_channel_refs));
  delete from public.obs_archive_results r
   where r.site_id = new.site_id and new.channel_ref = any (r.channel_refs);
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
                  where x.site_id = r.site_id and x.archive_decision = 'apagar' and x.channel_ref = any (r.channel_refs))
$$;
revoke all on function public.obs_archive_vigia_resultados() from public, anon, authenticated;
grant execute on function public.obs_archive_vigia_resultados() to service_role;

-- Poda diária (item 57). O nome começa com obs_: a regex da lista fechada (^(competitor_|yt_|youtube_channel_|obs_)) não pega cron_*.
-- O resultado sai no valid_until; o pedido só sai quando terminou há mais de 7 dias E já não tem resultado (I-5).
create or replace function public.obs_archive_requests_purge(p_agora timestamptz default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_agora timestamptz := coalesce(p_agora, public.obs_archive_agora()); v_n integer := 0; v_m integer;
begin
  delete from public.obs_archive_results r where r.valid_until < v_agora;
  get diagnostics v_m = row_count; v_n := v_n + v_m;
  update public.obs_archive_requests q set status = s.st->>'status', fail_reason = s.st->>'motivo', finished_at = coalesce(q.finished_at, v_agora)
    from (select x.id, public.obs_archive_request_state(x) as st from public.obs_archive_requests x where x.status in ('pending', 'running')) s
   where q.id = s.id and (s.st->>'status') in ('expired', 'failed');          -- só normaliza o que a leitura já mostra
  delete from public.obs_archive_requests q
   where q.status not in ('pending', 'running') and coalesce(q.finished_at, q.cancelled_at, q.requested_at) < v_agora - interval '7 days'
     and not exists (select 1 from public.obs_archive_results r where r.request_id = q.id);
  get diagnostics v_m = row_count; v_n := v_n + v_m;
  return v_n;
end $$;
revoke all on function public.obs_archive_requests_purge(timestamptz) from public, anon, authenticated;
grant execute on function public.obs_archive_requests_purge(timestamptz) to service_role;

create or replace function public.cron_purge_obs_archive_requests() returns void
language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_ini timestamptz := clock_timestamp();
begin
  select public.obs_archive_requests_purge() into v_n;
  insert into public.cron_runs (job, ran_at, status, duration_ms, items_processed)
  values ('pg_cron:purge-obs-archive-requests', now(), 'ok', (extract(epoch from clock_timestamp() - v_ini) * 1000)::int, v_n);
  raise log '[pg_cron] purge-obs-archive-requests: % rows', v_n;
end $$;
revoke all on function public.cron_purge_obs_archive_requests() from public, anon, authenticated;
grant execute on function public.cron_purge_obs_archive_requests() to service_role;

do $guard$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: poda da M7 não agendada (esperado fora de produção)';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'purge-obs-archive-requests') then perform cron.unschedule('purge-obs-archive-requests'); end if;
  perform cron.schedule('purge-obs-archive-requests', '30 6 * * *', $$select public.cron_purge_obs_archive_requests()$$);
end
$guard$;
```

  O molde é `20261014000001_manutencao_m1_podas_execucao.sql:136-165` (colunas de `cron_runs`: `job, ran_at, status, duration_ms, items_processed`; já conferidas).
- [ ] **Passo 3. Lista fechada.** Em `observatorio-a5-e10-lista-fechada.test.ts`, depois do bloco da M1 (entradas de `LISTA`, linha ~37), e na lista `chamadas` (linha ~132-135):

```ts
  // fase de manutenção, M7 (02 §10.6): a fila e o resultado do período longo. Disparo: cron (poda), dono (remoção com apagar), coleta (a forja grava o resultado).
  { funcao: 'obs_archive_requests_purge', tabela: 'obs_archive_requests', linha: 'manutenção M7: pedido com mais de 7 dias e sem resultado (item 57)', disparo: 'cron' },
  { funcao: 'obs_archive_requests_purge', tabela: 'obs_archive_results', linha: 'manutenção M7: resultado vencido, 30 dias (item 57)', disparo: 'cron' },
  { funcao: 'obs_archive_request_conclude', tabela: 'obs_archive_results', linha: 'manutenção M7: expulsa o mais antigo acima de 8 MB (item 54)', disparo: 'coleta' },
  { funcao: 'obs_archive_results_on_apagar', tabela: 'obs_archive_results', linha: 'manutenção M7: canal removido com apagar (02 §10.6)', disparo: 'dono' },
```

  e, no array `chamadas` do teste "24 meses" (exigido para toda função com `disparo: 'cron'`, linhas 138-139 do teste):

```ts
        { funcao: 'obs_archive_requests_purge', sql: `select public.obs_archive_requests_purge(now() + interval '24 months')` },
```

  Fatos conferidos: a regex do teste (`observatorio-a5-e10-lista-fechada.test.ts:69`) pega `obs_*` e **não** `cron_*`; a casca `cron_purge_obs_archive_requests` só chama a função com o `delete`. Sem a entrada de 24 meses o teste da linha 139 falha. O disparo `'coleta'` é o mais próximo do tipo (`'cron' | 'dono' | 'coleta' | 'agenda'`, linha 25) para "a forja grava o resultado"; se Phil pedir `'forja'`, o tipo `Par` ganha o valor.
- [ ] **Passo 4.** A parte estática (`lista-fechada-do-que-apaga.test.ts`) não muda: nenhum `.delete()` de cliente é criado no TypeScript desta etapa (as rotas só chamam RPC). Rodar para confirmar.
- [ ] **Passo 5. Commit** `feat: M7: remoção com apagar leva pedido e resultado (nessa ordem), vigia 5, poda diária na lista fechada`.

---

### Tarefa 8: as quatro rotas (depois da TRAVA M7-2)

**Files:**
- Create: `apps/web/src/app/api/pipeline/archive/request/claim/route.ts`, `.../progress/route.ts`, `.../result/route.ts`, `.../fail/route.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco.ts` (exporta `montarOnline`, usada também pela server action da Tarefa 9)
- Create: `apps/web/test/app/api/pipeline/archive-request.test.ts`
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (4 entradas; `endpoint_count` do domínio `archive` + 4), `apps/web/data/pipeline-docs/cowork-docs-archive.md`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/test/lib/pipeline/mcp-registry-sync.test.ts` (contagem)

**Interfaces:**
- Consumes: `authenticateArchive`, `erroDoRpc` (M3b), `CorpoClaim` (com `prova`), `RespostaClaim` (`.strict()`, com `restante_s` e `prova`), `CorpoProgresso`, `CorpoResultado`, `CorpoFalha`, `RespostaFinish`, `TETO_CORPO_RESULTADO_BYTES` (Tarefa 1).
- Produces: `montarOnline(rpc, site, pedido, token): Promise<{ok: true, linhas: unknown[]} | {ok: false, erro: unknown}>`: chama `obs_archive_request_check` PRIMEIRO (M-12), e só se o pedido está vivo chama `obs_archive_request_online` mês a mês (D13). `token = null` é o pedido só online.

**O que acontece quando o dado não existe:** `OBS_ARQUIVO` apagada -> `503 arquivo_desligado` nas quatro (teste que apaga a variável); RPC que devolve dado fora do esquema -> `500 erro_do_banco` + Sentry; claim com `prova: true` -> nunca toma pedido (`{pedido: null, prova: {ha_pedido}}`); o claim nunca devolve pedido só online (o claim do banco já o ignora, D20), logo a rota não tem ramo `so_online`.

- [ ] **Passo 1.** `git diff --stat --` dos quatro Modify vazio; senão a regra do Global Constraints. Conferir a TRAVA M7-2 no ledger. Conferir o campo do site em `PipelineAuth` (`siteId`) em `apps/web/src/lib/pipeline/auth.ts`.
- [ ] **Passo 2. Testes, falhando** (cliente de serviço falso com `rpc` programável, molde do `pipeline-archive.test.ts` da M3b):

| Teste | Afirma |
|---|---|
| `chave sem archive_read` | `403` nas quatro; `archive_copy` também `403` |
| `OBS_ARQUIVO apagada` | `delete process.env.OBS_ARQUIVO` -> `503 arquivo_desligado` nas quatro |
| `claim sem pedido` | `200 {data: {pedido: null}}`, `cache-control: no-store` |
| `claim repassa prova` | corpo `{prova: true}` -> a RPC recebe `p_prova: true`; sem o campo, `false` (teste que apaga o campo) |
| `claim traz restante_s` | a resposta passa pelo `.strict()` com `restante_s`; campo a mais -> `500 erro_do_banco` |
| `claim fora do esquema` | `total` diferente do tamanho da lista -> `500 erro_do_banco`, Sentry chamado |
| `result: corpo acima de 4 MB` | `413 grande_demais` antes do `parseBody` (lê `content-length`; sem cabeçalho, conta os bytes lidos) |
| `result: check antes de online (M-12)` | pedido cancelado: a RPC `check` levanta `pedido_cancelado`, a rota responde `409` e `obs_archive_request_online` **não** foi chamada |
| `result: ordem` | `check`, depois `online` por mês de `meses_online`, depois `finish` com `p_online` |
| `result: replay` | `check` devolve `replay: true` -> a rota chama `finish` com `p_online = []` (nenhum `online` chamado) |
| `result: códigos do banco` | `pedido_cancelado` -> `409`; `pedido_de_outro` -> `409`; `pedido_vencido` -> `410`; `resposta_fora_da_lista` -> `422`; **`canal_removido` -> `422`** (M-9); `invariante_do_resultado` (XX000) -> `500 erro_do_banco` + Sentry |
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
import { CorpoResultado, TETO_CORPO_RESULTADO_BYTES, RespostaFinish } from '@/lib/youtube/observatorio/arquivo-mensal/pedido'
import { montarOnline } from '@/lib/youtube/observatorio/arquivo-mensal/pedido-do-banco'

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
    const online = await montarOnline(db, a.auth.siteId, corpo.pedido_id, corpo.token)   // check ANTES de qualquer cálculo (M-12)
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

  `montarOnline` (em `pedido-do-banco.ts`):

```ts
import { z } from 'zod'
const Check = z.object({ replay: z.boolean(), meses_online: z.array(z.string().regex(/^\d{4}-\d{2}$/)) }).strict()
const LinhaOnline = z.object({ canal: z.string(), mes: z.string(), linha: z.array(z.string().nullable()).length(14) }).strict()
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }
export async function montarOnline(db: Rpc, site: string, pedido: string, token: string | null):
    Promise<{ ok: true; linhas: unknown[] } | { ok: false; erro: unknown }> {
  const c = await db.rpc('obs_archive_request_check', { p_site: site, p_request: pedido, p_token: token })
  if (c.error) return { ok: false, erro: c.error }
  const chk = Check.parse(c.data)
  if (chk.replay) return { ok: true, linhas: [] }
  const linhas: unknown[] = []
  for (const mes of chk.meses_online) {                    // um mês por chamada (D13)
    const o = await db.rpc('obs_archive_request_online', { p_site: site, p_request: pedido, p_month: `${mes}-01` })
    if (o.error) return { ok: false, erro: o.error }
    linhas.push(...z.array(LinhaOnline).parse(o.data))
  }
  return { ok: true, linhas }
}
```

  `erroDoRpc` (M3b) ganha, em `exportar-do-banco.ts`, o mapeamento dos códigos novos (o teste de M-9 vigia): `pedido_cancelado`/`pedido_de_outro` -> 409, `pedido_vencido` -> 410, `resposta_fora_da_lista`/`canal_removido`/`grande_demais`/`medida_fora_da_lista`/`escolha_invalida` -> 422, `invariante_do_resultado` e o resto -> 500. Conferir antes com `grep -n "pedido_\|erroDoRpc" apps/web/src/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco.ts`; se a M3b já tem a tabela, só acrescentar as linhas que faltam.
- [ ] **Passo 4. Integridade do pipeline:** 4 entradas no `api-registry.ts` (domínio do arquivo da M3b; `endpoint_count` + 4), seção "Pedido de período longo (respondedor)" em `cowork-docs-archive.md` com os quatro corpos do contrato R1 a R4 (r1.1), `leitura-rotas.ts` (as quatro são escrita: conferir como a M3b classificou `heartbeat`), e a contagem em `mcp-registry-sync.test.ts`.
- [ ] **Passo 5.** `npx vitest run test/app/api/pipeline/archive-request.test.ts test/lib/pipeline > /tmp/m7-t8.txt 2>&1`, só falhas no contexto; `npm run typecheck -w apps/web`.
- [ ] **Passo 6. Commit** `feat: M7: rotas request/claim, progress, result e fail do respondedor (archive_read; check antes do online)`.

---

### Tarefa 9: server actions do CMS (depois da TRAVA M7-2)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/ver-antigo-actions.ts`
- Create: `apps/web/test/cms/ver-antigo-actions.test.ts`

**Interfaces:**
- Produces: `lerVerAntigo(canalId: string): Promise<LeituraDoPedido | null>`; `lerStatusVerAntigo(canalId: string, pedidoId: string): Promise<StatusLeve | null>` (polling leve: um `select` por id, sem refazer a prévia); `pedirVerAntigo(canalId: string, escolha: EscolhaDeMeses): Promise<{ status: 'criado' | 'repetido' | 'nada_a_pedir' | 'grande_demais' | 'canal_removido' | 'desligado' | 'erro' }>`; `cancelarVerAntigo(canalId: string, pedidoId: string): Promise<{ status: 'cancelado' | 'ja_terminado' | 'erro' }>`. São passadas ao client component por props (CLAUDE.md: não importar server action em client component).

**O que acontece quando o dado não existe:** usuário sem `canEditSite` -> `lerVerAntigo` chama o banco com `p_incluir_pedido = false` (o dado nem sai do banco, M-8) e a tela mostra só a tira de leitura (D17); `pedir`/`cancelar` -> `erro` sem chamar o banco; RPC com erro ou fora do esquema -> `null` (`nao_medido`) e Sentry; `OBS_ARQUIVO` diferente de `on` -> `pedir` devolve `desligado` sem criar nada; `P0001 canal_removido` -> `canal_removido`.

- [ ] **Passo 1. Testes, falhando:** quem só lê não cria (o RPC não é chamado) e a leitura vai com `p_incluir_pedido: false`; `OBS_ARQUIVO` apagada -> `desligado`; `P0001 grande_demais` -> `grande_demais`; `canal_removido` -> `canal_removido`; leitura fora do esquema -> `null` + Sentry; o `p_channels` enviado é `[canalId]` e o `p_measures` é `MEDIDAS_V1`; `canalId` não uuid -> `erro` sem banco; **`canViewSite` é chamado antes de `getSupabaseServiceClient()` na leitura** (M-8; ordem das chamadas); **pedido só online:** a RPC `create` devolve `so_online: true` -> a ação chama `montarOnline(db, site, id, null)`, depois `obs_archive_request_finish_online`; se `montarOnline` ou o `finish_online` falham, chama `obs_archive_request_fail_online` e devolve `erro`; `lerStatusVerAntigo` de pedido de outro site -> `null`.
- [ ] **Passo 2. Implementar** (`'use server'`; `getSiteContext()` para o site; `canViewSite(siteId)` na leitura e `canEditSite(siteId)` na criação/cancelamento, os dois **antes** de `getSupabaseServiceClient()` (regra do CLAUDE.md); `requested_by` = usuário da sessão). Molde: as ações de `competitors/actions.ts`. `pedirVerAntigo`, quando `so_online`, **fecha o pedido ali mesmo** (D20), sem esperar a forja.
- [ ] **Passo 3.** Testes passam; typecheck.
- [ ] **Passo 4. Commit** `feat: M7: ações do CMS para ler, pedir e cancelar o período longo (só quem edita; só online fecha sem a forja)`.

---

### Tarefa 10: o painel "Ver antigo" na página do canal (depois da TRAVA M7-2 e da TRAVA M7-2b)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canal/ver-antigo.tsx` (`'use client'`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canal/canal-screen.tsx` (recebe `verAntigo?: { leitura, acoes, podeEditar, nomeDoCanal }` em props e o põe **entre `<CanalHeader` (linha 508) e `<AbasNav` (linha 510)**: a tela real não tem o gráfico "Views por dia"; conferir as linhas de novo antes de editar)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/canal/[id]/page.tsx` (lê `lerVerAntigo` no servidor e passa as ações; a página importa a tela de `../../_canal/canal-screen`, linha 9, e a renderiza na linha 92)
- Modify: o CSS do CMS onde vivem os estilos do Observatório (conferir com `grep -rn "m-va\b\|\.m-bar" apps/web/src/app/cms` se a M5 já trouxe o bloco do `m19.css`; se não, trazer **só** o bloco da peça 6 do `m19.css`, com os tokens do CMS)
- Create: `apps/web/test/cms/ver-antigo.test.tsx` (`// @vitest-environment jsdom`)

**O que acontece quando o dado não existe:** `leitura` nula -> painel `nao_medido`; sem mês no arquivo -> a tira com a frase de `semArquivo` e sem botão (D17); quem só lê -> só "mmm/aaaa a mmm/aaaa no arquivo." sem botão; ação que falha durante o polling -> o painel mantém o último estado e, depois de 3 falhas seguidas, mostra `nao_medido` (nunca volta a "antes de pedir").

- [ ] **Passo 1. TRAVA M7-2b: os textos novos do Logan voltam ao dono antes do código.** Abrir o ledger: a linha "L1 a L7 aprovados pelo dono" tem de existir (a tabela L1-L7 está no topo deste plano). Sem ela, **parar** e devolver ao controlador; o código só segue o mockup depois que o dono aprova os textos, e cada resposta muda só texto em `pedido-tela.ts`. Conferir também: a posição da tira (entre cabeçalho e abas) está na lista.
- [ ] **Passo 2. Testes, falhando (item 105):** um teste por quadro do mockup, cada um com a frase do `pedido-tela.ts` e a forma do aviso: `a-pedir` (frase de 12 meses; trocar para "Tudo" desliga "Pedir" com `aria-describedby`), `a-nada`, `a-desl`, `a-grande`, `e-env` (botão "Cancelar pedido"), `e-and` (barra com `aria-valuenow` e "Lendo: 9 de 12 meses"), `e-reab` (reaberto), `e-rep`, `p-ok` (12 linhas; com 24, "E mais 12 meses mais antigos"), venceu, `x-inc` (meses faltando sem número), `x-bate` (`role="alert"`), não respondeu (triângulo com sinal de 10 h, octógono com 40 h), `x-nas`, cancelado com a frase própria, `x-nm`, resultado anterior (quando o último pedido não terminou e há resultado válido). Mais: o polling (via `lerStatusVerAntigo`, leve) para no estado final e com `document.visibilityState = 'hidden'` (fake timers); nenhum texto "sem dados" em nenhum estado (`expect(container.textContent).not.toMatch(/sem dados/i)`); **regex de L2:** nenhum texto casa `/do banco(?!, ainda sem cópia)/` e nenhum casa `/\b0 de \d+ dias medidos/` (Logan 5); o foco vai ao painel quando ele abre.
- [ ] **Passo 3. Componente.** Estrutura e classes do `peca6.js` (`m-va`, `m-va-h`, `m-segs`, `m-va-lead`, `m-va-acoes`, `m-va-prog`, `m-va-meses`, `m-vam`); `role="status"` no lead dos estados de espera e `role="alert"` em `bate`, `naoResp`, `nasFora`; o foco vai ao painel (`tabIndex={-1}`) quando ele abre. Ações por props; `useTransition` nos cliques; polling com `setInterval` de 10 s só em `enviado`/`andamento`, limpo no `useEffect` de desmontagem e em `visibilitychange`. O ⓘ do método diz "variação de views no mês" (`var_views`) e "não medido" onde faltar.
- [ ] **Passo 4.** Testes passam; typecheck; `next build` não é obrigatório (CLAUDE.md), mas a tela passa pelo **Gio** (navegador) contra o roteiro §19e antes de ir ao dono, e por Logan e Naksu (regra do dono).
- [ ] **Passo 5. Commit** `feat: M7: painel Ver antigo na página do canal (peça 6, textos L1-L7 aprovados)`.

---

### Tarefa 11: o respondedor (kit da forja)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py`
- Create: `~/Workspace/forja/ferramentas/arquivo/teste_respondedor.py`
- Modify: `~/Workspace/forja/ferramentas/arquivo/comum.py` (`CHAVE_DO_PROGRAMA['respondedor']`; `config` do respondedor; **`ler_resumo`, `COLUNAS_CANAL` e `sentinela_viva` moram aqui** para a medida da Tarefa 13 importar a mesma função sem importar o respondedor, Yannis I-11)
- Modify: `~/Workspace/forja/ferramentas/arquivo/falsos.py` (`SiteArquivoFalso` atende `request/claim|progress|result|fail` com o Zod espelhado)
- Modify: `~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh` (lista ganha `teste_respondedor.py`)

**Interfaces:**
- Produces: `responder.py` com `main(argv, env, eh_montagem, dormir, relogio)`, `uma_volta(cf, site, eh_montagem) -> str` (desfecho: `nada`, `ok`, `incompleto`, `nas_fora`, `grande_demais`, `inesperado`, `desligado`, `site_fora`, `chave`, `cancelado`, `vencido`), `atender(cf, site, pedido, eh_montagem, relogio) -> dict`; `log/respondedor.jsonl` (uma linha por pedido atendido e uma por mudança de desfecho, nunca uma a cada volta); `estado/respondedor-vivo.json` (`{"em": ISO, "desfecho": ...}`, trocado por `trocar_atomico`).
- `comum.py`: `ler_resumo(caminho) -> (linhas, sha256, bytes)`; `sentinela_viva(raiz_numerico) -> bool` (`os.path.ismount(leitura)` e `os.path.isfile(raiz/.arquivo-vivo)`; **sem `statvfs`**, que no NFS caído trava); `COLUNAS_CANAL` (a lista dos 14 nomes do cabeçalho, copiada de `c.caminho_resumo`/do contrato C0 da M3b, conferida por `grep -n "COLUNAS" ~/Workspace/forja/ferramentas/arquivo/comum.py`).

**O que acontece quando o dado não existe:** chave ausente ou com permissão aberta -> desfecho `chave`, dorme e tenta de novo (o programa não sai); montagem de leitura ausente ou sem `.arquivo-vivo` antes do primeiro arquivo -> `fail nas_fora` (item 102), nunca `ausente`; a sentinela some no meio (conferida a cada 50 arquivos **e** logo depois de qualquer `OSError`) -> o arquivo corrente e os seguintes vão em `falhas` com `nas_fora`, o já lido em `lidos` (D3); arquivo listado que não existe -> `ausente`; EIO -> `nas_fora` daquele arquivo, nunca `ausente`; `503 arquivo_desligado` -> dorme `ARQ_RESP_PAUSA_DESLIGADO_S`; total diferente da lista -> `fail inesperado`; **cabeçalho do CSV diferente de `COLUNAS_CANAL` -> `ilegivel`** (Phil I7c: coluna trocada de lugar com 14 colunas não passa).

- [ ] **Passo 1. Testes, falhando** (`teste_respondedor.py`, molde de `teste_copiador.py` com `exige()`; pasta temporária com `numerico/.arquivo-vivo` e `eh_montagem` falso que diz montado):

| Teste | Afirma |
|---|---|
| `item 102: sem montagem ou sem sentinela é nas_fora` | `eh_montagem` falso -> o falso recebeu `fail` com `nas_fora`; nenhum `result` |
| `item 104: só abre o que o claim mandou, só .canal` | o falso lista 3 arquivos; há 10 na pasta: `open` interceptado registra exatamente os 3; caminho com `video` ou `..` na lista -> `fail inesperado` (o caminho é refeito por `caminho_resumo` e comparado) |
| `item 162: não lista pasta nem lê manifesto` | `os.listdir`, `os.scandir` e `glob` substituídos por funções que falham o teste se chamadas |
| `item 162: lista com 1.001 arquivos chega inteira e cada um é respondido uma vez` | 1.001 arquivos sintéticos: `len(lidos) + len(falhas) == 1001`, sem repetição |
| `sha256 diferente é divergente; arquivo ausente é ausente` | um arquivo com um byte trocado, um apagado |
| `CSV ilegível é ilegivel` | gzip cortado; cabeçalho com colunas permutadas (14 colunas, ordem trocada) |
| `sentinela some no meio` | `eh_montagem` vira falso depois do 2º arquivo: 2 em `lidos`, o resto `nas_fora` (conferência por `OSError` injetado no 3º) |
| `sentinela conferida a cada 50, não a cada arquivo` | 120 arquivos: `eh_montagem` chamado no máximo 4 vezes |
| `item 52: contador antes, e o processo que morre não repete além de 2` | o falso conta claims do mesmo pedido; exceção injetada no 1º atendimento; na volta seguinte o falso entrega `tentativa: 2`; a terceira recebe `{pedido: null}` |
| `cancelado no meio para` | `progress` responde `409 pedido_cancelado` -> para sem `result`, desfecho `cancelado` |
| `orçamento pelo que resta (Yannis I-10)` | `restante_s = 200`: o orçamento é `min(ARQ_RESP_ORCAMENTO_S, 200 - 60) = 140`; `relogio` falso passa de 140 s -> `fail grande_demais` antes de 200 s; com `restante_s <= 60`, `fail grande_demais` sem ler arquivo nenhum |
| `total diferente da lista` | `fail inesperado` |
| `claim é o batimento; heartbeat só a cada 10 min` | 10 voltas ociosas de 60 s (relógio falso): 10 claims, 1 batimento da rota `heartbeat` (que só mede disco); nenhum batimento extra por volta |
| `ritmo: ocioso 60 s, com pedido 15 s` | o `dormir` recebe `ARQ_RESP_INTERVALO_OCIOSO_S` (60) depois de volta `nada`; `ARQ_RESP_INTERVALO_S` (15) por 5 min depois de uma volta que atendeu pedido; `ARQ_RESP_PAUSA_DESLIGADO_S` com `desligado` |
| `--prova` | um claim com `prova: true`, imprime `pedido: null` ou `ha_pedido`, não atende, não escreve log nem estado; sai com código 3 se a resposta não for `200` |
| `variáveis com padrão (cada uma apagada)` | sem `ARQ_RESP_INTERVALO_S` -> 15; sem `ARQ_RESP_INTERVALO_OCIOSO_S` -> 60; sem `ARQ_RESP_BATIMENTO_S` -> 600; sem `ARQ_RESP_ORCAMENTO_S` -> 780; sem `ARQ_RESP_PAUSA_DESLIGADO_S` -> 300; sem `ARQ_MONTAGEM_LEITURA` -> `/mnt/arquivo/leitura`; valor ilegível em cada uma -> `erro_config` e desfecho `bug` |
| `nenhuma escrita no NAS` | `open` em modo de escrita sob a raiz de leitura falha o teste |
| `linhas devolvidas: só as 14 colunas, em texto` | listas de 14 células; arquivo com 15 colunas -> `ilegivel` |
| `corpo do result acima de 4 MB` | `fail grande_demais` sem enviar o `result` |

- [ ] **Passo 2. `comum.py`:** `CHAVE_DO_PROGRAMA = {"copiador": "copiador", "conferir-b2": "conferidor", "respondedor": "respondedor"}`; em `config`, para `programa == "respondedor"`: `leitura`, `intervalo_s` (15), `intervalo_ocioso_s` (60), `batimento_s` (600), `orcamento_s` (780), `pausa_desligado_s` (300), todos com o mesmo tratamento de valor ilegível (`erro_config`). Mover para cá `ler_resumo` e `sentinela_viva`:

```python
def sentinela_viva(raiz_numerico):
    """A montagem de leitura está de pé? ismount + isfile; nunca statvfs (trava em NFS caído)."""
    return os.path.ismount(os.path.dirname(raiz_numerico.rstrip("/"))) and os.path.isfile(os.path.join(raiz_numerico, ".arquivo-vivo"))

def ler_resumo(caminho):
    """(linhas, sha256, bytes) ou levanta OSError (E/S) / ValueError (ilegível). Uma leitura só, sem cache do NFS."""
    with open(caminho, "rb", buffering=0) as f:
        descartar_cache(f.fileno())
        bruto = f.read()
    sha = hashlib.sha256(bruto).hexdigest()
    try:
        texto = gzip.decompress(bruto).decode("utf-8")
    except (OSError, EOFError, UnicodeDecodeError) as e:
        raise ValueError("gzip") from e
    linhas = list(csv.reader(io.StringIO(texto)))
    if not linhas or linhas[0] != COLUNAS_CANAL:        # Phil I7c: o cabeçalho tem de ser EXATAMENTE o do contrato, não só 14 colunas
        raise ValueError("cabeçalho")
    corpo = linhas[1:]
    if any(len(l) != len(COLUNAS_CANAL) for l in corpo):
        raise ValueError("colunas")
    return [[x if x != "" else None for x in l] for l in corpo], sha, len(bruto)
```

  `teste_comum.py` ganha os casos (`config('respondedor')` sem variável nenhuma; `ler_resumo` com cabeçalho permutado). Conferir `descartar_cache` e os `import` no topo de `comum.py` (`csv, gzip, hashlib, io`).
- [ ] **Passo 3. `responder.py`** (núcleo):

```python
"""M7 (forja): o respondedor do relatório de período longo (spec 02 §10.6; contrato R0 a R5 em contrato-rotas-m7.md).

Serviço contínuo (systemd: arquivo-responder.service). O claim é também o batimento (Phil I1): pergunta a cada
ARQ_RESP_INTERVALO_OCIOSO_S (60 s) quando ninguém pediu e a cada ARQ_RESP_INTERVALO_S (15 s) por 5 min depois de um pedido.
Com um pedido, lê SÓ os arquivos .canal que o claim listou, pela montagem de LEITURA (ro), confere o sha256 contra a lista
e devolve as linhas; quem conclui é o site. Nunca lista pasta, nunca lê manifesto, nunca grava no NAS.
Pasta não montada ou sem a sentinela: nas_fora (nunca 'ausente'). O contador de tentativas sobe no site antes."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import comum as c  # noqa: E402
from cliente_site import ArquivoDesligado, ChaveRecusada, Recusa, Site, SiteFora  # noqa: E402

PROGRAMA = "respondedor"
LOTE_PROGRESSO, PROGRESSO_S, CONFERE_A_CADA = 50, 30, 50
MARGEM_S = 60                          # sobra para o site conferir e gravar o result (a rota result tem maxDuration 60)


class Cancelado(Exception):
    pass


def _fail(site, p, motivo, detalhe=None):
    corpo = {"pedido_id": p["id"], "token": p["token"], "motivo": motivo}
    if detalhe:
        corpo["detalhe"] = detalhe
    site.dados("POST", "request/fail", corpo)


def atender(cf, site, p, eh_montagem, relogio=time.monotonic):
    if p["total"] != len(p["arquivos"]):
        _fail(site, p, "inesperado", "total")
        return {"desfecho": "inesperado"}
    raiz = os.path.join(cf["leitura"], "numerico")
    if not c.estado_filho(cf["leitura"], "numerico", eh_montagem)["sentinela"]:
        _fail(site, p, "nas_fora")
        return {"desfecho": "nas_fora"}
    # Yannis I-10: o orçamento é o MENOR entre o configurado e o que resta do prazo do pedido (2ª tentativa chega com o prazo gasto)
    orcamento = min(cf["orcamento_s"], p["restante_s"] - MARGEM_S)
    if orcamento <= 0:
        _fail(site, p, "grande_demais", "prazo")
        return {"desfecho": "grande_demais", "lidos": 0}
    t0, ult, lidos, falhas, nas_caiu = relogio(), relogio(), [], [], False
    for i, a in enumerate(p["arquivos"]):
        if relogio() - t0 > orcamento:
            _fail(site, p, "grande_demais", "orçamento")
            return {"desfecho": "grande_demais", "lidos": i}
        _, rel = c.caminho_resumo(a["classe"], a["canal"], a["mes"], a["versao"], "canal")
        if rel != a["caminho"]:                                   # caminho refeito pelo contrato, nunca usado cru (item 104)
            _fail(site, p, "inesperado", "caminho")
            return {"desfecho": "inesperado"}
        if i % CONFERE_A_CADA == 0 and not nas_caiu and not c.sentinela_viva(raiz):    # a cada 50, não a cada arquivo (Yannis I-11)
            nas_caiu = True
        if nas_caiu:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "nas_fora"})
            continue
        caminho = os.path.join(raiz, rel)
        try:
            if not c.existe(caminho):
                falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "ausente"})
                continue
            linhas, sha, n = c.ler_resumo(caminho)
        except OSError:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "nas_fora"})
            nas_caiu = not c.sentinela_viva(raiz)                 # confere logo depois de um erro de E/S
            continue
        except ValueError:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "ilegivel"})
            continue
        if sha != a["sha256"] or n != a["bytes"]:
            falhas.append({"arquivo_id": a["arquivo_id"], "motivo": "divergente"})
            continue
        lidos.append({"arquivo_id": a["arquivo_id"], "linhas": linhas})
        if (i + 1) % LOTE_PROGRESSO == 0 or relogio() - ult > PROGRESSO_S:     # M-4: o progresso no topo do laço conta também as falhas
            ult = relogio()
            try:
                site.dados("POST", "request/progress", {"pedido_id": p["id"], "token": p["token"], "lidos": len(lidos) + len(falhas), "total": p["total"]})
            except Recusa as e:
                if e.code == "pedido_cancelado":
                    raise Cancelado()
                raise
    corpo = {"pedido_id": p["id"], "token": p["token"], "lidos": lidos, "falhas": falhas}
    if len(c.json_compacto(corpo)) > 4 * 1024 * 1024:
        _fail(site, p, "grande_demais", "corpo")
        return {"desfecho": "grande_demais"}
    r = site.dados("POST", "request/result", corpo)
    return {"desfecho": "ok" if not falhas else "incompleto", "estado": r.get("estado"), "lidos": len(lidos), "falhas": len(falhas)}
```

  `progress` no topo do laço (M-4): como a atualização do progresso fica depois do `continue` das falhas, uma sequência longa de falhas não renova o arrendamento; por isso o teste `sentinela some no meio` roda com 120 arquivos e confere que `progress` foi chamado com `lidos+falhas` crescendo (mova a checagem do progresso para o início do laço, antes dos `continue`, se o teste falhar). `c.json_compacto` é `json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()`; se `comum.py` não o tem, acrescentar.

  `uma_volta` faz `site.dados("POST", "request/claim", {"versao": 1, "hora_maquina": c.agora_iso()})`, chama `atender` quando há pedido, captura `Cancelado` (`cancelado`), `ArquivoDesligado` (`desligado`), `ChaveRecusada` (`chave`), `SiteFora` (`site_fora`), `Recusa` com `pedido_vencido`/`pedido_de_outro` (`vencido`). `main(argv)`: `--prova` (um claim com `prova: true`, imprime e sai; código 3 se não for `200` com `pedido: null` ou `prova`); sem argumento, o laço: lê a chave a cada volta (rotação sem reinício), `c.instalar_sigterm()`, o **claim é o batimento**; a rota `heartbeat` (C8, `c.corpo_batimento(cf["base"], filhos)`, filhos medidos pela montagem de **leitura**) vai no máximo a cada `batimento_s` (600 s), só para medir disco e montagens; `estado/respondedor-vivo.json` a cada volta; `registrar` só quando atende ou o desfecho muda; `dormir(intervalo)`: 15 s por 5 min depois de uma volta que atendeu, senão 60 s (`desligado`: `pausa_desligado_s`). Exceção não prevista: registra `bug` com o tipo e segue depois de 60 s.
- [ ] **Passo 4. `falsos.py`:** `SiteArquivoFalso` ganha `pedidos` (fila de respostas do claim), `resultados`, `progressos`, `falhas_pedido`, `cancelar_no_progresso`, e os quatro espelhos Zod (`zod_claim` confere 14 colunas em cada linha do `result`, `arquivo_id` só uma vez, motivo da lista, `restante_s` presente, `prova` só aceito com `ha_pedido`).
- [ ] **Passo 5.** `bash ~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh > /tmp/m7-kit.txt 2>&1; tail -15 /tmp/m7-kit.txt` (Python 3.12) - todos passam, inclusive os do copiador e do `conferir-b2` com o `comum.py` novo.
- [ ] **Passo 6. Commit no kit:** `git -C ~/Workspace/forja/ferramentas commit -m "feat: arquivo M7: respondedor do período longo (só leitura, só resumos .canal listados, nas_fora sem montagem)" -- arquivo/respondedor/responder.py arquivo/teste_respondedor.py arquivo/comum.py arquivo/teste_comum.py arquivo/falsos.py arquivo/teste_tudo.sh`.

---

### Tarefa 12: serviço, modelo de ambiente e bloco do pulso

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service`
- Create: `~/Workspace/forja/ferramentas/arquivo/respondedor.env.modelo`
- Modify: `~/Workspace/forja/ferramentas/arquivo/pulso_arquivo.py`, `teste_pulso_arquivo.py`

**O que acontece quando o dado não existe:** `estado/respondedor-vivo.json` ausente -> o bloco do pulso fica **vermelho** ("respondedor sem sinal"), nunca verde; mais velho que **180 s** (três intervalos ociosos) -> vermelho; desfecho `chave`, `bug` ou `desligado` por mais de 30 min -> amarelo com o desfecho; `NRestarts` subindo -> amarelo.

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
# M-7 (Yannis): "-" na frente = caminho opcional; sem ele a unidade NÃO sobe quando a montagem de leitura está fora, e o desfecho nas_fora nunca apareceria
ReadOnlyPaths=-/mnt/arquivo/leitura /opt/arquivo/chaves /opt/arquivo/respondedor /opt/arquivo/comum.py /opt/arquivo/cliente_site.py
ReadWritePaths=/opt/arquivo/log /opt/arquivo/estado
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

  **Conferir** com `ssh forja 'ls /opt/arquivo; systemctl cat mnt-arquivo-leitura-numerico.mount | head -5'` (leitura) os caminhos reais e o nome da unidade de montagem; ajustar `ReadOnlyPaths` e `After=`.
- [ ] **Passo 2. `respondedor.env.modelo`** (molde `copiador.env.modelo`): as variáveis comentadas com o padrão (`ARQ_RESP_INTERVALO_S=15`, `ARQ_RESP_INTERVALO_OCIOSO_S=60`, `ARQ_RESP_BATIMENTO_S=600`, `ARQ_RESP_ORCAMENTO_S=780`, `ARQ_RESP_PAUSA_DESLIGADO_S=300`, `ARQ_MONTAGEM_LEITURA`) e a linha "Nenhum segredo aqui: a chave mora em /opt/arquivo/chaves/respondedor.chave (M3a)".
- [ ] **Passo 3. Pulso.** `NOMES` ganha `respondedor`; o bloco lê `estado/respondedor-vivo.json` (o serviço não tem "execução do cron"); modo `--so-bloco respondedor` imprime só o trecho novo (molde `--stdin`/`--remover`). Testes: ausente -> vermelho; velho (>180 s) -> vermelho; `desligado` há 40 min -> amarelo; bom -> verde.
- [ ] **Passo 4.** `teste_tudo.sh` passa. Commit no kit `feat: arquivo M7: serviço do respondedor, modelo de ambiente e bloco do pulso`.

---

### Tarefa 13: a medida (2.700, 10.800 e 16.200 arquivos pelo NFS)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py`, `teste_medir_respondedor.py`
- Create (fora do git): `.superpowers/sdd/manutencao-nas/m7/m7-13-medir.sh`

**Interfaces:**
- `medir_respondedor.py --gerar N --pasta <escrita>/numerico/_medida-respondedor` cria N resumos sintéticos `.canal` (cabeçalho = `COLUNAS_CANAL`, 2 linhas, gzip, ~300 B) em `serie/canais/<uuid>/resumo/<AAAA-MM>.v1.canal.csv.gz`; `--ler N --pasta <leitura>/numerico/_medida-respondedor` **gera a lista sozinho** (sem `--lista`) e chama **`atender`** do respondedor com um `SiteFalso` (mesmo código do laço: `sentinela_viva` a cada 50, `ler_resumo`, sha256), e imprime `{"n", "segundos", "ms_por_arquivo", "p95_ms", "teto_sugerido"}` com `teto_sugerido = min(1747, floor(780 / (3 * p95_s)))`; `--apagar` remove a pasta inteira (recusa caminho que não termine em `_medida-respondedor`).

**O que acontece quando o dado não existe:** montagem ausente -> `PARE: montagem` sem criar nada; pasta da medida já existente -> `PARE: sobra de medida anterior` (o dono apaga com `--apagar`).

- [ ] **Passo 1. Testes** (pasta temporária): gera 30, lê 30 por `atender` (o falso recebe `result` com 30 `lidos`), apaga; recusa apagar fora do sufixo; a medida importa `atender` e `ler_resumo` (não os reimplementa); `teto_sugerido` nunca passa de 1.747.
- [ ] **Passo 2. Commit no kit** `feat: arquivo M7: medida do respondedor (resumos sintéticos, só na pasta _medida-respondedor)`.
- [ ] **Passo 3. Arquivo de comandos do dono** (`m7-13-medir.sh`, um por linha; só o dono executa as linhas que escrevem na forja). A árvore completa vai para `/tmp/m7/` para o `import comum` funcionar (`responder.py` faz `sys.path.insert` do diretório pai):

```bash
# M7, Tarefa 13: medir o respondedor por NFS. Rodar fora de 06:00–06:30 (a cópia do NAS às 06:10).
ssh forja 'mkdir -p /tmp/m7/respondedor'
scp ~/Workspace/forja/ferramentas/arquivo/comum.py ~/Workspace/forja/ferramentas/arquivo/cliente_site.py ~/Workspace/forja/ferramentas/arquivo/medir_respondedor.py forja:/tmp/m7/
scp ~/Workspace/forja/ferramentas/arquivo/respondedor/responder.py forja:/tmp/m7/respondedor/
ssh forja 'python3 -B /tmp/m7/medir_respondedor.py --gerar 16200 --pasta /mnt/arquivo/escrita/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/m7/medir_respondedor.py --ler 2700 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/m7/medir_respondedor.py --ler 10800 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null'
ssh forja 'python3 -B /tmp/m7/medir_respondedor.py --ler 16200 --pasta /mnt/arquivo/leitura/numerico/_medida-respondedor'
ssh forja 'python3 -B /tmp/m7/medir_respondedor.py --apagar --pasta /mnt/arquivo/escrita/numerico/_medida-respondedor'
ssh forja 'rm -rf /tmp/m7'
```

  Linha curta ao clipboard: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m7/m7-13-medir.sh > ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas/m7-13-medir.txt 2>&1`. **Conferir antes** que a pasta `_medida-respondedor` não colide com `RESERVADOS` nem com a varredura do copiador e do `conferir-b2` (`grep -n "listdir\|scandir\|walk" ~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py ~/Workspace/forja/ferramentas/arquivo/conferir-b2/*.py`); se algum varrer a árvore, a medida usa pasta fora de `numerico/` (o dono escolhe onde) e o plano registra.
- [ ] **Passo 4. Ledger e decisão (regra, Phil I3 / Yannis I-11).** Anotar os três números. **O número é um piso, não um teto**: o NFS medido com `drop_caches` é o pior caso frio de um arquivo por vez, mas o ARC da casa quente ou ocupado muda o p95. Regra: `TETO_ARQUIVOS = min(1747, floor(780 / (3 * p95_s)))` (margem de 3 vezes sobre o p95 para ARC quente e concorrência com a cópia das 06:10); o valor sai em `pedido.ts` (`TETO_ENTRADAS`/`TETO_ARQUIVOS`) **e** em `obs_archive_request_limits` **antes** da Tarefa 14. Se 10.800 ou 16.200 passarem de 15 min, anotar como gatilho para quando outra classe entrar nas medidas (P22, M10b). Até a medida: `TETO_ARQUIVOS = 1747` NÃO MEDIDO.

---

### Tarefa 14: migration e produção (TRAVA M7-1b)

**Files:**
- Create: `supabase/migrations/<ts>_manutencao_m7_periodo_longo.sql` (por `npm run db:new manutencao_m7_periodo_longo`)
- Modify: `apps/web/test/helpers/m7.ts` (`M7_SQL_CAMINHO` aponta para a migration, `M7_EM_MIGRATION = true`)
- Delete: `supabase/rascunhos/m7.sql`

- [ ] **Passo 1.** Conferir a TRAVA M7-1b no ledger da M3b. `npm run db:new manutencao_m7_periodo_longo`; copiar o rascunho para o arquivo criado; `git rm -- supabase/rascunhos/m7.sql`; ajustar o helper. **Se o plano B da TRAVA M7-0b foi usado** (a M7 criou `obs_archive_summary_calc`): `diff <(psql ... -c "select pg_get_functiondef('public.obs_archive_summary_rows'::regproc)") <(corpo esperado)` e falhar alto se divergir.
- [ ] **Passo 2.** Banco local limpo: `npm run db:reset` no `bythiago_int` (ou o fluxo da M3b para ele) e a suíte de banco da M7 e da M3b (`HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m7 test/integration/observatorio-a5-e10-lista-fechada.test.ts --no-file-parallelism > /tmp/m7-t14.txt 2>&1`), só falhas no contexto.
- [ ] **Passo 3. Commit** `feat: M7: migration do período longo (fila, resultado, gatilho do apagar, poda)`.
- [ ] **Passo 4. Arquivo de comandos do dono** `m7-14-push.sh`: `npx supabase migration list --linked` (saída em `saidas/`); o controlador confere que a única pendente é a da M7; depois `npm run db:push:prod` (o dono digita `YES`). Janela fora de 11:30–13:00 UTC e dos minutos 0, 20 e 40.
- [ ] **Passo 5. Conferência em produção** (arquivo de comandos, só leitura por `supabase db query --linked`): as duas tabelas existem; `has_function_privilege('service_role', 'public.obs_archive_request_claim(uuid,boolean)', 'EXECUTE')` verdadeiro e `anon` falso; `select jobname, schedule from cron.job where jobname = 'purge-obs-archive-requests'` (uma linha, `30 6 * * *`); `select public.obs_archive_vigia_resultados()` = 0; **no dia seguinte**, `select ran_at, status, items_processed from public.cron_runs where job = 'pg_cron:purge-obs-archive-requests' order by ran_at desc limit 1` (rodou, mesmo com zero). Anotar "TRAVA M7-2 solta em <data hora>" no ledger.

---

### Tarefa 15: ligar o respondedor na forja (mão do dono; TRAVA M7-3)

**Files:**
- Create (fora do git): `.superpowers/sdd/manutencao-nas/m7/m7-15-prova.sh`, `m7-15-ligar.sh`, `m7-15-conferir.sh`, `m7-15-portao-partida.sh`

- [ ] **Passo 1. `m7-15-prova.sh`: instala os arquivos e prova a rota, sem ligar o serviço (Yannis I-12).** Um comando por linha:

```bash
# M7, Tarefa 15, parte 1: instalar o código e provar a rota. NÃO liga o serviço.
scp -r ~/Workspace/forja/ferramentas/arquivo/respondedor forja:/tmp/respondedor
scp ~/Workspace/forja/ferramentas/arquivo/comum.py ~/Workspace/forja/ferramentas/arquivo/cliente_site.py ~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service ~/Workspace/forja/ferramentas/arquivo/respondedor.env.modelo forja:/tmp/
ssh forja 'sudo install -d -o thiago -g thiago -m 0755 /opt/arquivo/respondedor'
ssh forja 'install -m 0644 /tmp/respondedor/responder.py /opt/arquivo/respondedor/responder.py'
ssh forja 'install -m 0644 /tmp/comum.py /tmp/cliente_site.py /opt/arquivo/'
ssh forja 'cp -n /tmp/respondedor.env.modelo /opt/arquivo/respondedor.env && chmod 0600 /opt/arquivo/respondedor.env'
ssh forja 'sudo install -m 0644 /tmp/arquivo-responder.service /etc/systemd/system/arquivo-responder.service'
ssh forja 'sudo systemctl daemon-reload'
ssh forja 'python3 -B /opt/arquivo/respondedor/responder.py --prova; echo "codigo=$?"'
ssh forja 'rm -rf /tmp/respondedor /tmp/comum.py /tmp/cliente_site.py /tmp/arquivo-responder.service /tmp/respondedor.env.modelo'
```

  `--prova` usa `prova: true`: **não toma pedido** (Phil M8), logo nada gasta uma das 2 tentativas. Sai com **código 3** se a resposta não for `200` com `pedido: null` (ou `prova`); o controlador lê `codigo=` na saída e **só então** entrega `m7-15-ligar.sh`. Antes de qualquer `install`: confirmar por leitura (`ssh forja 'md5sum /opt/arquivo/comum.py'` contra o do kit) que o `comum.py` instalado é o da M3b; a cópia na forja pode estar atrás (CLAUDE.md), e a troca leva as mudanças da M3b: conferir que o copiador e o `conferir-b2` passaram no `teste_tudo.sh` com este `comum.py` (Tarefa 11, Passo 5).
- [ ] **Passo 2. `m7-15-ligar.sh`** (só depois do código 0 da prova): `ssh forja 'sudo systemctl enable --now arquivo-responder'`.
- [ ] **Passo 3. Bloco do pulso:** `python3 -B pulso_arquivo.py --so-bloco respondedor` gera o trecho; o dono o acrescenta pelo caminho que a M3b-forja usou para os outros blocos (`--stdin`), por arquivo de comandos. O pulso fica **vermelho** se `respondedor-vivo.json` tem mais de 180 s.
- [ ] **Passo 4. `m7-15-conferir.sh`** (só leitura): `ssh forja 'systemctl show arquivo-responder -p ActiveState -p NRestarts -p ActiveEnterTimestamp'`; `ssh forja 'cat /opt/arquivo/estado/respondedor-vivo.json'`; `ssh forja 'tail -3 /opt/arquivo/log/respondedor.jsonl'`; e, no site, `supabase db query --linked "select worker, last_poll_at from public.obs_archive_heartbeat where worker = 'respondedor'"`. Esperado: `active`, `NRestarts=0`, desfecho `nada`, batimento com menos de **2 min** (o claim ocioso é de 60 s).
- [ ] **Passo 5. Ponta a ponta** (com `OBS_ARQUIVO=on`): o dono abre a página de um canal no Opera (`open -a Opera <url>`), pede 12 meses e confere "Aguardando a casa" -> "Lendo" -> pronto. Antes de haver mês destacado (a regra da janela só destaca a partir de 01/03/2027, D15), o botão não aparece (D17) e o ponta a ponta usa **só o pedido só online**, que fecha sem a forja; o caminho da forja é provado pelo portão do Passo 7. Com mês arquivado: desmontar a leitura (`sudo systemctl stop mnt-arquivo-leitura-numerico.mount`), conferir "A forja respondeu, mas o NAS não está acessível", remontar. Anotar no ledger.
- [ ] **Passo 6. Custo do claim (D19) em produção.** 24 h depois de ligar: contagem de invocações da rota `request/claim` (painel da Vercel, Functions, filtro pela rota). Esperado: variante B ~1.440; variante A ~5.760. Anotar no ledger; se passar de 2 vezes o esperado, olhar `respondedor.jsonl` por laço de `bug`.
- [ ] **Passo 7. Portão da partida (Phil I6): conferência do NAS por SQL, entre 28/11/2026 e a partida.** O primeiro mês **destacado** só existe em **01/03/2027** (D15: agosto/2026 + 6 meses de janela + 1 = 01/03/2027); a data "01/02/2027" que circulou estava errada (esquecia o "+1" do spec 02 linha 275). Mas os meses **selados** existem desde 28/11/2026 (`sealed_kind = 'com_dado'`, resumo `.canal` copiado), e a forja os lê. `m7-15-portao-partida.sh` (cada comando em uma linha):
  1. `supabase db query --linked "select count(*) from obs_archive_months where class='serie' and sealed_at is not null and sealed_kind='com_dado'"` (> 0; e `... detached_at is not null` = 0 até março: confirma que a tela não oferece o botão antes da hora).
  2. Com o `<site>`, o `<canal>` e o `<dono>` preenchidos pelo controlador: `supabase db query --linked "select public.obs_archive_request_create('<site>','relatorio','{<canal>}','12',array['linhas','videos_com_linha','dias_medidos','dias_do_mes','var_views','var_likes','var_comments'],'<dono>')"` (`MEDIDAS_V1`; o claim lista os meses selados mesmo ainda não destacados).
  3. Esperar o desfecho (poll do respondedor, até 60 s): `supabase db query --linked "select status, fail_reason from obs_archive_requests order by requested_at desc limit 1"` -> `done`.
  4. Conferir que o mês lido do NAS tem `dias_medidos`, `var_views`, `var_likes`, `var_comments` **idênticos** aos de `obs_archive_summary_calc(<site>,'serie',<canal>::uuid,'competitor_video_daily',<mês>,null,'online')->'canal'` do mesmo mês (diferença = o arquivo e o banco divergem: parar e abrir incidente).
  5. Repetir com a montagem de leitura parada (`sudo systemctl stop mnt-arquivo-leitura-numerico.mount`): o pedido termina `incompleto` com `nas_fora`. Remontar.
  Registrar no ledger "portão da partida M7 ok em <data>". Sem ele, a M7 não fecha antes de jan/2027.

---

### Tarefa 16: runbook

**Files:**
- Modify: `docs/ops/runbook-arquivo-mensal.md`

- [ ] **Passo 1.** Trocar a consulta 5 (`to_regclass`, "a fila do relatório ainda não existe") por `select public.obs_archive_vigia_resultados();` (esperado 0) e a consulta 6 do item 160 (pedidos ativos e vencidos: `select status, count(*) from public.obs_archive_requests group by 1`; resultados e bytes: `select count(*), sum(payload_bytes) from public.obs_archive_results`), com o que cada número quer dizer.
- [ ] **Passo 2.** Seção "Respondedor": o que é, como ver (`systemctl show`, `respondedor-vivo.json`, `respondedor.jsonl`), como **desligar** (`sudo systemctl disable --now arquivo-responder`: os pedidos vencem em 15 min com "A casa não respondeu"; nada se perde) e religar; que pedidos acumulados com a casa desligada **não** rodam no religamento (item 51); o que fazer com `arquivo não bate` (pedir ao Claude Code para conferir o mês: a conferência do NAS da M3b).
- [ ] **Passo 3.** **Linha de volta atrás da M3b (Yannis M-11):** "voltar atrás da M3b antes de 28/11 (runbook M3b, (e)) exige desfazer a M7 primeiro: a M7 tem gatilho (`obs_archive_z_resultados_apagar`) em tabela da M3b e funções que leem `obs_archive_summary_calc`". Ordem: `drop trigger`, `drop function` da M7, `drop table obs_archive_results, obs_archive_requests`, `cron.unschedule('purge-obs-archive-requests')`; só depois o rollback da M3b. Ficha de comando só quando o dono pedir (regra "comando só na hora").
- [ ] **Passo 4. Commit** `docs: M7: runbook do período longo (consultas 5 e 6, respondedor, volta atrás)`.

---

## Cobertura dos itens de aceite (`06` §18) desta etapa

| Item | Onde |
|---|---|
| 50 (vencido em 15 min, calculado na leitura) | Tarefa 4 (`obs_archive_request_state`), Tarefa 2 (frase) |
| 51 (acumulados com a casa desligada não rodam) | Tarefa 5 |
| 52 (pedido que derruba o respondedor ≤ 2 tentativas; mostra `inesperado`, não `sem_trabalhador`) | Tarefas 4, 5 e 11 |
| 53 (clique duplo) | Tarefas 3 (índice) e 4 (função) |
| 54 (teto antes de inserir; total ≤ 8 MB expulsando o mais antigo, sob trava) | Tarefa 6 |
| 55 (resposta zero é incompleto; nenhum mês some; fora do registro não pedido) | Tarefas 5 e 6 |
| 56 (sem corpo nem id de comentário) | Tarefas 1 e 6 |
| 57 (poda na lista fechada) | Tarefa 7 |
| 102 (`nas_fora`) | Tarefa 11 |
| 103 (selado do arquivo, não selado do online "parcial", nunca `ensaio`) | Tarefas 5 e 6 |
| 104 (medida fora da lista recusada; só resumos) | Tarefas 1, 4 e 11 |
| 105 (teste de tela por quadro) | Tarefa 10 |
| 160, consultas 5 e 6 | Tarefas 7 e 16 |
| 162 (1.001 arquivos; não lista pasta; vigia 5 = 1; medida 2.700/10.800/16.200) | Tarefas 5, 7, 11 e 13 |

## NÃO VERIFICADO (o plano escreveu sem ter rodado)

- O tempo por arquivo no NFS (5 a 50 ms é estimativa do spec) e, com ele, `TETO_ARQUIVOS` e o orçamento de 780 s: medida na Tarefa 13 (piso, não teto).
- O tempo de `obs_archive_request_online` para 75 canais, de `obs_archive_request_read` com o registro cheio, de `obs_archive_first_month` nas partições da M2 e de `obs_archive_request_finish` com 1.747 arquivos: medidas locais nas Tarefas 4 e 6.
- Se o `statement_timeout` do `service_role` em produção comporta o `finish` (Tarefa 6, Passo 7c).
- O corpo final de `obs_archive_summary_calc` que a M3b levar a produção (a M7 o consome; plano B na Tarefa 14).
- Se o ARC quente muda o p95 do NFS (daí a margem de 3 vezes).
- O caminho real de `comum.py` e da unidade de montagem na forja, e se `copiador`/`conferir-b2` varrem pasta: Tarefas 12 e 13.
- O custo de invocações do claim na Vercel (D19): Tarefa 15, Passo 6.
- O funcionamento do portão da partida contra o NAS real (Tarefa 15, Passo 7): nunca rodou.

## Dependências de outras etapas e trilhas

- **M3b em produção** (Tarefas 10 e 11 dela: migration, `archive-auth.ts`, `contrato.ts`, rota `heartbeat` com `archive_read`, runbook) antes das Tarefas 1 (contrato.ts), 8 e 14; ordem das migrations M2 -> M10a -> M3b -> M7. **A Tarefa 10 da M3b extrai `obs_archive_summary_calc`** (pedido da M7, Yannis I-9): registrado em `m3b-site-progresso.md`, seção "Pedido da M7 para a Tarefa 10".
- **M6** (portão): `ainda_na_janela.pode_sair_em` deve chamar `public.obs_archive_pode_sair_em(p_month, janela)` (D15); pedido ao controlador da M6, com teste de equivalência na Tarefa 4 (`skipIf` M6 ausente).
- **M5** (telas): a peça 1 ("no arquivo") e o bloco de CSS do mockup 19; a tira da M7 fica entre `<CanalHeader` e `<AbasNav` de `_canal/canal-screen.tsx`.
- **M8**, passo 9 do ensaio: usa o tipo `ensaio` desta fila (`obs_archive_request_create(..., 'ensaio', ...)`); a M7 entrega a função e o filtro de classe, a M8 o disparo.
- **M10b**: `ficha_do_video` (P22) e a classe `video_antigo` nas medidas; até lá recusadas.
- **M9**: o expurgo marca `purged_at`; a M7 já trata purgado depois do claim (`expurgado` com a data).
- **Mão do dono, antes da partida para a Ásia (jan/2027):** medida (Tarefa 13), `db:push:prod` (Tarefa 14), instalação, prova e ponta a ponta na forja, portão da partida (Tarefa 15).
- **Aprovação do dono dos textos L1-L7** (Tarefa 10, Passo 1) e **decisão do dono sobre o custo do claim** (D19), antes da execução das Tarefas 10 e 11.
- Revisão de Phil e Yannis (2ª rodada) do plano, antes da execução.
