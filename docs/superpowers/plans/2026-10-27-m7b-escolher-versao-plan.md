# M7b — Escolher qualquer versão num teste concluído: plano de implementação (r3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

## Changelog r2 → r3 (27/10, re-revisão: Phil 86, Yannis 86)

Sem mudança de arquitetura; emendas de texto e de arquivos listados. Onde os dois apontaram o mesmo ponto, um conserto só.

- **Gatilho `tg_ab_tests_restore_log` (T1; Phil N2 + Yannis N3).** Copiar com `case when v ->> 'iniciativa' = 'dono' then 'dono' end` no `insert` e no `do update set`, mantendo `security definer` e `set search_path = ''`. Teste de `prosecdef`/`proconfig`, caso `iniciativa: 'x'` e a guarda P4a. Conferência em produção no dia do `db:push:prod`.
- **E18 e `escolha` (T4; Phil N1 + Yannis N2).** `versoes-step.ts` seleciona `iniciativa` (`COLUNAS_RESTAUROS`) e o mapeador copia; `RestauroAb.iniciativa`. Regra única: `escolha` só quando `iniciativa = 'dono'` **e** o destino é diferente do vencedor gravado **e** não é `'original'` (R2 `restauro` vem antes; `aplicar_sugerido` e escolha = sugerida seguem `vencedor`). Também `tipos.ts`, `ler.ts:179` (`titulosAntesDoTeste`), `trocas-model.ts`. Nome do CHECK verificado: `yt_own_video_versions_ab_event_check`.
- **`daEscolhaDoDono` (T4; Yannis N1).** Predicado único exportado de `ab-restore.ts`, usado em todos os chamadores de `camposPendentes('humano')` (lista de arquivos na T4).
- **`lido_misto` (T6/T9; Phil N3)** e **guarda de site na `conferirNoAr` (T6; Phil N4)**.
- **Consumidores de `perdido` (T4; Yannis N5)**; **desempate `campo` e deduplicação por `(campo, em, destino, estado)` (T12/T2; Phil N5 + Yannis N6)**; **`add constraint … not valid` + `validate` (T1; Phil N6)**; **testes (c)/(d) com `supabase_auth_admin` (T1; Yannis N4)**; **faixa da escolha falhada não some (T18; Phil N7)**.
- **P2 e T19:** a pergunta ganha "Manter a original com sugerida = original sobe o getLearnings em 1"; a T19 ganha um terceiro teste descartável para esse caso.

## Changelog r1 → r2 (27/10, 1ª revisão: Phil 66, Yannis 68, Hanna 76)

Aplicados todos os bloqueantes e importantes. Onde dois revisores pediam o mesmo, está unido num conserto só.

- **Migration (T1).** Gatilho `security invoker` e sem `auth.role()` (o `security definer` nunca recusava: `current_user` virava `postgres`). Vale também no INSERT. Teste de integração rodando como `authenticated` (Phil C1 + Yannis C1). Mais: coluna `iniciativa` em `ab_test_restores` e `'escolha'` no CHECK de `ab_event` (I5 do Phil).
- **Marca da iniciativa do dono (T4).** Campo novo `iniciativa: 'dono'` em `CampoRestauracao`, gravado **já no claim**, copiado em `montarCampo`, no interrompido e na nova tentativa; o vigia o ignora e para de gastar leitura com ele (Phil C4 + Yannis C2). **Divergência:** Phil queria reaproveitar `motivo: 'escolha_do_dono'`; Yannis, um campo novo. Escolhi o campo novo, porque `motivo` já tem dono semântico (`tres_falhas`, `novo_teste`, `destino_invalido`, `sem_base_de_comparacao`) e o `proximoDoVigia` o sobrescreve. O CHECK de `restore_status` só limita as chaves de topo (conferido em `20261018000004`), então não exige migration; o Zod `Campo` de `ab-restore.ts` precisa da chave nova, senão a descarta.
- **"Tentar de novo" (T4/T11).** **Divergência:** Phil mantinha o retry humano da faixa; Yannis (I1) manda a `novaTentativa` recusar campo com `iniciativa: 'dono'`, porque ela grava `winner_applied_at` e chama `autoImportWinner`. Escolhi Yannis: o painel é o único caminho de nova tentativa de uma escolha (via `escolherVersao` com o `restoreSeq` novo); o "Já corrigi no YouTube" da faixa continua.
- **`noArConfirmado` (T2).** Cálculo por campo; tipo novo `misto`; só vale o histórico a partir de `completed_at - 120 s`; `pulado_drift` e `pulado_teste_youtube` dão `desconhecido`; `'original'` mapeia para a variante original; `em_andamento` dá `desconhecido` (Phil C2/I2/I3 + Yannis I2). Forma do `misto`: `porCampo` parcial.
- **Conferência (T6/T9).** Miniatura relida a menos de 3 h da tentativa `escreveu:null` e igual à anterior dá `nao_propagou`, nunca `recusou` (Phil C3). Vídeo apagado ou comparação parcial dá `sem_leitura`, nunca `nenhuma_versao` (Phil I7). Redutor total: `envioId`, `falha_rede`, resposta tardia, terceira versão, teto de 5 leituras ou 45 s (Yannis I5).
- **Contrato da escolha (T4/T5).** Sugerida = original pelo caminho de escrita grava o vencedor (Yannis C3); resultado `perdido` e exceção depois do claim viram `incerto` (I3); `feito` devolve o `seq` (I4); `recusou` leva `porque` (I9); destino já no ar que não bate com a escolha grava a escolha (I10); `user.siteId` tem de bater com o site da tela (I11); `reverter` ok grava a escolha=original e `escolher` ok zera `revert_expires_at` (Phil I4 + Yannis I8).
- **Leitura dos restores (T12).** **Divergência:** Phil queria limitar aos ids usados; Yannis, paginar. Fiz os dois: só os visíveis (`CONCLUIDOS_VISIVEIS`) mais os do "Com você", e `lotes`+`paginar` para nunca truncar em silêncio. CTR (dias) lido para todo visível com painel (Yannis I6).
- **Fatiamento (Hanna).** Envio 1 = T1 + T15a (D18) + T15c (D20) + título do D19. Envio 2 = o resto, incluindo T15, a remoção da faixa, T16 e T17–T19. **Não há envio 3.** A T19 é o "pronto" do envio 2; o dono não é mandado ao painel antes do ok do Gio.
- **T7a nova (Hanna C3).** O Logan escreve, antes da T8, os 5 textos que o mockup não cobre e os textos derivados dos achados.
- **Menores aplicados:** `repeats: 20` no lugar de `--repeat`, com a corrida reproduzida (Yannis M1); regra do título no cabeçalho (M2); id do YouTube vem de `view.youtubeVideoId` (M3); `bloqueio` por tipo (M4); concorrência também em integração (M5); T18 cobre T9 e T12 (M6); `updated_at` no "Manter" (Phil M2); teto da espera `escrevendo` (M3); `escolha_por` nunca em log, Sentry nem MCP (M4); prova em produção com valores esperados corrigidos (I8); conferir o número da migration de novo antes do push (I9).
- **Seção Riscos e perguntas ao dono** unidas no fim, com a recomendação da Hanna e o custo de cada lado. Nada decidido por ele.

**Objetivo:** num teste concluído da regra v2, o dono deixa qualquer versão no ar (A, B, C…), sem prazo, com um verbo só: "Deixar X no ar". Se a original já está no ar, "Manter a original (A)" grava a escolha sem escrever no YouTube e tira o teste da lista do que espera o dono. A escolha do dono fica separada do vencedor estatístico: `winner_variant_id` e `getLearnings` não mudam por causa dela. Não há diálogo de confirmação; o bloco "Sai / Entra" aparece dentro do painel. Uma escrita que falha ou fica sem resposta passa por uma conferência que relê o que está no ar, e o sistema nunca repete a troca sozinho.

**Arquitetura:**
- Uma migration com 3 colunas de escolha em `ab_tests`, um gatilho de guarda (`security invoker`), a coluna `iniciativa` em `ab_test_restores` e o valor `'escolha'` em `ab_event`.
- Um motivo novo, `escolher`, no `settleOnAir`, pelo mesmo `ab_settle_claim` e pela mesma CAS de `restore_seq`. Nenhuma escrita corre em paralelo.
- Uma action de escrita (`escolherVersao`) e uma de leitura (`conferirNoAr`).
- Uma função pura única diz o que está no ar (`noArConfirmado`). O painel, a `tela-v2`, os Concluídos, o cabeçalho do detalhe e o MCP usam todos essa função.
- O modelo e as fases do painel ficam em módulos puros; o componente só desenha.

**Stack:** Next.js 16 (server actions), React 19, TS strict, Tailwind 4 + `cms-*`, Zod, Vitest + Testing Library, Supabase (cliente de serviço só no servidor).

**Spec (o executor lê):**
- Mockup aprovado em 27/10: `docs/superpowers/mockups/2026-10-27-m7b-escolher-versao/index.html`. Abrir com `?estado=<a|b|c|d|e|f|f2|g2|i|d2|d3a|d3b|d3c|k|k2|j|h>&largura=<1440|390>`. A caixa "Decisões do controlador (r1 a r4)" vale como spec.
- Decisões: `.superpowers/sdd/ab-lab/m7b/` (`sintese-r2.md`, `logan-r2.md`, `naksu-r2.md`, `logan-mockup-r4.md`, `naksu-mockup-r4.md`, `logan-alturas.md`, `naksu-alturas.md`), no checkout principal. Textos fora do mockup: `logan-textos-fora-do-mockup.md` (T7a).
- D15 a D20: `.superpowers/sdd/ab-lab/lab-reordem/envio2/dividas-envio2.md`, no checkout principal.
- Revisões do plano r1: `phil-plano-r1.md`, `yannis-plano-r1.md`, `hanna-plano-r1.md`, na mesma pasta `m7b/`.

## O que o planejador achou no código (base deste plano)

