# A5 · Comentários F2-coleta (respostas de espectadores): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Passos com checkbox (`- [ ]`). TDD: teste vermelho, implementação, teste verde, commit por caminho explícito.

**1º rascunho, 17/10.** Falta: portão de Phil e Yannis neste plano (1ª revisão), conserto, acordo. Nada é executado antes do acordo.

**Objetivo:** guardar o texto das respostas de outras pessoas que o `commentThreads.list` já devolve (o prefixo das 5 mais antigas), **só em fios com resposta do criador**, até **20 por vídeo**, com cada espectador numerado no fio (`speaker_no`) e **sem nenhum nome, foto, id de canal ou chave** guardado. 0 unidade de cota. **Sem tela:** nenhum leitor nem pacote de IA lê essas linhas até a F2-tela.

**Decisão e regra:** decisão do dono 17/10 (`.superpowers/sdd/a5/decisoes-do-dono.md`, última seção). Spec: emenda 17/10 ao item 7 do §4.6.3 de `docs/superpowers/specs/2026-10-12-observatorio-a5/02-comentarios-de-destaque.md` (itens **7a a 7g**; este plano cita "7a" etc.). Conta, armadilhas e conferências: `.superpowers/sdd/a5/noite/t7-cq-phil.md` §4 a §6 (F1 a F7). Ordem e aceite: `.superpowers/sdd/a5/noite/t7-hanna.md` (o critério de `speaker_key` aos 28 dias está **superado**: o dono recusou a chave).

**Ordem de subida:** **trem 8b**, depois do trem dos comentários fase 1 (trem 8, `docs/superpowers/plans/2026-10-17-a5-comentarios-producao-plan.md`) estar em main. A migration é aplicada pelo dono **antes** do código da coleta (Tarefa 8).

**Caminhos curtos:** `L = apps/web/src/lib/youtube/observatorio/comentarios`, `T = apps/web/test/youtube/observatorio`, `I = apps/web/test/integration`, `M = supabase/migrations`. Linhas citadas são do `~/Workspace/wt-trem7` (HEAD `042771ff2`); depois do trem 8 elas andam, então o executor localiza por trecho, não por número.

---

## Regras gerais

- **LGPD (7c):** resposta de terceiro **nunca** leva `author` no pacote, **nunca** tem linha em `competitor_video_comment_authors`, e o `authorChannelId` dela só existe em memória, dentro da coleta, para numerar. Nenhum log, erro, nota ou Sentry recebe texto, nome ou id de espectador (as varreduras de `T/comentarios-varredura.test.ts` continuam valendo e ganham a varredura 6).
- **Filtro antes do dado (7g):** a Tarefa 1 (leitores filtram `is_creator`) sobe e é promovida **antes** de qualquer linha de terceiro poder entrar. A coleta só grava terceiros quando o código novo manda `third_party_replies_max`; a função nova usa **0** quando o campo falta (código antigo nunca grava terceiro).
- **Falha em verde é o risco (CLAUDE.md, forja e coleta):** para cada passo, perguntar "o que acontece quando o dado não existe?". Aqui: fio sem resposta do criador ⇒ nada de terceiro; `authorChannelId` ausente ⇒ número novo, nunca "mesmo espectador"; teto estourado ⇒ conta em `terceiros_fora_do_teto`, nunca corte mudo.
- Testes longos não rodam no despacho do executor sem saída em arquivo: `npx vitest run <arquivos> > /tmp/f2-tN.txt 2>&1; grep -E 'FAIL|✗|Error' /tmp/f2-tN.txt`.
- Integração usa o banco local de integração (`bythiago_int`, portas 54421/54422; memória `reference_banco_local_integracao.md`), com `HAS_LOCAL_DB=1` e `describe.skipIf(skipIfNoLocalDb())`.
- Commit sempre `git commit -- <caminhos>` (vários executores no mesmo checkout); nunca stash, reset nem push sem o controlador.

## Foco de revisão (para Phil e Yannis)

1. A função de escrita: o `ja` do criador conta **só** `is_creator` (F2 crítico 1); terceiros têm CTE e teto próprios; a ordem dos passos (c → d → f → e → g) garante que a resposta do criador nova do mesmo retrato já é vista pelo passo dos terceiros.
2. Apagar sozinho (7d): terceiro ausente e terceiro de fio sem criador presente saem **na mesma transação**, sem passar pela fila nem por `competitor_removed_items`; a prova prova a regra.
3. Numeração sem chave (7c): o número de quem já falou vem do banco (`speaker_no` lido em `lerGuardados`) casado com o `authorChannelId` do lote atual; `authorChannelId` nunca sai de `L/espectadores.ts` e de `L/normalizar.ts`.
4. Leitores: nenhuma tela, pacote ou medida passa a ver terceiro, inclusive com dublê que ignora o filtro (defesa em memória além do filtro no banco).
5. Compatibilidade: função nova com payload antigo (sem `third_party_replies_max`) grava exatamente o que gravava; a chave da prova não muda de nome; a assinatura das duas funções não muda (a E10 confere a de `competitor_comment_health` por assinatura).

## Mapa de arquivos

