# Fila "Saíram do YouTube": runbook (E9)

O que a aba faz, o que cada vermelho do cron quer dizer, as consultas de conferência e como desligar ou reverter. Plano:
`docs/superpowers/plans/2026-10-13-a5-e9-fila-sairam-do-youtube-plan.md`. Conferências com data: `apps/web/src/lib/conferencias.ts` (`conferenciasE9`).

> As consultas abaixo rodam em PRODUÇÃO por quem o dono autorizar (`supabase db query --linked` para leitura). Ajuste de piso (K6) e saída de entrada do Blob (K7)
> ESCREVEM: o dono cola, **só depois de investigar**.

## 1. O que a aba faz

- O Observatório marca `missing_since` em vídeo, canal e comentário que o YouTube deixou de devolver (E1). Nada é apagado por prazo nem por cron: **sem resposta, o dado fica**.
- A aba "Saíram do YouTube" lista o que espera resposta (vídeos, canais e grupos de comentários), com o painel "o que some / o que fica" (contagem lida do banco, nunca estimada).
- "Manter" grava a decisão (autor, data, auditoria) e tira o item de "Esperando você". "Apagar" exige digitar `APAGAR`, roda UMA função do banco (transação única, auditoria sem título nem texto)
  e, depois do commit, apaga as miniaturas do Blob (só prefixo `observatorio/thumbs/`). O que o Blob não confirmar fica em `blobs_pending` e o item aparece em "Apagando".
- O cron de concorrentes (agenda e lote antigo) roda a prova dos ausentes a cada disparo, acusa apagamento pela metade e termina o que ficou no Blob (`fecharApagamentos`).
- Apagado que reaparece em `videos.list` não é inserido: a sincronização carimba `returned_seen_at` e o item aparece em "Voltaram ao ar".

## 2. Os vermelhos do cron e o que fazer

| Frase na mensagem do cron | O que é | O que fazer |
|---|---|---|
| `prova dos ausentes: schema ausente (MG-E9 não aplicada)` | código novo no ar, migration não aplicada | aplicar a MG18 (`npm run db:push:prod`, depois do portão); nada foi apagado nem lido errado |
| `prova dos ausentes: não foi possível conferir o schema` | a guarda não conseguiu ler | repetir no disparo seguinte; persistindo, olhar Sentry (`component:sync-youtube`) |
| `prova dos ausentes: não foi possível ler` | função falhou, forma errada ou chave faltando | **isolado, logo depois de um "apagar": confira o disparo seguinte antes de agir** (a prova cruza com a transação do apagar e tenta de novo 3 vezes); persistente: rodar K1 de fora |
| `prova dos ausentes: não foi possível ler a prova a tempo (passou de N s)` | banco lento | conferir o disparo seguinte; se repetir, olhar o banco |
| `N vídeos fora do ar perderam linhas sem resposta de apagar` | algo apagou série/versão de vídeo ausente sem a fila | **parar e investigar** (K1, K6 leitura); o vermelho só sai quando o dono ajusta o piso (K6), e ajustar é aceitar a perda |
| `N itens apagando há mais de 1 dia` | Blob não confirmou em 24 h | K3; "Tentar de novo" na aba; se uma entrada é recusada pelo apagamento (URL fora de `observatorio/thumbs/`), K7 depois de conferir o painel do Blob |

Notas (verde): `N itens esperando resposta na fila (o mais antigo há D dias)`; `N itens voltaram ao ar sem resposta na fila`; `prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)`.

**Site sem canal ativo com item "apagando" não fica vermelho** (a prova só roda para site com canal na lista): olhe a aba. A conclusão de apagamentos lê os sites das pendências e continua tentando.

## 3. Consultas (K1 a K7)

**K1: a prova, lida de fora** (não grava). Esperado: `quedas = 0`; `pisos` = `ausentes`.

```sql
with aus as (select v.id, coalesce(v.missing_since, c.missing_since) as desde, (select count(*) from competitor_video_daily d where d.video_id = v.id) + (select count(*) from competitor_video_early e where e.video_id = v.id) + (select count(*) from competitor_video_versions x where x.video_id = v.id) as linhas from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.missing_since is not null or c.missing_since is not null) select count(*) as ausentes, coalesce(sum(a.linhas), 0) as linhas_de_ausentes, count(b.video_id) as pisos, count(*) filter (where b.lines_floor is not null and a.linhas < b.lines_floor) as quedas from aus a left join competitor_missing_baseline b on b.video_id = a.id and b.missing_since = a.desde;
```

**K2: um item apagado não deixou nada** (trocar `<código do vídeo>`, mantendo as aspas simples, pelo código do vídeo; a consulta é copiável para `supabase db query --linked`). Esperado: `0, 1, 0, 0`.

```sql
select (select count(*) from competitor_videos where video_id = '<código do vídeo>') as linha_do_video, (select count(*) from competitor_removed_items where kind = 'video' and youtube_id = '<código do vídeo>') as registro, (select count(*) from audit_log where action = 'competitor_missing_purge' and after_data ->> 'kind' = 'video' and after_data ->> 'youtube_id' = '<código do vídeo>') - (select coalesce(max(purge_count), 0) from competitor_removed_items where kind = 'video' and youtube_id = '<código do vídeo>') as auditoria_menos_purge_count, (select coalesce(sum(cardinality(blobs_pending)), 0) from competitor_removed_items where kind = 'video' and youtube_id = '<código do vídeo>') as blobs_pendentes;
```

