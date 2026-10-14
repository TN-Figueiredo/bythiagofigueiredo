# Observatório: exportar, pausar e remover um canal de concorrente (runbook)

Plano: `docs/superpowers/plans/2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md` (E10). Comando: `npx tsx scripts/obs-arquivo.ts <comando>`, na raiz do repositório.
Estado do código em 14/10/2026: o comando, o export, a conferência e a remoção por comando existem; a **migration MG6 ainda não foi aplicada em produção** (só o dono aplica: `npm run db:push:prod`). Sem ela, todo comando que fala com o banco para com "A migration da exportação ainda não foi aplicada neste banco. Nada foi feito."

## 1. Regras de processo

- **Escrita no NAS e confirmação da cópia são do dono, sem exceção.** Nenhum agente roda `ssh`, `scp`, `rsync`, `confirmar-nas` nem `remover` em produção. O agente prepara os comandos, curtos, um por linha (`comandos-nas` só imprime), e o dono cola.
- `confirmar-nas` e `remover` só rodam num terminal de verdade e pedem o nome da exportação digitado.
- **Variável `OBS_ARQUIVO_DB_URL`** (de terminal do dono, não da Vercel): URL de conexão ao Postgres de produção, com a senha do chaveiro. O comando nunca lê `apps/web/.env.local` (ele aponta para produção) e nunca imprime a URL. Exportar no terminal: `export OBS_ARQUIVO_DB_URL='postgresql://...'`.
  - **Qual endereço:** o comando precisa de sessão fixa (cursor, `set local`). A conexão direta do Supabase pode ser só IPv6 no plano gratuito (**não medido**). Se a rede do dono não alcançar, usar o endereço do pooler em **modo sessão (porta 5432)**, nunca o modo transação (porta 6543), que quebra o cursor. O ensaio (item 82) anota qual funcionou: ______.
- Pasta local do export: `~/Workspace/arquivo-observatorio/<exportação>/` (`--pasta` troca).

## 2. Antes de qualquer pausa

- **Não pausar nenhum canal antes da conferência `e10-d0`.** O comando `pausar` existe assim que a MG6 é aplicada, mas o código antigo não respeita a pausa (a trava antiga não tem a condição) e as provas já tiram o canal.
- Antes de reverter o código para um anterior, **despausar todos** os canais (`estado` lista os pausados).
- **Pausar por engano custa prova.** Mesmo uma pausa de um minuto deixa o canal 7 dias fora da prova de comentários, 3 dias fora da de série e 26 horas fora da horária depois de despausar. A cauda é fixa de propósito.

## 3. Os comandos, na ordem

Um canal por vez. `<canal>` é o uuid do canal em `competitor_channels`; `<e-mail>` é o e-mail do administrador do site.

1. `npx tsx scripts/obs-arquivo.ts estado`  (o que está pausado, exportado, pendente; o sinal de tamanho do banco)
2. `npx tsx scripts/obs-arquivo.ts pausar --canal <canal> --por <e-mail>`
3. Esperar **6 minutos** (o banco recusa exportar antes: `pausa_recente`).
4. `npx tsx scripts/obs-arquivo.ts exportar --canal <canal>`  (nome padrão `canal-<8 primeiros caracteres do id>-<AAAA-MM-DD>`; `--lote` troca)
5. `npx tsx scripts/obs-arquivo.ts conferir --canal <canal> --lote <exportação>`
6. `npx tsx scripts/obs-arquivo.ts comandos-nas --lote <exportação> --destino <usuario@host:/caminho>`  (só imprime; cola os dois comandos impressos, um por linha, e confere o `sha256sum -c` no NAS)
7. `npx tsx scripts/obs-arquivo.ts confirmar-nas --canal <canal> --lote <exportação> --por <e-mail>`  (pede o nome digitado)
8. `npx tsx scripts/obs-arquivo.ts remover --canal <canal> --por <e-mail>`  (pede o nome digitado; recontagem de todas as tabelas contra o arquivo dentro da mesma transação que apaga; depois apaga as miniaturas do Blob)