| Arquivo | O que muda | Tarefa |
|---|---|---|
| `L/leitor.ts`, `L/leitor-contagem.ts`, `apps/web/src/lib/youtube/observatorio/medidas/ler-comentarios.ts` | filtro `is_creator` no banco e em memória; respostas exibidas por `creatorRepliesShown` | 1 |
| `L/regras.ts` | `creatorRepliesShown = 3` (T1); `creatorRepliesMax` 3 → 5, `thirdPartyRepliesMax = 20`, `version` 1 → 2, `ruleParams` (T3) | 1, 3 |
| `M/<ts>_observatorio_a5_f2_respostas_de_terceiros.sql` (novo, via `npm run db:new`) | coluna `speaker_no`, checks, `apply_competitor_comment_snap` e `competitor_comment_health` recriadas | 2 |
| `I/observatorio-a5-f2-terceiros.test.ts` (novo) | integração da função e da prova | 2 |
| `L/tipos.ts`, `L/normalizar.ts` | `Conversa.respostasDeTerceiros`; prefixo fora de ordem em `pool_stats` | 3 |
| `L/espectadores.ts` (novo) | numeração pura dos espectadores do fio | 4 |
| `L/gravar.ts` | `lerGuardados` com `id`, `is_creator`, `speaker_no`; pacote com as linhas de terceiros; contagens novas do resultado | 5 |
| `L/coletar.ts`, `L/frases.ts` | "visto no lote" inclui terceiros; numeração no retrato; frase da invariante | 6 |
| `T/comentarios-varredura.test.ts` | varredura 6 (LGPD das respostas de terceiros) | 7 |
| `.superpowers/sdd/a5/comandos/f2-coleta-db-push.sh` (novo) | uma linha para o dono aplicar a migration | 8 |

## Conflitos com o plano do trem 8 (`2026-10-17-a5-comentarios-producao-plan.md`)

| Arquivo | Trem 8 | Este plano | Como resolver |
|---|---|---|---|
| `L/leitor.ts` (`:207-210,362-372`), `L/leitor-contagem.ts` (`:100-150`), `L/leitor-tipos.ts` | T1: data nas respostas, até `creatorRepliesMax` por fio no canal, desempate por `id` | T1: filtro `is_creator`; corte por `creatorRepliesShown` | **escrever a T1 daqui sobre o trem 8 já em main** (rebase); as fatias que o trem 8 cria com `COMMENT_RULES.creatorRepliesMax` passam a `creatorRepliesShown` aqui, senão o salto para 5 (T3) muda a tela sem mockup |
| `T/comentarios-e5-ler.test.ts`, `T/comentarios-e5-ler-contagem.test.ts` | T1 acrescenta casos | T1 acrescenta casos | acrescentar no fim do `describe` que o trem 8 deixou; não reescrever os dele |
| `C/_chrome/comentarios/frases.ts` (`RESPOSTAS_QUE_O_YOUTUBE_MOSTRA`, `RESPOSTAS_VISIVEIS = 3`) | dono | não toca | dívida D3 do trem 8 continua; sai na F2-tela |
| `C/_contexto-ia/empacotar-*.ts` | T6 | não toca (os leitores já filtram) | nenhum |
| plano da decisão 75 | `C/_chrome/*`, `_canal/*` | não toca `L/` exceto o que o trem 8 já mexeu | nenhum conflito direto |

`L/regras.ts`, `L/normalizar.ts`, `L/gravar.ts`, `L/coletar.ts`, `L/frases.ts` (o de `L/`, não o de `_chrome`), `L/tipos.ts` e a migration **não aparecem** no plano do trem 8.

---

## Tarefa 0: pré-condições (sem commit)

- [ ] **Passo 1:** confirmar o trem 8 em main: `git log origin/main --oneline | grep -i "fio\|FioDeComentario" | head -3`. Sem ele, parar e avisar o controlador.
- [ ] **Passo 2:** confirmar que ninguém recriou as duas funções depois da MG8: `grep -ln "create or replace function public.\(apply_competitor_comment_snap\|competitor_comment_health\)" supabase/migrations/*.sql`. Esperado: só `20261013000003_observatorio_a5_e14_comentarios_destaque.sql`. Se houver outra, a base da cópia da Tarefa 2 é a mais nova.
- [ ] **Passo 3 (opcional, para o D+30):** o controlador pede ao dono a medição do Phil (`t7-cq-phil.md` §4): `select count(*) filter (where creator_replied) * 1.0 / count(distinct video_id) from competitor_video_comments where parent_id is null;`. Não bloqueia.

## Tarefa 1: leitores não veem terceiros (sobe primeiro, sozinha)

**Arquivos:** `L/regras.ts` (só `creatorRepliesShown`), `L/leitor.ts`, `L/leitor-contagem.ts`, `apps/web/src/lib/youtube/observatorio/medidas/ler-comentarios.ts`. Testes: `T/comentarios-e5-ler.test.ts`, `T/comentarios-e5-ler-contagem.test.ts`, `T/medidas-ler-comentarios.test.ts`.

- [ ] **Passo 1 (testes, vermelho):**
  - `comentarios-e5-ler.test.ts`: (a) a consulta de `competitor_video_comments` leva `.or('parent_id.is.null,is_creator.eq.true')` (afirmar a chamada no dublê, como os testes do leitor já fazem); (b) com o dublê devolvendo, sob um topo, 2 respostas do criador e 1 linha `parent_id` preenchida com `is_creator: false` e texto sentinela `TERCEIRO-SENTINELA`, nenhum cartão em nenhum nível contém a sentinela e `respostasDoCriador.length === 2` (o dublê ignora o filtro: prova a defesa em memória); (c) com 5 respostas do criador, o cartão leva `COMMENT_RULES.creatorRepliesShown` (3).
  - `comentarios-e5-ler-contagem.test.ts`: a consulta das respostas leva `.eq('is_creator', true)` além de `is('missing_since', null)`; linha filha `is_creator: false` devolvida pelo dublê não entra; com 5 do criador, corta em 3.
  - `medidas-ler-comentarios.test.ts`: a consulta de comentários leva `.is('parent_id', null)`; com o dublê devolvendo 1.000 linhas filhas e 2 topos, `algumComRespostaDoCriador` segue o `creator_replied` dos topos e a leitura não falha por página.