1. **O `aplicarSugerido` já mexe no vencedor.** O caminho `aplicar_sugerido` grava `completed_reason='manual_winner'` e `winner_variant_id` com a sugerida (`ab-settle.ts` `caminhoDe`, `actions.ts:1284`). Isso não contamina nada, porque a sugerida é o próprio vencedor estatístico. Regra a partir daqui: **`winner_variant_id` só recebe `result_metadata.v2.vencedor_sugerido`, nunca outra versão.** Escolher C, ou voltar a A, não toca no vencedor, e o `getLearnings` (`queries.ts:677`) conta os mesmos testes de hoje.
2. **Hoje "o que está no ar" sai do vencedor.** A `tela-v2.ts:160-176` deduz `noAr` de `winner_variant_id` + `winner_applied_at`. Com C escolhida e o vencedor parado em B, a tela mentiria. Ela passa a usar a fonte nova (T7).
3. **O vigia repete sozinho os campos `falhou` de qualquer teste que não está ativo** (`ab-watchdog-nova-tentativa.ts:64-67`, `camposPendentes('vigia')`). Uma escolha que falhou entraria horas depois, contra o texto aprovado ("Não repetimos a troca sozinhos", "B continua no ar"). Conserto na T4: o campo leva `iniciativa: 'dono'` desde o claim, e o vigia o ignora. O "Tentar de novo" acontece só pelo painel (`escolherVersao`).
4. **Bug no painel atual.** O `settleOnAir` devolve `feito` mesmo com campo `falhou`; só `ResultadoSaida.campos` mostra a falha. O `painel-o-que-fica.tsx` exibe "Feito" sem olhar os campos. O contrato novo (T5) separa `no_ar`, `recusou` e `incerto`.
5. **Permissão.** O Lab escreve no YouTube no degrau "administrar o site" (`denyUnlessSiteAdmin` → RPC `can_admin_site_users`, `apps/web/lib/cms/auth-guards.ts:68`), em `endAbTest` com variante, em `revertWinner` e em `aplicarSugerido`. Não usar `can_publish_site`, que criaria uma terceira regra para a mesma decisão. Quem escolhe é quem administra o site, inclusive no "Manter a original". Os outros veem o painel com o texto "Só quem administra o site pode deixar uma versão no ar." (esse texto já existe).
6. **Número da migration.** O worktree para em `20261025000006`, e o `origin/staging` já tem `20261027000001_observatorio_a5_x3_lista_com_ocultas.sql`. Rodar `npm run db:new` sem esse arquivo gera `20261027000001` e **colide** com ele. Ver T1 (Passo 0).
7. **O MCP não escreve em teste.** O `manage_ab_test` só tem leituras e variantes de rascunho, então a paridade aqui é só de leitura (T16).
8. **A miniatura original fica no Blob.** O `media-cleanup` só apaga `media_assets`, e os `del()` do Lab só atingem rascunho e variante apagada. Testes anteriores à P4a não têm cópia no Blob: para eles, "Deixar A no ar" não restaura a miniatura (o settle dá `pulado_sem_original`). Ver Riscos.

## O que muda no banco (T1)

Migration criada por `npm run db:new ab_lab_m7b_escolha_do_dono`, idempotente:

```sql
set lock_timeout = '5s';
alter table public.ab_tests
  add column if not exists escolha_variant_id uuid null references public.ab_test_variants(id) on delete set null,
  add column if not exists escolha_em timestamptz null,
  add column if not exists escolha_por uuid null references auth.users(id) on delete set null; -- LGPD: some quem escolheu, a escolha fica
alter table public.ab_tests drop constraint if exists ab_tests_escolha_tem_data;
alter table public.ab_tests add constraint ab_tests_escolha_tem_data check (escolha_variant_id is null or escolha_em is not null);

-- A policy ab_tests_update deixa um editor (can_edit_site) mudar a linha pelo PostgREST. A escolha exige o degrau de administrar,
-- então só o servidor grava estas colunas. SECURITY INVOKER de propósito: em SECURITY DEFINER, current_user vira o dono da função
-- (postgres) e o raise nunca roda. No PostgREST current_user = authenticated; na migration e nas ações de FK (on delete set null,
-- executadas pelo dono da tabela) = postgres.
create or replace function public.tg_ab_tests_escolha_so_servidor() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and (
       (tg_op = 'INSERT' and (new.escolha_variant_id is not null or new.escolha_em is not null or new.escolha_por is not null))
    or (tg_op = 'UPDATE' and (new.escolha_variant_id, new.escolha_em, new.escolha_por)
          is distinct from (old.escolha_variant_id, old.escolha_em, old.escolha_por))) then
    raise exception 'ab_tests.escolha_*: só o servidor grava' using errcode = '42501';
  end if;
  if new.escolha_variant_id is not null and not exists (
    select 1 from public.ab_test_variants v where v.id = new.escolha_variant_id and v.test_id = new.id) then
    raise exception 'ab_tests.escolha_variant_id de outro teste' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.tg_ab_tests_escolha_so_servidor() from public, anon, authenticated;
drop trigger if exists ab_tests_escolha_so_servidor on public.ab_tests;
create trigger ab_tests_escolha_so_servidor before insert or update of escolha_variant_id, escolha_em, escolha_por on public.ab_tests
  for each row execute function public.tg_ab_tests_escolha_so_servidor();

-- Marca "iniciativa do dono" no histórico (o gatilho tg_ab_tests_restore_log copia o campo para a linha de ab_test_restores).
alter table public.ab_test_restores add column if not exists iniciativa text null;
alter table public.ab_test_restores drop constraint if exists ab_test_restores_iniciativa_check;
alter table public.ab_test_restores add constraint ab_test_restores_iniciativa_check check (iniciativa is null or iniciativa = 'dono');
-- create or replace de tg_ab_tests_restore_log: copiar a função de 20261018000001 inteira, MANTENDO `security definer` e
-- `set search_path = ''` (ab_test_restores tem revoke all; sem o definer o INSERT do gatilho falha e o UPDATE de ab_tests que grava
-- o resultado de TODO teste aborta). Só acrescentar `iniciativa`, nunca o texto cru, no insert e no do update set:
--   case when v ->> 'iniciativa' = 'dono' then 'dono' end
-- (um valor fora de 'dono' no jsonb, que o banco não valida, viraria nulo em vez de estourar o CHECK dentro do gatilho). Não mudar mais nada.

-- E18: a escolha do dono não é "vencedor".
-- Nome verificado no banco local: yt_own_video_versions_ab_event_check (CHECK inline de 20261014000008:56). `not valid` + `validate`
-- para não varrer a tabela sob lock exclusivo.
alter table public.yt_own_video_versions drop constraint if exists yt_own_video_versions_ab_event_check;
alter table public.yt_own_video_versions add constraint yt_own_video_versions_ab_event_check
  check (ab_event is null or ab_event in ('rotacao', 'vencedor', 'restauro', 'escolha')) not valid;
alter table public.yt_own_video_versions validate constraint yt_own_video_versions_ab_event_check;

comment on column public.ab_tests.escolha_variant_id is 'M7b: versão que o dono deixou no ar ou manteve (a original = id da variante is_original). Separada de winner_variant_id: nunca muda o vencedor nem getLearnings, EXCETO quando a escolha é a própria sugerida (aí o vencedor recebe a sugerida, como no aplicarSugerido). Gravada só quando a escrita fechou ok em todos os campos, ou no "Manter"/"já está no ar" sem escrita.';
reset lock_timeout;
```

- A RLS de leitura não muda: as colunas novas herdam `ab_tests_select` (`can_view_site`).
- Sem backfill. Escolha nula quer dizer que o dono ainda não decidiu; um backfill marcaria "Mantida por você" em testes onde ninguém decidiu nada.
- Depois da migration: `npm run db:types` e commit de `apps/web/src/types/database.types.ts`.
- A migration vai para produção **antes** do código que grava essas colunas (mesma regra da `20261025000006`). No envio 1 isso é o `db:push:prod`, e nenhum código grava as colunas.
- **Antes do `db:push:prod`** (vários terminais em `staging`): `git fetch && git ls-tree --name-only origin/staging supabase/migrations | tail -3` e `npx supabase migration list --linked | tail -5`. Se o número gerado já existe em algum dos dois, renomear para o próximo livre e refazer o `db:types`.

## Fonte única do "no ar" (T2)

`apps/web/src/lib/youtube/ab-no-ar.ts` (puro):

```ts
export interface TentativaNoAr { seq: number; campo: CampoNome; destino: string; estado: EstadoCampo; escreveu: boolean | null; em: string }
export type NoArLido =
  | { tipo: 'confirmado'; varianteId: string; letra: DisplayLabel; desde: string | null }
  | { tipo: 'misto'; porCampo: Partial<Record<CampoNome, DisplayLabel>> }   // título numa versão, miniatura em outra
  | { tipo: 'desconhecido'; ultima: { letra: DisplayLabel; desde: string | null } | null }
export function noArConfirmado(t: { test_type; restore_status; restore_seq; completed_at; winner_variant_id; winner_applied_at; variantes: Array<{ id; label; is_original }> }, historico: TentativaNoAr[]): NoArLido
```

Regra, **por campo** de `camposDoTeste(test_type)`:
1. Montar as linhas do campo: o `restore_status` atual entra como a linha de `seq = restore_seq` (deduplicada contra o histórico **por `(campo, em, destino, estado)`, não por `seq`**: depois de um "Manter" o `restore_seq` sobe sem mudar o `restore_status`) e o histórico vem ordenado por `seq` decrescente. O histórico **não** grava `em_andamento` (gatilho `ab_tests_restore_log`); por isso, um `restore_status` com **algum campo `em_andamento`** dá `desconhecido` direto.
2. Só valem as linhas com `em >= completed_at - FOLGA_REGISTRO_MS` (120 s, a mesma folga da E18 em `coleta/versoes-origem.ts`). O histórico só guarda settles, não a rotação do teste ativo, e descer além do fim do teste afirmaria uma versão que a rotação já trocou. `completed_at` nulo → `desconhecido`.
3. Percorrer da mais nova para a mais velha:
   - `estado: 'ok'` → o destino do campo (vale mesmo com `escreveu: false`: já estava lá);
   - `pulado_sem_original`, ou `falhou`/`desistiu` com `escreveu === false` → o campo continua como estava; passar para a anterior;
   - `pulado_drift` e `pulado_teste_youtube` → `desconhecido` para o campo (alguém mudou o vídeo, ou o teste nativo do YouTube gira o título: o que está no ar **não** é a versão anterior);
   - `falhou`/`desistiu` com `escreveu !== false` → `desconhecido` para o campo, com `ultima` = a última confirmada antes;
   - acabou a janela sem fecho ok → o legado (`winner_applied_at`, como faz hoje o `noArDoTeste`); sem legado, `desconhecido`.
4. `destino`: `'original'` mapeia para a variante com `is_original`; se não há **exatamente uma**, `desconhecido`. Destino que não é variante do teste → `desconhecido`.
5. Resultado: todos os campos conhecidos e com o mesmo destino → `confirmado` (`desde` = o maior `em`); campos conhecidos com destinos diferentes → `misto`; qualquer campo `desconhecido` → `desconhecido` (com `ultima`, se houver).