Pelo botão "Remover canal" do CMS só **depois** da Tarefa 11b e **se** a conferência C10 permitir. Medido em 14/10 (C10): o papel da API tem teto de 8 s; a remoção por comando tem teto de 10 minutos declarado por ele. **Até a 11b entrar, o botão do CMS continua apagando sem exportação: não remover canal pelo CMS.**

## 4. O que cada recusa quer dizer

A frase vem do catálogo (`arquivo/codigos.ts`); a mensagem do banco nunca aparece.

| Código | O que fazer |
|---|---|
| `nao_pausado` | pausar antes de exportar |
| `pausa_recente` | esperar os 6 minutos |
| `forja_em_andamento` | esperar a leitura da forja terminar e exportar de novo |
| `sincronizando` | esperar a sincronização do canal terminar |
| `sem_lote` | o canal ainda não foi exportado |
| `lote_nao_conferido` | rodar `conferir` |
| `lote_nao_confirmado` | copiar para o NAS e rodar `confirmar-nas` |
| `despausado_depois_do_export` | a exportação deixou de valer (a coleta voltou): pausar e exportar de novo |
| `banco_difere_do_manifesto` | o banco mudou depois do export. Nada foi apagado. Exportar de novo (`--refazer`) e remover. Pode ser a prova dos ausentes (E9, a cada 20 minutos), que grava `competitor_missing_baseline` para um vídeo do canal recém-pausado: nada se perde, é exportar de novo |
| `tabela_sem_export` | existe tabela do canal que o export não cobre. Nada pode ser exportado nem removido até uma migration recriar `obs_archive_registry()`: pedir ao agente |
| `sobrou_linha`, `apagou_alem_do_arquivo` | a operação foi desfeita sozinha; nada apagado. Exportar de novo e avisar o agente |
| `lote_ja_apagado` | usar outro nome em `--lote` |
| `demorou_demais` | nada foi apagado; o canal continua pausado e a exportação continua confirmada; remover pelo comando |
| `sem_direito` | só quem administra o site (`--por` com o e-mail dele) |
| `pausa_sem_remendo` | a MG6 não está completa: alguma função da coleta não conhece a pausa. Nada foi pausado |
| `schema_ausente` | a MG6 não foi aplicada neste banco |
| `inesperado` | a causa foi registrada; tentar de novo mais tarde |

## 5. Como voltar atrás

- Pausado por engano: `despausar --canal <canal> --por <e-mail>` (a exportação aberta é encerrada com motivo `despausado`).
- Antes da remoção, tudo se desfaz: reexportar com `--refazer`, ou despausar.
- Depois da remoção, só recarregando o arquivo (seção 6).
- **Lote encerrado pode sair do disco.** Uma exportação com motivo `despausado` é de um canal que continua vivo no banco online; a pasta dela (no Mac e, se já copiada, no NAS) guarda texto de comentários e miniaturas de terceiros sem servir de arquivo de nada. `estado` lista as encerradas com a pasta; o dono apaga quando quiser (escrita no NAS: do dono).
- **Canal apagado pela fila com exportação aberta** (resposta "apagar" da fila Saíram do YouTube, E9): a exportação fecha com `closed_reason = 'canal_apagado'`. `select batch, channel_ref from public.obs_archive_batches where closed_reason = 'canal_apagado'` lista o que ainda está no NAS e na pasta local. **Nem este plano nem o da E9 apagam do NAS nem da pasta local o que já foi exportado**: o dono apaga à mão (pergunta R-B do documento de reconciliação).
- Um "apagar" da fila não alcança o arquivo: a tela da E9 avisa quando existe exportação do canal.

## 6. Recarregar um arquivo num Postgres

`npx tsx scripts/obs-arquivo.ts comandos-recarga --lote <exportação>` imprime as linhas `\copy <tabela> (<colunas do manifesto>) from program 'gzip -dc <arquivo>' csv header`, na ordem pai antes de filho. **Nunca usar o `\copy` sem a lista de colunas.** Ensaio de recarga (reduzido): `.superpowers/sdd/a5-e10/recarga-prova.sql` e `recarga-prova-saida.txt`: 0 linhas de diferença nos dois sentidos; nulo e texto vazio continuam distintos.