- [ ] **Passo 2:** rodar os três; esperado FAIL.
- [ ] **Passo 3 (implementar):**
  - `regras.ts`: `creatorRepliesShown: 3` em `COMMENT_RULES`, com comentário "quantas respostas do criador a tela mostra; a coleta guarda até `creatorRepliesMax`. Sobe só com mockup (F2-tela)".
  - `leitor.ts`: o select do vídeo ganha `.or('parent_id.is.null,is_creator.eq.true')`; o agrupamento de `filhos` ignora linha com `parentId !== null && !isCreator` (defesa em memória; acrescentar `is_creator` às colunas se não estiver); a fatia de respostas usa `creatorRepliesShown`.
  - `leitor-contagem.ts`: o passo 2 ganha `.eq('is_creator', true)` e `is_creator` no select; descarta em memória linha com `is_creator !== true`; a fatia usa `creatorRepliesShown`. Com o filtro, o pior bloco é 150 × 5 = 750 < `PAGINA` (1.000), então o bloco de 150 fica.
  - `ler-comentarios.ts`: `.is('parent_id', null)` na consulta (o laço já ignorava filhas; o filtro tira do banco as linhas que agora crescem).
- [ ] **Passo 4:** os três verdes; `npx tsc --noEmit -p apps/web` sem erro novo.
- [ ] **Passo 5 (commit):** `git commit -m "fix: leitores de comentários leem só topo e resposta do criador (F2-coleta, preparo do trem 8b)" -- <os 4 arquivos e os 3 testes>`. Pode ser promovido antes da migration (só leitura).

## Tarefa 2: migration e integração

**Arquivos:** `M/<ts>_observatorio_a5_f2_respostas_de_terceiros.sql` (criar com `npm run db:new observatorio_a5_f2_respostas_de_terceiros`; **nunca** à mão), `I/observatorio-a5-f2-terceiros.test.ts` (novo). **Não rodar** `db:push:prod`.

- [ ] **Passo 1 (testes de integração, vermelho)** em `I/observatorio-a5-f2-terceiros.test.ts`, com os ajudantes de `I/observatorio-a5-e14-migration.test.ts` copiados ou importados (`base`, `grava`, `snapDe`, `topo`, `resp`, `prova`, `comentario`), cada caso no próprio site:
  1. **Compatível:** pacote sem `third_party_replies_max` e com 1 linha `is_creator: false, speaker_no: 2` sob topo com resposta do criador ⇒ terceiro não gravado; resultado igual ao de hoje mais `terceiros_novos: 0`.
  2. **Grava:** `third_party_replies_max: 20`, topo + 1 do criador + 3 terceiros (`speaker_no` 1, 2, 2) ⇒ 3 linhas `is_creator = false` com os números; `competitor_video_comment_authors` sem linha para elas; 1 marca por linha.
  3. **F2 crítico 1:** 4 terceiros já guardados no fio; no marco 7 chega 1 resposta nova do criador ⇒ ela entra (`respostas_novas: 1`).
  4. **Teto:** 6 fios × 4 terceiros (24) ⇒ 20 gravados na ordem do pacote, `terceiros_fora_do_teto: 4`; no marco seguinte, 2 terceiros novos ⇒ 0 gravados (as 20 contam).
  5. **Sem criador presente:** fio sem resposta do criador guardada ⇒ terceiro não entra; fio cuja única resposta do criador tem `missing_since` ⇒ não entra.
  6. **Ausente some (7d-i):** terceiro guardado em `p_missing` ⇒ linha apagada (e as marcas por cascata), `terceiros_apagados: 1`, nenhuma linha nova em `competitor_removed_items`, `comentarios_ausentes_sem_decisao` igual ao de antes.
  7. **Fio sem criador (7d-ii):** a resposta do criador recebe `missing_since` no marco 30 (1ª ausência) ⇒ os terceiros do fio apagados na mesma chamada; prova `respostas_de_terceiros = 0`.
  8. **Checks:** `update ... set speaker_no = 1` num topo ⇒ 23514; insert de terceiro sem `speaker_no` ⇒ 23514; `speaker_no = 0` ⇒ 23514.
  9. **Número congelado:** terceiro guardado com `speaker_no = 2` volta no lote com `speaker_no = 3` ⇒ continua 2; texto e curtidas atualizam.
  10. **Volta de removido:** id de terceiro presente em `competitor_removed_items` não ganha `returned_seen_at`.
  11. **Limites:** `creator_replies_max: 5` aceito e 6 ⇒ 22023; `third_party_replies_max: 21` ⇒ 22023; criador com 5 no prefixo ⇒ 5 gravadas.
  12. **Prova, cada violação conta 1** (forjada por SQL direto, dentro de `begin`/`rollback` e com a constraint desligada onde preciso, como o teste `prova: identidade_de_criador, respostas_de_terceiros...` de `observatorio-a5-e14-migration.test.ts` já faz): terceiro sem `speaker_no`; terceiro com `missing_since`; terceiro em fio cuja resposta do criador foi marcada ausente por `update` direto; 21 terceiros num vídeo (conta 1, o excesso); linha de identidade presa a um terceiro. Tudo gravado pela função ⇒ 0.
  13. **Apagar pelo dono:** `competitor_comments_purge` de um topo ausente leva os terceiros do fio por cascata e os conta em `rows_deleted`.