O `noArDoTeste` (`concluidos.ts:14`) passa a delegar a esta função: `noArDoTeste(t, letraDe, historico: TentativaNoAr[] = [])`. Quem chama sem histórico (cabeçalho, MCP) **tem de** receber o histórico do teste (T15b-2, T16); o parâmetro padrão só serve ao envio 1.

## Actions do servidor e contratos

Arquivo: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`. Tipos em `apps/web/src/lib/youtube/ab-acao-saida.ts`.

```ts
export type PorqueRecusou = 'youtube' | 'drift' | 'sem_original' | 'sem_tempo' | 'arquivo_indisponivel'   // uma frase do Logan por valor (T7a)

export type ResultadoEscolha =
  | { ok: true; resultado: 'no_ar'; noAr: Extract<NoArLido, { tipo: 'confirmado' }>; restoreSeq: number }
  | { ok: true; resultado: 'guardado'; restoreSeq: number }
  | { ok: true; resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { ok: false; resultado: 'recusou'; porque: PorqueRecusou; noAr: NoArLido; entrou: CampoNome[]; restoreSeq: number; error: string }
  | { ok: false; resultado: 'incerto'; restoreSeq: number | null }
  | { ok: false; resultado: 'mudou' | 'ja_encerrado' | 'em_andamento' | 'outro_teste' | 'teste_youtube' | 'sem_permissao' | 'erro'; error: string }

export type ResultadoConferir =
  | { ok: true; estado: 'escrevendo' }
  | { ok: true; estado: 'lido'; noAr: Extract<NoArLido, { tipo: 'confirmado' }>; restoreSeq: number; fonte: 'registro' | 'youtube' }
  | { ok: true; estado: 'nao_propagou'; noAr: Extract<NoArLido, { tipo: 'confirmado' }>; titulo: 'conferido' | 'nao_lido' }   // miniatura recém-enviada
  | { ok: true; estado: 'lido_misto'; porCampo: Partial<Record<CampoNome, DisplayLabel>>; restoreSeq: number }   // cada campo bateu com uma versão, em versões diferentes (ex.: título C, miniatura B depois das 3 h)
  | { ok: true; estado: 'nenhuma_versao'; restoreSeq: number }          // só se ALGUM campo não casa com versão nenhuma (todas comparadas)
  | { ok: false; estado: 'sem_leitura' | 'sem_permissao' | 'ja_encerrado'; error: string }   // sem_leitura inclui vídeo apagado/privado e comparação parcial
```

**`escolherVersao(testId, varianteId, seqVisto, forcar?)`**
1. Primeiro `denyUnlessSiteAdmin(siteId, 'deixar uma versão no ar')`, depois `requireEditUser()` para obter o `userId`. Se `user.siteId !== siteId` da tela → `sem_permissao`, sem leitura. Zod valida `testId` e `varianteId` como uuid, `seqVistoSchema`, e `forcar` como boolean opcional.
2. Ler o teste (filtrado por `site_id`), as variantes e o histórico **só deste teste** (`.eq('test_id')`). Responder `ja_encerrado` se `status !== 'completed'` ou se a `tela-v2` não for v2. A variante tem de ser deste teste, senão `erro`. Se não há **exatamente uma** variante `is_original`, `erro` (e a opção A fica `bloqueio: 'sem_original'` no painel). `vencedor_sugerido` que não é variante do teste é tratado como **sem sugerida** (Sentry `captureMessage`, uma vez por teste).
3. Se `seqVisto !== restore_seq`, responder `mudou`.
4. **Sem escrita no YouTube** (destino já confirmado no ar). Calcular `noArConfirmado`; se `confirmado` e a variante confirmada é o destino (A ou qualquer outra, incluindo a que veio do legado ou de uma rotação fechada sem escolha): UPDATE com CAS em `id`, `site_id`, `status='completed'` e `restore_seq = seqVisto`, gravando `escolha_variant_id`, `escolha_em = now()`, `escolha_por = userId`, `updated_at = now()` e `restore_seq = restore_seq + 1` (o +1 faz as outras abas receberem `mudou`).
   - Se o destino é a sugerida, `completed_reason = 'regra_v2'` e `winner_variant_id` nulo, o mesmo UPDATE grava `completed_reason='manual_winner'` e `winner_variant_id` = a sugerida (a original incluída, como o ramo "a original vence" do `aplicarSugerido`), e acrescenta `winner_variant_id is null` ao `where`.
   - `escolha_variant_id` já igual ao destino → responder `no_ar` sem escrever nada, com `restoreSeq = seqVisto`.
   - Zero linhas atualizadas → `mudou`. Destino original → `guardado`; outro destino → `no_ar`.
5. **Escrita no YouTube** (destino não confirmado: `misto`, `desconhecido`, `em_andamento` ou outra versão). Motivo `aplicar_sugerido` **só** quando o destino é o `vencedor_sugerido`, **não é a original**, `completed_reason === 'regra_v2'` e o vencedor está nulo (o settle recusa `aplicar_sugerido` com destino original: `destino_invalido`). Senão, motivo `escolher`; e quando o destino é a sugerida (a original incluída) com `regra_v2` e vencedor nulo, o `escolher` recebe `extra = { completed_reason: 'manual_winner', winner_variant_id: <sugerida> }` e `p_vencedor_esperado = <sugerida>` (a guarda da letra da P3). Regra única: **o vencedor só recebe a sugerida, e recebe sempre que o dono escolhe a sugerida, seja qual for o caminho.** Passar `autor: userId`, `humano: true`, `seqEsperado` e `forcar`.
6. Mapear o `feito` (que agora devolve `seq` = o `claimed_seq`):
   - todos os campos ok → `no_ar`, com `restoreSeq = seq` e `noAr` calculado em memória (`noArConfirmado(t, [...historicoLido, ...linhasDe(final, seq)])`, sem segunda ida ao banco);
   - algum campo com `escreveu === null` → `incerto`;
   - `perdido` (o `ResultadoSaida` ganha `{ resultado: 'perdido'; escreveu: boolean | null; campos }` nos dois retornos depois do claim que hoje dizem `em_andamento`, `ab-settle.ts:616-625`; o vigia e o `traduzirSaida` antigo o tratam como `em_andamento`; ver T4, consumidores de `perdido`) → `incerto`;
   - exceção depois de o `settleOnAir` ter sido chamado → `incerto` com `restoreSeq: null` (e Sentry); só a exceção antes da chamada é `erro`;
   - senão → `recusou`, com `entrou` = campos ok, `noAr` em memória e `porque` derivado do estado e do erro do campo (`pulado_drift` → `drift`; `pulado_sem_original` → `sem_original`; `tempo_esgotado` → `sem_tempo`; `arquivo_do_destino_indisponivel` → `arquivo_indisponivel`; resto → `youtube`). O YouTube só é culpado quando foi chamado.
   - `outro_teste` e o resto passam por `traduzirSaida`.
7. Invalidar as telas como o `concluirSaida` faz. `escolha_por` nunca vai para log, Sentry nem resposta.

**`conferirNoAr(testId)`** só lê e nunca escreve.
- Permissão: `requireEditUser()`. **Guarda de site:** ler o teste com `.eq('id', testId).eq('site_id', user.siteId)` (o cliente de serviço bypassa RLS); sem linha → `ja_encerrado`, sem nenhum `fetch` ao YouTube nem gasto de cota com o token de outro canal.
- `emAndamentoRecente(restore_status)` → `escrevendo`.
- `noArConfirmado` confirmado → `lido`, `fonte: 'registro'`.
- `desconhecido` ou `misto` → ler o YouTube com `lerNoArNoYouTube` e comparar com `qualVersaoNoAr` (T3). `lerNoArNoYouTube` é um export novo de `ab-settle.ts`, que reusa `resolverAcesso` + `lerNoYouTube` e custa 1 unidade de `videos.list` mais um `hqdefault` sem cota.
  - O resultado traz o que foi lido **por campo**. O título (`snippet.title`, `videos.list`) vale na hora.
  - Achou uma versão em todos os campos → `lido`, `fonte: 'youtube'`.
  - **Miniatura lida igual à versão anterior, a menos de 3 h (`CICLO_MINIMO_MS`, `ab-watchdog-drift.ts:30`) do `em` de uma tentativa `escreveu: null`** → `nao_propagou` (o CDN do YouTube demora a mostrar a miniatura nova). Nunca `recusou`.
  - `videos.list` com `items: []` (vídeo apagado ou privado), erro de token, rede ou API, ou alguma versão que não deu para comparar (sem `thumbnail_dhash` e Blob indisponível) → `sem_leitura`.
  - Cada campo bateu com uma versão, mas em versões diferentes (ex.: título C e miniatura B, fora da janela de 3 h) → `lido_misto` com `porCampo`. `nenhuma_versao` só quando **algum campo** não casa com versão nenhuma (todas comparadas).
- Não grava o que leu. Quem acerta o registro é o "Tentar de novo" do dono, pelo painel.

**`settleOnAir` (T4)**
- `MotivoSaida` ganha `'escolher'`. `caminhoDe('escolher')` = `{ de: ['completed'], para: 'completed', endReason: null, extra: {} }` por padrão (não toca o vencedor, o motivo do fim nem os ciclos); o `extra` vem da regra do passo 5 acima quando o destino é a sugerida.
- A guarda `outroTesteAberto` também vale para `escolher`. O `escolher` não passa por `reversaoAberta`, porque não há prazo.
- `OpcoesSaida.autor?: string`. O `feito` devolve `seq` (o `claimed_seq`).
- **Iniciativa do dono.** `CampoRestauracao` (`ab-restore.ts:32`) ganha `iniciativa?: 'dono'`, e o Zod `Campo` (linha ~106) também (senão descarta a chave).
  - No claim: o `inicial` do `p_restore_status` (`ab-settle.ts:592-594`) leva `iniciativa: 'dono'` em todos os campos quando `op.humano && (op.motivo === 'escolher' || op.motivo === 'aplicar_sugerido')`.
  - `montarCampo` (`ab-settle.ts:359-364`) ganha `iniciativa` na `Base` e a copia sempre. `proximaDoInterrompido` já preserva (espalha `...campo`). A `novaTentativa` copia `rs0[c].iniciativa` no `inicial` (linhas 724-729).
  - **`daEscolhaDoDono`:** `ab-restore.ts` exporta `export const daEscolhaDoDono = (c: CampoRestauracao): boolean => c.iniciativa === 'dono'`. É o **único** predicado: a recusa da `novaTentativa`, o `camposPendentes(rs, 'vigia')` (pula esses campos; o `'humano'` não pula) e os chamadores abaixo o usam.
  - `faseNovaTentativa` (`ab-watchdog-nova-tentativa.ts`, depois de `const pend = camposPendentes(rs, 'vigia')`): `if (pend.length === 0) { r.ignorados.escolha_do_dono++; continue }`, para o item não gastar uma leitura e um claim por execução.
  - A `novaTentativa` **recusa** campos com `daEscolhaDoDono` (`ja_encerrado`, com frase que manda abrir o painel). O "Já corrigi no YouTube" (`dismissRestore`) continua.
  - **Chamadores de `camposPendentes(rs, 'humano')` (7), todos tratados:**
    - `_components/faixa-restauracao-texto.ts:273` e `:285`, e a linha 99 (antes do `simAindaVale`): `if (daEscolhaDoDono(c))` devolve o texto da T7a ("Sua escolha não foi aplicada. Abra o painel do teste para tentar de novo. Não repetimos a troca sozinhos."), nunca "Nova tentativa automática"; mesmo tratamento do bloqueio na linha ~202;
    - `_components/faixa-dados.ts:31` e `_components/caminho-nativo/ficha-faixas.tsx:38`: no lugar da ação `tentar`, "abrir o painel" (link) quando o campo é da escolha;
    - `lib/youtube/ab-restore-acoes.ts:80`: não oferecer `tentar` para o campo da escolha;
    - `actions.ts:1319` (ramo "voltar à original" do `revertWinner`): `camposPendentes(...).filter(k => !daEscolhaDoDono(rs[k]!))`, para o `reverter` reivindicar de novo em vez de cair na recusa da `novaTentativa`;
    - `ab-settle.ts:682`: mesma checagem antes de `novaTentativa`.
  - **Consumidores de `perdido`:** mapear `perdido` → `em_andamento` num só lugar (`traduzirSaida`); `actions.ts:857` (`concluirSaida`) **invalida as telas** também em `perdido` (pode ter escrito no YouTube); `_components/concluido-v2-detail.tsx:134` e `_components/caminho-nativo/ficha-faixas.tsx:146` conferidos. O executor roda `grep -rn "resultado === 'em_andamento'"` e confere a lista.
- No `gravarResultado`, quando o motivo é `escolher` ou `aplicar_sugerido` e tudo deu ok, o mesmo UPDATE com CAS grava `escolha_variant_id` (para a original, o id dela), `escolha_em` e `escolha_por`.
  - `escolher` **não** grava `winner_applied_at`, `applied_by`, e não chama `autoImportWinner`; grava `revert_expires_at = null` (o prazo saiu do produto).
  - `aplicar_sugerido` continua como hoje, mais `escolha_*`.
  - `reverter` ok (enquanto existir) grava `escolha_variant_id` = a original, `escolha_em` e `escolha_por = autor`, porque é decisão do dono.
- **E18 aceita `escolha` (subtarefa da T4).** Regra única de precedência: **`iniciativa = 'dono'` e destino variante e destino diferente do vencedor gravado (`v.teste.varianteVencedora`) → `eventoAb: 'escolha'`; destino `'original'` → `restauro` (R2 continua primeiro); `iniciativa = 'dono'` com destino = vencedor gravado (`aplicar_sugerido`, escolha = sugerida) → `vencedor`, como hoje.** Arquivos:
  - `coleta/versoes-origem.ts:162` (R3) e `RestauroAb.iniciativa?: 'dono'` (`:30`);
  - `coleta/versoes-step.ts`: `COLUNAS_RESTAUROS` (`:119`/`:584`) ganha `iniciativa` e o mapeador (~591-600) a copia;
  - `observatorio/proprio-versoes/tipos.ts:12` (`'rotacao' | 'vencedor' | 'restauro' | 'escolha'`) e `:81`;
  - `observatorio/proprio-versoes/ler.ts:179`: `ab_event.in.(vencedor,restauro,escolha)` (senão `titulosAntesDoTeste` pula a versão escolhida);
  - `competitors/_proprio/trocas-model.ts:344-350`: ramo `eventoAb === 'escolha'` com chip "Escolhida por você" e a frase "deixada no ar em dd/mm, no fim do teste de dd/mm" (texto da T7a); não conta em `diag.estadoInesperado`.

## Estados da tela → componentes

| Estado do mockup | Fase (puro, T9) | O que aparece | Componente |
|---|---|---|---|
| a | `escolha`, marcada = no ar | "Nada a fazer: a versão B já está no ar." + Fechar | `painel-concluido.tsx` |
| b | `escolha`, marcada ≠ no ar | Sai/Entra + linha neutra + "Deixar C no ar" | `sai-entra.tsx`, `painel-concluido.tsx` |
| c | `escrevendo` (+ `demorando` após 15 s) | "Escrevendo no YouTube…", radios travados; aos 15 s, "Está demorando. Pode fechar…" | idem |
| d / d3b | `recusou` | aviso `err` no topo, `role=alert`, foco nele; "No ar agora" relido; "Tentar de novo" com o `restoreSeq` novo | `aviso-painel.tsx` |
| d2 | `conferindo` | aviso âmbar com relógio; selo tracejado "No ar na última leitura"; "Conferindo…" desabilitado | idem |
| d3a | `no_ar` (vindo da conferência) | igual a e, com a data de hoje, não "agora" (Logan r4, item 2) | idem |
| d3c | `sem_rede` | "Sem conexão para conferir…" e só Fechar | idem |
| e | `escolha`, no ar = escolha ≠ sugerida | selos "No ar agora" + "Escolhida por você" | `opcao-versao.tsx` |
| f / f2 | inconclusivo, sem pré-seleção / `guardado` | "Deixar no ar" desabilitado até marcar; em f2, "Guardado." como 1º bloco | `painel-concluido.tsx` |
| g2 | `guardado` com sugerida | "Guardado. O vídeo continua com a original (A). O teste sai da lista do que espera você." | idem |
| i | `escolha`, A no ar, B pré-marcada | ao marcar A, o botão vira "Manter a original (A)" (neutro claro) | idem |
| k / k2 | reaberto, escolha = original | A marcada, "No ar agora" + "Mantida por você", "Sua escolha está guardada…", só Fechar | idem |
| j | qualquer | `<img onError>` → ícone `i-img`, `role=img`, "Miniatura não carregou" | `opcao-versao.tsx`, `sai-entra.tsx` |
| h | lista | linha inteira clicável com seta, no máximo 2 selos, dica "Toque numa linha para abrir o painel do teste." A etiqueta "mockup: abre X" **não vai para o código** | `secao-concluidos.tsx` |

Textos: copiar exatamente das funções `frase(S)` e `painel(S)` do mockup (linhas ~238-300 do `index.html`), inclusive a linha fixa "O resultado do teste não muda com a sua escolha.".

Saem do painel concluído: "Aplicar B ao vídeo", "Voltar à original", "Em breve", o rodapé "Dá para voltar à original por 7 dias." e todo texto de prazo.

CSS (`pagina-lab.css`):
- `.ot .tt{min-height:calc(2*1.35em)}`.
- Selos em linha própria a 390 px.
- Miniatura de 56×32 a 390 px.
- Rodapé fixo a 390 px, só quando há outra ação além de Fechar.
- Laranja só no botão que escreve no YouTube. "Manter a original" em neutro claro. Âmbar só no estado "incerto".
- `.frase` em Inter 600, 16 px.

Fora do mockup, e o Logan precisa escrever o texto destes casos:
- troca parcial em combo;
- nada confirmado ao abrir;
- inconclusivo com C no ar;
- sugerida = original;
- `precisa_confirmar` (drift).

## Cowork/MCP

**Paridade só de leitura (T16, envio 2).**
- `projetarTeste` (`apps/web/src/lib/pipeline/services/youtube.ts:1169`) ganha `escolha: { variant_id, letra, em } | null` e `no_ar: { letra, desde, confirmado }`, vindo de `noArConfirmado`. **Sem `escolha_por`** (id de pessoa num pacote que vai para a IA): o `ab-tests-intel.test.ts` afirma que ele não aparece.
- O histórico vem de **uma** leitura `in(test_id)` (paginada) para os testes da página da lista, nunca uma por item.
- A descrição do `manage_ab_test` (`src/lib/pipeline/mcp/tools.ts:666`) ganha a frase: "escolha is the owner's pick and never changes winner_variant_id (except when the pick is the suggested version)".
- `cowork-instructions.ts` ganha uma linha.

Não há ação de escrita pelo MCP, por três motivos:
1. A chave do MCP não é uma pessoa: não passa por `can_admin_site_users` e não preenche `escolha_por`.
2. O fluxo sem diálogo de confirmação depende de o dono ver o "Sai / Entra" antes de o vídeo público mudar.
3. Hoje o MCP não escreve título nem miniatura em lugar nenhum. Abrir isso aqui seria uma decisão de produto nova.

## Tarefas (TDD; comandos sempre a partir de `apps/web`: `npx vitest run test/<arquivo> 2>&1 | tail -30`)

Regras de sempre:
- Agentes em série no mesmo worktree.
- `git add <arquivos>` explícito.
- Não tocar `next-env.d.ts` nem `tsconfig.json`.
- Teste puro com `// @vitest-environment node`; componente com `jsdom`.
- Um commit no fim de cada tarefa.

## Envios (Hanna)

| Envio | Tarefas | Tokens (estimativa) | Pronto quando |
|---|---|---|---|
| **1 — hoje** | T1 (migration, `db:push:prod` antes), T15a (D18), T15c (D20), T15b-1 (título do D19) | ~190K | critérios do envio 1 (abaixo), conferidos pelo Gio em produção |
| **2 — o painel inteiro** | T2–T14, T7a, T15, T15b-2, T16, T17, T18, T19 | ~2,3M | roteiro da T19 verde; só então o dono é mandado ao painel |

Não há envio 3. Pushes: no máximo 3 por dia por terminal (crédito Vercel). Envio 1: 1 push em staging e 1 promoção, saindo de uma base já rebaseada com o `20261027000001` (Passo 0 da T1). Envio 2: 1 push com tudo verde local (T17), 1 promoção, depois a T19; consertos da T18 vão em 1 push. Total ~2,5M, estimativa sem medida.

### Envio 1 — pequenos e independentes (nenhum código grava as colunas novas)

- [ ] **T1 Migration e tipos (~60K, Sonnet).**
  - Arquivos: `supabase/migrations/<n>_ab_lab_m7b_escolha_do_dono.sql`, `apps/web/src/types/database.types.ts`, `apps/web/test/ab-m7b-migration.test.ts`, `apps/web/test/integration/ab-m7b-escolha-guarda.test.ts`.
  - **Passo 0:** `git fetch origin && git ls-tree --name-only origin/staging supabase/migrations | tail -3`. Trazer o `20261027000001` (e qualquer posterior) para o worktree (rebase ou cherry-pick) e só então rodar `npm run db:new`.
  - `ab-m7b-migration.test.ts` lê o SQL e procura `if not exists`, `drop … if exists`, `revoke`, o comment e **`security invoker`**. Ele sozinho não prova a guarda.
  - `ab-m7b-escolha-guarda.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int`), rodando como não superusuário (`set role authenticated` + `request.jwt.claims`, regra do GUC-spoof):
    - (a) UPDATE de `escolha_em` por `authenticated` dá `42501`; INSERT com `escolha_*` preenchida por `authenticated` dá `42501`;
    - (b) o mesmo UPDATE como `service_role` passa;
    - (c) `set local role supabase_auth_admin` e `delete from auth.users` de quem tem `escolha_por`: passa, sem `42501`, e deixa a coluna nula (é o caminho da exclusão LGPD: a guarda não pode travá-lo);
    - (d) `delete` da variante escolhida, como `service_role`: passa, sem `42501`, e deixa `escolha_variant_id` nulo;
    - (e) variante de outro teste dá `23514`;
    - (f) a migration aplicada 2× não dá erro;
    - (g) o gatilho `tg_ab_tests_restore_log` ainda copia as linhas como antes e agora copia `iniciativa`, e além disso:
      - `select prosecdef, proconfig from pg_proc where oid = 'public.tg_ab_tests_restore_log()'::regprocedure` dá `true` e `{search_path=""}`;
      - um `restore_status` com `iniciativa: 'x'` não derruba o `UPDATE` de `ab_tests` e grava `iniciativa` nula na linha de histórico;
      - a guarda P4a: "retomar que falha regrava o valor anterior e não gera linha nova";
    - (h) depois de aplicada, `insert … ab_event = 'escolha'` em `yt_own_video_versions` passa no banco local (prova que o CHECK antigo saiu e não há segundo CHECK).
  - Ensaiar a migration no `bythiago_int` com `ab-settle.test.ts` de integração verde antes do push.
  - **Conferência em produção, no dia do `db:push:prod`, antes de subir qualquer código:** `select prosecdef, proconfig, position('iniciativa' in pg_get_functiondef(oid)) > 0 as tem from pg_proc where proname = 'tg_ab_tests_restore_log';` Esperado `true | {search_path=""} | true`. E `select conname from pg_constraint where conrelid = 'public.yt_own_video_versions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%ab_event%';` Esperado: 1 linha, com `escolha`. Depois do push do código velho, nenhum erro novo no Sentry em `ab-settle` na hora seguinte.
  - Pronto quando: o teste de integração verde e `db:types` commitado.