## 7. O sinal de limite do banco (500 MB do plano gratuito)

- Medido **uma vez por dia**, a partir das 05:00 de São Paulo, pela tarefa `tamanho_do_banco` da agenda (entra com a Tarefa 9 do plano; **ainda não registrada**). Guarda uma linha por dia em `obs_db_size_daily`.
- Cor pelo **inteiro mostrado**: amarelo a partir de 70%, vermelho a partir de 85% do limite (`RULES.dbSize`); "acima do limite" é decidido pelos bytes. Também fica vermelho quando a reta dos últimos 28 dias (mínimo 14 dias de medida) chega ao limite em menos de 90 dias.
- **Amarelo:** olhar `estado` e a sugestão de canais parados (`competitor_archive_suggestions`); planejar exportar e remover os candidatos. **Vermelho:** exportar e remover agora; o plano gratuito não tem folga para esperar. O cron **não** fica vermelho por banco amarelo ou vermelho (a condição dura meses e esconderia outras falhas): a frase vai em `acao_do_dono` a cada disparo e sai um e-mail (um por mês no amarelo, um por semana no vermelho).
- **"Sem leitura":** nunca é verde. Banco nunca medido: "Ainda sem medida do tamanho do banco do site." mais o motivo (agenda desligada, ou agenda ligada há mais de 72 h sem a medida). O cron fica vermelho se a medida falta há mais de 72 h.
- **Interruptor:** `OBS_AGENDA_TASKS_OFF=tamanho_do_banco` (pede redeploy) desliga **duas coisas**: a medida e a nova tentativa de apagar as miniaturas pendentes; esta só roda no disparo em que a medida deu certo. Por isso o interruptor deixa o cron vermelho em 72 h.
- **Com a agenda desligada (`OBS_AGENDA=off`) ou a MG10 falhando**, as linhas do banco e do arquivo não estão em `acao_do_dono`: estão em `acao_do_dono_arquivo`, e o estado em `banco`, na mesma resposta do cron.
- C2 pendente: comparar `db_bytes` com o painel do Supabase (Settings, Usage). Se o painel mostrar a soma de todos os bancos, `RULES.dbSize.limitMb` desce proporcionalmente.

### Quando o banco cruza os limites (OP-9, **ESTIMATIVA**, refazer com a reta medida na conferência `e10-d28`)

Fórmula da seção 9.6 do spec: base 102,7 MB depois da dieta, 31 MB por ano do resto do site, por canal e por ano 7,4, 8,2 e 9,0 MB mais 5,2 MB da leitura horária crua. Mês contado de outubro de 2026. Nenhum número é medido. Antes da dieta (`yt_own_video_daily` com 68,7 MB) o banco está em 170,7 MB, e o amarelo chega cerca de 4 meses antes.

| Canais | Cruza 500 MB (mês) | Cruza 350 MB, amarelo (mês) |
|---|---|---|
| 15 (hoje são 13) | 21 a 22 | 13 a 14 |
| 20 | 17 | 10 a 11 |
| 30 | 12 | 7 a 8 |
| 50 | 8 | 5 |
| 75 (teto `RULES.channelLimit`) | 5 | 3 a 4 |
| 100 | 4 | 2 a 3 |
| 200 | 2 | 1 a 2 |

## 8. Miniaturas pendentes no Blob

Depois de remover, as miniaturas do canal são apagadas do Blob (só sob `observatorio/thumbs/`, decidido pelo caminho da URL). O que falha fica em `blob_urls_pending` e a nova tentativa diária apaga até 200 por dia (`RULES.archive.blobRetryMaxPerDay`), dentro da tarefa `tamanho_do_banco`.