- [ ] **Passo 2:** `npm run db:new observatorio_a5_f2_respostas_de_terceiros`, aplicar no banco de integração e rodar: `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run I/observatorio-a5-f2-terceiros.test.ts > /tmp/f2-t2.txt 2>&1`; esperado FAIL antes do corpo.
- [ ] **Passo 3 (escrever a migration).** Cabeçalho com dependência e idempotência:

```sql
-- A5 · F2-coleta (emenda 17/10 ao spec 02 §4.6.3 item 7, decisão do dono 17/10): respostas de espectadores em fio com
-- resposta do criador, até 20 por vídeo, numeradas por fio (speaker_no), sem identidade. Recria apply_competitor_comment_snap
-- e competitor_comment_health com a MESMA assinatura. Idempotente: add column if not exists, drop constraint if exists,
-- create or replace function. Caminho de volta: ver o plano (Tarefa 2, "Volta").
do $$ begin
  if to_regprocedure('public.apply_competitor_comment_snap(uuid,smallint,jsonb,jsonb,text[])') is null
     or to_regprocedure('public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)') is null then
    raise exception 'F2-coleta depende da MG8 (20261013000003)';
  end if;
end $$;

alter table public.competitor_video_comments add column if not exists speaker_no smallint;
alter table public.competitor_video_comments drop constraint if exists competitor_video_comments_reply_check;
alter table public.competitor_video_comments add constraint competitor_video_comments_reply_check
  check (parent_id is null or is_creator or speaker_no is not null);
alter table public.competitor_video_comments drop constraint if exists competitor_video_comments_speaker_check;
alter table public.competitor_video_comments add constraint competitor_video_comments_speaker_check
  check (speaker_no is null or (parent_id is not null and not is_creator and speaker_no >= 1));
comment on column public.competitor_video_comments.parent_id is 'Nulo = topo. Preenchido = resposta: do criador (is_creator) ou, desde a F2-coleta (17/10), de espectador em fio com resposta do criador presente, com speaker_no e SEM identidade.';
comment on column public.competitor_video_comments.speaker_no is 'F2-coleta: "Espectador N" dentro do fio, numerado na coleta e congelado. 1 = autor do topo quando não é o criador. Nunca há chave, nome nem id de canal guardado.';
```

  **`apply_competitor_comment_snap`:** copiar o corpo inteiro de `20261013000003` (seção 5, do `create or replace function` ao `end $$;`) e aplicar só estes deltas, cada um com comentário `-- F2:`:
  - **D1, declarações:** `v_third_max integer := coalesce((p_snap->>'third_party_replies_max')::integer, 0);` e os contadores `v_terc_novos`, `v_terc_atualizados`, `v_terc_apagados`, `v_terc_fora integer := 0`. Validação junto das outras: `if v_replies_max < 1 or v_replies_max > 5 then raise exception 'creator_replies_max fora de 1 a 5' using errcode = '22023'; end if;` e o mesmo para `v_third_max` fora de 0 a 20.
  - **D2, `returned_seen_at`:** o `ids` só pega topo e resposta do criador: `where x->>'parent_youtube_id' is null or (x->>'is_creator')::boolean is true`.
  - **D3, passo (c):** passa a atualizar resposta já guardada de qualquer autor: filtro `x.is_creator is not null` (no lugar de `is true`) e, no `where` do update, `and c.is_creator = i.is_creator` (nunca troca o lado). `speaker_no` **não** está no `set`. O `select` final separa: `count(*) filter (where is_creator)` soma em `v_resp_atualizadas`, o resto em `v_terc_atualizados`.
  - **D4, passo (d):** `ja` = `count(*) ... where k.parent_id = p.id and k.is_creator`.
  - **D5, passo (f) novo, logo depois do (d)** (o (d) já gravou a resposta do criador nova deste retrato):

```sql
  -- (f) F2: respostas de ESPECTADORES novas, só em fio com resposta do criador presente, até v_third_max por vídeo
  --     (as já guardadas contam), na ordem do pacote. Nunca identidade; speaker_no vem da coleta e congela.
  with inp as (
    select x.*, t.ord
      from jsonb_array_elements(v_comments) with ordinality as t(j, ord)
      cross join lateral jsonb_to_record(t.j) as x(
        youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
        published_at timestamptz, edited_at timestamptz, is_creator boolean, likes integer, speaker_no smallint)
     where v_third_max > 0
       and x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is false
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null and x.likes is not null
       and x.speaker_no is not null and x.speaker_no >= 1
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id in (x.youtube_comment_id, x.parent_youtube_id))
       and not exists (select 1 from public.competitor_video_comments k
                        where k.video_id = p_video and k.youtube_comment_id = x.youtube_comment_id)
  ), par as (
    select p.id as parent_id, p.youtube_comment_id
      from public.competitor_video_comments p
     where p.video_id = p_video and p.parent_id is null
       and exists (select 1 from public.competitor_video_comments k
                    where k.parent_id = p.id and k.is_creator and k.missing_since is null)
  ), ja as (
    select count(*) as n from public.competitor_video_comments k
     where k.video_id = p_video and k.parent_id is not null and not k.is_creator
  ), novo as (
    select i.*, par.parent_id, row_number() over (order by i.ord) as rn
      from inp i join par on par.youtube_comment_id = i.parent_youtube_id
  ), ins as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, speaker_no, last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, n.youtube_comment_id, n.parent_id, n.body, coalesce(n.body_truncated, false), n.published_at,
           n.edited_at, false, n.speaker_no, v_taken, v_taken, v_taken
      from novo n cross join ja
     where n.rn + ja.n <= v_third_max
    on conflict (video_id, youtube_comment_id) do nothing
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select s.id, p_mark, v_site, n.likes, null, null, null
      from ins s join novo n on n.youtube_comment_id = s.youtube_comment_id
    on conflict (comment_id, mark) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from mk), (select count(*) from novo) into n1, n2, n3;
  v_terc_novos := n1; v_leituras := v_leituras + n2; v_terc_fora := n3 - n1;
```

  - **D6, passo (e):** antes do `update` de ausência, `delete from public.competitor_video_comments c where c.video_id = p_video and c.parent_id is not null and not c.is_creator and c.youtube_comment_id = any(coalesce(p_missing, '{}')) and c.youtube_comment_id not in (select yid from seen where yid is not null)` (o `seen` vira CTE própria ou se repete), somando em `v_terc_apagados`; o `update` de hoje ganha `and (c.parent_id is null or c.is_creator)`.
  - **D7, passo (g) novo, depois do (e):** `delete from public.competitor_video_comments t where t.video_id = p_video and t.parent_id is not null and not t.is_creator and not exists (select 1 from public.competitor_video_comments k where k.parent_id = t.parent_id and k.is_creator and k.missing_since is null)`, somando em `v_terc_apagados`.
  - **D8, retorno:** `v_ignorados := v_recebidos - (v_novos + v_atualizados + v_por_id + v_resp_novas + v_resp_atualizadas + v_terc_novos + v_terc_atualizados + v_terc_fora)`; o JSON ganha `terceiros_novos`, `terceiros_atualizados`, `terceiros_apagados`, `terceiros_fora_do_teto`. O comentário de cabeçalho da função (`p_snap`, `p_comments`) ganha `third_party_replies_max (padrão 0)` e `speaker_no`.

  **`competitor_comment_health`:** copiar a função inteira de `20261013000003` (seção 8) e trocar **só** o valor de `'respostas_de_terceiros'` (a chave não muda; o teste de `observatorio-a5-e14-migration.test.ts:596` confere o conjunto de chaves):