- [ ] **T15a D18: Encerrar em teste só de título (~50K, Sonnet).**
  - Arquivos: `_components/ab-end-test-dialog.tsx:88-100` e o mesmo "Sem imagem" em `_components/ab-confirmar-troca-dialog.tsx:35`.
  - Quando o tipo é `title`, todas as versões mostram a miniatura do vídeo (a original do Blob, ou `original_thumbnail_url`) com a nota "miniatura não muda". "Sem imagem" fica só para falha real de carga (`onError`).
  - Teste: `test/ab-end-test-dialog-titulo.test.tsx`. B mostra o mesmo `src` de A e a nota aparece. Em teste de miniatura, nada muda.
- [ ] **T15c D20: botão "Abrir no YouTube" (~40K, Sonnet).**
  - Arquivo: `detail-header.tsx`, nas duas variantes do cabeçalho.
  - Link para `https://www.youtube.com/watch?v=<id>`, com `id = encodeURIComponent(view.youtubeVideoId)` (o mesmo de `faixa-da-pagina.ts:27`; não `youtube_video_id` de `ab_tests`), `target=_blank rel="noopener noreferrer"` e alvo de toque de pelo menos 44 px. Sem id, o botão não aparece. A `page.tsx` passa a prop se o `detail-header.tsx` ainda não a receber.
  - Não confundir com o "Abrir no YouTube Studio" de `faixa-restauracao-texto.ts`.
  - Teste: o link aparece no teste ativo e no concluído, com o `href` certo, e some quando não há id.