**K3: o que está "apagando" e há quanto tempo.** Esperado: nenhuma linha, ou todas com menos de 24 horas.

```sql
select id, kind, decided_at, cardinality(blobs_pending) as pendentes, archive_pending, now() - decided_at as ha from competitor_removed_items where cardinality(blobs_pending) > 0 or archive_pending order by decided_at;
```

**K4: quem espera resposta, por idade.** Número para o dono, não falha.

```sql
select 'video' as tipo, count(*), min(v.missing_since) as mais_antigo from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.missing_since is not null and v.removal_decision is null and c.missing_since is null union all select 'canal', count(*), min(missing_since) from competitor_channels where missing_since is not null and removal_decision is null union all select 'comentario', count(*), min(missing_since) from competitor_video_comments where missing_since is not null and removal_decision is null;
```

**K5: toda resposta tem auditoria, e a auditoria não tem texto.** Esperado: `0`, `0` e `0`.

```sql
select (select count(*) from competitor_removed_items r where r.kind in ('video', 'canal') and not exists (select 1 from audit_log a where a.action = 'competitor_missing_purge' and a.site_id = r.site_id and a.after_data ->> 'youtube_id' = r.youtube_id)) as apagados_sem_auditoria, (select count(*) from competitor_removed_items r where r.kind = 'comentario' and not exists (select 1 from audit_log a where a.action = 'competitor_missing_purge' and a.resource_type = 'competitor_comment_group' and a.site_id = r.site_id and a.created_at = r.decided_at)) as comentarios_sem_auditoria, (select count(*) from audit_log a where a.action like 'competitor_missing_%' and (a.after_data ? 'title' or a.after_data ? 'titulo' or a.after_data ? 'body' or a.before_data is not null)) as auditoria_com_conteudo;
```

**K6: o piso de um vídeo ausente e o ajuste dele.** Tira o cron do vermelho `N vídeos fora do ar perderam linhas`; **só depois** de saber por que as linhas caíram. Primeiro a leitura:

```sql
select b.video_id, b.missing_since, b.lines_floor as piso, b.measured_at, (select count(*) from competitor_video_daily d where d.video_id = b.video_id) + (select count(*) from competitor_video_early e where e.video_id = b.video_id) + (select count(*) from competitor_video_versions x where x.video_id = b.video_id) as linhas_hoje from competitor_missing_baseline b where b.lines_floor > (select count(*) from competitor_video_daily d where d.video_id = b.video_id) + (select count(*) from competitor_video_early e where e.video_id = b.video_id) + (select count(*) from competitor_video_versions x where x.video_id = b.video_id) order by b.measured_at;
```

Depois, um comando por vídeo, com os três valores copiados da leitura (o agente prepara, o dono cola; esperado: `UPDATE 1`):

```sql
update public.competitor_missing_baseline set lines_floor = <linhas_hoje>, measured_at = now() where video_id = '<video_id>' and missing_since = '<missing_since>' and lines_floor > <linhas_hoje>;
```

**K7: tirar de `blobs_pending` uma entrada que o apagamento recusa** (URL fora de `/observatorio/thumbs/`). **Só depois** de conferir à mão, no painel do Blob da Vercel, que o arquivo não existe mais ou foi apagado lá. Leitura (K3 dá o `id`) e o comando, um por entrada (esperado: `UPDATE 1`):

```sql
select id, kind, decided_at, blobs_pending from competitor_removed_items where id = <id>;
update public.competitor_removed_items set blobs_pending = array_remove(blobs_pending, '<entrada exata>') where id = <id>;
```

## 4. O interruptor

`OBS_PROVA_AUSENTES=off` desliga SÓ a prova dos ausentes e a conclusão de apagamentos no cron (padrão: ligado; qualquer outro valor, vazio ou ausente = ligado). Desligado nunca é verde mudo: nota em todo disparo.
É variável da Vercel: só vale depois de um redeploy de produção; religar, idem. As respostas da tela não têm interruptor. Religar até 3 dias depois (`e9-religar-prova`) e conferir K1.

## 5. A reversão

Reverter o Envio B (código) deixa a MG18 no banco sem uso; a aba some e o cron deixa de provar. Item com `blobs_pending` fica parado (ninguém mais tenta): K3 lista o que ficou, e o dono decide
(reenviar o código ou limpar à mão no Blob). **Nunca** reverter o Envio A (a consulta do apagado na sincronização) enquanto houver item apagado: o primeiro vídeo apagado e recente voltaria a ser coletado, sem aviso.

## 6. Ordem do envio (não inverter)

E1 e E2 em `main` → Envio A (sincronização consulta o apagado; conferência A1) → MG18 em produção (V1 a V3) → Envio B (aba, cron, `conferencias.ts` com `E9_DEPLOY`). O código novo sem a MG18 deixa o cron vermelho a cada 20 minutos (`schema ausente`).