```sql
    'respostas_de_terceiros', (
      -- F2 (17/10): conta o que está FORA da regra (7f), não as respostas de espectador em si
      (select count(*) from public.competitor_video_comments t
        where (p_site_id is null or t.site_id = p_site_id) and t.parent_id is not null and not t.is_creator
          and (t.speaker_no is null or t.missing_since is not null
               or not exists (select 1 from public.competitor_video_comments k
                               where k.parent_id = t.parent_id and k.is_creator and k.missing_since is null)))
      + (select coalesce(sum(x.n - 20), 0)::bigint
           from (select t.video_id, count(*) as n from public.competitor_video_comments t
                  where (p_site_id is null or t.site_id = p_site_id) and t.parent_id is not null and not t.is_creator
                  group by t.video_id having count(*) > 20) x)
      + (select count(*) from public.competitor_video_comment_authors a
           join public.competitor_video_comments c on c.id = a.comment_id
          where (p_site_id is null or a.site_id = p_site_id) and c.parent_id is not null and not c.is_creator)),
```

  O `20` daqui e o teto máximo de D1 são o `COMMENT_RULES.thirdPartyRepliesMax`; a Tarefa 3 acrescenta o teste que confere os dois no texto da migration. Grants: `create or replace` mantém os de hoje; conferir no teste que `anon` continua sem `execute` (padrão de `20261014000007`).
- [ ] **Passo 4:** integração verde; rodar também `I/observatorio-a5-e14-migration.test.ts`, `I/observatorio-a5-e14-rls.test.ts` e `I/observatorio-a5-e9-migration.test.ts` (saída em arquivo; só falhas no contexto). Esperado: verdes sem mudar os testes antigos. Se o teste `prova: identidade_de_criador, respostas_de_terceiros...` falhar, ler antes de mexer: a resposta forjada sem `speaker_no` continua contando 1 pela regra nova.
- [ ] **Passo 5, export (só conferir):** a migration acrescenta coluna a uma tabela exportada (`obs_archive_registry`, linha de `competitor_video_comments`). `grep -rn "competitor_video_comments" apps/web/src/lib/youtube/observatorio/arquivo* scripts 2>/dev/null` e os testes do arquivo (`npx vitest run T/../arquivo` ou o nome que existir). Se a recarga (`comandos-recarga`) usar `\copy` sem lista de colunas, registrar no relatório que arquivo antigo tem uma coluna a menos e que a recarga precisa de lista explícita; **não** consertar aqui sem o Yannis.
- [ ] **Passo 6 (commit):** `git commit --no-verify -m "feat: migration da F2-coleta (respostas de espectadores com speaker_no, sem identidade), não aplicada" -- <migration> I/observatorio-a5-f2-terceiros.test.ts`. (`--no-verify` só se o hook falhar por arquivo de outro terminal; senão sem.)

**Volta (escrita, não executada):** contar e anotar `select count(*) from competitor_video_comments where parent_id is not null and not is_creator;`; depois `delete from public.competitor_video_comments where parent_id is not null and not is_creator;` (marcas caem em cascata; o número apagado tem de ser o anotado); recriar as duas funções a partir do texto de `20261013000003`; `alter table ... drop constraint competitor_video_comments_speaker_check; alter table ... drop constraint competitor_video_comments_reply_check; alter table ... add constraint competitor_video_comments_reply_check check (parent_id is null or is_creator); alter table ... drop column speaker_no;`. Vai numa migration nova (via `db:new`), nunca editando a aplicada. Reverter o código da coleta antes ou junto.

## Tarefa 3: regras, tipos e normalização

**Arquivos:** `L/regras.ts`, `L/tipos.ts`, `L/normalizar.ts`. Testes: `T/comentarios-regras.test.ts`, `T/comentarios-normalizar.test.ts`.

