# Manutenção M9: expurgo enxuto (fatia 12b) Implementation Plan

> **Emenda 29/10 (revisão do lote 1: Phil 74→92, Yannis 86→93).** O SQL das Tarefas 1 a 5 vigente é o de `supabase/rascunhos/m9.sql` no commit `ba82facd9` (ramo `chore/manutencao-m9-2910`); onde o bloco SQL deste plano diverge, **vale o rascunho** (a Tarefa 10 copia o rascunho, nunca o plano). Mudanças: `antigas_open` pela idade da nova e todas as partes no B2 (Phil C1, Yannis I-2); `reabrir` não parte de `concluido` (check intacto); marca `obs_archive.origem` zerada no fim do `record`; `v_fora` da tabela do alvo (Yannis I-1); `site_id` no `item_advance` e índice `(site_id, prefixo)`; regex sem `{0,299}` e `any(array(...))`. Fonte: `.superpowers/sdd/manutencao-nas/saidas/m9-lote1-*.md`, ledger `m9-progresso.md`. **Condição do Phil para a Tarefa 13 (I1):** retenção de 90 dias da prova de ausência encerrada (teste de 89 e 91 dias) e conferência de tamanho no dia da Tarefa 10.

> **Emenda 25/10 (conserto da Tarefa 6 pura, Yannis I2 e Phil I2; commit dad12e7fe). Vale sobre o texto abaixo onde ele divergir.**
> - **Passo 5 da Tarefa 6, 2ª linha:** "`unidade: null` = ficou vazio" está ERRADO. Versão nova vazia vem com `unidade` NÃO nula, `row_count 0` e `sha256_bytes`/`csv_sha256` nulos (check `m3b.sql:88`); `unidade: null` só quando `removidas = 0`; `removidas > 0` com `unidade` nula é recusado (`forma`).
> - **Tarefa 8:** usar `serializarUnidade(...)` direto (já devolve shas nulos, não `''`); `arquivo_id` das respostas é texto `u:<uuid>`/`s:<uuid>`; `status: 'recusado'` (409) é resposta válida, não corpo inválido; `bloquear` idem (`RespostaBloquear`).
> - **Tarefas 8 e 9:** ao filtrar `competitor_video_comment_marks` por comentário, passar `idsDeComentarioComRespostas(comentariosOriginais, chaves)`, nunca as chaves cruas.
> - **Tarefa 11:** o `resumo` de `abrir` já vem tipado (`canal`/`video` = sha ou null).
> - **Portão (Phil M3):** o vetor do hash em `arquivo-mensal-expurgo-resumo.test.ts` foi escrito à mão; o teste de ouro `manutencao-m9-resumo-ouro.test.ts` contra o banco segue devido e é portão antes da Tarefa 8; a Tarefa 9 não roda em dado real sem ele verde. `ITEM_ID` duplicado: a Tarefa 7 Parte B da forja importa uma só definição.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o "apagar" da fila "Saíram do YouTube" (vídeo e comentário) e o "apagar do arquivo" de um canal removido alcançarem o NAS e o B2, com prova de ausência, pelo comando único do dono (`obs:arquivo`), pela peça 7 e pelo bloco "Canais removidos", sem que nenhum programa da forja apague sozinho.

**Architecture:** O banco guarda, antes da cascata da E9, a lista do item (classe, tabela, mês, chave) e dirige tudo por estados: o Mac (`npm run -s obs:arquivo`) lê as pendências na `versao: 2`, reescreve no Mac as unidades e os resumos sem o item (versão nova, serialização TypeScript da M3b; o manifesto novo sai do fluxo de selagem da M3b), registra-os pela rota nova com a chave `archive_owner` e imprime o script que põe os arquivos em `_recebendo/` e, num segundo tempo, apaga as versões antigas conferindo sha256. O Mac lê o NAS pela montagem somente leitura `ro` (`/mnt/arquivo/leitura`), depois de conferir por ssh que o filho está montado e com sentinela. A ausência (arquivo do item e prefixo do canal) é provada pelo copiador (NAS, duas vezes com 11 h, e a prova direta de que nenhum snapshot ZFS ainda guarda o prefixo) e pelo `conferir-b2` (todas as versões, na mesma execução do canário), e só a prova avança o estado; o vigia e a tela leem o mesmo estado.

**Tech Stack:** PostgreSQL 17 (Supabase; `plpgsql`, `security definer`), Next.js 16 (App Router, route handlers do pipeline, server actions), TypeScript 5 strict + Zod, Vitest (`bythiago_int`, 54421/54422), `tsx` no Mac, Python 3 do kit da forja (`~/Workspace/forja/ferramentas/arquivo/`, git local), bash do script impresso.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` — `02` §10.4, §10.5 ("Alvo derivado", "Lista derivada", "Remoção sem arquivo"), §11.3 (expurgo, tabela de estados da remoção); `04` §14.2 (bloco "Canais removidos"), §14.3, §14.7 (peça 7); `05` l.29, l.39, §16.10; `06` itens 65, 66, 67, 109, 110, 111, 120, 161, 163 (parte M9), 165 (parte dos comandos), P47, R38. Vale mais que o spec onde divergem (brief da onda 2): `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.5), `emenda-credencial-rota.md`, `decisoes-dono-14-10.md` (seção final), `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-site.md` (E-D1 a E-D5, Tarefa E1, Tarefa 13), `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-forja.md` (Tarefa 7a, D-F22 a D-F25), `supabase/rascunhos/m3b.sql`, `apps/web/test/helpers/m3b.ts`. Mockups (fonte da tela, não redesenhar): `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/peca7.js`, `arquivo.js` (bloco canais, `CMDHTML` l.170), `NOTAS.md` (peça 7, l.84-123).


> **Emenda 24/10 (Phil, janela).** A linha de `obs_archive_units` só nasce depois que o copiador leu e montou o arquivo; entre a 1ª chamada do plano e o 1º `record`, o helper via `units` vazio e deixava apagar (item no NAS/B2 sem lista). O helper `obs_archive_m9_pronto` (Tarefa 2) também recusa quando `obs_archive_switch` do site tem `first_month_at` ou `armed_at` não nulos (gravados antes de qualquer leitura; no rascunho `m3b.sql`: upsert de `first_month_at` l.1979, coalesce monótono; `armed_at` l.152; `units` gravada na l.673). Não usar `disarmed_at`. Efeito aceito: plano sem export ou classe armada e desarmada mantém a recusa até ligar a M9 (lado seguro, `P0001` com frase). Pendência na execução: conferir que a 1ª chamada do plano grava `first_month_at` antes de devolver a lista; se só gravar com classe devida, usar só `armed_at`. Fonte: `.superpowers/sdd/manutencao-nas/replan-23-10/m9-janela-phil.md`. Testes novos na tabela da Tarefa 2 (5 linhas marcadas).

## Emenda 25/10 (dono, P4): a parte de canal vai para a M9b

Decisão do dono (25/10, recomendação da Hanna): a **Tarefa 12** (a tela, no que toca "Canais removidos" e o "Apagar do arquivo") e o **`expurgar --canal` da Tarefa 8** (com o arquivo de comandos do canal da Tarefa 6) saem desta etapa e vão para a **M9b**, sem plano próprio ainda. O SQL das Tarefas 1 a 5 **fica** (a prova de ausência e os marcos da remoção continuam). O núcleo (apagar vídeo e comentário da fila "Saíram do YouTube" até o NAS e o B2) não muda. **Gatilho de volta:** o dono pedir, ou o CAP mostrar o espaço apertando, ou **fechar a M9 (30/10, Hanna H1): plano da M9b antes da selagem em que o canal do passo 19 entra**. Fonte: `.superpowers/sdd/manutencao-nas/decisoes-dono-t12-2510.md`.

## Emenda 23/10 (retomada)

Origem: `.superpowers/sdd/manutencao-nas/replan-23-10/onda0-rerevisao-m6-m9-phil.md` (N9-1 a N9-5) e `...-yannis.md` (N-M9-1 a N-M9-5); pedido de `yannis.md` §6.7 ("não refaz o que a E9 já trouxe"). Onde os dois pedem a mesma coisa, uma emenda só. Fatos de 23/10 em produção (SELECT): `competitor_video_purge` md5 `8c6d51b2ae774671c2fa15c3e8d48535`; `competitor_comments_purge` md5 `2233c4edb3613594ed363ed68eb2378a` (recriada pela F2, migration `20261018000002`; a migration da E9 de 15/10 dá `d739a541…`, **não** é o corpo vigente); `competitor_channel_purge` md5 `02d2a5b50a930a06ff2bc523226a0697`; `competitor_removed_items` tem 0 linhas. Tabela completa: `replan-23-10/onda0-emenda-m6-m9.md`.

| Achado | Resumo | Onde foi consertado neste plano |
|---|---|---|
| N9-1 (Phil) + N-M9-2 (Yannis) | A E9 já faz: declarar o destino no `competitor_channel_purge`, mapear `mes_destacado_em_transito`, `apagando_ha_mais_de_1d` só com `blobs_pending`; plano trata como pendente | TRAVA M9-0 (a) e (f); "O que já existe" (linhas da E9); D-M9-23 reescrita; Review Focus/Estrutura de arquivos; Tarefa 0 Passos 2 e 3; Tarefa 2 (teste `service_role_apaga_canal` sem `skip`, guarda `competitor_channel_purge`); Tarefa 11 (Modify, teste, parágrafo do mapeamento); NÃO VERIFICADO 1 e 2; Dependências |
| N-M9-1 (Yannis) | Corpo-base de `competitor_comments_purge` é o de 15/10; produção tem o da F2 (`v_conta`, resposta de espectador fora da lista) | Tarefa 0 Passo 2 (md5 de partida); Tarefa 1 Passo 3 e Tarefa 2 (`semearE9` extrai da última migration, `e9-funcoes.sql` sai); Tarefa 2 Passo 4; Tarefa 10 Passos 1-2 |
| N9-2 (Phil, cruza A5; **DECIDIDO pelo dono 23/10: dentro da M9**) | `competitor_video_purge`/`channel_purge` não limpam `yt_watch_*` (S4) | D-M9-25; Tarefa 2 (bloco `do $m9$`, as três funções); Tarefa 0 Passos 2 e 3 (md5 do canal); Tarefa 10 Passos 1 e 2 |
| N9-3 (Phil, ordem; **DECIDIDO pelo dono 23/10: opção (a)**) | Vídeo/comentário apagado na E9 entre o início do export da M3b e a M9 ligada fica no NAS/B2 sem lista | D-M9-26; Tarefa 2 (efeito `recusa` no SQL) e Tarefa 11 (tradução na ação); TRAVA M9-0 |
| N-M9-3 (Yannis; **decisão: Phil**) | `keys` guarda ids de espectador (F2) sem regra | D-M9-25b abaixo (esvaziar `keys` em `concluido`); Tarefa 1 (tabela, trigger, teste); linha "Segredo" do C13 (Tarefa 7) |
| N9-4 (Phil) | Semântica do `mes_destacado_em_transito` é global, não do mês do item | Tarefa 2 (teste `captura: mês destacado em trânsito`), Tarefa 11 (frase), Tarefa 4 |
| N9-5 (Phil) + N-M9-5 (Yannis) | P-M9-1 com 105 dias; premissa da TRAVA (a) deve registrar a leitura de 23/10 e os três md5 | Tarefa 0 Passos 2 e 4; TRAVA M9-0 (a) |
| N-M9-4 (Yannis) | Sem sonda de custo do I11 | Tarefa 4 (teste `sonda_custo_ausencia`) |

**Decisões abertas desta emenda: nenhuma.** D-M9-25 e D-M9-26 foram decididas pelo dono em 23/10 (`.superpowers/sdd/manutencao-nas/replan-23-10/decisoes-dono-23-10-noite.md`, com Phil, Yannis e Hanna de acordo); D-M9-25b (esvaziar `keys` ao concluir) segue a decisão de Phil.

## Emenda 29/10 (dono): snapshots por tempo (M9-snap)

Decisão do dono (29/10, opção C, recomendação do Phil em `.superpowers/sdd/manutencao-nas/saidas/m9-t9-rerev-phil.md` §5; Hanna de acordo com os critérios de aceite abaixo). **Substitui a D-M9-9** ("snapshots por prova direta") **e o controle positivo por sentinela do kit `bd7fe03`**. Vale sobre o texto das Tarefas 4, 9 e 14 onde divergir. A implementação é a **Tarefa 9b** (logo depois da Tarefa 9).

**Fato medido que motiva (Yannis C1, `m9-t9-rev-yannis.md`; conferido de novo em 29/10 19h35 por `ssh forja`, só leitura):** pela montagem NFS da forja, `/mnt/arquivo/leitura/{numerico,texto}/.zfs/snapshot` lista **56 nomes** em cada filho (`auto-2026-10-16_00-20` … `auto-2026-10-29_18-20`, 4 por dia, retenção de 14 dias, nenhum fora do padrão), mas **cada snapshot aparece vazio**. Ler dentro do snapshot é impossível por essa via; o kit `bd7fe03` responde `indisponivel` sempre (seguro, mas o expurgo nunca fecha). `stat` do diretório de cada snapshot devolve a hora do nome em `-0300` (ex.: `auto-2026-10-29_18-20` → `2026-10-29 18:20:00 -0300`): os nomes estão na hora local do NAS (America/Sao_Paulo). `python3` da forja é 3.12.3 com `zoneinfo` (`America/Sao_Paulo` resolve).

**D-M9-9b (regra C).** Um snapshot só pode guardar o prefixo se foi tirado **antes** de o prefixo sumir do dataset. Então, para uma linha de `obs_archive_absence` com `nas_absent_at` não nulo: se **todos** os snapshots listados do filho têm nome no padrão `^auto-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$`, a lista não é vazia, a hora do nome bate com o `mtime` do diretório (±10 min) e o **mais antigo** é posterior a `nas_absent_first_at` + 1 h, **e** `nas_absent_first_at` tem pelo menos 14 dias, nenhum snapshot guarda o prefixo ⇒ `snap_absent_at` gravado (o equivalente a `snapshots: 'ausente'`). Qualquer outro caso ⇒ fica pendente (`indisponivel`): mais antigo anterior, nome fora do padrão (snapshot manual `manual-…`), lista vazia, erro de leitura, hora do nome ≠ `mtime`, mais novo no futuro (relógio duvidoso). Prova por regra, não por leitura (fraqueza declarada pelo Phil); a prova por leitura (opção A, `crossmnt` no NFS do TrueNAS) fica para depois, se o dono quiser.

**Quem decide: o site.** O kit **mede e informa** (a lista estava toda no padrão; hora do mais antigo e do mais novo em segundos Unix, já convertidas de America/Sao_Paulo; quantos) e o banco **compara** com `nas_absent_first_at`. Motivo: a hora de ausência confiável mora no banco. `nas_absent_first_at` é gravado pelo `now()` do banco, só conta depois de duas execuções com ≥ 11 h (D-M9-8), é zerado pelo `obs_archive_reabrir` quando o prefixo reaparece e sobrevive a reinstalação do kit. O kit não guarda estado entre execuções; para ele decidir, teria de (a) receber a hora no plano (SQL novo do mesmo jeito) ou (b) guardar um arquivo de estado na forja (escrita na forja, que o site não audita e que se perde numa reinstalação). Decidindo no site, o critério fica num lugar só, testado no banco de integração, e o kit continua um medidor que nunca declara "ausente".

**Por que a regra aguenta relógio, hold e snapshot manual:**
- **Relógio do NAS atrasado:** os nomes saem mais cedo que a realidade, o mais antigo parece mais velho: só atrasa (seguro). **Adiantado até 1 h:** coberto pela margem de 1 h. **Adiantado mais que isso:** a retenção do NAS também corre pelo relógio dele, então o mais antigo real tem menos de 14 dias; com o piso "ausente há ≥ 14 dias" no relógio do banco, o mais antigo real é posterior à ausência. **Salto grande:** mais novo com hora > `now()` + 15 min ⇒ pendente.
- **Hold:** um snapshot com hold não expira e fica na lista; se é anterior à ausência, ele é o mais antigo e segura a linha (pendente, critério b); se é posterior, não contém o prefixo. A NFS não mostra hold; a regra não precisa ver.
- **Snapshot manual:** nome fora do padrão ⇒ a linha inteira fica pendente até ele sair (decisão do dono, runbook). Snapshot manual com nome imitando `auto-…` e hora falsa: a hora do nome ≠ `mtime` ⇒ pendente. Resta só o caso de alguém renomear e ajustar a hora, fora do modelo de ameaça.

**O copiador pode recriar o prefixo depois da ausência? (pergunta da Hanna e do Phil).** Hoje, em tese, sim: o copiador grava no NAS tudo o que o plano manda (`exportar`, `resumos`, `manifestos`, `aguardando_dono`, via `gravar_recebendo`/`mover`), e nada no kit impede um caminho sob um prefixo com ausência aberta. Na prática o site não exporta mais o canal apagado nem o item (a cascata da E9 apagou as linhas; a versão nova do expurgo tem caminho `vN+1`, diferente da antiga), e uma recriação que o copiador **vê** dispara `obs_archive_reabrir` (zera `nas_absent_first_at`, e o relógio da regra C recomeça). O buraco é recriar e sumir de novo **entre duas execuções** com um snapshot no meio. Proteções da 9b: (1) **o copiador recusa gravar ou mover qualquer caminho sob um prefixo de `prefixos_ausentes` do mesmo plano** (contador `sob_prefixo_ausente`, o item não é escrito e a execução sai `plano_invalido`, vermelha; guarda em três pontos, ver Tarefa 9b; teste próprio), o que torna a recriação pelo copiador impossível enquanto a linha está aberta; (2) a presença vista reabre (já existe, D-M9-8); (3) o piso de 14 dias. Resíduo declarado: o teto de 2000 prefixos por plano (linhas além do teto não entram na lista de recusa daquela execução; hoje são 0 linhas) e escrita humana direta no NAS (restaurar do B2 é reaparecimento, que o copiador vê).

**Migration: sim, uma nova** (`npm run db:new manutencao_m9_snap_por_tempo`; aplicação pelo `db:push:prod` depois do portão). Não dá para evitar: qualquer caminho em que a hora de ausência entre na decisão muda SQL (o `attest` hoje só aceita `ausente|presente|indisponivel` e grava `snap_oldest` como `date`; o plano não manda a hora ao kit). Custo: `alter table` com 1 coluna (`snap_motivo text`, I1 do Phil; `snap_oldest` continua `date`, informativo), `create or replace` de `obs_archive_attest_prefixos` (~75 linhas, ~20 mudam) e de `obs_archive_owner_pending` (~110 linhas, 3 chaves novas por item para a tela: `snap_espera_desde`, `snap_libera_em`, `snap_bloqueio`). Risco baixo: o interruptor está desligado e o kit instalado hoje (anterior ao `bd7fe03`) não manda `prefixos`, então nenhuma linha passa pela função até o dono ligar. Ordem P47: código do site (contrato e leitor aceitando o novo) → migration → kit.

**Critérios de aceite (Hanna), cada um com o passo da 9b que o prova:**
| # | Critério | Onde |
|---|---|---|
| a | mais antigo posterior ⇒ ausente; anterior ⇒ indisponível (pendente) | Passo 3, testes `snap_tempo_posterior_libera`, `snap_tempo_anterior_segura` |
| b | nome fora do padrão, hold, lista vazia ⇒ indisponível | Passo 1 (kit: `fora_do_padrao`, `lista_vazia`, `mtime_diverge`) e Passo 3 (`snap_hold_segura`) |
| c | na forja, prefixo ausente há < 14 dias nunca vira ausente de snapshot | Passo 3, `snap_piso_14_dias` (mesmo com o mais antigo posterior) e a fixture de 56 nomes da forja no Passo 1 |
| d | painel mostra "aguardando snapshots há N dias" | Sub-tarefa 9b-T (texto num lugar que já existe na peça 7; Logan e Naksu) |
| e | antes de ligar: `select e_prefixo, count(*) from public.obs_archive_absence group by 1;` e 1 linha ausente conferida no B2 | TRAVA M9-3 (5) e Passo 8 |
| f | Phil e Yannis em acordo | Passo 9 |

**O que muda no texto anterior:** D-M9-9 (prova direta) fica **superada** por D-M9-9b; o `snapshots_do`/`snapshots_de` do kit `bd7fe03` (sentinela por snapshot, `lstat` do prefixo dentro de cada snapshot) é **substituído**; o teste do kit "snapshots: algum guarda: 'presente'" sai (a forja não enxerga dentro); o runbook (Tarefa 14, Passo 2, "snapshot que ainda guarda o canal") passa a dizer "os snapshots de antes da remoção ainda não expiraram (14 dias)". A Tarefa 4 continua valendo para o resto da prova de ausência.

## Global Constraints

- **Migration só no dia, e por `npm run db:new manutencao_m9_expurgo`** (Tarefa 10). Até lá o SQL vive em `supabase/rascunhos/m9.sql` (rastreado); os testes o leem por `M9_SQL_CAMINHO` (um só lugar: `apps/web/test/helpers/m9.ts`). O nome leva `_manutencao_` (o teste da M2 reconhece a fase por isso).
- Idempotência: `create table if not exists`, `alter table ... add column if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`. Renomear função da M3b só dentro de `do $$` que confere `to_regprocedure('..._base')` (Tarefa 6).
- Tabelas novas em `public`, RLS ligada, policy de leitura `public.can_edit_site(site_id)`, nenhuma policy de escrita, `revoke all ... from public, anon, authenticated` **e** `revoke insert, update, delete, truncate, references, trigger ... from service_role`; nenhuma chave estrangeira para canal, vídeo ou site (`02` §10.1). Funções novas: `security definer`, `set search_path = ''`, nomes por `format('%I')`, `revoke all on function ... from public, anon, authenticated`; função interna também `from service_role`; `grant execute ... to service_role` **só onde alguém chama como `service_role`** (a rota, e a captura, que as funções `security invoker` da E9 chamam: `supabase.rpc` da server action roda como `service_role`, E9 plano l.1104, l.1279, l.1644-1646; worktree `wt-e9` `_saiu/actions.ts:65`). Prod já tem a 20261014000007 (A5): função nova nasce sem `EXECUTE` para `anon`/`PUBLIC`, e o grant a `service_role` é explícito. **Permissão se testa com `has_function_privilege`, nunca chamando como `anon`/`authenticated`** (SIGSEGV no Postgres local); a exceção é o teste de integração da captura, que faz `set local role service_role` e chama a função da E9 (Tarefa 2).
- **Função da M3b nunca é editada por texto.** As que a M9 precisa mudar (`obs_archive_plan`, `obs_archive_b2_plan`, `obs_archive_removed_channel_list`, `obs_archive_record`, `obs_archive_owner_pending`) são **renomeadas** para `*_base` (as três primeiras) ou **recriadas inteiras** (as outras duas, que a M3b já declara provisórias) e a M9 chama a base e pós-processa o `jsonb` (Yannis I12). Injeção por texto só nas duas funções da E9, que são de outra trilha, e sempre com `raise exception` se a função não existir (`m9_sem_e9`) ou o corpo mudar (`m9_e9_mudou`).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia. Janela: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), nunca 54321; arquivos em série (`--no-file-parallelism`); rascunho aplicado dentro de `begin … rollback`.
- TypeScript strict, sem `any`; Zod na borda (`.safeParse`, nunca `as` em dado de RPC); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho no `staging` (`git add -- <novos>` e `git commit -- <caminhos>`); nunca `git add -A`, stash ou reset. A mensagem termina com a linha de coautoria que o harness do executor mandar (em 14/10: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). **O executor não commita sem o controlador mandar** (brief da onda 2).
- Mexeu em `packages/*/src/`: `npm run build:packages` na hora (este plano não prevê mexer).
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de Modify, `git diff --stat -- <arquivo>`; com mudança alheia, não editar: registrar no ledger `.superpowers/sdd/manutencao-nas/m9-progresso.md` e o controlador decide (mesma regra da M3b-site).
- `.superpowers/` é ignorado pelo git: ledger, LEIAME, arquivos de comandos, saídas e as **cópias guardadas do expurgo** (Tarefa 8) ficam só no disco.
- **NAS e forja: escrita é do dono, sem exceção.** Nenhum agente roda `ssh forja '<escreve>'`, `scp`, `crontab -`, `install`, `mv` ou `systemctl`. O agente prepara ARQUIVO de comandos (curtos, um por linha) em `.superpowers/sdd/manutencao-nas/comandos/` e uma linha curta que o roda, com saída em `.superpowers/sdd/manutencao-nas/saidas/`; nada para colar salvo as exceções do `05` §16 (segredo, linha do cron por `crontab -e`, SQL do painel do Supabase). Leitura `ssh forja '<leitura>'` é permitida. **O script que `obs:arquivo` imprime é rodado pelo dono** (E-D1: `LINHA_DO_DONO`); o comando do Mac também faz leitura do NAS por `ssh forja`, que é leitura. **Apagar snapshot do NAS é decisão do dono**, nunca do agente (Tarefa 0, pré-condição P-M9-1).
- **O sistema falha em VERDE.** Toda tarefa diz o que acontece quando o dado não existe (lista do item vazia, mês sem unidade, arquivo antigo ausente no NAS, função da E9 ausente, captura ausente, variável apagada, interruptor desligado) antes do erro. Nenhuma ausência vira "concluído" sem prova positiva da mesma execução (sentinela no NAS, canário no B2, medição direta dos snapshots).
- Variáveis: `OBS_ARQUIVO` (só `on` liga, M3b), `OBS_ARQUIVO_LIMPEZA_CANAL` (só `on` é "sim"), `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` (só texto). Teste que apaga cada uma e afirma o padrão (já existe para as três na M3b, Tarefa 9; a M9 acrescenta o da tarefa do Blob, Tarefa 13). O **interruptor `obs_archive_m9_interruptor`** (banco, desligado na migration; Tarefa 1) é o outro default que um teste apaga e afirma (Tarefa 6).
- **Erro de rota nunca é engolido:** `500 erro_do_banco` manda a causa ao Sentry (`captureException`/`captureMessage`), como na M3b. A exceção declarada é `mes_destacado_em_transito` na server action da E9: é recusa de regra (frase própria, sem Sentry), Tarefa 11.
- Rota nova em `apps/web/src/app/api/pipeline/` exige `apps/web/src/lib/pipeline/api-registry.ts` (entrada **e** `endpoint_count` do domínio) e `apps/web/data/pipeline-docs/cowork-docs-{domain}.md`. Nunca criar nem revogar chave de pipeline.
- Sem datas-meta. Os únicos relógios são os do dado: 11 h entre as duas conferências do NAS, 24 h de validade da conferência do NAS para liberar o B2, a medição dos snapshots (prova direta, não prazo declarado), 30 dias de versão superada de texto, âmbar 30 e vermelho 60 dias.

## Travas e ordem de execução

- **TRAVA M9-0 (dependências de produção, conferidas na Tarefa 0, por CONTEÚDO e não por commit):** (a) **E9 em produção.** O commit `6c28dc819` já é ancestral de `origin/staging`, então "é ancestral" não prova nada (Yannis I1). O que decide: `git fetch origin && git ls-tree -r --name-only origin/main supabase/migrations | grep _observatorio_a5_e9_` devolve a migration, **e** a leitura de produção (arquivo do dono) `select count(*) from pg_proc where proname in ('competitor_video_purge','competitor_comments_purge')` devolve `2`. **Emenda 23/10 (N-M9-5): a trava (a) está satisfeita** (a E9 está em produção desde 15/10; leitura de 23/10: count = 2, e a terceira, `competitor_channel_purge`, existe); a Tarefa 0 registra a leitura do dia e os três md5 acima como linha de partida, em vez de repetir o argumento do commit; (b) **M3b em produção** ("TRAVA M3b-2 solta" no ledger `m3b-site-progresso.md`) e a Tarefa 7a do plano da forja (script do pipe, `apaga_conferido`) commitada; (c) **M5 em produção** (o bloco "Canais removidos" e a peça 7 na página do Arquivo, que esta etapa completa); (d) **M6** para o gatilho do mês destacado (`mes_destacado_em_transito`); (e) **pedido da M9 à Tarefa 10 da M3b atendido**: a seção "Pedido da M9 para a Tarefa 10" de `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md` (o `unsealed_reason` aceita `'expurgo'`; opcional: `obs_archive_seal` não recalcula os dias de mês fora do banco). A parte 1 do rascunho M9 tem a guarda `m9_m3b_sem_expurgo` e **não** amplia a constraint da M3b por conta própria; (f) **ATENDIDO PELA E9 (emenda 23/10, N9-1/N-M9-2): a E9 em produção já chama `competitor_channel_remove(p_site, p_channel, 'apagar', 'fila', p_actor)` dentro de `competitor_channel_purge`, guardado por `to_regprocedure` (migration `20261015000001`, l.423-429; md5 `02d2a5b5…`); `aviso-a5-m9.md` item 1 fica marcado "atendido pela E9, 15/10". A Tarefa 0 só confere por leitura que o corpo contém `competitor_channel_remove(`. NÃO injetar a declaração de novo: duas chamadas na mesma transação fazem a segunda achar o canal já apagado (`canal_nao_encontrado`) e quebram "Apagar canal". (texto anterior: aviso à A5 atendido, `.superpowers/sdd/manutencao-nas/aviso-a5-m9.md`): `competitor_channel_purge` declara o destino do arquivo antes do `delete`, senão "Apagar canal" da E9 quebra no dia em que a M3b entrar (gatilho `obs_archive_z_destino_declarado`, `m3b.sql:2468-2488`). Sem (a) a Tarefa 2 não começa; a parte 1 tem a guarda `m9_sem_e9`. Sem (b) nada da Tarefa 1 em diante vai ao banco local com a M3b aplicada. Sem (c) a Tarefa 12 não começa. Sem (d) o teste do mês destacado fica `skip` com o motivo escrito. Sem (e) a Tarefa 1 para na guarda. Sem (f) [já satisfeito] o teste de `competitor_channel_purge` fica `skip` e o interruptor não liga. **(g) (emenda 23/10, N9-2 e N9-3, DECIDIDO pelo dono 23/10)** a limpeza de `yt_watch_*` (D-M9-25) é feita **dentro da M9** (Tarefa 2), nas três funções da E9, sem pedido à A5, então não há espera por terceiros; a recusa D-M9-26 (no servidor, enquanto a M9 não está ligada) é critério de aceite da M3b: sem ela, `OBS_ARQUIVO` não liga.
- **TRAVA M9-1:** nenhum arquivo `*_manutencao_m9_*` em `supabase/migrations/` antes da Tarefa 10, Passo 1. O teste `m9-trava.test.ts` (Tarefa 1) a segura.
- **TRAVA M9-2:** nenhuma linha das Tarefas 11, 12 e 13 (rota nova, tela, tarefa do Blob) e nenhuma mudança de `VERSAO_PENDENCIAS` para `2` antes de a migration estar aplicada em produção e conferida (linha "TRAVA M9-2 solta em <data hora>" no ledger). Parte mecânica (Tarefa 1): enquanto não houver `*_manutencao_m9_*` em `supabase/migrations/`, o teste exige que `apps/web/src/app/api/pipeline/archive/expurgo` não exista e que `pendencias.ts` tenha `VERSAO_PENDENCIAS = 1`; com a migration presente o teste exige o contrário do rascunho (Tarefa 10, Passo 3). Motivo (P47): o leitor estrito (E-D5) na `versao 2` com a função ainda na `versao 1` faz o `obs:arquivo` sair com código 1 e a peça 7 mostrar "não medido".
- **TRAVA M9-3 (interruptor):** `select public.obs_archive_m9_ligar('<site>', true)` é do dono, por SQL do painel, **só depois** de: kit novo instalado (Tarefa 9), rotas e leitor `versao 2` no ar (Tarefa 11), pré-condição P-M9-1 dos snapshots lida (Tarefa 0, Passo 4) e a decisão do dono sobre o snapshot órfão registrada no ledger. **Emenda 29/10 (M9-snap), pré-requisitos acrescentados:** (4) a (7), no sub-item "Pré-requisitos de ligar, em ordem" logo abaixo (Yannis M5). **Ordem:** 9b (código → migration) → **o dono instala o kit uma vez só** (o kit da Tarefa 9 `bd7fe03` não é instalado sozinho; vai junto, já com a 9b) → o dono liga o interruptor. Desligado, o site manda `prefixos_ausentes = []` ao copiador e ao B2 e os tempos `apagar_antigas` e `conferir_b2` viram `sem_comando` com `falta 'm9_desligado'`: o kit antigo (que só aceita lista vazia) continua verde. Escolha registrada (Yannis I4): a "capacidade anunciada" é o próprio interruptor, não um campo `kit:'m9'` no `attest`.
  - **Pré-requisitos de ligar, em ordem (Phil I1, lote 2, 29/10), todos antes de `obs_archive_m9_ligar(true)`:** (1) o conserto C1 (formato do `alvo`: `alvo:<n>`, `canal:<uuid>`, `antiga:<uuid>`, nos leitores `RespostaPlano`, `RespostaPlanoB2` e `lerPendencias`) **em produção** e o teste `manutencao-m9-leitores-ts.test.ts` verde; (2) o kit da Tarefa 9 instalado na forja (o kit antigo só aceita `prefixos_ausentes` vazio e quebra no primeiro item); (3) `select public.obs_archive_m9_captura_presente();` = `t` (a função de ligar já recusa sem a captura, mas não sabe a versão do kit). **Emenda 29/10 (M9-snap):** (4) **Tarefa 9b instalada (snapshots por tempo)**: código do site no ar, migration `manutencao_m9_snap_por_tempo` aplicada, kit da 9b instalado; (5) a leitura `select e_prefixo, count(*) from public.obs_archive_absence group by 1;` e, havendo linha ausente, 1 conferida no painel do B2 (Tarefa 9b, Passo 8); (6) Phil e Yannis em acordo sobre a 9b; (7) **leitura do dono no NAS** de `midclt call replication.query` e `midclt call pool.snapshottask.query`, registrada no ledger: nenhuma replicação dos datasets `site-arquivo/{numerico,texto}` e uma só tarefa de snapshot (`auto-%Y-%m-%d_%H-%M`, 14 dias) por filho; havendo replicação (cópia que nenhuma regra vê) ou tarefa recursiva no pai, o interruptor não liga até a regra cobrir (decisão do dono; Phil e Yannis I3). Caminho de volta do código: `comandos/m9-emergencia.sql` (Yannis I3).
- **Ordem do deploy (P47):** migration (interruptor desligado) → rotas e leitor `versao 2` (Tarefa 11) → kit da forja instalado pelo dono (Tarefa 9) → interruptor ligado pelo dono → tela (Tarefa 12) → `OBS_ARQUIVO_LIMPEZA_CANAL=on` na Vercel (Tarefa 14). Entre o código no ar e a variável, a tarefa do Blob não tenta nada e a linha da tela diz "a limpeza das imagens espera o comando de limpeza ser ligado" (Tarefa 13). A fase `copiar` (Mac lê, filtra e registra; o dono grava em `_recebendo`; o copiador recebe) funciona **antes** do interruptor, com o kit antigo.

## O que já existe (lido em 14/10; arquivo e linha)

| Fato | Fonte |
|---|---|
| `competitor_removed_items` em produção: `id bigint`, `site_id`, `kind in ('video','canal','comentario')`, `youtube_id`, `competitor_channel_id uuid` sem FK, `decided_at`, `rows_deleted jsonb`, `blobs_pending text[]`, `archive_pending boolean default false`, `purge_count`, `returned_*`; `unique (site_id, kind, youtube_id)`. Um vídeo é uma linha (`youtube_id` = id do YouTube); **um comentário é uma linha por comentário** (`youtube_id = youtube_comment_id`) | `supabase/migrations/20261012000002_observatorio_a5_e1_campos_sinalizadores_raw.sql:128-149`; E9 plano l.1279-1351 |
| A M3b acrescenta `competitor_removed_items.archive_note text` (D15) e `obs_archive_mark_purged` conclui os itens de vídeo/comentário de um canal apagado inteiro com `archive_note = 'canal apagado inteiro'`; **não toca** `obs_archive_item_targets` (a M9 fecha os alvos pelo gatilho da Tarefa 4, Yannis I7) | `supabase/rascunhos/m3b.sql:2384-2398` |
| E9: `competitor_video_purge` (variáveis locais `v_channel` e `v_yt`; âncora `delete from public.competitor_videos v where v.id = p_video;`; o `insert` em `competitor_removed_items` vem **depois**) e `competitor_comments_purge` (`v_alvo` = pedidos, `v_todos` = pedidos mais respostas; o `insert ... as r` vem **antes** do `delete ... k.id = any(v_alvo);`); `competitor_channel_purge` **já declara** o destino (chama `competitor_channel_remove(..., 'apagar','fila', ator)`, emenda 23/10); as três são `security invoker`, chamadas como `service_role`. **Fonte do SQL (emenda 23/10): a migration `20261015000001` em `origin/staging` (funções l.267-470 e 473-560) e, para `competitor_comments_purge`, a migration `20261018000002` (F2), nunca o Apêndice A nem o `wt-e9`. Constantes de produção (md5 de `prosrc`, 23/10): vídeo `8c6d51b2ae774671c2fa15c3e8d48535`, comentários `2233c4edb3613594ed363ed68eb2378a`, canal `02d2a5b50a930a06ff2bc523226a0697`** | `docs/superpowers/plans/2026-10-13-a5-e9-fila-sairam-do-youtube-plan.md:1100-1182, 1187-1270, 1279-1351`; critério `apagando_ha_mais_de_1d` l.1559-1562 |
| `obs_archive_units` (origem `'rota'`/`'expurgo'`, `received_at`, `nas_attested_at`, `superseded_at`, `purged_at`, `lost_at`, `parts`, `sha256_bytes`; `check (row_count = 0) = (sha256_bytes is null)`); `obs_archive_months` (`unsealed_reason` só `'conteudo_mudou'`, `'mudou_no_destaque'`, `'unidade_nova'`; `days_measured`, `days_in_month`); `obs_archive_summaries` (**sem** coluna `origem`; `received_papers text[]`; `check (empty = (canal_sha256 is null))`) | `m3b.sql:59-133, 193-203, 408` |
| `obs_archive_record_core(p_site, p_kind, p_payload, p_origem)`: trava `pg_advisory_xact_lock(hashtextextended(site\|kind\|classe\|tabela\|canal\|mês, 0))` (l.613); com origem `'expurgo'` grava sempre a versão seguinte e é a única exceção a `canal_removido`, `mes_aberto`, `mes_fora_do_banco`, `nao_devida`, `unidade_retirada`; **não** reabre o selo do mês (só `v_novo_par`, l.686-690); o `kind 'resumo'` recusa mês fora do banco (`ja_no_arquivo`, l.696); `obs_archive_insert_guard` (l.575-599) deixa inserir unidade/resumo de mês retirado só se `current_user` é o dono da tabela **e** o GUC `obs_archive.origem = 'expurgo:' \|\| pg_current_xact_id()` | `m3b.sql:575-722` |
| `obs_archive_record` é uma casca de **uma linha** (`language sql`), com `grant` a `service_role`; a M9 a recria em `plpgsql` com a guarda `expurgo_em_curso` | `m3b.sql:724-731` |
| `obs_archive_receive` trata `u:`, `p:`, `s:<id>:<papel>` (usa `received_papers`; `received_at` só quando todos os papéis chegaram), `m:` (chama `obs_archive_seal` com json e sha256 recebidos), `a:`; `attest_nas` com `ausente` em unidade **não recebida** só grava `absent_first/last` | `m3b.sql:887-1038, 1268-1440` |
| `obs_archive_seal` recalcula `days_measured`/`days_in_month` da tabela **online** (mês retirado zeraria); `manifest_rows` não recusa mês retirado mas exige `pending_units` vazio e resumo corrente com `unit_hashes = obs_archive_channel_unit_hashes(site, class, canal, mês)` (a função da l.769-775, que a M9 usa; nunca agregar à mão) | `m3b.sql:769-775, 821-886, 1140-1205` |
| `obs_archive_plan(uuid, boolean, text)` devolve `plano_id, gerado_em, modo, cursor_seguinte, primeira_selagem, vermelhos, canario, exportar, resumos, manifestos, aguardando_dono, a_apagar, reconferir` e `'prefixos_ausentes', '[]'::jsonb` (l.2377). `aguardando_dono` só traz canal removido/inexistente ou mês fora do banco **com** `nas_withdrawn_at`; `manifestos` exige `sealed_at is null or unsealed_at is not null` e exclui mês retirado. `obs_archive_b2_plan(uuid, boolean, text)` devolve `prefixos_ausentes` (l.1761). `vermelhos` são **texto livre** (a M3b acrescenta `vermelhos_remocao` do mesmo jeito, l.2176) | `m3b.sql:2248-2383, 1650-1766, 2101-2181` |
| `competitor_channel_remove` insere a declaração com `declared_xid` e chama `obs_archive_mark_purged` antes do `delete`; o gatilho `obs_archive_z_destino_declarado` exige a declaração **sempre**; `removed_via in ('botao','fila','e10_export','vigia')` | `m3b.sql:2439-2488` |
| `obs_archive_removed_channel_list` devolve por canal `estado` (`sem_destino`/`sem_arquivo`/`guardado`/`pedido`; `sem_arquivo` antes de `pedido` no `case`), `nas_absent_at`, `b2_absent_at`, `snapshots_clear_on`, `reappeared_*`, `online_thumbs_known`, `thumbs_unknown_ack_at`, `blobs_pendentes`, `youtube_channel_id`; **não** devolve `completed_at` | `m3b.sql:2547-2586` |
| `obs_archive_owner_pending` (C12) só emite `sem_comando`, `versao 1`, `stable`; o comentário manda a M9 recriá-la com os outros tempos e `versao 2` | `m3b.sql:2709-2746` |
| Leitor estrito `pendencias.ts`: `LINHA_DO_DONO`, `VERSAO_PENDENCIAS = 1`, `TEMPOS_PENDENCIA` (5 tempos), `Apagar = {filho, caminho, sha256, nova}`, `b2_nomes` só em `apagar_antigas` | `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts:11-104` |
| C10 reserva à M9 `prefixos_ausentes` e `prefixo_ausente`/`prefixo_presente` no `attest` (na M3b: `400 VALIDATION_ERROR`); C13: a linha "Segredo" manda a M9 rever, no commit do `versao 2`, o fato de `apagar`/`b2_nomes` saírem preenchidos | `contrato-rotas-m3b.md:292-294, 317-333` |
| D-F25: `copiar` recusado (código 1) até a M9; a M9 reaproveita `apaga_conferido` no mesmo commit do `versao 2`. D-F23: `stdout` só o script, `escreverTudo` | `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-forja.md:5186-5188` |
| `estado-remocao.ts`: `EstadoRemocao` já tem `apagado_nas`, `apagado_b2`, `concluido`; `IDADE` (pedido 30/60, nas 30/60, B2 15 depois dos snapshots, 30 sem snapshots, blob 14/30); `capacidades.ts`: `BLOCO_CANAIS_REMOVIDOS = false` (a M5 liga) | `arquivo-mensal/estado-remocao.ts:5-35`, `capacidades.ts:7-11` |
| Serialização TS: `serializarLinhas` (`arquivo/exportar.ts:54`), `serializarResumo` (`arquivo-mensal/resumo.ts:36`), `montarManifesto` (`manifesto-mensal.ts:32`), `lerCsv`/`linhaCsv` (`arquivo/csv.ts`), caminhos `caminhoDaUnidade/Parte/Resumo/Manifesto` (`caminho.ts:21-36`) | arquivos citados |
| Resumo: conta por vídeo e por canal | `m3b.sql:1073-1137`; `obs_archive_unit_source` l.310-355 (`$1` site, `$2` canal, `$3` mês, `$4`/`$5` mês em SP com `-03`, `$6` mês seguinte; aliases `t`, `p`, `k`) e `obs_archive_table_exprs` l.787-806 (a Tarefa 2 reaproveita os dois para contar as linhas do item) |
| Kit (git local `~/Workspace/forja/ferramentas/arquivo/`): `comum.config` só tem `escrita` (`ARQ_MONTAGEM_ESCRITA`, comum.py:~429); `estado_filho(raiz_escrita, filho, eh_montagem)` mede montagem e sentinela; `validar_plano` do copiador exige `prefixos_ausentes == []` (copiar.py:468) e o do B2 também (conferir.py:99); `RE_QUARENTENA = ^.+\.(\d{14})$` e `_recebendo/_quarentena/<caminho>.<carimbo>` (copiar.py:33-34, 440-460; restaurar_do_b2.py:50); `nome_b2(conf, filho, relativo, sufixo)` (b2.py:68-69); `B2.versoes(nome)` filtra o nome **exato** (b2.py:127-132); sufixo `ARQ_B2_SUFIXO`, padrão `.bin` (conferir.py:373); `filename_encryption off` | arquivos citados |
| `competitor_removed_items.archive_pending` é lido pela condição 10 da E9 (`apagando_ha_mais_de_1d`, plano E9 l.1559-1562) e `codigoDoBanco` da E9 só olha `code` (`saiu/responder.ts:29`; `CodigoDeErro` em `saiu/modelo.ts:23`) | migration `20261015000001` em `origin/staging` (E9 já em produção: `saiu/responder.ts:30-31,49` e `saiu/modelo.ts:22,167` já mapeiam `mes_destacado_em_transito`; `competitor_missing_proof` já usa só `blobs_pending`, l.766-767) |

## Decisões desta etapa (com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D-M9-1 | **A lista do item** vive numa tabela nova, `obs_archive_item_targets`, **uma linha por unidade (classe, tabela, canal, mês), tipo (`video`/`comentario`) e geração**, gravada **antes** da cascata por `obs_archive_item_capture`, chamada de dentro das funções de apagar da E9 (injeção por texto só nelas, com `m9_sem_e9`/`m9_e9_mudou`). Itens do mesmo tipo na mesma unidade **fundem** `item_refs` e `keys` no alvo que ainda está em `copiar`/`bloqueado`; se o alvo já foi além, nasce a geração seguinte (Phil C3, Yannis C3). `item_id` é o menor `competitor_removed_items.id` que casa (representante da tela). O spec diz "grava em `competitor_removed_items`"; a tabela separada guarda o mesmo dado sem mudar a forma da linha da E9 | `02` §11.3 item 2 |
| D-M9-2 | `archive_pending` passa a ser **derivado por chave**: gatilho `before insert or update` em `competitor_removed_items` liga a coluna quando existe alvo aberto do mesmo tipo com o `youtube_id` em `item_refs`; `obs_archive_item_advance` a desliga com `archive_note = 'arquivo limpo'` quando o último alvo que contém a chave conclui; `obs_archive_reabrir` a religa. Nada de "mesma transação" nem de `item_key` por canal | Phil C3 (bandeira por chave); Yannis m3 |
| D-M9-3 | **Toda versão nova sai do Mac**, pela serialização TypeScript. O site nunca reexporta nem refaz o resumo de um (classe, canal, mês) com alvo em `copiar`, `aguardando_nova` ou `bloqueado`: `obs_archive_plan` (wrapper) **filtra** `exportar` e `resumos` desses grupos e `obs_archive_record` (wrapper) responde `expurgo_em_curso` (Tarefas 2 e 6). Alvo `bloqueado` entra na guarda: sem isso o site reexportaria e perderia o item | `02` §11.3; Phil C3 |
| D-M9-4 | **O Mac lê a versão antiga do NAS** pela montagem de **leitura** (`ro`) da forja, `ssh forja 'cat -- /mnt/arquivo/leitura/<filho>/<caminho>'`, **depois** de provar `mountpoint -q` e a sentinela `.arquivo-vivo` do filho; sem a prova, o comando para sem bloquear nada ("NAS fora; nada feito"). Confere o sha256 contra o registro **e** o `hashConteudo` das linhas lidas contra `obs_archive_units.hash_conteudo`; diferente: `bloqueado` (`antiga_divergente`); ausente: `antiga_ausente`. Desvio declarado ao spec (que lia do B2): a chave do cofre mora na forja (D-F2) e o Mac não guarda credencial | Phil I6 |
| D-M9-5 | **`owner_pending` vai à `versao 2`**, **só lê** (`stable`): quem avança os estados são o plano do copiador, o plano do B2, o `attest` e o `record`. Campos novos: `falta` (por que um `sem_comando` espera), `motivo` (de um `bloqueado`), `bloqueados` (quantos alvos do item estão bloqueados; `copiar` vence `bloqueado` no tempo, Yannis I7), `prefixos`. `FALTAS` = `unidade_no_nas`, `b2_nova`, `resumo`, `manifesto`, `versao_em_curso`, `segunda_conferencia`, `snapshots`, `conferencia_nas_recente`, `b2_sync`, `blobs`, `imagens`, `lote_e10`, `so_prefixo`, `m9_desligado`. Sai `retencao` (D-M9-9 foi trocada). Leitor, script e função mudam no mesmo commit da Tarefa 7 | C12; E-D3/E-D5; Yannis m2 |
| D-M9-6 | **O tempo `copiar` é feito pelo próprio `obs:arquivo`**: para cada item em `copiar`, o Mac prova o NAS, lê, filtra, serializa, registra pela rota nova e só então imprime o bloco `grava_recebendo`. A cópia fica guardada em `.superpowers/sdd/manutencao-nas/copias/<sha256>.gz` (0600) e é **reemitida** enquanto o alvo estiver em `aguardando_nova` com a nova ainda sem `received_at` (script perdido não trava o alvo, Yannis I9). `expurgar --item <id>` faz o mesmo para um item; `--apagar-antigas` imprime só o tempo de apagar | E-D1; item 66 |
| D-M9-7 | **Rota nova `POST /api/pipeline/archive/expurgo`** com a chave `archive_owner` (passos: `abrir` devolve os grupos de um item com caminhos, sha256 e as unidades "outras" do mesmo mês; `registrar` grava unidades e resumo; `bloquear`; `canal`). Recusas de regra (`base_mudou`, `contagem_divergente`, `resumo_com_unidade_nao_lida`, `expurgo_em_curso`...) voltam como `409 { erro }` **sem derrubar o lote**: o Mac isola por grupo. O manifesto **não** passa por ela: é refeito pelo fluxo de selagem da M3b (Tarefa 5 faz o mês voltar ao ciclo). A chave do dono passa a **registrar** versão (nunca apagar, nunca ler conteúdo) e a linha "Segredo" do C13 diz o risco: a chave de ARQUIVO pode registrar versão que o dono depois grava | C13 l.330; Yannis m9 |
| D-M9-8 | **Prova de ausência** em `obs_archive_absence`, por (alvo, filho, prefixo), com colunas tipadas (`canal_ref`, `alvo_id`, `unidade_id`) e índice parcial das linhas abertas. NAS: `ausente` só com montagem e sentinela do filho (C7.1), conta depois de **duas** execuções com ≥ 11 h, e o copiador pergunta também `_recebendo/<prefixo>` e `_recebendo/_quarentena/<prefixo>` (Phil I5). **Presente só reabre se a linha já tinha `*_absent_at`**; antes disso só zera o primeiro marco (presença normal não é reaparecimento, Phil I2). B2: zero versões de **qualquer** ação (versão escondida = presente), com controle negativo e canários bons na **mesma** execução (C7.2); o nome do B2 volta do `conferir-b2` no próprio `attest` (`b2_nomes`), e `nome_b2.py` e `b2_painel` por tradução saem | `02` §11.3; C10; Yannis I4 |
| D-M9-9 | **SUPERADA pela D-M9-9b (emenda 29/10, M9-snap: snapshots por tempo; pela NFS da forja o snapshot aparece vazio).** **Snapshots por prova direta** (Phil I1), não por retenção declarada: o copiador mede `<leitura>/<filho>/.zfs/snapshot/*/<prefixo>` (só para linhas com `nas_absent_at`, que o plano marca com `provar_snapshots`), o `attest` traz `snapshots: 'ausente'\|'presente'\|'indisponivel'` e `snapshot_mais_antigo`; o site grava `snap_absent_at`/`snap_oldest`/`snap_checked_at`. `snapshots_clear_on` passa a ser a data (SP) do `snap_absent_at` quando **todos** os prefixos do canal foram medidos ausentes. O B2 só é perguntado depois da prova; item e canal só concluem com ela. Sai `obs_archive_snapshot_retention` e `obs_archive_registrar_retencao_snapshot`. A pré-condição P-M9-1 (snapshot órfão de 96 dias) é lida na Tarefa 0 e a decisão de apagá-lo é do dono | Phil I1; `decisoes-dono-14-10.md` |
| D-M9-10 | **Canal:** o `obs:arquivo` apaga arquivo a arquivo (`apaga_conferido`, sha256 do registro) e remove diretório vazio do prefixo; `expurgar --canal <ref>` grava o arquivo de comandos do `05` §16.10 (`rm -r --one-file-system` por prefixo derivado, mais `_recebendo/<prefixo>` e `_recebendo/_quarentena/<prefixo>`) e imprime a linha `ssh forja 'bash -s' < '<arquivo>' > '<saida>' 2>&1`. Canal sem arquivo conhecido só tem o segundo caminho (`falta 'so_prefixo'`, Phil I4). O gatilho de "Apagar canal" **fecha os alvos abertos do canal** (`concluido`, `motivo_fim = 'canal_apagado'`) e encerra suas linhas de ausência (Phil C6, Yannis I7) | item 161; §16.10; E-D1 **Nota de 30/10 (M9b):** `expurgar --canal` não será construído (Decisão 1); o `obs:arquivo` limpa canal e `_recebendo/`, `RESTA` para o que não conhece. Ver `2026-10-30-manutencao-nas-m9b-canal.md`. |
| D-M9-11 | **Lote da E10:** `concluido` exige que não exista linha de `obs_archive_batches` do `channel_ref` com `deleted_at` e `closed_at` nulos; o bloco diz "há lote exportado à mão deste canal; apague-o onde você o guardou e encerre-o na E10". Canal sem arquivo conhecido conclui, mas a lista mapeia `concluido` **antes** de `sem_arquivo` (Yannis m7) | `02` §11.3 |
| D-M9-12 | **"Já rodei"/"Desfazer"** gravam `marcado_rodado_em` (`item:` ou `canal:`; `antiga:` fica fora) por server action com `requireSiteAdmin`; não mudam estado. A reconferência que ainda acha o arquivo devolve o item à lista em âmbar (item 111) | `04` §14.7; Yannis m6 |
| D-M9-13 | **Blob:** a tarefa diária `tamanho_do_banco` retenta também `obs_archive_channel_removals.blobs_pending`, **só** com `OBS_ARQUIVO_LIMPEZA_CANAL=on` | P47; `04` §14.3 **Nota de 30/10 (M9b):** a tentativa diária dos blobs passa à variável própria `OBS_ARQUIVO_LIMPEZA_BLOBS`, desligada; só liga o controlador, com o "pode" do dono, em `apagado_b2` (Decisão 2). |
| D-M9-14 | **Classe `video_antigo`** entra na lista **só no mês de `archive_frozen_at` do vídeo** e, até a M10b, nasce `bloqueado` com `depende_m10b` | `02` §11.3; `m3b.sql:1083` |
| D-M9-15 | **O alvo só é devolvido pelo `open` se a unidade de origem é a mais nova e está recebida** (e nenhuma unidade corrente do grupo está sem receber); senão `sem_comando` com `falta 'versao_em_curso'`. `record` confere de novo sob a **mesma trava do `record_core`** e recusa `base_mudou`. A captura pega a mesma trava (por classe, tabela e mês, em ordem) e parte da **maior versão não perdida nem purgada, recebida ou não**; unidade mais nova vazia: sem alvo (declarado) | Phil C3; Yannis C2 |
| D-M9-16 | **A versão nova chega a `recebida`**: o plano (wrapper) acrescenta a `aguardando_dono` as unidades `origem 'expurgo'` sem `received_at` e os papéis `s:<id>:<papel>` do resumo do expurgo, e a `manifestos` os meses com `unsealed_reason 'expurgo'` mesmo retirados; o copiador as acha em `_recebendo` pelo `aguardando` que já existe. `item_advance` só libera o apagar com a unidade, o resumo e o manifesto **recebidos depois**, atestados e no B2 | Phil C2 |
| D-M9-17 | **Versão nova vazia é válida**: `nova_caminho` e `nova_sha256` ambos nulos (o `check` da tabela); o passo "nova pronta" trata `row_count = 0` como pronta (não exige `nas_attested_at` nem B2); resumo: a versão anterior de **cada papel** entra na lista de apagar mesmo se o papel novo ficou vazio | Phil C4 |
| D-M9-18 | **Contagem antes da cascata**: a captura grava `esperadas` (linhas do item no online, por SQL dinâmico sobre `obs_archive_unit_source`/`table_exprs`; `null` se o mês já saiu do banco ou a unidade está defasada do online). `removidas = 0` com `esperadas > 0`, ou `removidas > esperadas`: `contagem_divergente` (o alvo fica bloqueado, à vista). Mês fora do banco: `sem_linhas` permitido (declarado) | Yannis C2 (leitura do filtro) |
| D-M9-19 | **Resumo refeito do que o Mac leu**: o `open` devolve `outras` (unidades correntes do grupo que não são alvo, **com linhas e arquivos**) e `vazias`; o Mac lê todas e manda `resumo.tabelas_lidas`; `record` recusa `resumo_com_unidade_nao_lida` se o conjunto não bate. O `unit_hashes` é gravado pelo servidor com `obs_archive_channel_unit_hashes(...)` **depois** de registrar todas as unidades do grupo | Phil I8, I10 |
| D-M9-20 | **Interruptor** `obs_archive_m9_interruptor` (desligado na migration; `obs_archive_m9_ligar` é do dono). Ligado exige `obs_archive_m9_captura_presente()` (as duas funções da E9 com a captura no corpo); sem ela o plano acrescenta o vermelho `captura_ausente` | Yannis I2, I4; Phil I3 |
| D-M9-21 | **Guarda permanente** contra a E9 (ou outra migration) recriar `competitor_video_purge`/`competitor_comments_purge` **sem** a captura: teste de repositório (`m9-guarda.test.ts`) varre as migrations posteriores à da M9, e a captura ausente vira vermelho no plano (D-M9-20). O mesmo teste cobre quem recriar as funções `*_base` | Yannis I2 |
| D-M9-22 | **Cópias do expurgo no disco do Mac** (`.superpowers/sdd/manutencao-nas/copias/<sha256>.gz`, modo 0600) e teto **total** por execução, não só por arquivo; ssh com `ControlMaster`; temporário de `grava_recebendo` em `$M/$1/.m9-tmp/` (fora de `_recebendo`, que o copiador varre) | Yannis I9, m1, m8 |
| D-M9-23 | **(Reescrita 23/10, Phil N9-1, Yannis N-M9-2)** A E9 **já fez** as duas mudanças: `apagando_ha_mais_de_1d` olha só `blobs_pending` (`competitor_missing_proof`, migration l.766-767) e `saiu/responder.ts`/`modelo.ts` mapeiam `mes_destacado_em_transito` sem Sentry. A M9 não pede nem edita nada disso; a Tarefa 11 só afirma o existente por teste e, se a frase da M9 diferir da da E9, troca a **frase** em `modelo.ts:167` (sem criar mapeamento em duplicata) | Yannis I5, I6; Phil N9-1 |
| D-M9-24 | **`obs_archive_item_capture` tem `EXECUTE` para `service_role`** (as funções da E9 são `security invoker` e rodam como `service_role`; o `revoke` do plano antigo derrubava "apagar") e a permissão tem teste que roda a função da E9 como `service_role` | Phil C1, Yannis C1 |
| D-M9-25 | **(Emenda 23/10, Phil N9-2; DECIDIDO pelo dono 23/10: SIM, dentro da M9; uma migration, um teste, isolamento por `site_id`)** `competitor_video_purge` e `competitor_channel_purge` da E9 não limpam `yt_watch_alvos/thumbs/readings` (S4, 18/10; chave `(site_id, youtube_video_id)`, sem FK, fora da cascata), então "apagado" deixa dado do vídeo no banco e a prova de ausência da M9 não o vê. **A M9 faz, na Tarefa 2 (bloco `do $m9$` que já recria as funções da E9), nas TRÊS funções que a E9 tem** (Yannis C-E): (1) `competitor_video_purge`: antes da âncora `delete from public.competitor_videos v where v.id = p_video;`, três `delete`, nesta ordem (readings, thumbs, alvos, como a F1 em `20261021000002` l.274-278 e 700-704), `where site_id = p_site and youtube_video_id = v_yt` (aqui `v_yt` é o id do **vídeo**); (2) `competitor_channel_purge`: antes do `if to_regprocedure('public.competitor_channel_remove(uuid,uuid,text,text,uuid)') is not null then`, os mesmos três `delete`, mas a chave **não é `v_yt`**: no canal `v_yt` é o id do **canal** (`select c.channel_id ... into v_yt`), copiá-lo apagaria zero linhas; a chave é `= any((select coalesce(array_agg(v.video_id), '{}'::text[]) from public.competitor_videos v where v.competitor_channel_id = p_channel))`, calculada **antes** da cascata (Phil M9-C2); (3) `competitor_comments_purge`: **não se aplica** (conferido: não apaga vídeo e não toca `yt_watch_*`; só a captura da D-M9-1 entra nela). Nas duas primeiras, o vídeo compartilhado fica de fora como na F1 (`obs_f1_video_compartilhado`): não se apaga a watch de um `youtube_video_id` que ainda é observado por outro canal do mesmo site, nem se há alvo `tipo <> 'concorrente'` (teste nosso) para ele. Os `delete` entram como `with d as (delete ... returning 1) select v_rows || jsonb_build_object('<tabela>', count(*)) into v_rows from d;` (o `v_rows` não precisa de variável nova), então `rows_deleted` passa a trazer as três contagens. **md5:** o do vídeo e o dos comentários são os do corpo instalado **antes** da M9 (não mudam: nada fixa o md5 depois da injeção; o "antes" de 23/10 vale); a função do canal entra com o **seu** md5, `<<MD5_CANAL>>` (partida `02d2a5b5…` em 23/10). Marcador "já injetada": **um por função e por efeito** (`obs_archive_item_capture` para a captura; `yt_watch_readings` para a limpeza da watch). Teste na Tarefa 2: estende `service_role_apaga_video_e_comentarios` e `service_role_apaga_canal` (alvo, thumbs e readings semeados; chamada como `service_role`; 0 linhas nas três tabelas; o mesmo `youtube_video_id` de **outro** `site_id` intacto; `rows_deleted` com as contagens; `security invoker` e a assinatura de 6 argumentos nas duas) | Phil N9-2, Yannis C-E |
| D-M9-25b | **(Emenda 23/10, Yannis N-M9-3; decisão: Phil)** `keys` guarda ids de comentário de espectador (F2) só **enquanto o alvo está aberto**: ao ir a `concluido`, `sem_linhas` ou (gatilho do canal) `concluido` com `motivo_fim = 'canal_apagado'`, um gatilho `before update` faz `keys = '{}'` e guarda a contagem em `keys_n` (coluna nova `integer`); nenhuma tela nem log lê `keys`; `esperadas` do alvo conta as respostas de espectador (senão `contagem_divergente` bloqueia todo comentário com resposta). Regra escrita também na linha "Segredo/privacidade" do C13 (Tarefa 7). O `check` de `keys` passa a `cardinality(keys) <= 20000` com o mínimo de 1 só para alvos abertos | Yannis N-M9-3 |
| D-M9-26 | **(Emenda 23/10, Phil N9-3; DECIDIDO pelo dono 23/10: opção (a), recusa no servidor, critério de aceite da M3b)** Vídeo ou comentário apagado na E9 entre o início do export da M3b e a M9 ligada ficaria no NAS e no B2 sem lista (a captura só existe a partir da migration da M9; o back-fill existente é só de canais). Por isso as funções SQL `competitor_video_purge` e `competitor_comments_purge` **recusam no SQL** (rodada 0.8, Yannis N7-3): efeito `recusa` injetado na Tarefa 2 (bloco `do $m9$`, **antes** da captura), que chama `obs_archive_m9_pronto(p_site)`; o helper (SQL, `security definer`, `stable`) lê o **banco**, não o env: levanta `P0001 m9_desligada` (hint "o apagar do arquivo ainda não está ligado; espere") quando `exists (select 1 from obs_archive_units where site_id = p_site)` (a M3b já exportou algo) e `not obs_archive_m9_ligado(p_site)`; senão retorna (sem unidades, M3b fora do ar, apaga). Vale também para a chave `service_role` chamando direto (cowork/MCP). **A trava sai sozinha ao ligar:** `obs_archive_m9_ligar(site, true)` torna o helper inerte; nenhuma reescrita de função depois, nenhum item de remoção. As ações `apagarVideo`/`apagarComentarios` só traduzem o `P0001 m9_desligada` para a frase (podem recusar antes também, mas a garantia é do SQL). Testes (Tarefa 2, 5 casos com mutante) em `manutencao-m9-captura.test.ts`. **Critério de aceite da M3b:** sem a guarda, `OBS_ARQUIVO` não liga (Hanna). `m9-guarda` ganha a lista dos chamadores das funções `purge` e afirma que as duas trazem `obs_archive_m9_pronto`. Gatilho para a opção (b) (reconstruir a lista por `youtube_id`, linha `sem_lista`): a M9 passar de ~jan/2027 ou os apagamentos serem frequentes. Hoje o risco é zero (0 itens, M3b fora do ar) | Phil N9-3 |

## Review Focus

1. **Item apagado com mês já destacado ou descartado (só no NAS e no B2):** a pessoa espera que a única cópia antiga só saia depois de a nova estar **recebida**, atestada no NAS e conferida no B2 (unidade, resumo e manifesto). Testes: `antiga_so_sai_depois_da_nova_conferida` e `apagar_antigas_recusa_sem_b2_ok` (Tarefa 5); `versao_nova_chega_a_recebida` (Tarefa 6).
2. **Reaparecimento × presença normal:** arquivo que volta ao NAS ou ao B2 **depois de** `*_absent_at` reabre o item ou a remoção; presença antes disso não é reaparecimento. Testes: `prefixo_presente_reabre_e_conta` e `presenca_normal_nao_reabre` (Tarefa 4).
3. **Script cortado ou rodado duas vezes:** rodar de novo não apaga a versão nova nem falha (`JA-APAGADO`, `JA-GRAVADO`); script perdido: a cópia guardada é reemitida. Testes: `script_duas_vezes_idempotente` (Tarefa 7), `copia_guardada_reemitida` (Tarefa 8).
4. **Snapshot, canário ruim, NAS desmontado:** nenhuma ausência vira prova sem sentinela, canário, controle negativo **e medição direta dos snapshots**. Testes: `ausente_sem_sentinela_nao_conta`, `b2_sem_canario_nao_conta`, `snapshot_presente_segura_o_b2` (Tarefa 4).
5. **Item em vários meses, dois itens na mesma unidade e contagem que não fecha:** a versão nova tem de ter `antiga − linhas do item`; chaves fundem no alvo aberto; um filtro que não achou o item com `esperadas > 0` bloqueia. Testes: `dois_itens_mesma_unidade_fundem`, `segundo_lote_de_comentarios_gera_geracao`, `registrar_recusa_contagem_errada` (Tarefas 2 e 3), `filtro_sem_linhas_conclui_sem_versao` (Tarefa 6).
6. **"Apagar" da E9 continua funcionando depois da migration:** `competitor_video_purge`/`competitor_comments_purge` chamadas como `service_role` gravam a lista; `competitor_channel_purge` declara (aviso à A5) e, com D-M9-25, limpa a watch do canal. Testes: `service_role_apaga_video_e_comentarios` e `service_role_apaga_canal` (Tarefa 2).
7. **Canal apagado com alvos de item em voo:** os alvos fecham, o `obs:arquivo` não recebe 409. Teste: `canal_apagado_fecha_alvos_de_item` (Tarefa 4).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/rascunhos/m9.sql` (novo; vira a migration na Tarefa 10) | partes 1 a 6 do SQL da M9 |
| `apps/web/test/helpers/m9.ts` (novo) | `M9_SQL_CAMINHO`, `aplicarM9(c, ate?)`, `semearE9(c)` (cria as três funções da E9 como o plano da E9 as define, só para o banco de integração), sementes do item |
| `apps/web/test/manutencao/m9-trava.test.ts`, `m9-guarda.test.ts` (novos) | TRAVAs M9-1 e M9-2; guarda permanente contra recriar funções sem a captura / as `*_base` |
| `apps/web/test/integration/manutencao-m9-*.test.ts` (novos) | um por parte do SQL |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts` (modificar) | leitor `versao 2` |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts`, `expurgo-resumo.ts` (novos) | filtro puro da unidade e o resumo refeito |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato.ts` (novo) | Zod do C14 (corpo e resposta) |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts` (novo) | gerador puro do arquivo de comandos do §16.10 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts` (modificar) | frases e cores dos estados novos |
| `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts` (modificar; criado pela M3b-forja Tarefa 7a) | `grava_recebendo`, `apaga_conferido`, `rmdir` de prefixo, `B2-PAINEL` com os nomes vindos do site |
| `apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts` (novo) | o tempo `copiar` no Mac (provar NAS, ler, filtrar, registrar, guardar cópia) e `--canal` |
| `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (modificar) | subcomando `expurgar` |
| `apps/web/src/app/api/pipeline/archive/expurgo/route.ts` (novo) | C14 |
| `apps/web/src/app/api/pipeline/archive/attest/route.ts`, `plan/route.ts` (modificar; criados pela M3b Tarefa 11) | `prefixos` (com `snapshots` e `nomes`) e `prefixos_ausentes` |
| `apps/web/src/lib/pipeline/api-registry.ts`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/data/pipeline-docs/cowork-docs-archive.md` (modificar; domínio `archive` da M3b Tarefa 11) | catálogo e doc |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_saiu/*` e a página do Arquivo da M5 (modificar) | peça 7 na fila e bloco "Canais removidos" |
| `apps/web/src/lib/youtube/observatorio/saiu/{responder,modelo}.ts` (E9): **sem edição** (já mapeiam, D-M9-23 reescrita); só um teste que afirma o existente e, se preciso, a frase em `modelo.ts:167`. D-M9-25 (`yt_watch_*`) entra na Tarefa 2 e D-M9-26 (recusa enquanto a M9 está desligada) na Tarefa 11: decididas pelo dono em 23/10, sem pedido à A5 | D-M9-23, D-M9-25, D-M9-26 |
| `apps/web/src/lib/youtube/observatorio/arquivo/blobs-remocao.ts` (novo) e `apps/web/src/lib/youtube/agenda/tarefas/tamanho-do-banco.ts` (modificar) | nova tentativa diária dos blobs das remoções |
| `~/Workspace/forja/ferramentas/arquivo/{comum.py, b2.py, copiador/copiar.py, conferir-b2/conferir.py}` (kit, git local) | `leitura` na config, `prefixos_ausentes` nos dois programas, medição de snapshots, `listar_prefixo` |
| `docs/ops/runbook-arquivo-mensal.md` (modificar; criado pela M3b Tarefa 14), `docs/ops/env-vars.md` | runbook e variáveis |

---

### Task 0: leituras do dia, pré-condições e as travas (sem código)

**Files:**
- Disco (não rastreado): `.superpowers/sdd/manutencao-nas/m9-progresso.md` (ledger), `.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh`, saída em `.superpowers/sdd/manutencao-nas/saidas/m9-0-leituras.txt`

**O que acontece quando o dado não existe:** cada leitura sem resposta é escrita no ledger como "NÃO LIDO" e a trava correspondente continua presa; nunca se presume o valor.

- [ ] **Passo 1. Conferências de repositório (agente), por conteúdo.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git fetch origin
git ls-tree -r --name-only origin/main supabase/migrations | grep -E '_observatorio_a5_e9_|_manutencao_m3b_|_manutencao_m9_'
grep -n "TRAVA M3b-2 solta" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md
grep -n "Pedido da M9 para a Tarefa 10" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md
grep -n "unsealed_reason" supabase/rascunhos/m3b.sql | head -3
git ls-files apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts apps/web/src/lib/youtube/observatorio/arquivo/credencial.ts
ls docs/superpowers/plans | grep -E 'manutencao-nas-m5|manutencao-nas-m6'
git -C /Users/figueiredo/Workspace/bythiagofigueiredo show 37617d174:supabase/migrations 2>/dev/null | head -0
```

Expected para seguir: a migration da E9 em `origin/main` (o commit `6c28dc819` já é ancestral de `origin/staging`: isso **não** prova nada, Yannis I1); a migration da M3b; a linha da TRAVA M3b-2; o pedido da M9 presente na Tarefa 10 da M3b; o CHECK de `unsealed_reason` com `'expurgo'` (senão a parte 1 falha de propósito, `m9_m3b_sem_expurgo`); os dois arquivos da Tarefa 7a rastreados; os planos da M5 e M6 existem. Faltando qualquer um: o ledger registra qual, e só seguem as tarefas que não dependem dele (Tarefas 6 e 7 são TypeScript puro e andam).

- [ ] **Passo 2. Âncoras e md5 dos corpos da E9 (agente, no banco local com a migration da E9 aplicada).**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -At -c "select p.proname, md5(p.prosrc), position('delete from public.competitor_videos v where v.id = p_video;' in p.prosrc) > 0, position('insert into public.competitor_removed_items as r' in p.prosrc) > 0, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_comments_purge','competitor_channel_purge') order by 1"
```

Expected: três linhas; âncora do vídeo `t` em `competitor_video_purge`; âncora do `insert ... as r` `t` em `competitor_comments_purge`; (rodada 0.7) âncora do canal `if to_regprocedure('public.competitor_channel_remove(uuid,uuid,text,text,uuid)') is not null then` presente **uma vez** em `competitor_channel_purge`; `prosecdef` falso nas três (security invoker). Os md5 vão ao ledger como **linha de partida** (23/10: `8c6d51b2…` vídeo, `2233c4ed…` comentários, `02d2a5b5…` canal; o md5 do vídeo e o dos comentários **não mudam** com a D-M9-25 (ela entra na própria M9, e o md5 conferido é o do corpo instalado antes dela); o do canal, `02d2a5b5…`, vira a constante `<<MD5_CANAL>>`) e não mais a constantes copiadas (N-M9-1: a Tarefa 2 lê o md5 do `prosrc` instalado). Âncora ausente: parar e avisar o controlador. **Emenda 23/10 (Phil N9-1):** a fonte do SQL da E9 é a migration, não o Apêndice A nem o `wt-e9`: `git show origin/staging:supabase/migrations/20261015000001_<nome>.sql` (funções l.267-470 e 473-560) e, para `competitor_comments_purge`, a migration `20261018000002_observatorio_a5_f2_respostas_de_terceiros.sql`. Conferir também por leitura que `competitor_channel_purge` contém `competitor_channel_remove(` (fecha a TRAVA M9-0 f) e registrar a contagem de `competitor_removed_items where kind in ('video','comentario')` (hoje 0; diferente de 0 com a M9 desligada é N9-3 já acontecido).

- [ ] **Passo 3. Leituras de produção (dono, por arquivo de comandos).** Escrever `.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh`:

```bash
#!/bin/bash
set -uo pipefail
cd ~/Workspace/bythiagofigueiredo
npx supabase db query --linked "select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_comments_purge','competitor_channel_purge') order by 1"
npx supabase db query --linked "select count(*) as funcoes_da_e9 from pg_proc where proname in ('competitor_video_purge','competitor_comments_purge','competitor_channel_purge')"
npx supabase db query --linked "select count(*) filter (where archive_pending) as pendentes, count(*) as itens from public.competitor_removed_items"
npx supabase db query --linked "select count(*) from public.obs_archive_channel_removals where archive_decision = 'apagar' and completed_at is null"
ssh forja 'for f in numerico texto; do echo "== $f"; mountpoint -q /mnt/arquivo/leitura/$f && echo montado || echo NAO-MONTADO; ls /mnt/arquivo/leitura/$f/.zfs/snapshot 2>&1 | tail -3; done'
```

Linha que o dono roda: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh > ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas/m9-0-leituras.txt 2>&1` (mandar ao `pbcopy` na hora, memória `feedback_comando_no_clipboard.md`). O md5 de produção (os três) tem de ser igual ao do Passo 2 e `funcoes_da_e9` tem de ser `3`; diferente, as constantes da Tarefa 2 usam o de produção e o teste local recria o corpo de produção (anotar no ledger). A raiz de leitura `/mnt/arquivo/leitura/<filho>` (NFS somente leitura) e a de escrita `/mnt/arquivo/escrita` vêm do kit (`comum.py` ~l.429; a leitura é acrescentada na Tarefa 9).

- [ ] **Passo 4. Pré-condição P-M9-1: os snapshots do NAS (Phil I1).** Leitura de 14/10 (registrada no ledger da manutenção): existe um snapshot órfão de 96 dias (**105 dias em 23/10**, Phil N9-5; conferido por `ssh forja ls`: os snapshots que a M9 mede, em `/mnt/arquivo/leitura/{numerico,texto}/.zfs/snapshot`, vão de `auto-2026-10-14_18-20` a `auto-2026-10-23_12-20`, 37 entradas a cada 6 h, consistente com a retenção de 2 semanas; nenhum órfão nos datasets do arquivo, o órfão é do `appdata`; a decisão do dono segue aberta e não bloqueia a cópia), `fast/appdata@auto-2026-07-10_00-45`, sob a tarefa de snapshot 11 (recursiva, retenção de 2 semanas, 00:20/06:20/12:20/18:20); e a forja **enxerga** `.zfs/snapshot` do filho (`ssh forja 'ls /mnt/arquivo/leitura/texto/.zfs/snapshot'` devolveu `auto-2026-10-14_18-20`). Conseqüência: um prefixo apagado do dataset pode continuar legível dentro de um snapshot por meses. Por isso a ausência de snapshot **é medida** (D-M9-9), não declarada. A leitura que prova o estado do dia, a rodar antes de ligar o interruptor (TRAVA M9-3), por arquivo de comandos (leitura, mas no NAS, então do dono):

```bash
ssh forja 'for f in numerico texto; do echo "== $f"; ls /mnt/arquivo/leitura/$f/.zfs/snapshot | head -50; done'
# no NAS (caminho de ssh dos runbooks da manutenção; só leitura):
midclt call pool.snapshottask.query
zfs list -t snapshot -o name,creation -s creation
```

**Decisão do dono (a registrar no ledger):** apagar ou manter o snapshot órfão de 96 dias. O agente não apaga snapshot. Se o dono mantiver, o item e o canal ficam em `falta 'snapshots'` (com a data do mais antigo na tela) até o snapshot sumir: é o comportamento certo, e o plano não o contorna. Sem a prova direta (`snapshots: 'ausente'` no `attest`), item e canal **não concluem**.

- [ ] **Passo 5. Ledger.** Escrever em `m9-progresso.md`: as respostas dos Passos 1 a 4, a decisão do dono sobre o snapshot órfão, as travas que seguem presas e por quê. Sem commit (arquivo ignorado).

---

### Task 1: rascunho do SQL, parte 1 (guardas, tabelas, interruptor) e o helper dos testes

**Files:**
- Create: `supabase/rascunhos/m9.sql` (cabeçalho e `-- M9 PARTE 1`)
- Create: `apps/web/test/helpers/m9.ts`
- Create: `apps/web/test/manutencao/m9-trava.test.ts`
- Create: `apps/web/test/integration/manutencao-m9-tabelas.test.ts`

**Interfaces:**
- Consumes: `aplicarM3b(c)`, `escalar`, `q1`, `tenta`, `semearCanal`, `SITE_TESTE` (`apps/web/test/helpers/m3b.ts:9-83`); `skipIfNoLocalDb` (`apps/web/test/helpers/db-skip.ts`).
- Produces: `M9_SQL_CAMINHO`, `M9_SQL()`, `type ParteM9 = 1 | 2 | 3 | 4 | 5 | 6`, `sqlM9Ate(ate?)`, `semearE9(c)`, `aplicarM9(c, ate?)`; tabelas `obs_archive_item_targets`, `obs_archive_absence`, `obs_archive_m9_interruptor`; coluna `obs_archive_summaries.origem`; colunas `marcado_rodado_em` e `nas_last_absent_at`; funções `obs_archive_m9_ligado(uuid)` (interna) e `obs_archive_m9_ligar(uuid, boolean)` (dono); gatilho `obs_archive_congela_dias`.

**O que acontece quando o dado não existe:** sem a M3b ou sem `'expurgo'` no CHECK, a migration **falha** com mensagem própria (nunca amplia a constraint da M3b por conta própria); sem as três funções da E9, falha `m9_sem_e9`; sem linha em `obs_archive_item_targets` o item não tem nada no arquivo; sem linha em `obs_archive_absence` a ausência **não** está provada; sem linha no interruptor o site está **desligado**.

- [ ] **Passo 1. Teste da trava, falhando** (`apps/web/test/manutencao/m9-trava.test.ts`):

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(__dirname, '../../../..')
const migrou = readdirSync(resolve(RAIZ, 'supabase/migrations')).some(n => n.includes('_manutencao_m9_'))
const PENDENCIAS = 'apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts'

describe('TRAVAs M9-1 e M9-2', () => {
  it('o SQL da M9 vive no rascunho ou na migration, nunca nos dois', () => {
    const rascunho = existsSync(resolve(RAIZ, 'supabase/rascunhos/m9.sql'))
    expect(rascunho !== migrou).toBe(true)
  })
  it.skipIf(migrou)('sem a migration: nem rota do expurgo nem leitor na versao 2', () => {
    expect(existsSync(resolve(RAIZ, 'apps/web/src/app/api/pipeline/archive/expurgo'))).toBe(false)
    expect(readFileSync(resolve(RAIZ, PENDENCIAS), 'utf8')).toMatch(/export const VERSAO_PENDENCIAS = 1\b/)
  })
  it.skipIf(!migrou)('com a migration: a rota do expurgo existe e o leitor está na versao 2', () => {
    expect(existsSync(resolve(RAIZ, 'apps/web/src/app/api/pipeline/archive/expurgo/route.ts'))).toBe(true)
    expect(readFileSync(resolve(RAIZ, PENDENCIAS), 'utf8')).toMatch(/export const VERSAO_PENDENCIAS = 2\b/)
  })
})
```

(O terceiro `it` só passa a valer na Tarefa 11; ele fica `skip` até a migration existir e o commit da Tarefa 10 já altera o teste para a forma final, Tarefa 10 Passo 3.)

- [ ] **Passo 2.** `cd apps/web && npx vitest run test/manutencao/m9-trava.test.ts` → FAIL (`m9.sql` não existe e a migration também não: o XOR falha).

- [ ] **Passo 3. O helper** (`apps/web/test/helpers/m9.ts`). `semearE9` cria, só no banco de integração, as três funções da E9 **com o corpo vigente em produção**. **Emenda 23/10 (Yannis N-M9-1, Phil N9-1):** nada de cópia (`e9-funcoes.sql` sai do plano): o helper extrai, por script, o `create or replace function public.<nome> … $$…$$;` do **último** arquivo de `supabase/migrations/` que define a função (para `competitor_comments_purge`, a migration `20261018000002`; as outras, `20261015000001`), ou aplica as migrations reais no banco de integração; o md5 esperado sai do `prosrc` instalado, nunca de constante copiada. Texto anterior: copiado do Apêndice A do plano da E9 para `apps/web/test/helpers/e9-funcoes.sql`, mais `competitor_channel_purge`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Client } from 'pg'
import { aplicarM3b } from './m3b'

export const M9_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m9.sql')
export const M9_SQL = (): string => readFileSync(M9_SQL_CAMINHO, 'utf8')
export type ParteM9 = 1 | 2 | 3 | 4 | 5 | 6

/** O texto da M9 até o fim da parte `ate` (padrão: tudo). Partes marcadas por `-- M9 PARTE <n>:`. */
export function sqlM9Ate(ate: ParteM9 = 6): string {
  const sql = M9_SQL()
  if (ate === 6) return sql
  const fim = sql.indexOf(`-- M9 PARTE ${ate + 1}:`)
  if (fim < 0) throw new Error(`m9.sql sem o marcador da parte ${ate + 1}`)
  return sql.slice(0, fim)
}

/** As três funções da E9 como estão nas migrations de origin/staging (a última que define cada uma). Só no banco de integração. */
export async function semearE9(c: Client): Promise<void> {
  await c.query(extrairFuncoesDasMigrations(['competitor_video_purge', 'competitor_comments_purge', 'competitor_channel_purge']))   // emenda 23/10: da última migration que define cada uma, sem cópia
}

export async function aplicarM9(c: Client, ate?: ParteM9): Promise<void> {
  await aplicarM3b(c)
  await semearE9(c)
  await c.query(sqlM9Ate(ate))
}
```

- [ ] **Passo 4. Testes das tabelas, falhando** (`manutencao-m9-tabelas.test.ts`, `describe.skipIf(skipIfNoLocalDb())`, cada `it` em `begin … rollback` com `aplicarM9(c, 1)`):

| Teste | Afirma |
|---|---|
| `guardas: sem a E9` | sem `semearE9`, aplicar a parte 1 falha com `m9_sem_e9`; sem a M3b, `m9_m3b_ausente` |
| `guarda: M3b sem expurgo` | recriar a constraint de `unsealed_reason` sem `'expurgo'` e aplicar a parte 1 falha com `m9_m3b_sem_expurgo` (a M9 não amplia por conta própria) |
| `tabelas novas com RLS e sem escrita` | as três tabelas com `relrowsecurity`; uma policy `select` cada, com `can_edit_site(site_id)` no texto; `has_table_privilege('service_role', t, 'INSERT')` falso; `has_table_privilege('authenticated', t, 'SELECT')` falso fora da policy (grant revogado) |
| `alvo: keys esvaziadas ao concluir` (emenda 23/10, D-M9-25b) | alvo com 3 chaves (uma de resposta de espectador) vai a `concluido`/`sem_linhas`/`canal_apagado`: `keys = '{}'`, `keys_n = 3`; aberto com `keys` vazio falha `23514`; `esperadas` conta a resposta de espectador (senão `contagem_divergente`); nenhuma função de leitura da tela devolve `keys` |
| `alvo: estados e motivo` | `estado = 'bloqueado'` com `motivo` nulo falha `23514`; `estado = 'copiar'` com `motivo` falha; `concluido` sem `done_at` falha; `motivo_fim` só com `concluido` |
| `alvo: unicidade por geração` | duas linhas iguais (site, classe, tabela, canal, mês, tipo, geração) falham `23505`; geração 2 passa |
| `ausência: alvo tipado` | `alvo = 'canal:xyz'` falha `23514`; `canal:<uuid>` com `canal_ref` nulo falha; `alvo:<id>` com `alvo_id`; `antiga:<uuid>` com `unidade_id` passam |
| `ausência: marcos em cadeia` | `nas_absent_at` sem `nas_absent_first_at`, `snap_absent_at` sem `nas_absent_at`, `b2_absent_at` sem `snap_absent_at` falham `23514`; `nova_caminho` sem `nova_sha256` falha |
| `resumo ganha origem` | `obs_archive_summaries.origem` existe, padrão `'rota'`, só `'rota'`/`'expurgo'` |
| `congela_dias` | `update obs_archive_months set days_measured = 1` com `detached_at` preenchido mantém o valor antigo; mês online muda normalmente |
| `interruptor: padrão desligado` | `obs_archive_m9_ligado(site)` é falso sem linha; `obs_archive_m9_ligar(site, true)` exige a captura presente (Tarefa 2) e liga; `has_function_privilege('service_role', 'obs_archive_m9_ligar(uuid,boolean)', 'EXECUTE')` falso |
| `rodar duas vezes` | `aplicarM9(c, 1)` seguido de `c.query(sqlM9Ate(1))` não erra (idempotência) |

- [ ] **Passo 5. A parte 1** (`supabase/rascunhos/m9.sql`):

```sql
-- Manutenção M9: expurgo enxuto (fatia 12b). Rascunho: vira a migration manutencao_m9_expurgo na Tarefa 10 (TRAVA M9-1).
-- Depende da M3b (obs_archive_*) e da E9 (competitor_video_purge / competitor_comments_purge) aplicadas.

-- M9 PARTE 1: guardas, colunas, tabelas, interruptor
do $$ declare v_def text; begin
  if to_regclass('public.obs_archive_units') is null or to_regclass('public.competitor_removed_items') is null
     or to_regprocedure('public.obs_archive_record_core(uuid,text,jsonb,text)') is null then
    raise exception 'm9_m3b_ausente' using errcode = 'P0001';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('competitor_video_purge', 'competitor_comments_purge', 'competitor_channel_purge')) <> 3 then
    raise exception 'm9_sem_e9' using errcode = 'P0001';
  end if;
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
    where c.conrelid = 'public.obs_archive_months'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%unsealed_reason%' limit 1;
  if v_def is null or v_def not like '%expurgo%' then
    raise exception 'm9_m3b_sem_expurgo' using errcode = 'P0001',
      detail = 'a M3b precisa aceitar unsealed_reason = expurgo (pedido da M9 para a Tarefa 10 da M3b)';
  end if;
end $$;

alter table public.competitor_removed_items add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists nas_last_absent_at timestamptz;
-- O resumo do expurgo é gravado pela M9; a origem separa o que o site exporta do que o Mac refez (D-M9-16).
alter table public.obs_archive_summaries add column if not exists origem text not null default 'rota';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'obs_archive_summaries_origem_check') then
    alter table public.obs_archive_summaries add constraint obs_archive_summaries_origem_check check (origem in ('rota', 'expurgo'));
  end if;
end $$;

-- A lista do item (02 §11.3 item 2; D-M9-1): um alvo por unidade (classe, tabela, canal, mês), tipo e geração.
create table if not exists public.obs_archive_item_targets (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  item_kind text not null check (item_kind in ('video', 'comentario')),
  item_refs text[] not null check (cardinality(item_refs) between 1 and 20000),       -- youtube_id do vídeo / youtube_comment_id
  item_id bigint,                                                                      -- representante: menor id de competitor_removed_items que casa
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo')),
  table_name text not null,
  channel_ref text not null check (channel_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  month date not null check (month = date_trunc('month', month)::date),
  geracao integer not null default 1 check (geracao between 1 and 99),
  keys text[] not null check (cardinality(keys) <= 20000),                              -- uuid do vídeo; id do comentário (com respostas). Emenda 23/10 (D-M9-25b): vazio só quando o alvo está concluído
  keys_n integer check (keys_n >= 0),                                                  -- contagem guardada ao esvaziar `keys` em concluido/sem_linhas
  esperadas bigint check (esperadas >= 0),                                             -- linhas do item no online; nulo = não conferível
  from_unit_id uuid not null,
  from_version integer not null check (from_version between 1 and 9999),
  estado text not null default 'copiar'
    check (estado in ('copiar', 'aguardando_nova', 'apagar_antigas', 'conferir_b2', 'concluido', 'sem_linhas', 'bloqueado')),
  motivo text check (motivo in ('antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente')),
  motivo_fim text check (motivo_fim in ('canal_apagado')),
  to_unit_id uuid, to_version integer, rows_removed bigint check (rows_removed >= 0),
  done_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (site_id, class, table_name, channel_ref, month, item_kind, geracao),
  check ((estado = 'bloqueado') = (motivo is not null)),
  check ((estado in ('concluido', 'sem_linhas')) = (done_at is not null)),
  check (motivo_fim is null or estado = 'concluido'),
  check (cardinality(keys) >= 1 or estado in ('concluido', 'sem_linhas'))             -- D-M9-25b
);
-- D-M9-25b (decisão: Phil): `keys` guarda ids de espectador (F2) só enquanto o alvo está aberto; ao concluir, esvazia e guarda a contagem.
create or replace function public.obs_archive_item_targets_esvazia_keys() returns trigger language plpgsql set search_path = '' as $f$
begin
  if new.estado in ('concluido', 'sem_linhas') and cardinality(new.keys) > 0 then
    new.keys_n := cardinality(new.keys); new.keys := '{}';
  end if;
  return new;
end $f$;
drop trigger if exists obs_archive_item_targets_esvazia_keys on public.obs_archive_item_targets;
create trigger obs_archive_item_targets_esvazia_keys before insert or update on public.obs_archive_item_targets for each row execute function public.obs_archive_item_targets_esvazia_keys();
create index if not exists idx_oait_item on public.obs_archive_item_targets (site_id, item_id);
create index if not exists idx_oait_open on public.obs_archive_item_targets (site_id, channel_ref) where done_at is null;
create index if not exists idx_oait_refs on public.obs_archive_item_targets using gin (item_refs) where done_at is null;

-- A prova de ausência (D-M9-8): o que o site quer ver sumir e o que o copiador e o conferir-b2 disseram. Junções tipadas (Yannis I11).
create table if not exists public.obs_archive_absence (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  alvo text not null check (alvo ~ '^(?:canal:[0-9a-f-]{36}|alvo:[1-9][0-9]{0,18}|antiga:[0-9a-f-]{36})$'),
  canal_ref text check (canal_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  alvo_id bigint,
  unidade_id uuid,
  filho text not null check (filho in ('numerico', 'texto')),
  prefixo text not null check (prefixo ~ '^[A-Za-z0-9_][A-Za-z0-9._/-]{0,299}$' and prefixo !~ '(^|/)\.\.?(/|$)'),
  e_prefixo boolean not null,                            -- true: diretório do canal; false: arquivo exato
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  nova_caminho text, nova_sha256 text check (nova_sha256 ~ '^[0-9a-f]{64}$'),
  liberado_em timestamptz, encerrada_at timestamptz,
  nas_absent_first_at timestamptz, nas_absent_at timestamptz, nas_last_absent_at timestamptz, nas_present_at timestamptz,
  snap_absent_at timestamptz, snap_oldest date, snap_checked_at timestamptz,
  b2_absent_at timestamptz, b2_present_at timestamptz, b2_checked_at timestamptz, b2_nomes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (site_id, alvo, filho, prefixo),
  check (e_prefixo or sha256 is not null),
  check ((nova_caminho is null) = (nova_sha256 is null)),
  check ((alvo like 'canal:%' and canal_ref is not null and alvo_id is null and unidade_id is null)
      or (alvo like 'alvo:%' and alvo_id is not null and canal_ref is null and unidade_id is null)
      or (alvo like 'antiga:%' and unidade_id is not null and canal_ref is null and alvo_id is null)),
  check (nas_absent_at is null or nas_absent_first_at is not null),
  check (snap_absent_at is null or nas_absent_at is not null),
  check (b2_absent_at is null or snap_absent_at is not null)
);
create index if not exists idx_oaa_abertas on public.obs_archive_absence (site_id, canal_ref) where encerrada_at is null;
create index if not exists idx_oaa_alvo on public.obs_archive_absence (site_id, alvo_id) where encerrada_at is null;
create index if not exists idx_oaa_unidade on public.obs_archive_absence (site_id, unidade_id) where encerrada_at is null;

-- O interruptor (D-M9-20): desligado, o site manda prefixos_ausentes = [] e o kit antigo segue verde.
create table if not exists public.obs_archive_m9_interruptor (
  site_id uuid primary key,
  ligado boolean not null default false,
  ligado_em timestamptz, ligado_por text
);

do $$ declare t text; begin
  foreach t in array array['obs_archive_item_targets', 'obs_archive_absence', 'obs_archive_m9_interruptor'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_leitura', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create or replace function public.obs_archive_m9_ligado(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select i.ligado from public.obs_archive_m9_interruptor i where i.site_id = p_site), false)
$$;
revoke all on function public.obs_archive_m9_ligado(uuid) from public, anon, authenticated, service_role;

-- Só o dono, pelo SQL do painel (postgres); nenhuma role de API chama.
create or replace function public.obs_archive_m9_ligar(p_site uuid, p_ligar boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_ligar and not public.obs_archive_m9_captura_presente() then
    raise exception 'captura_ausente' using errcode = 'P0001';
  end if;
  insert into public.obs_archive_m9_interruptor (site_id, ligado, ligado_em, ligado_por)
  values (p_site, p_ligar, now(), current_user)
  on conflict (site_id) do update set ligado = excluded.ligado, ligado_em = excluded.ligado_em, ligado_por = excluded.ligado_por;
  return p_ligar;
end $$;
revoke all on function public.obs_archive_m9_ligar(uuid, boolean) from public, anon, authenticated, service_role;

-- Mês fora do banco: o seal recalcularia days_* da tabela online (zeraria). Redundante se a M3b aceitar o pedido opcional (Yannis I10).
create or replace function public.obs_archive_congela_dias() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.detached_at is not null or old.dropped_at is not null then
    new.days_measured := old.days_measured;
    new.days_in_month := old.days_in_month;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_congela_dias() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_congela_dias on public.obs_archive_months;
create trigger obs_archive_congela_dias before update on public.obs_archive_months
  for each row execute function public.obs_archive_congela_dias();
```

(`obs_archive_m9_captura_presente()` nasce na parte 2; `obs_archive_m9_ligar` só é chamada depois de todas as partes, e o `create or replace` em plpgsql não resolve o nome na criação. Confirmar no Passo 6 que `detached_at`/`dropped_at` são as colunas reais de `obs_archive_months`: `grep -n "detached_at\|dropped_at" supabase/rascunhos/m3b.sql | head`.)

- [ ] **Passo 6.** Rodar os dois testes → PASS (`cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/manutencao/m9-trava.test.ts test/integration/manutencao-m9-tabelas.test.ts --no-file-parallelism`, banco `bythiago_int`).

- [ ] **Passo 7. Commit** (quando o controlador mandar): `git add -- supabase/rascunhos/m9.sql apps/web/test/helpers/m9.ts apps/web/test/manutencao/m9-trava.test.ts apps/web/test/integration/manutencao-m9-tabelas.test.ts` e `git commit -m "feat: M9 parte 1: guardas, lista do item, prova de ausência e interruptor (rascunho)" -- <os cinco>`.

---

### Task 2: SQL parte 2, a lista do item antes da cascata, a bandeira por chave e a guarda do `record`

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 2:`)
- Modify: `apps/web/test/helpers/m9.ts` (`aplicarM9` troca os marcadores `<<MD5_VIDEO>>`, `<<MD5_COMENTARIOS>>` e `<<MD5_CANAL>>` pelo md5 do `prosrc` **instalado** pelo `semearE9`; `semearItem`)
- (Emenda 23/10, N-M9-1d) **não** criar `apps/web/test/helpers/e9-funcoes.sql`: o `semearE9` extrai das migrations.
- Create: `apps/web/test/integration/manutencao-m9-captura.test.ts`, `apps/web/test/manutencao/m9-guarda.test.ts`

**Interfaces:**
- Consumes: parte 1; `obs_archive_unit_source`, `obs_archive_table_exprs`, `obs_archive_record_core` (M3b); `semearCanal`, `semearUnidade` (helpers da M3b, `grep -n "export" apps/web/test/helpers/m3b.ts`).
- Produces: `obs_archive_item_esperadas(...)`, `obs_archive_item_capture(p_site uuid, p_kind text, p_channel uuid, p_refs text[], p_keys text[]) returns integer`, `obs_archive_m9_captura_presente()`, gatilhos `obs_archive_flag_pending` e `obs_archive_link_item`, injeção na E9 (captura em duas funções; limpeza de `yt_watch_*` em `competitor_video_purge` e `competitor_channel_purge`, D-M9-25), `obs_archive_record` recriada com a guarda `expurgo_em_curso`.

**O que acontece quando o dado não existe:** canal com decisão `apagar` (ou a lista vazia): a captura devolve `0` e não grava nada (o arquivo do canal inteiro sai pelo caminho do canal, Tarefa 4); unidade mais nova vazia ou item que não está na unidade (`esperadas = 0`): sem alvo; função da E9 ausente ou com corpo diferente do conferido: a migration **falha** (`m9_sem_e9`, `m9_e9_mudou`), nunca segue em silêncio; sem a captura nas duas funções, `obs_archive_m9_ligar(site, true)` falha `captura_ausente` e o plano acende o vermelho (Tarefa 6).

- [ ] **Passo 1. Testes, falhando.**

`manutencao-m9-captura.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, cada `it` em `begin … rollback`, `aplicarM9(c, 2)`; sementes: canal, vídeo `v1`/`v2`, unidades correntes recebidas de `competitor_video_daily` e `competitor_video_comments` com linhas online que casam com `row_count`):

| Teste | Afirma |
|---|---|
| `captura: permissões` | `has_function_privilege('service_role', 'public.obs_archive_item_capture(uuid,text,uuid,text[],text[])', 'EXECUTE')` verdadeiro; `anon`, `authenticated` falsos; `obs_archive_item_esperadas` falso para todos |
| `service_role_apaga_video_e_comentarios` | `set local role service_role`; chamar `competitor_video_purge(...)` e `competitor_comments_purge(...)` semeadas **não** dá `42501`; cria alvos em `obs_archive_item_targets` com `item_refs`, `keys` e `esperadas` iguais à contagem online antes da cascata; o vídeo some; `competitor_removed_items.archive_pending = true`. **Rodada 0.7 (D-M9-25, Phil + Yannis):** o teste semeia também `yt_watch_alvos` (`tipo 'concorrente'`), `yt_watch_thumbs` e `yt_watch_readings` do `video_id` do vídeo (colunas: `20261018000005_observatorio_a5_s4_leitura_watch.sql`; o `youtube_video_id` tem 11 caracteres `[A-Za-z0-9_-]`, o `video_id` do `semearCanal` já serve) e, **com a mesma chave em outro `site_id`**, as mesmas três linhas; depois da chamada como `service_role`: 0 linhas nas três tabelas para `p_site`, as do outro `site_id` **intactas** (chave composta), `rows_deleted` traz `yt_watch_readings`, `yt_watch_thumbs` e `yt_watch_alvos` com as contagens semeadas; `has_table_privilege('service_role', ..., 'DELETE')` nas três (a migration da M9 traz o `grant delete` idempotente abaixo, então o teste é a prova de que ele valeu; rodada 0.8, Phil M9-N1); vídeo cujo `youtube_video_id` também está em **outro canal do mesmo site**: a watch **não** é apagada (compartilhado, como a F1). Afirma `prosecdef = false` (`security invoker`) e a assinatura de 6 argumentos nas duas funções. As tabelas `yt_watch_*` só existem a partir do `origin/staging` (não no `staging` local): o teste roda no 54422 recriado de `origin/staging` |
| `service_role_apaga_canal` (aviso à A5) | `set local role service_role`; `competitor_channel_purge` de um canal em `missing_since` com a M3b aplicada: apaga o canal, grava `obs_archive_channel_removals` (`archive_decision 'apagar'`, `removed_via 'fila'`) e os alvos abertos do canal vão a `concluido` (Tarefa 4). **Rodada 0.7 (D-M9-25, Phil C2, Yannis C-E): caso de canal da watch:** semear um canal em `missing_since` com 2 vídeos, `yt_watch_alvos`/`thumbs`/`readings` de cada `video_id` (e as mesmas linhas, com os mesmos `youtube_video_id`, em outro `site_id`), chamar `competitor_channel_purge` como `service_role`: 0 linhas nas três tabelas para os vídeos do canal (a chave é `array_agg(video_id)` calculada antes da cascata; **mutante: trocar pela `v_yt` do canal apaga 0 linhas e o teste cai**), o outro `site_id` intacto, `rows_deleted` com as contagens, e um vídeo que outro canal do mesmo site também acompanha mantém a watch. **Emenda 23/10 (N9-1/N-M9-2): sem `it.skip`** (a E9 já declara o destino via `competitor_channel_remove`; o teste roda com a M3b aplicada). Acrescentar ao `m9-guarda.test.ts`: `competitor_channel_purge` não pode conter `insert into public.obs_archive_channel_removals` (a declaração é só do `competitor_channel_remove`) |
| `captura: uma unidade, uma linha por tipo` | vídeo `v1` com daily em 2 meses: 2 alvos (um por mês), `estado = 'copiar'`, `from_unit_id`/`from_version` da maior versão |
| `dois_itens_mesma_unidade_fundem` | `v1` e depois `v2` no mesmo mês: **um** alvo, `item_refs` e `keys` com os dois, `esperadas` = soma (a segunda captura desconta do `row_count` as linhas do primeiro, que já saíram do online) |
| `segundo_lote_de_comentarios_gera_geracao` | alvo de comentários em `aguardando_nova`; novo lote de comentários no mesmo mês: nasce `geracao = 2`, `from_unit_id` = a unidade nova |
| `captura: unidade vazia ou item ausente` | unidade mais nova com `row_count = 0`: nenhum alvo; vídeo que não está na unidade (`esperadas = 0`): nenhum alvo |
| `captura: canal com decisão apagar` | com `obs_archive_channel_removals.archive_decision = 'apagar'`: devolve `0`, nenhum alvo |
| `captura: mês destacado em trânsito` | **algum** mês do banco com `detached_at` e sem `dropped_at` (emenda 23/10, N9-4: o invariante da M6 é global, o gatilho `a_` levanta antes da captura para qualquer mês, não só o do item): `raise` `P0001` com texto `mes_destacado_em_transito`; a função da E9 inteira desfaz (o vídeo continua online). A frase diz "algum mês está saindo do banco", sem prometer granularidade que o invariante não tem |
| `injecao: idempotente e fail-closed sobre o corpo da F2` (emenda 23/10, N-M9-1) | rodando sobre o `prosrc` instalado de `competitor_comments_purge` (com `v_conta`): depois da injeção o `v_conta` continua presente; mutante: apagar `v_conta` do corpo-base e `m9_e9_mudou` dispara; o comportamento afirmado inclui que resposta de espectador não vai a `competitor_removed_items` |
| `captura: mês já fora do banco` | mês `dropped_at`: alvo criado com `esperadas = null` (não conferível) |
| `captura: video_antigo` | vídeo com `archive_frozen_at` no mês e unidade `video_antigo`: alvo `bloqueado`/`depende_m10b`; vídeo sem congelamento no mês: nenhum |
| `captura: ensaio e tabelas de comentário` | classe `ensaio` nunca entra; item `comentario` só gera alvo em `competitor_video_comments` e `competitor_video_comment_marks` (classe `texto`) |
| `captura: unidade defasada` | online com mais ou menos linhas que `unit.row_count`: `esperadas = null` e o alvo existe (conservador) |
| `bandeira: derivada por chave` | `competitor_removed_items` com a chave de um alvo aberto: `archive_pending = true`; sem alvo: falso; `update ... set purge_count` religa; item de canal (`kind = 'canal'`) não é tocado |
| `link: item_id é o menor` | dois itens do mesmo alvo: `item_id` = o menor id |
| `record: guarda expurgo_em_curso` | `obs_archive_record(site, 'unidade', {...})` de (classe, canal, mês, tabela) com alvo em `copiar`, `aguardando_nova` ou `bloqueado` devolve `{"status":"expurgo_em_curso"}` e nada grava; alvo `concluido`: segue para o `record_core`; `kind 'resumo'` do (classe, canal, mês) com alvo aberto de qualquer tabela: idem |
| `record_core com origem expurgo continua livre` | `obs_archive_record_core(..., 'expurgo')` não passa pela guarda (a Tarefa 3 o usa) |
| `injecao: idempotente e fail-closed` | aplicar a parte 2 duas vezes mantém **uma** chamada de captura em cada função e **um** bloco de limpeza da watch no vídeo e no canal (marcador por função e por efeito: contar as ocorrências de `yt_watch_readings` em `prosrc` = 1 em cada uma das duas); função recriada só com a captura (sem a watch) recebe só a watch; sem a função do canal: `m9_sem_e9`; md5 do canal diferente de `<<MD5_CANAL>>`: `m9_e9_mudou` com o nome dela; sem a função: `m9_sem_e9`; com corpo diferente do md5: `m9_e9_mudou`; âncora ausente: `m9_e9_ancora` |
| `recusa: com unidades e M9 desligada` (rodada 0.8, N7-3) | semear `obs_archive_units` do site e **não** ligar; `set local role service_role`; `competitor_video_purge` e `competitor_comments_purge` levantam `P0001` com `message = 'm9_desligada'`; `count` de `competitor_videos` e de comentários **não muda**; nenhum alvo em `obs_archive_item_targets` |
| `recusa: M9 ligada apaga` | mesma semente, `obs_archive_m9_ligar(site, true)` (como `postgres`); as duas funções, como `service_role`, apagam e capturam |
| `recusa: sem unidades apaga` | sem linha em `obs_archive_units` (M3b fora do ar) e M9 desligada: apagam |
| `recusa: critério é o banco, não o env` | com `OBS_ARQUIVO` apagado/desligado no processo e unidades semeadas, M9 desligada: continua recusando (o helper não lê env) |
| `recusa: mutante` | recriar as duas funções sem o `perform public.obs_archive_m9_pronto(p_site);` (injeção só dos efeitos `captura` e `watch`): os 2 casos acima que esperam a recusa caem; `injecao: idempotente` afirma **uma** ocorrência de `obs_archive_m9_pronto` em cada uma das duas funções |
| `recusa: switch armado sem unidades` (Emenda 24/10, Phil, janela) | semear `obs_archive_switch` do site com `armed_at` e nenhuma unidade, M9 desligada: `competitor_video_purge` e `competitor_comments_purge` levantam `P0001 m9_desligada` |
| `recusa: plano rodou, sem unidade` (Emenda 24/10) | linha de `obs_archive_switch` com `first_month_at` e `armed_at` nulo, sem unidade, M9 desligada: idem |
| `recusa: switch de outro site não conta` (Emenda 24/10) | switch armado só de outro `site_id`: o site consultado apaga |
| `recusa: mutante do critério` (Emenda 24/10) | recriar `obs_archive_m9_pronto` com o critério só-`units`: os dois casos acima de switch caem |
| `m9-guarda: helper cita o switch` (Emenda 24/10) | o `prosrc` de `obs_archive_m9_pronto` contém `obs_archive_switch` |
| `captura_presente` | `obs_archive_m9_captura_presente()` verdadeiro após a injeção; falso se uma das funções for recriada sem a captura (teste recria `competitor_video_purge` com o corpo original) |

`m9-guarda.test.ts` (sem banco): varre `supabase/migrations/*` **posteriores** à da M9 (nome ordenado; se a M9 ainda é rascunho, varre todas) e falha se algum arquivo tiver `create or replace function public.competitor_video_purge`, `competitor_comments_purge`, `obs_archive_plan`, `obs_archive_b2_plan` ou `obs_archive_removed_channel_list` **sem** o texto `obs_archive_item_capture` (as duas primeiras) ou **sem** o sufixo `_base` (as três últimas: quem mexer nelas mexe nas `*_base`). A mensagem do `expect` diz o motivo e aponta `docs/superpowers/plans/2026-10-14-manutencao-nas-m9-expurgo-enxuto.md` (D-M9-21).

- [ ] **Passo 2.** Rodar → FAIL (funções ausentes).

- [ ] **Passo 3. A parte 2** (`m9.sql`, depois da parte 1):

```sql
-- M9 PARTE 2: a lista do item antes da cascata (esperadas, captura, bandeira por chave, guarda do record, injeção na E9)

-- Quantas linhas do item a unidade tem no online agora. Nulo = não conferível (unidade defasada do online, filtro desconhecido).
create or replace function public.obs_archive_item_esperadas(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date,
                                                             p_kind text, p_keys text[], p_unit_rows bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_src record; v_prox date := (p_month + interval '1 month')::date;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := ((p_month + interval '1 month')::date::text || ' 00:00:00-03')::timestamptz;
  v_filtro text; v_total bigint; v_item bigint;
begin
  select * into v_src from public.obs_archive_unit_source(p_class, p_table);
  v_filtro := case
    when p_kind = 'comentario' and p_table = 'competitor_video_comments' then 't.id::text = any($7)'
    when p_kind = 'comentario' and p_table = 'competitor_video_comment_marks' then 't.comment_id::text = any($7)'
    when p_kind = 'video' and p_table = 'competitor_video_comment_marks' then 'k.video_id::text = any($7)'
    when p_kind = 'video' then 't.video_id::text = any($7)'
  end;
  if v_filtro is null then return null; end if;
  execute 'select count(*) ' || v_src.from_where into v_total using p_site, p_channel, p_month, v_ini, v_fim, v_prox, p_keys;
  if v_total is distinct from p_unit_rows then return null; end if;      -- unidade defasada do online
  execute 'select count(*) ' || v_src.from_where || ' and ' || v_filtro into v_item using p_site, p_channel, p_month, v_ini, v_fim, v_prox, p_keys;
  return v_item;
end $$;
revoke all on function public.obs_archive_item_esperadas(uuid, text, text, uuid, date, text, text[], bigint) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_item_capture(p_site uuid, p_kind text, p_channel uuid, p_refs text[], p_keys text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record; u record; t record; v_fora boolean; v_bloq boolean; v_esp bigint; v_fuse boolean; v_n integer := 0;
begin
  if p_kind not in ('video', 'comentario') or coalesce(cardinality(p_refs), 0) = 0 or coalesce(cardinality(p_keys), 0) = 0 then return 0; end if;
  -- canal que vai inteiro: o arquivo sai pelo caminho do canal (Tarefa 4), não por item
  if exists (select 1 from public.obs_archive_channel_removals cr
              where cr.site_id = p_site and cr.channel_ref = p_channel::text and cr.archive_decision = 'apagar') then return 0; end if;
  -- mês entre destacado e descartado: o online já não tem as linhas e a unidade antiga é a única; refazer agora perderia o item
  if exists (select 1 from public.obs_archive_units x
               join public.obs_archive_months m on m.site_id = x.site_id and m.class = x.class and m.table_name = x.table_name and m.month = x.month
              where x.site_id = p_site and x.channel_ref = p_channel::text and x.class <> 'ensaio' and (p_kind = 'video' or x.class = 'texto')
                and x.lost_at is null and x.purged_at is null and m.detached_at is not null and m.dropped_at is null) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001';
  end if;
  for r in
    select distinct x.class, x.table_name, x.month from public.obs_archive_units x
     where x.site_id = p_site and x.channel_ref = p_channel::text and x.class <> 'ensaio'
       and (p_kind = 'video' or (x.class = 'texto' and x.table_name in ('competitor_video_comments', 'competitor_video_comment_marks')))
       and x.lost_at is null and x.purged_at is null
     order by 1, 2, 3
  loop
    -- a mesma trava do record_core (kind 'unidade'), em ordem estável
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|unidade|' || r.class || '|' || r.table_name || '|' || p_channel::text || '|' || r.month::text, 0));
    select * into u from public.obs_archive_units x
     where x.site_id = p_site and x.channel_ref = p_channel::text and x.class = r.class and x.table_name = r.table_name and x.month = r.month
       and x.lost_at is null and x.purged_at is null
     order by x.version desc limit 1;
    if u.id is null or u.row_count = 0 then continue; end if;               -- unidade mais nova vazia: sem alvo (limite declarado)
    select coalesce(m.dropped_at is not null, false) into v_fora from public.obs_archive_months m
     where m.site_id = p_site and m.class = r.class and m.table_name = r.table_name and m.month = r.month;
    v_fora := coalesce(v_fora, false);
    select * into t from public.obs_archive_item_targets g
     where g.site_id = p_site and g.class = r.class and g.table_name = r.table_name and g.channel_ref = p_channel::text and g.month = r.month and g.item_kind = p_kind
     order by g.geracao desc limit 1;
    v_fuse := t.id is not null and t.estado in ('copiar', 'bloqueado');
    v_bloq := false;
    if r.class = 'video_antigo' then
      if p_kind <> 'video' or not exists (
           select 1 from public.competitor_videos v
            where v.id::text = any(p_keys)
              and v.archive_frozen_at >= (r.month::text || ' 00:00:00-03')::timestamptz
              and v.archive_frozen_at < ((r.month + interval '1 month')::date::text || ' 00:00:00-03')::timestamptz) then continue; end if;
      v_bloq := true; v_esp := null;                                        -- até a M10b (D-M9-14)
    elsif v_fora or (v_fuse and t.esperadas is null) then
      v_esp := null;
    else
      -- na fusão, as linhas do item anterior já saíram do online: descontar do row_count da unidade
      v_esp := public.obs_archive_item_esperadas(p_site, r.class, r.table_name, p_channel, r.month, p_kind, p_keys,
                                                 u.row_count - case when v_fuse then coalesce(t.esperadas, 0) else 0 end);
      if v_esp = 0 then continue; end if;                                   -- o item não está nesta unidade
    end if;
    if v_fuse then
      update public.obs_archive_item_targets g
         set keys = (select array_agg(distinct k order by k) from unnest(g.keys || p_keys) k),
             item_refs = (select array_agg(distinct k order by k) from unnest(g.item_refs || p_refs) k),
             esperadas = case when v_esp is null or g.esperadas is null then null else g.esperadas + v_esp end,
             updated_at = now()
       where g.id = t.id;
    else
      insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, class, table_name, channel_ref, month, geracao, keys, esperadas,
                                                   from_unit_id, from_version, estado, motivo)
      values (p_site, p_kind, (select array_agg(distinct k order by k) from unnest(p_refs) k), r.class, r.table_name, p_channel::text, r.month,
              coalesce(t.geracao, 0) + 1, (select array_agg(distinct k order by k) from unnest(p_keys) k), v_esp, u.id, u.version,
              case when v_bloq then 'bloqueado' else 'copiar' end, case when v_bloq then 'depende_m10b' end);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.obs_archive_item_capture(uuid, text, uuid, text[], text[]) from public, anon, authenticated;
-- As funções da E9 são security invoker e rodam como service_role (supabase.rpc da server action): sem este grant "apagar" quebra (Phil C1).
grant execute on function public.obs_archive_item_capture(uuid, text, uuid, text[], text[]) to service_role;

create or replace function public.obs_archive_m9_captura_presente() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) = 2 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('competitor_video_purge', 'competitor_comments_purge')
     and position('obs_archive_item_capture' in p.prosrc) > 0
$$;
revoke all on function public.obs_archive_m9_captura_presente() from public, anon, authenticated, service_role;

-- A bandeira archive_pending, derivada por chave (D-M9-2): ligada quando existe alvo aberto do mesmo tipo com a chave.
create or replace function public.obs_archive_flag_pending() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('video', 'comentario') then
    new.archive_pending := exists (select 1 from public.obs_archive_item_targets g
                                    where g.site_id = new.site_id and g.item_kind = new.kind and g.done_at is null
                                      and new.youtube_id = any(g.item_refs));
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_flag_pending() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_flag_pending on public.competitor_removed_items;
create trigger obs_archive_flag_pending before insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_flag_pending();

create or replace function public.obs_archive_link_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('video', 'comentario') then
    update public.obs_archive_item_targets g set item_id = least(coalesce(g.item_id, new.id), new.id), updated_at = now()
     where g.site_id = new.site_id and g.item_kind = new.kind and g.done_at is null and new.youtube_id = any(g.item_refs)
       and g.item_id is distinct from least(coalesce(g.item_id, new.id), new.id);
  end if;
  return null;
end $$;
revoke all on function public.obs_archive_link_item() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_link_item on public.competitor_removed_items;
create trigger obs_archive_link_item after insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_link_item();

-- A guarda do record (D-M9-3): a rota de exportação comum não grava versão nova de um grupo que o expurgo está refazendo.
-- Substitui a casca de uma linha da M3b (m3b.sql:724-731); o expurgo chama record_core direto, com origem 'expurgo'.
create or replace function public.obs_archive_record(p_site uuid, p_kind text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_class text := p_payload->>'classe'; v_table text := p_payload->>'tabela'; v_canal text := p_payload->>'canal'; v_mes text := p_payload->>'mes';
begin
  if p_kind in ('unidade', 'resumo') and v_class is not null and v_canal is not null and v_mes is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|' || p_kind || '|' || coalesce(v_class, '') || '|' || coalesce(v_table, '')
                                                   || '|' || v_canal || '|' || v_mes, 0));
    if exists (select 1 from public.obs_archive_item_targets g
                where g.site_id = p_site and g.class = v_class and g.channel_ref = v_canal and g.month = v_mes::date
                  and g.estado in ('copiar', 'aguardando_nova', 'bloqueado')
                  and (p_kind = 'resumo' or g.table_name = v_table)) then
      return jsonb_build_object('status', 'expurgo_em_curso');
    end if;
  end if;
  return public.obs_archive_record_core(p_site, p_kind, p_payload, null);
end $$;
revoke all on function public.obs_archive_record(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_record(uuid, text, jsonb) to service_role;

-- Rodada 0.8 (Phil M9-N1): as funções da E9 são security invoker e rodam como service_role; as yt_watch_* só revogam delete de authenticated/anon, mas o
-- grant explícito (idempotente) fecha a dúvida sem depender do default do Supabase. As tabelas existem a partir de origin/staging (20261018000005).
do $g$ begin
  if to_regclass('public.yt_watch_readings') is not null and to_regclass('public.yt_watch_thumbs') is not null and to_regclass('public.yt_watch_alvos') is not null then
    grant delete on public.yt_watch_alvos, public.yt_watch_thumbs, public.yt_watch_readings to service_role;
  end if;
end $g$;

-- Rodada 0.8 (Yannis N7-3, D-M9-26): a recusa mora no SQL e lê o BANCO (não o env). Inerte quando a M9 é ligada ou quando a M3b não exportou nada.
create or replace function public.obs_archive_m9_pronto(p_site uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Emenda 24/10 (Phil, janela): "a M3b tocou o site" = unidade gravada OU switch com first_month_at/armed_at (monótonos, nascem antes da 1ª leitura). NÃO usar disarmed_at.
  if (   exists (select 1 from public.obs_archive_units x where x.site_id = p_site)
      or exists (select 1 from public.obs_archive_switch s where s.site_id = p_site
                  and (s.first_month_at is not null or s.armed_at is not null)) )
     and not public.obs_archive_m9_ligado(p_site) then
    raise exception 'm9_desligada' using errcode = 'P0001', hint = 'o apagar do arquivo ainda não está ligado; espere';
  end if;
end $$;
revoke all on function public.obs_archive_m9_pronto(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_m9_pronto(uuid) to service_role;  -- as funções da E9 são invoker e rodam como service_role

-- A injeção na E9 (única por texto, fail-closed): md5 do corpo conferido no dia (Tarefa 0, Passo 2), âncora única, resultado conferido.
-- Rodada 0.7 (D-M9-25, decidida pelo dono em 23/10): TRÊS funções e três tipos de efeito (0.8: `recusa` = D-M9-26, só vídeo e comentários, injetado ANTES da captura; a ordem da lista `values` é a ordem no corpo). `captura` = a lista do item (D-M9-1); `watch` = a limpeza de
-- yt_watch_readings/thumbs/alvos. O marcador "já injetada" é UM POR FUNÇÃO E POR EFEITO (a channel_purge não tem obs_archive_item_capture; um só
-- marcador pularia ou duplicaria). O md5 só vale para o corpo ainda não tocado pela M9 (nenhum marcador presente); o corpo parcialmente injetado
-- (reaplicação) pula a conferência de md5 e aplica só o efeito que falta. No canal, `v_yt` é o id do CANAL: a chave da watch é array_agg(video_id).
do $m9$
declare
  r record; e record; v_def text; v_md5 text; v_pos integer; v_n integer; v_tocada boolean; v_mudou boolean;
begin
  for r in select * from (values
    ('competitor_video_purge', '<<MD5_VIDEO>>'),
    ('competitor_comments_purge', '<<MD5_COMENTARIOS>>'),
    ('competitor_channel_purge', '<<MD5_CANAL>>')
  ) as t(nome, md5_esperado)
  loop
    select pg_get_functiondef(p.oid), md5(p.prosrc) into v_def, v_md5 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.nome;
    if v_def is null then raise exception 'm9_sem_e9' using errcode = 'P0001', detail = r.nome; end if;
    v_tocada := position('obs_archive_item_capture' in v_def) > 0 or position('yt_watch_readings' in v_def) > 0 or position('obs_archive_m9_pronto' in v_def) > 0;
    v_mudou := false;
    for e in select * from (values
      ('competitor_video_purge', 'obs_archive_m9_pronto', 'delete from public.competitor_videos v where v.id = p_video;',
       'perform public.obs_archive_m9_pronto(p_site);'),
      ('competitor_video_purge', 'obs_archive_item_capture', 'delete from public.competitor_videos v where v.id = p_video;',
       'perform public.obs_archive_item_capture(p_site, ''video'', v_channel, array[v_yt], array[p_video::text]);'),
      ('competitor_video_purge', 'yt_watch_readings', 'delete from public.competitor_videos v where v.id = p_video;',
       $w$  with d as (delete from public.yt_watch_readings w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_readings', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_thumbs w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_thumbs', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_alvos w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_alvos', count(*)) into v_rows from d;
$w$),
      ('competitor_comments_purge', 'obs_archive_m9_pronto', 'insert into public.competitor_removed_items as r',
       'perform public.obs_archive_m9_pronto(p_site);'),
      ('competitor_comments_purge', 'obs_archive_item_capture', 'insert into public.competitor_removed_items as r',
       'perform public.obs_archive_item_capture(p_site, ''comentario'', p_channel, array(select k.youtube_comment_id::text from public.competitor_video_comments k where k.id = any(v_alvo)), array(select x::text from unnest(v_todos) x));'),
      ('competitor_channel_purge', 'yt_watch_readings', 'if to_regprocedure(''public.competitor_channel_remove(uuid,uuid,text,text,uuid)'') is not null then',
       $w$  with d as (delete from public.yt_watch_readings w where w.site_id = p_site and w.youtube_video_id = any((select coalesce(array_agg(v.video_id), '{}'::text[]) from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_readings', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_thumbs w where w.site_id = p_site and w.youtube_video_id = any((select coalesce(array_agg(v.video_id), '{}'::text[]) from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_thumbs', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_alvos w where w.site_id = p_site and w.youtube_video_id = any((select coalesce(array_agg(v.video_id), '{}'::text[]) from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_alvos', count(*)) into v_rows from d;
$w$)
    ) as x(nome, marcador, ancora, texto) where x.nome = r.nome
    loop
      if position(e.marcador in v_def) > 0 then continue; end if;                          -- este efeito já está injetado
      if not v_tocada and not v_mudou and v_md5 <> r.md5_esperado then                     -- corpo virgem: confere o md5 antes do 1º efeito
        raise exception 'm9_e9_mudou' using errcode = 'P0001', detail = r.nome || ' md5 ' || v_md5;
      end if;
      v_n := (length(v_def) - length(replace(v_def, e.ancora, ''))) / length(e.ancora);
      if v_n < 1 then raise exception 'm9_e9_ancora' using errcode = 'P0001', detail = r.nome || ' ' || e.marcador; end if;
      v_pos := position(e.ancora in v_def);                                                 -- a PRIMEIRA ocorrência
      v_def := left(v_def, v_pos - 1) || e.texto || E'\n  ' || substr(v_def, v_pos);
      if position(e.marcador in v_def) = 0 then raise exception 'm9_e9_ancora' using errcode = 'P0001', detail = r.nome || ' ' || e.marcador; end if;
      v_mudou := true;
    end loop;
    if v_mudou then execute v_def; end if;
  end loop;
end $m9$;
```

(Rodada 0.7: os `delete` da watch entram como `with d as (delete ... returning 1) select v_rows || jsonb_build_object(...) into v_rows from d`, porque a função não declara variável de contagem e o `get diagnostics` exigiria uma; cada instrução é de topo (a CTE com `delete` não vale em subconsulta), na ordem readings, thumbs, alvos (`yt_watch_readings.miniatura_id` aponta para `yt_watch_thumbs`). O `v_rows` existe nas duas funções antes da âncora (vídeo: l.~295; canal: l.~418 da migration `20261015000001`). O `E'\n  '` de mudança de linha e o `$m9$` externo: o `pg_get_functiondef` devolve o `create or replace function ... $function$ ... $function$`, que o `execute` roda como está, sem conflito com o `$m9$`. O `v_todos` tem de estar atribuído **antes** do primeiro `insert ... as r` na E9: conferir no Passo 4 e no teste `service_role_apaga_video_e_comentarios`.)

- [ ] **Passo 4. Conferir a ordem de `v_todos`/`v_alvo` na E9:** `git show origin/staging:supabase/migrations/20261018000002_observatorio_a5_f2_respostas_de_terceiros.sql | grep -n "v_alvo\|v_todos\|v_conta\|insert into public.competitor_removed_items"` (emenda 23/10: a fonte é a migration vigente, não o Apêndice A): `v_todos` e `v_alvo` atribuídos antes da primeira linha do `insert ... as r`. Se não, ajustar a captura para calcular os dois ali mesmo (e anotar no ledger); o teste do Passo 1 amarra. (Emenda 23/10, N-M9-1c) O `m9-guarda.test.ts` varre **toda** `create or replace` de `competitor_(video|comments)_purge` em `supabase/migrations/`, passadas e futuras, e exige que a última tenha as âncoras (a regra I2 vale também para o passado).

- [ ] **Passo 5.** Ajustar `aplicarM9` para ler os **três** md5 (`select md5(prosrc) from pg_proc where proname = ...`, incluindo `competitor_channel_purge` para `<<MD5_CANAL>>`) e trocar os marcadores no texto antes de `c.query`; rodar `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m9-captura.test.ts test/manutencao/m9-guarda.test.ts --no-file-parallelism` → PASS. Na Tarefa 10 o marcador é trocado pelo md5 de produção (Tarefa 0) e um teste falha se sobrar `<<`.

- [ ] **Passo 6. Commit** (quando o controlador mandar), por caminho: `m9.sql`, `helpers/m9.ts`, os dois testes. Mensagem `feat: M9 parte 2: captura do item antes da cascata e bandeira por chave (rascunho)`.

---

### Task 3: SQL parte 3, abrir, registrar, bloquear e desbloquear o expurgo (o que a rota C14 chama)

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 3:`)
- Create: `apps/web/test/integration/manutencao-m9-registrar.test.ts`

**Interfaces:**
- Consumes: partes 1 e 2; `obs_archive_record_core(..., 'expurgo')`, `obs_archive_channel_unit_hashes`, `obs_archive_policy()` (M3b).
- Produces: `obs_archive_caminho_unidade`, `obs_archive_arquivos_da_unidade`, `obs_archive_cur_group`, `obs_archive_grupo_pronto`, `obs_archive_expurgo_open(p_site uuid, p_item_id bigint) returns jsonb`, `obs_archive_expurgo_record(p_site uuid, p_item_id bigint, p_grupo jsonb) returns jsonb`, `obs_archive_expurgo_block(p_site uuid, p_item_id bigint, p_alvo bigint, p_motivo text) returns jsonb`, `obs_archive_expurgo_unblock(p_site uuid, p_alvo bigint) returns jsonb` (só `postgres`/painel). Os três primeiros têm `grant execute ... to service_role`; os outros, não.

**O que acontece quando o dado não existe:** item sem alvo aberto: `open` e `record` levantam `item_desconhecido` (a rota responde 404); alvo cuja unidade de origem sumiu (perdida, purgada) ou está vazia: o `open` o põe em `sem_linhas` (nada a refazer) em vez de devolvê-lo; grupo com unidade corrente ainda não recebida: o `open` **não** o devolve (o item fica `sem_comando` com `falta 'versao_em_curso'`, Tarefa 5), nunca um grupo parcial; mês fora do banco sem linha online: `esperadas` nulo e `removidas = 0` só vira `sem_linhas` com o mês de fato fora do banco.

- [ ] **Passo 1. Testes, falhando** (`manutencao-m9-registrar.test.ts`, `aplicarM9(c, 3)`, `begin … rollback`; a semente cria canal, vídeo, unidades recebidas de `daily` e `comments` e captura o item com `obs_archive_item_capture`):

| Teste | Afirma |
|---|---|
| `open: grupo pronto` | devolve `grupos[0]` com `classe, canal, mes, filho, alvos[{alvo_id, tabela, versao, linhas, soma, coluna_controle, schema_fp, hash_conteudo, esperadas, chaves, refs, arquivos[{caminho, sha256, parte}]}], outras, vazias, resumo, mes_online, dias_do_mes`; caminho no formato `<classe>/canais/<canal>/<tabela>/<AAAA-MM>.v<N>.csv.gz` e, em unidade de partes, `.pNN.`; `outras` traz a unidade corrente **com linhas** que não é alvo deste item, e `vazias` a de `row_count = 0` |
| `open: versao em curso` | unidade corrente do grupo com linhas e `received_at` nulo: grupo ausente de `grupos` e `esperando = 1`; último resumo com `received_at` nulo e `empty = false`: idem |
| `open: rebase` | alvo `copiar` cujo `from_unit` deixou de ser a corrente: se a corrente tem linhas e foi recebida, o alvo é reapontado; se vazia ou perdida, vira `sem_linhas` com `done_at` |
| `open: item desconhecido` | `P0001` `item_desconhecido` |
| `open: outro item não entra` | alvo do item 2 no mesmo grupo e em `copiar` não aparece em `alvos`, aparece em `outras` |
| `record: caminho feliz` | uma chamada com unidade nova (`row_count = antiga - removidas`) e resumo: cria a unidade `origem 'expurgo'` na versão seguinte, o resumo `origem 'expurgo'` com `unit_hashes` igual a `obs_archive_channel_unit_hashes(...)` **depois** das unidades, alvo `aguardando_nova` com `to_unit_id`/`to_version`/`rows_removed`, uma linha de ausência `alvo:<id>` **por versão anterior** (inteira ou por parte) com a nova como `nova_caminho`/`nova_sha256`, o mês selado vira `unsealed_reason = 'expurgo'` |
| `record: resumo da versão anterior de cada papel` | resumo anterior com os papéis `canal` e `video` e o novo só com `canal`: duas linhas de ausência, a do `video` com `nova_*` nulos |
| `record: nova vazia` | `removidas` = todas as linhas: unidade nova com `row_count 0` e `received_at` imediato; a ausência das antigas com `nova_*` nulos |
| `record: recusas` (uma por linha) | `alvo_de_outro_item`, `alvo_fora_de_copiar`, `grupo_incompleto` (corpo cobre menos alvos copiar do item), `base_mudou` (corrente não é a `from_unit`; nada muda), `resumo_com_unidade_nao_lida` (`tabelas_lidas` ≠ correntes com linhas), `resumo_versao_mudou` (`resumo.versao` ≠ máxima + 1), `resumo_forma` (`vazio` e sha incoerentes); cada uma devolve `{status:'recusado', motivo}` sem escrever nada (contagem de linhas das tabelas antes e depois) |
| `registrar_recusa_contagem_errada` | `removidas = 0` com `esperadas > 0`; `removidas > esperadas`; `row_count` ≠ antiga − removidas: o alvo vira `bloqueado`/`contagem_divergente` e o commit **persiste** (a resposta é `recusado`, não exceção) |
| `record: mês fora do banco` | `esperadas` nulo, mês `dropped_at`, `removidas = 0`: alvo `sem_linhas` sem unidade nova; mês online com `esperadas` nulo e `removidas = 0`: bloqueia `contagem_divergente` |
| `record: guarda do insert` | a gravação em mês `dropped` passa (`record_core` com origem `expurgo` e GUC), e uma tentativa de insert direto sem a marca falha (M3b `obs_archive_insert_guard`) |
| `record: duas chamadas ao mesmo tempo` | segunda chamada com o mesmo corpo depois da primeira: `alvo_fora_de_copiar` (nada duplica) |
| `block / unblock` | `block(alvo, 'antiga_ausente')` leva `copiar` a `bloqueado`; motivo `depende_m10b` recusado vindo da rota; alvo fora de `copiar`: `recusado`; `unblock` volta a `copiar`, recusa `depende_m10b`; `has_function_privilege('service_role', 'public.obs_archive_expurgo_unblock(uuid,bigint)', 'EXECUTE')` falso |
| `permissões` | `open`, `record`, `block`: `service_role` verdadeiro, `anon`/`authenticated` falso; helpers (`cur_group`, `grupo_pronto`, `arquivos_da_unidade`, `caminho_unidade`) falso para todos |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 3** (`m9.sql`):

```sql
-- M9 PARTE 3: abrir, registrar, bloquear e desbloquear o expurgo (rota C14)

create or replace function public.obs_archive_caminho_unidade(p_class text, p_ref text, p_table text, p_month date, p_ver integer, p_parte integer default null)
returns text language sql immutable set search_path = '' as $$
  select p_class || '/canais/' || p_ref || '/' || p_table || '/' || to_char(p_month, 'YYYY-MM') || '.v' || p_ver
         || case when p_parte is null then '' else '.p' || lpad(p_parte::text, 2, '0') end || '.csv.gz'
$$;
revoke all on function public.obs_archive_caminho_unidade(text, text, text, date, integer, integer) from public, anon, authenticated, service_role;

-- Arquivos de uma unidade: um (parts = 1) ou um por parte. Unidade vazia não tem arquivo.
create or replace function public.obs_archive_arquivos_da_unidade(p_unit uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(f.o order by f.p), '[]'::jsonb) from (
    select 1 as p, jsonb_build_object('caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version), 'sha256', u.sha256_bytes, 'parte', 1) as o
      from public.obs_archive_units u where u.id = p_unit and u.parts = 1 and u.row_count > 0
    union all
    select pt.part, jsonb_build_object('caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), 'sha256', pt.sha256_bytes, 'parte', pt.part)
      from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id where u.id = p_unit and u.parts > 1 and u.row_count > 0
  ) f
$$;
revoke all on function public.obs_archive_arquivos_da_unidade(uuid) from public, anon, authenticated, service_role;

-- As unidades correntes do grupo (classe, canal, mês): a maior versão por tabela, nem perdida nem purgada.
create or replace function public.obs_archive_cur_group(p_site uuid, p_class text, p_channel text, p_month date)
returns setof public.obs_archive_units language sql stable security definer set search_path = '' as $$
  select distinct on (x.table_name) x.* from public.obs_archive_units x
   where x.site_id = p_site and x.class = p_class and x.channel_ref = p_channel and x.month = p_month and x.lost_at is null and x.purged_at is null
   order by x.table_name, x.version desc
$$;
revoke all on function public.obs_archive_cur_group(uuid, text, text, date) from public, anon, authenticated, service_role;

-- Pronto para refazer: toda corrente com linhas está recebida e o último resumo está recebido (ou vazio). Também usado pelo owner_pending.
create or replace function public.obs_archive_grupo_pronto(p_site uuid, p_class text, p_channel text, p_month date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.obs_archive_cur_group(p_site, p_class, p_channel, p_month) c where c.row_count > 0 and c.received_at is null)
     and coalesce((select s.empty or s.received_at is not null from public.obs_archive_summaries s
                    where s.site_id = p_site and s.class = p_class and s.channel_ref = p_channel and s.month = p_month and s.lost_at is null and s.purged_at is null
                    order by s.version desc limit 1), true)
$$;
revoke all on function public.obs_archive_grupo_pronto(uuid, text, text, date) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_expurgo_open(p_site uuid, p_item_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record; g record; c record; s record; v_grupos jsonb := '[]'::jsonb; v_esperando integer := 0; v_alvos jsonb; v_outras jsonb; v_vazias jsonb; v_resumo jsonb;
  v_fora boolean;
begin
  if not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id) then
    raise exception 'item_desconhecido' using errcode = 'P0001';
  end if;
  -- rebase: alvo em copiar cuja origem deixou de ser a corrente
  for a in select * from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' order by t.id for update loop
    select * into c from public.obs_archive_cur_group(p_site, a.class, a.channel_ref, a.month) x where x.table_name = a.table_name;
    if c.id is not null and c.id = a.from_unit_id then continue; end if;
    if c.id is null or c.row_count = 0 then
      update public.obs_archive_item_targets set estado = 'sem_linhas', done_at = now(), updated_at = now() where id = a.id;
    elsif c.received_at is not null then
      update public.obs_archive_item_targets set from_unit_id = c.id, from_version = c.version, updated_at = now() where id = a.id;
    end if;
  end loop;
  for g in select distinct t.class, t.channel_ref, t.month from public.obs_archive_item_targets t
            where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' order by 1, 2, 3 loop
    -- todo alvo copiar do grupo (deste item) precisa estar na corrente e recebida
    if not public.obs_archive_grupo_pronto(p_site, g.class, g.channel_ref, g.month)
       or exists (select 1 from public.obs_archive_item_targets t
                   where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref and t.month = g.month
                     and not exists (select 1 from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x
                                      where x.id = t.from_unit_id and x.received_at is not null)) then
      v_esperando := v_esperando + 1; continue;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('alvo_id', t.id, 'tabela', t.table_name, 'versao', u.version, 'linhas', u.row_count, 'soma', u.control_sum,
             'coluna_controle', pol.control_column, 'schema_fp', u.schema_fp, 'hash_conteudo', u.hash_conteudo, 'esperadas', t.esperadas,
             'chaves', to_jsonb(t.keys), 'refs', to_jsonb(t.item_refs), 'arquivos', public.obs_archive_arquivos_da_unidade(u.id)) order by t.table_name), '[]'::jsonb)
      into v_alvos
      from public.obs_archive_item_targets t join public.obs_archive_units u on u.id = t.from_unit_id
      left join public.obs_archive_policy() pol on pol.class = t.class and pol.table_name = t.table_name
     where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref and t.month = g.month;
    select coalesce(jsonb_agg(jsonb_build_object('tabela', x.table_name, 'unidade_id', x.id, 'versao', x.version, 'linhas', x.row_count, 'hash_conteudo', x.hash_conteudo,
             'arquivos', public.obs_archive_arquivos_da_unidade(x.id)) order by x.table_name), '[]'::jsonb) into v_outras
      from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x
     where x.row_count > 0 and not exists (select 1 from public.obs_archive_item_targets t
                                            where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref
                                              and t.month = g.month and t.table_name = x.table_name);
    select coalesce(jsonb_agg(jsonb_build_object('tabela', x.table_name, 'hash_conteudo', x.hash_conteudo) order by x.table_name), '[]'::jsonb) into v_vazias
      from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x where x.row_count = 0;
    select * into s from public.obs_archive_summaries z
     where z.site_id = p_site and z.class = g.class and z.channel_ref = g.channel_ref and z.month = g.month and z.lost_at is null and z.purged_at is null order by z.version desc limit 1;
    v_resumo := case when s.id is null then null else jsonb_build_object('versao', s.version, 'canal', s.canal_sha256, 'video', s.video_sha256) end;
    select coalesce(m.dropped_at is not null or m.detached_at is not null, false) into v_fora from public.obs_archive_months m
     where m.site_id = p_site and m.class = g.class and m.month = g.month limit 1;
    v_grupos := v_grupos || jsonb_build_object('classe', g.class, 'canal', g.channel_ref, 'mes', to_char(g.month, 'YYYY-MM'),
      'filho', (select p.filho from public.obs_archive_policy() p where p.class = g.class limit 1),
      'alvos', v_alvos, 'outras', v_outras, 'vazias', v_vazias, 'resumo', v_resumo,
      'mes_online', not coalesce(v_fora, false), 'dias_do_mes', extract(day from (g.month + interval '1 month' - interval '1 day'))::int);
  end loop;
  return jsonb_build_object('grupos', v_grupos, 'esperando', v_esperando);
end $$;
revoke all on function public.obs_archive_expurgo_open(uuid, bigint) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_open(uuid, bigint) to service_role;
```

(`record`, `block` e `unblock` continuam no mesmo trecho da parte 3.)

```sql
create or replace function public.obs_archive_expurgo_record(p_site uuid, p_item_id bigint, p_grupo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_grupo->>'classe'; v_canal text := p_grupo->>'canal'; v_mes date := (p_grupo->>'mes' || '-01')::date;
  v_corpo jsonb := p_grupo->'alvos'; v_res jsonb := p_grupo->'resumo';
  b jsonb; a public.obs_archive_item_targets; c public.obs_archive_units; v_ids bigint[]; v_copiar bigint[]; v_fora boolean;
  v_rem bigint; v_novo bigint; v_saida jsonb := '[]'::jsonb; v_ret jsonb; v_uid uuid; v_ver integer; v_arq text;
  v_max integer; v_lidas text[]; v_correntes text[]; v_pol record; v_primeiro bigint; v_novas integer := 0; v_sid uuid; v_sver integer;
  v_nova_cam text; v_nova_sha text; w record; ps record; pap text;
begin
  if v_class is null or v_canal is null or v_mes is null or jsonb_typeof(v_corpo) <> 'array' then
    return jsonb_build_object('status', 'recusado', 'motivo', 'forma');
  end if;
  if not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id) then
    raise exception 'item_desconhecido' using errcode = 'P0001';
  end if;
  -- as mesmas travas do record_core, em ordem de tabela, e a do resumo
  for b in select x from jsonb_array_elements(v_corpo) x order by x->>'tabela' loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint and t.site_id = p_site;
    if a.id is null then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item', 'alvo_id', (b->>'alvo_id')::bigint); end if;
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|unidade|' || a.class || '|' || a.table_name || '|' || a.channel_ref || '|' || a.month::text, 0));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|resumo|' || v_class || '||' || v_canal || '|' || v_mes::text, 0));
  select array_agg((x->>'alvo_id')::bigint order by (x->>'alvo_id')::bigint) into v_ids from jsonb_array_elements(v_corpo) x;
  -- 1. cada alvo é deste item e deste grupo, e está em copiar
  for a in select * from public.obs_archive_item_targets t where t.id = any(v_ids) and t.site_id = p_site order by t.id for update loop
    if a.item_id is distinct from p_item_id or a.class <> v_class or a.channel_ref <> v_canal or a.month <> v_mes then
      return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item', 'alvo_id', a.id);
    end if;
    if a.estado <> 'copiar' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_copiar', 'alvo_id', a.id); end if;
  end loop;
  if (select count(*) from public.obs_archive_item_targets t where t.id = any(v_ids) and t.site_id = p_site) <> coalesce(cardinality(v_ids), 0) then
    return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item');
  end if;
  -- 2. o corpo cobre todos os alvos copiar do item neste grupo
  select array_agg(t.id order by t.id) into v_copiar from public.obs_archive_item_targets t
   where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = v_class and t.channel_ref = v_canal and t.month = v_mes;
  if v_copiar is distinct from v_ids then return jsonb_build_object('status', 'recusado', 'motivo', 'grupo_incompleto'); end if;
  -- 3. a base: cada origem ainda é a corrente e está recebida
  for a in select * from public.obs_archive_item_targets t where t.id = any(v_ids) order by t.id loop
    select * into c from public.obs_archive_cur_group(p_site, a.class, a.channel_ref, a.month) x where x.table_name = a.table_name;
    if c.id is distinct from a.from_unit_id or c.received_at is null then
      return jsonb_build_object('status', 'recusado', 'motivo', 'base_mudou', 'alvo_id', a.id);
    end if;
  end loop;
  select coalesce(m.dropped_at is not null or m.detached_at is not null, false) into v_fora from public.obs_archive_months m
   where m.site_id = p_site and m.class = v_class and m.month = v_mes limit 1;
  v_fora := coalesce(v_fora, false);
  -- 4. a contagem: antes de qualquer escrita
  for b in select x from jsonb_array_elements(v_corpo) x order by (x->>'alvo_id')::bigint loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint;
    select * into c from public.obs_archive_units u where u.id = a.from_unit_id;
    v_rem := (b->>'removidas')::bigint;
    v_novo := (b->'unidade'->>'row_count')::bigint;
    if v_rem is null or v_rem < 0 or (v_rem > 0 and b->'unidade' is null) then return jsonb_build_object('status', 'recusado', 'motivo', 'forma', 'alvo_id', a.id); end if;
    if (v_rem = 0 and (a.esperadas > 0 or (a.esperadas is null and not v_fora)))
       or (a.esperadas is not null and v_rem > a.esperadas)
       or (v_rem > 0 and v_novo is distinct from c.row_count - v_rem) then
      update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'contagem_divergente', updated_at = now() where id = a.id;
      return jsonb_build_object('status', 'recusado', 'motivo', 'contagem_divergente', 'alvo_id', a.id);
    end if;
    if v_rem > 0 then v_novas := v_novas + 1; end if;
  end loop;
  -- 5. o resumo (só quando houve unidade nova)
  if v_novas > 0 then
    if v_res is null or jsonb_typeof(v_res) <> 'object' then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_forma'); end if;
    select coalesce(max(s.version), 0) into v_max from public.obs_archive_summaries s where s.site_id = p_site and s.class = v_class and s.channel_ref = v_canal and s.month = v_mes;
    if (v_res->>'versao')::int is distinct from v_max + 1 then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_versao_mudou'); end if;
    if (v_res->>'vazio') is null or ((v_res->>'vazio')::boolean) <> (v_res->>'canal_sha256' is null)
       or (v_res->>'canal_sha256' is not null and v_res->>'canal_sha256' !~ '^[0-9a-f]{64}$') then
      return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_forma');
    end if;
    select array_agg(x order by x) into v_lidas from jsonb_array_elements_text(coalesce(v_res->'tabelas_lidas', '[]'::jsonb)) x;
    select array_agg(x.table_name order by x.table_name) into v_correntes from public.obs_archive_cur_group(p_site, v_class, v_canal, v_mes) x where x.row_count > 0;
    if v_lidas is distinct from v_correntes then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_com_unidade_nao_lida'); end if;
  end if;
  -- 6. escreve (a marca do expurgo vale a transação inteira; o record_core a regrava em cada chamada, então o resumo a repõe)
  for b in select x from jsonb_array_elements(v_corpo) x order by (x->>'alvo_id')::bigint loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint;
    select * into c from public.obs_archive_units u where u.id = a.from_unit_id;
    v_rem := (b->>'removidas')::bigint;
    if v_rem = 0 then
      update public.obs_archive_item_targets set estado = 'sem_linhas', done_at = now(), updated_at = now() where id = a.id;
      v_saida := v_saida || jsonb_build_object('alvo_id', a.id, 'estado', 'sem_linhas');
      continue;
    end if;
    v_ret := public.obs_archive_record_core(p_site, 'unidade',
               (b->'unidade') || jsonb_build_object('classe', a.class, 'tabela', a.table_name, 'canal', a.channel_ref, 'mes', to_char(a.month, 'YYYY-MM-DD')), 'expurgo');
    v_uid := substr(v_ret->>'arquivo_id', 3)::uuid; v_ver := (v_ret->>'versao')::int;
    update public.obs_archive_item_targets set estado = 'aguardando_nova', to_unit_id = v_uid, to_version = v_ver, rows_removed = v_rem, updated_at = now() where id = a.id;
    select pol.filho into v_pol from public.obs_archive_policy() pol where pol.class = a.class and pol.table_name = a.table_name;
    -- a nova (vazia: nulos)
    select f->>'caminho', f->>'sha256' into v_nova_cam, v_nova_sha from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(v_uid)) f order by (f->>'parte')::int limit 1;
    -- TODAS as versões anteriores da unidade, inteira ou por parte (pula perdida e purgada)
    for w in select u.id, u.version, u.parts, u.sha256_bytes from public.obs_archive_units u
              where u.site_id = p_site and u.class = a.class and u.table_name = a.table_name and u.channel_ref = a.channel_ref and u.month = a.month
                and u.version < v_ver and u.lost_at is null and u.purged_at is null and u.row_count > 0 loop
      for ps in select (f->>'caminho') as caminho, (f->>'sha256') as sha from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(w.id)) f loop
        insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
        values (p_site, 'alvo:' || a.id, a.id, v_pol.filho, ps.caminho, false, ps.sha, v_nova_cam, v_nova_sha)
        on conflict (site_id, alvo, filho, prefixo) do nothing;
      end loop;
    end loop;
    v_saida := v_saida || jsonb_build_object('alvo_id', a.id, 'estado', 'aguardando_nova', 'arquivo_id', v_ret->>'arquivo_id', 'versao', v_ver);
  end loop;
  v_ret := null;
  if v_novas > 0 then
    perform set_config('obs_archive.origem', 'expurgo:' || pg_current_xact_id()::text, true);
    v_sver := v_max + 1;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows,
                                              unit_hashes, origem, received_at)
    values (p_site, v_class, v_canal, v_mes, v_sver, (v_res->>'vazio')::boolean, v_res->>'canal_sha256', (v_res->>'canal_bytes')::bigint, (v_res->>'canal_rows')::int,
            v_res->>'video_sha256', (v_res->>'video_bytes')::bigint, (v_res->>'video_rows')::int,
            public.obs_archive_channel_unit_hashes(p_site, v_class, v_canal, v_mes), 'expurgo', case when (v_res->>'vazio')::boolean then now() end)
    returning id into v_sid;
    v_primeiro := v_ids[1];
    select pol.filho into v_pol from public.obs_archive_policy() pol where pol.class = v_class limit 1;
    -- a versão anterior de CADA papel entra na ausência, mesmo se o papel novo ficou vazio (nova nula)
    for w in select s.id, s.version, s.canal_sha256, s.video_sha256, s.ficha_sha256 from public.obs_archive_summaries s
              where s.site_id = p_site and s.class = v_class and s.channel_ref = v_canal and s.month = v_mes and s.version < v_sver and s.lost_at is null and s.purged_at is null loop
      foreach pap in array array['canal', 'video', 'ficha'] loop
        if (case pap when 'canal' then w.canal_sha256 when 'video' then w.video_sha256 else w.ficha_sha256 end) is null then continue; end if;
        v_nova_sha := case pap when 'canal' then v_res->>'canal_sha256' when 'video' then v_res->>'video_sha256' else null end;
        v_nova_cam := case when v_nova_sha is null then null else
          v_class || '/canais/' || v_canal || '/resumo/' || to_char(v_mes, 'YYYY-MM') || '.v' || v_sver || '.' || pap || '.csv.gz' end;
        insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
        values (p_site, 'alvo:' || v_primeiro, v_primeiro, v_pol.filho,
                v_class || '/canais/' || v_canal || '/resumo/' || to_char(v_mes, 'YYYY-MM') || '.v' || w.version || '.' || pap || '.csv.gz', false,
                case pap when 'canal' then w.canal_sha256 when 'video' then w.video_sha256 else w.ficha_sha256 end, v_nova_cam, v_nova_sha)
        on conflict (site_id, alvo, filho, prefixo) do nothing;
      end loop;
    end loop;
    update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'expurgo'
     where site_id = p_site and class = v_class and month = v_mes and sealed_at is not null;
    v_ret := jsonb_build_object('arquivo_id', 's:' || v_sid, 'versao', v_sver);
  end if;
  return jsonb_build_object('status', 'ok', 'alvos', v_saida, 'resumo', v_ret);
end $$;
revoke all on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) to service_role;

create or replace function public.obs_archive_expurgo_block(p_site uuid, p_item_id bigint, p_alvo bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_item_targets;
begin
  if p_motivo not in ('antiga_ausente', 'antiga_divergente', 'grande_demais', 'contagem_divergente') then
    return jsonb_build_object('status', 'recusado', 'motivo', 'forma');
  end if;
  select * into a from public.obs_archive_item_targets t where t.id = p_alvo and t.site_id = p_site for update;
  if a.id is null then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  if a.estado <> 'copiar' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_copiar', 'alvo_id', a.id); end if;
  update public.obs_archive_item_targets set estado = 'bloqueado', motivo = p_motivo, updated_at = now() where id = a.id;
  return jsonb_build_object('status', 'ok', 'alvo_id', a.id);
end $$;
revoke all on function public.obs_archive_expurgo_block(uuid, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_block(uuid, bigint, bigint, text) to service_role;

-- Só o dono, pelo SQL do painel (D-M9-5): volta um alvo bloqueado a copiar. depende_m10b só sai quando a M10b existir.
create or replace function public.obs_archive_expurgo_unblock(p_site uuid, p_alvo bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_item_targets;
begin
  select * into a from public.obs_archive_item_targets t where t.id = p_alvo and t.site_id = p_site for update;
  if a.id is null then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  if a.estado <> 'bloqueado' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_bloqueado'); end if;
  if a.motivo = 'depende_m10b' then return jsonb_build_object('status', 'recusado', 'motivo', 'depende_m10b'); end if;
  update public.obs_archive_item_targets set estado = 'copiar', motivo = null, updated_at = now() where id = a.id;
  return jsonb_build_object('status', 'ok', 'alvo_id', a.id);
end $$;
revoke all on function public.obs_archive_expurgo_unblock(uuid, bigint) from public, anon, authenticated, service_role;
```

(Detalhes a conferir no Passo 4: `v_nova_sha`/`v_nova_cam` do resumo reaproveitam as variáveis da unidade, e o `select f->>'caminho', f->>'sha256' into` precisa de `limit 1` sobre a unidade vazia, que devolve nulos, como o `check` de `obs_archive_absence` exige; e a marca do expurgo (`set_config`) é regravada pelo `record_core` em **toda** chamada, por isso o resumo repõe antes do `insert`.)

- [ ] **Passo 4.** Rodar o teste. Se algum SQL acima não rodar como escrito (nome de coluna, `limit 1` em lateral), corrigir no próprio `m9.sql` e anotar o ajuste no ledger; o teste decide, não o texto do plano.

- [ ] **Passo 5. Commit** (quando o controlador mandar): `m9.sql` e o teste; `feat: M9 parte 3: abrir e registrar o expurgo (rascunho)`.

---

### Task 4: SQL parte 4, a prova de ausência (NAS, snapshots, B2), os marcos da remoção, o reaparecimento e o fechamento dos alvos no "Apagar canal"

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 4:`)
- Create: `apps/web/test/integration/manutencao-m9-ausencia.test.ts`

**Interfaces:**
- Consumes: partes 1 a 3; `obs_archive_b2_runs` (estado `controle_ok`, `expires_at`), `obs_archive_channel_removals`, `obs_archive_batches` (lote da E10: colunas `deleted_at`, `closed_at`, `channel_ref`; conferidas em `supabase/migrations/20261014000002_observatorio_a5_e10_export_pausa_e_limite.sql:30-71`: `kind`, `channel_ref`, `deleted_at`, `closed_at`).
- Produces: `obs_archive_removal_open_rows(p_site, p_channel text)`, gatilho `obs_archive_canal_apagado`, `obs_archive_prefixos_ausentes(p_site uuid, p_origem text) returns jsonb`, `obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_execucao uuid, p_filhos jsonb, p_prefixos jsonb) returns jsonb`, `obs_archive_reabrir(p_linha bigint, p_nivel text)`, `obs_archive_removal_advance(p_site uuid)`.

**O que acontece quando o dado não existe:** sem sentinela do filho a ausência **não conta** (`filho_fora`); B2 sem `controle_ok` vigente na execução não conta (`controle_pendente`); snapshot `indisponivel` ou não medido: a linha fica sem `snap_absent_at` e o B2 nem é perguntado; lista de arquivos do canal vazia: o canal só tem prefixo (conclui pela prova do prefixo ou, sem linha nenhuma, "canal sem arquivo conhecido conclui"); interruptor desligado: `prefixos_ausentes` é `[]` e `removal_advance`/`item_advance` não avançam nada.

- [ ] **Passo 1. Testes, falhando** (`manutencao-m9-ausencia.test.ts`, `aplicarM9(c, 4)`, `begin … rollback`; semente: canal removido com decisão `apagar` e unidades das classes `serie` e `texto`, e um alvo `aguardando_nova` com linhas de ausência `alvo:<id>`):

| Teste | Afirma |
|---|---|
| `canal_apagado_fecha_alvos_de_item` | inserir a remoção `apagar` do canal que tem alvos abertos: os alvos viram `concluido` com `motivo_fim = 'canal_apagado'` (inclusive `bloqueado`: `motivo` nulo), as linhas `alvo:<id>` e `antiga:` ganham `encerrada_at`, nascem as linhas `canal:<ref>` (um prefixo por classe presente, mais `_recebendo/<prefixo>` e `_recebendo/_quarentena/<prefixo>`), `liberado_em` preenchido; chamar `competitor_channel_remove` e depois `obs_archive_expurgo_record` do alvo fechado devolve `alvo_fora_de_copiar` (o `obs:arquivo` não recebe 409 em loop) |
| `sonda_custo_ausencia` (emenda 23/10, N-M9-4, Yannis I11) | inserir 5.000 linhas em `obs_archive_absence` e 2.000 alvos; rodar `obs_archive_prefixos_ausentes` e `obs_archive_item_advance` com `explain (analyze, buffers)`; afirma que o plano usa o índice parcial `(site_id, item_id) where b2_absent_at is null` (sem `Seq Scan` em `obs_archive_absence`); a medida vai ao ledger |
| `prefixos_ausentes: desligado` | interruptor desligado: `obs_archive_prefixos_ausentes(site, 'nas')` é `[]` |
| `prefixos_ausentes: nas e b2` | ligado: `nas` traz as linhas liberadas e abertas (`{alvo, filho, prefixo, e_prefixo, provar_snapshots}`, `provar_snapshots` verdadeiro só com `nas_absent_at` e sem `snap_absent_at`); `b2` traz só as com `snap_absent_at`, sem `b2_absent_at` e com `nas_last_absent_at` de menos de 24 h; teto de 2000 e ordem estável (`coalesce(nas_last_absent_at, nas_present_at)` nulos primeiro, depois `id`) |
| `ausente_sem_sentinela_nao_conta` | `attest_prefixos('nas')` com o filho `sentinela: false`: resposta `recusado/filho_fora` e nenhuma coluna muda |
| `ausente: duas execuções com 11 h` | 1ª `ausente`: grava `nas_absent_first_at`, `nas_last_absent_at`, sem `nas_absent_at`; 2ª com menos de 11 h: só `nas_last_absent_at`; 3ª com 11 h ou mais (relógio por `update … set nas_absent_first_at = now() - interval '11 hours'`): grava `nas_absent_at` |
| `snapshot_presente_segura_o_b2` | `snapshots: 'presente'` + `snapshot_mais_antigo`: `snap_oldest` e `snap_checked_at` gravados, `snap_absent_at` nulo, a linha **não** entra na lista `b2`; o item/canal fica em `falta 'snapshots'` (Tarefa 5); `snapshots: 'indisponivel'`: só `snap_checked_at`; `snapshots: 'ausente'` antes de `nas_absent_at`: ignorado |
| `snapshot ausente libera o b2` | com `nas_absent_at` e `snapshots: 'ausente'`: `snap_absent_at` gravado e a linha entra na lista `b2` |
| `b2_sem_canario_nao_conta` | `attest_prefixos('b2')` com `execucao_id` de run `aguardando_controle`, `controle_falhou` ou `expires_at` vencido: todos `recusado/controle_pendente`; sem `snap_absent_at`: `recusado/snapshots_pendentes`; NAS conferido há mais de 24 h: `recusado/conferencia_nas_velha` |
| `b2: ausente e presente` | `nomes: []` com tudo em ordem: `b2_absent_at` e `b2_checked_at`; `nomes` com itens (qualquer ação, inclusive nome escondido): `b2_present_at`, `b2_nomes` (no máximo 20) e, se já havia `b2_absent_at`, só o estágio B2 reabre (`b2_absent_at` nulo; NAS e snapshot intactos) |
| `prefixo_presente_reabre_e_conta` | NAS `presente` numa linha que já tinha `nas_absent_at`: zera `nas_*`, `snap_*` e `b2_*` da linha, `nas_present_at`, e o alvo (se havia passado de `apagar_antigas`) volta a `apagar_antigas` com `archive_pending` religado (Phil m3); canal: `completed_at`/`nas_absent_at`/`b2_absent_at`/`snapshots_clear_on` zerados e `reappeared_count + 1` |
| `presenca_normal_nao_reabre` | `presente` antes de qualquer `*_absent_at`: só zera `nas_absent_first_at`, grava `nas_present_at`, **sem** `reappeared_*` nem mudança de estado |
| `removal_advance` | com todas as linhas do canal `nas_absent_at`: `removals.nas_absent_at`, `nas_last_absent_at`; todas `snap_absent_at`: `snapshots_clear_on` = data SP do `snap_absent_at`; todas `b2_absent_at` + `blobs_pending` vazio + (`online_thumbs_known` ou ack) + sem lote E10 aberto: `completed_at` e linhas `encerrada_at`; faltando qualquer um: não conclui; canal sem nenhuma linha e sem blobs: conclui ("canal sem arquivo conhecido") |
| `lote_e10_aberto_segura` | `obs_archive_batches` do canal com `deleted_at` e `closed_at` nulos: não conclui |
| `ordem estável` | `removal_advance` percorre os canais por `channel_ref` (sem deadlock com dois canais) |
| `permissões` | `obs_archive_prefixos_ausentes` e `obs_archive_attest_prefixos`: `service_role` verdadeiro, `anon`/`authenticated` falso; `reabrir`, `removal_advance`, `removal_open_rows`: falso para todos |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 4** (`m9.sql`):

```sql
-- M9 PARTE 4: prova de ausência, marcos da remoção, reaparecimento

-- Os prefixos do canal: um por (filho, classe) com unidade ou resumo, mais os dois de _recebendo. Idempotente.
create or replace function public.obs_archive_removal_open_rows(p_site uuid, p_channel text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct pol.filho, c.class
      from (select u.class from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = p_channel
            union select s.class from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = p_channel) c
      join (select distinct class, filho from public.obs_archive_policy()) pol on pol.class = c.class
  loop
    insert into public.obs_archive_absence (site_id, alvo, canal_ref, filho, prefixo, e_prefixo, liberado_em)
    select p_site, 'canal:' || p_channel, p_channel, r.filho, x.prefixo, true, now()
      from (values (r.class || '/canais/' || p_channel), ('_recebendo/' || r.class || '/canais/' || p_channel),
                   ('_recebendo/_quarentena/' || r.class || '/canais/' || p_channel)) x(prefixo)
    on conflict (site_id, alvo, filho, prefixo) do nothing;
    get diagnostics v_n = row_count;
  end loop;
  return v_n;
end $$;
revoke all on function public.obs_archive_removal_open_rows(uuid, text) from public, anon, authenticated, service_role;

-- "Apagar canal" (decisão apagar): fecha os alvos de item em voo (Phil C6, Yannis I7) e abre as linhas do canal.
create or replace function public.obs_archive_canal_apagado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archive_decision = 'apagar' then
    update public.obs_archive_absence a set encerrada_at = now()
     where a.site_id = new.site_id and a.encerrada_at is null
       and ((a.alvo_id is not null and exists (select 1 from public.obs_archive_item_targets t where t.id = a.alvo_id and t.channel_ref = new.channel_ref and t.done_at is null))
         or (a.unidade_id is not null and exists (select 1 from public.obs_archive_units u where u.id = a.unidade_id and u.channel_ref = new.channel_ref)));
    update public.obs_archive_item_targets t
       set estado = 'concluido', motivo = null, motivo_fim = 'canal_apagado', done_at = now(), updated_at = now()
     where t.site_id = new.site_id and t.channel_ref = new.channel_ref and t.done_at is null;
    perform public.obs_archive_removal_open_rows(new.site_id, new.channel_ref);
  end if;
  return null;
end $$;
revoke all on function public.obs_archive_canal_apagado() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_canal_apagado on public.obs_archive_channel_removals;
create trigger obs_archive_canal_apagado after insert or update of archive_decision on public.obs_archive_channel_removals
  for each row execute function public.obs_archive_canal_apagado();

-- Remoções que já existiam antes da M9 ganham as linhas.
select public.obs_archive_removal_open_rows(site_id, channel_ref) from public.obs_archive_channel_removals
 where archive_decision = 'apagar' and completed_at is null;

create or replace function public.obs_archive_prefixos_ausentes(p_site uuid, p_origem text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.obs_archive_m9_ligado(p_site) then return '[]'::jsonb; end if;
  if p_origem = 'nas' then
    return coalesce((select jsonb_agg(jsonb_build_object('alvo', q.alvo, 'filho', q.filho, 'prefixo', q.prefixo, 'e_prefixo', q.e_prefixo,
                      'provar_snapshots', q.nas_absent_at is not null and q.snap_absent_at is null) order by q.ord, q.id)
                      from (select a.*, coalesce(a.nas_last_absent_at, a.nas_present_at) is not null as ord_f,
                                   row_number() over (order by coalesce(a.nas_last_absent_at, a.nas_present_at) nulls first, a.id) as ord
                              from public.obs_archive_absence a
                             where a.site_id = p_site and a.liberado_em is not null and a.encerrada_at is null
                             order by coalesce(a.nas_last_absent_at, a.nas_present_at) nulls first, a.id limit 2000) q), '[]'::jsonb);
  elsif p_origem = 'b2' then
    return coalesce((select jsonb_agg(jsonb_build_object('alvo', q.alvo, 'filho', q.filho, 'prefixo', q.prefixo, 'e_prefixo', q.e_prefixo) order by q.id)
                      from (select a.* from public.obs_archive_absence a
                             where a.site_id = p_site and a.liberado_em is not null and a.encerrada_at is null
                               and a.snap_absent_at is not null and a.b2_absent_at is null and a.nas_last_absent_at > now() - interval '24 hours'
                             order by a.b2_checked_at nulls first, a.id limit 2000) q), '[]'::jsonb);
  end if;
  return '[]'::jsonb;
end $$;
revoke all on function public.obs_archive_prefixos_ausentes(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_prefixos_ausentes(uuid, text) to service_role;

-- Reaparecimento: o arquivo voltou DEPOIS de ter sido dado como ausente (nível 'nas': recomeça tudo; 'b2': só o estágio B2).
create or replace function public.obs_archive_reabrir(p_linha bigint, p_nivel text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_absence;
begin
  select * into a from public.obs_archive_absence x where x.id = p_linha for update;
  if a.id is null then return; end if;
  if p_nivel = 'nas' then
    update public.obs_archive_absence set nas_absent_first_at = null, nas_absent_at = null, nas_last_absent_at = null, nas_present_at = now(),
           snap_absent_at = null, snap_oldest = null, snap_checked_at = null, b2_absent_at = null, b2_checked_at = null, b2_nomes = '{}', encerrada_at = null
     where id = a.id;
  else
    update public.obs_archive_absence set b2_absent_at = null, b2_present_at = now(), encerrada_at = null where id = a.id;
  end if;
  if a.alvo_id is not null then
    update public.obs_archive_item_targets t
       set estado = case when p_nivel = 'nas' then 'apagar_antigas' else 'conferir_b2' end, done_at = null, motivo_fim = null, updated_at = now()
     where t.id = a.alvo_id and t.estado in ('conferir_b2', 'concluido', 'apagar_antigas') and t.motivo_fim is null;
    -- religa a bandeira do item (Phil m3)
    update public.competitor_removed_items i set archive_pending = true, archive_note = null
     where i.site_id = a.site_id and exists (select 1 from public.obs_archive_item_targets t where t.id = a.alvo_id and t.item_kind = i.kind and i.youtube_id = any(t.item_refs));
  elsif a.canal_ref is not null then
    update public.obs_archive_channel_removals r
       set completed_at = null, b2_absent_at = null, snapshots_clear_on = null,
           nas_absent_at = case when p_nivel = 'nas' then null else r.nas_absent_at end,
           nas_absent_first_at = case when p_nivel = 'nas' then null else r.nas_absent_first_at end,
           reappeared_at = now(), reappeared_count = r.reappeared_count + 1
     where r.site_id = a.site_id and r.channel_ref = a.canal_ref;
  end if;
end $$;
revoke all on function public.obs_archive_reabrir(bigint, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_execucao uuid, p_filhos jsonb, p_prefixos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; a public.obs_archive_absence; v_saida jsonb := '[]'::jsonb; v_resp text; v_mot text; v_run public.obs_archive_b2_runs; v_nomes text[]; v_estado text; v_snap text;
  v_filho_ok boolean; v_controle boolean := false;
begin
  if p_fonte not in ('nas', 'b2') then raise exception 'forma' using errcode = 'P0001'; end if;
  if p_fonte = 'b2' then
    select * into v_run from public.obs_archive_b2_runs r where r.id = p_execucao and r.site_id = p_site;
    v_controle := v_run.id is not null and v_run.estado = 'controle_ok' and v_run.expires_at > now();
  end if;
  for it in select x from jsonb_array_elements(coalesce(p_prefixos, '[]'::jsonb)) x loop
    v_resp := 'recusado'; v_mot := null;
    select * into a from public.obs_archive_absence x
     where x.site_id = p_site and x.alvo = it->>'alvo' and x.filho = it->>'filho' and x.prefixo = it->>'prefixo' for update;
    v_estado := it->>'estado';
    if a.id is null then v_mot := 'desconhecido';
    elsif a.liberado_em is null or a.encerrada_at is not null then v_mot := 'nao_aberto';
    elsif p_fonte = 'nas' then
      v_filho_ok := coalesce((p_filhos->(a.filho)->>'montado')::boolean, false) and coalesce((p_filhos->(a.filho)->>'sentinela')::boolean, false);
      v_snap := it->>'snapshots';
      if not v_filho_ok then v_mot := 'filho_fora';
      elsif v_estado = 'presente' then
        if a.nas_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'nas');
        else update public.obs_archive_absence set nas_absent_first_at = null, nas_last_absent_at = null, nas_present_at = now() where id = a.id; end if;
        v_resp := 'aceito';
      elsif v_estado = 'ausente' then
        update public.obs_archive_absence set
               nas_absent_first_at = coalesce(nas_absent_first_at, now()),
               nas_last_absent_at = now(),
               nas_absent_at = case when nas_absent_at is not null then nas_absent_at
                                    when nas_absent_first_at is not null and now() - nas_absent_first_at >= interval '11 hours' then now() end
         where id = a.id returning * into a;
        -- snapshots: só valem com a ausência no dataset já provada (duas execuções)
        if a.nas_absent_at is not null and v_snap in ('ausente', 'presente', 'indisponivel') then
          update public.obs_archive_absence set
                 snap_checked_at = now(),
                 snap_oldest = case when v_snap = 'indisponivel' then snap_oldest else nullif(it->>'snapshot_mais_antigo', '')::date end,
                 snap_absent_at = case when v_snap = 'ausente' then coalesce(snap_absent_at, now()) when v_snap = 'presente' then null else snap_absent_at end
           where id = a.id;
        end if;
        v_resp := 'aceito';
      else v_mot := 'forma';
      end if;
    else   -- b2
      if not v_controle then v_mot := 'controle_pendente';
      elsif v_estado = 'ausente' and a.snap_absent_at is null then v_mot := 'snapshots_pendentes';
      elsif v_estado = 'ausente' and not (a.nas_last_absent_at > now() - interval '24 hours') then v_mot := 'conferencia_nas_velha';
      elsif v_estado in ('ausente', 'presente') then
        select coalesce(array_agg(x), '{}') into v_nomes from (select jsonb_array_elements_text(coalesce(it->'nomes', '[]'::jsonb)) x limit 20) q;
        if v_estado = 'presente' and cardinality(v_nomes) = 0 then v_mot := 'forma';
        elsif v_estado = 'ausente' and coalesce(jsonb_array_length(it->'nomes'), 0) > 0 then v_mot := 'forma';
        elsif v_estado = 'presente' then
          if a.b2_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'b2'); end if;
          update public.obs_archive_absence set b2_present_at = now(), b2_checked_at = now(), b2_nomes = v_nomes where id = a.id;
          v_resp := 'aceito';
        else
          update public.obs_archive_absence set b2_absent_at = coalesce(b2_absent_at, now()), b2_checked_at = now(), b2_nomes = '{}' where id = a.id;
          v_resp := 'aceito';
        end if;
      else v_mot := 'forma';
      end if;
    end if;
    v_saida := v_saida || jsonb_strip_nulls(jsonb_build_object('alvo', it->>'alvo', 'filho', it->>'filho', 'prefixo', it->>'prefixo', 'resposta', v_resp, 'motivo', v_mot));
  end loop;
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);
  return jsonb_build_object('prefixos', v_saida);
end $$;
revoke all on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) to service_role;

create or replace function public.obs_archive_removal_advance(p_site uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; g record; v_conclui boolean;
begin
  if not public.obs_archive_m9_ligado(p_site) then return; end if;
  for r in select * from public.obs_archive_channel_removals x
            where x.site_id = p_site and x.archive_decision = 'apagar' and x.completed_at is null order by x.channel_ref for update loop
    select count(*) as n, count(*) filter (where a.nas_absent_at is not null) as n_nas, count(*) filter (where a.snap_absent_at is not null) as n_snap,
           count(*) filter (where a.b2_absent_at is not null) as n_b2, min(a.nas_absent_first_at) as primeiro, max(a.nas_absent_at) as nas_em,
           min(a.nas_last_absent_at) as ultimo, max(a.snap_absent_at) as snap_em, max(a.b2_absent_at) as b2_em
      into g from public.obs_archive_absence a
     where a.site_id = p_site and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null;
    update public.obs_archive_channel_removals set
           nas_absent_first_at = coalesce(g.primeiro, nas_absent_first_at),
           nas_absent_at = case when g.n > 0 and g.n_nas = g.n then g.nas_em else null end,
           nas_last_absent_at = case when g.n > 0 and g.n_nas = g.n then g.ultimo else nas_last_absent_at end,
           snapshots_clear_on = case when g.n > 0 and g.n_snap = g.n then (g.snap_em at time zone 'America/Sao_Paulo')::date else null end,
           b2_absent_at = case when g.n > 0 and g.n_b2 = g.n then g.b2_em else null end
     where site_id = r.site_id and channel_ref = r.channel_ref;
    v_conclui := (g.n = 0 or g.n_b2 = g.n)
             and cardinality(r.blobs_pending) = 0 and (r.online_thumbs_known or r.thumbs_unknown_ack_at is not null)
             and not exists (select 1 from public.obs_archive_batches b where b.site_id = r.site_id and b.kind = 'canal' and b.channel_ref = r.channel_ref and b.deleted_at is null and b.closed_at is null);
    if v_conclui then
      update public.obs_archive_channel_removals set completed_at = now() where site_id = r.site_id and channel_ref = r.channel_ref;
      update public.obs_archive_absence set encerrada_at = now() where site_id = p_site and alvo = 'canal:' || r.channel_ref and encerrada_at is null;
    end if;
  end loop;
end $$;
revoke all on function public.obs_archive_removal_advance(uuid) from public, anon, authenticated, service_role;
```

(`obs_archive_item_advance` nasce na parte 5; `plpgsql` resolve o nome na chamada. O `row_number` do `nas` é ruído que o executor pode remover: a ordem já vem do `limit` interno; o teste `prefixos_ausentes: nas e b2` amarra a ordem. Confirmar no Passo 4 o nome das colunas de `obs_archive_batches`. A frase "NAS conferido há mais de 24 h" usa `nas_last_absent_at` da própria linha; para o canal inteiro o `removal_advance` usa o mínimo entre as linhas.)

- [ ] **Passo 4.** Os nomes de `obs_archive_batches` (`kind`, `channel_ref`, `deleted_at`, `closed_at`) foram lidos na migration da E10 (já em produção, `20261014000002`); se o banco local de integração ainda não a tem, o `aplicarM9` aplica antes o trecho da tabela (`semearE10Lotes`, no helper). Rodar o teste → PASS.

- [ ] **Passo 5. Commit** (quando o controlador mandar): `feat: M9 parte 4: prova de ausência, reaparecimento e fechamento dos alvos no Apagar canal (rascunho)`.

---

### Task 5: SQL partes 5 e 6, o avanço dos itens, as versões superadas de texto, os wrappers do plano e as pendências na `versao 2`

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 5:` e `-- M9 PARTE 6:`)
- Create: `apps/web/test/integration/manutencao-m9-avanco.test.ts` (parte 5), `apps/web/test/integration/manutencao-m9-pendencias.test.ts` (parte 6)

**Interfaces:**
- Consumes: partes 1 a 4; `obs_archive_agora()`, `obs_archive_hoje_sp()`, `obs_archive_is_site_admin(uuid, uuid)` (M3b, `m3b.sql:35, 420, 1441`); `obs_archive_plan`, `obs_archive_b2_plan`, `obs_archive_removed_channel_list` (M3b; renomeadas aqui para `*_base`).
- Produces (parte 5): `obs_archive_item_falta(p_alvo bigint) returns text`, `obs_archive_item_advance(p_site uuid) returns integer`, `obs_archive_antigas_open(p_site uuid)`, gatilho `obs_archive_manifesto_antigo`, `obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean)`, `obs_archive_apagar_do_item`, `obs_archive_apagar_da_antiga`, `obs_archive_arquivos_do_canal`, `obs_archive_removal_blobs_done` (Tarefa 13, mesma parte), `obs_archive_etapa(...)`.
- Produces (parte 6): `*_base` (renomeadas), `obs_archive_plan`, `obs_archive_b2_plan`, `obs_archive_removed_channel_list` (wrappers), `obs_archive_owner_pending(p_site uuid default null)` na `versao 2` (só lê), `obs_archive_vermelhos` com `captura_ausente` (dentro do wrapper do plano).

**O que acontece quando o dado não existe:** nenhum item e nenhuma remoção aberta: `{ versao: 2, lido_em, total: 0, itens: [] }` (zero medido). Alvo cuja nova ainda não foi recebida: `sem_comando` com `falta 'unidade_no_nas'` (nunca `apagar_antigas`: a única cópia antiga nunca sai antes). Versão superada de texto sem conferência do B2 da nova: não entra. Interruptor desligado: o tempo seguinte ao copiar vira `sem_comando`/`falta 'm9_desligado'`. Erro em qualquer leitura interna: a função sobe o erro (nunca `itens: []`).

- [ ] **Passo 1. Testes da parte 5, falhando** (`manutencao-m9-avanco.test.ts`, `aplicarM9(c, 5)`, `begin … rollback`; o relógio é `obs_archive_agora()`, que o teste da M3b já sabe deslocar):

| Teste | Afirma |
|---|---|
| `item_falta: a ordem` | alvo `aguardando_nova` com a nova sem `received_at`: `unidade_no_nas`; recebida sem `nas_attested_at`: idem; nova vazia: dispensada; resumo do expurgo sem `received_at`/`nas_attested_at`: `resumo`; mês com `unsealed_reason = 'expurgo'` ou `sealed_at <= u.received_at`: `manifesto`; sem `b2_files.last_ok_at` para `u:<id>` (ou `p:<id>:NN`) e `s:<id>:<papel>`: `b2_nova`; tudo pronto e interruptor desligado: `m9_desligado`; ligado: nulo |
| `antiga_so_sai_depois_da_nova_conferida` (Review Focus 1) | enquanto `item_falta` não é nulo, `item_advance` não muda o alvo e as linhas de ausência seguem sem `liberado_em`; quando é nulo e o interruptor está ligado, o alvo vai a `apagar_antigas`, as linhas ganham `liberado_em`, as versões anteriores da unidade e do resumo ganham `superseded_at` |
| `item_advance: desligado` | interruptor desligado: nenhum alvo muda de estado, mas `archive_pending` de item sem alvo aberto vira falso com `archive_note = 'arquivo limpo'` |
| `apagar_antigas -> conferir_b2 -> concluido` | todas as linhas com `snap_absent_at`: alvo `conferir_b2`; todas com `b2_absent_at`: `concluido`, `done_at`, linhas `encerrada_at`, `archive_pending` falso nos itens cujas chaves já não estão em nenhum alvo aberto; alvo sem nenhuma linha de ausência: `concluido` direto |
| `bandeira por chave` | dois itens no mesmo alvo: concluir o alvo desliga os dois; item com chave em outro alvo ainda aberto continua ligado; `reabrir` religa (`archive_note` nulo) |
| `manifesto antigo` | `update obs_archive_months set manifest_version = manifest_version + 1` num mês com alvo `aguardando_nova`: duas linhas `alvo:<min id>` (json e sha256) com `nova_*` do manifesto novo; mês sem alvo aberto: nenhuma |
| `reconferir não pede a antiga superada` | depois de `item_advance` marcar `superseded_at` na unidade antiga, `obs_archive_plan(...)->'reconferir'` não traz essa unidade (o conjunto corrente de `obs_archive_month_files` já a exclui, `m3b.sql:505-540`; NÃO VERIFICADO 6, resolvido por leitura) |
| `texto superado aos 30 dias` | (r1 29/10) unidade `texto` v1 superada pela v2: conta 30 dias de `received_at` da v2, e só libera com NAS atestado há ≤ 48 h e **todas** as partes da v2 conferidas no B2 há ≤ 7 dias, v2 sem perda/retirada: `antigas_open` cria linhas `antiga:<v1>` (uma por parte se `parts > 1`), `liberado_em` preenchido; 29 dias, NAS velho ou parte da v2 sem B2: nenhuma linha (testes (a) a (e) do Phil) |
| `texto superado em partes` | (r1 29/10, Phil e Yannis) unidade `texto` v1 com `parts > 1` superada pela v2: uma linha `antiga:` por parte da v1 (vale a regra acima; a versão anterior "não vira antiga" foi revogada) |
| `marcar_rodado` | sem admin: `sem_permissao`; `item:<id>` grava `competitor_removed_items.marcado_rodado_em`; `canal:<ref>` grava na remoção; `antiga:<uuid>` recusado `item_invalido`; `p_desfazer` zera; id inexistente: `item_desconhecido` |
| `arquivos_do_canal` | todas as versões, partes e papéis de resumo do canal com `sha256`, inclusive purgadas e perdidas (D-M9-10: o registro é o que se conhece) |
| `permissões` | `service_role`: `marcar_rodado`; os demais helpers, falso para todos |

- [ ] **Passo 2. A parte 5** (`m9.sql`):

```sql
-- M9 PARTE 5: avanço dos itens, versões superadas de texto, já rodei

-- O que ainda falta para o alvo aguardando_nova poder apagar a antiga (D-M9-16): a primeira falta, na ordem.
create or replace function public.obs_archive_item_falta(p_alvo bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare t public.obs_archive_item_targets; u public.obs_archive_units; s public.obs_archive_summaries;
begin
  select * into t from public.obs_archive_item_targets x where x.id = p_alvo;
  if t.id is null or t.estado <> 'aguardando_nova' then return null; end if;
  select * into u from public.obs_archive_units x where x.id = t.to_unit_id;
  if u.row_count > 0 and (u.received_at is null or u.nas_attested_at is null) then return 'unidade_no_nas'; end if;
  select * into s from public.obs_archive_summaries x
   where x.site_id = t.site_id and x.class = t.class and x.channel_ref = t.channel_ref and x.month = t.month and x.lost_at is null and x.purged_at is null
   order by x.version desc limit 1;
  if s.id is not null and not s.empty and (s.received_at is null or s.nas_attested_at is null) then return 'resumo'; end if;
  -- o manifesto novo: o mês foi selado de novo DEPOIS da unidade nova e o B2 o atestou depois do selo (conferir no teste: NÃO VERIFICADO 12)
  if exists (select 1 from public.obs_archive_months m
              where m.site_id = t.site_id and m.class = t.class and m.table_name = t.table_name and m.month = t.month
                and not (m.sealed_at is not null and m.unsealed_at is null and m.sealed_at > coalesce(u.received_at, u.exported_at))) then return 'manifesto'; end if;
  if u.row_count > 0 and exists (
       select 1 from (select 'u:' || u.id as aid where u.parts = 1
                      union all select 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0') from public.obs_archive_unit_parts pt where pt.unit_id = u.id and u.parts > 1) f
        where not exists (select 1 from public.obs_archive_b2_files b where b.site_id = t.site_id and b.arquivo_id = f.aid and b.last_ok_at is not null)) then return 'b2_nova'; end if;
  if s.id is not null and not s.empty and exists (
       select 1 from (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
        where k.sha is not null and not exists (select 1 from public.obs_archive_b2_files b where b.site_id = t.site_id
                                                  and b.arquivo_id = 's:' || s.id || ':' || k.papel and b.last_ok_at is not null)) then return 'b2_nova'; end if;
  if exists (select 1 from public.obs_archive_months m where m.site_id = t.site_id and m.class = t.class and m.table_name = t.table_name and m.month = t.month
                and (m.b2_attested_at is null or m.b2_attested_at < m.sealed_at)) then return 'b2_nova'; end if;
  if not public.obs_archive_m9_ligado(t.site_id) then return 'm9_desligado'; end if;
  return null;
end $$;
revoke all on function public.obs_archive_item_falta(bigint) from public, anon, authenticated, service_role;

-- A etapa de uma prova de ausência (itens, canais, versões superadas): 'apagar_antigas', 'conferir_b2' ou a falta que segura.
create or replace function public.obs_archive_etapa(p_sem_primeiro bigint, p_sem_nas bigint, p_sem_snap bigint, p_min_last timestamptz,
                                                    p_nao_checado bigint, p_lig boolean, p_agora timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_sem_primeiro > 0 then 'apagar_antigas'
    when not p_lig then 'm9_desligado'
    when p_sem_nas > 0 then 'segunda_conferencia'
    when p_sem_snap > 0 then 'snapshots'
    when p_min_last is null or p_min_last < p_agora - interval '24 hours' then 'conferencia_nas_recente'
    when p_nao_checado > 0 then 'b2_sync'
    else 'conferir_b2' end
$$;
revoke all on function public.obs_archive_etapa(bigint, bigint, bigint, timestamptz, bigint, boolean, timestamptz) from public, anon, authenticated, service_role;

-- Versão superada de texto: 30 dias depois de a seguinte estar atestada no NAS e conferida no B2 (02 §11.3; item 110).
-- Cobre a antiga `o` com partes; a referência `nx` é o primeiro arquivo da nova (declarado: nx multi-parte aponta a parte 1).
create or replace function public.obs_archive_antigas_open(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; k integer;
begin
  insert into public.obs_archive_absence (site_id, alvo, unidade_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256, liberado_em)
  select p_site, 'antiga:' || o.id, o.id, 'texto', f->>'caminho', false, f->>'sha256', nf->>'caminho', nf->>'sha256', public.obs_archive_agora()
    from public.obs_archive_units o
    join lateral (select x.* from public.obs_archive_units x where x.site_id = o.site_id and x.class = o.class and x.table_name = o.table_name
                    and x.channel_ref = o.channel_ref and x.month = o.month and x.version > o.version and x.received_at is not null
                  order by x.version desc limit 1) nx on true
    join public.obs_archive_b2_files b on b.site_id = p_site and b.arquivo_id = case when nx.parts = 1 then 'u:' || nx.id else 'p:' || nx.id || ':01' end and b.last_ok_at is not null
    cross join lateral jsonb_array_elements(public.obs_archive_arquivos_da_unidade(o.id)) f
    cross join lateral (select e as nf from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(nx.id)) e order by (e->>'parte')::int limit 1) z
   where o.site_id = p_site and o.class = 'texto' and o.superseded_at is not null and o.row_count > 0 and o.purged_at is null and o.lost_at is null
     and nx.nas_attested_at is not null and greatest(nx.nas_attested_at, b.last_ok_at) <= public.obs_archive_agora() - interval '30 days'
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = o.channel_ref)
     and not exists (select 1 from public.obs_archive_absence z2 where z2.site_id = p_site and z2.prefixo = f->>'caminho')
  on conflict (site_id, alvo, filho, prefixo) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.obs_archive_antigas_open(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_item_advance(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare t record; n integer := 0; v_lig boolean := public.obs_archive_m9_ligado(p_site);
begin
  if v_lig then
    -- 1. a nova está recebida, atestada, no B2, com resumo e manifesto: as antigas podem sair
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'aguardando_nova' order by x.id for update loop
      if public.obs_archive_item_falta(t.id) is null then
        update public.obs_archive_item_targets set estado = 'apagar_antigas', updated_at = now() where id = t.id;
        update public.obs_archive_units set superseded_at = coalesce(superseded_at, now())
         where site_id = p_site and class = t.class and table_name = t.table_name and channel_ref = t.channel_ref and month = t.month and version < t.to_version;
        update public.obs_archive_summaries set superseded_at = coalesce(superseded_at, now())
         where site_id = p_site and class = t.class and channel_ref = t.channel_ref and month = t.month
           and version < (select max(s.version) from public.obs_archive_summaries s where s.site_id = p_site and s.class = t.class and s.channel_ref = t.channel_ref and s.month = t.month);
        update public.obs_archive_absence set liberado_em = coalesce(liberado_em, now()) where site_id = p_site and alvo_id = t.id;
        n := n + 1;
      end if;
    end loop;
    -- 2. todas as linhas provadas ausentes do NAS e dos snapshots: a vez do B2 (sem linha nenhuma: nada a provar)
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'apagar_antigas' order by x.id for update loop
      if not exists (select 1 from public.obs_archive_absence a where a.alvo_id = t.id and a.encerrada_at is null) then
        update public.obs_archive_item_targets set estado = 'concluido', done_at = now(), updated_at = now() where id = t.id;
        n := n + 1;
      elsif not exists (select 1 from public.obs_archive_absence a where a.alvo_id = t.id and a.encerrada_at is null and a.snap_absent_at is null) then
        update public.obs_archive_item_targets set estado = 'conferir_b2', updated_at = now() where id = t.id;
        n := n + 1;
      end if;
    end loop;
    -- 3. B2 sem nenhuma versão: concluído
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'conferir_b2' order by x.id for update loop
      if not exists (select 1 from public.obs_archive_absence a where a.alvo_id = t.id and a.encerrada_at is null and a.b2_absent_at is null) then
        update public.obs_archive_absence set encerrada_at = now() where alvo_id = t.id and encerrada_at is null;
        update public.obs_archive_item_targets set estado = 'concluido', done_at = now(), updated_at = now() where id = t.id;
        n := n + 1;
      end if;
    end loop;
    n := n + public.obs_archive_antigas_open(p_site);
    update public.obs_archive_absence set encerrada_at = now() where site_id = p_site and alvo like 'antiga:%' and encerrada_at is null and b2_absent_at is not null;
  end if;
  -- limpeza da bandeira, sempre (D-M9-2): sem alvo aberto com a chave, o arquivo está limpo
  update public.competitor_removed_items i set archive_pending = false, archive_note = coalesce(i.archive_note, 'arquivo limpo')
   where i.site_id = p_site and i.archive_pending and i.kind in ('video', 'comentario')
     and not exists (select 1 from public.obs_archive_item_targets g where g.site_id = p_site and g.item_kind = i.kind and g.done_at is null and i.youtube_id = any(g.item_refs));
  return n;
end $$;
revoke all on function public.obs_archive_item_advance(uuid) from public, anon, authenticated, service_role;

-- O manifesto anterior também sai: entra na lista do alvo (o de menor id do grupo) quando a versão do manifesto sobe (alvo ainda em copiar/aguardando_nova).
create or replace function public.obs_archive_manifesto_antigo() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_alvo bigint;
begin
  if old.manifest_version is not null and new.manifest_version > old.manifest_version and old.manifest_sha256 is not null then
    select min(t.id) into v_alvo from public.obs_archive_item_targets t
     where t.site_id = new.site_id and t.class = new.class and t.month = new.month and t.estado in ('copiar', 'aguardando_nova');
    if v_alvo is not null then
      insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
      select new.site_id, 'alvo:' || v_alvo, v_alvo, pol.filho,
             new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || old.manifest_version || '.' || k.ext, false, k.sha_old,
             new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || new.manifest_version || '.' || k.ext, k.sha_new
        from (select min(p.filho) as filho from public.obs_archive_policy() p where p.class = new.class) pol
        cross join (values ('json', old.manifest_sha256, new.manifest_sha256), ('sha256', old.manifest_list_sha256, new.manifest_list_sha256)) k(ext, sha_old, sha_new)
       where k.sha_old is not null and k.sha_new is not null
      on conflict (site_id, alvo, filho, prefixo) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_manifesto_antigo() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_manifesto_antigo on public.obs_archive_months;
create trigger obs_archive_manifesto_antigo before update of manifest_version on public.obs_archive_months
  for each row execute function public.obs_archive_manifesto_antigo();

-- "Já rodei" / "Desfazer": só item: e canal: (antiga: fica fora, Yannis m6). Não muda estado; só marca.
create or replace function public.obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v timestamptz := case when p_desfazer then null else public.obs_archive_agora() end;
begin
  if p_actor is null or not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if p_item_id ~ '^item:[1-9][0-9]{0,18}$' then
    update public.competitor_removed_items set marcado_rodado_em = v where site_id = p_site and id = substr(p_item_id, 6)::bigint;
  elsif p_item_id ~ '^canal:[0-9a-f-]{36}$' then
    update public.obs_archive_channel_removals set marcado_rodado_em = v where site_id = p_site and channel_ref = substr(p_item_id, 7);
  else
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;
  if not found then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  return jsonb_build_object('item_id', p_item_id, 'marcado_rodado_em', v);
end $$;
revoke all on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) to service_role;

-- A lista de apagar: as linhas liberadas ainda sem a primeira ausência.
create or replace function public.obs_archive_apagar_do_item(p_site uuid, p_item bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('filho', a.filho, 'caminho', a.prefixo, 'sha256', a.sha256,
           'nova', case when a.nova_caminho is null then null else jsonb_build_object('caminho', a.nova_caminho, 'sha256', a.nova_sha256) end)
         order by a.filho, a.prefixo), '[]'::jsonb)
    from public.obs_archive_absence a join public.obs_archive_item_targets t on t.id = a.alvo_id
   where a.site_id = p_site and t.item_id = p_item and t.estado = 'apagar_antigas' and not a.e_prefixo and a.liberado_em is not null
     and a.encerrada_at is null and a.nas_absent_first_at is null
$$;
revoke all on function public.obs_archive_apagar_do_item(uuid, bigint) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_apagar_da_antiga(p_site uuid, p_alvo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('filho', a.filho, 'caminho', a.prefixo, 'sha256', a.sha256,
           'nova', case when a.nova_caminho is null then null else jsonb_build_object('caminho', a.nova_caminho, 'sha256', a.nova_sha256) end)
         order by a.filho, a.prefixo), '[]'::jsonb)
    from public.obs_archive_absence a
   where a.site_id = p_site and a.alvo = p_alvo and not a.e_prefixo and a.liberado_em is not null and a.encerrada_at is null and a.nas_absent_first_at is null
$$;
revoke all on function public.obs_archive_apagar_da_antiga(uuid, text) from public, anon, authenticated, service_role;

-- Todos os arquivos que o registro conhece de um canal removido (unidades em todas as versões, partes, resumos), com o sha256.
create or replace function public.obs_archive_arquivos_do_canal(p_site uuid, p_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pol as (select distinct p.class, p.filho from public.obs_archive_policy() p),
  f as (
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, null) as caminho, u.sha256_bytes as sha
      from public.obs_archive_units u join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts = 1 and u.sha256_bytes is not null
    union all
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), pt.sha256_bytes
      from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts > 1
    union all
    select pol.filho, s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz', k.sha
      from public.obs_archive_summaries s join pol on pol.class = s.class
      cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
     where s.site_id = p_site and s.channel_ref = p_ref and k.sha is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('filho', f.filho, 'caminho', f.caminho, 'sha256', f.sha, 'nova', null) order by f.filho, f.caminho), '[]'::jsonb) from f
$$;
revoke all on function public.obs_archive_arquivos_do_canal(uuid, text) from public, anon, authenticated, service_role;
```

(`obs_archive_removal_blobs_done` é da Tarefa 13, mesma parte 5.)

- [ ] **Passo 3.** Rodar o teste da parte 5 → PASS.

- [ ] **Passo 4. Testes da parte 6, falhando** (`manutencao-m9-pendencias.test.ts`, `aplicarM9(c, 6)`):

| Teste | Afirma |
|---|---|
| `wrappers: renomeio idempotente` | depois de aplicar a M9 duas vezes existem `obs_archive_plan_base`, `obs_archive_b2_plan_base`, `obs_archive_removed_channel_list_base` e as três originais; `*_base` sem `EXECUTE` para ninguém além do dono; originais com `service_role` e sem `anon`/`authenticated` (`has_function_privilege`); a base **não** foi editada: o `prosrc` da base tem o mesmo md5 do texto da M3b |
| `plan: filtra o que o expurgo está refazendo` | alvo `copiar`/`aguardando_nova`/`bloqueado` de (classe, canal, mês): a entrada de `exportar` (classe, tabela, canal, mês) e a de `resumos` (classe, canal, mês) somem do plano; alvo `concluido`: voltam |
| `plan: aguardando_dono e manifestos do expurgo` | unidade `origem 'expurgo'` com linhas e sem `received_at` aparece em `aguardando_dono` (`u:`/`p:NN`, `versao`, `caminho` da Tarefa 3); resumo novo sem `received_at`: `s:<id>:canal`, `s:<id>:video` (tipo `resumo`); mês `unsealed_reason = 'expurgo'` com tudo recebido (inclusive mês retirado): em `manifestos`; antes de receber: não |
| `plan: prefixos_ausentes e captura` | interruptor ligado: `prefixos_ausentes` = `obs_archive_prefixos_ausentes(site, 'nas')`; desligado: `[]`; sem a captura nas funções da E9 e interruptor ligado: `vermelhos` ganha `captura_ausente: ...`; `b2_plan.prefixos_ausentes` = `'b2'` na 1ª página e `[]` nas seguintes |
| `plan: avança antes de montar` | o wrapper chama `removal_advance` e `item_advance`: alvo pronto vira `apagar_antigas` na mesma chamada |
| `lista de canais` | `concluido` mapeado antes de `sem_arquivo`; `apagado_nas` (todas as linhas com `nas_absent_at`), `apagado_b2`; chaves novas `nas_last_absent_at, marcado_rodado_em, lote_e10_aberto, prefixos_total, prefixos_ausentes_nas, snap_ok, completed_at, snapshot_mais_antigo`; canal sem remoção continua `sem_destino` |
| `pendências: forma do C12 v2` | `versao 2`; cada item com as chaves `item_id, kind, tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado_rodado_em, bloqueados, snapshot_mais_antigo, apagar, b2_nomes, prefixos`; `apagar` só em `apagar_antigas` e não vazio lá; `b2_nomes` só em `conferir_b2` e não vazio lá; `total` = tamanho; zero item: `itens: []` |
| `pendências: só lê` | `pg_get_functiondef` sem `insert`/`update`/`delete`; `provolatile = 's'` |
| `pendências: copiar vence bloqueado` | item com um alvo `copiar` pronto e outro `bloqueado`: `tempo 'copiar'`, `bloqueados = 1`; só bloqueado: `tempo 'bloqueado'` com `motivo`; `copiar` sem grupo pronto: `sem_comando`/`versao_em_curso` |
| `pendências: aguardando_nova` | `sem_comando` com a `falta` de `item_falta` (`unidade_no_nas`, `resumo`, `manifesto`, `b2_nova`); interruptor desligado e tudo pronto: `m9_desligado` |
| `pendências: apagar → segunda conferência → snapshots → b2` | linhas sem `nas_absent_first_at`: `apagar_antigas` com `apagar`; com `first` e sem `nas_absent_at`: `sem_comando`/`segunda_conferencia`; com `nas_absent_at` e sem `snap_absent_at`: `snapshots` (e `snapshot_mais_antigo` se o último `snapshots: 'presente'`); com `snap_absent_at` e `nas_last_absent_at` de mais de 24 h: `conferencia_nas_recente`; sem `b2_checked_at`: `b2_sync`; com `b2_nomes`: `conferir_b2` com `b2_nomes` `filho/nome` |
| `pendências: canal` | remoção `apagar` com arquivos: `apagar_antigas` e `apagar` = `arquivos_do_canal`, `prefixos` sem os `_recebendo`; sem arquivo conhecido e linhas por abrir: `sem_comando`/`so_prefixo`; sem linhas abertas e com `blobs_pending`: `blobs`; `online_thumbs_known = false` sem ack: `imagens`; lote E10: `lote_e10`; interruptor desligado depois do apagar: `m9_desligado` |
| `pendências: versão superada` | `antiga:<uuid>` aparece com `kind 'versao'`; `segunda_conferencia` aceito |
| `permissões` | `owner_pending`, `plan`, `b2_plan`, `removed_channel_list`: `service_role` verdadeiro, `anon`/`authenticated` falso; `owner_pending` também `postgres` |
| `interruptor: apagar a variável` | default apagado: sem linha em `obs_archive_m9_interruptor`, `obs_archive_m9_ligado` falso e `prefixos_ausentes = []`, o teste que "apaga" o default e afirma (regra do CLAUDE.md) |

- [ ] **Passo 5. A parte 6** (`m9.sql`):

```sql
-- M9 PARTE 6: wrappers do plano (sem editar função da M3b), lista de canais e pendências na versao 2

-- Renomeia as originais uma única vez e fecha o acesso a elas. Rodar de novo não faz nada.
do $m9$ begin
  if to_regprocedure('public.obs_archive_plan_base(uuid,boolean,text)') is null then
    alter function public.obs_archive_plan(uuid, boolean, text) rename to obs_archive_plan_base;
  end if;
  if to_regprocedure('public.obs_archive_b2_plan_base(uuid,boolean,text)') is null then
    alter function public.obs_archive_b2_plan(uuid, boolean, text) rename to obs_archive_b2_plan_base;
  end if;
  if to_regprocedure('public.obs_archive_removed_channel_list_base(uuid)') is null then
    alter function public.obs_archive_removed_channel_list(uuid) rename to obs_archive_removed_channel_list_base;
  end if;
end $m9$;
revoke all on function public.obs_archive_plan_base(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_b2_plan_base(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_removed_channel_list_base(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_lig boolean := public.obs_archive_m9_ligado(p_site); v_dono jsonb; v_man jsonb;
begin
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);
  v := public.obs_archive_plan_base(p_site, p_completo, p_cursor);
  -- D-M9-3: o que o expurgo está refazendo não se reexporta
  v := jsonb_set(v, '{exportar}', coalesce((
         select jsonb_agg(e) from jsonb_array_elements(v->'exportar') e
          where not exists (select 1 from public.obs_archive_item_targets g
                             where g.site_id = p_site and g.estado in ('copiar', 'aguardando_nova', 'bloqueado') and g.class = e->>'classe' and g.table_name = e->>'tabela'
                               and g.channel_ref = e->>'canal' and to_char(g.month, 'YYYY-MM') = e->>'mes')), '[]'::jsonb));
  v := jsonb_set(v, '{resumos}', coalesce((
         select jsonb_agg(e) from jsonb_array_elements(v->'resumos') e
          where not exists (select 1 from public.obs_archive_item_targets g
                             where g.site_id = p_site and g.estado in ('copiar', 'aguardando_nova', 'bloqueado') and g.class = e->>'classe'
                               and g.channel_ref = e->>'canal' and to_char(g.month, 'YYYY-MM') = e->>'mes')), '[]'::jsonb));
  if p_cursor is null then
    -- D-M9-16: a versão nova do expurgo chega a "recebida" pelo mesmo caminho das outras (o dono grava em _recebendo, o copiador recebe)
    select coalesce(jsonb_agg(x.item order by x.item->>'caminho'), '[]'::jsonb) into v_dono from (
      select jsonb_build_object('arquivo_id', 'u:' || u.id, 'tipo', 'unidade', 'filho', pol.filho,
               'caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version), 'classe', u.class, 'tabela', u.table_name,
               'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column, 'b2_file_id_bom', null) as item
        from public.obs_archive_units u join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.origem = 'expurgo' and u.parts = 1 and u.row_count > 0 and u.received_at is null and u.lost_at is null and u.purged_at is null
      union all
      select jsonb_build_object('arquivo_id', 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0'), 'tipo', 'parte', 'filho', pol.filho,
               'caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), 'classe', u.class, 'tabela', u.table_name,
               'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column, 'b2_file_id_bom', null)
        from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id
        join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.origem = 'expurgo' and u.parts > 1 and u.received_at is null and pt.received_at is null and u.lost_at is null and u.purged_at is null
      union all
      select jsonb_build_object('arquivo_id', 's:' || s.id || ':' || k.papel, 'tipo', 'resumo', 'filho', pol.filho,
               'caminho', s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz',
               'classe', s.class, 'tabela', null, 'canal', s.channel_ref, 'mes', to_char(s.month, 'YYYY-MM'), 'versao', s.version, 'coluna_controle', null, 'b2_file_id_bom', null)
        from public.obs_archive_summaries s
        join (select distinct class, filho from public.obs_archive_policy()) pol on pol.class = s.class
        cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
       where s.site_id = p_site and s.origem = 'expurgo' and not s.empty and s.received_at is null and k.sha is not null and s.lost_at is null and s.purged_at is null
         and not (k.papel = any(s.received_papers))
    ) x;
    v := jsonb_set(v, '{aguardando_dono}', coalesce(v->'aguardando_dono', '[]'::jsonb) || v_dono);
    -- manifestos de meses refeitos pelo expurgo, inclusive meses fora do banco, quando unidades e resumos já estão recebidos
    select coalesce(jsonb_agg(distinct jsonb_build_object('classe', m.class, 'mes', to_char(m.month, 'YYYY-MM'))), '[]'::jsonb) into v_man
      from public.obs_archive_months m
     where m.site_id = p_site and m.unsealed_reason = 'expurgo' and m.unsealed_at is not null
       and not exists (select 1 from public.obs_archive_pending_units(p_site, m.class, m.month, null))
       and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.class = m.class and s.month = m.month and s.origem = 'expurgo'
                          and not s.empty and s.received_at is null and s.lost_at is null and s.purged_at is null);
    v := jsonb_set(v, '{manifestos}', (
           select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from jsonb_array_elements(coalesce(v->'manifestos', '[]'::jsonb) || v_man) e));
    v := jsonb_set(v, '{prefixos_ausentes}', public.obs_archive_prefixos_ausentes(p_site, 'nas'));
    if v_lig and not public.obs_archive_m9_captura_presente() then
      v := jsonb_set(v, '{vermelhos}', coalesce(v->'vermelhos', '[]'::jsonb)
             || to_jsonb('captura_ausente: as funções de apagar da E9 não chamam a captura do arquivo (M9); apagar vídeo/comentário não guarda a lista'::text));
    end if;
  end if;
  return v;
end $$;
revoke all on function public.obs_archive_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_plan(uuid, boolean, text) to service_role;

create or replace function public.obs_archive_b2_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  v := public.obs_archive_b2_plan_base(p_site, p_completo, p_cursor);
  if p_cursor is null then
    v := jsonb_set(v, '{prefixos_ausentes}', public.obs_archive_prefixos_ausentes(p_site, 'b2'));
  end if;
  return v;
end $$;
revoke all on function public.obs_archive_b2_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_b2_plan(uuid, boolean, text) to service_role;

create or replace function public.obs_archive_removed_channel_list(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
           (e - 'estado') || jsonb_build_object(
             'estado', case
                 when r.archive_decision = 'apagar' and r.completed_at is not null then 'concluido'
                 when r.archive_decision = 'apagar' and r.b2_absent_at is not null then 'apagado_b2'
                 when r.archive_decision = 'apagar' and r.nas_absent_at is not null then 'apagado_nas'
                 else e->>'estado' end,
             'nas_last_absent_at', r.nas_last_absent_at, 'marcado_rodado_em', r.marcado_rodado_em, 'completed_at', r.completed_at,
             'lote_e10_aberto', exists (select 1 from public.obs_archive_batches b where b.site_id = p_site and b.kind = 'canal' and b.channel_ref = r.channel_ref
                                         and b.deleted_at is null and b.closed_at is null),
             'prefixos_total', coalesce(ab.n, 0), 'prefixos_ausentes_nas', coalesce(ab.n_nas, 0), 'snap_ok', coalesce(ab.n_snap, 0),
             'snapshot_mais_antigo', ab.snap_oldest)
           order by e->>'channel_ref'), '[]'::jsonb)
    from jsonb_array_elements(public.obs_archive_removed_channel_list_base(p_site)) e
    left join public.obs_archive_channel_removals r on r.site_id = p_site and r.channel_ref = e->>'channel_ref'
    left join lateral (select count(*) as n, count(*) filter (where a.nas_absent_at is not null) as n_nas, count(*) filter (where a.snap_absent_at is not null) as n_snap,
                              min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest
                         from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'canal:' || (e->>'channel_ref')) ab on true
$$;
revoke all on function public.obs_archive_removed_channel_list(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_removed_channel_list(uuid) to service_role;
```

(Atenção no teste: `jsonb_array_elements` da base devolve `jsonb`, `e - 'estado'` é o operador de remoção de chave. A `snapshot_mais_antigo` do canal é a menor data medida *com* snapshot presente.)

```sql
-- As pendências do dono na versao 2 (C12 r2.6): SÓ LÊ (stable). Quem avança os estados é o plano, o attest e o record (D-M9-5).
create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_site uuid := p_site; v_itens jsonb; v_agora timestamptz := public.obs_archive_agora(); v_lig boolean;
begin
  if v_site is null then
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  v_lig := public.obs_archive_m9_ligado(v_site);
  with alvos as (
    select t.item_id,
           count(*) filter (where t.estado = 'copiar') as n_copiar, count(*) filter (where t.estado = 'bloqueado') as n_bloq,
           count(*) filter (where t.estado = 'aguardando_nova') as n_agu,
           bool_and(public.obs_archive_grupo_pronto(t.site_id, t.class, t.channel_ref, t.month)) filter (where t.estado = 'copiar') as copiar_pronto,
           min(t.month) as mes, min(t.channel_ref) as channel_ref, min(t.item_kind) as kind,
           min(public.obs_archive_item_falta(t.id)) filter (where t.estado = 'aguardando_nova') as falta_agu,
           min(t.motivo) filter (where t.estado = 'bloqueado') as motivo
      from public.obs_archive_item_targets t where t.site_id = v_site and t.done_at is null and t.item_id is not null group by t.item_id
  ), ab as (
    select t.item_id, count(*) filter (where a.nas_absent_first_at is null) as sem_primeiro, count(*) filter (where a.nas_absent_at is null) as sem_nas,
           count(*) filter (where a.snap_absent_at is null) as sem_snap, min(a.nas_last_absent_at) as min_last,
           count(*) filter (where a.b2_checked_at is null) as nao_checado, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest
      from public.obs_archive_item_targets t join public.obs_archive_absence a on a.alvo_id = t.id and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null
     where t.site_id = v_site and t.estado in ('apagar_antigas', 'conferir_b2') group by t.item_id
  ), it as (
    select x.*, i.youtube_id, i.decided_at, i.marcado_rodado_em, ab.snap_oldest,
           public.obs_archive_etapa(coalesce(ab.sem_primeiro, 0), coalesce(ab.sem_nas, 0), coalesce(ab.sem_snap, 0), ab.min_last, coalesce(ab.nao_checado, 0), v_lig, v_agora) as et
      from alvos x left join ab on ab.item_id = x.item_id left join public.competitor_removed_items i on i.id = x.item_id
  ), it_tempo as (
    select it.*,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then 'copiar' when n_bloq > 0 then 'bloqueado'
                when n_copiar > 0 or n_agu > 0 then 'sem_comando' when et in ('apagar_antigas', 'conferir_b2') then et else 'sem_comando' end as tempo,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then null when n_bloq > 0 then null
                when n_copiar > 0 then 'versao_em_curso' when n_agu > 0 then coalesce(falta_agu, 'versao_em_curso')
                when et in ('apagar_antigas', 'conferir_b2') then null else et end as falta
      from it
  ), item_item as (
    select 'item:' || x.item_id as item_id, x.kind, x.tempo, x.falta, case when x.tempo = 'bloqueado' then x.motivo end as motivo, x.decided_at as desde,
           to_char(x.mes, 'YYYY-MM') as mes, x.channel_ref, x.youtube_id, x.marcado_rodado_em as marcado, x.n_bloq as bloqueados, x.snap_oldest,
           case when x.tempo = 'apagar_antigas' then public.obs_archive_apagar_do_item(v_site, x.item_id) else '[]'::jsonb end as apagar,
           case when x.tempo = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                     from public.obs_archive_item_targets t2 join public.obs_archive_absence a on a.alvo_id = t2.id
                                                     cross join lateral unnest(a.b2_nomes) n
                                                    where t2.item_id = x.item_id and t2.estado = 'conferir_b2' and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from it_tempo x
  ), canal as (
    select r.*, (select count(*) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as n_abertas,
           (select count(*) filter (where a.nas_absent_first_at is null) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_primeiro,
           (select count(*) filter (where a.nas_absent_at is null) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_nas,
           (select count(*) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_snap,
           (select min(a.nas_last_absent_at) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as min_last,
           (select count(*) filter (where a.b2_checked_at is null) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as nao_checado,
           (select min(a.snap_oldest) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_oldest,
           jsonb_array_length(public.obs_archive_arquivos_do_canal(v_site, r.channel_ref)) as n_arquivos
      from public.obs_archive_channel_removals r where r.site_id = v_site and r.archive_decision = 'apagar' and r.completed_at is null
  ), canal_tempo as (
    select c.*, public.obs_archive_etapa(coalesce(c.sem_primeiro, 0), coalesce(c.sem_nas, 0), coalesce(c.sem_snap, 0), c.min_last, coalesce(c.nao_checado, 0), v_lig, v_agora) as et
      from canal c
  ), canal_item as (
    select 'canal:' || c.channel_ref as item_id, 'canal'::text as kind,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then 'apagar_antigas'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then 'conferir_b2' else 'sem_comando' end as tempo,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then null
                when c.n_abertas > 0 and c.et = 'apagar_antigas' then 'so_prefixo'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then null
                when c.n_abertas > 0 then c.et
                when cardinality(c.blobs_pending) > 0 then 'blobs'
                when not c.online_thumbs_known and c.thumbs_unknown_ack_at is null then 'imagens'
                when exists (select 1 from public.obs_archive_batches b where b.site_id = c.site_id and b.kind = 'canal' and b.channel_ref = c.channel_ref
                              and b.deleted_at is null and b.closed_at is null) then 'lote_e10'
                when not v_lig then 'm9_desligado' else 'so_prefixo' end as falta,
           null::text as motivo, greatest(c.decided_at, c.reappeared_at) as desde, null::text as mes, c.channel_ref, nullif(c.youtube_channel_id, '') as youtube_id,
           c.marcado_rodado_em as marcado, 0::bigint as bloqueados, c.snap_oldest,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then public.obs_archive_arquivos_do_canal(v_site, c.channel_ref) else '[]'::jsonb end as apagar,
           case when c.n_abertas > 0 and c.et = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                                    from public.obs_archive_absence a cross join lateral unnest(a.b2_nomes) n
                                                                   where a.alvo = 'canal:' || c.channel_ref and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           (select coalesce(jsonb_agg(a.prefixo order by a.prefixo), '[]'::jsonb) from public.obs_archive_absence a
             where a.alvo = 'canal:' || c.channel_ref and a.prefixo not like '\_recebendo/%') as prefixos
      from canal_tempo c
  ), antiga as (
    select a.alvo as item_id, 'versao'::text as kind,
           case when e.et in ('apagar_antigas', 'conferir_b2') then e.et else 'sem_comando' end as tempo,
           case when e.et in ('apagar_antigas', 'conferir_b2') then null else e.et end as falta, null::text as motivo,
           min(a.liberado_em) as desde, to_char(min(u.month), 'YYYY-MM') as mes, min(u.channel_ref) as channel_ref, null::text as youtube_id, null::timestamptz as marcado,
           0::bigint as bloqueados, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest,
           case when e.et = 'apagar_antigas' then public.obs_archive_apagar_da_antiga(v_site, a.alvo) else '[]'::jsonb end as apagar,
           case when e.et = 'conferir_b2' then (select coalesce(jsonb_agg(a2.filho || '/' || n order by a2.filho, n), '[]'::jsonb)
                                                  from public.obs_archive_absence a2 cross join lateral unnest(a2.b2_nomes) n
                                                 where a2.alvo = a.alvo and a2.encerrada_at is null and a2.b2_absent_at is null) else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from public.obs_archive_absence a join public.obs_archive_units u on u.id = a.unidade_id
      cross join lateral (select public.obs_archive_etapa(count(*) filter (where z.nas_absent_first_at is null), count(*) filter (where z.nas_absent_at is null),
                                  count(*) filter (where z.snap_absent_at is null), min(z.nas_last_absent_at), count(*) filter (where z.b2_checked_at is null), v_lig, v_agora) as et
                            from public.obs_archive_absence z where z.alvo = a.alvo and z.encerrada_at is null and z.liberado_em is not null and z.b2_absent_at is null) e
     where a.site_id = v_site and a.alvo like 'antiga:%' and a.encerrada_at is null and a.b2_absent_at is null
     group by a.alvo, e.et
  ), tudo (item_id, kind, tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado, bloqueados, snap_oldest, apagar, b2_nomes, prefixos) as (
    select * from item_item union all select * from canal_item union all select * from antiga
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', tempo, 'falta', falta, 'motivo', motivo, 'desde', desde, 'mes', mes,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', marcado, 'bloqueados', bloqueados,
           'snapshot_mais_antigo', snap_oldest, 'apagar', apagar, 'b2_nomes', b2_nomes, 'prefixos', prefixos) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 2, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;
```

- [ ] **Passo 6.** Rodar os testes das partes 5 e 6 → PASS; rodar também `apps/web/test/integration/manutencao-m3b-pendencias.test.ts`: continua verde porque aplica só a M3b (`aplicarM3b`). Se algum teste da M3b aplicar a M9, parar e avisar (a `versao 1` é contrato da M3b, a `versao 2` é desta etapa). Rodar `grep -n "obs_archive_plan(\|obs_archive_b2_plan(\|obs_archive_removed_channel_list(" supabase/rascunhos/m3b.sql`: só definições e `grant`/`revoke` (já conferido em 14/10: nenhuma outra função da M3b chama as três, exceto `owner_pending`, que esta parte recria).

- [ ] **Passo 7. Commit** (quando o controlador mandar): `git add -- apps/web/test/integration/manutencao-m9-avanco.test.ts apps/web/test/integration/manutencao-m9-pendencias.test.ts`; `git commit -m "feat: M9 partes 5 e 6: avanço dos itens, wrappers do plano e pendências do dono na versao 2 (rascunho)" -- supabase/rascunhos/m9.sql apps/web/test/integration/manutencao-m9-avanco.test.ts apps/web/test/integration/manutencao-m9-pendencias.test.ts`.

---

### Task 6: o filtro do item, o resumo refeito e o arquivo de comandos do canal (TypeScript puro)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts`
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-expurgo-filtro.test.ts`, `...-expurgo-resumo.test.ts`, `...-comandos-canal.test.ts`
- Create: `apps/web/test/integration/manutencao-m9-resumo-ouro.test.ts` (com banco: o resumo refeito em TS contra `obs_archive_summary_rows`)

**Interfaces:**
- Consumes: `lerCsv` (`arquivo/csv.ts:35`), `serializarLinhas` (`arquivo/exportar.ts:54`), `serializarResumo` e `LinhasDoResumo` (`arquivo-mensal/resumo.ts:8-36`), `UUID_RE`, `SHA_RE`, `MES_RE` (`arquivo-mensal/contrato.ts`).
- Produces:
  - `expurgo-filtro.ts`: `type Celula = string | null`; `interface UnidadeLida { colunas: string[]; linhas: Celula[][] }`; `lerUnidadeGz(gz: Buffer): UnidadeLida`; `COLUNA_DA_CHAVE`; `filtrarUnidade(o: { tabela: string; kind: 'video' | 'comentario'; chaves: ReadonlySet<string>; unidade: UnidadeLida; comentariosDoVideo?: ReadonlySet<string> }): { unidade: UnidadeLida; removidas: number }`; `idsDeComentariosDoVideo(comentarios: UnidadeLida, videos: ReadonlySet<string>): Set<string>`; `serializarUnidade(u: UnidadeLida, colunaControle: string | null): UnidadeSerializada` com `interface UnidadeSerializada { gz: Buffer | null; sha256_bytes: string; csv_sha256: string; file_bytes: number; row_count: number; control_sum: string | null; hash_conteudo: string }`; `hashConteudo(linhas: ReadonlyArray<ReadonlyArray<Celula>>): string`.
  - `expurgo-resumo.ts`: `refazerResumo(o: { classe: string; canal: string; mes: string; diasDoMes: number; versao: number; unidades: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }>; vazias: Array<{ tabela: string; hashConteudo: string }>; comentarios?: UnidadeLida }): LinhasDoResumo`.
  - `expurgo-contrato.ts`: `CorpoAbrir`, `RespostaAbrir`, `CorpoRegistrar`, `RespostaRegistrar`, `CorpoBloquear`, `CorpoCanal`, `RespostaCanal`, `CorpoExpurgo` (Zod, `.strict()`), os tipos inferidos.
  - `comandos-canal.ts`: `montarComandosDoCanal(o: { channelRef: string; prefixos: Array<{ filho: 'numerico' | 'texto'; prefixo: string }>; raiz: Record<'numerico' | 'texto', string>; geradoEm: Date }): string`.

**O que acontece quando o dado não existe:** unidade em que o filtro não acha o item: `removidas = 0` (o chamador manda o alvo em `sem_linhas`; Review Focus 5); unidade que fica sem linha: `serializarUnidade` devolve `gz: null`, `row_count 0`, `sha256_bytes ''` (a regra `row_count = 0 ↔ sha256 nulo` de `m3b.sql:88`), e nada vai ao NAS; tabela sem entrada em `COLUNA_DA_CHAVE`: lança `tabela_sem_chave` (nunca "não achou nada"); CSV sem a coluna da chave: lança `coluna_da_chave_ausente`; `prefixos` vazio em `montarComandosDoCanal`: lança `sem_prefixo` (o comando recusa em vez de gravar um script que não faz nada e diz que fez).

- [ ] **Passo 1. Testes puros, falhando** (`arquivo-mensal-expurgo-filtro.test.ts`, `// @vitest-environment node`):

```ts
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { serializarLinhas } from '@/lib/youtube/observatorio/arquivo/exportar'
import {
  COLUNA_DA_CHAVE, filtrarUnidade, hashConteudo, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade,
} from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro'

const V1 = '11111111-1111-1111-1111-111111111111'
const V2 = '22222222-2222-2222-2222-222222222222'
const diaria = { colunas: ['video_id', 'snap_date', 'views'], linhas: [[V1, '2026-09-01', '10'], [V2, '2026-09-01', '5'], [V1, '2026-09-02', '12']] }

describe('expurgo: filtro do item', () => {
  it('tira só as linhas do vídeo e mantém a ordem dos outros', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set([V1]), unidade: diaria })
    expect(r.removidas).toBe(2)
    expect(r.unidade.linhas).toEqual([[V2, '2026-09-01', '5']])
  })
  it('filtro_sem_linhas_conclui_sem_versao: vídeo ausente dá zero removidas', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set(['33333333-3333-3333-3333-333333333333']), unidade: diaria })
    expect(r.removidas).toBe(0)
  })
  it('comentário leva as respostas (parent_id) e as marcas pelo comment_id', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['8', '7', V1, 'x'], ['9', null, V2, 'x']] }
    const r = filtrarUnidade({ tabela: 'competitor_video_comments', kind: 'comentario', chaves: new Set(['7']), unidade: com })
    expect(r.unidade.linhas.map(l => l[0])).toEqual(['9'])
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['8', '2'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'comentario', chaves: new Set(['7', '8']), unidade: marcas })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('vídeo nas marcas: pelos comentários do vídeo na unidade de comentários do mesmo mês', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['9', null, V2, 'x']] }
    const ids = idsDeComentariosDoVideo(com, new Set([V1]))
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'video', chaves: new Set([V1]), unidade: marcas, comentariosDoVideo: ids })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('tabela sem chave conhecida lança, nunca devolve zero', () => {
    expect(() => filtrarUnidade({ tabela: 'outra', kind: 'video', chaves: new Set([V1]), unidade: diaria })).toThrow('tabela_sem_chave')
  })
  it('toda tabela da política fora de ensaio tem chave', () => {
    for (const t of ['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early', 'competitor_video_comments',
      'competitor_video_comment_marks', 'competitor_raw']) expect(COLUNA_DA_CHAVE[t]).toBeDefined()
  })
  it('unidade que esvazia não tem arquivo', () => {
    const s = serializarUnidade({ colunas: diaria.colunas, linhas: [] }, 'views')
    expect(s).toMatchObject({ gz: null, row_count: 0, sha256_bytes: '', control_sum: '0' })
  })
  it('ida e volta: o gz lido de volta tem as mesmas linhas; hash no formato do jsonb', () => {
    const s = serializarUnidade(diaria, 'views')
    expect(lerUnidadeGz(s.gz!)).toEqual(diaria)
    expect(s.control_sum).toBe('27')
    expect(hashConteudo([['a', null]])).toBe(hashConteudo([['a', null]]))
    expect(lerUnidadeGz(gzipSync(serializarLinhas(diaria.colunas, diaria.linhas)))).toEqual(diaria)
  })
})
```

`arquivo-mensal-expurgo-resumo.test.ts`: (a) diária de dois vídeos, um removido: a linha do canal tem `videos_com_linha 1`, `linhas` = as do que ficou, `var_views` = `ultima − primeira` do que ficou; (b) valor nulo numa leitura medida: `var_views` nulo (a regra de `m3b.sql:1112`); (c) tabela vazia em `vazias`: linha do canal com contagens `0` e datas nulas; (d) `versao_resumo` e `hash_conteudo_unidade` em toda linha.

`arquivo-mensal-expurgo-comandos-canal.test.ts` (o `05` §16.10): o texto começa por `#!/bin/bash` e `set -euo pipefail` e `umask 077`; tem `[ "$(hostname -s)" = forja ]`, a conferência `mountpoint -q` e a sentinela `.arquivo-vivo` de cada filho usado; uma linha `[ ! -d '<raiz>/<prefixo>' ] || rm -r --one-file-system -- '<raiz>/<prefixo>'` por prefixo; a validade de 24 h (`agora > gerado + 86400` → sai `4` com `OBS-ARQUIVO: VENCIDO`); `channelRef` fora da forma de uuid lança antes de montar; prefixo com `..`, aspas, espaço ou `$` lança; tem, para cada prefixo, também a remoção de `_recebendo/<prefixo>` e de `_recebendo/_quarentena/<prefixo>` (o que o copiador já recebeu do canal e ainda não selou não pode sobreviver; Yannis I10); termina com `OBS-ARQUIVO: CANAL <ref> APAGADO DO NAS` e a função chamada na mesma linha do `}` (D-F24 (a)).

- [ ] **Passo 2.** `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-mensal-expurgo-*.test.ts test/youtube/observatorio/arquivo-mensal-comandos-canal.test.ts` → FAIL.

- [ ] **Passo 3. `expurgo-filtro.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts
/**
 * Manutenção M9: o filtro do item na unidade antiga e a serialização da versão nova (02 §11.3, "Como o expurgo reescreve").
 * Puro (só `node:` e relativo): o `tsx` da raiz o importa no Mac. Nada aqui lê banco, rede ou relógio.
 */
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { lerCsv } from '../arquivo/csv'
import { serializarLinhas } from '../arquivo/exportar'

export type Celula = string | null
export interface UnidadeLida { colunas: string[]; linhas: Celula[][] }
export interface UnidadeSerializada {
  gz: Buffer | null; sha256_bytes: string; csv_sha256: string; file_bytes: number; row_count: number; control_sum: string | null; hash_conteudo: string
}

/** A coluna que carrega a chave do item, por tabela (`m3b.sql:310-350`, `obs_archive_table_exprs` l.787-806). */
export const COLUNA_DA_CHAVE: Readonly<Record<string, { video: string | null; comentario: readonly string[] | null }>> = {
  competitor_video_hourly: { video: 'video_id', comentario: null },
  competitor_video_daily: { video: 'video_id', comentario: null },
  competitor_video_early: { video: 'video_id', comentario: null },
  competitor_video_comments: { video: 'video_id', comentario: ['id', 'parent_id'] },
  competitor_video_comment_marks: { video: null, comentario: ['comment_id'] },
  competitor_raw: { video: 'video_id', comentario: null },
}

const sha = (d: Uint8Array | string): string => createHash('sha256').update(d).digest('hex')

export function lerUnidadeGz(gz: Buffer): UnidadeLida {
  const { colunas, linhas } = lerCsv(gunzipSync(gz).toString('utf8'))
  return { colunas, linhas }
}

function indice(u: UnidadeLida, coluna: string): number {
  const i = u.colunas.indexOf(coluna)
  if (i < 0) throw new Error(`coluna_da_chave_ausente: ${coluna}`)
  return i
}

export function idsDeComentariosDoVideo(comentarios: UnidadeLida, videos: ReadonlySet<string>): Set<string> {
  const iv = indice(comentarios, 'video_id'), ii = indice(comentarios, 'id')
  const ids = new Set<string>()
  for (const l of comentarios.linhas) { const v = l[iv]; const id = l[ii]; if (v != null && id != null && videos.has(v)) ids.add(id) }
  return ids
}

export function filtrarUnidade(o: {
  tabela: string; kind: 'video' | 'comentario'; chaves: ReadonlySet<string>; unidade: UnidadeLida; comentariosDoVideo?: ReadonlySet<string>
}): { unidade: UnidadeLida; removidas: number } {
  const regra = COLUNA_DA_CHAVE[o.tabela]
  if (!regra) throw new Error(`tabela_sem_chave: ${o.tabela}`)
  let tira: (l: Celula[]) => boolean
  if (o.kind === 'video' && regra.video) {
    const i = indice(o.unidade, regra.video)
    tira = l => l[i] != null && o.chaves.has(l[i]!)
  } else if (o.kind === 'video' && o.tabela === 'competitor_video_comment_marks') {
    if (!o.comentariosDoVideo) throw new Error('marcas_sem_comentarios_do_video')
    const i = indice(o.unidade, 'comment_id'); const ids = o.comentariosDoVideo
    tira = l => l[i] != null && ids.has(l[i]!)
  } else if (o.kind === 'comentario' && regra.comentario) {
    const is = regra.comentario.map(c => indice(o.unidade, c))
    tira = l => is.some(i => l[i] != null && o.chaves.has(l[i]!))
  } else {
    return { unidade: o.unidade, removidas: 0 }       // a tabela não carrega esse tipo de item (ex.: comentário na diária)
  }
  const ficam = o.unidade.linhas.filter(l => !tira(l))
  return { unidade: { colunas: o.unidade.colunas, linhas: ficam }, removidas: o.unidade.linhas.length - ficam.length }
}

/** O texto de `to_jsonb(array[...]::text[])` do Postgres: `["a", null]`, com ", " entre os elementos (`m3b.sql:376-381`). */
const jsonbTexto = (l: ReadonlyArray<Celula>): string => '[' + l.map(v => (v === null ? 'null' : JSON.stringify(v))).join(', ') + ']'
export const hashConteudo = (linhas: ReadonlyArray<ReadonlyArray<Celula>>): string => sha(linhas.map(jsonbTexto).join('\n'))

function soma(u: UnidadeLida, coluna: string | null): string | null {
  if (coluna === null) return null
  const i = indice(u, coluna)
  let s = 0n
  for (const l of u.linhas) { const v = l[i]; if (v != null) s += BigInt(v) }
  return s.toString()
}

export function serializarUnidade(u: UnidadeLida, colunaControle: string | null): UnidadeSerializada {
  const hash = hashConteudo(u.linhas)
  const control_sum = soma(u, colunaControle)
  if (u.linhas.length === 0) return { gz: null, sha256_bytes: '', csv_sha256: '', file_bytes: 0, row_count: 0, control_sum, hash_conteudo: hash }
  const csv = serializarLinhas(u.colunas, u.linhas)
  const gz = gzipSync(csv, { level: 9 })
  return { gz, sha256_bytes: sha(gz), csv_sha256: sha(csv), file_bytes: gz.byteLength, row_count: u.linhas.length, control_sum, hash_conteudo: hash }
}
```

A coluna de controle é inteira em todas as tabelas da política (`views`, `likes`: `m3b.sql:13-28`), por isso `BigInt`; uma coluna não inteira lança `SyntaxError` do `BigInt` e o Mac para, sem registrar.

- [ ] **Passo 4. `expurgo-resumo.ts`** (a mesma conta de `obs_archive_summary_rows`, `m3b.sql:1105-1130`, em TS; `ts`, `dia` e `vídeo` por tabela como em `obs_archive_table_exprs`, l.787-806):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts
/** Manutenção M9: o resumo do mês refeito a partir das unidades já filtradas (02 §11.3). Puro. A prova é o teste de ouro contra o SQL. */
import type { LinhasDoResumo } from './resumo'
import type { Celula, UnidadeLida } from './expurgo-filtro'

const COLUNAS_CANAL = ['canal', 'tabela', 'mes', 'videos_com_linha', 'linhas', 'dias_medidos', 'dias_do_mes', 'primeira_leitura', 'ultima_leitura',
  'var_views', 'var_likes', 'var_comments', 'hash_conteudo_unidade', 'versao_resumo']
const COLUNAS_VIDEO = ['video', 'canal', 'tabela', 'mes', 'linhas', 'dias_medidos', 'views_primeira', 'views_ultima', 'likes_primeira', 'likes_ultima',
  'comments_primeira', 'comments_ultima', 'hash_conteudo_unidade', 'versao_resumo']
const MEDIDAS = new Set(['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early'])
const DIA_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Texto de timestamptz do Postgres com `timezone = 'UTC'` ("2026-09-01 03:00:00+00") ou data ("2026-09-01"). */
function diaSP(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const iso = ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`instante_ilegivel: ${ts}`)
  return DIA_SP.format(d)
}

interface Leitura { video: string; ts: string; dia: string; a: string | null; b: string | null; c: string | null }

function leituras(tabela: string, u: UnidadeLida, comentarios: UnidadeLida | undefined): Leitura[] {
  const col = (n: string): number => { const i = u.colunas.indexOf(n); if (i < 0) throw new Error(`coluna_ausente: ${tabela}.${n}`); return i }
  const v = (l: Celula[], n: string): Celula => l[col(n)] ?? null
  if (tabela === 'competitor_video_comments' || tabela === 'competitor_video_comment_marks') {
    const base = tabela === 'competitor_video_comments' ? u : comentarios
    if (!base) throw new Error('resumo_de_marcas_sem_comentarios')
    const bi = (n: string): number => base.colunas.indexOf(n)
    const porId = new Map(base.linhas.map(l => [l[bi('id')]!, l]))
    return u.linhas.map(l => {
      const k = tabela === 'competitor_video_comments' ? l : porId.get(v(l, 'comment_id')!)
      if (!k) throw new Error('marca_sem_comentario_no_mes')
      const pai = k[bi('parent_id')] ? porId.get(k[bi('parent_id')]!) : undefined
      const ts = (pai?.[bi('first_seen_at')] ?? k[bi('first_seen_at')])!
      return { video: k[bi('video_id')]!, ts, dia: diaSP(ts), a: null, b: null, c: null }
    })
  }
  const tsCol = tabela === 'competitor_video_daily' ? 'snap_date' : tabela === 'competitor_video_early' ? 'taken_at'
    : tabela === 'competitor_raw' ? 'last_seen_at' : 'hour_slot'
  const medida = MEDIDAS.has(tabela)
  return u.linhas.map(l => ({
    video: v(l, 'video_id')!, ts: v(l, tsCol)!, dia: diaSP(v(l, tsCol)!),
    a: medida ? v(l, 'views') : null, b: medida ? v(l, 'likes') : null, c: medida ? v(l, 'comments') : null,
  }))
}

const difSoma = (pares: Array<[string | null, string | null]>): string | null =>
  pares.some(([x, y]) => x === null || y === null) ? null : pares.reduce((s, [x, y]) => s + (BigInt(y!) - BigInt(x!)), 0n).toString()

export function refazerResumo(o: {
  classe: string; canal: string; mes: string; diasDoMes: number; versao: number
  unidades: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }>
  vazias: Array<{ tabela: string; hashConteudo: string }>
  comentarios?: UnidadeLida
}): LinhasDoResumo {
  const canal: Celula[][] = []; const video: Celula[][] = []
  const ver = String(o.versao)
  const todas = [...o.unidades.map(u => ({ ...u, ls: leituras(u.tabela, u.unidade, o.comentarios) })),
    ...o.vazias.map(v => ({ tabela: v.tabela, hashConteudo: v.hashConteudo, unidade: { colunas: [], linhas: [] }, ls: [] as Leitura[] }))]
    .sort((x, y) => (x.tabela < y.tabela ? -1 : x.tabela > y.tabela ? 1 : 0))
  for (const u of todas) {
    const porVideo = new Map<string, Leitura[]>()
    for (const l of u.ls) { const a = porVideo.get(l.video) ?? []; a.push(l); porVideo.set(l.video, a) }
    const pv = [...porVideo.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([vid, ls]) => {
      const ord = [...ls].sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : 0))
      const p = ord[0]!, ul = ord[ord.length - 1]!
      return { vid, n: ls.length, nd: new Set(ls.map(l => l.dia)).size, t1: p.ts, t2: ul.ts, a1: p.a, a2: ul.a, b1: p.b, b2: ul.b, c1: p.c, c2: ul.c }
    })
    const vazia = u.ls.length === 0
    canal.push([o.canal, u.tabela, o.mes, String(pv.length), String(u.ls.length), String(new Set(u.ls.map(l => l.dia)).size), String(o.diasDoMes),
      vazia ? null : pv.reduce((m, x) => (x.t1 < m ? x.t1 : m), pv[0]!.t1), vazia ? null : pv.reduce((m, x) => (x.t2 > m ? x.t2 : m), pv[0]!.t2),
      vazia ? null : difSoma(pv.map(x => [x.a1, x.a2])), vazia ? null : difSoma(pv.map(x => [x.b1, x.b2])), vazia ? null : difSoma(pv.map(x => [x.c1, x.c2])),
      u.hashConteudo, ver])
    for (const x of pv) video.push([x.vid, o.canal, u.tabela, o.mes, String(x.n), String(x.nd), x.a1, x.a2, x.b1, x.b2, x.c1, x.c2, u.hashConteudo, ver])
  }
  const vazio = todas.every(u => u.ls.length === 0)
  return { versao: o.versao, vazio, colunas_canal: COLUNAS_CANAL, colunas_video: COLUNAS_VIDEO, canal: vazio ? [] : canal, video: vazio ? [] : video, unit_hashes: {} }
}
```

**Teste de ouro** (`manutencao-m9-resumo-ouro.test.ts`, com banco, `aplicarM3b`): semear um canal com diária, early (vazia), comentários com resposta e marcas num mês; chamar `obs_archive_summary_rows` e comparar, linha a linha, com `refazerResumo` alimentado pelas unidades lidas por `obs_archive_read_unit` (as mesmas que o arquivo teria). Diferença em qualquer campo falha. **Empate de `ts` dentro de um vídeo:** o SQL escolhe sem ordem definida (`array_agg(a order by ts)`); a semente não tem empate e o teste diz isso no nome (`sem empate de leitura no mesmo instante`). `unit_hashes` sai vazio daqui: quem preenche é a função do registro (Tarefa 3, a partir do registro). `video_antigo` nunca chega aqui (D-M9-14).

- [ ] **Passo 5. `expurgo-contrato.ts`** (o C14, Tarefa 11; espelha as funções da Tarefa 3, que são o contrato). Zod `.strict()`:
  - `CorpoAbrir = { passo: 'abrir', item_id: string }` (o `item_id` é `item:<n>`, `canal:<uuid>` ou `antiga:<uuid>`; Tarefa 7 `ITEM_ID_RE`).
  - `CorpoRegistrar = { passo: 'registrar', item_id, classe, canal (uuid), mes ('AAAA-MM'), alvos: [{ alvo_id: number, removidas: int ≥ 0, unidade: { row_count, control_sum: string|null, hash_conteudo (SHA_RE), schema_fp (SHA_RE), sha256_bytes, csv_sha256, file_bytes, partes: 1, min_key: null, max_key: null, parts: [] } | null }], resumo: { versao, vazio, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows, tabelas_lidas: string[] } }`. `unidade: null` é o alvo que não tinha linha (`removidas 0`) ou ficou vazio (a unidade nova não tem arquivo); `tabelas_lidas` é a lista das tabelas cujo conteúdo entrou na conta do resumo (Phil C3: o servidor recusa `resumo_com_unidade_nao_lida` se faltar uma).
  - `CorpoBloquear = { passo: 'bloquear', item_id, alvo_id: number, motivo: z.enum(['antiga_ausente','antiga_divergente','grande_demais','contagem_divergente']) }`.
  - `CorpoCanal = { passo: 'canal', channel_ref: uuid }`; resposta `{ motivo: 'ok' | 'canal_desconhecido' | 'canal_nao_removido' | 'canal_guardado' | 'sem_destino', prefixos: [{ filho, prefixo }] }`.
  - `CorpoExpurgo = z.discriminatedUnion('passo', [CorpoAbrir, CorpoRegistrar, CorpoBloquear, CorpoCanal])`.
  - Respostas: `RespostaAbrir` espelha `obs_archive_expurgo_open` (Tarefa 3: `{ grupos: [{ classe, canal, mes, filho, alvos: [{ alvo_id, tabela, versao, linhas, soma, coluna_controle, schema_fp, hash_conteudo, esperadas, chaves, refs, arquivos: [{ caminho, sha256, parte }] }], outras: [{ tabela, unidade_id, versao, linhas, hash_conteudo, arquivos }], vazias: [{ tabela, hash_conteudo }], resumo: { versao, canal, video } | null, mes_online, dias_do_mes }], esperando: number }`); `RespostaRegistrar` é `{ status: 'ok', alvos: [{ alvo_id, estado: 'aguardando_nova' | 'sem_linhas', arquivo_id?, versao? }], resumo: { arquivo_id, versao } | null }`; a recusa (`{ status: 'recusado', motivo, alvo_id? }` da função) sai da rota como 409 com o mesmo corpo (Tarefa 11).
  - O alvo traz `hash_conteudo` para o Mac conferir o que leu do NAS (Tarefa 8) e `esperadas` para a conta de linhas. `min_key`/`max_key` vão nulos: a M3b os usa só para partes (`unit_parts.min_key`), e a versão nova é sempre arquivo único (D-M9-4).

- [ ] **Passo 6. `comandos-canal.ts`** (o `05` §16.10; forma do script do D-F24):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts
/** Manutenção M9: o arquivo de comandos de `expurgar --canal` (05 §16.10). Puro: devolve o texto; quem grava é o CLI (umask 077, abertura exclusiva). */
import { UUID_RE } from './contrato'

const PREFIXO_SEGURO = /^(?:numerico|texto|horaria|serie|video_antigo)\/canais\/[0-9a-f-]{36}\/$/
const RAIZ_SEGURA = /^\/[A-Za-z0-9._/-]{1,200}$/
const aspas = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

export function montarComandosDoCanal(o: {
  channelRef: string; prefixos: Array<{ filho: 'numerico' | 'texto'; prefixo: string }>; raiz: Record<'numerico' | 'texto', string>; geradoEm: Date
}): string {
  if (!UUID_RE.test(o.channelRef)) throw new Error('canal_invalido')
  if (o.prefixos.length === 0) throw new Error('sem_prefixo')
  for (const p of o.prefixos) {
    if (!PREFIXO_SEGURO.test(p.prefixo) || !p.prefixo.includes(`/canais/${o.channelRef}/`)) throw new Error('prefixo_invalido')
    if (!RAIZ_SEGURA.test(o.raiz[p.filho]) || o.raiz[p.filho].includes('..')) throw new Error('raiz_invalida')
  }
  const filhos = [...new Set(o.prefixos.map(p => p.filho))].sort()
  const gerado = Math.floor(o.geradoEm.getTime() / 1000)
  return [
    '#!/bin/bash',
    `# expurgar --canal ${o.channelRef}: gerado em ${o.geradoEm.toISOString()}; vale 24 h; rodado pelo dono na forja`,
    'set -euo pipefail',
    'umask 077',
    "trap '[ \"${OBS_INICIOU:-0}\" = 1 ] || echo \"OBS-ARQUIVO: NÃO RODOU: o arquivo chegou incompleto; nada feito\"' EXIT",
    'obs_canal_main() {',
    '  OBS_INICIOU=1',
    '  [ "$(hostname -s)" = forja ] || { echo "OBS-ARQUIVO: RECUSADO: rode na forja"; return 3; }',
    `  [ "$(date +%s)" -le ${gerado + 86400} ] || { echo "OBS-ARQUIVO: VENCIDO: gere de novo no Mac"; return 4; }`,
    ...filhos.flatMap(f => [
      `  mountpoint -q ${aspas(o.raiz[f])} || { echo "OBS-ARQUIVO: RECUSADO: ${f} desmontado"; return 5; }`,
      `  [ -f ${aspas(o.raiz[f] + '/.arquivo-vivo')} ] || { echo "OBS-ARQUIVO: RECUSADO: ${f} sem sentinela"; return 5; }`,
    ]),
    // o prefixo definitivo e, antes dele, o que o copiador já pôs em `_recebendo/` e na quarentena (Yannis I10)
    ...o.prefixos.flatMap(p => [`${p.prefixo}`, `_recebendo/${p.prefixo}`, `_recebendo/_quarentena/${p.prefixo}`].map(rel =>
      `  [ ! -d ${aspas(`${o.raiz[p.filho]}/${rel}`)} ] || rm -r --one-file-system -- ${aspas(`${o.raiz[p.filho]}/${rel}`)}`)),
    `  echo "OBS-ARQUIVO: CANAL ${o.channelRef} APAGADO DO NAS (${o.prefixos.length} prefixo(s)); a conferência do copiador confirma em até 11 h"`,
    '}; obs_canal_main; exit $?',
    '',
  ].join('\n')
}
```

O B2 não entra neste arquivo: o `05` §16.10 e o `02` §11.3 mandam o B2 só depois da conferência do NAS com menos de 24 h, e isso o `obs:arquivo` faz pelo tempo `conferir_b2` (Tarefa 7).

- [ ] **Passo 7.** Rodar os quatro testes → PASS (o de ouro com `HAS_LOCAL_DB=1`). O teste de ouro ganha um caso a mais (Phil I5): `hashConteudo` (TS) contra `obs_archive_content_hash` (SQL, `m3b.sql:388`) sobre as mesmas linhas, com `null`, aspas, barra invertida e acento, num mês online; diferença de um byte falha, porque o Mac confere o que leu do NAS por esse hash.

- [ ] **Passo 8. Commit** (quando mandado; puro, não depende da TRAVA M9-2): `git add --` dos sete arquivos novos; `git commit -m "feat: M9: filtro do item, resumo refeito em TS (ouro contra o SQL) e arquivo de comandos do canal" -- <os sete>`.

---

### Task 7: o leitor e o script na `versao 2` (só depois da TRAVA M9-2; um commit, E-D3 e D-F25)

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts` (criado pela M3b-forja, Tarefa 7a)
- Modify: `apps/web/test/youtube/observatorio/arquivo-mensal-pendencias.test.ts`, o teste do script da M3b-forja (`grep -ln "scriptDasPendencias" apps/web/test`)
- Modify: `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (a linha "Segredo" do C13, r2.6; arquivo fora do git, editado no mesmo passo; emenda 23/10, D-M9-25b: acrescentar a regra de privacidade "`keys` com ids de espectador só enquanto o alvo está aberto; esvaziada ao concluir; nenhuma tela nem log lê `keys`", decisão: Phil)

**Interfaces:**
- Consumes: o C12 r2.6 (Tarefa 5: `owner_pending` v2); `aspas`, `scriptDeFalha`, `saidaSegura`, `apaga_conferido` (M3b-forja Tarefa 7a, `m3b-forja.md:5660-5699`).
- Produces: `VERSAO_PENDENCIAS = 2`; `TEMPOS_PENDENCIA` inalterado (5 tempos); `FALTAS = ['unidade_no_nas', 'resumo', 'manifesto', 'b2_nova', 'versao_em_curso', 'segunda_conferencia', 'snapshots', 'conferencia_nas_recente', 'b2_sync', 'blobs', 'imagens', 'lote_e10', 'so_prefixo', 'm9_desligado'] as const`; `MOTIVOS = ['antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente'] as const`; `PendenciaDoDono` ganha `falta: Falta | null`, `motivo: Motivo | null`, `prefixos: string[]`, `bloqueados: number`, `snapshotMaisAntigo: string | null`, `marcadoRodadoEm: string | null`, e `kind` ganha `'versao'`; `ITEM_ID_RE` aceita `item:<n>`, `canal:<uuid>` e `antiga:<uuid>`; `scriptDasPendencias(l, { versao, copias })` com `copias: Array<{ itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }>` (o que o Mac já registrou nesta execução, Tarefa 8).

**O que acontece quando o dado não existe:** `versao: 1` vinda de um banco sem a M9: `lerPendencias` devolve `{ ok: false, porque: 'versao: ...' }` (E-D5: estrito), o Mac sai com código 1 e o script de falha, a peça 7 mostra "não medido"; é por isso que este commit só entra depois da migration (TRAVA M9-2). Item em `copiar` sem cópia preparada pelo Mac nesta execução (o Mac falhou ao ler o NAS e bloqueou o alvo): o script diz `ESPERA-COPIA <item>` e não grava nada. `b2_nomes` vazio em `conferir_b2`: forma inválida (nunca "nada a fazer no B2"). Nome de B2 fora do alfabeto seguro: forma inválida (o script nunca imprime um nome que o leitor não validou). `falta` desconhecida (um site mais novo que o leitor): forma inválida, o Mac sai com o script de falha em vez de mostrar uma frase vazia.

- [ ] **Passo 1. Testes, falhando** (estender os existentes):

| Teste | Afirma |
|---|---|
| `lê a versao 2` | um corpo com os 5 tempos, `falta`, `motivo`, `prefixos`, `bloqueados`, `snapshot_mais_antigo`, `marcado_rodado_em` e `kind 'versao'`: `ok: true` com os campos mapeados |
| `recusa a versao 1` | `{ versao: 1, ... }`: `ok: false` |
| `b2_nomes só em conferir_b2` | `b2_nomes` em `apagar_antigas`: `ok: false`; vazio em `conferir_b2`: `ok: false` |
| `nome de B2 seguro` | `/^[A-Za-z0-9._\/-]{1,600}$/` sem `..`: nome com aspas, espaço, `$`, crase, quebra de linha ou `..` falha (Yannis I6: o nome B2 sai do site e vai a uma linha de shell) |
| `falta só em sem_comando, motivo só em bloqueado` | cada um fora do seu tempo: `ok: false`; `falta` fora de `FALTAS`: `ok: false` |
| `antiga: só com kind versao` | `item_id 'antiga:<uuid>'` com `kind 'video'`: `ok: false`; `antiga:` com `falta 'segunda_conferencia'` é aceito (Phil I9) |
| `script: copiar grava em _recebendo` | item `copiar` com uma cópia: o script tem `grava_recebendo 'texto' '<caminho>' '<sha>' <<'OBS-B64'`, o base64 e `OBS-B64`; `grava_recebendo` confere montagem e sentinela, grava em `$M/<filho>/.m9-tmp/<nome>.$$` (FORA de `_recebendo`, que o copiador varre), confere o sha256 e só então `mv -n` para `_recebendo/<caminho>`; arquivo já no caminho final ou em `_recebendo` com o mesmo sha256: `JA-GRAVADO`, sem regravar (Phil I8: o copiador nunca vê meio arquivo) |
| `script_duas_vezes_idempotente` (Review Focus 3) | rodar o script gerado (bash de verdade, `hostname` falso por `PATH`, raízes em pasta temporária com `.arquivo-vivo` e `mountpoint` falso): primeira vez `GRAVADO` e `APAGADO`; segunda vez `JA-GRAVADO` e `JA-APAGADO`, código 0, a versão nova intacta (sha256 conferido) |
| `script: conferir_b2 imprime o painel` | `B2-PAINEL: <nome>` por linha, com o nome que veio do site em `b2_nomes` (sem tradução na forja), mais a frase fixa `no painel do B2: Buckets > <bucket> > Browse Files, com "mostrar versões" ligado, procure o nome`; nada de `nome_b2.py` no script |
| `script: canal apaga arquivo a arquivo e o diretório vazio` | item `canal:` em `apagar_antigas`: um `apaga_conferido` por arquivo (`nova` vazia) e, no fim, `find <raiz>/<prefixo> -depth -type d -empty -delete` por prefixo, só com montagem e sentinela; prefixo que continua com arquivo depois disso: `RESTA <prefixo>: há arquivo que o site não conhece; use "Ver os comandos" na página do Arquivo` |
| `script: sem_comando diz o que falta` | uma frase de `ESPERA <item>: ...` por valor de `FALTAS` (teste que itera `FALTAS` e exige frase diferente de vazio e diferente entre si) |
| `script: bloqueado diz o motivo` | uma frase `BLOQUEADO <item>: ...` por valor de `MOTIVOS` |
| `regex da action` | o `item_id` aceito pela server action de "marcar como rodado" (Tarefa 12) só é `item:<n>` ou `canal:<uuid>`; `antiga:<uuid>` é recusado ali (a versão superada não tem comando do dono a marcar) |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. `pendencias.ts`:** subir `VERSAO_PENDENCIAS` a `2`; `KINDS = ['canal', 'video', 'comentario', 'versao']`; `ITEM_ID_RE` com `antiga:<uuid>`; `Item` ganha `falta: z.enum(FALTAS).nullable()`, `motivo: z.enum(MOTIVOS).nullable()`, `prefixos: z.array(caminho)`, `bloqueados: z.number().int().min(0)`, `snapshot_mais_antigo: z.string().nullable()`, `marcado_rodado_em: z.string().nullable()`; `b2_nomes` passa a `z.array(z.string().regex(NOME_B2).refine(n => !n.includes('..')))` com `NOME_B2 = /^[A-Za-z0-9._\/-]{1,600}$/`; o `superRefine` passa a ser:

```ts
}).strict().superRefine((i, ctx) => {
  const falha = (message: string): void => { ctx.addIssue({ code: z.ZodIssueCode.custom, message }) }
  if ((i.apagar.length > 0) !== (i.tempo === 'apagar_antigas')) falha('apagar só existe em apagar_antigas, e lá não é vazio')
  if ((i.b2_nomes.length > 0) !== (i.tempo === 'conferir_b2')) falha('b2_nomes só existe em conferir_b2, e lá não é vazio')
  if (i.falta !== null && i.tempo !== 'sem_comando') falha('falta só em sem_comando')
  if ((i.motivo !== null) !== (i.tempo === 'bloqueado')) falha('motivo só em bloqueado, e lá obrigatório')
  const deCanal = i.item_id.startsWith('canal:')
  if (deCanal !== (i.kind === 'canal')) falha('kind canal se e só se item_id começa por canal:')
  if (deCanal && i.item_id.slice('canal:'.length) !== i.channel_ref) falha('canal:<uuid> diferente de channel_ref')
  if (i.item_id.startsWith('antiga:') !== (i.kind === 'versao')) falha('kind versao se e só se item_id começa por antiga:')
  if (i.prefixos.length > 0 && !deCanal) falha('prefixos só em canal')
})
```

e o mapeamento de `lerPendencias` acrescenta os campos novos. `pendenciasParaTela` passa `falta`, `motivo`, `bloqueados` e `snapshotMaisAntigo` adiante (a tela da Tarefa 12 escreve a frase). **No mesmo commit**, revisar a linha "Segredo" do C13 em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.6): "com `versao: 2`, `apagar`, `b2_nomes` e `prefixos` saem preenchidos (caminhos do NAS, nomes do B2 e sha256 de arquivos do próprio arquivo); a chave `archive_owner` continua sem poder de apagar (o NAS e o B2 pedem outra credencial) e passa a poder **registrar** versão nova de expurgo (C14) e bloquear alvo; ela ainda não pode desbloquear (`obs_archive_expurgo_unblock` é só do painel)"; e a exceção do E-D4 (quem só edita não recebe a linha) continua: `podeVerComandos` inalterado.

- [ ] **Passo 4. `pendencias-script.ts`:** acrescentar ao corpo da função, ao lado de `apaga_conferido`:

```bash
  grava_recebendo() {   # filho caminho sha256; o conteúdo chega em base64 pela entrada, até a linha OBS-B64
    local base="$M/$1" final="$M/$1/$2" dest="$M/$1/_recebendo/$2" tmp
    if ! mountpoint -q "$base" || [ ! -f "$base/.arquivo-vivo" ]; then cat > /dev/null; echo "PULADO $1/$2: o NAS não está montado ou sem a sentinela" >&2; falhas=$((falhas+1)); return 0; fi
    if [ -f "$final" ] && [ "$(sha256sum < "$final" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/$2"; ja=$((ja+1)); return 0; fi
    if [ -f "$dest" ] && [ "$(sha256sum < "$dest" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/_recebendo/$2"; ja=$((ja+1)); return 0; fi
    mkdir -p -- "$(dirname -- "$dest")" "$base/.m9-tmp"; tmp="$base/.m9-tmp/$(basename -- "$2").$$"   # fora de _recebendo: o copiador não vê arquivo pela metade
    if ! base64 -d > "$tmp" || [ "$(sha256sum < "$tmp" | cut -c1-64)" != "$3" ]; then rm -f -- "$tmp"; echo "PULADO $1/$2: o arquivo chegou diferente do registrado" >&2; falhas=$((falhas+1)); return 0; fi
    if mv -n -- "$tmp" "$dest" && [ ! -e "$tmp" ]; then echo "GRAVADO $1/_recebendo/$2"; gravados=$((gravados+1)); else rm -f -- "$tmp"; echo "PULADO $1/$2: já havia outro arquivo em _recebendo com esse nome" >&2; falhas=$((falhas+1)); fi
  }
```

`mv` entre `$M/<filho>/.m9-tmp` e `$M/<filho>/_recebendo` é no mesmo sistema de arquivos do filho (rename atômico). O copiador ignora `.m9-tmp` (Tarefa 9, teste: a varredura de `_recebendo` não passa por ela) e a deixa vazia depois. `gravados=0` entra no `local` do começo; a trava do copiador (`flock`) vale também quando há `grava_recebendo`. O `b2_painel` é só um `echo`:

```bash
  b2_painel() {         # o nome vem do site, já validado pelo leitor (NOME_B2); a forja não traduz nada
    echo "B2-PAINEL: $1"
  }
```

Linhas por tempo (todo valor por `aspas()`):
- `copiar`: para cada `copias` do item, `grava_recebendo '<filho>' '<caminho>' '<sha256>' <<'OBS-B64'`, o base64 em linhas de 76, `OBS-B64`; sem cópia do item nesta execução: `echo 'ESPERA-COPIA <item>: o Mac não preparou a cópia (veja a mensagem dele acima)'`.
- `apagar_antigas`: `apaga_conferido` por arquivo (como a M3b); para `canal:`, depois dos arquivos, por prefixo: `[ -d "$M/<filho>/<prefixo>" ] && find "$M/<filho>/<prefixo>" -xdev -depth -type d -empty -delete`, e `[ ! -d "$M/<filho>/<prefixo>" ] || echo 'RESTA <prefixo>: ...'`. O comando segue a cópia do item em `_recebendo` (o `apaga_conferido` já exige a nova recebida).
- `conferir_b2`: `b2_painel '<nome>'` por nome (o `b2_nomes` vem como `<filho>/<nome B2>` e é impresso inteiro), e uma vez por item a frase do painel do B2 (sem a forja traduzir nada).
- `sem_comando`: `echo 'ESPERA <item>: <frase da falta>'`, com a frase própria de cada valor de `FALTAS` (ex.: `snapshots`: `ainda há snapshot do NAS com o arquivo; ele sai pelo ciclo normal ou por decisão do dono (veja o runbook); mais antigo: <data>`; `m9_desligado`: `a limpeza está desligada; o dono liga pelo painel (runbook)`). `bloqueado`: `echo 'BLOQUEADO <item>: <frase do motivo>'`.
- Fecho: `OBS-ARQUIVO: FEITO ($gravados gravado(s), $apagados apagado(s), $ja já feito(s), $esperando esperando)` quando houve `grava_recebendo` ou `apaga_conferido`; as outras finais como na M3b.

- [ ] **Passo 5.** Rodar → PASS. Rodar a suíte do observatório (`npx vitest run test/youtube/observatorio > /tmp/m9-obs.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-obs.txt`) → sem falha.

- [ ] **Passo 6. Commit** (quando mandado, depois de "TRAVA M9-2 solta" no ledger): `git commit -m "feat: M9: pendências do dono na versao 2 (copiar, apagar, conferir B2) e o script com grava_recebendo" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts <testes tocados>`.

---

### Task 8: o tempo `copiar` no Mac (`obs:arquivo` e `expurgar --item`) e `expurgar --canal`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (subcomando `expurgar`), o caminho do `obs:arquivo` da M3b-forja (Tarefa 7a: `cli.ts`/`pendencias` chamam `prepararCopias` antes de montar o script)
- Create: `apps/web/test/youtube/observatorio/arquivo-expurgar.test.ts`

**Interfaces:**
- Consumes: `filtrarUnidade`, `idsDeComentariosDoVideo`, `lerUnidadeGz`, `serializarUnidade`, `hashConteudo`, `refazerResumo`, `montarComandosDoCanal`, `CorpoRegistrar`/`RespostaAbrir`/`RespostaRegistrar` (Tarefa 6), `serializarResumo` (`resumo.ts:36`), `lerCredencial` e `URL_DO_ARQUIVO` (M3b-forja Tarefa 7a, `m3b-forja.md:5214`, `:5643`), `PendenciaDoDono` (Tarefa 7).
- Produces: `RAIZ_DO_FILHO = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }` (o `ARQ_MONTAGEM_ESCRITA` padrão do script) e `RAIZ_LEITURA = { numerico: '/mnt/arquivo/leitura/numerico', texto: '/mnt/arquivo/leitura/texto' }` (as unidades `mnt-arquivo-leitura-*.mount` do kit, `ro`); `TETO_COPIA_BYTES = 64 * 1024 * 1024`; `TETO_TOTAL_BYTES = 256 * 1024 * 1024` (por execução do `obs:arquivo`); `interface DepsExpurgo { nasMontado(filho: Filho): Promise<boolean>; lerDoNas(filho: Filho, caminho: string): Promise<Buffer | null>; site(passo: unknown): Promise<{ status: number; corpo: unknown }>; agora(): Date; guardar: { ler(sha: string): Promise<Buffer | null>; gravar(sha: string, dados: Buffer): Promise<void> } }`; `prepararCopias(itens: PendenciaDoDono[], d: DepsExpurgo): Promise<{ copias: Copia[]; avisos: string[]; nasFora: boolean }>`; `expurgarCanal(ref: string, d: DepsExpurgo & { gravarArquivo(nome: string, texto: string): Promise<string> }): Promise<{ codigo: 0 | 1 | 2; linha: string | null; frase: string }>`.

**O que acontece quando o dado não existe:** NAS desmontado ou sem a sentinela (`ssh forja 'mountpoint -q <raiz> && test -f <raiz>/.arquivo-vivo'` falha): `prepararCopias` PARA sem bloquear nada e devolve `nasFora: true` ("NAS fora; nada feito"), porque uma montagem ausente é indisponibilidade e não prova de que o arquivo sumiu (Phil C5, Yannis I2); só com o filho montado um arquivo que falta vira `block(antiga_ausente)`. Arquivo antigo que a montagem `ro` não acha: `block(antiga_ausente)` e aviso no `stderr` ("restaure do B2 ou do snapshot e rode `select public.obs_archive_expurgo_unblock(...)` no painel; runbook"); sha256 lido diferente do registro, ou `hashConteudo` das linhas lidas diferente de `hash_conteudo` do alvo: `block(antiga_divergente)`; filtro com `removidas` diferente de `esperadas` (quando `esperadas` não é nulo): o servidor devolve `contagem_divergente` e bloqueia o alvo; versão nova maior que `TETO_COPIA_BYTES`: `block(grande_demais)`; recusa (409) ou 404 de um grupo: aviso no `stderr` e segue para o próximo grupo (um grupo ruim não derruba os outros, Yannis I3); rota fora (rede, 5xx, forma): nada registrado do grupo em curso, o `obs:arquivo` sai com o script de falha (D-F22), nunca com cópia parcial. Cópia que o Mac já registrou numa execução anterior e cujo script o dono não rodou: o alvo está em `aguardando_nova` sem `received_at`; o Mac relê a cópia guardada em `.superpowers/sdd/manutencao-nas/copias/<sha256>.gz` e a reemite no script (sem arquivo guardado: regenera a versão nova a partir da antiga e só reemite se o sha256 bater com o registrado; senão `block(antiga_divergente)`). `expurgar --canal` com uuid que o site não conhece, de canal existente, `guardado` ou `sem_destino`: código 1 e a frase do `02` §11.3 (`canal_desconhecido`, `canal_nao_removido`, `canal_guardado`, `sem_destino`), sem arquivo gravado.

- [ ] **Passo 1. Testes, falhando** (`arquivo-expurgar.test.ts`, `// @vitest-environment node`, com `DepsExpurgo` falso: um "NAS" em memória com `nasMontado` configurável, um "site" que registra os passos recebidos e responde `{ status, corpo }`, e um "guardado" em memória):

| Teste | Afirma |
|---|---|
| `nas fora: para sem bloquear` | `nasMontado` falso para o filho do grupo: nenhum `bloquear`, nenhum `registrar`, `nasFora: true`, aviso "NAS fora; nada feito" |
| `copiar: lê, filtra, registra e devolve a cópia` | item com um grupo `serie` (diária com 3 linhas, 2 do vídeo): o site recebe `abrir` e depois `registrar` com `removidas 2`, `row_count 1`, `hash_conteudo` = `hashConteudo` das linhas que ficaram, `resumo.versao` = `resumo.versao + 1` do `abrir` e `resumo.tabelas_lidas` com a tabela do alvo e as de `outras` e `vazias`; a cópia devolvida tem o caminho `serie/canais/<ref>/competitor_video_daily/2026-09.v2.csv.gz` e o base64 do gz cujo sha256 é o registrado |
| `copiar: resumo junto` | o grupo devolve **três** cópias quando o resumo não é vazio: a unidade e os dois arquivos do resumo (`...resumo/2026-09.v<N>.canal.csv.gz` e `.video.csv.gz`), com os sha256 que foram ao `registrar` |
| `resumo com as outras tabelas` | grupo com a diária (alvo) e as horárias (`outras`, que o item não toca): o resumo refeito leva as linhas das duas tabelas, sem filtro, e `tabelas_lidas` as duas |
| `sha diferente bloqueia` | o "NAS" devolve bytes com outro sha256: o site recebe `bloquear` com `antiga_divergente`; nenhuma cópia; um aviso |
| `hash de conteúdo diferente bloqueia` | sha256 bate mas as linhas lidas têm `hashConteudo` diferente do `hash_conteudo` do alvo: `bloquear antiga_divergente` |
| `ausente bloqueia (NAS montado)` | `lerDoNas` devolve `null` com o filho montado: `bloquear` com `antiga_ausente` |
| `grupo sem linhas do item` | o filtro dá zero em todas as unidades: `registrar` com todos os alvos em `removidas 0` e `unidade: null`; nenhuma cópia |
| `recusa de um grupo não derruba os outros` | o `registrar` do 1º grupo devolve 409 `base_mudou`; o 2º grupo é registrado; um aviso no `stderr` com o motivo |
| `rota fora não deixa meio registro` | o site lança (transporte) no `registrar`: `prepararCopias` lança e nenhuma cópia sai |
| `cópia guardada é reemitida` | alvo em `aguardando_nova` sem `received_at`: a cópia sai do `guardar` sem reler o NAS; sem a guardada, regenera e reemite só se o sha256 bater, senão `bloquear antiga_divergente` |
| `teto total` | grupos que passam de `TETO_TOTAL_BYTES` na soma: os que cabem saem, o resto fica para a próxima execução, com aviso |
| `comentários: marcas pelos comentários do mês` | grupo `texto` com comentários e marcas de um vídeo: as marcas dos comentários do vídeo saem; as de outros ficam |
| `expurgar --item --apagar-antigas` | item fora de `apagar_antigas`/`conferir_b2`: recusa com a frase do tempo atual |
| `expurgar --canal: recusas` | site responde `canal_guardado`: código 1, frase "esse canal foi guardado no arquivo; nada a apagar", nenhum arquivo gravado |
| `expurgar --canal: grava e imprime a linha` | remoção `pedido` com dois prefixos: grava o texto de `montarComandosDoCanal` (com os `prefixos` do item pendente, inclusive os de `_recebendo`) em `.superpowers/sdd/manutencao-nas/comandos/expurgar-<8 primeiros do ref>.sh` (abertura exclusiva `wx`, modo `0o600`; existe: sufixo `-2`, `-3`) e devolve a linha `ssh forja 'bash -s' < '<arquivo>' > '<saidas>/expurgar-<ref8>-<AAAAMMDD-HHMM>.txt' 2>&1` |
| `poda dos concluídos` | `item_targets` concluídos há mais de 400 dias não são lidos pelo Mac nem aparecem na lista; a poda do banco é declarada (limite abaixo), não executada aqui |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. `expurgar.ts`** (o essencial; os tipos vêm das Tarefas 6 e 7):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts
/**
 * Manutenção M9: o tempo `copiar` no Mac (02 §11.3; D-M9-4, D-M9-6). Lê a versão antiga do NAS pela montagem `ro` (por ssh),
 * filtra o item, serializa em TS, registra pela rota C14 e devolve as cópias para o script. Nunca escreve no NAS: quem grava é o
 * script, rodado pelo dono.
 */
import { createHash } from 'node:crypto'
import { RespostaAbrir, RespostaRegistrar } from '../arquivo-mensal/expurgo-contrato'
import { filtrarUnidade, hashConteudo, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade, type UnidadeLida } from '../arquivo-mensal/expurgo-filtro'
import { refazerResumo } from '../arquivo-mensal/expurgo-resumo'
import { serializarResumo } from '../arquivo-mensal/resumo'
import type { PendenciaDoDono } from '../arquivo-mensal/pendencias'
import type { Filho } from '../arquivo-mensal/contrato'

export const RAIZ_DO_FILHO: Record<Filho, string> = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }
export const RAIZ_LEITURA: Record<Filho, string> = { numerico: '/mnt/arquivo/leitura/numerico', texto: '/mnt/arquivo/leitura/texto' }
export const TETO_COPIA_BYTES = 64 * 1024 * 1024
export const TETO_TOTAL_BYTES = 256 * 1024 * 1024
export interface Copia { itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }
export interface DepsExpurgo {
  nasMontado(filho: Filho): Promise<boolean>
  lerDoNas(filho: Filho, caminho: string): Promise<Buffer | null>
  site(passo: unknown): Promise<{ status: number; corpo: unknown }>
  agora(): Date
  guardar: { ler(sha: string): Promise<Buffer | null>; gravar(sha: string, dados: Buffer): Promise<void> }
}
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

export async function prepararCopias(itens: PendenciaDoDono[], d: DepsExpurgo): Promise<{ copias: Copia[]; avisos: string[]; nasFora: boolean }> {
  const copias: Copia[] = []; const avisos: string[] = []
  let total = 0
  const montado = new Map<Filho, boolean>()
  const filhoOk = async (f: Filho): Promise<boolean> => { if (!montado.has(f)) montado.set(f, await d.nasMontado(f)); return montado.get(f)! }
  for (const it of itens.filter(i => i.tempo === 'copiar' && i.itemId.startsWith('item:'))) {
    const pedido = await d.site({ passo: 'abrir', item_id: it.itemId })
    if (pedido.status === 404) { avisos.push(`obs:arquivo: ${it.itemId}: o site não o conhece mais; pulado`); continue }
    const aberto = RespostaAbrir.parse(pedido.corpo)
    grupo: for (const g of aberto.grupos) {
      if (!(await filhoOk(g.filho))) { avisos.push('obs:arquivo: NAS fora; nada feito'); return { copias, avisos, nasFora: true } }
      const lidas = new Map<number, UnidadeLida>()
      for (const a of g.alvos) {
        const partes: Buffer[] = []
        for (const f of a.arquivos) {
          const b = await d.lerDoNas(g.filho, f.caminho)
          const motivo = b === null ? 'antiga_ausente' : sha(b) !== f.sha256 ? 'antiga_divergente' : null
          if (motivo) {
            await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo })
            avisos.push(`obs:arquivo: ${it.itemId}: ${f.caminho} ${motivo === 'antiga_ausente' ? 'não está no NAS' : 'no NAS não é o registrado'}; alvo bloqueado (runbook, "alvo bloqueado")`)
            continue grupo
          }
          partes.push(b!)
        }
        const us = partes.map(lerUnidadeGz)
        const lida = { colunas: us[0]!.colunas, linhas: us.flatMap(u => u.linhas) }
        if (hashConteudo(lida.linhas) !== a.hash_conteudo) {
          await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo: 'antiga_divergente' })
          avisos.push(`obs:arquivo: ${it.itemId}: o conteúdo de ${a.tabela} no NAS não bate com o hash registrado; alvo bloqueado`)
          continue grupo
        }
        lidas.set(a.alvo_id, lida)
      }
      // as outras tabelas do mês entram no resumo sem filtro (o item não as toca); o Mac as lê também
      const outras: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }> = []
      for (const o of g.outras) {
        const bs: Buffer[] = []
        for (const f of o.arquivos) { const b = await d.lerDoNas(g.filho, f.caminho); if (b === null || sha(b) !== f.sha256) { avisos.push(`obs:arquivo: ${it.itemId}: ${f.caminho} (outra tabela do mês) ilegível; grupo pulado`); continue grupo } bs.push(b) }
        const us = bs.map(lerUnidadeGz)
        outras.push({ tabela: o.tabela, unidade: { colunas: us[0]!.colunas, linhas: us.flatMap(u => u.linhas) }, hashConteudo: o.hash_conteudo })
      }
      const chaves = new Set(g.alvos[0]!.chaves)
      const comentarios = g.alvos.find(a => a.tabela === 'competitor_video_comments')
      const doVideo = it.kind === 'video' && comentarios ? idsDeComentariosDoVideo(lidas.get(comentarios.alvo_id)!, chaves) : undefined
      const kind = it.kind === 'video' ? 'video' : 'comentario'
      const unidades: Array<{ alvo_id: number; removidas: number; unidade: Record<string, unknown>; ser: ReturnType<typeof serializarUnidade>; tabela: string; filtrada: UnidadeLida }> = []
      const semLinhas: number[] = []
      for (const a of g.alvos) {
        const r = filtrarUnidade({ tabela: a.tabela, kind, chaves, unidade: lidas.get(a.alvo_id)!, comentariosDoVideo: doVideo })
        if (r.removidas === 0) { semLinhas.push(a.alvo_id); continue }
        const ser = serializarUnidade(r.unidade, a.coluna_controle)
        if (ser.file_bytes > TETO_COPIA_BYTES) {
          await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo: 'grande_demais' })
          avisos.push(`obs:arquivo: ${it.itemId}: a versão nova de ${a.tabela} passa de 64 MB; alvo bloqueado`)
          continue grupo
        }
        unidades.push({ alvo_id: a.alvo_id, removidas: r.removidas, tabela: a.tabela, ser, filtrada: r.unidade, unidade: {
          row_count: ser.row_count, control_sum: ser.control_sum, hash_conteudo: ser.hash_conteudo, schema_fp: a.schema_fp,
          sha256_bytes: ser.sha256_bytes, csv_sha256: ser.csv_sha256, file_bytes: ser.file_bytes, partes: 1, min_key: null, max_key: null, parts: [] } })
      }
      const bytesDoGrupo = unidades.reduce((s, u) => s + u.ser.file_bytes, 0)
      if (total + bytesDoGrupo > TETO_TOTAL_BYTES) { avisos.push(`obs:arquivo: ${it.itemId}: teto de 256 MB por execução; o resto fica para a próxima`); continue }
      const versaoResumo = (g.resumo?.versao ?? 0) + 1
      const filtradaDe = (alvo: number): UnidadeLida => unidades.find(u => u.alvo_id === alvo)?.filtrada ?? lidas.get(alvo)!
      const todasAsUnidades = [
        ...g.alvos.map(a => ({ tabela: a.tabela, unidade: filtradaDe(a.alvo_id), hashConteudo: unidades.find(u => u.alvo_id === a.alvo_id)?.ser.hash_conteudo ?? a.hash_conteudo })),
        ...outras]
      const comentariosParaMarcas = comentarios ? filtradaDe(comentarios.alvo_id) : outras.find(o => o.tabela === 'competitor_video_comments')?.unidade
      const linhasResumo = refazerResumo({ classe: g.classe, canal: g.canal, mes: g.mes, diasDoMes: g.dias_do_mes, versao: versaoResumo,
        unidades: todasAsUnidades, vazias: g.vazias.map(v => ({ tabela: v.tabela, hashConteudo: v.hash_conteudo })), comentarios: comentariosParaMarcas })
      const resumo = serializarResumo(linhasResumo)
      const arq = (p: 'canal' | 'video') => resumo.arquivos.find(x => x.papel === p) ?? null
      const resp = await d.site({
        passo: 'registrar', item_id: it.itemId, classe: g.classe, canal: g.canal, mes: g.mes,
        alvos: g.alvos.map(a => ({ alvo_id: a.alvo_id, removidas: unidades.find(u => u.alvo_id === a.alvo_id)?.removidas ?? 0,
          unidade: unidades.find(u => u.alvo_id === a.alvo_id)?.unidade ?? null })),
        resumo: { versao: versaoResumo, vazio: resumo.vazio,
          canal_sha256: arq('canal')?.sha256 ?? null, canal_bytes: arq('canal')?.bytes ?? null, canal_rows: arq('canal')?.linhas ?? null,
          video_sha256: arq('video')?.sha256 ?? null, video_bytes: arq('video')?.bytes ?? null, video_rows: arq('video')?.linhas ?? null,
          tabelas_lidas: [...todasAsUnidades.map(u => u.tabela), ...g.vazias.map(v => v.tabela)].sort() },
      })
      if (resp.status === 409) { avisos.push(`obs:arquivo: ${it.itemId} ${g.classe}/${g.mes}: recusado pelo site (${JSON.stringify((resp.corpo as { motivo?: string }).motivo ?? 'sem motivo')}); sigo com os outros grupos`); continue }
      const ok = RespostaRegistrar.parse(resp.corpo)
      total += bytesDoGrupo
      for (const u of ok.alvos ?? []) {
        const x = unidades.find(y => y.alvo_id === u.alvo_id)
        if (!x || !x.ser.gz || u.versao === undefined) continue
        const caminho = `${g.classe}/canais/${g.canal}/${x.tabela}/${g.mes}.v${u.versao}.csv.gz`
        await d.guardar.gravar(x.ser.sha256_bytes, x.ser.gz)
        copias.push({ itemId: it.itemId, filho: g.filho, caminho, sha256: x.ser.sha256_bytes, base64: x.ser.gz.toString('base64') })
      }
      if (ok.resumo) for (const f of resumo.arquivos) {
        await d.guardar.gravar(f.sha256, f.gz)
        copias.push({ itemId: it.itemId, filho: g.filho, caminho: `${g.classe}/canais/${g.canal}/resumo/${g.mes}.v${ok.resumo.versao}.${f.papel}.csv.gz`, sha256: f.sha256, base64: f.gz.toString('base64') })
      }
    }
  }
  return { copias, avisos, nasFora: false }
}
```

(A reemissão de alvos em `aguardando_nova` sem `received_at` entra no mesmo laço: para cada alvo assim que a lista de pendências traz com tempo `copiar` por `falta 'unidade_no_nas'`, o Mac pede o `abrir`, que devolve o alvo com `arquivos` da versão nova; `guardar.ler(sha)` devolve a cópia; sem ela, regenera com o mesmo caminho do passo anterior e só emite se o `sha256` bater com o registrado. O passo exato do `abrir` para esses alvos é o que o teste `cópia guardada é reemitida` decide, e o ajuste vai para o ledger.)

`nasMontado(filho)` de verdade: `execFile('ssh', ['forja', `mountpoint -q ${RAIZ_LEITURA[filho]} && test -f ${RAIZ_LEITURA[filho]}/.arquivo-vivo`])`; código 0 = montado; qualquer outra coisa (inclusive ssh que falha) = `false`. `lerDoNas(filho, caminho)`: `execFile('ssh', ['forja', 'cat', '--', `${RAIZ_LEITURA[filho]}/${caminho}`], { encoding: 'buffer', maxBuffer: TETO_COPIA_BYTES * 2 })`, com o `caminho` já validado por `CAMINHO_SEGURO` (o leitor estrito); código de saída 1 com `No such file` no `stderr` → `null`; outro erro → lança (o `obs:arquivo` sai com o script de falha). As duas são leitura pela montagem `ro` (permitidas pela regra da forja) e usam uma só conexão ssh reaproveitada (`-o ControlMaster=auto -o ControlPath=~/.ssh/cm-forja-%C -o ControlPersist=60`). `guardar` grava em `.superpowers/sdd/manutencao-nas/copias/<sha256>.gz` com modo `0600` (arquivo de trabalho do Mac, fora do git).

**Ordem dentro do `obs:arquivo`** (D-F23): ler pendências → `prepararCopias` (avisos no `stderr`; `nasFora`: o script sai só com as linhas de espera e o aviso) → ler as pendências **de novo** (o registro mudou os tempos; o script sai do estado novo) → `scriptDasPendencias(l2, { versao, copias })` → `escreverTudo`. Uma cópia cujo item não está mais em `copiar` na segunda leitura (o registro o levou a `sem_comando`/`unidade_no_nas`) entra mesmo assim: o script a grava em `_recebendo` sob o `item_id` dela, e o copiador a acha por `aguardando_dono`. `expurgar --item <id>` faz o mesmo para um item; `expurgar --item <id> --apagar-antigas` só imprime o script do item se ele estiver em `apagar_antigas` ou `conferir_b2`, e recusa com a frase do tempo atual nos outros (item 66: "recusa enquanto os três arquivos novos não estiverem `recebida`").

**Limites declarados (Yannis I11):** `item_targets` concluídos acumulam (um alvo por item e tabela por mês); o crescimento é de dezenas de linhas por item apagado e o dono apaga poucos por mês, então a poda (`delete ... where estado = 'concluido' and done_at < now() - interval '400 days'`) fica de fora desta etapa e entra no backlog com a observação de que a tabela é lida só por `item_id` e pelo índice parcial dos abertos.

- [ ] **Passo 4. `cli.ts`:** subcomando `expurgar` com `--item <id>` (`^[1-9][0-9]{0,18}$`), `--apagar-antigas` (só com `--item`), `--canal <uuid>` (`UUID_RE`); qualquer outra combinação: código 2 e a ajuda. `--canal` chama a rota `GET pending` (C13) e usa o item `canal:<ref>` dela: ausente → pergunta à rota C14 (`passo: 'canal', channel_ref`) o motivo (`canal_desconhecido`, `canal_nao_removido`, `canal_guardado`, `sem_destino`) e devolve a frase; presente com `prefixos` → `montarComandosDoCanal({ channelRef, prefixos: <os `prefixos` do item, cada um com o filho que o prefixo diz>, raiz: RAIZ_DO_FILHO, geradoEm: agora })` (o comando apaga também `_recebendo/<prefixo>` e `_recebendo/_quarentena/<prefixo>`), grava e imprime a linha. O `--canal` só funciona quando a pendência `canal:` já tem `prefixos` (a remoção `apagar` existe e foi liberada); antes disso devolve a frase da `falta`.

- [ ] **Passo 5.** Rodar → PASS.

- [ ] **Passo 6. Commit** (quando mandado; o `expurgar` chama a rota C14, então entra **depois** da Tarefa 11 no `staging`, ou no mesmo envio): `git add -- apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts apps/web/test/youtube/observatorio/arquivo-expurgar.test.ts`; `git commit -m "feat: M9: obs:arquivo prepara as cópias do expurgo e expurgar --item/--canal" -- <os arquivos>`.

---

### Task 9: o kit da forja (`comum.py`, `b2.py`, `copiar.py`, `conferir.py`) e o arquivo de instalação do dono

**Files (git LOCAL `~/Workspace/forja/ferramentas`, sem remoto; commit por caminho; o kit é plano em `arquivo/`, conferido em 14/10):**
- Modify: `~/Workspace/forja/ferramentas/arquivo/comum.py` (`config` ganha `leitura`: `ARQ_MONTAGEM_LEITURA` ou `/mnt/arquivo/leitura`, ao lado de `escrita`, l.429)
- Modify: `~/Workspace/forja/ferramentas/arquivo/b2.py` (método `listar_prefixo`)
- Modify: `~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py` (`validar_plano` l.468; a medição dos prefixos e dos snapshots; o `attest`)
- Modify: `~/Workspace/forja/ferramentas/arquivo/conferir-b2/conferir.py` (`validar_plano` l.99; a pergunta dos prefixos depois do `controle_ok`)
- Modify: os testes do kit (`~/Workspace/forja/ferramentas/arquivo/teste_*.py`; rodam por `bash teste_tudo.sh` e `python3 teste_copiador.py`)
- Create: `.superpowers/sdd/manutencao-nas/comandos/m9-9-instalar-kit.sh` (do dono)
- NÃO criar `nome_b2.py` (o plano anterior previa a tradução na forja; saiu: o site devolve o nome do B2 no `attest`, e o painel mostra o nome tal como veio). NÃO mexer na M3b-forja além deste commit: a M9 estende o kit só aqui (nota no `m3b-forja-progresso.md`).

**Interfaces:**
- Consumes: `prefixos_ausentes` no plano do copiador (`obs_archive_plan` envolto, Tarefa 5) e do B2 (`obs_archive_b2_plan`): lista de `{ alvo, filho, prefixo, e_prefixo, provar_snapshots }` (`provar_snapshots` só no plano do NAS). Hoje os dois programas exigem `prefixos_ausentes == []` (`copiar.py:468`, `conferir.py:99`) e passam a aceitar uma lista de dicts com essas chaves (e só elas).
- Produces: o corpo do `attest` de fonte `nas` ganha `prefixos: [{ alvo, filho, prefixo, estado: 'ausente' | 'presente', snapshots?: 'ausente' | 'presente' | 'indisponivel', snapshot_mais_antigo?: string }]`; o de fonte `b2` ganha `prefixos: [{ alvo, filho, prefixo, estado: 'ausente' | 'presente', nomes: string[] }]` com o `execucao_id` da execução; `B2.listar_prefixo(prefixo, maximo)`.

**O que acontece quando o dado não existe:** `prefixos_ausentes` ausente do plano (site antigo): o programa trata como lista vazia e não atesta nada (os canais ficam parados em `sem_comando`), nunca "ausente" por omissão; é a mesma falha em verde do `plano_invalido`, por isso a presença da CHAVE continua obrigatória no plano (`validar_plano` exige a chave e a lista) e o site com a M9 desligada manda `[]`. Filho sem montagem ou sem sentinela: o prefixo desse filho não é perguntado (o site recusaria com `filho_fora`). Medição de snapshot que não consegue ler `<leitura>/<filho>/.zfs/snapshot` (montagem `ro` ausente, EIO): `snapshots: 'indisponivel'`, que o site não conta como prova. Listagem de prefixo do B2 que falha: o item é omitido do `attest` (nada atestado), e o programa conta `prefixo_sem_acesso`; qualquer ação de versão (upload, hide, start, folder) vira `presente`.

- [ ] **Passo 1. Testes, falhando** (as suítes `teste_copiador.py`, `teste_conferir_b2.py`, `teste_comum.py`, com o sistema de arquivos em pasta temporária e o B2 falso de `falsos.py`; nomes de B2 REAIS com sufixo `.bin`, `<prefixo do remoto>/<filho>/<relativo>.bin`, para não repetir o erro de testar com o nome sem sufixo):

| Teste | Afirma |
|---|---|
| `config: leitura` | sem `ARQ_MONTAGEM_LEITURA`: `/mnt/arquivo/leitura`; com a variável: o valor (teste que apaga a variável) |
| `validar_plano aceita lista de dicts` | `prefixos_ausentes` com um dict `{alvo, filho, prefixo, e_prefixo, provar_snapshots}` passa; item sem `alvo`/`filho`/`prefixo`, filho fora de `FILHOS`, prefixo com `..` ou fora do alfabeto: `CaminhoInvalido`; lista com mais de 2000 itens: inválido; chave ausente: inválido |
| `prefixo_nas_ausente` | prefixo sem diretório, filho montado com sentinela: `estado 'ausente'` no `attest` de fonte `nas`; `_recebendo/<prefixo>` e `_recebendo/_quarentena/<prefixo>` também ausentes (o site os lista como linhas próprias) |
| `prefixo_nas_presente` | diretório com um arquivo, ou só subdiretório vazio: `presente` (diretório vazio que restou também é presença) |
| `sem_sentinela_nao_atesta` | sem `.arquivo-vivo`: nenhum item em `prefixos` |
| `snapshots: so_com_provar_snapshots` | `provar_snapshots` falso: nada medido em `.zfs`; verdadeiro e nenhum snapshot guarda o prefixo (`<leitura>/<filho>/.zfs/snapshot/*/<prefixo>` ausente em todos): `snapshots: 'ausente'`; algum guarda: `'presente'` com `snapshot_mais_antigo` = o nome do mais antigo que o guarda; pasta `.zfs/snapshot` ilegível: `'indisponivel'` |
| `b2: prefixo sem versões` | `listar_prefixo` sem nenhuma versão, na execução com `controle_ok`: `estado 'ausente'`, `nomes []`, com o `execucao_id` dela; o prefixo de canal é o nome do B2 de `prefixo.rstrip('/')` com sufixo vazio mais `/` |
| `b2: hide é presente` | só uma versão `hide`: `presente`, com o nome (o painel precisa apagar as versões, CP32); versão `start` e `folder` também contam |
| `b2: erro de listagem omite` | a listagem lança `ErroB2`: o item não vai ao `attest` e `prefixo_sem_acesso` sobe 1 |
| `b2: pergunta depois do controle` | os prefixos só são perguntados depois de `estado == 'controle_ok'` na MESMA execução; execução com `controle_falhou`: nenhuma pergunta |
| `b2: nomes limitados` | mais de 20 versões: `nomes` com no máximo 20 e `presente` |

- [ ] **Passo 2.** Rodar (`cd ~/Workspace/forja/ferramentas/arquivo && bash teste_tudo.sh > /tmp/m9-kit.txt 2>&1; grep -E "FAIL|ERRO|Traceback" /tmp/m9-kit.txt | head`) → FAIL.

- [ ] **Passo 3. Código.**

`comum.py`, em `config` (ao lado de `escrita`): `"leitura": e.get("ARQ_MONTAGEM_LEITURA") or "/mnt/arquivo/leitura",`.

`b2.py`, método novo (a listagem **sem** filtro de nome exato, ao contrário de `versoes`):

```python
    def listar_prefixo(self, prefixo, maximo=100):
        """M9: todas as versões, de qualquer ação, cujo nome começa por `prefixo`. [] = nada (a única ausência). Erro de
        rede ou resposta fora da forma sobe ErroB2 (nunca vira lista vazia)."""
        d = self._post("b2_list_file_versions", {"bucketId": self.bucket_id, "prefix": prefixo, "maxFileCount": maximo})
        if not isinstance(d.get("files"), list):
            raise ErroB2("listagem fora da forma")
        return [f for f in d["files"] if isinstance(f, dict) and str(f.get("fileName", "")).startswith(prefixo)]
```

`copiar.py`: `validar_plano` troca `d.get("prefixos_ausentes") == []` por `prefixos_validos(d.get("prefixos_ausentes"))`, e a função é a mesma nos dois programas (fica em `comum.py`):

```python
RE_PREFIXO_M9 = re.compile(r"^(?:_recebendo/(?:_quarentena/)?)?[a-z_]+/canais/[0-9a-f-]{36}/(?:[a-z_]+/)*$")

def prefixos_validos(lista):
    """M9: prefixos_ausentes é uma lista de dicts {alvo, filho, prefixo, e_prefixo, provar_snapshots?}; [] é válido (M9 desligada)."""
    if not isinstance(lista, list) or len(lista) > 2000:
        return False
    for p in lista:
        if not (isinstance(p, dict) and isinstance(p.get("alvo"), str) and 0 < len(p["alvo"]) <= 80
                and p.get("filho") in FILHOS and isinstance(p.get("prefixo"), str) and RE_PREFIXO_M9.match(p["prefixo"])
                and ".." not in p["prefixo"] and isinstance(p.get("e_prefixo"), bool)
                and isinstance(p.get("provar_snapshots", False), bool)):
            return False
    return True
```

Medição no copiador, depois da passada normal e **no mesmo `attest`** (os dois ficam na mesma `enviar_atestos`, com `filhos` já remedidos por `remedir`):

```python
    def prefixos_nas(self, plano):
        """M9 (D-M9-8): prova de ausência no NAS. Só pergunta com o filho montado e com a sentinela (o site ainda confere: filho_fora)."""
        saida = []
        for p in plano.get("prefixos_ausentes") or []:
            f, prefixo = p["filho"], p["prefixo"]
            if not self.ok(f):
                continue
            alvo = os.path.join(self.filhos[f]["raiz"], prefixo.rstrip("/"))
            try:
                presente = os.path.lexists(alvo)
            except OSError:
                self.n["prefixo_ilegivel"] += 1
                continue
            item = {"alvo": p["alvo"], "filho": f, "prefixo": prefixo, "estado": "presente" if presente else "ausente"}
            if p.get("provar_snapshots") and not presente:
                item.update(self.snapshots_do(f, prefixo))
            saida.append(item)
        return saida

    def snapshots_do(self, filho, prefixo):
        """Phil I1: prova DIRETA de que nenhum snapshot ZFS ainda guarda o prefixo, lida pela montagem `ro` (o `.zfs` aparece nela:
        conferido na forja em 14/10, `ls <leitura>/numerico/.zfs/snapshot`). Indisponível nunca vira ausente."""
        pasta = os.path.join(self.cf["leitura"], filho, ".zfs", "snapshot")
        try:
            nomes = sorted(os.listdir(pasta))
            achados = [n for n in nomes if os.path.lexists(os.path.join(pasta, n, prefixo.rstrip("/")))]
        except OSError:
            return {"snapshots": "indisponivel"}
        if achados:
            return {"snapshots": "presente", "snapshot_mais_antigo": achados[0]}
        return {"snapshots": "ausente"}
```

(`sorted` por nome serve porque o nome do snapshot começa pela data, `auto-AAAA-MM-DD_HH-MM`; snapshot de outro nome: o mais antigo é o primeiro em ordem alfabética, e o texto vai ao painel só como informação.) O `attest` de fonte `nas` passa a levar `"prefixos": self.prefixos_nas(plano)` quando a lista não é vazia (a chave sai do corpo se vazia).

`conferir.py`: depois de `estado == 'controle_ok'` e antes do laço de páginas de `arquivos`:

```python
            if desfecho is None and plano["prefixos_ausentes"]:
                cx.prefixos(plano)            # mesma execução do controle negativo e dos canários (C7.2)
```

e na classe `Conferencia`:

```python
    def prefixos(self, plano):
        itens = []
        for p in plano["prefixos_ausentes"]:
            if self.acabou_o_tempo():
                break
            # o prefixo de canal no B2: o nome do B2 da pasta, sem sufixo, mais "/" (os arquivos têm o sufixo .bin no fim)
            prefixo_b2 = B.nome_b2(self.conf, p["filho"], p["prefixo"].rstrip("/"), "") + "/"
            try:
                versoes = self.cli.listar_prefixo(prefixo_b2, 21)
            except B.ErroB2:
                self.n["prefixo_sem_acesso"] += 1
                continue
            nomes = [str(v.get("fileName")) for v in versoes[:20]]
            itens.append({"alvo": p["alvo"], "filho": p["filho"], "prefixo": p["prefixo"],
                          "estado": "presente" if versoes else "ausente", "nomes": nomes})
        for i in range(0, len(itens), LOTE):
            self.site.dados("POST", "attest", {"fonte": "b2", "execucao_id": self.execucao_id, "prefixos": itens[i:i + LOTE]})
```

(Se o `attest` do B2 exigir `itens`, o corpo leva `"itens": []`; o teste `b2: pergunta depois do controle` amarra a forma que o site aceita. O contrato da Tarefa 11 aceita `prefixos` sem `itens`.)

- [ ] **Passo 4.** Rodar → PASS (a suíte inteira do kit, `teste_tudo.sh`).

- [ ] **Passo 5. Commit no kit:** `git -C ~/Workspace/forja/ferramentas add -- arquivo/comum.py arquivo/b2.py arquivo/copiador/copiar.py arquivo/conferir-b2/conferir.py <testes>` e `git -C ~/Workspace/forja/ferramentas commit -m "feat: M9: atestado de ausência por prefixo (NAS, snapshots e B2) no kit" -- <os mesmos caminhos>`.

- [ ] **Passo 5b. Regra do `attest` (Phil I2, lote 2).** O `attest` com `prefixos` roda em duas transações (`obs_archive_attest_nas/b2`, depois `obs_archive_attest_prefixos`). Se a segunda falha, a rota responde 500 com a primeira já gravada. O kit trata **500 do `attest` como "repetir o attest inteiro"** (nunca como "a execução falhou"): as duas transações são idempotentes (marca de tempo reescrita; `nas_absent_first_at` usa `coalesce`). Teste do kit: 500 no `attest` repete o corpo inteiro e não marca a execução como falha.
- [ ] **Passo 6. Arquivo de instalação do dono** (`comandos/m9-9-instalar-kit.sh`; o agente **não** roda): copia `comum.py`, `b2.py`, `copiador/copiar.py` e `conferir-b2/conferir.py` para `/opt/arquivo/...` com `install -m 0755`/`0644` (via `scp` do Mac para `/tmp/m9-kit/` e `sudo install` na forja, no mesmo padrão do arquivo de instalação da M3b-forja — copiar a forma dele, `grep -l "install -m" .superpowers/sdd/manutencao-nas/comandos/*.sh`), roda `python3 /opt/arquivo/copiador/copiar.py --prova` e `python3 /opt/arquivo/conferir-b2/conferir.py --prova` e imprime `OK-M9-KIT` no fim. Linha curta: `bash .superpowers/sdd/manutencao-nas/comandos/m9-9-instalar-kit.sh > .superpowers/sdd/manutencao-nas/saidas/m9-9-$(date +%Y%m%d-%H%M).txt 2>&1`. Ordem P47 (TRAVA M9-3): o kit novo entra **antes** de o dono ligar o interruptor, e **depois** da Tarefa 11 em produção (o `attest` com `prefixos` antes da rota nova dá 400 e o copiador inteiro falha). Com o interruptor desligado o site manda `[]` e o kit novo e o antigo se comportam igual. O ledger anota a linha; ela vai ao dono só no dia (regra "comando só na hora").

---

### Task 9b: snapshots por tempo (M9-snap, D-M9-9b; emenda 29/10 do dono)

Origem: "Emenda 29/10 (dono): snapshots por tempo (M9-snap)" no topo deste plano. Substitui o `snapshots_do`/`snapshots_de` do kit `bd7fe03`. Executor: Sonnet, effort `medium`. Revisão no fim: Phil e Yannis (Passo 9); o texto da tela, Logan e Naksu (sub-tarefa 9b-T).

**Files:**
- Kit (git local `~/Workspace/forja/ferramentas`, a partir de `bd7fe03`): Modify `arquivo/copiador/copiar.py` (`snapshots_de`, `snapshots_do`, `prefixos_nas`, `gravar_recebendo`, `mover`, função pura nova `medir_snapshots`); Modify `arquivo/teste_copiador.py` (seção 14) e, se o falso precisar de `mtime`, `arquivo/falsos.py`.
- Site: Create `supabase/migrations/<ts>_manutencao_m9_snap_por_tempo.sql` (`npm run db:new manutencao_m9_snap_por_tempo`, nunca à mão); Modify `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts` (`PrefixoNas`); Modify `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts` (2 chaves opcionais e `PendenciaDoDono`); Modify `apps/web/test/integration/manutencao-m9-ausencia.test.ts` (reescreve `snapshot_presente_segura_o_b2` e `snapshot ausente libera o b2`, acrescenta os da tabela); Modify o teste da rota `attest` que já cobre `prefixos` (`grep -rln "snapshot_mais_antigo" apps/web/test`).
- Sub-tarefa 9b-T (tela): Modify `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx` (`Item`), `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts` (`FRASE_DA_FALTA.snapshots` e a frase do `sem_comando`), o teste de cada um.
- Fora do repositório: `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` r2.6 → **r2.7** (o item `prefixos` da fonte `nas`); `comandos/m9-9-instalar-kit.sh` passa a instalar o commit do kit desta tarefa.

**Interfaces (o contrato r2.7, só a fonte `nas`, item de `prefixos`):**
- Kit → site, quando o plano marcou `provar_snapshots` e o prefixo está ausente do dataset: `snapshots: 'por_tempo' | 'indisponivel'`. Com `por_tempo` vêm, obrigatórias, `snap_mais_antigo_s` e `snap_mais_novo_s` (inteiros, segundos Unix, já convertidos da hora local do nome em America/Sao_Paulo) e `snap_n` (inteiro ≥ 1); com `indisponivel`, nenhuma das três, mas **obrigatório `snap_motivo`** (enum `lista_vazia | fora_do_padrao | mtime_diverge | ilegivel`; proibido com `por_tempo`). **`'ausente'` e `'presente'` deixam de existir no contrato** (o kit não enxerga dentro do snapshot; nenhum kit pode mais declarar ausência de snapshot). `snapshot_mais_antigo` (texto) sai. O relógio duvidoso (`relogio`) não é medido pelo kit: quem confere é o banco, com o relógio dele (Yannis M6).
- Zod: `const segundos = z.number().int().min(1_600_000_000).max(4_102_444_800)`; `PrefixoNas = z.object({ ...prefixoBase, snapshots: z.enum(['por_tempo', 'indisponivel']).optional(), snap_mais_antigo_s: segundos.optional(), snap_mais_novo_s: segundos.optional(), snap_n: z.number().int().min(1).max(10_000).optional(), snap_motivo: z.enum(['lista_vazia', 'fora_do_padrao', 'mtime_diverge', 'ilegivel']).optional() }).strict().refine(p => (p.snapshots === 'por_tempo') === (p.snap_mais_antigo_s !== undefined && p.snap_mais_novo_s !== undefined && p.snap_n !== undefined), 'por_tempo exige as três medidas, e só ele as tem').refine(p => (p.snapshots === 'indisponivel') === (p.snap_motivo !== undefined), 'indisponivel exige snap_motivo, e só ele o tem')`.
- Banco: `obs_archive_attest_prefixos` (mesma assinatura) decide `snap_absent_at` pela regra D-M9-9b; `snap_oldest` (`date`) passa a ser a data local do mais antigo listado (informativo). **Uma coluna nova (decisão única, igual à da emenda; Phil I1/M1):** `alter table public.obs_archive_absence add column if not exists snap_motivo text check (snap_motivo in ('lista_vazia','fora_do_padrao','mtime_diverge','relogio','ilegivel','anterior','retido'))`. `indisponivel` grava o motivo recebido (fora da lista ⇒ `'ilegivel'`, nunca exceção); `por_tempo` não liberado grava `'relogio'` se o mais novo passa de `now()` + 15 min, senão `'anterior'` enquanto `now() < nas_absent_first_at + interval '15 days'` e `'retido'` depois (o mais antigo continua anterior um dia além da retenção: hold, snapshot manual com nome `auto-`, retenção maior); liberado, ou `snap_absent_at` já gravado, grava `null`. `obs_archive_owner_pending` ganha, por item (e nos ramos de canal e de versão superada, com o mesmo `filter`): `snap_espera_desde` (`min(nas_absent_first_at) filter (where snap_absent_at is null)`, `timestamptz` ou nulo; Yannis M4: mesma referência de tempo da data de liberação), `snap_libera_em` (`max(nas_absent_first_at) filter (where snap_absent_at is null) + interval '14 days 8 hours'`, "por volta de"; as 8 h cobrem o snapshot de 6 h e a próxima execução do copiador, Phil M3) e `snap_bloqueio` (o motivo mais grave entre as linhas pendentes do item, na ordem `ilegivel, lista_vazia, fora_do_padrao, mtime_diverge, relogio, retido`; `null` quando todas estão em `'anterior'` ou sem motivo; lido só de linha com `snap_checked_at >= nas_absent_at`, para não herdar motivo de antes de um `reabrir`). Leitor (`pendencias.ts`): as **três** chaves `.nullable().optional()` (o código vai ao ar **antes** da migration; o leitor é `.strict()`, então a ordem contrária faria o `obs:arquivo` sair com código 1).
- Kit, guarda nova: `Copiador.sob_prefixo_ausente(filho, rel) -> bool` (Phil I2 e Yannis I1), montada uma vez por execução a partir de `plano["prefixos_ausentes"]` (que traz **toda** linha aberta do plano, inclusive as ainda presentes: recusar escrita nelas também é o desejado; o nome engana, Phil M5). Comparação com o `rel` **final**, sem `_recebendo/`: verdadeiro se `rel` é um prefixo exato (`e_prefixo: false`) ou tem como ancestral um prefixo `e_prefixo: true`; guardar os prefixos num `set` e testar o próprio `rel` e cada ancestral dele (≤ 8 níveis), nunca varrer a lista por escrita (Yannis, complexidade). Chamada em **três pontos, antes de qualquer escrita** (`gravar_recebendo` devolve tupla e uma exceção nova subiria sem `except`; `Diferente` faria `exportar` pedir a unidade de novo e contaria `unidade_falhou`, por isso a guarda fica onde o `rel` nasce): (1) em `exportar`, logo depois de calcular `rel` e antes do `c.existe` do final: verdadeira ⇒ `descartar()`, `self.n["sob_prefixo_ausente"] += 1`, `self.invalido = True`, `return` (nada pedido de novo); (2) em `gravar_conjunto`, para cada arquivo antes do primeiro `gravar_recebendo`: verdadeira ⇒ apaga os `prontos`, mesmo contador, `self.invalido = True`, `return None`; (3) em `aguardando` (que move com `os.link` próprio, **sem** chamar `mover`), antes do `os.link`: verdadeira ⇒ não move (o arquivo fica em `_recebendo`, onde a linha `_recebendo/<prefixo>` o vê e reabre), mesmo contador, `self.invalido = True`. `mover` e `gravar_recebendo` não mudam. Desfecho: **`plano_invalido`** (vermelho no pulso, `desfecho_de` copiar.py:~563) e **não** `ok`: o contador fica em `n`, não em `pulos` (`desfecho_de` só olha `pulos` que começam com `received_`/`attest_`). Escolha registrada: `plano_invalido` (Phil) e não `incompleto` (Yannis): o site mandou gravar sob o prefixo que ele mesmo mandou apagar, é contradição do plano, e `invalido` já é o sinal dessa classe; os dois são vermelhos.

**O que acontece quando o dado não existe:**
- `.zfs/snapshot` sem nenhum nome (dataset sem tarefa de snapshot, montagem errada): `indisponivel` com `snap_motivo: lista_vazia` (e contador `snap_lista_vazia`), **nunca** `por_tempo` (uma lista vazia não prova que não há snapshot; pode ser só a NFS sem mostrar).
- **Espera que não termina sozinha (Phil I1, Yannis I2):** snapshot manual (`fora_do_padrao`), hold, retenção maior, `mtime` divergente ou relógio duvidoso seguram a linha para sempre e o copiador sai `ok`. Por isso o banco guarda o **motivo** (`snap_motivo`, inclusive `retido` depois de ~15 dias) e a peça 7 troca a frase "sem ação sua" por uma frase âmbar com a ação do dono (Passo 5); nunca mostra "libera DD/MM" com a data no passado.
- Recusa do copiador (escrita sob prefixo ausente): `plano_invalido`, nunca `ok` (guarda nos três pontos, Interfaces).
- `snap_motivo` fora do enum chegando por SQL direto: tratado como `ilegivel`, nunca exceção.
- Pasta ilegível (EIO, ESTALE, EACCES): `indisponivel`, `snap_motivo: ilegivel` (contador `snap_ilegivel`); o prefixo em si continua atestado (a parte do dataset não depende dos snapshots).
- Plano sem `provar_snapshots` (linha ainda sem `nas_absent_at`): o item vai sem nenhuma chave de snapshot, como hoje.
- Kit manda `por_tempo` para uma linha sem `nas_absent_at` (corrida entre plano e attest): o banco ignora a parte dos snapshots (já é assim; `nas_absent_at` é pré-requisito, check `snap_absent_at is null or nas_absent_at is not null`).
- `snap_mais_antigo_s` fora da forma chegando ao banco por fora da rota (chamada SQL direta): o banco testa `~ '^[0-9]{10}$'` antes do `::bigint`; fora da forma ⇒ tratado como `indisponivel`, **nunca** exceção (uma exceção derruba o `attest` inteiro de todos os prefixos: 500 e `site_fora`, o defeito I1 do Yannis).
- `nas_absent_first_at` nulo com `nas_absent_at` não nulo: impossível pelo check `nas_absent_at is null or nas_absent_first_at is not null`; mesmo assim a comparação com nulo dá nulo e `v_snap_ok` vira falso (pendente).
- Item sem nenhuma linha esperando snapshot: `snap_espera_desde`, `snap_libera_em` e `snap_bloqueio` nulos; a tela não mostra a frase.
- Banco ainda sem a migration (código no ar primeiro): o leitor aceita a ausência das três chaves; a tela não mostra a frase; o kit novo ainda não está instalado (Passo 7), então nada manda `por_tempo`. Se mandasse, o SQL antigo ignoraria (`v_snap` fora da lista antiga): pendente, seguro.

- [ ] **Passo 1. Kit: testes primeiro (vermelho).** Em `teste_copiador.py` seção 14, trocar os casos de sentinela/`presente` pelos da tabela; durante o ciclo vermelho/verde rodar **só** `python3 arquivo/teste_copiador.py` (`teste_tudo.sh` fica para uma execução final em background, Passo 2); rodar contra `bd7fe03` e guardar a saída em `.superpowers/sdd/manutencao-nas/saidas/m9-9b-kit-vermelho.txt` (no contexto, só as falhas).

| Teste (kit) | Montagem | Esperado |
|---|---|---|
| `snap_forja_56` | 56 nomes `auto-2026-10-16_00-20` … `auto-2026-10-29_18-20`, `mtime` = hora do nome | `por_tempo`, `snap_mais_antigo_s` = 1792120800 (2026-10-16T00:20-03:00), `snap_mais_novo_s` = 1793308800, `snap_n` = 56 |
| `snap_lista_vazia` | `.zfs/snapshot` existe, vazio | `indisponivel`, contador `snap_lista_vazia` |
| `snap_fora_do_padrao` | 55 no padrão + `manual-2026-10-20_10-00` | `indisponivel`, `snap_fora_do_padrao` |
| `snap_data_impossivel` | `auto-2026-02-30_00-20` | `indisponivel` (`fora_do_padrao`), sem exceção |
| `snap_mtime_diverge` | um com `mtime` 2 h fora do nome | `indisponivel`, `snap_mtime_diverge` |
| `snap_motivo_no_attest` | cada caso `indisponivel` acima | `snap_motivo` igual ao contador do caso (`lista_vazia`, `fora_do_padrao`, `mtime_diverge`, `ilegivel`); `por_tempo` sem `snap_motivo` |
| `snap_ilegivel` | `listdir` levanta EIO | `indisponivel`, `snap_ilegivel`; o prefixo ainda vai com `estado: 'ausente'` |
| `snap_nunca_declara` | todos os attests de todos os casos acima | nenhum `snapshots` com `'ausente'`/`'presente'` (mutante: devolver `'ausente'` na lista vazia é morto) |
| `snap_sem_provar` | `provar_snapshots: false` | nenhuma chave `snap_*`/`snapshots` |
| `snap_lista_uma_vez` | 3 prefixos do mesmo filho | `listdir` chamado 1 vez por filho e execução |
| `snap_fuso` | `auto-2026-10-29_18-20` | 1793308800 = `datetime(2026,10,29,18,20,tzinfo=ZoneInfo("America/Sao_Paulo")).timestamp()` (o teste calcula e compara com o número) |
| `nao_recria_prefixo` | plano com `exportar` de `obs/canais/<u>/serie/x.csv.gz` e `prefixos_ausentes` com `obs/canais/<u>/` (`e_prefixo: true`) | nada escrito no NAS nem em `_recebendo`, `n["sob_prefixo_ausente"] == 1`, `desfecho == "plano_invalido"`, **1** pedido de export (não 2) |
| `nao_recria_arquivo_exato` | `aguardando_dono` move `x.v1.csv.gz` e há linha `e_prefixo: false` com esse caminho | não move (fica em `_recebendo`); mesmo contador; `desfecho == "plano_invalido"` |
| `recusa_antes_da_ausencia` | linha aberta, prefixo ainda presente, export sob ele | recusado (a lista traz toda linha aberta) |
| `guarda_nao_quebra_lote` | outra unidade do mesmo plano, fora do prefixo | gravada normalmente na mesma execução |
| `vizinho_nao_conta` | prefixo `obs/canais/<u>/`, gravação em `obs/canais/<u>x/...` | grava normal (fronteira de `/`) |

No site, um teste de integração: `obs_archive_prefixos_ausentes(...,'nas')` com linha aberta de `canal:<u>` e o plano de exportação do mesmo site não contém caminho sob o prefixo (Yannis I1). Mutante que tem de morrer: contar em `pulos` (sairia `ok`).

Os números foram conferidos em 29/10 com `zoneinfo` (16/10/2026 00:20 BRT = 03:20 UTC = 1792120800); o teste também calcula, para não depender do plano.

- [ ] **Passo 2. Kit: código (verde).** Em `copiar.py`:

```python
import zoneinfo
from datetime import datetime

RE_SNAP = re.compile(r"^auto-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})$")   # D-M9-9b: o padrão da tarefa 11 do NAS
FUSO_NAS = zoneinfo.ZoneInfo("America/Sao_Paulo")                       # o NAS nomeia na hora local (stat confere, 29/10)
FOLGA_MTIME_S = 600                                                      # o relógio do NAS no futuro é conferido pelo banco, não aqui (Yannis M6)

def medir_snapshots(pasta, nomes, lstat=os.lstat):
    """M9-snap (D-M9-9b): só a LISTA e a hora de cada snapshot; nunca lê dentro (a NFS mostra vazio, 29/10).
    Devolve (campos do attest, motivo|None). Quem decide 'ausente' é o banco, que tem a hora da ausência."""
    def ind(m):
        return {"snapshots": "indisponivel", "snap_motivo": m}, m
    if not nomes:
        return ind("lista_vazia")
    horas = []
    for n in nomes:
        m = RE_SNAP.match(n)
        if not m:
            return ind("fora_do_padrao")
        try:
            h = int(datetime(*map(int, m.groups()), tzinfo=FUSO_NAS).timestamp())
        except ValueError:
            return ind("fora_do_padrao")
        try:
            mt = lstat(os.path.join(pasta, n)).st_mtime
        except OSError:
            return ind("ilegivel")
        if abs(mt - h) > FOLGA_MTIME_S:
            return ind("mtime_diverge")
        horas.append(h)
    return {"snapshots": "por_tempo", "snap_mais_antigo_s": min(horas), "snap_mais_novo_s": max(horas), "snap_n": len(horas)}, None
```

`snapshots_de(filho)`: lista uma vez por filho e execução (`os.listdir`; `OSError` ⇒ `ind("ilegivel")`), chama `medir_snapshots`, soma `self.n["snap_" + motivo]` quando há motivo e guarda o dicionário em `self._snaps[filho]`. `snapshots_do` some; em `prefixos_nas`, `item.update(self.snapshots_de(f))` (uma cópia do dicionário). A guarda `sob_prefixo_ausente` entra **nos três pontos das Interfaces** (`exportar`, `gravar_conjunto`, `aguardando`), não em `gravar_recebendo` nem em `mover`, e `desfecho_de` não muda (`invalido` já devolve `plano_invalido`). Só no fim, uma vez, `bash arquivo/teste_tudo.sh > .superpowers/sdd/manutencao-nas/saidas/m9-9b-kit-verde.txt 2>&1` em **background** (o `teste_conferir_b2.py` tem esperas longas; nunca esperar parado mais de 4 min) e conferir só as falhas.

- [ ] **Passo 3. Site: testes do banco primeiro (vermelho)**, em `manutencao-m9-ausencia.test.ts` (banco `bythiago_int`, `HAS_LOCAL_DB=1`), com a migration nova ainda vazia. Ajudante: `porTempo(antigo, novo, n = 56)` monta o item com segundos calculados a partir de horas relativas ao `now()` do banco (`select extract(epoch from now() - interval ...)`), nunca datas fixas (regra das fixtures temporais).

| Teste (banco) | Linha | Item | Esperado |
|---|---|---|---|
| `snap_tempo_posterior_libera` (a) | `first = now()-15d`, `nas_absent_at = now()-14d` | `por_tempo`, antigo = first + 2 h, novo = now() − 1 h | `snap_absent_at` não nulo; a linha entra em `prefixos_ausentes(...,'b2')`; `snap_oldest` = data local do antigo |
| `snap_tempo_anterior_segura` (a) | idem | tabela de 3 linhas: antigo = first − 1 h; antigo = first + 30 min (margem de 1 h); antigo = first | `snap_absent_at` nulo; `snap_checked_at` não nulo; `snap_motivo = 'anterior'`; fora da lista do B2 |
| `snap_piso_14_dias` (c) | `first = now()-13d` | antigo = first + 1 d | nulo (o mais antigo posterior não basta) |
| `snap_hold_segura` (b) | `first = now()-15d` | antigo = now() − 30 d (o retido), novo = now() − 1 h | nulo; amplitude > 14 d 6 h (Yannis M3) |
| `snap_amplitude_maior_que_retencao` | `first = now()-15d` | antigo = first + 2 h, novo = antigo + 15 d | nulo (a lista cobre mais que a retenção ⇒ hold) |
| `snap_retido_vira_bloqueio` | `first = now()-16d` | antigo = first − 1 h | nulo; `snap_motivo = 'retido'`; `obs_archive_owner_pending` traz `snap_bloqueio = 'retido'` |
| `snap_futuro_segura` | `first = now()-15d` | antigo = first + 2 h, novo = now() + 1 h | nulo; `snap_motivo = 'relogio'` |
| `snap_indisponivel_so_marca` (b) | idem | `indisponivel` + `snap_motivo: fora_do_padrao` | só `snap_checked_at` e `snap_motivo = 'fora_do_padrao'`; `snap_absent_at` e `snap_oldest` intactos |
| `snap_motivo_estranho_nao_500` | idem | `indisponivel` + `snap_motivo: 'xyz'` por SQL direto | sem exceção; `snap_motivo = 'ilegivel'` |
| `snap_sem_nas_absent_ignora` | `nas_absent_at` nulo | `por_tempo` válido | nada de snapshot muda (caso que já existe, mantido) |
| `snap_gravado_nao_regride` (M2 Phil e Yannis) | `snap_absent_at` já gravado (e, numa 2ª passada, `b2_absent_at` também) | `por_tempo` com antigo = first − 1 h, por SQL direto | nada muda, **sem exceção**, `snap_motivo` segue nulo; `obs_archive_prefixos_ausentes(...,'nas')` traz `provar_snapshots = false` (o ramo de regressão saiu: a produção nunca o percorre) |
| `snap_forma_ruim_nao_500` | idem ao primeiro | `snap_mais_antigo_s: 'abc'` e `1.5` por SQL direto | sem exceção; pendente |
| `snap_ausente_legado_ignorado` | idem | `snapshots: 'ausente'` por SQL direto | `snap_absent_at` nulo (o banco não aceita mais a declaração) |
| `pendencias_espera_snapshots` (d) | item com 1 linha esperando snapshot | `obs_archive_owner_pending` | `snap_espera_desde` = `nas_absent_first_at`; `snap_libera_em` = first + 14 d 8 h; `snap_bloqueio` nulo com `anterior`; item sem espera: as três nulas |
| `sonda_custo_ausencia` (existente) | — | — | continua sem Seq Scan |

E na rota/contrato (unitário), **um teste em tabela** (`it.each`): `por_tempo` sem as três medidas → 400; `indisponivel` com medida → 400; `indisponivel` sem `snap_motivo` → 400; `por_tempo` com `snap_motivo` → 400; `snapshots: 'ausente'` → 400; `snap_mais_antigo_s: 1.5` → 400; `snapshot_mais_antigo` (texto antigo) → 400. Leitor: `pendencias.ts` aceita o item com e sem `snap_espera_desde`/`snap_libera_em`/`snap_bloqueio`. Reaproveitar os ajudantes de `manutencao-m9-ausencia.test.ts`; o único novo é `porTempo`. Saídas em `saidas/m9-9b-site-vermelho.txt`.

- [ ] **Passo 4. Site: a migration e o TypeScript (verde).** `npm run db:new manutencao_m9_snap_por_tempo`. Conteúdo: cabeçalho citando D-M9-9b; `create or replace function public.obs_archive_attest_prefixos` copiada da migration `20261029000002` (l.~800-868) com só o bloco dos snapshots trocado; `create or replace function public.obs_archive_owner_pending` copiada da mesma migration com as três chaves novas nos ramos de item, canal e versão superada (mesmo `filter` em cada um); **prova de que o resto não mudou: `diff` mecânico contra a `20261029000002` mostrando só as linhas das chaves novas** (o executor não relê a função inteira a cada rodada); `alter table public.obs_archive_absence add column if not exists snap_motivo text check (...)` (Interfaces); os `revoke`/`grant` idênticos aos da `20261029000002`. O bloco dos snapshots:

```sql
        -- M9-snap (D-M9-9b): o kit mede a LISTA; o banco compara com a hora de ausência, que só ele tem.
        if a.nas_absent_at is not null and v_snap in ('por_tempo', 'indisponivel') then
          v_old := case when v_snap = 'por_tempo' and it->>'snap_mais_antigo_s' ~ '^[0-9]{10}$' then to_timestamp((it->>'snap_mais_antigo_s')::bigint) end;
          v_new := case when v_snap = 'por_tempo' and it->>'snap_mais_novo_s'   ~ '^[0-9]{10}$' then to_timestamp((it->>'snap_mais_novo_s')::bigint) end;
          v_snap_ok := coalesce(v_old <= v_new
                       and v_new <= now() + interval '15 minutes'                    -- relógio do NAS em salto
                       and v_new - v_old <= interval '14 days 6 hours'               -- lista maior que a retenção ⇒ hold (Yannis M3)
                       and v_old >  a.nas_absent_first_at + interval '1 hour'        -- o mais antigo é posterior à ausência
                       and now() - a.nas_absent_first_at >= interval '14 days', false); -- piso (critério c; cobre NAS adiantado)
          v_motivo := case
            when v_snap_ok then null
            when v_snap = 'indisponivel' then case when it->>'snap_motivo' in ('lista_vazia','fora_do_padrao','mtime_diverge','ilegivel') then it->>'snap_motivo' else 'ilegivel' end
            when v_old is null or v_new is null or v_old > v_new then 'ilegivel'
            when v_new > now() + interval '15 minutes' then 'relogio'
            when now() >= a.nas_absent_first_at + interval '15 days' then 'retido'
            else 'anterior' end;
          update public.obs_archive_absence set
                 snap_checked_at = now(),
                 snap_oldest = coalesce((v_old at time zone 'America/Sao_Paulo')::date, snap_oldest),
                 snap_absent_at = case when v_snap_ok then coalesce(snap_absent_at, now()) else snap_absent_at end,
                 snap_motivo = case when v_snap_ok or snap_absent_at is not null then null else v_motivo end
           where id = a.id;
        end if;
```

(declarar `v_old timestamptz; v_new timestamptz; v_snap_ok boolean; v_motivo text;` no `declare`). Em `contrato.ts`, o `PrefixoNas` das Interfaces. Em `pendencias.ts`, as três chaves e os campos `snapEsperaDesde`/`snapLiberaEm: Date | null` e `snapBloqueio: string | null`. Aplicar no `bythiago_int` (54421/54422), rodar os testes do Passo 3, mais `m9-trava`, `m9-guarda` (a migration nova casa `*_manutencao_m9_*`; a trava já está no estado "com migration" e a guarda olha as funções da E9, que esta migration não toca: conferir que os dois seguem verdes) e as vizinhas `manutencao-m9-*`. `npx tsc --noEmit -p apps/web` com saída em arquivo.

- [ ] **Passo 5. Sub-tarefa 9b-T: a frase na peça 7 (critério d; não é tela nova).** A peça 7 já tem, por item, a linha de situação (`p7-st`, `SITUACAO[i.tempo]`) e a régua de idade; falta dizer **por que** um `sem_comando` com `falta: 'snapshots'` espera, e dizer a verdade quando a espera não termina sozinha. Só quando `i.falta === 'snapshots'` e `snapEsperaDesde` não é nulo, no mesmo `p7-st`: **(a) `snapBloqueio` nulo:** "Aguardando os snapshots do NAS há N dias; libera por volta de DD/MM, sem ação sua." (N de `snapEsperaDesde`, DD/MM de `snapLiberaEm`; "hoje" quando N = 0). **(b) `snapBloqueio` preenchido, em âmbar (cor já existente):** "Os snapshots do NAS não liberam sozinhos (<motivo em palavras>). Veja o runbook, Tarefa 14, Passo 2." Motivos em palavras: `fora_do_padrao` "há snapshot manual ou de outra tarefa"; `retido` "há snapshot de antes da remoção que não expira (hold ou retenção maior que 14 dias)"; `lista_vazia` "a forja não vê nenhum snapshot"; `mtime_diverge` e `relogio` "a hora dos snapshots não confere"; `ilegivel` "a forja não conseguiu ler a lista". Nunca "libera DD/MM" com a data passada. No script do Mac, `FRASE_DA_FALTA.snapshots` passa a "os snapshots do NAS de antes da remoção ainda não expiraram (14 dias); a limpeza segue sozinha" (ramo a) ou à frase âmbar do ramo b, e o sufixo vira "; libera por volta de DD/MM" só no ramo a (sai o "mais antigo: …"). Não muda layout nem componente: **Logan e Naksu revisam só o texto e o estado** (uma rodada, sem mockup novo, regra "visual antes do código" atendida pelo mockup aprovado da peça 7; a frase âmbar também precisa do "sim" deles); se algum dos dois pedir elemento visual novo, isso vira tarefa à parte com mockup e volta ao dono. Testes: `esperam-comandos` renderiza a frase (a) com N = 0, 1 e 9, a frase âmbar (b) com `snapBloqueio` preenchido (e **não** a de "sem ação sua"), e nenhuma sem `snapEsperaDesde`; o script tem as frases novas.

- [ ] **Passo 6. Commits** (quando mandado). Kit: `git -C ~/Workspace/forja/ferramentas commit -m "fix: M9-snap: snapshots por tempo (lista e hora, o site decide) e o copiador não recria prefixo ausente" -- arquivo/copiador/copiar.py arquivo/teste_copiador.py [arquivo/falsos.py]`. Site, um commit (código e migration juntos; a migration só vai ao banco no Passo 7): `git commit -m "feat: M9-snap: snapshots por tempo (contrato r2.7, attest decide pela hora da ausência, espera no painel)" -- <migration> apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx" <testes tocados>`. Contrato r2.7 no `contrato-rotas-m3b.md`; `m9-9-instalar-kit.sh` aponta o commit novo do kit.

- [ ] **Passo 7. Ordem P47 no ar (cada passo no ledger com data e quem).** (1) push e promoção do commit do site; Vercel no ar com o leitor aceitando as chaves novas; (2) `npm run db:push:prod` da migration nova (portão: Passo 9 com acordo); leitura `select count(*) from pg_proc where proname = 'obs_archive_attest_prefixos' and prosrc like '%D-M9-9b%'` → 1; o `obs:arquivo` lê a `versao 2` sem erro; (3) **o dono instala o kit uma vez só** (`m9-9-instalar-kit.sh`, fora das janelas 03:17, 11:07 e 15:17 BRT); a sonda do instalador passa; (4) com o interruptor ainda desligado, a próxima execução do copiador sai `ok` (o site manda `[]`).

- [ ] **Passo 8. Antes de ligar (critério e, leitura de produção pelo controlador):** `select e_prefixo, count(*) from public.obs_archive_absence group by 1;` registrada no ledger. Com 0 linhas, anotar "0 linhas"; o primeiro `b2_absent_at` só existe ≥ 14 dias depois de ligar, então a conferência no B2 é **D+15 a D+17 depois de ligar** (data no ACOMPANHAMENTO): `select alvo, prefixo from public.obs_archive_absence where not e_prefixo and b2_absent_at is not null limit 1;` e esse nome conferido no painel do B2 com "mostrar versões" (zero versões; Phil M3). Depois do 1º copiador com o interruptor ligado, a invariante, válida em qualquer dia: `select count(*) from public.obs_archive_absence where snap_absent_at is not null and snap_absent_at < nas_absent_first_at + interval '14 days';` → **0** (critério c em produção). E, em operação normal: `select snap_motivo, count(*) from public.obs_archive_absence where snap_absent_at is null and nas_absent_at is not null group by 1;` só com `anterior`.

- [ ] **Passo 9. Revisão (critério f):** Phil e Yannis leem o diff do kit e do site e as saídas dos Passos 1 a 4; consertos até os dois em acordo (nota e "aprovado" de cada um no ledger). Só então a migration vai ao banco (Passo 7.2).

**NÃO VERIFICADO (desta tarefa):** (1) `mtime` do diretório do snapshot pela NFS = hora de criação do snapshot: medido em 2 snapshots em 29/10 (bate ao segundo), não em todos; o teste `snap_mtime_diverge` cobre o desvio, a leitura do Passo 7 confirma no dado real. (2) Tarefa de **replicação** ZFS do NAS para outro pool (snapshots com retenção maior fora de `.zfs/snapshot` do filho) e tarefa de snapshot recursiva no pai: nem a D-M9-9 nem a D-M9-9b as medem; agora é **TRAVA M9-3 (7)** (leitura do dono de `replication.query` e `pool.snapshottask.query`, no ledger). (3) **Ligar `crossmnt` no NFS do TrueNAS (opção A) invalida a checagem de `mtime` da 9b**: o `stat` da entrada passaria a mostrar o `mtime` da raiz do snapshot e tudo viraria `mtime_diverge` (a frase âmbar o mostraria); trocar de método no mesmo dia (Phil M4). (4) Mudou a retenção do NAS (14 dias) ⇒ revisar D-M9-9b, o `14 days 6 hours` do SQL e o piso (Yannis M3).

**Estimativa (executor Sonnet, effort medium), emenda r2: teto 180K** (era ~250K; cortes de Phil e Yannis: ramo de regressão e 2 testes, check de relógio no kit, `teste_tudo.sh` só no fim em background, `diff` mecânico na cópia do `owner_pending`, testes de contrato em tabela, margem de 1 h como linha parametrizada): kit ~55K, banco e migration ~65K, contrato, leitor e 9b-T ~35K, conserto de uma rodada ~15K, fora as revisões (Phil e Yannis ~60K cada; Logan e Naksu só o texto, ~25K cada).

### Task 10: o dia da migration (TRAVA M9-1 cai; o dono aplica)

**Files:**
- Create: `supabase/migrations/<timestamp>_manutencao_m9_expurgo.sql` (pelo `npm run db:new manutencao_m9_expurgo`; conteúdo = `supabase/rascunhos/m9.sql` com os marcadores md5 trocados)
- Modify: `apps/web/test/helpers/m9.ts` (passa a ler a migration, não o rascunho; o rascunho é apagado no mesmo commit)
- Modify: `apps/web/test/manutencao/m9-trava.test.ts` (rascunho XOR migration: exatamente um existe)
- Modify: `.superpowers/sdd/manutencao-nas/m9-progresso.md`

**Interfaces:**
- Consumes: `supabase/rascunhos/m9.sql` (Tarefas 1 a 5, partes 1 a 6), a E9 em produção (`competitor_video_purge`, `competitor_comments_purge`), a M3b em produção (`obs_archive_plan`, `obs_archive_b2_plan`, `obs_archive_removed_channel_list`, `obs_archive_record_core`, `obs_archive_record`, `obs_archive_owner_pending`).
- Produces: a migration aplicada em produção pelo dono; `m9-trava.test.ts` passa a ver a migration.

**O que acontece quando o dado não existe:** a E9 ou a M3b ainda não está em produção (a migration da M3b é posterior): o `m9.sql` levanta `m9_sem_e9` ou `m9_m3b_ausente` na primeira instrução (TRAVA M9-1), e a migration não se aplica pela metade. `md5` de produção diferente do marcador: `m9_e9_mudou` (a função da E9 mudou desde a Tarefa 0; refazer a Tarefa 0). Marcador `<<MD5_...>>` que sobrou no arquivo: o teste da Tarefa 10 falha antes do commit.

- [ ] **Passo 1. Conferir as âncoras contra produção** (leitura): `npx supabase db query --linked "select p.proname, md5(p.prosrc) from pg_proc p where p.proname in ('competitor_video_purge','competitor_comments_purge','competitor_channel_purge') order by 1" > /tmp/m9-md5-prod.txt`; comparar com os valores **lidos na Tarefa 0** (23/10: `8c6d51b2…` vídeo, `2233c4ed…` comentários e `02d2a5b5…` canal; D-M9-25 entra na própria M9, então os três continuam sendo os "antes") e com o md5 do `prosrc` que o `semearE9` instalou a partir das migrations (emenda 23/10, N-M9-1), nunca com constante copiada; junto, conferir `select count(*) from public.competitor_removed_items where kind in ('video','comentario')` (diferente de 0 com a M9 desligada = N9-3 já aconteceu) e, depois do push e antes do interruptor, `select public.obs_archive_m9_captura_presente()` = true; (texto anterior: valores das constantes `V_MD5_VIDEO` e `V_MD5_COMENTARIOS` da Tarefa 2) (só as três funções da E9 levam injeção por texto e md5; as da M3b são renomeadas ou recriadas, sem md5). Diferente: **para** (a E9 ou a M3b mudou em prod depois da Tarefa 0); refazer a Tarefa 0 e as constantes. Leitura de produção negada no modo automático: o arquivo `comandos/m9-10-md5.sh` com essa linha vai ao dono, saída em `saidas/`.
- [ ] **Passo 2.** Trocar `<<MD5_VIDEO>>`, `<<MD5_COMENTARIOS>>` e `<<MD5_CANAL>>` pelo md5 de produção das **três** funções da E9; um teste (`m9-trava.test.ts`) falha se sobrar `<<` em `m9.sql` ou na migration (os três marcadores).
- [ ] **Passo 3.** `npm run db:new manutencao_m9_expurgo`; copiar o conteúdo de `m9.sql`; trocar `aplicarM9` para ler `supabase/migrations/*_manutencao_m9_expurgo.sql`; `git rm supabase/rascunhos/m9.sql`. O teste `rascunho XOR migration` falha se existirem os dois ou nenhum; `it.skipIf(migrou)` nos testes que só valem enquanto é rascunho.
- [ ] **Passo 4.** Rodar contra o `bythiago_int` do zero (`reference_banco_local_integracao`: 54421/54422) e `HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m9 test/manutencao > /tmp/m9-int.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-int.txt` → sem falha.
- [ ] **Passo 5.** `npx supabase migration list --linked > /tmp/m9-list.txt`; a última de prod é anterior ao timestamp novo (sem "out of order"). Commit (quando mandado): `git commit -m "feat: M9: migration do expurgo enxuto" -- supabase/migrations/<arquivo> apps/web/test/helpers/m9.ts apps/web/test/manutencao/m9-trava.test.ts supabase/rascunhos/m9.sql`.
- [ ] **Passo 6. O dono aplica:** `comandos/m9-10-push.sh` com `npm run db:push:prod` (pede `YES`; interativo, a exceção do 05 §16). Depois, leitura: `select count(*) from pg_proc where proname like 'obs_archive_expurgo%'` → 4 (open, record, block, unblock). O interruptor `obs_archive_m9_ligar` continua DESLIGADO (TRAVA M9-3). Ledger: "TRAVA M9-2 solta em <data>".
- [ ] **Passo 7. Runbook do alvo bloqueado** (entra no runbook da Tarefa 14, sem retenção de snapshots): para um alvo `bloqueado` por `antiga_ausente` ou `antiga_divergente`, o dono restaura a unidade antiga (do B2 ou do snapshot), confere e roda no painel `select public.obs_archive_expurgo_unblock('<site>', <alvo_id>)`; o alvo volta a `copiar`. Não há retenção de snapshots a registrar: a prova de snapshots é direta (Tarefa 9).

---

### Task 11: as rotas (C14 nova, C3/C4/C5/C13 ajustadas), o registro e o contrato r2.6

**Files:**
- Create: `apps/web/src/app/api/pipeline/archive/expurgo/route.ts`
- Modify: `apps/web/src/app/api/pipeline/archive/attest/route.ts`, `.../archive/plan/route.ts`, `.../archive/pending/route.ts`, `.../archive/record/route.ts` (os da M3b; `ls apps/web/src/app/api/pipeline/archive`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (entrada `POST /api/pipeline/archive/expurgo`, `endpoint_count` do domínio `archive` +1), `apps/web/src/lib/pipeline/leitura-rotas.ts` (C14 é escrita: **não** entra na lista de leitura; conferir que o teste do registro diz isso), `apps/web/data/pipeline-docs/cowork-docs-archive.md`
- ~~Modify `saiu/responder.ts` e `.../saiu/modelo.ts`~~ (emenda 23/10, N9-1): **a E9 já mapeia** (`responder.ts:30-31,49`, `modelo.ts:22,167`, teste `saiu-responder.test.ts:122`); aqui só um teste que afirma o existente e, se a frase da M9 diferir da da E9, a troca da frase em `modelo.ts:167`
- ~~Modify o critério `apagando_ha_mais_de_1d`~~ (emenda 23/10, N9-1): **já feito pela E9** (`competitor_missing_proof` usa só `blobs_pending`, migration l.766-767); `aviso-a5-m9.md` item 2 marcado atendido.
- (Emenda 23/10, D-M9-26, **DECIDIDO pelo dono 23/10: opção (a)**; rodada 0.8, Yannis N7-3) A recusa **já mora no SQL**, injetada na Tarefa 2 (efeito `recusa`, helper `obs_archive_m9_pronto`, critério lido do banco: unidades em `obs_archive_units` e `obs_archive_m9_ligado = false`); **esta tarefa não reescreve função da E9 nem tem item de remoção** (a trava sai sozinha quando `obs_archive_m9_ligar(site, true)` roda). Aqui só: as ações `apagarVideo`/`apagarComentarios` traduzem o `P0001 m9_desligada` para a frase "o apagar do arquivo ainda não está ligado; espere" (teste de forma da ação); o `m9-guarda` lista os chamadores das funções `purge` e afirma que as duas trazem `obs_archive_m9_pronto`. Critério de aceite da M3b: sem a guarda, `OBS_ARQUIVO` não liga.
- Modify: `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.6)
- Create: `apps/web/test/app/api/pipeline/archive/expurgo-route.test.ts`

**Interfaces:**
- Consumes: `CorpoExpurgo` (Zod, Tarefa 6: união discriminada por `passo`: `abrir`, `registrar`, `bloquear`, `canal`); a autenticação de chave com papel `archive_owner` da M3b (`grep -rn "archive_owner" apps/web/src/lib/pipeline`), que dá o `siteId` da chave; as funções SQL `obs_archive_expurgo_open(p_site, p_item_id bigint)`, `obs_archive_expurgo_record(p_site, p_item_id bigint, p_grupo jsonb)`, `obs_archive_expurgo_block(p_site, p_alvo bigint, p_motivo text)` (Tarefa 3) e `obs_archive_attest_prefixos(p_site, p_fonte, p_execucao uuid, p_filhos jsonb, p_prefixos jsonb)` (Tarefa 4), chamadas por `getSupabaseServiceClient().rpc(...)` **depois** da verificação da chave (a rota é de pipeline, não de sessão). O passo `canal` só lê (`obs_archive_channel_removals` e `competitor_channels` pelo `siteId`). `unblock` e `obs_archive_m9_ligar` NÃO têm rota: só o painel.
- Produces: `POST /api/pipeline/archive/expurgo`; respostas 200 com o JSON da função; **409 `{ erro: <código>, alvo_id? }`** quando a função devolve `{ status: 'recusado', motivo }` (`resumo_versao_mudou`, `base_mudou`, `contagem_divergente`, `grupo_incompleto`, `resumo_com_unidade_nao_lida`, `alvo_de_outro_item`, `alvo_fora_de_copiar`, `mes_destacado_em_transito`, `expurgo_em_curso`, `sem_destino`, `canal_removido`; o `contagem_divergente` já bloqueou o alvo e persistiu); 404 para a exceção `item_desconhecido`; 400 para forma inválida; 401/403 da autenticação; 500 sem detalhe para o resto (Sentry). O `mes_destacado_em_transito` NÃO vai ao Sentry (é corrida esperada com a E9: ver abaixo).

**O que acontece quando o dado não existe:** `item_id` que não existe: a função lança `item_desconhecido` → 404. `passo: 'canal'` de uuid sem remoção: 200 `{ motivo: 'canal_desconhecido' }` (o CLI escreve a frase; não é erro de transporte). `attest` sem `prefixos`, ou com `prefixos: []`: igual à M3b (compatível). `attest` de fonte `b2` com `prefixos` sem `execucao_id`: 400. `plan` num banco sem `obs_archive_prefixos_ausentes` (prod antes da migration): esta rota só sobe depois da Tarefa 10 (P47), e o teste de rota usa o banco de integração com a M9. O corpo do `registrar` sem `resumo.tabelas_lidas`: 400 (a função recusaria com `resumo_com_unidade_nao_lida` de todo jeito).

- [ ] **Passo 1. Testes, falhando** (`expurgo-route.test.ts`, `// @vitest-environment node`, `describe.skipIf(skipIfNoLocalDb())`, chave de teste semeada como na M3b):

| Teste | Afirma |
|---|---|
| `sem chave: 401; chave sem archive_owner: 403` | — |
| `abrir: devolve os grupos` | item semeado em `copiar`: 200 com `grupos[0].alvos[0].arquivos` e `hash_conteudo` |
| `registrar: 409 resumo_versao_mudou` | registrar com `resumo.versao` velho: 409 `{ erro: 'resumo_versao_mudou' }`, nada gravado (contagem de `obs_archive_units` igual) |
| `registrar: 409 por recusa da função` | uma recusa de cada código da lista vira 409 com o mesmo código; `contagem_divergente` traz `alvo_id` e o alvo aparece `bloqueado` |
| `registrar: 409 mes_destacado_em_transito` | mês em trânsito (desanexado sem ter chegado ao NAS): 409 e `Sentry.captureException` NÃO chamado |
| `registrar: 400 forma` | `alvos[0].unidade.sha256_bytes` com 63 caracteres: 400; `resumo` sem `tabelas_lidas`: 400 |
| `bloquear: grava o motivo` | 200; `obs_archive_owner_pending()` mostra o alvo em `bloqueado` com o motivo; motivo fora da lista: 400 |
| `canal: motivo` | uuid novo: `{ motivo: 'canal_desconhecido' }` |
| `attest: aceita prefixos (nas)` | attest de fonte `nas` com `filhos.texto` montado e com sentinela e `prefixos: [{ alvo:'canal:<ref>', filho:'texto', prefixo:'serie/canais/<ref>/', estado:'ausente', snapshots:'ausente' }]`: 200, `prefixos[0].resposta 'aceito'` e `nas_absent_first_at` gravado na linha de `obs_archive_absence` |
| `attest: aceita prefixos (b2)` | fonte `b2` com `execucao_id` de run `controle_ok` e `nomes`: 200 `aceito`, `b2_nomes` gravado; sem `execucao_id`: 400 |
| `attest: recusa prefixo inseguro` | `prefixo: '../x/'`: 400; `nomes` com mais de 20 itens ou nome fora do alfabeto seguro: 400 |
| `record: 409 expurgo_em_curso` (C3) | registrar uma unidade do mês de um canal com item em `copiar`: 409 |
| `pending: versao 2` | `GET pending` devolve `versao: 2` e passa no `lerPendencias` (Tarefa 7) |
| `registro: archive tem endpoint_count certo` | o teste do registro (já existente) passa com a entrada nova |
| `saiu: mes_destacado_em_transito tem frase` | **afirma o existente da E9** (`responder.ts` já mapeia, sem Sentry); a frase diz "algum mês está saindo do banco" (emenda 23/10, N9-4; se diferir da `modelo.ts:167`, trocar a frase lá, sem mapeamento em duplicata) |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A rota:**

```ts
// apps/web/src/app/api/pipeline/archive/expurgo/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { CorpoExpurgo, type CorpoExpurgoT, type RespostaCanalT } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { autenticarArquivo } from '@/lib/pipeline/archive-auth' // o nome real: grep -rn "archive_owner" apps/web/src/lib/pipeline

const ITEM = /^item:([1-9][0-9]{0,18})$/
type Rpc = { fn: string; args: Record<string, unknown> }
function chamada(site: string, c: Exclude<CorpoExpurgoT, { passo: 'canal' }>): Rpc | null {
  switch (c.passo) {
    case 'abrir': { const m = ITEM.exec(c.item_id); return m ? { fn: 'obs_archive_expurgo_open', args: { p_site: site, p_item_id: m[1] } } : null }
    case 'registrar': { const m = ITEM.exec(c.item_id); if (!m) return null; const { passo: _p, item_id: _i, ...grupo } = c
      return { fn: 'obs_archive_expurgo_record', args: { p_site: site, p_item_id: m[1], p_grupo: grupo } } }
    case 'bloquear': return { fn: 'obs_archive_expurgo_block', args: { p_site: site, p_item_id: <n do item_id>, p_alvo: c.alvo_id, p_motivo: c.motivo } }
  }
}

async function motivoDoCanal(site: string, ref: string): Promise<RespostaCanalT> {
  const sb = getSupabaseServiceClient()
  const r = await sb.from('obs_archive_channel_removals').select('archive_decision, completed_at').eq('site_id', site).eq('channel_ref', ref).maybeSingle()
  if (r.error) throw new Error('leitura_falhou')
  if (r.data) return { motivo: r.data.archive_decision === 'guardar' ? 'canal_guardado' : r.data.archive_decision === 'apagar' ? 'ok' : 'sem_destino', prefixos: [] }
  const c = await sb.from('competitor_channels').select('id').eq('site_id', site).eq('id', ref).maybeSingle()
  if (c.error) throw new Error('leitura_falhou')
  return { motivo: c.data ? 'canal_nao_removido' : 'canal_desconhecido', prefixos: [] }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await autenticarArquivo(req, 'archive_owner')
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status })
  const corpo = CorpoExpurgo.safeParse(await req.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ erro: 'forma', detalhe: corpo.error.issues.map(i => i.path.join('.')) }, { status: 400 })
  try {
    if (corpo.data.passo === 'canal') return NextResponse.json(await motivoDoCanal(auth.siteId, corpo.data.channel_ref), { status: 200 })
    const rpc = chamada(auth.siteId, corpo.data)
    if (!rpc) return NextResponse.json({ erro: 'forma', detalhe: ['item_id'] }, { status: 400 })
    const { data, error } = await getSupabaseServiceClient().rpc(rpc.fn, rpc.args)
    if (error) {
      if (error.message.startsWith('item_desconhecido')) return NextResponse.json({ erro: 'item_desconhecido' }, { status: 404 })
      throw new Error(`rpc ${error.code}`)
    }
    const r = data as { status?: string; motivo?: string; alvo_id?: number } | null
    if (r && r.status === 'recusado') return NextResponse.json({ erro: r.motivo ?? 'recusado', ...(r.alvo_id !== undefined ? { alvo_id: r.alvo_id } : {}) }, { status: 409 })
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    Sentry.captureException(e, { extra: { rota: 'archive/expurgo', passo: corpo.data.passo } })
    return NextResponse.json({ erro: 'interno' }, { status: 500 })
  }
}
```

(Nomes reais de `autenticarArquivo`, do campo `siteId` e de `getSupabaseServiceClient` saem da rota `attest` da M3b, que já faz o mesmo; o teste `sem chave: 401` amarra. Emenda 29/10 (lote 2, P3): a rota valida o motivo da recusa por lista fechada `MOTIVOS_RECUSA` (9 motivos); motivo fora da lista vira 500 com Sentry, nunca 409. Motivo novo na SQL exige acrescentar a `MOTIVOS_RECUSA`. `Sentry` só no caminho de exceção: recusa não é exceção.) Ajustes nas rotas da M3b: `attest` aceita `prefixos` (Zod: `z.array(z.object({ alvo: z.string().regex(/^(alvo:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36}|antiga:[0-9a-f-]{36})$/), filho: z.enum(['numerico','texto']), prefixo: z.string().regex(CAMINHO_SEGURO_PREFIXO), estado: z.enum(['ausente','presente']), snapshots: z.enum(['ausente','presente','indisponivel']).optional(), snapshot_mais_antigo: z.string().max(80).optional(), nomes: z.array(z.string().regex(NOME_B2)).max(20).optional() }).strict()).max(2000).optional()`, deixando de responder `400 VALIDATION_ERROR` a elas, C10) e, quando presentes e não vazios, chama `obs_archive_attest_prefixos(p_site, <fonte>, <execucao_id ou null>, <filhos ou {}>, <prefixos>)` depois do attest existente, devolvendo `prefixos` na mesma resposta (`snapshots`, `snapshot_mais_antigo` só valem na fonte `nas`; `nomes` só na `b2`; a combinação errada é 400); `plan` e `b2/plan` não mudam de código (os wrappers SQL já devolvem `prefixos_ausentes` preenchido, Tarefa 5), só o teste do formato; `pending` idem (a função já devolve `versao 2`); `record` mapeia `expurgo_em_curso` para 409.

**(Superado em 23/10: a E9 já tem este mapeamento; ver D-M9-23 reescrita. Texto original, mantido para histórico.) Mapeamento do mês em trânsito na E9 (Phil I10, Yannis I9):** `saiu/responder.ts` e `saiu/modelo.ts` ganham o código `mes_destacado_em_transito` com a frase "o mês está saindo do banco; tente de novo depois que o copiador receber", e o `responder.ts` NÃO o manda ao Sentry (corrida normal: o mês some do banco e o item é apagado no mesmo minuto). Se a E9 ainda não estiver em `staging`, o pedido vai no `aviso-a5-m9.md` (a A5 é dona dessas funções) e o teste `saiu: mes_destacado_em_transito tem frase` fica `skip` com o motivo escrito.

- [ ] **Passo 4. Registro, doc e contrato.** Entrada em `api-registry.ts` copiando a forma da entrada de `archive/attest` (método, caminho, `scope`, descrição "expurgo enxuto: abrir, registrar, bloquear e consultar canal (M9)") e `endpoint_count` +1; seção nova em `cowork-docs-archive.md` com os quatro passos, corpos e códigos (o mesmo texto do C14); `contrato-rotas-m3b.md` r2.6: C14 inteiro, C10 marcado "resolvido pela M9 (D-M9-6)", C3 com `409 expurgo_em_curso`, C4 com `prefixos` (e `snapshots`, `snapshot_mais_antigo`, `nomes`), C5 com `prefixos_ausentes` em lista de dicts, C12/C13 `versao 2`, e a linha "Segredo" do C13 como revista na Tarefa 7.

- [ ] **Passo 5.** Rodar a rota, o registro (`npx vitest run test/lib/pipeline > /tmp/m9-reg.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-reg.txt`) e a Tarefa 7 juntos → PASS. Typecheck web (`npm run typecheck -w apps/web > /tmp/m9-tc.txt 2>&1; tail -5 /tmp/m9-tc.txt`).

- [ ] **Passo 6. Commit** (quando mandado, depois de "TRAVA M9-2 solta", **junto** com a Tarefa 7, num envio): `git commit -m "feat: M9: rota archive/expurgo (C14), prefixos no attest e no plan, contrato r2.6" -- <arquivos>`.

---

### Task 12: a tela (peça 7 na fila e "Canais removidos" na página do Arquivo)

**Files:**
- Modify: o componente da peça 7 da E9 (`grep -rln "_saiu\|peca7\|Peça 7" apps/web/src/app/cms apps/web/src/components`) e a página do Arquivo da M5 (`grep -rln "pendenciasParaTela" apps/web/src/app/cms`)
- Create: `apps/web/src/app/cms/(authed)/youtube/observatorio/arquivo/_components/canais-removidos.tsx` (o caminho exato segue a pasta da página da M5)
- Create: `apps/web/src/app/cms/(authed)/youtube/observatorio/arquivo/actions-m9.ts` (server actions `marcarRodado`, `desfazerRodado`)
- Create: `apps/web/test/cms/observatorio/canais-removidos.test.tsx` (`// @vitest-environment jsdom`), `apps/web/test/cms/observatorio/actions-m9.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes: `obs_archive_removed_channel_list` com os estados novos e as chaves novas (`nas_last_absent_at`, `marcado_rodado_em`, `lote_e10_aberto`, `prefixos_total`, `prefixos_ausentes_nas`, `snap_ok`, `completed_at`, `snapshot_mais_antigo`; Tarefa 5, wrapper); `pendenciasParaTela` com `falta`/`motivo` (Tarefa 7); `obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean)` (Tarefa 5; aceita `item:<n>` e `canal:<uuid>`; ela mesma confere admin com `obs_archive_is_site_admin`, e a action confere antes, defesa em profundidade); os `prefixos` do item pendente `canal:` (Tarefa 5, `owner_pending`); `montarComandosDoCanal` (Tarefa 6); `requireSiteAdmin`/`canAdminSite` do CMS; o componente `CmsLink` (`src/app/cms/(authed)/_shared/cms-link.tsx`) e os componentes da M5 (`grep -rn "export function" <pasta da página da M5>/_components`: régua, selo de estado, bloco de comandos).
- Produces: `<CanaisRemovidos linhas={...} podeApagar={boolean} onMarcar onDesfazer />`; `marcarRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>`, `desfazerRodado(itemId: string)` idem, com `itemId` = `canal:<uuid>` ou `item:<id>` (o mesmo `item_id` das pendências; `antiga:<uuid>` não tem "já rodei").

**Fonte do desenho:** o mockup aprovado da fase (`docs/superpowers/mockups/<pasta da manutenção>/peca7.js` e `arquivo.js`, bloco `CMDHTML`; `ls docs/superpowers/mockups | grep -i manut`). Textos copiados dele; onde o mockup não cobre um estado da M9, a frase vem do `02` §11.3 e a peça vai ao Logan e à Naksu antes do dono (regra do time).

**O que acontece quando o dado não existe:** `obs_archive_removed_channel_list` sem linhas: o bloco mostra "Nenhum canal removido" (cinza, não verde); erro de leitura: "não medido" (cinza com ⓘ "o site não conseguiu ler a lista; recarregue"), nunca lista vazia; linha com `prefixos` vazio em `apagar_antigas`: "Ver os comandos" fica desabilitado com "o site ainda não sabe os prefixos; espere a próxima passada do copiador".

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `estados com cor estável` | uma linha por estado (`pedido`, `copiando`, `apagado_nas`, `apagado_b2`, `concluido`, `guardado`): selo com o texto do mockup e a classe de cor fixa (cinza/âmbar/verde), `aria-label` com o texto |
| `idade: âmbar 30, vermelho 60` | `pedido` há 31 dias: âmbar; há 61: vermelho; há 29: neutro (fake timers) |
| `só admin vê Apagar do arquivo` | `podeApagar=false`: sem o botão e sem "Ver os comandos" (E-D4) |
| `Ver os comandos: 5 passos` | abre o bloco com os 5 passos do `montarComandosDoCanal` e o botão de copiar a linha curta |
| `Já rodei / Desfazer` | clique chama a action recebida por prop (não importada no client) e mostra "marcado às HH:MM"; erro da action: frase do erro, estado anterior |
| `vazio e erro` | lista vazia: "Nenhum canal removido"; `linhas = null` (erro): "não medido" |
| `actions: exigem admin` | `marcarRodado` sem admin: `{ ok: false, erro: 'sem_permissao' }` e o `rpc` não é chamado; com admin: chama `obs_archive_marcar_rodado` com `{ p_site, p_item_id: 'canal:<uuid>', p_actor: <id do usuário>, p_desfazer: false }`; `desfazerRodado`: `p_desfazer: true`; `item_id` fora do formato (inclusive `antiga:<uuid>`): `{ ok: false, erro: 'forma' }` |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. Código.** `actions-m9.ts`:

```ts
'use server'
import { z } from 'zod'
import { requireSiteAdmin } from '@/lib/cms/auth' // o caminho real: grep -rn "export async function requireSiteAdmin" apps/web/src
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

// só item: e canal: têm comando do dono a marcar; antiga: (versão superada) não tem (Tarefa 7, teste `regex da action`)
const ItemId = z.string().regex(/^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36})$/)
async function marcar(itemId: string, desfazer: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = ItemId.safeParse(itemId)
  if (!r.success) return { ok: false, erro: 'forma' }
  const { siteId } = await getSiteContext()
  const usuario = await requireSiteAdmin(siteId).then(u => u, () => null)
  if (!usuario) return { ok: false, erro: 'sem_permissao' }
  const { error } = await getSupabaseServiceClient().rpc('obs_archive_marcar_rodado', { p_site: siteId, p_item_id: r.data, p_actor: usuario.id, p_desfazer: desfazer })
  return error ? { ok: false, erro: error.message.startsWith('sem_permissao') ? 'sem_permissao' : 'interno' } : { ok: true }
}
export async function marcarRodado(itemId: string) { return marcar(itemId, false) }
export async function desfazerRodado(itemId: string) { return marcar(itemId, true) }
```

(Se `requireSiteAdmin` do projeto receber outro argumento — post, não site — ou não devolver o usuário, usar o equivalente de admin de site da página da M5 e ler o usuário pela sessão, achado pelo `grep -n "requireSiteAdmin\|canAdminSite" <page.tsx da M5>`; o teste `actions: exigem admin` amarra.) `canais-removidos.tsx` é `'use client'`, recebe `linhas`, `podeApagar`, `onMarcar`, `onDesfazer` por props (a página passa as actions); cores literais (`#…`/`rgba`, nunca `color-mix`, memória do Opera); régua de idade; frase-resumo no topo ("2 canais esperando você, o mais antigo há 34 dias"). A peça 7 da fila E9 ganha a contagem de `apagar_antigas` + `conferir_b2` + bloqueados (vermelho se algum bloqueado) e o `CmsLink` para a página do Arquivo.

- [ ] **Passo 4.** Rodar → PASS. Typecheck web.

- [ ] **Passo 5. Validação de tela:** Gio (agente `gio-qa`, Sonnet) abre o CMS local autenticado com a semente da M9 (um canal em cada estado) e devolve o veredito em texto, capturas em `docs/superpowers/mockups/<pasta>/m9-shots/`; Logan e Naksu revisam o implementado contra o mockup; o dono confere no Opera (`open -a Opera <url>`), roteiro no `ROTEIRO-DE-TESTE-E-MELHORIAS.md`.

- [ ] **Passo 6. Commit** (quando mandado): `git commit -m "feat: M9: canais removidos na página do Arquivo e na peça 7" -- <arquivos>`.

---

### Task 13: os blobs das remoções na tarefa `tamanho_do_banco` (atrás de `OBS_ARQUIVO_LIMPEZA_CANAL`)

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/remover.ts` (função nova `retentarBlobsDeRemocoes`, ao lado de `retentarMiniaturasPendentes`, `remover.ts:122`, reusando `apagarDoBlobPadrao`, `PREFIXO_DAS_MINIATURAS` e o filtro de prefixo de `remover.ts:45`)
- Modify: o ponto da tarefa `tamanho_do_banco` que chama `retentarMiniaturasPendentes` (`grep -rn "retentarMiniaturasPendentes" apps/web/src`)
- Modify: `supabase/rascunhos/m9.sql` (parte 5, antes da Tarefa 10): `obs_archive_removal_blobs_done`
- Modify: `apps/web/test/youtube/observatorio/<teste existente de remover.ts>` (`grep -rln "retentarMiniaturasPendentes" apps/web/test`), `docs/ops/env-vars.md`

**Interfaces:**
- Consumes: `obs_archive_channel_removals.blobs_pending text[]` (M3b, `supabase/rascunhos/m3b.sql:204-222`, preenchido na remoção por `obs_archive_channel_blobs`, `m3b.sql:2426`); `DepsDoBlob` (`remover.ts:22`).
- Produces: `retentarBlobsDeRemocoes(sb: SupabaseClient, o: { agoraMs: number; maximo: number; prazoMs: number }, deps?: DepsDoBlob & { env?: NodeJS.ProcessEnv }): Promise<NovaTentativa>` (mesmo tipo de `remover.ts:116`; `{ porque: 'flag_desligada' }` sem a variável); SQL `obs_archive_removal_blobs_done(p_site uuid, p_ref text, p_urls text[]) returns int` (tira as URLs de `blobs_pending`, devolve quantas ficaram).

**O que acontece quando o dado não existe:** variável ausente ou diferente de `'on'`: `{ porque: 'flag_desligada' }`, nada lido nem apagado (default desligado; a linha da tarefa diz por quê). Sem `BLOB_READ_WRITE_TOKEN`: `{ porque: 'sem_token' }` como a irmã. `blobs_pending = '{}'`: a linha nem é lida (filtro `not eq '{}'`, como `remover.ts:137`). URL fora do prefixo: não apagada, conta em `foraDoPrefixo` e **fica** em `blobs_pending` (o canal não chega a `concluido`, Tarefa 4 exige `cardinality = 0`; a pendência mostra `falta 'blobs'` e o runbook diz como baixar à mão). Falha do Blob: a URL fica pendente, a próxima rodada tenta; nunca lança.

- [ ] **Passo 1. Testes, falhando** (no teste existente de `remover.ts`, com `sb` falso):

| Teste | Afirma |
|---|---|
| `sem a variável não tenta` | `delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL`: `{ porque: 'flag_desligada' }`, `sb.from` não chamado (regra "env com fallback") |
| `com 'off' não tenta` | idem |
| `com 'on' apaga e baixa` | duas remoções com URLs no prefixo: `apagarDoBlob` por bloco; `rpc('obs_archive_removal_blobs_done', { p_site, p_ref, p_urls })` com as apagadas |
| `fora do prefixo fica` | uma URL fora: não apagada, não baixada, `foraDoPrefixo 1` |
| `falha não baixa` | `apagarDoBlob` lança no primeiro bloco: sem `rpc` desse bloco; o segundo canal segue |
| `prazo` | `agora` além de `agoraMs + prazoMs` depois do primeiro canal: para, devolve o parcial |

E no SQL (integração, parte 5): `blobs_done tira só as URLs dadas` (três pendentes, baixa duas: fica uma, devolve 1; URL que não estava: ignorada); `sem EXECUTE para anon` (como o teste de grants da Tarefa 1).

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. Código.** SQL (parte 5 do `m9.sql`):

```sql
create or replace function public.obs_archive_removal_blobs_done(p_site uuid, p_ref text, p_urls text[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_restam int;
begin
  update public.obs_archive_channel_removals r
     set blobs_pending = coalesce((select array_agg(u) from unnest(r.blobs_pending) u where u <> all (p_urls)), '{}'::text[])
   where r.site_id = p_site and r.channel_ref = p_ref
  returning cardinality(r.blobs_pending) into v_restam;
  return coalesce(v_restam, 0);
end $$;
revoke all on function public.obs_archive_removal_blobs_done(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.obs_archive_removal_blobs_done(uuid, text, text[]) to service_role;
```

TS (`remover.ts`), a mesma forma de `retentarMiniaturasPendentes`, lendo outra tabela:

```ts
/** M9 (D-M9-13): nova tentativa diária dos blobs dos canais removidos (obs_archive_channel_removals.blobs_pending). Só com OBS_ARQUIVO_LIMPEZA_CANAL='on'. Nunca lança. */
export async function retentarBlobsDeRemocoes(
  sb: SupabaseClient,
  o: { agoraMs: number; maximo: number; prazoMs: number },
  deps: DepsDoBlob & { env?: NodeJS.ProcessEnv } = {},
): Promise<NovaTentativa> {
  try {
    if ((deps.env ?? process.env).OBS_ARQUIVO_LIMPEZA_CANAL !== 'on') return { porque: 'flag_desligada' }
    if (e2e()) return { porque: 'e2e' }
    if (!deps.apagarDoBlob && !process.env.BLOB_READ_WRITE_TOKEN) return { porque: 'sem_token' }
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    const agora = deps.agora ?? Date.now
    const lido = await sb.from('obs_archive_channel_removals')
      .select('site_id, channel_ref, blobs_pending')
      .not('blobs_pending', 'eq', '{}')
      .order('decided_at', { ascending: true })
      .limit(50)
    if (lido.error) return { porque: 'leitura_falhou' }
    let apagadas = 0, pendentes = 0, foraDoPrefixo = 0, usadas = 0
    for (const r of (Array.isArray(lido.data) ? lido.data : []).filter(ehObjeto)) {
      const urls = Array.isArray(r.blobs_pending) ? r.blobs_pending.filter((u): u is string => typeof u === 'string') : []
      const { dentro, fora } = separarPorPrefixo(urls)
      foraDoPrefixo += fora.length; pendentes += urls.length
      for (const bloco of blocos(dentro, 100)) {
        if (usadas >= o.maximo || agora() - o.agoraMs > o.prazoMs) return { apagadas, pendentes: pendentes - apagadas, foraDoPrefixo }
        try {
          await apagarDoBlob(bloco)
          const b = await sb.rpc('obs_archive_removal_blobs_done', { p_site: r.site_id, p_ref: r.channel_ref, p_urls: bloco })
          if (!b.error) apagadas += bloco.length
        } catch { /* fica pendente; a próxima rodada tenta */ }
        usadas += bloco.length
      }
    }
    return { apagadas, pendentes: pendentes - apagadas, foraDoPrefixo }
  } catch {
    return { porque: 'erro' }
  }
}
```

`separarPorPrefixo` e `blocos` são o filtro de `remover.ts:40-50` e o fatiamento de `remover.ts:95-100`, extraídos para funções no mesmo arquivo **se** ainda estiverem embutidos (refatoração sem mudança de comportamento; os testes existentes de `retentarMiniaturasPendentes` provam). A coluna de ordem é `decided_at` (`m3b.sql:204-222`; se o nome for outro, o `grep -n "decided_at\|requested_at" supabase/rascunhos/m3b.sql` da Tarefa 0 acerta). A tarefa `tamanho_do_banco` chama `retentarBlobsDeRemocoes` logo depois de `retentarMiniaturasPendentes`, com o mesmo `o` salvo `maximo`, que é o que sobrou da irmã, e escreve o resultado na mesma linha de diário (com `flag_desligada` visível).

- [ ] **Passo 4.** Rodar → PASS. `env-vars.md`: "`OBS_ARQUIVO_LIMPEZA_CANAL` — `on` liga a nova tentativa diária dos blobs dos canais removidos (M9); ausente ou outro valor: desligado; ligar só depois de um canal de teste de ponta a ponta (P47, passo 5)".

- [ ] **Passo 5. Commit** (quando mandado): `git commit -m "feat: M9: blobs dos canais removidos na tarefa tamanho_do_banco, atrás de OBS_ARQUIVO_LIMPEZA_CANAL" -- <arquivos>`.

---

### Task 14: deploy na ordem P47, runbook, cobertura dos itens e promoção

**Files:**
- Create: `docs/ops/runbook-arquivo-mensal.md` (se a M3b já o criou: Modify, seção "Expurgo enxuto (M9)")
- Modify: `.superpowers/sdd/manutencao-nas/m9-progresso.md`
- Create: `apps/web/test/manutencao/m9-cobertura.test.ts`

**O que acontece quando o dado não existe:** runbook que cita um comando do painel sem o teste da função dele: o `m9-cobertura.test.ts` falha (um teste por comando citado). Variável `OBS_ARQUIVO_LIMPEZA_CANAL` ausente: a limpeza de blobs fica desligada (Tarefa 13) e a pendência `falta 'blobs'` explica.

- [ ] **Passo 1. Teste de cobertura dos itens** (`m9-cobertura.test.ts`, com banco de integração): um `it` por item do `02` que a M9 fecha, cada um chamando a função dona e afirmando o efeito: 65 (vídeo removido → item com alvos), 66 (`--apagar-antigas` recusa fora do tempo: Tarefa 8; aqui só a função `obs_archive_item_advance` não passa de `aguardando_nova` sem `received_at`), 67 (`competitor_removed_items` nunca é podado: depois de `item_advance` até `concluido`, a linha continua lá), 109/110/111 (canal: `pedido` → `apagado_nas` → `apagado_b2` → `concluido` só com atestados), 120 (a prova de snapshots é direta: sem `snap_absent_at` o canal fica em `apagado_nas`; **sem** retenção a registrar), 161/163/165 (versão antiga superada sai em `antiga:<uuid>` só depois da nova conferida e com a segunda conferência). Os testes que já existem nas Tarefas 3-5 são reaproveitados por nome; este arquivo só junta os que faltam e lista a tabela de cobertura num comentário no topo. NÃO há linha de "retenção de snapshots" (saiu do desenho: Phil I1).

- [ ] **Passo 2. Runbook** (seção nova, sem retenção): o ciclo mensal com expurgo (o `obs:arquivo` mostra `copiar` → o dono roda a linha → o copiador confere → `apagar_antigas` → linha → `conferir_b2` → painel do B2 com "mostrar versões" → atestado); "alvo bloqueado" (restaurar do B2 ou do snapshot e rodar no painel `select public.obs_archive_expurgo_unblock('<site>', <alvo_id>)`); "canal removido" (5 passos de "Ver os comandos" e `expurgar --canal`); "snapshot que ainda guarda o canal" (`falta 'snapshots'`: com `snap_bloqueio` nulo a espera é de ~14 dias e acaba sozinha; **uma linha por motivo, com o que o dono faz**: `fora_do_padrao` = apagar o snapshot manual ou de outra tarefa; `retido` = soltar o hold ou aceitar a espera da retenção maior; `lista_vazia`/`ilegivel` = conferir a montagem NFS e a tarefa de snapshot do NAS; `mtime_diverge`/`relogio` = conferir a hora do NAS; mudou a retenção ⇒ revisar D-M9-9b; apagar snapshot à mão é decisão do dono e nunca de agente); "ligar a limpeza" (`select public.obs_archive_m9_ligar('<site>', true)` no painel, só depois da TRAVA M9-3); e o que fazer quando o `obs:arquivo` sai com `versao` errada (o site e o Mac em versões diferentes: promover o que falta).

- [ ] **Passo 3. Deploy P47** (cada passo no ledger com data e quem; a TRAVA M9-3 manda na ordem):
  1. Tarefa 10 (migration; dono). O interruptor nasce DESLIGADO.
  2. Tarefas 7 + 11 (leitor/script v2 e rotas; um envio para `staging`, CI verde, promoção para `main`). Entre 1 e 2, o `obs:arquivo` antigo do Mac lê `versao 2` e sai com o script de falha: janela curta e esperada; anotar no ledger o horário dos dois.
  3. Tarefa 9 (kit; dono roda o arquivo de instalação). Com o interruptor desligado o kit novo e o antigo se comportam igual.
  4. Tarefas 8 e 12 (Mac e tela; um envio).
  5. Dono: pré-condição P-M9-1 lida (Tarefa 0, Passo 4) e a decisão dele sobre o snapshot órfão de 96 dias registrada no ledger ("decisão do dono"; o agente não apaga snapshot); depois `select public.obs_archive_m9_ligar('<site>', true)` no painel. Só então a prova de ausência começa a andar.
  6. Tarefa 13 com a variável ainda ausente; depois de um ciclo inteiro limpo (um canal de teste de ponta a ponta), o dono liga `OBS_ARQUIVO_LIMPEZA_CANAL=on` no Vercel.
- [ ] **Passo 4. Revisão final:** Phil e Yannis (agentes `phil-dados`, `yannis-software`) revisam o lote inteiro antes da promoção; conserta-se até acordo; Hanna confere a amarração do release com a M8 (passo 19 da M8 consome o `concluido` da M9b, nota de 30/10).

---

## NÃO VERIFICADO (conferir na execução; cada item tem o passo que o resolve)

Resolvidos por leitura nesta revisão (14/10 noite), com o achado:

1. **Corpo da E9** (emenda 23/10: lido das migrations de `origin/staging`, `20261015000001` e `20261018000002`, e confirmado por md5 em produção; não mais do `wt-e9`); âncoras e variáveis ficaram na Tarefa 2 (`v_todos` atribuído antes do primeiro `insert ... as r`, conferido no Passo 4 da Tarefa 2). O md5 de produção só se confere na Tarefa 10.
2. **Constantes md5** `V_MD5_VIDEO`, `V_MD5_COMENTARIOS` e `V_MD5_CANAL` (rodada 0.7): (emenda 23/10: sem constante copiada; o md5 sai do `prosrc` instalado a partir das migrations) calculadas na Tarefa 2 e trocadas pelo md5 de produção na Tarefa 10 (marcadores `<<MD5_VIDEO>>`, `<<MD5_COMENTARIOS>>`, `<<MD5_CANAL>>`; teste que falha se sobrar `<<`).
3. **Raiz do NAS vista da forja**: a escrita é `/mnt/arquivo/escrita/<filho>` (`comum.config`, `comum.py:429`) e a leitura `/mnt/arquivo/leitura/<filho>` (unidades `mnt-arquivo-leitura-*.mount`, `ro`); lido na forja em 14/10 (`ssh forja 'mountpoint /mnt/arquivo/leitura/numerico'`: é ponto de montagem; `.arquivo-vivo` e `_recebendo` presentes). O Mac lê pela `ro`; o copiador mede pela montagem que já usa.
4. **Colunas dos CSV do filtro**: tiradas de `obs_archive_table_exprs` (`m3b.sql:787-806`); o teste de ouro da Tarefa 6 as amarra contra `obs_archive_summary_rows`.
5. **Manifesto da versão nova**: o fluxo de selagem da M3b o gera; a Tarefa 5 tem `item_falta` com `manifesto` (mês com `unsealed_reason = 'expurgo'` ou selo anterior à unidade) e o gatilho `obs_archive_manifesto_antigo` (teste `manifesto antigo`); o plano da M3b exige `sealed_at is null or unsealed_at is not null` nos `manifestos` (`m3b.sql:2248-2383`), o que deixa o mês re-selável.
6. **Reconferência da M3b e versão superada**: resolvido por leitura. `obs_archive_month_files` (`m3b.sql:505-540`) monta o conjunto corrente (a versão mais nova **já recebida** por tabela e canal; a selada até a nova chegar, item 78) e é a base de `obs_archive_nas_cobertura`, que alimenta `reconferir` (`m3b.sql:2355-2370`). Logo, depois que a nova é recebida a antiga sai do conjunto e o copiador não a pede; antes disso a antiga continua pedida, que é o certo. O teste da Tarefa 5 (`reconferir não pede a antiga superada`) só amarra o fato.
7. **Painel do B2 e versões** (CP32): continua um fato do painel, não do código; o atestado conta qualquer ação (`hide`, `start`, `folder`) como presente e devolve o nome, e o painel é a frase fixa "mostrar versões" (Tarefa 7).
8. **Função de nome no B2**: `nome_b2(conf, filho, relativo, sufixo)` em `b2.py:68`, lida; `nome_b2.py` saiu (Tarefa 9).
9. **Coluna de ordem de `obs_archive_channel_removals`** e funções de `remover.ts`: Tarefa 13 manda o `grep` na hora; o nome fica no ledger.
10. **Empates de `ts` no resumo refeito**: a semente do teste de ouro não tem empate e o teste diz isso; o tamanho máximo pelo pipe/heredoc (64 MiB por arquivo) é medido com o maior mês real na Tarefa 0.
11. **Lote E10**: `obs_archive_batches` tem `kind, channel_ref, deleted_at, closed_at` (`migrations/20261014000002...:30-71`); a M9 só lê esses campos para a `falta 'lote_e10'`.

Abertos (o teste decide na execução):

12. **Semântica de `unsealed_at`, `sealed_at` e `b2_attested_at` depois do re-selo** (usada no `item_falta`, Tarefa 5): o teste `item_falta: depois do re-selo` decide e o ajuste vai para o ledger.

Limites declarados (não são bug; estão nos testes):
- (Phil M4, 29/10) Nova em partes: o script do dono confere só a parte 1 da nova antes de apagar a antiga (amostra); o banco já exigiu a nova inteira (`item_falta`) e todas as partes no B2 (`antigas_open`). Entra no LEIAME do dono na Tarefa 14.
- (Phil M5, 29/10) `item_capture` pula o mês cuja versão mais nova está vazia: linhas do item numa versão anterior desse mês ficam no NAS/B2 sem alvo e sem bandeira. Entra na lista "o que a M9 não apaga" do LEIAME na Tarefa 14.

- Unidade mais nova vazia com versões antigas não vazias: o alvo conclui, e as versões antigas entram em `antiga:` com a nova nula (Tarefa 3, ausência com `nova_sha256` nulo).
- Unidade com `nx` de várias partes: a ausência aponta a parte 1 (`obs_archive_arquivos_da_unidade`); as outras partes caem no mesmo prefixo de mês e a prova do prefixo as cobre.
- `esperadas` nulo em unidade defasada (mês fora do banco sem linha online): `removidas = 0` só vira `sem_linhas` com o mês de fato fora do banco.
- `item_targets` concluídos não são podados nesta etapa (Tarefa 8, "Limites declarados").
- **Anexos de `video_antigo`** (`obs_archive_unit_attachments`) não entram em `obs_archive_arquivos_do_canal` (Phil M6): enquanto a M10b não existir, `video_antigo` nasce `bloqueado`/`depende_m10b` (D-M9-14), e o canal com vídeo congelado termina o `apagar_antigas` com a frase `RESTA <prefixo>` (o diretório tem anexos que o site não lista). O dono usa "Ver os comandos", que apaga o prefixo inteiro. A M10b acrescenta os anexos à lista.
- **Versão superada de texto em partes**: (r1 29/10) revogado; a superada em partes vira uma linha `antiga:` por parte (Tarefa 5).
- **Reaparecimento depois de `concluido`** (Yannis m3): o item ou canal concluído sai de `prefixos_ausentes` e o site deixa de perguntar; um arquivo que volta ao NAS depois disso só aparece na reconferência normal da M3b (que já o acusa como arquivo fora do registro). `obs_archive_reabrir` de item concluído religa `archive_pending` (Tarefa 4). Sem pergunta por prazo extra: declarado.
- **`OBS_ARQUIVO_LIMPEZA_CANAL` decide duas coisas** (Yannis m5): liga o `comandoDeLimpeza` da tela (M3b, `capacidades.ts:14`) e a nova tentativa do Blob (Tarefa 13). O canal só chega a `concluido` com os blobs apagados, que exigem a variável; por isso o ciclo de teste de ponta a ponta da Tarefa 14 (Passo 3, item 6) vai até `apagado_b2` com a variável ainda ausente, o teste da frase da Tarefa 12 roda com a variável apagada, e a tarefa do Blob recebe do chamador o `maximo` que SOBRA depois das miniaturas (`o.maximo` menos as já apagadas por `retentarMiniaturasPendentes`), para o orçamento da tarefa não dobrar.

## Dependências de outras etapas e trilhas

- **E9 em produção** (TRAVA M9-0, por conteúdo): sem ela as injeções não têm onde entrar. **Aviso à A5** (`aviso-a5-m9.md`): item 1 (declarar o destino em `competitor_channel_purge`) **atendido pela E9 em 15/10**; item 2 (`apagando_ha_mais_de_1d`) **atendido**; D-M9-25 (limpar `yt_watch_*`) e D-M9-26 (recusar apagar enquanto a M9 está desligada) **não são pedidos à A5**: decididas pelo dono em 23/10 e feitas dentro da M9 (Tarefas 2 e 11).
- **M3b em produção** e **M3b-forja Tarefa 7a** (o `pendencias-script.ts`, `apaga_conferido`, `obs:arquivo` no Mac): a Tarefa 7 estende código que só existe depois delas. **Pedido da M9 à Tarefa 10 da M3b** (`m3b-site-progresso.md`, "Pedido da M9 para a Tarefa 10"): o CHECK de `unsealed_reason` aceita `'expurgo'`. O kit é estendido só na Tarefa 9 da M9; nada obrigatório na M3b-forja.
- **M5** (página do Arquivo e componentes): Tarefa 12. **M6**: o mês destacado e a saída de canal criam os canais removidos que a M9 limpa (Travas).
- **M10b**: `video_antigo` fica `bloqueado` com `depende_m10b` até ela (D-M9-14).
- **M8**, passo 19: consome o `concluido` da M9b (30/10; a M9 sem a Tarefa 12 não o entrega). Terceiro gatilho da M9b: ao fechar a M9, plano da M9b antes da selagem em que o canal do passo 19 entra.
- **Dono**: migration (Tarefa 10), kit da forja (Tarefa 9), interruptor `obs_archive_m9_ligar` e decisão sobre o snapshot órfão (Tarefa 14), variável no Vercel (Tarefa 14), toda escrita no NAS e no B2.

## Self-review (feito)

- Cobertura: itens 65, 66, 67, 109, 110, 111, 120, 161, 163, 165 com dono (Tarefa 14, Passo 1); C10 resolvido (Tarefa 11); D-M9-1..24 cada uma com tarefa.
- Funções de escrita da M9 chamadas só por `service_role` (`capture`, `expurgo_open/record/block`, `attest_prefixos`, `prefixos_ausentes`, `marcar_rodado(p_site, p_item_id, p_actor, p_desfazer)`, `owner_pending`); `expurgo_unblock` e `m9_ligar` só do painel. Nenhuma função da M3b editada por texto.
- Sem retenção de snapshots em lugar nenhum (prova direta); sem `nome_b2.py`; o B2 devolve o nome no `attest`.
- Nada escreve na forja ou no NAS fora dos arquivos do dono; o Mac lê só pela montagem `ro` e para sem bloquear quando o NAS está fora.
- Comandos do dono só são entregues no dia (regra "comando só na hora").