- [ ] **T15b-1 D19: o cabeçalho do concluído mostra o título no ar (~40K, Sonnet).**
  - Arquivos: `_components/detail-header.tsx:70` e `:121`, mais `[testId]/page.tsx` e a view. Usa o `noArDoTeste` que já existe (sem depender da T2).
  - Regra no envio 1: com uma versão `confirmado` no ar, o `title_text` dela; senão, `original_title ?? name`.
  - Teste: um concluído com B aplicada mostra o título de B; um sem confirmação mostra o original.
  - **Não** sai a faixa "Vencedor aplicado — reverter em até…" aqui: enquanto o envio 2 não sobe, o prazo de 7 dias e o `revertWinner` valem, e tirar o texto esconderia um prazo real.

### Envio 2 — servidor

- [ ] **T2 `noArConfirmado` (~100K, Opus).**
  - Arquivos: `ab-no-ar.ts` e `concluidos.ts` (o `noArDoTeste` passa a delegar, com `historico` opcional).
  - Teste: `apps/web/test/ab-no-ar.test.ts`.
  - Casos:
    - tudo ok → confirmado;
    - falha com `escreveu: false` sobre um B ok → B;
    - título ok e miniatura com `escreveu: null` → desconhecido, com `ultima` B;
    - sem histórico, com `winner_applied_at` → caminho legado;
    - sem nada → desconhecido;
    - destino que não é variante → desconhecido; `'original'` com variante original única → a original; sem original ou com duas → desconhecido;
    - pausa A ok, depois fim `pulado_sem_original` → desconhecido, nunca A (linha anterior a `completed_at - 120 s` não vale);
    - fim `pulado_drift` sobre uma escolha B ok → desconhecido; `pulado_teste_youtube` idem;
    - `completed_at` nulo → desconhecido;
    - combo: título C ok e miniatura com recusa sobre B → `misto {title:C, thumbnail:B}`;
    - seq 6 retry só da miniatura ok C sobre seq 5 (título ok C, miniatura `falhou` false) → confirmado C;
    - `em_andamento` recente sobre um B ok → desconhecido;
    - `restore_status` ok com histórico vazio (testes entre 14/10 e 18/10) → confirmado;
    - "Manter" (`restore_seq` sobe, `restore_status` igual) e depois `noArConfirmado`: o resultado não muda e a linha "atual" não duplica a do histórico.
  - O `ab-lab-pagina-concluidos.test.ts` continua verde.
- [ ] **T3 `qualVersaoNoAr` (~50K).**
  - Arquivo: `ab-settle-decidir.ts` (exportar o `limpo` de `ab-settle-decidir.ts:37`; não criar outro `trim`). Teste: `ab-settle-decidir.test.ts`.
  - Título: igualdade via `limpo`, contra as variantes e contra o `original_title`. Miniatura: `hamming <= DHASH_MAX_SAME`; **mais de uma versão dentro do limite → `null`** (nunca a primeira que casar).
  - Em combo, os dois campos têm de apontar a mesma versão; senão, `null`. Um `original_title` nulo nunca casa.
- [ ] **T4 `settleOnAir` com `escolher`, iniciativa e `perdido` (~200K, Opus).**
  - Arquivos: `ab-settle.ts`, `ab-restore.ts` (`CampoRestauracao`, Zod, `camposPendentes`, `daEscolhaDoDono`), `ab-watchdog-nova-tentativa.ts`, `ab-restore-acoes.ts`, `actions.ts` (`traduzirSaida`, `concluirSaida`, ramo de `revertWinner`), `_components/faixa-restauracao-texto.ts`, `_components/faixa-dados.ts`, `_components/caminho-nativo/ficha-faixas.tsx`, `_components/concluido-v2-detail.tsx`, `coleta/versoes-origem.ts`, `coleta/versoes-step.ts`, `observatorio/proprio-versoes/tipos.ts` e `ler.ts`, `competitors/_proprio/trocas-model.ts`. Testes: `ab-settle.test.ts`, `ab-cron-watchdog.test.ts`, `versoes-origem.test.ts`, `versoes-step`, `trocas-model`, os de faixa e ficha.
  - O que os testes afirmam:
    - `escolher` C → o claim recebe `p_extra={}` e `p_end_reason=null`; o `inicial` tem `iniciativa: 'dono'` em todos os campos;
    - o patch tem `escolha_*` e `revert_expires_at = null`, e **não tem** `winner_*`, `winner_applied_at` nem `applied_by`; `autoImportWinner` não é chamado;
    - `escolher` com destino = sugerida (original incluída), `regra_v2`: `p_extra` com `manual_winner` e o `winner_variant_id`, e `p_vencedor_esperado`;
    - `outro_teste` barra a escolha;
    - `em_andamento` com `iniciativa: 'dono'` e 20 min → a fase "interrompidos" converte → a fase 3 **não** chama `tentar` (porta espiã com contagem zero);
    - `novaTentativa` humana sobre campo com `iniciativa: 'dono'` → recusa, nenhum `update` com `winner_applied_at`, nenhum claim;
    - `montarCampo` copia `iniciativa` (mutante: tirar a cópia faz o teste de nova tentativa falhar);
    - `faseNovaTentativa` com `pend` vazio → `ignorados.escolha_do_dono++`, sem leitura nem claim;
    - `aplicar_sugerido` grava `escolha_*` e continua gravando o vencedor;
    - `reverter` ok grava `escolha_variant_id` = original;
    - o `feito` devolve `seq = claimed_seq`; `lerSeq` que muda depois da 1ª escrita → `perdido`; um `fetch` que lança `TypeError` desconhecido no PUT da miniatura → `perdido`, ou exceção que a T5 trata como `incerto`;
    - um `seqEsperado` velho dá `mudou`;
    - **`daEscolhaDoDono`:** campo `falhou` com `iniciativa: 'dono'` → o texto da faixa **não** contém "automática" e traz a frase do painel; `faixa-dados`, `ficha-faixas` e `ab-restore-acoes` não oferecem `tentar`; `revertWinner` sobre um campo `falhou` da escolha chega ao `settleOnAir` com `reverter` (não recusa);
    - `concluirSaida` com `perdido` chama a invalidação;
    - **`versoes-origem`:** (a) `aplicar_sugerido` com marca dono → `vencedor`; (b) `escolher` C com vencedor B → `escolha`; (c) `escolher` com destino = vencedor gravado → `vencedor`; (d) destino `'original'` → `restauro`; (e) sem a marca → como hoje;
    - `versoes-step`: a consulta pede `iniciativa` (afirmar a lista de colunas);
    - `trocas-model`: uma troca `escolha` não conta em `diag.estadoInesperado` e mostra o chip; `titulosAntesDoTeste` com uma linha `escolha` mais recente devolve o título dela;
    - conferência no banco local, antes e depois do passo de prova: `select ab_event, count(*) from yt_own_video_versions where origin='ab_lab' group by 1`; nenhuma linha `escolha` para `aplicar_sugerido`.