- [ ] **Passo 1 (testes, vermelho):**
  - `comentarios-regras.test.ts`: `creatorRepliesMax === 5`, `thirdPartyRepliesMax === 20`, `version === 2`, `creatorRepliesShown === 3`; `ruleParams()` traz `creator_replies_max: 5` e `third_party_replies_max: 20`; `WORST_SNAP_MS` e `WORST_END_FROM_T0_MS` iguais aos de antes (nenhuma chamada nova). Teste de texto da migration: o arquivo `*_observatorio_a5_f2_respostas_de_terceiros.sql` contém `> 20` no limite de D1 e `count(*) > 20` na prova, e os dois são `COMMENT_RULES.thirdPartyRepliesMax` (regex; quebra se alguém mudar um lado só).
  - `comentarios-normalizar.test.ts`: (a) fio com 2 do criador e 3 de terceiros ⇒ `respostasDeTerceiros` com os 3, da mais antiga para a mais nova, cada um com `autorCanalId` (só em memória); (b) fio sem resposta do criador vista ⇒ `respostasDeTerceiros: []` (não carrega terceiro sem finalidade); (c) 5 do criador ⇒ `respostasDoCriador.length === 5`; (d) resposta sem `authorChannelId` entra em `respostasDeTerceiros` com `autorCanalId: null`; (e) `agregadosDoLote` ganha `prefixos_fora_de_ordem`: conta fios cujas respostas vieram fora da ordem de `publishedAt` (Phil §8: se a C0.3 deixar de valer, a contagem acusa).
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3 (implementar):** `regras.ts`: `version: 2`, `creatorRepliesMax: 5`, `thirdPartyRepliesMax: 20`; `ruleParams` com `third_party_replies_max`. `tipos.ts`: `Conversa.respostasDeTerceiros: RespostaVista[]`; `AgregadosDoLote.prefixos_fora_de_ordem: number`. `normalizar.ts` (no trecho de `doCriadorTodas`): `respostasDeTerceiros` = vistas que não são do criador, ordenadas por `publicadoEm` e índice, **só** quando `doCriadorTodas.length > 0`; o comentário do topo do arquivo passa a dizer "as respostas de terceiros só deixam aqui o id do canal (para destaque e para numerar em `espectadores.ts`) e, em fio com resposta do criador, o texto". O pacote ainda não manda terceiros (Tarefa 5), então este commit não muda o que é gravado.
- [ ] **Passo 4:** verdes; `tsc` limpo (fixtures de `Conversa` em `T/comentarios-fixtures.ts` ganham `respostasDeTerceiros: []`).
- [ ] **Passo 5 (commit):** `git commit -m "feat: regras v2 e respostas de terceiros na normalização (F2-coleta, ainda sem gravar)" -- <arquivos>`.

## Tarefa 4: numeração dos espectadores

**Arquivos:** criar `L/espectadores.ts`. Teste: `T/comentarios-espectadores.test.ts` (novo, `// @vitest-environment node`).

- [ ] **Passo 1 (testes, vermelho)** para `numerarEspectadores(c: Conversa, canalDoVideo: string, guardados: ReadonlyMap<string, number>, maiorGuardado: number): Array<{ id: string; speakerNo: number }>` (`guardados`: id de resposta de terceiro já gravada → `speaker_no`; `maiorGuardado`: maior `speaker_no` do fio no banco, 0 se nenhum):
  1. topo de espectador, respostas A, B, A ⇒ A = 2, B = 3, A de novo = 2.
  2. resposta do autor do topo ⇒ 1.
  3. topo do criador (`doCriador`) ⇒ o primeiro espectador é 1.
  4. resposta sem `autorCanalId` ⇒ número novo, cada uma o seu.
  5. marco 7: A já gravado com 4 (vem em `guardados`), A responde de novo ⇒ 4; pessoa nova ⇒ `max(maiorGuardado, base) + 1`, mesmo que o maior guardado não tenha vindo no lote.
  6. resposta já gravada devolve o número guardado, nunca um novo.
  7. a saída tem só `id` e `speakerNo` (`Object.keys` exatos) e é a mesma para a mesma entrada embaralhada em ordem de chegada igual (determinística).
  8. resposta do criador nunca aparece na saída.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar puro (sem banco, rede, relógio, log). Comentário do arquivo: "o `authorChannelId` entra e não sai; nada daqui vai a log, erro nem Sentry".
- [ ] **Passo 4:** verde. **Passo 5 (commit):** `git commit -m "feat: numeração dos espectadores por fio, sem chave guardada (F2-coleta)" -- L/espectadores.ts T/comentarios-espectadores.test.ts`.

## Tarefa 5: o pacote grava terceiros

**Arquivos:** `L/gravar.ts`. Teste: `T/comentarios-gravar.test.ts`.

- [ ] **Passo 1 (testes, vermelho):**
  - `lerGuardados`: o select passa a `id, youtube_comment_id, parent_id, is_creator, speaker_no`; devolve `{ id, youtubeId, topo, paiId, isCreator, speakerNo }`; `speaker_no` não inteiro positivo nem nulo ⇒ nulo (linha ilegível); a página cheia continua lançando.
  - `montarPacote` com `guardados` e `speakers` (o mapa calculado na Tarefa 6): (a) escolhido com resposta do criador e 3 terceiros ⇒ 3 linhas com as chaves **exatas** `youtube_comment_id, parent_youtube_id, via, body, body_truncated, published_at, edited_at, is_creator (false), likes, speaker_no`; nenhuma linha de resposta tem `author`; (b) fio sem resposta do criador ⇒ nenhuma linha de terceiro; (c) já guardado vindo no lote sem ser escolhido ⇒ terceiros dele também saem; (d) **LGPD:** fixture com `authorDisplayName`, `authorChannelId` e `authorProfileImageUrl` sentinelas nas respostas de terceiros ⇒ `JSON.stringify(pacote)` não contém nenhuma das três; (e) snap traz `creator_replies_max: 5`, `third_party_replies_max: 20`, `rule_version: 2`; (f) terceiro sem número no mapa não sai (defeito nosso; conta como `inesperado` na Tarefa 6, nunca vai sem número).
  - `resultadoDe`: aceita `terceiros_novos`, `terceiros_atualizados`, `terceiros_apagados`, `terceiros_fora_do_teto` (inteiros ≥ 0) e continua aceitando resultado sem eles (função antiga).