- **"N miniatura(s) ainda públicas há D dias":** N caindo de um dia para o outro = a fila anda, nada a fazer. Um canal com mais de 600 miniaturas leva mais de 3 dias sem haver falha (a frase traz "faltam K dias"). N parado por dois dias = está falhando: olhar o `detalhe` da tarefa `tamanho_do_banco`: `miniaturas_nao_tentadas` = token do Blob ausente; `miniaturas_sem_tempo` = Blob lento. **Não há comando para esvaziar na hora nesta etapa** (seria um segundo caminho de apagamento no Blob, fora da lista fechada); se a C8 mostrar canal com mais de 600 miniaturas, o que muda é a constante `RULES.archive.blobRetryMaxPerDay`.
- **"N fora do prefixo"** (`miniaturas_fora_do_prefixo`): URL que não está sob `observatorio/thumbs/`; hoje não tem como nascer (só existe um `put`, com o prefixo). O código nunca a apaga e ela fica na pendência. Ver quais: `select batch, channel_ref, u from public.obs_archive_batches, unnest(blob_urls_pending) u where deleted_at is not null and u not like '%/observatorio/thumbs/%';`. O dono decide; baixar a pendência é pedido ao agente, em migration ou comando próprio, nunca à mão.
- **"Exportações de canais que não existem mais"** é histórico, não pendência: é o número de exportações abertas cujo canal foi removido por fora do caminho com arquivo. Nunca desce, e não há o que fazer com ele além de saber.
- Com `OBS_E2E=1` (Playwright) o Blob nunca é tocado: a pendência fica.

## 9. Cópia, disco e remoção pelo comando

- **O NAS é cópia única.** Uma segunda cópia é decisão do dono, a anotar aqui: ______.
- **A pasta local `~/Workspace/arquivo-observatorio/<exportação>/` não tem prazo.** Ela guarda texto de comentários e miniaturas de terceiros no Mac do dono. O dono decide e anota aqui se ela é a segunda cópia (fica) ou se sai depois do `sha256sum -c` no NAS: ______. A resposta "apagar" da fila (E9) tem de alcançar esta pasta também.
- **Remover pelo comando não limpa o cache do CMS.** O canal removido pode continuar aparecendo na tela por até 15 minutos (o pacote vale 900 s). Não é falha, e não é para remover de novo.
- Nada nesta etapa exporta ou remove o **canal próprio**, nem exporta por idade (isso é a fase de manutenção).
- A limpeza do bruto dos relatórios **não** foi reaberta: `yt_reporting_blobs_purge` continua devolvendo 0 (MG13), e o teste da lista fechada afirma isso.

## 10. Tempos medidos

Medida local (`E10_MEDIR=1`, em segundo plano, com a saída em arquivo; sem a variável ela é pulada e os tempos ficam "não medidos"), no `bythiago_int` do Mac, com 200 vídeos, 365 dias de série por vídeo (73.000 linhas), 14 dias de horária (67.200) e 2.000 comentários: `obs_archive_register` 29 ms, `obs_archive_verify` 28 ms, `competitor_archive_suggestions` 2 ms, `competitor_channel_remove_archived` 96 ms. **Ordem de grandeza local, não de produção.** Tempo real do ensaio em produção (item 82): `exportar` ______, `conferir` ______, `remover` ______.

## 11. Ensaio com o dono (item 82)

Espaço para o resultado: data ______; canal ______; endereço do banco que funcionou ______; o que recusou e por quê ______; tempos (seção 10) ______.

## 12. Lista fechada do que apaga

Testes `test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts` (estático, na CI) e `test/integration/observatorio-a5-e10-lista-fechada.test.ts` (catálogo do banco). Todo `delete` novo no Observatório precisa de uma linha lá, de propósito. **O que nenhum dos dois vê:** as funções temporárias das migrations destrutivas (MG15, MG16 e a função de dieta da MG17) são criadas e apagadas no mesmo arquivo; não estão no catálogo no fim nem no TypeScript. Os pares delas ficam declarados no ledger comum (`.superpowers/sdd/a5/fila-do-db-push.md`), com a linha de 9.2 de cada um.