- [ ] **T5 `escolherVersao` + contrato (~180K, Opus).**
  - Arquivos: `actions.ts` e `ab-acao-saida.ts`.
  - Teste: `ab-actions-escolher-versao.test.ts`, no modelo do `ab-actions-aplicar-sugerido.test.ts`; mais um de integração (`HAS_LOCAL_DB`): dois `ab_settle_claim` com o mesmo `p_seq` → o 2º dá zero linhas; dois UPDATEs do "Manter" com o mesmo seq → um só altera.
  - O que os testes afirmam:
    - sem admin → `sem_permissao`, antes de qualquer leitura; `user.siteId` diferente do site da tela → `sem_permissao`, sem leitura;
    - variante de outro teste → `erro`; sem original ou com duas originais → `erro`; sugerida que não é variante → tratada como sem sugerida (motivo `escolher`, sem `p_vencedor_esperado`, Sentry uma vez);
    - "Manter" com A confirmada → UPDATE com CAS, `restore_seq + 1` e `updated_at`, sem `settleOnAir`;
    - C confirmada com `escolha` nula → um UPDATE com `escolha_variant_id` = C e `restore_seq + 1`, resposta `no_ar`;
    - "Manter" com A não confirmada → escreve (`escolher` com destino na original);
    - sugerida = original, `regra_v2`, A com `escreveu: null` → `escolher` com `manual_winner` e o vencedor da original, claim com `p_vencedor_esperado`;
    - sugerida ≠ original + `regra_v2` + vencedor nulo → `aplicar_sugerido`; C não sugerida → `escolher`;
    - `feito` com campo `falhou` e `escreveu: false` → `recusou` (um caso por `porque`); `escreveu: null` → `incerto`;
    - `recusou` e `no_ar` devolvem `restoreSeq = claimed_seq`; a 2ª chamada com esse seq reivindica;
    - `perdido` → `incerto`; exceção depois da chamada → `incerto` com `restoreSeq: null`; antes da chamada → `erro`;
    - o vencedor fica igual depois de escolher C (afirmar no patch);
    - concorrência: duas chamadas com o mesmo `seqVisto` → só uma reivindica; a outra recebe `em_andamento` ou `mudou`.
- [ ] **T6 `conferirNoAr` (~140K).**
  - Arquivos: `actions.ts` e `ab-settle.ts` (export de `lerNoArNoYouTube`). Teste: `ab-actions-conferir-no-ar.test.ts`.
  - O que os testes afirmam:
    - `em_andamento` recente → `escrevendo`, sem ler o YouTube;
    - registro confirmado → `lido` pelo registro, sem chamar o `fetch` do YouTube;
    - desconhecido e o YouTube casa com C → `lido` pelo YouTube;
    - combo com `escreveu: null` na miniatura há 2 min e `hqdefault` igual a B → `nao_propagou`, nunca `recusou`;
    - título C + miniatura B fora da janela de 3 h → `lido_misto {title:C, thumbnail:B}`; título X desconhecido + miniatura B → `nenhuma_versao`;
    - `testId` de outro site → `ja_encerrado`, nenhum `fetch` ao YouTube;
    - `items: []` → `sem_leitura`; uma versão sem `thumbnail_dhash` com Blob indisponível → `sem_leitura`;
    - o token falha → `sem_leitura`;
    - nenhum `update` em `ab_tests`.
- [ ] **T7 A `tela-v2` respeita a escolha (~80K).**
  - Arquivo: `tela-v2.ts:160-205`.
  - Com `escolha_em` preenchida: `noAr` vem de `noArConfirmado`; a `EntradaTelaV2` ganha `historico?: TentativaNoAr[]`; e ficam `aplicar = null`, `aplicarDeNovo = null` e `voltar = false`.
  - Sem escolha, nada muda: incluir um teste de regressão com as fixtures atuais.
- [ ] **T7a Textos do Logan fora do mockup (~30K, Sonnet; Naksu confere só o comprimento a 390 px).**
  - Saída: `.superpowers/sdd/ab-lab/m7b/logan-textos-fora-do-mockup.md`. A T8 e a T11 citam esse arquivo como spec; **portão da T8**.
  - Os 5 do plano: troca parcial em combo (`misto`); nada confirmado ao abrir; inconclusivo com C no ar; sugerida = original; `precisa_confirmar` (drift).
  - Derivados da revisão: uma frase por `porque` (`youtube`, `drift`, `sem_original`, `sem_tempo`, `arquivo_indisponivel`); `nao_propagou` (ideia: "Ainda não dá para conferir a miniatura; o YouTube leva até algumas horas para mostrar a nova."); `nenhuma_versao`; vídeo apagado/privado (`sem_leitura`); "Está demorando" no teto da conferência; escolha cuja variante foi apagada ("Sua escolha foi registrada em dd/mm, mas a versão não existe mais"); "O título original não foi guardado…" e "A miniatura original…"; frase da `novaTentativa` recusada e do texto da faixa para campo da escolha ("Sua escolha não foi aplicada. Abra o painel do teste para tentar de novo. Não repetimos a troca sozinhos."); `lido_misto`; chip "Escolhida por você" e a frase do Observatório ("deixada no ar em dd/mm, no fim do teste de dd/mm").
  - Não precisa de nova aprovação visual do dono (é texto dentro de estados já aprovados). Se o Logan disser que algum caso pede desenho novo, esse caso sai do M7b e o painel mostra o estado mais próximo já aprovado (d3c, "só Fechar").

### Envio 2 — painel e página

- [ ] **T8 Modelo puro do painel (~150K).**
  - Arquivos: `ab-lab-pagina/painel-escolha.ts` e `tipos.ts`, com `PainelEscolha` e `OpcaoEscolha`. `OpcaoEscolha` leva `selos` (no máximo 2, entre `'no_ar' | 'no_ar_ultima' | 'sugerida' | 'escolhida' | 'mantida'`) e `bloqueio: 'sem_original' | 'sem_permissao' | null`.
  - `bloqueio: 'sem_original'` **por tipo**: num teste de título, `original_title` nulo; num de miniatura, `fonteDoOriginal(r) === null` (exportar de `ab-settle.ts:117`); no combo, qualquer um dos dois; também quando não há exatamente uma original. O modelo e o settle não podem discordar.
  - Saídas do modelo: `frase`, `padrao`, `rotuloDoBotao`, `saiEntra` e `linhaNeutra`. Os textos vêm do mockup e do arquivo da T7a.
  - A linha neutra tem duas frases:
    - sempre "O teste sugeria a B." (sem sugerida válida: omitir);
    - depois, "Esta versão teve CTR menor (x contra y)." se as duas versões têm CTR medido, ou "CTR não medido para esta versão." se não têm.
  - `misto` e `desconhecido` abrem a fase `conferindo`.
  - Testes:
    - as 17 combinações do objeto `E` do mockup, como tabela;
    - "Sugerida" nunca aparece junto de "Escolhida";
    - um mutante com 3 selos é recusado;
    - A sem `original_title`, ou sem cópia no Blob, fica com `bloqueio: 'sem_original'`;
    - sugerida que não é variante → sem selo "Sugerida" e sem a 1ª frase da linha neutra.
- [ ] **T9 Fases do painel, redutor puro e total (~140K).**
  - Arquivo: `painel-fases.ts`.
  - Eventos: `marcar`, `enviar` (leva `envioId`), `quinze_s`, `resposta` (leva `envioId`), `sem_resposta_45s`, `falha_rede`, `conferido`, `conferir_15s`.
  - Transições:
    - resposta `incerto` → fase `conferindo`;
    - **`falha_rede`** (a action rejeita com `TypeError: fetch failed`, caso do DevTools offline) → `conferindo`, nunca `erro`;
    - conferência `lido` igual à versão escolhida → `no_ar`; igual à versão anterior → `recusou`; igual a uma **terceira** versão → `recusou` com "No ar agora: X";
    - **`nao_propagou`** → `sem_rede` (ou fase própria) com o texto da T7a; nunca `recusou`;
    - **`lido_misto`** → fase `recusou` com "No ar agora" mostrando os dois campos (texto do `misto`, T7a), nunca `no_ar`; "Tentar de novo" com o `restoreSeq` resolve (o título dá `ok_sem_escrever`);
    - `nenhuma_versao` → `sem_rede` com texto próprio; `sem_leitura` ou 15 s sem resposta → `sem_rede`; `ja_encerrado`/`sem_permissao` → `erro`;
    - conferência `escrevendo` → continua conferindo e lê de novo em 3 s, **com teto de 5 leituras ou 45 s**, depois `sem_rede` com "Está demorando. Pode fechar…" (sem relógio no redutor: eventos explícitos);
    - **resposta tardia:** uma `resposta` com o `envioId` corrente em `conferindo` ou `sem_rede` vence a conferência; uma `resposta` de outro `envioId` é ignorada.
  - Testes: a tabela fase × evento inteira, com `assertNever`; o teste-chave prova que nenhum caminho sai de `conferindo` para `enviar` sem um clique do dono.
- [ ] **T10 D15: foco determinístico (~70K).**
  - Arquivo: `_shared/editor/use-modal-focus-trap.ts`. No `procurar()`, não mover o foco se `dialog.contains(document.activeElement)`. No painel, o aviso de erro é o alvo inicial quando existe. O hook tem 21 consumidores: `grep autoFocus` neles, porque a regra nova muda o comportamento de quem tem `autoFocus` filho e passa `initialFocusRef`.
  - Teste: `use-modal-focus-trap.test.tsx`, com `it('…', { repeats: 20 }, …)` (`--repeat` não existe no Vitest 3.2.7). O teste **reproduz a corrida**: o nó do diálogo monta depois de N quadros (stub do `requestAnimationFrame`), o alerta recebe foco antes, e se afirma que o foco fica no alerta. Sem o atraso, o teste passaria com e sem o conserto.
  - Os outros testes `ab-` continuam verdes.