- [ ] **Passo 2:** FAIL. **Passo 3 (implementar):** `respostaDeTerceiro(r, paiId, speakerNo)` ao lado de `respostaDoCriador`, sem `author`; `respostasDe(c)` emite as do criador e, se houve ao menos uma do criador no fio, as de terceiros com número; `snap.third_party_replies_max = r.thirdPartyRepliesMax`; o tipo `Guardado` exportado daqui (o `coletar.ts` hoje tem um local) e as 4 contagens novas em `CONTAGENS_GRAVACAO`.
- [ ] **Passo 4:** verde. **Passo 5:** commit junto com a Tarefa 6 (o `coletar.ts` lê o tipo novo de `lerGuardados`; sozinho o `tsc` quebra).

## Tarefa 6: a coleta liga tudo

**Arquivos:** `L/coletar.ts`, `L/frases.ts`. Testes: `T/comentarios-coletar.test.ts`, `T/comentarios-regras.test.ts` (frases).

- [ ] **Passo 1 (testes, vermelho):**
  - Marco 7 com 2 terceiros guardados que voltam no lote ⇒ **nenhuma** chamada `porId` para eles (o dublê de API conta chamadas) e `conferencias_nao_feitas` igual ao de antes (7e, F2 crítico 3).
  - Marco 1 (sem guardados) ⇒ a numeração é chamada com mapa vazio; marco 7 ⇒ com os `speaker_no` lidos por `lerGuardados` do fio certo (casar `paiId` do guardado com o `id` do topo guardado).
  - Pior caso de tempo: nenhuma ida nova ao banco nem à API por retrato (`dbPerSnapMax` e `callsPerSnapMax` iguais).
  - `frases.ts`: `identidade_invariante` diz `respostas de espectadores fora da regra: ${K}` (e não "respostas de terceiros"), mantendo as regras de forma de `FRASES_FIXAS`.
- [ ] **Passo 2:** FAIL. **Passo 3 (implementar):** no bloco "8. marcos 7 e 30", `vistos` recebe também `c.respostasDeTerceiros` de cada conversa do lote. Antes de `montarPacote`, para cada conversa que vai no pacote (escolhidos e guardados no lote) e tem resposta do criador, `numerarEspectadores(...)` com os guardados daquele fio; o resultado vai em `speakers` (mapa id → número). No marco 1 `lerGuardados` não é chamado hoje (`storedN > 0`): manter assim; mapa vazio. O texto de `frases.ts` muda só na parte "respostas de terceiros".
- [ ] **Passo 4:** `npx vitest run T/comentarios-*.test.ts T/observatorio-a5-e14-*.test.ts > /tmp/f2-t6.txt 2>&1; grep -E 'FAIL|✗|Error' /tmp/f2-t6.txt` vazio; `tsc` limpo.
- [ ] **Passo 5 (commit T5+T6):** `git commit -m "feat: coleta grava respostas de espectadores em fio com o criador, até 20 por vídeo (F2-coleta, trem 8b)" -- L/gravar.ts L/coletar.ts L/frases.ts <testes>`.

## Tarefa 7: varredura de LGPD

**Arquivo:** `T/comentarios-varredura.test.ts` (acrescentar no fim, seguindo o molde: lista não vazia + exemplo ruim que o detector acha).

- [ ] **Passo 1:** **varredura 6**: (a) em `L/gravar.ts`, o corpo de `respostaDeTerceiro` não cita `author`, `display_name`, `channel_id`, `avatar_url` nem `autorCanalId`; (b) `autorCanalId` só aparece em `L/normalizar.ts`, `L/destaque.ts`, `L/espectadores.ts`, `L/tipos.ts` e `L/coletar.ts` (nunca em `gravar.ts`, `relato.ts`, leitores nem fora de `L/`); (c) nenhum arquivo fora de `L/` cita `speaker_no` (só a migration, os testes e, na F2-tela, o leitor novo; a lista é a allowance e muda com a tela). Exemplo ruim embutido para cada uma.
- [ ] **Passo 2:** verde contra o código das Tarefas 5 e 6; vermelho contra o exemplo ruim.
- [ ] **Passo 3 (commit):** `git commit -m "test: varredura de LGPD das respostas de espectadores (F2-coleta)" -- T/comentarios-varredura.test.ts`.

## Tarefa 8: subida, comando do dono e conferências

**Ordem (trem 8b):**
1. Tarefa 1 em main (pode ir antes de tudo; só leitura). Conferir CI do push.
2. Portão de Phil e Yannis sobre o código das Tarefas 2 a 7 (acordo antes de seguir).
3. **Dono aplica a migration** (comando abaixo). Logo depois, conferência **P0**.
4. Push das Tarefas 3 a 7 para staging, CI verde, promoção para main. Primeira coleta no dia seguinte às 13:00 de São Paulo.

**Comando do dono.** O executor cria `.superpowers/sdd/a5/comandos/f2-coleta-db-push.sh` com o caminho do checkout que tem a migration da Tarefa 2 em `REPO`:

```bash
#!/usr/bin/env bash
# F2-coleta: aplica a migration das respostas de espectadores (decisão do dono 17/10). Pede YES no fim.
set -euo pipefail
REPO="<checkout com a migration da Tarefa 2>"
cd "$REPO"
ls supabase/migrations/*_observatorio_a5_f2_respostas_de_terceiros.sql >/dev/null || { echo "migration da F2 ausente neste checkout"; exit 1; }
npm run db:which
npx supabase migration list --linked | tail -5
npm run db:push:prod
```

A mensagem ao dono leva só a linha, num bloco, sem `pbcopy`: `bash .superpowers/sdd/a5/comandos/f2-coleta-db-push.sh`. Se `migration list` mostrar outra migration pendente além da F2, o script continua mostrando; o dono para e avisa (não confirmar YES).

**Conferências (anotar no ledger da A5 com data; quem roda leitura em produção é o dono ou o controlador com `supabase db query --linked`, nunca o executor):**

| Quando | Consulta | Esperado |
|---|---|---|
| **P0**, logo após o `db:push` | `select column_name from information_schema.columns where table_name = 'competitor_video_comments' and column_name = 'speaker_no';` e `select conname from pg_constraint where conname in ('competitor_video_comments_reply_check','competitor_video_comments_speaker_check');` | 1 linha; 2 linhas |
| P0 | `select (public.competitor_comment_health(null, now(), '[{"mark":1,"from_h":24,"until_h":72},{"mark":7,"from_h":168,"until_h":240},{"mark":30,"from_h":720,"until_h":888}]'::jsonb, 28, interval '30 hours'))->>'respostas_de_terceiros';` | `0` (nenhum terceiro ainda; prova verde com o código antigo) |
| P0 | última execução de `retratos_comentarios` na agenda (antes do código novo) | `status` como antes; `nao_gravados` 0 |
| **D+1** do código, depois do 1º retrato | `select count(*) from competitor_video_comments where parent_id is not null and not is_creator and speaker_no is null;` | `0` |
| D+1 | `select count(*) from competitor_video_comment_authors a join competitor_video_comments c on c.id = a.comment_id where c.parent_id is not null and not c.is_creator;` | `0` (nenhuma identidade de espectador) |
| D+1 | `select count(*) from competitor_video_comments where parent_id is not null and not is_creator;` | maior que 0 se houve fio com o criador no dia; se 0, conferir `terceiros_fora_do_teto` e `respostas_novas` da execução antes de dizer "ok" (falha em verde) |
| D+1 | a prova (`respostas_de_terceiros`) e `numeros.conferencias_nao_feitas` da execução | `0` e `0` |
| **D+8** (1º marco 7 com terceiros) | `unidades` por retrato da execução contra a média dos 7 dias anteriores | igual ± 1 |
| D+8 | `select video_id, count(*) from competitor_video_comments where parent_id is not null and not is_creator group by 1 order by 2 desc limit 5;` | máximo ≤ 20 |
| D+8 | `select sum((pool_stats->>'prefixos_fora_de_ordem')::int) from competitor_video_comment_snaps where taken_at > now() - interval '7 days';` | `0`; acima de 0, a premissa "as 5 mais antigas" não vale sempre: avisar antes da F2-tela |
| **D+30** | linhas de terceiros por vídeo (média) e tamanho: `select count(*) * 1.0 / count(distinct video_id), pg_size_pretty(sum(pg_column_size(body))) from competitor_video_comments where parent_id is not null and not is_creator;` | troca a estimativa de 0,67 MB por canal por ano pelo medido (spec 06 §9.5) |

D+7 com dado real é também o gatilho da F2-tela (decisão do dono: depois da revisão visual final, mockup novo aprovado, ≥ 7 dias de dados).

## Riscos

- **Preview antigo do Vercel** (deploy anterior à Tarefa 1) leria terceiro como resposta do criador se aberto depois da coleta ligada. Mitigação: a Tarefa 1 sobe dias antes da coleta; os previews do CMS pedem login. Resíduo aceito, a confirmar com Yannis.
- **Premissa das "5 mais antigas"** vem de uma medição (C0.3, 100 conversas), não da documentação. `prefixos_fora_de_ordem` acusa; a F2-tela não afirma "as mais antigas" sem ela em 0.
- **Numeração imperfeita** quando uma fala guardada sai do prefixo e a mesma pessoa fala de novo: número novo. Dito no spec (7c).
- **`comentarios_total` da prova** passa a incluir terceiros. Nada fica vermelho por isso; quem lê o número no ⓘ deve saber.
- **Export:** coluna nova numa tabela exportada (Tarefa 2, passo 5).

## Pergunta em aberto (com recomendação)

- **A tela passa a mostrar até 5 respostas do criador?** A coleta guarda até 5 desde a Tarefa 3. **Recomendação minha e da Hanna (`t7-hanna.md`: tela depois): não agora**; os leitores mostram 3 (`creatorRepliesShown`), sem rodada do Gio no trem 8b. Custo: a 4ª e a 5ª resposta do criador ficam guardadas e invisíveis até a F2-tela. Lado contrário: subir para 5 já no 8b exercita o "Ver as outras" do trem 8 (dívida D3) com dado real, ao custo de uma rodada do Gio e de mexer na tela no trem que era só coleta.

## Dívida declarada

- As quatro regras do "k de N" (F4) e `reply_count` nulo no caminho por id ficam para a F2-tela.
- `competitor_comments_preview` e a fila "Saíram do YouTube" não sabem de terceiros (eles nunca ficam ausentes; a prova cobre).