- [ ] **T11 Componentes do painel concluído (~220K, Opus).**
  - Arquivos em `ab-lab/_components/pagina/`:
    - `painel-o-que-fica.tsx`: o modo ativo fica; o modo concluído delega para os componentes novos;
    - novos: `painel-concluido.tsx`, `opcao-versao.tsx`, `sai-entra.tsx` e `aviso-painel.tsx`;
    - `pagina-lab.css`.
  - Teste: `ab-lab-pagina-painel-concluido.test.tsx`, com um caso por estado da tabela acima. Afirma também:
    - Fechar travado durante `escrevendo`;
    - "Está demorando" aos 15 s, com fake timers;
    - o `onError` da miniatura;
    - o X com `aria-label="Fechar"` e alvo de 44 px;
    - o `aria-describedby` ligado à frase;
    - "Tentar de novo" chama `escolherVersao` com o `restoreSeq` novo (e é o único caminho de nova tentativa).
  - O `precisa_confirmar` reusa o `AbConfirmarTrocaDialog`, com `rotuloConfirmar="Deixar X no ar mesmo assim"`.
- [ ] **T12 Borda e "Com você" (~160K).**
  - Arquivos: `pagina-borda.ts`, `tipos.ts`, `com-voce.ts` e `montar.ts`.
  - **Restores:** ler só dos ids que a página usa (os `CONCLUIDOS_VISIVEIS` primeiros na ordem de `linhasConcluidas`, mais os do "Com você"; no máximo ~10 testes), com `lotes(ids, LOTE_UUIDS)` + `paginar(...)` de `teste-youtube/registro/ler.ts:346-360`, pedindo só `test_id, seq, campo, destino, estado, escreveu, motivo, iniciativa, em`, ordenado por `test_id, seq desc, campo` (o índice único é `(test_id, seq, campo)`; sem o desempate a fronteira de página duplica ou perde linha), agrupado num `Map<testId, TentativaNoAr[]>` uma vez (sem `filter` por teste dentro do `map`). Leitura com erro: as linhas ficam `desconhecido` e vai um aviso ao Sentry (não derruba a página). Nunca um histórico parcial.
  - **CTR (dias):** o `idsDias` inclui todo concluído visível v2 com painel possível (mesma condição de `painel !== null` da T13), não só o `comAcao`; senão a linha neutra diz "CTR não medido" para versões medidas.
  - O "Com você" decide `aplicar`/`escolher` pelas colunas de `ab_tests` (`escolha_em`, `completed_at`), sem precisar de restores. O item `aplicar` some quando a escolha já está gravada.
  - Item novo, `escolher`: para inconclusivo v2 sem escolha, até `JANELA_ESCOLHA_INCONCLUSIVO_DIAS = 30` depois do fim (pergunta P1; constante única, teste com data relativa).
  - Testes: uma leitura lógica de restores por visita; o fake do PostgREST corta em 1000 → a borda pede a 2ª página; concluído com escolha → `ctrs` preenchidos, ainda uma leitura de `ab_test_dias`; erro de leitura → `desconhecido` e Sentry.
- [ ] **T13 Linhas dos Concluídos (~100K).**
  - Arquivos: `concluidos.ts` e `secao-concluidos.tsx`.
  - Na `LinhaConcluida`, o campo `acao` dá lugar a `painel: PainelEscolha | null` + `selos: [teste, noAr]`.
  - A linha é um `<button>` que abre o painel; sem painel, ela não é clicável.
  - `grep` por "mockup: abre" dá zero.
- [ ] **T14 Ligação das actions (~60K).**
  - Arquivo: `corpo-do-lab.tsx`. O `ACOES_DECISAO` ganha `escolher` e `conferir`. Os "Aplicar" do "Com você" passam a chamar `escolherVersao` (um ponto de entrada só).
  - O client não importa `../actions`; as actions chegam só por props.
- [ ] **T15 Página do teste sem prazo (~120K).**
  - Arquivos: `concluido-v2-detail.tsx`, `winner-detail.tsx` e `[testId]/page.tsx`.
  - "Aplicar/Voltar até dd/mm" vira o botão "Escolher o que fica", que abre o mesmo painel. Entra no envio 2 porque o painel já não tem prazo e a página não pode dizer outra coisa.
  - O `revertWinner`, o ramo `reverter` e o "original vence" do `aplicarSugerido` **ficam** até o dono responder a P3; enquanto existirem, o `reverter` ok grava a escolha = original (T4).
- [ ] **T15b-2 D19: sai a faixa e o título passa à fonte única (~50K, depende de T2).**
  - Arquivos: `winner-detail.tsx:81-85`, `detail-header.tsx`, `[testId]/page.tsx` (uma leitura do histórico por `test_id`, o índice único `(test_id, seq, campo)` serve).
  - Regra do título: `confirmado` → o título da versão; `desconhecido` com `ultima` → o título da última, com o selo "na última leitura"; sem nada → `name`. Num teste só de miniatura, sempre `original_title ?? name`.
  - Sai a faixa "Vencedor aplicado — você pode reverter em até… / Restaura o thumbnail/título/descrição".
  - Teste: `grep` por "reverter em até" e por "Restaura o thumbnail" dá zero; o cabeçalho mostra o título de B; com C em `escreveu: null` não mostra o original.
- [ ] **T16 Paridade MCP de leitura (~80K, Sonnet).**
  - Arquivos: `services/youtube.ts` (`projetarTeste`), `mcp/tools.ts` e `cowork-instructions.ts`.
  - Testes: `test/mcp/ab-tests-intel.test.ts` (uma leitura de histórico `in(test_id)` por página; `escolha` sem `escolha_por`) e `test/mcp/mcp-schema-parity.test.ts`.
- [ ] **T17 Verificação (~40K).** Typecheck, `npx vitest run` completo e `npm run build:web`.
- [ ] **T18 Revisões.**
  - Logan e Naksu, na tela contra o mockup, a 1440 e a 390 px (~150K).
  - Yannis e Phil, no diff do servidor e dos puros: T1, T4–T7, **T9 (redutor) e T12 (leitura paginada)**, e os arquivos da T4 (faixa, ficha, `ab-restore-acoes`, E18, Observatório) (~140K).
  - Confirmar que a faixa de um campo `falhou` da escolha não some sozinha e diz "abra o painel do teste", e que o item continua no "Com você" (`escolha_em` segue nula).
- [ ] **T19 Prova do Gio em produção (~120K).** Ver a seção abaixo. É o "pronto" do envio 2.

Ordem: T2 antes de T4, T5, T7 e T15b-2; T3 antes de T6; T7a antes de T8; T8 e T9 antes de T11. T15a, T15c e T15b-1 (envio 1) não dependem de nada do M7b.

## Critérios de aceite por envio (Hanna)

**Envio 1 — Gio, em produção, 1440 e 390 px, num teste já existente**
1. D18: num teste de título rodando, ao abrir "Encerrar", B mostra a mesma miniatura de A e a nota "miniatura não muda"; "Sem imagem" não aparece. Num teste de miniatura, nada muda.
2. D19 (título): num concluído com B confirmada no ar, o cabeçalho mostra o título de B; sem confirmação, mostra o original, nunca o de uma variante.
3. D20: "Abrir no YouTube" aparece no cabeçalho do teste rodando e do concluído, abre `youtube.com/watch?v=<id>` em aba nova e tem alvo de pelo menos 44 px a 390 px.
4. A migration consta em `supabase migration list --linked`, as consultas de conferência do gatilho e do CHECK (T1) deram o esperado, e as telas do Lab abrem sem erro no Sentry na hora seguinte.
- O que o dono vê: o Encerrar de teste de título mostra a miniatura certa, o cabeçalho do concluído mostra o título que está no ar e há um botão para abrir o vídeo. Ele não precisa fazer nada.

**Envio 2 — Gio (roteiro da T19) e, depois, o dono numa tela**
1. Num concluído com B sugerida, marcar C: "Sai: B / Entra: C" dentro do painel, sem diálogo. "Deixar C no ar" muda o título no Studio para o de C; `winner_variant_id` continua B e a contagem do `getLearnings` é igual à de antes do clique.
2. "Manter a original (A)" com A no ar não faz nenhuma chamada `videos.update`. Mostra "Guardado." e o teste sai do "Com você" na próxima visita.
3. Com a sugerida = original, "Manter a original (A)" sobe a contagem do `getLearnings` em 1 (P2). Num inconclusivo dentro da janela da P1, o teste aparece no "Com você"; depois de "Manter a original", some.
4. Uma escrita que falha mostra o aviso vermelho com "No ar agora" relido. Com a rede caída logo depois do clique, aparece o estado âmbar "Conferindo".
5. A página do teste e o painel não mostram nenhum prazo ("até dd/mm", "7 dias", "reverter em até" dão zero no HTML de produção).
6. O Cowork (`manage_ab_test`) devolve `escolha` e `no_ar` com a mesma letra que a tela mostra.
7. Os 17 estados do mockup, a 1440 e a 390 px, batem com o aprovado, segundo o Logan e a Naksu (T18). A etiqueta "mockup: abre X" não aparece.
- O que o dono vê: "Em qualquer teste concluído você deixa no ar a versão que quiser, quando quiser, sem prazo. O resultado do teste não muda com a sua escolha." Ele abre um concluído só depois do ok do Gio.

## Como se prova em produção (teste descartável)

1. Usar um vídeo próprio **não listado**. Criar um teste de título com A, B e C, com o nome "[prova M7b] descartável".
2. Iniciar o teste. Gravar o desfecho com a RPC `ab_test_v2_gravar` (vencedor provável B), pelo script de prova `scripts/ab-prova-m7b.ts`, que só lê e chama essa RPC. Encerrar pelo `settleOnAir` com o motivo `regra_v2`. Criar um segundo teste igual, que fica `sem_diferenca_detectavel`. Criar um **terceiro** descartável com a sugerida = original (caso do "Manter a original" que sobe o `getLearnings` em 1).
3. Antes de clicar em qualquer coisa: anotar `select count(*) from ab_tests where status='completed' and winner_variant_id is not null and site_id=…` (valor X) e o `winner_variant_id` dos dois testes.
4. Roteiro, a 1440 e a 390 px:
   - estado i: A no ar, B marcada;
   - "Deixar B no ar" → estado a; no Studio, o título é o de B (motivo `aplicar_sugerido`: a contagem sobe para **X+1**, por desenho);
   - marcar C → estados b, c, e; o Studio mostra C; o vencedor continua B (conferir no SQL); contagem **X+1**;
   - "Deixar A no ar" → o `original_title` volta; contagem **X+1**;
   - no inconclusivo: f → marcar A → "Manter a original (A)" → f2. No SQL, `escolha_*` preenchidas e `restore_seq + 1`, sem `videos.update`;
   - terceiro teste (sugerida = original): "Manter a original (A)" grava `manual_winner` e `winner_variant_id` = a original; a contagem sobe **+1**, por desenho (P2); sem `videos.update` se A já está no ar;
   - estados d2 e d3c: DevTools offline logo depois do clique; depois de voltar online, o registro bate com o Studio.
5. Vigia: `select seq, campo, estado, escreveu, motivo, iniciativa, em from ab_test_restores where test_id = '<id>' order by seq;` antes e depois de duas execuções do vigia. Esperado: nenhuma seq nova; `iniciativa = 'dono'` nas linhas do `escolher` e do `aplicar_sugerido`. Depois: `select ab_event, count(*) from yt_own_video_versions where origin='ab_lab' group by 1` com `escolha` só para destino ≠ vencedor. Que o vigia ignora uma **falha** de escolha só é provado no teste unitário (T4): não se força falha em produção.
6. Arquivar os três testes (`status='archived'`, saem do `getLearnings`) e conferir que a contagem do passo 3 voltou a **X**. Devolver o título original ao vídeo.

## Riscos e perguntas ao dono

### Riscos ("o que acontece quando o dado não existe?")

- **`original_title` nulo, ou original sem cópia no Blob (testes de antes da P4a).** A opção A fica bloqueada, com o texto "O título original não foi guardado; não dá para voltar a ele daqui." (ou "A miniatura original…"). Nunca oferecer uma escrita que o settle pularia. O `bloqueio` é por tipo de teste (T8).
- **Variante original ausente ou duplicada.** Opção A bloqueada; `noArConfirmado` diz `desconhecido` para `'original'`; `escolherVersao` devolve `erro`.
- **A miniatura da variante some do Blob.** A tela mostra o estado j. A escrita é recusada com `arquivo_do_destino_indisponivel`, que vira `recusou` com `porque: 'arquivo_indisponivel'`.
- **CTR nulo.** Mostrar "CTR não medido". A linha "CTR menor" só aparece com as duas medidas. Nunca mostrar "0%".
- **`restore_status` nulo e histórico vazio.** `noArConfirmado` diz `desconhecido`, e o painel abre conferindo. Se não houver leitura possível, vai para o estado d3c.
- **Histórico só com tentativas anteriores ao fim do teste, ou `completed_at` nulo.** `desconhecido` (T2).
- **Leitura de restores com erro ou cortada.** `desconhecido` em todas as linhas e aviso ao Sentry. Nunca o histórico parcial (T12).
- **`result_metadata.v2` ilegível.** Sem painel; a linha fica sem clique.
- **Sugerida que não é variante do teste** (apagada, ou de outro teste). Tratar como sem sugerida: motivo `escolher`, sem `p_vencedor_esperado`, sem selo "Sugerida", linha neutra sem "O teste sugeria a B.", Sentry uma vez por teste.
- **`escolha_variant_id` nulo por FK com `escolha_em` preenchido** (variante apagada). A tela diz "Sua escolha foi registrada em dd/mm, mas a versão não existe mais"; o que está no ar vem só do `noArConfirmado`. Hoje só rascunhos são apagados, então o caso é raro.
- **`em_andamento` velho (mais de 2 min) sem resultado.** `desconhecido`, depois uma leitura do YouTube. Teto da espera `escrevendo`: `RECENTE_MS` 2 min menos os 45 s do painel, a cada 3 s dá cerca de 25 chamadas; a T9 limita a 5 leituras ou 45 s.
- **Vídeo apagado ou privado.** `sem_leitura`, nunca `nenhuma_versao`.
- **Miniatura recém-enviada.** Não se conclui "recusou" pela miniatura antes de 3 h (`nao_propagou`).
- **A função morre no meio da escrita** (60 s de `maxDuration` contra o teto de 55 s, ou exceção). O campo fica `em_andamento` com `iniciativa: 'dono'`, o painel vai para `conferindo`, e aos 15 min o vigia converte para `falhou/interrompido` **sem repetir**.
- **Duas abas ou dois administradores.** A CAS de `restore_seq` no claim e no "Manter" garante uma escrita só. A outra aba recebe `mudou`.
- **Dia do deploy, com o código velho ao lado.** Por minutos, o vigia velho não conhece `iniciativa` e repetiria uma escolha que falhou nessa janela. Risco baixo; não há conserto além de promover fora de horário de uso.
- **Alguém muda o título no Studio depois da escolha.** O `confirmado` é o último registro do Lab, não uma leitura do YouTube; o painel pode dizer "C no ar" com outro título. Nenhuma escrita parte dessa leitura (o caminho de escrita lê o YouTube nos passos 0b e 3). Dívida declarada: pagar no primeiro relato, ou quando o vigia passar a ler o título dos concluídos.
- **Combo parcial** (título C ok, miniatura falhou). `noArConfirmado` diz `misto`; a escolha não é gravada (só se grava com todos os campos ok) e o teste fica no "Com você". O "Tentar de novo" reivindica os dois campos, e o título volta a dar `ok_sem_escrever`.
- **Inconclusivo antigo (mais de 30 dias).** Não entra no "Com você"; o painel abre do mesmo jeito pelos Concluídos (estado f). A escolha nula continua "não decidiu"; nada se perde.
- **Dono não responde as perguntas abaixo.** Valem os padrões indicados em cada uma; todos são uma constante ou um commit pequeno, sem migration.
- **Volume de produção não medido.** Ninguém leu o tamanho real de `ab_tests`/`ab_test_restores` (sem autorização). Para o dono rodar quando quiser: `select count(*) filter (where status='completed'), (select count(*) from ab_test_restores) from ab_tests;`. O plano não depende do número (leitura limitada e paginada).


### Respostas do dono (27/10)

- **P1 = (a)** 30 dias.
- **P2 = (b), mudar agora:** o `getLearnings` conta o vencedor estatístico (`result_metadata.v2.vencedor_sugerido`) mesmo quando o dono escolhe outra versão, desde já. Nova tarefa **T7b** (abaixo).
- **P3 = recomendação do controlador:** apagar `revertWinner`, o ramo `reverter` e o "original vence" só depois que a T19 (prova em produção) passar; até lá, dívida registrada com data.
- **P4 = (a)** sem janela.

- [ ] **T7b (P2) `getLearnings` conta o vencedor estatístico (~60K, Sonnet; depois da T7).**
  - Arquivo: `queries.ts:677`.
  - Um teste concluído conta como aprendizado com vencedor quando tem `winner_variant_id` **ou** `result_metadata.v2.vencedor_sugerido` que seja variante do teste. A letra que conta é a do vencedor estatístico, nunca a da escolha do dono.
  - `regra_v2` sem sugerida (inconclusivo) continua não contando como vitória.
  - Testes:
    - sugerida B + escolha C → conta B;
    - sugerida = original + "Manter" → conta 1 vez (sem dobrar);
    - inconclusivo → não conta;
    - teste arquivado → não conta.
  - Atualizar a T19 e o critério 3 do envio 2: a contagem esperada passa a incluir os concluídos v2 com sugerida.

### Perguntas ao dono (cada uma com padrão; nada decidido por ele)

**P1. Quanto tempo um teste inconclusivo fica no "Com você" esperando a sua escolha?**
- (a) **30 dias depois do fim. Recomendação da Hanna, e o padrão do plano (`JANELA_ESCOLHA_INCONCLUSIVO_DIAS`).** Custo: zero a mais (já está na T12). Torna verdade o texto aprovado do f2 ("sai da lista do que espera você") e impede que inconclusivo velho lote a lista. Perde: depois de 30 dias o teste só aparece pelos Concluídos. Yannis concorda com 30.
- (b) **Sem prazo.** Custo: zero de código. Risco: a lista cresce com testes em que nada há a fazer (a original já está no ar) e vira ruído. Melhor se você costuma voltar a um inconclusivo semanas depois.
- (c) **Inconclusivo nunca entra no "Com você".** Custo: tira o item `escolher` da T12 (cerca de −40K), mas o texto do f2 tem de mudar, o que pede ao Logan um texto novo para um estado que você já aprovou. Perde: o inconclusivo não te chama.

**P2. O `getLearnings` deve passar a contar o vencedor estatístico (`result_metadata.v2.vencedor_sugerido`), mesmo quando você escolhe outra versão?** (achado M1 do Phil) "Manter a original" com sugerida = original sobe o getLearnings em 1.
- Hoje ele só conta teste com `winner_variant_id`, que só nasce quando você aplica a sugerida; quem escolhe C nunca conta a vitória de B, como já acontece hoje com quem não aplica.
- (a) **Não mudar no M7b. Recomendação do Phil** (o seu pedido foi "intacto"); a Hanna não se manifestou sobre este ponto, então a recomendação é só do Phil. Registrar a dívida "aprendizado lê `vencedor_sugerido`". Custo: zero agora; o aprendizado segue subcontando.
- (b) **Mudar agora.** Custo: as contagens de produção mudam e é preciso conferi-las (tarefa extra, ~60K, sem estimativa fina); o "intacto" deixa de valer.

**P3. Depois da T15, apagar o `revertWinner`, o ramo `reverter` e o "original vence" do `aplicarSugerido`?** (Yannis)
- (a) **Apagar na T15. Recomendação do Yannis:** menos um caminho de escrita, menos duas actions, menos testes, e nada mais muda o "no ar" sem gravar a escolha. A Hanna só opinou que a T15 vá no envio 2 por coerência da tela; sobre apagar, não se manifestou. Custo: ~+40K e um commit com remoção; o "Voltar até dd/mm" some de vez.
- (b) **Deixar e registrar a dívida com data.** Custo: zero agora. Risco: um segundo caminho de escrita permanece. Mitigado porque o `reverter` ok já grava `escolha_*` = original (T4).
- Enquanto você não responder, o plano segue em (b).

**P4. O teste com sugerida também deve sair do "Com você" depois de algum tempo?** (Hanna, para confirmar)
- (a) **Manter como hoje, sem janela. Recomendação da Hanna:** é uma recomendação concreta do teste, e o custo é zero. O inconclusivo tem janela (P1) e o com sugerida não: é uma assimetria, e você pode querer as duas iguais.
- (b) **Dar a mesma janela de 30 dias.** Custo: uma condição a mais na T12 (~+15K). Risco: uma sugerida boa some da lista sem você ter decidido.
